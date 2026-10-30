## Ciljevi ispita: 1.1, 1.2 i 1.3

Ovaj modul otvara domen 1 (**Security Governance and Risk Management**, 13,6% ispita po outlineu od 15. 4. 2027) i postavlja način razmišljanja koji važi za cijeli CISSP:

- **1.1 Understand, adhere to, and promote professional ethics**
  - ISC2 Code of Professional Ethics
  - Ethics in Artificial Intelligence (AI)
  - Organizational code of ethics
- **1.2 Understand and apply security concepts**
  - Confidentiality, integrity, availability, authenticity, and non-repudiation
- **1.3 Evaluate, apply, and sustain security governance principles**
  - Alignment of the security function to business strategy, goals, mission, and objectives
  - Organizational processes (acquisitions, divestitures, governance committees)
  - Organizational roles and responsibilities
  - Security control frameworks (ISO, NIST, COBIT, SABSA, PCI DSS, FedRAMP)
  - Due care and due diligence

U outlineu iz 2024. domen se zvao **Security and Risk Management** i nosio je 16% pitanja; cilj 1.1 nije imao pod-tačku o etici u AI, cilj 1.3 je glasio „Evaluate and apply“ (bez „sustain“), a pet svojstava iz 1.2 bilo je nazvano „5 Pillars of Information Security“.

> **Na ispitu:** CISSP ne traži da znaš komandu, nego da odabereš odluku koju bi donio CISO ili savjetnik za rizik. Redoslijed prioriteta je skoro uvijek isti: **ljudski život i bezbjednost**, zatim zakon i etika, zatim ciljevi poslovanja, pa tek onda tehnička elegancija. Odgovor koji „popravlja tehniku“ a preskače politiku, upravu ili procjenu rizika rijetko je BEST.

## ISC2 Code of Professional Ethics (1.1)

Svaki CISSP potpisuje **ISC2 Code of Professional Ethics**. Sastoji se od **preambule** i **četiri kanona** (canons). Kanoni su poredani po prioritetu: kada su u sukobu, viši kanon pobjeđuje.

Preambula (suština): sigurnost i dobrobit društva, opšte dobro, dužnost prema principalima i jedni prema drugima zahtijevaju da se pridržavamo najviših etičkih standarda ponašanja i da se to vidi.

| Redoslijed | Kanon (original) | Kome se duguje | Praktično značenje |
|---|---|---|---|
| 1 | **Protect society, the common good, necessary public trust and confidence, and the infrastructure** | Društvu | Ne dozvoli da tvoj rad šteti javnosti ili kritičnoj infrastrukturi; podržavaj povjerenje u sisteme |
| 2 | **Act honorably, honestly, justly, responsibly, and legally** | Zakonu i struci | Poštuj zakon, govori istinu, ne preuveličavaj rizik da bi prodao uslugu |
| 3 | **Provide diligent and competent service to principals** | Principalima (poslodavac, klijent) | Radi savjesno, čuvaj povjerljivost, ne prihvataj posao za koji nisi kompetentan |
| 4 | **Advance and protect the profession** | Struci | Mentorstvo, dijeljenje znanja, ne udruživanje sa onima koji narušavaju ugled struke |

Procedura: kršenje kodeksa prijavljuje se ISC2 **Ethics Committee** formalnom pritužbom (complaint). Pritužbu može podnijeti svako ko je pogođen kršenjem; za kanone 1 i 2 to može biti bilo koji član javnosti, za kanon 3 samo principal (poslodavac ili klijent), a za kanon 4 drugi profesionalci (certifikovani članovi). Posljedica može biti opomena, suspenzija ili oduzimanje certifikata.

### Scenarij: sukob kanona

Klijent (principal) od tebe traži da prikriješ nalaz koji pokazuje da softver za upravljanje bolničkim infuzionim pumpama ima kritičnu ranjivost, jer bi objavljivanje „ugrozilo prodaju“. Kanon 3 kaže da služiš principalu, ali kanon 1 (zaštita društva) i kanon 2 (zakonito i pošteno) su viši. Ispravna linija: insistirati na odgovornom otkrivanju (responsible / coordinated disclosure), dokumentovati, eskalirati, a u krajnjem slučaju odbiti angažman. Lažni izvještaj nikada nije opcija.

> **Na ispitu:** kada pitanje nudi „lojalnost poslodavcu“ protiv „bezbjednosti javnosti“, kanon 1 pobjeđuje. Ali pazi: kanon ne daje pravo na samovoljno javno objavljivanje. Prvo interni kanali, pa koordinisano otkrivanje i nadležni organi.

### Ostali etički okviri koje ispit pominje

| Okvir | Šta treba znati |
|---|---|
| **RFC 1087** „Ethics and the Internet“ (IAB, 1989) | Neetično je: neovlašćeno pristupati resursima interneta, ometati namjeravanu upotrebu interneta, trošiti resurse (ljude, kapacitet, računare), uništavati integritet informacija, ugrožavati privatnost korisnika |
| **Ten Commandments of Computer Ethics** (Computer Ethics Institute) | „Ne koristi računar da naudiš drugima“, „ne njuškaj tuđe fajlove“, „ne kopiraj softver koji nisi platio“, „razmišljaj o društvenim posljedicama programa koji pišeš“ |
| **Organizacioni kodeks ponašanja** (code of conduct) | Interni dokument, obavezujući za zaposlene, usklađen sa zakonom i vrijednostima organizacije |

### Etičke dileme: kako razmišljati

| Situacija | Pogrešan refleks | ISC2 odgovor |
|---|---|---|
| Kolega koristi piratsku kopiju alata za skeniranje na poslu | Ignorisati, „svi to rade“ | Kanon 2 (zakonito): upozoriti, prijaviti kroz interne kanale, nabaviti licencu |
| Tokom pentesta nađeš dokaz o pronevjeri van obima angažmana | Istražiti dalje na svoju ruku | Stati, dokumentovati, prijaviti kontakt osobi klijenta i pravnoj službi; ne prelaziti obim |
| Prodavac nudi „poklon“ dok procjenjuješ njegovu ponudu | Prihvatiti uz obećanje objektivnosti | Odbiti ili prijaviti po politici o sukobu interesa (kanon 2 i 3) |
| Nisi kompetentan za forenziku, a klijent je hitno traži | Prihvatiti i „snaći se“ | Kanon 3: pružaj samo usluge za koje si kompetentan; preporuči stručnjaka |
| Javni forum: neko dijeli lažne informacije o ranjivosti | Ismijati ga | Kanon 4: profesionalno ispraviti, dijeliti tačno znanje |
| Bivši poslodavac nudi posao da „provjeriš“ sistem konkurenta | Prihvatiti, jer je dobro plaćeno | Kanon 1 i 2: neovlašćen pristup je krivično djelo, odbiti |

Kodeks je obaveza i van radnog vremena: ponašanje na društvenim mrežama, konferencijama i u privatnim angažmanima podliježe istim kanonima.

## Etika u vještačkoj inteligenciji (1.1, novo u 2027.)

Outline iz 2027. eksplicitno traži da razumiješ **Ethics in AI**. Za CISSP to nije tehnika treniranja modela, nego upravljanje: da li organizacija koristi AI odgovorno, zakonito i transparentno.

| Princip | Pitanje koje postavlja menadžer | Primjer kontrole |
|---|---|---|
| **Fairness** (pravičnost, bez pristrasnosti) | Da li model diskriminiše grupe ljudi? | Testiranje pristrasnosti (bias testing) prije produkcije, raznovrsni podaci za trening |
| **Transparency / explainability** | Može li se objasniti zašto je model donio odluku? | Dokumentacija modela (model cards), objašnjive metode za odluke sa pravnim posljedicama |
| **Accountability** | Ko je odgovoran za odluku modela? | Imenovan vlasnik AI sistema, human-in-the-loop za visokorizične odluke |
| **Privacy** | Da li trening i upotreba poštuju zakon o privatnosti? | Minimizacija podataka, DPIA, zabrana unosa ličnih podataka u javne LLM servise |
| **Safety & security** | Može li model biti zloupotrijebljen ili izmanipulisan? | Zaštita od prompt injectiona, data poisoninga, nadzor izlaza |
| **Human oversight** | Može li čovjek zaustaviti ili ispraviti sistem? | Mogućnost prekida (kill switch), žalbeni postupak za pogođene |

Referentni okviri koje treba prepoznati: **NIST AI Risk Management Framework (AI RMF 1.0)** sa funkcijama **Govern, Map, Measure, Manage**; **ISO/IEC 42001** (sistem upravljanja AI, AIMS, struktura slična ISO 27001); **ISO/IEC 23894** (upravljanje rizikom AI); **EU AI Act** sa pristupom zasnovanim na riziku (zabranjeni, visokorizični, ograničeni, minimalni rizik); **OECD AI principi**.

> **Na ispitu:** ako se pita šta je PRVO kada poslovna jedinica želi uvesti generativni AI, odgovor je upravljački: politika prihvatljive upotrebe AI, procjena rizika i privatnosti, imenovan vlasnik. Zabrana „na slijepo“ i nekontrolisano dopuštanje su oba loši odgovori.

### Organizacioni kodeks etike

Organizacioni kodeks etike mora: imati podršku najvišeg rukovodstva (**tone at the top**), biti pisan i dostupan svima, biti potpisan pri zapošljavanju i periodično potvrđivan, sadržati kanal za prijavu (uključujući anonimni, **whistleblower** zaštitu) i definisati posljedice. CISSP ga **promoviše** (cilj kaže „promote“): obukom, ličnim primjerom i prijavljivanjem kršenja.

## Sigurnosni koncepti (1.2)

Klasični **CIA trijad** (Confidentiality, Integrity, Availability) proširen je sa **authenticity** i **non-repudiation**. Suprotnost CIA je **DAD**: Disclosure, Alteration, Destruction/Denial.

| Svojstvo | Definicija | Prijetnja (DAD) | Tipične kontrole |
|---|---|---|---|
| **Confidentiality** | Informacija dostupna samo ovlašćenima | Disclosure: curenje, sniffing, shoulder surfing, socijalni inženjering | Šifrovanje u mirovanju i prenosu, kontrola pristupa, klasifikacija, DLP |
| **Integrity** | Informacija i sistemi nisu neovlašćeno izmijenjeni, tačni su i potpuni | Alteration: neovlašćena izmjena, greška korisnika, malver | Heševi, MAC/HMAC, digitalni potpisi, kontrola promjena, validacija unosa, razdvajanje dužnosti |
| **Availability** | Ovlašćeni korisnici imaju pravovremen i pouzdan pristup | Destruction/Denial: DoS, kvar, prirodna katastrofa | Redundansa, backup, klasteri, BCP/DRP, kapacitet, zaštita od DDoS |
| **Authenticity** | Potvrda da su podaci, poruka ili entitet izvorni i ono što tvrde da jesu | Lažno predstavljanje, spoofing | Autentifikacija, sertifikati, potpisi, MAC |
| **Non-repudiation** | Pošiljalac ne može poreći da je poslao, primalac da je primio | Poricanje transakcije | Digitalni potpis (asimetrični ključ), pouzdan audit log, vremenski žig (timestamping) |

Tri nivoa integriteta koja ISC2 voli: sprječavanje neovlašćenih izmjena od strane **neovlašćenih** korisnika, sprječavanje **neovlašćenih** izmjena od strane ovlašćenih korisnika, i održavanje interne i eksterne **konzistentnosti** podataka (to su ciljevi Clark-Wilson modela, modul 6).

### Non-repudiation: zašto simetrično nije dovoljno

| Mehanizam | Integritet | Autentičnost izvora | Non-repudiation |
|---|---|---|---|
| Heš (SHA-256) | Da (otkriva slučajnu izmjenu) | Ne | Ne |
| HMAC (dijeljeni ključ) | Da | Da (među stranama koje dijele ključ) | **Ne**, obje strane imaju ključ |
| Digitalni potpis (privatni ključ) | Da | Da | **Da**, samo vlasnik privatnog ključa potpisuje |

### Povezani pojmovi

| Pojam | Značenje |
|---|---|
| **Identification, Authentication, Authorization, Accounting (IAAA)** | Tvrdnja o identitetu, dokaz, dozvola, praćenje (auditing + accountability) |
| **Accountability** | Mogućnost da se radnja poveže sa pojedincem; zahtijeva jedinstvene identitete i audit trag |
| **Privacy** | Pravo pojedinca da kontroliše svoje lične podatke (nije isto što i confidentiality) |
| **Least privilege / need to know** | Minimalna prava za posao / pristup samo informacijama potrebnim za zadatak, čak i uz odgovarajuću klasifikaciju |
| **Separation of duties (SoD)** | Kritičan zadatak dijeli se na više osoba da bi prevara zahtijevala dosluh (collusion) |
| **Defense in depth** | Više slojeva kontrola (administrativne, tehničke, fizičke) |

> **Na ispitu:** pitanje „koja kontrola PRVENSTVENO obezbjeđuje non-repudiation“ ima odgovor **digitalni potpis**, ne šifrovanje i ne HMAC. Pitanje „koje svojstvo narušava DDoS“ je availability; „izmijenjen iznos u bazi“ je integrity; „objavljena lista klijenata“ je confidentiality.

### Prepoznaj svojstvo u scenariju

| Scenarij | Narušeno ili traženo svojstvo |
|---|---|
| Ransomware šifruje fajl server i posao staje | Availability (i integrity ako su podaci izmijenjeni) |
| Napadač mijenja IBAN u PDF fakturi u prenosu | Integrity, authenticity |
| Klijent tvrdi da nikada nije odobrio transfer sa svog naloga | Non-repudiation |
| Zaposleni šalje listu plata na lični mail | Confidentiality |
| Lažna stranica imitira portal banke | Authenticity |
| Replikacija baze kasni i dva sistema prikazuju različita stanja | Integrity (konzistentnost) |
| Kvar napajanja bez UPS-a gasi data centar | Availability |
| Log fajl obrisan da bi se prikrili tragovi | Integrity i accountability |

### Ostale osnove koje se pojavljuju u pitanjima

- **Abstraction**: grupisanje objekata sa sličnim svojstvima i dodjela prava grupi (uloge, klase).
- **Data hiding**: sakrivanje podataka od subjekata koji nemaju potrebu da ih vide (npr. enkapsulacija, odvojeni nivoi klasifikacije).
- **Security through obscurity**: oslanjanje na tajnost dizajna; nikada nije dovoljna kontrola sama po sebi (Kerckhoffsov princip kaže suprotno: tajan je samo ključ).
- **Zero trust**: nijedan zahtjev nije pouzdan zbog lokacije u mreži; svaki se provjerava (NIST SP 800-207, modul 6 i 9).
- **Trust but verify**: povjerenje uz nadzor i audit.
- **Fail-safe / fail-secure**: kada kontrola otkaže, sistem prelazi u stanje koje štiti ljude (fail-safe, npr. vrata se otvaraju pri požaru) ili imovinu (fail-secure, vrata ostaju zaključana). Kada je ugrožen život, bira se fail-safe.

### Balans svojstava

Svojstva su često u napetosti. Zdravstveni sistem u hitnoj službi prioritizuje **availability** i **integrity** (pogrešna doza ubija), vojni obavještajni sistem **confidentiality**, finansijska transakcija **integrity** i **non-repudiation**. Prioritet određuje vlasnik podataka na osnovu poslovnog uticaja, ne tim za sigurnost.

## Usklađenost sigurnosti sa poslovanjem (1.3)

**Security governance** je skup odgovornosti i praksi kojima odbor i izvršno rukovodstvo daju strateški pravac, osiguravaju da se ciljevi postižu, da se rizik upravlja na odgovarajući način i da se resursi koriste odgovorno. Governance je odgovornost **odbora i uprave**; menadžment izvršava.

| Pojam | Pitanje | Horizont | Primjer |
|---|---|---|---|
| **Mission** | Zašto postojimo? | Trajno | „Pružamo bezbjednu digitalnu bankarsku uslugu građanima regiona“ |
| **Strategy / goals** | Kuda idemo? | 3–5 godina (strateški plan) | „Postati vodeća digitalna banka, 70% transakcija mobilno“ |
| **Objectives** | Šta konkretno postižemo? | 1 godina (taktički plan) | „Uvesti phishing-otpornu MFA za sve klijente do kraja godine“ |
| **Operational plan** | Kako, ko, kada? | Mjeseci, sedmice | Projektni plan uvođenja FIDO2, budžet, ljudi |

Planovi sigurnosti prate istu hijerarhiju: **strateški plan** (dugoročan, oko 5 godina, revizija godišnje), **taktički plan** (srednjoročan, oko godinu dana: projekti, nabavke, zapošljavanje), **operativni plan** (kratkoročan, detaljan, ažurira se često).

Sigurnost se usklađuje top-down: politika i program izvode se iz misije i ciljeva, a ne iz omiljenih alata tima. **Business case** za sigurnosnu investiciju govori jezikom rizika i novca (smanjenje ALE, regulatorna kazna, gubitak prihoda), ne jezikom CVE-a.

> **Na ispitu:** „top-down“ pristup je ispravan, „bottom-up“ (IT inicira bez podrške uprave) je slab. Najvažniji faktor uspjeha sigurnosnog programa je **podrška višeg rukovodstva** (senior management support). Ako pitanje pita šta je PRVI korak u uspostavljanju programa, odgovor je obezbijediti podršku i mandat uprave.

### Scenarij: sigurnost kao omogućivač

Marketing želi lansirati mobilnu aplikaciju za šest sedmica, a tim za sigurnost traži tri mjeseca za pun pentest. Loš CISO blokira projekat. Dobar CISO pita koji je poslovni cilj i koji rizik je prihvatljiv, predlaže smanjen obim lansiranja (bez plaćanja u prvoj fazi), threat modeling u prvoj sedmici, automatizovano testiranje u pipelineu i pentest prije druge faze, a preostali rizik formalno potpisuje vlasnik proizvoda. Sigurnost služi poslovanju; ona ne odlučuje umjesto njega.

| Ponašanje sigurnosnog tima | Poruka upravi |
|---|---|
| „Ne može“ bez alternative | Sigurnost je kočnica |
| „Može, uz ove kontrole i ovaj preostali rizik“ | Sigurnost je partner |
| Izvještaj u CVSS ocjenama | Uprava ne razumije prioritet |
| Izvještaj u novcu, vjerovatnoći i uticaju na ciljeve | Uprava može odlučiti |

## Organizacioni procesi (1.3)

| Proces | Sigurnosni rizik | Šta CISSP radi |
|---|---|---|
| **Akvizicija / spajanje** (acquisition, merger) | Nasljeđivanje nepoznatih ranjivosti, kompromitovanih sistema, nekompatibilnih politika, regulatornih obaveza; insajderi nezadovoljni promjenom | Due diligence prije potpisivanja: procjena sigurnosnog stanja, istorija incidenata, usklađenost; plan integracije; segmentacija do provjere; usklađivanje politika |
| **Divesticija / izdvajanje** (divestiture, spin-off) | Curenje podataka koji ostaju matičnoj firmi, preostali nalozi i pristupi, dijeljeni sistemi, ključevi i sertifikati | Inventar podataka i sistema koji odlaze, sanitizacija, ukidanje pristupa, rotacija tajni, ugovor o prelaznim uslugama (TSA) |
| **Governance committees** | Sigurnost odlučena u silosu | Upravni odbor za sigurnost (security steering committee), komitet za rizik, audit committee odbora; CISO izvještava o riziku |

**Governance committee** čine predstavnici poslovnih jedinica, IT-a, pravne službe, HR-a, rizika i sigurnosti. On odobrava politike, prioritete projekata, budžet i prihvata rizik na nivou organizacije. **Audit committee** (komitet za reviziju, dio odbora direktora) nadgleda interni i eksterni audit i finansijsko izvještavanje.

### Scenarij: akvizicija

Banka kupuje fintech startup. Prije zatvaranja posla CISO traži rezultate penetracionih testova, SOC 2 izvještaj, popis incidenata i dokaz usklađenosti sa PCI DSS. Nakon zatvaranja, mreže se ne spajaju odmah: startup ostaje u zasebnoj zoni dok se ne izvrši procjena, nalozi se konsoliduju u centralni IdP, a politike banke postaju obavezujuće uz rok za usklađivanje.

## Organizacione uloge i odgovornosti (1.3)

| Uloga | Odgovornost |
|---|---|
| **Board of directors / senior management** | Krajnja odgovornost (ultimate responsibility) za sigurnost i rizik; odobrava politiku, risk appetite, budžet; može biti pravno odgovorna |
| **CEO** | Izvršna odgovornost, nosilac rizika na nivou organizacije |
| **CISO / CSO** | Vodi sigurnosni program, savjetuje upravu o riziku, ne prihvata rizik u ime posla; idealno izvještava van IT-a (npr. CEO, CRO ili odbor) radi nezavisnosti |
| **CIO / CTO** | Tehnologija i IT operacije; sukob interesa ako CISO izvještava CIO-u |
| **Data / information owner** | Viši menadžer odgovoran za podatke: klasifikuje, određuje ko ima pristup, odobrava zaštitu, **odgovoran je** za njih |
| **Data custodian** | Sprovodi zaštitu po nalogu vlasnika: backup, šifrovanje, konfiguracija kontrola (često IT/ops) |
| **System owner** | Odgovoran za sistem koji obrađuje podatke, sistemski sigurnosni plan |
| **Data controller / processor** | GDPR pojmovi: ko određuje svrhu i način obrade / ko obrađuje u ime kontrolora (modul 2 i 5) |
| **Security administrator** | Upravlja nalozima, pravima i sigurnosnim alatima |
| **Auditor** | Nezavisno provjerava da li su kontrole primijenjene i efikasne; izvještava upravu |
| **User** | Pridržava se politika, prijavljuje incidente |

**Odgovornost** (accountability) ne može se delegirati; **zadaci** (responsibility za izvršenje) mogu. Uprava može delegirati sprovođenje CISO-u, ali ostaje odgovorna.

Koristan alat je **RACI matrica** (Responsible, Accountable, Consulted, Informed): za svaku aktivnost tačno jedan „A“.

> **Na ispitu:** ko je KRAJNJE odgovoran za zaštitu podataka? Viša uprava (senior management). Ko klasifikuje podatke? Data owner. Ko pravi backup? Custodian. Ko prihvata rizik? Vlasnik rizika / uprava, nikada administrator ili sam CISO.

## Okviri sigurnosnih kontrola (1.3)

**Control framework** je strukturiran skup kontrola i procesa koji omogućava da program bude potpun, uporediv i auditabilan. Ispit traži da znaš **namjenu** svakog okvira i kada ga birati.

| Okvir | Vlasnik | Namjena | Ključne riječi |
|---|---|---|---|
| **ISO/IEC 27001** | ISO/IEC | Zahtjevi za ISMS; **certifikabilan** | PDCA, klauzule 4–10, Statement of Applicability, Annex A (93 kontrole u 4 teme) |
| **ISO/IEC 27002** | ISO/IEC | Smjernice za sprovođenje kontrola iz Annex A; nije certifikabilan | Opis kontrola, atributi |
| **NIST CSF 2.0** | NIST | Dobrovoljni okvir za upravljanje kibernetičkim rizikom, za sve sektore | Funkcije **Govern, Identify, Protect, Detect, Respond, Recover**; profili i tierovi |
| **NIST SP 800-53 Rev. 5** | NIST | Katalog sigurnosnih i privatnosnih kontrola (obavezno za federalne sisteme SAD) | 20 familija (AC, AU, IR...), baselines low/moderate/high (SP 800-53B) |
| **NIST RMF (SP 800-37)** | NIST | Proces upravljanja rizikom za sisteme | Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor (modul 3) |
| **COBIT 2019** | ISACA | Governance i upravljanje IT-om, usklađivanje IT-a sa poslovnim ciljevima | Odvajanje governance od managementa, 40 ciljeva, kaskada ciljeva (goals cascade) |
| **SABSA** | SABSA Institute | Metodologija **sigurnosne arhitekture** vođena poslovnim potrebama | Matrica 6x6: pitanja What, Why, How, Who, Where, When kroz slojeve Contextual, Conceptual, Logical, Physical, Component, Operational |
| **PCI DSS v4.0.1** | PCI SSC (kartične kuće) | Ugovorni industrijski standard za zaštitu podataka platnih kartica | 12 zahtjeva, CDE, QSA, ROC/SAQ, customized approach |
| **FedRAMP** | GSA, vlada SAD | Standardizovana autorizacija cloud usluga za federalne agencije | Bazira se na NIST 800-53; nivoi Low, Moderate, High; 3PAO, ATO |
| **COSO** | Treadway Commission | Interna kontrola za finansijsko izvještavanje (SOX) | Pet komponenti: control environment, risk assessment, control activities, information & communication, monitoring |
| **ITIL** | Axelos | Upravljanje IT uslugama | Service management, change, incident |
| **CIS Controls v8** | CIS | Prioritizovane tehničke kontrole | 18 kontrola, Implementation Groups IG1–IG3 |

U outlineu iz 2024. pod-tačka je navodila „Payment Card Industry (PCI)“, a sada eksplicitno **PCI DSS**.

### NIST CSF 2.0 ukratko

| Funkcija | Svrha | Primjeri kategorija |
|---|---|---|
| **Govern (GV)** | Strategija, uloge, politika, nadzor, upravljanje rizikom lanca snabdijevanja (novo u 2.0) | Organizational context, risk management strategy, roles, policy, oversight, C-SCRM |
| **Identify (ID)** | Razumijevanje imovine i rizika | Asset management, risk assessment, improvement |
| **Protect (PR)** | Zaštitne mjere | Identity management & access control, awareness & training, data security, platform security |
| **Detect (DE)** | Otkrivanje događaja | Continuous monitoring, adverse event analysis |
| **Respond (RS)** | Reakcija na incident | Incident management, analysis, mitigation, reporting |
| **Recover (RC)** | Obnavljanje | Incident recovery plan execution, communication |

**Profili**: Current Profile (trenutno stanje) i Target Profile (ciljno stanje); razlika je gap koji se pretvara u akcioni plan. **Tierovi** (1 Partial, 2 Risk Informed, 3 Repeatable, 4 Adaptive) opisuju rigoroznost upravljanja rizikom, nisu nivoi zrelosti kontrola.

### SABSA matrica (slojevi)

| Sloj | Pogled | Pitanje |
|---|---|---|
| Contextual | Poslovni (business view) | Šta posao radi i zašto |
| Conceptual | Arhitekte (architect's view) | Koji su sigurnosni atributi i ciljevi (business attributes profile) |
| Logical | Dizajnera (designer's view) | Logičke usluge i politike |
| Physical | Graditelja (builder's view) | Mehanizmi i tehnologije |
| Component | Zanatlije (tradesman's view) | Konkretni proizvodi i alati |
| Operational | Upravitelja usluga (service manager's view) | Rad, održavanje, podrška |

Ključna ideja SABSA je **sljedivost** (traceability): svaka tehnička kontrola mora se moći pratiti unazad do poslovnog zahtjeva. Slično rade **Zachman** (matrica 6x6 za enterprise arhitekturu) i **TOGAF** (ADM ciklus).

### COBIT 2019 i ISO 27001 detaljnije

COBIT razdvaja **governance** (Evaluate, Direct, Monitor: EDM, posao odbora) od **managementa** (Align/Plan/Organize, Build/Acquire/Implement, Deliver/Service/Support, Monitor/Evaluate/Assess: APO, BAI, DSS, MEA). Kaskada ciljeva (goals cascade) prevodi potrebe stakeholdera u ciljeve organizacije, pa u ciljeve usklađivanja (alignment goals) i ciljeve upravljanja.

ISO/IEC 27001:2022 Annex A ima četiri teme kontrola: organizacione (37), ljudske (8), fizičke (14) i tehnološke (34). Certifikat izdaje akreditovano certifikaciono tijelo nakon audita u dvije faze (Stage 1 dokumentacija, Stage 2 implementacija), sa nadzornim auditima godišnje i recertifikacijom svake tri godine.

### Kako izabrati okvir

| Situacija | Najbolji izbor |
|---|---|
| Kupci traže međunarodno priznat certifikat sistema upravljanja | ISO/IEC 27001 |
| Uprava želi jezik za razgovor o kibernetičkom riziku i ciljni profil | NIST CSF 2.0 |
| Federalna agencija SAD ili dobavljač federalnog sistema | NIST SP 800-53 + RMF, FedRAMP za cloud |
| Usklađivanje IT investicija sa poslovnim ciljevima, governance IT-a | COBIT |
| Arhitektura sigurnosti izvedena iz poslovnih zahtjeva | SABSA |
| Organizacija obrađuje kartice | PCI DSS (obavezno ugovorno) |

> **Na ispitu:** razlikuj **zakon** (obavezno, država), **ugovorni standard** (PCI DSS, obavezan ugovorom sa kartičnim kućama) i **dobrovoljni okvir** (NIST CSF, ISO 27001 dok ga ne zatraži kupac ili regulator). SABSA i Zachman su arhitektonski okviri, COBIT je governance IT-a, ISO 27001 je ISMS.

### Tipovi kontrola po kategoriji

| Kategorija | Primjeri |
|---|---|
| **Administrative / managerial** | Politike, procedure, obuka, provjera kandidata, procjena rizika |
| **Technical / logical** | Firewall, šifrovanje, MFA, IDS, ACL |
| **Physical** | Ograde, brave, čuvari, CCTV, mantrap |

Funkcionalni tipovi (preventive, detective, corrective, deterrent, recovery, compensating, directive) detaljno su obrađeni u modulu 3 (1.9).

## Due care i due diligence (1.3)

| | **Due diligence** | **Due care** |
|---|---|---|
| Suština | Istraživanje, saznavanje, procjena prije i tokom odluke | Postupanje kao razuman i oprezan čovjek; sprovođenje mjera |
| Pitanje | „Da li znamo koji rizici postoje?“ | „Da li činimo ono što bi razumna organizacija činila?“ |
| Vrijeme | Prije (i kontinuirano: provjera da kontrole rade) | Tokom (primjena i održavanje) |
| Primjeri | Procjena rizika dobavljača, audit, analiza ranjivosti, provjera prije akvizicije | Patchovanje, primjena politika, obuka zaposlenih, šifrovanje laptopa |
| Mnemonik | **D**iligence = **D**o detect / razmisli | **C**are = **C**arry out / uradi |

Pravni pojam **prudent person rule** (pravilo razumnog čovjeka): uprava mora postupati onako kako bi razuman, oprezan pojedinac postupao u istim okolnostima. Neispunjavanje due care znači **nepažnju** (negligence) i može dovesti do lične odgovornosti uprave. Pravni test nepažnje: postojala je dužnost (duty), dužnost je prekršena (breach), nastala je šteta (damages), i prekršaj je neposredni uzrok štete (proximate cause).

### Scenarij

Kompanija je prije dvije godine uradila procjenu rizika i identifikovala nešifrovane laptope kao visok rizik (due diligence), ali nije ništa uradila. Ukraden je laptop sa podacima klijenata. Kompanija nije ispunila **due care**; činjenica da je znala za rizik čini nepažnju još težom, jer pokazuje da je štetu mogla predvidjeti.

> **Na ispitu:** „istražili su“ i „procijenili su“ = due diligence; „uveli su i održavaju“ = due care. Kada pitanje pita šta štiti upravu od optužbe za nepažnju, odgovor je dokaz da je postupala sa **due care** (dokumentovane politike, sprovedene kontrole, obuka).

## Governance u praksi: kontinuirano održavanje (1.3 „sustain“)

Nova riječ „sustain“ u outlineu 2027. naglašava da governance nije jednokratan projekat:

| Aktivnost | Svrha |
|---|---|
| Periodično preispitivanje od strane uprave (management review) | Potvrda da program i dalje odgovara ciljevima i risk appetiteu |
| Metrike i KPI/KRI na dashboardu za odbor | Mjerljivost: pokrivenost MFA, vrijeme do zatvaranja kritičnih ranjivosti, procenat završene obuke |
| Godišnja revizija politika | Usklađenost sa promjenama zakona, tehnologije i poslovanja |
| Interni i eksterni audit | Nezavisna potvrda efikasnosti |
| Procjena zrelosti (maturity) | CMMI, NIST CSF tierovi, modul 3 |

### Gdje smjestiti sigurnosnu funkciju

| Model izvještavanja CISO-a | Prednost | Mana |
|---|---|---|
| CISO → CIO | Blizina IT-u, lakša implementacija | Sukob interesa: CIO bira između brzine isporuke i sigurnosti |
| CISO → CEO | Vidljivost, autoritet | CEO ima malo vremena za detalje |
| CISO → CRO / General Counsel | Usklađenost sa rizikom i pravom | Može izgubiti tehnički uticaj |
| CISO → odbor (audit/risk committee) uz administrativnu liniju | Nezavisnost | Zahtijeva zrelu organizaciju |

Preporuka koju ispit voli: sigurnost mora imati **nezavisnost i pristup najvišem nivou** odlučivanja, tako da sukob interesa sa IT operacijama ne potiskuje rizik.

**KPI** (Key Performance Indicator) mjeri koliko dobro proces radi (npr. 95% sistema zakrpljeno u roku od 30 dana). **KRI** (Key Risk Indicator) je rani signal da rizik raste (npr. broj neodobrenih SaaS aplikacija, broj izuzetaka od politike).

## Tipične zamke u pitanjima ovog modula

| Zamka | Kako je prepoznati |
|---|---|
| Tehničko rješenje prije politike | Ako nema politike ili mandata uprave, to je PRVI korak |
| „Zaposleni sam prihvata rizik“ | Rizik prihvata vlasnik rizika / uprava, formalno i dokumentovano |
| Mijenjanje accountability i responsibility | Zadatak se delegira, odgovornost ne |
| Miješanje okvira | Certifikat ISMS-a = ISO 27001; katalog kontrola = 800-53; governance IT-a = COBIT; arhitektura = SABSA |
| „Javno objavi ranjivost odmah“ | Koordinisano otkrivanje, interni kanali, pa nadležni |
| Due care vs due diligence | Istraživanje i procjena = diligence; sprovođenje = care |

> **Na ispitu:** kada dva odgovora djeluju tačno, pitaj se koji je **širi i upravljački**, a koji uži i tehnički. „Uspostaviti program upravljanja rizikom koji podržava uprava“ pobjeđuje „instalirati EDR na sve krajnje tačke“, osim ako pitanje izričito traži tehničku kontrolu.

## Rezime

- **ISC2 kodeks**: preambula i četiri kanona po prioritetu: društvo, čast i zakon, principali, struka. Viši kanon pobjeđuje; pritužbe idu ISC2 Ethics Committee.
- **Etika u AI** (novo 2027.): pravičnost, transparentnost, odgovornost, privatnost, bezbjednost i ljudski nadzor; okviri NIST AI RMF (Govern, Map, Measure, Manage), ISO/IEC 42001, EU AI Act.
- **Organizacioni kodeks**: tone at the top, potpis i periodična potvrda, kanal za prijavu i zaštita uzbunjivača.
- **Pet svojstava**: CIA + authenticity + non-repudiation; DAD je suprotnost; non-repudiation daje digitalni potpis, ne HMAC.
- **Governance**: odgovornost odbora i uprave, top-down, usklađena sa misijom i ciljevima; strateški, taktički i operativni planovi.
- **Organizacioni procesi**: due diligence pri akviziciji, sanitizacija i ukidanje pristupa pri divesticiji, governance i audit komiteti.
- **Uloge**: uprava je krajnje odgovorna; owner klasifikuje, custodian sprovodi; accountability se ne delegira.
- **Okviri**: ISO 27001 (certifikabilan ISMS), NIST CSF 2.0 (šest funkcija sa Govern), 800-53 (katalog), COBIT (IT governance), SABSA (arhitektura), PCI DSS (ugovorni), FedRAMP (cloud za vladu SAD).
- **Due diligence** = saznaj i procijeni; **due care** = postupaj razumno i sprovedi; nepažnja = dužnost + kršenje + šteta + uzročnost.
