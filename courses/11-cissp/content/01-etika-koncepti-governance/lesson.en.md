## Exam objectives: 1.1, 1.2 and 1.3

This module opens Domain 1 (**Security Governance and Risk Management**, 13.6% of the exam under the outline effective April 15, 2027) and sets the mindset that applies to the whole CISSP:

- **1.1 Understand, adhere to, and promote professional ethics**
  - ISC2 Code of Professional Ethics
  - Ethics in Artificial Intelligence (AI)
  - Organizational code of ethics
- **1.2 Understand and apply security concepts**
  - Confidentiality, integrity, availability, authenticity, and non-repudiation
- **1.3 Evaluate, apply, and sustain security governance principles**
  - Alignment of the security function to business strategy, goals, mission, and objectives
  - Organizational processes (acquisitions, divestitures, governance committees)
  - Organizational roles and responsibilities
  - Security control frameworks (ISO, NIST, COBIT, SABSA, PCI DSS, FedRAMP)
  - Due care and due diligence

In the 2024 outline the domain was called **Security and Risk Management** and carried 16% of the questions; objective 1.1 had no sub-item on ethics in AI, objective 1.3 read "Evaluate and apply" (without "sustain"), and the five properties from 1.2 were called the "5 Pillars of Information Security".

> **On the exam:** the CISSP does not ask you to know a command, but to choose the decision a CISO or risk advisor would make. The order of priorities is almost always the same: **human life and safety**, then law and ethics, then business objectives, and only then technical elegance. An answer that "fixes the technology" while skipping policy, management, or risk assessment is rarely BEST.

## ISC2 Code of Professional Ethics (1.1)

Every CISSP signs the **ISC2 Code of Professional Ethics**. It consists of a **preamble** and **four canons**. The canons are ordered by priority: when they conflict, the higher canon wins.

Preamble (essence): the safety and welfare of society and the common good, duty to our principals, and to each other, requires that we adhere, and be seen to adhere, to the highest ethical standards of behavior.

| Order | Canon (original) | Owed to | Practical meaning |
|---|---|---|---|
| 1 | **Protect society, the common good, necessary public trust and confidence, and the infrastructure** | Society | Do not let your work harm the public or critical infrastructure; support trust in systems |
| 2 | **Act honorably, honestly, justly, responsibly, and legally** | The law and the profession | Obey the law, tell the truth, do not exaggerate risk to sell a service |
| 3 | **Provide diligent and competent service to principals** | Principals (employer, client) | Work conscientiously, preserve confidentiality, do not accept work you are not competent for |
| 4 | **Advance and protect the profession** | The profession | Mentoring, sharing knowledge, not associating with those who damage the reputation of the profession |

Procedure: a violation of the code is reported to the ISC2 **Ethics Committee** through a formal complaint. A complaint can be filed by anyone affected by the violation; for canons 1 and 2 that can be any member of the public, for canon 3 only a principal (employer or client), and for canon 4 other professionals (certified members). The consequence can be a reprimand, suspension, or revocation of the certification.

### Scenario: conflict of canons

A client (principal) asks you to conceal a finding showing that the software managing hospital infusion pumps has a critical vulnerability, because disclosure would "hurt sales". Canon 3 says you serve the principal, but canon 1 (protect society) and canon 2 (legally and honestly) are higher. The correct line: insist on responsible / coordinated disclosure, document, escalate, and as a last resort decline the engagement. A false report is never an option.

> **On the exam:** when a question offers "loyalty to the employer" versus "public safety", canon 1 wins. But be careful: the canon does not give you the right to unilateral public disclosure. Internal channels first, then coordinated disclosure and the competent authorities.

### Other ethical frameworks the exam mentions

| Framework | What to know |
|---|---|
| **RFC 1087** "Ethics and the Internet" (IAB, 1989) | It is unethical to: gain unauthorized access to Internet resources, disrupt the intended use of the Internet, waste resources (people, capacity, computers), destroy the integrity of information, compromise users' privacy |
| **Ten Commandments of Computer Ethics** (Computer Ethics Institute) | "Thou shalt not use a computer to harm other people", "thou shalt not snoop around in other people's files", "thou shalt not copy software you have not paid for", "thou shalt think about the social consequences of the program you write" |
| **Organizational code of conduct** | Internal document, binding on employees, aligned with the law and the organization's values |

### Ethical dilemmas: how to think

| Situation | Wrong reflex | ISC2 answer |
|---|---|---|
| A colleague uses a pirated copy of a scanning tool at work | Ignore it, "everyone does it" | Canon 2 (legally): warn, report through internal channels, buy a license |
| During a pentest you find evidence of embezzlement outside the scope of the engagement | Investigate further on your own | Stop, document, report to the client's point of contact and legal department; do not exceed scope |
| A vendor offers a "gift" while you are evaluating its bid | Accept it while promising objectivity | Decline or report per the conflict-of-interest policy (canons 2 and 3) |
| You are not competent in forensics, and the client urgently needs it | Accept and "figure it out" | Canon 3: provide only services you are competent to perform; recommend an expert |
| Public forum: someone spreads false information about a vulnerability | Mock them | Canon 4: correct professionally, share accurate knowledge |
| A former employer offers a job to "check" a competitor's system | Accept, because it pays well | Canons 1 and 2: unauthorized access is a crime, decline |

The code is an obligation outside working hours too: behavior on social networks, at conferences, and in private engagements is subject to the same canons.

## Ethics in artificial intelligence (1.1, new in 2027)

The 2027 outline explicitly requires that you understand **Ethics in AI**. For the CISSP this is not about model training techniques but about governance: whether the organization uses AI responsibly, lawfully, and transparently.

| Principle | Question a manager asks | Example control |
|---|---|---|
| **Fairness** (no bias) | Does the model discriminate against groups of people? | Bias testing before production, diverse training data |
| **Transparency / explainability** | Can we explain why the model made a decision? | Model documentation (model cards), explainable methods for decisions with legal consequences |
| **Accountability** | Who is accountable for the model's decision? | Named owner of the AI system, human-in-the-loop for high-risk decisions |
| **Privacy** | Do training and use comply with privacy law? | Data minimization, DPIA, prohibition on entering personal data into public LLM services |
| **Safety & security** | Can the model be abused or manipulated? | Protection against prompt injection and data poisoning, output monitoring |
| **Human oversight** | Can a human stop or correct the system? | Ability to halt (kill switch), appeals process for those affected |

Reference frameworks to recognize: **NIST AI Risk Management Framework (AI RMF 1.0)** with the functions **Govern, Map, Measure, Manage**; **ISO/IEC 42001** (AI management system, AIMS, structure similar to ISO 27001); **ISO/IEC 23894** (AI risk management); the **EU AI Act** with a risk-based approach (prohibited, high-risk, limited, minimal risk); the **OECD AI Principles**.

> **On the exam:** if asked what comes FIRST when a business unit wants to introduce generative AI, the answer is a governance one: an AI acceptable use policy, a risk and privacy assessment, a named owner. A "blind" ban and uncontrolled permission are both bad answers.

### Organizational code of ethics

An organizational code of ethics must: have the support of top management (**tone at the top**), be written and available to everyone, be signed at hiring and periodically reaffirmed, include a reporting channel (including an anonymous one, with **whistleblower** protection), and define consequences. A CISSP **promotes** it (the objective says "promote"): through training, personal example, and reporting violations.

## Security concepts (1.2)

The classic **CIA triad** (Confidentiality, Integrity, Availability) is extended with **authenticity** and **non-repudiation**. The opposite of CIA is **DAD**: Disclosure, Alteration, Destruction/Denial.

| Property | Definition | Threat (DAD) | Typical controls |
|---|---|---|---|
| **Confidentiality** | Information available only to authorized parties | Disclosure: leaks, sniffing, shoulder surfing, social engineering | Encryption at rest and in transit, access control, classification, DLP |
| **Integrity** | Information and systems are not modified without authorization, are accurate and complete | Alteration: unauthorized modification, user error, malware | Hashes, MAC/HMAC, digital signatures, change control, input validation, separation of duties |
| **Availability** | Authorized users have timely and reliable access | Destruction/Denial: DoS, failure, natural disaster | Redundancy, backup, clusters, BCP/DRP, capacity, DDoS protection |
| **Authenticity** | Assurance that data, a message, or an entity is genuine and what it claims to be | Impersonation, spoofing | Authentication, certificates, signatures, MAC |
| **Non-repudiation** | The sender cannot deny sending, the recipient cannot deny receiving | Repudiation of a transaction | Digital signature (asymmetric key), trustworthy audit log, timestamping |

The three integrity goals ISC2 likes: preventing modifications by **unauthorized** users, preventing **unauthorized** modifications by authorized users, and maintaining internal and external **consistency** of data (these are the goals of the Clark-Wilson model, module 6).

### Non-repudiation: why symmetric is not enough

| Mechanism | Integrity | Source authenticity | Non-repudiation |
|---|---|---|---|
| Hash (SHA-256) | Yes (detects accidental modification) | No | No |
| HMAC (shared key) | Yes | Yes (between the parties sharing the key) | **No**, both parties have the key |
| Digital signature (private key) | Yes | Yes | **Yes**, only the owner of the private key signs |

### Related terms

| Term | Meaning |
|---|---|
| **Identification, Authentication, Authorization, Accounting (IAAA)** | Identity claim, proof, permission, tracking (auditing + accountability) |
| **Accountability** | Ability to tie an action to an individual; requires unique identities and an audit trail |
| **Privacy** | An individual's right to control their personal data (not the same as confidentiality) |
| **Least privilege / need to know** | Minimum rights for the job / access only to information required for the task, even with the appropriate clearance |
| **Separation of duties (SoD)** | A critical task is split among several people so that fraud would require collusion |
| **Defense in depth** | Multiple layers of controls (administrative, technical, physical) |

> **On the exam:** the question "which control PRIMARILY provides non-repudiation" has the answer **digital signature**, not encryption and not HMAC. The question "which property does DDoS violate" is availability; "a modified amount in the database" is integrity; "a published customer list" is confidentiality.

### Recognize the property in the scenario

| Scenario | Property violated or required |
|---|---|
| Ransomware encrypts a file server and business stops | Availability (and integrity if data was modified) |
| An attacker changes the IBAN in a PDF invoice in transit | Integrity, authenticity |
| A customer claims they never approved a transfer from their account | Non-repudiation |
| An employee sends the payroll list to a personal email | Confidentiality |
| A fake site imitates a bank's portal | Authenticity |
| Database replication lags and two systems show different states | Integrity (consistency) |
| A power failure without a UPS shuts down the data center | Availability |
| A log file deleted to cover tracks | Integrity and accountability |

### Other fundamentals that appear in questions

- **Abstraction**: grouping objects with similar properties and assigning rights to the group (roles, classes).
- **Data hiding**: hiding data from subjects that have no need to see it (e.g., encapsulation, separate classification levels).
- **Security through obscurity**: relying on the secrecy of the design; never a sufficient control on its own (Kerckhoffs's principle says the opposite: only the key is secret).
- **Zero trust**: no request is trusted because of its location in the network; each one is verified (NIST SP 800-207, modules 6 and 9).
- **Trust but verify**: trust with monitoring and auditing.
- **Fail-safe / fail-secure**: when a control fails, the system goes into a state that protects people (fail-safe, e.g., doors open during a fire) or assets (fail-secure, doors stay locked). When life is at risk, fail-safe is chosen.

### Balancing the properties

The properties are often in tension. A hospital emergency system prioritizes **availability** and **integrity** (a wrong dose kills), a military intelligence system **confidentiality**, a financial transaction **integrity** and **non-repudiation**. The priority is set by the data owner based on business impact, not by the security team.

## Aligning security with the business (1.3)

**Security governance** is the set of responsibilities and practices through which the board and executive management provide strategic direction, ensure that objectives are achieved, that risk is managed appropriately, and that resources are used responsibly. Governance is the responsibility of the **board and senior management**; management executes.

| Term | Question | Horizon | Example |
|---|---|---|---|
| **Mission** | Why do we exist? | Permanent | "We provide secure digital banking services to the citizens of the region" |
| **Strategy / goals** | Where are we going? | 3–5 years (strategic plan) | "Become the leading digital bank, 70% of transactions on mobile" |
| **Objectives** | What exactly are we achieving? | 1 year (tactical plan) | "Roll out phishing-resistant MFA for all customers by the end of the year" |
| **Operational plan** | How, who, when? | Months, weeks | Project plan for the FIDO2 rollout, budget, people |

Security plans follow the same hierarchy: the **strategic plan** (long-term, about 5 years, reviewed annually), the **tactical plan** (mid-term, about one year: projects, procurement, hiring), the **operational plan** (short-term, detailed, updated often).

Security is aligned top-down: the policy and program are derived from the mission and objectives, not from the team's favorite tools. A **business case** for a security investment speaks the language of risk and money (reduced ALE, regulatory fines, lost revenue), not the language of CVEs.

> **On the exam:** the "top-down" approach is correct, "bottom-up" (IT initiates without management support) is weak. The most important success factor of a security program is **senior management support**. If a question asks what the FIRST step in establishing a program is, the answer is to secure management support and a mandate.

### Scenario: security as an enabler

Marketing wants to launch a mobile app in six weeks, and the security team asks for three months for a full pentest. A bad CISO blocks the project. A good CISO asks what the business goal is and what risk is acceptable, proposes a reduced launch scope (no payments in the first phase), threat modeling in the first week, automated testing in the pipeline, and a pentest before the second phase, while the product owner formally signs off on the residual risk. Security serves the business; it does not decide on its behalf.

| Security team behavior | Message to management |
|---|---|
| "No" with no alternative | Security is a brake |
| "Yes, with these controls and this residual risk" | Security is a partner |
| Report in CVSS scores | Management does not understand the priority |
| Report in money, likelihood, and impact on objectives | Management can decide |

## Organizational processes (1.3)

| Process | Security risk | What the CISSP does |
|---|---|---|
| **Acquisition / merger** | Inheriting unknown vulnerabilities, compromised systems, incompatible policies, regulatory obligations; insiders unhappy with the change | Due diligence before signing: assessment of the security posture, incident history, compliance; integration plan; segmentation until verified; policy alignment |
| **Divestiture / spin-off** | Leakage of data that stays with the parent company, leftover accounts and access, shared systems, keys and certificates | Inventory of data and systems that are leaving, sanitization, access revocation, rotation of secrets, transition services agreement (TSA) |
| **Governance committees** | Security decided in a silo | Security steering committee, risk committee, the board's audit committee; the CISO reports on risk |

A **governance committee** is made up of representatives of the business units, IT, legal, HR, risk, and security. It approves policies, project priorities, and budget, and accepts risk at the organizational level. The **audit committee** (part of the board of directors) oversees internal and external audit and financial reporting.

### Scenario: acquisition

A bank is buying a fintech startup. Before closing the deal, the CISO asks for penetration test results, a SOC 2 report, a list of incidents, and evidence of PCI DSS compliance. After closing, the networks are not merged immediately: the startup stays in a separate zone until an assessment is done, accounts are consolidated into the central IdP, and the bank's policies become binding with a deadline for compliance.

## Organizational roles and responsibilities (1.3)

| Role | Responsibility |
|---|---|
| **Board of directors / senior management** | Ultimate responsibility for security and risk; approves policy, risk appetite, budget; can be legally liable |
| **CEO** | Executive responsibility, risk owner at the organizational level |
| **CISO / CSO** | Leads the security program, advises management on risk, does not accept risk on behalf of the business; ideally reports outside IT (e.g., CEO, CRO, or the board) for independence |
| **CIO / CTO** | Technology and IT operations; conflict of interest if the CISO reports to the CIO |
| **Data / information owner** | Senior manager responsible for the data: classifies it, decides who has access, approves protection, **is accountable** for it |
| **Data custodian** | Implements protection as directed by the owner: backup, encryption, control configuration (often IT/ops) |
| **System owner** | Responsible for the system that processes the data, system security plan |
| **Data controller / processor** | GDPR terms: who determines the purpose and means of processing / who processes on behalf of the controller (modules 2 and 5) |
| **Security administrator** | Manages accounts, rights, and security tools |
| **Auditor** | Independently verifies whether controls are implemented and effective; reports to management |
| **User** | Follows policies, reports incidents |

**Accountability** cannot be delegated; **tasks** (responsibility for execution) can. Management can delegate implementation to the CISO, but remains accountable.

A useful tool is the **RACI matrix** (Responsible, Accountable, Consulted, Informed): exactly one "A" for each activity.

> **On the exam:** who is ULTIMATELY responsible for data protection? Senior management. Who classifies data? The data owner. Who makes backups? The custodian. Who accepts risk? The risk owner / management, never the administrator or the CISO alone.

## Security control frameworks (1.3)

A **control framework** is a structured set of controls and processes that makes a program complete, comparable, and auditable. The exam requires that you know the **purpose** of each framework and when to choose it.

| Framework | Owner | Purpose | Keywords |
|---|---|---|---|
| **ISO/IEC 27001** | ISO/IEC | Requirements for an ISMS; **certifiable** | PDCA, clauses 4–10, Statement of Applicability, Annex A (93 controls in 4 themes) |
| **ISO/IEC 27002** | ISO/IEC | Guidance for implementing the Annex A controls; not certifiable | Control descriptions, attributes |
| **NIST CSF 2.0** | NIST | Voluntary framework for managing cybersecurity risk, for all sectors | Functions **Govern, Identify, Protect, Detect, Respond, Recover**; profiles and tiers |
| **NIST SP 800-53 Rev. 5** | NIST | Catalog of security and privacy controls (mandatory for US federal systems) | 20 families (AC, AU, IR...), low/moderate/high baselines (SP 800-53B) |
| **NIST RMF (SP 800-37)** | NIST | Risk management process for systems | Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor (module 3) |
| **COBIT 2019** | ISACA | Governance and management of IT, aligning IT with business goals | Separation of governance from management, 40 objectives, goals cascade |
| **SABSA** | SABSA Institute | Business-driven **security architecture** methodology | 6x6 matrix: the questions What, Why, How, Who, Where, When across the Contextual, Conceptual, Logical, Physical, Component, Operational layers |
| **PCI DSS v4.0.1** | PCI SSC (card brands) | Contractual industry standard for protecting payment card data | 12 requirements, CDE, QSA, ROC/SAQ, customized approach |
| **FedRAMP** | GSA, US government | Standardized authorization of cloud services for federal agencies | Based on NIST 800-53; Low, Moderate, High levels; 3PAO, ATO |
| **COSO** | Treadway Commission | Internal control over financial reporting (SOX) | Five components: control environment, risk assessment, control activities, information & communication, monitoring |
| **ITIL** | Axelos | IT service management | Service management, change, incident |
| **CIS Controls v8** | CIS | Prioritized technical controls | 18 controls, Implementation Groups IG1–IG3 |

In the 2024 outline the sub-item listed "Payment Card Industry (PCI)"; it now explicitly says **PCI DSS**.

### NIST CSF 2.0 in brief

| Function | Purpose | Example categories |
|---|---|---|
| **Govern (GV)** | Strategy, roles, policy, oversight, supply chain risk management (new in 2.0) | Organizational context, risk management strategy, roles, policy, oversight, C-SCRM |
| **Identify (ID)** | Understanding assets and risks | Asset management, risk assessment, improvement |
| **Protect (PR)** | Safeguards | Identity management & access control, awareness & training, data security, platform security |
| **Detect (DE)** | Discovering events | Continuous monitoring, adverse event analysis |
| **Respond (RS)** | Reacting to an incident | Incident management, analysis, mitigation, reporting |
| **Recover (RC)** | Restoration | Incident recovery plan execution, communication |

**Profiles**: the Current Profile (current state) and the Target Profile (desired state); the difference is a gap that is turned into an action plan. **Tiers** (1 Partial, 2 Risk Informed, 3 Repeatable, 4 Adaptive) describe the rigor of risk management; they are not control maturity levels.

### SABSA matrix (layers)

| Layer | View | Question |
|---|---|---|
| Contextual | Business view | What the business does and why |
| Conceptual | Architect's view | What the security attributes and objectives are (business attributes profile) |
| Logical | Designer's view | Logical services and policies |
| Physical | Builder's view | Mechanisms and technologies |
| Component | Tradesman's view | Concrete products and tools |
| Operational | Service manager's view | Operation, maintenance, support |

The key idea of SABSA is **traceability**: every technical control must be traceable back to a business requirement. **Zachman** (a 6x6 matrix for enterprise architecture) and **TOGAF** (the ADM cycle) work similarly.

### COBIT 2019 and ISO 27001 in more detail

COBIT separates **governance** (Evaluate, Direct, Monitor: EDM, the board's job) from **management** (Align/Plan/Organize, Build/Acquire/Implement, Deliver/Service/Support, Monitor/Evaluate/Assess: APO, BAI, DSS, MEA). The goals cascade translates stakeholder needs into enterprise goals, then into alignment goals and governance and management objectives.

ISO/IEC 27001:2022 Annex A has four control themes: organizational (37), people (8), physical (14), and technological (34). The certificate is issued by an accredited certification body after a two-stage audit (Stage 1 documentation, Stage 2 implementation), with annual surveillance audits and recertification every three years.

### How to choose a framework

| Situation | Best choice |
|---|---|
| Customers want an internationally recognized management system certificate | ISO/IEC 27001 |
| Management wants a language for discussing cyber risk and a target profile | NIST CSF 2.0 |
| A US federal agency or a supplier of a federal system | NIST SP 800-53 + RMF, FedRAMP for cloud |
| Aligning IT investments with business goals, IT governance | COBIT |
| Security architecture derived from business requirements | SABSA |
| The organization processes cards | PCI DSS (contractually mandatory) |

> **On the exam:** distinguish a **law** (mandatory, government), a **contractual standard** (PCI DSS, mandatory by contract with the card brands), and a **voluntary framework** (NIST CSF, ISO 27001 until a customer or regulator requires it). SABSA and Zachman are architecture frameworks, COBIT is IT governance, ISO 27001 is an ISMS.

### Control types by category

| Category | Examples |
|---|---|
| **Administrative / managerial** | Policies, procedures, training, candidate screening, risk assessment |
| **Technical / logical** | Firewall, encryption, MFA, IDS, ACL |
| **Physical** | Fences, locks, guards, CCTV, mantrap |

Functional types (preventive, detective, corrective, deterrent, recovery, compensating, directive) are covered in detail in module 3 (1.9).

## Due care and due diligence (1.3)

| | **Due diligence** | **Due care** |
|---|---|---|
| Essence | Research, learning, assessment before and during a decision | Acting as a reasonable and prudent person; implementing measures |
| Question | "Do we know what risks exist?" | "Are we doing what a reasonable organization would do?" |
| Timing | Before (and continuously: verifying that controls work) | During (implementation and maintenance) |
| Examples | Vendor risk assessment, audit, vulnerability analysis, pre-acquisition review | Patching, enforcing policies, employee training, laptop encryption |
| Mnemonic | **D**iligence = **D**o detect / think | **C**are = **C**arry out / do |

The legal concept of the **prudent person rule**: management must act as a reasonable, prudent individual would act in the same circumstances. Failing to exercise due care means **negligence** and can lead to personal liability for management. The legal test for negligence: there was a duty, the duty was breached, damages occurred, and the breach was the proximate cause of the damages.

### Scenario

Two years ago a company performed a risk assessment and identified unencrypted laptops as a high risk (due diligence), but did nothing. A laptop with customer data was stolen. The company did not exercise **due care**; the fact that it knew about the risk makes the negligence even worse, because it shows that the harm was foreseeable.

> **On the exam:** "they researched" and "they assessed" = due diligence; "they implemented and maintain" = due care. When a question asks what protects management from an accusation of negligence, the answer is evidence that it acted with **due care** (documented policies, implemented controls, training).

## Governance in practice: continuous maintenance (1.3 "sustain")

The new word "sustain" in the 2027 outline emphasizes that governance is not a one-off project:

| Activity | Purpose |
|---|---|
| Periodic management review | Confirming that the program still matches the objectives and risk appetite |
| Metrics and KPIs/KRIs on a board dashboard | Measurability: MFA coverage, time to close critical vulnerabilities, percentage of training completed |
| Annual policy review | Alignment with changes in law, technology, and the business |
| Internal and external audit | Independent confirmation of effectiveness |
| Maturity assessment | CMMI, NIST CSF tiers, module 3 |

### Where to place the security function

| CISO reporting model | Advantage | Disadvantage |
|---|---|---|
| CISO → CIO | Close to IT, easier implementation | Conflict of interest: the CIO chooses between delivery speed and security |
| CISO → CEO | Visibility, authority | The CEO has little time for details |
| CISO → CRO / General Counsel | Alignment with risk and law | May lose technical influence |
| CISO → board (audit/risk committee) with an administrative line | Independence | Requires a mature organization |

The recommendation the exam likes: security must have **independence and access to the highest level** of decision-making, so that a conflict of interest with IT operations does not suppress risk.

A **KPI** (Key Performance Indicator) measures how well a process is working (e.g., 95% of systems patched within 30 days). A **KRI** (Key Risk Indicator) is an early signal that risk is rising (e.g., the number of unapproved SaaS applications, the number of policy exceptions).

## Typical traps in this module's questions

| Trap | How to recognize it |
|---|---|
| Technical solution before policy | If there is no policy or management mandate, that is the FIRST step |
| "The employee accepts the risk himself" | Risk is accepted by the risk owner / management, formally and documented |
| Confusing accountability and responsibility | The task is delegated, accountability is not |
| Mixing up frameworks | ISMS certificate = ISO 27001; control catalog = 800-53; IT governance = COBIT; architecture = SABSA |
| "Publicly disclose the vulnerability immediately" | Coordinated disclosure, internal channels, then the authorities |
| Due care vs due diligence | Research and assessment = diligence; implementation = care |

> **On the exam:** when two answers seem correct, ask yourself which one is **broader and managerial**, and which is narrower and technical. "Establish a risk management program supported by management" beats "install EDR on all endpoints", unless the question explicitly asks for a technical control.

## Summary

- **ISC2 Code**: a preamble and four canons in order of priority: society, honor and the law, principals, the profession. The higher canon wins; complaints go to the ISC2 Ethics Committee.
- **Ethics in AI** (new in 2027): fairness, transparency, accountability, privacy, safety, and human oversight; the NIST AI RMF (Govern, Map, Measure, Manage), ISO/IEC 42001, and EU AI Act frameworks.
- **Organizational code**: tone at the top, signature and periodic reaffirmation, a reporting channel and whistleblower protection.
- **Five properties**: CIA + authenticity + non-repudiation; DAD is the opposite; non-repudiation is provided by a digital signature, not HMAC.
- **Governance**: responsibility of the board and senior management, top-down, aligned with the mission and objectives; strategic, tactical, and operational plans.
- **Organizational processes**: due diligence in an acquisition, sanitization and access revocation in a divestiture, governance and audit committees.
- **Roles**: senior management is ultimately responsible; the owner classifies, the custodian implements; accountability is not delegated.
- **Frameworks**: ISO 27001 (certifiable ISMS), NIST CSF 2.0 (six functions including Govern), 800-53 (catalog), COBIT (IT governance), SABSA (architecture), PCI DSS (contractual), FedRAMP (cloud for the US government).
- **Due diligence** = find out and assess; **due care** = act reasonably and implement; negligence = duty + breach + damages + causation.
