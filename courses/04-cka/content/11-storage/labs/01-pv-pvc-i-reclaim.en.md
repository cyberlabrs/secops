# Lab 1: PersistentVolume, PVC and reclaim policy

A database in namespace `data` needs a persistent disk on `node01`. You will create a static **PersistentVolume** and a **PVC** that binds to exactly that PV, then delete the PVC and reuse the data from the `Released` volume. This is a common task ("PVC Data Migration").

```bash
kubectl get pv,pvc -A
kubectl get sc
ssh node01 ls -la /mnt/data
```

<!-- setup
set -e
cluster-up
kubectl create ns data >/dev/null
ssh node01 'mkdir -p /mnt/data && echo "vazni podaci iz 2025" > /mnt/data/arhiva.txt'
-->

## Static PV and PVC

Create:

1. PV `arhiva-pv` ("archive"): capacity `2Gi`, access mode `ReadWriteOnce`, `persistentVolumeReclaimPolicy: Retain`, `storageClassName: manual`, `hostPath` `/mnt/data`, with **node affinity** on `kubernetes.io/hostname=node01` (the data exists only on that node),
2. PVC `arhiva` in namespace `data`: `storageClassName: manual`, `1Gi`, `ReadWriteOnce`.

The PVC must be `Bound` to `arhiva-pv`.

```bash
kubectl explain pv.spec.nodeAffinity
kubectl get pv,pvc -A
```

<!-- verify
pv=$(kubectl get pv arhiva-pv -o json 2>/dev/null) || { echo "PV arhiva-pv does not exist"; exit 1; }
[ "$(echo "$pv" | jq -r '.spec.persistentVolumeReclaimPolicy')" = "Retain" ] || { echo "reclaim policy is not Retain"; exit 1; }
[ "$(echo "$pv" | jq -r '.spec.hostPath.path')" = "/mnt/data" ] || { echo "hostPath is not /mnt/data"; exit 1; }
echo "$pv" | jq -e '.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values | index("node01")' >/dev/null || { echo "PV has no nodeAffinity on node01"; exit 1; }
[ "$(kubectl -n data get pvc arhiva -o jsonpath='{.status.phase}/{.spec.volumeName}' 2>/dev/null)" = "Bound/arhiva-pv" ] || { echo "PVC arhiva is not Bound to arhiva-pv"; exit 1; }
-->
<!-- hint
A PVC gets a PV only if `storageClassName`, access mode and capacity match (PV ≥ request). If you omit `storageClassName` in the PVC, the default class `local-path` is used, so the PVC waits for a dynamic disk instead of your PV.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata: {name: arhiva-pv}
spec:
  capacity: {storage: 2Gi}
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath: {path: /mnt/data}
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - {key: kubernetes.io/hostname, operator: In, values: [node01]}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: arhiva, namespace: data}
spec:
  storageClassName: manual
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 1Gi}}
EOF
for i in $(seq 30); do [ "$(kubectl -n data get pvc arhiva -o jsonpath='{.status.phase}')" = "Bound" ] && break; sleep 1; done
-->

## A Pod uses the volume

Create Pod `citac` ("reader") in namespace `data` (`busybox:1.37`, command `sleep 36000`) that mounts PVC `arhiva` at `/arhiva`. The Pod must end up on `node01` on its own (because of the PV's node affinity, without `nodeName`) and see the file `arhiva.txt`.

<!-- verify
[ "$(kubectl -n data get pod citac -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "Pod citac is not Running"; exit 1; }
[ -z "$(kubectl -n data get pod citac -o jsonpath='{.spec.nodeName}' | grep -v node01)" ] || { echo "citac is not on node01"; exit 1; }
kubectl -n data exec citac -- cat /arhiva/arhiva.txt 2>/dev/null | grep -q 'vazni podaci' || { echo "citac cannot see /arhiva/arhiva.txt"; exit 1; }
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: citac, namespace: data}
spec:
  containers:
  - name: c
    image: busybox:1.37
    command: ["sleep", "36000"]
    volumeMounts: [{name: arhiva, mountPath: /arhiva}]
  volumes:
  - name: arhiva
    persistentVolumeClaim: {claimName: arhiva}
EOF
kubectl -n data wait --for=condition=Ready pod/citac --timeout=120s
-->

## A Released PV back in use

The team deleted Pod `citac` and PVC `arhiva` by mistake. Do the same:

```bash
kubectl -n data delete pod citac --now
kubectl -n data delete pvc arhiva
kubectl get pv arhiva-pv
```

The PV is now `Released`: the data is preserved (`Retain`), but a new PVC cannot get it while its `claimRef` still points to the old PVC.

Create a new PVC `arhiva-v2` in namespace `data` (same parameters) and make it possible for it to bind to exactly `arhiva-pv`. The file `arhiva.txt` must still exist on node01.

<!-- verify
kubectl -n data get pvc arhiva >/dev/null 2>&1 && { echo "the old PVC arhiva still exists"; exit 1; }
[ "$(kubectl -n data get pvc arhiva-v2 -o jsonpath='{.status.phase}/{.spec.volumeName}' 2>/dev/null)" = "Bound/arhiva-pv" ] || { echo "PVC arhiva-v2 is not Bound to arhiva-pv"; exit 1; }
ssh node01 cat /mnt/data/arhiva.txt 2>/dev/null | grep -q 'vazni podaci' || { echo "the data on node01 has been lost"; exit 1; }
-->
<!-- hint
Remove `claimRef` from the PV: `kubectl patch pv arhiva-pv --type=json -p='[{"op":"remove","path":"/spec/claimRef"}]'`. The PV moves to `Available`. You can also bind the new PVC explicitly with the field `spec.volumeName: arhiva-pv`.
-->
<!-- solution
kubectl -n data delete pod citac --now --ignore-not-found
kubectl -n data delete pvc arhiva --ignore-not-found --wait=true
kubectl patch pv arhiva-pv --type=json -p='[{"op":"remove","path":"/spec/claimRef"}]' 2>/dev/null || true
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: arhiva-v2, namespace: data}
spec:
  storageClassName: manual
  volumeName: arhiva-pv
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 1Gi}}
EOF
for i in $(seq 30); do [ "$(kubectl -n data get pvc arhiva-v2 -o jsonpath='{.status.phase}')" = "Bound" ] && break; sleep 1; done
-->
