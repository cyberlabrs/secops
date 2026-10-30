# Lab 1: Vulnerable dependencies and risk acceptance

Kurs-shop uses old versions of Python packages (`requirements.txt`) and frontend libraries (`frontend/package-lock.json`). **osv-scanner** compares them against the OSV database (a local copy in the lab, `--offline`).

You will upgrade the Python dependencies. The frontend team needs two weeks to migrate to a new version of axios, so for its findings you record a **temporary risk acceptance** with a reason and an expiry.

```bash
cd /root/kurs-shop
osv-scanner scan source --offline -r .
```

<!-- setup
set -e
kurs-repo
-->

## Report

Scan the whole repo and save the result in JSON format to `/root/osv.json`. Then write the name of the package (in lowercase) with the most known vulnerabilities to `/root/najgori.txt` (`najgori` = worst).

```bash
osv-scanner scan source --offline -r . --format json --output /root/osv.json
jq -r '.results[].packages[] | "\(.vulnerabilities | length)\t\(.package.name) \(.package.version)"' /root/osv.json | sort -rn
```

<!-- verify
[ -s /root/osv.json ] || { echo "/root/osv.json does not exist"; exit 1; }
jq -e '[.results[].source.path] | any(endswith("requirements.txt")) and any(endswith("package-lock.json"))' /root/osv.json >/dev/null 2>&1 || { echo "osv.json needs results for requirements.txt and frontend/package-lock.json (scan recursively)"; exit 1; }
want=$(jq -r '[.results[].packages[] | {n: (.package.name | ascii_downcase), c: (.vulnerabilities | length)}] | max_by(.c) | .n' /root/osv.json)
[ "$(tr -d ' \n' < /root/najgori.txt 2>/dev/null | tr A-Z a-z)" = "$want" ] || { echo "najgori.txt does not contain the package with the most vulnerabilities"; exit 1; }
-->
<!-- hint
`-r .` (`--recursive`) finds lockfiles in subdirectories. In the JSON output each `.results[]` element is one lockfile (`.source.path`), and `.packages[]` are the packages with findings.
-->
<!-- solution
cd /root/kurs-shop
osv-scanner scan source --offline -r . --format json --output /root/osv.json >/dev/null 2>&1 || true
jq -r '[.results[].packages[] | {n: (.package.name | ascii_downcase), c: (.vulnerabilities | length)}] | max_by(.c) | .n' /root/osv.json > /root/najgori.txt
-->

## Upgrade the Python dependencies

Upgrade all packages in `requirements.txt` to versions without known vulnerabilities. Keep the same list of packages and exactly pinned versions (`==`), so that the build is reproducible.

```bash
osv-scanner scan source --offline -L requirements.txt
```

The **Fixed Version** column shows the lowest version that resolves an individual finding; a new version sometimes has findings of its own, so repeat the scan until it is clean.

<!-- verify
cd /root/kurs-shop
for p in flask werkzeug jinja2 requests pyyaml gunicorn; do
  grep -iEq "^$p==[0-9]" requirements.txt || { echo "$p is not pinned with == in requirements.txt"; exit 1; }
done
[ "$(grep -cvE '^\s*(#|$)' requirements.txt)" = "6" ] || { echo "requirements.txt must contain exactly 6 packages"; exit 1; }
osv-scanner scan source --offline -L requirements.txt >/tmp/osv.txt 2>&1 || { grep PyPI /tmp/osv.txt | awk -F'|' '{print $5,$6,"→",$7}' | sort -u | head; echo "requirements.txt still has vulnerable versions"; exit 1; }
-->
<!-- hint
Start from the Fixed Version column, e.g. `PyYAML==6.0.3`, `jinja2==3.1.6`, `gunicorn==23.0.0`. For `flask`, `werkzeug` and `requests` take the newest version from the column and scan again.

In a real project Renovate or Dependabot does this: they open an MR with the upgrade, and the tests in the pipeline check that the application still works.
-->
<!-- solution
cd /root/kurs-shop
printf 'flask==3.1.3\nwerkzeug==3.1.9\njinja2==3.1.6\nrequests==2.33.0\nPyYAML==6.0.3\ngunicorn==23.0.0\n' > requirements.txt
-->

## Risk acceptance with an expiry

For the frontend findings, create `osv-scanner.toml` in the repo root with one `[[IgnoredVulns]]` entry for **each** current finding in `frontend/package-lock.json`:

- the finding's `id` (the first ID in the group, the one osv-scanner displays),
- a `reason` that explains the decision (at least a few words, e.g. who approved it and when the migration is due),
- an `ignoreUntil` at most **30 days** from today (format `2026-11-10T00:00:00Z`).

Findings in Python packages must not be ignored. Finally, add a job `sca` (stage `test`): `osv-scanner scan source --offline -r . --config osv-scanner.toml`. The pipeline must pass.

```bash
osv-scanner scan source --offline -L frontend/package-lock.json --format json \
  | jq -r '.results[].packages[].groups[].ids[0]'
```

<!-- verify
cd /root/kurs-shop
[ -f osv-scanner.toml ] || { echo "osv-scanner.toml is missing in the repo root"; exit 1; }
osv-scanner scan source --offline -L frontend/package-lock.json --config osv-scanner.toml >/tmp/o.txt 2>&1 || { echo "not all frontend findings are covered in osv-scanner.toml"; exit 1; }
python3 - <<'EOF' || exit 1
import tomllib, datetime, json, subprocess, sys
cfg = tomllib.load(open("osv-scanner.toml", "rb"))
items = cfg.get("IgnoredVulns", [])
now = datetime.datetime.now(datetime.timezone.utc)
for it in items:
    i = it.get("id", "?")
    if len(str(it.get("reason", "")).split()) < 3:
        sys.exit(f"{i}: reason must explain the decision (at least three words)")
    u = it.get("ignoreUntil")
    if u is None:
        sys.exit(f"{i}: no ignoreUntil (an exception without an expiry is a permanently disabled control)")
    if isinstance(u, datetime.date) and not isinstance(u, datetime.datetime):
        u = datetime.datetime.combine(u, datetime.time(), datetime.timezone.utc)
    if u.tzinfo is None:
        u = u.replace(tzinfo=datetime.timezone.utc)
    if u <= now or u > now + datetime.timedelta(days=30, hours=12):
        sys.exit(f"{i}: ignoreUntil must be within the next 30 days")
py = json.loads(subprocess.run(["osv-scanner", "scan", "source", "--offline", "-L", "/opt/kurs/kurs-shop/requirements.txt", "--format", "json"], capture_output=True, text=True).stdout or "{}")
pyids = {x for r in py.get("results", []) for p in r["packages"] for g in p["groups"] for x in g["ids"]}
bad = pyids & {it.get("id") for it in items}
if bad:
    sys.exit("findings in Python packages are ignored too: " + ", ".join(sorted(bad)))
EOF
yq '.sca.script | join(" ")' .gitlab-ci.yml | grep -q 'osv-scanner' || { echo "no sca job with osv-scanner"; exit 1; }
[ "$(yq '.sca.allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "sca must not have allow_failure"; exit 1; }
gitlab-ci-local sca > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the sca job fails"; exit 1; }
-->
<!-- hint
```bash
until=$(date -u -d '+14 days' +%Y-%m-%dT00:00:00Z)
osv-scanner scan source --offline -L frontend/package-lock.json --format json \
  | jq -r --arg u "$until" '.results[].packages[].groups[].ids[0] |
      "[[IgnoredVulns]]\nid = \"\(.)\"\nignoreUntil = \(\$u)\nreason = \"Frontend migration to axios 1.x by sprint 42, approved by AppSec\"\n"' > osv-scanner.toml
```
`ignoreUntil` is a TOML date, without quotes. When the expiry passes, the finding reappears and the pipeline fails, which is the goal.
-->
<!-- solution
cd /root/kurs-shop
until=$(date -u -d '+14 days' +%Y-%m-%dT00:00:00Z)
osv-scanner scan source --offline -L frontend/package-lock.json --format json 2>/dev/null \
  | jq -r --arg u "$until" '.results[].packages[].groups[].ids[0] | "[[IgnoredVulns]]\nid = \"\(.)\"\nignoreUntil = \($u)\nreason = \"Frontend migracija na axios 1.x do sprinta 42, odobrio AppSec\"\n"' > osv-scanner.toml
yq -i '.sca = {"stage": "test", "script": ["osv-scanner scan source --offline -r . --config osv-scanner.toml"]}' .gitlab-ci.yml
-->
