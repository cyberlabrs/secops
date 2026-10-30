# Lab 2: Nadogradnja klastera sa 1.35 na 1.36

Klaster radi na Kubernetes **v1.35.0**. Nadogradi ga na **v1.36.5**: prvo kontrolnu ravan, pa radni čvor. Postupak prati zvaničnu dokumentaciju („Upgrading kubeadm clusters“).

Paketi dolaze iz apt repozitorija koji je već podešen na oba čvora (`/etc/apt/sources.list.d/kubernetes.list`). Na ispitu je to `pkgs.k8s.io` repozitorij za ciljnu minor verziju.

```bash
kubectl get nodes
apt-get update && apt-cache madison kubeadm
```

<!-- setup
set -e
cluster-up
kubectl create deploy web --image=nginx:1.28 --replicas=2 >/dev/null
-->

## kubeadm na controlplane

Na `controlplane` instaliraj `kubeadm` verzije `1.36.5-1.1` i pogledaj plan nadogradnje.

```bash
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm='1.36.5-1.1'
apt-mark hold kubeadm
kubeadm version
kubeadm upgrade plan
```

<!-- verify
kubeadm version -o short | grep -q '^v1.36.5$' || { echo "kubeadm na controlplane nije v1.36.5"; exit 1; }
-->
<!-- solution
apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq kubeadm='1.36.5-1.1' >/dev/null 2>&1; apt-mark hold kubeadm >/dev/null
-->

## Nadogradnja kontrolne ravni

Primijeni nadogradnju na kontrolnu ravan. Komanda traje 2-3 minute: kubeadm mijenja manifeste static Podova i čeka da se svaka komponenta podigne.

```bash
kubeadm upgrade apply v1.36.5
kubectl -n kube-system get pods -o wide
```

<!-- verify
img=$(kubectl -n kube-system get pod kube-apiserver-controlplane -o jsonpath='{.spec.containers[0].image}')
case "$img" in *:v1.36.5) ;; *) echo "kube-apiserver je još $img"; exit 1 ;; esac
-->
<!-- hint
Ako upgrade stane na pre-flight provjeri, pročitaj tačnu `[ERROR …]` liniju. `kubeadm upgrade apply` se može ponovo pokrenuti. Ne nadograđuj direktno sa 1.35 na 1.37: preskakanje minor verzija nije podržano.
-->
<!-- solution
kubeadm upgrade apply v1.36.5 -y > /root/upgrade-apply.out 2>&1
-->

## kubelet i kubectl na controlplane

`kubectl get nodes` i dalje prikazuje `v1.35.0` za controlplane, jer kolona `VERSION` pokazuje verziju **kubeleta**. Nadogradi kubelet i kubectl:

1. isprazni čvor (`drain`),
2. instaliraj `kubelet` i `kubectl` `1.36.5-1.1`,
3. `systemctl daemon-reload` i restart kubeleta,
4. vrati čvor u raspoređivanje (`uncordon`).

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
[ "$v" = "v1.36.5" ] || { echo "kubelet na controlplane je $v"; exit 1; }
[ "$(kubectl get node controlplane -o jsonpath='{.spec.unschedulable}')" != "true" ] || { echo "controlplane je još cordon (SchedulingDisabled)"; exit 1; }
kubectl version --client -o json | grep -q '"gitVersion": "v1.36.5"' || { echo "kubectl nije v1.36.5"; exit 1; }
-->
<!-- solution
kubectl drain controlplane --ignore-daemonsets --delete-emptydir-data >/dev/null 2>&1
apt-get install -y -qq kubelet='1.36.5-1.1' kubectl='1.36.5-1.1' >/dev/null 2>&1; apt-mark hold kubelet kubectl >/dev/null
systemctl daemon-reload && systemctl restart kubelet
for i in $(seq 60); do kubectl uncordon controlplane >/dev/null 2>&1 && break; sleep 2; done
for i in $(seq 60); do [ "$(kubectl get node controlplane -o jsonpath='{.status.nodeInfo.kubeletVersion}')" = "v1.36.5" ] && break; sleep 2; done
-->

## Nadogradnja node01

Na radnom čvoru je postupak sličan, uz `kubeadm upgrade node` umjesto `apply`:

1. na `node01`: kubeadm `1.36.5-1.1`, pa `kubeadm upgrade node`,
2. sa `controlplane`: `kubectl drain node01 --ignore-daemonsets`,
3. na `node01`: kubelet i kubectl `1.36.5-1.1`, `daemon-reload`, restart kubeleta,
4. sa `controlplane`: `kubectl uncordon node01`.

Na kraju moraju raditi obje replike deploymenta `web`.

<!-- verify
v=$(kubectl get node node01 -o jsonpath='{.status.nodeInfo.kubeletVersion}')
[ "$v" = "v1.36.5" ] || { echo "kubelet na node01 je $v"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.spec.unschedulable}')" != "true" ] || { echo "node01 je još cordon"; exit 1; }
[ "$(kubectl get deploy web -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "deployment web nema 2 spremne replike"; exit 1; }
-->
<!-- hint
`drain` pokreni sa controlplane (tamo je kubeconfig). Ako `kubectl get nodes` pokazuje node01 `NotReady` poslije restarta kubeleta, pogledaj `ssh node01 journalctl -u kubelet -n 30`.
-->
<!-- solution
ssh node01 "apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq kubeadm='1.36.5-1.1' >/dev/null 2>&1; kubeadm upgrade node >/dev/null 2>&1"
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data >/dev/null 2>&1
ssh node01 "apt-get install -y -qq kubelet='1.36.5-1.1' kubectl='1.36.5-1.1' >/dev/null 2>&1; apt-mark hold kubeadm kubelet kubectl >/dev/null; systemctl daemon-reload; systemctl restart kubelet"
for i in $(seq 60); do kubectl uncordon node01 >/dev/null 2>&1 && break; sleep 2; done
for i in $(seq 90); do [ "$(kubectl get node node01 -o jsonpath='{.status.nodeInfo.kubeletVersion}')" = "v1.36.5" ] && break; sleep 2; done
kubectl rollout status deploy/web --timeout=180s
-->
