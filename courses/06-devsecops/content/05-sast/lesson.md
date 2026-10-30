## Šta ovaj modul pokriva

Cilj **3.1**: **SAST** (Static Application Security Testing) sa Semgrepom. Pišemo pravila, koristimo **taint analizu**, smanjujemo lažne pozitive i izvozimo rezultate u **SARIF**.

| Gdje u pipelineu | Šta radi | Koju prijetnju sprječava |
|---|---|---|
| Lokalno / pre-commit | brz scan izmijenjenih fajlova | developer dobije povratnu informaciju prije pusha |
| Merge request job | scan samo **novih** nalaza u odnosu na ciljnu granu | ranjiv kod ulazi u `main` |
| Pipeline na `main` / noćni | puni scan, izvještaj u SARIF/GitLab formatu | tehnički dug koji niko ne prati |

SAST čita izvorni kod bez pokretanja aplikacije i traži obrasce koji vode do ranjivosti: SQL injection, command injection, nesigurna deserijalizacija, hardkodovane tajne, debug mod. U `kurs-shop/app.py` imamo sve to namjerno.

### SAST u odnosu na ostale testove

| | **SAST** | **SCA** | **DAST** | **IAST** |
|---|---|---|---|---|
| Šta analizira | tvoj izvorni kod | zavisnosti (lockfajlovi, paketi) | aplikaciju koja radi, spolja | aplikaciju koja radi, iznutra (agent) |
| Kada u pipelineu | rano: commit, MR | rano: commit, MR, i stalno nakon novih CVE-ova | kasno: nakon deploya u test okruženje | tokom testova (funkcionalnih ili QA) |
| Tačno locira liniju | da | paket i verziju | ne, samo URL i parametar | da |
| Tipični lažni pozitivi | mnogo, ako pravila nisu podešena | ranjivost u kodu koji se ne poziva | manje, ali propušta dosta | malo |
| Alat u kursu | Semgrep | osv-scanner, Trivy (modul 06) | OWASP ZAP (modul 11) | (nije u kursu) |

Nijedan ne zamjenjuje drugi. Primjer: `PyYAML==5.3.1` je ranjiva verzija (SCA nalaz), ali `yaml.load(..., Loader=yaml.Loader)` je nesiguran **i na najnovijoj verziji** jer je to izričito nesiguran loader. Taj problem nalazi samo SAST.

## Semgrep: CE i plaćena platforma

**Semgrep Community Edition (CE)** je open source CLI. Pravila su YAML i liče na kod koji traže, pa ih piše svaki developer, ne samo AppSec tim.

| | Semgrep CE | Semgrep AppSec Platform (Code/Pro) |
|---|---|---|
| Pattern i taint pravila | da | da |
| Taint analiza | unutar jedne funkcije (intraprocedural) | kroz funkcije (`--pro-intrafile`) i kroz fajlove (`--pro`, interfile) |
| Pravila | tvoja + javna community pravila | uz to Pro pravila |
| Upravljanje nalazima, triage, MR komentari | ne (ti gradiš u CI-ju) | da, web aplikacija |
| Supply Chain (SCA sa reachability), Secrets | ne | da, kao posebni proizvodi |

U labu radi **Semgrep 1.179 CE bez mreže**: registry pravila (`--config p/python`, `--config auto`) nisu dostupna. Koristimo lokalna pravila u `/opt/kurs/semgrep-rules/python.yml` i ona koja sami napišemo.

Za kontekst: 2025. je nastao **Opengrep**, community fork Semgrep CE engine-a, nakon što je Semgrep promijenio licencu za svoja pravila. Sintaksa pravila je ista, pa sve iz ovog modula važi i za njega.

## Prvi scan

```bash
cd /root/kurs-shop
semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off
```

Rezultat (skraćeno, šest nalaza):

```
app.py
   ❯❯❱ opt.kurs.semgrep-rules.kurs.python.sqli-string-query
          SQL upit je sastavljen spajanjem stringova ili f-stringom...
           36┆ rows = get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE
   ❯❯❱ opt.kurs.semgrep-rules.kurs.python.flask-request-to-sql
           36┆ rows = get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE
   ❯❯❱ opt.kurs.semgrep-rules.kurs.python.subprocess-shell-true
           43┆ out = subprocess.check_output("ping -c 1 " + host, shell=True)
  ...
```

Primijeti prefiks `opt.kurs.semgrep-rules.`: kad se pravila učitavaju iz lokalnog fajla ili direktorija, Semgrep ID-u pravila doda putanju do fajla (tačkama umjesto `/`). To je bitno na dva mjesta: `# nosemgrep: kurs.python.sqli-string-query` radi i sa kratkim ID-jem, ali `--exclude-rule` traži **puni** ID (`--exclude-rule opt.kurs.semgrep-rules.kurs.python.flask-debug`), inače tiho ne isključi ništa. U pipelineu zato uvijek pokreći pravila sa iste relativne putanje (npr. `semgrep-rules/`), da ID-jevi u izvještajima i izuzecima budu stabilni.

Korisni flagovi:

| Flag | Šta radi |
|---|---|
| `--config <fajl\|dir>` | pravila (može više puta) |
| `--metrics=off` | bez slanja telemetrije (u labu je i `SEMGREP_SEND_METRICS=off`) |
| `--error` | exit code 1 ako ima nalaza; **bez njega Semgrep vraća 0 i kad nađe probleme** |
| `--severity ERROR` | samo pravila te ozbiljnosti (INFO, WARNING, ERROR; može više puta) |
| `--json`, `--sarif`, `--gitlab-sast` | format izlaza na stdout |
| `--json-output=f`, `--sarif-output=f`, `--gitlab-sast-output=f` | kopija u tom formatu u fajl; može više odjednom |
| `--exclude <glob>`, `--include <glob>` | filtriranje fajlova |
| `--exclude-rule <id>` | isključi jedno pravilo za ovaj scan (puni ID, sa prefiksom putanje) |
| `--baseline-commit <sha>` | prijavi samo nalaze kojih nije bilo u tom commitu |

Exit kodovi: `0` uspješno (ili nalazi bez `--error`), `1` nalazi uz `--error`, `2` Semgrep je pao, `7` neispravno pravilo. U pipelineu razlikuj 1 (posao gatea) od 2 i 7 (posao onoga ko održava job).

## Anatomija pravila

```yaml
rules:
  - id: kurs.python.requests-no-timeout
    languages: [python]
    severity: WARNING
    message: >-
      requests.$METHOD bez timeout parametra može blokirati worker zauvijek.
      Dodaj timeout=(3, 10).
    metadata:
      cwe: "CWE-400: Uncontrolled Resource Consumption"
      category: security
      confidence: HIGH
    patterns:
      - pattern: requests.$METHOD(...)
      - metavariable-regex:
          metavariable: $METHOD
          regex: ^(get|post|put|patch|delete|head)$
      - pattern-not: requests.$METHOD(..., timeout=$T, ...)
```

Obavezno: `id`, `languages`, `severity`, `message` i bar jedan pattern operator. `metadata` je slobodan, ali `cwe`, `owasp` i `confidence` kasnije koristiš za filtriranje i izvještaje.

Gradivni blokovi:

| Operator | Značenje |
|---|---|
| `pattern` | kod koji tražiš; `...` je „bilo šta“, `$X` je metavarijabla |
| `patterns` | logičko I: svi uslovi moraju važiti |
| `pattern-either` | logičko ILI |
| `pattern-not` | isključi ovaj oblik |
| `pattern-inside` / `pattern-not-inside` | nalaz mora (ne smije) biti unutar ovog konteksta |
| `metavariable-regex` | metavarijabla mora odgovarati regexu |
| `focus-metavariable` | nalaz označava samo dio koda vezan za metavarijablu |
| `fix` | prijedlog popravke; primjenjuje se sa `--autofix` |

Semgrep razumije kod, ne tekst: `$APP.config["SECRET_KEY"] = "..."` hvata i varijante sa drugim imenom varijable ili drugačijim razmacima, `subprocess.$FUNC(..., shell=True, ...)` hvata `shell=True` na bilo kojoj poziciji, a `from subprocess import run` pa `run(...)` se razrješava do `subprocess.run`.

### Isključivanje sigurnih oblika

Lab pravilo za YAML hvata samo eksplicitno nesigurne loadere. Šira verzija pravila bi bila „svaki `yaml.load` osim sa `SafeLoader`“:

```yaml
    patterns:
      - pattern: yaml.load(...)
      - pattern-not: yaml.load(..., Loader=yaml.SafeLoader, ...)
      - pattern-not: yaml.load(..., Loader=yaml.CSafeLoader, ...)
    fix: yaml.safe_load($DATA)
```

Pazi na `fix`: radi samo ako je `$DATA` vezan u patternu. Bez toga je bolje ostaviti tekstualnu preporuku u `message`.

### Testiranje pravila

Pravila su kod i treba ih testirati. Semgrep traži test fajl istog imena pored pravila i u njemu anotacije `# ruleid: <id>` (ovdje mora biti nalaz) i `# ok: <id>` (ovdje ne smije):

```python
# /root/kurs-rules/requests-timeout.py
import requests

# ruleid: kurs.python.requests-no-timeout
requests.get("https://api.kurs-shop.ba/stock")

# ok: kurs.python.requests-no-timeout
requests.get("https://api.kurs-shop.ba/stock", timeout=5)
```

```bash
semgrep --test /root/kurs-rules/
```

Dodaj ovaj test u pipeline repoa sa pravilima; tako izmjena pravila ne može tiho prestati da nalazi ono što je nalazila.

> **U praksi:** Ne pokušavaj odmah napisati savršeno pravilo. Počni sa jednim obrascem iz stvarnog incidenta ili pentest nalaza („ovaj bug se ne smije ponoviti“), dodaj `ruleid` i `ok` primjere, pa pravilo pooštravaj kako stižu lažni pozitivi. Organizaciono specifična pravila (vaš ORM, vaš auth dekorator) hvataju stvari koje nijedan generički ruleset ne zna.

## Taint analiza

Pattern pravilo `kurs.python.sqli-string-query` hvata svaki f-string u `execute`, pa i ovaj sasvim siguran:

```python
TABLE = "products"
conn.execute(f"SELECT COUNT(*) FROM {TABLE}")
```

**Taint analiza** prati tok podataka: nalaz postoji samo ako podatak iz nepouzdanog **izvora** (source) stigne do opasnog **ponora** (sink), a usput ne prođe kroz **sanitizer**.

```yaml
rules:
  - id: kurs.python.flask-request-to-shell
    languages: [python]
    severity: ERROR
    mode: taint
    message: Parametar HTTP zahtjeva stiže do komande koja se izvršava kroz shell.
    metadata:
      cwe: "CWE-78: OS Command Injection"
    pattern-sources:
      - pattern: flask.request.args.get(...)
      - pattern: flask.request.form[...]
    pattern-sanitizers:
      - pattern: shlex.quote(...)
      - pattern: ipaddress.ip_address(...)
    pattern-sinks:
      - patterns:
          - pattern: subprocess.$F($CMD, ..., shell=True, ...)
          - focus-metavariable: $CMD
```

Za `/ping` rutu: `host = request.args.get(...)` je izvor, `"ping -c 1 " + host` nosi taint dalje kroz spajanje stringova, a prvi argument `check_output(..., shell=True)` je ponor. Ako developer doda `host = str(ipaddress.ip_address(host))`, nalaz nestaje jer je vrijednost prošla kroz sanitizer.

`focus-metavariable` je bitan: bez njega bi ponor bio cijeli poziv, pa bi taint u bilo kom argumentu (npr. `timeout`) dao nalaz.

Lab pravilo `kurs.python.flask-request-to-sql` radi isto za SQL: izvor `flask.request.$ATTR.get(...)`, ponor prvi argument `$DB.execute(...)`.

### Ograničenje CE: jedna funkcija

U CE taint radi unutar jedne funkcije. Ovaj kod lab pravila **ne vide** (provjereno na Semgrep CE):

```python
def find_products(q):
    query = "SELECT * FROM products WHERE name LIKE '%" + q + "%'"
    return get_db().execute(query).fetchall()

@app.route("/search")
def search():
    q = request.args.get("q", "")
    return jsonify(find_products(q))
```

Izvor (`request.args.get`) je u `search`, a ponor (`execute`) u `find_products`; CE ne prati taint kroz parametar u drugu funkciju. Ni pattern pravilo `sqli-string-query` ne pomaže, jer upit nije sastavljen direktno u pozivu `execute(...)` nego u varijabli `query`. Semgrep Pro bi pratio tok kroz funkciju (interprocedural), a sa interfile analizom i kroz module.

Obrnut slučaj CE uglavnom hvata: ako se nepouzdana vrijednost proslijedi pomoćnoj funkciji koja vraća string (`execute(build_query(q))`), taint po defaultu „prolazi“ kroz poziv nepoznate funkcije i nalaz postoji.

Sa CE se rupe nadoknađuju kombinacijom: šira pattern pravila (npr. `pattern-inside` funkcije koja sastavlja SQL), taint pravila za direktne tokove, code review i DAST koji ovakvu rutu napadne spolja (modul 11).

## Lažni pozitivi i izuzeci

Alat koji viče na sve developeri brzo prestanu gledati. Redoslijed postupanja sa lažnim pozitivom:

1. **Popravi pravilo** ako je problem u pravilu (dodaj `pattern-not`, sanitizer, suzi izvor). Jedna izmjena pravila uklanja lažni pozitiv svuda.
2. **Inline izuzetak** za pojedinačni slučaj, uvijek sa ID-jem pravila i razlogom:

```python
# vrijednost je konstanta iz koda, nije korisnički ulaz; AppSec-412, revizija 2027-01
conn.execute(f"SELECT COUNT(*) FROM {TABLE}")  # nosemgrep: kurs.python.sqli-string-query
```

`# nosemgrep` bez ID-ja gasi **sva** pravila na toj liniji, uključujući buduća. Zabrani ga u code reviewu (ili napiši Semgrep pravilo koje ga hvata).

3. **Isključi putanje** koje nisu produkcijski kod, u `.semgrepignore` u korijenu repoa (gitignore sintaksa):

```
tests/
frontend/node_modules/
*.min.js
```

4. **Isključi pravilo** za cijeli projekat (`--exclude-rule`) samo uz odluku zapisanu u repou (npr. `SECURITY.md` ili komentar uz CI job): koje pravilo, zašto, ko je odobrio, do kada.

| Mehanizam | Opseg | Kada |
|---|---|---|
| izmjena pravila | svi repoi koji koriste pravilo | pravilo je pogrešno |
| `# nosemgrep: <id>` | jedna linija | kod je provjeren i siguran |
| `.semgrepignore` | putanje | testovi, generisan i vendorovan kod |
| `--exclude-rule` | cijeli scan | pravilo ne odgovara ovom projektu |
| `--baseline-commit` | stari nalazi | uvođenje alata u postojeći repo |

> **U praksi:** Testove ne isključuj automatski. Hardkodovan token u `tests/` je i dalje stvaran token. Isključi testove za pravila o injection ranjivostima (gdje je ulaz namjerno opasan), ali ne i za pravila o tajnama.

## Semgrep u pipelineu

### Vlastiti job (GitLab)

```yaml
stages: [build, test, security]

semgrep:
  stage: security
  image: semgrep/semgrep:1.179.0
  variables:
    SEMGREP_SEND_METRICS: "off"
  script:
    - >
      semgrep scan
      --config semgrep-rules/
      --severity ERROR
      --error
      --sarif-output=semgrep.sarif
      --gitlab-sast-output=gl-sast-report.json
  artifacts:
    when: always
    paths: [semgrep.sarif]
    reports:
      sast: gl-sast-report.json
```

- `--error` + `--severity ERROR`: build pada samo na ERROR pravilima; WARNING se vidi u izvještaju, ali ne blokira.
- `artifacts:when: always`: izvještaj se čuva i kad job padne (a tada je najpotrebniji).
- `artifacts:reports:sast` očekuje **GitLab SAST JSON** format, ne SARIF; zato `--gitlab-sast-output`. SARIF čuvamo kao običan artefakt za druge alate (DefectDojo, GitHub, IDE).

U labu isti job pokrećeš sa `gitlab-ci-local semgrep`.

### Samo novi nalazi u merge requestu

Na postojećem repou sa 300 starih nalaza nijedan MR ne bi prošao. **Diff-aware** scan prijavljuje samo ono što je MR uveo:

```yaml
semgrep-mr:
  stage: security
  image: semgrep/semgrep:1.179.0
  variables:
    GIT_DEPTH: 0               # treba istorija da bi baseline commit postojao lokalno
  script:
    - semgrep scan --config semgrep-rules/ --error --baseline-commit "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

Stari nalazi idu u backlog i prate se kroz puni scan na `main` (modul 12).

### GitLab SAST šablon

```yaml
include:
  - template: Jobs/SAST.gitlab-ci.yml

variables:
  SAST_EXCLUDED_PATHS: "tests, frontend/node_modules"
```

Šablon dodaje job `semgrep-sast` (Semgrep analizator sa pravilima koje održava GitLab) i radi na svim tierovima; na Ultimate dobijaš **GitLab Advanced SAST** (`GITLAB_ADVANCED_SAST_ENABLED: "true"`) sa cross-file analizom, prikaz nalaza u MR-u i security dashboard. Vlastiti job daje kontrolu nad pravilima i verzijom; šablon daje manje održavanja. Česta kombinacija: šablon za opšte nalaze plus vlastiti job samo za organizaciona pravila.

### GitHub Actions ekvivalent

```yaml
jobs:
  semgrep:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    container: semgrep/semgrep:1.179.0
    steps:
      - uses: actions/checkout@v4
      - run: semgrep scan --config semgrep-rules/ --sarif-output=semgrep.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif
```

GitHub prikazuje SARIF u Code scanning tabu i kao anotacije u pull requestu.

> **U praksi:** Novi SAST alat uvodi u tri koraka. (1) Dvije sedmice samo izvještaj, `allow_failure: true`, i čitaš nalaze sa timom. (2) Blokiraš samo nove ERROR nalaze sa visokim `confidence` u MR-u. (3) Postepeno dodaješ pravila u blokirajući skup kad pokažu nizak procenat lažnih pozitiva. Ako ijedno blokirajuće pravilo ima više od nekoliko posto lažnih pozitiva, developeri počinju masovno pisati `nosemgrep` i gubiš povjerenje.

## SARIF

**SARIF** (Static Analysis Results Interchange Format) 2.1.0 je OASIS standard za rezultate statičke analize. Gotovo svi skeneri ga izvoze (Semgrep, osv-scanner, Trivy, Checkov, gitleaks), a čitaju ga GitHub, GitLab (preko konvertera), DefectDojo, IDE ekstenzije.

Struktura (skraćeno):

```json
{
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "Semgrep OSS", "rules": [ { "id": "semgrep-rules.kurs.python.subprocess-shell-true" } ] } },
    "results": [{
      "ruleId": "semgrep-rules.kurs.python.subprocess-shell-true",
      "level": "error",
      "message": { "text": "subprocess sa shell=True ..." },
      "locations": [{ "physicalLocation": {
        "artifactLocation": { "uri": "app.py" },
        "region": { "startLine": 43 } } }],
      "fingerprints": { "matchBasedId/v1": "requires login" }
    }]
  }]
}
```

- `runs[]`: jedan run po alatu; jedan SARIF fajl može spojiti više alata.
- `level`: `error`, `warning`, `note`, `none`.
- **fingerprints** / `partialFingerprints`: stabilan identitet nalaza, da platforma prepozna isti nalaz nakon što se kod pomjeri par linija (deduplikacija). Semgrep CE ovdje upisuje samo placeholder `requires login` (pravi fingerprint daje platforma), pa alati za agregaciju kao DefectDojo nalaze CE-a dedupliciraju po pravilu, fajlu i liniji (modul 12).

Brzo čitanje u shellu:

```bash
jq '.runs[0].results | length' semgrep.sarif
jq -r '.runs[0].results[] | "\(.ruleId)  \(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine)"' semgrep.sarif
jq '[.runs[0].results[] | select(.level == "error")] | length' semgrep.sarif
```

## Popravka kurs-shop

| Nalaz | Popravka |
|---|---|
| `kurs.python.sqli-string-query` / `flask-request-to-sql` | `execute("... WHERE name LIKE ?", (f"%{q}%",))` |
| `kurs.python.subprocess-shell-true` | validiraj `host` (`ipaddress.ip_address`) i pozovi `subprocess.run(["ping", "-c", "1", host], timeout=5)` bez `shell=True` |
| `kurs.python.yaml-unsafe-load` | `yaml.safe_load(request.data)` |
| `kurs.python.flask-debug` | `debug=os.environ.get("FLASK_DEBUG") == "1"` ili produkcijski server (gunicorn) |
| `kurs.python.flask-hardcoded-secret-key` | `app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]`, vrijednost iz Vaulta (modul 04) |

Nakon popravke `semgrep scan --config /opt/kurs/semgrep-rules/ --error` mora vratiti 0. Napiši i `ok:` test za svaki popravljen oblik, da pravilo ne bi kasnije počelo hvatati ispravan kod.

> **U praksi:** Poruka pravila je dio popravke. „Possible SQL injection“ developer zatvori kao lažni pozitiv; „Koristi parametre: `execute(sql, (vrijednost,))`“ uz link na interni primjer dobije popravku u istom MR-u. Piši poruke kao da ih čita neko ko nikad nije čuo za CWE.

## Rezime

- SAST čita izvorni kod i nalazi ranjive obrasce; dopunjuje SCA (zavisnosti) i DAST (aplikacija koja radi), ne zamjenjuje ih.
- Semgrep pravilo: `id`, `languages`, `severity`, `message` i operatori `pattern`, `patterns`, `pattern-either`, `pattern-not`, `pattern-inside`, `metavariable-regex`, `focus-metavariable`.
- `mode: taint` sa `pattern-sources`, `pattern-sinks` i `pattern-sanitizers` prijavljuje samo stvarne tokove nepouzdanih podataka; u CE samo unutar jedne funkcije, interprocedural i interfile su u Pro verziji.
- Pravila testiraj sa `# ruleid:` / `# ok:` i `semgrep --test`.
- Lažne pozitive prvo rješavaj u pravilu, pa `# nosemgrep: <id>` sa razlogom, pa `.semgrepignore`; nikad `nosemgrep` bez ID-ja.
- U CI-ju: `--error` (bez njega exit 0), `--severity` za prag, `--baseline-commit` za samo nove nalaze u MR-u, `artifacts:when: always`.
- GitLab `artifacts:reports:sast` traži GitLab SAST JSON (`--gitlab-sast-output`); SARIF 2.1.0 je zajednički format za GitHub, DefectDojo i ostale.
