## Exam objectives: 7.6, 7.7, 7.8 and 7.9

Domain 7 (**Security Operations**) carries 12.8% of the exam under the 2027 outline (13% in the 2024 outline). This module covers four objectives:

- **7.6 Conduct incident management**: detection, response, mitigation, reporting, recovery, remediation, lessons learned,
- **7.7 Operate and maintain detection and preventative measures**: firewalls (next generation, web application, network), sandboxing, IDS and IPS, endpoint protection (anti-malware, **Endpoint Detection and Response (EDR)**, **Extended Detection and Response (XDR)**), honeypots/honeynets, allowlist/denylist, third-party provided security services (DDoS scrubbing, MSSP), machine learning and AI based tools,
- **7.8 Implement and support patch and vulnerability based management**,
- **7.9 Understand and participate in change management processes**.

> In the 2024 outline, objective 7.7 had only **Anti-malware** instead of "Endpoint Protection (anti-malware, EDR, XDR)", the old term **Whitelisting/blacklisting** instead of "Allowlist/Denylist", and "Third-party provided security services" without examples (DDoS scrubbing, MSSP). Objective 7.8 was called "Implement and support patch and vulnerability management". The content is essentially the same; the new terminology (allowlist/denylist) is what you will see in the questions.

Logging, SIEM, SOAR, UEBA and threat intelligence (7.2) are in module 12, and recovery, DR and BC (7.10–7.13) in module 14. Here we look at the **incident lifecycle**, the controls that prevent and detect incidents, and two processes that keep systems in a known state: patching and change management.

> **On the exam:** in an incident the order of decisions is always the same: **human safety**, then **stopping the damage (containment)**, then **evidence preservation**, then returning to operation. The answer "wipe everything and reinstall immediately" is almost never the FIRST step, and "find out who did it" is not the IR team's job before the damage has been stopped.

## Event, alert, incident

ISC2 makes a clear distinction between these terms. Do not mix them up in questions:

| Term | Definition | Example |
|---|---|---|
| **Event** | Any observable occurrence in a system or network | A user logged in, a packet arrived on port 443 |
| **Adverse event** | An event with a negative consequence | Server crash, packet flood |
| **Alert / alarm** | A tool's notification that an event may be suspicious | SIEM rule: 50 failed logins in 1 min |
| **Security incident** | An event that compromises confidentiality, integrity or availability, or violates policy | Ransomware on a file server, privilege misuse |
| **Breach** (data breach) | An incident in which data was confirmed to be disclosed to an unauthorized party | Export of the customer database to the attacker |

Every incident is an event, but not every event is an incident. A **breach** has legal consequences (notifying regulators and affected individuals, GDPR 72 hours), so the decision that something is a breach is made by management together with legal, not by the analyst alone.

### Types of incidents ISC2 lists

- denial-of-service attacks (DoS/DDoS),
- malware (virus, worm, trojan, ransomware),
- unauthorized access and privilege misuse (insider),
- inappropriate usage (AUP violation),
- data leakage,
- **zero-day** exploits, for which no signature or patch exists.

## Incident management: processes and models (7.6)

There are three models you will encounter. The exam mostly uses the ISC2 list from the outline, but questions may also rely on NIST:

| ISC2 CBK (7 steps) | NIST SP 800-61r2 (4 phases) | NIST SP 800-61r3 (2025, CSF 2.0) |
|---|---|---|
| — (preparation is a prerequisite) | **Preparation** | Govern, Identify, Protect (preparation) |
| **Detection** | Detection & Analysis | **Detect** |
| **Response** | Containment, Eradication & Recovery | **Respond** |
| **Mitigation** | Containment | Respond |
| **Reporting** | (throughout all phases) | Respond |
| **Recovery** | Containment, Eradication & Recovery | **Recover** |
| **Remediation** | Eradication | Recover / Identify (improvement) |
| **Lessons learned** | **Post-Incident Activity** | Identify (Improvement) |

Mnemonic for the ISC2 order: **D-R-M-R-R-R-L** (Detection, Response, Mitigation, Reporting, Recovery, Remediation, Lessons learned).

> **On the exam:** **preparation** is not in the ISC2 list of seven steps, but it is the most important phase. If a question asks what the organization should have done for the incident to go better, the answer is most often something from preparation: an IR plan, a defined team, training, contacts, tools and logs that already exist.

### Preparation

- An **incident response plan** approved by senior management, with a definition of an incident, roles, authorities and escalation criteria.
- **CSIRT / CIRT** (Computer Security Incident Response Team): security, IT operations, legal, HR, PR/communications, management. Legal and HR are mandatory because an incident can end in dismissal or in court.
- A pre-approved **communications plan** (who may talk to the media, the regulator, the police).
- Tools: jump bag (forensic tools, blank media, cables), emergency access accounts (break-glass), synchronized time (NTP) on all systems.

### 1. Detection

Detection sources: IDS/IPS, EDR, SIEM correlation, antivirus, user reports, help desk, a third party (CERT, partner, journalist). The first task is **triage**: confirm that the incident is real (and not a false positive), assess the scope and set the **priority**.

| Priority factor | Question |
|---|---|
| Functional impact | How many business functions are affected? |
| Information impact | Is confidential or regulated data at risk? |
| Recoverability | Can we recover, in how much time and with what resources? |

### 2. Response

Activating the CSIRT according to the plan. Decisions: who leads the incident, who communicates, whether police and legal are involved. In this phase every step is documented (time, action, who).

### 3. Mitigation (containment)

The goal is to **limit the damage and prevent spreading**, not to solve the cause. Examples: isolating a host into a quarantine VLAN, blocking an IP on the firewall, disabling a compromised account, unplugging the network cable (not the power).

| Containment strategy | Advantage | Disadvantage |
|---|---|---|
| Network isolation of the host | Stops spreading, RAM is preserved | The attacker may notice and erase traces |
| Shutting down the system | Complete stop | Volatile evidence is lost (memory, network connections) |
| Observing the attacker (sandbox, honeynet) | Gathering information | Risk of further damage and legal risk; a management decision |
| Blocking at the perimeter | Fast, does not touch the host | The attacker may change infrastructure |

> **On the exam:** if "unplug the network cable" and "cut the power" are offered, the network cable is better because it preserves memory contents. Exception: if data is actively being deleted or encrypted (e.g. destructive malware in progress), limiting the damage may be more important than evidence, but that is decided by the plan and management.

### 4. Reporting

Reporting runs throughout the incident, not only at the end:

- **internal**: management per the defined escalation, data and system owners,
- **external**: regulators (GDPR 72 hours from awareness, NIS2 early warning within 24 hours and notification within 72 hours, HIPAA, PCI DSS to the card brands), affected individuals, police, insurer, partners per contract,
- the decision to notify the police and the public is made by **senior management with legal**, not by the technical team.

### 5. Recovery

Returning systems to production: restoring from clean backups or a clean image, integrity verification, enhanced monitoring after the return. A system is returned to operation only once it is confirmed that the attacker no longer has access.

### 6. Remediation

Removing the **root cause** so the incident does not recur: patching the vulnerability, changing configuration, removing bad accounts, changing processes. This is where **root cause analysis (RCA)** is done. Remediation often goes through change management and patch management (7.8, 7.9).

### 7. Lessons learned

A post-incident review meeting, ideally within a few days, with all participants, **blameless**. Questions: what happened, when, how did we respond, what would we do differently, which controls or training are missing. Output: an updated IR plan, new controls, new SIEM rules, a report to management.

> **On the exam:** the question "what is the goal of the lessons learned phase" has the answer "improve the process and prevent recurrence", not "determine who is to blame" or "prepare evidence for court". If a question asks for the phase most often skipped, the answer is lessons learned.

### Remediation, mitigation, recovery: nuances

| Term | Question it answers | Ransomware example |
|---|---|---|
| **Mitigation** | How do we stop the damage now? | Isolate infected segments, disable SMB between segments |
| **Recovery** | How do we restore the business? | Restore servers from immutable backups |
| **Remediation** | How do we prevent recurrence? | Patch the VPN appliance the attacker came in through, introduce MFA |

### Scenario: an incident in progress

Friday at 6 p.m. EDR reports that a process mass-encrypting shared folders has started on an accounting computer. The correct sequence of decisions:

1. The analyst confirms the alert (triage) and escalates to the incident lead according to the plan.
2. EDR isolates the host from the network (mitigation), keeping it powered on for memory.
3. The incident lead activates the CSIRT, notifies management and legal (response, reporting).
4. Evidence is collected: memory, disk image, logs (link to 7.1, module 12).
5. The scope is determined: which other hosts are affected (threat hunting in EDR/SIEM).
6. Restoration from clean backups (recovery), with confirmation that the backups are not infected.
7. The entry point (phishing + macro) is found and removed (remediation): blocking macros, training, a rule on the e-mail gateway.
8. Lessons learned meeting, plan update and report.

## Detection and preventative measures (7.7)

### Firewalls

| Type | Layer (OSI) | What it sees | Typical use |
|---|---|---|---|
| **Static packet filter** | 3 (and 4) | IP addresses, ports, protocol; stateless | ACL on a router |
| **Stateful inspection** | 3–4 | Connection state (state table) | Classic perimeter firewall |
| **Circuit-level proxy** (SOCKS) | 5 | Session establishment, not content | Brokering TCP sessions |
| **Application-level proxy** | 7 | Protocol content (HTTP, FTP) | Proxy for outbound web traffic |
| **Next-Generation Firewall (NGFW)** | 3–7 | Applications regardless of port, users, TLS inspection, integrated IPS, threat intel | Modern perimeter and internal segmentation |
| **Web Application Firewall (WAF)** | 7 (HTTP/S) | Requests to the web application: SQLi, XSS, OWASP Top 10 | In front of web applications and APIs |
| **Network firewall** (host vs. network) | 3–4 | Traffic of a segment or a single host | Segmentation, host-based firewall on a server |

Architectures: **screened host**, **screened subnet (DMZ)** with two firewalls, **bastion host**, **multihomed** (dual-homed) firewall. The rule of every firewall is **implicit deny**: everything not explicitly allowed is forbidden.

> **On the exam:** a WAF protects a web application from application-level attacks, but it is **not a substitute for secure coding**. If a question asks for the BEST long-term solution for SQL injection, the answer is parameterized queries and input validation (domain 8); the WAF is a compensating control until the code is fixed.

### IDS and IPS

| Criterion | IDS | IPS |
|---|---|---|
| Placement | Passive (SPAN port, TAP) | **Inline**, all traffic passes through it |
| Reaction | Alert (detective control) | Blocks, drops, resets (preventive control) |
| False positive risk | Excess alerts | Legitimate traffic blocked (impact on availability) |
| Device failure | Does not affect traffic | A decision is needed: **fail-open** (availability) or **fail-closed** (security) |

By location: **NIDS/NIPS** (network) and **HIDS/HIPS** (host; sees encrypted traffic after decryption, file integrity). By detection method:

| Method | How it works | Advantage | Disadvantage |
|---|---|---|---|
| **Signature / knowledge-based** | Comparison with a database of known signatures | Few false positives | Does not see zero-days; the database must be up to date |
| **Anomaly / behavior-based** (statistical) | Deviation from a learned baseline | Can detect unknown attacks | More false positives; needs a learning period |
| **Stateful protocol analysis** (specification-based) | Comparison with the expected protocol behavior | Detects protocol abuse | Resource-intensive, does not cover all protocols |
| **Heuristic** | Rules and assessment of suspicious behavior | Covers variants of known malware | Tuning |

| Outcome | Meaning | Which is more dangerous |
|---|---|---|
| **True positive** | Attack and alert | — |
| **False positive** | Alert without an attack | Wastes time, leads to alert fatigue |
| **True negative** | No attack, no alert | — |
| **False negative** | Attack without an alert | **Most dangerous**: the attack goes unnoticed |

### Endpoint protection: anti-malware, EDR, XDR

| Tool | Focus | How it detects | Reaction |
|---|---|---|---|
| **Anti-malware** (AV) | Known malware on the host | Signatures, heuristics | Quarantine, file deletion |
| **EDR** | Behavior on the endpoint, telemetry (processes, registry, network) | Behavior analytics, IOC, IOA | Host isolation, process kill, rollback, forensic telemetry for threat hunting |
| **XDR** | Correlation across endpoint, network, e-mail, identity, cloud | Central analytics across multiple layers | Coordinated response through multiple controls |
| **MDR** (Managed Detection and Response) | EDR/XDR + the provider's 24/7 team | People + tool | The provider responds per the agreed playbook |

Anti-malware policy: central management, automatic signature updates, the user must not be able to disable protection, scanning at multiple layers (e-mail gateway, proxy, endpoint) because that is defense in depth. Good practice is **different vendors** on the gateway and the endpoint.

### Sandboxing

A **sandbox** is an isolated environment in which unknown code is run and observed before it reaches the user (e.g. detonating attachments on the e-mail gateway), or in which an application runs with restricted rights (browser sandbox, container, Java/JS sandbox). Limitation: advanced malware recognizes a virtual environment and delays malicious behavior (sandbox evasion), so a sandbox complements EDR rather than replacing it.

### Honeypots and honeynets

- **Honeypot**: a fake system with no legitimate users; every access is suspicious, so the false positive rate is low.
- **Honeynet**: a network of honeypots that simulates an entire environment.
- **Honeytoken / canary**: fake data (a fake account, a fake database record, a fake API key) whose use triggers an alert.
- **Padded cell**: a system to which the IDS redirects the attacker to be observed.

Legal boundary: **enticement** is allowed: the attacker already intended to attack, and we only provide an attractive target. **Entrapment** (inducing a crime the person did not intend) is not ethical and can make evidence inadmissible. A honeypot must be isolated so it does not become a springboard for attacking third parties.

> **On the exam:** the difference between enticement and entrapment is a classic question. If a honeypot has a banner "free movies, download here" to lure users who had no intention of attacking, that is entrapment. A honeypot with a vulnerable service on the internet that the attacker finds on their own is enticement.

### Allowlist and denylist

| Approach | Logic | Advantage | Disadvantage |
|---|---|---|---|
| **Allowlist** (formerly whitelisting) | Only what is on the list is allowed, everything else is forbidden (default deny) | Strongest protection against unknown malware and zero-days | Administrative burden, requires change management |
| **Denylist** (formerly blacklisting) | What is on the list is forbidden, everything else is allowed (default allow) | Easy to introduce | Does not protect against the unknown; the list is never complete |

Application allowlisting is based on the file hash (most secure, but every version changes the hash), the publisher's digital signature, or the path (weakest). It is suitable for systems that rarely change: kiosks, ICS/SCADA, POS terminals, servers.

### Third-party provided security services

| Service | What you get | What to watch out for |
|---|---|---|
| **MSSP** (Managed Security Service Provider) | 24/7 SOC, management of firewalls, IDS, SIEM | SLA (response time), access to logs, who may make blocking decisions |
| **MDR** | Detection and response on endpoints and beyond | Authority to isolate, escalation |
| **DDoS scrubbing** | Traffic is redirected (BGP or DNS) through the provider's scrubbing center, clean traffic is returned | Activation time (always-on vs. on-demand), capacity, TLS keys |
| **CDN** | Distribution and absorption of volumetric attacks | Shared responsibility for WAF rules |
| **Security-as-a-Service** (SECaaS) | E-mail filtering, SWG, CASB, SSE | Data location, contract |

Principle: **accountability cannot be outsourced**, only execution. The organization remains accountable for protecting data, so it must have a contract, an SLA, a right to audit and periodic verification (a SOC 2 Type II report).

> **On the exam:** when an organization engages an MSSP, the question "who is accountable if a breach occurs" has the answer: **the organization (the data owner)**. The MSSP is responsible under the contract, but legal and regulatory accountability stays with the owner.

### ML and AI tools

Applications: UEBA and anomaly detection, phishing classification, alert prioritization, automated triage in SOAR, AI assistants for analysts. Risks ISC2 expects you to recognize:

- **false positives/negatives** and the need for tuning,
- **adversarial ML**: poisoning of training data (data poisoning), model evasion,
- lack of transparency in decisions (explainability), which is a problem for evidence and audit,
- over-reliance: **a human must stay in the loop (human in the loop)** for high-impact decisions,
- privacy of data sent to an AI service.

## Patch and vulnerability management (7.8)

**Vulnerability management** is a continuous process of finding, assessing, prioritizing and remediating vulnerabilities; **patch management** is the part of it that deals with applying patches. Vulnerabilities are not remediated only by patching: there are also configuration changes, compensating controls and retiring systems.

### Lifecycle

| Step | Activity |
|---|---|
| 1. **Asset inventory** | You cannot patch what you do not know about (CMDB, asset discovery) |
| 2. **Identification** | Vulnerability scanning (authenticated vs. unauthenticated), tracking vendor bulletins, CVE, CISA KEV |
| 3. **Assessment and prioritization** | CVSS, EPSS, whether it is on the KEV list, asset criticality, internet exposure |
| 4. **Patch testing** | In a test environment matching production |
| 5. **Approval** | Through change management (CAB) |
| 6. **Deployment** | In phases: a pilot group, then the rest; within a defined maintenance window |
| 7. **Verification** | Rescanning, checking that the patch was really applied |
| 8. **Reporting and documentation** | Metrics, updated CMDB and baseline |

### Prioritization: CVSS is not enough

| Source | What it tells you |
|---|---|
| **CVE** | A unique vulnerability identifier |
| **CVSS** (v3.1 / v4.0) | Severity (0–10): base, temporal/threat, environmental metrics |
| **EPSS** | Probability of exploitation in the next 30 days |
| **CISA KEV** | The vulnerability is confirmed to be actively exploited |
| **Organizational context** | System criticality, exposure, existing compensating controls |

Risk = likelihood x impact. A CVSS 9.8 vulnerability on an isolated test server may be a lower priority than a CVSS 7.5 one on an internet-exposed VPN appliance that is on the KEV list.

### Types of patches and risks

- **Hotfix / quick fix**: an urgent fix for a single bug, sometimes without full testing.
- **Patch / update**: a regular fix.
- **Service pack / rollup**: a bundle of patches.
- **Emergency patch**: for an actively exploited zero-day; goes through an **emergency change** and is documented afterwards.

If a patch does not exist or must not be applied (legacy system, medical device, ICS not supported by the vendor), a **compensating control** is used: segmentation, virtual patching (IPS/WAF rule), allowlisting, enhanced monitoring. The decision to accept the residual risk lies with the **risk/system owner**, documented as a risk exception with an expiration date.

### Metrics

- time from release to patch application (mean time to patch / remediate),
- percentage of systems compliant with the baseline,
- number of open critical vulnerabilities older than the SLA deadline,
- number of exceptions and their age.

> **On the exam:** the question "what should be done BEFORE applying a critical patch to production" has the answer **test it and go through change management**, unless the scenario clearly says active exploitation is under way; even then the emergency change procedure is used, not bypassing the process. Automatically applying all patches directly to production is not the BEST answer.

## Change management (7.9)

**Change management** ensures that changes to systems are made in a controlled way: requested, assessed, approved, tested, documented, with the ability to roll back. The goal from a security standpoint: **prevent a change from reducing security or availability** and keep the system in a known state. It is closely tied to **configuration management** (7.3, module 12): CM defines the baseline, and change management controls deviations from it.

### Process

| Step | What happens | Who |
|---|---|---|
| 1. **Request (RFC)** | A formal request: what, why, impact, backout plan | Requester |
| 2. **Review / impact analysis** | Assessment of risk, security impact, dependencies, resources | Technical team, security |
| 3. **Approval** | Approval or rejection | **Change Advisory Board (CAB)** or change manager |
| 4. **Test** | Verification in a test environment | Implementer, QA |
| 5. **Schedule & notify** | Maintenance window, user notification | Change manager |
| 6. **Implement** | Applying according to plan | Implementer |
| 7. **Verify / validate** | Does the change work and has it not compromised security | Implementer, system owner |
| 8. **Document & close** | Updating the CMDB, baseline, documentation | Change manager |

If a change goes wrong, the **backout / rollback plan** is activated, which must have existed before approval.

### Types of changes (ITIL terminology)

| Type | Description | Approval |
|---|---|---|
| **Standard** | Pre-approved, low-risk, repeatable (e.g. password reset, adding a user per procedure) | Pre-approved model, no CAB |
| **Normal** | Any change that is neither standard nor emergency | CAB |
| **Emergency** | Urgent, due to an incident or a critical vulnerability | **ECAB** (emergency CAB) or an authorized person; documentation and retrospective review right afterwards |

> **On the exam:** an emergency change **does not bypass** change management; it follows an expedited procedure and is documented afterwards. If a question describes an administrator who "quickly fixed" a firewall rule without any record, that is a process violation even if the outcome was good. An unapproved change is in itself a security incident or at least an audit finding.

### The security role in change management

- Security is a **member of the CAB** and assesses the security impact of every change.
- **Separation of duties**: whoever develops does not approve and does not move to production alone.
- Unauthorized changes are detected through **file integrity monitoring** (FIM), comparison with the baseline, drift detection in IaC and audit logs.
- **Versioning** and documentation make it possible to reconstruct what was changed and when (important for incidents and forensics).

### Change management in a DevOps environment

In CI/CD the CAB does not meet for every commit. Controls are built into the pipeline: pull requests with mandatory review (peer review = approval), automated tests and security scanners (quality gates), signed artifacts, IaC as the only path for infrastructure changes, an audit trail in the repository. This is still change management, just automated; low-risk changes become "standard". More in module 15 (8.1, 8.2).

### Scenario: an unauthorized change

During the night, monitoring reports that a configuration file on a production web server has been modified. There is no open RFC. The correct approach:

1. Treat it as a **potential incident** (until proven otherwise), because an unauthorized change may be an attack.
2. Compare with the baseline and determine who made the change and how (audit log).
3. If an administrator worked without approval: revert to the approved state through the process, escalate to management, retrain; if not: incident response.
4. Lessons learned: why the technical control (e.g. restricted access, PAM) did not prevent the change.

## Putting it together: how objectives 7.6–7.9 work together

| Situation | Process | Link |
|---|---|---|
| EDR detects ransomware | Incident management (7.6) | Detection comes from the 7.7 controls |
| The cause is an unpatched VPN | Remediation → vulnerability management (7.8) | Emergency patch |
| Emergency patch in production | Emergency change (7.9) | ECAB, documentation afterwards |
| Lessons learned | New SIEM rules, allowlisting | Back into 7.7 and the baseline (7.3) |

## Summary

- **Event → alert → incident → breach**: each one is a narrower set; a breach carries legal notification obligations and is decided on by management with legal.
- ISC2 incident management steps: **Detection, Response, Mitigation, Reporting, Recovery, Remediation, Lessons learned**; preparation is a prerequisite and the most important phase. NIST 800-61r2: Preparation, Detection & Analysis, Containment/Eradication/Recovery, Post-Incident.
- Priorities: human life, containment, evidence preservation, recovery. Network isolation is better than shutdown (preserves RAM). Mitigation stops the damage, recovery restores the business, remediation removes the cause.
- Lessons learned is blameless and the goal is process improvement.
- Firewalls: packet filter, stateful, proxy, NGFW (applications, users, IPS), WAF (L7 HTTP, a compensating control, not a substitute for secure code); implicit deny.
- An IDS is passive and alerts, an IPS is inline and blocks (fail-open vs. fail-closed). Signature-based does not see zero-days, anomaly-based has more false positives. **A false negative is the most dangerous.**
- Anti-malware (signatures) → EDR (behavior, isolation, telemetry) → XDR (correlation across multiple layers) → MDR (service).
- A sandbox detonates unknown code; honeypots/honeynets/honeytokens have a low false positive rate; **enticement is allowed, entrapment is not**.
- Allowlist (default deny) is stronger than denylist; the terms replace whitelisting/blacklisting from the 2024 outline.
- Third parties (MSSP, MDR, DDoS scrubbing): execution is outsourced, **accountability is not**; contract, SLA, right to audit.
- ML/AI: tuning, adversarial ML, explainability, human in the loop.
- Vulnerability management: inventory → identification → prioritization (CVSS + EPSS + KEV + context) → test → approval → phased deployment → verification. No patch: a compensating control and a documented exception by the risk owner.
- Change management: RFC → impact analysis → CAB → test → schedule → implementation → verification → documentation, always with a backout plan. Standard / normal / emergency (ECAB, documentation afterwards). Urgent does not mean outside the process.
