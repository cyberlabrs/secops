## Exam objectives: 1.4, 1.5 and 1.6

- **1.4 Understand legal, regulatory, and compliance issues that pertain to information security in a holistic context**
  - Cybercrimes and data breaches
  - Licensing and Intellectual Property (IP) requirements
  - Import/export controls
  - Transborder data flow
  - Issues related to privacy (GDPR, California Consumer Privacy Act, Personal Information Protection Law, Protection of Personal Information Act, HIPAA)
  - Contractual, legal, industry standards, and regulatory requirements
- **1.5 Understand requirements for investigation types (i.e., administrative, criminal, civil, regulatory)**
- **1.6 Develop, document, and implement security policy, standards, procedures, and guidelines**

In the 2024 outline, the list of privacy laws in 1.4 did not include HIPAA (HIPAA was only implied then), and objective 1.5 listed **industry standards** as a fifth investigation type. The 2027 outline keeps four types: administrative, criminal, civil, and regulatory; treat investigations under industry standards (e.g., PCI forensics) as a subtype of regulatory or contractual ones.

The CISSP is not a law exam: it does not ask for articles of law, but for you to recognize the **category of law**, **which law applies to the scenario**, and what the organization must do (notify, obtain consent, license, report).

> **On the exam:** a security professional is not a lawyer. When a scenario has legal ambiguity (jurisdiction, reporting obligation, cooperation with law enforcement), the BEST answer is almost always to **consult legal counsel** before acting.

## Categories of law (1.4)

| Category | Who the parties are | Goal | Standard of proof | Penalty |
|---|---|---|---|---|
| **Criminal law** | The state against an individual/organization | Punishment and protection of society | **Beyond a reasonable doubt** | Prison, fine, probation |
| **Civil law / tort law** | An individual or organization against another party | Compensation for damages | **Preponderance of the evidence** (more than 50%) | Damages (compensatory, punitive, statutory) |
| **Administrative / regulatory law** | Government agencies (regulators) | Enforcing regulations | Usually preponderance of the evidence | Fines, bans on operating, corrective measures |
| **Contract law** | Contracting parties | Performance of the contract | Preponderance of the evidence | Damages, termination |

**Legal systems** around the world: **common law** (precedents; US, UK), **civil law** (codified law; continental Europe, the Balkan region), **religious law** (Sharia and others), **customary law**, and mixed systems. For the exam, what matters is that laws differ across jurisdictions, which complicates investigations and data transfers.

### Types of damages in civil law

| Type | Meaning |
|---|---|
| **Compensatory damages** | Compensation for the actual loss |
| **Punitive damages** | Punishment for particularly egregious conduct, deterrence |
| **Statutory damages** | An amount set by law per violation (e.g., copyright) |

## Cybercrimes and data breaches (1.4)

| Attack category | Examples |
|---|---|
| Computer as the **target** | Unauthorized access, DoS, ransomware against infrastructure |
| Computer as the **tool** | Fraud, identity theft, distribution of illegal content |
| Computer **incidentally involved** | Evidence of a crime on a device (drug trafficking records) |

### Laws the exam mentions

| Law / instrument | Jurisdiction | Essence |
|---|---|---|
| **Computer Fraud and Abuse Act (CFAA)** | US | Unauthorized access to "protected computers" (federal, financial, used in interstate commerce) |
| **Electronic Communications Privacy Act (ECPA)** | US | Protection of electronic communications from interception |
| **CALEA** | US | Telecom operators must enable lawful interception |
| **Identity Theft and Assumption Deterrence Act** | US | Identity theft as a federal crime |
| **Budapest Convention on Cybercrime** (Council of Europe Convention on Cybercrime, 2001) | International (including Bosnia and Herzegovina, Serbia, Montenegro, Croatia) | Harmonization of offenses and international cooperation in investigations |
| **NIS2 Directive** (EU 2022/2555) | EU | Security and incident reporting obligations for essential and important entities; personal liability of management; early warning within 24 h, notification within 72 h |
| **DORA** (EU 2022/2554) | EU financial sector | Digital operational resilience, ICT incidents, testing, third-party risk |
| **Sarbanes-Oxley (SOX)** | US, publicly traded companies | Accuracy of financial reporting; internal controls (COSO), CEO/CFO accountability |
| **GLBA** | US, financial institutions | Protection of customers' financial data, Safeguards Rule, privacy notice |
| **FISMA** | US, federal agencies | Information security program based on NIST standards |

### Data breach

A **data breach** is a confirmed incident in which data was disclosed, modified, or destroyed without authorization. Key obligations:

| Regime | Who is notified | Deadline |
|---|---|---|
| **GDPR** Art. 33/34 | The supervisory authority; data subjects if there is a high risk to their rights | **72 hours** from becoming aware (supervisory authority); data subjects "without undue delay" |
| **HIPAA Breach Notification Rule** | Affected individuals, HHS; the media if more than 500 people in a state | No later than **60 days** from discovery |
| **US state laws** (all states) | Affected residents, sometimes the state attorney general | Varies, often 30–60 days |
| **NIS2** | CSIRT / competent authority | Early warning 24 h, notification 72 h, final report within one month |
| **PCI DSS** (contractual) | Card brands and the acquirer | Immediately, per contract |

Encrypted data with an uncompromised key is often exempt from the obligation to notify individuals (**safe harbor**).

### Decision flow when a personal data breach is suspected

1. Contain the incident and preserve evidence according to the incident response plan.
2. Establish the facts: what data, how many people, from which jurisdictions, whether the data was encrypted and whether the key was compromised.
3. Involve legal counsel, the DPO, and management; assess the risk to the rights and freedoms of individuals.
4. Determine the applicable regimes and deadlines (GDPR, HIPAA, NIS2, customer contracts, PCI DSS).
5. Notify the supervisory authority and, as needed, affected individuals, card brands, the insurer, and partners.
6. Document the decision and its rationale, even when it is concluded that notification is not required (GDPR requires a record of all breaches).
7. Lessons learned and corrective actions.

A controller that uses a processor remains accountable: the processor must notify the controller without undue delay, and the controller notifies the supervisory authority.

> **On the exam:** the decision on whether and how to notify the regulator and the public is made by management with legal counsel, based on the incident response plan, not by a SOC analyst. The technical team gathers facts and evidence.

## Licensing and intellectual property (1.4)

| Form of IP | What it protects | Duration (typical) | Registration | Example |
|---|---|---|---|---|
| **Copyright** | The expression of an idea: code, text, music, design | Author's life + 70 years (US/EU); work for hire 95 years from publication or 120 from creation | Arises automatically, registration optional | An application's source code |
| **Trademark** | A sign, name, or logo that distinguishes goods/services | 10 years, renewable indefinitely | Registration (™ unregistered, ® registered) | Product logo and name |
| **Patent** | A novel, useful, non-obvious invention | **20 years** from filing | Mandatory, public disclosure of the invention | A new compression algorithm in hardware |
| **Trade secret** | Confidential business information that provides an advantage | As long as it remains secret | None; protected by NDAs and controls | A recipe, a ranking algorithm |

A **trade secret** requires the organization to take reasonable measures to keep it secret (NDA, access control, classification); without them it loses protection. A patent is the opposite: protection in exchange for public disclosure.

Laws: **DMCA** (US; prohibits circumventing copy protection, safe harbor for ISPs with notice-and-takedown), **Economic Espionage Act** (US, theft of trade secrets), **TRIPS** (WTO agreement on IP), **WIPO** treaties.

### Software licensing

| License type | Description |
|---|---|
| **Contractual license** | A written contract between the vendor and the customer |
| **Shrink-wrap** | Terms accepted by opening the package |
| **Click-through / click-wrap** | Acceptance by clicking during installation |
| **Cloud / SaaS subscription** | Terms of service, per-user subscription |
| **Open source** | Permissive (MIT, Apache 2.0, BSD) or **copyleft** (GPL: a derivative work that is distributed must be under the same license) |

Risks: unlicensed software (criminal and civil liability, vendor audits via the BSA), violating a copyleft license in a commercial product, exceeding the number of licenses. Controls: software inventory, an SBOM with license data (module 4), a policy on the use of open-source components, software asset management (SAM).

> **On the exam:** an employee writes code during working hours and on the employer's equipment: the copyright owner is the employer (**work for hire**), unless the contract says otherwise. To protect an algorithm you do not want to publish, the correct choice is a **trade secret**, not a patent.

## Import/export controls (1.4)

| Regime | What it regulates |
|---|---|
| **ITAR** (International Traffic in Arms Regulations, US, State Department) | Military items and technologies on the USML |
| **EAR** (Export Administration Regulations, US, Department of Commerce, BIS) | Commercial and dual-use items on the CCL, including cryptography |
| **Wassenaar Arrangement** | Multilateral arrangement on export controls for conventional arms and dual-use goods and technologies (including cryptography) |
| **EU Dual-Use Regulation (2021/821)** | Export control of dual-use goods from the EU |
| **Import restrictions** | Some countries restrict, or require a license for, the import and use of encryption (e.g., mandatory registration of cryptographic products) |

In practice: exporting software with strong cryptography to embargoed countries is prohibited; a **deemed export** means that even showing controlled technology to a foreign national within the country can be an export. Before shipping a laptop with an encrypted disk, or before a cloud deployment in a new country, check the import rules.

## Transborder data flow (1.4)

**Transborder data flow** is the movement of data (especially personal data) across national borders. The issues are **data sovereignty** (data is subject to the laws of the country where it is located), **data localization** (the law requires data to remain in the country, e.g., Russia, China), and **access by foreign authorities** (e.g., the US CLOUD Act).

| GDPR mechanism for transfers outside the EEA | Description |
|---|---|
| **Adequacy decision** | The European Commission has determined that a country provides an adequate level of protection (e.g., the UK, Japan, Switzerland, the US via the **EU-U.S. Data Privacy Framework** for certified companies) |
| **Standard Contractual Clauses (SCC)** | Contractual clauses adopted by the Commission, with a transfer impact assessment (TIA) |
| **Binding Corporate Rules (BCR)** | Internal rules of a multinational group approved by a supervisory authority |
| **Derogations** (Art. 49) | Explicit consent, performance of a contract, important public interest; only for occasional transfers |

History for the exam: **Safe Harbor** (invalidated in 2015, the Schrems I ruling) → **Privacy Shield** (invalidated in 2020, Schrems II) → **Data Privacy Framework** (2023).

## Privacy (1.4)

### OECD principles and GDPR

The **OECD Privacy Guidelines** (1980, revised 2013) are the foundation of most laws: collection limitation, data quality, purpose specification, use limitation, security safeguards, openness, individual participation, accountability.

| GDPR element | Content |
|---|---|
| Territorial scope | Organizations in the EU, and outside the EU if they offer goods/services to, or monitor the behavior of, people in the EU |
| Principles (Art. 5) | Lawfulness, fairness, transparency; purpose limitation; minimization; accuracy; storage limitation; integrity and confidentiality; **accountability** |
| Legal bases (Art. 6) | Consent, contract, legal obligation, vital interest, public interest, legitimate interest |
| Data subject rights | Access, rectification, erasure (right to be forgotten), restriction, portability, objection, the right not to be subject to solely automated decisions |
| Roles | **Controller** (determines purpose and means), **processor** (processes on behalf of the controller), **DPO** (data protection officer) |
| Obligations | Privacy by design and by default, DPIA for high risk, records of processing, breach notification within 72 h |
| Fines | Up to **EUR 20 million or 4%** of global annual turnover (whichever is higher); lower tier EUR 10 million / 2% |

### Other privacy laws from the outline

| Law | Jurisdiction | Key points |
|---|---|---|
| **CCPA / CPRA** (California Consumer Privacy Act, amended by the California Privacy Rights Act) | California, US | Right to know, delete, correct, **opt out of sale and sharing**, limit the use of sensitive data; the CPPA agency; private right of action for data breaches |
| **PIPL** (Personal Information Protection Law) | China | Similar to GDPR, strict rules for cross-border transfers (CAC security assessment, standard contract, certification), localization for critical infrastructure operators |
| **POPIA** (Protection of Personal Information Act) | South Africa | Eight conditions for lawful processing, the Information Regulator, "responsible party" and "operator" (equivalents of controller and processor) |
| **HIPAA** (Health Insurance Portability and Accountability Act) + **HITECH** | US, healthcare | Protects **PHI**; Privacy Rule, Security Rule (administrative, physical, technical safeguards), Breach Notification Rule; "covered entities" and "business associates" with a **BAA** contract |
| **ZZLP** (personal data protection laws in the region) | Serbia, Bosnia and Herzegovina, Montenegro | Largely aligned with GDPR |
| **PIPEDA** | Canada | Privacy in the private sector |
| **COPPA** | US | Children under 13, parental consent |
| **FERPA** | US | Education records |

> **On the exam:** recognize the law by **data type and jurisdiction**: health data in the US = HIPAA; cards = PCI DSS (contractual, not law); US financial institutions = GLBA; US public companies = SOX; EU citizens = GDPR; California = CCPA/CPRA; China = PIPL; South Africa = POPIA.

### Scenarios: which law applies

| Scenario | Primary regime |
|---|---|
| A Belgrade company sells online subscriptions to German citizens | GDPR (territorial scope: offers services to people in the EU) and the local data protection law (ZZPL) |
| A clinic in Texas sends patient images to a cloud provider | HIPAA; the provider is a business associate and signs a BAA |
| A web shop in Sarajevo accepts Visa and Mastercard cards | PCI DSS (contractual obligation through the acquirer) and the local data protection law |
| A Chinese subsidiary sends customer data to headquarters in the EU | PIPL (cross-border transfer) and GDPR on the recipient's side |
| A California startup sells data on user behavior to advertisers | CCPA/CPRA: notice and a "Do Not Sell or Share" opt-out |
| A bank listed on the NYSE changes its general ledger system | SOX (internal controls over financial reporting) and GLBA |
| A power grid operator in Croatia has a ransomware incident | NIS2 (early warning within 24 h) and the national cybersecurity law |

### Employee privacy and monitoring

An organization may monitor the use of business systems, but it must: have a clear policy (AUP), notify employees in advance (a login banner, a signed acknowledgment), and monitor proportionally to the purpose and in accordance with labor law and privacy law. A **login banner** removes the "reasonable expectation of privacy" and makes it easier to use evidence. In the EU, systematic employee monitoring often requires a DPIA and consultation with worker representatives.

### Privacy by Design (Ann Cavoukian): seven principles

| Principle | Essence |
|---|---|
| Proactive not reactive | Prevent, don't fix |
| Privacy as the default | Protection without any action by the user |
| Privacy embedded into design | Part of the architecture, not an add-on |
| Full functionality (positive-sum) | Privacy and functionality, not either-or |
| End-to-end security | Protection throughout the entire data lifecycle |
| Visibility and transparency | Verifiability |
| Respect for user privacy | User-centric |

### PII, PHI and related terms

| Term | Meaning |
|---|---|
| **PII** | Information that identifies or can identify a person, directly or in combination |
| **PHI** | Health information linked to an individual (HIPAA) |
| **Pseudonymization** | Replacing identifiers, but re-identification is possible with additional information; still personal data under GDPR |
| **Anonymization** | Irreversibly removing the possibility of identification; no longer personal data |
| **Data minimization** | Collecting only what is needed for the purpose |

## Contractual, legal, industry standards, and regulatory requirements (1.4)

| Source of the requirement | Example | Consequence of non-compliance |
|---|---|---|
| **Law** (legal) | GDPR, HIPAA, NIS2 | Fines, criminal liability |
| **Regulation** (regulatory) | Central bank rules, FFIEC, telecommunications agencies | Fines, revocation of a license |
| **Industry standard** | PCI DSS, SWIFT CSP, ISO 27001 when a customer requires it | Loss of the right to process cards, loss of market |
| **Contract** | SLA, DPA, BAA, right to audit, incident reporting obligation | Damages, termination |

A **compliance** program maps all requirements to controls (one control can satisfy multiple requirements: a **unified control framework**), tracks evidence, and reports to management. For compliance questions the rule is: the law is the minimum, and risk and contracts may require more.

## Investigation types (1.5)

| Type | Who initiates | Purpose | Standard of proof | Particulars |
|---|---|---|---|---|
| **Administrative** (operational, internal) | The organization (HR, security) | Policy violation, operational problem, root cause analysis | Lowest; the organization's internal standard | Can escalate into a criminal or civil one, so evidence should be preserved as if it will |
| **Criminal** | Police, prosecutors | A crime | **Beyond a reasonable doubt** | Strict rules of evidence, chain of custody, a warrant is required; the organization loses control over the investigation |
| **Civil** | A party to the dispute (attorneys) | Damages, dispute | **Preponderance of the evidence** | **eDiscovery** (EDRM), legal hold, obligation to preserve relevant data |
| **Regulatory** | A regulator, or the organization on its order | Violation of regulations | Depends on the regulator | Mandatory cooperation; fines may follow |

### Scenario: from administrative to criminal

The SOC discovers that an employee is downloading large amounts of customer data. An administrative investigation begins (violation of the acceptable use policy). When it is established that the employee is selling the data to a competitor, it becomes a crime and a possible civil lawsuit. The key decision: **involve legal counsel and management** before contacting the police, because once the police take over the case, the organization loses control over the pace, and the evidence becomes public in the proceedings. Evidence collected from the start with a **chain of custody** remains usable.

### Rules of evidence (overview; details in module 12)

| Type of evidence | Description |
|---|---|
| **Real evidence** | A physical object (disk, laptop) |
| **Documentary evidence** | Written documents, logs; **best evidence rule** (the original), **parol evidence rule** (a written contract takes precedence over oral agreements) |
| **Testimonial evidence** | Testimony; an expert may give an opinion |
| **Direct / circumstantial / corroborative / hearsay** | Logs are technically hearsay, admissible as business records (business records exception) if they are kept regularly |

Evidence must be **relevant**, **material**, and **competent** (lawfully obtained), and **authentic, accurate, complete, convincing, and admissible**. Lawful acquisition: a **search warrant**, consent, or **exigent circumstances** (urgent circumstances when evidence is about to be destroyed). An organization must not act as an extension of the police without a warrant; if the police ask a private company to conduct a search, the company becomes an agent of the state and constitutional limits apply. **Entrapment** (inducing someone to commit a crime) is avoided, while **enticement** (a honeypot that merely provides an opportunity) is acceptable.

> **On the exam:** the difference between standards of proof comes up often. "Beyond a reasonable doubt" is criminal, "preponderance of the evidence" is civil. An administrative investigation has the most lenient standard, but evidence should be collected as if for court.

### Investigations under industry standards

The 2024 outline also had an **industry standards** type: an investigation required by an industry body or contract rather than by law. The best-known example is the **PCI Forensic Investigator (PFI)**, whom the card brands engage after a suspected compromise of card data. The organization is contractually obligated to cooperate, and the findings affect fines and compliance status. In the 2027 outline, such investigations fall under regulatory/contractual requirements.

### Investigations compared at a glance

| Question | Administrative | Criminal | Civil | Regulatory |
|---|---|---|---|---|
| Who controls the pace | The organization | Police and prosecutors | The parties and the court | The regulator |
| Is it public | Mostly not | Yes, in the proceedings | Yes, in the proceedings | Fines are often published |
| Outcome | Disciplinary action, process fix | Verdict, sentence | Damages | Fine, mandated measures |
| Role of the security team | Leads or supports | Preserves evidence, cooperates through legal counsel | Legal hold, eDiscovery | Provides evidence about controls |

### eDiscovery and legal hold

A **legal hold** (litigation hold) is an order to preserve all data relevant to an anticipated or ongoing dispute, suspending routine deletion under the retention policy. **EDRM** (Electronic Discovery Reference Model): information governance → identification → preservation → collection → processing → review → analysis → production → presentation. Destroying data after a dispute is reasonably anticipated is **spoliation** and carries sanctions.

## Policy, standards, procedures, and guidelines (1.6)

| Document | Mandatory? | Level | Who approves | Example |
|---|---|---|---|---|
| **Policy** | Mandatory | High, strategic: what and why; technology-neutral | Senior management | "All access to business systems requires strong authentication" |
| **Standard** | Mandatory | Concrete, measurable rules and technologies | CISO / committee | "MFA must be FIDO2 or TOTP; passwords at least 14 characters" |
| **Baseline** | Mandatory | Minimum level of security for a type of system | Technical owners | CIS Benchmark Level 1 for Ubuntu 24.04 |
| **Procedure** | Mandatory | Step by step: how | Process owners | "How to enable MFA for a new employee: steps 1–7" |
| **Guideline** | **Recommendation**, optional | Advice, best practice | Expert team | "We recommend a password manager" |

Policies are further divided into:

| Policy type | Description |
|---|---|
| **Organizational / program policy** (umbrella) | Establishes the program, roles, authority; signed by management |
| **Issue-specific policy** | A specific topic: acceptable use (AUP), email, BYOD, AI use, cloud |
| **System-specific policy** | Rules for a specific system (e.g., who may change the configuration of the payment system) |

Policies are also divided by purpose: **regulatory** (required by law), **advisory** (describes expected behavior and consequences), **informative** (informs, with no obligation).

### Document lifecycle

| Phase | Activities |
|---|---|
| Development | Risk and requirements assessment, involving stakeholders (legal, HR, the business) |
| Approval | Management signature for policies; committee for standards |
| Publication and communication | Availability, training, acknowledgment |
| Enforcement | Technical controls, monitoring, sanctions |
| Exceptions | A formal **exception process**: justification, compensating controls, the risk owner signs, expiration date |
| Review | At least annually and after major changes or incidents |
| Retirement | Archiving obsolete versions, version control |

### Scenario: a non-compliant standard

The policy says sensitive data is encrypted at rest. The standard prescribes AES-256. A new IoT system supports only AES-128. The correct course is neither to change the policy nor to ignore the standard, but a formal **exception** with a risk assessment, compensating controls (segmentation, monitoring), and an expiration date, signed by the risk owner.

> **On the exam:** a policy is mandatory, general, and technology-neutral; a standard is mandatory and specific; a procedure is mandatory and step by step; a guideline is the only **optional** document. If a question asks for the document that "management approves and that provides direction", it is the policy.

### Example document chain: passwords and MFA

| Level | Text |
|---|---|
| Access control policy | "Access to information systems is permitted only to authenticated and authorized users, in proportion to the data classification." |
| Authentication standard | "Phishing-resistant MFA (FIDO2/WebAuthn) is mandatory for remote and privileged access; passwords at least 14 characters, checked against a list of compromised passwords." |
| Baseline | "Entra ID Conditional Access policies CA-01 to CA-07 applied to all tenants." |
| Procedure | "Registering a security key for a new administrator: in-person identification with an ID card, issuing two keys, registration, test, record in the CMDB." |
| Guideline | "A password manager is recommended for employees' personal accounts." |

When technology changes (e.g., passkeys), the standard and procedure change, while the policy stays the same. That is why policies must be technology-neutral.

### Hierarchy and traceability

Law and business objectives → **policy** → **standards** and **baselines** → **procedures** → configurations and records. Every procedure must be traceable to a policy, and every policy to a requirement or risk. A policy without enforcement and measurement has no value for due care.

## A holistic approach to compliance

"Holistic context" in objective 1.4 means that legal requirements are not considered in isolation, but together with risk, contracts, and business objectives.

| Issue | How a holistic program handles it |
|---|---|
| A new service in a new country | Assessment of local privacy laws, localization, cryptography export, and incident reporting obligations before launch |
| A new SaaS vendor | DPA, SCC for transfers outside the EEA, right to audit, incident reporting obligation in the contract |
| A new AI product | GDPR (automated decision-making), EU AI Act classification, licenses for training data, IP over the output |
| A merger with a foreign company | Conflict of laws (e.g., the CLOUD Act and GDPR), technology export controls |

### Roles in compliance

| Role | Contribution |
|---|---|
| **Legal counsel** | Interpreting laws, contracts, contact with authorities |
| **Compliance officer** | Mapping requirements to controls, tracking evidence |
| **DPO** | Independent advice on data protection, contact with the supervisory authority |
| **CISO** | Technical and organizational measures, risk reporting |
| **Internal audit** | Independent verification of compliance |

### Legal liability and dealing with law enforcement

| Situation | Correct approach |
|---|---|
| The police request logs without a warrant | Legal counsel assesses the request; data is handed over in accordance with the law and policy |
| The organization is considering reporting an attack to the police | Management decides with legal counsel; consider the public nature of proceedings, loss of control, reporting obligations |
| A foreign regulator requests data | Check jurisdiction and conflict of laws before handing it over |
| An employee is a suspect | Act according to policy, with HR and legal counsel; respect privacy and labor law |

> **On the exam:** when choosing a jurisdiction, data transfer, or reporting obligation, the BEST choice is always to comply with the **strictest applicable** requirement or consult legal counsel, not to pick the "most favorable" law.

## Summary

- **Categories of law**: criminal (the state, beyond a reasonable doubt, prison), civil (damages, preponderance of the evidence), administrative/regulatory (agencies, fines), contract.
- **Cybercrime**: CFAA, ECPA, the Budapest Convention, NIS2 (24 h / 72 h), DORA, SOX, GLBA, FISMA.
- **Data breaches**: GDPR 72 h to the supervisory authority, HIPAA up to 60 days, safe harbor for encrypted data; the notification decision is made by management with legal counsel.
- **IP**: copyright (expression, automatic), trademark (sign, renewable), patent (20 years, publicly disclosed), trade secret (as long as it is secret, with reasonable measures); work for hire belongs to the employer.
- **Licenses**: contractual, shrink-wrap, click-through, SaaS, open source (permissive and copyleft); SAM and SBOM.
- **Export/import**: ITAR (military), EAR (dual-use, cryptography), Wassenaar, deemed export.
- **Transborder flow**: sovereignty and localization; adequacy, SCC, BCR; Safe Harbor → Privacy Shield → Data Privacy Framework.
- **Privacy**: OECD principles, GDPR (4% / EUR 20 million), CCPA/CPRA, PIPL, POPIA, HIPAA (PHI, BAA).
- **Investigations**: administrative, criminal, civil, regulatory; eDiscovery and legal hold; chain of custody from the first moment.
- **Documents**: policy (mandatory, general, management), standard and baseline (mandatory, specific), procedure (mandatory, steps), guideline (optional); exceptions formally, with the risk owner.
