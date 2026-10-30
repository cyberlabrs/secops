# Lab 1: Model output is untrusted input

A support application sends tickets to an LLM, and the model returns JSON with a category, priority and a summary that is shown to agents in a web application. The model sometimes returns invalid JSON, invents a category, adds fields or puts HTML from the ticket text into the summary. Model output must be treated as **untrusted input** (OWASP LLM05: Improper Output Handling): validated and displayed safely.

The recorded model responses are in `/root/izlaz/odgovori.jsonl` (one response per line; the `odgovor` field is the model's raw text). The field and value names in this lab are in Serbian and must be used exactly as given: `tiket` = ticket, `odgovor` = response, `kategorija` = category, `prioritet` = priority, `sazetak` = summary.

```bash
cd /root/izlaz
jq -r '.odgovor' odgovori.jsonl
```

<!-- setup
set -e
mkdir -p /root/izlaz
cat > /root/izlaz/odgovori.jsonl <<'EOF'
{"tiket": "T-1", "odgovor": "{\"kategorija\": \"racun\", \"prioritet\": 2, \"sazetak\": \"Kupac traži kopiju računa za septembar.\"}"}
{"tiket": "T-2", "odgovor": "Evo odgovora: {\"kategorija\": \"tehnicki\", \"prioritet\": 4, \"sazetak\": \"Aplikacija se ruši pri plaćanju.\"}"}
{"tiket": "T-3", "odgovor": "{\"kategorija\": \"reklamacija\", \"prioritet\": 3, \"sazetak\": \"Oštećen paket.\", \"akcija\": \"odobri_povrat\"}"}
{"tiket": "T-4", "odgovor": "{\"kategorija\": \"hitno_vip\", \"prioritet\": 5, \"sazetak\": \"Kupac je VIP.\"}"}
{"tiket": "T-5", "odgovor": "{\"kategorija\": \"tehnicki\", \"prioritet\": 9, \"sazetak\": \"Spora stranica.\"}"}
{"tiket": "T-6", "odgovor": "{\"kategorija\": \"reklamacija\", \"prioritet\": 3, \"sazetak\": \"Kupac piše: <i>hitno</i> i šalje <a href=\\\"http://primjer.ba\\\">link</a>.\"}"}
{"tiket": "T-7", "odgovor": "{\"kategorija\": \"racun\", \"prioritet\": 1}"}
{"tiket": "T-8", "odgovor": "{\"kategorija\": \"ostalo\", \"prioritet\": 1, \"sazetak\": \"Pitanje o radnom vremenu.\"}"}
EOF
-->

## JSON Schema

Write `/root/izlaz/sema.json` (JSON Schema, draft 2020-12) for the model's response:

- an object with **exactly** the fields `kategorija`, `prioritet`, `sazetak` (all required, other fields forbidden),
- `kategorija`: one of `racun` (invoice), `tehnicki` (technical), `reklamacija` (complaint), `ostalo` (other),
- `prioritet`: an integer from 1 to 5,
- `sazetak`: a string of 1 to 300 characters.

<!-- verify
f=/root/izlaz/sema.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import json, sys
from jsonschema import Draft202012Validator
s = json.load(open("/root/izlaz/sema.json"))
Draft202012Validator.check_schema(s)
v = Draft202012Validator(s)
ok = [{"kategorija": "racun", "prioritet": 1, "sazetak": "x"}, {"kategorija": "ostalo", "prioritet": 5, "sazetak": "a" * 300}]
bad = [{"kategorija": "racun", "prioritet": 1}, {"kategorija": "hitno", "prioritet": 1, "sazetak": "x"},
       {"kategorija": "racun", "prioritet": 0, "sazetak": "x"}, {"kategorija": "racun", "prioritet": 6, "sazetak": "x"},
       {"kategorija": "racun", "prioritet": 2.5, "sazetak": "x"}, {"kategorija": "racun", "prioritet": 1, "sazetak": ""},
       {"kategorija": "racun", "prioritet": 1, "sazetak": "a" * 301}, {"kategorija": "racun", "prioritet": 1, "sazetak": "x", "akcija": "y"},
       ["racun", 1, "x"]]
for o in ok:
    if not v.is_valid(o): sys.exit(f"the schema rejects a valid response: {o}")
for o in bad:
    if v.is_valid(o): sys.exit(f"the schema accepts an invalid response: {str(o)[:80]}")
EOF
-->
<!-- hint
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "kategorija": {"enum": ["racun", "tehnicki", "reklamacija", "ostalo"]},
    "prioritet": {"type": "integer", "minimum": 1, "maximum": 5},
    "sazetak": {"type": "string", "minLength": 1, "maxLength": 300}
  },
  "required": ["kategorija", "prioritet", "sazetak"],
  "additionalProperties": false
}
```
`additionalProperties: false` is the key: the `akcija` (action) field the model "made up" must not reach code that might execute it.
-->
<!-- solution
cat > /root/izlaz/sema.json <<'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "kategorija": {"enum": ["racun", "tehnicki", "reklamacija", "ostalo"]},
    "prioritet": {"type": "integer", "minimum": 1, "maximum": 5},
    "sazetak": {"type": "string", "minLength": 1, "maxLength": 300}
  },
  "required": ["kategorija", "prioritet", "sazetak"],
  "additionalProperties": false
}
EOF
-->

## Validator

Write `/root/izlaz/validiraj.py` (run with `/opt/ai/bin/python`) that reads `odgovori.jsonl` and, for each ticket, writes a row to `/root/izlaz/rezultat.csv` (header `tiket,status,razlog`, where `razlog` = reason):

- `status` is `ok` if the whole `odgovor` is valid JSON (with no text around it) that passes the schema, otherwise `odbijen` (rejected),
- `razlog` is empty for `ok`, and for `odbijen` one of: `nije_json` (not JSON: it doesn't parse as JSON) or `sema` (schema: JSON, but it doesn't pass the schema).

A rejected response is not "fixed" by guessing (e.g., by extracting JSON from the text): it goes to a retry or to a human.

<!-- verify
cd /root/izlaz
[ -f validiraj.py ] || { echo "validiraj.py is missing"; exit 1; }
rm -f rezultat.csv; /opt/ai/bin/python validiraj.py >/dev/null 2>&1 || { echo "validiraj.py exits with an error"; exit 1; }
want='tiket,status,razlog
T-1,ok,
T-2,odbijen,nije_json
T-3,odbijen,sema
T-4,odbijen,sema
T-5,odbijen,sema
T-6,ok,
T-7,odbijen,sema
T-8,ok,'
[ "$(tr -d '\r' < rezultat.csv 2>/dev/null)" = "$want" ] || { echo "rezultat.csv is not correct:"; cat rezultat.csv 2>/dev/null; exit 1; }
cp odgovori.jsonl /tmp/o.bak
echo '{"tiket": "T-9", "odgovor": "{\"kategorija\": \"racun\", \"prioritet\": 2, \"sazetak\": \"ok\", \"sql\": \"x\"}"}' >> odgovori.jsonl
/opt/ai/bin/python validiraj.py >/dev/null 2>&1; r=$(grep '^T-9,' rezultat.csv | tr -d '\r'); cp /tmp/o.bak odgovori.jsonl; /opt/ai/bin/python validiraj.py >/dev/null 2>&1
[ "$r" = "T-9,odbijen,sema" ] || { echo "the validator does not use sema.json for new responses (T-9 with an extra field)"; exit 1; }
-->
<!-- hint
```python
import csv, json
from jsonschema import Draft202012Validator
v = Draft202012Validator(json.load(open("sema.json")))
for line in open("odgovori.jsonl"):
    rec = json.loads(line)
    try:
        obj = json.loads(rec["odgovor"])
    except json.JSONDecodeError:
        ...  # nije_json
```
-->
<!-- solution
cat > /root/izlaz/validiraj.py <<'EOF'
import csv, json
from jsonschema import Draft202012Validator
v = Draft202012Validator(json.load(open("/root/izlaz/sema.json")))
rows = []
for line in open("/root/izlaz/odgovori.jsonl", encoding="utf-8"):
    if not line.strip(): continue
    rec = json.loads(line)
    try:
        obj = json.loads(rec["odgovor"])
    except json.JSONDecodeError:
        rows.append([rec["tiket"], "odbijen", "nije_json"]); continue
    rows.append([rec["tiket"], "ok", ""] if v.is_valid(obj) else [rec["tiket"], "odbijen", "sema"])
with open("/root/izlaz/rezultat.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["tiket", "status", "razlog"]); w.writerows(rows)
EOF
/opt/ai/bin/python /root/izlaz/validiraj.py
-->

## Safe display

The summary is shown in a web application. Write `/root/izlaz/prikaz.py` that, for all `ok` responses, produces `/root/izlaz/tiketi.html`: one `<li>` per ticket in the form `<li data-tiket="T-1">[racun/2] summary</li>`, where the summary is **HTML-escaped** (`html.escape`), so that HTML from the ticket text is displayed as text rather than executed.

<!-- verify
cd /root/izlaz
[ -f prikaz.py ] || { echo "prikaz.py is missing"; exit 1; }
rm -f tiketi.html; /opt/ai/bin/python prikaz.py >/dev/null 2>&1 || { echo "prikaz.py exits with an error"; exit 1; }
h=$(cat tiketi.html 2>/dev/null)
[ "$(grep -o '<li data-tiket="T-[0-9]*">' tiketi.html | tr '\n' ' ')" = '<li data-tiket="T-1"> <li data-tiket="T-6"> <li data-tiket="T-8"> ' ] || { echo "tiketi.html needs an <li> only for the ok tickets T-1, T-6, T-8"; exit 1; }
echo "$h" | grep -q '<i>hitno</i>\|<a href' && { echo "HTML from the summary is not escaped"; exit 1; }
echo "$h" | grep -q '&lt;i&gt;hitno&lt;/i&gt;' && echo "$h" | grep -q '&lt;a href=&quot;http://primjer.ba&quot;&gt;' || { echo "the T-6 summary must be escaped (&lt;i&gt;…)"; exit 1; }
echo "$h" | grep -q '<li data-tiket="T-1">\[racun/2\] Kupac traži kopiju računa za septembar.</li>' || { echo "the row format is not correct: <li data-tiket=\"T-1\">[racun/2] summary</li>"; exit 1; }
-->
<!-- hint
```python
import html
f'<li data-tiket="{html.escape(t)}">[{k}/{p}] {html.escape(s)}</li>'
```
In a real application a templating engine with auto-escaping enabled does the same (Jinja2 autoescape, React by default), plus a Content-Security-Policy as a second line of defense.
-->
<!-- solution
cat > /root/izlaz/prikaz.py <<'EOF'
import csv, html, json
ok = {r["tiket"] for r in csv.DictReader(open("/root/izlaz/rezultat.csv")) if r["status"] == "ok"}
out = ["<ul>"]
for line in open("/root/izlaz/odgovori.jsonl", encoding="utf-8"):
    rec = json.loads(line)
    if rec["tiket"] not in ok: continue
    o = json.loads(rec["odgovor"])
    out.append(f'<li data-tiket="{html.escape(rec["tiket"])}">[{o["kategorija"]}/{o["prioritet"]}] {html.escape(o["sazetak"])}</li>')
out.append("</ul>")
open("/root/izlaz/tiketi.html", "w", encoding="utf-8").write("\n".join(out) + "\n")
EOF
/opt/ai/bin/python /root/izlaz/prikaz.py
-->
