## What this module covers

The module covers two objectives from domain 4 (**Minimize Microservice Vulnerabilities**, 20% of the exam):

- **4.3 Understand and implement isolation techniques (multi-tenancy, sandboxed containers, etc.)**: how to separate teams and applications in the same cluster and how to run untrusted code in a sandbox (**gVisor**, **Kata Containers**) through a **RuntimeClass** object.
- **4.4 Implement Pod-to-Pod encryption (Cilium, Istio)**: transparent encryption in the CNI (**WireGuard**, **IPsec**) and **mTLS** in a service mesh.

Typical exam tasks:

- "Create a RuntimeClass `gvisor` with the handler `runsc` and run the Deployment `untrusted` in it."
- "Find the Pod that isn't running in the sandbox and move it."
- "All Pods in the `payments` namespace must accept only mTLS traffic" (Istio `PeerAuthentication`).
- "Separate team B: its own namespace, quota, default deny, dedicated nodes."

For Cilium and Istio, the exam more often asks for understanding and a short YAML than for an installation from scratch. In the course lab environment the CNI is Calico (without WireGuard encryption) and there is no service mesh, so you learn these parts through manifests and documentation, while gVisor (`runsc`) is installed on the nodes and you can try it.

## Multi-tenancy: layers of isolation

Kubernetes has no "tenant" object. You assemble isolation from several layers, and each covers a different kind of risk.

| Layer | Mechanism | What it protects |
|---|---|---|
| Logical boundary | A **Namespace** per team or application | Names, RBAC scope, NetworkPolicy, quotas |
| API access | **RBAC** `Role`/`RoleBinding` per namespace | Team A can't read or change team B's resources |
| Network | **NetworkPolicy** default deny + exceptions | Team A's Pods can't reach team B's Pods |
| Resources | **ResourceQuota** and **LimitRange** | One team can't consume the whole cluster (DoS) |
| Pod security | **Pod Security Admission** (`restricted`) | No privileged Pods and no hostPath escapes to the node |
| Nodes | **taints/tolerations** + **nodeAffinity**/`nodeSelector` | Tenants don't share the same node's kernel |
| Kernel | **Sandbox runtime** (gVisor, Kata) | A container escape doesn't give access to the host kernel |

A namespace is a **soft** boundary: all Pods share the same node kernel, the same API server and the same CNI. For "hard multi-tenancy" (untrusted users) you combine all the layers, and for the strictest isolation you use separate clusters.

### Example: a namespace for a team

```bash
kubectl create ns team-b
kubectl label ns team-b pod-security.kubernetes.io/enforce=restricted
kubectl -n team-b create role dev --verb=get,list,watch,create,update,delete \
  --resource=deployments,pods,services,configmaps
kubectl -n team-b create rolebinding dev --role=dev --group=team-b-devs
kubectl -n team-b create quota team-b --hard=requests.cpu=4,requests.memory=8Gi,limits.cpu=8,limits.memory=16Gi,pods=30
```

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: team-b
spec:
  limits:
  - type: Container
    default:            # limit if the container doesn't specify one
      cpu: 500m
      memory: 512Mi
    defaultRequest:     # request if the container doesn't specify one
      cpu: 100m
      memory: 128Mi
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: team-b
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

When a ResourceQuota with `requests.cpu` exists, every Pod must have a CPU request (or get one from a LimitRange), otherwise the API rejects it with `must specify requests.cpu`.

### Dedicated nodes

```bash
kubectl taint node node01 tenant=team-b:NoSchedule
kubectl label node node01 tenant=team-b
```

```yaml
spec:
  tolerations:
  - key: tenant
    operator: Equal
    value: team-b
    effect: NoSchedule
  nodeSelector:
    tenant: team-b
```

The taint keeps **other** Pods off the node, and the `nodeSelector`/affinity pulls **these** Pods onto that node. You need both: a toleration alone doesn't guarantee the Pod ends up on `node01`.

> **On the exam:** you solve isolation tasks with imperative commands (`kubectl create ns|role|rolebinding|quota`, `kubectl taint`, `kubectl label`), and write YAML only for NetworkPolicy and LimitRange. Copy examples from kubernetes.io (search for "LimitRange", "Resource Quotas", "Network Policies").

## Sandboxed containers

An ordinary container (runc) is a process on the host, isolated with namespaces and cgroups, but with a **shared kernel**. A kernel vulnerability (e.g. in a syscall) can lead to an escape to the node. A sandbox runtime inserts an extra layer between the application and the host kernel.

| | runc (default) | gVisor (`runsc`) | Kata Containers |
|---|---|---|---|
| Model | A process on the host | A user-space kernel (**Sentry**) intercepts syscalls | A lightweight virtual machine per Pod |
| Kernel the application sees | The host kernel | gVisor's implementation of the Linux API | A separate guest kernel in the VM |
| Isolation | Namespaces, cgroups, seccomp | Strong: few syscalls reach the host | Strongest: hardware virtualization |
| Cost | Fastest | Slower syscalls and I/O, some features missing | More memory, slower start, needs virtualization |
| Typical use | Everything else | Untrusted code, multi-tenant | Strict multi-tenant, regulated environments |

A sandbox doesn't replace `securityContext`, seccomp or NetworkPolicy: it is added on top of them.

### How the runtime gets to the Pod

1. **containerd** on the node has a runtime handler defined (in `/etc/containerd/config.toml`).
2. A **RuntimeClass** object in the cluster links a name to that handler.
3. The Pod selects the RuntimeClass with the `spec.runtimeClassName` field.

In the lab environment the `runsc` handler already exists. You can see it on the node like this:

```bash
ssh node01
grep -A3 'runtimes.runsc' /etc/containerd/config.toml
# [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
#   runtime_type = "io.containerd.runsc.v1"
runsc --version
crictl info | grep -i runsc
```

With containerd 2.x the configuration has `version = 3` and a different section name for the CRI plugin, but the principle is the same: the handler name in the configuration must be identical to the `handler` field in the RuntimeClass. After changing the configuration: `systemctl restart containerd`.

### RuntimeClass

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor          # RuntimeClass is not namespaced
handler: runsc          # handler name in the containerd configuration
```

Optional fields:

```yaml
scheduling:
  nodeSelector:         # the Pod goes only to nodes with this label
    sandbox: gvisor
  tolerations:          # added to the Pod at admission
  - key: sandbox
    operator: Exists
    effect: NoSchedule
overhead:
  podFixed:             # extra resources the sandbox consumes per Pod
    cpu: 100m
    memory: 64Mi
```

- `scheduling.nodeSelector` is merged with the Pod's `nodeSelector`. If they conflict, the Pod is rejected.
- `scheduling` matters when only some nodes have the handler installed: without it the Pod may land on a node without `runsc` and fail.
- `overhead.podFixed` is added to the Pod's requests by the scheduler and ResourceQuota.

### A Pod in gVisor

```bash
kubectl apply -f runtimeclass.yaml
kubectl get runtimeclass
kubectl run sandboxed --image=nginx:1.27 --dry-run=client -o yaml > sandboxed.yaml
# add spec.runtimeClassName: gvisor
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandboxed
spec:
  runtimeClassName: gvisor
  containers:
  - name: nginx
    image: nginx:1.27
```

For a Deployment the field goes into `spec.template.spec.runtimeClassName`. Existing Pods aren't changed in place: changing the template triggers a rolling update with new Pods.

### Verifying that the Pod really runs in gVisor

```bash
kubectl exec sandboxed -- dmesg
# [    0.000000] Starting gVisor...
# ... (made-up "boot" messages)
# [    x.xxxxxx] Ready!

kubectl exec sandboxed -- uname -r      # the version gVisor emulates, different from the node's kernel
ssh node01 uname -r                     # the node's real kernel

kubectl get pod sandboxed -o jsonpath='{.spec.runtimeClassName}{"\n"}'
```

On the node:

```bash
ssh node01
crictl ps --name nginx
crictl inspect <container-id> | grep -i runtimeType     # io.containerd.runsc.v1
ps aux | grep runsc                                     # runsc-sandbox / runsc-gofer processes
```

In an ordinary container `dmesg` usually returns an error (`Operation not permitted`) or the host kernel's real log, and `uname -r` is the same as on the node.

Finding all Pods that use a sandbox:

```bash
kubectl get pods -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,RC:.spec.runtimeClassName
```

> **On the exam:** you find the "Runtime Class" page in the documentation by searching for "RuntimeClass", and the gVisor documentation is allowed (gvisor.dev). The field is called `handler`, not `runtimeHandler`, and RuntimeClass is in the `node.k8s.io/v1` group. In the Pod it is `runtimeClassName`, not `runtimeClass`.

### What if it doesn't work

| Symptom | Cause |
|---|---|
| Pod `Failed`/`ContainerCreating`, the event contains `no runtime for "runsc" is configured` | The handler isn't in the containerd configuration on that node, or containerd wasn't restarted |
| `pods "x" is forbidden: pod rejected: RuntimeClass "gvisor" not found` | The RuntimeClass doesn't exist or the name in `runtimeClassName` is wrong |
| The Pod works on one node but not on another | `runsc` is installed only on some nodes; add `scheduling.nodeSelector` |
| The application behaves oddly in gVisor | Some syscalls or `/proc` files aren't supported; check the Pod logs |

```bash
kubectl describe pod sandboxed | tail
ssh node01 journalctl -u containerd --since "10 min ago" | grep -i runsc
```

## Pod-to-Pod encryption

By default, traffic between Pods travels **unencrypted** across the node network. Anyone with access to the network (or a compromised node) can eavesdrop on it. There are two approaches:

| | CNI transparent encryption (Cilium) | Service mesh mTLS (Istio) |
|---|---|---|
| Layer | L3/L4, between nodes | L4/L7, between workloads |
| Mechanism | A node-to-node WireGuard or IPsec tunnel | TLS with client certificates (mTLS) |
| Identity | The node (keys per node) | The workload (ServiceAccount, SPIFFE ID) |
| Application changes | No | No (sidecar or ambient proxy) |
| Traffic on the same node | Not encrypted (doesn't leave the node) | Encrypted |
| Identity-based authorization | No (Cilium network policies do that) | Yes (`AuthorizationPolicy`) |
| Complexity | One Helm parameter | A mesh control plane, a proxy in every Pod |

### Cilium: WireGuard or IPsec

Cilium is a CNI that can encrypt all traffic between Pods on different nodes. It is enabled with Helm values:

```bash
# WireGuard
helm upgrade --install cilium cilium/cilium --namespace kube-system \
  --reuse-values \
  --set encryption.enabled=true \
  --set encryption.type=wireguard

# optional: also encrypt node-to-node and node-to-Pod traffic (beta)
#   --set encryption.nodeEncryption=true
```

Or with the Cilium CLI at installation:

```bash
cilium install --set encryption.enabled=true --set encryption.type=wireguard
```

For **IPsec** you first need a Secret with the key in `kube-system`, then `encryption.type=ipsec`:

```bash
kubectl create -n kube-system secret generic cilium-ipsec-keys \
  --from-literal=keys="3+ rfc4106(gcm(aes)) $(dd if=/dev/urandom count=20 bs=1 2>/dev/null | xxd -p -c 64) 128"

helm upgrade --install cilium cilium/cilium --namespace kube-system \
  --reuse-values --set encryption.enabled=true --set encryption.type=ipsec
```

| | WireGuard | IPsec |
|---|---|---|
| Keys | Cilium generates them itself per node | You create and rotate the `cilium-ipsec-keys` Secret |
| Kernel | Needs WireGuard support (Linux 5.6+) | XFRM, available everywhere |
| Port | UDP 51871 between nodes | The ESP protocol |
| Configuration | Simplest | More steps, FIPS environments |

Verification:

```bash
cilium status                                    # overall state of Cilium agents and operator
cilium encryption status                         # Cilium CLI, for the whole cluster
kubectl -n kube-system exec ds/cilium -- cilium-dbg status | grep Encryption
# Encryption:  Wireguard   [cilium_wg0 (Pubkey: ..., Port: 51871, Peers: 1)]
kubectl -n kube-system exec ds/cilium -- cilium-dbg encrypt status   # IPsec: Keys in use, Errors
```

Proof on the wire: `tcpdump -n -i cilium_wg0` (WireGuard) or `tcpdump -n -i eth0 esp` (IPsec) inside the Cilium Pod. If you see Pod HTTP traffic as plain text on the physical interface, encryption isn't active.

In older versions the tool in the agent was called `cilium` instead of `cilium-dbg`, so in blog posts you'll see `cilium encrypt status`. Check which name exists in your Pod.

### Istio: mTLS

**Istio** injects a proxy (Envoy) next to every workload. The proxies establish **mutual TLS** between themselves: both sides present a certificate issued by the Istio CA (istiod), and the identity is derived from the ServiceAccount.

Two modes of operation:

| | Sidecar | Ambient |
|---|---|---|
| Proxy | An Envoy container in every Pod | A `ztunnel` DaemonSet per node (L4), an optional waypoint proxy for L7 |
| Enabling | `kubectl label ns app istio-injection=enabled` + restart Pods | `kubectl label ns app istio.io/dataplane-mode=ambient` |
| Pod restart | Required (injection at creation) | Not required |

```bash
kubectl label ns payments istio-injection=enabled
kubectl -n payments rollout restart deploy
kubectl -n payments get pods      # READY 2/2 = application + istio-proxy
```

mTLS behavior is determined by **PeerAuthentication**:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: payments
spec:
  mtls:
    mode: STRICT
```

| `mtls.mode` | Meaning |
|---|---|
| `UNSET` | Inherits from the parent (namespace, then mesh); if nothing is set, behaves as PERMISSIVE |
| `PERMISSIVE` | Accepts both mTLS and plain text; the default, used for gradual migration |
| `STRICT` | Accepts **only** mTLS; a client without a proxy is rejected |
| `DISABLE` | No mTLS (ambient doesn't support it) |

Policy scope:

- In the mesh's **root namespace** (`istio-system` by default) without a selector: applies to the whole mesh.
- In an ordinary namespace without `selector`: applies to all workloads in that namespace.
- With `selector.matchLabels`: only to the selected workloads; then you can add `portLevelMtls` per container port.

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: db
  namespace: payments
spec:
  selector:
    matchLabels:
      app: db
  mtls:
    mode: STRICT
  portLevelMtls:
    9090:
      mode: PERMISSIVE     # e.g. metrics scraped by Prometheus without a proxy
```

Verification: from a Pod **without** a proxy (a namespace without injection) call a service in the STRICT namespace. The request must fail; from a Pod with a proxy it must succeed.

```bash
kubectl -n legacy exec deploy/curl -- curl -s -o /dev/null -w "%{http_code}\n" http://api.payments:8080/
# 000
# command terminated with exit code 56
kubectl -n payments exec deploy/curl -c curl -- curl -s -o /dev/null -w "%{http_code}\n" http://api.payments:8080/
# 200
kubectl get peerauthentication -A
```

> **On the exam:** for Istio tasks look for a PeerAuthentication example in the Istio documentation (if it is on the list of allowed resources) or write it from memory: four lines under `spec`. The most common traps are a wrong `apiVersion` (`security.istio.io/v1`, older versions `v1beta1`) and a policy in the wrong namespace.

### When to use what

- You only need nobody on the network to read the traffic, without new components: **Cilium WireGuard** (if Cilium is already the CNI).
- You need service identity, authorization like "only frontend may call api" and L7 policies: **Istio mTLS** with `AuthorizationPolicy`.
- Migrating existing applications into the mesh: start with `PERMISSIVE`, watch whether anyone sends plain text, then move to `STRICT`.
- Neither approach replaces NetworkPolicy: encryption hides the content, but doesn't restrict who talks to whom.

## Troubleshooting

| Symptom | What to check |
|---|---|
| A Pod with `runtimeClassName` doesn't start | `kubectl describe pod`, `kubectl get runtimeclass`, the handler in `/etc/containerd/config.toml` on the node where the Pod was scheduled |
| `dmesg` in the Pod doesn't show gVisor | The Pod wasn't recreated after the change, or the Deployment doesn't have the field in `spec.template.spec` |
| A Pod rejected because of the quota | `kubectl describe quota -n X`; add `resources.requests` or a LimitRange |
| The team's Pods don't go to the dedicated node | The toleration exists, but the `nodeSelector`/affinity is missing |
| Cilium `Encryption: Disabled` | The Helm values weren't applied; `helm get values cilium -n kube-system`; restart the agents |
| After STRICT some clients get `connection reset` | The client has no proxy (isn't in the mesh); add injection or temporarily PERMISSIVE |
| A Pod in the mesh has READY 1/1 | The namespace doesn't have the injection label or the Pod wasn't restarted |

> **On the exam:** before every task run the `kubectl config use-context` from the task text. RuntimeClass tasks often use another cluster where gVisor is installed on only one node, so always look at `scheduling` or the node labels.

## Summary

- A namespace is a soft boundary; real tenant isolation = namespace + RBAC + NetworkPolicy default deny + ResourceQuota/LimitRange + PSA restricted + dedicated nodes if needed (taint + nodeSelector).
- gVisor (`runsc`) intercepts syscalls in a user-space kernel, Kata runs the Pod in a lightweight VM; both reduce the risk of escaping through the host kernel.
- RuntimeClass (`node.k8s.io/v1`, not namespaced) links a name to a containerd handler (`handler: runsc`); the Pod selects it with `spec.runtimeClassName`.
- You prove the Pod runs in gVisor with `dmesg` ("Starting gVisor…") and a `uname -r` that differs from the node.
- Cilium encrypts traffic between nodes with `encryption.enabled=true` and `encryption.type=wireguard|ipsec`; check with `cilium-dbg status | grep Encryption` or `cilium encryption status`.
- Istio mTLS is locked down with a PeerAuthentication `mode: STRICT` (namespace, or the root namespace for the whole mesh); PERMISSIVE also accepts plain text.
- Encryption doesn't replace NetworkPolicy, and a sandbox doesn't replace securityContext: the layers add up.
