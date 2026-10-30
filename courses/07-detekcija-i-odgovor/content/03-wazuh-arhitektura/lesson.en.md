## What this module covers

The module covers two objectives from domain 2:

- **2.1** **Wazuh** architecture: agent, manager, indexer, dashboard; the **ruleset**, alert levels, `alerts.json`.
- **2.3** File integrity monitoring (**FIM**), Security Configuration Assessment (**SCA**), vulnerability detection.

Writing your own decoders and rules (2.2) and active response (2.4) are covered in module 04. Here you learn how Wazuh works internally, where everything lives and how to read an alert.

**Wazuh** is an open-source XDR/SIEM that grew out of OSSEC HIDS. That is why many paths still carry the name `ossec` (`/var/ossec/`, `ossec.conf`). The lab runs **Wazuh manager 4.14** without the indexer and dashboard: you see everything through files and the command line, which is also the best way to understand what the dashboard merely displays.

```bash
wazuh-start                                   # lab script: rsyslog, sshd and Wazuh manager
/var/ossec/bin/wazuh-control info             # version
/var/ossec/bin/wazuh-control status           # which daemons are running
```

## Components

| Component | Role | Port |
|---|---|---|
| **Wazuh agent** | On the endpoint: reads logs, FIM, SCA, inventory (syscollector), executes active response | sends to 1514/TCP |
| **Wazuh server** (manager) | Receives events, decodes them, applies rules, generates alerts, manages agents | 1514 agents, 1515 agent enrollment, 55000 REST API, 1516 cluster |
| **Wazuh indexer** | Searchable store for alerts and state (an OpenSearch fork) | 9200 API, 9300–9400 cluster |
| **Wazuh dashboard** | Web interface (an OpenSearch Dashboards fork) | 443 |

Event flow:

```text
[agent: logcollector, syscheckd, SCA, syscollector]
        │  1514/TCP, encrypted
        ▼
[manager: wazuh-remoted → wazuh-analysisd (decoders → rules)]
        │  alerts.json / alerts.log  (+ archives.json if logall_json)
        ▼
[Filebeat] ──► [indexer :9200] ──► [dashboard :443]
```

The manager also has its own local modules: to itself it is "agent 000". That is why in the lab, without a single agent, the manager still reads `/var/log/auth.log`, runs FIM over its own files and SCA over its own configuration.

> **In practice:** When an alert "doesn't arrive" in the dashboard, walk the flow in order: is the agent sending (`/var/ossec/logs/ossec.log` on the agent), is the manager receiving, is the alert in `alerts.json` on the manager, is Filebeat shipping it to the indexer. If it is in `alerts.json`, the problem is not in the rules.

### Manager daemons

| Daemon | What it does |
|---|---|
| `wazuh-remoted` | Communication with agents (1514); also receives syslog if `<remote>` for syslog is enabled |
| `wazuh-authd` | Enrollment of new agents on 1515 |
| `wazuh-analysisd` | The core: decoding and rules, writes alerts |
| `wazuh-logcollector` | Reads local logs from `<localfile>` |
| `wazuh-syscheckd` | FIM |
| `wazuh-modulesd` | Modules: SCA, syscollector, vulnerability detection, cloud integrations |
| `wazuh-db` | Internal database (agent state, FIM, SCA, inventory) |
| `wazuh-execd` | Executes active response scripts |
| `wazuh-monitord` | Log rotation and compression, agent monitoring |
| `wazuh-apid` | REST API on 55000 |

```bash
/var/ossec/bin/wazuh-control status
ps -eo pid,user,cmd | grep -E 'wazuh-(analysisd|remoted|syscheckd|modulesd|logcollector)' | grep -v grep
tail -n 50 /var/ossec/logs/ossec.log          # Wazuh's own log: configuration errors show up here
```

### Agents (outside the lab)

An agent enrolls with the manager through `wazuh-authd` and receives an ID and a key. Most often the manager is specified at install time:

```bash
# on the endpoint (Debian/Ubuntu), example
WAZUH_MANAGER="10.0.0.10" WAZUH_AGENT_GROUP="linux-web" apt-get install wazuh-agent
systemctl enable --now wazuh-agent

# on the manager: list of agents and their state
/var/ossec/bin/agent_control -l
```

Configuration for an agent group is kept centrally on the manager in `/var/ossec/etc/shared/<group>/agent.conf` and is distributed automatically. That way you configure FIM and SCA once for all web servers.

## Configuration and ruleset

| Path | Contents |
|---|---|
| `/var/ossec/etc/ossec.conf` | Main configuration (XML; multiple `<ossec_config>` blocks are allowed) |
| `/var/ossec/ruleset/decoders/` | Built-in decoders; **do not modify**, upgrades overwrite them |
| `/var/ossec/ruleset/rules/` | Built-in rules (e.g. `0095-sshd_rules.xml`, `0015-ossec_rules.xml`) |
| `/var/ossec/etc/decoders/local_decoder.xml` | Your decoders |
| `/var/ossec/etc/rules/local_rules.xml` | Your rules (IDs from 100000 up) |
| `/var/ossec/etc/lists/` | CDB lists (IP addresses, users, hashes) |
| `/var/ossec/ruleset/sca/` | SCA policies (YAML) |
| `/var/ossec/logs/alerts/alerts.json` | Alerts, one JSON object per line |
| `/var/ossec/logs/alerts/alerts.log` | The same alerts, as text |
| `/var/ossec/logs/archives/archives.json` | All events, only if `<logall_json>yes</logall_json>` |
| `/var/ossec/logs/ossec.log` | Wazuh's own log |

Key parts of `ossec.conf` for this module:

```xml
<ossec_config>
  <global>
    <jsonout_output>yes</jsonout_output>   <!-- writes alerts.json -->
    <alerts_log>yes</alerts_log>           <!-- writes alerts.log -->
    <logall_json>no</logall_json>          <!-- archives.json: everything, not just alerts -->
  </global>

  <alerts>
    <log_alert_level>3</log_alert_level>   <!-- threshold for logging an alert -->
    <email_alert_level>12</email_alert_level>
  </alerts>

  <ruleset>
    <decoder_dir>ruleset/decoders</decoder_dir>
    <rule_dir>ruleset/rules</rule_dir>
    <decoder_dir>etc/decoders</decoder_dir>
    <rule_dir>etc/rules</rule_dir>
  </ruleset>
</ossec_config>
```

Every change requires a restart, and before the restart, a check:

```bash
/var/ossec/bin/wazuh-analysisd -t && /var/ossec/bin/wazuh-control restart
```

### How analysisd processes an event

1. **Pre-decoding**: extracts the standard header (time, host, `program_name`) from the syslog line.
2. **Decoding**: a decoder selected by `program_name` or by pattern extracts fields (`srcip`, `srcuser`, `dstuser`…).
3. **Rule matching**: rules are evaluated as a tree. A rule without a parent (e.g. 5700 for all sshd messages) branches into children via `if_sid`. The deepest matching rule wins, and an alert is generated if its level is above `log_alert_level`.

You can see all three phases in `wazuh-logtest`:

```bash
/var/ossec/bin/wazuh-logtest
```

```text
Oct 16 09:14:02 lab sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2

**Phase 1: Completed pre-decoding.
        full event: 'Oct 16 09:14:02 lab sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2'
        timestamp: 'Oct 16 09:14:02'
        hostname: 'lab'
        program_name: 'sshd'

**Phase 2: Completed decoding.
        name: 'sshd'
        parent: 'sshd'
        srcip: '10.0.5.23'
        srcport: '51540'
        dstuser: 'root'

**Phase 3: Completed filtering (rules).
        id: '5760'
        level: '5'
        description: 'sshd: authentication failed.'
        groups: '['syslog', 'sshd', 'authentication_failed']'
        mitre.id: '['T1110.001', 'T1021.004']'
        ...
**Alert to be generated.
```

The exact output depends on the version; what matters is the order of the phases and which rule won.

### Built-in sshd rules you will run into

| ID | Level | Description | Note |
|---|---|---|---|
| 5710 | 5 | Attempt to login using a non-existent user | `Invalid user …` |
| 5712 | 10 | Brute force, non existent user | 5710 eight times in 120 s |
| 5715 | 3 | Authentication success | `Accepted …` |
| 5760 | 5 | Authentication failed | `Failed password` |
| 5763 | 10 | Brute force, authentication failed | 5760 eight times from the same IP address in 120 s |

```bash
grep -n 'id="5763"' -A8 /var/ossec/ruleset/rules/0095-sshd_rules.xml
```

Rule 5763 uses `frequency="8" timeframe="120"`, `if_matched_sid` 5760 and `same_source_ip`. That is **correlation**, which you work on in detail in module 04.

## Alert levels

The level ranges from 0 to 15. Level 0 means "ignore" and is used to silence false positives.

| Level | Meaning (per the Wazuh classification) | Example |
|---|---|---|
| 0 | Ignored | Silencing known noise |
| 2 | Low-priority system notification | |
| 3 | Successful or authorized event | 5715 successful SSH login |
| 5 | User-generated error | 5760 wrong password |
| 7 | "Bad word" match | 550 checksum changed (FIM) |
| 8 | First time seen | A user's first login |
| 10 | Multiple user-generated errors | 5763 brute force |
| 12 | High-importance event | |
| 13–15 | Unusual error, high-importance attack, severe attack | Correlated attacks, almost no false positives |

The default logging threshold is 3, and email starts at 12. A practical split for SOC triage: 0–6 context, 7–11 review during the shift, 12+ immediately.

> **In practice:** Don't raise the level of a built-in rule just because the alert "isn't visible". Write a child rule in `local_rules.xml` with the condition that makes it serious (e.g. 5715 for user `root` from an IP address outside the VPN) and give that child a higher level. That way you don't break built-in logic that an upgrade restores.

## alerts.json: anatomy of an alert

One line from `alerts.json` (formatted, shortened):

```json
{
  "timestamp": "2026-10-16T09:14:31.512+0000",
  "rule": {
    "level": 10,
    "description": "sshd: brute force trying to get access to the system. Authentication failed.",
    "id": "5763",
    "frequency": 8,
    "firedtimes": 1,
    "mail": false,
    "groups": ["syslog", "sshd", "authentication_failures"],
    "mitre": { "id": ["T1110"], "tactic": ["Credential Access"], "technique": ["Brute Force"] },
    "pci_dss": ["11.4", "10.2.4", "10.2.5"]
  },
  "agent": { "id": "000", "name": "lab" },
  "manager": { "name": "lab" },
  "id": "1792142071.48213",
  "previous_output": "Oct 16 09:14:29 lab sshd[452]: Failed password for root from 10.0.5.23 …",
  "full_log": "Oct 16 09:14:31 lab sshd[455]: Failed password for root from 10.0.5.23 port 51700 ssh2",
  "predecoder": { "program_name": "sshd", "timestamp": "Oct 16 09:14:31", "hostname": "lab" },
  "decoder": { "parent": "sshd", "name": "sshd" },
  "data": { "srcip": "10.0.5.23", "srcport": "51700", "dstuser": "root" },
  "location": "/var/log/auth.log"
}
```

| Field | Meaning |
|---|---|
| `rule.id`, `rule.level`, `rule.description` | Which rule and how severe |
| `rule.groups` | Categories (`authentication_failed`, `syscheck`, `sca`…); good for filters |
| `rule.mitre` | ATT&CK mapping from the rule |
| `rule.firedtimes` | How many times the rule has fired since analysisd started |
| `agent.id` | `000` is the manager itself |
| `full_log` | The original record (normalization never deletes the original) |
| `data.*` | Fields extracted by the decoder |
| `location` | The file or source the event came from |
| `syscheck.*`, `data.sca.*` | Additional fields for FIM and SCA alerts |

Working with alerts without the dashboard:

```bash
A=/var/ossec/logs/alerts/alerts.json

# live, condensed
tail -f $A | jq -r '[.timestamp, .rule.id, .rule.level, .rule.description, (.data.srcip // "-")] | @tsv'

# most frequent rules
jq -r '.rule.id + " " + .rule.description' $A | sort | uniq -c | sort -rn | head

# only level 10 and above
jq -c 'select(.rule.level >= 10)' $A

# by ATT&CK technique
jq -r 'select(.rule.mitre) | .rule.mitre.id[]' $A | sort | uniq -c
```

Old alerts are rotated daily into `/var/ossec/logs/alerts/<year>/<month>/` as compressed files with a checksum file next to them. To search across several days, use `zcat … | jq`.

> **In practice:** `alerts.json` is the contract between Wazuh and everything behind it (indexer, SOAR, scripts). When you write integrations or Sigma rules over Wazuh data (module 06), fields like `rule.groups`, `data.srcip` and `agent.name` are what you filter on.

## FIM: file integrity monitoring

**FIM** (`syscheck` in the configuration) records the state of files (hash, owner, permissions, size, inode, modification time) and reports when something is added, changed or deleted. It covers techniques such as modifying `authorized_keys` (T1098.004), adding a user to `/etc/passwd` (T1136.001), and modifying binaries or cron jobs (T1053.003).

The manager's default configuration already monitors `/etc`, `/usr/bin`, `/usr/sbin`, `/bin`, `/sbin` and `/boot` every 12 hours. For practical work you add sensitive paths in real time:

```xml
<syscheck>
  <disabled>no</disabled>
  <frequency>43200</frequency>                   <!-- full scan every 12 h -->
  <scan_on_start>yes</scan_on_start>
  <alert_new_files>yes</alert_new_files>

  <directories>/etc,/usr/bin,/usr/sbin</directories>
  <directories>/bin,/sbin,/boot</directories>

  <!-- sensitive: real time, with the content of the change -->
  <directories realtime="yes" report_changes="yes">/etc/ssh</directories>
  <directories realtime="yes" report_changes="yes">/etc/sudoers.d</directories>
  <directories realtime="yes" report_changes="yes">/root/.ssh</directories>
  <directories realtime="yes">/etc/cron.d,/var/spool/cron</directories>

  <ignore>/etc/mtab</ignore>
  <ignore type="sregex">.log$|.swp$</ignore>
  <nodiff>/etc/ssl/private</nodiff>              <!-- report the change, but don't send the content -->
</syscheck>
```

| Option | Meaning |
|---|---|
| `frequency` | Full scan interval in seconds (default 43200) |
| `realtime="yes"` | Changes reported immediately, via inotify; directories only |
| `whodata="yes"` | Along with the change, who made it (user, process); on Linux via auditd or eBPF |
| `report_changes="yes"` | Content diff for text files; keeps copies, uses disk space |
| `check_all` | All attribute checks (enabled by default) |
| `ignore` | Exclude a path (or a regex with `type="sregex"`) |
| `nodiff` | Report the change, but don't show the content (secrets!) |

### FIM alerts

| Rule | Level | Event |
|---|---|---|
| 554 | 5 | File added (`syscheck.event: added`) |
| 550 | 7 | Checksum or attributes changed (`modified`) |
| 553 | 7 | File deleted (`deleted`) |

```json
{
  "rule": { "id": "550", "level": 7, "description": "Integrity checksum changed.", "groups": ["ossec", "syscheck", "syscheck_entry_modified", "syscheck_file"] },
  "syscheck": {
    "path": "/etc/ssh/sshd_config",
    "mode": "realtime",
    "event": "modified",
    "changed_attributes": ["size", "mtime", "md5", "sha1", "sha256"],
    "sha256_before": "4c1e…", "sha256_after": "9a77…",
    "uname_after": "root", "perm_after": "rw-r--r--",
    "diff": "< PermitRootLogin no\n---\n> PermitRootLogin yes\n"
  }
}
```

Try it in the lab:

```bash
# after editing ossec.conf and restarting
echo "# test FIM $(date)" >> /etc/ssh/sshd_config
sleep 5
jq -c 'select(.rule.groups | index("syscheck")) | {id: .rule.id, path: .syscheck.path, event: .syscheck.event, diff: .syscheck.diff}' \
  /var/ossec/logs/alerts/alerts.json | tail -3
```

If the alert doesn't arrive right away, check `ossec.log`: realtime requires the directory to exist at startup, and changes outside realtime directories wait for the next scheduled scan.

> **In practice:** FIM over `/etc` on servers managed by Ansible or Puppet produces an alert on every deploy. Don't turn FIM off; add a level 0 rule for known paths during the maintenance window, or correlate with the deploy event. A change to `sshd_config` or `authorized_keys` outside a deploy is exactly what you want to see.

## SCA: Security Configuration Assessment

**SCA** (Security Configuration Assessment) checks configuration against YAML policies, most often the **CIS Benchmark**. It is run by `wazuh-modulesd`, and the policies for your OS are in `/var/ossec/ruleset/sca/` (for Debian 12, `cis_debian12.yml`).

```xml
<sca>
  <enabled>yes</enabled>
  <scan_on_start>yes</scan_on_start>
  <interval>12h</interval>
  <skip_nfs>yes</skip_nfs>
  <!-- optional: custom policies or disabling a built-in one -->
  <policies>
    <policy>etc/shared/kurs_ssh.yml</policy>
  </policies>
</sca>
```

Policy structure (a shortened example in the style of the built-in ones):

```yaml
policy:
  id: "kurs_ssh"
  file: "kurs_ssh.yml"
  name: "Course: basic SSH rules"
  description: "sshd configuration checks for the lab"

requirements:
  title: "Debian with OpenSSH server"
  description: "The policy applies only if sshd_config exists"
  condition: all
  rules:
    - "f:/etc/ssh/sshd_config"

checks:
  - id: 100001
    title: "Root login over SSH is disabled"
    rationale: "Logging in with an individual account and then using sudo leaves a clear trail of who did what."
    remediation: "In /etc/ssh/sshd_config set PermitRootLogin no and restart sshd."
    compliance:
      - cis: ["5.1.20"]
    condition: all
    rules:
      - 'c:sshd -T -> r:^permitrootlogin\s+no'
```

| Rule element | Meaning |
|---|---|
| `f:path` | File exists |
| `f:path -> r:regex` | File contains a line matching the regex |
| `c:command -> r:regex` | Command output contains a matching line |
| `d:directory` | Directory exists |
| `p:process` | Process is running |
| `not` before a rule | Negation |
| `condition: all / any / none` | All, at least one, or none of the rules must be true |

`sshd -T` prints the effective configuration in lowercase, which is why the regex looks for `permitrootlogin`. The built-in CIS policy uses the same approach.

The result of each check is `passed`, `failed` or `not applicable`. Alerts come from the rules in `0570-sca_rules.xml`:

| Rule | Level | When |
|---|---|---|
| 19001–19005 | 3–9 | Scan summary; the level rises as the score drops |
| 19007 | 7 | Check failed |
| 19008 | 3 | Check passed |
| 19011 | 9 | Status changed from passed to failed |

Rule 19011 is the most useful for detection: someone weakened a configuration that used to be correct.

```bash
jq -r 'select(.rule.groups | index("sca")) | [.rule.id, .rule.level, (.data.sca.check.result // .data.sca.score // "-"), .rule.description] | @tsv' \
  /var/ossec/logs/alerts/alerts.json | tail -20
```

SCA and FIM complement each other: FIM says "`sshd_config` was changed", SCA says "and now root login is no longer prohibited".

## Vulnerability detection

Since version 4.8, **vulnerability detection** runs on the manager: agents send their package inventory via **syscollector**, and the manager compares it against the Wazuh CTI vulnerability feed (CVE). Results are stored as state in the indexer, and changes (a new vulnerability, a resolved vulnerability) also generate alerts.

```xml
<vulnerability-detection>
  <enabled>yes</enabled>
  <index-status>yes</index-status>
  <feed-update-interval>60m</feed-update-interval>
</vulnerability-detection>
```

This doesn't work in the lab: there is no indexer and no internet access for the feed. That is a good lesson about dependencies: FIM and SCA run locally on the agent and produce alerts in `alerts.json`, while vulnerability detection needs the feed and the indexer. In air-gapped production environments Wazuh supports offline feed updates.

| Module | Where it runs | What it needs | Answers |
|---|---|---|---|
| FIM | Agent (`wazuh-syscheckd`) | Nothing extra | What changed on disk and (with whodata) who did it |
| SCA | Agent (`wazuh-modulesd`) | YAML policy | Whether the configuration complies with the standard |
| Vulnerability detection | Manager | Syscollector inventory, CTI feed, indexer | Which installed packages have known CVEs |

> **In practice:** Vulnerability detection across a large server fleet produces thousands of findings. You prioritize by combining: CVSS and whether an exploit exists (e.g. CISA KEV), the host's internet exposure, and the same host's SCA result. A vulnerable package on a server that isn't exposed and has a hardened configuration can wait; the same package on a public web server cannot.

## Summary

- Wazuh consists of the agent, manager (server), indexer and dashboard; agents send on 1514/TCP and enroll on 1515, the API is on 55000, the indexer on 9200.
- `wazuh-analysisd` performs pre-decoding, decoding and rule matching; you see all three phases in `wazuh-logtest`.
- The built-in ruleset is in `/var/ossec/ruleset/`, your rules and decoders in `/var/ossec/etc/`; run `wazuh-analysisd -t` before restarting.
- Levels are 0–15; the logging threshold is 3, level 0 silences; don't modify built-in rules, extend them with children in `local_rules.xml`.
- `alerts.json` is one JSON object per line with `rule`, `agent`, `data`, `full_log`, `location`; `agent.id` 000 is the manager.
- FIM: rules 554 (added), 550 (modified), 553 (deleted); `realtime`, `whodata`, `report_changes`, `nodiff` for secrets.
- SCA checks configuration against YAML policies (CIS); 19011 reports a drop from passed to failed. Vulnerability detection needs syscollector, the CTI feed and the indexer.
