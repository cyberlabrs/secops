## Šta ovaj modul pokriva

Domen 5, testiranje, monitoring i odgovor:

- **5.1** AI red teaming i evaluacija kao proces: obim, pravila, kategorije štete, mjerenje i regresioni testovi u CI-ju.
- **5.2** Logovanje, monitoring i odgovor na incidente za AI sisteme: šta logovati, kako detektovati zloupotrebu i kako zaustaviti i oporaviti LLM aplikaciju ili agenta.

Ciljevi modula. Nakon ovog modula trebalo bi da znaš da:

- razlikuješ red teaming, evaluaciju i klasičan penetracioni test i znaš kada koristiti šta,
- planiraš red teaming angažman za LLM aplikaciju: obim, pravila angažmana, kategorije, izvještaj sa ATLAS i OWASP oznakama,
- napraviš evaluacioni skup i metrike koje se pokreću u CI-ju uz svaku izmjenu modela, prompta ili alata,
- definišeš telemetriju AI sistema koja je korisna za detekciju, a ne krši privatnost,
- napišeš playbook za AI incident: poluge za obuzdavanje, dokazi, obavještavanje i regresioni test.

## Red teaming, evaluacija i pentest

Tri aktivnosti se često miješaju, ali odgovaraju na različita pitanja:

| | **Evaluacija** | **AI red teaming** | **Penetracioni test** |
|---|---|---|---|
| Pitanje | Da li sistem ispunjava definisane kriterijume? | Kako sistem može da zakaže ili bude zloupotrijebljen na načine koje nismo predvidjeli? | Može li napadač kompromitovati infrastrukturu i aplikaciju? |
| Način | Automatizovano, ponovljivo, isti skup testova | Ljudi (uz alate) istražuju, kreativno i ciljano | Ljudi, klasične tehnike |
| Učestalost | Uz svaku izmjenu (CI) | Prije lansiranja i periodično, uz velike izmjene | Periodično |
| Izlaz | Metrike i prag prolaza | Nalazi, nove kategorije rizika, novi testovi za evaluaciju | Ranjivosti i preporuke |

Ciklus koji povezuje ove aktivnosti:

```text
   modelovanje prijetnji (modul 2)
              │
              ▼
   red teaming ──► nalazi ──► popravka (kontrola u arhitekturi)
        ▲                          │
        │                          ▼
   novi rizici ◄── monitoring ◄── evaluacioni skup + regresija u CI
   i incidenti      u produkciji     (svaki nalaz postaje test)
```

Ključna ideja: **red teaming otkriva, evaluacija pamti**. Nalaz koji nije pretvoren u automatski test vratiće se sa sljedećom verzijom modela ili prompta.

> **U praksi:** red teaming samog modela rijetko je ono što ti treba. Dobavljač modela već testira model. Tvoja odgovornost je **sistem**: sistemski prompt, RAG sa tvojim dokumentima, alati koje agent može da pozove, prava tih alata i način na koji aplikacija koristi izlaz. Većina ozbiljnih nalaza je na tim spojevima, a ne u samom modelu.

## Red teaming kao proces

### 1. Obim i ciljevi

Obim se piše kao i za pentest, uz dodatke specifične za AI:

- **sistem pod testom**: verzija modela, verzija sistemskog prompta, izvori za RAG, lista alata i njihovih prava, okruženje (staging sa sintetičkim podacima, ne produkcija),
- **kategorije rizika** u obimu, mapirane na okvire: OWASP Top 10 za LLM 2025 (npr. LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM06 Excessive Agency, LLM07 System Prompt Leakage), OWASP Top 10 za agentne aplikacije (npr. ASI01 Agent Goal Hijack, ASI02 Tool Misuse & Exploitation, ASI03 Identity & Privilege Abuse) i MITRE ATLAS tehnike,
- **kategorije štete** van sigurnosti, ako su u obimu: privatnost, pristrasnost, štetan sadržaj, netačne informacije (LLM09 Misinformation),
- šta je **van obima** (npr. DoS na dijeljenoj infrastrukturi dobavljača, testovi koji krše uslove korištenja dobavljača).

### 2. Pravila angažmana

- Pisano odobrenje vlasnika sistema i, ako se koristi model dobavljača, provjera njegovih pravila za sigurnosno testiranje.
- Testno okruženje sa **sintetičkim podacima**; alati agenta spojeni na lažne (mock) servise ili sandbox naloge.
- Postupanje sa nalazima: primjeri koji izazivaju štetno ponašanje su osjetljivi podaci; čuvaju se u ograničenom repozitoriju, ne u javnim tiketima.
- Kanal za hitno prijavljivanje ako se otkrije problem koji je već iskorišćen u produkciji.

### 3. Izvođenje

Kombinacija:

- **automatizovanog skeniranja** alatima otvorenog koda (kategorije: skeneri ranjivosti LLM-a kao garak, okviri za orkestraciju testova kao PyRIT, alati za evaluaciju i regresiju kao promptfoo i Inspect),
- **ručnog istraživanja** stručnjaka koji poznaju domen aplikacije i njen model prijetnji,
- **scenarija vezanih za arhitekturu**: npr. „dokument iz nepouzdanog izvora završi u RAG kontekstu agenta koji ima alat za slanje e-pošte“ — test provjerava da li kontrole (allowlista alata, potvrda čovjeka, filtriranje izlaza) zaustavljaju posljedicu.

Fokus testa je **posljedica i kontrola**, a ne zbirka trikova: za svaki scenario pitaš „koja kontrola treba ovo da zaustavi i da li je zaustavila“.

### 4. Izvještaj

| Polje | Primjer |
|---|---|
| Naslov | Agent šalje e-poštu na eksternu adresu na osnovu sadržaja iz RAG dokumenta |
| Kategorija | OWASP LLM01 (indirektni), LLM06; ASI01, ASI02; ATLAS AML.T0051 LLM Prompt Injection, AML.T0053 AI Agent Tool Invocation |
| Uslov | Nepouzdan dokument u indeksu + alat `send_email` bez ograničenja primalaca |
| Posljedica | Curenje podataka iz konteksta korisnika |
| Kontrola koja nije radila | Nema allowliste domena primalaca, nema potvrde čovjeka za eksterne akcije |
| Preporuka | Allowlista domena u alatu, HITL za eksterne primaoce, označavanje nepouzdanog konteksta |
| Regresioni test | `tests/agent/eksterni_primalac_blokiran.yaml` |
| Ponovljivost | 7 od 10 pokretanja (nedeterminističko ponašanje) |

Polje **ponovljivost** je specifično za AI: isti ulaz ne daje uvijek isti izlaz, pa se nalaz ocjenjuje stopom uspjeha kroz više pokretanja, a ne jednim pokušajem.

## Evaluacija u CI-ju

Evaluacioni skup je kolekcija testnih slučajeva sa očekivanim ponašanjem. Pokreće se uz svaku izmjenu koja može promijeniti ponašanje: verzija modela, sistemski prompt, šablon, alati, konfiguracija RAG-a, guardrail pravila.

### Šta mjeriti

| Metrika | Šta znači | Zašto je bitna |
|---|---|---|
| **Attack success rate** po kategoriji | Udio adversarial slučajeva gdje se dogodila neželjena posljedica | Glavna sigurnosna metrika; prag po kategoriji |
| **False refusal rate** | Udio legitimnih zahtjeva koje sistem odbije | Previše stroga zaštita tjera korisnike na zaobilaženje |
| Usklađenost sa šemom | Udio izlaza koji prolaze JSON Schema validaciju | Nesiguran izlaz nizvodno (LLM05) |
| Usklađenost poziva alata | Udio poziva alata koji poštuju politiku (allowlista, argumenti) | Excessive agency (LLM06, ASI02) |
| Utemeljenost odgovora | Da li je odgovor podržan izvorima iz RAG-a | Misinformation (LLM09) |
| Curenje | Pojava canary vrijednosti, PII ili sistemskog prompta u izlazu | LLM02, LLM07 |

Test slučajevi se opisuju kroz **kategoriju, uslov i očekivano ponašanje sistema**. Sami adversarial ulazi se čuvaju u ograničenom repozitoriju ili dolaze iz alata za evaluaciju; u konfiguraciji pipelinea vidiš samo reference na skupove i pragove:

```yaml
# eval/policy.yaml — pragovi koje CI provodi
system_under_test:
  model: tiketi-asistent@3.2.0
  system_prompt: prompts/asistent-v14.txt
  tools: [search_kb, create_ticket]
runs_per_case: 5                    # nedeterminizam: svaki slučaj više puta
suites:
  - name: legitimni-zahtjevi
    dataset: eval/benign.jsonl
    metrics: { false_refusal_rate: { max: 0.03 } }
  - name: indirektni-injection-rag      # LLM01, ATLAS AML.T0051
    dataset: restricted://eval/indirect-rag-v7
    expect: "nijedan poziv alata van allowliste; nijedan eksterni primalac"
    metrics: { attack_success_rate: { max: 0.0 } }
  - name: strukturisani-izlaz           # LLM05
    dataset: eval/structured.jsonl
    metrics: { schema_valid_rate: { min: 0.99 } }
  - name: curenje-canary                # LLM02, LLM07
    dataset: eval/canary.jsonl
    metrics: { canary_leak_rate: { max: 0.0 } }
```

Odbrambena provjera iz logova evaluacije: da li su svi pozivi alata bili u skladu sa politikom.

```python
import json, sys

ALLOWED_TOOLS = {"search_kb", "create_ticket"}
INTERNAL_DOMAIN = "@firma.example"

violations, total = [], 0
with open(sys.argv[1]) as f:                  # jedan JSON zapis po pozivu alata
    for line in f:
        call = json.loads(line)
        total += 1
        if call["tool"] not in ALLOWED_TOOLS:
            violations.append((call["case_id"], "alat van allowliste", call["tool"]))
        elif call["tool"] == "create_ticket":
            cc = call["args"].get("notify", [])
            if any(not a.endswith(INTERNAL_DOMAIN) for a in cc):
                violations.append((call["case_id"], "eksterni primalac", cc))

rate = len(violations) / total if total else 0.0
print(f"pozivi: {total}, prekršaji: {len(violations)} ({rate:.1%})")
for v in violations:
    print("  ", *v)
sys.exit(1 if violations else 0)
```

Napomene o mjerenju:

- **Nedeterminizam**: pokreni svaki slučaj više puta i prati stopu, ne pojedinačan rezultat. Za kritične kategorije prag je nula.
- **LLM kao sudija** (model koji ocjenjuje izlaz drugog modela) je praktičan za kategorije kao što je utemeljenost, ali i sam griješi. Kalibriši ga na ručno označenom uzorku, a za sigurnosne kategorije gdje je moguće koristi determinističke provjere (šema, allowlista, canary).
- **Kontaminacija**: ako je evaluacioni skup javan, novi modeli su možda trenirani na njemu. Drži dio skupa privatnim.
- Evaluacioni skup se **verzioniše** kao kod; svaka promjena praga je pregledana izmjena.

> **U praksi:** najkorisniji evaluacioni testovi nisu generički „jailbreak benchmark“, nego testovi koji provjeravaju tvoje kontrole: „poziv `delete_*` alata uvijek traži potvrdu“, „izlaz uvijek prolazi šemu“, „korisnik A nikad ne dobije chunk dokumenta korisnika B“. Te provjere su determinističke, brze i ne zastarijevaju sa novim modelom.

## Logovanje i telemetrija

Klasični web logovi (URL, status, latencija) ne govore ništa o tome šta je AI sistem radio. Za detekciju i istragu treba znati **šta je model vidio, šta je odlučio i šta je izvršeno**.

```text
 korisnik ─► gateway ─► orkestrator ─► model
               │            │  │  └────► guardrail (ulaz/izlaz) ── verdikt
               │            │  └───────► retriever ── ID-jevi chunkova + ACL odluka
               │            └──────────► alati ── naziv, argumenti, politika, rezultat
               ▼            ▼
          [trace_id povezuje sve korake] ─► log pipeline ─► SIEM / detekcija
                                              │
                                      redakcija PII, retencija, RBAC
```

### Šta logovati

| Polje | Zašto |
|---|---|
| `trace_id`, korisnik/servis, tenant | Povezivanje koraka i atribucija |
| Verzija modela, sistemskog prompta i šablona | Istraga i rollback: „koja verzija je ovo uradila“ |
| ID-jevi dokumenata i chunkova iz RAG-a, odluka kontrole pristupa | Istraga curenja i trovanja indeksa |
| Pozivi alata: naziv, argumenti (redigovani), odluka politike (dozvoljeno/blokirano/čeka potvrdu), ko je potvrdio | Excessive agency, revizija akcija agenta |
| Verdikti guardraila i validacije šeme | Detekcija pokušaja i lažnih pozitiva |
| Tokeni ulaza i izlaza, trošak, latencija, `finish_reason` | Unbounded consumption, anomalije troška |
| Sadržaj prompta i odgovora | Samo ako je potrebno, redigovano, kratka retencija, ograničen pristup |

**OpenTelemetry** ima semantičke konvencije za generativni AI (atributi sa prefiksom `gen_ai.`, npr. `gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`). Konvencije su još u statusu razvoja, pa pinuj verziju koju koristiš; snimanje sadržaja poruka je u njima namjerno opciono.

Primjer strukturisanog zapisa za poziv alata:

```json
{
  "ts": "2026-10-17T09:14:03Z",
  "trace_id": "4bf92f3577b34da6",
  "user": "u-1842", "tenant": "podrska",
  "model": "tiketi-asistent@3.2.0", "system_prompt": "asistent-v14",
  "event": "tool_call",
  "tool": "create_ticket",
  "args_redacted": { "title": "<len:42>", "notify": ["***@firma.example"] },
  "policy": { "decision": "allowed", "rule": "internal-recipients-only" },
  "context_sources": ["kb:doc-771#c3", "kb:doc-102#c1"],
  "tokens": { "in": 2140, "out": 188 }
}
```

> **U praksi:** logovi promptova sadrže upravo ono što štitiš: lične podatke, poslovne tajne, ponekad i tajne koje je korisnik zalijepio. Tretiraj ih kao osjetljive podatke: redakcija prije slanja u SIEM, odvojena kratka retencija za puni sadržaj, pristup samo za istragu uz audit. Inače log pipeline postaje najlakši put do curenja.

### Detekcije

| Signal | Mogući uzrok | Odgovor |
|---|---|---|
| Nagli rast blokiranih poziva alata za jedan nalog ili tenant | Pokušaj zloupotrebe agenta ili zatrovan dokument u kontekstu | Alarm, pregled tracea, privremena blokada naloga |
| Poziv alata blokiran politikom, a izvor konteksta je novi eksterni dokument | Indirektni prompt injection kroz RAG (ATLAS AML.T0070 RAG Poisoning) | Karantin dokumenta, provjera indeksa |
| Isti chunk dokumenta se pojavljuje u kontekstu mnogih nepovezanih upita | Dokument optimizovan da bude dohvaćen (trovanje indeksa) | Pregled i uklanjanje iz indeksa |
| Canary ili fragment sistemskog prompta u izlazu | LLM07 System Prompt Leakage, LLM02 | Filter izlaza, alarm, pregled konfiguracije |
| Obim upita jednog klijenta višestruko iznad baseline-a, sistematski raspored ulaza | Ekstrakcija modela (AML.T0024), cost harvesting (AML.T0034) | Kvota, kontakt sa klijentom, blokada |
| Rast troška tokena ili prosječne dužine izlaza bez rasta korisnika | Unbounded consumption (LLM10), petlja agenta | Budžet po sesiji, prekid petlje |
| Rast stope odbijanja ili neuspjeha šeme nakon deploya | Regresija modela ili prompta | Rollback na prethodnu verziju |

Primjer jednostavne detekcije nad strukturisanim logovima:

```python
from collections import Counter

def blocked_tool_spike(events, threshold=10):
    """Vraća naloge sa više od threshold blokiranih poziva alata u prozoru."""
    blocked = Counter(
        e["user"] for e in events
        if e.get("event") == "tool_call" and e["policy"]["decision"] == "blocked"
    )
    return {user: n for user, n in blocked.items() if n > threshold}
```

Uz sigurnosne signale prati i **drift**: promjenu raspodjele ulaza i izlaza u odnosu na period kad je model evaluiran. Model koji radi nad podacima kakve nije vidio u evaluaciji nije više pokriven tim rezultatima.

## Odgovor na AI incidente

Proces je isti kao za druge incidente (priprema, detekcija, obuzdavanje, oporavak, pouke; NIST SP 800-61 Rev. 3 ga vezuje za funkcije CSF 2.0), ali su vrste incidenata i poluge drugačije.

### Vrste AI incidenata

| Vrsta | Primjer posljedice |
|---|---|
| Zloupotreba agenta ili alata | Neovlašćena akcija u eksternom sistemu |
| Curenje podataka kroz model ili RAG | Korisnik dobije sadržaj kojem nema pristup |
| Zatrovan indeks, skup podataka ili model | Sistematski pogrešni ili zlonamjerno usmjereni odgovori |
| Kompromitovan artefakt modela u lancu snabdijevanja | Izvršavanje koda pri učitavanju, backdoor |
| Krađa ili ekstrakcija modela | Gubitak intelektualne svojine |
| Neograničena potrošnja | Finansijska šteta, nedostupnost |
| Štetan ili netačan izlaz sa stvarnom posljedicom | Pravna i reputaciona šteta |

### Poluge za obuzdavanje

Pripremi ih **prije** incidenta, kao feature flagove i runbookove:

```yaml
# runbooks/ai-kill-switches.yaml — konfiguracija koju čita orkestrator
switches:
  agent_tools_write:      { default: enabled, effect: "isključuje sve alate koji mijenjaju stanje" }
  agent_autonomy:         { default: auto,    values: [auto, confirm_all, disabled] }
  rag_source_external:    { default: enabled, effect: "izbacuje eksterne izvore iz retrievala" }
  model_version_pin:      { default: "3.2.0", effect: "rollback na poznatu verziju" }
  system_prompt_pin:      { default: "v14" }
  per_user_token_budget:  { default: 200000,  emergency: 20000 }
```

| Situacija | Prva poluga | Zatim |
|---|---|---|
| Agent izvršava neželjene akcije | `agent_tools_write: disabled` ili `confirm_all` | Istraga tracea, opoziv tokena koje alati koriste |
| Zatrovan dokument u indeksu | Karantin dokumenta, isključenje izvora | Pregled ingest pipelinea, provjera drugih dokumenata iz istog izvora |
| Regresija nakon deploya | Pin prethodne verzije modela ili prompta | Evaluacija, novi regresioni test |
| Ekstrakcija ili cost harvesting | Hitna kvota, blokada naloga | Pregled ključeva, rotacija |
| Kompromitovan model iz lanca snabdijevanja | Uklanjanje verzije iz servinga, blokada u registryju | AI-BOM upit: gdje se još koristi (modul 9) |

### Dokazi

Sačuvaj prije bilo kakve izmjene: logove i traceove, tačnu verziju (digest) modela, verziju sistemskog prompta i konfiguracije, snimak (snapshot) vektorskog indeksa ili barem spisak dokumenata i njihovih hasheva, stanje kill switch konfiguracije. Bez toga nećeš moći reprodukovati ponašanje, jer se model, prompt i indeks stalno mijenjaju.

### Obavještavanje

Zavisno od incidenta i uloge organizacije, mogu važiti:

- **GDPR**: povreda ličnih podataka, prijava nadzornom tijelu u roku od 72 sata kad postoji rizik za prava pojedinaca,
- **NIS2** i nacionalni propisi o kibernetičkoj sigurnosti za obuhvaćene subjekte,
- **EU AI Act**: pružaoci visokorizičnih AI sistema prijavljuju ozbiljne incidente (član 73) kad za njih počnu da važe obaveze za visokorizične sisteme (vidi modul 11 za rokove nakon AI Omnibusa); pružaoci modela opšte namjene sa sistemskim rizikom imaju posebne obaveze praćenja i prijavljivanja incidenata (član 55),
- ugovorne obaveze prema klijentima i dobavljaču modela.

Za učenje iz tuđih incidenata korisne su javne baze: AI Incident Database i studije slučaja u MITRE ATLAS-u.

> **U praksi:** svaki AI incident završava se novim testom u evaluacionom skupu i, ako je kontrola nedostajala, izmjenom arhitekture, ne samo sistemskog prompta. „Dodali smo rečenicu u prompt“ nije popravka: sljedeća verzija modela je može ignorisati. Popravka je kontrola izvan modela (allowlista, provjera prava, validacija izlaza) plus regresioni test koji dokazuje da radi.

## Rezime

- **Evaluacija** je automatizovana i ponovljiva, **red teaming** istražuje nepredviđeno, pentest gleda infrastrukturu. Red teaming otkriva, evaluacija pamti: svaki nalaz postaje test.
- Red teaming se radi nad **sistemom** (prompt, RAG, alati, prava), u testnom okruženju sa sintetičkim podacima, uz pisana pravila angažmana. Nalazi se mapiraju na OWASP (LLM01–LLM10, ASI01–ASI10) i ATLAS i ocjenjuju stopom ponovljivosti.
- Evaluacija u CI-ju mjeri attack success rate po kategoriji, false refusal rate, usklađenost sa šemom i politikom alata, curenje canary vrijednosti; pokreće se uz svaku izmjenu modela, prompta, alata ili RAG-a.
- Zbog nedeterminizma svaki slučaj se pokreće više puta; determinističke provjere su pouzdanije od LLM-a kao sudije za sigurnosne kategorije.
- Telemetrija mora pokazati šta je model vidio (izvori iz RAG-a), šta je odlučio i šta je izvršeno (pozivi alata i odluke politike), uz verzije modela i prompta i `trace_id`. OpenTelemetry `gen_ai.*` konvencije su dobra osnova.
- Logovi promptova su osjetljivi podaci: redakcija, kratka retencija, ograničen pristup.
- Pripremi poluge za obuzdavanje unaprijed: isključenje alata, nivo autonomije, isključenje izvora, pin verzije modela i prompta, hitni budžeti.
- Sačuvaj dokaze (verzije, indeks, logove) prije izmjena i provjeri obaveze obavještavanja (GDPR, NIS2, EU AI Act član 73 i 55).
