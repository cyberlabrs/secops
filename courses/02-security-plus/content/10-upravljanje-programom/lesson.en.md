## Exam objectives

This module covers all of **domain 5** (*Security Program Management and Oversight*), objectives **5.1 through 5.6**:

- **5.1** GRC artifacts (policies, standards, procedures, guidelines, plans)
- **5.2** risk management, including calculating **SLE, ALE, and ARO**
- **5.3** third-party risk (vendor selection, agreements, monitoring)
- **5.4** elements of compliance and privacy rights
- **5.5** audits, assessments, and penetration testing
- **5.6** the security awareness program

This is the "management" domain. Questions are often about definitions, but set in a scenario: you need to recognize which document, agreement, or risk treatment fits the description. For a DevOps engineer, this is the world where the requirements you later implement in Terraform and the pipeline come from.

## 5.1 GRC artifacts

**GRC** (*governance, risk, compliance*) artifacts are the documents through which an organization defines what it does in security and how. The key is to distinguish how mandatory and how detailed they are.

| Artifact | Mandatory? | Level of detail | Answers the question |
|---|---|---|---|
| **Policy** | Yes | High level, approved by management | **What** and **why** |
| **Standard** | Yes | Specific requirements | **What exactly** (which value, which technology) |
| **Procedure** | Yes | Step by step | **How** |
| **Guideline** | No (recommendation) | Advice, best practice | **How it would be good to do it** |
| **Plan** | Yes, for a specific event | Roles, steps, contacts | **What we do when X happens** |

An example chain: the *policy* says "data at rest must be encrypted"; the *standard* says "AES-256, keys in KMS, rotated annually"; the *procedure* describes the steps for enabling encryption on a new RDS instance; the *guideline* recommends using the platform team's Terraform module.

### Guidelines

| Type | Example |
|---|---|
| **Benchmarks** | CIS Benchmarks for Linux, Kubernetes, AWS |
| **Advisories** | Security alerts from vendors or agencies (e.g., a CISA advisory about an actively exploited vulnerability) |
| **Implementation guides** | Vendor guides for secure installation and configuration |
| **Reference architecture** | A proven architecture pattern (e.g., AWS Security Reference Architecture, landing zone) |

### Standards

| Type | Example |
|---|---|
| **Baselines** | The minimum security configuration for a system type (hardened AMI, golden image) |
| **Passwords** | Length, complexity, MFA, password management (modern guidance favors length and checking against leaked passwords over frequent mandatory changes) |
| **Physical security** | Entry control, cameras, locking server rooms |
| **RFC** (*request for comments*) | Internet standards published by the IETF (e.g., TLS 1.3 is RFC 8446) |
| **Encryption** | Allowed algorithms, key lengths, key management |

### Procedures

- **SOP** (*standard operating procedure*): a formally documented, repeatable process for routine work (e.g., user onboarding, a firewall rule change).
- **Runbook**: concrete steps for a specific operational situation, often partly automated (e.g., "pod in CrashLoopBackOff," "isolating a compromised EC2 instance"). In the SOC, automated runbooks are run through SOAR.

### Plans

- **Business continuity plan (BCP)**: how the business keeps operating during a disruption.
- **Disaster recovery plan (DRP)**: how IT systems and data are restored.

### Policies

| Policy | Contents |
|---|---|
| **Information security policy** | The umbrella policy: goals, roles, responsibilities of the security program |
| **Acceptable use policy (AUP)** | What employees may and may not do with company resources (internet, email, AI tools) |
| **BYOD** | Rules for personal devices: MDM, separation of business data, remote wipe |
| **Clean desk** | No sensitive papers or unlocked screens when leaving the workspace |
| **Incident response** | Authority, roles, and obligations during an incident |
| **Data classification and retention** | Data classes and how long they're kept |
| **Access control** | How rights are granted, reviewed, and revoked (least privilege, access review) |
| **Data disposal** | How data and media are securely destroyed |
| **Vulnerability disclosure** | How outside researchers report vulnerabilities (contact, `security.txt`, rules, safe harbor) |
| **Privacy** | How the organization collects, uses, and protects personal data |

> **On the exam:** A policy is **mandatory and general**, a standard is **mandatory and specific**, a procedure is **step by step**, a guideline is a **recommendation**. If the question says "a document that recommends but doesn't mandate," the answer is **guideline**. If it says "all passwords must be at least 14 characters," that's a **standard**.

## 5.2 Risk management

### Process

1. **Risk identification**: **asset identification** (what we have and what it's worth) and **stakeholder ownership** (who owns the asset and the risk).
2. **Risk assessment**: **scoring** (a rating, e.g., 1–5 for likelihood and impact) and **categorization** (operational, financial, legal, technical, reputational risk).
3. **Risk analysis**: **impact**, **likelihood/probability**, **owner** (risk owner), **current mitigations** (existing controls). It can be qualitative or quantitative.
4. **Risk treatment**: what we do with the risk.
5. **Tracking** through the **risk register**.

### Qualitative vs quantitative analysis

| | **Qualitative** | **Quantitative** |
|---|---|---|
| Expressed as | Categories: low/medium/high, a likelihood × impact matrix (heat map) | Money and numbers: SLE, ALE, ARO |
| Advantage | Fast, doesn't need precise data | Enables cost-benefit analysis of controls |
| Disadvantage | Subjective | Requires reliable data that's hard to obtain |

### SLE, ARO, ALE

| Term | Meaning | Formula |
|---|---|---|
| **AV** (*asset value*) | The value of the asset | |
| **EF** (*exposure factor*) | The percentage of value lost in one event | 0–100% |
| **SLE** (*single loss expectancy*) | The loss from **one** event | **SLE = AV × EF** |
| **ARO** (*annualized rate of occurrence*) | How many times **per year** we expect the event | 0.25 = once every 4 years |
| **ALE** (*annualized loss expectancy*) | The expected **annual** loss | **ALE = SLE × ARO** |

**Example 1.** A laptop is worth €2,000, theft means a total loss (EF = 100%), and the company loses 12 laptops a year (ARO = 12).

- SLE = €2,000 × 1.0 = €2,000
- ALE = €2,000 × 12 = €24,000

**Example 2.** A data center is worth €500,000. A flood would destroy 40% of it (EF = 0.4). A flood is expected once every 20 years (ARO = 0.05).

- SLE = €500,000 × 0.4 = €200,000
- ALE = €200,000 × 0.05 = €10,000

**Control cost-benefit.** If flood protection costs €15,000 per year and the ALE is €10,000, the control costs more than it protects, so it's more reasonable to **transfer** (insurance) or **accept** the risk. Value of a control = ALE before − ALE after − annual cost of the control.

> **On the exam:** Watch out for ARO given as "once every N years": ARO = 1/N. "Once every 5 years" is 0.2, not 5. SLE is for **one** event, ALE for **a year**. If the question gives AV and EF, calculate the SLE first.

### Risk register

The **risk register** is the central record of risks: description, category, owner, likelihood, impact, score, existing controls, treatment plan, status, deadline. Key activities from the objectives:

- **Communication**: the register is a tool for communicating risk to management and owners.
- **Reviews**: regular updates (risks change, controls get introduced).

**KRIs** (*key risk indicators*) are often tracked too: metrics that warn that a risk is growing.

### Risk treatment

| Treatment | Description | Example |
|---|---|---|
| **Mitigating** | Reduce likelihood or impact with controls | MFA, WAF, backups |
| **Transferring** | Shift the financial burden to a third party | Cyber insurance, an outsourcing contract with liability |
| **Avoiding** | Stop the activity that carries the risk | Shut down an outdated service, don't enter a risky market |
| **Accepting** | Consciously accept the risk (usually when it's within appetite or the control is too expensive) | A formal **exception/exemption** signed by the risk owner, with a deadline |

> **On the exam:** Insurance is **transfer**, but only of the financial part; reputational damage and accountability for data remain. Shutting down functionality is **avoid**. If the cost of a control exceeds the ALE, the typical answer is **accept** (or transfer).

### Business considerations

| Term | Meaning |
|---|---|
| **Business impact analysis (BIA)** | Identifies critical business functions and the impact of their disruption over time, and derives the RTO, RPO, and recovery priorities from that |
| **Risk appetite** | How much risk the organization **wants** to take on to achieve its goals (e.g., *expansionary* = more risk-seeking, *conservative* = cautious, *neutral*) |
| **Risk tolerance / threshold** | The acceptable deviation and the limit above which a risk must be treated |
| **Inherent risk** | Risk before controls |
| **Residual risk** | The risk that **remains after** controls are applied; it should be within appetite |
| **Stakeholder involvement** | Involving process owners, the legal team, and IT in risk decisions |
| **Management oversight** | Management (and the board) oversees and is accountable for risk decisions |
| **Regulatory** and **Legal** | Regulations and contracts can impose controls regardless of appetite |

## 5.3 Third-party risk

Vendors (SaaS, cloud, MSPs, outsourcing) have access to data and systems, so their risk becomes yours. Supply chain attacks are a common path to compromise.

### Vendor selection

| Document | Purpose |
|---|---|
| **RFI** (*request for information*) | Early stage: gathering general information about vendors' capabilities |
| **EOI** (*expression of interest*) | Vendors express interest in a project; used to narrow the list before the formal process |
| **RFP** (*request for proposal*) | A detailed request: the vendor proposes a **solution**, approach, and price |
| **RFQ** (*request for quote*) | You already know the requirements; you ask for a **price** for an exactly defined product/service |

- **Due diligence**: vetting the vendor before the contract: financial stability, security practices (SOC 2 report, ISO 27001 certification, questionnaires), incident history, subcontractors, data location.
- **Conflict of interest**: the person selecting the vendor must not have a personal interest (e.g., a relative owns the company); it must be disclosed and the person recused.

### Agreement types

| Agreement | Contents | Binding? |
|---|---|---|
| **MSA** (*master services agreement*) | General framework terms for all future work (liability, payment, confidentiality) | Yes |
| **SOW** (*statement of work*) | Specific work under the MSA: scope, deliverables, deadlines, price | Yes |
| **SLA** (*service-level agreement*) | The required level of service and the consequences if it isn't met (e.g., a service credit) | Yes |
| **SLO** (*service-level objective*) | A specific measurable target within the SLA (e.g., 99.9% monthly availability, a P1 response within 15 min) | Part of the SLA |
| **NDA** (*non-disclosure agreement*) | An obligation to keep information confidential | Yes |
| **MOU** (*memorandum of understanding*) | A statement of shared intent and cooperation, usually **informal** and not legally binding | Mostly no |
| **MOA** (*memorandum of agreement*) | More formal than an MOU: defines the parties' roles and responsibilities in detail | More binding than an MOU |

> **On the exam:** **MSA = framework**, **SOW = a specific project** under the framework. **SLA = a promise with consequences**, **SLO = the number being measured**. An **MOU** is the loosest: intent, not obligation.

### Vendor monitoring

- **Right to audit**: a contract clause that gives you the right to check (or hire an auditor to check) the vendor's controls. Without it, you can't demand an audit.
- **Service-level monitoring**: tracking whether the SLA/SLOs are being met.
- **Vendor registry**: an inventory of all vendors, what they do, what data they access, their risk level.
- **Vendor assessment**: periodic assessment (questionnaires, evidence, reviews).
- **Compliance attestation**: the vendor demonstrates compliance (e.g., a SOC 2 Type II report, ISO 27001 certification, PCI DSS AOC).
- **Penetration testing**: a pen test of the vendor's system or the results of their independent test.

### Limitations/constraints

| Constraint | Example |
|---|---|
| **Staffing limitations** | Not enough people to assess every vendor |
| **Resource availability** | Budget, tools, time |
| **Environment** | The vendor operates in an environment you can't inspect (a large cloud provider doesn't allow physical audits) |
| **Legal and regulatory factors** | Regulations restrict what you may share or where |
| **Geography/jurisdiction** | A vendor in another country is subject to different laws |
| **Financial/ROI** | The assessment costs more than it's worth for a small vendor |
| **Vendor lock-in** | Changing vendors is hard and expensive (proprietary formats, APIs) |
| **Assurance mechanisms** | Relying on certifications and reports instead of direct verification, with their limitations |

### Rules of engagement

**Rules of engagement (RoE)** define the rules for testing or cooperation: what's in **scope**, which techniques are allowed or forbidden (e.g., no DoS, no social engineering), time windows, escalation contacts, handling of discovered data, and legal authorization. Without a signed RoE, a pen test can be a criminal offense.

## 5.4 Compliance

### Compliance training

- **Data handling**: how to handle classified and personal data.
- **AML/CTF** (*anti-money laundering / counter-terrorism financing*): recognizing suspicious transactions and the obligation to report them (banks, fintech, crypto).
- **Anti-bribery**: a ban on giving and accepting bribes (e.g., the US FCPA, the UK Bribery Act).

### Compliance monitoring

- **Attestations**: a formal statement (often signed by management or an independent auditor) that requirements are met.
- **Acknowledgements**: employees confirm they've read and understood a policy (e.g., the AUP at hiring and annually).

Automation in the cloud: AWS Config rules, Azure Policy, Security Hub standards, continuous compliance measurement.

### Consequences of non-compliance

| Consequence | Example |
|---|---|
| **Reputational damage** | Loss of customer trust after a public incident |
| **Financial** | Regulatory fines (GDPR fines can be a percentage of global turnover) |
| **Legal** | Lawsuits, criminal liability |
| **Contractual** | Contract termination, penalties toward partners |
| **Sanctions** | Measures by regulators or governments, a ban on doing business with certain parties |
| **Loss of license** | Loss of the license to operate (bank, hospital) or the right to process cards |

### Privacy

| Right / term | Meaning |
|---|---|
| **Right to be forgotten** | The right to have personal data erased when there's no longer a basis for processing (the GDPR "right to erasure") |
| **Opt-in / opt-out** | Opt-in: processing only after active consent; opt-out: processing until the person objects |
| **Data correction** | The right to have inaccurate data corrected |
| **Processing restrictions** | The right to have processing restricted (data is kept but not used), e.g., while a dispute over accuracy is resolved |
| **Processing prevention** | The right to prevent (object to) certain processing, e.g., direct marketing |
| **Controller vs. processor** | The controller determines the purpose and means of processing and is accountable; the processor processes on the controller's instructions |
| **Ownership** | Who "owns" the data; the subject has rights over their personal data even when a company holds it |

### Legal compliance

- **Legal hold**: an order (from the legal team because of a dispute or investigation) to **preserve and not delete** relevant data, even if the retention policy would otherwise delete it. In the cloud: S3 Object Lock legal hold, Microsoft 365 litigation hold.
- **Legal orders**: court orders, subpoenas, requests from authorities to hand over or preserve data.
- **Data retention requirements**: regulations that set the minimum (and sometimes maximum) retention period (e.g., financial records).

> **On the exam:** If a company expects a lawsuit and needs to prevent emails from being deleted, the answer is **legal hold**, which takes precedence over the regular retention policy. A user asking for their data to be deleted is exercising the **right to be forgotten**.

## 5.5 Audits and assessments

### Data gathering

| Method | Description |
|---|---|
| **Sampling** | Reviewing a representative sample (e.g., 25 of 1,000 changes) instead of everything |
| **Questionnaires/surveys** | Questionnaires for a larger number of people or vendors |
| **Interviews** | Conversations with process owners and administrators |
| **Assertion** | Management's claim that a control exists and works, which the auditor then verifies with evidence |
| **Reference sources** | Frameworks for structuring threat analysis |

**Reference sources**:

| Model | What it's for |
|---|---|
| **MITRE ATT&CK** | A knowledge base of **tactics** (the attacker's goal, e.g., persistence) and **techniques** (how, e.g., scheduled task) based on real attacks; used for mapping detections and gap analysis |
| **Cyber Kill Chain** (Lockheed Martin) | Seven attack phases: Reconnaissance, Weaponization, Delivery, Exploitation, Installation, Command and Control (C2), Actions on Objectives. Defense tries to break the chain as early as possible. |
| **Diamond Model of Intrusion Analysis** | Describes every event through four vertices: **adversary**, **capability**, **infrastructure**, **victim**, and their relationships |

### Scoping

- **Audit charter**: a formal document that gives the audit function its **authority** and defines its purpose, scope, responsibilities, and to whom it reports (usually the audit committee).
- **Frequency**: how often audits are performed (annually, quarterly, continuously), based on risk and regulations.

### Engagement types

| Type | Description |
|---|---|
| **Gap analysis** | Comparing the current state with the target state (e.g., ISO 27001 or NIST CSF) and listing the gaps |
| **Internal: compliance** | An internal team checks compliance with policies and regulations |
| **Internal: audit committee** | A committee (usually part of the board) that oversees audits and reporting |
| **Internal: self-assessments** | Teams assess their own controls (e.g., a questionnaire for each team) |
| **External: examinations** | A formal review by an outside party, often a regulator |
| **External: assessments** | An external assessment of controls or risks |
| **External: regulatory** | An audit mandated by a regulator (e.g., a banking supervisor) |
| **External: independent third-party audits** | An independent auditor (e.g., SOC 2, an ISO 27001 certification audit) |
| **Benchmarking** | Comparison with the industry or with other organizations |

### Penetration testing

| Type | What the tester knows |
|---|---|
| **Known environment** (formerly *white box*) | Everything: architecture, code, credentials |
| **Partially known environment** (*gray box*) | Some information, e.g., a user account |
| **Unknown environment** (*black box*) | Nothing but the target; simulates an outside attacker |

| Type | Description |
|---|---|
| **Physical** | Testing physical security: getting into the building, tailgating, locks |
| **Offensive** | The attacking team (**red team**) |
| **Defensive** | The defending team (**blue team**) detects and responds |
| **Integrated** | Red and blue work together and share findings (**purple team**) |

**Reconnaissance**:

- **Passive**: without direct contact with the target: OSINT, DNS records from public sources, certificate transparency logs, LinkedIn, Shodan.
- **Active**: direct interaction: port scanning (nmap), banner grabbing, service enumeration. It can be detected.

> **On the exam:** If the tester receives network documentation and code, it's a **known environment**. If they search public records without sending packets to the target, it's **passive reconnaissance**. Red + blue together is **integrated** (purple).

### Frameworks and standards

| Category | Example |
|---|---|
| **Industry-based standards** | PCI DSS (card industry), NERC CIP (energy) |
| **International standards** | ISO/IEC 27001, ISO/IEC 27002 |
| **Region-specific standards** | GDPR and NIS2 (EU), regulations of individual countries |

### Functional and behavioral testing

- **Functional testing**: verifying that a control **works as designed** (e.g., whether MFA really blocks a sign-in without the second factor, whether a backup can be restored).
- **Behavioral testing**: checking the **behavior of people** (or systems) under real conditions, e.g., a phishing simulation, a test of whether employees will let an unknown person into the building.

## 5.6 Security awareness

### Training types

| Type | When |
|---|---|
| **Initial/onboarding** | At hiring, before access to systems |
| **Ongoing** | Regularly (annually, quarterly, micro-lessons) |
| **Targeted** | For specific roles or high-risk groups (finance for BEC, developers for secure code, admins) |
| **Corrective** | After a mistake or incident, e.g., a user clicked on a simulated phishing email |

### Delivery mechanisms

- **LMS** (*learning management system*): a platform for courses, completion tracking, and tests.
- **Self-service portals**: materials and tools users access on their own when needed (knowledge base, a "report phishing" button).
- **One-to-one**: individual training or mentoring (e.g., a corrective conversation).
- **One-to-many**: a lecture, webinar, or workshop for a group.

### Measuring effectiveness

- **Metrics**: click rate and (more importantly) **report rate** in phishing simulations, time to report, training completion rate, number of incidents caused by human error.
- **Managerial reports**: reports to managers on the state of their teams.
- **Personnel behavior risk scoring**: rating an individual's risk based on behavior (repeated clicks, ignoring warnings, risky activities) to direct targeted training.

### Training topics

| Topic | Key message |
|---|---|
| **Social engineering** | Phishing, vishing, smishing, pretexting; verify through another channel |
| **Emerging security topics** | New threats: deepfake voice and video, AI-generated phishing, QR phishing |
| **Password and credential management** | A password manager, MFA, no password reuse, passkeys |
| **Remote work/teleworking/hybrid** | A secure home network, VPN/ZTNA, public Wi-Fi, screen privacy |
| **BYOD** | Rules for personal devices, MDM, data separation |
| **Business email compromise (BEC)** | Fake payment orders from a compromised or spoofed executive/vendor account; always confirm an account change by phone at a known number |
| **Removable media and cables** | Don't plug in USB devices you find; malicious cables can contain an implant that poses as a keyboard |
| **Situational awareness** | Watch who's behind you (shoulder surfing), who follows you in (tailgating), unusual situations |
| **Operational security (OPSEC)** | Don't post details about systems, projects, or executives' travel on social media |

> **On the exam:** If finance users are the target of fake requests to change a vendor's bank account, the best measure is **targeted training on BEC** along with a phone verification procedure. If you're asked which metric best shows the program's success, an **increase in the phishing report rate** is a stronger indicator than a drop in clicks alone.

## Summary

- **Policy** (what, mandatory) → **standard** (specific requirements) → **procedure** (how, SOP/runbook); a **guideline** is a recommendation; a **plan** is for a specific event (BC, DR).
- Risk: identification → assessment → analysis → treatment → register. Treatments: **mitigate, transfer, avoid, accept**.
- **SLE = AV × EF**, **ALE = SLE × ARO**; an ARO of "once every N years" = 1/N. A control makes sense if the reduction in ALE exceeds its annual cost.
- **Residual risk** remains after controls and must be within the **risk appetite**; the **BIA** provides critical functions, RTO, and RPO.
- Vendors: RFI → (EOI) → RFP/RFQ, due diligence; **MSA** framework, **SOW** work, **SLA/SLO** service level, **NDA**, **MOU/MOA**; the **right to audit** must be in the contract.
- Privacy: right to be forgotten, opt-in/opt-out, correction, restriction and prevention of processing; a **legal hold** takes precedence over the retention policy.
- Audit: sampling, interviews, assertions; ATT&CK, Kill Chain, Diamond Model; known/partially known/unknown pen tests; passive vs active recon.
- Awareness: onboarding, ongoing, targeted, corrective; measured by report rate and risk scoring; BEC and deepfakes are key topics.
