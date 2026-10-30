## Exam objectives: 1.10, 1.11 and 1.12

- **1.10 Understand and apply threat modeling concepts and methodologies**
- **1.11 Apply Supply Chain Risk Management (SCRM) concepts**
  - Risks associated with the acquisition of products and services from suppliers and providers (e.g., product tampering, counterfeits, implants, reputational)
  - Risk mitigations (e.g., third-party assessment and monitoring, minimum security requirements, service level requirements, silicon root of trust, physically unclonable function, Software Bill of Materials (SBOM))
- **1.12 Establish, maintain, and measure a security awareness, education, and training program**
  - Methods and techniques to increase awareness and training (e.g., security champions, gamification)
  - Program effectiveness evaluation and stakeholder engagement
  - Periodic content reviews to include emerging technologies and trends (e.g., cryptocurrency, Artificial Intelligence (AI), blockchain)

In the 2024 outline, supply chain risks did not list **reputational** risk; objective 1.12 read "Establish and maintain" (without "measure"), the methods explicitly included **social engineering** and **phishing** (simulations), and program evaluation did not mention **stakeholder engagement**. Phishing simulations and social engineering training remain an integral part of the program; they are just no longer an example in the outline text.

> **On the exam:** threat modeling is cheapest when done **early** (in the design phase), and SCRM and training are management programs with an owner, metrics, and a review cycle. The answer "buy a tool" rarely beats the answer "establish a process with requirements and measurement".

## Threat modeling (1.10)

**Threat modeling** is a structured process of identifying, assessing, and mitigating threats to a system, ideally during design, and again upon significant changes. The four questions (Adam Shostack, Threat Modeling Manifesto):

1. **What are we working on?** (system model: DFD, trust boundaries)
2. **What can go wrong?** (threats, e.g., STRIDE)
3. **What are we going to do about it?** (controls, acceptance, transfer)
4. **Did we do a good job?** (validation, review)

### Approaches

| Approach | Focus | When |
|---|---|---|
| **Asset-centric** | What is valuable and how it can be compromised | Risk management, BIA |
| **Attacker-centric** | Who the adversaries are, their motives and capabilities (TTPs) | Threat intelligence, red team |
| **Software / system-centric** (design-focused) | Components, data flows, trust boundaries | Development, architecture |
| **Proactive vs reactive** | During design (defensive) vs. after release (adversarial: pentest, fuzzing, bug bounty) | Both are needed |

### Model elements

| Element | Description |
|---|---|
| **DFD** (Data Flow Diagram) | External entities, processes, data stores, data flows |
| **Trust boundary** | Where the level of trust changes (internet ↔ DMZ, user ↔ kernel, tenant ↔ provider); this is where most threats appear |
| **Attack surface** | All points through which an attacker can interact with the system |
| **Entry points / assets** | Inputs into the system / what is being protected |

### Methodologies

| Methodology | Origin | Essence |
|---|---|---|
| **STRIDE** | Microsoft | Categorization of threats per DFD element (see the table below) |
| **PASTA** (Process for Attack Simulation and Threat Analysis) | VerSprite | **Seven stages**, risk-centric, links business objectives with attack simulation |
| **VAST** (Visual, Agile, Simple Threat) | ThreatModeler | Scalable for agile teams and the enterprise; application and operational models |
| **DREAD** | Microsoft (abandoned internally) | Threat risk rating: Damage, Reproducibility, Exploitability, Affected users, Discoverability; subjective |
| **Trike** | Open source | Risk-based, starts from a requirements model and acceptable risk per asset (actors' CRUD rights) |
| **OCTAVE** | Carnegie Mellon SEI | Organizational risk assessment, self-directed, asset focus |
| **LINDDUN** | KU Leuven | **Privacy** threats: Linking, Identifying, Non-repudiation, Detecting, Data disclosure, Unawareness, Non-compliance |
| **Attack trees** | Bruce Schneier | A tree: the root is the attacker's goal, branches are ways to achieve it (AND/OR nodes) |
| **MITRE ATT&CK** | MITRE | Knowledge base of adversary tactics, techniques, and procedures from real attacks; used for attacker-centric modeling and detection coverage |
| **Cyber Kill Chain** | Lockheed Martin | Attack phases: reconnaissance, weaponization, delivery, exploitation, installation, C2, actions on objectives |
| **Diamond Model** | | Adversary, capability, infrastructure, victim |
| **hTMM, CVSS** | SEI / FIRST | Hybrid model; CVSS is a vulnerability severity score, not a threat model |

### STRIDE

| Threat | Property violated | Example | Typical control |
|---|---|---|---|
| **S**poofing | Authenticity (authentication) | Fake login, stolen token | MFA, certificates, mTLS |
| **T**ampering | Integrity | Modifying parameters in a request, modifying a file | Signatures, hashes, access control, validation |
| **R**epudiation | Non-repudiation | A user denies a transaction, there are no logs | Tamper-resistant audit log, digital signatures |
| **I**nformation disclosure | Confidentiality | Leakage through error messages, unencrypted traffic | Encryption, least privilege, error sanitization |
| **D**enial of service | Availability | Resource exhaustion | Rate limiting, autoscaling, quotas, CDN |
| **E**levation of privilege | Authorization | An ordinary user becomes admin | Least privilege, server-side authorization checks, sandboxing |

**STRIDE-per-element**: processes are susceptible to all six categories; data flows to T, I, D; data stores to T, I, D (and R for logs); external entities to S and R.

### PASTA: seven stages

| Stage | Content |
|---|---|
| 1 | Define business objectives and security requirements |
| 2 | Define the technical scope |
| 3 | Decompose the application (DFD, roles, trust boundaries) |
| 4 | Threat analysis (threat intelligence) |
| 5 | Vulnerability and weakness analysis |
| 6 | Attack modeling and simulation (attack trees) |
| 7 | Risk and impact analysis, controls |

### DREAD example

Vulnerability: an IDOR in an API allows reading other people's invoices. Scores 1–10: Damage 7, Reproducibility 10, Exploitability 8, Affected users 9, Discoverability 6 → average **8.0** = high priority. DREAD's problem is subjectivity (especially Discoverability, since it is assumed that an attacker will discover everything), which is why Microsoft abandoned it; today CVSS plus business context is more commonly used.

### Scenario: threat model for a cloud API

A team is building a payments API in Kubernetes behind an API gateway. DFD: mobile app (external entity) → gateway → payment service → database and external card processor. Trust boundaries: internet/gateway, cluster/database, organization/processor. STRIDE finds: spoofing of the mobile client (control: OAuth 2.0 with PKCE, app attestation), tampering with the amount (message signing, server-side verification), repudiation (immutable audit log), disclosure of the PAN (tokenization), DoS on the gateway (rate limiting), EoP through a service account (least privilege RBAC, workload identity). Each finding goes into the backlog with an owner, and the residual risk is accepted by the product owner.

> **On the exam:** STRIDE is for **categorizing threats**, DREAD for **ranking**, PASTA is a **risk-centric seven-stage** methodology, LINDDUN is for **privacy**, ATT&CK describes **adversary behavior**. When a question asks WHEN to do threat modeling, the answer is as early as possible in the SDLC (design) and again upon a significant change.

### Attack tree example

Attacker's goal: **take over a cloud console administrator account**.

```
[OR] Take over the admin account
 ├─ [AND] Phish the password
 │    ├─ Steal the password with a fake page
 │    └─ Bypass MFA (MFA fatigue or AitM proxy)
 ├─ Steal a long-lived access key from a code repository
 ├─ [AND] Compromise the administrator's laptop
 │    ├─ Execute malware on the laptop
 │    └─ Steal the session token from the browser
 └─ Abuse the overly broad rights of a CI/CD service account
```

Each leaf is scored (cost, likelihood, required skill), and controls are chosen to cut off the cheapest paths: phishing-resistant MFA (FIDO2) cuts the phishing AND branch, secret scanning and a ban on long-lived keys cut the second branch, and least privilege for CI/CD the last one. Attack trees are an input to stage 6 of the PASTA methodology.

### Threat modeling for AI systems

For systems with machine learning and LLMs, additional catalogs are used: **MITRE ATLAS** (tactics and techniques against AI systems), the **OWASP Top 10 for LLM Applications** (prompt injection, sensitive information disclosure, data and model poisoning, excessive agency, etc.), and **NIST AI 100-2** (adversarial ML taxonomy). STRIDE still works: tampering with training data is poisoning, information disclosure is data leaking from the model, elevation of privilege is an agent that runs tools with rights broader than the user's.

| Trust boundary in an LLM application | Typical threat | Control |
|---|---|---|
| User ↔ model | Direct prompt injection | Restricting the model's role, input and output filtering |
| External content (web, documents) ↔ model | Indirect prompt injection | Treat content as untrusted, separate instructions from data |
| Model ↔ tools and APIs | Excessive agency, EoP | Least privilege for tools, human confirmation for sensitive actions |
| Training pipeline ↔ data sources | Poisoning | Data provenance, validation, access control |

### Where threat modeling fits into the organization

| Process | Role of the threat model |
|---|---|
| SDLC / DevSecOps | Design review, security requirements, test cases |
| Risk management | Input for threat identification (1.9) |
| SOC | Prioritizing detections according to the ATT&CK techniques relevant to the organization |
| SCRM | Supply chain threats (1.11) |
| Architecture | Validating trust boundaries and zero trust design |

## Supply chain risk management (1.11)

**Supply Chain Risk Management (SCRM / C-SCRM)** manages the risks that arise because the organization depends on suppliers of products, software, and services, as well as on their suppliers (**fourth parties**). Reference documents: **NIST SP 800-161 Rev. 1** (C-SCRM), **NIST CSF 2.0** (category GV.SC), **ISO/IEC 27036** (information security for supplier relationships), **ISO 28000** (supply chain security), **NIST SSDF (SP 800-218)** for secure software development, and the **SLSA** framework for build integrity.

### Risks of acquiring products and services

| Risk | Description | Example |
|---|---|---|
| **Product tampering** | Unauthorized modification of a product during manufacturing, delivery, or update | A compromised build server inserts a backdoor into a signed update (SolarWinds 2020); interception of hardware in shipment |
| **Counterfeits** | Counterfeit or recycled parts presented as genuine | Fake network devices or chips of lower quality and with possible hidden functions |
| **Implants** | Hidden hardware or firmware components that enable surveillance or control | An extra chip on the motherboard, malicious firmware in the BMC or network card |
| **Reputational** (new in 2027) | Damage to reputation due to a supplier's actions | The supplier uses forced labor, leaks our customers' data, is under sanctions, or is linked to a hostile state |
| Compromised software / dependencies | Malicious packages, hijacked maintainer accounts, typosquatting | A backdoor in a compression library (xz utils 2024), malicious npm packages |
| Concentration and availability | Dependence on a single supplier or region | Chip shortages, the outage of a single cloud region, geopolitical risk |
| Services and MSPs | A managed service provider with privileged access | An attack on an MSP's RMM tool spreads ransomware to all its customers (Kaseya 2021) |
| Data loss at the supplier | A third party is compromised | A data leak from a SaaS or at a contracted processor |

### Mitigations

| Mitigation | How it helps |
|---|---|
| **Third-party assessment** | Questionnaires (SIG, CAIQ), SOC 2 Type II, ISO 27001 certificate, penetration tests, site visits, assessment by risk level (supplier tiering) |
| **Third-party monitoring** | Continuous monitoring: security rating services, monitoring news and sanctions, annual reassessment, tracking ownership changes |
| **Minimum security requirements** | Contractual requirements: MFA, encryption, patching, SSDF practices, incident reporting obligation, right to audit, requirements for subcontractors as well (flow-down) |
| **Service level requirements** | An SLA with availability, RTO/RPO, deadlines for patching critical vulnerabilities, incident reporting deadlines |
| **Silicon root of trust** | Immutable code and keys in hardware (e.g., TPM, Google Titan, AWS Nitro, Apple Secure Enclave) that verify firmware before boot: a **secure boot / measured boot** chain of trust from the silicon |
| **Physically Unclonable Function (PUF)** | A unique "fingerprint" of a chip arising from unavoidable manufacturing variations; used for identification and deriving keys without storing them, makes counterfeiting and cloning harder |
| **SBOM** (Software Bill of Materials) | A machine-readable list of all software components, versions, suppliers, and licenses (formats **SPDX**, **CycloneDX**); enables a fast response when a vulnerability in a component is published; together with **VEX** (Vulnerability Exploitability eXchange) it tells whether a vulnerability is actually exploitable |
| Verification of origin and integrity | Buying from authorized distributors, signed packages and firmware, provenance attestations (SLSA, Sigstore), tamper-evident packaging |
| Diversification | Multiple suppliers, exit strategy, source code escrow |
| Contractual and legal instruments | Liability, insurance, termination, return and destruction of data |

### Hardware chain of trust

| Boot step | Who verifies | What is achieved |
|---|---|---|
| Boot ROM in silicon (root of trust) | Immutable code in the chip with the manufacturer's public key | The first instruction is trustworthy because it cannot be modified |
| Firmware (UEFI, BMC) | The boot ROM verifies the signature | Detects modified or counterfeit firmware |
| Bootloader and kernel | The firmware verifies the signature (secure boot) | Prevents bootkits |
| Measurements into TPM PCR registers (measured boot) | The TPM records hashes of each stage | **Remote attestation**: a remote verifier confirms the state before releasing secrets |

A PUF complements this chain: the device key is not written into memory (from where it could be extracted), but reconstructed from the physical properties of the chip at every boot, so a cloned or counterfeit chip cannot produce the same response.

### SBOM in more detail

NTIA **minimum elements** of an SBOM: supplier name, component name, version, other unique identifiers (e.g., PURL, CPE), dependency relationships, author of the SBOM data, and timestamp. Practical requirements:

| Requirement | Why |
|---|---|
| The SBOM is generated automatically in the build pipeline | A manual SBOM quickly becomes outdated |
| It includes transitive dependencies | Most vulnerabilities are deep in the tree |
| Signed and linked to the artifact | Integrity and traceability |
| Suppliers deliver it with the product (contractual requirement) | Visibility for purchased software as well |
| It is continuously compared against vulnerability databases | Fast detection of affected systems |

### Regulatory pressure on the supply chain

| Regulation | Requirement |
|---|---|
| **US Executive Order 14028** (2021) | Secure software development for government suppliers, SBOM, NIST SSDF attestation |
| **NIS2** | Supply chain security as a mandatory risk management measure |
| **DORA** | ICT third-party risk management, register of contracts, oversight of critical ICT providers |
| **EU Cyber Resilience Act** | Security requirements for products with digital elements, vulnerability management, and SBOM throughout the product lifecycle |

### Supplier relationship lifecycle

| Phase | SCRM activities |
|---|---|
| Planning and selection | Categorization by criticality (tiering), defining requirements, due diligence |
| Contracting | Minimum security requirements, SLA, right to audit, incident reporting, flow-down to subcontractors |
| Delivery and acceptance | Integrity verification (signatures, SBOM, anti-tamper), testing before deployment |
| Operation | Monitoring, periodic assessments, change management |
| Termination | Revoking access, return and destruction of data, transition to another supplier |

### Scenario: a vulnerability published in a library

A critical vulnerability is published in a widely used logging library. An organization that has an **SBOM** for all of its applications, and from its suppliers for purchased software, knows within an hour which systems are affected; an organization without SBOMs spends weeks scanning and asking suppliers. The suppliers' VEX documents additionally show that in some products the vulnerable function is not reachable, so patches are prioritized where the real risk is.

> **On the exam:** an SBOM does not prevent vulnerabilities; it provides the **visibility** needed for a fast response and license management. Silicon root of trust and PUF are hardware mitigations against tampering, implants, and counterfeits. The best first measure for a new critical supplier is a **pre-contract assessment** and contractual minimum requirements, not negotiating later.

### Supplier tiering

| Tier | Criterion | Depth of assessment |
|---|---|---|
| Tier 1 (critical) | Access to sensitive data or privileged access, critical to the business | Detailed questionnaire, SOC 2 Type II, right to audit, annual reassessment, continuous monitoring |
| Tier 2 (important) | Limited data access, replaceable with effort | Standard questionnaire, certificates, assessment every two years |
| Tier 3 (low) | No access to data and systems | Basic check (sanctions, financial stability) |

## Security awareness, education, and training program (1.12)

ISC2 distinguishes three levels:

| Level | Goal | Audience | Examples | Outcome |
|---|---|---|---|---|
| **Awareness** | Change attention and behavior; "what" | All employees | Posters, newsletters, short videos, banners, phishing simulations | Recognizing a threat, reporting |
| **Training** | Learn a skill for the job; "how" | Specific roles | Secure coding training for developers, administrator training, incident response training | Ability to perform a task securely |
| **Education** | In-depth understanding; "why" | Security professionals | University, certifications (CISSP), long-term programs | Ability to make decisions and design |

### Establishing the program

1. Management support and a program owner (usually the CISO or an awareness team).
2. Needs assessment: risks (e.g., phishing, BEC), regulatory requirements (PCI DSS, HIPAA, NIS2 require training), roles.
3. Audience segmentation: all employees, managers, developers, administrators, finance (BEC), HR, contractors.
4. Choice of methods and content, a plan for the year.
5. Delivery: training at hiring (before access to systems) and at least annually, plus continuous micro-activities.
6. Measurement and reporting.
7. Periodic content review.

### Example annual plan

| Quarter | Activities | Audience |
|---|---|---|
| Q1 | Mandatory annual training (policies, classification, incident reporting), phishing simulation | Everyone |
| Q2 | Training on BEC and deepfake fraud, callback procedure | Finance, executive assistants |
| Q2 | Secure coding workshop (OWASP Top 10), CTF | Developers, champions |
| Q3 | Ransomware incident tabletop exercise | Management, IT, PR, legal |
| Q4 | Cybersecurity awareness month campaign, gamified quiz, prizes | Everyone |
| Continuous | Monthly micro-modules, simulations, just-in-time messages, onboarding training | Everyone, new employees |

### Methods and techniques

| Method | Description | Advantage |
|---|---|---|
| **Security champions** | Employees in business and development teams who are local security ambassadors, receive additional training, and pass on knowledge | Scales the security team, cultural acceptance, early signals from teams |
| **Gamification** | Points, leaderboards, badges, CTF competitions, escape rooms, prizes | Motivation and engagement, better retention |
| **Phishing simulations** | Controlled fake phishing emails with immediate education on click | Measurable behavior, realistic practice |
| **Social engineering training** | Vishing, smishing, pretexting, tailgating, BEC, deepfake voice/video | Recognizing manipulation |
| **Microlearning** | Short 3–5 minute modules | Better retention, less disruption |
| **Tabletop exercises** | Incident scenarios for management and technical teams | Preparedness, roles |
| **Just-in-time** | Education at the moment of a risky action (e.g., a warning when sharing a file outside the organization) | Context |
| **Role-based training** | Content tailored to the job | Relevance |

### Security champions program

| Element | Good practice |
|---|---|
| Selection | Volunteers with interest, one per team or product |
| Time | A formally approved share of working time (e.g., 10–20%), with the manager's support |
| Training | Deeper training (threat modeling, secure coding, pipeline tools) |
| Duties | First point of contact for security questions in the team, participation in design reviews and triage of findings |
| Community | Regular meetings, a channel for sharing, access to the security team |
| Recognition | Visibility, certifications, impact on performance reviews |
| Measurement | Number of threat models, time to fix findings in teams with a champion compared with teams without one |

> **On the exam:** punishing employees who click on a simulation is not the goal; the goal is behavior change and a culture in which incidents are **reported**. The program must be tailored to the audience: training for developers and for the finance department differs. The most effective program is continuous, not a one-off annual video.

### Measuring effectiveness

Kirkpatrick's four-level model is a useful framework:

| Level | Question | Metric |
|---|---|---|
| 1 Reaction | Did participants find it useful? | Satisfaction surveys |
| 2 Learning | Did they learn? | Tests before and after training |
| 3 Behavior | Do they behave differently? | **Click rate** in phishing simulations, **reporting rate** for suspicious emails, time to report, number of policy violations |
| 4 Results | Has risk been reduced? | Number of real incidents caused by human error, BEC losses, audit findings |

Metrics: percentage of training completed (completion rate is an activity KPI, not an effectiveness one), click rate and reporting rate, trend over time, comparison by department. The **reporting rate** is often more valuable than the click rate, because it shows an active culture.

#### Example

In January, 22% of employees clicked on the simulation and 8% reported it. After six months of microlearning and gamification: 7% clicked, 54% reported, median time to the first report 4 minutes. The number of actually compromised accounts fell from 9 to 2 per quarter. That is evidence of effectiveness at levels 3 and 4, not just the fact that 100% of people "watched the video".

### Stakeholder engagement (new in 2027)

| Stakeholder | Why involve them | How |
|---|---|---|
| Management | Mandate, budget, example (tone at the top) | Quarterly report with risk metrics, participation in tabletop exercises |
| HR | Onboarding, disciplinary procedures, culture | Integrating training into the hiring and performance review process |
| Legal and compliance | Regulatory training requirements, privacy of simulations | Review of content and the simulation policy |
| Communications / marketing | Quality of messages, campaigns | Joint campaigns (e.g., Cybersecurity Awareness Month in October) |
| Department managers | Relevance and time for training | Tailored content, champions in teams |
| Employee representatives / union | Trust, acceptance of monitoring | Transparency about phishing simulations |

### Periodic content review

Content is reviewed at least annually and whenever new threats or technologies emerge:

| Emerging topic | What employees need to know |
|---|---|
| **AI** | Do not enter confidential data into public AI tools; recognize deepfake voice and video (e.g., a fake call from the "CEO" requesting an urgent payment); AI-generated phishing without grammatical errors; the AI acceptable use policy |
| **Cryptocurrency** | Investment scams, fake exchanges, ransomware demands payment in cryptocurrency, cryptojacking (unauthorized mining on the organization's resources) |
| **Blockchain** | What it actually guarantees (integrity and immutability of records) and what it does not (confidentiality, correctness of smart contracts); the risk of lost private keys and wallets |
| QR code phishing (quishing) | Do not scan unknown QR codes to log in |
| MFA fatigue | Do not approve unexpected push requests; report them |
| Remote work | Home networks, public Wi-Fi, physical security of devices |

> **On the exam:** when a new threat emerges (e.g., deepfake fraud), the correct answer is to **update the program content** and notify at-risk groups (finance) in a targeted way, along with verification procedures (calling back a known number), rather than waiting for the next annual cycle.

## Connecting the three objectives

| Objective | Question | Output |
|---|---|---|
| 1.10 Threat modeling | What can go wrong in our system? | List of threats, controls, residual risk |
| 1.11 SCRM | What can go wrong because of those we buy from? | Requirements for suppliers, assessments, SBOM, hardware root of trust |
| 1.12 Awareness and training | What can go wrong because of people, and how do we reduce it? | A program with behavior and results metrics |

All three feed back into the risk management process from 1.9: identified threats go into the risk register, treatment has an owner, and effectiveness is measured and reported.

## Typical traps

| Trap | Correct thinking |
|---|---|
| CVSS as a threat modeling methodology | CVSS scores the severity of a known vulnerability; a threat model looks for threats in the design |
| Threat modeling only right before production | Cheapest in design, repeated upon changes |
| A supplier's SOC 2 report as the end of the assessment | Read the scope, exceptions, and complementary user entity controls (CUECs), monitor continuously |
| SBOM as a security control that prevents attacks | An SBOM provides visibility; prevention comes from the process that uses it |
| Completion rate as proof of training effectiveness | Measure behavior and results |
| Punishment for clicking in a simulation | Education and a reporting culture |

## Summary

- **Threat modeling**: four questions; asset-, attacker-, and software-centric; DFD and trust boundaries; as early as possible in the SDLC and upon changes.
- **STRIDE**: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege; maps to the properties from 1.2.
- **PASTA** (seven stages, risk-centric), **VAST** (agile, scalable), **DREAD** (ranking, subjective), **Trike**, **OCTAVE**, **LINDDUN** (privacy), **attack trees**, **ATT&CK**, **Kill Chain**.
- **SCRM risks**: tampering, counterfeits, implants, reputational risk (new in 2027), compromised dependencies, concentration, MSPs.
- **SCRM mitigations**: third-party assessment and monitoring, minimum requirements and flow-down, SLA, silicon root of trust, PUF, SBOM (SPDX, CycloneDX) with VEX, provenance and signatures; supplier tiering.
- **Awareness / training / education**: what / how / why.
- **Methods**: security champions, gamification, phishing simulations, microlearning, role-based, just-in-time.
- **Measurement**: Kirkpatrick 1–4; behavior (clicks and reports) and results (incidents) matter more than the completion percentage.
- **Stakeholders and content**: management, HR, legal, communications; annual and ad hoc review with AI, cryptocurrency, and blockchain topics.
