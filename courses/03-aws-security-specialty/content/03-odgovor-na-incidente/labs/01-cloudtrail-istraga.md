# Lab 1: Istraga kompromitovanog access ključa (CloudTrail)

GuardDuty je u 03:25 prijavio nalaz `Recon:IAMUser/MaliciousIPCaller` za korisnika `ci-deploy`. To je IAM korisnik čiji statični access ključ koristi CI pipeline. Imaš izvoz CloudTrail logova iz log archive naloga, u istoj strukturi foldera kakvu CloudTrail piše u S3.

Tvoj zadatak: rekonstruisati napad pomoću `jq`, odrediti obim (*scope*) i pripremiti containment komande. Odgovore piši u `/root/ir/`.

Poznati legitimni izvori:

| IP | Šta je |
|---|---|
| `192.0.2.10` | GitHub Actions runner (CI) |
| `198.51.100.20` | kancelarija (konzola, SSO) |

<!-- setup
set -e
mkdir -p /root/ir
python3 - <<'PY'
import json, gzip, os, random, uuid, datetime
random.seed(20261014)
ACCT = "111122223333"
CI_KEY = "AKIAQEXAMPLECIDEPLOY"
NEW_KEY = "AKIAQEXAMPLESVCBACKP"
base = datetime.datetime(2026, 10, 14, 0, 0, 0)
recs = []
def ev(t, src, name, region, ip, ua, user="ci-deploy", key=CI_KEY, ro=False, req=None, resp=None, err=None, cat="Management", typ="IAMUser"):
    ident = {"type": typ, "principalId": "AIDAQEXAMPLE" + user.upper().replace("-", "")[:8], "arn": f"arn:aws:iam::{ACCT}:user/{user}",
             "accountId": ACCT, "accessKeyId": key, "userName": user}
    if typ == "AssumedRole":
        ident = {"type": "AssumedRole", "principalId": "AROAQEXAMPLE:ana@primjer-firma.ba",
                 "arn": f"arn:aws:sts::{ACCT}:assumed-role/AWSReservedSSO_Admin_0123456789abcdef/ana@primjer-firma.ba",
                 "accountId": ACCT, "accessKeyId": "ASIAQEXAMPLESSOANA01",
                 "sessionContext": {"sessionIssuer": {"type": "Role", "userName": "AWSReservedSSO_Admin_0123456789abcdef"}}}
    r = {"eventVersion": "1.10", "userIdentity": ident, "eventTime": (base + datetime.timedelta(seconds=t)).strftime("%Y-%m-%dT%H:%M:%SZ"),
         "eventSource": src, "eventName": name, "awsRegion": region, "sourceIPAddress": ip, "userAgent": ua,
         "requestParameters": req, "responseElements": resp, "requestID": str(uuid.UUID(int=random.getrandbits(128))),
         "eventID": str(uuid.UUID(int=random.getrandbits(128))), "readOnly": ro, "eventType": "AwsApiCall",
         "managementEvent": cat == "Management", "recipientAccountId": ACCT, "eventCategory": cat}
    if err:
        r["errorCode"] = err; r["errorMessage"] = f"User: {ident['arn']} is not authorized to perform: {src.split('.')[0]}:{name} with an explicit deny in a service control policy"
    recs.append(r)
CI_UA = "aws-sdk-go-v2/1.30.3 os/linux lang/go#1.22.5 md/GOOS#linux api/ecs#1.45.2"
CLI = "aws-cli/2.17.40 md/awscrt#0.21.2 ua/2.0 os/linux#6.8.0 md/arch#x86_64 lang/python#3.11.9 md/pyimpl#CPython cfg/retry-mode#standard md/installer#exe md/distrib#kali.2024 md/prompt#off md/command#"
# normalan CI rad tokom dana
for h in [1, 6, 9, 11, 13, 15, 17]:
    t = h * 3600 + random.randint(0, 1800)
    ev(t, "ecr.amazonaws.com", "GetAuthorizationToken", "eu-central-1", "192.0.2.10", CI_UA, ro=True)
    ev(t + 40, "ecs.amazonaws.com", "UpdateService", "eu-central-1", "192.0.2.10", CI_UA, req={"cluster": "prod", "service": "web"})
    ev(t + 45, "ecs.amazonaws.com", "DescribeServices", "eu-central-1", "192.0.2.10", CI_UA, ro=True)
# Ana preko SSO
for h in [8, 10, 14]:
    t = h * 3600 + random.randint(0, 3000)
    ev(t, "s3.amazonaws.com", "ListBuckets", "eu-central-1", "198.51.100.20", "Mozilla/5.0 (Macintosh)", user="ana", ro=True, typ="AssumedRole")
    ev(t + 30, "cloudwatch.amazonaws.com", "GetMetricData", "eu-central-1", "198.51.100.20", "Mozilla/5.0 (Macintosh)", user="ana", ro=True, typ="AssumedRole")
# napad
A = "203.0.113.77"; t0 = 3 * 3600 + 12 * 60
ev(t0, "sts.amazonaws.com", "GetCallerIdentity", "us-east-1", A, CLI + "sts.get-caller-identity", ro=True)
ev(t0 + 20, "s3.amazonaws.com", "ListBuckets", "us-east-1", A, CLI + "s3.ls", ro=True)
ev(t0 + 50, "iam.amazonaws.com", "ListUsers", "us-east-1", A, CLI + "iam.list-users", ro=True)
ev(t0 + 70, "iam.amazonaws.com", "ListAttachedUserPolicies", "us-east-1", A, CLI + "iam.list-attached-user-policies", ro=True, req={"userName": "ci-deploy"})
ev(t0 + 120, "iam.amazonaws.com", "CreateUser", "us-east-1", A, CLI + "iam.create-user", req={"userName": "svc-backup"},
   resp={"user": {"userName": "svc-backup", "arn": f"arn:aws:iam::{ACCT}:user/svc-backup", "userId": "AIDAQEXAMPLESVCBACKUP"}})
ev(t0 + 135, "iam.amazonaws.com", "AttachUserPolicy", "us-east-1", A, CLI + "iam.attach-user-policy",
   req={"userName": "svc-backup", "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess"})
ev(t0 + 150, "iam.amazonaws.com", "CreateAccessKey", "us-east-1", A, CLI + "iam.create-access-key", req={"userName": "svc-backup"},
   resp={"accessKey": {"userName": "svc-backup", "accessKeyId": NEW_KEY, "status": "Active", "createDate": "Oct 14, 2026 3:14:30 AM"}})
t1 = t0 + 480
kw = dict(user="svc-backup", key=NEW_KEY)
ev(t1, "cloudtrail.amazonaws.com", "StopLogging", "eu-central-1", A, CLI + "cloudtrail.stop-logging", req={"name": f"arn:aws:cloudtrail:eu-central-1:{ACCT}:trail/org-trail"}, err="AccessDenied", **kw)
ev(t1 + 30, "guardduty.amazonaws.com", "DeleteDetector", "eu-central-1", A, CLI + "guardduty.delete-detector", req={"detectorId": "12abc34d567e8fa901bc2d34eexample"}, err="AccessDenied", **kw)
for i, n in enumerate([5, 5, 10, 10]):
    ev(t1 + 120 + i * 60, "ec2.amazonaws.com", "RunInstances", "us-east-1", A, CLI + "ec2.run-instances",
       req={"instancesSet": {"items": [{"imageId": "ami-0abcdef1234567890", "minCount": n, "maxCount": n}]}, "instanceType": "g5.12xlarge"},
       resp={"instancesSet": {"items": [{"instanceId": "i-%017x" % random.getrandbits(68)} for _ in range(n)]}}, **kw)
for i in range(25):
    ev(t1 + 600 + i * 7, "s3.amazonaws.com", "GetObject", "eu-central-1", A, CLI + "s3.cp", ro=True, cat="Data",
       req={"bucketName": "finance-reports", "key": f"2026/Q{1 + i % 3}/izvjestaj-{i:03d}.pdf"}, **kw)
ev(t1 + 900, "s3.amazonaws.com", "GetObject", "eu-central-1", "198.51.100.20", "Mozilla/5.0 (Macintosh)", user="ana", ro=True, cat="Data", typ="AssumedRole",
   req={"bucketName": "finance-reports", "key": "2026/Q3/plan.xlsx"})
# zapiši po regiji i satu, kao CloudTrail u S3
recs.sort(key=lambda r: r["eventTime"])
groups = {}
for r in recs:
    t = r["eventTime"]; key = (r["awsRegion"], t[:13])
    groups.setdefault(key, []).append(r)
for (region, hour), rs in groups.items():
    d = f"/root/cloudtrail/AWSLogs/{ACCT}/CloudTrail/{region}/2026/10/14"
    os.makedirs(d, exist_ok=True)
    stamp = hour.replace("-", "").replace("T", "T") + "00Z"
    fn = f"{d}/{ACCT}_CloudTrail_{region}_{stamp}_{uuid.UUID(int=random.getrandbits(128)).hex[:16]}.json.gz"
    with gzip.open(fn, "wt") as f:
        json.dump({"Records": rs}, f)
PY
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: CloudTrail istraga ===
Logovi: /root/cloudtrail/AWSLogs/   Odgovori: /root/ir/
Svi eventi u jednom toku:  zcat $(find /root/cloudtrail -name '*.json.gz') | jq -c '.Records[]'
EOF
-->

## Upoznaj logove

CloudTrail piše gzip JSON fajlove po regiji i vremenu. Svaki fajl ima niz `Records`.

```bash
find /root/cloudtrail -name '*.json.gz' | head
zcat $(find /root/cloudtrail -name '*.json.gz') | jq -c '.Records[]' > /root/ir/events.jsonl
wc -l /root/ir/events.jsonl
head -1 /root/ir/events.jsonl | jq .
```

Najvažnija polja za istragu: `eventTime`, `eventSource`, `eventName`, `awsRegion`, `sourceIPAddress`, `userAgent`, `userIdentity.arn` i `userIdentity.accessKeyId`, `errorCode`, `requestParameters`, `responseElements`.

U praksi bi isto radio **Athena** upitima nad CloudTrail tabelom, **CloudTrail Lake** SQL-om ili u **Detective**-u. `jq` je ovdje zamjena za njih.

## Ko je napadač?

Grupiši evente po IP adresi i identitetu. Sve što nije sa poznatih adresa je sumnjivo.

```bash
cd /root/ir
jq -r '[.sourceIPAddress, .userIdentity.arn] | @tsv' events.jsonl | sort | uniq -c | sort -rn
```

Upiši IP adresu napadača u `/root/ir/napadac.txt`, a access key ID koji je prvi kompromitovan u `/root/ir/kljuc.txt`.

<!-- verify
grep -qx '203.0.113.77' /root/ir/napadac.txt 2>/dev/null || { echo "napadac.txt nije tačan"; exit 1; }
grep -qx 'AKIAQEXAMPLECIDEPLOY' /root/ir/kljuc.txt 2>/dev/null || { echo "kljuc.txt nije tačan (polje userIdentity.accessKeyId)"; exit 1; }
-->
<!-- hint
`jq -r 'select(.sourceIPAddress == "203.0.113.77") | .userIdentity.accessKeyId' events.jsonl | sort -u`. Prvi ključ koji napadač koristi pripada korisniku `ci-deploy`.
-->
<!-- solution
cd /root/ir && zcat $(find /root/cloudtrail -name '*.json.gz') | jq -c '.Records[]' > events.jsonl
echo 203.0.113.77 > napadac.txt; echo AKIAQEXAMPLECIDEPLOY > kljuc.txt
-->

## Hronologija napada

Ispiši sve što je napadač radio, hronološki:

```bash
jq -r 'select(.sourceIPAddress == "203.0.113.77") | [.eventTime, .userIdentity.userName, .eventSource, .eventName, (.errorCode // "OK")] | @tsv' /root/ir/events.jsonl | sort
```

Primijeti obrazac: prvo **izviđanje** (`GetCallerIdentity`, `List*`), pa **perzistencija** (novi korisnik sa admin pravima i njegov ključ), pa pokušaj **slabljenja odbrane**, pa **uticaj**. Primijeti i `userAgent`: napadač koristi AWS CLI sa Kali Linuxa, a CI koristi Go SDK. Promjena User-Agenta za isti ključ je jak indikator.

U `/root/ir/perzistencija.txt` upiši dvije linije: ime IAM korisnika koga je napadač napravio i access key ID tog korisnika (iz `responseElements`).

<!-- verify
f=/root/ir/perzistencija.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "svc-backup" ] || { echo "Prva linija: ime novog korisnika"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "AKIAQEXAMPLESVCBACKP" ] || { echo "Druga linija: accessKeyId iz responseElements događaja CreateAccessKey"; exit 1; }
-->
<!-- hint
`jq 'select(.eventName == "CreateAccessKey") | .responseElements.accessKey' /root/ir/events.jsonl`
-->
<!-- solution
printf 'svc-backup\nAKIAQEXAMPLESVCBACKP\n' > /root/ir/perzistencija.txt
-->

## Pokušaj gašenja odbrane

Napadač je pokušao isključiti logovanje i detekciju. Pronađi te evente i provjeri da li su uspjeli (polje `errorCode`).

```bash
jq -r 'select(.errorCode != null) | [.eventTime, .eventName, .errorCode, .errorMessage] | @tsv' /root/ir/events.jsonl
```

U `/root/ir/odbrana.txt` upiši imena oba API poziva (eventName), svaki u svoj red. Oba su odbijena zbog **SCP-a** koji štiti CloudTrail i GuardDuty u svim nalozima organizacije. To je primjer zašto se takve zaštite postavljaju na nivou organizacije (domen 6), a ne u samom nalogu, gdje bi ih admin mogao ukloniti.

<!-- verify
f=/root/ir/odbrana.txt
grep -qx 'StopLogging' $f 2>/dev/null && grep -qx 'DeleteDetector' $f || { echo "Treba oba eventName-a, svaki u svom redu"; exit 1; }
-->
<!-- solution
printf 'StopLogging\nDeleteDetector\n' > /root/ir/odbrana.txt
-->

## Obim štete: EC2 i S3

Napadač je pokretao instance (vjerovatno za kripto rudarenje, skupe GPU instance) i preuzimao fajlove. Izračunaj:

```bash
# koliko instanci i u kojoj regiji
jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | [.awsRegion, (.responseElements.instancesSet.items | length)] | @tsv' /root/ir/events.jsonl
# koliko objekata je preuzeto iz finance-reports
jq -r 'select(.eventName == "GetObject" and .sourceIPAddress == "203.0.113.77") | .requestParameters.key' /root/ir/events.jsonl | sort -u | wc -l
```

U `/root/ir/obim.txt` upiši tri linije: ukupan broj pokrenutih instanci, regiju u kojoj su pokrenute i broj preuzetih objekata.

> `GetObject` se vidi samo zato što su za taj bucket uključeni **S3 data eventi**. Bez njih ne bi bilo dokaza o curenju podataka, pa bi obim incidenta bio nepoznat. Upravo zato ispit traži da znaš kada uključiti data evente.

<!-- verify
f=/root/ir/obim.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "30" ] || { echo "Prva linija: ukupan broj instanci"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "us-east-1" ] || { echo "Druga linija: regija"; exit 1; }
[ "$(sed -n 3p $f | xargs)" = "25" ] || { echo "Treća linija: broj preuzetih objekata"; exit 1; }
-->
<!-- solution
printf '30\nus-east-1\n25\n' > /root/ir/obim.txt
-->

## Containment plan

Ovaj lab nema pristup AWS-u, pa komande samo pripremaš u `/root/ir/containment.sh`, kao što bi ih pripremio za runbook ili za SSM Automation. Plan mora:

1. deaktivirati **oba** ključa (`aws iam update-access-key … --status Inactive`), a ne odmah obrisati, jer su dokaz,
2. ukloniti `AdministratorAccess` sa korisnika `svc-backup` (`aws iam detach-user-policy`),
3. zaustaviti instance koje je napadač pokrenuo u `us-east-1`, ali ih prije gašenja **snapshotovati** radi forenzike.

```bash
cat > /root/ir/containment.sh <<'EOF'
#!/bin/bash
set -euo pipefail
aws iam update-access-key --user-name ci-deploy  --access-key-id AKIAQEXAMPLECIDEPLOY --status Inactive
aws iam update-access-key --user-name svc-backup --access-key-id AKIAQEXAMPLESVCBACKP --status Inactive
aws iam detach-user-policy --user-name svc-backup --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
# za svaku instancu: aws ec2 create-snapshots --instance-specification InstanceId=... pa aws ec2 stop-instances
EOF
```

Zatim dodaj komande za instance. Listu ID-jeva imaš u logovima (`responseElements.instancesSet.items[].instanceId`).

Nakon containmenta slijedi: CI prelazi na **OIDC federaciju** (bez statičnih ključeva), napadačeve resurse brišeš tek kad su dokazi sačuvani, a root cause (ključ je procurio iz CI loga) ulazi u izvještaj nakon incidenta.

<!-- verify
f=/root/ir/containment.sh
[ -f $f ] || { echo "Nema containment.sh"; exit 1; }
bash -n $f || { echo "Sintaksna greška u skripti"; exit 1; }
for k in AKIAQEXAMPLECIDEPLOY AKIAQEXAMPLESVCBACKP; do grep -E "update-access-key.*$k.*Inactive|update-access-key.*Inactive.*$k" $f >/dev/null || { echo "Ključ $k nije deaktiviran"; exit 1; }; done
grep -q 'detach-user-policy.*svc-backup.*AdministratorAccess' $f || { echo "Nema uklanjanja AdministratorAccess sa svc-backup"; exit 1; }
grep -q 'delete-access-key' $f && { echo "Ključeve ne briši odmah: deaktiviraj ih"; exit 1; }
ids=$(jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | .responseElements.instancesSet.items[].instanceId' /root/ir/events.jsonl)
for i in $ids; do grep -q "$i" $f || { echo "Instanca $i nije u planu"; exit 1; }; done
grep -q 'create-snapshot' $f || { echo "Nema snapshotovanja prije gašenja"; exit 1; }
grep -q 'stop-instances' $f || { echo "Nema zaustavljanja instanci"; exit 1; }
grep -q -- '--region us-east-1' $f || { echo "Komande za instance moraju ciljati --region us-east-1"; exit 1; }
-->
<!-- hint
Generiši komande petljom:

    for i in $(jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | .responseElements.instancesSet.items[].instanceId' /root/ir/events.jsonl); do
      echo "aws ec2 create-snapshots --region us-east-1 --instance-specification InstanceId=$i --description incident-2026-10-14"
      echo "aws ec2 stop-instances --region us-east-1 --instance-ids $i"
    done >> /root/ir/containment.sh

Instance su pokrenute u `us-east-1`, a podrazumijevana regija CLI-ja je drugačija.
-->
<!-- solution
cd /root/ir
printf '#!/bin/bash\nset -euo pipefail\naws iam update-access-key --user-name ci-deploy --access-key-id AKIAQEXAMPLECIDEPLOY --status Inactive\naws iam update-access-key --user-name svc-backup --access-key-id AKIAQEXAMPLESVCBACKP --status Inactive\naws iam detach-user-policy --user-name svc-backup --policy-arn arn:aws:iam::aws:policy/AdministratorAccess\n' > containment.sh
for i in $(jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | .responseElements.instancesSet.items[].instanceId' events.jsonl); do echo "aws ec2 create-snapshots --region us-east-1 --instance-specification InstanceId=$i --description incident"; echo "aws ec2 stop-instances --region us-east-1 --instance-ids $i"; done >> containment.sh
-->
