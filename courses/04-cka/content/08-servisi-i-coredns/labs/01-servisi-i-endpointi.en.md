# Lab 1: Services and endpoints

Three applications run in namespace `store` (`katalog` = catalog, `korpa` = cart, `placanje` = payment), but none of them is reachable through its Service. Find and fix the cause for each one, then expose one application outside the cluster through a NodePort.

Use a temporary Pod for testing:

```bash
kubectl -n store get deploy,svc,endpointslices
kubectl run tmp -n store --image=busybox:1.37 --restart=Never -it --rm -- wget -qO- -T2 http://katalog
```

<!-- setup
set -e
cluster-up
kubectl create ns store >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata: {name: katalog, namespace: store}
spec:
  replicas: 2
  selector: {matchLabels: {app: katalog}}
  template:
    metadata: {labels: {app: katalog, tier: backend}}
    spec:
      containers: [{name: web, image: nginx:1.28, ports: [{containerPort: 80}]}]
---
apiVersion: v1
kind: Service
metadata: {name: katalog, namespace: store}
spec:
  selector: {app: catalog}
  ports: [{port: 80, targetPort: 80}]
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: korpa, namespace: store}
spec:
  replicas: 1
  selector: {matchLabels: {app: korpa}}
  template:
    metadata: {labels: {app: korpa}}
    spec:
      containers: [{name: web, image: httpd:alpine, ports: [{containerPort: 80, name: http}]}]
---
apiVersion: v1
kind: Service
metadata: {name: korpa, namespace: store}
spec:
  selector: {app: korpa}
  ports: [{port: 80, targetPort: 8080}]
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: placanje, namespace: store}
spec:
  replicas: 1
  selector: {matchLabels: {app: placanje}}
  template:
    metadata: {labels: {app: placanje}}
    spec:
      containers:
      - name: web
        image: nginx:1.28
        ports: [{containerPort: 80}]
        readinessProbe:
          httpGet: {path: /health, port: 80}
          periodSeconds: 3
---
apiVersion: v1
kind: Service
metadata: {name: placanje, namespace: store}
spec:
  selector: {app: placanje}
  ports: [{port: 80, targetPort: 80}]
EOF
kubectl -n store rollout status deploy/katalog --timeout=120s >/dev/null
kubectl -n store rollout status deploy/korpa --timeout=120s >/dev/null
-->

## katalog: the Service has no endpoints

`kubectl -n store get endpointslices -l kubernetes.io/service-name=katalog` shows no addresses. Fix the **Service** (not the Deployment) so it sends traffic to both `katalog` replicas.

<!-- verify
n=$(kubectl -n store get endpointslices -l kubernetes.io/service-name=katalog -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{" "}{end}' | wc -w)
[ "$n" -eq 2 ] || { echo "Service katalog has $n endpoints, it needs 2"; exit 1; }
[ "$(kubectl -n store get deploy katalog -o jsonpath='{.spec.template.metadata.labels.app}')" = "katalog" ] || { echo "do not change the Deployment labels"; exit 1; }
-->
<!-- hint
Compare `kubectl -n store get svc katalog -o jsonpath='{.spec.selector}'` with `kubectl -n store get pods --show-labels`. Fix: `kubectl -n store edit svc katalog`.
-->
<!-- solution
kubectl -n store patch svc katalog -p '{"spec":{"selector":{"app":"katalog"}}}'
sleep 3
-->

## korpa: connection refused

`korpa` has an endpoint, but the request does not get through. Fix the **Service** so that `http://korpa` returns a page (httpd listens on port 80, and the container's named port is `http`).

<!-- verify
ip=$(kubectl -n store get svc korpa -o jsonpath='{.spec.clusterIP}')
curl -s -m 3 "http://$ip/" | grep -qi 'it works' || { echo "http://korpa does not return a page"; exit 1; }
-->
<!-- hint
`targetPort` must be the port the container listens on: `80` or the port name `http`. From controlplane you can test the ClusterIP directly: `curl $(kubectl -n store get svc korpa -o jsonpath='{.spec.clusterIP}')`.
-->
<!-- solution
kubectl -n store patch svc korpa --type=json -p='[{"op":"replace","path":"/spec/ports/0/targetPort","value":"http"}]'
sleep 2
-->

## placanje: the Pod is not Ready

The `placanje` Pod is running (`Running`), but it is `0/1 READY`, so the Service does not use it. Find the cause and fix it without removing the readiness probe. The correct health path for nginx in this application is `/` (`/health` does not exist, so nginx returns 404).

<!-- verify
[ "$(kubectl -n store get deploy placanje -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}')" = "/" ] || { echo "the readinessProbe path is not /"; exit 1; }
[ "$(kubectl -n store get deploy placanje -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "placanje is not Ready"; exit 1; }
ip=$(kubectl -n store get svc placanje -o jsonpath='{.spec.clusterIP}')
for i in 1 2 3 4 5; do curl -s -m 3 "http://$ip/" | grep -qi nginx && exit 0; sleep 2; done
echo "http://placanje does not respond"; exit 1
-->
<!-- hint
`kubectl -n store describe pod -l app=placanje` shows `Readiness probe failed: HTTP probe failed with statuscode: 404` in Events.
-->
<!-- solution
kubectl -n store patch deploy placanje --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/"}]'
kubectl -n store rollout status deploy/placanje --timeout=120s
-->

## NodePort

Expose Deployment `katalog` outside the cluster with a Service `katalog-public` of type **NodePort**, with the fixed port `30080` on the nodes. The application must respond on `http://node01:30080`.

<!-- verify
[ "$(kubectl -n store get svc katalog-public -o jsonpath='{.spec.type}' 2>/dev/null)" = "NodePort" ] || { echo "Service katalog-public of type NodePort does not exist"; exit 1; }
[ "$(kubectl -n store get svc katalog-public -o jsonpath='{.spec.ports[0].nodePort}')" = "30080" ] || { echo "nodePort is not 30080"; exit 1; }
curl -s -m 3 http://node01:30080/ | grep -qi nginx || { echo "http://node01:30080 does not respond"; exit 1; }
-->
<!-- hint
`kubectl expose` cannot set a fixed nodePort. Create the YAML with `--dry-run=client -o yaml`, then add `nodePort: 30080`:
`kubectl -n store expose deploy katalog --name=katalog-public --type=NodePort --port=80 --dry-run=client -o yaml > np.yaml`
-->
<!-- solution
kubectl -n store expose deploy katalog --name=katalog-public --type=NodePort --port=80 --dry-run=client -o yaml | sed 's/  - port: 80/  - port: 80\n    nodePort: 30080/' | kubectl apply -f -
sleep 2
-->
