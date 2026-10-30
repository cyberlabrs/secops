## What this module covers

This module belongs to domain 1 (**Cluster Architecture, Installation & Configuration**, 25% of the exam) and covers:

- **1.2** preparing the infrastructure (here: preflight checks and what kubeadm expects from a node; node preparation details are in the previous module),
- **1.3** creating and managing a cluster with **kubeadm** (`init`, `join`, tokens, `reset`),
- **1.5** a highly available (**HA**) control plane: topologies, load balancer, adding control plane nodes.

On the exam you get nodes with the runtime and packages already installed, and the task is to bring up or extend a cluster. Typical tasks:

- "Initialize the cluster on `controlplane` with Pod CIDR `10.244.0.0/16` and install the CNI from `/opt/...`."
- "Add `node01` to the cluster." (the token has expired, you need a new one)
- "Write the command for joining an additional control plane node to `/opt/answer.sh`."
- "Node `node01` must be removed from the cluster and cleaned up."

You cannot build an HA cluster with three control plane nodes on the exam (there are not enough machines), but you must understand the concepts and commands because they show up in questions and in "prepare the command" tasks.

## How kubeadm works

**kubeadm** brings up a control plane on an existing Linux node. It does not install packages, the runtime or the CNI, it does not create machines and it does not configure a load balancer. It does three things:

1. generates the PKI (CA and certificates) in `/etc/kubernetes/pki/` and kubeconfig files in `/etc/kubernetes/`,
2. writes the control plane static Pod manifests to `/etc/kubernetes/manifests/` and waits for the kubelet to start them,
3. installs addons (CoreDNS and kube-proxy) through the API and creates a bootstrap token for joining nodes.

The work is split into **phases**. `kubeadm init` runs them all in order, but you can also run a single phase:

| Phase | What it does |
|---|---|
| `preflight` | Checks: swap, ports, `ip_forward`, CRI socket, versions |
| `certs` | CA, apiserver, etcd, front-proxy certificates, `sa.key`/`sa.pub` |
| `kubeconfig` | `admin.conf`, `super-admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf` |
| `etcd` / `control-plane` | Static Pod manifests |
| `kubelet-start` | Writes `/var/lib/kubelet/config.yaml` and starts the kubelet |
| `upload-config` | The `kubeadm-config` and `kubelet-config` ConfigMaps in `kube-system` |
| `upload-certs` | (only with `--upload-certs`) encrypted certificates in the `kubeadm-certs` Secret |
| `mark-control-plane` | The `node-role.kubernetes.io/control-plane:NoSchedule` label and taint |
| `bootstrap-token` | Token and RBAC for join |
| `addon` | CoreDNS and kube-proxy |

```bash
kubeadm init phase upload-certs --upload-certs   # example of a single phase
kubeadm init --skip-phases=addon/kube-proxy      # e.g. when Cilium replaces kube-proxy
```

## kubeadm init with flags

The shortest path on the exam:

```bash
kubeadm init \
  --kubernetes-version=v1.35.0 \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.1.10 \
  --node-name=controlplane
```

The most important flags:

| Flag | Meaning | Default |
|---|---|---|
| `--pod-network-cidr` | Range for Pod IPs; the controller-manager carves a per-node `podCIDR` out of it | none |
| `--service-cidr` | Range for ClusterIP Services | `10.96.0.0/12` |
| `--apiserver-advertise-address` | The IP the API server listens on and advertises | IP of the default interface |
| `--control-plane-endpoint` | Stable address (DNS/IP and port) of the control plane, for HA | none |
| `--kubernetes-version` | Control plane version | `stable-1` |
| `--cri-socket` | Runtime socket, when there are several | auto-detected |
| `--upload-certs` | Uploads control plane certificates to the cluster for HA join | off |
| `--token-ttl` | Bootstrap token lifetime | `24h0m0s` |
| `--ignore-preflight-errors` | E.g. `Swap,NumCPU`; `all` ignores everything | none |
| `--config` | YAML configuration instead of flags | none |
| `--dry-run` | Shows what it would do, without changes | — |

When `init` succeeds it prints three important things: how to set up the kubeconfig, that you need to install a Pod network, and the `kubeadm join` command. Copy them.

```bash
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
kubectl get nodes        # controlplane is NotReady until you install a CNI
```

> **On the exam:** If the task specifies a Pod CIDR, it must be the same in `kubeadm init --pod-network-cidr` and in the CNI configuration. Flannel expects `10.244.0.0/16` by default. A wrong CIDR is not easy to fix: the fastest way is `kubeadm reset` and a fresh `init`.

## The kubeadm configuration file (v1beta4)

For anything not covered by flags (extra API server arguments, kubelet settings, certificate validity) you use a configuration file. The current API version is **`kubeadm.k8s.io/v1beta4`**. One file contains several YAML documents separated by `---`:

| kind | Scope |
|---|---|
| **InitConfiguration** | This node: `nodeRegistration` (name, `criSocket`, taints), `localAPIEndpoint`, `bootstrapTokens` |
| **ClusterConfiguration** | The whole cluster: version, `controlPlaneEndpoint`, `networking`, `etcd`, `apiServer`, `certificateValidityPeriod` |
| **JoinConfiguration** | For `kubeadm join --config` |
| **KubeletConfiguration** (`kubelet.config.k8s.io/v1beta1`) | The kubelet on all nodes |
| **KubeProxyConfiguration** (`kubeproxy.config.k8s.io/v1alpha1`) | kube-proxy |
| **UpgradeConfiguration**, **ResetConfiguration** | For `kubeadm upgrade` and `kubeadm reset` |

Example (similar to the one the lab uses in `/etc/kurs/kubeadm-init.yaml`):

```yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: InitConfiguration
nodeRegistration:
  name: controlplane
  criSocket: unix:///run/containerd/containerd.sock
---
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: v1.35.0
controlPlaneEndpoint: controlplane:6443
networking:
  podSubnet: 10.244.0.0/16
  serviceSubnet: 10.96.0.0/12
apiServer:
  extraArgs:
    - name: audit-log-maxage
      value: "30"
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cgroupDriver: systemd
```

The difference from the old v1beta3: **`extraArgs` is a list of `name`/`value` objects**, not a `key: value` map. The name is the flag without dashes. The old form (a map) with `apiVersion: kubeadm.k8s.io/v1beta4` is invalid; you convert an existing file with `kubeadm config migrate`.

```bash
kubeadm config print init-defaults > init.yaml          # skeleton with all fields
kubeadm config print init-defaults --component-configs KubeletConfiguration
kubeadm config validate --config init.yaml
kubeadm config migrate --old-config old.yaml --new-config new.yaml   # v1beta3 -> v1beta4
kubeadm init --config init.yaml
kubeadm config images list --kubernetes-version v1.35.0
```

Note: `--config` cannot be combined with most flags such as `--pod-network-cidr` or `--certificate-key`. Everything goes into the file.

After installation kubeadm stores the ClusterConfiguration in the `kubeadm-config` ConfigMap in `kube-system`. `kubeadm join` and `kubeadm upgrade` read it from there:

```bash
kubectl -n kube-system get cm kubeadm-config -o yaml
kubectl -n kube-system get cm kubelet-config -o yaml
```

> **On the exam:** You can find a configuration example in the documentation under "kubeadm Configuration (v1beta4)" (kubernetes.io/docs/reference/config-api/kubeadm-config.v1beta4/). Still, it is faster to run `kubeadm config print init-defaults` and delete what you do not need.

## Installing the CNI

Without a CNI, nodes stay `NotReady` and CoreDNS Pods stay `Pending`. The CNI is installed as a regular manifest or a Helm chart:

```bash
kubectl apply -f /opt/kurs/manifests/kube-flannel.yaml
kubectl -n kube-flannel get ds,pods -o wide
kubectl get nodes -w                   # NotReady -> Ready
ls /etc/cni/net.d/                     # 10-flannel.conflist
```

The exam only allows the kubernetes.io and helm.sh documentation, so the task always tells you where to install the CNI from if it is not provided locally. The lab cluster uses kindnet by default; the Flannel manifest is there for practicing an installation from scratch.

Checking that networking works:

```bash
kubectl -n kube-system get pods -l k8s-app=kube-dns    # CoreDNS Running
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDR}{"\n"}{end}'
kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- nslookup kubernetes.default
```

## kubeadm join: worker node

A join needs:

- a **bootstrap token** (format `abcdef.0123456789abcdef`), valid for 24h,
- the **CA public key hash** (`--discovery-token-ca-cert-hash sha256:...`) so the new node can verify it is talking to the right cluster,
- the API server address (or `controlPlaneEndpoint`).

When the original token has expired, you get everything with one command on the control plane node:

```bash
kubeadm token list
kubeadm token create --print-join-command
# kubeadm join controlplane:6443 --token 8x2k1q.... --discovery-token-ca-cert-hash sha256:3f1c...
```

Then on the worker:

```bash
ssh node01
kubeadm join controlplane:6443 --token 8x2k1q.xxxxxxxxxxxxxxxx \
  --discovery-token-ca-cert-hash sha256:3f1c...
exit
kubectl get nodes
```

What join does on the worker: kubelet TLS bootstrap (a CSR that is approved automatically), writing `/etc/kubernetes/kubelet.conf` and `/var/lib/kubelet/config.yaml` (from the `kubelet-config` ConfigMap), and starting the kubelet. There is no `admin.conf` on the worker, so `kubectl` does not work there unless you copy a kubeconfig.

You can also compute the hash by hand if you need to write it down:

```bash
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | \
  openssl rsa -pubin -outform der 2>/dev/null | \
  openssl dgst -sha256 -hex | sed 's/^.* //'
```

> **On the exam:** Run `kubeadm token create --print-join-command` on the control plane node and the printed command on the worker (via `ssh node01`). A common mistake is running the join on the controlplane node, where preflight reports that the files already exist.

### Troubleshooting join

| Error | Cause | Fix |
|---|---|---|
| `could not find a JWS signature in the cluster-info ConfigMap for token ID` | The token has expired or does not exist | `kubeadm token create --print-join-command` |
| `couldn't validate the identity of the API Server` / hash mismatch | Wrong `--discovery-token-ca-cert-hash` | Get a new join command |
| `[ERROR FileAvailable--etc-kubernetes-kubelet.conf]` | The node was already in a cluster | `kubeadm reset -f` on the node, then join |
| `connection refused` / timeout on 6443 | Network, firewall or wrong address | `nc -zv controlplane 6443` |
| Join succeeds, node stays `NotReady` | The CNI DaemonSet is not running on the new node | `kubectl -n <cni-ns> get pods -o wide` |

## kubeadm join: additional control plane node (HA)

Three conditions apply to an additional control plane node:

1. The cluster was initialized with **`controlPlaneEndpoint`** (flag `--control-plane-endpoint`). Without a stable shared address you cannot add a second control plane, and changing it afterwards is complicated.
2. The new node must get the same CA and other shared keys (`ca.key`, `sa.key`, `front-proxy-ca.key`, `etcd/ca.key`). Either you copy them by hand or you use **`--upload-certs`**.
3. The join is run with `--control-plane` and `--certificate-key`.

The flow with automatic certificate sharing:

```bash
# on the first control plane node
kubeadm init --control-plane-endpoint "k8s-api.lab.local:6443" --upload-certs \
  --pod-network-cidr=10.244.0.0/16
# the output contains two join commands: for control plane (with --certificate-key) and for worker
```

The certificates in the `kubeadm-certs` Secret are encrypted with a key (`certificate-key`) and **are deleted after two hours**. You upload them again later:

```bash
kubeadm init phase upload-certs --upload-certs
# [upload-certs] Using certificate key:
# 7c4d...e91a
kubeadm token create --print-join-command --certificate-key 7c4d...e91a
```

On the new control plane node:

```bash
kubeadm join k8s-api.lab.local:6443 --token 8x2k1q.xxxxxxxxxxxxxxxx \
  --discovery-token-ca-cert-hash sha256:3f1c... \
  --control-plane --certificate-key 7c4d...e91a
```

`kubeadm certs certificate-key` generates a new key if you want to set it in advance. After adding control plane nodes, `kubectl -n kube-system rollout restart deployment coredns` is useful so CoreDNS is spread across the nodes.

## HA topologies

| | **Stacked etcd** | **External etcd** |
|---|---|---|
| Where etcd runs | On every control plane node, as a static Pod | On separate machines |
| Number of machines (min.) | 3 control plane | 3 control plane + 3 etcd |
| Risk | Losing a node = losing both an API server and an etcd member | Separate failure domains |
| Setup | Automatic (kubeadm default) | `etcd.external` in ClusterConfiguration |
| When | Most clusters, simpler | Large clusters, stricter requirements |

**etcd quorum**: a cluster of `n` members works as long as `n/2 + 1` members are available. With 3 members it survives losing one, with 5 losing two. An even number adds no resilience (4 members still tolerate only one failure), which is why an odd number is used.

External etcd in the configuration:

```yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: v1.35.0
controlPlaneEndpoint: "k8s-api.lab.local:6443"
etcd:
  external:
    endpoints:
      - https://10.0.0.21:2379
      - https://10.0.0.22:2379
      - https://10.0.0.23:2379
    caFile: /etc/kubernetes/pki/etcd/ca.crt
    certFile: /etc/kubernetes/pki/apiserver-etcd-client.crt
    keyFile: /etc/kubernetes/pki/apiserver-etcd-client.key
```

### Load balancer in front of the API server

- All kubelets, kube-proxy and users talk to the `controlPlaneEndpoint`, not to an individual node. The load balancer (HAProxy, keepalived + HAProxy, kube-vip or a cloud LB) forwards TCP to port `6443` on all control plane nodes.
- The health check is a TCP check of the API server port.
- It is best to set `controlPlaneEndpoint` as a **DNS name**: you can later change the LB without issuing new certificates. The name is in the SAN list of the API server certificate.
- The controller-manager and scheduler run on every control plane node, but only one is active thanks to **leader election** (Lease objects in `kube-system`).

```bash
kubectl -n kube-system get lease kube-scheduler kube-controller-manager
kubectl -n kube-system get pods -l component=etcd -o wide
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -ext subjectAltName
```

> **On the exam:** The question "why can't I add a second control plane" almost always has the same answer: the cluster was not initialized with `--control-plane-endpoint`, or the `--upload-certs` certificates have expired (2h). Workers do not need the certificates.

## kubeadm reset and removing a node

Removing a worker cleanly:

```bash
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data
kubectl delete node node01
ssh node01
kubeadm reset -f
```

`kubeadm reset` reverts what `init` or `join` did: it stops the kubelet's Pods and deletes `/etc/kubernetes/` (manifests, PKI, kubeconfig files), the local etcd data dir and the kubelet data. On a control plane node with stacked etcd it tries to remove the local etcd member from the cluster.

What `reset` does **not** clean up (it prints a warning):

```bash
rm -rf /etc/cni/net.d                     # CNI configuration
iptables -F && iptables -t nat -F && iptables -X   # or nft flush ruleset
ipvsadm --clear                           # if kube-proxy was in IPVS mode
rm -f $HOME/.kube/config
```

Leftover CNI configuration is a common reason a re-joined node ends up with the wrong network.

## Troubleshooting the installation

| Symptom | What to check |
|---|---|
| `init` hangs at `wait-control-plane` | `journalctl -u kubelet`, `crictl ps -a`, cgroup driver, image availability |
| Preflight: `port 6443 is in use` | A previous installation: `kubeadm reset -f` |
| Preflight: `container runtime is not running` | `systemctl status containerd`, `crictl info` |
| All nodes `NotReady` after init | The CNI is not installed |
| CoreDNS `Pending` | The CNI is not installed (CoreDNS does not tolerate the `not-ready` taint) |
| Pods on `node01` get no IP | The CNI DaemonSet on `node01`, `/etc/cni/net.d/` on `node01` |
| The worker gets no Pods | A taint on the node (`kubectl describe node node01 \| grep Taints`) |

In the lab environment the nodes are Docker containers, so `init` and `join` are run with `--ignore-preflight-errors=all` (a container fails some hardware and kernel checks). On real machines and on the exam, do not skip preflight without a reason.

## Summary

- kubeadm does not install the runtime, packages or the CNI; it creates the PKI, kubeconfig files, static Pod manifests, a bootstrap token and addons.
- `kubeadm init --pod-network-cidr=... --kubernetes-version=...` or `kubeadm init --config` with `kubeadm.k8s.io/v1beta4`; in v1beta4 `extraArgs` is a list of `name`/`value`.
- After `init`: copy `admin.conf` to `~/.kube/config` and install a CNI whose CIDR matches `--pod-network-cidr`.
- Worker join command: `kubeadm token create --print-join-command` (the token is valid for 24h).
- Additional control plane: the cluster must have a `controlPlaneEndpoint`; `--upload-certs` / `kubeadm init phase upload-certs --upload-certs` gives a `certificate-key` valid for 2 hours; join with `--control-plane --certificate-key`.
- Stacked etcd: etcd on the control plane nodes; external etcd: separate machines and `etcd.external`. An odd number of etcd members, quorum `n/2+1`.
- Removing a node: `drain`, `delete node`, then `kubeadm reset -f` on the node and manual cleanup of `/etc/cni/net.d` and iptables rules.
