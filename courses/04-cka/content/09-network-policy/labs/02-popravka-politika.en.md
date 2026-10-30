# Lab 2: Fix broken NetworkPolicies

The `banka` namespace contains a `postgres` database that may be used only by `api` from the same namespace and by `izvjestaji` (reports) from the `analitika` namespace. A colleague wrote the policies, but:

- `api` cannot reach the database,
- the `napadac` (attacker) Pod from the `analitika` namespace **can** reach the database, even though it should not.

Fix the existing policies (do not delete them and do not create new ones).

```bash
kubectl -n banka get netpol
kubectl -n banka describe netpol
kubectl get ns --show-labels
```

Test (port 5432, `nc -z` from busybox Pods):

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

## api cannot reach the database

The first rule allows Pods labeled `role: backend`, but the `api` Pod has a different label. Fix the **policy** (not the Pod) so that `api` can reach the database on 5432.

<!-- verify
kubectl -n banka exec api -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 || { echo "api cannot reach postgres:5432"; exit 1; }
[ "$(kubectl -n banka get pod api -o jsonpath='{.metadata.labels.role}')" = "api" ] || { echo "do not change the labels of the api Pod"; exit 1; }
-->
<!-- hint
`kubectl -n banka get pod api --show-labels`, then in `kubectl -n banka edit netpol postgres-ingress` change `role: backend` to `role: api`.
-->
<!-- solution
kubectl -n banka get netpol postgres-ingress -o json | jq '.spec.ingress[0].from[0].podSelector.matchLabels = {"role":"api"}' | kubectl apply -f -
sleep 3
-->

## napadac must not reach the database

Look at the second rule. Because of a single dash, the `from` list has **two** elements, which means OR: "any Pod from a namespace with `svrha=analitika`" OR "Pod `app=izvjestaji` from the `banka` namespace". Fix the rule so that AND applies: only `izvjestaji` from `analitika`.

<!-- verify
kubectl -n analitika exec napadac -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 && { echo "napadac can still reach the database"; exit 1; }
kubectl -n analitika exec izvjestaji -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 || { echo "izvjestaji can no longer reach the database"; exit 1; }
kubectl -n banka exec api -- nc -z -w 2 postgres.banka 5432 >/dev/null 2>&1 || { echo "api can no longer reach the database"; exit 1; }
-->
<!-- hint
```yaml
  - from:
    - namespaceSelector: {matchLabels: {svrha: analitika}}
      podSelector: {matchLabels: {app: izvjestaji}}
```
A single element with both selectors means AND.
-->
<!-- solution
kubectl -n banka get netpol postgres-ingress -o json | jq '.spec.ingress[1].from = [{"namespaceSelector":{"matchLabels":{"svrha":"analitika"}},"podSelector":{"matchLabels":{"app":"izvjestaji"}}}]' | kubectl apply -f -
sleep 3
-->
