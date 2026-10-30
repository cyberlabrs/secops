## Šta ovaj modul pokriva

Modul pripada domenu 1 (**Cluster Architecture, Installation & Configuration**, 25% ispita) i pokriva:

- **1.2** priprema infrastrukture (ovdje: preflight provjere i šta kubeadm očekuje od čvora; detalji pripreme su u prethodnom modulu),
- **1.3** kreiranje i upravljanje klasterom pomoću **kubeadm**-a (`init`, `join`, tokeni, `reset`),
- **1.5** visoko dostupna (**HA**) kontrolna ravan: topologije, load balancer, dodavanje control plane čvorova.

Na ispitu dobiješ čvorove na kojima su runtime i paketi već instalirani, a zadatak je da podigneš ili proširiš klaster. Tipični zadaci:

- „Inicijalizuj klaster na `controlplane` sa Pod CIDR-om `10.244.0.0/16` i instaliraj CNI iz `/opt/...`.“
- „Dodaj `node01` u klaster.“ (token je istekao, treba novi)
- „Zapiši komandu za priključivanje dodatnog control plane čvora u `/opt/answer.sh`.“
- „Čvor `node01` treba ukloniti iz klastera i očistiti.“

HA klaster sa tri control plane čvora ne možeš podići na ispitu (nema dovoljno mašina), ali moraš razumjeti pojmove i komande jer se pojavljuju u pitanjima i zadacima tipa „pripremi komandu“.

## Kako kubeadm radi

**kubeadm** podiže kontrolnu ravan na postojećem Linux čvoru. Ne instalira pakete, runtime ni CNI, ne pravi mašine i ne konfiguriše load balancer. Radi tri stvari:

1. generiše PKI (CA i certifikate) u `/etc/kubernetes/pki/` i kubeconfig fajlove u `/etc/kubernetes/`,
2. upisuje static Pod manifeste kontrolne ravni u `/etc/kubernetes/manifests/` i čeka da ih kubelet pokrene,
3. kroz API instalira addone (CoreDNS i kube-proxy) i pravi bootstrap token za priključivanje čvorova.

Posao je podijeljen u **faze** (phases). `kubeadm init` ih sve pokreće redom, a možeš pokrenuti i pojedinačnu fazu:

| Faza | Šta radi |
|---|---|
| `preflight` | Provjere: swap, portovi, `ip_forward`, CRI socket, verzije |
| `certs` | CA, apiserver, etcd, front-proxy certifikati, `sa.key`/`sa.pub` |
| `kubeconfig` | `admin.conf`, `super-admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf` |
| `etcd` / `control-plane` | Static Pod manifesti |
| `kubelet-start` | Upisuje `/var/lib/kubelet/config.yaml` i pokreće kubelet |
| `upload-config` | ConfigMap-ovi `kubeadm-config` i `kubelet-config` u `kube-system` |
| `upload-certs` | (samo uz `--upload-certs`) šifrovani certifikati u Secret `kubeadm-certs` |
| `mark-control-plane` | Label i taint `node-role.kubernetes.io/control-plane:NoSchedule` |
| `bootstrap-token` | Token i RBAC za join |
| `addon` | CoreDNS i kube-proxy |

```bash
kubeadm init phase upload-certs --upload-certs   # primjer pojedinačne faze
kubeadm init --skip-phases=addon/kube-proxy      # npr. kad Cilium zamjenjuje kube-proxy
```

## kubeadm init sa flagovima

Najkraći put na ispitu:

```bash
kubeadm init \
  --kubernetes-version=v1.35.0 \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.1.10 \
  --node-name=controlplane
```

Najvažniji flagovi:

| Flag | Značenje | Podrazumijevano |
|---|---|---|
| `--pod-network-cidr` | Opseg za Pod IP-ove; controller-manager iz njega dijeli `podCIDR` po čvoru | nema |
| `--service-cidr` | Opseg za ClusterIP servise | `10.96.0.0/12` |
| `--apiserver-advertise-address` | IP na kojem API server sluša i koji oglašava | IP podrazumijevanog interfejsa |
| `--control-plane-endpoint` | Stabilna adresa (DNS/IP i port) kontrolne ravni, za HA | nema |
| `--kubernetes-version` | Verzija kontrolne ravni | `stable-1` |
| `--cri-socket` | Socket runtime-a, kad ih ima više | automatska detekcija |
| `--upload-certs` | Šalje certifikate kontrolne ravni u klaster za HA join | isključeno |
| `--token-ttl` | Trajanje bootstrap tokena | `24h0m0s` |
| `--ignore-preflight-errors` | Npr. `Swap,NumCPU`; `all` ignoriše sve | nema |
| `--config` | YAML konfiguracija umjesto flagova | nema |
| `--dry-run` | Pokaže šta bi uradio, bez izmjena | — |

Kad `init` uspije, ispiše tri bitne stvari: kako da podesiš kubeconfig, da treba instalirati Pod mrežu i komandu `kubeadm join`. Kopiraj ih.

```bash
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
kubectl get nodes        # controlplane je NotReady dok ne instaliraš CNI
```

> **Na ispitu:** Ako zadatak navodi Pod CIDR, on mora biti isti u `kubeadm init --pod-network-cidr` i u konfiguraciji CNI-ja. Flannel podrazumijevano očekuje `10.244.0.0/16`. Pogrešan CIDR se ne popravlja lako: najbrže je `kubeadm reset` i ponovni `init`.

## kubeadm konfiguracioni fajl (v1beta4)

Za sve što nije pokriveno flagovima (dodatni argumenti API servera, kubelet podešavanja, validnost certifikata) koristi se konfiguracioni fajl. Trenutna verzija API-ja je **`kubeadm.k8s.io/v1beta4`**. Jedan fajl ima više YAML dokumenata odvojenih sa `---`:

| kind | Opseg |
|---|---|
| **InitConfiguration** | Ovaj čvor: `nodeRegistration` (ime, `criSocket`, taints), `localAPIEndpoint`, `bootstrapTokens` |
| **ClusterConfiguration** | Cijeli klaster: verzija, `controlPlaneEndpoint`, `networking`, `etcd`, `apiServer`, `certificateValidityPeriod` |
| **JoinConfiguration** | Za `kubeadm join --config` |
| **KubeletConfiguration** (`kubelet.config.k8s.io/v1beta1`) | Kubelet na svim čvorovima |
| **KubeProxyConfiguration** (`kubeproxy.config.k8s.io/v1alpha1`) | kube-proxy |
| **UpgradeConfiguration**, **ResetConfiguration** | Za `kubeadm upgrade` i `kubeadm reset` |

Primjer (sličan onome koji lab koristi u `/etc/kurs/kubeadm-init.yaml`):

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

Razlika u odnosu na stari v1beta3: **`extraArgs` je lista objekata `name`/`value`**, a ne mapa `ključ: vrijednost`. Ime je flag bez crtica. Stari oblik (mapa) uz `apiVersion: kubeadm.k8s.io/v1beta4` nije ispravan; postojeći fajl prevodiš sa `kubeadm config migrate`.

```bash
kubeadm config print init-defaults > init.yaml          # kostur sa svim poljima
kubeadm config print init-defaults --component-configs KubeletConfiguration
kubeadm config validate --config init.yaml
kubeadm config migrate --old-config old.yaml --new-config new.yaml   # v1beta3 -> v1beta4
kubeadm init --config init.yaml
kubeadm config images list --kubernetes-version v1.35.0
```

Napomena: `--config` se ne može kombinovati sa većinom flagova kao što su `--pod-network-cidr` ili `--certificate-key`. Sve ide u fajl.

Nakon instalacije kubeadm čuva ClusterConfiguration u ConfigMap-u `kubeadm-config` u `kube-system`. Odatle ga čitaju `kubeadm join` i `kubeadm upgrade`:

```bash
kubectl -n kube-system get cm kubeadm-config -o yaml
kubectl -n kube-system get cm kubelet-config -o yaml
```

> **Na ispitu:** Primjer konfiguracije nađeš u dokumentaciji pod „kubeadm Configuration (v1beta4)“ (kubernetes.io/docs/reference/config-api/kubeadm-config.v1beta4/). Brže je ipak `kubeadm config print init-defaults` pa izbrisati višak.

## Instalacija CNI-ja

Bez CNI-ja čvorovi ostaju `NotReady`, a CoreDNS Podovi `Pending`. CNI se instalira kao obični manifest ili Helm chart:

```bash
kubectl apply -f /opt/kurs/manifests/kube-flannel.yaml
kubectl -n kube-flannel get ds,pods -o wide
kubectl get nodes -w                   # NotReady -> Ready
ls /etc/cni/net.d/                     # 10-flannel.conflist
```

Ako CNI nije u zadatku dat lokalno, ispit dozvoljava samo kubernetes.io i helm.sh dokumentaciju; zato zadatak uvijek kaže odakle da ga instaliraš. Lab klaster podrazumijevano koristi kindnet; Flannel manifest je tu za vježbu instalacije od nule.

Provjera da je mreža proradila:

```bash
kubectl -n kube-system get pods -l k8s-app=kube-dns    # CoreDNS Running
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDR}{"\n"}{end}'
kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- nslookup kubernetes.default
```

## kubeadm join: worker čvor

Za join treba:

- **bootstrap token** (oblik `abcdef.0123456789abcdef`), traje 24h,
- **hash javnog ključa CA** (`--discovery-token-ca-cert-hash sha256:...`) da novi čvor provjeri da priča sa pravim klasterom,
- adresa API servera (ili `controlPlaneEndpoint`).

Kad je originalni token istekao, sve se dobije jednom komandom na control plane čvoru:

```bash
kubeadm token list
kubeadm token create --print-join-command
# kubeadm join controlplane:6443 --token 8x2k1q.... --discovery-token-ca-cert-hash sha256:3f1c...
```

Pa na workeru:

```bash
ssh node01
kubeadm join controlplane:6443 --token 8x2k1q.xxxxxxxxxxxxxxxx \
  --discovery-token-ca-cert-hash sha256:3f1c...
exit
kubectl get nodes
```

Šta join radi na workeru: TLS bootstrap kubeleta (CSR koji se automatski odobrava), upis `/etc/kubernetes/kubelet.conf` i `/var/lib/kubelet/config.yaml` (iz ConfigMap-a `kubelet-config`), pokretanje kubeleta. Na workeru nema `admin.conf`, pa `kubectl` tamo ne radi bez kopiranja kubeconfiga.

Hash možeš izračunati i ručno ako ga treba zapisati:

```bash
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | \
  openssl rsa -pubin -outform der 2>/dev/null | \
  openssl dgst -sha256 -hex | sed 's/^.* //'
```

> **Na ispitu:** Komandu `kubeadm token create --print-join-command` pokreći na control plane čvoru, a ispisanu komandu na workeru (preko `ssh node01`). Česta greška je pokretanje join-a na controlplane čvoru, gdje preflight javlja da fajlovi već postoje.

### Troubleshooting join-a

| Greška | Uzrok | Rješenje |
|---|---|---|
| `could not find a JWS signature in the cluster-info ConfigMap for token ID` | Token je istekao ili ne postoji | `kubeadm token create --print-join-command` |
| `couldn't validate the identity of the API Server` / hash se ne slaže | Pogrešan `--discovery-token-ca-cert-hash` | Uzmi novu join komandu |
| `[ERROR FileAvailable--etc-kubernetes-kubelet.conf]` | Čvor je već bio u klasteru | `kubeadm reset -f` na čvoru, pa join |
| `connection refused` / timeout na 6443 | Mreža, firewall ili pogrešna adresa | `nc -zv controlplane 6443` |
| Join prođe, čvor ostaje `NotReady` | CNI DaemonSet ne radi na novom čvoru | `kubectl -n <cni-ns> get pods -o wide` |

## kubeadm join: dodatni control plane čvor (HA)

Za dodatni control plane čvor važe tri uslova:

1. Klaster je inicijalizovan sa **`controlPlaneEndpoint`** (flag `--control-plane-endpoint`). Bez stabilne zajedničke adrese ne možeš dodati drugi control plane, a naknadna promjena je komplikovana.
2. Novi čvor mora dobiti iste CA i ostale dijeljene ključeve (`ca.key`, `sa.key`, `front-proxy-ca.key`, `etcd/ca.key`). Ili ih kopiraš ručno, ili koristiš **`--upload-certs`**.
3. Join se pokreće sa `--control-plane` i `--certificate-key`.

Tok sa automatskim dijeljenjem certifikata:

```bash
# na prvom control plane čvoru
kubeadm init --control-plane-endpoint "k8s-api.lab.local:6443" --upload-certs \
  --pod-network-cidr=10.244.0.0/16
# ispis sadrži dvije join komande: za control plane (sa --certificate-key) i za worker
```

Certifikati u Secret-u `kubeadm-certs` su šifrovani ključem (`certificate-key`) i **brišu se nakon dva sata**. Kasnije ih ponovo postavljaš:

```bash
kubeadm init phase upload-certs --upload-certs
# [upload-certs] Using certificate key:
# 7c4d...e91a
kubeadm token create --print-join-command --certificate-key 7c4d...e91a
```

Na novom control plane čvoru:

```bash
kubeadm join k8s-api.lab.local:6443 --token 8x2k1q.xxxxxxxxxxxxxxxx \
  --discovery-token-ca-cert-hash sha256:3f1c... \
  --control-plane --certificate-key 7c4d...e91a
```

`kubeadm certs certificate-key` generiše novi ključ ako želiš da ga zadaš unaprijed. Nakon dodavanja control plane čvorova korisno je `kubectl -n kube-system rollout restart deployment coredns` da se CoreDNS rasporedi po čvorovima.

## HA topologije

| | **Stacked etcd** | **External etcd** |
|---|---|---|
| Gdje je etcd | Na svakom control plane čvoru, kao static Pod | Na zasebnim mašinama |
| Broj mašina (min.) | 3 control plane | 3 control plane + 3 etcd |
| Rizik | Gubitak čvora = gubitak i API servera i etcd člana | Odvojeni domeni otkaza |
| Podešavanje | Automatski (kubeadm default) | `etcd.external` u ClusterConfiguration |
| Kad | Većina klastera, jednostavnije | Veliki klasteri, strožiji zahtjevi |

**etcd kvorum**: klaster od `n` članova radi dok je dostupno `n/2 + 1` članova. Sa 3 člana preživljava gubitak jednog, sa 5 gubitak dva. Paran broj ne dodaje otpornost (4 člana i dalje podnose samo jedan otkaz), zato se uzima neparan broj.

External etcd u konfiguraciji:

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

### Load balancer ispred API servera

- Svi kubelet-i, kube-proxy i korisnici pričaju sa `controlPlaneEndpoint`, a ne sa pojedinačnim čvorom. Load balancer (HAProxy, keepalived + HAProxy, kube-vip ili cloud LB) prosljeđuje TCP na port `6443` svih control plane čvorova.
- Health check je TCP provjera porta API servera.
- `controlPlaneEndpoint` je najbolje zadati kao **DNS ime**: kasnije možeš promijeniti LB bez izdavanja novih certifikata. Ime se nalazi u SAN listi certifikata API servera.
- controller-manager i scheduler rade na svakom control plane čvoru, ali je samo jedan aktivan zahvaljujući **leader election** (Lease objekti u `kube-system`).

```bash
kubectl -n kube-system get lease kube-scheduler kube-controller-manager
kubectl -n kube-system get pods -l component=etcd -o wide
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -ext subjectAltName
```

> **Na ispitu:** Pitanje „zašto ne mogu dodati drugi control plane“ gotovo uvijek ima odgovor: klaster nije inicijalizovan sa `--control-plane-endpoint`, ili su `--upload-certs` certifikati istekli (2h). Za worker certifikati nisu potrebni.

## kubeadm reset i uklanjanje čvora

Uredno uklanjanje workera:

```bash
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data
kubectl delete node node01
ssh node01
kubeadm reset -f
```

`kubeadm reset` vraća ono što su uradili `init` ili `join`: zaustavlja kubelet-ove Podove, briše `/etc/kubernetes/` (manifeste, PKI, kubeconfig fajlove), lokalni etcd data dir i podatke kubeleta. Na control plane čvoru sa stacked etcd-om pokušava ukloniti lokalnog etcd člana iz klastera.

Šta `reset` **ne** čisti (ispiše upozorenje):

```bash
rm -rf /etc/cni/net.d                     # CNI konfiguracija
iptables -F && iptables -t nat -F && iptables -X   # ili nft flush ruleset
ipvsadm --clear                           # ako je kube-proxy bio u IPVS modu
rm -f $HOME/.kube/config
```

Ostaci CNI konfiguracije su čest razlog da ponovo priključen čvor ima pogrešnu mrežu.

## Troubleshooting instalacije

| Simptom | Šta provjeriti |
|---|---|
| `init` visi na `wait-control-plane` | `journalctl -u kubelet`, `crictl ps -a`, cgroup driver, dostupnost image-a |
| Preflight: `port 6443 is in use` | Prethodna instalacija: `kubeadm reset -f` |
| Preflight: `container runtime is not running` | `systemctl status containerd`, `crictl info` |
| Svi čvorovi `NotReady` nakon init-a | CNI nije instaliran |
| CoreDNS `Pending` | CNI nije instaliran (CoreDNS ne toleriše `not-ready` taint) |
| Podovi na `node01` ne dobijaju IP | CNI DaemonSet na `node01`, `/etc/cni/net.d/` na `node01` |
| Worker ne dobija Podove | taint na čvoru (`kubectl describe node node01 \| grep Taints`) |

U lab okruženju čvorovi su Docker kontejneri, pa se `init` i `join` pokreću sa `--ignore-preflight-errors=all` (kontejner ne prolazi neke provjere hardvera i kernela). Na pravim mašinama i na ispitu ne preskači preflight bez razloga.

## Rezime

- kubeadm ne instalira runtime, pakete ni CNI; pravi PKI, kubeconfig fajlove, static Pod manifeste, bootstrap token i addone.
- `kubeadm init --pod-network-cidr=... --kubernetes-version=...` ili `kubeadm init --config` sa `kubeadm.k8s.io/v1beta4`; u v1beta4 `extraArgs` je lista `name`/`value`.
- Nakon `init`: kopiraj `admin.conf` u `~/.kube/config`, instaliraj CNI sa CIDR-om koji se slaže sa `--pod-network-cidr`.
- Join komanda za worker: `kubeadm token create --print-join-command` (token traje 24h).
- Dodatni control plane: klaster mora imati `controlPlaneEndpoint`; `--upload-certs` / `kubeadm init phase upload-certs --upload-certs` daje `certificate-key` koji važi 2 sata; join sa `--control-plane --certificate-key`.
- Stacked etcd: etcd na control plane čvorovima; external etcd: zasebne mašine i `etcd.external`. Neparan broj etcd članova, kvorum `n/2+1`.
- Uklanjanje čvora: `drain`, `delete node`, pa `kubeadm reset -f` na čvoru i ručno čišćenje `/etc/cni/net.d` i iptables pravila.
