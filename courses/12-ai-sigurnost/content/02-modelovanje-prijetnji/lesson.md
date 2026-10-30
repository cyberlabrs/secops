## Šta ovaj modul pokriva

Modul pokriva cilj **1.3 Modelovanje prijetnji za AI sisteme**.

Nakon modula treba da znaš:

- primijeniti pristup „četiri pitanja“ na LLM aplikaciju, RAG i agenta;
- nacrtati **data flow diagram (DFD)** sa granicama povjerenja specifičnim za AI (nepovjerljiv sadržaj, izlaz modela, alati, lanac snabdijevanja);
- prepoznati AI imovinu koju štitiš (težine, prompt, korpus, kredencijali alata, budžet);
- proći **STRIDE** po AI komponentama i dopuniti ga OWASP i ATLAS listama;
- procijeniti agenta heuristikama kao što su **lethal trifecta** i **Agents Rule of Two**;
- pretvoriti rezultat u risk registar, backlog kontrola i okidače za ponovno modelovanje.

Model prijetnji nije dokument za ladicu. To je najjeftinije mjesto da se otkrije da agent ima alat koji mu ne treba ili da RAG indeks miješa podatke tenanata.

## Četiri pitanja

Pristup koji popularizuje Adam Shostack (i koji koristi **Threat Modeling Manifesto**) svodi se na četiri pitanja:

1. **Na čemu radimo?** Dijagram sistema, tokovi podataka, granice povjerenja, imovina.
2. **Šta može poći naopako?** Prijetnje po elementu i po granici (STRIDE, OWASP, ATLAS).
3. **Šta ćemo uraditi povodom toga?** Kontrole, prihvatanje, prenos ili izbjegavanje rizika.
4. **Jesmo li dobro uradili posao?** Provjera da su kontrole uvedene i da model odgovara stvarnosti.

Za AI sistem pitanja ostaju ista. Mijenja se ono što crtaš i ono što tražiš.

## Pitanje 1: dijagram sa AI granicama povjerenja

Klasičan DFD ima vanjske entitete, procese, skladišta podataka i tokove. Kod AI sistema dodaješ nekoliko granica koje se lako previde:

```text
                    ┌──────────────── Granica A: korisnik → aplikacija ───────────────┐
 [Korisnik] ──prompt──►│ [API gateway] ──► [Orkestrator] ──prompt+kontekst──► [LLM]     │
                       │                       ▲   │                             │      │
                       │          izlaz modela │   │ upit                        │      │
                       │   Granica B: izlaz ───┘   ▼                             │      │
                       │                     [Retrieval] ◄── [Vektorska baza]    │      │
                       │                                          ▲              │      │
                       └──────────────────────────────────────────┼──────────────┼──────┘
                         Granica C: nepovjerljiv sadržaj          │              │
 [Treća strana] ──dokumenti, e-mail, web──► [Ingest] ─────────────┘              │
                                                                                 │
                         Granica D: akcije             [Alati: API, DB, e-mail] ◄┘ (preko orkestratora)
                         Granica E: lanac snabdijevanja [Registar modela] ◄── [Hub / dobavljač]
```

- **A (korisnik → aplikacija):** klasična granica, autentifikacija i autorizacija.
- **B (izlaz modela → ostatak sistema):** izlaz modela je nepovjerljiv podatak, bez obzira što ga je „generisao naš sistem“.
- **C (sadržaj trećih strana → kontekst):** sve što model čita, a nije napisao operater, može nositi instrukcije.
- **D (odluka modela → akcija):** poziv alata mijenja stanje sistema ili šalje podatke napolje.
- **E (artefakti → serving):** model, adapteri, tokenizer, biblioteke i podaci dolaze spolja.

Bitna razlika u odnosu na klasičnu aplikaciju: LLM proces nije granica povjerenja koja „čisti“ podatke. Ako u kontekst uđe nepovjerljiv sadržaj, i izlaz modela nosi njegov uticaj. Zato se oznaka povjerenja **prenosi kroz model**: izlaz je onoliko povjerljiv koliko i najmanje povjerljiv ulaz u kontekstu.

> **U praksi:** na dijagram uvijek ucrtaj i logove i telemetriju. Promptovi i odgovori u logovima često sadrže lične podatke i tajne, a log platforma ima širi krug pristupa od same aplikacije. To je tok podataka koji se najčešće zaboravi.

### Imovina koju štitiš

| Imovina | Zašto je vrijedna | Tipična prijetnja |
|---|---|---|
| Težine modela (vlastiti ili fino podešeni) | intelektualna svojina, trošak treniranja | krađa, ekstrakcija, izmjena |
| Sistemski prompt i konfiguracija | poslovna logika, ponekad (pogrešno) tajne | curenje, otkrivanje konfiguracije |
| Podaci za treniranje i fine-tuning | lični i poslovni podaci, kvalitet modela | trovanje, curenje, membership inference |
| RAG korpus i vektorska baza | interni dokumenti sa različitim nivoima pristupa | neovlašćen pristup, trovanje |
| Kredencijali alata i identitet agenta | omogućavaju akcije u drugim sistemima | zloupotreba ovlašćenja |
| Korisnički podaci u razgovorima | lični podaci, povjerljive informacije | curenje drugim korisnicima, u logove |
| Budžet i kapacitet (GPU, kvote) | direktan trošak, dostupnost | denial of wallet, DoS |
| Povjerenje korisnika u izlaz | odluke se donose na osnovu odgovora | dezinformacije, manipulacija |

## Pitanje 2: šta može poći naopako

### STRIDE po AI elementima

STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) radi i za AI, ali svako slovo dobija specifične primjere:

| STRIDE | Primjer u AI sistemu (apstraktno) | Kontrola |
|---|---|---|
| **S**poofing | poruka koja se predstavlja kao sistemska instrukcija ili kao drugi agent; lažni MCP server | jasna strukturna podjela uloga, autentifikacija agenata i servera |
| **T**ampering | zatrovan dokument u RAG-u, izmijenjen model u registru, zatrovana memorija agenta | kontrola ingest-a, potpisi artefakata, provjera prije upisa u memoriju |
| **R**epudiation | nema zapisa koji prompt i koji retrieval su doveli do akcije agenta | telemetrija sa korelacionim ID-jem, nepromjenljivi logovi |
| **I**nformation disclosure | model vraća tuđe dokumente, lične podatke ili sistemski prompt | ACL u retrievalu, minimizacija konteksta, filtriranje izlaza |
| **D**enial of service | skupi upiti, beskonačne petlje agenta, iscrpljivanje kvota | rate limiting, limiti tokena i koraka, budžeti |
| **E**levation of privilege | agent sa ovlašćenjima servisa izvršava akciju koju korisnik ne smije | delegirana ovlašćenja korisnika, provjera autorizacije u alatu |

### Dopuna AI listama

STRIDE je generički; OWASP i ATLAS daju konkretne AI prijetnje koje bi inače propustio. Praktičan način: za svaki element dijagrama prođi relevantne stavke.

| Element DFD-a | OWASP LLM / Agentic | ATLAS (primjeri) |
|---|---|---|
| Ulaz korisnika | LLM01, LLM10 | AML.T0051.000, AML.T0054, AML.T0034 |
| Ingest i retrieval | LLM01 (indirektna), LLM08, LLM02 | AML.T0051.001, AML.T0070 |
| Izlaz modela | LLM05, LLM09, LLM07 | AML.T0077 LLM Response Rendering, AML.T0056 |
| Alati i identitet agenta | LLM06, ASI02, ASI03, ASI05 | AML.T0053, AML.T0086 |
| Memorija agenta | ASI06 | AML.T0080 AI Agent Context Poisoning |
| Više agenata | ASI07, ASI08, ASI10 | — (provjeri aktuelnu verziju ATLAS-a) |
| Pipeline i registar | LLM03, LLM04, ASI04 | AML.T0010, AML.T0020 |
| API za inferencu | LLM10, LLM02 | AML.T0024, AML.T0040 |

### Abuse cases umjesto payloada

Prijetnje zapisuj kao **abuse case**: ko, preko koje granice, pod kojim uslovom, sa kojom posljedicom. Ne treba ti konkretan tekst napada da bi model prijetnji bio koristan.

```yaml
# Odbrambeni primjer: zapis prijetnje u modelu
id: T-07
title: Instrukcije iz dolaznog e-maila utiču na agenta koji ima alat za slanje poruka
actor: vanjski pošiljalac bez naloga
boundary: C (sadržaj trećih strana) → D (akcije)
precondition: agent čita sanduče i ima alat send_email bez potvrde
consequence: slanje internih podataka na vanjsku adresu
mapping: { owasp: [LLM01, LLM06, ASI01, ASI02], atlas: [AML.T0051.001, AML.T0086] }
likelihood: high
impact: high
controls: [C-03 potvrda korisnika za slanje van domena, C-05 allowlista primalaca, C-09 alarm na neuobičajene pozive alata]
status: open
```

### Privatnost: ne samo „information disclosure“

STRIDE gleda curenje kao jedno slovo. Kad su u kontekstu, logovima ili podacima za treniranje lični podaci, korisno je proći i pitanja iz okvira za privatnost kao što je **LINDDUN** (povezivanje, identifikacija, neusklađenost sa svrhom, nedostatak transparentnosti…):

- Da li se razgovori koriste za treniranje ili evaluaciju, i da li su korisnici o tome obaviješteni?
- Koliko dugo dobavljač modela i naša log platforma čuvaju promptove?
- Može li se iz odgovora modela zaključiti da je određena osoba u skupu podataka?
- Da li agent spaja podatke iz više sistema na način koji pojedinačni sistemi ne dozvoljavaju?

Odgovori često vode ka kontrolama koje nisu tehničke (ugovor sa dobavljačem, obavještenje korisnicima), ali moraju biti u istom registru.

## Heuristike za agente

Za agente postoje dvije kratke heuristike koje brzo otkrivaju opasne kombinacije sposobnosti. Nisu standardi, ali su korisne u design reviewu.

### Lethal trifecta

Simon Willison (2025) upozorava na kombinaciju tri sposobnosti u istom agentu:

1. pristup **privatnim podacima**;
2. izloženost **nepovjerljivom sadržaju**;
3. mogućnost **komunikacije prema van** (slanje poruka, HTTP zahtjevi, čak i renderovanje slike sa vanjskog URL-a).

Kada su sve tri prisutne, indirektna prompt injection može dovesti do izvlačenja podataka. Odbrana: ukloni barem jednu nogu tripoda za dati tok (npr. bez izlaznih kanala dok je nepovjerljiv sadržaj u kontekstu).

### Agents Rule of Two

Meta je (2025) predložila pravilo da agent u jednoj sesiji ne treba imati više od dvije od tri osobine:

- **[A]** obrađuje nepovjerljiv ulaz;
- **[B]** ima pristup osjetljivim sistemima ili privatnim podacima;
- **[C]** može mijenjati stanje ili komunicirati prema van.

Ako zadatak traži sve tri, agent ne treba raditi autonomno: potreban je dodatni nadzor (najčešće ljudska potvrda ili druga pouzdana validacija), razdvajanje na odvojene komponente ili nova sesija sa čistim kontekstom. Pravilo polazi od pretpostavke da će neka injection proći, pa ograničava šta kompromitovan agent može uraditi.

```text
 Agent za sažimanje javnih vijesti      A + C         (nema privatnih podataka)        → prihvatljivo
 Interni asistent nad HR bazom          B + C         (samo zaposleni, bez vanjskog sadržaja) → prihvatljivo
 Asistent koji čita e-mail i šalje ga   A + B + C     → razdvojiti ili tražiti potvrdu za svaku akciju
```

> **U praksi:** heuristike su najkorisnije rano, kad se bira opseg agenta. Kasnije je teško ukloniti sposobnost koju je produkt već obećao korisnicima. Unesi ih u šablon design reviewa kao obavezno pitanje.

### Okviri namijenjeni agentima

Pojavljuju se i specijalizovani okviri za modelovanje prijetnji agentnih sistema, npr. **MAESTRO** koji je objavio Cloud Security Alliance (razlaže agentni sistem na slojeve i traži prijetnje po sloju i između slojeva) i materijali OWASP GenAI Security Projecta o prijetnjama agenata. Koristi ih kao dopunu, a u izvještaju navedi verziju koju si koristio.

## Prijetnje po vrsti sistema

Isti postupak daje različite prioritete zavisno od toga šta gradiš. Polazna tačka za radionicu:

| Vrsta sistema | Najvažnije granice | Prioritetne prijetnje | Prve kontrole |
|---|---|---|---|
| Chatbot bez alata i RAG-a | A, B | jailbreak, curenje prompta, nesiguran izlaz, trošak | obrada izlaza, limiti, bez tajni u promptu |
| RAG nad internim dokumentima | A, B, C | neovlašćen pristup dokumentima, indirektna injection, trovanje korpusa | ACL po dokumentu, kontrola ingest-a, označavanje sadržaja |
| Agent sa alatima | A–D | goal hijack, zloupotreba alata, eskalacija privilegija, izvlačenje podataka | allowlista, delegirana ovlašćenja, potvrda, Rule of Two |
| Više agenata | A–D + među-agentni tokovi | lažne poruke, kaskadne greške, rogue agent | autentifikacija poruka, izolacija, kill switch |
| Vlastiti model (treniranje, serving) | C, E + API | trovanje podataka, zlonamjerni artefakti, ekstrakcija, membership inference | porijeklo podataka, sigurni formati, potpisi, kvote |

### DFD za ML pipeline

Ako treniraš ili fino podešavaš model, crtaš i pipeline, ne samo aplikaciju:

```text
 [Izvori podataka] ──► [Prikupljanje / labeliranje] ──► [Skup podataka (verzionisan)]
        ▲ granica C                                              │
                                                                 ▼
 [Javni hub: bazni model] ──granica E──► [Treniranje / fine-tuning na CI runneru] ──► [Registar modela]
                                                   │                                    │ potpis, AI-BOM
                                         tajne, GPU kvote                               ▼
                                                                                  [Serving / API]
```

Tipične prijetnje: ko može mijenjati skup podataka i da li se to vidi (T), da li runner ima pristup produkcijskim tajnama (E), da li serving učitava samo potpisane artefakte (T), da li je bazni model u sigurnom formatu (T, E). Detalji su u modulima 07–09.

## Kako voditi radionicu

- **Učesnici:** vlasnik proizvoda, developer orkestratora, neko ko poznaje podatke (RAG/treniranje), SecOps, po potrebi pravnik ili DPO kad su u igri lični podaci.
- **Trajanje:** 60–90 minuta za jedan tok; veći sistem podijeli po tokovima, ne po timovima.
- **Ulaz:** postojeći dijagram (makar skica), lista alata sa scope-om, lista izvora podataka.
- **Izlaz:** ažuriran dijagram, lista prijetnji kao abuse case, odluke (smanjiti/prihvatiti/izbjeći/prenijeti) sa vlasnicima, okidači za reviziju.
- **Format:** model prijetnji čuvaj kao kod (YAML ili Markdown u repou), pored sistema koji opisuje, da prolazi review kao i ostale promjene.

## Pitanje 3: šta ćemo uraditi

### Procjena i prioritet

Za svaku prijetnju procijeni vjerovatnoću i uticaj, kao i za druge sisteme. Kod AI sistema obrati pažnju na dvije stvari:

- **Vjerovatnoća indirektne prompt injection je visoka čim postoji granica C.** Ne čekaj dokaz eksploatacije; tretiraj je kao pretpostavku.
- **Uticaj određuje granica D.** Isti model sa alatom samo za čitanje i sa alatom za plaćanje imaju potpuno različit rizik.

| Prijetnja | Vjerovatnoća | Uticaj | Odluka |
|---|---|---|---|
| Indirektna injection → slanje e-maila van | visoka | visok | smanjiti: potvrda + allowlista primalaca |
| Curenje sistemskog prompta | visoka | nizak (nema tajni) | prihvatiti, dokumentovati |
| Tuđi dokumenti u RAG odgovoru | srednja | visok | smanjiti: ACL u retrievalu |
| Denial of wallet preko javnog API-ja | srednja | srednji | smanjiti: kvote i alarmi |
| Zlonamjerni model sa javnog huba | niska (samo odobreni izvori) | visok | smanjiti: safetensors, potpisi |

### Vrste kontrola

Kontrole biraj tako da ne zavise sve od ponašanja modela:

- **Arhitekturne** (najjače): razdvajanje privilegija, uklanjanje alata, izolacija po tenantu, sandbox.
- **Deterministične provjere u kodu**: autorizacija u alatu, validacija šeme izlaza, allowliste.
- **Probabilističke**: klasifikatori ulaza i izlaza, guardrail modeli. Korisne, ali uvijek uz prethodne.
- **Detektivne**: telemetrija, alarmi, revizija.
- **Proceduralne**: ljudska potvrda, pregled promjena prompta i alata, obuka.

> **U praksi:** ako je jedina kontrola za prijetnju visokog uticaja rečenica u sistemskom promptu („nikad ne šalji podatke van“), prijetnja je praktično nekontrolisana. U registru je označi kao otvorenu.

### Od modela do backloga

```yaml
# Odbrambeni primjer: kontrola iz modela prijetnji kao stavka backloga
id: C-03
title: Potvrda korisnika prije slanja e-maila na adresu van domena
addresses: [T-07]
type: architectural+procedural
acceptance:
  - alat send_email odbija poziv bez potpisanog confirmation tokena
  - token se izdaje samo nakon prikaza primaoca i sadržaja korisniku
  - pokušaj bez tokena se loguje sa ATLAS oznakom AML.T0086
owner: tim-asistent
due: 2026-11-30
```

## Pitanje 4: jesmo li dobro uradili posao

- **Provjera uvođenja:** svaka kontrola ima kriterij prihvatanja i test (unit test za allowlistu, integracioni test za ACL u retrievalu).
- **Evaluacija i red teaming** (modul 10): scenariji se biraju po prijetnjama iz modela, a nalazi se vraćaju u model.
- **Okidači za ponovno modelovanje:**
  - novi alat ili proširen scope postojećeg;
  - novi izvor podataka u RAG-u ili memoriji;
  - promjena modela ili dobavljača;
  - prelazak sa jednog na više agenata;
  - novi tenant ili nova klasa podataka u kontekstu;
  - incident ili nova stavka u OWASP/ATLAS listama.

```yaml
# Odbrambeni primjer: CI provjera koja traži ažuriran model prijetnji kad se promijene alati
threat-model-gate:
  stage: test
  rules:
    - changes: ["agent/tools/**", "rag/sources.yaml", "config/model.yaml"]
  script:
    - test "$(git log -1 --format=%ct -- threat-model.yaml)" -ge "$(git log -1 --format=%ct -- agent/tools rag/sources.yaml config/model.yaml)"
```

## Primjer od početka do kraja: helpdesk asistent

Sistem: asistent za podršku čita tikete, pretražuje internu bazu znanja (RAG) i može dodati komentar na tiket. Planira se i alat za slanje e-maila klijentu.

1. **Dijagram:** granice A (agent podrške → aplikacija), B (izlaz → UI tiketa), C (tekst tiketa koji piše klijent, dokumenti u bazi znanja), D (komentar, e-mail), E (model dobavljača preko API-ja).
2. **Imovina:** lični podaci klijenata u tiketima, interni dokumenti, kredencijal za sistem tiketa, budžet.
3. **Prijetnje (izbor):**
   - tekst tiketa (C) utiče na odgovor ili akciju (LLM01, ASI01);
   - izlaz renderovan kao HTML u UI tiketa (LLM05);
   - interni dokument dostupan samo menadžmentu ulazi u odgovor agentu prve linije (LLM02, LLM08);
   - e-mail alat šalje sadržaj na adresu koju je predložio tekst tiketa (ASI02, lethal trifecta).
4. **Odluke:**
   - izlaz kao Markdown sa sanitizacijom, bez sirovog HTML-a i bez učitavanja vanjskih slika;
   - retrieval filtrira po ulogama korisnika koji je pokrenuo upit, ne po ulogama servisa;
   - e-mail samo na adresu klijenta iz sistema tiketa (ne iz teksta), uz pregled agenta podrške;
   - telemetrija sa korelacionim ID-jem za svaki tiket.
5. **Provjera:** testovi za ACL i za odbijanje adrese van evidencije, red team scenariji po T-ovima iz modela.

> **U praksi:** najvredniji rezultat ovog primjera nije lista prijetnji nego odluka da e-mail alat ne prima adresu od modela. Jedna promjena dizajna uklonila je cijelu klasu rizika, bez ijednog filtera.

## Česte greške

- **Modelovanje samo modela.** Model je jedna kutija; prijetnje su u tokovima oko njega.
- **Izlaz modela označen kao povjerljiv** jer je „naš“. Oznaka povjerenja se prenosi kroz model.
- **Zapis prijetnje kao konkretan napad** umjesto kao abuse case. Napadi se mijenjaju, uslovi i posljedice ostaju.
- **Jednokratni dokument.** Agenti i RAG se brzo mijenjaju; bez okidača model zastari za nekoliko sedmica.
- **Kontrole koje sve zavise od modela** (prompt instrukcije, guardrail model) za prijetnje visokog uticaja.

## Rezime

- Četiri pitanja (na čemu radimo, šta može poći naopako, šta ćemo uraditi, jesmo li dobro uradili posao) važe i za AI.
- DFD za AI ima dodatne granice: izlaz modela, nepovjerljiv sadržaj u kontekstu, akcije alata, lanac snabdijevanja. Povjerenje se prenosi kroz model: izlaz je povjerljiv koliko i najmanje povjerljiv ulaz.
- Imovina uključuje težine, prompt i konfiguraciju, podatke za treniranje, RAG korpus, kredencijale alata, razgovore, budžet i povjerenje korisnika.
- STRIDE daje strukturu, a OWASP LLM/Agentic Top 10 i ATLAS konkretne AI prijetnje. Prijetnje se zapisuju kao abuse case, bez payloada.
- Za agente koristi heuristike **lethal trifecta** (privatni podaci + nepovjerljiv sadržaj + izlazni kanal) i **Agents Rule of Two** (najviše dvije od A/B/C bez dodatnog nadzora).
- Prednost imaju arhitekturne i deterministične kontrole; probabilističke su dodatni sloj. Granica D (akcije) najviše određuje uticaj.
- Model prijetnji se održava: kontrole imaju kriterije prihvatanja i testove, a novi alati, izvori podataka, modeli i incidenti su okidači za reviziju.
