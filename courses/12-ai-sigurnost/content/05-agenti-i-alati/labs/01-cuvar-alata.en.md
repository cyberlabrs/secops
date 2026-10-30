# Lab 1: A tool call guard for an agent

The kurs-shop support agent can call tools: knowledge base search, SQL queries and sending email. The model decides **what** it would call, but **whether** the call will be executed must be decided by deterministic code outside the model (OWASP LLM06: Excessive Agency). You will write such a **policy guard**: every proposed call gets the decision `dozvoli` (allow), `odbij` (deny) or `odobrenje` (approval: requires human confirmation). Use these Serbian decision values exactly as written, because the checks compare them.

The model's proposals are in `/root/agent/predlozi.jsonl` (fields: `alat` = tool, `argumenti` = arguments).

```bash
cd /root/agent
jq -c . predlozi.jsonl
```

<!-- setup
set -e
mkdir -p /root/agent
cat > /root/agent/predlozi.jsonl <<'EOF'
{"id": 1, "alat": "pretraga_znanja", "argumenti": {"upit": "rok za povrat robe"}}
{"id": 2, "alat": "sql_citanje", "argumenti": {"upit": "SELECT status FROM narudzbe WHERE id = 1042"}}
{"id": 3, "alat": "sql_citanje", "argumenti": {"upit": "SELECT * FROM korisnici"}}
{"id": 4, "alat": "sql_citanje", "argumenti": {"upit": "UPDATE narudzbe SET status = 'vraceno' WHERE id = 1042"}}
{"id": 5, "alat": "sql_citanje", "argumenti": {"upit": "SELECT naziv, cijena FROM proizvodi; DROP TABLE proizvodi"}}
{"id": 6, "alat": "posalji_email", "argumenti": {"prima": "ana.kovac@kurs-shop.ba", "naslov": "Status narudžbe", "tekst": "Vaša narudžba je poslana."}}
{"id": 7, "alat": "posalji_email", "argumenti": {"prima": "nepoznat@vanjska-domena.com", "naslov": "Izvoz", "tekst": "Lista kupaca u prilogu."}}
{"id": 8, "alat": "izvrsi_komandu", "argumenti": {"komanda": "ls /"}}
{"id": 9, "alat": "pretraga_znanja", "argumenti": {"upit": "a", "dodatno": "x"}}
{"id": 10, "alat": "sql_citanje", "argumenti": {"upit": "select naziv from proizvodi where cijena < 10"}}
EOF
-->

## Policy

Write `/root/agent/cuvar.py` with a function `odluka(predlog) -> str` (decision(proposal)) and a main section that writes `/root/agent/odluke.csv` (header `id,odluka`) for all proposals. The policy:

1. Only the tools `pretraga_znanja` (knowledge search), `sql_citanje` (SQL read) and `posalji_email` (send email) are allowed; any other tool: `odbij`.
2. The arguments must be **exactly** the expected ones (`pretraga_znanja`: `upit`; `sql_citanje`: `upit`; `posalji_email`: `prima`, `naslov`, `tekst`, i.e., recipient, subject, body); extra or missing arguments: `odbij`.
3. `sql_citanje`: a single statement (no `;`), it must start with `SELECT` (case-insensitive), and it may read only the tables `narudzbe` (orders) and `proizvodi` (products) (the table after `FROM` must be one of them); otherwise `odbij`.
4. `posalji_email`: the recipient only from the `@kurs-shop.ba` domain, otherwise `odbij`; and even when the domain is fine, sending requires human confirmation: `odobrenje`.
5. Everything else that passes the rules: `dozvoli`.

<!-- verify
cd /root/agent
[ -f cuvar.py ] || { echo "cuvar.py is missing"; exit 1; }
rm -f odluke.csv; /opt/ai/bin/python cuvar.py >/dev/null 2>&1 || { echo "cuvar.py exits with an error"; exit 1; }
want='id,odluka
1,dozvoli
2,dozvoli
3,odbij
4,odbij
5,odbij
6,odobrenje
7,odbij
8,odbij
9,odbij
10,dozvoli'
[ "$(tr -d '\r' < odluke.csv 2>/dev/null)" = "$want" ] || { echo "odluke.csv is not correct:"; cat odluke.csv 2>/dev/null; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import importlib.util, sys
spec = importlib.util.spec_from_file_location("cuvar", "/root/agent/cuvar.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]; spec.loader.exec_module(m)
T = [({"alat": "sql_citanje", "argumenti": {"upit": "SELECT id FROM narudzbe"}}, "dozvoli"),
     ({"alat": "sql_citanje", "argumenti": {"upit": "  SeLeCt id FROM proizvodi"}}, "dozvoli"),
     ({"alat": "sql_citanje", "argumenti": {"upit": "SELECT lozinka FROM korisnici"}}, "odbij"),
     ({"alat": "sql_citanje", "argumenti": {"upit": "DELETE FROM narudzbe"}}, "odbij"),
     ({"alat": "sql_citanje", "argumenti": {"upit": "SELECT 1; SELECT 2"}}, "odbij"),
     ({"alat": "posalji_email", "argumenti": {"prima": "x@kurs-shop.ba.zlo.com", "naslov": "a", "tekst": "b"}}, "odbij"),
     ({"alat": "posalji_email", "argumenti": {"prima": "ivan@kurs-shop.ba", "naslov": "a", "tekst": "b"}}, "odobrenje"),
     ({"alat": "posalji_email", "argumenti": {"prima": "ivan@kurs-shop.ba", "naslov": "a"}}, "odbij"),
     ({"alat": "brisi_fajl", "argumenti": {"put": "/tmp/x"}}, "odbij"),
     ({"alat": "pretraga_znanja", "argumenti": {}}, "odbij")]
for p, w in T:
    g = m.odluka(p)
    if g != w: sys.exit(f"odluka({p}) = {g}, expected {w}")
EOF
-->
<!-- hint
```python
import re
SQL = re.compile(r"^\s*select\b.*\bfrom\s+(\w+)", re.I | re.S)
def odluka(p):
    a, args = p.get("alat"), p.get("argumenti", {})
    ...
```
Watch the domain: `x@kurs-shop.ba.zlo.com` contains `@kurs-shop.ba`, but doesn't end with it. Use `endswith("@kurs-shop.ba")`.

In production this guard works alongside even stronger controls: the tool runs with an account that has only `SELECT` on those two tables in the database (least privilege), so even a bug in the guard can't change data.
-->
<!-- solution
cat > /root/agent/cuvar.py <<'EOF'
import csv, json, re
OCEKIVANO = {"pretraga_znanja": {"upit"}, "sql_citanje": {"upit"}, "posalji_email": {"prima", "naslov", "tekst"}}
TABELE = {"narudzbe", "proizvodi"}
SQL = re.compile(r"^\s*select\b.*?\bfrom\s+(\w+)", re.I | re.S)

def odluka(p):
    a, args = p.get("alat"), p.get("argumenti") or {}
    if a not in OCEKIVANO or set(args) != OCEKIVANO[a]:
        return "odbij"
    if a == "sql_citanje":
        q = str(args["upit"])
        m = SQL.match(q)
        if ";" in q or not m or m.group(1).lower() not in TABELE:
            return "odbij"
    if a == "posalji_email":
        if not str(args["prima"]).lower().endswith("@kurs-shop.ba"):
            return "odbij"
        return "odobrenje"
    return "dozvoli"

if __name__ == "__main__":
    rows = [json.loads(l) for l in open("/root/agent/predlozi.jsonl", encoding="utf-8") if l.strip()]
    with open("/root/agent/odluke.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["id", "odluka"])
        for r in rows: w.writerow([r["id"], odluka(r)])
EOF
/opt/ai/bin/python /root/agent/cuvar.py
-->

## Audit trail

Every guard decision must leave a trace for investigation. Extend `cuvar.py` so that, in addition to `odluke.csv`, it also writes `/root/agent/audit.jsonl`: one JSON object per proposal with the fields `id`, `alat`, `odluka`, `vrijeme` (time: UTC, ISO 8601) and `argumenti_hash` (the SHA-256 of the arguments' JSON with sorted keys, rather than the arguments themselves, because email text may contain personal data).

<!-- verify
cd /root/agent
rm -f audit.jsonl; /opt/ai/bin/python cuvar.py >/dev/null 2>&1
[ "$(grep -c . audit.jsonl 2>/dev/null)" = "10" ] || { echo "audit.jsonl needs 10 entries"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import json, hashlib, sys, csv
from datetime import datetime
odl = {r["id"]: r["odluka"] for r in csv.DictReader(open("/root/agent/odluke.csv"))}
pred = {str(json.loads(l)["id"]): json.loads(l) for l in open("/root/agent/predlozi.jsonl") if l.strip()}
for l in open("/root/agent/audit.jsonl"):
    a = json.loads(l); i = str(a.get("id"))
    if set(a) != {"id", "alat", "odluka", "vrijeme", "argumenti_hash"}: sys.exit(f"entry {i}: the fields must be exactly id, alat, odluka, vrijeme, argumenti_hash")
    if a["odluka"] != odl[i] or a["alat"] != pred[i]["alat"]: sys.exit(f"entry {i}: alat or odluka does not match")
    h = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True).encode()).hexdigest()
    h2 = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    h3 = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    h4 = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    if a["argumenti_hash"] not in (h, h2, h3, h4): sys.exit(f"entry {i}: argumenti_hash is not the SHA-256 of the arguments' JSON with sorted keys")
    t = datetime.fromisoformat(a["vrijeme"].replace("Z", "+00:00"))
    if t.utcoffset() is None or t.utcoffset().total_seconds() != 0: sys.exit(f"entry {i}: vrijeme must be in UTC")
if "Vaša narudžba" in open("/root/agent/audit.jsonl").read(): sys.exit("the audit log contains argument text")
EOF
-->
<!-- hint
```python
import hashlib, json
from datetime import datetime, timezone
h = hashlib.sha256(json.dumps(args, sort_keys=True).encode()).hexdigest()
datetime.now(timezone.utc).isoformat()
```
-->
<!-- solution
cat >> /root/agent/cuvar.py <<'EOF'

if __name__ == "__main__":
    import hashlib
    from datetime import datetime, timezone
    with open("/root/agent/audit.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            h = hashlib.sha256(json.dumps(r.get("argumenti") or {}, sort_keys=True).encode()).hexdigest()
            f.write(json.dumps({"id": r["id"], "alat": r.get("alat"), "odluka": odluka(r), "vrijeme": datetime.now(timezone.utc).isoformat(), "argumenti_hash": h}) + "\n")
EOF
/opt/ai/bin/python /root/agent/cuvar.py
-->
