# Lab 1: Taints, tolerations i affinity

`node01` je dobio GPU, pa ga treba rezervisati samo za ML workload. Ostale aplikacije moraju ostati na zasebnim čvorovima ili se rasporediti ravnomjerno.

U klasteru su samo dva čvora. Kontrolna ravan zato u ovom labu prima i obične Podove: taint `control-plane` je uklonjen.

```bash
kubectl get nodes --show-labels
kubectl describe node node01 | grep -i taint
```

<!-- setup
set -e
cluster-up
kubectl taint node controlplane node-role.kubernetes.io/control-plane:NoSchedule- >/dev/null
kubectl create ns ml >/dev/null
kubectl create deploy legacy --image=nginx:1.28 --replicas=2 >/dev/null
kubectl rollout status deploy/legacy --timeout=120s >/dev/null
-->

## Rezerviši node01

1. Dodaj čvoru `node01` oznaku `accelerator=gpu`.
2. Dodaj čvoru `node01` taint `dedicated=ml:NoExecute`.

`NoExecute` ne samo da sprečava nove Podove nego **izbacuje** postojeće koji nemaju toleraciju. Pogledaj gdje su sada Podovi deploymenta `legacy`.

```bash
kubectl label node node01 accelerator=gpu
kubectl taint node node01 dedicated=ml:NoExecute
kubectl get pods -o wide
```

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.metadata.labels.accelerator}')" = "gpu" ] || { echo "node01 nema oznaku accelerator=gpu"; exit 1; }
kubectl get node node01 -o jsonpath='{range .spec.taints[*]}{.key}={.value}:{.effect}{"\n"}{end}' | grep -qx 'dedicated=ml:NoExecute' || { echo "node01 nema taint dedicated=ml:NoExecute"; exit 1; }
n=$(kubectl get pods -l app=legacy -o jsonpath='{.items[*].spec.nodeName}')
echo "$n" | grep -q node01 && { echo "legacy Podovi još rade na node01"; exit 1; }
exit 0
-->
<!-- solution
kubectl label node node01 accelerator=gpu --overwrite
kubectl taint node node01 dedicated=ml:NoExecute --overwrite
for i in $(seq 60); do kubectl get pods -l app=legacy -o jsonpath='{.items[*].spec.nodeName}' | grep -q node01 || break; sleep 2; done
kubectl rollout status deploy/legacy --timeout=120s
-->

## ML Pod na GPU čvoru

U namespaceu `ml` napravi Pod `trening` (`busybox:1.37`, komanda `sleep 3600`) koji:

- **toleriše** taint `dedicated=ml:NoExecute`,
- ima **node affinity** (`requiredDuringSchedulingIgnoredDuringExecution`) na `accelerator=gpu`.

Toleracija sama samo **dozvoljava** raspoređivanje na `node01`. Tek affinity **garantuje** da Pod ide baš tamo.

<!-- verify
[ "$(kubectl -n ml get pod trening -o jsonpath='{.spec.nodeName}' 2>/dev/null)" = "node01" ] || { echo "Pod trening ne radi na node01"; exit 1; }
[ "$(kubectl -n ml get pod trening -o jsonpath='{.status.phase}')" = "Running" ] || { echo "Pod trening nije Running"; exit 1; }
kubectl -n ml get pod trening -o jsonpath='{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key}' | grep -qx accelerator || { echo "Pod nema required node affinity na accelerator"; exit 1; }
kubectl -n ml get pod trening -o jsonpath='{.spec.tolerations[*].key}' | grep -qw dedicated || { echo "Pod nema toleraciju za dedicated"; exit 1; }
-->
<!-- hint
```yaml
spec:
  tolerations:
  - {key: dedicated, operator: Equal, value: ml, effect: NoExecute}
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - {key: accelerator, operator: In, values: [gpu]}
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: trening
  namespace: ml
spec:
  tolerations:
  - {key: dedicated, operator: Equal, value: ml, effect: NoExecute}
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - {key: accelerator, operator: In, values: [gpu]}
  containers:
  - name: c
    image: busybox:1.37
    command: ["sleep", "3600"]
EOF
kubectl -n ml wait --for=condition=Ready pod/trening --timeout=120s
-->

## Pod anti-affinity: jedna replika po čvoru

Ukloni taint sa `node01`, ali zadrži oznaku. Zatim napravi Deployment `cache` (`redis:alpine`, 2 replike, oznaka `app=cache`) sa **pod anti-affinity** pravilom (`required…`, `topologyKey: kubernetes.io/hostname`), tako da dvije replike nikad ne budu na istom čvoru.

Zatim skaliraj `cache` na 3 replike. Treća mora ostati `Pending`, jer nema trećeg čvora. U `/root/pending-razlog.txt` upiši poruku iz eventa `FailedScheduling` za taj Pod, ili barem njen dio sa `anti-affinity`.

<!-- verify
kubectl get node node01 -o jsonpath='{.spec.taints[*].key}' | grep -qw dedicated && { echo "taint dedicated je još na node01"; exit 1; }
kubectl get deploy cache -o jsonpath='{.spec.template.spec.affinity.podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution[0].topologyKey}' 2>/dev/null | grep -qx kubernetes.io/hostname || { echo "cache nema required podAntiAffinity sa topologyKey kubernetes.io/hostname"; exit 1; }
[ "$(kubectl get deploy cache -o jsonpath='{.spec.replicas}')" = "3" ] || { echo "cache nije skaliran na 3"; exit 1; }
nodes=$(kubectl get pods -l app=cache --field-selector=status.phase=Running -o jsonpath='{.items[*].spec.nodeName}' | tr ' ' '\n' | sort | uniq -d)
[ -z "$nodes" ] || { echo "dvije replike rade na istom čvoru"; exit 1; }
[ "$(kubectl get pods -l app=cache --field-selector=status.phase=Pending -o name | wc -l)" = "1" ] || { echo "očekivan je tačno jedan Pending Pod"; exit 1; }
grep -qi 'anti-affinity' /root/pending-razlog.txt 2>/dev/null || { echo "pending-razlog.txt ne sadrži poruku o anti-affinity"; exit 1; }
-->
<!-- hint
`kubectl taint node node01 dedicated=ml:NoExecute-` (minus na kraju uklanja taint). Poruka: `kubectl describe pod <pending-pod> | grep -A3 Events` ili `kubectl get events --field-selector reason=FailedScheduling`.
-->
<!-- solution
kubectl taint node node01 dedicated=ml:NoExecute-
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache
spec:
  replicas: 2
  selector:
    matchLabels: {app: cache}
  template:
    metadata:
      labels: {app: cache}
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels: {app: cache}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: redis
        image: redis:alpine
EOF
kubectl rollout status deploy/cache --timeout=120s
kubectl scale deploy cache --replicas=3
sleep 5
p=$(kubectl get pods -l app=cache --field-selector=status.phase=Pending -o jsonpath='{.items[0].metadata.name}')
kubectl get events --field-selector involvedObject.name=$p,reason=FailedScheduling -o jsonpath='{.items[-1].message}' > /root/pending-razlog.txt
-->
