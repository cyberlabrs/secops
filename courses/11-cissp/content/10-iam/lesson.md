## Ciljevi ispita: domen 5 (5.1–5.6)

Domen 5 je **Identity and Access Management (IAM)** i nosi **13,6%** ispita po outlineu iz 2027. (U outlineu iz 2024. 13%.) Ciljevi:

- **5.1 Manage physical and logical access to assets (e.g., provision, control, review, revoke)**
  - information, applications, systems, services, devices, identities, facilities.
- **5.2 Design identification and authentication strategy (e.g., people, devices, and services)**
  - groups and roles,
  - Authentication, Authorization, Accounting (AAA),
  - session management,
  - registration, proofing, and establishment of identity,
  - Federated Identity Management (FIM),
  - credential management systems (npr. password vault),
  - Single sign-on (SSO),
  - Just-In-Time,
  - passwordless authentication (FIDO, WebAuthn, passkeys, biometrija).
- **5.3 Federated identity with a third-party service**: on-premises, hybrid, cloud.
- **5.4 Implement and manage authorization mechanisms**
  - RBAC, ABAC, Rule-based (RuBAC), Risk-Adaptable Access Control (RAdAC), MAC, DAC,
  - access policy enforcement (policy decision point, policy enforcement point).
- **5.5 Manage the identity and access provisioning lifecycle**
  - account access review (user, system, service),
  - provisioning and deprovisioning (on/offboarding, transfers),
  - role definition and transition,
  - privilege escalation (administratorske grupe/sudo, audit upotrebe, Principle of Least Privilege),
  - service accounts management.
- **5.6 Implement authentication and authorization systems**.

> U outlineu iz 2024. cilj 5.1 glasi „Control physical and logical access to assets“ i nema pod-tačku **identities**; passwordless nije zasebna pod-tačka nego primjer uz AAA (zajedno sa MFA); u 5.4 stoji „Rule-based“ i „Risk-based access control“ (umjesto RuBAC i RAdAC); u 5.5 privilege escalation spominje samo sudo i audit, bez PoLP-a; a 5.6 je samo „Implement authentication systems“, bez autorizacije.

Iz AWS IAM-a, Kubernetes RBAC-a i Entra/Okta prakse znaš mehaniku. CISSP traži klasične pojmove (identifikacija vs autentifikacija, faktori, FRR/FAR/CER, Kerberos, modeli kontrole pristupa) i upravljački pogled: ko odobrava, ko revidira, kada se pristup ukida.

## Osnovni pojmovi i faktori autentifikacije

Lanac pristupa: **identification** (tvrdnja identiteta, npr. korisničko ime) → **authentication** (dokaz) → **authorization** (šta smije) → **accounting/auditing** (bilježenje) → **accountability** (osoba odgovara za svoje akcije, što traži jedinstvene identitete i integritet logova).

| Faktor | Tip | Primjeri |
|---|---|---|
| **Something you know** | Type 1 | lozinka, PIN, odgovor na pitanje |
| **Something you have** | Type 2 | smart kartica, hardverski ključ, TOTP aplikacija, telefon |
| **Something you are** | Type 3 | otisak, šarenica, lice, geometrija dlana |
| Somewhere you are | kontekst | lokacija, IP, geofencing |
| Something you do | kontekst | dinamika kucanja, potpis |

**MFA** zahtijeva faktore **različitih tipova**. Lozinka plus PIN su dva faktora istog tipa, dakle nije MFA.

### Biometrija i greške

| Metrika | Značenje |
|---|---|
| **FRR** (False Rejection Rate), **Type I** greška | legitiman korisnik odbijen (neugodnost) |
| **FAR** (False Acceptance Rate), **Type II** greška | neovlaštena osoba prihvaćena (sigurnosni rizik) |
| **CER / EER** (Crossover / Equal Error Rate) | tačka gdje je FRR = FAR; **niži CER = precizniji sistem** |

Primjer: sistem A ima CER 2%, sistem B 0,5%. Za poređenje preciznosti bira se B. Povećanje osjetljivosti smanjuje FAR, ali povećava FRR. Za trezor banke prihvata se veći FRR; za ulaz u kantinu manji.

Ostali biometrijski pojmovi: **enrollment** (upis, vrijeme i broj pokušaja), **throughput** (koliko brzo osoba prođe, prihvatljivo ~6–10 s), prihvatljivost korisnicima (skeniranje mrežnjače je invazivno i otkriva zdravstvene informacije), zaštita šablona (template) jer se biometrija ne može promijeniti kao lozinka.

> **Na ispitu:** pitanje „koji je biometrijski sistem NAJPRECIZNIJI“ rješava se poređenjem CER-a, ne FAR-a ni FRR-a pojedinačno. A ako pitanje traži najgoru grešku sa sigurnosnog stanovišta, to je Type II (FAR).

## Upravljanje fizičkim i logičkim pristupom imovini (5.1)

Outline iz 2027. eksplicitno navodi životni ciklus pristupa: **provision → control → review → revoke**. Primjenjuje se na sve tipove imovine:

| Imovina | Primjer kontrole pristupa | Tipičan propust |
|---|---|---|
| **Information** | klasifikacija, ACL na podacima, DLP, enkripcija sa kontrolom ključeva | dijeljeni linkovi bez isteka |
| **Applications** | SSO, uloge u aplikaciji, autorizacija na nivou objekta | lokalni nalozi mimo SSO-a |
| **Systems** | PAM, jump host, lokalni admin nalozi pod kontrolom (LAPS) | zajednički root |
| **Services** | servisni nalozi, API ključevi, workload identitet | trajni ključevi u kodu |
| **Devices** | certifikat uređaja, MDM, 802.1X | nepoznati uređaji na mreži |
| **Identities** | upravljanje samim identitetima: životni ciklus, privilegovani i ne-ljudski identiteti, zaštita IdP-a | napuštene (orphan) identitete niko ne posjeduje |
| **Facilities** | bedževi, mantrap, čuvari, CCTV, zone | bedž bivšeg zaposlenog još radi |

Fizički pristup: **mantrap / access control vestibule** (sprečava tailgating i piggybacking), proximity kartice, čuvari, logovi ulaza. Logički i fizički pristup treba biti povezan: kada HR ugasi zaposlenog, gase se i nalozi i bedž (konvergirani IAM).

Principi koji važe za sve: **need to know** (pristup informaciji samo ako je potrebna za posao), **least privilege** (minimum prava), **separation of duties**, **default deny**.

## Strategija identifikacije i autentifikacije (5.2)

### Grupe i uloge

**Grupa** je skup subjekata kojima se dodjeljuju ista prava (administrativna pogodnost). **Uloga** predstavlja poslovnu funkciju i paket prava potrebnih za nju. Uloge treba definisati iz poslovnih procesa (role engineering), ne kopiranjem prava postojećeg korisnika („daj mu isto kao Marku“), što dovodi do **privilege creep**.

### AAA

**Authentication, Authorization, Accounting**. Centralizovani AAA protokoli:

| Protokol | Transport | Enkripcija | AAA | Primjena |
|---|---|---|---|---|
| **RADIUS** | UDP 1812/1813 | samo lozinka | autentifikacija i autorizacija spojene | mrežni pristup, VPN, Wi-Fi (802.1X) |
| **TACACS+** | TCP 49 | cijeli payload | odvojeno | administracija mrežnih uređaja, autorizacija po komandi |
| **Diameter** | TCP/SCTP | TLS/IPSec | napredniji nasljednik RADIUS-a | mobilne mreže (4G/5G), roaming |

### Upravljanje sesijom

- **Session timeout** (apsolutni) i **idle timeout** (neaktivnost); kraći za privilegovane sesije.
- Sigurni tokeni sesije: slučajni, dovoljne dužine, preko TLS-a, kolačići sa `Secure`, `HttpOnly`, `SameSite`; nova sesija nakon prijave (zaštita od **session fixation**).
- **Re-autentifikacija** za osjetljive akcije (step-up).
- Ograničenje istovremenih sesija; centralno poništavanje (revocation) sesija kada se nalog ugasi ili kompromituje.
- Zaključavanje ekrana na endpointu.

### Registracija, provjera i uspostavljanje identiteta

**Identity proofing** dokazuje da je osoba ona za koju se predstavlja, prije izdavanja kredencijala. NIST SP 800-63 definiše nivoe:

| Nivo | Šta znači |
|---|---|
| **IAL** (Identity Assurance Level) 1–3 | snaga provjere identiteta pri registraciji (od samoprijave do provjere dokumenata uživo ili nadzirano na daljinu) |
| **AAL** (Authenticator Assurance Level) 1–3 | snaga autentifikacije (AAL2: MFA; AAL3: hardverski, phishing-otporan autentifikator) |
| **FAL** (Federation Assurance Level) 1–3 | snaga federacijske tvrdnje (potpis, enkripcija, vezivanje za ključ) |

Postupci: provjera ličnog dokumenta, poređenje sa fotografijom, **knowledge-based authentication** (pitanja iz kreditne istorije, sve slabije zbog curenja podataka), verifikacija preko poznatog kanala. Kod zaposlenih, HR proces zapošljavanja (background check) je osnova za izdavanje identiteta.

### Upravljanje kredencijalima

- **Password vault / password manager**: korisnicima za lične lozinke; **PAM vault** za privilegovane naloge sa check-out/check-in, automatskom rotacijom i snimanjem sesija.
- **Secrets manager** za mašinske tajne (API ključevi, DB lozinke) sa rotacijom.
- Politika lozinki po NIST SP 800-63B: dužina iznad složenosti, provjera protiv liste kompromitovanih lozinki, **bez periodične prisilne promjene** (osim pri sumnji na kompromitaciju), bez hint pitanja.
- Lozinke se čuvaju kao **salted hash** sa sporim algoritmom (bcrypt, scrypt, Argon2, PBKDF2).

### SSO i Just-In-Time

**SSO** omogućava jednu prijavu za više sistema. Prednosti: manje lozinki, centralno gašenje, bolje iskustvo. Mana: kompromitovan SSO nalog otvara sve, pa je SSO **uvijek uz jak MFA**. Klasični SSO mehanizmi: **Kerberos** (na LAN-u), **SESAME** (proširenje Kerberosa sa asimetričnom kriptografijom), federacija (SAML, OIDC) za web.

**Just-In-Time** ima dva značenja:

- **JIT pristup (privilegije)**: privilegija se dodjeljuje na zahtjev, za ograničeno vrijeme, uz odobrenje, i automatski ukida. Cilj je **zero standing privileges**.
- **JIT provisioning**: nalog u aplikaciji (SP) se kreira automatski pri prvoj federativnoj prijavi, na osnovu atributa iz SAML tvrdnje ili OIDC tokena.

### Passwordless autentifikacija

| Pojam | Opis |
|---|---|
| **FIDO2** | standard FIDO Alliance; sastoji se od **WebAuthn** (W3C, API u pregledniku) i **CTAP** (protokol između preglednika i autentifikatora) |
| **WebAuthn** | sajt (relying party) registruje javni ključ; pri prijavi autentifikator potpisuje izazov privatnim ključem; ključ je vezan za domen (origin), pa je **otporan na phishing** |
| **Passkeys** | FIDO kredencijali koji se mogu sinhronizovati između uređaja korisnika (synced) ili biti vezani za uređaj (device-bound, hardverski ključ) |
| **Biometrija** | najčešće lokalno otključava privatni ključ na uređaju; biometrijski podatak ne napušta uređaj |
| **Magic link, push** | passwordless, ali nisu phishing-otporni na nivou FIDO-a (push fatigue) |

Lozinka se ne prenosi i ne čuva na serveru, pa nema šta da procuri iz baze. Rizik se seli na oporavak naloga (account recovery), koji mora biti jednako jak kao i sama prijava.

> **Na ispitu:** kada scenario traži autentifikaciju **otpornu na phishing** za administratore ili za AAL3, odgovor je FIDO2/WebAuthn hardverski ključ, ne SMS OTP ni push notifikacija. SMS je najslabiji drugi faktor (SIM swap, presretanje).

## Kerberos

Klasičan SSO protokol (MIT, Active Directory). Koristi **simetričnu kriptografiju** i pouzdanu treću stranu, **KDC** (Key Distribution Center), koji sadrži **AS** (Authentication Service) i **TGS** (Ticket Granting Service).

1. Klijent šalje zahtjev AS-u (sa vremenskom oznakom šifrovanom ključem izvedenim iz lozinke, pre-authentication).
2. AS vraća **TGT** (Ticket Granting Ticket), šifrovan ključem KDC-a, i sesijski ključ.
3. Kada treba servis, klijent šalje TGT i authenticator TGS-u.
4. TGS vraća **service ticket** šifrovan ključem servisa.
5. Klijent predaje service ticket servisu, servis ga dešifruje svojim ključem i pušta klijenta.

| Osobina | Posljedica |
|---|---|
| lozinka se ne šalje mrežom | zaštita od prisluškivanja |
| vremenske oznake u ticketima | **sinhronizacija vremena** (NTP) je kritična, tipična tolerancija 5 min |
| KDC je centralna tačka | **single point of failure** i najvrijedniji cilj; redundantni KDC-ovi, fizička i logička zaštita |
| tiketi u memoriji klijenta | rizik krađe tiketa (pass-the-ticket); odbrana: zaštita endpointa, kratko trajanje tiketa, Credential Guard |
| ključevi servisnih naloga izvedeni iz lozinke | slabe lozinke servisnih naloga ugrožavaju tikete; duge, rotirane lozinke ili managed service accounts |

## Federacija sa trećom stranom (5.3)

**Federated Identity Management (FIM)** je povjerenje između domena: **IdP** (Identity Provider) autentifikuje korisnika, a **SP/RP** (Service Provider / Relying Party) vjeruje njegovoj tvrdnji. Korisnik ne dobija novi nalog sa lozinkom kod svake aplikacije.

| Standard | Format | Svrha | Napomena |
|---|---|---|---|
| **SAML 2.0** | XML tvrdnje (assertions), potpisane | **autentifikacija i atributi** za web SSO u preduzećima | uloge: principal, IdP, SP; SP-initiated i IdP-initiated tok |
| **OAuth 2.0** | access token (često JWT) | **delegirana autorizacija** (aplikacija pristupa resursu u ime korisnika) | **nije protokol autentifikacije**; grant tipovi: authorization code (+PKCE), client credentials, device code |
| **OIDC** (OpenID Connect) | ID token (JWT) preko OAuth 2.0 | **autentifikacija** na OAuth-u, moderne i mobilne aplikacije | UserInfo endpoint, scopes |
| **WS-Federation** | XML | starija Microsoft federacija | — |
| **SCIM** | REST/JSON | **provisioning** naloga i grupa između IdP-a i SP-a | rješava deprovisioning u SaaS-u |
| **XACML** | XML | jezik politika autorizacije (PDP/PEP) | ABAC |
| **SPML** | XML | stariji provisioning standard | zamijenjen SCIM-om |

### Modeli razmještanja

| Model | Opis | Sigurnosne brige |
|---|---|---|
| **On-premises** | IdP u vlastitom data centru (AD FS, Shibboleth), federacija prema partnerima | pun nadzor, ali ti održavaš dostupnost i zakrpe; IdP izložen prema internetu |
| **Cloud** | IDaaS (Entra ID, Okta, Ping) | povjerenje u provajdera, SLA, lokacija podataka, provajder je meta (supply chain), exit strategija |
| **Hybrid** | AD on-prem sinhronizovan sa cloud IdP-om (sync agent, pass-through ili federacija) | sinhronizacioni servis i njegovi kredencijali su privilegovani; nekonzistentnost između direktorija; kompromitovan on-prem AD se širi u cloud |

Upravljački zahtjevi kod federacije sa trećom stranom: ugovor sa definisanim odgovornostima, mapiranje atributa i uloga, proces gašenja naloga (deprovisioning kroz SCIM), logovanje na obje strane, pravo na audit, plan za ispad IdP-a (break-glass nalozi koji ne zavise od federacije).

> **Na ispitu:** ako pitanje opisuje „aplikacija treba da pristupi kalendaru korisnika bez da zna njegovu lozinku“, odgovor je OAuth (delegacija). Ako traži „SSO u web aplikaciji partnera za zaposlene, enterprise, XML“, odgovor je SAML. Ako traži „autentifikaciju korisnika u mobilnoj aplikaciji preko postojećeg naloga“, odgovor je OIDC.

## Mehanizmi autorizacije (5.4)

| Model | Ko odlučuje | Osnov odluke | Primjer | Prednost / mana |
|---|---|---|---|---|
| **DAC** (Discretionary) | **vlasnik objekta** | ACL koje postavlja vlasnik | NTFS dozvole, dijeljenje fajla u Driveu | fleksibilno; podložno trojancima i greškama vlasnika |
| **MAC** (Mandatory) | **sistem**, prema politici | **labele** (klasifikacija objekta) i **clearance** subjekta, plus need to know (kategorije/compartments) | vojni sistemi, SELinux | najjači, centralan; krut i skup |
| **RBAC** (Role-based) | administrator | uloga (poslovna funkcija) | HR uloga, Kubernetes Role | skalabilan, podržava SoD; „role explosion“ |
| **RuBAC** (Rule-based) | administrator | globalna pravila koja važe za sve subjekte | firewall ACL, „pristup samo radnim danima 8–16h“ | jednostavan; ne razlikuje korisnike |
| **ABAC** (Attribute-based) | politika | atributi subjekta, objekta, akcije i okruženja | „ljekar sa odjela X može čitati kartone pacijenata odjela X sa upravljanog uređaja“ | najfiniji, kontekstualan; složen za održavanje i reviziju |
| **RAdAC** (Risk-Adaptable) | politika u realnom vremenu | procjena **rizika** i operativne potrebe u trenutku zahtjeva | step-up MFA ili odbijanje kod neobične lokacije, riskantne prijave | dinamičan; zavisi od kvaliteta signala |

Dodatno: **content-dependent** (odluka po sadržaju, npr. view u bazi skriva kolonu plata), **context-dependent** (po kontekstu, vrijeme, lokacija, sekvenca), **non-discretionary** (centralno upravljan, često se izjednačava sa RBAC-om), **lattice-based** (gornja i donja granica, MAC).

Pazi na skraćenicu: na ispitu „RBAC“ gotovo uvijek znači role-based; rule-based se piše puno ili kao RuBAC.

### PDP i PEP

Po XACML-u i NIST SP 800-207 (Zero Trust):

| Komponenta | Uloga |
|---|---|
| **PEP** (Policy Enforcement Point) | presreće zahtjev i sprovodi odluku (gateway, proxy, aplikacija, sidecar) |
| **PDP** (Policy Decision Point) | procjenjuje politiku i donosi odluku dozvoli/odbij; u 800-207 sastoji se od **Policy Engine** i **Policy Administrator** |
| **PIP** (Policy Information Point) | izvori atributa (direktorijum, EDR stanje, threat intel) |
| **PAP** (Policy Administration Point) | mjesto gdje se politike pišu i upravljaju |

Razdvajanje odluke od sprovođenja omogućava centralnu politiku i dosljednost u mnogo PEP-ova.

> **Na ispitu:** „vlasnik podataka sam određuje ko ima pristup“ je DAC. „Sistem upoređuje oznaku osjetljivosti i clearance i korisnik to ne može promijeniti“ je MAC. „Prava zavise od radnog mjesta, a pri premještaju se mijenja samo uloga“ je RBAC. „Odluka uzima u obzir atribute korisnika, resursa i okruženja“ je ABAC. „Odluka se mijenja prema trenutnoj procjeni rizika“ je RAdAC.

## Životni ciklus identiteta i pristupa (5.5)

### Provisioning i deprovisioning

- **Onboarding**: zahtjev iz HR-a (izvor istine), odobrenje rukovodioca i vlasnika podataka, dodjela uloge, obuka i potpisivanje AUP-a prije pristupa.
- **Transfer**: dodjela nove uloge **i uklanjanje stare**. Propust ovdje je glavni izvor **privilege creep** (aggregation).
- **Offboarding**: gašenje pristupa **u trenutku** odlaska, a kod otkaza (involuntary termination) **prije ili istovremeno** sa obavještenjem zaposlenog. Vraćanje opreme i bedža, prenos vlasništva nad podacima, zadržavanje naloga onemogućenog (disable) a ne odmah obrisanog, zbog revizije i podataka.
- Automatizacija kroz IGA (Identity Governance and Administration) i SCIM smanjuje greške i orphan naloge.

### Definicija i tranzicija uloga

Uloge se definišu po poslovnim funkcijama sa vlasnikom uloge. Kada osoba preuzima novu ulogu (unapređenje, privremena zamjena, reorganizacija), treba definisati prelazni period, ukloniti prava koja nisu potrebna i provjeriti da kombinacija starih i novih prava ne krši **separation of duties** (npr. ista osoba kreira dobavljača i odobrava plaćanje).

### Revizija pristupa (access review)

| Tip naloga | Šta se provjerava |
|---|---|
| **User** | da li korisnik još treba svako pravo; recertifikacija od strane rukovodioca i vlasnika podataka |
| **System** | lokalni i administratorski nalozi na sistemima, podrazumijevani nalozi |
| **Service** | servisni nalozi, njihov vlasnik, privilegije, korišćenje, starost kredencijala |

Učestalost prema riziku: privilegovani nalozi češće (kvartalno), ostali godišnje ili pri promjeni. Reviziju radi **vlasnik podataka / rukovodilac** (on zna šta je potrebno), a ne IT koji je dodijelio prava. Neaktivni nalozi (npr. 90 dana) se onemogućavaju.

### Eskalacija privilegija

- **Principle of Least Privilege (PoLP)**: svakodnevni rad sa standardnim nalogom; administratorska prava samo kada je potrebno, kroz **odvojeni admin nalog**, `sudo` ili JIT/PAM, nikad stalnim članstvom u Domain Admins.
- **sudo** dozvoljava izvršavanje određenih komandi kao drugi korisnik, uz logovanje; konfiguracija `sudoers` treba ograničiti komande, a ne dati `ALL`.
- **Administratorske grupe** (Domain Admins, Enterprise Admins, lokalni Administrators, cloud owner uloge): minimalan broj članova, praćenje svake promjene članstva.
- **Audit upotrebe**: svaka eskalacija se bilježi i prati u SIEM-u; alarm na neočekivano dodavanje u admin grupe; snimanje privilegovanih sesija; periodična revizija logova od strane nekoga ko nije administrator (SoD).
- Neovlaštena eskalacija (vertikalna: korisnik postaje admin; horizontalna: pristup tuđim podacima istog nivoa) se sprečava zakrpama, hardeningom i autorizacijom na nivou objekta.

### Servisni nalozi

Ne-ljudski identiteti (servisni nalozi, API ključevi, workload identiteti, botovi) danas su brojniji od ljudskih. Pravila:

- svaki servisni nalog ima **ljudskog vlasnika** i dokumentovanu svrhu,
- interaktivna prijava zabranjena,
- najmanje privilegije, nikad dijeljeni između aplikacija,
- kredencijali u vaultu, automatska rotacija, ili još bolje **kratkotrajni kredencijali** (managed identities, gMSA, IAM role, workload identity federation) bez statičkih tajni,
- uključeni u reviziju pristupa i offboarding (kada aplikacija prestane da se koristi).

> **Na ispitu:** kod premještaja zaposlenog, ispravan odgovor gotovo uvijek uključuje **uklanjanje** starih prava, ne samo dodavanje novih. Kod otkaza zbog prekršaja, pristup se gasi prije ili tokom razgovora o otkazu, nikako dan kasnije.

## Sistemi autentifikacije i autorizacije (5.6)

Ovaj cilj nema pod-tačke u outlineu; obuhvata implementaciju svega gore navedenog. Tipični sistemi i šta treba znati:

| Sistem | Uloga | Ključne činjenice |
|---|---|---|
| **LDAP / direktorijum** | skladište identiteta i atributa | LDAPS (636) ili StartTLS; hijerarhija (DN, OU) |
| **Active Directory** | direktorijum + Kerberos + grupne politike | KDC na domain controllerima; zaštita tier-0 (DC, admin nalozi) |
| **Kerberos** | SSO u domenu | TGT, service ticket, NTP, KDC kao SPOF |
| **RADIUS / TACACS+ / Diameter** | centralizovan AAA | vidi tabelu u 5.2 |
| **SAML / OIDC / OAuth IdP** | federacija i web SSO | vidi 5.3 |
| **PAM** | privilegovani pristup | vault, JIT, snimanje sesija, rotacija |
| **IGA** | upravljanje životnim ciklusom i recertifikacija | povezan sa HR-om, SoD pravila |
| **Policy engine** (XACML, OPA) | centralna autorizacija | PDP/PEP model |
| **Smart kartice / PIV / CAC** | Type 2 faktor sa certifikatom | PKI zavisnost, CRL/OCSP |

Pri implementaciji važno je: redundancija IdP-a i KDC-a (dostupnost cijelog poslovanja zavisi od njih), zaštita samog IAM sistema kao tier-0 imovine, logovanje svih odluka o autentifikaciji i autorizaciji, break-glass nalozi sa strogom kontrolom i alarmom na upotrebu, i testiranje procesa oporavka naloga.

### Napadi na autentifikaciju iz ugla odbrane

| Prijetnja | Opis | Kontrola |
|---|---|---|
| Brute force / password spraying | mnogo pokušaja na jedan nalog ili jedna lozinka na mnogo naloga | lockout/throttling, MFA, praćenje neuspjelih prijava |
| Credential stuffing | ponovna upotreba procurjelih lozinki | MFA, provjera protiv liste kompromitovanih lozinki |
| Offline napad na hash (rječnik, rainbow tables) | nakon krađe baze lozinki | salt, spor hash, zaštita baze |
| Pass-the-hash / pass-the-ticket | zloupotreba ukradenog hasha ili tiketa | zaštita endpointa, tiering, Credential Guard, kratki tiketi |
| MFA fatigue | ponavljani push zahtjevi | number matching, FIDO2 |
| Session hijacking | krađa tokena sesije | TLS, sigurni kolačići, vezivanje sesije, kratak životni vijek |

## Administracija kontrole pristupa i dodatni pojmovi

### Centralizovana, decentralizovana i hibridna administracija

| Model | Opis | Prednost | Mana |
|---|---|---|---|
| **Centralizovana** | jedan tim/sistem upravlja svim pravima (IdP, IGA) | dosljednost, lakši audit, brzo gašenje | usko grlo, SPOF |
| **Decentralizovana** | vlasnici sistema i lokalni administratori upravljaju svojim pravima | brzina, blizina poslu | nedosljednost, zaboravljeni nalozi, teška revizija |
| **Hibridna** | centralni identitet i politike, lokalno upravljanje ulogama u aplikaciji | ravnoteža | jasno definisane odgovornosti su obavezne |

### Uloge i odgovornosti u IAM-u

| Uloga | Odgovornost |
|---|---|
| **Data owner** | određuje ko smije pristupiti podacima, odobrava pristup, učestvuje u reviziji |
| **Data custodian** | tehnički sprovodi odluke vlasnika (dodjela prava, backup) |
| **Rukovodilac korisnika** | potvrđuje poslovnu potrebu, recertifikuje svoje ljude |
| **Security / IAM tim** | politike, alati, nadzor, metrike |
| **Revizor** | nezavisno provjerava da proces radi |

### Poređenje SSO i federacijskih mehanizama

| Kriterij | Kerberos | SAML 2.0 | OIDC |
|---|---|---|---|
| Okruženje | interna mreža, domen | web, između organizacija | web, mobilne i SPA aplikacije, API |
| Kriptografija | simetrična (KDC) | XML potpis (asimetrična) | JWT potpis (asimetrična ili HMAC) |
| Token | TGT i service ticket | assertion | ID token (+ access token) |
| Pouzdana treća strana | KDC | IdP | OpenID Provider |
| Tipičan rizik | krađa tiketa, KDC SPOF | pogrešna validacija potpisa, dug život tvrdnje | pogrešna validacija tokena (audience, issuer), curenje tokena |

### Matrica razdvajanja dužnosti (SoD)

Primjer konfliktnih kombinacija koje IGA alat mora blokirati ili zahtijevati izuzetak sa kompenzacionom kontrolom:

| Funkcija A | Funkcija B | Zašto je konflikt |
|---|---|---|
| kreiranje dobavljača | odobravanje plaćanja | fiktivni dobavljač i isplata |
| razvoj koda | deploy u produkciju bez reviewa | neovlaštene izmjene |
| administracija sistema | revizija logova tog sistema | brisanje tragova |
| dodjela prava | odobravanje sopstvenog zahtjeva | samododjela privilegija |

Kada mala organizacija ne može razdvojiti dužnosti, kompenzacione kontrole su **job rotation**, **mandatory vacation**, nezavisna revizija logova i dvostruka kontrola (**two-person rule**) za najkritičnije akcije.

> **Na ispitu:** ko odobrava pristup podacima? **Vlasnik podataka** (data owner), ne administrator sistema i ne security tim. Administrator (custodian) samo sprovodi odluku. Pitanja često nude „IT administrator“ kao primamljiv, ali pogrešan odgovor.

## Scenariji

**Scenario 1.** Banka uvodi SaaS CRM i želi da zaposleni koriste postojeće korporativne naloge, a da se nalog u CRM-u ugasi isti dan kada zaposleni ode. Rješenje: federacija SAML ili OIDC sa korporativnim IdP-om, MFA na IdP-u, **SCIM** za provisioning i deprovisioning, mapiranje grupa u uloge CRM-a, ugovor sa obavezom brisanja podataka i logovanja.

**Scenario 2.** Interna revizija nalazi da 40% korisnika ERP sistema ima prava koja ne odgovaraju poslu, većinom nakon internih premještaja. Uzrok je proces (transfer bez uklanjanja prava), ne tehnologija. PRVI korak: ispraviti proces tranzicije uloga i uvesti periodičnu recertifikaciju od strane rukovodilaca; zatim jednokratno očistiti prekomjerna prava.

**Scenario 3.** DevOps tim drži dugotrajni ključ servisnog naloga sa admin pravima u CI varijablama. Preporuka: workload identity federation (kratkotrajni tokeni bez statičke tajne), najmanje privilegije po pipelineu, vlasnik naloga, uključivanje u reviziju.

## Rezime

- Identifikacija → autentifikacija → autorizacija → accounting → accountability. MFA = različiti tipovi faktora.
- FRR (Type I), FAR (Type II, opasnija), CER/EER: niži = precizniji biometrijski sistem.
- 5.1: provision, control, review, revoke za informacije, aplikacije, sisteme, servise, uređaje, identitete i objekte; fizički i logički pristup povezani.
- 5.2: grupe i uloge, AAA (RADIUS, TACACS+, Diameter), sesije (timeout, re-autentifikacija), proofing (IAL/AAL/FAL), vaultovi, SSO uz MFA, JIT pristup i JIT provisioning, FIDO2/WebAuthn/passkeys otporni na phishing.
- Kerberos: KDC (AS + TGS), TGT, service ticket, simetrična kriptografija, NTP, KDC je SPOF.
- 5.3: SAML (autentifikacija, XML), OAuth (delegirana autorizacija), OIDC (autentifikacija na OAuth-u), SCIM (provisioning); on-prem, cloud, hybrid modeli i njihovi rizici.
- 5.4: DAC (vlasnik), MAC (labele, sistem), RBAC (uloga), RuBAC (globalna pravila), ABAC (atributi), RAdAC (rizik u realnom vremenu); PEP sprovodi, PDP odlučuje, PIP daje atribute, PAP upravlja politikama.
- 5.5: onboarding, transfer (ukloni staro), offboarding (odmah); access review od strane vlasnika; PoLP, odvojeni admin nalozi, sudo, audit eskalacije; servisni nalozi sa vlasnikom i kratkotrajnim kredencijalima.
- 5.6: direktorijum, Kerberos, AAA, IdP, PAM, IGA, policy engine; IAM sistemi su tier-0 imovina sa redundancijom i break-glass procedurom.
