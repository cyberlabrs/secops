# Lab 1: Isolating a three-tier application

The application has three tiers in three namespaces: `frontend` → `backend` → `db`. Right now everyone can talk to everyone. You will introduce **default deny** and then allow only the required flows.

A script, `/root/test-mreze.sh`, has been prepared; from each tier it tries to reach the others and prints a matrix (`od \ ka` means "from \ to", and `napadac` is the attacker Pod).

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

In all three namespaces (`frontend`, `backend`, `db`), create a NetworkPolicy named `default-deny` that:

- selects **all** Pods (`podSelector: {}`),
- blocks all **ingress and egress** traffic (`policyTypes: [Ingress, Egress]`, with no rules).

After this, `/root/test-mreze.sh` shows `--` everywhere. Even DNS does not work.

<!-- verify
for ns in frontend backend db; do
  p=$(kubectl -n $ns get netpol default-deny -o json 2>/dev/null) || { echo "NetworkPolicy default-deny does not exist in $ns"; exit 1; }
  [ "$(echo "$p" | jq -c '.spec.podSelector')" = "{}" ] || { echo "default-deny in $ns does not select all Pods"; exit 1; }
  [ "$(echo "$p" | jq -r '.spec.policyTypes | sort | join(",")')" = "Egress,Ingress" ] || { echo "default-deny in $ns does not have policyTypes Ingress and Egress"; exit 1; }
  [ "$(echo "$p" | jq '(.spec.ingress // []) + (.spec.egress // []) | length')" = "0" ] || { echo "default-deny in $ns must not have any rules"; exit 1; }
done
kubectl -n frontend exec frontend -- curl -s -m 2 -o /dev/null http://backend.backend.svc.cluster.local && { echo "frontend can still reach backend"; exit 1; }
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

## DNS for everyone

Every tier must be able to resolve names. In all three namespaces, create a NetworkPolicy named `allow-dns` that allows all Pods **egress** on port **53 (UDP and TCP)** to Pods labeled `k8s-app=kube-dns` in the `kube-system` namespace.

Use the namespace label `kubernetes.io/metadata.name: kube-system`. Every namespace has it automatically.

<!-- verify
for ns in frontend backend db; do kubectl -n $ns get netpol allow-dns >/dev/null 2>&1 || { echo "allow-dns does not exist in $ns"; exit 1; }; done
for ns in frontend backend db; do kubectl -n $ns exec $ns -- getent hosts kubernetes.default.svc.cluster.local >/dev/null 2>&1 || { echo "DNS does not work from $ns"; exit 1; }; done
p=$(kubectl -n db get netpol allow-dns -o json)
echo "$p" | jq -e '[.spec.egress[].to[]? | select(.namespaceSelector != null and .podSelector != null)] | length > 0' >/dev/null || { echo "allow-dns needs namespaceSelector AND podSelector in the same 'to' element (only kube-dns in kube-system)"; exit 1; }
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
Watch the dash: `namespaceSelector` and `podSelector` in the **same** element means AND. With a dash in front of `podSelector` they are two elements, so OR applies.
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

## Allowed flows

Allow only these flows, on port 80:

- `frontend` → `backend`
- `backend` → `db`

Each flow needs **two** policies: egress on the client side and ingress on the server side. You choose the policy names.

At the end, `/root/test-mreze.sh` must show:

```text
od \ ka   frontend  backend   db
frontend  --        OK        --
backend   --        --        OK
db        --        --        --
napadac   --        --        --
```

<!-- verify
t() { kubectl -n $1 exec $1 -- curl -s -m 2 -o /dev/null http://$2.$2.svc.cluster.local 2>/dev/null; }
t frontend backend || { echo "frontend → backend does not work"; exit 1; }
t backend db || { echo "backend → db does not work"; exit 1; }
t frontend db && { echo "frontend → db gets through, but it must not"; exit 1; }
t napadac backend && { echo "napadac → backend gets through"; exit 1; }
t napadac db && { echo "napadac → db gets through"; exit 1; }
t db backend && { echo "db → backend gets through"; exit 1; }
t backend frontend && { echo "backend → frontend gets through"; exit 1; }
exit 0
-->
<!-- hint
Example for backend (ingress from frontend):
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
`frontend` also needs egress to backend (same shape, with `to:`).
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
