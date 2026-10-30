## Exam objectives: 1.5 and 1.6

This module completes Domain 1 (**Cloud Concepts, Architecture and Design**, about 17%):

- **1.5 Evaluate Cloud Service Providers (CSP)**
  - verification against criteria,
  - system/subsystem product certifications (Common Criteria, FIPS 140-2).
- **1.6 Comprehend Artificial Intelligence (AI)/Machine Learning (ML)** (a new topic in the 2026 outline)
  - cloud threat detection and analysis,
  - data source validation and verification,
  - Security Orchestration, Automation and Response (SOAR),
  - ethical concerns,
  - regulatory requirements.

In 1.5 the key is to understand **how the customer gains trust in a provider** it cannot audit itself, and the difference between certification of the **organization/service** (ISO 27001, SOC 2, CSA STAR) and certification of a **product** (Common Criteria, FIPS 140). In 1.6 ISC2 does not expect you to know how to train models, but to understand AI as a **security tool** (detection, SOAR) and as a **source of risk** (data, ethics, regulation).

## Why the CSP is evaluated

The customer transfers execution, but not accountability (module 1). It therefore needs evidence that the provider is properly doing its part of the shared responsibility model. The problem: large providers **do not allow** each of their millions of customers to come and audit the data center. The solution is **trust through an independent third party**: the provider is audited once against a known standard, and the customer uses the report or certificate.

The evaluation process (vendor due diligence) typically looks like this:

1. **define criteria** based on business, regulatory and security requirements (what must be met),
2. collect **evidence** (certificates, audit reports, the CAIQ questionnaire, the contract and DPA),
3. **verify** the evidence: scope, period, exceptions, who issued it, whether it is valid,
4. identify **gaps** and decide: additional controls at the customer, contract clauses, risk acceptance or rejecting the provider,
5. monitor **continuously** (new reports every year, incidents, service changes).

> **On the exam:** before choosing a provider, the first step is not "ask for a SOC 2", but **define the requirements (criteria)**. Only when you know what you need (e.g., PCI DSS, data residency in the EU, a FIPS 140 validated HSM) can you verify whether the provider meets it.

## Verification against criteria: standards and programs

| Standard / program | What it is | What it demonstrates | Note |
|---|---|---|---|
| **ISO/IEC 27001** | information security management system (ISMS) | the organization manages risks systematically | a certificate; check the **Statement of Applicability (SoA)** and scope |
| **ISO/IEC 27002** | a catalog of controls (guidance) | — | not a certification standard |
| **ISO/IEC 27017** | guidance for cloud controls (for the CSP and CSC) | a cloud extension of 27002 | adds, e.g., division of roles, sanitization of virtual environments |
| **ISO/IEC 27018** | protection of PII in the public cloud when the CSP is a processor | management of personal data | relevant to the GDPR |
| **ISO/IEC 27701** | an extension of the ISMS to privacy management (PIMS) | privacy for controllers and processors | a standalone standard since 2025 |
| **ISO 22301** | business continuity management (BCMS) | the provider's BC capability | |
| **SOC 1 / SOC 2 / SOC 3** (SSAE 18, AICPA) | reports on a service organization's controls | SOC 1: financial reporting; SOC 2: Trust Services Criteria; SOC 3: public summary | Type I = design at a point in time; **Type II = operating effectiveness over a period** |
| **ISAE 3402** | the international equivalent of SOC 1 | | |
| **CSA STAR** | the CSA Security, Trust, Assurance and Risk registry | assurance levels (see below) | based on the **CCM** |
| **PCI DSS** | the payment card data standard | AOC and ROC from a QSA | industry, contractually binding |
| **FedRAMP** | the US program for authorizing cloud services for the federal government | Low/Moderate/High baseline per NIST SP 800-53 | |
| **EUCS / BSI C5 / ENS** | European and national cloud schemes | C5 (Germany), ENS (Spain), EUCS in preparation at the EU level | |

### SOC reports in brief

| Report | Purpose | Who reads it | Distribution |
|---|---|---|---|
| **SOC 1** | controls relevant to user entities' financial reporting (ICFR) | financial statement auditors | restricted |
| **SOC 2** | Trust Services Criteria: **Security** (mandatory), Availability, Processing Integrity, Confidentiality, Privacy | security teams, risk managers | restricted (NDA) |
| **SOC 3** | a summary of SOC 2 without test details | the public, marketing | public |

For a security evaluation of a CSP the most useful is a **SOC 2 Type II**: it shows that the controls **operated** over a period (usually 6–12 months), not just that they exist.

When reading a SOC 2 report, pay attention to:

- the **scope** (which services and regions are included),
- **exceptions** and the auditor's opinion (qualified opinion),
- **Complementary User Entity Controls (CUECs)**: controls the **customer** must implement for the provider's controls to be effective,
- the **carve-out vs inclusive** method for subservice organizations (e.g., a SaaS provider excludes the IaaS beneath it).

> **On the exam:** if a SaaS provider uses the carve-out method for its IaaS, the SaaS provider's SOC 2 report **does not cover** the IaaS controls. The risk manager should then also obtain the IaaS provider's report (fourth party). CUECs are the customer's obligation and are often overlooked.

### CSA STAR and the Cloud Controls Matrix

The **Cloud Controls Matrix (CCM)** is the CSA catalog of cloud controls (version 4 has 17 domains and 197 controls) mapped to ISO 27001/27017/27018, NIST, PCI DSS and others. The CCM comes with the **CAIQ** (Consensus Assessments Initiative Questionnaire), a standardized questionnaire in which the provider describes its controls.

| STAR level | How | Strength of evidence |
|---|---|---|
| **Level 1: Self-Assessment** | the provider fills in the CAIQ itself and publishes it in the STAR registry | weakest (self-assessment) |
| **Level 2: Third-Party Audit** | **STAR Certification** (with ISO 27001) or **STAR Attestation** (with SOC 2), by an independent auditor | strong |
| **Level 3: Continuous** (Continuous Auditing) | continuous monitoring and reporting | strongest, still in development |

In 2025 the CSA also published the **AI Controls Matrix (AICM)** with controls for AI systems, as an extension of the CCM approach.

> **On the exam:** distinguish **self-assessment** (STAR Level 1, CAIQ) from an **independent audit** (STAR Level 2, SOC 2 Type II, ISO 27001 certificate). When a question asks for the HIGHEST level of assurance, self-assessment is never the correct answer.

### What if the provider lacks the required evidence

| Situation | Options |
|---|---|
| no certificate, but the provider is small and low-risk | questionnaire, interview, contractual guarantees, risk acceptance |
| the report has expired (older than 12 months) | request a **bridge letter** (gap letter) for the period until the new report |
| the scope does not cover the service we use | do not rely on the report for that service; request additional evidence or reject |
| the report has exceptions | assess the impact, request a remediation plan, compensating controls at the customer |
| regulation requires a right to audit | a **right to audit** contract clause, often replaced by acceptance of third-party reports |

## Product certifications: Common Criteria and FIPS 140

The standards above evaluate the **organization or service**. Common Criteria and FIPS 140 evaluate a **specific product or module** (system/subsystem), e.g., a hypervisor, a firewall or an HSM.

| | Common Criteria (ISO/IEC 15408) | FIPS 140-2 / 140-3 |
|---|---|---|
| What is evaluated | the security functions of an IT product | cryptographic modules (hardware, software, firmware) |
| Who | accredited laboratories, a scheme recognized through the **CCRA** (an international arrangement) | the **CMVP** (NIST and the Canadian CCCS), accredited laboratories |
| Levels | **EAL1–EAL7** (depth of evaluation) | **Level 1–4** (physical and logical protection) |
| Key terms | **Protection Profile (PP)**, **Security Target (ST)**, **Target of Evaluation (TOE)** | approved algorithms, protection against tampering |
| Cloud example | hypervisor, firewall, OS evaluated against a PP | the HSM behind KMS, cryptographic libraries |

### Common Criteria

- **Protection Profile (PP)**: a set of security requirements for a class of products (e.g., "network devices"), independent of the vendor. Today the dominant approach is evaluation against a PP (cPP, collaborative Protection Profile).
- **Security Target (ST)**: the vendor's document that claims which security functions the product has (it may reference a PP).
- **Target of Evaluation (TOE)**: the specific product and configuration being evaluated.

| EAL | Name |
|---|---|
| EAL1 | functionally tested |
| EAL2 | structurally tested |
| EAL3 | methodically tested and checked |
| EAL4 | methodically designed, tested and reviewed (the highest common commercial level) |
| EAL5 | semiformally designed and tested |
| EAL6 | semiformally verified design and tested |
| EAL7 | formally verified design and tested |

Important: **the EAL measures the depth and rigor of the evaluation, not "how secure the product is"**. A product evaluated at EAL4 against a narrow ST may have fewer security functions than a product at EAL2. In addition, the certificate applies only to the **evaluated configuration and version**.

### FIPS 140

| Level | Requirements |
|---|---|
| **Level 1** | approved algorithms, no special physical protection (e.g., a software library) |
| **Level 2** | tamper-evidence (seals, coatings), role-based authentication |
| **Level 3** | tamper-resistance and response (zeroizing keys on an attempt to open), identity-based authentication, physical separation of interfaces |
| **Level 4** | complete envelope protection, protection against environmental attacks (voltage, temperature) |

**FIPS 140-3** (based on ISO/IEC 19790 and 24759) has replaced FIPS 140-2: new 140-2 validations have not been accepted since 2021, and the remaining FIPS 140-2 certificates move to the CMVP **historical** list on **September 21, 2026**. The outline still mentions FIPS 140-2, but in practice and in procurement you should require **FIPS 140-3** validation. Modules on the historical list should not be chosen for new systems by US federal customers.

The cloud KMS services of the large providers use HSMs validated at **FIPS 140 Level 3** (or Level 2 for the service as a whole with Level 3 for the HSMs); dedicated cloud HSM services offer Level 3.

> **On the exam:** "Regulation requires cryptographic keys to be protected in a module that zeroizes keys upon an attempt at physical opening." That is **FIPS 140 Level 3** (tamper-response). Level 2 only shows evidence of an attempt (tamper-evidence). If a question asks for certification of a **cryptographic module**, the answer is FIPS 140, not Common Criteria or ISO 27001.

## Criteria beyond certifications

Certifications cover controls, but a provider evaluation also includes business and contractual criteria:

| Criterion | What to check |
|---|---|
| Location and jurisdiction | regions, the ability to restrict data to a country/the EU, laws that apply to the provider (e.g., the CLOUD Act) |
| Subcontractors (sub-processors) | the list, notification of changes, right to object |
| Financial stability | the risk of the provider going out of business (vendor lock-out) |
| Incident management | notification deadlines, cooperation in investigations, access to logs |
| Support and SLA | support levels, metrics, service credits |
| Exit (reversibility) | data export, formats, deletion deadlines, transition assistance |
| Transparency | trust portal, public service status, publication of reports |
| Key management | support for CMK/BYOK/HYOK, FIPS validation of HSMs |
| Penetration testing | the provider's policy on testing performed by the customer |

### How to read an ISO 27001 certificate

- check **who issued** the certificate and whether the certification body is accredited,
- check the **scope**: which locations, services and processes are included,
- check the **validity date** (the cycle is three years, with annual surveillance audits),
- request the **Statement of Applicability** to see which Annex A controls are included or excluded and why,
- the certificate confirms that the **management system** exists and operates, but does not test the effectiveness of every control in detail like a SOC 2 Type II.

## Example scenario: choosing a SaaS provider for healthcare

A hospital is choosing a SaaS for appointment scheduling that processes health data of EU citizens.

1. **Criteria**: GDPR (special categories of data), data residency in the EU, encryption with a customer-managed key, 99.9% availability, the right to export data.
2. **Evidence**: ISO 27001 + 27017 + 27018 certificates with the SoA, SOC 2 Type II (Security, Availability, Confidentiality, Privacy), STAR Level 2, a DPA (data processing agreement) and the list of sub-processors.
3. **Verification**: the SOC 2 uses carve-out for the IaaS → the hospital obtains the IaaS provider's SOC 2; the report has one exception in access reviews → it requests a remediation plan; the CUECs require the hospital to enable SSO and MFA → the hospital takes that on.
4. **Decision**: the provider is accepted with contract clauses on incident notification within 24 hours, data export and annual delivery of new reports.

## AI/ML in cloud security: basic terms

| Term | Meaning |
|---|---|
| **Artificial Intelligence (AI)** | systems that perform tasks that usually require human intelligence |
| **Machine Learning (ML)** | a subset of AI: models learn patterns from data |
| Supervised learning | learning from labeled examples (e.g., "phishing / not phishing") |
| Unsupervised learning | finding patterns without labels (clustering, anomaly detection) |
| **Generative AI / LLM** | models that generate text, code, images; large language models |
| Training / inference | teaching a model / using a trained model to make predictions |
| False positive / false negative | a false alarm / a missed threat |
| Model drift | a drop in model accuracy when real data changes compared to the training data |

## Threat detection and analysis with AI/ML

The cloud generates enormous amounts of telemetry (API logs, flow logs, DNS, endpoint, identity). People cannot review all of it manually, so ML helps:

| Application | How ML helps | Real-world example |
|---|---|---|
| **Anomaly detection** | learns normal behavior and flags deviations | unusual API activity, sign-in from a new country |
| **UEBA** (User and Entity Behavior Analytics) | behavioral profiles of users and entities | an insider who suddenly downloads large amounts of data |
| Malware and phishing classification | supervised models on known samples | email protection, sandbox |
| Alert correlation and prioritization | grouping related events into an incident, risk scoring | SIEM/XDR incidents instead of thousands of alerts |
| Threat intelligence | processing large indicator feeds | alert enrichment |
| GenAI assistants for analysts | summarizing incidents, writing queries, explaining scripts | security copilots in the SIEM |

Real-world examples: **Amazon GuardDuty** uses ML and anomaly detection over CloudTrail, VPC Flow Logs and DNS logs; **Microsoft Sentinel** and **Defender XDR** use UEBA and alert fusion; **Google Security Operations** applies similar techniques.

Limitations ISC2 expects you to know:

- ML **does not replace** the analyst; a **human-in-the-loop** is required for high-impact decisions,
- models produce false positives and false negatives and need tuning,
- an attacker may try to evade detection (**adversarial evasion**) or slowly "teach" the model to treat malicious behavior as normal,
- detection quality depends on the **quality and completeness of the data**.

### How the quality of ML detection is measured

| Metric | Meaning | Why it matters |
|---|---|---|
| **Precision** | of all alerts, how many are real threats | low precision = alert fatigue |
| **Recall** (detection rate) | of all real threats, how many were detected | low recall = missed attacks |
| False positive rate | the share of false alarms | SOC workload |
| MTTD / MTTR | mean time to detect / respond | the business impact of detection and automation |

Precision and recall usually trade off against each other: a more sensitive model catches more attacks, but also produces more false alarms. Setting the threshold is a **business decision** based on risk.

## Data source validation and verification

"Garbage in, garbage out": a model is only as good as the data it learns from and analyzes. **Data source validation** checks that the data is accurate, complete and appropriate; **verification** confirms provenance and integrity (that the data comes from whom it claims and has not been altered).

| Threat | Description | Controls |
|---|---|---|
| **Data poisoning** | an attacker injects malicious or incorrect data into the training set | controlled sources, data validation and cleansing, outlier detection, access only for authorized parties |
| Backdoor in the model | the model behaves normally except on a trigger known to the attacker | verifying model provenance, testing, signed models |
| Biased or unrepresentative data | the model makes systematically wrong decisions for some groups | dataset analysis, fairness metrics |
| Incomplete telemetry | logs are not enabled or are lost | checking source coverage, alerts on log flow interruption |
| Forged logs | an attacker injects fake events to mislead the analysis | log integrity (hash, signature, WORM), source authentication |
| Model drift | reality has changed | continuous accuracy measurement, retraining |

Key terms:

- **Data provenance / lineage**: a record of the data's origin and all transformations from the source to the model.
- **Integrity**: hash values and digital signatures of datasets and models; immutable (WORM) storage for logs.
- **AI supply chain**: pretrained models and datasets from public repositories are a third party and must be assessed (e.g., an **AI BOM**, model cards).

> **On the exam:** when an ML detection system starts missing obvious attacks after "learning" from data in the environment, the first suspicion is **data poisoning or drift**, and the BEST control is validation and control of the training data sources, not just "a better algorithm".

## Security Orchestration, Automation and Response (SOAR)

**SOAR** connects security tools (orchestration), automates repeatable steps (automation) and supports incident management (response) through **playbooks**.

| Component | Example |
|---|---|
| **Orchestration** | integrating the SIEM, EDR, IAM, ticketing system and cloud APIs |
| **Automation** | alert enrichment (whois, IP reputation), instance isolation, session revocation |
| **Response** | case management, metrics (MTTD, MTTR), documentation |

A typical playbook for a compromised access key in the cloud:

1. an alert from detection (e.g., a GuardDuty/Defender finding),
2. automatic enrichment (who owns the key, where the calls come from),
3. automatic deactivation of the key and revocation of sessions,
4. capturing evidence (logs, snapshot),
5. notifying an analyst and opening a case,
6. a human decision on next steps (escalation, communication).

Example tools: Microsoft Sentinel (playbooks on Logic Apps), AWS (EventBridge + Lambda/Step Functions, Security Hub automations), Google SecOps SOAR, Splunk SOAR, Cortex XSOAR.

AI in SOAR: ML helps with prioritization and recommendations, and GenAI generates summaries and draft playbooks. Risks: an automated action on a misclassified alert can shut down a production system; that is why high-impact actions are performed with **human approval**, and playbooks are tested and versioned.

> **On the exam:** SOAR is the BEST answer when the problem is "analysts are overwhelmed by repetitive manual steps and response time is too long". The SIEM collects and correlates; SOAR **automates the response**. Fully autonomous destructive actions without human oversight are not desirable.

## Ethical concerns of AI

| Principle / problem | Description | Control |
|---|---|---|
| **Bias / fairness** | the model systematically discriminates against groups (e.g., in hiring or lending) | representative data, fairness tests, review |
| **Transparency** | people know they are interacting with AI or that AI is making a decision | user notification, labeling generated content |
| **Explainability** | can it be explained why the model made a decision | explainable models, documentation (model cards) |
| **Accountability** | who is answerable for harm caused by AI | clear model ownership, governance |
| **Privacy** | models can memorize and disclose personal data from training | minimization, anonymization, controlling what goes into the prompt |
| **Human oversight** | decisions with significant impact should not be fully automated | human-in-the-loop, the right to appeal |
| Safety and misuse | deepfakes, automated phishing, prompt injection | guardrails, misuse monitoring |
| Intellectual property | copyright-protected training data | checking source licenses |

## Regulatory requirements for AI

| Framework | Type | Key points |
|---|---|---|
| **EU AI Act** (Regulation (EU) 2024/1689) | EU law | a risk-based approach: **prohibited practices** (e.g., social scoring, manipulation), **high-risk systems** (hiring, credit, critical infrastructure) with strict obligations, **limited risk** (transparency obligations, e.g., chatbots and deepfakes), **minimal risk**; special obligations for general-purpose AI (GPAI) models |
| **GDPR** | EU law | Art. 22: the right not to be subject to a decision based solely on automated processing with legal or similarly significant effects; DPIA; a lawful basis for processing training data |
| **NIST AI RMF 1.0** (and the GenAI profile) | voluntary US framework | the functions **Govern, Map, Measure, Manage** |
| **ISO/IEC 42001** | certification standard | AI management system (AIMS), a structure similar to ISO 27001 |
| ISO/IEC 23894 | guidance | AI risk management |
| Sector regulations | various | finance, healthcare and consumer protection apply existing rules to AI decisions as well |

The EU AI Act timeline: it entered into force on August 1, 2024; the prohibitions apply from February 2, 2025; obligations for GPAI models from August 2, 2025; obligations for high-risk systems were originally scheduled from August 2, 2026, but the "AI Omnibus" (Regulation (EU) 2026/1744, in force since July 27, 2026) postponed them: standalone Annex III systems from December 2, 2027, and systems embedded in Annex I products from August 2, 2028. As with the GDPR, it applies **extraterritorially**: to providers and deployers whose systems are used in the EU.

For a cloud customer this means: if you use a provider's AI service (e.g., a managed LLM), you remain responsible for the **purpose and manner of use**, the risk assessment, transparency toward users and the protection of the data you send to the model. Check in the contract whether the provider uses your prompts and data to train its models and where processing takes place.

> **On the exam:** a bank in the EU introduces a model that automatically rejects loan applications. The BEST first step is a **risk and compliance assessment** (a DPIA under the GDPR, classification under the AI Act as a high-risk system) and ensuring human oversight before production use, not just testing the model's accuracy.

## Shared responsibility for AI services

| Layer | Own model on IaaS | Managed model (AI PaaS) | AI feature in SaaS |
|---|---|---|---|
| Infrastructure and GPUs | CSP | CSP | CSP |
| Model (training, protection, versions) | customer | CSP (base model), customer (fine-tuning) | CSP |
| Training data and context (RAG) | customer | customer | customer (what it shares) |
| Prompts, outputs and guardrails | customer | shared | mostly CSP, customer configures |
| IAM and access | customer | customer | customer |
| Purpose of use and regulation | customer | customer | customer |

The same pattern as with SaaS/PaaS/IaaS: the "higher" the service, the less the customer controls, but **data, access and the purpose of use** always remain theirs.

## Threats to AI systems in the cloud

Although the focus of 1.6 is on using AI, the exam may also ask about protecting AI systems themselves:

| Threat | Description |
|---|---|
| **Prompt injection** | input (direct or indirect, e.g., from a document) leads the LLM to ignore its instructions or disclose data |
| Sensitive information disclosure | the model reveals confidential data from training or context in its response |
| Model theft / extraction | stealing the model or reconstructing it through mass queries |
| Model inversion / membership inference | extracting information about the training data |
| Excessive agency | an AI agent has too many permissions and can perform harmful actions |
| Data poisoning | see above |

Reference sources: **OWASP Top 10 for LLM Applications**, **MITRE ATLAS** (attack tactics against AI systems), **CSA AICM**.

## Example scenario: a GenAI assistant in the SOC

A SOC team wants to introduce a GenAI assistant that summarizes incidents and suggests response steps, running on a cloud provider's managed LLM service.

1. **Provider evaluation**: whether the service uses customer data for training, where processing takes place, which certifications it has (ISO 27001, SOC 2, ISO/IEC 42001).
2. **Data**: logs contain personal data and secrets; masking is introduced before sending to the prompt, along with minimal retention.
3. **Validation**: the assistant may read only vetted sources (the SIEM), and its output is treated as a suggestion.
4. **SOAR integration**: the assistant can trigger only neutral actions (enrichment, ticket); isolating a system requires an analyst's approval.
5. **Governance**: a system owner, a record of use, periodic assessment of accuracy and hallucinations, analyst training.

## Common traps

| Distractor | Why it is wrong |
|---|---|
| "STAR Level 1 is an independent audit." | Level 1 is a self-assessment (CAIQ) |
| "SOC 3 provides the most detail for evaluating a provider." | SOC 3 is a public summary; an evaluation requires a SOC 2 Type II |
| "A higher EAL means the product is more secure." | the EAL measures the depth of evaluation against the ST |
| "FIPS 140 certifies the cloud service as a whole." | FIPS 140 validates a cryptographic module |
| "SOAR replaces the SIEM." | the SIEM collects and correlates, SOAR automates the response; they are complementary |
| "AI decisions are objective because a machine makes them." | the model inherits bias from the data |
| "By using a provider's AI service, regulatory responsibility passes to the provider." | the customer remains responsible for the purpose and use |

## Summary

- CSP evaluation: **criteria → evidence → verification → gaps → continuous monitoring**. Trust is built through **independent third parties**.
- Standards for the organization/service: **ISO 27001** (+ 27017 cloud, 27018 PII, 27701 privacy), **SOC 2 Type II**, **CSA STAR** (Level 1 self-assessment, Level 2 audit, Level 3 continuous) based on the **CCM** and **CAIQ**, PCI DSS, FedRAMP, C5.
- With a SOC 2, check the **scope, exceptions, CUECs and carve-out**; for an expired report, request a **bridge letter**.
- Product certification: **Common Criteria** (ISO/IEC 15408, EAL1–7, PP, ST, TOE) and **FIPS 140** (Level 1–4; Level 3 = tamper-response). **FIPS 140-3** has replaced 140-2; 140-2 certificates move to the historical list on September 21, 2026.
- AI/ML in detection: anomalies, **UEBA**, correlation; limitations: false results, evasion, the need for human oversight.
- **Data source validation**: provenance/lineage, integrity, protection against **data poisoning**, drift monitoring.
- **SOAR**: orchestration + automation + response through playbooks; destructive actions with human approval.
- Ethics: **bias, transparency, explainability, accountability, privacy, human oversight**.
- Regulation: **EU AI Act** (risk-based approach), **GDPR Art. 22**, **NIST AI RMF** (Govern, Map, Measure, Manage), **ISO/IEC 42001**. The customer remains responsible for the use of AI.
