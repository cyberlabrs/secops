# Lab 2: A custom Semgrep rule

Code review in kurs-shop has missed the same problem twice: calls to the `requests` library with `verify=False`, which disable TLS certificate verification (MITM). You will write a rule that catches this, tests for the rule, and a job that enforces it on every commit.

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

## The rule and its tests

1. Create `.semgrep/requests.yml` with a rule `id: requests-verify-false` (language `python`, `severity: ERROR`, message of your choice) that finds every `requests.<method>(...)` call with `verify=False`, regardless of argument order.
2. Create a test file `.semgrep/requests.py` with annotations: at least two examples marked `# ruleid: requests-verify-false` and at least two marked `# ok: requests-verify-false` (e.g., without `verify` and with `verify=True`).
3. `semgrep scan --test .semgrep/` must pass.

```bash
semgrep scan --config .semgrep/requests.yml client.py
semgrep scan --test .semgrep/
```

<!-- verify
cd /root/kurs-shop
[ -f .semgrep/requests.yml ] || { echo ".semgrep/requests.yml is missing"; exit 1; }
[ "$(yq '.rules[0].id' .semgrep/requests.yml)" = "requests-verify-false" ] || { echo "the rule does not have the id requests-verify-false"; exit 1; }
[ "$(grep -c '# ruleid: *requests-verify-false' .semgrep/requests.py 2>/dev/null)" -ge 2 ] || { echo "requests.py needs at least two '# ruleid: requests-verify-false' examples"; exit 1; }
[ "$(grep -c '# ok: *requests-verify-false' .semgrep/requests.py 2>/dev/null)" -ge 2 ] || { echo "requests.py needs at least two '# ok: requests-verify-false' examples"; exit 1; }
semgrep scan --test .semgrep/ >/tmp/sgt.txt 2>&1 || { tail -15 /tmp/sgt.txt; echo "the rule tests do not pass"; exit 1; }
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
[ "$n" = "3" ] || { rm -rf $t; echo "the rule finds $n of 3 calls with verify=False"; exit 1; }
n=$(semgrep scan --config .semgrep/requests.yml --json --quiet $t/neg.py | jq '.results | length')
[ "$n" = "0" ] || { rm -rf $t; echo "the rule gives $n false positives (verify=True, a CA path or a different object)"; exit 1; }
rm -rf $t
-->
<!-- hint
```yaml
rules:
  - id: requests-verify-false
    languages: [python]
    severity: ERROR
    message: TLS verification is disabled (verify=False); an attacker on the network can intercept the traffic.
    pattern: requests.$METHOD(..., verify=False, ...)
```
Test file:
```python
import requests

# ruleid: requests-verify-false
requests.get("https://x", verify=False)
# ok: requests-verify-false
requests.get("https://x")
```
An annotation applies to the **next** line.
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

## A job in the pipeline

1. Add a job `sast` (stage `test`) that runs Semgrep with **both** rule sets (`--config /opt/kurs/semgrep-rules --config .semgrep/requests.yml`) only over `client.py` and `app.py`, with `--error` and `--severity ERROR`. The test file `.semgrep/requests.py` must not be scanned as application code.
2. The job now fails because of `client.py`. Fix `client.py` (remove `verify=False`) and be sure to also fix the ERROR findings in `app.py` from the previous lab, or resolve them here the same way.
3. `gitlab-ci-local sast` must pass.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.sast.stage' .gitlab-ci.yml)" = "test" ] || { echo "the sast job does not exist or is not in the test stage"; exit 1; }
s=$(yq '.sast.script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q '/opt/kurs/semgrep-rules' && echo "$s" | grep -q '.semgrep/requests.yml' || { echo "sast needs both --config options (the course's local rules and .semgrep/requests.yml)"; exit 1; }
echo "$s" | grep -q -- '--error' || { echo "sast needs --error"; exit 1; }
grep -q 'verify=False' client.py && { echo "client.py still has verify=False"; exit 1; }
gitlab-ci-local sast > /tmp/gcl.log 2>&1 || { tail -20 /tmp/gcl.log; echo "the sast job fails"; exit 1; }
cp client.py /tmp/client.bak && sed -i 's/timeout=2)/timeout=2, verify=False)/' client.py
gitlab-ci-local sast > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/client.bak client.py
[ $rc -ne 0 ] || { echo "the sast job does not fail when verify=False is put back: the rule is not applied"; exit 1; }
-->
<!-- hint
```yaml
sast:
  stage: test
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --config .semgrep/requests.yml --severity ERROR --error app.py client.py
```
The file `.semgrep/requests.py` intentionally contains `verify=False`; if you scan the whole repo (`.`), add it to `.semgrepignore`.
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
