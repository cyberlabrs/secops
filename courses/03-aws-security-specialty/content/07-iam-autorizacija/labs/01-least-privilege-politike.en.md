# Lab 1: Least privilege policies, boundary, SCP, and trust

You will write four kinds of policies that the exam tests constantly and test them with the `iam-eval` tool. It is a simplified offline simulator: it works like the **IAM Policy Simulator** and follows the evaluation logic (explicit deny, SCP, permissions boundary, identity/resource policies). To check syntax and risky patterns you use `parliament`, a linter for IAM policies, similar to **IAM Access Analyzer policy validation**.

The account is `111122223333`, the Region is `eu-central-1`. Everything is in `/root/iam/`.

```bash
iam-eval --help
```

<!-- setup
set -e
mkdir -p /root/iam && cd /root/iam
cat > lambda-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:*", "dynamodb:*", "logs:*"], "Resource": "*" }
  ]
}
EOF
cat > admin.json <<'EOF'
{ "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Action": "*", "Resource": "*" } ] }
EOF
cat > testovi.sh <<'EOF'
#!/bin/bash
# testovi.sh <lambda|boundary|scp|trust>: pokreće iam-eval nad scenarijima i poredi sa očekivanim
P=arn:aws:iam::111122223333:role/izvjestaji-lambda
ok=0; bad=0
t() { want=$1; shift; out=$(iam-eval "$@" 2>&1); got=$(echo "$out" | head -1 | cut -d' ' -f1)
  if [ "$got" = "$want" ]; then ok=$((ok+1)); printf '  OK    %-5s %s\n' "$want" "$(echo "$out" | head -1 | cut -d' ' -f3-)";
  else bad=$((bad+1)); printf '  GREŠKA očekivano %s, dobijeno %s: %s\n' "$want" "$got" "$(echo "$out" | head -1 | cut -d' ' -f3-)"; echo "$out" | tail -1; fi; }
L="--identity /root/iam/lambda-policy.json --principal $P"
case "$1" in
lambda)
  t ALLOW $L --action s3:GetObject --resource arn:aws:s3:::primjer-ulaz/uploads/2026/a.csv
  t DENY  $L --action s3:GetObject --resource arn:aws:s3:::primjer-ulaz/privatno/plate.csv
  t DENY  $L --action s3:PutObject --resource arn:aws:s3:::primjer-ulaz/uploads/a.csv
  t DENY  $L --action s3:GetObject --resource arn:aws:s3:::drugi-bucket/uploads/a.csv
  t ALLOW $L --action dynamodb:PutItem --resource arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji
  t ALLOW $L --action dynamodb:UpdateItem --resource arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji
  t DENY  $L --action dynamodb:DeleteTable --resource arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji
  t DENY  $L --action dynamodb:Scan --resource arn:aws:dynamodb:eu-central-1:111122223333:table/Korisnici
  t ALLOW $L --action logs:PutLogEvents --resource arn:aws:logs:eu-central-1:111122223333:log-group:/aws/lambda/izvjestaji:log-stream:2026/10/14/abc
  t DENY  $L --action logs:DeleteLogGroup --resource arn:aws:logs:eu-central-1:111122223333:log-group:/aws/lambda/izvjestaji
  ;;
boundary)
  B="--identity /root/iam/admin.json --boundary /root/iam/dev-boundary.json --principal arn:aws:iam::111122223333:role/dev-ana"
  t ALLOW $B --action s3:GetObject --resource arn:aws:s3:::dev-ana-bucket/x
  t ALLOW $B --action lambda:CreateFunction --resource arn:aws:lambda:eu-central-1:111122223333:function:test
  t ALLOW $B --action dynamodb:Query --resource arn:aws:dynamodb:eu-central-1:111122223333:table/Dev
  t DENY  $B --action iam:CreateUser --resource arn:aws:iam::111122223333:user/novi
  t DENY  $B --action iam:DeleteRolePermissionsBoundary --resource arn:aws:iam::111122223333:role/dev-ana
  t DENY  $B --action ec2:RunInstances --resource '*'
  t DENY  $B --action organizations:LeaveOrganization --resource '*'
  ;;
scp)
  S="--identity /root/iam/admin.json --scp /root/iam/scp.json --principal arn:aws:iam::111122223333:role/dev-ana"
  BG="--identity /root/iam/admin.json --scp /root/iam/scp.json --principal arn:aws:iam::111122223333:role/BreakGlass"
  t ALLOW $S --action ec2:RunInstances --resource '*' --context aws:RequestedRegion=eu-central-1
  t ALLOW $S --action s3:PutObject --resource arn:aws:s3:::b/k --context aws:RequestedRegion=eu-west-1
  t DENY  $S --action ec2:RunInstances --resource '*' --context aws:RequestedRegion=us-east-1
  t ALLOW $S --action iam:CreateRole --resource '*' --context aws:RequestedRegion=us-east-1
  t ALLOW $S --action sts:AssumeRole --resource '*' --context aws:RequestedRegion=us-east-1
  t DENY  $S --action cloudtrail:StopLogging --resource '*' --context aws:RequestedRegion=eu-central-1
  t DENY  $S --action cloudtrail:DeleteTrail --resource '*' --context aws:RequestedRegion=eu-central-1
  t DENY  $S --action guardduty:DeleteDetector --resource '*' --context aws:RequestedRegion=eu-central-1
  t DENY  $S --action organizations:LeaveOrganization --resource '*' --context aws:RequestedRegion=us-east-1
  t ALLOW $BG --action cloudtrail:StopLogging --resource '*' --context aws:RequestedRegion=eu-central-1
  ;;
trust)
  T="--resource-policy /root/iam/trust.json --action sts:AssumeRole --resource arn:aws:iam::111122223333:role/VendorAudit"
  t ALLOW $T --principal arn:aws:iam::444455556666:role/scanner --context sts:ExternalId=kurs-7f3a91
  t DENY  $T --principal arn:aws:iam::444455556666:role/scanner --context sts:ExternalId=pogresan
  t DENY  $T --principal arn:aws:iam::444455556666:role/scanner
  t DENY  $T --principal arn:aws:iam::999988887777:role/scanner --context sts:ExternalId=kurs-7f3a91
  ;;
esac
echo "  rezultat: $ok OK, $bad grešaka"
[ $bad -eq 0 ]
EOF
chmod 755 testovi.sh
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: IAM politike ===
Fajlovi: /root/iam/   Testovi: ./testovi.sh lambda|boundary|scp|trust   Lint: parliament --file X.json
EOF
-->

## Starting policy: everything is allowed

The Lambda function `izvjestaji` has a policy with `s3:*`, `dynamodb:*`, and `logs:*` on `"*"`. Run the tests and the linter:

```bash
cd /root/iam
cat lambda-policy.json
./testovi.sh lambda
parliament --file lambda-policy.json
```

Half of the tests fail: the policy also allows things the function never does, for example deleting tables and reading payroll data. (The test script prints its results in Serbian: `GREŠKA očekivano … dobijeno …` means "ERROR expected … got …", and `rezultat` means "result".)

## Least privilege for the Lambda function

Rewrite `lambda-policy.json` so that the function may **only**:

| What | Actions | Resource |
|---|---|---|
| read input files | `s3:GetObject` | objects under `uploads/` in the `primjer-ulaz` bucket |
| write results | `dynamodb:PutItem`, `dynamodb:UpdateItem` | the `Izvjestaji` table in `eu-central-1` |
| write logs | `logs:CreateLogStream`, `logs:PutLogEvents` | the `/aws/lambda/izvjestaji` log group and its streams |

```bash
nano lambda-policy.json
./testovi.sh lambda
parliament --file lambda-policy.json
```

ARN formats: `arn:aws:s3:::bucket/prefix/*`, `arn:aws:dynamodb:region:account:table/Name`, `arn:aws:logs:region:account:log-group:NAME:*`.

<!-- verify
cd /root/iam
./testovi.sh lambda >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -8; exit 1; }
jq -e '[.Statement[] | (.Action | if type=="array" then .[] else . end)] | map(select(test("\\*"))) | length == 0' lambda-policy.json >/dev/null || { echo "The policy still has actions with a wildcard (*)"; exit 1; }
jq -e '[.Statement[] | (.Resource | if type=="array" then .[] else . end)] | map(select(. == "*")) | length == 0' lambda-policy.json >/dev/null || { echo "The policy has Resource \"*\""; exit 1; }
/opt/tools/bin/python -c "
import parliament,sys
f=[x for x in parliament.analyze_policy_string(open('lambda-policy.json').read()).findings if x.severity in ('CRITICAL','HIGH','MEDIUM')]
print('\n'.join(x.issue for x in f)); sys.exit(1 if f else 0)" || { echo "parliament reports problems"; exit 1; }
-->
<!-- hint
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "ReadInput", "Effect": "Allow", "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::primjer-ulaz/uploads/*" },
    { "Sid": "WriteResults", "Effect": "Allow", "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji" },
    { "Sid": "Logs", "Effect": "Allow", "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:eu-central-1:111122223333:log-group:/aws/lambda/izvjestaji:*" }
  ]
}
```
In practice you would generate the starting version with **IAM Access Analyzer policy generation** from the function's CloudTrail activity, and then narrow it down.
-->
<!-- solution
cat > /root/iam/lambda-policy.json <<'EOF'
{"Version":"2012-10-17","Statement":[
{"Sid":"CitajUlaz","Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::primjer-ulaz/uploads/*"},
{"Sid":"PisiRezultate","Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:UpdateItem"],"Resource":"arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji"},
{"Sid":"Logovi","Effect":"Allow","Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:eu-central-1:111122223333:log-group:/aws/lambda/izvjestaji:*"}]}
EOF
-->

## Permissions boundary for developers

Developers have broad rights in the dev account, but the boundary sets an **upper limit** on what any of their policies can grant. The effective rights are the **intersection** of the identity policy and the boundary.

Create `dev-boundary.json` that:

- allows `s3:*`, `dynamodb:*`, `lambda:*`, `logs:*`, and `cloudwatch:*`,
- explicitly **denies** deleting or changing the boundary (`iam:DeleteRolePermissionsBoundary`, `iam:DeleteUserPermissionsBoundary`, `iam:PutRolePermissionsBoundary`, `iam:PutUserPermissionsBoundary`), so that a developer cannot remove the restriction from themselves.

Everything else (`iam:CreateUser`, `ec2:*`, `organizations:*`) remains implicitly denied, even though the identity policy (`admin.json`) allows `*`.

```bash
nano dev-boundary.json
./testovi.sh boundary
```

<!-- verify
cd /root/iam && ./testovi.sh boundary >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -8; exit 1; }
jq -e '[.Statement[] | select(.Effect=="Deny")] | length > 0' dev-boundary.json >/dev/null || { echo "The boundary needs an explicit Deny for deleting/changing the boundary"; exit 1; }
-->
<!-- hint
Two statements: an `Allow` with the list of services (`"s3:*", "dynamodb:*", …`) on `"*"` and a `Deny` with the four `iam:*PermissionsBoundary` actions on `"*"`. Why is the Deny needed when there is no Allow for `iam:*` anyway? Because a boundary is often combined with more broadly written Allow statements, and an explicit Deny stays in effect regardless of them.
-->
<!-- solution
cat > /root/iam/dev-boundary.json <<'EOF'
{"Version":"2012-10-17","Statement":[
{"Sid":"DozvoljeniServisi","Effect":"Allow","Action":["s3:*","dynamodb:*","lambda:*","logs:*","cloudwatch:*"],"Resource":"*"},
{"Sid":"ZastitiBoundary","Effect":"Deny","Action":["iam:DeleteRolePermissionsBoundary","iam:DeleteUserPermissionsBoundary","iam:PutRolePermissionsBoundary","iam:PutUserPermissionsBoundary"],"Resource":"*"}]}
EOF
-->

## SCP for the entire organization

Write `scp.json` to be attached to the OU with workload accounts:

1. allows everything (the `FullAWSAccess` equivalent: Allow `*` on `*`), because an SCP only **limits** and does not grant rights,
2. denies all Regions except `eu-central-1` and `eu-west-1` for all actions **except** global services (`iam:*`, `sts:*`, `organizations:*`, `route53:*`, `cloudfront:*`, `support:*`),
3. denies `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `cloudtrail:UpdateTrail`, and `guardduty:DeleteDetector`,
4. denies `organizations:LeaveOrganization`,
5. rules 2 and 3 **do not apply** to the `BreakGlass` role (an `ArnNotLike` condition on `aws:PrincipalArn` with `arn:aws:iam::*:role/BreakGlass`).

```bash
nano scp.json
./testovi.sh scp
```

<!-- verify
cd /root/iam && ./testovi.sh scp >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -10; exit 1; }
jq -e '[.Statement[] | select(.Effect=="Deny" and .NotAction != null)] | length > 0' scp.json >/dev/null || { echo "The Region restriction needs NotAction for global services"; exit 1; }
-->
<!-- hint
The Region restriction:

    { "Sid": "OnlyEURegions", "Effect": "Deny",
      "NotAction": ["iam:*", "sts:*", "organizations:*", "route53:*", "cloudfront:*", "support:*"],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": { "aws:RequestedRegion": ["eu-central-1", "eu-west-1"] },
        "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/BreakGlass" } } }

All conditions in one block must be true (AND), so the Deny does not apply when the principal is BreakGlass. Do not forget the Allow `*` statement too, otherwise the SCP allows nothing.
-->
<!-- solution
cat > /root/iam/scp.json <<'EOF'
{"Version":"2012-10-17","Statement":[
{"Sid":"DozvoliSve","Effect":"Allow","Action":"*","Resource":"*"},
{"Sid":"SamoEURegije","Effect":"Deny","NotAction":["iam:*","sts:*","organizations:*","route53:*","cloudfront:*","support:*"],"Resource":"*",
 "Condition":{"StringNotEquals":{"aws:RequestedRegion":["eu-central-1","eu-west-1"]},"ArnNotLike":{"aws:PrincipalArn":"arn:aws:iam::*:role/BreakGlass"}}},
{"Sid":"ZastitiLogovanje","Effect":"Deny","Action":["cloudtrail:StopLogging","cloudtrail:DeleteTrail","cloudtrail:UpdateTrail","guardduty:DeleteDetector"],"Resource":"*",
 "Condition":{"ArnNotLike":{"aws:PrincipalArn":"arn:aws:iam::*:role/BreakGlass"}}},
{"Sid":"OstaniUOrganizaciji","Effect":"Deny","Action":"organizations:LeaveOrganization","Resource":"*"}]}
EOF
-->

## Trust policy for an external vendor

A security scanner vendor (account `444455556666`) needs to assume the `VendorAudit` role in your account. To prevent a **confused deputy** attack (another customer of the same vendor specifies your ARN), the vendor must send the agreed **External ID** `kurs-7f3a91`.

Write `trust.json`: Allow `sts:AssumeRole` for the principal `arn:aws:iam::444455556666:root`, with a `StringEquals` condition on `sts:ExternalId`.

```bash
nano trust.json
./testovi.sh trust
```

<!-- verify
cd /root/iam && ./testovi.sh trust >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -8; exit 1; }
jq -e '.Statement[] | select(.Effect=="Allow") | .Principal.AWS' trust.json >/dev/null || { echo "The trust policy needs Principal.AWS"; exit 1; }
-->
<!-- solution
cat > /root/iam/trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::444455556666:root"},"Action":"sts:AssumeRole","Condition":{"StringEquals":{"sts:ExternalId":"kurs-7f3a91"}}}]}
EOF
-->
