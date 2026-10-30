## Cilj ispita: 1.1

- **1.1** Explain concepts related to system and network architecture in security operations: logovanje (ingestion, konfiguracija, integritet, sinhronizacija vremena, retencija), operativni sistem (hardening, struktura fajlova, kritični fajlovi, procesi), infrastruktura (cloud native, virtualizacija, kontejneri, API), upravljanje uređajima (mobilni, endpoint), mrežna arhitektura (ZTNA, SASE, hibridni cloud), IAM (PAM, autentikacija i autorizacija, upravljanje tajnama), enkripcija, zaštita podataka i kritična infrastruktura (OT, ICS, SCADA).

Nakon ovog modula trebalo bi da znaš:

- kako log putuje od izvora do SIEM-a i gdje se na tom putu gubi ili kvari dokaz;
- zašto su NTP, retencija i integritet logova pitanja forenzike, a ne samo „IT higijene“;
- koje fajlove i procese na Windowsu i Linuxu analitičar mora prepoznati napamet;
- kako arhitektura (kontejneri, serverless, ZTNA, SASE, OT) mijenja ono što možeš vidjeti i uraditi;
- gdje PAM, upravljanje tajnama i enkripcija ulaze u svakodnevni rad SOC-a.

Većinu ovoga si već vidio u Security+ i AWS kursu iz ugla „kako se gradi“. CySA+ isto gradivo pita iz ugla analitičara: **šta mi ova arhitektura daje kao telemetriju i šta mi uskraćuje**.

## Logovanje: od izvora do SIEM-a

Kao u detection labu (Wazuh agent → manager → indexer) i u SC-200 kursu (konektori → Log Analytics workspace), svaki log prolazi isti put:

```
izvor (OS, aplikacija, firewall, cloud API)
  → prikupljanje (agent, syslog, API poll, Event Hub/Kinesis)
  → parsiranje i normalizacija (polja, vremenska zona, tip događaja)
  → obogaćivanje (GeoIP, asset, korisnik, threat intel)
  → skladištenje (hot/warm/cold, retencija)
  → korelacija i alarmi
```

### Ingestion (unos)

**Ingestion** je proces dovođenja logova u centralni sistem. Na ispitu se pojavljuju ova pitanja:

| Način | Kako radi | Prednost | Mana |
|---|---|---|---|
| **Agent** (Wazuh, Splunk UF, AMA) | Proces na hostu čita lokalne logove i šalje ih | Bogati podaci, bafer kada mreža padne | Treba ga instalirati i održavati |
| **Agentless / syslog** | Uređaj sam šalje (UDP/TCP 514, TLS 6514) | Radi za mrežne uređaje i appliance | UDP gubi poruke, nema bafera |
| **API pull** | SIEM periodično čita API (CloudTrail, M365) | Jedini način za SaaS | Kašnjenje, API limiti |
| **Streaming** | Event Hub, Kinesis, Kafka | Velik volumen u skoro realnom vremenu | Složenija postavka |
| **Forwarder / collector** | Posrednik (Logstash, Cribl, syslog-ng) | Filtriranje i normalizacija prije SIEM-a | Još jedna tačka otkaza |

Parsiranje je mjesto gdje se tiho gube dokazi: ako parser ne prepozna format, polje `src_ip` ostaje prazno i pravilo koje filtrira po IP adresi nikad ne okine. Zato se nakon dodavanja izvora uvijek provjerava da li se polja pune.

```text
# Sirov syslog sa firewall-a
<134>Oct 16 08:14:02 fw01 kernel: DROP IN=eth0 SRC=203.0.113.45 DST=10.0.1.20 PROTO=TCP SPT=51544 DPT=3389

# Nakon parsiranja (JSON u SIEM-u)
{"host":"fw01","action":"DROP","src_ip":"203.0.113.45","dst_ip":"10.0.1.20","dst_port":3389,"proto":"TCP"}
```

### Configuration (konfiguracija)

Logovanje ne radi „samo od sebe“. Najčešći razlozi zašto u incidentu nema dokaza:

- **Audit policy nije uključen**: Windows po defaultu ne loguje kreiranje procesa sa komandnom linijom (Event ID 4688 + „Include command line in process creation events“), niti PowerShell Script Block Logging (4104).
- **Nivo logovanja prenizak**: aplikacija loguje samo `ERROR`, pa neuspjele prijave (`WARN`) nestaju.
- **Cloud logovi nisu uključeni**: npr. S3 data events ili VPC Flow Logs su opcioni i plaćaju se.
- **Lokalni log se prepisuje**: Windows Security log ima maksimalnu veličinu i „overwrite as needed“.

```powershell
# Windows: provjera da li se audituje kreiranje procesa
auditpol /get /subcategory:"Process Creation"
# Process Creation        No Auditing     ← loše
auditpol /set /subcategory:"Process Creation" /success:enable
```

```bash
# Linux: auditd pravilo za praćenje izmjena /etc/passwd
auditctl -w /etc/passwd -p wa -k identity
ausearch -k identity --start today
```

> **Na ispitu:** Kada scenarij kaže „analitičar ne može pronaći događaje o pokrenutim komandama“ ili „log ne sadrži komandnu liniju“, odgovor je skoro uvijek **konfiguracija logovanja** (audit policy, verbosity), a ne novi alat. Prvo popravi izvor, pa tek onda SIEM.

### Integrity and security (integritet i zaštita)

Napadač koji dobije administratorska prava prvo pokušava ukloniti tragove: Event ID **1102** (Security log očišćen) na Windowsu, `history -c`, brisanje `/var/log/auth.log`, gašenje CloudTrail-a (`StopLogging`). Zaštita:

- **Centralizacija u realnom vremenu**: kopija je već u SIEM-u prije nego što napadač stigne obrisati lokalni log.
- **Odvojen nalog i mreža za logove**: npr. AWS log archive account (kao u AWS kursu), gdje ni admin produkcije nema pravo brisanja.
- **WORM / immutable storage**: S3 Object Lock, Azure immutable blob.
- **Hashovi i potpisi**: CloudTrail log file validation, hash lanac nad arhivom.
- **Kontrola pristupa**: logovi sadrže lične podatke i tajne, pa je čitanje logova privilegija.

```bash
$ aws cloudtrail validate-logs --trail-arn arn:aws:cloudtrail:eu-central-1:111122223333:trail/org --start-time 2026-10-15T00:00Z
Results requested for 2026-10-15T00:00:00Z to 2026-10-16T08:00:00Z
Results found for 2026-10-15T00:00:00Z to 2026-10-16T08:00:00Z:
24/24 digest files valid
1430/1431 log files valid, 1/1431 log files INVALID
```

Jedan nevalidan fajl znači da je neko mijenjao sadržaj nakon isporuke: to je samo po sebi indikator kompromitacije.

### Time synchronization (sinhronizacija vremena)

Bez zajedničkog vremena korelacija ne radi: ako je firewall 4 minute ispred domain controllera, „login pa konekcija na C2“ izgleda kao „konekcija pa login“. Pravila:

- Svi uređaji koriste **NTP** (ili PTP u OT/finansijama) iz istog, pouzdanog izvora; na Windows domenu PDC emulator je izvor vremena.
- Logovi se čuvaju u **UTC**, a vremenska zona se dodaje tek u prikazu.
- SIEM razlikuje **event time** (kada se desilo) i **ingest time** (kada je stiglo); veliki razmak znači kašnjenje ili lažirano vrijeme.

```bash
$ chronyc tracking
Reference ID    : C0A80001 (ntp1.corp.local)
System time     : 0.000214 seconds slow of NTP time
Leap status     : Normal

$ timedatectl
               Local time: Thu 2026-10-16 10:14:02 CEST
           Universal time: Thu 2026-10-16 08:14:02 UTC
System clock synchronized: yes
```

> **Na ispitu:** Ako se u timeline-u događaji sa različitih sistema „ne slažu“ ili je redoslijed nelogičan, korijen problema je **time synchronization** (NTP). Pitanje „šta prvo provjeriti prije korelacije logova sa više izvora“ obično cilja upravo na to.

### Retention (retencija)

Retencija je koliko dugo čuvaš logove. Određuju je tri stvari: **regulativa** (PCI DSS traži 12 mjeseci, od toga 3 odmah dostupna; neki sektori i duže), **operativne potrebe** (prosječno vrijeme otkrivanja napada često je duže od mjesec dana) i **trošak**.

| Sloj | Namjena | Primjer |
|---|---|---|
| Hot | Aktivna pretraga, pravila | 30–90 dana u SIEM-u |
| Warm/cold | Istrage, rjeđe pretrage | Data lake, Sentinel auxiliary/archive |
| Archive | Regulativa, legal hold | S3 Glacier sa Object Lock |

Ne čuva se „sve zauvijek“: logovi sadrže lične podatke, pa GDPR i interna politika traže i **gornju** granicu, osim kada je na snazi **legal hold**.

## Operativni sistem

### System hardening

**Hardening** smanjuje površinu napada: ukloni nepotrebne servise i pakete, zatvori portove, primijeni princip najmanjih privilegija, uključi logovanje, primijeni zakrpe. Mjerilo su **CIS Benchmarks** i DISA STIG (vidio si CIS u CKS kursu za Kubernetes). Za analitičara je važno da hardenovan sistem ima **predvidljivu baseline**, pa je odstupanje lakše uočiti.

### File structure i critical files

Na ispitu treba prepoznati putanju i reći zašto je sumnjiva promjena na njoj.

| OS | Fajl / lokacija | Zašto je kritičan |
|---|---|---|
| Linux | `/etc/passwd`, `/etc/shadow` | Nalozi i hashovi lozinki; novi nalog sa UID 0 je backdoor |
| Linux | `/etc/sudoers`, `/etc/sudoers.d/` | Ko smije biti root |
| Linux | `~/.ssh/authorized_keys` | Dodat ključ = trajan pristup bez lozinke |
| Linux | `/etc/crontab`, `/var/spool/cron/`, `/etc/systemd/system/` | Perzistencija |
| Linux | `/tmp`, `/dev/shm`, `/var/tmp` | Svi mogu pisati; omiljeno mjesto za alate napadača |
| Linux | `/var/log/auth.log` (`/var/log/secure`) | Prijave, sudo, SSH |
| Windows | `C:\Windows\System32\config\SAM`, `SYSTEM`, `SECURITY` | Registry hive-ovi sa hashovima |
| Windows | `C:\Windows\System32\drivers\etc\hosts` | Preusmjeravanje domena |
| Windows | `C:\Windows\System32\winevt\Logs\*.evtx` | Event logovi |
| Windows | `%APPDATA%`, `%TEMP%`, `C:\Users\Public` | Korisnik može pisati: česta lokacija malvera |
| Windows | `HKLM\...\CurrentVersion\Run`, `RunOnce` | Autostart perzistencija |
| Windows | `C:\Windows\System32\Tasks\` | Zakazani zadaci |

```bash
# Linux: nalozi sa UID 0 (treba biti samo root)
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
sysbackup        ← sumnjivo

# Fajlovi u /etc izmijenjeni u zadnja 24 sata
$ find /etc -type f -mtime -1 -ls
```

### System processes

Analitičar mora znati kako izgleda „normalno“ stablo procesa. Na Windowsu:

| Proces | Normalan roditelj | Normalna putanja | Sumnjivo ako |
|---|---|---|---|
| `smss.exe` | System | `System32` | Više instanci koje ostaju aktivne |
| `wininit.exe` | smss.exe | `System32` | Više od jedne instance |
| `services.exe` | wininit.exe | `System32` | Roditelj nije wininit |
| `lsass.exe` | wininit.exe | `System32` | Više instanci, drugi roditelj, ime `lsas.exe` |
| `svchost.exe` | services.exe | `System32` | Roditelj nije services.exe, bez `-k` parametra |
| `explorer.exe` | userinit.exe (koji izađe) | `C:\Windows` | Pokrenut iz `%TEMP%` |

Na Linuxu je PID 1 `systemd` (ili `init`), kernel threadovi su u uglastim zagradama (`[kworker/0:1]`), a sumnjivi su procesi bez fajla na disku ili iz `/tmp`:

```bash
$ ps -eo pid,ppid,user,cmd --forest | head
    1     0 root     /sbin/init
  612     1 root     /usr/sbin/sshd -D
 4410   612 root      \_ sshd: deploy [priv]
 4433  4410 deploy        \_ -bash
 4501  4433 deploy            \_ /tmp/.x/kworker -c /tmp/.x/c.json   ← lažno ime, putanja /tmp

$ ls -l /proc/4501/exe
lrwxrwxrwx 1 deploy deploy 0 Oct 16 08:20 /proc/4501/exe -> /tmp/.x/kworker (deleted)
```

`(deleted)` znači da je binarni fajl obrisan nakon pokretanja: klasičan indikator malvera koji skriva tragove.

> **Na ispitu:** `svchost.exe` čiji roditelj nije `services.exe`, `lsass.exe` van `System32` ili proces sa imenom sistemskog procesa uz grešku u slovima (typosquatting procesa) su odgovor na pitanje „koji proces je MOST likely zlonamjeran“.

## Infrastruktura i arhitektura sistema

| Model | Šta analitičar vidi | Šta gubi | Ključni logovi |
|---|---|---|---|
| **Virtualizacija** (VM) | Pun OS, klasični logovi, snapshot memorije i diska | Hipervizor je zaseban sloj koji gost ne vidi | Hipervizor logovi, guest logovi |
| **Containerization** | Procese po kontejneru, slike, runtime događaje | Kontejner je kratkotrajan; disk nestaje sa njim | Runtime (Falco), K8s audit log, stdout |
| **Cloud native** (serverless, managed servisi) | API pozive i konfiguraciju | Pristup OS-u, forenziku diska | CloudTrail, Activity Log, aplikacijski logovi |
| **API** | Ko je zvao šta, sa kojim tokenom | Sadržaj ako se ne loguje body | API gateway logovi, WAF |

Za kontejnere važi ono što si radio u CKS kursu: **imutabilnost** (ne mijenja se pokrenut kontejner, nego se pravi nova slika), skeniranje slika i runtime detekcija. Za analitičara posljedica je da dokazi nestaju sa podom, pa se logovi moraju odmah slati van (stdout → log agent) i forenzika se planira unaprijed (npr. checkpoint kontejnera prije brisanja).

**API-ji** su danas glavni ulaz u aplikacije i cloud. Važni pojmovi: autentikacija ključem ili tokenom (OAuth 2.0 bearer), **rate limiting**, gateway kao centralna tačka logovanja, i **API inventar** (zaboravljeni „shadow“ API-ji se ne nadziru). OWASP API Security Top 10 (npr. BOLA, broken object level authorization) je dobar okvir za čitanje indikatora.

## Upravljanje uređajima

- **Mobile**: **MDM/UEM** (Intune, Jamf) nameće PIN, enkripciju, dozvoljene aplikacije, daljinsko brisanje, i odvaja poslovni i lični profil (Android Work Profile, BYOD). Za SOC je MDM izvor telemetrije: da li je uređaj **compliant**, rootovan, ima li zastarjeli OS. Conditional Access može odbiti prijavu sa nekompatibilnog uređaja.
- **Endpoint**: **EDR** agent, upravljanje zakrpama, konfiguracijske baseline (GPO, Intune), inventar softvera. Nemanaged endpoint je slijepa tačka: nema telemetrije, nema izolacije na klik.

## Mrežna arhitektura

### Zero Trust i ZTNA

**Zero Trust**: nikad ne vjeruj na osnovu lokacije u mreži, uvijek provjeri identitet, uređaj i kontekst za svaki zahtjev (NIST SP 800-207). **ZTNA** (Zero Trust Network Access) je praktična primjena: umjesto VPN-a koji korisnika „spusti“ u cijelu mrežu, broker daje pristup samo konkretnoj aplikaciji, nakon provjere identiteta i stanja uređaja.

| | Klasičan VPN | ZTNA |
|---|---|---|
| Pristup | Cijela mreža (ili subnet) | Pojedinačna aplikacija |
| Odluka | Jednom, pri spajanju | Kontinuirano, po zahtjevu |
| Lateral movement | Lako nakon ulaska | Otežan, aplikacije su nevidljive |
| Vidljivost | Logovi VPN koncentratora | Log svakog pristupa aplikaciji sa identitetom |

### SASE

**SASE** (Secure Access Service Edge) spaja mrežu (SD-WAN) i sigurnosne funkcije isporučene iz clouda: **SWG** (secure web gateway), **CASB**, **ZTNA**, **FWaaS** i DLP. Korisnik, bilo gdje da je, ide kroz najbližu SASE tačku prisustva. Za SOC to znači jedno mjesto sa logovima web saobraćaja, SaaS upotrebe i pristupa aplikacijama, bez obzira radi li korisnik od kuće ili iz kancelarije.

### Hybrid cloud

**Hibridni cloud** spaja on-prem i javni cloud (često i više cloudova). Izazovi za SOC: različiti formati logova, identitet koji se proteže preko granica (Entra Connect, federacija), mrežne veze (VPN, Direct Connect/ExpressRoute) kao put za lateral movement, i **model dijeljene odgovornosti** (provajder štiti cloud, ti štitiš ono što staviš u njega).

> **Na ispitu:** „Udaljeni radnici trebaju pristup samo jednoj internoj aplikaciji, uz provjeru stanja uređaja, bez pristupa ostatku mreže“ → **ZTNA**. „Objedini SD-WAN, web filtriranje, CASB i ZTNA kao cloud servis za distribuirane kancelarije“ → **SASE**.

## Identity and access management

Identitet je danas glavni perimetar: većina cloud incidenata počinje ukradenim kredencijalom, ne exploitom.

### Autentikacija i autorizacija

- **Autentikacija** (ko si): lozinka, **MFA** (TOTP, push, FIDO2/passkey), certifikati, biometrija.
- **Autorizacija** (šta smiješ): RBAC, ABAC, politike (IAM policy, Conditional Access).
- **SSO i federacija**: **SAML** (XML assertion, enterprise web aplikacije), **OAuth 2.0** (delegirana autorizacija, access token), **OpenID Connect** (identitet nad OAuth-om, ID token u JWT formatu), Kerberos u AD domenu.
- **Phishing-resistant MFA** (FIDO2, smart card) je odgovor na AiTM phishing i MFA fatigue; SMS i push bez number matchinga to nisu.

### PAM

**PAM** (Privileged Access Management) kontroliše administratorske naloge:

- **Vault** za privilegovane lozinke sa check-out/check-in i automatskom rotacijom;
- **Just-in-time (JIT)** pristup: prava se dobijaju na ograničeno vrijeme, uz odobrenje (Entra PIM, AWS IAM Identity Center sa privremenim ulogama);
- **Session recording** i nadzor privilegovanih sesija;
- odvojeni admin nalozi i **privileged access workstation** (PAW).

Za analitičara je PAM i izvor dokaza (ko je kada preuzeo lozinku domain admina) i detekcije (privilegovana prijava bez check-outa iz vaulta = zaobilaženje kontrole).

### Secrets management

Tajne (API ključevi, lozinke baza, certifikati) ne idu u kod, image ni varijable u CI-u u čistom tekstu. Koriste se **HashiCorp Vault**, AWS Secrets Manager, Azure Key Vault (vidio si u DevSecOps kursu), uz:

- **dinamičke tajne** koje se generišu po zahtjevu i ističu;
- **rotaciju** i reviziju svakog čitanja;
- **workload identity** (OIDC federacija, IAM role za servise) umjesto statičnih ključeva.

> **Na ispitu:** Statičan dugovječni ključ u konfiguraciji je problem koji se rješava **secrets managementom** (vault + rotacija), a široka trajna admin prava rješavaju se **PAM-om sa JIT pristupom**. Ne miješaj ih: PAM je za ljudske privilegovane naloge, secrets manager za mašinske tajne.

## Enkripcija i zaštita podataka

| Stanje podatka | Tehnika | Primjer |
|---|---|---|
| **At rest** | Enkripcija diska i baze (AES-256), KMS, envelope encryption | BitLocker, LUKS, S3 SSE-KMS, TDE |
| **In transit** | TLS 1.2/1.3, IPsec, SSH, mTLS | HTTPS, service mesh mTLS |
| **In use** | Confidential computing (enklave) | AMD SEV, Intel TDX, Nitro Enclaves |

Kompromis za SOC: enkripcija u prenosu sakriva sadržaj od IDS-a. Zato se oslanjaš na **metapodatke** (JA3/JA4 otisci, SNI, veličina i ritam konekcija, certifikati) ili na **TLS inspekciju** na proxy-ju, gdje je to pravno i tehnički dozvoljeno.

**Zaštita podataka** (data protection):

- **Klasifikacija** (javno, interno, povjerljivo, strogo povjerljivo) određuje kontrole;
- **DLP** na endpointu, mreži i u cloudu (detekcija PII, brojeva kartica, oznaka osjetljivosti);
- **Maskiranje, tokenizacija, anonimizacija i pseudonimizacija** (tokenizacija je česta za CHD po PCI DSS);
- **Data sovereignty** i lokacija podataka (GDPR), backup sa enkripcijom i testiranim vraćanjem.

## Kritična infrastruktura: OT, ICS, SCADA

**OT** (Operational Technology) je hardver i softver koji upravlja fizičkim procesima. **ICS** (Industrial Control System) je širi pojam za sisteme upravljanja u industriji, a **SCADA** (Supervisory Control and Data Acquisition) je vrsta ICS-a za nadzor geografski raspoređenih postrojenja (vodovod, elektromreža, gasovod). Komponente: **PLC** (programabilni kontroler), **RTU**, **HMI** (operatorski ekran), historian.

| | IT | OT |
|---|---|---|
| Prioritet | Povjerljivost (CIA) | **Dostupnost i bezbjednost ljudi** (AIC) |
| Životni vijek | 3–5 godina | 15–30 godina |
| Zakrpe | Mjesečno | Rijetko, uz gašenje pogona i certifikaciju proizvođača |
| Protokoli | TCP/IP, TLS | Modbus, DNP3, S7, BACnet: često bez autentikacije |
| Aktivno skeniranje | Uobičajeno | Rizično, može oboriti PLC |

Zaštita: **segmentacija** po Purdue modelu i IEC 62443 zonama i kanalima, **jednosmjerni gateway** (data diode), DMZ između IT i OT, **pasivno** praćenje mreže (IDS koji razumije industrijske protokole), strogo kontrolisan udaljeni pristup proizvođača.

> **Na ispitu:** Za OT/ICS/SCADA tačan odgovor gotovo nikad nije „odmah instaliraj zakrpu“ ili „pokreni aktivno skeniranje“. Biraj **segmentaciju, pasivni monitoring i kompenzacione kontrole**, jer je dostupnost procesa najvažnija.

## Povezivanje: šta pitati o novoj arhitekturi

Kad dobiješ novi sistem na nadzor, analitičarska kontrolna lista:

1. Koje logove proizvodi i da li su uključeni (konfiguracija)?
2. Kako stižu do SIEM-a i da li se parsiraju (ingestion)?
3. Da li je vrijeme sinhronizovano (NTP, UTC)?
4. Ko može obrisati ili izmijeniti logove (integritet)?
5. Koliko dugo se čuvaju i da li to zadovoljava regulativu (retencija)?
6. Kako se autentikuju ljudi i servisi (IAM, PAM, tajne)?
7. Gdje su osjetljivi podaci i kako su zaštićeni (enkripcija, DLP)?

## Rezime

- Put loga: izvor → prikupljanje → parsiranje → obogaćivanje → skladištenje → korelacija. Najviše dokaza se izgubi na **konfiguraciji** izvora i **parsiranju**.
- **Integritet** logova: centralizacija u realnom vremenu, odvojen nalog, WORM, validacija hashovima. Event 1102 i `StopLogging` su indikatori.
- **NTP i UTC** su preduslov korelacije; razlikuj event time i ingest time.
- **Retencija** se određuje regulativom (PCI DSS 12 mjeseci, 3 odmah dostupna), operativnim potrebama i troškom, uz gornju granicu zbog privatnosti.
- Poznaj **kritične fajlove** (`/etc/shadow`, `authorized_keys`, SAM, Run ključevi) i **normalno stablo procesa** (`services.exe` → `svchost.exe`, `wininit.exe` → `lsass.exe`).
- Kontejneri i serverless smanjuju forenziku hosta: dokaze šalji van odmah, oslanjaj se na runtime i audit logove.
- **ZTNA** = pristup po aplikaciji nakon provjere; **SASE** = SD-WAN + SWG + CASB + ZTNA + FWaaS iz clouda.
- **PAM** (JIT, vault, snimanje sesija) za ljudske privilegije; **secrets management** (Vault, rotacija, workload identity) za mašinske.
- Enkripcija u prenosu skriva sadržaj, pa SOC koristi metapodatke ili TLS inspekciju.
- **OT/ICS/SCADA**: dostupnost prije svega, segmentacija i pasivni monitoring umjesto agresivnog skeniranja i brzog patchovanja.
