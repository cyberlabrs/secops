## What this module covers

The module covers two objectives from domain 2 (**Cluster Hardening**, 15% of the exam):

- **2.3 Restrict access to Kubernetes API**: who may talk to the API server, how they authenticate, and from where.
- **2.4 Upgrade Kubernetes to avoid vulnerabilities**: why and how to upgrade the cluster regularly.

Typical exam tasks:

- "The API server accepts anonymous requests. Disable that and verify that the cluster still works."
- "The `kubernetes` service in the `default` namespace is of type NodePort. Change it back to ClusterIP so the API isn't reachable from outside."
- "Enable the `NodeRestriction` admission plugin and verify that the kubelet on `node01` cannot change labels of other nodes."
- "Create the user `jane` through a **CertificateSigningRequest**, approve it and add it to the kubeconfig."
- "Upgrade the control plane and `node01` to the next patch version."

In the CKA you already edited static Pod manifests and ran `kubeadm upgrade`. Here you use the same knowledge with a security goal: reduce who can reach the API and from where, and close known vulnerabilities.

## The path of a request through the API server

Every request to `kube-apiserver` passes three gates, in this order:

1. **Authentication** (who are you?): a client certificate, a bearer token (ServiceAccount, OIDC), or nothing (anonymous).
2. **Authorization** (are you allowed?): `Node`, `RBAC`, `Webhook`, and the dangerous `AlwaysAllow`.
3. **Admission control** (is the request acceptable and should it be modified?): mutating then validating admission plugins, webhooks and policies.

An attacker who reaches port 6443 tries to bypass one of the gates: anonymous access, overly broad authorization, a stolen kubeconfig or certificate, or a kubelet that modifies other nodes' objects. This module goes through those weaknesses one by one.

| Gate | Flag on `kube-apiserver` | Secure value (kubeadm) |
|---|---|---|
| Authentication | `--anonymous-auth`, `--client-ca-file` | anonymous disabled or limited to health endpoints; CA = `/etc/kubernetes/pki/ca.crt` |
| Authorization | `--authorization-mode` | `Node,RBAC` |
| Admission | `--enable-admission-plugins` | `NodeRestriction` (plus the defaults) |
| Network | `--kubernetes-service-node-port`, `--secure-port` | flag not set; 6443 only behind a firewall |

## Working with the API server manifest

On a kubeadm cluster the API server is a **static Pod**: `/etc/kubernetes/manifests/kube-apiserver.yaml` on `controlplane`. The kubelet watches that folder and restarts the Pod when you save the file.

```bash
ssh controlplane            # if you're not on it already
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
vim /etc/kubernetes/manifests/kube-apiserver.yaml
watch crictl ps --name kube-apiserver   # wait for the new container (new CONTAINER ID)
kubectl get --raw /readyz               # "ok" when the API is ready
```

> **On the exam:** keep the backup copy **outside** `/etc/kubernetes/manifests/`. The kubelet reads all files in that folder, so a copy with the same Pod name causes a mess. A copy in `/root/` lets you restore a working state in seconds if the API doesn't come up.

If the API doesn't come up after the change:

```bash
crictl ps -a --name kube-apiserver                    # does the container exist at all
crictl logs <container-id>                            # a flag error shows in the first lines
ls /var/log/pods/ | grep apiserver                    # logs even when crictl doesn't see the container
journalctl -u kubelet --since "5 min ago" | grep -i apiserver   # YAML syntax error
```

## Anonymous access

The `--anonymous-auth` flag defaults to `true`. A request that no authenticator accepted or rejected gets the user **`system:anonymous`** and the group **`system:unauthenticated`**. With RBAC that user may do only what it has been explicitly granted (e.g. the default ClusterRole `system:public-info-viewer` for `/version`, `/healthz`, `/livez`, `/readyz`).

The danger arises when someone binds permissions to the anonymous user:

```bash
# find bindings that include anonymous users
kubectl get clusterrolebindings,rolebindings -A -o wide | grep -E 'system:anonymous|system:unauthenticated'
```

Checking from outside (from any node):

```bash
curl -k https://controlplane:6443/api/v1/namespaces
# anonymous enabled: 403 Forbidden, "User \"system:anonymous\" cannot list resource ..."
# anonymous disabled: 401 Unauthorized
```

403 means "I know you're the anonymous user, but you have no rights". 401 means "I don't accept requests without an identity".

### Disabling it

The simplest way is to add the flag to the manifest:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --anonymous-auth=false
    - --authorization-mode=Node,RBAC
    ...
```

Watch out for the consequence: the static Pod's probes (`livenessProbe`, `readinessProbe`, `startupProbe`) send an HTTPS request to `/livez` and `/readyz` **without credentials**. Without anonymous access, the probes may get 401, and the kubelet then restarts the API server in a loop. That is why after the change you must watch `crictl ps` for a few minutes.

Since version 1.34 (stable) there is a finer option: **AuthenticationConfiguration** with an `anonymous` field, which allows anonymous access only for the listed paths:

```yaml
# /etc/kubernetes/auth-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AuthenticationConfiguration
anonymous:
  enabled: true
  conditions:
  - path: /livez
  - path: /readyz
  - path: /healthz
```

The file is passed with the flag `--authentication-config=/etc/kubernetes/auth-config.yaml` (and must be mounted into the Pod through a `hostPath` volume). When the file configures `anonymous`, you **must not** set the `--anonymous-auth` flag at the same time; the API server won't start.

> **On the exam:** do exactly what the task asks. If it says "set `--anonymous-auth=false`", set the flag and don't invent an AuthenticationConfiguration. If the API then crashes because of the probes and the task doesn't say otherwise, check in the log whether the reason really is a 401 on the probe.

### The kubelet API

The kubelet has its own API on port 10250 and its own settings in `/var/lib/kubelet/config.yaml`:

```yaml
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
authorization:
  mode: Webhook
```

`mode: AlwaysAllow` on the kubelet means that anyone who reaches 10250 can execute commands in containers. After the change: `systemctl restart kubelet`. Detailed CIS checks of the kubelet are done with `kube-bench run --targets node` (module 1).

## Authorization: Node,RBAC

`--authorization-mode` is a list of authorizers consulted in order; the first one that says "yes" or "no" decides.

| Mode | What it does | Security-wise |
|---|---|---|
| `AlwaysAllow` | Every authenticated (and anonymous) request passes | Never in production |
| `AlwaysDeny` | Denies everything | Testing only |
| `Node` | Authorizes kubelets (`system:node:<name>`) only for objects tied to their node | Together with NodeRestriction |
| `RBAC` | Roles/ClusterRoles and bindings | Standard |
| `Webhook` | Asks an external service | As needed |
| `ABAC` | A static policy in a file | Hard to maintain; avoid |

If you see `--authorization-mode=AlwaysAllow`, replace it with `--authorization-mode=Node,RBAC`. Verification:

```bash
kubectl auth can-i list secrets -A --as=system:anonymous      # you expect "no"
kubectl auth can-i get nodes --as=system:node:node01 --as-group=system:nodes
```

## Admission controllers and NodeRestriction

Admission plugins are enabled with the `--enable-admission-plugins` flag (a comma-separated list, order doesn't matter) and disabled with `--disable-admission-plugins`. Many are enabled by default (e.g. `NamespaceLifecycle`, `ServiceAccount`, `PodSecurity`, `ValidatingAdmissionPolicy`, `ValidatingAdmissionWebhook`). The list for your version:

```bash
kubectl -n kube-system exec kube-apiserver-controlplane -- kube-apiserver -h | grep -A3 'enable-admission-plugins'
```

**NodeRestriction** isn't in the default set, so kubeadm adds it explicitly:

```yaml
    - --enable-admission-plugins=NodeRestriction
```

### What NodeRestriction prevents

It applies to kubelets using credentials from the `system:nodes` group with the user name `system:node:<nodeName>`. Such a kubelet:

- may modify only **its own** Node object and only the Pods bound to its node;
- **may not** delete its Node object or modify or remove taints;
- **may not** set labels with the `node-restriction.kubernetes.io/` prefix (reserved for administrators for workload isolation) or `node-role.kubernetes.io/`;
- may set only the allowed `kubernetes.io/` and `k8s.io/` labels (e.g. `kubernetes.io/hostname`, `topology.kubernetes.io/zone`, `node.kubernetes.io/*`, `kubelet.kubernetes.io/*`).

Why it matters: an attacker who escapes a container on `node01` gets the kubelet's kubeconfig (`/etc/kubernetes/kubelet.conf`). Without NodeRestriction, they could label other nodes, or label their own node with a label used by a sensitive workload's `nodeSelector`, and thereby "attract" other Pods to the compromised node.

Test from `node01`:

```bash
ssh node01
export KUBECONFIG=/etc/kubernetes/kubelet.conf
kubectl label node controlplane foo=bar                       # denied: another node
kubectl label node node01 node-restriction.kubernetes.io/pci=true   # denied: reserved prefix
kubectl label node node01 test=ok                             # allowed: a regular label on its own node
```

> **On the exam:** a typo in the plugin name (e.g. `NodeRestrictions`) brings down the API server. Copy the name from the "Admission Control in Kubernetes" page (kubernetes.io/docs/reference/access-authn-authz/admission-controllers/), not from memory.

Admission is also where security policies are enforced: **PodSecurity** (module 7), **ImagePolicyWebhook** and **ValidatingAdmissionPolicy** (module 10). They all use the same mechanism.

## Network access to the API server

If the API is reachable from the internet, an attacker can try stolen tokens, exploit pre-authentication vulnerabilities and fingerprint the version. The rule: **don't expose the API server publicly**. Access goes through a VPN, a bastion host or a private endpoint.

### The kubernetes service as a NodePort

The API server itself maintains the Service `kubernetes` in the `default` namespace. The `--kubernetes-service-node-port` flag (if non-zero) turns it into a **NodePort**, so the API is reachable on that port on **every** node.

```bash
kubectl get svc kubernetes -n default
# NAME         TYPE       CLUSTER-IP   EXTERNAL-IP   PORT(S)         AGE
# kubernetes   NodePort   10.96.0.1    <none>        443:31000/TCP   2d
```

The fix:

1. Remove `--kubernetes-service-node-port=31000` from `/etc/kubernetes/manifests/kube-apiserver.yaml` and wait for the restart.
2. If the service is still a NodePort, delete it: `kubectl delete svc kubernetes -n default`. The API server immediately recreates it as **ClusterIP**.
3. Verify: `kubectl get svc kubernetes` and `curl -k https://node01:31000` (it should not respond).

The same risk exists if someone manually creates an additional Service of type **LoadBalancer** or NodePort pointing to the API server. Look for them:

```bash
kubectl get svc -A | grep -E 'NodePort|LoadBalancer'
kubectl get endpointslices -A | grep 6443
```

| Exposure type | Who can reach 6443 | Verdict |
|---|---|---|
| ClusterIP `kubernetes` + firewall on the node | Pods and administrators from allowed addresses | Correct |
| NodePort on the `kubernetes` service | Anyone who can see any node | Remove |
| LoadBalancer with a public IP | The whole internet | Remove or restrict `loadBalancerSourceRanges` |
| Private endpoint / VPN | Internal network only | Recommended |

### Firewall and allowlist

Put an allowlist in front of the API: a cloud security group (6443 only from the admin CIDR and from the nodes) or a host firewall (module 5). An example with iptables on `controlplane`:

```bash
iptables -A INPUT -p tcp --dport 6443 -s 10.0.0.0/24 -j ACCEPT    # nodes and admin network
iptables -A INPUT -p tcp --dport 6443 -j DROP
```

Managed clusters (EKS, GKE, AKS) have their own options for a private endpoint and a list of allowed CIDRs. The principle is the same.

## Kubeconfig and certificates

A **kubeconfig** is a file with the cluster address, the CA certificate and the user's credentials (a client certificate and key, or a token). Whoever has the file has the identity. Important files on a kubeadm cluster:

| File | Identity | Note |
|---|---|---|
| `/etc/kubernetes/admin.conf` | `kubernetes-admin`, group `kubeadm:cluster-admins` | Admin via an RBAC binding; can be revoked by deleting the binding |
| `/etc/kubernetes/super-admin.conf` | group `system:masters` | Bypasses RBAC; use only in an emergency |
| `/etc/kubernetes/kubelet.conf` | `system:node:<name>` | Limited by Node authorization and NodeRestriction |
| `/etc/kubernetes/pki/ca.key` | CA key | Whoever has it can sign any identity |

Permissions: `chmod 600` on kubeconfig files and keys, owner `root`. Never share `admin.conf` with teams; create separate users for them with minimal RBAC.

Kubernetes **has no certificate revocation list**. A client certificate is valid until it expires. If it is stolen, the only quick remedy is to remove the RBAC permissions for that CN or group (or rotate the CA). The `system:masters` group cannot be restricted with RBAC, so a certificate with it means permanent full access until it expires.

### A new user through a CertificateSigningRequest

Identity from a certificate: **CN** is the user name, **O** is the group.

```bash
openssl genrsa -out jane.key 2048
openssl req -new -key jane.key -subj "/CN=jane/O=dev" -out jane.csr
```

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <output of: base64 -w0 jane.csr>
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400      # minimum 600
  usages:
  - client auth
```

```bash
kubectl apply -f jane-csr.yaml
kubectl get csr                                 # CONDITION: Pending
kubectl certificate approve jane
kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt
openssl x509 -in jane.crt -noout -subject -enddate

kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key --embed-certs=true
kubectl config set-context jane --cluster=kubernetes --user=jane
kubectl --context jane auth can-i list pods     # "no" until you add RBAC
```

Signing is done by kube-controller-manager with the CA from the `--cluster-signing-cert-file` and `--cluster-signing-key-file` flags. The **CertificateSubjectRestriction** admission plugin (enabled by default) rejects a CSR for the `kubernetes.io/kube-apiserver-client` signer that requests the `system:masters` group.

> **On the exam:** before `approve`, always look at what the request asks for: `kubectl get csr jane -o jsonpath='{.spec.request}' | base64 -d | openssl req -noout -subject`. A task sometimes includes a suspicious CSR (e.g. `O=system:masters` or `CN=system:node:...`) that must be **denied** with `kubectl certificate deny`.

### Manual signing with the CA key

If you have access to `ca.key` on `controlplane`, you can sign a certificate without the CSR API:

```bash
openssl x509 -req -in jane.csr \
  -CA /etc/kubernetes/pki/ca.crt -CAkey /etc/kubernetes/pki/ca.key -CAcreateserial \
  -days 30 -out jane.crt
```

That works, but leaves no trace in the API (no CSR object, no audit record of the approval) and shows how powerful `ca.key` is. That is why you keep the CA key only on control plane nodes, with permission 600, and use manual signing only when the task explicitly asks for it.

## Upgrading because of vulnerabilities

Every Kubernetes version has known vulnerabilities that are fixed in **patch** releases (e.g. 1.35.0 → 1.35.N). An old cluster means publicly documented holes.

- The project maintains the **three most recent minor versions**. Each gets patches for about a year; after that there are no security fixes.
- Patch releases come out roughly once a month; security fixes also come out off-schedule.
- The official **CVE feed** is on kubernetes.io (Reference → Kubernetes Issues and Security → Official CVE Feed), in JSON and RSS format:

```bash
curl -sL https://k8s.io/docs/reference/issues-security/official-cve-feed/index.json | jq '.items | length'
curl -sL https://k8s.io/docs/reference/issues-security/official-cve-feed/feed.xml | head -40
```

Along with Kubernetes, also upgrade containerd, the kernel and the node's OS packages: a vulnerability in runc or the kernel (container escape) is as dangerous as a vulnerability in the API server.

### Version skew

| Component | Allowed difference relative to kube-apiserver |
|---|---|
| kube-controller-manager, kube-scheduler | Not newer; at most 1 minor older |
| kubelet, kube-proxy | Not newer; at most 3 minor older |
| kubectl | ±1 minor |
| Multiple apiservers (HA) | At most 1 minor apart from each other |

Consequences: **the API server is upgraded first**, minor versions are **not skipped** (1.34 → 1.36 isn't allowed, you go 1.34 → 1.35 → 1.36), and the kubelet must never be newer than the API server.

### kubeadm upgrade order (reminder)

On `controlplane`:

```bash
apt-mark unhold kubeadm && apt-get update && apt-get install -y kubeadm='1.35.N-*' && apt-mark hold kubeadm
kubeadm upgrade plan                    # shows available versions and what will change
kubeadm upgrade apply v1.35.N
kubectl drain controlplane --ignore-daemonsets
apt-mark unhold kubelet kubectl && apt-get install -y kubelet='1.35.N-*' kubectl='1.35.N-*' && apt-mark hold kubelet kubectl
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon controlplane
```

On `node01` (run the drain from `controlplane`):

```bash
kubectl drain node01 --ignore-daemonsets
ssh node01
apt-mark unhold kubeadm && apt-get install -y kubeadm='1.35.N-*' && apt-mark hold kubeadm
kubeadm upgrade node
apt-mark unhold kubelet && apt-get install -y kubelet='1.35.N-*' && apt-mark hold kubelet
systemctl daemon-reload && systemctl restart kubelet
exit
kubectl uncordon node01
```

To move to a new **minor** version, first change the repository in `/etc/apt/sources.list.d/kubernetes.list` (`https://pkgs.k8s.io/core:/stable:/v1.36/deb/`), because pkgs.k8s.io has a separate repository per minor version.

> **On the exam:** find the exact package version with `apt-cache madison kubeadm`. At the end, check `kubectl get nodes` (the VERSION column) and `kubeadm version`. A task often asks to upgrade only one node or only the control plane; don't do more than it says.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `kubectl` returns `connection refused` after a manifest change | `crictl ps -a --name kube-apiserver`, `crictl logs`; a wrong flag or admission plugin name |
| The API server restarts every few minutes | The probes get 401 (anonymous disabled); `kubectl describe pod` doesn't work, so look at `crictl ps -a` and the kubelet log |
| `--authentication-config` and `--anonymous-auth` together | The API doesn't start; keep only one |
| A new file (e.g. auth-config) "doesn't exist" | It isn't mounted into the Pod: add `volumeMounts` and a `hostPath` volume |
| A CSR stays `Pending` | It hasn't been approved (`kubectl certificate approve`) |
| A CSR is `Approved`, but there's no certificate | Wrong `signerName` or controller-manager isn't running |
| A user with a certificate gets `Forbidden` | Authentication works; a Role/RoleBinding for the CN or O is missing |
| The kubelet on a node is `NotReady` after an upgrade | `journalctl -u kubelet`; the kubelet is newer than the API server or `daemon-reload` wasn't run |

## Summary

- A request passes authentication → authorization → admission; you configure each gate with flags in `/etc/kubernetes/manifests/kube-apiserver.yaml`.
- `--anonymous-auth=false` or an AuthenticationConfiguration with `anonymous.conditions` (only `/livez`, `/readyz`, `/healthz`); not both together. 401 = no anonymous access, 403 = anonymous without rights.
- `--authorization-mode=Node,RBAC`, never `AlwaysAllow`; kubelet: `anonymous.enabled: false` and `authorization.mode: Webhook`.
- `NodeRestriction` limits the kubelet to its own Node and its own Pods and forbids the `node-restriction.kubernetes.io/` and `node-role.kubernetes.io/` labels.
- Don't expose the API externally: remove `--kubernetes-service-node-port`, delete the `kubernetes` service so it comes back as ClusterIP, firewall/allowlist on 6443.
- Kubeconfig files and `ca.key` are credentials; certificates can't be revoked, and `system:masters` bypasses RBAC. Check a CSR before approving it.
- Upgrade to the latest patch of a supported minor version; follow the CVE feed. The API server goes first, minor versions aren't skipped, and the kubelet is never newer than the API server.
