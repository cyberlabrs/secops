# Lab 1: Leaked AWS key, from git history to the report

Monday, 19. 10. 2026, 08:10. The on-call SOC analyst at **Kvadrat d.o.o.** sees a low-severity GuardDuty finding `PenTest:IAMUser/KaliLinux` from 02:14 (UTC) for the IAM user `svc-izvjestaji`. That user has a static access key used by the nightly report service. Nobody was running Kali Linux.

You have:

- `/root/izvjestaji-servis/`: the service's git repo (a copy from the internal GitLab; the project was `public` by mistake),
- `/root/ci/`: CI job logs for that project,
- `/root/cloudtrail/events.jsonl`: a CloudTrail export (management and S3 data events), one event per line, from 18. 10. 00:00 to 19. 10. 09:00 UTC.

Write answers to `/root/odgovori/`, containment artifacts to `/root/obuzdavanje/`, and the detection to `/root/detekcije/`.

Known legitimate sources:

| Source | What it is |
|---|---|
| `192.0.2.50` | report server, the only legitimate user of the `svc-izvjestaji` key |
| `192.0.2.60` | Jenkins (`jenkins-legacy`) |
| `192.0.2.10` | office (SOC, console via SSO) |
| `192.0.2.77` | Marko Petrović, VPN |
| `10.20.0.0/16` | VPC (applications via the S3 VPC endpoint) |
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

## Where the key leaked from

The key is usually in the repo history, not in the current version of the code. Scan the **entire history** with gitleaks, then confirm the finding with git:

```bash
cd /root/izvjestaji-servis
grep -rn AKIA .                     # current version: only the documentation example in a test
gitleaks git -v .                   # entire history
git log --oneline --stat
git log -p -S 'AKIA4' -- config/settings.py
gitleaks dir -v /root/ci            # CI logs are a leak source too
```

Write:

- `/root/odgovori/kljuc.txt`: the access key ID that leaked,
- `/root/odgovori/commit.txt`: the hash of the commit that **introduced** the key (full or at least 7 characters),
- `/root/odgovori/ci-job.txt`: the number of the CI job whose log printed the key.

<!-- verify
O=/root/odgovori
grep -qx 'AKIA4NQXR7ZK2LWB5HTM' $O/kljuc.txt 2>/dev/null || { echo "kljuc.txt: write the access key ID (AKIA...) that gitleaks finds in the history"; exit 1; }
full=$(git -C /root/izvjestaji-servis log --reverse -S AKIA4NQXR7ZK2LWB5HTM --format=%H | head -1)
c=$(head -1 $O/commit.txt 2>/dev/null | awk '{print $1}' | tr -d '\r')
[ ${#c} -ge 7 ] && [ "${full#"$c"}" != "$full" ] || { echo "commit.txt: needs the hash of the commit that added the key (not the one that removed it)"; exit 1; }
grep -qx '4812' $O/ci-job.txt 2>/dev/null || { echo "ci-job.txt: write only the job number (from the log name or header)"; exit 1; }
-->
<!-- hint
`gitleaks git -v .` prints `Commit`, `File` and `Line` for each finding. `AKIAIOSFODNN7EXAMPLE` in the test is an example from the AWS documentation and gitleaks deliberately ignores it. The commit that removed the key (`git log -S` shows it too) is not the answer: you want the first one, `git log --reverse -S AKIA4NQXR7ZK2LWB5HTM --format=%H | head -1`.
-->
<!-- solution
cd /root/izvjestaji-servis
echo AKIA4NQXR7ZK2LWB5HTM > /root/odgovori/kljuc.txt
git log --reverse -S AKIA4NQXR7ZK2LWB5HTM --format=%H | head -1 > /root/odgovori/commit.txt
echo 4812 > /root/odgovori/ci-job.txt
-->

## What was done with the stolen key

First look at who uses the key, from which addresses and with which tool:

```bash
cd /root/cloudtrail
K=AKIA4NQXR7ZK2LWB5HTM
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k) | [.sourceIPAddress, .userAgent[0:60]] | @tsv' events.jsonl | sort | uniq -c
```

The report server uses Boto3 from `192.0.2.50`. Everything else is the attacker. Create `/root/odgovori/kljuc-napadac.tsv`: all events with the key `AKIA4NQXR7ZK2LWB5HTM` whose `sourceIPAddress` is not `192.0.2.50`, in chronological order, with four tab-separated columns: `eventTime`, `sourceIPAddress`, `eventName`, `errorCode` (or `OK` when there is no error).

```bash
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k and .sourceIPAddress!="192.0.2.50")
  | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' events.jsonl
```

Notice the pattern: `GetCallerIdentity` (who am I?), then enumeration (`ListUsers`, `GetAccountAuthorizationDetails`), then a series of `AccessDenied` errors (the attacker probing the key's limits), then sudden success where it was previously denied.

<!-- verify
f=/root/odgovori/kljuc-napadac.tsv
[ -s $f ] || { echo "missing $f"; exit 1; }
jq -r 'select(.userIdentity.accessKeyId=="AKIA4NQXR7ZK2LWB5HTM" and .sourceIPAddress!="192.0.2.50") | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' /root/cloudtrail/events.jsonl | sort > /tmp/ref2.tsv
tr -d '\r' < $f | grep . | sort > /tmp/moj2.tsv
cmp -s /tmp/moj2.tsv /tmp/ref2.tsv || { echo "kljuc-napadac.tsv does not match the reference: yours has $(wc -l < /tmp/moj2.tsv) rows, expected $(wc -l < /tmp/ref2.tsv) (check columns, tabs and OK for successful calls)"; exit 1; }
-->
<!-- hint
The query above, with redirection: `... events.jsonl > /root/odgovori/kljuc-napadac.tsv`. `@tsv` separates columns with tabs; `.errorCode // "OK"` yields `OK` when the field is missing.
-->
<!-- solution
jq -r 'select(.userIdentity.accessKeyId=="AKIA4NQXR7ZK2LWB5HTM" and .sourceIPAddress!="192.0.2.50") | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' /root/cloudtrail/events.jsonl > /root/odgovori/kljuc-napadac.tsv
-->

## Privilege escalation and persistence

The `svc-izvjestaji` key had no access to the customer database, and then it suddenly did. Look at IAM changes (`readOnly == false`) and at what is in `requestParameters` and `responseElements`:

```bash
jq -r 'select(.eventSource=="iam.amazonaws.com" and .readOnly==false)
  | [.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventName,
     (.requestParameters.userName // .requestParameters.policyArn // "-"),
     (.responseElements.accessKey.accessKeyId // .responseElements.policyVersion.versionId // "-")] | @tsv' events.jsonl
jq -r 'select(.eventName=="CreatePolicyVersion") | .requestParameters.policyDocument | fromjson' events.jsonl
```

Every new key is a new lead. Pivot: from which addresses were the keys the attacker created used?

```bash
jq -r 'select(.userIdentity.accessKeyId=="AKIA4NQXR7ZKWJ3D6PQA") | [.eventTime, .sourceIPAddress, .eventName] | @tsv' events.jsonl | head
```

Write:

- `/root/odgovori/eskalacija.txt`: the API call the attacker used to escalate privileges and the ARN of the policy they modified,
- `/root/odgovori/perzistencija.txt`: the name of the IAM user they created and **all** access key IDs they created (one per line),
- `/root/odgovori/ip-adrese.txt`: all of the attacker's IP addresses, one per line.

<!-- verify
O=/root/odgovori
grep -q 'CreatePolicyVersion' $O/eskalacija.txt 2>/dev/null && grep -q 'arn:aws:iam::111122223333:policy/izvjestaji-s3-export' $O/eskalacija.txt || { echo "eskalacija.txt: needs the API call and the full ARN of the modified policy"; exit 1; }
for x in aws-support-sync AKIA4NQXR7ZKWJ3D6PQA AKIA4NQXR7ZKM5T2YVCE; do
  grep -q "$x" $O/perzistencija.txt 2>/dev/null || { echo "perzistencija.txt: one of the attacker's artifacts (user or key) is missing"; exit 1; }
done
grep -q 'AKIA4NQXR7ZKBH6LF3RU' $O/perzistencija.txt && { echo "perzistencija.txt: AKIA4NQXR7ZKBH6LF3RU is the legitimate Jenkins key, the attacker did not create it"; exit 1; }
[ "$(tr -d '\r ' < $O/ip-adrese.txt 2>/dev/null | grep . | sort -u | paste -sd,)" = "198.51.100.23,203.0.113.45" ] || { echo "ip-adrese.txt: needs exactly all of the attacker's addresses (including those from which the new keys were used)"; exit 1; }
-->
<!-- hint
The escalation is `CreatePolicyVersion` with `setAsDefault: true` on a policy attached to `svc-izvjestaji` itself (the policy allowed `iam:CreatePolicyVersion`, a classic escalation path). Persistence: `CreateUser` + `AttachUserPolicy` + `CreateAccessKey` + `CreateLoginProfile` for `aws-support-sync`, and one `CreateAccessKey` for the **existing** user `jenkins-legacy`. The second address only shows up when you filter by the new keys.
-->
<!-- solution
O=/root/odgovori
printf 'CreatePolicyVersion\narn:aws:iam::111122223333:policy/izvjestaji-s3-export\n' > $O/eskalacija.txt
printf 'aws-support-sync\nAKIA4NQXR7ZKWJ3D6PQA\nAKIA4NQXR7ZKM5T2YVCE\n' > $O/perzistencija.txt
printf '203.0.113.45\n198.51.100.23\n' > $O/ip-adrese.txt
-->

## Damage assessment: what was read from S3

S3 data events record every `GetObject`, with the size in `additionalEventData.bytesTransferredOut`. Watch out for three pitfalls:

- `kvadrat-kupci-prod` is legitimately read by both the application (`10.20.3.14`) and the report server (`192.0.2.50`),
- a denied `GetObject` (`AccessDenied`) is not a leak,
- the attacker read from **both** addresses and with **two** keys.

```bash
jq -r 'select(.eventName=="GetObject") | [.sourceIPAddress, .userIdentity.accessKeyId, (.errorCode // "OK")] | @tsv' events.jsonl | sort | uniq -c
```

Write:

- `/root/odgovori/procitano.txt`: every object the attacker successfully read, as `bucket/key`, one per line, without duplicates,
- `/root/odgovori/bajtova.txt`: the total number of bytes the attacker downloaded (the sum of `bytesTransferredOut` over all their successful `GetObject` calls, repeated ones included).

<!-- verify
O=/root/odgovori
sel='select(.eventName=="GetObject" and (.errorCode|not) and (.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23"))'
jq -r "$sel | .requestParameters.bucketName + \"/\" + .requestParameters.key" /root/cloudtrail/events.jsonl | sort -u > /tmp/ref4.txt
[ -s $O/procitano.txt ] || { echo "missing procitano.txt"; exit 1; }
tr -d '\r ' < $O/procitano.txt | grep . | sort -u > /tmp/moj4.txt
cmp -s /tmp/moj4.txt /tmp/ref4.txt || { echo "procitano.txt: $(wc -l < /tmp/moj4.txt) objects, expected $(wc -l < /tmp/ref4.txt) (only successful GetObject from the attacker's addresses)"; exit 1; }
want=$(jq -s "[.[] | $sel | .additionalEventData.bytesTransferredOut] | add" /root/cloudtrail/events.jsonl)
[ "$(tr -d '\r \n' < $O/bajtova.txt 2>/dev/null)" = "$want" ] || { echo "bajtova.txt: the bytesTransferredOut sum is not correct"; exit 1; }
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

## Containment and eradication

There is no AWS CLI here, so you prepare the artifacts the team would apply:

1. `/root/obuzdavanje/deny-all.json`: an IAM policy (`Version` `2012-10-17`) with a statement `Effect: Deny`, `Action: "*"`, `Resource: "*"`. It is attached as an inline policy to the compromised users and immediately blocks **all** their keys, including ones you have not found yet. No `NotAction` and no conditions that weaken it (the only allowed condition is `aws:TokenIssueTime`, as AWS uses for revoking role sessions).
2. `/root/obuzdavanje/kljucevi.txt`: the access key IDs to deactivate and then delete, one per line. Do not touch the legitimate Jenkins key (that would break the build), only the one the attacker created.
3. `/root/obuzdavanje/komande.sh`: the AWS CLI commands in order (syntactically valid bash): `update-access-key ... --status Inactive` for each key, `put-user-policy` with `deny-all.json` for `svc-izvjestaji` and `aws-support-sync` (not for `jenkins-legacy`), `delete-login-profile` for `aws-support-sync`, and `set-default-policy-version` that reverts `izvjestaji-s3-export` to `v2`.

```bash
jq . /root/obuzdavanje/deny-all.json
bash -n /root/obuzdavanje/komande.sh && echo OK
```

<!-- verify
P=/root/obuzdavanje
jq -e '.Version == "2012-10-17"' $P/deny-all.json >/dev/null 2>&1 || { echo "deny-all.json is not valid JSON or Version is not 2012-10-17"; exit 1; }
jq -e '[.Statement] | flatten | any(.Effect=="Deny" and ((.Action=="*") or (.Action==["*"])) and ((.Resource=="*") or (.Resource==["*"])) and (.NotAction|not) and (.NotResource|not) and ((.Condition|not) or ((.Condition|tostring|test("TokenIssueTime")) and ((.Condition|tostring|test("SourceIp|Region|Principal|UserAgent"))|not))))' $P/deny-all.json >/dev/null || { echo "deny-all.json: needs a Deny statement, Action *, Resource *, without NotAction/NotResource and without conditions (except aws:TokenIssueTime)"; exit 1; }
[ "$(tr -d '\r ' < $P/kljucevi.txt 2>/dev/null | grep . | sort -u | paste -sd,)" = "AKIA4NQXR7ZK2LWB5HTM,AKIA4NQXR7ZKM5T2YVCE,AKIA4NQXR7ZKWJ3D6PQA" ] || { echo "kljucevi.txt: needs exactly the leaked key and both keys the attacker created"; exit 1; }
k=$P/komande.sh
bash -n $k 2>/dev/null || { echo "komande.sh is not syntactically valid bash"; exit 1; }
for x in AKIA4NQXR7ZK2LWB5HTM AKIA4NQXR7ZKM5T2YVCE AKIA4NQXR7ZKWJ3D6PQA; do
  grep 'update-access-key' $k | grep "$x" | grep -q 'Inactive' || { echo "komande.sh: update-access-key --status Inactive is missing for one of the keys"; exit 1; }
done
grep -q 'AKIA4NQXR7ZKBH6LF3RU' $k && { echo "komande.sh: do not touch the legitimate Jenkins key AKIA4NQXR7ZKBH6LF3RU"; exit 1; }
for u in svc-izvjestaji aws-support-sync; do
  grep 'put-user-policy' $k | grep -q -- "$u" || { echo "komande.sh: put-user-policy with deny-all.json is missing for a compromised user"; exit 1; }
done
grep 'put-user-policy' $k | grep -q 'jenkins-legacy' && { echo "komande.sh: deny-all on jenkins-legacy would break the build; disabling the attacker's key is enough"; exit 1; }
grep 'delete-login-profile' $k | grep -q 'aws-support-sync' || { echo "komande.sh: delete-login-profile for aws-support-sync is missing"; exit 1; }
grep 'set-default-policy-version' $k | grep 'izvjestaji-s3-export' | grep -q 'v2' || { echo "komande.sh: set-default-policy-version is missing (revert izvjestaji-s3-export to v2)"; exit 1; }
-->
<!-- hint
```bash
aws iam update-access-key --user-name svc-izvjestaji --access-key-id AKIA4NQXR7ZK2LWB5HTM --status Inactive
aws iam put-user-policy --user-name svc-izvjestaji --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam delete-login-profile --user-name aws-support-sync
aws iam set-default-policy-version --policy-arn arn:aws:iam::111122223333:policy/izvjestaji-s3-export --version-id v2
```
Keys are first **deactivated** (reversible, evidence is kept) and deleted only when the investigation is finished.
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

## Sigma detection for CloudTrail being disabled

The SCP denied `StopLogging` and `DeleteTrail`, but nobody saw it until morning. Write `/root/detekcije/aws_cloudtrail_stop_or_delete.yml`:

- `logsource`: `product: aws`, `service: cloudtrail`,
- `detection`: `eventSource` is `cloudtrail.amazonaws.com` and `eventName` is `StopLogging` or `DeleteTrail` (denied attempts are an alert too),
- `tags`: `attack.defense-impairment` and `attack.t1685.002` (formerly T1562.008), `level: high`, `falsepositives`.

`sigma check` must pass with no errors or warnings, and Zircolite over CloudTrail must find exactly those two attempts (and not Marko's `DescribeTrails` or the SOC's `LookupEvents`):

```bash
cd /root/detekcije
sigma check aws_cloudtrail_stop_or_delete.yml
zircolite -e /root/cloudtrail/events.jsonl -j -r aws_cloudtrail_stop_or_delete.yml -o /tmp/z.json -q
jq -r '.[].matches[] | [.eventTime, .eventName, .sourceIPAddress, .errorCode] | @tsv' /tmp/z.json
```

<!-- verify
f=/root/detekcije/aws_cloudtrail_stop_or_delete.yml
[ -f $f ] || { echo "missing $f"; exit 1; }
sigma check $f > /tmp/sc.txt 2>&1 || { tail -8 /tmp/sc.txt; echo "sigma check reports an error"; exit 1; }
grep -q 'Found 0 errors, 0 condition errors and 0 issues' /tmp/sc.txt || { grep -iE 'issue|error' /tmp/sc.txt | head -5; echo "sigma check reports errors or warnings"; exit 1; }
[ "$(yq '.logsource.product' $f)" = "aws" ] && [ "$(yq '.logsource.service' $f)" = "cloudtrail" ] || { echo "logsource needs product: aws, service: cloudtrail"; exit 1; }
yq '.tags[]' $f | grep -qx 'attack.t1685.002' || { echo "tags needs attack.t1685.002"; exit 1; }
cd /tmp && rm -f /tmp/vz.json
zircolite -e /root/cloudtrail/events.jsonl -j -r $f -o /tmp/vz.json -q >/dev/null 2>&1
got=$(jq -r '[.[].matches[]?.eventID] | sort | join(",")' /tmp/vz.json 2>/dev/null)
want=$(jq -r 'select(.eventName=="StopLogging" or .eventName=="DeleteTrail") | .eventID' /root/cloudtrail/events.jsonl | sort | paste -sd,)
[ "$got" = "$want" ] || { echo "Zircolite finds $(echo "$got" | tr ',' '\n' | grep -c .) events, expected exactly 2 (StopLogging and DeleteTrail)"; exit 1; }
-->
<!-- hint
```yaml
title: AWS CloudTrail stopped or deleted
id: 4c7e2a19-8b3d-4f6a-9e21-0d5c3b7a1f84
status: test
description: Attempt to stop or delete a CloudTrail trail, successful or denied
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
  - Planned trail replacement with an approved change request
level: high
```
`eventSource: cloudtrail.amazonaws.com` alone would also catch `DescribeTrails` and `LookupEvents`.
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

## Timeline and report

Write `/root/odgovori/izvjestaj.md` (in English or Serbian):

- a **timeline** with at least 8 dated entries (UTC): from the commit and CI job on 12. 10, through the attacker's first call, escalation, persistence and data access, to the attempts to disable CloudTrail and the detection,
- the leak source (commit `bcf32b3`, job 4812), the key, both attacker IP addresses, the user `aws-support-sync`,
- impact: buckets and number of objects read (`kvadrat-kupci-prod`, `kvadrat-finansije`), mention of the notification obligation (customer personal data),
- **recommendations**: what would have prevented the attack or detected it earlier.

```bash
jq -r 'select(.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23") | [.eventTime, .userIdentity.userName, .eventName, (.errorCode // "OK")] | @tsv' /root/cloudtrail/events.jsonl
```

<!-- verify
f=/root/odgovori/izvjestaj.md
[ -s $f ] || { echo "missing $f"; exit 1; }
for x in AKIA4NQXR7ZK2LWB5HTM 203.0.113.45 198.51.100.23 aws-support-sync kvadrat-kupci-prod kvadrat-finansije CreatePolicyVersion bcf32b3 4812; do
  grep -q -- "$x" $f || { echo "the report is missing a key fact ($x)"; exit 1; }
done
[ "$(grep -cE '2026-10-1[2-9]' $f)" -ge 8 ] || { echo "the timeline needs at least 8 dated entries (2026-10-..)"; exit 1; }
grep -Eqi 'vremensk|timeline' $f || { echo "the timeline section is missing"; exit 1; }
grep -Eqi 'preporu|recommend' $f || { echo "recommendations are missing"; exit 1; }
-->
<!-- hint
Skeleton: `# Incident: leaked svc-izvjestaji key`, `## Summary`, `## Timeline` (a table or list such as `2026-10-19T02:14:07Z GetCallerIdentity from 203.0.113.45`), `## Impact`, `## Containment`, `## Recommendations` (pre-commit gitleaks, masked CI variables, no static keys: OIDC/IAM roles, data events and an alert on StopLogging, removing `iam:CreatePolicyVersion` from service policies).
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
