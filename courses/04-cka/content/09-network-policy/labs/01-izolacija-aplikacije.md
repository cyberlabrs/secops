# Lab 1: Izolacija troslojne aplikacije

Aplikacija ima tri sloja u tri namespacea: `frontend` → `backend` → `db`. Trenutno svako može razgovarati sa svakim. Uvešćeš **default deny**, a zatim dozvoliti samo potrebne tokove.

Pripremljena je skripta `/root/test-mreze.sh`, koja iz svakog sloja pokuša doći do ostalih i ispiše matricu.

```bash
kubectl get pods -A -o wide -l 'tier in (frontend,backend,db,napadac)'
/root/test-mreze.sh
```

<!-- setup
set -e
cluster-up
for t in frontend backend db; do
  kubectl create ns $t >/dev/null
  kubectl -n $t run $t --image=nginx:1.28 -l tier=$t --port=80 >/dev/null
  kubectl -n $t expose pod $t --port=80 >/dev/null
done
kubectl create ns napadac >/dev/null
kubectl -n napadac run napadac --image=nginx:1.28 -l tier=napadac >/dev/null
for t in frontend backend db; do kubectl -n $t wait --for=condition=Ready pod/$t --timeout=120s >/dev/null; done
kubectl -n napadac wait --for=condition=Ready pod/napadac --timeout=120s >/dev/null
cat > /root/test-mreze.sh <<'EOF'
#!/bin/bash
# Iz svakog Poda pokuša HTTP prema ostalima (po DNS imenu Servisa). OK = prolazi, -- = blokirano.
printf '%-10s' 'od \ ka'; for d in frontend backend db; do printf '%-10s' $d; done; echo
for s in frontend backend db napadac; do
  printf '%-10s' $s
  for d in frontend backend db; do
    if kubectl -n $s exec $s -- curl -s -m 2 -o /dev/null http://$d.$d.svc.cluster.local 2>/dev/null; then printf '%-10s' OK; else printf '%-10s' --; fi
  done; echo
done
EOF
chmod +x /root/test-mreze.sh
-->

## Default deny

U sva tri namespacea (`frontend`, `backend`, `db`) napravi NetworkPolicy `default-deny` koja:

- bira **sve** Podove (`podSelector: {}`),
- blokira sav **ulazni i izlazni** saobraćaj (`policyTypes: [Ingress, Egress]`, bez pravila).

Poslije ovoga `/root/test-mreze.sh` prikazuje `--` svuda. Ne radi ni DNS.

<!-- verify
for ns in frontend backend db; do
  p=$(kubectl -n $ns get netpol default-deny -o json 2>/dev/null) || { echo "NetworkPolicy default-deny ne postoji u $ns"; exit 1; }
  [ "$(echo "$p" | jq -c '.spec.podSelector')" = "{}" ] || { echo "default-deny u $ns ne bira sve Podove"; exit 1; }
  [ "$(echo "$p" | jq -r '.spec.policyTypes | sort | join(",")')" = "Egress,Ingress" ] || { echo "default-deny u $ns nema policyTypes Ingress i Egress"; exit 1; }
  [ "$(echo "$p" | jq '(.spec.ingress // []) + (.spec.egress // []) | length')" = "0" ] || { echo "default-deny u $ns ne smije imati pravila"; exit 1; }
done
kubectl -n frontend exec frontend -- curl -s -m 2 -o /dev/null http://backend.backend.svc.cluster.local && { echo "frontend i dalje dolazi do backenda"; exit 1; }
exit 0
-->
<!-- solution
for ns in frontend backend db; do cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny, namespace: $ns}
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
EOF
done
sleep 3
-->

## DNS za sve

Svaki sloj mora moći razriješiti imena. U sva tri namespacea napravi NetworkPolicy `allow-dns` koja svim Podovima dozvoljava **egress** na port **53 (UDP i TCP)** prema Podovima `k8s-app=kube-dns` u namespaceu `kube-system`.

Koristi oznaku namespacea `kubernetes.io/metadata.name: kube-system`. Svaki namespace je automatski ima.

<!-- verify
for ns in frontend backend db; do kubectl -n $ns get netpol allow-dns >/dev/null 2>&1 || { echo "allow-dns ne postoji u $ns"; exit 1; }; done
for ns in frontend backend db; do kubectl -n $ns exec $ns -- getent hosts kubernetes.default.svc.cluster.local >/dev/null 2>&1 || { echo "DNS ne radi iz $ns"; exit 1; }; done
p=$(kubectl -n db get netpol allow-dns -o json)
echo "$p" | jq -e '[.spec.egress[].to[]? | select(.namespaceSelector != null and .podSelector != null)] | length > 0' >/dev/null || { echo "allow-dns treba namespaceSelector I podSelector u istom 'to' elementu (samo kube-dns u kube-system)"; exit 1; }
-->
<!-- hint
```yaml
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector:
        matchLabels: {kubernetes.io/metadata.name: kube-system}
      podSelector:
        matchLabels: {k8s-app: kube-dns}
    ports:
    - {port: 53, protocol: UDP}
    - {port: 53, protocol: TCP}
```
Pazi na crticu: `namespaceSelector` i `podSelector` u **istom** elementu znači I (AND). Sa crticom ispred `podSelector` to su dva elementa, pa važi ILI (OR).
-->
<!-- solution
for ns in frontend backend db; do cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-dns, namespace: $ns}
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector:
        matchLabels: {kubernetes.io/metadata.name: kube-system}
      podSelector:
        matchLabels: {k8s-app: kube-dns}
    ports:
    - {port: 53, protocol: UDP}
    - {port: 53, protocol: TCP}
EOF
done
sleep 3
-->

## Dozvoljeni tokovi

Dozvoli samo ove tokove, na portu 80:

- `frontend` → `backend`
- `backend` → `db`

Za svaki tok trebaju **dvije** politike: egress na strani klijenta i ingress na strani servera. Imena politika biraš sam.

Na kraju `/root/test-mreze.sh` mora pokazati:

```text
od \ ka   frontend  backend   db
frontend  --        OK        --
backend   --        --        OK
db        --        --        --
napadac   --        --        --
```

<!-- verify
t() { kubectl -n $1 exec $1 -- curl -s -m 2 -o /dev/null http://$2.$2.svc.cluster.local 2>/dev/null; }
t frontend backend || { echo "frontend → backend ne radi"; exit 1; }
t backend db || { echo "backend → db ne radi"; exit 1; }
t frontend db && { echo "frontend → db prolazi, a ne smije"; exit 1; }
t napadac backend && { echo "napadac → backend prolazi"; exit 1; }
t napadac db && { echo "napadac → db prolazi"; exit 1; }
t db backend && { echo "db → backend prolazi"; exit 1; }
t backend frontend && { echo "backend → frontend prolazi"; exit 1; }
exit 0
-->
<!-- hint
Primjer za backend (ingress od frontenda):
```yaml
metadata: {name: allow-from-frontend, namespace: backend}
spec:
  podSelector: {matchLabels: {tier: backend}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: frontend}}
      podSelector: {matchLabels: {tier: frontend}}
    ports: [{port: 80, protocol: TCP}]
```
I u `frontend` treba egress prema backendu (isti oblik, sa `to:`).
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: to-backend, namespace: frontend}
spec:
  podSelector: {matchLabels: {tier: frontend}}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: backend}}
      podSelector: {matchLabels: {tier: backend}}
    ports: [{port: 80, protocol: TCP}]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: from-frontend, namespace: backend}
spec:
  podSelector: {matchLabels: {tier: backend}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: frontend}}
      podSelector: {matchLabels: {tier: frontend}}
    ports: [{port: 80, protocol: TCP}]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: to-db, namespace: backend}
spec:
  podSelector: {matchLabels: {tier: backend}}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: db}}
      podSelector: {matchLabels: {tier: db}}
    ports: [{port: 80, protocol: TCP}]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: from-backend, namespace: db}
spec:
  podSelector: {matchLabels: {tier: db}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: backend}}
      podSelector: {matchLabels: {tier: backend}}
    ports: [{port: 80, protocol: TCP}]
EOF
sleep 3
-->
