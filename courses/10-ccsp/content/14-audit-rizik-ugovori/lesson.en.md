## Exam objectives: 6.3, 6.4 and 6.5

This module closes domain 6 (**Legal, Risk and Compliance**, 13%) and the entire exam:

- **6.3 Understand audit processes, methodologies, and required adaptations for a cloud environment**: internal and external audit controls, impact of audit requirements, identify assurance challenges of virtualization and cloud, types of audit reports (SSAE, SOC, ISAE), restrictions of audit scope statements, gap analysis (control analysis, baselines, risk and control self-assessment), audit planning, internal information security management system (ISMS), internal information security controls system, policies (organizational, functional, cloud computing), identification and involvement of relevant stakeholders, specialized compliance requirements for highly regulated industries (NERC CIP, HIPAA, HITECH, PCI), impact of distributed IT model (diverse geographical locations, crossing over legal jurisdictions),
- **6.4 Understand implications of cloud to enterprise risk management**: assess the provider's risk management programs (controls, methodologies, policies, risk profile, risk appetite), the difference between data roles (owner, controller, custodian, processor, steward), regulatory transparency requirements (breach notification, SOX, GDPR), risk treatment (avoid, mitigate, transfer, share, accept), different risk frameworks, metrics for risk management, assessment of the risk environment (service, vendor, infrastructure, business),
- **6.5 Understand outsourcing and cloud contract design**: business requirements (SLA, MSA, SOW), vendor management (vendor assessments, vendor lock-in, vendor viability, escrow), contract management (right to audit, metrics, definitions, termination, litigation, assurance, compliance, access to cloud/data, cyber risk insurance, data ownership, security requirements), and supply-chain management (ISO/IEC 27036).

> **On the exam:** in the cloud, the customer can almost never audit the provider's data center itself. The correct answer to "how do we obtain assurance about the CSP's controls" is almost always an **independent third-party report** (SOC 2 Type II, ISO/IEC 27001 certificate, CSA STAR) together with contractual rights, not a personal visit or your own pentest of the provider's infrastructure.

## Internal and external audit (6.3)

| | **Internal audit** | **External audit** |
|---|---|---|
| Who | Employees or contracted auditors reporting to the audit committee | An independent firm (CPA, certification body, QSA) |
| Purpose | Helping management: control effectiveness, risk management, preparation for the external audit | An independent opinion for third parties: regulators, customers, investors |
| Independence | Organizational (reports to the board, not to IT) | Full, mandated by standards |
| Result | Internal report, recommendations | Opinion, certificate, SOC report, ROC |
| Frequency | According to a risk-based plan | Annually or per regulation / the certification cycle |

The **Three Lines Model** (IIA): the first line is operational managers who own risks and controls, the second line is the risk and compliance functions (compliance, the CISO as oversight), the third line is internal audit with independent assurance. External auditors and regulators sit outside that model.

**Internal audit controls** are controls through which the organization checks itself (monitoring, logging, periodic access reviews, CSPM, internal audit). **External audit controls** are those checked by an independent party that issues an opinion on them.

### Internal controls system and ISMS

An **ISMS** (Information Security Management System) under **ISO/IEC 27001:2022** is a risk-based management system built on the Plan-Do-Check-Act cycle:

| Clause | Content |
|---|---|
| 4 Context | Context, interested parties, the scope of the ISMS, including cloud services |
| 5 Leadership | Management commitment, policy, roles |
| 6 Planning | Risk assessment and treatment, Statement of Applicability (SoA), objectives |
| 7 Support | Resources, competence, awareness, documentation |
| 8 Operation | Implementing risk treatment |
| 9 Performance evaluation | Measurement, **internal audit**, management review |
| 10 Improvement | Nonconformities, corrective action, continual improvement |

Annex A has 93 controls in four themes (organizational, people, physical, technological), including control 5.23 on information security for the use of cloud services. **ISO/IEC 27017** adds cloud-specific guidance, and **ISO/IEC 27018** the protection of PII (module 13).

The **internal information security controls system** is a broader concept: all preventive, detective, and corrective controls (administrative, technical, physical) through which the organization manages risk. Frameworks: COSO Internal Control (for financial reporting), COBIT (IT governance), NIST SP 800-53, CSA CCM.

### Policies

| Level | Examples | Who approves |
|---|---|---|
| **Organizational** | The overarching information security policy, the risk management policy | Management / the board |
| **Functional** | Data classification, access control, acceptable use, incident management, backup, cryptography | CISO / function owners |
| **Cloud computing policies** | Which models and providers are allowed, approval of new cloud services, data classifications allowed in the cloud, mandatory guardrails, shadow IT | CISO + IT + legal |

The cloud policy must follow the existing organizational policies, not replace them. A typical problem is **shadow IT**: business units procure SaaS themselves with a credit card, bypassing risk assessment and policy.

## Impact of audit requirements and assurance challenges in the cloud (6.3)

Audit requirements affect the choice of provider, the architecture, and the contract: if a regulator requires evidence of controls, the customer must secure logs, reports, and the right to information in advance.

| Virtualization and cloud challenge | Why it is a problem | How it is addressed |
|---|---|---|
| No physical access | The auditor cannot tour the data center | Third-party reports (SOC 2, ISO 27001), CSA STAR |
| Multitenancy | An audit for one customer must not expose others | The provider allows only aggregated reports |
| Ephemeral resources | Sampling servers that exist for minutes | Auditing configuration and IaC, continuous monitoring, logs |
| Hypervisor and hidden layers | The customer cannot see controls below its boundary | Shared responsibility matrix, CSP reports |
| Rapid change | A 9-month-old report may not reflect the current state | **Bridge (gap) letter**, continuous auditing, automated evidence |
| CSP subcontractors | Controls sit with a fourth party | Inclusive vs carve-out method, CSOC |
| Distributed IT and jurisdictions | Data and teams in multiple countries | Legal analysis, local requirements, multiple audits |

## Types of audit reports (6.3)

In the US, attestation standards are issued by the AICPA (**SSAE**, Statements on Standards for Attestation Engagements, currently SSAE 18 and later amendments), and internationally by the IAASB (**ISAE**). **SOC** (System and Organization Controls; formerly Service Organization Control) reports are based on them.

| Report | Standard | Focus | Audience |
|---|---|---|---|
| **SOC 1** | SSAE 18 (AT-C 320); internationally **ISAE 3402** | Controls relevant to user entities' financial reporting (ICFR) | Restricted: service users and their financial auditors |
| **SOC 2** | SSAE 18 (AT-C 205) with the Trust Services Criteria; internationally ISAE 3000 | Security (mandatory), Availability, Processing Integrity, Confidentiality, Privacy | Restricted: users, prospective users, and others who understand the system, usually under NDA |
| **SOC 3** | The same criteria as SOC 2 | Summary, without test details | General use, may be published publicly |

| Type | What it shows |
|---|---|
| **Type I** | Description of the system and the **design** of controls at a point in time |
| **Type II** | Design and **operating effectiveness** of controls over a period (usually 6 to 12 months), with the auditor's tests |

Elements of a SOC 2 report a cloud customer should read: the auditor's opinion (unqualified, qualified, adverse, disclaimer), the system description and boundaries (what is in scope), the period, exceptions in the tests, **CUECs** (complementary user entity controls: controls the customer must implement itself for the provider's controls to be effective), and the treatment of subservice organizations.

**Inclusive vs carve-out**: under the inclusive method, the subservice organization's controls (e.g., a colocation data center) are in the report; under the carve-out method they are excluded, so the customer must request the subservice organization's own report.

### Other forms of assurance

| Form | Description |
|---|---|
| **ISO/IEC 27001 certificate** | A certification body confirms the ISMS; valid for three years with annual surveillance audits. Read the **scope** and the **SoA** |
| **CSA STAR** | Level 1: self-assessment (CAIQ, public in the STAR Registry); Level 2: third party (STAR Certification with ISO 27001, STAR Attestation with SOC 2); higher level: continuous monitoring |
| **PCI DSS AOC / ROC** | Attestation of Compliance and Report on Compliance issued by a QSA |
| **FedRAMP** | Authorization for US federal agencies (Low, Moderate, High) |
| **National schemes** | E.g., BSI C5 (Germany), ENS (Spain), sector schemes in the EU |

> **On the exam:** a prospective customer wants detailed evidence that the provider's security controls operated effectively over the past year → **SOC 2 Type II**. Public marketing evidence → SOC 3. Controls for the customer's financial statements → SOC 1. Design only, on a single day → Type I.

## Restrictions of audit scope statements (6.3)

The **scope statement** in a SOC/ISAE report states precisely what was audited. Everything outside it is not covered, and customers often wrongly assume that "the provider's SOC 2" covers all its services.

Typical restrictions:

- only certain services, regions, or data centers,
- only certain Trust Services Criteria (e.g., only Security, without Privacy),
- a specific period (Type II) or date (Type I),
- carve-out of subservice organizations,
- assumed CUEC controls on the customer side,
- **restricted use**: SOC 1 and SOC 2 are intended for specific users and must not be further distributed without approval; SOC 3 is for general use,
- the auditor's statement on management's responsibility for the system description and on the inherent limitations of controls.

Example: a provider has a SOC 2 Type II for IaaS in the EU, but a new AI service and a region in Asia were launched after the period. For those services the report **provides no** assurance: request a bridge letter, the next report, or other confirmation.

## Gap analysis (6.3)

A **gap analysis** compares the current state with the target state (a standard, regulation, baseline) and produces a list of gaps for treatment.

| Technique | Description |
|---|---|
| **Control analysis** | For each required control: does it exist, is it correctly designed, does it operate effectively |
| **Baseline** | Comparison with a minimum set of controls (e.g., CIS Benchmarks, CSA CCM, an internal cloud baseline, NIST SP 800-53 baseline) |
| **Risk and Control Self-Assessment (RCSA)** | Process owners assess risks and controls themselves through workshops or questionnaires; cheap and involves the first line, but less objective |

A gap analysis is often performed before certification (e.g., before an ISO 27001 audit) and before migrating to the cloud (what the provider covers, what the customer must add). An independent assessor provides objectivity; an internal team knows the context better.

## Audit planning and stakeholders (6.3)

Typical phases of an audit plan:

1. **Define objectives** (e.g., PCI DSS compliance, effectiveness of IAM controls in the cloud).
2. **Define scope**: systems, locations, services, period, providers involved, criteria; identify what the CSP's reports cover.
3. **Conduct the audit**: evidence collection (interviews, documentation, tests, automated evidence from cloud APIs), sampling.
4. **Reporting and follow-up**: findings, recommendations, a corrective action plan, lessons learned, and adjustment of the next plan.

Stakeholders to identify and involve: management and the audit committee, business process and data owners, IT and cloud operations, the CISO, the DPO, legal, procurement (contracts with the CSP), the cloud provider (report availability, contacts), external auditors, regulators. The cloud introduces new stakeholders (CSP, broker, MSP) whose cooperation must be contracted.

## Highly regulated industries (6.3)

| Requirement | Industry | Cloud implications |
|---|---|---|
| **NERC CIP** | The North American bulk electric system | Categorization of systems by impact, protection of BES Cyber System Information (BCSI), access and personnel management, physical and electronic perimeter protection; cloud use for BCSI is permitted with strict controls, while for operational systems it is very limited |
| **HIPAA** | US healthcare | BAA with the CSP, Security Rule (administrative, physical, technical safeguards), risk analysis, audit logs of ePHI access |
| **HITECH** | US healthcare | Extends HIPAA to business associates, increases penalties, and introduces the Breach Notification Rule (individuals without unreasonable delay, no later than 60 days; HHS; media if more than 500 residents of a state are affected) |
| **PCI DSS** (v4.0.1) | Everyone processing cardholder data | 12 requirements, scope reduction (cardholder data environment), QSA and ROC or SAQ; the provider as a TPSP must provide an AOC and a clear division of responsibilities (responsibility matrix) |
| **SOX** | US public companies | Controls over systems affecting financial statements; providers' SOC 1 reports |
| **DORA / NIS2** | EU finance / essential and important entities | ICT third-party risk management, register of contracts (DORA register of information), resilience testing, incident reporting |

## The distributed IT model (6.3)

When data, providers, teams, and users are in multiple countries, the audit must take into account:

- different privacy and localization laws (module 13),
- different audit standards and acceptable evidence (SSAE vs ISAE, national schemes),
- the auditor's rights to access data in another country,
- time zones and languages for interviews and documentation,
- consolidating findings at the group level, not just for individual entities.

> **On the exam:** before relying on a provider's report, the auditor (and the customer) must check the **scope, period, opinion, exceptions, and CUECs**. A report that does not cover the service or region you use is not evidence for that service.

## Enterprise risk management and the cloud (6.4)

**Enterprise Risk Management (ERM)** is managing all of an organization's risks in an integrated way. Cloud risk is part of ERM: the decision to move a service to the cloud changes the risk profile (less own infrastructure, more dependence on suppliers, new legal risks).

### Assessing the provider's risk management program

| What is assessed | Questions and evidence |
|---|---|
| **Controls** | Do they exist and do they work (SOC 2 Type II, ISO 27001 SoA, CSA CCM/CAIQ answers) |
| **Methodologies** | Which risk framework the CSP uses (ISO 31000, ISO/IEC 27005, NIST), how often it assesses risk |
| **Policies** | Security, privacy, incident, subcontractor; alignment with the customer's policies |
| **Risk profile** | Risk concentration, incident history, financial stability, geopolitical risks |
| **Risk appetite** | How much risk the CSP accepts; it must be compatible with the customer's appetite (e.g., the CSP quickly launches beta services, while a bank has a low appetite) |

**Risk appetite** is the amount of risk an organization is willing to accept in pursuit of its objectives (strategic level). **Risk tolerance** is the acceptable deviation for a specific objective or metric. **Risk capacity** is the maximum the organization can bear.

## Data roles (6.4)

| Role | Responsibility | Cloud example |
|---|---|---|
| **Data owner** | Ultimate accountability for the data: classification, who may access it, retention | The HR director for employee data |
| **Data controller** | A legal term (GDPR): determines the purposes and means of processing personal data | The company using a SaaS HR system |
| **Data processor** | Processes personal data on behalf of the controller, on its instructions | The SaaS HR system provider |
| **Data custodian** | Day-to-day storage and technical protection: backup, encryption, access, according to the owner's requirements | The customer's IT/cloud operations, or the CSP for the layers it manages |
| **Data steward** | Quality, meaning, metadata, data governance on behalf of the owner | A business analyst responsible for the accuracy of master data |
| **Data subject** | The person the personal data relates to | The employee |

Key nuances: the owner is a **business** role and remains in the customer's organization; the custodian implements protection but does not decide on classification; under GDPR the processor must not use the data for its own purposes; accountability is **not transferred** to the provider by contract.

## Regulatory transparency requirements (6.4)

| Requirement | What it requires | Deadline / key point |
|---|---|---|
| **GDPR breach notification** | Notification to the supervisory authority; informing data subjects in case of high risk | 72 h to the supervisory authority where feasible; data subjects without undue delay |
| **GDPR transparency** (Art. 12–14) | Clear information about processing, purposes, recipients, transfers, rights | At the time of data collection |
| **SOX** (Sarbanes-Oxley) | Section 302: the CEO and CFO personally certify the accuracy of reports and controls; Section 404: assessment of internal control over financial reporting (ICFR) and the external auditor's opinion for larger companies | Annually; cloud systems affecting finances are in scope |
| **US state breach laws** | All states have notification laws | Different deadlines and thresholds |
| **HIPAA/HITECH** | Individuals, HHS, media | No later than 60 days |
| **SEC** | Material cybersecurity incidents of public companies | Four business days from determining materiality |
| **NIS2 / DORA** | Significant / major ICT-related incidents | Phases: early notification, intermediate, final report |

Cloud implication: the customer cannot meet the deadlines without a **contractual obligation of the CSP** to notify it quickly and provide the necessary information.

## Risk treatment (6.4)

| Strategy | Description | Cloud example |
|---|---|---|
| **Avoid** | Do not perform the activity that creates the risk | Do not move special categories of data to the public cloud |
| **Mitigate / reduce** | Controls reduce likelihood or impact | Encryption with customer keys, multi-region architecture |
| **Transfer** | Financial consequences pass to a third party | Cyber insurance, contractual indemnification |
| **Share** | Risk and responsibility are shared | The shared responsibility model, a joint venture |
| **Accept** | Conscious acceptance of the residual risk within appetite, approved by the risk owner | Accepting the risk of a brief outage of a non-critical SaaS |

Important: **accountability cannot be transferred**. Insurance transfers the financial loss, but not reputation or the controller's legal accountability. Risk acceptance must be formal, documented, and made by an authorized person (the risk owner), not by technical staff.

## Risk frameworks (6.4)

| Framework | Characteristic |
|---|---|
| **ISO 31000:2018** | General principles and process of risk management for any organization |
| **ISO/IEC 27005:2022** | Information security risk management, supporting ISO 27001 |
| **NIST SP 800-37 Rev. 2 (RMF)** | Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor |
| **NIST SP 800-30 Rev. 1** | Guide for conducting risk assessments |
| **NIST CSF 2.0** (2024) | Functions Govern, Identify, Protect, Detect, Respond, Recover; Govern includes supply chain risk management |
| **COSO ERM** (2017) | Integrating risk with strategy and performance |
| **ENISA Cloud Computing Risk Assessment** | A catalog of cloud risks (e.g., lock-in, loss of governance, isolation failure, compliance) |
| **FAIR** | Quantitative risk analysis in monetary terms |
| **NIST AI RMF 1.0** and **ISO/IEC 23894** | Risk management for AI systems (Govern, Map, Measure, Manage in NIST) |
| **CSA CCM** | A cloud controls matrix mapped to other frameworks |

## Metrics for risk management (6.4)

| Metric | What it measures | Example |
|---|---|---|
| **KRI** (Key Risk Indicator) | Early warning of rising risk | Number of publicly exposed buckets, critical vulnerabilities older than 30 days |
| **KPI** (Key Performance Indicator) | Process performance | Percentage of systems patched within the SLA deadline |
| **KCI** (Key Control Indicator) | Control effectiveness | Percentage of accounts with MFA, successful restore tests |
| **SLE** = AV × EF | Expected loss from a single event | Value 200,000 × exposure 25% = 50,000 |
| **ALE** = SLE × ARO | Annualized expected loss | 50,000 × 0.5 = 25,000 per year |
| Residual risk | Risk after controls | Must be within appetite |

Good metrics are measurable, relevant to the business, comparable over time, and tied to an owner. Management is shown trends and the relationship to appetite, not raw technical numbers.

## Assessment of the risk environment (6.4)

| Dimension | What is examined |
|---|---|
| **Service** | Criticality of the service to the business, model (IaaS/PaaS/SaaS), SLA, service maturity (GA vs preview) |
| **Vendor** | Financial stability, reputation, certifications, incident history, subcontractors, concentration (too many services with one provider) |
| **Infrastructure** | Data center locations, redundancy, tenant isolation, physical security |
| **Business** | Regulatory requirements, outage impact, strategic lock-in risk, reputation |

> **On the exam:** when a question asks what a manager does FIRST before selecting a provider or migrating, the correct answer is most often a **risk assessment** against business requirements and appetite, and only then the choice of controls or signing the contract.

## Contracts and outsourcing: business requirements (6.5)

| Document | Purpose | Content |
|---|---|---|
| **MSA** (Master Service Agreement) | The umbrella contract governing the entire relationship | General terms, liability, confidentiality, intellectual property, jurisdiction, termination |
| **SOW** (Statement of Work) | A specific job or project under the MSA | Scope, deliverables, deadlines, price, acceptance |
| **SLA** (Service-Level Agreement) | A measurable service level | Availability (e.g., 99.9%), support response time, RTO/RPO, measurement method, exclusions, service credits |
| **OLA** (Operational-Level Agreement) | An internal agreement between teams that supports the SLA | E.g., the network team guarantees an intervention time |
| **DPA / BAA** | Protection of personal / health data | GDPR Art. 28 / HIPAA |
| **AUP** (Acceptable Use Policy) | What the customer may do on the service | Prohibitions on abuse |

SLA nuances in the cloud: public providers' SLAs are standardized and rarely negotiated; **service credits** (a discount on the bill) are usually the only remedy and do not cover actual business damage; availability of 99.9% means about 8.8 hours of downtime per year, and 99.99% about 53 minutes. The customer therefore designs the architecture for its own objectives (multi-AZ, multi-region) rather than relying only on the SLA.

## Vendor management (6.5)

| Activity | Content |
|---|---|
| **Vendor assessment** | Due diligence before the contract and periodically: questionnaires (CSA CAIQ, SIG), SOC 2 / ISO reports, financial analysis, references, subcontractor assessment; depth according to criticality (tiering) |
| **Vendor lock-in** | Dependence on proprietary services, formats, and APIs that makes switching difficult; mitigated with open standards, containers, IaC, abstraction, an exit plan, verification of data portability, and rights under the EU Data Act |
| **Vendor viability** | Can the vendor survive: financial stability, market position, risk of acquisition or service shutdown |
| **Escrow** | A third party (escrow agent) holds source code, data, or documentation and releases it to the customer upon defined events (bankruptcy, end of support) |

For SaaS, classic source code escrow is often less useful (there is no infrastructure to run the code), so it is combined with regular data exports and **SaaS escrow** solutions that also preserve the environment.

## Contract management: key clauses (6.5)

| Clause | What it ensures | Cloud note |
|---|---|---|
| **Right to audit** | The right of the customer or its auditor to verify controls | CSPs usually replace it with third-party reports; regulated sectors (DORA, EBA) require rights of access and audit |
| **Metrics** | What is measured and how (availability, response time, MTTR) | Who measures and from where; the customer needs its own monitoring |
| **Definitions** | The precise meaning of terms ("availability", "incident", "customer data", "outage") | A vague definition of availability nullifies the SLA |
| **Termination** | Termination for breach or for convenience, notice period, transition assistance | Return of data in a usable format within a deadline, then confirmed deletion |
| **Litigation** | Governing law, competent court, arbitration, limitation of liability, indemnification | A dispute with a global CSP before a foreign court is expensive |
| **Assurance** | Which reports and certificates the CSP provides and how often | SOC 2 Type II annually, bridge letter |
| **Compliance** | Compliance with laws and standards, obligation to report changes | E.g., PCI DSS AOC, ISO 27001, GDPR |
| **Access to cloud/data** | Data availability at all times, including during a dispute and after termination | Prohibition on withholding data as leverage |
| **Cyber risk insurance** | The vendor's obligation to carry insurance and a minimum amount | The customer separately assesses its own policy |
| **Data ownership** | The customer remains the owner of the data; the CSP may not use it for other purposes | Include metadata, logs, and derived data; prohibition on training AI on customer data |
| **Security requirements** | Minimum controls: encryption, IAM, logging, incident notification within a deadline, subcontractors, location | Flow-down to subcontractors |

> **On the exam:** the greatest risk when terminating a contract with a cloud provider is **loss of access to data or inability to migrate it**. The best protection is clauses on data return in an agreed format and timeframe, transition assistance, and confirmed deletion, together with a tested exit plan.

## Supply-chain management (6.5)

**ISO/IEC 27036** (Information security for supplier relationships):

| Part | Content |
|---|---|
| **27036-1** | Overview and concepts of supplier relationships |
| **27036-2** | Requirements for defining, implementing, and monitoring security in supplier relationships |
| **27036-3** | Guidelines for hardware, software, and services supply chain security (ICT supply chain) |
| **27036-4** | Guidelines for security of cloud services |

The supplier relationship lifecycle: planning (assessment of need and risk), supplier selection, contracting, relationship management (monitoring, audit, changes), termination (data return, access revocation).

The cloud supply chain is deep: the CSP uses subcontractors (data centers, hardware, software components), and a SaaS provider often runs on another provider's IaaS (a **fourth party**). Measures:

- a register of suppliers and subcontractors, tiering by criticality,
- flow-down of security requirements through contracts,
- **SBOM** and verification of software provenance, signed artifacts,
- monitoring concentration risk (many critical services with one CSP),
- regulatory requirements: NIS2 (supply chain security), DORA (register of information on ICT contracts, exit strategy), NIST SP 800-161 Rev. 1 (C-SCRM).

## Scenario: selecting a SaaS vendor for payroll

A medium-sized company is selecting a SaaS for payroll (personal and financial data, special categories for sick leave).

1. **Risk assessment** (6.4): criticality of the service, type of data, regulations (GDPR, tax regulations), management's appetite.
2. **Vendor assessment**: SOC 2 Type II (checking scope, period, exceptions, CUECs), ISO 27001 and 27701, CAIQ in the STAR Registry, financial stability.
3. **DPIA** (module 13) and analysis of data transfers outside the EU.
4. **Contract**: MSA + DPA + SLA; definitions of availability, incident notification within a deadline that allows meeting the 72 h requirement, the right to information and audit through reports, a subprocessor list with a right to object, data ownership, data return in CSV/standard format within 30 days of termination and confirmation of deletion, vendor insurance.
5. **Treatment of residual risk**: regular data export (mitigate), cyber insurance (transfer), formal acceptance of the residual risk by the owner (accept).
6. **Monitoring**: KRIs (vendor incidents, report delays), annual review.

## Typical exam traps

| Claim | Correct |
|---|---|
| "The provider's SOC 2 covers all its services" | Only the services, regions, and period in the scope statement |
| "SOC 3 is more detailed than SOC 2" | SOC 3 is a summary for general use, without test details |
| "Type I proves that controls work" | Type I shows only design at a point in time; effectiveness over a period is Type II |
| "With insurance we transferred the risk completely" | The financial loss is transferred, not accountability and reputation |
| "The custodian decides on classification" | The owner decides on classification; the custodian implements protection |
| "Service credits compensate for damage" | They are usually a small discount and the only remedy; the architecture must cover your own objectives |
| "Right to audit means we can enter the CSP's data center" | With large CSPs it is most often exercised through third-party reports, except where regulation requires more |

> **On the exam:** when two answers look correct, and one is a technical control while the other is a management decision based on risk or contract, CCSP most often rewards the management answer (risk assessment, contractual provision, policy), because it determines which technical controls are needed.

## Summary

- Internal audit serves management, external audit gives an independent opinion to third parties; the Three Lines Model; ISMS per ISO/IEC 27001:2022 (internal audit in clause 9.2).
- Policies: organizational, functional, and cloud; the cloud policy follows the overarching policy and prevents shadow IT.
- The cloud makes assurance harder (no physical access, multitenancy, ephemeral resources), so the customer relies on third-party reports together with contractual rights.
- SOC 1 (ICFR, ISAE 3402), SOC 2 (Trust Services Criteria, restricted use), SOC 3 (general use); Type I design at a point in time, Type II effectiveness over a period. Always read the scope, period, opinion, exceptions, CUECs, and carve-outs.
- Gap analysis: control analysis, baseline, RCSA. Audit planning: objectives, scope, execution, report, and lessons learned; involve stakeholders, including the CSP.
- Regulated industries: NERC CIP, HIPAA/HITECH (BAA, 60 days), PCI DSS (QSA, AOC, division of responsibilities), SOX, DORA/NIS2.
- Roles: owner (accountability), controller, processor, custodian (technical protection), steward (quality and meaning).
- Transparency: GDPR 72 h, SOX 302/404, SEC, HIPAA; the customer depends on the CSP's contractual obligation to notify it.
- Risk treatment: avoid, mitigate, transfer, share, accept; accountability is not transferred. Frameworks: ISO 31000, 27005, NIST RMF/CSF 2.0, COSO, ENISA, FAIR, NIST AI RMF. Metrics: KRI, KPI, KCI, ALE = SLE × ARO.
- Contracts: MSA (umbrella), SOW (the job), SLA (measurable level, service credits); clauses for audit, definitions, termination, disputes, data ownership and access, insurance, and security requirements.
- Vendor management: assessment, lock-in, viability, escrow. Supply chain: ISO/IEC 27036 (part 4 for cloud), fourth parties, SBOM, concentration risk.
