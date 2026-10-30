## Ciljevi ispita: 1.3

Ovaj modul pokriva cilj **1.3 Ingest data into the Microsoft Sentinel SIEM and platform** iz domena 1 (Manage a security operations environment, 40–45%). Bulleti iz zvaničnog study guidea (stanje od 21. 10. 2026):

- izbor data konektora prema zahtjevima izvora, uključujući Windows logove i security evente,
- prikupljanje Windows Security evenata konektorom **Windows Security Events via AMA**, uključujući **data collection rules (DCR)**,
- planiranje i konfiguracija prikupljanja preko **Windows Event Forwarding (WEF)**,
- planiranje i konfiguracija konektora **Syslog via AMA** i **Common Event Format (CEF) via AMA**,
- prikupljanje **Azure activity** logova pomoću **Azure Policy** i **resource diagnostic settings**,
- unos **threat indicators** u Sentinel,
- kreiranje **custom log tabela** u workspaceu.

Ispitna pitanja iz ovog cilja rijetko pitaju „šta je konektor“. Tipičan scenarij glasi: „Imate 300 Windows servera on-premises i Linux forwarder za firewall. Trebate prikupiti samo evente 4624 i 4625 i minimizovati troškove. Šta trebate uraditi?“ Odgovor zavisi od tri stvari: **koji agent** (AMA, ne legacy), **koja tabela** završi sa podacima i **gdje se filtrira** (DCR na izvoru ili transformacija).

> Napomena o portalu: Microsoft Sentinel u Azure portalu prestaje biti podržan **nakon 31. marta 2027.** i tada ostaje samo u **Microsoft Defender portalu**. Putanje u ovom modulu navodimo za Defender portal (`Microsoft Sentinel > Configuration > Data connectors`), a gdje je bitno, i za Azure portal.

## Kako podaci stižu u Sentinel

Sentinel je nadogradnja nad **Log Analytics workspaceom**. Svaki konektor na kraju upisuje redove u neku tabelu workspacea. Postoji nekoliko mehanizama unosa:

| Mehanizam | Primjeri izvora | Tipična tabela |
|---|---|---|
| **Service-to-service (API) konektori** | Microsoft Entra ID, Microsoft 365, Defender XDR | `SigninLogs`, `AuditLogs`, `OfficeActivity` |
| **Diagnostic settings** | Azure resursi, Azure Activity, Key Vault | `AzureActivity`, `AzureDiagnostics` ili resource-specific tabele |
| **Azure Monitor Agent (AMA) + DCR** | Windows serveri, Linux mašine, log forwarder | `SecurityEvent`, `WindowsEvent`, `Syslog`, `CommonSecurityLog` |
| **Codeless Connector Framework (CCF)** | SaaS API-ji partnera | vendor tabele, često `_CL` |
| **Logs Ingestion API** | vlastita aplikacija, skripta | custom tabela `_CL` |
| **Threat intelligence konektori / upload API** | TAXII serveri, TIP platforme | `ThreatIntelIndicators`, `ThreatIntelObjects` |

Konektori se instaliraju kroz **Content hub**: instaliraš **solution** (npr. „Windows Security Events“, „Common Event Format“, „Syslog“, „Threat Intelligence“), a ona donosi konektor, analytics rule templateove, workbookove i parsere. Na ispitu je česta zamka odgovor „u Data connectors galeriji odaberi konektor“ kada konektor nije ni instaliran: prvo **Content hub**, pa konektor.

Putanja u Defender portalu:

1. `Microsoft Sentinel > Content management > Content hub` → pronađi solution → **Install**.
2. `Microsoft Sentinel > Configuration > Data connectors` → odaberi konektor → **Open connector page**.
3. Na stranici konektora: prerequisites, pa konfiguracija (npr. **+Create data collection rule**).

## Izbor konektora za Windows logove

Za Windows postoje dva AMA konektora i oni pišu u **različite tabele**. To je najčešća zamka u ovom cilju.

| Zahtjev | Konektor | Tabela |
|---|---|---|
| Security log sa servera (direktno sa svake mašine) | **Windows Security Events via AMA** | `SecurityEvent` |
| Eventi koje WEF već skuplja na kolektoru (WEC) | **Windows Forwarded Events** | `WindowsEvent` |
| Ostali Windows event logovi (System, Application, Sysmon) | DCR kroz Azure Monitor (Windows Event Logs) | `Event` |
| DNS server logovi | **Windows DNS Events via AMA** | `ASimDnsActivityLogs` |
| Windows Firewall logovi | **Windows Firewall Events via AMA** | `ASimNetworkSessionLogs` |

Zvanična dokumentacija eksplicitno kaže: eventi prikupljeni preko Windows Event Forwardinga upisuju se u `WindowsEvent`, **uključujući** one iz Security loga, a **ne** u `SecurityEvent`. Mnoga ugrađena analytics pravila (i neka NRT pravila) čitaju `SecurityEvent` i neće vidjeti podatke koji postoje samo u `WindowsEvent`. Ako ti trebaju ta pravila bez izmjena, koristi Windows Security Events via AMA; u suprotnom prilagodi upite na `WindowsEvent` ili koristi **ASIM** parsere.

> **Na ispitu:** ako scenarij kaže „ugrađena analytics pravila za Windows Security evente moraju raditi bez izmjena“, odgovor je **Windows Security Events via AMA** (tabela `SecurityEvent`). Ako kaže „organizacija već ima WEF infrastrukturu i ne smije se instalirati agent na svaki server“, odgovor je **Windows Forwarded Events** na WEC serveru (tabela `WindowsEvent`) uz ASIM parsere.

### Legacy agent

**Log Analytics agent (MMA/OMS)** je penzionisan (avgust 2024). Svi novi scenariji idu preko **Azure Monitor Agenta**. Ako ponuđeni odgovor kaže „instaliraj Log Analytics agent i uključi Security Events konektor“, to je distraktor. Isto važi za stari CEF tok sa OMS agentom na forwarderu: zamijenjen je sa **CEF via AMA**.

## Windows Security Events via AMA i DCR

### Preduslovi

- Read i write dozvole na Sentinel workspaceu.
- Mašina koja **nije Azure VM** (fizički server, on-premises VM, VM u drugom cloudu) mora imati instaliran i uključen **Azure Arc** (Connected Machine agent) **prije** nego što omogućiš AMA konektor. Bez Arca mašina se ne pojavljuje u listi resursa u DCR wizardu.
- Instaliran solution „Windows Security Events“ iz Content huba.

### Kreiranje DCR-a u portalu

1. `Microsoft Sentinel > Configuration > Data connectors` → **Windows Security Events via AMA** → **Open connector page**.
2. Pod **Configuration** odaberi **+Create data collection rule**.
3. **Basics**: ime pravila, subscription i resource group u kojoj DCR živi. DCR ne mora biti u istoj resource grupi ili subscriptionu kao mašine, dovoljno je da su u istom tenantu.
4. **Resources**: **+Add resource(s)**, pa odaberi subscription, resource grupe ili pojedinačne mašine (Azure VM i Arc-enabled serveri). Wizard instalira AMA na odabrane mašine koje ga nemaju.
5. **Collect**: odaberi event set.
6. **Review + create** → **Create**.

Sve DCR-ove, uključujući one kreirane preko API-ja, vidiš kasnije na stranici konektora pod **Configuration**, gdje ih možeš uređivati ili brisati.

### Event setovi

| Event set | Šta prikuplja | Kada |
|---|---|---|
| **All events** | sve Windows security i AppLocker evente | potpuni audit, forenzika, veći trošak |
| **Common** | standardni skup za audit trail (logon, upravljanje nalozima, promjene politika…) | preporučeni balans |
| **Minimal** | mali skup koji može ukazati na prijetnju; nije potpun audit trail | minimalan trošak uz osnovnu detekciju |
| **Custom** | tvoje **XPath** upite | tačno određeni EventID-ovi ili logovi |

Za **Custom** unosiš XPath izraze. AMA podržava samo **XPath 1.0**. Prema dokumentaciji, u jedno polje možeš unijeti do 20 izraza, a jedno pravilo može imati do 100 polja. Primjer XPath upita koji uzima samo uspješne i neuspješne logone iz Security loga:

```text
Security!*[System[(EventID=4624 or EventID=4625)]]
```

XPath možeš testirati lokalno PowerShell cmdletom `Get-WinEvent` sa parametrom `-FilterXPath`:

```powershell
$XPath = '*[System[(EventID=4624 or EventID=4625)]]'
Get-WinEvent -LogName 'Security' -FilterXPath $XPath -MaxEvents 5
```

Ako dobiješ „The specified query is invalid“, sintaksa nije ispravna. Ako dobiješ „No events were found…“, upit može biti ispravan, samo lokalno nema takvih evenata.

> **Na ispitu:** „Trebate prikupljati samo EventID 4624, 4625 i 4688 sa Windows servera i **minimizovati troškove unosa**.“ Ispravno je **Custom** event set sa XPath upitom u DCR-u. Filtriranje u DCR-u se dešava **na izvoru** (agent ne šalje ostalo), pa se to ne plaća. Odgovori „prikupi All events pa obriši višak upitom“ ili „napravi analytics rule koji ignoriše ostale evente“ ne smanjuju trošak.

### Šta je zapravo DCR

**Data collection rule** je samostalan Azure resurs koji opisuje:

- **dataSources**: šta se skuplja (npr. `windowsEventLogs` sa streamom `Microsoft-SecurityEvent` i `xPathQueries`),
- **destinations**: u koji workspace ide,
- **dataFlows**: koji stream ide u koju destinaciju, opcionalno sa transformacijom (`transformKql`).

DCR se sa mašinom povezuje preko **DCR association (DCRA)**. Jedna mašina može imati više DCR-ova, a jedan DCR se može vezati za mnogo mašina. Zato DCR-ovi skaliraju: definišeš jednom i dodijeliš grupi servera. MSSP-ovi i timovi sa infrastrukturom kao kodom kreiraju DCR-ove preko REST API-ja ili ARM/Bicep templateova umjesto kroz wizard.

### Provjera da podaci stižu

Nakon kreiranja DCR-a prvo provjeri da AMA šalje heartbeat, pa da li stižu eventi:

```kql
Heartbeat
| where TimeGenerated > ago(1h)
| where Category == "Azure Monitor Agent"
| summarize LastHeartbeat = max(TimeGenerated) by Computer, OSType
| order by LastHeartbeat desc
```

```kql
SecurityEvent
| where TimeGenerated > ago(1d)
| summarize Events = count() by Computer, EventID
| order by Events desc
```

Ako mašina ima heartbeat, a nema `SecurityEvent` redova, provjeri da li je DCR povezan sa tom mašinom i da li XPath stvarno pogađa evente koji postoje.

## Windows Event Forwarding (WEF)

**Windows Event Forwarding** je ugrađeni Windows mehanizam: izvorne mašine (source computers) šalju evente na **Windows Event Collector (WEC)** server preko WinRM-a, prema **subscription** konfiguraciji (najčešće source-initiated, distribuirano kroz Group Policy). Eventi završavaju u logu **Forwarded Events** na kolektoru.

Zašto bi to koristio umjesto agenta na svakom serveru:

- politika organizacije ne dozvoljava instalaciju dodatnih agenata na domain controllere ili osjetljive servere,
- WEF infrastruktura već postoji i dobro je podešena,
- mreža dozvoljava izlaz prema internetu (443) samo sa nekoliko kolektora.

### Planiranje

1. Na izvornim mašinama podesi audit politike (Advanced Audit Policy) da se željeni eventi uopšte generišu.
2. Konfiguriši WEC server i subscription (koji eventi, sa kojih mašina). Filtriranje u WEF subscriptionu smanjuje promet i opterećenje kolektora.
3. Na WEC serveru instaliraj **AMA**. Ako WEC nije Azure VM, prvo ga onboarduj u **Azure Arc**.
4. U Sentinelu instaliraj solution i otvori konektor **Windows Forwarded Events**, kreiraj DCR sa WEC serverom kao resursom.
5. Deployaj **ASIM** parsere za `WindowsEvent` (dokumentacija to preporučuje radi normalizacije).
6. Provjeri da analytics pravila koja koristiš čitaju `WindowsEvent` ili ASIM, ne samo `SecurityEvent`.

Skaliranje: jedan WEC ima ograničen kapacitet, pa velike okoline koriste više kolektora (npr. po lokaciji ili po tipu servera) i dijele subscriptione.

```kql
WindowsEvent
| where TimeGenerated > ago(1d)
| where Channel == "Security"
| summarize Events = count() by Computer, EventID
| order by Events desc
```

> **Na ispitu:** „Nakon uključivanja Windows Forwarded Events konektora, ugrađeno pravilo za brute force (koje čita `SecurityEvent`) ne generiše alarme, iako eventi stižu.“ Uzrok: eventi su u `WindowsEvent`. Rješenje: prilagoditi upit ili koristiti ASIM parser, odnosno prikupljati direktno konektorom Windows Security Events via AMA.

## Syslog via AMA i CEF via AMA

### Razlika između Syslog i CEF

- **Syslog** je opšti format poruka sa Linux mašina i mrežnih uređaja. Završava u tabeli `Syslog` (kolone `Facility`, `SeverityLevel`, `SyslogMessage`, `HostName`…).
- **CEF (Common Event Format)** je strukturisani format nad Syslogom koji koriste mnogi firewall i security uređaji (`CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|Extension`). Završava u tabeli `CommonSecurityLog` (kolone `DeviceVendor`, `DeviceProduct`, `SourceIP`, `DestinationIP`, `Activity`…).

Ako uređaj podržava CEF, biraj **CEF via AMA**: dobijaš parsirane kolone i ugrađena pravila koja čitaju `CommonSecurityLog`.

### Arhitektura sa log forwarderom

```text
[Firewall / appliance] --syslog/CEF (514 UDP/TCP)--> [Linux forwarder: rsyslog ili syslog-ng + AMA] --HTTPS 443--> [Log Analytics workspace]
```

Uređaji ne mogu imati agenta, pa šalju poruke na **Linux log forwarder**. Na forwarderu syslog daemon (rsyslog ili syslog-ng) prima poruke na portu 514 i prosljeđuje ih lokalno AMA-i (port 28330), a AMA ih šalje u workspace.

### Preduslovi forwardera

- Namjenski Linux VM sa podržanim OS-om za AMA.
- Ako nije Azure VM, mora imati **Azure Arc Connected Machine agent**.
- Python 2.7 ili 3 (za instalacionu skriptu).
- Uključen `rsyslog` ili `syslog-ng`.
- Uloge: **Virtual Machine Contributor** ili **Azure Connected Machine Resource Administrator** (instalacija agenta) i **Monitoring Contributor** (kreiranje DCR-a).
- Ako uređaji šalju preko interneta (forwarder u cloudu), podesi TLS u syslog daemonu.

### Koraci

1. Iz Content huba instaliraj solution za uređaj ili opšti „Common Event Format“ / „Syslog“ solution.
2. `Data connectors` → **Common Event Format (CEF) via AMA** (ili **Syslog via AMA**) → **Open connector page** → **+Create data collection rule**.
3. **Resources**: odaberi forwarder VM (ako ga nema u listi, vjerovatno nema Arc agent).
4. **Collect**: za svaki **facility** odaberi **minimalni log level**. Odabir `LOG_ERR` prikuplja `LOG_ERR`, `LOG_CRIT`, `LOG_ALERT` i `LOG_EMERG`.
5. **Review + create**. Wizard instalira AMA na forwarder.
6. Na forwarderu pokreni instalacionu skriptu sa stranice konektora:

```bash
sudo wget -O Forwarder_AMA_installer.py https://raw.githubusercontent.com/Azure/Azure-Sentinel/master/DataConnectors/Syslog/Forwarder_AMA_installer.py && sudo python3 Forwarder_AMA_installer.py
```

Skripta podešava rsyslog ili syslog-ng da sluša na portu **514 UDP i TCP** i restartuje daemon.

7. Na uređaju podesi slanje logova na IP forwardera.
8. Testiraj (`netstat -lnptv` za listener, `logger` za testnu poruku) i provjeri u workspaceu:

```kql
CommonSecurityLog
| where TimeGenerated > ago(1d)
| summarize Events = count() by DeviceVendor, DeviceProduct
| order by Events desc
```

```kql
Syslog
| where TimeGenerated > ago(1d)
| summarize Events = count() by Facility, SeverityLevel
| order by Events desc
```

### Dupliranje podataka

Ako isti **facility** koristiš i za Syslog i za CEF stream, iste poruke mogu završiti i u `Syslog` i u `CommonSecurityLog`, pa plaćaš duplo. Rješenje: razdvoji facilityje (npr. CEF uređaji šalju na `local4`, a Syslog DCR ne uzima `local4`) ili u DCR-u filtriraj transformacijom.

> **Na ispitu:** „CEF poruke sa firewalla stižu i u `Syslog` i u `CommonSecurityLog` tabelu.“ Odgovor: Syslog i CEF DCR koriste **isti facility**; ukloni taj facility iz Syslog DCR-a. Odgovor „isključi CEF konektor“ gubi parsirane kolone.

Skaliranje: za veliki volumen koristi više forwardera (npr. Virtual Machine Scale Set iza load balancera sa round-robin raspodjelom) i podesi daemon da ne čuva nepotrebne logove lokalno, jer pun disk zaustavlja AMA.

## Azure activity logovi: Azure Policy i diagnostic settings

**Azure Activity log** bilježi operacije na nivou subscriptiona (control plane): ko je kreirao, obrisao ili izmijenio resurs, promjene RBAC-a, Service Health. U Sentinelu završava u tabeli `AzureActivity`.

### Kako se povezuje

Konektor **Azure Activity** koristi **diagnostic settings** pipeline: na nivou subscriptiona se kreira diagnostic setting koji šalje Activity log u workspace. Da to ne bi radio ručno za svaki subscription, konektor nudi **Azure Policy** dodjelu:

1. `Data connectors` → **Azure Activity** → **Open connector page** → **Launch Azure Policy Assignment wizard**.
2. Policy: **Configure Azure Activity logs to stream to specified Log Analytics workspace**.
3. **Scope**: management grupa ili subscription (Activity log je na nivou subscriptiona, pa resource grupa nije smislen scope).
4. **Parameters**: odaberi Sentinel workspace.
5. **Remediation**: označi **Create a remediation task**. Policy sa efektom `DeployIfNotExists` sama pokriva nove subscriptione, ali za **postojeće** treba remediation task.
6. **Review + create**.

Za dodjelu policy-ja treba uloga **Owner** (ili druga koja može dodijeliti politiku i dati managed identity-ju potrebna prava) na scopeu dodjele.

> **Na ispitu:** „Policy je dodijeljena na management grupu, novi subscriptioni šalju `AzureActivity`, ali postojeći ne.“ Nedostaje **remediation task**. Ako je ponuđeno „sačekaj 24 sata“, to je distraktor: `DeployIfNotExists` ne mijenja postojeće resurse bez remediationa.

Ako si koristio stari (legacy) način povezivanja Activity loga, dokumentacija traži da prvo **odspojiš subscriptione sa legacy metoda**, pa tek onda uključiš novi konektor, inače dobijaš duple podatke.

### Diagnostic settings za ostale Azure resurse

Za resurse poput Key Vaulta, Storage accounta, NSG-a ili Azure Firewalla logovi se također šalju preko **diagnostic settings** (`Resource > Monitoring > Diagnostic settings > Add diagnostic setting > Send to Log Analytics workspace`). Mnogi Sentinel konektori za Azure servise imaju istu opciju sa Azure Policy dodjelom (npr. „Deploy - Configure diagnostic settings for … to Log Analytics workspace“) da pokriju sve resurse tog tipa.

Destinacija može biti **Azure diagnostics** mod (sve u `AzureDiagnostics`) ili **Resource specific** mod (posebne tabele po kategoriji, npr. `AZFWNetworkRule` za Azure Firewall). Resource specific je preporučen: manja tabela, jasnija šema, brži upiti.

```kql
AzureActivity
| where TimeGenerated > ago(7d)
| where OperationNameValue has "roleAssignments/write"
| where ActivityStatusValue == "Success"
| project TimeGenerated, Caller, CallerIpAddress, ResourceGroup, _ResourceId
| order by TimeGenerated desc
```

## Threat indicators

### Izvori threat intelligence

| Metod | Šta radi | Status |
|---|---|---|
| **Microsoft Defender Threat Intelligence** konektor | Microsoftovi IOC-i; standard (javni IOC, OSINT) i premium (Microsoft IOC, obogaćeni OSINT) | aktivan |
| **Threat Intelligence - TAXII** konektor | ugrađeni TAXII klijent povlači STIX 2.0/2.1 sa TAXII 2.x servera; treba **API root** i **collection ID** | aktivan |
| **Threat Intelligence upload API** | TIP ili vlastita aplikacija šalje STIX objekte REST-om; **ne treba konektor**; Entra aplikacija treba ulogu **Microsoft Sentinel Contributor**; endpoint je na nivou workspacea | preporučen za TIP integracije |
| **Threat Intelligence Platforms** konektor | stari tiIndicators Graph API, samo indikatori | **ide u deprecation** |
| Ručno kreiranje / import fajla | analitičar kreira STIX objekat ili uvozi fajl u upravljačkom interfejsu | aktivan |

Svi konektori su dio solutiona **Threat Intelligence** u Content hubu. U Defender portalu TI se upravlja pod **Threat intelligence > Intel management** (u Azure portalu `Microsoft Sentinel > Threat management > Threat intelligence`).

> **Na ispitu:** „Organizacija koristi TIP koji podržava STIX i REST, i traži rješenje koje podržava i druge STIX objekte (threat actor, attack pattern), ne samo indikatore.“ Odgovor: **Threat Intelligence upload API**. Konektor **Threat Intelligence Platforms** podržava samo indikatore i ide u deprecation. Ako izvor nudi **TAXII 2.x** server, odgovor je **Threat Intelligence - TAXII** konektor.

### Tabele

- `ThreatIntelIndicators`: STIX indikatori (IP, domen, URL, hash, certifikat…).
- `ThreatIntelObjects`: ostali STIX objekti (threat actor, attack pattern, identity, relationship).
- Stara tabela `ThreatIntelligenceIndicator` više ne prima podatke (unos je zaustavljen nakon 31. jula 2025). Upite, pravila i workbookove treba prebaciti na nove tabele.

Sentinel periodično (svakih 7–10 dana) ponovo upisuje sve TI podatke radi efikasnosti upita, a deduplikacija ide po polju `Id`: važi verzija sa najnovijim `TimeGenerated`. Zato se u upitima uzima posljednja verzija indikatora:

```kql
ThreatIntelIndicators
| where TimeGenerated > ago(14d)
| summarize arg_max(TimeGenerated, *) by Id
| where IsActive == true and ValidUntil > now()
| where ObservableKey == "ipv4-addr:value"
| project IndicatorIp = ObservableValue, Confidence, ValidUntil
```

### Ingestion rules za TI

**Ingestion rules** filtriraju ili mijenjaju TI objekte iz **konektora** prije upisa: npr. odbaci indikatore sa niskim confidence koji nisu ažurirani 6 mjeseci, produži `Valid until` za pouzdane izvore, dodaj tag. Pravila se izvršavaju redom dok neko ne izvrši **Delete**. Ne utiču na podatke iz upload API-ja ni na ručno kreirane objekte, a nova pravila stupaju na snagu za do 15 minuta.

### Korištenje indikatora

TI se koristi kroz analytics pravila iz templateova (matching po tipu indikatora i izvoru podataka) i kroz **Microsoft Threat Intelligence Analytics** pravilo (matching analytics) koje Microsoftove indikatore poredi sa CEF, Syslog i Windows DNS podacima. Više o tome u modulu o detekcijama.

## Custom log tabele

Kada izvor nema gotov konektor, podatke šalješ u **custom tabelu**:

- ime custom tabele **završava na `_CL`** (portal dodaje sufiks automatski; preko CLI, API-ja ili templatea dodaješ ga sam),
- svaka tabela mora imati kolonu `TimeGenerated`; ako je nema u podacima, Azure Monitor je dodaje u transformaciju,
- custom kolone u **Azure (ugrađenim)** tabelama završavaju na `_CF`.

### Table planovi

| Plan | Namjena |
|---|---|
| **Analytics** (default) | podaci za detekcije, analytics pravila i interaktivne upite |
| **Basic** | logovi koje rijetko pretražuješ, jeftiniji unos, ograničen KQL |
| **Auxiliary / Lake** | veliki volumen, niska vrijednost za detekciju; u Sentinelu se mapira na **data lake** tier |

Detaljnije o tierovima i retencijama (Analytics, Data lake, XDR) u modulu o Sentinel platformi. Ovdje je bitno: plan biraš pri **kreiranju** tabele, prema tome da li ti podaci trebaju za real-time detekciju.

### Kreiranje DCR-based custom tabele (portal)

1. `Log Analytics workspace > Tables > Create > New custom log (DCR-based)`.
2. Ime tabele (bez `_CL`), opcionalno opis, **Table plan**.
3. Odaberi postojeći DCR ili **Create a new data collection rule**.
4. Odaberi **data collection endpoint (DCE)** ako je potreban.
5. **Browse for files**: uploaduj JSON sa uzorkom podataka.
6. **Transformation editor**: napiši KQL transformaciju, **Run**, pa **Apply**.
7. Pregledaj šemu, **Create**.

Za slanje podataka iz aplikacije koristi **Logs Ingestion API**: aplikacija (Entra app registration ili managed identity sa ulogom **Monitoring Metrics Publisher** na DCR-u) šalje JSON na endpoint DCR-a. DCR tipa **Direct** ima vlastiti `logsIngestion` endpoint i ne traži poseban DCE.

Druge varijante custom unosa preko AMA: **Custom Logs via AMA** konektor za tekstualne i JSON fajlove sa VM-a (DCR sa izvorom tipa text/JSON log).

> **Na ispitu:** „Aplikacija u vlastitom data centru treba slati JSON zapise u Sentinel, a polje `EventTime` treba postati `TimeGenerated`.“ Odgovor: custom tabela `_CL` + DCR sa transformacijom + **Logs Ingestion API**. HTTP Data Collector API (stari način) i MMA custom logs su legacy i nisu ispravan odgovor.

## DCR transformacije u KQL-u

**Transformacija** je KQL upit u DCR-u (`transformKql`) koji se izvršava nad **svakim dolaznim zapisom prije upisa** u tabelu. Ulaz je virtuelna tabela `source`. Koristi se za:

- **filtriranje redova** (smanjenje troška, odbacivanje šuma),
- **uklanjanje ili maskiranje kolona** (npr. lični podaci),
- **parsiranje** i dodavanje kolona,
- **rutiranje** u drugu tabelu (više dataFlow-ova iz istog streama).

Ograničenja: transformacija radi zapis po zapis, pa ne podržava operatore koji gledaju više redova ili tabela, kao što su `summarize`, `join`, `union`, `top`, `sort`. Dozvoljeni su `where`, `extend`, `project`, `project-away`, `project-rename`, `parse`, skalarne funkcije poput `parse_json()`, `tostring()`, `todatetime()`, `iif()`, `case()`, `split()`, `strcat()`, `substring()` i slično.

Primjer 1: transformacija za custom tabelu iz aplikacije. Pretvara polje vremena u `TimeGenerated`, odbacuje debug poruke i maskira korisničko ime:

```kql
source
| extend TimeGenerated = todatetime(EventTime)
| where Severity != "Debug"
| extend UserMasked = strcat(substring(UserName, 0, 2), "***")
| project TimeGenerated, Computer, Severity, Message, UserMasked
```

Primjer 2: transformacija u DCR-u za Syslog koja odbacuje informativne poruke sa jednog facilityja, a ostalo propušta:

```kql
source
| where not(Facility == "daemon" and SeverityLevel in ("info", "debug"))
```

Primjer 3: smanjenje kolona u `SecurityEvent` streamu (zadrži samo ono što koriste detekcije):

```kql
source
| where EventID in (4624, 4625, 4672, 4688, 4720, 4732)
| project-away EventData
```

### Workspace transformation DCR

Za tabele koje se pune mehanizmom koji **ne koristi DCR** (npr. neki diagnostic settings tokovi), transformaciju definišeš u **workspace transformation DCR** (`Log Analytics workspace > Tables > ... > Create transformation`). Workspace može imati samo jedan takav DCR, a u njemu po jednu transformaciju za svaku podržanu tabelu.

| Gdje filtrirati | Kada |
|---|---|
| XPath u DCR-u (Windows) | znaš tačne EventID-ove; agent ništa drugo ni ne čita |
| Facility i log level u DCR-u (Syslog/CEF) | grubo filtriranje po izvoru i težini |
| `transformKql` u DCR-u | filtriranje po sadržaju poruke, maskiranje, parsiranje, rutiranje |
| Workspace transformation DCR | tabele koje ne dolaze kroz DCR |
| TI ingestion rules | samo za threat intelligence iz konektora |

### Praćenje volumena

Prije i poslije uvođenja filtera provjeri koliko podataka stvarno ulazi:

```kql
Usage
| where TimeGenerated > ago(30d)
| where IsBillable == true
| summarize IngestedGB = round(sum(Quantity) / 1024, 2) by DataType
| order by IngestedGB desc
```

## Lab: provjera podataka u labu

U labu (alat `lokql`) imaš `SecurityEvent`, `DeviceProcessEvents`, `AzureFirewall` i `StormEvents`. Upiti iz ovog modula koji čitaju `SecurityEvent` rade lokalno. Primjer: koliko bi evenata ostalo kada bi DCR prikupljao samo logone (4624 i 4625):

```kql
SecurityEvent
| summarize Total = count(), Logons = countif(EventID in (4624, 4625))
| extend PercentKept = round(100.0 * Logons / Total, 1)
```

I koje vrste prometa iz Azure Firewalla dominiraju, što pomaže da odlučiš šta filtrirati transformacijom:

```kql
AzureFirewall
| summarize Events = count() by Type, Action
| order by Events desc
```

## Rezime

- Konektori se instaliraju kroz **Content hub** (solution), pa se konfigurišu na stranici konektora. Sentinel u Azure portalu prestaje biti podržan nakon **31. marta 2027.**
- **Windows Security Events via AMA** piše u `SecurityEvent`; **Windows Forwarded Events** (WEF/WEC) piše u `WindowsEvent`, pa ugrađena pravila za `SecurityEvent` ne vide te podatke bez prilagođavanja ili ASIM-a.
- Mašine izvan Azurea trebaju **Azure Arc** prije AMA konektora. Legacy Log Analytics agent (MMA) je penzionisan.
- Event setovi: **All**, **Common**, **Minimal**, **Custom** (XPath 1.0). Filtriranje u DCR-u smanjuje trošak jer se višak ne šalje.
- **Syslog via AMA** → `Syslog`, **CEF via AMA** → `CommonSecurityLog`; Linux forwarder sa rsyslog/syslog-ng + AMA, port 514, instalaciona skripta `Forwarder_AMA_installer.py`. Isti facility za oba = duplirani podaci.
- **Azure Activity**: Azure Policy „Configure Azure Activity logs to stream to specified Log Analytics workspace“, scope subscription ili management grupa, **remediation task** za postojeće subscriptione.
- TI: **Defender Threat Intelligence**, **TAXII** (STIX 2.x), **upload API** (preporučen, bez konektora, uloga Microsoft Sentinel Contributor), TIP konektor ide u deprecation. Tabele `ThreatIntelIndicators` i `ThreatIntelObjects`.
- Custom tabele imaju sufiks **`_CL`**, plan **Analytics/Basic/Auxiliary**, podaci stižu preko **Logs Ingestion API** i DCR-a.
- **DCR transformacije** (`transformKql`, ulaz `source`) filtriraju, maskiraju i parsiraju zapis po zapis; nema `summarize` ni `join`.
