# Lab 1: Servisi i endpointi

U namespaceu `store` rade tri aplikacije, ali nijedna nije dostupna preko svog Servisa. Pronađi i popravi uzrok za svaku, a zatim izloži jednu aplikaciju van klastera preko NodePorta.

Za testiranje koristi privremeni Pod:

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

## katalog: Servis nema endpointe

`kubectl -n store get endpointslices -l kubernetes.io/service-name=katalog` ne pokazuje nijednu adresu. Popravi **Servis** (ne Deployment) tako da šalje saobraćaj na obje replike `katalog`.

<!-- verify
n=$(kubectl -n store get endpointslices -l kubernetes.io/service-name=katalog -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{" "}{end}' | wc -w)
[ "$n" -eq 2 ] || { echo "Servis katalog ima $n endpointa, treba 2"; exit 1; }
[ "$(kubectl -n store get deploy katalog -o jsonpath='{.spec.template.metadata.labels.app}')" = "katalog" ] || { echo "ne mijenjaj oznake Deploymenta"; exit 1; }
-->
<!-- hint
Uporedi `kubectl -n store get svc katalog -o jsonpath='{.spec.selector}'` sa `kubectl -n store get pods --show-labels`. Ispravka: `kubectl -n store edit svc katalog`.
-->
<!-- solution
kubectl -n store patch svc katalog -p '{"spec":{"selector":{"app":"katalog"}}}'
sleep 3
-->

## korpa: connection refused

`korpa` ima endpoint, ali zahtjev ne prolazi. Popravi **Servis** tako da `http://korpa` vraća stranicu (httpd sluša na portu 80, a imenovani port kontejnera je `http`).

<!-- verify
ip=$(kubectl -n store get svc korpa -o jsonpath='{.spec.clusterIP}')
curl -s -m 3 "http://$ip/" | grep -qi 'it works' || { echo "http://korpa ne vraća stranicu"; exit 1; }
-->
<!-- hint
`targetPort` mora biti port na kom kontejner sluša: `80` ili ime porta `http`. Sa controlplane možeš testirati direktno ClusterIP: `curl $(kubectl -n store get svc korpa -o jsonpath='{.spec.clusterIP}')`.
-->
<!-- solution
kubectl -n store patch svc korpa --type=json -p='[{"op":"replace","path":"/spec/ports/0/targetPort","value":"http"}]'
sleep 2
-->

## placanje: Pod nije Ready

Pod `placanje` radi (`Running`), ali je `0/1 READY`, pa ga Servis ne koristi. Pronađi uzrok i popravi ga bez uklanjanja readiness probe. Ispravna health putanja za nginx u ovoj aplikaciji je `/` (`/health` ne postoji, pa nginx vraća 404).

<!-- verify
[ "$(kubectl -n store get deploy placanje -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}')" = "/" ] || { echo "readinessProbe path nije /"; exit 1; }
[ "$(kubectl -n store get deploy placanje -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "placanje nije Ready"; exit 1; }
ip=$(kubectl -n store get svc placanje -o jsonpath='{.spec.clusterIP}')
for i in 1 2 3 4 5; do curl -s -m 3 "http://$ip/" | grep -qi nginx && exit 0; sleep 2; done
echo "http://placanje ne odgovara"; exit 1
-->
<!-- hint
`kubectl -n store describe pod -l app=placanje` u Events pokazuje `Readiness probe failed: HTTP probe failed with statuscode: 404`.
-->
<!-- solution
kubectl -n store patch deploy placanje --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/"}]'
kubectl -n store rollout status deploy/placanje --timeout=120s
-->

## NodePort

Izloži Deployment `katalog` van klastera Servisom `katalog-public` tipa **NodePort**, sa fiksnim portom `30080` na čvorovima. Aplikacija mora odgovarati na `http://node01:30080`.

<!-- verify
[ "$(kubectl -n store get svc katalog-public -o jsonpath='{.spec.type}' 2>/dev/null)" = "NodePort" ] || { echo "Servis katalog-public tipa NodePort ne postoji"; exit 1; }
[ "$(kubectl -n store get svc katalog-public -o jsonpath='{.spec.ports[0].nodePort}')" = "30080" ] || { echo "nodePort nije 30080"; exit 1; }
curl -s -m 3 http://node01:30080/ | grep -qi nginx || { echo "http://node01:30080 ne odgovara"; exit 1; }
-->
<!-- hint
`kubectl expose` ne zna fiksni nodePort. Napravi YAML sa `--dry-run=client -o yaml`, pa dodaj `nodePort: 30080`:
`kubectl -n store expose deploy katalog --name=katalog-public --type=NodePort --port=80 --dry-run=client -o yaml > np.yaml`
-->
<!-- solution
kubectl -n store expose deploy katalog --name=katalog-public --type=NodePort --port=80 --dry-run=client -o yaml | sed 's/  - port: 80/  - port: 80\n    nodePort: 30080/' | kubectl apply -f -
sleep 2
-->
