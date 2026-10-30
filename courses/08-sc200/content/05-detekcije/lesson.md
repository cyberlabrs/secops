## Ciljevi ispita: 1.4

Ovaj modul pokriva cilj **1.4 Configure detections** iz domena 1 (Manage a security operations environment, 40–45%). Bulleti iz study guidea (stanje od 21. 10. 2026):

- kreiranje **custom detection rules** pomoću **Advanced hunting** u Microsoft Defender XDR,
- upravljanje custom detection pravilima u Defender XDR,
- konfiguracija i upravljanje **analytics rules** u Microsoft Sentinel SIEM-u: **scheduled**, **near-real-time (NRT)**, **threat intelligence** i **machine learning**,
- analiza pokrivenosti napadačkih vektora pomoću **MITRE ATT&CK** matrice,
- konfiguracija **anomalies** u Microsoftu Sentinelu.

Bitna promjena u 2025/2026: Microsoft u dokumentaciji Sentinela navodi da su **custom detections** sada preporučeni način za kreiranje novih pravila nad podacima i iz Sentinela i iz Defender XDR-a (manji trošak unosa, real-time detekcije, akcije odgovora, automatsko mapiranje entiteta). Analytics pravila u Sentinelu i dalje postoje, rade u Defender portalu i ispit ih pita. Treba znati oba svijeta i kada koji koristiti.

## Alarmi, incidenti i ko ih pravi

- **Alert** je pojedinačni signal koji je proizvelo neko pravilo ili proizvod.
- **Incident** je kontejner povezanih alarma (cijela „priča“ napada).

Kada je Sentinel workspace onboardovan u Defender portal, **incidente pravi Defender XDR correlation engine**, i za Sentinel alarme. Posljedice koje ispit voli:

| Stvar | Ponašanje nakon onboardinga u Defender portal |
|---|---|
| **Fusion** (Advanced multistage attack detection) | pravilo se **isključuje**; korelaciju preuzima Defender XDR engine |
| **Microsoft security** (incident creation) pravila | automatski se **deaktiviraju** da ne bi nastajali duplikati |
| Alert grouping u analytics pravilu | postavka je vidljiva, ali grupisanje i spajanje incidenata kontroliše Defender XDR engine |
| Pravilo sa isključenim kreiranjem incidenata | njegovi alarmi **nisu vidljivi** u Defender portalu |
| Alert tuning | Defender XDR alert tuning se može primijeniti i na Sentinel alarme |

> **Na ispitu:** „Nakon onboardinga Sentinela u Defender portal, pravilo Advanced multistage attack detection je disabled. Šta trebate uraditi da zadržite korelaciju?“ Ništa: korelaciju sada radi **Defender XDR**. Ponovno uključivanje Fusiona nije moguće niti potrebno.

## Custom detection rules u Defender XDR

**Custom detection rule** je **advanced hunting** upit koji se izvršava periodično (ili kontinuirano), generiše alarme i opcionalno pokreće akcije odgovora. Može čitati Defender XDR tabele (`Device*`, `Email*`, `Identity*`, `CloudAppEvents`…) i, kada je Sentinel onboardovan, tabele iz Sentinel workspacea.

### Dozvole

- Za Defender podatke: **Security settings (manage)** u Defender unified RBAC-u, ili Entra uloga **Security Administrator**. **Security Operator** je dovoljan samo ako je RBAC u Defender for Endpointu isključen; sa uključenim RBAC-om treba i **Manage security settings**.
- Dozvole idu po izvoru: ko ima manage prava samo za Defender for Office 365 može praviti pravila nad `Email*` tabelama, ali ne nad `Identity*`.
- Za Sentinel podatke: **Microsoft Sentinel Contributor** ili više na workspaceu.
- Za device scope: korisnik mora imati prava na sve device grupe u scopeu pravila (pravilo na „All devices“ može uređivati samo neko sa pravima na sve grupe).

### Kreiranje

Dvije ulazne tačke:

1. `Investigation & response > Hunting > Advanced hunting` → napiši i pokreni upit → **Create detection rule** (prednost: prvo vidiš rezultate).
2. `Hunting > Custom detection rules` → **+ Create detection rule** (wizard odmah, upit upišeš u njemu).

Koraci wizarda: upit → alert details → enrichment (dinamički naslov, custom details, entiteti) → actions → scope → review i **Create**. Pravilo se odmah pokreće i prvi put provjerava podatke iz posljednjih 30 dana.

### Kolone koje upit treba vratiti

| Kolona | Zašto |
|---|---|
| `Timestamp` ili `TimeGenerated` | vrijeme alarma; bez nje vrijeme se postavlja prema lookbacku |
| `DeviceId` + `ReportId` (MDE tabele) | ispravan device group scope i process tree |
| `Timestamp` + `ReportId` (ostale Defender tabele) | identifikacija originalnog eventa, obogaćen timeline |
| jak identifikator imovine: `DeviceId`/`DeviceName`, `RecipientEmailAddress`/`SenderFromAddress`, `AccountObjectId`/`AccountSid`/`AccountUpn` | automatsko mapiranje impacted asseta |

Jednostavni upiti bez `project` i `summarize` vraćaju ove kolone sami. Kada agregiraš, vrati ih sa `arg_max`:

```kql
DeviceProcessEvents
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where ProcessCommandLine has_any ("-EncodedCommand", "-enc ")
| summarize (Timestamp, ReportId) = arg_max(Timestamp, ReportId), Executions = count() by DeviceId, DeviceName, AccountUpn
| where Executions >= 3
```

Microsoft preporučuje da **ne filtriraš po `Timestamp`** u custom detekciji: servis sam prefiltrira podatke prema lookbacku (i gleda `ingestion_time()` zbog kašnjenja unosa). Svako pokretanje može generisati najviše **150 alarma**, pa upit treba suziti da ne alarmira na normalnu svakodnevnu aktivnost.

### Frekvencija i lookback

| Frekvencija | Lookback (pravila sa Defender XDR podacima) |
|---|---|
| **Every 24 hours** | 30 dana |
| **Every 12 hours** | 48 sati |
| **Every 3 hours** | 12 sati |
| **Every hour** | 4 sata |
| **Continuous (NRT)** | eventi se provjeravaju kako stižu |
| **Custom** | samo za pravila nad podacima **isključivo iz Sentinela**: od 5 minuta do 14 dana |

Za pravila samo nad Sentinel podacima lookback se podešava: kod frekvencije češće od jednog sata lookback je manji od 48 sati; kod frekvencije jednom dnevno ili rjeđe do 30 dana.

**Continuous (NRT)** frekvencija je moguća ako upit:

- čita **samo jednu tabelu**,
- koristi samo podržane KQL operatore,
- nema `join`, `union` ni `externaldata`,
- nema komentara.

Podržane tabele uključuju npr. `DeviceProcessEvents`, `DeviceNetworkEvents`, `DeviceFileEvents`, `EmailEvents`, `IdentityLogonEvents`, `CloudAppEvents`, a sa Sentinel strane `SecurityEvent`, `CommonSecurityLog`, `SigninLogs`, `AuditLogs`, `AzureActivity`, `OfficeActivity`, `AWSCloudTrail`. Na stranici custom detection pravila postoji **Migrate now**, koje pokazuje postojeća pravila kompatibilna sa NRT-om i prebacuje ih na Continuous frekvenciju.

> **Na ispitu:** „Custom detection pravilo treba alarmirati u roku od par minuta, a upit radi `join` između `DeviceProcessEvents` i `DeviceNetworkEvents`.“ Continuous (NRT) nije moguć zbog `join` i dvije tabele. Opcije: prepisati upit na jednu tabelu ili prihvatiti **Every hour**.

### Alert details i enrichment

- **Detection name**, **Alert title**, **Severity**, **Category**, **MITRE ATT&CK** tactic, techniques i sub-techniques, **Description**, **Recommended actions**, opcionalno veza na **threat analytics** izvještaj.
- **Dinamički naslov i opis**: kolone u dvostrukim vitičastim zagradama, npr. `PowerShell sa enkodiranom komandom na {{DeviceName}}`. Do tri kolone po polju.
- **Custom details**: do 20 key-value parova, ukupno do 4 KB po alarmu (preko toga se cijeli niz odbacuje).
- **Entity mapping**: **Impacted assets** (Account, Device, Mailbox, Cloud application, Azure/AWS/GCP resource) i **Related evidence** (Process, File, Registry value, IP, URL, DNS, OAuth application…). Za Defender podatke entiteti se biraju automatski, za Sentinel podatke ručno. Entiteti utiču na to kako se alarmi grupišu u incidente.

### Akcije odgovora

Akcije su dostupne kada pravilo čita Defender podatke:

| Objekat | Akcije | Potrebna kolona |
|---|---|---|
| Uređaj | Isolate device, Collect investigation package, Run antivirus scan, Initiate investigation, Restrict app execution | `DeviceId` |
| Fajl | Allow/Block, Quarantine file | `SHA1`, `SHA256` ili `InitiatingProcessSHA1/256` |
| Korisnik | Mark user as compromised, Disable user, Reset user authentication | `AccountObjectId`; za disable/reset i SID (`AccountSid`…) |
| Email | Move to mailbox folder, Delete email (soft/hard) | `NetworkMessageId` + `RecipientEmailAddress` |

**Scope**: All devices ili određene device grupe. Pravilo čita podatke i izvršava akcije samo na uređajima u scopeu.

> **Na ispitu:** „Custom detection pravilo treba automatski izolovati uređaj, ali opcija Isolate device je nedostupna.“ Upit ne vraća `DeviceId`. Za akcije na emailu moraju postojati `NetworkMessageId` i `RecipientEmailAddress`.

### Upravljanje postojećim pravilima

Na stranici `Hunting > Custom detection rules` vidiš listu pravila sa statusom, posljednjim i sljedećim pokretanjem i rezultatom. Za pravilo možeš:

- **Run** (odmah pokreni), **Edit**, **Turn off / Turn on**, **Delete**,
- otvoriti detalje i pregledati **triggered alerts** i **triggered actions**,
- koristiti **Migrate now** za prelazak kompatibilnih pravila na Continuous (NRT).

Izmjena važi od sljedećeg zakazanog pokretanja. Pravila redovno pregledaj: lažni alarmi znače da treba suziti upit. Ugrađeni **alert tuning** se ne primjenjuje na alarme iz custom detekcija, pa šum rješavaš u samom upitu.

Duplikati: kada je lookback duži od frekvencije, isti event može biti viđen više puta; custom detections automatski grupišu i dedupliciraju identične evente u jedan alarm.

## Analytics rules u Sentinelu

Putanja: Defender portal `Microsoft Sentinel > Configuration > Analytics` (Azure portal: `Microsoft Sentinel > Analytics`). Tabovi: **Active rules**, **Rule templates**, **Anomalies**. Više templateova dobijaš instalacijom solutiona iz Content huba.

### Tipovi pravila

| Tip | Kako radi | Prilagođavanje |
|---|---|---|
| **Scheduled** | KQL upit periodično nad lookback periodom; alarm kada rezultat pređe prag | potpuno |
| **Near-real-time (NRT)** | izvršava se svake minute nad podacima unesenim u prethodnoj minuti | većina opcija scheduled pravila |
| **Microsoft security** | pravi incidente iz alarma Microsoftovih proizvoda | filteri; **nije dostupno** uz Defender XDR integraciju ili Defender portal |
| **Threat intelligence** (Microsoft Threat Intelligence Analytics) | poredi Microsoftove indikatore sa CEF, Syslog i Windows DNS podacima | nije prilagodljivo, samo uključi/isključi |
| **Fusion** (Advanced multistage attack detection) | ML korelacija alarma iz više proizvoda | nije prilagodljivo; isključeno u Defender portalu |
| **ML Behavior Analytics** (preview) | ML detekcija anomalnih SSH i RDP prijava | nije prilagodljivo |
| **Anomaly** | ML baseline, upisuje u tabelu `Anomalies`, ne pravi alarme | duplikat sa izmijenjenim pragom i parametrima |

### Scheduled pravilo: wizard

**General**: ime, opis, **Severity**, **MITRE ATT&CK** taktike i tehnike, status.

**Set rule logic**:

- **Rule query** (KQL),
- **Alert enhancement**: **Entity mapping** (do 10 mapiranja, svako sa do 3 identifikatora), **Custom details** (kolone koje se prikazuju u alarmu), **Alert details** (dinamički naslov, opis, severity, taktike iz kolona upita),
- **Query scheduling**: **Run query every** (od 5 minuta do 14 dana) i **Lookup data from the last** (do 14 dana),
- **Alert threshold**: npr. „Is greater than 0“,
- **Event grouping**: **Group all events into a single alert** ili **Trigger an alert for each event**,
- **Suppression**: zaustavi izvršavanje pravila na određeno vrijeme nakon što generiše alarm.

**Incident settings**: **Create incidents from alerts triggered by this analytics rule**, i **Alert grouping** (grupisanje alarma u jedan incident u vremenskom prozoru: sve zajedno, po podudaranju svih entiteta ili po odabranim entitetima i detaljima; opcija ponovnog otvaranja zatvorenih incidenata). U Defender portalu ovo grupisanje u praksi kontroliše Defender XDR correlation engine, a reopen zatvorenih incidenata ne radi: novi alarmi prave novi incident.

**Automated response**: automation rules koje se vežu za ovo pravilo (vidi modul o automatizaciji).

Scheduled pravila rade sa ugrađenim kašnjenjem od pet minuta zbog kašnjenja unosa.

Primjer scheduled pravila: mnogo neuspješnih prijava sa jedne IP adrese:

```kql
SecurityEvent
| where EventID == 4625
| summarize FailedLogons = count(), TargetAccounts = dcount(Account), FirstSeen = min(TimeGenerated), LastSeen = max(TimeGenerated) by IpAddress, Computer
| where FailedLogons >= 20
| extend AlertTitle = strcat("Brute force sa ", IpAddress, " na ", Computer)
```

Uz ovaj upit: Run query every 1 hour, Lookup data from the last 1 hour, threshold > 0, entity mapping **IP** → `IpAddress`, **Host** → `Computer`, Alert details: naslov iz kolone `AlertTitle`, taktika **Credential Access**, tehnika T1110.

> **Na ispitu:** „Pravilo se izvršava svakih 5 minuta sa lookbackom od 1 sata i analitičari dobijaju 12 alarma za isti napad.“ Lookback je duži od frekvencije, pa se isti eventi vide više puta. Rješenja: izjednači frekvenciju i lookback ili uključi **suppression** na 1 sat.

### NRT pravila

- Hard-kodirano: izvršavaju se **svake minute** i obuhvataju evente **unesene** u prethodnoj minuti.
- Koriste **vrijeme unosa** (ingestion time), ne `TimeGenerated`, uz ugrađeno kašnjenje od dvije minute; zato kašnjenje izvora nije problem.
- Najviše **50 NRT pravila** po korisniku.
- Rade ispravno samo za izvore sa kašnjenjem unosa ispod 12 sati.
- Upit može čitati **više tabela** i više workspaceova.
- Mogu proizvesti do 30 single-event alarma; preko toga 29 pojedinačnih i trideseti zbirni.
- Podržavaju entity mapping, custom details, dynamic alert details, alert grouping, suppression i automation rules.
- Nema podešavanja frekvencije ni lookbacka.

| Zahtjev | Pravilo |
|---|---|
| Alarm u roku od minute za kritičan event (npr. dodavanje u Domain Admins) | **NRT** |
| Agregacija preko 24 sata (npr. broj neuspjelih prijava po danu) | **Scheduled** |
| Korelacija sa watchlistom ili TI preko `join` nad sat vremena podataka | **Scheduled** (NRT podržava više tabela, ali obuhvata samo minutu podataka) |
| Upit nad Defender XDR tabelama sa automatskom izolacijom uređaja | **Custom detection** |

Primjer kandidata za NRT: dodavanje naloga u privilegovanu grupu (EventID 4728, 4732, 4756):

```kql
SecurityEvent
| where EventID in (4728, 4732, 4756)
| where TargetUserName in ("Domain Admins", "Administrators", "Enterprise Admins")
| project TimeGenerated, Computer, SubjectAccount, MemberName, TargetUserName, EventID
```

### Threat intelligence pravila

Dvije vrste:

1. **Microsoft Threat Intelligence Analytics** (matching analytics): jedno pravilo, nije prilagodljivo. Kada ga uključiš, poredi domen, IP i URL indikatore iz Microsoft Threat Intelligence sa CEF, Syslog i Windows DNS podacima i pravi alarme visoke pouzdanosti.
2. **TI templateovi** iz solutiona **Threat Intelligence** (npr. matching IP indikatora sa raznim tabelama): scheduled pravila koja možeš prilagoditi.

Primjer vlastitog scheduled pravila koje poredi aktivne IP indikatore sa Azure Firewall logovima:

```kql
let Indicators = ThreatIntelIndicators
    | where TimeGenerated > ago(14d)
    | summarize arg_max(TimeGenerated, *) by Id
    | where IsActive == true and ValidUntil > now()
    | where ObservableKey == "ipv4-addr:value"
    | project IndicatorIp = ObservableValue, Confidence;
AzureFirewall
| where TimeGenerated > ago(1h)
| join kind=inner Indicators on $left.DestinationIp == $right.IndicatorIp
| project TimeGenerated, SourceIp, DestinationIp, DestinationPort, Action, Confidence
```

Entity mapping: IP → `DestinationIp` (indikator) i IP → `SourceIp` (interni host).

### Machine learning pravila i Fusion

- **ML Behavior Analytics** (preview): Microsoftovi ML modeli za anomalne **SSH** i **RDP** prijave na osnovu IP-a, geolokacije i istorije korisnika. Ne mogu se mijenjati, samo uključiti.
- **Fusion**: u Azure portalu uključen po defaultu, korelira alarme niske pouzdanosti iz više proizvoda u incidente visoke pouzdanosti. U Defender portalu (i uz Defender XDR incident integraciju) **nije dostupan**; zamjenjuje ga Defender XDR korelacija.
- **Anomaly** pravila su također ML (vidi niže).

> **Na ispitu:** pitanje „koji tip pravila može koristiti bilo koji KQL i prilagođene pragove“ = **scheduled**. „Koji tip se ne može prilagoditi“ = Microsoft Threat Intelligence Analytics, Fusion, ML Behavior Analytics. „Koji ne generiše alarme“ = **anomaly**.

### Zdravlje pravila

Ako pravilo više puta ne uspije (npr. autor izgubi pristup drugom workspaceu u MSSP scenariju), Sentinel ga **automatski isključuje** i dodaje „AUTO DISABLED“ u ime. Kada je uključeno health monitoring, greške se vide u tabeli `SentinelHealth`:

```kql
SentinelHealth
| where TimeGenerated > ago(7d)
| where SentinelResourceType == "Analytics Rule"
| where Status != "Success"
| summarize Failures = count(), LastFailure = max(TimeGenerated) by SentinelResourceName, Status
| order by Failures desc
```

Pravila možeš **exportovati u ARM template** i importovati u drugi workspace, ili ih upravljati kao kod kroz **repositories** (GitHub, Azure DevOps).

## Custom detection ili analytics rule?

| Kriterij | Custom detection (Defender XDR) | Analytics rule (Sentinel) |
|---|---|---|
| Podaci | Defender XDR tabele + Sentinel tabele | Sentinel workspace (uključujući XDR podatke ako su uneseni u workspace) |
| Defender XDR podaci bez unosa u Sentinel | da (do 30 dana u advanced huntingu) | ne, moraju biti uneseni u workspace |
| Akcije na uređaju, fajlu, korisniku, emailu | ugrađene u pravilo | preko playbooka |
| Real-time | Continuous (NRT) za podržane tabele | NRT pravilo (max 50) |
| Frekvencija | 1h, 3h, 12h, 24h, Continuous; Custom 5 min–14 dana za Sentinel-only | 5 min–14 dana, lookback do 14 dana |
| Entity mapping | Impacted assets + Related evidence | do 10 mapiranja |
| Alert tuning | ugrađeni tuning se ne primjenjuje | Defender alert tuning nakon onboardinga |

Microsoft u vodiču za prelazak preporučuje: ako detekcija koristi i Defender XDR i Sentinel podatke, a XDR podatke ne trebaš čuvati duže od 30 dana, napravi **custom detection** koja čita oba izvora, bez unosa XDR podataka u Sentinel.

> **Na ispitu:** „Trebate detekciju koja kombinuje `DeviceProcessEvents` (Defender for Endpoint) i `CommonSecurityLog` (firewall u Sentinelu), automatski izoluje uređaj i ne povećava trošak unosa.“ Odgovor: **custom detection rule** u Defender portalu. Analytics pravilo bi tražilo unos `DeviceProcessEvents` u workspace i playbook za izolaciju.

## MITRE ATT&CK pokrivenost

Stranica: Defender portal `Microsoft Sentinel > Threat management > MITRE ATT&CK` (Azure portal: `Threat management > MITRE ATT&CK (Preview)`). Stranica je u previewu i trenutno je usklađena sa **MITRE ATT&CK verzijom 18**.

Šta pokazuje:

- **Trenutnu pokrivenost**: matrica taktika i tehnika, obojena prema broju **aktivnih scheduled i NRT pravila** koja imaju tu tehniku.
- **Simuliranu pokrivenost** (**Simulated rules**): kako bi matrica izgledala kada bi uključio dostupne templateove (analytics rule templates, hunting queries).
- **Detalje tehnike**: opis, link na MITRE, linkove na aktivna pravila i dostupne hunting upite; u Defender portalu i preporučene detekcije i proizvode za tu tehniku.
- U Defender portalu filter **View MITRE by threat scenario** pokazuje pokrivenost za određeni scenarij prijetnje.

Pokrivenost se računa iz **taktika i tehnika koje si dodijelio pravilima**. Pravilo bez MITRE mapiranja ne doprinosi matrici, čak i ako stvarno detektuje tehniku. Tehnike pravila se prenose i na incidente.

Postupak analize praznina:

1. Otvori MITRE ATT&CK stranicu i pronađi tehnike bez aktivnih detekcija za taktike koje su ti prioritet (npr. Credential Access, Lateral Movement).
2. Uključi **Simulated rules** i vidi koji templateovi pokrivaju te tehnike.
3. Provjeri da li imaš potrebne izvore podataka (template navodi required data sources).
4. Aktiviraj template ili napiši vlastito pravilo i mapiraj taktiku i tehniku u **General** tabu.
5. Ponovo pogledaj matricu.

> **Na ispitu:** „Napravili ste scheduled pravilo za Kerberoasting, ali tehnika T1558 se i dalje prikazuje kao nepokrivena u MITRE ATT&CK matrici.“ Pravilo nema mapiranu tehniku u postavkama (General tab). Matrica ne analizira tekst upita.

## Anomalies

**Anomaly** pravila koriste ML da nauče baseline ponašanja i označe odstupanja. Anomalije same po sebi ne znače napad, zato **ne generišu alarme**: upisuju se u tabelu `Anomalies` i koriste kao kontekst u detekcijama, istragama i huntingu. Dio anomalija dolazi iz **UEBA** enginea (baseline po entitetu, peerovima i organizaciji).

Konfiguracija: `Microsoft Sentinel > Configuration > Analytics > Anomalies`.

- Filteri: status, taktike, tehnike, izvori podataka.
- Detalji pravila: opis, taktike i tehnike, **Parameters**, **Threshold**, frekvencija, status **Production** ili **Flighting**, verzija templatea.
- Ugrađena pravila **ne mogu se uređivati ni brisati**. Možeš samo prebacivati Production/Flighting.

Podešavanje (tuning):

1. Desni klik na pravilo → **Duplicate**. Nastaje kopija sa sufiksom „ - Customized“, **disabled**, u **Flighting** modu (oznaka FLGT).
2. **Edit** kopije: promijeni **threshold** i parametre; rezultati se vide u **Results preview**.
3. Uključi kopiju. Original nastavlja raditi u **Production**.
4. Uporedi rezultate u tabeli `Anomalies`.
5. Kada si zadovoljan, kopiju prebaci u **Production**; original automatski prelazi u Flighting (dvije verzije istog pravila ne mogu biti u produkciji istovremeno).

Svako ugrađeno pravilo može imati samo **jednu** prilagođenu kopiju.

```kql
Anomalies
| where TimeGenerated > ago(1d)
| where AnomalyTemplateId contains "<RuleId>"
| project TimeGenerated, AnomalyTemplateName, RuleStatus, Score, UserName, Entities, AnomalyReasons
| order by Score desc
```

Upit sa `AnomalyTemplateId` vraća anomalije i originala i kopije, jer je `AnomalyTemplateId` kopije isti kao `RuleId` originala. Ako pravilo pravi previše anomalija, prag je vjerovatno prenizak.

Primjer korištenja anomalija u detekciji: alarm samo kada korisnik ima i neuspjele prijave i anomaliju u istom periodu:

```kql
let AnomalousUsers = Anomalies
    | where TimeGenerated > ago(1d)
    | where isnotempty(UserName)
    | distinct UserName;
SecurityEvent
| where TimeGenerated > ago(1d)
| where EventID == 4625
| extend UserName = tostring(split(Account, "\\")[1])
| where UserName in (AnomalousUsers)
| summarize FailedLogons = count() by UserName, Computer
```

> **Na ispitu:** „Anomaly pravilo generiše previše anomalija. Trebate testirati viši prag bez prekida postojećeg pravila.“ Odgovor: **Duplicate**, povećati threshold na kopiji, ostaviti je u **Flighting** i uporediti. Direktna izmjena ugrađenog pravila nije moguća.

## Lab: upiti za detekcije u labu

U labu (`lokql`) možeš provjeriti logiku pravila prije nego što je pretvoriš u detekciju. Koliko bi alarma dalo brute force pravilo sa različitim pragovima:

```kql
SecurityEvent
| where EventID == 4625
| summarize FailedLogons = count() by IpAddress, Computer
| summarize Over5 = countif(FailedLogons > 5), Over20 = countif(FailedLogons > 20), Over50 = countif(FailedLogons > 50)
```

I koji roditeljski procesi pokreću PowerShell, kao osnova za custom detekciju:

```kql
DeviceProcessEvents
| where FileName =~ "powershell.exe"
| summarize Executions = count(), Devices = dcount(DeviceName) by InitiatingProcessFileName
| order by Executions desc
```

## Rezime

- **Custom detections** su sada preporučeni način za nove detekcije nad Defender XDR i Sentinel podacima. Kreiraju se iz **Advanced hunting** (**Create detection rule**) ili sa stranice **Custom detection rules**.
- Upit treba vratiti `Timestamp`/`TimeGenerated`, `ReportId` i `DeviceId` (za MDE); akcije traže odgovarajuće kolone (`DeviceId`, SHA1/SHA256, `AccountObjectId`/SID, `NetworkMessageId` + `RecipientEmailAddress`). Max 150 alarma po pokretanju.
- Frekvencije: 24h (lookback 30d), 12h (48h), 3h (12h), 1h (4h), **Continuous (NRT)** za jednu tabelu bez join/union/externaldata, **Custom** 5 min–14 dana samo za Sentinel podatke.
- Sentinel tipovi: **Scheduled** (5 min–14 dana, lookback do 14 dana), **NRT** (svake minute, ingestion time, max 50, više tabela), **Microsoft security** (nedostupno u Defender portalu), **Threat intelligence** (Microsoft Threat Intelligence Analytics, CEF/Syslog/DNS), **ML Behavior Analytics** (SSH/RDP), **Fusion** (isključen u Defender portalu), **Anomaly**.
- Entity mapping, custom details i dynamic alert details obogaćuju alarme i utiču na korelaciju u incidente.
- **MITRE ATT&CK** stranica pokazuje pokrivenost iz aktivnih scheduled i NRT pravila prema dodijeljenim tehnikama, plus simuliranu pokrivenost iz templateova; ATT&CK v18.
- **Anomalies** ne prave alarme, pišu u tabelu `Anomalies`; tuning ide preko **Duplicate** → Flighting → Production.
