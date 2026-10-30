## What this module covers

This module covers objective **1.3 Threat modeling AI systems**.

After this module you should be able to:

- apply the "four questions" approach to an LLM application, RAG and an agent;
- draw a **data flow diagram (DFD)** with AI-specific trust boundaries (untrusted content, model output, tools, supply chain);
- identify the AI assets you protect (weights, prompt, corpus, tool credentials, budget);
- walk through **STRIDE** for AI components and extend it with the OWASP and ATLAS lists;
- assess an agent with heuristics such as the **lethal trifecta** and the **Agents Rule of Two**;
- turn the result into a risk register, a control backlog and triggers for re-modeling.

A threat model is not a document for the drawer. It is the cheapest place to discover that an agent has a tool it doesn't need or that a RAG index mixes tenants' data.

## The four questions

The approach popularized by Adam Shostack (and used by the **Threat Modeling Manifesto**) comes down to four questions:

1. **What are we working on?** System diagram, data flows, trust boundaries, assets.
2. **What can go wrong?** Threats per element and per boundary (STRIDE, OWASP, ATLAS).
3. **What are we going to do about it?** Controls, or accepting, transferring or avoiding the risk.
4. **Did we do a good job?** Verifying that controls are in place and that the model matches reality.

For an AI system the questions stay the same. What changes is what you draw and what you look for.

## Question 1: a diagram with AI trust boundaries

A classic DFD has external entities, processes, data stores and flows. With an AI system you add a few boundaries that are easy to miss:

```text
                    ┌──────────────── Boundary A: user → application ─────────────────┐
 [User] ──prompt──►    │ [API gateway] ──► [Orchestrator] ──prompt+context──► [LLM]     │
                       │                       ▲   │                             │      │
                       │          model output │   │ query                       │      │
                       │   Boundary B: output ─┘   ▼                             │      │
                       │                     [Retrieval] ◄── [Vector store]      │      │
                       │                                          ▲              │      │
                       └──────────────────────────────────────────┼──────────────┼──────┘
                         Boundary C: untrusted content            │              │
 [Third party] ──documents, email, web──► [Ingest] ───────────────┘              │
                                                                                 │
                         Boundary D: actions            [Tools: API, DB, email] ◄┘ (via the orchestrator)
                         Boundary E: supply chain       [Model registry] ◄── [Hub / vendor]
```

- **A (user → application):** the classic boundary, authentication and authorization.
- **B (model output → rest of the system):** model output is untrusted data, even though "our system generated it."
- **C (third-party content → context):** anything the model reads that was not written by the operator can carry instructions.
- **D (model decision → action):** a tool call changes system state or sends data out.
- **E (artifacts → serving):** the model, adapters, tokenizer, libraries and data come from outside.

The key difference from a classic application: the LLM process is not a trust boundary that "cleans" data. If untrusted content gets into the context, the model's output carries its influence too. That is why the trust label **propagates through the model**: the output is only as trusted as the least trusted input in the context.

> **In practice:** always put logs and telemetry on the diagram. Prompts and responses in logs often contain personal data and secrets, and the log platform has a wider access circle than the application itself. It is the data flow most often forgotten.

### Assets you protect

| Asset | Why it is valuable | Typical threat |
|---|---|---|
| Model weights (self-trained or fine-tuned) | intellectual property, training cost | theft, extraction, tampering |
| System prompt and configuration | business logic, sometimes (wrongly) secrets | leakage, configuration disclosure |
| Training and fine-tuning data | personal and business data, model quality | poisoning, leakage, membership inference |
| RAG corpus and vector store | internal documents with different access levels | unauthorized access, poisoning |
| Tool credentials and agent identity | enable actions in other systems | privilege abuse |
| User data in conversations | personal data, confidential information | leakage to other users, into logs |
| Budget and capacity (GPU, quotas) | direct cost, availability | denial of wallet, DoS |
| User trust in the output | decisions are made based on answers | misinformation, manipulation |

## Question 2: what can go wrong

### STRIDE across AI elements

STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) works for AI too, but each letter gets specific examples:

| STRIDE | Example in an AI system (abstract) | Control |
|---|---|---|
| **S**poofing | a message posing as a system instruction or as another agent; a fake MCP server | clear structural separation of roles, authentication of agents and servers |
| **T**ampering | a poisoned document in RAG, a modified model in the registry, poisoned agent memory | ingest control, artifact signatures, checks before writing to memory |
| **R**epudiation | no record of which prompt and which retrieval led to an agent action | telemetry with a correlation ID, immutable logs |
| **I**nformation disclosure | the model returns other people's documents, personal data or the system prompt | ACLs in retrieval, context minimization, output filtering |
| **D**enial of service | expensive queries, endless agent loops, quota exhaustion | rate limiting, token and step limits, budgets |
| **E**levation of privilege | an agent with service permissions performs an action the user is not allowed to | delegated user permissions, authorization check in the tool |

### Extending with AI lists

STRIDE is generic; OWASP and ATLAS give concrete AI threats you would otherwise miss. A practical approach: for each element of the diagram, go through the relevant items.

| DFD element | OWASP LLM / Agentic | ATLAS (examples) |
|---|---|---|
| User input | LLM01, LLM10 | AML.T0051.000, AML.T0054, AML.T0034 |
| Ingest and retrieval | LLM01 (indirect), LLM08, LLM02 | AML.T0051.001, AML.T0070 |
| Model output | LLM05, LLM09, LLM07 | AML.T0077 LLM Response Rendering, AML.T0056 |
| Tools and agent identity | LLM06, ASI02, ASI03, ASI05 | AML.T0053, AML.T0086 |
| Agent memory | ASI06 | AML.T0080 AI Agent Context Poisoning |
| Multiple agents | ASI07, ASI08, ASI10 | — (check the current ATLAS version) |
| Pipeline and registry | LLM03, LLM04, ASI04 | AML.T0010, AML.T0020 |
| Inference API | LLM10, LLM02 | AML.T0024, AML.T0040 |

### Abuse cases instead of payloads

Record threats as an **abuse case**: who, across which boundary, under what condition, with what consequence. You don't need the actual attack text for a threat model to be useful.

```yaml
# Defensive example: a threat entry in the model
id: T-07
title: Instructions from an incoming email influence an agent that has a messaging tool
actor: external sender without an account
boundary: C (third-party content) → D (actions)
precondition: the agent reads the mailbox and has a send_email tool without confirmation
consequence: internal data sent to an external address
mapping: { owasp: [LLM01, LLM06, ASI01, ASI02], atlas: [AML.T0051.001, AML.T0086] }
likelihood: high
impact: high
controls: [C-03 user confirmation for sending outside the domain, C-05 recipient allowlist, C-09 alert on unusual tool calls]
status: open
```

### Privacy: not just "information disclosure"

STRIDE treats leakage as a single letter. When personal data is in the context, logs or training data, it also helps to go through questions from a privacy framework such as **LINDDUN** (linking, identifying, non-compliance with purpose, lack of transparency…):

- Are conversations used for training or evaluation, and have users been informed?
- How long do the model vendor and our log platform retain prompts?
- Can one infer from the model's answers that a specific person is in the dataset?
- Does the agent combine data from several systems in a way the individual systems don't allow?

The answers often lead to controls that aren't technical (a contract with the vendor, a notice to users), but they must be in the same register.

## Heuristics for agents

For agents there are two short heuristics that quickly reveal dangerous combinations of capabilities. They aren't standards, but they are useful in a design review.

### Lethal trifecta

Simon Willison (2025) warns about the combination of three capabilities in the same agent:

1. access to **private data**;
2. exposure to **untrusted content**;
3. the ability to **communicate externally** (sending messages, HTTP requests, even rendering an image from an external URL).

When all three are present, indirect prompt injection can lead to data exfiltration. Defense: remove at least one leg of the tripod for a given flow (e.g., no outbound channels while untrusted content is in the context).

### Agents Rule of Two

Meta (2025) proposed a rule that an agent in a single session should have no more than two of three properties:

- **[A]** it processes untrusted input;
- **[B]** it has access to sensitive systems or private data;
- **[C]** it can change state or communicate externally.

If a task requires all three, the agent should not operate autonomously: it needs additional oversight (most often human confirmation or another reliable validation), separation into distinct components, or a new session with a clean context. The rule assumes that some injection will get through, so it limits what a compromised agent can do.

```text
 Agent summarizing public news           A + C         (no private data)                → acceptable
 Internal assistant over the HR database B + C         (employees only, no external content) → acceptable
 Assistant that reads and sends email    A + B + C     → split it up or require confirmation for every action
```

> **In practice:** the heuristics are most useful early, when the agent's scope is being chosen. Later it is hard to remove a capability the product has already promised to users. Put them into the design review template as a mandatory question.

### Frameworks aimed at agents

Specialized frameworks for threat modeling agentic systems are also emerging, e.g., **MAESTRO**, published by the Cloud Security Alliance (it breaks an agentic system into layers and looks for threats per layer and between layers), and the OWASP GenAI Security Project's material on agent threats. Use them as a supplement, and state in your report which version you used.

## Threats by system type

The same procedure yields different priorities depending on what you are building. A starting point for a workshop:

| System type | Most important boundaries | Priority threats | First controls |
|---|---|---|---|
| Chatbot without tools or RAG | A, B | jailbreak, prompt leakage, unsafe output, cost | output handling, limits, no secrets in the prompt |
| RAG over internal documents | A, B, C | unauthorized document access, indirect injection, corpus poisoning | per-document ACL, ingest control, content marking |
| Agent with tools | A–D | goal hijack, tool misuse, privilege escalation, data exfiltration | allowlist, delegated permissions, confirmation, Rule of Two |
| Multiple agents | A–D + inter-agent flows | forged messages, cascading failures, rogue agent | message authentication, isolation, kill switch |
| Own model (training, serving) | C, E + API | data poisoning, malicious artifacts, extraction, membership inference | data provenance, safe formats, signatures, quotas |

### A DFD for the ML pipeline

If you train or fine-tune a model, you draw the pipeline too, not just the application:

```text
 [Data sources] ──► [Collection / labeling] ──► [Dataset (versioned)]
        ▲ boundary C                                             │
                                                                 ▼
 [Public hub: base model] ──boundary E──► [Training / fine-tuning on a CI runner] ──► [Model registry]
                                                   │                                    │ signature, AI-BOM
                                         secrets, GPU quotas                            ▼
                                                                                  [Serving / API]
```

Typical threats: who can change the dataset and whether that is visible (T), whether the runner has access to production secrets (E), whether serving loads only signed artifacts (T), whether the base model is in a safe format (T, E). Details are in modules 07–09.

## How to run a workshop

- **Participants:** the product owner, the orchestrator developer, someone who knows the data (RAG/training), SecOps, and when needed a lawyer or DPO if personal data is involved.
- **Duration:** 60–90 minutes per flow; split a larger system by flows, not by teams.
- **Input:** the existing diagram (even a sketch), a list of tools with their scope, a list of data sources.
- **Output:** an updated diagram, a list of threats as abuse cases, decisions (mitigate/accept/avoid/transfer) with owners, review triggers.
- **Format:** keep the threat model as code (YAML or Markdown in the repo), next to the system it describes, so it goes through review like any other change.

## Question 3: what are we going to do

### Assessment and priority

For each threat, assess likelihood and impact, as for other systems. With AI systems pay attention to two things:

- **The likelihood of indirect prompt injection is high as soon as boundary C exists.** Don't wait for proof of exploitation; treat it as an assumption.
- **Boundary D determines impact.** The same model with a read-only tool and with a payment tool carries completely different risk.

| Threat | Likelihood | Impact | Decision |
|---|---|---|---|
| Indirect injection → email sent outside | high | high | mitigate: confirmation + recipient allowlist |
| System prompt leakage | high | low (no secrets) | accept, document |
| Other people's documents in a RAG answer | medium | high | mitigate: ACLs in retrieval |
| Denial of wallet via a public API | medium | medium | mitigate: quotas and alerts |
| Malicious model from a public hub | low (approved sources only) | high | mitigate: safetensors, signatures |

### Types of controls

Choose controls so that they don't all depend on the model's behavior:

- **Architectural** (strongest): privilege separation, removing tools, per-tenant isolation, sandboxing.
- **Deterministic checks in code**: authorization in the tool, output schema validation, allowlists.
- **Probabilistic**: input and output classifiers, guardrail models. Useful, but always on top of the previous ones.
- **Detective**: telemetry, alerts, review.
- **Procedural**: human confirmation, review of prompt and tool changes, training.

> **In practice:** if the only control for a high-impact threat is a sentence in the system prompt ("never send data outside"), the threat is effectively uncontrolled. Mark it as open in the register.

### From model to backlog

```yaml
# Defensive example: a control from the threat model as a backlog item
id: C-03
title: User confirmation before sending email to an address outside the domain
addresses: [T-07]
type: architectural+procedural
acceptance:
  - the send_email tool rejects a call without a signed confirmation token
  - the token is issued only after the recipient and content are shown to the user
  - an attempt without a token is logged with the ATLAS label AML.T0086
owner: tim-asistent
due: 2026-11-30
```

## Question 4: did we do a good job

- **Implementation check:** every control has an acceptance criterion and a test (a unit test for the allowlist, an integration test for retrieval ACLs).
- **Evaluation and red teaming** (module 10): scenarios are chosen based on threats from the model, and findings are fed back into the model.
- **Triggers for re-modeling:**
  - a new tool or an expanded scope for an existing one;
  - a new data source in RAG or memory;
  - a change of model or vendor;
  - moving from one agent to several;
  - a new tenant or a new class of data in the context;
  - an incident or a new item in the OWASP/ATLAS lists.

```yaml
# Defensive example: a CI check that requires an updated threat model when tools change
threat-model-gate:
  stage: test
  rules:
    - changes: ["agent/tools/**", "rag/sources.yaml", "config/model.yaml"]
  script:
    - test "$(git log -1 --format=%ct -- threat-model.yaml)" -ge "$(git log -1 --format=%ct -- agent/tools rag/sources.yaml config/model.yaml)"
```

## End-to-end example: a helpdesk assistant

System: a support assistant reads tickets, searches the internal knowledge base (RAG) and can add a comment to a ticket. A tool for emailing the customer is also planned.

1. **Diagram:** boundaries A (support agent → application), B (output → ticket UI), C (ticket text written by the customer, documents in the knowledge base), D (comment, email), E (the vendor's model via API).
2. **Assets:** customers' personal data in tickets, internal documents, the credential for the ticketing system, budget.
3. **Threats (selection):**
   - ticket text (C) influences the answer or action (LLM01, ASI01);
   - output rendered as HTML in the ticket UI (LLM05);
   - an internal document available only to management ends up in an answer to a first-line agent (LLM02, LLM08);
   - the email tool sends content to an address suggested by the ticket text (ASI02, lethal trifecta).
4. **Decisions:**
   - output as sanitized Markdown, no raw HTML and no loading of external images;
   - retrieval filters by the roles of the user who started the query, not by the service's roles;
   - email only to the customer address from the ticketing system (not from the text), with review by the support agent;
   - telemetry with a correlation ID for every ticket.
5. **Verification:** tests for the ACLs and for rejecting an address not on record, red team scenarios based on the T items in the model.

> **In practice:** the most valuable result of this example is not the list of threats but the decision that the email tool does not accept an address from the model. A single design change removed an entire class of risk, without a single filter.

## Common mistakes

- **Modeling only the model.** The model is one box; the threats are in the flows around it.
- **Model output marked as trusted** because it is "ours." The trust label propagates through the model.
- **Recording a threat as a concrete attack** instead of as an abuse case. Attacks change; conditions and consequences remain.
- **A one-off document.** Agents and RAG change quickly; without triggers the model goes stale within weeks.
- **Controls that all depend on the model** (prompt instructions, a guardrail model) for high-impact threats.

## Summary

- The four questions (what are we working on, what can go wrong, what are we going to do, did we do a good job) apply to AI as well.
- A DFD for AI has extra boundaries: model output, untrusted content in the context, tool actions, the supply chain. Trust propagates through the model: the output is as trusted as the least trusted input.
- Assets include weights, prompt and configuration, training data, the RAG corpus, tool credentials, conversations, budget and user trust.
- STRIDE provides the structure, while the OWASP LLM/Agentic Top 10 and ATLAS provide concrete AI threats. Threats are recorded as abuse cases, without payloads.
- For agents use the heuristics **lethal trifecta** (private data + untrusted content + an outbound channel) and **Agents Rule of Two** (at most two of A/B/C without additional oversight).
- Architectural and deterministic controls take priority; probabilistic ones are an extra layer. Boundary D (actions) determines impact the most.
- A threat model is maintained: controls have acceptance criteria and tests, and new tools, data sources, models and incidents are review triggers.
