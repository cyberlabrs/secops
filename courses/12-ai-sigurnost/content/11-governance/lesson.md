## Šta ovaj modul pokriva

Domen 6, governance i usklađenost:

- **6.1** Regulativa i standardi: **EU AI Act** (Uredba (EU) 2024/1689) sa izmjenama iz **AI Omnibusa** (Uredba (EU) 2026/1744), **NIST AI RMF 1.0** sa Generative AI profilom (NIST AI 600-1) i **ISO/IEC 42001**.
- **6.2** Upravljanje AI-jem u organizaciji: politike, inventar AI sistema, proces procjene rizika i AI dobavljača.

Ciljevi modula. Nakon ovog modula trebalo bi da znaš da:

- razlikuješ obavezujuću regulativu, dobrovoljni okvir i standard sistema upravljanja koji se može certifikovati,
- klasifikuješ slučaj upotrebe po EU AI Actu (zabranjeno, visokorizično, obaveze transparentnosti, minimalni rizik) i odrediš ulogu organizacije (pružalac ili korisnik),
- navedeš ključne rokove primjene nakon AI Omnibusa,
- povežeš zahtjeve regulative sa tehničkim kontrolama iz prethodnih modula,
- postaviš inventar AI sistema, intake proces za nove slučajeve upotrebe i procjenu AI dobavljača.

Ovaj modul nije pravni savjet. Cilj je da kao inženjer razumiješ šta pravni i compliance tim traže i kako tehničke kontrole iz kursa pružaju dokaze za to.

## Tri vrste dokumenata

| | **EU AI Act** | **NIST AI RMF 1.0** | **ISO/IEC 42001:2023** |
|---|---|---|---|
| Vrsta | Uredba EU, obavezujuća | Dobrovoljni okvir (SAD, NIST, januar 2023) | Međunarodni standard za sistem upravljanja AI-jem (**AIMS**) |
| Pristup | Po nivou rizika slučaja upotrebe; obaveze po ulozi | Četiri funkcije: GOVERN, MAP, MEASURE, MANAGE | Plan-Do-Check-Act, struktura kao ISO/IEC 27001 |
| Certifikacija | Ocjena usklađenosti i CE oznaka za visokorizične sisteme | Nema | Da, akreditovani certifikacioni organ |
| Za koga | Pružaoci, korisnici (deployeri), uvoznici, distributeri sistema na tržištu EU ili čiji se izlaz koristi u EU | Bilo koja organizacija | Bilo koja organizacija koja razvija, pruža ili koristi AI |
| Posljedica neusklađenosti | Kazne, zabrana stavljanja na tržište | Nema direktne | Gubitak certifikata |

U praksi se kombinuju: ISO/IEC 42001 daje **sistem upravljanja** (uloge, procesi, revizije), NIST AI RMF daje **metodologiju rizika** i bogat katalog praksi, a EU AI Act daje **obavezne zahtjeve** za određene sisteme.

## EU AI Act

Uredba (EU) 2024/1689 stupila je na snagu 1. 8. 2024. Primjenjuje se i na organizacije van EU ako stavljaju AI sistem na tržište EU ili se izlaz njihovog sistema koristi u EU, što je bitno i za kompanije iz regiona koje rade za klijente u EU.

### Uloge

- **Pružalac** (provider): razvija AI sistem ili model, ili ga daje razviti, i stavlja ga na tržište ili u upotrebu pod svojim imenom. Najviše obaveza.
- **Korisnik** (deployer): koristi AI sistem u okviru svoje profesionalne djelatnosti.
- Uvoznik, distributer, ovlašćeni zastupnik: obaveze u lancu distribucije.

Uloga zavisi od konkretnog sistema, ne od organizacije. Ista kompanija je deployer za komercijalnog chatbota koji koristi interno, a pružalac za proizvod koji je na tom modelu napravila i prodaje ga. Ko suštinski izmijeni visokorizični sistem ili mu promijeni namjenu tako da postane visokorizičan, može postati pružalac.

### Nivoi rizika

```text
            ┌──────────────────────────────┐
            │  ZABRANJENE PRAKSE (čl. 5)    │  npr. društveno bodovanje, manipulacija
            │  ne smiju se koristiti        │  koja nanosi štetu, iskorišćavanje ranjivosti
            ├──────────────────────────────┤
            │  VISOKORIZIČNI (čl. 6)         │  Aneks I: AI kao sigurnosna komponenta
            │  zahtjevi čl. 9–15, ocjena      │  reguliranih proizvoda; Aneks III: oblasti
            │  usklađenosti, registracija     │  kao zapošljavanje, obrazovanje, krediti
            ├──────────────────────────────┤
            │  OBAVEZE TRANSPARENTNOSTI      │  chatbot mora reći da je AI, označavanje
            │  (čl. 50)                       │  sintetičkog sadržaja, deepfake
            ├──────────────────────────────┤
            │  MINIMALNI RIZIK               │  filteri spama, preporuke u igrama;
            │  bez posebnih obaveza          │  dobrovoljni kodeksi
            └──────────────────────────────┘
    + posebno poglavlje za AI MODELE OPŠTE NAMJENE (GPAI), sa dodatnim obavezama za modele sa sistemskim rizikom
```

**Aneks III** navodi oblasti u kojima su sistemi visokorizični: biometrija, kritična infrastruktura, obrazovanje i stručno osposobljavanje, zapošljavanje i upravljanje radnicima, pristup bitnim privatnim i javnim uslugama (npr. ocjena kreditne sposobnosti, procjena rizika i cijene za životno i zdravstveno osiguranje), provođenje zakona, migracije i granična kontrola, pravosuđe i demokratski procesi. Član 6(3) dozvoljava izuzetak kad sistem iz Aneksa III ne predstavlja značajan rizik (npr. obavlja usku proceduralnu radnju), ali sistem koji vrši profilisanje fizičkih lica ostaje visokorizičan; pružalac koji se poziva na izuzetak mora dokumentovati procjenu.

### Zahtjevi za visokorizične sisteme i veza sa tehnikom

| Član | Zahtjev | Tehnička kontrola iz kursa |
|---|---|---|
| 9 | Sistem upravljanja rizikom kroz cijeli životni ciklus | Modelovanje prijetnji (modul 2), procjena rizika, evaluacija |
| 10 | Podaci i upravljanje podacima: kvalitet, porijeklo, pristrasnost | Porijeklo skupova, AI-BOM (moduli 7, 9) |
| 11 | Tehnička dokumentacija | Model card, AI-BOM, arhitektura, rezultati evaluacije |
| 12 | Vođenje evidencije (automatski logovi) | Telemetrija sa verzijama i traceovima (modul 10) |
| 13 | Transparentnost i uputstva za korisnike | Dokumentacija o namjeni i ograničenjima |
| 14 | Ljudski nadzor | Human-in-the-loop, kill switchevi (moduli 5, 10) |
| 15 | Tačnost, robusnost i kibernetička sigurnost, uključujući otpornost na trovanje podataka i modela, adversarial primjere i napade na povjerljivost | Odbrane iz modula 3–9, red teaming (modul 10) |

Član 15 je mjesto gdje se AI Act direktno oslanja na sigurnosni inženjering: zahtijeva mjere protiv napada koje smo prošli kroz ATLAS i NIST AI 100-2.

Korisnici (deployeri) visokorizičnih sistema imaju svoje obaveze (član 26): koristiti sistem prema uputstvima, obezbijediti ljudski nadzor kompetentnih osoba, čuvati logove koji su pod njihovom kontrolom, pratiti rad i prijaviti probleme. Određeni deployeri (npr. javna tijela i oni koji pružaju javne usluge, te za ocjenu kreditne sposobnosti i osiguranje) rade i **procjenu uticaja na osnovna prava** (FRIA, član 27).

### Transparentnost i GPAI

**Član 50** važi bez obzira na to da li je sistem visokorizičan: korisnici moraju znati da komuniciraju sa AI sistemom (osim kad je to očigledno), sintetički sadržaj mora biti mašinski označen, a deepfake sadržaj označen kao takav.

Za **modele opšte namjene** (GPAI) pružaoci vode tehničku dokumentaciju, daju informacije pružaocima koji model ugrađuju u svoje sisteme, imaju politiku poštovanja autorskih prava i objavljuju sažetak sadržaja za treniranje (član 53). Modeli sa **sistemskim rizikom** (pretpostavka kod računa za treniranje iznad 10^25 FLOP) dodatno rade evaluacije uključujući adversarial testiranje, procjenu i ublažavanje sistemskih rizika, praćenje i prijavu ozbiljnih incidenata i odgovarajuću kibernetičku zaštitu (član 55). Kodeks prakse za GPAI (2025) je dobrovoljan način da se pokaže usklađenost.

**Član 4** traži mjere za **AI pismenost** osoblja koje radi sa AI sistemima. AI Omnibus je mijenjao i ovu odredbu, pa tačnu formulaciju provjeri u konsolidovanom tekstu.

### Rokovi nakon AI Omnibusa

| Datum | Šta počinje da važi |
|---|---|
| 1. 8. 2024 | Stupanje na snagu Uredbe 2024/1689 |
| 2. 2. 2025 | Zabranjene prakse (čl. 5), AI pismenost (čl. 4) |
| 2. 8. 2025 | Obaveze za GPAI modele, upravljačka struktura, kazne |
| 2. 8. 2026 | Većina ostalih odredbi, uključujući obaveze transparentnosti (čl. 50) |
| 27. 7. 2026 | Na snazi AI Omnibus, Uredba (EU) 2026/1744 |
| najkasnije 2. 12. 2027 | Obaveze za visokorizične sisteme iz **Aneksa III** |
| najkasnije 2. 8. 2028 | Obaveze za visokorizične sisteme iz **Aneksa I** (AI u reguliranim proizvodima) |

Omnibus primjenu obaveza za visokorizične sisteme vezuje i za dostupnost podrške za usklađivanje (harmonizovani standardi, smjernice), pa obaveze mogu početi i ranije od navedenih krajnjih rokova ako Komisija potvrdi da je podrška dostupna. Uveo je i druge izmjene (npr. proširenje olakšica za manja preduzeća). Za konkretne obaveze uvijek čitaj konsolidovani tekst i smjernice Komisije.

Kazne (član 99) idu do 35 miliona eura ili 7% ukupnog godišnjeg prometa za zabranjene prakse, do 15 miliona ili 3% za većinu drugih obaveza i do 7,5 miliona ili 1% za netačne informacije nadležnim organima, uz blaža pravila za mala i srednja preduzeća.

> **U praksi:** odgađanje rokova za visokorizične sisteme nije razlog da se čeka. Inventar, klasifikacija, logovanje, ljudski nadzor i tehnička dokumentacija traže mjesece, a većina tih kontrola ti treba i zbog sigurnosti, bez obzira na regulativu. Zabrane, GPAI obaveze i AI pismenost već važe.

### Klasifikacija slučajeva upotrebe

Klasifikaciju radi pravni tim, ali inženjeri daju činjenice: šta sistem radi, nad kim, koju odluku podržava i ko donosi konačnu odluku. Pojednostavljen pomoćni alat za trijažu (ne zamjenjuje pravnu procjenu):

```python
PROHIBITED = {"social_scoring", "harmful_manipulation", "untargeted_face_scraping",
              "emotion_recognition_workplace_or_school"}
ANNEX_III = {"biometrics", "critical_infrastructure", "education", "employment",
             "essential_services", "law_enforcement", "migration", "justice_democracy"}
TRANSPARENCY = {"chatbot", "synthetic_content", "deepfake", "emotion_recognition_other"}

def triage(use_case: dict) -> dict:
    tags = set(use_case["tags"])
    if tags & PROHIBITED:
        return {"class": "prohibited", "action": "zaustaviti, pravni tim"}
    if use_case.get("annex_i_safety_component"):
        return {"class": "high_risk_annex_i", "action": "pravni tim, rok najkasnije 2. 8. 2028"}
    if tags & ANNEX_III:
        if use_case.get("profiling") or not use_case.get("art_6_3_exception_documented"):
            return {"class": "high_risk_annex_iii", "action": "zahtjevi čl. 9–15 / čl. 26"}
    result = {"class": "minimal", "action": "standardna sigurnosna procjena"}
    if tags & TRANSPARENCY:
        result = {"class": "transparency", "action": "čl. 50: obavijest i označavanje"}
    return result

print(triage({"name": "CV screening", "tags": ["employment"], "profiling": True}))
# {'class': 'high_risk_annex_iii', 'action': 'zahtjevi čl. 9–15 / čl. 26'}
```

Primjeri:

| Slučaj upotrebe | Vjerovatna klasa | Zašto |
|---|---|---|
| Rangiranje kandidata za posao na osnovu CV-ja | Visokorizičan (Aneks III, zapošljavanje) | Utiče na pristup zaposlenju, profilisanje |
| Ocjena kreditne sposobnosti fizičkih lica | Visokorizičan (Aneks III, bitne usluge) | Pristup finansijskim uslugama |
| Chatbot podrške na web stranici | Obaveze transparentnosti (čl. 50) | Korisnik mora znati da razgovara sa AI-jem |
| Generisanje marketinških slika | Transparentnost (označavanje sintetičkog sadržaja) | Sintetički sadržaj |
| Interni asistent za pretragu dokumentacije | Minimalni rizik | Ne odlučuje o pravima ljudi; i dalje treba sigurnosne kontrole |
| Prepoznavanje emocija zaposlenih na radnom mjestu | Zabranjeno (uz uske izuzetke, npr. medicinski ili sigurnosni razlozi) | Član 5 |

## NIST AI RMF i Generative AI profil

**NIST AI RMF 1.0** organizuje upravljanje rizikom u četiri funkcije:

| Funkcija | Šta radi | Primjer aktivnosti |
|---|---|---|
| **GOVERN** | Kultura, politike, uloge, odgovornost; prožima ostale funkcije | AI politika, RACI, obuka, procjena dobavljača |
| **MAP** | Kontekst: namjena, korisnici, uticaj, rizici | Intake upitnik, model prijetnji, klasifikacija |
| **MEASURE** | Mjerenje i praćenje rizika | Evaluacija, red teaming, metrike, monitoring |
| **MANAGE** | Prioritizacija i postupanje sa rizicima | Kontrole, odluka o prihvatanju rizika, odgovor na incidente |

Okvir definiše osobine pouzdanog AI-ja: validan i pouzdan; bezbjedan; siguran i otporan (secure and resilient); odgovoran i transparentan; objašnjiv i interpretabilan; sa zaštitom privatnosti; pravičan, uz upravljanje štetnom pristrasnošću. Uz okvir ide **Playbook** sa predloženim aktivnostima za svaku podkategoriju.

**NIST AI 600-1** (Generative AI Profile, jul 2024) primjenjuje RMF na generativni AI i navodi 12 rizika, među kojima su konfabulacija, informaciona sigurnost, privatnost podataka, intelektualna svojina, integritet informacija, konfiguracija čovjek–AI i integritet lanca vrijednosti i integracije komponenti. Za svaki rizik predlaže radnje mapirane na funkcije RMF-a.

Za sigurnosne timove važna je i **NIST AI 100-2** (taksonomija adversarial mašinskog učenja, izdanje 2025), koja daje zajednički rječnik napada (evasion, poisoning, privacy, misuse, direktni i indirektni prompt injection) korišćen kroz ovaj kurs.

## ISO/IEC 42001

**ISO/IEC 42001:2023** je prvi standard za **sistem upravljanja AI-jem**. Ako tvoja organizacija ima ISO/IEC 27001, struktura će ti biti poznata:

- klauzule 4–10: kontekst organizacije, liderstvo, planiranje (procjena i tretman AI rizika, **procjena uticaja AI sistema**), podrška, operacije, ocjena performansi, poboljšanje,
- **Aneks A**: referentne kontrole (politike za AI, interna organizacija, resursi, procjena uticaja, životni ciklus AI sistema, podaci, informacije za zainteresovane strane, upotreba AI sistema, odnosi sa trećim stranama),
- Aneks B: smjernice za implementaciju kontrola; Aneks C: mogući ciljevi i izvori rizika; Aneks D: upotreba u različitim domenima i sektorima.

Kao i kod 27001, organizacija pravi **izjavu o primjenljivosti** (Statement of Applicability) za kontrole iz Aneksa A. Srodni standardi: ISO/IEC 23894 (smjernice za upravljanje AI rizikom), ISO/IEC 42005 (procjena uticaja AI sistema) i ISO/IEC 42006 (zahtjevi za tijela koja auditiraju i certifikuju AIMS).

> **U praksi:** ako već imaš ISMS po 27001, nemoj praviti paralelni sistem za AI. Proširi postojeći: isti proces upravljanja rizikom, isti interni audit i upravljački pregled, dodatne kontrole iz Aneksa A 42001 i AI-specifični rizici u registru rizika. Auditori i uprava tako vide jednu sliku, a ne dva sistema koji se ne slažu.

## Upravljanje AI-jem u organizaciji

### Politike i uloge

Minimalni skup:

- **Politika prihvatljive upotrebe AI-ja**: koji alati su odobreni, koje klase podataka smiju u njih (npr. javni i interni da, povjerljivi samo u odobrene instance sa ugovorom), zabranjene upotrebe, obaveza ljudske provjere izlaza.
- **Politika razvoja AI sistema**: intake, procjena rizika, obavezne kontrole (iz modula 3–10), gate za lansiranje, monitoring.
- **Uloge**: vlasnik AI sistema (poslovna odgovornost), tehnički vlasnik, AI governance tijelo (pravni, sigurnost, privatnost, poslovanje), DPO za lične podatke.

### Inventar AI sistema

Ne možeš upravljati onim što ne znaš da postoji. Inventar obuhvata i interno razvijene sisteme, i AI funkcije u kupljenim SaaS proizvodima, i alate koje zaposleni koriste („**shadow AI**“).

```yaml
# ai-inventory/tiketi-asistent.yaml
id: ai-0042
name: tiketi-asistent
owner: podrska@firma.example            # poslovni vlasnik
tech_owner: platform-ml@firma.example
role_eu_ai_act: deployer                # model dobavljača, interna upotreba
risk_class: minimal                     # rezultat trijaže + pravna potvrda
transparency_art50: true                # korisnici znaju da je asistent AI
model:
  provider: vendor-x
  name: vendor-x-large
  version_pin: "2026-07"
data_classes: [internal, personal_pseudonymized]
capabilities: { rag: true, tools: [search_kb, create_ticket], autonomy: confirm_writes }
controls: [doc-level-acl, tool-allowlist, output-schema, telemetry, eval-ci]
aibom: registry://tiketi-asistent/3.2.0/aibom.cdx.json
assessments:
  - { type: security, date: 2026-08-12, result: approved }
  - { type: dpia, date: 2026-08-20, result: approved }
review_due: 2027-02-01
```

Izvori za popunjavanje: CASB i proxy logovi (koji AI servisi se koriste), troškovi u cloudu i karticama (pretplate na AI alate), nabavka (ugovori sa AI funkcijama), registry modela, API ključevi dobavljača modela u secret manageru.

> **U praksi:** shadow AI se ne rješava zabranom. Ako je jedini odobreni put spor ili ne postoji, ljudi će lijepiti povjerljive podatke u javne alate. Ponudi odobrenu alternativu (enterprise instanca sa ugovorom koji isključuje treniranje na tvojim podacima), jednostavan intake od jedne stranice i jasnu listu šta je dozvoljeno, pa tek onda blokiraj nedozvoljene servise na proxyju.

### Proces procjene rizika

```text
 intake (1 stranica) ──► trijaža ──► klasifikacija ──► procjena ──► odluka ──► monitoring
   namjena, podaci,      minimalni:     EU AI Act       sigurnost      odobreno /    periodični
   korisnici, model,     brzi put       (pravni tim),   (modul 2),     uslovi /      pregled,
   alati, autonomija     ostali:        uloga           DPIA, FRIA      odbijeno     incidenti,
                         puna procjena                  ako treba                    izmjene → ponovo
```

Procjena bira kontrole prema rizicima, ne prema listi „sve za sve“. Interni asistent sa RAG-om nad javnom dokumentacijom traži manje od agenta koji piše u ERP. Svaka značajna izmjena (novi model, novi alat, nova klasa podataka, nova grupa korisnika) vraća sistem u procjenu.

### AI dobavljači

Većina organizacija AI koristi kroz dobavljače: API modela, SaaS sa AI funkcijama, gotove agente. Pitanja za procjenu dobavljača:

| Oblast | Pitanje | Zašto |
|---|---|---|
| Korištenje podataka | Da li se naši ulazi i izlazi koriste za treniranje? Može li se isključiti ugovorom? | Curenje i intelektualna svojina |
| Retencija i lokacija | Koliko dugo se čuvaju ulazi i logovi, gdje se obrađuju, ko su podobrađivači? | GDPR, povjerljivost |
| Sigurnost | Certifikati (ISO/IEC 27001, 42001, SOC 2), rezultati red teaminga, odgovor na prijavu ranjivosti | Zrelost dobavljača |
| Promjene modela | Da li se model mijenja bez najave? Može li se pinovati verzija? | Regresije, ponovljivost evaluacije |
| Incidenti | Rok i način obavještavanja o incidentima | Tvoje obaveze obavještavanja (modul 10) |
| Logovi i nadzor | Kakvu telemetriju dobijamo (korisnici, upiti, pozivi alata)? | Detekcija i istraga |
| Regulativa | Uloga po EU AI Actu; za GPAI dokumentacija za pružaoce nizvodno (čl. 53) | Tvoja usklađenost zavisi od njihovih informacija |
| Agenti i integracije | Koja prava traži integracija (OAuth scope), da li podržava najmanje privilegije? | Excessive agency u tuđem proizvodu |

> **U praksi:** najčešći propust u ugovorima je nedostatak obaveze najave promjene modela. Dobavljač zamijeni model, tvoji guardraili i evaluacije su kalibrisani za stari, a ponašanje se promijeni preko noći. Traži mogućnost pinovanja verzije i rok najave, i pokreni svoju evaluaciju (modul 10) prije prelaska na novu verziju.

## Dokazi: od kontrole do artefakta

Auditor (interni, certifikacioni ili nadležni organ) ne pita „da li imate logovanje“, nego „pokažite“. Dobar governance program unaprijed zna koji tehnički artefakt dokazuje koju kontrolu i gdje se čuva:

| Zahtjev | Dokaz | Ko ga proizvodi | Gdje se čuva |
|---|---|---|---|
| Inventar i klasifikacija | Zapis u inventaru sa klasom rizika i ulogom, potvrda pravnog tima | Vlasnik sistema, pravni tim | Repozitorij inventara (verzionisan) |
| Tehnička dokumentacija (čl. 11) | Model card, AI-BOM, dijagram arhitekture, opis podataka | Pipeline (automatski) + tehnički vlasnik | Registry modela, uz verziju |
| Upravljanje rizikom (čl. 9) | Model prijetnji, registar rizika, odluke o prihvatanju rizika | Sigurnost, vlasnik sistema | GRC alat |
| Robusnost i sigurnost (čl. 15) | Rezultati evaluacije u CI-ju, izvještaji red teama, status nalaza | CI, red team | Artefakti CI joba, tiketi |
| Vođenje evidencije (čl. 12) | Konfiguracija telemetrije, uzorak logova, politika retencije | Platforma | SIEM, log skladište |
| Ljudski nadzor (čl. 14) | Konfiguracija autonomije i potvrda, logovi potvrda, obuka operatera | Tehnički vlasnik, HR | Konfiguracija, LMS |
| Upravljanje dobavljačima | Popunjen upitnik, ugovor (treniranje, retencija, najava promjena, incidenti) | Nabavka, sigurnost | Ugovorni sistem |
| AI pismenost (čl. 4) | Program obuke, evidencija završenih obuka po ulozi | HR, sigurnost | LMS |

Primjer automatske provjere u CI-ju: release AI sistema pada ako u inventaru nema svježe procjene ili ako nedostaju obavezni artefakti.

```python
import datetime, sys, yaml   # PyYAML ili ekvivalentan parser

entry = yaml.safe_load(open(sys.argv[1]))          # ai-inventory/<sistem>.yaml
errors = []
for field in ("owner", "risk_class", "role_eu_ai_act", "aibom"):
    if not entry.get(field):
        errors.append(f"nedostaje polje: {field}")
if entry.get("risk_class") == "prohibited":
    errors.append("zabranjena klasa: release nije dozvoljen")
if datetime.date.fromisoformat(str(entry["review_due"])) < datetime.date.today():
    errors.append("istekao rok za ponovnu procjenu")
if not any(a["type"] == "security" and a["result"] == "approved" for a in entry.get("assessments", [])):
    errors.append("nema odobrene sigurnosne procjene")
print("\n".join(errors) or "governance gate OK")
sys.exit(1 if errors else 0)
```

Česte greške u governance programima:

- inventar napravljen jednom, bez vlasnika i roka za pregled,
- klasifikacija bez tehničkih činjenica (pravni tim ne zna da sistem ima alat koji piše u ERP),
- politika koja zabranjuje sve, pa se zaobilazi,
- procjena dobavljača koja ne pita za korištenje podataka za treniranje i promjene modela,
- dokumentacija pisana ručno za audit, koja ne odgovara sistemu u produkciji.

## Mapiranje okvira

| Tema | EU AI Act | NIST AI RMF | ISO/IEC 42001 |
|---|---|---|---|
| Politike i odgovornost | Obaveze pružaoca i korisnika, AI pismenost (čl. 4) | GOVERN | Klauzula 5, Aneks A (politike, interna organizacija) |
| Inventar i kontekst | Klasifikacija, registracija visokorizičnih | MAP | Klauzula 4, Aneks A (životni ciklus, resursi) |
| Procjena rizika i uticaja | Čl. 9, FRIA (čl. 27) | MAP, MEASURE | Klauzula 6, procjena uticaja |
| Testiranje i mjerenje | Čl. 15, čl. 55 (adversarial testiranje GPAI) | MEASURE | Klauzula 9, Aneks A (životni ciklus) |
| Logovi i nadzor | Čl. 12, čl. 26 | MEASURE, MANAGE | Klauzule 8–9 |
| Incidenti | Čl. 73, čl. 55 | MANAGE | Klauzula 10 |
| Dobavljači | Obaveze u lancu, čl. 53 informacije za pružaoce nizvodno | GOVERN | Aneks A (odnosi sa trećim stranama) |

## Rezime

- **EU AI Act** je obavezujuća uredba po nivoima rizika: zabranjene prakse (čl. 5), visokorizični sistemi (čl. 6, Aneks I i III, zahtjevi čl. 9–15), obaveze transparentnosti (čl. 50), minimalni rizik, uz posebno poglavlje za GPAI modele (čl. 53, 55).
- Obaveze zavise od **uloge** za konkretan sistem (pružalac ili korisnik); izmjena namjene može korisnika učiniti pružaocem.
- **AI Omnibus** (Uredba (EU) 2026/1744, na snazi od 27. 7. 2026) pomjerio je obaveze za visokorizične sisteme: Aneks III najkasnije od 2. 12. 2027, Aneks I najkasnije od 2. 8. 2028. Zabrane, GPAI obaveze i transparentnost se primjenjuju ranije.
- Član 15 (tačnost, robusnost, kibernetička sigurnost) i član 12 (logovi) se direktno oslanjaju na tehničke kontrole iz ovog kursa.
- **NIST AI RMF 1.0**: GOVERN, MAP, MEASURE, MANAGE; **AI 600-1** dodaje 12 rizika generativnog AI-ja; **AI 100-2** daje taksonomiju napada.
- **ISO/IEC 42001** je certifikabilan sistem upravljanja AI-jem sa kontrolama u Aneksu A; uklopi ga u postojeći ISMS po 27001.
- U organizaciji: politika prihvatljive upotrebe, inventar (uključujući shadow AI i AI u SaaS-u), intake i trijaža, procjena rizika proporcionalna sistemu, ponovna procjena pri značajnim izmjenama.
- Kod dobavljača provjeri korištenje podataka za treniranje, retenciju i lokaciju, pinovanje verzije modela i najavu promjena, obavještavanje o incidentima i telemetriju koju dobijaš.
