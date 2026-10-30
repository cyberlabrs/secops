# Lab 1: Terraform kroz Checkov

`infra/main.tf` kurs-shopa pravi S3 bucket za upload, security grupu za web server i PostgreSQL bazu. **Checkov** u njemu nalazi 25 problema. Neki su kritični (javno dostupna baza, SSH otvoren za cijeli internet), a neki su dobra praksa koju tim planira kasnije.

Popravićeš kritične nalaze, obrazložiti svjesno odstupanje i uvesti job koji blokira **nove** probleme, a postojeći tehnički dug vodi kroz **baseline**.

```bash
cd /root/kurs-shop
checkov -d infra --compact
trivy config infra
```

<!-- setup
set -e
kurs-repo
-->

## Izvještaj i prioriteti

Pokreni Checkov nad `infra/` i sačuvaj rezultat u JSON formatu u `/root/checkov.json`. Zatim u `/root/kriticni.txt` upiši ID-jeve (jedan po redu) provjera koje otkrivaju:

- javno dostupnu bazu,
- nešifrovanu bazu,
- SSH (port 22) otvoren prema `0.0.0.0/0`.

```bash
checkov -d infra -o json > /root/checkov.json
jq -r '.results.failed_checks[] | [.check_id, .resource, .check_name] | @tsv' /root/checkov.json
```

<!-- verify
[ -s /root/checkov.json ] || { echo "/root/checkov.json ne postoji"; exit 1; }
jq -e '.results.failed_checks | length > 10' /root/checkov.json >/dev/null 2>&1 || { echo "checkov.json nije JSON izvještaj Checkova za infra/"; exit 1; }
for id in CKV_AWS_17 CKV_AWS_16 CKV_AWS_24; do
  grep -qx "$id" <(tr -d ' \r' < /root/kriticni.txt 2>/dev/null) || { echo "u kriticni.txt nedostaje jedna od traženih provjera"; exit 1; }
done
[ "$(grep -c . /root/kriticni.txt)" -le 3 ] || { echo "kriticni.txt treba tačno tri ID-ja"; exit 1; }
-->
<!-- hint
Traži po `check_name`: „publicly accessible“, „encrypted at rest“ i „port 22“. Svi su na resursima `aws_db_instance.shop` i `aws_security_group.web`.
-->
<!-- solution
cd /root/kurs-shop
checkov -d infra -o json > /root/checkov.json 2>/dev/null || true
printf 'CKV_AWS_17\nCKV_AWS_16\nCKV_AWS_24\n' > /root/kriticni.txt
-->

## Popravi kritične nalaze

Izmijeni `infra/main.tf` tako da prolaze sljedeće provjere:

- S3 public access block: sve četiri opcije uključene (`CKV_AWS_53`–`CKV_AWS_56`),
- SSH samo iz interne mreže `10.0.0.0/8` (`CKV_AWS_24`),
- baza nije javno dostupna i šifrovana je (`CKV_AWS_17`, `CKV_AWS_16`).

Usput ukloni lozinku baze iz koda: umjesto `password` koristi `manage_master_user_password = true` (lozinku tada generiše i čuva AWS Secrets Manager).

```bash
checkov -d infra --check CKV_AWS_53,CKV_AWS_54,CKV_AWS_55,CKV_AWS_56,CKV_AWS_24,CKV_AWS_16,CKV_AWS_17 --compact
```

<!-- verify
cd /root/kurs-shop
checkov -d infra --check CKV_AWS_53,CKV_AWS_54,CKV_AWS_55,CKV_AWS_56,CKV_AWS_24,CKV_AWS_16,CKV_AWS_17 --compact --quiet >/tmp/ck.txt 2>&1 || { grep -E 'Check:|FAILED' /tmp/ck.txt | head -12; echo "kritične provjere i dalje padaju"; exit 1; }
grep -Eq '^\s*password\s*=' infra/main.tf && { echo "lozinka baze je i dalje u main.tf"; exit 1; }
grep -Eq 'manage_master_user_password\s*=\s*true' infra/main.tf || { echo "baza treba manage_master_user_password = true"; exit 1; }
trivy config -q --severity HIGH,CRITICAL --format json infra 2>/dev/null | jq -e '[.Results[]?.Misconfigurations[]? | select(.Status=="FAIL") | .ID] | (index("AWS-0180") or index("AWS-0080") or index("AWS-0107") or index("AWS-0086")) | not' >/dev/null || { echo "Trivy i dalje nalazi kritične probleme (AWS-0180/0080/0107/0086)"; exit 1; }
[ "$(grep -c 'resource "aws_' infra/main.tf)" -ge 4 ] || { echo "ne briši resurse: popravi njihovu konfiguraciju"; exit 1; }
-->
<!-- hint
```hcl
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

  ingress {
    description = "SSH iz interne mreže"
    ...
    cidr_blocks = ["10.0.0.0/8"]
  }

resource "aws_db_instance" "shop" {
  ...
  manage_master_user_password = true
  publicly_accessible         = false
  storage_encrypted           = true
}
```
-->
<!-- solution
cd /root/kurs-shop
python3 - <<'EOF'
p = "infra/main.tf"; s = open(p).read()
for k in ["block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets"]:
    s = s.replace(f"{k} = false", f"{k} = true").replace(f"{k}       = false", f"{k}       = true").replace(f"{k}     = false", f"{k}     = true").replace(f"{k}      = false", f"{k}      = true")
import re
s = re.sub(r'(\b(?:block_public_acls|block_public_policy|ignore_public_acls|restrict_public_buckets)\s*=\s*)false', r'\1true', s)
s = s.replace('''    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]''', '''    description = "SSH iz interne mreže"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]''')
s = re.sub(r'\n\s*password\s*=\s*"[^"]*"', '\n  manage_master_user_password = true', s)
s = s.replace("publicly_accessible = true", "publicly_accessible = false").replace("storage_encrypted   = false", "storage_encrypted   = true")
s = re.sub(r'publicly_accessible\s*=\s*true', 'publicly_accessible = false', s)
s = re.sub(r'storage_encrypted\s*=\s*false', 'storage_encrypted = true', s)
open(p, "w").write(s)
EOF
-->

## Svjesno odstupanje i baseline

1. Port 80 na web serveru namjerno je otvoren prema internetu (javni sajt iza koga je redirect na HTTPS). Za provjeru `CKV_AWS_260` dodaj **inline izuzetak** u resurs `aws_security_group.web`, sa obrazloženjem: `#checkov:skip=CKV_AWS_260:<razlog>`.
2. Ostale nalaze tim rješava planski. Napravi **baseline** (`checkov -d infra --create-baseline`, nastaje `infra/.checkov.baseline`) i commituj ga zajedno sa izmjenama.
3. Dodaj job `iac` (faza `test`): `checkov -d infra --baseline infra/.checkov.baseline --compact`. Pipeline mora proći, a svaki **novi** problem (npr. nova security grupa sa otvorenim SSH-om) mora ga oboriti.

<!-- verify
cd /root/kurs-shop
grep -Eq '#\s*checkov:skip=CKV_AWS_260:\s*\S.{9,}' infra/main.tf || { echo "nema inline izuzetka checkov:skip=CKV_AWS_260 sa obrazloženjem (barem desetak znakova)"; exit 1; }
[ -f infra/.checkov.baseline ] || { echo "nema infra/.checkov.baseline"; exit 1; }
git ls-files --error-unmatch infra/.checkov.baseline >/dev/null 2>&1 || { echo "baseline nije commitovan"; exit 1; }
git diff --quiet HEAD -- infra/ || { echo "izmjene u infra/ nisu commitovane"; exit 1; }
jq -e '[.failed_checks[]?.findings[]?.check_ids[]?] as $b | ["CKV_AWS_24","CKV_AWS_16","CKV_AWS_17","CKV_AWS_53"] | all(. as $x | $b | index($x) | not)' infra/.checkov.baseline >/dev/null 2>&1 || { echo "baseline sadrži kritične provjere (npr. CKV_AWS_24/16/17): napravi ga tek nakon popravki"; exit 1; }
yq '.iac.script | join(" ")' .gitlab-ci.yml | grep -q -- '--baseline' || { echo "job iac ne koristi --baseline"; exit 1; }
gitlab-ci-local iac > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job iac pada"; exit 1; }
cp infra/main.tf /tmp/main.tf.bak
printf '\nresource "aws_security_group" "provjera" {\n  name        = "provjera"\n  description = "provjera"\n  ingress {\n    description = "SSH"\n    from_port   = 22\n    to_port     = 22\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n' >> infra/main.tf
gitlab-ci-local iac > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/main.tf.bak infra/main.tf
[ $rc -ne 0 ] || { echo "job iac ne pada na novoj security grupi sa otvorenim SSH-om"; exit 1; }
-->
<!-- hint
```hcl
resource "aws_security_group" "web" {
  #checkov:skip=CKV_AWS_260:Javni web sajt; port 80 samo radi redirect na 443 (odobrio AppSec, SEC-142)
  name = "kurs-shop-web"
  ...
```
```yaml
iac:
  stage: test
  script:
    - checkov -d infra --baseline infra/.checkov.baseline --compact
```
Baseline pamti postojeće nalaze po resursu i provjeri; napravi ga **nakon** popravki, inače u njega „zamrzneš“ i kritične probleme.
-->
<!-- solution
cd /root/kurs-shop
sed -i 's|^resource "aws_security_group" "web" {|resource "aws_security_group" "web" {\n  #checkov:skip=CKV_AWS_260:Javni web sajt; port 80 samo radi redirect na 443 (odobrio AppSec)|' infra/main.tf
checkov -d infra --create-baseline --quiet >/dev/null 2>&1 || true
git add infra && git commit -qm "IaC: kritične popravke i Checkov baseline"
yq -i '.iac = {"stage": "test", "script": ["checkov -d infra --baseline infra/.checkov.baseline --compact"]}' .gitlab-ci.yml
-->
