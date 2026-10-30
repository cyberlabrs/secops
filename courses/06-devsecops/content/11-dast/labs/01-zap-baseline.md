# Lab 1: ZAP skeniranje pokrenute aplikacije

SAST čita kod; **DAST** napada aplikaciju koja radi, spolja, preko HTTP-a. Pokrenućeš kurs-shop, skenirati ga **OWASP ZAP**-om kroz automation framework (pasivni sken, kao `zap-baseline`), popraviti sigurnosne headere i dodati DAST job sa pragom.

ZAP se u labu pokreće komandom `zap-auto <plan.yaml>` (ZAP bez GUI-ja, proxy na portu 8090, jer je aplikacija na 8080). Sken traje 10–20 sekundi.

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

## Prvi sken

Pokreni plan `/root/zap/plan.yaml` nad aplikacijom (`kurs-shop-start` je već pokrenuo aplikaciju). Izvještaj nastaje u `/root/zap/izvjestaj.json`. U `/root/zap/alarmi.txt` upiši ID pravila (`pluginid`) svakog alarma rizika **Medium**, jedan po redu.

```bash
zap-auto /root/zap/plan.yaml
jq -r '.site[].alerts[] | [.pluginid, .riskdesc, .name] | @tsv' /root/zap/izvjestaj.json
```

<!-- verify
[ -s /root/zap/izvjestaj.json ] || { echo "nema /root/zap/izvjestaj.json: pokreni zap-auto /root/zap/plan.yaml"; exit 1; }
jq -e '.site[] | select(.["@name"] | test("127.0.0.1:8080"))' /root/zap/izvjestaj.json >/dev/null 2>&1 || { echo "izvještaj nije za http://127.0.0.1:8080"; exit 1; }
want=$(jq -r '[.site[].alerts[] | select(.riskcode == "2") | .pluginid] | unique | .[]' /root/zap/izvjestaj.json | sort)
[ -n "$want" ] || { echo "izvještaj nema Medium alarma"; exit 1; }
[ "$(tr -d ' \r' < /root/zap/alarmi.txt 2>/dev/null | grep . | sort -u)" = "$want" ] || { echo "alarmi.txt ne sadrži tačno pluginid-jeve Medium alarma"; exit 1; }
-->
<!-- hint
U `traditional-json` izvještaju `riskcode` je string: `"3"` High, `"2"` Medium, `"1"` Low, `"0"` Informational.
```bash
jq -r '.site[].alerts[] | select(.riskcode == "2") | .pluginid' /root/zap/izvjestaj.json | sort -u
```
-->
<!-- solution
zap-auto /root/zap/plan.yaml >/dev/null 2>&1
jq -r '.site[].alerts[] | select(.riskcode == "2") | .pluginid' /root/zap/izvjestaj.json | sort -u > /root/zap/alarmi.txt
-->

## Popravi headere i kolačić

U `app.py` dodaj funkciju sa `@app.after_request` koja svakom odgovoru postavlja:

- `Content-Security-Policy` sa direktivama `default-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'` (`form-action`, `base-uri` i `frame-ancestors` ne nasljeđuju vrijednost od `default-src`, pa ih ZAP traži posebno),
- `X-Frame-Options: DENY`,
- `X-Content-Type-Options: nosniff`,

i kolačić `session_hint` postavi sa `httponly=True` i `samesite="Lax"`.

Ponovo pokreni aplikaciju (`kurs-shop-start`) i sken. U novom izvještaju ne smije biti nijednog Medium ili High alarma, niti alarma za nedostajući `X-Content-Type-Options` i kolačić bez HttpOnly.

<!-- verify
h=$(curl -si http://127.0.0.1:8080/ 2>/dev/null) || { echo "aplikacija ne radi na 8080: kurs-shop-start"; exit 1; }
echo "$h" | grep -qi '^Content-Security-Policy:' || { echo "aplikacija koja radi ne šalje Content-Security-Policy (restartuj je: kurs-shop-start)"; exit 1; }
echo "$h" | grep -qi '^X-Frame-Options: *\(DENY\|SAMEORIGIN\)' || { echo "nema X-Frame-Options: DENY"; exit 1; }
echo "$h" | grep -qi '^X-Content-Type-Options: *nosniff' || { echo "nema X-Content-Type-Options: nosniff"; exit 1; }
echo "$h" | grep -i '^Set-Cookie: *session_hint' | grep -qi 'httponly' || { echo "kolačić session_hint nema HttpOnly"; exit 1; }
echo "$h" | grep -i '^Set-Cookie: *session_hint' | grep -qi 'samesite' || { echo "kolačić session_hint nema SameSite"; exit 1; }
[ /root/zap/izvjestaj.json -nt /root/kurs-shop/app.py ] || { echo "izvještaj je stariji od izmjene app.py: ponovo pokreni sken"; exit 1; }
jq -e '[.site[].alerts[] | select((.riskcode | tonumber) >= 2)] | length == 0' /root/zap/izvjestaj.json >/dev/null || { echo "novi izvještaj i dalje ima Medium/High alarme"; exit 1; }
jq -e '[.site[].alerts[].pluginid] | (index("10021") or index("10010")) | not' /root/zap/izvjestaj.json >/dev/null || { echo "novi izvještaj i dalje ima alarm 10021 ili 10010"; exit 1; }
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

## Prag i DAST job

1. Dodaj na kraj plana job `exitStatus` sa `errorLevel: Medium`: ZAP tada vraća grešku (izlazni kod 1) ako postoji alarm rizika Medium ili višeg. Ne postavljaj `warnLevel`: sa njim ZAP vraća izlazni kod 2 i za Low alarme (npr. `Server` header sa verzijom), pa bi CI job pao.
2. Dodaj job `dast` (faza `test`) koji pokrene aplikaciju (`kurs-shop-start`) i plan (`zap-auto /root/zap/plan.yaml`), i čuva izvještaj kao artefakt i kad padne. Kopiraj ga u repo ako treba: putanje artefakata su relativne u odnosu na repo.
3. `gitlab-ci-local dast` mora proći sa popravljenom aplikacijom.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.jobs[] | select(.type == "exitStatus") | .parameters.errorLevel' /root/zap/plan.yaml)" = "Medium" ] || { echo "plan nema exitStatus sa errorLevel: Medium"; exit 1; }
s=$(yq '.dast.script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q 'zap-auto' && echo "$s" | grep -q 'kurs-shop-start' || { echo "dast treba pokrenuti aplikaciju (kurs-shop-start) i ZAP (zap-auto)"; exit 1; }
[ "$(yq '.dast.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "dast artefakti trebaju when: always"; exit 1; }
[ "$(yq '.dast.allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "dast ne smije imati allow_failure"; exit 1; }
timeout 50 gitlab-ci-local dast > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job dast pada"; exit 1; }
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
Ako `zap-auto` padne, `cp` se ne izvrši; zato je bolje postaviti `reportDir` na direktorij repoa ili kopirati u `after_script`.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.jobs += [{"type": "exitStatus", "parameters": {"errorLevel": "Medium"}}]' /root/zap/plan.yaml
yq -i '.dast = {"stage": "test", "script": ["kurs-shop-start", "zap-auto /root/zap/plan.yaml"], "after_script": ["cp /root/zap/izvjestaj.json zap-izvjestaj.json"], "artifacts": {"when": "always", "paths": ["zap-izvjestaj.json"]}}' .gitlab-ci.yml
-->
