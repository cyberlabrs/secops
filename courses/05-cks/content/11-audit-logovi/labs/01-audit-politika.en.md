# Lab 1: API server audit logs

Someone in the cluster is reading Secrets in the `finance` namespace, and nobody knows who. Audit logs are not enabled. You will enable them with a policy that records what matters without filling up the disk, and then investigate the event.

<!-- setup
set -e
cluster-up
kubectl create ns finance >/dev/null
kubectl -n finance create secret generic bank-api --from-literal=token=bk-77aa >/dev/null
kubectl -n finance create sa payroll-bot >/dev/null
kubectl -n finance create role secret-reader --verb=get,list --resource=secrets >/dev/null
kubectl -n finance create rolebinding payroll-bot --role=secret-reader --serviceaccount=finance:payroll-bot >/dev/null
mkdir -p /etc/kubernetes/audit
cat > /root/simulacija.sh <<'EOF'
#!/bin/bash
# simulira aktivnost u klasteru: aplikacija čita tajnu, admin mijenja deployment
T=$(kubectl -n finance create token payroll-bot)
kubectl --kubeconfig=/dev/null --token="$T" --server=https://controlplane:6443 --certificate-authority=/etc/kubernetes/pki/ca.crt -n finance get secret bank-api -o name
kubectl -n finance create deploy ledger --image=nginx:1.28 >/dev/null 2>&1 || true
kubectl -n finance scale deploy ledger --replicas=2
touch /root/.simulacija-pokrenuta
EOF
chmod +x /root/simulacija.sh
-->

## Audit policy

Create `/etc/kubernetes/audit/policy.yaml` (`audit.k8s.io/v1`, kind `Policy`) with these rules, in this order:

1. don't record the `RequestReceived` stage (`omitStages`, at the level of the whole policy),
2. `Secrets` in the **whole cluster**: level `Metadata` (never `Request`/`RequestResponse`, because the secret's value would be written to the log),
3. `get`, `list` and `watch` on `events` and `endpoints`: level `None`,
4. all changes (`create`, `update`, `patch`, `delete`) to `deployments` in the `finance` namespace: level `RequestResponse`,
5. everything else: level `Metadata`.

Order matters: for each request, the **first** matching rule applies.

<!-- verify
f=/etc/kubernetes/audit/policy.yaml
[ -s $f ] || { echo "$f does not exist"; exit 1; }
grep -q 'kind: Policy' $f && grep -q 'audit.k8s.io/v1' $f || { echo "the file is not an audit.k8s.io/v1 Policy"; exit 1; }
grep -q 'RequestReceived' $f || { echo "omitStages: RequestReceived is missing"; exit 1; }
grep -q 'RequestResponse' $f || { echo "there is no rule with level RequestResponse"; exit 1; }
first_secret=$(awk '/secrets/ {print NR; exit}' $f); first_rr=$(awk '/level: RequestResponse/ {print NR; exit}' $f)
[ -n "$first_secret" ] && [ "$first_secret" -lt "$first_rr" ] || { echo "the secrets rule must come before the RequestResponse rule"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events", "endpoints"]
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  namespaces: ["finance"]
  resources:
  - group: "apps"
    resources: ["deployments"]
- level: Metadata
```
-->
<!-- solution
cat > /etc/kubernetes/audit/policy.yaml <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events", "endpoints"]
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  namespaces: ["finance"]
  resources:
  - group: "apps"
    resources: ["deployments"]
- level: Metadata
EOF
-->

## Enable auditing in the kube-apiserver

In `/etc/kubernetes/manifests/kube-apiserver.yaml` add:

- `--audit-policy-file=/etc/kubernetes/audit/policy.yaml`
- `--audit-log-path=/var/log/kubernetes/audit/audit.log`
- `--audit-log-maxage=7`, `--audit-log-maxbackup=2`, `--audit-log-maxsize=50`
- volumes (hostPath) and volumeMounts for the policy (`/etc/kubernetes/audit/policy.yaml`, readOnly) and the log directory (`/var/log/kubernetes/audit/`).

The most common mistake: the flag is added but the volume isn't, so the API server doesn't see the file and doesn't start.

<!-- verify
m=/etc/kubernetes/manifests/kube-apiserver.yaml
for fl in audit-policy-file=/etc/kubernetes/audit/policy.yaml audit-log-path=/var/log/kubernetes/audit/audit.log audit-log-maxage=7 audit-log-maxbackup=2 audit-log-maxsize=50; do grep -q -- "--$fl" $m || { echo "missing --$fl"; exit 1; }; done
kubectl get nodes >/dev/null 2>&1 || { echo "the API server is not responding"; exit 1; }
[ -s /var/log/kubernetes/audit/audit.log ] || { echo "audit.log is not being written"; exit 1; }
-->
<!-- hint
```yaml
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit/audit.log
    - --audit-log-maxage=7
    - --audit-log-maxbackup=2
    - --audit-log-maxsize=50
...
    volumeMounts:
    - {name: audit-policy, mountPath: /etc/kubernetes/audit/policy.yaml, readOnly: true}
    - {name: audit-logs, mountPath: /var/log/kubernetes/audit/}
...
  volumes:
  - {name: audit-policy, hostPath: {path: /etc/kubernetes/audit/policy.yaml, type: File}}
  - {name: audit-logs, hostPath: {path: /var/log/kubernetes/audit/, type: DirectoryOrCreate}}
```
-->
<!-- solution
m=/etc/kubernetes/manifests/kube-apiserver.yaml
sed -i 's#^\(\s*\)- kube-apiserver$#\1- kube-apiserver\n\1- --audit-policy-file=/etc/kubernetes/audit/policy.yaml\n\1- --audit-log-path=/var/log/kubernetes/audit/audit.log\n\1- --audit-log-maxage=7\n\1- --audit-log-maxbackup=2\n\1- --audit-log-maxsize=50#' $m
sed -i 's#^\(\s*\)volumeMounts:$#\1volumeMounts:\n\1- {name: audit-policy, mountPath: /etc/kubernetes/audit/policy.yaml, readOnly: true}\n\1- {name: audit-logs, mountPath: /var/log/kubernetes/audit/}#' $m
sed -i 's#^  volumes:$#  volumes:\n  - {name: audit-policy, hostPath: {path: /etc/kubernetes/audit/policy.yaml, type: File}}\n  - {name: audit-logs, hostPath: {path: /var/log/kubernetes/audit/, type: DirectoryOrCreate}}#' $m
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
sleep 5
-->

## Investigation

Run the "suspicious activity" simulation:

```bash
/root/simulacija.sh
```

Then use the audit log to find out:

1. which **user** (full name, e.g. `system:serviceaccount:…`) read the Secret `bank-api` in `finance`, and write it to `/root/ko-je-citao.txt`,
2. whether the secret's value (`bk-77aa`) appears anywhere in the audit log. It must not, and that is why the rule for Secrets uses `Metadata`.

```bash
jq -c 'select(.objectRef.resource=="secrets" and .objectRef.name=="bank-api") | {user: .user.username, verb, level, ts: .stageTimestamp}' /var/log/kubernetes/audit/audit.log
```

<!-- verify
[ -f /root/.simulacija-pokrenuta ] || { echo "run /root/simulacija.sh first"; exit 1; }
grep -qx 'system:serviceaccount:finance:payroll-bot' <(tr -d ' ' < /root/ko-je-citao.txt 2>/dev/null) || { echo "ko-je-citao.txt is not correct"; exit 1; }
grep -q 'bk-77aa\|YmstNzdhYQ' /var/log/kubernetes/audit/audit.log && { echo "the secret value is in the audit log"; exit 1; }
exit 0
-->
<!-- hint
Filter: `.objectRef.resource=="secrets"` and `.verb=="get"`. Requests from kubectl itself as admin have the user `kubernetes-admin`. Look for a different user.
-->
<!-- solution
[ -f /root/.simulacija-pokrenuta ] || /root/simulacija.sh >/dev/null
sleep 3
jq -r 'select(.objectRef.resource=="secrets" and .objectRef.name=="bank-api" and .verb=="get") | .user.username' /var/log/kubernetes/audit/audit.log | grep serviceaccount | sort -u | head -1 > /root/ko-je-citao.txt
-->
