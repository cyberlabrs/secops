## Ciljevi ispita: 3.1 (drugi dio)

Ovaj modul nastavlja cilj **3.1 Detect threats by using Microsoft Defender XDR**:

- **Identify threats by using Kusto Query Language (KQL)** – napredni operatori za korelaciju i parsiranje,
- **Create Advanced Hunting queries** – upiti koji spajaju više izvora i traže anomalije,
- **Create hunting graphs, including blast radius**,
- **Analyze relationships between entities by using Sentinel Graph**.

Pretpostavlja se da znaš `where`, `project`, `extend`, `summarize`, `bin` i string operatore iz prethodnog modula.

## `let`: varijable, liste i funkcije

`let` daje ime vrijednosti ili izrazu. Svaka `let` naredba završava tačka-zarezom. U editoru portala ne ostavljaj prazan red između `let` naredbi i upita: prazan red razdvaja upite, pa se izvrši samo dio pod kursorom.

```kql
let Period = 7d;                                           // skalar (timespan)
let Prag = 20;                                             // skalar (broj)
let AdminNalozi = dynamic(["admin", "administrator", "root"]);   // lista
let NeuspjeleIP =                                          // tabelarni izraz
    SecurityEvent
    | where TimeGenerated > ago(Period) and EventID == 4625
    | summarize Neuspjelih = count() by IpAddress
    | where Neuspjelih > Prag
    | project IpAddress;
SecurityEvent
| where TimeGenerated > ago(Period) and EventID == 4624
| where IpAddress in (NeuspjeleIP)                         // uspjeh sa IP koja je imala mnogo neuspjeha
| where Account has_any (AdminNalozi)
| project TimeGenerated, Account, Computer, IpAddress
```

Funkcija sa parametrima:

```kql
let ProcesiNaUredjaju = (Uredjaj: string, Od: timespan) {
    DeviceProcessEvents
    | where Timestamp > ago(Od) and DeviceName =~ Uredjaj
};
ProcesiNaUredjaju("ws-fin-042", 2d)
| summarize count() by FileName
```

`materialize()` kešira rezultat tabelarnog `let` izraza kada se on koristi više puta u istom upitu:

```kql
let Dogadjaji = materialize(SecurityEvent | where TimeGenerated > ago(1d) | where EventID in (4624, 4625));
Dogadjaji | where EventID == 4625 | count;
```

U Sentinelu se upit može sačuvati i kao **funkcija** workspacea (Save > Save as function), pa se poziva po imenu kao tabela. Tako rade **ASIM parseri** (npr. `_Im_Authentication`) i Defender funkcije advanced huntinga kao što su `FileProfile()`, `DeviceFromIP()` i `AssignedIPAddresses()`.

```kql
DeviceFileEvents
| where Timestamp > ago(1d) and ActionType == "FileCreated"
| take 100
| invoke FileProfile(SHA256)                // obogaćivanje: prevalencija, potpis, GlobalPrevalence
| where GlobalPrevalence < 50
```

> **Na ispitu:** prepoznaj `let` sintaksu. Česte greške u ponuđenim odgovorima: nedostaje `;` na kraju `let`, tabelarni `let` se koristi kao skalar (`where IpAddress == NeuspjeleIP` umjesto `in (NeuspjeleIP)`), ili se lista piše kao `("a","b")` umjesto `dynamic(["a","b"])`.

## `join`: spajanje dvije tabele

```kql
LijevaTabela
| join kind=<vrsta> (DesnaTabela) on ZajednickaKolona
```

Ako se kolone zovu različito: `on $left.IpAddress == $right.SourceIp`.

### Vrste spajanja

| `kind=` | Rezultat | Primjena u huntingu |
|---|---|---|
| `innerunique` (**podrazumijevano**) | Lijeva strana se **deduplicira po ključu**, pa se uparuje sa svim pogocima desno | Brzo, ali gubi redove lijeve tabele sa istim ključem |
| `inner` | Svi parovi lijevo × desno koji se poklapaju | Kad treba svaki događaj (npr. svaki mail sa prilogom) |
| `leftouter` | Svi lijevi + poklapanja desno (prazno ako nema) | Obogaćivanje: zadrži sve, dodaj info ako postoji |
| `rightouter` | Svi desni + poklapanja lijevo | Isto, obrnute strane |
| `fullouter` | Svi redovi obje strane | Poređenje dva skupa |
| `leftanti` | Lijevi redovi **bez** para desno | „Uređaji bez MDE“, „nalozi koji se nikad ranije nisu prijavili“ |
| `rightanti` | Desni redovi bez para lijevo | |
| `leftsemi` | Lijevi redovi **sa** parom desno, samo lijeve kolone | Filter: „samo IP adrese koje su i u TI listi“ |
| `rightsemi` | Desni redovi sa parom lijevo | |

Zamka `innerunique`: ako tri maila nose isti prilog (isti `SHA256`), a spajaš `EmailAttachmentInfo` sa `DeviceFileEvents` bez `kind=`, vidjećeš samo jedan mail. Microsoft zato za hunting preporučuje eksplicitno `kind=inner`.

### Spajanje u vremenskom prozoru

Bez vremenskog uslova `join` upari i događaje koji su razmaknuti danima. Tipičan obrazac: uradi `join` po entitetu, pa filtriraj razliku vremena.

```kql
// Prijava na uređaj u roku od 30 minuta nakon prijema malicioznog maila
EmailEvents
| where Timestamp > ago(7d) and ThreatTypes has "Malware"
| project MailVrijeme = Timestamp, Subject, SenderFromAddress,
          AccountName = tostring(split(RecipientEmailAddress, "@")[0])
| join kind=inner (
    DeviceLogonEvents
    | where Timestamp > ago(7d)
    | project PrijavaVrijeme = Timestamp, AccountName, DeviceName
) on AccountName
| where (PrijavaVrijeme - MailVrijeme) between (0min .. 30min)
```

### Brute force pa uspjeh (klasika)

```kql
let Neuspjesi = SecurityEvent
    | where TimeGenerated > ago(1d) and EventID == 4625
    | summarize Neuspjelih = count(), Zadnji = max(TimeGenerated) by Account, IpAddress
    | where Neuspjelih > 20;
let Uspjesi = SecurityEvent
    | where TimeGenerated > ago(1d) and EventID == 4624
    | project Uspjeh = TimeGenerated, Account, IpAddress, Computer;
Neuspjesi
| join kind=inner Uspjesi on Account, IpAddress
| where Uspjeh > Zadnji
| project Account, IpAddress, Computer, Neuspjelih, Zadnji, Uspjeh
```

### Performanse `join`

- **Manja tabela lijevo** – lijeva strana se uparuje sa desnom, manje redova = brže.
- **Vremenski filter na obje strane**.
- **`project` prije spajanja** – samo kolone koje trebaš.
- `hint.shufflekey = Kolona` – za ključeve sa ogromnim brojem različitih vrijednosti (npr. `AccountObjectId`).
- `hint.strategy = broadcast` – lijeva strana mala (do 100.000 redova), desna ogromna.

### `lookup`

`lookup` je specijalizovani `join` za obogaćivanje velike tabele malom „dimenzionom“ tabelom (npr. lista servera i vlasnika). Podrazumijevano je `kind=leftouter`, a desna strana se optimizuje kao mala.

```kql
let Kriticni = datatable(Computer: string, Vlasnik: string) [
    "dc01.contoso.com", "IT infrastruktura",
    "sql-prod.contoso.com", "Baze podataka"
];
SecurityEvent
| where TimeGenerated > ago(1d) and EventID == 4625
| lookup kind=inner Kriticni on Computer
```

`datatable` pravi malu tabelu direktno u upitu, korisno za liste i za testiranje.

> **Na ispitu:** „Trebate pronaći uređaje iz `DeviceInfo` koji u posljednjih 7 dana nisu imali nijedan događaj u `DeviceProcessEvents`“ – to je **`leftanti`** (lijevo `DeviceInfo`). „Prikazati sve korisnike i, ako postoji, njihov odjel iz `IdentityInfo`“ – **`leftouter`**. „Prikazati svaki mail koji nosi zlonamjerni hash, ne samo jedan“ – **`inner`** umjesto podrazumijevanog `innerunique`.

## `union`: više tabela u jednu

`union` slaže redove više tabela jednu ispod druge (ne spaja kolone kao `join`). Kolone sa istim imenom i tipom se poklapaju, ostale ostaju prazne gdje ih nema.

```kql
union withsource=Izvor DeviceProcessEvents, DeviceNetworkEvents, DeviceFileEvents
| where Timestamp > ago(1d)
| where DeviceName =~ "ws-fin-042"
| summarize Dogadjaja = count() by Izvor
```

- `withsource=Kolona` dodaje kolonu sa imenom izvorne tabele,
- `union Device*` uzima sve tabele čije ime počinje sa `Device` (pazi na performanse),
- `union isfuzzy=true` ne pada ako neka tabela ne postoji (bitno za pravila koja treba da rade u više workspaceova),
- `search in (T1, T2) "tekst"` je brz način za traženje vrijednosti u nekoliko tabela bez pisanja `union`.

| `join` | `union` |
|---|---|
| Spaja kolone (proširuje red) | Slaže redove (produžava tabelu) |
| Treba zajednički ključ | Ne treba ključ |
| „Koji proces je napravio ovu konekciju?“ | „Sve aktivnosti uređaja u jednoj listi“ |

## Parsiranje: `parse`, `extract`, `split`, `parse_json`

Logovi često imaju važne podatke u jednom tekstualnom polju (Syslog poruka, `AdditionalFields`, komandna linija).

### `parse` (preporučeno)

`parse` opisuje obrazac teksta sa `*` za dio koji preskačeš i imenima kolona za dio koji izdvajaš.

```kql
// Syslog poruka: "Failed password for invalid user admin from 203.0.113.7 port 51522 ssh2"
Syslog
| where ProcessName == "sshd" and SyslogMessage has "Failed password"
| parse SyslogMessage with * "for " * "user " Korisnik " from " IzvorIP " port " Port:int " " *
| summarize Pokusaja = count() by IzvorIP, Korisnik
```

Napomena: obrazac mora odgovarati svakom redu koji želiš; redovi koji ne odgovaraju dobijaju prazne kolone. `parse-where` umjesto `parse` izbacuje redove koji ne odgovaraju obrascu. `parse kind=regex` dozvoljava regex u obrascu.

### `extract` (regex)

```kql
DeviceProcessEvents
| where Timestamp > ago(1d) and FileName =~ "powershell.exe"
| extend Url = extract(@"(https?://[^\s'""]+)", 1, ProcessCommandLine)
| where isnotempty(Url)
```

`extract(regex, grupa, tekst)` vraća zadatu grupu prvog pogotka. Regex je skup, pa ga koristi tek nakon filtera i samo kad `parse` ne može.

### `split`, `parse_json`, `todynamic`

```kql
// split vraća niz; [0] je prvi element
| extend Korisnik = tostring(split(RecipientEmailAddress, "@")[0])

// JSON u stringu -> dynamic, pa pristup poljima tačkom ili ["ime"]
DeviceEvents
| where Timestamp > ago(1d) and ActionType == "UsbDriveMount"
| extend Polja = parse_json(AdditionalFields)
| extend Slovo = tostring(Polja.DriveLetter), Proizvodjac = tostring(Polja.Manufacturer)
```

Vrijednosti iz `dynamic` kolone uvijek pretvori (`tostring()`, `toint()`) prije poređenja, grupisanja ili `join`.

Za specifične formate postoje gotove funkcije: `parse_command_line()`, `parse_path()`, `parse_url()`, `parse_ipv4()`, `ipv4_is_private()`, `ipv4_is_in_range(IP, "10.0.0.0/8")`.

> **Na ispitu:** ponuđeno je nekoliko načina da se izdvoji IP iz teksta. Microsoft preporuka je **„parse, don't extract“**: `parse` ili funkcija za format (`parse_json`, `parse_command_line`) prije `extract()` i `matches regex`, jer regex troši više CPU-a. Regex je ispravan odgovor tek kada format nije stalan.

## `mv-expand`: niz u redove

Kolona tipa `dynamic` (niz) može se razviti tako da svaki element postane poseban red.

```kql
// AlertInfo ima AttackTechniques kao JSON niz; koliko alarma po MITRE tehnici?
AlertInfo
| where Timestamp > ago(30d)
| extend Tehnike = parse_json(AttackTechniques)
| mv-expand Tehnika = Tehnike to typeof(string)
| summarize Alarma = count() by Tehnika
| top 10 by Alarma
```

Obrnuti smjer (redovi u niz) su `make_set()` i `make_list()` u `summarize`. `mv-apply` primjenjuje podupit na svaki niz posebno (npr. „uzmi prva 3 elementa svakog niza“).

## `arg_max` i `arg_min`: posljednje stanje entiteta

`arg_max(Kolona, *)` vraća **cijeli red** sa najvećom vrijednošću kolone, po grupi. Klasična upotreba: posljednji poznati zapis o uređaju ili nalogu.

```kql
// Posljednje stanje svakog uređaja
DeviceInfo
| where Timestamp > ago(7d)
| summarize arg_max(Timestamp, *) by DeviceId
| project DeviceName, OSPlatform, OSVersion, PublicIP, Timestamp
```

```kql
// Prva prijava svakog naloga sa nove IP adrese
SigninLogs
| where TimeGenerated > ago(14d)
| summarize arg_min(TimeGenerated, AppDisplayName, Location) by UserPrincipalName, IPAddress
```

| Izraz | Vraća |
|---|---|
| `max(TimeGenerated)` | samo vrijednost (najkasnije vrijeme) |
| `arg_max(TimeGenerated, *)` | cijeli red u kojem je to vrijeme |
| `arg_max(TimeGenerated, A, B)` | vrijeme + kolone A i B iz tog reda |
| `take_any(*)` | proizvoljan red (bez garancije koji) |

> **Na ispitu:** „Trebate za svaki uređaj prikazati samo najnoviji zapis iz `DeviceInfo` sa svim kolonama“ – `summarize arg_max(Timestamp, *) by DeviceId`. Distraktori: `top 1 by Timestamp` (jedan red za **sve** uređaje), `summarize max(Timestamp) by DeviceId` (gubi ostale kolone), `distinct DeviceId` (bez kolona).

## Vremenske serije i anomalije

`summarize ... by bin()` ne vraća redove za intervale bez podataka. `make-series` pravi **kontinualnu seriju** (niz vrijednosti) sa zadatom podrazumijevanom vrijednošću za praznine, što je preduslov za analizu serija.

```kql
make-series Agregacija = count() default=0 on KolonaVremena from Pocetak to Kraj step Korak by Kljuc
```

Rezultat ima jedan red po ključu, a `Agregacija` i `KolonaVremena` su **nizovi** iste dužine.

### `series_decompose_anomalies`

Funkcija rastavlja seriju na sezonalnost, trend i ostatak i označava tačke koje znatno odstupaju. Vraća tri niza: oznaku anomalije (`+1` skok, `-1` pad, `0` normalno), skor i očekivanu vrijednost (baseline). Drugi argument je prag (podrazumijevano **1.5**; veći prag = manje anomalija).

```kql
// Dani sa neuobičajenim brojem neuspjelih prijava po računaru
let Pocetak = startofday(ago(30d));
let Kraj = startofday(now());
SecurityEvent
| where TimeGenerated between (Pocetak .. Kraj) and EventID == 4625
| make-series Neuspjelih = count() default=0 on TimeGenerated from Pocetak to Kraj step 1d by Computer
| extend (Anomalije, Skor, Ocekivano) = series_decompose_anomalies(Neuspjelih, 2.5)
| mv-expand TimeGenerated to typeof(datetime), Neuspjelih to typeof(long),
            Anomalije to typeof(int), Ocekivano to typeof(double)
| where Anomalije == 1                         // samo skokovi
| project Computer, TimeGenerated, Neuspjelih, Ocekivano
```

Za vizualizaciju bez `mv-expand`:

```kql
StormEvents
| make-series Dogadjaja = count() default=0 on StartTime
    from datetime(2007-01-01) to datetime(2008-01-01) step 1d
| extend Anomalije = series_decompose_anomalies(Dogadjaja)
| render anomalychart with (anomalycolumns=Anomalije)
```

Srodne funkcije: `series_decompose_forecast()` (predviđanje), `series_fit_line()` (linearni trend), `series_stats()` (min, max, prosjek serije).

| Pristup | Kada |
|---|---|
| Fiksni prag (`where count_ > 100`) | Jednostavno, ali isti prag za mali i veliki server |
| Statistika po entitetu (`avg`, `stdev` pa poređenje) | Bolje, ali ručno |
| `make-series` + `series_decompose_anomalies` | Sam računa baseline po entitetu, uzima u obzir sedmični ritam |
| Sentinel **anomalies** (UEBA, ML pravila) | Gotove anomalije bez pisanja upita (cilj 1.4) |

> **Na ispitu:** prepoznaj lanac `make-series ... default=0 ... step` → `series_decompose_anomalies()` → `mv-expand` → `where Anomalije != 0`. Ako upit koristi `summarize ... by bin()` prije `series_decompose_anomalies`, to je greška: funkcija traži **niz** (dynamic), a ne kolonu skalara.

## Hunting graph i blast radius

Tabelarni upiti teško pokazuju **putanje**: „od ovog kompromitovanog naloga, do kojih kritičnih resursa napadač može stići?“. Za to Defender koristi grafove koje pokreće **Microsoft Sentinel graph**.

### Hunting graph (advanced hunting)

- Putanja: **Investigation & response** > **Hunting** > **Advanced hunting**, ikona hunting grafa ili **Create new** > **Hunting graph**. Otvara se kartica **New graph**.
- Graf ima **čvorove** (uređaj, korisnik, IP, storage account, key vault…) i **ivice** (odnosi kao „has permissions to“, „can authenticate as“, „member of“, „frequently logged in by“, „has credentials of“).
- **Search with Predefined scenarios**: izabereš scenarij, uneseš ulaze, dodaš filtere, pa **Run scenario**.

Primjeri predefinisanih scenarija:

| Scenarij | Pitanje |
|---|---|
| **Attack paths to critical asset** | Kojim putanjama se može stići do kritičnog resursa (lateral movement)? |
| **Entity relationship map** | Sve direktne veze izabranog entiteta (ulazne i izlazne) |
| **Paths between two entities** | Postoji li put od entiteta A do entiteta B? |
| **Access to key vaults** | Ko direktno ili indirektno ima pristup key vaultu? |
| **Users with access to sensitive data** | Koji korisnici dosežu storage sa osjetljivim podacima? |
| **Potential data exfiltration by device** | Do kojih storage accounta uređaj može doći? |
| **Paths to domain admins**, **Paths to domain compromise (DCSync)** | Putanje od neprivilegovanog korisnika do preuzimanja domena |
| **Kerberoast paths to critical assets** | Kerberoast-ranjivi nalozi na putu ka kritičnim resursima |

Filteri: izvorni čvor (**Is critical**, **Is vulnerable**, **Is exposed to the internet**), ciljni čvor (**Has sensitive data**…), tip ivice, smjer ivice, i **Show only the shortest paths**.

Preduslovi: Defender uloga za advanced hunting, onboarding na **Microsoft Sentinel data lake** (graf se automatski provizionira za tenant sa data lakeom) i bar **read** pristup u **Microsoft Security Exposure Management**. Uslovi dostupnosti se mijenjaju, pa ih prije uvođenja provjeri u dokumentaciji.

### Blast radius u incident grafu

U incidentu (**Incidents** > incident > attack story graf) izabereš čvor i **View blast radius**. Prikazuje se **osam najbolje rangiranih putanja** od kompromitovanog entiteta do predefinisanih kritičnih ciljeva; **View full blast radius list** daje sve dostupne ciljeve. Bitno:

- blast radius **proširuje i zamjenjuje** raniju attack path analizu u incidentu,
- spaja **pre-breach** (izloženost, dozvole) i **post-breach** (šta je kompromitovano) pogled,
- putanje su **moguće**, ne potvrđene; ograničene su brojem skokova (5 cloud, 5 on-prem, 3 hibridno),
- vrijednost zavisi od toga koliko je **kritičnih resursa** klasifikovano u Exposure Managementu,
- korisnik vidi samo čvorove u svom RBAC opsegu.

### Microsoft Sentinel graph

**Sentinel graph** je zajednička grafovska analitika nad podacima iz data lakea (resursi, identiteti, aktivnosti, threat intelligence). Ne koristi se direktno KQL-om nego kroz iskustva koja ga koriste:

| Iskustvo | Gdje |
|---|---|
| Incident graph sa **blast radius** | Defender XDR incidenti |
| **Hunting graph** | Advanced hunting |
| Attack paths | Exposure Management, Defender for Cloud |
| Data risk graph | Purview Insider Risk Management, Data Security Investigations |
| **Custom graphs** (preview) | Pravi se u Jupyter notebooku (Sentinel ekstenzija za VS Code), objavljuje kao graph job, upituje se jezikom **GQL** na stranici **Graphs** u Defender portalu |

Na ispitu je bitan koncept: tabela odgovara na „šta se desilo“, graf na „šta je **povezano** i kuda napadač **može** dalje“.

> **Na ispitu:** „Analitičar istražuje incident sa kompromitovanim nalogom i treba brzo vidjeti do kojih kritičnih resursa napadač može stići sa tog naloga“ – u incident grafu izabrati entitet i **View blast radius**. „Proaktivno, bez incidenta, pronaći ko ima put do određenog key vaulta“ – **hunting graph** sa scenarijem **Access to key vaults**. Pisanje `join` upita nad `IdentityInfo` je moguće, ali nije odgovor uz najmanje napora.

## Kombinovani primjer: od sumnje do liste

```kql
// 1) IP adrese koje rade password spray
let SprayIP = SecurityEvent
    | where TimeGenerated > ago(1d) and EventID == 4625
    | summarize Naloga = dcount(Account) by IpAddress
    | where Naloga > 15
    | project IpAddress;
// 2) Uspješne prijave sa tih adresa, posljednja po nalogu
SecurityEvent
| where TimeGenerated > ago(1d) and EventID == 4624
| where IpAddress in (SprayIP)
| summarize arg_max(TimeGenerated, Computer, LogonType) by Account, IpAddress
// 3) Obogaćivanje: da li je nalog privilegovan (lista iz watchliste)
| join kind=leftouter (_GetWatchlist('PrivilegovaniNalozi') | project Account = SearchKey, Uloga) on Account
| extend Prioritet = iff(isnotempty(Uloga), "Visok", "Srednji")
```

`_GetWatchlist('ime')` čita Sentinel **watchlistu**; kolona `SearchKey` je ključ koji si izabrao pri kreiranju liste.

## Rezime

- `let` za skalare, liste (`dynamic([...])`), tabelarne izraze i funkcije; završava se sa `;`. `materialize()` kešira izraz koji se koristi više puta.
- `join`: podrazumijevano **`innerunique`** (deduplicira lijevo); `inner` za sve parove, `leftouter` za obogaćivanje, `leftanti` za „nema para“, `leftsemi` kao filter. Manja tabela lijevo, vrijeme na obje strane, `project` prije. `lookup` za malu dimenzionu tabelu.
- `union` slaže redove više tabela; `withsource`, `isfuzzy=true`, wildcard `Device*`.
- Parsiranje: `parse` / `parse-where` i funkcije formata prije `extract()` i regexa; `parse_json` + `tostring()`.
- `mv-expand` razvija niz u redove; `make_set`/`make_list` rade obrnuto.
- `arg_max(Timestamp, *) by Entitet` = posljednje stanje entiteta.
- `make-series ... default=0` → `series_decompose_anomalies(serija, prag)` → `mv-expand` → filter `Anomalije != 0`; `render anomalychart`.
- **Hunting graph** (advanced hunting, predefinisani scenariji, filteri) i **blast radius** (incident graf, 8 najboljih putanja) koriste **Sentinel graph**; preduslov je Sentinel data lake i Exposure Management read. Custom graphs se upituju sa GQL.
