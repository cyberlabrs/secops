# Lab 2: StorageClass and dynamic provisioning

The cluster runs the **local-path provisioner** (`rancher.io/local-path`), which creates a PV automatically when a PVC appears. You will create your own StorageClass with different rules and change the default class.

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

## A StorageClass with Retain

Create StorageClass `local-retain`:

- `provisioner: rancher.io/local-path`,
- `reclaimPolicy: Retain` (the data remains even when the PVC is deleted),
- `volumeBindingMode: WaitForFirstConsumer`.

<!-- verify
s=$(kubectl get sc local-retain -o json 2>/dev/null) || { echo "StorageClass local-retain does not exist"; exit 1; }
[ "$(echo "$s" | jq -r '.provisioner')" = "rancher.io/local-path" ] || { echo "provisioner is not rancher.io/local-path"; exit 1; }
[ "$(echo "$s" | jq -r '.reclaimPolicy')" = "Retain" ] || { echo "reclaimPolicy is not Retain"; exit 1; }
[ "$(echo "$s" | jq -r '.volumeBindingMode')" = "WaitForFirstConsumer" ] || { echo "volumeBindingMode is not WaitForFirstConsumer"; exit 1; }
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

## The PVC waits for its first consumer

In namespace `baze` ("databases"), create PVC `pg-data` (`local-retain`, `1Gi`, `ReadWriteOnce`). Look at its status: the PVC is `Pending`, with the event `WaitForFirstConsumer`.

Then create Pod `pg` (`postgres:17-alpine`, env `POSTGRES_PASSWORD=lab`, `PGDATA=/var/lib/postgresql/data/pgdata`) that mounts `pg-data` at `/var/lib/postgresql/data`. Only then does the provisioner create the PV, on the node where the Pod is scheduled.

<!-- verify
[ "$(kubectl -n baze get pvc pg-data -o jsonpath='{.spec.storageClassName}' 2>/dev/null)" = "local-retain" ] || { echo "PVC pg-data with class local-retain does not exist"; exit 1; }
[ "$(kubectl -n baze get pvc pg-data -o jsonpath='{.status.phase}')" = "Bound" ] || { echo "PVC pg-data is not Bound (does Pod pg exist?)"; exit 1; }
[ "$(kubectl -n baze get pod pg -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "Pod pg is not Running"; exit 1; }
pv=$(kubectl -n baze get pvc pg-data -o jsonpath='{.spec.volumeName}')
[ "$(kubectl get pv $pv -o jsonpath='{.spec.persistentVolumeReclaimPolicy}')" = "Retain" ] || { echo "the dynamic PV does not have Retain"; exit 1; }
-->
<!-- hint
Before the Pod exists, `kubectl -n baze describe pvc pg-data` shows `waiting for first consumer to be created before binding`. This is expected behavior, not an error.
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

## The default class

Make `local-retain` the **default** StorageClass instead of `local-path`. There must be exactly one default class in the cluster.

Verify it by creating PVC `bez-klase` ("no class") in `baze` without `storageClassName`. It must get `local-retain`.

<!-- verify
d=$(kubectl get sc -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")]}{.metadata.name}{" "}{end}')
[ "$d" = "local-retain " ] || { echo "the default class should be only local-retain (currently: ${d:-none})"; exit 1; }
[ "$(kubectl -n baze get pvc bez-klase -o jsonpath='{.spec.storageClassName}' 2>/dev/null)" = "local-retain" ] || { echo "PVC bez-klase did not get local-retain"; exit 1; }
-->
<!-- hint
`kubectl patch sc local-path -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'`, then the same with `"true"` for `local-retain`.
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
