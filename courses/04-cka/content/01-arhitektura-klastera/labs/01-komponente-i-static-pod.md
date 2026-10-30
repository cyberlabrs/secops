# Lab 1: Komponente klastera i static Pod

Pred tobom je kubeadm klaster sa dva čvora: `controlplane` i `node01`. Na `node01` se prelazi sa `ssh node01`, a nazad sa `exit`.

Prvo ćeš pronaći gdje kubeadm drži konfiguraciju kontrolne ravni. Zatim napraviš **static Pod** na radnom čvoru, pa ga premjestiš na drugi čvor, kao u Killercoda zadatku „Static Pod Move“.

```bash
kubectl get nodes -o wide
kubectl -n kube-system get pods -o wide
```

<!-- setup
set -e
cluster-up
-->

## Konfiguracija kontrolne ravni

Komponente kontrolne ravni (kube-apiserver, etcd, scheduler, controller-manager) su static Podovi. Njihove manifeste kubelet čita iz direktorija zadanog u svojoj konfiguraciji.

1. U `/root/static-path.txt` upiši putanju direktorija sa static Pod manifestima na `controlplane`. Pročitaj je iz konfiguracije kubeleta (`/var/lib/kubelet/config.yaml`, polje `staticPodPath`).
2. U `/root/service-cidr.txt` upiši raspon IP adresa za Servise, onako kako je zadan flagom `--service-cluster-ip-range` u manifestu kube-apiservera.

```bash
grep staticPodPath /var/lib/kubelet/config.yaml
ls /etc/kubernetes/manifests/
grep service-cluster-ip-range /etc/kubernetes/manifests/kube-apiserver.yaml
```

<!-- verify
[ "$(tr -d ' \n' < /root/static-path.txt 2>/dev/null | sed 's#/$##')" = "/etc/kubernetes/manifests" ] || { echo "static-path.txt nije ispravan"; exit 1; }
want=$(grep -o 'service-cluster-ip-range=[^ ]*' /etc/kubernetes/manifests/kube-apiserver.yaml | cut -d= -f2)
[ "$(tr -d ' \n' < /root/service-cidr.txt 2>/dev/null)" = "$want" ] || { echo "service-cidr.txt nije ispravan (očekuje se raspon iz manifesta)"; exit 1; }
-->
<!-- hint
`awk '/staticPodPath/ {print $2}' /var/lib/kubelet/config.yaml > /root/static-path.txt`. Raspon servisa piši bez `--service-cluster-ip-range=`, samo CIDR (npr. `10.96.0.0/12`).
-->
<!-- solution
awk '/staticPodPath/ {print $2}' /var/lib/kubelet/config.yaml > /root/static-path.txt
grep -o 'service-cluster-ip-range=[^ ]*' /etc/kubernetes/manifests/kube-apiserver.yaml | cut -d= -f2 > /root/service-cidr.txt
-->

## Container runtime i CNI na node01

Kubelet sa runtimeom razgovara preko **CRI** socketa, a mrežu podovima postavlja **CNI** plugin čija je konfiguracija u `/etc/cni/net.d/`.

1. U `/root/runtime.txt` upiši runtime i njegovu verziju za `node01`, tačno kako ih prikazuje kolona `CONTAINER-RUNTIME` u `kubectl get nodes -o wide` (npr. `containerd://x.y.z`).
2. U `/root/cni.txt` upiši ime CNI konfiguracionog fajla na `node01` (samo ime fajla iz `/etc/cni/net.d/`).

```bash
kubectl get node node01 -o wide
ssh node01 ls /etc/cni/net.d/
ssh node01 crictl ps
```

<!-- verify
want=$(kubectl get node node01 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}')
[ "$(tr -d ' \n' < /root/runtime.txt 2>/dev/null)" = "$want" ] || { echo "runtime.txt nije ispravan"; exit 1; }
cni=$(ssh node01 ls /etc/cni/net.d/ | head -1)
[ "$(tr -d ' \n' < /root/cni.txt 2>/dev/null | xargs basename 2>/dev/null)" = "$cni" ] || { echo "cni.txt nije ispravan"; exit 1; }
-->
<!-- hint
`kubectl get node node01 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}' > /root/runtime.txt` i `ssh node01 ls /etc/cni/net.d/ > /root/cni.txt`.
-->
<!-- solution
kubectl get node node01 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}' > /root/runtime.txt
ssh node01 ls /etc/cni/net.d/ | head -1 > /root/cni.txt
-->

## Static Pod na node01

Na `node01` napravi static Pod:

- ime `static-web`, image `nginx:1.28`, port kontejnera 80,
- oznaka `app=static-web`.

Manifest ide u static Pod direktorij **na node01**. API server će prikazati „mirror“ Pod sa imenom `static-web-node01`.

```bash
kubectl run static-web --image=nginx:1.28 --port=80 -l app=static-web --dry-run=client -o yaml > static-web.yaml
scp static-web.yaml node01:/etc/kubernetes/manifests/
kubectl get pod static-web-node01 -o wide
```

<!-- verify
ph=$(kubectl get pod static-web-node01 -o jsonpath='{.status.phase}' 2>/dev/null)
[ "$ph" = "Running" ] || { echo "Pod static-web-node01 nije Running (trenutno: ${ph:-ne postoji})"; exit 1; }
[ "$(kubectl get pod static-web-node01 -o jsonpath='{.metadata.ownerReferences[0].kind}')" = "Node" ] || { echo "static-web-node01 nije static Pod"; exit 1; }
kubectl get pod static-web-node01 -o jsonpath='{.spec.containers[0].image}' | grep -q 'nginx:1.28' || { echo "image nije nginx:1.28"; exit 1; }
-->
<!-- hint
Mirror Pod se ne može obrisati sa `kubectl delete` (kubelet ga odmah vrati). Static Pod postoji dok postoji manifest na čvoru. Ako Pod ne nastaje, pogledaj `ssh node01 journalctl -u kubelet | tail`.
-->
<!-- solution
kubectl run static-web --image=nginx:1.28 --port=80 -l app=static-web --dry-run=client -o yaml > /root/static-web.yaml
scp -q /root/static-web.yaml node01:/etc/kubernetes/manifests/static-web.yaml
for i in $(seq 60); do [ "$(kubectl get pod static-web-node01 -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] && break; sleep 2; done
-->

## Premjesti static Pod na controlplane

Static Pod se ne „premješta“ kroz API. Premjesti manifest:

- `static-web` treba da radi na `controlplane` (mirror Pod `static-web-controlplane`),
- na `node01` više ne smije postojati.

<!-- verify
kubectl get pod static-web-node01 >/dev/null 2>&1 && { echo "static-web-node01 još postoji"; exit 1; }
[ "$(kubectl get pod static-web-controlplane -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "static-web-controlplane nije Running"; exit 1; }
-->
<!-- hint
`scp node01:/etc/kubernetes/manifests/static-web.yaml /etc/kubernetes/manifests/`, pa na node01 ukloni manifest iz `/etc/kubernetes/manifests/` (npr. premjesti ga u `/root/`). Kubelet provjerava direktorij svakih nekoliko sekundi.
-->
<!-- solution
scp -q node01:/etc/kubernetes/manifests/static-web.yaml /etc/kubernetes/manifests/static-web.yaml
ssh node01 mv /etc/kubernetes/manifests/static-web.yaml /root/static-web.yaml
for i in $(seq 60); do kubectl get pod static-web-node01 >/dev/null 2>&1 || break; sleep 2; done
for i in $(seq 60); do [ "$(kubectl get pod static-web-controlplane -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] && break; sleep 2; done
-->
