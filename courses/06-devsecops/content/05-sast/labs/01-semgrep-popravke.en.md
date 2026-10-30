# Lab 1: Semgrep findings and fixes

Semgrep with the course's local rules (`/opt/kurs/semgrep-rules/python.yml`) finds SQL injection, command injection, insecure deserialization, debug mode and a hardcoded key in `app.py`. You will fix the code so the findings disappear while the application keeps working.

```bash
cd /root/kurs-shop
cat /opt/kurs/semgrep-rules/python.yml
semgrep scan --config /opt/kurs/semgrep-rules .
```

<!-- setup
set -e
kurs-repo
-->

## Report in SARIF format

Run Semgrep over the repo with the local rules and save the result in **SARIF** format to `/root/semgrep.sarif`. This is the format that GitLab, GitHub and DefectDojo import.

```bash
semgrep scan --config /opt/kurs/semgrep-rules --sarif --output /root/semgrep.sarif .
jq '.runs[0].results[] | {rule: .ruleId, line: .locations[0].physicalLocation.region.startLine}' /root/semgrep.sarif
```

<!-- verify
[ -s /root/semgrep.sarif ] || { echo "/root/semgrep.sarif does not exist"; exit 1; }
jq -e '.version == "2.1.0" and (.runs[0].tool.driver.name | test("semgrep"; "i"))' /root/semgrep.sarif >/dev/null 2>&1 || { echo "semgrep.sarif is not a Semgrep SARIF report"; exit 1; }
jq -e '[.runs[0].results[].ruleId | select(endswith("sqli-string-query"))] | length > 0' /root/semgrep.sarif >/dev/null || { echo "the report has no SQL injection finding: scan app.py with /opt/kurs/semgrep-rules"; exit 1; }
-->
<!-- hint
`--sarif --output <file>` writes SARIF to the file, while readable output still goes to the screen.
-->
<!-- solution
cd /root/kurs-shop && semgrep scan --config /opt/kurs/semgrep-rules --sarif --output /root/semgrep.sarif . >/dev/null 2>&1
-->

## Fix the injections and the deserialization

Fix the three ERROR findings in `app.py`:

1. **SQL injection** in `/products`: a parameterized query (`?` and a tuple of parameters), with the same `LIKE` filter.
2. **Command injection** in `/ping`: no `shell=True`, arguments as a list (`["ping", "-c", "1", host]`).
3. **Deserialization** in `/import`: `yaml.safe_load`.

The application must keep working: `/products?q=ka` returns coffee and cocoa (`kafa` and `kakao`).

```bash
semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error .
/opt/app-venv/bin/python -c "import tests.test_app as t; t.test_health(); t.test_products(); print('ok')"
```

<!-- verify
cd /root/kurs-shop
semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --quiet app.py >/tmp/sg.txt 2>&1 || { cat /tmp/sg.txt | tail -20; echo "ERROR findings remain"; exit 1; }
grep -q 'shell=True' app.py && { echo "app.py still uses shell=True"; exit 1; }
grep -q 'yaml.safe_load' app.py || { echo "/import does not use yaml.safe_load"; exit 1; }
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
An f-string in the parameter is fine: the user input is still a **value**, not part of the SQL.
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

## Debug mode and the secret key

Two WARNING findings remain. Fix them so that the configuration comes from the environment:

- `SECRET_KEY` is read from the `SECRET_KEY` environment variable (`os.environ[...]` or `os.environ.get(...)`),
- debug mode is enabled only if `FLASK_DEBUG=1`.

At the end the whole scan must be clean: `semgrep scan --config /opt/kurs/semgrep-rules --error .` returns 0. Don't use `# nosemgrep`: these are real problems, not false positives.

<!-- verify
cd /root/kurs-shop
grep -q 'nosemgrep' app.py && { echo "don't use nosemgrep: fix the code"; exit 1; }
semgrep scan --config /opt/kurs/semgrep-rules --error --quiet . >/tmp/sg.txt 2>&1 || { tail -20 /tmp/sg.txt; echo "the scan is not clean"; exit 1; }
grep -q 'kurs-shop-dev-secret' app.py && { echo "the old SECRET_KEY is still in the code"; exit 1; }
grep -q 'SECRET_KEY' app.py && grep -q 'environ' app.py || { echo "SECRET_KEY must be read from the environment"; exit 1; }
grep -q 'FLASK_DEBUG' app.py || { echo "debug mode must depend on FLASK_DEBUG"; exit 1; }
cd /root/kurs-shop && SECRET_KEY=test /opt/app-venv/bin/python -c "import tests.test_app as t; t.test_health(); t.test_products()" || { echo "the application tests do not pass"; exit 1; }
-->
<!-- hint
```python
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())
...
app.run(host="127.0.0.1", port=8080, debug=os.environ.get("FLASK_DEBUG") == "1")
```
The rule looks for a literal `debug=True`, so an expression that depends on the environment passes. The rule is intentionally narrow; in real rules you carefully choose between precision and coverage.
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
