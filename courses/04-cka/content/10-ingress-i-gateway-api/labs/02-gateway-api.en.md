# Lab 2: Gateway API: Gateway, HTTPRoute and canary

You are moving from Ingress to the **Gateway API**. Traefik is installed with the Gateway provider enabled and provides the GatewayClass `traefik`. Two versions of the application run in the namespace `app`: `v1` and `v2`.

You will create your own Gateway, an HTTPRoute for the application and an 80/20 traffic split (canary), plus a header-based route for testers.

```bash
kubectl get gatewayclass
kubectl -n traefik get gateway
kubectl -n app get deploy,svc
```

In this chart Traefik listens for HTTP on **port 8000** inside the container. The Gateway listener must use that port, and from outside it is reached via NodePort **30080**.

<!-- setup
set -e
cluster-up
kubectl apply -f /opt/kurs/manifests/gateway-api-standard.yaml >/dev/null
helm install traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --create-namespace \
  --set providers.kubernetesGateway.enabled=true --set gateway.enabled=false \
  --set service.spec.type=NodePort --set ports.web.nodePort=30080 --set ports.websecure.nodePort=30443 \
  --wait --timeout 4m >/dev/null
kubectl create ns app >/dev/null
for v in v1 v2; do
  kubectl -n app create deploy $v --image=nginx:1.28 >/dev/null
  kubectl -n app create configmap $v-html --from-literal=index.html="verzija $v" >/dev/null
  kubectl -n app patch deploy $v --type=json -p="[{\"op\":\"add\",\"path\":\"/spec/template/spec/volumes\",\"value\":[{\"name\":\"html\",\"configMap\":{\"name\":\"$v-html\"}}]},{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/volumeMounts\",\"value\":[{\"name\":\"html\",\"mountPath\":\"/usr/share/nginx/html\"}]}]" >/dev/null
  kubectl -n app expose deploy $v --port=80 >/dev/null
done
kubectl -n app rollout status deploy/v1 --timeout=120s >/dev/null
kubectl -n app rollout status deploy/v2 --timeout=120s >/dev/null
-->

## Gateway

Create a Gateway `app-gw` in the namespace `app`:

- `gatewayClassName: traefik`,
- listener `http`, protocol `HTTP`, port `8000`,
- allows routes only from the same namespace (`allowedRoutes.namespaces.from: Same`).

The Gateway must have the condition `Programmed=True`.

<!-- verify
g=$(kubectl -n app get gateway app-gw -o json 2>/dev/null) || { echo "Gateway app-gw does not exist"; exit 1; }
[ "$(echo "$g" | jq -r '.spec.gatewayClassName')" = "traefik" ] || { echo "gatewayClassName is not traefik"; exit 1; }
[ "$(echo "$g" | jq -r '.spec.listeners[0].port')" = "8000" ] || { echo "listener port is not 8000"; exit 1; }
[ "$(echo "$g" | jq -r '.status.conditions[] | select(.type=="Programmed") | .status')" = "True" ] || { echo "Gateway is not Programmed"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: app-gw, namespace: app}
spec:
  gatewayClassName: traefik
  listeners:
  - name: http
    protocol: HTTP
    port: 8000
    allowedRoutes:
      namespaces: {from: Same}
```
If `Programmed` stays `False`, `kubectl -n app describe gateway app-gw` tells you why (e.g. a port Traefik does not listen on).
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: app-gw, namespace: app}
spec:
  gatewayClassName: traefik
  listeners:
  - name: http
    protocol: HTTP
    port: 8000
    allowedRoutes:
      namespaces: {from: Same}
EOF
kubectl -n app wait --for=condition=Programmed gateway/app-gw --timeout=60s
-->

## HTTPRoute

Create an HTTPRoute `app` that attaches to `app-gw`, for the host `app.kurs.local`, and sends all traffic to the Service `v1` (port 80).

```bash
curl -s -H 'Host: app.kurs.local' http://node01:30080/
kubectl -n app describe httproute app
```

<!-- verify
r=$(kubectl -n app get httproute app -o json 2>/dev/null) || { echo "HTTPRoute app does not exist"; exit 1; }
[ "$(echo "$r" | jq -r '.spec.parentRefs[0].name')" = "app-gw" ] || { echo "parentRefs does not point to app-gw"; exit 1; }
[ "$(echo "$r" | jq -r '.status.parents[0].conditions[] | select(.type=="Accepted") | .status')" = "True" ] || { echo "the route is not Accepted"; exit 1; }
[ "$(curl -s -m 3 -H 'Host: app.kurs.local' http://node01:30080/)" = "verzija v1" ] || { echo "app.kurs.local does not return 'verzija v1'"; exit 1; }
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: app, namespace: app}
spec:
  parentRefs: [{name: app-gw}]
  hostnames: [app.kurs.local]
  rules:
  - backendRefs: [{name: v1, port: 80}]
EOF
sleep 4
-->

## Canary 80/20 and a route for testers

Modify the HTTPRoute `app`:

1. requests with the header `X-Tester: da` always go to `v2`,
2. all other requests are split **80% to v1, 20% to v2** (`weight` on `backendRefs`).

```bash
for i in $(seq 50); do curl -s -H 'Host: app.kurs.local' http://node01:30080/; echo; done | sort | uniq -c
curl -s -H 'Host: app.kurs.local' -H 'X-Tester: da' http://node01:30080/
```

<!-- verify
for i in 1 2 3 4 5; do [ "$(curl -s -m 3 -H 'Host: app.kurs.local' -H 'X-Tester: da' http://node01:30080/)" = "verzija v2" ] || { echo "a request with X-Tester: da does not go to v2"; exit 1; }; done
w=$(kubectl -n app get httproute app -o json | jq -r '[.spec.rules[] | select((.matches // []) | map(.headers // []) | flatten | length == 0) | .backendRefs[] | "\(.name)=\(.weight)"] | sort | join(",")')
[ "$w" = "v1=80,v2=20" ] || { echo "the rule without a header needs backendRefs v1=80, v2=20 (got: $w)"; exit 1; }
n=$(for i in $(seq 60); do curl -s -m 2 -H 'Host: app.kurs.local' http://node01:30080/; echo; done | grep -c 'v2')
[ "$n" -ge 3 ] && [ "$n" -le 25 ] || { echo "$n of 60 requests went to v2, expected about 12"; exit 1; }
-->
<!-- hint
```yaml
  rules:
  - matches:
    - headers:
      - {name: X-Tester, value: da}
    backendRefs: [{name: v2, port: 80}]
  - backendRefs:
    - {name: v1, port: 80, weight: 80}
    - {name: v2, port: 80, weight: 20}
```
A rule with more specific `matches` takes precedence over a rule without conditions.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: app, namespace: app}
spec:
  parentRefs: [{name: app-gw}]
  hostnames: [app.kurs.local]
  rules:
  - matches:
    - headers:
      - {name: X-Tester, value: da}
    backendRefs: [{name: v2, port: 80}]
  - backendRefs:
    - {name: v1, port: 80, weight: 80}
    - {name: v2, port: 80, weight: 20}
EOF
sleep 4
-->
