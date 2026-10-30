# Lab 2: StorageClass i dinamičko obezbjeđivanje

U klasteru radi **local-path provisioner** (`rancher.io/local-path`), koji pravi PV automatski kada se pojavi PVC. Napravićeš vlastitu StorageClass sa drugačijim pravilima i promijeniti podrazumijevanu klasu.

```bash
kubectl get sc
kubectl get sc local-path -o yaml
kubectl -n local-path-storage get pods
```

<!-- setup
set -e
cluster-up
kubectl create ns baze >/dev/null
-->

## StorageClass sa Retain

Napravi StorageClass `local-retain`:

- `provisioner: rancher.io/local-path`,
- `reclaimPolicy: Retain` (podaci ostaju i kad se PVC obriše),
- `volumeBindingMode: WaitForFirstConsumer`.

<!-- verify
s=$(kubectl get sc local-retain -o json 2>/dev/null) || { echo "StorageClass local-retain ne postoji"; exit 1; }
[ "$(echo "$s" | jq -r '.provisioner')" = "rancher.io/local-path" ] || { echo "provisioner nije rancher.io/local-path"; exit 1; }
[ "$(echo "$s" | jq -r '.reclaimPolicy')" = "Retain" ] || { echo "reclaimPolicy nije Retain"; exit 1; }
[ "$(echo "$s" | jq -r '.volumeBindingMode')" = "WaitForFirstConsumer" ] || { echo "volumeBindingMode nije WaitForFirstConsumer"; exit 1; }
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: local-retain}
provisioner: rancher.io/local-path
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
EOF
-->

## PVC čeka prvog korisnika

U namespaceu `baze` napravi PVC `pg-data` (`local-retain`, `1Gi`, `ReadWriteOnce`). Pogledaj status: PVC je `Pending`, sa eventom `WaitForFirstConsumer`.

Zatim napravi Pod `pg` (`postgres:17-alpine`, env `POSTGRES_PASSWORD=lab`, `PGDATA=/var/lib/postgresql/data/pgdata`) koji montira `pg-data` na `/var/lib/postgresql/data`. Tek tada provisioner pravi PV, na čvoru na kom je Pod raspoređen.

<!-- verify
[ "$(kubectl -n baze get pvc pg-data -o jsonpath='{.spec.storageClassName}' 2>/dev/null)" = "local-retain" ] || { echo "PVC pg-data sa klasom local-retain ne postoji"; exit 1; }
[ "$(kubectl -n baze get pvc pg-data -o jsonpath='{.status.phase}')" = "Bound" ] || { echo "PVC pg-data nije Bound (postoji li Pod pg?)"; exit 1; }
[ "$(kubectl -n baze get pod pg -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "Pod pg nije Running"; exit 1; }
pv=$(kubectl -n baze get pvc pg-data -o jsonpath='{.spec.volumeName}')
[ "$(kubectl get pv $pv -o jsonpath='{.spec.persistentVolumeReclaimPolicy}')" = "Retain" ] || { echo "dinamički PV nema Retain"; exit 1; }
-->
<!-- hint
`kubectl -n baze describe pvc pg-data` prije Poda pokazuje `waiting for first consumer to be created before binding`. To je očekivano ponašanje, ne greška.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: pg-data, namespace: baze}
spec:
  storageClassName: local-retain
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 1Gi}}
---
apiVersion: v1
kind: Pod
metadata: {name: pg, namespace: baze}
spec:
  containers:
  - name: pg
    image: postgres:17-alpine
    env:
    - {name: POSTGRES_PASSWORD, value: lab}
    - {name: PGDATA, value: /var/lib/postgresql/data/pgdata}
    volumeMounts: [{name: data, mountPath: /var/lib/postgresql/data}]
  volumes:
  - name: data
    persistentVolumeClaim: {claimName: pg-data}
EOF
kubectl -n baze wait --for=condition=Ready pod/pg --timeout=180s
-->

## Podrazumijevana klasa

Neka `local-retain` bude **podrazumijevana** StorageClass umjesto `local-path`. U klasteru smije biti tačno jedna podrazumijevana klasa.

Provjeri tako što napraviš PVC `bez-klase` u `baze` bez `storageClassName`. Mora dobiti `local-retain`.

<!-- verify
d=$(kubectl get sc -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")]}{.metadata.name}{" "}{end}')
[ "$d" = "local-retain " ] || { echo "podrazumijevana klasa treba biti samo local-retain (sada: ${d:-nijedna})"; exit 1; }
[ "$(kubectl -n baze get pvc bez-klase -o jsonpath='{.spec.storageClassName}' 2>/dev/null)" = "local-retain" ] || { echo "PVC bez-klase nije dobio local-retain"; exit 1; }
-->
<!-- hint
`kubectl patch sc local-path -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'`, pa isto sa `"true"` za `local-retain`.
-->
<!-- solution
kubectl patch sc local-path -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
kubectl patch sc local-retain -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: bez-klase, namespace: baze}
spec:
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 1Gi}}
EOF
-->
