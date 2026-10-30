## Ciljevi ispita: 4.6 i 4.7

Ovaj modul zatvara domen 4 (**Cloud Application Security**, 16% ispita) sa dva cilja:

- **4.6 Comprehend and apply the specifics of cloud application architecture**
  - supplemental security components: Web Application Firewall (WAF), Database Activity Monitoring (DAM), XML firewalls, API gateway, load balancer,
  - cryptography,
  - sandboxing,
  - application virtualization and orchestration: microservices, containers, Docker, Kubernetes.
- **4.7 Design appropriate Identity and Access Management (IAM) solutions**
  - federated identity,
  - Identity Providers (IdP),
  - Single Sign-On (SSO),
  - Multi-Factor Authentication (MFA),
  - Cloud Access Security Broker (CASB),
  - secrets, key, and certificate management.

Iz AWS Security Specialty i CKS kurseva znaš konkretne servise: AWS WAF, ALB, API Gateway, KMS, Secrets Manager, IAM Identity Center, Kubernetes RBAC i NetworkPolicy. CCSP traži da te stvari opišeš vendor-neutralno i da izabereš **pravu komponentu za pravi problem** i **pravi dizajn identiteta za pravi model saradnje**. Pitanja često nude dvije kontrole koje obje „pomažu“, a samo jedna je primarno namijenjena opisanom riziku.

## Dopunske sigurnosne komponente (4.6)

### Zašto „supplemental“

Riječ **supplemental** je važna: ove komponente su sloj **odbrane u dubini** (defense in depth) ispred ili oko aplikacije. One ne zamjenjuju sigurno pisan kod. WAF koji blokira SQL injection ne popravlja ranjiv upit; on kupuje vrijeme i smanjuje izloženost dok se kod ne popravi (**virtual patching**).

### Pregled komponenti

| Komponenta | OSI sloj / mjesto | Primarna funkcija | Šta NE radi |
|---|---|---|---|
| **WAF** (Web Application Firewall) | L7, ispred web aplikacije | filtrira HTTP(S) zahtjeve po pravilima (OWASP Top 10 obrasci, rate-based pravila, geo, bot zaštita) | ne štiti od grešaka poslovne logike i autorizacije, ne vidi bazu |
| **DAM** (Database Activity Monitoring) | uz bazu (agent ili mrežni senzor) | prati i alarmira SQL aktivnost u realnom vremenu, uključujući privilegovane korisnike; može blokirati | ne štiti web sloj, ne zamjenjuje enkripciju |
| **XML firewall** | L7, ispred XML/SOAP servisa | validira XML šemu, provjerava WS-Security potpise, štiti od XML napada (XXE, XML bomb), transformiše poruke | nije opšti web firewall za JSON/HTML |
| **API gateway** | L7, ulazna tačka za API-je | autentifikacija i autorizacija poziva, rate limiting i kvote, routing, transformacija, logovanje, verzionisanje | nije zamjena za autorizaciju na nivou objekta u servisu |
| **Load balancer** | L4 (mrežni) ili L7 (aplikacioni) | raspodjela saobraćaja, health checks, TLS terminacija, dostupnost | sam po sebi nije sigurnosni filter (iako skriva backend i apsorbuje dio DoS-a) |

Dodatne komponente koje ISC2 materijali spominju u ovom kontekstu: **IDS/IPS**, **DLP**, **anti-malware** za upload, **CDN** sa DDoS zaštitom, **RASP**.

### WAF detaljnije

WAF radi u jednom od dva modela:

- **Negativni model (blocklist)**: blokira poznate napade (potpisi, managed rule setovi, npr. OWASP Core Rule Set). Lako se uvodi, ali propušta nove varijante.
- **Pozitivni model (allowlist)**: dozvoljava samo poznato dobro (dozvoljene putanje, metode, parametri). Jači, ali zahtijeva održavanje.

Tipičan postupak uvođenja: WAF prvo u **detection/count** modu da se vide lažni pozitivi, zatim u **blocking** modu. U cloudu se WAF veže za CDN, load balancer ili API gateway (u AWS-u CloudFront, ALB, API Gateway).

### DAM detaljnije

DAM je odgovor na pitanje „ko je šta radio u bazi“, uključujući DBA-ove čije akcije native logovi baze možda ne bilježe nezavisno. Bitna osobina je **razdvajanje dužnosti**: DAM nadzire administratore baze, pa njime ne smiju upravljati isti ljudi. U PaaS bazama (managed DB) agent na hostu često nije moguć, pa se koriste native audit logovi servisa poslati u SIEM ili DAM rješenja koja podržavaju taj servis.

### XML firewall i API gateway

XML firewall je specijalizovan za SOAP i XML: provjerava da je poruka validna prema šemi (XSD), da potpis i enkripcija po WS-Security odgovaraju, i odbija zlonamjerne konstrukcije poput eksternih entiteta. Danas je ta funkcija često dio API gatewaya ili enterprise service busa.

API gateway je centralna tačka za sve API pozive. Daje dosljednu autentifikaciju (validacija JWT/OAuth tokena), kvote po klijentu, logovanje i skrivanje interne topologije. U mikroservisnoj arhitekturi gateway štiti **north-south** saobraćaj (izvana prema unutra), a **service mesh** (npr. Istio, Linkerd) štiti **east-west** saobraćaj između servisa kroz mTLS i politike.

> **Na ispitu:** prepoznaj ključnu riječ. „Zaštita SOAP servisa i validacija XML poruka“ = XML firewall. „Praćenje privilegovanih korisnika baze u realnom vremenu“ = DAM. „Blokiranje SQL injectiona i XSS-a ispred web aplikacije bez izmjene koda“ = WAF. „Rate limiting i autentifikacija za sve API-je na jednom mjestu“ = API gateway. „Raspodjela opterećenja i health checks“ = load balancer.

### Gdje komponente stoje u referentnoj arhitekturi

Tipičan put zahtjeva u cloud web aplikaciji sa slojevitom zaštitom:

1. **DNS i CDN** sa DDoS zaštitom apsorbuju volumetrijske napade na rubu mreže.
2. **WAF** na CDN-u ili load balanceru filtrira L7 napade i botove.
3. **Load balancer** terminira TLS (i po potrebi ponovo šifruje prema backendu), radi health checks i raspoređuje saobraćaj.
4. **API gateway** validira tokene, primjenjuje kvote i rutira prema servisima.
5. **Aplikacijski servisi** u privatnim subnetima, bez direktnog pristupa sa interneta, sa vlastitom autorizacijom po objektu.
6. **Service mesh** štiti east-west saobraćaj mTLS-om između servisa.
7. **Baza** u izolovanom subnetu, šifrovana, nadgledana kroz **DAM** ili native audit logove poslane u SIEM.
8. Svi slojevi šalju logove u **centralni SIEM**, van kontrole administratora tih slojeva.

Svaki sloj hvata drugu klasu problema; nijedan sam ne pokriva sve. To je suština defense in depth pristupa koji ISC2 očekuje.

### Scenarij

E-commerce firma ima ranjivost SQL injectiona u starom modulu, a popravka koda traje tri sedmice. Šta uraditi PRVO? Uvesti WAF pravilo (virtual patch) da se odmah smanji izloženost, uz praćenje u DAM-u ili logovima baze, i paralelno popraviti kod. WAF je privremena kompenzaciona kontrola; trajno rješenje je parametrizovan upit.

## Kriptografija u cloud aplikacijama (4.6)

Kriptografija se u CCSP-u pojavljuje u više domena (zaštita podataka je domen 2). Ovdje je fokus na **arhitekturi aplikacije**: gdje se šta šifruje i ko drži ključeve.

| Stanje podataka | Tehnika | Napomena |
|---|---|---|
| **Data in transit** | TLS 1.2/1.3, mTLS između servisa, IPsec VPN | TLS terminacija na load balanceru znači da je saobraćaj iza njega nešifrovan, osim ako se ponovo ne šifruje |
| **Data at rest** | enkripcija volumena, objekata, baza; envelope encryption | ključevi u KMS-u ili HSM-u |
| **Data in use** | confidential computing (TEE, npr. Intel SGX/TDX, AMD SEV), homomorfna enkripcija (ograničeno) | štiti podatke i od administratora hosta |

**Envelope encryption**: podaci se šifruju **data encryption key** (DEK) ključem, a DEK se šifruje **key encryption key** (KEK) ključem koji nikad ne napušta KMS/HSM. Prednost: veliki podaci se šifruju lokalno i brzo, rotacija KEK-a ne traži ponovno šifrovanje svih podataka, a pristup podacima se kontroliše kroz pristup KEK-u.

Nivoi enkripcije u aplikaciji:

| Nivo | Ko vidi plaintext | Prednost | Mana |
|---|---|---|---|
| Storage-level (transparentna enkripcija diska/servisa) | svako ko ima pristup kroz servis | jednostavno, štiti od krađe medija | ne štiti od kompromitovane aplikacije ili prekomjernih dozvola |
| Database-level (TDE, enkripcija kolona) | baza i ovlašteni upiti | granularnije | administrator baze i dalje može vidjeti podatke |
| Application-level (aplikacija šifruje prije slanja) | samo aplikacija sa ključem | najjača zaštita od CSP-a i DBA-a | teže pretraživanje, složenije upravljanje |

Za pretraživanje šifrovanih podataka koriste se **tokenizacija** (zamjena vrijednosti tokenom, original u vaultu) i **format-preserving encryption**. Za AI aplikacije važi isto: podaci za trening i vektorske baze su osjetljivi podaci i šifruju se kao i svi drugi.

> **Na ispitu:** kada je zahtjev da „ni CSP ni administrator baze ne smiju vidjeti podatke“, NAJBOLJI odgovor je enkripcija na nivou aplikacije (ili klijenta) sa ključevima pod kontrolom kupca, ne transparentna enkripcija diska. Transparentna enkripcija štiti od fizičke krađe medija, a ne od nekoga ko legitimno pristupa kroz servis.

## Sandboxing (4.6)

**Sandboxing** je izvršavanje koda u izolovanom okruženju sa ograničenim pristupom resursima sistema, tako da zlonamjeran ili neispravan kod ne može uticati na ostatak sistema.

Primjene u cloudu:

- **Testiranje i analiza nepovjerljivog koda**: malware detonation sandbox za priloge i uploadove.
- **Izolacija tenanta**: serverless platforme izvršavaju funkcije različitih kupaca u lakim mikro-VM-ovima (npr. Firecracker u AWS Lambdi), a gVisor i Kata Containers daju jaču izolaciju kontejnera.
- **Razvoj i testiranje**: odvojena okruženja bez pristupa produkciji.
- **Browser i plugin izolacija**: kod treće strane radi sa minimalnim ovlastima.
- **AI agenti**: kod koji generiše LLM izvršava se u sandboxu bez pristupa mreži i tajnama.

Tehnički mehanizmi: odvojeni procesi i korisnici, Linux namespaces i cgroups, seccomp profili, AppArmor/SELinux, mikro-VM-ovi, odvojeni cloud nalozi ili projekti, mrežna izolacija.

Odnos prema srodnim pojmovima: **application virtualization** (npr. pokretanje aplikacije u izolovanom kontejneru ili kroz alate tipa App-V/Wine) apstrahuje aplikaciju od OS-a i usput je izoluje; sandbox je primarno sigurnosni koncept.

## Virtualizacija i orkestracija aplikacija (4.6)

### Mikroservisi

**Mikroservisna arhitektura** razbija aplikaciju na male, nezavisno deployabilne servise koji komuniciraju preko API-ja ili poruka.

| Aspekt | Monolit | Mikroservisi |
|---|---|---|
| Napadna površina | manja broj ulaza, ali jedan kompromis = cijela aplikacija | više API-ja i mrežnih tokova, ali kompromis jednog servisa može biti izolovan |
| Autentifikacija između komponenti | pozivi u istom procesu | servis-servis autentifikacija (mTLS, tokeni, workload identity) |
| Tajne | jedno mjesto | mnogo servisa, potreban centralni secrets manager |
| Logovanje | jedan log | distribuirano, potreban correlation ID i centralni log |
| Patching | sve odjednom | servis po servis, brže, ali više artefakata |
| Least privilege | gruba granularnost | svaki servis ima samo svoje dozvole |

### Kontejneri i Docker

**Kontejner** pakuje aplikaciju sa zavisnostima i dijeli kernel hosta. To je lakše od VM-a, ali je izolacija slabija: ranjivost kernela ili pogrešna konfiguracija (privilegovan kontejner, montiran Docker socket, root korisnik) može dovesti do bijega na host.

| Kriterij | Virtuelna mašina | Kontejner |
|---|---|---|
| Izolacija | hipervizor, odvojen kernel | namespaces i cgroups, dijeljen kernel |
| Veličina i start | GB, minute | MB, sekunde |
| Sigurnosna granica | jača | slabija, zahtijeva hardening |
| Patching | OS u svakom VM-u | rebuild image-a, ne patch u radu |

Ključne kontrole za kontejnere (znaš ih iz CKS-a):

- **minimalni base image** (distroless, alpine), bez nepotrebnih alata,
- **skeniranje image-a** u registryju i pipelineu, potpisivanje image-a,
- **non-root korisnik**, read-only root filesystem, bez privileged moda, ograničene Linux capabilities,
- **nepromjenjivost** (immutable): ne patchuje se kontejner u radu, nego se gradi nova slika,
- tajne kroz secrets mehanizam, ne u image-u ili varijablama u Dockerfileu,
- runtime detekcija (npr. Falco) za neočekivane procese i syscall-ove.

**Docker** je platforma i format koji je popularizovao kontejnere; image formati su danas standardizovani kroz **OCI** (Open Container Initiative).

### Kubernetes i orkestracija

**Orkestracija** automatizuje deploy, skaliranje, oporavak i mrežu kontejnera. **Kubernetes** je de facto standard. Sigurnosne teme:

| Područje | Kontrola |
|---|---|
| Control plane | zaštićen API server, etcd šifrovan i nedostupan izvana, audit logovanje |
| Autentifikacija i autorizacija | RBAC sa least privilege, bez cluster-admin za aplikacije, OIDC integracija za korisnike |
| Workload sigurnost | Pod Security Standards (restricted), securityContext, admission kontrole (npr. OPA Gatekeeper, Kyverno) |
| Mreža | NetworkPolicy (default deny), service mesh sa mTLS |
| Tajne | Kubernetes Secrets sa enkripcijom u etcd-u ili eksterni secrets manager |
| Supply chain | samo potpisani image-i iz odobrenih registryja (admission policy) |
| Multitenancy | namespaces su logička, ne tvrda granica; za stroge zahtjeve odvojeni klasteri |

U managed Kubernetes servisima (EKS, AKS, GKE) CSP upravlja control planeom, a kupac odgovara za workloade, RBAC, mrežne politike i konfiguraciju nodova (shared responsibility).

> **Na ispitu:** kontejner nije sigurnosna granica jednaka VM-u. Ako scenarij traži izvršavanje **nepovjerljivog koda različitih kupaca** na istom hostu, NAJBOLJI odgovor je jača izolacija (mikro-VM, sandbox runtime ili odvojeni hostovi), a ne samo odvojeni namespace.

## Dizajn IAM rješenja (4.7)

### Osnovni pojmovi

- **Identifikacija**: tvrdnja ko si (korisničko ime).
- **Autentifikacija**: dokaz tvrdnje (lozinka, ključ, biometrija).
- **Autorizacija**: šta smiješ raditi.
- **Accountability**: praćenje akcija do identiteta (logovi).
- **Identity lifecycle**: provisioning, promjene uloga, periodične revizije pristupa (access review / recertification), deprovisioning. Najčešći propust je zaboravljen deprovisioning naloga bivših zaposlenih, pogotovo u SaaS aplikacijama van centralnog IdP-a.

Za automatsko kreiranje i ukidanje naloga u SaaS aplikacijama koristi se **SCIM** (System for Cross-domain Identity Management).

### Identity Providers (IdP)

**Identity Provider (IdP)** je sistem koji autentifikuje korisnika i izdaje tvrdnje (assertions, tokene) o njegovom identitetu i atributima. **Service Provider (SP)**, u OIDC terminologiji **Relying Party (RP)**, je aplikacija koja te tvrdnje prihvata i na osnovu njih daje pristup.

Primjeri IdP-ova: Microsoft Entra ID, Okta, Ping Identity, Google Workspace, AWS IAM Identity Center (kao IdP ili posrednik), Keycloak, AD FS. Prednosti centralnog IdP-a: jedno mjesto za politike lozinki i MFA, jedno mjesto za ukidanje pristupa, centralni audit.

### Federated identity

**Federacija** je odnos povjerenja između organizacija (ili domena) u kojem jedna strana prihvata identitete koje je autentifikovala druga. Korisnik koristi svoj matični nalog za pristup resursima partnera ili CSP-a.

| Protokol | Format | Glavna namjena | Napomena |
|---|---|---|---|
| **SAML 2.0** | XML assertions, potpisani | enterprise web SSO i federacija | zreo, čest za SaaS; IdP-initiated i SP-initiated tokovi |
| **OAuth 2.0** | access tokeni (često JWT) | **autorizacija**: delegirani pristup API-ju | nije protokol za autentifikaciju |
| **OpenID Connect (OIDC)** | ID token (JWT) preko OAuth 2.0 | **autentifikacija** za web, mobilne i SPA aplikacije | moderan standard, workload federacija (npr. CI/CD prema cloudu) |
| **WS-Federation** | XML | starija Microsoft federacija | sreće se u legacy okruženjima |
| **Kerberos** | tiketi | autentifikacija unutar domena (AD) | nije namijenjen internet federaciji |

Modeli federacije:

- **Hub-and-spoke** (trusted third party): centralni IdP ili broker kojem svi vjeruju; skalira dobro.
- **Mesh / web of trust**: svaka organizacija direktno vjeruje svakoj drugoj; ne skalira (n×(n−1)/2 odnosa).

Workload federacija je bitna i za DevSecOps: CI/CD pipeline dobija kratkotrajne cloud kredencijale preko OIDC tokena umjesto da čuva dugotrajne access keyeve.

> **Na ispitu:** OAuth je za **autorizaciju** (delegirani pristup), OIDC dodaje **autentifikaciju** (ko je korisnik), SAML je XML standard za enterprise SSO i federaciju. Ako pitanje kaže da aplikacija koristi OAuth access token kao dokaz identiteta korisnika, to je greška u dizajnu; ispravno je OIDC ID token.

### Single Sign-On (SSO)

**SSO** omogućava korisniku da se autentifikuje jednom i pristupi više aplikacija bez ponovnog unosa kredencijala. Federacija je mehanizam koji omogućava SSO preko granica organizacija i između on-prem i clouda.

| Prednosti | Rizici i kontrole |
|---|---|
| manje lozinki, manje phishinga i reuse-a | IdP postaje **single point of failure** i meta visoke vrijednosti |
| centralni MFA i politike | kompromis jednog naloga otvara sve aplikacije → obavezan jak MFA |
| brzo ukidanje pristupa na jednom mjestu | dostupnost IdP-a mora biti visoka; plan za break-glass naloge |
| bolji audit | trajanje sesije i ponovna autentifikacija za osjetljive akcije (step-up) |

**Break-glass** (emergency access) nalozi su malobrojni, strogo čuvani nalozi koji ne zavise od federacije, za slučaj da je IdP nedostupan. Koriste se izuzetno rijetko i svaka upotreba se alarmira.

### Multi-Factor Authentication (MFA)

Faktori autentifikacije:

| Tip | Opis | Primjeri |
|---|---|---|
| **Something you know** | znanje | lozinka, PIN |
| **Something you have** | posjedovanje | hardverski ključ, smart card, telefon sa authenticator aplikacijom |
| **Something you are** | inherentnost (biometrija) | otisak prsta, lice |
| (dodatni kontekst) | lokacija, ponašanje, uređaj | koriste se za adaptive / risk-based autentifikaciju, ne kao samostalan faktor |

MFA znači barem dva **različita tipa** faktora. Lozinka i sigurnosno pitanje su dva faktora istog tipa, dakle nisu MFA.

Jačina MFA metoda (od slabije prema jačoj): SMS/glasovni OTP (ranjiv na SIM swap i presretanje), TOTP aplikacija, push notifikacija (ranjiva na **MFA fatigue**, ublažava se number matchingom), **phishing-resistant MFA**: FIDO2/WebAuthn sigurnosni ključevi i **passkeys**, smart card / PIV. Phishing-resistant metode vežu autentifikaciju za domen i kriptografski ključ, pa ih lažna stranica ne može iskoristiti.

U cloudu je MFA obavezan minimalno za: root/glavne naloge, administratore, pristup konzoli, privilegovane operacije i udaljeni pristup.

### Cloud Access Security Broker (CASB)

**CASB** je sigurnosna tačka između korisnika organizacije i cloud servisa koja primjenjuje politike organizacije na korištenje clouda. Gartnerova četiri stuba: **visibility** (uključujući otkrivanje **shadow IT**), **compliance**, **data security** (DLP, enkripcija, tokenizacija) i **threat protection** (anomalije, kompromitovani nalozi, malver).

| Način rada | Kako radi | Prednost | Ograničenje |
|---|---|---|---|
| **API-based** (out-of-band) | povezuje se na API SaaS aplikacije | vidi podatke u mirovanju, ne utiče na performanse, pokriva i neupravljane uređaje | nije u realnom vremenu, zavisi od API-ja dobavljača |
| **Forward proxy** (inline) | saobraćaj korisnika ide kroz proxy (agent ili PAC na uređaju) | kontrola u realnom vremenu, otkrivanje shadow IT | traži upravljanje uređajem |
| **Reverse proxy** (inline) | korisnik se preusmjerava kroz proxy kroz IdP integraciju | radi i za neupravljane uređaje | može kvariti funkcionalnost aplikacija |
| **Log analiza** (discovery) | analiza logova firewalla i proxyja | brzo otkriva korištene cloud servise | samo vidljivost, bez kontrole |

CASB je danas često dio šire **SSE** (Security Service Edge) ili **SASE** platforme, zajedno sa secure web gatewayem i ZTNA.

Napomena o terminologiji: **cloud service broker** iz ISO/IEC 17789 i NIST SP 500-292 je **uloga** (posrednik koji agregira, integriše ili prilagođava usluge), dok je CASB **sigurnosni alat**. Ispit ih može staviti kao distraktore jedno drugom.

> **Na ispitu:** „Otkriti koje neodobrene SaaS aplikacije zaposleni koriste“ = CASB (discovery / shadow IT). „Primijeniti DLP na podatke koji su već u odobrenom SaaS-u“ = API-based CASB. Kada uprava pita šta PRVO uraditi oko shadow IT-a, odgovor je otkrivanje i procjena rizika (vidljivost), a tek onda politika i blokiranje.

### Upravljanje tajnama, ključevima i certifikatima

**Tajne** (secrets) su lozinke baza, API ključevi, tokeni, connection stringovi. **Ključevi** su kriptografski materijal (simetrični, asimetrični). **Certifikati** vezuju javni ključ za identitet (X.509).

| Objekat | Gdje se čuva | Ključne prakse |
|---|---|---|
| Tajne | secrets manager / vault (npr. AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) | nikad u kodu, image-u ili repozitoriju; automatska rotacija; dinamičke kratkotrajne tajne; pristup po identitetu workloada; audit pristupa |
| Kriptografski ključevi | KMS, cloud HSM, on-prem HSM | razdvajanje dužnosti (ko upravlja ključem ≠ ko koristi podatke), rotacija, kontrola pristupa ključu, zaštita od brisanja (waiting period), backup |
| Certifikati | certificate manager, interni PKI | inventar svih certifikata, automatska obnova (ACME), praćenje isteka, kratki rokovi važenja, opoziv (CRL/OCSP) |

Opcije kontrole ključeva u cloudu (detaljnije u domenu 2):

| Model | Ko generiše i drži ključ | Kontrola kupca |
|---|---|---|
| CSP-managed keys | CSP | najmanja |
| Customer-managed keys u CSP KMS-u | CSP KMS, kupac upravlja politikama | srednja |
| **BYOK** (Bring Your Own Key) | kupac generiše i uvozi u CSP KMS | veća, ključ i dalje u CSP-u |
| **HYOK / external key store** (Hold Your Own Key) | ključ ostaje van CSP-a, u kupčevom HSM-u | najveća, ali i najveća operativna složenost i rizik dostupnosti |

Upravljanje ključevima prati životni ciklus: generisanje, distribucija, pohrana, upotreba, rotacija, arhiviranje, opoziv i uništavanje. Uništavanje ključa je osnova **crypto-shreddinga**.

Istekli certifikat je jedan od najčešćih uzroka prekida usluge. Zato je automatska obnova i inventar certifikata operativna i sigurnosna kontrola istovremeno.

> **Na ispitu:** razdvajanje dužnosti kod ključeva je česta tema. Ako isti administrator upravlja i ključevima i podacima, kompromis jednog naloga otkriva sve. NAJBOLJI dizajn odvaja ulogu key administratora od uloge koja koristi ključ za dešifrovanje, i loguje svaku upotrebu ključa.

## Modeli autorizacije i privilegovani pristup (4.7)

IAM dizajn ne završava autentifikacijom. Nakon što znaš ko je korisnik, odlučuješ šta smije raditi.

| Model | Odluka na osnovu | Prednost | Mana | Cloud primjer |
|---|---|---|---|---|
| **DAC** (Discretionary) | vlasnik resursa dodjeljuje pristup | fleksibilno | nekontrolisano širenje dozvola | dijeljenje fajla u SaaS storageu |
| **MAC** (Mandatory) | oznake klasifikacije i clearance | stroga kontrola | krut, skup za održavanje | vladini i vojni sistemi |
| **RBAC** (Role-Based) | uloga korisnika | jednostavno za revizije | eksplozija uloga u velikim organizacijama | Kubernetes RBAC, Azure RBAC |
| **ABAC** (Attribute-Based) | atributi korisnika, resursa i konteksta (tagovi, odjel, lokacija, vrijeme) | fina granularnost, skalira | složenije za razumijevanje i reviziju | AWS politike sa uslovima nad tagovima |
| **ReBAC** (Relationship-Based) | odnosi između entiteta (vlasnik, član tima) | prirodno za kolaborativne aplikacije | specijalizovani sistemi | dijeljenje dokumenata u SaaS-u |

**Zero trust** (NIST SP 800-207) je arhitektonski princip u kojem nijedan zahtjev nije unaprijed povjerljiv zbog mrežne lokacije. Svaki pristup se odlučuje dinamički na osnovu identiteta, stanja uređaja, konteksta i osjetljivosti resursa, kroz **policy decision point** (PDP) i **policy enforcement point** (PEP). U cloudu, gdje perimetar praktično ne postoji, identitet postaje novi perimetar.

**Privileged Access Management (PAM)** kontroliše najopasnije naloge:

- **just-in-time** (JIT) pristup: privilegija se dodjeljuje privremeno, na zahtjev i uz odobrenje, umjesto trajno,
- **just-enough** pristup: samo dozvole potrebne za zadatak,
- snimanje i nadzor privilegovanih sesija,
- vaultovanje i automatska rotacija privilegovanih lozinki,
- odvojeni administratorski nalozi (admin ne čita e-mail sa istog naloga),
- periodična revizija privilegovanih uloga.

> **Na ispitu:** kada scenarij opisuje mnogo trajnih administratorskih naloga, NAJBOLJI odgovor je obično just-in-time privilegovani pristup sa odobrenjem i logovanjem, a ne samo „jača lozinka“ ili „više MFA“. Smanjenje broja i trajanja privilegija smanjuje napadnu površinu, a MFA samo otežava zloupotrebu postojećih privilegija.

### Sigurnost tokena

Moderni IAM se oslanja na tokene (najčešće **JWT**, JSON Web Token). Greške u rukovanju tokenima su česte u cloud aplikacijama:

| Rizik | Kontrola |
|---|---|
| prihvatanje tokena bez provjere potpisa ili sa `alg: none` | uvijek validirati potpis i dozvoljeni algoritam na serveru |
| token za drugu aplikaciju prihvaćen kod nas | provjera `aud` (audience) i `iss` (issuer) |
| dugotrajni tokeni koji se ne mogu opozvati | kratki access tokeni, refresh tokeni uz rotaciju i opoziv |
| token u URL-u ili logu | slanje u headeru, maskiranje u logovima |
| krađa tokena iz preglednika | sigurno čuvanje (HttpOnly kolačići), PKCE za javne klijente, token binding/DPoP gdje je moguće |
| prekomjerni scope | minimalni scope po klijentu |

### Izbor IAM rješenja po scenariju

| Zahtjev | Rješenje |
|---|---|
| zaposleni pristupaju desetinama SaaS aplikacija | centralni IdP + SSO (SAML/OIDC) + SCIM |
| partner pristupa našem portalu | federacija sa partnerovim IdP-om |
| kupci (B2C) se registruju u našu aplikaciju | CIAM (customer IAM) sa OIDC, social login, MFA po riziku |
| pipeline treba pristup cloud nalogu | workload identity federacija (OIDC), kratkotrajni kredencijali |
| servis u clusteru treba pristup bazi | workload identity + dinamičke tajne iz vaulta |
| kontrola korištenja neodobrenog SaaS-a | CASB |
| administratori cloud okruženja | PAM, JIT, phishing-resistant MFA, odvojeni admin nalozi |
| regulator traži da ključ nikad ne bude kod CSP-a | HYOK / external key store |

## Scenariji

**Scenarij 1.** Kompanija ima 40 SaaS aplikacija, svaka sa vlastitim nalozima. Odlaze zaposleni, a nalozi ostaju aktivni mjesecima. NAJBOLJE rješenje: centralni IdP sa SSO-om (SAML/OIDC) i SCIM provisioningom, tako da ukidanje naloga u IdP-u ukida pristup svuda, uz periodične access reviewe.

**Scenarij 2.** Developer je commitovao lozinku baze u javni repozitorij. PRVI korak: odmah **rotirati/opozvati** tajnu (smatrati je kompromitovanom), zatim provjeriti logove pristupa, ukloniti iz historije i uvesti secrets manager i skeniranje tajni u pipelineu. Brisanje commita bez rotacije ne pomaže jer je tajna već javna.

**Scenarij 3.** Partner treba pristup internom portalu. Umjesto kreiranja lokalnih naloga za partnerove zaposlene, NAJBOLJE je federisati sa partnerovim IdP-om; partner upravlja svojim korisnicima, a ti kontrolišeš autorizaciju i uslove federacije ugovorom.

**Scenarij 4.** Zaposleni koriste neodobrene AI chat servise i u njih kopiraju povjerljive dokumente. PRVO: CASB discovery da se utvrdi obim i rizik, zatim politika prihvatljive upotrebe, odobrena alternativa i inline DLP kontrole za neodobrene servise.

## Rezime

- **4.6 komponente**: WAF (L7, OWASP obrasci, virtual patching), DAM (aktivnost baze, nadzor DBA-a, razdvajanje dužnosti), XML firewall (SOAP/XML, šema, WS-Security), API gateway (centralna autentifikacija, kvote, logovanje; north-south), load balancer (dostupnost, health checks, TLS terminacija). Sve su **dopuna**, ne zamjena za siguran kod.
- **Kriptografija**: TLS u prenosu, envelope encryption u mirovanju (DEK/KEK), confidential computing za data in use; enkripcija na nivou aplikacije kada CSP i DBA ne smiju vidjeti podatke.
- **Sandboxing**: izolovano izvršavanje nepovjerljivog koda (mikro-VM, gVisor, seccomp, odvojeni nalozi).
- **Mikroservisi i kontejneri**: veća napadna površina, servis-servis autentifikacija, minimalni i potpisani image-i, non-root, immutable; Kubernetes RBAC, Pod Security Standards, NetworkPolicy, enkripcija Secreta, admission kontrole. Kontejner nije granica jednaka VM-u.
- **4.7 IAM**: IdP izdaje tvrdnje, SP/RP ih prihvata; federacija kroz SAML (XML, enterprise), OAuth 2.0 (autorizacija), OIDC (autentifikacija); SSO uz jak MFA i break-glass naloge; SCIM za lifecycle.
- **MFA**: različiti tipovi faktora; phishing-resistant FIDO2/passkeys su najjači, SMS najslabiji.
- **CASB**: visibility, compliance, data security, threat protection; API-based vs. proxy (forward/reverse); prvo vidljivost shadow IT-a.
- **Tajne, ključevi, certifikati**: secrets manager sa rotacijom, KMS/HSM sa razdvajanjem dužnosti, BYOK vs. HYOK, inventar i automatska obnova certifikata; kompromitovanu tajnu PRVO rotiraj.
