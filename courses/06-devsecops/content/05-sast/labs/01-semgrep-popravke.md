# Lab 1: Semgrep nalazi i popravke

Semgrep sa lokalnim pravilima kursa (`/opt/kurs/semgrep-rules/python.yml`) nalazi u `app.py` SQL injection, command injection, nesigurnu deserializaciju, debug mod i hardkodovan ključ. Popravićeš kod tako da nalazi nestanu, a aplikacija i dalje radi.

```bash
cd /root/kurs-shop
cat /opt/kurs/semgrep-rules/python.yml
semgrep scan --config /opt/kurs/semgrep-rules .
```

<!-- setup
set -e
kurs-repo
-->

## Izvještaj u SARIF formatu

Pokreni Semgrep nad repoom sa lokalnim pravilima i sačuvaj rezultat u **SARIF** formatu u `/root/semgrep.sarif`. To je format koji GitLab, GitHub i DefectDojo uvoze.

```bash
semgrep scan --config /opt/kurs/semgrep-rules --sarif --output /root/semgrep.sarif .
jq '.runs[0].results[] | {rule: .ruleId, line: .locations[0].physicalLocation.region.startLine}' /root/semgrep.sarif
```

<!-- verify
[ -s /root/semgrep.sarif ] || { echo "/root/semgrep.sarif ne postoji"; exit 1; }
jq -e '.version == "2.1.0" and (.runs[0].tool.driver.name | test("semgrep"; "i"))' /root/semgrep.sarif >/dev/null 2>&1 || { echo "semgrep.sarif nije SARIF izvještaj Semgrepa"; exit 1; }
jq -e '[.runs[0].results[].ruleId | select(endswith("sqli-string-query"))] | length > 0' /root/semgrep.sarif >/dev/null || { echo "izvještaj nema SQL injection nalaz: skeniraj app.py sa /opt/kurs/semgrep-rules"; exit 1; }
-->
<!-- hint
`--sarif --output <fajl>` piše SARIF u fajl, a na ekran i dalje ide čitljiv ispis.
-->
<!-- solution
cd /root/kurs-shop && semgrep scan --config /opt/kurs/semgrep-rules --sarif --output /root/semgrep.sarif . >/dev/null 2>&1
-->

## Popravi injection i deserializaciju

Popravi tri ERROR nalaza u `app.py`:

1. **SQL injection** u `/products`: parametrizovan upit (`?` i torka parametara), uz isti `LIKE` filter.
2. **Command injection** u `/ping`: bez `shell=True`, argumenti kao lista (`["ping", "-c", "1", host]`).
3. **Deserializacija** u `/import`: `yaml.safe_load`.

Aplikacija mora i dalje raditi: `/products?q=ka` vraća kafu i kakao.

```bash
semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error .
/opt/app-venv/bin/python -c "import tests.test_app as t; t.test_health(); t.test_products(); print('ok')"
```

<!-- verify
cd /root/kurs-shop
semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --quiet app.py >/tmp/sg.txt 2>&1 || { cat /tmp/sg.txt | tail -20; echo "ostali su ERROR nalazi"; exit 1; }
grep -q 'shell=True' app.py && { echo "app.py i dalje koristi shell=True"; exit 1; }
grep -q 'yaml.safe_load' app.py || { echo "/import ne koristi yaml.safe_load"; exit 1; }
cd /root/kurs-shop && /opt/app-venv/bin/python - <<'EOF' || exit 1
import os, tempfile
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "v.db")
import app as m
c = m.app.test_client()
r = c.get("/products?q=ka")
assert r.status_code == 200, "/products ne radi"
names = {row[1] for row in r.json}
assert names == {"kafa", "kakao"}, f"/products?q=ka vraća {names}"
r = c.get("/products", query_string={"q": "x' OR 1=1 --"})
assert r.status_code == 200 and r.json == [], "SQL injection i dalje radi (OR 1=1 vraća redove)"
r = c.post("/import", data="!!python/object/apply:os.system ['true']")
assert r.status_code >= 400 or r.json is None or "os" not in str(r.json), "/import i dalje prihvata Python objekte"
r = c.post("/import", data="a: 1\nb: [x, y]")
assert r.status_code == 200 and r.json == {"a": 1, "b": ["x", "y"]}, "/import više ne radi za običan YAML"
EOF
-->
<!-- hint
```python
rows = get_db().execute(
    "SELECT id, name, price FROM products WHERE name LIKE ?", (f"%{q}%",)
).fetchall()

out = subprocess.check_output(["ping", "-c", "1", host])

cfg = yaml.safe_load(request.data)
```
F-string u parametru je u redu: korisnički unos je i dalje **vrijednost**, a ne dio SQL-a.
-->
<!-- solution
cd /root/kurs-shop
python3 - <<'EOF'
p = "app.py"; s = open(p).read()
s = s.replace('''get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE '%{q}%'").fetchall()''',
              '''get_db().execute("SELECT id, name, price FROM products WHERE name LIKE ?", (f"%{q}%",)).fetchall()''')
s = s.replace('''subprocess.check_output("ping -c 1 " + host, shell=True)''', '''subprocess.check_output(["ping", "-c", "1", host])''')
s = s.replace('''yaml.load(request.data, Loader=yaml.Loader)''', '''yaml.safe_load(request.data)''')
open(p, "w").write(s)
EOF
-->

## Debug mod i tajni ključ

Ostala su dva WARNING nalaza. Popravi ih tako da konfiguracija dolazi iz okruženja:

- `SECRET_KEY` se čita iz varijable okruženja `SECRET_KEY` (`os.environ[...]` ili `os.environ.get(...)`),
- debug mod je uključen samo ako je `FLASK_DEBUG=1`.

Na kraju cijeli sken mora biti čist: `semgrep scan --config /opt/kurs/semgrep-rules --error .` vraća 0. Ne koristi `# nosemgrep`: ovo su pravi problemi, ne lažni pozitivi.

<!-- verify
cd /root/kurs-shop
grep -q 'nosemgrep' app.py && { echo "ne koristi nosemgrep: popravi kod"; exit 1; }
semgrep scan --config /opt/kurs/semgrep-rules --error --quiet . >/tmp/sg.txt 2>&1 || { tail -20 /tmp/sg.txt; echo "sken nije čist"; exit 1; }
grep -q 'kurs-shop-dev-secret' app.py && { echo "stari SECRET_KEY je i dalje u kodu"; exit 1; }
grep -q 'SECRET_KEY' app.py && grep -q 'environ' app.py || { echo "SECRET_KEY treba čitati iz okruženja"; exit 1; }
grep -q 'FLASK_DEBUG' app.py || { echo "debug mod treba zavisiti od FLASK_DEBUG"; exit 1; }
cd /root/kurs-shop && SECRET_KEY=test /opt/app-venv/bin/python -c "import tests.test_app as t; t.test_health(); t.test_products()" || { echo "testovi aplikacije ne prolaze"; exit 1; }
-->
<!-- hint
```python
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())
...
app.run(host="127.0.0.1", port=8080, debug=os.environ.get("FLASK_DEBUG") == "1")
```
Pravilo traži doslovno `debug=True`, pa izraz koji zavisi od okruženja prolazi. Pravilo je namjerno usko; u pravim pravilima pažljivo biraš između preciznosti i pokrivenosti.
-->
<!-- solution
cd /root/kurs-shop
python3 - <<'EOF'
p = "app.py"; s = open(p).read()
s = s.replace('app.config["SECRET_KEY"] = "kurs-shop-dev-secret"', 'app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())')
s = s.replace('app.run(host="127.0.0.1", port=8080, debug=True)', 'app.run(host="127.0.0.1", port=8080, debug=os.environ.get("FLASK_DEBUG") == "1")')
open(p, "w").write(s)
EOF
-->
