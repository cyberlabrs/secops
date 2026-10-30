## What this module covers

The module covers three objectives from domain 1:

- **1.1** Linux logs: syslog and `auth.log`, **journald**, **auditd**; formats, time zones, log integrity.
- **1.2** Cloud and Kubernetes logs: **CloudTrail**, Azure Activity and **Entra sign-in**, **Kubernetes audit** (an overview of the sources; investigation is in module 02).
- **1.3** Collection and normalization: agents, **syslog forwarding**, schemas (**ECS**, **OCSF**), retention.

Why this is the first module: every detection is a query over a log. If the log does not exist, if its time is wrong, or if the `user` field means one thing in one source and something else in another, even the best Sigma rule will not help. Detection engineering starts with the question "do I have telemetry for this?", not with writing rules.

In the lab (a Debian 12 container with no network) you have rsyslog and sshd writing to `/var/log/auth.log`, and the Wazuh manager reads that file. The lab has no systemd, so journald and auditd are described here through example records and the commands you will use on real servers.

## Three layers of Linux logs

| Source | What it records | Where it lives | Format |
|---|---|---|---|
| **syslog** (rsyslog) | Service and kernel messages by facility/severity | `/var/log/syslog`, `/var/log/auth.log` | Text, one line per event |
| **journald** | Everything systemd services write to stdout/stderr, plus the kernel and the syslog API | `/run/log/journal` (volatile) or `/var/log/journal` (persistent) | Binary, structured fields |
| **auditd** | System calls and file access according to rules you define | `/var/log/audit/audit.log` | `key=value` text, several records per event |

These are not competitors but layers. sshd reports a failed login through the syslog API; journald receives it and rsyslog writes it to `auth.log`. auditd sees something else: which process opened `/etc/shadow` or called `execve`, regardless of whether the application logs anything.

### syslog: facility and severity

Every syslog message has a **facility** (who is sending) and a **severity** (how important it is). From these, rsyslog decides which file to write to.

| Facility | Example sender | Severity (0 most severe) |
|---|---|---|
| `auth`, `authpriv` | sshd, sudo, su, PAM | 0 emerg, 1 alert, 2 crit |
| `cron` | cron | 3 err, 4 warning |
| `daemon` | services without their own facility | 5 notice, 6 info |
| `kern` | kernel | 7 debug |
| `local0`–`local7` | your applications | |

On Debian the rule in `/etc/rsyslog.conf` is:

```text
auth,authpriv.*                 /var/log/auth.log
*.*;auth,authpriv.none          -/var/log/syslog
```

That is why security-relevant events end up in `auth.log` and not in `syslog`.

### What auth.log looks like

Since Debian 12, rsyslog writes a **high precision timestamp** per RFC 3339 by default (with microseconds and the zone). Older systems and many distributions still use the traditional `Oct 16 09:14:02` format with no year and no zone. The same event in both formats:

```text
2026-10-16T09:14:02.481233+00:00 lab sshd[412]: Failed password for invalid user admin from 10.0.5.23 port 51522 ssh2
Oct 16 09:14:02 lab sshd[412]: Failed password for invalid user admin from 10.0.5.23 port 51522 ssh2
```

Typical records you will search for:

```text
sshd[412]: Invalid user admin from 10.0.5.23 port 51522
sshd[412]: Failed password for invalid user admin from 10.0.5.23 port 51522 ssh2
sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2
sshd[430]: Accepted password for deploy from 10.0.5.23 port 51602 ssh2
sshd[430]: pam_unix(sshd:session): session opened for user deploy(uid=1001) by (uid=0)
sudo:   deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/cat /etc/shadow
useradd[455]: new user: name=backup2, UID=1002, GID=1002, home=/home/backup2, shell=/bin/bash
```

Quick counts in the lab:

```bash
# failed logins per source IP address
grep -E 'Failed password|Invalid user' /var/log/auth.log \
  | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn

# successful logins: who, from where, how
grep -oE 'Accepted \w+ for \S+ from [0-9.]+' /var/log/auth.log

# all sudo commands
grep 'sudo:' /var/log/auth.log | grep 'COMMAND='
```

The pattern "many `Failed password` followed by one `Accepted` from the same IP address" is the classic trace of a successful **brute force** attack (ATT&CK T1110). Wazuh has built-in rules exactly for this, as you will see in module 03.

> **In practice:** Before you write any rule, look at the raw log with `tail -f` and produce the event yourself (a wrong password via `ssh deploy@localhost`). Half of detection bugs come from assumptions about what the log looks like, not from wrong logic.

### journald

**journald** stores structured records with fields that start with an underscore (`_PID`, `_UID`, `_SYSTEMD_UNIT`, `_COMM`), which a process cannot forge because journald adds them itself. That is an advantage over text syslog, where the program name is just part of a string.

```bash
# sshd runs as ssh.service on Debian
journalctl -u ssh --since "2026-10-16 09:00" --until "2026-10-16 10:00"

# only errors and worse, since the last boot
journalctl -p err -b

# JSON, one record per line, for jq or a SIEM
journalctl -u ssh -o json --since today | jq -r '[.__REALTIME_TIMESTAMP, ._PID, .MESSAGE] | @tsv'

# filter by field
journalctl _COMM=sudo _UID=1001
```

Part of a JSON record:

```json
{
  "__REALTIME_TIMESTAMP": "1792142042481233",
  "_HOSTNAME": "web01",
  "_SYSTEMD_UNIT": "ssh.service",
  "_COMM": "sshd",
  "_PID": "412",
  "SYSLOG_FACILITY": "10",
  "PRIORITY": "6",
  "MESSAGE": "Failed password for root from 10.0.5.23 port 51540 ssh2"
}
```

`__REALTIME_TIMESTAMP` is in microseconds since the epoch, always UTC. The display in `journalctl` is in the local zone unless you add `--utc`.

Important settings in `/etc/systemd/journald.conf`:

| Option | Meaning |
|---|---|
| `Storage=persistent` | Store in `/var/log/journal` (otherwise records are lost on reboot if the directory does not exist) |
| `SystemMaxUse=` | Upper limit on disk usage; old records are deleted |
| `ForwardToSyslog=` | Forwarding to rsyslog (if installed) |
| `Seal=yes` | **Forward Secure Sealing**, cryptographic sealing (see integrity below) |

On Debian 12, rsyslog is no longer installed by default, so on a clean installation `/var/log/auth.log` may not exist. The agent must then read journald directly. The Wazuh agent (newer 4.x versions) does this through a `<localfile>` in which both `<location>` and `<log_format>` are set to `journald`.

### auditd

**auditd** is the user-space part of the Linux Audit subsystem in the kernel. It does not depend on what an application decides to log: the kernel reports a system call that matches a rule. Rules live in `/etc/audit/rules.d/*.rules` and are loaded with `augenrules --load`.

```text
# /etc/audit/rules.d/50-kurs.rules
# access to sensitive files (w = write, a = attribute change, r = read)
-w /etc/shadow -p rwa -k shadow_access
-w /etc/passwd -p wa -k identity
-w /etc/sudoers -p wa -k priv_esc
-w /etc/sudoers.d/ -p wa -k priv_esc

# every program execution (64-bit calls), only for real users
-a always,exit -F arch=b64 -S execve -F auid>=1000 -F auid!=unset -k exec
```

A single event consists of several records with the same serial number in `msg=audit(epoch:serial)`:

```text
type=SYSCALL msg=audit(1792142102.311:2045): arch=c000003e syscall=257 success=yes exit=3 ppid=430 pid=470 auid=1001 uid=0 gid=0 euid=0 comm="cat" exe="/usr/bin/cat" key="shadow_access"
type=CWD msg=audit(1792142102.311:2045): cwd="/home/deploy"
type=PATH msg=audit(1792142102.311:2045): item=0 name="/etc/shadow" inode=1311 nametype=NORMAL
```

The most important field for an investigation is **auid** (audit user ID, "loginuid"): the user who originally logged in. When `deploy` runs `sudo cat /etc/shadow`, `uid` is 0 (root), but `auid` stays 1001. That is how you know who is really behind a root action.

```bash
ausearch -k shadow_access --start today -i     # -i translates UIDs and syscalls into names
ausearch -ua 1001 -ts 09:00 -te 10:00          # by auid
aureport --auth --summary                      # authentication summary
aureport -x --summary                          # most frequently executed programs
```

> **In practice:** An `-S execve` rule for all users on a busy server produces an enormous volume of records. Start with `-w` rules on a small number of sensitive files and `execve` only for interactive users (`auid>=1000`), then expand once you see the volume.

## Time and time zones

An investigation is the reconstruction of a timeline from multiple sources. If the sources do not share the same clock and the same zone, the timeline lies.

| Source | Time in the record |
|---|---|
| auth.log (traditional format) | Host local time, **no year and no zone** |
| auth.log (Debian 12, RFC 3339) | Local time with an offset, e.g. `+02:00` |
| journald | Microseconds since the epoch (UTC), displayed in local time |
| auditd | Seconds since the epoch (UTC) in `msg=audit(...)` |
| CloudTrail `eventTime` | UTC, ISO 8601 with `Z` |
| Kubernetes audit | UTC, `requestReceivedTimestamp` and `stageTimestamp` |
| Wazuh `alerts.json` | `timestamp` with the manager's zone offset |

Rules that save hours:

- All servers in **UTC** and synchronized via NTP (`chronyc tracking`, `timedatectl`).
- Where you can, log with the zone (RFC 3339). The traditional format has no year, so records around New Year are easily sorted wrong.
- Convert epoch time with `date -u -d @1792142102`.
- In an incident report, write every time in UTC and state that once.

> **In practice:** When you combine auth.log from a server in Frankfurt with CloudTrail, first write down the offset of each source. The classic mistake is concluding "the attacker got into AWS an hour before the SSH login" when the difference is just CET versus UTC.

## Log integrity

An attacker with root access can delete or modify local logs (ATT&CK **T1070.002**, Clear Linux or Mac System Logs). The defense is layered:

| Measure | What it achieves |
|---|---|
| Shipping logs off the host immediately (agent, syslog forwarding) | A copy is out of the attacker's reach before they get root |
| Append-only attribute (`chattr +a /var/log/auth.log`) | The file cannot be overwritten, only appended to (root can remove the attribute, but that leaves an additional trace) |
| journald **Forward Secure Sealing** | `journalctl --setup-keys`, then `Seal=yes`; `journalctl --verify` detects later modifications |
| auditd rule on the logs themselves | `-w /var/log/ -p wa -k log_tamper` |
| CloudTrail **log file integrity validation** | Digest files with a hash and signature; `aws cloudtrail validate-logs` |
| Immutable storage (S3 Object Lock) | Not even an administrator can delete before retention expires |

Traces of deletion to look for: a gap in time (no records for 40 minutes on a busy server), a file shorter than yesterday, empty `wtmp`/`btmp`, or `auditd` events of type `CONFIG_CHANGE` and `DAEMON_END`.

```bash
# verify FSS seals (on a host with systemd)
journalctl --verify

# is someone touching the logs: size and mtime
stat -c '%n %s %y' /var/log/auth.log*
```

## Cloud and Kubernetes sources (overview)

The detailed investigation is in module 02. What matters here is knowing which source answers which question.

| Source | Answers the question | Key fields |
|---|---|---|
| **AWS CloudTrail** | Who called which AWS API, from where, with which credentials | `eventTime`, `eventSource`, `eventName`, `userIdentity`, `sourceIPAddress`, `errorCode` |
| **Azure Activity log** | Changes to Azure resources (control plane) | `OperationNameValue`, `Caller`, `ActivityStatusValue`, `ResourceId` |
| **Entra ID sign-in logs** | Sign-ins of users and service principals | `UserPrincipalName`, `IPAddress`, `ResultType`, `AppDisplayName`, `ConditionalAccessStatus` |
| **Kubernetes audit** | Who asked the API server for what | `user.username`, `verb`, `objectRef`, `sourceIPs`, `responseStatus.code` |

Important differences:

- By default CloudTrail records **management events** (control plane, e.g. `CreateUser`, `RunInstances`). **Data events** (e.g. S3 `GetObject`) must be explicitly enabled and are billed separately. Event history in the console keeps 90 days of management events; for longer retention and for a SIEM you need a **trail** to S3.
- Entra sign-in logs have `ResultType` 0 for success and a number on error, e.g. `50126` for an invalid username or password. In Sentinel these are the `SigninLogs` and `AzureActivity` tables.
- Kubernetes audit is **not enabled by default** on a kubeadm cluster: kube-apiserver needs `--audit-policy-file` and `--audit-log-path` (you did this in the CKS course). Managed clusters (EKS, AKS, GKE) send it to their logging service, often only once you enable it.

The same "failed login" event in three sources:

```text
auth.log:   sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2
CloudTrail: "eventName": "ConsoleLogin", "responseElements": {"ConsoleLogin": "Failure"}
Entra:      ResultType = 50126, UserPrincipalName = "ana@firma.onmicrosoft.com"
```

Three formats, three names for the user and the IP address. That is why normalization exists.

## Collection: agent or syslog forwarding

| Method | How it works | Advantages | Disadvantages |
|---|---|---|---|
| **Agent** (Wazuh agent, Elastic Agent, Splunk UF) | A process on the host reads files and journald and sends them encrypted | Buffering when the network is down, FIM, inventory, response | Software on every host, maintenance |
| **Syslog forwarding** (rsyslog/syslog-ng) | The host sends syslog messages to a central collector | Built in, also works on network equipment | Only what goes through syslog; UDP loses messages |
| **API pull** | The collector pulls from a cloud API or S3 | The only option for SaaS and cloud | Latency, quotas, collector credentials |
| **Push to a stream** | The service sends to Kinesis, Event Hub, Pub/Sub | Scales | Vendor-dependent |

### rsyslog forwarding

Forwarding to a collector over TCP with an on-disk queue, so that messages are not lost when the collector is unavailable:

```text
# /etc/rsyslog.d/90-siem.conf
auth,authpriv.*  action(type="omfwd"
                        target="siem.interno" port="514" protocol="tcp"
                        queue.type="LinkedList" queue.filename="siem_fwd"
                        queue.saveOnShutdown="on" action.resumeRetryCount="-1")
```

The short legacy syntax: `*.* @host:514` is UDP, `*.* @@host:514` is TCP. UDP syslog has no delivery acknowledgment, is sent in clear text and is easy to spoof. For production use TCP with TLS (the rsyslog `gtls` driver) or an agent.

Reception on the Wazuh manager goes through a `<remote>` block in `ossec.conf` (port 514, disabled by default), with a list of allowed sources:

```xml
<remote>
  <connection>syslog</connection>
  <port>514</port>
  <protocol>tcp</protocol>
  <allowed-ips>10.0.0.0/16</allowed-ips>
</remote>
```

### Local file in the lab

There is no agent in the lab: the manager itself reads `auth.log` through `<localfile>`:

```xml
<localfile>
  <log_format>syslog</log_format>
  <location>/var/log/auth.log</location>
</localfile>
```

`log_format` tells Wazuh how to split records. Values you will encounter: `syslog` (one line per event, also for most text logs), `json`, `journald`, `audit` (for `audit.log`), `multi-line`.

```bash
grep -A3 '<localfile>' /var/ossec/etc/ossec.conf
tail -f /var/ossec/logs/ossec.log | grep -i logcollector   # confirm that the file was opened
```

> **In practice:** Before onboarding a new source into the SIEM, calculate the volume (`du -sh`, lines per day). Commercial SIEM licenses are usually billed per GB per day, and even the free Wazuh indexer has its cost in disk. Filter noise at the source, not in the SIEM.

## Normalization: ECS and OCSF

**Normalization** maps fields from different sources to a common schema, so that one rule ("the same IP address has 20 failed logins") works across SSH, VPN and cloud sign-ins.

| Schema | Who uses it | Style |
|---|---|---|
| **ECS** (Elastic Common Schema) | Elastic; the OpenTelemetry semantic conventions came out of the merger with ECS | Named dotted fields: `source.ip`, `user.name`, `event.outcome` |
| **OCSF** (Open Cybersecurity Schema Framework) | AWS Security Lake, many vendors | Event classes with numeric IDs: `class_uid`, `activity_id`, `status_id` |
| Wazuh fields | Wazuh decoders | `data.srcip`, `data.srcuser`, `data.dstuser` |
| Sentinel ASIM | Microsoft Sentinel | Parsers per schema (Authentication, NetworkSession…) |

The same failed SSH login in ECS:

```json
{
  "@timestamp": "2026-10-16T09:14:02.481Z",
  "event": { "category": ["authentication"], "type": ["start"], "outcome": "failure" },
  "source": { "ip": "10.0.5.23", "port": 51540 },
  "user": { "name": "root" },
  "host": { "name": "lab" },
  "process": { "name": "sshd", "pid": 418 }
}
```

And in OCSF (the **Authentication** class, `class_uid` 3002, category Identity & Access Management):

```json
{
  "time": 1792142042481,
  "class_uid": 3002,
  "category_uid": 3,
  "activity_id": 1,
  "status_id": 2,
  "status": "Failure",
  "user": { "name": "root" },
  "src_endpoint": { "ip": "10.0.5.23", "port": 51540 },
  "metadata": { "product": { "name": "sshd" }, "version": "1.x" }
}
```

`activity_id` 1 is Logon, `status_id` 2 is Failure. CloudTrail API calls go into the **API Activity** class (`class_uid` 6003) in OCSF, and AWS Security Lake stores them that way.

Normalization has a cost: the original message must be preserved (`event.original` in ECS, `raw_data` in OCSF, `full_log` in Wazuh), because a parser can make mistakes and a forensic analyst needs the raw record.

## Retention

How long to keep logs depends on three things: regulations, the average time to detection (attacks are often discovered only after several weeks) and cost.

| Tier | Typical duration | Where |
|---|---|---|
| Hot (searchable in the SIEM) | 30–90 days | Indexer, SIEM |
| Warm/cold (slower, cheaper) | 1 year | Object storage, archive indices |
| Archive (regulatory) | As required (e.g. PCI DSS requires one year, of which 3 months immediately available) | S3 with Object Lock, Glacier |

Local rotation is a different matter: `logrotate` on the host deletes old files (`/etc/logrotate.d/rsyslog`, usually 4 weeks). That is why the host is not the place for retention; the central system is.

> **In practice:** For any retention setting, ask yourself "can I answer what this key was doing 120 days ago?". If CloudTrail is only in Event history (90 days) and there is no trail to S3, the answer is no.

## Briefly: SIEM queries over the same data

The same question ("IP addresses with more than 10 failed SSH logins") in three languages, so you can see that the logic is the same and the syntax differs:

```text
# Splunk SPL
index=linux sourcetype=linux_secure "Failed password"
| rex "from (?<src_ip>\d+\.\d+\.\d+\.\d+)" | stats count by src_ip | where count > 10

# Microsoft Sentinel KQL (Syslog table)
Syslog | where ProcessName == "sshd" and SyslogMessage has "Failed password"
| extend src_ip = extract(@"from (\d+\.\d+\.\d+\.\d+)", 1, SyslogMessage)
| summarize count() by src_ip | where count_ > 10

# Lab: shell over the raw file
grep 'Failed password' /var/log/auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | awk '$1>10'
```

## Summary

- Linux has three layers of logs: syslog (text, facility/severity), journald (structured fields; the `_` fields are added by journald) and auditd (system calls according to rules; `auid` preserves the real user).
- Debian 12 rsyslog writes RFC 3339 time with the zone; the traditional format has neither year nor zone. Keep servers in UTC with NTP.
- Integrity: ship logs off the host immediately, use FSS, append-only and immutable storage; look for gaps in time as a trace of deletion (T1070.002).
- CloudTrail, Azure Activity, Entra sign-in and Kubernetes audit answer the question "who called which API"; CloudTrail data events and Kubernetes audit must be explicitly enabled.
- An agent provides buffering, encryption and additional functions; syslog forwarding over UDP loses messages and is easy to spoof, so use TCP with TLS.
- ECS (named fields) and OCSF (classes with IDs, e.g. Authentication 3002, API Activity 6003) let one rule work across multiple sources; always preserve the original record.
- Retention is planned according to regulations and time to detection; a host with logrotate is not an archive.
