## Exam objectives: 3.1 and 3.2

This module opens domain 3 (**Incident Response and Management**, 24% of the exam):

- **3.1** summarize the concepts of attack methodology frameworks: **Cyber Kill Chain**, **Diamond Model of Intrusion Analysis**, and **MITRE ATT&CK**,
- **3.2** summarize the incident response process: **Preparation**, **Detection**, **Analysis**, **Containment**, **Eradication**, **Recovery**, **Post-incident**.

After this module you should be able to:

- say, for a given scenario, which Kill Chain phase the attacker is in and where it is cheapest to stop them,
- fill in the four vertices of the Diamond Model from an incident description and explain **pivoting**,
- distinguish **tactic**, **technique**, **sub-technique**, and **procedure** in ATT&CK and read an ID such as `T1059.001`,
- order the phases of the IR process and recognize the activity that belongs to each phase,
- explain how **NIST SP 800-61r3** (April 2025) maps the old loop to the **CSF 2.0** functions.

You already know this from Security+ (IR phases) and SC-200 (ATT&CK mapping in Defender XDR/Sentinel). Here the focus is on the analyst's angle: how you use a framework to describe, predict, and disrupt an attack.

## Why attack frameworks

An attack methodology framework provides a **common vocabulary**. When the SOC says "the attacker is in the lateral movement phase", everyone knows what that means, which logs to look at, and what the likely next step is. Frameworks are used for:

- **describing** an incident (report, threat intel sharing),
- **predicting** the attacker's next step,
- **assessing detection coverage** (where we lack visibility),
- **planning controls** (where we break the chain).

| Framework | Author | Structure | Best for |
|---|---|---|---|
| **Cyber Kill Chain** | Lockheed Martin (2011) | 7 linear phases | High level: where to disrupt the attack, communication with management |
| **Diamond Model** | Caltagirone, Pendergast, Betz (2013) | 4 vertices + meta-features | Analysis of an individual event, attribution, pivoting through threat intel |
| **MITRE ATT&CK** | MITRE (public knowledge base, since 2013/2015) | Matrix of tactics × techniques, with procedures from real attacks | Detailed behavior mapping, detection coverage, threat hunting, emulation |

> **On the exam:** ask yourself how detailed the description is. "Seven phases, breaking the chain" → **Kill Chain**. "Adversary, capability, infrastructure, victim" → **Diamond**. "Tactic/technique with an ID, detection mapping, gap analysis" → **ATT&CK**.

## Cyber Kill Chain

Lockheed Martin borrowed the military concept of the "kill chain": an attack is a sequence of steps, and **breaking any link** stops the attack. The earlier you break it, the cheaper it is.

| # | Phase | What the attacker does | What the defender sees / does |
|---|---|---|---|
| 1 | **Reconnaissance** | Gathers information: OSINT, LinkedIn, scanning public services | Scan logs at the perimeter, reducing the public footprint |
| 2 | **Weaponization** | Combines an exploit and a payload (e.g., a macro document with a loader) | The defender does **not see** this directly; threat intel about tools helps |
| 3 | **Delivery** | Delivery: phishing email, USB, compromised website | Email gateway, URL filtering, attachment sandbox |
| 4 | **Exploitation** | Exploits a vulnerability or the user (the macro runs) | EDR, patching, ASR rules, disabled macros |
| 5 | **Installation** | Installs a backdoor, persistence (service, Run key, scheduled task) | EDR, FIM, Sysmon event 13 (registry), Windows 4698/7045 |
| 6 | **Command and Control (C2)** | Establishes a channel to its infrastructure (beaconing) | DNS/proxy logs, NetFlow, IDS, domain blocking |
| 7 | **Actions on Objectives** | Data theft, encryption (ransomware), sabotage | DLP, egress monitoring, backup, segmentation |

An example of connecting this to what you did in the detection lab: a Wazuh alert on a new service (Windows **7045**) means the attacker is at least in the **Installation** phase. If at the same time the proxy shows regular connections to a rare domain every 60 seconds, they are already in the **C2** phase.

```
$ tshark -r beacon.pcap -Y "dns.qry.name contains \"cdn-upd\"" -T fields -e frame.time_relative -e dns.qry.name
0.000000     cdn-upd4te.example
60.012331    cdn-upd4te.example
120.009871   cdn-upd4te.example
180.010442   cdn-upd4te.example
```

A regular interval of ~60 s (small **jitter**) is a classic indicator of beaconing, i.e., phase 6.

**Limitations of the Kill Chain** (a common question):

- it is focused on the **perimeter** and malware; it describes insiders, credential-based attacks, or malware-free cloud attacks poorly,
- it is **linear**, while real attacks go back to earlier phases (new recon from inside, lateral movement),
- phases 1 and 2 happen on the attacker's side, so the defender barely sees them.

That's why there are extensions such as the **Unified Kill Chain** (Paul Pols, 18 phases in three cycles: In, Through, Out), which combines the Kill Chain and ATT&CK.

> **On the exam:** "In which phase does the organization have the LEAST visibility?" → **Weaponization** (it happens on the attacker's infrastructure). "Where is it BEST to disrupt the attack?" → as early as possible, usually **Delivery** (email filter, attachment blocking). Phishing email = Delivery, running the macro = Exploitation, scheduled task = Installation.

## Diamond Model of Intrusion Analysis

The Diamond Model describes **a single event** through four interconnected vertices:

```
                Adversary
               /         \
              /           \
     Infrastructure ---- Capability
              \           /
               \         /
                 Victim
```

| Vertex | Meaning | Example |
|---|---|---|
| **Adversary** | Who attacks (operator and/or customer) | APT group, ransomware affiliate, insider |
| **Capability** | What it attacks with: tools, malware, techniques | Phishing macro, Cobalt Strike beacon, exploit for a CVE |
| **Infrastructure** | Through what it delivers and controls | C2 domains and IP addresses, compromised email servers, VPS |
| **Victim** | The target: person, organization, system, asset | Accounting, laptop `FIN-LT-07`, email `ana@firma.ba` |

Edges connect the vertices: the adversary **develops** the capability and **uses** the infrastructure, the capability is **applied** to the victim, the infrastructure **connects** the attacker and the victim.

**Meta-features** of an event: **timestamp**, **phase** (e.g., Kill Chain phase), **result** (success/failure), **direction** (e.g., infrastructure → victim), **methodology** (class of activity, e.g., spear phishing), and **resources** (what the attacker needed: money, knowledge, access).

Two extended axes:

- **Social-political**: the relationship between attacker and victim, motive (financial, espionage, hacktivism),
- **Technology**: the capability–infrastructure link (e.g., the malware uses a DNS tunnel).

### Pivoting

The main practical value: from one known vertex you **pivot** to the others. From a known C2 IP address (infrastructure) you search passive DNS and find other domains of the same group, from them other victims in your network, from a malware sample (capability) you find other campaigns.

```
$ jq -r '.[] | select(.c2=="203.0.113.45") | "\(.host)\t\(.first_seen)"' edr_netconn.json
FIN-LT-07      2026-10-02T08:14:11Z
FIN-LT-11      2026-10-02T09:02:47Z
HR-DT-03       2026-10-03T07:55:09Z
```

One infrastructure → three victims. That is a pivot from the Infrastructure vertex to Victim.

An **activity thread** links several Diamond events of one attack chronologically (by Kill Chain phases), and an **activity group** groups similar threads (same attacker or campaign).

> **On the exam:** the question lists the elements and asks for the model: "the analyst identified the attacker, their tool, the C2 server, and the targeted user" → **Diamond Model**. If the question asks what a C2 domain is in the Diamond Model → **Infrastructure**; malware → **Capability**.

## MITRE ATT&CK

**ATT&CK** (Adversarial Tactics, Techniques, and Common Knowledge) is a public knowledge base of adversary behavior, based on **real, observed** attacks. There are three matrices: **Enterprise** (Windows, Linux, macOS, cloud, network, containers, ESXi), **Mobile**, and **ICS**.

| Term | Question | Example |
|---|---|---|
| **Tactic** | **Why**: the attacker's goal at that step | `TA0003` Persistence |
| **Technique** | **How** it achieves the goal | `T1053` Scheduled Task/Job |
| **Sub-technique** | A more specific variant | `T1053.005` Scheduled Task (Windows) |
| **Procedure** | How a **specific group** carried it out | Group X creates the task `\Microsoft\Update` that runs `rundll32` |
| **Mitigation** | A control that prevents the technique | `M1026` Privileged Account Management |
| **Detection strategy / Analytic** | How to detect (since v18, October 2025, replaces the old Data Sources) | Analytic for task creation on Windows with log sources |

Enterprise tactics (14), in the order they are usually shown:

| ID | Tactic | ID | Tactic |
|---|---|---|---|
| TA0043 | Reconnaissance | TA0007 | Discovery |
| TA0042 | Resource Development | TA0008 | Lateral Movement |
| TA0001 | Initial Access | TA0009 | Collection |
| TA0002 | Execution | TA0011 | Command and Control |
| TA0003 | Persistence | TA0010 | Exfiltration |
| TA0004 | Privilege Escalation | TA0040 | Impact |
| TA0005 | Defense Evasion | | |
| TA0006 | Credential Access | | |

Unlike the Kill Chain, ATT&CK is **not linear**: techniques from the same tactic recur at various points in an attack.

### Mapping alerts to ATT&CK

As in the detection lab (Sigma rules have `tags: attack.t1059.001`), you map alerts and findings to techniques. An example from Windows logs (Security 4688 with command line):

```
EventID     : 4688
NewProcess  : C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
CommandLine : powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBi...
Parent      : C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE
```

| Observation | Tactic | Technique |
|---|---|---|
| Word launches PowerShell | Execution | T1204.002 User Execution: Malicious File |
| `-enc` base64 command | Execution / Defense Evasion | T1059.001 PowerShell, T1027 Obfuscated Files or Information |
| `schtasks /create` afterwards | Persistence | T1053.005 Scheduled Task |
| Regular HTTPS calls to a rare domain | Command and Control | T1071.001 Web Protocols |

Uses of ATT&CK in the SOC:

- **Detection coverage / gap analysis**: in the **ATT&CK Navigator** you color the techniques your rules cover and see the gaps,
- **Threat-informed defense**: from a report about a group targeting your industry, you take its techniques and check whether you detect them,
- **Threat hunting**: a hypothesis per technique (e.g., "we're looking for T1003.001 LSASS dump"),
- **Adversary emulation** / purple team: testing detections by simulating techniques (e.g., Atomic Red Team, CALDERA),
- **Reporting**: a common language in incident reports and threat intel sharing (STIX objects carry ATT&CK IDs).

Related MITRE projects: **D3FEND** (defensive techniques, "ATT&CK for defenders"), **ATLAS** (attacks on AI/ML systems, useful for objective 1.6), **CAPEC** (application attack patterns), **Engage** (deception).

> **On the exam:** "Tactic" is **why**, "technique" is **how**, "procedure" is a group's **specific implementation** (TTP). The question "the team wants to determine which attacker behavior it does NOT detect" → mapping detections to **ATT&CK** (Navigator, gap analysis). An ID with a dot (`T1059.001`) is a **sub-technique**.

## Testing frameworks: OSSTMM and OWASP

In the CS0-003 objectives, testing methodology frameworks were listed alongside attack frameworks. CS0-004 explicitly lists only Kill Chain, Diamond, and ATT&CK in 3.1, but the terms appear in distractors and in domain 2 (scanning and testing), so you need to recognize them:

| Framework | What it is | Keywords |
|---|---|---|
| **OSSTMM** (Open Source Security Testing Methodology Manual, ISECOM) | Peer-reviewed methodology for **operational** security testing and measurement | Channels (human, physical, wireless, telecommunications, data networks), **RAV** (risk assessment values), measurable results |
| **OWASP Web Security Testing Guide** (WSTG) | Guide for testing **web applications** | Tests with IDs (e.g., `WSTG-INPV-05` SQL injection), categories: authentication, sessions, input validation |
| **OWASP Top 10** | List of the most critical web application risks (awareness, not a testing methodology) | Broken Access Control, Injection… |
| **PTES** | Penetration Testing Execution Standard | Phases from pre-engagement to reporting |

The difference in role: ATT&CK/Kill Chain/Diamond describe **how the attacker works** (analysis and defense), while OSSTMM/WSTG describe **how we test** a system.

## The incident response process (3.2)

CS0-004 lists seven phases. This is a split-out version of the classic NIST loop:

```
Preparation → Detection → Analysis → Containment → Eradication → Recovery → Post-incident
     ^                                                                          |
     +---------------------------- lessons learned -----------------------------+
```

| Phase | Key activities | Typical artifact |
|---|---|---|
| **Preparation** | IR plan and policy, roles (CSIRT), playbooks, tools (EDR, SIEM, forensic kit), logging and retention, training, tabletop, contacts (legal, PR, regulator, police) | IR plan, communication plan, contact list, jump bag |
| **Detection** | Noticing a possible incident: SIEM alerts, EDR, IDS, user reports, threat intel, third parties | Alert/ticket, first event |
| **Analysis** | Validation (true/false positive), determining scope, impact, and severity, correlation, timeline, incident declaration | Timeline, list of IoCs, category and priority |
| **Containment** | Stopping the spread: host isolation (EDR), blocking IPs/domains, disabling accounts, segmentation; short-term and long-term | List of isolated systems, firewall changes |
| **Eradication** | Removing the cause: malware, persistence, malicious accounts, the vulnerability the attacker exploited; reimage | Clean systems, patched vulnerability, reset credentials |
| **Recovery** | Return to production: restore from a clean backup, integrity verification, enhanced monitoring, release from isolation | Confirmation that the service works, enhanced monitoring |
| **Post-incident** | Lessons learned meeting, **root cause analysis**, after action report, updating the plan, playbooks, and detections, evidence retention | AAR, corrective actions |

Details of the techniques (triage, evidence, isolation, RCA) are in the next module (3.3), and reports in module 11 (4.2).

### Containment strategies

| Strategy | When | Risk |
|---|---|---|
| **Isolation** (host isolation via EDR, quarantine VLAN) | Clearly compromised endpoint | The attacker notices and changes tactics |
| **Segmentation** (ACL, microsegmentation) | Limit movement between zones | Affects legitimate business flows |
| **Removal** (physically disconnecting from the network) | Critical case, no EDR | Loss of volatile data if power is cut |
| **Monitoring without interruption** ("watch and learn") | Rarely, with approval from management and the legal team, to learn the scope | Damage continues; must be a conscious decision |

Criteria for choosing a strategy (from NIST): potential damage and theft of resources, need for evidence preservation, service availability, time and resources needed to implement, effectiveness (partial or full containment), and duration of the solution.

> **On the exam:** questions asking "what to do FIRST" when ransomware is confirmed on one host → **isolation** (containment), not reimage (eradication) and not restore (recovery). Don't shut the machine down if you need volatile evidence: isolate it at the network level. Updating a playbook after an incident → **Post-incident**. Writing a playbook in advance → **Preparation**.

### Typical tasks per phase: recognize the phase

```
[08:14] User reports a strange window after opening an invoice      -> Detection
[08:30] Analyst confirms the alert is a true positive, 3 hosts      -> Analysis
[08:41] EDR: "Isolate device" on FIN-LT-07, FIN-LT-11, HR-DT-03     -> Containment
[08:45] Domain cdn-upd4te.example blocked on DNS/proxy              -> Containment
[10:20] Scheduled task removed, hosts reimaged                      -> Eradication
[12:05] Data restored from the 1 Oct backup, hashes verified        -> Recovery
[+5 days] Lessons learned, RCA: internet macros were not blocked    -> Post-incident
```

## NIST SP 800-61r3 and CSF 2.0

In April 2025, NIST published **SP 800-61 Rev. 3** "Incident Response Recommendations and Considerations for Cybersecurity Risk Management", which **supersedes Rev. 2** (2012). The main change: instead of a separate four-phase loop, IR is viewed through the six functions of **NIST CSF 2.0**.

The old loop (Rev. 2) had four phases: **Preparation**; **Detection & Analysis**; **Containment, Eradication & Recovery**; **Post-Incident Activity**. Rev. 3 argues that incidents today are frequent, long-lasting (weeks and months), and that lessons should be shared **immediately**, not only after the incident is over.

| Old phase (Rev. 2) | CSF 2.0 functions (Rev. 3) |
|---|---|
| Preparation | **Govern**, **Identify** (all categories), **Protect** |
| Detection & Analysis | **Detect**, Identify (Improvement) |
| Containment, Eradication & Recovery | **Respond**, **Recover**, Identify (Improvement) |
| Post-Incident Activity | Identify (**Improvement**, ID.IM) |

The model in Rev. 3 has two levels: the lower ones (Govern, Identify, Protect) are broader risk management activities that **support** IR, and the upper ones (Detect, Respond, Recover) are the incident response itself. In the middle is **continuous improvement** (ID.IM): lessons from all functions constantly flow back into all functions.

Useful CSF categories from Rev. 3 that line up directly with exam terms:

| CSF category | Content | Exam term |
|---|---|---|
| **DE.AE** Adverse Event Analysis | Correlation, impact and scope assessment, CTI, **incident declaration** (DE.AE-08) | Detection, Analysis |
| **RS.MA** Incident Management | Executing the plan, **triage** (RS.MA-02), categorization and prioritization, **escalation** (RS.MA-04), recovery criteria | Triage, escalation |
| **RS.AN** Incident Analysis | Sequence of events and **root cause** (RS.AN-03), recording actions, data integrity, magnitude | Timeline, RCA, evidence |
| **RS.CO** Incident Response Reporting and Communication | Notifying internal and external parties | Communication plan |
| **RS.MI** Incident Mitigation | **Containment** (RS.MI-01), **eradication** (RS.MI-02) | Containment, eradication |
| **RC.RP** Incident Recovery Plan Execution | Restore, backup integrity, **after-action report** (RC.RP-06) | Recovery |
| **RC.CO** Incident Recovery Communication | Communication during recovery | Communication |

The CompTIA objectives still use the phase names (Preparation… Post-incident), so answer by phases on the exam. You need the Rev. 3 knowledge to recognize modern terminology and to understand that preparation is part of broader risk management.

> **On the exam:** if the question asks for the order, use the CompTIA sequence: **Preparation → Detection → Analysis → Containment → Eradication → Recovery → Post-incident**. If NIST 800-61r3 is mentioned, connect it to the **CSF 2.0** functions (Govern, Identify, Protect, Detect, Respond, Recover) and continuous improvement.

## Connecting the frameworks and the IR process

In practice, frameworks and the process work together:

| IR phase | How the frameworks help |
|---|---|
| Preparation | ATT&CK gap analysis determines which detections and logs to add; tabletop scenarios based on the techniques of known groups |
| Detection | Alerts carry ATT&CK tags (Sigma, Defender, Wazuh `rule.mitre.id`) |
| Analysis | The Kill Chain phase tells how far the attacker has progressed; Diamond pivoting reveals other victims |
| Containment | Breaking the chain: blocking C2 infrastructure (Diamond Infrastructure vertex) |
| Eradication | ATT&CK Persistence techniques are a checklist of everything that needs removing |
| Post-incident | The report maps the attack to ATT&CK; new detection use cases for missed techniques |

An example Wazuh alert with ATT&CK fields (as in the detection lab):

```
$ jq '.rule | {id, description, mitre}' alert.json
{
  "id": "100210",
  "description": "Scheduled task created via schtasks (custom rule)",
  "mitre": {
    "id": ["T1053.005"],
    "tactic": ["Execution", "Persistence", "Privilege Escalation"],
    "technique": ["Scheduled Task"]
  }
}
```

Notice that one technique belongs to **several tactics**: a scheduled task can be used for execution, persistence, and privilege escalation.

## Summary

- **Cyber Kill Chain** (Lockheed Martin): 7 linear phases (Reconnaissance, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives); break the chain as early as possible; weak for insiders and malware-free attacks.
- **Diamond Model**: Adversary, Capability, Infrastructure, Victim + meta-features; used for event analysis and **pivoting** from a known vertex to unknown ones.
- **MITRE ATT&CK**: tactic (why), technique (how), sub-technique (`T1059.001`), procedure (a specific group); used for detection mapping, gap analysis, hunting, and emulation. Since v18, detections are described through **Detection Strategies** and **Analytics**.
- OSSTMM and OWASP WSTG are **testing** methodologies, not models of adversary behavior.
- CompTIA IR process: **Preparation → Detection → Analysis → Containment → Eradication → Recovery → Post-incident**, with lessons feeding back into preparation.
- **NIST SP 800-61r3** (April 2025) supersedes Rev. 2 and maps IR to the **CSF 2.0** functions; emphasis on continuous improvement (ID.IM).
- For "FIRST/NEXT" questions, first determine which phase the scenario is in, then choose an activity from that phase.
