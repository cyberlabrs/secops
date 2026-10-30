## What this module covers

The module covers two objectives from domain 3:

- **3.2** Sigma rules: `logsource`, `detection`, modifiers, conditions; conversion to SIEM queries with a **processing pipeline**.
- **3.3** The detection lifecycle: testing, false positives, tuning, **detection as code**, the Pyramid of Pain.

Wazuh rules (module 04) only work in Wazuh. **Sigma** is an open, generic rule format (YAML) that is converted into queries for Splunk, Elastic, Microsoft Sentinel / Defender (KQL) and others. The same detection, one source of truth, multiple SIEMs.

Tools in the lab:

| Tool | Version | Role |
|---|---|---|
| `sigma` (sigma-cli) | 3.1, on pySigma 1.5 | rule checking and conversion |
| backends | `splunk`, `lucene`, `esql` (Elastic), `kusto` | target query languages |
| SigmaHQ rules | `/opt/sigma-rules/rules/` | public repository of thousands of rules |
| Zircolite | 4.1 | runs Sigma rules directly against JSON logs (no SIEM) |

The specification we use is Sigma **2.1** (August 2025): rules, modifiers, correlations and filters.

## Anatomy of a Sigma rule

```yaml
title: CloudTrail logging stopped or trail deleted
id: 6b1f0a52-3c1e-4c55-9d43-2f1f8c3a7e10
status: experimental
description: Someone stopped or deleted a CloudTrail trail, which turns off the audit trail for the account.
references:
    - https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html
author: Kurs SecOps
date: 2026-10-16
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
    filter_iac:
        userIdentity.arn|endswith: ':assumed-role/terraform-deploy/ci'
    condition: selection and not filter_iac
falsepositives:
    - Planned shutdown or replacement of the trail through Terraform (filtered above)
level: high
```

| Field | Required | Note |
|---|---|---|
| `title` | yes | short, what the rule detects |
| `id` | no (in practice yes) | UUID v4; stable across changes, used by correlations and filters |
| `status` | no | `experimental`, `test`, `stable`, `deprecated`, `unsupported` |
| `logsource` | yes | `category`, `product`, `service` (+ `definition`): **which** log |
| `detection` | yes | named **search identifiers** + `condition` |
| `falsepositives` | no | known sources of false positives; the analyst reads them during triage |
| `level` | no | `informational`, `low`, `medium`, `high`, `critical` |
| `tags` | no | `attack.*`, `cve.*`, `detection.*`, `stp.*`, `tlp.*` |
| `related` | no | link to another rule (`derived`, `obsolete`, `merged`, `renamed`, `similar`) |

Conventions from the specification: YAML with 4-space indentation, lowercase keys, strings in single quotes, file name 10–70 lowercase characters with `_` (e.g. `aws_cloudtrail_stoplogging_kurs.yml`).

### logsource

`logsource` does not filter events by itself. It tells the backend and the pipeline **where** to look. The pipeline translates it into a concrete index, sourcetype or table.

| logsource | Examples in SigmaHQ |
|---|---|
| `product: aws`, `service: cloudtrail` | `rules/cloud/aws/cloudtrail/` |
| `category: application`, `product: kubernetes`, `service: audit` | `rules/application/kubernetes/audit/` |
| `product: linux`, `service: sshd` / `auth` / `syslog` | `rules/linux/builtin/` |
| `product: linux`, `category: process_creation` | `rules/linux/process_creation/` (auditd or Sysmon for Linux) |
| `category: webserver` | `rules/web/` |

### detection: maps, lists, wildcards

Two basic logic rules:

- A **map** (several fields in one identifier) = **AND**.
- A **list** of values for one field = **OR**.

```yaml
detection:
    selection:                 # eventSource = X  AND  eventName IN (A, B)
        eventSource: iam.amazonaws.com
        eventName:
            - CreateAccessKey
            - CreateLoginProfile
    condition: selection
```

String comparison is **case-insensitive** by default and matches the whole value. `*` and `?` are wildcards (`'*admin*'`); `\` is the escape character. An empty value is written as `''`, and the absence of a value as `null`. `null` must not appear in a list with other values; for "field is not null", create a separate identifier and negate it.

**Keywords** are a list of strings without a field name (`keywords: ['Corrupted MAC on input', ...]`, `condition: keywords`): they are searched for in the whole message. Useful for unstructured logs (`auth.log`, SigmaHQ `rules/linux/builtin/`), but slow and unreliable in conversion.

### Modifiers

Modifiers are written after the field name with `|` and can be chained (`field|mod1|mod2`).

| Modifier | Meaning | Example |
|---|---|---|
| `contains` | substring | `requestURI|contains: '/exec'` |
| `startswith` / `endswith` | beginning / end | `userIdentity.arn|endswith: ':root'` |
| `all` | the list is joined with AND instead of OR | `CommandLine|contains|all: ['curl', '| sh']` |
| `re` | regex (PCRE subset, case-sensitive) | `user.username|re: '^system:serviceaccount:'` |
| `re|i`, `re|m`, `re|s` | regex flags: ignore case, multiline, dotall | `message|re|i: 'invalid user \S+'` |
| `cased` | case-sensitive comparison | `eventName|cased: 'StopLogging'` |
| `exists` | field exists (`true`) or not (`false`) | `errorCode|exists: false` |
| `cidr` | IP in a range (IPv4 and IPv6) | `sourceIPAddress|cidr: '10.0.0.0/8'` |
| `gt`, `gte`, `lt`, `lte` | numeric comparison | `responseStatus.code|gte: 400` |
| `neq` | not equal to (Sigma 2.1) | `eventSource|neq: 'kms.amazonaws.com'` |
| `fieldref` | comparison with another field | `TargetUser|fieldref: SubjectUser` |
| `base64`, `base64offset`, `utf16le`/`wide`, `windash` | encodings and variants (mostly Windows) | `CommandLine|base64offset|contains: 'IEX'` |
| `expand` | placeholder (`%admins%`) that the pipeline replaces with a list | `user|expand: '%admin_users%'` |
| `minute`, `hour`, `day`, `week`, `month`, `year` | part of a date (Sigma 2.1) | `eventTime|hour|lt: 6` |

Be careful with `re`: only basic metacharacters are allowed (`.`, `^`, `$`, `*`, `+`, `?`, `{n,m}`, `[]` classes, `|`, `()`), and regex is expensive in most SIEMs. If `contains`/`startswith` will do, use that.

### condition

| Expression | Meaning |
|---|---|
| `selection and not filter` | basic form: what you are looking for, minus the known good |
| `1 of selection_*` | at least one identifier starting with `selection_` |
| `all of selection_*` | all such identifiers |
| `1 of them` / `all of them` | all identifiers except those starting with `_` (`all of them` is not recommended) |
| `selection and (a or b)` | parentheses |

Precedence from weakest: `or`, `and`, `not`, `x of`, parentheses. SigmaHQ convention: `selection_*` for what you are looking for, `filter_main_*` for generic exclusions, `filter_optional_*` for environment-specific exclusions, then `condition: all of selection_* and not 1 of filter_*`.

Kubernetes example: an interactive exec into a pod by a user who is not the CI service account.

```yaml
title: Kubernetes exec into pod outside the CI account
id: 3c6f8d2a-1b4e-4f7a-9c2d-8e5b6a7f0c21
status: experimental
logsource:
    category: application
    product: kubernetes
    service: audit
detection:
    selection_exec:
        verb: 'create'
        objectRef.resource: 'pods'
        objectRef.subresource: 'exec'
    filter_main_failed:
        responseStatus.code|gte: 400
    filter_optional_ci:
        user.username|startswith: 'system:serviceaccount:ci:'
    condition: selection_exec and not 1 of filter_*
tags:
    - attack.execution
    - attack.t1609
falsepositives:
    - Debugging by on-call engineers (check the ticket)
level: medium
```

> **In practice:** a rule without `falsepositives` and without filters is almost always a rule nobody has run against real data. Before committing, run it against a week of real logs and write what you saw into `falsepositives`. The analyst at 3 a.m. reads that field before escalating.

## Correlations

A plain Sigma rule looks at a single event. A **correlation rule** links the results of one or more rules over time, similar to Wazuh `frequency`. Types:

| Type | What it counts | Example |
|---|---|---|
| `event_count` | number of events per group | 10+ failed logins per IP in 10 min |
| `value_count` | number of **distinct** values of a field | 10+ different users from one IP (spraying) |
| `temporal` | whether all listed rules fired within the window (in any order) | failures and a success for the same IP |
| `temporal_ordered` | the same, but in exact order | first a series of failures, then a success |
| `value_sum`, `value_avg`, `value_percentile` | metrics over a field (Sigma 2.1) | total bytes downloaded |

Required parts: `type`, `rules` (by `id` or `name`), `group-by`, `timespan` (`30s`, `10m`, `1h`, `1d`) and `condition` (`gt`, `gte`, `lt`, `lte`, `eq`, `neq`; plus `field` for `value_count`). Multiple documents in one file are separated with `---`.

```yaml
title: SSH password spraying from a single address
id: 7f3e9a21-6c4b-4d2e-b8a1-5c9d0e7f2a15
status: experimental
correlation:
    type: value_count
    rules:
        - ssh_failed_password
    group-by:
        - src_ip
    timespan: 10m
    condition:
        field: user
        gte: 10
level: high
---
title: SSH failed password
id: 2a8c4e6f-9b1d-4c3e-8f5a-7d9b1c3e5f16
name: ssh_failed_password
status: experimental
logsource:
    product: linux
    service: sshd
detection:
    selection:
        message|startswith: 'Failed password for '
    condition: selection
level: informational
```

Conversion to Splunk (without a pipeline, just to see the shape):

```bash
sigma convert -t splunk --without-pipeline lnx_sshd_password_spraying.yml
```

```text
message="Failed password for *"
| bin _time span=10m
| stats dc(user) as value_count by _time src_ip
| search value_count >= 10
```

The ES|QL backend produces `stats value_count=count_distinct(user) by timebucket, src_ip`. Not all backends support all types: in the lab, the `kusto` backend does not convert correlations, and `splunk` does not support `temporal_ordered`. The error looks like this: `Correlation type 'temporal_ordered' is not supported by backend`. Zircolite runs all types against local logs.

> **In practice:** a correlation in Sigma is only as portable as the backend supports it. Before you promise "we have brute-force detection in Sentinel from Sigma", convert the rule for the target backend and look at the query. If the backend does not support the type, write the correlation directly in the target language and put both files in the repo with the same ATT&CK tag.

## sigma-cli: checking and conversion

```bash
sigma list targets            # backends: splunk, lucene, esql, eql, kusto...
sigma list pipelines          # pipelines: splunk_cim, ecs_kubernetes, sentinel_asim, microsoft_xdr...

# check syntax, conditions and best practices (validators)
sigma check --fail-on-issues pravila/   # without --fail-on-issues, warnings (style, file name, duplicate id) do not break the build
```

`sigma check` catches errors that otherwise only the SIEM would reveal, e.g. a condition that references a non-existent identifier:

```text
Condition error in .../aws_cloudtrail_x.yml:Detection 'selection' not defined in detections
Found 0 errors, 1 condition errors and 0 issues.
```

### Conversion and pipelines

The backend knows the **syntax** of the target language. The **processing pipeline** knows **your environment**: what the fields are called and which index/table holds the logs. Without a pipeline, the query uses the field names from the rule, which rarely match the real SIEM. That is why the `splunk`, `lucene` and `esql` backends require a pipeline; for practice this is skipped with `--without-pipeline`.

```bash
R=aws_cloudtrail_stoplogging_kurs.yml

sigma convert -t splunk --without-pipeline $R
# eventSource="cloudtrail.amazonaws.com" eventName IN ("StopLogging", "DeleteTrail")
#   NOT userIdentity.arn="*:assumed-role/terraform-deploy/ci"

sigma convert -t esql --without-pipeline $R
# from * metadata _id, _index, _version | where eventSource=="cloudtrail.amazonaws.com"
#   and (eventName in ("StopLogging", "DeleteTrail")) and not ends_with(userIdentity.arn, ...)

sigma convert -t kusto $R
# (eventSource =~ "cloudtrail.amazonaws.com" and (eventName in~ ("StopLogging", "DeleteTrail")))
#   and (not('userIdentity.arn' endswith ":assumed-role/terraform-deploy/ci"))
```

A custom pipeline is a YAML file. Example: CloudTrail is in Splunk in the `aws` index, and the ARN is extracted into the `user_arn` field.

```yaml
# kurs_cloudtrail_splunk.yml
name: kurs - CloudTrail in Splunk
priority: 100
transformations:
  - id: cloudtrail_index
    type: add_condition
    conditions:
      index: aws
      sourcetype: 'aws:cloudtrail'
    rule_conditions:
      - type: logsource
        product: aws
        service: cloudtrail
  - id: cloudtrail_polja
    type: field_name_mapping
    mapping:
      userIdentity.arn: user_arn
    rule_conditions:
      - type: logsource
        product: aws
        service: cloudtrail
```

```bash
sigma convert -t splunk -p kurs_cloudtrail_splunk.yml $R
# index="aws" sourcetype="aws:cloudtrail" eventSource="cloudtrail.amazonaws.com"
#   eventName IN ("StopLogging", "DeleteTrail") NOT user_arn="*:assumed-role/terraform-deploy/ci"

# output directly as savedsearches.conf, or one file per rule
sigma convert -t splunk -f savedsearches -p kurs_cloudtrail_splunk.yml -o savedsearches.conf pravila/
sigma convert -t esql --without-pipeline --output-dir prevedeno/ --output-filename-template '{stem}.esql' pravila/
```

Ready-made pipelines cover common cases: `ecs_kubernetes` (K8s audit in Elastic), `splunk_cim` (Splunk CIM data models), `sentinel_asim` and `azure_monitor` (Sentinel tables), `microsoft_xdr` (Defender). Pipelines can be stacked (`-p a -p b`); `priority` determines the order.

### Global exclusions: Sigma filters

An exclusion specific to your environment should not be written into a SigmaHQ rule (it would disappear at the next update). A **Sigma filter** (meta filter) is a separate file added at conversion time:

```yaml
# mf_kurs_terraform_ci.yml
title: Exclusion for the Terraform CI role
logsource:
    product: aws
    service: cloudtrail
filter:
    rules:
        - 4db60cc0-36fb-42b7-9b58-a5b53019fb74   # SigmaHQ: AWS CloudTrail Important Change
    selection:
        userIdentity.arn|endswith: ':assumed-role/terraform-deploy/ci'
    condition: not selection
```

```bash
sigma convert -t splunk --without-pipeline --filter mf_kurs_terraform_ci.yml \
  /opt/sigma-rules/rules/cloud/aws/cloudtrail/aws_cloudtrail_disable_logging.yml
# ... eventName IN ("StopLogging", "UpdateTrail", "DeleteTrail") NOT userIdentity.arn="*:assumed-role/terraform-deploy/ci"
```

The filter condition is ANDed with the rule's condition, so you write the exclusion as `not selection`.

## Testing with Zircolite

Zircolite loads logs into SQLite and runs Sigma rules as SQL. It is not a SIEM, but it is excellent for labs, forensics and CI.

```bash
CT=cloudtrail.json      # your CloudTrail export

# CloudTrail is often {"Records":[...]}; Zircolite needs one event per line
jq -c '.Records[]?' "$CT" > /root/ct.jsonl

zircolite.py -e /root/ct.jsonl -j -r aws_cloudtrail_stoplogging_kurs.yml -o /root/ct-detekcije.json
jq '.[] | {title, rule_level, count}' /root/ct-detekcije.json   # empty = nothing fired
```

`-j` means JSON per line (`--json-array-input` is for a JSON array). If the `zircolite.py` command is not available in the lab, try `zircolite`.

**The nested-field trap.** Zircolite "flattens" JSON and by default keeps only the leaf name: `objectRef.resource` becomes `resource`, `userIdentity.arn` becomes `arn`. SigmaHQ rules look for `objectRef.resource`, so nothing matches and **the rule stays silent**. To check:

```bash
zircolite.py -e "$AUDIT" -j -r kubernetes_exec_van_ci.yml --keepflat -q
head -c 600 flattened_events_*.json      # you see the actual column names
```

The fix is a mapping in the Zircolite configuration (a copy of `config/config.yaml`, the `mappings` section), so that the full name is kept:

```yaml
mappings:
  objectRef.resource: objectRef.resource
  objectRef.subresource: objectRef.subresource
  user.username: user.username
  responseStatus.code: responseStatus.code
  userIdentity.arn: userIdentity.arn
  # ... existing mappings from the original file stay
```

```bash
zircolite.py -e "$AUDIT" -j -c /root/zircolite-kurs.yaml \
  -r /opt/sigma-rules/rules/application/kubernetes/audit/ -o /root/k8s-detekcije.json
```

The same problem exists in every SIEM; there it is solved with a pipeline. The lesson: **a detection that never fires is not proof that there is no attack**. Every rule needs at least one positive test.

### Rule unit tests

Zircolite has `--test-rules`: for each rule you list events that **must** fire (`true_positive`) and that **must not** (`true_negative`). The keys are column names after mapping.

```json
[
  {
    "id": "6b1f0a52-3c1e-4c55-9d43-2f1f8c3a7e10",
    "true_positive": [
      {"eventSource": "cloudtrail.amazonaws.com", "eventName": "StopLogging",
       "userIdentity.arn": "arn:aws:iam::111122223333:user/marko"}
    ],
    "true_negative": [
      {"eventSource": "cloudtrail.amazonaws.com", "eventName": "StopLogging",
       "userIdentity.arn": "arn:aws:sts::111122223333:assumed-role/terraform-deploy/ci"},
      {"eventSource": "cloudtrail.amazonaws.com", "eventName": "StartLogging",
       "userIdentity.arn": "arn:aws:iam::111122223333:user/marko"}
    ]
  }
]
```

```bash
zircolite.py -r aws_cloudtrail_stoplogging_kurs.yml --test-rules testovi/cloudtrail.json
echo $?   # 0 = all passed, 1 = at least one failed
```

A negative test is just as important as a positive one: it protects the filter from someone "simplifying" it and bringing the false positives back.

## The detection lifecycle

```text
idea / gap (ATT&CK, incident, threat intel)
  -> research: what the technique looks like in OUR logs
  -> rule (status: experimental) + positive and negative tests
  -> sigma check + tests in CI
  -> deploy to the SIEM as "silent" (no page/ticket), measure noise for 1-2 weeks
  -> tuning (filters, thresholds) -> status: test
  -> production with a runbook and an owner -> after a long quiet run, status: stable
  -> periodic review; replacement or deprecated (with related)
```

### False positives and tuning

| Tuning technique | When | Risk |
|---|---|---|
| `filter_optional_*` in the rule | known, stable legitimate source (CI role, scanner) | an overly broad filter is a blind spot an attacker can exploit |
| Sigma meta filter | the exclusion applies only in your environment, and the rule is from SigmaHQ | the filter is easily forgotten; keep it in the same repo |
| correlation / threshold | a single event is normal, but a series is not | slow attacks below the threshold |
| lowering `level` | the rule is useful as context, not as an alert | nobody looks at it |
| `deprecated` | the rule has no value or another rule covers it | loss of coverage if the decision is wrong |

Measure: number of alerts per rule per week, share closed as false positive, triage time. A rule with 95% false positives is worse than no rule: it wastes attention and teaches analysts to ignore it.

> **In practice:** write filters on a **stable identity** (role ARN, service account, signed binary), not on something the attacker easily controls (process name, user agent, a comment in the command). A filter `userAgent|contains: 'terraform'` means anyone who sets that user agent goes unnoticed.

### Detection as code

**Detection as code** means detections are software: a git repo, review, tests, CI and automated deployment.

A typical repo has the directories `rules/` (by logsource), `filters/` (meta filters), `pipelines/` (mappings for your SIEMs), `tests/` (JSON tests) and the CI configuration.

```yaml
# .gitlab-ci.yml (abbreviated)
stages: [validate, test, build]

sigma-check:
  stage: validate
  script:
    - sigma check --fail-on-issues rules/ filters/

rule-tests:
  stage: test
  script:
    - zircolite.py -r rules/cloud/aws/ --test-rules tests/cloudtrail.json

build-splunk:
  stage: build
  script:
    - sigma convert -t splunk -f savedsearches -p pipelines/kurs_cloudtrail_splunk.yml
        --filter filters/mf_kurs_terraform_ci.yml -o savedsearches.conf rules/cloud/aws/
  artifacts:
    paths: [savedsearches.conf]

# deploy-splunk: only on the default branch, sends savedsearches.conf via the Splunk REST API
```

What you get: every change has a review and history (who added a filter and why), tests prevent regressions, and the SIEM always matches the state of the repo. The same principle works for Wazuh: `local_rules.xml` in the repo, tests with `wazuh-logtest -U` in CI (module 04).

### The Pyramid of Pain

The **Pyramid of Pain** (David Bianco) ranks indicators by how much it "hurts" the attacker when you detect and block them:

| Level (bottom up) | Example from the lab | Cost for the attacker to change |
|---|---|---|
| Hash values | SHA-256 of a cryptominer binary | trivial (one byte) |
| IP addresses | `203.0.113.50` from the brute force | easy (a new VPS address) |
| Domain names | C2 domain | low |
| Network / host artifacts | user agent, file name in `/tmp`, path | moderate |
| Tools | a specific scanner or exploitation tool | high (a new tool) |
| **TTPs** (tactics, techniques and procedures) | "stopping CloudTrail", "exec into a pod, then reading secrets" | highest (must change behavior) |

For a detection engineer: IOC rules (hash, IP) are useful and cheap, but short-lived. Behavioral detections (`eventName: StopLogging` regardless of source, `value_count` per user) are more expensive to write and tune, but survive changes to the attacker's infrastructure. The Sigma `stp.*` tag (MITRE Summiting the Pyramid) additionally scores the robustness of an analytic.

> **In practice:** when you get an incident report with a list of IOCs, add the IOCs to blocklists and to a retroactive search (hours of work), but put the **behavior** from the report into the detection backlog. The attacker's IP addresses will change by next week; the fact that they turned off CloudTrail first will not.

## Side by side: SPL and KQL by hand

Sigma does not replace knowing the target language: generated queries need to be read and sometimes optimized. The same rule for stopping CloudTrail:

```text
index=aws sourcetype="aws:cloudtrail" eventSource="cloudtrail.amazonaws.com" eventName IN ("StopLogging","DeleteTrail")
| table _time userIdentity.arn sourceIPAddress awsRegion eventName
```

```kusto
AWSCloudTrail
| where EventSource == "cloudtrail.amazonaws.com" and EventName in ("StopLogging", "DeleteTrail")
| project TimeGenerated, UserIdentityArn, SourceIpAddress, AWSRegion, EventName
```

In Sentinel, CloudTrail lands in the `AWSCloudTrail` table with different column names (`EventName`, `UserIdentityArn`), hence the `sentinel_asim` / `azure_monitor` pipeline or a custom mapping.

## Summary

- Sigma is a generic YAML detection format: `title`, `id`, `status`, `logsource`, `detection` + `condition`, `falsepositives`, `level`, `tags`; map = AND, list = OR, case-insensitive by default.
- Modifiers (`contains`, `startswith`, `endswith`, `all`, `re`, `cidr`, `exists`, `gte`, `neq`, `fieldref`, `expand`...) are chained with `|`; conditions use `and`/`or`/`not`, `1 of`/`all of` and parentheses.
- Correlations (`event_count`, `value_count`, `temporal`, `temporal_ordered`, metric types in 2.1) require `group-by`, `timespan` and `condition`; support depends on the backend.
- `sigma check` validates, `sigma convert -t <backend> -p <pipeline>` converts; the pipeline maps fields and adds the index/table; `--filter` adds exclusions without modifying SigmaHQ rules.
- Zircolite runs rules against JSON logs; watch out for flattened field names (`--keepflat`, mappings in the config) and write positive and negative tests (`--test-rules`).
- Lifecycle: experimental -> test -> stable, silent rollout and noise measurement, tuning with filters on stable identities, periodic review.
- Detection as code: repo, review, `sigma check` and tests in CI, automated conversion and deployment; the Pyramid of Pain steers you toward behavioral (TTP) detections instead of IOCs.
