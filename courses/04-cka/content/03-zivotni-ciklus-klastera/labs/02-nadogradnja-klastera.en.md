# Lab 2: Upgrading the cluster from 1.35 to 1.36

The cluster runs Kubernetes **v1.35.0**. Upgrade it to **v1.36.5**: first the control plane, then the worker node. The procedure follows the official documentation ("Upgrading kubeadm clusters").

Packages come from an apt repository that is already configured on both nodes (`/etc/apt/sources.list.d/kubernetes.list`). On the exam this is the `pkgs.k8s.io` repository for the target minor version.

```bash
kubectl get nodes
apt-get update && apt-cache madison kubeadm
```

<!-- setup
set -e
cluster-up
kubectl create deploy web --image=nginx:1.28 --replicas=2 >/dev/null
-->

## kubeadm on controlplane

On `controlplane`, install `kubeadm` version `1.36.5-1.1` and look at the upgrade plan.

```bash
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm='1.36.5-1.1'
apt-mark hold kubeadm
kubeadm version
kubeadm upgrade plan
```

<!-- verify
kubeadm version -o short | grep -q '^v1.36.5$' || { echo "kubeadm on controlplane is not v1.36.5"; exit 1; }
-->
<!-- solution
apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq kubeadm='1.36.5-1.1' >/dev/null 2>&1; apt-mark hold kubeadm >/dev/null
-->

## Upgrading the control plane

Apply the upgrade to the control plane. The command takes 2-3 minutes: kubeadm changes the static Pod manifests and waits for each component to come up.

```bash
kubeadm upgrade apply v1.36.5
kubectl -n kube-system get pods -o wide
```

<!-- verify
img=$(kubectl -n kube-system get pod kube-apiserver-controlplane -o jsonpath='{.spec.containers[0].image}')
case "$img" in *:v1.36.5) ;; *) echo "kube-apiserver is still $img"; exit 1 ;; esac
-->
<!-- hint
If the upgrade stops at a preflight check, read the exact `[ERROR …]` line. `kubeadm upgrade apply` can be run again. Do not upgrade directly from 1.35 to 1.37: skipping minor versions is not supported.
-->
<!-- solution
kubeadm upgrade apply v1.36.5 -y > /root/upgrade-apply.out 2>&1
-->

## kubelet and kubectl on controlplane

`kubectl get nodes` still shows `v1.35.0` for controlplane, because the `VERSION` column shows the **kubelet** version. Upgrade the kubelet and kubectl:

1. drain the node (`drain`),
2. install `kubelet` and `kubectl` `1.36.5-1.1`,
3. `systemctl daemon-reload` and restart the kubelet,
4. put the node back into scheduling (`uncordon`).

```bash
kubectl drain controlplane --ignore-daemonsets
apt-mark unhold kubelet kubectl
apt-get install -y kubelet='1.36.5-1.1' kubectl='1.36.5-1.1'
apt-mark hold kubelet kubectl
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon controlplane
```

<!-- verify
v=$(kubectl get node controlplane -o jsonpath='{.status.nodeInfo.kubeletVersion}')
[ "$v" = "v1.36.5" ] || { echo "the kubelet on controlplane is $v"; exit 1; }
[ "$(kubectl get node controlplane -o jsonpath='{.spec.unschedulable}')" != "true" ] || { echo "controlplane is still cordoned (SchedulingDisabled)"; exit 1; }
kubectl version --client -o json | grep -q '"gitVersion": "v1.36.5"' || { echo "kubectl is not v1.36.5"; exit 1; }
-->
<!-- solution
kubectl drain controlplane --ignore-daemonsets --delete-emptydir-data >/dev/null 2>&1
apt-get install -y -qq kubelet='1.36.5-1.1' kubectl='1.36.5-1.1' >/dev/null 2>&1; apt-mark hold kubelet kubectl >/dev/null
systemctl daemon-reload && systemctl restart kubelet
for i in $(seq 60); do kubectl uncordon controlplane >/dev/null 2>&1 && break; sleep 2; done
for i in $(seq 60); do [ "$(kubectl get node controlplane -o jsonpath='{.status.nodeInfo.kubeletVersion}')" = "v1.36.5" ] && break; sleep 2; done
-->

## Upgrading node01

On the worker node the procedure is similar, with `kubeadm upgrade node` instead of `apply`:

1. on `node01`: kubeadm `1.36.5-1.1`, then `kubeadm upgrade node`,
2. from `controlplane`: `kubectl drain node01 --ignore-daemonsets`,
3. on `node01`: kubelet and kubectl `1.36.5-1.1`, `daemon-reload`, restart the kubelet,
4. from `controlplane`: `kubectl uncordon node01`.

At the end both replicas of the `web` deployment must be running.

<!-- verify
v=$(kubectl get node node01 -o jsonpath='{.status.nodeInfo.kubeletVersion}')
[ "$v" = "v1.36.5" ] || { echo "the kubelet on node01 is $v"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.spec.unschedulable}')" != "true" ] || { echo "node01 is still cordoned"; exit 1; }
[ "$(kubectl get deploy web -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "deployment web does not have 2 ready replicas"; exit 1; }
-->
<!-- hint
Run `drain` from controlplane (that is where the kubeconfig is). If `kubectl get nodes` shows node01 as `NotReady` after the kubelet restart, check `ssh node01 journalctl -u kubelet -n 30`.
-->
<!-- solution
ssh node01 "apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq kubeadm='1.36.5-1.1' >/dev/null 2>&1; kubeadm upgrade node >/dev/null 2>&1"
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data >/dev/null 2>&1
ssh node01 "apt-get install -y -qq kubelet='1.36.5-1.1' kubectl='1.36.5-1.1' >/dev/null 2>&1; apt-mark hold kubeadm kubelet kubectl >/dev/null; systemctl daemon-reload; systemctl restart kubelet"
for i in $(seq 60); do kubectl uncordon node01 >/dev/null 2>&1 && break; sleep 2; done
for i in $(seq 90); do [ "$(kubectl get node node01 -o jsonpath='{.status.nodeInfo.kubeletVersion}')" = "v1.36.5" ] && break; sleep 2; done
kubectl rollout status deploy/web --timeout=180s
-->
