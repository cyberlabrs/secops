## Ciljevi ispita: 2.4 i 2.5

- **2.4** Explain types of vulnerabilities and attack surfaces: gdje sve postoje slabosti, od zastarjelog softvera i loše konfiguracije do LLM-ova i identity providera.
- **2.5** Given a scenario, analyze indicators of malicious activity: iz opisa simptoma ili loga prepoznaj vrstu malvera ili napada i indikator kompromitacije.

Ovo je najveći dio domena 2 i na ispitu nosi mnogo pitanja. Cilj 2.5 je scenarijski: dobićeš log, opis ponašanja ili poruku i treba da kažeš šta se dešava.

## Ranjivosti i attack surface

### Zastarjeli, nepatchovani i neupravljani sistemi

| Pojam | Engleski | Šta znači | Primjer |
|---|---|---|---|
| Nepodržani proizvodi | **Unsupported products** | Proizvođač više ne izdaje zakrpe (end of life / end of support) | Windows Server 2012 R2 bez ESU, stara verzija Kubernetes-a van podrške |
| Nepatchovani sistemi | **Unpatched systems** | Zakrpa postoji, ali nije primijenjena | Server bez zakrpe za poznat CVE mjesecima |
| Zastarjeli sistemi | **Obsolete systems** | Tehnologija prevaziđena, često bez zamjene i bez stručnjaka koji je znaju | Stari mainframe softver, uređaj koji podržava samo SMBv1 |
| Neupravljani sistemi | **Unmanaged systems** | Sistem koji niko ne prati: nije u inventaru, nema agenta, ne prima update-e | Zaboravljen EC2 iz starog projekta, „privremeni" test server |
| Portovi i servisi | **Ports and services** | Nepotrebno otvoreni portovi i pokrenuti servisi povećavaju površinu napada | Otvoren Redis 6379 ili Kubernetes dashboard na internetu |

> **Na ispitu:** **Unsupported** = zakrpe **ne postoje** i neće postojati. **Unpatched** = zakrpa **postoji** ali nije instalirana. Za unsupported sistem odgovor je zamjena (upgrade) ili kompenzaciona kontrola (izolacija), ne „instaliraj patch".

### Aplikacije

- **Race conditions**: ishod zavisi od redoslijeda ili vremena izvršavanja paralelnih operacija.
  - **Time-of-check (TOC)**: trenutak kada program provjeri uslov (da li fajl postoji, da li korisnik ima dovoljno sredstava, da li ima pravo).
  - **Time-of-use (TOU)**: trenutak kada program koristi resurs.
  - **TOCTOU** ranjivost: između provjere i upotrebe napadač promijeni stanje. Primjeri: program provjeri da `/tmp/report` nije symlink, a prije upisa ga napadač zamijeni symlinkom na `/etc/passwd`; dva istovremena zahtjeva za isplatu prođu provjeru stanja računa pa se novac isplati dvaput.
  - Zaštita: atomarne operacije, zaključavanje (locking), transakcije u bazi, idempotentni zahtjevi.
- **Malicious update**: legitiman kanal za ažuriranje isporuči zlonamjerni kod. Primjer: backdoor ubačen u biblioteku **xz utils** 2024. (CVE-2024-3094) preko maintainera koji je godinama gradio povjerenje. Zaštita: potpisani update-i, pinovanje verzija, praćenje promjena zavisnosti, SBOM.

### Kod

- **Hardcoded secrets**: lozinke, API ključevi i tokeni upisani direktno u kod ili konfiguraciju koja ide u git. Kad jednom uđu u istoriju repozitorija, smatraju se kompromitovanim. Zaštita: secret manager (AWS Secrets Manager, Azure Key Vault, Vault), skeneri tajni (gitleaks, GitHub secret scanning) u pre-commit i CI.
- **Unsafe exception handling**: greška otkriva previše (stack trace, verzija frameworka, SQL upit, putanje) ili aplikacija u slučaju greške ostaje u nesigurnom stanju (npr. preskoči provjeru autorizacije, što se zove **fail open**). Ispravno: generička poruka korisniku, detalji samo u logu, **fail closed** (fail secure).

### OS i virtualizacija

- **OS-based**: ranjivosti kernela i sistemskih servisa, slabe default postavke, nepotrebni servisi, loše dozvole (SUID, world-writable fajlovi). Rješenje: hardening, patchovanje, CIS benchmark.
- **Virtualization**:
  - **VM escape**: kod iz gosta (VM) izađe na hipervizor i dobije pristup drugim VM-ovima. U kontejnerima analogno **container escape** (privilegovan kontejner, montiran Docker socket, ranjivost runtime-a).
  - **Resource reuse**: memorija ili disk prethodnog korisnika nije očišćen prije dodjele novom VM-u.
  - **VM sprawl**: nekontrolisano umnožavanje VM-ova koje niko ne prati (veza sa unmanaged systems).

### Zero-day i kriptografske ranjivosti

- **Zero-day**: ranjivost koju proizvođač još ne zna ili za koju još nema zakrpe, a napadači je već iskorištavaju. Signature-based alati je ne prepoznaju. Odbrana: defense in depth, detekcija ponašanja (EDR), segmentacija, brzo virtuelno patchovanje (WAF pravilo).
- **Cryptographic vulnerabilities**: slabi ili zastarjeli algoritmi (MD5, SHA-1, DES, RC4), kratki ključevi, stare verzije protokola (SSL, TLS 1.0), loša implementacija (ponovljeni nonce, slab generator slučajnih brojeva), istekli certifikati, ključevi u kodu.

### Nalozi, uređaji i shadow IT

- **Unmanaged / stale credentials**: nalozi bivših zaposlenih, servisni nalozi bez vlasnika, dugovječni IAM access ključevi, tokeni koji nikad ne ističu. Zaštita: offboarding, rotacija, kratkotrajni kredencijali (OIDC federacija u CI/CD umjesto statičnih ključeva), periodični pregled.
- **Rogue devices**: neodobreni uređaji spojeni na mrežu, npr. Raspberry Pi ukopčan iza printera, lični ruter, **rogue access point**. Zaštita: 802.1X/NAC, praćenje novih MAC adresa, fizički nadzor.
- **Shadow IT**: sistemi i servisi koje zaposleni koriste bez znanja i odobrenja IT-a (lični SaaS nalozi, nezvaničan cloud account na kreditnoj kartici tima). Problem: nema nadzora, backupa ni kontrole podataka. Otkrivanje: CASB, analiza DNS/proxy logova, pregled troškova.

### Bežične i mobilne

- **Wireless and low-powered communications**: Wi-Fi sa slabom enkripcijom (WEP, WPA2 sa slabom lozinkom), Bluetooth Low Energy, Zigbee, LoRa i drugi protokoli za IoT. Uređaji sa malo snage često nemaju resurse za jaku kriptografiju i rijetko se ažuriraju.
- **Mobile devices**:
  - **Sideloading**: instalacija aplikacija van zvanične prodavnice, bez provjere.
  - **Jailbreaking** (iOS) / **rooting** (Android): uklanjanje sigurnosnih ograničenja OS-a.
  - Izgubljeni uređaji, zastarjele verzije OS-a, BYOD bez MDM-a.

### LLM i identity provider

- **Large language models (LLMs)** kao attack surface: aplikacije koje koriste LLM izlažu nove ulaze. Glavni rizici: **prompt injection** (direktan ili indirektan, preko dokumenta ili web stranice koju model čita), curenje osjetljivih podataka iz konteksta, LLM agent sa prevelikim ovlaštenjima koji izvršava akcije, nesiguran tretman izlaza modela (izlaz se direktno izvršava kao kod ili SQL). Detaljno u modulu o AI prijetnjama (cilj 2.6).
- **Identity providers (IdP)**: Entra ID, Okta, Google Workspace, Keycloak. IdP je „glavni ključ": ako napadač kompromituje IdP, admin nalog u njemu ili ključ za potpisivanje tokena, može se prijaviti u **sve** aplikacije povezane preko SSO-a. Rizici: krađa admin naloga, lažirani SAML/OIDC tokeni, zlonamjerne OAuth aplikacije, loše podešene federacije, napadi na helpdesk radi resetovanja MFA. Zaštita: phishing-resistant MFA za admine, praćenje promjena konfiguracije IdP-a, zaštita ključeva za potpisivanje, minimalan broj globalnih admina.

### Misconfiguration i javni resursi

- **Misconfiguration**: default lozinke, otvoren management interfejs, previše permisivne IAM politike (`*:*`), isključeno logovanje, Kubernetes pod sa `privileged: true`. Jedan od najčešćih uzroka incidenata u cloudu.
- **Public repositories**: tajne, interni hostnameovi i konfiguracije u javnim GitHub repozitorijima; slučajno javan privatni repozitorij; zlonamjerni paketi u javnim registrima (typosquatting na npm/PyPI, dependency confusion).
- **Public object storage**: S3 bucket, Azure Blob container ili GCS bucket sa javnim pristupom koji sadrži backupe ili lične podatke. Zaštita: S3 Block Public Access na nivou naloga, Azure „Allow Blob anonymous access" isključen, CSPM alati koji prijavljuju javne resurse.

> **Na ispitu:** Ako scenarij pominje lozinku ili ključ pronađen u kodu ili git istoriji, **prvi korak** je **opozvati i rotirati** tajnu. Brisanje fajla iz repozitorija ne pomaže jer tajna ostaje u istoriji i mogla je već biti kopirana.

## Malver

| Tip | Engleski | Ključna osobina | Indikatori |
|---|---|---|---|
| Ransomware | **Ransomware** | Šifruje podatke i traži otkup. Često i krade podatke prije šifrovanja (double extortion). | Masovno preimenovanje fajlova sa novom ekstenzijom, ransom note, brisanje shadow kopija (`vssadmin delete shadows`), visok disk I/O |
| Trojanac | **Trojan** | Predstavlja se kao legitiman program | Krekovan softver, lažni installer; često instalira **RAT** (remote access trojan) |
| Crv | **Worm** | Samostalno se širi mrežom, **bez interakcije korisnika** | Nagli porast skeniranja i saobraćaja na jednom portu između internih hostova |
| Špijunski softver | **Spyware** | Tajno prikuplja podatke o korisniku | Neobičan izlazni saobraćaj, nepoznati procesi |
| Adware | **Adware** | Prikazuje neželjene reklame, mijenja pregledač | Pop-up prozori, promijenjena početna stranica i pretraživač |
| Virus | **Virus** | Ubacuje se u druge fajlove i **treba akciju korisnika** da bi se pokrenuo i širio | Izmijenjeni izvršni fajlovi, promijenjeni hashevi |
| Rootkit | **Rootkit** | Sakriva se duboko u sistemu (kernel, bootloader, firmware) i krije druge procese i fajlove | Alati OS-a ne pokazuju ništa, ali spoljni pregled (offline skeniranje, mrežni saobraćaj) pokazuje aktivnost |
| Keylogger | **Keylogger** | Bilježi pritiske tastera | Ukradene lozinke bez phishinga, nepoznat proces sa pristupom tastaturi |
| Logička bomba | **Logic bomb** | Kod koji čeka uslov (datum, brisanje naloga) pa izvrši štetu | Šteta u tačno određeno vrijeme, često povezana sa insajderom |
| Malver bez fajlova | **Fileless malware** | Živi u memoriji i koristi legitimne alate (PowerShell, WMI), bez izvršnog fajla na disku | Kodirane PowerShell komande (`-EncodedCommand`), sumnjivi child procesi Office aplikacija, perzistencija u registru ili WMI pretplatama |

> **Na ispitu:** **Virus** treba korisnika (pokretanje fajla), **worm** se širi sam. **Trojan** se predstavlja kao koristan program. **Rootkit** je ključna riječ kad „alati sistema ne pokazuju ništa sumnjivo, a aktivnost postoji". **Logic bomb** = okidač (datum ili događaj).

## Fizički napadi

| Napad | Engleski | Opis | Kontrola |
|---|---|---|---|
| Ulazak za nekim | **Tailgating** | Neovlaštena osoba prođe kroz vrata za ovlaštenom. (Kad ovlaštena osoba svjesno pusti, to se zove i piggybacking.) | Access vestibule, turnstile, obuka, čuvar |
| Gledanje preko ramena | **Shoulder surfing** | Posmatranje ekrana ili tastature radi PIN-a ili lozinke | Privacy filteri, svijest, raspored stolova |
| Skimming | **Skimming** | Uređaj na bankomatu, POS terminalu ili čitaču kartica kopira podatke kartice | Pregled uređaja, beskontaktno plaćanje sa tokenizacijom, nadzor |
| Nasilan ulaz | **Forced entry** | Fizičko provaljivanje vrata, prozora, ormara sa serverima | Ojačana vrata, alarmi, senzori, kamere |

## Mrežni napadi

| Napad | Opis | Indikatori |
|---|---|---|
| **DDoS** (Distributed Denial of Service) | Mnogo uređaja (botnet) preopterećuje metu. Volumetrijski, protokolarni (SYN flood) i aplikacioni (HTTP flood). **Amplification/reflection**: mali upit na DNS ili NTP server sa lažnom IP adresom žrtve daje veliki odgovor ka žrtvi. | Nagli skok saobraćaja sa mnogo izvora, servis nedostupan |
| **Protocol downgrade** | Napadač natjera strane da koriste stariju, slabiju verziju protokola ili šifre (npr. TLS 1.0, HTTP umjesto HTTPS: SSL stripping) | Konekcije sa starim verzijama protokola, nedostatak HSTS-a |
| **Rogue** (rogue AP, rogue DHCP) | Neovlaštena pristupna tačka ili DHCP server. **Evil twin** imitira legitimni SSID. | Dva AP-a sa istim SSID-om, neočekivan gateway ili DNS server |
| **Sniffing** | Presretanje i čitanje saobraćaja | Promiskuitetni mod interfejsa, nešifrovani protokoli |
| **Spoofing** | Lažiranje identiteta: IP, MAC, ARP, e-mail adresa pošiljaoca | ARP tabela sa jednom MAC adresom za više IP-ova |
| **On-path** (ranije man-in-the-middle) | Napadač se postavi između dvije strane i čita ili mijenja saobraćaj (ARP poisoning, evil twin, zlonamjerni proxy) | Upozorenja o certifikatu, gratuitous ARP poruke |
| **DNS attacks** | Napadi na ili kroz DNS: preusmjeravanje, **domain hijacking** (preuzimanje registracije), DNS tunneling (izvlačenje podataka kroz DNS upite) | Neobično dugi ili česti DNS upiti, promijenjeni NS zapisi |
| **Cache poisoning** | Ubacivanje lažnih zapisa u keš DNS resolvera, pa svi korisnici dobijaju napadačevu IP adresu | Domeni se razrješavaju na neočekivane IP adrese. Zaštita: **DNSSEC** |

## Social engineering napadi

| Napad | Kanal | Ključna razlika |
|---|---|---|
| **Phishing** | E-mail | Masovne, generičke poruke |
| **Spear phishing** | E-mail ili poruka | Ciljano na konkretnu osobu ili grupu, personalizovano |
| **Whaling** | E-mail, poziv | Cilja **visoke rukovodioce** (CEO, CFO) |
| **Smishing** | **SMS** (i RCS) | Phishing preko tekstualnih poruka |
| **Vishing** | **Glasovni poziv** | Lažni bankar, lažna IT podrška, sve češće uz kloniran glas |
| **Quishing** | **QR kod** | Link sakriven u QR kodu (e-mail, letak, PDF, naljepnica na parking aparatu) |
| **Impersonation** | Bilo koji | Predstavljanje kao neko kome žrtva vjeruje (helpdesk, dobavljač, direktor) |
| **Deepfake** | Video, glas, slika | AI-generisan lažan video ili glas stvarne osobe. Primjer: zaposleni je odobrio velike uplate nakon video poziva sa „direktorima" koji su bili deepfake. |

Odbrana: obuka i simulacije, **verifikacija drugim kanalom** (callback na poznat broj, ne na broj iz poruke), proces sa dvostrukim odobrenjem za uplate, DMARC, phishing-resistant MFA (FIDO2/passkeys).

> **Na ispitu:** Kanal određuje naziv: SMS = **smishing**, glas = **vishing**, QR kod = **quishing** (čak i kad QR kod stigne e-mailom). Meta određuje: rukovodilac = **whaling**, konkretna osoba ili tim = **spear phishing**. Lažni video ili glas generisan AI-jem = **deepfake**.

## Aplikacioni napadi

| Napad | Opis | Primjer indikatora |
|---|---|---|
| **Injection** | Neprovjeren ulaz se izvrši kao dio upita ili komande: SQL injection, command injection, LDAP, XSS (ubacivanje skripta u stranicu) | `' OR '1'='1' --` u parametru, `; cat /etc/passwd` u polju forme, `<script>` u komentaru |
| **Buffer overflow** | Program upiše više podataka nego što bafer može primiti i prepiše susjednu memoriju, što može dovesti do izvršavanja koda | Pad programa, dugački nizovi istih znakova (`AAAA…`) u ulazu, NOP sled (`0x90…`) |
| **Replay** | Napadač ponovo pošalje snimljen validan zahtjev ili token | Isti zahtjev ili token više puta, sa istim timestampom ili nonce-om |
| **Privilege escalation** | Dobijanje većih prava od dodijeljenih: **vertical** (korisnik → admin) ili **horizontal** (pristup podacima drugog korisnika na istom nivou) | Nalog dobija admin grupu, proces pokrenut kao root iz korisničke sesije |
| **Forgery** | Lažiranje zahtjeva: **CSRF** (pregledač žrtve šalje zahtjev na sajt gdje je prijavljena), **SSRF** (server natjeran da šalje zahtjeve ka internim resursima, npr. cloud metadata `169.254.169.254`) | Zahtjevi sa neočekivanim Referer-om, server pristupa metadata servisu |
| **Directory traversal** | Pristup fajlovima van dozvoljenog direktorija pomoću `../` | `GET /download?file=../../../etc/passwd`, kodirano `%2e%2e%2f` |

Odbrana: validacija ulaza i parametrizovani upiti, WAF, memorijski sigurni jezici i zaštite (ASLR, DEP), anti-CSRF tokeni i SameSite kolačići, IMDSv2 u AWS-u protiv SSRF krađe kredencijala.

> **Na ispitu:** Prepoznaj po potpisu u logu: `'` i `OR 1=1` = **SQL injection**, `../` = **directory traversal**, dugačak niz istih znakova = **buffer overflow**, `<script>` = **XSS** (vrsta injection napada), isti zahtjev ponovljen = **replay**.

## Credential napadi

| Napad | Opis | Indikator |
|---|---|---|
| **Brute force** | Mnogo lozinki na **jedan** nalog (online) ili nad ukradenim hashevima (offline) | Mnogo neuspješnih prijava na jedan nalog, **account lockout** |
| **Password spraying** | **Jedna ili nekoliko** čestih lozinki na **mnogo** naloga, polako, da se izbjegne lockout | Po jedan neuspjeh na stotinama naloga sa istog izvora, ista lozinka |
| **User enumeration** | Otkrivanje koja korisnička imena postoje | Različite poruke „korisnik ne postoji" vs „pogrešna lozinka", različito vrijeme odgovora |
| **Replay** | Ponovna upotreba presretnutog hasha, tokena ili kolačića (npr. **pass-the-hash**) | Prijava sa validnim tokenom sa neočekivane lokacije |
| **MFA bypass** | Zaobilaženje drugog faktora: **MFA fatigue** (push bombing: korisnik dobija desetine push zahtjeva dok ne odobri), **AiTM phishing** (proxy stranica krade sesijski kolačić nakon MFA), **SIM swapping** (preuzimanje broja telefona za SMS kodove), prevara helpdeska za reset MFA | Mnogo odbijenih push zahtjeva pa jedan odobren; nova MFA metoda registrovana odmah nakon reseta |

Dodatno: **credential stuffing** = upotreba parova korisničko ime/lozinka procurjelih sa drugih sajtova (radi jer ljudi ponavljaju lozinke).

> **Na ispitu:** **Spraying** = mnogo naloga, malo lozinki. **Brute force** = jedan nalog, mnogo lozinki. Ako pitanje kaže da nema zaključavanja naloga, ali ima neuspjelih prijava raspoređenih po mnogo korisnika, to je spraying. Za MFA bypass preko push bombinga odgovor je **number matching** ili phishing-resistant MFA (FIDO2).

## Indikatori kompromitacije

**Indicators of compromise (IoC)** su tragovi koji ukazuju da je do napada došlo ili da je u toku.

| Indikator | Engleski | Šta tražiš |
|---|---|---|
| Hash | **Hash** | Hash fajla poklapa se sa poznatim malverom (VirusTotal, threat feed) |
| IP adresa | **IP address** | Komunikacija sa poznatom C2 adresom ili Tor izlaznim čvorom |
| Domen | **Domain** | Upiti ka nedavno registrovanim, sličnim (typosquat) ili DGA domenima |
| Zlonamjerni procesi | **Malicious processes** | Nepoznat proces, legitimno ime na pogrešnoj putanji (`svchost.exe` u `C:\Users\Public`), Word pokreće PowerShell |
| Artefakti fajl sistema | **File system artifacts** | Novi fajlovi u temp folderima, skriveni direktoriji, ransom note, cron/scheduled task za perzistenciju |
| Vremenske oznake | **Timestamp** | Aktivnost van radnog vremena; **timestomping** (napadač mijenja datume fajlova da se uklope) |
| Manipulacija logovima | **Log manipulation** | Praznine u logovima, obrisan Security log (Event ID 1102), isključen CloudTrail (`StopLogging`) |
| Prekomjerna potrošnja resursa | **Excessive resource consumption** | CPU na 100% (cryptomining), neobično velik izlazni saobraćaj (eksfiltracija), popunjen disk |
| Čitljivi stringovi | **Plaintext strings** | Hardkodovane URL adrese, IP-ovi, komande ili lozinke vidljive u binarnom fajlu (`strings`) ili u memoriji |
| Zaključavanje naloga | **Account lockout** | Mnogo zaključanih naloga (brute force) ili korisnik zaključan iako se nije prijavljivao |
| Nemoguće putovanje | **Impossible travel** | Prijava iz Beograda pa 20 minuta kasnije iz Singapura za isti nalog |
| Istovremene sesije | **Concurrent sessions** | Isti nalog aktivan sa dva uređaja ili lokacije u isto vrijeme kada to nije očekivano |

Primjeri u cloudu: GuardDuty nalazi (npr. kredencijali EC2 instance korišćeni van AWS-a), Entra ID Identity Protection (impossible travel, atypical travel, anomalous token), Defender for Cloud.

> **Na ispitu:** **Impossible travel** = dvije prijave sa lokacija koje su fizički nemoguće u tom vremenu. **Concurrent sessions** = istovremeno aktivne sesije istog naloga. Oba sugerišu ukradene kredencijale ili token. Prvi korak je obično **opozvati sesije i resetovati kredencijale**.

## Vježba: čitanje logova

Cilj 2.5 počinje sa „Given a scenario, analyze". Na ispitu ćeš vidjeti kratke isječke logova. Vježbaj prepoznavanje potpisa.

### Primjer 1: web server

```text
10.0.4.21 - - [12/Oct/2026:03:14:07] "GET /img?name=..%2f..%2f..%2fetc%2fpasswd HTTP/1.1" 200 1843
10.0.4.21 - - [12/Oct/2026:03:14:09] "GET /search?q=1%27%20UNION%20SELECT%20user,pass%20FROM%20users-- HTTP/1.1" 500 312
```

- Prvi red: `..%2f` je URL-kodiran `../`, odgovor `200` sa veličinom tipičnom za `/etc/passwd`. **Directory traversal**, i to uspješan.
- Drugi red: `%27` je apostrof, `UNION SELECT` i `--` su potpis **SQL injection** napada. Odgovor `500` sugeriše da aplikacija ne obrađuje grešku dobro.
- Oba zahtjeva u 3 ujutro sa iste adrese: isti napadač, automatizovan alat.

### Primjer 2: autentifikacija

```text
03:00:01 FAIL user=a.petrovic   src=185.220.x.x
03:00:04 FAIL user=m.jovanovic  src=185.220.x.x
03:00:06 FAIL user=s.kovacevic  src=185.220.x.x
... (1.200 različitih korisnika, po jedan pokušaj)
03:41:17 OK   user=d.markovic   src=185.220.x.x
```

Jedan pokušaj po nalogu na mnogo naloga, bez zaključavanja = **password spraying**. Jedan uspjeh znači da je `d.markovic` imao slabu lozinku. Sljedeći koraci: reset lozinke, opoziv sesija, provjera šta je nalog radio nakon 03:41, blokada izvora, uvođenje MFA i provjera lozinki protiv liste procurjelih lozinki.

Za poređenje, **brute force** bi izgledao kao stotine `FAIL user=a.petrovic` zaredom, a zatim `ACCOUNT LOCKED`.

### Primjer 3: endpoint

```text
ParentImage: C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE
Image:       C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
CommandLine: powershell -nop -w hidden -EncodedCommand SQBFAFgAIAAoAE4AZQB3AC0ATwBi...
```

Excel ne treba da pokreće PowerShell. Skriveni prozor (`-w hidden`) i kodirana komanda su klasičan potpis makro napada koji vodi u **fileless malware** i **living-off-the-land**. Početni vektor je najvjerovatnije **attachment-based** (makro u Excel prilogu).

### Primjer 4: cloud

```text
eventName: StopLogging        userIdentity: arn:aws:iam::1111:user/ci-deploy  sourceIP: 45.x.x.x
eventName: CreateUser         userName: support-backup
eventName: AttachUserPolicy   policyArn: arn:aws:iam::aws:policy/AdministratorAccess
```

- `StopLogging` na CloudTrailu = **log manipulation**.
- CI nalog sa statičnim ključem korišten sa nepoznate IP adrese = kompromitovani **stale/hardcoded credentials**.
- Kreiranje novog admin korisnika = **privilege escalation** i perzistencija.
- Odgovor: deaktivirati ključ, obrisati novog korisnika, ponovo uključiti logovanje, istražiti šta je urađeno, preći na kratkotrajne kredencijale (OIDC) u CI/CD-u.

## Slični pojmovi koje ispit miješa

| Par | Kako ih razlikovati |
|---|---|
| Virus vs worm | Virus treba da korisnik pokrene fajl. Worm se širi sam preko mreže. |
| Trojan vs RAT | Trojan je način isporuke (maska). RAT je funkcija (udaljeni pristup). Trojan često instalira RAT. |
| Spyware vs keylogger | Keylogger je uža vrsta spywarea koja bilježi tastere. |
| Brute force vs spraying | Jedan nalog i mnogo lozinki vs mnogo naloga i malo lozinki. |
| Replay vs on-path | Replay ponavlja snimljene podatke kasnije. On-path aktivno stoji između strana u realnom vremenu. |
| Spoofing vs on-path | Spoofing je lažiranje identiteta (često sredstvo). On-path je pozicija za presretanje (cilj). |
| DNS cache poisoning vs domain hijacking | Poisoning ubacuje lažne zapise u keš resolvera. Hijacking preuzima samu registraciju domena kod registrara. |
| Phishing vs spear phishing vs whaling | Masovno vs ciljano vs ciljano na rukovodioca. |
| Unsupported vs unpatched | Zakrpa ne postoji vs zakrpa postoji ali nije primijenjena. |
| Zero-day vs unpatched | Kod zero-daya zakrpa još ne postoji. Kad zakrpa izađe i nije primijenjena, sistem je unpatched. |
| Shadow IT vs rogue device | Shadow IT su neodobreni servisi i sistemi (često SaaS ili cloud). Rogue device je neodobren fizički uređaj u mreži. |
| Tailgating vs piggybacking | Kod tailgatinga ovlaštena osoba ne zna. Kod piggybackinga svjesno pusti. Ispit oba često zove tailgating. |

## Smanjenje attack surface-a u DevOps okruženju

| Oblast | Konkretna mjera |
|---|---|
| Inventar | Tagovanje svih resursa, AWS Config / Azure Resource Graph za pronalaženje neupravljanih resursa |
| Zakrpe | Redovno ponovno buildanje container slika, automatski patching (SSM Patch Manager, Azure Update Manager), praćenje EOL datuma |
| Portovi | Security Groups i NSG po principu deny by default, bez `0.0.0.0/0` na management portovima |
| Tajne | Secret manager, skeniranje tajni u CI, kratkotrajni kredencijali preko OIDC federacije |
| Konfiguracija | IaC sa policy-as-code provjerama (Checkov, tfsec, OPA/Kyverno), CSPM |
| Javni resursi | Block Public Access na nivou naloga, zabrana anonimnog pristupa Blob storage-u |
| Zavisnosti | SBOM, skeniranje slika i biblioteka, pinovanje verzija i hasheva, privatni mirror registra |
| Identitet | MFA otporan na phishing za admine, PIM za privilegovane uloge, pregled OAuth aplikacija u IdP-u |
| LLM aplikacije | Least privilege za alate koje model poziva, ljudsko odobrenje za osjetljive akcije, validacija izlaza modela |

## Rezime

- **Unsupported** (nema zakrpa) vs **unpatched** (zakrpa postoji). Unmanaged sistemi, nepotrebni portovi i servisi, shadow IT i rogue uređaji povećavaju attack surface.
- **TOCTOU race condition**: stanje se promijeni između provjere i upotrebe. **Malicious update** zloupotrebljava povjerenje u kanal ažuriranja.
- Kod: **hardcoded secrets** (rotiraj odmah) i **unsafe exception handling** (curenje detalja, fail open).
- Novi attack surface: **LLM** (prompt injection, previše ovlaštenja) i **identity provider** (kompromitacija = pristup svim SSO aplikacijama). Javni repozitoriji i javni object storage su česti izvori curenja.
- Malver: virus (treba korisnika), worm (sam se širi), trojan (maska), rootkit (skriva se), logic bomb (okidač), fileless (memorija + legitimni alati), ransomware (šifrovanje i iznuda).
- Social engineering po kanalu: smishing (SMS), vishing (glas), quishing (QR), deepfake (AI video/glas); po meti: spear phishing, whaling.
- Aplikacioni potpisi: `' OR 1=1` injection, `../` traversal, `AAAA…` buffer overflow, ponovljen zahtjev replay. Credential: spraying (mnogo naloga) vs brute force (jedan nalog), MFA fatigue.
- IoC: hash, IP, domen, procesi, artefakti, timestamp, log manipulation, resursi, plaintext strings, lockout, **impossible travel**, **concurrent sessions**.
