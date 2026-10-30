# Lab 1: Zaštita S3 bucketa sa finansijskim podacima

Bucket `primjer-finansije` (nalog `111122223333`) čuva finansijske izvještaje. Revizija traži:

1. pristup samo preko **TLS**-a,
2. svaki upload šifrovan **SSE-KMS** tačno određenim ključem,
3. pristup samo iz VPC-a preko **gateway VPC endpointa**, osim za admin ulogu,
4. **WORM** zaštitu: izvještaji se 7 godina ne mogu obrisati ni izmijeniti, čak ni sa root nalogom,
5. **lifecycle**: stari podaci prelaze u jeftiniji storage.

Napisaćeš bucket politiku i testirati je sa `iam-eval`, te pripremiti JSON konfiguracije za Object Lock i lifecycle (kao ulaz za `aws s3api`).

| Vrijednost | |
|---|---|
| KMS ključ | `arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b` |
| VPC endpoint | `vpce-0a1b2c3d4e5f6a7b8` |
| aplikacija | `arn:aws:iam::111122223333:role/FinApp` |
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

## Bucket politika: TLS i dozvole

Počni sa dvije izjave u `/root/s3/bucket-policy.json`:

1. **Deny** svih `s3:*` akcija na bucket i objekte kad je `aws:SecureTransport` = `false` (`Principal: "*"`),
2. **Allow** za `FinApp` (`s3:GetObject`, `s3:PutObject`) i `FinAdmin` (`s3:GetObject`) na objekte bucketa.

```bash
cd /root/s3
nano bucket-policy.json
./testovi.sh
```

Neki testovi će i dalje padati. To rješavaju naredni koraci.

<!-- verify
cd /root/s3 && [ -f bucket-policy.json ] && jq . bucket-policy.json >/dev/null || { echo "bucket-policy.json ne postoji ili nije validan JSON"; exit 1; }
O=arn:aws:s3:::primjer-finansije/x
iam-eval --resource-policy bucket-policy.json --principal arn:aws:iam::111122223333:role/FinApp --action s3:GetObject --resource $O --context aws:SecureTransport=false >/dev/null && { echo "Pristup bez TLS-a je dozvoljen"; exit 1; }
iam-eval --resource-policy bucket-policy.json --principal arn:aws:iam::111122223333:role/FinApp --action s3:GetObject --resource $O --context aws:SecureTransport=true --context aws:SourceVpce=vpce-0a1b2c3d4e5f6a7b8 >/dev/null || { echo "FinApp ne može čitati preko TLS-a"; exit 1; }
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

## Obavezan SSE-KMS sa tačnim ključem

Dodaj **Deny** za `s3:PutObject` kad zaglavlje `s3:x-amz-server-side-encryption-aws-kms-key-id` nije jednako ARN-u ključa (`StringNotEquals`). Negirani operator je tačan i kad zaglavlje **ne postoji**, pa jedna izjava hvata i upload bez enkripcije, i SSE-S3, i pogrešan ključ.

> Alternativa iz prakse: **default encryption** bucketa sa SSE-KMS i **S3 Bucket Key** (manje KMS poziva, niži trošak). Ispit voli pitanje koje traži da se **nešifrovani uploadi odbiju**, a ne samo da se šifruju podrazumijevano. Za to treba bucket politika.

<!-- verify
cd /root/s3 && O=arn:aws:s3:::primjer-finansije/x; K=arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b
C="--principal arn:aws:iam::111122223333:role/FinApp --action s3:PutObject --resource $O --context aws:SecureTransport=true --context aws:SourceVpce=vpce-0a1b2c3d4e5f6a7b8"
iam-eval --resource-policy bucket-policy.json $C >/dev/null && { echo "Upload bez enkripcije je dozvoljen"; exit 1; }
iam-eval --resource-policy bucket-policy.json $C --context s3:x-amz-server-side-encryption-aws-kms-key-id=arn:aws:kms:eu-central-1:111122223333:key/drugi >/dev/null && { echo "Upload sa pogrešnim ključem je dozvoljen"; exit 1; }
iam-eval --resource-policy bucket-policy.json $C --context s3:x-amz-server-side-encryption=aws:kms --context s3:x-amz-server-side-encryption-aws-kms-key-id=$K >/dev/null || { echo "Upload sa ispravnim ključem je odbijen"; exit 1; }
-->
<!-- solution
cd /root/s3 && jq '.Statement += [{"Sid":"SamoNasKMSKljuc","Effect":"Deny","Principal":"*","Action":"s3:PutObject","Resource":"arn:aws:s3:::primjer-finansije/*","Condition":{"StringNotEquals":{"s3:x-amz-server-side-encryption-aws-kms-key-id":"arn:aws:kms:eu-central-1:111122223333:key/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b"}}}]' bucket-policy.json > p.tmp && mv p.tmp bucket-policy.json
-->

## Samo preko VPC endpointa, osim admina

Dodaj **Deny** za sve `s3:*` akcije kada zahtjev **ne** dolazi kroz `vpce-0a1b2c3d4e5f6a7b8` (`StringNotEquals` na `aws:SourceVpce`), osim kad je principal `FinAdmin` (`ArnNotEquals` ili `ArnNotLike` na `aws:PrincipalArn`). Oba uslova u istom `Condition` bloku moraju biti tačna da bi Deny važio.

```bash
./testovi.sh
```

Sada moraju proći svi testovi.

> Zašto `aws:SourceVpce`, a ne `aws:SourceIp`? Kroz VPC endpoint zahtjev nosi privatnu adresu i ID endpointa, a `aws:SourceIp` tada nije pouzdan za privatne adrese. Pazi i da Deny bez izuzetka može zaključati **sve**, uključujući tebe u konzoli: bucket politiku tada može ispraviti samo root korisnik naloga.

<!-- verify
cd /root/s3 && ./testovi.sh >/tmp/t.out 2>&1 || { grep -A1 GREŠKA /tmp/t.out | head -8; exit 1; }
-->
<!-- hint
```json
{ "Sid": "SamoKrozEndpoint", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
  "Resource": ["arn:aws:s3:::primjer-finansije", "arn:aws:s3:::primjer-finansije/*"],
  "Condition": {
    "StringNotEquals": { "aws:SourceVpce": "vpce-0a1b2c3d4e5f6a7b8" },
    "ArnNotEquals": { "aws:PrincipalArn": "arn:aws:iam::111122223333:role/FinAdmin" } } }
```
-->
<!-- solution
cd /root/s3 && jq '.Statement += [{"Sid":"SamoKrozEndpoint","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":["arn:aws:s3:::primjer-finansije","arn:aws:s3:::primjer-finansije/*"],"Condition":{"StringNotEquals":{"aws:SourceVpce":"vpce-0a1b2c3d4e5f6a7b8"},"ArnNotEquals":{"aws:PrincipalArn":"arn:aws:iam::111122223333:role/FinAdmin"}}}]' bucket-policy.json > p.tmp && mv p.tmp bucket-policy.json
-->

## Object Lock: WORM na 7 godina

Napravi `/root/s3/object-lock.json`, ulaz za `aws s3api put-object-lock-configuration --bucket primjer-finansije --object-lock-configuration file://object-lock.json`:

- Object Lock uključen,
- podrazumijevana retencija u **COMPLIANCE** modu, **7 godina**.

| Mod | Ko može skratiti ili ukloniti zaštitu |
|---|---|
| **Governance** | korisnici sa `s3:BypassGovernanceRetention` |
| **Compliance** | **niko**, ni root, dok retencija ne istekne |
| **Legal hold** | nema roka; traje dok se ne skine (`s3:PutObjectLegalHold`) |

Object Lock traži uključen **versioning**.

<!-- verify
f=/root/s3/object-lock.json
jq -e '.ObjectLockEnabled == "Enabled"' $f >/dev/null 2>&1 || { echo "ObjectLockEnabled mora biti \"Enabled\""; exit 1; }
jq -e '.Rule.DefaultRetention.Mode == "COMPLIANCE"' $f >/dev/null || { echo "Mod mora biti COMPLIANCE"; exit 1; }
jq -e '(.Rule.DefaultRetention.Years == 7) or (.Rule.DefaultRetention.Days == 2557) or (.Rule.DefaultRetention.Days == 2555)' $f >/dev/null || { echo "Retencija mora biti 7 godina (Years: 7)"; exit 1; }
jq -e '.Rule.DefaultRetention | has("Years") and has("Days") | not' $f >/dev/null || { echo "Navedi ili Years ili Days, ne oba"; exit 1; }
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

## Lifecycle pravilo

Napravi `/root/s3/lifecycle.json`, ulaz za `aws s3api put-bucket-lifecycle-configuration`, sa jednim pravilom (`Status: Enabled`) za cijeli bucket (`Filter` sa praznim prefiksom):

- nakon **90 dana** objekti prelaze u `GLACIER_IR` (Glacier Instant Retrieval),
- nakon **365 dana** u `DEEP_ARCHIVE`,
- **nekurentne verzije** (nastale versioningom) brišu se 30 dana nakon što prestanu biti trenutne. Object Lock ih ionako štiti dok traje retencija.

<!-- verify
f=/root/s3/lifecycle.json
jq -e '.Rules | length >= 1' $f >/dev/null 2>&1 || { echo "Nema Rules niza"; exit 1; }
r='.Rules[0]'
jq -e "$r.Status == \"Enabled\"" $f >/dev/null || { echo "Status mora biti Enabled"; exit 1; }
jq -e "[$r.Transitions[] | select(.Days == 90 and .StorageClass == \"GLACIER_IR\")] | length == 1" $f >/dev/null || { echo "Nedostaje prelaz na GLACIER_IR nakon 90 dana"; exit 1; }
jq -e "[$r.Transitions[] | select(.Days == 365 and .StorageClass == \"DEEP_ARCHIVE\")] | length == 1" $f >/dev/null || { echo "Nedostaje prelaz na DEEP_ARCHIVE nakon 365 dana"; exit 1; }
jq -e "$r.NoncurrentVersionExpiration.NoncurrentDays == 30" $f >/dev/null || { echo "Nedostaje NoncurrentVersionExpiration od 30 dana"; exit 1; }
jq -e "$r | has(\"Filter\")" $f >/dev/null || { echo "Pravilo treba Filter (npr. {\"Prefix\": \"\"})"; exit 1; }
-->
<!-- hint
```json
{ "Rules": [ {
    "ID": "arhiviranje", "Status": "Enabled", "Filter": { "Prefix": "" },
    "Transitions": [ { "Days": 90, "StorageClass": "GLACIER_IR" }, { "Days": 365, "StorageClass": "DEEP_ARCHIVE" } ],
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 } } ] }
```
-->
<!-- solution
echo '{"Rules":[{"ID":"arhiviranje","Status":"Enabled","Filter":{"Prefix":""},"Transitions":[{"Days":90,"StorageClass":"GLACIER_IR"},{"Days":365,"StorageClass":"DEEP_ARCHIVE"}],"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}' > /root/s3/lifecycle.json
-->
