## Ciljevi ispita: 1.2

Domen 1 (**Manage a security operations environment**) nosi 40–45% ispita. Ovaj modul pokriva cilj **1.2 Configure the Microsoft Sentinel SIEM and platform**:

- **Specify Microsoft Sentinel roles**,
- **Manage data retention for XDR and Microsoft Sentinel tables, including Analytics, Data lake, and XDR tiers**,
- **Create and configure Microsoft Sentinel workbooks**,
- **Optimize the Microsoft Sentinel platform, including SOC optimization recommendations**.

Unos podataka (konektori, DCR) je u modulu 4, detekcije u modulu 5, a data lake KQL jobovi, summary rules i notebooks u modulu 10.

## Arhitektura u jednoj slici

**Microsoft Sentinel** je SIEM i SOAR koji radi nad **Log Analytics workspaceom**. Kad „uključiš Sentinel“, na workspace se dodaje rješenje `SecurityInsights`; podaci su u tabelama workspacea, a Sentinel dodaje analytics pravila, incidente, automatizaciju, workbooks, hunting i threat intelligence.

Od 2025. Sentinel se koristi kroz **Microsoft Defender portal** (unified security operations):

- Sentinel je u Defender portalu **GA**, i za korisnike bez Defender XDR licenci,
- nakon **31. marta 2027.** Sentinel više nije podržan u Azure portalu; svi korisnici se preusmjeravaju u Defender portal,
- nove funkcije (data lake, Sentinel graph, case management, SOC optimization preko API-ja, Security Copilot agenti) stižu prvo, ili samo, u Defender portal,
- incidenti Sentinela i Defender XDR-a su u **jednom redu incidenata**, sa automatskom korelacijom alarma.

### Gdje je šta u Defender portalu

| Azure portal (Sentinel) | Defender portal |
|---|---|
| **Logs** | **Investigation & response** > **Hunting** > **Advanced hunting** |
| **Incidents** | **Investigation & response** > **Incidents & alerts** > **Incidents** |
| **Workbooks** | **Microsoft Sentinel** > **Threat management** > **Workbooks** |
| **Hunting** | **Microsoft Sentinel** > **Threat management** > **Hunting** |
| **Notebooks** | **Microsoft Sentinel** > **Threat management** > **Notebooks** |
| **MITRE ATT&CK** | **Microsoft Sentinel** > **Threat management** > **MITRE ATT&CK** |
| **Threat intelligence** | **Threat intelligence** > **Intel management** |
| **Content hub** | **Microsoft Sentinel** > **Content management** > **Content hub** |
| **Data connectors** | **Microsoft Sentinel** > **Configuration** > **Data connectors** |
| **Analytics** | **Microsoft Sentinel** > **Configuration** > **Analytics** (i **Custom detection rules** pod Hunting) |
| **Watchlists** | **Microsoft Sentinel** > **Configuration** > **Watchlists** |
| **Automation** | **Microsoft Sentinel** > **Configuration** > **Automation** |
| **Settings** | **System** > **Settings** > **Microsoft Sentinel** |
| (nema) | **Microsoft Sentinel** > **Configuration** > **Tables** (tierovi i retencija) |
| **SOC optimization** | **SOC optimization** (u lijevom meniju) |
| **Workspace manager** | nije dostupan |

U Defender portal se može povezati više workspaceova. Jedan je **primary workspace**: njegovi alarmi se koreliraju sa Defender XDR podacima u zajedničke incidente. Ostali su sekundarni (vide se i istražuju, ali se ne koreliraju sa XDR-om na isti način).

> **Na ispitu:** pitanje „gdje u Defender portalu podesiti X“ traži putanju. Pamti obrazac: **Threat management** (workbooks, hunting, notebooks, MITRE), **Content management** (content hub, repositories), **Configuration** (data connectors, analytics, watchlists, automation, **tables**), a podešavanja workspacea su pod **System > Settings > Microsoft Sentinel**. Logs više ne postoji kao zaseban meni – to je advanced hunting.

## Uloge (Specify Microsoft Sentinel roles)

Sentinel SIEM koristi **Azure RBAC**. Sentinel data lake koristi **Microsoft Entra ID** uloge i Defender **unified RBAC (URBAC)**.

### Ugrađene Azure uloge za Sentinel

| Uloga | Šta može |
|---|---|
| **Microsoft Sentinel Reader** | Vidi podatke, incidente, workbooks, preporuke i ostale resurse; ne mijenja ništa |
| **Microsoft Sentinel Responder** | Sve što Reader + **upravlja incidentima** (dodjela, status, komentari, zatvaranje) |
| **Microsoft Sentinel Contributor** | Sve što Responder + **kreira i mijenja** analytics pravila, workbooks, watchliste, instalira rješenja iz Content huba |
| **Microsoft Sentinel Playbook Operator** | Lista, pregled i **ručno pokretanje** playbooka |
| **Microsoft Sentinel Automation Contributor** | Dozvoljava **Sentinelu** (servisnom nalogu) da dodaje playbooke u automation rules; **nije za korisnike** |

Šta koja uloga može (uz pomoćne uloge):

| Uloga | Pokreće playbook | Pravi/mijenja playbook | Pravi analytics pravila, workbooks | Upravlja incidentima | Vidi podatke i incidente | Content hub |
|---|---|---|---|---|---|---|
| Sentinel Reader | – | – | – (workbook uz **Workbook Contributor**) | – | ✓ | – |
| Sentinel Responder | – | – | – (workbook uz **Workbook Contributor**) | ✓ | ✓ | – |
| Sentinel Contributor | – | – | ✓ | ✓ | ✓ | ✓ |
| Sentinel Playbook Operator | ✓ | – | – | – | – | – |
| **Logic App Contributor** | ✓ | ✓ | – | – | – | – |

### Dodatne potrebe

| Zadatak | Potrebno |
|---|---|
| Povezati izvor podataka (konektor) | **Write** dozvola na workspaceu (+ dozvole specifične za konektor) |
| Instalirati sadržaj iz Content huba | Microsoft Sentinel Contributor na resource group |
| Praviti/mijenjati playbooke | **Logic App Contributor** |
| Pokretati playbooke ručno | Microsoft Sentinel Playbook Operator |
| Da automation rule pokreće playbook | Sentinel servisni nalog treba eksplicitne dozvole na **resource group playbooka**; da bi ih dodijelio, ti treba da si **Owner** (ili imaš pravo dodjele uloga) |
| Gost (B2B) dodjeljuje incidente | **Directory Reader** (Entra uloga) + Microsoft Sentinel Responder |
| Kreirati/brisati workbook | Microsoft Sentinel Contributor, ili niža Sentinel uloga + **Workbook Contributor** |

Preporuka: uloge dodjeljuj na **resource group** koji sadrži workspace, da bi pokrile i Logic Apps i ostale resurse. Ako dodjeljuješ direktno na workspace, istu ulogu treba dodijeliti i na `SecurityInsights` solution resource.

Široke uloge **Owner**, **Contributor**, **Reader** i **Log Analytics Contributor/Reader** takođe daju pristup Sentinelu. Dodjele su **kumulativne**: korisnik sa Reader i Contributor ima prava Contributora.

Preporučena raspodjela:

| Persona | Uloge |
|---|---|
| SOC analitičar | Microsoft Sentinel **Responder** + **Playbook Operator** |
| Security engineer | Microsoft Sentinel **Contributor** + **Logic App Contributor** |
| Service principal za automatizaciju (CI/CD) | Microsoft Sentinel Contributor |

### Ograničen pristup podacima

- **Resource-context RBAC** – korisnik vidi samo logove resursa kojima ima pristup u Azureu (npr. tim aplikacije vidi samo logove svojih VM-ova), bez pristupa cijelom workspaceu.
- **Table-level RBAC** – pristup samo određenim tabelama.
- **Custom Azure uloge** za Sentinel SIEM; **Defender URBAC custom uloge** za data lake.
- U Defender portalu unified RBAC podržava i granularnije (row-level) dozvole.

### Data lake uloge (Entra ID)

| Potreba | Uloga |
|---|---|
| Čitanje svih workspaceova u data lakeu | **Global Reader**, **Security Reader**, **Security Operator**, **Security Administrator**, **Global Administrator** |
| Pisanje u data lake ili u analytics tier kroz KQL jobove / notebooke | **Security Operator**, **Security Administrator**, **Global Administrator** |
| Kreiranje i upravljanje **jobovima** u data lakeu | **Security Operator**, **Security Administrator**, **Global Administrator** |
| Čitanje jednog workspacea u lakeu | Azure uloga na tom workspaceu (Log Analytics Reader, Sentinel Reader…) |

Microsoft preporučuje najmanje privilegije: Global Administrator samo za hitne slučajeve.

> **Na ispitu:** „Analitičari trebaju zatvarati incidente i ručno pokretati playbooke, ali ne smiju mijenjati analytics pravila“ – **Responder + Playbook Operator**. „Inženjer treba praviti playbooke“ – **Logic App Contributor** (Sentinel Contributor ne daje pravo na Logic Apps). „Automation rule ne može pokrenuti playbook“ – dodijeliti Sentinelu dozvole na resource group playbooka (Sentinel **Settings** > **Playbook permissions**). „Korisnik treba vidjeti samo logove svojih VM-ova“ – **resource-context RBAC**.

## Retencija i tierovi (Analytics, Data lake, XDR)

### Tri mjesta za podatke

| Tier | Šta je | Za šta |
|---|---|---|
| **Analytics tier** („hot“) | Klasični Sentinel/Log Analytics podaci, indeksirani | Analytics pravila, alarmi, advanced hunting, workbooks, sve real-time funkcije |
| **Data lake tier** („cold“) | **Microsoft Sentinel data lake**, jeftino dugoročno skladište u otvorenom (Parquet) formatu | Usklađenost, forenzika, istorijski trendovi; KQL jobovi, Spark/notebooks, summary rules, search |
| **XDR default tier** | Native Defender XDR podaci u advanced huntingu | 30 dana, uključeno u Defender licencu, nije u Sentinel workspaceu |

Podaci u analytics tieru se **automatski preslikavaju (mirror)** u data lake. Postoji jedna kopija podataka; nema dupliranog unosa.

### Brojevi koje treba znati

| Postavka | Vrijednost |
|---|---|
| Podrazumijevana analytics retencija | **30 dana**; Sentinel tabele se mogu besplatno produžiti na **90 dana** (Microsoft u poređenju tierova navodi 90 dana za Sentinel i 30 dana za Defender XDR) |
| Maksimalna analytics retencija | **2 godine** (uz mjesečnu naknadu za dužu retenciju) |
| Total retention (analytics + lake) | do **12 godina** |
| Data lake–only retencija | od 30 dana do **12 godina** |
| XDR tabele u analytics tieru | do **90 dana** bez troška skladištenja (plaća se unos u Sentinel), iznad 90 dana se plaća i skladištenje |
| Skraćivanje total retencije | brisanje tek nakon **30 dana**, da se greška može vratiti |
| Promjena analytics retencije | važi **odmah** |

### Analytics vs Data lake

| | Analytics tier | Data lake tier |
|---|---|---|
| Cijena unosa | standardna | minimalna |
| Upiti uključeni u cijenu | ✓ | ✗ (plaća se obrada upita) |
| Brzina upita | optimizovano | sporije, za reviziju i istrage |
| Analytics pravila, hunting upiti, watchliste, workbooks, playbooks | ✓ | ograničeno / ne |
| Advanced hunting | ✓ | ✗ (koristi se Data lake exploration) |
| Search jobs | ✓ | ✓ |
| Summary rules | ✓ | ✓ (KQL nad jednom tabelom, proširivo `lookup`-om na analytics tabelu) |
| Restore | ✓ | ✗ (KQL jobovi i notebooki **promovišu** podatke u analytics tier) |
| Data export | ✓ | ✗ |

### Tipovi tabela u Defender portalu

| Tip | Primjeri | Upravljanje |
|---|---|---|
| **Microsoft Sentinel** | `SigninLogs`, `AzureDiagnostics`, `SecurityAlert`, `AWSCloudTrail`, XDR tabele uvedene u workspace (`DeviceEvents`, `AlertInfo`) | da |
| **Custom** | `_CL` (custom izvori), `_SRCH` (rezultati search joba), summary rule tabele | da |
| **XDR** | tabele u XDR default tieru (npr. `IdentityInfo`) | samo pregled |

**Basic Logs** tabele se u Defender portalu vide, ali se njima i dalje upravlja iz Log Analytics workspacea u Azureu (ili ih prebaciš na Analytics plan).

### Upravljanje tabelom (koraci)

1. Defender portal > **Microsoft Sentinel** > **Configuration** > **Tables**.
2. Po potrebi promijeni workspace (gore lijevo).
3. Izaberi tabelu → bočni panel (izvori, opis, tier, retencija) → **Manage table**.
4. Izaberi:
   - **Analytics tier**: **Analytics retention** (30 dana – 2 godine) i **Total retention** (do 12 godina u lakeu), ili
   - **Data Lake tier**: **Retention** od 30 dana do 12 godina; podaci su **samo** u lakeu.
5. Pročitaj upozorenja (npr. prelazak u data lake gasi alarmiranje, advanced hunting, analytics pravila i custom detekcije za tu tabelu).
6. **Save**.

Ograničenja i ponašanje:

- Tier se može promijeniti bilo kad, ali **ne za sve tabele**: neke XDR i Sentinel solution tabele moraju ostati u analytics tieru jer ih Microsoft servisi koriste za near-real-time analizu.
- Za XDR tabele: podizanje retencije iznad 30 dana **uvodi** tabelu u Sentinel workspace (analytics tier + mirror u lake). Vraćanje obje retencije na 30 dana **zaustavlja** unos (i gasi tu tabelu u XDR konektoru u Azure portalu).
- XDR tabela se može slati **samo u data lake**; i tada je 30 dana dostupna u advanced huntingu bez dodatnog troška.

Primjer iz dokumentacije: analytics retencija 180 dana, total 180 dana. Ako analytics spustiš na 90, a total ostaviš na 180, podaci stari 90–180 dana prestaju biti u analytics tieru, ali ostaju u data lakeu.

Primjeri troška za XDR tabelu:

| Analytics | Total | Šta se plaća |
|---|---|---|
| 30 (default) | 30 | ništa dodatno |
| 90 | 90 | unos u analytics; skladištenje 90 dana besplatno; lake bez troška |
| 90 | 180 | unos u analytics; 90 dodatnih dana u lakeu |
| 0 (samo lake) | 5 godina | unos u lake + 5 godina skladištenja u lakeu |

**Table insights** (na istoj stranici **Tables**) prikazuje volumen po tieru, fluktuacije unosa (posljednja 24 h u odnosu na isti dan prošle sedmice), top 5 tabela po volumenu, **Last data received**, procijenjeni dnevni trošak i anomalije volumena. Koristi se da se otkrije konektor koji je utihnuo ili skok troška. To je samo prikaz: za alarm na „konektor ne šalje podatke“ pravi se analytics pravilo nad `SentinelHealth` ili `Usage`.

```kql
// Tabele koje u posljednja 24 h nisu primile podatke, a ranije jesu
Usage
| where TimeGenerated > ago(7d)
| summarize Posljednji = max(TimeGenerated), GB = sum(Quantity) / 1024 by DataType
| where Posljednji < ago(24h)
```

> **Na ispitu:** „Firewall logovi se moraju čuvati 7 godina zbog regulative, rijetko se pretražuju i ne koriste se u analytics pravilima. Kako NAJJEFTINIJE?“ – tabela u **Data lake tier** sa retencijom 7 godina. „Logovi trebaju alarmiranje u realnom vremenu, a zatim čuvanje 3 godine“ – **Analytics tier** (npr. 90 dana analytics) i **Total retention** 3 godine. „Trebaju nam MDE događaji za advanced hunting 60 dana“ – podići analytics retenciju XDR tabele na 60 dana (do 90 dana bez troška skladištenja).

## Workbooks

**Workbooks** su interaktivni izvještaji i dashboardi zasnovani na **Azure Monitor Workbooks**. Svaki workbook je **Azure resurs** (u resource groupi workspacea), sačuvan kao JSON definicija – bez podataka; podaci se čitaju upitima pri otvaranju.

### Iz šablona (template)

1. Instaliraj rješenje (solution) ili samostalni workbook iz **Content huba**.
2. **Microsoft Sentinel** > **Threat management** > **Workbooks** > kartica **Templates**.
3. Izaberi šablon; provjeri **Required data types** (bez tih podataka workbook je prazan).
4. **Save** → izaberi lokaciju; nastaje Azure resurs.
5. **View saved workbook** → **Edit** za prilagođavanje → **Done editing**.

Sačuvani workbooks su na kartici **My workbooks**. **Save as** pravi kopiju (clone) u istoj pretplati i resource groupi. Šabloni se ne mogu brisati; brisanje sačuvanog workbooka je trajno.

### Od nule

1. **Workbooks** > **Add workbook** > **Edit**.
2. Dodaj elemente: **text**, **parameters**, **query**, **metric**, **links/tabs**, **group**.
3. Za upit: **Data source** = **Logs**, **Resource type** = **Log Analytics**, izaberi workspace(ove).
4. **Done editing** > **Save** (ime, pretplata, resource group).

Najčešći element je parametar **TimeRange**, koji upiti koriste kao `{TimeRange}`:

```kql
SecurityEvent
| where TimeGenerated {TimeRange}
| where EventID == 4625
| summarize Neuspjelih = count() by bin(TimeGenerated, 1h), Computer
| render timechart
```

Parametar može biti i drop-down lista (npr. `{Racunar}` napunjen upitom `SecurityEvent | distinct Computer`), pa upit koristi `| where Computer in ({Racunar})`.

Preporuke iz dokumentacije:

- u upitima workbooka koristi **ASIM parsere** (npr. `_Im_Authentication`) umjesto jedne tabele, da workbook radi sa svakim izvorom koji se normalizuje,
- različiti workbooks za različite persone (mrežni admin, SOC menadžer),
- auto refresh od **5 minuta do 1 dana**; pauzira se tokom uređivanja i isključuje kad zatvoriš workbook,
- **Print / Save as PDF** postoji samo u Azure portalu; iz Defender portala se koristi **Open in Azure** (i za neke vizualizacije koje Defender portal ne prikazuje).

Dozvole: najmanje **Workbook Reader** (gledanje) ili **Workbook Contributor** (pravljenje i izmjena) na resource groupi workspacea, uz odgovarajuću Sentinel ulogu za čitanje podataka.

Workbook se oslanja na **analytics tier**: ako je tabela prebačena u data lake tier, workbook nad njom prestaje prikazivati podatke.

> **Na ispitu:** „Treba vam dashboard neuspjelih Entra prijava uz NAJMANJE napora“ – instalirati **Microsoft Entra ID** rješenje iz **Content huba** i sačuvati workbook šablon (npr. **Microsoft Entra sign-ins**). „Korisnik vidi workbook ali ne može da ga sačuva“ – nedostaje **Workbook Contributor** (ili Sentinel Contributor). „Treba PDF izvještaj“ – workbook otvoriti u Azure portalu (**Open in Azure**) i **Print content** > **Save as PDF**.

## SOC optimization

**SOC optimization** daje konkretne preporuke kako smanjiti trošak bez gubitka pokrivenosti i kako zatvoriti rupe u detekciji. Preporuke se računaju svakih **24 sata**, specifične su za tvoje okruženje i koriste standardne Sentinel uloge.

Putanja: Defender portal > **SOC optimization** (u Azure portalu: Sentinel > **Threat management** > **SOC optimization**). Kad je workspace u Defender portalu, preporuke uzimaju u obzir i ostale Microsoftove sigurnosne servise.

### Tipovi preporuka

| Tip | Šta predlaže |
|---|---|
| **Data value** | Tabele koje se slabo koriste: uključi analytics pravila ili smanji trošak (drugi plan/tier, prestanak unosa) |
| **Coverage – threat-based** | Rupe u detekciji za konkretne napade (npr. human-operated ransomware): nedostaju pravila ili izvori |
| **Coverage – AI MITRE ATT&CK tagging** (preview) | AI predlaže MITRE taktike/tehnike za pravila bez oznaka |
| **Coverage – risk-based** (preview) | Rupe vezane za poslovne rizike (operativni, finansijski, reputacioni, compliance, pravni) |
| **Similar organizations** | Izvori podataka koje koriste organizacije sličnog profila i industrije, a ti ih nemaš |

### Data value pravila

Gledaju se samo **naplative tabele** koje su primale podatke u posljednjih **30 dana**:

| Zapažanje | Predložena akcija |
|---|---|
| Tabela nije korištena u analytics pravilima/detekcijama 30 dana, ali jeste u workbooks, upitima, huntingu | Uključi analytics šablone **ili** prebaci tabelu na jeftiniji plan (basic / data lake), ako je podobna |
| Tabela uopšte nije korištena 30 dana | Uključi analytics šablone **ili** zaustavi unos i ukloni tabelu, ili je prebaci na dugoročnu retenciju |
| Tabelu koristi samo Azure Monitor | Uključi relevantna pravila **ili** prebaci tabelu u nesigurnosni Log Analytics workspace |
| (preview) Kolona `ConditionalAccessPolicies` u `SigninLogs` / `AADNonInteractiveUserSignInLogs` se ne koristi | Zaustavi unos te kolone |

Ako je tabela izabrana za **UEBA** ili za **threat intelligence matching** analytics pravilo, SOC optimization ne predlaže smanjenje unosa.

### Threat-based pokrivenost

Pregled pokazuje nivo pokrivenosti prema broju aktivnih pravila u odnosu na pravila koja Microsoft preporučuje za scenarij: **High** (preko 75%), **Medium** (30–74%), **Low** (0–29%).

| Zapažanje | Akcija |
|---|---|
| Ima izvora, nema detekcija | Uključi analytics šablone (**Go to Content hub**) |
| Ima šablona, nema izvora | Poveži nove izvore |
| Nema ni jednog ni drugog | Poveži izvore i detekcije ili instaliraj rješenje |

Iz detalja preporuke: **View details**, spider grafovi po taktikama, **View threat scenario in MITRE ATT&CK** (stranica MITRE ATT&CK prefiltrirana za scenarij), **Go to Content hub** ili **Change plan** za tabelu.

### Statusi

| Status | Značenje |
|---|---|
| **Active** | podrazumijevano |
| **In progress** | neko radi na preporuci |
| **Completed** | sve urađeno; preporuka se **automatski** završava ako promjena u okruženju učini preporuku nebitnom (npr. tabela je počela da se koristi u pravilu) |
| **Dismissed** | ne planiraš je primijeniti |

Završene i odbačene preporuke se mogu **reaktivirati** (ponovo se izračunaju, do sat vremena). Preporuke su dostupne i preko **SOC optimization API-ja**.

### Ostale poluge troška

- **Commitment tiers** – fiksni dnevni volumen uz popust (SOC optimization ga može predložiti uz preporuke o podacima),
- **Data lake tier** za obimne, malo korištene logove,
- **ingestion-time transformacije** u DCR-u (filtriranje kolona i redova prije unosa; modul 4),
- **summary rules** – agregacija velikih logova u malu analytics tabelu (modul 10),
- **Table insights** za praćenje volumena i troška po tabeli.

> **Na ispitu:** „Želite automatski utvrditi koje tabele plaćate, a ne koriste se u detekcijama, i dobiti prijedlog akcije“ – **SOC optimization**, **data value** preporuke. „Želite saznati koje detekcije nedostaju za zaštitu od ransomwarea“ – **threat-based coverage** preporuka i **Go to Content hub**. Odgovor „napisati KQL nad `Usage`“ radi, ali nije rješenje uz najmanje napora.

## Rezime

- Sentinel = Log Analytics workspace + `SecurityInsights`; koristi se kroz **Defender portal**, Azure portal je podržan do **31. 3. 2027.** Primary workspace se korelira sa XDR-om.
- Uloge: **Reader** (gleda), **Responder** (+ incidenti), **Contributor** (+ sadržaj i content hub), **Playbook Operator** (pokreće playbooke), **Automation Contributor** (za Sentinel servis, ne korisnike); **Logic App Contributor** za pravljenje playbooka; **Workbook Contributor** za workbooks; dodjela na **resource group**. Data lake: Entra uloge (Security Reader/Operator/Administrator), jobovi traže **Security Operator** ili više.
- Tierovi: **Analytics** (30 dana podrazumijevano, Sentinel tabele do 90 dana besplatno, maksimalno 2 godine), **Data lake** (do 12 godina, jeftino, bez real-time funkcija), **XDR default** (30 dana u advanced huntingu). Analytics se preslikava u lake; total retention do 12 godina. Upravljanje: **Microsoft Sentinel > Configuration > Tables > Manage table**.
- Workbooks: Azure resurs (JSON), iz **Content hub** šablona ili od nule; parametri (`{TimeRange}`), ASIM parseri; Workbook Reader/Contributor; PDF samo u Azure portalu.
- **SOC optimization**: data value (30 dana korištenja), threat-based (High >75%, Medium 30–74%, Low <30%), AI MITRE tagging, risk-based, similar organizations; statusi Active / In progress / Completed / Dismissed; računa se svaka 24 h.
