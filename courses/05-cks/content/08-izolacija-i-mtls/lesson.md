## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 4 (**Minimize Microservice Vulnerabilities**, 20% ispita):

- **4.3 Understand and implement isolation techniques (multi-tenancy, sandboxed containers, etc.)**: kako odvojiti timove i aplikacije u istom klasteru i kako pokrenuti nepovjerljiv kod u sandboxu (**gVisor**, **Kata Containers**) preko **RuntimeClass** objekta.
- **4.4 Implement Pod-to-Pod encryption (Cilium, Istio)**: transparentna enkripcija u CNI-ju (**WireGuard**, **IPsec**) i **mTLS** u service meshu.

Tipični zadaci na ispitu:

- „Napravi RuntimeClass `gvisor` sa handlerom `runsc` i pokreni Deployment `untrusted` u njemu.“
- „Pronađi Pod koji ne radi u sandboxu i premjesti ga.“
- „Svi Podovi u namespaceu `payments` moraju prihvatati samo mTLS saobraćaj“ (Istio `PeerAuthentication`).
- „Odvoji tim B: svoj namespace, kvota, default deny, posebni čvorovi.“

Za Cilium i Istio ispit češće traži razumijevanje i kratak YAML nego instalaciju od nule. U lab okruženju kursa CNI je Calico (bez WireGuard enkripcije) i nema service mesha, pa ove dijelove učiš kroz manifeste i dokumentaciju, a gVisor (`runsc`) je instaliran na čvorovima i možeš ga probati.

## Multi-tenancy: slojevi izolacije

Kubernetes nema objekat „tenant“. Izolaciju sklapaš od više slojeva, a svaki pokriva drugu vrstu rizika.

| Sloj | Mehanizam | Šta štiti |
|---|---|---|
| Logička granica | **Namespace** po timu ili aplikaciji | Imena, opseg RBAC-a, NetworkPolicy, kvote |
| API pristup | **RBAC** `Role`/`RoleBinding` po namespaceu | Tim A ne čita i ne mijenja resurse tima B |
| Mreža | **NetworkPolicy** default deny + izuzeci | Podovi tima A ne mogu do Podova tima B |
| Resursi | **ResourceQuota** i **LimitRange** | Jedan tim ne može potrošiti cijeli klaster (DoS) |
| Pod sigurnost | **Pod Security Admission** (`restricted`) | Nema privileged Podova i hostPath bijega na čvor |
| Čvorovi | **taints/tolerations** + **nodeAffinity**/`nodeSelector` | Tenanti ne dijele kernel istog čvora |
| Kernel | **Sandbox runtime** (gVisor, Kata) | Bijeg iz kontejnera ne daje pristup kernelu hosta |

Namespace je **mekana** granica: svi Podovi dijele isti kernel čvora, isti API server i isti CNI. Za „hard multi-tenancy“ (nepovjerljivi korisnici) kombinuješ sve slojeve, a za najstrožu izolaciju koristiš odvojene klastere.

### Primjer: namespace za tim

```bash
kubectl create ns team-b
kubectl label ns team-b pod-security.kubernetes.io/enforce=restricted
kubectl -n team-b create role dev --verb=get,list,watch,create,update,delete \
  --resource=deployments,pods,services,configmaps
kubectl -n team-b create rolebinding dev --role=dev --group=team-b-devs
kubectl -n team-b create quota team-b --hard=requests.cpu=4,requests.memory=8Gi,limits.cpu=8,limits.memory=16Gi,pods=30
```

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: team-b
spec:
  limits:
  - type: Container
    default:            # limit ako ga kontejner ne navede
      cpu: 500m
      memory: 512Mi
    defaultRequest:     # request ako ga kontejner ne navede
      cpu: 100m
      memory: 128Mi
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: team-b
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

Kad postoji ResourceQuota sa `requests.cpu`, svaki Pod mora imati request za CPU (ili ga dobiti iz LimitRange-a), inače ga API odbija sa `must specify requests.cpu`.

### Posvećeni čvorovi

```bash
kubectl taint node node01 tenant=team-b:NoSchedule
kubectl label node node01 tenant=team-b
```

```yaml
spec:
  tolerations:
  - key: tenant
    operator: Equal
    value: team-b
    effect: NoSchedule
  nodeSelector:
    tenant: team-b
```

Taint tjera **druge** Podove sa čvora, a `nodeSelector`/affinity vuče **ove** Podove na taj čvor. Treba ti oboje: samo tolerancija ne garantuje da će Pod završiti na `node01`.

> **Na ispitu:** zadatke izolacije rješavaš imperativnim komandama (`kubectl create ns|role|rolebinding|quota`, `kubectl taint`, `kubectl label`), a YAML pišeš samo za NetworkPolicy i LimitRange. Primjere kopiraj sa kubernetes.io (pretraga „LimitRange“, „Resource Quotas“, „Network Policies“).

## Sandbox kontejneri

Običan kontejner (runc) je proces na hostu, izolovan namespaceovima i cgroupama, ali sa **zajedničkim kernelom**. Ranjivost u kernelu (npr. u syscallu) može dati bijeg na čvor. Sandbox runtime ubacuje dodatni sloj između aplikacije i kernela hosta.

| | runc (podrazumijevano) | gVisor (`runsc`) | Kata Containers |
|---|---|---|---|
| Model | Proces na hostu | Korisnički kernel (**Sentry**) presreće syscallove | Lagana virtuelna mašina po Podu |
| Kernel koji aplikacija vidi | Kernel hosta | gVisor implementacija Linux API-ja | Poseban gost kernel u VM |
| Izolacija | Namespaces, cgroups, seccomp | Jaka: mali broj syscallova stiže do hosta | Najjača: hardverska virtualizacija |
| Cijena | Najbrže | Sporiji syscallovi i I/O, neke funkcije nedostaju | Više memorije, sporiji start, treba virtualizacija |
| Tipična upotreba | Sve ostalo | Nepovjerljiv kod, multi-tenant | Strogi multi-tenant, regulisana okruženja |

Sandbox ne zamjenjuje `securityContext`, seccomp ni NetworkPolicy: dodaje se na njih.

### Kako runtime dolazi do Poda

1. **containerd** na čvoru ima definisan runtime handler (u `/etc/containerd/config.toml`).
2. **RuntimeClass** objekat u klasteru povezuje ime sa tim handlerom.
3. Pod bira RuntimeClass poljem `spec.runtimeClassName`.

U lab okruženju handler `runsc` već postoji. Na čvoru ga vidiš ovako:

```bash
ssh node01
grep -A3 'runtimes.runsc' /etc/containerd/config.toml
# [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
#   runtime_type = "io.containerd.runsc.v1"
runsc --version
crictl info | grep -i runsc
```

Kod containerd 2.x konfiguracija ima `version = 3` i drugačije ime sekcije za CRI plugin, ali princip je isti: ime handlera u konfiguraciji mora biti identično polju `handler` u RuntimeClass-u. Nakon izmjene konfiguracije: `systemctl restart containerd`.

### RuntimeClass

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor          # RuntimeClass nije namespaced
handler: runsc          # ime handlera u containerd konfiguraciji
```

Opciona polja:

```yaml
scheduling:
  nodeSelector:         # Pod ide samo na čvorove sa ovom oznakom
    sandbox: gvisor
  tolerations:          # dodaju se Podu pri admissionu
  - key: sandbox
    operator: Exists
    effect: NoSchedule
overhead:
  podFixed:             # dodatni resursi koje sandbox troši po Podu
    cpu: 100m
    memory: 64Mi
```

- `scheduling.nodeSelector` se spaja sa `nodeSelector`-om Poda. Ako se sukobljavaju, Pod se odbija.
- `scheduling` je bitan kad samo dio čvorova ima instaliran handler: bez njega Pod može završiti na čvoru bez `runsc` i pasti.
- `overhead.podFixed` scheduler i ResourceQuota dodaju na zahtjeve Poda.

### Pod u gVisoru

```bash
kubectl apply -f runtimeclass.yaml
kubectl get runtimeclass
kubectl run sandboxed --image=nginx:1.27 --dry-run=client -o yaml > sandboxed.yaml
# dodaj spec.runtimeClassName: gvisor
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandboxed
spec:
  runtimeClassName: gvisor
  containers:
  - name: nginx
    image: nginx:1.27
```

Za Deployment polje ide u `spec.template.spec.runtimeClassName`. Postojeći Podovi se ne mijenjaju u mjestu: izmjena template-a pokreće rolling update sa novim Podovima.

### Provjera da Pod zaista radi u gVisoru

```bash
kubectl exec sandboxed -- dmesg
# [    0.000000] Starting gVisor...
# ... (izmišljene „boot“ poruke)
# [    x.xxxxxx] Ready!

kubectl exec sandboxed -- uname -r      # verzija koju emulira gVisor, različita od kernela čvora
ssh node01 uname -r                     # pravi kernel čvora

kubectl get pod sandboxed -o jsonpath='{.spec.runtimeClassName}{"\n"}'
```

Na čvoru:

```bash
ssh node01
crictl ps --name nginx
crictl inspect <container-id> | grep -i runtimeType     # io.containerd.runsc.v1
ps aux | grep runsc                                     # runsc-sandbox / runsc-gofer procesi
```

U običnom kontejneru `dmesg` obično vraća grešku (`Operation not permitted`) ili pravi log kernela hosta, a `uname -r` je isti kao na čvoru.

Pronalaženje svih Podova koji koriste sandbox:

```bash
kubectl get pods -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,RC:.spec.runtimeClassName
```

> **Na ispitu:** stranicu „Runtime Class“ nađeš u dokumentaciji pretragom „RuntimeClass“, a gVisor dokumentacija je dozvoljena (gvisor.dev). Polje se zove `handler`, ne `runtimeHandler`, i RuntimeClass je u grupi `node.k8s.io/v1`. U Podu je `runtimeClassName`, ne `runtimeClass`.

### Šta ako ne radi

| Simptom | Uzrok |
|---|---|
| Pod `Failed`/`ContainerCreating`, događaj sadrži `no runtime for "runsc" is configured` | Handler nije u containerd konfiguraciji na tom čvoru, ili containerd nije restartovan |
| `pods "x" is forbidden: pod rejected: RuntimeClass "gvisor" not found` | RuntimeClass ne postoji ili je pogrešno ime u `runtimeClassName` |
| Pod radi na jednom čvoru, na drugom ne | `runsc` instaliran samo na dijelu čvorova; dodaj `scheduling.nodeSelector` |
| Aplikacija u gVisoru se ponaša čudno | Neki syscallovi ili `/proc` fajlovi nisu podržani; provjeri logove Poda |

```bash
kubectl describe pod sandboxed | tail
ssh node01 journalctl -u containerd --since "10 min ago" | grep -i runsc
```

## Pod-to-Pod enkripcija

Po defaultu saobraćaj između Podova ide **nešifrovano** kroz mrežu čvorova. Ko ima pristup mreži (ili kompromitovanom čvoru) može ga prisluškivati. Postoje dva pristupa:

| | CNI transparentna enkripcija (Cilium) | Service mesh mTLS (Istio) |
|---|---|---|
| Sloj | L3/L4, između čvorova | L4/L7, između workloada |
| Mehanizam | WireGuard ili IPsec tunel čvor-čvor | TLS sa klijentskim certifikatima (mTLS) |
| Identitet | Čvor (ključevi po čvoru) | Workload (ServiceAccount, SPIFFE ID) |
| Izmjena aplikacije | Ne | Ne (sidecar ili ambient proxy) |
| Saobraćaj na istom čvoru | Ne šifruje se (ne izlazi iz čvora) | Šifruje se |
| Autorizacija po identitetu | Ne (to rade Cilium network policies) | Da (`AuthorizationPolicy`) |
| Složenost | Jedan Helm parametar | Control plane mesha, proxy u svakom Podu |

### Cilium: WireGuard ili IPsec

Cilium je CNI koji može šifrovati sav saobraćaj između Podova na različitim čvorovima. Uključuje se Helm vrijednostima:

```bash
# WireGuard
helm upgrade --install cilium cilium/cilium --namespace kube-system \
  --reuse-values \
  --set encryption.enabled=true \
  --set encryption.type=wireguard

# opciono: šifruj i saobraćaj čvor-čvor i čvor-Pod (beta)
#   --set encryption.nodeEncryption=true
```

Ili preko Cilium CLI-ja pri instalaciji:

```bash
cilium install --set encryption.enabled=true --set encryption.type=wireguard
```

Za **IPsec** prvo treba Secret sa ključem u `kube-system`, pa `encryption.type=ipsec`:

```bash
kubectl create -n kube-system secret generic cilium-ipsec-keys \
  --from-literal=keys="3+ rfc4106(gcm(aes)) $(dd if=/dev/urandom count=20 bs=1 2>/dev/null | xxd -p -c 64) 128"

helm upgrade --install cilium cilium/cilium --namespace kube-system \
  --reuse-values --set encryption.enabled=true --set encryption.type=ipsec
```

| | WireGuard | IPsec |
|---|---|---|
| Ključevi | Cilium ih generiše sam po čvoru | Ti praviš i rotiraš Secret `cilium-ipsec-keys` |
| Kernel | Treba WireGuard podrška (Linux 5.6+) | XFRM, dostupan svuda |
| Port | UDP 51871 između čvorova | ESP protokol |
| Konfiguracija | Najjednostavnija | Više koraka, FIPS okruženja |

Provjera:

```bash
cilium status                                    # opšte stanje Cilium agenata i operatora
cilium encryption status                         # Cilium CLI, za cijeli klaster
kubectl -n kube-system exec ds/cilium -- cilium-dbg status | grep Encryption
# Encryption:  Wireguard   [cilium_wg0 (Pubkey: ..., Port: 51871, Peers: 1)]
kubectl -n kube-system exec ds/cilium -- cilium-dbg encrypt status   # IPsec: Keys in use, Errors
```

Dokaz na mreži: `tcpdump -n -i cilium_wg0` (WireGuard) ili `tcpdump -n -i eth0 esp` (IPsec) unutar Cilium Poda. Ako na fizičkom interfejsu vidiš HTTP saobraćaj Podova kao čist tekst, enkripcija nije aktivna.

U starijim verzijama alat u agentu se zvao `cilium` umjesto `cilium-dbg`, pa ćeš u blogovima vidjeti `cilium encrypt status`. Provjeri koje ime postoji u tvom Podu.

### Istio: mTLS

**Istio** ubacuje proxy (Envoy) uz svaki workload. Proxyji između sebe uspostavljaju **mutual TLS**: obje strane pokazuju certifikat koji izdaje Istio CA (istiod), a identitet je izveden iz ServiceAccount-a.

Dva načina rada:

| | Sidecar | Ambient |
|---|---|---|
| Proxy | Envoy kontejner u svakom Podu | `ztunnel` DaemonSet po čvoru (L4), opcioni waypoint proxy za L7 |
| Uključivanje | `kubectl label ns app istio-injection=enabled` + restart Podova | `kubectl label ns app istio.io/dataplane-mode=ambient` |
| Restart Podova | Potreban (injekcija pri kreiranju) | Nije potreban |

```bash
kubectl label ns payments istio-injection=enabled
kubectl -n payments rollout restart deploy
kubectl -n payments get pods      # READY 2/2 = aplikacija + istio-proxy
```

Ponašanje mTLS-a određuje **PeerAuthentication**:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: payments
spec:
  mtls:
    mode: STRICT
```

| `mtls.mode` | Značenje |
|---|---|
| `UNSET` | Nasljeđuje od roditelja (namespace, pa mesh); ako ništa nije postavljeno, ponaša se kao PERMISSIVE |
| `PERMISSIVE` | Prima i mTLS i čist tekst; podrazumijevano, služi za postepenu migraciju |
| `STRICT` | Prima **samo** mTLS; klijent bez proxyja je odbijen |
| `DISABLE` | Bez mTLS-a (ambient ga ne podržava) |

Opseg politike:

- U **root namespaceu** mesha (podrazumijevano `istio-system`) bez selektora: važi za cijeli mesh.
- U običnom namespaceu bez `selector`: važi za sve workloade u tom namespaceu.
- Sa `selector.matchLabels`: samo za izabrane workloade; tada možeš dodati `portLevelMtls` po portu kontejnera.

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: db
  namespace: payments
spec:
  selector:
    matchLabels:
      app: db
  mtls:
    mode: STRICT
  portLevelMtls:
    9090:
      mode: PERMISSIVE     # npr. metrike koje skuplja Prometheus bez proxyja
```

Provjera: iz Poda **bez** proxyja (namespace bez injekcije) pozovi servis u STRICT namespaceu. Zahtjev mora pasti; iz Poda sa proxyjem mora proći.

```bash
kubectl -n legacy exec deploy/curl -- curl -s -o /dev/null -w "%{http_code}\n" http://api.payments:8080/
# 000
# command terminated with exit code 56
kubectl -n payments exec deploy/curl -c curl -- curl -s -o /dev/null -w "%{http_code}\n" http://api.payments:8080/
# 200
kubectl get peerauthentication -A
```

> **Na ispitu:** za Istio zadatke traži primjer PeerAuthentication u dokumentaciji Istia (ako je na listi dozvoljenih resursa) ili ga napiši napamet: četiri reda pod `spec`. Najčešća zamka je pogrešan `apiVersion` (`security.istio.io/v1`, starije verzije `v1beta1`) i politika u pogrešnom namespaceu.

### Kada šta koristiti

- Treba ti samo da niko na mreži ne čita saobraćaj, bez novih komponenti: **Cilium WireGuard** (ako je Cilium već CNI).
- Treba ti identitet servisa, autorizacija „samo frontend smije zvati api“ i L7 politike: **Istio mTLS** sa `AuthorizationPolicy`.
- Migracija postojećih aplikacija u mesh: počni sa `PERMISSIVE`, prati da li neko šalje čist tekst, pa pređi na `STRICT`.
- Oba pristupa ne zamjenjuju NetworkPolicy: enkripcija skriva sadržaj, ali ne ograničava ko s kim razgovara.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| Pod sa `runtimeClassName` ne starta | `kubectl describe pod`, `kubectl get runtimeclass`, handler u `/etc/containerd/config.toml` na čvoru gdje je Pod raspoređen |
| `dmesg` u Podu ne pokazuje gVisor | Pod nije ponovo kreiran poslije izmjene, ili Deployment nema polje u `spec.template.spec` |
| Pod odbijen zbog kvote | `kubectl describe quota -n X`; dodaj `resources.requests` ili LimitRange |
| Podovi tima ne idu na posvećeni čvor | Tolerancija postoji, ali nedostaje `nodeSelector`/affinity |
| Cilium `Encryption: Disabled` | Helm vrijednosti nisu primijenjene; `helm get values cilium -n kube-system`; restart agenata |
| Nakon STRICT neki klijenti dobijaju `connection reset` | Klijent nema proxy (nije u meshu); dodaj injekciju ili privremeno PERMISSIVE |
| Pod u meshu ima READY 1/1 | Namespace nema oznaku za injekciju ili Pod nije restartovan |

> **Na ispitu:** prije svakog zadatka pokreni `kubectl config use-context` iz teksta zadatka. Zadaci sa RuntimeClass-om često koriste drugi klaster na kojem je gVisor instaliran samo na jednom čvoru, pa obavezno pogledaj `scheduling` ili oznake čvorova.

## Rezime

- Namespace je mekana granica; prava izolacija tenanta = namespace + RBAC + NetworkPolicy default deny + ResourceQuota/LimitRange + PSA restricted + po potrebi posvećeni čvorovi (taint + nodeSelector).
- gVisor (`runsc`) presreće syscallove u korisničkom kernelu, Kata pokreće Pod u lakoj VM; oba smanjuju rizik bijega preko kernela hosta.
- RuntimeClass (`node.k8s.io/v1`, nije namespaced) povezuje ime sa containerd handlerom (`handler: runsc`); Pod ga bira sa `spec.runtimeClassName`.
- Da Pod radi u gVisoru dokazuješ sa `dmesg` („Starting gVisor…“) i `uname -r` različitim od čvora.
- Cilium šifruje saobraćaj između čvorova sa `encryption.enabled=true` i `encryption.type=wireguard|ipsec`; provjera `cilium-dbg status | grep Encryption` ili `cilium encryption status`.
- Istio mTLS se zaključava PeerAuthentication-om `mode: STRICT` (namespace ili root namespace za cijeli mesh); PERMISSIVE prima i čist tekst.
- Enkripcija ne zamjenjuje NetworkPolicy, a sandbox ne zamjenjuje securityContext: slojevi se sabiraju.
