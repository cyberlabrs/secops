## Ciljevi ispita: domen 8 (8.1–8.5)

Domen 8 (**Software Development Security**) nosi **11,2%** ispita po outlineu iz 2027. godine (U outlineu iz 2024. bilo je 10%). Pokriva pet ciljeva:

- **8.1 Understand and integrate security in the Software Development Life Cycle (SDLC)**: metodologije razvoja (Agile, Waterfall, DevOps, DevSecOps, Scaled Agile Framework), modeli zrelosti (CMM, SAMM), rad i održavanje (operation and maintenance), upravljanje promjenama (change management), **Integrated Product Team (IPT)**, zahtjevi **Secure Software Development Framework (SSDF)** i **Software Bill of Materials (SBOM)**, **shift left**,
- **8.2 Identify and apply security controls in software development ecosystems**: programski jezici (memory safe, objektno orijentisani), biblioteke (libraries), skupovi alata (tool sets), **Integrated Development Environment (IDE)**, runtime, **CI/CD**, software configuration management (CM), repozitoriji koda (code repositories), testiranje sigurnosti aplikacija (**SAST**, **DAST**),
- **8.3 Assess the effectiveness of software security**: revizija i logovanje promjena (auditing and logging of changes), analiza i ublažavanje rizika (risk analysis and mitigation),
- **8.4 Assess security impact of acquired software**: **COTS**, upravljane usluge (managed services, npr. enterprise aplikacije), open source (**Software Composition Analysis, SCA**), cloud usluge (SaaS, IaaS, PaaS, FaaS), treće strane (third-party),
- **8.5 Define and apply secure coding guidelines and standards**: slabosti i ranjivosti na nivou izvornog koda, sigurnost **API**-ja, prakse sigurnog kodiranja (secure coding practices).

Razlike u odnosu na outline iz 2024:

| Cilj | Outline 2024. | Outline 2027. |
|---|---|---|
| 8.1 | Bez SSDF/SBOM i shift left | Dodati „SSDF and SBOM requirements“ i „Shift left“ |
| 8.2 | „Programming languages“ bez primjera; AST uključuje SAST, DAST, SCA i IAST | Primjeri „memory safe, object-oriented“; AST samo SAST/DAST kao primjeri; SCA prebačen u 8.4 (open source) |
| 8.4 | Cloud: SaaS, IaaS, PaaS | Dodat FaaS; open source sa primjerom SCA |
| 8.5 | Četvrta tačka „Software-defined security“ | Tačka uklonjena |

Kao DevSecOps praktičar znaš alate. CISSP ne pita kako konfigurišeš Semgrep, nego **kada** i **zašto** organizacija uvodi kontrolu, ko je odgovoran i koja odluka najviše smanjuje rizik uz najmanje troškove.

> **Na ispitu:** sigurnost je najjeftinija kada se ugradi što ranije. Ako pitanje nudi „dodati sigurnosne zahtjeve u fazi zahtjeva/dizajna“ naspram „testirati prije produkcije“ ili „dodati WAF“, rano ugrađivanje je skoro uvijek BEST odgovor. WAF i pentest su kompenzacione ili verifikacione kontrole, ne zamjena za sigurni dizajn.

## 8.1 SDLC: faze i gdje ide sigurnost

ISC2 koristi generički SDLC; nazivi faza variraju po izvoru, ali logika je ista:

| Faza | Ključne aktivnosti | Sigurnosna aktivnost |
|---|---|---|
| **Iniciranje / koncept** | Poslovna potreba, studija izvodljivosti | Inicijalna procjena rizika, klasifikacija podataka, regulatorni zahtjevi (privacy) |
| **Zahtjevi (requirements)** | Funkcionalni i nefunkcionalni zahtjevi | Sigurnosni zahtjevi, **abuse/misuse cases**, zahtjevi za privatnost |
| **Dizajn (design)** | Arhitektura, interfejsi | **Threat modeling** (STRIDE, PASTA), smanjenje napadne površine, security design review |
| **Razvoj (development / coding)** | Pisanje koda, unit testovi | Secure coding standardi, peer code review, SAST, SCA |
| **Testiranje (testing)** | Funkcionalno, integraciono, UAT | DAST, IAST, fuzzing, pentest, verifikacija sigurnosnih zahtjeva |
| **Implementacija / deployment** | Instalacija, migracija | Hardening, **certification & accreditation (authorization)**, sigurno upravljanje tajnama |
| **Rad i održavanje (O&M)** | Podrška, zakrpe, monitoring | Patch management, change management, monitoring, periodične re-procjene |
| **Povlačenje (disposal)** | Gašenje sistema | Arhiviranje ili sanitizacija podataka, ukidanje naloga i ključeva |

Dva pojma koja ispit voli:

- **Certification**: tehnička procjena da sistem ispunjava sigurnosne zahtjeve.
- **Accreditation** (u NIST RMF terminologiji **authorization**): formalna odluka menadžmenta (Authorizing Official) da prihvata preostali rizik i odobrava rad sistema.

> **Na ispitu:** odluka o puštanju u rad nije tehnička nego poslovna. Ko prihvata preostali rizik sistema? Vlasnik/menadžment kroz akreditaciju (authorization), ne tim za testiranje i ne CISO sam po sebi.

### Trošak kasnog otkrivanja

Klasično pravilo (Boehm, NIST studija iz 2002): popravka greške nađene u produkciji košta višestruko više nego u fazi zahtjeva. Ilustrativni odnos:

| Faza otkrivanja | Relativni trošak popravke |
|---|---|
| Zahtjevi / dizajn | 1x |
| Kodiranje | 5x |
| Testiranje | 10x |
| Produkcija | 30x i više |

Primjer: ako tim nađe 40 sigurnosnih grešaka i prosječna popravka u dizajnu košta 200 €, trošak je 8.000 €. Iste greške u produkciji (30x) koštale bi 240.000 €, bez troškova incidenta. To je ekonomski argument za **shift left**.

## Metodologije razvoja

| Metodologija | Karakteristike | Sigurnosne prednosti | Sigurnosni rizici |
|---|---|---|---|
| **Waterfall** | Sekvencijalne faze, povratak skup; detaljna dokumentacija | Jasne kontrolne tačke (gates) za sigurnosni review; dobra za regulisana okruženja | Sigurnost se često gura na kraj (test faza); promjena zahtjeva je skupa |
| **V-model** | Waterfall gdje svaka razvojna faza ima pripadajuću fazu testiranja | Verifikacija i validacija planirane od početka | Krutost |
| **Spiral** (Boehm) | Iterativni ciklusi, svaki počinje **analizom rizika** | Rizik je eksplicitan u svakoj iteraciji | Skup, zahtijeva ekspertizu u procjeni rizika |
| **Prototyping / RAD** | Brzi prototipovi, povratna informacija korisnika | Rana validacija | Prototip „procuri“ u produkciju bez hardeninga |
| **Agile** (Scrum, Kanban, XP) | Kratki sprintovi, korisničke priče, Agile Manifesto | Brza reakcija na nove prijetnje; sigurnost kao dio Definition of Done | Manje dokumentacije; sigurnost ispadne iz backloga ako nije prioritet product ownera |
| **Scaled Agile Framework (SAFe)** | Agile za velike organizacije: Agile Release Train, Program Increment, portfolio nivo | Sigurnost kao **enabler** i nefunkcionalni zahtjev na nivou portfolija; usklađenost više timova | Složenost; sigurnost mora biti zastupljena u planiranju (PI planning) |
| **DevOps** | Spajanje razvoja i operacija, automatizacija, CI/CD, česta isporuka | Brze zakrpe, infrastruktura kao kod, ponovljivost | Brzina bez kontrola; sigurnost kao „usko grlo“ |
| **DevSecOps** | DevOps + sigurnost kao zajednička odgovornost, automatizovane kontrole u pipelineu | Shift left, kontinuirano testiranje, policy as code | Zahtijeva kulturnu promjenu i obuku; lažni pozitivi mogu blokirati pipeline |

U Scrumu ispit može pomenuti uloge: **product owner** (prioritizuje backlog, dakle i sigurnosne priče), **scrum master** (uklanja prepreke), razvojni tim. Sigurnost u Agileu se uvodi kroz **security user stories**, **abuse cases**, **security champions** u timovima i sigurnosne kriterijume u Definition of Done.

### Integrated Product Team (IPT)

**IPT** je multidisciplinarni tim (razvoj, operacije, sigurnost, QA, pravni, nabavka, poslovni vlasnik) okupljen oko proizvoda kroz cijeli životni ciklus. Pojam potiče iz američkog Ministarstva odbrane (Integrated Product and Process Development). Poenta za ispit: sigurnost je **član tima od početka**, a ne vanjski revizor na kraju; odluke se donose zajednički i brže, sa jasnim vlasništvom.

### Shift left

**Shift left** znači pomjeranje sigurnosnih aktivnosti ranije u SDLC: zahtjevi i threat modeling prije koda, IDE pluginovi i pre-commit provjere prije merge-a, SAST/SCA u CI prije deploymenta. Ne znači ukidanje kasnijih kontrola: DAST, pentest i runtime monitoring („shift right“) i dalje postoje. Cilj je manji trošak popravke i brža povratna informacija developeru.

> **Na ispitu:** ako tim kasno otkriva iste klase ranjivosti, BEST rješenje je sistemsko: obuka developera, secure coding standard i automatizovane provjere ranije u procesu, a ne „više pentestova“. Pentest mjeri, ne sprečava.

## Modeli zrelosti (maturity models)

### Capability Maturity Model (CMM / CMMI)

Razvio SEI (Carnegie Mellon). Pet nivoa:

| Nivo | Naziv (CMM) | CMMI naziv | Opis |
|---|---|---|---|
| 1 | **Initial** | Initial | Ad hoc, haotično, uspjeh zavisi od pojedinaca |
| 2 | **Repeatable** | Managed | Osnovno upravljanje projektima, procesi se ponavljaju na nivou projekta |
| 3 | **Defined** | Defined | Standardizovani, dokumentovani procesi na nivou organizacije |
| 4 | **Managed** | Quantitatively Managed | Procesi se mjere kvantitativno (metrike) |
| 5 | **Optimizing** | Optimizing | Kontinuirano poboljšanje na osnovu metrika |

Zamka: u originalnom CMM-u nivo 2 je „Repeatable“, a nivo 4 „Managed“; u CMMI-ju nivo 2 je „Managed“, a 4 „Quantitatively Managed“. Ključni skok je između 3 (dokumentovano) i 4 (mjereno).

### Software Assurance Maturity Model (SAMM)

**OWASP SAMM** (verzija 2) je otvoreni model za procjenu i poboljšanje sigurnosti softverskog razvoja. Pet poslovnih funkcija, svaka sa tri sigurnosne prakse, svaka praksa sa tri nivoa zrelosti:

| Poslovna funkcija | Sigurnosne prakse |
|---|---|
| **Governance** | Strategy & Metrics, Policy & Compliance, Education & Guidance |
| **Design** | Threat Assessment, Security Requirements, Security Architecture |
| **Implementation** | Secure Build, Secure Deployment, Defect Management |
| **Verification** | Architecture Assessment, Requirements-driven Testing, Security Testing |
| **Operations** | Incident Management, Environment Management, Operational Management |

Srodan model je **BSIMM** (Building Security In Maturity Model): deskriptivan, opisuje šta organizacije **zaista rade** (anketa), dok je SAMM **preskriptivan** (šta bi trebalo raditi).

| Model | Fokus | Tip |
|---|---|---|
| CMM/CMMI | Zrelost procesa razvoja uopšte | Preskriptivan, nivoi 1–5 |
| SAMM | Zrelost sigurnosti softvera | Preskriptivan, otvoren, nivoi 0–3 po praksi |
| BSIMM | Sigurnost softvera | Deskriptivan (benchmark) |

## SSDF i SBOM zahtjevi

**NIST SP 800-218 Secure Software Development Framework (SSDF)** je skup praksi visokog nivoa koje se uklapaju u bilo koji SDLC. Četiri grupe:

| Grupa | Oznaka | Primjeri praksi |
|---|---|---|
| **Prepare the Organization** | PO | Definisati sigurnosne zahtjeve, uloge, obuku, sigurna razvojna okruženja |
| **Protect the Software** | PS | Zaštita koda od neovlaštene izmjene, verifikacija integriteta izdanja (potpisi), arhiviranje izdanja |
| **Produce Well-Secured Software** | PW | Threat modeling, ponovna upotreba provjerenih komponenti, code review, testiranje, sigurne podrazumijevane postavke |
| **Respond to Vulnerabilities** | RV | Identifikacija i analiza ranjivosti, otklanjanje, analiza uzroka (root cause) |

SSDF je postao značajan kroz američki Executive Order 14028 (2021) i obavezu da dobavljači softvera federalnoj vladi potvrde usklađenost (secure software development attestation). Postoji i profil za generativnu AI (SP 800-218A).

**SBOM** je formalni, mašinski čitljiv inventar komponenti softvera (biblioteke, verzije, licence, zavisnosti, porijeklo). Formati: **SPDX** (Linux Foundation, ISO/IEC 5962) i **CycloneDX** (OWASP). NTIA je definisala minimalne elemente: ime dobavljača, ime komponente, verzija, jedinstveni identifikatori, odnos zavisnosti, autor SBOM-a i vremenska oznaka. **VEX** (Vulnerability Exploitability eXchange) dopunjava SBOM izjavom da li je poznata ranjivost u komponenti zaista iskoristiva u proizvodu.

Zašto je SBOM upravljačka tema: kada izađe kritična ranjivost u široko korištenoj biblioteci (Log4Shell 2021), organizacija sa SBOM-om za minute zna koje sisteme pogađa. Bez SBOM-a, procjena traje sedmicama. Zahtjev za SBOM se unosi u **ugovore o nabavci** i u politiku razvoja; EU Cyber Resilience Act takođe traži dokumentovane komponente.

> **Na ispitu:** SBOM je kontrola transparentnosti i upravljanja rizikom lanca snabdijevanja (supply chain), ne kontrola koja sama otklanja ranjivosti. Ako pitanje traži „najbrže utvrditi izloženost novoj ranjivosti u biblioteci kroz cijeli portfolio“, odgovor je SBOM/SCA inventar.

## Rad, održavanje i upravljanje promjenama u SDLC-u

Faza **O&M** traje najduže. Sigurnosne aktivnosti: praćenje ranjivosti komponenti, zakrpe, monitoring, periodične re-procjene i re-autorizacija kada se rizik značajno promijeni.

**Change management** u razvoju osigurava da svaka promjena bude zatražena, procijenjena (uticaj na sigurnost), odobrena, testirana, dokumentovana i da postoji plan povratka (rollback). Tipičan tok:

1. Zahtjev za promjenu (request for change, RFC),
2. Procjena uticaja (uključujući sigurnost),
3. Odobrenje (Change Advisory Board, CAB, ili automatizovana politika za standardne promjene),
4. Razvoj i testiranje u neprodukcionom okruženju,
5. Implementacija u planiranom prozoru,
6. Verifikacija i dokumentacija; zatvaranje zahtjeva.

U DevOpsu se CAB često zamjenjuje automatizovanim kontrolama (obavezni code review, testovi, policy as code, potpisani artefakti), ali princip ostaje: **nijedna promjena bez traga i odobrenja**. Hitne promjene se odobravaju naknadno, ali se uvijek dokumentuju.

## 8.2 Sigurnosne kontrole u razvojnom ekosistemu

### Programski jezici

Generacije jezika (klasika za ispit):

| Generacija | Primjeri | Opis |
|---|---|---|
| 1GL | Mašinski kod | Binarne instrukcije |
| 2GL | Asembler | Mnemonici, zavisno od arhitekture |
| 3GL | C, C++, Java, Python | Visoki nivo, kompajlirani ili interpretirani |
| 4GL | SQL, alati za izvještaje | Bliski prirodnom jeziku, deklarativni |
| 5GL | Prolog, sistemi zasnovani na ograničenjima | Rješavanje problema bez algoritma (AI) |

Kompajlirani jezici (C, Go) prave binarni kod: brži, izvorni kod se ne distribuira, ali je reverzni inženjering i dalje moguć. Interpretirani (Python, JavaScript) se izvršavaju direktno: izvorni kod je vidljiv. Hibridni (Java, C#) kompajliraju u bytecode koji izvršava virtualna mašina.

**Memory-safe jezici** (Rust, Go, Java, C#, Python, Swift) sprečavaju čitavu klasu grešaka upravljanja memorijom: buffer overflow, use-after-free, double free. C i C++ nisu memory safe. Agencije (CISA, NSA, NCSC) preporučuju **memory safety roadmap**: novi kod u memory-safe jezicima, a postojeći C/C++ uz kompajlerske zaštite (stack canaries, ASLR, DEP/NX, CFI) i strogi review. Procjene velikih proizvođača su da je oko 70% ozbiljnih ranjivosti u njihovim C/C++ kodnim bazama vezano za memorijsku sigurnost.

**Objektno orijentisano programiranje (OOP)**: pojmovi koje ispit pita:

| Pojam | Značenje | Sigurnosni značaj |
|---|---|---|
| **Encapsulation** (data hiding) | Objekat skriva interne podatke, pristup preko metoda | Smanjuje napadnu površinu, kontrolisan pristup |
| **Inheritance** | Klasa nasljeđuje osobine roditelja | Greška u roditelju se širi na djecu |
| **Polymorphism** | Isti poziv, različito ponašanje po objektu | Nepredvidivo ponašanje ako nije testirano |
| **Polyinstantiation** | Više instanci istog objekta/zapisa sa različitim vrijednostima po nivou klasifikacije | Sprečava inference u MLS bazama |
| **Cohesion** (visoka je dobra) | Koliko je modul fokusiran na jedan zadatak | Lakši review i testiranje |
| **Coupling** (niska je dobra) | Koliko modul zavisi od drugih | Manja propagacija grešaka |

### Biblioteke, alati, IDE i runtime

- **Libraries**: većina modernog koda je kod trećih strana. Kontrole: odobrena lista izvora (internal registry/proxy), pinovanje verzija i lock fajlovi, provjera integriteta (hash, potpisi), SCA, praćenje održavanja projekta. Rizici: **typosquatting**, **dependency confusion**, preuzimanje projekta od zlonamjernog održavaoca.
- **Tool sets** (kompajleri, build alati, skeneri): moraju biti iz pouzdanih izvora i verzionirani; kompromitovan build alat ugrožava svaki proizvod (primjer SolarWinds 2020: izmijenjen build proces).
- **IDE**: pluginovi i ekstenzije imaju pristup kodu i tajnama. Kontrole: odobrene ekstenzije, sigurnosni pluginovi (lint, SAST u realnom vremenu, detekcija tajni), upravljani razvojni endpointi ili cloud IDE okruženja.
- **Runtime**: okruženje izvršavanja (JVM, .NET CLR, kontejner runtime, interpreter). Kontrole: zakrpljen runtime, minimalne slike, sandboxing, least privilege, **RASP** (Runtime Application Self-Protection) koji detektuje i blokira napad iznutra aplikacije.

### CI/CD

| Faza pipelinea | Kontrola |
|---|---|
| Commit | Potpisani commitovi, pre-commit hookovi (detekcija tajni), obavezni review (branch protection) |
| Build | Izolovani, efemerni build agenti; reproducibilni buildovi; SAST, SCA; generisanje SBOM-a |
| Test | DAST/IAST u staging okruženju, testovi sigurnosnih zahtjeva |
| Artefakt | Potpisivanje artefakata, provenance (npr. SLSA nivoi), privatni registry |
| Deploy | Policy as code (admission kontrole), odvojeni kredencijali po okruženju, separation of duties |
| Runtime | Monitoring, RASP/WAF, detekcija drifta |

Pipeline je **privilegovan sistem**: ima kredencijale za produkciju. Least privilege za runnere, kratkotrajni kredencijali (OIDC federacija umjesto statičnih ključeva), zaštita konfiguracije pipelinea kao koda i separation of duties (developer ne može sam odobriti i pustiti svoj kod u produkciju).

### Software configuration management i repozitoriji koda

**Software CM** prati i kontroliše verzije izvornog koda, konfiguracija, zavisnosti i izdanja: identifikacija konfiguracionih stavki, kontrola promjena, evidencija statusa (status accounting) i revizija (configuration audit). Omogućava da se tačno zna šta je u kom izdanju i da se izdanje može ponovo izgraditi.

**Code repositories** (Git): kontrole su MFA i SSO, least privilege po repozitoriju, branch protection i obavezni pull request review, zabrana force-push na glavnu granu, skeniranje tajni, audit log pristupa, rezervne kopije. Javni repozitoriji: rizik curenja tajni i internog koda; tajne se nikad ne čuvaju u kodu, nego u vaultu.

### Testiranje sigurnosti aplikacija (AST)

| Tehnika | Šta analizira | Kada | Prednosti | Ograničenja |
|---|---|---|---|---|
| **SAST** (white box) | Izvorni kod, bytecode, binarni kod bez izvršavanja | Rano: IDE, CI | Tačna lokacija greške u kodu; rano otkrivanje | Lažni pozitivi; ne vidi runtime konfiguraciju; zavisi od jezika |
| **DAST** (black box) | Pokrenuta aplikacija spolja (HTTP zahtjevi) | Test/staging | Nezavisan od jezika; nalazi runtime i konfiguracione greške | Kasno; ne pokazuje liniju koda; pokrivenost zavisi od crawlera |
| **IAST** | Agent unutar pokrenute aplikacije prati tok podataka tokom testova | Test (QA) | Malo lažnih pozitiva, pokazuje liniju koda | Zahtijeva agenta, podržane jezike, dobre testove |
| **SCA** | Komponente trećih strana: poznate ranjivosti (CVE) i licence | Build, kontinuirano | Inventar zavisnosti, osnova za SBOM | Samo poznate ranjivosti |
| **RASP** | Agent u produkciji koji blokira napad | Runtime | Zaštita u realnom vremenu | Performanse; nije zamjena za popravku |
| **Fuzzing** | Neočekivani/nasumični ulazi | Test | Nalazi greške u parsiranju, rušenja | Zahtijeva vrijeme i instrumentaciju |

Ostale tehnike koje se pominju: **manual code review** (peer review, Fagan inspekcija kao najformalniji oblik), testiranje zloupotrebe (misuse case testing), regresiono testiranje nakon izmjena.

> **Na ispitu:** pazi na riječ u pitanju. „Prije nego što aplikacija bude pokrenuta“, „analiza izvornog koda“ → SAST. „Spolja, bez pristupa kodu, pokrenuta aplikacija“ → DAST. „Ranjive verzije biblioteka i licence“ → SCA. „Blokira napad u produkciji iz same aplikacije“ → RASP.

## 8.3 Procjena efikasnosti sigurnosti softvera

### Revizija i logovanje promjena

Efikasnost se ne može dokazati bez traga. Šta se loguje i revidira:

- promjene izvornog koda (ko, šta, kada, ko je odobrio; vezano za tiket/RFC),
- promjene konfiguracije pipelinea, okruženja i infrastrukture kao koda,
- izdanja i deploymenti (koji artefakt, koji hash, koje okruženje),
- pristup repozitorijima, tajnama i produkciji,
- izuzeci od sigurnosnih politika (npr. zaobiđen quality gate) sa obrazloženjem i rokom.

Logovi moraju biti zaštićeni od izmjene (odvojeni sistem, WORM, centralni SIEM) i periodično revidirani. **Configuration audit** provjerava da stvarno stanje odgovara odobrenom. Neovlaštena promjena otkrivena revizijom je znak slabosti procesa, ne samo pojedinačni incident.

### Analiza i ublažavanje rizika

Procjena efikasnosti povezuje nalaze sa rizikom:

- **Metrike**: broj ranjivosti po ozbiljnosti, gustina defekata (defects per KLOC), **mean time to remediate** po ozbiljnosti, procenat izdanja koja prolaze sigurnosne gate-ove, pokrivenost testovima i threat modelima, starost otvorenih nalaza.
- **Ocjena ozbiljnosti**: CVSS (tehnička ozbiljnost) + kontekst poslovnog uticaja + vjerovatnoća iskorištavanja (EPSS, CISA KEV katalog).
- **Odluke o tretmanu**: ispravka (mitigate), kompenzaciona kontrola (WAF pravilo, izolacija), prihvatanje (formalno, od vlasnika rizika, sa rokom), izbjegavanje (ukidanje funkcije), prenos (osiguranje, ugovor).
- **Acceptance testing i regresija**: nakon ispravke, verifikacija da je ranjivost uklonjena i da nisu uvedene nove.

Primjer: aplikacija ima kritičnu SQL injection ranjivost; popravka zahtijeva 3 sedmice refaktora. Odluka menadžera rizika: odmah virtual patch na WAF-u i pojačan monitoring (kompenzacija), formalno dokumentovan privremeni preostali rizik koji prihvata vlasnik aplikacije, pa trajna ispravka u kodu sa rokom. WAF sam po sebi nije kraj priče.

> **Na ispitu:** prihvatanje rizika je legitimna odluka samo ako ga donosi **vlasnik rizika** (poslovni vlasnik), informisano i dokumentovano. Developer ili sigurnosni tim ne „prihvata rizik“ tako što ostavi nalaz otvorenim.

## 8.4 Sigurnosni uticaj nabavljenog softvera

Bez obzira na izvor, odgovornost za podatke ostaje na organizaciji. Proces: definisati sigurnosne zahtjeve prije nabavke → procjena dobavljača (upitnici, SOC 2 Type II, ISO/IEC 27001, pentest izvještaji, SBOM) → ugovorne obaveze (SLA, obavještavanje o incidentima, pravo na reviziju, rokovi zakrpa, escrow) → testiranje prije uvođenja → kontinuirano praćenje.

| Tip | Vidljivost koda | Ko krpi | Glavni rizici | Ključne kontrole |
|---|---|---|---|---|
| **COTS** | Nema (crna kutija) | Dobavljač | Ranjivosti koje ne vidiš, podrazumijevane postavke, prestanak podrške (end of life), propast dobavljača | Ugovor, sertifikacije (Common Criteria), hardening, **source code escrow**, testiranje u izolaciji |
| **Managed services / enterprise aplikacije** (ERP, CRM) | Nema | Pružalac | Koncentracija podataka, privilegovani pristup pružaoca, zavisnost | SLA, pravo na reviziju, izvještaji nezavisnih revizora, kontrola pristupa pružaoca, izlazna strategija |
| **Open source** | Potpuna | Zajednica (ili ti) | Neodržavani projekti, zlonamjerni paketi, ranjive tranzitivne zavisnosti, licence (GPL copyleft) | **SCA**, odobreni registry, procjena zdravlja projekta (OpenSSF Scorecard), SBOM, politika licenci |
| **Third-party (custom, outsourcing)** | Ugovorom | Dobavljač po ugovoru | Kvalitet koda, skrivene funkcije (backdoor), vlasništvo nad kodom | Ugovorni sigurnosni zahtjevi, code review, pravo na testiranje, IP klauzule, escrow |
| **Cloud usluge** | Nema | Po modelu podijeljene odgovornosti | Pogrešna konfiguracija, nejasna podjela odgovornosti, lokacija podataka | Shared responsibility matrica, CSPM, SOC 2/CSA STAR, ugovor |

**Software escrow**: treća strana čuva izvorni kod COTS ili custom softvera; ako dobavljač propadne ili prestane podršku, kupac dobija kod. Štiti dostupnost/kontinuitet, ne povjerljivost.

### Cloud modeli i odgovornost za sigurnost softvera

| Model | Kupac odgovoran za | Provajder odgovoran za |
|---|---|---|
| **IaaS** | OS, middleware, runtime, aplikacije, podatke, IAM, mrežnu konfiguraciju gosta | Fizičku infrastrukturu, hipervizor, mrežu |
| **PaaS** | Aplikacijski kod, konfiguraciju usluge, podatke, IAM | + OS, runtime, middleware |
| **FaaS** (serverless) | Kod funkcije, zavisnosti, permisije funkcije (IAM rola), okidače, podatke | + runtime i izvršno okruženje, skaliranje |
| **SaaS** | Podatke, korisnike i njihove permisije, konfiguraciju tenant-a | Gotovo sve ostalo, uključujući aplikaciju |

Kod **FaaS**-a (U outlineu iz 2024. FaaS nije bio naveden) specifični rizici: preširoke permisije funkcije, injekcija kroz event podatke, ranjive zavisnosti u paketu funkcije, slaba vidljivost za forenziku. Cijelo se svodi na isto pravilo: **podaci i pristup su uvijek na kupcu**.

> **Na ispitu:** prije nabavke softvera prvi korak je definisati **sigurnosne zahtjeve** i provesti procjenu dobavljača (due diligence). „Kupiti pa testirati“ ili „osloniti se na marketing dobavljača“ nije ispravno. Za kontinuitet kod rizika propasti malog dobavljača → **escrow**.

## 8.5 Smjernice i standardi sigurnog kodiranja

### Slabosti i ranjivosti na nivou izvornog koda

**CWE** (Common Weakness Enumeration, MITRE) katalogizuje **slabosti** (klase grešaka), a **CVE** konkretne **ranjivosti** u proizvodima. **CWE Top 25** i **OWASP Top 10** su referentne liste. Odbrambeni pregled (bez detalja iskorištavanja):

| Klasa slabosti | Šta je problem | Primarna odbrana |
|---|---|---|
| **Injection** (SQL, OS command, LDAP) | Nepovjerljiv ulaz se tumači kao kod/upit | Parametrizovani upiti (prepared statements), validacija ulaza po allowlisti, least privilege nalog baze |
| **Cross-Site Scripting (XSS)** | Nepovjerljiv sadržaj se izvršava u pregledaču drugog korisnika | Kontekstualno enkodiranje izlaza, Content Security Policy, sigurni template sistemi |
| **Cross-Site Request Forgery (CSRF)** | Pregledač žrtve šalje autentifikovan zahtjev bez njene namjere | Anti-CSRF tokeni, SameSite kolačići, ponovna autentifikacija za kritične radnje |
| **Buffer overflow** | Upis van granica memorije | Memory-safe jezici, provjera granica, sigurne funkcije, kompajlerske zaštite (ASLR, DEP) |
| **Broken access control / IDOR** | Nedostaje provjera autorizacije na serveru | Provjera ovlaštenja za svaki objekat na serverskoj strani, deny by default |
| **Race condition / TOCTOU** | Stanje se mijenja između provjere i upotrebe | Atomične operacije, zaključavanje |
| **Insecure deserialization** | Deserijalizacija nepovjerljivih objekata | Izbjegavati, potpisani podaci, allowlista tipova |
| **Server-Side Request Forgery (SSRF)** | Server šalje zahtjeve na odredište koje bira napadač | Allowlista odredišta, mrežna segmentacija, zaštita metadata servisa |
| **Hardkodovane tajne i slaba kriptografija** | Ključevi u kodu, vlastiti algoritmi | Vault, provjerene biblioteke, nikad „roll your own crypto“ |
| **Nedostatno logovanje i greške** | Detaljne poruke grešaka, nema traga | Generičke poruke korisniku, detaljni logovi interno, bez osjetljivih podataka u logu |

Klasični pojmovi koji se i dalje pojavljuju na ispitu:

- **Backdoor / maintenance hook / trapdoor**: skriveni ulaz koji zaobilazi kontrole, često ostavljen od developera. Odbrana: code review, uklanjanje prije produkcije.
- **Logic bomb**: kod koji se aktivira pod uslovom (datum, otpuštanje).
- **Covert channel** (timing, storage): neovlašten prenos informacija kroz mehanizam koji nije namijenjen komunikaciji.
- **Citizen developers / low-code**: aplikacije van formalnog SDLC-a, potrebno upravljanje.

### Sigurnost API-ja

**OWASP API Security Top 10** ističe probleme koji su specifični za API: **Broken Object Level Authorization (BOLA)**, slaba autentifikacija, prekomjerno izlaganje svojstava objekta, neograničena potrošnja resursa, nedostatak autorizacije na nivou funkcija, SSRF, loša konfiguracija, neinventarisani („shadow“/„zombie“) API-ji, nesigurna potrošnja API-ja trećih strana.

Kontrole:

| Kontrola | Opis |
|---|---|
| Autentifikacija | OAuth 2.0 / OIDC tokeni, mTLS za servis-servis; API ključevi samo za identifikaciju, ne kao jedina zaštita |
| Autorizacija | Provjera na nivou objekta i funkcije, na serveru, za svaki zahtjev |
| Validacija | Šema (OpenAPI), stroga validacija ulaza i izlaza, odbacivanje nepoznatih polja |
| Rate limiting i kvote | Zaštita od zloupotrebe i DoS-a |
| API gateway | Centralna tačka za autentifikaciju, limite, logovanje, verzionisanje |
| Inventar | Katalog svih API-ja i verzija; povlačenje starih |
| Transport | TLS svuda |
| Logovanje | Ko je pozvao šta, bez tokena i osjetljivih podataka u logu |

REST vs SOAP: SOAP ima ugrađen **WS-Security** standard (potpis, šifrovanje na nivou poruke); REST se oslanja na TLS i token standarde (OAuth, JWT).

### Prakse sigurnog kodiranja

Izvori standarda: **OWASP ASVS** (Application Security Verification Standard, nivoi 1–3), **OWASP Secure Coding Practices**, **SEI CERT** coding standardi (po jeziku), **MISRA** (C/C++ u ugrađenim/automobilskim sistemima), **NIST SSDF** (PW praksa).

Ključne prakse:

1. **Validacija ulaza** na serveru, po allowlisti (dozvoljeno), ne po denylisti; kanonizacija prije validacije.
2. **Enkodiranje izlaza** prema kontekstu (HTML, URL, JavaScript, SQL).
3. **Autentifikacija i upravljanje sesijom** kroz provjerene okvire; sigurni kolačići (Secure, HttpOnly, SameSite); istek sesije.
4. **Autorizacija**: deny by default, provjera za svaki zahtjev, least privilege.
5. **Kriptografija**: standardni algoritmi i biblioteke, upravljanje ključevima van koda.
6. **Rukovanje greškama**: fail secure (fail closed), generičke poruke, bez stack trace-a korisniku.
7. **Logovanje**: sigurnosni događaji, zaštita integriteta, bez lozinki i ličnih podataka.
8. **Zaštita podataka**: minimizacija, šifrovanje osjetljivih podataka, bez keširanja osjetljivog sadržaja.
9. **Upravljanje zavisnostima**: odobrene, ažurne, skenirane komponente.
10. **Code review i parovno programiranje**, uz checkliste vezane za standard.

Principi dizajna (Saltzer i Schroeder) koji stoje iza praksi: least privilege, fail-safe defaults, economy of mechanism (jednostavnost), complete mediation (svaki pristup se provjerava), open design (sigurnost ne zavisi od tajnosti dizajna), separation of privilege, least common mechanism, psychological acceptability.

> **Na ispitu:** najefikasnija odbrana od injekcije je **parametrizovani upit**, a ne filtriranje specijalnih znakova ni WAF. Za XSS je to **enkodiranje izlaza** (uz validaciju ulaza). Kada pitanje traži „primarnu“ kontrolu, biraj onu u kodu; WAF je dodatni sloj.

### Napomena: software-defined security (outline 2024)

U outlineu iz 2024. cilj 8.5 je imao i tačku **software-defined security**: sigurnosne kontrole definisane i upravljane softverski (SDN segmentacija, policy as code, sigurnosne grupe kao kod, automatizovana primjena politika). U outlineu iz 2027. ta tačka je uklonjena, a sadržaj se djelimično preklapa sa CI/CD i konfiguracionim upravljanjem (8.2, 7.3).

## Scenariji za vježbu razmišljanja

**Scenarij 1.** Organizacija prelazi sa Waterfalla na Agile. Sigurnosni tim se žali da više nema „sigurnosnog gate-a“ prije produkcije. BEST pristup: ugraditi sigurnost u sprintove (sigurnosne korisničke priče, Definition of Done, security champion u timu, automatizovani SAST/SCA u CI) umjesto vraćanja jednog velikog gate-a na kraju.

**Scenarij 2.** Mali dobavljač nudi jeftin specijalizovan COTS sistem ključan za poslovanje. Najveći rizik: dobavljač propadne. Kontrola: **source code escrow** u ugovoru, uz izlaznu strategiju.

**Scenarij 3.** Objavljena je kritična ranjivost u popularnoj open source biblioteci. Šta PRVO? Utvrditi izloženost kroz SBOM/SCA inventar, pa prioritizovati po kritičnosti sistema i iskoristivosti; tek onda krpiti.

**Scenarij 4.** Revizija pokazuje da developeri mogu direktno deployati u produkciju bez reviewa. Problem: nedostatak **separation of duties** i change managementa. Rješenje: branch protection, obavezan review drugog lica, deploy samo kroz pipeline sa odobrenjem, logovanje.

## Rezime

- SDLC: sigurnost u svakoj fazi; najjeftinija u zahtjevima i dizajnu (shift left). Akreditacija/authorization = menadžment prihvata preostali rizik.
- Metodologije: Waterfall (gate-ovi, krut), Spiral (analiza rizika u svakoj iteraciji), Agile (sprintovi, sigurnost u backlogu i DoD), SAFe (Agile na nivou portfolija), DevOps/DevSecOps (automatizacija, zajednička odgovornost). IPT = multidisciplinarni tim od početka.
- Zrelost: CMM 1 Initial, 2 Repeatable, 3 Defined, 4 Managed, 5 Optimizing; SAMM: 5 funkcija × 3 prakse, preskriptivan; BSIMM deskriptivan.
- SSDF (NIST SP 800-218): PO, PS, PW, RV. SBOM (SPDX, CycloneDX) = inventar komponenti, ključan za odgovor na ranjivosti u lancu snabdijevanja; VEX dopunjava.
- Ekosistem: memory-safe jezici, OOP pojmovi (encapsulation, polyinstantiation, cohesion visoka / coupling nizak), biblioteke iz kontrolisanih izvora, pipeline kao privilegovan sistem, repozitoriji sa branch protection i skeniranjem tajni.
- AST: SAST (kod, rano), DAST (pokrenuta aplikacija spolja), IAST (agent tokom testa), SCA (komponente i licence), RASP (zaštita u produkciji), fuzzing.
- Efikasnost: logovanje i revizija promjena, metrike (MTTR, gustina defekata), tretman rizika koji odobrava vlasnik rizika.
- Nabavljeni softver: sigurnosni zahtjevi i due diligence prije nabavke; COTS (escrow, sertifikacije), open source (SCA, licence), managed/third-party (ugovor, pravo na reviziju), cloud (shared responsibility; podaci i pristup uvijek kupac; FaaS novo u 2027).
- Sigurno kodiranje: CWE/OWASP; parametrizovani upiti, enkodiranje izlaza, autorizacija na serveru, fail secure; API: autorizacija po objektu, gateway, rate limiting, inventar.
