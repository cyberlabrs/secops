# Lab 1: Objedinjeni izvještaji i security gate

Svaki alat u pipelineu daje svoj izvještaj, ali svi znaju **SARIF** 2.1.0. Umjesto da svaki job sam odlučuje kada pada, alati samo prave izvještaje, a jedan **security gate** job čita sve SARIF fajlove, primjenjuje politiku i izuzeća sa rokom i donosi odluku.

U `/root/kurs-shop/reports/` su izvještaji Semgrepa, Trivyja, Checkova i gitleaksa za trenutni kod.

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

## Sažetak po alatu

SARIF rezultat ne mora imati polje `level`. Tada važi `defaultConfiguration.level` pravila (`.runs[].tool.driver.rules[]`, po `ruleId`), a ako ni ono ne postoji, nivo je `warning`.

Napravi `/root/sazetak.json` oblika:

```json
{ "Semgrep OSS": {"error": 4, "warning": 2, "note": 0}, "Trivy": {…}, "Checkov": {…}, "gitleaks": {…} }
```

Ključ je `tool.driver.name`, a brojevi su rezultati po **efektivnom** nivou (`error`, `warning`, `note`).

<!-- verify
[ -s /root/sazetak.json ] || { echo "nema /root/sazetak.json"; exit 1; }
cd /root/kurs-shop
want=$(jq -s 'map(.runs[] | .tool.driver as $d | ($d.rules // []) as $r | {key: $d.name, value: ([.results[] | (.level // (.ruleId as $id | ($r[] | select(.id == $id) | .defaultConfiguration.level)) // "warning")] | {error: map(select(. == "error")) | length, warning: map(select(. == "warning")) | length, note: map(select(. == "note")) | length})}) | from_entries' reports/*.sarif)
got=$(jq 'map_values({error: (.error // 0), warning: (.warning // 0), note: (.note // 0)})' /root/sazetak.json 2>/dev/null) || { echo "sazetak.json nije validan JSON"; exit 1; }
[ "$(echo "$want" | jq -S -c .)" = "$(echo "$got" | jq -S -c .)" ] || { echo "sazetak.json nije tačan; očekivani ključevi: $(echo "$want" | jq -c keys)"; exit 1; }
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
Semgrep i gitleaks ne pišu `level` u rezultat: Semgrep ga ima u pravilu, gitleaks nigdje (pa je `warning`).
-->
<!-- solution
cd /root/kurs-shop
jq -s 'map(.runs[] | .tool.driver as $d | ($d.rules // []) as $r | {key: $d.name, value: ([.results[] | (.level // (.ruleId as $id | ($r[] | select(.id == $id) | .defaultConfiguration.level)) // "warning")] | {error: map(select(. == "error")) | length, warning: map(select(. == "warning")) | length, note: map(select(. == "note")) | length})}) | from_entries' reports/*.sarif > /root/sazetak.json
-->

## Gate skripta

Napiši izvršivu skriptu `ci/security-gate.sh <direktorij-sa-sarif-fajlovima> <izuzeci.yaml>` (bash, Python ili šta ti odgovara) koja:

1. čita sve `*.sarif` fajlove iz direktorija,
2. za svaki rezultat efektivnog nivoa `error` provjerava da li postoji **važeći** izuzetak za njegov `ruleId`,
3. ispisuje svaki blokirajući nalaz u jednom redu (`ruleId` i putanja fajla) i vraća 1 ako ih ima, inače 0.

Format izuzetaka:

```yaml
exceptions:
  - rule: CKV_AWS_18
    reason: Logovanje pristupa bucketu uvodimo sa centralnim log bucketom (SEC-311)
    expires: 2026-12-31
```

Izuzetak važi samo ako ima neprazan `reason` i `expires` koji nije prošao. Nalazi nivoa `warning` i `note` ne blokiraju. Nepostojeći fajl izuzetaka znači „nema izuzetaka“.

<!-- verify
g=/root/kurs-shop/ci/security-gate.sh
[ -x $g ] || { echo "$g ne postoji ili nije izvršiv"; exit 1; }
t=$(mktemp -d); mkdir -p $t/r
mk() { # mk <fajl> <ruleId> <level|-> <defaultLevel|->
  jq -n --arg id "$2" --arg l "$3" --arg d "$4" '{version: "2.1.0", runs: [{tool: {driver: {name: "t", rules: [({id: $id} + (if $d == "-" then {} else {defaultConfiguration: {level: $d}} end))]}}, results: [({ruleId: $id, message: {text: "x"}, locations: [{physicalLocation: {artifactLocation: {uri: "a.py"}}}]} + (if $l == "-" then {} else {level: $l} end))]}]}' > "$1"; }
fut=$(date -d '+20 days' +%Y-%m-%d); past=$(date -d '-1 day' +%Y-%m-%d)
mk $t/r/a.sarif R-ERR error -
$g $t/r $t/nema.yaml > $t/o.txt 2>&1 && { rm -rf $t; echo "gate prolazi iako postoji error nalaz bez izuzetka"; exit 1; }
grep -q 'R-ERR' $t/o.txt || { rm -rf $t; echo "gate ne ispisuje ruleId blokirajućeg nalaza"; exit 1; }
printf 'exceptions:\n  - rule: R-ERR\n    reason: Prihvaćeno do migracije (SEC-1)\n    expires: %s\n' "$fut" > $t/ok.yaml
$g $t/r $t/ok.yaml >/dev/null 2>&1 || { rm -rf $t; echo "gate pada iako postoji važeći izuzetak"; exit 1; }
printf 'exceptions:\n  - rule: R-ERR\n    reason: Prihvaćeno do migracije (SEC-1)\n    expires: %s\n' "$past" > $t/old.yaml
$g $t/r $t/old.yaml >/dev/null 2>&1 && { rm -rf $t; echo "gate prihvata istekao izuzetak"; exit 1; }
printf 'exceptions:\n  - rule: R-ERR\n    reason: ""\n    expires: %s\n' "$fut" > $t/nr.yaml
$g $t/r $t/nr.yaml >/dev/null 2>&1 && { rm -rf $t; echo "gate prihvata izuzetak bez razloga"; exit 1; }
rm -f $t/r/*; mk $t/r/b.sarif R-WARN warning -
$g $t/r $t/nema.yaml >/dev/null 2>&1 || { rm -rf $t; echo "gate pada na warning nalazu"; exit 1; }
rm -f $t/r/*; mk $t/r/c.sarif R-DEF - error
$g $t/r $t/nema.yaml >/dev/null 2>&1 && { rm -rf $t; echo "gate ne uzima defaultConfiguration.level pravila kad rezultat nema level"; exit 1; }
rm -f $t/r/*; mk $t/r/d.sarif R-NONE - -
$g $t/r $t/nema.yaml >/dev/null 2>&1 || { rm -rf $t; echo "rezultat bez levela i bez defaultConfiguration je warning, ne smije blokirati"; exit 1; }
rm -rf $t
-->
<!-- hint
Python ima sve što treba (`json`, `datetime`, a YAML pročitaš preko `yq -o=json`):
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

## Izuzeci tima i gate job

Tim je odlučio: nalazi Checkova u `infra/` rješavaju se u narednom kvartalu, a sve ostalo mora biti popravljeno prije releasea.

1. Napravi `security-exceptions.yaml` u korijenu repoa sa izuzetkom za **svako** Checkov pravilo koje se trenutno pojavljuje u `reports/checkov.sarif`, sa obrazloženjem i rokom od najviše 90 dana. Nijedno pravilo drugih alata ne smije biti u izuzecima.
2. Pokreni gate nad `reports/` sa tim izuzecima i sačuvaj ispis (stdout) u `/root/gate.txt`. Gate i dalje mora pasti (Semgrep i Trivy nalazi), ali u ispisu ne smije biti nijednog `CKV` pravila.
3. Dodaj job `security-gate` u novu, posljednju fazu `gate`, koji pokreće `ci/security-gate.sh reports security-exceptions.yaml`.

<!-- verify
cd /root/kurs-shop
[ -f security-exceptions.yaml ] || { echo "nema security-exceptions.yaml"; exit 1; }
ck=$(jq -r '[.runs[].results[].ruleId] | unique | .[]' reports/checkov.sarif | sort)
ex=$(yq -r '.exceptions[].rule' security-exceptions.yaml | sort -u)
[ "$ck" = "$ex" ] || { echo "izuzeci moraju pokriti tačno Checkov pravila iz reports/checkov.sarif (ni manje ni više)"; exit 1; }
python3 - <<'EOF' || exit 1
import datetime, json, subprocess, sys
y = json.loads(subprocess.run(["yq", "-o=json", ".", "security-exceptions.yaml"], capture_output=True, text=True).stdout)
today = datetime.date.today()
for e in y["exceptions"]:
    if len(str(e.get("reason", "")).split()) < 3:
        sys.exit(f"{e.get('rule')}: reason mora obrazložiti odluku")
    d = datetime.date.fromisoformat(str(e.get("expires"))[:10])
    if d < today or d > today + datetime.timedelta(days=90):
        sys.exit(f"{e.get('rule')}: expires mora biti u narednih 90 dana")
EOF
ci/security-gate.sh reports security-exceptions.yaml > /tmp/g.txt 2>/dev/null && { echo "gate prolazi, a Semgrep/Trivy nalazi nisu riješeni"; exit 1; }
grep -q 'CKV' /tmp/g.txt && { echo "gate i dalje blokira na Checkov pravilima"; exit 1; }
[ -s /root/gate.txt ] && ! grep -q 'CKV' /root/gate.txt && grep -q 'kurs.python' /root/gate.txt || { echo "/root/gate.txt treba ispis gatea sa izuzecima (Semgrep nalazi, bez CKV)"; exit 1; }
[ "$(yq '.stages[-1]' .gitlab-ci.yml)" = "gate" ] || { echo "gate mora biti posljednja faza u stages"; exit 1; }
[ "$(yq '.["security-gate"].stage' .gitlab-ci.yml)" = "gate" ] || { echo "job security-gate nije u fazi gate"; exit 1; }
yq '.["security-gate"].script | join(" ")' .gitlab-ci.yml | grep -q 'security-gate.sh reports security-exceptions.yaml' || { echo "security-gate ne pokreće ci/security-gate.sh reports security-exceptions.yaml"; exit 1; }
-->
<!-- hint
```bash
exp=$(date -d '+60 days' +%Y-%m-%d)
jq -r --arg e "$exp" '[.runs[].results[].ruleId] | unique | .[] |
  "  - rule: \(.)\n    reason: Infra hardening u Q1 planu (SEC-311), odobrio AppSec\n    expires: \($e)"' reports/checkov.sarif \
  | { echo "exceptions:"; cat; } > security-exceptions.yaml
```
U pravom pipelineu gate job dobija izvještaje kao artefakte prethodnih jobova (`needs` sa `artifacts: true`), a scanner jobovi ne padaju sami.
-->
<!-- solution
cd /root/kurs-shop
exp=$(date -d '+60 days' +%Y-%m-%d)
jq -r --arg e "$exp" '[.runs[].results[].ruleId] | unique | .[] | "  - rule: \(.)\n    reason: Infra hardening u Q1 planu (SEC-311), odobrio AppSec\n    expires: \($e)"' reports/checkov.sarif | { echo "exceptions:"; cat; } > security-exceptions.yaml
ci/security-gate.sh reports security-exceptions.yaml > /root/gate.txt 2>/dev/null || true
yq -i '.stages += ["gate"] | .["security-gate"] = {"stage": "gate", "script": ["ci/security-gate.sh reports security-exceptions.yaml"]}' .gitlab-ci.yml
-->
