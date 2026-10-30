## What this module covers

The module covers objective **3.1** from domain 3: MITRE ATT&CK in detection, i.e. mapping detections to techniques, measuring coverage, and ATT&CK Navigator layers.

After this module you will know:

- how ATT&CK is organized (tactics, techniques, sub-techniques, procedures, groups, detection strategies) and what changed in versions 18–20;
- how to assign the correct ATT&CK ID to each detection in Wazuh and Sigma;
- how to extract a list of techniques from existing rules and build a **Navigator layer** (JSON);
- how to read coverage without fooling yourself and how to choose the next detection.

The focus is defensive: we describe a technique only as much as needed to know what to look for in the log.

## What ATT&CK is

**MITRE ATT&CK** is a public knowledge base of adversary behavior, built from real-world incidents. It does not say "how to attack" but "what attackers did and what it looks like". For detection it matters because it provides a common language: "we have a detection for T1110.001 on Linux" means the same thing in every team and every tool.

There are three domains (matrices): **Enterprise** (Windows, Linux, macOS, cloud, containers, identity, network devices), **Mobile** and **ICS**. We work with Enterprise.

| Object | Example ID | What it is |
|---|---|---|
| **Tactic** | `TA0006` Credential Access | the adversary's goal: the "why" |
| **Technique** | `T1110` Brute Force | the way the goal is achieved: the "how" |
| **Sub-technique** | `T1110.001` Password Guessing | a more specific variant of a technique |
| **Procedure** | description of use in a real incident | concrete implementation (tool, command) |
| **Group** | `G0139` TeamTNT | a tracked actor and the techniques it uses |
| **Software** | `S…` | a tool or malware |
| **Campaign** | `C…` | a set of activities over a given period |
| **Mitigation** | `M…` | a preventive measure |
| **Detection strategy** | `DET0551` | approach to detecting a technique (since v18) |
| **Analytic** | `AN1522` | detection logic for one platform, tied to log sources |
| **Data component** | `DC0002` User Account Authentication | the type of telemetry required |

One technique can belong to several tactics. `T1078` Valid Accounts is at the same time Initial Access, Persistence, Privilege Escalation and Stealth: the same stolen account serves for getting in, staying in and hiding.

## Versions: v18, v19 and v20

ATT&CK is released twice a year (April and October). Three recent changes matter for detection:

| Version | Date | What matters for a detection engineer |
|---|---|---|
| v18 | October 2025 | the old "Detection" text and **Data Sources** were replaced by **Detection Strategies** and **Analytics** objects; data components were reworked |
| v19 | April 2026 | the **Defense Evasion tactic was split** into **Stealth** (`TA0005`, keeps the old ID) and **Defense Impairment** (`TA0112`); some techniques were revoked and received new IDs |
| v20 | October 2026 | new techniques (among others related to AI), new detection strategies; Enterprise has 15 tactics |

The consequence of v19 for you: techniques that "turn off defenses" have new IDs. The old ID is **revoked** and points to the new one:

| Old ID (up to v18) | New ID (v19+) | Tactic |
|---|---|---|
| `T1562` Impair Defenses / `T1562.001` Disable or Modify Tools | `T1685` Disable or Modify Tools | Defense Impairment |
| `T1562.008` Disable or Modify Cloud Logs | `T1685.002` Disable or Modify Cloud Log | Defense Impairment |
| `T1562.012` Disable or Modify Linux Audit System | `T1685.004` Disable or Modify Linux Audit System Log | Defense Impairment |
| `T1070.002` Clear Linux or Mac System Logs | `T1685.006` Clear Linux or Mac System Logs | Defense Impairment |
| `T1562.004` Disable or Modify System Firewall | `T1686` Disable or Modify System Firewall | Defense Impairment |
| `T1562.003` Impair Command History Logging | `T1690` Prevent Command History Logging | Defense Impairment |

Some related techniques were not moved: `T1070.003` Clear Command History and `T1027` Obfuscated Files or Information are in the Stealth tactic.

> **In practice:** tools lag behind ATT&CK at different speeds. SigmaHQ rules already use `attack.stealth`, `attack.defense-impairment` and `attack.t1685.002`, while the built-in Wazuh ruleset and Wazuh's internal ATT&CK database may still use the old IDs (`T1562.x`). When you merge coverage from several sources, first normalize IDs using the revoked → new table; otherwise the same detection looks like two different ones, and new techniques look uncovered.

### Detection strategies and analytics

Since v18 every technique has one or more **detection strategies**, and each strategy has **analytics** per platform. An analytic lists which log sources and data components to watch. Example for `T1110.001` Password Guessing (strategy `DET0551`):

| Analytic | Platform | Data component | Log source (as ATT&CK names it) |
|---|---|---|---|
| `AN1521` | Windows | `DC0002` User Account Authentication | `WinEventLog:Security`, EventCode 4625 |
| `AN1522` | Linux | `DC0002` User Account Authentication | `linux:syslog`, `sshd[pid]: Failed password` |
| `AN1523` | macOS | `DC0002` User Account Authentication | `macos:unifiedlog` |

This is directly usable: the Linux analytic describes exactly the lines that Wazuh rules 5760/5763 catch in `/var/log/auth.log`. For `T1685.002` (disabling cloud logs) the IaaS analytic mentions the CloudTrail event that stops logging, which is `StopLogging` in CloudTrail.

## Mapping detections

Mapping answers the question: "if this rule fires, what adversary behavior did we see?" Rules:

1. **Map the behavior the rule actually sees**, not the goal you assume. A "kubectl exec into a pod" rule sees `T1609` Container Administration Command. The attacker may have done Discovery behind it, but the rule does not see that.
2. **Most precise level**: the sub-technique when you know it (`T1110.001`, not just `T1110`). Use the parent technique when the rule covers several sub-techniques (brute force without distinguishing guessing/spraying).
3. **The tactic follows from context**. `T1053.003` Cron is Execution, Persistence and Privilege Escalation. A new crontab for user `www-data` is most often Persistence.
4. **Don't force a mapping.** A "failed health check" rule has no ATT&CK technique, and that is fine.

Examples from our environment:

| Detection | Log source in the lab | Technique | Tactic |
|---|---|---|---|
| Many `Failed password` from the same IP (Wazuh 5763) | `/var/log/auth.log` | `T1110.001` / `T1110` | Credential Access |
| Same IP, many different users | `auth.log` | `T1110.003` Password Spraying | Credential Access |
| Successful login after a series of failures | `auth.log` | `T1078` + `T1110` | Initial Access / Credential Access |
| Modification of `~/.ssh/authorized_keys` (FIM) | Wazuh syscheck | `T1098.004` SSH Authorized Keys | Persistence |
| New local user (`useradd`) | `auth.log` | `T1136.001` Local Account | Persistence |
| `sudo` by a user who has never used it | `auth.log` | `T1548.003` Sudo and Sudo Caching | Privilege Escalation |
| CloudTrail `StopLogging` / `DeleteTrail` | CloudTrail JSON | `T1685.002` | Defense Impairment |
| CloudTrail `CreateAccessKey` for another user | CloudTrail JSON | `T1098.001` Additional Cloud Credentials | Persistence |
| K8s audit: `create` on `pods/exec` | K8s audit log | `T1609` | Execution |
| K8s audit: pod with `privileged: true` or hostPath | K8s audit log | `T1611` Escape to Host (preparation) | Privilege Escalation |
| K8s audit: `list` on `secrets` by a service account | K8s audit log | `T1552.007` Container API | Credential Access |
| Cryptominer process (Falco, module 07) | Falco | `T1496.001` Compute Hijacking | Impact |

### In a Wazuh rule

```xml
<rule id="100130" level="12">
  <if_sid>100129</if_sid>
  <description>CloudTrail: logging stopped ($(data.eventName))</description>
  <mitre>
    <id>T1685.002</id>
  </mitre>
  <group>cloudtrail,defense_impairment,</group>
</rule>
```

The alert contains a `rule.mitre` block with `id`, and Wazuh adds `tactic` and `technique` (names) from its internal database. If the ID is newer than Wazuh's database, the names may be missing. Detection still works; only the enrichment is missing. That is why it is useful to also add the tactic name in `<group>`.

```bash
# which techniques actually appeared in alerts and how many times
jq -r '.rule.mitre.id[]?' /var/ossec/logs/alerts/alerts.json | sort | uniq -c | sort -rn

# alerts with a technique but without names (ID unknown to Wazuh's database)
jq -c 'select(.rule.mitre.id and ((.rule.mitre.technique // []) | length) == 0)
       | {id:.rule.id, mitre:.rule.mitre.id}' /var/ossec/logs/alerts/alerts.json | sort -u
```

### In a Sigma rule

```yaml
tags:
    - attack.defense-impairment
    - attack.t1685.002
```

Tags are lowercase, and a dot separates the namespace. Tactics are written by name (`attack.credential-access`, `attack.stealth`), techniques by ID (`attack.t1110.001`), groups as `attack.g0139`. Details in module 06.

> **In practice:** mapping does another job too: it makes alerts searchable by behavior. When a threat intel report arrives saying "actor X uses T1098.004", one query over alerts tells you whether you have ever seen it, and one grep over rules tells you whether you can see it at all.

## Coverage

**Coverage** answers "which techniques can we detect". There are several levels of honesty:

| Level | Question | How it is measured |
|---|---|---|
| 0. Telemetry | Do we have a log at all that would show the technique? | data components from analytics vs. log sources we collect |
| 1. Rule exists | Is there a rule with that ATT&CK tag? | grep for tags in rules |
| 2. Rule is tested | Does it fire on a simulation of the technique? | Atomic Red Team / log replay (module 08) |
| 3. Rule is in production and sustainable | Does it have an acceptable number of false positives and an owner? | alert metrics, runbook |

A rule map (level 1) almost always looks better than reality. A single rule for `T1059.004` Unix Shell that catches `bash -i >& /dev/tcp` does not cover all ways of executing a shell; it covers one procedure.

### Extracting techniques from rules

```bash
# Wazuh: techniques in built-in and local rules
grep -rhoE '<id>T[0-9]{4}(\.[0-9]{3})?</id>' /var/ossec/ruleset/rules /var/ossec/etc/rules \
  | sed -E 's#</?id>##g' | sort | uniq -c | sort -rn | head -20

# Sigma: techniques in the Linux and cloud rules of the SigmaHQ repository
grep -rhoE 'attack\.t[0-9]{4}(\.[0-9]{3})?' /opt/sigma-rules/rules/linux /opt/sigma-rules/rules/cloud \
  | sed 's/attack\.//' | tr a-z A-Z | sort | uniq -c | sort -rn | head -20
```

### Navigator layer

**ATT&CK Navigator** is a web application for displaying the matrix and coloring techniques. It also works offline (static build), and you feed it data as a **layer**: a JSON file. The current format specification is **layer 4.5** (Navigator 5.x).

A minimal layer:

```json
{
  "name": "Detection lab - Wazuh and Sigma coverage",
  "versions": { "attack": "20", "navigator": "5.3.2", "layer": "4.5" },
  "domain": "enterprise-attack",
  "description": "Techniques with at least one tested rule",
  "filters": { "platforms": ["Linux", "IaaS", "Containers"] },
  "gradient": { "colors": ["#ffffff", "#66b1ff"], "minValue": 0, "maxValue": 3 },
  "techniques": [
    { "techniqueID": "T1110.001", "tactic": "credential-access", "score": 3,
      "comment": "Wazuh 5760/5763; tested 2026-10-14" },
    { "techniqueID": "T1685.002", "tactic": "defense-impairment", "score": 2,
      "comment": "Sigma: CloudTrail StopLogging/DeleteTrail" },
    { "techniqueID": "T1609", "tactic": "execution", "score": 1,
      "comment": "K8s audit pods/exec; untested" }
  ],
  "legendItems": [
    { "label": "1 = rule exists", "color": "#d6eaff" },
    { "label": "3 = tested and in production", "color": "#66b1ff" }
  ]
}
```

Fields you will use most often:

| Field | Note |
|---|---|
| `versions.layer` | required, must be `"4.5"` for the current format |
| `domain` | `enterprise-attack`, `mobile-attack` or `ics-attack` |
| `techniques[].techniqueID` | `T####` or `T####.###` |
| `techniques[].tactic` | short tactic name (`credential-access`, `stealth`, `defense-impairment`); without it the annotation is applied under all of the technique's tactics |
| `score` | a number; the color is computed from `gradient` |
| `color` | explicit color, takes precedence over score |
| `comment`, `metadata`, `links` | why the technique is colored, rule ID, link to the runbook |
| `enabled: false` | the technique is shown greyed out (e.g. "not relevant for us") |

### Layer from Sigma rules: sigma analyze attack

`sigma-cli` builds a layer directly from rules:

```bash
# score = number of rules per technique
sigma analyze attack count /root/sigma-linux-cloud.json \
  /opt/sigma-rules/rules/linux /opt/sigma-rules/rules/cloud/aws

# only rules with level high+ and status test+
sigma analyze attack count -L high -T test /root/sigma-high.json /opt/sigma-rules/rules/cloud/aws
```

The scoring functions are `count` (number of rules), `max` (highest level) and `level` (sum of levels). The output is a layer that Navigator opens (sigma-cli 3.1 writes layer format `4.4`, which Navigator still loads).

### Layer from Wazuh rules: a small script

```bash
cat > /root/wazuh_layer.py <<'EOF'
import json, re, glob, collections
score = collections.Counter()
rules = collections.defaultdict(list)
for f in glob.glob("/var/ossec/ruleset/rules/*.xml") + glob.glob("/var/ossec/etc/rules/*.xml"):
    text = open(f, errors="ignore").read()
    for m in re.finditer(r'<rule id="(\d+)"(.*?)</rule>', text, re.S):
        rid, body = m.group(1), m.group(2)
        for t in re.findall(r"<id>(T\d{4}(?:\.\d{3})?)</id>", body):
            score[t] += 1
            rules[t].append(rid)
layer = {
    "name": "Wazuh ruleset - techniques",
    "versions": {"layer": "4.5", "navigator": "5.3.2"},
    "domain": "enterprise-attack",
    "techniques": [
        {"techniqueID": t, "score": n, "comment": "rules: " + ", ".join(rules[t][:10])}
        for t, n in sorted(score.items())
    ],
    "gradient": {"colors": ["#ffffff", "#ff6666"], "minValue": 0, "maxValue": max(score.values())},
}
json.dump(layer, open("/root/wazuh-layer.json", "w"), indent=2)
print(len(score), "techniques")
EOF
python3 /root/wazuh_layer.py
jq '.techniques | length' /root/wazuh-layer.json
```

There is no `tactic` here, so Navigator colors the technique under all of its tactics. The script also counts old (revoked) IDs; Navigator does not display them for v20, so map them to the new ones first.

### Comparing layers

Navigator has "create layer from other layers": an expression over layers, e.g. `b - a`, where `a` is your coverage and `b` is a layer of techniques used by an actor relevant to you (from Navigator: select a group, e.g. TeamTNT `G0139` for attacks on Linux and containers). The result is the techniques the actor uses that you do not see. That is the list of candidates for your next detections.

The same in a few lines without Navigator:

```bash
jq -r '.techniques[].techniqueID' /root/akter.json | sort -u > /tmp/akter.txt
jq -r '.techniques[].techniqueID' /root/wazuh-layer.json /root/sigma-linux-cloud.json | sort -u > /tmp/imamo.txt
comm -23 /tmp/akter.txt /tmp/imamo.txt     # used by the actor, we have no rule
```

> **In practice:** don't show management a percentage like "we cover 63% of ATT&CK". The matrix has hundreds of techniques, many are not relevant to your platforms, and one rule per technique does not mean detection. Show 10–20 techniques that matter for your environment (cloud accounts, containers, SSH, CI/CD), the 0–3 level from the table above for each, and a plan for the next quarter.

## Prioritization: which detection to write next

A good order:

1. **Relevance**: techniques for your platforms (`Linux`, `IaaS`, `Containers`, `Identity Provider`) and actors that target your industry.
2. **Telemetry exists**: there is no point writing a rule for a source you don't collect; in that case the first task is logging (module 01).
3. **Impact**: techniques near the end of the chain (disabling logs, new keys, exec into a production pod) produce high-value alerts.
4. **Cost of false positives**: `T1059.004` Unix Shell is everywhere; `T1685.002` StopLogging is rare and almost always interesting.

| Technique | Relevant | Telemetry | Noise | Priority |
|---|---|---|---|---|
| `T1685.002` disabling CloudTrail | yes | CloudTrail | low | high |
| `T1098.001` additional cloud keys | yes | CloudTrail | medium (rotations) | high |
| `T1609` exec into a pod | yes | K8s audit | medium (debugging) | medium |
| `T1059.004` Unix shell | yes | Falco / auditd | high | low as a standalone rule |
| `T1003.001` LSASS Memory | no (no Windows) | – | – | out of scope |

## Limitations of ATT&CK

- ATT&CK is a catalog of **known** behavior. New tricks reach the knowledge base with a delay.
- Techniques are not equal in size: `T1078` Valid Accounts covers an enormous space, `T1611` Escape to Host is narrow.
- ATT&CK says nothing about detection quality. For the robustness of a detection against attacker modifications there is the MITRE project **Summiting the Pyramid** (in Sigma the `stp` namespace), and for the value of indicators there is the Pyramid of Pain (module 06).
- Mapping is subjective: two analysts sometimes map the same rule differently. Record the rationale in `comment` or in the rule description.

> **In practice:** when you write an incident report (module 09), map both what the attacker did and what you detected of it. Techniques that occurred but did not trigger an alert are the most valuable input to the detection backlog, more valuable than any theoretical layer.

## Comparison: Sentinel and Splunk

In Microsoft Sentinel an analytics rule has **Tactics** and **Techniques** fields, and the MITRE ATT&CK page shows the coverage of active and available rules over the matrix. In KQL you can count incidents per technique:

```kusto
SecurityAlert
| where TimeGenerated > ago(30d)
| mv-expand Technique = parse_json(Techniques)
| summarize Alerts = count() by tostring(Technique)
| order by Alerts desc
```

In Splunk Enterprise Security, correlation searches have **annotations** with ATT&CK IDs, and the Splunk Security Content repository maps each detection to a technique. The principle is the same as with Wazuh and Sigma: the ID lives in the rule metadata, and coverage is computed from the metadata.

## Summary

- ATT&CK: tactics (why), techniques and sub-techniques (how), procedures, groups; since v18, detection strategies and analytics with data components and log sources instead of the old Data Sources.
- v19 split Defense Evasion into **Stealth** (`TA0005`) and **Defense Impairment** (`TA0112`); `T1562.x` and `T1070.002` were revoked and replaced by `T1685.x`, `T1686`, `T1690`. The current version is v20 (15 Enterprise tactics).
- Map the behavior the rule actually sees, at the most precise level; don't force a mapping.
- Wazuh: `<mitre><id>` in the rule, `rule.mitre.*` in the alert; Sigma: `tags` with `attack.<tactic>` and `attack.t####.###`. Normalize revoked IDs before merging coverage.
- A Navigator layer is JSON (format `4.5`): `techniqueID`, `tactic`, `score`, `comment`, `gradient`; `sigma analyze attack` builds a layer from Sigma rules.
- Coverage has levels: telemetry, rule, tested, sustainable. A rule map overestimates reality.
- Prioritize by relevance, available telemetry, impact and cost of false positives; the difference between the actor's layer and your layer is your backlog.
