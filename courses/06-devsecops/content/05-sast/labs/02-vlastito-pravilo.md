# Lab 2: Vlastito Semgrep pravilo

Code review je u kurs-shopu dva puta propustio isti problem: pozive `requests` biblioteke sa `verify=False`, koji isključuju provjeru TLS certifikata (MITM). Napisaćeš pravilo koje to hvata, testove za pravilo i job koji ga provodi na svakom commitu.

```bash
cd /root/kurs-shop
cat client.py
```

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
cat > client.py <<'EOF'
"""Klijent za kursnu listu i interni katalog."""
import requests

RATES_URL = "https://api.kurs-shop.ba/rates"


def fetch_rates():
    return requests.get(RATES_URL, verify=False, timeout=5).json()


def push_order(order):
    return requests.post("https://katalog.kurs-shop.ba/orders", json=order, timeout=5, verify=False)


def health():
    return requests.get("https://katalog.kurs-shop.ba/health", timeout=2).ok
EOF
git add client.py && git commit -qm "Klijent za kursnu listu"
-->

## Pravilo i testovi

1. Napravi `.semgrep/requests.yml` sa pravilom `id: requests-verify-false` (jezik `python`, `severity: ERROR`, poruka po izboru) koje pronalazi svaki poziv `requests.<metoda>(...)` sa `verify=False`, bez obzira na redoslijed argumenata.
2. Napravi test fajl `.semgrep/requests.py` sa anotacijama: barem dva primjera označena `# ruleid: requests-verify-false` i barem dva označena `# ok: requests-verify-false` (npr. bez `verify` i sa `verify=True`).
3. `semgrep scan --test .semgrep/` mora proći.

```bash
semgrep scan --config .semgrep/requests.yml client.py
semgrep scan --test .semgrep/
```

<!-- verify
cd /root/kurs-shop
[ -f .semgrep/requests.yml ] || { echo "nema .semgrep/requests.yml"; exit 1; }
[ "$(yq '.rules[0].id' .semgrep/requests.yml)" = "requests-verify-false" ] || { echo "pravilo nema id requests-verify-false"; exit 1; }
[ "$(grep -c '# ruleid: *requests-verify-false' .semgrep/requests.py 2>/dev/null)" -ge 2 ] || { echo "requests.py treba barem dva '# ruleid: requests-verify-false' primjera"; exit 1; }
[ "$(grep -c '# ok: *requests-verify-false' .semgrep/requests.py 2>/dev/null)" -ge 2 ] || { echo "requests.py treba barem dva '# ok: requests-verify-false' primjera"; exit 1; }
semgrep scan --test .semgrep/ >/tmp/sgt.txt 2>&1 || { tail -15 /tmp/sgt.txt; echo "testovi pravila ne prolaze"; exit 1; }
t=$(mktemp -d)
cat > $t/poz.py <<'EOF'
import requests
requests.get("https://a", verify=False)
requests.post("https://a", verify=False, json={})
requests.request("GET", "https://a", timeout=3, verify=False)
EOF
cat > $t/neg.py <<'EOF'
import requests
requests.get("https://a")
requests.get("https://a", verify=True)
requests.get("https://a", verify="/etc/ssl/ca.pem")
other.get("https://a", verify=False)
EOF
n=$(semgrep scan --config .semgrep/requests.yml --json --quiet $t/poz.py | jq '.results | length')
[ "$n" = "3" ] || { rm -rf $t; echo "pravilo nalazi $n od 3 poziva sa verify=False"; exit 1; }
n=$(semgrep scan --config .semgrep/requests.yml --json --quiet $t/neg.py | jq '.results | length')
[ "$n" = "0" ] || { rm -rf $t; echo "pravilo daje $n lažnih pozitiva (verify=True, CA putanja ili drugi objekat)"; exit 1; }
rm -rf $t
-->
<!-- hint
```yaml
rules:
  - id: requests-verify-false
    languages: [python]
    severity: ERROR
    message: TLS provjera je isključena (verify=False); napadač na mreži može presresti saobraćaj.
    pattern: requests.$METHOD(..., verify=False, ...)
```
Test fajl:
```python
import requests

# ruleid: requests-verify-false
requests.get("https://x", verify=False)
# ok: requests-verify-false
requests.get("https://x")
```
Anotacija se odnosi na **sljedeći** red.
-->
<!-- solution
cd /root/kurs-shop
mkdir -p .semgrep
cat > .semgrep/requests.yml <<'EOF'
rules:
  - id: requests-verify-false
    languages: [python]
    severity: ERROR
    message: TLS provjera je isključena (verify=False); napadač na mreži može presresti saobraćaj.
    metadata:
      cwe: "CWE-295: Improper Certificate Validation"
    pattern: requests.$METHOD(..., verify=False, ...)
EOF
cat > .semgrep/requests.py <<'EOF'
import requests

# ruleid: requests-verify-false
requests.get("https://x", verify=False)
# ruleid: requests-verify-false
requests.post("https://x", verify=False, json={})
# ok: requests-verify-false
requests.get("https://x")
# ok: requests-verify-false
requests.get("https://x", verify=True)
EOF
-->

## Job u pipelineu

1. Dodaj job `sast` (faza `test`) koji pokreće Semgrep sa **oba** skupa pravila (`--config /opt/kurs/semgrep-rules --config .semgrep/requests.yml`) samo nad `client.py` i `app.py`, sa `--error` i `--severity ERROR`. Test fajl `.semgrep/requests.py` ne smije se skenirati kao kod aplikacije.
2. Job sada pada zbog `client.py`. Popravi `client.py` (ukloni `verify=False`) i obavezno popravi i ERROR nalaze u `app.py` iz prethodnog laba, ili ih ovdje riješi isto.
3. `gitlab-ci-local sast` mora proći.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.sast.stage' .gitlab-ci.yml)" = "test" ] || { echo "job sast ne postoji ili nije u fazi test"; exit 1; }
s=$(yq '.sast.script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q '/opt/kurs/semgrep-rules' && echo "$s" | grep -q '.semgrep/requests.yml' || { echo "sast treba oba --config (lokalna pravila kursa i .semgrep/requests.yml)"; exit 1; }
echo "$s" | grep -q -- '--error' || { echo "sast treba --error"; exit 1; }
grep -q 'verify=False' client.py && { echo "client.py i dalje ima verify=False"; exit 1; }
gitlab-ci-local sast > /tmp/gcl.log 2>&1 || { tail -20 /tmp/gcl.log; echo "job sast pada"; exit 1; }
cp client.py /tmp/client.bak && sed -i 's/timeout=2)/timeout=2, verify=False)/' client.py
gitlab-ci-local sast > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/client.bak client.py
[ $rc -ne 0 ] || { echo "job sast ne pada kad se vrati verify=False: pravilo se ne primjenjuje"; exit 1; }
-->
<!-- hint
```yaml
sast:
  stage: test
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --config .semgrep/requests.yml --severity ERROR --error app.py client.py
```
Fajl `.semgrep/requests.py` namjerno sadrži `verify=False`; ako skeniraš cijeli repo (`.`), dodaj ga u `.semgrepignore`.
-->
<!-- solution
cd /root/kurs-shop
sed -i 's/, verify=False//; s/verify=False, //' client.py
python3 - <<'EOF'
p = "app.py"; s = open(p).read()
s = s.replace('''get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE '%{q}%'").fetchall()''',
              '''get_db().execute("SELECT id, name, price FROM products WHERE name LIKE ?", (f"%{q}%",)).fetchall()''')
s = s.replace('''subprocess.check_output("ping -c 1 " + host, shell=True)''', '''subprocess.check_output(["ping", "-c", "1", host])''')
s = s.replace('''yaml.load(request.data, Loader=yaml.Loader)''', '''yaml.safe_load(request.data)''')
open(p, "w").write(s)
EOF
yq -i '.sast = {"stage": "test", "script": ["semgrep scan --config /opt/kurs/semgrep-rules --config .semgrep/requests.yml --severity ERROR --error app.py client.py"]}' .gitlab-ci.yml
-->
