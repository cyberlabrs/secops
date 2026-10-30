## Šta ovaj modul pokriva

Domen 2, sigurnost LLM aplikacija i agenata:

- **2.3** Agenti i alati: prevelika ovlašćenja (**Excessive Agency**), najmanje privilegije, čovjek u petlji (**human-in-the-loop**), sigurnost **Model Context Protocola (MCP)**.
- **2.4** Neograničena potrošnja (**Unbounded Consumption**) i kontrole zloupotrebe: limiti, budžeti, prekidači.

Poslije ovog modula treba da znaš:

- da objasniš zašto je agent problem **ovlašćenja**, a ne samo problem prompta,
- da projektuješ sloj koji između modela i alata provodi allowlistu, validaciju argumenata i odobrenje čovjeka,
- da prepoznaš rizike iz OWASP Top 10 za agentne aplikacije (ASI01–ASI10) i mapiraš ih na kontrole,
- da primijeniš sigurnosne preporuke MCP specifikacije (token passthrough, confused deputy, SSRF, lokalni serveri, scope),
- da postaviš limite potrošnje na nivou zahtjeva, korisnika, sesije agenta i organizacije.

## Od chatbota do agenta

Chatbot vraća tekst. **Agent** vraća tekst i **poziva alate**: čita mejl, piše u bazu, pokreće kod, otvara tikete. Model u petlji bira sljedeći korak na osnovu cilja i onoga što je pročitao. Tu se mijenja model prijetnje: posljedica više nije „model je napisao nešto pogrešno“ nego „model je **uradio** nešto pogrešno, sa tvojim ovlašćenjima“.

```text
 korisnik ──► ┌──────────────────────── AGENT ────────────────────────┐
              │  orkestrator (petlja: planiraj → pozovi → pročitaj)    │
              │        │                         ▲                     │
              │        ▼                         │ rezultat alata       │
              │   ┌─────────┐   prijedlog    ┌───┴──────────────┐       │
              │   │  LLM    │ ─ poziva ────► │ POLICY GATEWAY   │       │
              │   └─────────┘   alata        │ allowlista       │       │
              │        ▲                     │ validacija arg.  │       │
              │        │ nepovjerljiv        │ odobrenje čovjeka│       │
              │        │ sadržaj             │ budžet, log      │       │
              └────────┼─────────────────────┴───┬──────────────┘───────┘
                       │                         ▼
               mejl, web, RAG,          alati: CRM API, SQL (read-only),
               rezultati alata          sandbox za kod, MCP serveri
```

Ključna ideja je granica povjerenja između **prijedloga** i **izvršenja**. Model predlaže poziv alata; deterministički kod (policy gateway) odlučuje da li se izvršava. Sve što model pročita (mejl, web stranica, dokument iz RAG-a, rezultat drugog alata) je **nepovjerljiv ulaz** i može sadržati instrukcije (indirektni prompt injection, ATLAS **AML.T0051.001**). Ne možemo garantovati da model to neće poslušati, pa štetu ograničavamo ovlašćenjima.

> **U praksi:** pitanje za svaki dizajn agenta je „šta je najgore što ovaj agent može uraditi ako model potpuno posluša napadača?“ Ako je odgovor neprihvatljiv, rješenje nije bolji sistemski prompt nego manje alata, uža ovlašćenja ili odobrenje čovjeka.

## Prevelika ovlašćenja (OWASP LLM06:2025)

OWASP Top 10 za LLM aplikacije 2025 navodi **LLM06:2025 Excessive Agency** i razlaže je na tri korijena:

| Korijen | Primjer | Kontrola | Gdje u arhitekturi |
|---|---|---|---|
| **Excessive functionality** | Agent za čitanje mejla ima i alat za slanje i brisanje | Daj samo alate potrebne za zadatak; ukloni razvojne i probne alate | Registar alata po agentu |
| **Excessive permissions** | Alat za čitanje kalendara koristi servisni nalog sa pristupom svim kalendarima | Alat radi u kontekstu korisnika, sa najužim scopeom | IAM, OAuth scope, DB uloga |
| **Excessive autonomy** | Agent bez potvrde izvršava plaćanja i brisanja | Odobrenje čovjeka za akcije visokog uticaja | Policy gateway, UI za odobrenje |

Uz to OWASP preporučuje: izbjegavaj „otvorene“ alate (generički `shell`, `http_request` na bilo koji URL, `sql` sa slobodnim upitom) i umjesto njih pravi **uske alate** (`get_invoice(id)`, `create_ticket(title, body)`); provodi autorizaciju u **nizvodnom sistemu** (complete mediation), a ne u promptu; loguj i prati pozive alata.

### Uzak alat umjesto otvorenog

| Otvoren alat | Uzak alat | Šta dobijaš |
|---|---|---|
| `run_sql(query)` | `get_order(order_id)` sa parametrizovanim upitom | Nema proizvoljnog SQL-a, nema čitanja tuđih tabela |
| `http_get(url)` | `fetch_docs(page)` samo za `docs.firma.rs` | Nema SSRF-a ka metadata servisu i internoj mreži |
| `shell(cmd)` | `run_tests(repo)` u efemernom sandboxu | Nema proizvoljnih komandi na hostu |
| `send_email(to, body)` | `reply_to_ticket(ticket_id, body)` | Primalac je određen podacima, ne modelom |

Posljednji red je važan obrazac: **parametre koji određuju štetu (primalac, iznos, putanja, nalog) ne bira model** nego ih izvodi kod iz konteksta (tiket, prijavljeni korisnik).

## OWASP Top 10 za agentne aplikacije

OWASP GenAI Security Project je u decembru 2025. objavio **OWASP Top 10 for Agentic Applications (2026)**. Lista ne zamjenjuje Top 10 za LLM nego ga dopunjuje rizicima koji nastaju kad model djeluje autonomno:

| Oznaka | Rizik | Glavna kontrola |
|---|---|---|
| **ASI01** | Agent Goal Hijack: cilj agenta preusmjeren kroz sadržaj koji čita | Nepovjerljiv sadržaj odvojen od instrukcija, ograničena ovlašćenja, odobrenje za akcije |
| **ASI02** | Tool Misuse and Exploitation: legitiman alat upotrijebljen štetno | Uski alati, validacija argumenata, limiti po alatu |
| **ASI03** | Identity and Privilege Abuse | Identitet po agentu i po korisniku, kratkotrajni tokeni, bez dijeljenih servisnih naloga |
| **ASI04** | Agentic Supply Chain Vulnerabilities | Allowlista i pinovanje MCP servera, alata i promptova |
| **ASI05** | Unexpected Code Execution | Sandbox bez mreže, efemerno okruženje, bez tajni |
| **ASI06** | Memory and Context Poisoning | Provjera prije upisa u memoriju, porijeklo zapisa, istek |
| **ASI07** | Insecure Inter-Agent Communication | Autentifikovane i potpisane poruke, mTLS, šema poruka |
| **ASI08** | Cascading Failures | Prekidači (circuit breaker), limiti, izolacija agenata |
| **ASI09** | Human-Agent Trust Exploitation | Odobrenje prikazuje stvarnu akciju, ne sažetak modela |
| **ASI10** | Rogue Agents | Nadzor ponašanja, inventar agenata, kill switch |

U MITRE ATLAS-u odgovarajuće ublažavanje je grupisano u mitigacije za agente: **AML.M0026** Privileged AI Agent Permissions Configuration, **AML.M0027** Single-User AI Agent Permissions Configuration, **AML.M0028** AI Agent Tools Permissions Configuration, **AML.M0029** Human In-the-Loop for AI Agent Actions, **AML.M0030** Restrict AI Agent Tool Invocation on Untrusted Data, **AML.M0032** Segmentation of AI Agent Components i **AML.M0033** Input and Output Validation for AI Agent Components. Tehnika **AML.T0053 AI Agent Tool Invocation** opisuje zloupotrebu poziva alata, a **AML.T0086** eksfiltraciju podataka kroz alat agenta.

## Najmanje privilegije za alate

### Čiji identitet koristi alat

| Model identiteta | Prednost | Rizik |
|---|---|---|
| Dijeljeni servisni nalog | Jednostavno | Agent jednog korisnika vidi podatke svih; audit ne zna ko je tražio |
| **Delegirani token korisnika** (OAuth, on-behalf-of) | Agent ne može više od korisnika; audit je tačan | Treba token exchange i uske scopeove |
| Poseban identitet agenta + korisnik u kontekstu | Agent ima sopstvenu, užu politiku | Treba provoditi presjek prava agenta i korisnika |

Preporuka: **efektivno pravo = presjek** prava korisnika i prava dodijeljenog agentu. Agent za podršku koji radi za Anu ne smije vidjeti ništa što Ana ne smije, ali ni sve što Ana smije (npr. HR portal).

### Policy gateway: allowlista i validacija argumenata

Gateway je običan kod koji svaki prijedlog modela provjerava prije izvršenja. Politika je deklarativna, pod verzionisanjem i reviewom:

```yaml
# tool-policy.yaml - politika za agenta "podrska"
agent: podrska
default: deny
tools:
  get_order:
    risk: low
    schema: schemas/get_order.json
    rate_limit: { per_minute: 30 }
  reply_to_ticket:
    risk: medium
    schema: schemas/reply_to_ticket.json
    max_body_chars: 4000
  issue_refund:
    risk: high
    schema: schemas/issue_refund.json
    require_approval: true      # čovjek odobrava svaki poziv
    max_amount_eur: 200
```

```python
import json, jsonschema, yaml

POLICY = yaml.safe_load(open("tool-policy.yaml"))

class Denied(Exception): ...

def authorize(tool: str, raw_args: str, user, session) -> dict:
    spec = POLICY["tools"].get(tool)
    if spec is None:                                  # default: deny
        raise Denied(f"alat {tool} nije na allowlisti")
    args = json.loads(raw_args)                       # model daje JSON, ne kod
    schema = json.load(open(spec["schema"]))
    jsonschema.validate(args, schema)                 # additionalProperties: false
    if tool == "issue_refund" and args["amount_eur"] > spec["max_amount_eur"]:
        raise Denied("iznos iznad limita")
    if not user.can_access_order(args["order_id"]):   # autorizacija u kodu
        raise Denied("korisnik nema pristup narudžbi")
    session.charge_tool_call(tool)                    # budžet poziva (2.4)
    return {"args": args, "needs_approval": spec.get("require_approval", False)}
```

Šema treba da bude stroga: `additionalProperties: false`, tipovi, `maxLength`, `pattern` za ID-jeve, `enum` gdje je moguće. Validacija nije zamjena za autorizaciju: šema kaže da je `order_id` ispravnog oblika, a tek `can_access_order` kaže da ga ovaj korisnik smije vidjeti.

> **U praksi:** loguj odbijene pozive kao sigurnosni signal. Agent koji iznenada predlaže alate koji nisu na listi, ili ponavlja odbijeni poziv sa varijacijama argumenata, često je čitao sadržaj sa ubačenim instrukcijama. To je dobar okidač za alarm i za prekid sesije.

### Tajne i mreža

- Model nikad ne vidi kredencijale. Gateway dodaje token pri izvršenju; u promptu i logovima nema API ključeva.
- Alati koji pristupaju mreži idu kroz **egress proxy** sa allowlistom domena; blokirani su `169.254.169.254`, privatni opsezi i `localhost`.
- Rezultat alata se skraćuje i označava kao nepovjerljiv prije nego što se vrati modelu.

## Čovjek u petlji

Odobrenje čovjeka je najjača kontrola protiv excessive autonomy, ali samo ako je dobro urađeno.

| Loše | Dobro |
|---|---|
| „Agent želi da nastavi. Odobri?“ | Prikazana tačna akcija: alat, argumenti, primalac, iznos |
| Sažetak koji je napisao model | Podaci izvedeni iz stvarnog poziva, ne iz teksta modela |
| Odobrenje za svaki poziv, i čitanje | Odobrenje samo za akcije visokog uticaja (pisanje, slanje, plaćanje, brisanje) |
| Odobrenje važi za cijelu sesiju | Odobrenje vezano za konkretan poziv (hash argumenata), jednokratno, sa istekom |
| Isti korisnik čiji je agent kompromitovan odobrava kritične akcije | Za kritične akcije drugi par očiju (četiri oka) |

Prevelik broj odobrenja vodi u **approval fatigue**: ljudi klikću „da“ bez čitanja, što je tačno ASI09. Zato se akcije klasifikuju po riziku, a nisko-rizične (čitanje u okviru korisnikovih prava) prolaze automatski uz logovanje.

```python
import hashlib, json, time

def approval_request(tool, args, user):
    payload = json.dumps({"tool": tool, "args": args}, sort_keys=True)
    return {
        "id": hashlib.sha256(payload.encode()).hexdigest(),  # vezano za tačne argumente
        "display": payload,                                  # prikazuje se doslovno
        "requested_by": user.id,
        "expires_at": time.time() + 600,
    }
# Izvršenje: gateway ponovo računa hash argumenata i izvršava samo ako postoji
# neiskorišteno, neisteklo odobrenje sa istim hashom.
```

## Izvršavanje koda koje generiše agent (ASI05)

Agenti za analizu podataka i programiranje izvršavaju kod koji je napisao model. Tretiraj ga kao kod nepoznatog autora:

| Rizik | Kontrola |
|---|---|
| Pristup fajlovima hosta | Efemeran kontejner ili mikro-VM, read-only root, samo radni direktorij |
| Eksfiltracija | Bez mreže (`--network none`) ili egress samo ka allowlisti |
| Krađa tajni | Nema tajni u okruženju; nema montiranog Docker socketa ni cloud kredencijala |
| Iscrpljivanje resursa | Limit CPU-a, memorije, procesa i vremena izvršavanja |
| Perzistencija | Okruženje se uništava poslije zadatka |

Ovo je isti princip kao kontejnerska izolacija iz CKS-a: non-root, bez privilegija, seccomp, bez dodatnih capabilities.

## Memorija i više agenata (ASI06, ASI07)

Dugoročna memorija agenta (beleške, sažeci prethodnih razgovora, vektorska baza) je **trajna površina za trovanje**: sadržaj koji je jednom ušao može uticati na buduće sesije. ATLAS ovo opisuje kao **AML.T0080 AI Agent Context Poisoning** (podtehnike Memory i Thread).

- Upis u memoriju je akcija koju gateway kontroliše, ne slobodna odluka modela.
- Svaki zapis nosi porijeklo (korisnik, izvor, vrijeme) i nivo povjerenja; sadržaj iz nepovjerljivih izvora se ne upisuje kao „činjenica“.
- Memorija je odvojena po korisniku i tenantu; zapisi imaju istek i mogu se pregledati i obrisati.

Kod više agenata (planer, izvršioci, pregledač) svaka poruka između agenata je ulaz kao i svaki drugi: autentifikacija servisa (mTLS, potpisani tokeni), šema poruke i provjera ovlašćenja na strani primaoca. Agent niže u lancu ne smije naslijediti sva prava agenta iznad.

## Model Context Protocol (MCP)

**MCP** je otvoren protokol kojim **host** (npr. IDE ili chat aplikacija) preko **MCP klijenta** povezuje model sa **MCP serverima** koji izlažu **tools** (akcije), **resources** (podatke) i **prompts** (šablone). Transport je `stdio` za lokalne servere ili **Streamable HTTP** za udaljene. Za udaljene servere specifikacija definiše autorizaciju na osnovu OAuth 2.1: MCP server je resource server, objavljuje Protected Resource Metadata (RFC 9728), a klijent traži token za tačno taj resurs (resource indicators, RFC 8707).

```text
 ┌──────────── host (IDE / chat) ─────────────┐
 │  LLM ◄──► MCP klijent A ─── stdio ────────────► lokalni MCP server (fajlovi)
 │           MCP klijent B ─── HTTPS + OAuth ────► udaljeni MCP server ──► SaaS API
 │           MCP klijent C ─── HTTPS + OAuth ────► interni MCP server ──► baza
 └────────────────────────────────────────────┘
   granice povjerenja: host ↔ svaki server ↔ svaki nizvodni API
```

Dokument **Security Best Practices** iz MCP specifikacije navodi napade i obavezne kontrole. Najvažnije za inženjera koji uvodi MCP u organizaciju:

| Rizik iz MCP preporuka | Šta je problem | Kontrola |
|---|---|---|
| **Token passthrough** | Server prihvata token koji nije izdat njemu i prosljeđuje ga dalje | Server **MUST NOT** prihvatiti token koji nije izdat za njega; provjera `aud`; za nizvodni API poseban token |
| **Confused deputy** | MCP proxy sa statičkim client ID-jem kod treće strane preskoči saglasnost korisnika | Saglasnost po klijentu prije prosljeđivanja, tačna provjera `redirect_uri`, jednokratan `state` |
| **SSRF** | Zlonamjeran server navodi klijenta da dohvati interne URL-ove tokom OAuth otkrivanja | HTTPS, blokada privatnih i link-local opsega, egress proxy, provjera redirecta |
| **Preuzimanje sesije / handlea** | Pogođen ili ukraden identifikator stanja | Nasumični handle vezan za autentifikovanog korisnika; handle nije autentifikacija |
| **Kompromitovan lokalni server** | Konfiguracija pokrene proizvoljnu komandu sa pravima korisnika | Prikaz pune komande i izričita saglasnost; sandbox; `stdio` umjesto otvorenog HTTP porta |
| **Scope minimization** | Token sa širokim scopeovima (`*`, `admin`) | Minimalni početni scope, postepeno podizanje (step-up), bez omnibus scopeova |

Uz ove tačke iz specifikacije, sigurnosna zajednica upozorava na rizike lanca snabdijevanja MCP-a (ASI04, ATLAS **AML.T0010.005** AI Agent Tool): opis alata dolazi sa servera i model ga čita, pa je i opis nepovjerljiv sadržaj; server se može promijeniti poslije odobrenja. Kontrole su organizacione i tehničke:

- **registar odobrenih MCP servera** (interni katalog), ostali blokirani na nivou hosta ili proxyja,
- pinovanje verzije servera i **hash opisa alata**; promjena opisa traži ponovni review,
- **tool annotations** (`readOnlyHint`, `destructiveHint`…) su nagovještaji; specifikacija kaže da ih klijent tretira kao nepouzdane osim ako server nije pouzdan,
- jedan server, jedna svrha, sopstveni uski token; nema servera „za sve“.

```yaml
# mcp-allowlist.yaml - centralna politika za MCP klijente u organizaciji
servers:
  - name: docs-search
    transport: streamable-http
    url: https://mcp.interno.firma.rs/docs
    version: "1.4.2"
    tools_sha256: "3f1c…"        # hash kanonskog JSON-a liste alata pri reviewu
    scopes: ["docs:read"]
  - name: local-files
    transport: stdio
    command: ["/opt/mcp/files-server", "--root", "/workspace"]
    sandbox: { network: none, read_only: true }
policy:
  unknown_servers: deny
  on_tools_change: block_and_alert
```

> **U praksi:** developeri sami dodaju MCP servere u IDE kao što su nekad dodavali browser ekstenzije. Uvedi inventar (koji serveri, ko ih koristi, sa kojim tokenima) prije nego što uvedeš zabrane. Bez inventara ne znaš šta blokiraš, a sa njim brzo vidiš koji serveri imaju pristup produkcionim sistemima.

## Neograničena potrošnja (OWASP LLM10:2025)

**LLM10:2025 Unbounded Consumption** pokriva situacije u kojima aplikacija dozvoljava pretjerano i nekontrolisano izvođenje inferencije. Posljedice su tri vrste:

- **uskraćivanje usluge**: modeli su skupi po zahtjevu, pa mali broj teških zahtjeva zaguši servis (ATLAS **AML.T0029** Denial of AI Service),
- **Denial of Wallet**: račun za tokene ili GPU raste bez kontrole (ATLAS **AML.T0034** Cost Harvesting, sa podtehnikama za prekomjerne upite, resursno zahtjevne upite i potrošnju agenata),
- **zloupotreba API-ja za kopiranje modela**: veliki broj sistematskih upita može poslužiti za treniranje zamjenskog modela; detaljnije u modulu o krađi modela (4.3).

Kod agenata problem je izraženiji: jedna korisnička poruka može pokrenuti desetine poziva modela i alata, a petlja koja se ne završava troši bez kraja.

### Kontrole po slojevima

| Sloj | Kontrola | Primjer vrijednosti |
|---|---|---|
| Zahtjev | Maksimalna dužina ulaza, `max_tokens` izlaza, timeout | 8k tokena ulaza, 1k izlaza, 30 s |
| Korisnik / API ključ | Rate limit i dnevna kvota tokena | 20 zahtjeva/min, 200k tokena/dan |
| Sesija agenta | Maksimalan broj koraka, poziva alata i ukupni budžet | 15 koraka, 30 poziva, 0,50 € |
| Alat | Limit po alatu, paginacija, maksimalna veličina rezultata | 100 redova, 50 KB |
| Organizacija | Budžet po aplikaciji, upozorenja i tvrdi limit kod providera | upozorenje na 80 %, stop na 100 % |
| Infrastruktura | Red čekanja, autoscaling sa gornjom granicom, prioriteti | max replika, odbijanje sa 429 |

```python
class BudgetExceeded(Exception): ...

class AgentBudget:
    def __init__(self, max_steps=15, max_tool_calls=30, max_cost_eur=0.50, max_seconds=120):
        self.limits = dict(steps=max_steps, tools=max_tool_calls, cost=max_cost_eur, secs=max_seconds)
        self.used = dict(steps=0, tools=0, cost=0.0, secs=0.0)

    def charge(self, kind: str, amount=1):
        self.used[kind] += amount
        if self.used[kind] > self.limits[kind]:
            raise BudgetExceeded(f"{kind}: {self.used[kind]} > {self.limits[kind]}")

# Orkestrator poziva budget.charge("steps") prije svakog koraka, "tools" prije
# svakog alata i "cost" poslije svakog odgovora modela (tokeni × cijena).
# BudgetExceeded završava sesiju porukom korisniku i događajem u logu.
```

### Detekcija zloupotrebe

- metrike po korisniku i ključu: tokeni, cijena, broj koraka agenta, stopa odbijenih poziva alata,
- alarm na odstupanje od uobičajenog (npr. 10× prosječna dnevna potrošnja),
- prepoznavanje ponavljajućih petlji (isti alat sa istim argumentima više puta zaredom),
- obrasci sistematskog preuzimanja (veliki broj raznovrsnih upita sa jednog ključa, ravnomjeran ritam) kao signal za moguće kopiranje modela,
- **circuit breaker** koji privremeno isključuje alat ili agenta kad stopa grešaka ili potrošnja pređe prag (ASI08).

> **U praksi:** postavi tvrdi budžet i kod providera modela, ne samo u svojoj aplikaciji. Greška u orkestratoru može zaobići tvoj limit, ali ne i limit na nalogu. Uz to, `max_tokens` bez limita broja koraka ne štiti agenta: svaki korak je mali, ali ih je hiljadu.

### Graciozna degradacija

Kad se limit dostigne, sistem treba da odbije predvidivo: HTTP 429 sa `Retry-After`, poruka korisniku, prelazak na manji model ili keširani odgovor za uobičajena pitanja. Nikad ne treba „nastaviti bez limita jer je korisnik važan“; izuzeci idu kroz konfiguraciju sa vlasnikom i rokom.

## Logovanje akcija agenta

Za istragu incidenta treba rekonstruisati lanac: šta je korisnik tražio, šta je model pročitao, šta je predložio, šta je gateway odlučio i šta je izvršeno.

| Polje | Zašto |
|---|---|
| `session_id`, `user_id`, `agent_id` | Ko i u čije ime |
| izvori koje je model pročitao (ID dokumenta, URL, hash) | Porijeklo moguće ubačene instrukcije |
| predloženi alat i argumenti | Šta je model htio |
| odluka gatewaya (allow/deny/approval) i razlog | Šta je kontrola uradila |
| ko je odobrio i kada | Odgovornost za akcije visokog uticaja |
| rezultat i trošak | Posljedica i potrošnja |

Logovi mogu sadržati lične podatke, pa važe ista pravila zadržavanja i pristupa kao za druge logove (detaljnije u modulu 10).

## Rezime

- Agent pretvara grešku modela u **akciju**; štetu ograničavaš ovlašćenjima, ne promptom.
- **LLM06 Excessive Agency** ima tri korijena: previše funkcionalnosti, previše dozvola, previše autonomije. Kontrole: uski alati, delegirani identitet sa presjekom prava, odobrenje čovjeka za akcije visokog uticaja.
- **Policy gateway** između modela i alata: `default: deny`, stroga JSON Schema, autorizacija u kodu, limiti i logovanje. Parametre koji određuju štetu izvodi kod, ne model.
- Odobrenje čovjeka prikazuje tačnu akciju, vezano je za hash argumenata i rezervisano za rizične akcije, da se izbjegne approval fatigue.
- **OWASP Top 10 for Agentic Applications (2026)** dopunjuje LLM Top 10: goal hijack, zloupotreba alata, identitet, lanac snabdijevanja, izvršavanje koda, trovanje memorije, komunikacija agenata, kaskadni otkazi, povjerenje ljudi, odmetnuti agenti.
- **MCP**: bez token passthrougha, provjera audiencea, saglasnost po klijentu, zaštita od SSRF-a, sandbox i saglasnost za lokalne servere, minimalni scopeovi, registar odobrenih servera i pinovanje opisa alata.
- **LLM10 Unbounded Consumption**: limiti na nivou zahtjeva, korisnika, sesije agenta, alata i organizacije; tvrdi budžet kod providera; detekcija petlji i anomalija; graciozna degradacija.
