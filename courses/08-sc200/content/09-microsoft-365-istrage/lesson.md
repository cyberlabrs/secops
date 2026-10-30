## Ciljevi ispita: 2.3

Domen 2 (**Respond to security incidents**) nosi 35–40% ispita. Cilj **2.3 Investigate Microsoft 365 activities to identify threats** ima tri stavke i sve su u ovom modulu:

- **Investigate threats by using Microsoft Purview Audit** – unified audit log, Audit (Standard) i Audit (Premium),
- **Investigate threats by using Content search in Microsoft Purview eDiscovery** – pronalazak (i po potrebi brisanje) sadržaja u mailboxovima, SharePointu, OneDriveu i Teamsu,
- **Investigate threats by using Microsoft Graph activity logs** – trag svih HTTP zahtjeva prema Microsoft Graph API-ju u tenantu.

Sva tri alata odgovaraju na različita pitanja istrage:

| Alat | Na koje pitanje odgovara | Gdje živi |
|---|---|---|
| **Purview Audit** | *Ko je šta uradio i kada?* (prijava u mailbox, pristup fajlu, promjena pravila, dijeljenje) | **Microsoft Purview portal** > **Audit** |
| **Content search (eDiscovery)** | *Gdje se nalazi ovaj sadržaj?* (phishing mail u kojim mailboxovima, dokument sa povjerljivim podacima) | **Microsoft Purview portal** > **eDiscovery** > **Cases** > **Content Search** |
| **Microsoft Graph activity logs** | *Koje API pozive je aplikacija ili korisnik slao prema Graphu?* | Entra **diagnostic settings** > Log Analytics (tabela `MicrosoftGraphActivityLogs`) |

Tipičan ispitni scenarij: kompromitovan nalog ili OAuth aplikacija. Audit pokazuje *aktivnosti*, Graph activity logs pokazuju *API pozive aplikacija*, a Content search pokazuje *sadržaj* (koji mailovi su stigli, gdje su završili) i omogućava da se sadržaj ukloni.

## Microsoft Purview Audit

**Unified audit log** bilježi hiljade korisničkih i administratorskih aktivnosti iz Exchange Online, SharePoint Online, OneDrive, Teams, Microsoft Entra ID, Power BI, Copilota i drugih servisa. Ista evidencija se čita iz portala, PowerShella i API-ja.

### Audit (Standard) vs Audit (Premium)

| Mogućnost | Audit (Standard) | Audit (Premium) |
|---|---|---|
| Uključen po defaultu | da | da |
| Audit search alat u Purview portalu | da | da |
| `Search-UnifiedAuditLog` cmdlet | da | da |
| **Audit Search Graph API** | da | da |
| Export rezultata u CSV | do **50.000** redova | do **1.000.000** redova |
| Office 365 Management Activity API | osnovni bandwidth | oko **dvostruko veći** bandwidth (limit po tenantu) |
| Podrazumijevana retencija | **180 dana** | **1 godina** za Entra ID, Exchange, OneDrive i SharePoint; ostalo 180 dana |
| **Audit log retention policies** | ne | da (po servisu, aktivnosti ili korisniku, do 1 godine) |
| Retencija **10 godina** | ne | da, uz **10-Year Audit Log Retention add-on** licencu po korisniku |
| **Intelligent insights** (npr. svojstva pristupa mailu, pretrage u Exchangeu i SharePointu) | ne | da |
| Licenca | većina Microsoft 365 / Office 365 enterprise planova | E5/A5/G5 ili Purview Suite / E5 eDiscovery and Audit add-on |

Napomene koje se pojavljuju u pitanjima:

- Standard retencija je **povećana sa 90 na 180 dana** za logove nastale od 17. oktobra 2023.
- 10-godišnja retencija **nije retroaktivna**: važi samo za zapise nastale nakon što je politika napravljena.
- Zapisi koje generišu ne-korisnički entiteti (service principal, sistemski događaji) zadržavaju se fiksno **godinu dana** i na njih se custom politike ne primjenjuju.
- Kod Audit (Premium) aktivnost `MailItemsAccessed` dobija svojstvo **`SensitivityLabel`** (oznaka osjetljivosti mailova kojima je pristupljeno). Premium licenca mora biti dodijeljena **korisniku** čije se aktivnosti bilježe.

> **Na ispitu:** „Istraga kompromitovanog mailboxa zahtijeva audit zapise stare 10 mjeseci i dokaz kojim mailovima je napadač pristupio.“ Treba **Audit (Premium)** (godinu dana za Exchange po defaultu) i zapisi `MailItemsAccessed`. Sa Audit (Standard) zapisi stariji od 180 dana više ne postoje i nijedna naknadna promjena licence ih ne vraća.

### Provjera da li je audit uključen

Audit je uključen po defaultu, ali administrator ga može isključiti. Provjera se radi u **Exchange Online PowerShellu**:

```powershell
Get-AdminAuditLogConfig | Format-List UnifiedAuditLogIngestionEnabled
# True = audit log search je uključen

Set-AdminAuditLogConfig -UnifiedAuditLogIngestionEnabled $true
```

Zamka: isti cmdlet postoji i u **Security & Compliance PowerShellu**, ali tamo `UnifiedAuditLogIngestionEnabled` uvijek pokazuje `False`, čak i kad je audit uključen.

### Uloge

| Šta | Potrebna uloga |
|---|---|
| Pretraga audit loga u Purview portalu | **Audit Logs** ili **View-Only Audit Logs** (Purview) |
| `Search-UnifiedAuditLog` u PowerShellu | **Audit Logs** ili **View-Only Audit Logs** u **Exchange admin centru** |

Pristup se može ograničiti **administrative units**: restricted admin vidi i izvozi samo logove korisnika iz svojih admin jedinica, a unrestricted admin vidi sve, uključujući ne-korisničke i sistemske naloge.

### Pretraga u portalu

Putanja: **purview.microsoft.com** > kartica **Audit** (ako je nema: **View all solutions** > **Core** > **Audit**) > **Search**.

| Polje | Napomena |
|---|---|
| **Date and time range (UTC)** | default zadnjih 7 dana, maksimalno **180 dana** po pretrazi |
| **Keyword Search** | traži samo u indeksiranom *common schema* dijelu zapisa |
| **Admin Units** | ograničava pretragu na admin jedinice |
| **Activities - friendly names** | grupe aktivnosti sa razumljivim imenima |
| **Activities - operations names** | tačna imena operacija, odvojena zarezom, npr. `MailItemsAccessed,New-InboxRule` |
| **Record types** | npr. `ExchangeItem`, `SharePointFileOperation`, `MIPLabel` |
| **Search name** | ime posla u istoriji pretraga |
| **Users** | prazno = svi korisnici i servisni nalozi |
| **File, folder, or site** | dio imena ili URL, wildcard `*` samo na kraju |
| **Workloads** | Exchange, SharePoint, Teams… |

Pretraga je **search job** koji radi u pozadini:

- radi i kad zatvoriš browser,
- korisnik može imati **do 10 poslova istovremeno**, od toga **jedan bez filtera**,
- završeni poslovi se čuvaju **30 dana**,
- u velikim tenantima široka pretraga može trajati **do 48 sati**,
- **Copy this search** kopira kriterije u novu pretragu, a **Export** izvozi rezultate u CSV.

Zapis se u audit logu pojavljuje sa kašnjenjem: za Exchange, SharePoint, OneDrive i Teams obično **60–90 minuta**, a za druge servise i duže. Microsoft ne garantuje tačno vrijeme.

> **Na ispitu:** „Prije pet minuta korisnik je podijelio fajl izvan organizacije, a pretraga u Audit ne vraća ništa. Šta je najvjerovatniji razlog?“ Kašnjenje upisa u audit log (60–90 minuta za glavne servise). Nije potrebno ništa uključivati ni mijenjati licencu.

### Programski pristup

| Metod | Kada |
|---|---|
| `Search-UnifiedAuditLog` (Exchange Online PowerShell) | ad hoc pretrage i skripte; isti backend kao portal |
| **Audit Search Graph API** | programska pretraga kroz Microsoft Graph |
| **Office 365 Management Activity API** | kontinuirano preuzimanje u SIEM ili dugoročno skladište |
| **Microsoft 365 connector** u Sentinelu | Exchange, SharePoint i Teams aktivnosti u tabeli `OfficeActivity` |

```powershell
Search-UnifiedAuditLog -StartDate (Get-Date).AddDays(-7) -EndDate (Get-Date) `
  -UserIds ana@contoso.com -Operations MailItemsAccessed,New-InboxRule -ResultSize 5000
```

### Šta tražiti kod kompromitovanog naloga

| Operacija | Zašto je bitna |
|---|---|
| `MailItemsAccessed` | kojim mailovima se pristupalo (obim curenja) |
| `New-InboxRule`, `Set-InboxRule`, `UpdateInboxRules` | pravila za prosljeđivanje ili skrivanje mailova (tipično za BEC) |
| `Set-Mailbox` sa `ForwardingSmtpAddress` | prosljeđivanje cijelog mailboxa vani |
| `Add-MailboxPermission` | delegiran pristup tuđem mailboxu |
| `FileDownloaded`, `FileAccessed` | masovno preuzimanje iz SharePointa/OneDrivea |
| `SharingSet`, `AnonymousLinkCreated` | dijeljenje izvan organizacije |
| `Consent to application.` (Entra) | korisnik dao saglasnost OAuth aplikaciji |
| `Add member to role.` (Entra) | eskalacija privilegija |

### Isti podaci u Sentinelu i Defenderu

Kad je uključen **Microsoft 365** konektor, Exchange, SharePoint i Teams zapisi idu u tabelu **`OfficeActivity`**. U Defender advanced huntingu slične aktivnosti su u **`CloudAppEvents`** (preko Defender for Cloud Apps konektora za Microsoft 365).

```kql
// Nova inbox pravila koja prosljeđuju ili brišu mailove (zadnjih 7 dana)
OfficeActivity
| where TimeGenerated > ago(7d)
| where OfficeWorkload == "Exchange"
| where Operation in ("New-InboxRule", "Set-InboxRule")
| where Parameters has_any ("ForwardTo", "RedirectTo", "DeleteMessage", "MoveToFolder")
| project TimeGenerated, UserId, ClientIP, Operation, Parameters
| sort by TimeGenerated desc
```

```kql
// Masovno preuzimanje fajlova po korisniku po satu
OfficeActivity
| where TimeGenerated > ago(1d)
| where OfficeWorkload in ("SharePoint", "OneDrive")
| where Operation == "FileDownloaded"
| summarize Downloads = count(), Files = dcount(OfficeObjectId) by UserId, ClientIP, bin(TimeGenerated, 1h)
| where Downloads > 200
```

```kql
// Isto pitanje u Defender advanced huntingu
CloudAppEvents
| where Timestamp > ago(1d)
| where Application == "Microsoft SharePoint Online"
| where ActionType == "FileDownloaded"
| summarize Downloads = count() by AccountDisplayName, IPAddress, bin(Timestamp, 1h)
| where Downloads > 200
```

> **Na ispitu:** pitanje „koju tabelu koristiti“ za Exchange/SharePoint aktivnosti: u Sentinelu je to `OfficeActivity`, u Defender advanced huntingu `CloudAppEvents`. `AuditLogs` je Entra ID audit (promjene u direktoriju), a `SigninLogs` su prijave – oba su pogrešni odgovori za „ko je preuzeo fajl iz SharePointa“.

## Content search u Purview eDiscovery

**Content search** pronalazi sadržaj *na mjestu gdje se nalazi* (in-place) u Microsoft 365 izvorima:

- Exchange Online mailboxovi,
- SharePoint sajtovi i OneDrive nalozi,
- Microsoft Teams i Microsoft 365 grupe,
- Viva Engage.

### Content Search u novom eDiscovery iskustvu

Klasični Content Search je ugašen i spojen u objedinjeno **eDiscovery** iskustvo u Purview portalu. Postojeće pretrage nalaze se u posebnom slučaju (case) koji se zove **Content Search**:

**purview.microsoft.com** > **eDiscovery** > **Cases** > **Content Search** > **Create a search**

| | Content Search case | Pravi eDiscovery case |
|---|---|---|
| Pretraga i statistika | da | da |
| Export rezultata | da | da |
| **Holds** (očuvanje sadržaja) | ne (od februara 2026) | da |
| **Review sets** | ne (od februara 2026) | da (Premium funkcije uz E5) |
| Ko vidi | administratori biraju članove Content Search slučaja | članovi slučaja |

Od februara 2026. Content Search je zamišljen kao jednostavan alat „pronađi i izvezi“. Ako istraga traži očuvanje dokaza (hold) ili analizu u review setu, pravi se pun eDiscovery case. Microsoft je najavio i da kontejneri sa izvezenim podacima pretrage ističu nakon **14 dana**, pa izvoz preuzmi odmah.

### Uloge

| Šta | Uloga ili role group |
|---|---|
| Kreiranje i pokretanje pretrage | **eDiscovery Manager** role group ili uloga **Compliance Search** |
| Pristup svim slučajevima | **eDiscovery Administrator** (član eDiscovery Manager grupe sa višim pravima) |
| Brisanje pronađenih mailova (purge) | uloga **Search And Purge** ili **Organization Management** u **Purview portalu** |

Podjela je namjerna: jedna osoba može tražiti, a druga brisati. **Organization Management** u *Exchange Online* nije isto što i istoimena grupa u *Purviewu* i ne daje pravo brisanja.

### Kreiranje pretrage

1. **Create a search**, unesi jedinstveno ime i opis, **Create**.
2. Na tabu **Query** dodaj **Data sources**: korisnike, grupe, sajtove ili **All people and groups** za cijeli tenant. Za korisnika možeš dodati i povezane izvore (manager, direct reports, grupe čiji je član, česti saradnici).
3. Napravi upit:
   - **Condition builder** – polja i uslovi bez pisanja sintakse,
   - **KeyQL** editor – lijepljenje složenih upita, sa provjerom grešaka,
   - **Draft a query with Copilot** (preview) – Security Copilot pretvara prirodni jezik u KeyQL.
4. **Run query** i izbor prikaza rezultata:
   - **Statistics** – procjena broja stavki po lokacijama, tipovima stavki, osjetljivim informacijama; **query keywords report** pokazuje koliko pogodaka daje svaki dio upita,
   - **Sample** – reprezentativan uzorak: **1, 10 ili 100** stavki po lokaciji, iz **10, 100, 1000 ili 10.000** lokacija.
5. Pregledaj rezultate, doradi upit (ili **Duplicate** pretragu da sačuvaš original) i izvezi.

### KeyQL pravila koja se testiraju

| Pravilo | Primjer |
|---|---|
| Operatori **AND, OR, NOT, NEAR** moraju biti VELIKIM slovima | `phishing AND invoice` |
| Razmak između izraza znači **OR** | `from:"Sara Davis" subject:reorganization` = jedno ILI drugo |
| `property:value` **bez razmaka** poslije dvotačke | `to:pilarp` (a `to: pilarp` je obična riječ) |
| Samo **prefiks** wildcard | `invoic*` radi, `*voice` i `in*ce` ne rade |
| Navodnici za više riječi | `subject:"Action required"` |
| Minus isključuje | `-from:"Sara Davis"` |
| Tip stavke | `kind:email`, `kind:im`, `kind:microsoftteams` |
| Datum | `received:2026-10-01..2026-10-03` |
| Sajt sa kosom crtom na kraju | `path:sites/HelloWorld/` |
| Pretraga je **case-insensitive** | `Apple` = `apple` |
| **Prazan upit vraća SVE** iz izabranih izvora | uvijek dodaj bar jedan uslov |

Vrijeme u pretragama je uvijek **UTC**.

```text
(received:2026-10-13..2026-10-14) AND (subject:"Action required") AND kind:email
(from:billing@contoso-invoices.com) AND (attachmentnames:*.html OR attachmentnames:*.htm)
```

> **Na ispitu:** „Upit `subject: invoice from:attacker@evil.com` vraća previše rezultata.“ Dvije greške: razmak poslije `subject:` pretvara uslov u običnu riječ, a razmak između izraza znači **OR**. Ispravno: `subject:invoice AND from:attacker@evil.com`.

### Search and purge: uklanjanje phishing maila

Kad Content search pronađe zlonamjeran mail u mailboxovima, može se obrisati. Postupak je za **incidente** (phishing, malware, curenje podataka), ne za čišćenje mailboxova.

1. Poveži se na **Security & Compliance PowerShell** (EXO modul 3.9.0+, `Connect-IPPSSession -EnableSearchOnlySession`).
2. Napravi i pokreni pretragu (portal ili PowerShell). Pretraga mora uključivati **samo mailboxove i public foldere**, ne sajtove.
3. Provjeri broj rezultata (`Get-ComplianceSearch`) i po mogućnosti napravi **export report** da vidiš tačno šta će biti obrisano.
4. Pokreni purge i prati status.

```powershell
Connect-IPPSSession -EnableSearchOnlySession

$s = New-ComplianceSearch -Name "Remove Phishing Message" -ExchangeLocation All `
  -ContentMatchQuery '(Received:10/13/2026..10/14/2026) AND (Subject:"Action required")'
Start-ComplianceSearch -Identity $s.Identity
Get-ComplianceSearch -Identity "Remove Phishing Message" | Format-List Status,Items

New-ComplianceSearchAction -SearchName "Remove Phishing Message" -Purge -PurgeType SoftDelete
Get-ComplianceSearchAction -Identity "Remove Phishing Message_Purge"
```

| | SoftDelete | HardDelete |
|---|---|---|
| Gdje završi poruka | **Recoverable Items\Deletions** | **Purges** folder |
| Korisnik može vratiti | da (do isteka deleted item retention) | ne |
| Trajno brisanje | nakon retencije | nakon retencije (single item recovery) i obrade Managed Folder Assistanta |

Ograničenja:

| Ograničenje | Vrijednost |
|---|---|
| Stavki po lokaciji u jednom purge-u (PowerShell, case bez Premium funkcija) | **10** |
| Stavki po lokaciji preko Microsoft Graph (case sa Premium funkcijama) | **100** |
| Maksimalno mailboxova u pretrazi za purge | **50.000** (inače koristiti search permissions filtere) |
| SharePoint i OneDrive | nije podržano |
| Teams poruke | ovaj cmdlet ih ne briše (poseban postupak za Teams) |
| Mailbox na holdu | poruka se uklanja iz prikaza, ali se čuva dok hold traje |
| Neindeksirane stavke | ne brišu se |

Ako organizacija ima **Defender for Office 365 Plan 2**, Microsoft preporučuje drugi put: **Threat Explorer** > **Take action** (soft/hard delete, move to junk, move to inbox) sa odobravanjem u **Action center**. To je brže, radi sa više poruka i ostaje u istoriji incidenta (modul 08).

> **Na ispitu:** „Analitičar ima eDiscovery Manager i pokušava `New-ComplianceSearchAction -Purge`, ali dobija grešku da parametar Purge ne postoji.“ Nedostaje uloga **Search And Purge** u Purview portalu. Dodavanje u Exchange Online Organization Management ne pomaže.

## Microsoft Graph activity logs

**Microsoft Graph activity logs** su audit trag **svih HTTP zahtjeva** koje Microsoft Graph primi i obradi za tenant: od line-of-business aplikacija, SDK-ova, skripti, AI klijenata (uključujući **Microsoft MCP Server for Enterprise**, čiji zahtjevi imaju `/enterprise` u `RequestUri`) i Microsoftovih aplikacija (Outlook, Teams, admin portali).

Audit log kaže *šta je promijenjeno*. Graph activity logs kažu *koji API poziv je poslan, ko ga je poslao, sa koje IP adrese, sa kojim tokenom i kakav je bio odgovor*, uključujući **čitanja** (npr. aplikacija koja izlistava sve korisnike ili čita mailove), koja se u audit logu često ne vide.

### Preduslovi i uključivanje

| Zahtjev | Vrijednost |
|---|---|
| Licenca | **Microsoft Entra ID P1 ili P2** |
| Najmanje privilegovana Entra uloga za diagnostic settings | **Security Administrator** |
| Odredište | **Log Analytics workspace**, **Storage account** (List Keys) ili **Event Hubs** |

Putanja: **Microsoft Entra admin center** > **Monitoring & health** > **Diagnostic settings** > **Add diagnostic setting** > kategorija **MicrosoftGraphActivityLogs** > **Send to Log Analytics workspace** (workspace na kojem radi Sentinel).

Ograničenja koja treba znati:

- **Ne može se filtrirati** u diagnostic settings. Za smanjenje troška koristi **workspace transformation** (DCR na tabeli) ili tabelu prebaci na jeftiniji plan (Basic / data lake tier).
- Događaji stižu obično za **30 minuta**, rijetko i do **2 sata**.
- Vide se samo zahtjevi prema **tvom** tenantu. Aktivnosti tvoje multitenant aplikacije u tuđem tenantu ne vidiš.
- Logovi se ne skupljaju retroaktivno: bilježe se tek od uključivanja.

> **Na ispitu:** „Sumnja se da je kompromitovana aplikacija preko Graph API-ja čitala mailove. Entra audit logs ne pokazuju ništa. Šta uključiti?“ Diagnostic setting sa kategorijom **MicrosoftGraphActivityLogs** prema Log Analytics workspaceu (traži Entra ID P1/P2). Audit logs bilježe promjene, a ne pojedinačne API pozive za čitanje.

### Tabela MicrosoftGraphActivityLogs

| Kolona | Značenje |
|---|---|
| `TimeGenerated` | vrijeme prijema zahtjeva |
| `RequestUri`, `RequestMethod` | koji endpoint i kojom metodom (GET, POST, PATCH, DELETE) |
| `ResponseStatusCode` | 200, 401/403 (nema prava), 429 (throttling) |
| `AppId`, `ServicePrincipalId` | aplikacija koja šalje zahtjev |
| `UserId` | korisnik (kod delegiranih poziva); prazno kod app-only |
| `IPAddress`, `UserAgent`, `Location` | odakle je zahtjev i koji region ga je obradio |
| `Scopes` / `Roles` | delegirane dozvole / aplikacijske dozvole iz tokena |
| `SignInActivityId` | veza sa zapisom prijave (`UniqueTokenIdentifier` u sign-in logovima) |
| `ClientAuthMethod` | 0 public client, 1 client secret, 2 certifikat |
| `RequestId`, `OperationId` | identifikator zahtjeva, batcha |
| `Wids` | tenant-wide uloge korisnika |

### KQL primjeri

```kql
// Entiteti sa najviše odbijenih zahtjeva prema /groups (401/403) – izviđanje bez prava
MicrosoftGraphActivityLogs
| where TimeGenerated >= ago(3d)
| where ResponseStatusCode in (401, 403)
| where RequestUri contains "/groups"
| summarize UniqueRequests = dcount(RequestId) by AppId, ServicePrincipalId, UserId
| sort by UniqueRequests desc
| take 20
```

```kql
// Koje resurse su čitali ili mijenjali rizični korisnici (Entra ID Protection)
MicrosoftGraphActivityLogs
| where TimeGenerated > ago(30d)
| join kind=inner (AADRiskyUsers | project Id, RiskState, RiskLevel) on $left.UserId == $right.Id
| extend Path = tostring(parse_url(RequestUri).Path)
| summarize Requests = dcount(RequestId) by UserId, RiskState, Path, RequestMethod, ResponseStatusCode
```

```kql
// Povezivanje API poziva sa prijavom (IP, uređaj, Conditional Access)
MicrosoftGraphActivityLogs
| where TimeGenerated > ago(7d)
| join kind=leftouter (
    union SigninLogs, AADNonInteractiveUserSignInLogs, AADServicePrincipalSignInLogs
    | where TimeGenerated > ago(7d)
  ) on $left.SignInActivityId == $right.UniqueTokenIdentifier
```

```kql
// Aplikacija koja masovno čita mailove (moguća eksfiltracija preko Graph API-ja)
MicrosoftGraphActivityLogs
| where TimeGenerated > ago(1d)
| where RequestMethod == "GET"
| where RequestUri has "/messages"
| summarize Calls = count(), Users = dcount(UserId), IPs = make_set(IPAddress, 10) by AppId, bin(TimeGenerated, 1h)
| where Calls > 1000
| sort by Calls desc
```

```kql
// Aplikacije koje dobijaju throttling (429) – neuobičajen volumen
MicrosoftGraphActivityLogs
| where TimeGenerated > ago(3d)
| where ResponseStatusCode == 429
| summarize Throttled = count() by AppId, RequestMethod
| sort by Throttled desc
```

### Tipičan tok istrage kompromitovane OAuth aplikacije

1. Alarm (npr. Defender for Cloud Apps ili Entra ID Protection) ukazuje na sumnjivu aplikaciju ili korisnika.
2. **Purview Audit** / `AuditLogs`: kada je data saglasnost (`Consent to application.`), dodat secret ili certifikat aplikaciji, dodijeljene uloge.
3. **Graph activity logs**: šta je aplikacija pozivala poslije toga (`/users`, `/me/messages`, `/drives`), sa koje IP adrese, sa kojim dozvolama (`Roles`, `Scopes`).
4. **Content search**: ako je aplikacija slala phishing iz kompromitovanog mailboxa, pronađi i ukloni te poruke kod primalaca.
5. Remedijacija: opozovi saglasnost i secrete, onemogući service principal, resetuj kredencijale korisnika, opozovi sesije.

> **Na ispitu:** pitanje sa redoslijedom ili izborom alata. Ključ: **ko je šta uradio** → Audit; **koji API poziv** → Graph activity logs; **gdje je sadržaj i ukloni ga** → Content search (ili Threat Explorer uz MDO P2).

## Poređenje: koji alat za koji zahtjev

| Zahtjev u scenariju | Alat |
|---|---|
| Pronaći sve mailboxove koji su primili mail sa određenim subjectom | **Content search** |
| Izvesti mailove jednog korisnika za pravni tim | **Content search** (export) ili eDiscovery case |
| Očuvati sadržaj korisnika dok traje istraga | **eDiscovery case sa hold**om (ne Content Search) |
| Utvrditi ko je napravio inbox pravilo za prosljeđivanje | **Purview Audit** |
| Dokazati kojim mailovima je napadač pristupio | **Purview Audit** (`MailItemsAccessed`) |
| Čuvati audit zapise 7 godina zbog regulative | **Audit (Premium)** + 10-year add-on + retention policy |
| Vidjeti koje Graph endpoint-e je aplikacija pozivala i sa koje IP adrese | **Graph activity logs** |
| Detekcija u Sentinelu na masovno čitanje preko API-ja | **Graph activity logs** u workspaceu + analytics rule |
| Kontinuirano slati audit podatke u SIEM | **Office 365 Management Activity API** / Microsoft 365 konektor |

## Rezime

- **Purview Audit**: uključen po defaultu (provjera `Get-AdminAuditLogConfig` u **Exchange Online** PowerShellu). Standard = **180 dana**, export 50.000 redova. Premium = **1 godina** za Entra/Exchange/OneDrive/SharePoint, retention politike, 10 godina uz add-on (nije retroaktivno), export do 1.000.000, veći API bandwidth, intelligent insights.
- Pretraga: **Purview portal > Audit > Search**, posao u pozadini, max **180 dana** po pretrazi, **10 poslova** istovremeno, poslovi se čuvaju **30 dana**. Uloge **Audit Logs** / **View-Only Audit Logs**. Kašnjenje upisa 60–90 min.
- U Sentinelu Exchange/SharePoint/Teams aktivnosti su u `OfficeActivity`, u advanced huntingu u `CloudAppEvents`.
- **Content search** je sada slučaj **Content Search** u objedinjenom eDiscoveryju: pretraga i export, bez holdova i review setova (za to pun case). KeyQL: operatori velikim slovima, razmak = OR, `property:value` bez razmaka, samo prefiks wildcard, prazan upit = sve.
- **Search and purge**: `New-ComplianceSearchAction -Purge -PurgeType SoftDelete|HardDelete`, uloga **Search And Purge** u Purviewu, 10 stavki po lokaciji (100 preko Grapha), max 50.000 mailboxova, samo Exchange. Sa MDO P2 koristi Threat Explorer.
- **Graph activity logs**: Entra ID P1/P2, diagnostic setting **MicrosoftGraphActivityLogs** (Security Administrator), tabela `MicrosoftGraphActivityLogs`, bez filtera u diagnostic settings, kašnjenje do 2 h; veza sa prijavama preko `SignInActivityId` = `UniqueTokenIdentifier`.
