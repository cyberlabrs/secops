# Capstone: a complete DevSecOps pipeline

You get a fresh `kurs-shop` repo with all the original problems. Create a `.gitlab-ci.yml` that contains all the controls from the course and fix the application so the pipeline passes. Each task is checked by running your jobs with `gitlab-ci-local`, so a job has to actually work.

**Rules:**

- Stages (`stages`) in order: `scan`, `build`, `verify`, `sign`, `deploy`.
- Job names are given in each task.
- No security job may have `allow_failure: true`.
- The signing key is in `/root/keys/` (the password and paths are already in `.gitlab-ci-local-variables.yml`: `COSIGN_PASSWORD`, `COSIGN_KEY`, `COSIGN_PUB`).
- The application for DAST is started with `kurs-shop-start`; the ZAP plan is in `zap/plan.yaml`, and ZAP is run with `zap-auto`.
- Images are built with `kurs-build` (registry `127.0.0.1:5000`).

You can use the module labs as a reminder. Time: 150 minutes.

```bash
cd /root/kurs-shop
cat .gitlab-ci.yml .gitlab-ci-local-variables.yml zap/plan.yaml
```

<!-- timer
150
-->

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
export COSIGN_PASSWORD=kurs
mkdir -p /root/keys && (cd /root/keys && cosign generate-key-pair >/dev/null 2>&1)
cat > .gitlab-ci-local-variables.yml <<'EOF'
COSIGN_PASSWORD: kurs
COSIGN_KEY: /root/keys/cosign.key
COSIGN_PUB: /root/keys/cosign.pub
EOF
printf '.gitlab-ci-local-variables.yml\n*.sarif\nimage.txt\nsbom.cdx.json\nzap-izvjestaj.json\n' >> .gitignore
mkdir -p zap
cat > zap/plan.yaml <<'EOF'
env:
  contexts:
    - name: kurs-shop
      urls:
        - http://127.0.0.1:8080
  parameters:
    failOnError: true
    progressToStdout: true
jobs:
  - type: spider
    parameters:
      context: kurs-shop
      maxDuration: 1
  - type: passiveScan-wait
    parameters:
      maxDuration: 2
  - type: report
    parameters:
      template: traditional-json
      reportDir: /root/kurs-shop
      reportFile: zap-izvjestaj
  - type: exitStatus
    parameters:
      errorLevel: Medium
EOF
git add .gitignore zap && git commit -qm "ZAP plan"
cat > /usr/local/bin/kurs-shop-start <<'EOF'
#!/bin/bash
# (Ponovo) pokreće kurs-shop na 127.0.0.1:8080 iz /root/kurs-shop
pkill -f '^/opt/app-venv/bin/python app.py' 2>/dev/null; sleep 0.5
cd /root/kurs-shop && (DB_PATH=/tmp/shop.db SECRET_KEY=lab setsid nohup /opt/app-venv/bin/python app.py >/tmp/app.log 2>&1 </dev/null &)
for i in $(seq 40); do curl -fs http://127.0.0.1:8080/health >/dev/null 2>&1 && exit 0; sleep 0.25; done
echo "aplikacija se ne pokreće; pogledaj /tmp/app.log"; exit 1
EOF
chmod +x /usr/local/bin/kurs-shop-start
-->

## Task 1: Secrets

- Remove the token from the `Dockerfile` and commit the change.
- Record the rotated findings from history in `.gitleaksignore` (committed).
- The `secrets` job (stage `scan`) runs `gitleaks git` on the repo and keeps the SARIF report as an artifact even when it fails.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.stages | join(",")' .gitlab-ci.yml)" = "scan,build,verify,sign,deploy" ] || { echo "stages must be in order: scan, build, verify, sign, deploy"; exit 1; }
[ "$(yq '.secrets.stage' .gitlab-ci.yml)" = "scan" ] || { echo "the secrets job is not in the scan stage"; exit 1; }
yq '.secrets.script | join(" ")' .gitlab-ci.yml | grep -q 'gitleaks git' || { echo "secrets does not run gitleaks git"; exit 1; }
[ "$(yq '.secrets.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "secrets: artifacts when: always"; exit 1; }
grep -q 'glpat-' Dockerfile && { echo "the token is still in the Dockerfile"; exit 1; }
git ls-files --error-unmatch .gitleaksignore >/dev/null 2>&1 || { echo ".gitleaksignore is not committed"; exit 1; }
gitlab-ci-local secrets > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "the secrets job fails"; exit 1; }
t=$(mktemp -d); git clone -q . $t/r; cd $t/r; printf 'K = "AKIAZ7XQ4MPLW2NRT5VB"\n' > n.py; git add n.py; git commit -qm n --no-verify
gitleaks git . --no-banner >/dev/null 2>&1 && { rm -rf $t; echo "a new secret does not fail the check"; exit 1; }
rm -rf $t
-->
<!-- hint
The "Secrets in git history" lab (module 3): `.gitleaksignore` is built from the `Fingerprint` field of the JSON report, only after the commit that removes the token.
-->
<!-- solution
cd /root/kurs-shop
sed -i '/API_TOKEN/d' Dockerfile && git commit -qam "Uklonjen token iz Dockerfilea"
gitleaks git . --report-format json --report-path /tmp/sve.json >/dev/null 2>&1 || true
jq -r '.[].Fingerprint' /tmp/sve.json > .gitleaksignore && git add .gitleaksignore && git commit -qm "Rotirani nalazi"
cat > .gitlab-ci.yml <<'EOF'
stages: [scan, build, verify, sign, deploy]

secrets:
  stage: scan
  script:
    - gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif
  artifacts:
    when: always
    paths: [gitleaks.sarif]
EOF
-->

## Task 2: SAST

- Fix the ERROR findings in `app.py` (SQL injection, `shell=True`, `yaml.load`); the application must still work.
- The `sast` job (stage `scan`): Semgrep with `/opt/kurs/semgrep-rules`, ERROR only, fails on a finding, SARIF report as an artifact.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.sast.stage' .gitlab-ci.yml)" = "scan" ] || { echo "the sast job is not in the scan stage"; exit 1; }
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q -- '--error' || { echo "sast needs --error"; exit 1; }
gitlab-ci-local sast > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "the sast job fails"; exit 1; }
semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --quiet app.py >/dev/null 2>&1 || { echo "app.py still has ERROR findings"; exit 1; }
/opt/app-venv/bin/python - <<'EOF' || exit 1
import os, tempfile
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "v.db")
import app as m
c = m.app.test_client()
assert {r[1] for r in c.get("/products?q=ka").json} == {"kafa", "kakao"}, "/products ne radi"
assert c.get("/products", query_string={"q": "x' OR 1=1 --"}).json == [], "SQL injection i dalje radi"
EOF
-->
<!-- hint
The "Semgrep findings and fixes" lab (module 5).
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
yq -i '.sast = {"stage": "scan", "script": ["semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --sarif --output semgrep.sarif app.py"], "artifacts": {"when": "always", "paths": ["semgrep.sarif"]}}' .gitlab-ci.yml
-->

## Task 3: SCA

- Upgrade `requirements.txt` to versions without known vulnerabilities (pinned with `==`).
- Record the frontend findings in `osv-scanner.toml` (a reason, `ignoreUntil` at most 30 days).
- The `sca` job (stage `scan`): `osv-scanner scan source --offline -r . --config osv-scanner.toml`.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.sca.stage' .gitlab-ci.yml)" = "scan" ] || { echo "the sca job is not in the scan stage"; exit 1; }
yq '.sca.script | join(" ")' .gitlab-ci.yml | grep -q 'osv-scanner' || { echo "sca does not run osv-scanner"; exit 1; }
osv-scanner scan source --offline -L requirements.txt >/dev/null 2>&1 || { echo "requirements.txt still has vulnerable versions (do not ignore them)"; exit 1; }
python3 - <<'EOF' || exit 1
import tomllib, datetime, sys
now = datetime.datetime.now(datetime.timezone.utc)
for it in tomllib.load(open("osv-scanner.toml", "rb")).get("IgnoredVulns", []):
    u = it.get("ignoreUntil")
    if not u or len(str(it.get("reason", "")).split()) < 3:
        sys.exit(f"{it.get('id')}: needs a reason and ignoreUntil")
    if isinstance(u, datetime.date) and not isinstance(u, datetime.datetime):
        u = datetime.datetime.combine(u, datetime.time(), datetime.timezone.utc)
    if u.tzinfo is None:
        u = u.replace(tzinfo=datetime.timezone.utc)
    if u <= now or u > now + datetime.timedelta(days=30, hours=12):
        sys.exit(f"{it.get('id')}: ignoreUntil at most 30 days")
EOF
gitlab-ci-local sca > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "the sca job fails"; exit 1; }
-->
<!-- hint
The "Vulnerable dependencies and risk acceptance" lab (module 6).
-->
<!-- solution
cd /root/kurs-shop
printf 'flask==3.1.3\nwerkzeug==3.1.9\njinja2==3.1.6\nrequests==2.33.0\nPyYAML==6.0.3\ngunicorn==23.0.0\n' > requirements.txt
until=$(date -u -d '+14 days' +%Y-%m-%dT00:00:00Z)
osv-scanner scan source --offline -L frontend/package-lock.json --format json 2>/dev/null \
  | jq -r --arg u "$until" '.results[].packages[].groups[].ids[0] | "[[IgnoredVulns]]\nid = \"\(.)\"\nignoreUntil = \($u)\nreason = \"Frontend migracija na axios 1.x, odobrio AppSec\"\n"' > osv-scanner.toml
yq -i '.sca = {"stage": "scan", "script": ["osv-scanner scan source --offline -r . --config osv-scanner.toml"]}' .gitlab-ci.yml
-->

## Task 4: IaC

- Fix in `infra/main.tf`: an S3 public access block, SSH only from `10.0.0.0/8`, the database is not public and is encrypted, no password in the code.
- The `iac` job (stage `scan`): Checkov on `infra/` that passes but fails on any new problem (a baseline or a list of checks, your choice).

<!-- verify
cd /root/kurs-shop
[ "$(yq '.iac.stage' .gitlab-ci.yml)" = "scan" ] || { echo "the iac job is not in the scan stage"; exit 1; }
checkov -d infra --check CKV_AWS_53,CKV_AWS_54,CKV_AWS_55,CKV_AWS_56,CKV_AWS_24,CKV_AWS_16,CKV_AWS_17 --compact --quiet >/dev/null 2>&1 || { echo "critical Checkov checks still fail"; exit 1; }
grep -Eq '^\s*password\s*=' infra/main.tf && { echo "the database password is still in main.tf"; exit 1; }
gitlab-ci-local iac > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "the iac job fails"; exit 1; }
cp infra/main.tf /tmp/m.bak
printf '\nresource "aws_security_group" "provjera" {\n  name        = "provjera"\n  description = "provjera"\n  ingress {\n    description = "SSH"\n    from_port   = 22\n    to_port     = 22\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n' >> infra/main.tf
gitlab-ci-local iac > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/m.bak infra/main.tf
[ $rc -ne 0 ] || { echo "the iac job does not fail on a new security group with open SSH"; exit 1; }
-->
<!-- hint
The "Terraform through Checkov" lab (module 7). Create the baseline only after the fixes.
-->
<!-- solution
cd /root/kurs-shop
python3 - <<'EOF'
import re
p = "infra/main.tf"; s = open(p).read()
s = re.sub(r'(\b(?:block_public_acls|block_public_policy|ignore_public_acls|restrict_public_buckets)\s*=\s*)false', r'\1true', s)
s = s.replace('''    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]''', '''    description = "SSH iz interne mreže"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]''')
s = re.sub(r'\n\s*password\s*=\s*"[^"]*"', '\n  manage_master_user_password = true', s)
s = re.sub(r'publicly_accessible\s*=\s*true', 'publicly_accessible = false', s)
s = re.sub(r'storage_encrypted\s*=\s*false', 'storage_encrypted = true', s)
open(p, "w").write(s)
EOF
checkov -d infra --create-baseline --quiet >/dev/null 2>&1 || true
yq -i '.iac = {"stage": "scan", "script": ["checkov -d infra --baseline infra/.checkov.baseline --compact"]}' .gitlab-ci.yml
-->

## Task 5: Dockerfile

- Rewrite the `Dockerfile`: multi-stage, pinned base image versions, `COPY` instead of `ADD`, no secrets, a non-root `USER`, the exec form of `CMD`.
- The `dockerfile-lint` job (stage `scan`): hadolint (threshold `warning`) and `trivy config` (HIGH/CRITICAL fails).

<!-- verify
cd /root/kurs-shop
[ "$(yq '.["dockerfile-lint"].stage' .gitlab-ci.yml)" = "scan" ] || { echo "the dockerfile-lint job is not in the scan stage"; exit 1; }
[ "$(grep -ciE '^FROM ' Dockerfile)" -ge 2 ] || { echo "the Dockerfile is not multi-stage"; exit 1; }
u=$(awk 'toupper($1)=="FROM"{u=""} toupper($1)=="USER"{u=$2} END{print u}' Dockerfile)
[ -n "$u" ] && [ "$u" != "root" ] && [ "${u%%:*}" != "0" ] || { echo "the final stage must have a non-root USER"; exit 1; }
gitlab-ci-local dockerfile-lint > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "the dockerfile-lint job fails"; exit 1; }
hadolint --failure-threshold warning Dockerfile >/dev/null 2>&1 || { echo "hadolint reports warnings"; exit 1; }
-->
<!-- hint
The "Secure Dockerfile" lab (module 8).
-->
<!-- solution
cd /root/kurs-shop
cat > Dockerfile <<'EOF'
FROM python:3.13-slim AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app.py ./
COPY config/ ./config/
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"]
CMD ["python", "app.py"]
EOF
yq -i '.["dockerfile-lint"] = {"stage": "scan", "script": ["hadolint --failure-threshold warning Dockerfile", "trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile"]}' .gitlab-ci.yml
-->

## Task 6: Build, SBOM and image scanning

- The `build` job (stage `build`) builds the image `127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA` on `127.0.0.1:5000/python:3.13-slim` with user `65532`, writes its reference **by digest** to `image.txt` and creates a CycloneDX SBOM `sbom.cdx.json`. Both files are artifacts.
- The `image-scan` job (stage `verify`, `needs: [build]`) scans the image from `image.txt`: vulnerabilities only, a CRITICAL with a fix available fails the job.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.build.stage' .gitlab-ci.yml)" = "build" ] || { echo "the build job is not in the build stage"; exit 1; }
[ "$(yq '.["image-scan"].stage' .gitlab-ci.yml)" = "verify" ] || { echo "the image-scan job is not in the verify stage"; exit 1; }
yq '.["image-scan"].needs[] | (.job // .)' .gitlab-ci.yml | grep -qx build || { echo "image-scan needs needs: [build]"; exit 1; }
rm -f image.txt sbom.cdx.json
gitlab-ci-local build image-scan > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "build or image-scan fails"; exit 1; }
img=$(cat image.txt 2>/dev/null)
echo "$img" | grep -Eq '^127\.0\.0\.1:5000/kurs-shop@sha256:[0-9a-f]{64}$' || { echo "image.txt needs a reference by digest (127.0.0.1:5000/kurs-shop@sha256:…), but it has: $img"; exit 1; }
[ "$(crane config --insecure "$img" | jq -r '.config.User')" = "65532" ] || { echo "the image does not run as user 65532"; exit 1; }
jq -e '.bomFormat == "CycloneDX" and (.components | length > 50)' sbom.cdx.json >/dev/null 2>&1 || { echo "sbom.cdx.json is not a CycloneDX SBOM of the image"; exit 1; }
-->
<!-- hint
`kurs-build` prints the reference by digest at the end, so `kurs-build … > image.txt` is enough. SBOM: `syft scan registry:$(cat image.txt) -o cyclonedx-json=sbom.cdx.json`.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.build = {"stage": "build", "script": ["kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA . 65532 > image.txt", "syft scan registry:$(cat image.txt) -q -o cyclonedx-json=sbom.cdx.json"], "artifacts": {"paths": ["image.txt", "sbom.cdx.json"]}}' .gitlab-ci.yml
yq -i '.["image-scan"] = {"stage": "verify", "needs": ["build"], "script": ["trivy image --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 $(cat image.txt)"]}' .gitlab-ci.yml
-->

## Task 7: DAST

- Add security headers (`Content-Security-Policy` with `default-src`, `frame-ancestors`, `form-action`, `base-uri`; `X-Frame-Options`; `X-Content-Type-Options`) and `HttpOnly`/`SameSite` for the cookie.
- The `dast` job (stage `verify`): starts the application and `zap-auto zap/plan.yaml`, keeps `zap-izvjestaj.json` as an artifact even when it fails.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.dast.stage' .gitlab-ci.yml)" = "verify" ] || { echo "the dast job is not in the verify stage"; exit 1; }
[ "$(yq '.dast.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "dast: artifacts when: always"; exit 1; }
yq '.jobs[] | select(.type == "exitStatus") | .parameters.errorLevel' zap/plan.yaml | grep -qx Medium || { echo "do not change exitStatus in zap/plan.yaml"; exit 1; }
rm -f zap-izvjestaj.json
timeout 55 gitlab-ci-local dast > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "the dast job fails"; exit 1; }
[ -s zap-izvjestaj.json ] || { echo "dast did not leave zap-izvjestaj.json"; exit 1; }
-->
<!-- hint
The "ZAP scan of a running application" lab (module 11). The plan already writes the report to `/root/kurs-shop/zap-izvjestaj.json`.
-->
<!-- solution
cd /root/kurs-shop
python3 - <<'EOF'
p = "app.py"; s = open(p).read()
s = s.replace('resp.set_cookie("session_hint", "anon")', 'resp.set_cookie("session_hint", "anon", httponly=True, samesite="Lax")')
s = s.replace('''@app.route("/")''', '''@app.after_request
def security_headers(resp):
    resp.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@app.route("/")''', 1)
open(p, "w").write(s)
EOF
yq -i '.dast = {"stage": "verify", "script": ["kurs-shop-start", "zap-auto zap/plan.yaml"], "artifacts": {"when": "always", "paths": ["zap-izvjestaj.json"]}}' .gitlab-ci.yml
-->

## Task 8: Signing and deploy

- The `sign` job (stage `sign`, `needs: [build, image-scan, dast]`, only on the default branch) signs the image from `image.txt` with the key `$COSIGN_KEY` and publishes an SBOM attestation (`--type cyclonedx`). The lab has no transparency log: `--use-signing-config=false --tlog-upload=false`.
- The `deploy` job (stage `deploy`, `needs: [build, sign]`, only on the default branch, `environment: production`) first verifies the signature (`cosign verify --key $COSIGN_PUB --insecure-ignore-tlog=true`) of the image from `image.txt`, then prints `DEPLOY <image>`. An unsigned image must fail the deploy.

<!-- verify
cd /root/kurs-shop
for j in sign deploy; do
  yq ".${j}.rules[].if" .gitlab-ci.yml | grep -q 'CI_COMMIT_BRANCH *== *\$CI_DEFAULT_BRANCH' || { echo "$j needs rules: \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH"; exit 1; }
done
[ "$(yq '.sign.stage' .gitlab-ci.yml)" = "sign" ] && [ "$(yq '.deploy.stage' .gitlab-ci.yml)" = "deploy" ] || { echo "sign and deploy must be in the sign and deploy stages"; exit 1; }
[ "$(yq '.deploy.environment.name // .deploy.environment' .gitlab-ci.yml)" = "production" ] || { echo "deploy needs environment: production"; exit 1; }
yq '.deploy.script | join(" ")' .gitlab-ci.yml | grep -q 'cosign verify' || { echo "deploy does not verify the signature"; exit 1; }
rm -f image.txt
gitlab-ci-local build sign deploy > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "build, sign or deploy fails"; exit 1; }
grep -q "DEPLOY 127.0.0.1:5000/kurs-shop@sha256:" /tmp/gcl.log || { echo "deploy does not print DEPLOY <image by digest>"; exit 1; }
cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true --type cyclonedx "$(cat image.txt)" >/dev/null 2>&1 || { echo "the image has no SBOM attestation"; exit 1; }
cp image.txt /tmp/img.bak
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:nepotpisana . 65532 > image.txt
gitlab-ci-local deploy > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/img.bak image.txt
[ $rc -ne 0 ] || { echo "deploy passes even with an unsigned image"; exit 1; }
-->
<!-- hint
```yaml
sign:
  stage: sign
  needs: [build, image-scan, dast]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - cosign sign --key "$COSIGN_KEY" --use-signing-config=false --tlog-upload=false -y "$(cat image.txt)"
    - cosign attest --key "$COSIGN_KEY" --use-signing-config=false --tlog-upload=false -y --type cyclonedx --predicate sbom.cdx.json "$(cat image.txt)"
```
-->
<!-- solution
cd /root/kurs-shop
yq -i '.sign = {"stage": "sign", "needs": ["build", "image-scan", "dast"], "rules": [{"if": "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH"}], "script": ["cosign sign --key \"$COSIGN_KEY\" --use-signing-config=false --tlog-upload=false -y \"$(cat image.txt)\"", "cosign attest --key \"$COSIGN_KEY\" --use-signing-config=false --tlog-upload=false -y --type cyclonedx --predicate sbom.cdx.json \"$(cat image.txt)\""]}' .gitlab-ci.yml
yq -i '.deploy = {"stage": "deploy", "needs": ["build", "sign"], "environment": "production", "rules": [{"if": "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH"}], "script": ["cosign verify --key \"$COSIGN_PUB\" --insecure-ignore-tlog=true \"$(cat image.txt)\" > /dev/null", "echo \"DEPLOY $(cat image.txt)\""]}' .gitlab-ci.yml
-->

## Task 9: The whole pipeline

Commit all changes and run the whole pipeline: `gitlab-ci-local`. All jobs must pass, and no security job may have `allow_failure: true`.

<!-- verify
cd /root/kurs-shop
git diff --quiet HEAD && git diff --cached --quiet || { echo "there are uncommitted changes (git status)"; exit 1; }
n=$(yq '[.[] | select(type == "!!map" and .allow_failure == true)] | length' .gitlab-ci.yml)
[ "$n" = "0" ] || { echo "some job has allow_failure: true"; exit 1; }
for j in secrets sast sca iac dockerfile-lint build image-scan dast sign deploy; do
  [ "$(yq ".\"$j\" | type" .gitlab-ci.yml)" = "!!map" ] || { echo "job $j is missing"; exit 1; }
done
timeout 58 gitlab-ci-local > /tmp/gcl.log 2>&1 || { grep -E 'FAIL|PASS' /tmp/gcl.log | tail -12; echo "the pipeline does not pass (or takes longer than a minute)"; exit 1; }
-->
<!-- hint
`git status` must be clean; the generated files (`*.sarif`, `image.txt`, `sbom.cdx.json`, `zap-izvjestaj.json`) are already in `.gitignore`.
-->
<!-- solution
cd /root/kurs-shop
git add -A && git commit -qm "DevSecOps pipeline"
-->
