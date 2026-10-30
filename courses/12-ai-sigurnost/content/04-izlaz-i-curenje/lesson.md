## Šta ovaj modul pokriva

Modul pokriva cilj **2.2 Nesigurna obrada izlaza, otkrivanje osjetljivih podataka i curenje sistemskog prompta**, odnosno tri stavke OWASP Top 10 for LLM Applications 2025:

- **LLM05:2025 Improper Output Handling**
- **LLM02:2025 Sensitive Information Disclosure**
- **LLM07:2025 System Prompt Leakage**

Nakon modula treba da znaš:

- tretirati izlaz modela kao nepovjerljiv unos i primijeniti kontekstualni encoding za svako odredište (browser, SQL, shell, fajl sistem, URL);
- tražiti **strukturisan izlaz** i validirati ga **JSON Schema** šemom prije upotrebe;
- sigurno renderovati odgovor (bez sirovog HTML-a, kontrola slika i linkova, CSP);
- popisati sve izvore iz kojih osjetljivi podaci mogu doći u odgovor i postaviti kontrole na pravo mjesto;
- projektovati sistemski prompt pod pretpostavkom da će procuriti.

U labu ovog kursa validiraš strukturisani izlaz modela JSON Schema šemom i renderuješ ga sigurno.

## Izlaz modela je nepovjerljiv unos

U modulu 02 smo vidjeli da se povjerenje prenosi kroz model: ako je u kontekstu bilo šta nepovjerljivo (korisnički unos, dokument, web stranica), izlaz nosi taj uticaj. Čak i bez napada, model može generisati neispravan ili opasan izlaz greškom. Zato izlaz modela tretiraš **isto kao unos sa interneta**.

**Improper Output Handling** nastaje kad se izlaz modela bez validacije, sanitizacije i encodinga prosljeđuje drugoj komponenti. Posljedice su klasične web i sistemske ranjivosti, samo sa novim izvorom:

| Odredište izlaza | Rizik | Kontrola | Gdje u arhitekturi |
|---|---|---|---|
| Browser (HTML/Markdown) | XSS, izvlačenje podataka kroz slike i linkove (ATLAS **AML.T0077 LLM Response Rendering**) | escaping, sanitizacija po allowlisti, CSP, allowlista domena za slike | frontend, renderer |
| SQL baza | SQL injection, neovlašćeno čitanje ili izmjena | parametrizovani upiti, read-only uloga, allowlista upita ili tabela | sloj pristupa podacima |
| Shell / OS | izvršavanje komandi | ne prosljeđivati u shell; fiksne komande sa validiranim argumentima; sandbox | alati agenta |
| Fajl sistem | path traversal, prepisivanje fajlova | kanonizacija putanje, ograničen direktorij, allowlista ekstenzija | alati agenta |
| HTTP zahtjevi | SSRF, izvlačenje podataka | allowlista hostova, zabrana privatnih opsega | alati agenta |
| Interpreter (`eval`, `exec`) | izvršavanje proizvoljnog koda (OWASP **ASI05**) | nikad direktno; izolovan sandbox bez mreže i tajni | runtime |
| E-mail, poruke | phishing u ime organizacije, curenje | šablon, ograničen sadržaj, pregled | integracije |
| Drugi agent ili sistem | prenos manipulacije dalje (ASI07, ASI08) | šema poruke, autentifikacija | među-agentni sloj |

Princip je isti kao u klasičnoj AppSec praksi: **validiraj na ulazu u komponentu, enkodiraj za kontekst u kom se podatak koristi.** Novo je samo to što „ulaz“ dolazi od modela, pa ga timovi često pogrešno smatraju internim.

> **U praksi:** u code reviewu traži sve mjesta gdje se odgovor modela koristi kao string u drugom jeziku: f-string u SQL-u, `subprocess` sa `shell=True`, `innerHTML`, `dangerouslySetInnerHTML`, `os.path.join` sa imenom fajla iz odgovora. To su ista pravila kao za korisnički unos, samo grep ide po promjenljivoj koja nosi izlaz modela.

## Strukturisan izlaz i validacija šemom

Slobodan tekst je teško validirati. Gdje god aplikacija izlaz modela koristi programski (ne samo prikazuje), traži **strukturisan izlaz** (JSON) i validiraj ga šemom. Mnogi API-ji dobavljača nude režim strukturisanog izlaza ili ograničeno dekodiranje prema šemi; to smanjuje broj neispravnih odgovora, ali **ne zamjenjuje validaciju u tvom kodu**: validacija je tvoja kontrola, ne dobavljačeva.

### Dobra šema je restriktivna

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["category", "priority", "summary"],
  "properties": {
    "category": { "enum": ["billing", "technical", "account", "other"] },
    "priority": { "type": "integer", "minimum": 1, "maximum": 4 },
    "summary":  { "type": "string", "maxLength": 500 },
    "ticket_id": { "type": "string", "pattern": "^TCK-[0-9]{6}$" }
  }
}
```

Šta šemu čini sigurnosnom kontrolom, a ne samo formatom:

- `additionalProperties: false`: model ne može „dodati“ polje koje neki kasniji kod slučajno koristi;
- `enum` za sve što ima konačan skup vrijednosti: kategorije, akcije, statusi;
- `minimum`/`maximum` za brojeve (iznosi, prioriteti, količine);
- `maxLength` za stringove, da tekst ne preplavi UI, log ili sljedeći prompt;
- `pattern` za identifikatore, da ID ne može biti putanja, URL ili SQL fragment.

### Validacija u kodu

```python
# Odbrambeni primjer: validacija izlaza modela JSON Schema šemom (jsonschema)
import json
from jsonschema import Draft202012Validator

SCHEMA = json.load(open("ticket_triage.schema.json"))
VALIDATOR = Draft202012Validator(SCHEMA)

class InvalidModelOutput(Exception):
    pass

def parse_model_output(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise InvalidModelOutput(f"nije JSON: {e.msg}")
    errors = sorted(VALIDATOR.iter_errors(data), key=lambda e: list(e.path))
    if errors:
        # loguj putanju i poruku, ne cijeli izlaz (može sadržati lične podatke)
        raise InvalidModelOutput("; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5]))
    return data
```

Šta raditi kad validacija padne:

- **odbiti** i vratiti siguran podrazumijevani odgovor (npr. „kategorija: other, ručna obrada“);
- eventualno **jednom** ponoviti zahtjev uz poruku o grešci, sa limitom pokušaja (veza sa LLM10);
- **logovati** grešku validacije kao signal: nagli rast neispravnih izlaza može značiti pokušaj manipulacije ili promjenu ponašanja modela;
- nikad „popravljati“ izlaz heuristikom koja propušta nepoznata polja.

> **U praksi:** šema je ugovor između modela i ostatka sistema, i zato pripada repou, sa verzijom i testovima. Kad neko promijeni prompt i doda novo polje, test sa šemom treba da padne prije produkcije, ne nakon što frontend počne prikazivati neočekivani sadržaj.

### Validacija nije dovoljna za semantiku

Šema provjerava oblik, ne istinitost. `ticket_id` koji odgovara uzorku i dalje mora postojati i pripadati korisniku. Zato poslije šeme ide **poslovna validacija**: postoji li resurs, smije li ovaj korisnik pristupiti, je li iznos u dozvoljenom opsegu za ovu ulogu.

## Sigurno renderovanje

Većina chat interfejsa renderuje Markdown. Markdown može sadržati sirovi HTML, linkove i slike, i svaki od njih je rizik.

### Rizici u rendereru

- **Sirovi HTML** u odgovoru → XSS ako renderer propušta HTML.
- **Slike sa vanjskog URL-a** → browser automatski šalje zahtjev; URL može nositi podatke iz konteksta (implicitni izlazni kanal, bez ijednog klika).
- **Linkovi** → phishing u ime aplikacije, `javascript:` šeme, linkovi koji takođe nose podatke.
- **Automatski pregled linkova** (unfurl) u chat integracijama → zahtjev bez klika.

### Kontrole

```python
# Odbrambeni primjer: siguran prikaz teksta modela (samo standardna biblioteka)
import html, re
from urllib.parse import urlparse

ALLOWED_LINK_HOSTS = {"docs.interno.example", "status.example.com"}
LINK = re.compile(r"\[([^\]]{1,200})\]\((https://[^\s)]{1,500})\)")

def render_safe(text: str) -> str:
    escaped = html.escape(text)                 # nijedan HTML iz modela ne ostaje aktivan
    def link(m):
        label, url = m.group(1), html.unescape(m.group(2))
        host = urlparse(url).hostname or ""
        if host in ALLOWED_LINK_HOSTS:
            return f'<a href="{html.escape(url, quote=True)}" rel="noopener noreferrer nofollow">{label}</a>'
        return f"{label} ({html.escape(host)})"  # prikaži domen, ne pravi link
    out = LINK.sub(link, escaped)
    return out.replace("\n", "<br>")            # slike se ne renderuju uopšte
```

Uz kod u rendereru:

- **Content Security Policy** kao drugi sloj: `img-src` samo vlastiti domen i odobreni CDN, bez `unsafe-inline` skripti;
- u bibliotekama za Markdown isključi sirovi HTML i koristi sanitizer sa allowlistom tagova i atributa;
- za slike: ili ih ne renderuj, ili samo sa allowlistom domena, ili ih proksiraj kroz vlastiti servis koji ne prosljeđuje parametre;
- link preview isključi za poruke koje generiše model.

```text
# Odbrambeni primjer: CSP zaglavlje za chat UI
Content-Security-Policy: default-src 'self'; img-src 'self' https://cdn.interno.example;
  script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

## Izlaz koji pokreće akcije

Kad izlaz modela postaje upit ili komanda, pravila su stroža:

- **SQL:** model ne piše slobodan SQL koji se izvršava sa punim ovlašćenjima. Bolje: model bira jedan od unaprijed definisanih upita i popunjava parametre koji se validiraju šemom; upit se izvršava parametrizovano, sa read-only ulogom i row-level security po korisniku.
- **Shell:** nikad `shell=True` sa izlazom modela. Fiksna komanda kao lista argumenata, argumenti iz allowliste ili validirani šemom.
- **Generisani kod:** izvršavanje samo u izolovanom sandboxu bez mreže, bez tajni, sa limitima CPU/memorije/vremena i nepromjenljivim osnovnim fajl sistemom; rezultat se ponovo tretira kao nepovjerljiv.

```python
# Odbrambeni primjer: model bira upit iz allowliste, ne piše SQL
QUERIES = {
    "orders_by_status": "SELECT id, status, total FROM orders WHERE customer_id = %s AND status = %s",
    "order_detail":     "SELECT id, status, total, created_at FROM orders WHERE customer_id = %s AND id = %s",
}

def run_query(conn, user, choice: dict):
    sql = QUERIES[choice["query"]]                  # KeyError ako upit nije na listi
    params = (user.customer_id, choice["param"])    # customer_id iz sesije, ne od modela
    with conn.cursor() as cur:                      # konekcija sa read-only ulogom
        cur.execute(sql, params)
        return cur.fetchall()
```

## Otkrivanje osjetljivih podataka (LLM02)

**Sensitive Information Disclosure** znači da odgovor sadrži podatke koje primalac ne smije vidjeti: lične podatke, tajne, poslovne informacije, podatke drugog korisnika ili tenanta. Prvi korak je znati **odakle** osjetljiv podatak može doći u odgovor:

| Izvor | Primjer | Kontrola | Gdje |
|---|---|---|---|
| Podaci za treniranje / fine-tuning | model „zapamti“ lične podatke iz skupa za fine-tuning | minimizacija i anonimizacija prije treniranja, provjera memorisanja | ML pipeline (modul 07) |
| RAG kontekst | dokument kojem korisnik nema pristup uđe u odgovor | ACL po dokumentu **prije** ubacivanja u kontekst | retrieval (modul 06) |
| Rezultati alata | API vrati cijeli zapis, a treba samo jedno polje | alati vraćaju minimalan skup polja | alati |
| Istorija i memorija | podaci jednog korisnika u memoriji koju dijele svi | izolacija memorije po korisniku i tenantu | runtime agenta |
| Keš odgovora | keširan odgovor sa ličnim podacima vraćen drugom korisniku | ključ keša uključuje identitet i ovlašćenja | gateway |
| Sistemski prompt | ključevi, interni URL-ovi, imena u promptu | bez tajni u promptu (LLM07) | konfiguracija |
| Logovi i telemetrija | pun prompt i odgovor u log platformi | redakcija, kontrola pristupa, rok čuvanja | observability |
| Dobavljač modela | podaci se čuvaju ili koriste za treniranje | ugovor: zadržavanje, zabrana treniranja, lokacija | ugovor, procurement |

### Princip: ono što nije u kontekstu ne može procuriti

Najjača kontrola je **minimizacija konteksta**. Filter na izlazu je zadnja linija; prava kontrola je da osjetljiv podatak nikad ne uđe u kontekst za korisnika koji ga ne smije vidjeti.

- Retrieval filtrira po ovlašćenjima korisnika, ne po ovlašćenjima servisa.
- Alati vraćaju samo polja potrebna za zadatak (projekcija, ne `SELECT *`).
- Lični podaci koji nisu potrebni za odgovor se maskiraju prije ubacivanja (npr. broj kartice → zadnje četiri cifre).
- Za zadatke koji ne trebaju identitet (sažimanje, klasifikacija) koristi pseudonimizaciju.

### Filtriranje izlaza (DLP)

Uz minimizaciju, izlaz prolazi provjeru na obrasce koji nikad ne smiju izaći:

```python
# Odbrambeni primjer: provjera izlaza na tajne i lične podatke prije slanja korisniku
import re

PATTERNS = {
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "private_key":    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "iban":           re.compile(r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b"),
    "jmbg":           re.compile(r"\b[0-9]{13}\b"),
}

def dlp_check(text: str) -> tuple[str, list[str]]:
    hits = []
    for name, rx in PATTERNS.items():
        if rx.search(text):
            hits.append(name)
            text = rx.sub(f"[UKLONJENO:{name}]", text)
    return text, hits      # hits idu u log i alarm, bez samog sadržaja
```

Regex hvata strukturisane podatke (ključevi, brojevi računa), ali ne i poslovne tajne u slobodnom tekstu. Za to služe klasifikatori i, prije svega, minimizacija konteksta.

> **U praksi:** kad DLP na izlazu prijavi nalaz, to je incident u ranoj fazi, ne samo blokiran odgovor. Pitanje za istragu je: kako je taj podatak uopšte ušao u kontekst? Odgovor gotovo uvijek vodi do retrievala bez ACL-a, alata koji vraća previše ili tajne u promptu.

### Logovi i dobavljač

- Logovi promptova i odgovora: redakcija ličnih podataka i tajni prije upisa, poseban indeks sa užim pristupom, definisan rok čuvanja.
- Ugovor sa dobavljačem modela: rok zadržavanja podataka, zabrana korištenja za treniranje, lokacija obrade, podobrađivači. Provjeri i postavke na nivou naloga/projekta, ne samo ugovor.
- Korisnicima jasno reci šta ne treba unositi i šta se dešava sa razgovorima.

## Curenje sistemskog prompta (LLM07)

**System Prompt Leakage** je stavka koja je u verziji 2025 izdvojena zbog čestog nesporazuma: problem nije to što neko može pročitati prompt, nego to što se **sigurnost oslanja na tajnost prompta**.

Pretpostavi da će sistemski prompt procuriti (ATLAS **AML.T0056 Extract LLM System Prompt**). Ako je to prihvatljivo, prompt je dobro dizajniran.

### Šta ne smije biti u promptu

| U promptu (loše) | Gdje treba (dobro) |
|---|---|
| API ključevi, lozinke, connection stringovi | secrets manager; alat ih koristi na backendu, model ih nikad ne vidi |
| „Korisnicima bez admin uloge ne prikazuj X“ | autorizacija u kodu i u retrievalu |
| Interni URL-ovi, imena hostova, struktura mreže | konfiguracija alata na backendu |
| Limiti („maksimalno 3 povrata dnevno“) kao jedina kontrola | provjera u poslovnoj logici |
| Lični podaci zaposlenih ili klijenata | ne u prompt; po potrebi iz izvora sa ACL-om |

```yaml
# Odbrambeni primjer: provjera u CI-ju da prompt ne sadrži tajne
prompt-secret-scan:
  stage: test
  script:
    - gitleaks dir prompts/ --redact --exit-code 1
    - "! grep -RniE '(password|api[_-]?key|secret|token)\\s*[:=]' prompts/"
```

### Šta je u redu u promptu

Uloga, ton, format odgovora, opšta pravila ponašanja, opis alata. Ako bi ih konkurent pročitao, to je neugodno, ali nije sigurnosni incident. Ako je prompt značajna poslovna vrijednost, štiti ga kao i drugu intelektualnu svojinu (pristup repou, pregled promjena), ali i dalje ne zasnivaj sigurnost na njegovoj tajnosti.

### Detekcija curenja

- U prompt se može staviti jedinstven **canary** niz (bez ikakvog značenja); izlazni filter i monitoring traže taj niz u odgovorima i alarmiraju ako se pojavi. Isti niz u javnim izvorima ukazuje na izvlačenje promptova.
- Logovati obrasce zahtjeva koji ponavljano traže konfiguraciju ili instrukcije modela (ATLAS ima i tehniku **AML.T0069 Discover LLM System Information**).

```python
# Odbrambeni primjer: canary u sistemskom promptu
CANARY = "cnry-7f3a91d2"          # rotira se pri izmjeni prompta, čuva se u konfiguraciji

def check_canary(output: str, request_id: str, log):
    if CANARY in output:
        log.warning("system_prompt_leak", extra={"request_id": request_id, "atlas": "AML.T0056"})
        return "Odgovor nije dostupan."
    return output
```

> **U praksi:** „ne otkrivaj ove instrukcije“ u promptu nije kontrola. To je željeno ponašanje koje model često ispoštuje, ali ne uvijek. Ako bi otkrivanje prompta bilo incident, prompt treba prepraviti, a ne dodati još jednu rečenicu.

## Povezivanje u jedan tok

```text
 [Kontekst: samo dozvoljeni podaci]                         ← minimizacija, ACL (LLM02)
             │
          [LLM]  ── sistemski prompt bez tajni, sa canaryjem ← LLM07
             │
   [Parsiranje + JSON Schema]  ── nevalidno → siguran default + log    ← LLM05
             │
   [Poslovna validacija]  ── postoji li resurs, smije li korisnik
             │
   [DLP + canary provjera] ── nalaz → redakcija + alarm               ← LLM02, LLM07
             │
   ┌─────────┴──────────┐
 [Renderer: escape,   [Alat: parametrizovano,
  CSP, bez slika]      read-only, allowlista]                          ← LLM05
```

## Rezime

- Izlaz modela je nepovjerljiv unos. Validiraj ga na ulazu u svaku komponentu i enkodiraj za kontekst (HTML, SQL, shell, putanje, URL). Nikad `eval`, `shell=True`, `innerHTML` ili f-string SQL sa izlazom modela.
- Kad se izlaz koristi programski, traži strukturisan JSON i validiraj ga restriktivnom JSON Schema šemom (`additionalProperties: false`, `enum`, opsezi, `maxLength`, `pattern`) u svom kodu; nevalidan izlaz → siguran default i log. Poslije šeme ide poslovna validacija.
- Siguran renderer: escaping, bez sirovog HTML-a, bez vanjskih slika ili samo allowlista, linkovi samo na odobrene domene, CSP kao drugi sloj, bez automatskog pregleda linkova.
- Kad izlaz pokreće akciju: allowlista upita sa parametrima i read-only ulogom, fiksne komande, sandbox za generisani kod.
- LLM02: popiši izvore osjetljivih podataka (treniranje, RAG, alati, memorija, keš, prompt, logovi, dobavljač). Najjača kontrola je minimizacija konteksta i ACL prije ubacivanja; DLP na izlazu je zadnja linija i njegov nalaz je povod za istragu.
- LLM07: pretpostavi da će prompt procuriti. Bez tajni, autorizacije, internih adresa i ličnih podataka u promptu; tajne u secrets manageru, pravila u kodu. Canary niz pomaže u detekciji curenja.
