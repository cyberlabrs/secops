## Ciljevi ispita: 1.1

Ovaj modul pokriva cilj **1.1 Configure automation for Microsoft Defender XDR and Microsoft Sentinel** iz domena 1 (Manage a security operations environment, 40–45%). Bulleti iz study guidea (stanje od 21. 10. 2026):

- **email notifikacije** u Defender XDR: incidenti, akcije i **threat analytics**,
- **alert notifikacije** u Defender XDR: **tuning**, **suppression** i **correlation**,
- **advanced features** u Microsoft Defender for Endpointu,
- **rules settings** u Defender for Endpointu,
- **custom data collection** u Defender for Endpointu,
- sigurnosne politike za Defender for Endpoint, uključujući **attack surface reduction (ASR)** pravila,
- upravljanje mogućnostima **automated investigation and response (AIR)**,
- **automatic attack disruption**,
- **device groups**, dozvole i **automation levels** u Defender for Endpointu,
- **automation rules** u Microsoft Sentinelu,
- **playbooks** u Microsoft Sentinelu.

Većina podešavanja Defender XDR-a nalazi se pod `System > Settings` u Defender portalu (`security.microsoft.com`): `Settings > Microsoft Defender XDR` (zajednička podešavanja) i `Settings > Endpoints` (Defender for Endpoint). Sentinel automatizacija je pod `Microsoft Sentinel > Configuration > Automation`.

## Email notifikacije u Defender XDR

Putanja: `Settings > Microsoft Defender XDR > General > Email notifications`. Postoje tri taba:

| Tab | Šta šalje | Tipične opcije |
|---|---|---|
| **Incidents** | email kada nastane incident ili se doda alarm | severity, izvor alarma (service source), device grupe, uključi ime organizacije, link na portal tenanta, primaoci |
| **Actions** | email o **response akcijama** | **Action source** (manual, automated), konkretne akcije, **Device groups scope**, **Action status** (completed, failed), primaoci |
| **Threat analytics** | email kada se objavi ili ažurira **threat analytics** izvještaj | koji izvještaji (svi ili odabrane kategorije), primaoci |

Postupak za svaku vrstu je isti: **Add notification rule** → Basics (ime, opis) → Notification settings → Recipients (**Send test email**) → Review → **Submit**.

Dozvole: za konfiguraciju treba permisija **Manage security settings** (u osnovnom modelu dozvola: Security Administrator ili više). Sa RBAC-om korisnik može kreirati, mijenjati i primati notifikacije samo za device grupe koje smije upravljati.

Automated akcije u tabu Actions obuhvataju **automatic attack disruption** i **automated investigation and response**. Notifikacije za akcije još ne podržavaju akcije iz custom detekcija.

> **Na ispitu:** „Tim za servere treba dobiti email samo kada se izoluje uređaj iz device grupe Servers, bilo ručno ili automatski.“ Odgovor: notification rule u tabu **Actions**, Action source manual + automated, akcija isolate, **Device groups scope** = Servers. Tab **Incidents** šalje mail za incidente, ne za akcije.

## Alert notifikacije: tuning, suppression, correlation

### Alert tuning

**Alert tuning** (ranije **alert suppression**) automatski skriva ili rješava alarme kada se desi očekivano ponašanje organizacije. Putanja: `Settings > Microsoft Defender XDR > Rules > Alert tuning`, ili sa stranice alarma **Tune alert**.

- **Select service sources**: proizvodi na koje se pravilo odnosi (vidiš samo one za koje imaš dozvole).
- **Conditions**: na osnovu evidence tipova (fajl, proces, scheduled task, AMSI skripta, WMI event…), sa AND/OR i grupisanjem; do **200 uslova** po pravilu.
- **Action**:
  - **Hide alert**: potiskuje alarm i sprečava incident; alarm ostaje u `AlertInfo` i `AlertEvidence`. Radi **samo za Defender for Endpoint** alarme.
  - **Resolve alert**: alarm i povezani incidenti nastaju sa statusom resolved.
  - **Set as behavior**: signal postaje **behavior** (tabele `BehaviorInfo`, `BehaviorEntities`), ne pojavljuje se u queueu i ne pravi incident; nije podržano za Defender for Cloud i Defender for Office 365.

Postoje i **ugrađena** (built-in) tuning pravila za česte benigne aktivnosti; možeš ih pregledati i isključiti (**Disable**). Ni ugrađeni ni custom tuning se **ne primjenjuju** na alarme iz **custom detection** pravila i Custom TI indikatora: tamo šum rješavaš u samom upitu ili indikatoru.

Nakon onboardinga Sentinela u Defender portal, alert tuning se može primijeniti i na **Sentinel** alarme.

> **Na ispitu:** „Interni alat za backup svake noći okida isti Defender for Endpoint alarm. Alarm ne smije praviti incident, ali podaci moraju ostati dostupni za hunting.“ Odgovor: alert tuning sa akcijom **Hide alert** (ili **Set as behavior**) i uslovom na proces/fajl alata. Isključivanje cijele detekcije ili brisanje alarma nije ispravno.

### Correlation

Defender XDR automatski korelira alarme iz svih izvora (uključujući Sentinel) u incidente. Na to utiču:

- **entiteti** u alarmima (zato je entity mapping u pravilima bitan),
- advanced feature **Restrict correlation to within scoped device groups** u Defender for Endpointu: alarmi iz različitih device grupa ne spajaju se u jedan incident. Korisno kada lokalni SOC timovi vide samo svoje grupe; globalni SOC tada vidi više manjih incidenata. Promjena važi samo za buduće korelacije.
- **Alert service settings** (`Settings > Microsoft Defender XDR > Alert service settings`): npr. koji Microsoft Entra ID Protection alarmi ulaze u Defender (default je **High-risk detections only**, može se promijeniti na High + Medium ili All detections).

## Defender for Endpoint advanced features

Putanja: `Settings > Endpoints > General > Advanced features` → **On/Off** → **Save preferences**.

| Feature | Šta radi |
|---|---|
| **Restrict correlation to within scoped device groups** | korelacija alarma samo unutar device grupe |
| **Enable EDR in block mode** | EDR blokira maliciozne artefakte i kada je Defender Antivirus u passive modu |
| **Automatically resolve alerts** | automatski rješava alarme gdje nije nađena prijetnja ili je prijetnja otklonjena |
| **Allow or block file** | blokiranje fajlova po hashu; traži Defender Antivirus kao aktivni AV i cloud-based protection |
| **Custom network indicators** | indikatori za IP, domen i URL (allow/block) |
| **Tamper protection** | sprečava gašenje i mijenjanje zaštite |
| **Show user details** | podaci o korisniku iz Entra ID-a u istrazi |
| **Microsoft Defender for Cloud Apps** | prosljeđivanje signala u Defender for Cloud Apps |
| **Web content filtering** | blokiranje kategorija sajtova |
| **Device discovery** | otkrivanje neupravljanih uređaja u mreži |
| **Download quarantined files** | backup karantinskih fajlova za preuzimanje |
| **Live response** / **Live response for servers** / **Live response unsigned script execution** | udaljena sesija na uređaju, na serverima, i izvršavanje nepotpisanih skripti |
| **Microsoft Intune connection** | dijeljenje rizika uređaja za Conditional Access |
| **Share endpoint alerts with Microsoft Compliance Center** | alarmi za Insider Risk Management |
| **Preview features** | pristup preview funkcijama |

> **Na ispitu:** „Analitičar ne može pokrenuti live response sesiju na Windows Serveru, a na radnim stanicama može.“ Uključi **Live response for servers**. Ako treba pokretati vlastite nepotpisane skripte, dodatno **Live response unsigned script execution**.

## Rules settings u Defender for Endpointu

Putanja: `Settings > Endpoints > Rules`. Najvažniji dijelovi:

- **Indicators**: vlastiti IoC-i za **fajl hash**, **IP adrese**, **URL/domene** i **certifikate**. Akcije: **Allow**, **Audit**, **Warn**, **Block execution**, **Block and remediate** (zavisi od tipa). Scope po device grupama. Za IP i URL potrebni su advanced feature **Custom network indicators** i network protection u block modu; za fajlove **Allow or block file**.
- **Alert suppression / tuning**: vodi na alert tuning (vidi gore).
- **Web content filtering** politike.
- **Custom Data Collection** (vidi niže).
- **Asset rule management** (u Defender XDR podešavanjima): **dynamic tags** za uređaje, koje koriste custom data collection i attack disruption policy application.

## Custom data collection u Defender for Endpointu

**Custom data collection** proširuje telemetriju preko defaultne: definišeš pravila sa filterima (putanja foldera, ime procesa, mrežne konekcije…) i dodatni eventi se šalju u tvoj **Microsoft Sentinel** workspace. Funkcija je u previewu.

Preduslovi:

- licenca **Defender for Endpoint Plan 2**,
- povezan **Microsoft Sentinel workspace** (trenutno jedan workspace po tenantu za ovu funkciju; workspace se bira i pri kreiranju pravila),
- **dynamic tags** iz **Asset Rule Management** (ručni tagovi nisu podržani),
- Windows 10/11 (klijent 10.8805+) ili Windows Server 2019+.

Kreiranje: `Settings > Endpoints > Rules > Custom Data Collection` → odaberi workspace → **Create rule** → General Information → tabela, akcija i uslovi → scope (svi uređaji ili dynamic tag) → **Submit**. Pravilo stiže na uređaje za 20 minuta do 1 sat.

| Tabela | Sadržaj |
|---|---|
| `DeviceCustomProcessEvents` | kreiranje i završetak procesa |
| `DeviceCustomImageLoadEvents` | učitavanje DLL-ova |
| `DeviceCustomFileEvents` | kreiranje, izmjena, brisanje fajlova |
| `DeviceCustomNetworkEvents` | mrežne konekcije |
| `DeviceCustomScriptEvents` | izvršavanje skripti (PowerShell, JavaScript…) |

Ograničenje: **75.000 evenata po pravilu po uređaju u 24 sata** (rolling). Kada se dostigne, to pravilo na tom uređaju prestaje prikupljati do isteka prozora. Unos u Sentinel se naplaćuje prema Sentinel cijenama, pa počni sa pilot grupom.

Provjera da pravilo radi:

```kql
search in (DeviceCustomFileEvents, DeviceCustomScriptEvents, DeviceCustomNetworkEvents, DeviceCustomProcessEvents, DeviceCustomImageLoadEvents) "your_device_id"
| where DeviceId == "your_device_id"
| summarize EventCount = count() by RuleName, RuleLastModificationTime, $table
| order by RuleLastModificationTime desc
```

> **Na ispitu:** „Kreirali ste custom data collection pravilo sa ručnim tagom Finance-Servers i nijedan event ne stiže.“ Custom data collection podržava samo **dynamic tags** iz Asset Rule Management. Napravi dinamičko pravilo za tag i sačekaj da se izvrši.

## Sigurnosne politike i ASR pravila

**Attack surface reduction (ASR)** pravila blokiraju ponašanja koja malver često koristi: Office aplikacije koje pokreću child procese, krađa kredencijala iz LSASS-a, izvršavanje zamaskiranih skripti, izvršni fajlovi iz emaila, perzistencija preko WMI pretplata, zloupotreba ranjivih potpisanih drajvera.

Načini konfiguracije:

- **Microsoft Intune**: `Endpoint security > Attack surface reduction`,
- **Defender for Endpoint security settings management**: `Endpoints > Configuration management > Endpoint security policies` u Defender portalu (uređaji bez Intunea),
- Group Policy, PowerShell (`Set-MpPreference` / `Add-MpPreference`), Configuration Manager.

Režimi pravila:

| Režim | Ponašanje |
|---|---|
| **Not configured** / **Disabled** | pravilo ne radi |
| **Audit** | samo bilježi šta bi bilo blokirano |
| **Warn** | korisnik dobija upozorenje i može ga zaobići |
| **Block** | ponašanje se blokira |

Preporučeni postupak: uključi pravila u **Audit**, analiziraj uticaj u advanced huntingu ili ASR izvještaju, dodaj **exclusions** (fajlovi, folderi) za legitimne aplikacije, pa prebaci u **Block**. Microsoft označava nekoliko pravila kao **standard protection** (npr. blokiranje krađe kredencijala iz LSASS-a, zloupotrebe ranjivih potpisanih drajvera, perzistencije kroz WMI) koja se mogu odmah uključiti u Block uz mali rizik.

```kql
DeviceEvents
| where Timestamp > ago(7d)
| where ActionType startswith "Asr"
| summarize Events = count(), Devices = dcount(DeviceId) by ActionType, FileName, InitiatingProcessFileName
| order by Events desc
```

`ActionType` završava sa `Audited` ili `Blocked` (npr. `AsrLsassCredentialTheftAudited`), pa iz istog upita vidiš šta bi Block režim zaustavio.

> **Na ispitu:** „Trebate uvesti ASR pravilo za Office macro child procese bez prekidanja poslovnih aplikacija.“ Prvo **Audit**, zatim analiza `DeviceEvents` sa `ActionType` koji počinje sa `Asr`, exclusions, pa **Block**. Direktno Block na cijeloj organizaciji je pogrešan prvi korak.

## Automated investigation and response (AIR)

AIR je ugrađeni „virtuelni analitičar“: alarm pokreće istragu, svaki dokaz dobija verdict (**Malicious**, **Suspicious**, **No threats found**), a za maliciozne i sumnjive entitete se predlažu ili izvršavaju **remediation actions** (karantin fajla, zaustavljanje procesa, izolacija, blokiranje URL-a, brisanje emaila…). AIR pokriva uređaje (Defender for Endpoint), email i sadržaj (Defender for Office 365) i identitete.

**Bitna promjena (od 1. septembra 2026.):** u **Defender for Endpointu** AIR više ne radi kao zasebno iskustvo istrage i ne može se pokretati ručno. Njegove sposobnosti detekcije i odgovora su dio podrazumijevane antivirus zaštite i rade automatski; za istragu na zahtjev Microsoft preporučuje **full antivirus scan**. Skripte, playbookovi i integracije koje su ručno pokretale AIR na uređaju treba prilagoditi. AIR za **Defender for Office 365** ostaje dostupan.

Šta i dalje upravljaš:

- **Automation level** po device grupi određuje da li se remediation akcije izvršavaju automatski ili čekaju odobrenje (vidi tabelu niže).
- **Action center** (`Actions & submissions > Action center`): tab **Pending** (čeka odobrenje; pending akcije za uređaje ističu nakon 7 dana i tada se ponašaju kao odbijene) i tab **History** (izvršene akcije, uz mogućnost **Undo**).
- U incidentu tab **Investigations** prikazuje automatske istrage i njihove rezultate.
- Kartica **Automated investigation & response** na početnoj stranici portala vodi na pending akcije.

Za odobravanje ili odbijanje akcija treba odgovarajuća dozvola: za uređaje **Active remediation actions** (MDE RBAC) ili Security Administrator, a za email akcije u Defender for Office 365 i uloga **Search and Purge**.

> **Na ispitu:** „Remediation akcija nad fajlom u `C:\Windows\System32` čeka odobrenje, a ista vrsta akcije u `Downloads` je izvršena automatski.“ Device grupa ima **Semi - require approval for core folders remediation**. Odobri u **Action center > Pending**.

## Device groups, dozvole i automation levels

### Device groups

Putanja: `Settings > Endpoints > Permissions > Device groups` → **Add device group**:

1. **General**: ime, opis, **Automation level**.
2. **Devices**: pravila za članstvo po imenu uređaja, domenu, **tagu** i operativnom sistemu.
3. **Preview devices**: provjera ko upada u grupu.
4. **User access**: koje Entra grupe korisnika (sa MDE ulogama) imaju pristup grupi.

Grupe imaju **rank**: uređaj pripada grupi sa najvišim rankom čija pravila zadovoljava. Uređaji koji ne pripadaju nijednoj grupi idu u **Ungrouped devices (default)**. Kreiranje device grupa postoji u Defender for Endpoint Plan 1 i Plan 2.

### Automation levels

| Automation level | Ponašanje |
|---|---|
| **Full - remediate threats automatically** | remediation automatski; preporučeno; default za tenante kreirane od 16. 8. 2020. |
| **Semi - require approval for all folders** | sve remediation akcije nad fajlovima čekaju odobrenje |
| **Semi - require approval for core folders remediation** | odobrenje za fajlove u sistemskim folderima (npr. `\windows\*`), ostalo automatski |
| **Semi - require approval for non-temp folders remediation** | automatski samo u temp i download folderima, ostalo čeka odobrenje |
| **No automated response** | bez automatske istrage i remediationa; ne preporučuje se |

Automation level device grupe se vidi i u `Settings > Microsoft Defender XDR > Automated response > Devices > Device groups` gdje se upravlja odnosom grupe prema **automatic attack disruption**.

### Dozvole

Defender for Endpoint koristi ili stari model (`Settings > Endpoints > Roles`) ili **Microsoft Defender XDR Unified RBAC** (`Settings > Microsoft Defender XDR > Permissions and roles`). Uloga se dodjeljuje Entra grupi, a pristup uređajima se ograničava preko device grupa. Primjeri permisija: view data, alerts investigation, **active remediation actions**, **live response** (basic ili advanced), **manage security settings**. Princip: analitičar lokalnog SOC-a dobija ulogu samo za device grupe svoje lokacije.

> **Na ispitu:** „Serveri za proizvodnju ne smiju biti automatski remedirani, ali radne stanice moraju.“ Napravi device grupu za servere (pravilo po tagu ili OS-u) sa **Semi - require approval for all folders** (ili No automated response ako je izričito traženo) i rankom iznad opšte grupe; radne stanice ostaju na **Full**.

## Automatic attack disruption

**Automatic attack disruption** koristi signale visoke pouzdanosti iz Defender XDR-a (i Sentinela) da u toku napada (ransomware koji se širi, business email compromise, AiTM phishing, kompromitovani nalozi) automatski **zaustavi** napadača:

- **Contain device** (i neupravljanih uređaja preko onboardovanih), automatska **izolacija** radne stanice (preview),
- **Contain user** / **Disable user** (on-premises AD preko Defender for Identity, Entra ID),
- akcije u Okta i AWS (preview) kada je Sentinel workspace povezan sa odgovarajućim konektorom.

Incidenti sa takvim akcijama dobijaju tag **Attack Disruption**, a akcije su vidljive u incidentu i u **Action center** (History), odakle se mogu poništiti (npr. release from containment, enable user).

### Preduslovi

- Licenca (npr. Microsoft 365 E5/A5, MDE Plan 2, Defender for Identity, Defender for Office 365 Plan 2…).
- Deployment proizvoda: svaki proizvod mora biti deployovan da bi izvršio svoju akciju (npr. MDE za contain device).
- **Defender for Endpoint**: device discovery na **Standard discovery** (za contain device), Sense klijent 10.8470+ za contain user, device grupe na **Full** (preporučeno) ili Semi; grupa na **No automated response** je isključena iz containmenta.
- **Defender for Identity**: audit na domain controllerima, ispravan **action account** (default LocalSystem), senzor na DC-u gdje se nalog gasi.
- **Defender for Cloud Apps**: Microsoft 365 konektor sa svim opcijama.
- **Defender for Office 365**: mailboxovi u Exchange Online, mailbox audit (`MailItemsAccessed`, `UpdateInboxRules`, `MoveToDeletedItems`, `SoftDelete`, `HardDelete`).
- Uloge za konfiguraciju: npr. Security Administrator ili Security Operator.

### Exclusions

Putanja: `Settings > Microsoft Defender XDR > Automated response`:

- **Identities** → **Add user exclusion**: nalozi koji se nikad automatski ne gase (break-glass, servisni nalozi).
- **Devices** → **Device groups** tab: automation level grupe prema attack disruptionu (isti nivoi kao gore).
- **Devices** → **IPs**: IP adrese, opsezi i subneti koji se ne containuju.
- **Devices** → **Policy application** (preview): za uređaje sa dynamic tagom isključiš samo određene disruption kontrole.

Microsoft ne preporučuje exclusions jer smanjuju zaštitu. Potpuni opt-out ide samo preko support zahtjeva („Attack disruption opt-out“); alarmi i dalje stižu, samo bez automatskih akcija.

> **Na ispitu:** „Attack disruption ne smije nikad onemogućiti break-glass nalog emergency-admin, a sve ostalo treba ostati automatski.“ Odgovor: **user exclusion** u `Automated response > Identities`. Isključivanje attack disruptiona ili postavljanje svih grupa na No automated response je previše.

Pazi i na vlastitu automatizaciju: skripta koja redovno ponovo uključuje sve naloge zaposlenih može poništiti disable koji je uradio attack disruption.

## Microsoft Sentinel automation rules

**Automation rules** centralno upravljaju odgovorom na incidente i alarme bez pisanja koda. Putanja: `Microsoft Sentinel > Configuration > Automation > Automation rules` (u Defender portalu), ili iz **Automated response** taba analytics pravila.

### Triggeri

| Trigger | Okida kada |
|---|---|
| **When incident is created** | u Defender portalu: nastane incident u Defender portalu (bilo kojeg izvora) |
| **When incident is updated** | promjena statusa, ownera, severityja, dodani alarmi, komentari, tagovi, taktike |
| **When alert is created** | alarm iz Sentinel **Scheduled** ili **NRT** pravila |

U Defender portalu alert trigger radi samo za **Sentinel** alarme; za Defender XDR alarme koristi se **Enhanced Alert Trigger** u playbooku.

### Uslovi i akcije

- **Conditions**: svojstva incidenta (ime analytics pravila, severity, status, tagovi, entiteti…), operatori equals, contains, starts with…; kod update triggera i promjene stanja (**changed**, **changed from**, **changed to**, **added**) i **Updated by** (application, user, AIR, alert grouping, playbook, automation rule, other).
- **Actions**: **Change status** (zatvaranje sa razlogom i komentarom), **Change severity**, **Assign owner**, **Add tags**, **Add task**, **Run playbook**. Akcije se izvršavaju redom.
- **Expiration date**: pravilo se isključuje nakon datuma (npr. tokom penetracionog testa).
- **Order**: pravila se izvršavaju **sekvencijalno** po broju; svaki trigger tip ima svoj red; kasnije pravilo vidi incident onako kako ga je ostavilo prethodno. Sva create pravila idu prije update pravila.

Tipični scenariji: suppression šumnih incidenata (zatvori kao benign uz expiration), automatsko dodjeljivanje vlasnika, tagovanje, liste zadataka za analitičare, pokretanje jednog playbooka za sva analytics pravila.

### Razlike u Defender portalu

- Uslov **Incident provider** je uklonjen; svi incidenti imaju provider **Microsoft XDR**, pa pravila rade i nad Defender XDR incidentima. Za ograničenje na Sentinel koristi uslov **Analytic rule name**.
- `SecurityIncident` više nema polje **Description**; pravila koja ga koriste u uslovu ne rade.
- Ne oslanjaj se na **naslov incidenta** u uslovima (korelacija ga može promijeniti); koristi ime analytics pravila i tagove.
- Od alarma do pokretanja automation rule-a može proći do **10 minuta**; više izmjena istog incidenta u 5–10 minuta šalje se kao jedna (zadnja) izmjena.
- Kreiranje automation rule-a direktno iz incidenta postoji samo u Azure portalu; u Defender portalu kreiraš ga na stranici **Automation**.

> **Na ispitu:** „Tokom penetracionog testa od 1. do 5. novembra sva pravila sa IP adrese 10.10.5.20 trebaju se automatski zatvoriti kao benign positive.“ Odgovor: **automation rule**, trigger incident created, uslov na IP entitet, akcija Change status → Closed (Benign Positive), **Expiration date** 5. novembar. Playbook nije potreban.

## Microsoft Sentinel playbooks

**Playbook** je workflow u **Azure Logic Apps** (Consumption ili Standard) koji izvodi složenije akcije: obogaćivanje (WHOIS, geolokacija), sinhronizacija sa ticketing sistemom (ServiceNow), obavještenja (Teams, Slack, email), odgovor (blokiranje korisnika u Entra ID, izolacija uređaja preko MDE API-ja, blokiranje IP-a na firewallu).

### Triggeri

- **Microsoft Sentinel incident**: preporučen; incident ima alarme, entitete i komentare.
- **Microsoft Sentinel alert**: za alarme iz pravila koja ne prave incidente.
- **Microsoft Sentinel entity**: ručno pokretanje nad entitetom.

Iz automation rule-a mogu se pokretati samo playbookovi sa **istim tipom triggera** (incident → incident, alert → alert). U Defender portalu ručno pokretanje playbooka nad **alarmom** ili **entitetom** trenutno nije podržano; nad incidentom jeste, kada se incident sinhronizuje sa Sentinelom.

### Dozvole

| Uloga | Svrha |
|---|---|
| **Owner** / **User Access Administrator** | dodjela dozvola Sentinelu nad resource grupom playbooka |
| **Microsoft Sentinel Contributor** | vezivanje playbooka za analytics ili automation rule |
| **Microsoft Sentinel Responder** | pristup incidentu radi ručnog pokretanja, ali ne i samo pokretanje |
| **Microsoft Sentinel Playbook Operator** | ručno pokretanje playbooka |
| **Microsoft Sentinel Automation Contributor** | dodjeljuje se **Sentinel servisnom nalogu**, ne korisniku; omogućava automation rules da pokreću playbookove |
| **Logic App Contributor** (Consumption) | uređivanje i pokretanje playbooka |
| **Logic Apps Standard Developer / Contributor / Operator** (Standard) | rad sa Standard logic appovima |

Kada automation rule pokreće playbook, koristi se **Microsoft Sentinel servisni nalog** koji mora imati ulogu **Microsoft Sentinel Automation Contributor** na **resource grupi** gdje je playbook. U wizardu automation rule-a playbook bez te dozvole je siv; link **Manage playbook permissions** dodjeljuje ulogu (za to treba Owner na toj resource grupi). U MSSP scenariju sa Azure Lighthouse treba delegacija za aplikaciju **Azure Security Insights** sa istom ulogom.

Za autentikaciju playbooka prema drugim servisima Microsoft preporučuje **managed identity** logic appa umjesto korisničkih kredencijala u konekcijama.

Playbook templateovi (preview) dolaze iz **Content huba** i sa GitHub repozitorija Azure-Sentinel; aktivni playbookovi se vide u tabu **Active playbooks**, templateovi u **Playbook templates**.

> **Na ispitu:** „Automation rule ne može odabrati playbook; playbook je siv u listi.“ Sentinel servisni nalog nema **Microsoft Sentinel Automation Contributor** na resource grupi playbooka. Rješenje: **Manage playbook permissions** (kao Owner resource grupe). Dodjela Logic App Contributor analitičaru ne rješava problem.

## Automation rule ili playbook?

| Zahtjev | Rješenje |
|---|---|
| Promjena statusa, severityja, ownera, tagova, dodavanje zadataka | **automation rule** |
| Privremeno zatvaranje šumnih incidenata | **automation rule** sa expiration date |
| Obogaćivanje podacima iz vanjskog API-ja | **playbook** |
| Ticket u ServiceNow i dvosmjerna sinhronizacija | **playbook** (incident created + incident updated automation rules) |
| Poruka u Teams kanal | **playbook** |
| Isti playbook za sva analytics pravila | **automation rule** bez uslova na pravilo, akcija Run playbook |
| Izolacija uređaja kada detekcija nad Defender podacima okine | **custom detection** akcija ili attack disruption, ne nužno playbook |

## Praćenje automatizacije

Kada je uključen health monitoring za automatizaciju, izvršavanja automation rules (uključujući pokretanje playbookova) bilježe se u `SentinelHealth`:

```kql
SentinelHealth
| where TimeGenerated > ago(7d)
| where SentinelResourceType == "Automation rule"
| summarize Runs = count(), Failures = countif(Status != "Success") by SentinelResourceName
| order by Failures desc
```

Pregled akcija u Defender XDR-u kroz advanced hunting, npr. koji alarmi su nastali iz koje detekcije i koliko ih je po izvoru:

```kql
AlertInfo
| where Timestamp > ago(7d)
| summarize Alerts = count() by ServiceSource, DetectionSource, Severity
| order by Alerts desc
```

## Lab: provjera prije automatizacije

Prije nego što automation rule automatski zatvara incidente za neku IP adresu, provjeri u labu koliko je aktivnosti sa nje i da li je zaista samo test:

```kql
SecurityEvent
| where IpAddress == "10.10.5.20"
| summarize Events = count(), Accounts = dcount(Account), Computers = dcount(Computer) by EventID
```

I prije ASR ili custom detection akcija, koje procese bi pogodilo pravilo:

```kql
DeviceProcessEvents
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "powerpnt.exe")
| summarize Executions = count(), Devices = dcount(DeviceName) by FileName
| order by Executions desc
```

## Rezime

- Email notifikacije: `Settings > Microsoft Defender XDR > Email notifications`, tabovi **Incidents**, **Actions** (manual/automated, device groups, status) i **Threat analytics**; treba **Manage security settings**.
- **Alert tuning** (ranije suppression): Hide alert (samo MDE), Resolve alert, Set as behavior; do 200 uslova; ne važi za custom detekcije. Correlation radi Defender XDR; **Restrict correlation to within scoped device groups** je opcija u MDE advanced features.
- MDE **advanced features**: EDR in block mode, automatically resolve alerts, allow or block file, custom network indicators, tamper protection, live response (i za servere, i unsigned skripte), device discovery…
- **Rules** u MDE: indicators (Allow, Audit, Warn, Block execution, Block and remediate), **Custom Data Collection** (MDE P2, Sentinel workspace, samo dynamic tags, tabele `DeviceCustom*`, 75.000 evenata po pravilu po uređaju u 24h).
- **ASR**: Audit → analiza (`DeviceEvents`, `ActionType` počinje sa `Asr`) → exclusions → Block; konfiguracija kroz Intune ili security settings management.
- **AIR**: od 1. 9. 2026. u MDE nije zasebna istraga ni ručni trigger, radi kroz AV zaštitu; Action center (Pending/History) i automation levels i dalje upravljaju remediationom; MDO AIR ostaje.
- **Automation levels**: Full (preporučeno), tri Semi varijante, No automated response; postavljaju se po **device grupi** (rank, pravila po tagu/OS-u, user access).
- **Attack disruption**: contain device/user, disable user; exclusions za identitete, device grupe, IP-ove i policy application; opt-out samo preko supporta.
- **Automation rules**: triggeri incident created/updated i alert created, uslovi, akcije, order, expiration; u Defender portalu nema Incident provider uslova.
- **Playbooks**: Logic Apps; Sentinel servisni nalog treba **Microsoft Sentinel Automation Contributor** na resource grupi playbooka; managed identity za autentikaciju.
