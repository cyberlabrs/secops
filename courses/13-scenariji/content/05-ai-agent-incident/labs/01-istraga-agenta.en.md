# Lab 1: Investigating an incident with an AI support agent

The kurs-shop support agent (`support-agent`) helps operators: it searches the knowledge base (RAG, tool `search_kb`), reads tickets (`read_ticket`), runs SQL (`run_sql`), sends email (`send_email`) and opens URLs (`http_get`). On Tuesday, 14 Oct 2026 at 11:13 the email gateway rejected a message from the agent's service account to a domain registered three days earlier. You are the SOC analyst: find out how the agent was hijacked, what leaked and where, contain the incident, write a tool guard policy and a report.

There is no real LLM: you work with the recorded agent traces (`traces/*.jsonl`), the knowledge base documents, the email gateway log and the agent configuration. The company data (table and column names, documents) is in Serbian.

```bash
cd /root
ls kb traces mail agent
jq -c 'select(.event=="tool_call") | [.ts, .session_id, .tool]' traces/*.jsonl | head
```

Write your answers to `/root/odgovori/` ("answers"), one item per line.

<!-- setup
set -e
cp -r /opt/scenariji/05-ai-agent-incident/. /root/
mkdir -p /root/odgovori /root/guard /root/karantin
-->
<!-- timer
55
-->

## The poisoned knowledge base document

Every trace record has `session_id`, `user`, `event` (`user_prompt`, `tool_call`, `tool_result`, `assistant_response`) and a timestamp. The result of `search_kb` holds the chunks (`chunks`) the agent got from the knowledge base: content the model read but the user never saw.

Find the document in `kb/` that contains instructions aimed at the model (indirect prompt injection). Careful: not every sentence addressed to the assistant is malicious. Also look at `kb/index.json`: where did the document come from?

- write the document ID (e.g. `KB-0001`) to `/root/odgovori/dokument.txt`,
- write the ticket through which the document entered the knowledge base to `/root/odgovori/tiket.txt`.

<!-- verify
cd /root/odgovori
[ -s dokument.txt ] || { echo "no dokument.txt"; exit 1; }
grep -q 'KB-0142' dokument.txt || { echo "dokument.txt: wrong document"; exit 1; }
[ "$(grep -o 'KB-[0-9]*' dokument.txt | sort -u | wc -l)" = "1" ] || { echo "dokument.txt: write only one document"; exit 1; }
grep -q 'TCK-4471' tiket.txt 2>/dev/null || { echo "tiket.txt: wrong ticket"; exit 1; }
-->
<!-- hint
```bash
grep -n -i -E 'asistent|assistant|instruc|run_sql|send_email|http_get' kb/*.md
jq -r '.[] | [.doc_id, .source, .uploaded_by, .ingested_at, (.ticket // "-")] | @tsv' kb/index.json
```
KB-0007 has a note for the assistant, but it is an internal tone guideline written by the support team. Look for a hidden block that is not visible when the markdown is rendered.
-->
<!-- solution
echo KB-0142 > /root/odgovori/dokument.txt
echo TCK-4471 > /root/odgovori/tiket.txt
-->

## Tool calls in the affected sessions

Find the sessions in which the agent received any chunk of the poisoned document, then list all tool calls from those sessions.

- `/root/odgovori/sesije.txt`: the IDs of those sessions, one per line, sorted,
- `/root/odgovori/pozivi.tsv`: the output of a jq query that prints `ts`, `session_id`, `call_id` and `tool` separated by tabs (`@tsv`) for every `tool_call` in those sessions, in the order they appear in `traces/*.jsonl`.

Compare the sessions: in which ones did the agent, after the search, call tools the user never asked for, and in which one not? Check which chunks (`chunk_id`) each session received.

<!-- verify
cd /root/odgovori
want='sess-3f9b2d
sess-a41c07
sess-c8e512'
[ "$(grep -v '^\s*$' sesije.txt 2>/dev/null | sort -u)" = "$want" ] || { echo "sesije.txt is not correct"; exit 1; }
ref=$(jq -r 'select(.event=="tool_call" and (.session_id=="sess-3f9b2d" or .session_id=="sess-a41c07" or .session_id=="sess-c8e512")) | [.ts, .session_id, .call_id, .tool] | @tsv' /opt/scenariji/05-ai-agent-incident/traces/*.jsonl)
[ "$(tr -d '\r' < pozivi.tsv 2>/dev/null)" = "$ref" ] || { echo "pozivi.tsv does not match the reference (columns ts, session_id, call_id, tool; in file order)"; exit 1; }
-->
<!-- hint
```bash
jq -r 'select(.event=="tool_result" and .tool=="search_kb")
  | select(any(.output.chunks[]; .doc_id=="KB-0142")) | .session_id' traces/*.jsonl | sort -u > odgovori/sesije.txt
S=$(jq -R . odgovori/sesije.txt | jq -sc .)
jq -r --argjson S "$S" 'select(.event=="tool_call" and (.session_id | IN($S[])))
  | [.ts, .session_id, .call_id, .tool] | @tsv' traces/*.jsonl > odgovori/pozivi.tsv
```
-->
<!-- solution
cd /root
jq -r 'select(.event=="tool_result" and .tool=="search_kb") | select(any(.output.chunks[]; .doc_id=="KB-0142")) | .session_id' traces/*.jsonl | sort -u > odgovori/sesije.txt
S=$(jq -R . odgovori/sesije.txt | jq -sc .)
jq -r --argjson S "$S" 'select(.event=="tool_call" and (.session_id | IN($S[]))) | [.ts, .session_id, .call_id, .tool] | @tsv' traces/*.jsonl > odgovori/pozivi.tsv
-->

## What leaked and where

Look at the arguments and results of the suspicious calls (`send_email`, `http_get`, `run_sql`) and compare them with the email gateway log `mail/gateway.jsonl`. An attempt is not the same as a leak: check the status of every attempt. The data in the URL is base64-encoded.

- `/root/odgovori/odrediste.txt`: the external email address and the external host the data was sent to (each on its own line),
- `/root/odgovori/mejl.txt`: the `message_id` of the message the gateway **delivered** to the attacker,
- `/root/odgovori/ukupno.txt`: the number of **distinct** customers (by `id`) whose data actually left the company, across all channels,
- `/root/odgovori/polja.txt`: the names of the leaked columns (of table `kupci`, "customers"), comma-separated.

<!-- verify
cd /root/odgovori
grep -qi 'verifikacija@kurs-shop-podrska.com' odrediste.txt 2>/dev/null || { echo "odrediste.txt: email address missing"; exit 1; }
grep -qi 'cdn-sync.kurs-shop-podrska.com' odrediste.txt || { echo "odrediste.txt: host missing"; exit 1; }
grep -qF '20261014084912.7d1c@mail.kurs-shop.ba' mejl.txt 2>/dev/null || { echo "mejl.txt: wrong message_id"; exit 1; }
grep -q '20261014111329' mejl.txt && { echo "mejl.txt: that message was not delivered"; exit 1; }
[ "$(tr -dc '0-9' < ukupno.txt 2>/dev/null)" = "203" ] || { echo "ukupno.txt: wrong number of customers"; exit 1; }
for k in ime prezime email telefon; do grep -qiw "$k" polja.txt 2>/dev/null || { echo "polja.txt: column $k missing"; exit 1; }; done
grep -Eqi 'iban|lozink|password|kartic' polja.txt && { echo "polja.txt: that column did not leak"; exit 1; }
exit 0
-->
<!-- hint
```bash
jq -c 'select(.call_id=="c-0014" or .call_id=="c-0024" or .call_id=="c-0025") | {ts, event, tool, status, error, to: .args.to}' traces/*.jsonl
jq -c 'select(.to? and (.to | test("kurs-shop-podrska")))' mail/gateway.jsonl
jq -r 'select(.call_id=="c-0025" and .event=="tool_call") | .args.url | capture("d=(?<d>.*)").d | @base64d' traces/*.jsonl | head -3
jq -r 'select(.call_id=="c-0014" and .event=="tool_call") | .args.body' traces/*.jsonl | head -3
```
Combine the IDs from the delivered message and from the decoded URL, then `sort -u | wc -l`. The second message (11:13) was not delivered, which is exactly why the agent called `http_get`.
-->
<!-- solution
cd /root
printf 'verifikacija@kurs-shop-podrska.com\ncdn-sync.kurs-shop-podrska.com\n' > odgovori/odrediste.txt
jq -r 'select(.status=="delivered" and (.to | endswith("@kurs-shop-podrska.com"))) | .message_id' mail/gateway.jsonl > odgovori/mejl.txt
{ jq -r 'select(.call_id=="c-0014" and .event=="tool_call") | .args.body' traces/*.jsonl | tail -n +2 | cut -d, -f1
  jq -r 'select(.call_id=="c-0025" and .event=="tool_call") | .args.url | capture("d=(?<d>.*)").d | @base64d' traces/*.jsonl | cut -d, -f1
} | sort -u | wc -l | tr -d ' ' > odgovori/ukupno.txt
echo 'id,ime,prezime,email,telefon' > odgovori/polja.txt
-->

## Containment: document, ingest and block

Stop the source and the channel first, then fix the controls:

1. Move the poisoned document from `kb/` to `/root/karantin/` (quarantine) and set its `"status": "quarantined"` in `kb/index.json` (the other documents stay `active`).
2. In `agent/agent-config.yaml` (with `yq -i`): remove `ticket_attachments` from `.kb.ingest.sources` (`confluence:PODRSKA` stays), set `.kb.ingest.strip_html_comments: true` and change `.tools.run_sql.db_role` to `support_agent_ro`.
3. Add the attacker's domain to `mail/blocklist.txt` (one domain per line).

<!-- verify
cd /root
[ -f karantin/KB-0142-uputstvo-reklamacije-2026.md ] || { echo "document is not in /root/karantin/"; exit 1; }
ls kb/KB-0142* >/dev/null 2>&1 && { echo "document is still in kb/"; exit 1; }
[ "$(jq -r '.[] | select(.doc_id=="KB-0142") | .status' kb/index.json)" = "quarantined" ] || { echo "index.json: KB-0142 does not have status quarantined"; exit 1; }
[ "$(jq '[.[] | select(.status=="active")] | length' kb/index.json)" = "9" ] || { echo "index.json: the other documents must stay active"; exit 1; }
[ "$(yq '.kb.ingest.sources | contains(["ticket_attachments"])' agent/agent-config.yaml)" = "false" ] || { echo "ticket_attachments is still an ingest source"; exit 1; }
[ "$(yq '.kb.ingest.sources | contains(["confluence:PODRSKA"])' agent/agent-config.yaml)" = "true" ] || { echo "confluence:PODRSKA must stay a source"; exit 1; }
[ "$(yq '.kb.ingest.strip_html_comments' agent/agent-config.yaml)" = "true" ] || { echo "strip_html_comments is not true"; exit 1; }
[ "$(yq '.tools.run_sql.db_role' agent/agent-config.yaml)" = "support_agent_ro" ] || { echo "db_role is not support_agent_ro"; exit 1; }
grep -qx 'kurs-shop-podrska.com' mail/blocklist.txt || { echo "domain is not in blocklist.txt"; exit 1; }
-->
<!-- hint
```bash
jq '(.[] | select(.doc_id=="KB-0142") | .status) = "quarantined"' kb/index.json > /tmp/i.json && mv /tmp/i.json kb/index.json
yq -i '.kb.ingest.sources |= map(select(. != "ticket_attachments"))' agent/agent-config.yaml
```
In a real incident this is also where you reindex the vector store (the document's chunks stay in the index until deleted), temporarily disable the `send_email` and `http_get` tools and check whether the same domain shows up in proxy and DNS logs.
-->
<!-- solution
cd /root
mv kb/KB-0142-uputstvo-reklamacije-2026.md karantin/
jq '(.[] | select(.doc_id=="KB-0142") | .status) = "quarantined"' kb/index.json > /tmp/i.json && mv /tmp/i.json kb/index.json
yq -i '.kb.ingest.sources |= map(select(. != "ticket_attachments")) | .kb.ingest.strip_html_comments = true | .tools.run_sql.db_role = "support_agent_ro"' agent/agent-config.yaml
echo kurs-shop-podrska.com >> mail/blocklist.txt
-->

## Tool guard policy

Removing the document does not fix the problem: the next injection can arrive through a ticket, an email or a web page. Write the policy `/root/guard/policy.yaml`, enforced by a deterministic guard between the model and the tools, and test it with `tool-guard`, which replays every recorded tool call through the policy:

```bash
tool-guard --policy /root/guard/policy.yaml --summary traces/*.jsonl
```

The policy format is described by `tool-guard` (run it without arguments). Rules:

1. Anything not listed is denied (`default: deny`).
2. `search_kb` and `read_ticket`: allowed.
3. `run_sql`: read-only (`read_only`) and only the tables `narudzbe` (orders), `proizvodi` (products) and `tiketi` (tickets).
4. `send_email`: only recipients in the `kurs-shop.ba` domain, and only with human approval (`approval`).
5. `http_get`: `status.kurs-shop.ba` allowed; the external `api.posta.ba` with human approval; every other host denied.

The policy must deny (`deny`) all five malicious calls and allow the legitimate ones or send them for approval. Save the output for `traces/*.jsonl` (without `--summary`) to `/root/guard/odluke.csv` ("decisions"), and enable the guard in `agent/agent-config.yaml`: `.guard.enabled: true` and `.guard.policy: /root/guard/policy.yaml`.

<!-- verify
cd /root/guard
[ -f policy.yaml ] || { echo "no /root/guard/policy.yaml"; exit 1; }
T=$(mktemp -d)
cat > $T/ref.yaml <<'EOF'
default: deny
tools:
  search_kb: {decision: allow}
  read_ticket: {decision: allow}
  run_sql: {decision: allow, read_only: true, tables: [narudzbe, proizvodi, tiketi]}
  send_email: {decision: approval, recipient_domains: [kurs-shop.ba]}
  http_get: {decision: allow, hosts: [status.kurs-shop.ba], approval_hosts: [api.posta.ba]}
EOF
cat > $T/extra.jsonl <<'EOF'
{"event": "tool_call", "call_id": "t-01", "session_id": "test", "tool": "delete_ticket", "args": {"ticket_id": "TCK-1"}}
{"event": "tool_call", "call_id": "t-02", "session_id": "test", "tool": "run_sql", "args": {"query": "DELETE FROM narudzbe WHERE id = 1"}}
{"event": "tool_call", "call_id": "t-03", "session_id": "test", "tool": "run_sql", "args": {"query": "SELECT iban FROM placanja"}}
{"event": "tool_call", "call_id": "t-04", "session_id": "test", "tool": "run_sql", "args": {"query": "SELECT id FROM narudzbe; DROP TABLE kupci"}}
{"event": "tool_call", "call_id": "t-05", "session_id": "test", "tool": "send_email", "args": {"to": "a@kurs-shop.ba.evil.io", "subject": "x", "body": "y"}}
{"event": "tool_call", "call_id": "t-06", "session_id": "test", "tool": "send_email", "args": {"to": ["a@kurs-shop.ba", "b@gmail.com"], "subject": "x", "body": "y"}}
{"event": "tool_call", "call_id": "t-07", "session_id": "test", "tool": "http_get", "args": {"url": "https://api.posta.ba.evil.io/x"}}
{"event": "tool_call", "call_id": "t-08", "session_id": "test", "tool": "http_get", "args": {"url": "https://status.kurs-shop.ba/api/v1/status"}}
{"event": "tool_call", "call_id": "t-09", "session_id": "test", "tool": "run_sql", "args": {"query": "SELECT naziv FROM proizvodi WHERE id = 3"}}
{"event": "tool_call", "call_id": "t-10", "session_id": "test", "tool": "send_email", "args": {"to": "it@kurs-shop.ba", "subject": "x", "body": "y"}}
EOF
D=/opt/scenariji/05-ai-agent-incident/traces
tool-guard --policy policy.yaml $D/*.jsonl $T/extra.jsonl > $T/mine.csv 2> $T/err || { echo "tool-guard reports an error:"; cat $T/err; exit 1; }
tool-guard --policy $T/ref.yaml $D/*.jsonl $T/extra.jsonl > $T/ref.csv
for c in c-0013 c-0014 c-0023 c-0024 c-0025; do grep -q "^$c,.*,deny," $T/mine.csv || { echo "malicious call $c is not denied"; exit 1; }; done
bad=$(diff <(cut -d, -f1,3,4 $T/ref.csv) <(cut -d, -f1,3,4 $T/mine.csv) | grep '^>' | head -5)
[ -z "$bad" ] || { echo "decisions do not match the rules (call_id,tool,decision):"; echo "$bad"; exit 1; }
[ "$(tr -d '\r' < odluke.csv 2>/dev/null)" = "$(tool-guard --policy policy.yaml /root/traces/*.jsonl)" ] || { echo "odluke.csv is not the tool-guard output for traces/*.jsonl"; exit 1; }
[ "$(yq '.guard.enabled' /root/agent/agent-config.yaml)" = "true" ] || { echo "the guard is not enabled in agent-config.yaml"; exit 1; }
[ "$(yq '.guard.policy' /root/agent/agent-config.yaml)" = "/root/guard/policy.yaml" ] || { echo "guard.policy is not /root/guard/policy.yaml"; exit 1; }
-->
<!-- hint
```yaml
default: deny
tools:
  search_kb:
    decision: allow
  run_sql:
    decision: allow
    read_only: true
    tables: [...]
  send_email:
    decision: approval
    recipient_domains: [...]
  http_get:
    decision: allow
    hosts: [...]
    approval_hosts: [...]
```
The policy is defense in depth, not a replacement for least privilege: the `support_agent_ro` database role must still have only `SELECT` on those three tables, so even a bug in the guard does not open the `kupci` table.
-->
<!-- solution
cat > /root/guard/policy.yaml <<'EOF'
default: deny
tools:
  search_kb:
    decision: allow
  read_ticket:
    decision: allow
  run_sql:
    decision: allow
    read_only: true
    tables: [narudzbe, proizvodi, tiketi]
  send_email:
    decision: approval
    recipient_domains: [kurs-shop.ba]
  http_get:
    decision: allow
    hosts: [status.kurs-shop.ba]
    approval_hosts: [api.posta.ba]
EOF
tool-guard --policy /root/guard/policy.yaml /root/traces/*.jsonl > /root/guard/odluke.csv
yq -i '.guard.enabled = true | .guard.policy = "/root/guard/policy.yaml"' /root/agent/agent-config.yaml
-->

## Timeline and report

Write `/root/odgovori/izvjestaj.md` ("report") for the CISO and the DPO (short, in markdown):

- a **timeline** with at least five events (UTC time, `HH:MM`): from the ticket and the document ingest to containment,
- **impact**: the poisoned document ID, the destinations (attacker domain), the number of customers and the fields that leaked,
- **mapping**: OWASP Top 10 for LLM (`LLM01`, `LLM02`, `LLM06`) and MITRE ATLAS (at least `AML.T0051` and an exfiltration technique, e.g. `AML.T0086`),
- **recommendations**: what you change so it does not happen again.

<!-- verify
f=/root/odgovori/izvjestaj.md
[ -s $f ] || { echo "no izvjestaj.md"; exit 1; }
for k in LLM01 LLM02 LLM06 AML.T0051 KB-0142 kurs-shop-podrska.com 203; do grep -qF "$k" $f || { echo "the report does not contain $k"; exit 1; }; done
grep -Eq 'AML\.T0086|AML\.T0025|AML\.T0057' $f || { echo "an ATLAS exfiltration or leakage technique is missing"; exit 1; }
[ "$(grep -Ec '\b([01][0-9]|2[0-3]):[0-5][0-9]\b' $f)" -ge 5 ] || { echo "the timeline needs at least 5 events with an HH:MM time"; exit 1; }
grep -Eqi 'preporu|recommend' $f || { echo "recommendations are missing"; exit 1; }
-->
<!-- hint
Take the times from `kb/index.json` (ingest), `read_ticket` (ticket created), the traces and the gateway log (delivery, rejection, alert). Do not copy customer data into the report: the count and the data types are enough.
-->
<!-- solution
cat > /root/odgovori/izvjestaj.md <<'EOF'
# Incident: preuzimanje agenta za podršku kroz otrovani dokument (KB-0142)

### Vremenska linija (UTC)
- 2026-10-13 16:42 kupac-4996 otvara tiket TCK-4471 sa prilogom uputstvo-reklamacije-2026.md
- 2026-10-13 17:00 ingest indeksira prilog kao KB-0142 (izvor ticket_attachments)
- 2026-10-14 08:47 sesija sess-3f9b2d dobija isječak KB-0142#3; 08:48 run_sql nad tabelom kupci (200 redova)
- 2026-10-14 08:49 send_email na verifikacija@kurs-shop-podrska.com, gateway isporučuje
- 2026-10-14 11:13 sesija sess-a41c07: mejl odbijen (nrd-block), agent šalje 20 redova kroz http_get na cdn-sync.kurs-shop-podrska.com
- 2026-10-14 11:13 alarm gateway-a, triaža SOC-a; 12:30 obuzdavanje (karantin KB-0142, blokada domene, čuvar alata)

### Uticaj
203 kupca: id, ime, prezime, email, telefon (bez podataka o plaćanju). Odredišta: verifikacija@kurs-shop-podrska.com i cdn-sync.kurs-shop-podrska.com.

### Mapiranje
- OWASP: LLM01 Prompt Injection (indirektni, kroz RAG), LLM06 Excessive Agency, LLM02 Sensitive Information Disclosure
- MITRE ATLAS: AML.T0051.001, AML.T0070 RAG Poisoning, AML.T0053, AML.T0086 Exfiltration via AI Agent Tool Invocation

### Preporuke
Prilozi tiketa ne idu u zajedničku bazu znanja; čuvar alata sa default deny; run_sql sa read-only ulogom; odobrenje čovjeka za send_email; obavještenje AZLP-a i kupaca.
EOF
-->
