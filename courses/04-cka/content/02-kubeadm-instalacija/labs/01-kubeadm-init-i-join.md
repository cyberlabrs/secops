# Lab 1: Klaster od nule sa kubeadm-om

Dva čvora (`controlplane` i `node01`) imaju instalirane containerd, kubelet, kubeadm i kubectl, ali klaster ne postoji. Napravićeš ga sam:

1. `kubeadm init` na `controlplane`,
2. kubeconfig za `root`,
3. CNI plugin,
4. `kubeadm join` za `node01`.

Ovo je zadatak tipa „Cluster Setup and Node Join“. Na ispitu se obično dobija gotov config fajl ili tačni parametri (verzija, pod CIDR).

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

Dopuni `/root/kubeadm-config.yaml` (dva `TODO` reda):

- `controlPlaneEndpoint: controlplane:6443`
- `podSubnet: 10.244.0.0/16` (pod `networking`)

Zatim inicijalizuj kontrolnu ravan i podesi `kubectl` za root korisnika:

```bash
vim /root/kubeadm-config.yaml
kubeadm init --config /root/kubeadm-config.yaml
mkdir -p $HOME/.kube
cp /etc/kubernetes/admin.conf $HOME/.kube/config
kubectl get nodes
```

`kubeadm init` na kraju ispiše `kubeadm join …` komandu. Sačuvaj je, a ako je izgubiš, napravi novu sa `kubeadm token create --print-join-command`.

<!-- verify
[ -f /etc/kubernetes/admin.conf ] || { echo "kubeadm init još nije pokrenut"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "kubectl ne radi: nedostaje /root/.kube/config?"; exit 1; }
cfg=$(kubectl -n kube-system get cm kubeadm-config -o jsonpath='{.data.ClusterConfiguration}')
echo "$cfg" | grep -q 'podSubnet: 10.244.0.0/16' || { echo "podSubnet nije 10.244.0.0/16"; exit 1; }
echo "$cfg" | grep -q 'controlPlaneEndpoint: controlplane:6443' || { echo "controlPlaneEndpoint nije controlplane:6443"; exit 1; }
-->
<!-- hint
Ako je init pao zbog greške u configu, prije ponovnog pokušaja očisti čvor: `kubeadm reset -f`. Provjera pre-flight grešaka: pogledaj izlaz koji počinje sa `[ERROR`.
-->
<!-- solution
sed -i 's|^# TODO: controlPlaneEndpoint.*|controlPlaneEndpoint: controlplane:6443|; s|^  # TODO: podSubnet|  podSubnet: 10.244.0.0/16|' /root/kubeadm-config.yaml
kubeadm init --config /root/kubeadm-config.yaml > /root/kubeadm-init.out 2>&1
mkdir -p /root/.kube && cp /etc/kubernetes/admin.conf /root/.kube/config
-->

## CNI plugin

Čvor je `NotReady`, a CoreDNS Podovi su `Pending`. Kubelet javlja `cni plugin not initialized`, jer mrežni plugin još nije instaliran.

Instaliraj CNI iz manifesta `/opt/kurs/manifests/kindnet.yaml` (kindnet, isti kao u kind klasterima). Prije toga provjeri da pod CIDR u manifestu odgovara `podSubnet` iz klastera.

```bash
kubectl describe node controlplane | grep -i network
grep -A1 POD_SUBNET /opt/kurs/manifests/kindnet.yaml
kubectl apply -f /opt/kurs/manifests/kindnet.yaml
kubectl get nodes -w
```

<!-- verify
[ "$(kubectl get node controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "controlplane nije Ready"; exit 1; }
kubectl -n kube-system get ds kindnet >/dev/null 2>&1 || { echo "kindnet DaemonSet ne postoji"; exit 1; }
[ "$(kubectl -n kube-system get deploy coredns -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "CoreDNS još nije spreman"; exit 1; }
-->
<!-- hint
Poslije `kubectl apply` čvor postaje `Ready` za 10-20 sekundi. Ako ostane `NotReady`: `kubectl -n kube-system get pods -o wide` i `kubectl -n kube-system logs ds/kindnet`.
-->
<!-- solution
kubectl apply -f /opt/kurs/manifests/kindnet.yaml >/dev/null
kubectl wait --for=condition=Ready node/controlplane --timeout=180s
kubectl -n kube-system rollout status deploy/coredns --timeout=180s
-->

## Priključi node01

Priključi `node01` u klaster kao radni čvor. Join komanda se izvršava **na node01**.

```bash
kubeadm token create --print-join-command
ssh node01
# zalijepi join komandu, pa: exit
kubectl get nodes
```

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ] || { echo "node01 nije u klasteru ili nije Ready"; exit 1; }
-->
<!-- hint
Join na `node01` može prijaviti upozorenja iz pre-flight provjera; bitno je da završi porukom „This node has joined the cluster“. Ako si join pokrenuo dva puta: na node01 `kubeadm reset -f`, pa ponovo.
-->
<!-- solution
J=$(kubeadm token create --print-join-command)
ssh node01 "$J" > /root/kubeadm-join.out 2>&1
kubectl wait --for=condition=Ready node/node01 --timeout=180s
-->

## Uloga radnog čvora

`kubectl get nodes` za `node01` prikazuje `ROLES <none>`. Kolona se popunjava iz oznaka `node-role.kubernetes.io/<uloga>`.

Dodaj `node01` oznaku `node-role.kubernetes.io/worker` (prazna vrijednost), tako da kolona prikaže `worker`. Zatim pokreni deployment `test` sa 2 replike (`nginx:1.28`) i provjeri da Podovi rade na `node01`.

<!-- verify
kubectl get node node01 --show-labels | grep -q 'node-role.kubernetes.io/worker' || { echo "node01 nema oznaku node-role.kubernetes.io/worker"; exit 1; }
[ "$(kubectl get deploy test -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "2" ] || { echo "deployment test nema 2 spremne replike"; exit 1; }
-->
<!-- hint
`kubectl label node node01 node-role.kubernetes.io/worker=` i `kubectl create deploy test --image=nginx:1.28 --replicas=2`. Podovi idu na node01 jer controlplane ima taint `node-role.kubernetes.io/control-plane:NoSchedule`.
-->
<!-- solution
kubectl label node node01 node-role.kubernetes.io/worker= --overwrite
kubectl create deploy test --image=nginx:1.28 --replicas=2
kubectl rollout status deploy/test --timeout=120s
-->
