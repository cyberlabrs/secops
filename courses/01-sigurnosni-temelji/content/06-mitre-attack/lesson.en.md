## What ATT&CK is

**MITRE ATT&CK** is a public knowledge base of how attackers actually behave, compiled from reports on real incidents. It gives everyone the same vocabulary: when an analyst says "T1053.003", every SOC in the world knows it means persistence via cron.

There are three matrices: **Enterprise** (Windows, Linux, macOS, cloud, containers, network), **Mobile** and **ICS**.

> Status as of October 2026: the current version is **ATT&CK v19** (April 2026, plus the v19.x update). Enterprise has **15 tactics, 222 techniques and 475 sub-techniques**. Before v19 there were 14 tactics.

## TTPs: tactics, techniques, procedures

| Level | Question | Example |
|---|---|---|
| **Tactic** | **Why?** The attacker's goal at that moment | Persistence (TA0003) |
| **Technique** | **How?** The general way of achieving the goal | Scheduled Task/Job (T1053) |
| **Sub-technique** | A more specific variant | Cron (T1053.003) |
| **Procedure** | Exactly how a specific group or malware did it | group X adds a line to `/etc/cron.d/` that downloads a script every 10 minutes |

ATT&CK also describes **groups** (e.g. APT29), **software** (malware and tools), **campaigns**, **mitigations** (M-IDs) and **detections**. Since v18, detections are organized as *Detection Strategies* and *Analytics*, tied to specific data sources.

## 15 Enterprise tactics (v19)

| ID | Tactic | Attacker's goal |
|---|---|---|
| TA0043 | Reconnaissance | gather information for planning |
| TA0042 | Resource Development | prepare infrastructure, accounts, tools |
| TA0001 | Initial Access | get into the environment |
| TA0002 | Execution | run code |
| TA0003 | Persistence | keep access across reboots and password changes |
| TA0004 | Privilege Escalation | gain higher privileges |
| TA0005 | **Stealth** | hide activity so it looks like normal behavior |
| TA0112 | **Defense Impairment** | disable security mechanisms, tools and logs so defenders can't see or can't trust what they see |
| TA0006 | Credential Access | steal credentials |
| TA0007 | Discovery | learn the environment |
| TA0008 | Lateral Movement | move to other systems |
| TA0009 | Collection | gather targeted data |
| TA0011 | Command and Control | communicate with compromised systems |
| TA0010 | Exfiltration | steal data |
| TA0040 | Impact | manipulate, disrupt or destroy systems and data |

**Change in v19:** the old *Defense Evasion* tactic was split into **Stealth** (which kept ID TA0005) and the new **Defense Impairment** (TA0112). The distinction matters for detection: hiding (e.g. masquerading a process name) is detected differently from actively disabling defenses (e.g. stopping an EDR agent or deleting logs). Older materials, tools and courses still mention 14 tactics and Defense Evasion.

Tactics are not a strict sequence. An attacker returns to Discovery after every lateral move, and the same technique can serve several tactics (e.g. valid accounts are both Initial Access and Persistence).

## The most common Linux and cloud techniques you defend against

| Technique | Tactic | What to look for |
|---|---|---|
| T1078 Valid Accounts | Initial Access, Persistence… | logins from unusual locations, stale accounts |
| T1190 Exploit Public-Facing Application | Initial Access | vulnerable web applications, VPNs |
| T1059.004 Unix Shell | Execution | unusual shell processes under a web server |
| T1053.003 Cron | Persistence | new lines in `/etc/cron*`, `/var/spool/cron` |
| T1098.004 SSH Authorized Keys | Persistence | changes to `authorized_keys` |
| T1136.001 Local Account | Persistence | new users, especially with UID 0 |
| T1543.002 Systemd Service | Persistence | new unit files in `/etc/systemd/system` |
| T1546.004 Unix Shell Configuration Modification | Persistence | changes to `.bashrc`, `/etc/profile.d/` |
| T1552.005 Cloud Instance Metadata API | Credential Access | calls to `169.254.169.254` from applications |
| T1496 Resource Hijacking | Impact | crypto miners: 100% CPU, connections to mining pools |

## How SOC and DevSecOps teams use ATT&CK

1. **Detection mapping**: every SIEM rule gets a technique tag (`attack.t1053.003` in Sigma rules).
2. **Coverage analysis**: in the **ATT&CK Navigator** you color the techniques you detect and see the gaps.
3. **Threat-informed defense**: start from the groups that target your industry, take their techniques and check coverage specifically for them.
4. **Purple teaming / emulation**: Atomic Red Team has small tests per technique (e.g. `T1053.003`), so you can check whether the alert really fires.
5. **Incident reports**: an attack timeline described in techniques is clear and comparable.

> Coverage is not binary. One rule for T1053.003 doesn't mean cron persistence is covered in all its variants. The Navigator uses a scale (e.g. 0 to 3), not yes/no.

## Pyramid of Pain

David Bianco ranked indicators by how much it **hurts** the attacker when you block them:

| Level | Indicator | Pain for the attacker |
|---|---|---|
| top | **TTPs** (behavior) | tough: they must change how they operate |
| | Tools | challenging |
| | Network and host artifacts | annoying |
| | Domain names | simple |
| | IP addresses | easy |
| bottom | Hash values | trivial: change one byte |

That's why mature detections are written for **behavior**, e.g. "a web server process spawns a shell", rather than for the hash of a specific piece of malware.

## Cyber Kill Chain and ATT&CK

The Lockheed Martin Kill Chain has 7 phases (Reconnaissance, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives). It's good for explaining things to management, but too coarse for detection. ATT&CK is more detailed and also covers what happens **after** the initial intrusion, where defenders need the most help.

## Summary

- The tactic is the why, the technique the how, the procedure the exact method.
- v19: 15 Enterprise tactics; Defense Evasion was split into Stealth (TA0005) and Defense Impairment (TA0112).
- Map detections to techniques, measure coverage and test it with emulation.
- Detect behavior (TTPs), not just hashes and IPs.
