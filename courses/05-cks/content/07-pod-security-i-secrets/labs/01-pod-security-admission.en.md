# Lab 1: Pod Security Admission

The namespace `payments` must meet the **restricted** Pod Security Standard. A Deployment `api` that doesn't meet it is already running there. You will introduce PSA gradually, as in practice: first `warn` and `audit`, then fix the workload, then `enforce`.

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

## Warnings before blocking

Add these labels to the `payments` namespace:

- `pod-security.kubernetes.io/warn=restricted`
- `pod-security.kubernetes.io/audit=restricted`

Without `enforce`, so the existing workload keeps running. Then run `kubectl -n payments rollout restart deploy api` and read the warnings: they list exactly what restricted doesn't allow.

<!-- verify
l=$(kubectl get ns payments -o jsonpath='{.metadata.labels}')
echo "$l" | grep -q '"pod-security.kubernetes.io/warn":"restricted"' || { echo "warn=restricted is missing"; exit 1; }
echo "$l" | grep -q '"pod-security.kubernetes.io/audit":"restricted"' || { echo "audit=restricted is missing"; exit 1; }
echo "$l" | grep -q 'pod-security.kubernetes.io/enforce' && { echo "enforce should not be set yet"; exit 1; }
exit 0
-->
<!-- solution
kubectl label ns payments pod-security.kubernetes.io/warn=restricted pod-security.kubernetes.io/audit=restricted
-->

## Fix the Deployment

Change the Deployment `api` so that it meets restricted:

- no `privileged`,
- `allowPrivilegeEscalation: false`,
- `capabilities: drop: ["ALL"]`,
- `runAsNonRoot: true` and `runAsUser: 1000`,
- `seccompProfile: RuntimeDefault`.

Check without risk: `kubectl label --dry-run=server ns payments pod-security.kubernetes.io/enforce=restricted --overwrite` prints warnings for existing Pods that wouldn't pass.

<!-- verify
w=$(kubectl label --dry-run=server ns payments pod-security.kubernetes.io/enforce=restricted --overwrite 2>&1)
echo "$w" | grep -qi 'violate' && { echo "existing Pods still violate restricted:"; echo "$w" | grep -i violate | head -3; exit 1; }
[ "$(kubectl -n payments get deploy api -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "api does not have 2 ready replicas"; exit 1; }
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
Remove `privileged: true`. After the change, wait for the old Pods to disappear (`rollout status`).
-->
<!-- solution
kubectl -n payments patch deploy api --type=json -p='[
{"op":"replace","path":"/spec/template/spec/containers/0/securityContext","value":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}},
{"op":"add","path":"/spec/template/spec/securityContext","value":{"runAsNonRoot":true,"runAsUser":1000,"seccompProfile":{"type":"RuntimeDefault"}}}]'
kubectl -n payments rollout status deploy/api --timeout=180s
for i in $(seq 30); do [ "$(kubectl -n payments get pods -l app=api --no-headers | wc -l)" = "2" ] && break; sleep 2; done
-->

## Enforce

Add `pod-security.kubernetes.io/enforce=restricted` (and `enforce-version=latest`). Then try to create a privileged Pod `test-priv` in `payments`: the API server must reject it.

```bash
kubectl -n payments run test-priv --image=busybox:1.37 --privileged -- sleep 1
```

<!-- verify
[ "$(kubectl get ns payments -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}')" = "restricted" ] || { echo "enforce is not restricted"; exit 1; }
out=$(kubectl -n payments run psa-provjera --image=busybox:1.37 --privileged --dry-run=server -- sleep 1 2>&1)
echo "$out" | grep -qi 'forbidden' || { echo "the privileged Pod was not rejected"; exit 1; }
[ "$(kubectl -n payments get deploy api -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "api no longer works"; exit 1; }
-->
<!-- solution
kubectl label ns payments pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/enforce-version=latest --overwrite
-->
