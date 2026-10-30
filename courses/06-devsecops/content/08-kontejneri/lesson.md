## Šta ovaj modul pokriva

Dva cilja iz domena 4:

- **4.2** Siguran build kontejnera: lint Dockerfilea (**hadolint**), minimalne i **distroless** slike, non-root, **multi-stage** build.
- **4.3** Skeniranje slika i **gate**: pragovi ozbiljnosti, ranjivosti bez popravke, `.trivyignore` i **VEX**.

Gdje su kontrole u pipelineu: lint Dockerfilea ide u ranu fazu (radi nad izvornim kodom, sekunde). Skeniranje slike ide **poslije builda, a prije potpisa i deploya**: skeniraš tačno onu sliku (po digestu) koja će otići u produkciju.

Koje prijetnje sprječavaju: poznate ranjivosti u OS paketima i bibliotekama slike, tajne zapečene u slojeve, kontejner koji radi kao root i alati (shell, `curl`, `apt`) koje napadač koristi nakon proboja.

U CKS kursu si skenirao slike u klasteru. Ovdje je pitanje drugačije: **kada build smije pasti**, kako se nositi sa stotinama CVE-ova u baznoj slici i kako zapisati odluku „ovo nas ne pogađa“ tako da je pipeline poštuje.

## Šta nije u redu sa Dockerfileom

```dockerfile
FROM python:latest
ADD . /app
WORKDIR /app
RUN apt-get update && apt-get install -y curl iputils-ping
RUN pip install -r requirements.txt
ENV API_TOKEN=glpat-Xk9vQ2mR7tLw4ZpN8sYc
EXPOSE 8080
CMD python app.py
```

| Linija | Problem | hadolint | Trivy | Checkov |
|---|---|---|---|---|
| `FROM python:latest` | build nije ponovljiv, puna slika (~1 GB) | DL3007 | DS-0001 | CKV_DOCKER_7 |
| `ADD . /app` | `ADD` raspakuje arhive i preuzima URL-ove; kopira i `.git`, `.env` | DL3020 | DS-0005 | CKV_DOCKER_4 |
| `apt-get install -y curl ...` | bez verzija, bez `--no-install-recommends`, liste ostaju u sloju | DL3008, DL3015, DL3009 | | |
| `pip install -r ...` | pip keš ostaje u slici | DL3042 | | |
| `ENV API_TOKEN=...` | tajna je u konfiguraciji slike, vidi je svako ko povuče sliku | (nema pravila) | skener tajni | |
| nema `USER` | proces radi kao root | (nema pravila) | DS-0002 | CKV_DOCKER_3 |
| `CMD python app.py` | shell forma: proces ne dobija SIGTERM | DL3025 | | |

Dvije stvari koje iznenade:

- hadolint pravilo **DL3002** („Last user should not be root“) pali samo kad eksplicitno napišeš `USER root` kao zadnji `USER`. Dockerfile **bez** `USER` instrukcije hadolint ne prijavljuje. Za to trebaju Trivy (DS-0002) ili Checkov (CKV_DOCKER_3).
- Nijedan linter ne razumije da je `glpat-...` GitLab token. Tajne hvataju skeneri tajni (gitleaks u repou, `trivy image --scanners secret` u slici). A kad je tajna jednom u slici koja je bila u registriju, **rotacija tokena** je obavezna; brisanje linije iz Dockerfilea ne briše stari sloj.

## hadolint

**hadolint** parsira Dockerfile i provjerava pravila DL (Dockerfile) i SC (ShellCheck nad `RUN` komandama).

```bash
cd /root/kurs-shop
hadolint Dockerfile
hadolint --failure-threshold error Dockerfile      # pada samo na error
hadolint -t warning --ignore DL3008 Dockerfile
hadolint -f sarif Dockerfile > hadolint.sarif
hadolint -f gitlab_codeclimate Dockerfile > hadolint-cq.json
```

Ozbiljnosti su `error`, `warning`, `info`, `style`. Podrazumijevano svaki nalaz daje exit 1; `--failure-threshold` (`-t`) kaže od koje ozbiljnosti naviše build pada, ali **svi** nalazi se i dalje ispisuju. `--no-fail` uvijek vraća 0.

### `.hadolint.yaml`

```yaml
# /root/kurs-shop/.hadolint.yaml
failure-threshold: warning
ignored:
  - DL3059          # više uzastopnih RUN: čitljivost nam je bitnija
trustedRegistries:
  - 127.0.0.1:5000
  - registry.kurs-shop.ba
override:
  error:
    - DL3007        # latest tag kod nas ruši build
    - DL3020
```

- `trustedRegistries` uključuje pravilo **DL3026**: `FROM` sa registrija van liste je greška. Ovo je jeftin način da spriječiš `FROM nekiuser/python-sa-dodacima`.
- `override` mijenja ozbiljnost pojedinih pravila. Tako pravilo koje je po defaultu `warning` postaje dio gatea čak i kad je prag `error`.
- Ako na komandnoj liniji koristiš `--ignore`, lista `ignored` iz fajla se zanemaruje. Drži konfiguraciju na jednom mjestu.

### Inline izuzeće

```dockerfile
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

Komentar važi samo za **sljedeću** instrukciju. hadolint nema polje za razlog ni rok, pa razlog piši u liniju iznad (`# Debian stable: pinovanje apt verzija lomi build pri svakom security updateu; slika se svakodnevno rebuilda. SEC-131`).

> **U praksi:** DL3008 (pin apt verzija) je najčešće ignorisano pravilo, i to sa razlogom: Debian iz arhive uklanja stare verzije paketa, pa pinovan build pada čim izađe sigurnosna zakrpa. Zrelija alternativa je pinovati **baznu sliku digestom** i redovno (automatski, npr. Renovate) rebuildati, umjesto pinovanja svakog paketa.

### Job

```yaml
lint-dockerfile:
  stage: sast
  needs: []
  script:
    - hadolint --no-fail -f gitlab_codeclimate Dockerfile > hadolint-cq.json
    - hadolint Dockerfile      # čitljiv izlaz u logu i exit kod za gate
  artifacts:
    when: always
    reports:
      codequality: hadolint-cq.json
  rules:
    - changes: [Dockerfile, .hadolint.yaml]
```

`gitlab_codeclimate` format GitLab prikazuje kao Code Quality nalaze u MR-u, direktno na izmijenjenim linijama.

## Siguran Dockerfile

### Multi-stage i distroless

**Multi-stage build** razdvaja okruženje za build (kompajleri, pip, header fajlovi) od okruženja za izvršavanje. U finalnu sliku kopiraš samo rezultat.

**Distroless** slike (projekt `GoogleContainerTools/distroless`, `gcr.io/distroless/...`) sadrže samo runtime jezika i njegove zavisnosti: **nema shella, nema package managera**, nema `curl`-a. Tag `:nonroot` postavlja korisnika `nonroot` (UID 65532); `:debug` dodaje busybox shell za otklanjanje grešaka i ne ide u produkciju.

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim@sha256:<digest> AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --target /install -r requirements.txt
COPY app.py .

FROM gcr.io/distroless/python3-debian13:nonroot@sha256:<digest>
WORKDIR /app
COPY --from=build /install /app/site-packages
COPY --from=build /src/app.py /app/
ENV PYTHONPATH=/app/site-packages
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/bin/python3", "/app/app.py"]
```

Šta je ovdje bitno:

- **Verzija Pythona u build fazi mora odgovarati runtimeu.** `python3-debian13` ima Python 3.13, `python3-debian12` (koji je u lokalnom registriju laba) ima Python 3.11. Paketi sa C ekstenzijama (PyYAML) instalirani za drugu verziju neće se učitati.
- **`COPY` umjesto `ADD`**, i to samo potrebnih fajlova. Uz to `.dockerignore` sa `.git`, `.env`, `tests/`, `infra/`.
- **Digest umjesto taga.** Tag `3.13-slim` se pomjera; digest `sha256:...` je nepromjenljiv. Digest dobiješ sa `crane digest 127.0.0.1:5000/python:3.13-slim`, a ažuriranje automatizuješ (Renovate/Dependabot otvaraju MR kad se digest promijeni).
- **Numerički `USER`.** Kubernetes `runAsNonRoot: true` ne može provjeriti ime korisnika (`nonroot`), samo UID. Sa `USER 65532:65532` kubelet zna da nije root.
- **Exec forma `ENTRYPOINT`** (JSON niz): nema shella koji bi primio signal umjesto aplikacije, a u distroless slici shella ionako nema.
- **Nema tajni.** Ako build treba token (privatni PyPI), koristi BuildKit secret mount: `RUN --mount=type=secret,id=pip_token ...`, tajna ne ulazi u sloj ni u historiju.

### Poređenje baznih slika

| Bazna slika | Shell / package manager | Tipičan broj OS paketa | Kada |
|---|---|---|---|
| `python:3.13` (puna) | da / apt | stotine | samo kao build faza |
| `python:3.13-slim` | da / apt | ~100 | kad aplikacija treba OS alate |
| `alpine:3.x` + Python | da / apk | malo | musl umjesto glibc: problemi sa wheelovima |
| `distroless/python3-*:nonroot` | ne / ne | vrlo malo | produkcija, kad aplikacija nema OS zavisnosti |
| `scratch` | ne / ne | nula | statički Go/Rust binarni fajlovi |

Manje paketa znači manje CVE-ova, manje lažnih pozitiva u skeneru i manje alata za napadača. Ali distroless ima cijenu: nema `kubectl exec ... sh` za debug (koristi ephemeral containers, `kubectl debug`), i ne možeš dodati paket kroz `apt`.

> **U praksi:** Prelazak na distroless najčešće prepolovi vrijeme koje tim troši na triažu nalaza slike, jer nestaju CVE-ovi u `perl`, `bash`, `ncurses` i sličnim paketima koje aplikacija nikad ne poziva. To je argument koji developeri prihvataju lakše od „sigurnije je“.

### Build u pipelineu

U pravom pipelineu sliku gradi **BuildKit** (`docker buildx build`), **Buildah** (bez daemona, rootless) ili **Kaniko**-kompatibilni builder (originalni Google repo je arhiviran 2025, održava se fork). Izbjegavaj Docker-in-Docker sa `privileged: true` runnerom ako možeš: privilegovan runner je kompromitovan host čim neko ubaci zlonamjeran job.

U labu nema Docker daemona, pa sliku slažemo direktno u registriju alatom **crane** (`127.0.0.1:5000`, pokreni ga sa `registry-up`):

```bash
registry-up
mkdir -p build/app && cp app.py build/app/
tar -C build -cf app.tar app
crane append -b 127.0.0.1:5000/distroless/python3-debian12:nonroot \
  -f app.tar -t 127.0.0.1:5000/kurs-shop:dev
crane mutate 127.0.0.1:5000/kurs-shop:dev \
  --entrypoint /usr/bin/python3,/app/app.py --workdir /app --user 65532 \
  -t 127.0.0.1:5000/kurs-shop:1.0
crane config 127.0.0.1:5000/kurs-shop:1.0 | jq '.config | {User, Entrypoint, Env}'
crane digest 127.0.0.1:5000/kurs-shop:1.0
```

Primjer pakuje samo `app.py`; u pravom buildu u isti sloj idu i zavisnosti (`site-packages` iz build faze, instalirane za istu verziju Pythona). `crane append` dodaje sloj (tar arhivu) na baznu sliku, a `crane mutate` mijenja konfiguraciju (entrypoint, korisnik, radni direktorij). Rezultat je ista vrsta OCI slike koju bi napravio BuildKit; skener i cosign ne vide razliku. Isti `crane config` ti pokazuje i problem originalnog Dockerfilea: `API_TOKEN` stoji u `.config.Env` svakome ko ima pristup registriju.

## Skeniranje slike Trivyjem

```bash
IMG=127.0.0.1:5000/python:3.9-slim
trivy image $IMG                                     # sve ranjivosti
trivy image --severity HIGH,CRITICAL $IMG
trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 $IMG
trivy image --scanners vuln,secret $IMG
trivy image --pkg-types os $IMG                      # samo OS paketi
trivy image --pkg-types library $IMG                 # samo pip/npm/... u slici
trivy image --format json --output trivy-image.json $IMG
trivy image --format sarif --output trivy-image.sarif $IMG
```

U labu Trivy čita slike direktno iz registrija preko HTTP-a (konfiguracija u `/etc/trivy/trivy.yaml`), a baza ranjivosti je lokalna; ne preuzima se ništa sa mreže. U pipelineu sa mrežom keširaj bazu (`TRIVY_CACHE_DIR` + GitLab `cache:`) da svaki job ne preuzima stotine megabajta.

Probaj iste komande na `python:3.9-slim`, `python:3.13-slim` i `distroless/python3-debian12:nonroot`. Razlika u broju nalaza je najbolji argument za izbor bazne slike.

### Pragovi: šta ruši build

Tri prekidača određuju gate:

| Flag | Šta radi |
|---|---|
| `--severity HIGH,CRITICAL` | prikazuje (i računa za exit kod) samo te ozbiljnosti |
| `--exit-code 1` | exit 1 ako ostane ijedan nalaz; bez ovoga Trivy uvijek vraća 0 |
| `--ignore-unfixed` | izbacuje ranjivosti za koje ne postoji popravljena verzija |

**Ranjivosti bez popravke** su ključna odluka. `--ignore-unfixed` je skraćenica za `--ignore-status affected,will_not_fix,fix_deferred,end_of_life`: ostaju samo nalazi sa statusom `fixed`, tj. oni koje developer **može** riješiti ažuriranjem. Gate koji pada na nešto što niko ne može popraviti samo uči tim da ignoriše pipeline. Ali „bez popravke“ ne znači „bez rizika“: takve nalaze i dalje želiš u izvještaju i u triaži.

Zato se skeniranje slike obično dijeli na dva joba:

```yaml
image-scan-report:
  stage: test
  needs: [build-image]
  script:
    - trivy image --format json --output trivy-image.json "$IMAGE"
    - trivy image --format sarif --output trivy-image.sarif "$IMAGE"
  artifacts:
    when: always
    paths: [trivy-image.json, trivy-image.sarif]

image-scan-gate:
  stage: test
  needs: [build-image]
  script:
    - trivy image --severity CRITICAL,HIGH --ignore-unfixed
        --ignorefile .trivyignore.yaml --vex kurs-shop.openvex.json
        --exit-code 1 "$IMAGE"
```

Prvi job bilježi **sve** (za DefectDojo i trend), drugi ruši build samo na ono što je hitno i popravljivo. Varijablu `$IMAGE` postavi na digest koji je build job napravio (npr. kroz `artifacts:reports:dotenv`), ne na pomični tag; tako skeniraš baš onu sliku koju ćeš potpisati.

GitLab ima i vlastiti šablon `Jobs/Container-Scanning.gitlab-ci.yml` (interno koristi Trivy) sa izvještajem `artifacts:reports:container_scanning` za MR widget i Vulnerability Report. Za GitHub je ekvivalent korak `aquasecurity/trivy-action` sa SARIF uploadom.

> **U praksi:** Prag ne mora biti isti svuda. Česta postavka: na MR-u pada samo `CRITICAL` sa popravkom, na glavnoj grani `HIGH,CRITICAL` sa popravkom, a zakazani noćni sken postojećih produkcijskih slika (bez gatea) otvara tikete. Nova ranjivost u staroj slici ne otkriva se buildom, nego ponovnim skeniranjem.

## Izuzeća: `.trivyignore` i `.trivyignore.yaml`

Obični `.trivyignore` u korijenu projekta Trivy čita automatski. Jedan ID po liniji, opcioni rok:

```text
# .trivyignore
# PyYAML 5.3.1: upgrade na 6.x je u MR !42; do tada app koristi samo yaml.safe_load. SEC-140
CVE-2020-14343 exp:2026-11-15
```

YAML varijanta je preciznija (po putanji ili PURL-u paketa) i ima polje za obrazloženje. Označena je kao eksperimentalna i učitava se samo sa `--ignorefile`:

```yaml
# .trivyignore.yaml
vulnerabilities:
  - id: CVE-2020-14343
    purls:
      - pkg:pypi/pyyaml@5.3.1
    statement: "Upgrade u MR !42; do tada samo yaml.safe_load (Semgrep pravilo kurs.yaml-load). SEC-140"
    expired_at: 2026-11-15
secrets:
  - id: generic-api-key
    paths: ["tests/fixtures/fake_keys.txt"]
    statement: "Lažni ključevi za testove"
```

Kad datum iz `exp:` ili `expired_at` prođe, izuzeće prestaje da važi i gate ponovo pada. To je željeno ponašanje: izuzeće bez roka je trajno prihvatanje rizika koje niko više ne preispituje. Sa `--show-suppressed` Trivy prikazuje i potisnute nalaze, korisno za reviziju.

## VEX: „ranjivost postoji, ali nas ne pogađa“

**VEX** (Vulnerability Exploitability eXchange) je mašinski čitljiva izjava o tome da li je proizvod pogođen određenom ranjivošću. Za razliku od `.trivyignore`, koji je interna konfiguracija jednog alata, VEX je **standardizovan dokument** koji možeš objaviti uz sliku, potpisati i dati kupcu ili drugom alatu.

Trivy čita OpenVEX, CycloneDX VEX i CSAF (podrška je označena kao eksperimentalna):

```json
{
  "@context": "https://openvex.dev/ns/v0.2.0",
  "@id": "https://kurs-shop.ba/vex/kurs-shop-2026-10",
  "author": "Kurs Shop security tim",
  "timestamp": "2026-10-16T09:00:00Z",
  "version": 1,
  "statements": [
    {
      "vulnerability": { "name": "CVE-2020-14343" },
      "products": [
        {
          "@id": "pkg:oci/kurs-shop?repository_url=127.0.0.1:5000%2Fkurs-shop",
          "subcomponents": [ { "@id": "pkg:pypi/pyyaml" } ]
        }
      ],
      "status": "not_affected",
      "justification": "vulnerable_code_not_in_execute_path",
      "impact_statement": "Aplikacija koristi samo yaml.safe_load."
    }
  ]
}
```

Ova izjava je tačna tek kad je `app.py` prebačen sa `yaml.load(..., Loader=yaml.Loader)` na `yaml.safe_load`; za repo kakav je sada bila bi laž, a VEX koji laže je gori od nikakvog. Za ranjivost koja ima popravku pravo rješenje je ionako upgrade paketa.

```bash
trivy image --vex kurs-shop.openvex.json 127.0.0.1:5000/kurs-shop:1.0
```

Statusi u OpenVEX-u su `not_affected`, `affected`, `fixed` i `under_investigation`. Za `not_affected` je obavezno opravdanje (`justification`): npr. `component_not_present`, `vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`, `vulnerable_code_cannot_be_controlled_by_adversary`, `inline_mitigations_already_exist`. Trivy iz izvještaja uklanja ranjivosti označene kao `not_affected` i to bilježi u logu.

`--vex` se može ponoviti i kombinovati: lokalni fajl, `--vex repo` (javni VEX repozitoriji) i `--vex oci` (VEX atestacija priložena uz sliku u registriju, vidi modul 10).

| | `.trivyignore` / `.yaml` | VEX |
|---|---|---|
| Format | specifičan za Trivy | standard (OpenVEX, CycloneDX, CSAF) |
| Ko ga čita | Trivy | Trivy, Grype i drugi alati, kupci |
| Opravdanje | slobodan tekst (`statement`) | propisane vrijednosti `justification` |
| Rok | `exp:` / `expired_at` | nema; nova verzija dokumenta |
| Distribucija | u repou | uz sliku, potpisano (atestacija) |
| Kada | interna odluka tima, privremeno | trajna tvrdnja o proizvodu |

> **U praksi:** Ne piši VEX „na osjećaj“. `vulnerable_code_not_in_execute_path` je tvrdnja koju neko mora moći provjeriti: link na Semgrep pravilo ili test koji dokazuje da se ranjiva funkcija ne poziva. Ako to nemaš, koristi `.trivyignore.yaml` sa rokom i vrati se na nalaz.

## Rezime

- hadolint lintuje Dockerfile: DL3007 (`latest`), DL3020 (`ADD`), DL3008 (pin apt), DL3042 (pip keš), DL3025 (JSON forma CMD), DL3026 (dozvoljeni registriji); DL3002 pali samo za eksplicitni `USER root`, nedostajući `USER` hvataju Trivy (DS-0002) i Checkov (CKV_DOCKER_3).
- `.hadolint.yaml`: `failure-threshold`, `ignored`, `trustedRegistries`, `override`; inline `# hadolint ignore=DLxxxx` važi samo za sljedeću instrukciju.
- Siguran Dockerfile: multi-stage, distroless `:nonroot`, bazna slika pinovana digestom, numerički `USER 65532`, exec forma `ENTRYPOINT`, bez tajni (BuildKit secret mount), `.dockerignore`.
- Tajna u `ENV` ostaje u konfiguraciji slike: rotiraj je, ne samo obriši liniju.
- Trivy gate: `--severity`, `--exit-code 1`, `--ignore-unfixed` (= ignoriši statuse bez popravke); odvoji izvještajni job (sve) od gate joba (hitno i popravljivo).
- Skeniraj sliku po digestu koji je napravio build job; stare slike ponovo skeniraj zakazanim pipelineom.
- Izuzeća: `.trivyignore` (`ID exp:datum`), `.trivyignore.yaml` (`statement`, `expired_at`, `purls`, `paths`, uz `--ignorefile`); VEX (`--vex`) je standardna, distribuirana tvrdnja `not_affected` sa `justification`.
