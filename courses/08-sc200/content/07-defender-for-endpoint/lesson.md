## Ciljevi ispita: 2.2

Domen 2 (**Respond to security incidents**) nosi 35–40% ispita. Ovaj modul pokriva cilj **2.2 Respond to alerts and incidents in Microsoft Defender for Endpoint** u cijelosti:

- **Investigate device timelines** – hronologija događaja na uređaju, MITRE tehnike, flagovi, izvoz,
- **Perform actions on the device, including live response and collecting investigation packages** – izolacija, containment, restrict app execution, AV scan, live response, investigation package,
- **Perform evidence and entity investigation** – stranice entiteta (fajl, proces, IP, URL, korisnik), evidence i verdikti, Action center,
- **Investigate and remediate incidents identified by automatic attack disruption** – kako prepoznati disrupted incident, šta je urađeno automatski i kako se akcija vraća.

Konfiguracija Defender for Endpointa (advanced features, device groups, automation levels, ASR) je cilj 1.1 i obrađena je u modulu 06. Ovdje je fokus na analitičaru koji ima otvoren alarm i treba da odluči šta dalje.

Na ispitu su pitanja iz ovog cilja skoro uvijek scenarij: „Uređaj X ima alarm… Trebate prikupiti dokaze **bez prekida rada korisnika** / **što prije spriječiti lateralno kretanje** / sa **NAJMANJE administrativnog napora**. Šta trebate uraditi?“ Ključ je znati tačno šta svaka akcija radi i šta ne radi.

## Gdje se radi u Defender portalu

Sve što slijedi radi se u **Microsoft Defender portalu** (`security.microsoft.com`). Najvažnije putanje:

| Šta | Putanja |
|---|---|
| Lista uređaja | **Assets** > **Devices** (device inventory) |
| Stranica uređaja | klik na ime uređaja iz inventara, alarma ili incidenta |
| Incidenti i alarmi | **Investigation & response** > **Incidents & alerts** > **Incidents** / **Alerts** |
| Action center | **Actions & submissions** > **Action center** (tabovi **Pending** i **History**) |
| Live response biblioteka | **Settings** > **Endpoints** > **Library management** (ili iz same sesije) |
| Uključivanje live responsea | **Settings** > **Endpoints** > **Advanced features** |
| Advanced hunting | **Investigation & response** > **Hunting** > **Advanced hunting** |

Stranicu uređaja otvaraš iz više mjesta: inventar, red alarma, graf incidenta, globalna pretraga (ime ili IP), stranica fajla („uređaji na kojima je fajl viđen“) i stranica IP adrese ili domena.

## Stranica uređaja

Na vrhu stranice uređaja je red **response akcija**, ispod su kartice i tabovi:

| Dio stranice | Šta prikazuje |
|---|---|
| **Overview** | kartice **Active alerts**, **Logged on users** (zadnjih 30 dana, najčešći i najrjeđi korisnik), **Security assessments** (exposure level), **Device health status** |
| **Incidents and alerts** | filtrirani red alarma za taj uređaj (severity, status, klasifikacija, investigation state) |
| **Timeline** | hronologija događaja i alarma (detalji u nastavku) |
| **Security recommendations** | preporuke iz Defender Vulnerability Managementa |
| **Software inventory**, **Discovered vulnerabilities**, **Missing KBs** | softver, CVE, nedostajuće zakrpe |
| **Security policies**, **Effective settings** | endpoint security politike i stvarna vrijednost svake postavke (AV, ASR, isključenja) sa izvorom (Intune, GPO, MDE) |

Ako je za uređaj već prikupljen investigation package, u **Device details** sekciji je link za preuzimanje.

> **Na ispitu:** „Korisnik tvrdi da ASR pravilo nije aktivno na njegovom uređaju, iako ga Intune politika uključuje. Gdje najbrže vidite koja postavka stvarno važi i ko ju je postavio?“ – tab **Effective settings** na stranici uređaja. Prikazuje stvarnu vrijednost, izvor (Intune, Group Policy, MDE) i pokušaje konfiguracije koji nisu prošli.

## Device timeline

**Timeline** tab prikazuje hronološki sve događaje i alarme koje je senzor vidio na uređaju: procese, fajlove, mrežne konekcije, registry, prijave, AV detekcije, ali i response akcije (npr. „scan action submitted“ ili izolacija).

### Ključne mogućnosti

| Mogućnost | Kako se koristi |
|---|---|
| **Vremenski opseg** | podrazumijevano zadnjih **30 dana**; izbor dan, sedmica, 30 dana ili **custom range** (kalendar gore lijevo) |
| **Search** | traka za pretragu po događajima (ime fajla, komandna linija, IP) |
| **Filters** | po tipu podataka (**Events** / **Techniques**), grupi događaja, **Flagged events**, korisniku |
| **Process tree** | klik na događaj otvara bočni panel sa stablom roditelj–dijete procesa |
| **MITRE ATT&CK techniques** | tehnike su **boldovane sa plavom ikonom**; ID i naziv tehnike su tagovi u **Additional information** |
| **Flag events** | ikona zastavice pored događaja; kasnije filter **Flagged events** pravi „čistu“ hronologiju napada |
| **Hunt for related events** | iz panela događaja otvara advanced hunting sa upitom za događaje oko istog vremena na istom uređaju |
| **Export** | izvoz detaljnih događaja za izabrani dan ili raspon **do 7 dana** |
| **Customize columns** | izbor kolona koje se prikazuju |

U **Additional information** koloni vidiš oznake kao što su *Active threat detected*, *Remediation successful/unsuccessful*, *Warning bypassed by user* (SmartScreen upozorenje je zaobiđeno), *Suspicious script detected* i kategoriju alarma (npr. **Lateral Movement**) ako je događaj generisao alarm.

Napomena za firewall događaje (5025, 5031, 5157): pojavljuju se u timelineu samo ako je uključena audit politika **Audit Filtering Platform Connection**.

Ako EDR klijent (`MsSense.exe`) ostane bez resursa, prelazi u **critical mode** i ne obrađuje nove događaje; u timelineu se pojavljuje događaj o tome. To je bitno kad u hronologiji vidiš „rupu“.

### Tipičan tok istrage kroz timeline

1. Otvori alarm i sa njega stranicu uređaja, tab **Timeline**.
2. Postavi **custom range** oko vremena alarma (npr. sat prije i poslije).
3. Filtriraj na **Techniques** da vidiš MITRE tehnike koje je Defender prepoznao.
4. Za sumnjiv proces otvori **process tree** i provjeri roditelja (npr. `winword.exe` > `powershell.exe`).
5. **Flaguj** važne događaje (početni vektor, perzistencija, C2 konekcija).
6. Uključi filter **Flagged events** i izvezi hronologiju za izvještaj.
7. Za širi kontekst klikni **Hunt for related events** i nastavi u advanced huntingu.

### Isti podaci u advanced huntingu

Timeline je vizuelni prikaz istih tabela koje koristiš u KQL-u. Kad trebaš pogledati više uređaja odjednom ili duži period, pređi u advanced hunting:

```kql
// Šta je pokrenuo sumnjiv Office proces na jednom uređaju
DeviceProcessEvents
| where Timestamp between (datetime(2026-10-14 08:00) .. datetime(2026-10-14 10:00))
| where DeviceName == "ws-fin-07"
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "outlook.exe")
| project Timestamp, InitiatingProcessFileName, FileName, ProcessCommandLine, AccountName
| order by Timestamp asc
```

```kql
// Na kojim još uređajima se pojavio isti hash (opseg napada)
let badHash = "<SHA256 iz alarma>";
union DeviceProcessEvents, DeviceFileEvents
| where Timestamp > ago(30d)
| where SHA256 == badHash
| summarize FirstSeen = min(Timestamp), LastSeen = max(Timestamp), Events = count() by DeviceName
| order by FirstSeen asc
```

> **Na ispitu:** pitanje „trebate izvesti događaje sa uređaja za period od 14 dana za forenzički tim“ ima zamku: izvoz iz timelinea ide **do 7 dana** po izvozu. Rješenje su dva izvoza ili advanced hunting upit sa izvozom rezultata. Ako pitanje traži „sve događaje koji se odnose na istu MITRE tehniku“, odgovor je **Hunt for related events** iz panela tehnike.

## Response akcije na uređaju

Akcije sa stranice uređaja. Za svaku se upisuje komentar (razlog) i sve se bilježe u **Action center** i kao događaj u timelineu.

| Akcija | Šta radi | Važne napomene |
|---|---|---|
| **Isolate device** | Prekida mrežnu komunikaciju uređaja, ali zadržava vezu sa Defender for Endpoint servisom (nadzor i live response rade dalje) | **Full** ili **Selective** izolacija (selective može dozvoliti Outlook i Teams, i isključenja procesa i odredišta); potrebna uloga sa **Active remediation actions**; uređaj se vraća sa **Release from isolation** |
| **Contain device** | Svi **onboardani** uređaji blokiraju dolazni i odlazni saobraćaj prema tom uređaju | Za **neupravljane** (nisu onboardani) ili kompromitovane uređaje; ne zahtijeva agenta na samom uređaju |
| **Contain IP** | Svi onboardani uređaji blokiraju komunikaciju sa IP adresom neotkrivenog uređaja | Koristi attack disruption, a ručno se radi sa stranice IP-a |
| **Contain user** | Blokira komunikaciju i prijave sa tim korisnikom na svim onboardanim uređajima | Dio attack disruptiona i predictive shieldinga |
| **Restrict app execution** | Primjenjuje code integrity politiku: smiju se pokretati samo fajlovi potpisani **Microsoftovim** certifikatom | Traži Microsoft Defender Antivirus; vraća se sa **Remove app restrictions** |
| **Run antivirus scan** | Quick ili full scan Microsoft Defender Antivirusom | Radi i kad je MDAV u **passive mode** pored drugog AV-a |
| **Collect investigation package** | Prikuplja ZIP sa forenzičkim podacima | Preuzima se iz Action centera ili sa stranice uređaja |
| **Initiate live response session** | Udaljena ljuska na uređaju | Mora biti uključena u Advanced features |
| **Initiate automated investigation** | Pokreće AIR istragu za uređaj | Novi alarmi sa uređaja se dodaju istoj istrazi dok traje |
| **Consult a threat expert** / **Ask Defender Experts** | Pitanje Microsoftovim analitičarima | Zavisi od licence |
| **Manage tags**, **Set criticality** | Tagovi i kritičnost uređaja | Tag se koristi i za isključenja iz automatske izolacije |

Nekoliko detalja koji se pojavljuju u pitanjima:

- Izolacija čeka uređaj do **tri dana** ako je offline u trenutku akcije; poslije toga akciju treba ponoviti.
- Uređaj iza **full-tunnel VPN-a** posle izolacije ne može doći do servisa; preporuka je split tunneling za Defender saobraćaj.
- Za okruženja sa web proxyjem (PAC, WPAD) preporučena je **selective isolation**.
- Izolacija servera na Hyper-V-u blokira saobraćaj i svim njegovim VM-ovima.
- Ako izolovan uređaj prestane da odgovara, sa stranice uređaja se preuzima skripta za **forcible release** (važi samo za taj uređaj, ističe za tri dana).
- Uređaji onboardani kao **high-value assets** mogu imati ograničen skup dozvoljenih akcija (selective response actions), pa neka dugmad budu siva.

### Kada koja akcija

| Situacija | Akcija |
|---|---|
| Onboardan laptop komunicira sa C2, treba zaustaviti lateralno kretanje, a nastaviti istragu | **Isolate device** (full), pa live response |
| Isto, ali korisnik mora zadržati Teams i Outlook | **Isolate device** – **selective** |
| Neupravljan uređaj (BYOD, IoT) u mreži napada druge | **Contain device** |
| Uređaj pokreće nepoznate alate, a izolacija bi prekinula poslovni proces | **Restrict app execution** |
| Treba stanje uređaja „kakvo je sada“ (procesi, konekcije, autoruns) | **Collect investigation package** |
| Treba jedan konkretan fajl ili rezultat skripte | **Live response** (`getfile`, `run`) |

> **Na ispitu:** razlikuj **isolate** i **contain**. Isolate se radi na samom kompromitovanom uređaju i traži da je onboardan. Contain se primjenjuje preko **svih ostalih** onboardanih uređaja, pa radi i za uređaje bez agenta. Ako scenarij kaže „uređaj nije onboardan u Defender for Endpoint“, isolate nije moguć i tačan odgovor je **Contain device**.

## Investigation package

Investigation package je ZIP sa trenutnim stanjem uređaja. Pokreće se sa **Collect investigation package** na stranici uređaja, a preuzima iz **Action center** („Package collection package available“) ili linka na stranici uređaja. Prikupljanje može pasti ako je baterija niska ili je veza **metered**.

### Sadržaj za Windows

| Folder / fajl | Šta sadrži i za šta služi |
|---|---|
| **Autoruns** | sadržaj registry ključeva poznatih auto-start tačaka (ASEP) – perzistencija |
| **Installed programs** | CSV sa instaliranim programima |
| **Network connections** | `ActiveNetConnections.txt`, `Arp.txt`, `DnsCache.txt`, `IpConfig.txt`, firewall logovi (`pfirewall.log` ako postoji) – C2 i lateralno kretanje |
| **Prefetch files** | kopija `%SystemRoot%\Prefetch` i `PrefetchFilesList.txt` – tragovi pokretanih (i obrisanih) programa |
| **Processes** | CSV sa procesima koji trenutno rade |
| **Scheduled tasks** | CSV sa zakazanim zadacima |
| **Security event log** | Security event log (otvara se u Event Vieweru) |
| **Services** | CSV sa servisima i stanjem |
| **SMB sessions** | `SMBInboundSessions` i `SMBOutboundSession` – lateralno kretanje i eksfiltracija |
| **System Information** | `SystemInformation.txt` (OS, mrežne kartice) |
| **Temp Directories** | lista fajlova u `%Temp%` svakog korisnika |
| **Users and Groups** | članstvo lokalnih grupa |
| **WdSupportLogs** | `MpCmdRunLog.txt` i `MPSupportFiles.cab` |
| **CollectionSummaryReport.xls** | sažetak: koje stavke su prikupljene, komanda, status i greške |

Za **macOS i Linux** paket sadrži procese, otvorene fajlove, mrežne konekcije (aktivne, listening, ARP, firewall pravila), diskove, korisnike i grupe (istorija prijava, sudoers); na macOS-u još instalirane aplikacije, shell istoriju, kernel module i System Integrity Protection status. Na macOS-u i Linuxu paket se može prikupiti i iz live responsea komandom `collect`.

> **Na ispitu:** „Trebate utvrditi koje zakazane zadatke i auto-start unose je napadač ostavio na 20 uređaja, uz NAJMANJE napora i bez interaktivnog rada na svakom uređaju.“ – **Collect investigation package** (folderi **Autoruns** i **Scheduled tasks**). Live response je interaktivan i jedan uređaj po sesiji. Ako pitanje traži „provjeru da li su svi podaci prikupljeni“, odgovor je **CollectionSummaryReport.xls**.

## Live response

**Live response** je udaljena ljuska (cloud-based shell) na uređaju za forenziku i remedijaciju u realnom vremenu: pregled procesa i perzistencije, preuzimanje fajlova, pokretanje skripti, brisanje zlonamjernih entiteta.

### Preduslovi

- U **Settings** > **Endpoints** > **Advanced features** uključiti **Live Response**; za servere posebno **Live Response for Servers** (preporučeno). Ovo mogu admini i korisnici sa **Manage Portal Settings**.
- **Live Response unsigned script execution** je opciono i odnosi se samo na **PowerShell** skripte (provjera potpisa). Uključivanje povećava rizik.
- Korisnik mora imati ulogu sa dozvolom za **basic** ili **advanced** live response komande (RBAC custom role).
- Upload u biblioteku iz same sesije traži **Manage Security Settings**; preko stranice **Library management** ta dozvola nije potrebna.
- Podržani su Windows 10/11, Windows Server (2012 R2 i 2016 uz unified agent), macOS i Linux.

### Basic i advanced komande

| Basic (istraživanje) | Šta radi |
|---|---|
| `processes`, `services`, `drivers` | procesi, servisi, drajveri |
| `connections` | aktivne mrežne konekcije (Windows) |
| `persistence`, `scheduledtasks`, `startupfolders` | poznate metode perzistencije (Windows) |
| `registry` | vrijednosti registryja (Windows) |
| `dir`, `cd`, `findfile`, `fileinfo` | navigacija i informacije o fajlu |
| `getfile <putanja>` | preuzimanje fajla sa uređaja (do **3 GB**) |
| `jobs`, `fg <command ID>`, `status` | rad u pozadini |

| Advanced (akcije) | Šta radi |
|---|---|
| `library` | lista fajlova u biblioteci live responsea |
| `putfile` | stavlja fajl iz biblioteke na uređaj (radni folder, briše se pri restartu) |
| `run` | pokreće PowerShell (ili Bash) skriptu **iz biblioteke** |
| `remediate` | remedijacija entiteta: fajl (brisanje), proces (stop + brisanje imagea), servis, registry unos, scheduled task, startup stavka |
| `undo` | vraća remedijovan entitet (Windows) |
| `analyze` | analiza entiteta incrimination engineima (Windows) |
| `collect` | forenzički paket (macOS, Linux) |
| `isolate` / `release` | izolacija iz sesije (macOS) |
| `scan` | quick AV scan (macOS, Linux) |

Primjer sesije (komande u live response konzoli, ne PowerShell na uređaju):

```text
processes -output json > procesi.txt
persistence
scheduledtasks
getfile "C:\Users\ana\AppData\Local\Temp\upd.exe" &
fg 1234
library
run Collect-Triage.ps1 -parameters "-Days 3"
remediate file "C:\Users\ana\AppData\Local\Temp\upd.exe" -auto
```

- `&` na kraju `getfile` šalje preuzimanje u pozadinu; `fg <command ID>` ga vraća u prvi plan (ID komande, ne PID).
- `-auto` uz `remediate` automatski pokreće preduslovnu komandu.
- `Ctrl+C` prekida komandu **samo u portalu**; promjenljive akcije kao `remediate` mogu se nastaviti na agentu.
- Izlaz može biti `-output table` ili `-output json`, i preusmjeren u fajl sa `>`.
- Tab **Command log** bilježi svaku komandu (ID, komandna linija, trajanje, status).

### Ograničenja

| Ograničenje | Vrijednost |
|---|---|
| Istovremene sesije u tenantu | 50 |
| Istovremene sesije po korisniku | 5 |
| Sesije po uređaju | **1** |
| Timeout neaktivnosti sesije | 30 minuta |
| Timeout komande | 10 minuta (`getfile`, `findfile`, `run`: 30 minuta) |
| `getfile` | 3 GB |
| `fileinfo` | 30 GB |
| Fajl u biblioteci | 250 MB |
| `putfile` | Windows 300 MB, ostale platforme 10 MB |

> **Na ispitu:** „Analitičar pokušava `run Skripta.ps1`, a dobija grešku da skripta nije pronađena, iako je skripta na njegovom računaru.“ – skripta se mora prvo **uploadovati u live response biblioteku**. Ako greška kaže da skripta nije potpisana, rješenje je potpisati je ili uključiti **Live Response unsigned script execution**. Ako drugi analitičar ne može otvoriti sesiju na istom uređaju, razlog je limit od **jedne sesije po uređaju**.

## Evidence i entity istraga

### Evidence u incidentu i alarmu

Tab **Evidence and Response** u incidentu prikazuje sve entitete koje je automatska istraga (AIR) analizirala: fajlove, procese, servise, IP adrese, URL-ove, mailove, korisnike. Svaki ima:

- **Verdict**: *Malicious*, *Suspicious*, *Clean* (ili bez verdikta),
- **Remediation status**: npr. *Remediated*, *Pending approval*, *Not found*.

Za stavke sa **Pending approval** odobravaš ili odbijaš akciju direktno u tabu ili u **Action center** > **Pending**. Koliko akcija čeka odobrenje zavisi od **automation levela** device grupe (modul 06): kod *Full – remediate threats automatically* akcije se izvršavaju same, kod *Semi* čekaju odobrenje.

### Stranice entiteta

| Entitet | Šta vidiš | Ključne akcije |
|---|---|---|
| **Fajl** | prevalencija u organizaciji i svijetu, uređaji na kojima je viđen, potpis, VirusTotal detekcije, Deep analysis izvještaj | **Stop and Quarantine File**, **Add Indicator** (allow / block / audit), **Download file**, **Collect file**, **Deep analysis** (sandbox), **Submit to Microsoft** |
| **Proces** (iz timelinea/alarma) | stablo procesa, komandna linija, korisnik | zaustavljanje i karantin preko fajla |
| **IP adresa** | uređaji koji su komunicirali, geolokacija, prevalencija | **Contain IP**, indikator |
| **Domen / URL** | uređaji koji su ga posjećivali, alarmi | indikator (block) |
| **Korisnik** | alarmi, uređaji na kojima se prijavljivao, Entra i AD podaci, risk level | **Contain user**, disable, reset lozinke (preko Defender for Identity i Entra integracije) |

**Stop and Quarantine File** zaustavlja procese tog fajla i stavlja ga u karantin na **svim uređajima** gdje je viđen (ne samo na jednom). **Add Indicator** sa akcijom *Block and remediate* sprječava buduće pokretanje u cijeloj organizaciji. Razlika je bitna: prvo čisti ono što već postoji, drugo sprječava ponovno pojavljivanje.

**Deep analysis** pokreće fajl u izolovanom okruženju (sandbox) i daje izvještaj o ponašanju (mrežne konekcije, kreirani fajlovi, registry). Fajl mora biti dostupan servisu (prikupljen sa uređaja ili već poznat).

### Action center

**Actions & submissions** > **Action center** objedinjuje ručne i automatske akcije iz cijelog Defender XDR-a (uređaji, email, identiteti):

- **Pending** – akcije koje čekaju odobrenje (AIR, dvostepena odobrenja),
- **History** – izvršene akcije (sa mogućnošću **Undo** za mnoge: npr. vraćanje fajla iz karantina, release iz izolacije).

Za svaku akciju vidiš ko ju je pokrenuo (korisnik, AIR, **AttackDisruption**), kada, na kom entitetu i status.

> **Na ispitu:** „Fajl je detektovan na jednom uređaju, ali prevalencija pokazuje da postoji na još 40. Trebate ga ukloniti sa svih uređaja i spriječiti da se ponovo pokrene, uz NAJMANJE napora. Koje DVIJE akcije?“ – **Stop and Quarantine File** (čisti postojeće kopije na svim uređajima) i **Add Indicator** sa blokiranjem (sprječava buduće pokretanje). Pokretanje AV scana na 40 uređaja ili live response na svakom su previše posla.

## Automatic attack disruption

**Automatic attack disruption** je ugrađena sposobnost Defender XDR-a: korelira signale iz endpointa, identiteta, emaila i SaaS aplikacija u jedan incident visoke pouzdanosti (Microsoft navodi preciznost od 99% i više za containment akcije) i automatski **zadržava** imovinu koju napadač koristi. Konfiguracija (preduslovi, isključenja) je cilj 1.1; ovdje je bitno šta analitičar vidi i radi poslije.

### Akcije koje attack disruption može izvršiti

| Akcija | Ko izvršava | Efekat |
|---|---|---|
| **Contain device** | Defender for Endpoint | svi onboardani uređaji blokiraju komunikaciju sa uređajem |
| **Contain IP** | Defender for Endpoint | blokada IP-a neotkrivenog / neonboardanog uređaja |
| **Isolate device** | Defender for Endpoint | automatska izolacija radne stanice koja je aktivno uporište napadača (samo end-user workstations) |
| **Contain user** | Defender for Endpoint | blokada komunikacije i prijava korisnika na onboardanim uređajima |
| **Disable user** | Defender for Identity | onemogućava nalog u AD-u (preko DC-a sa MDI senzorom) i u Entra ID-u ako je sinhronizovan |
| **Revoke user session**, **Suspend user** | Microsoft Entra ID | prekid sesija, suspenzija naloga |
| **OAuth app compromise** | Defender for Cloud Apps | zaštitne mjere za kompromitovanu OAuth aplikaciju |
| **Suspend user in Okta**, **Attach deny policy to AWS user** | Sentinel konektori (preview) | akcije van Microsoftovog ekosistema |

Postoji i **predictive shielding**: preventivne mjere (npr. proaktivni contain user, GPO i Safeboot hardening) kada sistem predvidi napredovanje napada.

### Kako prepoznati disrupted incident

- U redu incidenata, tag **Attack Disruption** (uz tip prijetnje, npr. ransomware).
- Na stranici incidenta **žuta traka** ispod naslova koja opisuje automatsku akciju.
- Na grafu incidenta entiteti sa oznakom statusa (npr. *contained*, *disabled*).
- Kartica **attack disruption summary** desno: sažetak akcija, **View activities**, **View related assets**.
- Tab **Activities** sa filterom **Performed by: AttackDisruption** i kolonom **Policy status** (*Active*, *Inactive*, *Not applicable*, *No status*) – vidiš da li je containment još aktivan.
- U **Action center** > **History** akcije sa izvorom attack disruption.
- Preko API-ja, naslov incidenta završava sa „(attack disruption)“.

### Šta analitičar radi poslije

1. **Ne vraćaj odmah.** Disruption kupuje vrijeme; napadač je zaustavljen, ne uklonjen.
2. Istraži incident: attack story, alarmi, timeline uređaja, korisnikove prijave.
3. Remedijacija: reset lozinke i revoke sesija za kompromitovane naloge, uklanjanje perzistencije (live response, investigation package), karantin fajlova, blokada indikatora.
4. Tek kad je rizik uklonjen, vrati imovinu: na grafu incidenta ili stranici entiteta **Release from containment** (uređaj) ili **Enable user** (nalog); isto iz **Action center** panela akcije. Izolovan uređaj se vraća sa **Release from isolation**.
5. Klasifikuj incident (True positive, tip prijetnje) i dokumentuj.

Za isključivanje kritične imovine (npr. uređaji koji ne smiju biti izolovani, BAS testovi) koriste se **automatic attack disruption exclusions** i **policy applications and exclusions** po tagu uređaja; isključena akcija se u Action centeru pojavljuje sa statusom **Skipped**. Kritični serveri (DC, DNS, DHCP) imaju tag **critical asset** i dobijaju granularan containment koji blokira samo određene portove i smjerove.

### Hunting za disruption akcije

```kql
// Sve akcije attack disruptiona u zadnjih 30 dana (cijela organizacija)
DisruptionAndResponseEvents
| where Timestamp > ago(30d)
| project Timestamp, ActionType, AttackDisruptionCategory, DeviceName, AccountUpn, RemoteIP, IncidentId
| order by Timestamp desc
```

```kql
// Aktivnosti blokirane zbog containmenta uređaja ili korisnika
DeviceEvents
| where Timestamp > ago(7d)
| where ActionType contains "ContainedDevice" or ActionType contains "ContainedUser"
| summarize Blocks = count() by DeviceName, ActionType
| order by Blocks desc
```

`DeviceEvents` ne bilježi sam čin containmenta, nego **blokirane pokušaje** nastale zbog njega. Za pregled samih akcija koristi `DisruptionAndResponseEvents` ili tab **Activities**.

> **Na ispitu:** „Incident ima tag Attack Disruption, nalog finansijskog direktora je onemogućen i on ne može raditi. Šta trebate uraditi PRVO?“ – istražiti incident i potvrditi da je prijetnja otklonjena (reset lozinke, revoke sesija, uklanjanje perzistencije), pa tek onda **Enable user**. Odgovor „odmah omogućiti nalog iz Action centera“ je distraktor, jer vraćanje prije istrage daje napadaču pristup nazad. Ako pitanje traži gdje vidiš da li je korisnik **trenutno** još contained, odgovor je kolona **Policy status** u tabu **Activities**.

## Primjer: od alarma do zatvorenog incidenta

Scenarij: alarm „Suspicious PowerShell command line“ na `ws-fin-07`, korisnik `ana`.

| Korak | Gdje | Šta |
|---|---|---|
| 1 | Incident | pročitaj attack story, provjeri da li ima tag Attack Disruption |
| 2 | Device page > Timeline | custom range oko alarma, process tree (`outlook.exe` > `winword.exe` > `powershell.exe`), flaguj događaje |
| 3 | Fajl iz alarma | prevalencija; ako je na više uređaja – **Stop and Quarantine File** + **Add Indicator** |
| 4 | Device page | **Isolate device** ako postoji C2 konekcija |
| 5 | Device page | **Collect investigation package** (autoruns, scheduled tasks, SMB sesije) |
| 6 | Live response | `persistence`, `getfile` sumnjivih fajlova, `remediate` |
| 7 | Advanced hunting | isti hash i C2 IP na drugim uređajima |
| 8 | Korisnik | reset lozinke, revoke sesija (Entra) |
| 9 | Device page | **Release from isolation**, AV full scan |
| 10 | Incident | klasifikacija, komentar, zatvaranje |

## Rezime

- **Device timeline**: podrazumijevano 30 dana, custom range, filteri (Events/Techniques, Flagged), process tree, MITRE tehnike boldovane sa plavom ikonom, **Hunt for related events**, izvoz **do 7 dana**.
- **Isolate device** traži onboardan uređaj i zadržava vezu sa servisom; **selective** izolacija dozvoljava Outlook/Teams i isključenja. **Contain device** radi preko ostalih uređaja i služi za neupravljane uređaje.
- **Restrict app execution** dozvoljava samo Microsoft-potpisane fajlove; **Run antivirus scan** radi i u passive modu.
- **Investigation package**: Autoruns, Network connections, Prefetch, Processes, Scheduled tasks, Security event log, Services, SMB sessions, Temp, Users and Groups, **CollectionSummaryReport.xls**; preuzima se iz **Action centera**.
- **Live response**: uključuje se u Advanced features (posebno za servere), skripte moraju biti u **biblioteci**, unsigned PowerShell traži posebnu postavku; jedna sesija po uređaju, `getfile` do 3 GB, `remediate` i `undo`.
- **Evidence and Response** tab: verdikt (Malicious/Suspicious/Clean) i remediation status; Pending approval se odobrava u tabu ili **Action center** > **Pending**.
- Fajl: **Stop and Quarantine File** (sve postojeće kopije) + **Add Indicator** (buduća pokretanja), **Deep analysis** za sandbox izvještaj.
- **Automatic attack disruption**: tag **Attack Disruption**, žuta traka, summary kartica, tab **Activities** sa **Policy status**; akcije contain device/IP/user, isolate, disable user, revoke session. Vraćanje (**Release from containment**, **Enable user**) tek poslije istrage i remedijacije.
- KQL: `DeviceProcessEvents` za hronologiju, `DisruptionAndResponseEvents` za disruption akcije, `DeviceEvents` sa `ContainedDevice`/`ContainedUser` za blokirane pokušaje.
