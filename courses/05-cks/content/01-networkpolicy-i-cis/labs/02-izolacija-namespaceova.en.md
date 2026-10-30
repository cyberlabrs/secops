# Lab 2: Namespace isolation with NetworkPolicy

Three teams work in the cluster: `team-a`, `team-b` and `monitoring`. Without NetworkPolicy every Pod can reach every other Pod. An attacker who compromises one application immediately reaches all the others (lateral movement).

You will introduce isolation in which:

- Pods in `team-a` accept traffic only from `team-a` and from Prometheus in `monitoring`,
- `team-b` cannot initiate any connection outside its namespace, except DNS.

```bash
kubectl get pods -A -l app -o wide | grep -v kube-system
```

<!-- setup
set -e
cluster-up
for ns in team-a team-b monitoring; do kubectl create ns $ns >/dev/null; done
kubectl -n team-a run api --image=nginx:1.28 -l app=api --port=80 >/dev/null
kubectl -n team-a expose pod api --port=80 >/dev/null
kubectl -n team-a run client --image=busybox:1.37 -l app=client -- sleep 36000 >/dev/null
kubectl -n team-b run web --image=nginx:1.28 -l app=web --port=80 >/dev/null
kubectl -n team-b expose pod web --port=80 >/dev/null
kubectl -n team-b run worker --image=busybox:1.37 -l app=worker -- sleep 36000 >/dev/null
kubectl -n monitoring run prometheus --image=busybox:1.37 -l app=prometheus -- sleep 36000 >/dev/null
kubectl -n monitoring run grafana --image=busybox:1.37 -l app=grafana -- sleep 36000 >/dev/null
for ns in team-a team-b monitoring; do kubectl -n $ns wait --for=condition=Ready pod --all --timeout=120s >/dev/null; done
-->

## team-a accepts only its own Pods and Prometheus

In `team-a` create:

1. NetworkPolicy `default-deny-ingress`: selects all Pods and blocks all ingress,
2. NetworkPolicy `allow-same-ns-and-prometheus`: allows ingress from all Pods in `team-a` **and** from Pods `app=prometheus` in the `monitoring` namespace.

`grafana` from `monitoring` and Pods from `team-b` must not reach `api`.

```bash
kubectl -n team-a exec client -- wget -qO- -T2 http://api >/dev/null && echo OK
kubectl -n monitoring exec prometheus -- wget -qO- -T2 http://api.team-a >/dev/null && echo OK
kubectl -n monitoring exec grafana -- wget -qO- -T2 http://api.team-a >/dev/null && echo OK
```

<!-- verify
t() { kubectl -n $1 exec $2 -- wget -qO- -T2 http://api.team-a >/dev/null 2>&1; }
kubectl -n team-a get netpol default-deny-ingress >/dev/null 2>&1 || { echo "default-deny-ingress is missing in team-a"; exit 1; }
t team-a client || { echo "client (team-a) cannot reach api"; exit 1; }
t monitoring prometheus || { echo "prometheus cannot reach api"; exit 1; }
t monitoring grafana && { echo "grafana reaches api, but it must not"; exit 1; }
t team-b worker && { echo "team-b reaches api, but it must not"; exit 1; }
exit 0
-->
<!-- hint
In the second policy, `from` has **two** elements (OR): `podSelector: {}` (everyone in team-a) and one element with `namespaceSelector` (`kubernetes.io/metadata.name: monitoring`) **and** `podSelector` (`app: prometheus`) together (AND).
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-ingress, namespace: team-a}
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-same-ns-and-prometheus, namespace: team-a}
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector: {}
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: monitoring}}
      podSelector: {matchLabels: {app: prometheus}}
EOF
sleep 3
-->

## team-b with no egress outside the namespace

In `team-b` create NetworkPolicy `egress-same-ns`, which allows Pods in `team-b` egress **only**:

- to Pods in `team-b`,
- to DNS (UDP/TCP 53) at `kube-dns` in `kube-system`.

`worker` must reach `web` (same namespace), and must not reach `api.team-a` or the cluster's API server (`kubernetes.default`).

<!-- verify
kubectl -n team-b get netpol egress-same-ns >/dev/null 2>&1 || { echo "egress-same-ns is missing in team-b"; exit 1; }
kubectl -n team-b exec worker -- wget -qO- -T2 http://web >/dev/null 2>&1 || { echo "worker cannot reach web (DNS or same namespace?)"; exit 1; }
kubectl -n team-b exec worker -- wget -qO- -T2 http://api.team-a >/dev/null 2>&1 && { echo "worker reaches api.team-a"; exit 1; }
kubectl -n team-b exec worker -- nc -z -w 2 kubernetes.default 443 >/dev/null 2>&1 && { echo "worker reaches the API server"; exit 1; }
exit 0
-->
<!-- hint
```yaml
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - podSelector: {}
  - to:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}
      podSelector: {matchLabels: {k8s-app: kube-dns}}
    ports:
    - {port: 53, protocol: UDP}
    - {port: 53, protocol: TCP}
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: egress-same-ns, namespace: team-b}
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - podSelector: {}
  - to:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}
      podSelector: {matchLabels: {k8s-app: kube-dns}}
    ports:
    - {port: 53, protocol: UDP}
    - {port: 53, protocol: TCP}
EOF
sleep 3
-->
