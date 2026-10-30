## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 1 (**Cluster Setup**, 15% ispita):

- **1.1** NetworkPolicy za ograničavanje pristupa na nivou klastera,
- **1.2** CIS benchmark (alat **kube-bench**) za provjeru sigurnosne konfiguracije komponenti.

Tipični zadaci na ispitu:

- „U namespaceu `payments` uvedi default deny za sav ulazni i izlazni saobraćaj. Dozvoli samo DNS.“
- „Podovi iz namespacea `dev` ne smiju ni na koji način doći do podova u namespaceu `prod`.“
- „Pokreni kube-bench na controlplane čvoru i ispravi sve FAIL nalaze iz sekcije 1.2 koji se tiču `--profiling` i `--authorization-mode`.“
- „kube-bench na `node01` prijavljuje da kubelet dozvoljava anonimne zahtjeve. Ispravi to.“
- „Ispravi dozvole i vlasnika direktorija `/var/lib/etcd` prema CIS preporuci.“

NetworkPolicy sintaksu znaš iz CKA. Ovdje je gledamo očima napadača: šta kompromitovan pod može da dosegne i kako mu to oduzeti. Drugi dio modula je rad sa static Pod manifestima i kubelet konfiguracijom, gdje greška obara kontrolnu ravan. Zato je bitna disciplina: backup, izmjena, provjera.

## NetworkPolicy iz sigurnosnog ugla

### Polazna tačka: ravna mreža

Bez ijedne politike Kubernetes mreža je **ravna**: svaki pod može otvoriti konekciju prema svakom podu u svakom namespaceu, prema čvorovima i prema internetu. Za napadača koji je preuzeo jedan kontejner (npr. kroz ranjivu web aplikaciju) to znači:

- **lateral movement**: skeniranje cijelog Pod CIDR-a i napad na baze, Redis, interne API-je bez autentifikacije,
- pristup servisima u `kube-system` (metrics-server, CoreDNS, ponekad dashboard),
- pristup cloud metadata servisu `169.254.169.254` (modul 02),
- **exfiltration**: slanje podataka na bilo koju adresu na internetu, preuzimanje alata.

NetworkPolicy je L3/L4 firewall po podu. Cilj je **zero trust** model: sve zabrani, pa dozvoli tačno ono što aplikaciji treba.

### Default deny po namespaceu

Prvi korak u svakom namespaceu sa aplikacijama:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: payments
spec:
  podSelector: {}          # svi podovi u namespaceu
  policyTypes:
  - Ingress
  - Egress
```

Nema `ingress` ni `egress` pravila, pa nijedna konekcija nije dozvoljena. Odmah zatim vrati DNS, inače aplikacije ne mogu razriješiti ni imena servisa:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: payments
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

Varijante koje se traže na ispitu:

| Zadatak | `policyTypes` | Pravila |
|---|---|---|
| Default deny ingress | `[Ingress]` | bez `ingress` |
| Default deny egress | `[Egress]` | bez `egress` |
| Default deny sve | `[Ingress, Egress]` | bez pravila |
| Allow all ingress (eksplicitno) | `[Ingress]` | `ingress: [{}]` |
| Allow all egress | `[Egress]` | `egress: [{}]` |

Pazi na razliku: `ingress: []` (ili izostavljeno) znači „ništa“, a `ingress: [{}]` znači „sve“. Prazno pravilo `{}` odgovara svakom izvoru i svakom portu.

> **Na ispitu:** default deny je zadatak od minut. Primjer „Default policies“ je na stranici kubernetes.io/docs/concepts/services-networking/network-policies/. Kopiraj ga, promijeni `name` i `namespace`, i obavezno provjeri da li zadatak traži samo Ingress, samo Egress ili oba.

### Izolacija namespaceova

Zahtjev „podovi iz drugih namespaceova ne smiju doći do `prod`, a unutar `prod` saobraćaj je slobodan“:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: same-namespace-only
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}      # svi podovi, ali samo iz namespacea politike (prod)
```

`podSelector: {}` unutar `from` bez `namespaceSelector` bira samo podove iz namespacea u kojem je politika. Ako ingress kontroler (Traefik u namespaceu `traefik`) mora doći do aplikacije, dodaj ga kao drugi peer:

```yaml
  ingress:
  - from:
    - podSelector: {}
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: traefik
```

Oznaku **`kubernetes.io/metadata.name`** kontrolna ravan automatski postavlja na svaki namespace, sa vrijednošću jednakom imenu. Ne može se lažirati, jer je API server prepisuje. Zato je sigurnija od proizvoljnih oznaka kao `team=frontend`, koje može dodati svako ko smije da mijenja namespace.

> **Na ispitu:** prije pisanja selektora pogledaj oznake: `kubectl get ns --show-labels` i `kubectl -n prod get pods --show-labels`. Ako zadatak kaže „namespace sa oznakom `env=dev`“, koristi baš tu oznaku, a ne ime.

### Egress kontrola

Egress je ono što napadač koristi za exfiltration i za preuzimanje alata (`curl | sh`). Primjer: backend smije samo do baze u svom namespaceu i do jednog vanjskog API-ja.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-egress
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - ipBlock:
        cidr: 203.0.113.10/32     # vanjski payment API
    ports:
    - protocol: TCP
      port: 443
```

Uz `allow-dns` iz namespacea ovo je kompletan egress. Politike se sabiraju (unija), pa DNS ne moraš ponavljati u svakoj politici.

Ograničenja koja treba znati:

- NetworkPolicy radi sa IP adresama i portovima. Ne zna za domene (`api.stripe.com`) ni HTTP putanje. Za FQDN i L7 pravila trebaju CNI ekstenzije (npr. `CiliumNetworkPolicy`), što nije standardni API.
- Podovi sa `hostNetwork: true` koriste mrežni stek čvora. Ponašanje politika prema njima nije definisano standardom i većina CNI-ja ih ne filtrira. To je dodatni razlog da Pod Security Admission (modul 07) zabrani `hostNetwork`.

### Pristup kontrolnoj ravni i kube-system

Pod sa ukradenim ServiceAccount tokenom ide na API server. Saobraćaj prema servisu `kubernetes.default` (ClusterIP, npr. `10.96.0.1:443`) kube-proxy prevodi na IP controlplane čvora i port **6443**. Politika vidi adresu poslije prevođenja, pa pravilo pišeš za IP čvora i 6443:

```bash
kubectl get endpointslices -n default -l kubernetes.io/service-name=kubernetes
# ENDPOINTS: 192.168.1.10   PORTS: 6443
```

Aplikacijama koje ne pričaju sa API-jem dovoljan je default deny egress: API server tada nije dostupan. Ako jedan pod (npr. operator) mora do API-ja, dozvoli samo njemu:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: operator-to-apiserver
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: operator
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 192.168.1.10/32     # controlplane
    ports:
    - protocol: TCP
      port: 6443
```

Zaštita **kube-system** ide iz dva smjera:

1. **Egress iz aplikacionih namespaceova**: default deny egress uz izuzetak samo za CoreDNS podove (`k8s-app=kube-dns`), ne za cijeli `kube-system`.
2. **Ingress u kube-system**: oprezno. Komponente kontrolne ravni (apiserver, etcd, scheduler, controller-manager) i `kube-proxy` rade sa `hostNetwork: true`, pa ih NetworkPolicy ionako ne štiti. Default deny ingress u `kube-system` bez izuzetaka obara DNS za cijeli klaster. Ako to radiš, odmah dodaj politiku koja dozvoljava ulaz u CoreDNS na 53 iz svih namespaceova (`namespaceSelector: {}`) i ulaz u metrics-server sa API servera.

Control plane portove (6443, 2379-2380 etcd, 10250 kubelet, 10257 controller-manager, 10259 scheduler) na nivou čvora štiti firewall hosta i cloud security grupe, ne NetworkPolicy. To pripada hardeningu hosta (modul 05).

> **Na ispitu:** prije nego što primijeniš deny u `kube-system`, provjeri da li zadatak to zaista traži. Pokvaren DNS ruši provjere u svim ostalim zadacima na istom klasteru.

### Provjera politika

```bash
kubectl -n payments get netpol
kubectl -n payments describe netpol default-deny-all

# test iz privremenog poda u istom namespaceu
kubectl -n payments run t --image=busybox:1.36 --rm -it --restart=Never -- \
  sh -c 'nslookup postgres; nc -zv -w 2 postgres 5432; wget -qO- -T 2 http://example.com'

# test iz drugog namespacea (izolacija)
kubectl -n dev run t --image=busybox:1.36 --rm -it --restart=Never -- \
  nc -zv -w 2 web.prod.svc.cluster.local 80
```

`describe` prikazuje politiku u čitljivom obliku: „Allowing ingress traffic: <none> (Selected pods are isolated for ingress connectivity)“ znači da je pod izolovan bez izuzetaka.

## CIS Kubernetes Benchmark

**CIS Kubernetes Benchmark** je dokument organizacije Center for Internet Security sa stotinama preporuka za konfiguraciju klastera. Podijeljen je u sekcije:

| Sekcija | Šta provjerava | Gdje se ispravlja |
|---|---|---|
| 1.1 Control plane config files | dozvole i vlasništvo manifesta, kubeconfig fajlova, PKI, etcd direktorija | `chmod`, `chown` na controlplane |
| 1.2 API server | flagovi kube-apiservera | `/etc/kubernetes/manifests/kube-apiserver.yaml` |
| 1.3 Controller manager | flagovi kube-controller-managera | `kube-controller-manager.yaml` |
| 1.4 Scheduler | flagovi kube-schedulera | `kube-scheduler.yaml` |
| 2 etcd | TLS i autentifikacija klijenata | `etcd.yaml` |
| 3 Control plane config | autentifikacija, audit logovi | uglavnom ručne (Manual) preporuke |
| 4 Worker nodes | dozvole fajlova kubeleta i njegova konfiguracija | `/var/lib/kubelet/config.yaml`, systemd drop-in |
| 5 Policies | RBAC, PSA, NetworkPolicy, Secreti | Kubernetes objekti |

Svaka preporuka je **Automated** (alat je može provjeriti) ili **Manual** (traži ljudsku procjenu). Brojevi provjera (npr. 1.2.15) mijenjaju se između verzija benchmarka. Na ispitu se oslanjaj na tekst provjere, ne na broj.

## kube-bench

**kube-bench** (Aqua Security) automatski provjerava preporuke: čita procese, flagove, konfiguracione fajlove i dozvole, pa ispisuje rezultat. Na lab čvorovima je verzija 0.16, a konfiguracija (definicije provjera po verziji benchmarka) je u `/etc/kube-bench/cfg`.

### Pokretanje

kube-bench se pokreće **na čvoru** koji provjerava, kao root:

```bash
# controlplane
ssh controlplane    # ili si već na njemu
kube-bench run --targets master
kube-bench run --targets master,etcd

# worker
ssh node01
kube-bench run --targets node

# samo određene provjere
kube-bench run --targets master --check 1.2.15,1.3.2

# ako ne nađe konfiguraciju
kube-bench --config-dir /etc/kube-bench/cfg run --targets master
```

Moguće mete (`--targets`) su `master`, `node`, `etcd`, `controlplane` i `policies`. kube-bench sam prepoznaje verziju Kubernetesa i bira odgovarajući benchmark. Verziju benchmarka možeš zadati ručno sa `--benchmark`.

### Čitanje izlaza

Izlaz ima tri dijela: listu provjera, remedijacije i sažetak. Skraćen primjer (brojevi zavise od verzije benchmarka):

```text
[INFO] 1 Control Plane Security Configuration
[INFO] 1.1 Control Plane Node Configuration Files
[PASS] 1.1.1 Ensure that the API server pod specification file permissions are set to 600 or more restrictive (Automated)
[FAIL] 1.1.12 Ensure that the etcd data directory ownership is set to etcd:etcd (Automated)
[INFO] 1.2 API Server
[WARN] 1.2.1 Ensure that the --anonymous-auth argument is set to false (Manual)
[FAIL] 1.2.15 Ensure that the --profiling argument is set to false (Automated)

== Remediations master ==
1.1.12 On the etcd server node, get the etcd data directory, passed as an argument --data-dir,
from the command 'ps -ef | grep etcd'.
Run the below command (based on the etcd data directory found above).
For example, chown etcd:etcd /var/lib/etcd

1.2.15 Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml
on the control plane node and set the below parameter.
--profiling=false

== Summary master ==
38 checks PASS
11 checks FAIL
12 checks WARN
0 checks INFO
```

| Status | Značenje | Šta radiš |
|---|---|---|
| **PASS** | Automatska provjera je prošla | ništa |
| **FAIL** | Automatska provjera nije prošla | ispraviš prema remedijaciji (ako zadatak to traži) |
| **WARN** | Manual provjera ili alat ne može sam da odluči | procijeniš ručno |
| **INFO** | Naslov sekcije ili informacija | ništa |

Za brzo filtriranje:

```bash
kube-bench run --targets master | grep -E '^\[(FAIL|WARN)\]'
kube-bench run --targets master | grep -A6 '^1.2.15 '      # remedijacija za jednu provjeru
kube-bench run --targets master --json > /tmp/kb.json       # mašinski čitljiv izlaz
```

> **Na ispitu:** zadatak obično nabroji tačno koje nalaze treba ispraviti. Ispravi samo njih. Ne „popravljaj“ sve FAIL nalaze odjednom: neke izmjene (npr. `--anonymous-auth=false` na API serveru, uključivanje admission pluginova koji traže dodatnu konfiguraciju) mogu oboriti kontrolnu ravan.

### Tipični nalazi i ispravke

**kube-apiserver** (`/etc/kubernetes/manifests/kube-apiserver.yaml`):

| Preporuka | Ispravno | Napomena |
|---|---|---|
| `--profiling` | `--profiling=false` | kubeadm ga ne postavlja; podrazumijevano je uključeno |
| `--authorization-mode` | sadrži `Node` i `RBAC`, nikad `AlwaysAllow` | kubeadm postavlja `Node,RBAC` |
| `--anonymous-auth` | `false` (Manual) | na kubeadm klasteru pažljivo, vidi ispod |
| `--enable-admission-plugins` | uključuje `NodeRestriction` | kubeadm ga uključuje |
| `--audit-log-path` i ostali audit flagovi | postavljeni | modul 11 |
| `--kubelet-certificate-authority` | postavljen | API server provjerava certifikat kubeleta |
| `--etcd-cafile`, `--etcd-certfile`, `--etcd-keyfile` | postavljeni | TLS prema etcd-u |

**kube-controller-manager** i **kube-scheduler**:

| Komponenta | Preporuka |
|---|---|
| controller-manager | `--profiling=false`, `--use-service-account-credentials=true`, `--bind-address=127.0.0.1`, `--terminated-pod-gc-threshold` (Manual) |
| scheduler | `--profiling=false`, `--bind-address=127.0.0.1` |

**etcd** (`/etc/kubernetes/manifests/etcd.yaml`): `--client-cert-auth=true`, `--peer-client-cert-auth=true`, `--auto-tls` i `--peer-auto-tls` ne smiju biti `true`. kubeadm ovo postavlja ispravno.

**kubelet** (`/var/lib/kubelet/config.yaml` na svakom čvoru):

| Preporuka | Polje u KubeletConfiguration |
|---|---|
| bez anonimnih zahtjeva | `authentication.anonymous.enabled: false` |
| autorizacija preko API servera | `authorization.mode: Webhook` |
| provjera klijentskih certifikata | `authentication.x509.clientCAFile: /etc/kubernetes/pki/ca.crt` |
| ugašen read-only port 10255 | `readOnlyPort: 0` |
| zaštita kernel parametara | `protectKernelDefaults: true` |
| rotacija certifikata | `rotateCertificates: true` |

**Dozvole i vlasništvo fajlova** (sekcije 1.1 i 4.1):

| Fajl ili direktorij | Dozvole | Vlasnik |
|---|---|---|
| `/etc/kubernetes/manifests/*.yaml` | 600 ili strože | `root:root` |
| `/etc/kubernetes/admin.conf`, `super-admin.conf`, `scheduler.conf`, `controller-manager.conf` | 600 | `root:root` |
| `/etc/kubernetes/pki/` (direktorij i fajlovi) | `*.crt` 600 ili strože, `*.key` 600 | `root:root` |
| `/var/lib/etcd` | 700 | `etcd:etcd` |
| `/etc/kubernetes/kubelet.conf` | 600 | `root:root` |
| `/var/lib/kubelet/config.yaml` | 600 | `root:root` |
| kubelet systemd drop-in (`/usr/lib/systemd/system/kubelet.service.d/10-kubeadm.conf`) | 600 | `root:root` |

```bash
stat -c '%a %U:%G %n' /etc/kubernetes/manifests/* /var/lib/etcd /var/lib/kubelet/config.yaml
chmod 600 /etc/kubernetes/manifests/*.yaml
chmod 700 /var/lib/etcd
id etcd || useradd -r -s /usr/sbin/nologin etcd
chown -R etcd:etcd /var/lib/etcd
```

kubeadm pokreće etcd kao root, pa korisnik `etcd` ne postoji. Remedijacija ga traži samo zbog vlasništva direktorija; etcd kontejner i dalje radi.

## Primjena ispravki u static Pod manifestima

Komponente kontrolne ravni su **static Podovi**: kubelet čita `/etc/kubernetes/manifests/` i sam ih pokreće. `kubectl edit` na mirror podu ne radi. Mijenjaš fajl na disku.

Postupak koji ne ruši klaster:

```bash
# 1. backup VAN direktorija manifests (kubelet bi pokrenuo i kopiju!)
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak

# 2. izmjena
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --advertise-address=192.168.1.10
    - --authorization-mode=Node,RBAC
    - --enable-admission-plugins=NodeRestriction
    - --profiling=false              # dodato
    # ...
```

```bash
# 3. kubelet primijeti izmjenu i ponovo kreira pod (30-90 s)
watch crictl ps --name kube-apiserver
kubectl -n kube-system get pod kube-apiserver-controlplane

# 4. provjera da je flag zaista aktivan
ps -ef | grep [k]ube-apiserver | tr ' ' '\n' | grep profiling
kube-bench run --targets master --check 1.2.15
```

Ako API server ne ustane:

```bash
crictl ps -a --name kube-apiserver          # da li kontejner uopšte postoji, Exited?
crictl logs <container-id>                  # greška u flagu: "unknown flag", "invalid value"
journalctl -u kubelet --since "5 min ago" | grep -i apiserver   # YAML se ne parsira
ls /var/log/pods/kube-system_kube-apiserver-controlplane_*/kube-apiserver/
```

Ako je YAML neispravan, kubelet ne kreira pod uopšte i greška je samo u `journalctl -u kubelet`. Ako je flag pogrešan, kontejner se pokreće i odmah pada, pa je greška u `crictl logs`.

> **Na ispitu:** backup nikad ne stavljaj u `/etc/kubernetes/manifests/`. Kubelet pokreće svaki fajl u tom direktoriju, i dva API servera na istom portu se međusobno ruše. Za scheduler i controller-manager postupak je isti, ali nema kratkog prekida `kubectl`-a.

### Zamka: `--anonymous-auth=false` na API serveru

kubeadm konfiguriše liveness i readiness probe API servera kao HTTPS GET na `/livez` i `/readyz`, bez kredencijala. Te putanje su dostupne anonimnim korisnicima. Ako postaviš `--anonymous-auth=false`, probe dobijaju 401 i kubelet može stalno restartovati API server. Zato je ova preporuka u benchmarku **Manual**. Uradi je samo ako zadatak eksplicitno traži, i nakon toga prati status poda par minuta.

## Primjena ispravki u kubelet config.yaml

Kubelet nije static Pod nego systemd servis. Konfiguraciju čita iz fajla na koji pokazuje `--config`:

```bash
ssh node01
systemctl cat kubelet                     # ExecStart i drop-in 10-kubeadm.conf
ps -ef | grep [k]ubelet | tr ' ' '\n' | grep -- --config
# --config=/var/lib/kubelet/config.yaml
```

Izmjena za tipičan nalaz „kubelet dozvoljava anonimne zahtjeve“:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook
readOnlyPort: 0
```

```bash
cp /var/lib/kubelet/config.yaml /root/kubelet-config.yaml.bak
vim /var/lib/kubelet/config.yaml
systemctl daemon-reload            # potrebno ako si mijenjao systemd fajlove; ne škodi
systemctl restart kubelet
systemctl status kubelet --no-pager
journalctl -u kubelet -n 30 --no-pager
kubectl get nodes                  # node01 mora ostati Ready
```

Ako isti parametar postoji i kao flag u `KUBELET_EXTRA_ARGS` (`/etc/default/kubelet`) ili u drop-in fajlu, **flag ima prednost** nad `config.yaml`. Ako izmjena „ne djeluje“, potraži flag:

```bash
grep -r anonymous /etc/default/kubelet /usr/lib/systemd/system/kubelet.service.d/ 2>/dev/null
```

> **Na ispitu:** kubelet se mijenja na čvoru koji zadatak navodi, obično `node01`. Ne zaboravi `ssh node01`, a na kraju `exit` nazad. Tipična zamka je ispravka na pogrešnom čvoru, pa kube-bench i dalje prijavljuje FAIL.

## Troubleshooting

| Simptom | Vjerovatan uzrok | Šta provjeriti |
|---|---|---|
| Posle default deny ništa ne radi, ni imena servisa | nema DNS izuzetka | `allow-dns` politika, UDP i TCP 53, oznaka `k8s-app=kube-dns` |
| Politika za drugi namespace ne djeluje | `podSelector` bez `namespaceSelector` gleda samo svoj namespace | `kubectl get ns --show-labels` |
| Pod i dalje vidi sve, iako je deny primijenjen | politika je u pogrešnom namespaceu ili pod ima `hostNetwork: true` | `kubectl get netpol -A`, `kubectl get pod -o yaml | grep hostNetwork` |
| `kubectl` ne odgovara nakon izmjene manifesta | API server se restartuje ili pada | `crictl ps -a`, `crictl logs`, `journalctl -u kubelet` |
| kube-bench i dalje FAIL nakon ispravke | izmjena na pogrešnom čvoru ili flag pregazio `config.yaml` | `ps -ef | grep kubelet`, `systemctl cat kubelet` |
| kube-bench ne nalazi provjere | pogrešan config dir | `--config-dir /etc/kube-bench/cfg` |
| čvor `NotReady` nakon izmjene kubeleta | sintaksna greška u `config.yaml` | `journalctl -u kubelet`, vrati backup |

## Rezime

- Bez NetworkPolicy mreža je ravna. U svakom aplikacionom namespaceu prvo default deny (Ingress i Egress), pa DNS izuzetak prema `k8s-app=kube-dns` na UDP i TCP 53.
- Izolacija namespacea: `from: [{podSelector: {}}]` dozvoljava samo isti namespace. Za druge namespaceove koristi `kubernetes.io/metadata.name`.
- Egress prema API serveru se piše za IP controlplane čvora i port 6443. Komponente sa `hostNetwork: true` NetworkPolicy ne štiti.
- kube-bench se pokreće na samom čvoru: `kube-bench run --targets master` ili `--targets node`. FAIL je automatski nalaz, WARN ručni.
- Tipične ispravke: `--profiling=false` (apiserver, controller-manager, scheduler), `--authorization-mode=Node,RBAC`, kubelet `anonymous.enabled: false` i `authorization.mode: Webhook`.
- Dozvole: manifesti i kubeconfig fajlovi 600 `root:root`, `/var/lib/etcd` 700 `etcd:etcd`.
- Static Pod: backup van `/etc/kubernetes/manifests`, izmjena, čekanje, provjera kroz `crictl` i `ps`. Kubelet: izmjena `config.yaml`, `systemctl restart kubelet`, provjera `journalctl`.
