# Lab 1: etcd backup and restore

The application `narudzbe` runs in the namespace `produkcija`. You will take a snapshot of the etcd database, simulate an incident (someone deletes the whole namespace) and restore the cluster from the snapshot.

This is one of the most common CKA tasks. Read the exact certificate paths from the etcd static Pod manifest instead of relying on memory.

<!-- setup
set -e
cluster-up
kubectl create ns produkcija >/dev/null
kubectl -n produkcija create deploy narudzbe --image=nginx:1.28 --replicas=2 >/dev/null
kubectl -n produkcija create configmap narudzbe-config --from-literal=valuta=EUR >/dev/null
mkdir -p /opt/backup
-->

## etcd database snapshot

Save a snapshot of the etcd database to `/opt/backup/etcd-snapshot.db`. Use `etcdctl` and the certificates from the etcd manifest.

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
[ -s /opt/backup/etcd-snapshot.db ] || { echo "/opt/backup/etcd-snapshot.db does not exist"; exit 1; }
etcdutl snapshot status /opt/backup/etcd-snapshot.db >/dev/null 2>&1 || { echo "the file is not a valid etcd snapshot"; exit 1; }
grep -aq '/registry/deployments/produkcija/narudzbe' /opt/backup/etcd-snapshot.db || { echo "the snapshot does not contain the narudzbe deployment"; exit 1; }
-->
<!-- hint
Without `--cacert/--cert/--key`, etcdctl gets `context deadline exceeded` because etcd requires a client certificate (mTLS). If you see `--peer-cert-file` in the manifest, that is not the right client certificate; use `server.crt`/`server.key` (or `healthcheck-client`).
-->
<!-- solution
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/backup/etcd-snapshot.db
-->

## Incident

Simulate an incident: delete the namespace `produkcija` with all resources in it.

```bash
kubectl delete ns produkcija
kubectl get ns
```

<!-- verify
kubectl get ns produkcija >/dev/null 2>&1 && { echo "namespace produkcija still exists"; exit 1; }
[ -s /opt/backup/etcd-snapshot.db ] || { echo "no snapshot from the previous step"; exit 1; }
-->
<!-- solution
kubectl delete ns produkcija --wait=true --timeout=120s
-->

## Restore from the snapshot

Restore etcd from `/opt/backup/etcd-snapshot.db`:

1. Extract the snapshot into the new directory `/var/lib/etcd-restore` with `etcdutl`. Since etcd 3.6, `etcdctl snapshot restore` no longer exists.
2. In `/etc/kubernetes/manifests/etcd.yaml`, point the `hostPath` of the `etcd-data` volume at `/var/lib/etcd-restore`.
3. Wait for the kubelet to restart etcd and for the API server to come back (this can take a minute).

```bash
etcdutl snapshot restore /opt/backup/etcd-snapshot.db --data-dir /var/lib/etcd-restore
vim /etc/kubernetes/manifests/etcd.yaml
watch crictl ps
kubectl -n produkcija get all
```

<!-- verify
grep -q 'path: /var/lib/etcd-restore' /etc/kubernetes/manifests/etcd.yaml || { echo "etcd.yaml does not use /var/lib/etcd-restore yet"; exit 1; }
[ -d /var/lib/etcd-restore/member ] || { echo "/var/lib/etcd-restore does not contain an extracted snapshot"; exit 1; }
kubectl get ns produkcija >/dev/null 2>&1 || { echo "namespace produkcija was not restored (the API server may not be ready yet)"; exit 1; }
kubectl -n produkcija get deploy narudzbe >/dev/null 2>&1 && kubectl -n produkcija get cm narudzbe-config >/dev/null 2>&1 || { echo "the deployment or configmap was not restored"; exit 1; }
-->
<!-- hint
In `etcd.yaml` it is enough to change the `hostPath.path` of the `etcd-data` volume. The `--data-dir` flag and `mountPath` can stay `/var/lib/etcd`, because the new host directory is mounted at the same place in the container. Until etcd is back, `kubectl` returns `connection refused`; watch `crictl ps -a | grep etcd` and `crictl logs <id>`.
-->
<!-- solution
etcdutl snapshot restore /opt/backup/etcd-snapshot.db --data-dir /var/lib/etcd-restore >/dev/null
sed -i 's#path: /var/lib/etcd$#path: /var/lib/etcd-restore#' /etc/kubernetes/manifests/etcd.yaml
sleep 20
for i in $(seq 90); do kubectl get ns produkcija >/dev/null 2>&1 && break; sleep 2; done
-->
