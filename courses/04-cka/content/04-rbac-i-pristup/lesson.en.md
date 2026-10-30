## What this module covers

This module covers objective **1.1** of domain 1 (**Cluster Architecture, Installation & Configuration**, 25% of the exam): **Manage role based access control (RBAC)**.

Typical exam tasks:

- "Create a ServiceAccount `deployer` in namespace `ci` and give it permission to create and update Deployments only in that namespace."
- "User `jana` must be able to read Pod logs in namespace `dev`, but must not be able to `exec`."
- "Create a user via the CertificateSigningRequest API, approve the CSR and add the user to the kubeconfig."
- "Check whether ServiceAccount `monitor` is allowed to list Nodes. If not, fix it."

The tasks are short (3–6 points) but require precision: a wrong namespace or a wrong subject name means zero points. Always finish with a check using `kubectl auth can-i`.

## Authentication vs authorization

Every request to **kube-apiserver** goes through three phases:

1. **Authentication** (who are you?): a client X.509 certificate, a bearer token (ServiceAccount token), an OIDC token and so on. Kubernetes **has no User object**: a user exists only as a name (`CN`) in a certificate or a claim in a token.
2. **Authorization** (are you allowed?): on a kubeadm cluster `--authorization-mode=Node,RBAC`. The **Node** authorizer handles kubelets, **RBAC** handles everything else.
3. **Admission control** (should the request be modified or rejected?): mutating, then validating admission controllers.

| Phase | Question | Error |
|---|---|---|
| Authentication | Who is sending the request? | `401 Unauthorized` (`You must be logged in to the server`) |
| Authorization | Is it allowed to do this? | `403 Forbidden` (`User "jana" cannot list resource "pods"...`) |
| Admission | Is the request allowed by policies? | A message from the specific controller (e.g. `exceeded quota`) |

Checking the identity of the current context:

```bash
kubectl auth whoami
kubectl config current-context
```

> **On the exam:** every task starts with a `kubectl config use-context <name>` command. Copy it from the task text and run it before anything else. An RBAC solution in the wrong cluster scores zero.

## RBAC objects

RBAC has four objects in the `rbac.authorization.k8s.io/v1` API group:

| Object | Scope | What it contains |
|---|---|---|
| **Role** | namespace | Rules (`rules`) for resources in one namespace |
| **ClusterRole** | whole cluster | Rules for cluster-scoped resources (Node, PersistentVolume, Namespace), non-resource URLs (`/healthz`) or namespaced resources across all namespaces |
| **RoleBinding** | namespace | Binds a Role **or a ClusterRole** to subjects, valid only in its own namespace |
| **ClusterRoleBinding** | whole cluster | Binds a ClusterRole to subjects across the whole cluster |

RBAC is **purely additive**: there are no `deny` rules. If no rule allows an action, the action is denied.

### Role and binding combinations

| Role | Binding | Effect |
|---|---|---|
| Role | RoleBinding | Permissions in the binding's namespace (the role must be in the same namespace) |
| ClusterRole | RoleBinding | Permissions from the ClusterRole, but **only in the binding's namespace** |
| ClusterRole | ClusterRoleBinding | Permissions in all namespaces and on cluster-scoped resources |
| Role | ClusterRoleBinding | **Not possible** (a ClusterRoleBinding's `roleRef` must be a ClusterRole) |

The **ClusterRole + RoleBinding** combination is common: you define a role once (e.g. the built-in `view`, `edit`, `admin`) and use it in several namespaces.

### Role

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
- apiGroups: [""]            # "" = core group (pods, services, configmaps, secrets)
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

The same imperatively (faster on the exam):

```bash
kubectl create role pod-reader -n dev \
  --verb=get,list,watch --resource=pods,pods/log
kubectl create role pod-reader -n dev \
  --verb=get,list,watch --resource=pods --dry-run=client -o yaml > role.yaml
```

For resources outside the core group you write `resource.group`, e.g. `--resource=deployments.apps`. When you use just `--resource=deployments`, kubectl finds the group itself via discovery.

### RoleBinding and ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jana-pod-reader
  namespace: dev
subjects:
- kind: User
  name: jana
  apiGroup: rbac.authorization.k8s.io
- kind: ServiceAccount
  name: monitor
  namespace: observability     # the SA can be from another namespace
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# Role + RoleBinding
kubectl create rolebinding jana-pod-reader -n dev --role=pod-reader --user=jana
# ClusterRole + RoleBinding (permissions only in namespace dev)
kubectl create rolebinding ci-edit -n dev --clusterrole=edit --serviceaccount=ci:deployer
# ClusterRoleBinding for a group
kubectl create clusterrolebinding ops-view --clusterrole=view --group=ops
```

The `--serviceaccount` flag requires the format **`namespace:name`**. A common mistake is just `--serviceaccount=deployer`, which kubectl rejects.

**`roleRef` is immutable.** If you need to change the role a binding points to, delete the binding and create a new one. You can change the subjects (`kubectl edit`, `kubectl set subject`).

> **On the exam:** do not write RBAC YAML by hand. `kubectl create role/clusterrole/rolebinding/clusterrolebinding` with `-h` gives examples for all flags. If the task asks for a file, add `--dry-run=client -o yaml > file.yaml`.

## Verbs, resources and subresources

| Verb | HTTP | Example command |
|---|---|---|
| `get` | GET a single object | `kubectl get pod web` |
| `list` | GET a collection | `kubectl get pods` |
| `watch` | GET `?watch=true` | `kubectl get pods -w` |
| `create` | POST | `kubectl create`, `kubectl apply` (new object) |
| `update` | PUT | `kubectl replace`, `kubectl edit` |
| `patch` | PATCH | `kubectl apply` (existing), `kubectl scale`, `kubectl label` |
| `delete` | DELETE a single object | `kubectl delete pod web` |
| `deletecollection` | DELETE a collection | API clients and controllers (e.g. namespace cleanup) |

Special verbs: `impersonate` (for `--as`), `bind` and `escalate` (on `roles`/`clusterroles`), `approve` (on `signers` for CSRs). The wildcard `*` means all verbs or all resources; avoid it unless the task asks for it.

**Subresources** are written as `resource/subresource`:

| Subresource | Command that uses it | Required verb |
|---|---|---|
| `pods/log` | `kubectl logs` | `get` |
| `pods/exec` | `kubectl exec` | `create` (and `get` on `pods`) |
| `pods/portforward` | `kubectl port-forward` | `create` |
| `deployments/scale` | `kubectl scale deploy` | `patch`/`update` |
| `pods/status`, `nodes/status` | controllers, kubelet | `update`/`patch` |

Permission on `pods` does **not** automatically grant `pods/log` or `pods/exec`. Conversely, someone with `create` on `pods/exec` can effectively run anything in the container, so treat it as a privileged permission.

### resourceNames

`resourceNames` narrows a rule to specific objects:

```yaml
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config"]
  verbs: ["get", "update", "patch"]
```

```bash
kubectl create role app-config-editor -n dev --verb=get,update,patch \
  --resource=configmaps --resource-name=app-config
```

Limitations:

- `create` on a top-level resource cannot be narrowed by name (the new object's name is not known at authorization time). On subresources it can (e.g. `pods/exec` for a specific Pod).
- `deletecollection` cannot be narrowed by name.
- `list`/`watch` with `resourceNames` work only if the client sends the field selector `metadata.name=...`, so a plain `kubectl get configmaps` returns 403.

## Built-in and aggregated ClusterRoles

Built-in user-facing ClusterRoles:

| ClusterRole | Permissions |
|---|---|
| `cluster-admin` | Everything. Bound to the `system:masters` group by default |
| `admin` | Almost everything in a namespace, including Roles and RoleBindings (via a RoleBinding) |
| `edit` | Read and write most objects, without Roles/RoleBindings |
| `view` | Read-only, without Secrets and RBAC objects |

`admin`, `edit` and `view` are **aggregated** ClusterRoles. A ClusterRole with an `aggregationRule` field has no hand-written rules: a control plane controller collects the `rules` from all ClusterRoles that carry the matching label.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.kurs.local/aggregate-to-monitoring: "true"
rules: []   # the control plane fills it in and overwrites it
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-endpoints
  labels:
    rbac.kurs.local/aggregate-to-monitoring: "true"
rules:
- apiGroups: ["discovery.k8s.io"]
  resources: ["endpointslices"]
  verbs: ["get", "list", "watch"]
```

```bash
kubectl create clusterrole monitoring \
  --aggregation-rule="rbac.kurs.local/aggregate-to-monitoring=true"
```

Extending the built-in `view` role for a CRD (e.g. so `view` can also see `backups.kurs.local`): create a ClusterRole with the label `rbac.authorization.k8s.io/aggregate-to-view: "true"`. The controller immediately overwrites manual changes to the `rules` of an aggregated role.

> **On the exam:** if the task says "add a permission to an existing aggregated role", do not edit it directly. Create a new ClusterRole with the label from its `aggregationRule` (see it with `kubectl get clusterrole <name> -o yaml`).

## ServiceAccount

A **ServiceAccount** is an identity for processes in Pods. The subject name in RBAC is `system:serviceaccount:<namespace>:<name>`, and all SAs in a namespace are in the group `system:serviceaccounts:<namespace>`. Every namespace has a `default` SA; a Pod without `spec.serviceAccountName` uses it.

```bash
kubectl create serviceaccount deployer -n ci
kubectl create rolebinding deployer-edit -n ci --clusterrole=edit --serviceaccount=ci:deployer
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ci-runner
  namespace: ci
spec:
  serviceAccountName: deployer
  containers:
  - name: runner
    image: busybox:1.37
    command: ["sleep", "3600"]
```

On an existing Deployment: `kubectl set serviceaccount deploy/web deployer -n ci`. `serviceAccountName` on an existing Pod cannot be changed; the Pod has to be recreated.

### Tokens

Since v1.24 Kubernetes **no longer automatically creates a Secret with a token** for a ServiceAccount. Instead:

- the **kubelet** requests a short-lived token through the **TokenRequest API** and mounts it as a **projected** volume at `/var/run/secrets/kubernetes.io/serviceaccount/` (`token`, `ca.crt`, `namespace`). The token is bound to the Pod (it becomes invalid when the Pod is deleted) and the kubelet rotates it.
- Manually: `kubectl create token`.

```bash
kubectl create token deployer -n ci                    # default short lifetime (the server decides, typically 1h)
kubectl create token deployer -n ci --duration=2h
kubectl create token deployer -n ci --audience=vault
kubectl create token deployer -n ci --bound-object-kind=Pod --bound-object-name=ci-runner
```

You use the token as a bearer token:

```bash
TOKEN=$(kubectl create token deployer -n ci)
kubectl --token="$TOKEN" --server=https://controlplane:6443 \
  --certificate-authority=/etc/kubernetes/pki/ca.crt get deploy -n ci
```

A long-lived token (only when there is no other option, e.g. a legacy CI system): a Secret of type `kubernetes.io/service-account-token` with an annotation, and the control plane fills in `data.token`.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: deployer-token
  namespace: ci
  annotations:
    kubernetes.io/service-account.name: deployer
type: kubernetes.io/service-account-token
```

Your own projected token with a different audience and lifetime:

```yaml
spec:
  serviceAccountName: deployer
  containers:
  - name: app
    image: nginx:1.28
    volumeMounts:
    - name: vault-token
      mountPath: /var/run/secrets/tokens
  volumes:
  - name: vault-token
    projected:
      sources:
      - serviceAccountToken:
          path: vault-token
          audience: vault
          expirationSeconds: 7200
```

### automountServiceAccountToken

Most applications do not need API access. Disable automatic token mounting:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web
  namespace: dev
automountServiceAccountToken: false
```

The same field exists in `Pod.spec`. If both are set, **the Pod spec takes precedence**.

> **On the exam:** when the subject is a ServiceAccount, test with `kubectl auth can-i ... --as=system:serviceaccount:<ns>:<name>`. Forgetting the `system:serviceaccount:` prefix gives `no`, because RBAC then checks a user with that name.

## Users via X.509 certificates

A user is authenticated if they have a client certificate signed by the cluster CA (`/etc/kubernetes/pki/ca.crt`). From the certificate the API server reads:

- **CN** (Common Name) → the username,
- **O** (Organization) → groups (there can be several).

Never give a regular user `O=system:masters`: that group bypasses RBAC (it is bound to `cluster-admin`) and cannot be revoked by deleting a binding.

### The procedure via the CertificateSigningRequest API

```bash
# 1. Key and CSR (CN = user, O = group)
openssl genrsa -out jana.key 3072
openssl req -new -key jana.key -out jana.csr -subj "/CN=jana/O=developers"

# 2. CSR object in the cluster
cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jana
spec:
  request: $(base64 < jana.csr | tr -d '\n')
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400
  usages:
  - client auth
EOF

# 3. Approval
kubectl get csr                       # CONDITION: Pending
kubectl certificate approve jana      # CONDITION: Approved,Issued

# 4. Retrieving the certificate (status.certificate is base64)
kubectl get csr jana -o jsonpath='{.status.certificate}' | base64 -d > jana.crt
openssl x509 -in jana.crt -noout -subject -enddate
```

Rules for `spec`:

- `signerName: kubernetes.io/kube-apiserver-client` for user certificates (a required field in `certificates.k8s.io/v1`).
- `usages` must contain `client auth`.
- `expirationSeconds` is optional; the minimum is 600 (10 minutes), and the actual lifetime is the smaller of the requested value and `--cluster-signing-duration` (one year by default).
- `request` is a base64-encoded PEM CSR, **on a single line**.

Rejecting: `kubectl certificate deny jana`. Approved and denied CSR objects are deleted automatically after one hour, so retrieve the certificate right away.

### Kubeconfig

```bash
kubectl config set-credentials jana --client-key=jana.key \
  --client-certificate=jana.crt --embed-certs=true
kubectl config set-context jana@kubernetes --cluster=kubernetes --user=jana --namespace=dev
kubectl config get-contexts
kubectl --context=jana@kubernetes auth whoami
kubectl config use-context jana@kubernetes
```

`--embed-certs=true` copies the file contents into the kubeconfig (`client-certificate-data`), so the kubeconfig still works when the files are moved. Check the cluster name (`--cluster=kubernetes`) with `kubectl config get-clusters`.

Kubeconfig structure: `clusters` (server + CA), `users` (credentials), `contexts` (cluster + user + namespace) and `current-context`. The file is `~/.kube/config`, or the path from `KUBECONFIG`, or `--kubeconfig`. The admin kubeconfig on a kubeadm cluster is `/etc/kubernetes/admin.conf`.

> **On the exam:** after `set-context`, switch back to the admin context before the next task. If you stay in user `jana`'s context, the following commands fail with `Forbidden`. It is safer to test with `--context=` or `--as=` than with `use-context`.

## kubectl auth can-i

`kubectl auth can-i` asks the API server (SelfSubjectAccessReview) whether an action is allowed. It returns `yes`/`no` and exit code 0/1.

```bash
kubectl auth can-i create deployments -n ci
kubectl auth can-i get pods --subresource=log -n dev --as=jana
kubectl auth can-i create pods/exec -n dev --as=jana
kubectl auth can-i list nodes --as=system:serviceaccount:observability:monitor
kubectl auth can-i list pods -n dev --as=jana --as-group=developers
kubectl auth can-i --list -n dev --as=jana          # all permissions in the namespace
kubectl auth can-i '*' '*' --all-namespaces         # am I cluster-admin
```

`--as` uses **impersonation**: your current user must have the `impersonate` verb (admin has it). The answer depends on the exact subject name: RBAC does not check whether user `jana` actually exists.

Which binding grants the permission? Search:

```bash
kubectl get rolebindings,clusterrolebindings -A -o wide | grep jana
kubectl describe rolebinding jana-pod-reader -n dev
kubectl describe role pod-reader -n dev
```

## Admission controllers in brief

After authorization the request goes through the **admission** chain: first the **mutating** controllers (they can modify the object, e.g. `ServiceAccount` adds the token volume, `DefaultStorageClass` sets the StorageClass), then the **validating** ones (they can only reject, e.g. `ResourceQuota`, `PodSecurity`). If any of them rejects, the request fails.

They are enabled with a kube-apiserver flag in the static Pod manifest `/etc/kubernetes/manifests/kube-apiserver.yaml`:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --authorization-mode=Node,RBAC
    - --enable-admission-plugins=NodeRestriction
```

- `--enable-admission-plugins` adds plugins to the **default** list (it does not replace it). `--disable-admission-plugins` also turns off default ones.
- kubeadm sets `--enable-admission-plugins=NodeRestriction`.
- **NodeRestriction** limits the kubelet (`system:node:<name>` in group `system:nodes`) to modifying only its own Node object and the Pods on its node, and does not allow it to set labels with the `node-restriction.kubernetes.io/` and `node-role.kubernetes.io/` prefixes. Without it, a compromised kubelet can modify other nodes.

After you change the manifest, the kubelet restarts kube-apiserver on its own. Watch:

```bash
watch crictl ps --name kube-apiserver
crictl logs $(crictl ps -a --name kube-apiserver -q | head -1)
```

> **On the exam:** before editing `kube-apiserver.yaml`, make a copy outside the `manifests` folder (`cp ... /root/kube-apiserver.yaml.bak`). A copy in the same folder would be treated as another static Pod. If the apiserver does not come up within a minute, look at the container logs via `crictl` for an error in a plugin or flag name.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `error: You must be logged in to the server (Unauthorized)` | Authentication: expired/wrong certificate or token, wrong CA in the kubeconfig, CSR not signed by the same CA |
| `... is forbidden: User "jana" cannot list resource "pods" in API group "" in the namespace "dev"` | Authorization: no binding in that namespace, wrong verb or `apiGroups` |
| The SA gets `forbidden` even though a binding exists | `subjects[].namespace` in the binding does not match the SA's namespace, or the Pod uses a different SA (`kubectl get pod -o jsonpath='{.spec.serviceAccountName}'`) |
| `kubectl logs` returns forbidden, `get pods` works | `pods/log` is missing |
| `kubectl exec` returns forbidden | `create` on `pods/exec` is missing |
| `list` with `resourceNames` fails | A list without a field selector cannot be narrowed by name |
| The CSR stays `Pending` | It has not been approved: `kubectl certificate approve` |
| CSR `Approved` but no certificate | Wrong `signerName` or disallowed `usages` (check `kubectl describe csr`) |
| You cannot change `roleRef` | Immutable field: delete and recreate the binding |

A `forbidden` message always says exactly **who** (User/ServiceAccount), the **verb**, the **resource**, the **API group** and the **namespace**. That is the list of what the rule must contain.

## Summary

- Kubernetes has no User object: a user is the CN from a certificate (groups from O) or an identity from a token; 401 is authentication, 403 is authorization.
- Role/RoleBinding are namespaced, ClusterRole/ClusterRoleBinding are cluster-wide; a ClusterRole bound with a RoleBinding grants permissions only in that namespace.
- RBAC is purely additive; `roleRef` is immutable; subresources (`pods/log`, `pods/exec`) need their own rules.
- `resourceNames` does not work for top-level `create`, `deletecollection` or a plain `list`.
- You extend aggregated ClusterRoles (`aggregationRule`) with a new ClusterRole carrying the matching label.
- ServiceAccount tokens are short-lived (TokenRequest, projected volume, `kubectl create token`); a Secret with a token is not created automatically. `automountServiceAccountToken: false` on the Pod takes precedence over the SA.
- A user via the CSR API: `openssl genrsa` + `openssl req -subj "/CN=.../O=..."`, a CSR with `signerName: kubernetes.io/kube-apiserver-client` and `usages: [client auth]`, `kubectl certificate approve`, `kubectl config set-credentials/set-context`.
- Finish every RBAC task with `kubectl auth can-i ... --as=...` (for an SA, `system:serviceaccount:ns:name`).
