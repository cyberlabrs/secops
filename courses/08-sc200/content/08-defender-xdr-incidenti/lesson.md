## Ciljevi ispita: 2.1

Cilj **2.1 Respond to alerts and incidents in Microsoft Defender XDR** je najširi cilj na ispitu. Pokriva svaki izvor alarma koji završava u Defender portalu:

- **Investigate and remediate threats by using Microsoft Defender for Office 365, including automatic attack disruption**,
- **Investigate and remediate threats or compromised entities identified by Microsoft Purview** (DLP i Insider Risk Management),
- **Investigate and remediate alerts and incidents identified by Microsoft Defender for Cloud workload protections**,
- **Investigate and remediate security risks identified by Microsoft Defender for Cloud Apps**,
- **Investigate and remediate compromised identities that are identified by Microsoft Entra ID** (ID Protection),
- **Investigate and remediate security alerts from Microsoft Defender for Identity**,
- **Investigate and remediate alerts and incidents identified by Microsoft Sentinel**,
- **Investigate incidents by using agentic AI, including embedded Microsoft Security Copilot**,
- **Investigate complex attacks, such as multi-stage, multi-domain, and lateral movement**,
- **Manage security incidents by using case management**.

Defender for Endpoint (cilj 2.2) je u modulu 07. Ovdje je zajednička nit: **jedan red incidenata** u Defender portalu, a svaki servis daje svoje alarme, entitete i akcije. Na ispitu se najčešće pita „koji servis ili koja akcija“ za dati scenarij.

## Incident u Defender portalu

**Investigation & response** > **Incidents & alerts** > **Incidents**. Defender XDR automatski korelira alarme iz svih izvora (Endpoint, Office 365, Identity, Cloud Apps, Defender for Cloud, Purview, Entra ID Protection, Sentinel analytics pravila) u **incident** – jedan napad, jedan radni predmet.

### Dijelovi stranice incidenta

| Tab / dio | Šta je tu |
|---|---|
| **Attack story** | priča alarma (What happened, Actions taken, Related events) i **incident graph** sa entitetima; reprodukcija napada kroz vrijeme, filteri po severity, statusu i **service source** |
| **Alerts** | svi alarmi incidenta hronološki, sa izvorom (service source) i razlogom povezivanja |
| **Assets** | **Devices**, **Users**, **Mailboxes**, **Apps**, **Cloud resources** |
| **Investigations** | automatske istrage (AIR) pokrenute alarmima |
| **Evidence and Response** | analizirani entiteti sa verdiktom (Malicious, Suspicious, Clean) i remediation statusom; odobravanje akcija |
| **Activities** | jedinstvena hronologija ručnih i automatskih akcija (komentari, promjene, automation rules, playbooks, agenti, attack disruption) |
| **Summary** / desni panel | kill chain kategorije, opseg, dodjela, klasifikacija, tagovi, prioritet |
| **Similar incidents** | incidenti sa sličnim alarmima i entitetima |

Na grafu, sa čvora entiteta biraš **Go hunt** (All Activity, Related Alerts, All User anomalies uz UEBA) – advanced hunting upit za taj entitet čiji se rezultati mogu **Link to incident**. Za incidente na Sentinel data lakeu postoji i **View blast radius** (modul 02 i cilj 3.1).

### Upravljanje incidentom

- **Assign**, **Status** (*Active*, *In progress*, *Resolved*), **Severity**, **Tags**, **Comments**.
- **Classification** pri zatvaranju: *True positive* (sa tipom prijetnje, npr. multi-staged attack, phishing), *Informational, expected activity* (benign positive), *False positive*.
- **Merge** i **unlink** alarma kad korelacija nije tačna; ručno **Link to incident** iz advanced huntinga.

> **Na ispitu:** razlikuj klasifikacije. Penetracioni test koji je SOC najavio je **Informational, expected activity** (benign positive) – alarm je tačan, ali aktivnost je očekivana. **False positive** je kad detekcija pogrešno vidi zlonamjernost u bezazlenoj aktivnosti. Za IRM alarme klasifikacija se sinhronizuje u Purview: True positive → *Confirmed*, ostalo → *Dismissed*.

## Defender for Office 365

### Alati za istragu

| Alat | Gdje | Za šta |
|---|---|---|
| **Explorer** (Threat Explorer, Plan 2) / **Real-time detections** (Plan 1) | **Email & collaboration** > **Explorer** | pretraga mailova po pošiljaocu, primaocu, URL-u, hashu, verdiktu; pogledi *All email*, *Malware*, *Phish*, *Campaigns* |
| **Email entity page** | iz Explorera, alarma ili incidenta | header, autentikacija (SPF, DKIM, DMARC), URL-ovi i prilozi, timeline isporuke, Security Copilot sažetak |
| **Submissions** | **Actions & submissions** > **Submissions** | korisničke i admin prijave (phish, spam, lažno pozitivni) |
| **Quarantine** | **Email & collaboration** > **Review** > **Quarantine** | pregled, release, brisanje karantinovanih poruka |
| **Tenant Allow/Block List** | **Email & collaboration** > **Policies & rules** | blokada pošiljalaca, domena, URL-ova, fajlova |
| **Automated investigation and response (AIR)** | alarmi i Action center | automatske istrage (npr. na korisničku prijavu phishinga) sa preporučenim akcijama |
| **Advanced hunting** | `EmailEvents`, `EmailUrlInfo`, `EmailAttachmentInfo`, `EmailPostDeliveryEvents`, `UrlClickEvents` | širi upiti i remedijacija iz rezultata |

### Remedijacija isporučenih mailova

Iz **Explorera** (ili advanced huntinga) izabereš mailove i **Take action**:

| Akcija | Efekat |
|---|---|
| **Move to junk folder** | premješta u Junk |
| **Move to deleted items** | premješta u Deleted Items |
| **Soft delete** | u Recoverable Items\Deletions; korisnik i admin mogu vratiti |
| **Hard delete** | trajno brisanje (admin može vratiti preko single item recovery dok traje retencija) |
| **Move to inbox** | vraćanje (npr. lažno pozitivni) |

- **Direct approval**: korisnik sa ulogom **Search and Purge** (URBAC: *Email & collaboration advanced actions (manage)*) izvršava odmah.
- **Two-step approval**: ko nema dozvolu, bira **Add to remediation**; drugi član tima odobrava u **Action center** > **Pending**.
- Sve remedijacije su u **Action center** > **History** (30 dana). Remedijacija generiše alarm „Administrative action submitted by an Administrator“.
- Ograničenja: do 50 istovremenih remedijacija po organizaciji; iz Explorera do 200.000 mailova po upitu; preporuka su serije do 50.000.
- Na on-premises, external, failed/dropped ili hard-deleted mailove akcija ne djeluje.

**Zero-hour auto purge (ZAP)** automatski uklanja već isporučene mailove kad se verdikt promijeni u malware, phish ili spam. Trag je u `EmailPostDeliveryEvents`.

```kql
// Ko je primio i ko je kliknuo na phishing URL iz kampanje
let phishUrl = "contoso-login.example";
EmailUrlInfo
| where Url has phishUrl
| join kind=inner (EmailEvents | where Timestamp > ago(7d)) on NetworkMessageId
| join kind=leftouter (UrlClickEvents | where Url has phishUrl) on NetworkMessageId
| project Timestamp, RecipientEmailAddress, Subject, DeliveryLocation, ClickedBy = AccountUpn, ActionType
```

### Attack disruption i Office 365

Automatic attack disruption (detalji u modulu 07) pokriva i napade koji kreću kroz email i identitet, kao što su **business email compromise (BEC)** i **adversary-in-the-middle (AiTM)** phishing: kompromitovan nalog se automatski onemogućava ili suspenduje, sesije se opozivaju, a incident dobija tag **Attack Disruption**. Analitičar nastavlja istragu (pravila prosljeđivanja u sandučetu, sumnjivi OAuth consent, poslati mailovi), čisti mailove kroz Explorer i tek onda vraća nalog.

Za korisničke prijave phishinga postoji i **Phishing Triage Agent** (Security Copilot agent): automatski klasifikuje prijavljene mailove kao stvarnu prijetnju ili lažnu uzbunu i objašnjava zaključak prirodnim jezikom. Preduslovi su URBAC za Defender for Office 365, uključeno *Monitor reported messages in Outlook* i alert politika *Email reported by user as malware or phish*.

> **Na ispitu:** „Phishing mail je isporučen u 300 sandučića prije nego što je URL proglašen zlonamjernim. Trebate ga ukloniti iz svih sandučića uz mogućnost vraćanja ako je pogrešno.“ – **Explorer** > filtriraj po URL-u > **Take action** > **Soft delete** (ili Move to deleted items). Hard delete nije reverzibilan za korisnika. Ako analitičar nema **Search and Purge** ulogu, njegova akcija ide na odobrenje u **Action center** > **Pending**.

## Microsoft Purview: DLP i Insider Risk Management

### DLP alarmi u Defender portalu

**Purview Data Loss Prevention** alarmi stižu u Defender portal kao alarmi i incidenti (service source **Data Loss Prevention**). Defender ih korelira sa ostalim signalima: npr. preuzimanje fajla, upload u lični OneDrive i eksterno dijeljenje postaju jedan incident.

- Filter u redu incidenata: **Service source: Data Loss Prevention**.
- Remedijacija na entitetima: korisnik, fajl, uređaj (npr. contain user, karantin fajla, izolacija uređaja), plus akcije u Purviewu.
- U Purview portalu (**Data loss prevention** > **Alerts**) su tabovi **Events** (pojedinačni događaji) i **Sensitive info types** (koji SIT i sa kojom pouzdanošću), status *Active / Investigating / Dismissed / Resolved*, i **Summarize with Copilot**.
- Licenca za istragu DLP incidenata u Defenderu: Microsoft 365 E5/A5, Office 365 E5/A5, E5 Compliance ili E5 Information Protection and Governance.

### Insider Risk Management alarmi

**Insider Risk Management (IRM)** alarmi su u Defender portalu ako je u Purview IRM **Data sharing** postavkama uključeno dijeljenje sa drugim sigurnosnim rješenjima (**Share user risk details with other security solutions**).

| Tema | Detalj |
|---|---|
| Uloge | Defender: Security Operator ili Security Reader; plus IRM role group (*Insider Risk Management*, *Analysts* ili *Investigators*) |
| Prikaz | alarmi grupisani u incidente po korisniku, filter **Service source: Microsoft Purview Insider Risk Management**, insider risk level na stranici korisnika |
| Sinhronizacija | status, severity i klasifikacija se sinhronizuju sa Purviewom u roku od ~30 minuta |
| Advanced hunting | `AlertInfo`, `AlertEvidence`, **`DataSecurityBehaviors`**, **`DataSecurityEvents`** (traže ulogu IRM Analyst ili Investigator) |
| Sentinel | preporuka je konektor *Microsoft Purview Insider Risk Management*; IRM incidenti u Defenderu nemaju sadržaj alarma, što može srušiti automatizaciju |

```kql
// Upload osjetljivih fajlova u lične cloud servise (Purview događaji)
DataSecurityEvents
| where Timestamp > ago(7d)
| where ActionType has "Upload"
| summarize Files = count() by AccountUpn, ActionType
| order by Files desc
```

> **Na ispitu:** „SOC analitičari ne vide insider risk alarme u Defender portalu, iako IRM politike rade u Purviewu.“ – u Purview IRM postavkama uključiti **data sharing** sa drugim sigurnosnim rješenjima, i dodijeliti analitičarima IRM role group. Ako pitanje traži tabelu sa obogaćenim događajima koji krše Purview politike, odgovor je **DataSecurityEvents**.

## Defender for Cloud (workload protections)

Svi alarmi **Defender for Cloud** planova (Servers, Storage, SQL, Containers, Key Vault, Resource Manager, App Service, AI…) dolaze u Defender XDR red alarma i incidenata, uključujući AWS i GCP resurse. Informational alarmi se ne prenose.

- Na incidentu: tab **Assets** > **Cloud resources**, a VM ima svoju stranicu entiteta. **Open cloud resource page** vodi u Defender for Cloud.
- Status alarma Defender for Cloud se **sinhronizuje** u oba smjera. Izuzetak: Defender for Endpoint alarm na cloud resursu nema sinhronizaciju statusa između dva portala.
- Remedijacija: mitigacioni koraci iz alarma, **Take action** u Defender for Cloud (npr. preporuke za hardening, **workflow automation** sa Logic Apps), a za VM sa MDE agentom i sve akcije iz modula 07 (isolate, live response).
- Advanced hunting: `CloudAuditEvents` (ARM i Kubernetes control plane), `CloudProcessEvents`, `CloudStorageAggregatedEvents`.
- Vidljivost: bez Defender XDR Unified RBAC uloge za Defender for Cloud alarme vide samo Global Administrator i Security Administrator; filter **alert subscription ID** sužava na pretplatu.

Za Sentinel korisnike: koristi **Tenant-based Microsoft Defender for Cloud** konektor, isključi stari **Subscription-based (Legacy)** konektor i analytics pravila koja prave incidente iz Defender for Cloud alarma, inače nastaju duplikati.

> **Na ispitu:** „Nakon povezivanja Sentinela sa Defender XDR-om, Defender for Cloud alarmi se pojavljuju dvaput.“ – isključiti subscription-based (legacy) Defender for Cloud konektor i Microsoft security incident creation pravila za Defender for Cloud, a koristiti tenant-based konektor. Incidenti dolaze kroz Defender XDR integraciju.

## Defender for Cloud Apps

**Defender for Cloud Apps** daje alarme o rizičnom ponašanju u SaaS aplikacijama (impossible travel, masovno preuzimanje, sumnjiva pravila sandučeta, ransomware aktivnost u cloudu) i o rizičnim **OAuth aplikacijama**.

| Šta | Gdje u Defender portalu |
|---|---|
| Aktivnosti korisnika i aplikacija | **Cloud apps** > **Activity log** (tabela `CloudAppEvents` u huntingu) |
| Politike | **Cloud apps** > **Policies** (activity, anomaly detection, file, session, OAuth app) |
| OAuth aplikacije | **Cloud apps** > **OAuth apps** ili **App governance** (ako je uključen) |
| Otkrivene aplikacije | **Cloud apps** > **Cloud discovery** (shadow IT) |

**Governance akcije** na korisniku: **Suspend user**, **Require user to sign in again** (opoziv sesija), **Confirm user compromised** (postavlja visok rizik u Entra ID Protection, pa reaguju risk-based politike). Na OAuth aplikaciji: **Revoke app** ili **Ban app**; automatski kroz OAuth app politiku. Na fajlovima: karantin, uklanjanje dijeljenja.

Istraga sumnjive OAuth aplikacije: filtriraj na **high permission level** i **community use: not common**, pogledaj **Related activities** i **Consent activities**, broj korisnika koji su dali consent, izdavača i da li dozvole odgovaraju namjeni.

```kql
// Masovno preuzimanje iz SharePointa/OneDrivea po korisniku (zadnjih 24h)
CloudAppEvents
| where Timestamp > ago(1d)
| where ActionType == "FileDownloaded"
| summarize Downloads = count(), Files = dcount(ObjectName) by AccountDisplayName, IPAddress
| where Downloads > 500
| order by Downloads desc
```

> **Na ispitu:** „OAuth aplikacija sa dozvolom *Full access to all mailboxes* je dobila consent od tri korisnika i šalje mailove u njihovo ime. Trebate odmah ukloniti pristup za sve korisnike i spriječiti ponovni consent.“ – u **OAuth apps** (ili App governance) **Ban app**. Reset lozinke korisnika ne opoziva OAuth grant.

## Microsoft Entra ID Protection

**Entra ID Protection** računa **sign-in risk** (rizik pojedinačne prijave) i **user risk** (vjerovatnoća da je nalog kompromitovan). Alarmi i risky users su vidljivi i u Defender portalu (stranica korisnika, incidenti). Puna funkcionalnost traži **Entra ID P2** (ili Entra Suite).

| Akcija administratora | Efekat na rizik | Najmanja uloga |
|---|---|---|
| **Reset password** (privremena lozinka) | *Remediated* | User Administrator (+ Security Operator za pristup ID Protectionu) |
| Zahtijevati **secure password change** | *Remediated* | – (korisnik mijenja uz MFA) |
| **Dismiss user risk** / **Dismiss risky sign-in** | *Dismissed* (lozinka se ne mijenja) | Security Operator |
| **Confirm user compromised** | *Confirmed compromised* (rizik postaje visok) | Security Operator / Security Administrator |
| **Confirm sign-in safe** | smanjuje rizik i trenira model | Security Operator |
| **Block user**, **Revoke sessions** (refresh tokeni) | sprječava pristup | User Administrator i srodne |

Samoremedijacija: risk-based **Conditional Access** politike traže **MFA** za sign-in risk i **secure password change** (MFA + promjena lozinke, ne SSPR) za user risk. Za hibridne korisnike postoji opcija **Allow on-premises password change to reset user risk** (traži password hash sync). Detekcije vezane za krađu tokena (npr. *Anomalous token*, *Attacker in the Middle*) više se ne remedijuju automatski samo MFA-om.

```kql
// Rizične prijave i njihovo stanje (Sentinel workspace)
AADUserRiskEvents
| where TimeGenerated > ago(7d)
| summarize Detections = make_set(RiskEventType), MaxLevel = max(RiskLevel) by UserPrincipalName, RiskState
| order by UserPrincipalName asc
```

> **Na ispitu:** „Istraga je potvrdila da je nalog kompromitovan. Šta trebate uraditi u Entra ID Protection da bi risk-based politike tretirale nalog kao visokorizičan i da bi se model učio?“ – **Confirm user compromised**, pa reset lozinke i **revoke sessions**. **Dismiss user risk** je za situaciju kada je istraga pokazala da nalog NIJE kompromitovan, i ne mijenja lozinku.

## Defender for Identity

**Defender for Identity (MDI)** senzori na domain controllerima (i AD FS, AD CS, Entra Connect serverima) prate on-premises AD. Alarmi su grupisani po fazama napada: **reconnaissance** (LDAP, SAMR, DNS enumeracija), **credential access** (brute force, Kerberoasting, AS-REP roasting), **lateral movement** (pass-the-hash, pass-the-ticket, remote code execution), **domain dominance** (DCSync, Golden Ticket, skeleton key, sumnjive promjene u osjetljivim grupama).

- Stranica identiteta: **Assets** > **Identities** – alarmi, uređaji, timeline aktivnosti, **lateral movement paths** (putevi kojim napadač sa kompromitovanog naloga može doći do osjetljivih naloga).
- Hunting: `IdentityLogonEvents`, `IdentityQueryEvents`, `IdentityDirectoryEvents`, `IdentityInfo`.

**Remedijacione akcije** (iz stranice identiteta, advanced huntinga ili Action centera; traže URBAC **Response (manage)**):

| Akcija | Izvori identiteta |
|---|---|
| **Disable** / **Enable** | Active Directory, Entra ID, Okta, CyberArk, SailPoint, neke SaaS aplikacije |
| **Revoke session** | Entra ID, Okta |
| **Mark as compromised** | Entra ID |
| **Force password change** | Active Directory, Entra ID |

U AD-u akciju izvršava MDI senzor na **domain controlleru** pod **LocalSystem** nalogom DC-a (postavka **Manage action accounts** > *Automatically use the sensor's local system account*, obavezna za senzor v3.x). U Entra ID-u akciju izvršava Microsoftova enterprise aplikacija *Microsoft Defender for Identity*.

```kql
// Ko je dodat u osjetljive AD grupe u zadnjih 7 dana
IdentityDirectoryEvents
| where Timestamp > ago(7d)
| where ActionType == "Group Membership changed"
| extend Group = tostring(AdditionalFields["TO.GROUP"])
| where Group in~ ("Domain Admins", "Enterprise Admins", "Administrators")
| project Timestamp, Group, TargetAccountUpn, AccountName, DeviceName
```

## Sentinel incidenti u Defender portalu

Kad je Sentinel workspace povezan sa Defender portalom, alarmi iz **Sentinel analytics pravila** ulaze u isti korelacioni engine kao XDR alarmi i pojavljuju se u **jedinstvenom redu incidenata** (service source **Microsoft Sentinel**).

- Sentinel alarmi se mogu spojiti sa Defender alarmima u jedan incident (npr. firewall alarm iz Sentinela + MDE alarm na istom uređaju).
- **Microsoft incident creation rules** u Sentinelu se isključuju pri onboardingu, jer Defender XDR sam pravi incidente iz Microsoftovih servisa.
- Promjene (status, dodjela, komentari) se sinhronizuju između Defender portala i Sentinel workspacea; Sentinel **automation rules** i playbooks rade nad incidentima (modul 06).
- Sentinel-specifično: **tasks** u incidentu, **entity pages** sa UEBA podacima, **Run query** iz alarma koji je napravilo analytics pravilo, bookmarks iz huntinga (modul 10).
- Remedijacija za izvore van Microsofta ide kroz **playbooks** (npr. blokada IP-a na firewallu) ili attack disruption konektore (Okta, AWS).

> **Na ispitu:** „Sentinel workspace je povezan sa Defender portalom. Analitičar želi da alarm iz Sentinel scheduled pravila za Palo Alto firewall bude u istom incidentu kao MDE alarm za isti uređaj.“ – to radi **Defender XDR korelacija automatski**; ne treba posebno pravilo. Ako pitanje traži gdje se prave incidenti iz Microsoftovih servisa, odgovor je Defender XDR (incident creation pravila u Sentinelu se gase).

## Security Copilot i agentic AI

**Security Copilot** je ugrađen u Defender portal za korisnike kojima je dodijeljen pristup (Security Compute Units, SCU). Ugrađene sposobnosti:

| Sposobnost | Gdje se pojavljuje | Šta daje |
|---|---|---|
| **Incident summary** | Copilot panel / tab na stranici incidenta (automatski) | pregled napada: šta se desilo, imovina, hronologija |
| **Guided response** | stranica incidenta | preporučene akcije (triage, containment, remedijacija) specifične za incident |
| **Script analysis** | attack story, za PowerShell i komandne linije | objašnjenje (deobfuskacija) skripte |
| **File analysis** | stranica fajla | detekcije, certifikati, API pozivi, stringovi |
| **Device summary**, **Identity summary** | stranica uređaja / korisnika | postura, neobično ponašanje, uloge i prijave |
| **Email summary** | email entity page | sažetak poruke, URL-ova i priloga |
| **Incident report** | stranica incidenta | izvještaj sa akcijama, ko je šta radio i kada |
| **Query assistant** | advanced hunting | prirodni jezik → KQL |
| **Defender Chat** (preview) | dugme **Copilot** u gornjoj traci | chat svjestan stranice na kojoj si, planovi koje odobravaš prije izvršenja |

**Agenti** (agentic AI) rade samostalno nad radnim tokom: **Phishing Triage Agent** klasifikuje korisničke prijave phishinga, a isti agent (Security Alert Triage Agent) se širi na identitetske i cloud alarme. Incident cases mogu pokretati **agentic playbooks** i prikazati status i izlaz agentske sesije. Agenti ne klasifikuju alarme koje si potisnuo suppression pravilima.

> **Na ispitu:** „Analitičar nailazi na obfuskiranu PowerShell komandu u alarmu i treba brzo razumjeti šta radi.“ – **script analysis** u Security Copilotu (iz attack storyja). Za „sažetak incidenta sa 40 alarma“ je **incident summary**, za „koje akcije da preduzmem“ **guided response**, a za „napiši KQL iz rečenice“ **query assistant** u advanced huntingu.

## Složeni napadi: multi-stage, multi-domain, lateral movement

Napad rijetko ostaje u jednom servisu. Tipičan lanac i gdje ga vidiš:

| Faza | Signal | Servis |
|---|---|---|
| Inicijalni pristup | AiTM phishing mail, klik na URL | Defender for Office 365 (`EmailEvents`, `UrlClickEvents`) |
| Krađa sesije | anomalous token, prijava sa neobične lokacije | Entra ID Protection (`AADUserRiskEvents`, `SigninLogs`) |
| Perzistencija u cloudu | pravilo prosljeđivanja, OAuth consent | Defender for Cloud Apps (`CloudAppEvents`) |
| Izvršavanje na uređaju | makro pokreće PowerShell | Defender for Endpoint (`DeviceProcessEvents`) |
| Lateralno kretanje | pass-the-hash, RDP, SMB ka serverima | Defender for Identity + MDE (`IdentityLogonEvents`, `DeviceLogonEvents`) |
| Eksfiltracija | upload osjetljivih fajlova | Purview DLP/IRM (`DataSecurityEvents`), MDCA |

Kako istražiti:

1. Na **attack story** grafu pusti reprodukciju kroz vrijeme i filtriraj po **service source** da vidiš koji servis je vidio koju fazu.
2. Pronađi **pivot entitet** (korisnik ili uređaj) zajednički za više alarma; otvori njegovu stranicu i **Go hunt** > *All Activity*.
3. Za lateralno kretanje: **lateral movement paths** na stranici identiteta (MDI), `DeviceLogonEvents` sa `LogonType` *RemoteInteractive*/*Network*, i **blast radius** sa čvora.
4. Rezultate iz huntinga **Link to incident**, nepovezane alarme spoji **merge**.
5. Containment po domenima: nalog (disable, revoke), uređaji (isolate/contain), email (soft delete), aplikacija (ban app), cloud resurs (Defender for Cloud preporuke).

```kql
// Lateralno kretanje: isti nalog se mrežno prijavljuje na mnogo uređaja za kratko vrijeme
DeviceLogonEvents
| where Timestamp > ago(1d)
| where LogonType in ("Network", "RemoteInteractive") and ActionType == "LogonSuccess"
| summarize Devices = dcount(DeviceName), DeviceList = make_set(DeviceName, 20) by AccountName, bin(Timestamp, 1h)
| where Devices >= 10
| order by Devices desc
```

## Case management

**Case management** u Defender portalu (stranica **Cases**) je radni predmet SOC-a koji objedinjuje kontekst, saradnju, zadatke, dokaze i istoriju. Dostupan je **samo u Defender portalu**, ne u Sentinelu u Azure portalu.

| Tip | Opis |
|---|---|
| **Incident cases** (preview) | nastaju iz koreliranog incidenta; preporučeno iskustvo za upravljanje incidentima (legacy incident stranica ostaje tokom previewa); uključuju attack story, alarme, imovinu, evidence, aktivnosti i agentske sesije |
| **Generic cases** | ručno kreirani predmeti za SecOps rad van incident toka (npr. revizija pravila, istraga više incidenata, zahtjev menadžmenta) |

Mogućnosti: status, prioritet, assignee, tagovi, opis, **SLA policy**; **tasks** sa vlasnikom, rokom i closing note; komentari i **activity history**; **attachments**; povezani objekti; **case templates** sa custom poljima i SLA politikama; audit u Log Analytics tabeli **`SecurityCaseEvent`**.

| Generic case dozvola | Defender URBAC | Sentinel uloga |
|---|---|---|
| Pregled | Security operations > **Security data basics (read)** | Microsoft Sentinel **Reader** |
| Kreiranje i upravljanje, dodjela | Security operations > **Alerts (manage)** | Microsoft Sentinel **Responder** |
| Templates, custom polja, SLA | Authorization and settings > **Core security settings (manage)** | Microsoft Sentinel **Contributor** |

Incident cases koriste iste dozvole kao incidenti (**Security Data Read** / **Security Data Manage**).

> **Na ispitu:** „Menadžer traži da se istraga tri povezana incidenta vodi kao jedan predmet sa zadacima za tri analitičara, rokovima i SLA-om, u Defender portalu.“ – **case** (generic case sa tasks i SLA politikom iz case templatea). Analitičar koji treba samo da kreira i dodjeljuje case-ove treba **Microsoft Sentinel Responder** (ili URBAC *Alerts (manage)*), a ne Contributor.

## Rezime

- Defender portal ima **jedan red incidenata**: Endpoint, Office 365, Identity, Cloud Apps, Defender for Cloud, Purview DLP/IRM, Entra ID Protection i Sentinel alarmi se koreliraju automatski; filter **service source** razdvaja izvore.
- Incident: attack story i graf, Alerts, Assets, Investigations, **Evidence and Response**, **Activities**; **Go hunt** i **Link to incident**; klasifikacija True positive / Informational expected activity / False positive.
- **MDO**: Explorer > Take action (soft/hard delete, move), **Search and Purge** uloga ili dvostepeno odobrenje u Action centeru, ZAP, AIR, Phishing Triage Agent; attack disruption pokriva BEC i AiTM.
- **Purview**: DLP alarmi kao incidenti (Service source DLP); IRM traži **data sharing** i IRM role group; tabele `DataSecurityEvents` i `DataSecurityBehaviors`.
- **Defender for Cloud**: svi alarmi osim informational, Cloud resources tab, dvosmjerna sinhronizacija statusa, tenant-based konektor u Sentinelu da nema duplikata.
- **MDCA**: Activity log, politike, OAuth apps / App governance; Suspend user, Require sign in again, Confirm user compromised, **Ban/Revoke app**.
- **Entra ID Protection** (P2): Confirm compromised vs Dismiss risk; reset lozinke i revoke sessions; risk-based CA za samoremedijaciju.
- **MDI**: faze (recon, credential access, lateral movement, domain dominance), lateral movement paths; akcije Disable, Force password change, Revoke session, Mark as compromised; DC LocalSystem nalog.
- **Security Copilot**: incident summary, guided response, script/file analysis, device/identity summary, incident report, query assistant, Defender Chat; agenti (Phishing Triage).
- **Case management**: incident cases (preview) i generic cases, tasks, SLA, templates, `SecurityCaseEvent`, samo u Defender portalu.
