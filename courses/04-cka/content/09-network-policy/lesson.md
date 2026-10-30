## Šta ovaj modul pokriva

Modul pokriva cilj **3.2** iz domena 3 (**Services & Networking**, 20% ispita): definisanje i primjena **NetworkPolicy** pravila.

Tipični zadaci na ispitu:

- „Napravi NetworkPolicy `allow-frontend` u namespaceu `backend` koja dozvoljava ulaz na port 8080 samo podovima sa oznakom `app=frontend` iz namespacea `frontend`.“
- „Uvedi default deny za ulazni i izlazni saobraćaj u namespaceu `secure`, ali ostavi DNS.“
- „Od tri ponuđene politike primijeni onu koja ispunjava uslove uz najmanje dozvola.“
- „Pod `api` ne može da dođe do baze. Pronađi politiku koja blokira i popravi je.“

NetworkPolicy se ne može napisati imperativno (`kubectl create` nema podkomandu za nju), pa YAML moraš pisati brzo i tačno. Za CKS je ovo jedna od najvažnijih tema, pa vrijedi naučiti je temeljno.

## Šta NetworkPolicy jeste, a šta nije

**NetworkPolicy** (`networking.k8s.io/v1`) je namespaced resurs koji opisuje koji saobraćaj na nivou L3/L4 (IP adresa, protokol, port) smije ući u pod i izaći iz njega. Kubernetes API samo čuva objekat. Pravila u kernelu primjenjuje **CNI plugin**.

- CNI koji podržava politike: Calico, Cilium, kindnet (u labovima kursa), Antrea i drugi.
- CNI koji ih **ne** podržava (npr. Flannel sam): `kubectl apply` prolazi bez greške, objekat postoji, ali **ništa se ne blokira**.

> **Na ispitu:** ako politika „ne radi“, a YAML je ispravan, provjeri koji CNI je u klasteru: `kubectl -n kube-system get pods` i `ls /etc/cni/net.d/`. Na ispitnim klasterima CNI podržava politike, pa je greška skoro uvijek u selektorima ili oznakama.

## Semantika: četiri pravila koja moraš znati

1. **Bez politike sve je dozvoljeno.** Pod koji nijedna politika ne bira je „non-isolated“: prima i šalje sve.
2. **Izolacija počinje kad politika izabere pod.** Čim bar jedna politika sa `policyTypes: [Ingress]` izabere pod (preko `spec.podSelector`), pod postaje izolovan za ulaz i prima **samo** ono što neka politika eksplicitno dozvoli. Isto važi za `Egress` posebno.
3. **Politike su aditivne.** Nema „deny“ pravila. Ako više politika bira isti pod, dozvoljeno je sve što dozvoljava **bilo koja** od njih (unija). Redoslijed ne postoji.
4. **Konekcija treba dozvolu na oba kraja.** Saobraćaj od A do B prolazi samo ako egress strana A dozvoljava izlaz prema B **i** ingress strana B dozvoljava ulaz od A (ako je bilo koja strana izolovana). Odgovori na dozvoljenu konekciju prolaze automatski (politike su stateful).

### policyTypes

| `policyTypes` | Efekat na izabrane podove |
|---|---|
| `[Ingress]` | Izoluje ulaz; dozvoljava samo `ingress` pravila |
| `[Egress]` | Izoluje izlaz; dozvoljava samo `egress` pravila |
| `[Ingress, Egress]` | Izoluje oba smjera |
| izostavljeno | Uvijek `Ingress`; `Egress` se dodaje samo ako politika ima `egress` sekciju |

Zato politika koja ima samo `egress` pravila, a nema `policyTypes`, ne izoluje ulaz. Najsigurnije je uvijek eksplicitno pisati `policyTypes`.

## Struktura politike

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
  namespace: backend            # politika važi samo za podove u ovom namespaceu
spec:
  podSelector:                  # KOJE podove štiti ova politika
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  ingress:
  - from:                       # ODAKLE smije doći saobraćaj
    - podSelector:
        matchLabels:
          app: frontend
    ports:                      # NA KOJE portove izabranih podova
    - protocol: TCP
      port: 8080
```

- `spec.podSelector: {}` bira **sve** podove u namespaceu politike.
- `ingress[].from` i `egress[].to` su liste **peerova**. Peer je `podSelector`, `namespaceSelector`, kombinacija ta dva ili `ipBlock`.
- `ports` u pravilu ograničava portove na **odredišnom** podu (za ingress) ili odredištu (za egress).
- Unutar jednog pravila `from` i `ports` se kombinuju sa **AND**: izvor mora odgovarati **i** port mora odgovarati.
- Više pravila (stavki u `ingress` listi) se kombinuje sa **OR**.

### Selektori peerova

| Peer | Šta bira |
|---|---|
| `podSelector` sam | Podove sa tim oznakama u **namespaceu politike** |
| `namespaceSelector` sam | **Sve** podove u namespaceima sa tim oznakama |
| `namespaceSelector` + `podSelector` u **istoj** stavci | Podove sa tim oznakama, ali samo u namespaceima sa tim oznakama |
| `ipBlock` | IP opseg (CIDR), uz opcioni `except`; namijenjen za adrese van klastera |

`podSelector` sam nikad ne izlazi iz namespacea politike. Za podove iz drugog namespacea moraš dodati `namespaceSelector`.

## AND vs OR: najčešća zamka

Razlika je u jednoj crtici (`-`). Uporedi:

```yaml
# VARIJANTA A: jedna stavka, dva selektora → AND
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: frontend
    podSelector:
      matchLabels:
        app: web
```

```yaml
# VARIJANTA B: dvije stavke → OR
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: frontend
  - podSelector:
      matchLabels:
        app: web
```

| | Ko smije ući |
|---|---|
| A | Samo podovi `app=web` **koji su u** namespaceu `frontend` |
| B | **Svi** podovi iz namespacea `frontend` **ili** podovi `app=web` iz namespacea politike |

Varijanta B je mnogo šira. Na ispitu pročitaj tekst zadatka („podovi `app=web` iz namespacea `frontend`“ znači A) i pažljivo pazi na uvlačenje: `podSelector` u varijanti A je poravnat sa `namespaceSelector`, bez crtice.

> **Na ispitu:** poslije `kubectl apply` pokreni `kubectl describe networkpolicy <ime> -n <ns>`. Opis ispisuje pravila riječima („NamespaceSelector: … PodSelector: …“ u istom bloku za AND, odvojeno za OR), pa odmah vidiš da li si napravio AND ili OR.

## Oznaka kubernetes.io/metadata.name

Svaki namespace automatski ima oznaku **`kubernetes.io/metadata.name`** čija vrijednost je ime namespacea. API server je postavlja i ne može se trajno promijeniti. Zato ne moraš dodavati vlastite oznake namespaceu da bi ga izabrao:

```bash
kubectl get ns frontend --show-labels
# NAME       STATUS   AGE   LABELS
# frontend   Active   5m    kubernetes.io/metadata.name=frontend
```

```yaml
namespaceSelector:
  matchLabels:
    kubernetes.io/metadata.name: frontend
```

Ako zadatak kaže „namespace sa oznakom `team=blue`“, koristi tu oznaku. Ako kaže „namespace `frontend`“, koristi `kubernetes.io/metadata.name`. `namespaceSelector: {}` bira sve namespaceove.

## Default deny politike

Default deny ingress za cijeli namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: secure
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

Default deny egress:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: secure
spec:
  podSelector: {}
  policyTypes:
  - Egress
```

Oba smjera u jednoj politici: `policyTypes: [Ingress, Egress]` bez ikakvih pravila.

Suprotno, „dozvoli sve“ za ulaz (prazno pravilo bira sve izvore):

```yaml
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - {}
```

Uporedi: `ingress: []` ili bez `ingress` ključa znači „ništa“, a `ingress: [{}]` znači „sve“.

### Dozvola DNS-a poslije default deny egress

Čim uvedeš default deny egress, podovi više ne mogu razriješiti nijedno ime, jer UDP/TCP 53 prema CoreDNS-u je izlazni saobraćaj. Simptom: `wget web` kaže „bad address“, a `wget <IP>` (ako je dozvoljen) radi.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: secure
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

Napomene:

- Navedi **i UDP i TCP** 53. Veći odgovori i neki klijenti koriste TCP.
- Politika gleda IP adresu **poda** CoreDNS-a (nakon što kube-proxy prevede ClusterIP servisa `kube-dns`), zato selektor bira podove, a ne servis. Port je port kontejnera CoreDNS-a (53).
- Ako ne znaš oznake CoreDNS podova, dovoljno je samo `namespaceSelector` za `kube-system` (malo šire, ali radi).

## Portovi i endPort

```yaml
ports:
- protocol: TCP
  port: 8080            # jedan port
- protocol: TCP
  port: 32000
  endPort: 32768        # opseg 32000–32768
- protocol: TCP
  port: http            # imenovani port iz containerPort definicije poda
```

- `protocol` je podrazumijevano `TCP`. Podržani su `TCP`, `UDP`, `SCTP`.
- `endPort` traži numerički `port` i mora biti ≥ `port`; ne radi sa imenovanim portom.
- Izostavljen `ports` znači svi portovi.

## ipBlock

```yaml
egress:
- to:
  - ipBlock:
      cidr: 10.0.0.0/16
      except:
      - 10.0.5.0/24
  ports:
  - protocol: TCP
    port: 5432
```

`ipBlock` je namijenjen za saobraćaj prema adresama van klastera. Za podove koristi selektore: IP adrese podova se mijenjaju, a kod nekih CNI-ja i NAT-a izvorna adresa ne mora biti ona koju očekuješ. Egress na internet uz izuzetak internih mreža:

```yaml
egress:
- to:
  - ipBlock:
      cidr: 0.0.0.0/0
      except: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
```

## Kompletan primjer: troslojna aplikacija

Zadatak: u namespaceu `app` baza (`tier=db`) prima samo od API-ja (`tier=api`) na 5432; API prima samo od ingress kontrolera iz namespacea `traefik` na 8080; sve ostalo zabranjeno, DNS dozvoljen.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-from-api
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: db
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: api
    ports:
    - port: 5432
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-from-traefik
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes: [Ingress]
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: traefik
    ports:
    - port: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-egress-db
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes: [Egress]
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: db
    ports:
    - port: 5432
```

Uz to idu `default-deny-ingress`, `default-deny-egress` i `allow-dns` iz prethodnih sekcija. Primijetiti: API → DB konekcija treba **egress** dozvolu na API strani **i** **ingress** dozvolu na DB strani, jer su obje strane izolovane.

> **Na ispitu:** stranica „Network Policies“ u dokumentaciji (kubernetes.io/docs/concepts/services-networking/network-policies/) ima kompletan primjer sa `ipBlock`, `namespaceSelector`, `podSelector` i default deny politikama. Kopiraj ga u fajl i mijenjaj, umjesto da pišeš od nule.

## Testiranje politika

Privremeni pod sa odgovarajućim oznakama u odgovarajućem namespaceu:

```bash
# Ciljni servis i pod
kubectl -n app get pods -o wide --show-labels
kubectl -n app get svc

# Test sa oznakom koja treba biti dozvoljena
kubectl -n app run t --rm -it --restart=Never --image=busybox:1.36 \
  --labels=tier=api -- wget -qO- -T 2 http://db:5432 ; echo "exit $?"

# Test bez oznake (treba da padne na timeout)
kubectl -n app run t2 --rm -it --restart=Never --image=busybox:1.36 \
  -- nc -zv -w 2 db 5432

# Iz drugog namespacea
kubectl -n frontend run t3 --rm -it --restart=Never --image=busybox:1.36 \
  -- wget -qO- -T 2 http://api.app:8080
```

Kako čitati rezultat:

| Rezultat | Značenje |
|---|---|
| Odgovor ili `open` | Saobraćaj prolazi |
| `download timed out` / `timed out` | Paket se odbacuje: politika (ili mreža) blokira |
| `Connection refused` | Paket je stigao do poda, ali na tom portu niko ne sluša: politika **nije** problem |
| `bad address` | DNS ne radi: provjeri egress na port 53 |

Uvijek koristi timeout (`-T 2` za wget, `-w 2` za nc), inače čekaš i do dvije minute po pokušaju.

> **Na ispitu:** test pod napravi sa `--labels` koje zadatak navodi. Česta greška je testirati iz poda bez oznake i zaključiti da politika ne radi, ili obratno.

## Troubleshooting

```bash
kubectl get netpol -A
kubectl -n app describe netpol
kubectl -n app get pods --show-labels
kubectl get ns --show-labels
```

| Simptom | Uzrok |
|---|---|
| Politika postoji, ništa nije blokirano | `podSelector` ne bira ciljni pod (pogrešna oznaka), politika je u pogrešnom namespaceu, ili CNI ne podržava politike |
| Blokirano više nego očekivano | Nedostaje egress dozvola na izvoru ili DNS egress |
| Dozvoljeno više nego očekivano | OR umjesto AND u `from`; postoji druga politika koja dozvoljava (aditivnost); `namespaceSelector: {}` |
| Izvor iz drugog namespacea je blokiran | `podSelector` bez `namespaceSelector` gleda samo namespace politike |
| `endPort` odbijen pri apply | `port` je imenovan ili `endPort` < `port` |

Pošto su politike aditivne, popravka „previše dozvoljeno“ je uvijek: nađi **sve** politike koje biraju taj pod i provjeri svaku. Izmjena jedne politike ne poništava drugu.

## AdminNetworkPolicy i ClusterNetworkPolicy (van ispita)

NetworkPolicy je namespaced i nema „deny“, pa administrator klastera ne može nametnuti pravila koja timovi ne mogu zaobići. Za to SIG Network razvija projekat **Network Policy API** (CRD-ovi, ne dio jezgra Kubernetesa). Ranije alfa resurse **AdminNetworkPolicy** i **BaselineAdminNetworkPolicy** u verziji v1alpha2 (2026) zamijenio je jedinstveni **ClusterNetworkPolicy** sa poljem `tier` (Admin ili Baseline) i akcijama poput Accept, Deny i Pass. API je još alfa, a podržavaju ga samo neki CNI-ji. **Nije dio CKA ispita**; dovoljno je znati da postoji.

## Rezime

- NetworkPolicy je L3/L4 firewall po podovima; primjenjuje ga CNI, a CNI bez podrške (npr. Flannel) tiho ignoriše politike.
- Pod je izolovan tek kad ga politika izabere za dati `policyType`; tada prolazi samo ono što neka politika dozvoli. Politike su aditivne, nema deny pravila ni redoslijeda.
- Konekcija treba egress dozvolu na izvoru i ingress dozvolu na odredištu (ako su izolovani); odgovori prolaze automatski.
- U `from`/`to`: `namespaceSelector` i `podSelector` u **istoj** stavci = AND; u **odvojenim** stavkama (svaka sa crticom) = OR.
- `podSelector: {}` bira sve podove namespacea; `policyTypes` bez pravila = default deny; `ingress: [{}]` = dozvoli sve.
- Poslije default deny egress dozvoli DNS: UDP i TCP 53 prema `kube-system` (`kubernetes.io/metadata.name: kube-system`, `k8s-app: kube-dns`).
- `endPort` daje opseg portova uz numerički `port`; `ipBlock` je za adrese van klastera.
- Testiraj privremenim podom sa tačnim oznakama i timeoutom (`wget -T 2`, `nc -w 2`); timeout znači blokirano, „connection refused“ znači da je mreža prošla.
