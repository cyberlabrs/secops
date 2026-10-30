# Lab 1: etcd backup i restore

U namespaceu `produkcija` radi aplikacija `narudzbe`. Napravićeš snapshot etcd baze, simulirati incident (neko obriše cijeli namespace) i vratiti klaster iz snapshota.

Ovo je jedan od najčešćih CKA zadataka. Tačne putanje certifikata pročitaj iz manifesta etcd static Poda, ne napamet.

<!-- setup
set -e
cluster-up
kubectl create ns produkcija >/dev/null
kubectl -n produkcija create deploy narudzbe --image=nginx:1.28 --replicas=2 >/dev/null
kubectl -n produkcija create configmap narudzbe-config --from-literal=valuta=EUR >/dev/null
mkdir -p /opt/backup
-->

## Snapshot etcd baze

Sačuvaj snapshot etcd baze u `/opt/backup/etcd-snapshot.db`. Koristi `etcdctl` i certifikate iz manifesta etcd-a.

```bash
grep -E 'listen-client-urls|cert-file|key-file|trusted-ca-file' /etc/kubernetes/manifests/etcd.yaml
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /opt/backup/etcd-snapshot.db
etcdutl snapshot status /opt/backup/etcd-snapshot.db -w table
```

<!-- verify
[ -s /opt/backup/etcd-snapshot.db ] || { echo "/opt/backup/etcd-snapshot.db ne postoji"; exit 1; }
etcdutl snapshot status /opt/backup/etcd-snapshot.db >/dev/null 2>&1 || { echo "fajl nije ispravan etcd snapshot"; exit 1; }
grep -aq '/registry/deployments/produkcija/narudzbe' /opt/backup/etcd-snapshot.db || { echo "snapshot ne sadrži deployment narudzbe"; exit 1; }
-->
<!-- hint
Bez `--cacert/--cert/--key` etcdctl dobija `context deadline exceeded` jer etcd traži klijentski certifikat (mTLS). Ako u manifestu vidiš `--peer-cert-file`, to nije pravi certifikat za klijenta; koristi `server.crt`/`server.key` (ili `healthcheck-client`).
-->
<!-- solution
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/backup/etcd-snapshot.db
-->

## Incident

Simuliraj incident: obriši namespace `produkcija` sa svim resursima u njemu.

```bash
kubectl delete ns produkcija
kubectl get ns
```

<!-- verify
kubectl get ns produkcija >/dev/null 2>&1 && { echo "namespace produkcija još postoji"; exit 1; }
[ -s /opt/backup/etcd-snapshot.db ] || { echo "nema snapshota iz prethodnog koraka"; exit 1; }
-->
<!-- solution
kubectl delete ns produkcija --wait=true --timeout=120s
-->

## Restore iz snapshota

Vrati etcd iz `/opt/backup/etcd-snapshot.db`:

1. Raspakuj snapshot u novi direktorij `/var/lib/etcd-restore` sa `etcdutl`. Od etcd 3.6 `etcdctl snapshot restore` više ne postoji.
2. U `/etc/kubernetes/manifests/etcd.yaml` usmjeri `hostPath` volumena `etcd-data` na `/var/lib/etcd-restore`.
3. Sačekaj da kubelet ponovo pokrene etcd i da API server proradi (može trajati minut).

```bash
etcdutl snapshot restore /opt/backup/etcd-snapshot.db --data-dir /var/lib/etcd-restore
vim /etc/kubernetes/manifests/etcd.yaml
watch crictl ps
kubectl -n produkcija get all
```

<!-- verify
grep -q 'path: /var/lib/etcd-restore' /etc/kubernetes/manifests/etcd.yaml || { echo "etcd.yaml još ne koristi /var/lib/etcd-restore"; exit 1; }
[ -d /var/lib/etcd-restore/member ] || { echo "/var/lib/etcd-restore ne sadrži raspakovan snapshot"; exit 1; }
kubectl get ns produkcija >/dev/null 2>&1 || { echo "namespace produkcija nije vraćen (API server možda još nije spreman)"; exit 1; }
kubectl -n produkcija get deploy narudzbe >/dev/null 2>&1 && kubectl -n produkcija get cm narudzbe-config >/dev/null 2>&1 || { echo "deployment ili configmap nisu vraćeni"; exit 1; }
-->
<!-- hint
U `etcd.yaml` je dovoljno promijeniti `hostPath.path` volumena `etcd-data`. `--data-dir` flag i `mountPath` mogu ostati `/var/lib/etcd`, jer se novi host direktorij montira na isto mjesto u kontejneru. Dok etcd ne proradi, `kubectl` vraća `connection refused`; prati `crictl ps -a | grep etcd` i `crictl logs <id>`.
-->
<!-- solution
etcdutl snapshot restore /opt/backup/etcd-snapshot.db --data-dir /var/lib/etcd-restore >/dev/null
sed -i 's#path: /var/lib/etcd$#path: /var/lib/etcd-restore#' /etc/kubernetes/manifests/etcd.yaml
sleep 20
for i in $(seq 90); do kubectl get ns produkcija >/dev/null 2>&1 && break; sleep 2; done
-->
