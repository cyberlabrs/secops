## Šta ovaj modul pokriva

Tri cilja iz domena 3:

- **3.2** **SCA** (Software Composition Analysis): ranjive zavisnosti iz lockfajlova (osv-scanner, Trivy) i prioritizacija po **CVSS**, **EPSS** i **KEV**.
- **3.3** Higijena zavisnosti: pinovanje, automatska ažuriranja (Renovate, Dependabot), **dependency confusion**, **typosquatting** i zlonamjerni paketi.
- **3.4** Usklađenost sa licencama otvorenog koda.

| Gdje u pipelineu | Kontrola | Koju prijetnju sprječava |
|---|---|---|
| MR job | SCA scan lockfajlova, gate na novim ozbiljnim nalazima | ulazak poznato ranjive verzije u `main` |
| Zakazani (noćni) pipeline | ponovni scan bez promjene koda | novi CVE u biblioteci koja se nije mijenjala mjesecima |
| Bot za ažuriranja | Renovate / Dependabot MR-ovi | zastarjele zavisnosti, „update debt“ |
| Instalacija zavisnosti | jedan interni index, hash provjere, `npm ci` | dependency confusion, podmetnut paket |
| Release | provjera licenci | GPL/AGPL komponenta u zatvorenom proizvodu |

U tipičnoj aplikaciji 70–90% koda dolazi iz zavisnosti. `kurs-shop` ima samo 9 direktnih paketa (6 u `requirements.txt`, 3 u `frontend/package-lock.json`), a osv-scanner na njima nalazi desetine poznatih ranjivosti.

## Manifest, lockfajl i tranzitivne zavisnosti

| Pojam | Primjer | Šta sadrži |
|---|---|---|
| **manifest** | `package.json`, `pyproject.toml` | šta želiš, često raspon (`^4.17.0`, `>=2.0`) |
| **lockfajl** | `package-lock.json`, `poetry.lock`, `uv.lock` | tačno šta je instalirano, uključujući **tranzitivne** zavisnosti i hash |
| `requirements.txt` | `flask==2.2.2` | zavisi kako je napravljen: ručno pisan je manifest, `pip freeze` / `pip-compile` izlaz je lockfajl |

SCA je tačan onoliko koliko je tačan ulaz. `kurs-shop/requirements.txt` je ručno pisan: navodi `flask==2.2.2`, ali ne i `itsdangerous`, `click` ili `MarkupSafe` koje Flask povlači. Posljedice:

- **Trivy** iz `requirements.txt` čita samo direktne zavisnosti (i samo pinovane sa `==`, osim uz `--detection-priority comprehensive`).
- **osv-scanner** u online modu pokušava razriješiti tranzitivne zavisnosti preko deps.dev servisa; u offline modu (lab) vidi samo ono što piše u fajlu.

Rješenje je pravi lockfajl:

```bash
# pip-tools: iz requirements.in pravi potpun, pinovan requirements.txt sa hashovima
pip-compile --generate-hashes requirements.in -o requirements.txt
pip install --require-hashes -r requirements.txt
```

## osv-scanner

**osv-scanner** (Google) poredi pakete sa **OSV** bazom (osv.dev), koja objedinjuje GitHub Security Advisories (GHSA), PyPA (PYSEC), Go, RustSec, npm i druge izvore. Prednost OSV formata je preciznost: za svaki paket tačno opisuje pogođene raspone verzija u njegovom ekosistemu.

```bash
cd /root/kurs-shop
osv-scanner scan source --offline-vulnerabilities -r .
```

Lab nema mrežu: baze za PyPI, npm i Go su preuzete unaprijed, a varijabla `OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY=/opt/osv-db` govori gdje su. Varijante:

| Flag | Šta radi |
|---|---|
| `--offline-vulnerabilities` | ranjivosti iz lokalne baze; ostale funkcije (rješavanje tranzitivnih) i dalje mogu tražiti mrežu |
| `--offline` | potpuno bez mreže; lokalna baza mora postojati |
| `--download-offline-databases` | uz offline flag preuzme/osvježi lokalne baze (u CI-ju u posebnom jobu ili kešu) |
| `-r` | rekurzivno kroz direktorije |
| `-L <fajl>` | jedan određeni lockfajl, npr. `-L frontend/package-lock.json` |
| `--format` | `table` (default), `json`, `sarif`, `markdown`, `html`, `cyclonedx-1-5`, `spdx-2-3`... |
| `--output-file` | upiši rezultat u fajl (`--output` je zastarjelo ime) |
| `--config` | jedan konfiguracioni fajl za sve skenirane lockfajlove |

Rezultat (skraćeno; tačni brojevi zavise od datuma baze):

```
Total 9 packages affected by N known vulnerabilities (N Critical, N High, N Medium, ...) from 2 ecosystems.

| OSV URL                             | CVSS | ECOSYSTEM | PACKAGE  | VERSION | FIXED VERSION | SOURCE                     |
| https://osv.dev/PYSEC-2023-62       | 8.7  | PyPI      | flask    | 2.2.2   | 2.2.5         | requirements.txt           |
| https://osv.dev/GHSA-m2qf-hxjv-5gpq |      |           |          |         |               |                            |
| https://osv.dev/GHSA-xvch-5gv4-984h | 9.8  | npm       | minimist | 1.2.5   | 1.2.6         | frontend/package-lock.json |
```

Ista ranjivost ima više ID-jeva (**aliasi**): `PYSEC-2021-142`, `GHSA-8q59-q68h-6hv4` i `CVE-2020-14343` su ista rupa u PyYAML. osv-scanner ih grupiše u jedan red.

Exit kodovi: `0` paketi nađeni, bez ranjivosti; `1` ima ranjivosti; `127` opšta greška; `128` nije nađen nijedan paket. U pipelineu `128` znači da job ne skenira ništa (pogrešna putanja, nema lockfajla) i to treba tretirati kao grešku joba, ne kao „čisto“.

### Izuzeci: `osv-scanner.toml`

osv-scanner traži `osv-scanner.toml` u istom direktoriju kao lockfajl (ne nasljeđuje se u poddirektorije); `--config` postavlja jedan fajl za sve.

```toml
# /root/kurs-shop/osv-scanner.toml
[[IgnoredVulns]]
id = "GHSA-8q59-q68h-6hv4"          # CVE-2020-14343, PyYAML FullLoader
ignoreUntil = 2026-11-30            # bez navodnika; nakon datuma nalaz se vraća
reason = "Ne koristimo full_load; nadogradnja na 6.x u SHOP-231. Odobrio: AppSec, 2026-10-16"

[[PackageOverrides]]
name = "lodash"
ecosystem = "npm"
vulnerability.ignore = true
effectiveUntil = 2026-12-31
reason = "Frontend se gasi u Q4, zamjena u SHOP-240"
```

Ignorisanje radi i preko aliasa: `id = "GHSA-8q59-q68h-6hv4"` sakrije i `PYSEC-2021-142`. Pri skeniranju osv-scanner ispiše `... have been filtered out because: <reason>`, pa se izuzetak vidi u logu joba.

> **U praksi:** Izuzetak bez roka je trajno prihvatanje rizika koje niko nije odobrio. Pravilo tima: svaki `IgnoredVulns` ima `ignoreUntil` najviše 90 dana unaprijed, `reason` sa tiketom i imenom osobe koja je odobrila, a fajl ima CODEOWNERS zaštitu tako da izmjenu mora odobriti AppSec.

### Guided remediation

`osv-scanner fix` predlaže nadogradnje koje uklanjaju najviše ranjivosti uz najmanje promjena. Eksperimentalna je funkcija, podržava **npm** (`package-lock.json`, `package.json`) i **Maven** (`pom.xml`), i po defaultu povlači podatke o verzijama sa deps.dev (treba mrežu, pa u labu ne radi):

```bash
osv-scanner fix --strategy=in-place -L frontend/package-lock.json
osv-scanner fix --strategy=relax -M frontend/package.json -L frontend/package-lock.json --max-depth=1
```

### Call analysis

Za Go (i eksperimentalno Rust) osv-scanner radi **call analysis**: provjerava da li tvoj kod uopšte poziva ranjivu funkciju i nepozvane ranjivosti označava kao takve. To je jedan od oblika **reachability** analize; za Python i npm je osv-scanner nema.

## Trivy za zavisnosti

Trivy znaš sa CKS-a za slike; isti alat skenira i repozitorij:

```bash
trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 1 .
trivy fs --scanners vuln --include-dev-deps frontend/
trivy fs --scanners vuln --format sarif --output trivy-sca.sarif .
trivy fs --format cyclonedx --output sbom.cdx.json .
```

`trivy fs` po defaultu pokreće `vuln` i `secret` skenere. U labu wrapper `trivy` postavlja `TRIVY_SKIP_DB_UPDATE=true` i raspakuje bazu iz slike, pa radi bez mreže. npm dev zavisnosti se ne prijavljuju bez `--include-dev-deps`.

Izuzeci u `.trivyignore.yaml` (eksplicitno se navodi sa `--ignorefile`):

```yaml
vulnerabilities:
  - id: CVE-2020-14343
    paths:
      - requirements.txt
    expired_at: 2026-11-30
    statement: "Ne koristimo full_load; nadogradnja u SHOP-231"
```

```bash
trivy fs --scanners vuln --ignorefile .trivyignore.yaml --exit-code 1 .
```

### osv-scanner ili Trivy

| | osv-scanner | Trivy |
|---|---|---|
| Baza | OSV (osv.dev) | trivy-db (NVD, GHSA, distribucije...) |
| Fokus | zavisnosti aplikacija, precizni rasponi po ekosistemu | sve: OS paketi, zavisnosti, misconfig, tajne, licence |
| Tranzitivne iz manifesta | da, online (deps.dev) | ne za `requirements.txt` |
| Izuzeci sa rokom | `osv-scanner.toml` (`ignoreUntil`) | `.trivyignore.yaml` (`expired_at`), `.trivyignore` (`exp:`) |
| VEX | ne | da (`--vex`) |
| Remediation | `osv-scanner fix` (npm, Maven) | ne |
| Kad ga birati | primarni SCA za kod | jedan alat za kod, slike i IaC |

Mnogi timovi koriste oba: osv-scanner u MR-u nad lockfajlovima, Trivy nad slikom (modul 08). Razlike u broju nalaza između alata su normalne (različite baze i različito tumačenje raspona); bitno je da gate koristi jedan dogovoren izvor istine.

## SCA u pipelineu

```yaml
osv-scanner:
  stage: security
  script:
    - osv-scanner scan source --offline-vulnerabilities -r . --format sarif --output-file osv.sarif
  artifacts:
    when: always
    paths: [osv.sarif]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_PIPELINE_SOURCE == "schedule"

trivy-sca:
  stage: security
  script:
    - trivy fs --scanners vuln --format cyclonedx --output gl-sbom.cdx.json .
    - trivy fs --scanners vuln --severity CRITICAL --ignorefile .trivyignore.yaml --exit-code 1 .
  artifacts:
    when: always
    reports:
      cyclonedx: gl-sbom.cdx.json
```

- Prvi Trivy poziv samo pravi izvještaj, drugi je **gate** (pada samo na CRITICAL koji nisu izuzeti).
- `schedule` pravilo je bitno: nova ranjivost u `jinja2 3.1.2` se objavi bez ijednog commita u repou. Bez noćnog pipelinea je otkriješ tek pri sljedećoj promjeni koda.
- GitLabov dependency scanning (Ultimate) danas radi na osnovu **SBOM-a**: analizator pravi CycloneDX SBOM, a GitLab ga poredi sa svojom advisory bazom i stalno ga ponovo provjerava kad izađu novi advisoryji. Stari Gemnasium analizator je zastario (deprecated u 17.9).

U labu: `gitlab-ci-local osv-scanner`, pa `jq '.runs[0].results | length' osv.sarif`.

> **U praksi:** Ne blokiraj MR zbog ranjivosti koju taj MR nije uveo. Ako je `requests 2.25.1` ranjiv već godinu dana, developer koji mijenja CSS ne treba da padne na tome. MR gate neka gleda samo izmijenjene lockfajlove ili nove nalaze u odnosu na ciljnu granu (DefectDojo ili GitLab to rade deduplikacijom, modul 12), a postojeći nalazi idu u backlog sa SLA rokovima.

## Prioritizacija: CVSS, EPSS, KEV

`kurs-shop` ima desetine nalaza. Popraviti sve odjednom nije realno; treba znati šta je prvo.

| Signal | Šta mjeri | Šta NE mjeri |
|---|---|---|
| **CVSS** (v3.1, v4.0) | ozbiljnost: koliko je loše ako se iskoristi (base score 0–10) | vjerovatnoću napada; tvoj kontekst |
| **EPSS** (FIRST) | vjerovatnoću da će CVE biti iskorišten u narednih 30 dana (0–1) i percentil u odnosu na sve CVE-ove | štetu u tvom sistemu |
| **CISA KEV** | da je ranjivost **dokazano iskorištena** u stvarnim napadima | ranjivosti koje još niko nije iskoristio |
| **Reachability / kontekst** | da li tvoj kod koristi ranjivu funkciju, je li servis izložen | ništa od gore navedenog |

### CVSS

CVSS base score je ozbiljnost, ne rizik. **CVSS v4.0** dijeli metrike na Base, Threat, Environmental i Supplemental i ima nomenklaturu: `CVSS-B` (samo base), `CVSS-BT` (base + threat), `CVSS-BE`, `CVSS-BTE`. Većina skenera i dalje prikazuje base score (v3.1 ili v4.0, zavisno od izvora), dakle bez informacije o eksploataciji i bez tvog okruženja.

### EPSS

**EPSS** (Exploit Prediction Scoring System) računa FIRST svaki dan za svaki objavljeni CVE. Rezultat su dva broja:

- `epss`: vjerovatnoća aktivnosti eksploatacije u narednih 30 dana (npr. `0.02` = 2%);
- `percentile`: koliki dio svih CVE-ova ima manji ili jednak skor.

```bash
# javni API (u labu nema mreže; ovo radiš na radnoj stanici ili u CI-ju sa mrežom)
curl -s "https://api.first.org/data/v1/epss?cve=CVE-2021-44906" | jq '.data[] | {cve, epss, percentile, date}'
```

Model se povremeno mijenja (v4 2025, v5 2026), a tada skorovi mogu skokovito promijeniti vrijednost. Zato u izvještaju čuvaj i datum skora.

### KEV

**CISA Known Exploited Vulnerabilities** katalog sadrži ranjivosti koje ispunjavaju tri uslova: imaju CVE ID, postoji pouzdan dokaz aktivne eksploatacije i postoji jasan korak popravke. Za američke savezne agencije KEV je obavezujući: od juna 2026. to uređuje direktiva **BOD 26-04** (zamijenila je BOD 22-01) sa rokovima zavisnim od rizika, a za najkritičniju kombinaciju (javno izložen sistem, KEV, automatizovana eksploatacija, potpuna kontrola sistema) rok je 3 dana. Za sve ostale KEV je najjači pojedinačni signal za prioritet.

Katalog je dostupan kao JSON; polja po ranjivosti uključuju `cveID`, `vendorProject`, `product`, `dateAdded`, `dueDate`, `requiredAction`, `knownRansomwareCampaignUse`.

```bash
# offline kopija kataloga u CI kešu; ukrštanje sa nalazima osv-scannera
osv-scanner scan source --offline-vulnerabilities -r . --format json --output-file osv.json
jq -r '.results[].packages[].vulnerabilities[].aliases[]? | select(startswith("CVE-"))' osv.json | sort -u > cves.txt
jq -r '.vulnerabilities[].cveID' known_exploited_vulnerabilities.json | sort -u > kev.txt
comm -12 cves.txt kev.txt      # CVE-ovi koji su i u našem kodu i u KEV-u
```

Za `kurs-shop` presjek je u trenutku pisanja prazan: nijedna ranjivost u ovim bibliotekama nije u KEV-u. To ne znači „nije bitno“, nego da je prioritet određen ozbiljnošću, EPSS-om i kontekstom.

### Kontekst mijenja prioritet

Dva primjera iz `kurs-shop`:

- **Werkzeug 2.2.2, CVE-2024-34069**: ranjivost u Werkzeug debuggeru. Za većinu aplikacija je nebitna jer debugger nije uključen. `kurs-shop` ga pokreće sa `debug=True`, pa je ovdje realna (i SAST nalaz `flask-debug` je pojačava).
- **PyYAML 5.3.1, CVE-2020-14343**: ranjivost je u `full_load`/`FullLoader`. Aplikacija koristi `yaml.Loader`, koji je nesiguran po dizajnu, pa je problem ozbiljan bez obzira na CVE. Popravka je `yaml.safe_load` (SAST) **i** nadogradnja (SCA).

Primjer politike prioriteta (prilagodi svom timu):

| Uslov | Prioritet | Rok popravke |
|---|---|---|
| u KEV-u | P1 | 72 h, ili blokiraj deploy |
| CVSS ≥ 9 i EPSS percentil ≥ 0.95, ili potvrđena reachability | P1 | 7 dana |
| CVSS ≥ 7 | P2 | 30 dana |
| ostalo | P3 | sljedeći redovni update ciklus |
| nema popravke (no fix) | prati | VEX izjava ili kompenzacijska kontrola |

> **U praksi:** Prioritizacija nije posao skenera nego posao koji radiš jednom i zapišeš kao politiku. Kad je politika zapisana (KEV prvo, pa EPSS + CVSS, pa ostalo), trijaža postaje mehanička i developer ne mora odlučivati koji od 69 nalaza je bitan. Najveća dobit je obično da 5–10% nalaza dobije P1/P2, a ostalo ide kroz redovna ažuriranja.

## Higijena zavisnosti

### Pinovanje

| Šta | Kako | Zašto |
|---|---|---|
| Python | `==` + hash (`pip-compile --generate-hashes`, `pip install --require-hashes`) | ista verzija svuda; podmetnut fajl iste verzije pada na hashu |
| npm | `package-lock.json` u gitu, u CI-ju `npm ci` (ne `npm install`) | `npm ci` instalira tačno lock i pada ako se lock i `package.json` ne slažu |
| npm install skripte | `npm ci --ignore-scripts` gdje je moguće | `preinstall`/`postinstall` je najčešći put zlonamjernog paketa do CI runnera |
| Slike u CI-ju | `image: python:3.13-slim@sha256:...` | tag se može pomjeriti, digest ne |
| GitLab `include` | `ref:` na tag ili SHA | izmjena dijeljenog šablona ne ulazi tiho u tvoj pipeline |

Pinovanje bez automatskog ažuriranja je zamrzavanje ranjivosti. Zato pinovanje uvijek ide uz bota za ažuriranja.

### Renovate i Dependabot

| | **Renovate** | **Dependabot** |
|---|---|---|
| Platforme | GitLab, GitHub, Bitbucket, Azure DevOps, Gitea... | GitHub (ugrađen) |
| Pokretanje | self-hosted (CI job, npr. zakazani GitLab pipeline) ili hostovana aplikacija | GitHub servis |
| Konfiguracija | `renovate.json` | `.github/dependabot.yml` |
| Čekanje na nove verzije | `minimumReleaseAge` | `cooldown` |
| Grupisanje | `packageRules` | `groups` |
| Automerge | ugrađen (`automerge`) | preko GitHub auto-merge i branch protection |
| Sigurnosni MR-ovi | `vulnerabilityAlerts`, `osvVulnerabilityAlerts` | Dependabot security updates |

Za GitLab je Renovate prirodan izbor:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "minimumReleaseAge": "3 days",
  "osvVulnerabilityAlerts": true,
  "prConcurrentLimit": 5,
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchPackageNames": ["flask", "werkzeug", "jinja2"],
      "groupName": "flask stack"
    },
    {
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

```yaml
renovate:
  image: renovate/renovate@sha256:<digest>
  variables:
    RENOVATE_PLATFORM: gitlab
    RENOVATE_ENDPOINT: https://gitlab.kurs-shop.ba/api/v4
    RENOVATE_REPOSITORIES: shop/kurs-shop
  script:
    - renovate
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

`RENOVATE_TOKEN` je masked i protected varijabla sa project access tokenom minimalnih prava. Na GitHubu:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 5
    groups:
      python-minor:
        update-types: ["minor", "patch"]
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

`minimumReleaseAge` / `cooldown` su danas i sigurnosna kontrola: zlonamjerne verzije popularnih paketa se obično otkriju i uklone u roku od nekoliko sati do par dana. Bot koji čeka nekoliko dana prije prijedloga ih preskoči.

> **U praksi:** Automerge uključi samo za patch verzije i samo ako pipeline ima stvarne testove. Grupiši srodne pakete (Flask, Werkzeug, Jinja2) da ne dobiješ tri MR-a koji se međusobno ruše. Ako tim dobija 40 MR-ova sedmično, prestaće ih čitati; `prConcurrentLimit`, grupe i raspored su bitniji od same instalacije bota.

### Dependency confusion

2021. je istraživač Alex Birsan pokazao napad na desetine velikih firmi: interni paket `kurs-shop-utils` postoji samo na internom registriju, napadač objavi javni paket istog imena sa većom verzijom, a package manager izabere javni.

Klasičan uzrok u Pythonu:

```bash
# OPASNO: pip gleda oba indexa i bira najveću verziju, bez obzira odakle dolazi
pip install --extra-index-url https://pypi.kurs-shop.ba/simple kurs-shop-utils
```

Odbrana:

- **jedan** index: `--index-url` na interni proxy (Artifactory, Nexus, GitLab package registry) koji za interne nazive nikad ne pita javni registry;
- npm **scope** za interne pakete i `.npmrc` sa `@kurs-shop:registry=https://npm.kurs-shop.ba/`;
- rezervisanje internih imena (ili scopea) na javnom registriju;
- lockfajl sa hashovima: drugačiji fajl iste verzije pada na provjeri.

### Typosquatting i zlonamjerni paketi

**Typosquatting** je paket sa imenom sličnim popularnom (`reqeusts`, `python-dateutils`, `lodahs`) koji čeka grešku u kucanju. Ozbiljniji slučaj je kompromitovan legitimni paket: `event-stream` (2018), `ua-parser-js` (2021), a u septembru 2025. je phishingom preuzet nalog maintainera popularnih npm paketa (`chalk`, `debug` i drugi), a ubrzo zatim se pojavio samoreplicirajući crv „Shai-Hulud“ koji je krao tokene sa razvojnih mašina i CI-ja i njima objavljivao zaražene verzije drugih paketa.

Odbrana u pipelineu:

- OSV ima i zapise o zlonamjernim paketima (ID-jevi `MAL-...`, iz OpenSSF Malicious Packages); osv-scanner ih prijavljuje kao i ranjivosti. (U labu je npm baza smanjena i nema `MAL-` zapisa.)
- `minimumReleaseAge`/`cooldown` na botu, `npm ci --ignore-scripts` gdje je moguće.
- Code review MR-a koji **dodaje** novu zavisnost: ko je održava, koliko je stara, koliko preuzimanja ima.
- CI job koji instalira zavisnosti nema produkcijske tajne (modul 02 i 04).

## Licence otvorenog koda

Svaka zavisnost dolazi sa licencom, a licenca određuje obaveze pri distribuciji. Grube kategorije:

| Kategorija | Primjeri (SPDX ID) | Obaveza (pojednostavljeno) |
|---|---|---|
| Permisivne | `MIT`, `BSD-3-Clause`, `Apache-2.0`, `ISC` | zadrži copyright i tekst licence; Apache-2.0 i NOTICE fajl |
| Slabi copyleft | `LGPL-2.1`, `LGPL-3.0`, `MPL-2.0` | izmjene same biblioteke moraš objaviti; tvoj kod ne |
| Jaki copyleft | `GPL-2.0`, `GPL-3.0` | ako distribuiraš proizvod koji je izveden iz GPL koda, moraš ponuditi izvorni kod pod GPL-om |
| Mrežni copyleft | `AGPL-3.0` | i korisnici preko mreže (SaaS) imaju pravo na izvorni kod |
| Nije open source (OSI) | `SSPL-1.0`, `BUSL-1.1`, „Commons Clause“ | ograničenja komercijalne upotrebe; pravna provjera |
| Nepoznata | nema licence, nestandardan tekst | nemaš pravo korištenja dok se ne razjasni |

Licence se zapisuju kao **SPDX** identifikatori i izrazi: `MIT OR Apache-2.0` (biraš jednu), `GPL-2.0-only WITH Classpath-exception-2.0`.

### Trivy licence

Trivy svrstava licence u kategorije (Googleova klasifikacija) i dodjeljuje im ozbiljnost: **forbidden** = CRITICAL, **restricted** = HIGH, **reciprocal** = MEDIUM, notice/permissive/unencumbered = LOW, nepoznata = UNKNOWN. Zato se licence gateuju istim flagovima kao ranjivosti:

```bash
trivy image --scanners license --severity HIGH,CRITICAL --exit-code 1 127.0.0.1:5000/python:3.13-slim
trivy fs --scanners license --license-full .
```

Bitno ograničenje: Trivy licence čita iz **instaliranih** paketa (`node_modules`, `site-packages/*/METADATA`, OS paketi u slici), ne iz `requirements.txt` ili samog `package-lock.json`. Zato je najpouzdanije licence provjeravati nad gotovom slikom ili nakon `npm ci` / `pip install` u jobu. `--license-full` dodatno traži tekstove licenci u izvornim fajlovima i sporiji je.

Politika organizacije se upisuje u Trivy konfiguraciju (polazni fajl daje `trivy --generate-default-config`):

```yaml
# trivy.yaml
license:
  forbidden:
    - AGPL-3.0
    - SSPL-1.0
  restricted:
    - GPL-2.0
    - GPL-3.0
```

Odobren izuzetak ide u `.trivyignore.yaml`, opet sa rokom i obrazloženjem:

```yaml
licenses:
  - id: GPL-2.0
    paths:
      - "usr/share/doc/bash/copyright"
    statement: "OS paket u baznoj slici, ne distribuiramo izmijenjen; odobrio Legal, LEGAL-88"
```

osv-scanner ima `--licenses="MIT,Apache-2.0,BSD-3-Clause"` (allowlist), ali podatke o licencama povlači sa deps.dev, pa u labu bez mreže ne radi.

> **U praksi:** Licence nisu samo sigurnosna tema: politiku (šta je forbidden, šta restricted) piše pravna služba, a ti je pretvaraš u konfiguraciju. GPL u internom alatu koji nikad ne distribuiraš je obično u redu; isti GPL u firmware-u koji prodaješ nije. Zato licence gateuj u release pipelineu proizvoda koji se distribuira, a u MR-u samo upozoravaj. SBOM (modul 10) uz svaki release je dokaz šta je isporučeno.

## Popravka kurs-shop

1. `requirements.in` sa direktnim zavisnostima, `pip-compile --generate-hashes` za potpun lockfajl.
2. Nadogradi Python stack (Flask 3.x, Werkzeug 3.x, Jinja2, requests, PyYAML 6.x, gunicorn) i frontend (`axios`, `lodash`, `minimist` na ispravljene verzije).
3. Zamijeni `yaml.load(..., Loader=yaml.Loader)` sa `yaml.safe_load` i ugasi `debug=True` (SAST, modul 05).
4. Dodaj `osv-scanner` i `trivy-sca` jobove sa gateom i noćni zakazani pipeline.
5. Što se ne može odmah popraviti, ide u `osv-scanner.toml` sa `ignoreUntil` i tiketom.
6. Dodaj Renovate sa `minimumReleaseAge` i grupama.

## Rezime

- SCA traži poznato ranjive verzije zavisnosti; tačan je onoliko koliko je potpun lockfajl (ručni `requirements.txt` nema tranzitivnih zavisnosti).
- osv-scanner: `scan source -r .`, offline sa lokalnom bazom, izuzeci u `osv-scanner.toml` sa `ignoreUntil` i `reason`; exit `1` = ranjivosti, `128` = nema paketa.
- Trivy: `trivy fs --scanners vuln --severity ... --exit-code 1`, izuzeci u `.trivyignore.yaml` sa `expired_at` i `statement`.
- SCA pokreći i u MR-u i u zakazanom pipelineu: novi CVE ne treba novi commit.
- Prioritet: KEV (dokazana eksploatacija) > EPSS (vjerovatnoća, 30 dana) + CVSS (ozbiljnost) > kontekst i reachability; politiku zapiši jednom.
- Pinuj (hash, `npm ci`, digest slika, `include` sa `ref`) i automatski ažuriraj (Renovate, Dependabot) uz `minimumReleaseAge`/`cooldown`.
- Dependency confusion sprječava jedan interni index i scopeovi; typosquatting i kompromitovane pakete review novih zavisnosti, `MAL-` zapisi i čekanje na nove verzije.
- Licence: Trivy kategorije (forbidden = CRITICAL, restricted = HIGH) i gate nad instaliranim paketima ili slikom; politiku određuje pravna služba.
