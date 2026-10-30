## Exam objectives: 6.1 and 6.2

Domain 6 (**Legal, Risk and Compliance**) carries 13% of the exam. This module covers the first two objectives:

- **6.1 Articulate legal requirements and unique risks within the cloud environment**: conflicting international legislation, evaluation of legal risks specific to cloud computing, legal and regulatory frameworks and guidelines, forensics requirements (CSA, ISO/IEC 27037:2012, 27041:2015, 27042:2015, 27043:2015), and eDiscovery (ISO/IEC 27050, CSA Guidance),
- **6.2 Understand privacy requirements**: the difference between contractual and regulated private data (e.g., PHI, PII), country-specific legislation (FERPA, PIPEDA, GDPR, HIPAA, India's Digital Personal Data Protection Act), jurisdictional differences, standard privacy requirements (ISO/IEC 27018, GAPP, GDPR), and Privacy Impact Assessments (PIA).

CCSP doesn't require you to be a lawyer. It requires you to recognize **which law applies, who is responsible, and what the manager should do**: engage legal counsel, perform an assessment, pass obligations on by contract, choose the data location.

> **On the exam:** when a legal conflict or an unclear obligation appears in a question, the answer "consult legal counsel" is very often the BEST first step. A security professional identifies the risk but does not interpret the law alone.

## Basic legal concepts

| Concept | Meaning | Cloud example |
|---|---|---|
| **Criminal law** | The state prosecutes offenses against society; prison sentences and fines | Unauthorized access to a computer system |
| **Civil law / tort** | Disputes between parties, compensation for damages | A customer lawsuit over a data leak |
| **Contract law** | Obligations arising from a contract; violation = breach of contract | The CSP fails to meet the SLA or contractual security obligations |
| **Administrative / regulatory law** | Rules issued and enforced by regulators | A supervisory authority fine under GDPR |
| **Common law** | Court precedents (US, UK, Canada, Australia) | Case law on eDiscovery |
| **Civil (continental) law** | Codified statutes (most of Europe, including the region) | A personal data protection law |
| **Jurisdiction** | Which court and whose law applies | EU citizens' data at a US provider in the Frankfurt region |
| **Data sovereignty / data residency / data localization** | Data is subject to the laws of the country where it is located / where it is physically stored / a legal obligation to store it in the country | A legal obligation that data of a certain sector remain in the country |

## Conflicting international legislation (6.1)

The cloud easily moves data across borders, while laws remain national. Typical conflicts:

| Conflict | Description |
|---|---|
| **US CLOUD Act (2018) vs GDPR** | The CLOUD Act allows US authorities to demand from US providers data they control, regardless of where it is physically located. GDPR Art. 48 says that a judgment or decision of a third country is not by itself a basis for transfer, except via an international agreement (e.g., an MLAT). The provider can be caught between two obligations. |
| **Data localization laws** | Some countries (e.g., China, Russia, and others for certain data) require data to remain in the country, which clashes with a global architecture. |
| **Right to erasure vs retention obligation** | The GDPR right to erasure vs statutory retention (tax, financial, AML regulations) or a legal hold in a dispute in another country. |
| **eDiscovery vs data protection** | A US court demands a broad export of documents, while EU law restricts the transfer of personal data. |
| **Blocking statutes** | Some countries prohibit providing data to foreign courts without domestic approval. |
| **Different definitions of personal data and breach** | The same incident is reportable in one country and not in another. |

How a manager handles a conflict:

1. **Map the data** (where it is, whose it is, which categories, which countries).
2. **Involve legal counsel** and, where needed, local advisors.
3. **Choose the location** (regions) and provider in line with the obligations; use sovereign cloud offerings where needed.
4. Regulate by **contract** the handling of government requests, subcontractors, and location.
5. **Technical measures**: encryption with customer-controlled keys (BYOK/HYOK, external HSM), pseudonymization.

> **On the exam:** encryption with customer-held keys does not change which law applies, but it reduces the practical risk of the provider handing over readable data. The data location is chosen according to **legal requirements** first, and only then according to price and latency.

## Evaluation of legal risks specific to cloud computing (6.1)

| Risk | Description | Mitigation |
|---|---|---|
| **Unknown or changing data location** | Replication, backup, and support from other countries | Contractual location, region selection, data residency controls |
| **Subcontractors (subprocessors)** | The CSP uses third parties that the customer does not choose | Subprocessor list, right to object, flow-down obligation |
| **Government requests** | Subpoena, warrant, CLOUD Act, gag order | Contract on transparency, encryption, the CSP's transparency report |
| **eDiscovery and legal hold** | Hard to find and preserve data in a multitenant environment | Legal hold tools, contractual cooperation |
| **Equipment seizure** | Police seize hardware because of another tenant | Geographic redundancy, contract, choosing a reputable CSP |
| **Provider bankruptcy or shutdown** | Access to and ownership of data | Data return clauses, escrow, exit plan |
| **Liability and limitation of liability** | The CSP limits damages by contract | Negotiation, cyber insurance |
| **Non-compliance with sector regulations** | The provider lacks the required certifications | Due diligence, reports (SOC 2, ISO 27001, PCI DSS AOC) |
| **AI services** | Use of submitted data for training, intellectual property, AI regulation | Contractual prohibition on training on customer data, assessment under the EU AI Act |

## Legal and regulatory frameworks and guidelines (6.1)

### European Union

| Act | Key for the cloud |
|---|---|
| **GDPR** (Regulation (EU) 2016/679) | Protection of personal data, applicable since 25 May 2018, extraterritorial (Art. 3); in detail under 6.2 |
| **NIS2** (Directive (EU) 2022/2555) | Cybersecurity of "essential" and "important" entities, including cloud providers, data centers, and managed (security) service providers; risk management, supply chain security, management accountability; reporting of significant incidents: early warning 24 h, notification 72 h, final report within one month |
| **DORA** (Regulation (EU) 2022/2554) | Digital operational resilience of the financial sector, applicable since 17 January 2025; ICT risk management, reporting of major ICT-related incidents, resilience testing (including TLPT), ICT third-party risk management with mandatory contractual provisions, direct EU oversight of critical ICT third-party providers (CTPPs), among them the large cloud providers |
| **EU AI Act** (Regulation (EU) 2024/1689) | Risk-based approach: prohibited practices (from 2 February 2025), obligations for general-purpose AI models (from 2 August 2025), high-risk systems: the deadlines were moved by the "AI Omnibus" (Regulation (EU) 2026/1744, in force since 27 July 2026) — standalone Annex III systems from 2 December 2027, systems embedded in Annex I products from 2 August 2028; the roles of provider and deployer |
| **EU Data Act** (Regulation (EU) 2023/2854) | Applicable since 12 September 2025; among other things, it facilitates switching cloud providers, gradually abolishes switching charges, and requires protection against unlawful third-country government access to non-personal data |
| **Cyber Resilience Act** (Regulation (EU) 2024/2847) | Security requirements for products with digital elements, obligations to report actively exploited vulnerabilities, full application phased in by the end of 2027 |
| **eIDAS 2** | Electronic identification and trust services, the EU Digital Identity Wallet |

### US and others

| Regulation | Area |
|---|---|
| **HIPAA** / **HITECH** | Health data (PHI); a cloud provider processing ePHI is a business associate and signs a **BAA** |
| **GLBA** | Financial institutions, privacy and protection of customer data |
| **SOX** (Sarbanes-Oxley, 2002) | Integrity of financial reporting of public companies, internal controls (ICFR) |
| **FERPA** | Educational records of students |
| **COPPA** | Children under 13 online |
| **CCPA / CPRA** | California, consumer rights |
| **SEC cybersecurity incident rules** (2023) | Public companies disclose material incidents (Form 8-K, within four business days of determining materiality) |
| **FedRAMP** | Authorization of cloud services for US federal agencies |
| **PCI DSS** (v4.0.1) | Industry standard for cardholder data, a contractual (not legal) obligation |

### Guidelines and frameworks that are not law

- **OECD Privacy Guidelines** (1980, revised 2013): eight principles (collection limitation, data quality, purpose specification, use limitation, security safeguards, openness, individual participation, accountability), the basis of most privacy laws.
- **APEC Privacy Framework** and **Cross-Border Privacy Rules (CBPR)**, now also the Global CBPR Forum.
- **CSA Security Guidance** and the **Cloud Controls Matrix (CCM)**, **ENISA** guidelines, **NIST** publications.

> **On the exam:** distinguish law (mandatory, state sanction), regulation (mandatory rules of a regulator), contractual obligation (e.g., PCI DSS, an obligation toward the card brands), and standard/guideline (voluntary, until it is contracted or mandated). The question "what is mandatory" is looking for that distinction.

## Forensics requirements: standards (6.1)

The operational part of forensics is in module 12. Here are the standards the outline explicitly lists:

| Standard | Title / content | Key message |
|---|---|---|
| **ISO/IEC 27037:2012** | Guidelines for identification, collection, acquisition, and preservation of digital evidence | Four evidence handling activities; principles: relevance, reliability, sufficiency; the roles DEFR (Digital Evidence First Responder) and DES (Digital Evidence Specialist) |
| **ISO/IEC 27041:2015** | Guidance on assuring suitability and adequacy of incident investigative methods | Methods and tools must be validated: demonstrably doing what they claim |
| **ISO/IEC 27042:2015** | Guidelines for the analysis and interpretation of digital evidence | Analysis must be repeatable and conclusions explainable; investigator competence |
| **ISO/IEC 27043:2015** | Incident investigation principles and processes | The umbrella model of the investigation process: readiness, initialization, acquisitive, investigative, with concurrent processes |
| **CSA** | CSA Security Guidance (incident response domain) and the paper "Mapping the Forensic Standard ISO/IEC 27037 to Cloud Computing" | How to apply classic standards when there is no physical access; the need for contractual CSP cooperation |

How the standards fit together: **27043** is the framework of the entire investigation, **27037** covers evidence handling at the start, **27042** analysis and interpretation, and **27041** ensures that methods in all phases are valid. eDiscovery continues with **27050**.

Cloud challenges the standards highlight: seizing physical media is not possible, evidence is spread across jurisdictions, and the provider is a necessary participant. That is why the contract should contain: which logs the CSP retains and for how long, response deadlines, the method of evidence handover, and preservation of the chain of custody on the CSP's side.

## eDiscovery (6.1)

**eDiscovery** is the process of identifying, preserving, collecting, processing, reviewing, and producing electronically stored information (**ESI**) in judicial or regulatory proceedings. It is most developed in the US (Federal Rules of Civil Procedure), but it concerns anyone with data in the cloud.

### The EDRM model

The **Electronic Discovery Reference Model** is the de facto standard representation of the phases:

| Phase | What is done |
|---|---|
| Information Governance | Orderly information management before a dispute (classification, retention) |
| Identification | Finding potentially relevant ESI and custodians |
| Preservation | Protection against modification and deletion (**legal hold**) |
| Collection | Collecting ESI while preserving metadata |
| Processing | Volume reduction (deduplication, filtering), conversion |
| Review | Review for relevance and privilege (e.g., attorney communications) |
| Analysis | Patterns, timelines, key topics |
| Production | Handover to the other party in the agreed format |
| Presentation | Presentation in court |

### ISO/IEC 27050

| Part | Content |
|---|---|
| **27050-1** | Overview and concepts (terminology, process) |
| **27050-2** | Guidance for governance and management of eDiscovery |
| **27050-3** | Code of practice for eDiscovery (how to perform the activities) |
| **27050-4** | Technical readiness, preparing systems before a request |

### eDiscovery in the cloud

- **SaaS**: providers offer built-in eDiscovery and legal hold tools (e.g., Microsoft Purview eDiscovery, Google Vault). The customer must know their capabilities and limitations.
- **IaaS/PaaS**: the customer searches and exports on its own, but must cover all locations (buckets, databases, backups, logs).
- **Third party**: specialized eDiscovery firms; contract and NDA, the question of data location.
- **Challenges**: locating data, multitenancy (others' data must not be disclosed), egress costs, jurisdiction, metadata preservation, court deadlines.
- **CSA Guidance** emphasizes: contract in advance for eDiscovery and legal hold capabilities, data availability in a usable format, and provider cooperation.

> **On the exam:** as soon as litigation is **reasonably anticipated**, a duty to preserve arises. The correct first step is a **legal hold** on the relevant data (suspension of deletion), not a mass export of everything or waiting for a court order.

## Privacy: contractual vs regulated data (6.2)

| | **Regulated private data** | **Contractual private data** |
|---|---|---|
| Source of the obligation | Law or regulation | Contract (e.g., with a client, partner, card brands) |
| Example | PHI under HIPAA, personal data under GDPR, educational records under FERPA | Cardholder data under PCI DSS, client data protected by an NDA, a partner's business data |
| Sanction | Regulator fines, criminal liability | Contractual penalty, termination, damages, loss of the right to accept cards |
| Can the parties agree otherwise? | No (the law prevails) | Yes, within the limits of the law |

The same data can be both: the name and card number of a customer in the EU is personal data under GDPR (regulated) and cardholder data under PCI DSS (contractual).

Key concepts:

- **PII** (Personally Identifiable Information): a US term, information that identifies a person directly (name, passport number) or indirectly in combination (date of birth + ZIP code).
- **Personal data** under GDPR: any information relating to an identified or **identifiable** natural person, including online identifiers (IP address, cookie ID). Broader than the typical US definition of PII.
- **Special categories (GDPR Art. 9)**: health, genetic and biometric data (for identification), racial or ethnic origin, political opinions, religious beliefs, trade union membership, sex life and sexual orientation.
- **PHI** (Protected Health Information): health data under HIPAA held by covered entities and business associates.
- **Pseudonymization vs anonymization**: pseudonymized data is still personal (it can be re-identified with additional information); truly anonymized data falls outside the scope of GDPR.

## Country-specific legislation (6.2)

### GDPR in more detail

| Element | Content |
|---|---|
| Territorial scope (Art. 3) | Entities in the EU, but also those outside the EU that offer goods/services to persons in the EU or monitor their behavior |
| Principles (Art. 5) | Lawfulness, fairness, and transparency; purpose limitation; data minimization; accuracy; storage limitation; integrity and confidentiality; **accountability** (the controller must demonstrate compliance) |
| Legal bases (Art. 6) | Consent, contract, legal obligation, vital interests, public interest / official authority, legitimate interests |
| Data subject rights (Art. 12–22) | Information, access, rectification, erasure ("right to be forgotten"), restriction of processing, portability, objection, rights related to automated decision-making |
| Privacy by design / by default (Art. 25) | Protection built into systems from the start, minimal data by default |
| Processor (Art. 28) | A written contract (DPA): processing only on instructions, confidentiality, security, subprocessors only with authorization, assistance to the controller, deletion/return, audit |
| Records of processing (Art. 30) | Records of processing activities |
| Security (Art. 32) | Appropriate technical and organizational measures (encryption, pseudonymization, resilience, testing) |
| Breach (Art. 33–34) | To the supervisory authority without undue delay, where feasible within **72 hours**; to data subjects without undue delay if there is a high risk |
| DPIA (Art. 35) | Mandatory where high risk is likely (e.g., systematic monitoring, large volumes of special categories) |
| DPO (Art. 37) | Mandatory for public bodies and where core activities involve large-scale monitoring or special categories |
| Transfers outside the EEA (Ch. V) | Adequacy decision (Art. 45), appropriate safeguards: **SCCs** (standard contractual clauses), **BCRs** (binding corporate rules) (Art. 46–47), derogations (Art. 49) |
| Fines (Art. 83) | Up to EUR 20 million or 4% of total worldwide annual turnover (whichever is higher); lower tier up to EUR 10 million or 2% |

Transfers to the US: the **Schrems II** judgment (CJEU, C-311/18, 2020) invalidated the Privacy Shield and requires a transfer impact assessment (**TIA**) alongside SCCs. Since July 2023, an adequacy decision for the **EU-US Data Privacy Framework** applies to certified US organizations.

### Other laws from the outline

| Law | Country | Applies to | Key points |
|---|---|---|---|
| **FERPA** (1974) | US | Educational institutions receiving federal funds | Rights of parents (later of students at 18 or in higher education) to access and control disclosure of educational records |
| **HIPAA** (1996) + **HITECH** (2009) | US | Covered entities (healthcare providers, health plans, clearinghouses) and business associates | Privacy Rule, Security Rule (administrative, physical, technical safeguards), Breach Notification Rule; HITECH extended obligations to business associates and increased penalties |
| **PIPEDA** (2000) | Canada | The private sector in commercial activities (except provinces with a substantially similar law) | 10 fair information principles (accountability, identifying purposes, consent, limiting collection, limiting use/disclosure/retention, accuracy, safeguards, openness, individual access, challenging compliance); breach reporting where there is a "real risk of significant harm" |
| **GDPR** (2016/2018) | EU/EEA | Controllers and processors, also outside the EU under the conditions of Art. 3 | See above |
| **Digital Personal Data Protection Act (DPDP)** (2023) | India | Processing of digital personal data in India, and outside it if goods/services are offered in India | Roles of **Data Fiduciary** (≈ controller), **Data Principal** (≈ data subject), Data Processor, **Significant Data Fiduciary** (additional obligations: DPO, audit, DPIA); consent and **Consent Managers**; Data Protection Board of India; penalties up to INR 250 crore; implementing rules adopted at the end of 2025 with phased application |

In the region: Serbia has the **Law on Personal Data Protection** (*Zakon o zaštiti podataka o ličnosti*, 2018, applicable since 2019), aligned with GDPR, supervised by the Commissioner for Information of Public Importance and Personal Data Protection. Bosnia and Herzegovina, Montenegro, and North Macedonia are also aligning their laws with GDPR. For transfers from the EU to these countries, Chapter V mechanisms (e.g., SCCs) apply, because they do not have an adequacy decision.

> **On the exam:** HIPAA → a cloud provider storing ePHI must sign a **BAA (Business Associate Agreement)**. GDPR → a processor must have a **DPA under Art. 28**. The question "which document must be signed FIRST before transferring PHI to the cloud" targets the BAA.

## Jurisdictional differences (6.2)

| Dimension | EU (GDPR) | US | Canada (PIPEDA) | India (DPDP) |
|---|---|---|---|---|
| Approach | Omnibus (one general law) | Sectoral + state laws | General for the private sector + provincial | General law |
| Definition | Broad (identifiable person) | Narrower, depends on the law | Information about an identifiable individual | Digital personal data |
| Legal basis | Six bases, consent is only one of them | Mostly notice and choice, opt-out | Consent (express or implied depending on sensitivity) | Consent + certain legitimate uses |
| Transfer abroad | Restricted (adequacy, SCCs, BCRs) | Mostly free | Permitted with accountability for protection | Permitted except to countries the government restricts |
| Oversight | Independent supervisory authorities, EDPB | FTC, HHS OCR, state AGs | Office of the Privacy Commissioner | Data Protection Board |
| Breach notification | 72 h to the supervisory authority | Varies by state and sector | Where there is a real risk of significant harm | To the Board and affected persons |

Other well-known laws: Brazil's **LGPD**, China's **PIPL** (strict transfer and localization rules), Japan's **APPI**, Australia's **Privacy Act 1988** (Australian Privacy Principles), Switzerland's **nFADP** (since 2023).

Practical rule: when an organization operates in multiple jurisdictions, it builds its program to the **strictest** applicable requirement (often GDPR) and adds local specifics (localization, notification deadlines).

## Standard privacy requirements (6.2)

### ISO/IEC 27018

A code of practice for the protection of PII in the **public cloud when the provider acts as a PII processor**. It extends the ISO/IEC 27002 controls. Key provider obligations:

- processing PII only according to the customer's instructions, no use for marketing or advertising without explicit consent,
- transparency: disclosure of subprocessors and the locations where PII may be processed,
- notifying the customer of government requests for PII disclosure, except where prohibited by law,
- notifying the customer of a PII breach,
- assisting the customer in fulfilling data subject rights,
- return, transfer, and secure deletion of PII at the end of the contract,
- staff confidentiality and restricted access.

Related standards: **ISO/IEC 27017** (security controls for cloud services, for both the provider and the customer), **ISO/IEC 27701** (Privacy Information Management System, PIMS; the 2019 edition was an extension of ISO 27001, while the 2025 edition is a standalone management system that can be certified even without ISO 27001).

### GAPP

The **Generally Accepted Privacy Principles** (AICPA and CICA) define ten principles:

| # | Principle | Essence |
|---|---|---|
| 1 | Management | Policies, accountability, roles for privacy |
| 2 | Notice | Notice of purpose and practices |
| 3 | Choice and consent | Data subject choice and consent |
| 4 | Collection | Collection only for the stated purposes |
| 5 | Use, retention and disposal | Use only for the purpose, retention as long as needed, secure disposal |
| 6 | Access | Access to and correction of one's own data |
| 7 | Disclosure to third parties | Disclosure to third parties only for the stated purposes and with consent |
| 8 | Security for privacy | Protection against unauthorized access |
| 9 | Quality | Accurate, complete, and relevant data |
| 10 | Monitoring and enforcement | Monitoring compliance and handling complaints |

In 2020 the AICPA published a successor, the **Privacy Management Framework**, but the exam still uses GAPP as the reference.

### Comparison of frameworks

| | GDPR | ISO/IEC 27018 | ISO/IEC 27701 | GAPP |
|---|---|---|---|---|
| Type | Law | Code of practice (controls) | Management system (certifiable) | Principles |
| Mandatory? | Mandatory | Voluntary / contracted | Voluntary | Voluntary |
| Focus | All controllers and processors | Public cloud provider as a PII processor | Controllers and processors, PIMS | The organization's privacy program |
| Evidence of compliance | Accountability, DPIA, records | Certification alongside ISO 27001 | Certificate | Assessment / SOC 2 privacy criteria |

## Privacy Impact Assessment (6.2)

A **PIA (Privacy Impact Assessment)** is a systematic assessment of how a project, system, or process affects privacy and which measures reduce the risk. In GDPR it is the **DPIA** (Data Protection Impact Assessment, Art. 35), mandatory when processing is likely to result in a high risk to the rights and freedoms of individuals.

When to perform a PIA: **before** processing starts or before migrating to the cloud (privacy by design), and again upon significant changes (a new provider, a new purpose, an AI model over personal data).

Typical steps (GDPR Art. 35 and ISO/IEC 29134):

1. Determine the need (screening: is it high risk?).
2. Describe the processing: data, data subjects, purposes, flows, locations, providers and subprocessors involved.
3. Assess necessity and proportionality (legal basis, minimization, retention).
4. Identify and assess risks to individuals (not only to the organization).
5. Determine mitigation measures (encryption, pseudonymization, access restriction, contracts).
6. Consult the DPO and, if the residual risk remains high, carry out prior consultation with the supervisory authority (Art. 36).
7. Document, approve, integrate into the project, and review regularly.

### Scenario: migrating an HR system to SaaS

An EU company is moving HR data (including sick leave health data) to a SaaS provider from the US:

- the data includes special categories, so a DPIA is likely mandatory,
- the provider is a processor: a DPA under Art. 28, a subprocessor list, and ISO 27018 / 27701 as evidence of practice are needed,
- transfer to the US: check whether the provider is certified under the EU-US DPF, or use SCCs with a TIA,
- regions: request storage in the EU where possible, encryption with company-controlled keys if the risk is high,
- data subject rights and deletion at the end of the contract regulated by contract.

> **On the exam:** a PIA/DPIA is done **before** processing or migration, not after an incident. If a question describes a new project with personal data in the cloud and asks what comes FIRST, and a PIA is offered alongside technical controls, the PIA is usually the correct answer because it determines which controls are needed.

## Privacy and AI services in the cloud

New topics in the 2026 outline also touch privacy: generative AI services in the cloud process prompts, documents, and logs that often contain personal data.

| Question | What to check |
|---|---|
| Does the provider use data for training? | Contractual prohibition or opt-out; enterprise terms usually exclude training on customer data |
| Where are prompts processed? | The inference processing region (cross-region inference can move data out of the EU) |
| How long are prompts and responses retained? | Retention for abuse monitoring, the possibility to opt out |
| Legal basis and transparency | Whether data subjects have been informed that their data is processed by AI |
| Automated decision-making | GDPR Art. 22: the right not to be subject to a decision based solely on automated processing with legal effects, with exceptions and safeguards |
| Role under the EU AI Act | The organization is most often a **deployer**, and the model supplier a **provider**; obligations depend on the risk category |
| DPIA | New technology + personal data often means a mandatory DPIA |

### Scenario: a foreign government request

A European hospital uses a US cloud provider in an EU region. The provider receives a US government warrant under the CLOUD Act for one patient's data.

- For the provider this is a **conflict of laws**: the CLOUD Act requires disclosure, while GDPR Art. 48 restricts transfer without an international agreement. The CLOUD Act provides the possibility for the provider to challenge the warrant if disclosure would violate the law of a foreign country.
- For the hospital as controller, the risk is managed **in advance**: by contract (the provider challenges overly broad requests, notifies the customer when permitted, publishes a transparency report), by the choice of provider and region, and by encryption with hospital-controlled keys (external HSM / HYOK), so the provider has no readable data.
- Exam takeaway: an answer that says "move the data to another region of the same provider" doesn't solve the problem, because jurisdiction follows the **provider**, not just the location.

## Privacy roles (overview)

| GDPR | DPDP (India) | HIPAA | Description |
|---|---|---|---|
| Data subject | Data Principal | Individual | The person the data relates to |
| Controller | Data Fiduciary | Covered entity | Determines the purpose and means of processing |
| Processor | Data Processor | Business associate | Processes on behalf of the controller |
| Sub-processor | — | Subcontractor (BA) | The processor's subcontractor |
| Supervisory authority | Data Protection Board | HHS OCR | Oversight authority |

In most cases the cloud provider is the **processor**, and the cloud customer the **controller**. The provider becomes a controller for data it processes for its own purposes (e.g., billing data, telemetry for its own development). More detailed roles (owner, custodian, steward) are in module 14.

## Typical exam traps

| Claim | Correct |
|---|---|
| "Data in the EU region of a US provider is not accessible to US authorities" | The CLOUD Act targets the provider, regardless of location; encryption with customer keys and the contract help |
| "PCI DSS is a law" | A contractual obligation toward the card brands (except where a state incorporates it into regulation) |
| "Pseudonymized data is not personal data" | It is; only truly anonymized data falls outside GDPR |
| "The provider as processor is liable instead of the controller" | The controller remains accountable; the processor has its own obligations under Art. 28 and 32 |
| "A DPIA is done after an incident" | Before processing and upon significant change |
| "Consent is the only legal basis under GDPR" | One of six; in employment it is often invalid due to the imbalance of power |
| "FERPA protects health data" | FERPA protects educational records; health data is protected by HIPAA |
| "ISO 27018 is for all cloud providers as controllers" | For the public cloud when the provider acts as a PII processor |

## Summary

- The cloud moves data across borders while laws remain national: CLOUD Act vs GDPR, localization, retention vs erasure, eDiscovery vs data protection. The first step is data mapping and legal counsel.
- Legal risks of the cloud: location, subprocessors, government requests, legal hold, seizure, provider bankruptcy, limited liability, AI services; mitigated through the contract, region selection, and encryption.
- EU framework: GDPR, NIS2, DORA (since 17 January 2025), EU AI Act, Data Act (switching), CRA. US: sectoral (HIPAA/HITECH, GLBA, SOX, FERPA, COPPA), CCPA, SEC rules.
- Forensics: 27037 evidence handling, 27041 method validity, 27042 analysis and interpretation, 27043 investigation process; CSA maps these standards to the cloud.
- eDiscovery: EDRM phases, ISO/IEC 27050 (1 concepts, 2 governance and management, 3 practice, 4 technical readiness), legal hold as soon as litigation is reasonably anticipated.
- Regulated data (PHI, GDPR personal data) vs contractual data (PCI DSS, NDA); the same data can be both.
- GDPR: principles, legal bases, rights, Art. 28 DPA, 72 h notification, DPIA, transfers (adequacy, SCCs, BCRs, DPF), fines 4%/2%. HIPAA requires a BAA, PIPEDA has 10 principles, India's DPDP Act uses Data Fiduciary and Data Principal.
- ISO/IEC 27018 for the public cloud as a PII processor, 27701 for a PIMS, GAPP ten principles.
- PIA/DPIA before processing, focused on risk to individuals and mitigation measures.
