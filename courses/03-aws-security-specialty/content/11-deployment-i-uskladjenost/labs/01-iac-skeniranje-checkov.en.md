# Lab 1: Infrastructure as code security (Checkov)

A team wrote Terraform for a new application and wants to deploy it to all accounts. Before that, the security team introduces a **policy-as-code** check into the pipeline: the build fails if the Terraform violates the basic rules. This is the same principle as **CloudFormation Guard**, **cfn-lint**, and **CloudFormation Hooks** in AWS, only with the **Checkov** tool, which also works for Terraform.

You will fix the Terraform so that it passes the eight checks the security team has declared mandatory, and then create a "gate" script for the pipeline. The code is in `/root/infra/`.

| Check | What it requires |
|---|---|
| `CKV_AWS_24` | the security group does not open port 22 to `0.0.0.0/0` |
| `CKV_AWS_16`, `CKV_AWS_17` | RDS is encrypted and not publicly accessible |
| `CKV2_AWS_6`, `CKV_AWS_21`, `CKV_AWS_145` | S3: Block Public Access, versioning, default SSE-KMS |
| `CKV_AWS_36`, `CKV_AWS_67` | CloudTrail: log file integrity validation, all Regions |

<!-- setup
set -e
mkdir -p /root/infra && cd /root/infra
cat > main.tf <<'EOF'
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_kms_key" "podaci" {
  description         = "Ključ za podatke aplikacije"
  enable_key_rotation = true
}

resource "aws_s3_bucket" "izvjestaji" {
  bucket = "primjer-izvjestaji"
}

resource "aws_security_group" "web" {
  name        = "web"
  description = "Web serveri"
  vpc_id      = "vpc-0abc1234def567890"

  ingress {
    description = "SSH za administraciju"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "baza" {
  identifier          = "baza"
  engine              = "postgres"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  username            = "app"
  password            = "Ljeto2026!"
  publicly_accessible = true
  storage_encrypted   = false
}

resource "aws_cloudtrail" "org" {
  name                       = "org-trail"
  s3_bucket_name             = "primjer-trail-logs"
  is_multi_region_trail      = false
  enable_log_file_validation = false
}
EOF
echo 'CKV_AWS_24,CKV_AWS_16,CKV_AWS_17,CKV2_AWS_6,CKV_AWS_21,CKV_AWS_145,CKV_AWS_36,CKV_AWS_67' > /root/infra/.obavezne-provjere
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: IaC skeniranje (Checkov) ===
Kod: /root/infra/main.tf    Obavezne provjere: cat /root/infra/.obavezne-provjere
Skeniranje: checkov -f main.tf --compact --check $(cat .obavezne-provjere)
EOF
-->

## First scan

```bash
cd /root/infra
checkov -f main.tf --compact --quiet | head -40
checkov -f main.tf --compact --quiet --check $(cat .obavezne-provjere)
```

The first command shows all findings, and there are many. The second shows only the mandatory ones (the file `.obavezne-provjere` means "mandatory checks"). A real team does not start with 100% of the rules: the team picks a mandatory baseline and resolves the other findings gradually. Individual exceptions are marked with a comment in the code (`#checkov:skip=CKV_AWS_xx:justification`), so the decision stays recorded and visible in code review.

## Security group without SSH to the internet

Remove the `ingress` block for port 22. Administrative access goes through **Systems Manager Session Manager**: there is no open port, and every session is logged in CloudTrail and, optionally, in S3 or CloudWatch Logs.

```bash
nano main.tf
checkov -f main.tf --compact --quiet --check CKV_AWS_24
```

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV_AWS_24 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -5; exit 1; }
grep -q 'from_port *= *443' main.tf || { echo "Do not delete the HTTPS rule too"; exit 1; }
-->
<!-- solution
cd /root/infra && python3 - <<'PY'
s=open('main.tf').read()
a=s.index('  ingress {\n    description = "SSH'); b=s.index('  }\n',a)+4
s=s[:a]+s[b:].lstrip('\n')
open('main.tf','w').write(s)
PY
-->

## RDS: encryption, privacy, no password in code

For `aws_db_instance.baza`:

- `storage_encrypted = true` and `kms_key_id = aws_kms_key.podaci.arn`,
- `publicly_accessible = false`,
- remove `password` and instead set `manage_master_user_password = true`. RDS then generates the password and stores it in **Secrets Manager** with automatic rotation, so the password is never in the code or in the Terraform state.

```bash
nano main.tf
checkov -f main.tf --compact --quiet --check CKV_AWS_16,CKV_AWS_17
```

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV_AWS_16,CKV_AWS_17 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -5; exit 1; }
grep -qE '^[[:space:]]*password[[:space:]]*=' main.tf && { echo "The password is still in the code"; exit 1; }
grep -qE 'manage_master_user_password[[:space:]]*=[[:space:]]*true' main.tf || { echo "manage_master_user_password = true is missing"; exit 1; }
exit 0
-->
<!-- solution
cd /root/infra && sed -i 's/^  password            = "Ljeto2026!"/  manage_master_user_password = true/; s/publicly_accessible = true/publicly_accessible = false/; s/storage_encrypted   = false/storage_encrypted   = true\n  kms_key_id          = aws_kms_key.podaci.arn/' main.tf
-->

## S3: Block Public Access, versioning, SSE-KMS

In AWS provider v4+ these settings are **separate resources**. Add them for `aws_s3_bucket.izvjestaji`:

```hcl
resource "aws_s3_bucket_public_access_block" "izvjestaji" {
  bucket                  = aws_s3_bucket.izvjestaji.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "izvjestaji" {
  bucket = aws_s3_bucket.izvjestaji.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "izvjestaji" {
  bucket = aws_s3_bucket.izvjestaji.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.podaci.arn
    }
    bucket_key_enabled = true
  }
}
```

```bash
nano main.tf
checkov -f main.tf --compact --quiet --check CKV2_AWS_6,CKV_AWS_21,CKV_AWS_145
```

In practice Block Public Access is also enabled at the **account** level, and in an organization it can be locked with a **declarative** policy or an SCP.

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV2_AWS_6,CKV_AWS_21,CKV_AWS_145 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -8; exit 1; }
-->
<!-- solution
cd /root/infra && cat >> main.tf <<'EOF'

resource "aws_s3_bucket_public_access_block" "izvjestaji" {
  bucket                  = aws_s3_bucket.izvjestaji.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "izvjestaji" {
  bucket = aws_s3_bucket.izvjestaji.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "izvjestaji" {
  bucket = aws_s3_bucket.izvjestaji.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.podaci.arn
    }
    bucket_key_enabled = true
  }
}
EOF
-->

## CloudTrail in all Regions, with validation

Set `is_multi_region_trail = true` and `enable_log_file_validation = true`.

**Log file validation** creates a signed *digest* file with hashes of the log files every hour, so you can later prove that the logs were not modified or deleted (`aws cloudtrail validate-logs`). In an organization this would be an **organization trail** from the management or delegated admin account.

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV_AWS_36,CKV_AWS_67 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -5; exit 1; }
-->
<!-- solution
cd /root/infra && sed -i 's/is_multi_region_trail      = false/is_multi_region_trail      = true/; s/enable_log_file_validation = false/enable_log_file_validation = true/' main.tf
-->

## Pipeline gate

Create `/root/infra/ci-gate.sh`: a script that the pipeline (GitHub Actions, CodePipeline/CodeBuild) runs before `terraform plan`. It must:

1. run Checkov with only the mandatory checks from `.obavezne-provjere`,
2. return a nonzero exit code if any of them fails. Checkov does this itself, so the script must not swallow the error (no `|| true`).

```bash
cat > /root/infra/ci-gate.sh <<'EOF'
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
checkov -d . --framework terraform --compact --quiet --check "$(cat .obavezne-provjere)"
EOF
chmod +x /root/infra/ci-gate.sh
/root/infra/ci-gate.sh && echo "GATE: PASS"
```

For CloudFormation, the same gate would use `cfn-lint` (template correctness) and `cfn-guard validate` (organization rules), and the rules can also be enforced centrally with **CloudFormation Hooks**, before the resource is even created.

<!-- verify
f=/root/infra/ci-gate.sh
[ -x $f ] || { echo "ci-gate.sh does not exist or is not executable"; exit 1; }
grep -q '|| *true' $f && { echo "The gate must not swallow the error (|| true)"; exit 1; }
$f >/dev/null 2>&1 || { echo "The gate fails on the current code"; exit 1; }
cp /root/infra/main.tf /tmp/main.tf.bak
sed -i 's/publicly_accessible = false/publicly_accessible = true/' /root/infra/main.tf
$f >/dev/null 2>&1; rc=$?
cp /tmp/main.tf.bak /root/infra/main.tf
[ $rc -ne 0 ] || { echo "The gate lets a publicly accessible RDS through: it must fail when a check does not pass"; exit 1; }
-->
<!-- solution
printf '#!/bin/bash\nset -euo pipefail\ncd "$(dirname "$0")"\ncheckov -d . --framework terraform --compact --quiet --check "$(cat .obavezne-provjere)"\n' > /root/infra/ci-gate.sh && chmod +x /root/infra/ci-gate.sh
-->
