# Lab 1: Pokvarene aplikacije

U namespaceu `prod` su četiri aplikacije i nijedna ne radi. Svaka ima drugačiji kvar i svaka pokazuje drugačiji status Poda. Za svaku pronađi uzrok i popravi ga, ali **ne mijenjaj image tamo gdje image nije problem**.

```bash
kubectl -n prod get pods
kubectl -n prod describe pod <ime>
kubectl -n prod logs <ime> --previous
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

Popravi Deployment `web` tako da radi sa ispravnim image-om `nginx:alpine`.

<!-- verify
[ "$(kubectl -n prod get deploy web -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "web nije spreman"; exit 1; }
[ "$(kubectl -n prod get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:alpine" ] || { echo "image nije nginx:alpine"; exit 1; }
-->
<!-- hint
`kubectl -n prod describe pod -l app=web` u Events pokazuje `failed to resolve reference "…nginx:alpinee": not found`. `kubectl -n prod set image deploy/web web=nginx:alpine`.
-->
<!-- solution
kubectl -n prod set image deploy/web web=nginx:alpine
kubectl -n prod rollout status deploy/web --timeout=120s
-->

## worker: CrashLoopBackOff

`worker` se stalno restartuje. Pročitaj log, pa mu dodaj ono što traži: varijablu okruženja `QUEUE_URL` sa vrijednošću `amqp://queue.prod:5672`.

U `/root/worker-exit.txt` upiši **exit kod** sa kojim je kontejner završavao (`Last State: Terminated`, `Exit Code`).

<!-- verify
grep -qx 3 <(tr -d ' ' < /root/worker-exit.txt 2>/dev/null) || { echo "worker-exit.txt ne sadrži ispravan exit kod"; exit 1; }
[ "$(kubectl -n prod get deploy worker -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "worker nije spreman"; exit 1; }
p=$(kubectl -n prod get pod -l app=worker --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
kubectl -n prod exec "$p" -- printenv QUEUE_URL 2>/dev/null | grep -qx 'amqp://queue.prod:5672' || { echo "QUEUE_URL nije postavljen"; exit 1; }
-->
<!-- hint
`kubectl -n prod logs deploy/worker --previous` i `kubectl -n prod describe pod -l app=worker | grep -A4 'Last State'`. Varijabla: `kubectl -n prod set env deploy/worker QUEUE_URL=amqp://queue.prod:5672`.
-->
<!-- solution
echo 3 > /root/worker-exit.txt
kubectl -n prod set env deploy/worker QUEUE_URL=amqp://queue.prod:5672
kubectl -n prod rollout status deploy/worker --timeout=120s
-->

## report: Pending

`report` je `Pending`. Pronađi razlog u eventima i popravi zahtjev za resurse. Pod treba `cpu: 50m`, ne 50 cijelih jezgara.

<!-- verify
[ "$(kubectl -n prod get deploy report -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')" = "50m" ] || { echo "requests.cpu nije 50m"; exit 1; }
[ "$(kubectl -n prod get deploy report -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "report nije spreman"; exit 1; }
-->
<!-- hint
Event `FailedScheduling: 0/2 nodes are available: 2 Insufficient cpu`. `kubectl -n prod set resources deploy/report --requests=cpu=50m,memory=64Mi`.
-->
<!-- solution
kubectl -n prod set resources deploy/report --requests=cpu=50m,memory=64Mi
kubectl -n prod rollout status deploy/report --timeout=120s
-->

## cache: OOMKilled

`cache` pri pokretanju puni 90 MiB podataka u memoriju, a limit je 64Mi. Kernel ga ubija (`OOMKilled`, exit kod 137).

Povećaj memorijski **limit** na `256Mi` i dodaj **request** `128Mi`. `cache` mora raditi bez restarta.

<!-- verify
c='{.spec.template.spec.containers[0].resources'
[ "$(kubectl -n prod get deploy cache -o jsonpath="$c.limits.memory}")" = "256Mi" ] || { echo "limits.memory nije 256Mi"; exit 1; }
[ "$(kubectl -n prod get deploy cache -o jsonpath="$c.requests.memory}")" = "128Mi" ] || { echo "requests.memory nije 128Mi"; exit 1; }
[ "$(kubectl -n prod get deploy cache -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "cache nije spreman"; exit 1; }
-->
<!-- hint
`kubectl -n prod describe pod -l app=cache` pokazuje `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`. `kubectl -n prod set resources deploy/cache --limits=memory=256Mi --requests=memory=128Mi`.
-->
<!-- solution
kubectl -n prod set resources deploy/cache --limits=memory=256Mi --requests=memory=128Mi
kubectl -n prod rollout status deploy/cache --timeout=120s
-->
