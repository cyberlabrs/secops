# Lab 1: Izlaz modela je nepovjerljiv ulaz

Aplikacija za podršku šalje tikete LLM-u, a model vraća JSON sa kategorijom, prioritetom i sažetkom koji se prikazuje agentima u web aplikaciji. Model ponekad vrati neispravan JSON, izmisli kategoriju, doda polja ili u sažetak ubaci HTML iz teksta tiketa. Izlaz modela treba tretirati kao **nepovjerljiv ulaz** (OWASP LLM05: Improper Output Handling): validirati ga i bezbjedno prikazati.

Snimljeni odgovori modela su u `/root/izlaz/odgovori.jsonl` (jedan odgovor po liniji, polje `odgovor` je sirov tekst modela).

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

Napiši `/root/izlaz/sema.json` (JSON Schema, draft 2020-12) za odgovor modela:

- objekat sa **tačno** poljima `kategorija`, `prioritet`, `sazetak` (sva obavezna, druga polja zabranjena),
- `kategorija`: jedno od `racun`, `tehnicki`, `reklamacija`, `ostalo`,
- `prioritet`: cijeli broj od 1 do 5,
- `sazetak`: string od 1 do 300 znakova.

<!-- verify
f=/root/izlaz/sema.json
jq -e . $f >/dev/null 2>&1 || { echo "$f ne postoji ili nije JSON"; exit 1; }
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
    if not v.is_valid(o): sys.exit(f"šema odbija ispravan odgovor: {o}")
for o in bad:
    if v.is_valid(o): sys.exit(f"šema prihvata neispravan odgovor: {str(o)[:80]}")
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
`additionalProperties: false` je ključan: polje `akcija` koje je model „smislio“ ne smije stići do koda koji bi ga mogao izvršiti.
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

Napiši `/root/izlaz/validiraj.py` (pokreće se sa `/opt/ai/bin/python`) koji čita `odgovori.jsonl` i za svaki tiket upiše red u `/root/izlaz/rezultat.csv` (zaglavlje `tiket,status,razlog`):

- `status` je `ok` ako je cijeli `odgovor` ispravan JSON (bez teksta oko njega) koji prolazi šemu, inače `odbijen`,
- `razlog` je prazan za `ok`, a za `odbijen` jedno od: `nije_json` (ne parsira se kao JSON) ili `sema` (JSON, ali ne prolazi šemu).

Odbijeni odgovor se ne „popravlja“ pogađanjem (npr. vađenjem JSON-a iz teksta): ide na ponovni zahtjev ili čovjeku.

<!-- verify
cd /root/izlaz
[ -f validiraj.py ] || { echo "nema validiraj.py"; exit 1; }
rm -f rezultat.csv; /opt/ai/bin/python validiraj.py >/dev/null 2>&1 || { echo "validiraj.py vraća grešku"; exit 1; }
want='tiket,status,razlog
T-1,ok,
T-2,odbijen,nije_json
T-3,odbijen,sema
T-4,odbijen,sema
T-5,odbijen,sema
T-6,ok,
T-7,odbijen,sema
T-8,ok,'
[ "$(tr -d '\r' < rezultat.csv 2>/dev/null)" = "$want" ] || { echo "rezultat.csv nije tačan:"; cat rezultat.csv 2>/dev/null; exit 1; }
cp odgovori.jsonl /tmp/o.bak
echo '{"tiket": "T-9", "odgovor": "{\"kategorija\": \"racun\", \"prioritet\": 2, \"sazetak\": \"ok\", \"sql\": \"x\"}"}' >> odgovori.jsonl
/opt/ai/bin/python validiraj.py >/dev/null 2>&1; r=$(grep '^T-9,' rezultat.csv | tr -d '\r'); cp /tmp/o.bak odgovori.jsonl; /opt/ai/bin/python validiraj.py >/dev/null 2>&1
[ "$r" = "T-9,odbijen,sema" ] || { echo "validator ne koristi sema.json za nove odgovore (T-9 sa dodatnim poljem)"; exit 1; }
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

## Bezbjedan prikaz

Sažetak se prikazuje u web aplikaciji. Napiši `/root/izlaz/prikaz.py` koji za sve `ok` odgovore napravi `/root/izlaz/tiketi.html`: za svaki tiket jedan `<li>` u obliku `<li data-tiket="T-1">[racun/2] sažetak</li>`, pri čemu je sažetak **HTML-escapovan** (`html.escape`), tako da se HTML iz teksta tiketa prikaže kao tekst, a ne izvrši.

<!-- verify
cd /root/izlaz
[ -f prikaz.py ] || { echo "nema prikaz.py"; exit 1; }
rm -f tiketi.html; /opt/ai/bin/python prikaz.py >/dev/null 2>&1 || { echo "prikaz.py vraća grešku"; exit 1; }
h=$(cat tiketi.html 2>/dev/null)
[ "$(grep -o '<li data-tiket="T-[0-9]*">' tiketi.html | tr '\n' ' ')" = '<li data-tiket="T-1"> <li data-tiket="T-6"> <li data-tiket="T-8"> ' ] || { echo "tiketi.html treba <li> samo za ok tikete T-1, T-6, T-8"; exit 1; }
echo "$h" | grep -q '<i>hitno</i>\|<a href' && { echo "HTML iz sažetka nije escapovan"; exit 1; }
echo "$h" | grep -q '&lt;i&gt;hitno&lt;/i&gt;' && echo "$h" | grep -q '&lt;a href=&quot;http://primjer.ba&quot;&gt;' || { echo "sažetak T-6 treba biti escapovan (&lt;i&gt;…)"; exit 1; }
echo "$h" | grep -q '<li data-tiket="T-1">\[racun/2\] Kupac traži kopiju računa za septembar.</li>' || { echo "format reda nije tačan: <li data-tiket=\"T-1\">[racun/2] sažetak</li>"; exit 1; }
-->
<!-- hint
```python
import html
f'<li data-tiket="{html.escape(t)}">[{k}/{p}] {html.escape(s)}</li>'
```
U pravoj aplikaciji isto radi templating engine sa uključenim auto-escapeom (Jinja2 autoescape, React po defaultu), plus Content-Security-Policy kao druga linija odbrane.
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
