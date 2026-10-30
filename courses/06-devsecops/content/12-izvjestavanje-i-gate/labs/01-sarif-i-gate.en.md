# Lab 1: Aggregated reports and a security gate

Every tool in the pipeline produces its own report, but they all speak **SARIF** 2.1.0. Instead of each job deciding on its own when to fail, the tools only produce reports, and a single **security gate** job reads all the SARIF files, applies the policy and the exceptions with expiry dates, and makes the decision.

`/root/kurs-shop/reports/` contains the Semgrep, Trivy, Checkov and gitleaks reports for the current code.

```bash
cd /root/kurs-shop
ls reports/
jq '.runs[0].tool.driver.name, (.runs[0].results | length)' reports/*.sarif
```

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
mkdir -p reports /tmp/ck
semgrep scan --config /opt/kurs/semgrep-rules --sarif --output reports/semgrep.sarif --quiet . >/dev/null 2>&1 || true
trivy fs -q --scanners vuln --format sarif -o reports/trivy.sarif . || true
checkov -d infra --quiet -o sarif --output-file-path /tmp/ck >/dev/null 2>&1 || true
mv /tmp/ck/results_sarif.sarif reports/checkov.sarif
gitleaks git . --report-format sarif --report-path reports/gitleaks.sarif >/dev/null 2>&1 || true
echo "reports/" >> .gitignore
-->

## Summary per tool

A SARIF result doesn't have to have a `level` field. In that case the rule's `defaultConfiguration.level` applies (`.runs[].tool.driver.rules[]`, matched by `ruleId`), and if that doesn't exist either, the level is `warning`.

Create `/root/sazetak.json` (`sazetak` = summary) in this form:

```json
{ "Semgrep OSS": {"error": 4, "warning": 2, "note": 0}, "Trivy": {…}, "Checkov": {…}, "gitleaks": {…} }
```

The key is `tool.driver.name`, and the numbers are results per **effective** level (`error`, `warning`, `note`).

<!-- verify
[ -s /root/sazetak.json ] || { echo "/root/sazetak.json does not exist"; exit 1; }
cd /root/kurs-shop
want=$(jq -s 'map(.runs[] | .tool.driver as $d | ($d.rules // []) as $r | {key: $d.name, value: ([.results[] | (.level // (.ruleId as $id | ($r[] | select(.id == $id) | .defaultConfiguration.level)) // "warning")] | {error: map(select(. == "error")) | length, warning: map(select(. == "warning")) | length, note: map(select(. == "note")) | length})}) | from_entries' reports/*.sarif)
got=$(jq 'map_values({error: (.error // 0), warning: (.warning // 0), note: (.note // 0)})' /root/sazetak.json 2>/dev/null) || { echo "sazetak.json is not valid JSON"; exit 1; }
[ "$(echo "$want" | jq -S -c .)" = "$(echo "$got" | jq -S -c .)" ] || { echo "sazetak.json is not correct; expected keys: $(echo "$want" | jq -c keys)"; exit 1; }
-->
<!-- hint
```bash
jq -s 'map(.runs[] | .tool.driver as $d | ($d.rules // []) as $r |
  {key: $d.name,
   value: ([.results[] | (.level // (.ruleId as $id | ($r[] | select(.id == $id) | .defaultConfiguration.level)) // "warning")]
           | {error: map(select(. == "error")) | length,
              warning: map(select(. == "warning")) | length,
              note: map(select(. == "note")) | length})})
  | from_entries' reports/*.sarif > /root/sazetak.json
```
Semgrep and gitleaks don't write `level` into the result: Semgrep has it in the rule, gitleaks nowhere (so it is `warning`).
-->
<!-- solution
cd /root/kurs-shop
jq -s 'map(.runs[] | .tool.driver as $d | ($d.rules // []) as $r | {key: $d.name, value: ([.results[] | (.level // (.ruleId as $id | ($r[] | select(.id == $id) | .defaultConfiguration.level)) // "warning")] | {error: map(select(. == "error")) | length, warning: map(select(. == "warning")) | length, note: map(select(. == "note")) | length})}) | from_entries' reports/*.sarif > /root/sazetak.json
-->

## The gate script

Write an executable script `ci/security-gate.sh <directory-with-sarif-files> <exceptions.yaml>` (bash, Python or whatever suits you) that:

1. reads all `*.sarif` files from the directory,
2. for every result with effective level `error`, checks whether there is a **valid** exception for its `ruleId`,
3. prints each blocking finding on one line (`ruleId` and file path) and returns 1 if there are any, otherwise 0.

Exceptions format:

```yaml
exceptions:
  - rule: CKV_AWS_18
    reason: Bucket access logging will be introduced with the central log bucket (SEC-311)
    expires: 2026-12-31
```

An exception is valid only if it has a non-empty `reason` and an `expires` date that has not passed. Findings at level `warning` and `note` don't block. A missing exceptions file means "no exceptions".

<!-- verify
g=/root/kurs-shop/ci/security-gate.sh
[ -x $g ] || { echo "$g does not exist or is not executable"; exit 1; }
t=$(mktemp -d); mkdir -p $t/r
mk() { # mk <fajl> <ruleId> <level|-> <defaultLevel|->
  jq -n --arg id "$2" --arg l "$3" --arg d "$4" '{version: "2.1.0", runs: [{tool: {driver: {name: "t", rules: [({id: $id} + (if $d == "-" then {} else {defaultConfiguration: {level: $d}} end))]}}, results: [({ruleId: $id, message: {text: "x"}, locations: [{physicalLocation: {artifactLocation: {uri: "a.py"}}}]} + (if $l == "-" then {} else {level: $l} end))]}]}' > "$1"; }
fut=$(date -d '+20 days' +%Y-%m-%d); past=$(date -d '-1 day' +%Y-%m-%d)
mk $t/r/a.sarif R-ERR error -
$g $t/r $t/nema.yaml > $t/o.txt 2>&1 && { rm -rf $t; echo "the gate passes even though there is an error finding without an exception"; exit 1; }
grep -q 'R-ERR' $t/o.txt || { rm -rf $t; echo "the gate does not print the ruleId of the blocking finding"; exit 1; }
printf 'exceptions:\n  - rule: R-ERR\n    reason: Prihvaćeno do migracije (SEC-1)\n    expires: %s\n' "$fut" > $t/ok.yaml
$g $t/r $t/ok.yaml >/dev/null 2>&1 || { rm -rf $t; echo "the gate fails even though there is a valid exception"; exit 1; }
printf 'exceptions:\n  - rule: R-ERR\n    reason: Prihvaćeno do migracije (SEC-1)\n    expires: %s\n' "$past" > $t/old.yaml
$g $t/r $t/old.yaml >/dev/null 2>&1 && { rm -rf $t; echo "the gate accepts an expired exception"; exit 1; }
printf 'exceptions:\n  - rule: R-ERR\n    reason: ""\n    expires: %s\n' "$fut" > $t/nr.yaml
$g $t/r $t/nr.yaml >/dev/null 2>&1 && { rm -rf $t; echo "the gate accepts an exception without a reason"; exit 1; }
rm -f $t/r/*; mk $t/r/b.sarif R-WARN warning -
$g $t/r $t/nema.yaml >/dev/null 2>&1 || { rm -rf $t; echo "the gate fails on a warning finding"; exit 1; }
rm -f $t/r/*; mk $t/r/c.sarif R-DEF - error
$g $t/r $t/nema.yaml >/dev/null 2>&1 && { rm -rf $t; echo "the gate does not use the rule's defaultConfiguration.level when the result has no level"; exit 1; }
rm -f $t/r/*; mk $t/r/d.sarif R-NONE - -
$g $t/r $t/nema.yaml >/dev/null 2>&1 || { rm -rf $t; echo "a result with no level and no defaultConfiguration is a warning and must not block"; exit 1; }
rm -rf $t
-->
<!-- hint
Python has everything you need (`json`, `datetime`, and you can read the YAML via `yq -o=json`):
```python
#!/usr/bin/env python3
import datetime, glob, json, subprocess, sys
d, exc_file = sys.argv[1], sys.argv[2]
try:
    exc = json.loads(subprocess.run(["yq", "-o=json", ".", exc_file], capture_output=True, text=True, check=True).stdout or "{}") or {}
except subprocess.CalledProcessError:
    exc = {}
today = datetime.date.today()
valid = {e["rule"] for e in exc.get("exceptions", [])
         if str(e.get("reason", "")).strip() and datetime.date.fromisoformat(str(e.get("expires"))[:10]) >= today}
...
```
-->
<!-- solution
mkdir -p /root/kurs-shop/ci
cat > /root/kurs-shop/ci/security-gate.sh <<'EOF'
#!/usr/bin/env python3
"""security-gate.sh <dir-sa-sarif> <izuzeci.yaml>: pada ako postoji error nalaz bez važećeg izuzetka."""
import datetime, glob, json, os, subprocess, sys

d, exc_file = sys.argv[1], sys.argv[2]
exc = {}
if os.path.exists(exc_file):
    exc = json.loads(subprocess.run(["yq", "-o=json", ".", exc_file], capture_output=True, text=True, check=True).stdout or "{}") or {}
today = datetime.date.today()
valid = set()
for e in exc.get("exceptions") or []:
    try:
        ok = str(e.get("reason") or "").strip() and datetime.date.fromisoformat(str(e.get("expires"))[:10]) >= today
    except ValueError:
        ok = False
    if ok:
        valid.add(e.get("rule"))

blocking = []
for f in sorted(glob.glob(os.path.join(d, "*.sarif"))):
    for run in json.load(open(f)).get("runs", []):
        rules = {r.get("id"): r for r in run.get("tool", {}).get("driver", {}).get("rules", []) or []}
        for res in run.get("results", []) or []:
            rid = res.get("ruleId")
            level = res.get("level") or rules.get(rid, {}).get("defaultConfiguration", {}).get("level") or "warning"
            if level == "error" and rid not in valid:
                loc = (res.get("locations") or [{}])[0].get("physicalLocation", {}).get("artifactLocation", {}).get("uri", "?")
                blocking.append(f"{rid}\t{loc}")
for b in blocking:
    print(b)
print(f"blokirajućih nalaza: {len(blocking)}", file=sys.stderr)
sys.exit(1 if blocking else 0)
EOF
chmod +x /root/kurs-shop/ci/security-gate.sh
-->

## Team exceptions and the gate job

The team has decided: the Checkov findings in `infra/` will be addressed next quarter, and everything else must be fixed before release.

1. Create `security-exceptions.yaml` in the repo root with an exception for **every** Checkov rule that currently appears in `reports/checkov.sarif`, with a justification and an expiry of at most 90 days. No rule from other tools may be in the exceptions.
2. Run the gate on `reports/` with those exceptions and save the output (stdout) to `/root/gate.txt`. The gate must still fail (Semgrep and Trivy findings), but the output must not contain any `CKV` rule.
3. Add a `security-gate` job in a new, final `gate` stage that runs `ci/security-gate.sh reports security-exceptions.yaml`.

<!-- verify
cd /root/kurs-shop
[ -f security-exceptions.yaml ] || { echo "security-exceptions.yaml does not exist"; exit 1; }
ck=$(jq -r '[.runs[].results[].ruleId] | unique | .[]' reports/checkov.sarif | sort)
ex=$(yq -r '.exceptions[].rule' security-exceptions.yaml | sort -u)
[ "$ck" = "$ex" ] || { echo "the exceptions must cover exactly the Checkov rules from reports/checkov.sarif (no fewer, no more)"; exit 1; }
python3 - <<'EOF' || exit 1
import datetime, json, subprocess, sys
y = json.loads(subprocess.run(["yq", "-o=json", ".", "security-exceptions.yaml"], capture_output=True, text=True).stdout)
today = datetime.date.today()
for e in y["exceptions"]:
    if len(str(e.get("reason", "")).split()) < 3:
        sys.exit(f"{e.get('rule')}: reason must justify the decision")
    d = datetime.date.fromisoformat(str(e.get("expires"))[:10])
    if d < today or d > today + datetime.timedelta(days=90):
        sys.exit(f"{e.get('rule')}: expires must be within the next 90 days")
EOF
ci/security-gate.sh reports security-exceptions.yaml > /tmp/g.txt 2>/dev/null && { echo "the gate passes, but the Semgrep/Trivy findings are not resolved"; exit 1; }
grep -q 'CKV' /tmp/g.txt && { echo "the gate still blocks on Checkov rules"; exit 1; }
[ -s /root/gate.txt ] && ! grep -q 'CKV' /root/gate.txt && grep -q 'kurs.python' /root/gate.txt || { echo "/root/gate.txt should contain the gate output with exceptions (Semgrep findings, no CKV)"; exit 1; }
[ "$(yq '.stages[-1]' .gitlab-ci.yml)" = "gate" ] || { echo "gate must be the last stage in stages"; exit 1; }
[ "$(yq '.["security-gate"].stage' .gitlab-ci.yml)" = "gate" ] || { echo "the security-gate job is not in the gate stage"; exit 1; }
yq '.["security-gate"].script | join(" ")' .gitlab-ci.yml | grep -q 'security-gate.sh reports security-exceptions.yaml' || { echo "security-gate does not run ci/security-gate.sh reports security-exceptions.yaml"; exit 1; }
-->
<!-- hint
```bash
exp=$(date -d '+60 days' +%Y-%m-%d)
jq -r --arg e "$exp" '[.runs[].results[].ruleId] | unique | .[] |
  "  - rule: \(.)\n    reason: Infra hardening in the Q1 plan (SEC-311), approved by AppSec\n    expires: \($e)"' reports/checkov.sarif \
  | { echo "exceptions:"; cat; } > security-exceptions.yaml
```
In a real pipeline the gate job receives the reports as artifacts from the previous jobs (`needs` with `artifacts: true`), and the scanner jobs don't fail on their own.
-->
<!-- solution
cd /root/kurs-shop
exp=$(date -d '+60 days' +%Y-%m-%d)
jq -r --arg e "$exp" '[.runs[].results[].ruleId] | unique | .[] | "  - rule: \(.)\n    reason: Infra hardening u Q1 planu (SEC-311), odobrio AppSec\n    expires: \($e)"' reports/checkov.sarif | { echo "exceptions:"; cat; } > security-exceptions.yaml
ci/security-gate.sh reports security-exceptions.yaml > /root/gate.txt 2>/dev/null || true
yq -i '.stages += ["gate"] | .["security-gate"] = {"stage": "gate", "script": ["ci/security-gate.sh reports security-exceptions.yaml"]}' .gitlab-ci.yml
-->
