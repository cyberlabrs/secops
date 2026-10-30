## What this module covers

The module covers two objectives from domain 2 (**Cluster Hardening**, 15% of the exam):

- **2.1** RBAC to minimize exposure,
- **2.2** exercising caution with ServiceAccounts.

Typical exam tasks:

- "The ServiceAccount `reporter` in the `finance` namespace has too many permissions. Leave it only `get` and `list` on `pods`."
- "Find all ClusterRoleBindings that grant `cluster-admin` to a ServiceAccount and remove the one that isn't needed."
- "Create a new ServiceAccount `backend-sa` without automatic token mounting and configure the Deployment `backend` to use it."
- "The Pod `web` doesn't need API access. Prevent the token from being mounted, without changing the ServiceAccount."
- "Make the `default` ServiceAccount in the `prod` namespace not mount a token."

You know the mechanics of RBAC (Role, ClusterRole, bindings, `kubectl create role`) from the CKA. Here the focus is on which permissions are dangerous, how to find them, and how to turn a ServiceAccount token from a permanent key into a short-lived, narrow credential.

## RBAC from an attacker's angle

An attacker who takes over a pod usually first reads the ServiceAccount token and asks the API server what it is allowed to do:

```bash
# from a compromised pod
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -sk -H "Authorization: Bearer $TOKEN" https://kubernetes.default.svc/api/v1/namespaces/finance/secrets
# or, if kubectl is available
kubectl auth can-i --list
```

Every permission beyond what is needed is a springboard. The **least privilege** principle in practice:

- `Role` + `RoleBinding` instead of `ClusterRole` + `ClusterRoleBinding` whenever one namespace is enough,
- precisely listed `resources` and `verbs`, no `*`,
- `resourceNames` when the application needs only one object (e.g. one ConfigMap),
- a separate ServiceAccount per application,
- no permissions for the `default` ServiceAccount.

### Dangerous verbs and resources

Some permissions look harmless but actually lead to full control over a namespace or the cluster:

| Permission | Why it is dangerous |
|---|---|
| `*` on `resources` or `verbs` | also includes resources added in the future (CRDs), all subresources and all verbs |
| `get`, `list`, `watch` on `secrets` | `list` and `watch` return the **contents** of all Secrets, not just the names; `kubectl get secrets -o yaml` is enough |
| `create` on `pods` (or Deployment, Job, DaemonSet, CronJob…) | a pod can use any ServiceAccount in the namespace and mount any Secret and ConfigMap; with a privileged pod and `hostPath` the attacker escapes to the node |
| `create` on `pods/exec` (and `pods/attach`) | a shell in someone else's container, with its token and data |
| `get`/`create` on `nodes/proxy` | access to the kubelet API of all pods on the node, including exec; bypasses the API server's admission and audit. `get` is not "read only" |
| `escalate` on `roles`/`clusterroles` | allows creating and modifying roles with permissions the user doesn't have |
| `bind` on `roles`/`clusterroles` | allows binding a role the user doesn't have (e.g. `cluster-admin`) to themselves |
| `impersonate` on `users`, `groups`, `serviceaccounts` | `kubectl --as=...` on behalf of someone else, e.g. `--as-group=system:masters` |
| `create` on `serviceaccounts/token` | issuing tokens for any ServiceAccount in the namespace |
| `create` on CSRs + `update` on `certificatesigningrequests/approval` | issuing a client certificate with an arbitrary name and group |
| modifying `validatingwebhookconfigurations`/`mutatingwebhookconfigurations` | the webhook sees (and changes) every object passing through the API |
| `patch` on `namespaces` | changing labels used by Pod Security Admission and NetworkPolicy |
| `create` on `persistentvolumes` | a `hostPath` PV gives access to the node's file system |

Protection against escalation is built in: RBAC doesn't let you create a role or binding with permissions you don't have yourself, **unless** you have `escalate` or `bind`. That is why those two verbs are equivalent to owning the cluster.

> **On the exam:** the task often says "remove unnecessary permissions". Read what the application really needs (often stated in the task or in a ConfigMap), and leave exactly that. Deleting the whole binding is wrong if the application must keep working.

### Special subjects

| Subject | Note |
|---|---|
| group `system:masters` | bypasses RBAC completely; it can't be restricted by deleting bindings. A certificate with `O=system:masters` must be guarded like a root password |
| `system:anonymous`, group `system:unauthenticated` | a binding for them means anyone without credentials has those permissions |
| group `system:authenticated` | every user and every ServiceAccount in the cluster |
| group `system:serviceaccounts` / `system:serviceaccounts:<ns>` | all ServiceAccounts in the cluster / in the namespace |
| ServiceAccount `default` | used by every pod without `serviceAccountName`; a binding for it grants permissions to all such pods |

## Review: who can do what

### kubectl auth can-i

```bash
# can a specific ServiceAccount do something
kubectl auth can-i list secrets -n finance --as=system:serviceaccount:finance:reporter
kubectl auth can-i create pods/exec -n finance --as=system:serviceaccount:finance:reporter
kubectl auth can-i '*' '*' --as=system:serviceaccount:finance:reporter      # cluster-admin?

# all permissions of a subject in a namespace
kubectl auth can-i --list -n finance --as=system:serviceaccount:finance:reporter

# user and group
kubectl auth can-i get nodes --as=jane --as-group=dev-team
kubectl auth whoami                  # who am I (user, groups)
```

The format for a ServiceAccount in `--as` is always `system:serviceaccount:<namespace>:<name>`. `--as` requires `impersonate`, which the admin on the exam has.

### Reviewing bindings

```bash
kubectl get rolebindings,clusterrolebindings -A -o wide
# NAMESPACE  NAME              ROLE                        AGE  USERS  GROUPS  SERVICEACCOUNTS
# finance    reporter-binding  ClusterRole/cluster-admin   3d                  finance/reporter
```

The `USERS`, `GROUPS` and `SERVICEACCOUNTS` columns show immediately who something is assigned to. Hunting for dangerous assignments:

```bash
# who has cluster-admin
kubectl get clusterrolebindings -o wide | grep -w cluster-admin
kubectl get rolebindings -A -o wide | grep -w cluster-admin

# all bindings for one ServiceAccount
kubectl get rolebindings,clusterrolebindings -A -o wide | grep 'finance/reporter'

# roles with wildcard permissions or dangerous verbs
kubectl get clusterroles -o yaml | grep -n -B8 -E "'\*'|escalate|bind|impersonate"
kubectl -n finance describe role reporter
```

`describe role` shows a `Resources | Non-Resource URLs | Resource Names | Verbs` table, which is faster to read than YAML.

> **On the exam:** `kubectl get rolebindings,clusterrolebindings -A -o wide | grep <sa>` is the fastest way to find everywhere a ServiceAccount gets permissions from. Don't forget ClusterRoleBindings: they grant permissions in **all** namespaces.

### A RoleBinding to a ClusterRole

| Combination | Scope of permissions |
|---|---|
| Role + RoleBinding | one namespace |
| ClusterRole + RoleBinding | the ClusterRole's permissions, but only in the RoleBinding's namespace |
| ClusterRole + ClusterRoleBinding | the whole cluster, including cluster-scoped resources (nodes, PVs, namespaces) |
| Role + ClusterRoleBinding | not possible |

A RoleBinding to a ClusterRole is a good pattern: the built-in `view` and `edit` roles are used per namespace without copying. But a RoleBinding to `cluster-admin` gives full control over the namespace, including Secrets and RBAC within it.

## Reducing permissions

Example: the ServiceAccount `reporter` in `finance` has `edit` across the whole cluster, but only needs to read pods and one ConfigMap.

```bash
# 1. current state
kubectl get clusterrolebindings -o wide | grep finance/reporter
kubectl auth can-i --list -n finance --as=system:serviceaccount:finance:reporter

# 2. a new, narrow role
kubectl -n finance create role reporter-read \
  --verb=get,list --resource=pods \
  --dry-run=client -o yaml > role.yaml
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: reporter-read
  namespace: finance
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["report-config"]
  verbs: ["get"]
```

```bash
kubectl apply -f role.yaml
kubectl -n finance create rolebinding reporter-read \
  --role=reporter-read --serviceaccount=finance:reporter

# 3. remove the old, overly broad binding
kubectl delete clusterrolebinding reporter-edit

# 4. verify
kubectl auth can-i list pods -n finance --as=system:serviceaccount:finance:reporter      # yes
kubectl auth can-i list secrets -n finance --as=system:serviceaccount:finance:reporter   # no
kubectl auth can-i list pods -n default --as=system:serviceaccount:finance:reporter      # no
```

`resourceNames` can't restrict `create` or `deletecollection` (the object name isn't known in the request), and restricts `list` and `watch` only when the client asks for a single object with the `metadata.name` field selector. So use it with `get`, `update`, `patch`, `delete`.

If the task says to modify the existing role instead of creating a new one, use `kubectl edit role` or `kubectl edit clusterrole`. Careful: changing a ClusterRole affects **all** bindings that use it.

> **On the exam:** before deleting a ClusterRole, check who else uses it: `kubectl get rolebindings,clusterrolebindings -A -o wide | grep <role-name>`. Never modify the built-in roles (`system:*`, `cluster-admin`, `admin`, `edit`, `view`); modify the bindings.

## ServiceAccount

A **ServiceAccount** is the identity of a process in a pod. The pod authenticates to the API server with that ServiceAccount's token. The subject name in RBAC is `system:serviceaccount:<ns>:<name>`.

### The default ServiceAccount

Every namespace automatically gets a ServiceAccount `default`. A pod without `spec.serviceAccountName` uses it. By itself, `default` has no permissions except API discovery, but:

- when someone binds a role to `default` "quickly", **all** pods in the namespace get it,
- the token is still mounted into every pod, so an attacker has a valid credential for further exploration.

Recommendation: `default` gets no permissions and doesn't mount a token, and every application that needs the API gets its own ServiceAccount.

```bash
kubectl -n prod patch serviceaccount default -p '{"automountServiceAccountToken": false}'
```

### automountServiceAccountToken

The field exists in two places:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend-sa
  namespace: prod
automountServiceAccountToken: false     # default for all pods using this SA
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: prod
spec:
  serviceAccountName: backend-sa
  automountServiceAccountToken: false   # at the pod level
  containers:
  - name: web
    image: nginx:1.27
```

| ServiceAccount | Pod | Is the token mounted? |
|---|---|---|
| not set | not set | yes |
| `false` | not set | no |
| `false` | `true` | **yes** (the pod takes precedence) |
| not set or `true` | `false` | no |

The value on the Pod always wins. That is why, for a pod that doesn't need the API, you set `false` directly on the pod (or in the Deployment's `spec.template.spec`), so a later change to the ServiceAccount doesn't open it up.

Verification:

```bash
kubectl -n prod get pod web -o jsonpath='{.spec.volumes[*].name}'; echo
# no "kube-api-access-xxxxx" = the token is not mounted
kubectl -n prod exec web -- ls /var/run/secrets/kubernetes.io/serviceaccount
# ls: cannot access ...: No such file or directory
```

> **On the exam:** `serviceAccountName` and `automountServiceAccountToken` of an existing pod can't be changed. For a standalone pod: `kubectl get pod web -o yaml > web.yaml`, edit, `kubectl replace --force -f web.yaml`. For a Deployment: `kubectl set serviceaccount deploy/backend backend-sa` or `kubectl edit deploy` (creates new pods).

### Bound and projected tokens

Since v1.24 Kubernetes no longer automatically creates a Secret with a permanent token for a ServiceAccount. The pod gets a **bound token** through a **projected** volume maintained by the kubelet:

```bash
kubectl -n prod get pod api -o yaml | grep -A12 'kube-api-access'
```

```yaml
  - name: kube-api-access-7x2kq
    projected:
      sources:
      - serviceAccountToken:
          expirationSeconds: 3607
          path: token
      - configMap:
          name: kube-root-ca.crt
          items:
          - key: ca.crt
            path: ca.crt
      - downwardAPI:
          items:
          - fieldRef:
              fieldPath: metadata.namespace
            path: namespace
```

Properties of a bound token:

- **time-limited**: the kubelet renews it before it expires, and the application should re-read the file,
- **bound to the pod**: once the pod is deleted, the API server rejects the token even if it hasn't expired,
- **has an audience**: the token is intended for a specific recipient (the API server by default).

The token is a JWT. The payload can be read (it isn't encrypted, only signed):

```bash
kubectl -n prod exec api -- cat /var/run/secrets/kubernetes.io/serviceaccount/token \
  | cut -d. -f2 | base64 -d 2>/dev/null; echo
# {"aud":[...],"exp":...,"kubernetes.io":{"namespace":"prod","pod":{"name":"api",...},
#  "serviceaccount":{"name":"api-sa",...}},"sub":"system:serviceaccount:prod:api-sa"}
```

When the application needs a token for another recipient (e.g. Vault), add your own projected volume with a short lifetime and a dedicated audience, instead of sharing the API token:

```yaml
spec:
  serviceAccountName: api-sa
  automountServiceAccountToken: false
  containers:
  - name: api
    image: myapp:1.0
    volumeMounts:
    - name: vault-token
      mountPath: /var/run/secrets/vault
      readOnly: true
  volumes:
  - name: vault-token
    projected:
      sources:
      - serviceAccountToken:
          path: token
          audience: vault
          expirationSeconds: 600      # the minimum is 600 seconds
```

For manual testing and for tools outside the cluster, use a short-lived token:

```bash
kubectl -n prod create token api-sa --duration=10m
kubectl -n prod create token api-sa --audience=vault --bound-object-kind=Pod --bound-object-name=api
```

### Long-lived Secret tokens

The old way still exists: a Secret of type `kubernetes.io/service-account-token` with an annotation naming the ServiceAccount. The control plane writes a token into it that **never expires**.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-sa-token
  namespace: prod
  annotations:
    kubernetes.io/service-account.name: api-sa
type: kubernetes.io/service-account-token
```

Why to avoid them:

- the token is valid as long as the Secret and ServiceAccount exist; a leaked token is permanent access,
- it isn't bound to a pod or an audience,
- anyone allowed to `get`/`list` Secrets in the namespace can read it.

Finding and cleaning up:

```bash
kubectl get secrets -A --field-selector type=kubernetes.io/service-account-token
kubectl -n prod delete secret api-sa-token     # the token stops working immediately
```

The `LegacyServiceAccountTokenCleanUp` controller in kube-controller-manager marks and later deletes automatically generated legacy tokens that haven't been used for a long time. Manually created ones you have to remove yourself.

### A separate ServiceAccount per application

```bash
kubectl -n prod create serviceaccount backend-sa
kubectl -n prod create role backend-cm --verb=get --resource=configmaps --resource-name=backend-config
kubectl -n prod create rolebinding backend-cm --role=backend-cm --serviceaccount=prod:backend-sa
kubectl -n prod set serviceaccount deploy/backend backend-sa
```

Each application with its own SA has its own permissions. Compromising one doesn't grant the permissions of another, and the audit log clearly shows who did what.

| Practice | Bad | Good |
|---|---|---|
| identity | all pods use `default` | one SA per application |
| token | mounted everywhere | `automountServiceAccountToken: false` where the API isn't needed |
| token type | a Secret of type `service-account-token` | bound projected token, `kubectl create token` |
| permissions | ClusterRoleBinding to `edit`/`cluster-admin` | a Role with exact resources, verbs and `resourceNames` |

> **On the exam:** when the task says "create an SA and use it in the Deployment", verify the result: `kubectl -n prod get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.serviceAccountName}{"\n"}{end}'`. Old pods keep the old SA until the Deployment replaces them.

## Troubleshooting

| Symptom | Cause | What to check |
|---|---|---|
| Application: `forbidden: User "system:serviceaccount:prod:api-sa" cannot list resource "pods"` | a permission is missing or the binding is in another namespace | `kubectl auth can-i list pods -n prod --as=...`, `kubectl get rolebindings -n prod -o wide` |
| The application can't find `/var/run/secrets/kubernetes.io/serviceaccount/token` | `automountServiceAccountToken: false` on the SA or pod | `kubectl get sa api-sa -o yaml`, `kubectl get pod -o yaml` |
| The pod isn't created: `serviceaccount "backend-sa" not found` | the SA doesn't exist in the Deployment's namespace | `kubectl -n prod get sa`; the error is in `kubectl describe rs` |
| After reducing permissions `can-i` still returns yes | another binding exists (often a ClusterRoleBinding or a binding for a group) | `kubectl get rolebindings,clusterrolebindings -A -o wide | grep` |
| A token from a Secret still works after the role was changed | the token is valid, permissions are computed per SA | remove the binding or delete the Secret |
| `kubectl create rolebinding` succeeds, but `can-i` says no | wrong `--serviceaccount` format (must be `ns:name`) | `kubectl describe rolebinding` |

## Summary

- Least privilege: Role instead of ClusterRole, exact resources and verbs, `resourceNames` where possible, no `*`.
- Dangerous permissions: `escalate`, `bind`, `impersonate`, `nodes/proxy`, `list`/`watch` on `secrets`, `create` on pods and workloads, `pods/exec`, `serviceaccounts/token`, CSR approval.
- Review: `kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa> -n <ns>` and `kubectl get rolebindings,clusterrolebindings -A -o wide`.
- To reduce permissions: create a narrow role, bind it, remove the overly broad binding, verify with `can-i` (yes for what's needed, no for the rest).
- The `default` SA gets no permissions and doesn't mount a token. Every application has its own SA.
- `automountServiceAccountToken: false` on the SA or the pod; the value on the pod takes precedence.
- Bound projected tokens are short-lived and bound to the pod; find and delete long-lived Secret tokens (`kubernetes.io/service-account-token`).
