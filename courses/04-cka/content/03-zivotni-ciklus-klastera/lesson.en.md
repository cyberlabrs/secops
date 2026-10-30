## What this module covers

This module covers objective **1.4** of domain 1 (**Cluster Architecture, Installation & Configuration**, 25% of the exam): managing the cluster lifecycle. These are three topics that appear on the exam almost every time:

- **upgrading** a kubeadm cluster to the next minor version (control plane first, then workers),
- **etcd backup and restore** (`etcdctl snapshot save`, `etcdutl snapshot restore`),
- control plane **certificates** (checking expiry, renewal) and node maintenance (`drain`, `cordon`, `uncordon`).

These tasks are worth a lot of points and follow a clear procedure. If you drill it until you know it by heart, you solve them in 5–8 minutes. Typical tasks:

- "Upgrade controlplane and node01 from v1.35.0 to v1.36.5. Do not upgrade other packages."
- "Create an etcd snapshot at `/opt/etcd-backup.db`."
- "Restore etcd from `/opt/etcd-backup.db` into the directory `/var/lib/etcd-restore`."
- "Write the API server certificate expiry date to `/opt/cert-expiry.txt`."
- "Prepare node01 for maintenance so that no application Pod runs on it."

## Node maintenance: cordon, drain, uncordon

| Command | What it does | Existing Pods |
|---|---|---|
| `kubectl cordon node01` | Marks the node unschedulable (`spec.unschedulable: true`) | Stay |
| `kubectl drain node01 ...` | `cordon` + **eviction** of all Pods | Are moved (if a controller recreates them) |
| `kubectl uncordon node01` | Puts the node back into scheduling | Do not come back automatically |

```bash
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data
kubectl get nodes          # node01   Ready,SchedulingDisabled
# ... maintenance ...
kubectl uncordon node01
```

Why drain stops and which flag fixes it:

| Message / situation | Flag | Consequence |
|---|---|---|
| `cannot delete DaemonSet-managed Pods` | `--ignore-daemonsets` | DaemonSet Pods stay (the DaemonSet would bring them back anyway) |
| `cannot delete Pods with local storage` (emptyDir) | `--delete-emptydir-data` | Data in emptyDir is lost |
| `cannot delete Pods that declare no controller` (bare Pod) | `--force` | The Pod is deleted and **does not come back** anywhere |
| `Cannot evict pod as it would violate the pod's disruption budget` | no flag; drain keeps retrying | You wait, increase replicas or temporarily change the PDB |
| A Pod takes too long to terminate | `--timeout=120s`, `--grace-period=30` | — |

Drain uses the **Eviction API**, so it respects **PodDisruptionBudgets**. Drain skips static Pods (mirror Pods).

> **On the exam:** If the task says "no Pod may be lost" and there is a bare Pod without a controller on the node, `--force` is not the answer. First make a copy (`kubectl get pod x -o yaml > x.yaml`) or read the task again. For typical tasks `--ignore-daemonsets --delete-emptydir-data` is enough.

## Upgrading a kubeadm cluster

### Version rules (version skew policy)

- You upgrade **one minor version at a time**: 1.35 → 1.36 → 1.37. Skipping a minor version is not supported.
- Patch versions within the same minor version (1.36.1 → 1.36.5) can be skipped.
- Order: **control plane first, then workers**. kube-apiserver must be the newest component in the cluster.

| Component | Allowed skew relative to kube-apiserver |
|---|---|
| kube-apiserver (HA) | Instances at most 1 minor apart from each other |
| kube-controller-manager, kube-scheduler | Not newer; at most 1 minor older |
| **kubelet** | Not newer; up to **3 minor** older |
| kube-proxy | Not newer; up to 3 minor older (and up to 3 from the kubelet on the same node) |
| **kubectl** | ±1 minor |

Example: with API server 1.36 the kubelet can be 1.36, 1.35, 1.34 or 1.33. Kubelet 1.37 is not supported.

### Packages and repository

Packages are installed from **pkgs.k8s.io**, where each minor version has a separate repository. To move to a new minor version you first change the version in the URL:

```bash
cat /etc/apt/sources.list.d/kubernetes.list
# deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.35/deb/ /
sed -i 's#/v1.35/#/v1.36/#' /etc/apt/sources.list.d/kubernetes.list
apt-get update
apt-cache madison kubeadm          # available versions, e.g. 1.36.5-1.1
```

In the lab environment `/etc/apt/sources.list.d/kubernetes.list` already points to a local repository with version **1.36.5**, so `apt-get update` is enough. The packages are pinned with `apt-mark hold` so that `apt upgrade` does not upgrade them by accident; that is why every step goes `unhold` → `install` → `hold`.

### Step 1: the first control plane node

```bash
ssh controlplane      # or you are already on it
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm='1.36.5-1.1'
apt-mark hold kubeadm
kubeadm version -o short          # v1.36.5

kubeadm upgrade plan              # checks and a list of versions you can move to
kubeadm upgrade apply v1.36.5     # upgrades static Pods, CoreDNS, kube-proxy, kubeadm-config
```

`kubeadm upgrade apply`:

- checks that the cluster is healthy and that the version jump is allowed,
- pulls images, backs up the old manifests to `/etc/kubernetes/tmp/` and writes new ones to `/etc/kubernetes/manifests/`,
- upgrades etcd if needed,
- **automatically renews the certificates** that kubeadm manages (disable with `--certificate-renewal=false`),
- upgrades the CoreDNS and kube-proxy addons.

You know it worked when you see `[upgrade/successful] SUCCESS! Your cluster was upgraded to "v1.36.5"`. The CNI is not upgraded: you do that following the CNI project's instructions, if needed.

Then the kubelet and kubectl on the same node:

```bash
kubectl drain controlplane --ignore-daemonsets
apt-mark unhold kubelet kubectl
apt-get install -y kubelet='1.36.5-1.1' kubectl='1.36.5-1.1'
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon controlplane
kubectl get nodes                  # controlplane   Ready   v1.36.5
```

### Step 2: the other control plane nodes (HA)

Same as the first, but instead of `kubeadm upgrade apply` you run:

```bash
kubeadm upgrade node
```

`upgrade plan` is not needed here. Control plane nodes are upgraded one at a time.

### Step 3: worker nodes

```bash
ssh node01
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm='1.36.5-1.1'
apt-mark hold kubeadm
kubeadm upgrade node               # on a worker this upgrades the local kubelet configuration
exit

kubectl drain node01 --ignore-daemonsets --delete-emptydir-data   # from controlplane

ssh node01
apt-mark unhold kubelet kubectl
apt-get install -y kubelet='1.36.5-1.1' kubectl='1.36.5-1.1'
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
exit

kubectl uncordon node01
kubectl get nodes
```

Important: you run `kubectl drain` and `uncordon` where you have a kubeconfig (controlplane), and `apt` and `systemctl` on the node itself.

> **On the exam:** After `apt-get install kubelet`, the node still shows the old version in `kubectl get nodes` until you run `systemctl restart kubelet`. If you forget the restart, the task is graded as not done. At the end always check `kubectl get nodes` and that no node is `SchedulingDisabled`.

If the task says "upgrade only the control plane" or "only the kubelet on node01", do exactly that. The procedure is in the documentation under "Upgrading kubeadm clusters" (kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/), with all the commands ready to copy.

## etcd backup

In a kubeadm cluster etcd runs as the static Pod `etcd-controlplane` and listens on `https://127.0.0.1:2379`. Access requires a client certificate. You read the paths from the manifest:

```bash
grep -E 'listen-client-urls|cert-file|key-file|trusted-ca-file|data-dir' /etc/kubernetes/manifests/etcd.yaml
#   - --cert-file=/etc/kubernetes/pki/etcd/server.crt
#   - --data-dir=/var/lib/etcd
#   - --key-file=/etc/kubernetes/pki/etcd/server.key
#   - --listen-client-urls=https://127.0.0.1:2379,https://172.18.0.2:2379
#   - --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
```

Snapshot (etcdctl 3.6; `ETCDCTL_API=3` is no longer needed because v3 is the default):

```bash
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /opt/etcd-backup.db

etcdutl --write-out=table snapshot status /opt/etcd-backup.db
```

| etcdctl flag | Matching etcd flag in the manifest |
|---|---|
| `--cacert` | `--trusted-ca-file` |
| `--cert` | `--cert-file` |
| `--key` | `--key-file` |
| `--endpoints` | `--listen-client-urls` / `--advertise-client-urls` |

Instead of `server.crt` you can also use `/etc/kubernetes/pki/etcd/healthcheck-client.crt` or `/etc/kubernetes/pki/apiserver-etcd-client.crt` with the matching key; they are all signed by the etcd CA.

Other useful commands:

```bash
E="etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key"
$E endpoint health
$E member list -w table
$E get /registry/namespaces --prefix --keys-only | head
```

A snapshot contains all of the cluster's Secrets. Keep it protected (`chmod 600`, encrypted off the node).

> **On the exam:** If `snapshot save` hangs or reports `context deadline exceeded`, the cert flags are almost always missing or wrong, or you are using `http://` instead of `https://`. Copy the cert paths from `etcd.yaml`; do not type them from memory.

## etcd restore

Since etcd 3.6, **`etcdctl snapshot restore` and `etcdctl snapshot status` have been removed**. Restore is done with **`etcdutl`**, which works directly on files (no network and no certificates).

```bash
etcdutl --data-dir /var/lib/etcd-restore snapshot restore /opt/etcd-backup.db
ls /var/lib/etcd-restore     # member/
```

The target directory **must not exist** (or must be empty): `etcdutl` creates it. You must not restore into the existing `/var/lib/etcd` while etcd is running.

Then you point the etcd static Pod at the new directory. In `/etc/kubernetes/manifests/etcd.yaml` you change the **`hostPath.path`** of the `etcd-data` volume:

```yaml
  volumes:
  - hostPath:
      path: /etc/kubernetes/pki/etcd
      type: DirectoryOrCreate
    name: etcd-certs
  - hostPath:
      path: /var/lib/etcd-restore      # was /var/lib/etcd
      type: DirectoryOrCreate
    name: etcd-data
```

Inside the container the path stays `/var/lib/etcd` (`mountPath` and `--data-dir` do not change); it just points to the new directory on the host now. If you also change `--data-dir`, you must align `volumeMounts.mountPath` as well, otherwise etcd writes to an empty directory inside the container.

The complete procedure for a single control plane:

```bash
# 1. stop the API server (documentation: do not restore etcd while API servers are running)
mv /etc/kubernetes/manifests/kube-apiserver.yaml /root/
# 2. restore into a new directory
etcdutl --data-dir /var/lib/etcd-restore snapshot restore /opt/etcd-backup.db
# 3. etcd.yaml: hostPath etcd-data -> /var/lib/etcd-restore
vim /etc/kubernetes/manifests/etcd.yaml
# 4. bring the API server back and wait
mv /root/kube-apiserver.yaml /etc/kubernetes/manifests/
watch crictl ps            # etcd and kube-apiserver Running
kubectl get pods -A        # state as of the backup
```

The kubelet notices the manifest change on its own and recreates the etcd Pod. If that takes a while, `systemctl restart kubelet`. It is also recommended to restart kube-scheduler, kube-controller-manager and the kubelet so they do not keep working with cached state newer than the backup.

For an etcd cluster with several members, the restore is done on each member with `--name`, `--initial-cluster` and `--initial-advertise-peer-urls` from the same snapshot. For the exam a single member is enough.

> **On the exam:** After editing `etcd.yaml`, `kubectl` may report errors for 1–2 minutes. Do not panic and change anything else; watch `crictl ps -a | grep -E 'etcd|apiserver'` and `crictl logs` of the etcd container. The most common mistakes are a wrong hostPath or restoring into a directory that already exists.

## Certificates

kubeadm creates the PKI in `/etc/kubernetes/pki/`:

| File | Purpose |
|---|---|
| `ca.crt`, `ca.key` | Cluster CA (10 years) |
| `apiserver.crt/.key` | API server serving certificate (SAN: names, IPs, `controlPlaneEndpoint`) |
| `apiserver-kubelet-client.crt/.key` | API server → kubelet |
| `apiserver-etcd-client.crt/.key` | API server → etcd |
| `front-proxy-ca.*`, `front-proxy-client.*` | Aggregation layer (e.g. metrics-server) |
| `sa.key`, `sa.pub` | ServiceAccount token signing (a key pair, not a certificate) |
| `etcd/ca.*`, `etcd/server.*`, `etcd/peer.*`, `etcd/healthcheck-client.*` | etcd PKI |

The client certificates for `admin.conf`, `super-admin.conf`, `controller-manager.conf` and `scheduler.conf` are embedded in those kubeconfig files. The kubelet has its own certificate in `/var/lib/kubelet/pki/` and **rotates it itself** (which is why `kubelet.conf` is not in the kubeadm report).

Non-CA certificates are valid for **1 year**, the CA for **10 years**. In v1beta4 you change this with the `certificateValidityPeriod` and `caCertificateValidityPeriod` fields in ClusterConfiguration.

### Checking expiry

```bash
kubeadm certs check-expiration
# CERTIFICATE        EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED
# admin.conf         Oct 14, 2027 09:12 UTC   363d            ca                      no
# apiserver          Oct 14, 2027 09:12 UTC   363d            ca                      no
# ...

openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
# notAfter=Oct 14 09:12:31 2027 GMT
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 'Subject Alternative Name'
```

### Renewal

```bash
kubeadm certs renew all                 # or individually: kubeadm certs renew apiserver
kubeadm certs check-expiration          # new dates
```

Renewed certificates are not loaded automatically. The control plane static Pods have to be restarted, and `kubectl delete pod` does not do that (mirror Pod). The documented procedure: move the manifest out, wait for the kubelet to stop the Pod (~20 s), move it back.

```bash
cd /etc/kubernetes/manifests
for f in kube-apiserver kube-controller-manager kube-scheduler etcd; do
  mv $f.yaml /tmp/ ; sleep 20 ; mv /tmp/$f.yaml . ; done
cp /etc/kubernetes/admin.conf ~/.kube/config     # admin.conf was renewed too
```

On an HA cluster you run `kubeadm certs renew all` on every control plane node. A regular yearly upgrade renews certificates automatically, so clusters that are upgraded regularly rarely run into this problem.

> **On the exam:** When asked "until when is certificate X valid", `kubeadm certs check-expiration` is the fastest, but for the exact date format in your answer use `openssl x509 -noout -enddate`. Write exactly what the task asks for (e.g. only the date).

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| `kubeadm upgrade apply` rejects the version | Trying to skip a minor version, or kubeadm was not upgraded | `kubeadm version`, then `upgrade plan` |
| `apt-get install kubeadm=...` reports `Held packages were changed` | `apt-mark unhold` was not done | `apt-mark unhold kubeadm` |
| `E: Version '1.36.5-1.1' for 'kubeadm' was not found` | The repository still points to the old minor version | Change the URL in `kubernetes.list`, `apt-get update`, `apt-cache madison kubeadm` |
| The node still shows the old version | The kubelet was not restarted | `systemctl daemon-reload && systemctl restart kubelet` |
| The node stays `SchedulingDisabled` | Forgot `uncordon` | `kubectl uncordon <node>` |
| `kubectl` reports `x509: certificate has expired` | Expired control plane certificates or an old `~/.kube/config` | `kubeadm certs renew all`, restart the static Pods, copy `admin.conf` |
| etcd crashes after the restore | The target directory already existed, wrong hostPath | `crictl logs`, check `etcd.yaml`, repeat the restore into a new directory |
| After the restore you see "old" objects | That is expected: the cluster was rolled back to the moment of the backup | — |

## Summary

- Maintenance: `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`, work on the node, `kubectl uncordon <node>`; drain respects PodDisruptionBudgets.
- Upgrades go one minor version at a time, control plane first, then workers; the kubelet is never newer than the API server (it may be up to 3 minor older), kubectl ±1.
- First control plane: `unhold` → kubeadm → `hold`, `kubeadm upgrade plan`, `kubeadm upgrade apply v1.36.5`, drain, kubelet and kubectl, `daemon-reload`, `restart kubelet`, uncordon.
- Other control plane nodes and workers: `kubeadm upgrade node` instead of `apply`.
- Backup: `etcdctl snapshot save` with `--endpoints`, `--cacert`, `--cert`, `--key` from `etcd.yaml`; verify with `etcdutl snapshot status`.
- Restore: `etcdutl --data-dir <new-dir> snapshot restore <file>` (etcdctl restore does not exist in 3.6), then change the `hostPath` of the `etcd-data` volume in `etcd.yaml`.
- Certificates: `/etc/kubernetes/pki/`, `kubeadm certs check-expiration`, `kubeadm certs renew all` + restart the static Pods; `kubeadm upgrade` renews them automatically.
