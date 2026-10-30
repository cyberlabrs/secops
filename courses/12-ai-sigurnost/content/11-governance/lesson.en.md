## What this module covers

Domain 6, governance and compliance:

- **6.1** Regulation and standards: the **EU AI Act** (Regulation (EU) 2024/1689) with the amendments from the **AI Omnibus** (Regulation (EU) 2026/1744), the **NIST AI RMF 1.0** with the Generative AI Profile (NIST AI 600-1), and **ISO/IEC 42001**.
- **6.2** AI governance in the organization: policies, the AI system inventory, the risk assessment process and AI vendors.

Module objectives. After this module you should be able to:

- distinguish binding regulation, a voluntary framework and a certifiable management system standard,
- classify a use case under the EU AI Act (prohibited, high-risk, transparency obligations, minimal risk) and determine the organization's role (provider or deployer),
- list the key application dates after the AI Omnibus,
- connect regulatory requirements to the technical controls from the previous modules,
- set up an AI system inventory, an intake process for new use cases and an AI vendor assessment.

This module is not legal advice. The goal is for you, as an engineer, to understand what the legal and compliance team is asking for and how the technical controls from this course provide evidence for it.

## Three kinds of documents

| | **EU AI Act** | **NIST AI RMF 1.0** | **ISO/IEC 42001:2023** |
|---|---|---|---|
| Type | EU regulation, binding | Voluntary framework (US, NIST, January 2023) | International standard for an AI management system (**AIMS**) |
| Approach | By the risk level of the use case; obligations by role | Four functions: GOVERN, MAP, MEASURE, MANAGE | Plan-Do-Check-Act, structured like ISO/IEC 27001 |
| Certification | Conformity assessment and CE marking for high-risk systems | None | Yes, by an accredited certification body |
| For whom | Providers, deployers, importers, distributors of systems on the EU market or whose output is used in the EU | Any organization | Any organization that develops, provides or uses AI |
| Consequence of non-compliance | Fines, ban from the market | None directly | Loss of certification |

In practice they are combined: ISO/IEC 42001 provides the **management system** (roles, processes, reviews), the NIST AI RMF provides a **risk methodology** and a rich catalog of practices, and the EU AI Act provides **mandatory requirements** for certain systems.

## EU AI Act

Regulation (EU) 2024/1689 entered into force on 1 August 2024. It also applies to organizations outside the EU if they place an AI system on the EU market or the output of their system is used in the EU, which matters for companies from the region that work for EU clients.

### Roles

- **Provider**: develops an AI system or model, or has it developed, and places it on the market or puts it into service under its own name. The most obligations.
- **Deployer**: uses an AI system in the course of its professional activity.
- Importer, distributor, authorized representative: obligations in the distribution chain.

The role depends on the specific system, not on the organization. The same company is a deployer for a commercial chatbot it uses internally, and a provider for a product it built on that model and sells. Whoever substantially modifies a high-risk system, or changes its intended purpose so that it becomes high-risk, can become a provider.

### Risk levels

```text
            ┌──────────────────────────────┐
            │  PROHIBITED PRACTICES (Art. 5)│  e.g., social scoring, manipulation
            │  must not be used             │  that causes harm, exploiting vulnerabilities
            ├──────────────────────────────┤
            │  HIGH-RISK (Art. 6)            │  Annex I: AI as a safety component of
            │  requirements Arts. 9–15,      │  regulated products; Annex III: areas
            │  conformity assessment, regist.│  such as employment, education, credit
            ├──────────────────────────────┤
            │  TRANSPARENCY OBLIGATIONS      │  a chatbot must say it is AI, labeling
            │  (Art. 50)                      │  of synthetic content, deepfakes
            ├──────────────────────────────┤
            │  MINIMAL RISK                  │  spam filters, recommendations in games;
            │  no specific obligations       │  voluntary codes
            └──────────────────────────────┘
    + a separate chapter for GENERAL-PURPOSE AI MODELS (GPAI), with additional obligations for models with systemic risk
```

**Annex III** lists the areas in which systems are high-risk: biometrics, critical infrastructure, education and vocational training, employment and worker management, access to essential private and public services (e.g., creditworthiness assessment, risk assessment and pricing for life and health insurance), law enforcement, migration and border control, justice and democratic processes. Article 6(3) allows an exception when an Annex III system does not pose a significant risk (e.g., it performs a narrow procedural task), but a system that profiles natural persons remains high-risk; a provider relying on the exception must document the assessment.

### Requirements for high-risk systems and the link to engineering

| Article | Requirement | Technical control from the course |
|---|---|---|
| 9 | A risk management system across the whole lifecycle | Threat modeling (module 2), risk assessment, evaluation |
| 10 | Data and data governance: quality, provenance, bias | Dataset provenance, AI-BOM (modules 7, 9) |
| 11 | Technical documentation | Model card, AI-BOM, architecture, evaluation results |
| 12 | Record-keeping (automatic logs) | Telemetry with versions and traces (module 10) |
| 13 | Transparency and instructions for users | Documentation of the intended purpose and limitations |
| 14 | Human oversight | Human-in-the-loop, kill switches (modules 5, 10) |
| 15 | Accuracy, robustness and cybersecurity, including resilience against data and model poisoning, adversarial examples and confidentiality attacks | Defenses from modules 3–9, red teaming (module 10) |

Article 15 is where the AI Act relies directly on security engineering: it requires measures against the attacks we covered through ATLAS and NIST AI 100-2.

Deployers of high-risk systems have their own obligations (Article 26): use the system according to the instructions, ensure human oversight by competent people, keep the logs under their control, monitor operation and report problems. Certain deployers (e.g., public bodies and those providing public services, and for creditworthiness assessment and insurance) also carry out a **fundamental rights impact assessment** (FRIA, Article 27).

### Transparency and GPAI

**Article 50** applies regardless of whether a system is high-risk: users must know they are interacting with an AI system (unless it is obvious), synthetic content must be machine-marked, and deepfake content must be labeled as such.

For **general-purpose models** (GPAI), providers keep technical documentation, provide information to providers that integrate the model into their systems, have a copyright compliance policy and publish a summary of the training content (Article 53). Models with **systemic risk** (presumed when training compute exceeds 10^25 FLOP) additionally carry out evaluations including adversarial testing, assess and mitigate systemic risks, track and report serious incidents and ensure adequate cybersecurity protection (Article 55). The GPAI Code of Practice (2025) is a voluntary way to demonstrate compliance.

**Article 4** requires measures for the **AI literacy** of staff working with AI systems. The AI Omnibus also amended this provision, so check the exact wording in the consolidated text.

### Deadlines after the AI Omnibus

| Date | What starts to apply |
|---|---|
| 1 Aug 2024 | Regulation 2024/1689 enters into force |
| 2 Feb 2025 | Prohibited practices (Art. 5), AI literacy (Art. 4) |
| 2 Aug 2025 | Obligations for GPAI models, governance structure, penalties |
| 2 Aug 2026 | Most other provisions, including transparency obligations (Art. 50) |
| 27 Jul 2026 | The AI Omnibus, Regulation (EU) 2026/1744, enters into force |
| no later than 2 Dec 2027 | Obligations for high-risk systems under **Annex III** |
| no later than 2 Aug 2028 | Obligations for high-risk systems under **Annex I** (AI in regulated products) |

The Omnibus also ties the application of high-risk obligations to the availability of compliance support (harmonized standards, guidelines), so the obligations may start earlier than the listed final deadlines if the Commission confirms that support is available. It introduced other changes as well (e.g., extending relief for smaller enterprises). For specific obligations, always read the consolidated text and the Commission's guidelines.

Fines (Article 99) go up to €35 million or 7% of total annual turnover for prohibited practices, up to €15 million or 3% for most other obligations, and up to €7.5 million or 1% for supplying incorrect information to the authorities, with more lenient rules for SMEs.

> **In practice:** the postponement of the high-risk deadlines is no reason to wait. Inventory, classification, logging, human oversight and technical documentation take months, and you need most of these controls for security anyway, regardless of regulation. The prohibitions, GPAI obligations and AI literacy already apply.

### Classifying use cases

The legal team does the classification, but engineers provide the facts: what the system does, to whom, which decision it supports and who makes the final decision. A simplified triage helper (it does not replace a legal assessment):

```python
PROHIBITED = {"social_scoring", "harmful_manipulation", "untargeted_face_scraping",
              "emotion_recognition_workplace_or_school"}
ANNEX_III = {"biometrics", "critical_infrastructure", "education", "employment",
             "essential_services", "law_enforcement", "migration", "justice_democracy"}
TRANSPARENCY = {"chatbot", "synthetic_content", "deepfake", "emotion_recognition_other"}

def triage(use_case: dict) -> dict:
    tags = set(use_case["tags"])
    if tags & PROHIBITED:
        return {"class": "prohibited", "action": "stop, legal team"}
    if use_case.get("annex_i_safety_component"):
        return {"class": "high_risk_annex_i", "action": "legal team, deadline no later than 2 Aug 2028"}
    if tags & ANNEX_III:
        if use_case.get("profiling") or not use_case.get("art_6_3_exception_documented"):
            return {"class": "high_risk_annex_iii", "action": "requirements Arts. 9–15 / Art. 26"}
    result = {"class": "minimal", "action": "standard security assessment"}
    if tags & TRANSPARENCY:
        result = {"class": "transparency", "action": "Art. 50: notice and labeling"}
    return result

print(triage({"name": "CV screening", "tags": ["employment"], "profiling": True}))
# {'class': 'high_risk_annex_iii', 'action': 'requirements Arts. 9–15 / Art. 26'}
```

Examples:

| Use case | Likely class | Why |
|---|---|---|
| Ranking job candidates based on CVs | High-risk (Annex III, employment) | Affects access to employment, profiling |
| Creditworthiness assessment of natural persons | High-risk (Annex III, essential services) | Access to financial services |
| A support chatbot on a website | Transparency obligations (Art. 50) | The user must know they are talking to AI |
| Generating marketing images | Transparency (labeling synthetic content) | Synthetic content |
| An internal assistant for searching documentation | Minimal risk | Doesn't decide on people's rights; still needs security controls |
| Recognizing employees' emotions in the workplace | Prohibited (with narrow exceptions, e.g., medical or safety reasons) | Article 5 |

## NIST AI RMF and the Generative AI Profile

The **NIST AI RMF 1.0** organizes risk management into four functions:

| Function | What it does | Example activity |
|---|---|---|
| **GOVERN** | Culture, policies, roles, accountability; cuts across the other functions | AI policy, RACI, training, vendor assessment |
| **MAP** | Context: purpose, users, impact, risks | Intake questionnaire, threat model, classification |
| **MEASURE** | Measuring and tracking risk | Evaluation, red teaming, metrics, monitoring |
| **MANAGE** | Prioritizing and handling risks | Controls, risk acceptance decisions, incident response |

The framework defines the characteristics of trustworthy AI: valid and reliable; safe; secure and resilient; accountable and transparent; explainable and interpretable; privacy-enhanced; fair, with harmful bias managed. The framework comes with a **Playbook** of suggested actions for each subcategory.

**NIST AI 600-1** (Generative AI Profile, July 2024) applies the RMF to generative AI and lists 12 risks, including confabulation, information security, data privacy, intellectual property, information integrity, human–AI configuration, and value chain and component integration. For each risk it proposes actions mapped to the RMF functions.

For security teams, **NIST AI 100-2** (the adversarial machine learning taxonomy, 2025 edition) also matters: it provides a shared vocabulary of attacks (evasion, poisoning, privacy, misuse, direct and indirect prompt injection) used throughout this course.

## ISO/IEC 42001

**ISO/IEC 42001:2023** is the first standard for an **AI management system**. If your organization has ISO/IEC 27001, the structure will be familiar:

- clauses 4–10: context of the organization, leadership, planning (AI risk assessment and treatment, **AI system impact assessment**), support, operation, performance evaluation, improvement,
- **Annex A**: reference controls (AI policies, internal organization, resources, impact assessment, AI system lifecycle, data, information for interested parties, use of AI systems, third-party relationships),
- Annex B: implementation guidance for the controls; Annex C: potential objectives and risk sources; Annex D: use across domains and sectors.

As with 27001, the organization produces a **Statement of Applicability** for the Annex A controls. Related standards: ISO/IEC 23894 (guidance on AI risk management), ISO/IEC 42005 (AI system impact assessment) and ISO/IEC 42006 (requirements for bodies that audit and certify an AIMS).

> **In practice:** if you already have an ISMS under 27001, don't build a parallel system for AI. Extend the existing one: the same risk management process, the same internal audit and management review, additional controls from 42001 Annex A and AI-specific risks in the risk register. That way auditors and management see one picture, not two systems that disagree.

## AI governance in the organization

### Policies and roles

The minimum set:

- **AI acceptable use policy**: which tools are approved, which data classes may go into them (e.g., public and internal yes, confidential only into approved instances with a contract), prohibited uses, the obligation to have a human check the output.
- **AI system development policy**: intake, risk assessment, mandatory controls (from modules 3–10), a launch gate, monitoring.
- **Roles**: the AI system owner (business accountability), the technical owner, an AI governance body (legal, security, privacy, business), the DPO for personal data.

### AI system inventory

You can't manage what you don't know exists. The inventory covers internally developed systems, AI features in purchased SaaS products, and tools employees use ("**shadow AI**").

```yaml
# ai-inventory/tiketi-asistent.yaml
id: ai-0042
name: tiketi-asistent
owner: podrska@firma.example            # business owner
tech_owner: platform-ml@firma.example
role_eu_ai_act: deployer                # vendor model, internal use
risk_class: minimal                     # triage result + legal confirmation
transparency_art50: true                # users know the assistant is AI
model:
  provider: vendor-x
  name: vendor-x-large
  version_pin: "2026-07"
data_classes: [internal, personal_pseudonymized]
capabilities: { rag: true, tools: [search_kb, create_ticket], autonomy: confirm_writes }
controls: [doc-level-acl, tool-allowlist, output-schema, telemetry, eval-ci]
aibom: registry://tiketi-asistent/3.2.0/aibom.cdx.json
assessments:
  - { type: security, date: 2026-08-12, result: approved }
  - { type: dpia, date: 2026-08-20, result: approved }
review_due: 2027-02-01
```

Sources for filling it in: CASB and proxy logs (which AI services are used), cloud and card spending (subscriptions to AI tools), procurement (contracts with AI features), the model registry, model vendor API keys in the secrets manager.

> **In practice:** shadow AI isn't solved by a ban. If the only approved path is slow or doesn't exist, people will paste confidential data into public tools. Offer an approved alternative (an enterprise instance with a contract that excludes training on your data), a simple one-page intake and a clear list of what is allowed, and only then block disallowed services at the proxy.

### Risk assessment process

```text
 intake (1 page)    ──► triage ──► classification ──► assessment ──► decision ──► monitoring
   purpose, data,       minimal:      EU AI Act        security      approved /    periodic
   users, model,        fast track    (legal team),    (module 2),   conditions /  review,
   tools, autonomy      others:       role             DPIA, FRIA    rejected      incidents,
                        full review                    if needed                   changes → again
```

The assessment chooses controls according to the risks, not from an "everything for everyone" list. An internal assistant with RAG over public documentation needs less than an agent that writes to the ERP. Every significant change (a new model, a new tool, a new data class, a new user group) sends the system back for assessment.

### AI vendors

Most organizations use AI through vendors: model APIs, SaaS with AI features, ready-made agents. Questions for a vendor assessment:

| Area | Question | Why |
|---|---|---|
| Data use | Are our inputs and outputs used for training? Can that be excluded by contract? | Leakage and intellectual property |
| Retention and location | How long are inputs and logs kept, where are they processed, who are the sub-processors? | GDPR, confidentiality |
| Security | Certifications (ISO/IEC 27001, 42001, SOC 2), red teaming results, response to vulnerability reports | Vendor maturity |
| Model changes | Does the model change without notice? Can the version be pinned? | Regressions, evaluation reproducibility |
| Incidents | Deadline and method for incident notification | Your notification obligations (module 10) |
| Logs and monitoring | What telemetry do we get (users, queries, tool calls)? | Detection and investigation |
| Regulation | Role under the EU AI Act; for GPAI, documentation for downstream providers (Art. 53) | Your compliance depends on their information |
| Agents and integrations | What permissions does the integration request (OAuth scope), does it support least privilege? | Excessive agency in someone else's product |

> **In practice:** the most common gap in contracts is the lack of an obligation to give notice of model changes. The vendor swaps the model, your guardrails and evaluations are calibrated for the old one, and behavior changes overnight. Ask for the ability to pin a version and a notice period, and run your own evaluation (module 10) before moving to a new version.

## Evidence: from control to artifact

An auditor (internal, certification or a competent authority) doesn't ask "do you have logging," but "show me." A good governance program knows in advance which technical artifact proves which control and where it is kept:

| Requirement | Evidence | Who produces it | Where it is kept |
|---|---|---|---|
| Inventory and classification | Inventory entry with risk class and role, legal team confirmation | System owner, legal team | Inventory repository (versioned) |
| Technical documentation (Art. 11) | Model card, AI-BOM, architecture diagram, data description | Pipeline (automatic) + technical owner | Model registry, with the version |
| Risk management (Art. 9) | Threat model, risk register, risk acceptance decisions | Security, system owner | GRC tool |
| Robustness and security (Art. 15) | CI evaluation results, red team reports, finding status | CI, red team | CI job artifacts, tickets |
| Record-keeping (Art. 12) | Telemetry configuration, log sample, retention policy | Platform | SIEM, log storage |
| Human oversight (Art. 14) | Autonomy and confirmation configuration, confirmation logs, operator training | Technical owner, HR | Configuration, LMS |
| Vendor management | Completed questionnaire, contract (training, retention, change notice, incidents) | Procurement, security | Contract system |
| AI literacy (Art. 4) | Training program, records of completed training by role | HR, security | LMS |

An example of an automated CI check: an AI system release fails if the inventory has no recent assessment or if mandatory artifacts are missing.

```python
import datetime, sys, yaml   # PyYAML or an equivalent parser

entry = yaml.safe_load(open(sys.argv[1]))          # ai-inventory/<system>.yaml
errors = []
for field in ("owner", "risk_class", "role_eu_ai_act", "aibom"):
    if not entry.get(field):
        errors.append(f"missing field: {field}")
if entry.get("risk_class") == "prohibited":
    errors.append("prohibited class: release not allowed")
if datetime.date.fromisoformat(str(entry["review_due"])) < datetime.date.today():
    errors.append("reassessment deadline has passed")
if not any(a["type"] == "security" and a["result"] == "approved" for a in entry.get("assessments", [])):
    errors.append("no approved security assessment")
print("\n".join(errors) or "governance gate OK")
sys.exit(1 if errors else 0)
```

Common mistakes in governance programs:

- an inventory built once, without an owner or a review date,
- classification without technical facts (the legal team doesn't know the system has a tool that writes to the ERP),
- a policy that bans everything, so people work around it,
- a vendor assessment that doesn't ask about the use of data for training and about model changes,
- documentation written by hand for the audit that doesn't match the system in production.

## Mapping the frameworks

| Topic | EU AI Act | NIST AI RMF | ISO/IEC 42001 |
|---|---|---|---|
| Policies and accountability | Provider and deployer obligations, AI literacy (Art. 4) | GOVERN | Clause 5, Annex A (policies, internal organization) |
| Inventory and context | Classification, registration of high-risk systems | MAP | Clause 4, Annex A (lifecycle, resources) |
| Risk and impact assessment | Art. 9, FRIA (Art. 27) | MAP, MEASURE | Clause 6, impact assessment |
| Testing and measurement | Art. 15, Art. 55 (adversarial testing of GPAI) | MEASURE | Clause 9, Annex A (lifecycle) |
| Logs and oversight | Art. 12, Art. 26 | MEASURE, MANAGE | Clauses 8–9 |
| Incidents | Art. 73, Art. 55 | MANAGE | Clause 10 |
| Vendors | Obligations along the chain, Art. 53 information for downstream providers | GOVERN | Annex A (third-party relationships) |

## Summary

- The **EU AI Act** is a binding regulation organized by risk level: prohibited practices (Art. 5), high-risk systems (Art. 6, Annexes I and III, requirements in Arts. 9–15), transparency obligations (Art. 50), minimal risk, plus a separate chapter for GPAI models (Arts. 53, 55).
- Obligations depend on the **role** for a specific system (provider or deployer); changing the intended purpose can turn a deployer into a provider.
- The **AI Omnibus** (Regulation (EU) 2026/1744, in force since 27 Jul 2026) moved the high-risk obligations: Annex III no later than 2 Dec 2027, Annex I no later than 2 Aug 2028. The prohibitions, GPAI obligations and transparency apply earlier.
- Article 15 (accuracy, robustness, cybersecurity) and Article 12 (logs) rely directly on the technical controls from this course.
- **NIST AI RMF 1.0**: GOVERN, MAP, MEASURE, MANAGE; **AI 600-1** adds 12 generative AI risks; **AI 100-2** provides the attack taxonomy.
- **ISO/IEC 42001** is a certifiable AI management system with controls in Annex A; fit it into your existing 27001 ISMS.
- In the organization: an acceptable use policy, an inventory (including shadow AI and AI in SaaS), intake and triage, a risk assessment proportional to the system, reassessment on significant changes.
- With vendors, check the use of data for training, retention and location, model version pinning and change notice, incident notification and the telemetry you get.
