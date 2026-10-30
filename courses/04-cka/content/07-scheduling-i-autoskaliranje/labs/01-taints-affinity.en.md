# Lab 1: Taints, tolerations and affinity

`node01` got a GPU, so it must be reserved for ML workloads only. The other applications must stay on separate nodes or be spread evenly.

The cluster has only two nodes. That is why in this lab the control plane also accepts regular Pods: the `control-plane` taint has been removed.

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

## Reserve node01

1. Add the label `accelerator=gpu` to node `node01`.
2. Add the taint `dedicated=ml:NoExecute` to node `node01`.

`NoExecute` not only prevents new Pods but also **evicts** existing ones that have no toleration. Look at where the Pods of the `legacy` deployment are now.

```bash
kubectl label node node01 accelerator=gpu
kubectl taint node node01 dedicated=ml:NoExecute
kubectl get pods -o wide
```

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.metadata.labels.accelerator}')" = "gpu" ] || { echo "node01 does not have the label accelerator=gpu"; exit 1; }
kubectl get node node01 -o jsonpath='{range .spec.taints[*]}{.key}={.value}:{.effect}{"\n"}{end}' | grep -qx 'dedicated=ml:NoExecute' || { echo "node01 does not have the taint dedicated=ml:NoExecute"; exit 1; }
n=$(kubectl get pods -l app=legacy -o jsonpath='{.items[*].spec.nodeName}')
echo "$n" | grep -q node01 && { echo "legacy Pods are still running on node01"; exit 1; }
exit 0
-->
<!-- solution
kubectl label node node01 accelerator=gpu --overwrite
kubectl taint node node01 dedicated=ml:NoExecute --overwrite
for i in $(seq 60); do kubectl get pods -l app=legacy -o jsonpath='{.items[*].spec.nodeName}' | grep -q node01 || break; sleep 2; done
kubectl rollout status deploy/legacy --timeout=120s
-->

## An ML Pod on the GPU node

In namespace `ml` create a Pod `trening` (`busybox:1.37`, command `sleep 3600`) that:

- **tolerates** the taint `dedicated=ml:NoExecute`,
- has a **node affinity** (`requiredDuringSchedulingIgnoredDuringExecution`) on `accelerator=gpu`.

The toleration alone only **allows** scheduling on `node01`. Only the affinity **guarantees** that the Pod goes exactly there.

<!-- verify
[ "$(kubectl -n ml get pod trening -o jsonpath='{.spec.nodeName}' 2>/dev/null)" = "node01" ] || { echo "Pod trening is not running on node01"; exit 1; }
[ "$(kubectl -n ml get pod trening -o jsonpath='{.status.phase}')" = "Running" ] || { echo "Pod trening is not Running"; exit 1; }
kubectl -n ml get pod trening -o jsonpath='{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key}' | grep -qx accelerator || { echo "the Pod has no required node affinity on accelerator"; exit 1; }
kubectl -n ml get pod trening -o jsonpath='{.spec.tolerations[*].key}' | grep -qw dedicated || { echo "the Pod has no toleration for dedicated"; exit 1; }
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

## Pod anti-affinity: one replica per node

Remove the taint from `node01`, but keep the label. Then create a Deployment `cache` (`redis:alpine`, 2 replicas, label `app=cache`) with a **pod anti-affinity** rule (`required…`, `topologyKey: kubernetes.io/hostname`), so that two replicas are never on the same node.

Then scale `cache` to 3 replicas. The third must stay `Pending`, because there is no third node. Write the message from the `FailedScheduling` event for that Pod to `/root/pending-razlog.txt` ("pending reason"), or at least the part with `anti-affinity`.

<!-- verify
kubectl get node node01 -o jsonpath='{.spec.taints[*].key}' | grep -qw dedicated && { echo "the dedicated taint is still on node01"; exit 1; }
kubectl get deploy cache -o jsonpath='{.spec.template.spec.affinity.podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution[0].topologyKey}' 2>/dev/null | grep -qx kubernetes.io/hostname || { echo "cache has no required podAntiAffinity with topologyKey kubernetes.io/hostname"; exit 1; }
[ "$(kubectl get deploy cache -o jsonpath='{.spec.replicas}')" = "3" ] || { echo "cache was not scaled to 3"; exit 1; }
nodes=$(kubectl get pods -l app=cache --field-selector=status.phase=Running -o jsonpath='{.items[*].spec.nodeName}' | tr ' ' '\n' | sort | uniq -d)
[ -z "$nodes" ] || { echo "two replicas are running on the same node"; exit 1; }
[ "$(kubectl get pods -l app=cache --field-selector=status.phase=Pending -o name | wc -l)" = "1" ] || { echo "exactly one Pending Pod is expected"; exit 1; }
grep -qi 'anti-affinity' /root/pending-razlog.txt 2>/dev/null || { echo "pending-razlog.txt does not contain the anti-affinity message"; exit 1; }
-->
<!-- hint
`kubectl taint node node01 dedicated=ml:NoExecute-` (the minus at the end removes the taint). The message: `kubectl describe pod <pending-pod> | grep -A3 Events` or `kubectl get events --field-selector reason=FailedScheduling`.
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
