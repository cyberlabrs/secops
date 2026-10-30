## Ciljevi ispita: domen 6 (6.1–6.5)

Domen 6 je **Security Assessment and Testing** i nosi **11,2%** ispita po outlineu iz 2027. (U outlineu iz 2024. 12%.) Ciljevi:

- **6.1 Design and validate assessment, test, and audit strategies**
  - internal (u kontroli organizacije),
  - third-party (van kontrole preduzeća),
  - external (van kontrole organizacije),
  - location (on-premise, cloud, hybrid).
- **6.2 Conduct security controls testing**
  - vulnerability assessment,
  - coverage analysis,
  - penetration testing,
  - interface testing (user interface, network interface, API),
  - log reviews,
  - synthetic transactions/benchmarks,
  - code review and testing,
  - misuse case testing,
  - attack simulations,
  - compliance checks.
- **6.3 Collect security process data (e.g., technical, administrative)**
  - account management,
  - training and awareness,
  - management review and approval,
  - Disaster Recovery (DR) i Business Continuity (BC),
  - key performance and risk indicators,
  - backup verification data.
- **6.4 Analyze test/audit output and generate report**
  - remediation,
  - exception handling,
  - responsible disclosure.
- **6.5 Conduct or facilitate security audits**
  - internal, third-party, external, location (on-premises, cloud, hybrid).

> U outlineu iz 2024. penetration testing ima primjer „red, blue, and/or purple team exercises“, umjesto „attack simulations“ stoji „breach attack simulations“, cilj 6.4 glasi „Analyze test output“ (bez audita), a umjesto „responsible disclosure“ stoji „ethical disclosure“. Ciljevi 6.1, 6.3 i 6.5 su sadržajno isti.

Iz prakse poznaješ skenere, SAST/DAST, pentest izvještaje i SOC 2. CISSP ovdje traži: **ko** testira (interno, eksterno, treća strana), **šta** svaka vrsta testa dokazuje, **kada** se testira, kako se prikupljaju i tumače metrike, i šta menadžer radi sa nalazima (prioritet po riziku, izuzeci, odobrenje uprave).

## Strategija procjene, testiranja i audita (6.1)

### Tri pojma koja se miješaju

| Pojam | Šta je | Ko ga radi | Rezultat |
|---|---|---|---|
| **Test** | provjera da kontrola radi kako je namijenjeno (tehnički, ponovljivo) | tehnički tim, alat | rezultat testa (prošao/pao, nalaz) |
| **Assessment** | šira procjena sigurnosnog stanja, često više testova + intervjui + pregled dokumentacije | interni ili eksterni procjenitelj | procjena rizika i preporuke |
| **Audit** | formalna, nezavisna provjera usklađenosti sa standardom, politikom ili zakonom, uz dokaze | **nezavisni** revizor | mišljenje/izvještaj o usklađenosti |

### Ko testira

Outline razlikuje tri perspektive. Ključ je **ko kontroliše okruženje i ko kontroliše procjenitelja**:

| Vrsta | Definicija iz outlinea | Primjer | Prednost | Ograničenje |
|---|---|---|---|---|
| **Internal** | u kontroli organizacije | interni tim za ranjivosti, interna revizija | poznavanje okruženja, kontinuitet, niža cijena | manja nezavisnost, „slijepe tačke“ |
| **External** | van kontrole organizacije | regulator, certifikaciono tijelo, eksterni revizor koga angažuje treća strana ili zakon | najveća nezavisnost i kredibilitet | organizacija ne određuje obim i vrijeme po volji |
| **Third-party** | van kontrole preduzeća | ti procjenjuješ dobavljača; ili nezavisna firma testira tvoje sisteme po tvom ugovoru; SOC 2 izvještaj provajdera | nezavisnost uz ugovorom definisan obim | zavisi od ugovora, prava na audit i povjerenja u treću stranu |

Na ispitu: **interni** audit izvještava upravu (obično odbor za reviziju) i pomaže poboljšanju; **eksterni** audit služi zainteresovanim stranama izvan organizacije (regulator, investitori, kupci); **third-party** se najčešće odnosi na procjenu dobavljača i lanca snabdijevanja (ili na tuđi izvještaj o dobavljaču na koji se oslanjaš).

### Lokacija

| Lokacija | Specifičnosti |
|---|---|
| **On-premises** | pun pristup, fizički pristup, vlastita pravila angažmana |
| **Cloud** | shared responsibility: testiraš samo ono za šta si odgovoran; **politika provajdera o penetracionom testiranju** (neki traže najavu, neki zabranjuju određene testove, npr. DoS); IaaS daje više mogućnosti od SaaS-a, gdje se oslanjaš na izvještaje provajdera (SOC 2, ISO 27001, CSA STAR) |
| **Hybrid** | testiranje veza i povjerenja između okruženja (federacija, VPN, sinhronizacija), dosljednost kontrola na obje strane, jasne granice obima |

### Dizajn strategije

1. Polazi od **ciljeva poslovanja i procjene rizika** (šta je najvrjednije, šta zakon traži).
2. Definiši **obim** (scope), metode, učestalost, odgovornosti i resurse.
3. Dobij **odobrenje uprave** i, za tehničke testove, pisanu dozvolu i **pravila angažmana** (Rules of Engagement: obim, vrijeme, kontakti, šta je zabranjeno, postupanje sa podacima).
4. **Validiraj** strategiju: da li testovi zaista mjere ono što treba, da li pokrivaju sve kritične kontrole (vidi coverage analysis), da li su rezultati upotrebljivi za odluke.
5. Periodično ažuriraj prema promjenama u prijetnjama, tehnologiji i regulativi.

Standardi i okviri: **NIST SP 800-115** (tehničko testiranje), **NIST SP 800-53A** (procjena kontrola), **NIST SP 800-137** (ISCM, kontinuirani monitoring), **ISO/IEC 27001/27002** i **ISO 19011** (smjernice za audit), **PTES**, **OSSTMM**, **OWASP Testing Guide**.

> **Na ispitu:** prije bilo kakvog tehničkog testa, PRVI korak je **pisano odobrenje uprave** i dogovoreni obim. Test bez dozvole je napad, bez obzira na namjere. Ako je pitanje „ko daje dozvolu za pentest“, odgovor je viša uprava/vlasnik sistema, ne administrator.

## Testiranje sigurnosnih kontrola (6.2)

### Vulnerability assessment vs penetration testing

| Kriterij | Vulnerability assessment | Penetration testing |
|---|---|---|
| Cilj | identifikovati i rangirati poznate ranjivosti | dokazati da se ranjivosti mogu iskoristiti i koliki je uticaj |
| Metoda | automatizovani skeneri, pregled konfiguracije | ručni rad uz alate, lančanje ranjivosti |
| Dubina | široko, plitko | usko, duboko |
| Rizik po sisteme | nizak | veći (može izazvati prekid) |
| Učestalost | redovno (npr. mjesečno, kontinuirano) | periodično (npr. godišnje) i nakon velikih promjena |
| Rezultat | lista ranjivosti sa ocjenom (CVSS) | izvještaj o dokazanim putevima napada i poslovnom uticaju |

Pojmovi kod skeniranja: **credentialed (authenticated)** skeniranje daje tačniju sliku sa manje lažnih pozitiva od **non-credentialed**; **false positive** (prijavljena ranjivost koja ne postoji) troši vrijeme, **false negative** (propuštena ranjivost) je opasniji. Standardi: **SCAP** (zajednički jezik za automatizaciju): **CVE** (identifikator ranjivosti), **CVSS** (ocjena ozbiljnosti 0–10), **CPE** (identifikacija platforme), **CCE** (konfiguracija), **XCCDF** (format checkliste), **OVAL** (jezik za provjeru stanja).

### Faze i vrste penetracionog testa

Faze (NIST SP 800-115): **planning** → **discovery** (izviđanje i skeniranje ranjivosti) → **attack** (pokušaj iskorištavanja, eskalacija, dodatno otkrivanje) → **reporting**. Ostali modeli dodaju reconnaissance, enumeration, post-exploitation i cleanup.

| Znanje testera | Opis | Šta simulira |
|---|---|---|
| **Black box** (zero knowledge) | tester ne zna ništa | spoljnog napadača; najrealnije, najsporije |
| **Gray box** (partial knowledge) | djelimično znanje, npr. korisnički nalog | napadača sa krađom kredencijala ili insidera |
| **White box** (full knowledge, crystal box) | pun pristup dokumentaciji i kodu | najdetaljnije pokrivanje za dato vrijeme |

| Znanje branilaca | Opis |
|---|---|
| **Blind** | tester ne zna ništa; branioci znaju za test |
| **Double-blind** | ni tester ni branioci (SOC) ne znaju detalje; testira i detekciju i odgovor |
| **Targeted** | obje strane znaju, saradnja |

Timovi: **red team** (napad, simulira protivnika), **blue team** (odbrana i detekcija), **purple team** (zajednički rad radi poboljšanja detekcije), **white team** (sudije, pravila, koordinacija). Outline iz 2024. ih eksplicitno navodi uz pentest.

### Attack simulations

**Attack simulations** (u 2024. „breach attack simulations“, BAS) su automatizovane, kontinuirane i bezbjedne simulacije tehnika napadača (npr. mapiranih na MITRE ATT&CK) da bi se provjerilo da li kontrole (EDR, SIEM pravila, DLP, segmentacija) **detektuju i blokiraju** ono što treba. Razlika od pentesta: ponovljivost i učestalost umjesto kreativnosti; mjeri se efikasnost kontrola tokom vremena. U širem smislu ovdje spadaju i red team vježbe, **tabletop** vježbe i **phishing simulacije**.

### Coverage analysis

**Coverage analysis** odgovara na pitanje „koliko od onoga što treba testirati je zaista testirano“. Primjeri:

- **Code coverage** u testiranju softvera: procenat linija (statement), grana (branch), uslova (condition) i funkcija koje su testovi izvršili. Branch coverage je stroži od statement coveragea.
- **Pokrivenost imovine**: koliki procenat imovine iz inventara skenira skener ranjivosti, ima EDR, šalje logove u SIEM.
- **Pokrivenost kontrola**: koje kontrole iz okvira su testirane u periodu; **pokrivenost detekcije** prema ATT&CK tehnikama.

Primjer računa: inventar ima 1.200 servera, skener je u zadnjih 30 dana skenirao 1.020. Pokrivenost = 1.020 / 1.200 = **85%**. Preostalih 15% je nepoznat rizik; prvo se istražuje zašto (nedostupni segmenti, ugašeni hostovi, pogrešan inventar).

### Interface testing

| Interfejs | Šta se testira |
|---|---|
| **User interface** | validacija unosa, poruke o greškama koje ne odaju informacije, kontrola pristupa prema ulozi, ponašanje sesije |
| **Network interface** | otvoreni portovi, protokoli, segmentacija, enkripcija u prenosu |
| **API** | autentifikacija i autorizacija na nivou objekta i funkcije, rate limiting, validacija šeme, curenje podataka, verzionisanje (OWASP API Security Top 10) |
| Physical interface | portovi uređaja, konzole, debug interfejsi |

Interface testing provjerava i **granice između komponenti**: da li modul pravilno postupa sa neočekivanim podacima od drugog modula. Integracijsko testiranje je mjesto gdje se ovo radi.

### Log reviews

Pregled logova otkriva incidente, kršenje politike i nepravilnosti kontrola. Dobra praksa:

- centralizacija u SIEM, sinhronizovano vrijeme (NTP), zaštita integriteta logova (WORM, hash, odvojeni nalozi),
- automatizovana korelacija i alarmi plus periodični ručni pregled kritičnih događaja,
- **clipping level** (prag): bilježi/alarmira tek kada broj događaja pređe prag (npr. 5 neuspjelih prijava), da se smanji šum,
- pregled radi neko ko **nije** administrator posmatranog sistema (SoD),
- retencija prema zakonu i politici.

### Synthetic transactions i benchmarks

**Synthetic transactions** su skriptovane, unaprijed definisane transakcije koje se periodično izvršavaju da se provjeri dostupnost, performanse i funkcionalnost (npr. robot svakih 5 min prolazi kroz prijavu i kupovinu). Suprotnost je **Real User Monitoring (RUM)**, pasivno praćenje stvarnih korisnika. Synthetic testovi otkrivaju problem i kada nema korisnika (noću), a RUM pokazuje stvarno iskustvo.

**Benchmarks** su referentne vrijednosti: performansne (baseline za poređenje) ili sigurnosne konfiguracije (**CIS Benchmarks**, DISA STIG) prema kojima se mjeri odstupanje.

### Code review i testiranje

| Metoda | Opis | Kada |
|---|---|---|
| **Manual code review / peer review** | ljudi čitaju kod, nalaze logičke greške | prije spajanja koda |
| **Fagan inspection** | formalni, najrigorozniji pregled: planning, overview, preparation, inspection, rework, follow-up | kritičan softver |
| **SAST** (static) | analiza izvornog koda bez izvršavanja | rano u SDLC-u, u IDE i CI |
| **DAST** (dynamic) | testiranje aplikacije koja radi, spolja | test/staging okruženje |
| **IAST** | agent unutar aplikacije tokom testova | kombinuje prednosti |
| **SCA** | analiza komponenti i biblioteka trećih strana | stalno |
| **Fuzzing** | slanje nevalidnih, slučajnih ili mutiranih ulaza: **mutation (dumb)** mijenja postojeće ulaze, **generation (intelligent)** gradi ulaze iz modela protokola | otkrivanje padova i grešaka pri obradi ulaza |
| **Unit / integration / regression / acceptance** | funkcionalno testiranje na različitim nivoima | kroz SDLC |

**Static** testiranje ne izvršava kod, **dynamic** ga izvršava. **Positive** testovi provjeravaju očekivano ponašanje, **negative** testovi neispravne ulaze.

### Misuse case testing

**Use case** opisuje kako legitimni korisnik koristi sistem. **Misuse case** (abuse case) opisuje kako bi ga zlonamjeran akter zloupotrijebio, npr. „kupac mijenja cijenu u zahtjevu“, „korisnik pristupa tuđoj narudžbi mijenjanjem ID-a“. Testovi se pišu da potvrde da sistem odbija takvo ponašanje. Proizlaze iz modeliranja prijetnji (STRIDE) i poslovne logike, koju automatski skeneri ne razumiju.

### Compliance checks

Provjera da su sistemi podešeni prema politici, standardu ili zakonu: automatizovane provjere konfiguracije (SCAP, CIS, cloud posture management), provjera PCI DSS, HIPAA ili interne baseline konfiguracije. Kontinuirane provjere usklađenosti su dio **ISCM** (Information Security Continuous Monitoring).

> **Na ispitu:** razlikuj šta svaki test dokazuje. Skener **identifikuje** ranjivost; pentest **dokazuje** iskoristivost i uticaj; synthetic transaction provjerava **dostupnost i funkciju**; misuse case provjerava **otpornost na zloupotrebu poslovne logike**; coverage analysis mjeri **koliko je testirano**. Ako pitanje traži „najmanje ometajuć način da se redovno nađu poznate ranjivosti“, to je credentialed vulnerability scan, ne pentest.

## Prikupljanje podataka o sigurnosnim procesima (6.3)

Tehnički testovi provjeravaju kontrole; podaci o procesima pokazuju da li **program** radi. Outline navodi tehničke i administrativne podatke:

| Oblast | Primjeri podataka |
|---|---|
| **Account management** | broj naloga koji su ugašeni u roku nakon odlaska, broj orphan naloga, procenat završenih recertifikacija, broj privilegovanih naloga, vrijeme od zahtjeva do provisioninga |
| **Training and awareness** | procenat zaposlenih koji su završili obuku, rezultati testova, stopa klikova i stopa prijave u phishing simulacijama, trend kroz vrijeme |
| **Management review and approval** | zapisnici pregleda uprave (ISO 27001 klauzula 9.3), odobrene politike i izuzeci, odluke o prihvatanju rizika, praćenje akcija |
| **DR i BC** | rezultati testova (tabletop, walkthrough, simulacija, paralelni, full interruption), postignuti RTO/RPO naspram ciljanih, ažurnost planova, broj obučenih članova tima |
| **KPI i KRI** | vidi ispod |
| **Backup verification data** | procenat uspješnih backup poslova, rezultati **testova restauracije**, provjera integriteta, vrijeme restauracije, offline/immutable kopije |

### KPI vs KRI

| | **KPI** (Key Performance Indicator) | **KRI** (Key Risk Indicator) |
|---|---|---|
| Pitanje | koliko dobro radimo? (u prošlosti) | koliko raste rizik? (rani upozoravajući signal) |
| Primjer | 95% kritičnih zakrpa primijenjeno u roku od 14 dana; MTTD i MTTR incidenata | broj sistema na nepodržanom OS-u raste; rast neuspjelih prijava sa novih lokacija; broj otvorenih kritičnih nalaza starijih od 90 dana |
| Veza | mjeri efikasnost procesa i kontrola | vezan za **sklonost riziku** (risk appetite) i pragove koji pokreću eskalaciju |

Dobra metrika je **SMART** (specific, measurable, achievable, relevant, time-bound), ima vlasnika, izvor podataka i ciljnu vrijednost. Metrike za upravu se izražavaju u poslovnim terminima (trend, rizik, uticaj), ne u sirovim brojevima ranjivosti.

Primjer KRI-ja sa pragom: „procenat endpointa bez EDR-a“; zelena < 2%, žuta 2–5%, crvena > 5% (eskalacija CISO-u). Ako je od 4.000 endpointa 260 bez agenta, vrijednost je 6,5%, crveno, pa se rizik eskalira.

### Backup verification

Backup koji nije restauriran nije dokazan. Podaci koje treba prikupljati: uspješnost poslova, **periodični testovi restauracije** (pojedinačni fajl, cijeli sistem, cijeli sajt), poređenje hash vrijednosti, mjereno vrijeme oporavka naspram RTO-a, starost posljednje dobre kopije naspram RPO-a, postojanje izolovane kopije otporne na ransomware (pravilo **3-2-1**, ili 3-2-1-1-0: jedna offline/immutable, nula grešaka pri verifikaciji).

> **Na ispitu:** „najbolji dokaz da backup proces radi“ je **uspješan test restauracije**, ne log o uspješnom backupu. Isto tako, najbolji dokaz efikasnosti obuke nije procenat prisustva nego promjena ponašanja (npr. pad stope klikova i rast prijava u phishing simulacijama).

## Analiza rezultata i izvještavanje (6.4)

### Od nalaza do izvještaja

1. **Validacija**: potvrditi nalaze, ukloniti lažne pozitive.
2. **Prioritizacija po riziku**: ozbiljnost (CVSS) + vjerovatnoća iskorištavanja (npr. EPSS, KEV lista) + vrijednost i izloženost imovine + postojeće kompenzacione kontrole. Kritična ranjivost na izolovanom test sistemu može biti manji prioritet od srednje na javno izloženom sistemu sa ličnim podacima.
3. **Izvještaj prilagođen publici**: **executive summary** za upravu (poslovni rizik, trend, preporuke, potrebne odluke), tehnički dio za timove (detalji, dokazi, koraci za reprodukciju u kontrolisanom okruženju, preporuke za popravku), metodologija i obim.
4. Izvještaj o ranjivostima je **osjetljiv dokument** i klasifikuje se i distribuira po need to know.

### Remediation

- Plan sanacije sa **vlasnikom**, rokom (SLA po ozbiljnosti, npr. kritično 7–15 dana) i praćenjem (**POA&M**, Plan of Action and Milestones).
- Popravka uzroka, ne samo simptoma (npr. ispraviti proces upravljanja zakrpama, a ne samo jednu zakrpu).
- **Verifikacija** popravke ponovnim testom (retest).
- Popravke prolaze kroz **change management**.

### Exception handling

Kada se nalaz ne može otkloniti (poslovni razlog, legacy sistem, trošak veći od koristi):

- formalni zahtjev za izuzetak sa obrazloženjem i procjenom rizika,
- **kompenzacione kontrole** (segmentacija, pojačan monitoring),
- odobrenje od **vlasnika rizika** na odgovarajućem nivou uprave (ne od tehničara),
- **rok važenja** izuzetka i periodično preispitivanje,
- evidencija u registru rizika.

Izuzetak je oblik **prihvatanja rizika**; nikad ne smije biti trajan i neevidentiran.

### Responsible disclosure

**Responsible disclosure** (u outlineu iz 2024. **ethical disclosure**; sinonim je **coordinated vulnerability disclosure**, CVD) je postupak kada istraživač ili organizacija otkrije ranjivost u tuđem proizvodu ili sistemu:

| Model | Opis | Ocjena |
|---|---|---|
| **Responsible / coordinated** | privatno obavještavanje proizvođača, razuman rok za popravku (često 90 dana), zatim javna objava, po potrebi uz koordinatora (CERT/CSIRT) | preporučen; balansira zaštitu korisnika i pritisak na popravku |
| **Full disclosure** | odmah javno objaviti sve detalje | ugrožava korisnike prije zakrpe |
| **Non-disclosure** | ne objaviti nikad | ranjivost ostaje, korisnici ne znaju za rizik |

Sa strane organizacije: objavljena **politika otkrivanja ranjivosti (VDP)**, kontakt (npr. `security.txt`), safe harbor za istraživače koji poštuju pravila, eventualni **bug bounty** program, interna obrada prijava, dodjela CVE-a. ISO/IEC 29147 (disclosure) i ISO/IEC 30111 (obrada ranjivosti) su referentni standardi. Etički kodeks ISC2 (zaštita društva, časno i zakonito djelovanje) vodi ponašanje profesionalca.

> **Na ispitu:** ako tokom testa kod klijenta nađeš ranjivost u proizvodu treće strane, ne objavljuješ je javno i ne ignorišeš je: obavještavaš klijenta prema ugovoru i proizvođača kroz koordinisani postupak. Ako tokom pentesta naiđeš na dokaz da je sistem već kompromitovan ili na nezakonit sadržaj, zaustavljaš se i odmah obavještavaš kontakt iz pravila angažmana.

## Sigurnosni auditi (6.5)

### Vrste audita

| Vrsta | Ko radi | Kome izvještava | Primjer |
|---|---|---|---|
| **Internal** | interna revizija organizacije (nezavisna od IT-a, izvještava odbor za reviziju) | uprava, odbor | godišnji plan interne revizije IT kontrola |
| **External** | nezavisni revizor van organizacije, često po zakonu ili za certifikaciju | dioničari, regulator, certifikaciono tijelo | revizija finansijskih izvještaja (SOX), ISO 27001 certifikacija, PCI DSS QSA |
| **Third-party** | organizacija (ili angažovani revizor) procjenjuje dobavljača; ili se oslanja na izvještaj nezavisnog revizora o dobavljaču | tebi, kao korisniku usluge | audit cloud provajdera na osnovu prava na audit u ugovoru, pregled SOC 2 Type II izvještaja |

**Facilitate** (olakšati) audit znači: pripremiti dokaze, obezbijediti pristup ljudima i sistemima, odrediti kontakt osobu, voditi računa o obimu, i pratiti nalaze do zatvaranja.

### SOC izvještaji (SSAE 18 / ISAE 3402)

| Izvještaj | Sadržaj | Publika |
|---|---|---|
| **SOC 1** | kontrole relevantne za **finansijsko izvještavanje** korisnika | revizori i finansije korisnika |
| **SOC 2** | kontrole po **Trust Services Criteria** (security, availability, processing integrity, confidentiality, privacy) | korisnici, uz NDA (ograničena distribucija) |
| **SOC 3** | sažetak SOC 2 bez detalja | javnost, marketing |
| **Type I** | dizajn kontrola **u jednom trenutku** | — |
| **Type II** | dizajn **i operativna efikasnost** tokom perioda (obično 6–12 mjeseci) | jači dokaz |

Pri korištenju tuđeg SOC 2 izvještaja provjeri: period koji pokriva, obim (koje usluge i lokacije), mišljenje revizora (bez rezervi ili sa izuzecima), izuzetke u testiranju, **complementary user entity controls** (CUEC, kontrole koje ti moraš imati da bi kontrole provajdera bile efikasne) i podugovarače (carve-out vs inclusive).

### Proces audita

1. **Planiranje**: ciljevi, obim, kriteriji (standard, politika), tim, raspored; nezavisnost revizora.
2. **Prikupljanje dokaza**: intervjui, pregled dokumentacije, posmatranje, ponovno izvođenje (re-performance), **uzorkovanje** (statističko ili prosuđivanjem).
3. **Analiza i nalazi**: svaki nalaz ima uslov (šta je), kriterij (šta treba), uzrok, posljedicu i preporuku.
4. **Izvještaj** i odgovor uprave (management response) sa planom akcija.
5. **Praćenje** (follow-up) do zatvaranja.

### Lokacija audita

- **On-premises**: fizički pregled, direktan pristup sistemima.
- **Cloud**: pravo na audit je ograničeno; provajderi rijetko dozvoljavaju pojedinačne fizičke audite, pa se koriste **atestacije trećih strana** (SOC 2, ISO 27001, CSA STAR, FedRAMP), uz provjeru tvog dijela shared responsibility modela (konfiguracija, IAM, podaci).
- **Hybrid**: kombinacija, s naglaskom na granice i dosljednost kontrola između okruženja.

> **Na ispitu:** kada ne možeš sam auditovati cloud provajdera, NAJBOLJI izbor je pregled nezavisnog **SOC 2 Type II** izvještaja (ili ISO 27001 certifikata sa izjavom o primjenjivosti) i provjera CUEC-a, ne slanje vlastitih revizora u njegov data centar. Type II je jači dokaz od Type I jer pokazuje rad kontrola kroz vrijeme.

## Kontinuirani monitoring i dodatni alati za procjenu

### ISCM po NIST SP 800-137

**Information Security Continuous Monitoring** povezuje testove iz 6.2 i metrike iz 6.3 u stalan proces:

| Korak | Sadržaj |
|---|---|
| 1. **Define** | strategija zasnovana na riziku i toleranciji rizika |
| 2. **Establish** | program: metrike, učestalost monitoringa i procjena, arhitektura |
| 3. **Implement** | prikupljanje podataka, automatizacija gdje je moguće |
| 4. **Analyze / Report** | analiza i izvještavanje o nalazima |
| 5. **Respond** | odgovor: sanacija, prihvatanje, izbjegavanje, prenos rizika |
| 6. **Review / Update** | preispitivanje i poboljšanje programa |

### Vrste testova DR/BC plana (izvor podataka za 6.3)

| Test | Opis | Uticaj na poslovanje |
|---|---|---|
| **Read-through / checklist** | članovi tima pregledaju plan | nikakav |
| **Walkthrough / tabletop** | grupna diskusija scenarija korak po korak | nikakav |
| **Simulation** | simulirani događaj, tim izvodi postupke bez prebacivanja produkcije | minimalan |
| **Parallel** | sistemi se podižu na alternativnoj lokaciji, produkcija radi normalno | mali |
| **Full interruption** | produkcija se stvarno gasi i prebacuje | najveći rizik; rijetko i uz odobrenje uprave |

### Dokazi u auditu

| Vrsta dokaza | Primjer | Snaga |
|---|---|---|
| **Re-performance** | revizor sam ponavlja kontrolu (npr. pokušava pristup sa ugašenim nalogom) | najjača |
| **Inspection** | pregled zapisa, konfiguracije, logova | jaka |
| **Observation** | posmatranje izvršenja procesa | srednja (ljudi se ponašaju bolje kada su posmatrani) |
| **Inquiry** | intervju, izjava | najslabija sama za sebe; mora se potkrijepiti |

Dokaz koji revizor sam prikupi jači je od dokaza koji mu preda auditirana strana; dokaz iz nezavisnog izvora jači je od internog.

### Primjer prioritizacije nalaza

| Nalaz | CVSS | Izloženost | Podaci | Iskorištava se u praksi | Prioritet |
|---|---|---|---|---|---|
| A: RCE na internom test serveru bez podataka | 9,8 | interno, izolovan segment | nema | da | visok, ali iza B |
| B: zaobilaženje autentifikacije na javnom portalu sa ličnim podacima | 8,1 | internet | lični podaci | da (na KEV listi) | **najviši** |
| C: zastarjela TLS verzija na internom API-ju | 5,3 | interno | interni | ne | srednji/nizak |

CVSS mjeri tehničku ozbiljnost; **rizik** dodaje vjerovatnoću i poslovni uticaj u tvom okruženju. Zato B ide ispred A uprkos nižem CVSS-u.

> **Na ispitu:** kada pitanje traži koju ranjivost PRVO sanirati, ne biraj automatski najviši CVSS. Gledaj izloženost, vrijednost imovine i podatke, aktivno iskorištavanje i postojeće kontrole. Ispravan odgovor je onaj sa najvećim **rizikom za poslovanje**.

## Scenariji

**Scenario 1.** Uprava pita da li su kontrole efikasne. CISO ima mjesečne izvještaje skenera sa 14.000 ranjivosti. Ispravan odgovor nije slati listu, nego izvještaj sa trendom kritičnih nalaza na kritičnoj imovini, pokrivenošću skeniranja, poštovanjem SLA za sanaciju (KPI) i rastućim rizicima (KRI), uz odluke koje se traže od uprave.

**Scenario 2.** Pentest je pronašao kritičnu ranjivost u legacy sistemu za proizvodnju koji se ne može zakrpiti dvije godine. Ispravan postupak: procjena rizika, kompenzacione kontrole (izolacija segmenta, allowlist pristupa, monitoring), formalni izuzetak koji odobrava vlasnik rizika, rok i periodično preispitivanje, plan zamjene.

**Scenario 3.** Kompanija prelazi na SaaS ERP i revizor traži dokaz kontrola provajdera. Organizacija pribavlja SOC 1 Type II (finansijsko izvještavanje) i SOC 2 Type II (sigurnost i dostupnost), provjerava period, izuzetke i CUEC, i dokumentuje sopstvene kontrole (pristup, konfiguracija, revizija korisnika).

## Rezime

- Test (radi li kontrola), assessment (šira procjena), audit (formalna nezavisna provjera usklađenosti).
- Internal (u kontroli organizacije), external (van kontrole organizacije, najveća nezavisnost), third-party (van kontrole preduzeća, dobavljači i nezavisni procjenitelji po ugovoru); lokacija mijenja šta smiješ testirati (cloud politike provajdera, shared responsibility).
- Strategija polazi od rizika i ciljeva, traži pisano odobrenje uprave i pravila angažmana, i mora biti validirana (coverage).
- Vulnerability assessment (široko, identifikuje) vs pentest (duboko, dokazuje); black/gray/white box; blind i double-blind; red, blue, purple, white tim; attack simulations (BAS) kontinuirano mjere detekciju.
- Coverage analysis (kod, imovina, kontrole), interface testing (UI, mreža, API), log review (SIEM, clipping level, SoD), synthetic transactions vs RUM, benchmarks (CIS), code review (Fagan, SAST, DAST, IAST, SCA, fuzzing), misuse cases, compliance checks (SCAP).
- 6.3: podaci o nalozima, obuci, pregledu uprave, DR/BC testovima, KPI (učinak) i KRI (rani signal rizika), backup verifikacija kroz test restauracije.
- 6.4: validacija i prioritet po riziku, izvještaj prilagođen publici, remediation sa vlasnikom, rokom i retestom, izuzeci sa kompenzacionim kontrolama, odobrenjem vlasnika rizika i rokom, responsible (coordinated) disclosure.
- 6.5: interni, eksterni i third-party audit; SOC 1/2/3, Type I vs Type II, CUEC; proces audita od planiranja do follow-upa; u cloudu se oslanjaš na atestacije.
