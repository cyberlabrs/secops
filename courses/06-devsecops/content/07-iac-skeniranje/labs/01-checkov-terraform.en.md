# Lab 1: Terraform through Checkov

Kurs-shop's `infra/main.tf` creates an S3 bucket for uploads, a security group for the web server and a PostgreSQL database. **Checkov** finds 25 problems in it. Some are critical (a publicly accessible database, SSH open to the whole internet), and some are good practices the team plans to address later.

You will fix the critical findings, justify a deliberate deviation and introduce a job that blocks **new** problems, while the existing technical debt is tracked through a **baseline**.

```bash
cd /root/kurs-shop
checkov -d infra --compact
trivy config infra
```

<!-- setup
set -e
kurs-repo
-->

## Report and priorities

Run Checkov over `infra/` and save the result in JSON format to `/root/checkov.json`. Then write to `/root/kriticni.txt` (`kriticni` = critical) the IDs (one per line) of the checks that detect:

- a publicly accessible database,
- an unencrypted database,
- SSH (port 22) open to `0.0.0.0/0`.

```bash
checkov -d infra -o json > /root/checkov.json
jq -r '.results.failed_checks[] | [.check_id, .resource, .check_name] | @tsv' /root/checkov.json
```

<!-- verify
[ -s /root/checkov.json ] || { echo "/root/checkov.json does not exist"; exit 1; }
jq -e '.results.failed_checks | length > 10' /root/checkov.json >/dev/null 2>&1 || { echo "checkov.json is not a Checkov JSON report for infra/"; exit 1; }
for id in CKV_AWS_17 CKV_AWS_16 CKV_AWS_24; do
  grep -qx "$id" <(tr -d ' \r' < /root/kriticni.txt 2>/dev/null) || { echo "kriticni.txt is missing one of the required checks"; exit 1; }
done
[ "$(grep -c . /root/kriticni.txt)" -le 3 ] || { echo "kriticni.txt must contain exactly three IDs"; exit 1; }
-->
<!-- hint
Search by `check_name`: "publicly accessible", "encrypted at rest" and "port 22". They are all on the resources `aws_db_instance.shop` and `aws_security_group.web`.
-->
<!-- solution
cd /root/kurs-shop
checkov -d infra -o json > /root/checkov.json 2>/dev/null || true
printf 'CKV_AWS_17\nCKV_AWS_16\nCKV_AWS_24\n' > /root/kriticni.txt
-->

## Fix the critical findings

Change `infra/main.tf` so that the following checks pass:

- S3 public access block: all four options enabled (`CKV_AWS_53`–`CKV_AWS_56`),
- SSH only from the internal network `10.0.0.0/8` (`CKV_AWS_24`),
- the database is not publicly accessible and is encrypted (`CKV_AWS_17`, `CKV_AWS_16`).

Along the way, remove the database password from the code: instead of `password` use `manage_master_user_password = true` (the password is then generated and stored by AWS Secrets Manager).

```bash
checkov -d infra --check CKV_AWS_53,CKV_AWS_54,CKV_AWS_55,CKV_AWS_56,CKV_AWS_24,CKV_AWS_16,CKV_AWS_17 --compact
```

<!-- verify
cd /root/kurs-shop
checkov -d infra --check CKV_AWS_53,CKV_AWS_54,CKV_AWS_55,CKV_AWS_56,CKV_AWS_24,CKV_AWS_16,CKV_AWS_17 --compact --quiet >/tmp/ck.txt 2>&1 || { grep -E 'Check:|FAILED' /tmp/ck.txt | head -12; echo "critical checks still fail"; exit 1; }
grep -Eq '^\s*password\s*=' infra/main.tf && { echo "the database password is still in main.tf"; exit 1; }
grep -Eq 'manage_master_user_password\s*=\s*true' infra/main.tf || { echo "the database needs manage_master_user_password = true"; exit 1; }
trivy config -q --severity HIGH,CRITICAL --format json infra 2>/dev/null | jq -e '[.Results[]?.Misconfigurations[]? | select(.Status=="FAIL") | .ID] | (index("AWS-0180") or index("AWS-0080") or index("AWS-0107") or index("AWS-0086")) | not' >/dev/null || { echo "Trivy still finds critical problems (AWS-0180/0080/0107/0086)"; exit 1; }
[ "$(grep -c 'resource "aws_' infra/main.tf)" -ge 4 ] || { echo "don't delete resources: fix their configuration"; exit 1; }
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
    description = "SSH from the internal network"
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

## Deliberate deviation and baseline

1. Port 80 on the web server is intentionally open to the internet (a public site that redirects to HTTPS). For the check `CKV_AWS_260`, add an **inline suppression** to the resource `aws_security_group.web`, with a justification: `#checkov:skip=CKV_AWS_260:<reason>`.
2. The team handles the remaining findings in a planned way. Create a **baseline** (`checkov -d infra --create-baseline`, which produces `infra/.checkov.baseline`) and commit it together with your changes.
3. Add a job `iac` (stage `test`): `checkov -d infra --baseline infra/.checkov.baseline --compact`. The pipeline must pass, and every **new** problem (e.g. a new security group with SSH open) must make it fail.

<!-- verify
cd /root/kurs-shop
grep -Eq '#\s*checkov:skip=CKV_AWS_260:\s*\S.{9,}' infra/main.tf || { echo "no inline suppression checkov:skip=CKV_AWS_260 with a justification (at least ten or so characters)"; exit 1; }
[ -f infra/.checkov.baseline ] || { echo "infra/.checkov.baseline is missing"; exit 1; }
git ls-files --error-unmatch infra/.checkov.baseline >/dev/null 2>&1 || { echo "the baseline is not committed"; exit 1; }
git diff --quiet HEAD -- infra/ || { echo "changes in infra/ are not committed"; exit 1; }
jq -e '[.failed_checks[]?.findings[]?.check_ids[]?] as $b | ["CKV_AWS_24","CKV_AWS_16","CKV_AWS_17","CKV_AWS_53"] | all(. as $x | $b | index($x) | not)' infra/.checkov.baseline >/dev/null 2>&1 || { echo "the baseline contains critical checks (e.g. CKV_AWS_24/16/17): create it only after the fixes"; exit 1; }
yq '.iac.script | join(" ")' .gitlab-ci.yml | grep -q -- '--baseline' || { echo "the iac job does not use --baseline"; exit 1; }
gitlab-ci-local iac > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the iac job fails"; exit 1; }
cp infra/main.tf /tmp/main.tf.bak
printf '\nresource "aws_security_group" "provjera" {\n  name        = "provjera"\n  description = "provjera"\n  ingress {\n    description = "SSH"\n    from_port   = 22\n    to_port     = 22\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n' >> infra/main.tf
gitlab-ci-local iac > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/main.tf.bak infra/main.tf
[ $rc -ne 0 ] || { echo "the iac job does not fail on a new security group with SSH open"; exit 1; }
-->
<!-- hint
```hcl
resource "aws_security_group" "web" {
  #checkov:skip=CKV_AWS_260:Public web site; port 80 only redirects to 443 (approved by AppSec, SEC-142)
  name = "kurs-shop-web"
  ...
```
```yaml
iac:
  stage: test
  script:
    - checkov -d infra --baseline infra/.checkov.baseline --compact
```
The baseline remembers existing findings per resource and check; create it **after** the fixes, otherwise you "freeze" the critical problems into it as well.
-->
<!-- solution
cd /root/kurs-shop
sed -i 's|^resource "aws_security_group" "web" {|resource "aws_security_group" "web" {\n  #checkov:skip=CKV_AWS_260:Javni web sajt; port 80 samo radi redirect na 443 (odobrio AppSec)|' infra/main.tf
checkov -d infra --create-baseline --quiet >/dev/null 2>&1 || true
git add infra && git commit -qm "IaC: kritične popravke i Checkov baseline"
yq -i '.iac = {"stage": "test", "script": ["checkov -d infra --baseline infra/.checkov.baseline --compact"]}' .gitlab-ci.yml
-->
