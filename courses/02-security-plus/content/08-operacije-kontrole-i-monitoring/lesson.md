## Ciljevi ispita: 4.1, 4.2, 4.3 i 4.4

Ovaj modul pokriva veći dio domena 4 (**Security Operations**, 27% ispita, najveći domen):

- **4.1** primijeniti mitigacione kontrole i tehnike u datom scenariju (segmentacija, deception, IDS/IPS, firewall, NAC, EDR, email sigurnost, SELinux…),
- **4.2** objasniti sigurnosne posljedice upravljanja hardverom, softverom i podacima kao imovinom,
- **4.3** obaviti zadatke upravljanja ranjivostima (identifikacija, prioritizacija, remedijacija, verifikacija, izvještavanje),
- **4.4** objasniti koncepte i alate za alerting i monitoring (SIEM, NetFlow, SNMP, syslog, SCAP, dashboardi).

Ispit ovdje voli scenarije tipa: „Šta je NAJBOLJA kontrola za ovaj problem?“ Ključ je prepoznati **na kom sloju** je problem (mreža, host, aplikacija, email, identitet) i izabrati alat koji radi baš na tom sloju.

## 4.1 Mitigacione kontrole i tehnike

### Segmentacija, kontrola pristupa, hardening, sandboxing

| Pojam | Šta je | DevOps/cloud primjer |
|---|---|---|
| **Segmentation** (segmentacija) | Dijeljenje mreže na zone tako da kompromitovan dio ne vidi ostatak. Ograničava **lateralno kretanje**. | VPC sa odvojenim subnetima, Security Groups, Kubernetes `NetworkPolicy`, posebna VLAN za IoT. |
| **Access controls** (kontrole pristupa) | Ko smije šta: ACL-ovi, dozvole, IAM politike. | AWS IAM policy, Azure RBAC, ACL na S3 bucketu. |
| **Hardening** (ojačavanje) | Smanjenje površine napada: ugasi nepotrebne servise, zatvori portove, promijeni podrazumijevane lozinke, primijeni zakrpe i benchmark. | CIS Benchmark za Ubuntu, distroless kontejner image, `readOnlyRootFilesystem`. |
| **Sandboxing** | Izvršavanje nepouzdanog koda u izolovanom okruženju bez pristupa ostatku sistema. | Detonacija sumnjivog priloga u sandboxu email gateway-a, gVisor/Firecracker, browser sandbox. |

> **Na ispitu:** „Spriječiti da se kompromitovan IoT uređaj koristi za napad na servere“ = **segmentation**. „Analizirati sumnjiv prilog bez rizika za produkciju“ = **sandboxing**. „Ukloniti nepotrebne servise i podrazumijevane naloge“ = **hardening**.

### Deception and disruption technology (tehnologije obmane)

Cilj: navesti napadača da troši vrijeme na lažne resurse i pritom nas **alarmirati**. Legitimni korisnici te resurse nikad ne diraju, pa je **svaki** pristup sumnjiv (gotovo nula lažnih uzbuna).

| Pojam | Šta je | Primjer |
|---|---|---|
| **Honeypot** | Jedan lažni sistem koji izgleda ranjivo. | Lažni SSH server na portu 22 koji bilježi pokušaje prijave. |
| **Honeynet** | Mreža više honeypotova, realističnije okruženje. | Lažni subnet sa „web“, „DB“ i „file“ serverima. |
| **Honeyfile** | Lažni fajl primamljivog imena; otvaranje izaziva alarm. | `lozinke_2026.xlsx` na file shareu sa audit pravilom. |
| **Honeytoken** | Lažni podatak/kredencijal koji ne služi ničemu osim detekciji. | Lažni AWS access key u repozitoriju; CloudTrail alarm na bilo kakvu upotrebu. Lažni zapis u bazi kupaca. |
| **Canary account** | Lažni korisnički nalog (često „privilegovanog“ imena) koji niko ne koristi. | Nalog `svc-backup-admin` u AD-u; svaki pokušaj prijave je alarm. |

> **Na ispitu:** honeyfile je **fajl**, honeytoken je **podatak ili kredencijal** (ključ, token, zapis), canary account je **nalog**. Ako pitanje kaže „lažni API ključ ubačen u kod da otkrije curenje“, odgovor je **honeytoken**.

### Monitoring/alerting, MDM, application control

- **Monitoring/alerting**: kontinuirano praćenje i automatske uzbune (detaljno u 4.4).
- **MDM** (Mobile Device Management): centralno upravljanje mobilnim uređajima: forsiranje PIN-a i enkripcije, udaljeno brisanje (*remote wipe*), kontejnerizacija službenih podataka, instalacija/zabrana aplikacija. Primjeri: Microsoft Intune, Jamf.
- **Application control** (kontrola aplikacija):
  - **Allow list** (lista dozvoljenih): pokreće se **samo** ono što je na listi. Najjača zaštita, ali zahtijeva održavanje. Primjeri: AppLocker, Windows Defender Application Control (WDAC).
  - **Block list** (lista zabranjenih): sve je dozvoljeno osim navedenog. Lakše za održavanje, ali novi malver nije na listi.

> **Na ispitu:** za kiosk, POS terminal ili industrijski sistem (fiksna namjena) najbolji izbor je **allow list**. „Zero-day malver se ipak pokrenuo“ je tipična slabost **block liste**.

### Intrusion detection/prevention systems

| Sistem | Gdje radi | Šta radi |
|---|---|---|
| **NIDS** | Na mreži, pasivno (preko SPAN porta ili TAP-a). | Detektuje i alarmira, ne blokira. |
| **NIPS** | Na mreži, **inline** (saobraćaj prolazi kroz njega). | Detektuje i **blokira** u realnom vremenu. |
| **HIDS** | Agent na hostu. | Prati logove, integritet fajlova, procese; alarmira. |
| **HIPS** | Agent na hostu. | Uz to i blokira zlonamjerne akcije na hostu. |
| **WIPS** | Bežična mreža (senzori). | Otkriva i suzbija rogue AP-ove, evil twin, deauth napade. |

Metode detekcije: **signature-based** (poznati potpisi, brzo, ne hvata zero-day) i **anomaly/behavior-based** (odstupanje od baseline-a, hvata nepoznato, više lažnih uzbuna).

> **Na ispitu:** IDS = detekcija (pasivno), IPS = prevencija (inline). Ako uređaj „mora biti inline“ ili „mora zaustaviti napad“, to je IPS. Ako pitanje kaže da je kvar IPS-a prekinuo saobraćaj, to je cijena inline postavke (fail-closed). Mrežni senzor ne vidi sadržaj **šifrovanog** saobraćaja; tu pomaže HIDS/EDR na samom hostu.

### Firewalls

| Pojam | Opis |
|---|---|
| **Rule-based** | Pravila (ACL) po izvoru, odredištu, portu, protokolu; obrađuju se odozgo nadolje, prvo poklapanje pobjeđuje, na kraju **implicit deny**. |
| **Layer 4** | Odlučuje po IP adresama, portovima i stanju konekcije (stateful). Brz, ali ne razumije aplikaciju. |
| **Layer 7** (NGFW, application-aware) | Razumije aplikacioni protokol: razlikuje npr. Facebook chat od Facebook igrica na istom portu 443, radi sa identitetom korisnika. |
| **WAF** (Web application firewall) | Štiti **web aplikacije** na L7: SQL injection, XSS, path traversal (npr. OWASP Core Rule Set). AWS WAF, Azure Front Door WAF, ModSecurity. |
| **Rate-limiting requests** | Ograničenje broja zahtjeva po izvoru u vremenu; ublažava brute-force, scraping, aplikacione DoS napade. Npr. `limit_req` u nginxu, API Gateway throttling. |
| **UTM** (Unified threat management) | Jedan uređaj sa više funkcija: firewall, IPS, antivirus, content filter, VPN. Jednostavno za male firme, ali **single point of failure** i usko grlo. |

```text
# primjer rule-based pravila (prvo poklapanje pobjeđuje)
1  ALLOW  TCP  any          -> 10.0.1.10  443
2  ALLOW  TCP  10.0.9.0/24  -> 10.0.1.10  22
3  DENY   ANY  any          -> any        any    # implicit deny, eksplicitno zapisan
```

> **Na ispitu:** „Zaštititi web aplikaciju od SQL injection-a bez izmjene koda“ = **WAF**. „Mala firma želi jedan uređaj za sve“ = **UTM**. „Pravilo ne radi iako je dodano“ često znači da je ispod šireg DENY pravila (redoslijed).

### Content filter

- **DLP** (Data loss prevention): prepoznaje osjetljive podatke (brojevi kartica, JMBG, oznake klasifikacije) i blokira/šifruje/alarmira kada izlaze iz organizacije. Radi na endpointu, mreži, emailu i u cloudu (npr. Microsoft Purview DLP).
- **Agent-based** filtriranje: agent na uređaju filtrira web saobraćaj bez obzira gdje je uređaj (kuća, hotel). Dobro za udaljene radnike.
- **Centralized proxy**: sav web saobraćaj ide kroz centralni proxy koji filtrira URL kategorije i skenira sadržaj. Pokriva samo saobraćaj koji stvarno prolazi kroz proxy (tj. kroz korporativnu mrežu ili VPN).

> **Na ispitu:** „Laptopi rade od kuće bez VPN-a, a filtriranje mora važiti svuda“ = **agent-based** filter. „Zaposleni šalje fajl sa brojevima kartica na lični email“ = **DLP**.

### Endpoint security

| Alat | Opis |
|---|---|
| **Antivirus** | Klasična detekcija malvera, prvenstveno po potpisima. |
| **EDR** (Endpoint detection and response) | Agent bilježi telemetriju sa endpointa (procesi, mreža, registry), detektuje ponašanje, omogućava **odgovor**: izolacija hosta, gašenje procesa, forenzika. Npr. Microsoft Defender for Endpoint, CrowdStrike Falcon. |
| **XDR** (Extended detection and response) | Proširuje EDR: korelira podatke sa endpointa, mreže, emaila, identiteta i clouda u jednoj platformi. |

> **Na ispitu:** „Treba izolovati zaraženi laptop sa mreže na daljinu i vidjeti stablo procesa“ = **EDR**. „Korelacija endpoint + email + identitet u jednom alatu“ = **XDR**.

### Network access control (NAC)

NAC odlučuje da li uređaj smije na mrežu i u koju zonu.

- **802.1X**: port-based autentikacija. Tri uloge: **supplicant** (klijent), **authenticator** (switch ili AP), **authentication server** (obično **RADIUS**). Koristi EAP (npr. EAP-TLS sa certifikatima). Dok autentikacija ne uspije, port propušta samo EAP saobraćaj.
- **Endpoint posture/compliance**: provjera stanja uređaja prije pristupa (ažuran OS, uključen EDR, enkripcija diska). Neusklađen uređaj ide u **karantinsku/remedijacionu VLAN**. Agent može biti trajan (*persistent*) ili privremen (*dissolvable*), a postoji i agentless provjera.
- **Captive portal**: web stranica koja se pojavi prije pristupa mreži (prihvatanje uslova, prijava gosta). Tipično za goste i hotelski Wi-Fi.

> **Na ispitu:** „Switch port mora zahtijevati autentikaciju prije pristupa mreži“ = **802.1X**. „Laptop bez zakrpa ide u karantin“ = **posture assessment**. „Gosti prihvataju pravila korištenja“ = **captive portal**.

### Repositories: secrets scanning

**Secrets scanning** traži lozinke, API ključeve, tokene i privatne ključeve u kodu i istoriji commitova. Alati: GitHub secret scanning i push protection, GitLab secret detection, gitleaks, trufflehog. Najbolje je skenirati **prije** pusha (pre-commit hook, push protection) jer jednom pushovana tajna ostaje u istoriji.

```bash
gitleaks detect --source . --redact      # skeniraj repozitorij uključujući istoriju
```

Ako je tajna procurila: **prvo je opozovi/rotiraj**, pa tek onda čisti istoriju. Brisanje commita ne pomaže ako je ključ već kopiran.

### Application security

- **Input validation** (validacija ulaza): server provjerava tip, dužinu, format i opseg svakog ulaza; preferira se allow-list (šta je dozvoljeno). Glavna odbrana od injection napada (uz parametrizovane upite). Validacija samo na klijentu (JavaScript) se lako zaobilazi.
- **Secure cookies**: atributi `Secure` (samo preko HTTPS), `HttpOnly` (JavaScript ne može čitati, štiti session cookie od XSS krađe), `SameSite` (ograničava slanje u cross-site zahtjevima, pomaže protiv CSRF).

```http
Set-Cookie: session=af3c...; Secure; HttpOnly; SameSite=Strict; Path=/
```

- **Static code analysis** (SAST): analiza izvornog koda **bez izvršavanja**, u CI pipelineu (npr. Semgrep, SonarQube, CodeQL). Suprotnost je dinamička analiza (DAST) koja testira aplikaciju dok radi.
- **Code signing**: potpisivanje koda privatnim ključem izdavača; korisnik/sistem provjerava **integritet** i **porijeklo** (da kod nije izmijenjen i da dolazi od navedenog izdavača). U kontejnerskom svijetu: potpisivanje image-a (npr. Sigstore cosign) i provjera pri deployu.

> **Na ispitu:** code signing dokazuje **ko** je objavio kod i da **nije mijenjan**, ali NE dokazuje da je kod siguran ili bez bagova.

### Email security: SPF, DKIM, DMARC, BIMI

Sva četiri se objavljuju kao **DNS TXT zapisi** domena pošiljaoca, a provjerava ih **server primaoca**.

| Mehanizam | Šta provjerava | Gdje je zapis |
|---|---|---|
| **SPF** (Sender Policy Framework) | Da li je **IP adresa** servera koji šalje ovlaštena za domen (iz envelope-from/Return-Path). | `example.com` TXT |
| **DKIM** (DomainKeys Identified Mail) | **Digitalni potpis** zaglavlja i tijela poruke; dokazuje integritet i da je potpisao domen. Javni ključ je u DNS-u. | `selektor._domainkey.example.com` TXT |
| **DMARC** | **Politika**: šta raditi ako SPF/DKIM ne prođu ili nisu **usklađeni** (alignment) sa vidljivom From adresom, i kome slati **izvještaje**. | `_dmarc.example.com` TXT |
| **BIMI** (Brand Indicators for Message Identification) | Prikaz **logotipa** brenda pored poruke u podržanim email klijentima. Zahtijeva DMARC u režimu provođenja (quarantine ili reject). | `default._bimi.example.com` TXT |

Primjeri zapisa:

```text
; SPF: dozvoljeni su Microsoft 365 i jedan IP; sve ostalo hard fail
example.com.                     TXT "v=spf1 include:spf.protection.outlook.com ip4:203.0.113.10 -all"

; DKIM: javni ključ za selektor "s1" (potpis u poruci nosi d=example.com; s=s1)
s1._domainkey.example.com.       TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."

; DMARC: odbij poruke koje padnu, agregatne izvještaje šalji na adresu
_dmarc.example.com.              TXT "v=DMARC1; p=reject; rua=mailto:dmarc-izvjestaji@example.com; adkim=s; aspf=s"

; BIMI: logo u SVG formatu i (opciono) certifikat koji potvrđuje pravo na znak
default._bimi.example.com.       TXT "v=BIMI1; l=https://example.com/brand/logo.svg; a=https://example.com/brand/vmc.pem"
```

Detalji koje treba znati:

- SPF kvalifikatori: `-all` = hard fail (odbij), `~all` = soft fail (označi), `?all` = neutral. SPF ima ograničenje od **10 DNS lookupova**; previše `include:` lomi provjeru.
- SPF puca kod prosljeđivanja (forwarding) jer se IP mijenja; DKIM obično preživi prosljeđivanje jer potpis putuje sa porukom.
- DMARC politike: `p=none` (samo prati i šalji izvještaje), `p=quarantine` (u spam), `p=reject` (odbij). Preporučen put uvođenja: none → quarantine → reject, uz praćenje `rua` izvještaja.
- DMARC prolazi ako **bar jedan** od SPF ili DKIM prođe **i** usklađen je sa domenom u From zaglavlju.

> **Na ispitu:** „Potvrditi da poruka nije izmijenjena u prenosu“ = **DKIM**. „Navesti koji serveri smiju slati poštu za domen“ = **SPF**. „Reći primaocima da odbiju lažne poruke i slati izvještaje“ = **DMARC**. „Prikazati logo kompanije u inboxu“ = **BIMI**.

### Operating systems security

- **Group Policy** (Windows/Active Directory): centralno nametanje postavki preko GPO-ova: politika lozinki, zaključavanje naloga, AppLocker, firewall, USB zabrane. Redoslijed primjene: **Local → Site → Domain → OU** (kasnije nadjačava ranije). Komande: `gpupdate /force` (primijeni odmah), `gpresult /r` (šta je stvarno primijenjeno).
- **SELinux** (Security-Enhanced Linux): implementacija **MAC** (mandatory access control) u Linux kernelu. Svaki proces i fajl ima **kontekst** (labelu); politika određuje šta tip procesa smije raditi sa tipom fajla, čak i ako je proces root.

```bash
getenforce                 # Enforcing | Permissive | Disabled
setenforce 0               # privremeno u Permissive (samo loguje, ne blokira)
ls -Z /var/www/html        # prikaži SELinux kontekst fajlova
ausearch -m avc -ts recent # pregled odbijenih (AVC) pristupa
```

Režimi: **Enforcing** (provodi i loguje), **Permissive** (samo loguje, korisno za dijagnostiku), **Disabled**. Ekvivalent na Debian/Ubuntu je AppArmor.

> **Na ispitu:** „Ograničiti šta kompromitovani web server proces smije raditi čak i ako radi kao root“ = **SELinux** (MAC). „Nametnuti postavke na hiljadu Windows računara u domenu“ = **Group Policy**.

## 4.2 Upravljanje imovinom (asset management)

Ne možeš zaštititi ono za šta ne znaš da postoji. Inventar je temelj za upravljanje ranjivostima, incident response i licenciranje. Važi za **hardver**, **softver** i **podatke**.

| Faza životnog ciklusa | Šta se radi | Sigurnosna posljedica |
|---|---|---|
| **Planning/scoping** | Šta nam treba, za koju namjenu, koji zahtjevi (sigurnosni, regulatorni). | Sigurnosni zahtjevi ulaze od početka, ne naknadno. |
| **Acquisition/procurement process** | Nabavka od provjerenih dobavljača, ugovori, licence. | Rizik lanca snabdijevanja (krivotvoren hardver, softver sa backdoorom); provjera dobavljača. |
| **Assignment/accounting** | Upis u inventar (CMDB), dodjela **vlasnika** (*owner*), klasifikacija. | Jasno ko je odgovoran za zakrpe i pristup; klasifikacija određuje kontrole. |
| **Monitoring/asset tracking** | Praćenje lokacije, stanja, verzija, licenci; otkrivanje neovlaštene imovine (*shadow IT*). | Neevidentirani server ne dobija zakrpe i nije pod monitoringom. |
| **Disposal/decommissioning** | Bezbjedno povlačenje: brisanje/uništavanje medija, ukidanje pristupa, ažuriranje inventara. | Curenje podataka sa bačenih diskova; zaboravljeni DNS zapisi i cloud resursi (subdomain takeover). |

Načini brisanja kod disposal faze: **sanitization** (npr. kriptografsko brisanje ili prepisivanje), **destruction** (fizičko uništavanje: drobljenje, spaljivanje, degaussing za magnetne medije), uz **certificate of destruction** od dobavljača usluge.

DevOps primjeri: tagovanje cloud resursa (`Owner`, `Environment`, `DataClassification`), AWS Config / Azure Resource Graph za inventar, SBOM kao inventar softverskih komponenti.

> **Na ispitu:** „Ko je odgovoran za ovaj server?“ je pitanje **assignment/accounting** (vlasništvo). „Stari diskovi su prodati sa podacima“ je propust u **disposal/decommissioning**. „Pronađen nepoznat uređaj na mreži“ = **asset tracking**.

## 4.3 Upravljanje ranjivostima (vulnerability management)

Ciklus: **Identification → Prioritization (analiza) → Remediation → Verification → Reporting**, i ponovo ispočetka.

### Identification methods (identifikacija)

- **Scanning**: vulnerability skeneri (Nessus, OpenVAS/Greenbone, Qualys, kontejner skeneri poput Trivy).
  - **Credentialed** (sa kredencijalima): vidi instalirane pakete i konfiguraciju iznutra, tačnije, manje lažnih pozitiva.
  - **Non-credentialed**: vidi ono što vidi napadač spolja.
  - **Agent** vs **agentless**, **internal** vs **external** skeniranje.
- **IPAM** (IP Address Management): evidencija adresnog prostora, DHCP i DNS. Pomaže otkriti uređaje koji nisu u inventaru i odrediti šta treba skenirati (ne možeš skenirati subnet za koji ne znaš).
- **CSPM** (Cloud security posture management): kontinuirano provjerava cloud konfiguraciju naspram najboljih praksi i standarda: javni S3 bucket, security group otvorena prema `0.0.0.0/0`, nešifrovan disk, root nalog bez MFA. Primjeri: Microsoft Defender for Cloud, AWS Security Hub, Wiz, Prisma Cloud.
- **Source code review**: ručni pregled koda ili automatizovan (SAST) radi pronalaženja ranjivosti prije produkcije.

### Prioritization (prioritizacija)

- **Severity assessment**: procjena ozbiljnosti, najčešće **CVSS** (Common Vulnerability Scoring System) ocjena 0–10: Low 0.1–3.9, Medium 4.0–6.9, High 7.0–8.9, Critical 9.0–10.0. CVSS je samo početak: uzmi u obzir **izloženost** (internet-facing?), **kritičnost imovine**, postojanje **aktivne eksploatacije** (npr. CISA KEV katalog) i vjerovatnoću eksploatacije (EPSS), te postojeće kompenzacione kontrole.
- **Penetration test report review**: pregled nalaza pentesta. Pentest pokazuje šta je **stvarno iskoristivo** i lance napada (više srednjih ranjivosti ulančano u kritičan put), pa je dobar ulaz za prioritizaciju.

Pojmovi: **false positive** (skener prijavi ranjivost koje nema), **false negative** (ranjivost postoji, a skener je ne prijavi; opasnije jer daje lažan osjećaj sigurnosti).

### Remediation, Verification, Reporting

- **Remediation**: patching, promjena konfiguracije, nadogradnja; ako zakrpa ne postoji ili se ne može primijeniti: **compensating controls** (npr. WAF pravilo, segmentacija), **exception/exemption** uz formalno prihvatanje rizika; kod cyber osiguranja rizik se dijelom prenosi.
- **Verification**: **rescan** ili ponovni test da se potvrdi da je ranjivost stvarno uklonjena; audit; provjera da zakrpa nije pokvarila funkcionalnost.
- **Reporting**:
  - **Internal**: izvještaji za menadžment i timove (trendovi, broj otvorenih kritičnih, vrijeme do remedijacije).
  - **External**: kako spoljni svijet prijavljuje ranjivosti **nama**:
    - **Bounty program** (bug bounty): nagrada istraživačima za prijavljene ranjivosti, s jasnim pravilima i opsegom (npr. preko HackerOne ili Bugcrowd).
    - **Responsible disclosure policies** (politika odgovornog otkrivanja): kako prijaviti (npr. `security.txt`), šta je dozvoljeno, rok prije javnog objavljivanja, obećanje da se istraživač neće tužiti ako poštuje pravila.

```text
# https://example.com/.well-known/security.txt  (RFC 9116)
Contact: mailto:security@example.com
Expires: 2027-10-01T00:00:00Z
Policy: https://example.com/security/disclosure
```

> **Na ispitu:** nakon primjene zakrpe sljedeći korak je **verification** (rescan), ne izvještaj. Kad dva nalaza imaju isti CVSS, prioritet ima onaj na sistemu izloženom internetu ili onaj koji se aktivno eksploatiše.

## 4.4 Alerting i monitoring

### Šta pratimo

- **Systems**: CPU, memorija, disk, procesi, prijave, servisi na serverima i radnim stanicama.
- **Application**: aplikacioni logovi, greške, neuspjele prijave, neobični obrasci zahtjeva.
- **Infrastructure**: mrežni uređaji, hipervizori, cloud control plane (CloudTrail, Azure Activity Log), Kubernetes audit log.

### Aktivnosti

| Aktivnost | Opis |
|---|---|
| **Log aggregation** | Prikupljanje logova sa mnogo izvora na jedno mjesto, uz normalizaciju formata i sinhronizaciju vremena (NTP!). |
| **Alerting** | Automatska obavještenja kad pravilo/korelacija okine. |
| **Scanning** | Periodično skeniranje ranjivosti i konfiguracija. |
| **Archiving** | Dugoročno čuvanje logova (retencija) zbog istraga i regulative; jeftinije skladište, nepromjenjivo (WORM/immutable). |
| **Reporting** | Periodični izvještaji o stanju, trendovima i usklađenosti. |
| **Alert tuning** | Podešavanje pravila da se smanje lažne uzbune (false positive) bez gubljenja stvarnih detekcija. Suzbija **alert fatigue** (zamor od uzbuna). |

> **Na ispitu:** „SOC tim ignoriše uzbune jer ih je previše i većina je lažna“ = potreban je **alert tuning**. Rješenje NIJE gašenje pravila u cjelini.

### Alati

- **SIEM** (Security information and event management): agregira i normalizuje logove, **korelira** događaje iz više izvora, alarmira, služi za istrage i izvještaje o usklađenosti. Primjeri: Splunk, Microsoft Sentinel, Elastic Security.
- **Agents/agentless**: agent na hostu šalje bogatije podatke i radi i van mreže, ali ga treba instalirati i održavati; agentless (npr. preko API-ja, WMI, SSH, syslog) je lakši za uvođenje, ali daje manje detalja.
- **Benchmarks**: referentne sigurne konfiguracije (CIS Benchmarks, DISA STIG) prema kojima se provjerava usklađenost.
- **Antivirus** i **DLP**: izvori uzbuna (detekcija malvera, pokušaj iznošenja podataka).
- **Vulnerability scanners**: izvori nalaza o ranjivostima.
- **Orchestration**: automatizovano povezivanje alata i odgovora (SOAR, više u modulu 09).
- **Packet analyzer**: hvatanje i analiza paketa (Wireshark, tcpdump). Daje **puni sadržaj** saobraćaja.

### Protokoli

| Protokol | Šta daje | Napomena |
|---|---|---|
| **NetFlow** (i IETF standard **IPFIX**) | **Metapodaci** o tokovima: ko je s kim pričao, kada, koji portovi, koliko bajtova. **Bez sadržaja** paketa. | Odlično za otkrivanje eksfiltracije (veliki odlazni tok) i beaconinga, malo prostora. |
| **SNMP** | Nadzor i upravljanje mrežnim uređajima; **trap** = uređaj sam javlja događaj. | UDP 161 (upiti) i 162 (trapovi). v1/v2c koriste community string u čistom tekstu; koristi **SNMPv3** (autentikacija + enkripcija). |
| **syslog** | Standardni format i transport logova (Linux, mrežni uređaji). | Tradicionalno UDP 514; sigurnije preko TLS-a (TCP 6514). |
| **SCAP** (Security Content Automation Protocol) | NIST skup standarda za automatizovanu provjeru usklađenosti i ranjivosti: CVE, CVSS, CPE, CCE, XCCDF (checklista), OVAL (provjere stanja). | Omogućava da različiti alati razmjenjuju i izvršavaju iste provjere, npr. `oscap` sa CIS/STIG profilom. |

```bash
# SCAP provjera Linux hosta prema profilu (OpenSCAP)
oscap xccdf eval --profile xccdf_org.ssgproject.content_profile_cis \
  --report izvjestaj.html /usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml
```

### Automated alerts, port mirroring, dashboards, NMS

- **Automated alerts**: uzbune koje se šalju automatski (email, Slack, PagerDuty, tiket) kad se dostigne prag ili poklopi pravilo.
- **Port mirroring** (SPAN): switch kopira saobraćaj sa jednog ili više portova na port gdje sluša IDS ili packet analyzer. Alternativa je fizički **network TAP** (pouzdaniji, ne gubi pakete pod opterećenjem).
- **Dashboards**: vizuelni pregled stanja u realnom vremenu (broj uzbuna, top izvori napada, status zakrpa) za SOC i menadžment.
- **Network management systems (NMS)**: centralni alati za nadzor mrežnih uređaja (dostupnost, performanse, konfiguracija), uglavnom preko SNMP-a. Npr. Zabbix, PRTG, LibreNMS.

> **Na ispitu:** „Treba vidjeti koji interni host šalje velike količine podataka napolje, bez čuvanja sadržaja paketa“ = **NetFlow**. „Treba sadržaj paketa“ = **packet capture** preko **port mirroring**-a. „Korelacija logova iz firewall-a, AD-a i servera“ = **SIEM**.

## Rezime

- Kontrolu biraj po sloju problema: mreža (segmentacija, firewall, NIDS/NIPS, NAC), host (EDR, HIPS, application allow list, SELinux, GPO), aplikacija (WAF, input validation, secure cookies, SAST, code signing), email (SPF, DKIM, DMARC, BIMI).
- Deception: honeypot/honeynet (sistemi), honeyfile (fajl), honeytoken (podatak/kredencijal), canary account (nalog); svaki dodir je alarm.
- IDS detektuje pasivno, IPS blokira inline; WAF štiti web aplikacije na L7; UTM je sve-u-jednom, ali single point of failure.
- 802.1X = supplicant + authenticator + RADIUS; posture provjera šalje neusklađene uređaje u karantin; captive portal za goste.
- SPF = ko smije slati (IP), DKIM = potpis i integritet, DMARC = politika + izvještaji + alignment, BIMI = logo uz DMARC enforcement.
- Asset lifecycle: planning → acquisition → assignment (vlasnik!) → monitoring/tracking → disposal (sanitizacija, certifikat o uništenju).
- Vulnerability management: identifikacija (scanning, IPAM, CSPM, code review) → prioritizacija (CVSS + kontekst + pentest) → remediation → verification (rescan) → reporting (interno, bug bounty, responsible disclosure).
- Monitoring: SIEM korelira, NetFlow daje metapodatke, packet capture sadržaj, SNMPv3 za uređaje, syslog za logove, SCAP za automatizovanu usklađenost; alert tuning protiv alert fatigue.
