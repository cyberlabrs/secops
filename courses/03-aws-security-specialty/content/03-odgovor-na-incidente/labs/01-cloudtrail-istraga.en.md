# Lab 1: Investigating a compromised access key (CloudTrail)

At 03:25 GuardDuty reported a `Recon:IAMUser/MaliciousIPCaller` finding for the user `ci-deploy`. This is an IAM user whose static access key is used by the CI pipeline. You have an export of CloudTrail logs from the log archive account, in the same folder structure that CloudTrail writes to S3.

Your task: reconstruct the attack with `jq`, determine the scope, and prepare containment commands. Write your answers to `/root/ir/`.

Known legitimate sources:

| IP | What it is |
|---|---|
| `192.0.2.10` | GitHub Actions runner (CI) |
| `198.51.100.20` | office (console, SSO) |

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

## Get to know the logs

CloudTrail writes gzipped JSON files per Region and time. Each file has a `Records` array.

```bash
find /root/cloudtrail -name '*.json.gz' | head
zcat $(find /root/cloudtrail -name '*.json.gz') | jq -c '.Records[]' > /root/ir/events.jsonl
wc -l /root/ir/events.jsonl
head -1 /root/ir/events.jsonl | jq .
```

The most important fields for an investigation: `eventTime`, `eventSource`, `eventName`, `awsRegion`, `sourceIPAddress`, `userAgent`, `userIdentity.arn` and `userIdentity.accessKeyId`, `errorCode`, `requestParameters`, `responseElements`.

In practice you would do the same with **Athena** queries over a CloudTrail table, **CloudTrail Lake** SQL, or in **Detective**. Here `jq` stands in for them.

## Who is the attacker?

Group events by IP address and identity. Anything not from the known addresses is suspicious.

```bash
cd /root/ir
jq -r '[.sourceIPAddress, .userIdentity.arn] | @tsv' events.jsonl | sort | uniq -c | sort -rn
```

Write the attacker's IP address to `/root/ir/napadac.txt`, and the access key ID that was compromised first to `/root/ir/kljuc.txt`.

<!-- verify
grep -qx '203.0.113.77' /root/ir/napadac.txt 2>/dev/null || { echo "napadac.txt is not correct"; exit 1; }
grep -qx 'AKIAQEXAMPLECIDEPLOY' /root/ir/kljuc.txt 2>/dev/null || { echo "kljuc.txt is not correct (field userIdentity.accessKeyId)"; exit 1; }
-->
<!-- hint
`jq -r 'select(.sourceIPAddress == "203.0.113.77") | .userIdentity.accessKeyId' events.jsonl | sort -u`. The first key the attacker uses belongs to the user `ci-deploy`.
-->
<!-- solution
cd /root/ir && zcat $(find /root/cloudtrail -name '*.json.gz') | jq -c '.Records[]' > events.jsonl
echo 203.0.113.77 > napadac.txt; echo AKIAQEXAMPLECIDEPLOY > kljuc.txt
-->

## Attack timeline

Print everything the attacker did, chronologically:

```bash
jq -r 'select(.sourceIPAddress == "203.0.113.77") | [.eventTime, .userIdentity.userName, .eventSource, .eventName, (.errorCode // "OK")] | @tsv' /root/ir/events.jsonl | sort
```

Notice the pattern: first **reconnaissance** (`GetCallerIdentity`, `List*`), then **persistence** (a new user with admin rights and its key), then an attempt at **defense evasion**, then **impact**. Also notice the `userAgent`: the attacker uses the AWS CLI from Kali Linux, while CI uses the Go SDK. A User-Agent change for the same key is a strong indicator.

Write two lines to `/root/ir/perzistencija.txt`: the name of the IAM user the attacker created and that user's access key ID (from `responseElements`).

<!-- verify
f=/root/ir/perzistencija.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "svc-backup" ] || { echo "First line: the name of the new user"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "AKIAQEXAMPLESVCBACKP" ] || { echo "Second line: the accessKeyId from responseElements of the CreateAccessKey event"; exit 1; }
-->
<!-- hint
`jq 'select(.eventName == "CreateAccessKey") | .responseElements.accessKey' /root/ir/events.jsonl`
-->
<!-- solution
printf 'svc-backup\nAKIAQEXAMPLESVCBACKP\n' > /root/ir/perzistencija.txt
-->

## Attempt to disable defenses

The attacker tried to disable logging and detection. Find those events and check whether they succeeded (the `errorCode` field).

```bash
jq -r 'select(.errorCode != null) | [.eventTime, .eventName, .errorCode, .errorMessage] | @tsv' /root/ir/events.jsonl
```

Write the names of both API calls (eventName) to `/root/ir/odbrana.txt`, each on its own line. Both were denied because of an **SCP** that protects CloudTrail and GuardDuty in all accounts of the organization. This is an example of why such protections are set at the organization level (domain 6) and not in the account itself, where an admin could remove them.

<!-- verify
f=/root/ir/odbrana.txt
grep -qx 'StopLogging' $f 2>/dev/null && grep -qx 'DeleteDetector' $f || { echo "Both eventNames are needed, each on its own line"; exit 1; }
-->
<!-- solution
printf 'StopLogging\nDeleteDetector\n' > /root/ir/odbrana.txt
-->

## Scope of the damage: EC2 and S3

The attacker launched instances (probably for crypto mining, expensive GPU instances) and downloaded files. Calculate:

```bash
# how many instances and in which Region
jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | [.awsRegion, (.responseElements.instancesSet.items | length)] | @tsv' /root/ir/events.jsonl
# how many objects were downloaded from finance-reports
jq -r 'select(.eventName == "GetObject" and .sourceIPAddress == "203.0.113.77") | .requestParameters.key' /root/ir/events.jsonl | sort -u | wc -l
```

Write three lines to `/root/ir/obim.txt`: the total number of instances launched, the Region in which they were launched, and the number of objects downloaded.

> `GetObject` is visible only because **S3 data events** are enabled for that bucket. Without them there would be no evidence of the data leak, so the scope of the incident would be unknown. That is exactly why the exam expects you to know when to enable data events.

<!-- verify
f=/root/ir/obim.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "30" ] || { echo "First line: the total number of instances"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "us-east-1" ] || { echo "Second line: the Region"; exit 1; }
[ "$(sed -n 3p $f | xargs)" = "25" ] || { echo "Third line: the number of downloaded objects"; exit 1; }
-->
<!-- solution
printf '30\nus-east-1\n25\n' > /root/ir/obim.txt
-->

## Containment plan

This lab has no access to AWS, so you only prepare the commands in `/root/ir/containment.sh`, as you would for a runbook or for SSM Automation. The plan must:

1. deactivate **both** keys (`aws iam update-access-key … --status Inactive`), not delete them right away, because they are evidence,
2. remove `AdministratorAccess` from the user `svc-backup` (`aws iam detach-user-policy`),
3. stop the instances the attacker launched in `us-east-1`, but **snapshot** them before stopping, for forensics.

```bash
cat > /root/ir/containment.sh <<'EOF'
#!/bin/bash
set -euo pipefail
aws iam update-access-key --user-name ci-deploy  --access-key-id AKIAQEXAMPLECIDEPLOY --status Inactive
aws iam update-access-key --user-name svc-backup --access-key-id AKIAQEXAMPLESVCBACKP --status Inactive
aws iam detach-user-policy --user-name svc-backup --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
# for each instance: aws ec2 create-snapshots --instance-specification InstanceId=... then aws ec2 stop-instances
EOF
```

Then add the commands for the instances. You have the list of IDs in the logs (`responseElements.instancesSet.items[].instanceId`).

After containment: CI moves to **OIDC federation** (no static keys), you delete the attacker's resources only once the evidence is preserved, and the root cause (the key leaked from a CI log) goes into the post-incident report.

<!-- verify
f=/root/ir/containment.sh
[ -f $f ] || { echo "containment.sh is missing"; exit 1; }
bash -n $f || { echo "Syntax error in the script"; exit 1; }
for k in AKIAQEXAMPLECIDEPLOY AKIAQEXAMPLESVCBACKP; do grep -E "update-access-key.*$k.*Inactive|update-access-key.*Inactive.*$k" $f >/dev/null || { echo "Key $k is not deactivated"; exit 1; }; done
grep -q 'detach-user-policy.*svc-backup.*AdministratorAccess' $f || { echo "AdministratorAccess is not removed from svc-backup"; exit 1; }
grep -q 'delete-access-key' $f && { echo "Do not delete the keys right away: deactivate them"; exit 1; }
ids=$(jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | .responseElements.instancesSet.items[].instanceId' /root/ir/events.jsonl)
for i in $ids; do grep -q "$i" $f || { echo "Instance $i is not in the plan"; exit 1; }; done
grep -q 'create-snapshot' $f || { echo "No snapshot before stopping"; exit 1; }
grep -q 'stop-instances' $f || { echo "Instances are not stopped"; exit 1; }
grep -q -- '--region us-east-1' $f || { echo "Instance commands must target --region us-east-1"; exit 1; }
-->
<!-- hint
Generate the commands with a loop:

    for i in $(jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | .responseElements.instancesSet.items[].instanceId' /root/ir/events.jsonl); do
      echo "aws ec2 create-snapshots --region us-east-1 --instance-specification InstanceId=$i --description incident-2026-10-14"
      echo "aws ec2 stop-instances --region us-east-1 --instance-ids $i"
    done >> /root/ir/containment.sh

The instances were launched in `us-east-1`, and the CLI's default Region is different.
-->
<!-- solution
cd /root/ir
printf '#!/bin/bash\nset -euo pipefail\naws iam update-access-key --user-name ci-deploy --access-key-id AKIAQEXAMPLECIDEPLOY --status Inactive\naws iam update-access-key --user-name svc-backup --access-key-id AKIAQEXAMPLESVCBACKP --status Inactive\naws iam detach-user-policy --user-name svc-backup --policy-arn arn:aws:iam::aws:policy/AdministratorAccess\n' > containment.sh
for i in $(jq -r 'select(.eventName == "RunInstances" and .sourceIPAddress == "203.0.113.77") | .responseElements.instancesSet.items[].instanceId' events.jsonl); do echo "aws ec2 create-snapshots --region us-east-1 --instance-specification InstanceId=$i --description incident"; echo "aws ec2 stop-instances --region us-east-1 --instance-ids $i"; done >> containment.sh
-->
