## Šta ovaj modul pokriva

Uvodni modul kursa pokriva dva cilja iz domena 1:

- **1.1** Pejzaž prijetnji za AI/ML sisteme i taksonomije: **NIST AI 100-2 E2025** i **MITRE ATLAS**.
- **1.2** **OWASP Top 10 for LLM Applications 2025** i **OWASP Top 10 for Agentic Applications 2026**.

Nakon modula treba da znaš:

- po čemu se AI sistem razlikuje od klasične aplikacije sa stanovišta napadne površine;
- kako NIST AI 100-2 klasifikuje napade (faza učenja, cilj napadača, sposobnosti, znanje);
- kako je organizovan MITRE ATLAS (taktike, tehnike, mitigacije, studije slučaja) i kako ga koristiš u detekciji i izvještajima;
- svih deset stavki OWASP Top 10 za LLM i deset stavki za agentne aplikacije, sa tipičnom kontrolom za svaku;
- koji okvir koristiš za koju svrhu (komunikacija sa developerima, mapiranje detekcija, risk registar).

Ovaj modul je mapa. Ostali moduli kursa popunjavaju je kontrolu po kontrolu.

## Zašto AI sistem traži poseban pogled

Klasična web aplikacija ima jasnu granicu između **koda** (ono što programer napiše) i **podataka** (ono što korisnik pošalje). Cijela disciplina sigurne obrade ulaza (parametrizovani upiti, escaping, validacija) počiva na toj granici.

LLM aplikacija tu granicu briše: model prima instrukcije i podatke **u istom kanalu**, kao tekst, i ne postoji pouzdan mehanizam koji mu garantuje da će razlikovati jedno od drugog. Uz to:

- **Ponašanje je probabilističko.** Isti ulaz može dati različit izlaz; test koji je jednom prošao ne dokazuje da će uvijek proći.
- **Model je artefakt lanca snabdijevanja.** Težine, tokenizer, skupovi podataka i biblioteke dolaze od trećih strana, često kao veliki binarni fajlovi.
- **Podaci su napadna površina.** Ko utiče na podatke za treniranje, fino podešavanje ili RAG indeks, utiče na ponašanje sistema.
- **Agenti djeluju.** Kad model poziva alate (API, baza, shell, e-mail), greška modela postaje akcija u stvarnom sistemu.

Tipična arhitektura sa granicama povjerenja:

```text
 Korisnik ──► [ API gateway / auth ] ──► [ Aplikacija (orkestrator) ] ──► [ LLM (vlastiti ili API dobavljača) ]
                                          │        ▲        │
                                          │        │        └──► [ Alati: API, DB, e-mail ]   ← granica: akcije
                                          ▼        │
                              [ Retrieval / vektorska baza ] ◄── [ Ingest dokumenata ]        ← granica: nepovjerljiv sadržaj
                                          │
 ML pipeline: [ podaci ] ─► [ treniranje / fine-tuning ] ─► [ registar modela ] ─► [ serving ] ← granica: lanac snabdijevanja
```

Svaka strelica preko granice je mjesto gdje biraš kontrolu. Okviri u ovom modulu ti daju zajednički jezik da te rizike imenuješ.

### Ko napada i šta želi

Pejzaž prijetnji nije samo lista tehnika. Korisno je razmišljati o akterima i njihovim ciljevima, jer od toga zavisi koje kontrole imaju prioritet:

| Akter | Tipičan cilj | Gdje dolazi u dodir sa sistemom |
|---|---|---|
| Zlonamjerni korisnik aplikacije | zaobići ograničenja, dobiti tuđe podatke, besplatno trošiti resurse | chat/API ulaz |
| Treća strana bez naloga | uticati na sistem preko sadržaja koji on čita | web stranice, e-mailovi, dokumenti, tiketi |
| Kompromitovan dobavljač ili repozitorij | ubaciti zlonamjeran model, biblioteku ili alat | ML pipeline, registar, MCP serveri |
| Insajder sa pristupom podacima | zatrovati skup podataka, izvući model ili podatke | pipeline podataka, registar modela |
| Konkurent ili istraživač | replicirati model, izvući podatke o treniranju | API za inferencu |
| Slučajna greška (nije napad) | nema cilja, ali nastaje šteta: halucinacija, pogrešna akcija agenta | svuda |

Posljednji red je važan: veliki dio AI incidenata nastaje bez napadača. Kontrole koje ograničavaju posljedice (najmanje privilegije, potvrda, validacija izlaza) štite i od napada i od grešaka modela.

### Posljedice koje mjeriš

Za procjenu rizika posljedice grupiši na isti način kao kod drugih sistema:

- **povjerljivost**: curenje ličnih podataka, tajni, sistemskog prompta, podataka drugih tenanata, samog modela;
- **integritet**: pogrešne odluke, izmijenjeni podaci, neovlašćene akcije agenta, zatrovan indeks ili model;
- **dostupnost i trošak**: iscrpljivanje GPU kapaciteta, kvota ili budžeta (denial of wallet);
- **šteta van sistema**: pogrešne informacije korisnicima, pravne i reputacione posljedice (ATLAS ih grupiše pod **AML.T0048 External Harms**).

> **U praksi:** kad tim kaže „mi samo zovemo API dobavljača, model nije naš problem“, pokaži mu dijagram. Model dobavljača je jedna kutija; sve ostalo (prompt, retrieval, alati, obrada izlaza, logovi) je tvoja odgovornost i tu nastaje većina incidenata.

## NIST AI 100-2 E2025: taksonomija adversarial ML

**NIST AI 100-2 E2025**, *Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations* (mart 2025), je referentni rječnik za napade na ML sisteme. Ne propisuje kontrole; daje klasifikaciju i terminologiju da timovi, dobavljači i regulatori govore istim jezikom. Dokument je podijeljen na **prediktivnu AI (PredAI)** i **generativnu AI (GenAI)**.

### Dimenzije klasifikacije

| Dimenzija | Vrijednosti | Zašto ti treba |
|---|---|---|
| Faza učenja | treniranje (training time) / upotreba (deployment time) | određuje gdje stavljaš kontrolu: u pipeline podataka ili u serving |
| Cilj napadača | **availability breakdown**, **integrity violation**, **privacy compromise**; za GenAI i **misuse enablement** | povezuje napad sa CIA svojstvom koje štitiš |
| Sposobnosti | kontrola podataka za treniranje, kontrola modela, kontrola testnih ulaza, kontrola labela, kontrola izvornog koda, pristup upitima (query access); kod GenAI i kontrola resursa koje model čita | govori koju sposobnost napadaču oduzimaš kontrolom |
| Znanje | white-box, black-box, gray-box | utiče na realnu procjenu vjerovatnoće |

Taksonomija dodjeljuje oznake: **NISTAML.01** (availability), **NISTAML.02** (integrity), **NISTAML.03** (privacy), **NISTAML.04** (misuse), **NISTAML.05** (napadi na lanac snabdijevanja). Oznake su korisne u risk registru kad želiš uputiti na definiciju, a ne prepričavati je.

### Klase napada na PredAI

- **Evasion** (izbjegavanje): izmijenjen ulaz u fazi upotrebe izaziva pogrešnu klasifikaciju. Odbrana: adversarial training, provjera robusnosti, ograničavanje uticaja jedne odluke modela, ljudska provjera za kritične odluke.
- **Poisoning** (trovanje): availability poisoning (opšta degradacija), targeted poisoning (pogrešno ponašanje na određenim uzorcima), backdoor poisoning (skriveni okidač), model poisoning (direktna izmjena parametara, npr. u federativnom učenju). Odbrana: porijeklo i integritet podataka, sanitizacija, kontrola ko smije mijenjati skupove, validacija modela prije objave.
- **Privacy** napadi: rekonstrukcija podataka, **membership inference**, property inference i **model extraction**. Odbrana: kontrola pristupa i ograničenje upita, minimizacija izlaza (bez nepotrebnih confidence vrijednosti), diferencijalna privatnost pri treniranju, nadzor obrazaca upita.

### Klase napada na GenAI

- **Supply chain** napadi: trovanje podataka i modela koji dolaze od trećih strana, uključujući zlonamjerni kod u formatima modela (modul 08).
- **Direct prompting** napadi: korisnik direktno šalje unos koji pokušava zaobići ograničenja (jailbreak) ili izvući informacije (npr. sistemski prompt, podatke iz konteksta).
- **Indirect prompt injection**: instrukcije stižu kroz sadržaj koji model čita (web stranica, e-mail, dokument u RAG-u, izlaz alata). Može ciljati dostupnost, integritet ili privatnost.
- Poseban odjeljak posvećen je **sigurnosti agenata**, jer agent pretvara uspješan napad u akciju.

Važna poruka dokumenta za inženjera: za mnoge od ovih napada **ne postoji potpuna mitigacija**. NIST eksplicitno navodi kompromise između tačnosti, robusnosti i privatnosti. Zato se odbrana gradi kao **defense in depth** na nivou sistema, ne kao jedan filter ispred modela.

> **U praksi:** NIST AI 100-2 koristi kad pišeš politiku ili odgovaraš regulatoru i treba ti neutralna, precizna definicija („membership inference prema NIST AI 100-2“). Za dnevni rad SOC-a praktičniji je ATLAS, a za developere OWASP.

## MITRE ATLAS

**MITRE ATLAS** (Adversarial Threat Landscape for Artificial-Intelligence Systems) je baza znanja o taktikama i tehnikama protivnika protiv AI sistema, modelovana po uzoru na **MITRE ATT&CK**. Ako tvoj SOC već mapira detekcije na ATT&CK, ATLAS je prirodan nastavak.

### Struktura

- **Taktike** (`AML.TA00xx`): *zašto* napadač nešto radi (cilj u fazi napada).
- **Tehnike i podtehnike** (`AML.T00xx`, `AML.T00xx.00y`): *kako* postiže cilj.
- **Mitigacije** (`AML.M00xx`): kontrole povezane sa tehnikama.
- **Studije slučaja** (`AML.CS00xx`): dokumentovani stvarni incidenti i demonstracije istraživača.

Taktike koje ATLAS dijeli sa ATT&CK-om (Reconnaissance, Initial Access, Execution, Persistence, Exfiltration, Impact…) dopunjene su dvjema specifičnim za AI:

| Taktika | ID | Smisao |
|---|---|---|
| AI Model Access | AML.TA0000 | napadač stiče pristup modelu (API za inferencu, proizvod koji koristi model, fizičko okruženje) |
| AI Attack Staging | AML.TA0001 | priprema napada specifičnog za model (npr. zamjenski model, priprema adversarial podataka) |

### Tehnike koje ćeš najčešće sretati (apstraktno)

| Tehnika | ID | Odbrambeni fokus |
|---|---|---|
| LLM Prompt Injection (Direct / Indirect) | AML.T0051 (.000 / .001) | granice povjerenja, razdvajanje privilegija (modul 03) |
| LLM Jailbreak | AML.T0054 | guardrails, ograničenje posljedica, monitoring |
| Extract LLM System Prompt | AML.T0056 | bez tajni u promptu, autorizacija van modela (modul 04) |
| LLM Data Leakage | AML.T0057 | minimizacija konteksta, filtriranje izlaza (modul 04) |
| AI Agent Tool Invocation | AML.T0053 | allowlista alata, najmanje privilegije (modul 05) |
| RAG Poisoning | AML.T0070 | kontrola ingest-a, porijeklo dokumenata (modul 06) |
| Poison Training Data | AML.T0020 | porijeklo i integritet podataka (modul 07) |
| AI Supply Chain Compromise | AML.T0010 | sigurni formati, potpisi, AI-BOM (modul 08) |
| Exfiltration via AI Inference API | AML.T0024 | ograničenje upita, nadzor (modul 09) |
| Cost Harvesting / Denial of AI Service | AML.T0034 / AML.T0029 | kvote, rate limiting (modul 05) |

Primjeri ATLAS mitigacija: **AML.M0020 Generative AI Guardrails**, **AML.M0024 AI Telemetry Logging**, **AML.M0023 AI Bill of Materials**, **AML.M0014 Verify AI Artifacts**, **AML.M0029 Human In-the-Loop for AI Agent Actions**, **AML.M0030 Restrict AI Agent Tool Invocation on Untrusted Data**.

ATLAS se redovno dopunjuje (posebno tehnikama za agente), a pojedine tehnike se preimenuju. U izvještaju zato navodi i ID i naziv, i provjeri ih u aktuelnoj verziji na atlas.mitre.org.

### Kako čitaš stranicu tehnike

Svaka tehnika u ATLAS-u ima isti raspored, i iz njega vadiš ono što treba odbrani:

- **opis**: apstraktno šta napadač postiže i pod kojim uslovom (to ide u model prijetnji);
- **taktike**: u kojoj fazi napada se tehnika pojavljuje (to određuje gdje tražiš tragove u logovima);
- **mitigacije**: povezane `AML.M` kontrole (početna lista za tvoj plan);
- **studije slučaja**: stvarni incidenti u kojima je tehnika viđena (argument za prioritet pred menadžmentom).

Podaci ATLAS-a su dostupni i u mašinski čitljivom obliku (YAML/STIX u javnom repozitoriju), pa mapiranje možeš automatski provjeravati u CI-ju detekcionih pravila.

### Kako ATLAS koristiš u praksi

1. **Mapiranje detekcija.** Svako pravilo u SIEM-u za AI aplikaciju dobija ATLAS oznaku, isto kao ATT&CK.
2. **Pokrivenost.** Tabela tehnika × postojeće kontrole pokazuje rupe.
3. **Izvještaj o incidentu.** Tok incidenta opisuješ lancem taktika, što olakšava poređenje sa studijama slučaja.
4. **Red team plan.** Scenarije testiranja (modul 10) biraš po tehnikama relevantnim za tvoju arhitekturu.

```yaml
# Odbrambeni primjer: metapodaci detekcionog pravila sa ATLAS mapiranjem
rule: llm-tool-call-outside-allowlist
description: Agent je zatražio alat koji nije na allowlisti za ovog tenanta
atlas:
  tactic: AML.TA0005        # Execution
  technique: AML.T0053      # AI Agent Tool Invocation
mitigation: [AML.M0028, AML.M0029]
severity: high
action: block_and_alert
```

> **U praksi:** ATLAS i ATT&CK se koriste zajedno. Incident sa AI aplikacijom skoro uvijek ima i „obične“ korake: ukradeni API ključ, pogrešno podešen bucket sa modelima, preuzet CI runner. ATLAS dodaje ono što je specifično za model, ali ne zamjenjuje ATT&CK.

## OWASP Top 10 for LLM Applications 2025

**OWASP GenAI Security Project** održava listu najkritičnijih rizika za aplikacije koje koriste LLM. Verzija **2025** je trenutno važeća. Oznake imaju oblik `LLM01:2025`.

| Oznaka | Naziv | Suština rizika | Ključna kontrola | Gdje u arhitekturi |
|---|---|---|---|---|
| LLM01 | **Prompt Injection** | unos (direktan ili kroz sadržaj) mijenja ponašanje modela | granice povjerenja, najmanje privilegije, ljudska potvrda za rizične akcije | orkestrator, alati |
| LLM02 | **Sensitive Information Disclosure** | model otkriva lične podatke, tajne, poslovne informacije | minimizacija podataka u kontekstu, filtriranje izlaza, kontrola pristupa | retrieval, izlaz |
| LLM03 | **Supply Chain** | kompromitovani modeli, adapteri, skupovi podataka, biblioteke | sigurni formati, potpisi, AI-BOM, provjera porijekla | ML pipeline, registar |
| LLM04 | **Data and Model Poisoning** | zatrovani podaci za pre-training, fine-tuning ili embedding | porijeklo podataka, validacija, kontrola izmjena | pipeline podataka |
| LLM05 | **Improper Output Handling** | izlaz modela se bez validacije prosljeđuje browseru, shellu, SQL-u | izlaz tretirati kao nepovjerljiv unos, šema, encoding | između modela i ostatka sistema |
| LLM06 | **Excessive Agency** | agent ima previše funkcija, ovlašćenja ili autonomije | minimalni skup alata, uski scope kredencijala, čovjek u petlji | alati, identitet agenta |
| LLM07 | **System Prompt Leakage** | sistemski prompt otkriva tajne ili logiku na koju se oslanja sigurnost | bez tajni u promptu, sigurnosne odluke van modela | prompt, autorizacija |
| LLM08 | **Vector and Embedding Weaknesses** | slabosti u generisanju, čuvanju i pretrazi embeddinga (pristup, trovanje, curenje) | kontrola pristupa po dokumentu, particionisanje po tenantu | vektorska baza |
| LLM09 | **Misinformation** | uvjerljivi, ali netačni izlazi (uključujući halucinacije) na koje se korisnici oslanjaju | grounding, citiranje izvora, ljudska provjera, jasna komunikacija ograničenja | UX, proces |
| LLM10 | **Unbounded Consumption** | neograničeni zahtjevi troše resurse i novac ili omogućavaju ekstrakciju modela | rate limiting, kvote, ograničenje veličine ulaza i izlaza, budžeti | gateway, serving |

Promjene u odnosu na verziju 2023/24 koje vrijedi zapamtiti: **System Prompt Leakage** i **Vector and Embedding Weaknesses** su nove stavke; **Misinformation** je proširena (ranije „Overreliance“); **Unbounded Consumption** je proširenje ranijeg „Model Denial of Service“ i obuhvata i finansijske gubitke i neovlašćenu replikaciju modela.

## OWASP Top 10 for Agentic Applications 2026

U decembru 2025. OWASP GenAI Security Project objavio je posebnu listu za **agentne aplikacije**, tj. sisteme u kojima LLM planira, pamti i poziva alate sa određenim stepenom autonomije. Oznake imaju prefiks **ASI**.

| Oznaka | Naziv | Suština | Odbrambeni fokus |
|---|---|---|---|
| ASI01 | **Agent Goal Hijack** | cilj agenta se preusmjerava kroz sadržaj koji čita | tretiranje svih ulaza kao nepovjerljivih, fiksni ciljevi i planovi, potvrda rizičnih akcija |
| ASI02 | **Tool Misuse and Exploitation** | legitimni alati se koriste na nesiguran ili nenamjeravan način | uski scope alata, validacija parametara, allowliste, limiti |
| ASI03 | **Identity and Privilege Abuse** | agent nasljeđuje ili zloupotrebljava ovlašćenja korisnika ili servisa | zaseban identitet agenta, kratkotrajni kredencijali, delegacija sa uskim scope-om |
| ASI04 | **Agentic Supply Chain Vulnerabilities** | kompromitovani alati, MCP serveri, pluginovi, promptovi ili modeli koje agent učitava | provjera porijekla, pinovanje verzija, registar odobrenih alata |
| ASI05 | **Unexpected Code Execution (RCE)** | agent generiše ili pokreće kod koji izvršava neželjene radnje | sandbox bez mreže i tajni, bez direktnog `eval`, pregled koda |
| ASI06 | **Memory & Context Poisoning** | trovanje dugoročne memorije ili konteksta koji agent kasnije koristi | provjera prije upisa u memoriju, izolacija po korisniku, istek i revizija |
| ASI07 | **Insecure Inter-Agent Communication** | poruke između agenata bez autentifikacije, integriteta ili validacije | međusobna autentifikacija, potpisane poruke, validacija šeme |
| ASI08 | **Cascading Failures** | greška jednog agenta se širi kroz povezane sisteme | izolacija, circuit breaker, limiti i tačke prekida |
| ASI09 | **Human-Agent Trust Exploitation** | ljudi pretjerano vjeruju agentu i odobravaju njegove prijedloge bez provjere | jasno prikazivanje šta se odobrava, provjera rizičnih akcija, edukacija |
| ASI10 | **Rogue Agents** | agent djeluje van namjeravanih ciljeva (drift, kompromitacija) | nadzor ponašanja, kill switch, revizija i ograničenje ovlašćenja |

Dvije liste se dopunjuju: LLM Top 10 gleda aplikaciju oko modela, Agentic Top 10 gleda autonomiju, alate, memoriju i interakciju više agenata. Agentna aplikacija je izložena rizicima sa **obje** liste. Na primjer, LLM01 (Prompt Injection) je često mehanizam, a ASI01 (Agent Goal Hijack) i ASI02 (Tool Misuse) su posljedice koje vidiš u agentnom sistemu.

Uz liste, isti projekat objavljuje i pomoćne materijale (npr. vodiče za threat modeling agenata i za sigurnost MCP-a). Provjeri aktuelne verzije na genai.owasp.org prije nego što ih citiraš u politici.

> **U praksi:** kad pišeš zahtjeve za novi AI projekat, napravi tabelu sa svih 10 + 10 stavki i za svaku popuni: „primjenjivo / nije primjenjivo / kontrola / vlasnik“. Agent koji nema memoriju preskače ASI06, ali to mora biti zapisana odluka, ne propust.

## Od liste do kontrola: minimalni baseline

Liste rizika same po sebi ne štite. Za svaki novi AI sistem postavi minimalni skup kontrola koji pokriva najveći dio obje liste, pa ga dopuni po rezultatima modelovanja prijetnji (modul 02):

| Kontrola | Pokriva (primarno) |
|---|---|
| Sav sadržaj koji nije od operatera tretira se kao nepovjerljiv i označava u promptu | LLM01, ASI01, ASI06 |
| Autorizacija se radi u kodu aplikacije, nikad „u promptu“ | LLM01, LLM06, LLM07, ASI03 |
| Izlaz modela prolazi validaciju šeme i kontekstualni encoding prije upotrebe | LLM05, ASI05 |
| Alati na allowlisti, sa uskim scope-om kredencijala i potvrdom za rizične akcije | LLM06, ASI02, ASI03, ASI09 |
| Kontrola pristupa po dokumentu u retrievalu, izolacija po tenantu | LLM02, LLM08 |
| Modeli i podaci samo iz provjerenih izvora, sigurni formati, potpisi, AI-BOM | LLM03, LLM04, ASI04 |
| Rate limiting, kvote, limiti tokena, budžetski alarmi | LLM10, ASI08 |
| Telemetrija: prompt, retrieval, pozivi alata, odluke filtera (uz zaštitu ličnih podataka) | sve, posebno ASI10 |
| Grounding, citiranje izvora, jasno označen AI sadržaj | LLM09, ASI09 |

```yaml
# Odbrambeni primjer: sigurnosni zahtjevi u šablonu za design review
ai_security_baseline:
  untrusted_content_marked: required
  authz_outside_model: required
  output_schema_validation: required
  tool_allowlist: required
  high_risk_action_confirmation: required
  retrieval_acl: required_if_rag
  model_artifact_signature: required_if_self_hosted
  rate_limits: { per_user_rpm: 30, max_output_tokens: 2048 }
  telemetry: { prompts: redacted, tool_calls: full, retention_days: 90 }
```

## Koji okvir za koju svrhu

| Okvir | Šta je | Kome služi | Primjer upotrebe |
|---|---|---|---|
| NIST AI 100-2 | taksonomija i terminologija | politika, risk, regulatorni dokumenti | definicije u AI politici organizacije |
| MITRE ATLAS | baza taktika, tehnika, mitigacija, slučajeva | SOC, detekcija, red team, IR | ATLAS ID na svakom detekcionom pravilu |
| OWASP LLM Top 10 | prioritizovana lista rizika aplikacije | developeri, AppSec, arhitekte | checklist u design reviewu |
| OWASP Agentic Top 10 | lista rizika agentnih sistema | timovi koji grade agente | zahtjevi za alate, identitet, memoriju |
| NIST AI RMF / AI 600-1 | upravljanje rizikom (Govern, Map, Measure, Manage) | menadžment, governance | modul 11 |
| ISO/IEC 42001 | sistem upravljanja AI-jem (AIMS) | organizacija, sertifikacija | modul 11 |

Okviri se ne isključuju. Tipičan tok: OWASP ti govori šta da provjeriš u dizajnu, ATLAS šta da detektuješ i testiraš, NIST AI 100-2 kako precizno da imenuješ napad, a AI RMF i ISO/IEC 42001 kako da sve to uvežeš u upravljanje.

### Mapiranje jednog rizika kroz okvire

Primjer: korisnik može kroz dokument u RAG-u uticati na odgovor koji dobija drugi korisnik.

```text
OWASP LLM:      LLM01 Prompt Injection (indirektna), LLM08 Vector and Embedding Weaknesses
OWASP Agentic:  ASI06 Memory & Context Poisoning (ako postoji memorija), ASI01 ako agent djeluje
MITRE ATLAS:    AML.T0051.001 LLM Prompt Injection: Indirect, AML.T0070 RAG Poisoning
NIST AI 100-2:  GenAI, indirect prompt injection, cilj: integrity violation
Kontrole:       ko smije unositi dokumente, porijeklo i pregled sadržaja, izolacija po tenantu,
                označavanje nepovjerljivog sadržaja u promptu, bez alata sa posljedicama bez potvrde
```

## Inventar AI komponenti kao polazna tačka

Nijedan okvir ne pomaže ako ne znaš šta imaš. Prvi korak u svakoj organizaciji je inventar:

```yaml
# Odbrambeni primjer: zapis u inventaru AI sistema
system: helpdesk-asistent
owner: tim-podrska
model:
  provider: eksterni-api
  data_retention: "0 dana (ugovorno)"
components: [rag, tools]
tools: [ticket_read, ticket_comment]          # nema slanja e-maila, nema brisanja
data_classes_in_context: [interno, licni_podaci_klijenata]
owasp_llm: [LLM01, LLM02, LLM05, LLM06, LLM08]
owasp_agentic: [ASI01, ASI02, ASI03]
atlas_detections: [AML.T0051, AML.T0053, AML.T0057]
review: 2026-09-30
```

Iz ovakvog zapisa odmah vidiš koje rizike moraš pokriti i koje detekcije očekuješ. Inventar je i osnova za governance i klasifikaciju po EU AI Actu (modul 11).

> **U praksi:** inventar uvijek otkrije „sjenovitu“ AI upotrebu: skriptu koja šalje logove eksternom modelu radi sažimanja, plugin u IDE-u, integraciju u CRM-u. Upravo tu najčešće cure podaci, jer niko nije radio pregled.

## Česte zablude

- **„Imamo guardrail model ispred LLM-a, pa smo zaštićeni od prompt injectiona.“** Filteri smanjuju rizik, ali ne garantuju zaštitu. Kontrola posljedica (privilegije, potvrda, izolacija) je obavezna.
- **„Model dobavljača je siguran, pa je i aplikacija sigurna.“** Najveći dio OWASP liste odnosi se na aplikaciju oko modela.
- **„AI sigurnost je posao data science tima.“** Većina kontrola je klasična: identitet, pristup, validacija, logovanje, lanac snabdijevanja. To je posao SecOps/DevSecOps inženjera.
- **„ATLAS zamjenjuje ATT&CK.“** Ne, dopunjuje ga.
- **„Liste su statične.“** OWASP i ATLAS se ažuriraju; politika treba da upućuje na verziju i datum.

## Rezime

- AI sistemi brišu granicu između koda i podataka, ponašaju se probabilistički, zavise od lanca snabdijevanja modela i podataka, a agenti grešku pretvaraju u akciju.
- **NIST AI 100-2 E2025** klasifikuje napade po fazi učenja, cilju (availability, integrity, privacy, za GenAI i misuse), sposobnostima i znanju napadača. PredAI: evasion, poisoning, privacy. GenAI: supply chain, direct prompting, indirect prompt injection, sigurnost agenata. Potpune mitigacije često ne postoje, pa je odbrana slojevita.
- **MITRE ATLAS** je ATT&CK za AI: taktike (`AML.TA`), tehnike (`AML.T`), mitigacije (`AML.M`), studije slučaja. Koristi se za mapiranje detekcija, pokrivenost, IR i red team; ID-jeve provjeravaj u aktuelnoj verziji.
- **OWASP LLM Top 10 2025**: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption.
- **OWASP Agentic Top 10 2026**: ASI01 Agent Goal Hijack, ASI02 Tool Misuse and Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents.
- Okviri se dopunjuju: OWASP za dizajn, ATLAS za detekciju i testiranje, NIST AI 100-2 za terminologiju, AI RMF i ISO/IEC 42001 za upravljanje. Polazna tačka je inventar AI sistema.
