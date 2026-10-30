# Lab 1: Least privilege politike, boundary, SCP i trust

Napisaćeš četiri vrste politika koje ispit stalno provjerava i testirati ih alatom `iam-eval`. To je pojednostavljeni offline simulator: radi kao **IAM Policy Simulator** i prati logiku evaluacije (explicit deny, SCP, permission boundary, identity/resource politike). Za provjeru sintakse i rizičnih obrazaca koristiš `parliament`, linter za IAM politike, sličan **IAM Access Analyzer policy validation**.

Nalog je `111122223333`, regija `eu-central-1`. Sve je u `/root/iam/`.

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

## Polazna politika: sve je dozvoljeno

Lambda funkcija `izvjestaji` ima politiku sa `s3:*`, `dynamodb:*` i `logs:*` na `"*"`. Pokreni testove i linter:

```bash
cd /root/iam
cat lambda-policy.json
./testovi.sh lambda
parliament --file lambda-policy.json
```

Polovina testova pada: politika dozvoljava i ono što funkcija nikad ne radi, na primjer brisanje tabela i čitanje plata.

## Least privilege za Lambda funkciju

Prepiši `lambda-policy.json` tako da funkcija smije **samo**:

| Šta | Akcije | Resurs |
|---|---|---|
| čitati ulazne fajlove | `s3:GetObject` | objekti pod `uploads/` u bucketu `primjer-ulaz` |
| upisivati rezultate | `dynamodb:PutItem`, `dynamodb:UpdateItem` | tabela `Izvjestaji` u `eu-central-1` |
| pisati logove | `logs:CreateLogStream`, `logs:PutLogEvents` | log grupa `/aws/lambda/izvjestaji` i njeni streamovi |

```bash
nano lambda-policy.json
./testovi.sh lambda
parliament --file lambda-policy.json
```

ARN formati: `arn:aws:s3:::bucket/prefiks/*`, `arn:aws:dynamodb:regija:nalog:table/Ime`, `arn:aws:logs:regija:nalog:log-group:IME:*`.

<!-- verify
cd /root/iam
./testovi.sh lambda >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -8; exit 1; }
jq -e '[.Statement[] | (.Action | if type=="array" then .[] else . end)] | map(select(test("\\*"))) | length == 0' lambda-policy.json >/dev/null || { echo "Politika i dalje ima akcije sa wildcardom (*)"; exit 1; }
jq -e '[.Statement[] | (.Resource | if type=="array" then .[] else . end)] | map(select(. == "*")) | length == 0' lambda-policy.json >/dev/null || { echo "Politika ima Resource \"*\""; exit 1; }
/opt/tools/bin/python -c "
import parliament,sys
f=[x for x in parliament.analyze_policy_string(open('lambda-policy.json').read()).findings if x.severity in ('CRITICAL','HIGH','MEDIUM')]
print('\n'.join(x.issue for x in f)); sys.exit(1 if f else 0)" || { echo "parliament prijavljuje probleme"; exit 1; }
-->
<!-- hint
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "CitajUlaz", "Effect": "Allow", "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::primjer-ulaz/uploads/*" },
    { "Sid": "PisiRezultate", "Effect": "Allow", "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji" },
    { "Sid": "Logovi", "Effect": "Allow", "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:eu-central-1:111122223333:log-group:/aws/lambda/izvjestaji:*" }
  ]
}
```
U praksi bi polaznu verziju generisao **IAM Access Analyzer policy generation** iz CloudTrail aktivnosti funkcije, pa je suzio.
-->
<!-- solution
cat > /root/iam/lambda-policy.json <<'EOF'
{"Version":"2012-10-17","Statement":[
{"Sid":"CitajUlaz","Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::primjer-ulaz/uploads/*"},
{"Sid":"PisiRezultate","Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:UpdateItem"],"Resource":"arn:aws:dynamodb:eu-central-1:111122223333:table/Izvjestaji"},
{"Sid":"Logovi","Effect":"Allow","Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:eu-central-1:111122223333:log-group:/aws/lambda/izvjestaji:*"}]}
EOF
-->

## Permission boundary za developere

Developeri imaju široka prava u dev nalogu, ali boundary postavlja **gornju granicu** onoga što bilo koja njihova politika može dati. Efektivna prava su **presjek** identity politike i boundaryja.

Napravi `dev-boundary.json` koji:

- dozvoljava `s3:*`, `dynamodb:*`, `lambda:*`, `logs:*` i `cloudwatch:*`,
- eksplicitno **zabranjuje** brisanje ili promjenu boundaryja (`iam:DeleteRolePermissionsBoundary`, `iam:DeleteUserPermissionsBoundary`, `iam:PutRolePermissionsBoundary`, `iam:PutUserPermissionsBoundary`), da developer ne bi mogao sam sebi ukloniti ograničenje.

Sve ostalo (`iam:CreateUser`, `ec2:*`, `organizations:*`) ostaje implicitno zabranjeno, iako identity politika (`admin.json`) dozvoljava `*`.

```bash
nano dev-boundary.json
./testovi.sh boundary
```

<!-- verify
cd /root/iam && ./testovi.sh boundary >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -8; exit 1; }
jq -e '[.Statement[] | select(.Effect=="Deny")] | length > 0' dev-boundary.json >/dev/null || { echo "Boundary treba eksplicitni Deny za brisanje/izmjenu boundaryja"; exit 1; }
-->
<!-- hint
Dvije izjave: `Allow` sa listom servisa (`"s3:*", "dynamodb:*", …`) na `"*"` i `Deny` sa četiri `iam:*PermissionsBoundary` akcije na `"*"`. Zašto je Deny potreban kad ionako nema Allow za `iam:*`? Zato što se boundary često kombinuje sa šire napisanim Allow izjavama, a eksplicitni Deny ostaje važeći bez obzira na njih.
-->
<!-- solution
cat > /root/iam/dev-boundary.json <<'EOF'
{"Version":"2012-10-17","Statement":[
{"Sid":"DozvoljeniServisi","Effect":"Allow","Action":["s3:*","dynamodb:*","lambda:*","logs:*","cloudwatch:*"],"Resource":"*"},
{"Sid":"ZastitiBoundary","Effect":"Deny","Action":["iam:DeleteRolePermissionsBoundary","iam:DeleteUserPermissionsBoundary","iam:PutRolePermissionsBoundary","iam:PutUserPermissionsBoundary"],"Resource":"*"}]}
EOF
-->

## SCP za cijelu organizaciju

Napiši `scp.json` koji se kači na OU sa workload nalozima:

1. dozvoljava sve (`FullAWSAccess` ekvivalent: Allow `*` na `*`), jer SCP samo **ograničava** i ne daje prava,
2. zabranjuje sve regije osim `eu-central-1` i `eu-west-1` za sve akcije **osim** globalnih servisa (`iam:*`, `sts:*`, `organizations:*`, `route53:*`, `cloudfront:*`, `support:*`),
3. zabranjuje `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `cloudtrail:UpdateTrail` i `guardduty:DeleteDetector`,
4. zabranjuje `organizations:LeaveOrganization`,
5. pravila 2 i 3 **ne važe** za ulogu `BreakGlass` (uslov `ArnNotLike` na `aws:PrincipalArn` sa `arn:aws:iam::*:role/BreakGlass`).

```bash
nano scp.json
./testovi.sh scp
```

<!-- verify
cd /root/iam && ./testovi.sh scp >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -10; exit 1; }
jq -e '[.Statement[] | select(.Effect=="Deny" and .NotAction != null)] | length > 0' scp.json >/dev/null || { echo "Ograničenje regija treba NotAction za globalne servise"; exit 1; }
-->
<!-- hint
Ograničenje regija:

    { "Sid": "SamoEURegije", "Effect": "Deny",
      "NotAction": ["iam:*", "sts:*", "organizations:*", "route53:*", "cloudfront:*", "support:*"],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": { "aws:RequestedRegion": ["eu-central-1", "eu-west-1"] },
        "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/BreakGlass" } } }

Svi uslovi u jednom bloku moraju biti tačni (AND), pa Deny ne važi kad je principal BreakGlass. Ne zaboravi i izjavu Allow `*`, inače SCP ništa ne dozvoljava.
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

## Trust politika za vanjskog dobavljača

Dobavljač sigurnosnog skenera (nalog `444455556666`) treba preuzeti ulogu `VendorAudit` u tvom nalogu. Da bi se spriječio **confused deputy** napad (drugi klijent istog dobavljača navodi tvoj ARN), dobavljač mora poslati dogovoreni **External ID** `kurs-7f3a91`.

Napiši `trust.json`: Allow `sts:AssumeRole` za principal `arn:aws:iam::444455556666:root`, uz uslov `StringEquals` na `sts:ExternalId`.

```bash
nano trust.json
./testovi.sh trust
```

<!-- verify
cd /root/iam && ./testovi.sh trust >/tmp/t.out 2>&1 || { grep GREŠKA -A1 /tmp/t.out | head -8; exit 1; }
jq -e '.Statement[] | select(.Effect=="Allow") | .Principal.AWS' trust.json >/dev/null || { echo "Trust politika treba Principal.AWS"; exit 1; }
-->
<!-- solution
cat > /root/iam/trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::444455556666:root"},"Action":"sts:AssumeRole","Condition":{"StringEquals":{"sts:ExternalId":"kurs-7f3a91"}}}]}
EOF
-->
