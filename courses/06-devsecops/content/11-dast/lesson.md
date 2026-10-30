## Šta ovaj modul pokriva

Cilj **6.1**: DAST sa OWASP ZAP-om, baseline, full i API skeniranje, automation framework.

**DAST** (Dynamic Application Security Testing) testira **pokrenutu** aplikaciju spolja, preko HTTP-a, kao što bi to radio napadač: šalje zahtjeve, gleda odgovore i traži znakove ranjivosti. Ne vidi izvorni kod, pa ne zna u kojoj liniji je greška, ali vidi ono što SAST ne može:

- konfiguraciju runtimea: zaglavlja (CSP, HSTS), kolačiće bez `HttpOnly`/`SameSite`, verziju servera u `Server` zaglavlju;
- ponašanje cijelog sistema: framework, reverse proxy, WAF i aplikaciju zajedno;
- ranjivosti koje se zaista mogu iskoristiti, npr. SQL injection koji prolazi kroz sve slojeve.

Mjesto u pipelineu:

```text
build ──► image-scan ──► deploy na test okruženje ──► dast ──► sign ──► deploy prod
                         (review app / service)        │
                                           pasivno na svakom MR-u,
                                           aktivno noću ili prije releasea
```

DAST ide **poslije builda**, nad aplikacijom koja radi u test okruženju. Nikad nad produkcijom bez dogovora: aktivno skeniranje šalje stvarne napade, puni bazu smećem i može oboriti servis.

Prijetnje koje DAST hvata u `kurs-shop`:

| Endpoint | Problem u kodu | Šta DAST vidi |
|---|---|---|
| `/` | Kolačić `session_hint` bez zastavica, nema sigurnosnih zaglavlja | Pasivna pravila: kolačić, CSP, X-Content-Type-Options, anti-clickjacking |
| `/products?q=` | SQL upit iz f-stringa | Aktivno pravilo SQL Injection mijenja `q` i vidi drugačiji odgovor ili grešku baze |
| `/ping?host=` | `subprocess` sa `shell=True` | Aktivno pravilo Remote OS Command Injection (90020) |
| sve | `debug=True`, Werkzeug razvojni server | `Server: Werkzeug/...` zaglavlje, stranice sa greškom i tracebackom |

### DAST u odnosu na ostale

| | SAST (modul 05) | DAST |
|---|---|---|
| Ulaz | Izvorni kod | URL pokrenute aplikacije |
| Brzina | Sekunde do minuti | Minuti (pasivno) do sati (aktivno) |
| Lažni pozitivi | Češći (ne zna je li put dostižan) | Rjeđi za aktivne nalaze, ali ima ih (heuristike) |
| Pokrivenost | Sav kod | Samo ono što skener **pronađe** (spider, API definicija) |
| Popravka | Tačna linija | URL i parametar; developer traži kod |

## OWASP ZAP ukratko

**ZAP** (Zed Attack Proxy, verzija 2.17 u labu) je proxy koji presreće i šalje HTTP zahtjeve. U pipelineu radi bez grafičkog interfejsa. Gradivni blokovi:

- **Spider** (crawler): prati linkove i forme da otkrije URL-ove. Tradicionalni spider čita HTML; **AJAX spider** i client spider pokreću pravi browser za JavaScript aplikacije (treba Firefox/Chrome, pa ih u labu ne koristimo).
- **Pasivni skener**: samo **gleda** zahtjeve i odgovore koji su ionako prošli kroz ZAP (zaglavlja, kolačići, curenje informacija). Ne šalje ništa novo, pa je bezbjedan i brz.
- **Aktivni skener**: **napada**: mijenja parametre (SQLi, XSS, command injection, path traversal) i šalje nove zahtjeve.
- **Alert**: nalaz sa rizikom (High, Medium, Low, Informational), povjerenjem (confidence) i **ID-jem pravila**.

### Tri vrste skeniranja

ZAP-ov Docker image (`ghcr.io/zaproxy/zaproxy:stable`) ima gotove skripte:

| | **Baseline** (`zap-baseline.py`) | **Full** (`zap-full-scan.py`) | **API** (`zap-api-scan.py`) |
|---|---|---|---|
| Otkrivanje | Spider, podrazumijevano 1 minut (`-m`) | Spider bez vremenskog limita (`-m` ga ograniči), opciono AJAX (`-j`) | Uvoz definicije: `-f openapi`, `soap` ili `graphql` |
| Napad | **Ne**, samo pasivno | **Da**, aktivni sken | **Da**, aktivni sken prilagođen API-jima (`-S` = samo pasivno) |
| Trajanje | Minuti | Sati | Zavisi od broja endpointa |
| Gdje u pipelineu | Svaki MR | Noćni ili prije releasea | MR za API servise, ako je brzo; inače noćni |

Zajedničko svima:

- `-t` meta (URL; kod API skena definicija), `-r`/`-J`/`-x` izvještaj u HTML/JSON/XML,
- `-c` config fajl sa pravilima, `-g` generiše početni config,
- `-I` ne vraća grešku samo zbog upozorenja,
- izlazni kodovi: **0** sve u redu, **1** bar jedan FAIL, **2** bar jedan WARN (bez FAIL), **3** druga greška.

```bash
# primjer van labu, sa Dockerom
docker run --rm -v "$PWD:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://review-42.kurs-shop.ba -c zap-rules.tsv -J zap.json -r zap.html
```

Ove skripte danas interno pokreću **automation framework** (osim kad se zada `--autooff`). U labu nema Dockera, pa koristimo direktno automation framework: on je i fleksibilniji.

## Automation framework

**Automation framework** (AF) opisuje cijelo skeniranje u jednom YAML **planu**: okruženje (`env`) i listu poslova (`jobs`) koji se izvršavaju redom. Plan se čuva u repou pored koda i mijenja kroz MR, kao i svaka druga konfiguracija.

```bash
# početni šabloni planova
zap.sh -cmd -autogenmin /root/kurs-shop/zap/min.yaml   # ključni parametri
zap.sh -cmd -autogenmax /root/kurs-shop/zap/max.yaml   # svi parametri, sa komentarima

# pokretanje plana
zap.sh -cmd -silent -autorun /root/kurs-shop/zap/plan.yaml
```

- `-cmd` pokreće ZAP bez interfejsa i izlazi kad završi.
- `-silent` sprječava da ZAP sam išta šalje na internet (provjera ažuriranja i sl.). U pipelineu ga uvijek koristi: build ne smije zavisiti od toga je li neki vanjski servis dostupan.
- Bez `exitStatus` joba izlazni kod plana je 0 (sve u redu), 1 (greške) ili 2 (samo upozorenja).
- ZAP-ov proxy podrazumijevano sluša na portu 8080. Ako je aplikacija na istom portu, ZAP se ne pokreće („Address already in use“), pa zadaj drugi port: `-port 8090`.

> **U labu:** `zap-auto <plan.yaml>` je skraćenica za `zap.sh -cmd -port 8090 -Xmx768m … -autorun <plan.yaml>` (proxy na 8090, jer je kurs-shop na 8080, i ograničena memorija).

### Plan za kurs-shop

Aplikacija u labu radi na `http://127.0.0.1:8080`:

```bash
cd /root/kurs-shop
/opt/app-venv/bin/python app.py > /tmp/app.log 2>&1 &
curl -sf http://127.0.0.1:8080/health
```

Pasivni plan (ekvivalent baseline skeniranja):

```yaml
# zap/plan.yaml
env:
  contexts:
    - name: kurs-shop
      urls:
        - http://127.0.0.1:8080
      includePaths:
        - "http://127.0.0.1:8080.*"
      excludePaths:
        - ".*/logout.*"
  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true

jobs:
  - type: passiveScan-config
    parameters:
      maxAlertsPerRule: 10
      scanOnlyInScope: true
    rules:
      - id: 10036          # Server Leaks Version Information
        threshold: Low

  - type: spider
    parameters:
      context: kurs-shop
      maxDuration: 2       # minuta

  - type: passiveScan-wait
    parameters:
      maxDuration: 5

  - type: report
    parameters:
      template: traditional-json
      reportDir: /root/kurs-shop/reports
      reportFile: zap-report.json

  - type: report
    parameters:
      template: sarif-json
      reportDir: /root/kurs-shop/reports
      reportFile: zap.sarif

  - type: exitStatus
    parameters:
      errorLevel: High      # bilo koji High alert -> izlazni kod 1
      warnLevel: Medium     # Medium (bez High) -> izlazni kod 2
```

Šta radi svaki dio:

| Dio | Uloga |
|---|---|
| `env.contexts` | Šta je u opsegu: početni URL-ovi i regexi za uključivanje/isključivanje. ZAP ne napada ništa van konteksta |
| `env.parameters` | `failOnError`: prekini plan na grešku joba; `failOnWarning`: prekini i na upozorenje |
| `passiveScan-config` | Pragovi pasivnih pravila (`threshold`: Off, Low, Medium, High), ograničenje broja alerta po pravilu |
| `spider` | Otkriva URL-ove; `maxDuration` u minutama, `maxDepth`, `maxChildren` |
| `passiveScan-wait` | Čeka da pasivni skener obradi sve što je spider prikupio. Bez njega izvještaj može biti nepotpun |
| `report` | `template` (npr. `traditional-html`, `traditional-json`, `sarif-json`, `modern`), `reportDir`, `reportFile`, filtri `risks`/`confidences` |
| `exitStatus` | Pretvara nalaze u izlazni kod: `errorLevel`, `warnLevel` (Informational, Low, Medium, High) i vrijednosti `okExitValue`, `warnExitValue`, `errorExitValue` |

`exitStatus` je kapija. Bez njega ZAP može naći SQL injection i vratiti 0.

### Pokrivenost: skener testira samo ono što nađe

Pokreni pasivni plan nad `kurs-shop` i pogledaj koji su URL-ovi u izvještaju. Spider polazi od `/` i prati linkove; početna stranica linkuje samo `/products?q=ka`. Endpointi `/ping` i `/import` nisu linkovani nigdje, pa ih spider **nikad neće naći** i aktivni sken ih neće testirati.

Tri načina da proširiš pokrivenost:

1. **API definicija** (najbolje za API-je): job `openapi` sa `apiFile` ili `apiUrl` uvozi sve endpointe i parametre.
2. **requestor** job: eksplicitni zahtjevi koje ZAP pošalje i doda u stablo sajta.
3. Dodatni početni URL-ovi u `env.contexts[].urls`.

```yaml
  - type: requestor
    requests:
      - url: http://127.0.0.1:8080/ping?host=127.0.0.1
        method: GET
        responseCode: 200
      - url: http://127.0.0.1:8080/import
        method: POST
        data: "ime: kurs"
        headers:
          - "Content-Type: application/x-yaml"

  - type: openapi            # kad postoji definicija
    parameters:
      apiFile: /root/kurs-shop/openapi.yaml
      targetUrl: http://127.0.0.1:8080
```

> **U praksi:** „DAST nije našao ništa“ najčešće znači „DAST nije stigao nigdje“. Prije nego što povjeruješ čistom izvještaju, provjeri broj URL-ova koje je spider pronašao. Za API servise bez OpenAPI definicije DAST je skoro slijep: zahtijevaj definiciju kao dio „definition of done“.

### Aktivni plan (full skeniranje)

Aktivni dio dodaješ poslije spidera i pasivnog čekanja:

```yaml
  - type: activeScan
    parameters:
      context: kurs-shop
      maxScanDurationInMins: 20
      maxRuleDurationInMins: 5
    policyDefinition:
      defaultStrength: Medium
      defaultThreshold: Medium
      rules:
        - id: 90020          # Remote OS Command Injection
          strength: High
          threshold: Low
        - id: 40012          # Cross Site Scripting (Reflected)
          threshold: Medium
```

- `maxScanDurationInMins` i `maxRuleDurationInMins` su obavezni u pipelineu. Podrazumijevano je 0 = bez ograničenja, a aktivni sken na većoj aplikaciji zna trajati satima.
- **Strength** određuje koliko zahtjeva pravilo šalje (Low, Medium, High, Insane), **threshold** koliko je sigurno prije nego prijavi (Low = više nalaza i više lažnih pozitiva).
- Pravilo se isključuje sa `threshold: Off`.

Nad `kurs-shop` aktivni sken treba prijaviti SQL injection na `/products` (parametar `q`) i, ako je `/ping` u stablu sajta, Remote OS Command Injection na parametru `host`.

### Autentifikacija

Većina stvarnih aplikacija ima prijavu, a skener koji nije prijavljen vidi samo login stranicu. AF to opisuje u `env.contexts[]`:

- `authentication.method`: npr. `form`, `json`, `http`, `script`, `browser` ili `autodetect`;
- `verification`: kako ZAP zna da je i dalje prijavljen (`loggedInRegex`, `loggedOutRegex`, `poll`);
- `users[].credentials`: korisnik i lozinka, uz `${VARIJABLA}` iz okruženja, nikad u planu u čistom tekstu.

```yaml
env:
  contexts:
    - name: kurs-shop
      urls: [http://127.0.0.1:8080]
      users:
        - name: tester
          credentials:
            username: ${DAST_USER}
            password: ${DAST_PASSWORD}
```

Jobovi zatim imaju `user: tester`. Za DAST pravi poseban testni nalog u testnom okruženju, sa podacima koje smiješ uništiti.

> **U praksi:** kad DAST nalog ima administratorska prava, aktivni sken će „kliknuti“ i na brisanje korisnika ili resetovanje baze. Isključi takve putanje u `excludePaths` (`.*/admin/delete.*`, `.*/logout.*`) ili skeniraj kao običan korisnik, a admin dio posebno i pažljivo.

## Lažni pozitivi i izuzeci

DAST takođe griješi: pravilo za CSP prijavljuje i JSON odgovore kojima CSP ne treba, informativni alerti zatrpaju izvještaj. Postoje dva mehanizma.

### Rules fajl za pakovane skripte

`zap-baseline.py -g zap-rules.tsv` generiše fajl sa svim pravilima na `WARN`. Format je: ID pravila, tab, akcija, opciono ime u zagradi.

```text
10010	FAIL	(Cookie No HttpOnly Flag)
10021	FAIL	(X-Content-Type-Options Header Missing)
10038	WARN	(Content Security Policy (CSP) Header Not Set)
10036	IGNORE	(Server Leaks Version Information via "Server" HTTP Response Header Field)
10020	OUTOFSCOPE	http://127.0.0.1:8080/health
```

- `FAIL` daje izlazni kod 1, `WARN` 2, `IGNORE` sakriva pravilo.
- `OUTOFSCOPE` sa regexom URL-a isključuje pravilo samo za te URL-ove (`*` umjesto ID-a znači sva pravila).
- Bez config fajla svi nalazi su `WARN`, pa build sa `-I` nikad ne pada. Kapija postoji tek kad pravila koja ti znače staviš na `FAIL`.

### alertFilter job u planu

U automation frameworku isto radi `alertFilter` job, sa preciznijim uslovima:

```yaml
  - type: alertFilter
    alertFilters:
      - ruleId: 10038
        newRisk: "False Positive"
        url: "http://127.0.0.1:8080/(health|products).*"
        urlRegex: true
      - ruleId: 10036
        newRisk: Info
```

`newRisk` prima `False Positive`, `Info`, `Low`, `Medium` ili `High`. Filter se može suziti po `url`, `parameter`, `evidence` ili `methods`. Stavi `alertFilter` **prije** jobova koji generišu alerte (spider, pasivni i aktivni sken), da bi filteri već važili kad se alerti podignu.

Pravila za izuzetke su ista kao kod svih ostalih alata u kursu:

- izuzetak kroz MR, sa komentarom u planu: **zašto** (npr. „JSON API, CSP nije primjenjiv, vidi SEC-213“) i **do kada**;
- sužen na URL ili parametar, ne na cijelo pravilo;
- ZAP plan nema polje za rok, pa rok vodiš u komentaru i u platformi za nalaze (modul 12), gdje prihvatanje rizika ističe.

> **U praksi:** ne gasi pravilo zato što smeta, nego popravi uzrok kad je jeftino. Sigurnosna zaglavlja (CSP, `X-Content-Type-Options`, `X-Frame-Options`) se dodaju jednom, u reverse proxyju ili middlewareu, i nestaje pola alerta u svim servisima odjednom.

## DAST u pipelineu

### GitLab job

U labu se aplikacija pokreće u istom shellu, a ZAP skenira `127.0.0.1:8080`:

```yaml
dast-baseline:
  stage: verify
  needs: [build]
  script:
    - /opt/app-venv/bin/python app.py > app.log 2>&1 &
    - for i in $(seq 1 30); do curl -sf http://127.0.0.1:8080/health && break; sleep 1; done
    - mkdir -p reports
    - zap.sh -cmd -silent -autorun "$CI_PROJECT_DIR/zap/plan.yaml"
  artifacts:
    when: always
    paths: [reports/, app.log]
  allow_failure:
    exit_codes: [2]       # samo upozorenja (Medium): žuto, ne blokira
```

- `exitStatus` u planu daje 1 za High, 2 za Medium. Sa `allow_failure: exit_codes: [2]` Medium nalazi ne zaustavljaju pipeline, a High ga zaustavlja.
- `artifacts: when: always`: izvještaj je najpotrebniji upravo kad job padne.
- Čekanje na `/health` prije skeniranja sprječava „DAST je prošao jer aplikacija nije bila podignuta“.

U pravom GitLabu aplikacija dolazi kao **service** u jobu (slika iz builda) ili kao **review app** okruženje, a URL se prosljeđuje kroz varijablu ili `environment_url.txt`. Aktivni plan ide u poseban job:

```yaml
dast-full:
  stage: verify
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_COMMIT_TAG
  script:
    - zap.sh -cmd -silent -autorun "$CI_PROJECT_DIR/zap/plan-full.yaml"
  timeout: 1h
  artifacts:
    when: always
    paths: [reports/]
```

GitLab Ultimate ima vlastiti DAST analizator (šablon `Security/DAST.gitlab-ci.yml`, varijabla `DAST_TARGET_URL`). Stari analizator zasnovan na ZAP-u je uklonjen u GitLabu 17.0; današnji je GitLabov browser-based DAST. Na GitHubu postoje gotove akcije `zaproxy/action-baseline`, `zaproxy/action-full-scan` i `zaproxy/action-af`.

### Kada DAST smije oboriti build

| Situacija | Preporuka |
|---|---|
| Pasivni sken na MR-u, novi alat | Informativno (`allow_failure: true`) 2–3 sedmice, pa FAIL za izabrana pravila |
| Pasivni sken, zrela pravila | FAIL za kolačiće bez zastavica i nedostajuća zaglavlja koja su već popravljena svuda |
| Aktivni sken, High i povjerenje Medium ili više | Blokira release (tag pipeline), ne svaki MR |
| Aktivni sken, Low/Informational | Samo u izvještaj i platformu za nalaze |
| Aplikacija nije podignuta ili spider nije našao URL-ove | **Pada** (izlazni kod 3 ili vlastita provjera), jer „nema nalaza“ tada ne znači ništa |

> **U praksi:** pasivni sken na svakom MR-u je jeftin i brz, pa ga ne štedi. Aktivni sken pusti noću nad stabilnim test okruženjem i rezultate šalji u platformu za nalaze. Developeri ne žele čekati sat vremena na MR, a aktivni nalazi ionako traže ručnu provjeru prije nego što postanu tiket.

### Pravna i operativna pravila

- Aktivno skeniraj samo sisteme koje posjeduješ ili za koje imaš **pisano odobrenje**. Aktivni sken je, tehnički, napad.
- Najavi skeniranje timu koji vodi okruženje i WAF-u/IDS-u; inače ćeš izazvati incident ili biti blokiran.
- Testno okruženje sa testnim podacima, nikad produkcijska baza.
- Ograniči trajanje i brzinu (`maxScanDurationInMins`, `threadPerHost` u `activeScan-config`).

## Pregled ID-jeva pravila

Pravila se u planovima, rules fajlovima i izvještajima navode po ID-ju. Česta pravila (provjereno na zaproxy.org/docs/alerts):

| ID | Pravilo | Vrsta |
|---|---|---|
| 10010 | Cookie No HttpOnly Flag | Pasivno |
| 10020 | Missing Anti-clickjacking Header | Pasivno |
| 10021 | X-Content-Type-Options Header Missing | Pasivno |
| 10023 | Information Disclosure - Debug Error Messages | Pasivno |
| 10035 | Strict-Transport-Security Header Not Set | Pasivno |
| 10036 | Server Leaks Version Information via "Server" HTTP Response Header Field | Pasivno |
| 10038 | Content Security Policy (CSP) Header Not Set | Pasivno |
| 10054 | Cookie without SameSite Attribute | Pasivno |
| 90022 | Application Error Disclosure | Pasivno |
| 40012 | Cross Site Scripting (Reflected) | Aktivno |
| 40018 | SQL Injection | Aktivno |
| 90020 | Remote OS Command Injection | Aktivno |

Neki ID-jevi imaju i sufiks za varijantu (npr. `10038-1`, `10020-1`) u polju *alert reference*; pravilo se konfiguriše osnovnim ID-jem, a `alertFilter` prihvata oba.

## Rezime

- DAST testira pokrenutu aplikaciju spolja i vidi runtime konfiguraciju i stvarno iskoristive ranjivosti, ali samo na URL-ovima koje pronađe.
- Baseline = spider + pasivno (svaki MR), full = aktivni napad (noću ili prije releasea), API = uvoz OpenAPI/SOAP/GraphQL definicije + aktivni sken.
- Automation framework plan (`env` + `jobs`) se čuva u repou i pokreće sa `zap.sh -cmd -silent -autorun plan.yaml`.
- `passiveScan-wait` prije izvještaja, `exitStatus` (`errorLevel`, `warnLevel`) kao kapija; bez njega ZAP prolazi i sa High nalazom.
- Pokrivenost: endpointi bez linkova (`/ping`, `/import`) ostaju netestirani dok ih ne dodaš kroz `openapi`, `requestor` ili dodatne URL-ove.
- Lažni pozitivi: rules fajl (`IGNORE`/`WARN`/`FAIL`/`OUTOFSCOPE`) za pakovane skripte, `alertFilter` (`newRisk: False Positive`) u planu, uvijek suženo i sa razlogom.
- Aktivno skeniranje samo uz odobrenje, nad testnim okruženjem, sa vremenskim ograničenjima.
