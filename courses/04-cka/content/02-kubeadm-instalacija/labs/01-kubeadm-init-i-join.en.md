# Lab 1: A cluster from scratch with kubeadm

Two nodes (`controlplane` and `node01`) have containerd, kubelet, kubeadm and kubectl installed, but there is no cluster yet. You will build it yourself:

1. `kubeadm init` on `controlplane`,
2. a kubeconfig for `root`,
3. a CNI plugin,
4. `kubeadm join` for `node01`.

This is a "Cluster Setup and Node Join" type of task. On the exam you usually get a ready-made config file or the exact parameters (version, pod CIDR).

<!-- setup
set -e
cluster-up --bare
cat > /root/kubeadm-config.yaml <<'EOF'
apiVersion: kubeadm.k8s.io/v1beta4
kind: InitConfiguration
nodeRegistration:
  name: controlplane
  criSocket: unix:///run/containerd/containerd.sock
---
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: v1.35.0
clusterName: kubernetes
# TODO: controlPlaneEndpoint (stabilna adresa API servera, port 6443)
networking:
  serviceSubnet: 10.96.0.0/12
  # TODO: podSubnet
---
# Potrebno samo u ovom lab okruženju: čvorovi su Docker kontejneri (kao kind),
# pa kubelet i kube-proxy ne smiju dirati neke postavke host kernela.
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cgroupDriver: systemd
cgroupRoot: /kubelet
failSwapOn: false
---
apiVersion: kubeproxy.config.k8s.io/v1alpha1
kind: KubeProxyConfiguration
conntrack:
  maxPerCore: 0
EOF
-->

## kubeadm init

Complete `/root/kubeadm-config.yaml` (the two `TODO` lines; the comments in the file are in Serbian):

- `controlPlaneEndpoint: controlplane:6443`
- `podSubnet: 10.244.0.0/16` (under `networking`)

Then initialize the control plane and set up `kubectl` for the root user:

```bash
vim /root/kubeadm-config.yaml
kubeadm init --config /root/kubeadm-config.yaml
mkdir -p $HOME/.kube
cp /etc/kubernetes/admin.conf $HOME/.kube/config
kubectl get nodes
```

At the end, `kubeadm init` prints a `kubeadm join …` command. Save it; if you lose it, create a new one with `kubeadm token create --print-join-command`.

<!-- verify
[ -f /etc/kubernetes/admin.conf ] || { echo "kubeadm init has not been run yet"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "kubectl does not work: is /root/.kube/config missing?"; exit 1; }
cfg=$(kubectl -n kube-system get cm kubeadm-config -o jsonpath='{.data.ClusterConfiguration}')
echo "$cfg" | grep -q 'podSubnet: 10.244.0.0/16' || { echo "podSubnet is not 10.244.0.0/16"; exit 1; }
echo "$cfg" | grep -q 'controlPlaneEndpoint: controlplane:6443' || { echo "controlPlaneEndpoint is not controlplane:6443"; exit 1; }
-->
<!-- hint
If init failed because of an error in the config, clean up the node before retrying: `kubeadm reset -f`. To check preflight errors, look at the output lines starting with `[ERROR`.
-->
<!-- solution
sed -i 's|^# TODO: controlPlaneEndpoint.*|controlPlaneEndpoint: controlplane:6443|; s|^  # TODO: podSubnet|  podSubnet: 10.244.0.0/16|' /root/kubeadm-config.yaml
kubeadm init --config /root/kubeadm-config.yaml > /root/kubeadm-init.out 2>&1
mkdir -p /root/.kube && cp /etc/kubernetes/admin.conf /root/.kube/config
-->

## CNI plugin

The node is `NotReady` and the CoreDNS Pods are `Pending`. The kubelet reports `cni plugin not initialized` because no network plugin is installed yet.

Install the CNI from the manifest `/opt/kurs/manifests/kindnet.yaml` (kindnet, the same one used in kind clusters). Before that, check that the pod CIDR in the manifest matches the cluster's `podSubnet`.

```bash
kubectl describe node controlplane | grep -i network
grep -A1 POD_SUBNET /opt/kurs/manifests/kindnet.yaml
kubectl apply -f /opt/kurs/manifests/kindnet.yaml
kubectl get nodes -w
```

<!-- verify
[ "$(kubectl get node controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "controlplane is not Ready"; exit 1; }
kubectl -n kube-system get ds kindnet >/dev/null 2>&1 || { echo "the kindnet DaemonSet does not exist"; exit 1; }
[ "$(kubectl -n kube-system get deploy coredns -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "CoreDNS is not ready yet"; exit 1; }
-->
<!-- hint
After `kubectl apply` the node becomes `Ready` within 10-20 seconds. If it stays `NotReady`: `kubectl -n kube-system get pods -o wide` and `kubectl -n kube-system logs ds/kindnet`.
-->
<!-- solution
kubectl apply -f /opt/kurs/manifests/kindnet.yaml >/dev/null
kubectl wait --for=condition=Ready node/controlplane --timeout=180s
kubectl -n kube-system rollout status deploy/coredns --timeout=180s
-->

## Join node01

Join `node01` to the cluster as a worker node. The join command is run **on node01**.

```bash
kubeadm token create --print-join-command
ssh node01
# paste the join command, then: exit
kubectl get nodes
```

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ] || { echo "node01 is not in the cluster or is not Ready"; exit 1; }
-->
<!-- hint
The join on `node01` may report warnings from the preflight checks; what matters is that it ends with "This node has joined the cluster". If you ran the join twice: run `kubeadm reset -f` on node01, then try again.
-->
<!-- solution
J=$(kubeadm token create --print-join-command)
ssh node01 "$J" > /root/kubeadm-join.out 2>&1
kubectl wait --for=condition=Ready node/node01 --timeout=180s
-->

## Worker node role

`kubectl get nodes` shows `ROLES <none>` for `node01`. The column is filled from `node-role.kubernetes.io/<role>` labels.

Add the label `node-role.kubernetes.io/worker` (empty value) to `node01` so the column shows `worker`. Then create a deployment `test` with 2 replicas (`nginx:1.28`) and check that the Pods run on `node01`.

<!-- verify
kubectl get node node01 --show-labels | grep -q 'node-role.kubernetes.io/worker' || { echo "node01 does not have the node-role.kubernetes.io/worker label"; exit 1; }
[ "$(kubectl get deploy test -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "2" ] || { echo "deployment test does not have 2 ready replicas"; exit 1; }
-->
<!-- hint
`kubectl label node node01 node-role.kubernetes.io/worker=` and `kubectl create deploy test --image=nginx:1.28 --replicas=2`. The Pods go to node01 because controlplane has the `node-role.kubernetes.io/control-plane:NoSchedule` taint.
-->
<!-- solution
kubectl label node node01 node-role.kubernetes.io/worker= --overwrite
kubectl create deploy test --image=nginx:1.28 --replicas=2
kubectl rollout status deploy/test --timeout=120s
-->
