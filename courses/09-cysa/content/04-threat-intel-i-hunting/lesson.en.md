## Exam objective: 1.4

- **1.4** Explain threat intelligence and threat-hunting concepts: threat actors (APT, insider), TTPs (heat maps, Pyramid of Pain, MITRE ATT&CK, attribution), confidence levels (timeliness, relevance, accuracy), collection methods and sources (OSINT, closed-source, sharing), the IoC lifecycle (collection, analysis, application; atomic and behavioral), threat modeling (STRIDE), threat mapping and cyber deception.

After this module you should be able to:

- distinguish types of actors and what each means for defense;
- explain why TTPs are more valuable than hashes (Pyramid of Pain);
- assess the quality of an intelligence item (timeliness, relevance, accuracy);
- take an IoC from collection to application in the SIEM and EDR;
- plan a hypothesis-driven threat hunt and an ATT&CK heat map;
- apply STRIDE and cyber deception (honeypot, honeytoken, canary).

In the Security+ course you got to know threat actors, and in the detection lab and the SC-200 course you mapped detections to ATT&CK and wrote hunting queries. CySA+ ties this together into a program: **how to turn intel into detections and hunts**.

## Threat intelligence: basic concepts

**Threat intelligence** is threat information that has been collected, processed and analyzed so that it supports a decision. A raw feed of IP addresses is not intel until someone puts it in context.

| Level | Audience | Content | Example |
|---|---|---|---|
| **Strategic** | Board, CISO | Trends, risk, motives | "Ransomware groups are targeting healthcare in the region" |
| **Operational** | SOC management, IR | Campaigns, intent, timing | "Campaign X is using fake invoices this month" |
| **Tactical** | Analysts, detection engineers | TTPs, IoCs | "T1059.001 with `-enc`, C2 at 198.51.100.23" |

The intelligence lifecycle: **planning/direction** (what we need, intelligence requirements) → **collection** → **processing** (normalization, deduplication) → **analysis** → **dissemination** (to the right people in the right format) → **feedback**.

## Threat actors

| Actor | Motive | Resources | What it means for defense |
|---|---|---|---|
| **APT** (advanced persistent threat) | Espionage, sabotage, sometimes financial | Large, often state-sponsored | Long dwell time, custom tools, LOTL; hunting is needed, not just signatures |
| **Insider threat** | Revenge, money, negligence | Legitimate access | Hard to see with rules; UEBA, DLP, least privilege, offboarding |
| Organized crime | Money | Large | Ransomware, BEC, RaaS ecosystem |
| Hacktivists | Ideology | Small to medium | DDoS, defacement, data leaks |
| Nation-state | Geopolitics | The largest | Supply chain, zero-day |
| Unskilled attacker | Fun, reputation | Small | Public tools, noise |

An **insider** can be **malicious** (deliberately steals or sabotages) or **unintentional** (sends data by mistake, falls for phishing). Indicators of a malicious insider: access to data outside their role, mass downloading before leaving the company, working at unusual hours, attempts to bypass DLP.

> **On the exam:** **APT** = long-term, stealthy presence, custom tools and targeting of a specific organization. The keywords are "persistent", "months", "stealthy". For an **insider** with legitimate access, the best detection is **UEBA** and DLP, not IDS signatures.

## TTPs

**TTP** (tactics, techniques, and procedures): a **tactic** is the goal (e.g., Credential Access), a **technique** is the method (OS Credential Dumping, T1003), a **procedure** is a specific actor's concrete implementation (e.g., dumping LSASS memory with a particular tool and parameters).

### MITRE ATT&CK

Already familiar from the detection lab: a matrix of tactics (Reconnaissance → Impact) and techniques with IDs, for Enterprise (Windows, Linux, macOS, cloud, containers), Mobile and ICS. In threat intelligence, ATT&CK serves as a **common language**: a report on a group lists techniques, and you check whether you have a detection for each.

### Heat maps

A **heat map** is an ATT&CK matrix colored by some measure, most often in the **ATT&CK Navigator**:

- how often groups relevant to your sector use a technique (**threat**);
- how well your detections cover a technique (**coverage**);
- the difference (gap) between those two layers = the priority for new detections and hunts.

```text
Technique                        Use (sector actors)         Our coverage       Gap
T1566.001 Spearphishing Attach.  ██████████ 9/10             ████████ high       low
T1059.001 PowerShell             █████████  8/10             ██████   medium     medium
T1003.001 LSASS Memory           ███████    7/10             ██       low        HIGH   ← hunt
T1021.002 SMB/Admin Shares       ██████     6/10             ████     medium     medium
```

### Pyramid of Pain

David Bianco ranked IoCs by how much "pain" they cause the attacker when you detect and block them:

```text
                 /\
                /  \        TTPs                  ← hardest to change (Tough!)
               /----\
              / Tools\      Tools                 ← Challenging
             /--------\
            / Network/ \    Network and host
           / Host Artif.\   artifacts             ← Annoying
          /--------------\
         /  Domain Names  \                       ← Simple
        /------------------\
       /    IP Addresses    \                     ← Easy
      /----------------------\
     /     Hash Values        \                   ← Trivial
    /--------------------------\
```

A hash changes with one byte, an IP address in a minute, a domain for a dollar. Behavioral detection (e.g., "an Office process launches PowerShell that downloads content") hits the **TTP** and forces the attacker to change how they operate, which is expensive.

> **On the exam:** The question "which detection would cause the attacker the MOST pain / be the hardest to evade" → the top of the pyramid: **TTPs** (behavior). The easiest to evade: **hash values**.

### Attribution

**Attribution** is assigning activity to a specific actor. It is based on overlap in TTPs, infrastructure, tools, activity timing, language in code and targets. Problems: shared and public tools, **false flag** operations (deliberately planted clues), the limited view of a single organization. For most SOCs, attribution is less important than detection and containment; it is useful when it reveals **what the actor usually does next**, so you can proactively look for the next step.

## Confidence levels in intel

Every intelligence item is assessed before you turn it into a block:

| Factor | Question | Bad example |
|---|---|---|
| **Timeliness** | Is it still current? | A C2 server IP address from a 14-month-old report, which today belongs to a cloud provider |
| **Relevance** | Does it apply to us (sector, technology, region)? | IoCs for SCADA attacks at a company with no OT |
| **Accuracy** | Is it correct and verified? | A feed that flags 8.8.8.8 as malicious |

Many sources also use the **Admiralty (NATO) system**: source reliability A–F and information credibility 1–6 (A1 = completely reliable source, confirmed information). Bad intel has a cost: **false positives** and blocking of legitimate services.

> **On the exam:** If a block from a feed breaks a legitimate service (e.g., a CDN address that was previously malicious), the problem is the feed's **timeliness/accuracy**. The solution is **IoC aging (expiration)** and source rating, not abandoning intel.

## Collection methods and sources

| Type | Examples | Advantages | Disadvantages |
|---|---|---|---|
| **OSINT** | Public vendor reports, CISA advisories and KEV, abuse.ch (URLhaus, MalwareBazaar, ThreatFox), OTX, blogs, social media, certificate transparency logs, paste sites | Free, plentiful | Noise, varying quality, also available to the attacker |
| **Closed-source** | Commercial feeds (Recorded Future, Mandiant), ISAC exchange, internal telemetry, provider dark web monitoring | Curated, context, exclusive | Cost, NDA, limited sharing |
| **Internal sources** | Your own incidents, SIEM, EDR, honeypot | The most relevant | Limited view |

### Threat intelligence sharing

- **ISAC/ISAO** (Information Sharing and Analysis Center): sector communities (FS-ISAC for finance, H-ISAC for healthcare), national **CERT/CSIRT** teams.
- **STIX 2.1** (Structured Threat Information Expression): a JSON format for objects (indicator, malware, threat-actor, attack-pattern, relationship).
- **TAXII 2.1**: a protocol (HTTPS API) for exchanging STIX content; collections and channels.
- **TLP 2.0** (Traffic Light Protocol, FIRST): **TLP:RED** (those present only), **TLP:AMBER** (the organization and its clients on a need-to-know basis), **TLP:AMBER+STRICT** (the organization only), **TLP:GREEN** (the community), **TLP:CLEAR** (public).

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--7b1e...",
  "name": "C2 server of the FakturaX campaign",
  "pattern": "[ipv4-addr:value = '198.51.100.23']",
  "pattern_type": "stix",
  "valid_from": "2026-10-14T00:00:00Z",
  "valid_until": "2026-11-14T00:00:00Z",
  "confidence": 80,
  "object_marking_refs": ["marking-definition--...tlp-amber"]
}
```

Note `valid_until` (timeliness built into the IoC) and `confidence`.

## Indicator of compromise: the lifecycle

1. **Collection**: from feeds, reports, your own incidents (a hash from the EDR, a domain from the proxy log), sandboxes.
2. **Analysis**: validation (is it a legitimate service?), deduplication, enrichment (WHOIS, passive DNS, VirusTotal), confidence rating, mapping to ATT&CK and an actor.
3. **Application/usage**: blocking (firewall, DNS sinkhole, EDR), a detection rule in the SIEM, **retro-hunt** (searching historical logs: have we already been hit?), sharing with the community, and finally **retirement** once it expires.

### IoC types

| Type | Description | Examples | Longevity |
|---|---|---|---|
| **Atomic** | Cannot be broken down further, meaningful on its own | IP address, domain, email address, URL | Short |
| **Computed** | Derived from data | File hash, JA3/JA4 fingerprint, regex | Short to medium |
| **Behavioral** | A combination of behaviors, often mapped to a TTP | "Word → PowerShell `-enc` → connection to a newly registered domain" | Long |

The exam objectives explicitly ask for **atomic** and **behavioral**; computed is the third type from the same original model (Lockheed Martin), and it is good to know.

```bash
# Retro-hunt: did anyone talk to the IoC address in the last 90 days (Zeek conn.log)
$ zcat /logs/zeek/2026-0[7-9]-*/conn.*.log.gz /logs/zeek/2026-10-*/conn.*.log.gz \
    | zeek-cut ts id.orig_h id.resp_h id.resp_p | awk '$3=="198.51.100.23"' | head -3
1758012311.20  10.0.4.15  198.51.100.23  443
```

### From report to action

When an advisory arrives (e.g., a CISA advisory about a campaign exploiting VPN appliances), the analyst breaks it down like this:

| Part of the report | Question | Action |
|---|---|---|
| Affected technology and CVE | Do we have that product and version? | Inventory query, KEV status check, emergency patching (domain 2) |
| Atomic IoCs (IPs, domains) | Have we seen them? | Retro-hunt in proxy, DNS and firewall logs, temporary block with expiration |
| Computed IoCs (hashes) | Are the files on our disks? | EDR search, YARA across disks |
| TTPs (ATT&CK IDs) | Do we have a detection for each technique? | Update the heat map, hunt for techniques without coverage |
| Recommended mitigations | What applies to us? | Change request, compensating controls |

## Threat hunting

**Threat hunting** is the proactive search for threats that have bypassed existing detections, on the assumption that compromise is possible (**assume breach**). The difference from monitoring: monitoring reacts to an alert, hunting starts without an alert.

| Approach | Starts from | Example |
|---|---|---|
| **Hypothesis-driven** | A hypothesis based on intel or an ATT&CK gap | "The group in the report uses scheduled tasks for persistence; we look for new tasks outside GPO" |
| **Intel-driven (IoC)** | Specific IoCs | A retro-hunt for hashes and domains from a CISA advisory |
| **Data/analytics-driven** | An anomaly in the data | Stack counting: rare parent processes, rare User-Agents |

Process: **hypothesis → data collection → investigation (queries, stacking, visualization) → finding → response or a new detection → documentation**. The most valuable output of a hunt is often a **new automated detection** and a closed visibility gap.

```text
// KQL: rare parent-child pairs across all endpoints (stacking)
DeviceProcessEvents
| where Timestamp > ago(30d)
| summarize hosts=dcount(DeviceName), cnt=count() by InitiatingProcessFileName, FileName
| where hosts <= 2
| order by cnt asc
```

> **On the exam:** Hunting is **proactive** and starts with a **hypothesis**; if the scenario says "there were no alerts, but the team wants to check whether an attacker is present", the answer is threat hunting. The result of a successful hunt should be turned into an **automated detection**.

### An end-to-end hunt example

**1. Trigger (intel):** an ISAC shares a TLP:AMBER report that a group targeting the financial sector copies the memory of the LSASS process after gaining access (T1003.001), using `rundll32.exe` with `comsvcs.dll` and the `MiniDump` parameter. The heat map shows that we have low coverage for that technique.

**2. Hypothesis:** "If the group is present in our environment, then in the last 30 days there has been access to `lsass.exe` memory from a process that is not a security tool, or `rundll32` with `comsvcs.dll`."

**3. Data:** EDR (DeviceProcessEvents), Sysmon Event ID 10 (ProcessAccess) and 1 (ProcessCreate), Security 4688. Verify that the data is actually available on all hosts: a hunt without telemetry gives a false sense of security.

**4. Investigation:**

```text
// KQL: rundll32 with comsvcs and MiniDump
DeviceProcessEvents
| where Timestamp > ago(30d)
| where FileName =~ "rundll32.exe" and ProcessCommandLine has_all ("comsvcs", "MiniDump")
| project Timestamp, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName
```

```text
Timestamp            DeviceName  AccountName  ProcessCommandLine                                         InitiatingProcessFileName
2026-10-02 02:14:51  FIN-WS-031  svc_backup   rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump 712 C:\ProgramData\d.bin full   cmd.exe
```

**5. Finding and response:** one hit on a workstation, a service account, 02:14 at night. An incident is opened (escalation into the IR process, module 10), and the credentials of accounts that were logged on to the host are reset.

**6. Detection:** the hunt is turned into a permanent rule (Sigma in YAML, as in the detection lab) so that next time it doesn't have to be searched for manually:

```yaml
title: LSASS dump via comsvcs.dll
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: '\rundll32.exe'
    CommandLine|contains|all: ['comsvcs', 'MiniDump']
  condition: selection
level: high
tags: [attack.credential_access, attack.t1003.001]
```

**7. Documentation and sharing:** the findings and new IoCs go back into MISP, and the heat map is updated (T1003.001 coverage is now medium).

### Insider threat: specific indicators

An insider hunt does not rely on malware but on **deviation from role and history**:

- access to repositories or folders the user has never opened before;
- a sudden increase in downloads or printing after the employee has resigned (an HR signal);
- use of personal cloud storage or USB from a business computer;
- attempts to access resources that return "access denied" (testing boundaries);
- working outside normal hours without a business reason.

The combination of **HR data, UEBA and DLP** is key, together with a careful legal and privacy procedure (insider investigations are conducted together with HR and the legal department).

## Threat modeling: STRIDE

**Threat modeling** systematically looks for threats in a system's design, ideally before implementation. **STRIDE** (Microsoft) classifies threats by the property they violate:

| Threat | Violates | Example | Control |
|---|---|---|---|
| **S**poofing | Authentication | Impersonating another user or service | MFA, mTLS, signed tokens |
| **T**ampering | Integrity | Modifying data in transit or in a database | Hash, signature, TLS, access control |
| **R**epudiation | Non-repudiation | A user denies having performed a transaction | Tamper-protected audit logs, signatures |
| **I**nformation disclosure | Confidentiality | Data leak through an error or poor access control | Encryption, least privilege |
| **D**enial of service | Availability | Overloading a service | Rate limiting, autoscaling, CDN |
| **E**levation of privilege | Authorization | An ordinary user becomes admin | Authorization checks, sandboxing |

The model is built over a **data flow diagram** (processes, data stores, flows, trust boundaries), as in the threat modeling module of the security fundamentals. For the SOC, the output of a threat model is a list of places that need logging and detection.

## Threat mapping

**Threat mapping** links threats to assets and controls: which techniques of relevant actors hit which systems, and which detections and controls cover them. In practice it is done as ATT&CK mapping (a coverage heat map), linked to the asset inventory and threat model results. The output is priorities: where you have no visibility and the threat is likely.

## Cyber deception

**Cyber deception** places decoys that legitimate users never touch, so any touch produces alerts with very few false positives.

| Technique | Description | What it detects |
|---|---|---|
| **Honeypot** | A fake system or service (SSH, SMB, RDP) | Scanning and lateral movement |
| **Honeynet** | A network of honeypots | Attacker behavior across multiple steps |
| **Honeytoken / canary token** | A fake credential, API key, document or DNS record that reports when used | Theft of data and credentials |
| **Honey account** | A fake AD account (e.g., with an SPN) | Kerberoasting, account enumeration |
| **Honeyfile** | A "passwords.xlsx" file on a share | Unauthorized share access |
| **DNS sinkhole** | Redirects malicious domains to a controlled address | Infected hosts attempting C2 |

```text
EventID 4769  Account Name: j.kovac  Service Name: svc_sql_backup  Ticket Encryption Type: 0x17
# svc_sql_backup is a honey account: no legitimate service uses it
```

> **On the exam:** When the requirement is detection with **very few false positives** for lateral movement or credential theft, the answer is often a **honeytoken/honeypot**. Deception does not prevent an attack but detects it early; decoys must be isolated so they don't become a springboard.

## Summary

- Intel has strategic, operational and tactical levels and a lifecycle from requirements to feedback.
- **APT**: long-term, stealthy, targeted; **insider**: legitimate access, detected by UEBA and DLP.
- **TTP** > tools > artifacts > domains > IP > hash (**Pyramid of Pain**); behavioral detection is the hardest to evade.
- An **ATT&CK heat map** shows the difference between threat and coverage; those are the priorities for hunts and new detections.
- **Attribution** is uncertain (false flags, shared tools) and secondary for the SOC.
- Intel quality: **timeliness, relevance, accuracy**; IoCs must expire.
- Sources: **OSINT**, **closed-source**, internal; sharing through ISACs, **STIX/TAXII**, with **TLP 2.0**.
- IoC: **collection → analysis → application** (blocking, detection, retro-hunt); types **atomic** and **behavioral** (plus computed).
- **Threat hunting** is proactive, starts from a hypothesis and ends with a new detection.
- **STRIDE**: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege.
- **Cyber deception** (honeypot, honeytoken, honey account) provides early warnings with few false alerts.
