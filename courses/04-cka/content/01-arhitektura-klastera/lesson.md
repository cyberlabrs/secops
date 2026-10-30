## Šta ovaj modul pokriva

Modul pripada domenu 1 (**Cluster Architecture, Installation & Configuration**, 25% ispita) i pokriva dva cilja:

- **1.2** priprema infrastrukture za instalaciju klastera (čvor, kernel, container runtime, cgroup driver, swap),
- **1.7** razumijevanje interfejsa za proširenja: **CRI** (Container Runtime Interface), **CNI** (Container Network Interface) i **CSI** (Container Storage Interface).

Kao korisnik Kubernetesa do sada si vidio samo API: `kubectl apply` i rezultat. Ovdje gledamo šta stoji iza API-ja: koji procesi rade na kojem čvoru, ko pokreće kontejnere i gdje su konfiguracioni fajlovi. Na ispitu se ovo rijetko pita direktno, ali je osnova za skoro sve zadatke iz troubleshootinga (30% ispita). Tipični zadaci:

- „Na čvoru `node01` kubelet ne radi. Popravi.“
- „Napravi static Pod `nginx-static` na čvoru `node01`.“
- „Pronađi koji CNI plugin je instaliran i zapiši ime konfiguracionog fajla u `/opt/answer.txt`.“
- „Pomoću `crictl` pronađi kontejner koji pada i zapiši njegov log.“
- „Pripremi čvor za instalaciju: uključi IP forwarding i učitaj potrebne module.“

## Komponente klastera

Klaster ima **control plane** (kontrolnu ravan) i **worker** čvorove. Kod kubeadm klastera komponente kontrolne ravni rade kao **static Pods** na control plane čvoru, a kubelet i container runtime rade kao obični **systemd** servisi na svakom čvoru.

| Komponenta | Gdje radi | Šta radi | Kako je vidiš |
|---|---|---|---|
| **kube-apiserver** | control plane | Jedina ulazna tačka u klaster; autentikacija, autorizacija, admission, upis u etcd | `kubectl -n kube-system get pod kube-apiserver-controlplane` |
| **etcd** | control plane (stacked) ili zasebni čvorovi | Key-value baza; jedino mjesto gdje se čuva stanje klastera | `etcd-controlplane` Pod |
| **kube-scheduler** | control plane | Bira čvor za Pod koji nema `spec.nodeName` | `kube-scheduler-controlplane` |
| **kube-controller-manager** | control plane | Petlje kontrolera (Deployment, ReplicaSet, Node, ServiceAccount tokeni…) | `kube-controller-manager-controlplane` |
| **kubelet** | svaki čvor | Pokreće Podove preko CRI-ja, javlja status čvora, pokreće static Pods | `systemctl status kubelet` |
| **kube-proxy** | svaki čvor (DaemonSet) | Pravila za Service VIP (iptables ili nftables) | `kubectl -n kube-system get ds kube-proxy` |
| **container runtime** | svaki čvor | Povlači image i pokreće kontejnere (containerd) | `systemctl status containerd` |
| **CoreDNS** | Deployment u `kube-system` | DNS za Service i Pod imena | `kubectl -n kube-system get deploy coredns` |

Važno je zapamtiti tok: **kubelet nije Pod**. Ako kubelet stane, čvor prelazi u `NotReady`, a `kubectl` ti ne može pomoći da ga pokreneš. Moraš se prijaviti na čvor (`ssh node01`) i koristiti `systemctl` i `journalctl`.

```bash
kubectl get nodes -o wide                 # verzija kubeleta, runtime, interni IP
kubectl -n kube-system get pods -o wide   # static Pods imaju sufiks imena čvora
kubectl get --raw='/readyz?verbose'       # zdravlje API servera po provjerama
```

> **Na ispitu:** Svaki zadatak počinje komandom `kubectl config use-context <ime>` koju ti daju u tekstu zadatka. Kopiraj je i pokreni prije svega ostalog. Rješenje urađeno na pogrešnom klasteru donosi nula bodova.

## kubelet

**kubelet** je agent na svakom čvoru. Prima specifikaciju Podova od API servera (i iz lokalnog direktorija za static Pods) i preko CRI-ja traži od runtime-a da ih pokrene.

Fajlovi koje treba znati na kubeadm čvoru:

| Fajl | Sadržaj |
|---|---|
| `/var/lib/kubelet/config.yaml` | **KubeletConfiguration**: `staticPodPath`, `cgroupDriver`, `clusterDNS`, `failSwapOn`… |
| `/etc/kubernetes/kubelet.conf` | kubeconfig kojim se kubelet prijavljuje API serveru |
| `/var/lib/kubelet/kubeadm-flags.env` | dodatni flagovi koje je kubeadm upisao (npr. `--node-ip`) |
| `/usr/lib/systemd/system/kubelet.service.d/10-kubeadm.conf` | systemd drop-in koji spaja sve gore navedeno |
| `/var/lib/kubelet/pki/` | klijentski certifikat kubeleta (rotira se automatski) |

```bash
ssh node01
systemctl status kubelet
journalctl -u kubelet --no-pager | tail -30
systemctl cat kubelet          # pokaže unit i drop-in fajlove
cat /var/lib/kubelet/config.yaml
```

Nakon izmjene `config.yaml` ili drop-in fajla:

```bash
systemctl daemon-reload        # samo ako si mijenjao unit/drop-in
systemctl restart kubelet
```

### Troubleshooting kubeleta

| Simptom u `journalctl -u kubelet` | Uzrok | Popravka |
|---|---|---|
| `failed to load kubelet config file` | Pogrešna putanja ili YAML greška u `config.yaml` | Ispravi fajl, `systemctl restart kubelet` |
| Poruka da swap nije podržan (`swap on is not supported`) | Swap uključen, a `failSwapOn` je `true` | `swapoff -a` i ukloni swap iz `/etc/fstab` |
| `connect: connection refused` prema `:6443` | API server ne radi ili pogrešan server u `kubelet.conf` | Provjeri API server i adresu u kubeconfigu |
| `x509: certificate has expired` | Istekao certifikat | Pogledaj modul o životnom ciklusu (certifikati) |
| Greška koja pominje cgroup driver (`systemd` vs `cgroupfs`) | Neusklađen cgroup driver kubeleta i runtime-a | Uskladi `cgroupDriver` i `SystemdCgroup` |
| Servis je `inactive (dead)` i `disabled` | Neko ga je zaustavio | `systemctl enable --now kubelet` |

> **Na ispitu:** Kad je čvor `NotReady`, prvo `ssh` na njega i `systemctl status kubelet`. Ako je `inactive`, nije uvijek kvar u konfiguraciji: često je dovoljno `systemctl enable --now kubelet`. Uvijek dodaj `enable`, da preživi restart.

## Static Pods

**Static Pod** je Pod koji kubelet pokreće direktno iz YAML fajla na disku, bez scheduler-a i bez kontrolera. Kubelet za svaki static Pod napravi **mirror Pod** u API serveru, pa ga vidiš u `kubectl get pods`, ali ga preko API-ja ne možeš trajno obrisati: kubelet ga odmah vrati. Ime mirror Poda je `<ime>-<ime-čvora>`.

Direktorij određuje polje `staticPodPath` u kubelet konfiguraciji. Kod kubeadm-a je to `/etc/kubernetes/manifests`:

```bash
grep staticPodPath /var/lib/kubelet/config.yaml
# staticPodPath: /etc/kubernetes/manifests
ls /etc/kubernetes/manifests
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```

Kreiranje static Poda na `node01`:

```bash
kubectl run nginx-static --image=nginx:1.27 --dry-run=client -o yaml > nginx-static.yaml
scp nginx-static.yaml node01:/tmp/
ssh node01
grep staticPodPath /var/lib/kubelet/config.yaml   # provjeri putanju, može biti promijenjena!
cp /tmp/nginx-static.yaml /etc/kubernetes/manifests/
exit
kubectl get pod nginx-static-node01
```

Pravila koja treba zapamtiti:

- Kubelet periodično gleda direktorij; nema `kubectl apply`. Izmjena fajla = kubelet ponovo kreira Pod.
- **Brisanje** static Poda = brisanje fajla iz direktorija. `kubectl delete pod` samo privremeno ukloni mirror Pod.
- Specifikacija static Poda ne smije referencirati druge API objekte (ConfigMap, Secret, ServiceAccount): kubelet ga pravi i kad API server ne radi. Kontrolna ravan zato koristi `hostPath` volumene.
- Static Pods se ne raspoređuju schedulerom. Rade i kad scheduler ne radi, zato kontrolna ravan može sama sebe podići.

> **Na ispitu:** Kad zadatak kaže „napravi static Pod na čvoru X“, ne pretpostavljaj putanju. Pogledaj `staticPodPath` u `/var/lib/kubelet/config.yaml` na tom čvoru. Zadatak može namjerno imati drugi direktorij.

### Kako popraviti pokvarenu kontrolnu ravan

Ako neko pokvari `/etc/kubernetes/manifests/kube-apiserver.yaml` (pogrešan flag, pogrešna putanja do certifikata), `kubectl` prestaje raditi. Tada:

```bash
crictl ps -a | grep kube-apiserver        # da li kontejner postoji i pada?
crictl logs <container-id>                # poruka greške
journalctl -u kubelet | grep -i apiserver # kubelet ne može ni da parsira YAML?
ls /var/log/pods/ | grep apiserver        # logovi ostaju i kad kontejner nestane
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

Prije izmjene napravi kopiju **van** direktorija manifesta (`cp kube-apiserver.yaml /root/kube-apiserver.yaml.bak`). Kopija u istom direktoriju bi se pokrenula kao drugi static Pod.

## CRI, containerd i crictl

**CRI** je gRPC interfejs između kubeleta i container runtime-a. Kubelet ne zna ništa o containerd-u ili CRI-O-u, samo o CRI socketu. Docker Engine nije CRI runtime; od uklanjanja **dockershim** (v1.24) treba ti containerd, CRI-O ili `cri-dockerd`.

| Runtime | CRI socket (Linux) |
|---|---|
| containerd | `unix:///run/containerd/containerd.sock` |
| CRI-O | `unix:///var/run/crio/crio.sock` |
| Docker Engine + cri-dockerd | `unix:///var/run/cri-dockerd.sock` |

U lab okruženju i na ispitu runtime je **containerd**. Konfiguracija je u `/etc/containerd/config.toml`.

Bitno za 1.35: ovo je **posljednja verzija koja podržava containerd 1.7**. Od sljedeće verzije treba containerd 2.x. Takođe, 1.35 povlači podršku za **cgroup v1**: na distribucijama bez cgroup v2 kubelet podrazumijevano neće startovati.

### crictl

**crictl** je CLI za CRI. Radi sa bilo kojim CRI runtime-om i vidi isto što i kubelet. Koristiš ga kad API server ne radi ili kad trebaš detalje sa samog čvora.

```bash
cat /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock

crictl pods                         # pod sandboxovi na čvoru
crictl ps                           # kontejneri koji rade
crictl ps -a                        # i oni koji su izašli (CrashLoop!)
crictl ps --name kube-apiserver     # filter po imenu
crictl logs <container-id>          # log kontejnera
crictl logs --tail 20 <container-id>
crictl inspect <container-id>       # JSON detalji: mountovi, exit code
crictl images                       # image-i na čvoru
crictl pull busybox:1.36
crictl rmi <image-id>
crictl stats                        # potrošnja resursa
```

| Alat | Nivo | Kad ga koristiš |
|---|---|---|
| `kubectl` | Kubernetes API | Normalan rad, API server dostupan |
| `crictl` | CRI (kubelet pogled) | Debug na čvoru, API server ne radi |
| `ctr` | containerd interno (namespace `k8s.io`) | Rijetko; niski nivo, ne poznaje Podove |

> **Na ispitu:** `crictl ps` prikazuje samo kontejnere koji rade. Kontejner koji se stalno ruši vidiš tek sa `crictl ps -a`. Zadaci tipa „zapiši ID kontejnera koji pada“ traže upravo to.

## CNI

**CNI** definiše kako runtime dodjeljuje mrežu Pod sandboxu. Kad kubelet kreira Pod, containerd pozove CNI plugin koji napravi mrežni interfejs u Pod namespace-u i dodijeli mu IP.

Dvije lokacije koje moraš znati:

| Putanja | Šta je tamo |
|---|---|
| `/etc/cni/net.d/` | Konfiguracija (`*.conf` ili `*.conflist`). Koristi se **prvi fajl po abecedi**. |
| `/opt/cni/bin/` | Izvršni plugini (`bridge`, `host-local`, `loopback`, `portmap`, plus plugin samog CNI-ja) |

```bash
ls /etc/cni/net.d/
# 10-kindnet.conflist   (u labu)
cat /etc/cni/net.d/10-kindnet.conflist | head -20
ls /opt/cni/bin/
kubectl -n kube-system get ds         # CNI agent obično radi kao DaemonSet
```

Sam CNI plugin samo postavlja mrežu za jedan Pod. Projekti kao Calico, Cilium, Flannel ili kindnet dodaju **DaemonSet** koji na svaki čvor upiše konfiguraciju, kopira binarne fajlove i održava rute između čvorova.

| CNI | NetworkPolicy | Napomena |
|---|---|---|
| Flannel | Ne | Jednostavan overlay (VXLAN), podrazumijevani CIDR `10.244.0.0/16` |
| Calico | Da | BGP ili overlay, česta produkcijska opcija |
| Cilium | Da | eBPF, može zamijeniti kube-proxy |
| kindnet | Da (u novijim verzijama) | CNI u labu ovog kursa |

### Troubleshooting CNI-ja

- Čvor je `NotReady`, a u `kubectl describe node` piše `NetworkReady=false` i `cni plugin not initialized`: u `/etc/cni/net.d/` nema konfiguracije. CNI nije instaliran ili njegov DaemonSet ne radi na tom čvoru.
- Pod visi u `ContainerCreating`, a događaj kaže `failed to setup network for sandbox`: provjeri da li je plugin naveden u konfiguraciji prisutan u `/opt/cni/bin/` i logove CNI DaemonSet Poda na tom čvoru.
- Podovi na različitim čvorovima ne mogu da se vide: pogledaj `--pod-network-cidr` iz instalacije i CIDR u konfiguraciji CNI-ja; moraju se slagati.

> **Na ispitu:** Pitanje „koji CNI je instaliran“ rješavaš sa `ls /etc/cni/net.d/` i `kubectl -n kube-system get ds`. Ne traži po `/etc/kubernetes`, CNI tamo nema konfiguraciju.

## CSI

**CSI** je standardni interfejs za storage drivere. Prije CSI-ja kod za svaki storage bio je ugrađen u Kubernetes („in-tree“); danas su ti driveri migrirani na CSI, a novi postoje samo kao CSI.

CSI driver se tipično sastoji od:

- **controller plugina** (Deployment ili StatefulSet): kreira i briše volumene u storage sistemu, sa sidecar kontejnerima kao `external-provisioner`, `external-attacher`, `external-resizer`, `external-snapshotter`;
- **node plugina** (DaemonSet): mountuje volumen na čvoru; sidecar `node-driver-registrar` ga registruje kod kubeleta.

```bash
kubectl get csidrivers           # registrovani CSI driveri
kubectl get csinodes             # koji driveri su dostupni na kojem čvoru
kubectl get storageclass         # polje PROVISIONER kaže ko kreira volumene
kubectl get volumeattachments    # attach operacije CSI drivera
```

U labu StorageClass `local-path` koristi rancher local-path provisioner. On nije CSI driver, nego običan kontroler koji pravi `hostPath`/`local` PersistentVolume. Zato `kubectl get csidrivers` u labu može biti prazan iako dinamičko kreiranje volumena radi.

### Poređenje interfejsa

| Interfejs | Ko ga poziva | Implementacije | Konfiguracija na čvoru |
|---|---|---|---|
| **CRI** | kubelet | containerd, CRI-O | `/etc/containerd/config.toml`, `/etc/crictl.yaml` |
| **CNI** | container runtime (pri kreiranju sandboxa) | Calico, Cilium, Flannel, kindnet | `/etc/cni/net.d/`, `/opt/cni/bin/` |
| **CSI** | kubelet (node dio) i CSI kontroleri | EBS CSI, Ceph CSI, NFS CSI | Socketi u `/var/lib/kubelet/plugins/` |

Za potpunost: **Device plugin** API (GPU-ovi) i **CRD + operator** obrazac (modul 5) su takođe načini proširenja, ali ne zahtijevaju izmjenu koda Kubernetesa.

## Priprema čvora (cilj 1.2)

Prije `kubeadm init` ili `kubeadm join` svaki čvor mora ispuniti uslove. kubeadm u fazi **preflight** provjerava većinu ovoga i prekida ako nešto fali.

### 1. Swap

Kubelet podrazumijevano odbija da startuje ako je swap uključen (`failSwapOn: true`). Najjednostavnije je isključiti swap:

```bash
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab     # trajno
free -h                                  # Swap: 0B
```

Alternativa je `failSwapOn: false` u KubeletConfiguration. Tada kubelet toleriše swap, ali Podovi ga i dalje ne koriste dok ne postaviš `swapBehavior` (podrazumijevano `NoSwap`).

### 2. Kernel moduli i sysctl

Kubernetes dokumentacija danas obavezno traži samo IPv4 forwarding. Većina vodiča i CNI-jeva dodaje i module `overlay` (za overlayfs koji koristi containerd) i `br_netfilter` (da saobraćaj kroz Linux bridge prolazi kroz iptables).

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

sysctl net.ipv4.ip_forward               # mora biti 1
lsmod | grep -E 'overlay|br_netfilter'
```

Sysctl `net.bridge.*` postoji tek kad je `br_netfilter` učitan. Ako `sysctl --system` javi „No such file or directory“ za te ključeve, prvo učitaj modul.

### 3. Container runtime i cgroup driver

Kubelet i runtime moraju koristiti **isti cgroup driver**. Na sistemima sa systemd-om i **cgroup v2** preporuka je `systemd`. kubeadm od v1.22 podrazumijevano postavlja `cgroupDriver: systemd` u KubeletConfiguration, pa obično treba podesiti samo containerd:

```bash
containerd config default > /etc/containerd/config.toml
grep -n SystemdCgroup /etc/containerd/config.toml
```

```toml
# containerd 2.x
[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc.options]
  SystemdCgroup = true

# containerd 1.7 (stari format)
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
  SystemdCgroup = true
```

```bash
systemctl restart containerd
systemctl enable --now containerd
stat -fc %T /sys/fs/cgroup/      # cgroup2fs = cgroup v2
```

Kubelet sa novijim containerd-om (2.x) može sam pročitati cgroup driver iz runtime-a preko CRI-ja (`KubeletCgroupDriverFromCRI`). Sa containerd 1.7 to ne radi i važi vrijednost iz kubelet konfiguracije, pa usklađenost i dalje moraš znati.

> **Na ispitu:** Ne mijenjaj cgroup driver na čvoru koji je već u klasteru, osim ako to zadatak izričito traži. Postojeći Podovi mogu prestati da se pokreću; preporučen put je ponovno dodavanje čvora.

### 4. Paketi i portovi

Paketi `kubeadm`, `kubelet` i `kubectl` dolaze iz repozitorija **pkgs.k8s.io**, gdje svaka minor verzija ima svoj repozitorij (`https://pkgs.k8s.io/core:/stable:/v1.35/deb/`). Nakon instalacije se „zamrzavaju“ sa `apt-mark hold kubelet kubeadm kubectl` da ih `apt upgrade` slučajno ne nadogradi.

Portovi kontrolne ravni: `6443` (API server), `2379-2380` (etcd), `10250` (kubelet API), `10257` (controller-manager), `10259` (scheduler). Worker: `10250`, `10256` (kube-proxy health) i NodePort opseg `30000-32767`.

```bash
ss -tlnp | grep -E '6443|2379|10250'
nc -zv controlplane 6443
```

## kubectl i kubeconfig

**kubeconfig** fajl ima tri liste: **clusters** (adresa API servera i CA), **users** (kredencijali) i **contexts** (par klaster + korisnik + podrazumijevani namespace). Polje `current-context` kaže koji kontekst je aktivan.

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context kubernetes-admin@kubernetes
kubectl config set-context --current --namespace=dev   # promijeni default namespace
kubectl config view --minify                           # samo aktivni kontekst
kubectl --kubeconfig /etc/kubernetes/admin.conf get nodes
```

Redoslijed: flag `--kubeconfig`, zatim varijabla `KUBECONFIG` (može biti lista fajlova spojenih sa `:`), pa `~/.kube/config`.

kubeadm na control plane čvoru pravi više kubeconfig fajlova u `/etc/kubernetes/`:

| Fajl | Ko ga koristi |
|---|---|
| `admin.conf` | administrator (grupa `kubeadm:cluster-admins`) |
| `super-admin.conf` | hitni pristup, `system:masters`; ne dijeli se |
| `controller-manager.conf`, `scheduler.conf` | odgovarajuće komponente |
| `kubelet.conf` | kubelet na tom čvoru |

Korisne prečice za brzinu:

```bash
alias k=kubectl                                  # u labu već postoji
export do="--dry-run=client -o yaml"
k run test --image=busybox:1.36 $do -- sleep 3600 > pod.yaml
k explain pod.spec.containers.securityContext
k explain deployment.spec.strategy --recursive
k get pods -A --field-selector spec.nodeName=node01
```

> **Na ispitu:** `kubectl explain <resurs>.<polje>` je brži od pretrage dokumentacije kad zaboraviš tačno ime polja. Za cijeli manifest koristi `--dry-run=client -o yaml`, pa doradi u vim-u.

## Troubleshooting: brzi pregled

| Problem | Gdje gledaš |
|---|---|
| Čvor `NotReady` | `kubectl describe node` (Conditions), `ssh` na čvor, `systemctl status kubelet`, `journalctl -u kubelet` |
| `kubectl` ne radi (connection refused) | `crictl ps -a \| grep apiserver`, `crictl logs`, `/etc/kubernetes/manifests/kube-apiserver.yaml` |
| Pod `ContainerCreating` sa mrežnom greškom | `/etc/cni/net.d/`, `/opt/cni/bin/`, CNI DaemonSet |
| Pod `Pending`, ništa se ne raspoređuje | `kube-scheduler` Pod u `kube-system` |
| Deployment ne pravi Podove | `kube-controller-manager` Pod |
| Image se ne može povući na čvoru | `crictl pull <image>` na čvoru, `journalctl -u containerd` |

## Rezime

- Kontrolna ravan (kube-apiserver, etcd, scheduler, controller-manager) kod kubeadm-a radi kao static Pods iz `/etc/kubernetes/manifests`; kubelet i containerd su systemd servisi.
- Static Pod pravi kubelet iz fajla u `staticPodPath` (vidi `/var/lib/kubelet/config.yaml`); briše se uklanjanjem fajla, ne sa `kubectl delete`.
- Kubelet debuguješ na čvoru: `systemctl status kubelet`, `journalctl -u kubelet`, `systemctl enable --now kubelet`.
- `crictl` govori CRI i radi i kad API server ne radi; `crictl ps -a` i `crictl logs` su osnovni alati.
- CNI konfiguracija je u `/etc/cni/net.d/`, binarni plugini u `/opt/cni/bin/`; bez njih čvor ostaje `NotReady`.
- CSI driver ima controller dio (provisioning) i node dio (DaemonSet za mount); `kubectl get csidrivers,csinodes`.
- Priprema čvora: swap isključen, `net.ipv4.ip_forward=1`, moduli `overlay` i `br_netfilter`, containerd sa `SystemdCgroup = true`, paketi sa pkgs.k8s.io i `apt-mark hold`.
- Kontekst uvijek promijeni sa `kubectl config use-context` prije zadatka.
