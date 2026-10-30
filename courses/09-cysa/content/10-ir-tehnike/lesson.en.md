## Exam objective: 3.3

**3.3 Given a scenario, implement incident response techniques.** This is the objective with the most subtopics in domain 3 and a frequent source of PBQs (order of steps, chain of custody, timeline). CS0-004 lists:

- **preparation**: incident response plan, communication plan, playbooks, roles, training (tabletop, simulation),
- **working with data**: log collection, log correlation, log augmentation and enrichment, alerts and notifications,
- **analysis**: triage, timeline, severity and impact, prioritization,
- **evidence**: chain of custody, data integrity validation, preservation, legal hold,
- **action**: isolating affected targets, escalation, remediation and verification, release from isolation, restoration,
- **closure**: root cause analysis (RCA), corrective action development.

After this module you should be able to choose the **correct next step** for a given scenario, handle evidence properly, and justify when a host may be returned to the network.

## Plans, playbooks, and roles

### Incident response plan and communication plan

| Document | Content | Who approves it |
|---|---|---|
| **IR policy** | Why and who: CSIRT authority, definition of an incident, obligations | Management |
| **Incident response plan** | How the organization responds: phases, roles, severity criteria, escalation, contacts, metrics | CISO/management |
| **Communication plan** | Who communicates with whom, when, and through which channel: internal, legal team, PR, regulator, police, customers; **out-of-band** channels | IR lead, legal team, PR |
| **Playbook** | Specific steps for a **type** of incident (phishing, ransomware, compromised account, DDoS) | SOC/IR team |
| **Runbook** | Technical instructions for a single operation (how to isolate a host in EDR, how to reset krbtgt) | The team that maintains the system |

The communication plan must anticipate that the primary channel may be compromised: if the attacker is reading the domain's email, the team uses **out-of-band** communication (a separate chat tenant, phone, a Signal group). Module 11 (4.2) covers stakeholder details.

### Playbook

A playbook provides consistency and speed, especially when it is part of **SOAR** automation (as in the SC-200 course with Sentinel playbooks). Typical structure:

```
Playbook: Phishing with a malicious attachment
Trigger:  User report (Report phishing) or email gateway alert
1. Triage:   extract headers, URLs, attachment hash; enrich (VT, TI platform)
2. Scope:    search mail logs - who else received the same Message-ID/hash
3. Decision: clicked/opened?  NO  -> purge messages, close as "contained"
                              YES -> escalate to Tier 2, go to step 4
4. Containment: isolate host (EDR), revoke sessions, reset password, block domain
5. Evidence: memory dump and triage package before reimage
6. Eradication/Recovery: reimage, restore user files
7. Closure:  ticket, IoCs to blocklist, metric (MTTD/MTTR)
```

### Roles

| Role | Responsibility |
|---|---|
| **Incident commander / IR lead** | Leads the incident, makes decisions, coordinates, single source of status |
| **SOC Tier 1** | Alert triage, initial validation, escalation according to the rules |
| **SOC Tier 2/3, IR analyst** | In-depth analysis, containment, hunting |
| **Forensic investigator** | Evidence collection and analysis, chain of custody |
| **System/network owners, IT** | Carrying out changes (isolation, patch, restore) |
| **Legal team** | Notification obligations, legal hold, contact with law enforcement |
| **PR / communications** | External statements, media, customers |
| **HR** | Incidents involving employees (insider) |
| **Management / executive sponsor** | Business decisions: shutting down a service, payment, public disclosure |

> **On the exam:** distinguish the **plan** (organizational: who, when, escalation) from the **playbook** (steps for an incident type) and the **runbook** (technical procedure). If email is compromised, the answer is **out-of-band** communication. Statements to the media are made by **PR**, not by the analyst.

### Training: tabletop and simulation

| Type | Description | Advantage | Disadvantage |
|---|---|---|---|
| **Tabletop** | Discussion of a scenario around a table, a moderator introduces "injects" | Cheap, involves management and the legal team, reveals gaps in the plan and communication | Doesn't test technical controls |
| **Simulation** (functional exercise, purple team, cyber range) | Real or emulated activity in an environment, the team actually responds | Tests tools, detections, response time | More expensive, risk to production |
| **Full-scale** | The entire organization, multiple teams, often external partners too | Most realistic | Most expensive and hardest to organize |

> **On the exam:** "Least expensive, involve executives, verify the communication plan" → **tabletop**. "Verify that the SOC actually detects and contains an attack" → **simulation**.

## Log collection, correlation, and enrichment

This is familiar from the detection lab (Wazuh agent → manager, Sigma → SIEM queries), so here is just the exam angle.

| Term | Meaning | Example |
|---|---|---|
| **Log collection** | Central collection (agent, syslog, API, WEF) with **time synchronization** (NTP) and retention | Windows Security, Sysmon, auth.log, firewall, proxy, cloud audit (CloudTrail) |
| **Log correlation** | Linking events from multiple sources into one pattern | 20 failed logins + 1 successful from the same IP + a new MFA device |
| **Log augmentation / enrichment** | Adding context to an event | GeoIP, IP reputation (TI), asset owner and criticality from the CMDB, user's department from the IdP |
| **Alerts and notifications** | Rules generate an alert; the notification goes to the right person through the right channel based on severity | Critical alert → page to on-call; low → queue in the SIEM |

Without NTP, correlation and the timeline are unreliable. An example of enriching a single event with `jq`:

```
$ jq -s '.[0] as $a | .[1] as $cmdb | $a + {asset: $cmdb[$a.host]}' alert.json cmdb.json
{
  "time": "2026-10-02T08:14:11Z",
  "host": "FIN-LT-07",
  "dst_ip": "203.0.113.45",
  "rule": "Beaconing to rare domain",
  "asset": { "owner": "Accounting", "criticality": "high", "pii": true }
}
```

The same alert on a laptop with PII has a higher priority than on a test VM: that is the point of enrichment.

> **On the exam:** "Analysts spend time looking up the owner and criticality of the host for every alert" → **enrichment** (CMDB/asset inventory in the SIEM). "Events from the firewall and AD have different times" → **NTP synchronization** before correlation.

## Triage, timeline, severity, and priority

### Triage

**Triage** is a quick assessment of an alert: is it real, how serious is it, and who takes it. Triage questions:

1. Is it a **true positive** or a false positive (context check, known benign cause)?
2. Which **asset** and which **user**? How critical are they?
3. Is it active (the attacker is still inside) or historical?
4. What is the **scope**: one host or several?
5. Is immediate **escalation** needed?

### Establishment of a timeline

The timeline is a chronological sequence of events from all sources, in **UTC**. It is used to determine **patient zero**, the entry vector, **dwell time**, and scope. An example of combining sources:

```
2026-10-02T08:09:55Z  mail-gw   Delivered  from=billing@supp1ier.example  to=ana@firma.ba  att=Faktura_10.docm
2026-10-02T08:14:02Z  FIN-LT-07 Sysmon 1   WINWORD.EXE -> powershell.exe -nop -w hidden -enc ...
2026-10-02T08:14:11Z  proxy     CONNECT    FIN-LT-07 -> cdn-upd4te.example:443
2026-10-02T08:16:40Z  FIN-LT-07 4698       Scheduled task created: \Microsoft\UpdateCheck
2026-10-02T09:02:47Z  FIN-LT-11 4624 (3)   Logon type 3 from FIN-LT-07 user=svc_backup
2026-10-02T09:03:15Z  FIN-LT-11 7045       Service installed: PSEXESVC
```

From this you read: the vector is a phishing attachment, patient zero is `FIN-LT-07`, the attacker moves laterally with the service account `svc_backup` (so that account must be reset too), and the dwell time until detection is the difference between 08:14 and the moment of the first alert.

On Linux, similar material comes from `journalctl --since` and `auth.log`, and for the network from `tshark`:

```
$ tshark -r incident.pcap -q -z conv,ip | head -6
IPv4 Conversations
                                   <-     ->     Total    Relative   Duration
10.10.20.17  <-> 203.0.113.45      412 KB  9 MB   9.4 MB   0.03      5400.12
10.10.20.17  <-> 10.10.1.5          31 KB  44 KB  75 KB    12.10     3.20
```

The asymmetry (9 MB outbound to an external address) indicates possible exfiltration and goes into the timeline.

### Determining severity and impact; prioritization

| Dimension | Question | Examples |
|---|---|---|
| **Functional impact** | How much is the business affected? | None, low, medium, high (service unavailable) |
| **Information impact** | What about the data? | None, privacy breach (PII), proprietary breach, integrity loss |
| **Recoverability** | How hard is it to recover? | Regular, supplemented (additional resources), extended (unpredictable), not recoverable |
| **Scope** | How many systems, users, locations? | 1 host vs the entire domain |
| **Asset criticality** | How important is the system? | Domain controller, payment system, PHI |

Priority is a combination of severity, asset criticality, and urgency (whether the attack is ongoing). A typical matrix:

| Severity \ Criticality | Low | Medium | High |
|---|---|---|---|
| **High** (active, data, spreading) | P2 | P1 | P1 |
| **Medium** | P3 | P2 | P1 |
| **Low** | P4 | P3 | P2 |

> **On the exam:** when two incidents occur at the same time, priority goes to the one with greater **business impact** and an **active** attack (e.g., a compromised DC or PII exfiltration), not the one with the "scarier" malware name. If recovery is "not recoverable" (e.g., data published), the focus shifts to notification.

## Evidence collection

If there's a chance of legal proceedings, disciplinary proceedings, or a regulatory investigation, evidence must be **admissible**. Four key terms from the objectives:

### Chain of custody

A documented trail of **who had the evidence, when, where, and why**, from collection to court. Every handover is recorded and signed. If the chain has a gap, the defense can challenge the evidence.

```
Evidence #: IR-2026-041-E03     Description: SSD 512 GB, serial S4EVNX0R..., from FIN-LT-07
SHA-256 (image): 9f2c...e41a
Date/time (UTC)       Released by        Received by        Purpose                Location
2026-10-02 10:05      M. Kovač (IT)      A. Vojić (IR)      Collection             Office 3.12
2026-10-02 11:30      A. Vojić (IR)      Evidence (safe)    Storage                Forensics safe #2
2026-10-04 09:00      Evidence (safe)    L. Petrić (DFIR)   Analysis (copy)        Forensics lab
```

### Data integrity validation

The hash of the original and the copy must match. Analysis is done **on the copy**, using a **write blocker** when creating the image.

```
$ sha256sum /evidence/FIN-LT-07.E01 /evidence/work/FIN-LT-07-copy.E01
9f2c0b...e41a  /evidence/FIN-LT-07.E01
9f2c0b...e41a  /evidence/work/FIN-LT-07-copy.E01
$ sha256sum -c FIN-LT-07.sha256
/evidence/FIN-LT-07.E01: OK
```

The same applies to logs and pcaps exported from the SIEM: record the hash at export.

### Preservation

Keeping evidence in its original state: following the **order of volatility** (CPU/cache → RAM → network connections and processes → swap/temp → disk → remote logs → archives), capturing memory **before** shutdown, snapshotting the cloud disk, exporting logs before rotation deletes them, secure storage (safe, access control). No reimage before collection.

### Legal hold

An order from the legal team (or a court) that specific data must **not be deleted or modified**, even under the regular retention policy, because of anticipated or ongoing litigation. Example: rotation of SIEM logs after 90 days is suspended for the affected systems and users; the mailbox is placed on hold in M365.

| Term | Keyword |
|---|---|
| Chain of custody | **Who** had the evidence and when (documented handovers) |
| Data integrity validation | The **hash** matches, the evidence was not altered |
| Preservation | Evidence kept in its **original state**, volatility |
| Legal hold | **Prohibition on deletion** because of legal proceedings, overriding retention |

> **On the exam:** "How do you prove that the disk image wasn't altered?" → **hash** (data integrity). "The evidence was rejected because no one knows where the disk was for two days" → broken **chain of custody**. "The legal team asks that emails not be deleted despite the 30-day retention" → **legal hold**.

## Isolation, escalation, and remediation

### Isolating affected targets

| Method | How | Note |
|---|---|---|
| EDR network isolation | The host communicates only with the EDR console | Fastest; allows further remote evidence collection |
| Quarantine VLAN / NAC | Switch port moved into an isolated VLAN | Works even without an agent |
| Firewall/SG rules | Block traffic of the host or cloud instance (security group with no rules) | In the cloud: snapshot the disk, isolation SG, don't stop the instance |
| Disabling accounts | Disable the account, **revoke** sessions and tokens, reset the password | A compromised identity is a "target" just like a host |
| Disconnecting from the network | Pull the cable, turn off Wi-Fi | Don't cut power if volatile data is needed |

### Escalation

Escalation means moving an incident to a higher level or a wider circle when it crosses defined thresholds. The criteria are defined **in advance** in the IR plan:

- **functional** escalation: Tier 1 → Tier 2/3, forensics, system owner,
- **hierarchical** escalation: IR lead → CISO → management, legal team (e.g., personal data affected, ransomware, media),
- **external**: vendor (MSSP, IR retainer), regulator, law enforcement, via the legal team.

Typical triggers: critical asset, confirmed access to sensitive data, spread to multiple systems, privileged account, SLA time exceeded, need for a business decision (shutting down a service).

### Remediation and verification

Remediation removes the cause and the consequences: reimage or cleanup, patching the exploited vulnerability, resetting credentials (including service accounts, and in a domain compromise **krbtgt** twice), removing persistence mechanisms, fixing configuration.

**Verification** confirms that remediation succeeded: rescanning, checking that the IoCs no longer exist, monitoring.

```
$ nmap -sV -p 8080 127.0.0.1
PORT     STATE SERVICE VERSION
8080/tcp open  http    Apache Tomcat 10.1.35
$ trivy rootfs --severity CRITICAL / 2>/dev/null | grep -c CVE-2025-24813
0
```

The new version and zero findings for the exploited vulnerability are proof of remediation.

### Release from isolation and restoration

A host is returned from isolation only when the **criteria** are met: eradication completed, vulnerability patched, credentials changed, scan clean, approval from the IR lead and the system owner. After release comes **enhanced monitoring** (the attacker often tries to come back).

**Performing restoration**: restore from a **known clean** backup (from before the compromise began, according to the timeline), verify backup integrity, restore in order of business criticality (first infrastructure such as AD/DNS, then key applications), confirmation from the owner that the service works. With ransomware: verify that the backup is not infected or encrypted (immutable/offline backup).

> **On the exam:** "When should the host be returned to the network?" → only **after verification** of remediation and approval, with enhanced monitoring. "From which backup?" → the last backup **before** the first indicator of compromise from the timeline, not the latest available one.

## Root cause analysis and corrective actions

**RCA** answers the question of **why** the incident happened, not just what happened. The symptom (malware) is not the cause; the cause is the gap that made it possible.

The **5 Whys** technique:

```
Problem: Ransomware encrypted the file server.
1. Why? The attacker ran the encryptor with the admin account svc_backup.
2. Why did they have svc_backup? They stole it from laptop FIN-LT-07 (credentials in memory).
3. Why were they on FIN-LT-07? The user opened a macro document from an email.
4. Why did the macro run? The policy blocking macros from the internet wasn't applied to that OU.
5. Why? The GPO wasn't reviewed after the OU structure was reorganized.
Root cause: lack of change control for GPOs + a service account with excessive privileges.
```

Other techniques: the **Fishbone (Ishikawa)** diagram by category (people, process, technology, environment), **fault tree** analysis.

**Corrective action development**: for each cause, define an action with an **owner, deadline, and verification method**:

| Cause | Corrective action | Owner | Deadline | Verification |
|---|---|---|---|---|
| Internet macros not blocked in the Finance OU | GPO/Intune policy on all OUs, GPO review after changes | IT ops | 7 days | 100% compliance report |
| `svc_backup` is a Domain Admin | Least privilege, gMSA, deny interactive logon | IAM team | 30 days | Group review |
| No detection of lateral movement with PsExec | New Sigma/SIEM detection for 7045 PSEXESVC | SOC | 14 days | Simulation (purple team) |

Corrective actions go into the after action report (module 11) and are tracked until closed.

> **On the exam:** RCA is done in the **post-incident** phase, but relies on the timeline and evidence from analysis. An answer that "only removes the malware" doesn't address the root cause. A good corrective action is **measurable** and has an owner.

## Scenario: compromised cloud identity

The techniques apply even without malware. Alert: "Impossible travel" for `marko@firma.ba` (sign-in from Sarajevo, 20 minutes later from another country), followed by new inbox rules. The order the exam expects:

| Step | Technique from 3.3 | Action |
|---|---|---|
| 1 | Triage | Confirm the user isn't using a VPN from that country; check the MFA method and user agent |
| 2 | Enrichment | IP reputation (hosting/VPS?), account criticality (finance, admin roles) |
| 3 | Timeline | Sign-in logs + audit log (inbox rule, OAuth consent, new MFA device) in UTC |
| 4 | Isolating | Disable the account, **revoke sessions and refresh tokens**, remove the attacker's MFA device |
| 5 | Evidence | Export audit logs with a hash, legal hold on the mailbox if the legal team requests it |
| 6 | Escalation | If an invoice with changed bank details was sent (BEC) → legal team and finance |
| 7 | Remediation & verification | Password reset, removal of inbox rules and OAuth apps, verification that there are no new sign-ins |
| 8 | RCA and corrective action | Cause: SMS MFA and a phishing proxy (AiTM) → phishing-resistant MFA (FIDO2), conditional access |

```
$ jq -r '.[] | [.createdDateTime, .ipAddress, .location.countryOrRegion, .status.errorCode] | @tsv' signins.json
2026-10-07T07:41:12Z  195.222.48.10   BA  0
2026-10-07T08:01:55Z  198.51.100.77   NL  0
2026-10-07T08:02:30Z  198.51.100.77   NL  0
```

A password reset alone is **not enough** here: the stolen session token remains valid until it is revoked.

## Summary

- IR plan (who/when/escalation), communication plan (who talks to whom and through which channel, out-of-band), playbook (steps per incident type), runbook (technical procedure).
- Tabletop = discussion, cheap, management; simulation = real test of tools and the team.
- Log collection with NTP, correlation of multiple sources, enrichment (GeoIP, TI, CMDB criticality), notifications by severity.
- Triage → timeline (UTC, patient zero, vector, dwell time) → severity/impact (functional, information, recoverability, scope) → priority.
- Evidence: **chain of custody** (who and when), **integrity** (hash, work on a copy, write blocker), **preservation** (order of volatility), **legal hold** (don't delete despite retention).
- Isolation of hosts and identities; escalation based on predefined criteria; remediation + **verification**; release from isolation only after criteria are met; restore from a clean backup from before the compromise.
- RCA (5 Whys, fishbone) looks for the cause, and corrective actions have an owner, a deadline, and verification.
