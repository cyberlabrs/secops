# Lab 1: Pod Security Admission

Namespace `payments` treba da zadovolji **restricted** Pod Security Standard. U njemu već radi Deployment `api`, koji ga ne zadovoljava. Uvešćeš PSA postepeno, kao u praksi: prvo `warn` i `audit`, pa ispravka workloada, pa `enforce`.

```bash
kubectl get ns payments --show-labels
kubectl -n payments get deploy api -o yaml | grep -A20 'containers:'
```

<!-- setup
set -e
cluster-up
kubectl create ns payments >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata: {name: api, namespace: payments}
spec:
  replicas: 2
  selector: {matchLabels: {app: api}}
  template:
    metadata: {labels: {app: api}}
    spec:
      containers:
      - name: api
        image: busybox:1.37
        command: ["sh", "-c", "while true; do echo obradjujem; sleep 10; done"]
        securityContext:
          privileged: true
EOF
kubectl -n payments rollout status deploy/api --timeout=120s >/dev/null
-->

## Upozorenja prije blokiranja

Na namespace `payments` dodaj oznake:

- `pod-security.kubernetes.io/warn=restricted`
- `pod-security.kubernetes.io/audit=restricted`

Bez `enforce`, tako da postojeći workload i dalje radi. Zatim pokreni `kubectl -n payments rollout restart deploy api` i pročitaj upozorenja: ona tačno nabrajaju šta restricted ne dozvoljava.

<!-- verify
l=$(kubectl get ns payments -o jsonpath='{.metadata.labels}')
echo "$l" | grep -q '"pod-security.kubernetes.io/warn":"restricted"' || { echo "nema warn=restricted"; exit 1; }
echo "$l" | grep -q '"pod-security.kubernetes.io/audit":"restricted"' || { echo "nema audit=restricted"; exit 1; }
echo "$l" | grep -q 'pod-security.kubernetes.io/enforce' && { echo "enforce još ne treba postaviti"; exit 1; }
exit 0
-->
<!-- solution
kubectl label ns payments pod-security.kubernetes.io/warn=restricted pod-security.kubernetes.io/audit=restricted
-->

## Ispravi Deployment

Izmijeni Deployment `api` tako da zadovolji restricted:

- bez `privileged`,
- `allowPrivilegeEscalation: false`,
- `capabilities: drop: ["ALL"]`,
- `runAsNonRoot: true` i `runAsUser: 1000`,
- `seccompProfile: RuntimeDefault`.

Provjeri bez rizika: `kubectl label --dry-run=server ns payments pod-security.kubernetes.io/enforce=restricted --overwrite` ispiše upozorenja za postojeće Podove koji ne bi prošli.

<!-- verify
w=$(kubectl label --dry-run=server ns payments pod-security.kubernetes.io/enforce=restricted --overwrite 2>&1)
echo "$w" | grep -qi 'violate' && { echo "postojeći Podovi i dalje krše restricted:"; echo "$w" | grep -i violate | head -3; exit 1; }
[ "$(kubectl -n payments get deploy api -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "api nema 2 spremne replike"; exit 1; }
-->
<!-- hint
```yaml
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile: {type: RuntimeDefault}
      containers:
      - name: api
        securityContext:
          allowPrivilegeEscalation: false
          capabilities: {drop: ["ALL"]}
```
Ukloni `privileged: true`. Poslije izmjene sačekaj da stari Podovi nestanu (`rollout status`).
-->
<!-- solution
kubectl -n payments patch deploy api --type=json -p='[
{"op":"replace","path":"/spec/template/spec/containers/0/securityContext","value":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}},
{"op":"add","path":"/spec/template/spec/securityContext","value":{"runAsNonRoot":true,"runAsUser":1000,"seccompProfile":{"type":"RuntimeDefault"}}}]'
kubectl -n payments rollout status deploy/api --timeout=180s
for i in $(seq 30); do [ "$(kubectl -n payments get pods -l app=api --no-headers | wc -l)" = "2" ] && break; sleep 2; done
-->

## Enforce

Dodaj `pod-security.kubernetes.io/enforce=restricted` (i `enforce-version=latest`). Zatim pokušaj napraviti privilegovani Pod `test-priv` u `payments`: API server ga mora odbiti.

```bash
kubectl -n payments run test-priv --image=busybox:1.37 --privileged -- sleep 1
```

<!-- verify
[ "$(kubectl get ns payments -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}')" = "restricted" ] || { echo "enforce nije restricted"; exit 1; }
out=$(kubectl -n payments run psa-provjera --image=busybox:1.37 --privileged --dry-run=server -- sleep 1 2>&1)
echo "$out" | grep -qi 'forbidden' || { echo "privilegovani Pod nije odbijen"; exit 1; }
[ "$(kubectl -n payments get deploy api -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "api više ne radi"; exit 1; }
-->
<!-- solution
kubectl label ns payments pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/enforce-version=latest --overwrite
-->
