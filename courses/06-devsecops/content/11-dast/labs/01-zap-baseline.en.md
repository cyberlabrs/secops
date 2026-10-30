# Lab 1: ZAP scan of a running application

SAST reads code; **DAST** attacks a running application from the outside, over HTTP. You will start kurs-shop, scan it with **OWASP ZAP** through the automation framework (a passive scan, like `zap-baseline`), fix the security headers and add a DAST job with a threshold.

In the lab ZAP is run with the `zap-auto <plan.yaml>` command (ZAP without a GUI, proxy on port 8090, because the application is on 8080). A scan takes 10–20 seconds. The report file name `izvjestaj` means "report" and `alarmi` means "alerts"; use the names exactly as given.

```bash
cd /root/kurs-shop
cat /root/zap/plan.yaml
curl -si http://127.0.0.1:8080/ | head -12
```

<!-- setup
set -e
kurs-repo
mkdir -p /root/zap
cat > /root/zap/plan.yaml <<'EOF'
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
      reportDir: /root/zap
      reportFile: izvjestaj
EOF
cat > /usr/local/bin/kurs-shop-start <<'EOF'
#!/bin/bash
# (Ponovo) pokreće kurs-shop na 127.0.0.1:8080 iz /root/kurs-shop
pkill -f '^/opt/app-venv/bin/python app.py' 2>/dev/null; sleep 0.5
cd /root/kurs-shop && (DB_PATH=/tmp/shop.db SECRET_KEY=lab setsid nohup /opt/app-venv/bin/python app.py >/tmp/app.log 2>&1 </dev/null &)
for i in $(seq 40); do curl -fs http://127.0.0.1:8080/health >/dev/null 2>&1 && exit 0; sleep 0.25; done
echo "aplikacija se ne pokreće; pogledaj /tmp/app.log"; exit 1
EOF
chmod +x /usr/local/bin/kurs-shop-start
kurs-shop-start
-->

## First scan

Run the plan `/root/zap/plan.yaml` against the application (`kurs-shop-start` has already started it). The report is written to `/root/zap/izvjestaj.json`. In `/root/zap/alarmi.txt` write the rule ID (`pluginid`) of every alert with **Medium** risk, one per line.

```bash
zap-auto /root/zap/plan.yaml
jq -r '.site[].alerts[] | [.pluginid, .riskdesc, .name] | @tsv' /root/zap/izvjestaj.json
```

<!-- verify
[ -s /root/zap/izvjestaj.json ] || { echo "/root/zap/izvjestaj.json is missing: run zap-auto /root/zap/plan.yaml"; exit 1; }
jq -e '.site[] | select(.["@name"] | test("127.0.0.1:8080"))' /root/zap/izvjestaj.json >/dev/null 2>&1 || { echo "the report is not for http://127.0.0.1:8080"; exit 1; }
want=$(jq -r '[.site[].alerts[] | select(.riskcode == "2") | .pluginid] | unique | .[]' /root/zap/izvjestaj.json | sort)
[ -n "$want" ] || { echo "the report has no Medium alerts"; exit 1; }
[ "$(tr -d ' \r' < /root/zap/alarmi.txt 2>/dev/null | grep . | sort -u)" = "$want" ] || { echo "alarmi.txt does not contain exactly the pluginids of the Medium alerts"; exit 1; }
-->
<!-- hint
In the `traditional-json` report `riskcode` is a string: `"3"` High, `"2"` Medium, `"1"` Low, `"0"` Informational.
```bash
jq -r '.site[].alerts[] | select(.riskcode == "2") | .pluginid' /root/zap/izvjestaj.json | sort -u
```
-->
<!-- solution
zap-auto /root/zap/plan.yaml >/dev/null 2>&1
jq -r '.site[].alerts[] | select(.riskcode == "2") | .pluginid' /root/zap/izvjestaj.json | sort -u > /root/zap/alarmi.txt
-->

## Fix the headers and the cookie

In `app.py` add a function with `@app.after_request` that sets on every response:

- `Content-Security-Policy` with the directives `default-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'` (`form-action`, `base-uri` and `frame-ancestors` don't inherit their value from `default-src`, so ZAP checks for them separately),
- `X-Frame-Options: DENY`,
- `X-Content-Type-Options: nosniff`,

and set the `session_hint` cookie with `httponly=True` and `samesite="Lax"`.

Restart the application (`kurs-shop-start`) and run the scan again. The new report must not contain any Medium or High alert, nor an alert for a missing `X-Content-Type-Options` or a cookie without HttpOnly.

<!-- verify
h=$(curl -si http://127.0.0.1:8080/ 2>/dev/null) || { echo "the application is not running on 8080: kurs-shop-start"; exit 1; }
echo "$h" | grep -qi '^Content-Security-Policy:' || { echo "the running application does not send Content-Security-Policy (restart it: kurs-shop-start)"; exit 1; }
echo "$h" | grep -qi '^X-Frame-Options: *\(DENY\|SAMEORIGIN\)' || { echo "X-Frame-Options: DENY is missing"; exit 1; }
echo "$h" | grep -qi '^X-Content-Type-Options: *nosniff' || { echo "X-Content-Type-Options: nosniff is missing"; exit 1; }
echo "$h" | grep -i '^Set-Cookie: *session_hint' | grep -qi 'httponly' || { echo "the session_hint cookie has no HttpOnly"; exit 1; }
echo "$h" | grep -i '^Set-Cookie: *session_hint' | grep -qi 'samesite' || { echo "the session_hint cookie has no SameSite"; exit 1; }
[ /root/zap/izvjestaj.json -nt /root/kurs-shop/app.py ] || { echo "the report is older than the change to app.py: run the scan again"; exit 1; }
jq -e '[.site[].alerts[] | select((.riskcode | tonumber) >= 2)] | length == 0' /root/zap/izvjestaj.json >/dev/null || { echo "the new report still has Medium/High alerts"; exit 1; }
jq -e '[.site[].alerts[].pluginid] | (index("10021") or index("10010")) | not' /root/zap/izvjestaj.json >/dev/null || { echo "the new report still has alert 10021 or 10010"; exit 1; }
-->
<!-- hint
```python
@app.after_request
def security_headers(resp):
    resp.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
```
```python
resp.set_cookie("session_hint", "anon", httponly=True, samesite="Lax")
```
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
sleep 1
kurs-shop-start
zap-auto /root/zap/plan.yaml >/dev/null 2>&1
-->

## Threshold and DAST job

1. Add an `exitStatus` job with `errorLevel: Medium` at the end of the plan: ZAP then returns an error (exit code 1) if there is an alert with Medium risk or higher. Don't set `warnLevel`: with it ZAP returns exit code 2 for Low alerts too (e.g. the `Server` header with a version), so the CI job would fail.
2. Add a `dast` job (stage `test`) that starts the application (`kurs-shop-start`) and the plan (`zap-auto /root/zap/plan.yaml`), and keeps the report as an artifact even when it fails. Copy it into the repo if needed: artifact paths are relative to the repo.
3. `gitlab-ci-local dast` must pass with the fixed application.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.jobs[] | select(.type == "exitStatus") | .parameters.errorLevel' /root/zap/plan.yaml)" = "Medium" ] || { echo "the plan has no exitStatus with errorLevel: Medium"; exit 1; }
s=$(yq '.dast.script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q 'zap-auto' && echo "$s" | grep -q 'kurs-shop-start' || { echo "dast must start the application (kurs-shop-start) and ZAP (zap-auto)"; exit 1; }
[ "$(yq '.dast.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "dast artifacts need when: always"; exit 1; }
[ "$(yq '.dast.allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "dast must not have allow_failure"; exit 1; }
timeout 50 gitlab-ci-local dast > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the dast job fails"; exit 1; }
-->
<!-- hint
```yaml
  - type: exitStatus
    parameters:
      errorLevel: Medium
```
```yaml
dast:
  stage: test
  script:
    - kurs-shop-start
    - zap-auto /root/zap/plan.yaml
    - cp /root/zap/izvjestaj.json zap-izvjestaj.json
  artifacts:
    when: always
    paths: [zap-izvjestaj.json]
```
If `zap-auto` fails, `cp` doesn't run; so it's better to set `reportDir` to the repo directory or copy in `after_script`.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.jobs += [{"type": "exitStatus", "parameters": {"errorLevel": "Medium"}}]' /root/zap/plan.yaml
yq -i '.dast = {"stage": "test", "script": ["kurs-shop-start", "zap-auto /root/zap/plan.yaml"], "after_script": ["cp /root/zap/izvjestaj.json zap-izvjestaj.json"], "artifacts": {"when": "always", "paths": ["zap-izvjestaj.json"]}}' .gitlab-ci.yml
-->
