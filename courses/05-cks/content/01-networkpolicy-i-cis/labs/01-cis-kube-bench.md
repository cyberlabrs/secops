# Lab 1: CIS benchmark sa kube-bench

Revizija traži da klaster prođe ključne provjere iz **CIS Kubernetes Benchmarka**. Koristićeš `kube-bench`, koji provjerava konfiguraciju komponenti na čvoru i za svaki nalaz daje ispravku (remediation).

```bash
kube-bench run --targets master | less
kube-bench run --targets master --check 1.2.15
ssh node01 kube-bench run --targets node
```

Izlaz ima sekcije `[PASS]`, `[FAIL]` i `[WARN]`, a na kraju `== Remediations ==` sa tačnim uputstvom za svaki nalaz.

<!-- setup
set -e
cluster-up
# "privremena" konfiguracija kubeleta na node01, ostala od debugiranja
ssh node01 'awk '"'"'
/^  anonymous:/ {print; getline; print "    enabled: true"; next}
/^  mode: Webhook/ {print "  mode: AlwaysAllow"; next}
{print}'"'"' /var/lib/kubelet/config.yaml > /tmp/k.yaml && cat /tmp/k.yaml > /var/lib/kubelet/config.yaml && systemctl restart kubelet'
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Profiling u kontrolnoj ravni

kube-bench prijavljuje `FAIL` za **1.2.15**, **1.3.2** i **1.4.1**: kube-apiserver, kube-controller-manager i kube-scheduler imaju uključen profiling (`/debug/pprof`). Profiling otkriva detalje o radu komponente i povećava površinu napada.

Ispravi sve tri komponente, tako da te tri provjere budu `PASS`. Manifeste nađeš u `/etc/kubernetes/manifests/`.

<!-- verify
out=$(kube-bench run --targets master --check 1.2.15,1.3.2,1.4.1 2>/dev/null)
for c in 1.2.15 1.3.2 1.4.1; do echo "$out" | grep -q "^\[PASS\] $c " || { echo "kube-bench $c još nije PASS"; exit 1; }; done
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara (sačekaj da se komponente ponovo pokrenu)"; exit 1; }
-->
<!-- hint
U `command` listu svakog od tri manifesta dodaj `- --profiling=false`. Kubelet ponovo pokreće static Pod kad se manifest promijeni; prati `watch crictl ps`.
-->
<!-- solution
for f in kube-apiserver kube-controller-manager kube-scheduler; do
  grep -q -- '--profiling=false' /etc/kubernetes/manifests/$f.yaml || sed -i "s#^\(\s*\)- $f\$#\1- $f\n\1- --profiling=false#" /etc/kubernetes/manifests/$f.yaml
done
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
for f in kube-apiserver kube-controller-manager kube-scheduler; do kubectl -n kube-system wait --for=condition=Ready pod/$f-controlplane --timeout=120s >/dev/null; done
-->

## Vlasništvo etcd direktorija

Provjera **1.1.12** traži da direktorij sa podacima etcd-a pripada korisniku `etcd`. Na čvoru takav korisnik ne postoji.

Napravi sistemskog korisnika `etcd` (bez login shella) i postavi vlasništvo direktorija podataka na `etcd:etcd`. Direktorij pronađi u manifestu etcd-a (`--data-dir`).

<!-- verify
kube-bench run --targets master --check 1.1.12 2>/dev/null | grep -q '^\[PASS\] 1.1.12 ' || { echo "kube-bench 1.1.12 još nije PASS"; exit 1; }
getent passwd etcd | grep -q nologin || { echo "korisnik etcd nema nologin shell"; exit 1; }
-->
<!-- hint
`useradd -r -s /usr/sbin/nologin etcd` i `chown -R etcd:etcd /var/lib/etcd`. etcd kontejner radi kao root, pa promjena vlasništva ne smeta njegovom radu.
-->
<!-- solution
id etcd >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin etcd
chown -R etcd:etcd /var/lib/etcd
-->

## Kubelet na node01

Pokreni provjeru čvora na `node01`. Neko je ostavio kubelet otvoren:

- anonimni zahtjevi su dozvoljeni (**4.2.1**),
- autorizacija je `AlwaysAllow` (**4.2.2**), pa bilo ko ko dođe do porta 10250 može izvršavati komande u kontejnerima na tom čvoru.

Popravi konfiguraciju kubeleta na `node01` (`/var/lib/kubelet/config.yaml`), tako da 4.2.1 i 4.2.2 budu `PASS`, i restartuj kubelet.

```bash
ssh node01 kube-bench run --targets node --check 4.2.1,4.2.2
ssh node01 grep -A8 '^authentication' /var/lib/kubelet/config.yaml
curl -sk https://node01:10250/pods | head -c 200
```

<!-- verify
out=$(ssh node01 kube-bench run --targets node --check 4.2.1,4.2.2 2>/dev/null)
for c in 4.2.1 4.2.2; do echo "$out" | grep -q "^\[PASS\] $c " || { echo "kube-bench $c još nije PASS na node01"; exit 1; }; done
code=$(curl -sk -o /dev/null -w '%{http_code}' https://node01:10250/pods)
[ "$code" = "401" ] || { echo "anonimni zahtjev na kubelet API vraća $code (očekivano 401)"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 nije Ready"; exit 1; }
-->
<!-- hint
U `config.yaml`: `authentication.anonymous.enabled: false` i `authorization.mode: Webhook`. Zatim `systemctl restart kubelet` na node01.
-->
<!-- solution
ssh node01 "sed -i '/^  anonymous:/{n;s/enabled: true/enabled: false/}; s/^  mode: AlwaysAllow/  mode: Webhook/' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
sleep 3
-->
