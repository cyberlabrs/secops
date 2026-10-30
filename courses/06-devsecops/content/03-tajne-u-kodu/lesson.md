## Šta ovaj modul pokriva

Modul pokriva tri cilja iz domena 2:

- **2.1** Otkrivanje tajni u kodu i git istoriji (**gitleaks**, **TruffleHog**).
- **2.2** Sprječavanje curenja: **pre-commit** hookovi, **push protection**, **baseline** i **allowlist**.
- **2.3** Odgovor na procurjelu tajnu: opoziv, rotacija, istraga, prepisivanje istorije.

Gdje je ovo u pipelineu: na tri mjesta, slojevito. Na developerovom računaru (pre-commit hook), na serveru pri pushu (push protection) i u pipelineu (job koji skenira diff MR-a, a periodično i cijelu istoriju). Upravljanje tajnama u Vaultu (2.4) je u modulu 04.

Prijetnja: tajna (cloud ključ, token, lozinka, webhook, privatni ključ) dospije u git. Git ne zaboravlja: i kad je fajl „obrisan“ u sljedećem commitu, tajna je u istoriji, u svakom klonu, forku, kešu runnera i u MR diffu. Napadači automatski skeniraju javne repoe i iskoriste AWS ključ za nekoliko minuta od pusha.

U repou `/root/kurs-shop` imaš sve klasične slučajeve:

- AWS ključ i Slack webhook u commitu „Početna verzija API-ja“ (`config/settings.py`), „uklonjeni“ kasnijim commitom;
- hardkodovan `SECRET_KEY` u `app.py`;
- token u `ENV` u `Dockerfile`;
- lozinka baze u `infra/main.tf`.

## Kako alati nalaze tajne

Tri tehnike, obično kombinovane:

- **Regularni izrazi za poznate formate.** AWS access key ID počinje sa `AKIA` (dugotrajni) ili `ASIA` (privremeni), Slack webhook sa `https://hooks.slack.com/services/`, GitLab PAT sa `glpat-`, GitHub token sa `ghp_`. Ovo je najpouzdanije.
- **Entropija.** Nasumični stringovi imaju visoku Shannonovu entropiju. Korisno za generičke tajne, ali daje lažne pozitive (hashevi, UUID-ovi, minifikovan JS).
- **Ključne riječi u blizini.** `password=`, `secret`, `token` uz vrijednost. Generička pravila (`generic-api-key` u gitleaksu) su najveći izvor šuma.
- **Verifikacija** (TruffleHog): alat pokuša upotrijebiti nađenu tajnu protiv API-ja dobavljača i kaže da li je aktivna. Ogromna prednost za prioritizaciju, ali traži mrežu (u labu je nema, pa radimo bez nje).

## gitleaks 8.x

**gitleaks** je jedan binarni fajl, brz, sa dobrim podrazumijevanim pravilima. U verziji 8.19 komande `detect` i `protect` su zamijenjene novim podkomandama (stare i dalje rade, ali su sakrivene):

| Komanda | Šta skenira |
|---|---|
| `gitleaks git [putanja]` | Git istoriju (preko `git log -p`); opseg zadaješ sa `--log-opts` |
| `gitleaks git --pre-commit --staged` | Samo staged izmjene, za pre-commit hook |
| `gitleaks dir [putanja]` | Fajlove na disku, bez istorije (alias `files`, `directory`) |
| `gitleaks stdin` | Ulaz sa standardnog ulaza (npr. `docker history`, log) |

### Prvi sken nad kurs-shop

```bash
cd /root/kurs-shop

# trenutni fajlovi: nalazi SECRET_KEY, token u Dockerfileu, lozinku u main.tf
gitleaks dir . -v --redact

# cijela istorija: pojavljuju se i AWS ključ i Slack webhook iz starog commita
gitleaks git . -v --redact

# izvještaj za alate i za pipeline
gitleaks git . --redact --report-format json  --report-path gitleaks.json
gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif
jq -r '.[] | [.RuleID, .File, .Commit[0:8], .StartLine] | @tsv' gitleaks.json
```

Tipičan nalaz (skraćeno):

```text
Finding:     AWS_ACCESS_KEY_ID = "REDACTED"
RuleID:      aws-access-token
File:        config/settings.py
Line:        4
Commit:      3f2c9a1…
Message:     Početna verzija API-ja
Fingerprint: 3f2c9a1…:config/settings.py:aws-access-token:4
```

Bitni flagovi:

| Flag | Značenje |
|---|---|
| `--redact` (ili `--redact=50`) | Sakrij tajnu u izlazu (procenat); obavezno u CI logu |
| `-f, --report-format` | `json`, `csv`, `junit`, `sarif`, `template` |
| `-r, --report-path` | Fajl izvještaja |
| `--log-opts` | Opcije za `git log`, npr. `--log-opts="--all"` ili opseg `A..B` |
| `-c, --config` | Putanja do konfiguracije (inače `.gitleaks.toml` u meti) |
| `-b, --baseline-path` | Ignoriši nalaze koji su već u baseline izvještaju |
| `--exit-code` | Izlazni kod kad ima nalaza (podrazumijevano 1) |
| `--enable-rule` | Samo određena pravila po ID-u |
| `--max-target-megabytes` | Preskoči velike fajlove |

Izlazni kod je 0 kad nema nalaza, a 1 kad ih ima (ili kod greške). Na tome se zasniva gate.

### Konfiguracija: .gitleaks.toml

Ne piši pravila od nule. Proširi podrazumijevana i dodaj svoja:

```toml
# .gitleaks.toml u korijenu repoa
title = "kurs-shop gitleaks config"

[extend]
useDefault = true
# disabledRules = ["generic-api-key"]   # samo ako pravi previše šuma i imaš zamjenu

[[rules]]
id = "kurs-shop-internal-token"
description = "Interni API token kurs-shopa"
regex = '''kshop_[a-z0-9]{32}'''
keywords = ["kshop_"]
tags = ["internal"]

# globalni allowlist (gitleaks 8.25+): test fixture fajlovi
[[allowlists]]
description = "Lažni ključevi u testnim fixtureima"
paths = ['''tests/fixtures/.*''']

# allowlist samo za jedno pravilo: primjeri u dokumentaciji
[[allowlists]]
description = "Placeholderi u docs"
targetRules = ["generic-api-key"]
regexTarget = "line"
regexes = ['''(?i)example|changeme|<your-token>''']
```

Pravila mogu imati i svoj allowlist (`[[rules.allowlists]]`) sa poljima `paths`, `regexes`, `stopwords`, `commits` i `condition = "AND"` kada svi uslovi moraju važiti. `keywords` ubrzavaju sken: regex se provjerava samo u linijama koje sadrže ključnu riječ.

Testiraj pravilo prije nego ga pustiš u pipeline:

```bash
echo 'TOKEN = "kshop_0123456789abcdef0123456789abcdef"' | gitleaks stdin -c .gitleaks.toml -v
```

### Lažni pozitivi i izuzeci

Tri mehanizma, od najužeg do najšireg:

1. **Inline komentar** `gitleaks:allow` na liniji. Brzo, ali svako ga može dodati, pa ga prati kroz review.
```python
TEST_KEY = "AKIAIOSFODNN7EXAMPLE"  # gitleaks:allow (AWS primjer iz dokumentacije)
```
2. **`.gitleaksignore`** sa fingerprintom tačnog nalaza. Za istoriju je format `commit:fajl:pravilo:linija`, za `dir` sken `fajl:pravilo:linija`. Dodaj komentar sa razlogom i tiketom:
```text
# INC-2026-031: ključ opozvan 2026-10-02, istorija nije prepisana (javni forkovi)
3f2c9a1d5e7b9c0a1f2e3d4c5b6a79881726354a:config/settings.py:aws-access-token:4
3f2c9a1d5e7b9c0a1f2e3d4c5b6a79881726354a:config/settings.py:slack-webhook-url:5
```
3. **Allowlist u `.gitleaks.toml`** (putanje, regexi, stopwords): za cijele klase lažnih pozitiva.

> **U praksi:** fingerprint u `.gitleaksignore` dodaj tek **nakon** što je tajna opozvana. Izuzetak znači „ovo je obrađeno“, ne „ovo nas ne zanima“. Komentar u fajlu treba da kaže ko, kada, zašto i broj incidenta; izmjene `.gitleaksignore` i `.gitleaks.toml` stavi pod CODEOWNERS security tima.

### Baseline za postojeći repo

Kad prvi put uključiš gitleaks na starom repou, nađe desetine istorijskih nalaza. Ne možeš blokirati sve MR-ove dok ih ne riješiš. **Baseline** razdvaja staro od novog:

```bash
# 1. jednom: snimi postojeće stanje (redaktovano!)
gitleaks git . --redact --report-format json --report-path .gitleaks-baseline.json

# 2. u pipelineu: padaj samo na nove nalaze
gitleaks git . --redact --baseline-path .gitleaks-baseline.json \
  --report-format sarif --report-path gitleaks.sarif
```

Baseline nije oprost: svaka stavka u njemu ide u backlog (opoziv i rotacija), a baseline se smanjuje kako se rješavaju.

### gitleaks u GitLab pipelineu

Za MR je dovoljno skenirati commite koje MR donosi; cijelu istoriju skeniraj periodično (scheduled pipeline):

```yaml
secret-detection:
  stage: secrets
  needs: []
  variables:
    GIT_DEPTH: "0"                 # treba istorija da bi opseg commita radio
  script:
    - |
      if [ -n "$CI_MERGE_REQUEST_DIFF_BASE_SHA" ]; then
        OPTS="$CI_MERGE_REQUEST_DIFF_BASE_SHA..$CI_COMMIT_SHA"
      else
        OPTS="-1"                  # push na granu: samo posljednji commit
      fi
      gitleaks git . --redact --log-opts="$OPTS" \
        --report-format sarif --report-path gitleaks.sarif
  artifacts:
    when: always
    paths: [gitleaks.sarif]
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

secret-detection-full-history:
  stage: secrets
  variables:
    GIT_DEPTH: "0"
  script:
    - gitleaks git . --redact --log-opts="--all" --baseline-path .gitleaks-baseline.json
      --report-format json --report-path gitleaks-full.json
  artifacts:
    when: always
    paths: [gitleaks-full.json]
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

Napomene:

- Ovaj job **nema** `allow_failure`: nova tajna u MR-u je jedan od rijetkih nalaza koji smije blokirati od prvog dana (lažnih pozitiva je malo kad isključiš ili suziš generička pravila).
- `artifacts: when: always` čuva izvještaj i kad job padne, a baš tada ti treba.
- Ne koristi `-v` bez `--redact` u CI-ju: tajna bi završila u job logu koji čita više ljudi nego repo.
- U labu isti job pokrećeš sa `gitlab-ci-local secret-detection`.

GitLab ima i gotov šablon `Jobs/Secret-Detection.gitlab-ci.yml` (job `secret_detection`, interno zasnovan na gitleaksu) koji izvještaj daje kao `artifacts:reports:secret_detection` (`gl-secret-detection-report.json`), pa se nalazi vide u MR widgetu i security dashboardu. Jednokratno skeniranje istorije uključuješ varijablom `SECRET_DETECTION_HISTORIC_SCAN: "true"`. Napomena: `reports:secret_detection` očekuje GitLabov JSON format izvještaja, ne SARIF, pa svoj gitleaks SARIF čuvaš kao običan artefakt (ili ga uvoziš u DefectDojo, modul 12).

```yaml
include:
  - template: Jobs/Secret-Detection.gitlab-ci.yml
```

## TruffleHog 3.x

**TruffleHog** ima stotine detektora i, što je ključno, **verifikaciju**: za nađeni ključ pozove API dobavljača i kaže da li ključ radi. Rezultati imaju status:

| Status | Značenje |
|---|---|
| `verified` | Tajna je potvrđeno aktivna (hitno!) |
| `unverified` | Pronađena, ali nije potvrđena (možda neaktivna, možda nema verifikatora) |
| `unknown` | Verifikacija nije uspjela zbog greške (npr. mreža) |
| `filtered_unverified` | Neverifikovana, koja bi inače bila filtrirana |

Izbor statusa radiš flagom `--results` (podrazumijevano `verified,unverified,unknown`). Za stari `--only-verified` danas koristiš `--results=verified`.

```bash
cd /root

# git istorija (lokalni repo kao file:// URL); u labu bez mreže, bez verifikacije
trufflehog git file:///root/kurs-shop --no-verification --no-update

# samo fajlovi na disku
trufflehog filesystem /root/kurs-shop --no-verification --no-update

# JSON za dalju obradu
trufflehog git file:///root/kurs-shop --no-verification --no-update --json \
  | jq -r '[.DetectorName, .SourceMetadata.Data.Git.file, .SourceMetadata.Data.Git.commit[0:8]] | @tsv'
```

U pravom okruženju (sa mrežom) tipičan CI poziv je:

```yaml
trufflehog:
  stage: secrets
  variables:
    GIT_DEPTH: "0"
  script:
    - trufflehog git file://. --since-commit "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
      --branch HEAD --results=verified,unknown --fail --no-update --json > trufflehog.json
  artifacts:
    when: always
    paths: [trufflehog.json]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

Sa `--fail` TruffleHog vraća izlazni kod **183** kad ima rezultata (0 = nema, 1 = greška). Lažne pozitive na liniji isključuješ komentarom `trufflehog:ignore`.

### gitleaks ili TruffleHog

| | **gitleaks** | **TruffleHog** |
|---|---|---|
| Pristup | Regex + entropija + ključne riječi | Detektori po dobavljaču + verifikacija |
| Verifikacija aktivnosti | Ne | Da (traži mrežu) |
| Brzina | Vrlo brz | Brz; verifikacija dodaje vrijeme |
| Izvori | git, dir, stdin | git, filesystem, GitHub/GitLab org, S3, Docker slike i drugi |
| Konfiguracija i izuzeci | `.gitleaks.toml`, `.gitleaksignore`, baseline, `gitleaks:allow` | `--results`, `trufflehog:ignore`, isključivanje detektora |
| Izvještaj | JSON, CSV, JUnit, SARIF, template | JSON |
| Najbolje za | Gate u pre-commit i MR-u, prilagođena pravila | Istraga i prioritizacija: koje su tajne stvarno žive |

Česta kombinacija: gitleaks kao brz gate u hooku i MR-u, TruffleHog periodično nad svim repoima organizacije da nađe **verifikovane** tajne koje treba odmah opozvati.

> **U praksi:** kad prvi put pustiš skener nad svim repoima kompanije, rezultat su stotine nalaza. Počni od `verified` (TruffleHog) i od tipova sa jasnim formatom (AWS, GitLab PAT, privatni ključevi). Generičke nalaze ostavi za kasnije; inače tim potroši sedmicu na hasheve iz testova.

## Sprječavanje: pre-commit i push protection

Detekcija u pipelineu dolazi **poslije** pusha: tajna je već na serveru, u istoriji i možda u forku. Bolje je zaustaviti je ranije.

### pre-commit hook

Okvir **pre-commit** upravlja git hookovima iz fajla `.pre-commit-config.yaml` u repou. U labu nema mreže, pa koristimo lokalne hookove (`repo: local`) koji pozivaju instalirani binarni fajl:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: gitleaks
        name: gitleaks (staged izmjene)
        entry: gitleaks git --pre-commit --staged --redact --verbose
        language: system
        pass_filenames: false
        stages: [pre-commit]
```

```bash
cd /root/kurs-shop
pre-commit install                    # upiše .git/hooks/pre-commit
pre-commit run --all-files            # ručno nad svim fajlovima (dobro za prvo uvođenje)

# test: commit sa tajnom mora pasti
echo 'SLACK = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"' > leak.py
git add leak.py && git commit -m "test"     # hook blokira commit
git restore --staged leak.py && rm leak.py
```

U pravom okruženju (sa mrežom) umjesto `repo: local` koristiš zvanični hook, pinovan na verziju:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.30.0
    hooks:
      - id: gitleaks
```

Ograničenje: hook je na developerovom računaru. Može ga zaobići sa `git commit --no-verify`, ili ga nikad ne instalira. Zato hook nije kontrola na koju se oslanjaš sam; to je pogodnost koja hvata većinu grešaka prije nego postanu incident.

### Push protection na serveru

**Push protection** odbija push na serveru ako novi commiti sadrže tajnu poznatog formata:

- **GitHub**: secret scanning push protection (podrazumijevano uključen za javne repoe; za privatne kao dio GitHub Advanced Security / Secret Protection).
- **GitLab**: **secret push protection** (Ultimate). Uključuje se u Secure → Security configuration. Skenira samo izmjene u pushanim commitima, koristi samo pravila visokog povjerenja i preskače velike i binarne fajlove.

Zaobilaženje je moguće i namjerno vidljivo: u GitLabu sa `[skip secret push protection]` u poruci commita ili `git push -o secret_push_protection.skip_all`. Svako zaobilaženje se bilježi kao audit događaj, pa ga security tim može pratiti.

### Slojevi zajedno

| Sloj | Gdje radi | Može se zaobići? | Hvata |
|---|---|---|---|
| pre-commit hook | Laptop developera | Da (`--no-verify`, neinstaliran hook) | Većinu grešaka, prije nego uđu u istoriju |
| Push protection | Git server | Da, ali uz audit trag | Poznate formate prije nego uđu u repo na serveru |
| Pipeline job (MR) | Runner | Ne, ako je job obavezan | Sve što prođe gore, uključujući prilagođena pravila |
| Periodični sken istorije | Runner (schedule) | Ne | Stare tajne, nova pravila nad starom istorijom |

> **U praksi:** hook mora biti brz (sekunde) i tih. Ako generička pravila blokiraju svaki drugi commit, developeri će koristiti `--no-verify` svaki put. U hooku drži samo pravila visokog povjerenja; šira pravila neka rade u pipelineu, gdje rezultat ide u izvještaj.

## Odgovor na procurjelu tajnu

Scenario iz labova: u commitu „Početna verzija API-ja“ je AWS ključ i Slack webhook. Developer ih je „uklonio“ sljedećim commitom. Repo je na serveru, a možda je bio javan nekoliko sati.

**Prvi korak nije prepisivanje istorije, nego opoziv tajne.** Tajnu treba smatrati kompromitovanom od trenutka kad je pushana: brisanje iz koda ili istorije ne poništava kopije koje su već napravljene.

### Redoslijed

1. **Opozovi / deaktiviraj** tajnu odmah. Za AWS ključ prvo deaktiviraj (brzo i reverzibilno), da ne pokvariš produkciju dok ne nađeš ko ga koristi.
2. **Rotiraj**: izdaj novu tajnu, smjesti je u Vault ili CI varijablu (ne u kod), ažuriraj servise koji je koriste, pa trajno obriši staru.
3. **Istraži**: da li je tajna korištena od strane nekog drugog? Od kada je izložena (datum commita, vidljivost repoa, forkovi)?
4. **Očisti kod**: tajna izlazi iz koda; čita se iz okruženja ili Vaulta.
5. **Prepiši istoriju** ako ima smisla (privatan repo, malo klonova) i dodaj fingerprint u `.gitleaksignore` sa brojem incidenta.
6. **Spriječi ponavljanje**: hook, push protection, obavezan job, pravilo za interni format tajne; kratak postmortem bez traženja krivca.

### AWS ključ

```bash
KEY=AKIA................     # iz nalaza gitleaksa (bez --redact, lokalno)

# ko je vlasnik ključa i kada je zadnji put korišten
aws iam list-access-keys --user-name kurs-shop-ci
aws iam get-access-key-last-used --access-key-id "$KEY"

# 1. deaktiviraj
aws iam update-access-key --user-name kurs-shop-ci --access-key-id "$KEY" --status Inactive

# 3. istraga: šta je rađeno ovim ključem (CloudTrail, posljednjih 90 dana upravljačkih događaja)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="$KEY" \
  --max-results 50 --query 'Events[].[EventTime,EventName,Username]' --output table

# 2. nakon što su servisi prebačeni na novi ključ ili, bolje, na OIDC rolu
aws iam delete-access-key --user-name kurs-shop-ci --access-key-id "$KEY"
```

U istrazi traži pozive koje vaš CI ne radi (npr. `RunInstances` u neobičnim regijama, `CreateUser`, `CreateAccessKey`, `GetCallerIdentity` sa nepoznate IP adrese). Ako je ključ korišten, to više nije „procurjela tajna“ nego incident u AWS nalogu: provjeri nove IAM korisnike, ključeve, role i resurse koje je napadač mogao ostaviti. Najbolja dugoročna ispravka je da CI uopšte nema statički ključ (OIDC, modul 02).

### Slack webhook i ostale tajne

- Slack webhook: u postavkama Slack aplikacije obriši (revoke) taj webhook URL i napravi novi.
- GitLab/GitHub tokeni: opozovi token u postavkama korisnika ili projekta, provjeri audit log za njegovu upotrebu.
- `SECRET_KEY` Flask aplikacije: nova vrijednost poništava postojeće sesije, što je i cilj.
- Lozinka baze: promijeni lozinku, provjeri logove prijava na bazu.

### Prepisivanje istorije

Kad su tajne opozvane, možeš ih ukloniti iz istorije da ih skeneri i ljudi više ne nalaze. Preporučeni alat je **git filter-repo** (zasebno se instalira; alternativa je BFG Repo-Cleaner). `git filter-branch` je spor i git ga sam ne preporučuje.

```bash
# radi nad svježim klonom, nikad nad radnim direktorijem sa izmjenama
git clone --mirror https://gitlab.kurs-shop.ba/shop/kurs-shop.git kurs-shop-clean.git
cd kurs-shop-clean.git

# zamijeni vrijednosti u svim commitima
cat > ../replacements.txt <<'EOF'
regex:AKIA[0-9A-Z]{16}==>AKIA_REMOVED
regex:https://hooks\.slack\.com/services/[A-Za-z0-9/]+==>SLACK_WEBHOOK_REMOVED
EOF
git filter-repo --replace-text ../replacements.txt

# ili ukloni cijeli fajl iz cijele istorije
# git filter-repo --invert-paths --path config/settings.py

# provjeri
gitleaks git . --log-opts="--all" -v --redact
```

Nakon toga treba force push svih grana i tagova (privremeno dozvoli force push na protected granama), a na GitLabu i čišćenje servera: Settings → Repository → *Repository cleanup* (upload `filter-repo/commit-map`) ili *Remove blobs*, da stari objekti nestanu i iz MR referenci i keša.

Posljedice i ograničenja:

- Svi commit hashevi se mijenjaju. Svaki developer mora ponovo klonirati (ili tvrdo resetovati) repo; stari klonovi i dalje imaju tajnu.
- Forkovi, kopije na CI runnerima, artefakti, slike i mirrori nisu obuhvaćeni.
- Na javnom repou to je kozmetika: tajna je već mogla biti preuzeta. Zato je opoziv uvijek prvi.

> **U praksi:** za privatan repo sa mnogo developera često je razumnije **ne** prepisivati istoriju: tajna je opozvana i bezopasna, a prepisivanje lomi otvorene MR-ove i lokalne grane svima. Dodaj fingerprint u `.gitleaksignore` sa brojem incidenta i datumom opoziva. Prepisivanje radi kad je repo javan, kad regulativa to traži ili kad su u istoriji podaci koji se ne mogu „opozvati“ (lični podaci, privatni ključ korijenskog CA).

## Rezime

- Tajne se traže regexima za poznate formate, entropijom i ključnim riječima; TruffleHog dodaje **verifikaciju** aktivnosti.
- gitleaks 8.x: `gitleaks git` (istorija, `--log-opts`), `gitleaks dir` (fajlovi), `--redact`, `--report-format sarif`, izlazni kod 1 kod nalaza; `detect`/`protect` su zastarjeli.
- Konfiguracija: `.gitleaks.toml` sa `[extend] useDefault = true`, vlastitim `[[rules]]` i `[[allowlists]]`; pojedinačni izuzeci u `.gitleaksignore` (fingerprint + razlog); postojeći nalazi u **baseline**.
- U MR-u skeniraj samo nove commite i blokiraj od prvog dana; cijelu istoriju skeniraj periodično.
- Slojevi: pre-commit hook (zaobilaziv), push protection (zaobilaziv uz audit), obavezan pipeline job, periodični sken.
- Procurjela tajna: **prvo opoziv**, zatim rotacija, istraga (CloudTrail, audit logovi), čišćenje koda, pa po potrebi prepisivanje istorije sa `git filter-repo`.
- Brisanje tajne u sljedećem commitu ne rješava ništa: tajna je u istoriji, klonovima i forkovima.
