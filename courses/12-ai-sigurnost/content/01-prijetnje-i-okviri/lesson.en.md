## What this module covers

The opening module of the course covers two objectives from domain 1:

- **1.1** The AI/ML threat landscape and taxonomies: **NIST AI 100-2 E2025** and **MITRE ATLAS**.
- **1.2** The **OWASP Top 10 for LLM Applications 2025** and the **OWASP Top 10 for Agentic Applications 2026**.

After this module you should know:

- how an AI system differs from a classic application in terms of attack surface;
- how NIST AI 100-2 classifies attacks (learning stage, attacker goal, capabilities, knowledge);
- how MITRE ATLAS is organized (tactics, techniques, mitigations, case studies) and how you use it in detection and reporting;
- all ten items of the OWASP Top 10 for LLM and the ten items for agentic applications, with a typical control for each;
- which framework you use for which purpose (talking to developers, mapping detections, the risk register).

This module is the map. The rest of the course fills it in, control by control.

## Why an AI system needs a dedicated view

A classic web application has a clear boundary between **code** (what the developer writes) and **data** (what the user sends). The whole discipline of secure input handling (parameterized queries, escaping, validation) rests on that boundary.

An LLM application erases that boundary: the model receives instructions and data **in the same channel**, as text, and there is no reliable mechanism that guarantees it will tell one from the other. On top of that:

- **Behavior is probabilistic.** The same input can produce different output; a test that passed once does not prove it will always pass.
- **The model is a supply chain artifact.** Weights, tokenizer, datasets and libraries come from third parties, often as large binary files.
- **Data is attack surface.** Whoever influences the training, fine-tuning or RAG index data influences the system's behavior.
- **Agents act.** When the model calls tools (API, database, shell, email), a model error becomes an action in a real system.

A typical architecture with trust boundaries:

```text
 User ──► [ API gateway / auth ] ──► [ Application (orchestrator) ] ──► [ LLM (self-hosted or vendor API) ]
                                          │        ▲        │
                                          │        │        └──► [ Tools: API, DB, email ]   ← boundary: actions
                                          ▼        │
                              [ Retrieval / vector store ] ◄── [ Document ingest ]        ← boundary: untrusted content
                                          │
 ML pipeline: [ data ] ─► [ training / fine-tuning ] ─► [ model registry ] ─► [ serving ] ← boundary: supply chain
```

Every arrow that crosses a boundary is a place where you choose a control. The frameworks in this module give you a shared language to name those risks.

### Who attacks and what they want

A threat landscape is not just a list of techniques. It helps to think about actors and their goals, because that determines which controls take priority:

| Actor | Typical goal | Where they touch the system |
|---|---|---|
| Malicious application user | bypass restrictions, get other people's data, consume resources for free | chat/API input |
| Third party without an account | influence the system through content it reads | web pages, emails, documents, tickets |
| Compromised vendor or repository | slip in a malicious model, library or tool | ML pipeline, registry, MCP servers |
| Insider with data access | poison a dataset, exfiltrate the model or data | data pipeline, model registry |
| Competitor or researcher | replicate the model, extract training data | inference API |
| Accidental error (not an attack) | no goal, but harm occurs: hallucination, wrong agent action | everywhere |

The last row matters: a large share of AI incidents happens without an attacker. Controls that limit consequences (least privilege, confirmation, output validation) protect against both attacks and model errors.

### Impacts you measure

For risk assessment, group impacts the same way as for other systems:

- **confidentiality**: leakage of personal data, secrets, the system prompt, other tenants' data, the model itself;
- **integrity**: wrong decisions, altered data, unauthorized agent actions, a poisoned index or model;
- **availability and cost**: exhaustion of GPU capacity, quotas or budget (denial of wallet);
- **harm outside the system**: incorrect information given to users, legal and reputational consequences (ATLAS groups them under **AML.T0048 External Harms**).

> **In practice:** when a team says "we just call a vendor API, the model isn't our problem," show them the diagram. The vendor's model is one box; everything else (prompt, retrieval, tools, output handling, logs) is your responsibility, and that is where most incidents happen.

## NIST AI 100-2 E2025: an adversarial ML taxonomy

**NIST AI 100-2 E2025**, *Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations* (March 2025), is the reference vocabulary for attacks on ML systems. It does not prescribe controls; it provides a classification and terminology so that teams, vendors and regulators speak the same language. The document is split into **predictive AI (PredAI)** and **generative AI (GenAI)**.

### Classification dimensions

| Dimension | Values | Why you need it |
|---|---|---|
| Learning stage | training time / deployment time | determines where you place the control: in the data pipeline or in serving |
| Attacker goal | **availability breakdown**, **integrity violation**, **privacy compromise**; for GenAI also **misuse enablement** | links the attack to the CIA property you protect |
| Capabilities | training data control, model control, testing data control, label control, source code control, query access; for GenAI also control over resources the model reads | tells you which capability a control takes away from the attacker |
| Knowledge | white-box, black-box, gray-box | affects a realistic likelihood estimate |

The taxonomy assigns labels: **NISTAML.01** (availability), **NISTAML.02** (integrity), **NISTAML.03** (privacy), **NISTAML.04** (misuse), **NISTAML.05** (supply chain attacks). The labels are useful in a risk register when you want to point to the definition rather than paraphrase it.

### PredAI attack classes

- **Evasion**: modified input at deployment time causes misclassification. Defense: adversarial training, robustness testing, limiting the impact of a single model decision, human review for critical decisions.
- **Poisoning**: availability poisoning (general degradation), targeted poisoning (wrong behavior on specific samples), backdoor poisoning (a hidden trigger), model poisoning (direct modification of parameters, e.g., in federated learning). Defense: data provenance and integrity, sanitization, control over who may change datasets, model validation before release.
- **Privacy** attacks: data reconstruction, **membership inference**, property inference and **model extraction**. Defense: access control and query limits, output minimization (no unnecessary confidence values), differential privacy during training, monitoring query patterns.

### GenAI attack classes

- **Supply chain** attacks: poisoning of data and models that come from third parties, including malicious code in model formats (module 08).
- **Direct prompting** attacks: the user directly sends input that tries to bypass restrictions (jailbreak) or extract information (e.g., the system prompt, data from the context).
- **Indirect prompt injection**: instructions arrive through content the model reads (a web page, an email, a RAG document, tool output). It can target availability, integrity or privacy.
- A dedicated section covers **agent security**, because an agent turns a successful attack into an action.

The document's key message for engineers: for many of these attacks **no complete mitigation exists**. NIST explicitly notes trade-offs between accuracy, robustness and privacy. That is why defense is built as **defense in depth** at the system level, not as a single filter in front of the model.

> **In practice:** use NIST AI 100-2 when you write a policy or answer a regulator and need a neutral, precise definition ("membership inference as defined in NIST AI 100-2"). For day-to-day SOC work ATLAS is more practical, and for developers OWASP.

## MITRE ATLAS

**MITRE ATLAS** (Adversarial Threat Landscape for Artificial-Intelligence Systems) is a knowledge base of adversary tactics and techniques against AI systems, modeled on **MITRE ATT&CK**. If your SOC already maps detections to ATT&CK, ATLAS is a natural extension.

### Structure

- **Tactics** (`AML.TA00xx`): *why* the attacker does something (the goal at a stage of the attack).
- **Techniques and sub-techniques** (`AML.T00xx`, `AML.T00xx.00y`): *how* they achieve the goal.
- **Mitigations** (`AML.M00xx`): controls linked to techniques.
- **Case studies** (`AML.CS00xx`): documented real-world incidents and researcher demonstrations.

The tactics ATLAS shares with ATT&CK (Reconnaissance, Initial Access, Execution, Persistence, Exfiltration, Impact…) are complemented by two that are specific to AI:

| Tactic | ID | Meaning |
|---|---|---|
| AI Model Access | AML.TA0000 | the attacker gains access to the model (inference API, a product that uses the model, physical environment) |
| AI Attack Staging | AML.TA0001 | preparing a model-specific attack (e.g., a proxy model, crafting adversarial data) |

### Techniques you will encounter most often (abstract)

| Technique | ID | Defensive focus |
|---|---|---|
| LLM Prompt Injection (Direct / Indirect) | AML.T0051 (.000 / .001) | trust boundaries, privilege separation (module 03) |
| LLM Jailbreak | AML.T0054 | guardrails, limiting consequences, monitoring |
| Extract LLM System Prompt | AML.T0056 | no secrets in the prompt, authorization outside the model (module 04) |
| LLM Data Leakage | AML.T0057 | context minimization, output filtering (module 04) |
| AI Agent Tool Invocation | AML.T0053 | tool allowlist, least privilege (module 05) |
| RAG Poisoning | AML.T0070 | ingest control, document provenance (module 06) |
| Poison Training Data | AML.T0020 | data provenance and integrity (module 07) |
| AI Supply Chain Compromise | AML.T0010 | safe formats, signatures, AI-BOM (module 08) |
| Exfiltration via AI Inference API | AML.T0024 | query limits, monitoring (module 09) |
| Cost Harvesting / Denial of AI Service | AML.T0034 / AML.T0029 | quotas, rate limiting (module 05) |

Examples of ATLAS mitigations: **AML.M0020 Generative AI Guardrails**, **AML.M0024 AI Telemetry Logging**, **AML.M0023 AI Bill of Materials**, **AML.M0014 Verify AI Artifacts**, **AML.M0029 Human In-the-Loop for AI Agent Actions**, **AML.M0030 Restrict AI Agent Tool Invocation on Untrusted Data**.

ATLAS is updated regularly (especially with agent techniques), and some techniques get renamed. In a report, therefore, give both the ID and the name, and verify them against the current version at atlas.mitre.org.

### How to read a technique page

Every technique in ATLAS has the same layout, and from it you pull what the defense needs:

- **description**: in abstract terms, what the attacker achieves and under what condition (this goes into the threat model);
- **tactics**: at which stage of the attack the technique appears (this determines where you look for traces in the logs);
- **mitigations**: linked `AML.M` controls (a starting list for your plan);
- **case studies**: real incidents in which the technique was seen (an argument for priority in front of management).

ATLAS data is also available in machine-readable form (YAML/STIX in a public repository), so you can check mappings automatically in the CI pipeline for your detection rules.

### How you use ATLAS in practice

1. **Detection mapping.** Every SIEM rule for an AI application gets an ATLAS label, just like ATT&CK.
2. **Coverage.** A techniques × existing controls table shows the gaps.
3. **Incident report.** You describe the flow of an incident as a chain of tactics, which makes it easier to compare with case studies.
4. **Red team plan.** You pick test scenarios (module 10) by the techniques relevant to your architecture.

```yaml
# Defensive example: detection rule metadata with an ATLAS mapping
rule: llm-tool-call-outside-allowlist
description: The agent requested a tool that is not on the allowlist for this tenant
atlas:
  tactic: AML.TA0005        # Execution
  technique: AML.T0053      # AI Agent Tool Invocation
mitigation: [AML.M0028, AML.M0029]
severity: high
action: block_and_alert
```

> **In practice:** ATLAS and ATT&CK are used together. An incident involving an AI application almost always has "ordinary" steps too: a stolen API key, a misconfigured bucket holding models, a hijacked CI runner. ATLAS adds what is specific to the model, but it does not replace ATT&CK.

## OWASP Top 10 for LLM Applications 2025

The **OWASP GenAI Security Project** maintains a list of the most critical risks for applications that use LLMs. Version **2025** is the current one. Labels take the form `LLM01:2025`.

| Label | Name | Essence of the risk | Key control | Where in the architecture |
|---|---|---|---|---|
| LLM01 | **Prompt Injection** | input (direct or through content) changes the model's behavior | trust boundaries, least privilege, human confirmation for risky actions | orchestrator, tools |
| LLM02 | **Sensitive Information Disclosure** | the model reveals personal data, secrets, business information | data minimization in the context, output filtering, access control | retrieval, output |
| LLM03 | **Supply Chain** | compromised models, adapters, datasets, libraries | safe formats, signatures, AI-BOM, provenance checks | ML pipeline, registry |
| LLM04 | **Data and Model Poisoning** | poisoned data for pre-training, fine-tuning or embeddings | data provenance, validation, change control | data pipeline |
| LLM05 | **Improper Output Handling** | model output is passed without validation to a browser, shell, SQL | treat output as untrusted input, schema, encoding | between the model and the rest of the system |
| LLM06 | **Excessive Agency** | the agent has too much functionality, permission or autonomy | minimal tool set, narrowly scoped credentials, human-in-the-loop | tools, agent identity |
| LLM07 | **System Prompt Leakage** | the system prompt reveals secrets or logic that security relies on | no secrets in the prompt, security decisions outside the model | prompt, authorization |
| LLM08 | **Vector and Embedding Weaknesses** | weaknesses in generating, storing and retrieving embeddings (access, poisoning, leakage) | document-level access control, partitioning by tenant | vector store |
| LLM09 | **Misinformation** | convincing but incorrect outputs (including hallucinations) that users rely on | grounding, source citation, human review, clear communication of limitations | UX, process |
| LLM10 | **Unbounded Consumption** | unbounded requests consume resources and money or enable model extraction | rate limiting, quotas, input and output size limits, budgets | gateway, serving |

Changes from the 2023/24 version worth remembering: **System Prompt Leakage** and **Vector and Embedding Weaknesses** are new items; **Misinformation** was expanded (previously "Overreliance"); **Unbounded Consumption** expands the earlier "Model Denial of Service" and covers both financial losses and unauthorized model replication.

## OWASP Top 10 for Agentic Applications 2026

In December 2025 the OWASP GenAI Security Project published a separate list for **agentic applications**, i.e., systems in which an LLM plans, remembers and calls tools with some degree of autonomy. Labels use the prefix **ASI**.

| Label | Name | Essence | Defensive focus |
|---|---|---|---|
| ASI01 | **Agent Goal Hijack** | the agent's goal is redirected through content it reads | treat all inputs as untrusted, fixed goals and plans, confirmation of risky actions |
| ASI02 | **Tool Misuse and Exploitation** | legitimate tools are used in an unsafe or unintended way | narrow tool scope, parameter validation, allowlists, limits |
| ASI03 | **Identity and Privilege Abuse** | the agent inherits or abuses user or service permissions | separate agent identity, short-lived credentials, narrowly scoped delegation |
| ASI04 | **Agentic Supply Chain Vulnerabilities** | compromised tools, MCP servers, plugins, prompts or models the agent loads | provenance checks, version pinning, registry of approved tools |
| ASI05 | **Unexpected Code Execution (RCE)** | the agent generates or runs code that performs unwanted actions | sandbox without network or secrets, no direct `eval`, code review |
| ASI06 | **Memory & Context Poisoning** | poisoning of long-term memory or context the agent uses later | checks before writing to memory, per-user isolation, expiry and review |
| ASI07 | **Insecure Inter-Agent Communication** | messages between agents without authentication, integrity or validation | mutual authentication, signed messages, schema validation |
| ASI08 | **Cascading Failures** | one agent's error spreads through connected systems | isolation, circuit breakers, limits and breakpoints |
| ASI09 | **Human-Agent Trust Exploitation** | people over-trust the agent and approve its suggestions without checking | clearly show what is being approved, verification of risky actions, training |
| ASI10 | **Rogue Agents** | the agent acts outside its intended goals (drift, compromise) | behavior monitoring, kill switch, review and limiting of permissions |

The two lists complement each other: the LLM Top 10 looks at the application around the model, the Agentic Top 10 looks at autonomy, tools, memory and multi-agent interaction. An agentic application is exposed to risks from **both** lists. For example, LLM01 (Prompt Injection) is often the mechanism, while ASI01 (Agent Goal Hijack) and ASI02 (Tool Misuse) are the consequences you see in an agentic system.

Alongside the lists, the same project publishes supporting material (e.g., guides for threat modeling agents and for MCP security). Check the current versions at genai.owasp.org before citing them in a policy.

> **In practice:** when you write requirements for a new AI project, build a table with all 10 + 10 items and fill in for each: "applicable / not applicable / control / owner." An agent without memory skips ASI06, but that must be a recorded decision, not an oversight.

## From list to controls: a minimum baseline

Risk lists don't protect anything on their own. For every new AI system, set a minimum set of controls that covers most of both lists, then extend it based on the results of threat modeling (module 02):

| Control | Covers (primarily) |
|---|---|
| All content that does not come from the operator is treated as untrusted and marked in the prompt | LLM01, ASI01, ASI06 |
| Authorization is done in application code, never "in the prompt" | LLM01, LLM06, LLM07, ASI03 |
| Model output passes schema validation and contextual encoding before use | LLM05, ASI05 |
| Allowlisted tools, with narrowly scoped credentials and confirmation for risky actions | LLM06, ASI02, ASI03, ASI09 |
| Document-level access control in retrieval, per-tenant isolation | LLM02, LLM08 |
| Models and data only from trusted sources, safe formats, signatures, AI-BOM | LLM03, LLM04, ASI04 |
| Rate limiting, quotas, token limits, budget alerts | LLM10, ASI08 |
| Telemetry: prompt, retrieval, tool calls, filter decisions (with personal data protection) | all, especially ASI10 |
| Grounding, source citation, clearly labeled AI content | LLM09, ASI09 |

```yaml
# Defensive example: security requirements in a design review template
ai_security_baseline:
  untrusted_content_marked: required
  authz_outside_model: required
  output_schema_validation: required
  tool_allowlist: required
  high_risk_action_confirmation: required
  retrieval_acl: required_if_rag
  model_artifact_signature: required_if_self_hosted
  rate_limits: { per_user_rpm: 30, max_output_tokens: 2048 }
  telemetry: { prompts: redacted, tool_calls: full, retention_days: 90 }
```

## Which framework for which purpose

| Framework | What it is | Who it serves | Example use |
|---|---|---|---|
| NIST AI 100-2 | taxonomy and terminology | policy, risk, regulatory documents | definitions in the organization's AI policy |
| MITRE ATLAS | base of tactics, techniques, mitigations, cases | SOC, detection, red team, IR | an ATLAS ID on every detection rule |
| OWASP LLM Top 10 | prioritized list of application risks | developers, AppSec, architects | checklist in a design review |
| OWASP Agentic Top 10 | list of agentic system risks | teams building agents | requirements for tools, identity, memory |
| NIST AI RMF / AI 600-1 | risk management (Govern, Map, Measure, Manage) | management, governance | module 11 |
| ISO/IEC 42001 | AI management system (AIMS) | organization, certification | module 11 |

The frameworks are not mutually exclusive. A typical flow: OWASP tells you what to check in the design, ATLAS what to detect and test, NIST AI 100-2 how to name the attack precisely, and the AI RMF and ISO/IEC 42001 how to tie it all into governance.

### Mapping one risk across frameworks

Example: through a document in RAG, a user can influence the answer another user receives.

```text
OWASP LLM:      LLM01 Prompt Injection (indirect), LLM08 Vector and Embedding Weaknesses
OWASP Agentic:  ASI06 Memory & Context Poisoning (if there is memory), ASI01 if the agent acts
MITRE ATLAS:    AML.T0051.001 LLM Prompt Injection: Indirect, AML.T0070 RAG Poisoning
NIST AI 100-2:  GenAI, indirect prompt injection, goal: integrity violation
Controls:       who may add documents, provenance and content review, per-tenant isolation,
                marking untrusted content in the prompt, no tools with consequences without confirmation
```

## An inventory of AI components as a starting point

No framework helps if you don't know what you have. The first step in any organization is an inventory:

```yaml
# Defensive example: an entry in the AI system inventory
system: helpdesk-asistent
owner: tim-podrska
model:
  provider: eksterni-api
  data_retention: "0 dana (ugovorno)"
components: [rag, tools]
tools: [ticket_read, ticket_comment]          # no sending email, no deleting
data_classes_in_context: [interno, licni_podaci_klijenata]
owasp_llm: [LLM01, LLM02, LLM05, LLM06, LLM08]
owasp_agentic: [ASI01, ASI02, ASI03]
atlas_detections: [AML.T0051, AML.T0053, AML.T0057]
review: 2026-09-30
```

(Values in this example: `helpdesk-asistent` = helpdesk assistant, `tim-podrska` = support team, `eksterni-api` = external API, `0 dana (ugovorno)` = 0 days (contractual), `interno` = internal, `licni_podaci_klijenata` = customer personal data.)

From an entry like this you immediately see which risks you must cover and which detections you expect. The inventory is also the basis for governance and classification under the EU AI Act (module 11).

> **In practice:** an inventory always uncovers "shadow" AI use: a script that sends logs to an external model for summarization, an IDE plugin, a CRM integration. That is exactly where data most often leaks, because nobody reviewed it.

## Common misconceptions

- **"We have a guardrail model in front of the LLM, so we're protected against prompt injection."** Filters reduce risk but don't guarantee protection. Controlling consequences (privileges, confirmation, isolation) is mandatory.
- **"The vendor's model is secure, so the application is secure."** Most of the OWASP list is about the application around the model.
- **"AI security is the data science team's job."** Most controls are classic: identity, access, validation, logging, supply chain. That is the job of SecOps/DevSecOps engineers.
- **"ATLAS replaces ATT&CK."** No, it complements it.
- **"The lists are static."** OWASP and ATLAS are updated; a policy should reference the version and date.

## Summary

- AI systems erase the boundary between code and data, behave probabilistically, depend on the model and data supply chain, and agents turn errors into actions.
- **NIST AI 100-2 E2025** classifies attacks by learning stage, goal (availability, integrity, privacy, and for GenAI misuse), and the attacker's capabilities and knowledge. PredAI: evasion, poisoning, privacy. GenAI: supply chain, direct prompting, indirect prompt injection, agent security. Complete mitigations often don't exist, so defense is layered.
- **MITRE ATLAS** is ATT&CK for AI: tactics (`AML.TA`), techniques (`AML.T`), mitigations (`AML.M`), case studies. It is used for detection mapping, coverage, IR and red teaming; verify IDs against the current version.
- **OWASP LLM Top 10 2025**: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption.
- **OWASP Agentic Top 10 2026**: ASI01 Agent Goal Hijack, ASI02 Tool Misuse and Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents.
- The frameworks complement each other: OWASP for design, ATLAS for detection and testing, NIST AI 100-2 for terminology, the AI RMF and ISO/IEC 42001 for governance. The starting point is an inventory of AI systems.
