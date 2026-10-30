# Lab 1: Cluster components and a static Pod

You have a two-node kubeadm cluster: `controlplane` and `node01`. You switch to `node01` with `ssh node01` and come back with `exit`.

First you will find where kubeadm keeps the control plane configuration. Then you create a **static Pod** on the worker node and move it to the other node, as in the Killercoda "Static Pod Move" task.

```bash
kubectl get nodes -o wide
kubectl -n kube-system get pods -o wide
```

<!-- setup
set -e
cluster-up
-->

## Control plane configuration

The control plane components (kube-apiserver, etcd, scheduler, controller-manager) are static Pods. The kubelet reads their manifests from the directory set in its configuration.

1. Write the path of the static Pod manifest directory on `controlplane` to `/root/static-path.txt`. Read it from the kubelet configuration (`/var/lib/kubelet/config.yaml`, field `staticPodPath`).
2. Write the Service IP range to `/root/service-cidr.txt`, exactly as set by the `--service-cluster-ip-range` flag in the kube-apiserver manifest.

```bash
grep staticPodPath /var/lib/kubelet/config.yaml
ls /etc/kubernetes/manifests/
grep service-cluster-ip-range /etc/kubernetes/manifests/kube-apiserver.yaml
```

<!-- verify
[ "$(tr -d ' \n' < /root/static-path.txt 2>/dev/null | sed 's#/$##')" = "/etc/kubernetes/manifests" ] || { echo "static-path.txt is not correct"; exit 1; }
want=$(grep -o 'service-cluster-ip-range=[^ ]*' /etc/kubernetes/manifests/kube-apiserver.yaml | cut -d= -f2)
[ "$(tr -d ' \n' < /root/service-cidr.txt 2>/dev/null)" = "$want" ] || { echo "service-cidr.txt is not correct (expected the range from the manifest)"; exit 1; }
-->
<!-- hint
`awk '/staticPodPath/ {print $2}' /var/lib/kubelet/config.yaml > /root/static-path.txt`. Write the Service range without `--service-cluster-ip-range=`, just the CIDR (e.g. `10.96.0.0/12`).
-->
<!-- solution
awk '/staticPodPath/ {print $2}' /var/lib/kubelet/config.yaml > /root/static-path.txt
grep -o 'service-cluster-ip-range=[^ ]*' /etc/kubernetes/manifests/kube-apiserver.yaml | cut -d= -f2 > /root/service-cidr.txt
-->

## Container runtime and CNI on node01

The kubelet talks to the runtime through the **CRI** socket, and Pod networking is set up by the **CNI** plugin whose configuration lives in `/etc/cni/net.d/`.

1. Write the runtime and its version for `node01` to `/root/runtime.txt`, exactly as shown in the `CONTAINER-RUNTIME` column of `kubectl get nodes -o wide` (e.g. `containerd://x.y.z`).
2. Write the name of the CNI configuration file on `node01` to `/root/cni.txt` (just the file name from `/etc/cni/net.d/`).

```bash
kubectl get node node01 -o wide
ssh node01 ls /etc/cni/net.d/
ssh node01 crictl ps
```

<!-- verify
want=$(kubectl get node node01 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}')
[ "$(tr -d ' \n' < /root/runtime.txt 2>/dev/null)" = "$want" ] || { echo "runtime.txt is not correct"; exit 1; }
cni=$(ssh node01 ls /etc/cni/net.d/ | head -1)
[ "$(tr -d ' \n' < /root/cni.txt 2>/dev/null | xargs basename 2>/dev/null)" = "$cni" ] || { echo "cni.txt is not correct"; exit 1; }
-->
<!-- hint
`kubectl get node node01 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}' > /root/runtime.txt` and `ssh node01 ls /etc/cni/net.d/ > /root/cni.txt`.
-->
<!-- solution
kubectl get node node01 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}' > /root/runtime.txt
ssh node01 ls /etc/cni/net.d/ | head -1 > /root/cni.txt
-->

## Static Pod on node01

Create a static Pod on `node01`:

- name `static-web`, image `nginx:1.28`, container port 80,
- label `app=static-web`.

The manifest goes into the static Pod directory **on node01**. The API server will show a "mirror" Pod named `static-web-node01`.

```bash
kubectl run static-web --image=nginx:1.28 --port=80 -l app=static-web --dry-run=client -o yaml > static-web.yaml
scp static-web.yaml node01:/etc/kubernetes/manifests/
kubectl get pod static-web-node01 -o wide
```

<!-- verify
ph=$(kubectl get pod static-web-node01 -o jsonpath='{.status.phase}' 2>/dev/null)
[ "$ph" = "Running" ] || { echo "Pod static-web-node01 is not Running (currently: ${ph:-does not exist})"; exit 1; }
[ "$(kubectl get pod static-web-node01 -o jsonpath='{.metadata.ownerReferences[0].kind}')" = "Node" ] || { echo "static-web-node01 is not a static Pod"; exit 1; }
kubectl get pod static-web-node01 -o jsonpath='{.spec.containers[0].image}' | grep -q 'nginx:1.28' || { echo "image is not nginx:1.28"; exit 1; }
-->
<!-- hint
A mirror Pod cannot be deleted with `kubectl delete` (the kubelet brings it right back). A static Pod exists as long as its manifest exists on the node. If the Pod does not appear, check `ssh node01 journalctl -u kubelet | tail`.
-->
<!-- solution
kubectl run static-web --image=nginx:1.28 --port=80 -l app=static-web --dry-run=client -o yaml > /root/static-web.yaml
scp -q /root/static-web.yaml node01:/etc/kubernetes/manifests/static-web.yaml
for i in $(seq 60); do [ "$(kubectl get pod static-web-node01 -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] && break; sleep 2; done
-->

## Move the static Pod to controlplane

A static Pod is not "moved" through the API. Move the manifest:

- `static-web` must run on `controlplane` (mirror Pod `static-web-controlplane`),
- it must no longer exist on `node01`.

<!-- verify
kubectl get pod static-web-node01 >/dev/null 2>&1 && { echo "static-web-node01 still exists"; exit 1; }
[ "$(kubectl get pod static-web-controlplane -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "static-web-controlplane is not Running"; exit 1; }
-->
<!-- hint
`scp node01:/etc/kubernetes/manifests/static-web.yaml /etc/kubernetes/manifests/`, then on node01 remove the manifest from `/etc/kubernetes/manifests/` (e.g. move it to `/root/`). The kubelet checks the directory every few seconds.
-->
<!-- solution
scp -q node01:/etc/kubernetes/manifests/static-web.yaml /etc/kubernetes/manifests/static-web.yaml
ssh node01 mv /etc/kubernetes/manifests/static-web.yaml /root/static-web.yaml
for i in $(seq 60); do kubectl get pod static-web-node01 >/dev/null 2>&1 || break; sleep 2; done
for i in $(seq 60); do [ "$(kubectl get pod static-web-controlplane -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] && break; sleep 2; done
-->
