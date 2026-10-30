## What this module covers

Objective **6.1**: DAST with OWASP ZAP, baseline, full and API scans, the automation framework.

**DAST** (Dynamic Application Security Testing) tests a **running** application from the outside, over HTTP, the way an attacker would: it sends requests, inspects the responses and looks for signs of vulnerabilities. It does not see the source code, so it cannot tell which line contains the bug, but it sees what SAST cannot:

- runtime configuration: headers (CSP, HSTS), cookies without `HttpOnly`/`SameSite`, the server version in the `Server` header;
- the behavior of the whole system: framework, reverse proxy, WAF and application together;
- vulnerabilities that can actually be exploited, e.g. an SQL injection that makes it through all layers.

Where it sits in the pipeline:

```text
build ──► image-scan ──► deploy to test environment ──► dast ──► sign ──► deploy prod
                         (review app / service)          │
                                           passive on every MR,
                                           active nightly or before a release
```

DAST runs **after the build**, against the application running in a test environment. Never against production without agreement: an active scan sends real attacks, fills the database with garbage and can take the service down.

Threats DAST catches in `kurs-shop`:

| Endpoint | Problem in the code | What DAST sees |
|---|---|---|
| `/` | `session_hint` cookie without flags, no security headers | Passive rules: cookie, CSP, X-Content-Type-Options, anti-clickjacking |
| `/products?q=` | SQL query built from an f-string | The active SQL Injection rule modifies `q` and sees a different response or a database error |
| `/ping?host=` | `subprocess` with `shell=True` | Active rule Remote OS Command Injection (90020) |
| all | `debug=True`, Werkzeug development server | `Server: Werkzeug/...` header, error pages with a traceback |

### DAST compared to the others

| | SAST (module 05) | DAST |
|---|---|---|
| Input | Source code | URL of the running application |
| Speed | Seconds to minutes | Minutes (passive) to hours (active) |
| False positives | More common (it doesn't know whether a path is reachable) | Rarer for active findings, but they exist (heuristics) |
| Coverage | All the code | Only what the scanner **discovers** (spider, API definition) |
| Fix | Exact line | URL and parameter; the developer has to find the code |

## OWASP ZAP in brief

**ZAP** (Zed Attack Proxy, version 2.17 in the lab) is a proxy that intercepts and sends HTTP requests. In a pipeline it runs without a graphical interface. Building blocks:

- **Spider** (crawler): follows links and forms to discover URLs. The traditional spider reads HTML; the **AJAX spider** and the client spider drive a real browser for JavaScript applications (they need Firefox/Chrome, so we don't use them in the lab).
- **Passive scanner**: only **looks at** requests and responses that went through ZAP anyway (headers, cookies, information leaks). It sends nothing new, so it is safe and fast.
- **Active scanner**: **attacks**: it modifies parameters (SQLi, XSS, command injection, path traversal) and sends new requests.
- **Alert**: a finding with a risk (High, Medium, Low, Informational), a confidence and a **rule ID**.

### Three kinds of scan

ZAP's Docker image (`ghcr.io/zaproxy/zaproxy:stable`) ships ready-made scripts:

| | **Baseline** (`zap-baseline.py`) | **Full** (`zap-full-scan.py`) | **API** (`zap-api-scan.py`) |
|---|---|---|---|
| Discovery | Spider, 1 minute by default (`-m`) | Spider with no time limit (`-m` limits it), optional AJAX (`-j`) | Import of a definition: `-f openapi`, `soap` or `graphql` |
| Attack | **No**, passive only | **Yes**, active scan | **Yes**, an active scan tuned for APIs (`-S` = passive only) |
| Duration | Minutes | Hours | Depends on the number of endpoints |
| Where in the pipeline | Every MR | Nightly or before a release | MR for API services, if fast; otherwise nightly |

Common to all of them:

- `-t` target (URL; for the API scan, the definition), `-r`/`-J`/`-x` report in HTML/JSON/XML,
- `-c` config file with rules, `-g` generates an initial config,
- `-I` don't return an error just because of warnings,
- exit codes: **0** all good, **1** at least one FAIL, **2** at least one WARN (no FAIL), **3** another error.

```bash
# example outside the lab, with Docker
docker run --rm -v "$PWD:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://review-42.kurs-shop.ba -c zap-rules.tsv -J zap.json -r zap.html
```

These scripts nowadays run the **automation framework** internally (unless `--autooff` is given). There is no Docker in the lab, so we use the automation framework directly: it is also more flexible.

## Automation framework

The **automation framework** (AF) describes the whole scan in a single YAML **plan**: the environment (`env`) and a list of jobs (`jobs`) executed in order. The plan lives in the repo next to the code and is changed through an MR, like any other configuration.

```bash
# starter plan templates
zap.sh -cmd -autogenmin /root/kurs-shop/zap/min.yaml   # key parameters
zap.sh -cmd -autogenmax /root/kurs-shop/zap/max.yaml   # all parameters, with comments

# running a plan
zap.sh -cmd -silent -autorun /root/kurs-shop/zap/plan.yaml
```

- `-cmd` starts ZAP without an interface and exits when done.
- `-silent` prevents ZAP from sending anything to the internet on its own (update checks and the like). Always use it in a pipeline: the build must not depend on whether some external service is reachable.
- Without an `exitStatus` job the plan's exit code is 0 (all good), 1 (errors) or 2 (warnings only).
- ZAP's proxy listens on port 8080 by default. If the application is on the same port, ZAP won't start ("Address already in use"), so set a different port: `-port 8090`.

> **In the lab:** `zap-auto <plan.yaml>` is shorthand for `zap.sh -cmd -port 8090 -Xmx768m … -autorun <plan.yaml>` (proxy on 8090, because kurs-shop is on 8080, and limited memory).

### A plan for kurs-shop

The application in the lab runs at `http://127.0.0.1:8080`:

```bash
cd /root/kurs-shop
/opt/app-venv/bin/python app.py > /tmp/app.log 2>&1 &
curl -sf http://127.0.0.1:8080/health
```

A passive plan (equivalent to a baseline scan):

```yaml
# zap/plan.yaml
env:
  contexts:
    - name: kurs-shop
      urls:
        - http://127.0.0.1:8080
      includePaths:
        - "http://127.0.0.1:8080.*"
      excludePaths:
        - ".*/logout.*"
  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true

jobs:
  - type: passiveScan-config
    parameters:
      maxAlertsPerRule: 10
      scanOnlyInScope: true
    rules:
      - id: 10036          # Server Leaks Version Information
        threshold: Low

  - type: spider
    parameters:
      context: kurs-shop
      maxDuration: 2       # minutes

  - type: passiveScan-wait
    parameters:
      maxDuration: 5

  - type: report
    parameters:
      template: traditional-json
      reportDir: /root/kurs-shop/reports
      reportFile: zap-report.json

  - type: report
    parameters:
      template: sarif-json
      reportDir: /root/kurs-shop/reports
      reportFile: zap.sarif

  - type: exitStatus
    parameters:
      errorLevel: High      # any High alert -> exit code 1
      warnLevel: Medium     # Medium (no High) -> exit code 2
```

What each part does:

| Part | Role |
|---|---|
| `env.contexts` | What is in scope: start URLs and include/exclude regexes. ZAP attacks nothing outside the context |
| `env.parameters` | `failOnError`: stop the plan on a job error; `failOnWarning`: stop on a warning too |
| `passiveScan-config` | Thresholds for passive rules (`threshold`: Off, Low, Medium, High), a limit on alerts per rule |
| `spider` | Discovers URLs; `maxDuration` in minutes, `maxDepth`, `maxChildren` |
| `passiveScan-wait` | Waits for the passive scanner to process everything the spider collected. Without it the report may be incomplete |
| `report` | `template` (e.g. `traditional-html`, `traditional-json`, `sarif-json`, `modern`), `reportDir`, `reportFile`, `risks`/`confidences` filters |
| `exitStatus` | Turns findings into an exit code: `errorLevel`, `warnLevel` (Informational, Low, Medium, High) and the values `okExitValue`, `warnExitValue`, `errorExitValue` |

`exitStatus` is the gate. Without it ZAP can find an SQL injection and still return 0.

### Coverage: the scanner tests only what it finds

Run the passive plan against `kurs-shop` and look at which URLs are in the report. The spider starts at `/` and follows links; the home page links only to `/products?q=ka`. The `/ping` and `/import` endpoints are not linked anywhere, so the spider **will never find them** and the active scan will not test them.

Three ways to extend coverage:

1. **API definition** (best for APIs): the `openapi` job with `apiFile` or `apiUrl` imports all endpoints and parameters.
2. **requestor** job: explicit requests that ZAP sends and adds to the site tree.
3. Additional start URLs in `env.contexts[].urls`.

```yaml
  - type: requestor
    requests:
      - url: http://127.0.0.1:8080/ping?host=127.0.0.1
        method: GET
        responseCode: 200
      - url: http://127.0.0.1:8080/import
        method: POST
        data: "ime: kurs"
        headers:
          - "Content-Type: application/x-yaml"

  - type: openapi            # when a definition exists
    parameters:
      apiFile: /root/kurs-shop/openapi.yaml
      targetUrl: http://127.0.0.1:8080
```

> **In practice:** "DAST found nothing" most often means "DAST got nowhere". Before you trust a clean report, check how many URLs the spider found. For API services without an OpenAPI definition DAST is nearly blind: require a definition as part of the "definition of done".

### Active plan (full scan)

You add the active part after the spider and the passive wait:

```yaml
  - type: activeScan
    parameters:
      context: kurs-shop
      maxScanDurationInMins: 20
      maxRuleDurationInMins: 5
    policyDefinition:
      defaultStrength: Medium
      defaultThreshold: Medium
      rules:
        - id: 90020          # Remote OS Command Injection
          strength: High
          threshold: Low
        - id: 40012          # Cross Site Scripting (Reflected)
          threshold: Medium
```

- `maxScanDurationInMins` and `maxRuleDurationInMins` are mandatory in a pipeline. The default is 0 = no limit, and an active scan on a larger application can run for hours.
- **Strength** sets how many requests a rule sends (Low, Medium, High, Insane), **threshold** how certain it must be before reporting (Low = more findings and more false positives).
- A rule is disabled with `threshold: Off`.

Against `kurs-shop` the active scan should report SQL injection on `/products` (parameter `q`) and, if `/ping` is in the site tree, Remote OS Command Injection on the `host` parameter.

### Authentication

Most real applications have a login, and a scanner that is not logged in sees only the login page. The AF describes this in `env.contexts[]`:

- `authentication.method`: e.g. `form`, `json`, `http`, `script`, `browser` or `autodetect`;
- `verification`: how ZAP knows it is still logged in (`loggedInRegex`, `loggedOutRegex`, `poll`);
- `users[].credentials`: username and password, with `${VARIABLE}` from the environment, never in plain text in the plan.

```yaml
env:
  contexts:
    - name: kurs-shop
      urls: [http://127.0.0.1:8080]
      users:
        - name: tester
          credentials:
            username: ${DAST_USER}
            password: ${DAST_PASSWORD}
```

Jobs then get `user: tester`. For DAST, create a dedicated test account in the test environment, with data you are allowed to destroy.

> **In practice:** when the DAST account has administrator rights, the active scan will "click" on deleting users or resetting the database too. Exclude such paths in `excludePaths` (`.*/admin/delete.*`, `.*/logout.*`) or scan as a regular user, and the admin part separately and carefully.

## False positives and exceptions

DAST makes mistakes too: the CSP rule also flags JSON responses that don't need CSP, informational alerts clutter the report. There are two mechanisms.

### Rules file for the packaged scripts

`zap-baseline.py -g zap-rules.tsv` generates a file with all rules set to `WARN`. The format is: rule ID, tab, action, optional name in parentheses.

```text
10010	FAIL	(Cookie No HttpOnly Flag)
10021	FAIL	(X-Content-Type-Options Header Missing)
10038	WARN	(Content Security Policy (CSP) Header Not Set)
10036	IGNORE	(Server Leaks Version Information via "Server" HTTP Response Header Field)
10020	OUTOFSCOPE	http://127.0.0.1:8080/health
```

- `FAIL` gives exit code 1, `WARN` 2, `IGNORE` hides the rule.
- `OUTOFSCOPE` with a URL regex excludes the rule only for those URLs (`*` instead of an ID means all rules).
- Without a config file all findings are `WARN`, so a build with `-I` never fails. The gate exists only once you set the rules that matter to you to `FAIL`.

### The alertFilter job in the plan

In the automation framework the `alertFilter` job does the same, with more precise conditions:

```yaml
  - type: alertFilter
    alertFilters:
      - ruleId: 10038
        newRisk: "False Positive"
        url: "http://127.0.0.1:8080/(health|products).*"
        urlRegex: true
      - ruleId: 10036
        newRisk: Info
```

`newRisk` accepts `False Positive`, `Info`, `Low`, `Medium` or `High`. A filter can be narrowed by `url`, `parameter`, `evidence` or `methods`. Put `alertFilter` **before** the jobs that generate alerts (spider, passive and active scan), so the filters already apply when the alerts are raised.

The rules for exceptions are the same as for every other tool in the course:

- an exception goes through an MR, with a comment in the plan: **why** (e.g. "JSON API, CSP not applicable, see SEC-213") and **until when**;
- narrowed to a URL or parameter, not the whole rule;
- a ZAP plan has no expiry field, so you track the deadline in the comment and in the findings platform (module 12), where the risk acceptance expires.

> **In practice:** don't turn a rule off because it is annoying; fix the cause when that is cheap. Security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`) are added once, in the reverse proxy or a middleware, and half the alerts disappear in all services at once.

## DAST in the pipeline

### GitLab job

In the lab the application is started in the same shell, and ZAP scans `127.0.0.1:8080`:

```yaml
dast-baseline:
  stage: verify
  needs: [build]
  script:
    - /opt/app-venv/bin/python app.py > app.log 2>&1 &
    - for i in $(seq 1 30); do curl -sf http://127.0.0.1:8080/health && break; sleep 1; done
    - mkdir -p reports
    - zap.sh -cmd -silent -autorun "$CI_PROJECT_DIR/zap/plan.yaml"
  artifacts:
    when: always
    paths: [reports/, app.log]
  allow_failure:
    exit_codes: [2]       # warnings only (Medium): yellow, does not block
```

- `exitStatus` in the plan gives 1 for High, 2 for Medium. With `allow_failure: exit_codes: [2]` Medium findings don't stop the pipeline, but High does.
- `artifacts: when: always`: the report is needed most precisely when the job fails.
- Waiting for `/health` before scanning prevents "DAST passed because the application wasn't up".

In real GitLab the application comes in as a **service** in the job (the image from the build) or as a **review app** environment, and the URL is passed through a variable or `environment_url.txt`. The active plan goes into a separate job:

```yaml
dast-full:
  stage: verify
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_COMMIT_TAG
  script:
    - zap.sh -cmd -silent -autorun "$CI_PROJECT_DIR/zap/plan-full.yaml"
  timeout: 1h
  artifacts:
    when: always
    paths: [reports/]
```

GitLab Ultimate has its own DAST analyzer (template `Security/DAST.gitlab-ci.yml`, variable `DAST_TARGET_URL`). The old ZAP-based analyzer was removed in GitLab 17.0; today's is GitLab's browser-based DAST. On GitHub there are ready-made actions `zaproxy/action-baseline`, `zaproxy/action-full-scan` and `zaproxy/action-af`.

### When DAST may fail the build

| Situation | Recommendation |
|---|---|
| Passive scan on an MR, new tool | Informational (`allow_failure: true`) for 2–3 weeks, then FAIL for selected rules |
| Passive scan, mature rules | FAIL for cookies without flags and missing headers that have already been fixed everywhere |
| Active scan, High with Medium confidence or higher | Blocks the release (tag pipeline), not every MR |
| Active scan, Low/Informational | Only in the report and the findings platform |
| Application not up or the spider found no URLs | **Fails** (exit code 3 or a custom check), because "no findings" means nothing then |

> **In practice:** a passive scan on every MR is cheap and fast, so don't skimp on it. Run the active scan nightly against a stable test environment and send the results to the findings platform. Developers don't want to wait an hour on an MR, and active findings need manual verification before they become a ticket anyway.

### Legal and operational rules

- Actively scan only systems you own or for which you have **written authorization**. An active scan is, technically, an attack.
- Announce the scan to the team that runs the environment and to the WAF/IDS; otherwise you will trigger an incident or get blocked.
- A test environment with test data, never a production database.
- Limit duration and rate (`maxScanDurationInMins`, `threadPerHost` in `activeScan-config`).

## Rule ID overview

Rules are referenced by ID in plans, rules files and reports. Common rules (verified on zaproxy.org/docs/alerts):

| ID | Rule | Type |
|---|---|---|
| 10010 | Cookie No HttpOnly Flag | Passive |
| 10020 | Missing Anti-clickjacking Header | Passive |
| 10021 | X-Content-Type-Options Header Missing | Passive |
| 10023 | Information Disclosure - Debug Error Messages | Passive |
| 10035 | Strict-Transport-Security Header Not Set | Passive |
| 10036 | Server Leaks Version Information via "Server" HTTP Response Header Field | Passive |
| 10038 | Content Security Policy (CSP) Header Not Set | Passive |
| 10054 | Cookie without SameSite Attribute | Passive |
| 90022 | Application Error Disclosure | Passive |
| 40012 | Cross Site Scripting (Reflected) | Active |
| 40018 | SQL Injection | Active |
| 90020 | Remote OS Command Injection | Active |

Some IDs also have a variant suffix (e.g. `10038-1`, `10020-1`) in the *alert reference* field; the rule is configured by its base ID, and `alertFilter` accepts both.

## Summary

- DAST tests a running application from the outside and sees runtime configuration and actually exploitable vulnerabilities, but only on the URLs it discovers.
- Baseline = spider + passive (every MR), full = active attack (nightly or before a release), API = import of an OpenAPI/SOAP/GraphQL definition + active scan.
- The automation framework plan (`env` + `jobs`) lives in the repo and is run with `zap.sh -cmd -silent -autorun plan.yaml`.
- `passiveScan-wait` before the report, `exitStatus` (`errorLevel`, `warnLevel`) as the gate; without it ZAP passes even with a High finding.
- Coverage: unlinked endpoints (`/ping`, `/import`) stay untested until you add them via `openapi`, `requestor` or additional URLs.
- False positives: a rules file (`IGNORE`/`WARN`/`FAIL`/`OUTOFSCOPE`) for the packaged scripts, `alertFilter` (`newRisk: False Positive`) in the plan, always narrowed and with a reason.
- Active scanning only with authorization, against a test environment, with time limits.
