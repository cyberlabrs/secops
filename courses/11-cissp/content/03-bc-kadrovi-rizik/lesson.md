## Ciljevi ispita: 1.7, 1.8 i 1.9

- **1.7 Identify, analyze, assess, prioritize, and implement Business Continuity (BC) requirements**
  - Business Impact Analysis (BIA)
  - External dependencies
- **1.8 Contribute to and enforce personnel security policies and procedures**
  - Candidate screening and hiring
  - Employment agreements and policy driven requirements
  - Onboarding, transfers, and termination processes
  - Vendor, consultant, contractor agreements and controls (e.g., Service-Level Agreements (SLA))
- **1.9 Understand and apply risk management concepts**
  - Threat and vulnerability identification
  - Risk analysis, assessment, and scope
  - Risk response and treatment (e.g., cybersecurity insurance, risk mitigation strategies)
  - Applicable types of controls (e.g., preventive, detection, corrective)
  - Control assessments (e.g., security and privacy)
  - Continuous monitoring and measurement
  - Reporting (e.g., internal, external)
  - Continuous improvement (e.g., maturity modeling)
  - Risk frameworks (ISO, NIST, COBIT, SABSA, PCI, HIPAA)

U outlineu iz 2024. pod-tačka o dobavljačima nije pominjala SLA, tretman rizika je kao primjer navodio samo cyber osiguranje (bez „risk mitigation strategies“), kontinuirano poboljšanje je glasilo „risk maturity modeling“, a lista okvira rizika nije sadržavala HIPAA.

Ovo je srce CISSP-a: skoro svako pitanje u drugim domenima se svodi na „koji rizik, za koju imovinu, koliko košta, šta je razumna kontrola“.

> **Na ispitu:** procjena rizika uvijek počinje od **imovine i njene vrijednosti** za posao. Kontrola ne smije koštati više od vrijednosti imovine ili smanjenja godišnjeg gubitka koje donosi. A kada je u pitanju ljudski život, ova računica se ne primjenjuje: bezbjednost ljudi ima apsolutni prioritet.

## Kontinuitet poslovanja (1.7)

**Business Continuity Planning (BCP)** osigurava da kritične poslovne funkcije nastave da rade tokom i nakon poremećaja. **Disaster Recovery Planning (DRP)** je uži, tehnički dio: obnova IT sistema i lokacija (detaljno u modulu 14). Cilj 1.7 se fokusira na **zahtjeve**: identifikovati, analizirati, procijeniti, prioritizovati i sprovesti.

### Faze BCP-a (NIST SP 800-34 i klasični ISC2 pristup)

| Faza | Sadržaj |
|---|---|
| 1. **Project scope and planning** | Analiza organizacije, izbor BCP tima (predstavnici poslovnih jedinica, IT, pravna služba, HR, sigurnost, PR), resursi, pravni i regulatorni zahtjevi, **podrška uprave** (sponzor) |
| 2. **Business Impact Analysis (BIA)** | Identifikacija kritičnih funkcija, uticaja prekida i vremenskih ciljeva |
| 3. **Continuity planning** | Strategije (preventivne i oporavka), razvoj planova, obezbjeđivanje resursa |
| 4. **Approval and implementation** | Odobrenje uprave, obuka, testiranje, održavanje |

Standardi: **ISO 22301** (BCMS, sistem upravljanja kontinuitetom, certifikabilan), **ISO 22313** (smjernice), **NIST SP 800-34** (contingency planning za IT sisteme), **BCI Good Practice Guidelines**.

### Business Impact Analysis

BIA odgovara na pitanje: **šta se dešava poslu ako ova funkcija stane, i koliko dugo možemo to izdržati?** BIA ne analizira prijetnje (to radi procjena rizika), nego **uticaj** gubitka funkcije.

| Korak BIA | Šta se radi |
|---|---|
| Identifikacija poslovnih funkcija i procesa | Intervjui, upitnici sa vlasnicima procesa |
| Određivanje kritičnosti | Koje funkcije su ključne za misiju, zakon, prihod, bezbjednost |
| Procjena uticaja kroz vrijeme | Finansijski (izgubljeni prihod, kazne), operativni, reputacioni, pravni, uticaj na bezbjednost ljudi |
| Određivanje vremenskih metrika | MTD, RTO, RPO, WRT |
| Identifikacija resursa i zavisnosti | Ljudi, sistemi, podaci, lokacije, dobavljači |
| Prioritizacija oporavka | Redoslijed obnove po kritičnosti |

### Vremenske metrike

| Metrika | Definicija | Ko određuje |
|---|---|---|
| **MTD** (Maximum Tolerable Downtime), takođe **MAD** (Maximum Allowable Downtime) ili **MTPD** (Maximum Tolerable Period of Disruption) | Najduži prekid nakon kojeg je šteta neprihvatljiva ili organizacija ne može opstati | Poslovanje (vlasnik procesa, uprava) |
| **RTO** (Recovery Time Objective) | Ciljno vrijeme za obnovu sistema / funkcije nakon prekida | Poslovanje uz IT, mora biti kraći od MTD |
| **WRT** (Work Recovery Time) | Vrijeme nakon tehničke obnove potrebno za provjeru podataka, testiranje i povratak u rad | IT i poslovanje |
| **RPO** (Recovery Point Objective) | Najveća prihvatljiva količina izgubljenih podataka, izražena u vremenu (npr. 15 minuta) | Vlasnik podataka; određuje učestalost backupa i replikacije |
| **MTBF / MTTR** | Srednje vrijeme između kvarova / srednje vrijeme popravke | Pouzdanost komponenti |

Ključna relacija: **RTO + WRT ≤ MTD**.

#### Primjer

Online plaćanje: uprava kaže da nakon 8 sati prekida klijenti masovno prelaze konkurenciji i regulator izriče kaznu, pa je **MTD = 8 h**. Provjera i usklađivanje transakcija nakon obnove traje 2 h (**WRT = 2 h**), pa **RTO mora biti najviše 6 h**. Gubitak više od 5 minuta transakcija je neprihvatljiv, pa je **RPO = 5 min**, što traži sinhronu ili skoro sinhronu replikaciju, a ne noćni backup.

| Funkcija | MTD | RTO | RPO | Prioritet oporavka |
|---|---|---|---|---|
| Online plaćanja | 8 h | 6 h | 5 min | 1 |
| Kartično poslovanje (POS) | 4 h | 3 h | 0 (bez gubitka) | 1 |
| CRM | 3 dana | 2 dana | 24 h | 2 |
| Interni wiki | 2 sedmice | 1 sedmica | 1 sedmica | 3 |

> **Na ispitu:** MTD i RPO određuje **poslovanje**, ne IT. Ako je RTO duži od MTD-a, strategija oporavka je neadekvatna. Manji RPO i RTO znače skuplje rješenje (hot site, sinhrona replikacija), pa BIA opravdava trošak.

### Kvantitativni i kvalitativni uticaj u BIA

| Tip uticaja | Primjeri | Mjerenje |
|---|---|---|
| Kvantitativni | Izgubljen prihod po satu, ugovorne kazne, regulatorne kazne, prekovremeni rad | Novac |
| Kvalitativni | Reputacija, povjerenje klijenata, moral zaposlenih, uticaj na zajednicu | Skala (nizak/srednji/visok) |

### Spoljne zavisnosti

Organizacija zavisi od subjekata koje ne kontroliše. BIA mora mapirati i **external dependencies**:

| Zavisnost | Primjer | Kako se ublažava |
|---|---|---|
| Komunalne usluge | Struja, voda, klimatizacija | UPS, generatori, ugovori o isporuci goriva, druga lokacija |
| Telekomunikacije | ISP, mobilni operater | Dva ISP-a sa različitim fizičkim trasama (route diversity) |
| Cloud i SaaS provajderi | IdP, e-mail, IaaS region | Multi-region, izlazna strategija, provjera BC planova provajdera, SLA |
| Ključni dobavljači | Proizvođač čipova, logistika | Više dobavljača, zalihe, ugovorne obaveze kontinuiteta |
| Javne službe | Hitne službe, platni sistem centralne banke | Koordinacija, alternativne procedure |
| Ljudi | Ključno osoblje (single point of failure) | Zamjenici, rotacija, dokumentacija |

Zavisnosti se dijele na **upstream** (od kojih mi zavisimo) i **downstream** (koji zavise od nas). Kaskadni otkazi (npr. otkaz provajdera identiteta onemogućava sve SaaS aplikacije) se otkrivaju samo mapiranjem.

### Strategije i odobrenje

Nakon BIA slijede **strategije kontinuiteta**: preventivne mjere (redundansa, otpornost), strategije oporavka (alternativna lokacija, ručne procedure, rad od kuće) i **prioritizacija resursa** po rezultatima BIA. Plan odobrava viša uprava; plan mora imati vlasnika, kontakt liste, kriterijume aktivacije i redovno testiranje (tabletop, simulacija, paralelni test, potpuni prekid: modul 14).

### Scenarij

Regionalna banka zavisi od jednog SaaS provajdera za core banking. BIA pokazuje MTD od 4 h za plaćanja. SLA provajdera garantuje 99,5% dostupnosti mjesečno (do oko 3,6 h prekida mjesečno), bez obaveze o RTO. CISSP preporučuje: pregovarati SLA sa RTO/RPO, pravo na pregled BC plana provajdera i rezultata testova, ručnu proceduru za kritična plaćanja i izlaznu strategiju.

## Sigurnost kadrova (1.8)

Ljudi su i najveća vrijednost i najveći rizik. Kontrole se primjenjuju kroz cijeli **životni ciklus zaposlenja**.

### Provjera kandidata i zapošljavanje

| Korak | Sadržaj |
|---|---|
| **Opis posla** (job description) | Uloge, odgovornosti, nivo pristupa, **klasifikacija osjetljivosti pozicije** |
| **Provjera kandidata** (screening) | Provjera identiteta, obrazovanja i certifikata, prethodnih poslodavaca, reference, kaznena evidencija, kreditna istorija (za finansijske pozicije), provjera na društvenim mrežama, testiranje na droge; dubina zavisi od osjetljivosti pozicije |
| **Security clearance** | Za državne i vojne pozicije: bezbjednosna provjera nadležnog organa |
| **Zakonitost** | Provjere moraju biti u skladu sa radnim pravom i zakonom o privatnosti, uz saglasnost kandidata gdje je potrebna; diskriminacija je zabranjena |

### Ugovori i zahtjevi iz politika

| Dokument | Svrha |
|---|---|
| **Employment agreement** | Uslovi rada, obaveze povjerljivosti, IP (work for hire), zabrana konkurencije gdje je zakonita |
| **NDA** (Non-Disclosure Agreement) | Zaštita povjerljivih informacija i poslovnih tajni, i nakon prestanka rada |
| **NCA** (Non-Compete Agreement) | Ograničenje rada za konkurenciju; zakonitost zavisi od jurisdikcije |
| **AUP** (Acceptable Use Policy) | Pravila upotrebe sistema; potpis pri zapošljavanju i periodično |
| **Code of conduct / ethics** | Očekivano ponašanje |

Administrativne kontrole koje se nameću politikom:

| Kontrola | Svrha |
|---|---|
| **Separation of duties** | Jedna osoba ne može sama izvršiti kritičan zadatak (npr. kreirati dobavljača i odobriti plaćanje) |
| **Job rotation** | Otkriva prevaru i smanjuje zavisnost od jedne osobe; omogućava unakrsnu obuku |
| **Mandatory vacation** | Zaposleni odsustvuje (npr. dvije uzastopne sedmice), a zamjena otkriva skrivene nepravilnosti; detektivna kontrola |
| **Least privilege i need to know** | Minimalna prava |
| **Dual control / two-person integrity** | Dvije osobe moraju zajedno izvršiti radnju (npr. otvaranje trezora, pristup ključevima) |
| **Collusion** | Dosluh je ono što SoD i rotacija čine potrebnim za prevaru, a time i težim |

### Onboarding, premještaji i prestanak rada

| Faza | Ključne kontrole |
|---|---|
| **Onboarding** | Kreiranje identiteta po proceduri, prava po ulozi (RBAC), potpis NDA/AUP, sigurnosna obuka prije pristupa, dodjela opreme |
| **Transfer** (premještaj, promocija) | Dodjela novih prava i **ukidanje starih** da bi se spriječio **privilege creep** (gomilanje prava); periodična revizija prava (access review) |
| **Termination** (prestanak rada) | Ukidanje pristupa **istovremeno** sa obavještavanjem (kod neprijateljskog otkaza prije ili tokom razgovora), povrat opreme i kartica, promjena dijeljenih lozinki, **exit interview** sa podsjećanjem na NDA, pratnja iz zgrade kod neprijateljskog otkaza, čuvanje podataka korisnika po politici |

> **Na ispitu:** kod otkaza, pristup se ukida **u trenutku** saopštavanja otkaza (ili neposredno prije), uz prisustvo HR-a i, po potrebi, obezbjeđenja. Ako pitanje nudi „ukinuti nalog na kraju sedmice“ ili „nakon exit intervjua“, to je pogrešno.

### Dobavljači, konsultanti i izvođači

Treće strane sa pristupom sistemima predstavljaju isti rizik kao zaposleni, ali sa manje kontrole. Ugovor je glavna kontrola.

| Element | Sadržaj |
|---|---|
| **SLA** (Service-Level Agreement) | Mjerljive obaveze: dostupnost (npr. 99,9%), vrijeme odgovora na incident, RTO/RPO, kazne (service credits) za nepoštovanje |
| **SLR** (Service-Level Requirements) | Zahtjevi kupca koji ulaze u SLA |
| **OLA** (Operational-Level Agreement) | Interni dogovor između timova koji podržavaju SLA |
| **MOU / MOA** | Memorandum o razumijevanju; manje formalan, često između organizacija ili odjeljenja |
| **ISA** (Interconnection Security Agreement) | Tehnički i sigurnosni uslovi povezivanja dviju mreža |
| **MSA / SOW** | Okvirni ugovor / opis konkretnog posla |
| **NDA** | Povjerljivost |
| **Pravo na audit** | Pravo kupca ili nezavisnog auditora da provjeri kontrole; alternativno SOC 2 Type II izvještaj |
| **Obaveza prijave incidenta** | Rok i način (npr. 24 h) |
| **Vraćanje i uništenje podataka** | Na kraju ugovora, uz potvrdu |

Kontrole za izvođače: provjera prije angažovanja (u skladu sa ugovorom), nalozi sa rokom važenja (expiration), pristup preko kontrolisanih kanala (PAM, jump host), nadzor sesija, isti zahtjevi obuke kao za zaposlene, ukidanje pristupa po završetku posla.

#### Računica dostupnosti u SLA

| SLA dostupnost | Dozvoljen prekid godišnje | Mjesečno (oko) |
|---|---|---|
| 99% | 3,65 dana | 7,3 h |
| 99,9% | 8,76 h | 43,8 min |
| 99,99% | 52,6 min | 4,4 min |
| 99,999% | 5,26 min | 26 s |

### Privatnost i nadzor zaposlenih

Politika mora unaprijed objasniti nadzor (banner, potpisana potvrda), a nadzor mora biti srazmjeran i zakonit. Sankcije za kršenje politika moraju biti dosljedne i dokumentovane.

## Upravljanje rizikom (1.9)

### Terminologija

| Pojam | Definicija |
|---|---|
| **Asset** | Sve što ima vrijednost za organizaciju (podaci, sistemi, ljudi, reputacija) |
| **Threat** | Potencijalni uzrok neželjenog incidenta (napadač, poplava, greška) |
| **Threat agent / actor** | Entitet koji ostvaruje prijetnju |
| **Vulnerability** | Slabost koju prijetnja može iskoristiti |
| **Exposure** | Izloženost gubitku zbog prijetnje |
| **Risk** | Vjerovatnoća da prijetnja iskoristi ranjivost × uticaj; **Risk = Threat × Vulnerability (× Impact/Asset value)** |
| **Safeguard / countermeasure** | Kontrola (prije / poslije incidenta, u užem ISC2 smislu) |
| **Residual risk** | Rizik koji ostaje nakon kontrola |
| **Inherent risk** | Rizik prije bilo kakvih kontrola |
| **Total risk** | Prijetnje × ranjivosti × vrijednost imovine (bez kontrola) |
| **Controls gap** | Razlika između ukupnog i preostalog rizika: **Total risk − Controls gap = Residual risk** |
| **Risk appetite / tolerance / capacity** | Koliko rizika organizacija želi preuzeti radi ciljeva / prihvatljivo odstupanje / maksimum koji može izdržati |

### Identifikacija prijetnji i ranjivosti

Izvori: threat intelligence (ISAC, CERT, dobavljači), istorija incidenata, threat modeling (modul 4), skeniranje ranjivosti, penetraciono testiranje, audit nalazi, CVE/NVD i CISA KEV katalog, intervjui sa vlasnicima procesa. Prijetnje se kategorizuju kao prirodne, ljudske (namjerne i nenamjerne), tehničke i okolišne.

### Obim i proces procjene

**Risk assessment** (NIST SP 800-30): pripremi (svrha, **obim**, pretpostavke, izvori, model) → sprovedi (identifikuj prijetnje i ranjivosti, odredi vjerovatnoću i uticaj, odredi rizik) → komuniciraj rezultate → održavaj. ISO/IEC 27005 i ISO 31000 imaju sličan tok: kontekst → identifikacija → analiza → evaluacija → tretman, uz komunikaciju i praćenje.

**Obim** (scope) određuje koji sistemi, lokacije, procesi i treće strane ulaze u procjenu. Pogrešan obim (npr. izostavljen SaaS ili OT mreža) je čest uzrok lažnog osjećaja sigurnosti.

### Kvantitativna analiza

| Formula | Značenje |
|---|---|
| **AV** (Asset Value) | Vrijednost imovine u novcu |
| **EF** (Exposure Factor) | Procenat vrijednosti izgubljen pri jednom incidentu (0–100%) |
| **SLE = AV × EF** | Single Loss Expectancy: gubitak po jednom incidentu |
| **ARO** | Annualized Rate of Occurrence: očekivani broj incidenata godišnje (jednom u 10 godina = 0,1) |
| **ALE = SLE × ARO** | Annualized Loss Expectancy: očekivani godišnji gubitak |
| **Vrijednost kontrole** | **(ALE prije − ALE poslije) − godišnji trošak kontrole (ACS)** |

#### Primjer računa

Data centar vrijedi **AV = 2.000.000 EUR**. Poplava bi uništila 40% (**EF = 0,4**). Poplava se očekuje jednom u 20 godina (**ARO = 0,05**).

- SLE = 2.000.000 × 0,4 = **800.000 EUR**
- ALE = 800.000 × 0,05 = **40.000 EUR godišnje**

Predložena kontrola (zaštitni zidovi i pumpe) košta **15.000 EUR godišnje** (amortizacija + održavanje) i smanjuje EF na 0,1:

- Novi SLE = 200.000; novi ALE = 200.000 × 0,05 = **10.000 EUR**
- Vrijednost kontrole = (40.000 − 10.000) − 15.000 = **15.000 EUR godišnje** → kontrola je opravdana.

Da je kontrola koštala 35.000 EUR godišnje, vrijednost bi bila −5.000 EUR i kontrola ne bi bila ekonomski opravdana (osim zbog zakona ili bezbjednosti ljudi).

#### Drugi primjer: phishing

Kompromitovanje naloga kroz phishing košta prosječno 25.000 EUR po incidentu (SLE), a dešava se 6 puta godišnje (ARO = 6): ALE = 150.000 EUR. Phishing-otporna MFA za 30.000 EUR godišnje smanjuje ARO na 0,5: novi ALE = 12.500 EUR. Vrijednost = (150.000 − 12.500) − 30.000 = **107.500 EUR**.

> **Na ispitu:** zapamti redoslijed AV → EF → SLE → ARO → ALE. Ako je ARO „jednom u 50 godina“, to je 0,02. Kontrola čiji godišnji trošak premašuje smanjenje ALE nije opravdana, osim kada je propisana zakonom ili štiti ljudske živote.

### Kvalitativna analiza

| Pristup | Opis | Prednosti | Mane |
|---|---|---|---|
| **Kvantitativni** | Novčane vrijednosti, formule | Objektivan, poređenje troškova i koristi | Zahtijeva pouzdane podatke, teško za nematerijalnu imovinu |
| **Kvalitativni** | Skale (nizak/srednji/visok), matrica vjerovatnoće i uticaja, **Delphi tehnika** (anonimni stručni konsenzus), intervjui, radionice, scenariji | Brz, uključuje nematerijalno (reputacija) | Subjektivan, teško poređenje sa troškom |
| **Hibridni / polukvantitativni** | Numeričke skale (1–5) i ponderi | Balans | Lažna preciznost |

Matrica rizika (5×5) prioritizuje rizike za tretman; kombinacija visoka vjerovatnoća × visok uticaj je prvi prioritet.

### Tretman rizika

| Strategija | Opis | Primjer |
|---|---|---|
| **Mitigate / reduce** | Uvesti kontrole koje smanjuju vjerovatnoću ili uticaj | MFA, segmentacija, backup |
| **Transfer / share** | Prenijeti finansijske posljedice na treću stranu | **Cyber osiguranje**, outsourcing uz ugovornu odgovornost |
| **Avoid** | Odustati od aktivnosti koja stvara rizik | Ne uvoditi uslugu, ne čuvati brojeve kartica |
| **Accept** | Svjesno prihvatiti rizik, dokumentovano, od strane vlasnika rizika | Rizik ispod praga apetita, trošak kontrole veći od koristi |
| **Reject / ignore** | Ignorisati rizik | **Nikada nije prihvatljivo** (nepažnja) |

**Strategije ublažavanja** (risk mitigation strategies, novo u 2027.) uključuju kombinaciju kontrola po slojevima (defense in depth), smanjenje površine napada, kompenzacione kontrole kada primarna nije izvodljiva, i prioritizaciju po riziku (npr. zakrpe prvo za ranjivosti iz KEV kataloga na internetu izloženim sistemima).

**Cyber osiguranje** prenosi finansijski, ali ne i reputacioni i pravni rizik; osiguravači traže minimalne kontrole (MFA, EDR, offline backup) i mogu odbiti isplatu ako kontrole nisu postojale. Odgovornost (accountability) za zaštitu podataka ostaje na organizaciji.

> **Na ispitu:** rizik se nikada ne može potpuno eliminisati; uvijek ostaje preostali rizik koji vlasnik rizika formalno prihvata. Prenos rizika ne prenosi odgovornost. „Ignorisati“ je uvijek pogrešan odgovor.

### Tipovi kontrola

| Funkcionalni tip | Svrha | Administrativni primjer | Tehnički primjer | Fizički primjer |
|---|---|---|---|---|
| **Directive** | Usmjerava ponašanje | Politika, AUP | Login banner sa pravilima | Znakovi „Ulaz zabranjen“ |
| **Deterrent** | Odvraća | Sankcije u politici | Upozorenje o nadzoru | Vidljive kamere, čuvari |
| **Preventive** | Sprječava incident | Provjera kandidata, SoD | Firewall, MFA, šifrovanje | Brave, mantrap, ograde |
| **Detective** | Otkriva incident | Audit, mandatory vacation, job rotation | IDS, SIEM, FIM | CCTV, senzori pokreta |
| **Corrective** | Ispravlja nakon incidenta | Disciplinska mjera, ažuriranje procedura | Antivirus karantin, patch, izolacija hosta | Gašenje požara |
| **Recovery** | Vraća u normalan rad | DRP | Restore iz backupa, failover | Rezervna lokacija |
| **Compensating** | Alternativa kada primarna kontrola nije izvodljiva | Pojačan nadzor umjesto SoD u malom timu | Segmentacija za legacy sistem bez zakrpa | Dodatni čuvar |

Kategorije: **administrative / managerial**, **technical / logical**, **physical**.

> **Na ispitu:** jedna kontrola može imati više tipova; pitanje traži PRIMARNI. CCTV koji niko ne gleda u realnom vremenu je detektivna (i odvraćajuća), ne preventivna. Mandatory vacation je detektivna. Kompenzaciona kontrola je odgovor kada pitanje kaže „primarnu kontrolu nije moguće primijeniti“.

### Procjena kontrola (security i privacy)

**Control assessment** provjerava da li su kontrole **ispravno primijenjene, rade kako je namjeravano i daju željeni ishod** (NIST SP 800-53A). Metode: **examine** (pregled dokumenata, konfiguracija), **interview**, **test** (tehničko testiranje). Procjene privatnosti provjeravaju i privatnosne kontrole (800-53 familija PT, minimizacija, saglasnost) i uključuju **PIA/DPIA**. Procjenu radi nezavisan procjenitelj (interni audit, 3PAO, eksterni auditor), a rezultati ulaze u **POA&M** (Plan of Action and Milestones).

### Kontinuirano praćenje i mjerenje

**ISCM** (Information Security Continuous Monitoring, NIST SP 800-137) održava stalnu svijest o prijetnjama, ranjivostima i efikasnosti kontrola. Mjeri se kroz **KPI** (performanse kontrola), **KRI** (rani signali rasta rizika) i **KCI** (key control indicators). Primjeri: procenat imovine pod EDR-om, srednje vrijeme do zakrpe kritičnih ranjivosti, broj izuzetaka od politike, procenat naloga sa MFA.

### Izvještavanje

| Tip | Publika | Sadržaj |
|---|---|---|
| **Interno** | Odbor, uprava, komitet za rizik, vlasnici rizika | Registar rizika (risk register), trendovi, KRI, status tretmana, izuzeci, risk heat map |
| **Eksterno** | Regulatori, revizori, kupci, investitori, osiguravači | Regulatorne prijave, SOC izvještaji, izjave o usklađenosti, objave o materijalnim incidentima (npr. SEC pravila za javne kompanije) |

**Registar rizika** (risk register) sadrži: opis rizika, vlasnika, vjerovatnoću, uticaj, ocjenu, postojeće kontrole, tretman, rok, preostali rizik i status.

### Kontinuirano poboljšanje i modeli zrelosti

| Model | Nivoi |
|---|---|
| **CMMI** (Capability Maturity Model Integration) | 1 Initial, 2 Managed, 3 Defined, 4 Quantitatively Managed, 5 Optimizing |
| **NIST CSF tierovi** | 1 Partial, 2 Risk Informed, 3 Repeatable, 4 Adaptive |
| **RMM / risk maturity** | Ad hoc → preliminarno → definisano → integrisano → optimizovano |
| **C2M2** | Model zrelosti za energetski sektor |

Ciklus poboljšanja je **PDCA** (Plan-Do-Check-Act, Deming); nalazi audita, incidenata i metrika vraćaju se u planiranje.

### Okviri rizika

| Okvir | Suština |
|---|---|
| **ISO 31000** | Opšti principi i smjernice upravljanja rizikom (nije certifikabilan) |
| **ISO/IEC 27005** | Upravljanje rizikom informacione sigurnosti, podrška ISO 27001 |
| **NIST RMF (SP 800-37 Rev. 2)** | Prepare → Categorize (FIPS 199) → Select (800-53) → Implement → Assess (800-53A) → Authorize (ATO) → Monitor |
| **NIST SP 800-30** | Vodič za procjenu rizika |
| **NIST SP 800-39** | Upravljanje rizikom na nivou organizacije, procesa i sistema (tri nivoa); frame, assess, respond, monitor |
| **COBIT 2019** | Rizik kao dio IT governancea (fokus područje rizika); povezan sa **ISACA Risk IT** |
| **SABSA** | Rizik vođen poslovnim atributima, prilike i prijetnje |
| **PCI DSS** | Ciljana analiza rizika (targeted risk analysis) za fleksibilne zahtjeve i customized approach |
| **HIPAA Security Rule** | Obavezna analiza rizika (risk analysis) i upravljanje rizikom za ePHI |
| **COSO ERM** | Upravljanje rizikom preduzeća povezano sa strategijom i performansama |
| **FAIR** | Kvantitativna analiza rizika (frekvencija i magnituda gubitka) |
| **OCTAVE** | Samousmjerena procjena rizika (Carnegie Mellon) |

> **Na ispitu:** RMF koraci po redu su česta PBQ tema: **Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor**. Odluku o autorizaciji (ATO) donosi **Authorizing Official** (viši rukovodilac), ne procjenitelj.

### Kategorizacija u RMF-u (FIPS 199)

Sistem se kategorizuje po potencijalnom uticaju (low, moderate, high) na povjerljivost, integritet i dostupnost svake vrste informacija. Ukupna kategorija je **high water mark**: najviša vrijednost od tri. Primjer: SC = {(C, moderate), (I, high), (A, low)} daje kategoriju **high**, pa se bira high baseline iz SP 800-53B.

### Scenarij: ko prihvata rizik

Penetracioni test nalazi da legacy ERP ne podržava MFA. Zamjena je planirana za 18 mjeseci. CISSP ne prihvata rizik sam; on priprema analizu (vjerovatnoća, uticaj, ALE), predlaže kompenzacione kontrole (pristup samo preko PAM-a i jump hosta, nadzor sesija, mrežna segmentacija) i iznosi preostali rizik **vlasniku rizika** (vlasniku poslovnog procesa), koji ga formalno prihvata u registru rizika, sa rokom ponovne procjene.

| Ko | Uloga u odluci o riziku |
|---|---|
| CISO / tim za rizik | Identifikuje, analizira, preporučuje |
| Vlasnik rizika (poslovanje) | Odlučuje o tretmanu, prihvata preostali rizik |
| Uprava / odbor | Definiše risk appetite, odlučuje o rizicima iznad praga |
| Interni audit | Nezavisno provjerava proces |

## Rezime

- **BCP**: obim i planiranje → BIA → planiranje kontinuiteta → odobrenje i sprovođenje; ISO 22301, NIST SP 800-34.
- **BIA** mjeri uticaj, ne prijetnje; **RTO + WRT ≤ MTD**; RPO određuje učestalost backupa; MTD i RPO određuje poslovanje.
- **Spoljne zavisnosti**: komunalije, ISP, cloud, dobavljači, ključni ljudi; SLA sa RTO/RPO, više dobavljača, izlazna strategija.
- **Kadrovi**: provjera srazmjerna osjetljivosti pozicije; NDA, AUP; SoD, job rotation, mandatory vacation, dual control; ukidanje pristupa u trenutku otkaza; privilege creep pri premještaju.
- **Treće strane**: SLA, OLA, MOU, ISA, pravo na audit, obaveza prijave incidenta, nalozi sa rokom važenja.
- **Rizik**: AV × EF = SLE; SLE × ARO = ALE; vrijednost kontrole = ALE prije − ALE poslije − trošak.
- **Tretman**: mitigate, transfer (osiguranje ne prenosi odgovornost), avoid, accept (formalno); nikada ignore.
- **Kontrole**: directive, deterrent, preventive, detective, corrective, recovery, compensating × administrative, technical, physical.
- **Procjena, praćenje, izvještavanje**: 800-53A (examine, interview, test), ISCM 800-137, KPI/KRI, registar rizika, interno i eksterno.
- **Zrelost i okviri**: CMMI 1–5, PDCA; ISO 31000/27005, NIST RMF/800-30/800-39, COBIT, SABSA, PCI DSS, HIPAA, FAIR.
