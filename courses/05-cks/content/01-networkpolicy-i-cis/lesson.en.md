## What this module covers

The module covers two objectives from domain 1 (**Cluster Setup**, 15% of the exam):

- **1.1** NetworkPolicy to restrict access at the cluster level,
- **1.2** the CIS benchmark (the **kube-bench** tool) to review the security configuration of components.

Typical exam tasks:

- "In the `payments` namespace, introduce a default deny for all ingress and egress traffic. Allow only DNS."
- "Pods in the `dev` namespace must not be able to reach pods in the `prod` namespace in any way."
- "Run kube-bench on the controlplane node and fix all FAIL findings from section 1.2 related to `--profiling` and `--authorization-mode`."
- "kube-bench on `node01` reports that the kubelet allows anonymous requests. Fix it."
- "Fix the permissions and owner of the `/var/lib/etcd` directory according to the CIS recommendation."

You know the NetworkPolicy syntax from the CKA. Here we look at it through an attacker's eyes: what a compromised pod can reach and how to take that away. The second part of the module is working with static Pod manifests and kubelet configuration, where a mistake takes down the control plane. That is why discipline matters: backup, change, verify.

## NetworkPolicy from a security angle

### Starting point: a flat network

Without a single policy, the Kubernetes network is **flat**: every pod can open a connection to every pod in every namespace, to the nodes and to the internet. For an attacker who has taken over one container (e.g. through a vulnerable web application) this means:

- **lateral movement**: scanning the whole Pod CIDR and attacking databases, Redis and internal APIs without authentication,
- access to services in `kube-system` (metrics-server, CoreDNS, sometimes the dashboard),
- access to the cloud metadata service `169.254.169.254` (module 02),
- **exfiltration**: sending data to any address on the internet, downloading tools.

NetworkPolicy is a per-pod L3/L4 firewall. The goal is a **zero trust** model: deny everything, then allow exactly what the application needs.

### Default deny per namespace

The first step in every namespace with applications:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: payments
spec:
  podSelector: {}          # all pods in the namespace
  policyTypes:
  - Ingress
  - Egress
```

There are no `ingress` or `egress` rules, so no connection is allowed. Immediately afterwards restore DNS, otherwise applications cannot even resolve service names:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: payments
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

Variants asked on the exam:

| Task | `policyTypes` | Rules |
|---|---|---|
| Default deny ingress | `[Ingress]` | no `ingress` |
| Default deny egress | `[Egress]` | no `egress` |
| Default deny all | `[Ingress, Egress]` | no rules |
| Allow all ingress (explicit) | `[Ingress]` | `ingress: [{}]` |
| Allow all egress | `[Egress]` | `egress: [{}]` |

Watch the difference: `ingress: []` (or omitted) means "nothing", while `ingress: [{}]` means "everything". The empty rule `{}` matches every source and every port.

> **On the exam:** default deny is a one-minute task. The "Default policies" example is on the page kubernetes.io/docs/concepts/services-networking/network-policies/. Copy it, change `name` and `namespace`, and always check whether the task asks for Ingress only, Egress only, or both.

### Namespace isolation

The requirement "pods from other namespaces must not reach `prod`, while traffic inside `prod` is unrestricted":

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: same-namespace-only
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}      # all pods, but only from the policy's namespace (prod)
```

`podSelector: {}` inside `from` without a `namespaceSelector` selects only pods from the namespace the policy lives in. If the ingress controller (Traefik in the `traefik` namespace) must reach the application, add it as a second peer:

```yaml
  ingress:
  - from:
    - podSelector: {}
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: traefik
```

The control plane automatically sets the **`kubernetes.io/metadata.name`** label on every namespace, with a value equal to its name. It cannot be spoofed, because the API server overwrites it. That makes it safer than arbitrary labels such as `team=frontend`, which anyone allowed to modify the namespace can add.

> **On the exam:** before writing selectors, look at the labels: `kubectl get ns --show-labels` and `kubectl -n prod get pods --show-labels`. If the task says "the namespace with label `env=dev`", use exactly that label, not the name.

### Egress control

Egress is what an attacker uses for exfiltration and for downloading tools (`curl | sh`). Example: the backend may only reach the database in its own namespace and one external API.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-egress
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - ipBlock:
        cidr: 203.0.113.10/32     # external payment API
    ports:
    - protocol: TCP
      port: 443
```

Together with the namespace's `allow-dns`, this is the complete egress. Policies are additive (a union), so you don't have to repeat DNS in every policy.

Limitations you need to know:

- NetworkPolicy works with IP addresses and ports. It knows nothing about domains (`api.stripe.com`) or HTTP paths. FQDN and L7 rules need CNI extensions (e.g. `CiliumNetworkPolicy`), which are not the standard API.
- Pods with `hostNetwork: true` use the node's network stack. How policies apply to them is not defined by the standard, and most CNIs don't filter them. That is one more reason for Pod Security Admission (module 07) to forbid `hostNetwork`.

### Access to the control plane and kube-system

A pod with a stolen ServiceAccount token goes to the API server. Traffic to the `kubernetes.default` service (ClusterIP, e.g. `10.96.0.1:443`) is translated by kube-proxy to the controlplane node's IP and port **6443**. The policy sees the address after translation, so you write the rule for the node IP and 6443:

```bash
kubectl get endpointslices -n default -l kubernetes.io/service-name=kubernetes
# ENDPOINTS: 192.168.1.10   PORTS: 6443
```

For applications that don't talk to the API, default deny egress is enough: the API server is then unreachable. If one pod (e.g. an operator) must reach the API, allow it for that pod only:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: operator-to-apiserver
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: operator
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 192.168.1.10/32     # controlplane
    ports:
    - protocol: TCP
      port: 6443
```

Protecting **kube-system** works in two directions:

1. **Egress from application namespaces**: default deny egress with an exception only for the CoreDNS pods (`k8s-app=kube-dns`), not for all of `kube-system`.
2. **Ingress into kube-system**: be careful. Control plane components (apiserver, etcd, scheduler, controller-manager) and `kube-proxy` run with `hostNetwork: true`, so NetworkPolicy doesn't protect them anyway. A default deny ingress in `kube-system` without exceptions breaks DNS for the whole cluster. If you do it, immediately add a policy that allows ingress to CoreDNS on 53 from all namespaces (`namespaceSelector: {}`) and ingress to metrics-server from the API server.

Control plane ports (6443, 2379-2380 etcd, 10250 kubelet, 10257 controller-manager, 10259 scheduler) are protected at the node level by the host firewall and cloud security groups, not by NetworkPolicy. That belongs to host hardening (module 05).

> **On the exam:** before you apply a deny in `kube-system`, check that the task really asks for it. Broken DNS breaks the checks of every other task on the same cluster.

### Verifying policies

```bash
kubectl -n payments get netpol
kubectl -n payments describe netpol default-deny-all

# test from a temporary pod in the same namespace
kubectl -n payments run t --image=busybox:1.36 --rm -it --restart=Never -- \
  sh -c 'nslookup postgres; nc -zv -w 2 postgres 5432; wget -qO- -T 2 http://example.com'

# test from another namespace (isolation)
kubectl -n dev run t --image=busybox:1.36 --rm -it --restart=Never -- \
  nc -zv -w 2 web.prod.svc.cluster.local 80
```

`describe` shows the policy in readable form: "Allowing ingress traffic: <none> (Selected pods are isolated for ingress connectivity)" means the pod is isolated with no exceptions.

## CIS Kubernetes Benchmark

The **CIS Kubernetes Benchmark** is a document from the Center for Internet Security with hundreds of recommendations for cluster configuration. It is divided into sections:

| Section | What it checks | Where it is fixed |
|---|---|---|
| 1.1 Control plane config files | permissions and ownership of manifests, kubeconfig files, PKI, the etcd directory | `chmod`, `chown` on controlplane |
| 1.2 API server | kube-apiserver flags | `/etc/kubernetes/manifests/kube-apiserver.yaml` |
| 1.3 Controller manager | kube-controller-manager flags | `kube-controller-manager.yaml` |
| 1.4 Scheduler | kube-scheduler flags | `kube-scheduler.yaml` |
| 2 etcd | TLS and client authentication | `etcd.yaml` |
| 3 Control plane config | authentication, audit logs | mostly Manual recommendations |
| 4 Worker nodes | kubelet file permissions and its configuration | `/var/lib/kubelet/config.yaml`, systemd drop-in |
| 5 Policies | RBAC, PSA, NetworkPolicy, Secrets | Kubernetes objects |

Each recommendation is either **Automated** (a tool can check it) or **Manual** (requires human judgment). Check numbers (e.g. 1.2.15) change between benchmark versions. On the exam, rely on the text of the check, not the number.

## kube-bench

**kube-bench** (Aqua Security) checks the recommendations automatically: it reads processes, flags, configuration files and permissions, then prints the result. The lab nodes have version 0.16, and the configuration (check definitions per benchmark version) is in `/etc/kube-bench/cfg`.

### Running it

kube-bench runs **on the node** it checks, as root:

```bash
# controlplane
ssh controlplane    # or you're already on it
kube-bench run --targets master
kube-bench run --targets master,etcd

# worker
ssh node01
kube-bench run --targets node

# only specific checks
kube-bench run --targets master --check 1.2.15,1.3.2

# if it can't find the configuration
kube-bench --config-dir /etc/kube-bench/cfg run --targets master
```

Possible targets (`--targets`) are `master`, `node`, `etcd`, `controlplane` and `policies`. kube-bench detects the Kubernetes version itself and picks the matching benchmark. You can set the benchmark version manually with `--benchmark`.

### Reading the output

The output has three parts: the list of checks, remediations and the summary. A shortened example (numbers depend on the benchmark version):

```text
[INFO] 1 Control Plane Security Configuration
[INFO] 1.1 Control Plane Node Configuration Files
[PASS] 1.1.1 Ensure that the API server pod specification file permissions are set to 600 or more restrictive (Automated)
[FAIL] 1.1.12 Ensure that the etcd data directory ownership is set to etcd:etcd (Automated)
[INFO] 1.2 API Server
[WARN] 1.2.1 Ensure that the --anonymous-auth argument is set to false (Manual)
[FAIL] 1.2.15 Ensure that the --profiling argument is set to false (Automated)

== Remediations master ==
1.1.12 On the etcd server node, get the etcd data directory, passed as an argument --data-dir,
from the command 'ps -ef | grep etcd'.
Run the below command (based on the etcd data directory found above).
For example, chown etcd:etcd /var/lib/etcd

1.2.15 Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml
on the control plane node and set the below parameter.
--profiling=false

== Summary master ==
38 checks PASS
11 checks FAIL
12 checks WARN
0 checks INFO
```

| Status | Meaning | What you do |
|---|---|---|
| **PASS** | The automated check passed | nothing |
| **FAIL** | The automated check failed | fix it according to the remediation (if the task asks for it) |
| **WARN** | A Manual check, or the tool can't decide on its own | assess manually |
| **INFO** | Section heading or information | nothing |

For quick filtering:

```bash
kube-bench run --targets master | grep -E '^\[(FAIL|WARN)\]'
kube-bench run --targets master | grep -A6 '^1.2.15 '      # remediation for a single check
kube-bench run --targets master --json > /tmp/kb.json       # machine-readable output
```

> **On the exam:** the task usually lists exactly which findings to fix. Fix only those. Don't "repair" all FAIL findings at once: some changes (e.g. `--anonymous-auth=false` on the API server, enabling admission plugins that need extra configuration) can take down the control plane.

### Typical findings and fixes

**kube-apiserver** (`/etc/kubernetes/manifests/kube-apiserver.yaml`):

| Recommendation | Correct | Note |
|---|---|---|
| `--profiling` | `--profiling=false` | kubeadm doesn't set it; it is enabled by default |
| `--authorization-mode` | contains `Node` and `RBAC`, never `AlwaysAllow` | kubeadm sets `Node,RBAC` |
| `--anonymous-auth` | `false` (Manual) | careful on a kubeadm cluster, see below |
| `--enable-admission-plugins` | includes `NodeRestriction` | kubeadm enables it |
| `--audit-log-path` and the other audit flags | set | module 11 |
| `--kubelet-certificate-authority` | set | the API server verifies the kubelet's certificate |
| `--etcd-cafile`, `--etcd-certfile`, `--etcd-keyfile` | set | TLS to etcd |

**kube-controller-manager** and **kube-scheduler**:

| Component | Recommendation |
|---|---|
| controller-manager | `--profiling=false`, `--use-service-account-credentials=true`, `--bind-address=127.0.0.1`, `--terminated-pod-gc-threshold` (Manual) |
| scheduler | `--profiling=false`, `--bind-address=127.0.0.1` |

**etcd** (`/etc/kubernetes/manifests/etcd.yaml`): `--client-cert-auth=true`, `--peer-client-cert-auth=true`, and `--auto-tls` and `--peer-auto-tls` must not be `true`. kubeadm sets this correctly.

**kubelet** (`/var/lib/kubelet/config.yaml` on every node):

| Recommendation | Field in KubeletConfiguration |
|---|---|
| no anonymous requests | `authentication.anonymous.enabled: false` |
| authorization through the API server | `authorization.mode: Webhook` |
| client certificate verification | `authentication.x509.clientCAFile: /etc/kubernetes/pki/ca.crt` |
| read-only port 10255 disabled | `readOnlyPort: 0` |
| kernel parameter protection | `protectKernelDefaults: true` |
| certificate rotation | `rotateCertificates: true` |

**File permissions and ownership** (sections 1.1 and 4.1):

| File or directory | Permissions | Owner |
|---|---|---|
| `/etc/kubernetes/manifests/*.yaml` | 600 or stricter | `root:root` |
| `/etc/kubernetes/admin.conf`, `super-admin.conf`, `scheduler.conf`, `controller-manager.conf` | 600 | `root:root` |
| `/etc/kubernetes/pki/` (directory and files) | `*.crt` 600 or stricter, `*.key` 600 | `root:root` |
| `/var/lib/etcd` | 700 | `etcd:etcd` |
| `/etc/kubernetes/kubelet.conf` | 600 | `root:root` |
| `/var/lib/kubelet/config.yaml` | 600 | `root:root` |
| kubelet systemd drop-in (`/usr/lib/systemd/system/kubelet.service.d/10-kubeadm.conf`) | 600 | `root:root` |

```bash
stat -c '%a %U:%G %n' /etc/kubernetes/manifests/* /var/lib/etcd /var/lib/kubelet/config.yaml
chmod 600 /etc/kubernetes/manifests/*.yaml
chmod 700 /var/lib/etcd
id etcd || useradd -r -s /usr/sbin/nologin etcd
chown -R etcd:etcd /var/lib/etcd
```

kubeadm runs etcd as root, so the `etcd` user doesn't exist. The remediation requires it only for directory ownership; the etcd container keeps working.

## Applying fixes in static Pod manifests

Control plane components are **static Pods**: the kubelet reads `/etc/kubernetes/manifests/` and starts them itself. `kubectl edit` on the mirror pod doesn't work. You change the file on disk.

A procedure that doesn't break the cluster:

```bash
# 1. backup OUTSIDE the manifests directory (the kubelet would start the copy too!)
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak

# 2. edit
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --advertise-address=192.168.1.10
    - --authorization-mode=Node,RBAC
    - --enable-admission-plugins=NodeRestriction
    - --profiling=false              # added
    # ...
```

```bash
# 3. the kubelet notices the change and recreates the pod (30-90 s)
watch crictl ps --name kube-apiserver
kubectl -n kube-system get pod kube-apiserver-controlplane

# 4. verify that the flag is really active
ps -ef | grep [k]ube-apiserver | tr ' ' '\n' | grep profiling
kube-bench run --targets master --check 1.2.15
```

If the API server doesn't come back up:

```bash
crictl ps -a --name kube-apiserver          # does the container exist at all, Exited?
crictl logs <container-id>                  # flag error: "unknown flag", "invalid value"
journalctl -u kubelet --since "5 min ago" | grep -i apiserver   # YAML doesn't parse
ls /var/log/pods/kube-system_kube-apiserver-controlplane_*/kube-apiserver/
```

If the YAML is invalid, the kubelet doesn't create the pod at all and the error is only in `journalctl -u kubelet`. If a flag is wrong, the container starts and immediately crashes, so the error is in `crictl logs`.

> **On the exam:** never put a backup in `/etc/kubernetes/manifests/`. The kubelet runs every file in that directory, and two API servers on the same port crash each other. The procedure is the same for the scheduler and controller-manager, but without the brief `kubectl` outage.

### Trap: `--anonymous-auth=false` on the API server

kubeadm configures the API server's liveness and readiness probes as HTTPS GETs on `/livez` and `/readyz`, without credentials. Those paths are available to anonymous users. If you set `--anonymous-auth=false`, the probes get 401 and the kubelet may keep restarting the API server. That is why this recommendation is **Manual** in the benchmark. Do it only if the task explicitly asks for it, and watch the pod status for a few minutes afterwards.

## Applying fixes in the kubelet config.yaml

The kubelet is not a static Pod but a systemd service. It reads its configuration from the file `--config` points to:

```bash
ssh node01
systemctl cat kubelet                     # ExecStart and the 10-kubeadm.conf drop-in
ps -ef | grep [k]ubelet | tr ' ' '\n' | grep -- --config
# --config=/var/lib/kubelet/config.yaml
```

The change for the typical finding "the kubelet allows anonymous requests":

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook
readOnlyPort: 0
```

```bash
cp /var/lib/kubelet/config.yaml /root/kubelet-config.yaml.bak
vim /var/lib/kubelet/config.yaml
systemctl daemon-reload            # needed if you changed systemd files; doesn't hurt
systemctl restart kubelet
systemctl status kubelet --no-pager
journalctl -u kubelet -n 30 --no-pager
kubectl get nodes                  # node01 must stay Ready
```

If the same parameter also exists as a flag in `KUBELET_EXTRA_ARGS` (`/etc/default/kubelet`) or in a drop-in file, **the flag takes precedence** over `config.yaml`. If a change "has no effect", look for the flag:

```bash
grep -r anonymous /etc/default/kubelet /usr/lib/systemd/system/kubelet.service.d/ 2>/dev/null
```

> **On the exam:** the kubelet is changed on the node the task names, usually `node01`. Don't forget `ssh node01`, and `exit` back at the end. A typical trap is fixing the wrong node, so kube-bench still reports FAIL.

## Troubleshooting

| Symptom | Likely cause | What to check |
|---|---|---|
| After default deny nothing works, not even service names | no DNS exception | the `allow-dns` policy, UDP and TCP 53, the `k8s-app=kube-dns` label |
| A policy for another namespace has no effect | `podSelector` without `namespaceSelector` looks only at its own namespace | `kubectl get ns --show-labels` |
| The pod still sees everything although a deny is applied | the policy is in the wrong namespace or the pod has `hostNetwork: true` | `kubectl get netpol -A`, `kubectl get pod -o yaml | grep hostNetwork` |
| `kubectl` doesn't respond after a manifest change | the API server is restarting or crashing | `crictl ps -a`, `crictl logs`, `journalctl -u kubelet` |
| kube-bench still FAILs after the fix | change on the wrong node or a flag overrides `config.yaml` | `ps -ef | grep kubelet`, `systemctl cat kubelet` |
| kube-bench finds no checks | wrong config dir | `--config-dir /etc/kube-bench/cfg` |
| node `NotReady` after a kubelet change | syntax error in `config.yaml` | `journalctl -u kubelet`, restore the backup |

## Summary

- Without NetworkPolicy the network is flat. In every application namespace start with default deny (Ingress and Egress), then a DNS exception to `k8s-app=kube-dns` on UDP and TCP 53.
- Namespace isolation: `from: [{podSelector: {}}]` allows only the same namespace. For other namespaces use `kubernetes.io/metadata.name`.
- Egress to the API server is written for the controlplane node IP and port 6443. NetworkPolicy doesn't protect components with `hostNetwork: true`.
- kube-bench runs on the node itself: `kube-bench run --targets master` or `--targets node`. FAIL is an automated finding, WARN a manual one.
- Typical fixes: `--profiling=false` (apiserver, controller-manager, scheduler), `--authorization-mode=Node,RBAC`, kubelet `anonymous.enabled: false` and `authorization.mode: Webhook`.
- Permissions: manifests and kubeconfig files 600 `root:root`, `/var/lib/etcd` 700 `etcd:etcd`.
- Static Pod: backup outside `/etc/kubernetes/manifests`, edit, wait, verify with `crictl` and `ps`. Kubelet: edit `config.yaml`, `systemctl restart kubelet`, check `journalctl`.
