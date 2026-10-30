# Lab 1: Čuvar poziva alata za agenta

Agent za podršku kurs-shopa može pozivati alate: pretragu baze znanja, SQL upite i slanje e-pošte. Model odlučuje **šta** bi pozvao, ali **da li** će se poziv izvršiti mora odlučiti deterministički kod izvan modela (OWASP LLM06: Excessive Agency). Napisaćeš takav **policy guard**: svaki predloženi poziv dobija odluku `dozvoli`, `odbij` ili `odobrenje` (traži potvrdu čovjeka).

Predlozi modela su u `/root/agent/predlozi.jsonl`.

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

## Politika

Napiši `/root/agent/cuvar.py` sa funkcijom `odluka(predlog) -> str` i pokretanjem koje za sve predloge upiše `/root/agent/odluke.csv` (zaglavlje `id,odluka`). Politika:

1. Dozvoljeni su samo alati `pretraga_znanja`, `sql_citanje` i `posalji_email`; svaki drugi alat: `odbij`.
2. Argumenti moraju biti **tačno** očekivani (`pretraga_znanja`: `upit`; `sql_citanje`: `upit`; `posalji_email`: `prima`, `naslov`, `tekst`); višak ili manjak argumenata: `odbij`.
3. `sql_citanje`: jedna naredba (bez `;`), mora počinjati sa `SELECT` (bez obzira na velika slova), čita samo tabele `narudzbe` i `proizvodi` (tabela iza `FROM` mora biti jedna od njih); inače `odbij`.
4. `posalji_email`: primalac samo iz domene `@kurs-shop.ba`, inače `odbij`; i kad je domena dobra, slanje traži potvrdu čovjeka: `odobrenje`.
5. Sve ostalo što prođe pravila: `dozvoli`.

<!-- verify
cd /root/agent
[ -f cuvar.py ] || { echo "nema cuvar.py"; exit 1; }
rm -f odluke.csv; /opt/ai/bin/python cuvar.py >/dev/null 2>&1 || { echo "cuvar.py vraća grešku"; exit 1; }
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
[ "$(tr -d '\r' < odluke.csv 2>/dev/null)" = "$want" ] || { echo "odluke.csv nije tačan:"; cat odluke.csv 2>/dev/null; exit 1; }
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
    if g != w: sys.exit(f"odluka({p}) = {g}, očekivano {w}")
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
Pazi na domenu: `x@kurs-shop.ba.zlo.com` sadrži `@kurs-shop.ba`, ali ne završava njime. Koristi `endswith("@kurs-shop.ba")`.

U produkciji ovaj čuvar radi uz još jače kontrole: alat se izvršava sa nalogom koji u bazi ima samo `SELECT` na te dvije tabele (najmanje privilegije), pa i greška u čuvaru ne može promijeniti podatke.
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

## Revizijski trag

Svaka odluka čuvara mora ostaviti trag za istragu. Proširi `cuvar.py` tako da pored `odluke.csv` piše i `/root/agent/audit.jsonl`: jedan JSON po predlogu sa poljima `id`, `alat`, `odluka`, `vrijeme` (UTC, ISO 8601) i `argumenti_hash` (SHA-256 JSON-a argumenata sa sortiranim ključevima, a ne same argumente, jer tekst e-pošte može sadržati lične podatke).

<!-- verify
cd /root/agent
rm -f audit.jsonl; /opt/ai/bin/python cuvar.py >/dev/null 2>&1
[ "$(grep -c . audit.jsonl 2>/dev/null)" = "10" ] || { echo "audit.jsonl treba 10 zapisa"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import json, hashlib, sys, csv
from datetime import datetime
odl = {r["id"]: r["odluka"] for r in csv.DictReader(open("/root/agent/odluke.csv"))}
pred = {str(json.loads(l)["id"]): json.loads(l) for l in open("/root/agent/predlozi.jsonl") if l.strip()}
for l in open("/root/agent/audit.jsonl"):
    a = json.loads(l); i = str(a.get("id"))
    if set(a) != {"id", "alat", "odluka", "vrijeme", "argumenti_hash"}: sys.exit(f"zapis {i}: polja treba tačno id, alat, odluka, vrijeme, argumenti_hash")
    if a["odluka"] != odl[i] or a["alat"] != pred[i]["alat"]: sys.exit(f"zapis {i}: alat ili odluka ne odgovara")
    h = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True).encode()).hexdigest()
    h2 = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    h3 = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    h4 = hashlib.sha256(json.dumps(pred[i]["argumenti"], sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    if a["argumenti_hash"] not in (h, h2, h3, h4): sys.exit(f"zapis {i}: argumenti_hash nije SHA-256 JSON-a argumenata sa sortiranim ključevima")
    t = datetime.fromisoformat(a["vrijeme"].replace("Z", "+00:00"))
    if t.utcoffset() is None or t.utcoffset().total_seconds() != 0: sys.exit(f"zapis {i}: vrijeme treba biti u UTC")
if "Vaša narudžba" in open("/root/agent/audit.jsonl").read(): sys.exit("audit sadrži tekst argumenata")
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
