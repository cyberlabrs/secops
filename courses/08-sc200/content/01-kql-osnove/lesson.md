## Ciljevi ispita: 3.1 (prvi dio)

Domen 3 (**Perform threat hunting**) nosi 20–25% ispita, ali KQL se provlači kroz cijeli SC-200: analytics pravila, custom detekcije, workbooks, hunting upiti i istrage incidenata su svi KQL. Ovaj modul pokriva prve tri stavke cilja **3.1 Detect threats by using Microsoft Defender XDR**:

- **Identify the appropriate table to use in a KQL query** – koju tabelu otvoriti za dato pitanje,
- **Identify threats by using Kusto Query Language (KQL)** – čitanje i pisanje upita,
- **Create Advanced Hunting queries** – rad u **Advanced hunting** stranici Defender portala.

Napredni operatori (`join`, `parse`, `make-series`…) i hunting grafovi su u sljedećem modulu.

Na ispitu KQL ne izvršavaš. Dobićeš upit sa praznim mjestima („dopuni operator“), upit koji treba protumačiti („koliko redova vraća“, „šta prikazuje“) ili scenario u kojem biraš tabelu. Zato je bitno da operatore prepoznaješ napamet i da znaš njihove zamke.

## Gdje se piše KQL

Od 2025. Microsoft Sentinel radi u **Microsoft Defender portalu** (unified security operations). Sentinel u Azure portalu je podržan **do 31. marta 2027.**, nakon toga svi korisnici koriste samo Defender portal. Za KQL to znači jedno mjesto za sve:

| Mjesto | Putanja u Defender portalu | Šta se tu radi |
|---|---|---|
| **Advanced hunting** | **Investigation & response** > **Hunting** > **Advanced hunting** | Upiti nad Defender XDR tabelama i (kad je workspace povezan) nad Sentinel tabelama |
| Sentinel „Logs“ | isto: Azure portal **Logs** je u Defender portalu zamijenjen sa **Advanced hunting** | Upiti nad Log Analytics workspaceom |
| **Custom detection rules** | **Investigation & response** > **Hunting** > **Custom detection rules** | Upit koji se izvršava po rasporedu i pravi alarme |
| Data lake exploration | **Microsoft Sentinel** > **Data lake exploration** | KQL nad podacima koji su samo u data lake tieru (modul 10) |

Advanced hunting ima dva načina rada:

- **Guided mode** – query builder bez pisanja KQL-a (biraš izvor, filtere, uslove),
- **Advanced mode** – KQL editor sa IntelliSenseom, šemom tabela i primjerima.

Upit napravljen u guided modu može se prebaciti u advanced mode i dalje uređivati kao KQL.

### Ograničenja advanced huntinga

| Parametar | Vrijednost |
|---|---|
| Opseg podataka (native Defender XDR) | **30 dana** |
| Opseg za Sentinel tabele | koliko je podešena **analytics** retencija workspacea |
| Maksimalan broj redova u rezultatu | **100.000** |
| Maksimalna veličina rezultata | **64 MB** (vraća se djelimičan rezultat uz poruku) |
| Timeout upita | **10 minuta** |
| CPU | kvota po veličini tenanta, ciklus od **15 minuta**; upozorenje iznad 10%, blokada na 100% |

Podaci koji su **samo u data lake tieru** nisu vidljivi u advanced huntingu. Za njih se koristi data lake exploration ili KQL jobovi.

Svi podaci u advanced huntingu su u **UTC**. Portal rezultate prikazuje u vremenskoj zoni koju si podesio, ali upit (npr. `datetime(2026-10-01 08:00)`) piši u UTC.

> **Na ispitu:** „Treba vam pretraga Defender for Endpoint događaja starijih od 30 dana uz NAJMANJE napora“ – advanced hunting sam po sebi ne ide dalje od 30 dana. Rješenje je povezati Sentinel workspace i podići **analytics retenciju** tabele (npr. `DeviceProcessEvents`) iznad 30 dana, ili koristiti Streaming API ka eksternom skladištu. Odgovor „povećati retenciju u Defender for Endpoint postavkama“ je distraktor.

## Koja tabela? (Identify the appropriate table)

Ovo je čisto pamćenje i na ispitu nosi lake bodove. Defender XDR tabele su grupisane po prefiksu.

### Defender XDR (advanced hunting šema)

| Tabela | Šta sadrži | Tipično pitanje |
|---|---|---|
| `DeviceProcessEvents` | Pokretanje procesa, komandna linija, roditeljski proces | „Ko je pokrenuo `powershell.exe -enc`?“ |
| `DeviceNetworkEvents` | Mrežne konekcije sa uređaja (RemoteIP, RemotePort, RemoteUrl) | „Koji uređaj se spajao na IP napadača?“ |
| `DeviceFileEvents` | Kreiranje, izmjena, brisanje, preimenovanje fajlova | „Gdje je fajl sa ovim SHA256 zapisan na disk?“ |
| `DeviceRegistryEvents` | Izmjene registryja | „Ko je dodao Run ključ za perzistenciju?“ |
| `DeviceLogonEvents` | Prijave na uređaj (lokalne, RDP, mrežne) | „Neuspjele RDP prijave na server“ |
| `DeviceImageLoadEvents` | Učitavanje DLL-ova | „Koji proces je učitao sumnjiv DLL?“ |
| `DeviceEvents` | Razno: ASR, exploit zaštita, USB, AV detekcije (`ActionType` razlikuje) | „Koliko ASR blokova po pravilu?“ |
| `DeviceInfo`, `DeviceNetworkInfo` | Inventar uređaja: OS, IP adrese, mrežni adapteri | „Koji OS ima uređaj X?“ |
| `DeviceTvmSoftwareVulnerabilities` | Ranjivosti (Defender Vulnerability Management) | „Uređaji sa CVE-2026-xxxx“ |
| `EmailEvents` | Isporuka emaila: pošiljalac, primalac, verdict | „Ko je primio phishing kampanju?“ |
| `EmailAttachmentInfo` | Prilozi (ime, SHA256) | „Koji mailovi su nosili ovaj hash?“ |
| `EmailUrlInfo` | URL-ovi u mailovima | „Koji mailovi sadrže domen X?“ |
| `EmailPostDeliveryEvents` | ZAP i ručne akcije nakon isporuke | „Da li je ZAP uklonio mail?“ |
| `UrlClickEvents` | Klikovi preko Safe Links | „Ko je kliknuo na link?“ |
| `IdentityLogonEvents` | Prijave na AD (Defender for Identity) i Entra | „Kerberos/NTLM neuspjele prijave“ |
| `IdentityQueryEvents` | LDAP, DNS, SAMR upiti prema DC-u | „Ko radi rekognosciranje AD-a?“ |
| `IdentityDirectoryEvents` | Promjene u AD-u (grupe, lozinke) | „Ko je dodat u Domain Admins?“ |
| `IdentityInfo` | Atributi naloga (odjel, title, SID) | obogaćivanje rezultata |
| `CloudAppEvents` | Aktivnosti u cloud aplikacijama (Defender for Cloud Apps, M365) | „Ko je masovno preuzimao fajlove iz SharePointa?“ |
| `AlertInfo`, `AlertEvidence` | Alarmi svih Defender servisa i entiteti u njima | „Svi alarmi za uređaj X u 7 dana“ |

Defender XDR tabele imaju kolonu vremena **`Timestamp`**. Kad se iste tabele šalju u Sentinel workspace, dobijaju i **`TimeGenerated`**.

### Sentinel / Log Analytics tabele

| Tabela | Izvor |
|---|---|
| `SecurityEvent` | Windows Security log preko AMA (4624 uspješna prijava, 4625 neuspjela, 4688 proces, 4720 kreiran nalog…) |
| `SigninLogs`, `AADNonInteractiveUserSignInLogs` | Microsoft Entra prijave (interaktivne / neinteraktivne) |
| `AuditLogs` | Microsoft Entra audit (promjene korisnika, grupa, aplikacija) |
| `AzureActivity` | Azure control plane (ko je obrisao resurs, dodijelio rolu) |
| `OfficeActivity` | Microsoft 365 audit (Exchange, SharePoint, Teams) preko Sentinel konektora |
| `CommonSecurityLog` | CEF (firewall, proxy uređaji) |
| `Syslog` | Linux i mrežni uređaji u Syslog formatu |
| `AzureFirewall` / `AZFW*` | Azure Firewall logovi (legacy `AzureDiagnostics` ili resource-specific tabele) |
| `SecurityAlert`, `SecurityIncident` | Alarmi i incidenti u Sentinelu |
| `Usage`, `SentinelHealth` | Volumen unosa i zdravlje konektora/pravila |

Sentinel tabele imaju kolonu **`TimeGenerated`**. Custom tabele imaju sufiks **`_CL`**.

> **Na ispitu:** pazi na razliku sličnih tabela. Proces na **uređaju sa Defender for Endpoint** = `DeviceProcessEvents`. Proces sa **Windows servera bez MDE, preko AMA** = `SecurityEvent` sa `EventID == 4688`. Prijava u **Entra ID** = `SigninLogs`; prijava na **domain controller** = `IdentityLogonEvents`; prijava na **sam uređaj** = `DeviceLogonEvents`. Ko je **promijenio Azure resurs** = `AzureActivity`, a ko je **promijenio korisnika u Entra** = `AuditLogs`.

## Struktura upita

KQL upit je **tok podataka**: počinje od tabele, a svaki `|` (pipe) prosljeđuje rezultat sljedećem operatoru. Redoslijed je bitan.

```kql
// Neuspjele prijave na Windows servere u posljednja 24 sata
SecurityEvent
| where TimeGenerated > ago(24h)
| where EventID == 4625
| summarize Neuspjelih = count() by Account, Computer
| where Neuspjelih > 10
| sort by Neuspjelih desc
```

Pravila:

- naziv tabele i kolona je **case-sensitive** (`securityevent` ne radi),
- komentari počinju sa `//`,
- više naredbi se odvaja tačka-zarezom `;` (bitno kod `let`, sljedeći modul),
- stringovi u `"..."` ili `'...'`; `@"C:\Windows"` je verbatim string (backslash se ne escapuje).

## Osnovni operatori

### Pregled podataka: `take`, `count`, `getschema`

```kql
SecurityEvent | take 10          // 10 proizvoljnih redova, za upoznavanje kolona
SecurityEvent | count            // broj redova
SecurityEvent | getschema        // kolone i tipovi
```

`take` i `limit` su sinonimi. Redovi nisu sortirani, pa `take` ne garantuje „najnovije“.

### Filtriranje: `where`

```kql
SecurityEvent
| where TimeGenerated between (datetime(2026-10-01) .. datetime(2026-10-02))
| where EventID in (4624, 4625)
| where LogonType == 10                      // RemoteInteractive (RDP)
| where Account !endswith "$"                // bez računarskih naloga
```

Više uslova u jednom `where` se spaja sa `and` / `or`. `not()` negira izraz. `isempty()`, `isnotempty()`, `isnull()` provjeravaju prazne vrijednosti.

### Kolone: `project`, `project-away`, `project-rename`, `extend`

| Operator | Šta radi |
|---|---|
| `project A, B, C=izraz` | zadrži **samo** navedene kolone (može i izračunati novu) |
| `project-away A, B` | ukloni navedene kolone, ostale zadrži |
| `project-rename Novo = Staro` | preimenuj kolonu |
| `project-reorder A, B` | promijeni redoslijed (ostale ostaju) |
| `extend X = izraz` | **dodaj** kolonu, sve postojeće ostaju |

```kql
DeviceProcessEvents
| where Timestamp > ago(7d)
| where FileName =~ "powershell.exe"
| extend CmdDuzina = strlen(ProcessCommandLine)
| where CmdDuzina > 1000
| project Timestamp, DeviceName, AccountName, CmdDuzina, ProcessCommandLine
```

Česta zamka: nakon `project` kolone koje nisu navedene više ne postoje. Ako iza `project Timestamp, DeviceName` dođe `where AccountName == "x"`, upit pada.

### Agregacija: `summarize`

`summarize` grupiše redove i računa agregacije. Rezultat ima **samo** kolone iz `by` i agregacije.

| Funkcija | Značenje |
|---|---|
| `count()` | broj redova |
| `countif(uslov)` | broj redova koji ispunjavaju uslov |
| `dcount(Kolona)` | broj različitih vrijednosti (procjena, dovoljno tačna za hunting) |
| `sum()`, `avg()`, `min()`, `max()` | numeričke agregacije |
| `make_set(Kolona)` | niz različitih vrijednosti (dynamic) |
| `make_list(Kolona)` | niz svih vrijednosti, sa ponavljanjima |
| `arg_max(Kolona, *)` | cijeli red sa najvećom vrijednošću (sljedeći modul) |

```kql
// Password spray: jedna IP adresa, mnogo različitih naloga
SecurityEvent
| where TimeGenerated > ago(1d)
| where EventID == 4625
| summarize Pokusaja = count(), Naloga = dcount(Account), Nalozi = make_set(Account, 20)
    by IpAddress
| where Naloga > 15
```

Brute force na jedan nalog izgleda drugačije: mnogo pokušaja, **jedan** nalog, pa se grupiše `by Account` i filtrira `count()`. Spray ima mnogo naloga sa malo pokušaja po nalogu, pa je ključ `dcount(Account)`.

### Vremenski prozori: `bin()`

`bin()` zaokružuje vrijednost na korak. Uz `summarize` pravi histogram po vremenu.

```kql
SecurityEvent
| where TimeGenerated > ago(7d)
| where EventID == 4625
| summarize Neuspjelih = count() by bin(TimeGenerated, 1h)
| render timechart
```

Rupa u podacima (sat bez neuspjelih prijava) se **ne pojavljuje** kao red sa nulom, nego red jednostavno ne postoji. Za kontinualnu seriju sa nulama koristi se `make-series` (sljedeći modul).

### Sortiranje i najveći: `sort`, `top`, `distinct`

```kql
StormEvents
| summarize Steta = sum(DamageProperty) by State
| top 5 by Steta desc
```

- `sort by X desc` (sinonim `order by`) – podrazumijevano je **opadajuće** (`desc`),
- `top N by X` = sortiraj i uzmi prvih N, efikasnije od `sort | take`,
- `distinct A, B` – jedinstvene kombinacije kolona.

### Vizualizacija: `render`

`render` je uvijek **posljednji** operator i ne mijenja podatke, samo prikaz.

| Vizualizacija | Kada |
|---|---|
| `timechart` | vrijednost kroz vrijeme (x je datetime) |
| `columnchart` / `barchart` | poređenje kategorija (vertikalno / horizontalno) |
| `piechart` | udio kategorija |
| `areachart`, `linechart` | trendovi |
| `anomalychart` | serija sa označenim anomalijama (uz `series_decompose_anomalies`) |

```kql
StormEvents
| summarize Dogadjaja = count() by EventType
| top 10 by Dogadjaja
| render piechart
```

> **Na ispitu:** pitanje tipa „Trebate prikazati broj neuspjelih prijava po satu za posljednjih 7 dana kao linijski grafikon. Kako dopuniti upit?“ – tražena kombinacija je `summarize count() by bin(TimeGenerated, 1h)` i `render timechart`. Distraktori su `bin(TimeGenerated, 7d)` (jedan stubac), `top` umjesto `summarize` i `render piechart`.

## Vrijeme u upitima

| Izraz | Značenje |
|---|---|
| `ago(1h)`, `ago(7d)`, `ago(30m)` | sada minus vremenski raspon |
| `now()` | trenutno vrijeme (UTC) |
| `datetime(2026-10-01 08:00)` | konkretan trenutak (UTC) |
| `between (A .. B)` | uključivo od A do B |
| `startofday()`, `startofweek()`, `startofmonth()` | početak perioda |
| `datetime_diff('minute', T2, T1)` | razlika u jedinicama |
| `T2 - T1` | rezultat je `timespan` (npr. `00:05:00`) |
| `format_datetime(T, 'yyyy-MM-dd')` | formatiranje za prikaz |
| `hourofday(T)`, `dayofweek(T)` | izdvajanje dijela (za „prijave van radnog vremena“) |

```kql
// Prijave van radnog vremena (UTC) i vikendom
SigninLogs
| where TimeGenerated > ago(14d)
| extend Sat = hourofday(TimeGenerated), Dan = dayofweek(TimeGenerated)
| where Sat !between (6 .. 18) or Dan in (0d, 6d)    // 0d = nedjelja, 6d = subota
| summarize Prijava = count() by UserPrincipalName
```

### Time picker vs filter u upitu

Advanced hunting i Sentinel imaju **time range** birač iznad editora. Ako upit sadrži sopstveni filter na kolonu vremena (`where Timestamp > ago(3d)`), važi filter iz upita, a birač se prikazuje kao „Set in query“. Na ispitu se podrazumijeva da je filter u upitu dio rješenja.

Vremenski filter uvijek ide **prvi**. Podaci su particionisani po vremenu, pa filter na vrijeme odmah odbacuje veliki dio skupa.

### Napomena za lab

Lab tabele (`StormEvents` iz 2007, `SecurityEvent`, `DeviceProcessEvents`, `AzureFirewall` iz Microsoftovih primjera) imaju **stare datume**. `ago(1d)` nad njima vraća nula redova. U labu filtriraj sa `datetime(...)` ili prvo pogledaj opseg:

```kql
SecurityEvent
| summarize Od = min(TimeGenerated), Do = max(TimeGenerated)
```

## String operatori i performanse

Sentinel i Defender indeksiraju stringove po **termima** (nizovi alfanumeričkih znakova razdvojeni ne-alfanumeričkim). Operatori koji rade nad cijelim termima koriste indeks i brzi su; operatori koji traže podniz moraju čitati sve.

| Operator | Značenje | Case | Primjer koji je `true` |
|---|---|---|---|
| `==` | tačno jednako | sensitive | `"cmd.exe" == "cmd.exe"` |
| `=~` | jednako | insensitive | `"CMD.EXE" =~ "cmd.exe"` |
| `!=`, `!~` | nije jednako | sensitive / insensitive | |
| `has` | sadrži **cijeli term** | insensitive | `"net user /add" has "user"` |
| `has_cs` | cijeli term | sensitive | |
| `contains` | sadrži **podniz** | insensitive | `"mimikatz.exe" contains "katz"` |
| `contains_cs` | podniz | sensitive | |
| `startswith`, `endswith` | početak / kraj | insensitive | `"svc_backup" startswith "svc_"` |
| `hasprefix`, `hassuffix` | term počinje / završava | insensitive | |
| `in (...)`, `in~ (...)` | jedna od vrijednosti | sensitive / insensitive | `FileName in~ ("cmd.exe","powershell.exe")` |
| `has_any (...)` | bilo koji od terma | insensitive | `ProcessCommandLine has_any ("-enc","-encodedcommand")` |
| `has_all (...)` | svi termi | insensitive | |
| `matches regex` | regularni izraz | sensitive | |

Bitne razlike:

- `"mimikatz.exe" has "katz"` je **false** – „katz“ nije cijeli term (termi su `mimikatz` i `exe`). `contains "katz"` je true.
- `has` je brži od `contains` i obično je dovoljan, jer tražiš ime fajla, korisnika ili parametar, a ne dio riječi.
- Termi od **3 i manje znakova** se ne indeksiraju. `has "-w"` ili `has "ps"` je skupo i nepouzdano.
- Svaki operator ima negaciju sa `!`: `!has`, `!contains`, `!in`, `!startswith`.

```kql
DeviceProcessEvents
| where Timestamp > ago(7d)
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where ProcessCommandLine has_any ("-encodedcommand", "-enc", "frombase64string")
| project Timestamp, DeviceName, AccountName, InitiatingProcessFileName, ProcessCommandLine
```

### Pravila za brze upite (Microsoft best practices)

1. **Filtriraj rano** – vrijeme prvo, zatim najselektivniji uslov, tek onda `extend`, parsiranje i `summarize`.
2. **`has` umjesto `contains`** kad tražiš cijelu riječ.
3. **Case-sensitive je brži** – `==` i `has_cs` umjesto `=~` i `has` kad znaš tačan oblik.
4. **Filtriraj kolonu tabele, ne izračunatu kolonu** – `where FileName =~ "x"` umjesto `extend f = tolower(FileName) | where f == "x"`.
5. **Ciljaj kolonu** – izbjegavaj `search "x"` i `where * has "x"`; ako moraš, `search in (Tabela1, Tabela2) "x"`.
6. **`project` prije `join`** – manje kolona, manje memorije.
7. **Izbjegavaj regex** kad `parse` ili `has` rade isti posao.
8. **Prvo procijeni veličinu** – `count` prije pokretanja upita koji vraća sve.

Za komandne linije Microsoft preporučuje suprotan smjer: napadač mijenja velika/mala slova i navodnike, pa se koristi **case-insensitive** poređenje i filter na **ime fajla** (`FileName in~ ("net.exe","net1.exe")`), a ne tačna komandna linija.

> **Na ispitu:** „Upit koristi `where ProcessCommandLine contains "Invoke-Mimikatz"` i često prekoračuje CPU kvotu. Koje DVIJE izmjene smanjuju potrošnju bez gubitka rezultata?“ – dodati vremenski filter na početak i zamijeniti `contains` sa `has` (traži se cijeli term). Pretvaranje kolone u lowercase sa `extend` i `search *` povećavaju potrošnju.

## Upiti za Defender XDR: tipični obrasci

### Pretraga po indikatoru (IoC)

```kql
let Hash = "e5f2b1c8a7d6e4f3c2b1a0e9d8c7b6a5f4e3d2c1b0a9e8d7c6b5a4f3e2d1c0b9";
DeviceFileEvents
| where Timestamp > ago(30d)
| where SHA256 == Hash
| project Timestamp, DeviceName, ActionType, FolderPath, InitiatingProcessFileName
```

### Alarmi po uređaju

```kql
AlertEvidence
| where Timestamp > ago(7d)
| where DeviceName =~ "ws-fin-042"
| distinct AlertId, Title, ServiceSource
```

### Procesi koje je pokrenuo Office

```kql
DeviceProcessEvents
| where Timestamp > ago(7d)
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "powerpnt.exe")
| where FileName in~ ("cmd.exe", "powershell.exe", "wscript.exe", "mshta.exe", "rundll32.exe")
| summarize Puta = count() by DeviceName, InitiatingProcessFileName, FileName
```

### Mreža iz Azure Firewall logova

```kql
AzureFirewall
| where Action == "Deny"
| summarize Blokova = count(), Portova = dcount(DestinationPort) by SourceIp
| where Portova > 20      // mnogo portova sa jedne adrese = skeniranje
| sort by Portova desc
```

### Od upita do detekcije

Upit iz advanced huntinga se može sačuvati (**Save** > shared ili personal query) ili pretvoriti u pravilo (**Create detection rule**). Za custom detekciju upit mora vratiti kolone **`Timestamp`** i **`ReportId`** (ili ekvivalent za tabelu) i bar jedan identifikator entiteta (npr. `DeviceId`). Detalji su u modulu o detekcijama (cilj 1.4).

## Kako čitati upit na ispitu

Kad dobiješ nepoznat upit, prođi ga red po red i za svaki pipe zapiši **koje kolone postoje** i **šta predstavlja jedan red**:

```kql
SecurityEvent                                  // red = jedan Windows događaj
| where EventID == 4625                         // red = jedna neuspjela prijava
| summarize C = count() by Account, bin(TimeGenerated, 1h)   // red = nalog × sat
| where C > 50                                  // samo nalog-sati sa >50 neuspjeha
| summarize Sati = count() by Account           // red = nalog; Sati = broj takvih sati
```

Pitanje „šta predstavlja kolona `Sati`“ ima odgovor: broj sati u kojima je nalog imao više od 50 neuspjelih prijava. Ova tehnika rješava većinu KQL pitanja.

> **Na ispitu:** pazi na redoslijed `where` i `summarize`. `summarize count() by Account | where count_ > 10` filtrira **grupe**; `where ... | summarize` filtrira **redove** prije grupisanja. Podrazumijevano ime kolone za `count()` bez aliasa je **`count_`**, za `dcount(Account)` je `dcount_Account`.

## Rezime

- KQL se u SC-200 piše u **Advanced hunting** (Defender portal), za XDR i Sentinel tabele. Sentinel u Azure portalu ide u penziju **31. 3. 2027.**
- Advanced hunting: **30 dana** XDR podataka, **100.000** redova, **64 MB**, **10 min** timeout, CPU kvota u ciklusima od 15 min. Data lake–only podaci nisu u advanced huntingu.
- Tabele: `Device*` (MDE), `Email*`/`UrlClickEvents` (MDO), `Identity*` (MDI), `CloudAppEvents` (MDCA), `AlertInfo`/`AlertEvidence`; Sentinel: `SecurityEvent`, `SigninLogs`, `AuditLogs`, `AzureActivity`, `CommonSecurityLog`, `Syslog`. XDR koristi `Timestamp`, Sentinel `TimeGenerated`.
- Operatori: `where`, `project` (samo navedene), `extend` (dodaj), `summarize` (grupiši, samo `by` + agregacije), `bin` (vremenski koraci), `top`, `sort`, `distinct`, `render` (zadnji).
- `has` = cijeli term (brz, indeks), `contains` = podniz (spor); `==` case-sensitive, `=~` insensitive; termi ≤3 znaka se ne indeksiraju.
- Filtriraj vrijeme prvo, filtriraj kolone tabele, projektuj prije `join`, izbjegavaj regex i `search *`.
