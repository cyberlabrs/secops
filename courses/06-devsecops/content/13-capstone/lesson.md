## Cilj capstonea

U planu učenja ova faza nema ispit: dokaz znanja je **pipeline** koji sam napraviš i koji možeš objasniti na intervjuu. Capstone lab spaja sve module ovog kursa u jedan `.gitlab-ci.yml` za repo `kurs-shop`:

- pipeline pada kad nađe tajnu, kritičnu ranjivost, nesigurnu Terraform konfiguraciju ili nepotpisanu sliku,
- prolazi kad je kod popravljen ili kad postoji obrazloženo izuzeće sa rokom,
- na kraju ostavlja artefakte: izvještaje (SARIF/JSON), SBOM, potpis i provenance slike.

Lab ima odbrojavanje od 150 minuta. Zadaci se provjeravaju pokretanjem tvojih jobova kroz `gitlab-ci-local`, pa job mora raditi, ne samo postojati u YAML-u.

## Arhitektura pipelinea

```text
 commit / MR
    │
    ▼
 ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
 │ secrets │  │   sast   │  │   sca    │  │   iac   │   brze provjere, paralelno
 └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬────┘   (minuti, na svakom MR-u)
      └────────────┴──── needs ───┴─────────────┘
                         │
                    ┌────▼────┐
                    │  build  │  slika + SBOM
                    └────┬────┘
              ┌──────────┼───────────┐
        ┌─────▼─────┐ ┌──▼───┐ ┌─────▼─────┐
        │image-scan │ │ dast │ │  policy   │   provjere nad artefaktom
        └─────┬─────┘ └──┬───┘ └─────┬─────┘
              └──────────┼───────────┘
                    ┌────▼────┐
                    │  sign   │  cosign potpis + atestacije (samo zaštićena grana)
                    └────┬────┘
                    ┌────▼────┐
                    │ deploy  │  provjera potpisa prije deploya
                    └─────────┘
```

Redoslijed prati cijenu greške:

1. **Jeftine i brze provjere idu prve.** Skeniranje tajni, SAST, SCA i IaC rade nad izvornim kodom za sekunde ili minute i ne zavise jedna od druge, pa idu paralelno u istoj fazi (`stage`) ili sa `needs: []`.
2. **Build tek kad kod prođe.** Nema smisla graditi i skenirati sliku ako repo sadrži procurjeli ključ.
3. **Provjere artefakta** (skeniranje slike, DAST nad pokrenutom aplikacijom, politike nad manifestima) rade nad onim što će zaista u produkciju.
4. **Potpis je zadnji korak prije deploya** i radi samo za ono što je prošlo sve provjere. Zato potpis znači „ova slika je prošla naš pipeline“, ne samo „ovo smo mi napravili“.
5. **Deploy provjerava potpis**, a ne vjeruje imenu taga.

## Kada build smije pasti

| Nalaz | Na MR-u | Na glavnoj grani |
|---|---|---|
| Tajna u kodu ili istoriji (novi nalaz) | pada | pada |
| SAST: ERROR (injection, deserializacija) | pada | pada |
| SAST: WARNING | upozorenje (`allow_failure`) | upozorenje |
| SCA: CRITICAL/HIGH sa dostupnom popravkom | pada | pada |
| SCA: bez popravke | upozorenje + izuzeće sa rokom | isto |
| IaC: nalaz bez obrazloženog izuzeća | pada | pada |
| Slika: CRITICAL sa popravkom | pada | pada |
| DAST baseline: FAIL pravila | pada | pada |
| Nepotpisana slika | ne deployuje se | ne deployuje se |

Pravilo iz prakse: **novi kod ne smije uvesti nove probleme**, a stari dug se rješava planski, uz izuzeća koja ističu. Kad uvodiš alat u postojeći repo, prvo ga pusti sa `allow_failure: true` i baseline-om, pa ga pretvori u gate kad tim očisti postojeće nalaze.

> **U praksi:** svaki izuzetak (`.gitleaksignore`, `# nosemgrep`, `osv-scanner.toml`, `#checkov:skip`, `.trivyignore.yaml`) mora imati **razlog** i, gdje alat to podržava, **rok**. Izuzetak bez roka je trajno isključena kontrola.

## Kostur `.gitlab-ci.yml`

Ovo je polazna tačka, ne rješenje: u labu dopuni komande i pragove.

```yaml
stages: [scan, build, verify, sign, deploy]

default:
  interruptible: true

secrets:
  stage: scan
  script:
    - gitleaks git --redact --report-format sarif --report-path gitleaks.sarif
  artifacts:
    when: always
    paths: [gitleaks.sarif]

sast:
  stage: scan
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --error --sarif --output semgrep.sarif .
  artifacts:
    when: always
    paths: [semgrep.sarif]

# sca, iac ...

build:
  stage: build
  script:
    - ./ci/build.sh            # slika u registriju + SBOM
  artifacts:
    paths: [image.txt, sbom.cdx.json]

image-scan:
  stage: verify
  needs: [build]
  script:
    - trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 "$(cat image.txt)"

sign:
  stage: sign
  needs: [build, image-scan]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - cosign sign --key "$COSIGN_KEY" "$(cat image.txt)"
```

> **U praksi:** `artifacts: when: always` je bitan za sigurnosne jobove. Bez njega izvještaj nestaje upravo kad je job pao, a tada ti najviše treba.

## Šta ostaje za pravi GitLab

Lab radi offline, pa neke stvari u njemu samo simuliramo. U pravom projektu:

- **Slike** se grade BuildKitom (`docker buildx`), Buildahom ili Kanikom, ne `crane append`.
- **Potpis** je obično keyless (cosign + OIDC identitet joba preko `id_tokens`, Fulcio i Rekor), bez ključa u varijabli.
- **Tajne** dolaze iz Vaulta preko `id_tokens` i `secrets:vault` ili iz cloud secret managera preko OIDC federacije, a ne kao CI/CD varijable.
- **Izvještaji** idu u `artifacts:reports` (`sast`, `secret_detection`, `dependency_scanning`, `container_scanning`, `cyclonedx`) ili u platformu kao DefectDojo, da ih developer vidi u merge requestu.
- **Zaštita pipelinea**: protected branches, obavezno odobrenje za izmjene `.gitlab-ci.yml` (CODEOWNERS), pinovane slike i `include` sa `ref`, runneri izolovani po povjerljivosti.

## Kako pokazati projekat

Za portfolio napravi javni repo sa:

1. `README.md`: dijagram pipelinea i tabela „kontrola → prijetnja koju sprječava → šta radimo sa nalazima“.
2. Primjer merge requesta koji pipeline blokira (procurjela tajna, ranjiva zavisnost) i njegov popravak.
3. Politiku izuzeća: ko odobrava, koliko traje, gdje se vodi evidencija.
4. Metrike: broj nalaza po alatu kroz vrijeme, vrijeme do popravke (MTTR), udio buildova koje gate zaustavi.

Na intervjuu će te pitati **zašto** je kontrola na tom mjestu i šta radiš kad lažni pozitivi blokiraju tim, a manje koji alat koristiš.

## Rezime

- Brze provjere izvornog koda (tajne, SAST, SCA, IaC) idu paralelno i prve; build tek kad prođu.
- Slika se skenira, testira (DAST) i provjerava politikama prije potpisa; potpis znači „prošlo je pipeline“.
- Deploy vjeruje potpisu i digestu, ne tagu.
- Gate pada na nove ozbiljne nalaze; stari dug ide u izuzeća sa razlogom i rokom.
- Sigurnosni jobovi čuvaju izvještaje i kad padnu (`artifacts: when: always`).
- U pravom okruženju: keyless potpis, tajne iz Vaulta preko OIDC-a, izvještaji u MR-u, zaštićen sam pipeline.
