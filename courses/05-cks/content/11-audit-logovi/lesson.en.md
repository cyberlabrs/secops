## What this module covers

This module covers objective **6.5** from domain 6 (**Monitoring, Logging and Runtime Security**, 20% of the exam): **Use Kubernetes audit logs to monitor access**.

Typical exam tasks:

- "Enable auditing on the kube-apiserver. The policy is in `/etc/kubernetes/audit/policy.yaml`, the log goes to `/var/log/kubernetes/audit/audit.log`; keep at most 2 files of 10 MB, for 7 days."
- "Complete the audit Policy: log Secrets only at the Metadata level, changes to Deployments in the `prod` namespace at the RequestResponse level, everything else at Metadata."
- "Do not log `get`/`list`/`watch` requests on `events`."
- "In the audit log, find who deleted the Secret `db-pass` in the `prod` namespace and write the user to `/opt/kurs/odgovor.txt`."

The task almost always has two parts: a correct **Policy** file and a correct change to the **kube-apiserver** static Pod manifest. The second half is where time gets lost, because the API server doesn't start.

## What Kubernetes auditing is

Every request to the API server (from `kubectl`, the kubelet, controllers, a ServiceAccount in a Pod) can leave a record: who, when, from where, what was requested and with what result. This is the **audit log**, the primary source of truth in an investigation of "who read the Secret" or "who created this ClusterRoleBinding".

Auditing is done **only by the API server**. The kubelet, containerd and processes in containers have no audit in this sense (that is what Falco is for, module 12). A request that doesn't go through the API server (e.g. someone reading etcd directly) is not visible here.

Without the `--audit-policy-file` flag, nothing is logged.

### Stages

A single request can produce multiple events, one in each stage:

| Stage | When it is generated |
|---|---|
| `RequestReceived` | As soon as the audit handler receives the request, before processing |
| `ResponseStarted` | Response headers have been sent, but not the body; only for long-running requests (`watch`) |
| `ResponseComplete` | The response has completed |
| `Panic` | A panic occurred during processing |

In practice, `RequestReceived` is almost always omitted with **`omitStages`**: that event has no result (`responseStatus`) and duplicates the `ResponseComplete` record.

### Levels

| Level | What is logged | Typical use |
|---|---|---|
| `None` | Nothing | Noisy, unimportant requests (health, events, kube-proxy watch) |
| `Metadata` | Who, when, what, result; **without the body** of the request and response | Secrets, ConfigMaps, default level |
| `Request` | Metadata + the **request** body | Changes where you care what was sent |
| `RequestResponse` | Metadata + the request **and response** bodies | Critical changes (RBAC, Deployments in prod) |

`Request` and `RequestResponse` do not apply to non-resource requests (`/healthz`, `/version`): no body is recorded for them.

> **On the exam:** log Secrets and other sensitive data at `Metadata`. At the `Request` level, `kubectl create secret` writes the Secret's value into the audit log, and at `RequestResponse` every `get secret` writes its contents into the log. The audit log then becomes a new place for secrets to leak.

## The Policy file

A **Policy** (`audit.k8s.io/v1`) is a list of rules. Each event is compared against the rules **in order**, and the **first matching rule** determines the level. The remaining rules are not evaluated. A Policy must have at least one rule.

```yaml
# /etc/kubernetes/audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages:
- RequestReceived                 # global, for all rules
rules:
# 1. no noise: reading events
- level: None
  resources:
  - group: ""
    resources: ["events"]
  verbs: ["get", "list", "watch"]

# 2. Secrets: only who and what, never the content
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]

# 3. Deployment changes in prod: full record
- level: RequestResponse
  namespaces: ["prod"]
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: "apps"
    resources: ["deployments"]

# 4. RBAC changes anywhere
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]

# 5. everything else
- level: Metadata
```

### Rule fields

| Field | Meaning |
|---|---|
| `level` | Required: `None`, `Metadata`, `Request`, `RequestResponse` |
| `users` | Users (e.g. `system:kube-proxy`); empty = all |
| `userGroups` | Groups (e.g. `system:nodes`, `system:serviceaccounts:prod`) |
| `verbs` | `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection` |
| `resources` | List of `{group, resources, resourceNames}`; the core group is `""` |
| `namespaces` | Namespaces; the empty string `""` means cluster-scoped resources |
| `nonResourceURLs` | Paths such as `/healthz*`, `/version` |
| `omitStages` | Stages omitted for this rule (added to the global ones) |

Within a single rule, all specified fields must match (AND). A field that is not specified matches everything.

### Ordering: the most common trap

```yaml
rules:
- level: Metadata             # matches EVERYTHING
- level: RequestResponse      # never applied
  resources:
  - group: ""
    resources: ["pods"]
```

The first rule without filters "swallows" all events. The catch-all rule always goes **at the end**. The same applies to `None`: if `None` for all verbs on `secrets` comes before the rule for `secrets/delete`, deletions will not be logged.

An example with subresources: `pods` does not include `pods/log` or `pods/exec`. For those, write `resources: ["pods/exec"]` or `["pods/*"]`. This matters for investigations, because `kubectl exec` is a `create` request on `pods/exec`.

> **On the exam:** a task often gives a half-written Policy with "complete this" comments. Read the rules from top to bottom and for each required case ask yourself: which rule matches first? An example audit Policy can be found in the documentation: "Auditing" (kubernetes.io/docs/tasks/debug/debug-cluster/audit/).

## Enabling it in the kube-apiserver

On a kubeadm cluster, the kube-apiserver is a **static Pod** (`/etc/kubernetes/manifests/kube-apiserver.yaml`). You need five things:

| Flag | Meaning |
|---|---|
| `--audit-policy-file` | Path to the Policy file (inside the container) |
| `--audit-log-path` | Path of the log file; `-` means stdout; without the flag there is no log backend |
| `--audit-log-maxage` | Maximum number of days to keep old (rotated) files |
| `--audit-log-maxbackup` | Maximum number of rotated files to keep |
| `--audit-log-maxsize` | Size in **MB** after which the file is rotated |

```bash
# before every change, make a copy OUTSIDE the manifests directory
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
mkdir -p /etc/kubernetes/audit /var/log/kubernetes/audit
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit/audit.log
    - --audit-log-maxage=7
    - --audit-log-maxbackup=2
    - --audit-log-maxsize=10
    # ... existing flags
    volumeMounts:
    # ... existing mounts (k8s-certs, ca-certs, ...)
    - name: audit-policy
      mountPath: /etc/kubernetes/audit/policy.yaml
      readOnly: true
    - name: audit-log
      mountPath: /var/log/kubernetes/audit/
      readOnly: false
  volumes:
  # ... existing volumes
  - name: audit-policy
    hostPath:
      path: /etc/kubernetes/audit/policy.yaml
      type: File
  - name: audit-log
    hostPath:
      path: /var/log/kubernetes/audit/
      type: DirectoryOrCreate
```

The kubelet notices the manifest change and recreates the Pod. This takes 30 to 90 seconds.

```bash
watch crictl ps                    # wait for kube-apiserver to show up as Running
kubectl get nodes                  # the API responds again
tail -n 2 /var/log/kubernetes/audit/audit.log | jq .
```

> **On the exam:** mount the Policy file as `type: File` and `readOnly: true`, and the log **directory** as `DirectoryOrCreate` and writable. If you mount only the log file as `File` and it doesn't exist, the Pod won't start; if the log mount is `readOnly`, the API server can't write.

### Why the API server doesn't start: common mistakes

| Mistake | Symptom |
|---|---|
| Policy file not mounted, or the path in the flag differs from the `mountPath` | `crictl logs`: `no such file or directory` for the policy |
| `type: File` for a path that doesn't exist on the host | The Pod can't be created; the kubelet reports a mount error |
| YAML error in the Policy file or wrong `apiVersion`/`kind` | The API server exits with a policy parsing error |
| Policy without `rules` | Error: the policy must have at least one rule |
| Wrong indentation in the manifest (volume under `containers`) | The kubelet can't parse the manifest, the Pod doesn't appear |
| Duplicate volume name | Manifest invalid, the Pod is not created |
| A copy of the manifest left in `/etc/kubernetes/manifests/` | The kubelet tries to run both; conflict |

Where to look:

```bash
crictl ps -a | grep kube-apiserver               # does the container exist, is it crashing
crictl logs <container-id>                       # API server error
ls /var/log/pods/ | grep apiserver               # logs even when crictl doesn't see the container
tail /var/log/pods/kube-system_kube-apiserver-controlplane_*/kube-apiserver/*.log
journalctl -u kubelet --since "5 min ago" | grep -i apiserver   # mount and manifest parsing errors
```

> **On the exam:** if after a few minutes you can't find the error, restore the copy (`cp /root/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml`) and start again, changing one thing at a time. A broken API server also breaks every other task on that cluster.

## Reading audit logs

The log backend writes **JSON Lines**: one JSON object (`kind: Event`) per line. A shortened example:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "4f6c2b1e-...",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/prod/secrets/db-pass",
  "verb": "delete",
  "user": { "username": "jane", "groups": ["dev", "system:authenticated"] },
  "sourceIPs": ["192.168.10.25"],
  "userAgent": "kubectl/v1.35.0 (linux/amd64)",
  "objectRef": { "resource": "secrets", "namespace": "prod", "name": "db-pass", "apiVersion": "v1" },
  "responseStatus": { "code": 200 },
  "requestReceivedTimestamp": "2026-10-15T09:12:44.102311Z",
  "stageTimestamp": "2026-10-15T09:12:44.118902Z",
  "annotations": { "authorization.k8s.io/decision": "allow" }
}
```

| Field | What it tells you |
|---|---|
| `user.username` | Who: a user or `system:serviceaccount:<ns>:<name>` |
| `user.groups` | The groups of that identity |
| `verb` | What: `get`, `list`, `create`, `delete` … |
| `objectRef.resource/namespace/name` | On what |
| `objectRef.subresource` | E.g. `exec`, `log` for `pods/exec` |
| `responseStatus.code` | Result: 200/201 success, 403 forbidden, 404 not found |
| `sourceIPs` | From where |
| `userAgent` | With which tool |
| `annotations."authorization.k8s.io/decision"` | `allow` or `forbid` |

### jq recipes

```bash
LOG=/var/log/kubernetes/audit/audit.log

# who deleted the Secret db-pass in prod
jq -c 'select(.verb=="delete" and .objectRef.resource=="secrets"
              and .objectRef.namespace=="prod" and .objectRef.name=="db-pass")
       | {user: .user.username, ip: .sourceIPs, code: .responseStatus.code, t: .stageTimestamp}' $LOG

# who read Secrets (get and list), summarized per user
jq -r 'select(.objectRef.resource=="secrets" and (.verb=="get" or .verb=="list"))
       | .user.username' $LOG | sort | uniq -c | sort -rn

# all denied requests (403): who is trying what they're not allowed to
jq -c 'select(.responseStatus.code==403) | {u: .user.username, v: .verb, r: .objectRef.resource, ns: .objectRef.namespace}' $LOG

# kubectl exec into Pods
jq -c 'select(.objectRef.subresource=="exec") | {u: .user.username, pod: .objectRef.name, ns: .objectRef.namespace}' $LOG

# what a specific ServiceAccount did
jq -c 'select(.user.username=="system:serviceaccount:prod:backup")
       | [.verb, .objectRef.resource, .objectRef.name, .responseStatus.code]' $LOG
```

When you don't have `jq`, `grep` is enough for a quick search: `grep '"resource":"secrets"' $LOG | grep '"verb":"delete"'`. Note that there are no spaces around `:` in the file.

> **On the exam:** before searching, check whether you're looking in the right place at all. If the Policy logs Secrets at `None`, or `delete` isn't covered, there will be nothing in the log. Also check the rotated files (`audit-2026-10-15T09-00-00.000.log`) next to `audit.log`.

## Investigation: who deleted or read a Secret

Scenario: the Secret `db-pass` in `prod` has disappeared, and there is suspicion that someone read it beforehand.

1. Confirm that auditing is enabled and where the log is: `grep audit /etc/kubernetes/manifests/kube-apiserver.yaml`.
2. Find the deletion (recipe above). `responseStatus.code` 200 means it succeeded.
3. Find reads of the same Secret before the deletion: filter `verb=="get"` and `objectRef.name=="db-pass"`, then compare timestamps.
4. If `user.username` is a ServiceAccount, find which Pod uses it: `kubectl -n prod get pods -o custom-columns=POD:.metadata.name,SA:.spec.serviceAccountName`.
5. Check why it had permission: `kubectl auth can-i delete secrets -n prod --as=system:serviceaccount:prod:backup` and find the RoleBinding.
6. Remove the excess permissions (module 03) and rotate the compromised secret.

A `list` on Secrets returns all Secrets in the namespace, and in the audit event `objectRef.name` is empty. So when investigating "who read Secret X", always include both `list` and `watch`.

## The webhook backend in brief

Besides a file, the API server can send events to an external service (SIEM, Falco k8saudit plugin):

| Flag | Meaning |
|---|---|
| `--audit-webhook-config-file` | Kubeconfig with the service address and credentials |
| `--audit-webhook-mode` | `batch` (default), `blocking`, `blocking-strict` |
| `--audit-webhook-initial-backoff` | Wait before the first retry |

The same Policy applies to both backends. On the exam, the file backend is far more common.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `kubectl` doesn't respond after a change | `crictl ps -a`, `crictl logs`, `/var/log/pods/kube-system_kube-apiserver-*`, `journalctl -u kubelet` |
| API server runs, but the log file isn't created | Is `--audit-log-path` set; is the directory mounted and writable; does the path match the `mountPath` |
| The log exists, but the expected events are missing | Rule order (an earlier catch-all or `None`); subresources (`pods/exec`); resource group (`apps` for deployments) |
| The log is huge | No `omitStages: [RequestReceived]`; no `None` for events and health; too much `RequestResponse` |
| Secret values in the log | Secrets are at `Request`/`RequestResponse`; lower to `Metadata` and rotate the secrets |
| Rotation doesn't work | `--audit-log-maxsize` is in MB, `maxage` in days, `maxbackup` a number of files |

## Summary

- Auditing is done by the API server: stages `RequestReceived`, `ResponseStarted`, `ResponseComplete`, `Panic`; levels `None`, `Metadata`, `Request`, `RequestResponse`.
- The Policy (`audit.k8s.io/v1`) is read top-down: the first matching rule determines the level, so the catch-all goes at the end.
- `omitStages: [RequestReceived]` reduces noise; events at `None`; Secrets always at `Metadata`.
- Flags: `--audit-policy-file`, `--audit-log-path`, `--audit-log-maxage` (days), `--audit-log-maxbackup` (count), `--audit-log-maxsize` (MB).
- In the static Pod manifest: the policy as `File` and `readOnly`, the log directory as `DirectoryOrCreate` and writable; before changing it, make a copy outside `manifests`.
- When the API server doesn't start: `crictl ps -a`, `crictl logs`, `/var/log/pods`, `journalctl -u kubelet`.
- Investigation with `jq`: `user.username`, `verb`, `objectRef`, `responseStatus.code`, `sourceIPs`; for Secret reads look at `get`, `list` and `watch`.
