## Šta ovaj modul pokriva

Cilj **4.1**: skeniranje infrastrukture kao koda (**IaC**, Infrastructure as Code) Checkovom i Trivyjem, vlastite provjere i obrazložena izuzeća.

Gdje je kontrola u pipelineu: u ranoj fazi, paralelno sa skeniranjem tajni, SAST-om i SCA-om. Radi nad izvornim kodom (`infra/*.tf`, `k8s/*.yaml`, `Dockerfile`), traje sekunde i ne treba joj cloud nalog.

Koju prijetnju sprječava: **misconfiguration**, odnosno pogrešnu konfiguraciju koja otvara resurs svijetu. Javni S3 bucket, SSH otvoren prema internetu ili baza dostupna sa interneta nisu ranjivosti u kodu; to su odluke zapisane u Terraformu. Ako ih uhvatiš u merge requestu, ispravka košta jedan commit. Ako ih uhvati napadač, košta incident.

| Kada hvataš grešku | Ko je hvata | Cijena |
|---|---|---|
| U editoru / pre-commit | developer | sekunde |
| U MR pipelineu (ovaj modul) | IaC skener | jedan commit |
| Poslije `terraform apply` | CSPM (AWS Config, Security Hub) | resurs je već bio izložen |
| Poslije incidenta | napadač | podaci |

**CSPM** (Cloud Security Posture Management) i dalje treba, jer neko uvijek klikne nešto u konzoli. Ali IaC skeniranje je jeftinije i daje povratnu informaciju autoru promjene, ne security timu tri sedmice kasnije.

## Šta nije u redu sa `infra/main.tf`

Repo `/root/kurs-shop` ima namjerno loš Terraform. Ovo su nalazi koje oba skenera prijavljuju:

| Resurs | Problem | Checkov | Trivy |
|---|---|---|---|
| `aws_s3_bucket_public_access_block.uploads` | sve četiri zaštite su `false` | `CKV_AWS_53` i srodne | više nalaza za S3 public access |
| `aws_security_group.web` | SSH (22) sa `0.0.0.0/0` | `CKV_AWS_24` | `AWS-0107` |
| `aws_security_group.web` | HTTP (80) sa `0.0.0.0/0` | `CKV_AWS_260` | `AWS-0107` |
| `aws_db_instance.shop` | `publicly_accessible = true` | `CKV_AWS_17` | `AWS-0180` |
| `aws_db_instance.shop` | `storage_encrypted = false` | `CKV_AWS_16` | `AWS-0080` |
| `aws_db_instance.shop` | `password = "Shop12345!"` u kodu | skener tajni | skener tajni |

Primijeti zadnji red: IaC skeneri gledaju **konfiguraciju**, a lozinku u kodu primarno hvataju skeneri tajni (gitleaks iz modula 03, Checkov framework `secrets`, `trivy fs --scanners secret`). Ispravka nije „sakrij lozinku u varijablu“, nego da lozinku uopšte ne držiš u Terraformu:

```hcl
resource "aws_db_instance" "shop" {
  identifier                  = "kurs-shop-db"
  engine                      = "postgres"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  username                    = "shop"
  manage_master_user_password = true   # lozinku generiše i čuva Secrets Manager
  publicly_accessible         = false
  storage_encrypted           = true
  deletion_protection         = true
  skip_final_snapshot         = false
}
```

> **U praksi:** HTTP 80 prema `0.0.0.0/0` na web serveru često je namjeran (iza njega je load balancer ili javni sajt). Upravo za takve slučajeve postoje obrazložena izuzeća. SSH prema cijelom internetu gotovo nikad nije opravdan: zamijeni ga sa SSM Session Managerom ili VPN-om.

## Checkov

**Checkov** je open-source IaC skener (Prisma Cloud / Palo Alto). Podržava Terraform (i plan u JSON-u), CloudFormation, Kubernetes, Helm, Dockerfile, GitHub Actions i GitLab CI konfiguracije, ARM/Bicep i drugo. Provjere imaju ID-ove oblika `CKV_AWS_24`; ID-ovi sa `CKV2_` su **graph** provjere koje gledaju veze između resursa (npr. „bucket ima pridruženi public access block“).

### Lokalno pokretanje

```bash
cd /root/kurs-shop
checkov -d infra                          # cijeli direktorij
checkov -f infra/main.tf                  # jedan fajl
checkov -d . --framework terraform        # samo Terraform iz cijelog repoa
checkov -d infra --check CKV_AWS_24,CKV_AWS_17   # samo ove provjere
checkov -d infra --compact --quiet        # samo pali nalazi, bez isječaka koda
```

Izlaz za jedan nalaz izgleda ovako (skraćeno):

```text
Check: CKV_AWS_24: "Ensure no security groups allow ingress from 0.0.0.0:0 to port 22"
	FAILED for resource: aws_security_group.web
	File: /main.tf:26-45
```

Exit kod je različit od nule čim postoji ijedan pali nalaz. To je dovoljno da job padne.

U labu je `checkov` omotač koji dodaje `--skip-download` i `BC_SKIP_MAPPING=TRUE`, jer nema mreže. Posljedica koju vrijedi znati i van laba: **ugrađene provjere u open-source režimu nemaju ozbiljnost** (severity dolazi sa platforme uz API ključ). Zato `--hard-fail-on HIGH` ili `--skip-check MEDIUM` bez API ključa ne rade kako bi očekivao. Gate gradiš po ID-ovima provjera.

### Kontrola exit koda

| Flag | Ponašanje |
|---|---|
| (ništa) | bilo koji pali nalaz → exit 1 |
| `-s`, `--soft-fail` | uvijek exit 0 (samo izvještaj) |
| `--soft-fail-on CKV_AWS_260` | exit 0 ako padaju samo navedene provjere |
| `--hard-fail-on CKV_AWS_24,CKV_AWS_17` | exit 1 samo za navedene provjere |
| `--skip-check CKV_AWS_18` | provjera se uopšte ne izvršava i ne pojavljuje u izvještaju |

Razlika između `--skip-check` i `--soft-fail-on` je bitna: skip **sakriva** nalaz, soft-fail ga **prikazuje** ali ne ruši build. Za uvođenje alata koristi soft-fail; skip samo za provjere koje kod vas zaista nemaju smisla.

### Konfiguracioni fajl

Umjesto dugačke komandne linije, Checkov čita `.checkov.yaml` iz trenutnog direktorija (ili `--config-file`). Ključevi su imena flagova:

```yaml
# /root/kurs-shop/.checkov.yaml
directory:
  - infra
  - k8s
framework:
  - terraform
  - kubernetes
compact: true
quiet: true
skip-check:
  - CKV_AWS_18     # access logging za S3: centralni CloudTrail data events, odluka SEC-112
```

Komentar uz svaki globalni skip nije ukras: za šest mjeseci niko neće znati zašto je provjera isključena.

### Izlaz za pipeline

```bash
checkov -d infra -o cli -o sarif --output-file-path console,checkov.sarif
checkov -d infra -o cli -o gitlab_sast --output-file-path console,gl-sast-checkov.json
```

Više `-o` flagova daje više formata odjednom; `--output-file-path` redom kaže gdje ide svaki (`console` znači standardni izlaz). `sarif` je za GitHub code scanning, DefectDojo i ostale alate koji razumiju SARIF 2.1.0; `gitlab_sast` je format koji GitLab prikazuje u MR widgetu kroz `artifacts:reports:sast`.

### Job u `.gitlab-ci.yml`

```yaml
stages: [secrets, sast, iac, build, test]

iac-checkov:
  stage: iac
  needs: []
  script:
    - checkov -d infra -d k8s --framework terraform kubernetes
        -o cli -o gitlab_sast -o sarif
        --output-file-path console,gl-sast-checkov.json,checkov.sarif
  artifacts:
    when: always            # izvještaj treba i kad job padne
    paths: [checkov.sarif]
    reports:
      sast: gl-sast-checkov.json
  rules:
    - changes: [infra/**/*, k8s/**/*, .checkov.yaml]
```

Tri detalja:

- `needs: []` pokreće job odmah, bez čekanja prethodnih faza.
- `artifacts:when: always` je obavezan za sigurnosne jobove; podrazumijevano se artefakti čuvaju samo za uspješan job, a upravo kad padne želiš izvještaj.
- `rules:changes` štedi vrijeme na MR-ovima koji ne diraju infrastrukturu. Na glavnoj grani i u zakazanim pipelineima pusti puni sken (nove provjere u novoj verziji Checkova mogu naći nešto u starom kodu).

Ekvivalent u GitHub Actions je korak sa `checkov` komandom (ili akcijom `bridgecrewio/checkov-action`) i upload SARIF-a kroz `github/codeql-action/upload-sarif`. GitLab ima i vlastiti šablon za IaC skeniranje (`Jobs/SAST-IaC.gitlab-ci.yml`) koji interno koristi KICS; korisno ako već koristiš GitLab Ultimate, ali manje fleksibilno od vlastitog joba.

> **U praksi:** Novi IaC skener na postojećem repou izbaci 80 nalaza prvog dana. Ako odmah ruši build, tim će ga isključiti do petka. Kreni sa `--soft-fail` i SARIF izvještajem dvije sedmice, napravi baseline, pa uključi gate za **nove** nalaze.

## Izuzeća u Checkovu

### Inline skip

Izuzeće stavljaš **unutar** resursa na koji se odnosi, sa razlogom poslije dvotačke:

```hcl
resource "aws_security_group" "web" {
  #checkov:skip=CKV_AWS_260:Javni web iza ALB-a; odobrio SEC-118, revizija 2026-12-31
  name        = "kurs-shop-web"
  description = "Kurs Shop web"
  # ...
}
```

Za Kubernetes manifest se koristi anotacija, jer YAML komentari ne preživljavaju sve alate:

```yaml
metadata:
  name: node-exporter
  annotations:
    checkov.io/skip1: CKV_K8S_16=DaemonSet za metrike čvora; SEC-120
    checkov.io/skip2: CKV_K8S_14=Slika pinovana digestom u Helm values
```

Inline skip se pojavljuje u izvještaju kao **SKIPPED** sa tvojim razlogom, pa je revizija moguća. Checkov nema ugrađen rok važenja za inline skip; datum revizije upiši u razlog i provjeravaj ga kroz pregled koda ili zakazani job koji traži istekle datume (`grep -rn "checkov:skip" infra/`).

### Baseline

Za postojeći tehnički dug ne pišeš 80 inline komentara. Napraviš **baseline**: snimak postojećih nalaza, pa build pada samo na nove.

```bash
checkov -d infra --create-baseline      # upisuje infra/.checkov.baseline
git add infra/.checkov.baseline
checkov -d infra --baseline infra/.checkov.baseline
```

Baseline radi samo sa `-d`. Commituj ga i tretiraj kao listu duga: svaki sprint obriši nekoliko unosa i popravi kod.

### Šta izabrati

| Mehanizam | Opseg | Vidljivo u izvještaju | Kada |
|---|---|---|---|
| `#checkov:skip=ID:razlog` | jedan resurs | da, kao SKIPPED | svjesna, obrazložena odluka |
| `skip-check` u `.checkov.yaml` | cijeli repo | ne | provjera nema smisla u vašem okruženju |
| `--soft-fail-on ID` | cijeli repo | da, kao FAILED | privremeno, dok tim ne popravi |
| `--baseline` | postojeći nalazi | ne (osim `--output-baseline-as-skipped`) | uvođenje alata u stari repo |

> **U praksi:** Inline skip mijenja Terraform fajl, pa prolazi kroz code review kao i svaka druga promjena. To je prednost: CODEOWNERS pravilo da izmjene sa `checkov:skip` mora odobriti neko iz security tima daje kontrolu bez posebnog alata za izuzeća.

## Vlastite provjere u Checkovu

Ugrađene provjere pokrivaju opšte dobre prakse. Pravila vaše firme (obavezni tagovi, dozvoljeni regioni, `deletion_protection` na bazama) pišeš sam.

### YAML provjera

```yaml
# policies/checkov/rds_deletion_protection.yaml
metadata:
  id: "CKV2_KURS_1"
  name: "RDS instanca mora imati deletion_protection"
  category: "BACKUP_AND_RECOVERY"
  severity: "HIGH"
definition:
  cond_type: "attribute"
  resource_types:
    - "aws_db_instance"
  attribute: "deletion_protection"
  operator: "equals"
  value: true
```

Više uslova kombinuješ sa `and` / `or`:

```yaml
# policies/checkov/s3_owner_tag.yaml
metadata:
  id: "CKV2_KURS_2"
  name: "S3 bucket mora imati tagove owner i data-class"
  category: "GENERAL_SECURITY"
definition:
  and:
    - cond_type: "attribute"
      resource_types: ["aws_s3_bucket"]
      attribute: "tags.owner"
      operator: "exists"
    - cond_type: "attribute"
      resource_types: ["aws_s3_bucket"]
      attribute: "tags.data-class"
      operator: "within"
      value: ["public", "internal", "confidential"]
```

Pokretanje:

```bash
checkov -d infra --external-checks-dir policies/checkov
checkov -d infra --external-checks-dir policies/checkov --check CKV2_KURS_1,CKV2_KURS_2
```

YAML provjere su graph provjere, pa mogu koristiti i `cond_type: connection` (npr. „svaka `aws_db_instance` mora biti povezana sa `aws_db_subnet_group`“). Severity koji sam upišeš u metadata važi i bez platforme.

### Python provjera

Kad logika ne stane u operatore (računanje, parsiranje CIDR-a, poređenje dva atributa), piši Python:

```python
# policies/checkov/sg_no_admin_ports.py
from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

ADMIN_PORTS = {22, 3389, 5432}


class NoAdminPortsFromInternet(BaseResourceCheck):
    def __init__(self):
        super().__init__(
            name="Admin portovi ne smiju biti otvoreni prema 0.0.0.0/0",
            id="CKV_KURS_3",
            categories=[CheckCategories.NETWORKING],
            supported_resources=["aws_security_group"],
        )

    def scan_resource_conf(self, conf):
        for rule in conf.get("ingress", []):
            cidrs = rule.get("cidr_blocks", [[]])[0] or []
            ports = range(rule["from_port"][0], rule["to_port"][0] + 1)
            if "0.0.0.0/0" in cidrs and ADMIN_PORTS.intersection(ports):
                return CheckResult.FAILED
        return CheckResult.PASSED


check = NoAdminPortsFromInternet()
```

Vrijednosti u `conf` dolaze kao liste (to je način na koji Checkov parsira HCL), otuda `[0]`. Zadnja linija registruje provjeru; bez nje Checkov fajl učita, ali provjeru ne izvrši. Isti `--external-checks-dir` učitava i YAML i Python provjere.

> **U praksi:** Vlastite provjere drži u zasebnom repou (`security/iac-policies`) i u pipeline ih ubaci kroz `include` šablon koji ih klonira na pinovanu verziju (tag ili commit). Tako tim aplikacije ne može tiho oslabiti pravilo u svom repou, a ti možeš testirati novu verziju pravila prije nego što je svima uključiš.

## Trivy misconfig

Trivy (poznat iz CKS-a za slike) ima i skener konfiguracije. Provjere su napisane u Regu i ugrađene u binarni fajl (u labu se ne preuzimaju sa mreže).

```bash
trivy config infra/                                  # Terraform, CFN, K8s, Dockerfile, Helm...
trivy config --severity HIGH,CRITICAL infra/
trivy config --severity HIGH,CRITICAL --exit-code 1 infra/
trivy config --misconfig-scanners terraform,dockerfile .
trivy fs --scanners misconfig,secret .               # konfiguracija + tajne u jednom prolazu
```

Za razliku od Checkova, `trivy config` **podrazumijevano vraća exit 0** i kad nađe probleme. Gate dobijaš tek sa `--exit-code 1`, a prag sa `--severity`. Trivy provjere imaju ozbiljnost bez ikakve platforme.

ID-ovi provjera: novije verzije prikazuju oblik `AWS-0107`, `DS-0002`, `KSV-0017`; stariji oblik je `AVD-AWS-0107` i dalje radi kao alias, kao i dugi ID (`aws-ec2-no-public-ingress-sgr`). Velika i mala slova nisu bitna.

### Trivy i Terraform plan

Skeniranje `.tf` fajlova ne zna vrijednosti varijabli iz `terraform.tfvars` ili modula sa registra. Kad je to bitno, skeniraj plan:

```bash
terraform plan -out tfplan && terraform show -json tfplan > tfplan.json
trivy config tfplan.json
checkov -f tfplan.json --framework terraform_plan
```

Plan zahtijeva pristup provideru, pa se u praksi radi u kasnijem jobu sa read-only kredencijalima. U labu nema Terraforma ni AWS-a; skeniramo izvorni kod.

### Izuzeća u Trivyju

Inline komentar iznad resursa, sa opcionim rokom:

```hcl
#trivy:ignore:AWS-0107:exp:2026-12-31
resource "aws_security_group" "web" {
  # ...
}
```

Može i preciznije, po atributu bloka: `#trivy:ignore:aws-ec2-no-public-ingress-sgr[from_port=80]` ignoriše samo pravilo za port 80, a SSH ostaje nalaz. Kad datum iz `exp:` prođe, nalaz se vraća i build ponovo pada; to je mehanizam roka koji Checkov inline skip nema.

Inline ignore ne radi za nalaze koji nastaju zbog **odsustva** nečega (npr. nema `USER` u Dockerfileu). Za njih, i za izuzeća na nivou repoa, koristi `.trivyignore.yaml`:

```yaml
# /root/kurs-shop/.trivyignore.yaml
misconfigurations:
  - id: AWS-0107
    paths: ["infra/main.tf"]
    statement: "Port 80 javni iza ALB-a; SEC-118"
    expired_at: 2026-12-31
```

```bash
trivy config --ignorefile .trivyignore.yaml --exit-code 1 --severity HIGH,CRITICAL infra/
```

YAML format ignore fajla je u Trivyju označen kao eksperimentalan i **mora** se navesti sa `--ignorefile` (podrazumijevano se čita samo obični `.trivyignore`, jedan ID po liniji). Više o oba fajla u modulu 08.

### Vlastita Trivy provjera (Rego)

```rego
# policies/trivy/rds_deletion_protection.rego
# METADATA
# title: RDS bez deletion protection
# description: Produkcijske baze moraju imati deletion_protection.
# custom:
#   id: KURS-0001
#   severity: HIGH
#   input:
#     selector:
#     - type: cloud
package user.kurs.rds_deletion_protection

import rego.v1

deny contains res if {
	some db in input.aws.rds.instances
	not db.deletionprotection.value
	res := result.new("RDS instanca nema deletion_protection", db.deletionprotection)
}
```

```bash
trivy config --config-check policies/trivy --check-namespaces user infra/
```

Ova logika je ista kao ugrađena `AWS-0177`, koja ima ozbiljnost MEDIUM i zato ne ulazi u gate `--severity HIGH,CRITICAL`. Vlastitom provjerom firma podiže svoje pravilo na HIGH. Terraform provjere u Trivyju rade nad internim **cloud** modelom (`input.aws.rds.instances`), ne nad sirovim HCL-om; tačna imena polja nađeš u šemi (`trivy` dokumentacija, „custom checks“, i u izvoru ugrađenih provjera). Bez `--check-namespaces` Trivy izvršava samo svoje ugrađene provjere i tvoj paket tiho ignoriše. Za jednostavne provjere tagova i atributa Checkov YAML je brži za pisanje; Rego ima smisla ako već koristiš OPA/Conftest (modul 09).

## Checkov ili Trivy?

| | Checkov | Trivy misconfig |
|---|---|---|
| Podrazumijevani exit kod sa nalazima | 1 | 0 (treba `--exit-code 1`) |
| Ozbiljnost nalaza | samo sa platformom (ili u vlastitim provjerama) | ugrađena |
| Prag po ozbiljnosti | `--hard-fail-on` (uz platformu) | `--severity` |
| Inline izuzeće | `#checkov:skip=ID:razlog` | `#trivy:ignore:ID:exp:datum` |
| Rok izuzeća | nema (upiši u razlog) | `exp:` / `expired_at` |
| Baseline | `--create-baseline` / `--baseline` | nema; `.trivyignore.yaml` |
| Vlastite provjere | YAML ili Python | Rego |
| Graph provjere (veze resursa) | da (`CKV2_`) | ograničeno, preko cloud modela |
| Isti alat skenira slike i zavisnosti | ne (ima SCA uz platformu) | da |

Nije nužno birati jedan. Česta kombinacija: **Checkov kao gate** za Terraform (bogat skup AWS provjera, baseline, YAML pravila), a **Trivy** za slike i zavisnosti, sa `trivy config` kao drugim mišljenjem u izvještajnom režimu. Ono što treba izbjeći je da dva alata ruše build za isti nalaz sa dva različita mehanizma izuzeća; developer tada mora isto izuzeće pisati dva puta.

> **U praksi:** Odluči koji alat je **gate**, a koji samo izvještava. Gate ima jasan prag, dokumentovana izuzeća i vlasnika. Drugi alat ide sa `allow_failure: true` ili `--exit-code 0` u izvještaj (DefectDojo, modul 12), gdje se nalazi dedupliciraju.

## Kompletan IaC dio pipelinea

```yaml
iac-checkov:
  stage: iac
  needs: []
  script:
    - checkov -d infra --framework terraform
        --external-checks-dir policies/checkov
        --baseline infra/.checkov.baseline
        -o cli -o sarif --output-file-path console,checkov.sarif
  artifacts:
    when: always
    paths: [checkov.sarif]

iac-trivy:
  stage: iac
  needs: []
  allow_failure: true          # drugo mišljenje, ne gate
  script:
    - trivy config --ignorefile .trivyignore.yaml
        --severity HIGH,CRITICAL --exit-code 1
        --format sarif --output trivy-config.sarif infra/ k8s/
  artifacts:
    when: always
    paths: [trivy-config.sarif]
```

Pokretanje u labu:

```bash
cd /root/kurs-shop
gitlab-ci-local --list
gitlab-ci-local iac-checkov
```

Kad `iac-checkov` padne, ispravi `infra/main.tf` (ili dodaj obrazloženo izuzeće), pa ponovo pokreni samo taj job.

> **U praksi:** Developer koji vidi „CKV_AWS_17 FAILED“ ne zna šta da radi. U MR komentaru ili README-u pipelinea drži kratku tabelu „najčešći nalazi i kako ih popraviti“ sa primjerom ispravnog Terraforma. Vrijeme do ispravke pada sa sat vremena na pet minuta, a broj zahtjeva za izuzećem drastično opada.

## Rezime

- IaC skeniranje hvata pogrešnu konfiguraciju (javni bucket, otvoren SSH, javna i nešifrovana baza) u MR-u, prije nego što resurs postoji.
- Checkov: `-d`/`-f`, `--framework`, `--check`/`--skip-check`; pada na bilo koji nalaz, `--soft-fail` za izvještajni režim, `--soft-fail-on`/`--hard-fail-on` za granularni gate; ozbiljnost ugrađenih provjera traži platformu.
- Trivy: `trivy config`, podrazumijevano exit 0, gate sa `--exit-code 1 --severity HIGH,CRITICAL`; ID-ovi `AWS-0107`, alias `AVD-AWS-0107`.
- Izuzeća: `#checkov:skip=ID:razlog` unutar resursa, `checkov.io/skipN` anotacija u K8s; `#trivy:ignore:ID:exp:datum` iznad resursa; `.trivyignore.yaml` sa `statement` i `expired_at` (uz `--ignorefile`).
- Postojeći dug rješavaš baselineom (`--create-baseline`, `--baseline`), a ne globalnim isključivanjem provjera.
- Vlastita pravila: Checkov YAML (`cond_type`, `operator`) ili Python (`BaseResourceCheck`), učitana sa `--external-checks-dir`; Trivy Rego provjere sa `--config-check` i `--check-namespaces`.
- U pipelineu: `needs: []`, `artifacts:when: always`, SARIF/`gitlab_sast` izvještaj; jedan alat je gate, drugi izvještava.
