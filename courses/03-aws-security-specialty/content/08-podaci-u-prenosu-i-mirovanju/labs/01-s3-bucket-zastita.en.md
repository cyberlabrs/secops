# Lab 1: Protecting an S3 bucket with financial data

The bucket `primjer-finansije` (account `111122223333`) holds financial reports. The audit requires:

1. access only over **TLS**,
2. every upload encrypted with **SSE-KMS** using one specific key,
3. access only from the VPC through a **gateway VPC endpoint**, except for the admin role,
4. **WORM** protection: reports cannot be deleted or modified for 7 years, not even with the root account,
5. **lifecycle**: old data moves to cheaper storage.

You will write a bucket policy and test it with `iam-eval`, and prepare JSON configurations for Object Lock and lifecycle (as input for `aws s3api`).

| Value | |
|---|---|
| KMS key | `arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b` |
| VPC endpoint | `vpce-0a1b2c3d4e5f6a7b8` |
| application | `arn:aws:iam::111122223333:role/FinApp` |
| admin | `arn:aws:iam::111122223333:role/FinAdmin` |

<!-- setup
set -e
mkdir -p /root/s3 && cd /root/s3
cat > testovi.sh <<'EOF'
#!/bin/bash
# testovi bucket politike: ./testovi.sh
K=arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b
APP=arn:aws:iam::111122223333:role/FinApp
ADM=arn:aws:iam::111122223333:role/FinAdmin
OBJ=arn:aws:s3:::primjer-finansije/2026/q3.pdf
ok=0; bad=0
t() { want=$1; opis=$2; shift 2; out=$(iam-eval --resource-policy /root/s3/bucket-policy.json "$@" 2>&1); got=$(echo "$out" | head -1 | cut -d' ' -f1)
  if [ "$got" = "$want" ]; then ok=$((ok+1)); printf '  OK     %-5s %s\n' "$want" "$opis"; else bad=$((bad+1)); printf '  GREŠKA očekivano %s, dobijeno %s: %s\n         %s\n' "$want" "$got" "$opis" "$(echo "$out" | tail -1)"; fi; }
VPCE="--context aws:SourceVpce=vpce-0a1b2c3d4e5f6a7b8"
TLS="--context aws:SecureTransport=true"
t ALLOW "aplikacija čita preko endpointa i TLS-a"            --principal $APP --action s3:GetObject --resource $OBJ $VPCE $TLS
t DENY  "aplikacija čita bez TLS-a"                          --principal $APP --action s3:GetObject --resource $OBJ $VPCE --context aws:SecureTransport=false
t DENY  "aplikacija čita sa interneta (bez endpointa)"       --principal $APP --action s3:GetObject --resource $OBJ $TLS
t ALLOW "aplikacija upisuje sa ispravnim KMS ključem"        --principal $APP --action s3:PutObject --resource $OBJ $VPCE $TLS --context s3:x-amz-server-side-encryption=aws:kms --context s3:x-amz-server-side-encryption-aws-kms-key-id=$K
t DENY  "upload bez enkripcije"                              --principal $APP --action s3:PutObject --resource $OBJ $VPCE $TLS
t DENY  "upload sa SSE-S3 umjesto SSE-KMS"                   --principal $APP --action s3:PutObject --resource $OBJ $VPCE $TLS --context s3:x-amz-server-side-encryption=AES256
t DENY  "upload sa pogrešnim KMS ključem"                    --principal $APP --action s3:PutObject --resource $OBJ $VPCE $TLS --context s3:x-amz-server-side-encryption=aws:kms --context s3:x-amz-server-side-encryption-aws-kms-key-id=arn:aws:kms:eu-central-1:111122223333:key/drugi
t DENY  "aplikacija briše objekat"                           --principal $APP --action s3:DeleteObject --resource $OBJ $VPCE $TLS
t ALLOW "admin čita izvan VPC-a (preko TLS-a)"               --principal $ADM --action s3:GetObject --resource $OBJ $TLS
t DENY  "admin bez TLS-a"                                    --principal $ADM --action s3:GetObject --resource $OBJ --context aws:SecureTransport=false
t DENY  "drugi nalog"                                        --principal arn:aws:iam::999988887777:role/x --action s3:GetObject --resource $OBJ $VPCE $TLS
echo "  rezultat: $ok OK, $bad grešaka"; [ $bad -eq 0 ]
EOF
chmod 755 testovi.sh
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Zaštita S3 bucketa ===
Fajlovi: /root/s3/   Testovi politike: ./testovi.sh
EOF
-->

## Bucket policy: TLS and permissions

Start with two statements in `/root/s3/bucket-policy.json`:

1. **Deny** all `s3:*` actions on the bucket and objects when `aws:SecureTransport` = `false` (`Principal: "*"`),
2. **Allow** for `FinApp` (`s3:GetObject`, `s3:PutObject`) and `FinAdmin` (`s3:GetObject`) on the bucket's objects.

```bash
cd /root/s3
nano bucket-policy.json
./testovi.sh
```

Some tests will still fail. The next steps fix them. (The test script prints in Serbian: `GREŠKA očekivano … dobijeno …` means "ERROR expected … got …", and `rezultat` means "result".)

<!-- verify
cd /root/s3 && [ -f bucket-policy.json ] && jq . bucket-policy.json >/dev/null || { echo "bucket-policy.json does not exist or is not valid JSON"; exit 1; }
O=arn:aws:s3:::primjer-finansije/x
iam-eval --resource-policy bucket-policy.json --principal arn:aws:iam::111122223333:role/FinApp --action s3:GetObject --resource $O --context aws:SecureTransport=false >/dev/null && { echo "Access without TLS is allowed"; exit 1; }
iam-eval --resource-policy bucket-policy.json --principal arn:aws:iam::111122223333:role/FinApp --action s3:GetObject --resource $O --context aws:SecureTransport=true --context aws:SourceVpce=vpce-0a1b2c3d4e5f6a7b8 >/dev/null || { echo "FinApp cannot read over TLS"; exit 1; }
exit 0
-->
<!-- solution
cat > /root/s3/bucket-policy.json <<'EOF'
{"Version":"2012-10-17","Statement":[
{"Sid":"SamoTLS","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":["arn:aws:s3:::primjer-finansije","arn:aws:s3:::primjer-finansije/*"],"Condition":{"Bool":{"aws:SecureTransport":"false"}}},
{"Sid":"Aplikacija","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::111122223333:role/FinApp"},"Action":["s3:GetObject","s3:PutObject"],"Resource":"arn:aws:s3:::primjer-finansije/*"},
{"Sid":"Admin","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::111122223333:role/FinAdmin"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::primjer-finansije/*"}]}
EOF
-->

## Mandatory SSE-KMS with the exact key

Add a **Deny** for `s3:PutObject` when the `s3:x-amz-server-side-encryption-aws-kms-key-id` header is not equal to the key ARN (`StringNotEquals`). A negated operator is also true when the header **does not exist**, so one statement catches an upload without encryption, SSE-S3, and the wrong key.

> An alternative used in practice: bucket **default encryption** with SSE-KMS and an **S3 Bucket Key** (fewer KMS calls, lower cost). The exam likes questions that require **rejecting unencrypted uploads**, not just encrypting them by default. For that you need a bucket policy.

<!-- verify
cd /root/s3 && O=arn:aws:s3:::primjer-finansije/x; K=arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b
C="--principal arn:aws:iam::111122223333:role/FinApp --action s3:PutObject --resource $O --context aws:SecureTransport=true --context aws:SourceVpce=vpce-0a1b2c3d4e5f6a7b8"
iam-eval --resource-policy bucket-policy.json $C >/dev/null && { echo "Upload without encryption is allowed"; exit 1; }
iam-eval --resource-policy bucket-policy.json $C --context s3:x-amz-server-side-encryption-aws-kms-key-id=arn:aws:kms:eu-central-1:111122223333:key/drugi >/dev/null && { echo "Upload with the wrong key is allowed"; exit 1; }
iam-eval --resource-policy bucket-policy.json $C --context s3:x-amz-server-side-encryption=aws:kms --context s3:x-amz-server-side-encryption-aws-kms-key-id=$K >/dev/null || { echo "Upload with the correct key is denied"; exit 1; }
-->
<!-- solution
cd /root/s3 && jq '.Statement += [{"Sid":"SamoNasKMSKljuc","Effect":"Deny","Principal":"*","Action":"s3:PutObject","Resource":"arn:aws:s3:::primjer-finansije/*","Condition":{"StringNotEquals":{"s3:x-amz-server-side-encryption-aws-kms-key-id":"arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b"}}}]' bucket-policy.json > p.tmp && mv p.tmp bucket-policy.json
-->

## Only through the VPC endpoint, except the admin

Add a **Deny** for all `s3:*` actions when the request does **not** come through `vpce-0a1b2c3d4e5f6a7b8` (`StringNotEquals` on `aws:SourceVpce`), except when the principal is `FinAdmin` (`ArnNotEquals` or `ArnNotLike` on `aws:PrincipalArn`). Both conditions in the same `Condition` block must be true for the Deny to apply.

```bash
./testovi.sh
```

All tests must pass now.

> Why `aws:SourceVpce` and not `aws:SourceIp`? Through a VPC endpoint the request carries a private address and the endpoint ID, and `aws:SourceIp` is then not reliable for private addresses. Also be careful that a Deny without an exception can lock out **everyone**, including you in the console: in that case only the account's root user can fix the bucket policy.

<!-- verify
cd /root/s3 && ./testovi.sh >/tmp/t.out 2>&1 || { grep -A1 GREŠKA /tmp/t.out | head -8; exit 1; }
-->
<!-- hint
```json
{ "Sid": "OnlyThroughEndpoint", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
  "Resource": ["arn:aws:s3:::primjer-finansije", "arn:aws:s3:::primjer-finansije/*"],
  "Condition": {
    "StringNotEquals": { "aws:SourceVpce": "vpce-0a1b2c3d4e5f6a7b8" },
    "ArnNotEquals": { "aws:PrincipalArn": "arn:aws:iam::111122223333:role/FinAdmin" } } }
```
-->
<!-- solution
cd /root/s3 && jq '.Statement += [{"Sid":"SamoKrozEndpoint","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":["arn:aws:s3:::primjer-finansije","arn:aws:s3:::primjer-finansije/*"],"Condition":{"StringNotEquals":{"aws:SourceVpce":"vpce-0a1b2c3d4e5f6a7b8"},"ArnNotEquals":{"aws:PrincipalArn":"arn:aws:iam::111122223333:role/FinAdmin"}}}]' bucket-policy.json > p.tmp && mv p.tmp bucket-policy.json
-->

## Object Lock: WORM for 7 years

Create `/root/s3/object-lock.json`, the input for `aws s3api put-object-lock-configuration --bucket primjer-finansije --object-lock-configuration file://object-lock.json`:

- Object Lock enabled,
- default retention in **COMPLIANCE** mode, **7 years**.

| Mode | Who can shorten or remove the protection |
|---|---|
| **Governance** | users with `s3:BypassGovernanceRetention` |
| **Compliance** | **nobody**, not even root, until the retention expires |
| **Legal hold** | no end date; lasts until removed (`s3:PutObjectLegalHold`) |

Object Lock requires **versioning** to be enabled.

<!-- verify
f=/root/s3/object-lock.json
jq -e '.ObjectLockEnabled == "Enabled"' $f >/dev/null 2>&1 || { echo "ObjectLockEnabled must be \"Enabled\""; exit 1; }
jq -e '.Rule.DefaultRetention.Mode == "COMPLIANCE"' $f >/dev/null || { echo "The mode must be COMPLIANCE"; exit 1; }
jq -e '(.Rule.DefaultRetention.Years == 7) or (.Rule.DefaultRetention.Days == 2557) or (.Rule.DefaultRetention.Days == 2555)' $f >/dev/null || { echo "The retention must be 7 years (Years: 7)"; exit 1; }
jq -e '.Rule.DefaultRetention | has("Years") and has("Days") | not' $f >/dev/null || { echo "Specify either Years or Days, not both"; exit 1; }
-->
<!-- hint
```json
{ "ObjectLockEnabled": "Enabled",
  "Rule": { "DefaultRetention": { "Mode": "COMPLIANCE", "Years": 7 } } }
```
-->
<!-- solution
echo '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Years":7}}}' > /root/s3/object-lock.json
-->

## Lifecycle rule

Create `/root/s3/lifecycle.json`, the input for `aws s3api put-bucket-lifecycle-configuration`, with one rule (`Status: Enabled`) for the entire bucket (`Filter` with an empty prefix):

- after **90 days** objects move to `GLACIER_IR` (Glacier Instant Retrieval),
- after **365 days** to `DEEP_ARCHIVE`,
- **noncurrent versions** (created by versioning) are deleted 30 days after they stop being current. Object Lock protects them anyway for the duration of the retention.

<!-- verify
f=/root/s3/lifecycle.json
jq -e '.Rules | length >= 1' $f >/dev/null 2>&1 || { echo "There is no Rules array"; exit 1; }
r='.Rules[0]'
jq -e "$r.Status == \"Enabled\"" $f >/dev/null || { echo "Status must be Enabled"; exit 1; }
jq -e "[$r.Transitions[] | select(.Days == 90 and .StorageClass == \"GLACIER_IR\")] | length == 1" $f >/dev/null || { echo "The transition to GLACIER_IR after 90 days is missing"; exit 1; }
jq -e "[$r.Transitions[] | select(.Days == 365 and .StorageClass == \"DEEP_ARCHIVE\")] | length == 1" $f >/dev/null || { echo "The transition to DEEP_ARCHIVE after 365 days is missing"; exit 1; }
jq -e "$r.NoncurrentVersionExpiration.NoncurrentDays == 30" $f >/dev/null || { echo "NoncurrentVersionExpiration of 30 days is missing"; exit 1; }
jq -e "$r | has(\"Filter\")" $f >/dev/null || { echo "The rule needs a Filter (e.g., {\"Prefix\": \"\"})"; exit 1; }
-->
<!-- hint
```json
{ "Rules": [ {
    "ID": "archiving", "Status": "Enabled", "Filter": { "Prefix": "" },
    "Transitions": [ { "Days": 90, "StorageClass": "GLACIER_IR" }, { "Days": 365, "StorageClass": "DEEP_ARCHIVE" } ],
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 } } ] }
```
-->
<!-- solution
echo '{"Rules":[{"ID":"arhiviranje","Status":"Enabled","Filter":{"Prefix":""},"Transitions":[{"Days":90,"StorageClass":"GLACIER_IR"},{"Days":365,"StorageClass":"DEEP_ARCHIVE"}],"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}' > /root/s3/lifecycle.json
-->
