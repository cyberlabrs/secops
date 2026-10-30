## Ciljevi ispita: 3.2

Domen 3 (**Perform threat hunting**) nosi 20–25% ispita. Prvi cilj (3.1) je hunting u Defender XDR-u (advanced hunting, grafovi). Ovaj modul pokriva drugi cilj, **3.2 Detect threats by using the Microsoft Sentinel platform**, sa četiri stavke:

- **Create and monitor hunting queries** – hunting upiti, bookmarks i hunts u Sentinelu,
- **Create and manage KQL jobs in Data lake** – jednokratni i zakazani KQL poslovi nad data lake tierom,
- **Create and manage Summary rule tables for querying** – summary rules koje sažimaju obimne logove u malu Analytics tabelu,
- **Hunt for threats by using Notebooks, including connection to the Sentinel MCP Server** – Jupyter notebooks (Spark nad data lakeom) i Sentinel MCP server za AI agente.

Ispit ovdje voli pitanja tipa „koja funkcija“: imaš scenario (podaci su u data lakeu, treba ih rijetko pretraživati; treba ih upoređivati sa analytics pravilom svakih sat vremena; treba Python i mašinsko učenje) i biraš između hunting upita, KQL joba, summary rule, notebooka ili search joba. Zato je najvažnije znati **čemu svaka funkcija služi i gdje joj je granica**.

Podsjetnik iz modula 03: Sentinel u Azure portalu je podržan **do 31. marta 2027.**, nakon toga se koristi samo **Microsoft Defender portal**. Sve putanje u ovom modulu su iz Defender portala.

## Proces threat huntinga

Hunting je proaktivan: ne čekaš alarm, nego postaviš **hipotezu** („napadač koristi password spray prema našim serverima“) i provjeravaš je u podacima. Tipičan tok:

1. **Hipoteza** – iz threat intelligence izvještaja, MITRE ATT&CK matrice, rezultata hunting upita ili incidenta.
2. **Pretraga** – hunting upiti, advanced hunting, data lake exploration, notebook.
3. **Bilježenje nalaza** – bookmarks, komentari u hunt-u.
4. **Akcija** – incident iz bookmarka, novo analytics pravilo, novi threat indicator.
5. **Poboljšanje** – ono što je bilo ručno postaje detekcija ili zakazani posao (KQL job, summary rule).

| Alat | Gdje | Kada ga koristiš |
|---|---|---|
| **Hunting queries** | **Microsoft Sentinel** > **Threat management** > **Hunting** | Gotovi i vlastiti upiti nad analytics tierom, pregled po MITRE taktikama |
| **Advanced hunting** | **Investigation & response** > **Hunting** > **Advanced hunting** | Ad hoc KQL nad Defender XDR i Sentinel tabelama (modul 01/02) |
| **Data lake exploration – KQL queries** | **Microsoft Sentinel** > **Data lake exploration** > **KQL queries** | Interaktivni KQL nad podacima u data lake tieru |
| **KQL jobs** | **Microsoft Sentinel** > **Data lake exploration** > **Jobs** | Jednokratni ili zakazani upit koji rezultat upisuje u tabelu |
| **Summary rules** | **Microsoft Sentinel** > **Configuration** > **Summary rules** | Periodično sažimanje obimnih logova u Analytics `_CL` tabelu |
| **Notebooks** | VS Code + **Microsoft Sentinel** ekstenzija | Python/PySpark, ML, vizualizacije nad data lakeom |
| **Sentinel MCP server** | VS Code, Security Copilot, Copilot Studio, Microsoft Foundry | Pretraga podataka prirodnim jezikom preko AI agenta |

## Hunting upiti

### Queries tab

Putanja: **Microsoft Sentinel** > **Threat management** > **Hunting**, tab **Queries**.

Na ovom tabu su:

- **out-of-the-box** hunting upiti instalirani iz **Content hub** rješenja (npr. rješenje za Windows Security Events donosi svoje hunting upite),
- **custom** upiti koje si sam napravio ili klonirao i izmijenio.

Svaki upit ima opis, potrebne izvore podataka, MITRE ATT&CK **taktike** (ikone na vrhu, npr. Initial access, Persistence, Exfiltration) i **tehnike** (kolona **Techniques**).

| Akcija / kolona | Šta radi |
|---|---|
| **Run all queries** / **Run selected queries** | Pokreće sve ili označene upite; kolona **Results** pokazuje broj pogodaka |
| **Results** filter *N/A* | Upiti koji nisu aktivni jer nedostaje izvor podataka; info ikona kaže koji konektor treba |
| **Results delta** / **Results delta percentage** | Poređenje rezultata zadnja 24 h sa prethodnih 24–48 h – otkriva skokove |
| **MITRE ATT&CK tactic bar** | Broj upita po taktici, mijenja se prema aktivnim filterima |
| **Favorites** | Omiljeni upiti se **automatski izvršavaju** pri svakom otvaranju Hunting stranice |
| **Run Query** u detaljima upita | Pokreće jedan upit; **View Results** otvara rezultate u query editoru |
| **New alert rule** > **Create Microsoft Sentinel alert** | Iz upita pravi scheduled analytics rule kroz **Analytics rule wizard** |

> **Na ispitu:** „Trebate pronaći hunting upite kod kojih je broj rezultata naglo porastao u odnosu na prethodni dan.“ Odgovor je sortiranje/filtriranje po **Results delta** (ili **Results delta percentage**). „Upiti koji ne vraćaju ništa jer nema podataka“ su oni sa **N/A** u koloni Results. „Upit treba da se izvršava sam kad otvorite Hunting stranicu“ – dodaj ga u **favorites**.

### Pravljenje custom hunting upita

1. **Hunting** > **Queries** > **New query** (ili klon postojećeg: **Clone query**).
2. Unesi ime, opis, KQL upit.
3. **Entity mapping** – mapiraj kolone na entitete (Account, Host, IP, File, URL…), kao kod analytics pravila.
4. **Tactics and techniques** – MITRE mapiranje.
5. **Create**.

Primjer hunting upita: password spray na Windows serverima (mnogo različitih naloga sa iste IP adrese, uglavnom neuspješno).

```kql
// Password spray: jedna IP adresa, mnogo različitih naloga, neuspjele prijave
let lookback = 1d;
SecurityEvent
| where TimeGenerated > ago(lookback)
| where EventID == 4625
| where isnotempty(IpAddress) and IpAddress != "-"
| summarize FailedCount = count(),
            DistinctAccounts = dcount(Account),
            Accounts = make_set(Account, 20),
            FirstSeen = min(TimeGenerated),
            LastSeen = max(TimeGenerated)
    by IpAddress, Computer
| where DistinctAccounts >= 10
| extend IPCustomEntity = IpAddress, HostCustomEntity = Computer
| order by DistinctAccounts desc
```

Kolone kao `IPCustomEntity` su stari stil; u novim upitima entitete mapiraš u **Entity mapping** sekciji, ali ćeš ovakve nazive još sretati u GitHub repozitoriju Azure-Sentinel.

Drugi primjer, nad Defender for Endpoint tabelom: kodirani PowerShell pokrenut iz Office aplikacije.

```kql
DeviceProcessEvents
| where TimeGenerated > ago(7d)
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "outlook.exe")
| where ProcessCommandLine has_any ("-enc", "-encodedcommand", "frombase64string")
| project TimeGenerated, DeviceName, AccountName, InitiatingProcessFileName, ProcessCommandLine
```

### Kad hunting upit postaje detekcija

Hunting upit se ne izvršava sam (osim favorita pri otvaranju stranice) i ne pravi alarme. Ako upit dosljedno daje vrijedne rezultate, pretvori ga u **scheduled analytics rule** (Sentinel) ili **custom detection rule** (advanced hunting). Iz Hunting stranice: otvori rezultate > **New alert rule** > **Create Microsoft Sentinel alert**.

### Livestream više ne postoji

Ranije je Sentinel imao **livestream** (upit koji se izvršava stalno i javlja nove pogotke). **Livestream više nije dostupan.** Microsoft za iste scenarije preporučuje **KQL jobs**, **analytics rules** ili **playbooks**. Ako na pitanju vidiš livestream kao opciju, to je distraktor u trenutnoj verziji ispita.

## Bookmarks

Tokom huntinga naiđeš na red koji je sumnjiv. **Bookmark** ga sačuva zajedno sa upitom koji ga je vratio.

1. U rezultatima upita označi redove i izaberi **Add bookmark**. Za svaki označen red nastaje jedan bookmark.
2. Dodaj **tags** i **notes**. Tagovi služe za grupisanje (npr. tag kampanje).
3. **Entity mapping** i **MITRE ATT&CK** mapiranje – podrazumijevano se preuzimaju iz hunting upita, a mogu se dopuniti.
4. Svi bookmarks su na tabu **Bookmarks** na Hunting stranici.
5. **Investigate** otvara graf entiteta i timeline za bookmark.
6. Označi jedan ili više bookmarka > **Incident actions** > **Create new incident** ili **Add to existing incident**.

Bookmarks se upisuju u tabelu **`HuntingBookmark`** u workspaceu, pa ih možeš pretraživati i spajati sa drugim podacima:

```kql
HuntingBookmark
| where TimeGenerated > ago(14d)
| where Tags has "password-spray"
| project TimeGenerated, BookmarkName, CreatedBy, Notes, QueryText
```

Važno ograničenje: **bookmarks ne postoje u Advanced hunting** stranici. Dostupni su samo kroz **Microsoft Sentinel** > **Threat management** > **Hunting**. U advanced huntingu za čuvanje konteksta koristiš povezivanje rezultata sa incidentom (**Link to incident**), sačuvane upite ili tagove incidenta.

> **Na ispitu:** „Analitičar je u rezultatu hunting upita pronašao sumnjivu prijavu i želi je sačuvati kao dokaz, a kasnije od nje napraviti incident.“ Odgovor: **Add bookmark**, zatim **Incident actions** > **Create new incident**. Ako pitanje traži da se bookmarks analiziraju KQL-om, tabela je **`HuntingBookmark`**. Ako scenarij kaže „radim u Advanced hunting stranici i želim bookmark“ – to nije moguće, treba Sentinel Hunting stranica ili **Link to incident**.

## Hunts (preview)

**Hunts** su „projekti“ huntinga u Sentinelu: objedinjuju hipotezu, upite, bookmarks, komentare i ishod.

| Faza | U portalu |
|---|---|
| Definiši hipotezu | Inspiracija iz MITRE mape, rezultata hunting upita, Content hub rješenja |
| Istraži | Na **Queries** tabu označi upite > **New hunt**; pokreći ih, rezultate **bookmarkuj direktno u hunt** |
| Djeluj | UEBA stranice entiteta, playbook nad bookmarkovanim entitetom, nova analytics pravila, threat indicators, incidenti |
| Prati ishod | Status hipoteze (potvrđena / nije), komentari; hunt automatski povezuje nastala pravila i incidente; metrike programa huntinga |

Microsoft preporučuje da upit za summary rule prvo isprobaš upravo na **Hunts** stranici.

## Gdje su podaci: analytics tier i data lake tier

Za hunting nad dugim periodima bitno je gdje su podaci (detaljno u modulu 03):

| Tier | Za šta | Upit |
|---|---|---|
| **Analytics** | Detekcije, hunting upiti, advanced hunting, workbooks | Pun KQL, brzo, skuplje skladištenje |
| **Data lake** | Dugotrajno i jeftino čuvanje obimnih logova (do 12 godina) | Data lake exploration, KQL jobs, notebooks; sporije, plaća se upit (data scan) |

Podatak koji je **samo u data lake tieru** nije vidljiv u advanced huntingu ni analytics pravilima. Da bi ga hunting upit ili detekcija koristili, moraš ga **prebaciti u analytics tier**: KQL jobom (puni ili filtrirani podaci) ili summary rule (sažeti podaci).

Stariji alati za arhivu u Log Analytics workspaceu su **search job** (rezultat u novu tabelu sa sufiksom **`_SRCH`**) i **restore** (privremeno vraćanje arhiviranih podataka u tabelu sa sufiksom **`_RST`**). U Defender portalu sa data lakeom za ovakve scenarije prvo misli na KQL jobs.

## Data lake exploration: KQL upiti

Putanja: **Microsoft Sentinel** > **Data lake exploration** > **KQL queries**.

- Biraš jedan ili više **source workspaceova**. Kod više workspaceova se tabele istog imena i šeme automatski spajaju (`union`); konkretan workspace biraš sa `workspace("ImeWorkspacea").Tabela`.
- Pored data lake tabela, mogu se pretraživati i **federated tables** (npr. Microsoft Entra ID, Microsoft 365, Microsoft Resource Graph) bez unosa u workspace.
- Iz editora direktno pokrećeš **Create job** ako upit treba ponavljati ili rezultat sačuvati.

## KQL jobs u data lakeu

**KQL job** je **jednokratan ili zakazan** KQL upit nad data lakeom (i federated tabelama) čiji se rezultat **upisuje u tabelu**. Tipične namjene:

- dugotrajan jednokratan upit za istragu incidenta (npr. 18 mjeseci firewall logova za jednu IP adresu),
- agregacija i obogaćivanje low-fidelity logova,
- retroaktivno poređenje sa threat intelligence (TI matching),
- skeniranje anomalija preko više tabela (`join`, `union`).

### Odredišna tabela

| Odredište | Sufiks nove tabele | Napomena |
|---|---|---|
| Analytics tier (Sentinel workspace) | **`_KQL_CL`** | Rezultat je dostupan u advanced huntingu, analytics pravilima i workbooks |
| Data lake tier (**System tables** workspace) | **`_KQL`** | Upis u system tables je u preview; ubrzava kasnije istrage |
| Postojeća tabela (append) | – | Šema rezultata mora odgovarati šemi tabele, inače job pada |

Federated tabele ne mogu biti odredište. Skladištenje u analytics tieru je skuplje, zato u upitu radi `project` samo potrebnih kolona i filtriraj prije upisa.

### Kreiranje joba

1. **Microsoft Sentinel** > **Data lake exploration** > **Jobs** > **Create job** (ili **Create job** iz KQL editora, ili **Create from template**).
2. **Job name** – jedinstven u tenantu, do 256 znakova, **bez `#` i `-`**.
3. **Job description**.
4. **Select workspace** – odredišni workspace (Sentinel workspace ili **System tables**), zatim nova tabela ili **Add to an existing table**.
5. **Prepare the query** – upit i **Selected workspaces** (izvorni workspaceovi). Ako upit nema vremenski opseg, provjeri time picker.
6. **Schedule the query job** – **One time** (pokreće se odmah po kreiranju) ili **Scheduled job**: **Repeat frequency** (By minute, Hourly, Daily, Weekly, Monthly), **Repeat every**, **From** (najranije **30 minuta** nakon kreiranja) i **To** ili **Set job to run indefinitely**.
7. **Submit**.

Uređivanje jednokratnog joba ga **odmah ponovo pokreće**.

### Dozvole

- Microsoft Entra ID uloga koja daje pristup data lakeu (čitanje svih workspaceova, upis u analytics tier, zakazivanje jobova).
- Za **nove custom tabele u analytics tieru**: data lake **managed identity** (sistemska, ime `msg-resources-<guid>`) mora imati **Log Analytics Contributor** na odredišnom Log Analytics workspaceu (**Access control (IAM)** > **Add role assignment**).

> **Na ispitu:** „KQL job je kreiran, ali pada pri pokušaju da napravi novu tabelu u analytics tieru.“ Provjeri da li managed identity data lakea (`msg-resources-<guid>`) ima ulogu **Log Analytics Contributor** na workspaceu. Pitanje „kako se zove tabela koju je napravio job“ – sufiks **`_KQL_CL`** (analytics) ili **`_KQL`** (system tables u data lakeu); summary rule pravi **`_CL`**, notebook primjer koristi **`_SPRK`**.

### Ograničenja KQL jobova

| Parametar | Vrijednost |
|---|---|
| Istovremeno izvršavanje po tenantu | **5** (višak se odbija, ne stavlja u red) |
| Timeout upita | **1 sat** (moguć djelimičan rezultat) |
| Omogućenih jobova po tenantu | **100** |
| Izlaznih tabela po jobu | **1** |
| Vremenski opseg upita | do **12 godina** |
| Nepodržano u upitu | `adx()`, `arg()`, `externaldata()`, `ingestion_time()`, korisničke (user-defined) funkcije |
| Kolone koje se prepisuju | `TenantId`, `Type`, `_ResourceId`, `_BilledSize`… i `TimeGenerated` ako je starije od 2 dana |

Zbog posljednjeg reda: ako je originalno vrijeme događaja bitno, upiši ga u **posebnu kolonu** (npr. `EventTime = TimeGenerated`).

Jobovi koji čitaju iz obrisanog izvornog workspacea automatski prelaze u stanje **Disabled**.

### Latencija data lakea

Novi podaci u data lakeu postaju dostupni sa kašnjenjem do **15 minuta**. Zakazani job sa kratkim lookbackom zato pomjera prozor unazad:

```kql
let lookback = 1h;
let delay = 15m;
let endTime = now() - delay;
let startTime = endTime - lookback;
AzureFirewall
| where TimeGenerated between (startTime .. endTime)
| where Action == "Deny"
| summarize DeniedCount = count(),
            Ports = make_set(DestinationPort, 50),
            EventTime = min(TimeGenerated)
    by SourceIp, DestinationIp, Protocol
| where DeniedCount > 100
```

Isti obrazac (prozor `now() - delay`) poznaješ iz analytics pravila sa ingestion delay. Preklapanje lookbacka i frekvencije (npr. lookback 70 min, job svakih 60) smanjuje rizik od propuštenih kasnih događaja.

### Templates

**Create from template** nudi gotove jobove (Hunting, Baseline, Anomaly detection), npr. **Network log IOC matching** (svaki sat, TI poređenje sa `CommonSecurityLog`), **Daily process execution trend**, **New processes observed in last 24 hours**, **Windows suspicious login outside normal hours**. Template popuni upit i raspored; ti biraš odredišni workspace.

## Summary rules

**Summary rule** periodično izvršava agregacioni KQL upit nad obimnom tabelom i rezultat upisuje u **custom tabelu sa Analytics planom** (`<ime>_CL`). Ideja: sirovi logovi ostaju u jeftinom tieru (data lake / Auxiliary / Basic), a u Analytics ide samo sažetak koji je mali, brz i jeftin za upite i detekcije.

Koristi:

- **analize i izvještaji** nad dugim periodima,
- **ušteda** na verbose logovima (firewall, proxy, DNS, flow),
- **privatnost**: sažetak bez osjetljivih kolona, pristup sirovim podacima ograničen.

### Kreiranje

Preduslovi: Sentinel workspace sa podacima, uloga **Microsoft Sentinel Contributor**, workspace onboardovan u Defender portal.

1. **Microsoft Sentinel** > **Configuration** > **Summary rules** > **+ Create**.
2. **Name**, **Description**, **Destination table**: **Existing custom log table** ili **New custom log table** (ime dobija `_CL`).
3. Preporučeno: uključi dijagnostiku **SummaryLogs** na workspaceu (istorija izvršavanja i greške; dodatno se naplaćuje).
4. **Set summary logic** – upit; **Preview results**.
5. **Query scheduling** – koliko često (= **bin size**), opcioni **delay** u minutama, početak.
6. **Review + create** > **Save**.

Na listi pravila: pregled podataka u Logs, **run history**, enable/disable, edit. **Brisanje summary rule je nepovratno.** Gotovi templates su u **Content hub** (filter **Content type: Summary rules**), pa na tabu **Templates** stranice Summary rules > **Create**.

Primjer: dnevno sažimanje firewall saobraćaja po izvoru i odredištu.

```kql
// Summary rule upit - BEZ vremenskog filtera, opseg određuje bin size
AzureFirewall
| summarize Connections = count(),
            DeniedConnections = countif(Action == "Deny"),
            Ports = make_set(DestinationPort, 100),
            FirstSeen = min(TimeGenerated),
            LastSeen = max(TimeGenerated)
    by SourceIp, DestinationIp, Protocol
```

Hunting upit tada ide nad malom tabelom, a ne nad terabajtima sirovih logova:

```kql
FirewallDaily_CL
| where TimeGenerated > ago(90d)
| where DestinationIp == "203.0.113.50"
| summarize TotalConnections = sum(Connections), Sources = make_set(SourceIp)
    by bin(_BinStartTime, 1d)
```

### Pravila i ograničenja

| Stavka | Vrijednost |
|---|---|
| **Bin size** | 20, 30, 60, 120, 180, 360, 720 ili 1440 minuta |
| Odredišna tabela | Custom `_CL`, **Analytics** plan |
| Kolone koje se dodaju | **`_RuleName`**, **`_RuleLastModifiedTime`**, **`_BinSize`**, **`_BinStartTime`** |
| Aktivnih pravila po workspaceu | **100** |
| Istorija | Obrađuju se samo skorašnji podaci (do 24 h unazad), nema backfilla starih podataka |
| Vremenski filter u upitu | **Ne stavljati** – kombinuje se sa binom i daje samo presjek |
| Izvor sa Analytics planom | Svi operatori osim `workspaces()`, `app()`, `resource()`, `ADX()`, `ARG()` i pluginova `bag_unpack`, `narrow`, `pivot` |
| Izvor sa Basic planom | Jedna tabela + `lookup` na do **5** Analytics tabela |
| Ostalo nepodržano | User-defined funkcije, `union *`, `isfuzzy=true`, workspace transformacija na odredišnoj tabeli |
| Podrazumijevani delay | 3,5 min do 10% bin sizea (za kasne podatke); `binDelay` se može podesiti |
| Ponovni pokušaj | 10 pokušaja u 8 sati za neuspio bin; nakon toga ručni retry |
| Cijena | Pravilo je besplatno; plaća se upit (data scan za Basic/Auxiliary) i ingestion rezultata u Analytics |

> **Na ispitu:** „Firewall logovi (1 TB dnevno) su u jeftinom tieru. Treba analytics pravilo koje svakog sata poredi saobraćaj sa TI listom, uz NAJMANJI trošak.“ Odgovor je **summary rule** koja svaki sat (bin 60) sažme logove u `_CL` tabelu, i analytics pravilo nad tom tabelom. Distraktori: prebaciti cijelu tabelu u Analytics (skupo), search job (jednokratan, nije zakazan). Zamka u KQL-u: upit summary rule sa `where TimeGenerated > ago(1h)` – vremenski filter se ne stavlja.

### KQL job ili summary rule?

| | **KQL job** | **Summary rule** |
|---|---|---|
| Gdje se pravi | **Data lake exploration** > **Jobs** | **Configuration** > **Summary rules** |
| Izvor | Data lake tier, federated tabele, više workspaceova | Tabele u workspaceu (Analytics, Basic, Auxiliary) |
| Raspored | Jednokratno ili By minute/Hourly/Daily/Weekly/Monthly | Fiksni bin: 20 min do 24 h |
| Istorijski podaci | Da, do 12 godina unazad | Ne, samo skorašnji podaci |
| Odredište | Analytics (`_KQL_CL`), data lake (`_KQL`), postojeća tabela | Analytics `_CL` |
| Timeout | 1 h | Prema query API limitima workspacea |
| Tipična upotreba | Istraga incidenta nad starim podacima, retro TI matching, baseline | Stalno sažimanje obimnog izvora za detekcije i izvještaje |

## Notebooks

Kada hunting postane prevelik za jedan upit (više koraka, Python, ML, vizualizacije, eksterni podaci), koristi se **Jupyter notebook**.

### Klasični Sentinel notebooks

Klasični pristup: **Notebooks** u Sentinelu, izvršavanje u **Azure Machine Learning** workspaceu, biblioteka **MSTICPy** (Microsoft Threat Intelligence Center). MSTICPy radi upite nad Log Analytics, obogaćuje podatke (TI, geolokacija), dekodira base64, pravi timeline i process tree vizualizacije, detektuje anomalije u sesijama. Ovi notebooks čitaju **analytics tier** preko Log Analytics API-ja.

### Notebooks nad Sentinel data lakeom (VS Code)

Novi pristup za data lake:

1. Onboarding na **Microsoft Sentinel data lake**.
2. U VS Code instaliraj ekstenziju **Microsoft Sentinel** (Extensions Marketplace, „Sentinel“) i po želji **GitHub Copilot**.
3. Prijava kroz Sentinel ikonu; lijevo se vide **Lake tables** (i **Federated tables** pod **System tables**) i **Jobs**.
4. Novi Jupyter notebook, kernel **Microsoft Sentinel**, izaberi **runtime pool** (Small, Medium, Large). Spark sesija se pokreće nekoliko minuta.

Pristup podacima ide preko klase **`MicrosoftSentinelProvider`** iz modula `sentinel_lake.providers`:

```python
from sentinel_lake.providers import MicrosoftSentinelProvider
data_provider = MicrosoftSentinelProvider(spark)

# Čitanje tabele iz data lakea u Spark DataFrame
df = data_provider.read_table("SecurityEvent")

# Neuspjele prijave grupisane po IP adresi
failed = (df.filter(df.EventID == 4625)
            .groupBy("IpAddress")
            .count()
            .orderBy("count", ascending=False))
failed.show(20)

# Upis rezultata u novu tabelu
data_provider.save_as_table(failed, "FailedLogonsByIp_SPRK", write_options={"mode": "overwrite"})
```

| Runtime pool | Za šta |
|---|---|
| **Small** | Razvoj, testiranje, lagana analiza; najjeftiniji |
| **Medium** | ETL sa join/agregacijama, treniranje ML modela |
| **Large** | Deep learning, veliki join i shuffle, vremenski kritični poslovi |

| Ograničenje | Vrijednost |
|---|---|
| Jezik | Python (PySpark) |
| Biblioteke | Samo Azure Synapse libraries 3.4 + Sentinel Provider; **bez pip install** |
| Interaktivni upit | 2 sata |
| Neaktivnost interaktivne sesije | 20 minuta (timeout sesije podesiv, podrazumijevano 30 min) |
| Notebook job | 8 sati; najviše **3** istovremena, ostali u redu |
| Prikaz u VS Code | 100.000 redova |
| Analytics custom tabele | Ne brišu se iz notebooka, nego u Log Analytics |

Za upis u nove tabele analytics tiera managed identity data lakea treba **Log Analytics Contributor**, isto kao kod KQL jobova.

**Notebook jobs**: notebook se može zakazati iz Sentinel ekstenzije (jednokratno ili periodično) da obrađuje podatke i piše u data lake ili analytics tier – slično KQL jobu, ali sa Pythonom.

> **Na ispitu:** „Analitičar treba nad 12 mjeseci podataka iz data lakea istrenirati model za otkrivanje anomalija i rezultat zapisati u tabelu.“ To je **notebook** (PySpark preko `MicrosoftSentinelProvider`, `save_as_table`), ne summary rule (bez istorije, bez ML-a) ni hunting upit. Ako treba samo KQL agregacija po rasporedu, jednostavniji odgovor je **KQL job**.

## Sentinel MCP server

**Model Context Protocol (MCP)** je otvoreni protokol kojim AI klijent (npr. GitHub Copilot u VS Code) poziva alate na serveru. **Microsoft Sentinel MCP server** je hostovan od Microsofta (bez infrastrukture), autentikacija je kroz **Microsoft Entra**, a alati su grupisani u **kolekcije**:

| Kolekcija | Namjena |
|---|---|
| **Data exploration** | Pretraga tabela, KQL nad data lakeom, analiza entiteta, graf alati |
| **Triage** | Trijaža incidenata i hunting preko Defender API-ja (koristi tvoje postojeće dozvole) |
| **Agent creation** | Pravljenje Security Copilot agenata opisom na prirodnom jeziku |

Data exploration kolekcija je na adresi `https://sentinel.microsoft.com/mcp/data-exploration`.

| Alat | Šta radi |
|---|---|
| `search_tables` | Semantička pretraga kataloga tabela; vraća relevantne tabele i šeme |
| `query_lake` | Izvršava jedan KQL upit nad data lake workspaceom |
| `list_sentinel_workspaces` | Lista data lake workspaceova (ime i ID); pokreće se prvi |
| `analyze_user_entity`, `analyze_url_entity` | AI analiza korisnika ili URL-a sa verdiktom; vraća ID analize |
| `get_entity_analysis` | Preuzima rezultat analize entiteta (po ID-u) |
| Graf alati (preview), npr. `find_blastradius`, `find_walkable_paths` | Rezonovanje nad Sentinel grafovima (blast radius, putanje) |

Preduslovi i dozvole:

- onboarding na **Sentinel data lake** (za većinu alata),
- najmanje **Security Reader** (ili Security Operator / Security Administrator) za listanje i pozivanje alata,
- entity analyzer troši **Security Compute Units (SCU)** i traži ulogu **Security Copilot Contributor**,
- `analyze_user_entity` radi sa prozorom od najviše 7 dana i traži tabele kao `SigninLogs`, `AlertEvidence`, `CloudAppEvents`, `IdentityInfo` u data lakeu.

Podržani klijenti: **Visual Studio Code** (GitHub Copilot), **Microsoft Security Copilot**, **Microsoft Copilot Studio**, **Microsoft Foundry**.

### Notebook i MCP zajedno

U VS Code imaš oba alata na istom mjestu: Sentinel ekstenziju za notebooks i Sentinel MCP server dodat kao MCP server (HTTP) za GitHub Copilot u agent modu. Tipičan tok huntinga:

1. Prompt agentu: „Pronađi tabele sa neuspjelim prijavama i napiši upit za password spray u zadnjih 7 dana.“ Agent poziva `list_sentinel_workspaces`, `search_tables`, pa `query_lake` (i sam ispravlja KQL ako upit padne).
2. Kad upit vrati zanimljive IP adrese i naloge, prebaciš logiku u notebook (PySpark nad dužim periodom, vizualizacija).
3. Za sumnjive naloge pozoveš `analyze_user_entity` pa `get_entity_analysis`.
4. Rezultat zapišeš u tabelu (`save_as_table`) ili napraviš KQL job / analytics pravilo.

Ovo je odbrambeni rad nad vlastitim podacima: agent samo čita data lake u okviru tvojih dozvola.

> **Na ispitu:** „SOC želi da analitičari u VS Code pitanjima na prirodnom jeziku pretražuju tabele Sentinel data lakea, bez poznavanja šeme.“ Odgovor: dodati **Sentinel MCP server** (data exploration kolekcija) u VS Code i koristiti GitHub Copilot; minimalna uloga **Security Reader**. Ako se traži i **analiza entiteta sa verdiktom**, potrebni su **Security Copilot Contributor** i SCU. Distraktor: „instalirati MSTICPy u Azure ML“ (to su klasični notebooks, ne MCP).

## Kako birati na ispitu

| Zahtjev u pitanju | Funkcija |
|---|---|
| Gotovi upiti po MITRE taktikama, pregled skokova | **Hunting queries** (Results delta) |
| Sačuvati sumnjiv red i napraviti incident | **Bookmark** > **Incident actions** |
| Hipoteza, upiti, bilješke i ishod na jednom mjestu | **Hunts** (preview) |
| Jednokratan upit nad godinom podataka u data lakeu, rezultat za dalju analizu | **KQL job** (one time) |
| Svaki sat obraditi podatke iz data lakea i rezultat koristiti u detekciji | **KQL job** (scheduled) ili **summary rule** ako je izvor u workspaceu i dovoljno je sažimanje |
| Stalno sažimanje verbose logova u malu Analytics tabelu | **Summary rule** |
| Python, ML, vizualizacija nad data lakeom | **Notebook** (VS Code, Spark) |
| Prirodni jezik i AI agent nad data lakeom | **Sentinel MCP server** |
| Stalno praćenje novih rezultata upita | Ne livestream (ukinut) – **analytics rule** ili **KQL job** |

## Rezime

- Hunting upiti su na **Microsoft Sentinel** > **Threat management** > **Hunting** > **Queries**: Content hub i custom upiti, MITRE taktike/tehnike, **Run all queries**, **Results delta** za skokove, *N/A* za upite bez izvora, favoriti se pokreću pri otvaranju stranice. Upit se pretvara u detekciju preko **New alert rule** > **Create Microsoft Sentinel alert**.
- **Bookmarks** čuvaju redove rezultata sa upitom, tagovima, bilješkama, entitetima i MITRE mapiranjem; **Incident actions** prave incident ili dodaju u postojeći; podaci su u tabeli **`HuntingBookmark`**; bookmarks nisu dostupni u Advanced hunting.
- **Hunts** (preview) objedinjuju hipotezu, upite, bookmarks i ishod. **Livestream više ne postoji** – zamjena su KQL jobs, analytics rules, playbooks.
- **KQL jobs** (**Data lake exploration** > **Jobs**): jednokratni ili zakazani upiti nad data lakeom i federated tabelama; nove tabele `_KQL_CL` (analytics) ili `_KQL` (system tables); limiti 5 istovremenih, 1 h, 100 jobova, 12 godina; start najmanje 30 min nakon kreiranja; bez `adx()`, `arg()`, `externaldata()`, `ingestion_time()` i UDF; latencija do 15 min (`now() - delay`); managed identity `msg-resources-<guid>` treba **Log Analytics Contributor**.
- **Summary rules** (**Configuration** > **Summary rules**): bin 20 min do 24 h, odredište `_CL` sa Analytics planom, dodatne kolone `_RuleName`, `_RuleLastModifiedTime`, `_BinSize`, `_BinStartTime`, najviše 100 aktivnih pravila, bez vremenskog filtera u upitu, bez backfilla; uloga **Microsoft Sentinel Contributor**; templates u Content hubu.
- **Notebooks**: klasični (Azure ML, MSTICPy, analytics tier) i data lake notebooks u VS Code (**Microsoft Sentinel** ekstenzija, `MicrosoftSentinelProvider`, `read_table`, `save_as_table`, pool Small/Medium/Large, samo Python, notebook jobs do 8 h, 3 istovremena).
- **Sentinel MCP server**: hostovan, Entra autentikacija, kolekcije data exploration / triage / agent creation; alati `search_tables`, `query_lake`, `list_sentinel_workspaces`, `analyze_user_entity`, `analyze_url_entity`, `get_entity_analysis`; minimalno **Security Reader**, entity analyzer troši SCU (**Security Copilot Contributor**); klijenti VS Code, Security Copilot, Copilot Studio, Microsoft Foundry.
