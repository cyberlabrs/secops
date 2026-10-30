# Lab 2: Izolacija namespaceova NetworkPolicyjem

U klasteru rade tri tima: `team-a`, `team-b` i `monitoring`. Bez NetworkPolicy svaki Pod može doći do svakog. Napadač koji kompromituje jednu aplikaciju odmah dolazi do svih ostalih (lateral movement).

Uvešćeš izolaciju u kojoj:

- Podovi u `team-a` primaju saobraćaj samo iz `team-a` i od Prometheusa iz `monitoring`,
- `team-b` ne može inicirati nijednu konekciju van svog namespacea, osim DNS-a.

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

## team-a prima samo svoje i Prometheus

U `team-a` napravi:

1. NetworkPolicy `default-deny-ingress`: bira sve Podove i blokira sav ulaz,
2. NetworkPolicy `allow-same-ns-and-prometheus`: dozvoljava ulaz od svih Podova iz `team-a` **i** od Podova `app=prometheus` iz namespacea `monitoring`.

`grafana` iz `monitoring` i Podovi iz `team-b` ne smiju doći do `api`.

```bash
kubectl -n team-a exec client -- wget -qO- -T2 http://api >/dev/null && echo OK
kubectl -n monitoring exec prometheus -- wget -qO- -T2 http://api.team-a >/dev/null && echo OK
kubectl -n monitoring exec grafana -- wget -qO- -T2 http://api.team-a >/dev/null && echo OK
```

<!-- verify
t() { kubectl -n $1 exec $2 -- wget -qO- -T2 http://api.team-a >/dev/null 2>&1; }
kubectl -n team-a get netpol default-deny-ingress >/dev/null 2>&1 || { echo "nema default-deny-ingress u team-a"; exit 1; }
t team-a client || { echo "client (team-a) ne dolazi do api"; exit 1; }
t monitoring prometheus || { echo "prometheus ne dolazi do api"; exit 1; }
t monitoring grafana && { echo "grafana dolazi do api, a ne smije"; exit 1; }
t team-b worker && { echo "team-b dolazi do api, a ne smije"; exit 1; }
exit 0
-->
<!-- hint
U drugoj politici `from` ima **dva** elementa (ILI): `podSelector: {}` (svi iz team-a) i jedan element sa `namespaceSelector` (`kubernetes.io/metadata.name: monitoring`) **i** `podSelector` (`app: prometheus`) zajedno (I).
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

## team-b bez izlaza van namespacea

U `team-b` napravi NetworkPolicy `egress-same-ns`, koja Podovima u `team-b` dozvoljava izlaz **samo**:

- prema Podovima u `team-b`,
- na DNS (UDP/TCP 53) prema `kube-dns` u `kube-system`.

`worker` mora doći do `web` (isti namespace), a ne smije do `api.team-a`, ni do API servera klastera (`kubernetes.default`).

<!-- verify
kubectl -n team-b get netpol egress-same-ns >/dev/null 2>&1 || { echo "nema egress-same-ns u team-b"; exit 1; }
kubectl -n team-b exec worker -- wget -qO- -T2 http://web >/dev/null 2>&1 || { echo "worker ne dolazi do web (DNS ili isti namespace?)"; exit 1; }
kubectl -n team-b exec worker -- wget -qO- -T2 http://api.team-a >/dev/null 2>&1 && { echo "worker dolazi do api.team-a"; exit 1; }
kubectl -n team-b exec worker -- nc -z -w 2 kubernetes.default 443 >/dev/null 2>&1 && { echo "worker dolazi do API servera"; exit 1; }
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
