# Lab 1: Broken applications

There are four applications in namespace `prod` and none of them works. Each has a different fault and each shows a different Pod status. For each one, find the cause and fix it, but **do not change the image where the image is not the problem**.

```bash
kubectl -n prod get pods
kubectl -n prod describe pod <name>
kubectl -n prod logs <name> --previous
kubectl -n prod get events --sort-by=.lastTimestamp
```

<!-- setup
set -e
cluster-up
kubectl create ns prod >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata: {name: web, namespace: prod}
spec:
  replicas: 1
  selector: {matchLabels: {app: web}}
  template:
    metadata: {labels: {app: web}}
    spec:
      containers: [{name: web, image: nginx:alpinee}]
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: worker, namespace: prod}
spec:
  replicas: 1
  selector: {matchLabels: {app: worker}}
  template:
    metadata: {labels: {app: worker}}
    spec:
      containers:
      - name: worker
        image: busybox:1.37
        command: ["sh", "-c", "echo pokrecem worker; test -n \"$QUEUE_URL\" || { echo 'GRESKA: QUEUE_URL nije postavljen'; exit 3; }; while true; do sleep 5; done"]
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: report, namespace: prod}
spec:
  replicas: 1
  selector: {matchLabels: {app: report}}
  template:
    metadata: {labels: {app: report}}
    spec:
      containers:
      - name: report
        image: busybox:1.37
        command: ["sleep", "36000"]
        resources:
          requests: {cpu: "50", memory: 64Mi}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: cache, namespace: prod}
spec:
  replicas: 1
  selector: {matchLabels: {app: cache}}
  template:
    metadata: {labels: {app: cache}}
    spec:
      containers:
      - name: cache
        image: busybox:1.37
        command: ["sh", "-c", "echo puni kes; x=$(head -c 90m /dev/zero | tr '\\0' a); sleep 36000"]
        resources:
          limits: {memory: 64Mi}
EOF
sleep 10
-->

## web: ImagePullBackOff

Fix Deployment `web` so that it runs with the correct image `nginx:alpine`.

<!-- verify
[ "$(kubectl -n prod get deploy web -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "web is not ready"; exit 1; }
[ "$(kubectl -n prod get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:alpine" ] || { echo "the image is not nginx:alpine"; exit 1; }
-->
<!-- hint
`kubectl -n prod describe pod -l app=web` shows `failed to resolve reference "…nginx:alpinee": not found` in Events. `kubectl -n prod set image deploy/web web=nginx:alpine`.
-->
<!-- solution
kubectl -n prod set image deploy/web web=nginx:alpine
kubectl -n prod rollout status deploy/web --timeout=120s
-->

## worker: CrashLoopBackOff

`worker` keeps restarting. Read the log, then give it what it asks for: the environment variable `QUEUE_URL` with the value `amqp://queue.prod:5672`.

Write the **exit code** the container was terminating with (`Last State: Terminated`, `Exit Code`) to `/root/worker-exit.txt`.

<!-- verify
grep -qx 3 <(tr -d ' ' < /root/worker-exit.txt 2>/dev/null) || { echo "worker-exit.txt does not contain the correct exit code"; exit 1; }
[ "$(kubectl -n prod get deploy worker -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "worker is not ready"; exit 1; }
p=$(kubectl -n prod get pod -l app=worker --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
kubectl -n prod exec "$p" -- printenv QUEUE_URL 2>/dev/null | grep -qx 'amqp://queue.prod:5672' || { echo "QUEUE_URL is not set"; exit 1; }
-->
<!-- hint
`kubectl -n prod logs deploy/worker --previous` and `kubectl -n prod describe pod -l app=worker | grep -A4 'Last State'`. The variable: `kubectl -n prod set env deploy/worker QUEUE_URL=amqp://queue.prod:5672`.
-->
<!-- solution
echo 3 > /root/worker-exit.txt
kubectl -n prod set env deploy/worker QUEUE_URL=amqp://queue.prod:5672
kubectl -n prod rollout status deploy/worker --timeout=120s
-->

## report: Pending

`report` is `Pending`. Find the reason in the events and fix the resource request. The Pod needs `cpu: 50m`, not 50 whole cores.

<!-- verify
[ "$(kubectl -n prod get deploy report -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')" = "50m" ] || { echo "requests.cpu is not 50m"; exit 1; }
[ "$(kubectl -n prod get deploy report -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "report is not ready"; exit 1; }
-->
<!-- hint
Event `FailedScheduling: 0/2 nodes are available: 2 Insufficient cpu`. `kubectl -n prod set resources deploy/report --requests=cpu=50m,memory=64Mi`.
-->
<!-- solution
kubectl -n prod set resources deploy/report --requests=cpu=50m,memory=64Mi
kubectl -n prod rollout status deploy/report --timeout=120s
-->

## cache: OOMKilled

On startup, `cache` loads 90 MiB of data into memory, but the limit is 64Mi. The kernel kills it (`OOMKilled`, exit code 137).

Raise the memory **limit** to `256Mi` and add a **request** of `128Mi`. `cache` must run without restarts.

<!-- verify
c='{.spec.template.spec.containers[0].resources'
[ "$(kubectl -n prod get deploy cache -o jsonpath="$c.limits.memory}")" = "256Mi" ] || { echo "limits.memory is not 256Mi"; exit 1; }
[ "$(kubectl -n prod get deploy cache -o jsonpath="$c.requests.memory}")" = "128Mi" ] || { echo "requests.memory is not 128Mi"; exit 1; }
[ "$(kubectl -n prod get deploy cache -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "cache is not ready"; exit 1; }
-->
<!-- hint
`kubectl -n prod describe pod -l app=cache` shows `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`. `kubectl -n prod set resources deploy/cache --limits=memory=256Mi --requests=memory=128Mi`.
-->
<!-- solution
kubectl -n prod set resources deploy/cache --limits=memory=256Mi --requests=memory=128Mi
kubectl -n prod rollout status deploy/cache --timeout=120s
-->
