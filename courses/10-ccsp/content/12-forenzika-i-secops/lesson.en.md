## Exam objectives: 5.4, 5.5 and 5.6

Domain 5 (**Cloud Security Operations**) carries 17% of the exam. This module closes the domain with three objectives:

- **5.4 Support digital forensics**: forensic data collection methodologies, evidence management, collecting, acquiring, and preserving digital evidence,
- **5.5 Manage communication with relevant parties**: vendors, customers, partners, regulators, and other stakeholders,
- **5.6 Manage security operations**: Security Operations Center (SOC), intelligent monitoring of security controls (firewall, IDS, IPS, honeypot, network security groups, AI), log capture and analysis (SIEM, log management, threat intelligence), Incident Response (IR), vulnerability assessments, and penetration testing.

The legal framework of forensics and eDiscovery (ISO/IEC 27037/27041/27042/27043, ISO/IEC 27050) is covered in detail in module 13 (objective 6.1). Here we look at the **operational** side: how a team in the cloud actually collects and preserves evidence, whom it notifies, and how it runs the SOC.

> **On the exam:** CCSP doesn't ask which command you type, but which decision you make. In forensics the answer is almost always "preserve the integrity of the evidence and the chain of custody", and in communication "respect the contract, the law, and the pre-agreed communication plan".

## Digital forensics in the cloud: why it's different

Classic forensics assumes the investigator can physically take the disk, make a bit-by-bit copy, and seal the original. In the cloud this is mostly not possible:

| Challenge | Description | Consequence for the investigation |
|---|---|---|
| **Multitenancy** | Physical hardware is shared by multiple customers | Seizing a server would violate other tenants' data; the provider does not allow it |
| **Lack of physical access** | The customer never sees the disk or the host | Acquisition goes through the API (snapshot, export) |
| **Volatility and elasticity** | Instances and containers shut down automatically (auto scaling, serverless) | Evidence can disappear within minutes; automated collection is needed |
| **Data distribution** | Data is spread across zones, regions, countries | Questions of jurisdiction and lawfulness of collection |
| **Dependence on the provider** | Hypervisor, network, and physical control logs are with the CSP | Cooperation must be contracted in advance |
| **Service model** | In SaaS, the customer sees only application logs | The higher the model, the fewer forensic artifacts the customer has |
| **Encryption** | Data encrypted with CSP or customer keys | Without the key there is no readable evidence; crypto-shredding destroys evidence forever |

### Who can collect what, by service model

| Artifact | IaaS | PaaS | SaaS |
|---|---|---|---|
| Guest OS memory (RAM) | Customer (agent or tool in the instance) | Mostly not | No |
| Disk / volume | Customer (snapshot) | Limited | No |
| OS and application logs | Customer | Partially (platform logs) | Only what the application exposes |
| Network flow logs | Customer (if enabled) | Partially | No |
| Control plane / API logs | Customer (e.g., AWS CloudTrail, Azure Activity Log) | Customer | Application audit log (e.g., Microsoft 365 Unified Audit Log) |
| Hypervisor, physical network, data center | CSP | CSP | CSP |

> **On the exam:** if a question says an organization uses SaaS and needs forensic data that is not in the audit log, the correct answer is to rely on the **contract** and the provider's cooperation (contracted log availability, retention periods, investigation contact), not to "image the server itself".

## Forensic data collection methodologies (5.4)

The generally accepted forensic process has phases that appear both in ISO/IEC 27037 and in NIST SP 800-86 (Guide to Integrating Forensic Techniques into Incident Response):

| Phase | NIST SP 800-86 | ISO/IEC 27037 activity | What it means in the cloud |
|---|---|---|---|
| 1 | **Collection** | **Identification** | Find where the potential evidence is: which account, region, resource, log |
| 2 | Collection | **Collection / Acquisition** | Collection = physically taking the device; acquisition = making a copy. In the cloud, almost always acquisition (snapshot, log export) |
| 3 | Collection | **Preservation** | Protection against modification: hash, write-once storage (WORM), legal hold, restricted access |
| 4 | **Examination** | (ISO/IEC 27042) | Extracting relevant data from the copy |
| 5 | **Analysis** | (ISO/IEC 27042) | Interpretation, timeline, conclusions |
| 6 | **Reporting** | (ISO/IEC 27042/27043) | A report understandable to lawyers and management, with a repeatable method |

Key principles of every methodology:

- **Integrity**: analysis is done on a copy, never on the original; the original and the copy are hashed (SHA-256) and the hash is entered in the record.
- **Repeatability and reproducibility**: another investigator using the same method must get the same result.
- **Auditability**: every step is documented (who, when, what, with which tool).
- **Justifiability**: the investigator must be able to explain why they chose that particular method (ISO/IEC 27037).
- **Order of volatility**: what disappears fastest is collected first (RFC 3227).

### Order of volatility

| Order | Source | Cloud example |
|---|---|---|
| 1 | Registers, CPU cache | Practically inaccessible to the customer |
| 2 | Memory (RAM), process table, network connections | Memory dump from the instance before shutdown |
| 3 | Temporary file systems, swap | Ephemeral / instance store volume (disappears when the instance stops) |
| 4 | Disk | Snapshot of an EBS/managed disk |
| 5 | Remote logs and monitoring | CloudTrail, flow logs, SIEM |
| 6 | Archival media | Backup, archive in the Glacier class |

The practical consequence: if an instance is compromised, **don't shut it down** immediately. Isolate it at the network level (a restrictive security group or network security group), capture memory, take a disk snapshot, tag the resource, and only then decide on shutdown.

### Automated collection

Because of elasticity, cloud forensics must be prepared in advance (**forensic readiness**):

- control plane and data plane logs enabled in **all** accounts and regions and centrally stored in a separate, locked-down account (log archive),
- immutable storage (Object Lock / WORM) for logs and evidence,
- a pre-prepared isolated **forensic account / subscription** with tools and restricted access,
- automation (e.g., EventBridge + Step Functions or Azure Logic Apps) that, on a finding, takes a snapshot and memory dump before auto scaling shuts down the instance,
- synchronized time (NTP) across all sources, otherwise the timeline makes no sense,
- contractually defined what the CSP retains, for how long, and how it is requested.

> **On the exam:** the question "what is MOST important to do BEFORE an incident so that forensics in the cloud is possible" targets **forensic readiness**: logging, retention, the CSP's contractual obligations, and a plan. The analysis tool is secondary.

## Evidence management and chain of custody (5.4)

**Evidence management** covers the entire life of evidence from identification to return or destruction. Its heart is the **chain of custody**: a chronological record of who had the evidence, when, where, and why, without gaps.

| Chain of custody record element | Example |
|---|---|
| Unique evidence identifier | EVD-2026-014 |
| Description | Snapshot of volume vol-0abc, instance i-0def, region eu-central-1 |
| Time and method of acquisition | 2026-10-12 14:03 UTC, API CreateSnapshot, IR role |
| Hash | SHA-256 of the image and exported logs |
| Who received and handed over | Name, role, signature (digital) |
| Storage location | Forensic account, bucket with Object Lock (compliance mode), forensic team's KMS key |
| Every access | Who opened the copy and why |

Rules of good evidence management:

1. **A minimal number of people** have access; access is logged.
2. **Separation**: evidence is stored outside the compromised environment (another account, another subscription, other keys).
3. **Integrity**: hash at acquisition and at every use; WORM storage.
4. **Confidentiality**: evidence often contains personal data, so privacy rules (GDPR) apply to the forensic team too.
5. **Legal hold**: when litigation is anticipated, routine deletion (retention policy) must be suspended for the relevant data.
6. **Documented method**: which tool, version, settings (for **admissibility** in court).

### Admissibility of evidence

For evidence to be usable in proceedings, it traditionally must be:

| Property | Meaning |
|---|---|
| **Authentic** | It provably is what it is claimed to be (hash, chain of custody) |
| **Accurate / reliable** | The collection method is reliable and repeatable |
| **Complete** | It shows the whole picture, not only the part that suits one side |
| **Admissible / legally obtained** | Collected in accordance with the law and jurisdiction |
| **Believable** | Understandable to the court, jurors, or regulator |

### Scenario: a compromised container

Detection reports a suspicious process in a pod on a managed Kubernetes cluster. The pod is part of a deployment with three replicas and a horizontal pod autoscaler.

1. Label the pod and node, isolate it with a network policy (deny all), and remove it from the service (by changing labels), so the controller doesn't create a replacement in the same place without a trace.
2. Collect volatile data: processes, network connections, the contents of the container file system (writable layer), logs.
3. Take a snapshot of the node's disk if needed.
4. Export the API server and cloud control plane audit logs to the forensic account, hash them, and record them in the chain of custody.
5. Only then delete the pod and perform eradication (new image, secret rotation).

A wrong first step would be "delete the pod immediately to stop the attack": damage is stopped by isolation, and deletion destroys evidence.

## Communication with relevant parties (5.5)

The cloud introduces more parties than a classic data center. Communication must be **planned in advance** (communication plan, contact matrix, contracts) and **controlled** (who may say what, to whom, and when). The five groups from the outline:

| Party | Typical communication | Channel and basis | Risk if done wrong |
|---|---|---|---|
| **Vendors** (CSP, suppliers, subcontractors) | Incident reporting, log requests, service changes, planned outages, end-of-life | Contract, SLA, support channel, security contact | Delayed investigation, breach of contract |
| **Customers** (service users) | Notification of outage, incident, change of terms, status pages | SLA, terms of use, notification law | Loss of trust, penalties for failing to notify |
| **Partners** (business partners, integrations, identity federation) | Sharing indicators of compromise, coordinating shared controls | Partnership agreement, NDA, ISAC | Incident spreading through connected systems |
| **Regulators** (supervisory authorities, CERT, sector regulator) | Legally required breach or incident notification, responses to inquiries, reports | Law (GDPR, NIS2, DORA, HIPAA, SEC) | Fines, loss of license |
| **Other stakeholders** (management, employees, investors, media, police, insurer) | Escalation, internal notices, public statement, insurance claim | Internal policies, PR plan, insurance policy | Information leaks, contradictory statements, loss of coverage |

### Communication principles

- **Need to know**: incident details go only to those who need them. Technical vulnerability details do not go into a public statement.
- **One voice**: only an authorized person (PR, legal) communicates publicly, in line with the plan.
- **Legal involved in advance**: the legal team is involved before notifying regulators and customers (content, deadlines, obligation).
- **Deadlines are legal**: e.g., GDPR Art. 33 requires notification to the supervisory authority without undue delay and, where feasible, within **72 hours** of becoming aware; NIS2 requires an early warning within **24 hours**, an incident notification within **72 hours**, and a final report within one month; DORA has similar phases for the financial sector. Details are in modules 13 and 14.
- **Out-of-band channels**: if e-mail or the collaboration tenant is compromised, the team communicates via an alternative channel.
- **Documentation**: every communication during an incident is recorded (later it serves the regulator and lessons learned).
- **Insurance**: a cyber policy usually requires notifying the insurer within a short deadline and approval for engaging an IR firm; failure to do so can mean loss of coverage.

### Communication with the CSP

The provider usually does **not** notify the customer of every event, and often communicates via a status page and a personal health dashboard (e.g., AWS Health, Azure Service Health). For the customer it is important to:

- know the CSP's contractual deadlines for notifying of incidents affecting its data,
- have up-to-date contacts (security contact, alternate contacts on the account),
- know that the CSP shares information according to its own rules: the customer cannot request other tenants' logs,
- have a procedure for government authority requests to the CSP (the CSP may be legally prevented from notifying the customer, e.g., a gag order).

> **On the exam:** when an incident affects personal data and the question asks what to do FIRST among the offered communication steps, it is almost always correct to **activate the incident response / communication plan and involve the legal department** before anything is published. The controller (cloud customer) remains responsible for notifying the regulator and data subjects, even when the incident occurred at the provider.

## Security Operations Center (5.6)

A **SOC** is a function (team, processes, and technology) that continuously monitors, detects, analyzes, and responds to security events. In the cloud, the SOC must monitor the control plane (API calls), identities, and configuration, not just the network.

| SOC model | Advantages | Drawbacks | When |
|---|---|---|---|
| **Internal (in-house)** | Control, knowledge of the environment | Expensive, hard to staff 24/7 | Large, regulated organizations |
| **Outsourced / MSSP / MDR** | 24/7 coverage, expertise | Less context, vendor dependence, data access concerns | Small and medium enterprises |
| **Hybrid** | Internal team for context + MSSP for night shifts | Coordination, clear boundaries of responsibility | The most common model |
| **Virtual / distributed** | Flexible, no physical room | Requires good collaboration tools | Cloud-native companies |

Typical roles: **Tier 1** analyst (alert triage), **Tier 2** (deeper analysis, IR), **Tier 3** (threat hunting, forensics, detection engineering), SOC manager, detection engineer, threat intel analyst.

SOC success measures:

| Metric | Meaning |
|---|---|
| **MTTD** (mean time to detect) | Average time from the start of an attack to detection |
| **MTTR** (mean time to respond / recover) | Average time to containment or recovery |
| False positive rate | Share of alerts that are not real incidents (analyst fatigue, alert fatigue) |
| Log source coverage | How many critical systems send logs to the SIEM |
| Technique coverage | How many techniques from MITRE ATT&CK (Cloud matrix) have a detection |

If the SOC is outsourced, accountability for decisions remains with the organization. The contract must define SLAs for triage and escalation, who may take containment actions, where logs are stored, and how the MSSP accesses data.

## Intelligent monitoring of security controls (5.6)

"Intelligent monitoring" means that controls are not only deployed, but their operation and state are continuously monitored, correlated, and improved, increasingly with the help of analytics and AI.

| Control | Function | Cloud form | What to monitor |
|---|---|---|---|
| **Firewall** | Rule-based traffic filtering | Cloud-native firewall (AWS Network Firewall, Azure Firewall), NGFW appliance, **WAF** for L7 | Rule hits, rule changes, "any-any" rules |
| **Network security groups / security groups** | Stateful filtering at the instance or network interface level | Security group (AWS), NSG (Azure), firewall rules (GCP) | Ports open to 0.0.0.0/0, deviation from the baseline (drift), flow logs |
| **IDS** | Detection and alerting (passive) | Traffic mirroring to a sensor, managed threat detection (GuardDuty, Defender for Cloud) | Signature quality, false positives |
| **IPS** | Detection and blocking (inline) | Inline appliance, IPS module of a cloud firewall | False positives blocking legitimate traffic, latency |
| **Honeypot / honeynet / honeytoken** | A decoy that legitimate users don't use, so any access is suspicious | Fake instance, fake access key (canary token), fake database record | Every access = high-confidence alert |
| **AI / ML analytics** | Anomaly detection, UEBA, correlation, analyst assistance | Built into SIEM/XDR, generative assistants for investigation | Model quality, explainability, false negatives, model drift |

Important nuances:

- **IDS vs IPS**: an IDS only alerts, an IPS blocks. An IPS in an inline position can disrupt business on a false positive; that is why new rules are often introduced first in detection mode.
- **Signature-based vs anomaly/behavior-based**: signatures detect the known (few false positives, can't see zero-days), anomaly detection finds deviations from normal (sees the new, more false positives).
- A **honeypot** must be isolated and serves detection, never "hacking back". The legal issue is entrapment (inducement): a honeypot waits passively, it does not invite the attacker.
- **AI in the SOC** reduces analyst fatigue (alert grouping, incident summaries, query suggestions), but high-impact decisions still require a human (human in the loop). AI systems themselves become subjects of monitoring: prompt injection, data leakage through the model, unreliable outputs.
- **Monitoring controls also means monitoring configuration**: CSPM (cloud security posture management) tools detect misconfigured controls, and control changes go through change management.

> **On the exam:** if a question asks for the control with the **fewest false positives** for detecting an insider or lateral movement, think of a **honeytoken / honeypot**: legitimate users don't touch it. If it asks for the attack to be **stopped automatically**, that is an IPS (or a WAF in block mode), not an IDS.

## Log capture and analysis (5.6)

| Term | What it is |
|---|---|
| **Log management** | Collecting, normalizing, storing, protecting, and deleting logs in accordance with the retention policy |
| **SIEM** (Security Information and Event Management) | Centralizes logs, correlates events from multiple sources, generates alerts, supports investigation and compliance reporting |
| **SOAR** (Security Orchestration, Automation and Response) | Playbooks that automate response (enrichment, isolation, ticketing) |
| **XDR** | Integrated detection and response across endpoint, identity, e-mail, and cloud, usually from a single vendor |
| **Threat intelligence** | Context about threats: indicators (IoC), tactics and techniques (TTP), actors; strategic, tactical, operational, technical |
| **UEBA** | User and entity behavior analytics (anomalies in logins, data access) |

### What to log in the cloud

| Layer | Examples | Why |
|---|---|---|
| Control plane / management | AWS CloudTrail, Azure Activity Log, GCP Cloud Audit Logs | Who changed infrastructure, IAM, keys |
| Identity | Logins, MFA, token issuance (Entra ID sign-in logs, IdP logs) | Compromised accounts are the most common vector |
| Network | VPC / NSG flow logs, DNS logs, firewall and WAF logs | Exfiltration, C2, scanning |
| Data plane | Object access (S3 data events), databases, keys (KMS) | Who read sensitive data |
| Workload | OS logs, application logs, Kubernetes audit log, container logs | Behavior inside the system |
| SaaS | SaaS application audit logs | An often forgotten source |

Good practices:

- **Centralization** in a separate account with restricted access (an attacker who compromises a workload must not be able to delete logs).
- **Integrity**: log file integrity validation (e.g., CloudTrail log file validation), WORM storage, hash chains.
- **Time synchronization** and format normalization (e.g., OCSF, ECS) for correlation.
- **Retention** according to legal, contractual, and business requirements (e.g., PCI DSS requires one year of history, three months of which immediately available).
- **Privacy**: logs contain personal data (IP addresses, usernames) and are subject to GDPR: minimization, need-based access, defined retention.
- **Costs**: logging everything is expensive; sources that cover likely attack scenarios take priority (use case approach).

### Threat intelligence

| Level | Audience | Example |
|---|---|---|
| **Strategic** | Management, risk management | Trends: ransomware groups target SaaS backups |
| **Operational** | IR team | An ongoing campaign against the sector, the actor's modus operandi |
| **Tactical** | SOC, detection engineering | TTPs per MITRE ATT&CK, e.g., abuse of OAuth applications |
| **Technical** | Tools (SIEM, firewall) | IoCs: IP addresses, domains, hashes; exchange via **STIX/TAXII** |

Sources: commercial feeds, CSPs (built into managed detection), CERTs, sector **ISACs**, open source. Value grows with context: IoCs without relevance to your environment only create noise.

## Incident Response (5.6)

The most frequently cited framework is NIST SP 800-61. Revision 3 (April 2025) aligns IR with the NIST CSF 2.0 functions (Govern, Identify, Protect, Detect, Respond, Recover), but exam questions still often use the classic cycle from revision 2:

| Phase (800-61r2) | Activities | Cloud specifics |
|---|---|---|
| **Preparation** | Plan, team, tools, training, exercises (tabletop) | IR roles in all accounts, forensic account, contracted CSP cooperation, logs |
| **Detection & Analysis** | Triage, validation, assessment of scope and severity | Correlation of control plane and workload logs, assessing whether the CSP or only the tenant is affected |
| **Containment, Eradication & Recovery** | Isolation, removal of the cause, restoration | Isolation via security groups and policies, revocation of tokens and keys, redeploy from IaC instead of "cleaning" |
| **Post-Incident Activity** | Lessons learned, report, control improvement | Updating detections and guardrails, reviewing the contract with the CSP |

Key cloud decisions during IR:

- **Shared responsibility determines who is responsible**: an incident in the hypervisor is handled by the CSP, a misconfigured bucket is the customer's problem.
- **Immutable infrastructure** eases recovery: the compromised resource is replaced with a new one from a verified template, and the old one is kept as evidence.
- **Identity is the new perimeter**: containment often means revoking sessions, rotating keys, and blocking accounts, not just network isolation.
- **Communication** per 5.5: legal, regulator, customers, CSP.
- **Severity classification** defined in advance (e.g., P1 to P4) with escalation rules.

> **On the exam:** distinguish an **event** (any observable occurrence), an **alert** (an event flagged by a tool), an **incident** (an event that threatens confidentiality, integrity, or availability and requires a response), and a **breach** (an incident with confirmed unauthorized access to data, which triggers legal notification obligations). A wrongly declared breach and a missed notification both have consequences.

## Vulnerability assessment and penetration testing (5.6)

| Criterion | **Vulnerability assessment** | **Penetration testing** |
|---|---|---|
| Goal | Find and prioritize known vulnerabilities | Prove that vulnerabilities can be exploited and what the real impact is |
| Method | Mostly automated scanning | Manual + tools, creative chaining of weaknesses |
| Depth | Broad, shallow | Narrow, deep |
| Frequency | Continuous or frequent (weekly, monthly, with every change) | Periodic (annually, after major changes) or as required by regulation |
| Risk to the system | Low | Higher (possible outages) |
| Output | List of vulnerabilities with a CVSS score | Report on attack paths, evidence, recommendations |

### Cloud specifics

- **CSP policy**: every major provider has a penetration testing policy. Some allow testing of certain services without prior approval, but prohibit e.g. DoS tests, testing other tenants' infrastructure, or the provider itself. **Always check and respect the policy and the contract first.**
- **You don't test what you don't own**: in SaaS, the customer is usually not allowed to test the provider's application; it relies on reports (SOC 2, ISO 27001, CSA STAR) and the right to audit from the contract.
- **Written authorization** (rules of engagement): scope, time frame, contacts, what is prohibited, how found data is handled.
- **Agent-based vs agentless scanning**: agentless (snapshot-based) scanners read the disk without installing an agent and cover short-lived resources; agents give more detail in real time.
- **Coverage of the whole stack**: container images (in the registry and at runtime), IaC templates (before deployment), serverless packages, configuration (CSPM), dependencies (SCA).
- **Risk-based prioritization**: CVSS is severity, while risk takes into account exposure (publicly reachable?), exploitation in the wild (e.g., the CISA KEV catalog, EPSS), and the value of the resource.
- **Test types** by tester knowledge: **black box** (no information), **gray box** (partial), **white box** (full access to code and architecture). Red team / blue team / purple team exercises test detection and response too, not just vulnerabilities.

> **On the exam:** an organization wants to test its IaaS environment. What FIRST? **Review the CSP's penetration testing policy and the contract** and obtain written authorization. Testing without that can breach the contract, affect other tenants, and be illegal.

## Who does what: roles in security operations

| Activity | Cloud customer | Cloud provider | Third party |
|---|---|---|---|
| Monitoring configuration, identities, and workloads | Responsible | Provides tools and logs | MSSP under contract |
| Monitoring physical infrastructure and the hypervisor | Cannot see | Responsible | Auditor verifies (SOC 2, ISO 27001) |
| Collecting evidence from the guest OS (IaaS) | Responsible | Does not access customer data | Forensic firm under authorization |
| Evidence from the provider's infrastructure | Requests per the contract | Collects per its own procedure | Authority via a court order |
| Pentest of own resources | Responsible, subject to the CSP policy | Defines the rules | Tester with written authorization |
| Notifying the regulator of a personal data breach | Responsible as controller | Notifies the controller without undue delay | Legal counsel assists |

### Scenario: a communication plan for a cloud incident

A fintech company in the EU uses IaaS and several SaaS services. The communication plan contains:

1. **A contact matrix**: internal IR team, management, legal, DPO, PR, CSP security contacts, MSSP, insurer, key partners.
2. **Triggers**: which type of incident activates which group (e.g., a personal data breach activates the DPO and legal; a major ICT-related incident activates the DORA reporting process).
3. **Deadlines**: internal (e.g., escalation to management within 1 hour for P1) and legal (GDPR, DORA, NIS2 where applicable).
4. **Message templates**: for the regulator, customers, partners, and media, reviewed in advance by legal.
5. **Channels**: primary and out-of-band (e.g., a separate collaboration tenant, a phone tree).
6. **Approvals**: who approves external messages (usually legal and management).
7. **Record**: a communication log during the incident, which later serves as proof of compliance.

The plan is tested in a tabletop exercise at least once a year, including a scenario in which the incident originated at the provider rather than at the company.

## Putting it together: the flow of one incident

1. A **honeytoken** (a fake access key in a repository) is used; the SIEM raises a high-confidence alert.
2. SOC Tier 1 validates and escalates to Tier 2; the incident is classified as P2.
3. The IR team revokes the related credentials, analyzes control plane logs, and determines that the attacker did not access data.
4. The forensic examiner exports the relevant logs to the forensic account, hashes them, and records them in the chain of custody.
5. Legal assesses that there is no personal data breach, so there is no notification obligation under GDPR, but the organization, as a NIS2 entity, assesses whether the incident is significant (significant incident).
6. Lessons learned: secrets removed from the repository, secret scanning introduced in CI/CD, a new detection in the SIEM.

## Typical exam traps

| The offered answer sounds good | Why it is often wrong | Better choice |
|---|---|---|
| "Immediately shut down the compromised instance" | Memory and state are lost | Isolate, collect evidence, then shut down |
| "Request the physical disk from the CSP" | Multitenancy, the CSP doesn't do that | Snapshot / export via API, contracted cooperation |
| "The provider reports the breach to the regulator" | The controller is the customer | The controller reports, the CSP notifies the controller |
| "The IDS will stop the attack" | An IDS only alerts | IPS or WAF in block mode |
| "Test the provider's SaaS application" | It isn't yours, it breaches the contract | Request reports (SOC 2, ISO, STAR) and the right to audit |
| "Outsource the SOC and thereby transfer responsibility" | Accountability is not transferred | Contract, SLA, oversight of the MSSP |

## Summary

- Cloud forensics is constrained by multitenancy, lack of physical access, volatility, and the service model; the higher the model (SaaS), the fewer artifacts the customer has and the more it depends on the **contract** with the CSP.
- Process: identification, collection/acquisition, preservation (ISO/IEC 27037), then examination, analysis, and reporting (ISO/IEC 27042, NIST SP 800-86). Analysis on a copy, hash, **chain of custody**, order of volatility, **forensic readiness**.
- A compromised resource is first **isolated** and evidence is taken from it, and only then is it shut down or deleted.
- Communication with vendors, customers, partners, regulators, and other stakeholders follows the plan, with legal, need to know, and legal deadlines (GDPR 72 h, NIS2 24/72 h).
- A SOC can be internal, outsourced, or hybrid; accountability stays with the organization. Metrics: MTTD, MTTR, false positives, coverage.
- Controls (firewall, NSG, IDS/IPS, honeypot, AI) are monitored and continuously improved; an IDS alerts, an IPS blocks, a honeytoken gives a high-confidence alert.
- SIEM centralizes and correlates logs, SOAR automates response, threat intelligence provides context (strategic to technical, STIX/TAXII).
- IR per NIST SP 800-61; in the cloud, identity, shared responsibility, and immutable infrastructure are decisive.
- Vulnerability assessment is broad and frequent, a pentest narrow and deep; in the cloud, first the CSP policy, the contract, and written authorization.
