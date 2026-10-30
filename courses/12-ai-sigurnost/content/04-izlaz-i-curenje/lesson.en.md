## What this module covers

This module covers objective **2.2 Improper output handling, sensitive information disclosure and system prompt leakage**, i.e., three items of the OWASP Top 10 for LLM Applications 2025:

- **LLM05:2025 Improper Output Handling**
- **LLM02:2025 Sensitive Information Disclosure**
- **LLM07:2025 System Prompt Leakage**

After this module you should be able to:

- treat model output as untrusted input and apply contextual encoding for every destination (browser, SQL, shell, file system, URL);
- require **structured output** and validate it with a **JSON Schema** before use;
- render a response safely (no raw HTML, control over images and links, CSP);
- list all the sources from which sensitive data can reach a response and place controls in the right spot;
- design the system prompt on the assumption that it will leak.

In this course's lab you validate a model's structured output with a JSON Schema and render it safely.

## Model output is untrusted input

In module 02 we saw that trust propagates through the model: if anything untrusted was in the context (user input, a document, a web page), the output carries that influence. Even without an attack, the model can generate incorrect or dangerous output by mistake. That is why you treat model output **the same as input from the internet**.

**Improper Output Handling** occurs when model output is passed to another component without validation, sanitization and encoding. The consequences are classic web and system vulnerabilities, just with a new source:

| Output destination | Risk | Control | Where in the architecture |
|---|---|---|---|
| Browser (HTML/Markdown) | XSS, data exfiltration through images and links (ATLAS **AML.T0077 LLM Response Rendering**) | escaping, allowlist-based sanitization, CSP, domain allowlist for images | frontend, renderer |
| SQL database | SQL injection, unauthorized reads or changes | parameterized queries, read-only role, allowlist of queries or tables | data access layer |
| Shell / OS | command execution | don't pass to a shell; fixed commands with validated arguments; sandbox | agent tools |
| File system | path traversal, overwriting files | path canonicalization, restricted directory, extension allowlist | agent tools |
| HTTP requests | SSRF, data exfiltration | host allowlist, ban on private ranges | agent tools |
| Interpreter (`eval`, `exec`) | arbitrary code execution (OWASP **ASI05**) | never directly; isolated sandbox without network or secrets | runtime |
| Email, messages | phishing in the organization's name, leakage | template, restricted content, review | integrations |
| Another agent or system | passing the manipulation further (ASI07, ASI08) | message schema, authentication | inter-agent layer |

The principle is the same as in classic AppSec: **validate on entry to the component, encode for the context in which the data is used.** The only new thing is that the "input" comes from the model, so teams often wrongly consider it internal.

> **In practice:** in code review, look for every place where the model's answer is used as a string in another language: an f-string in SQL, `subprocess` with `shell=True`, `innerHTML`, `dangerouslySetInnerHTML`, `os.path.join` with a file name from the answer. These are the same rules as for user input; you just grep for the variable that carries the model output.

## Structured output and schema validation

Free text is hard to validate. Wherever the application uses model output programmatically (not just displays it), require **structured output** (JSON) and validate it with a schema. Many vendor APIs offer a structured output mode or schema-constrained decoding; that reduces the number of malformed responses, but **does not replace validation in your code**: validation is your control, not the vendor's.

### A good schema is restrictive

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["category", "priority", "summary"],
  "properties": {
    "category": { "enum": ["billing", "technical", "account", "other"] },
    "priority": { "type": "integer", "minimum": 1, "maximum": 4 },
    "summary":  { "type": "string", "maxLength": 500 },
    "ticket_id": { "type": "string", "pattern": "^TCK-[0-9]{6}$" }
  }
}
```

What makes a schema a security control rather than just a format:

- `additionalProperties: false`: the model can't "add" a field that some later code happens to use;
- `enum` for everything with a finite set of values: categories, actions, statuses;
- `minimum`/`maximum` for numbers (amounts, priorities, quantities);
- `maxLength` for strings, so the text doesn't flood the UI, the log or the next prompt;
- `pattern` for identifiers, so an ID can't be a path, a URL or an SQL fragment.

### Validation in code

```python
# Defensive example: validating model output with a JSON Schema (jsonschema)
import json
from jsonschema import Draft202012Validator

SCHEMA = json.load(open("ticket_triage.schema.json"))
VALIDATOR = Draft202012Validator(SCHEMA)

class InvalidModelOutput(Exception):
    pass

def parse_model_output(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise InvalidModelOutput(f"not JSON: {e.msg}")
    errors = sorted(VALIDATOR.iter_errors(data), key=lambda e: list(e.path))
    if errors:
        # log the path and message, not the whole output (it may contain personal data)
        raise InvalidModelOutput("; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5]))
    return data
```

What to do when validation fails:

- **reject** it and return a safe default response (e.g., "category: other, manual handling");
- possibly retry the request **once** with the error message, with a limit on attempts (link to LLM10);
- **log** the validation error as a signal: a sudden rise in invalid outputs can mean a manipulation attempt or a change in model behavior;
- never "fix" the output with a heuristic that lets unknown fields through.

> **In practice:** the schema is a contract between the model and the rest of the system, so it belongs in the repo, with a version and tests. When someone changes the prompt and adds a new field, the schema test should fail before production, not after the frontend starts showing unexpected content.

### Validation isn't enough for semantics

A schema checks shape, not truth. A `ticket_id` that matches the pattern still has to exist and belong to the user. That is why **business validation** follows the schema: does the resource exist, is this user allowed to access it, is the amount within the allowed range for this role.

## Safe rendering

Most chat interfaces render Markdown. Markdown can contain raw HTML, links and images, and each of them is a risk.

### Risks in the renderer

- **Raw HTML** in the response → XSS if the renderer lets HTML through.
- **Images from an external URL** → the browser sends a request automatically; the URL can carry data from the context (an implicit outbound channel, without a single click).
- **Links** → phishing in the application's name, `javascript:` schemes, links that also carry data.
- **Automatic link previews** (unfurl) in chat integrations → a request without a click.

### Controls

```python
# Defensive example: safe display of model text (standard library only)
import html, re
from urllib.parse import urlparse

ALLOWED_LINK_HOSTS = {"docs.interno.example", "status.example.com"}
LINK = re.compile(r"\[([^\]]{1,200})\]\((https://[^\s)]{1,500})\)")

def render_safe(text: str) -> str:
    escaped = html.escape(text)                 # no HTML from the model stays active
    def link(m):
        label, url = m.group(1), html.unescape(m.group(2))
        host = urlparse(url).hostname or ""
        if host in ALLOWED_LINK_HOSTS:
            return f'<a href="{html.escape(url, quote=True)}" rel="noopener noreferrer nofollow">{label}</a>'
        return f"{label} ({html.escape(host)})"  # show the domain, don't make a link
    out = LINK.sub(link, escaped)
    return out.replace("\n", "<br>")            # images are not rendered at all
```

Alongside the renderer code:

- **Content Security Policy** as a second layer: `img-src` only your own domain and an approved CDN, no `unsafe-inline` scripts;
- in Markdown libraries disable raw HTML and use a sanitizer with an allowlist of tags and attributes;
- for images: either don't render them, or only with a domain allowlist, or proxy them through your own service that doesn't forward parameters;
- disable link previews for messages generated by the model.

```text
# Defensive example: CSP header for a chat UI
Content-Security-Policy: default-src 'self'; img-src 'self' https://cdn.interno.example;
  script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

## Output that triggers actions

When model output becomes a query or a command, the rules are stricter:

- **SQL:** the model doesn't write free-form SQL that runs with full permissions. Better: the model picks one of the predefined queries and fills in parameters that are validated by a schema; the query runs parameterized, with a read-only role and per-user row-level security.
- **Shell:** never `shell=True` with model output. A fixed command as a list of arguments, with arguments from an allowlist or validated by a schema.
- **Generated code:** execution only in an isolated sandbox without network, without secrets, with CPU/memory/time limits and an immutable base file system; the result is again treated as untrusted.

```python
# Defensive example: the model picks a query from an allowlist, it doesn't write SQL
QUERIES = {
    "orders_by_status": "SELECT id, status, total FROM orders WHERE customer_id = %s AND status = %s",
    "order_detail":     "SELECT id, status, total, created_at FROM orders WHERE customer_id = %s AND id = %s",
}

def run_query(conn, user, choice: dict):
    sql = QUERIES[choice["query"]]                  # KeyError if the query is not on the list
    params = (user.customer_id, choice["param"])    # customer_id from the session, not from the model
    with conn.cursor() as cur:                      # connection with a read-only role
        cur.execute(sql, params)
        return cur.fetchall()
```

## Sensitive information disclosure (LLM02)

**Sensitive Information Disclosure** means the response contains data the recipient must not see: personal data, secrets, business information, another user's or tenant's data. The first step is knowing **where** sensitive data can come from into the response:

| Source | Example | Control | Where |
|---|---|---|---|
| Training / fine-tuning data | the model "memorizes" personal data from the fine-tuning set | minimization and anonymization before training, memorization testing | ML pipeline (module 07) |
| RAG context | a document the user has no access to ends up in the answer | per-document ACL **before** insertion into the context | retrieval (module 06) |
| Tool results | an API returns the whole record when only one field is needed | tools return a minimal set of fields | tools |
| History and memory | one user's data in memory shared by everyone | per-user and per-tenant memory isolation | agent runtime |
| Response cache | a cached response with personal data returned to another user | the cache key includes identity and permissions | gateway |
| System prompt | keys, internal URLs, names in the prompt | no secrets in the prompt (LLM07) | configuration |
| Logs and telemetry | full prompt and response in the log platform | redaction, access control, retention period | observability |
| Model vendor | data is retained or used for training | contract: retention, no training, location | contract, procurement |

### Principle: what isn't in the context can't leak

The strongest control is **context minimization**. An output filter is the last line; the real control is that sensitive data never enters the context for a user who isn't allowed to see it.

- Retrieval filters by the user's permissions, not the service's.
- Tools return only the fields needed for the task (a projection, not `SELECT *`).
- Personal data not needed for the answer is masked before insertion (e.g., card number → last four digits).
- For tasks that don't need identity (summarization, classification), use pseudonymization.

### Output filtering (DLP)

On top of minimization, the output is checked for patterns that must never go out:

```python
# Defensive example: checking output for secrets and personal data before sending it to the user
import re

PATTERNS = {
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "private_key":    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "iban":           re.compile(r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b"),
    "jmbg":           re.compile(r"\b[0-9]{13}\b"),
}

def dlp_check(text: str) -> tuple[str, list[str]]:
    hits = []
    for name, rx in PATTERNS.items():
        if rx.search(text):
            hits.append(name)
            text = rx.sub(f"[REMOVED:{name}]", text)
    return text, hits      # hits go to the log and alert, without the content itself
```

(JMBG is the 13-digit national personal identification number used in Serbia and the region.)

Regex catches structured data (keys, account numbers), but not business secrets in free text. For that you have classifiers and, above all, context minimization.

> **In practice:** when output DLP reports a finding, it is an early-stage incident, not just a blocked response. The question for the investigation is: how did that data get into the context in the first place? The answer almost always leads to retrieval without ACLs, a tool that returns too much, or secrets in the prompt.

### Logs and the vendor

- Prompt and response logs: redact personal data and secrets before writing, a separate index with narrower access, a defined retention period.
- Contract with the model vendor: data retention period, no use for training, processing location, sub-processors. Also check the account/project-level settings, not just the contract.
- Tell users clearly what they shouldn't enter and what happens to conversations.

## System prompt leakage (LLM07)

**System Prompt Leakage** is an item that was singled out in the 2025 version because of a common misunderstanding: the problem isn't that someone can read the prompt, but that **security relies on the prompt staying secret**.

Assume the system prompt will leak (ATLAS **AML.T0056 Extract LLM System Prompt**). If that is acceptable, the prompt is well designed.

### What must not be in the prompt

| In the prompt (bad) | Where it belongs (good) |
|---|---|
| API keys, passwords, connection strings | a secrets manager; the tool uses them on the backend, the model never sees them |
| "Don't show X to users without the admin role" | authorization in code and in retrieval |
| Internal URLs, host names, network structure | tool configuration on the backend |
| Limits ("at most 3 refunds per day") as the only control | a check in business logic |
| Personal data of employees or customers | not in the prompt; if needed, from a source with ACLs |

```yaml
# Defensive example: a CI check that the prompt contains no secrets
prompt-secret-scan:
  stage: test
  script:
    - gitleaks dir prompts/ --redact --exit-code 1
    - "! grep -RniE '(password|api[_-]?key|secret|token)\\s*[:=]' prompts/"
```

### What's fine in the prompt

Role, tone, response format, general behavior rules, tool descriptions. If a competitor read them, it would be awkward, but not a security incident. If the prompt has significant business value, protect it like other intellectual property (repo access, change review), but still don't base security on its secrecy.

### Detecting leakage

- You can put a unique **canary** string (with no meaning at all) in the prompt; the output filter and monitoring look for that string in responses and alert if it appears. The same string in public sources indicates prompt extraction.
- Log request patterns that repeatedly ask for the model's configuration or instructions (ATLAS also has the technique **AML.T0069 Discover LLM System Information**).

```python
# Defensive example: a canary in the system prompt
CANARY = "cnry-7f3a91d2"          # rotated when the prompt changes, stored in configuration

def check_canary(output: str, request_id: str, log):
    if CANARY in output:
        log.warning("system_prompt_leak", extra={"request_id": request_id, "atlas": "AML.T0056"})
        return "Response unavailable."
    return output
```

> **In practice:** "don't reveal these instructions" in the prompt is not a control. It is a desired behavior the model often respects, but not always. If revealing the prompt would be an incident, rewrite the prompt instead of adding yet another sentence.

## Putting it into one flow

```text
 [Context: only permitted data]                             ← minimization, ACL (LLM02)
             │
          [LLM]  ── system prompt without secrets, with a canary ← LLM07
             │
   [Parsing + JSON Schema]  ── invalid → safe default + log           ← LLM05
             │
   [Business validation]  ── does the resource exist, is the user allowed
             │
   [DLP + canary check] ── finding → redaction + alert                ← LLM02, LLM07
             │
   ┌─────────┴──────────┐
 [Renderer: escape,   [Tool: parameterized,
  CSP, no images]      read-only, allowlist]                           ← LLM05
```

## Summary

- Model output is untrusted input. Validate it on entry to every component and encode it for the context (HTML, SQL, shell, paths, URL). Never `eval`, `shell=True`, `innerHTML` or f-string SQL with model output.
- When output is used programmatically, require structured JSON and validate it with a restrictive JSON Schema (`additionalProperties: false`, `enum`, ranges, `maxLength`, `pattern`) in your own code; invalid output → safe default and a log entry. Business validation follows the schema.
- A safe renderer: escaping, no raw HTML, no external images or only an allowlist, links only to approved domains, CSP as a second layer, no automatic link previews.
- When output triggers an action: an allowlist of parameterized queries with a read-only role, fixed commands, a sandbox for generated code.
- LLM02: list the sources of sensitive data (training, RAG, tools, memory, cache, prompt, logs, vendor). The strongest control is context minimization and ACLs before insertion; output DLP is the last line, and a finding is a reason to investigate.
- LLM07: assume the prompt will leak. No secrets, authorization, internal addresses or personal data in the prompt; secrets in a secrets manager, rules in code. A canary string helps detect leakage.
