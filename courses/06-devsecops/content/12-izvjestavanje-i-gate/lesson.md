## Šta ovaj modul pokriva

Domen 6, upravljanje nalazima:

- **6.2** Objedinjavanje rezultata: SARIF, izvještaji u merge requestu, platforme za upravljanje ranjivostima (DefectDojo).
- **6.3** Quality gate, trijaža, prihvatanje rizika sa rokom, SLA i metrike (MTTR, escape rate).

Do sada je pipeline dobio desetak skenera: gitleaks, Semgrep, osv-scanner, Trivy, Checkov, hadolint, Conftest, ZAP. Svaki ima svoj format, svoje ozbiljnosti i svoj način izuzetaka. Bez objedinjavanja dobijaš dva problema:

- **developer ne vidi nalaze**: zakopani su u logovima deset jobova, pa ih ignoriše;
- **security tim ne vidi cjelinu**: ne zna koliko je otvorenih CRITICAL nalaza, koliko dugo stoje i da li se stanje popravlja.

Mjesto u pipelineu:

```text
 gitleaks  semgrep  osv  trivy  checkov  zap        svaki job: izvještaj (SARIF/JSON) kao artefakt
    └────────┴───────┴─────┴──────┴───────┘
                     │
            ┌────────▼────────┐
            │  security-gate  │  jedna odluka: prolazi / pada (pravila + izuzeci sa rokom)
            └────────┬────────┘
          ┌──────────┴──────────┐
   MR widget / SARIF        DefectDojo   ──►  trijaža, SLA, rizik sa rokom, metrike
   (developer, odmah)       (security tim, kroz vrijeme)
```

Prijetnja koju ovo sprječava nije tehnička nego organizaciona: **zamor od upozorenja** (alert fatigue). Kad svaki MR ima 200 nalaza, niko ne čita ni onaj jedan pravi.

## SARIF 2.1.0: zajednički jezik

**SARIF** (Static Analysis Results Interchange Format) je OASIS standard za rezultate analize, verzija **2.1.0**. Skoro svi alati iz kursa ga znaju pisati:

| Alat | Komanda |
|---|---|
| gitleaks | `gitleaks git --report-format sarif --report-path gitleaks.sarif` |
| Semgrep | `semgrep scan --config ... --sarif --output semgrep.sarif` |
| osv-scanner | `osv-scanner scan source --format sarif --output osv.sarif -r .` |
| Trivy | `trivy fs --format sarif --output trivy.sarif .` |
| Checkov | `checkov -d infra --output sarif --output-file-path reports` |
| hadolint | `hadolint -f sarif Dockerfile > hadolint.sarif` |
| ZAP | `report` job sa `template: sarif-json` |

### Struktura

```json
{
  "version": "2.1.0",
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "Semgrep",
          "rules": [
            { "id": "kurs.python.sqli-fstring",
              "shortDescription": { "text": "SQL upit iz f-stringa" },
              "properties": { "tags": ["CWE-89"] } }
          ]
        }
      },
      "results": [
        {
          "ruleId": "kurs.python.sqli-fstring",
          "level": "error",
          "message": { "text": "Korisnički unos ide direktno u SQL upit" },
          "locations": [
            { "physicalLocation": {
                "artifactLocation": { "uri": "app.py" },
                "region": { "startLine": 37 } } }
          ],
          "partialFingerprints": { "primaryLocationLineHash": "8e1c...:1" }
        }
      ]
    }
  ]
}
```

| Polje | Značenje |
|---|---|
| `runs[]` | Jedno pokretanje jednog alata; fajl može imati više runova |
| `tool.driver.rules[]` | Katalog pravila (id, opis, tagovi, CWE) |
| `results[].ruleId` | Koje pravilo je okinulo |
| `results[].level` | `error`, `warning`, `note` ili `none` |
| `locations[].physicalLocation` | Fajl (`artifactLocation.uri`) i linija (`region.startLine`) |
| `partialFingerprints` | Otisak nalaza koji preživi pomjeranje koda; služi za praćenje „isti nalaz kao juče“ |
| `suppressions[]` | Nalaz je potisnut: `kind` (`inSource` npr. `# nosemgrep`, ili `external`), `status` (`accepted`, `underReview`, `rejected`) |
| `baselineState` | U poređenju sa baselineom: `new`, `unchanged`, `updated`, `absent` |

SARIF je napravljen za **statičku analizu** (fajl i linija). Nalazi bez lokacije u kodu (ranjivost u slici, alert na URL-u) se u njega uklapaju slabije: alat izmisli lokaciju (npr. `requirements.txt` ili URL kao `uri`). Zato SCA i DAST alati često imaju bogatiji vlastiti JSON, a SARIF služi za prikaz.

`level` nije isto što i ozbiljnost ranjivosti. Trivy, na primjer, mapira CRITICAL i HIGH na `error`, MEDIUM na `warning`, LOW na `note`. Ako gate odlučuje po ozbiljnosti, čitaj izvorni JSON alata ili `properties` u SARIF-u, ne samo `level`.

### Objedinjavanje SARIF fajlova

Za jedan pregled možeš spojiti runove svih alata:

```bash
jq -s '{version: "2.1.0", runs: (map(.runs) | add)}' reports/*.sarif > reports/all.sarif

# koliko nalaza po alatu i nivou, bez potisnutih
jq -r '.runs[] | .tool.driver.name as $t
       | .results[] | select((.suppressions // []) | length == 0)
       | "\($t)\t\(.level // "warning")"' reports/all.sarif | sort | uniq -c
```

`.level // "warning"` je bitan detalj: po specifikaciji podrazumijevani nivo je `warning` ako nije naveden ni u rezultatu ni u pravilu.

> **U praksi:** ne gradi vlastiti dashboard od SARIF-a. Spajanje fajlova je korisno za gate i za brz pregled u CI-ju; za istoriju, deduplikaciju i trijažu koristi platformu (GitLab vulnerability report, GitHub code scanning, DefectDojo).

## Nalazi u merge requestu

Developer treba vidjeti **nove** nalaze **u MR-u**, ne u logu joba.

### GitLab

| Mehanizam | Format | Tier | Gdje se vidi |
|---|---|---|---|
| `artifacts:reports:sast`, `secret_detection`, `dependency_scanning`, `container_scanning`, `dast` | GitLab security report JSON (vlastita šema) | Puni prikaz u MR-u i vulnerability report: Ultimate | MR security widget, Security tab, vulnerability report |
| `artifacts:reports:sarif` | SARIF 2.1.0 | Ultimate (GA u GitLabu 19.2) | Isto kao gore, uz nalaze GitLabovih skenera |
| `artifacts:reports:codequality` | JSON niz (`description`, `check_name`, `fingerprint`, `severity`, `location`) | MR Reports: Free; tab u pipelineu: Premium; oznake na linijama: Ultimate | MR widget, razlika u odnosu na ciljnu granu |
| `artifacts:reports:junit` | JUnit XML | Free | Test summary u MR-u |
| `artifacts:reports:cyclonedx` | CycloneDX SBOM | Ultimate | Lista zavisnosti |

SARIF job za GitLab Ultimate:

```yaml
sast-semgrep:
  stage: scan
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --metrics=off --sarif --output semgrep.sarif .
  artifacts:
    when: always
    paths: [semgrep.sarif]
    reports:
      sarif: semgrep.sarif
```

Važna zamka: GitLab nalaze iz `reports:sarif` obrađuje **samo ako je job uspješan**. Job koji padne (i job sa `allow_failure: true` koji je pao) ostavi artefakt, ali nalazi ne stignu u MR. Zato skener u tom jobu ne smije rušiti job (`semgrep` bez `--error`, `trivy` sa `--exit-code 0`), a odluku o padu donosi poseban **gate job** koji čita iste izvještaje. GitLab ima i ograničenja (npr. 20 runova po fajlu, 5.000 rezultata po runu, 10 MB); veće fajlove podijeli ili filtriraj.

Na **Free** i **Premium** tieru nema security widgeta. Praktičan zaobilazni put je `codequality` izvještaj: mali `jq` konverter iz SARIF-a daje developeru nalaze u MR-u, sa razlikom „novo u ovom MR-u“.

```bash
# SARIF -> GitLab code quality (osnovno mapiranje)
jq '[.runs[] | .tool.driver.name as $t | .results[] | {
      description: "\($t): \(.message.text)",
      check_name: .ruleId,
      fingerprint: ((.partialFingerprints // {} | tostring) + .ruleId
                    + (.locations[0].physicalLocation.artifactLocation.uri // "")) | @base64,
      severity: ({"error":"critical","warning":"major","note":"minor"}[.level // "warning"] // "info"),
      location: { path: (.locations[0].physicalLocation.artifactLocation.uri // "unknown"),
                  lines: { begin: (.locations[0].physicalLocation.region.startLine // 1) } }
    }]' reports/all.sarif > gl-code-quality.json
```

`fingerprint` mora biti stabilan između pipelinea: po njemu GitLab zna da je nalaz isti, pa u MR-u prikazuje samo nove i riješene.

### GitHub

GitHub code scanning prima SARIF direktno (GitHub Advanced Security, ili besplatno za javne repoe):

```yaml
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: semgrep.sarif
    category: semgrep
```

Job treba `permissions: security-events: write`. Nalazi se pojavljuju kao anotacije u pull requestu i u Security tabu, a `category` razlikuje više uploada istog alata.

> **U praksi:** developer treba vidjeti tri broja u MR-u: koliko je **novih** nalaza uveo, koliko ih blokira merge, i link na detalje. Lista od 300 postojećih nalaza u svakom MR-u uči ljude da widget preskaču.

## DefectDojo: platforma za nalaze

**DefectDojo** (OWASP projekat, open source i komercijalna Pro verzija) prima izvještaje stotina alata, deduplicira ih, prati kroz vrijeme i vodi trijažu, SLA i prihvatanje rizika. Hijerarhija u open source verziji:

```text
Product Type  (npr. „Webshop“)
 └─ Product   (kurs-shop)
     └─ Engagement  (CI/CD: main grana, ili „Pentest 2026-Q4“)
         └─ Test    (jedan tip skena: Trivy, Semgrep, ZAP…)
             └─ Finding
```

Pro verzija iste nivoe naziva Organization i Asset.

### Import iz pipelinea

DefectDojo ima dva API endpointa:

| | `/api/v2/import-scan/` | `/api/v2/reimport-scan/` |
|---|---|---|
| Šta radi | Svaki upload pravi **novi Test** | Ažurira postojeći Test: novi nalazi se dodaju, nestali zatvaraju, isti ostaju |
| Kada | Odvojeni snimci (pentest, jednokratna revizija) | Pipeline koji se ponavlja: CI sken iste grane |
| Istorija | Mnogo Testova, deduplikacija između njih | Jedan Test po alatu, jasna slika „šta je sad otvoreno“ |

```yaml
defectdojo-upload:
  stage: report
  needs:
    - job: sast-semgrep
      artifacts: true
    - job: image-scan
      artifacts: true
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - |
      curl -sf -X POST "$DOJO_URL/api/v2/reimport-scan/" \
        -H "Authorization: Token $DOJO_API_KEY" \
        -F "scan_type=Trivy Scan" \
        -F "file=@reports/trivy.json" \
        -F "product_type_name=Webshop" \
        -F "product_name=kurs-shop" \
        -F "engagement_name=CI main" \
        -F "test_title=trivy-image" \
        -F "auto_create_context=true" \
        -F "close_old_findings=true" \
        -F "minimum_severity=Low" \
        -F "active=true" -F "verified=false"
  allow_failure: true
```

- `scan_type` mora tačno odgovarati imenu parsera (npr. `Trivy Scan`, `ZAP Scan`, `Gitleaks Scan`, `SARIF`). Vlastiti parser alata je obično bolji od generičkog SARIF-a, jer zna ozbiljnost, CVE, paket i verziju.
- `close_old_findings=true` zatvara nalaze kojih više nema u novom izvještaju: popravka se sama evidentira.
- `auto_create_context` pravi Product i Engagement ako ne postoje; korisno, ali greška u imenu napravi novi Product, pa imena drži u CI varijablama.
- `DOJO_API_KEY` je protected i masked varijabla, samo na zaštićenoj grani.
- `allow_failure: true` jer nedostupan DefectDojo ne smije zaustaviti release. Gate odlučuje u pipelineu, DefectDojo je evidencija.
- Upload samo sa glavne grane: nalazi iz MR grana koje se nikad ne spoje samo prave šum.

### Deduplikacija

Isti CVE prijavljen od Trivyja i osv-scannera, ili isti nalaz iz 30 uzastopnih pipelinea, treba biti **jedan** nalaz. DefectDojo nalaz označava kao duplikat po:

- **Unique ID From Tool**: ID koji daje alat (npr. fingerprint);
- **Hash Code**: hash izabranih polja (npr. naslov, CWE, fajl, linija), podesivo po parseru;
- **Unique ID From Tool or Hash Code**: prvo ID, pa hash;
- **Legacy** (samo open source): stariji algoritam koji uzima u obzir i endpointe.

> **U praksi:** deduplikacija je razlog zašto se DefectDojo uopšte uvodi. Prije produkcije pusti isti izvještaj dva puta i provjeri da broj otvorenih nalaza ostaje isti. Ako raste, imaš problem sa fingerprintom ili hash poljima i za mjesec dana imaćeš 10.000 duplikata.

## Quality gate

**Quality gate** (sigurnosna kapija) je mjesto gdje se svi nalazi pretvaraju u jednu odluku. Dobar gate odgovara na četiri pitanja:

1. **Koliko je ozbiljno?** Ozbiljnost (CVSS, nivo alata).
2. **Je li novo?** Nalaz uveden u ovom MR-u ili stari dug (baseline, `--baseline-commit`, `partialFingerprints`).
3. **Može li se popraviti?** Postoji li ispravljena verzija (`--ignore-unfixed`, `FixedVersion`).
4. **Iskorištava li se?** EPSS, CISA KEV.

### CVSS, EPSS i KEV

| | **CVSS v4.0** (FIRST, 2023) | **EPSS** (FIRST) | **CISA KEV** |
|---|---|---|---|
| Pitanje | Koliko je ranjivost teška ako se iskoristi? | Koliko je vjerovatno da će se iskoristiti u narednih **30 dana**? | Je li **potvrđeno** iskorištavanje u stvarnim napadima? |
| Vrijednost | 0–10 (Base, Threat, Environmental, Supplemental grupe) | Vjerovatnoća 0–1 i percentil, dnevno ažuriranje | Da/ne (katalog), uz rok za američke federalne agencije |
| Slabost | Većina CVE-ova je HIGH/CRITICAL | Model, ne činjenica | Pokriva mali dio CVE-ova |

Kombinacija daje razumnu prioritizaciju:

| Uslov | Odluka |
|---|---|
| U KEV-u | Blokira odmah, bez obzira na CVSS |
| CRITICAL/HIGH, ima popravku, EPSS visok (npr. ≥ 0,1) | Blokira |
| CRITICAL/HIGH, ima popravku, EPSS nizak | Blokira na glavnoj grani ili SLA tiket, zavisno od politike |
| Nema popravke | Ne blokira; izuzetak sa rokom i praćenje |
| MEDIUM/LOW | Izvještaj i platforma, ne blokira |

Lab je offline, pa se KEV i EPSS koriste iz lokalnih kopija (u pravom pipelineu ih noćni job preuzme sa `cisa.gov` i `api.first.org` i keširira):

```bash
# CVE-ovi iz Trivy JSON izvještaja koji su u KEV katalogu
jq -r '.vulnerabilities[].cveID' known_exploited_vulnerabilities.json | sort -u > kev.txt
jq -r '.Results[]?.Vulnerabilities[]?.VulnerabilityID' reports/trivy.json | sort -u \
  | comm -12 - kev.txt
```

### Izuzeci kao kod, sa rokom

Svaki alat ima svoj mehanizam izuzetaka (`.gitleaksignore`, `# nosemgrep`, `osv-scanner.toml` sa `ignoreUntil`, `.trivyignore.yaml` sa `expired_at`, `#checkov:skip`, ZAP `alertFilter`). Gdje alat nema rok, organizacija ga vodi centralno. Jednostavan oblik: jedan fajl u repou, mijenja se samo kroz MR sa odobrenjem security tima (CODEOWNERS).

```yaml
# security-exceptions.yaml
- id: CVE-2023-30861
  tool: trivy
  reason: "Flask session cookie; aplikacija ne koristi Flask session iza keširajućeg proxyja"
  owner: tim-shop
  approved_by: security
  expires: "2026-12-31"
- id: kurs.python.subprocess-shell
  tool: semgrep
  reason: "Zamjena ping endpointa u SHOP-412"
  owner: tim-shop
  approved_by: security
  expires: "2026-11-15"
```

Gate provjerava i da li je neki izuzetak istekao:

```bash
TODAY=$(date +%F)
EXPIRED=$(yq -r ".[] | select(.expires < \"$TODAY\") | .id" security-exceptions.yaml)
if [ -n "$EXPIRED" ]; then
  echo "Istekli izuzeci, potrebna revizija: $EXPIRED"; exit 1
fi
```

Datum je pod navodnicima i u ISO obliku (`YYYY-MM-DD`), pa ga yq poredi kao string, a takvo poređenje je ispravno i hronološki.

### Gate job

```yaml
security-gate:
  stage: gate
  needs: [secrets, sast-semgrep, sca, iac, image-scan, dast-baseline]
  script:
    - ./ci/security-gate.sh reports/ security-exceptions.yaml
  artifacts:
    when: always
    paths: [reports/gate-summary.md]
```

Skener jobovi rade sa izlaznim kodom 0 i ostavljaju izvještaje (da bi ih GitLab mogao obraditi), a `security-gate` jedini odlučuje. Prednosti:

- jedna politika na jednom mjestu, ne deset pragova u deset jobova;
- isti izuzeci i rokovi za sve alate;
- `gate-summary.md` daje developeru jedan pregled: šta blokira, zašto, šta je izuzeto i do kada.

> **U praksi:** gate treba imati **izlaz za nuždu** koji ostavlja trag, npr. varijablu `SECURITY_GATE_OVERRIDE` koju može postaviti samo maintainer, uz obavezan link na tiket. Bez toga, pri prvom hitnom popravku produkcije neko će izbrisati gate iz `.gitlab-ci.yml`, i nikad ga neće vratiti.

## Trijaža

**Trijaža** je odluka šta je nalaz i šta s njim radiš. Stanja (nazivi kao u DefectDojo):

| Stanje | Značenje | Ko odlučuje |
|---|---|---|
| Active, nije Verified | Novi nalaz alata, niko ga još nije pogledao | — |
| Verified | Potvrđeno da je stvaran | Security ili tim |
| False Positive | Alat je pogriješio; dokumentuj zašto i podesi pravilo da se ne ponovi | Security |
| Out of Scope | Nije naš kod/sistem (npr. test fixture) | Tim uz security |
| Risk Accepted | Stvaran, ali svjesno ga ne popravljamo **do datuma** | Vlasnik rizika (ne developer sam) |
| Mitigated | Popravljeno (ili zatvoreno kad nalaz nestane iz reimporta) | Automatski ili tim |
| Duplicate | Isti kao drugi nalaz | Automatski (deduplikacija) |

Lažni pozitiv i prihvaćen rizik nisu isto: lažni pozitiv znači „problema nema“, prihvaćen rizik znači „problem postoji, ali ga privremeno trpimo“. Miješanje ova dva je najčešći način da stvarne ranjivosti nestanu iz evidencije.

### Prihvatanje rizika sa rokom

U DefectDojo **Risk Acceptance** ima:

- nalaze na koje se odnosi, obrazloženje i ko je prihvatio,
- **datum isteka**; bez datuma se koristi podrazumijevani broj dana iz sistemskih podešavanja,
- opciju da se nalazi po isteku **ponovo aktiviraju** (`reactivate_expired`) i da se SLA **počne ispočetka** (`restart_sla_expired`).

Kad rok istekne, nalaz se vraća u Active i ponovo blokira gate ili pokreće SLA. To je ista ideja kao `expired_at` u `.trivyignore.yaml`: izuzetak koji ne ističe je trajno isključena kontrola.

> **U praksi:** rokovi za prihvaćen rizik neka budu kratki (30–90 dana) i vezani za ozbiljnost. Kad istekne, vlasnik mora ponovo potvrditi odluku. Ako isti rizik prihvatiš četvrti put, to više nije izuzetak, nego odluka da se ne popravlja, i treba je takvom zapisati na nivou menadžmenta.

## SLA i metrike

### SLA po ozbiljnosti

**SLA** (rok za popravku) zavisi od ozbiljnosti i računa se od trenutka otkrivanja. Primjer politike (brojevi su organizaciona odluka, ne standard):

| Ozbiljnost | Rok | Napomena |
|---|---|---|
| U CISA KEV-u | 7 dana (ili kraće) | Bez obzira na CVSS |
| Critical | 15 dana | |
| High | 30 dana | |
| Medium | 90 dana | |
| Low | 180 dana ili backlog | |

DefectDojo SLA podešava po Productu (broj dana po ozbiljnosti, uz `enforce_*` zastavice) i svakom nalazu dodjeljuje datum isteka SLA-a. Reimport ne resetuje SLA: računa se od prvog otkrivanja.

### Metrike

| Metrika | Kako se računa | Šta govori |
|---|---|---|
| **MTTR** (mean time to remediate) | Prosjek (bolje medijan) dana od otkrivanja do zatvaranja, po ozbiljnosti | Koliko brzo tim popravlja |
| **SLA usklađenost** | % nalaza zatvorenih u roku | Da li je politika realna |
| **Escape rate** | Nalazi otkriveni **poslije** releasea (produkcija, pentest, bug bounty) / svi nalazi u periodu | Koliko propušta pipeline |
| Starost backloga | Broj otvorenih nalaza po ozbiljnosti i starosti (0–30, 30–90, 90+ dana) | Raste li dug |
| Stopa lažnih pozitiva | False Positive / svi trijažirani, po alatu i pravilu | Koje pravilo kvari povjerenje |
| Stopa blokiranja | % pipelinea koje gate zaustavi | Previsoka = frustracija; nula = gate možda ništa ne radi |
| Izuzeci | Broj aktivnih, istekli bez revizije, prosječno trajanje | Da li izuzeci postaju trajni |

Primjer escape ratea: u kvartalu je otkriveno 120 nalaza; 108 u pipelineu (SAST, SCA, DAST), 12 kasnije (pentest i produkcijski monitoring). Escape rate = 12 / 120 = 10%. Analiza tih 12 kaže koja kontrola nedostaje: ako su svi IDOR, ni SAST ni ZAP ih ne vide i treba ti autorizacioni test.

MTTR računaj po ozbiljnosti i sa medijanom: jedan nalaz star 400 dana pokvari prosjek, a medijan pokazuje tipično iskustvo.

> **U praksi:** ne mjeri broj nalaza kao uspjeh. Tim koji uvede novi skener „pogorša“ metriku, a tim koji ugasi pravila je „poboljša“. Prati MTTR, SLA usklađenost i escape rate; oni nagrađuju popravke, a ne skrivanje.

## Rezime

- SARIF 2.1.0 je zajednički format: `runs[].tool.driver`, `results[]` sa `ruleId`, `level` (`error`/`warning`/`note`/`none`), lokacijom i `partialFingerprints`; `suppressions` i `baselineState` nose izuzetke i „novo/staro“.
- GitLab: `artifacts:reports` (security izvještaji i `sarif` na Ultimate, `codequality` i `junit` i na Free); `reports:sarif` se obrađuje samo kad je job uspješan, pa skeneri ne ruše job, a odlučuje poseban gate job.
- DefectDojo: `reimport-scan` za ponavljane CI skenove (`close_old_findings` zatvara popravljeno), `import-scan` za odvojene snimke; deduplikacija po ID-u alata ili hash kodu.
- Gate odlučuje po ozbiljnosti, novosti, dostupnosti popravke i iskorištavanju (CISA KEV, EPSS), ne samo po CVSS-u.
- Svaki izuzetak ima razlog, vlasnika, odobrenje i rok; istekli izuzetak ponovo blokira (DefectDojo `reactivate_expired`, `expired_at`, `ignoreUntil`).
- Lažni pozitiv ≠ prihvaćen rizik; prihvaćen rizik odobrava vlasnik rizika, sa datumom isteka.
- SLA po ozbiljnosti od prvog otkrivanja; metrike koje vrijede: MTTR (medijan, po ozbiljnosti), SLA usklađenost, escape rate, starost backloga, stopa lažnih pozitiva.
