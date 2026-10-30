## Ciljevi ispita: 6.1 i 6.2

Domen 6 (**Legal, Risk and Compliance**) nosi 13% ispita. Ovaj modul pokriva prva dva cilja:

- **6.1 Articulate legal requirements and unique risks within the cloud environment**: sukobljeno međunarodno zakonodavstvo (conflicting international legislation), procjena pravnih rizika specifičnih za cloud (evaluation of legal risks specific to cloud computing), pravni i regulatorni okviri i smjernice (legal and regulatory frameworks and guidelines), zahtjevi forenzike (CSA, ISO/IEC 27037:2012, 27041:2015, 27042:2015, 27043:2015) i eDiscovery (ISO/IEC 27050, CSA Guidance),
- **6.2 Understand privacy requirements**: razlika između ugovorno i zakonski zaštićenih privatnih podataka (contractual vs regulated private data, npr. PHI, PII), zakoni pojedinih država (FERPA, PIPEDA, GDPR, HIPAA, indijski Digital Personal Data Protection Act), razlike u nadležnostima (jurisdictional differences), standardni zahtjevi privatnosti (ISO/IEC 27018, GAPP, GDPR) i procjene uticaja na privatnost (Privacy Impact Assessments, PIA).

CCSP ne traži da budeš pravnik. Traži da prepoznaš **koji zakon važi, ko je odgovoran i šta menadžer treba uraditi**: angažovati pravnu službu, uraditi procjenu, ugovorom prenijeti obaveze, izabrati lokaciju podataka.

> **Na ispitu:** kada se u pitanju pojavi pravni sukob ili nejasna obaveza, odgovor „konsultovati pravnu službu (legal counsel)“ je vrlo često NAJBOLJI prvi korak. Security profesionalac identifikuje rizik, ali ne tumači zakon sam.

## Osnovni pravni pojmovi

| Pojam | Značenje | Cloud primjer |
|---|---|---|
| **Krivično pravo (criminal law)** | Država goni djela protiv društva; kazne zatvora i novčane kazne | Neovlašten pristup računarskom sistemu |
| **Građansko pravo (civil law / tort)** | Sporovi između stranaka, naknada štete | Tužba korisnika zbog curenja podataka |
| **Ugovorno pravo (contract law)** | Obaveze iz ugovora; kršenje = breach of contract | CSP ne ispuni SLA ili ugovorne sigurnosne obaveze |
| **Upravno / regulatorno pravo (administrative law)** | Pravila koja donose i provode regulatori | Kazna nadzornog organa po GDPR-u |
| **Common law** | Precedenti sudova (SAD, UK, Kanada, Australija) | Sudska praksa o eDiscoveryju |
| **Civil (kontinentalno) pravo** | Kodifikovani zakoni (većina Evrope, uključujući region) | Zakon o zaštiti podataka o ličnosti |
| **Jurisdiction (nadležnost)** | Koji sud i čiji zakon važi | Podaci EU građana kod US provajdera u regionu Frankfurt |
| **Data sovereignty / data residency / data localization** | Podaci podliježu zakonima države gdje se nalaze / gdje se fizički čuvaju / zakonska obaveza čuvanja u državi | Zakonska obaveza da podaci određenog sektora ostanu u zemlji |

## Sukobljeno međunarodno zakonodavstvo (6.1)

Cloud podatke lako premješta preko granica, a zakoni ostaju nacionalni. Tipični sukobi:

| Sukob | Opis |
|---|---|
| **US CLOUD Act (2018) vs GDPR** | CLOUD Act omogućava US vlastima da traže od US provajdera podatke koje kontroliše, bez obzira gdje su fizički. GDPR čl. 48 kaže da presuda ili odluka treće zemlje nije sama po sebi osnov za prenos, osim preko međunarodnog sporazuma (npr. MLAT). Provajder može biti uhvaćen između dvije obaveze. |
| **Data localization zakoni** | Neke države (npr. Kina, Rusija, za određene podatke i druge) traže da podaci ostanu u zemlji, što sudara globalnu arhitekturu. |
| **Pravo na brisanje vs obaveza čuvanja** | GDPR pravo na brisanje vs zakonska retencija (porezni, finansijski, AML propisi) ili legal hold u sporu u drugoj državi. |
| **eDiscovery vs zaštita podataka** | US sud traži širok export dokumenata, a EU zakon ograničava prenos ličnih podataka. |
| **Blocking statutes** | Neke države zabranjuju davanje podataka stranim sudovima bez domaćeg odobrenja. |
| **Različite definicije ličnog podatka i povrede** | Isti incident je prijavljiv u jednoj, a nije u drugoj državi. |

Kako menadžer upravlja sukobom:

1. **Mapirati podatke** (gdje su, čiji su, koje kategorije, koje države).
2. **Uključiti pravnu službu** i, gdje treba, lokalne savjetnike.
3. **Izabrati lokaciju** (regione) i provajdera u skladu sa obavezama; koristiti suverene cloud ponude gdje je potrebno.
4. **Ugovorom** regulisati postupanje sa zahtjevima vlasti, podizvođače i lokaciju.
5. **Tehničke mjere**: šifrovanje sa ključevima pod kontrolom korisnika (BYOK/HYOK, eksterni HSM), pseudonimizacija.

> **Na ispitu:** šifrovanje ključevima koje drži korisnik ne mijenja koji zakon važi, ali smanjuje praktični rizik da provajder preda čitljive podatke. Lokacija podataka bira se prema **zakonskim zahtjevima**, a tek onda prema cijeni i latenciji.

## Procjena pravnih rizika specifičnih za cloud (6.1)

| Rizik | Opis | Ublažavanje |
|---|---|---|
| **Nepoznata ili promjenljiva lokacija podataka** | Replikacija, backup i podrška iz drugih zemalja | Ugovorna lokacija, izbor regiona, data residency kontrole |
| **Podizvođači (subprocessors)** | CSP koristi treće strane koje korisnik ne bira | Lista podizvođača, pravo prigovora, flow-down obaveza |
| **Zahtjevi vlasti** | Subpoena, nalog, CLOUD Act, gag order | Ugovor o transparentnosti, šifrovanje, transparency report CSP-a |
| **eDiscovery i legal hold** | Teško naći i sačuvati podatke u multitenant okruženju | Alati za legal hold, ugovorna saradnja |
| **Zaplijena opreme** | Policija oduzima hardver zbog drugog tenanta | Geografska redundantnost, ugovor, izbor ozbiljnog CSP-a |
| **Stečaj ili prestanak rada provajdera** | Pristup podacima i vlasništvo | Klauzule o povratu podataka, escrow, exit plan |
| **Odgovornost i ograničenje odgovornosti** | CSP ugovorom ograničava naknadu štete | Pregovaranje, cyber osiguranje |
| **Neusklađenost sa sektorskim propisima** | Provajder nema potrebne certifikate | Due diligence, izvještaji (SOC 2, ISO 27001, PCI DSS AOC) |
| **AI servisi** | Korištenje unesenih podataka za treniranje, intelektualna svojina, AI regulativa | Ugovorna zabrana treniranja na podacima korisnika, procjena po EU AI Act |

## Pravni i regulatorni okviri i smjernice (6.1)

### Evropska unija

| Akt | Ključno za cloud |
|---|---|
| **GDPR** (Uredba (EU) 2016/679) | Zaštita ličnih podataka, primjena od 25. 5. 2018, ekstrateritorijalno (čl. 3); detaljno u 6.2 |
| **NIS2** (Direktiva (EU) 2022/2555) | Sajber sigurnost „essential“ i „important“ subjekata, uključujući cloud provajdere, data centre i managed (security) service provajdere; upravljanje rizikom, sigurnost lanca snabdijevanja, odgovornost uprave; prijava značajnih incidenata: rano upozorenje 24 h, obavještenje 72 h, završni izvještaj u roku od mjesec dana |
| **DORA** (Uredba (EU) 2022/2554) | Digitalna operativna otpornost finansijskog sektora, primjena od 17. 1. 2025; upravljanje ICT rizikom, prijava velikih ICT incidenata, testiranje otpornosti (uključujući TLPT), upravljanje rizikom ICT trećih strana sa obaveznim ugovornim odredbama, direktan nadzor EU nad kritičnim ICT provajderima (CTPP), među kojima su veliki cloud provajderi |
| **EU AI Act** (Uredba (EU) 2024/1689) | Pristup zasnovan na riziku: zabranjene prakse (od 2. 2. 2025), obaveze za general-purpose AI modele (od 2. 8. 2025), visokorizični sistemi: rokove je pomjerio „AI Omnibus“ (Uredba (EU) 2026/1744, na snazi od 27. 7. 2026) — samostalni sistemi iz Aneksa III od 2. 12. 2027, sistemi ugrađeni u proizvode iz Aneksa I od 2. 8. 2028; uloge provider i deployer |
| **EU Data Act** (Uredba (EU) 2023/2854) | Primjena od 12. 9. 2025; između ostalog olakšava promjenu cloud provajdera (switching), postepeno ukida naknade za prelazak i traži zaštitu od nezakonitog pristupa vlasti trećih zemalja ne-ličnim podacima |
| **Cyber Resilience Act** (Uredba (EU) 2024/2847) | Sigurnosni zahtjevi za proizvode sa digitalnim elementima, obaveze prijave aktivno iskorištavanih ranjivosti, puna primjena postepeno do kraja 2027 |
| **eIDAS 2** | Elektronska identifikacija i usluge povjerenja, EU digitalni novčanik |

### SAD i ostali

| Propis | Oblast |
|---|---|
| **HIPAA** / **HITECH** | Zdravstveni podaci (PHI); cloud provajder koji obrađuje ePHI je business associate i potpisuje **BAA** |
| **GLBA** | Finansijske institucije, privatnost i zaštita podataka klijenata |
| **SOX** (Sarbanes-Oxley, 2002) | Integritet finansijskog izvještavanja javnih kompanija, interne kontrole (ICFR) |
| **FERPA** | Obrazovni zapisi učenika i studenata |
| **COPPA** | Djeca mlađa od 13 godina online |
| **CCPA / CPRA** | Kalifornija, prava potrošača |
| **SEC pravila o sajber incidentima** (2023) | Javne kompanije objavljuju materijalne incidente (Form 8-K, u roku od četiri radna dana od utvrđivanja materijalnosti) |
| **FedRAMP** | Autorizacija cloud usluga za US federalne agencije |
| **PCI DSS** (v4.0.1) | Industrijski standard za kartične podatke, ugovorna (ne zakonska) obaveza |

### Smjernice i okviri koji nisu zakon

- **OECD Privacy Guidelines** (1980, revizija 2013): osam principa (collection limitation, data quality, purpose specification, use limitation, security safeguards, openness, individual participation, accountability), osnova većine zakona o privatnosti.
- **APEC Privacy Framework** i **Cross-Border Privacy Rules (CBPR)**, danas i Global CBPR Forum.
- **CSA Security Guidance** i **Cloud Controls Matrix (CCM)**, **ENISA** smjernice, **NIST** publikacije.

> **Na ispitu:** razlikuj zakon (obavezan, sankcija države), regulativu (obavezna pravila regulatora), ugovornu obavezu (npr. PCI DSS, obaveza prema kartičnim kućama) i standard/smjernicu (dobrovoljno, dok se ne ugovori ili ne propiše). Pitanje „šta je obavezno“ traži tu razliku.

## Zahtjevi forenzike: standardi (6.1)

Operativni dio forenzike je u modulu 12. Ovdje su standardi koje outline eksplicitno navodi:

| Standard | Naziv / sadržaj | Ključna poruka |
|---|---|---|
| **ISO/IEC 27037:2012** | Smjernice za identifikaciju, prikupljanje (collection), akviziciju i očuvanje digitalnih dokaza | Četiri aktivnosti rukovanja dokazima; principi: relevantnost, pouzdanost, dovoljnost; uloge DEFR (Digital Evidence First Responder) i DES (Digital Evidence Specialist) |
| **ISO/IEC 27041:2015** | Smjernice za osiguranje prikladnosti i adekvatnosti istražne metode | Metode i alati moraju biti validirani: dokazivo da rade ono što tvrde |
| **ISO/IEC 27042:2015** | Smjernice za analizu i interpretaciju digitalnih dokaza | Analiza mora biti ponovljiva, a zaključci objašnjivi; kompetentnost istražitelja |
| **ISO/IEC 27043:2015** | Principi i procesi istrage incidenta | Krovni model procesa istrage: readiness, initialization, acquisitive, investigative, uz paralelne procese |
| **CSA** | CSA Security Guidance (domen incident response) i rad „Mapping the Forensic Standard ISO/IEC 27037 to Cloud Computing“ | Kako primijeniti klasične standarde kad nema fizičkog pristupa; potreba za ugovornom saradnjom CSP-a |

Kako se standardi uklapaju: **27043** je okvir cijele istrage, **27037** pokriva rukovanje dokazima na početku, **27042** analizu i interpretaciju, a **27041** osigurava da su metode u svim fazama validne. Za eDiscovery se nastavlja **27050**.

Cloud izazovi koje standardi ističu: zaplijena fizičkog medija nije moguća, dokazi su raspoređeni po jurisdikcijama, a provajder je nužni učesnik. Zato ugovor treba sadržati: koje logove CSP čuva i koliko, rokove odgovora, način predaje dokaza i očuvanje lanca nadzora na strani CSP-a.

## eDiscovery (6.1)

**eDiscovery** je proces identifikovanja, očuvanja, prikupljanja, obrade, pregleda i predaje elektronski pohranjenih informacija (**ESI**, electronically stored information) u sudskom ili regulatornom postupku. Najrazvijeniji je u SAD (Federal Rules of Civil Procedure), ali se tiče svakog ko ima podatke u cloudu.

### EDRM model

**Electronic Discovery Reference Model** je de facto standardni prikaz faza:

| Faza | Šta se radi |
|---|---|
| Information Governance | Uređeno upravljanje informacijama prije spora (klasifikacija, retencija) |
| Identification | Pronalaženje potencijalno relevantnih ESI i čuvara (custodians) |
| Preservation | Očuvanje od izmjene i brisanja (**legal hold**) |
| Collection | Prikupljanje ESI uz očuvanje metapodataka |
| Processing | Smanjenje obima (deduplikacija, filtriranje), konverzija |
| Review | Pregled relevantnosti i privilegovanosti (npr. komunikacija sa advokatom) |
| Analysis | Obrasci, vremenske linije, ključne teme |
| Production | Predaja drugoj strani u dogovorenom formatu |
| Presentation | Prikaz pred sudom |

### ISO/IEC 27050

| Dio | Sadržaj |
|---|---|
| **27050-1** | Pregled i koncepti (terminologija, proces) |
| **27050-2** | Smjernice za upravljanje (governance and management) eDiscoveryjem |
| **27050-3** | Kodeks prakse za eDiscovery (kako izvesti aktivnosti) |
| **27050-4** | Tehnička spremnost (technical readiness), priprema sistema prije zahtjeva |

### eDiscovery u cloudu

- **SaaS**: provajderi nude ugrađene eDiscovery i legal hold alate (npr. Microsoft Purview eDiscovery, Google Vault). Korisnik mora znati njihove mogućnosti i ograničenja.
- **IaaS/PaaS**: korisnik sam pretražuje i exportuje, ali mora pokriti sve lokacije (bucketi, baze, backupi, logovi).
- **Treća strana**: specijalizovane eDiscovery firme; ugovor i NDA, pitanje lokacije podataka.
- **Izazovi**: lociranje podataka, multitenancy (ne smiju se otkriti tuđi podaci), troškovi egressa, nadležnost, čuvanje metapodataka, vremenski rokovi suda.
- **CSA Guidance** naglašava: unaprijed ugovoriti mogućnost eDiscoveryja i legal holda, dostupnost podataka u upotrebljivom formatu i saradnju provajdera.

> **Na ispitu:** čim se spor **razumno očekuje**, nastaje obaveza očuvanja. Ispravan prvi korak je **legal hold** nad relevantnim podacima (obustava brisanja), a ne masovni export svega ili čekanje sudskog naloga.

## Privatnost: ugovorni vs regulisani podaci (6.2)

| | **Regulated private data** | **Contractual private data** |
|---|---|---|
| Izvor obaveze | Zakon ili propis | Ugovor (npr. sa klijentom, partnerom, kartičnim brendovima) |
| Primjer | PHI po HIPAA-i, lični podaci po GDPR-u, obrazovni zapisi po FERPA-i | Podaci kartica po PCI DSS-u, podaci klijenta zaštićeni NDA-om, poslovni podaci partnera |
| Sankcija | Kazne regulatora, krivična odgovornost | Ugovorna kazna, raskid, naknada štete, gubitak prava na prihvatanje kartica |
| Mogu li se strane dogovoriti drugačije | Ne (zakon ima prednost) | Da, u granicama zakona |

Isti podatak može biti oboje: ime i broj kartice klijenta u EU je lični podatak po GDPR-u (regulisan) i kartični podatak po PCI DSS-u (ugovorno).

Ključni pojmovi:

- **PII** (Personally Identifiable Information): US termin, informacija koja identifikuje osobu direktno (ime, broj pasoša) ili indirektno u kombinaciji (datum rođenja + poštanski broj).
- **Lični podatak (personal data)** po GDPR-u: svaki podatak koji se odnosi na identifikovano ili **identifikabilno** fizičko lice, uključujući online identifikatore (IP adresa, cookie ID). Šire od tipične US definicije PII.
- **Posebne kategorije (special categories, GDPR čl. 9)**: zdravlje, genetski i biometrijski podaci (za identifikaciju), rasno ili etničko porijeklo, politička mišljenja, vjerska uvjerenja, članstvo u sindikatu, seksualni život i orijentacija.
- **PHI** (Protected Health Information): zdravstveni podaci po HIPAA-i kod covered entities i business associates.
- **Pseudonimizacija vs anonimizacija**: pseudonimizovani podaci su i dalje lični (može se ponovo identifikovati uz dodatnu informaciju); stvarno anonimizovani podaci izlaze iz okvira GDPR-a.

## Zakoni pojedinih država (6.2)

### GDPR detaljnije

| Element | Sadržaj |
|---|---|
| Teritorijalni domet (čl. 3) | Subjekti u EU, ali i oni van EU koji nude robu/usluge licima u EU ili prate njihovo ponašanje |
| Principi (čl. 5) | Zakonitost, poštenost i transparentnost; ograničenje svrhe; minimizacija; tačnost; ograničenje čuvanja; integritet i povjerljivost; **accountability** (kontroler mora dokazati usklađenost) |
| Pravni osnovi (čl. 6) | Pristanak, ugovor, zakonska obaveza, vitalni interes, javni interes / službena ovlaštenja, legitimni interes |
| Prava ispitanika (čl. 12–22) | Informisanje, pristup, ispravka, brisanje („pravo na zaborav“), ograničenje obrade, prenosivost, prigovor, prava vezana za automatizovano odlučivanje |
| Privacy by design / by default (čl. 25) | Zaštita ugrađena u sisteme od početka, podrazumijevano minimalni podaci |
| Obrađivač (čl. 28) | Pisani ugovor (DPA): obrada samo po uputstvu, povjerljivost, sigurnost, podizvođači samo uz odobrenje, pomoć kontroleru, brisanje/povrat, audit |
| Evidencija obrade (čl. 30) | Records of processing activities |
| Sigurnost (čl. 32) | Odgovarajuće tehničke i organizacione mjere (šifrovanje, pseudonimizacija, otpornost, testiranje) |
| Povreda (čl. 33–34) | Nadzornom organu bez nepotrebnog odlaganja, gdje je izvodljivo u roku od **72 sata**; ispitanicima bez nepotrebnog odlaganja ako je visok rizik |
| DPIA (čl. 35) | Obavezna kod vjerovatno visokog rizika (npr. sistematsko praćenje, velike količine posebnih kategorija) |
| DPO (čl. 37) | Obavezan za javna tijela i kod osnovne djelatnosti sa velikim praćenjem ili posebnim kategorijama |
| Prenos van EEA (pogl. V) | Odluka o adekvatnosti (čl. 45), odgovarajuće zaštitne mjere: **SCC** (standardne ugovorne klauzule), **BCR** (obavezujuća korporativna pravila) (čl. 46–47), izuzeci (čl. 49) |
| Kazne (čl. 83) | Do 20 miliona EUR ili 4% ukupnog godišnjeg prometa na svjetskom nivou (šta je veće); niži nivo do 10 miliona EUR ili 2% |

Prenosi u SAD: presuda **Schrems II** (CJEU, C-311/18, 2020) poništila je Privacy Shield i zahtijeva procjenu uticaja prenosa (**TIA**, transfer impact assessment) uz SCC. Od jula 2023. važi odluka o adekvatnosti za **EU-US Data Privacy Framework** za certifikovane US organizacije.

### Ostali zakoni iz outlinea

| Zakon | Država | Na koga se odnosi | Ključno |
|---|---|---|---|
| **FERPA** (1974) | SAD | Obrazovne ustanove koje primaju federalna sredstva | Prava roditelja (kasnije učenika sa 18 godina ili na fakultetu) na pristup i kontrolu otkrivanja obrazovnih zapisa |
| **HIPAA** (1996) + **HITECH** (2009) | SAD | Covered entities (pružaoci zdravstvenih usluga, osiguravači, clearinghouses) i business associates | Privacy Rule, Security Rule (administrativne, fizičke, tehničke mjere), Breach Notification Rule; HITECH proširio obaveze na business associates i pojačao kazne |
| **PIPEDA** (2000) | Kanada | Privatni sektor u komercijalnim aktivnostima (osim pokrajina sa sličnim zakonom) | 10 principa fer obrade (accountability, identifying purposes, consent, limiting collection, limiting use/disclosure/retention, accuracy, safeguards, openness, individual access, challenging compliance); prijava povreda kod „real risk of significant harm“ |
| **GDPR** (2016/2018) | EU/EEA | Kontroleri i obrađivači, i van EU pod uslovima čl. 3 | Vidi gore |
| **Digital Personal Data Protection Act (DPDP)** (2023) | Indija | Obrada digitalnih ličnih podataka u Indiji i van nje ako se nude robe/usluge u Indiji | Uloge **Data Fiduciary** (≈ kontroler), **Data Principal** (≈ ispitanik), Data Processor, **Significant Data Fiduciary** (dodatne obaveze: DPO, revizija, DPIA); pristanak i **Consent Managers**; Data Protection Board of India; kazne do 250 crore rupija; pravila za primjenu donesena krajem 2025. uz postepenu primjenu |

U regionu: Srbija ima **Zakon o zaštiti podataka o ličnosti** (2018, u primjeni od 2019), usklađen sa GDPR-om, uz nadzor Poverenika za informacije od javnog značaja i zaštitu podataka o ličnosti. Bosna i Hercegovina, Crna Gora i Sjeverna Makedonija takođe usklađuju zakone sa GDPR-om. Za prenos iz EU u ove zemlje primjenjuju se mehanizmi poglavlja V (npr. SCC), jer nemaju odluku o adekvatnosti.

> **Na ispitu:** HIPAA → cloud provajder koji čuva ePHI mora potpisati **BAA (Business Associate Agreement)**. GDPR → obrađivač mora imati **DPA po čl. 28**. Pitanje „koji dokument PRVO treba potpisati prije prenosa PHI u cloud“ cilja BAA.

## Razlike u nadležnostima (6.2)

| Dimenzija | EU (GDPR) | SAD | Kanada (PIPEDA) | Indija (DPDP) |
|---|---|---|---|---|
| Pristup | Omnibus (jedan opšti zakon) | Sektorski + državni zakoni | Opšti za privatni sektor + pokrajinski | Opšti zakon |
| Definicija | Široka (identifikabilno lice) | Uža, zavisi od zakona | Informacija o identifikabilnoj osobi | Digitalni lični podaci |
| Pravni osnov | Šest osnova, pristanak samo jedan od njih | Uglavnom notice and choice, opt-out | Pristanak (izričit ili prećutan zavisno od osjetljivosti) | Pristanak + određene legitimne upotrebe |
| Prenos u inostranstvo | Ograničen (adekvatnost, SCC, BCR) | Uglavnom slobodan | Dozvoljen uz odgovornost za zaštitu | Dozvoljen osim u zemlje koje vlada ograniči |
| Nadzor | Nezavisni nadzorni organi, EDPB | FTC, HHS OCR, državni AG | Office of the Privacy Commissioner | Data Protection Board |
| Prijava povrede | 72 h nadzornom organu | Različito po saveznoj državi i sektoru | Kod real risk of significant harm | Board-u i pogođenim licima |

Ostali poznati zakoni: Brazil **LGPD**, Kina **PIPL** (stroga pravila prenosa i lokalizacije), Japan **APPI**, Australija **Privacy Act 1988** (Australian Privacy Principles), Švajcarska **nFADP** (od 2023).

Praktično pravilo: kada organizacija posluje u više jurisdikcija, gradi program prema **najstrožem** primjenjivom zahtjevu (često GDPR) i dodaje lokalne specifičnosti (lokalizacija, rokovi prijave).

## Standardni zahtjevi privatnosti (6.2)

### ISO/IEC 27018

Kodeks prakse za zaštitu PII u **javnom cloudu kada provajder djeluje kao obrađivač PII** (PII processor). Proširuje ISO/IEC 27002 kontrole. Ključne obaveze provajdera:

- obrada PII samo prema uputstvima korisnika, bez korištenja za marketing ili oglašavanje bez izričitog pristanka,
- transparentnost: otkrivanje podizvođača i lokacija gdje se PII može obrađivati,
- obavještavanje korisnika o zahtjevima vlasti za otkrivanje PII, osim kad je to zakonom zabranjeno,
- obavještavanje korisnika o povredi PII,
- pomoć korisniku u ostvarivanju prava ispitanika,
- povrat, prenos i sigurno brisanje PII po isteku ugovora,
- povjerljivost osoblja i ograničen pristup.

Povezani standardi: **ISO/IEC 27017** (sigurnosne kontrole za cloud usluge, i za provajdera i za korisnika), **ISO/IEC 27701** (Privacy Information Management System, PIMS; izdanje 2019 bilo je proširenje ISO 27001, a izdanje 2025 je samostalan sistem upravljanja koji se može certifikovati i bez ISO 27001).

### GAPP

**Generally Accepted Privacy Principles** (AICPA i CICA) definišu deset principa:

| # | Princip | Suština |
|---|---|---|
| 1 | Management | Politike, odgovornost, uloge za privatnost |
| 2 | Notice | Obavještenje o svrsi i praksi |
| 3 | Choice and consent | Izbor i pristanak ispitanika |
| 4 | Collection | Prikupljanje samo za navedene svrhe |
| 5 | Use, retention and disposal | Upotreba samo za svrhu, čuvanje koliko treba, sigurno uništavanje |
| 6 | Access | Pristup i ispravka sopstvenih podataka |
| 7 | Disclosure to third parties | Otkrivanje trećim stranama samo za navedene svrhe i uz pristanak |
| 8 | Security for privacy | Zaštita od neovlaštenog pristupa |
| 9 | Quality | Tačni, potpuni i relevantni podaci |
| 10 | Monitoring and enforcement | Nadzor usklađenosti i rješavanje pritužbi |

AICPA je 2020. objavila nasljednika, **Privacy Management Framework**, ali ispit i dalje koristi GAPP kao referencu.

### Poređenje okvira

| | GDPR | ISO/IEC 27018 | ISO/IEC 27701 | GAPP |
|---|---|---|---|---|
| Vrsta | Zakon | Kodeks prakse (kontrole) | Sistem upravljanja (certifikabilan) | Principi |
| Obaveznost | Obavezan | Dobrovoljan / ugovoren | Dobrovoljan | Dobrovoljan |
| Fokus | Svi kontroleri i obrađivači | Javni cloud provajder kao PII processor | Kontroleri i obrađivači, PIMS | Program privatnosti organizacije |
| Dokaz usklađenosti | Accountability, DPIA, evidencija | Certifikacija uz ISO 27001 | Certifikat | Procjena / SOC 2 privacy kriterijumi |

## Procjena uticaja na privatnost (6.2)

**PIA (Privacy Impact Assessment)** je sistematska procjena kako projekat, sistem ili proces utiče na privatnost i koje mjere smanjuju rizik. U GDPR-u je to **DPIA** (Data Protection Impact Assessment, čl. 35), obavezna kad obrada vjerovatno stvara visok rizik za prava i slobode lica.

Kada raditi PIA: **prije** početka obrade ili migracije u cloud (privacy by design), i ponovo pri značajnim promjenama (novi provajder, nova svrha, AI model nad ličnim podacima).

Tipični koraci (GDPR čl. 35 i ISO/IEC 29134):

1. Utvrditi potrebu (screening: da li je visok rizik).
2. Opisati obradu: podaci, ispitanici, svrhe, tokovi, lokacije, uključeni provajderi i podizvođači.
3. Procijeniti nužnost i proporcionalnost (pravni osnov, minimizacija, retencija).
4. Identifikovati i procijeniti rizike za lica (ne samo za organizaciju).
5. Odrediti mjere ublažavanja (šifrovanje, pseudonimizacija, ograničenje pristupa, ugovori).
6. Konsultovati DPO-a i, ako preostali rizik ostane visok, prethodno konsultovati nadzorni organ (čl. 36).
7. Dokumentovati, odobriti, integrisati u projekat i redovno revidirati.

### Scenario: migracija HR sistema u SaaS

Kompanija iz EU seli HR podatke (uključujući zdravstvena bolovanja) na SaaS provajdera iz SAD:

- podaci uključuju posebne kategorije, pa je DPIA vjerovatno obavezna,
- provajder je obrađivač: potreban DPA po čl. 28, lista podizvođača, ISO 27018 / 27701 kao dokaz prakse,
- prenos u SAD: provjeriti da li je provajder certifikovan po EU-US DPF-u ili koristiti SCC uz TIA,
- regioni: zatražiti čuvanje u EU gdje je moguće, šifrovanje sa ključevima pod kontrolom kompanije ako je rizik visok,
- prava ispitanika i brisanje po isteku ugovora regulisani ugovorom.

> **Na ispitu:** PIA/DPIA se radi **prije** obrade ili migracije, ne nakon incidenta. Ako pitanje opisuje novi projekat sa ličnim podacima u cloudu i pita šta je PRVO, a PIA je ponuđena uz tehničke kontrole, PIA je obično tačan odgovor jer određuje koje kontrole trebaju.

## Privatnost i AI servisi u cloudu

Nove teme outlinea 2026 dodiruju i privatnost: generativni AI servisi u cloudu obrađuju upite, dokumente i logove koji često sadrže lične podatke.

| Pitanje | Šta provjeriti |
|---|---|
| Da li provajder koristi podatke za treniranje? | Ugovorna zabrana ili opt-out; enterprise uslovi obično isključuju treniranje na podacima korisnika |
| Gdje se obrađuju upiti? | Region obrade inferencije (cross-region inference može izvesti podatke iz EU) |
| Koliko dugo se čuvaju upiti i odgovori? | Retencija za abuse monitoring, mogućnost isključenja |
| Pravni osnov i transparentnost | Da li su ispitanici obaviješteni da se njihovi podaci obrađuju AI-jem |
| Automatizovano odlučivanje | GDPR čl. 22: pravo da lice ne bude predmet isključivo automatizovane odluke sa pravnim učinkom, uz izuzetke i zaštitne mjere |
| Uloga po EU AI Act | Organizacija je najčešće **deployer**, a dobavljač modela **provider**; obaveze zavise od kategorije rizika |
| DPIA | Nova tehnologija + lični podaci često znači obaveznu DPIA |

### Scenario: zahtjev strane vlasti

Evropska bolnica koristi US cloud provajdera u regionu EU. Provajder dobije nalog US vlasti po CLOUD Act-u za podatke jednog pacijenta.

- Za provajdera to je **sukob zakona**: CLOUD Act traži predaju, GDPR čl. 48 ograničava prenos bez međunarodnog sporazuma. CLOUD Act predviđa mogućnost da provajder ospori nalog ako bi predaja kršila zakon strane države.
- Za bolnicu kao kontrolera rizik se upravlja **unaprijed**: ugovorom (provajder osporava preširoke zahtjeve, obavještava korisnika kad smije, objavljuje transparency report), izborom provajdera i regiona, i šifrovanjem sa ključevima koje kontroliše bolnica (eksterni HSM / HYOK), tako da provajder nema čitljive podatke.
- Posljedica za ispit: odgovor koji kaže „premjestiti podatke u drugi region istog provajdera“ ne rješava problem, jer nadležnost prati **provajdera**, ne samo lokaciju.

## Uloge u privatnosti (pregled)

| GDPR | DPDP (Indija) | HIPAA | Opis |
|---|---|---|---|
| Data subject | Data Principal | Individual | Osoba na koju se podaci odnose |
| Controller | Data Fiduciary | Covered entity | Određuje svrhu i način obrade |
| Processor | Data Processor | Business associate | Obrađuje u ime kontrolera |
| Sub-processor | — | Subcontractor (BA) | Podizvođač obrađivača |
| Supervisory authority | Data Protection Board | HHS OCR | Nadzorni organ |

Cloud provajder je u većini slučajeva **obrađivač**, a cloud customer **kontroler**. Provajder postaje kontroler za podatke koje obrađuje za vlastite svrhe (npr. podaci o naplati, telemetrija za vlastiti razvoj). Detaljnije uloge (owner, custodian, steward) su u modulu 14.

## Tipične zamke na ispitu

| Tvrdnja | Ispravno |
|---|---|
| „Podaci u EU regionu US provajdera nisu dostupni US vlastima“ | CLOUD Act cilja provajdera, bez obzira na lokaciju; pomaže šifrovanje ključevima korisnika i ugovor |
| „PCI DSS je zakon“ | Ugovorna obaveza prema kartičnim brendovima (osim gdje ga država uvede u propis) |
| „Pseudonimizovani podaci nisu lični podaci“ | Jesu; samo stvarno anonimizovani izlaze iz GDPR-a |
| „Provajder kao obrađivač odgovara umjesto kontrolera“ | Kontroler ostaje odgovoran (accountability); obrađivač ima svoje obaveze po čl. 28 i 32 |
| „DPIA se radi nakon incidenta“ | Prije obrade i pri značajnoj promjeni |
| „Pristanak je jedini pravni osnov po GDPR-u“ | Jedan od šest; u radnom odnosu često nije valjan zbog neravnoteže moći |
| „FERPA štiti zdravstvene podatke“ | FERPA štiti obrazovne zapise; zdravstvene podatke štiti HIPAA |
| „ISO 27018 je za sve cloud provajdere kao kontrolere“ | Za javni cloud kada provajder djeluje kao PII processor |

## Rezime

- Cloud premješta podatke preko granica, a zakoni ostaju nacionalni: CLOUD Act vs GDPR, lokalizacija, retencija vs brisanje, eDiscovery vs zaštita podataka. Prvi korak je mapiranje podataka i pravna služba.
- Pravni rizici clouda: lokacija, podizvođači, zahtjevi vlasti, legal hold, zaplijena, stečaj provajdera, ograničena odgovornost, AI servisi; ublažavaju se ugovorom, izborom regiona i šifrovanjem.
- EU okvir: GDPR, NIS2, DORA (od 17. 1. 2025), EU AI Act, Data Act (switching), CRA. SAD: sektorski (HIPAA/HITECH, GLBA, SOX, FERPA, COPPA), CCPA, SEC pravila.
- Forenzika: 27037 rukovanje dokazima, 27041 validnost metoda, 27042 analiza i interpretacija, 27043 proces istrage; CSA mapira te standarde na cloud.
- eDiscovery: EDRM faze, ISO/IEC 27050 (1 koncepti, 2 upravljanje, 3 praksa, 4 tehnička spremnost), legal hold čim se spor razumno očekuje.
- Regulisani podaci (PHI, GDPR lični podaci) vs ugovorni (PCI DSS, NDA); isti podatak može biti oboje.
- GDPR: principi, pravni osnovi, prava, čl. 28 DPA, 72 h prijava, DPIA, prenosi (adekvatnost, SCC, BCR, DPF), kazne 4%/2%. HIPAA traži BAA, PIPEDA ima 10 principa, indijski DPDP Act koristi Data Fiduciary i Data Principal.
- ISO/IEC 27018 za javni cloud kao PII processor, 27701 za PIMS, GAPP deset principa.
- PIA/DPIA prije obrade, sa fokusom na rizik za lica i mjere ublažavanja.
