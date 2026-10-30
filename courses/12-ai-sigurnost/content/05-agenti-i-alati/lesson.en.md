## What this module covers

Domain 2, security of LLM applications and agents:

- **2.3** Agents and tools: **Excessive Agency**, least privilege, **human-in-the-loop**, **Model Context Protocol (MCP)** security.
- **2.4** **Unbounded Consumption** and abuse controls: limits, budgets, circuit breakers.

After this module you should be able to:

- explain why an agent is a **permissions** problem, not just a prompt problem,
- design a layer between the model and the tools that enforces an allowlist, argument validation and human approval,
- recognize the risks from the OWASP Top 10 for Agentic Applications (ASI01–ASI10) and map them to controls,
- apply the security recommendations of the MCP specification (token passthrough, confused deputy, SSRF, local servers, scope),
- set consumption limits at the level of the request, the user, the agent session and the organization.

## From chatbot to agent

A chatbot returns text. An **agent** returns text and **calls tools**: it reads email, writes to a database, runs code, opens tickets. The model, in a loop, picks the next step based on the goal and on what it has read. This changes the threat model: the consequence is no longer "the model wrote something wrong" but "the model **did** something wrong, with your permissions."

```text
 user ──►     ┌──────────────────────── AGENT ────────────────────────┐
              │  orchestrator (loop: plan → call → read)               │
              │        │                         ▲                     │
              │        ▼                         │ tool result          │
              │   ┌─────────┐   proposed     ┌───┴──────────────┐       │
              │   │  LLM    │ ─ tool ──────► │ POLICY GATEWAY   │       │
              │   └─────────┘   calls        │ allowlist        │       │
              │        ▲                     │ arg validation   │       │
              │        │ untrusted           │ human approval   │       │
              │        │ content             │ budget, log      │       │
              └────────┼─────────────────────┴───┬──────────────┘───────┘
                       │                         ▼
               email, web, RAG,         tools: CRM API, SQL (read-only),
               tool results             code sandbox, MCP servers
```

The key idea is the trust boundary between a **proposal** and its **execution**. The model proposes a tool call; deterministic code (the policy gateway) decides whether it runs. Everything the model reads (an email, a web page, a RAG document, another tool's result) is **untrusted input** and may contain instructions (indirect prompt injection, ATLAS **AML.T0051.001**). We can't guarantee the model won't follow them, so we limit the damage through permissions.

> **In practice:** the question for every agent design is "what is the worst this agent can do if the model fully obeys the attacker?" If the answer is unacceptable, the fix is not a better system prompt but fewer tools, narrower permissions or human approval.

## Excessive Agency (OWASP LLM06:2025)

The OWASP Top 10 for LLM Applications 2025 lists **LLM06:2025 Excessive Agency** and breaks it down into three root causes:

| Root cause | Example | Control | Where in the architecture |
|---|---|---|---|
| **Excessive functionality** | An agent for reading email also has tools for sending and deleting | Provide only the tools needed for the task; remove development and test tools | Per-agent tool registry |
| **Excessive permissions** | A calendar-reading tool uses a service account with access to all calendars | The tool runs in the user's context, with the narrowest scope | IAM, OAuth scope, DB role |
| **Excessive autonomy** | An agent executes payments and deletions without confirmation | Human approval for high-impact actions | Policy gateway, approval UI |

OWASP also recommends: avoid "open-ended" tools (a generic `shell`, `http_request` to any URL, `sql` with a free-form query) and instead build **narrow tools** (`get_invoice(id)`, `create_ticket(title, body)`); enforce authorization in the **downstream system** (complete mediation), not in the prompt; log and monitor tool calls.

### A narrow tool instead of an open one

| Open tool | Narrow tool | What you gain |
|---|---|---|
| `run_sql(query)` | `get_order(order_id)` with a parameterized query | No arbitrary SQL, no reading other tables |
| `http_get(url)` | `fetch_docs(page)` only for `docs.firma.rs` | No SSRF to the metadata service or internal network |
| `shell(cmd)` | `run_tests(repo)` in an ephemeral sandbox | No arbitrary commands on the host |
| `send_email(to, body)` | `reply_to_ticket(ticket_id, body)` | The recipient is determined by data, not by the model |

The last row is an important pattern: **parameters that determine the damage (recipient, amount, path, account) are not chosen by the model**; the code derives them from context (the ticket, the logged-in user).

## OWASP Top 10 for Agentic Applications

In December 2025 the OWASP GenAI Security Project published the **OWASP Top 10 for Agentic Applications (2026)**. The list doesn't replace the LLM Top 10 but complements it with risks that arise when the model acts autonomously:

| Label | Risk | Main control |
|---|---|---|
| **ASI01** | Agent Goal Hijack: the agent's goal is redirected through content it reads | Untrusted content separated from instructions, limited permissions, approval for actions |
| **ASI02** | Tool Misuse and Exploitation: a legitimate tool used harmfully | Narrow tools, argument validation, per-tool limits |
| **ASI03** | Identity and Privilege Abuse | Per-agent and per-user identity, short-lived tokens, no shared service accounts |
| **ASI04** | Agentic Supply Chain Vulnerabilities | Allowlisting and pinning of MCP servers, tools and prompts |
| **ASI05** | Unexpected Code Execution | Sandbox without network, ephemeral environment, no secrets |
| **ASI06** | Memory and Context Poisoning | Checks before writing to memory, entry provenance, expiry |
| **ASI07** | Insecure Inter-Agent Communication | Authenticated and signed messages, mTLS, message schema |
| **ASI08** | Cascading Failures | Circuit breakers, limits, agent isolation |
| **ASI09** | Human-Agent Trust Exploitation | Approval shows the actual action, not the model's summary |
| **ASI10** | Rogue Agents | Behavior monitoring, agent inventory, kill switch |

In MITRE ATLAS the corresponding mitigations are grouped into agent mitigations: **AML.M0026** Privileged AI Agent Permissions Configuration, **AML.M0027** Single-User AI Agent Permissions Configuration, **AML.M0028** AI Agent Tools Permissions Configuration, **AML.M0029** Human In-the-Loop for AI Agent Actions, **AML.M0030** Restrict AI Agent Tool Invocation on Untrusted Data, **AML.M0032** Segmentation of AI Agent Components and **AML.M0033** Input and Output Validation for AI Agent Components. The technique **AML.T0053 AI Agent Tool Invocation** describes misuse of tool calls, and **AML.T0086** data exfiltration through an agent tool.

## Least privilege for tools

### Whose identity the tool uses

| Identity model | Advantage | Risk |
|---|---|---|
| Shared service account | Simple | One user's agent sees everyone's data; the audit trail doesn't know who asked |
| **Delegated user token** (OAuth, on-behalf-of) | The agent can't do more than the user; the audit trail is accurate | Requires token exchange and narrow scopes |
| Separate agent identity + user in context | The agent has its own, narrower policy | You must enforce the intersection of agent and user rights |

Recommendation: **effective right = intersection** of the user's rights and the rights granted to the agent. A support agent working for Ana must not see anything Ana isn't allowed to see, but not everything Ana is allowed to see either (e.g., the HR portal).

### Policy gateway: allowlist and argument validation

The gateway is ordinary code that checks every model proposal before execution. The policy is declarative, version-controlled and reviewed:

```yaml
# tool-policy.yaml - policy for the "podrska" (support) agent
agent: podrska
default: deny
tools:
  get_order:
    risk: low
    schema: schemas/get_order.json
    rate_limit: { per_minute: 30 }
  reply_to_ticket:
    risk: medium
    schema: schemas/reply_to_ticket.json
    max_body_chars: 4000
  issue_refund:
    risk: high
    schema: schemas/issue_refund.json
    require_approval: true      # a human approves every call
    max_amount_eur: 200
```

```python
import json, jsonschema, yaml

POLICY = yaml.safe_load(open("tool-policy.yaml"))

class Denied(Exception): ...

def authorize(tool: str, raw_args: str, user, session) -> dict:
    spec = POLICY["tools"].get(tool)
    if spec is None:                                  # default: deny
        raise Denied(f"tool {tool} is not on the allowlist")
    args = json.loads(raw_args)                       # the model provides JSON, not code
    schema = json.load(open(spec["schema"]))
    jsonschema.validate(args, schema)                 # additionalProperties: false
    if tool == "issue_refund" and args["amount_eur"] > spec["max_amount_eur"]:
        raise Denied("amount above the limit")
    if not user.can_access_order(args["order_id"]):   # authorization in code
        raise Denied("user has no access to the order")
    session.charge_tool_call(tool)                    # call budget (2.4)
    return {"args": args, "needs_approval": spec.get("require_approval", False)}
```

The schema should be strict: `additionalProperties: false`, types, `maxLength`, `pattern` for IDs, `enum` where possible. Validation is not a substitute for authorization: the schema says `order_id` has the right shape, and only `can_access_order` says this user may see it.

> **In practice:** log denied calls as a security signal. An agent that suddenly proposes tools that aren't on the list, or repeats a denied call with variations of the arguments, has often read content with injected instructions. That is a good trigger for an alert and for terminating the session.

### Secrets and network

- The model never sees credentials. The gateway adds the token at execution time; there are no API keys in the prompt or the logs.
- Tools that access the network go through an **egress proxy** with a domain allowlist; `169.254.169.254`, private ranges and `localhost` are blocked.
- A tool's result is truncated and marked as untrusted before it is returned to the model.

## Human-in-the-loop

Human approval is the strongest control against excessive autonomy, but only if it is done well.

| Bad | Good |
|---|---|
| "The agent wants to continue. Approve?" | The exact action is shown: tool, arguments, recipient, amount |
| A summary written by the model | Data derived from the actual call, not from the model's text |
| Approval for every call, including reads | Approval only for high-impact actions (writing, sending, paying, deleting) |
| Approval valid for the whole session | Approval bound to a specific call (hash of the arguments), single-use, with an expiry |
| The same user whose agent was compromised approves critical actions | A second pair of eyes for critical actions (four-eyes principle) |

Too many approvals lead to **approval fatigue**: people click "yes" without reading, which is exactly ASI09. That is why actions are classified by risk, and low-risk ones (reads within the user's rights) go through automatically with logging.

```python
import hashlib, json, time

def approval_request(tool, args, user):
    payload = json.dumps({"tool": tool, "args": args}, sort_keys=True)
    return {
        "id": hashlib.sha256(payload.encode()).hexdigest(),  # bound to the exact arguments
        "display": payload,                                  # shown verbatim
        "requested_by": user.id,
        "expires_at": time.time() + 600,
    }
# Execution: the gateway recomputes the hash of the arguments and executes only if there is
# an unused, unexpired approval with the same hash.
```

## Executing agent-generated code (ASI05)

Data analysis and coding agents execute code written by the model. Treat it as code from an unknown author:

| Risk | Control |
|---|---|
| Access to host files | Ephemeral container or micro-VM, read-only root, only a working directory |
| Exfiltration | No network (`--network none`) or egress only to an allowlist |
| Secret theft | No secrets in the environment; no mounted Docker socket or cloud credentials |
| Resource exhaustion | Limits on CPU, memory, processes and execution time |
| Persistence | The environment is destroyed after the task |

This is the same principle as container isolation from the CKS course: non-root, no privileges, seccomp, no extra capabilities.

## Memory and multiple agents (ASI06, ASI07)

An agent's long-term memory (notes, summaries of previous conversations, a vector store) is a **persistent poisoning surface**: content that got in once can influence future sessions. ATLAS describes this as **AML.T0080 AI Agent Context Poisoning** (sub-techniques Memory and Thread).

- Writing to memory is an action the gateway controls, not a free decision of the model.
- Every entry carries provenance (user, source, time) and a trust level; content from untrusted sources is not written as "fact."
- Memory is separated per user and tenant; entries expire and can be reviewed and deleted.

With multiple agents (planner, executors, reviewer), every message between agents is input like any other: service authentication (mTLS, signed tokens), a message schema and an authorization check on the receiving side. An agent further down the chain must not inherit all the rights of the agent above it.

## Model Context Protocol (MCP)

**MCP** is an open protocol through which a **host** (e.g., an IDE or chat application), via an **MCP client**, connects the model to **MCP servers** that expose **tools** (actions), **resources** (data) and **prompts** (templates). The transport is `stdio` for local servers or **Streamable HTTP** for remote ones. For remote servers the specification defines authorization based on OAuth 2.1: the MCP server is a resource server, it publishes Protected Resource Metadata (RFC 9728), and the client requests a token for exactly that resource (resource indicators, RFC 8707).

```text
 ┌──────────── host (IDE / chat) ─────────────┐
 │  LLM ◄──► MCP client A ─── stdio ─────────────► local MCP server (files)
 │           MCP client B ─── HTTPS + OAuth ─────► remote MCP server ──► SaaS API
 │           MCP client C ─── HTTPS + OAuth ─────► internal MCP server ──► database
 └────────────────────────────────────────────┘
   trust boundaries: host ↔ each server ↔ each downstream API
```

The **Security Best Practices** document in the MCP specification lists attacks and mandatory controls. The most important ones for an engineer introducing MCP in an organization:

| Risk from the MCP recommendations | What the problem is | Control |
|---|---|---|
| **Token passthrough** | A server accepts a token that wasn't issued to it and forwards it | The server **MUST NOT** accept a token not issued for it; check `aud`; a separate token for the downstream API |
| **Confused deputy** | An MCP proxy with a static client ID at a third party skips user consent | Per-client consent before forwarding, exact `redirect_uri` check, single-use `state` |
| **SSRF** | A malicious server tricks the client into fetching internal URLs during OAuth discovery | HTTPS, blocking private and link-local ranges, egress proxy, redirect checks |
| **Session / handle hijacking** | A guessed or stolen state identifier | A random handle bound to the authenticated user; a handle is not authentication |
| **Compromised local server** | The configuration launches an arbitrary command with the user's rights | Show the full command and require explicit consent; sandbox; `stdio` instead of an open HTTP port |
| **Scope minimization** | A token with broad scopes (`*`, `admin`) | Minimal initial scope, gradual elevation (step-up), no omnibus scopes |

Beyond these points from the specification, the security community warns about MCP supply chain risks (ASI04, ATLAS **AML.T0010.005** AI Agent Tool): the tool description comes from the server and the model reads it, so the description is untrusted content too; a server can change after approval. The controls are organizational and technical:

- a **registry of approved MCP servers** (an internal catalog), with others blocked at the host or proxy level,
- pinning the server version and a **hash of the tool descriptions**; a change in the description requires a new review,
- **tool annotations** (`readOnlyHint`, `destructiveHint`…) are hints; the specification says clients should treat them as untrusted unless the server is trusted,
- one server, one purpose, its own narrow token; no "do-everything" servers.

```yaml
# mcp-allowlist.yaml - central policy for MCP clients in the organization
servers:
  - name: docs-search
    transport: streamable-http
    url: https://mcp.interno.firma.rs/docs
    version: "1.4.2"
    tools_sha256: "3f1c…"        # hash of the canonical JSON of the tool list at review time
    scopes: ["docs:read"]
  - name: local-files
    transport: stdio
    command: ["/opt/mcp/files-server", "--root", "/workspace"]
    sandbox: { network: none, read_only: true }
policy:
  unknown_servers: deny
  on_tools_change: block_and_alert
```

> **In practice:** developers add MCP servers to their IDE themselves, the way they used to add browser extensions. Build an inventory (which servers, who uses them, with which tokens) before you introduce bans. Without an inventory you don't know what you're blocking, and with one you quickly see which servers have access to production systems.

## Unbounded Consumption (OWASP LLM10:2025)

**LLM10:2025 Unbounded Consumption** covers situations in which an application allows excessive and uncontrolled inference. There are three kinds of consequences:

- **denial of service**: models are expensive per request, so a small number of heavy requests can choke the service (ATLAS **AML.T0029** Denial of AI Service),
- **Denial of Wallet**: the bill for tokens or GPU grows without control (ATLAS **AML.T0034** Cost Harvesting, with sub-techniques for excessive queries, resource-intensive queries and agent consumption),
- **API abuse for model copying**: a large number of systematic queries can be used to train a substitute model; more in the module on model theft (4.3).

With agents the problem is more pronounced: one user message can trigger dozens of model and tool calls, and a loop that never ends keeps spending indefinitely.

### Controls by layer

| Layer | Control | Example value |
|---|---|---|
| Request | Maximum input length, output `max_tokens`, timeout | 8k input tokens, 1k output, 30 s |
| User / API key | Rate limit and daily token quota | 20 requests/min, 200k tokens/day |
| Agent session | Maximum number of steps, tool calls and total budget | 15 steps, 30 calls, €0.50 |
| Tool | Per-tool limit, pagination, maximum result size | 100 rows, 50 KB |
| Organization | Per-application budget, alerts and a hard limit at the provider | alert at 80%, stop at 100% |
| Infrastructure | Queueing, autoscaling with an upper bound, priorities | max replicas, rejection with 429 |

```python
class BudgetExceeded(Exception): ...

class AgentBudget:
    def __init__(self, max_steps=15, max_tool_calls=30, max_cost_eur=0.50, max_seconds=120):
        self.limits = dict(steps=max_steps, tools=max_tool_calls, cost=max_cost_eur, secs=max_seconds)
        self.used = dict(steps=0, tools=0, cost=0.0, secs=0.0)

    def charge(self, kind: str, amount=1):
        self.used[kind] += amount
        if self.used[kind] > self.limits[kind]:
            raise BudgetExceeded(f"{kind}: {self.used[kind]} > {self.limits[kind]}")

# The orchestrator calls budget.charge("steps") before every step, "tools" before
# every tool and "cost" after every model response (tokens × price).
# BudgetExceeded ends the session with a message to the user and an event in the log.
```

### Abuse detection

- per-user and per-key metrics: tokens, cost, number of agent steps, rate of denied tool calls,
- alerts on deviations from normal (e.g., 10× the average daily consumption),
- detection of repeating loops (the same tool with the same arguments several times in a row),
- patterns of systematic harvesting (a large number of varied queries from a single key, an even rhythm) as a signal of possible model copying,
- a **circuit breaker** that temporarily disables a tool or agent when the error rate or consumption crosses a threshold (ASI08).

> **In practice:** set a hard budget at the model provider too, not just in your application. A bug in the orchestrator can bypass your limit, but not the limit on the account. Also, `max_tokens` without a limit on the number of steps doesn't protect an agent: each step is small, but there are a thousand of them.

### Graceful degradation

When a limit is reached, the system should refuse predictably: HTTP 429 with `Retry-After`, a message to the user, falling back to a smaller model or a cached answer for common questions. Never "continue without limits because the user is important"; exceptions go through configuration with an owner and an expiry date.

## Logging agent actions

To investigate an incident you need to reconstruct the chain: what the user asked for, what the model read, what it proposed, what the gateway decided and what was executed.

| Field | Why |
|---|---|
| `session_id`, `user_id`, `agent_id` | Who, and on whose behalf |
| sources the model read (document ID, URL, hash) | Origin of a possibly injected instruction |
| proposed tool and arguments | What the model wanted |
| gateway decision (allow/deny/approval) and reason | What the control did |
| who approved and when | Accountability for high-impact actions |
| result and cost | Consequence and consumption |

Logs may contain personal data, so the same retention and access rules apply as for other logs (more in module 10).

## Summary

- An agent turns a model error into an **action**; you limit the damage with permissions, not with the prompt.
- **LLM06 Excessive Agency** has three root causes: too much functionality, too many permissions, too much autonomy. Controls: narrow tools, a delegated identity with an intersection of rights, human approval for high-impact actions.
- A **policy gateway** between the model and the tools: `default: deny`, a strict JSON Schema, authorization in code, limits and logging. Parameters that determine damage are derived by code, not by the model.
- Human approval shows the exact action, is bound to a hash of the arguments and is reserved for risky actions, to avoid approval fatigue.
- The **OWASP Top 10 for Agentic Applications (2026)** complements the LLM Top 10: goal hijack, tool misuse, identity, supply chain, code execution, memory poisoning, agent communication, cascading failures, human trust, rogue agents.
- **MCP**: no token passthrough, audience checks, per-client consent, SSRF protection, sandboxing and consent for local servers, minimal scopes, a registry of approved servers and pinned tool descriptions.
- **LLM10 Unbounded Consumption**: limits at the request, user, agent session, tool and organization level; a hard budget at the provider; loop and anomaly detection; graceful degradation.
