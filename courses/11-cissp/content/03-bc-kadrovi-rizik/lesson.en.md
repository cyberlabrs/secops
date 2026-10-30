## Exam objectives: 1.7, 1.8 and 1.9

- **1.7 Identify, analyze, assess, prioritize, and implement Business Continuity (BC) requirements**
  - Business Impact Analysis (BIA)
  - External dependencies
- **1.8 Contribute to and enforce personnel security policies and procedures**
  - Candidate screening and hiring
  - Employment agreements and policy driven requirements
  - Onboarding, transfers, and termination processes
  - Vendor, consultant, contractor agreements and controls (e.g., Service-Level Agreements (SLA))
- **1.9 Understand and apply risk management concepts**
  - Threat and vulnerability identification
  - Risk analysis, assessment, and scope
  - Risk response and treatment (e.g., cybersecurity insurance, risk mitigation strategies)
  - Applicable types of controls (e.g., preventive, detection, corrective)
  - Control assessments (e.g., security and privacy)
  - Continuous monitoring and measurement
  - Reporting (e.g., internal, external)
  - Continuous improvement (e.g., maturity modeling)
  - Risk frameworks (ISO, NIST, COBIT, SABSA, PCI, HIPAA)

In the 2024 outline, the vendor sub-item did not mention SLAs, risk treatment listed only cyber insurance as an example (without "risk mitigation strategies"), continuous improvement read "risk maturity modeling", and the list of risk frameworks did not include HIPAA.

This is the heart of the CISSP: almost every question in the other domains comes down to "which risk, to which asset, how much does it cost, what is a reasonable control".

> **On the exam:** risk assessment always starts from the **asset and its value** to the business. A control must not cost more than the value of the asset or the reduction in annual loss it delivers. And when human life is at stake, this calculation does not apply: the safety of people has absolute priority.

## Business continuity (1.7)

**Business Continuity Planning (BCP)** ensures that critical business functions continue to operate during and after a disruption. **Disaster Recovery Planning (DRP)** is the narrower, technical part: restoring IT systems and sites (in detail in module 14). Objective 1.7 focuses on **requirements**: identify, analyze, assess, prioritize, and implement.

### BCP phases (NIST SP 800-34 and the classic ISC2 approach)

| Phase | Content |
|---|---|
| 1. **Project scope and planning** | Analysis of the organization, selection of the BCP team (representatives of business units, IT, legal, HR, security, PR), resources, legal and regulatory requirements, **management support** (sponsor) |
| 2. **Business Impact Analysis (BIA)** | Identifying critical functions, the impact of disruption, and time objectives |
| 3. **Continuity planning** | Strategies (preventive and recovery), developing plans, securing resources |
| 4. **Approval and implementation** | Management approval, training, testing, maintenance |

Standards: **ISO 22301** (BCMS, business continuity management system, certifiable), **ISO 22313** (guidance), **NIST SP 800-34** (contingency planning for IT systems), **BCI Good Practice Guidelines**.

### Business Impact Analysis

The BIA answers the question: **what happens to the business if this function stops, and how long can we withstand it?** The BIA does not analyze threats (that is what risk assessment does), but the **impact** of losing a function.

| BIA step | What is done |
|---|---|
| Identifying business functions and processes | Interviews, questionnaires with process owners |
| Determining criticality | Which functions are key to the mission, the law, revenue, safety |
| Assessing impact over time | Financial (lost revenue, fines), operational, reputational, legal, impact on the safety of people |
| Determining time metrics | MTD, RTO, RPO, WRT |
| Identifying resources and dependencies | People, systems, data, sites, suppliers |
| Prioritizing recovery | Order of restoration by criticality |

### Time metrics

| Metric | Definition | Who determines it |
|---|---|---|
| **MTD** (Maximum Tolerable Downtime), also **MAD** (Maximum Allowable Downtime) or **MTPD** (Maximum Tolerable Period of Disruption) | The longest outage after which the damage is unacceptable or the organization cannot survive | The business (process owner, management) |
| **RTO** (Recovery Time Objective) | Target time for restoring a system / function after a disruption | The business with IT; must be shorter than the MTD |
| **WRT** (Work Recovery Time) | Time after technical restoration needed to verify data, test, and return to operation | IT and the business |
| **RPO** (Recovery Point Objective) | The maximum acceptable amount of lost data, expressed in time (e.g., 15 minutes) | The data owner; determines backup and replication frequency |
| **MTBF / MTTR** | Mean time between failures / mean time to repair | Component reliability |

Key relationship: **RTO + WRT ≤ MTD**.

#### Example

Online payments: management says that after 8 hours of outage customers move to the competition en masse and the regulator imposes a fine, so the **MTD = 8 h**. Verifying and reconciling transactions after restoration takes 2 h (**WRT = 2 h**), so the **RTO must be at most 6 h**. Losing more than 5 minutes of transactions is unacceptable, so the **RPO = 5 min**, which requires synchronous or near-synchronous replication, not a nightly backup.

| Function | MTD | RTO | RPO | Recovery priority |
|---|---|---|---|---|
| Online payments | 8 h | 6 h | 5 min | 1 |
| Card processing (POS) | 4 h | 3 h | 0 (no loss) | 1 |
| CRM | 3 days | 2 days | 24 h | 2 |
| Internal wiki | 2 weeks | 1 week | 1 week | 3 |

> **On the exam:** the MTD and RPO are set by the **business**, not by IT. If the RTO is longer than the MTD, the recovery strategy is inadequate. A smaller RPO and RTO mean a more expensive solution (hot site, synchronous replication), so the BIA justifies the cost.

### Quantitative and qualitative impact in the BIA

| Type of impact | Examples | Measurement |
|---|---|---|
| Quantitative | Lost revenue per hour, contractual penalties, regulatory fines, overtime | Money |
| Qualitative | Reputation, customer trust, employee morale, impact on the community | Scale (low/medium/high) |

### External dependencies

An organization depends on entities it does not control. The BIA must also map **external dependencies**:

| Dependency | Example | How it is mitigated |
|---|---|---|
| Utilities | Power, water, HVAC | UPS, generators, fuel delivery contracts, a second site |
| Telecommunications | ISP, mobile operator | Two ISPs with different physical paths (route diversity) |
| Cloud and SaaS providers | IdP, email, IaaS region | Multi-region, exit strategy, reviewing the providers' BC plans, SLA |
| Key suppliers | Chip manufacturer, logistics | Multiple suppliers, inventory, contractual continuity obligations |
| Public services | Emergency services, the central bank's payment system | Coordination, alternative procedures |
| People | Key personnel (single point of failure) | Deputies, rotation, documentation |

Dependencies are divided into **upstream** (those we depend on) and **downstream** (those that depend on us). Cascading failures (e.g., an identity provider outage disables all SaaS applications) are discovered only through mapping.

### Strategies and approval

The BIA is followed by **continuity strategies**: preventive measures (redundancy, resilience), recovery strategies (alternate site, manual procedures, working from home), and **prioritization of resources** based on the BIA results. The plan is approved by senior management; it must have an owner, contact lists, activation criteria, and regular testing (tabletop, simulation, parallel test, full interruption: module 14).

### Scenario

A regional bank depends on a single SaaS provider for core banking. The BIA shows an MTD of 4 h for payments. The provider's SLA guarantees 99.5% availability per month (up to about 3.6 h of outage per month), with no RTO commitment. The CISSP recommends: negotiate an SLA with RTO/RPO, the right to review the provider's BC plan and test results, a manual procedure for critical payments, and an exit strategy.

## Personnel security (1.8)

People are both the greatest asset and the greatest risk. Controls are applied throughout the entire **employment lifecycle**.

### Candidate screening and hiring

| Step | Content |
|---|---|
| **Job description** | Roles, responsibilities, access level, **position sensitivity classification** |
| **Candidate screening** | Verification of identity, education and certifications, previous employers, references, criminal record, credit history (for financial positions), social media check, drug testing; the depth depends on the sensitivity of the position |
| **Security clearance** | For government and military positions: a security vetting by the competent authority |
| **Lawfulness** | Checks must comply with labor law and privacy law, with the candidate's consent where required; discrimination is prohibited |

### Agreements and policy-driven requirements

| Document | Purpose |
|---|---|
| **Employment agreement** | Terms of employment, confidentiality obligations, IP (work for hire), non-compete where lawful |
| **NDA** (Non-Disclosure Agreement) | Protection of confidential information and trade secrets, also after employment ends |
| **NCA** (Non-Compete Agreement) | Restriction on working for a competitor; lawfulness depends on the jurisdiction |
| **AUP** (Acceptable Use Policy) | Rules for using systems; signed at hiring and periodically |
| **Code of conduct / ethics** | Expected behavior |

Administrative controls imposed by policy:

| Control | Purpose |
|---|---|
| **Separation of duties** | One person cannot perform a critical task alone (e.g., create a vendor and approve a payment) |
| **Job rotation** | Detects fraud and reduces dependence on one person; enables cross-training |
| **Mandatory vacation** | The employee is absent (e.g., two consecutive weeks), and the replacement uncovers hidden irregularities; a detective control |
| **Least privilege and need to know** | Minimum rights |
| **Dual control / two-person integrity** | Two people must perform an action together (e.g., opening a vault, accessing keys) |
| **Collusion** | Collusion is what SoD and rotation make necessary for fraud, and therefore harder |

### Onboarding, transfers, and termination

| Phase | Key controls |
|---|---|
| **Onboarding** | Creating the identity per procedure, role-based rights (RBAC), signing the NDA/AUP, security training before access, issuing equipment |
| **Transfer** (transfer, promotion) | Granting new rights and **revoking old ones** to prevent **privilege creep** (accumulation of rights); periodic access review |
| **Termination** | Revoking access **simultaneously** with notification (for a hostile termination, before or during the meeting), return of equipment and badges, changing shared passwords, an **exit interview** with a reminder of the NDA, escorting out of the building in a hostile termination, retaining user data according to policy |

> **On the exam:** at termination, access is revoked **at the moment** the termination is communicated (or immediately before), with HR and, if needed, security present. If a question offers "disable the account at the end of the week" or "after the exit interview", that is wrong.

### Vendors, consultants, and contractors

Third parties with access to systems pose the same risk as employees, but with less control. The contract is the main control.

| Element | Content |
|---|---|
| **SLA** (Service-Level Agreement) | Measurable commitments: availability (e.g., 99.9%), incident response time, RTO/RPO, penalties (service credits) for non-compliance |
| **SLR** (Service-Level Requirements) | The customer's requirements that go into the SLA |
| **OLA** (Operational-Level Agreement) | An internal agreement between teams that support the SLA |
| **MOU / MOA** | Memorandum of understanding; less formal, often between organizations or departments |
| **ISA** (Interconnection Security Agreement) | Technical and security conditions for connecting two networks |
| **MSA / SOW** | Master agreement / description of the specific work |
| **NDA** | Confidentiality |
| **Right to audit** | The right of the customer or an independent auditor to verify controls; alternatively a SOC 2 Type II report |
| **Incident reporting obligation** | Deadline and method (e.g., 24 h) |
| **Return and destruction of data** | At the end of the contract, with confirmation |

Controls for contractors: screening before engagement (in accordance with the contract), accounts with an expiration date, access through controlled channels (PAM, jump host), session monitoring, the same training requirements as for employees, revoking access when the work is completed.

#### Availability calculation in an SLA

| SLA availability | Allowed downtime per year | Per month (approx.) |
|---|---|---|
| 99% | 3.65 days | 7.3 h |
| 99.9% | 8.76 h | 43.8 min |
| 99.99% | 52.6 min | 4.4 min |
| 99.999% | 5.26 min | 26 s |

### Employee privacy and monitoring

The policy must explain monitoring in advance (banner, signed acknowledgment), and monitoring must be proportionate and lawful. Sanctions for policy violations must be consistent and documented.

## Risk management (1.9)

### Terminology

| Term | Definition |
|---|---|
| **Asset** | Anything of value to the organization (data, systems, people, reputation) |
| **Threat** | A potential cause of an unwanted incident (attacker, flood, error) |
| **Threat agent / actor** | The entity that carries out a threat |
| **Vulnerability** | A weakness that a threat can exploit |
| **Exposure** | Being exposed to loss due to a threat |
| **Risk** | The likelihood that a threat will exploit a vulnerability × impact; **Risk = Threat × Vulnerability (× Impact/Asset value)** |
| **Safeguard / countermeasure** | A control (before / after an incident, in the narrower ISC2 sense) |
| **Residual risk** | The risk that remains after controls |
| **Inherent risk** | Risk before any controls |
| **Total risk** | Threats × vulnerabilities × asset value (without controls) |
| **Controls gap** | The difference between total and residual risk: **Total risk − Controls gap = Residual risk** |
| **Risk appetite / tolerance / capacity** | How much risk the organization wants to take on to pursue its objectives / acceptable deviation / the maximum it can withstand |

### Threat and vulnerability identification

Sources: threat intelligence (ISACs, CERTs, vendors), incident history, threat modeling (module 4), vulnerability scanning, penetration testing, audit findings, CVE/NVD and the CISA KEV catalog, interviews with process owners. Threats are categorized as natural, human (intentional and unintentional), technical, and environmental.

### Scope and the assessment process

**Risk assessment** (NIST SP 800-30): prepare (purpose, **scope**, assumptions, sources, model) → conduct (identify threats and vulnerabilities, determine likelihood and impact, determine risk) → communicate results → maintain. ISO/IEC 27005 and ISO 31000 have a similar flow: context → identification → analysis → evaluation → treatment, with communication and monitoring.

The **scope** determines which systems, sites, processes, and third parties are included in the assessment. A wrong scope (e.g., an omitted SaaS or OT network) is a common cause of a false sense of security.

### Quantitative analysis

| Formula | Meaning |
|---|---|
| **AV** (Asset Value) | The value of the asset in money |
| **EF** (Exposure Factor) | The percentage of value lost in a single incident (0–100%) |
| **SLE = AV × EF** | Single Loss Expectancy: the loss per single incident |
| **ARO** | Annualized Rate of Occurrence: the expected number of incidents per year (once in 10 years = 0.1) |
| **ALE = SLE × ARO** | Annualized Loss Expectancy: the expected annual loss |
| **Value of the control** | **(ALE before − ALE after) − annual cost of the control (ACS)** |

#### Example calculation

A data center is worth **AV = EUR 2,000,000**. A flood would destroy 40% (**EF = 0.4**). A flood is expected once in 20 years (**ARO = 0.05**).

- SLE = 2,000,000 × 0.4 = **EUR 800,000**
- ALE = 800,000 × 0.05 = **EUR 40,000 per year**

The proposed control (flood walls and pumps) costs **EUR 15,000 per year** (depreciation + maintenance) and reduces the EF to 0.1:

- New SLE = 200,000; new ALE = 200,000 × 0.05 = **EUR 10,000**
- Value of the control = (40,000 − 10,000) − 15,000 = **EUR 15,000 per year** → the control is justified.

Had the control cost EUR 35,000 per year, its value would be −EUR 5,000 and the control would not be economically justified (except because of the law or the safety of people).

#### Second example: phishing

Account compromise through phishing costs an average of EUR 25,000 per incident (SLE) and happens 6 times a year (ARO = 6): ALE = EUR 150,000. Phishing-resistant MFA for EUR 30,000 per year reduces the ARO to 0.5: new ALE = EUR 12,500. Value = (150,000 − 12,500) − 30,000 = **EUR 107,500**.

> **On the exam:** remember the order AV → EF → SLE → ARO → ALE. If the ARO is "once in 50 years", that is 0.02. A control whose annual cost exceeds the reduction in ALE is not justified, except when it is required by law or protects human lives.

### Qualitative analysis

| Approach | Description | Advantages | Disadvantages |
|---|---|---|---|
| **Quantitative** | Monetary values, formulas | Objective, comparison of costs and benefits | Requires reliable data, difficult for intangible assets |
| **Qualitative** | Scales (low/medium/high), likelihood and impact matrix, **Delphi technique** (anonymous expert consensus), interviews, workshops, scenarios | Fast, includes intangibles (reputation) | Subjective, hard to compare with cost |
| **Hybrid / semi-quantitative** | Numeric scales (1–5) and weights | Balance | False precision |

A risk matrix (5×5) prioritizes risks for treatment; the combination of high likelihood × high impact is the first priority.

### Risk treatment

| Strategy | Description | Example |
|---|---|---|
| **Mitigate / reduce** | Introduce controls that reduce likelihood or impact | MFA, segmentation, backup |
| **Transfer / share** | Transfer the financial consequences to a third party | **Cyber insurance**, outsourcing with contractual liability |
| **Avoid** | Abandon the activity that creates the risk | Not launching a service, not storing card numbers |
| **Accept** | Consciously accept the risk, documented, by the risk owner | Risk below the appetite threshold, cost of the control greater than the benefit |
| **Reject / ignore** | Ignore the risk | **Never acceptable** (negligence) |

**Risk mitigation strategies** (new in 2027) include a combination of layered controls (defense in depth), reducing the attack surface, compensating controls when the primary one is not feasible, and prioritization by risk (e.g., patches first for vulnerabilities from the KEV catalog on internet-facing systems).

**Cyber insurance** transfers financial risk, but not reputational and legal risk; insurers require minimum controls (MFA, EDR, offline backup) and may refuse to pay if the controls were not in place. Accountability for data protection remains with the organization.

> **On the exam:** risk can never be completely eliminated; there is always residual risk that the risk owner formally accepts. Transferring risk does not transfer accountability. "Ignore" is always a wrong answer.

### Types of controls

| Functional type | Purpose | Administrative example | Technical example | Physical example |
|---|---|---|---|---|
| **Directive** | Directs behavior | Policy, AUP | Login banner with rules | "No entry" signs |
| **Deterrent** | Discourages | Sanctions in the policy | Monitoring warning | Visible cameras, guards |
| **Preventive** | Prevents an incident | Candidate screening, SoD | Firewall, MFA, encryption | Locks, mantrap, fences |
| **Detective** | Detects an incident | Audit, mandatory vacation, job rotation | IDS, SIEM, FIM | CCTV, motion sensors |
| **Corrective** | Corrects after an incident | Disciplinary action, updating procedures | Antivirus quarantine, patch, host isolation | Fire suppression |
| **Recovery** | Returns to normal operation | DRP | Restore from backup, failover | Alternate site |
| **Compensating** | Alternative when the primary control is not feasible | Increased oversight instead of SoD in a small team | Segmentation for a legacy system without patches | An additional guard |

Categories: **administrative / managerial**, **technical / logical**, **physical**.

> **On the exam:** one control can have multiple types; the question asks for the PRIMARY one. CCTV that no one watches in real time is detective (and deterrent), not preventive. Mandatory vacation is detective. A compensating control is the answer when a question says "the primary control cannot be applied".

### Control assessments (security and privacy)

A **control assessment** verifies whether controls are **implemented correctly, operating as intended, and producing the desired outcome** (NIST SP 800-53A). Methods: **examine** (reviewing documents, configurations), **interview**, **test** (technical testing). Privacy assessments also verify privacy controls (the 800-53 PT family, minimization, consent) and include a **PIA/DPIA**. The assessment is done by an independent assessor (internal audit, 3PAO, external auditor), and the results go into the **POA&M** (Plan of Action and Milestones).

### Continuous monitoring and measurement

**ISCM** (Information Security Continuous Monitoring, NIST SP 800-137) maintains ongoing awareness of threats, vulnerabilities, and control effectiveness. It is measured through **KPIs** (control performance), **KRIs** (early signals of rising risk), and **KCIs** (key control indicators). Examples: percentage of assets under EDR, mean time to patch critical vulnerabilities, number of policy exceptions, percentage of accounts with MFA.

### Reporting

| Type | Audience | Content |
|---|---|---|
| **Internal** | Board, management, risk committee, risk owners | Risk register, trends, KRIs, treatment status, exceptions, risk heat map |
| **External** | Regulators, auditors, customers, investors, insurers | Regulatory filings, SOC reports, compliance statements, disclosures of material incidents (e.g., SEC rules for public companies) |

The **risk register** contains: risk description, owner, likelihood, impact, rating, existing controls, treatment, deadline, residual risk, and status.

### Continuous improvement and maturity models

| Model | Levels |
|---|---|
| **CMMI** (Capability Maturity Model Integration) | 1 Initial, 2 Managed, 3 Defined, 4 Quantitatively Managed, 5 Optimizing |
| **NIST CSF tiers** | 1 Partial, 2 Risk Informed, 3 Repeatable, 4 Adaptive |
| **RMM / risk maturity** | Ad hoc → preliminary → defined → integrated → optimized |
| **C2M2** | Maturity model for the energy sector |

The improvement cycle is **PDCA** (Plan-Do-Check-Act, Deming); findings from audits, incidents, and metrics feed back into planning.

### Risk frameworks

| Framework | Essence |
|---|---|
| **ISO 31000** | General principles and guidelines for risk management (not certifiable) |
| **ISO/IEC 27005** | Information security risk management, supporting ISO 27001 |
| **NIST RMF (SP 800-37 Rev. 2)** | Prepare → Categorize (FIPS 199) → Select (800-53) → Implement → Assess (800-53A) → Authorize (ATO) → Monitor |
| **NIST SP 800-30** | Guide for conducting risk assessments |
| **NIST SP 800-39** | Risk management at the organization, mission/business process, and system levels (three tiers); frame, assess, respond, monitor |
| **COBIT 2019** | Risk as part of IT governance (risk focus area); linked with **ISACA Risk IT** |
| **SABSA** | Risk driven by business attributes, opportunities and threats |
| **PCI DSS** | Targeted risk analysis for flexible requirements and the customized approach |
| **HIPAA Security Rule** | Mandatory risk analysis and risk management for ePHI |
| **COSO ERM** | Enterprise risk management linked to strategy and performance |
| **FAIR** | Quantitative risk analysis (loss frequency and magnitude) |
| **OCTAVE** | Self-directed risk assessment (Carnegie Mellon) |

> **On the exam:** the RMF steps in order are a frequent PBQ topic: **Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor**. The authorization decision (ATO) is made by the **Authorizing Official** (a senior executive), not the assessor.

### Categorization in the RMF (FIPS 199)

A system is categorized by the potential impact (low, moderate, high) on the confidentiality, integrity, and availability of each type of information. The overall category is the **high water mark**: the highest of the three values. Example: SC = {(C, moderate), (I, high), (A, low)} yields the category **high**, so the high baseline from SP 800-53B is selected.

### Scenario: who accepts the risk

A penetration test finds that a legacy ERP does not support MFA. Its replacement is planned in 18 months. The CISSP does not accept the risk alone; they prepare an analysis (likelihood, impact, ALE), propose compensating controls (access only through PAM and a jump host, session monitoring, network segmentation), and present the residual risk to the **risk owner** (the business process owner), who formally accepts it in the risk register, with a reassessment date.

| Who | Role in the risk decision |
|---|---|
| CISO / risk team | Identifies, analyzes, recommends |
| Risk owner (the business) | Decides on treatment, accepts residual risk |
| Management / board | Defines the risk appetite, decides on risks above the threshold |
| Internal audit | Independently verifies the process |

## Summary

- **BCP**: scope and planning → BIA → continuity planning → approval and implementation; ISO 22301, NIST SP 800-34.
- **BIA** measures impact, not threats; **RTO + WRT ≤ MTD**; the RPO determines backup frequency; the MTD and RPO are set by the business.
- **External dependencies**: utilities, ISP, cloud, suppliers, key people; SLA with RTO/RPO, multiple suppliers, exit strategy.
- **Personnel**: screening proportionate to the sensitivity of the position; NDA, AUP; SoD, job rotation, mandatory vacation, dual control; revoking access at the moment of termination; privilege creep on transfer.
- **Third parties**: SLA, OLA, MOU, ISA, right to audit, incident reporting obligation, accounts with an expiration date.
- **Risk**: AV × EF = SLE; SLE × ARO = ALE; value of the control = ALE before − ALE after − cost.
- **Treatment**: mitigate, transfer (insurance does not transfer accountability), avoid, accept (formally); never ignore.
- **Controls**: directive, deterrent, preventive, detective, corrective, recovery, compensating × administrative, technical, physical.
- **Assessment, monitoring, reporting**: 800-53A (examine, interview, test), ISCM 800-137, KPI/KRI, risk register, internal and external.
- **Maturity and frameworks**: CMMI 1–5, PDCA; ISO 31000/27005, NIST RMF/800-30/800-39, COBIT, SABSA, PCI DSS, HIPAA, FAIR.
