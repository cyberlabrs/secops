## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 2 (**Cluster Hardening**, 15% ispita):

- **2.3 Restrict access to Kubernetes API**: ko smije da priča sa API serverom, kako se autentifikuje i odakle.
- **2.4 Upgrade Kubernetes to avoid vulnerabilities**: zašto i kako redovno nadograđivati klaster.

Tipični zadaci na ispitu:

- „API server prihvata anonimne zahtjeve. Isključi to i provjeri da klaster i dalje radi.“
- „Servis `kubernetes` u namespaceu `default` je tipa NodePort. Vrati ga na ClusterIP tako da API nije dostupan spolja.“
- „Uključi admission plugin `NodeRestriction` i provjeri da kubelet na `node01` ne može da mijenja oznake drugih čvorova.“
- „Napravi korisnika `jane` preko **CertificateSigningRequest**, odobri ga i dodaj ga u kubeconfig.“
- „Nadogradi control plane i `node01` na sljedeću patch verziju.“

Na CKA si već mijenjao static Pod manifeste i radio `kubeadm upgrade`. Ovdje isto znanje koristiš sa sigurnosnim ciljem: smanjiti ko i odakle može doći do API-ja i zatvoriti poznate ranjivosti.

## Put jednog zahtjeva kroz API server

Svaki zahtjev prema `kube-apiserver` prolazi tri kapije, ovim redom:

1. **Authentication** (ko si?): klijentski certifikat, bearer token (ServiceAccount, OIDC), ili ništa (anonimno).
2. **Authorization** (smiješ li?): `Node`, `RBAC`, `Webhook`, a opasni `AlwaysAllow`.
3. **Admission control** (da li je zahtjev prihvatljiv i treba li ga izmijeniti?): mutating pa validating admission plugini, webhooks i politike.

Napadač koji dođe do porta 6443 pokušava da zaobiđe neku od kapija: anonimni pristup, preširoka autorizacija, ukradeni kubeconfig ili certifikat, ili kubelet koji mijenja tuđe objekte. Ovaj modul ide redom kroz te slabosti.

| Kapija | Flag na `kube-apiserver` | Sigurna vrijednost (kubeadm) |
|---|---|---|
| Authentication | `--anonymous-auth`, `--client-ca-file` | anonimno isključeno ili ograničeno na health endpointe; CA = `/etc/kubernetes/pki/ca.crt` |
| Authorization | `--authorization-mode` | `Node,RBAC` |
| Admission | `--enable-admission-plugins` | `NodeRestriction` (plus podrazumijevani) |
| Mreža | `--kubernetes-service-node-port`, `--secure-port` | flag nije postavljen; 6443 samo iza firewalla |

## Rad sa manifestom API servera

Na kubeadm klasteru API server je **static Pod**: `/etc/kubernetes/manifests/kube-apiserver.yaml` na `controlplane`. Kubelet prati taj folder i restartuje Pod kad sačuvaš fajl.

```bash
ssh controlplane            # ako već nisi na njemu
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
vim /etc/kubernetes/manifests/kube-apiserver.yaml
watch crictl ps --name kube-apiserver   # čekaj novi kontejner (novi CONTAINER ID)
kubectl get --raw /readyz               # "ok" kad je API spreman
```

> **Na ispitu:** rezervnu kopiju čuvaj **van** `/etc/kubernetes/manifests/`. Kubelet čita sve fajlove u tom folderu, pa kopija sa istim imenom Poda pravi zbrku. Kopija u `/root/` ti omogućava da za par sekundi vratiš radno stanje ako API ne ustane.

Ako API ne ustane poslije izmjene:

```bash
crictl ps -a --name kube-apiserver                    # da li kontejner uopšte postoji
crictl logs <container-id>                            # greška u flagu se vidi u prvim linijama
ls /var/log/pods/ | grep apiserver                    # logovi i kad crictl ne vidi kontejner
journalctl -u kubelet --since "5 min ago" | grep -i apiserver   # greška u YAML sintaksi
```

## Anonimni pristup

Flag `--anonymous-auth` je po defaultu `true`. Zahtjev koji nijedan autentifikator nije ni prihvatio ni odbio dobija korisnika **`system:anonymous`** i grupu **`system:unauthenticated`**. Sa RBAC-om taj korisnik smije samo ono što mu je eksplicitno dato (npr. podrazumijevani ClusterRole `system:public-info-viewer` za `/version`, `/healthz`, `/livez`, `/readyz`).

Opasnost nastaje kad neko veže dozvole za anonimnog korisnika:

```bash
# pronađi bindinge koji uključuju anonimne korisnike
kubectl get clusterrolebindings,rolebindings -A -o wide | grep -E 'system:anonymous|system:unauthenticated'
```

Provjera spolja (sa bilo kog čvora):

```bash
curl -k https://controlplane:6443/api/v1/namespaces
# anonimno uključeno: 403 Forbidden, "User \"system:anonymous\" cannot list resource ..."
# anonimno isključeno: 401 Unauthorized
```

403 znači „znam da si anonimni korisnik, ali nemaš pravo“. 401 znači „ne prihvatam zahtjeve bez identiteta“.

### Isključivanje

Najjednostavnije je dodati flag u manifest:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --anonymous-auth=false
    - --authorization-mode=Node,RBAC
    ...
```

Pazi na posljedicu: probe static Poda (`livenessProbe`, `readinessProbe`, `startupProbe`) šalju HTTPS zahtjev na `/livez` i `/readyz` **bez kredencijala**. Bez anonimnog pristupa probe mogu dobiti 401, a kubelet tada restartuje API server u petlji. Zato poslije izmjene obavezno gledaj `crictl ps` par minuta.

Od verzije 1.34 (stable) postoji finija opcija: **AuthenticationConfiguration** sa poljem `anonymous`, koje dozvoljava anonimni pristup samo za navedene putanje:

```yaml
# /etc/kubernetes/auth-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AuthenticationConfiguration
anonymous:
  enabled: true
  conditions:
  - path: /livez
  - path: /readyz
  - path: /healthz
```

Fajl se predaje flagom `--authentication-config=/etc/kubernetes/auth-config.yaml` (i mora biti montiran u Pod preko `hostPath` volumena). Kad fajl konfiguriše `anonymous`, flag `--anonymous-auth` **ne smiješ** postaviti istovremeno; API server neće startovati.

> **Na ispitu:** radi tačno ono što zadatak traži. Ako piše „postavi `--anonymous-auth=false`“, postavi flag i ne izmišljaj AuthenticationConfiguration. Ako API poslije toga pada zbog proba, a zadatak ne kaže drugačije, provjeri u logu da li je razlog stvarno 401 na probi.

### Kubelet API

Kubelet ima sopstveni API na portu 10250 i sopstvena podešavanja u `/var/lib/kubelet/config.yaml`:

```yaml
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
authorization:
  mode: Webhook
```

`mode: AlwaysAllow` na kubeletu znači da svako ko dođe do 10250 može da izvršava komande u kontejnerima. Poslije izmjene: `systemctl restart kubelet`. Detaljne CIS provjere kubeleta radiš sa `kube-bench run --targets node` (modul 1).

## Autorizacija: Node,RBAC

`--authorization-mode` je lista autorizatora koji se pitaju redom; prvi koji kaže „da“ ili „ne“ odlučuje.

| Mod | Šta radi | Sigurnosno |
|---|---|---|
| `AlwaysAllow` | Svaki autentifikovani (i anonimni) zahtjev prolazi | Nikad u produkciji |
| `AlwaysDeny` | Sve odbija | Samo za testiranje |
| `Node` | Autorizuje kubelete (`system:node:<ime>`) samo za objekte vezane za njihov čvor | Uz NodeRestriction |
| `RBAC` | Role/ClusterRole i bindingi | Standard |
| `Webhook` | Pita spoljni servis | Po potrebi |
| `ABAC` | Statična politika u fajlu | Teško za održavanje; izbjegavati |

Ako vidiš `--authorization-mode=AlwaysAllow`, zamijeni sa `--authorization-mode=Node,RBAC`. Provjera:

```bash
kubectl auth can-i list secrets -A --as=system:anonymous      # očekuješ "no"
kubectl auth can-i get nodes --as=system:node:node01 --as-group=system:nodes
```

## Admission kontroleri i NodeRestriction

Admission plugini se uključuju flagom `--enable-admission-plugins` (lista sa zarezima, redoslijed nije bitan), a isključuju sa `--disable-admission-plugins`. Mnogi su uključeni po defaultu (npr. `NamespaceLifecycle`, `ServiceAccount`, `PodSecurity`, `ValidatingAdmissionPolicy`, `ValidatingAdmissionWebhook`). Spisak za tvoju verziju:

```bash
kubectl -n kube-system exec kube-apiserver-controlplane -- kube-apiserver -h | grep -A3 'enable-admission-plugins'
```

**NodeRestriction** nije u podrazumijevanom skupu, pa ga kubeadm eksplicitno dodaje:

```yaml
    - --enable-admission-plugins=NodeRestriction
```

### Šta NodeRestriction sprečava

Važi za kubelete koji koriste kredencijale iz grupe `system:nodes` sa korisničkim imenom `system:node:<nodeName>`. Takav kubelet:

- smije mijenjati samo **svoj** Node objekat i samo Podove vezane za svoj čvor;
- **ne smije** obrisati svoj Node objekat niti mijenjati ili uklanjati taintove;
- **ne smije** postaviti oznake sa prefiksom `node-restriction.kubernetes.io/` (rezervisan za administratore radi izolacije workloada) ni `node-role.kubernetes.io/`;
- smije postavljati samo dozvoljene `kubernetes.io/` i `k8s.io/` oznake (npr. `kubernetes.io/hostname`, `topology.kubernetes.io/zone`, `node.kubernetes.io/*`, `kubelet.kubernetes.io/*`).

Zašto je to bitno: napadač koji pobjegne iz kontejnera na `node01` dobija kubeletov kubeconfig (`/etc/kubernetes/kubelet.conf`). Bez NodeRestriction mogao bi da označi tuđe čvorove ili svoj čvor oznakom koju koristi `nodeSelector` osjetljivog workloada i tako „privuče“ tuđe Podove na kompromitovani čvor.

Test sa `node01`:

```bash
ssh node01
export KUBECONFIG=/etc/kubernetes/kubelet.conf
kubectl label node controlplane foo=bar                       # odbijeno: tuđi čvor
kubectl label node node01 node-restriction.kubernetes.io/pci=true   # odbijeno: rezervisan prefiks
kubectl label node node01 test=ok                             # dozvoljeno: obična oznaka na svom čvoru
```

> **Na ispitu:** greška u imenu plugina (npr. `NodeRestrictions`) ruši API server. Ime kopiraj sa stranice „Admission Control in Kubernetes“ (kubernetes.io/docs/reference/access-authn-authz/admission-controllers/), a ne iz glave.

Admission je i mjesto gdje se provode sigurnosne politike: **PodSecurity** (modul 7), **ImagePolicyWebhook** i **ValidatingAdmissionPolicy** (modul 10). Svi koriste isti mehanizam.

## Mrežni pristup API serveru

Ako je API dostupan sa interneta, napadač može da pokušava ukradene tokene, iskorištava ranjivosti prije autentifikacije i skenira verziju. Pravilo: **API server ne izlaži javno**. Pristup ide preko VPN-a, bastion hosta ili privatnog endpointa.

### Servis kubernetes kao NodePort

API server sam održava Service `kubernetes` u namespaceu `default`. Flag `--kubernetes-service-node-port` (ako nije nula) pretvara ga u **NodePort**, pa je API dostupan na tom portu na **svakom** čvoru.

```bash
kubectl get svc kubernetes -n default
# NAME         TYPE       CLUSTER-IP   EXTERNAL-IP   PORT(S)         AGE
# kubernetes   NodePort   10.96.0.1    <none>        443:31000/TCP   2d
```

Popravka:

1. Ukloni `--kubernetes-service-node-port=31000` iz `/etc/kubernetes/manifests/kube-apiserver.yaml` i sačekaj restart.
2. Ako je servis i dalje NodePort, obriši ga: `kubectl delete svc kubernetes -n default`. API server ga odmah ponovo kreira kao **ClusterIP**.
3. Provjeri: `kubectl get svc kubernetes` i `curl -k https://node01:31000` (treba da ne odgovara).

Isti rizik je ako neko ručno napravi dodatni Service tipa **LoadBalancer** ili NodePort koji pokazuje na API server. Potraži ih:

```bash
kubectl get svc -A | grep -E 'NodePort|LoadBalancer'
kubectl get endpointslices -A | grep 6443
```

| Tip izlaganja | Ko može doći do 6443 | Ocjena |
|---|---|---|
| ClusterIP `kubernetes` + firewall na čvoru | Podovi i administratori sa dozvoljenih adresa | Ispravno |
| NodePort na `kubernetes` servisu | Svako ko vidi bilo koji čvor | Ukloniti |
| LoadBalancer sa javnom IP | Cijeli internet | Ukloniti ili ograničiti `loadBalancerSourceRanges` |
| Privatni endpoint / VPN | Samo interna mreža | Preporučeno |

### Firewall i allowlist

Ispred API-ja stavi allowlist: security grupa u cloudu (6443 samo sa admin CIDR-a i sa čvorova) ili firewall na hostu (modul 5). Primjer sa iptables na `controlplane`:

```bash
iptables -A INPUT -p tcp --dport 6443 -s 10.0.0.0/24 -j ACCEPT    # čvorovi i admin mreža
iptables -A INPUT -p tcp --dport 6443 -j DROP
```

Upravljani klasteri (EKS, GKE, AKS) imaju sopstvene opcije za privatni endpoint i listu dozvoljenih CIDR-ova. Princip je isti.

## Kubeconfig i certifikati

**kubeconfig** je fajl sa adresom klastera, CA certifikatom i kredencijalima korisnika (klijentski certifikat i ključ ili token). Ko ima fajl, ima i identitet. Važni fajlovi na kubeadm klasteru:

| Fajl | Identitet | Napomena |
|---|---|---|
| `/etc/kubernetes/admin.conf` | `kubernetes-admin`, grupa `kubeadm:cluster-admins` | Admin preko RBAC bindinga; može se opozvati brisanjem bindinga |
| `/etc/kubernetes/super-admin.conf` | grupa `system:masters` | Zaobilazi RBAC; koristiti samo u nuždi |
| `/etc/kubernetes/kubelet.conf` | `system:node:<ime>` | Ograničen sa Node autorizacijom i NodeRestriction |
| `/etc/kubernetes/pki/ca.key` | CA ključ | Ko ga ima, potpisuje bilo koji identitet |

Dozvole: `chmod 600` na kubeconfig fajlove i ključeve, vlasnik `root`. Nikad ne dijeli `admin.conf` timovima; napravi im posebne korisnike sa minimalnim RBAC-om.

Kubernetes **nema listu opozvanih certifikata**. Klijentski certifikat važi do isteka. Ako je ukraden, jedini brzi lijek je ukloniti RBAC dozvole za taj CN ili grupu (ili rotirati CA). Grupa `system:masters` se ne može ograničiti RBAC-om, pa certifikat sa njom znači trajni puni pristup do isteka.

### Novi korisnik preko CertificateSigningRequest

Identitet iz certifikata: **CN** je korisničko ime, **O** je grupa.

```bash
openssl genrsa -out jane.key 2048
openssl req -new -key jane.key -subj "/CN=jane/O=dev" -out jane.csr
```

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <izlaz komande: base64 -w0 jane.csr>
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400      # minimum 600
  usages:
  - client auth
```

```bash
kubectl apply -f jane-csr.yaml
kubectl get csr                                 # CONDITION: Pending
kubectl certificate approve jane
kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt
openssl x509 -in jane.crt -noout -subject -enddate

kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key --embed-certs=true
kubectl config set-context jane --cluster=kubernetes --user=jane
kubectl --context jane auth can-i list pods     # "no" dok ne dodaš RBAC
```

Potpisivanje radi kube-controller-manager sa CA iz flagova `--cluster-signing-cert-file` i `--cluster-signing-key-file`. Admission plugin **CertificateSubjectRestriction** (uključen po defaultu) odbija CSR za signer `kubernetes.io/kube-apiserver-client` koji traži grupu `system:masters`.

> **Na ispitu:** prije `approve` uvijek pogledaj šta zahtjev traži: `kubectl get csr jane -o jsonpath='{.spec.request}' | base64 -d | openssl req -noout -subject`. Zadatak ponekad ima sumnjiv CSR (npr. `O=system:masters` ili `CN=system:node:...`) koji treba **odbiti** sa `kubectl certificate deny`.

### Ručno potpisivanje sa CA ključem

Ako imaš pristup `ca.key` na `controlplane`, certifikat možeš potpisati i bez CSR API-ja:

```bash
openssl x509 -req -in jane.csr \
  -CA /etc/kubernetes/pki/ca.crt -CAkey /etc/kubernetes/pki/ca.key -CAcreateserial \
  -days 30 -out jane.crt
```

To radi, ali ne ostavlja trag u API-ju (nema CSR objekta, nema audit zapisa o odobravanju) i pokazuje koliko je `ca.key` moćan. Zato ključ CA čuvaj samo na control plane čvorovima, sa dozvolom 600, a ručno potpisivanje koristi samo kad zadatak to izričito traži.

## Nadogradnja zbog ranjivosti

Svaka verzija Kubernetesa ima poznate ranjivosti koje se popravljaju u **patch** izdanjima (npr. 1.35.0 → 1.35.N). Stari klaster znači javno dokumentovane rupe.

- Projekat održava **tri posljednje minor verzije**. Svaka dobija patcheve oko godinu dana; poslije toga nema sigurnosnih popravki.
- Patch izdanja izlaze otprilike jednom mjesečno; sigurnosne popravke izlaze i van rasporeda.
- Zvanični **CVE feed** je na kubernetes.io (Reference → Kubernetes Issues and Security → Official CVE Feed), u JSON i RSS formatu:

```bash
curl -sL https://k8s.io/docs/reference/issues-security/official-cve-feed/index.json | jq '.items | length'
curl -sL https://k8s.io/docs/reference/issues-security/official-cve-feed/feed.xml | head -40
```

Uz Kubernetes nadograđuj i containerd, kernel i OS pakete čvora: ranjivost u runc-u ili kernelu (container escape) je jednako opasna kao ranjivost u API serveru.

### Version skew

| Komponenta | Dozvoljena razlika u odnosu na kube-apiserver |
|---|---|
| kube-controller-manager, kube-scheduler | Ne novija; najviše 1 minor starija |
| kubelet, kube-proxy | Ne noviji; najviše 3 minor starija |
| kubectl | ±1 minor |
| Više apiservera (HA) | Međusobno najviše 1 minor razlike |

Posljedice: **API server se nadograđuje prvi**, minor verzije se **ne preskaču** (1.34 → 1.36 nije dozvoljeno, ide 1.34 → 1.35 → 1.36), a kubelet nikad ne smije biti noviji od API servera.

### Redoslijed kubeadm nadogradnje (podsjetnik)

Na `controlplane`:

```bash
apt-mark unhold kubeadm && apt-get update && apt-get install -y kubeadm='1.35.N-*' && apt-mark hold kubeadm
kubeadm upgrade plan                    # pokazuje dostupne verzije i šta će se promijeniti
kubeadm upgrade apply v1.35.N
kubectl drain controlplane --ignore-daemonsets
apt-mark unhold kubelet kubectl && apt-get install -y kubelet='1.35.N-*' kubectl='1.35.N-*' && apt-mark hold kubelet kubectl
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon controlplane
```

Na `node01` (drain pokreni sa `controlplane`):

```bash
kubectl drain node01 --ignore-daemonsets
ssh node01
apt-mark unhold kubeadm && apt-get install -y kubeadm='1.35.N-*' && apt-mark hold kubeadm
kubeadm upgrade node
apt-mark unhold kubelet && apt-get install -y kubelet='1.35.N-*' && apt-mark hold kubelet
systemctl daemon-reload && systemctl restart kubelet
exit
kubectl uncordon node01
```

Za prelazak na novu **minor** verziju prvo promijeni repozitorij u `/etc/apt/sources.list.d/kubernetes.list` (`https://pkgs.k8s.io/core:/stable:/v1.36/deb/`), jer pkgs.k8s.io ima poseban repozitorij po minor verziji.

> **Na ispitu:** tačnu verziju paketa nađi sa `apt-cache madison kubeadm`. Na kraju provjeri `kubectl get nodes` (kolona VERSION) i `kubeadm version`. Zadatak često traži nadogradnju samo jednog čvora ili samo control planea; ne radi više nego što piše.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| `kubectl` vraća `connection refused` poslije izmjene manifesta | `crictl ps -a --name kube-apiserver`, `crictl logs`; pogrešan flag ili ime admission plugina |
| API server se restartuje svakih par minuta | Probe dobijaju 401 (anonimno isključeno); `kubectl describe pod` ne radi, pa gledaj `crictl ps -a` i log kubeleta |
| `--authentication-config` i `--anonymous-auth` zajedno | API ne startuje; ostavi samo jedno |
| Novi fajl (npr. auth-config) „ne postoji“ | Nije montiran u Pod: dodaj `volumeMounts` i `hostPath` volumen |
| CSR ostaje `Pending` | Nije odobren (`kubectl certificate approve`) |
| CSR je `Approved`, ali nema certifikata | Pogrešan `signerName` ili controller-manager ne radi |
| Korisnik sa certifikatom dobija `Forbidden` | Autentifikacija radi; nedostaje Role/RoleBinding za CN ili O |
| Kubelet na čvoru `NotReady` poslije nadogradnje | `journalctl -u kubelet`; kubelet noviji od API servera ili nije urađen `daemon-reload` |

## Rezime

- Zahtjev prolazi authentication → authorization → admission; svaku kapiju podešavaš flagovima u `/etc/kubernetes/manifests/kube-apiserver.yaml`.
- `--anonymous-auth=false` ili AuthenticationConfiguration sa `anonymous.conditions` (samo `/livez`, `/readyz`, `/healthz`); ne oba zajedno. 401 = nema anonimnog, 403 = anonimni bez prava.
- `--authorization-mode=Node,RBAC`, nikad `AlwaysAllow`; kubelet: `anonymous.enabled: false` i `authorization.mode: Webhook`.
- `NodeRestriction` ograničava kubelet na svoj Node i svoje Podove i zabranjuje oznake `node-restriction.kubernetes.io/` i `node-role.kubernetes.io/`.
- API ne izlaži spolja: ukloni `--kubernetes-service-node-port`, obriši servis `kubernetes` da se vrati kao ClusterIP, firewall/allowlist na 6443.
- Kubeconfig i `ca.key` su kredencijali; certifikati se ne mogu opozvati, a `system:masters` zaobilazi RBAC. CSR provjeri prije odobravanja.
- Nadograđuj na posljednji patch podržane minor verzije; prati CVE feed. API server ide prvi, minor verzije se ne preskaču, kubelet nikad nije noviji od API servera.
