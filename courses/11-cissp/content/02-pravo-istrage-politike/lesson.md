## Ciljevi ispita: 1.4, 1.5 i 1.6

- **1.4 Understand legal, regulatory, and compliance issues that pertain to information security in a holistic context**
  - Cybercrimes and data breaches
  - Licensing and Intellectual Property (IP) requirements
  - Import/export controls
  - Transborder data flow
  - Issues related to privacy (GDPR, California Consumer Privacy Act, Personal Information Protection Law, Protection of Personal Information Act, HIPAA)
  - Contractual, legal, industry standards, and regulatory requirements
- **1.5 Understand requirements for investigation types (i.e., administrative, criminal, civil, regulatory)**
- **1.6 Develop, document, and implement security policy, standards, procedures, and guidelines**

U outlineu iz 2024. lista zakona o privatnosti u 1.4 nije sadržavala HIPAA (HIPAA se tada pominjao samo implicitno), a cilj 1.5 je kao peti tip istrage navodio i **industry standards**. U outlineu 2027. ostala su četiri tipa: administrativna, krivična, građanska i regulatorna; istrage po industrijskim standardima (npr. PCI forenzika) tretiraj kao podvrstu regulatorne ili ugovorne.

CISSP nije pravni ispit: ne traži članove zakona, nego da prepoznaš **kategoriju prava**, **koji zakon se primjenjuje na scenarij**, i šta organizacija mora uraditi (obavijestiti, dobiti saglasnost, licencirati, prijaviti).

> **Na ispitu:** sigurnosni profesionalac nije advokat. Kada scenarij ima pravnu nejasnoću (jurisdikcija, obaveza prijave, saradnja sa policijom), BEST odgovor je skoro uvijek **konsultovati pravnu službu (legal counsel)** prije djelovanja.

## Kategorije prava (1.4)

| Kategorija | Ko je strana | Cilj | Standard dokazivanja | Kazna |
|---|---|---|---|---|
| **Criminal law** (krivično) | Država protiv pojedinca/organizacije | Kazna i zaštita društva | **Beyond a reasonable doubt** (van razumne sumnje) | Zatvor, novčana kazna, uslovna |
| **Civil law / tort law** (građansko) | Pojedinac ili organizacija protiv druge strane | Naknada štete | **Preponderance of the evidence** (pretežnost dokaza, više od 50%) | Naknada štete (compensatory, punitive, statutory) |
| **Administrative / regulatory law** | Državne agencije (regulatori) | Sprovođenje propisa | Obično pretežnost dokaza | Novčane kazne, zabrana rada, korektivne mjere |
| **Contract law** | Ugovorne strane | Ispunjenje ugovora | Pretežnost dokaza | Naknada, raskid |

**Pravni sistemi** u svijetu: **common law** (precedenti; SAD, UK), **civil law** (kodifikovano pravo; kontinentalna Evropa, region), **religious law** (šerijatsko i drugo), **customary law** (običajno) i mješoviti sistemi. Za ispit je važno da se zakoni razlikuju po jurisdikcijama, što komplikuje istrage i prenos podataka.

### Vrste štete u građanskom pravu

| Vrsta | Značenje |
|---|---|
| **Compensatory damages** | Nadoknada stvarnog gubitka |
| **Punitive damages** | Kazna za posebno teško ponašanje, odvraćanje |
| **Statutory damages** | Iznos propisan zakonom po prekršaju (npr. autorska prava) |

## Kibernetički kriminal i povrede podataka (1.4)

| Kategorija napada | Primjeri |
|---|---|
| Računar kao **meta** | Neovlašćen pristup, DoS, ransomware nad infrastrukturom |
| Računar kao **sredstvo** | Prevara, krađa identiteta, distribucija nezakonitog sadržaja |
| Računar **slučajno uključen** | Dokazi kriminala na uređaju (evidencija trgovine drogom) |

### Zakoni koje ispit pominje

| Zakon / instrument | Jurisdikcija | Suština |
|---|---|---|
| **Computer Fraud and Abuse Act (CFAA)** | SAD | Neovlašćen pristup „zaštićenim računarima“ (federalni, finansijski, u međudržavnoj trgovini) |
| **Electronic Communications Privacy Act (ECPA)** | SAD | Zaštita elektronske komunikacije od prisluškivanja |
| **CALEA** | SAD | Telekom operatori moraju omogućiti zakonito presretanje |
| **Identity Theft and Assumption Deterrence Act** | SAD | Krađa identiteta kao federalno krivično djelo |
| **Budimpeštanska konvencija o kibernetičkom kriminalu** (Council of Europe Convention on Cybercrime, 2001) | Međunarodno (uključujući BiH, Srbiju, Crnu Goru, Hrvatsku) | Harmonizacija krivičnih djela i međunarodna saradnja u istragama |
| **NIS2 direktiva** (EU 2022/2555) | EU | Obaveze sigurnosti i prijave incidenata za ključne i važne subjekte; lična odgovornost uprave; rok ranog upozorenja 24 h, prijave 72 h |
| **DORA** (EU 2022/2554) | EU finansijski sektor | Digitalna operativna otpornost, ICT incidenti, testiranje, rizik trećih strana |
| **Sarbanes-Oxley (SOX)** | SAD, javno listane kompanije | Tačnost finansijskog izvještavanja; interne kontrole (COSO), odgovornost CEO/CFO |
| **GLBA** | SAD, finansijske institucije | Zaštita finansijskih podataka klijenata, Safeguards Rule, privacy notice |
| **FISMA** | SAD, federalne agencije | Program sigurnosti informacija zasnovan na NIST standardima |

### Povreda podataka (data breach)

**Data breach** je potvrđen incident u kojem su podaci neovlašćeno otkriveni, izmijenjeni ili uništeni. Ključne obaveze:

| Režim | Kome se prijavljuje | Rok |
|---|---|---|
| **GDPR** čl. 33/34 | Nadzornom tijelu; ispitanicima ako je visok rizik po njihova prava | **72 sata** od saznanja (nadzornom tijelu); ispitanicima „bez nepotrebnog odlaganja“ |
| **HIPAA Breach Notification Rule** | Pogođenim pojedincima, HHS; medijima ako je preko 500 osoba u državi | Najkasnije **60 dana** od otkrivanja |
| **Državni zakoni SAD** (sve savezne države) | Pogođenim stanovnicima, ponekad državnom tužiocu | Različito, često 30–60 dana |
| **NIS2** | CSIRT / nadležnom tijelu | Rano upozorenje 24 h, prijava 72 h, završni izvještaj u roku od mjesec dana |
| **PCI DSS** (ugovorno) | Kartičnim kućama i acquireru | Odmah, prema ugovoru |

Šifrovani podaci sa nekompromitovanim ključem često su izuzeti od obaveze obavještavanja pojedinaca (**safe harbor**).

### Tok odluka pri sumnji na povredu ličnih podataka

1. Zadržati (contain) incident i sačuvati dokaze prema planu odgovora na incidente.
2. Utvrditi činjenice: koji podaci, koliko osoba, iz kojih jurisdikcija, da li su podaci bili šifrovani i da li je ključ kompromitovan.
3. Uključiti pravnu službu, DPO-a i upravu; procijeniti rizik po prava i slobode pojedinaca.
4. Odrediti primjenjive režime i rokove (GDPR, HIPAA, NIS2, ugovori sa klijentima, PCI DSS).
5. Obavijestiti nadzorno tijelo, a po potrebi i pogođene osobe, kartične kuće, osiguravača i partnere.
6. Dokumentovati odluku i obrazloženje, čak i kada se zaključi da prijava nije potrebna (GDPR traži evidenciju svih povreda).
7. Lessons learned i korektivne mjere.

Kontroler koji koristi obrađivača ostaje odgovoran: obrađivač mora obavijestiti kontrolora bez nepotrebnog odlaganja, a kontrolor prijavljuje nadzornom tijelu.

> **Na ispitu:** odluku o tome da li i kako obavijestiti regulatora i javnost donosi uprava uz pravnu službu, na osnovu plana odgovora na incidente, a ne analitičar SOC-a. Tehnički tim prikuplja činjenice i dokaze.

## Licenciranje i intelektualna svojina (1.4)

| Oblik IP | Šta štiti | Trajanje (tipično) | Registracija | Primjer |
|---|---|---|---|---|
| **Copyright** (autorsko pravo) | Izražaj ideje: kod, tekst, muzika, dizajn | Život autora + 70 godina (SAD/EU); djelo za naručioca (work for hire) 95 godina od objave ili 120 od nastanka | Nastaje automatski, registracija opciona | Izvorni kod aplikacije |
| **Trademark** (žig) | Znak, ime, logo koji razlikuje robu/usluge | 10 godina, obnovljivo neograničeno | Registracija (™ neregistrovan, ® registrovan) | Logo i naziv proizvoda |
| **Patent** | Novi, korisni, neočigledni izum | **20 godina** od podnošenja prijave | Obavezna, javno objavljivanje izuma | Novi algoritam kompresije u hardveru |
| **Trade secret** (poslovna tajna) | Povjerljiva poslovna informacija koja daje prednost | Dok god je tajna | Nema; štiti se NDA-om i kontrolama | Receptura, algoritam rangiranja |

**Trade secret** zahtijeva da organizacija preduzme razumne mjere da ga čuva tajnim (NDA, kontrola pristupa, klasifikacija); bez toga gubi zaštitu. Patent je suprotno: zaštita u zamjenu za javno objavljivanje.

Zakoni: **DMCA** (SAD; zabrana zaobilaženja zaštite od kopiranja, safe harbor za ISP-ove uz notice-and-takedown), **Economic Espionage Act** (SAD, krađa poslovnih tajni), **TRIPS** (WTO sporazum o IP), **WIPO** ugovori.

### Licenciranje softvera

| Tip licence | Opis |
|---|---|
| **Contractual license** | Pisani ugovor između proizvođača i kupca |
| **Shrink-wrap** | Uslovi prihvaćeni otvaranjem pakovanja |
| **Click-through / click-wrap** | Prihvatanje klikom pri instalaciji |
| **Cloud / SaaS subscription** | Uslovi korištenja, pretplata po korisniku |
| **Open source** | Permisivne (MIT, Apache 2.0, BSD) ili **copyleft** (GPL: izvedeno djelo koje se distribuira mora biti pod istom licencom) |

Rizici: nelicencirani softver (krivična i građanska odgovornost, audit proizvođača preko BSA), kršenje copyleft licence u komercijalnom proizvodu, prekoračenje broja licenci. Kontrole: inventar softvera, SBOM sa podacima o licencama (modul 4), politika o upotrebi open-source komponenti, software asset management (SAM).

> **Na ispitu:** zaposleni napiše kod tokom radnog vremena i na opremi poslodavca: vlasnik autorskog prava je poslodavac (**work for hire**), osim ako ugovor kaže drugačije. Za zaštitu algoritma koji se ne želi objaviti, ispravan izbor je **trade secret**, ne patent.

## Kontrole uvoza i izvoza (1.4)

| Režim | Šta reguliše |
|---|---|
| **ITAR** (International Traffic in Arms Regulations, SAD, State Department) | Vojne stavke i tehnologije sa liste USML |
| **EAR** (Export Administration Regulations, SAD, Department of Commerce, BIS) | Komercijalne stavke i stavke dvojne namjene (dual-use) sa liste CCL, uključujući kriptografiju |
| **Wassenaar Arrangement** | Multilateralni dogovor o kontroli izvoza konvencionalnog oružja i dual-use roba i tehnologija (uključujući kriptografiju) |
| **EU Dual-Use Regulation (2021/821)** | Kontrola izvoza dual-use roba iz EU |
| **Uvozna ograničenja** | Neke zemlje ograničavaju ili traže licencu za uvoz i upotrebu šifrovanja (npr. obavezna registracija kriptografskih proizvoda) |

Praktično: izvoz softvera sa jakom kriptografijom u embargo zemlje je zabranjen; **deemed export** znači da i pokazivanje kontrolisane tehnologije stranom državljaninu unutar zemlje može biti izvoz. Prije slanja laptopa sa šifrovanim diskom ili prije cloud deploymenta u novoj zemlji treba provjeriti uvozna pravila.

## Prekogranični tok podataka (1.4)

**Transborder data flow** je kretanje podataka (posebno ličnih) preko državnih granica. Problemi su **suverenitet podataka** (data sovereignty: podaci podliježu zakonima zemlje u kojoj se nalaze), **lokalizacija podataka** (data localization: zakon traži da podaci ostanu u zemlji, npr. Rusija, Kina) i **pristup stranih vlasti** (npr. US CLOUD Act).

| GDPR mehanizam prenosa van EEA | Opis |
|---|---|
| **Adequacy decision** | Evropska komisija utvrdila je da zemlja ima adekvatan nivo zaštite (npr. UK, Japan, Švajcarska, SAD preko **EU-U.S. Data Privacy Framework** za certifikovane kompanije) |
| **Standard Contractual Clauses (SCC)** | Ugovorne klauzule koje je usvojila Komisija, uz procjenu uticaja prenosa (TIA) |
| **Binding Corporate Rules (BCR)** | Interna pravila multinacionalne grupe odobrena od nadzornog tijela |
| **Derogations** (čl. 49) | Izričita saglasnost, izvršenje ugovora, važan javni interes; samo za povremene prenose |

Istorija za ispit: **Safe Harbor** (poništen 2015, presuda Schrems I) → **Privacy Shield** (poništen 2020, Schrems II) → **Data Privacy Framework** (2023).

## Privatnost (1.4)

### OECD principi i GDPR

**OECD Privacy Guidelines** (1980, revidirane 2013) su temelj većine zakona: collection limitation, data quality, purpose specification, use limitation, security safeguards, openness, individual participation, accountability.

| GDPR element | Sadržaj |
|---|---|
| Teritorijalni obim | Organizacije u EU i van EU koje nude robu/usluge ili prate ponašanje osoba u EU |
| Principi (čl. 5) | Zakonitost, poštenje, transparentnost; ograničenje svrhe; minimizacija; tačnost; ograničenje čuvanja; integritet i povjerljivost; **accountability** |
| Pravni osnovi (čl. 6) | Saglasnost, ugovor, zakonska obaveza, vitalni interes, javni interes, legitimni interes |
| Prava ispitanika | Pristup, ispravka, brisanje (right to be forgotten), ograničenje, prenosivost, prigovor, pravo da ne bude predmet isključivo automatizovane odluke |
| Uloge | **Controller** (određuje svrhu i način), **processor** (obrađuje u ime kontrolora), **DPO** (službenik za zaštitu podataka) |
| Obaveze | Privacy by design and by default, DPIA za visok rizik, evidencija obrade, prijava povrede u 72 h |
| Kazne | Do **20 miliona EUR ili 4%** globalnog godišnjeg prometa (veće); niži nivo 10 mil. / 2% |

### Ostali zakoni o privatnosti iz outlinea

| Zakon | Jurisdikcija | Ključno |
|---|---|---|
| **CCPA / CPRA** (California Consumer Privacy Act, dopunjen California Privacy Rights Act) | Kalifornija, SAD | Pravo da se zna, briše, ispravi, **opt-out od prodaje i dijeljenja**, ograniči upotreba osjetljivih podataka; agencija CPPA; privatna tužba za povrede podataka |
| **PIPL** (Personal Information Protection Law) | Kina | Sličan GDPR-u, stroga pravila prekograničnog prenosa (sigurnosna procjena CAC, standardni ugovor, certifikacija), lokalizacija za operatore kritične infrastrukture |
| **POPIA** (Protection of Personal Information Act) | Južnoafrička Republika | Osam uslova zakonite obrade, Information Regulator, „responsible party“ i „operator“ (ekvivalenti kontrolora i obrađivača) |
| **HIPAA** (Health Insurance Portability and Accountability Act) + **HITECH** | SAD, zdravstvo | Štiti **PHI**; Privacy Rule, Security Rule (administrativne, fizičke, tehničke zaštite), Breach Notification Rule; „covered entities“ i „business associates“ uz **BAA** ugovor |
| **ZZLP** (zakoni o zaštiti ličnih podataka u regionu) | Srbija, BiH, Crna Gora | Usklađeni sa GDPR-om u velikoj mjeri |
| **PIPEDA** | Kanada | Privatnost u privatnom sektoru |
| **COPPA** | SAD | Djeca mlađa od 13 godina, roditeljska saglasnost |
| **FERPA** | SAD | Obrazovni dosijei |

> **Na ispitu:** prepoznaj zakon po **vrsti podataka i jurisdikciji**: zdravstveni podaci u SAD = HIPAA; kartice = PCI DSS (ugovorno, ne zakon); finansijske institucije SAD = GLBA; javne kompanije SAD = SOX; EU građani = GDPR; Kalifornija = CCPA/CPRA; Kina = PIPL; Južna Afrika = POPIA.

### Scenariji: koji zakon se primjenjuje

| Scenarij | Primarni režim |
|---|---|
| Beogradska firma prodaje online pretplate građanima Njemačke | GDPR (teritorijalni obim: nudi usluge osobama u EU) i lokalni ZZPL |
| Klinika u Teksasu šalje snimke pacijenata cloud provajderu | HIPAA; provajder je business associate i potpisuje BAA |
| Web shop u Sarajevu prima Visa i Mastercard kartice | PCI DSS (ugovorna obaveza preko acquirera) i lokalni zakon o zaštiti podataka |
| Kineska podružnica šalje podatke kupaca u centralu u EU | PIPL (prekogranični prenos) i GDPR na strani primaoca |
| Startup iz Kalifornije prodaje podatke o ponašanju korisnika oglašivačima | CCPA/CPRA: obavještenje i opt-out „Do Not Sell or Share“ |
| Banka listana na NYSE mijenja sistem glavne knjige | SOX (interne kontrole nad finansijskim izvještavanjem) i GLBA |
| Operater energetske mreže u Hrvatskoj ima ransomware incident | NIS2 (rano upozorenje u 24 h) i nacionalni zakon o kibernetičkoj sigurnosti |

### Privatnost zaposlenih i nadzor

Organizacija smije nadzirati korištenje poslovnih sistema, ali mora: imati jasnu politiku (AUP), obavijestiti zaposlene unaprijed (banner pri prijavi, potpisana potvrda), nadzirati srazmjerno svrsi i u skladu sa radnim pravom i zakonom o privatnosti. **Login banner** uklanja „razumno očekivanje privatnosti“ (reasonable expectation of privacy) i olakšava upotrebu dokaza. U EU je za sistematski nadzor zaposlenih često potrebna DPIA i konsultacija sa predstavnicima radnika.

### Privacy by Design (Ann Cavoukian): sedam principa

| Princip | Suština |
|---|---|
| Proactive not reactive | Spriječiti, ne popravljati |
| Privacy as the default | Zaštita bez akcije korisnika |
| Privacy embedded into design | Dio arhitekture, ne dodatak |
| Full functionality (positive-sum) | Privatnost i funkcionalnost, ne ili-ili |
| End-to-end security | Zaštita kroz cijeli životni ciklus podataka |
| Visibility and transparency | Provjerljivost |
| Respect for user privacy | Korisnik u centru |

### PII, PHI i povezani pojmovi

| Pojam | Značenje |
|---|---|
| **PII** | Informacija koja identifikuje ili može identifikovati osobu, direktno ili u kombinaciji |
| **PHI** | Zdravstvena informacija povezana sa pojedincem (HIPAA) |
| **Pseudonymization** | Zamjena identifikatora, ali uz dodatnu informaciju ponovna identifikacija je moguća; i dalje lični podatak po GDPR-u |
| **Anonymization** | Nepovratno uklanjanje mogućnosti identifikacije; više nije lični podatak |
| **Data minimization** | Prikupljati samo ono što je potrebno za svrhu |

## Ugovorni, zakonski, industrijski i regulatorni zahtjevi (1.4)

| Izvor zahtjeva | Primjer | Posljedica nepoštovanja |
|---|---|---|
| **Zakon** (legal) | GDPR, HIPAA, NIS2 | Kazne, krivična odgovornost |
| **Regulativa** (regulatory) | Pravila centralne banke, FFIEC, agencije za telekomunikacije | Novčane kazne, oduzimanje licence |
| **Industrijski standard** | PCI DSS, SWIFT CSP, ISO 27001 kada ga traži kupac | Gubitak prava na obradu kartica, gubitak tržišta |
| **Ugovor** | SLA, DPA, BAA, pravo na audit, obaveza prijave incidenta | Naknada štete, raskid |

**Compliance** program mapira sve zahtjeve na kontrole (jedna kontrola može zadovoljiti više zahtjeva: **unified control framework**), prati dokaze i izvještava upravu. Kod pitanja usklađenosti vrijedi: zakon je minimum, a rizik i ugovori mogu zahtijevati više.

## Tipovi istraga (1.5)

| Tip | Ko pokreće | Svrha | Standard dokazivanja | Posebnosti |
|---|---|---|---|---|
| **Administrative** (operativna, interna) | Organizacija (HR, sigurnost) | Kršenje politike, operativni problem, analiza uzroka | Najniži; interni standard organizacije | Može prerasti u krivičnu ili građansku, pa dokaze treba čuvati kao da hoće |
| **Criminal** | Policija, tužilaštvo | Krivično djelo | **Beyond a reasonable doubt** | Stroga pravila o dokazima, lanac nadzora, potreban nalog; organizacija gubi kontrolu nad istragom |
| **Civil** | Strana u sporu (advokati) | Naknada štete, spor | **Preponderance of the evidence** | **eDiscovery** (EDRM), legal hold, obaveza čuvanja relevantnih podataka |
| **Regulatory** | Regulator ili organizacija po njegovom nalogu | Kršenje propisa | Zavisi od regulatora | Obavezna saradnja; mogu uslijediti kazne |

### Scenarij: od administrativne do krivične

SOC otkriva da zaposleni preuzima velike količine podataka o klijentima. Počinje administrativna istraga (kršenje politike prihvatljive upotrebe). Kada se ustanovi da prodaje podatke konkurenciji, to postaje krivično djelo i moguća građanska tužba. Ključna odluka: **uključiti pravnu službu i upravu** prije kontakta sa policijom, jer kada policija preuzme slučaj, organizacija gubi kontrolu nad tempom, a dokazi postaju javni u postupku. Dokazi prikupljeni od početka uz **lanac nadzora** (chain of custody) ostaju upotrebljivi.

### Pravila o dokazima (pregled; detaljno u modulu 12)

| Vrsta dokaza | Opis |
|---|---|
| **Real evidence** | Fizički predmet (disk, laptop) |
| **Documentary evidence** | Pisani dokumenti, logovi; **best evidence rule** (original), **parol evidence rule** (pisani ugovor ima prednost nad usmenim) |
| **Testimonial evidence** | Svjedočenje; ekspert može davati mišljenje |
| **Direct / circumstantial / corroborative / hearsay** | Logovi su tehnički hearsay, prihvatljivi kao poslovni zapisi (business records exception) ako su redovno vođeni |

Dokaz mora biti **relevantan**, **materijalan** i **kompetentan** (zakonito pribavljen), i **autentičan, tačan, potpun, uvjerljiv i prihvatljiv**. Zakonitost pribavljanja: **search warrant**, saglasnost, ili **exigent circumstances** (hitne okolnosti kada prijeti uništenje dokaza). Organizacija ne smije djelovati kao produžena ruka policije bez naloga; ako policija zatraži od privatne firme da pretraži, firma postaje agent države i važe ustavna ograničenja. Izbjegava se **entrapment** (navođenje na djelo), dok je **enticement** (honeypot koji samo pruža priliku) prihvatljiv.

> **Na ispitu:** razlika između standarda dokazivanja je česta. „Van razumne sumnje“ je krivično, „pretežnost dokaza“ je građansko. Administrativna istraga ima najblaži standard, ali dokaze treba prikupljati kao za sud.

### Istrage po industrijskim standardima

U outlineu iz 2024. postojao je i tip **industry standards**: istraga koju zahtijeva industrijsko tijelo ili ugovor, a ne zakon. Najpoznatiji primjer je **PCI Forensic Investigator (PFI)** koga kartične kuće angažuju nakon sumnje na kompromitovanje podataka kartica. Organizacija je ugovorno obavezna da sarađuje, a nalazi utiču na kazne i status usklađenosti. U outlineu 2027. ovakve istrage spadaju pod regulatorne/ugovorne zahtjeve.

### Poređenje istraga u jednom pogledu

| Pitanje | Administrativna | Krivična | Građanska | Regulatorna |
|---|---|---|---|---|
| Ko kontroliše tempo | Organizacija | Policija i tužilaštvo | Strane i sud | Regulator |
| Da li je javno | Uglavnom ne | Da, u postupku | Da, u postupku | Često se objavljuju kazne |
| Ishod | Disciplinska mjera, popravka procesa | Presuda, kazna | Naknada štete | Kazna, naložene mjere |
| Uloga sigurnosnog tima | Vodi ili podržava | Čuva dokaze, sarađuje kroz pravnu službu | Legal hold, eDiscovery | Dostavlja dokaze o kontrolama |

### eDiscovery i legal hold

**Legal hold** (litigation hold) je nalog da se sačuvaju svi podaci relevantni za očekivani ili tekući spor, uz suspenziju redovnog brisanja po politici zadržavanja. **EDRM** (Electronic Discovery Reference Model): information governance → identification → preservation → collection → processing → review → analysis → production → presentation. Uništavanje podataka nakon što je spor razumno očekivan je **spoliation** i nosi sankcije.

## Politika, standardi, procedure i smjernice (1.6)

| Dokument | Obaveznost | Nivo | Ko odobrava | Primjer |
|---|---|---|---|---|
| **Policy** (politika) | Obavezna | Visok, strateški: šta i zašto; tehnološki neutralna | Viša uprava | „Svi pristupi poslovnim sistemima zahtijevaju jaku autentifikaciju“ |
| **Standard** | Obavezan | Konkretna, mjerljiva pravila i tehnologije | CISO / komitet | „MFA mora biti FIDO2 ili TOTP; lozinke najmanje 14 znakova“ |
| **Baseline** | Obavezan | Minimalni nivo sigurnosti za tip sistema | Tehnički vlasnici | CIS Benchmark Level 1 za Ubuntu 24.04 |
| **Procedure** | Obavezna | Korak po korak: kako | Vlasnici procesa | „Kako uključiti MFA za novog zaposlenog: koraci 1–7“ |
| **Guideline** (smjernica) | **Preporuka**, neobavezna | Savjet, najbolja praksa | Stručni tim | „Preporučujemo upravljač lozinki“ |

Politika se dalje dijeli na:

| Tip politike | Opis |
|---|---|
| **Organizational / program policy** (krovna) | Uspostavlja program, uloge, ovlašćenja; potpisuje uprava |
| **Issue-specific policy** | Konkretna tema: prihvatljiva upotreba (AUP), e-mail, BYOD, upotreba AI, cloud |
| **System-specific policy** | Pravila za konkretan sistem (npr. ko smije mijenjati konfiguraciju platnog sistema) |

Politike se dijele i po svrsi: **regulatory** (traži ih zakon), **advisory** (opisuje očekivano ponašanje i posljedice), **informative** (informiše, bez obaveze).

### Životni ciklus dokumenata

| Faza | Aktivnosti |
|---|---|
| Razvoj | Procjena rizika i zahtjeva, uključivanje stakeholdera (pravna služba, HR, poslovanje) |
| Odobrenje | Potpis uprave za politike; komitet za standarde |
| Objava i komunikacija | Dostupnost, obuka, potvrda o prihvatanju (acknowledgment) |
| Sprovođenje | Tehničke kontrole, nadzor, sankcije |
| Izuzeci | Formalan **exception process**: obrazloženje, kompenzacione kontrole, vlasnik rizika potpisuje, rok važenja |
| Preispitivanje | Najmanje godišnje i nakon velikih promjena ili incidenata |
| Povlačenje | Arhiviranje zastarjelih verzija, kontrola verzija |

### Scenarij: neusklađen standard

Politika kaže da se osjetljivi podaci šifruju u mirovanju. Standard propisuje AES-256. Novi IoT sistem podržava samo AES-128. Ispravan postupak nije mijenjati politiku ni ignorisati standard, nego formalni **izuzetak** sa procjenom rizika, kompenzacionim kontrolama (segmentacija, nadzor) i rokom, uz potpis vlasnika rizika.

> **Na ispitu:** politika je obavezna, opšta i tehnološki neutralna; standard je obavezan i konkretan; procedura je obavezna i korak po korak; smjernica je jedini **neobavezni** dokument. Ako pitanje traži dokument koji „uprava odobrava i koji daje pravac“, to je politika.

### Primjer lanca dokumenata: lozinke i MFA

| Nivo | Tekst |
|---|---|
| Politika kontrole pristupa | „Pristup informacionim sistemima dozvoljen je samo autentifikovanim i ovlašćenim korisnicima, srazmjerno klasifikaciji podataka.“ |
| Standard za autentifikaciju | „Za udaljeni i privilegovani pristup obavezna je phishing-otporna MFA (FIDO2/WebAuthn); lozinke najmanje 14 znakova, provjera protiv liste kompromitovanih lozinki.“ |
| Baseline | „Entra ID Conditional Access politike CA-01 do CA-07 primijenjene na sve tenant-e.“ |
| Procedura | „Registracija sigurnosnog ključa za novog administratora: identifikacija lično uz ličnu kartu, izdavanje dva ključa, registracija, test, zapis u CMDB.“ |
| Smjernica | „Preporučuje se upravljač lozinki za lične naloge zaposlenih.“ |

Kada se tehnologija promijeni (npr. passkeys), mijenja se standard i procedura, a politika ostaje ista. To je razlog zašto politike moraju biti tehnološki neutralne.

### Hijerarhija i sljedivost

Zakon i poslovni ciljevi → **politika** → **standardi** i **baseline** → **procedure** → konfiguracije i zapisi. Svaka procedura se mora moći povezati sa politikom (sljedivost), a svaka politika sa zahtjevom ili rizikom. Politika bez sprovođenja (enforcement) i mjerenja nema vrijednost za due care.

## Holistički pristup usklađenosti

„Holistic context“ u cilju 1.4 znači da se pravni zahtjevi ne posmatraju izolovano, nego zajedno sa rizikom, ugovorima i poslovnim ciljevima.

| Pitanje | Kako ga rješava holistički program |
|---|---|
| Nova usluga u novoj zemlji | Procjena lokalnih zakona o privatnosti, lokalizacije, izvoza kriptografije i obaveza prijave incidenata prije lansiranja |
| Novi SaaS dobavljač | DPA, SCC za prenos van EEA, pravo na audit, obaveza prijave incidenta u ugovoru |
| Novi AI proizvod | GDPR (automatizovano odlučivanje), EU AI Act klasifikacija, licence za podatke za trening, IP nad izlazom |
| Spajanje sa stranom firmom | Konflikt zakona (npr. CLOUD Act i GDPR), kontrole izvoza tehnologije |

### Uloge u usklađenosti

| Uloga | Doprinos |
|---|---|
| **Legal counsel** | Tumačenje zakona, ugovori, kontakt sa organima |
| **Compliance officer** | Mapiranje zahtjeva na kontrole, praćenje dokaza |
| **DPO** | Nezavisan savjet o zaštiti podataka, kontakt sa nadzornim tijelom |
| **CISO** | Tehničke i organizacione mjere, izvještavanje o riziku |
| **Internal audit** | Nezavisna provjera usklađenosti |

### Pravna odgovornost i odnos prema policiji

| Situacija | Ispravan pristup |
|---|---|
| Policija traži logove bez naloga | Pravna služba procjenjuje zahtjev; podaci se predaju prema zakonu i politici |
| Organizacija razmatra prijavu napada policiji | Uprava odlučuje uz pravnu službu; razmotriti javnost postupka, gubitak kontrole, obaveze prijave |
| Strani regulator traži podatke | Provjeriti nadležnost i konflikt zakona prije predaje |
| Zaposleni je osumnjičen | Postupati po politici, uz HR i pravnu službu; poštovati privatnost i radno pravo |

> **Na ispitu:** pri izboru jurisdikcije, prenosa podataka ili obaveze prijave, BEST je uvijek poštovati **najstroži primjenjivi** zahtjev ili konsultovati pravnu službu, a ne birati „najpovoljniji“ zakon.

## Rezime

- **Kategorije prava**: krivično (država, van razumne sumnje, zatvor), građansko (naknada, pretežnost dokaza), administrativno/regulatorno (agencije, kazne), ugovorno.
- **Kibernetički kriminal**: CFAA, ECPA, Budimpeštanska konvencija, NIS2 (24 h / 72 h), DORA, SOX, GLBA, FISMA.
- **Povrede podataka**: GDPR 72 h nadzornom tijelu, HIPAA do 60 dana, safe harbor za šifrovane podatke; odluku o obavještavanju donosi uprava uz pravnu službu.
- **IP**: copyright (izražaj, automatski), trademark (znak, obnovljiv), patent (20 godina, javno objavljen), trade secret (dok je tajna, uz razumne mjere); work for hire pripada poslodavcu.
- **Licence**: ugovorne, shrink-wrap, click-through, SaaS, open source (permisivne i copyleft); SAM i SBOM.
- **Izvoz/uvoz**: ITAR (vojno), EAR (dual-use, kriptografija), Wassenaar, deemed export.
- **Prekogranični tok**: suverenitet i lokalizacija; adequacy, SCC, BCR; Safe Harbor → Privacy Shield → Data Privacy Framework.
- **Privatnost**: OECD principi, GDPR (4% / 20 mil. EUR), CCPA/CPRA, PIPL, POPIA, HIPAA (PHI, BAA).
- **Istrage**: administrativna, krivična, građanska, regulatorna; eDiscovery i legal hold; lanac nadzora od prvog trenutka.
- **Dokumenti**: politika (obavezna, opšta, uprava), standard i baseline (obavezni, konkretni), procedura (obavezna, koraci), smjernica (neobavezna); izuzeci formalno, uz vlasnika rizika.
