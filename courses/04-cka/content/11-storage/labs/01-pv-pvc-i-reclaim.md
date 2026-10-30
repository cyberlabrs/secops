# Lab 1: PersistentVolume, PVC i reclaim policy

Baza u namespaceu `data` treba trajan disk na `node01`. Napravićeš statički **PersistentVolume** i **PVC** koji se veže baš za njega, zatim obrisati PVC i ponovo iskoristiti podatke sa `Released` volumena. Ovo je čest zadatak („PVC Data Migration“).

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

## Statički PV i PVC

Napravi:

1. PV `arhiva-pv`: kapacitet `2Gi`, access mode `ReadWriteOnce`, `persistentVolumeReclaimPolicy: Retain`, `storageClassName: manual`, `hostPath` `/mnt/data`, uz **node affinity** na `kubernetes.io/hostname=node01` (podaci su samo na tom čvoru),
2. PVC `arhiva` u namespaceu `data`: `storageClassName: manual`, `1Gi`, `ReadWriteOnce`.

PVC mora biti `Bound` za `arhiva-pv`.

```bash
kubectl explain pv.spec.nodeAffinity
kubectl get pv,pvc -A
```

<!-- verify
pv=$(kubectl get pv arhiva-pv -o json 2>/dev/null) || { echo "PV arhiva-pv ne postoji"; exit 1; }
[ "$(echo "$pv" | jq -r '.spec.persistentVolumeReclaimPolicy')" = "Retain" ] || { echo "reclaim policy nije Retain"; exit 1; }
[ "$(echo "$pv" | jq -r '.spec.hostPath.path')" = "/mnt/data" ] || { echo "hostPath nije /mnt/data"; exit 1; }
echo "$pv" | jq -e '.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values | index("node01")' >/dev/null || { echo "PV nema nodeAffinity na node01"; exit 1; }
[ "$(kubectl -n data get pvc arhiva -o jsonpath='{.status.phase}/{.spec.volumeName}' 2>/dev/null)" = "Bound/arhiva-pv" ] || { echo "PVC arhiva nije Bound za arhiva-pv"; exit 1; }
-->
<!-- hint
PVC dobija PV samo ako se slažu `storageClassName`, access mode i kapacitet (PV ≥ zahtjev). Ako izostaviš `storageClassName` u PVC-u, uzima se podrazumijevana klasa `local-path`, pa PVC čeka dinamički disk umjesto tvog PV-a.
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

## Pod koristi volumen

Napravi Pod `citac` u namespaceu `data` (`busybox:1.37`, komanda `sleep 36000`) koji montira PVC `arhiva` na `/arhiva`. Pod mora završiti na `node01` sam od sebe (zbog node affinity PV-a, bez `nodeName`) i vidjeti fajl `arhiva.txt`.

<!-- verify
[ "$(kubectl -n data get pod citac -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "Pod citac nije Running"; exit 1; }
[ -z "$(kubectl -n data get pod citac -o jsonpath='{.spec.nodeName}' | grep -v node01)" ] || { echo "citac nije na node01"; exit 1; }
kubectl -n data exec citac -- cat /arhiva/arhiva.txt 2>/dev/null | grep -q 'vazni podaci' || { echo "citac ne vidi /arhiva/arhiva.txt"; exit 1; }
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

## Released PV ponovo u upotrebi

Tim je greškom obrisao Pod `citac` i PVC `arhiva`. Uradi to i ti:

```bash
kubectl -n data delete pod citac --now
kubectl -n data delete pvc arhiva
kubectl get pv arhiva-pv
```

PV je sada `Released`: podaci su sačuvani (`Retain`), ali novi PVC ga ne može dobiti dok u njemu stoji `claimRef` na stari PVC.

Napravi novi PVC `arhiva-v2` u namespaceu `data` (isti parametri) i omogući da se veže baš za `arhiva-pv`. Fajl `arhiva.txt` mora i dalje postojati na node01.

<!-- verify
kubectl -n data get pvc arhiva >/dev/null 2>&1 && { echo "stari PVC arhiva još postoji"; exit 1; }
[ "$(kubectl -n data get pvc arhiva-v2 -o jsonpath='{.status.phase}/{.spec.volumeName}' 2>/dev/null)" = "Bound/arhiva-pv" ] || { echo "PVC arhiva-v2 nije Bound za arhiva-pv"; exit 1; }
ssh node01 cat /mnt/data/arhiva.txt 2>/dev/null | grep -q 'vazni podaci' || { echo "podaci na node01 su izgubljeni"; exit 1; }
-->
<!-- hint
Ukloni `claimRef` sa PV-a: `kubectl patch pv arhiva-pv --type=json -p='[{"op":"remove","path":"/spec/claimRef"}]'`. PV prelazi u `Available`. Novi PVC možeš i eksplicitno vezati poljem `spec.volumeName: arhiva-pv`.
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
