# Lab 2: Gateway API: Gateway, HTTPRoute i canary

Prelaziš sa Ingressa na **Gateway API**. Traefik je instaliran sa uključenim Gateway providerom i daje GatewayClass `traefik`. U namespaceu `app` rade dvije verzije aplikacije: `v1` i `v2`.

Napravićeš vlastiti Gateway, HTTPRoute za aplikaciju i podjelu saobraćaja 80/20 (canary), te rutu po zaglavlju za testere.

```bash
kubectl get gatewayclass
kubectl -n traefik get gateway
kubectl -n app get deploy,svc
```

Traefik u ovom chartu sluša HTTP na **portu 8000** u kontejneru. Listener Gatewaya mora koristiti taj port, a spolja se do njega dolazi preko NodePorta **30080**.

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

Napravi Gateway `app-gw` u namespaceu `app`:

- `gatewayClassName: traefik`,
- listener `http`, protokol `HTTP`, port `8000`,
- dozvoljava rute samo iz istog namespacea (`allowedRoutes.namespaces.from: Same`).

Gateway mora imati uslov `Programmed=True`.

<!-- verify
g=$(kubectl -n app get gateway app-gw -o json 2>/dev/null) || { echo "Gateway app-gw ne postoji"; exit 1; }
[ "$(echo "$g" | jq -r '.spec.gatewayClassName')" = "traefik" ] || { echo "gatewayClassName nije traefik"; exit 1; }
[ "$(echo "$g" | jq -r '.spec.listeners[0].port')" = "8000" ] || { echo "listener port nije 8000"; exit 1; }
[ "$(echo "$g" | jq -r '.status.conditions[] | select(.type=="Programmed") | .status')" = "True" ] || { echo "Gateway nije Programmed"; exit 1; }
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
Ako `Programmed` ostane `False`, `kubectl -n app describe gateway app-gw` kaže zašto (npr. port koji Traefik ne sluša).
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

Napravi HTTPRoute `app` koji kači na `app-gw`, za host `app.kurs.local`, i sav saobraćaj šalje na Servis `v1` (port 80).

```bash
curl -s -H 'Host: app.kurs.local' http://node01:30080/
kubectl -n app describe httproute app
```

<!-- verify
r=$(kubectl -n app get httproute app -o json 2>/dev/null) || { echo "HTTPRoute app ne postoji"; exit 1; }
[ "$(echo "$r" | jq -r '.spec.parentRefs[0].name')" = "app-gw" ] || { echo "parentRefs ne pokazuje na app-gw"; exit 1; }
[ "$(echo "$r" | jq -r '.status.parents[0].conditions[] | select(.type=="Accepted") | .status')" = "True" ] || { echo "ruta nije Accepted"; exit 1; }
[ "$(curl -s -m 3 -H 'Host: app.kurs.local' http://node01:30080/)" = "verzija v1" ] || { echo "app.kurs.local ne vraća 'verzija v1'"; exit 1; }
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

## Canary 80/20 i ruta za testere

Izmijeni HTTPRoute `app`:

1. zahtjevi sa zaglavljem `X-Tester: da` uvijek idu na `v2`,
2. ostali zahtjevi se dijele **80% na v1, 20% na v2** (`weight` na `backendRefs`).

```bash
for i in $(seq 50); do curl -s -H 'Host: app.kurs.local' http://node01:30080/; echo; done | sort | uniq -c
curl -s -H 'Host: app.kurs.local' -H 'X-Tester: da' http://node01:30080/
```

<!-- verify
for i in 1 2 3 4 5; do [ "$(curl -s -m 3 -H 'Host: app.kurs.local' -H 'X-Tester: da' http://node01:30080/)" = "verzija v2" ] || { echo "zahtjev sa X-Tester: da ne ide na v2"; exit 1; }; done
w=$(kubectl -n app get httproute app -o json | jq -r '[.spec.rules[] | select((.matches // []) | map(.headers // []) | flatten | length == 0) | .backendRefs[] | "\(.name)=\(.weight)"] | sort | join(",")')
[ "$w" = "v1=80,v2=20" ] || { echo "pravilo bez zaglavlja treba backendRefs v1=80, v2=20 (dobijeno: $w)"; exit 1; }
n=$(for i in $(seq 60); do curl -s -m 2 -H 'Host: app.kurs.local' http://node01:30080/; echo; done | grep -c 'v2')
[ "$n" -ge 3 ] && [ "$n" -le 25 ] || { echo "od 60 zahtjeva $n je išlo na v2, očekivano oko 12"; exit 1; }
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
Pravilo sa preciznijim `matches` ima prednost nad pravilom bez uslova.
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
