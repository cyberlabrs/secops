## Exam objectives: 7.1 – 7.5

Domain 7 (**Security Operations**) carries about 12.8% of the exam (13% in the 2024 outline). This module covers the first five objectives of the domain, the "peacetime" side of operations: how investigations are conducted, how monitoring is done, how configuration is kept under control and which principles apply to day-to-day work.

- **7.1 Understand and comply with investigations**
  - Evidence collection and handling
  - Digital forensics tools, tactics, and procedures
  - Investigative techniques
  - Artifacts (e.g., data, computer, network, mobile device)
  - Reporting and documentation
- **7.2 Conduct logging and monitoring activities**
  - Intrusion Detection and Prevention (IDPS)
  - Security Information and Event Management (SIEM)
  - Egress monitoring (e.g., Data Loss Prevention (DLP))
  - Log management
  - Security Orchestration, Automation and Response (SOAR)
  - Threat intelligence (e.g., threat feeds, threat hunting)
  - Continuous monitoring and tuning
  - User and entity behavior analytics (UEBA)
- **7.3 Perform Configuration Management (CM)** (e.g., provisioning, baselining, automation)
- **7.4 Apply foundational security operations concepts** (e.g., Defense in Depth (DiD))
  - Need-to-know/least privilege
  - Privileged account management
  - Separation of Duties (SoD) and responsibilities
  - Job rotation
- **7.5 Apply resource protection**
  - Media management
  - Data states (e.g., in use, in transit, at rest)
  - Media protection techniques (e.g., archiving, encryption, disposal/reuse)

> In the 2024 outline, 7.2 had no separate **SOAR** sub-item, and egress monitoring had no DLP example; 7.4 also had a **Service-level agreements (SLA)** sub-item and said "Segregation of Duties", without the DiD example; 7.5 said only "Data at rest/data in transit" (without **data in use**), and media protection techniques had no examples. The content here covers both versions.

The legal framework of investigations (types of investigations, standards of evidence, criminal/civil/regulatory) was introduced in module 2 (objective 1.6); here the focus is on **how an investigation is conducted and documented**. Incident management (7.6) is in module 13.

> **On the exam:** domain 7 is full of "what is FIRST" questions. Order of thinking: human safety → stopping the damage while preserving evidence → notification per policy → technical action. An analyst never "solves alone" what policy assigns to management, legal or law enforcement.

## 7.1 Investigations: types and who leads them

| Type of investigation | Who initiates | Standard of evidence | Typical outcome |
|---|---|---|---|
| **Administrative / operational** | The organization (IT, HR, management) | Internal, the most lenient | Disciplinary action, process fix, root cause |
| **Criminal** | Police, prosecution | **Beyond a reasonable doubt** | Prison, fine |
| **Civil** | A party to the dispute (plaintiff) | **Preponderance of the evidence** (more likely than not) | Damages |
| **Regulatory** | A regulator (e.g. data protection authority, FINRA, SEC) | Depends on the regulation | Fines, orders, loss of license |
| **Industry standards** | Contractual bodies (e.g. PCI SSC) | Contractual | Loss of certification, penalties |
| **eDiscovery** | Litigation | Rules of procedure | Production of relevant ESI |

Key point: an administrative investigation can **become** a criminal one. That is why from the first moment you work as if the evidence will end up in court.

> **On the exam:** when an internal investigation uncovers a possible crime (e.g. child pornography, large-scale fraud), the correct step is to stop further "poking around", preserve the evidence and involve **legal / senior management**, who decide on reporting to the police. The analyst does not call the police on their own, but also does not delete anything or "investigate further".

## Evidence collection and handling

### Types of evidence

| Type | Description | Example |
|---|---|---|
| **Real (physical) evidence** | A physical object | Disk, laptop, USB |
| **Documentary evidence** | Written records, including logs | Logs, e-mail, contract |
| **Testimonial evidence** | Witness testimony | Testimony of an administrator, an expert |
| **Demonstrative evidence** | An auxiliary presentation for the court | Network diagram, timeline |
| **Best evidence** | The original document | The original contract, not a copy |
| **Secondary evidence** | A copy or oral description | Photocopy |
| **Direct / circumstantial / corroborative** | Proves directly / indirectly / supports other evidence | Camera footage / presence in a log / confirmation from another source |
| **Hearsay** | Second-hand statement; logs are generally an exception if they are **business records** kept regularly | A log not kept routinely may be challenged |

The **best evidence rule** (the original takes precedence) and the **parol evidence rule** (a written contract is not changed by oral agreements) are familiar from domain 1.

### Five characteristics of admissible evidence

Evidence must be:

1. **Relevant**: relates to a fact in dispute.
2. **Authentic / Material**: it is provably what it is claimed to be (hash, chain of custody).
3. **Complete**: the whole picture, including exculpatory evidence.
4. **Reliable / Accurate**: collected by a reliable, accepted method.
5. **Admissible / Believable**: collected lawfully and understandable to the court.

The classic exam formulation: evidence must be **sufficient, reliable, relevant** (and lawfully collected).

### Chain of custody

**Chain of custody** is the documented history of every piece of evidence: who collected it, when, where, how it was labeled, who took it over and why, where it was stored. A break in the chain does not automatically make the evidence unusable, but the opposing party will attack it.

A record typically contains: a unique evidence number, a description (serial number, model), date and time, the person's name, signature, reason for transfer, storage location, hash values.

### Order of volatility (RFC 3227)

| Order | Source | Why |
|---|---|---|
| 1 | CPU registers, cache | Disappear in nanoseconds |
| 2 | Routing table, ARP cache, process table, kernel statistics, **RAM** | Lost on shutdown |
| 3 | Temporary file systems, swap | Get overwritten |
| 4 | Disk | Persistent, but changes with use |
| 5 | Remote logs and monitoring data | Rotated according to retention |
| 6 | Physical configuration, network topology | Relatively stable |
| 7 | Archival media (backup tapes) | Most stable |

> **On the exam:** "A system is compromised and still running. What FIRST?" Do not shut it down (RAM is lost), do not restart, do not run antivirus on the original. Isolate it from the network (if policy requires), collect volatile data, then make a forensic image of the disk. Exception: if the damage is actively spreading (e.g. ransomware encrypting shared drives), stopping the damage may take precedence, and that is a decision per the IR plan.

### Locard and MOM

- **Locard's exchange principle**: every contact leaves a trace; the perpetrator always leaves something behind and takes something away (logs, artifacts).
- **MOM**: **Motive, Opportunity, Means** – a framework for assessing a suspect.

## Digital forensics: tools, tactics, procedures

The forensic process (ISO/IEC 27037 for identification, collection, acquisition and preservation; ISO/IEC 27042 for analysis; NIST SP 800-86):

| Phase | What is done | Key control |
|---|---|---|
| **Identification** | Recognize potential sources of evidence | Scene documentation, photographs |
| **Preservation** | Prevent modification | Isolation, legal hold, access restriction |
| **Collection / Acquisition** | Seize the device or make a copy | **Write blocker**, bit-stream image |
| **Examination** | Extract relevant data | Work only on a copy |
| **Analysis** | Interpret, build a timeline | Validated tools, repeatability |
| **Presentation / Reporting** | Report and testimony | Clear, impartial language |

### Key procedures

- **Bit-stream (forensic) image**: a copy of every sector, including slack space and unallocated space, not just the files. A logical copy (copying files) is not sufficient for forensics.
- **Hashing**: hash of the original and the copy (SHA-256) at acquisition and at every later check; a match proves integrity.
- **Write blocker** (hardware or software): prevents writing to the source media during acquisition.
- **Working on a copy**: the original is sealed and stored; a working copy (often a copy of a copy) is analyzed.
- **Tool validation**: the tool must be generally accepted and tested (e.g. the NIST CFTT program tests forensic tools).
- **Live forensics vs dead-box**: live access captures memory, open connections, disk encryption keys; dead-box (powered-off system) is simpler for integrity, but loses volatile data.

Tool categories (descriptive): disk and memory acquisition tools, forensic suites for file system analysis, memory analysis tools, network traffic analyzers (pcap), mobile device tools, timeline tools and hash databases of known files (e.g. NSRL for excluding known system files).

## Investigative techniques

| Technique | Description |
|---|---|
| **Interviews** | Informal conversation with witnesses; **interrogation** of a suspect is done by a trained person, with legal and HR, respecting the employee's rights |
| **Timeline analysis** | Merging events from multiple sources by time; the prerequisite is **synchronized time (NTP)** |
| **Link analysis** | Connecting entities (accounts, IPs, devices) |
| **Root cause analysis** | Why it happened (5 Whys, Ishikawa) |
| **Malware analysis** | Static and dynamic (in a sandbox), from a defensive perspective: IoCs, behavior |
| **Surveillance** | Physical (cameras) and computer (activity monitoring) – only with a legal basis and a monitoring policy |
| **Undercover / sting** | Mostly the domain of law enforcement; the organization must not induce a crime |

Terms ISC2 likes:

- **Enticement**: legal – attracting an attacker who already has the intent (e.g. a honeypot with an interesting server name).
- **Entrapment**: illegal/unethical – inducing a person who had no intent to commit a crime. Evidence obtained through entrapment is inadmissible.
- **Search warrant** vs **subpoena** vs **voluntary surrender**: police need a warrant; the organization may voluntarily hand over data (with legal); an employee who signed an acceptable use policy has no expectation of privacy on company equipment.
- **Exigent circumstances**: urgent circumstances (threat of evidence destruction) allow police to seize without a warrant.

> **On the exam:** the organization's right to monitor and search company devices rests on a **policy the employee has signed** and on a **banner** (login banner/warning) stating there is no expectation of privacy. If the question asks what is most important BEFORE monitoring employees, the answer is the policy and notice, not the tool.

## Artifacts: what to look for and where

| Category | Examples of artifacts | Note |
|---|---|---|
| **Data** | Files, metadata (MAC times: modified/accessed/changed), databases, slack space, deleted files | Metadata is often more important than content |
| **Computer** | RAM, registry, prefetch, event logs, browser history, swap/hibernation file, user profiles | RAM contains keys, processes, network connections |
| **Network** | Pcap, NetFlow/IPFIX, firewall and proxy logs, DNS logs, DHCP leases (IP–device mapping) | Full packet capture is expensive, flow is cheap |
| **Mobile device** | SIM, IMEI/IMSI, messages, location data, applications, cloud backup | Faraday bag to prevent remote wipe |
| **Cloud** | API/audit logs, snapshots, flow logs | Depends on the service model and contract |
| **Embedded/IoT** | Firmware, internal logs | Often no standard tools |

Mobile devices: isolate from the network (**Faraday bag**, airplane mode), do not power off if unlocked (access to encrypted data is lost), document the screen state.

## Reporting and documentation

An investigation report must be:

- **factual and impartial**: findings separated from opinions, no speculation;
- **repeatable**: tools, versions, methods and hash values described;
- **understandable** to the target audience (management, court, regulator) – technical details in an appendix;
- **complete**: also includes what does not support the hypothesis;
- **protected**: marked with a classification, distributed on a need-to-know basis, often under **attorney-client privilege** if commissioned by legal.

Typical structure: management summary, scope and authorization, methodology, timeline, findings, conclusions, recommendations, appendices (chain of custody, hash values, logs).

An **expert witness** may give an opinion; a **fact witness** testifies only about what they saw and did.

## 7.2 Logging and monitoring

### IDPS

| Criterion | IDS | IPS |
|---|---|---|
| Placement | Passive (SPAN/TAP) | **Inline** |
| Action | Alert | Blocks, resets the session |
| False positive risk | Noise for analysts | Disruption of legitimate business |
| Failure risk | No impact on traffic | Fail-open or fail-closed decision |

| Detection method | How it works | Advantage | Disadvantage |
|---|---|---|---|
| **Signature / knowledge-based** | Comparison with known patterns | Few false positives | Does not see zero-days |
| **Anomaly / behavior / statistical** | Deviation from a baseline | Sees the unknown | More false positives, needs learning |
| **Stateful protocol analysis / specification** | Comparison with the expected protocol behavior | Catches protocol abuse | Resource-intensive |
| **Heuristic** | Behavioral rules | Partly unknown threats | Tuning |

**NIDS/NIPS** watches the network (blind to encrypted traffic without TLS inspection), **HIDS/HIPS** watches the host (sees decrypted data, but consumes host resources and an attacker can disable it).

Detection outcomes:

| | Attack exists | No attack |
|---|---|---|
| **Alert** | True positive | **False positive** (Type I) |
| **No alert** | **False negative** (Type II) – most dangerous | True negative |

### Log management

Log lifecycle: generation → transmission → normalization → storage → analysis → retention → secure disposal (NIST SP 800-92).

| Control | Why |
|---|---|
| **Centralization** (syslog, agent) | An attacker on the host cannot delete the copy |
| **Time synchronization (NTP)** | Correlation and evidentiary value |
| **Integrity** (WORM, hash, signing) | Proof that the log was not modified |
| **Retention per policy and law** | Too short = no evidence; too long = cost and legal risk |
| **Access control** | A system administrator must not delete their own logs (SoD) |
| **Clipping / threshold** (**clipping levels**) | Recorded only when a threshold is exceeded (e.g. 5 failed logins) |
| **Protection against flooding** | Capacity, rotation, alert when logging stops |

What to log: who (identity), what (action, object), when (time), where (source, destination), outcome (success/failure). Do not log passwords, full card numbers or unnecessary personal data.

### SIEM, SOAR, UEBA

| Tool | Role | Key value |
|---|---|---|
| **SIEM** | Aggregation, normalization, **correlation**, alerting, reporting, retention | Sees a pattern that no single log shows |
| **SOAR** | Playbooks, tool orchestration, automated response, case management | Speed and consistency, reduces MTTR and analyst fatigue |
| **UEBA** | ML/statistical baseline of the behavior of users and entities (hosts, service accounts) | Insider threat, compromised accounts, "impossible travel" |

SOAR automation is introduced gradually: first enrichment and tickets, then actions with human approval, and only then fully automatic low-risk actions.

### Egress monitoring and DLP

**Egress monitoring** tracks what **leaves** the organization: exfiltration, C2 traffic, data leakage.

| DLP type | Where | What it sees |
|---|---|---|
| **Network DLP** | At the egress point (proxy, gateway) | Data in transit; blind to encrypted traffic without inspection |
| **Endpoint DLP** | Agent on the device | Data in use: USB, printing, clipboard |
| **Storage / discovery DLP** | Repositories, shares, cloud | Data at rest: where the sensitive data is |
| **Cloud DLP / CASB** | SaaS | Sharing, upload |

DLP assumes the data is **classified and labeled** – without classification DLP does not know what it is protecting. Detection techniques: pattern matching (regex), document fingerprinting, exact data match, labels. Other egress monitoring techniques: proxy and DNS logs, detection of **steganography**, document **watermarking**.

### Threat intelligence and threat hunting

| Term | Description |
|---|---|
| **Threat feed** | A machine-readable stream of IoCs (IPs, domains, hashes), often STIX/TAXII |
| **Strategic / tactical / operational / technical** TI | For management / TTPs for architects / specific campaigns / IoCs for tools |
| **Threat hunting** | A proactive, hypothesis-driven search for a threat that has **bypassed** existing alerts |
| **MITRE ATT&CK** | A knowledge base of TTPs for hypotheses and detection mapping |
| **Cyber Kill Chain** | Attack phases (recon → actions on objectives) |
| **Pyramid of Pain** | A hash is easy to change, TTPs are hard – detections at the TTP level are more valuable |

A threat feed without context and quality checks creates noise; TI is valuable when it is **relevant** to the industry and environment, **timely** and **actionable**.

### Continuous monitoring and tuning

**Information Security Continuous Monitoring (ISCM)**, NIST SP 800-137: define the strategy → establish the program (metrics, frequency) → implement → analyze and report → respond → review. **Tuning** reduces false positives (exceptions, thresholds) without creating false negatives; every rule change goes through change management and is documented.

> **On the exam:** if the SOC is "drowning" in too many alerts, the best answer is not to disable rules or hire more analysts, but risk-based **tuning** (prioritization by asset criticality, baseline, correlation) and possibly automation (SOAR). If the question asks about discovering an unknown attacker who is already inside, the answer is **threat hunting**, and for anomalies in account behavior, **UEBA**.

## 7.3 Configuration Management

**Configuration management (CM)** keeps systems in a known, approved state. It is linked to change management (7.9, module 13): change management decides **whether** something changes, CM ensures **that** the state is documented and compliant.

| Element | Description |
|---|---|
| **Provisioning** | Creating systems from an approved, hardened template (golden image), with secure defaults |
| **Baselining** | A documented, approved configuration (e.g. CIS Benchmark, DISA STIG) as a reference point |
| **Automation** | IaC and configuration tools; repeatability, less human error, fast recovery |
| **CMDB** | A database of **configuration items (CI)** and their relationships |
| **Configuration audit / drift detection** | Comparing the actual state with the baseline |
| **Versioning** | Every baseline version is tagged and can be rolled back |

NIST SP 800-128 phases: planning → identifying and implementing configurations → controlling configuration changes → monitoring. The classic CM process (from the software domain): **configuration identification, configuration control, configuration status accounting, configuration audit**.

> **On the exam:** if a deviation from the baseline (drift) is detected, the correct reaction is not to "manually revert it on the server" without a trace, but to investigate the cause (unauthorized change = possible incident), revert through the controlled process and update the documentation. Automation without change control just spreads errors faster.

## 7.4 Foundational security operations concepts

### Defense in Depth (DiD)

Multiple layers of **different** controls (administrative, technical, physical; preventive, detective, corrective) so that the failure of one layer does not mean compromise. Example: policy + training, MFA, segmentation, EDR, encryption, logging, physical access control. DiD is often combined with the **zero trust** principle (no implicit trust based on location).

### Need-to-know and least privilege

| Principle | Question | Example |
|---|---|---|
| **Least privilege** | Which **rights/actions** are minimally needed? | A backup operator can read, but not delete |
| **Need-to-know** | Which **data** does this job require access to? | An analyst with a "Secret" clearance sees only the files of their own case |

Clearance answers "may they at all", need-to-know answers "do they need exactly this". Terms: **privilege creep / aggregation** (accumulating rights when changing positions) – the solution is periodic **access reviews** (recertification).

### Privileged account management (PAM)

- Separate privileged accounts (do not use the admin account for e-mail and web).
- **Just-in-time (JIT)** and **just-enough administration (JEA)**: privilege is granted temporarily and narrowly.
- A vault for passwords and keys, automatic rotation, monitored **break-glass** accounts.
- Recording and monitoring of privileged sessions; log review is done by someone **who is not** an administrator.
- Service accounts: inventory, no interactive logon, secret rotation.
- More frequent and stricter access reviews for privileged accounts.

### Separation of Duties and responsibilities

**SoD** divides a critical process so that no single person can both perform and conceal abuse. Examples: a developer does not deploy to production; whoever creates a supplier does not approve payment; an administrator does not delete audit logs; security administrator ≠ system administrator.

Related controls:

- **Two-person integrity / dual control**: two people must perform the action together (e.g. the vault key, the CA root key).
- **Split knowledge**: no one knows the entire secret (e.g. M-of-N key recovery).
- **Collusion** is the residual risk of SoD; it is mitigated by rotation and mandatory vacation.

### Job rotation and mandatory vacation

| Control | Purpose |
|---|---|
| **Job rotation** | Fraud detection (a new person sees irregularities), cross-training, reduced dependence on an individual |
| **Mandatory vacation** | Detective: the person is absent e.g. 1–2 weeks, someone else does the job and uncovers concealed actions |

> **On the exam:** distinguish the purpose: SoD is a **preventive** control against fraud by a single person; job rotation and mandatory vacation are primarily **detective** (and deterrent). If the question says "the employee never takes annual leave and is the only one who knows the payment process", the answer is mandatory vacation / job rotation.

### SLA (from the 2024 outline)

A **service-level agreement (SLA)** defines measurable service levels (availability, response time, incident resolution time) and the consequences of non-compliance; the internal counterpart is an **OLA** (operational-level agreement). For security operations the important elements are: incident notification deadlines, right to audit, availability of logs. The 2027 outline no longer lists SLA as a separate 7.4 sub-item (third-party contracts are covered in domain 1).

## 7.5 Resource protection

### Media management

| Activity | Controls |
|---|---|
| **Labeling** | Classification visible on the media and in the inventory |
| **Inventory and tracking** | Who has the media, where it is, chain of custody for transport |
| **Storage** | Locked, controlled conditions (temperature, humidity, magnetic fields), offsite for backups |
| **Transport** | Encrypted, trusted courier, sealed containers, records |
| **Handling** | Only authorized personnel, **media librarian** as a role |
| **Lifetime (MTBF, write cycles)** | Replacement before failure, checking archive readability |

### Data states

| State | Threats | Controls |
|---|---|---|
| **At rest** | Media theft, unauthorized access | Full-disk / database / file encryption, access control, key management |
| **In transit** | Eavesdropping, MitM | TLS, IPsec, VPN, mTLS |
| **In use** | Memory dump, side-channel, screen scraping | **Confidential computing** (TEE, secure enclave), masking, endpoint DLP, session access control |

Data in use is the hardest to protect because data in memory is processed in cleartext; that is why the 2027 outline highlights all three states.

### Media protection techniques

**Archiving**: long-term storage per retention; the format and media must remain readable (periodic migration), the archive is encrypted and restores are tested. **Encryption**: protects the media in case of loss or theft; the key is stored separately.

**Disposal/reuse** (NIST SP 800-88):

| Method | Description | Reuse |
|---|---|---|
| **Clear** | Logical overwriting of all addressable locations | Within the organization, at the same classification level |
| **Purge** | Resistant to laboratory recovery: **degaussing** (magnetic media only), **cryptographic erase**, block erase for SSDs | Possible outside the organization's control (depending on policy) |
| **Destroy** | Shredding, incineration, melting, pulverization | No |

Notes: **degaussing** does not work on SSDs or optical media; on SSDs overwriting is unreliable because of wear leveling, so crypto erase, built-in sanitize or destruction is used. **Data remanence** (residual data) is the risk these methods address. Deleting a file or formatting is not sanitization. After sanitization – **verification** and a **certificate of destruction** if a third party does it.

> **On the exam:** for the most sensitive data and media leaving the organization, the safest choice is **physical destruction**. For the cloud, where physical access is not possible, the answer is **cryptographic erasure (crypto-shredding)**. If the media is reused in the same environment and at the same classification level, **clear** is sufficient.

## Scenarios

**Scenario 1.** HR asks the SOC to "take a look at the e-mails" of an employee suspected of leaking data. Correct: check whether there is a policy that permits monitoring and an authorization (legal, HR, management), work through a formal investigation, preserve evidence with chain of custody and restrict access on a need-to-know basis. Do not do informal "favors".

**Scenario 2.** DLP alert: a large upload to personal cloud storage. First triage (false positive? authorized transfer?), then escalation per the playbook; if confirmed, preserve the proxy and endpoint logs before they rotate.

**Scenario 3.** An analyst notices that a service account has started logging in interactively at night from another country. UEBA anomaly → confirm, disable/rotate credentials through the IR process, check the PAM records.

## Summary

- An investigation is conducted from the start as if the evidence will go to court: lawful collection, **chain of custody**, hashing, working on a copy, **order of volatility**, documentation.
- Evidence: relevant, authentic, complete, reliable, admissible; **enticement** is allowed, **entrapment** is not; the right to monitor comes from policy and the banner.
- Artifacts: data, computer, network, mobile, cloud; the report is factual, repeatable and tailored to the audience.
- An IDS alerts, an IPS blocks inline; signature vs anomaly; a **false negative** is the most dangerous.
- SIEM correlates, SOAR automates response, UEBA detects behavioral anomalies; DLP and egress monitoring track data leaving and require classification.
- Threat hunting is proactive and hypothesis-driven; continuous monitoring (SP 800-137) and tuning through change management.
- CM: provisioning from a golden image, baseline, automation, CMDB, drift detection.
- DiD, least privilege and need-to-know, PAM (JIT, vault, session monitoring), SoD (preventive), job rotation and mandatory vacation (detective).
- Data states: at rest, in transit, **in use**; sanitization per SP 800-88: clear, purge, destroy; degaussing does not work on SSDs.
- In the 2024 outline: no SOAR and no data in use, with SLA in 7.4.
