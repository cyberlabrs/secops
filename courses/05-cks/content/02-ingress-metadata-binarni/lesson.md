## Šta ovaj modul pokriva

Modul pokriva tri cilja iz domena 1 (**Cluster Setup**, 15% ispita):

- **1.3** pravilno postavljen Ingress sa TLS-om,
- **1.4** zaštita metadata servisa i endpointa čvora (cloud metadata, kubelet API),
- **1.5** provjera binarnih fajlova platforme prije upotrebe.

Tipični zadaci na ispitu:

- „Napravi Secret `shop-tls` iz datih fajlova i osiguraj Ingress `shop` za host `shop.example.com`. HTTP mora biti preusmjeren na HTTPS.“
- „Podovi u namespaceu `apps` ne smiju pristupiti adresi `169.254.169.254`, a ostali egress mora raditi.“
- „Kubelet na `node01` odgovara na anonimne zahtjeve na portu 10250. Ispravi.“
- „U `/opt/binaries` su `kube-apiserver`, `kubelet` i `kubectl`. Uporedi njihove SHA512 sume sa zvaničnim vrijednostima i obriši one koji se ne poklapaju.“

Svaki od ovih zadataka je kratak, ali traži tačnost: pogrešan namespace Secreta, zaboravljen `except` ili jedan pogrešan znak u hashu znače nula bodova.

## Ingress sa TLS-om

Osnove Ingressa i TLS-a znaš iz CKA. Sa sigurnosnog stanovišta pitanja su: da li je saobraćaj zaista šifrovan, da li klijent dobija pravi certifikat i da li postoji nešifrovani put do aplikacije.

### Secret tipa kubernetes.io/tls

```bash
# ako certifikat nije dat, napravi samopotpisani (lab)
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=shop.example.com" -addext "subjectAltName=DNS:shop.example.com"

# Secret mora biti u ISTOM namespaceu kao Ingress
kubectl -n shop create secret tls shop-tls --cert=tls.crt --key=tls.key

kubectl -n shop get secret shop-tls
# NAME       TYPE                DATA
# shop-tls   kubernetes.io/tls   2
```

`kubectl create secret tls` provjerava da li ključ i certifikat čine par i pravi Secret tipa **`kubernetes.io/tls`** sa ključevima `tls.crt` i `tls.key`. Ako ručno pišeš YAML, vrijednosti u `data` su base64.

Prije upotrebe provjeri sadržaj certifikata:

```bash
openssl x509 -in tls.crt -noout -subject -issuer -dates -ext subjectAltName
kubectl -n shop get secret shop-tls -o jsonpath='{.data.tls\.crt}' | base64 -d \
  | openssl x509 -noout -subject -enddate
```

### spec.tls na Ingressu

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - shop.example.com
    secretName: shop-tls
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 80
```

Imperativno, pa doradi:

```bash
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.example.com/*=web:80,tls=shop-tls" --dry-run=client -o yaml > shop-ing.yaml
```

Pravila koja se provjeravaju:

- `spec.tls[].hosts` mora sadržati isti host kao `rules[].host`, a certifikat mora imati to ime u SAN polju.
- `secretName` je samo ime; Secret se traži u namespaceu Ingressa. Ne postoji `namespace` polje u `tls` bloku.
- Ako Secret ne postoji ili je neispravan, kontroler ne javlja grešku pri `apply`. Traefik tada servira svoj podrazumijevani certifikat („TRAEFIK DEFAULT CERT“). Klijent dobija upozorenje, ali bez `-k` konekcija ne prolazi.
- Kontroler terminira TLS; prema podu ide običan HTTP. Ako i taj dio mora biti šifrovan, to je mTLS između servisa (modul 08).

> **Na ispitu:** primjer TLS Ingressa je na kubernetes.io/docs/concepts/services-networking/ingress/ (sekcija TLS). Najčešća greška je Secret u pogrešnom namespaceu. Uvijek koristi `kubectl -n <ns>` i u `create secret` i u `create ingress`.

### Preusmjeravanje HTTP na HTTPS

Sam Ingress API nema polje za redirect. To radi kontroler, preko anotacija ili svojih CRD-ova, i razlikuje se od kontrolera do kontrolera:

| Kontroler | Kako se uključuje redirect |
|---|---|
| Traefik (lab) | Middleware `redirectScheme` + anotacija `traefik.ingress.kubernetes.io/router.middlewares`, ili globalno na entrypointu `web` kroz Helm values |
| ingress-nginx (povučen u martu 2026, ali ga još ima na klasterima) | `nginx.ingress.kubernetes.io/ssl-redirect: "true"` (podrazumijevano uključeno kad Ingress ima `tls`), `force-ssl-redirect: "true"` |
| Gateway API | `HTTPRoute` na HTTP listeneru sa filterom `RequestRedirect` i `scheme: https` (vidi CKA modul 10) |

Traefik primjer:

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: redirect-https
  namespace: shop
spec:
  redirectScheme:
    scheme: https
    permanent: true
```

```yaml
metadata:
  name: shop
  namespace: shop
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: shop-redirect-https@kubernetescrd
```

Format vrijednosti je `<namespace>-<ime middlewarea>@kubernetescrd`. Ako pogriješiš ime, Traefik ignoriše cijelu rutu i u logu kontrolera piše da middleware ne postoji:

```bash
kubectl -n traefik logs deploy/traefik | grep -i middleware
```

> **Na ispitu:** zadatak obično kaže koji kontroler je instaliran (`kubectl get ingressclass`, `kubectl -n <ns> get deploy`). Anotacije uzmi iz dokumentacije tog kontrolera i provjeri da li je ta dokumentacija na listi dozvoljenih. Ako nije, pogledaj postojeće Ingress resurse u klasteru (`kubectl get ing -A -o yaml | grep -A3 annotations`), često već sadrže primjer.

### Provjera certifikata i redirecta

```bash
kubectl -n traefik get svc traefik           # npr. 80:31080/TCP, 443:31443/TCP
NODE_IP=$(kubectl get node node01 -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')

# redirect: očekuješ 301 ili 308 i Location: https://...
curl -sI -H "Host: shop.example.com" http://$NODE_IP:31080/

# HTTPS sa provjerom certifikata (bez -k!)
curl -v --cacert tls.crt --resolve shop.example.com:31443:$NODE_IP https://shop.example.com:31443/

# koji certifikat server zaista šalje za taj SNI
openssl s_client -connect $NODE_IP:31443 -servername shop.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

Ako `openssl s_client` pokaže `subject=CN=TRAEFIK DEFAULT CERT`, kontroler nije našao tvoj Secret ili host u `tls.hosts` ne odgovara SNI imenu.

| Simptom | Uzrok |
|---|---|
| `curl` bez `-k`: „SSL certificate problem: self-signed certificate“ | normalno za lab certifikat; koristi `--cacert tls.crt` |
| „no alternative certificate subject name matches“ | SAN certifikata ne sadrži host |
| Server vraća podrazumijevani certifikat kontrolera | Secret u drugom namespaceu, pogrešno ime ili `tls.hosts` ne odgovara |
| HTTP vraća 200 umjesto redirecta | middleware nije povezan ili ime anotacije pogrešno |

## Cloud metadata servis

### Zašto je 169.254.169.254 opasan

Svaki veliki cloud (AWS, GCP, Azure, OpenStack) nudi **Instance Metadata Service (IMDS)** na link-local adresi **`169.254.169.254`**. VM tu dobija podatke o sebi, a što je važnije, **privremene kredencijale** IAM uloge dodijeljene čvoru:

```bash
# AWS, IMDSv1 (bez tokena) - iz kompromitovanog poda
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/<ime-uloge>
# vraća AccessKeyId, SecretAccessKey, Token
```

Pod na čvoru dijeli mrežni put čvora prema ovoj adresi. Ako napadač dobije izvršavanje koda u podu (ili samo **SSRF**, tj. natjera aplikaciju da napravi HTTP zahtjev na adresu koju on zada), može:

- ukrasti kredencijale čvora i sa njima pristupiti cloud API-ju (S3, ECR, EC2, ponekad i cijelom nalogu),
- pročitati user-data skripte, koje ponekad sadrže bootstrap tokene i lozinke,
- na nekim managed klasterima doći do kredencijala kubeleta i predstaviti se kao čvor.

Odbrana ima više slojeva: NetworkPolicy u klasteru, IMDSv2 na nivou clouda, minimalne IAM dozvole čvora i workload identitet po podu (IRSA, EKS Pod Identity, GKE Workload Identity) umjesto kredencijala čvora.

### NetworkPolicy blokada metadata adrese

Zadatak: podovi u namespaceu `apps` ne smiju do metadata servisa, a sve ostalo ostaje dozvoljeno.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata
  namespace: apps
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32
```

Politika izoluje egress svih podova i dozvoljava izlaz na sve adrese osim jedne. DNS i dalje radi jer je CoreDNS obuhvaćen sa `0.0.0.0/0`.

Ako samo određeni podovi (npr. agent koji legitimno čita metadata) smiju pristup, dodaj drugu politiku samo za njih:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-metadata-agent
  namespace: apps
spec:
  podSelector:
    matchLabels:
      role: metadata-reader
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 169.254.169.254/32
    ports:
    - protocol: TCP
      port: 80
```

Zamke:

- **Politike su unija.** Ako u namespaceu postoji i politika sa `egress: [{}]` ili `ipBlock: 0.0.0.0/0` bez `except` koja bira iste podove, metadata adresa je ponovo dostupna. Uvijek pogledaj sve politike: `kubectl -n apps get netpol -o yaml`.
- `except` mora biti unutar `cidr` opsega i piše se sa maskom (`/32`).
- NetworkPolicy je namespaced. Za cijeli klaster treba politika u svakom namespaceu (ili CNI-specifične globalne politike, npr. Calico `GlobalNetworkPolicy`, Cilium `CiliumClusterwideNetworkPolicy`).
- Podovi sa `hostNetwork: true` zaobilaze NetworkPolicy i vide metadata servis kao sam čvor.

```bash
kubectl -n apps run t --image=busybox:1.36 --rm -it --restart=Never -- \
  wget -qO- -T 3 http://169.254.169.254/latest/meta-data/
# wget: download timed out   -> blokirano
```

> **Na ispitu:** pročitaj da li zadatak traži blokadu samo metadata adrese (gornji primjer) ili default deny uz dozvole. Kod drugog slučaja metadata je blokirana automatski, ali moraš dozvoliti DNS i ono što zadatak navodi.

### IMDSv2 ukratko

AWS **IMDSv2** traži token dobijen PUT zahtjevom, koji se zatim šalje u zaglavlju:

```bash
TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/
```

Zašto pomaže:

- jednostavan SSRF (GET na URL koji napadač zada) ne može poslati PUT sa posebnim zaglavljem,
- **hop limit** odgovora na PUT se može postaviti na 1. Paket sa tokenom tada ne preživi dodatni mrežni skok do kontejnera koji nije na mreži čvora, pa podovi ne mogu dobiti token.

Na čvorovima se IMDSv2 postavlja kao obavezan (`HttpTokens=required`) i sa malim hop limitom. GCP i Azure imaju sličnu zaštitu kroz obavezna zaglavlja (`Metadata-Flavor: Google`, `Metadata: true`), ali to štiti samo od najprostijeg SSRF-a, ne od koda u podu.

## Zaštita endpointa čvora: kubelet API

Kubelet na svakom čvoru sluša na portovima:

| Port | Namjena | Rizik |
|---|---|---|
| **10250** | glavni kubelet API (HTTPS): `/pods`, `/exec`, `/run`, `/logs`, `/stats` | bez autentifikacije: izvršavanje komandi u svim kontejnerima čvora |
| **10255** | read-only HTTP API (zastario) | otkriva podove, env varijable i konfiguraciju bez ikakve autentifikacije |
| 10248 | `healthz` na localhostu | nizak |

Ispravna konfiguracija u `/var/lib/kubelet/config.yaml`:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  anonymous:
    enabled: false              # anonimni zahtjevi dobijaju 401
  webhook:
    enabled: true               # bearer tokeni se provjeravaju preko TokenReview
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook                 # svaki zahtjev se provjerava preko SubjectAccessReview
readOnlyPort: 0                 # gasi port 10255
```

| Postavka | Flag | Loša vrijednost | Dobra vrijednost |
|---|---|---|---|
| `authentication.anonymous.enabled` | `--anonymous-auth` | `true` | `false` |
| `authorization.mode` | `--authorization-mode` | `AlwaysAllow` (podrazumijevano za kubelet bez konfiguracije) | `Webhook` |
| `authentication.webhook.enabled` | `--authentication-token-webhook` | `false` | `true` |
| `readOnlyPort` | `--read-only-port` | `10255` | `0` |

Sa `authorization.mode: Webhook` kubelet pita API server da li korisnik smije npr. `get` na resursu `nodes` i podresursu `proxy`, `stats`, `log` ili `metrics`. Zato RBAC dozvola nad **`nodes/proxy`** u praksi znači izvršavanje komandi na čvoru (modul 03).

Provjera spolja, sa controlplane čvora:

```bash
curl -sk https://node01:10250/pods | head -c 200
```

| Odgovor | Značenje |
|---|---|
| JSON sa listom podova | anonimni pristup uključen i autorizacija `AlwaysAllow`: kritično |
| `Forbidden (user=system:anonymous, verb=get, resource=nodes, subresource=proxy)` | anonimni pristup uključen, ali Webhook autorizacija odbija |
| `Unauthorized` | anonimni pristup isključen: ispravno |

```bash
curl -s http://node01:10255/pods | head -c 200   # mora biti "connection refused"
```

Ispravka i restart:

```bash
ssh node01
cp /var/lib/kubelet/config.yaml /root/kubelet-config.yaml.bak
vim /var/lib/kubelet/config.yaml
systemctl restart kubelet
journalctl -u kubelet -n 20 --no-pager
exit
kubectl get node node01
```

> **Na ispitu:** posle izmjene kubeleta provjeri da `kubectl logs` i `kubectl exec` i dalje rade za pod na tom čvoru. Ako ne rade, API server nema dozvolu prema kubeletu ili si pokvario `clientCAFile`. Na kubeadm klasteru API server se kubeletu predstavlja certifikatom `apiserver-kubelet-client.crt`, koji je u grupi sa potrebnim dozvolama.

Ostali endpointi čvora: etcd (2379) ne smije biti dostupan nikome osim API serveru, a scheduler (10259) i controller-manager (10257) treba da slušaju samo na `127.0.0.1` (`--bind-address=127.0.0.1`, kubeadm podrazumijevano). Provjera:

```bash
ss -tlnp | grep -E '2379|10250|10255|10257|10259'
```

## Provjera binarnih fajlova platforme

Napadač koji podmetne izmijenjen `kubelet` ili `kubectl` ima trajni pristup koji nijedan Kubernetes alat ne vidi. Zato se binarni fajlovi provjeravaju prije instalacije i nakon sumnje na kompromitaciju.

### Provjera verzije

Prvo saznaj šta je zaista instalirano i šta se pokreće:

```bash
kubectl version                       # klijent i server
kubeadm version -o short
kubelet --version
kubectl get nodes -o wide             # VERSION kolona = verzija kubeleta na čvoru
which kubelet; systemctl cat kubelet | grep ExecStart
crictl images | grep kube-apiserver   # kontrolna ravan su slike, ne binarni fajlovi na disku
```

Hash se uvijek poredi za **istu verziju i arhitekturu** (npr. `v1.35.0`, `linux/amd64`).

### sha512sum protiv zvaničnih vrijednosti

Zvanični binarni fajlovi su na `https://dl.k8s.io/release/<verzija>/bin/linux/<arch>/<ime>`. Uz svaki je objavljen fajl sa hashom (`.sha256` i `.sha512`). Za server tarball (`kubernetes-server-linux-amd64.tar.gz`) SHA512 vrijednosti su i u CHANGELOG-u verzije na GitHubu.

```bash
V=v1.35.0
curl -LO https://dl.k8s.io/release/$V/bin/linux/amd64/kubelet
curl -LO https://dl.k8s.io/release/$V/bin/linux/amd64/kubelet.sha512

# fajl sa hashom sadrži samo hash; dodaj ime fajla i DVA razmaka
echo "$(cat kubelet.sha512)  kubelet" | sha512sum --check
# kubelet: OK
```

Lab i ispitni klaster obično nemaju internet. Tada dobiješ hash u zadatku ili u fajlu, i poređenje radiš sam:

```bash
cd /opt/binaries
sha512sum kube-apiserver kubelet kubectl

# poređenje sa datom vrijednošću (cijeli string, ne prvih par znakova)
sha512sum kubelet | awk '{print $1}' > /tmp/actual
diff /tmp/actual /opt/binaries/kubelet.sha512 && echo OK || echo MISMATCH

# provjera instaliranog binarnog fajla koji kubelet servis zaista koristi
sha512sum /usr/bin/kubelet
```

Ako dobiješ izvađen server tarball, binarni fajlovi su u `kubernetes/server/bin/`:

```bash
tar xzf kubernetes-server-linux-amd64.tar.gz
sha512sum kubernetes/server/bin/{kube-apiserver,kube-controller-manager,kube-scheduler,kubelet,kubectl}
```

> **Na ispitu:** hashevi su dugi (128 heks znakova za SHA512). Ne poredi „od oka“. Koristi `sha512sum -c`, `diff` ili `grep` sa cijelim hashom: `sha512sum kubelet | grep -q <hash> && echo OK`. Ako zadatak kaže da obrišeš neispravne fajlove, obriši samo njih.

### Potpisi: cosign ukratko

Hash dokazuje da se fajl poklapa sa objavljenom vrijednošću. **Potpis** dokazuje i ko ga je objavio. Kubernetes potpisuje binarne fajlove i slike alatom **cosign** (projekat Sigstore), bez ključeva: potpis je vezan za identitet release naloga preko kratkotrajnog certifikata.

```bash
V=v1.35.0
URL=https://dl.k8s.io/release/$V/bin/linux/amd64
curl -sSfLO $URL/kubectl
curl -sSfLO $URL/kubectl.sig
curl -sSfLO $URL/kubectl.cert

cosign verify-blob kubectl \
  --signature kubectl.sig \
  --certificate kubectl.cert \
  --certificate-identity krel-staging@k8s-releng-prod.iam.gserviceaccount.com \
  --certificate-oidc-issuer https://accounts.google.com
# Verified OK
```

Slike kontrolne ravni sa `registry.k8s.io` se provjeravaju sa `cosign verify` i identitetom `krel-trust@k8s-releng-prod.iam.gserviceaccount.com`. cosign 2.x obavezno traži `--certificate-identity` i `--certificate-oidc-issuer`. Detaljnije o potpisima slika i lancu snabdijevanja je u modulu 10. Postupak sa tačnim komandama je na kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/.

| Metoda | Šta dokazuje | Traži |
|---|---|---|
| `sha512sum` | fajl je identičan objavljenom | pouzdan izvor hasha |
| `cosign verify-blob` | fajl je potpisao Kubernetes release proces | `.sig`, `.cert`, mrežu za Rekor (transparency log) |
| `kubelet --version` | samo šta binarni fajl tvrdi o sebi | ništa; lako lažirati |

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| Ingress na HTTPS vraća podrazumijevani certifikat kontrolera | Secret u istom namespaceu, ime u `secretName`, `tls.hosts` = `rules.host` |
| `kubectl create secret tls` javlja grešku o ključu | ključ i certifikat nisu par: uporedi `openssl x509 -noout -modulus` i `openssl rsa -noout -modulus` |
| Pod i dalje dostiže 169.254.169.254 | druga politika sa širim egressom (unija), pod sa `hostNetwork`, politika u pogrešnom namespaceu |
| Posle izmjene kubeleta `kubectl logs` vraća Forbidden ili Unauthorized | `clientCAFile` putanja, `authorization.mode`, dozvole API servera prema kubeletu |
| `curl https://node01:10250/pods` i dalje vraća podove | kubelet nije restartovan ili flag `--anonymous-auth=true` pregazio config |
| `sha512sum -c` javlja „improperly formatted“ | u liniji fali ime fajla ili su između hasha i imena dva razmaka |

## Rezime

- TLS Ingress: Secret tipa `kubernetes.io/tls` u istom namespaceu, `spec.tls[].hosts` jednak hostu pravila, certifikat sa tim imenom u SAN.
- HTTP na HTTPS redirect radi kontroler: u Traefiku Middleware `redirectScheme` i anotacija `router.middlewares`, u Gateway API filter `RequestRedirect`.
- Provjera: `curl --cacert ... --resolve ...` bez `-k` i `openssl s_client -servername ...`.
- `169.254.169.254` daje kredencijale čvora. Blokada: egress `ipBlock 0.0.0.0/0` sa `except: [169.254.169.254/32]`, uz pažnju na druge politike (unija) i `hostNetwork` podove.
- IMDSv2 sa obaveznim tokenom i hop limitom 1 sprečava SSRF i pristup iz kontejnera.
- Kubelet: `anonymous.enabled: false`, `webhook.enabled: true`, `authorization.mode: Webhook`, `readOnlyPort: 0`; provjera sa `curl -sk https://node01:10250/pods` (očekuješ Unauthorized).
- Binarni fajlovi: ista verzija i arhitektura, `sha512sum` protiv zvaničnog `.sha512`, poređenje cijelog hasha; cosign `verify-blob` potvrđuje i izdavača.
