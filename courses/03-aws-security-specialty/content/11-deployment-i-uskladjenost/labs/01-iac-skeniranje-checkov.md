# Lab 1: Sigurnost infrastrukture kao koda (Checkov)

Tim je napisao Terraform za novu aplikaciju i želi ga deployovati u sve naloge. Prije toga sigurnosni tim uvodi **policy-as-code** provjeru u pipeline: build pada ako Terraform krši osnovna pravila. To je isti princip kao **CloudFormation Guard**, **cfn-lint** i **CloudFormation Hooks** u AWS-u, samo sa alatom **Checkov**, koji radi i za Terraform.

Popravićeš Terraform tako da prođe osam provjera koje je sigurnosni tim proglasio obaveznim, a zatim napraviti „gate“ skriptu za pipeline. Kod je u `/root/infra/`.

| Provjera | Šta traži |
|---|---|
| `CKV_AWS_24` | security grupa ne otvara port 22 prema `0.0.0.0/0` |
| `CKV_AWS_16`, `CKV_AWS_17` | RDS šifrovan i nije javno dostupan |
| `CKV2_AWS_6`, `CKV_AWS_21`, `CKV_AWS_145` | S3: Block Public Access, versioning, podrazumijevani SSE-KMS |
| `CKV_AWS_36`, `CKV_AWS_67` | CloudTrail: validacija integriteta log fajlova, sve regije |

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

## Prvo skeniranje

```bash
cd /root/infra
checkov -f main.tf --compact --quiet | head -40
checkov -f main.tf --compact --quiet --check $(cat .obavezne-provjere)
```

Prva komanda pokazuje sve nalaze, a ima ih mnogo. Druga pokazuje samo obavezne. U stvarnom timu se ne kreće od 100% pravila: tim bira obaveznu osnovu, a ostale nalaze rješava postepeno. Pojedinačne izuzetke označava komentarom u kodu (`#checkov:skip=CKV_AWS_xx:obrazloženje`), da odluka ostane zapisana i vidljiva u reviziji koda.

## Security grupa bez SSH-a prema internetu

Ukloni `ingress` blok za port 22. Administratorski pristup ide preko **Systems Manager Session Manager**a: nema otvorenog porta, a svaka sesija je logovana u CloudTrail i, po želji, u S3 ili CloudWatch Logs.

```bash
nano main.tf
checkov -f main.tf --compact --quiet --check CKV_AWS_24
```

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV_AWS_24 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -5; exit 1; }
grep -q 'from_port *= *443' main.tf || { echo "Ne briši i HTTPS pravilo"; exit 1; }
-->
<!-- solution
cd /root/infra && python3 - <<'PY'
s=open('main.tf').read()
a=s.index('  ingress {\n    description = "SSH'); b=s.index('  }\n',a)+4
s=s[:a]+s[b:].lstrip('\n')
open('main.tf','w').write(s)
PY
-->

## RDS: enkripcija, privatnost, bez lozinke u kodu

Za `aws_db_instance.baza`:

- `storage_encrypted = true` i `kms_key_id = aws_kms_key.podaci.arn`,
- `publicly_accessible = false`,
- ukloni `password` i umjesto njega postavi `manage_master_user_password = true`. RDS tada generiše lozinku i čuva je u **Secrets Manageru** sa automatskom rotacijom, pa lozinka nikad nije u kodu ni u Terraform stateu.

```bash
nano main.tf
checkov -f main.tf --compact --quiet --check CKV_AWS_16,CKV_AWS_17
```

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV_AWS_16,CKV_AWS_17 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -5; exit 1; }
grep -qE '^[[:space:]]*password[[:space:]]*=' main.tf && { echo "Lozinka je i dalje u kodu"; exit 1; }
grep -qE 'manage_master_user_password[[:space:]]*=[[:space:]]*true' main.tf || { echo "Nedostaje manage_master_user_password = true"; exit 1; }
exit 0
-->
<!-- solution
cd /root/infra && sed -i 's/^  password            = "Ljeto2026!"/  manage_master_user_password = true/; s/publicly_accessible = true/publicly_accessible = false/; s/storage_encrypted   = false/storage_encrypted   = true\n  kms_key_id          = aws_kms_key.podaci.arn/' main.tf
-->

## S3: Block Public Access, versioning, SSE-KMS

U AWS provideru v4+ ove postavke su **posebni resursi**. Dodaj ih za `aws_s3_bucket.izvjestaji`:

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

Block Public Access se u praksi uključuje i na nivou **naloga**, a u organizaciji se može zaključati **declarative** politikom ili SCP-om.

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

## CloudTrail u svim regijama, sa validacijom

Postavi `is_multi_region_trail = true` i `enable_log_file_validation = true`.

**Log file validation** svaki sat pravi potpisani *digest* fajl sa hash-evima log fajlova, pa se naknadno može dokazati da logovi nisu mijenjani ni brisani (`aws cloudtrail validate-logs`). U organizaciji bi to bio **organization trail** iz management ili delegated admin naloga.

<!-- verify
cd /root/infra && checkov -f main.tf --compact --quiet --check CKV_AWS_36,CKV_AWS_67 >/tmp/c.out 2>&1 || { grep -E 'Check:|FAILED' /tmp/c.out | head -5; exit 1; }
-->
<!-- solution
cd /root/infra && sed -i 's/is_multi_region_trail      = false/is_multi_region_trail      = true/; s/enable_log_file_validation = false/enable_log_file_validation = true/' main.tf
-->

## Gate za pipeline

Napravi `/root/infra/ci-gate.sh`: skriptu koju pipeline (GitHub Actions, CodePipeline/CodeBuild) pokreće prije `terraform plan`. Mora:

1. pokrenuti Checkov samo sa obaveznim provjerama iz `.obavezne-provjere`,
2. vratiti izlazni kod različit od nule ako ijedna padne. Checkov to radi sam, pa skripta ne smije progutati grešku (bez `|| true`).

```bash
cat > /root/infra/ci-gate.sh <<'EOF'
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
checkov -d . --framework terraform --compact --quiet --check "$(cat .obavezne-provjere)"
EOF
chmod +x /root/infra/ci-gate.sh
/root/infra/ci-gate.sh && echo "GATE: PROLAZ"
```

Za CloudFormation bi isti gate koristio `cfn-lint` (ispravnost šablona) i `cfn-guard validate` (pravila organizacije), a centralno se pravila mogu nametnuti i **CloudFormation Hooks**-ima, prije nego što se resurs uopšte kreira.

<!-- verify
f=/root/infra/ci-gate.sh
[ -x $f ] || { echo "ci-gate.sh ne postoji ili nije izvršan"; exit 1; }
grep -q '|| *true' $f && { echo "Gate ne smije gutati grešku (|| true)"; exit 1; }
$f >/dev/null 2>&1 || { echo "Gate pada nad trenutnim kodom"; exit 1; }
cp /root/infra/main.tf /tmp/main.tf.bak
sed -i 's/publicly_accessible = false/publicly_accessible = true/' /root/infra/main.tf
$f >/dev/null 2>&1; rc=$?
cp /tmp/main.tf.bak /root/infra/main.tf
[ $rc -ne 0 ] || { echo "Gate propušta javno dostupan RDS: mora pasti kad provjera ne prođe"; exit 1; }
-->
<!-- solution
printf '#!/bin/bash\nset -euo pipefail\ncd "$(dirname "$0")"\ncheckov -d . --framework terraform --compact --quiet --check "$(cat .obavezne-provjere)"\n' > /root/infra/ci-gate.sh && chmod +x /root/infra/ci-gate.sh
-->
