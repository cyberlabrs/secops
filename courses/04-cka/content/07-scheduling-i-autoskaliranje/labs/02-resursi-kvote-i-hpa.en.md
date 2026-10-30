# Lab 2: Resources, quotas and HPA

Namespace `team-a` shares the cluster with other teams. You will set default resources and a quota, and then autoscale an application based on CPU load.

<!-- setup
set -e
cluster-up
kubectl create ns team-a >/dev/null
-->

## LimitRange and ResourceQuota

In namespace `team-a` create:

1. a **LimitRange** `default-resources` for containers: default request `cpu: 100m, memory: 64Mi`, default limit `cpu: 200m, memory: 128Mi`,
2. a **ResourceQuota** `team-a-quota`: at most `requests.cpu: "1"`, `limits.memory: 1Gi`, `pods: "6"` in total.

Then run a Pod `probni` ("test", `nginx:1.28`) **without** resources in the manifest and check which values it received.

```bash
kubectl -n team-a get pod probni -o jsonpath='{.spec.containers[0].resources}'
kubectl -n team-a describe quota
```

<!-- verify
kubectl -n team-a get limitrange default-resources >/dev/null 2>&1 || { echo "LimitRange default-resources does not exist"; exit 1; }
q=$(kubectl -n team-a get resourcequota team-a-quota -o json 2>/dev/null) || { echo "ResourceQuota team-a-quota does not exist"; exit 1; }
[ "$(echo "$q" | jq -r '.spec.hard."requests.cpu"')" = "1" ] && [ "$(echo "$q" | jq -r '.spec.hard."limits.memory"')" = "1Gi" ] && [ "$(echo "$q" | jq -r '.spec.hard.pods')" = "6" ] || { echo "the quota does not have requests.cpu=1, limits.memory=1Gi, pods=6"; exit 1; }
r=$(kubectl -n team-a get pod probni -o jsonpath='{.spec.containers[0].resources.requests.cpu}/{.spec.containers[0].resources.limits.memory}' 2>/dev/null)
[ "$r" = "100m/128Mi" ] || { echo "Pod probni does not have the default resources from the LimitRange (got: ${r:-no pod})"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: v1
kind: LimitRange
metadata: {name: default-resources, namespace: team-a}
spec:
  limits:
  - type: Container
    defaultRequest: {cpu: 100m, memory: 64Mi}
    default: {cpu: 200m, memory: 128Mi}
```
Quota: `kubectl -n team-a create quota team-a-quota --hard=requests.cpu=1,limits.memory=1Gi,pods=6`. A LimitRange affects only Pods created **after** it.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: LimitRange
metadata: {name: default-resources, namespace: team-a}
spec:
  limits:
  - type: Container
    defaultRequest: {cpu: 100m, memory: 64Mi}
    default: {cpu: 200m, memory: 128Mi}
EOF
kubectl -n team-a create quota team-a-quota --hard=requests.cpu=1,limits.memory=1Gi,pods=6
kubectl -n team-a run probni --image=nginx:1.28
-->

## The quota in action

Create a Deployment `veliki` ("big", `nginx:1.28`, 3 replicas) in which every container has `requests.cpu: 400m` and `limits.cpu: 400m` (without a limit, the 200m default limit from the LimitRange would be smaller than the request, and the Pod would be rejected for a different reason). The total exceeds the quota (`probni` already uses 100m), so the ReplicaSet will create only some of the Pods.

Write to `/root/kvota.txt` how many replicas of the `veliki` deployment are actually running and explain why in one line (e.g. `2 - exceeded quota requests.cpu`). The reason is in the ReplicaSet events.

<!-- verify
[ "$(kubectl -n team-a get deploy veliki -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' 2>/dev/null)" = "400m" ] || { echo "Deployment veliki with requests.cpu=400m does not exist"; exit 1; }
n=$(kubectl -n team-a get deploy veliki -o jsonpath='{.status.readyReplicas}')
head -c1 /root/kvota.txt 2>/dev/null | grep -qx "${n:-x}" || { echo "kvota.txt does not start with the actual number of replicas ($n)"; exit 1; }
grep -qi 'quota' /root/kvota.txt || { echo "kvota.txt does not mention quota"; exit 1; }
-->
<!-- hint
`kubectl -n team-a create deploy veliki --image=nginx:1.28 --replicas=3`, then `kubectl -n team-a set resources deploy veliki --requests=cpu=400m --limits=cpu=400m`. The reason: `kubectl -n team-a describe rs -l app=veliki | grep -i quota`.
-->
<!-- solution
kubectl -n team-a create deploy veliki --image=nginx:1.28 --replicas=3 --dry-run=client -o yaml | sed 's/resources: {}/resources: {requests: {cpu: 400m}, limits: {cpu: 400m}}/' | kubectl apply -f -
sleep 15
n=$(kubectl -n team-a get deploy veliki -o jsonpath='{.status.readyReplicas}')
echo "$n - exceeded quota requests.cpu" > /root/kvota.txt
-->

## HPA

Delete the `veliki` deployment. Then:

1. install **metrics-server** from `/opt/kurs/manifests/metrics-server.yaml`. In this lab the kubelets have self-signed certificates, so add the `--kubelet-insecure-tls` argument to metrics-server.
2. Create a Deployment `php` (`nginx:1.28`, `requests.cpu: 100m`) and an **HPA** `php` for it: min 1, max 4 replicas, target CPU utilization 50%.

```bash
kubectl apply -f /opt/kurs/manifests/metrics-server.yaml
kubectl -n kube-system edit deploy metrics-server
kubectl top nodes
kubectl -n team-a autoscale deploy php --min=1 --max=4 --cpu=50%
kubectl -n team-a get hpa
```

<!-- verify
kubectl -n team-a get deploy veliki >/dev/null 2>&1 && { echo "the veliki deployment still exists"; exit 1; }
kubectl top nodes >/dev/null 2>&1 || { echo "kubectl top nodes does not work (metrics-server?)"; exit 1; }
h=$(kubectl -n team-a get hpa php -o json 2>/dev/null) || { echo "HPA php does not exist"; exit 1; }
[ "$(echo "$h" | jq -r '.spec.minReplicas,.spec.maxReplicas' | tr '\n' ' ')" = "1 4 " ] || { echo "the HPA does not have min 1 / max 4"; exit 1; }
[ "$(echo "$h" | jq -r '.spec.metrics[0].resource.target.averageUtilization')" = "50" ] || { echo "the HPA target is not 50% CPU"; exit 1; }
echo "$h" | jq -e '.status.currentMetrics[0].resource.current.averageUtilization != null' >/dev/null || { echo "the HPA does not see the metric yet (wait ~1 min; TARGETS must not be <unknown>)"; exit 1; }
-->
<!-- hint
In the metrics-server Deployment add the line `- --kubelet-insecure-tls` to `args`. The HPA needs `requests.cpu` on the container: without it, percentage utilization has no baseline and `TARGETS` stays `<unknown>`. Note: since kubectl v1.35 the flag for the CPU target is `--cpu=50%` (previously `--cpu-percent`).
-->
<!-- solution
kubectl -n team-a delete deploy veliki
kubectl apply -f /opt/kurs/manifests/metrics-server.yaml >/dev/null
kubectl -n kube-system patch deploy metrics-server --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl -n kube-system rollout status deploy/metrics-server --timeout=180s
kubectl -n team-a create deploy php --image=nginx:1.28 --dry-run=client -o yaml | sed 's/resources: {}/resources: {requests: {cpu: 100m}}/' | kubectl apply -f -
kubectl -n team-a rollout status deploy/php --timeout=120s
kubectl -n team-a autoscale deploy php --min=1 --max=4 --cpu=50% 2>/dev/null || kubectl -n team-a autoscale deploy php --min=1 --max=4 --cpu-percent=50
for i in $(seq 60); do kubectl -n team-a get hpa php -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' | grep -q . && break; sleep 3; done
-->
