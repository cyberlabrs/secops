# Lab 2: Popravi pokvarene NetworkPolicy

U namespaceu `banka` je baza `postgres` koju smije koristiti samo `api` iz istog namespacea i `izvjestaji` iz namespacea `analitika`. Kolega je napisao politike, ali:

- `api` ne može do baze,
- Pod `napadac` iz namespacea `analitika` **može** do baze, iako ne bi smio.

Popravi postojeće politike (ne briši ih i ne pravi nove).

```bash
kubectl -n banka get netpol
kubectl -n banka describe netpol
kubectl get ns --show-labels
```

Test (port 5432, `nc -z` iz busybox Podova):

```bash
kubectl -n banka exec api -- nc -z -w 2 postgres.banka 5432 && echo OK
```

<!-- setup
set -e
cluster-up
kubectl create ns banka >/dev/null
kubectl create ns analitika >/dev/null
kubectl label ns analitika svrha=analitika >/dev/null
kubectl -n banka run postgres --image=postgres:17-alpine -l app=postgres --env=POSTGRES_PASSWORD=lab --port=5432 >/dev/null
kubectl -n banka expose pod postgres --port=5432 >/dev/null
kubectl -n banka run api --image=busybox:1.37 -l app=api,role=api -- sleep 36000 >/dev/null
kubectl -n analitika run izvjestaji --image=busybox:1.37 -l app=izvjestaji -- sleep 36000 >/dev/null
kubectl -n analitika run napadac --image=busybox:1.37 -l app=napadac -- sleep 36000 >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: postgres-ingress, namespace: banka}
spec:
  podSelector: {matchLabels: {app: postgres}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector: {matchLabels: {role: backend}}
    ports: [{port: 5432, protocol: TCP}]
  - from:
    - namespaceSelector: {matchLabels: {svrha: analitika}}
    - podSelector: {matchLabels: {app: izvjestaji}}
    ports: [{port: 5432, protocol: TCP}]
EOF
for p in postgres api; do kubectl -n banka wait --for=condition=Ready pod/$p --timeout=180s >/dev/null; done
for p in izvjestaji napadac; do kubectl -n analitika wait --for=condition=Ready pod/$p --timeout=120s >/dev/null; done
-->

## api ne može do baze

Prvo pravilo dozvoljava Podove sa oznakom `role: backend`, a Pod `api` ima drugačiju oznaku. Ispravi **politiku** (ne Pod) tako da `api` dođe do baze na 5432.

<!-- verify
kubectl -n banka exec api -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 || { echo "api ne može do postgres:5432"; exit 1; }
[ "$(kubectl -n banka get pod api -o jsonpath='{.metadata.labels.role}')" = "api" ] || { echo "ne mijenjaj oznake Poda api"; exit 1; }
-->
<!-- hint
`kubectl -n banka get pod api --show-labels`, pa u `kubectl -n banka edit netpol postgres-ingress` promijeni `role: backend` u `role: api`.
-->
<!-- solution
kubectl -n banka get netpol postgres-ingress -o json | jq '.spec.ingress[0].from[0].podSelector.matchLabels = {"role":"api"}' | kubectl apply -f -
sleep 3
-->

## napadac ne smije do baze

Pogledaj drugo pravilo. Zbog jedne crtice `from` lista ima **dva** elementa, a to znači ILI: „bilo koji Pod iz namespacea sa `svrha=analitika`“ ILI „Pod `app=izvjestaji` iz namespacea `banka`“. Ispravi pravilo tako da važi I: samo `izvjestaji` iz `analitika`.

<!-- verify
kubectl -n analitika exec napadac -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 && { echo "napadac i dalje dolazi do baze"; exit 1; }
kubectl -n analitika exec izvjestaji -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 || { echo "izvjestaji više ne dolazi do baze"; exit 1; }
kubectl -n banka exec api -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 || { echo "api više ne dolazi do baze"; exit 1; }
-->
<!-- hint
```yaml
  - from:
    - namespaceSelector: {matchLabels: {svrha: analitika}}
      podSelector: {matchLabels: {app: izvjestaji}}
```
Jedan element sa oba selektora znači I.
-->
<!-- solution
kubectl -n banka get netpol postgres-ingress -o json | jq '.spec.ingress[1].from = [{"namespaceSelector":{"matchLabels":{"svrha":"analitika"}},"podSelector":{"matchLabels":{"app":"izvjestaji"}}}]' | kubectl apply -f -
sleep 3
-->
