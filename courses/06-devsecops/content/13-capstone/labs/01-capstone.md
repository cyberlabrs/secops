# Capstone: kompletan DevSecOps pipeline

Dobijaš svjež repo `kurs-shop` sa svim originalnim problemima. Napravi `.gitlab-ci.yml` koji sadrži sve kontrole iz kursa i popravi aplikaciju tako da pipeline prođe. Svaki zadatak se provjerava pokretanjem tvojih jobova kroz `gitlab-ci-local`, pa job mora zaista raditi.

**Pravila:**

- Faze (`stages`) redom: `scan`, `build`, `verify`, `sign`, `deploy`.
- Imena jobova su zadata u svakom zadatku.
- Nijedan sigurnosni job ne smije imati `allow_failure: true`.
- Ključ za potpis je u `/root/keys/` (lozinka i putanje su već u `.gitlab-ci-local-variables.yml`: `COSIGN_PASSWORD`, `COSIGN_KEY`, `COSIGN_PUB`).
- Aplikaciju za DAST pokreće `kurs-shop-start`; ZAP plan je u `zap/plan.yaml`, a ZAP se pokreće sa `zap-auto`.
- Slike se prave sa `kurs-build` (registry `127.0.0.1:5000`).

Labove iz modula možeš koristiti kao podsjetnik. Vrijeme: 150 minuta.

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

## Zadatak 1: Tajne

- Ukloni token iz `Dockerfile`a i commituj izmjenu.
- Rotirane nalaze iz istorije evidentiraj u `.gitleaksignore` (commitovan).
- Job `secrets` (faza `scan`) pokreće `gitleaks git` nad repoom i čuva SARIF izvještaj kao artefakt i kad padne.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.stages | join(",")' .gitlab-ci.yml)" = "scan,build,verify,sign,deploy" ] || { echo "stages moraju biti redom: scan, build, verify, sign, deploy"; exit 1; }
[ "$(yq '.secrets.stage' .gitlab-ci.yml)" = "scan" ] || { echo "job secrets nije u fazi scan"; exit 1; }
yq '.secrets.script | join(" ")' .gitlab-ci.yml | grep -q 'gitleaks git' || { echo "secrets ne pokreće gitleaks git"; exit 1; }
[ "$(yq '.secrets.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "secrets: artifacts when: always"; exit 1; }
grep -q 'glpat-' Dockerfile && { echo "token je i dalje u Dockerfileu"; exit 1; }
git ls-files --error-unmatch .gitleaksignore >/dev/null 2>&1 || { echo ".gitleaksignore nije commitovan"; exit 1; }
gitlab-ci-local secrets > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "job secrets pada"; exit 1; }
t=$(mktemp -d); git clone -q . $t/r; cd $t/r; printf 'K = "AKIAZ7XQ4MPLW2NRT5VB"\n' > n.py; git add n.py; git commit -qm n --no-verify
gitleaks git . --no-banner >/dev/null 2>&1 && { rm -rf $t; echo "nova tajna ne obara provjeru"; exit 1; }
rm -rf $t
-->
<!-- hint
Lab „Tajne u git istoriji“ (modul 3): `.gitleaksignore` pravi se od polja `Fingerprint` iz JSON izvještaja, tek nakon commita koji uklanja token.
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

## Zadatak 2: SAST

- Popravi ERROR nalaze u `app.py` (SQL injection, `shell=True`, `yaml.load`), aplikacija mora i dalje raditi.
- Job `sast` (faza `scan`): Semgrep sa `/opt/kurs/semgrep-rules`, samo ERROR, pada na nalazu, SARIF izvještaj kao artefakt.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.sast.stage' .gitlab-ci.yml)" = "scan" ] || { echo "job sast nije u fazi scan"; exit 1; }
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q -- '--error' || { echo "sast treba --error"; exit 1; }
gitlab-ci-local sast > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "job sast pada"; exit 1; }
semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --quiet app.py >/dev/null 2>&1 || { echo "app.py i dalje ima ERROR nalaze"; exit 1; }
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
Lab „Semgrep nalazi i popravke“ (modul 5).
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

## Zadatak 3: SCA

- Nadogradi `requirements.txt` na verzije bez poznatih ranjivosti (pinovano `==`).
- Frontend nalaze evidentiraj u `osv-scanner.toml` (razlog, `ignoreUntil` najviše 30 dana).
- Job `sca` (faza `scan`): `osv-scanner scan source --offline -r . --config osv-scanner.toml`.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.sca.stage' .gitlab-ci.yml)" = "scan" ] || { echo "job sca nije u fazi scan"; exit 1; }
yq '.sca.script | join(" ")' .gitlab-ci.yml | grep -q 'osv-scanner' || { echo "sca ne pokreće osv-scanner"; exit 1; }
osv-scanner scan source --offline -L requirements.txt >/dev/null 2>&1 || { echo "requirements.txt i dalje ima ranjive verzije (ne ignoriši ih)"; exit 1; }
python3 - <<'EOF' || exit 1
import tomllib, datetime, sys
now = datetime.datetime.now(datetime.timezone.utc)
for it in tomllib.load(open("osv-scanner.toml", "rb")).get("IgnoredVulns", []):
    u = it.get("ignoreUntil")
    if not u or len(str(it.get("reason", "")).split()) < 3:
        sys.exit(f"{it.get('id')}: treba reason i ignoreUntil")
    if isinstance(u, datetime.date) and not isinstance(u, datetime.datetime):
        u = datetime.datetime.combine(u, datetime.time(), datetime.timezone.utc)
    if u.tzinfo is None:
        u = u.replace(tzinfo=datetime.timezone.utc)
    if u <= now or u > now + datetime.timedelta(days=30, hours=12):
        sys.exit(f"{it.get('id')}: ignoreUntil najviše 30 dana")
EOF
gitlab-ci-local sca > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "job sca pada"; exit 1; }
-->
<!-- hint
Lab „Ranjive zavisnosti i prihvatanje rizika“ (modul 6).
-->
<!-- solution
cd /root/kurs-shop
printf 'flask==3.1.3\nwerkzeug==3.1.9\njinja2==3.1.6\nrequests==2.33.0\nPyYAML==6.0.3\ngunicorn==23.0.0\n' > requirements.txt
until=$(date -u -d '+14 days' +%Y-%m-%dT00:00:00Z)
osv-scanner scan source --offline -L frontend/package-lock.json --format json 2>/dev/null \
  | jq -r --arg u "$until" '.results[].packages[].groups[].ids[0] | "[[IgnoredVulns]]\nid = \"\(.)\"\nignoreUntil = \($u)\nreason = \"Frontend migracija na axios 1.x, odobrio AppSec\"\n"' > osv-scanner.toml
yq -i '.sca = {"stage": "scan", "script": ["osv-scanner scan source --offline -r . --config osv-scanner.toml"]}' .gitlab-ci.yml
-->

## Zadatak 4: IaC

- Popravi u `infra/main.tf`: S3 public access block, SSH samo iz `10.0.0.0/8`, baza nije javna i šifrovana je, bez lozinke u kodu.
- Job `iac` (faza `scan`): Checkov nad `infra/` koji prolazi, a pada na svakom novom problemu (baseline ili lista provjera, po izboru).

<!-- verify
cd /root/kurs-shop
[ "$(yq '.iac.stage' .gitlab-ci.yml)" = "scan" ] || { echo "job iac nije u fazi scan"; exit 1; }
checkov -d infra --check CKV_AWS_53,CKV_AWS_54,CKV_AWS_55,CKV_AWS_56,CKV_AWS_24,CKV_AWS_16,CKV_AWS_17 --compact --quiet >/dev/null 2>&1 || { echo "kritične Checkov provjere i dalje padaju"; exit 1; }
grep -Eq '^\s*password\s*=' infra/main.tf && { echo "lozinka baze je i dalje u main.tf"; exit 1; }
gitlab-ci-local iac > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "job iac pada"; exit 1; }
cp infra/main.tf /tmp/m.bak
printf '\nresource "aws_security_group" "provjera" {\n  name        = "provjera"\n  description = "provjera"\n  ingress {\n    description = "SSH"\n    from_port   = 22\n    to_port     = 22\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n' >> infra/main.tf
gitlab-ci-local iac > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/m.bak infra/main.tf
[ $rc -ne 0 ] || { echo "job iac ne pada na novoj security grupi sa otvorenim SSH-om"; exit 1; }
-->
<!-- hint
Lab „Terraform kroz Checkov“ (modul 7). Baseline napravi tek nakon popravki.
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

## Zadatak 5: Dockerfile

- Prepiši `Dockerfile`: multi-stage, fiksne verzije baznih slika, `COPY` umjesto `ADD`, bez tajni, non-root `USER`, exec oblik `CMD`.
- Job `dockerfile-lint` (faza `scan`): hadolint (prag `warning`) i `trivy config` (HIGH/CRITICAL pada).

<!-- verify
cd /root/kurs-shop
[ "$(yq '.["dockerfile-lint"].stage' .gitlab-ci.yml)" = "scan" ] || { echo "job dockerfile-lint nije u fazi scan"; exit 1; }
[ "$(grep -ciE '^FROM ' Dockerfile)" -ge 2 ] || { echo "Dockerfile nije multi-stage"; exit 1; }
u=$(awk 'toupper($1)=="FROM"{u=""} toupper($1)=="USER"{u=$2} END{print u}' Dockerfile)
[ -n "$u" ] && [ "$u" != "root" ] && [ "${u%%:*}" != "0" ] || { echo "završni stage mora imati non-root USER"; exit 1; }
gitlab-ci-local dockerfile-lint > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "job dockerfile-lint pada"; exit 1; }
hadolint --failure-threshold warning Dockerfile >/dev/null 2>&1 || { echo "hadolint javlja upozorenja"; exit 1; }
-->
<!-- hint
Lab „Siguran Dockerfile“ (modul 8).
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

## Zadatak 6: Build, SBOM i skeniranje slike

- Job `build` (faza `build`) pravi sliku `127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA` na `127.0.0.1:5000/python:3.13-slim` sa korisnikom `65532`, upisuje njenu referencu **po digestu** u `image.txt` i pravi CycloneDX SBOM `sbom.cdx.json`. Oba fajla su artefakti.
- Job `image-scan` (faza `verify`, `needs: [build]`) skenira sliku iz `image.txt`: samo ranjivosti, CRITICAL sa dostupnom popravkom obara job.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.build.stage' .gitlab-ci.yml)" = "build" ] || { echo "job build nije u fazi build"; exit 1; }
[ "$(yq '.["image-scan"].stage' .gitlab-ci.yml)" = "verify" ] || { echo "job image-scan nije u fazi verify"; exit 1; }
yq '.["image-scan"].needs[] | (.job // .)' .gitlab-ci.yml | grep -qx build || { echo "image-scan treba needs: [build]"; exit 1; }
rm -f image.txt sbom.cdx.json
gitlab-ci-local build image-scan > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "build ili image-scan pada"; exit 1; }
img=$(cat image.txt 2>/dev/null)
echo "$img" | grep -Eq '^127\.0\.0\.1:5000/kurs-shop@sha256:[0-9a-f]{64}$' || { echo "image.txt treba referencu po digestu (127.0.0.1:5000/kurs-shop@sha256:…), a ima: $img"; exit 1; }
[ "$(crane config --insecure "$img" | jq -r '.config.User')" = "65532" ] || { echo "slika ne radi kao korisnik 65532"; exit 1; }
jq -e '.bomFormat == "CycloneDX" and (.components | length > 50)' sbom.cdx.json >/dev/null 2>&1 || { echo "sbom.cdx.json nije CycloneDX SBOM slike"; exit 1; }
-->
<!-- hint
`kurs-build` na kraju ispisuje referencu po digestu, pa je dovoljno `kurs-build … > image.txt`. SBOM: `syft scan registry:$(cat image.txt) -o cyclonedx-json=sbom.cdx.json`.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.build = {"stage": "build", "script": ["kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA . 65532 > image.txt", "syft scan registry:$(cat image.txt) -q -o cyclonedx-json=sbom.cdx.json"], "artifacts": {"paths": ["image.txt", "sbom.cdx.json"]}}' .gitlab-ci.yml
yq -i '.["image-scan"] = {"stage": "verify", "needs": ["build"], "script": ["trivy image --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 $(cat image.txt)"]}' .gitlab-ci.yml
-->

## Zadatak 7: DAST

- Dodaj sigurnosne headere (`Content-Security-Policy` sa `default-src`, `frame-ancestors`, `form-action`, `base-uri`; `X-Frame-Options`; `X-Content-Type-Options`) i `HttpOnly`/`SameSite` za kolačić.
- Job `dast` (faza `verify`): pokreće aplikaciju i `zap-auto zap/plan.yaml`, čuva `zap-izvjestaj.json` kao artefakt i kad padne.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.dast.stage' .gitlab-ci.yml)" = "verify" ] || { echo "job dast nije u fazi verify"; exit 1; }
[ "$(yq '.dast.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "dast: artifacts when: always"; exit 1; }
yq '.jobs[] | select(.type == "exitStatus") | .parameters.errorLevel' zap/plan.yaml | grep -qx Medium || { echo "ne mijenjaj exitStatus u zap/plan.yaml"; exit 1; }
rm -f zap-izvjestaj.json
timeout 55 gitlab-ci-local dast > /tmp/gcl.log 2>&1 || { tail -12 /tmp/gcl.log; echo "job dast pada"; exit 1; }
[ -s zap-izvjestaj.json ] || { echo "dast nije ostavio zap-izvjestaj.json"; exit 1; }
-->
<!-- hint
Lab „ZAP skeniranje pokrenute aplikacije“ (modul 11). Plan već piše izvještaj u `/root/kurs-shop/zap-izvjestaj.json`.
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

## Zadatak 8: Potpis i deploy

- Job `sign` (faza `sign`, `needs: [build, image-scan, dast]`, samo na podrazumijevanoj grani) potpisuje sliku iz `image.txt` ključem `$COSIGN_KEY` i objavljuje SBOM atestaciju (`--type cyclonedx`). Lab nema transparency log: `--use-signing-config=false --tlog-upload=false`.
- Job `deploy` (faza `deploy`, `needs: [build, sign]`, samo na podrazumijevanoj grani, `environment: production`) prvo provjerava potpis (`cosign verify --key $COSIGN_PUB --insecure-ignore-tlog=true`) slike iz `image.txt`, pa ispisuje `DEPLOY <slika>`. Nepotpisana slika mora oboriti deploy.

<!-- verify
cd /root/kurs-shop
for j in sign deploy; do
  yq ".${j}.rules[].if" .gitlab-ci.yml | grep -q 'CI_COMMIT_BRANCH *== *\$CI_DEFAULT_BRANCH' || { echo "$j treba rules: \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH"; exit 1; }
done
[ "$(yq '.sign.stage' .gitlab-ci.yml)" = "sign" ] && [ "$(yq '.deploy.stage' .gitlab-ci.yml)" = "deploy" ] || { echo "sign i deploy moraju biti u fazama sign i deploy"; exit 1; }
[ "$(yq '.deploy.environment.name // .deploy.environment' .gitlab-ci.yml)" = "production" ] || { echo "deploy treba environment: production"; exit 1; }
yq '.deploy.script | join(" ")' .gitlab-ci.yml | grep -q 'cosign verify' || { echo "deploy ne provjerava potpis"; exit 1; }
rm -f image.txt
gitlab-ci-local build sign deploy > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "build, sign ili deploy pada"; exit 1; }
grep -q "DEPLOY 127.0.0.1:5000/kurs-shop@sha256:" /tmp/gcl.log || { echo "deploy ne ispisuje DEPLOY <slika po digestu>"; exit 1; }
cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true --type cyclonedx "$(cat image.txt)" >/dev/null 2>&1 || { echo "slika nema SBOM atestaciju"; exit 1; }
cp image.txt /tmp/img.bak
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:nepotpisana . 65532 > image.txt
gitlab-ci-local deploy > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/img.bak image.txt
[ $rc -ne 0 ] || { echo "deploy prolazi i sa nepotpisanom slikom"; exit 1; }
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

## Zadatak 9: Cijeli pipeline

Commituj sve izmjene i pokreni cijeli pipeline: `gitlab-ci-local`. Svi jobovi moraju proći, a nijedan sigurnosni job ne smije imati `allow_failure: true`.

<!-- verify
cd /root/kurs-shop
git diff --quiet HEAD && git diff --cached --quiet || { echo "ima necommitovanih izmjena (git status)"; exit 1; }
n=$(yq '[.[] | select(type == "!!map" and .allow_failure == true)] | length' .gitlab-ci.yml)
[ "$n" = "0" ] || { echo "neki job ima allow_failure: true"; exit 1; }
for j in secrets sast sca iac dockerfile-lint build image-scan dast sign deploy; do
  [ "$(yq ".\"$j\" | type" .gitlab-ci.yml)" = "!!map" ] || { echo "nedostaje job $j"; exit 1; }
done
timeout 58 gitlab-ci-local > /tmp/gcl.log 2>&1 || { grep -E 'FAIL|PASS' /tmp/gcl.log | tail -12; echo "pipeline ne prolazi (ili traje duže od minute)"; exit 1; }
-->
<!-- hint
`git status` mora biti čist; generisani fajlovi (`*.sarif`, `image.txt`, `sbom.cdx.json`, `zap-izvjestaj.json`) su već u `.gitignore`.
-->
<!-- solution
cd /root/kurs-shop
git add -A && git commit -qm "DevSecOps pipeline"
-->
