## Šta ovaj modul pokriva

Modul pokriva tri cilja iz domena 3 (**Services & Networking**, 20% ispita):

- **3.1** povezanost između podova (Kubernetes mrežni model, CNI),
- **3.3** tipovi servisa **ClusterIP**, **NodePort**, **LoadBalancer** i endpointi,
- **3.6** razumijevanje i upotreba **CoreDNS**-a.

Tipični zadaci na ispitu:

- „Izloži Deployment `web` kao NodePort servis na portu 30080.“
- „Servis `api` ne vraća odgovor. Popravi ga.“ (pogrešan selector, pogrešan `targetPort`, pod nije Ready)
- „Iz poda u namespaceu `dev` razriješi ime servisa `db` iz namespacea `prod` i upiši IP u fajl.“
- „CoreDNS ne radi / podovi ne razrješavaju imena.“ (Corefile, podovi `coredns`, servis `kube-dns`)

Ovo su kratki zadaci koji nose bodove brzo, ali samo ako znaš imperativne komande napamet.

## Kubernetes mrežni model

Kubernetes ne implementira mrežu sam. Definiše **pravila** koja mrežni plugin mora ispuniti:

1. Svaki **Pod** dobija vlastitu IP adresu (svi kontejneri u podu dijele tu adresu i `localhost`).
2. Svaki pod može komunicirati sa svakim drugim podom, na bilo kom čvoru, **bez NAT-a**. IP koju pod vidi kao svoju je ista IP koju vide drugi.
3. Agenti na čvoru (kubelet, sistemski procesi) mogu komunicirati sa svim podovima na tom čvoru.

Ko to ostvaruje? **CNI** (**Container Network Interface**) plugin. Kad kubelet preko containerd-a pravi pod, runtime pozove CNI plugin koji:

- napravi mrežni namespace i `veth` par (jedan kraj u podu, drugi na čvoru),
- dodijeli IP iz opsega (IPAM),
- postavi rute tako da paket stigne do podova na drugim čvorovima (direktne rute, VXLAN overlay, BGP… zavisi od plugina).

CNI konfiguracija i binarni fajlovi su na čvoru:

```bash
ls /etc/cni/net.d/        # konfiguracija (npr. 10-kindnet.conflist)
ls /opt/cni/bin/          # binarni pluginovi (bridge, host-local, loopback, ptp…)
kubectl -n kube-system get pods -o wide | grep -i kindnet
```

U labovima kursa CNI je **kindnet** (DaemonSet u `kube-system`). Primjeri drugih CNI-ja: Calico, Cilium, Flannel. Flannel ne implementira NetworkPolicy, Calico i Cilium da (vidi modul 09).

### Pod CIDR po čvoru

Kod kubeadm klastera opseg za podove se zadaje pri instalaciji (`--pod-network-cidr` ili `networking.podSubnet` u konfiguraciji). **kube-controller-manager** (uz `--allocate-node-cidrs=true`) svakom čvoru dodijeli podopseg, npr. `/24`:

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,PODCIDR:.spec.podCIDR
# NAME           PODCIDR
# controlplane   10.244.0.0/24
# node01         10.244.1.0/24

kubectl get pods -o wide            # kolona IP i NODE
kubectl -n kube-system get cm kubeadm-config -o yaml | grep -E 'podSubnet|serviceSubnet'
```

Tri opsega ne smiju da se preklapaju: mreža čvorova, **pod CIDR** i **service CIDR** (kubeadm podrazumijevano `10.96.0.0/12`).

### Brza provjera povezanosti

```bash
kubectl run a --image=busybox:1.36 -- sleep 3600
kubectl run b --image=nginx --port=80
kubectl get pod b -o wide                        # npr. 10.244.1.7 na node01
kubectl exec a -- wget -qO- -T 2 10.244.1.7      # pod -> pod direktno, bez servisa
```

> **Na ispitu:** svaki zadatak počinje komandom `kubectl config use-context <ime>` koju zadatak navodi. Kopiraj je i pokreni prije svega ostalog. Rješenje u pogrešnom klasteru nosi nula bodova.

## Service: stabilna adresa za promjenljive podove

Podovi umiru i dobijaju nove IP adrese. **Service** daje stabilan virtuelni IP (**ClusterIP**) i DNS ime, a saobraćaj raspoređuje na podove koje bira `spec.selector`.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: web            # mora odgovarati oznakama PODOVA, ne Deploymenta
  ports:
  - name: http
    port: 80            # port na ClusterIP-u servisa
    targetPort: 8080    # port u kontejneru (broj ili ime porta iz containerPort)
    protocol: TCP
```

| Polje | Značenje |
|---|---|
| `port` | Port na koji klijent šalje zahtjev (ClusterIP:port) |
| `targetPort` | Port kontejnera na koji ide saobraćaj. Ako se izostavi, jednak je `port` |
| `nodePort` | Port na **svakom** čvoru (samo NodePort/LoadBalancer), opseg 30000–32767 |
| `name` | Obavezno kad servis ima više portova |

`targetPort` može biti ime porta (`targetPort: http`) ako kontejner ima `ports: - name: http, containerPort: 8080`. Tako možeš promijeniti broj porta u podu bez izmjene servisa.

### Tipovi servisa

| Tip | Šta dobijaš | Ko mu pristupa | Napomena |
|---|---|---|---|
| **ClusterIP** (podrazumijevano) | Virtuelni IP iz service CIDR-a | Samo iz klastera | Osnova za sve ostale tipove |
| **NodePort** | ClusterIP + port 30000–32767 na svakom čvoru | Spolja preko `<IP čvora>:<nodePort>` | Port se otvara na svim čvorovima, i onima bez poda |
| **LoadBalancer** | NodePort + eksterni load balancer | Spolja preko `EXTERNAL-IP` | Treba cloud controller ili npr. MetalLB; inače `EXTERNAL-IP` ostaje `<pending>` |
| **ExternalName** | DNS CNAME na eksterno ime | Iz klastera | Nema selektora, nema ClusterIP-a, nema proxyja |
| **Headless** (`clusterIP: None`) | Nema virtuelnog IP-a; DNS vraća IP adrese podova | Iz klastera | Za StatefulSet i klijente koji sami biraju pod |

```yaml
apiVersion: v1
kind: Service
metadata:
  name: legacy-db
spec:
  type: ExternalName
  externalName: db.example.com      # DNS upit za legacy-db vraća CNAME db.example.com
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None
  selector:
    app: web
  ports:
  - port: 80
```

### Imperativno: kubectl expose i kubectl create service

```bash
# ClusterIP za Deployment (selector se kopira iz Deploymenta)
kubectl expose deployment web --port=80 --target-port=8080 --name=web

# NodePort; nodePort dodjeljuje API server nasumično iz opsega
kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort --name=web-np

# Izloži jedan pod (selector = oznake poda)
kubectl expose pod b --port=80 --name=b-svc

# Fiksni nodePort: kubectl create service ima --node-port,
# ali selector postavlja na app=<ime servisa>!
kubectl create service nodeport web --tcp=80:8080 --node-port=30080 \
  --dry-run=client -o yaml > svc.yaml
```

`kubectl expose` nema flag za konkretan `nodePort`. Najbrži put do fiksnog porta: generiši YAML sa `--dry-run=client -o yaml`, dopiši `nodePort: 30080` i primijeni ga.

```bash
kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort \
  --name=web-np --dry-run=client -o yaml > web-np.yaml
vim web-np.yaml        # pod ports: dodaj nodePort: 30080
kubectl apply -f web-np.yaml
```

Ili izmijeni postojeći servis:

```bash
kubectl patch svc web-np --type=json \
  -p='[{"op":"replace","path":"/spec/ports/0/nodePort","value":30080}]'
```

> **Na ispitu:** `kubectl create service nodeport web …` postavlja `selector: app: web`. Ako podovi imaju oznaku `app: frontend`, servis neće imati endpointe. `kubectl expose deployment` je sigurniji jer kopira selector iz Deploymenta.

## Endpoints i EndpointSlice

Kad servis ima `selector`, **EndpointSlice controller** u kube-controller-manageru stalno prati podove sa tim oznakama i upisuje njihove IP adrese i portove u objekte **EndpointSlice** (`discovery.k8s.io/v1`). U slice ulaze svi podovi koji odgovaraju, ali samo **Ready** podovi dobijaju `ready: true` i primaju saobraćaj.

```bash
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl describe svc web | grep -i endpoints
kubectl get endpointslice web-abc12 -o yaml
```

Stariji API **Endpoints** (`v1`) još postoji, ali je od 1.33 deprecated i `kubectl get endpoints` ispisuje upozorenje. Za ispit oba pogleda daju isti odgovor: „ima li servis backend podove?“.

Lanac koji mora biti ispravan:

```text
Service.spec.selector  ──bira──►  Pod.metadata.labels
                                   │ (pod Running i Ready)
EndpointSlice ◄─────────upisuje──┘
kube-proxy  ──čita EndpointSlice──► pravila na čvoru (ClusterIP:port → podIP:targetPort)
```

### Service bez selektora

Servis bez `selector` polja neće dobiti automatske endpointe. Koristi se kad backend nije pod (baza van klastera, servis u drugom klasteru). EndpointSlice tada praviš sam i vežeš ga oznakom `kubernetes.io/service-name`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ext-db
spec:
  ports:
  - name: pg
    port: 5432
    targetPort: 5432
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ext-db-1
  labels:
    kubernetes.io/service-name: ext-db
    endpointslice.kubernetes.io/managed-by: admin.cyberlab
addressType: IPv4
ports:
- name: pg             # ime mora odgovarati imenu porta u servisu
  port: 5432
  protocol: TCP
endpoints:
- addresses: ["192.168.10.50"]
```

## kube-proxy

**kube-proxy** je DaemonSet na svakom čvoru. Prati Service i EndpointSlice objekte i programira kernel tako da paket poslat na `ClusterIP:port` (ili `NodeIP:nodePort`) bude preusmjeren (DNAT) na IP jednog backend poda. kube-proxy ne prosljeđuje pakete kroz sebe, samo piše pravila.

| Mode | Kako radi | Status u 1.35 |
|---|---|---|
| `iptables` | iptables lanci `KUBE-SERVICES`, `KUBE-SVC-…`, `KUBE-SEP-…`, nasumičan izbor backenda | **Podrazumijevani** mode na Linuxu |
| `ipvs` | IPVS virtuelni serveri u kernelu, više algoritama balansiranja | **Deprecated od 1.35** (planirano isključivanje i kasnije uklanjanje) |
| `nftables` | nftables tabele, bolje skaliranje od iptables | **Stable (GA) od 1.33**, traži kernel 5.13+; najavljeno je da postaje podrazumijevani u nekoj budućoj verziji |

Konfiguracija kod kubeadm-a je u ConfigMapu `kube-proxy`:

```bash
kubectl -n kube-system get cm kube-proxy -o yaml | grep -E 'mode:|clusterCIDR'
# mode: ""   → prazno znači iptables na Linuxu
kubectl -n kube-system logs ds/kube-proxy | grep -i proxier
```

Promjena moda: izmijeni `mode:` u ConfigMapu, pa restartuj DaemonSet:

```bash
kubectl -n kube-system edit cm kube-proxy                 # mode: "nftables"
kubectl -n kube-system rollout restart ds kube-proxy
```

Pravila na čvoru:

```bash
ssh node01
iptables-save | grep web                       # iptables mode
nft list table ip kube-proxy | head            # nftables mode
```

> **Na ispitu:** ako ClusterIP ne odgovara, a EndpointSlice ima ispravne IP adrese, pogledaj podove kube-proxyja: `kubectl -n kube-system get pods -l k8s-app=kube-proxy` i njihove logove. ClusterIP je virtuelan i **ne odgovara na ping**; testiraj sa `wget`/`curl`/`nc` na port.

### externalTrafficPolicy i internalTrafficPolicy

Za NodePort i LoadBalancer servise:

| `externalTrafficPolicy` | Ponašanje |
|---|---|
| `Cluster` (podrazumijevano) | Čvor koji primi paket može ga proslijediti podu na **drugom** čvoru. Izvorna IP klijenta se gubi (SNAT). Ravnomjerno, ali dodatni skok |
| `Local` | Saobraćaj ide samo na Ready podove **na tom čvoru**. Izvorna IP klijenta je sačuvana. Ako čvor nema lokalni pod, saobraćaj na tom čvoru se odbacuje |

`internalTrafficPolicy: Local` radi isto za saobraćaj iz klastera prema ClusterIP-u.

```bash
kubectl patch svc web-np -p '{"spec":{"externalTrafficPolicy":"Local"}}'
```

Tipična zamka: postaviš `Local`, pod radi samo na `node01`, a curl ideš na `controlplane:30080` → nema odgovora. To nije greška, nego očekivano ponašanje.

### sessionAffinity

Podrazumijevano svaka nova konekcija može otići na drugi pod. `sessionAffinity: ClientIP` šalje istog klijenta (po izvornoj IP) na isti pod, podrazumijevano do 10800 sekundi (3 sata):

```yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 600
```

## CoreDNS

**CoreDNS** je DNS server klastera. Kod kubeadm-a radi kao Deployment `coredns` (2 replike) u `kube-system`, a izložen je servisom koji se iz istorijskih razloga zove **`kube-dns`** (ClusterIP obično `10.96.0.10`).

```bash
kubectl -n kube-system get deploy coredns
kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
```

### Corefile

Konfiguracija je u ConfigMapu **`coredns`**, ključ `Corefile`. Skraćeno, kubeadm postavi otprilike ovo:

```text
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

| Plugin | Uloga |
|---|---|
| `kubernetes cluster.local …` | Odgovara na imena servisa i podova iz API-ja; `cluster.local` je domen klastera |
| `pods insecure` | Omogućava A zapise za pod imena oblika `10-244-1-7.ns.pod.cluster.local` |
| `forward . /etc/resolv.conf` | Sve što nije klasterski domen šalje upstream resolverima čvora |
| `cache 30` | Keš odgovora 30 s |
| `loop` | Detektuje petlju (npr. upstream pokazuje nazad na CoreDNS) i zaustavlja CoreDNS |
| `reload` | Automatski učitava izmijenjen Corefile (traje do ~2 min) |
| `health`, `ready` | Endpointi za liveness (`:8080/health`) i readiness (`:8181/ready`) probe |

Primjer: prosljeđivanje internog domena kompanije na interni DNS. Dodaje se novi blok servera:

```bash
kubectl -n kube-system edit cm coredns
```

```text
corp.local:53 {
    errors
    cache 30
    forward . 10.0.0.53
}
```

Ako ne želiš čekati `reload`: `kubectl -n kube-system rollout restart deploy coredns`.

> **Na ispitu:** prije izmjene sistemskog ConfigMapa sačuvaj kopiju: `kubectl -n kube-system get cm coredns -o yaml > /root/coredns-backup.yaml`. Ako pogriješiš sintaksu, CoreDNS podovi padaju u `CrashLoopBackOff` i cijeli klaster gubi DNS.

### DNS imena

| Šta | Ime |
|---|---|
| Servis | `<servis>.<namespace>.svc.cluster.local` → ClusterIP |
| Headless servis | isto ime → A zapisi svih Ready podova |
| Pod iza headless servisa (StatefulSet) | `<pod>.<servis>.<namespace>.svc.cluster.local`, npr. `web-0.nginx.default.svc.cluster.local` |
| Pod sa `hostname` i `subdomain` | `<hostname>.<subdomain>.<namespace>.svc.cluster.local` (treba headless servis imena `subdomain`) |
| Pod po IP-u | `10-244-1-7.<namespace>.pod.cluster.local` |
| Imenovani port | SRV zapis `_http._tcp.<servis>.<namespace>.svc.cluster.local` |
| ExternalName | CNAME na `spec.externalName` |

### /etc/resolv.conf u podu i ndots

Kubelet piše `/etc/resolv.conf` svakom podu (adresu DNS servera uzima iz `clusterDNS` u kubelet konfiguraciji `/var/lib/kubelet/config.yaml`):

```bash
kubectl exec a -- cat /etc/resolv.conf
# search default.svc.cluster.local svc.cluster.local cluster.local
# nameserver 10.96.0.10
# options ndots:5
```

- `search` lista omogućava kratka imena: iz namespacea `default` ime `web` se proba kao `web.default.svc.cluster.local`.
- Iz drugog namespacea je dovoljno `web.default` (dopuni se sa `svc.cluster.local`).
- `ndots:5`: ako ime ima **manje od 5 tačaka**, resolver prvo proba sve search domene, pa tek onda ime kakvo jeste. Zato `api.github.com` iz poda prvo napravi nekoliko neuspješnih upita unutar `cluster.local`. Ime sa tačkom na kraju (`api.github.com.`) preskače search listu.

### dnsPolicy i dnsConfig

| `dnsPolicy` | Ponašanje |
|---|---|
| `ClusterFirst` (podrazumijevano) | Koristi CoreDNS; nepoznati domeni idu upstream |
| `Default` | Pod naslijedi resolv.conf **čvora** (ime je zbunjujuće: nije podrazumijevana vrijednost) |
| `ClusterFirstWithHostNet` | Za podove sa `hostNetwork: true` koji ipak trebaju klasterski DNS |
| `None` | Ignoriše sve; sve zadaješ u `dnsConfig` |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers: ["10.96.0.10"]
    searches: ["prod.svc.cluster.local", "svc.cluster.local"]
    options:
    - name: ndots
      value: "2"
  containers:
  - name: c
    image: busybox:1.36
    command: ["sleep", "3600"]
```

Pod sa `hostNetwork: true` i podrazumijevanim `ClusterFirst` u praksi koristi DNS čvora; ako mu treba klasterski DNS, postavi `ClusterFirstWithHostNet`.

> **Na ispitu:** za DNS testove koristi `busybox:1.36` ili `registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3` (primjer sa stranice „Debugging DNS Resolution“ u dokumentaciji). Jednokratni pod: `kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- nslookup web.default`.

## Troubleshooting

### Servis ne odgovara

Idi redom, od servisa prema podu:

```bash
kubectl get svc web -o wide                     # SELECTOR kolona
kubectl get pods -l app=web -o wide             # da li selector uopšte nalazi podove?
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl describe svc web                        # Endpoints, TargetPort
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].ports}'
kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- -T 2 web:80
```

| Simptom | Vjerovatan uzrok | Popravka |
|---|---|---|
| EndpointSlice prazan, podovi rade | Selector ne odgovara oznakama poda (tipfeler, pogrešna oznaka) | `kubectl edit svc` ili `kubectl label pod` |
| EndpointSlice ima adrese sa `ready: false` | Readiness proba pada | Popravi probu ili aplikaciju |
| Endpointi postoje, `connection refused` | `targetPort` ne odgovara portu na kojem aplikacija sluša | Ispravi `targetPort` |
| NodePort radi samo na jednom čvoru | `externalTrafficPolicy: Local` | Očekivano, ili vrati na `Cluster` |
| `EXTERNAL-IP <pending>` | Nema cloud controllera / load balancer implementacije | Koristi NodePort ili instaliraj LB implementaciju |
| Pod-pod saobraćaj ne prolazi među čvorovima | CNI pod ne radi na čvoru, ili NetworkPolicy | `kubectl -n kube-system get pods -o wide`, `kubectl get netpol -A` |

### DNS ne radi

```bash
kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- nslookup kubernetes.default
# Ako ne radi:
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system logs -l k8s-app=kube-dns
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
kubectl -n kube-system get cm coredns -o yaml
kubectl exec <pod> -- cat /etc/resolv.conf
grep -A2 clusterDNS /var/lib/kubelet/config.yaml
```

Česti uzroci:

- CoreDNS podovi u `CrashLoopBackOff`: sintaksna greška u Corefileu ili `loop` plugin je otkrio petlju (logovi kažu „Loop … detected“).
- Servis `kube-dns` ima pogrešan selector, pa nema endpointa.
- `clusterDNS` u kubelet konfiguraciji ne odgovara ClusterIP-u servisa `kube-dns` (nakon izmjene: `systemctl restart kubelet` i ponovo kreiraj pod).
- Upit za eksterno ime pada, a klasterska imena rade: problem je u `forward` (upstream resolver čvora).
- NetworkPolicy blokira egress prema `kube-system` na port 53 (modul 09).

> **Na ispitu:** `nslookup` iz busyboxa nekad ispiše grešku za AAAA ili search domen, a ipak vrati ispravnu A adresu. Gledaj da li u izlazu postoji `Address:` sa IP-jem servisa, ne samo da li ima riječi „error“.

## Rezime

- Mrežni model: svaki pod ima svoju IP, podovi komuniciraju bez NAT-a; CNI plugin (u labu kindnet) pravi interfejse, dodjeljuje IP iz pod CIDR-a čvora (`.spec.podCIDR`) i postavlja rute.
- Service daje stabilan ClusterIP i DNS ime; `selector` bira **podove**, `port` je port servisa, `targetPort` port kontejnera, `nodePort` (30000–32767) port na svakom čvoru.
- ClusterIP ⊂ NodePort ⊂ LoadBalancer; ExternalName je CNAME bez proxyja; headless (`clusterIP: None`) vraća IP adrese podova.
- EndpointSlice controller upisuje Ready podove; servis bez selektora traži ručni EndpointSlice sa oznakom `kubernetes.io/service-name`.
- kube-proxy programira čvor: `iptables` je podrazumijevani, `nftables` GA od 1.33, `ipvs` deprecated od 1.35; mode je u ConfigMapu `kube-proxy`.
- `externalTrafficPolicy: Local` čuva IP klijenta, ali šalje samo na lokalne podove; `sessionAffinity: ClientIP` lijepi klijenta za pod.
- CoreDNS: Deployment `coredns`, servis `kube-dns`, ConfigMap `coredns` (Corefile); imena `svc.ns.svc.cluster.local`, `ndots:5`, `dnsPolicy` `ClusterFirst`/`Default`/`ClusterFirstWithHostNet`/`None`.
- Troubleshooting ide lancem selector → EndpointSlice → targetPort → kube-proxy, a za DNS: `nslookup` iz busybox poda → CoreDNS podovi i logovi → servis `kube-dns` → Corefile → resolv.conf.
