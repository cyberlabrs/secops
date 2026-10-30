## What this scenario covers

The scenario covers all four objectives of domain 2:

- **2.1** Finding the source of the leak: git history, gitleaks, CI logs.
- **2.2** CloudTrail investigation: enumeration, privilege escalation, persistence.
- **2.3** Damage assessment: S3 data access, scope and impact.
- **2.4** Containment and eradication in AWS, and a Sigma detection for the future.

This is the most common cloud incident in practice: a static access key ends up somewhere anyone can see it, and an attacker finds it before the team does. The tools are familiar from other courses (gitleaks from DevSecOps, CloudTrail from AWS Security Specialty and the detection lab, Sigma and Zircolite from course 07). What is new is that you use them in order, under pressure, with one question in mind: **what could the attacker do, what did they do, and how do you kick them out without taking down production**.

## The story

**Kvadrat d.o.o.** is a logistics and online retail company with a single production AWS account (`111122223333`) in an organization with SCPs. People in the story:

| Person / account | Role |
|---|---|
| Marko Petrović | developer of the `izvjestaji-servis` service |
| Jelena Ilić | developer, teammate |
| Ana Kovač | SOC analyst, on call Monday morning |
| `svc-izvjestaji` | IAM user with a static key; the nightly service reads the customer export and writes reports |
| `jenkins-legacy` | old IAM user for Jenkins builds, has its own key |
| `kupci-api-ecs-task` | application IAM role; reads customer profiles through a VPC endpoint |

The `izvjestaji-s3-export` policy attached to `svc-izvjestaji` allows reading `kvadrat-kupci-prod/exports/*` and writing to `kvadrat-izvjestaji`. Someone had earlier also added `iam:Get*`, `iam:List*` and `iam:CreatePolicyVersion` on that policy, "so the service can update its own permissions". That is the hole the attacker went through.

### Timeline

| Time (UTC) | Event |
|---|---|
| 12. 10. 11:58 | Marko commits `config/settings.py` with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` ("Brzi fix: export radi i sa laptopa") |
| 12. 10. 12:21 | CI job 4812 runs `env \| sort` for debugging; CI variables are not masked and the key ends up in the log. The project is `public` by mistake |
| 13. 10. 07:12 | Marko removes the key from the code ("Očisti konfiguraciju"). The key is **not rotated**: the commit stays in history, and the log of job 4812 is still public |
| 19. 10. 02:14 | First call from `203.0.113.45` (AWS CLI on Kali Linux): `GetCallerIdentity`, then IAM and S3 enumeration |
| 19. 10. 02:16–02:17 | `AccessDenied` on the customer database and EC2: the key lacks those permissions |
| 19. 10. 02:19 | `CreatePolicyVersion` with `setAsDefault: true`: the new policy version `v3` grants `"Action": "*"` |
| 19. 10. 02:20–02:21 | `CreateUser aws-support-sync`, `AttachUserPolicy AdministratorAccess`, `CreateAccessKey`, `CreateLoginProfile`, then `CreateAccessKey` for the existing `jenkins-legacy` too |
| 19. 10. 02:41–02:44 | From a second address (`198.51.100.23`, VPS) with the new key: download of the customer database, card tokens, contracts and financial reports |
| 19. 10. 02:47–02:48 | `StopLogging`, `DeleteTrail` and `DeleteDetector`: all denied by the SCP |
| 19. 10. 08:10 | Ana sees a low-severity GuardDuty finding `PenTest:IAMUser/KaliLinux` |

Note the seven-day gap between the leak and the attack, and the six hours between the attack and the response. Removing the key from the code on 13. 10. solved nothing: the only correct response to a leaked key is **rotation** (deactivation and a new key), immediately.

## Attack chain and MITRE ATT&CK

| Phase | What the attacker did | Evidence | ATT&CK |
|---|---|---|---|
| Finding the secret | key in a public repo and CI log | git history, CI log | T1593.003 Search Open Websites/Domains: Code Repositories, T1552.001 Credentials In Files |
| Initial access | call from a foreign address with a valid key | CloudTrail `GetCallerIdentity` | T1078.004 Valid Accounts: Cloud Accounts |
| Reconnaissance | `ListUsers`, `GetAccountAuthorizationDetails`, `ListBuckets`, `ListObjects` | CloudTrail | T1087.004 Account Discovery: Cloud Account, T1580, T1619 Cloud Storage Object Discovery |
| Escalation | new default version of its own policy | `CreatePolicyVersion` | T1098.003 Additional Cloud Roles |
| Persistence | new user, admin policy, key and password; second key for `jenkins-legacy` | `CreateUser`, `AttachUserPolicy`, `CreateAccessKey`, `CreateLoginProfile` | T1136.003 Create Account: Cloud Account, T1098.001 Additional Cloud Credentials |
| Collection | `GetObject` on the database, contracts, finance | S3 data events | T1530 Data from Cloud Storage |
| Impairing defenses | `StopLogging`, `DeleteTrail`, `DeleteDetector` (denied) | CloudTrail `errorCode` | T1685.002 Disable or Modify Cloud Log (formerly T1562.008), T1685 (formerly T1562.001) |

Newer ATT&CK versions split the Defense Evasion tactic into **Stealth** and **Defense Impairment**, so the log-disabling techniques got new IDs. SigmaHQ rules already use `attack.defense-impairment` and `attack.t1685.002`; you will still run into the old ID in tools and reports.

## Phase 1: where the key leaked from (2.1)

The first question is not "who is the attacker" but "how long and where was the key exposed". That determines the period you search in CloudTrail and the list of places that need cleaning.

### Git history

`grep` over the current version of the code finds nothing, because the key has been removed. Git keeps every commit, so the key stays in the history, in every cloned repo and in every fork:

```bash
cd izvjestaji-servis
gitleaks git -v .                              # scans all commits
gitleaks git --report-format json --report-path leaks.json .
jq -r '.[] | [.Commit[0:8], .File, .StartLine, .RuleID, .Date] | @tsv' leaks.json
git log --reverse -S 'AKIA4NQXR7ZK2LWB5HTM' --format='%h %ad %an %s' --date=iso
git show bcf32b3 -- config/settings.py
```

`git log -S` (pickaxe) shows commits in which the number of occurrences of the string changed: the one that added it and the one that removed it. For the timeline you need the first. Gitleaks deliberately ignores `AKIAIOSFODNN7EXAMPLE` from the AWS documentation (the rule has an allowlist for keys ending in `EXAMPLE`), so the test fixture is not a false positive.

> **In practice:** Rewriting history (`git filter-repo`, BFG) is cosmetic after rotation, not a substitute for it. Copies are already in clones, forks, CI caches and archives you have no control over. Rotate first, then clean up.

### CI logs

The second source is the job log. The debug step `env | sort` printed all environment variables, and the CI variables holding the key were not marked as **masked**:

```bash
gitleaks dir -v ci/
grep -n 'AWS_' ci/*.log
```

CI logs are often visible more widely than the code (public projects, guests, artifacts kept for months). When assessing exposure you therefore also look at project visibility, who could see the log and how long logs are retained. Here the key was public from 12. 10. 12:21, so you search CloudTrail at least from that moment.

## Phase 2: CloudTrail investigation (2.2)

The export is one event per line. If you have files from S3 (`{"Records":[...]}`), `jq -c '.Records[]'` converts them into the same form.

### Who uses the key

```bash
K=AKIA4NQXR7ZK2LWB5HTM
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k) | [.sourceIPAddress, .userAgent[0:50]] | @tsv' events.jsonl | sort | uniq -c
```

The legitimate service calls from `192.0.2.50` through Boto3, every night at 01:00, always the same calls. The attacker calls from a new address, with the AWS CLI, with `md/distrib#kali` in the User-Agent (which is why GuardDuty reports `PenTest:IAMUser/KaliLinux`). New IP address + new tool + `GetCallerIdentity` as the first call is the classic signature of a stolen key.

### Enumeration and errors

```bash
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k and .sourceIPAddress!="192.0.2.50")
  | [.eventTime, .eventName, (.errorCode // "OK")] | @tsv' events.jsonl
```

`GetAccountAuthorizationDetails` returns all users, roles, groups and policies with their documents in a single call. For the attacker it is a map of the account; for you it is a sign that the attacker knows everything you do. The series of `AccessDenied` errors shows how they probed the key's limits.

### Escalation through CreatePolicyVersion

```bash
jq 'select(.eventName=="CreatePolicyVersion") | {eventTime, policy: .requestParameters.policyArn,
    default: .requestParameters.setAsDefault, doc: (.requestParameters.policyDocument | fromjson),
    version: .responseElements.policyVersion.versionId}' events.jsonl
```

A managed policy can have up to five versions, one of which is the default. Whoever has `iam:CreatePolicyVersion` on a policy attached to themselves can write a version with `"Action": "*"` and set it as the default. This does not require `iam:SetDefaultPolicyVersion`: the `setAsDefault` parameter is enough. It is one of the well-known IAM escalation paths, along with `AttachUserPolicy`, `PutUserPolicy`, `PassRole` + `RunInstances` and `UpdateAssumeRolePolicy`. Tools such as PMapper or IAM Access Analyzer look for the same pattern.

### Persistence and pivoting to new keys

```bash
jq -r 'select(.eventSource=="iam.amazonaws.com" and .readOnly==false)
  | [.eventTime, .eventName, (.requestParameters.userName // "-"),
     (.requestParameters.policyArn // "-"), (.responseElements.accessKey.accessKeyId // "-")] | @tsv' events.jsonl
```

Two things are easy to miss:

- `CreateAccessKey` for the **existing** user `jenkins-legacy`. A new user stands out, but a second key for an old service account does not. `requestParameters.userName` holds the target and `userIdentity` the caller; when they differ, someone is creating a key for someone else.
- `CreateLoginProfile` also gives the new user a console password. A deactivated key does not close that path.

Every `accessKeyId` in `responseElements` is a new lead. Only by filtering on them do you see the attacker's second address:

```bash
for k in AKIA4NQXR7ZKWJ3D6PQA AKIA4NQXR7ZKM5T2YVCE; do
  jq -r --arg k $k 'select(.userIdentity.accessKeyId==$k) | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' events.jsonl
done
```

## Phase 3: damage assessment (2.3)

Management and legal ask only one thing: **what data got out**. The answer depends on whether **S3 data events** are enabled for the bucket. Without them CloudTrail records only management calls (`ListBuckets`, `GetBucketAcl`), so you can prove neither that data was read nor that it was not. Legal then has to assume the worst.

```bash
S='select(.eventName=="GetObject" and (.errorCode|not) and (.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23"))'
jq -r "$S | [.eventTime, .userIdentity.userName, .requestParameters.bucketName + \"/\" + .requestParameters.key, .additionalEventData.bytesTransferredOut] | @tsv" events.jsonl
jq -s "[.[] | $S | .additionalEventData.bytesTransferredOut] | add" events.jsonl
```

Counting pitfalls:

| Pitfall | How to avoid it |
|---|---|
| The same bucket is legitimately read by the application (`10.20.3.14`) and the report server | filter by the attacker's identity **and** address, not by bucket |
| Denied `GetObject` (`AccessDenied`) | not a leak, but it shows intent; list it separately |
| The attacker switches key and address | include all credentials from the persistence phase |
| Same object read twice | for the object list use `sort -u`, for data volume sum everything |
| `ListObjects` | reveals object names (and personal data in them), even without `GetObject` |

In this scenario the attacker read 11 objects (about 122 MB of downloaded traffic, because they downloaded the full database twice): the full customer database, shipping addresses, card tokens, five contracts, one daily export and two financial reports. This is customer personal data, so there is an obligation to notify the data protection authority (under GDPR within 72 hours of becoming aware) and, depending on the risk assessment, to notify customers. Card tokens also involve the payment processor (PCI DSS). So you write the scope assessment factually: what was definitely read, what was attempted, and what cannot be determined.

## Decision points

**Shut it down immediately or observe first?** The attacker has admin rights and is active in the account, so observing carries too much risk. Observation makes sense when access is limited and you need to uncover additional attacker infrastructure. Here you contain first.

**What first?** Whatever closes the most paths fastest and can be reverted:

1. Inline `Deny *` policy on `svc-izvjestaji` and `aws-support-sync`. It takes effect immediately on all their keys, including ones you may not have found yet, and does not delete evidence.
2. Deactivate (`Inactive`) all three keys: the leaked one and the two the attacker created. Delete only after the investigation.
3. Delete the `aws-support-sync` login profile and revert the `izvjestaji-s3-export` policy to `v2` (then delete `v3`).
4. Search for other traces across the whole account and all regions: roles with new trust policies, Lambda functions, EC2 key pairs, new IAM Identity Center users.

**What not to do:** `Deny *` on `jenkins-legacy` would break build and deploy. It is enough to disable only the key the attacker created (`AKIA4NQXR7ZKM5T2YVCE`), and leave the legitimate key until Jenkins is moved to a role. Also do not delete the attacker's user before you preserve its policies and keys as evidence.

**Roles and sessions:** an IAM user's static key is disabled by deactivation. You cannot delete a role's temporary (STS) credentials, so you use a Deny with an `aws:TokenIssueTime` condition (the Revoke active sessions option in the console). In this scenario the attacker did not assume any roles, which you verified by searching for `AssumeRole` events.

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Sid": "IRDenyAll", "Effect": "Deny", "Action": "*", "Resource": "*" }]
}
```

## Containment, eradication and recovery (2.4)

```bash
POL=arn:aws:iam::111122223333:policy/izvjestaji-s3-export
aws iam put-user-policy --user-name svc-izvjestaji --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam put-user-policy --user-name aws-support-sync --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam update-access-key --user-name svc-izvjestaji --access-key-id AKIA4NQXR7ZK2LWB5HTM --status Inactive
aws iam update-access-key --user-name aws-support-sync --access-key-id AKIA4NQXR7ZKWJ3D6PQA --status Inactive
aws iam update-access-key --user-name jenkins-legacy --access-key-id AKIA4NQXR7ZKM5T2YVCE --status Inactive
aws iam delete-login-profile --user-name aws-support-sync
aws iam set-default-policy-version --policy-arn $POL --version-id v2
aws iam delete-policy-version --policy-arn $POL --version-id v3
```

After containment, check whether anything still works: new calls from the attacker's addresses, `AccessDenied` from disabled keys (a sign the attacker is still trying to use them), and keys and users you have not found.

Eradication and recovery:

- move the report service from a static key to an IAM role (on EC2 or ECS) and delete `svc-izvjestaji` once it is no longer needed,
- remove `iam:*` from the service policy; services do not need IAM permissions, and for people who have them set a **permission boundary**,
- CI: masked and protected variables, OIDC instead of keys (GitLab `id_tokens` → `AssumeRoleWithWebIdentity`), project `private`, delete the log of job 4812,
- review `jenkins-legacy` and other old keys (`iam generate-credential-report`), disable unused ones,
- only at the end delete `aws-support-sync` and the attacker's keys, with evidence preserved (CloudTrail export, `get-account-authorization-details` before and after).

The attack was stopped by an **SCP** that forbids `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail` and `guardduty:DeleteDetector` for everyone except the break-glass role. Not even `AdministratorAccess` can bypass an SCP, so the logs were preserved. Without it the investigation would be guesswork.

## What would have detected it earlier

| Control | Where it would have broken the chain |
|---|---|
| gitleaks in a pre-commit hook and CI, secret push protection | the 12. 10. commit would not have gone through |
| masked CI variables, no `env` in the log | job 4812 would not have printed the key |
| no static keys (roles, OIDC) | there would be nothing to leak |
| alert on first use of a key from a new ASN/IP address or with a new User-Agent | 19. 10. at 02:14, not at 08:10 |
| GuardDuty findings via EventBridge to the SOC, including low-severity ones for IAM users | `PenTest:IAMUser/KaliLinux` at 02:14 |
| detection of `CreatePolicyVersion` with `setAsDefault`, `CreateUser`, `CreateAccessKey` for another user | 02:19–02:21 |
| detection of `StopLogging`/`DeleteTrail` (including denied ones) | 02:47 |

Sigma rule for CloudTrail being disabled (from the lab):

```yaml
title: AWS CloudTrail stopped or deleted
logsource: { product: aws, service: cloudtrail }
detection:
  selection:
    eventSource: cloudtrail.amazonaws.com
    eventName: [StopLogging, DeleteTrail]
  condition: selection
tags: [attack.defense-impairment, attack.t1685.002]
level: high
```

The rule deliberately catches denied attempts too: `AccessDenied` on `StopLogging` means someone with serious intent already has credentials in the account. The same query in Sentinel, over the `AWSCloudTrail` table:

```kql
AWSCloudTrail
| where EventSource == "cloudtrail.amazonaws.com" and EventName in ("StopLogging", "DeleteTrail")
| project TimeGenerated, UserIdentityArn, UserIdentityAccessKeyId, SourceIpAddress, ErrorCode
```

Escalation rule in Sigma:

```yaml
detection:
  selection:
    eventSource: iam.amazonaws.com
    eventName: CreatePolicyVersion
    requestParameters.setAsDefault: true
  condition: selection
```

## Summary

- Removing a key from the code solves nothing. A leaked key is **rotated immediately**, and history is cleaned afterwards.
- The source of the leak defines the investigation period: from first exposure (commit, CI log) to revocation.
- In CloudTrail, first separate legitimate and attacker use of the same key (IP, User-Agent, call pattern), then pivot to every new credential in `responseElements`.
- `CreatePolicyVersion` with `setAsDefault` on your own policy is escalation without a single `Attach*` call.
- Without S3 data events you cannot prove what was not read.
- Containment: `Deny *` on compromised users, deactivation of all the attacker's keys, the login profile, reverting the policy version. Do not break legitimate services.
- The SCP protecting CloudTrail and GuardDuty is the reason this incident has evidence.

## Links to other courses

- [DevSecOps: Secrets in code](#/06-devsecops/m/03-tajne-u-kodu): gitleaks, pre-commit, history and rotation
- [DevSecOps: CI/CD platform security](#/06-devsecops/m/02-sigurnost-ci-cd-platforme): masked variables, OIDC instead of keys
- [DevSecOps: Vault](#/06-devsecops/m/04-vault): dynamic AWS credentials instead of static ones
- [AWS Security Specialty: Logging and analysis](#/03-aws-security-specialty/m/02-logovanje-i-analiza): CloudTrail, data events, Athena
- [AWS Security Specialty: Incident response](#/03-aws-security-specialty/m/03-odgovor-na-incidente): compromised key, session revocation
- [AWS Security Specialty: IAM authorization](#/03-aws-security-specialty/m/07-iam-autorizacija): policy versions, permission boundary
- [AWS Security Specialty: Multi-account governance](#/03-aws-security-specialty/m/10-multi-account-governance): SCP protecting CloudTrail
- [Detection and response: Cloud and Kubernetes logs](#/07-detekcija-i-odgovor/m/02-cloud-i-kubernetes-logovi): jq queries over CloudTrail
- [Detection and response: MITRE ATT&CK](#/07-detekcija-i-odgovor/m/05-mitre-attack): T1685 and the new IDs
- [Detection and response: Sigma](#/07-detekcija-i-odgovor/m/06-sigma): writing and testing rules with Zircolite
- [Detection and response: Containment and runbooks](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): containment order
- [SC-200: Data ingestion](#/08-sc200/m/04-unos-podataka): AWS connector and the `AWSCloudTrail` table
- [CySA+: IR techniques](#/09-cysa/m/10-ir-tehnike): scope assessment and timeline
- [CISSP: Law, investigations and policies](#/11-cissp/m/02-pravo-istrage-politike): data breach notification obligation
