# Lab 1: Procurjeli AWS ključ, od git istorije do izvještaja

Ponedjeljak, 19. 10. 2026, 08:10. Dežurna analitičarka u SOC-u firme **Kvadrat d.o.o.** vidi GuardDuty nalaz `PenTest:IAMUser/KaliLinux` niske važnosti od 02:14 (UTC) za IAM korisnika `svc-izvjestaji`. Taj korisnik ima statični access ključ koji koristi noćni servis za izvještaje. Niko nije pokretao Kali Linux.

Imaš:

- `/root/izvjestaji-servis/`: git repo servisa (kopija sa internog GitLaba, projekat je greškom bio `public`),
- `/root/ci/`: logovi CI jobova tog projekta,
- `/root/cloudtrail/events.jsonl`: izvoz CloudTraila (management i S3 data events), jedan događaj po liniji, od 18. 10. 00:00 do 19. 10. 09:00 UTC.

Odgovore piši u `/root/odgovori/`, containment artefakte u `/root/obuzdavanje/`, detekciju u `/root/detekcije/`.

Poznati legitimni izvori:

| Izvor | Šta je |
|---|---|
| `192.0.2.50` | server izvještaja, jedini legitimni korisnik ključa `svc-izvjestaji` |
| `192.0.2.60` | Jenkins (`jenkins-legacy`) |
| `192.0.2.10` | kancelarija (SOC, konzola preko SSO-a) |
| `192.0.2.77` | Marko Petrović, VPN |
| `10.20.0.0/16` | VPC (aplikacije preko S3 VPC endpointa) |
| `config.amazonaws.com` | AWS Config |

```bash
cd /root
ls izvjestaji-servis ci cloudtrail
wc -l cloudtrail/events.jsonl
head -1 cloudtrail/events.jsonl | jq .
```

<!-- setup
set -e
S=/opt/scenariji/03-procurjela-tajna-aws
mkdir -p /root/odgovori /root/obuzdavanje /root/detekcije
cp -r $S/cloudtrail $S/ci /root/
$S/napravi-repo.sh /root/izvjestaji-servis
-->
<!-- timer
60
-->

## Odakle je ključ procurio

Ključ je obično u istoriji repoa, a ne u trenutnoj verziji koda. Skeniraj **cijelu istoriju** gitleaksom, pa potvrdi nalaz gitom:

```bash
cd /root/izvjestaji-servis
grep -rn AKIA .                     # trenutna verzija: samo primjer iz dokumentacije u testu
gitleaks git -v .                   # sva istorija
git log --oneline --stat
git log -p -S 'AKIA4' -- config/settings.py
gitleaks dir -v /root/ci            # i CI logovi su izvor curenja
```

Upiši:

- `/root/odgovori/kljuc.txt`: access key ID koji je procurio,
- `/root/odgovori/commit.txt`: hash commita koji je **uveo** ključ (pun ili bar 7 znakova),
- `/root/odgovori/ci-job.txt`: broj CI joba čiji je log ispisao ključ.

<!-- verify
O=/root/odgovori
grep -qx 'AKIA4NQXR7ZK2LWB5HTM' $O/kljuc.txt 2>/dev/null || { echo "kljuc.txt: upiši access key ID (AKIA...) koji gitleaks nalazi u istoriji"; exit 1; }
full=$(git -C /root/izvjestaji-servis log --reverse -S AKIA4NQXR7ZK2LWB5HTM --format=%H | head -1)
c=$(head -1 $O/commit.txt 2>/dev/null | awk '{print $1}' | tr -d '\r')
[ ${#c} -ge 7 ] && [ "${full#"$c"}" != "$full" ] || { echo "commit.txt: treba hash commita koji je dodao ključ (ne onog koji ga je uklonio)"; exit 1; }
grep -qx '4812' $O/ci-job.txt 2>/dev/null || { echo "ci-job.txt: upiši samo broj joba (iz imena loga ili zaglavlja)"; exit 1; }
-->
<!-- hint
`gitleaks git -v .` za svaki nalaz ispisuje `Commit`, `File` i `Line`. `AKIAIOSFODNN7EXAMPLE` u testu je primjer iz AWS dokumentacije i gitleaks ga namjerno ignoriše. Commit koji je ključ uklonio (`git log -S` ga takođe prikaže) nije odgovor: tražiš prvi, `git log --reverse -S AKIA4NQXR7ZK2LWB5HTM --format=%H | head -1`.
-->
<!-- solution
cd /root/izvjestaji-servis
echo AKIA4NQXR7ZK2LWB5HTM > /root/odgovori/kljuc.txt
git log --reverse -S AKIA4NQXR7ZK2LWB5HTM --format=%H | head -1 > /root/odgovori/commit.txt
echo 4812 > /root/odgovori/ci-job.txt
-->

## Šta je urađeno ukradenim ključem

Prvo pogledaj ko sve koristi ključ, sa kojih adresa i kojim alatom:

```bash
cd /root/cloudtrail
K=AKIA4NQXR7ZK2LWB5HTM
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k) | [.sourceIPAddress, .userAgent[0:60]] | @tsv' events.jsonl | sort | uniq -c
```

Server izvještaja koristi Boto3 sa `192.0.2.50`. Sve ostalo je napadač. Napravi `/root/odgovori/kljuc-napadac.tsv`: svi događaji sa ključem `AKIA4NQXR7ZK2LWB5HTM` čiji `sourceIPAddress` nije `192.0.2.50`, hronološki, sa četiri kolone odvojene tabom: `eventTime`, `sourceIPAddress`, `eventName`, `errorCode` (ili `OK` kad greške nema).

```bash
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k and .sourceIPAddress!="192.0.2.50")
  | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' events.jsonl
```

Primijeti obrazac: `GetCallerIdentity` (ko sam?), pa enumeracija (`ListUsers`, `GetAccountAuthorizationDetails`), pa niz `AccessDenied` grešaka (napadač isprobava granice ključa), pa iznenada uspjeh tamo gdje je ranije bio odbijen.

<!-- verify
f=/root/odgovori/kljuc-napadac.tsv
[ -s $f ] || { echo "nema $f"; exit 1; }
jq -r 'select(.userIdentity.accessKeyId=="AKIA4NQXR7ZK2LWB5HTM" and .sourceIPAddress!="192.0.2.50") | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' /root/cloudtrail/events.jsonl | sort > /tmp/ref2.tsv
tr -d '\r' < $f | grep . | sort > /tmp/moj2.tsv
cmp -s /tmp/moj2.tsv /tmp/ref2.tsv || { echo "kljuc-napadac.tsv se ne poklapa sa referencom: tvoj ima $(wc -l < /tmp/moj2.tsv) redova, očekivano $(wc -l < /tmp/ref2.tsv) (provjeri kolone, tabove i OK za uspješne pozive)"; exit 1; }
-->
<!-- hint
Upit iznad, sa preusmjeravanjem: `... events.jsonl > /root/odgovori/kljuc-napadac.tsv`. `@tsv` odvaja kolone tabom; `.errorCode // "OK"` daje `OK` kad polja nema.
-->
<!-- solution
jq -r 'select(.userIdentity.accessKeyId=="AKIA4NQXR7ZK2LWB5HTM" and .sourceIPAddress!="192.0.2.50") | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' /root/cloudtrail/events.jsonl > /root/odgovori/kljuc-napadac.tsv
-->

## Eskalacija privilegija i perzistencija

Ključ `svc-izvjestaji` nije imao pristup bazi kupaca, a onda ga je odjednom dobio. Pogledaj izmjene u IAM-u (`readOnly == false`) i šta je u `requestParameters` i `responseElements`:

```bash
jq -r 'select(.eventSource=="iam.amazonaws.com" and .readOnly==false)
  | [.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventName,
     (.requestParameters.userName // .requestParameters.policyArn // "-"),
     (.responseElements.accessKey.accessKeyId // .responseElements.policyVersion.versionId // "-")] | @tsv' events.jsonl
jq -r 'select(.eventName=="CreatePolicyVersion") | .requestParameters.policyDocument | fromjson' events.jsonl
```

Svaki novi ključ je novi trag. Pivotiraj: sa kojih adresa su korišteni ključevi koje je napadač napravio?

```bash
jq -r 'select(.userIdentity.accessKeyId=="AKIA4NQXR7ZKWJ3D6PQA") | [.eventTime, .sourceIPAddress, .eventName] | @tsv' events.jsonl | head
```

Upiši:

- `/root/odgovori/eskalacija.txt`: API poziv kojim je napadač podigao privilegije i ARN politike koju je izmijenio,
- `/root/odgovori/perzistencija.txt`: ime IAM korisnika koga je napravio i **sve** access key ID-jeve koje je napravio (po jedan u redu),
- `/root/odgovori/ip-adrese.txt`: sve IP adrese napadača, po jedna u redu.

<!-- verify
O=/root/odgovori
grep -q 'CreatePolicyVersion' $O/eskalacija.txt 2>/dev/null && grep -q 'arn:aws:iam::111122223333:policy/izvjestaji-s3-export' $O/eskalacija.txt || { echo "eskalacija.txt: treba API poziv i pun ARN izmijenjene politike"; exit 1; }
for x in aws-support-sync AKIA4NQXR7ZKWJ3D6PQA AKIA4NQXR7ZKM5T2YVCE; do
  grep -q "$x" $O/perzistencija.txt 2>/dev/null || { echo "perzistencija.txt: nedostaje jedan od artefakata napadača (korisnik ili ključ)"; exit 1; }
done
grep -q 'AKIA4NQXR7ZKBH6LF3RU' $O/perzistencija.txt && { echo "perzistencija.txt: AKIA4NQXR7ZKBH6LF3RU je legitimni Jenkins ključ, nije ga napravio napadač"; exit 1; }
[ "$(tr -d '\r ' < $O/ip-adrese.txt 2>/dev/null | grep . | sort -u | paste -sd,)" = "198.51.100.23,203.0.113.45" ] || { echo "ip-adrese.txt: treba tačno sve adrese napadača (i one sa kojih je koristio nove ključeve)"; exit 1; }
-->
<!-- hint
Eskalacija je `CreatePolicyVersion` sa `setAsDefault: true` nad politikom koja je zakačena za samog `svc-izvjestaji` (politika je dozvoljavala `iam:CreatePolicyVersion`, klasičan put eskalacije). Perzistencija: `CreateUser` + `AttachUserPolicy` + `CreateAccessKey` + `CreateLoginProfile` za `aws-support-sync`, i jedan `CreateAccessKey` za **postojećeg** korisnika `jenkins-legacy`. Druga adresa se vidi tek kad filtriraš po novim ključevima.
-->
<!-- solution
O=/root/odgovori
printf 'CreatePolicyVersion\narn:aws:iam::111122223333:policy/izvjestaji-s3-export\n' > $O/eskalacija.txt
printf 'aws-support-sync\nAKIA4NQXR7ZKWJ3D6PQA\nAKIA4NQXR7ZKM5T2YVCE\n' > $O/perzistencija.txt
printf '203.0.113.45\n198.51.100.23\n' > $O/ip-adrese.txt
-->

## Procjena štete: šta je pročitano iz S3

S3 data events bilježe svaki `GetObject`, sa veličinom u `additionalEventData.bytesTransferredOut`. Pazi na tri zamke:

- `kvadrat-kupci-prod` legitimno čita i aplikacija (`10.20.3.14`) i server izvještaja (`192.0.2.50`),
- odbijen `GetObject` (`AccessDenied`) nije curenje,
- napadač je čitao sa **obje** adrese i sa **dva** ključa.

```bash
jq -r 'select(.eventName=="GetObject") | [.sourceIPAddress, .userIdentity.accessKeyId, (.errorCode // "OK")] | @tsv' events.jsonl | sort | uniq -c
```

Upiši:

- `/root/odgovori/procitano.txt`: svaki objekat koji je napadač uspješno pročitao, kao `bucket/key`, po jedan u redu, bez duplikata,
- `/root/odgovori/bajtova.txt`: ukupan broj bajtova koje je napadač preuzeo (zbir `bytesTransferredOut` svih njegovih uspješnih `GetObject` poziva, i ponovljenih).

<!-- verify
O=/root/odgovori
sel='select(.eventName=="GetObject" and (.errorCode|not) and (.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23"))'
jq -r "$sel | .requestParameters.bucketName + \"/\" + .requestParameters.key" /root/cloudtrail/events.jsonl | sort -u > /tmp/ref4.txt
[ -s $O/procitano.txt ] || { echo "nema procitano.txt"; exit 1; }
tr -d '\r ' < $O/procitano.txt | grep . | sort -u > /tmp/moj4.txt
cmp -s /tmp/moj4.txt /tmp/ref4.txt || { echo "procitano.txt: $(wc -l < /tmp/moj4.txt) objekata, očekivano $(wc -l < /tmp/ref4.txt) (samo uspješni GetObject sa adresa napadača)"; exit 1; }
want=$(jq -s "[.[] | $sel | .additionalEventData.bytesTransferredOut] | add" /root/cloudtrail/events.jsonl)
[ "$(tr -d '\r \n' < $O/bajtova.txt 2>/dev/null)" = "$want" ] || { echo "bajtova.txt: zbir bytesTransferredOut nije tačan"; exit 1; }
-->
<!-- hint
```bash
S='select(.eventName=="GetObject" and (.errorCode|not) and (.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23"))'
jq -r "$S | .requestParameters.bucketName + \"/\" + .requestParameters.key" events.jsonl | sort -u
jq -s "[.[] | $S | .additionalEventData.bytesTransferredOut] | add" events.jsonl
```
-->
<!-- solution
S='select(.eventName=="GetObject" and (.errorCode|not) and (.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23"))'
jq -r "$S | .requestParameters.bucketName + \"/\" + .requestParameters.key" /root/cloudtrail/events.jsonl | sort -u > /root/odgovori/procitano.txt
jq -s "[.[] | $S | .additionalEventData.bytesTransferredOut] | add" /root/cloudtrail/events.jsonl > /root/odgovori/bajtova.txt
-->

## Obuzdavanje i iskorjenjivanje

AWS CLI ovdje nema, pa pripremaš artefakte koje bi tim primijenio:

1. `/root/obuzdavanje/deny-all.json`: IAM politika (`Version` `2012-10-17`) sa izjavom `Effect: Deny`, `Action: "*"`, `Resource: "*"`. Kači se kao inline politika na kompromitovane korisnike i odmah blokira **sve** njihove ključeve, i one koje još nisi pronašao. Bez `NotAction` i bez uslova koji je slabe (dozvoljen je samo uslov `aws:TokenIssueTime`, kakav AWS koristi za opoziv sesija role).
2. `/root/obuzdavanje/kljucevi.txt`: access key ID-jevi koje treba deaktivirati pa obrisati, po jedan u redu. Legitimni Jenkins ključ ne diraš (to bi srušilo build), samo onaj koji je napravio napadač.
3. `/root/obuzdavanje/komande.sh`: AWS CLI komande redom (sintaksno ispravan bash): `update-access-key ... --status Inactive` za svaki ključ, `put-user-policy` sa `deny-all.json` za `svc-izvjestaji` i `aws-support-sync` (ne za `jenkins-legacy`), `delete-login-profile` za `aws-support-sync` i `set-default-policy-version` koji vraća `izvjestaji-s3-export` na `v2`.

```bash
jq . /root/obuzdavanje/deny-all.json
bash -n /root/obuzdavanje/komande.sh && echo OK
```

<!-- verify
P=/root/obuzdavanje
jq -e '.Version == "2012-10-17"' $P/deny-all.json >/dev/null 2>&1 || { echo "deny-all.json nije validan JSON ili Version nije 2012-10-17"; exit 1; }
jq -e '[.Statement] | flatten | any(.Effect=="Deny" and ((.Action=="*") or (.Action==["*"])) and ((.Resource=="*") or (.Resource==["*"])) and (.NotAction|not) and (.NotResource|not) and ((.Condition|not) or ((.Condition|tostring|test("TokenIssueTime")) and ((.Condition|tostring|test("SourceIp|Region|Principal|UserAgent"))|not))))' $P/deny-all.json >/dev/null || { echo "deny-all.json: treba izjava Deny, Action *, Resource *, bez NotAction/NotResource i bez uslova (osim aws:TokenIssueTime)"; exit 1; }
[ "$(tr -d '\r ' < $P/kljucevi.txt 2>/dev/null | grep . | sort -u | paste -sd,)" = "AKIA4NQXR7ZK2LWB5HTM,AKIA4NQXR7ZKM5T2YVCE,AKIA4NQXR7ZKWJ3D6PQA" ] || { echo "kljucevi.txt: treba tačno ključ koji je procurio i oba ključa koja je napravio napadač"; exit 1; }
k=$P/komande.sh
bash -n $k 2>/dev/null || { echo "komande.sh nije sintaksno ispravan bash"; exit 1; }
for x in AKIA4NQXR7ZK2LWB5HTM AKIA4NQXR7ZKM5T2YVCE AKIA4NQXR7ZKWJ3D6PQA; do
  grep 'update-access-key' $k | grep "$x" | grep -q 'Inactive' || { echo "komande.sh: nedostaje update-access-key --status Inactive za jedan od ključeva"; exit 1; }
done
grep -q 'AKIA4NQXR7ZKBH6LF3RU' $k && { echo "komande.sh: legitimni Jenkins ključ AKIA4NQXR7ZKBH6LF3RU ne treba dirati"; exit 1; }
for u in svc-izvjestaji aws-support-sync; do
  grep 'put-user-policy' $k | grep -q -- "$u" || { echo "komande.sh: nedostaje put-user-policy sa deny-all.json za kompromitovanog korisnika"; exit 1; }
done
grep 'put-user-policy' $k | grep -q 'jenkins-legacy' && { echo "komande.sh: deny-all na jenkins-legacy bi srušio build; dovoljno je ugasiti napadačev ključ"; exit 1; }
grep 'delete-login-profile' $k | grep -q 'aws-support-sync' || { echo "komande.sh: nedostaje delete-login-profile za aws-support-sync"; exit 1; }
grep 'set-default-policy-version' $k | grep 'izvjestaji-s3-export' | grep -q 'v2' || { echo "komande.sh: nedostaje set-default-policy-version (vrati izvjestaji-s3-export na v2)"; exit 1; }
-->
<!-- hint
```bash
aws iam update-access-key --user-name svc-izvjestaji --access-key-id AKIA4NQXR7ZK2LWB5HTM --status Inactive
aws iam put-user-policy --user-name svc-izvjestaji --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam delete-login-profile --user-name aws-support-sync
aws iam set-default-policy-version --policy-arn arn:aws:iam::111122223333:policy/izvjestaji-s3-export --version-id v2
```
Ključevi se prvo **deaktiviraju** (reverzibilno, dokazi ostaju), a brišu tek kad je istraga gotova.
-->
<!-- solution
P=/root/obuzdavanje
cat > $P/deny-all.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "IRDenyAll", "Effect": "Deny", "Action": "*", "Resource": "*" }
  ]
}
EOF
printf 'AKIA4NQXR7ZK2LWB5HTM\nAKIA4NQXR7ZKWJ3D6PQA\nAKIA4NQXR7ZKM5T2YVCE\n' > $P/kljucevi.txt
cat > $P/komande.sh <<'EOF'
#!/bin/bash
set -e
POL=arn:aws:iam::111122223333:policy/izvjestaji-s3-export
aws iam update-access-key --user-name svc-izvjestaji --access-key-id AKIA4NQXR7ZK2LWB5HTM --status Inactive
aws iam update-access-key --user-name aws-support-sync --access-key-id AKIA4NQXR7ZKWJ3D6PQA --status Inactive
aws iam update-access-key --user-name jenkins-legacy --access-key-id AKIA4NQXR7ZKM5T2YVCE --status Inactive
aws iam put-user-policy --user-name svc-izvjestaji --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam put-user-policy --user-name aws-support-sync --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam delete-login-profile --user-name aws-support-sync
aws iam set-default-policy-version --policy-arn arn:aws:iam::111122223333:policy/izvjestaji-s3-export --version-id v2
aws iam delete-policy-version --policy-arn $POL --version-id v3
EOF
-->

## Sigma detekcija za gašenje CloudTraila

SCP je odbio `StopLogging` i `DeleteTrail`, ali niko to nije vidio do jutra. Napiši `/root/detekcije/aws_cloudtrail_stop_or_delete.yml`:

- `logsource`: `product: aws`, `service: cloudtrail`,
- `detection`: `eventSource` je `cloudtrail.amazonaws.com` i `eventName` je `StopLogging` ili `DeleteTrail` (i odbijeni pokušaji su alarm),
- `tags`: `attack.defense-impairment` i `attack.t1685.002` (ranije T1562.008), `level: high`, `falsepositives`.

`sigma check` mora proći bez grešaka i upozorenja, a Zircolite nad CloudTrailom mora naći tačno ta dva pokušaja (a ne Markov `DescribeTrails` ni SOC-ove `LookupEvents`):

```bash
cd /root/detekcije
sigma check aws_cloudtrail_stop_or_delete.yml
zircolite -e /root/cloudtrail/events.jsonl -j -r aws_cloudtrail_stop_or_delete.yml -o /tmp/z.json -q
jq -r '.[].matches[] | [.eventTime, .eventName, .sourceIPAddress, .errorCode] | @tsv' /tmp/z.json
```

<!-- verify
f=/root/detekcije/aws_cloudtrail_stop_or_delete.yml
[ -f $f ] || { echo "nema $f"; exit 1; }
sigma check $f > /tmp/sc.txt 2>&1 || { tail -8 /tmp/sc.txt; echo "sigma check javlja grešku"; exit 1; }
grep -q 'Found 0 errors, 0 condition errors and 0 issues' /tmp/sc.txt || { grep -iE 'issue|error' /tmp/sc.txt | head -5; echo "sigma check javlja greške ili upozorenja"; exit 1; }
[ "$(yq '.logsource.product' $f)" = "aws" ] && [ "$(yq '.logsource.service' $f)" = "cloudtrail" ] || { echo "logsource treba product: aws, service: cloudtrail"; exit 1; }
yq '.tags[]' $f | grep -qx 'attack.t1685.002' || { echo "tags treba attack.t1685.002"; exit 1; }
cd /tmp && rm -f /tmp/vz.json
zircolite -e /root/cloudtrail/events.jsonl -j -r $f -o /tmp/vz.json -q >/dev/null 2>&1
got=$(jq -r '[.[].matches[]?.eventID] | sort | join(",")' /tmp/vz.json 2>/dev/null)
want=$(jq -r 'select(.eventName=="StopLogging" or .eventName=="DeleteTrail") | .eventID' /root/cloudtrail/events.jsonl | sort | paste -sd,)
[ "$got" = "$want" ] || { echo "Zircolite nalazi $(echo "$got" | tr ',' '\n' | grep -c .) događaja, očekivana su tačno 2 (StopLogging i DeleteTrail)"; exit 1; }
-->
<!-- hint
```yaml
title: AWS CloudTrail zaustavljen ili obrisan
id: 4c7e2a19-8b3d-4f6a-9e21-0d5c3b7a1f84
status: test
description: Pokušaj zaustavljanja ili brisanja CloudTrail traila, uspješan ili odbijen
author: SOC Kvadrat
date: 2026-10-19
tags:
  - attack.defense-impairment
  - attack.t1685.002
logsource:
  product: aws
  service: cloudtrail
detection:
  selection:
    eventSource: cloudtrail.amazonaws.com
    eventName:
      - StopLogging
      - DeleteTrail
  condition: selection
falsepositives:
  - Planirana zamjena traila uz odobren change request
level: high
```
Samo `eventSource: cloudtrail.amazonaws.com` bi uhvatio i `DescribeTrails` i `LookupEvents`.
-->
<!-- solution
cat > /root/detekcije/aws_cloudtrail_stop_or_delete.yml <<'EOF'
title: AWS CloudTrail zaustavljen ili obrisan
id: 4c7e2a19-8b3d-4f6a-9e21-0d5c3b7a1f84
status: test
description: Pokušaj zaustavljanja ili brisanja CloudTrail traila, uspješan ili odbijen
references:
  - https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html
author: SOC Kvadrat
date: 2026-10-19
tags:
  - attack.defense-impairment
  - attack.t1685.002
logsource:
  product: aws
  service: cloudtrail
detection:
  selection:
    eventSource: cloudtrail.amazonaws.com
    eventName:
      - StopLogging
      - DeleteTrail
  condition: selection
falsepositives:
  - Planirana zamjena traila uz odobren change request
level: high
EOF
-->

## Vremenska linija i izvještaj

Napiši `/root/odgovori/izvjestaj.md` (srpski ili engleski):

- **vremenska linija** sa bar 8 stavki sa datumom (UTC): od commita i CI joba 12. 10, preko prvog poziva napadača, eskalacije, perzistencije i čitanja podataka, do pokušaja gašenja CloudTraila i otkrivanja,
- izvor curenja (commit `bcf32b3`, job 4812), ključ, obje IP adrese napadača, korisnik `aws-support-sync`,
- uticaj: bucketi i broj pročitanih objekata (`kvadrat-kupci-prod`, `kvadrat-finansije`), pominjanje obaveze prijave (lični podaci kupaca),
- **preporuke**: šta bi spriječilo ili ranije otkrilo napad.

```bash
jq -r 'select(.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23") | [.eventTime, .userIdentity.userName, .eventName, (.errorCode // "OK")] | @tsv' /root/cloudtrail/events.jsonl
```

<!-- verify
f=/root/odgovori/izvjestaj.md
[ -s $f ] || { echo "nema $f"; exit 1; }
for x in AKIA4NQXR7ZK2LWB5HTM 203.0.113.45 198.51.100.23 aws-support-sync kvadrat-kupci-prod kvadrat-finansije CreatePolicyVersion bcf32b3 4812; do
  grep -q -- "$x" $f || { echo "izvještaju nedostaje ključna činjenica ($x)"; exit 1; }
done
[ "$(grep -cE '2026-10-1[2-9]' $f)" -ge 8 ] || { echo "vremenska linija treba bar 8 stavki sa datumom (2026-10-..)"; exit 1; }
grep -Eqi 'vremensk|timeline' $f || { echo "nedostaje odjeljak sa vremenskom linijom"; exit 1; }
grep -Eqi 'preporu|recommend' $f || { echo "nedostaju preporuke"; exit 1; }
-->
<!-- hint
Kostur: `# Incident: procurjeli ključ svc-izvjestaji`, `## Sažetak`, `## Vremenska linija` (tabela ili lista `2026-10-19T02:14:07Z GetCallerIdentity sa 203.0.113.45`), `## Uticaj`, `## Obuzdavanje`, `## Preporuke` (pre-commit gitleaks, maskirane CI varijable, bez statičnih ključeva: OIDC/IAM role, data events i alarm na StopLogging, uklanjanje `iam:CreatePolicyVersion` iz politika servisa).
-->
<!-- solution
cat > /root/odgovori/izvjestaj.md <<'EOF'
# Incident: procurjeli access ključ svc-izvjestaji

### Sažetak
Ključ AKIA4NQXR7ZK2LWB5HTM korisnika svc-izvjestaji procurio je kroz commit bcf32b3 i CI job 4812 (javni projekat).
Napadač (203.0.113.45, zatim 198.51.100.23) je eskalirao privilegije kroz CreatePolicyVersion,
napravio korisnika aws-support-sync i dodatni ključ za jenkins-legacy, i pročitao 11 objekata iz
kvadrat-kupci-prod i kvadrat-finansije. Pokušaj gašenja CloudTraila odbio je SCP.

### Vremenska linija (UTC)
| Vrijeme | Događaj |
|---|---|
| 2026-10-12T11:58Z | commit bcf32b3 dodaje ključ u config/settings.py |
| 2026-10-12T12:21Z | CI job 4812 ispisuje ključ u javni log |
| 2026-10-13T07:12Z | ključ uklonjen iz koda (ostaje u istoriji), ključ nije rotiran |
| 2026-10-19T02:14:07Z | GetCallerIdentity sa 203.0.113.45 (Kali), zatim enumeracija IAM-a i S3 |
| 2026-10-19T02:19:12Z | CreatePolicyVersion v3 (Allow *:*) na izvjestaji-s3-export |
| 2026-10-19T02:20:03Z | CreateUser aws-support-sync + AdministratorAccess + ključ + login profil |
| 2026-10-19T02:21:30Z | CreateAccessKey za jenkins-legacy |
| 2026-10-19T02:23:05Z | GetObject baza/kupci-full-2026-10.csv.gz |
| 2026-10-19T02:41:10Z | novi ključ sa 198.51.100.23, preuzimanje baze, ugovora i finansija |
| 2026-10-19T02:47:21Z | StopLogging i DeleteTrail odbijeni (SCP) |
| 2026-10-19T08:10Z | SOC otkriva GuardDuty nalaz PenTest:IAMUser/KaliLinux |

### Uticaj
Lični podaci kupaca (kvadrat-kupci-prod) i finansijski izvještaji (kvadrat-finansije): obaveza prijave nadležnom organu.

### Preporuke
- gitleaks u pre-commit i CI, maskirane i zaštićene CI varijable, privatni projekti
- bez statičnih ključeva: IAM role i OIDC za CI
- ukloniti iam:CreatePolicyVersion iz politika servisa, permission boundary
- alarm na StopLogging/DeleteTrail i na CreateUser/CreateAccessKey (Sigma pravilo iz ovog laba)
EOF
-->
