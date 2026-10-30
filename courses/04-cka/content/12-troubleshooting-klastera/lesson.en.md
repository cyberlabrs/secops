## What this module covers

Domain 5 (**Troubleshooting**) is the largest on the exam: **30%**. This module covers two objectives:

- **5.1** troubleshooting clusters and nodes (**Troubleshoot clusters and nodes**),
- **5.2** troubleshooting cluster components (**Troubleshoot cluster components**).

Typical tasks:

- "Node `node01` is `NotReady`. Fix it so that it stays healthy after a reboot."
- "`kubectl` does not work: The connection to the server controlplane:6443 was refused. Fix the control plane."
- "New Pods stay in the Pending state" or "The Deployment does not create Pods". The cause lies in the scheduler or the controller-manager.
- "Write the name of the component that is not working to the file `/opt/answer.txt`".

These are the tasks with the most points and the most stress. Only a systematic approach helps: **from the node toward the control plane, from status toward logs.** At the end of every task, verify that the problem is actually fixed.

## Map: where everything lives in a kubeadm cluster

| Component | How it runs | Configuration | Logs |
|---|---|---|---|
| **kubelet** | systemd service on every node | `/var/lib/kubelet/config.yaml`, `/etc/kubernetes/kubelet.conf`, drop-in `10-kubeadm.conf`, `/var/lib/kubelet/kubeadm-flags.env` | `journalctl -u kubelet` |
| **containerd** | systemd service on every node | `/etc/containerd/config.toml` | `journalctl -u containerd` |
| **kube-apiserver** | **static Pod** on controlplane | `/etc/kubernetes/manifests/kube-apiserver.yaml` | `crictl logs`, `/var/log/pods/` |
| **etcd** | static Pod | `/etc/kubernetes/manifests/etcd.yaml` | same |
| **kube-scheduler** | static Pod | `/etc/kubernetes/manifests/kube-scheduler.yaml`, `/etc/kubernetes/scheduler.conf` | same |
| **kube-controller-manager** | static Pod | `/etc/kubernetes/manifests/kube-controller-manager.yaml`, `/etc/kubernetes/controller-manager.conf` | same |
| **kube-proxy** | DaemonSet | ConfigMap `kube-proxy` in `kube-system` | `k logs -n kube-system ds/kube-proxy` |
| **CoreDNS** | Deployment | ConfigMap `coredns` | `k logs -n kube-system deploy/coredns` |

The control plane certificates are in `/etc/kubernetes/pki/` (etcd in `/etc/kubernetes/pki/etcd/`). The kubelet client certificate is `/var/lib/kubelet/pki/kubelet-client-current.pem`.

Ports worth knowing: API server `6443`, etcd `2379` (clients) and `2380` (peer), kubelet `10250`, kube-scheduler `10259`, kube-controller-manager `10257`, kubelet healthz `10248` on localhost.

## First look at the cluster

```bash
k config use-context <context-from-task>
k get nodes -o wide
k get pods -n kube-system -o wide
k get --raw='/readyz?verbose'          # state of the API server and its checks
k get --raw='/livez?verbose'
k cluster-info
k events -A --types=Warning            # recent Warning events across the whole cluster
k get events -A --sort-by=.metadata.creationTimestamp | tail -20
```

`/readyz?verbose` prints a list of checks (`[+]etcd ok`, `[+]poststarthook/...`). If one fails, it shows `[-]` and the reason. `k get componentstatuses` is **deprecated** and should not be trusted.

`k cluster-info dump` prints a huge amount of state (nodes, Pods, events, logs from `kube-system`). It is useful for searching:

```bash
k cluster-info dump | grep -i error | head
k cluster-info dump --output-directory=/tmp/dump   # into files, per namespace
```

> **On the exam:** every task starts with a `kubectl config use-context ...` command given in the task. Copy it. If you are fixing a node, `ssh` to the correct node (`ssh node01`), and do not forget to `exit` before the next task. Many candidates lose points by doing the next task on the wrong machine.

## Node NotReady

### What kubectl shows

```bash
k get nodes
# NAME           STATUS     ROLES           AGE   VERSION
# controlplane   Ready      control-plane   2d    v1.35.0
# node01         NotReady   <none>          2d    v1.35.0
k describe node node01 | sed -n '/Conditions/,/Addresses/p'
```

| Condition (Conditions) | What it means |
|---|---|
| `Ready=Unknown`, "Kubelet stopped posting node status" | The kubelet is not reporting status: it is not running, cannot reach the API server, or has wrong credentials |
| `Ready=False`, "container runtime network not ready… cni plugin not initialized" | The CNI is not installed or not working |
| `Ready=False`, "container runtime is down" | containerd is not running |
| `MemoryPressure=True` | Low memory; the kubelet evicts Pods |
| `DiskPressure=True` | Low disk space (nodefs/imagefs); taint `node.kubernetes.io/disk-pressure` |
| `PIDPressure=True` | Too many processes |

When a node is unreachable, the controller adds the taint `node.kubernetes.io/unreachable` (or `not-ready`) with the `NoExecute` effect. Pods without a matching toleration are evicted after 300 seconds (the default toleration added by an admission plugin).

### Procedure on the node

```bash
ssh node01
systemctl status kubelet          # active (running)? or activated/failed?
systemctl status containerd
journalctl -u kubelet --no-pager | tail -30
journalctl -u kubelet -f          # follow live while you restart
```

The most common scenarios and fixes:

| Symptom in `systemctl` / `journalctl` | Cause | Fix |
|---|---|---|
| `inactive (dead)` | Kubelet stopped | `systemctl enable --now kubelet` |
| `disabled` in the Loaded line | It will not start after a reboot | `systemctl enable kubelet` |
| `status=203/EXEC` | Wrong binary path in the unit/drop-in file | `systemctl cat kubelet`, fix `ExecStart`, `systemctl daemon-reload` |
| `failed to load kubelet config file ... /var/lib/kubelet/config.yaml` | The file does not exist, wrong path in `--config`, YAML error | Fix the file or the path |
| `unknown flag: --xyz` | Nonexistent flag in `kubeadm-flags.env` or the drop-in | Remove the flag |
| `validate service connection` … `containerd.sock` … `no such file or directory` or `connection refused` | containerd is not running or wrong `containerRuntimeEndpoint` | `systemctl start containerd`, fix the endpoint |
| `dial tcp ...:6443: connect: connection refused` / `no such host` | Wrong `server:` in `/etc/kubernetes/kubelet.conf` or the API server is not running | Fix the address (`https://controlplane:6443`) |
| `x509: certificate signed by unknown authority` / `certificate has expired` | Wrong CA in `config.yaml` (`authentication.x509.clientCAFile`) or an expired certificate | Fix the path to `/etc/kubernetes/pki/ca.crt`; renew the certificate |

After every change:

```bash
systemctl daemon-reload           # only if you changed a unit or drop-in file
systemctl restart kubelet
systemctl status kubelet
exit
k get nodes -w                    # from controlplane: wait for Ready
```

`systemctl cat kubelet` shows the unit and all drop-in files, with exact paths. There you can see which `--config` and `--kubeconfig` the kubelet uses and where it reads `kubeadm-flags.env` from.

Key parts of `/var/lib/kubelet/config.yaml`:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
cgroupDriver: systemd
clusterDNS:
- 10.96.0.10
clusterDomain: cluster.local
staticPodPath: /etc/kubernetes/manifests
containerRuntimeEndpoint: unix:///run/containerd/containerd.sock
```

> **On the exam:** a task often says "fix it so that it survives a reboot". So always check that the service is `enabled` (`systemctl is-enabled kubelet`), not just `active`. Changes made manually to a running process without changing the file do not survive a reboot.

### Disk and memory

```bash
df -h /var/lib/kubelet /var/lib/containerd
free -m
crictl images                 # image disk usage
crictl rmi --prune            # remove unused images
journalctl -u kubelet | grep -i evict
```

The kubelet tries to free space on its own (image garbage collection, Pod eviction) according to the `evictionHard` thresholds in `config.yaml`. When the pressure drops, the condition returns to `False` and the taint disappears.

## crictl: when the API server is down

When `kubectl` does not respond, kubectl cannot tell you anything about static Pods. Then you ask the container runtime directly through **crictl** (the endpoint is in `/etc/crictl.yaml`).

```bash
crictl ps                         # running containers
crictl ps -a | grep kube-apiserver   # including those that crashed (Exited)
crictl pods                       # Pod sandboxes
crictl logs <container-id>        # container logs
crictl logs --tail=30 <container-id>
crictl inspect <container-id> | less
crictl images
```

If a container keeps crashing, the number in the `ATTEMPT` column grows and the old containers remain `Exited`. The logs of the last attempt usually contain the exact error message.

Logs also exist as files on the node's disk:

- `/var/log/pods/<namespace>_<pod>_<uid>/<container>/0.log` (the actual files),
- `/var/log/containers/<pod>_<namespace>_<container>-<id>.log` (symlinks to the former).

```bash
ls /var/log/pods/ | grep apiserver
tail -20 /var/log/pods/kube-system_kube-apiserver-controlplane_*/kube-apiserver/*.log
```

## Control plane static Pod manifests

The kubelet on controlplane reads the `staticPodPath` directory (`/etc/kubernetes/manifests`) and runs every Pod in it by itself. The API server only shows their **mirror Pods** (the name has the `-controlplane` suffix). Therefore:

- you make changes in the file, not through `kubectl edit` (a change to a mirror Pod is not applied);
- the kubelet notices the file change and recreates the Pod. This can take up to a minute;
- `kubectl delete pod kube-apiserver-controlplane` does not remove the component; the kubelet brings it back immediately.

Always make a copy **outside** the manifest directory before editing:

```bash
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
vim /etc/kubernetes/manifests/kube-apiserver.yaml
watch crictl ps -a          # wait for the container to reappear and stay Running
```

A copy in the same directory (`kube-apiserver.yaml.bak`) is a bad idea: the kubelet may try to load it as a manifest.

> **On the exam:** when you change the API server manifest, `kubectl` will not work for 30–90 seconds. Do not panic and do not edit the file again while you wait. Watch `crictl ps -a | grep apiserver` and, if it does not come up, `journalctl -u kubelet | grep -i apiserver` and the container log.

### Typical mistakes in manifests

| Mistake | Where it shows up | Example |
|---|---|---|
| YAML syntax (indentation, tab, unclosed quote) | The kubelet cannot load the file: the Pod is not created at all, no container in `crictl ps -a`. The message is in `journalctl -u kubelet` | `could not process manifest file` |
| Nonexistent or misspelled flag | The container starts and exits immediately; `crictl logs` | `Error: unknown flag: --etcd-server` |
| Wrong certificate path | `crictl logs` | `open /etc/kubernetes/pki/apiserver.crtt: no such file or directory` |
| Wrong etcd port or address | The API server starts and then crashes; `crictl logs` | `dial tcp 127.0.0.1:2380: connect: connection refused` (2380 is the peer port; the client port is 2379) |
| Wrong `hostPath` volume | The Pod cannot be created or the files do not exist in the container | The path in `volumes` does not match `volumeMounts` or the disk |
| Wrong image (tag) | `ErrImagePull` in `crictl pods`/journal | `registry.k8s.io/kube-apiserver:v1.35.9` does not exist |
| Wrong `--kubeconfig` for scheduler/controller-manager | The component runs but cannot reach the API server | `stat /etc/kubernetes/scheduler.config: no such file` |
| Liveness probe on the wrong port | The kubelet keeps restarting the component | `Liveness probe failed` in the journal |

Excerpt from a correct API server manifest (only the relevant lines):

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --advertise-address=172.18.0.2
    - --client-ca-file=/etc/kubernetes/pki/ca.crt
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
    - --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
    - --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key
    - --etcd-servers=https://127.0.0.1:2379
    - --secure-port=6443
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
    - --tls-private-key-file=/etc/kubernetes/pki/apiserver.key
    image: registry.k8s.io/kube-apiserver:v1.35.0
```

Quick comparison with what exists on disk:

```bash
grep -E 'crt|key|etcd-servers' /etc/kubernetes/manifests/kube-apiserver.yaml
ls /etc/kubernetes/pki/ /etc/kubernetes/pki/etcd/
```

For exact flag names, use the documentation: the "kube-apiserver" reference page (Reference → Command line tools reference).

## Symptoms by component

When something does not work, the symptom often tells you which component is at fault.

| Component not working | Symptom |
|---|---|
| **kube-apiserver** | `kubectl`: `The connection to the server controlplane:6443 was refused` or a timeout. Nothing works through the API, but existing Pods keep running |
| **etcd** | The API server crashes or never becomes ready; its log shows errors toward `127.0.0.1:2379`. `kubectl` returns a timeout or `etcdserver: request timed out` |
| **kube-scheduler** | New Pods stay **Pending** and have **no events at all** (neither `Scheduled` nor `FailedScheduling`). The `nodeName` field is empty. Pods with `nodeName` set manually still start |
| **kube-controller-manager** | `k create deploy` succeeds, but there is no ReplicaSet and no Pods. Scaling does not work, Jobs do not create Pods, deleted ReplicaSet Pods are not replaced, PVCs are not bound, NotReady nodes do not get a taint |
| **kubelet on a node** | Node `NotReady`; after 5 minutes its Pods switch to `Terminating`/`Unknown` |
| **kube-proxy** | Services (ClusterIP) do not forward traffic, even though the Pods are running and the endpoints exist |
| **CoreDNS** | Service names do not resolve; IP addresses work |
| **CNI** | Nodes `NotReady` with "cni plugin not initialized"; Pods in `ContainerCreating` |

Example of diagnosing the scheduler:

```bash
k run test --image=nginx:1.27
k get pod test                       # Pending
k describe pod test | tail -5        # Events: <none>
k get pods -n kube-system | grep scheduler
# kube-scheduler-controlplane   0/1   CrashLoopBackOff
k logs -n kube-system kube-scheduler-controlplane
# or, if the mirror Pod does not exist:
crictl ps -a | grep scheduler
```

You can also read static Pod logs with `k logs -n kube-system <pod>` while the API server is running. When the API server is down, only `crictl logs` or `/var/log/pods/` remain.

> **On the exam:** Pending without a single event = scheduler. Pending with a `FailedScheduling` event = the scheduler works but cannot find a node (resources, taint, affinity, PVC). These are two completely different tasks.

## etcd in brief

etcd is a static Pod with its data in `/var/lib/etcd` (hostPath). Health check from the controlplane node:

```bash
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health
```

Typical mistakes in `etcd.yaml`: a wrong `--data-dir` or `hostPath` for `/var/lib/etcd` (etcd starts "empty" and the cluster looks as if it has lost all objects), wrong certificate paths (`--cert-file`, `--key-file`, `--trusted-ca-file`). Backup and restore are covered in the cluster lifecycle module.

## Certificates

```bash
kubeadm certs check-expiration
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -enddate -ext subjectAltName
kubeadm certs renew all              # then restart the static Pods (move the manifests out and back) and the kubelet
```

Expired or wrong certificates show up as `x509:` messages in the logs of the API server, the kubelet, or in `kubectl` output. The kubelet rotates its own client certificate (`rotateCertificates: true` in the kubeadm setup).

## Troubleshooting: the order

1. `k get nodes` and `k get pods -n kube-system`: what is not Ready or Running?
2. If `kubectl` does not work: `ssh controlplane`, `crictl ps -a | grep kube-`, API server and etcd logs, `journalctl -u kubelet`.
3. If a node is NotReady: `ssh` to the node, `systemctl status kubelet containerd`, `journalctl -u kubelet`.
4. If a control plane component is crashing: compare the manifest with the documentation and the disk (paths, ports, flags), check the container log.
5. If Pods do not reach Running: events and `describe` (application troubleshooting module).
6. Finally: `k get nodes`, `k get pods -n kube-system`, a test Pod that actually gets scheduled.

> **On the exam:** before editing any system file (`config.yaml`, manifest, drop-in), make a copy in `/root/`. If the change makes things worse, you restore the original in a few seconds instead of wasting minutes on reconstruction.

## Summary

- The kubelet and containerd are systemd services: `systemctl status/enable/restart`, `journalctl -u kubelet`. The configuration is in `/var/lib/kubelet/config.yaml`, `/etc/kubernetes/kubelet.conf` and the drop-in file (`systemctl cat kubelet`).
- Node NotReady: check the kubelet, containerd, the CNI, certificates and resource pressure (`k describe node`, Conditions).
- The control plane consists of static Pods in `/etc/kubernetes/manifests`. Change the file, not the mirror Pod; keep the copy outside that directory.
- When the API server is down: `crictl ps -a`, `crictl logs`, `/var/log/pods/`, `journalctl -u kubelet` (for YAML errors in a manifest).
- Scheduler down → Pending without events. Controller-manager down → no ReplicaSet and no Pods.
- `k get --raw='/readyz?verbose'`, `k events -A --types=Warning` and `k cluster-info dump` give a quick picture of cluster health.
- After a fix, verify persistence (enabled service, correct file) and the actual result (node Ready, test Pod Running).
