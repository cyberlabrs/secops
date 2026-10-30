# Lab 2: Image scanning and a gate in the pipeline

The image `kurs-shop:1.0` in the local registry was built on the old base image `python:3.9-slim` and runs as root. You will build a new version on a current base image, introduce a **Trivy gate** into the pipeline and, with a justification, accept the findings whose fix is currently not in your hands.

In the lab, images are assembled without a Docker daemon using the `kurs-build` tool (base image + a layer with the code). In a real pipeline this is done by BuildKit, Buildah or Kaniko.

```bash
cd /root/kurs-shop
crane ls --insecure 127.0.0.1:5000/kurs-shop
kurs-build
trivy image --severity CRITICAL 127.0.0.1:5000/kurs-shop:1.0
```

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
kurs-build 127.0.0.1:5000/python:3.9-slim 127.0.0.1:5000/kurs-shop:1.0 /root/kurs-shop >/dev/null
-->

## How bad is the old image

Scan `127.0.0.1:5000/kurs-shop:1.0` and save the JSON report to `/root/trivy-1.0.json`. Write the number of CRITICAL findings (the number of entries in all `Vulnerabilities` lists) to `/root/critical.txt`, and the number of them that have a fix available (`FixedVersion`) to `/root/critical-fix.txt`.

```bash
trivy image --format json -o /root/trivy-1.0.json 127.0.0.1:5000/kurs-shop:1.0
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' /root/trivy-1.0.json
```

<!-- verify
[ -s /root/trivy-1.0.json ] || { echo "/root/trivy-1.0.json does not exist"; exit 1; }
jq -e '.ArtifactName | test("kurs-shop:1.0")' /root/trivy-1.0.json >/dev/null 2>&1 || { echo "the report is not for 127.0.0.1:5000/kurs-shop:1.0"; exit 1; }
c=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' /root/trivy-1.0.json)
f=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "")] | length' /root/trivy-1.0.json)
[ "$c" -gt 0 ] || { echo "the report has no CRITICAL findings: scan all severities"; exit 1; }
[ "$(tr -d ' \n' < /root/critical.txt 2>/dev/null)" = "$c" ] || { echo "critical.txt is not correct"; exit 1; }
[ "$(tr -d ' \n' < /root/critical-fix.txt 2>/dev/null)" = "$f" ] || { echo "critical-fix.txt is not correct"; exit 1; }
-->
<!-- hint
```bash
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "")] | length' /root/trivy-1.0.json
```
The `?` after `Vulnerabilities[]` skips results without findings (e.g. the secret scan).
-->
<!-- solution
trivy image -q --format json -o /root/trivy-1.0.json 127.0.0.1:5000/kurs-shop:1.0
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' /root/trivy-1.0.json > /root/critical.txt
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "")] | length' /root/trivy-1.0.json > /root/critical-fix.txt
-->

## A new image and the first gate

1. Build `127.0.0.1:5000/kurs-shop:1.1` on the base image `127.0.0.1:5000/python:3.13-slim`, with user `65532` (not root).
2. The gate (vulnerabilities only; secrets are scanned by a separate job): `trivy image --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 <image>` must fail for 1.0 and pass for 1.1.

```bash
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532
```

<!-- verify
crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1 >/dev/null 2>&1 || { echo "the image kurs-shop:1.1 does not exist in the registry"; exit 1; }
u=$(crane config --insecure 127.0.0.1:5000/kurs-shop:1.1 | jq -r '.config.User // ""')
[ -n "$u" ] && [ "$u" != "root" ] && [ "$u" != "0" ] || { echo "kurs-shop:1.1 runs as root (User: '$u')"; exit 1; }
crane config --insecure 127.0.0.1:5000/kurs-shop:1.1 | jq -e '.config.Env | any(test("PYTHON_VERSION=3.13"))' >/dev/null || { echo "kurs-shop:1.1 is not based on python:3.13-slim"; exit 1; }
trivy image -q --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 127.0.0.1:5000/kurs-shop:1.1 >/dev/null 2>&1 || { echo "the gate fails for 1.1 too"; exit 1; }
-->
<!-- hint
`kurs-build <base> <destination> <directory> <user>`. To check the user: `crane config --insecure 127.0.0.1:5000/kurs-shop:1.1 | jq .config.User`.
-->
<!-- solution
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532 >/dev/null
-->

## A stricter gate and justified exceptions

The team tightens the gate to **HIGH and CRITICAL** with a fix available. On 1.1 there remain findings in Python packages brought in by the base image itself (tools around `pip`), not by the application; the fix arrives with the next release of the base image.

1. Create `.trivyignore.yaml` in the repo root with an entry for each such finding: `id`, `statement` (the justification) and `expired_at` at most 30 days from today (RFC 3339, e.g. `2026-11-10T00:00:00Z`).
2. Add a job `image-scan` (stage `test`) that builds the image `127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA` (`kurs-build`, user 65532) and scans it: `--scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml`.
3. `gitlab-ci-local image-scan` must pass.

```bash
trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed 127.0.0.1:5000/kurs-shop:1.1
```

<!-- verify
cd /root/kurs-shop
[ -f .trivyignore.yaml ] || { echo "no .trivyignore.yaml"; exit 1; }
python3 - <<'EOF' || exit 1
import datetime, subprocess, sys, json
y = json.loads(subprocess.run(["yq", "-o=json", ".", ".trivyignore.yaml"], capture_output=True, text=True).stdout or "{}")
items = (y or {}).get("vulnerabilities") or []
if not items:
    sys.exit(".trivyignore.yaml has no vulnerabilities section")
today = datetime.date.today()
for it in items:
    i = it.get("id", "?")
    if len(str(it.get("statement", "")).split()) < 3:
        sys.exit(f"{i}: the statement must justify the exception")
    e = it.get("expired_at")
    if not e:
        sys.exit(f"{i}: no expired_at")
    d = datetime.date.fromisoformat(str(e)[:10])
    if d <= today or d > today + datetime.timedelta(days=30):
        sys.exit(f"{i}: expired_at must be within the next 30 days")
EOF
n=$(yq '.vulnerabilities | length' .trivyignore.yaml)
[ "$n" -le 8 ] || { echo "too many exceptions ($n): ignore only the findings that remain on 1.1"; exit 1; }
s=$(yq '.["image-scan"].script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q 'kurs-build' && echo "$s" | grep -q 'CI_COMMIT_SHORT_SHA' || { echo "image-scan must build the image kurs-shop:\$CI_COMMIT_SHORT_SHA"; exit 1; }
echo "$s" | grep -q 'HIGH,CRITICAL' && echo "$s" | grep -q -- '--scanners vuln' && echo "$s" | grep -q -- '--exit-code 1' && echo "$s" | grep -q -- '--ignorefile' || { echo "image-scan needs --severity HIGH,CRITICAL --exit-code 1 --ignorefile .trivyignore.yaml"; exit 1; }
gitlab-ci-local image-scan > /tmp/gcl.log 2>&1 || { tail -20 /tmp/gcl.log; echo "the image-scan job fails"; exit 1; }
trivy image -q --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml 127.0.0.1:5000/kurs-shop:1.0 >/dev/null 2>&1 && { echo "the exceptions also let the old image 1.0 through: they are too broad"; exit 1; }
exit 0
-->
<!-- hint
```yaml
vulnerabilities:
  - id: CVE-2025-47273
    statement: setuptools from the base image, not used at runtime; waiting for a new release of python:3.13-slim
    expired_at: 2026-11-10T00:00:00Z
```
```yaml
image-scan:
  stage: test
  script:
    - kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA . 65532
    - trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA
```
Without `--scanners vuln` Trivy also scans the image for secrets, so the gate would fail on the token in the copied `Dockerfile` as well; secrets are the job of a separate job. You get the IDs with `trivy image -f json … | jq -r '.Results[].Vulnerabilities[]?.VulnerabilityID' | sort -u`.
-->
<!-- solution
cd /root/kurs-shop
exp=$(date -u -d '+21 days' +%Y-%m-%dT00:00:00Z)
trivy image -q --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed -f json 127.0.0.1:5000/kurs-shop:1.1 \
  | jq -r --arg e "$exp" '[.Results[].Vulnerabilities[]? | .VulnerabilityID] | unique | {vulnerabilities: map({id: ., statement: "Paket iz bazne slike python:3.13-slim, ne koristi ga aplikacija; čekamo novo izdanje bazne slike", expired_at: $e})}' \
  | yq -P > .trivyignore.yaml
yq -i '.["image-scan"] = {"stage": "test", "script": ["kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA . 65532", "trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA"]}' .gitlab-ci.yml
-->
