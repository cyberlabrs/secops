## What this module covers

This module belongs to domain 1 (**Cluster Architecture, Installation & Configuration**, 25% of the exam) and covers two objectives:

- **1.2** preparing the infrastructure for a cluster installation (node, kernel, container runtime, cgroup driver, swap),
- **1.7** understanding the extension interfaces: **CRI** (Container Runtime Interface), **CNI** (Container Network Interface) and **CSI** (Container Storage Interface).

As a Kubernetes user you have so far seen only the API: `kubectl apply` and the result. Here we look at what sits behind the API: which processes run on which node, who starts the containers and where the configuration files live. The exam rarely asks about this directly, but it is the foundation for almost every troubleshooting task (30% of the exam). Typical tasks:

- "The kubelet on node `node01` is not running. Fix it."
- "Create a static Pod `nginx-static` on node `node01`."
- "Find out which CNI plugin is installed and write the name of its configuration file to `/opt/answer.txt`."
- "Using `crictl`, find the container that keeps crashing and save its log."
- "Prepare the node for installation: enable IP forwarding and load the required modules."

## Cluster components

A cluster has a **control plane** and **worker** nodes. In a kubeadm cluster the control plane components run as **static Pods** on the control plane node, while the kubelet and the container runtime run as regular **systemd** services on every node.

| Component | Where it runs | What it does | How you see it |
|---|---|---|---|
| **kube-apiserver** | control plane | The only entry point into the cluster; authentication, authorization, admission, writes to etcd | `kubectl -n kube-system get pod kube-apiserver-controlplane` |
| **etcd** | control plane (stacked) or separate nodes | Key-value store; the only place where cluster state is kept | `etcd-controlplane` Pod |
| **kube-scheduler** | control plane | Picks a node for a Pod that has no `spec.nodeName` | `kube-scheduler-controlplane` |
| **kube-controller-manager** | control plane | Controller loops (Deployment, ReplicaSet, Node, ServiceAccount tokens…) | `kube-controller-manager-controlplane` |
| **kubelet** | every node | Runs Pods through the CRI, reports node status, runs static Pods | `systemctl status kubelet` |
| **kube-proxy** | every node (DaemonSet) | Rules for Service VIPs (iptables or nftables) | `kubectl -n kube-system get ds kube-proxy` |
| **container runtime** | every node | Pulls images and runs containers (containerd) | `systemctl status containerd` |
| **CoreDNS** | Deployment in `kube-system` | DNS for Service and Pod names | `kubectl -n kube-system get deploy coredns` |

The key thing to remember: **the kubelet is not a Pod**. If the kubelet stops, the node goes `NotReady`, and `kubectl` cannot help you start it again. You have to log in to the node (`ssh node01`) and use `systemctl` and `journalctl`.

```bash
kubectl get nodes -o wide                 # kubelet version, runtime, internal IP
kubectl -n kube-system get pods -o wide   # static Pods have the node name as a suffix
kubectl get --raw='/readyz?verbose'       # API server health, check by check
```

> **On the exam:** Every task starts with a `kubectl config use-context <name>` command given in the task text. Copy it and run it before anything else. A solution done on the wrong cluster scores zero.

## kubelet

The **kubelet** is the agent on every node. It receives Pod specs from the API server (and from a local directory for static Pods) and asks the runtime, through the CRI, to run them.

Files you need to know on a kubeadm node:

| File | Contents |
|---|---|
| `/var/lib/kubelet/config.yaml` | **KubeletConfiguration**: `staticPodPath`, `cgroupDriver`, `clusterDNS`, `failSwapOn`… |
| `/etc/kubernetes/kubelet.conf` | the kubeconfig the kubelet uses to authenticate to the API server |
| `/var/lib/kubelet/kubeadm-flags.env` | extra flags written by kubeadm (e.g. `--node-ip`) |
| `/usr/lib/systemd/system/kubelet.service.d/10-kubeadm.conf` | the systemd drop-in that ties all of the above together |
| `/var/lib/kubelet/pki/` | the kubelet client certificate (rotated automatically) |

```bash
ssh node01
systemctl status kubelet
journalctl -u kubelet --no-pager | tail -30
systemctl cat kubelet          # shows the unit and drop-in files
cat /var/lib/kubelet/config.yaml
```

After changing `config.yaml` or a drop-in file:

```bash
systemctl daemon-reload        # only if you changed the unit/drop-in
systemctl restart kubelet
```

### Troubleshooting the kubelet

| Symptom in `journalctl -u kubelet` | Cause | Fix |
|---|---|---|
| `failed to load kubelet config file` | Wrong path or a YAML error in `config.yaml` | Fix the file, `systemctl restart kubelet` |
| A message saying swap is not supported (`swap on is not supported`) | Swap is on and `failSwapOn` is `true` | `swapoff -a` and remove swap from `/etc/fstab` |
| `connect: connection refused` to `:6443` | The API server is down or `kubelet.conf` has the wrong server | Check the API server and the address in the kubeconfig |
| `x509: certificate has expired` | Expired certificate | See the lifecycle module (certificates) |
| An error mentioning the cgroup driver (`systemd` vs `cgroupfs`) | The kubelet and runtime cgroup drivers do not match | Align `cgroupDriver` and `SystemdCgroup` |
| The service is `inactive (dead)` and `disabled` | Someone stopped it | `systemctl enable --now kubelet` |

> **On the exam:** When a node is `NotReady`, first `ssh` to it and run `systemctl status kubelet`. If it is `inactive`, the configuration is not necessarily broken: often `systemctl enable --now kubelet` is enough. Always add `enable` so it survives a reboot.

## Static Pods

A **static Pod** is a Pod that the kubelet runs directly from a YAML file on disk, without the scheduler and without controllers. For every static Pod the kubelet creates a **mirror Pod** in the API server, so you see it in `kubectl get pods`, but you cannot permanently delete it through the API: the kubelet brings it right back. The mirror Pod name is `<name>-<node-name>`.

The directory is set by the `staticPodPath` field in the kubelet configuration. With kubeadm it is `/etc/kubernetes/manifests`:

```bash
grep staticPodPath /var/lib/kubelet/config.yaml
# staticPodPath: /etc/kubernetes/manifests
ls /etc/kubernetes/manifests
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```

Creating a static Pod on `node01`:

```bash
kubectl run nginx-static --image=nginx:1.27 --dry-run=client -o yaml > nginx-static.yaml
scp nginx-static.yaml node01:/tmp/
ssh node01
grep staticPodPath /var/lib/kubelet/config.yaml   # check the path, it may have been changed!
cp /tmp/nginx-static.yaml /etc/kubernetes/manifests/
exit
kubectl get pod nginx-static-node01
```

Rules to remember:

- The kubelet watches the directory periodically; there is no `kubectl apply`. Changing the file = the kubelet recreates the Pod.
- **Deleting** a static Pod = deleting the file from the directory. `kubectl delete pod` only removes the mirror Pod temporarily.
- A static Pod spec must not reference other API objects (ConfigMap, Secret, ServiceAccount): the kubelet creates it even when the API server is down. That is why the control plane uses `hostPath` volumes.
- Static Pods are not scheduled by the scheduler. They run even when the scheduler is down, which is how the control plane can bring itself up.

> **On the exam:** When a task says "create a static Pod on node X", do not assume the path. Look at `staticPodPath` in `/var/lib/kubelet/config.yaml` on that node. The task may deliberately use a different directory.

### How to fix a broken control plane

If someone breaks `/etc/kubernetes/manifests/kube-apiserver.yaml` (wrong flag, wrong certificate path), `kubectl` stops working. Then:

```bash
crictl ps -a | grep kube-apiserver        # does the container exist and keep crashing?
crictl logs <container-id>                # the error message
journalctl -u kubelet | grep -i apiserver # can the kubelet not even parse the YAML?
ls /var/log/pods/ | grep apiserver        # logs remain even after the container is gone
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

Before editing, make a copy **outside** the manifests directory (`cp kube-apiserver.yaml /root/kube-apiserver.yaml.bak`). A copy in the same directory would start as a second static Pod.

## CRI, containerd and crictl

The **CRI** is the gRPC interface between the kubelet and the container runtime. The kubelet knows nothing about containerd or CRI-O, only about the CRI socket. Docker Engine is not a CRI runtime; since **dockershim** was removed (v1.24) you need containerd, CRI-O or `cri-dockerd`.

| Runtime | CRI socket (Linux) |
|---|---|
| containerd | `unix:///run/containerd/containerd.sock` |
| CRI-O | `unix:///var/run/crio/crio.sock` |
| Docker Engine + cri-dockerd | `unix:///var/run/cri-dockerd.sock` |

In the lab environment and on the exam the runtime is **containerd**. Its configuration is in `/etc/containerd/config.toml`.

Important for 1.35: this is the **last version that supports containerd 1.7**. From the next version on you need containerd 2.x. In addition, 1.35 drops support for **cgroup v1**: on distributions without cgroup v2 the kubelet will not start by default.

### crictl

**crictl** is the CLI for the CRI. It works with any CRI runtime and sees exactly what the kubelet sees. You use it when the API server is down or when you need details from the node itself.

```bash
cat /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock

crictl pods                         # pod sandboxes on the node
crictl ps                           # running containers
crictl ps -a                        # including exited ones (CrashLoop!)
crictl ps --name kube-apiserver     # filter by name
crictl logs <container-id>          # container log
crictl logs --tail 20 <container-id>
crictl inspect <container-id>       # JSON details: mounts, exit code
crictl images                       # images on the node
crictl pull busybox:1.36
crictl rmi <image-id>
crictl stats                        # resource usage
```

| Tool | Level | When you use it |
|---|---|---|
| `kubectl` | Kubernetes API | Normal work, API server reachable |
| `crictl` | CRI (the kubelet's view) | Debugging on a node, API server down |
| `ctr` | containerd internals (namespace `k8s.io`) | Rarely; low level, knows nothing about Pods |

> **On the exam:** `crictl ps` shows only running containers. A container that keeps crashing only shows up with `crictl ps -a`. Tasks like "write down the ID of the crashing container" are asking for exactly that.

## CNI

The **CNI** defines how the runtime attaches a network to a Pod sandbox. When the kubelet creates a Pod, containerd calls the CNI plugin, which creates a network interface in the Pod namespace and assigns it an IP.

Two locations you must know:

| Path | What is there |
|---|---|
| `/etc/cni/net.d/` | Configuration (`*.conf` or `*.conflist`). The **first file in alphabetical order** is used. |
| `/opt/cni/bin/` | Plugin executables (`bridge`, `host-local`, `loopback`, `portmap`, plus the CNI's own plugin) |

```bash
ls /etc/cni/net.d/
# 10-kindnet.conflist   (in the lab)
cat /etc/cni/net.d/10-kindnet.conflist | head -20
ls /opt/cni/bin/
kubectl -n kube-system get ds         # the CNI agent usually runs as a DaemonSet
```

A CNI plugin on its own only sets up networking for a single Pod. Projects like Calico, Cilium, Flannel or kindnet add a **DaemonSet** that writes the configuration to every node, copies the binaries and maintains routes between nodes.

| CNI | NetworkPolicy | Note |
|---|---|---|
| Flannel | No | Simple overlay (VXLAN), default CIDR `10.244.0.0/16` |
| Calico | Yes | BGP or overlay, a common production choice |
| Cilium | Yes | eBPF, can replace kube-proxy |
| kindnet | Yes (in newer versions) | The CNI in this course's lab |

### Troubleshooting the CNI

- The node is `NotReady` and `kubectl describe node` shows `NetworkReady=false` and `cni plugin not initialized`: there is no configuration in `/etc/cni/net.d/`. The CNI is not installed or its DaemonSet is not running on that node.
- A Pod hangs in `ContainerCreating` and the event says `failed to setup network for sandbox`: check that the plugin named in the configuration exists in `/opt/cni/bin/`, and check the logs of the CNI DaemonSet Pod on that node.
- Pods on different nodes cannot reach each other: compare the `--pod-network-cidr` used at installation with the CIDR in the CNI configuration; they must match.

> **On the exam:** You answer "which CNI is installed" with `ls /etc/cni/net.d/` and `kubectl -n kube-system get ds`. Do not search `/etc/kubernetes`; the CNI has no configuration there.

## CSI

The **CSI** is the standard interface for storage drivers. Before CSI, the code for each storage system was built into Kubernetes ("in-tree"); today those drivers have been migrated to CSI, and new ones exist only as CSI drivers.

A CSI driver typically consists of:

- a **controller plugin** (Deployment or StatefulSet): creates and deletes volumes in the storage system, with sidecar containers such as `external-provisioner`, `external-attacher`, `external-resizer`, `external-snapshotter`;
- a **node plugin** (DaemonSet): mounts the volume on the node; the `node-driver-registrar` sidecar registers it with the kubelet.

```bash
kubectl get csidrivers           # registered CSI drivers
kubectl get csinodes             # which drivers are available on which node
kubectl get storageclass         # the PROVISIONER field says who creates volumes
kubectl get volumeattachments    # CSI driver attach operations
```

In the lab, the `local-path` StorageClass uses the rancher local-path provisioner. It is not a CSI driver but a plain controller that creates `hostPath`/`local` PersistentVolumes. That is why `kubectl get csidrivers` may be empty in the lab even though dynamic volume provisioning works.

### Comparing the interfaces

| Interface | Who calls it | Implementations | Configuration on the node |
|---|---|---|---|
| **CRI** | kubelet | containerd, CRI-O | `/etc/containerd/config.toml`, `/etc/crictl.yaml` |
| **CNI** | container runtime (when creating the sandbox) | Calico, Cilium, Flannel, kindnet | `/etc/cni/net.d/`, `/opt/cni/bin/` |
| **CSI** | kubelet (node part) and CSI controllers | EBS CSI, Ceph CSI, NFS CSI | Sockets in `/var/lib/kubelet/plugins/` |

For completeness: the **Device plugin** API (GPUs) and the **CRD + operator** pattern (module 5) are also extension mechanisms, and neither requires changing Kubernetes code.

## Node preparation (objective 1.2)

Before `kubeadm init` or `kubeadm join`, every node must meet the prerequisites. kubeadm checks most of them in the **preflight** phase and aborts if something is missing.

### 1. Swap

By default the kubelet refuses to start if swap is enabled (`failSwapOn: true`). The simplest option is to disable swap:

```bash
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab     # permanently
free -h                                  # Swap: 0B
```

The alternative is `failSwapOn: false` in the KubeletConfiguration. The kubelet then tolerates swap, but Pods still do not use it until you set `swapBehavior` (default `NoSwap`).

### 2. Kernel modules and sysctl

The Kubernetes documentation today strictly requires only IPv4 forwarding. Most guides and CNIs also add the `overlay` module (for the overlayfs that containerd uses) and `br_netfilter` (so traffic crossing a Linux bridge goes through iptables).

```bash
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
modprobe overlay
modprobe br_netfilter

cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.ipv4.ip_forward = 1
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
EOF
sysctl --system

sysctl net.ipv4.ip_forward               # must be 1
lsmod | grep -E 'overlay|br_netfilter'
```

The `net.bridge.*` sysctls exist only once `br_netfilter` is loaded. If `sysctl --system` reports "No such file or directory" for those keys, load the module first.

### 3. Container runtime and cgroup driver

The kubelet and the runtime must use the **same cgroup driver**. On systemd-based systems with **cgroup v2** the recommendation is `systemd`. Since v1.22 kubeadm sets `cgroupDriver: systemd` in the KubeletConfiguration by default, so usually you only need to configure containerd:

```bash
containerd config default > /etc/containerd/config.toml
grep -n SystemdCgroup /etc/containerd/config.toml
```

```toml
# containerd 2.x
[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc.options]
  SystemdCgroup = true

# containerd 1.7 (old format)
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
  SystemdCgroup = true
```

```bash
systemctl restart containerd
systemctl enable --now containerd
stat -fc %T /sys/fs/cgroup/      # cgroup2fs = cgroup v2
```

With newer containerd (2.x) the kubelet can read the cgroup driver from the runtime itself via the CRI (`KubeletCgroupDriverFromCRI`). With containerd 1.7 this does not work and the value from the kubelet configuration applies, so you still need to understand how to keep them aligned.

> **On the exam:** Do not change the cgroup driver on a node that is already in the cluster unless the task explicitly asks for it. Existing Pods may stop starting; the recommended path is to re-add the node.

### 4. Packages and ports

The `kubeadm`, `kubelet` and `kubectl` packages come from the **pkgs.k8s.io** repositories, where each minor version has its own repository (`https://pkgs.k8s.io/core:/stable:/v1.35/deb/`). After installation they are "frozen" with `apt-mark hold kubelet kubeadm kubectl` so that `apt upgrade` does not upgrade them by accident.

Control plane ports: `6443` (API server), `2379-2380` (etcd), `10250` (kubelet API), `10257` (controller-manager), `10259` (scheduler). Worker: `10250`, `10256` (kube-proxy health) and the NodePort range `30000-32767`.

```bash
ss -tlnp | grep -E '6443|2379|10250'
nc -zv controlplane 6443
```

## kubectl and kubeconfig

A **kubeconfig** file has three lists: **clusters** (API server address and CA), **users** (credentials) and **contexts** (a cluster + user + default namespace pair). The `current-context` field says which context is active.

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context kubernetes-admin@kubernetes
kubectl config set-context --current --namespace=dev   # change the default namespace
kubectl config view --minify                           # active context only
kubectl --kubeconfig /etc/kubernetes/admin.conf get nodes
```

Precedence: the `--kubeconfig` flag, then the `KUBECONFIG` variable (can be a list of files joined with `:`), then `~/.kube/config`.

On the control plane node kubeadm creates several kubeconfig files in `/etc/kubernetes/`:

| File | Who uses it |
|---|---|
| `admin.conf` | the administrator (group `kubeadm:cluster-admins`) |
| `super-admin.conf` | break-glass access, `system:masters`; do not share it |
| `controller-manager.conf`, `scheduler.conf` | the corresponding components |
| `kubelet.conf` | the kubelet on that node |

Handy shortcuts for speed:

```bash
alias k=kubectl                                  # already present in the lab
export do="--dry-run=client -o yaml"
k run test --image=busybox:1.36 $do -- sleep 3600 > pod.yaml
k explain pod.spec.containers.securityContext
k explain deployment.spec.strategy --recursive
k get pods -A --field-selector spec.nodeName=node01
```

> **On the exam:** `kubectl explain <resource>.<field>` is faster than searching the documentation when you forget the exact field name. For a full manifest use `--dry-run=client -o yaml` and then refine it in vim.

## Troubleshooting: quick reference

| Problem | Where to look |
|---|---|
| Node `NotReady` | `kubectl describe node` (Conditions), `ssh` to the node, `systemctl status kubelet`, `journalctl -u kubelet` |
| `kubectl` does not work (connection refused) | `crictl ps -a \| grep apiserver`, `crictl logs`, `/etc/kubernetes/manifests/kube-apiserver.yaml` |
| Pod in `ContainerCreating` with a network error | `/etc/cni/net.d/`, `/opt/cni/bin/`, the CNI DaemonSet |
| Pod `Pending`, nothing gets scheduled | the `kube-scheduler` Pod in `kube-system` |
| A Deployment does not create Pods | the `kube-controller-manager` Pod |
| An image cannot be pulled on a node | `crictl pull <image>` on the node, `journalctl -u containerd` |

## Summary

- With kubeadm, the control plane (kube-apiserver, etcd, scheduler, controller-manager) runs as static Pods from `/etc/kubernetes/manifests`; the kubelet and containerd are systemd services.
- The kubelet creates a static Pod from a file in `staticPodPath` (see `/var/lib/kubelet/config.yaml`); you delete it by removing the file, not with `kubectl delete`.
- You debug the kubelet on the node: `systemctl status kubelet`, `journalctl -u kubelet`, `systemctl enable --now kubelet`.
- `crictl` speaks CRI and works even when the API server is down; `crictl ps -a` and `crictl logs` are the basic tools.
- CNI configuration is in `/etc/cni/net.d/`, plugin binaries in `/opt/cni/bin/`; without them the node stays `NotReady`.
- A CSI driver has a controller part (provisioning) and a node part (a DaemonSet for mounting); `kubectl get csidrivers,csinodes`.
- Node preparation: swap off, `net.ipv4.ip_forward=1`, the `overlay` and `br_netfilter` modules, containerd with `SystemdCgroup = true`, packages from pkgs.k8s.io and `apt-mark hold`.
- Always switch the context with `kubectl config use-context` before a task.
