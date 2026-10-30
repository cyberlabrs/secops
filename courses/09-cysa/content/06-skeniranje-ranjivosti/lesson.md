## Ciljevi ispita: 2.1

- **2.1** Given a scenario, implement the appropriate vulnerability scanning method: od inventara imovine i planiranja skeniranja, preko izbora tipa skena (internal/external, agent/agentless, credentialed/non-credentialed, passive/active), do discovery skeniranja i provjere usklađenosti sa baseline standardima (PCI DSS, CIS, ISO 27000).

Domen 2 (Vulnerability Management) nosi **26%** ispita. Cilj 2.1 je scenarijski: dobićeš opis okruženja (OT mreža, PCI segment, cloud, laptopovi van mreže) i treba da izabereš metodu koja daje tačne rezultate, ne ruši produkciju i zadovoljava regulativu.

U Security+ kursu (modul 4) si naučio šta je ranjivost, a u DevSecOps kursu skenirao si slike Trivy-jem i zavisnosti osv-scannerom. CySA+ to gleda iz ugla analitičara koji vodi **program** skeniranja: šta skeniramo, kada, kojim pristupom i kako znamo da je pokrivenost potpuna.

## Životni ciklus upravljanja ranjivostima

Skeniranje je samo jedna faza. CompTIA pitanja često traže da prepoznaš u kojoj si fazi:

| Faza | Šta radiš | Primjer |
|---|---|---|
| **Asset inventory / discovery** | Saznaj šta postoji | CMDB, discovery sken, cloud API inventar |
| **Planning** | Opseg, raspored, dozvole, uticaj | Prozor skeniranja u 02:00, izuzeti krhki PLC |
| **Scanning** | Pokreni odgovarajući tip skena | Credentialed sken Windows servera |
| **Analysis** | Validiraj nalaze, ukloni false positive | Provjeri backportovan patch na Debianu |
| **Prioritization** | Rangiraj po riziku | CVSS + EPSS + KEV + vrijednost imovine (modul 7) |
| **Remediation / mitigation** | Patch, konfiguracija, kompenzaciona kontrola | Ažuriranje OpenSSL-a, WAF pravilo |
| **Validation** | Ponovni sken potvrđuje ispravku | Rescan pokazuje da nalaz više ne postoji |
| **Reporting** | Metrike, trendovi, SLA | Mean time to remediate po kritičnosti (modul 11) |

> **Na ispitu:** ako pitanje pita šta uraditi **FIRST** prije pokretanja programa skeniranja, odgovor je gotovo uvijek **asset inventory** (ne možeš zaštititi ono za šta ne znaš), a odmah zatim definisanje opsega i odobrenja (**scope / authorization**).

## Asset inventory

**Asset inventory** je temelj: skener bez inventara ne zna da li je pokrio 60% ili 100% okruženja. Izvori inventara:

- **CMDB** (Configuration Management Database) i ITSM alati: službeni popis, ali često zastario.
- **Discovery skenovi** (ping sweep, ARP, nmap): pronalaze i ono što niko nije upisao (shadow IT, zaboravljeni serveri).
- **Cloud API**: AWS Config, `aws ec2 describe-instances`, Azure Resource Graph. Kao u AWS Security kursu: Config pravila i Security Hub daju inventar i nalaze po nalogu i regiji.
- **EDR/MDM agenti**: Defender for Endpoint, Intune, Wazuh agent (detection lab) prijavljuju instalirani softver.
- **Pasivni monitoring**: DHCP logovi, NetFlow, Zeek `conn.log` otkrivaju uređaje koji govore na mreži.
- **SBOM**: inventar komponenti unutar softvera (modul 8).

Svaka stavka inventara treba da ima: vlasnika (**asset owner**), kritičnost (**asset criticality / value**), klasifikaciju podataka, lokaciju (internet-facing, interno, izolovano) i operativni status. Ti atributi kasnije direktno ulaze u prioritizaciju (cilj 2.3, „asset value“ i „context awareness“).

> **Na ispitu:** razlika između broja hostova u CMDB-u i broja hostova koje je otkrio discovery sken je nalaz sam po sebi: **neupravljani (unmanaged) ili rogue sistemi**. Ispravna reakcija je dodati ih u inventar, pronaći vlasnika i uključiti ih u skeniranje, a ne samo ignorisati.

## Planiranje skeniranja (planning considerations)

CompTIA navodi šest stvari o kojima se razmišlja prije skeniranja:

| Razmatranje | Pitanje koje postavljaš | Tipična odluka |
|---|---|---|
| **Scheduling** | Kada i koliko često? | Van radnog vremena, u maintenance window; kontinuirano za agente; nakon svake promjene; PCI traži kvartalno |
| **Operations** | Da li sken ometa poslovanje? | Koordinacija sa vlasnicima sistema i NOC-om, change ticket, kontakt za hitno zaustavljanje |
| **Performance** | Koliko opterećuje mrežu i hostove? | Ograničiti paralelnost i brzinu (throttling), agenti umjesto mrežnog skena preko WAN-a |
| **Sensitivity levels** | Koliko je agresivan sken? | Safe checks, bez DoS testova; isključiti „dangerous plugins“ na produkciji |
| **Segmentation** | Može li skener uopšte doći do cilja? | Skener u svakom segmentu ili pravila firewalla za IP skenera; posebni skeneri za OT i PCI CDE |
| **Regulatory requirements** | Šta propisi traže? | PCI DSS: interni i eksterni sken kvartalno i nakon značajne promjene, eksterni od ASV-a |

### Sensitivity levels

**Sensitivity level** (kod Nessusa/OpenVAS-a „scan policy“ ili „scan config“) određuje koliko testova i kojih vrsta se izvršava:

- **Discovery / host enumeration**: samo da li host postoji i koji portovi su otvoreni.
- **Safe / non-intrusive**: provjere verzija i konfiguracije, bez slanja payloada koji mogu srušiti servis.
- **Full / intrusive**: uključuje provjere koje pokušavaju stvarno pokrenuti ranjivost ili DoS. Samo uz izričito odobrenje i u test okruženju.

Stari ICS/SCADA uređaji, štampači i medicinski uređaji znaju pasti već od agresivnog TCP skena. Za njih se bira pasivni monitoring ili vrlo blag sken u dogovorenom prozoru.

> **Na ispitu:** scenarij „nakon skeniranja PLC u fabrici se restartovao“ ili „bolnički uređaj je prestao da radi“ traži odgovor **passive scanning** ili smanjenu osjetljivost skena (safe checks, throttling) uz koordinaciju sa vlasnikom, a ne „isključi skeniranje“ niti „skeniraj češće“.

### Segmentacija i pozicija skenera

Ako firewall između skenera i cilja propušta samo port 443, sken će prijaviti da je host „čist“, što je **false negative**. Rješenja: postaviti **scanner appliance** u svaki segment, dozvoliti IP adresu skenera na firewallu (i to dokumentovati), ili koristiti agente. U AWS-u: Amazon Inspector koristi SSM agenta i ne zavisi od Security Grupa, kao što si vidio u AWS kursu.

## Tipovi skeniranja

### Internal vs. external

| | **Internal** | **External** |
|---|---|---|
| Pozicija skenera | Unutar mreže (iza perimetra) | Sa interneta, izvan perimetra |
| Šta vidi | Sve interne servise, lateralnu površinu | Samo ono što je izloženo internetu |
| Simulira | Insidera ili napadača koji je već unutra | Vanjskog napadača |
| PCI DSS | Interni sken kvartalno (req. 11.3.1) | Eksterni sken kvartalno od **ASV** (Approved Scanning Vendor) (req. 11.3.2) |

### Agent vs. agentless

| | **Agent-based** | **Agentless** |
|---|---|---|
| Kako radi | Softver na hostu prikuplja podatke lokalno i šalje ih serveru | Skener se spaja mrežom (SSH, WinRM, SMB, SNMP, API) |
| Prednosti | Radi za laptopove van mreže, nema mrežnog opterećenja, kontinuirano | Nema instalacije, pokriva uređaje gdje agent ne može (mrežna oprema, appliance, IoT) |
| Mane | Instalacija i održavanje, potrošnja resursa, ne radi na appliance-ima | Treba mrežni pristup i kredencijale, opterećuje mrežu, samo u terminu skena |
| Primjeri | Nessus Agent, Qualys Cloud Agent, Amazon Inspector (SSM), Defender Vulnerability Management | Nessus/OpenVAS mrežni sken, cloud API skeneri (Prowler, ScoutSuite) |

> **Na ispitu:** „zaposleni rade od kuće, laptopovi se rijetko spajaju na VPN, a skener ih nikad ne zatiče na mreži“ traži **agent-based** skeniranje. „Mrežni uređaji i appliance na koje se ne može instalirati softver“ traže **agentless**.

### Credentialed vs. non-credentialed

**Credentialed** (authenticated) sken se prijavljuje na host (SSH ključ, Windows domenski servisni nalog, SNMPv3) i čita instalirane pakete, verzije, registry i konfiguraciju. **Non-credentialed** vidi samo ono što host otkriva preko mreže (banneri, odgovori servisa).

| | Credentialed | Non-credentialed |
|---|---|---|
| Tačnost | Visoka: zna tačnu verziju paketa, uključujući backportovane zakrpe | Niža: nagađa po bannerima, više false positive i false negative |
| Perspektiva | Kao administrator (insider) | Kao napadač bez pristupa |
| Pokriva | Lokalne ranjivosti (kernel, klijentski softver, browser), konfiguraciju, missing patches | Samo mrežno izložene servise |
| Rizik | Kredencijali skenera su vrijedna meta: least privilege, vault, rotacija | Nema kredencijala za zaštitu |

Najbolja praksa za kredencijale skenera: poseban nalog samo za skeniranje, minimalna prava koja su dovoljna (na Linuxu često sudo za čitanje paketa), čuvanje u vaultu skenera ili PAM-u, praćenje prijava tog naloga u SIEM-u (neuobičajena prijava sa IP-a koji nije skener je alarm).

> **Na ispitu:** „sken prijavljuje ranjivu verziju OpenSSH-a, ali admin tvrdi da je server potpuno ažuriran“: tipičan false positive non-credentialed skena na distribuciji koja backportuje zakrpe (Debian, RHEL). Rješenje je **credentialed scan**, a ne ručno brisanje nalaza.

### Passive vs. active

- **Active scanning** šalje pakete i zahtjeve ciljevima (nmap, Nessus). Brz i potpun, ali stvara saobraćaj i može uticati na krhke sisteme.
- **Passive scanning** samo sluša saobraćaj (SPAN port, TAP) i zaključuje koji uređaji, OS-ovi i verzije postoje. Primjeri: Zeek, p0f, Tenable Nessus Network Monitor, OT alati poput Nozomi ili Claroty. Ne opterećuje sisteme, ali vidi samo ono što komunicira.

Primjer pasivnog uvida iz pcap-a (u labu skeniraš i snimaš samo vlastite servise na 127.0.0.1):

```
$ tshark -r capture.pcap -Y 'http.server' -T fields -e ip.src -e tcp.srcport -e http.server | sort -u
127.0.0.1	8080	SimpleHTTP/0.6 Python/3.11.2
```

Bez ijednog dodatnog paketa prema serveru saznali smo servis i verziju, samo iz odgovora koji su ionako prošli mrežom.

## Discovery skeniranje

### Mapping scans

**Mapping scan** (network mapping) otkriva koji hostovi postoje i kako je mreža složena: živi hostovi, podmreže, putanje. Alati: nmap ping sweep (`-sn`), Angry IP Scanner, Masscan za ogromne opsege (modul 7). Rezultat se poredi sa inventarom.

```
$ nmap -sn 127.0.0.1/30
Starting Nmap 7.93 ( https://nmap.org ) at 2026-10-16 09:12 UTC
Nmap scan report for localhost (127.0.0.1)
Host is up.
Nmap scan report for 127.0.0.2
Host is up.
Nmap scan report for 127.0.0.3
Host is up.
Nmap done: 4 IP addresses (3 hosts up) scanned in 0.03 seconds
```

(Cijeli 127.0.0.0/8 opseg odgovara lokalno, pa ovo služi samo kao demonstracija formata. U pravoj mreži `-sn` koristi ARP na lokalnom segmentu i ICMP/TCP probe prema udaljenim.)

### Device fingerprinting

**Device fingerprinting** utvrđuje šta je uređaj: OS, tip, verziju servisa. Tehnike:

- **Banner grabbing** i **service version detection** (`nmap -sV`).
- **OS fingerprinting** (`nmap -O`): analiza TCP/IP steka (TTL, veličina prozora, TCP opcije).
- Pasivni fingerprinting: p0f, JA3/JA4 hash TLS klijenta, DHCP fingerprint.

```
$ python3 -m http.server 8080 &
$ nmap -sV -p 1-10000 127.0.0.1
Starting Nmap 7.93 ( https://nmap.org ) at 2026-10-16 09:15 UTC
Nmap scan report for localhost (127.0.0.1)
Host is up (0.000060s latency).
Not shown: 9999 closed tcp ports (reset)
PORT     STATE SERVICE VERSION
8080/tcp open  http    SimpleHTTPServer 0.6 (Python 3.11.2)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.51 seconds
```

Tumačenje stanja portova kod nmapa:

| Stanje | Značenje | Šta zaključuješ |
|---|---|---|
| `open` | Aplikacija prihvata konekcije | Servis je dostupan, provjeri da li treba da bude |
| `closed` | Host odgovara (RST), ali niko ne sluša | Host je živ, port nije u upotrebi |
| `filtered` | Nema odgovora ili ICMP unreachable | Firewall ili ACL između skenera i cilja |
| `open\|filtered` | Ne može se razlikovati (UDP, FIN sken) | Potrebna dodatna provjera |

> **Na ispitu:** mnogo `filtered` portova u rezultatu znači da skener **ne vidi** cilj kroz firewall. Za tačan sken treba promijeniti poziciju skenera ili pravila, inače rezultat daje lažni osjećaj sigurnosti (false negative).

Za izvještaje i automatizaciju koristi se XML izlaz:

```
$ nmap -sV -p 8080 -oX scan.xml 127.0.0.1 >/dev/null
$ grep -o '<service [^>]*>' scan.xml
<service name="http" product="SimpleHTTPServer" version="0.6" extrainfo="Python 3.11.2" method="probed" conf="10"/>
```

Polje `method="probed" conf="10"` kaže da je verzija utvrđena aktivnom probom, a ne nagađanjem po broju porta (`method="table" conf="3"`).

## Security baseline scanning

**Baseline (configuration compliance) scanning** ne traži CVE-ove, nego odstupanja od propisane sigurne konfiguracije. Pitanje nije „ima li bug“, nego „da li je sistem podešen kako politika kaže“.

| Standard | Šta je | Šta se skenira |
|---|---|---|
| **PCI DSS** (Payment Card Industry Data Security Standard, v4.0.1) | Ugovorni standard kartičnih kuća za sve koji obrađuju podatke o karticama | Req. 11.3: interni i eksterni sken kvartalno i nakon značajnih promjena; eksterni sken obavlja ASV; ponovni sken dok se ne riješe high-risk/kritični nalazi. Req. 2.2: sigurne konfiguracije sistema |
| **CIS Benchmarks** | Besplatni konsenzus-vodiči za hardening (OS, cloud, Kubernetes, baze) sa nivoima Level 1 i Level 2 | Lozinke, servisi, audit, dozvole; alati: CIS-CAT, Nessus/OpenVAS compliance politike, kube-bench (CKS kurs), Prowler (CIS AWS Foundations) |
| **ISO 27000 serija** (ISO/IEC 27001 i 27002) | Međunarodni standard za ISMS; 27001 Annex A kontrole, 27002 smjernice za njih | Kontrola 8.8 „Management of technical vulnerabilities“ traži proces identifikacije i ublažavanja ranjivosti; 8.9 „Configuration management“ |

Primjer izvještaja baseline skena (format kakav daju CIS-CAT i compliance politike skenera):

```
CIS Debian Linux 12 Benchmark v1.1.0 - Level 1 Server
[PASS] 1.1.2.1  Ensure /tmp is a separate partition
[FAIL] 5.2.7    Ensure sshd PermitRootLogin is disabled        (found: PermitRootLogin yes)
[FAIL] 5.2.10   Ensure sshd MaxAuthTries is set to 4 or less   (found: 6)
[PASS] 6.1.1    Ensure permissions on /etc/passwd are configured
Score: 187/214 (87%)
```

Isto si radio u CKS kursu sa kube-bench (CIS Kubernetes Benchmark) i u Linux hardening modulu temelja. U SCAP svijetu isti posao rade **OpenSCAP** i XCCDF profili.

> **Na ispitu:** ako scenarij spominje kartične podatke i kvartalne skenove, misli na **PCI DSS** (i ASV za eksterni sken). Ako traži „preskriptivne smjernice za hardening konkretnog OS-a“, odgovor je **CIS Benchmark**. Ako govori o ISMS-u i certifikaciji organizacije, to je **ISO 27001**.

## Specijalna okruženja

| Okruženje | Izazov | Pristup |
|---|---|---|
| **OT / ICS / SCADA** | Krhki uređaji, dostupnost ispred svega, stari protokoli (Modbus, DNP3) | Pasivni monitoring, skeniranje samo u planiranim zastojima, vendor-odobreni alati |
| **Cloud (IaaS)** | Efemerni resursi, dijeljena odgovornost, pravila provajdera | Agenti (Inspector, Defender for Cloud), CSPM/API skeneri (Prowler, ScoutSuite), skeniranje slika u registryju |
| **Kontejneri i Kubernetes** | Kratak život, nepromjenljive slike | Skeniranje slike u CI i registryju (Trivy), admission kontrola (CKS kurs), runtime (Falco) |
| **IoT i medicinski uređaji** | Nema agenta, ograničeni resursi, sertifikacija uređaja | Pasivno, segmentacija, kompenzacione kontrole |
| **Mobilni i udaljeni korisnici** | Rijetko na mreži | Agenti, MDM izvještaji |
| **Web aplikacije** | Ranjivosti u logici, ne u verziji paketa | DAST (ZAP, Burp), SAST u CI (modul 8) |

Za cloud vrijedi i pitanje dozvole: AWS, Azure i GCP danas dozvoljavaju skeniranje vlastitih resursa za većinu servisa bez prethodnog odobrenja, ali zabranjuju DoS testove i skeniranje infrastrukture provajdera. SaaS (npr. Microsoft 365) ne skeniraš ti, nego provjeravaš konfiguraciju kroz API (SSPM).

## Lab primjeri: skeniranje sa vlastitim alatima

Trivy za sliku ili fajl sistem (isti alat kao u DevSecOps kursu, ovdje ga gledamo kao izvor nalaza za program upravljanja ranjivostima):

```
$ trivy fs --scanners vuln --severity MEDIUM,HIGH,CRITICAL /opt/app
2026-10-16T09:20:11Z	INFO	Number of language-specific files	num=1

requirements.txt (pip)
Total: 2 (MEDIUM: 1, CRITICAL: 1)

┌──────────┬────────────────┬──────────┬────────┬───────────────────┬───────────────┬──────────────────────────────────┐
│ Library  │ Vulnerability  │ Severity │ Status │ Installed Version │ Fixed Version │              Title               │
├──────────┼────────────────┼──────────┼────────┼───────────────────┼───────────────┼──────────────────────────────────┤
│ jinja2   │ CVE-2024-22195 │ MEDIUM   │ fixed  │ 2.11.3            │ 3.1.3         │ jinja2: HTML attribute injection │
│ pyyaml   │ CVE-2020-14343 │ CRITICAL │ fixed  │ 5.3.1             │ 5.4           │ PyYAML: incomplete fix for ...   │
└──────────┴────────────────┴──────────┴────────┴───────────────────┴───────────────┴──────────────────────────────────┘
```

osv-scanner za lockfile, sa provjerom prema OSV bazi (u labu bez mreže radi sa lokalnom bazom ako je pripremljena):

```
$ osv-scanner scan source --lockfile requirements.txt
╭─────────────────────────────────────┬──────┬───────────┬─────────┬─────────┬──────────────────╮
│ OSV URL                             │ CVSS │ ECOSYSTEM │ PACKAGE │ VERSION │ SOURCE           │
├─────────────────────────────────────┼──────┼───────────┼─────────┼─────────┼──────────────────┤
│ https://osv.dev/GHSA-8q59-q68h-6hv4 │ 9.8  │ PyPI      │ pyyaml  │ 5.3.1   │ requirements.txt │
╰─────────────────────────────────────┴──────┴───────────┴─────────┴─────────┴──────────────────╯
```

Ovo su **agentless, credentialed-ekvivalentni** nalazi: alat čita stvarne verzije paketa, pa je tačnost visoka. Mrežni sken istog hosta (nmap) vidi samo port 8080 i ne zna ništa o PyYAML-u.

## Ograničenja i greške u skeniranju

| Problem | Posljedica | Lijek |
|---|---|---|
| Nepotpun inventar | Neskenirani hostovi (false negative na nivou programa) | Discovery + CMDB usklađivanje |
| Firewall/IPS blokira skener | Filtered portovi, nedostaju nalazi | Pozicija skenera, whitelist IP-a skenera (dokumentovano), agenti |
| Non-credentialed sken | Nagađanje po banneru | Credentialed sken |
| Zastarjeli plugin feed | Novi CVE-ovi nisu provjereni | Automatsko ažuriranje feeda prije skena |
| Agresivna politika na produkciji | Pad servisa | Safe checks, prozor održavanja, test okruženje |
| Sken samo jednom godišnje | Dugo izloženo vrijeme | Kontinuirano skeniranje (agenti), nakon promjena |
| IDS/EDR alarm na sken | Šum u SOC-u, zatrpavanje analitičara | Najava skena, tuning pravila za IP skenera (uz nadzor da se ne zloupotrijebi) |

> **Na ispitu:** pitanja tipa „analitičar je dobio izvještaj bez ijednog nalaza za cijeli DMZ segment“ traže da posumnjaš u **pokrivenost** (firewall, pogrešan opseg, istekli kredencijali skenera), a ne da zaključiš da je segment siguran.

## Brzi vodič za izbor metode

| Scenarij | Najbolji izbor |
|---|---|
| Laptopovi koji su rijetko u kancelariji | Agent-based |
| Ruteri, switchevi, firewall appliance | Agentless (SNMPv3/SSH credentialed) |
| Tačna lista nedostajućih zakrpa na serverima | Credentialed |
| Kako nas vidi napadač sa interneta | External, non-credentialed |
| Kvartalni zahtjev za kartične sisteme | PCI DSS: interni + eksterni (ASV) |
| Krhki PLC i HMI u fabrici | Passive |
| Šta uopšte postoji u novoj, preuzetoj mreži | Discovery (mapping + fingerprinting) |
| Usklađenost sa hardening smjernicama | Baseline sken (CIS Benchmark, SCAP) |
| Kontejnerske slike prije deploya | Skeniranje u CI/registryju (Trivy) |

## Primjer plana skeniranja

Kako izgleda dokumentovan plan za srednju organizaciju (ovakvu tabelu PBQ zna dati, pa traži da upariš sistem sa metodom):

| Grupa imovine | Metoda | Učestalost | Napomena |
|---|---|---|---|
| Javni web i VPN gateway | External, non-credentialed + ASV | Sedmično + kvartalno ASV | Prvi kandidati za KEV nalaze |
| Windows i Linux serveri | Internal, credentialed, agentless | Sedmično, noću | Servisni nalog iz vaulta |
| Laptopovi | Agent-based | Kontinuirano | Izvještaj čim se uređaj javi |
| Mrežna oprema | Agentless, SNMPv3/SSH | Mjesečno | Safe checks |
| PCI CDE segment | Internal + external, baseline PCI DSS | Kvartalno i nakon značajne promjene | Skener unutar segmenta |
| OT mreža | Passive (SPAN) | Kontinuirano | Aktivni sken samo u planiranom zastoju |
| Kontejnerske slike | Trivy u CI i registryju | Svaki build + dnevni rescan | Novi CVE-ovi za staru sliku |
| Cloud nalozi | API/CSPM (Prowler, ScoutSuite) | Dnevno | CIS AWS Foundations |

Svaki red ima i vlasnika, kontakt za hitno zaustavljanje skena i rok za ispravku po kritičnosti (SLO, modul 8).

### Odobrenje i pravila angažmana

Skeniranje bez pismenog odobrenja vlasnika sistema je i organizacioni i pravni problem. Plan zato sadrži:

- **Scope**: tačni IP opsezi, domeni i cloud nalozi, uz izričito navedene izuzetke.
- **Authorization**: potpis vlasnika imovine i sigurnosnog menadžmenta; za treće strane (hosting, MSP, SaaS) njihovo odobrenje ili njihova pravila.
- **Komunikacija**: SOC i NOC znaju IP skenera i termin, da sken ne bi pokrenuo incident (ili, gore, da pravi napad ne bi bio otpisan kao „to je samo skener“).
- **Rukovanje rezultatima**: izvještaji o ranjivostima su osjetljivi podaci (mapa slabih tačaka), pa se čuvaju sa ograničenim pristupom.

> **Na ispitu:** ako SOC vidi skeniranje sa IP adrese koja **nije** dokumentovani skener, ili u terminu van plana, to se tretira kao potencijalni reconnaissance i istražuje, čak i kad liči na rutinski Nessus sken.

## Rezime

- Program skeniranja počinje **asset inventoryjem**: vlasnik, kritičnost, lokacija i klasifikacija podataka svakog sistema kasnije određuju prioritet.
- Planiranje uključuje **scheduling, operations, performance, sensitivity levels, segmentation i regulatory requirements**; najveći rizik je srušiti produkciju ili dobiti lažno čist izvještaj.
- **Internal** vidi kao insider, **external** kao napadač sa interneta; PCI DSS traži oba, kvartalno, eksterni preko ASV-a.
- **Agent** je za udaljene i mobilne hostove i kontinuirano praćenje; **agentless** za uređaje bez mogućnosti instalacije.
- **Credentialed** sken je tačniji i smanjuje false positive (backport) i false negative (lokalne ranjivosti); kredencijale skenera štiti kao privilegovani nalog.
- **Passive** skeniranje je za OT, medicinske i krhke uređaje; **active** je brže i potpunije.
- **Discovery**: mapping scans (ko postoji) i device fingerprinting (šta je to i koja verzija); `filtered` portovi znače da skener ne vidi cilj.
- **Baseline scanning** provjerava konfiguraciju prema **PCI DSS**, **CIS Benchmarks** i **ISO 27000** zahtjevima, ne traži CVE-ove.
