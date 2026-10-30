## What this module covers

The module covers two objectives from domain 6:

- **6.1** Incident response frameworks: **NIST SP 800-61r3** and **CSF 2.0**, roles, **playbooks** and **runbooks**.
- **6.2** Triage and evidence collection: **order of volatility**, **chain of custody**, **Linux live response**.

After this module you know:

- what is new in NIST SP 800-61r3 and how the old life cycle maps to the CSF 2.0 functions;
- who takes part in incident response and who makes which decision;
- how to triage an alert up to the "incident or not" decision and set its priority;
- in what order and with which tools you collect evidence from a live Linux system, and how you prove you did not change it.

Containment, eradication, recovery and runbooks for specific incidents are in module 10.

## Event, adverse event, incident

NIST SP 800-61r3 distinguishes:

| Term | Meaning | Example |
|---|---|---|
| **Event** | Any observable occurrence on systems, networks, services or in the cloud | A user login, an update installation |
| **Adverse event** | An event with a negative consequence, regardless of cause | Failed logins from an unknown IP address, a service outage |
| **Cybersecurity incident** | An occurrence that actually or imminently jeopardizes confidentiality, integrity or availability without lawful authority, or violates law or security policies | A successful attacker login, data exfiltration, ransomware |

An alert in the SIEM is an adverse event until analysis shows otherwise. Deciding that something is an incident is a formal step (CSF `DE.AE-08`: incidents are declared when adverse events meet the defined incident criteria). From that moment the incident response plan, roles and notification deadlines apply.

## NIST SP 800-61r3 and CSF 2.0

**NIST SP 800-61 Rev. 3** (*Incident Response Recommendations and Considerations for Cybersecurity Risk Management*) was published in April 2025 and supersedes Rev. 2 from 2012. It is no longer a standalone handbook with four phases but a **CSF 2.0 Community Profile**: the recommendations are organized by the functions, categories and subcategories of the **NIST Cybersecurity Framework 2.0**.

The reason: in 2012 incidents were rarer, narrower and over within a day or two, so a circular life cycle with a dedicated team made sense. Today incidents are frequent, recovery takes weeks, and response is part of the whole organization's risk management. Lessons should be shared as soon as they are learned, not only at the end.

### The six CSF 2.0 functions

| Function | Identifier | Role in incident response |
|---|---|---|
| **Govern** | GV | Strategy, policies, roles, responsibilities; preparation |
| **Identify** | ID | Inventory, risk assessment; the **Improvement (ID.IM)** category carries lessons learned |
| **Protect** | PR | Safeguards, training, backups; preparation |
| **Detect** | DE | Finding and analyzing possible attacks |
| **Respond** | RS | Actions on a detected incident |
| **Recover** | RC | Restoring assets and operations |

The r3 model has three levels: Govern, Identify and Protect are **preparation** (broader risk management, not the response itself); Detect, Respond and Recover are **incident response**; and **ID.IM** (Improvement) is continuous improvement fed by lessons from all functions.

### Mapping the old life cycle

| Phase from SP 800-61r2 | CSF 2.0 functions in r3 |
|---|---|
| Preparation | Govern, Identify (all categories), Protect |
| Detection & Analysis | Detect, Identify (Improvement) |
| Containment, Eradication & Recovery | Respond, Recover, Identify (Improvement) |
| Post-Incident Activity | Identify (Improvement) |

Many teams still talk about the r2 phases (preparation, detection and analysis, containment–eradication–recovery, post-incident activity). That is fine. NIST explicitly says an organization should use whatever model suits it; r3 just provides a common language with the CSF.

### Categories the SOC uses every day

| Category | What it covers | Example subcategories |
|---|---|---|
| **DE.CM** Continuous Monitoring | Monitoring assets to find anomalies | DE.CM-01 networks, DE.CM-03 personnel activity, DE.CM-09 hardware and software |
| **DE.AE** Adverse Event Analysis | Analyzing anomalies and indicators | DE.AE-02 event analysis, DE.AE-03 correlation from multiple sources, DE.AE-04 impact and scope estimation, DE.AE-08 incident declaration |
| **RS.MA** Incident Management | Managing the response | RS.MA-01 plan execution, RS.MA-02 triage and validation, RS.MA-03 categorization and prioritization, RS.MA-04 escalation, RS.MA-05 criteria for initiating recovery |
| **RS.AN** Incident Analysis | Investigation | RS.AN-03 what happened and the root cause, RS.AN-06 recording investigative actions, RS.AN-07 collecting data while preserving integrity and provenance, RS.AN-08 estimating incident magnitude |
| **RS.CO** Incident Response Reporting and Communication | Communication | RS.CO-02 notifying stakeholders, RS.CO-03 sharing information |
| **RS.MI** Incident Mitigation | Preventing expansion | RS.MI-01 containment, RS.MI-02 eradication |
| **RC.RP** Incident Recovery Plan Execution | Recovery | RC.RP-03 verifying backup integrity, RC.RP-05 verifying restored assets, RC.RP-06 declaring the end of recovery |
| **RC.CO** Incident Recovery Communication | Recovery communication | RC.CO-03 recovery progress, RC.CO-04 public updates |

> **In practice:** category identifiers are useful in reports and tickets. "We have no RS.AN-07" is a clearer message to management than "we have no forensic procedure": it shows immediately where in the framework the gap is and which r3 recommendation is relevant.

## Roles

r3 stresses that response is no longer the job of the incident response team alone. Typical roles:

| Role | Responsibility |
|---|---|
| **Leadership** | Oversight, budget, high-impact decisions (shutting down or rebuilding a critical service) |
| **Incident handlers** | Verify the incident, collect and analyze evidence, set priorities, limit damage; internal, contracted (MSSP, SOC) or on demand |
| **Incident lead** (incident commander) | One person coordinating one incident; r3 recommends designating one for every incident |
| **Technical teams** | Systems, network, cloud, development: carry out changes, know the systems |
| **Legal** | Legal obligations, privacy, vendor contracts, contact with law enforcement |
| **Public relations** | Communication with the media and the public |
| **Human resources** | When an employee is involved in the incident |
| **Physical security** | Access to facilities and equipment |
| **Asset owners** | Recovery priorities for their systems and data |
| **Third parties** | Cloud provider, ISP, MSSP: the **shared responsibility model**, with the contract defining who may do what |

In addition, every incident needs a **scribe** who keeps the timeline and records decisions. For the cloud, also keep in mind that the provider (AWS, Azure) has its own share of responsibility and its own procedures for reporting incidents. Legal and contractual contacts should be known **before** the incident.

## Policy, plan, playbook, runbook

| Document | Answers | Example |
|---|---|---|
| **Policy** | Who has authority, what an incident is, how priority is set | "The SOC lead may isolate any host without the owner's approval" |
| **Plan** (IR plan) | How the organization handles incidents in general | Roles, communication channels, escalation, notifying regulators |
| **Playbook** | What we do for a **type** of incident: decisions, roles, communication, order of phases | "Compromised cloud account", "Ransomware" |
| **Runbook** | **How** a specific technical task is performed, step by step, with commands | "Deactivate an IAM access key and check CloudTrail" |

A playbook points to runbooks. The playbook says "contain the compromised key"; the runbook says exactly which commands, who runs them and how the result is verified. r3 recommends documented procedures for the most common incidents and a playbook format for usability, with examples in the CISA *Incident & Vulnerability Response Playbooks*.

In SOAR tools (Sentinel playbooks on Logic Apps, Splunk SOAR) "playbook" often means an automated workflow. The concept is the same: a sequence of steps for an incident type, except that a machine performs some of the steps.

> **In practice:** a runbook must be executable at 3 a.m. by an on-call engineer who has never read it before. If a step requires access the on-call engineer does not have (a role, VPN, a break-glass account), the runbook is broken. Test runbooks in exercises (tabletop) and in the lab, just like detections.

## Triage

Triage (RS.MA-02) answers four questions, quickly:

1. **Is it real?** A false positive, a test (purple team, module 08) or real activity?
2. **What is affected?** Which host, account, data, service; how critical is it?
3. **Is it ongoing?** Is the attacker still active, and how fast is it spreading?
4. **What is the priority?** Based on impact and urgency.

As factors for assessing risk, r3 lists: asset criticality, functional impact, information impact, the stage of the observed activity, attacker characterization and recoverability. Incidents are **not** handled in order of arrival.

Example priority matrix:

| Priority | Criteria (any) | Response |
|---|---|---|
| **P1 critical** | Confirmed attacker access to production or a privileged account; data exfiltration; ransomware | Immediately, 24/7, incident lead, leadership notified |
| **P2 high** | A single compromised host or user account with no evidence of spread; a leaked secret with production access | Within 1 h |
| **P3 medium** | Suspicious activity without confirmation; malware blocked but executed | Same business day |
| **P4 low** | Scanning, failed attempts, policy violations without damage | Normal queue |

### Example: triaging an SSH alert from Wazuh

In `alerts.json` you see a series of failed logins followed by a successful login for the same user:

```bash
A=/var/ossec/logs/alerts/alerts.json
jq -r 'select(.rule.groups | index("sshd")) |
       [.timestamp, .rule.id, .rule.level, .rule.description, (.data.srcip // "-"), (.data.dstuser // "-")] | @tsv' $A | tail -20
```

Triage questions and the commands that answer them:

```bash
# has srcip ever logged in successfully before? (from auth.log, not just from alerts)
grep 'Accepted' /var/log/auth.log | awk '{print $1,$2,$3,$9,$11}' | sort | uniq -c

# what did the user do after logging in (sudo, new accounts)?
grep -E 'sudo|useradd|usermod' /var/log/auth.log | tail -20

# is the session still active?
who; ss -tnp state established '( sport = :22 )'
```

If the login succeeded after a series of wrong passwords, from an IP address never used before, and the user immediately ran `sudo`, it is an incident (P1 or P2 depending on host criticality). Declare it, open a ticket, designate a lead and start the timeline.

### Timeline

From the first minute, keep a timeline in **UTC**, with the source of every entry:

```text
2026-10-14T09:02:11Z  auth.log  10 failed logins for marko from 203.0.113.50 (Wazuh 5763)
2026-10-14T09:02:40Z  auth.log  Accepted password for marko from 203.0.113.50 (Wazuh 5715)
2026-10-14T09:03:05Z  auth.log  marko: sudo /bin/bash (Wazuh 5402)
2026-10-14T09:04:12Z  auth.log  useradd: new user name=sysupdate (Wazuh 5902)
2026-10-14T09:15:00Z  SOC       alert triaged, incident IR-2026-031 declared, P1   [action: ana]
```

Distinguish **observations** (what the log says) from **actions** (what the team did). RS.AN-06 requires investigative actions to be recorded and their integrity and provenance preserved.

## Evidence collection

### Order of volatility

**RFC 3227** (*Guidelines for Evidence Collection and Archiving*) says: collect from the most volatile to the least volatile, because volatile data disappears on its own or as a result of your actions.

| Order | RFC 3227 | On Linux | Tool in the lab |
|---|---|---|---|
| 1 | Registers, cache | Practically unreachable without special tools | — |
| 2 | Routing table, ARP cache, process table, kernel statistics, memory | `ip route`, `ip neigh`, processes, `/proc`, network connections, RAM | `ps`, `ss`, `lsof`, `/proc/<pid>/` |
| 3 | Temporary file systems | `/tmp`, `/dev/shm`, `/run`, `/var/tmp` | `find`, `sha256sum` |
| 4 | Disk | File system, configuration, logs on disk | `find`, `crontab`, file copies |
| 5 | Remote logging and monitoring data | SIEM, CloudTrail, central syslog | `jq` over `alerts.json` |
| 6 | Physical configuration, network topology | Diagrams, inventory | — |
| 7 | Archival media | Backups | — |

Memory (RAM) is second on the list and is often the most valuable evidence (keys, fileless processes, connections). Tools such as AVML or LiME exist for capturing it; they are not part of this lab, but it is important to know that it is lost when the machine is shut down.

RFC 3227 also lists what **not** to do:

- do not shut down the system until evidence has been collected;
- do not trust the programs on the compromised system (use trusted, statically linked tools from your own media);
- do not run programs that modify the access time of all files (e.g. `tar` or a recursive copy across the whole disk);
- be careful with disconnecting from the network: the attacker may have a "dead man switch" that wipes traces when the connection is lost.

### Chain of custody

**Chain of custody** is the record proving that evidence has not been altered between collection and use. Per RFC 3227 you record:

- where, when and by whom the evidence was discovered and collected;
- where, when and by whom it was handled or examined;
- who had custody of it, during what period and how it was stored;
- when and how custody changed (handover).

In addition, for digital evidence, a **hash** (SHA-256) at the time of collection. Every later hash check proves integrity.

```text
Evidence: IR-2026-031-E03  ir-lab-20261014T0920Z.tar.gz
SHA-256: 6f1c…e9a2
Collected by: ana.k (SOC), 2026-10-14T09:31Z, host lab, method: live response script v1.2
Storage: evidence bucket, object lock (WORM), access only for the IR role
Handover: 2026-10-14T11:00Z ana.k -> marko.p (forensics), hash verified, matches
```

Keep a chain of custody even when you do not plan legal proceedings. You do not know in advance whether the incident will end up with legal, the insurer or a regulator.

> **In practice:** in the cloud, chain of custody is easier than with a physical disk: an EBS snapshot, a copy of the logs in a bucket with **Object Lock** and CloudTrail records of who accessed them have timestamps and identity built in. Take advantage of that: keep evidence in a dedicated forensics account that production accounts can only write to.

## Linux live response

**Live response** is collecting volatile data from a running system before containment that would destroy it. Rules:

- **Do not write output to the compromised disk** if you can avoid it. Use a network share, attached media or a pipe over SSH. In the lab, for simplicity, we use `/root/ir/`.
- **Record everything you do**: command, time, who. The simplest way: a `script` session or a script that logs every step.
- **Hash** the outputs immediately.
- **Change as little as possible**: do not install packages, do not run scanners that read the whole disk.

### Setup

```bash
CASE=IR-2026-031
OUT=/root/ir/$CASE/$(hostname)-$(date -u +%Y%m%dT%H%MZ)
mkdir -p "$OUT" && cd "$OUT"
script -q -a "$OUT/session.log"          # from now on the whole session is recorded (exit at the end)
date -u > 00-date-utc.txt; uptime >> 00-date-utc.txt; uname -a >> 00-date-utc.txt
```

### 1. Network and processes (most volatile)

```bash
ss -tanup                      > 10-ss-tcp-udp.txt        # all TCP/UDP connections with their process
ss -lntup                      > 11-ss-listen.txt         # listening ports
ip addr; ip route; ip neigh    > 12-ip.txt 2>&1
iptables -S                    > 13-iptables.txt 2>&1

ps -eo pid,ppid,user,lstart,etimes,cmd --forest > 20-ps-forest.txt
ls -l /proc/[0-9]*/exe 2>/dev/null              > 21-proc-exe.txt
grep -F '(deleted)' 21-proc-exe.txt             > 22-deleted-exe.txt    # process whose file was deleted
lsof -nP                                        > 23-lsof.txt 2>/dev/null
lsof -nP -i                                     > 24-lsof-net.txt 2>/dev/null
who -a > 25-who.txt; w >> 25-who.txt; last -Faiw > 26-last.txt 2>&1
```

For a suspicious process (e.g. PID 4242), save everything from `/proc` before you stop it:

```bash
P=4242; mkdir -p proc-$P
tr '\0' ' ' < /proc/$P/cmdline > proc-$P/cmdline.txt
tr '\0' '\n' < /proc/$P/environ > proc-$P/environ.txt 2>/dev/null
ls -l /proc/$P/cwd /proc/$P/exe   > proc-$P/links.txt
ls -l /proc/$P/fd                 > proc-$P/fd.txt
cat /proc/$P/maps                 > proc-$P/maps.txt
cp /proc/$P/exe proc-$P/exe.bin   # works even when the binary has been deleted from disk
sha256sum proc-$P/exe.bin
```

The key point: a binary the attacker deleted from disk still exists while the process is running, and `/proc/<pid>/exe` is the only way to reach it. If you kill the process first, that evidence is lost.

### 2. Temporary file systems

```bash
find /tmp /var/tmp /dev/shm /run -xdev -type f -printf '%T+ %u %m %s %p\n' 2>/dev/null | sort > 30-tmp-files.txt
find /tmp /var/tmp /dev/shm -xdev -type f -perm -u+x -printf '%p\n' 2>/dev/null \
  | xargs -r sha256sum > 31-tmp-exec-sha256.txt
```

### 3. Persistence and disk

```bash
for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null | sed "s/^/$u: /"; done > 40-crontabs.txt
ls -la /etc/cron.* /etc/crontab /var/spool/cron 2>/dev/null > 41-cron-files.txt
systemctl list-timers --all > 42-timers.txt 2>&1
systemctl list-unit-files --state=enabled > 43-enabled-units.txt 2>&1
find / -xdev -name authorized_keys -printf '%T+ %u %p\n' 2>/dev/null > 44-authorized-keys.txt
awk -F: '$3==0 || $3>=1000 {print}' /etc/passwd > 45-users.txt
find /etc /usr/local/bin /usr/bin -xdev -newermt '2026-10-14 09:00' -type f -printf '%T+ %p\n' 2>/dev/null | sort > 46-changed-since.txt
```

`-newermt` finds files modified after the start of the incident according to the timeline. An attacker can forge modification times (`touch`), so treat them as a lead, not as proof.

### 4. Logs

```bash
cp -p /var/log/auth.log* .                                   # -p preserves timestamps
cp -p /var/ossec/logs/alerts/alerts.json wazuh-alerts.json
journalctl --since '2026-10-14 08:00' -o short-iso-precise > 50-journal.txt 2>/dev/null
```

### Packaging and hashing

```bash
exit                                         # end of the script session
cd "$(dirname "$OUT")"
sha256sum "$(basename "$OUT")"/* > "$(basename "$OUT")"/SHA256SUMS 2>/dev/null
tar czf "$(basename "$OUT")".tar.gz "$(basename "$OUT")"
sha256sum "$(basename "$OUT")".tar.gz | tee "$(basename "$OUT")".tar.gz.sha256
```

You enter the archive hash into the chain of custody record. Move a copy of the archive to the evidence store immediately; nothing you rely on stays on the compromised host.

> **In practice:** build a live response script in advance, test it in the lab and keep it under version control. Under stress people forget to run `ss` before `kill`, or write output to `/tmp` on the compromised host. A script with a fixed order (network → processes → `/proc` → tmp → persistence → logs) and automatic hashing removes those mistakes. In Microsoft Defender for Endpoint the same job is done by "Collect investigation package" and a live response session (SC-200).

### Containers and Kubernetes

Containers are ephemeral: when the orchestrator kills a pod, its file system and processes are gone. So the order is the same, but with additional steps:

| What | How |
|---|---|
| Pod metadata | `kubectl get pod <p> -n <ns> -o yaml`, `kubectl describe pod` (image, digest, node, ServiceAccount) |
| Logs | `kubectl logs <p> -n <ns> --all-containers --timestamps` (and `--previous` for a restarted container) |
| File system changes | On the node: `docker diff`, `crictl inspect` for the PID and paths; changes in the upper layer |
| Processes | On the node via the container's PID, same as `/proc` above |
| Audit | The Kubernetes audit log (`exec`, `secrets` get) and Falco alerts for that `container.id` |

Do not delete the pod until you have collected evidence. In module 10 you will see how to isolate it and keep it alive for forensics.

## Summary

- NIST SP 800-61r3 (April 2025) supersedes r2 and organizes response as a **CSF 2.0 Community Profile**: Govern, Identify and Protect are preparation, Detect, Respond and Recover are the response, and **ID.IM** is continuous improvement.
- Key categories: DE.AE (analysis and incident declaration), RS.MA (triage, priority, escalation), RS.AN (investigation, evidence integrity), RS.CO (communication), RS.MI (containment, eradication), RC.RP and RC.CO (recovery).
- Response is a team effort: leadership, handlers, the incident lead, technical teams, legal, PR, HR, asset owners and third parties under the shared responsibility model.
- A playbook describes what is done for a type of incident (decisions, roles, communication); a runbook describes how a technical step is performed.
- Triage: real or not, what is affected, is it ongoing, priority by risk; a timeline in UTC with the source of every entry.
- **RFC 3227**: from the most volatile (processes, network, memory) to the least volatile (disk, remote logs, archives); do not shut the system down too early and do not trust tools on the compromised host.
- Chain of custody: who, when, where and how the evidence was collected, stored and handed over, with a SHA-256 hash.
- Linux live response: `ss`, `ps`, `/proc/<pid>/` (including `exe` of a deleted binary), `lsof`, tmp directories, cron, systemd, `authorized_keys`, logs; output off the host, everything hashed.
