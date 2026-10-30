## What this module covers

Objective **3.1**: **SAST** (Static Application Security Testing) with Semgrep. We write rules, use **taint analysis**, reduce false positives and export results to **SARIF**.

| Where in the pipeline | What it does | Which threat it prevents |
|---|---|---|
| Locally / pre-commit | fast scan of changed files | the developer gets feedback before pushing |
| Merge request job | scan for **new** findings only, relative to the target branch | vulnerable code getting into `main` |
| Pipeline on `main` / nightly | full scan, report in SARIF/GitLab format | technical debt nobody tracks |

SAST reads source code without running the application and looks for patterns that lead to vulnerabilities: SQL injection, command injection, insecure deserialization, hardcoded secrets, debug mode. In `kurs-shop/app.py` we have all of these, on purpose.

### SAST compared to other testing

| | **SAST** | **SCA** | **DAST** | **IAST** |
|---|---|---|---|---|
| What it analyzes | your source code | dependencies (lockfiles, packages) | the running application, from outside | the running application, from inside (agent) |
| When in the pipeline | early: commit, MR | early: commit, MR, and continuously after new CVEs | late: after deploying to a test environment | during tests (functional or QA) |
| Pinpoints the line | yes | the package and version | no, only the URL and parameter | yes |
| Typical false positives | many, if the rules aren't tuned | a vulnerability in code that is never called | fewer, but it misses a lot | few |
| Tool in the course | Semgrep | osv-scanner, Trivy (module 06) | OWASP ZAP (module 11) | (not in the course) |

None of them replaces another. Example: `PyYAML==5.3.1` is a vulnerable version (an SCA finding), but `yaml.load(..., Loader=yaml.Loader)` is insecure **even on the latest version** because it is an explicitly unsafe loader. Only SAST finds that problem.

## Semgrep: CE and the paid platform

**Semgrep Community Edition (CE)** is an open source CLI. Rules are YAML and look like the code they search for, so any developer can write them, not just the AppSec team.

| | Semgrep CE | Semgrep AppSec Platform (Code/Pro) |
|---|---|---|
| Pattern and taint rules | yes | yes |
| Taint analysis | within a single function (intraprocedural) | across functions (`--pro-intrafile`) and across files (`--pro`, interfile) |
| Rules | yours + public community rules | plus Pro rules |
| Finding management, triage, MR comments | no (you build it in CI) | yes, a web application |
| Supply Chain (SCA with reachability), Secrets | no | yes, as separate products |

The lab runs **Semgrep 1.179 CE without network access**: registry rules (`--config p/python`, `--config auto`) are not available. We use local rules in `/opt/kurs/semgrep-rules/python.yml` and the ones we write ourselves.

For context: in 2025 **Opengrep** appeared, a community fork of the Semgrep CE engine, after Semgrep changed the license of its rules. The rule syntax is the same, so everything in this module applies to it as well.

## First scan

```bash
cd /root/kurs-shop
semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off
```

Result (abbreviated, six findings):

```
app.py
   ❯❯❱ opt.kurs.semgrep-rules.kurs.python.sqli-string-query
          The SQL query is built by string concatenation or an f-string...
           36┆ rows = get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE
   ❯❯❱ opt.kurs.semgrep-rules.kurs.python.flask-request-to-sql
           36┆ rows = get_db().execute(f"SELECT id, name, price FROM products WHERE name LIKE
   ❯❯❱ opt.kurs.semgrep-rules.kurs.python.subprocess-shell-true
           43┆ out = subprocess.check_output("ping -c 1 " + host, shell=True)
  ...
```

Note the `opt.kurs.semgrep-rules.` prefix: when rules are loaded from a local file or directory, Semgrep prepends the path to the file to the rule ID (with dots instead of `/`). This matters in two places: `# nosemgrep: kurs.python.sqli-string-query` works with the short ID too, but `--exclude-rule` requires the **full** ID (`--exclude-rule opt.kurs.semgrep-rules.kurs.python.flask-debug`), otherwise it silently excludes nothing. That is why in the pipeline you always run rules from the same relative path (e.g., `semgrep-rules/`), so that the IDs in reports and exceptions stay stable.

Useful flags:

| Flag | What it does |
|---|---|
| `--config <file\|dir>` | rules (can be repeated) |
| `--metrics=off` | no telemetry (the lab also sets `SEMGREP_SEND_METRICS=off`) |
| `--error` | exit code 1 if there are findings; **without it Semgrep returns 0 even when it finds problems** |
| `--severity ERROR` | only rules of that severity (INFO, WARNING, ERROR; can be repeated) |
| `--json`, `--sarif`, `--gitlab-sast` | output format on stdout |
| `--json-output=f`, `--sarif-output=f`, `--gitlab-sast-output=f` | a copy in that format to a file; several at once are allowed |
| `--exclude <glob>`, `--include <glob>` | file filtering |
| `--exclude-rule <id>` | exclude one rule for this scan (full ID, with the path prefix) |
| `--baseline-commit <sha>` | report only findings that were not present in that commit |

Exit codes: `0` success (or findings without `--error`), `1` findings with `--error`, `2` Semgrep failed, `7` invalid rule. In the pipeline, distinguish 1 (the gate's business) from 2 and 7 (the business of whoever maintains the job).

## Anatomy of a rule

```yaml
rules:
  - id: kurs.python.requests-no-timeout
    languages: [python]
    severity: WARNING
    message: >-
      requests.$METHOD without a timeout parameter can block a worker forever.
      Add timeout=(3, 10).
    metadata:
      cwe: "CWE-400: Uncontrolled Resource Consumption"
      category: security
      confidence: HIGH
    patterns:
      - pattern: requests.$METHOD(...)
      - metavariable-regex:
          metavariable: $METHOD
          regex: ^(get|post|put|patch|delete|head)$
      - pattern-not: requests.$METHOD(..., timeout=$T, ...)
```

Required: `id`, `languages`, `severity`, `message` and at least one pattern operator. `metadata` is free-form, but you later use `cwe`, `owasp` and `confidence` for filtering and reporting.

Building blocks:

| Operator | Meaning |
|---|---|
| `pattern` | the code you are looking for; `...` means "anything", `$X` is a metavariable |
| `patterns` | logical AND: all conditions must hold |
| `pattern-either` | logical OR |
| `pattern-not` | exclude this form |
| `pattern-inside` / `pattern-not-inside` | the finding must (must not) be inside this context |
| `metavariable-regex` | the metavariable must match the regex |
| `focus-metavariable` | the finding highlights only the part of the code bound to the metavariable |
| `fix` | a suggested fix; applied with `--autofix` |

Semgrep understands code, not text: `$APP.config["SECRET_KEY"] = "..."` also catches variants with a different variable name or different spacing, `subprocess.$FUNC(..., shell=True, ...)` catches `shell=True` in any position, and `from subprocess import run` followed by `run(...)` is resolved to `subprocess.run`.

### Excluding safe forms

The lab rule for YAML catches only explicitly unsafe loaders. A broader version of the rule would be "every `yaml.load` except with `SafeLoader`":

```yaml
    patterns:
      - pattern: yaml.load(...)
      - pattern-not: yaml.load(..., Loader=yaml.SafeLoader, ...)
      - pattern-not: yaml.load(..., Loader=yaml.CSafeLoader, ...)
    fix: yaml.safe_load($DATA)
```

Be careful with `fix`: it only works if `$DATA` is bound in the pattern. Without that, it is better to leave a textual recommendation in `message`.

### Testing rules

Rules are code and should be tested. Semgrep looks for a test file with the same name next to the rule, containing the annotations `# ruleid: <id>` (there must be a finding here) and `# ok: <id>` (there must not be one here):

```python
# /root/kurs-rules/requests-timeout.py
import requests

# ruleid: kurs.python.requests-no-timeout
requests.get("https://api.kurs-shop.ba/stock")

# ok: kurs.python.requests-no-timeout
requests.get("https://api.kurs-shop.ba/stock", timeout=5)
```

```bash
semgrep --test /root/kurs-rules/
```

Add this test to the pipeline of the rules repo; that way a rule change cannot silently stop finding what it used to find.

> **In practice:** Don't try to write the perfect rule right away. Start with a single pattern from a real incident or pentest finding ("this bug must not happen again"), add `ruleid` and `ok` examples, then tighten the rule as false positives come in. Organization-specific rules (your ORM, your auth decorator) catch things that no generic ruleset knows about.

## Taint analysis

The pattern rule `kurs.python.sqli-string-query` catches every f-string in `execute`, including this perfectly safe one:

```python
TABLE = "products"
conn.execute(f"SELECT COUNT(*) FROM {TABLE}")
```

**Taint analysis** follows the data flow: there is a finding only if data from an untrusted **source** reaches a dangerous **sink** without passing through a **sanitizer** along the way.

```yaml
rules:
  - id: kurs.python.flask-request-to-shell
    languages: [python]
    severity: ERROR
    mode: taint
    message: An HTTP request parameter reaches a command executed through a shell.
    metadata:
      cwe: "CWE-78: OS Command Injection"
    pattern-sources:
      - pattern: flask.request.args.get(...)
      - pattern: flask.request.form[...]
    pattern-sanitizers:
      - pattern: shlex.quote(...)
      - pattern: ipaddress.ip_address(...)
    pattern-sinks:
      - patterns:
          - pattern: subprocess.$F($CMD, ..., shell=True, ...)
          - focus-metavariable: $CMD
```

For the `/ping` route: `host = request.args.get(...)` is the source, `"ping -c 1 " + host` carries the taint further through string concatenation, and the first argument of `check_output(..., shell=True)` is the sink. If a developer adds `host = str(ipaddress.ip_address(host))`, the finding disappears because the value has passed through a sanitizer.

`focus-metavariable` matters: without it the sink would be the whole call, so taint in any argument (e.g., `timeout`) would produce a finding.

The lab rule `kurs.python.flask-request-to-sql` does the same for SQL: source `flask.request.$ATTR.get(...)`, sink the first argument of `$DB.execute(...)`.

### CE limitation: a single function

In CE, taint works within a single function. The lab rules **do not see** this code (verified on Semgrep CE):

```python
def find_products(q):
    query = "SELECT * FROM products WHERE name LIKE '%" + q + "%'"
    return get_db().execute(query).fetchall()

@app.route("/search")
def search():
    q = request.args.get("q", "")
    return jsonify(find_products(q))
```

The source (`request.args.get`) is in `search`, and the sink (`execute`) is in `find_products`; CE does not follow taint through a parameter into another function. The `sqli-string-query` pattern rule doesn't help either, because the query is not built directly in the `execute(...)` call but in the `query` variable. Semgrep Pro would follow the flow through the function (interprocedural), and with interfile analysis across modules as well.

CE mostly catches the reverse case: if an untrusted value is passed to a helper function that returns a string (`execute(build_query(q))`), taint by default "passes" through the call to an unknown function and there is a finding.

With CE, the gaps are compensated by a combination: broader pattern rules (e.g., `pattern-inside` a function that builds SQL), taint rules for direct flows, code review, and DAST that attacks such a route from outside (module 11).

## False positives and exceptions

Developers quickly stop looking at a tool that shouts about everything. The order for handling a false positive:

1. **Fix the rule** if the problem is in the rule (add a `pattern-not`, a sanitizer, narrow the source). One rule change removes the false positive everywhere.
2. **An inline exception** for an individual case, always with the rule ID and a reason:

```python
# the value is a constant from the code, not user input; AppSec-412, review 2027-01
conn.execute(f"SELECT COUNT(*) FROM {TABLE}")  # nosemgrep: kurs.python.sqli-string-query
```

`# nosemgrep` without an ID silences **all** rules on that line, including future ones. Forbid it in code review (or write a Semgrep rule that catches it).

3. **Exclude paths** that are not production code, in `.semgrepignore` at the repo root (gitignore syntax):

```
tests/
frontend/node_modules/
*.min.js
```

4. **Exclude a rule** for the whole project (`--exclude-rule`) only with a decision recorded in the repo (e.g., `SECURITY.md` or a comment next to the CI job): which rule, why, who approved it, until when.

| Mechanism | Scope | When |
|---|---|---|
| changing the rule | all repos that use the rule | the rule is wrong |
| `# nosemgrep: <id>` | one line | the code has been checked and is safe |
| `.semgrepignore` | paths | tests, generated and vendored code |
| `--exclude-rule` | the whole scan | the rule doesn't fit this project |
| `--baseline-commit` | old findings | introducing the tool into an existing repo |

> **In practice:** Don't exclude tests automatically. A hardcoded token in `tests/` is still a real token. Exclude tests for injection rules (where the input is intentionally dangerous), but not for secrets rules.

## Semgrep in the pipeline

### Your own job (GitLab)

```yaml
stages: [build, test, security]

semgrep:
  stage: security
  image: semgrep/semgrep:1.179.0
  variables:
    SEMGREP_SEND_METRICS: "off"
  script:
    - >
      semgrep scan
      --config semgrep-rules/
      --severity ERROR
      --error
      --sarif-output=semgrep.sarif
      --gitlab-sast-output=gl-sast-report.json
  artifacts:
    when: always
    paths: [semgrep.sarif]
    reports:
      sast: gl-sast-report.json
```

- `--error` + `--severity ERROR`: the build fails only on ERROR rules; WARNING is visible in the report but doesn't block.
- `artifacts:when: always`: the report is kept even when the job fails (which is when it is needed most).
- `artifacts:reports:sast` expects the **GitLab SAST JSON** format, not SARIF; hence `--gitlab-sast-output`. We keep SARIF as a regular artifact for other tools (DefectDojo, GitHub, IDE).

In the lab you run the same job with `gitlab-ci-local semgrep`.

### Only new findings in the merge request

On an existing repo with 300 old findings, no MR would pass. A **diff-aware** scan reports only what the MR introduced:

```yaml
semgrep-mr:
  stage: security
  image: semgrep/semgrep:1.179.0
  variables:
    GIT_DEPTH: 0               # history is needed so the baseline commit exists locally
  script:
    - semgrep scan --config semgrep-rules/ --error --baseline-commit "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

Old findings go into the backlog and are tracked through the full scan on `main` (module 12).

### GitLab SAST template

```yaml
include:
  - template: Jobs/SAST.gitlab-ci.yml

variables:
  SAST_EXCLUDED_PATHS: "tests, frontend/node_modules"
```

The template adds a `semgrep-sast` job (a Semgrep analyzer with rules maintained by GitLab) and works on all tiers; on Ultimate you get **GitLab Advanced SAST** (`GITLAB_ADVANCED_SAST_ENABLED: "true"`) with cross-file analysis, findings shown in the MR and the security dashboard. Your own job gives you control over the rules and the version; the template means less maintenance. A common combination: the template for general findings plus your own job only for organizational rules.

### GitHub Actions equivalent

```yaml
jobs:
  semgrep:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    container: semgrep/semgrep:1.179.0
    steps:
      - uses: actions/checkout@v4
      - run: semgrep scan --config semgrep-rules/ --sarif-output=semgrep.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif
```

GitHub shows SARIF in the Code scanning tab and as annotations in the pull request.

> **In practice:** Introduce a new SAST tool in three steps. (1) Two weeks of reporting only, `allow_failure: true`, and you read the findings with the team. (2) Block only new ERROR findings with high `confidence` in the MR. (3) Gradually add rules to the blocking set once they show a low false-positive rate. If any blocking rule has more than a few percent false positives, developers start writing `nosemgrep` en masse and you lose their trust.

## SARIF

**SARIF** (Static Analysis Results Interchange Format) 2.1.0 is an OASIS standard for static analysis results. Almost all scanners export it (Semgrep, osv-scanner, Trivy, Checkov, gitleaks), and it is read by GitHub, GitLab (via a converter), DefectDojo and IDE extensions.

Structure (abbreviated):

```json
{
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "Semgrep OSS", "rules": [ { "id": "semgrep-rules.kurs.python.subprocess-shell-true" } ] } },
    "results": [{
      "ruleId": "semgrep-rules.kurs.python.subprocess-shell-true",
      "level": "error",
      "message": { "text": "subprocess with shell=True ..." },
      "locations": [{ "physicalLocation": {
        "artifactLocation": { "uri": "app.py" },
        "region": { "startLine": 43 } } }],
      "fingerprints": { "matchBasedId/v1": "requires login" }
    }]
  }]
}
```

- `runs[]`: one run per tool; a single SARIF file can combine several tools.
- `level`: `error`, `warning`, `note`, `none`.
- **fingerprints** / `partialFingerprints`: a stable identity for a finding, so the platform recognizes the same finding after the code moves a few lines (deduplication). Semgrep CE writes only the placeholder `requires login` here (the platform provides the real fingerprint), so aggregation tools like DefectDojo deduplicate CE findings by rule, file and line (module 12).

Quick reading in the shell:

```bash
jq '.runs[0].results | length' semgrep.sarif
jq -r '.runs[0].results[] | "\(.ruleId)  \(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine)"' semgrep.sarif
jq '[.runs[0].results[] | select(.level == "error")] | length' semgrep.sarif
```

## Fixing kurs-shop

| Finding | Fix |
|---|---|
| `kurs.python.sqli-string-query` / `flask-request-to-sql` | `execute("... WHERE name LIKE ?", (f"%{q}%",))` |
| `kurs.python.subprocess-shell-true` | validate `host` (`ipaddress.ip_address`) and call `subprocess.run(["ping", "-c", "1", host], timeout=5)` without `shell=True` |
| `kurs.python.yaml-unsafe-load` | `yaml.safe_load(request.data)` |
| `kurs.python.flask-debug` | `debug=os.environ.get("FLASK_DEBUG") == "1"` or a production server (gunicorn) |
| `kurs.python.flask-hardcoded-secret-key` | `app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]`, with the value from Vault (module 04) |

After the fix, `semgrep scan --config /opt/kurs/semgrep-rules/ --error` must return 0. Also write an `ok:` test for each fixed form, so that the rule doesn't later start catching correct code.

> **In practice:** The rule's message is part of the fix. A developer closes "Possible SQL injection" as a false positive; "Use parameters: `execute(sql, (value,))`" with a link to an internal example gets fixed in the same MR. Write messages as if they will be read by someone who has never heard of CWE.

## Summary

- SAST reads source code and finds vulnerable patterns; it complements SCA (dependencies) and DAST (the running application), it doesn't replace them.
- A Semgrep rule: `id`, `languages`, `severity`, `message` and the operators `pattern`, `patterns`, `pattern-either`, `pattern-not`, `pattern-inside`, `metavariable-regex`, `focus-metavariable`.
- `mode: taint` with `pattern-sources`, `pattern-sinks` and `pattern-sanitizers` reports only real flows of untrusted data; in CE only within a single function, interprocedural and interfile are in the Pro version.
- Test rules with `# ruleid:` / `# ok:` and `semgrep --test`.
- Handle false positives first in the rule, then with `# nosemgrep: <id>` plus a reason, then `.semgrepignore`; never `nosemgrep` without an ID.
- In CI: `--error` (without it, exit 0), `--severity` for the threshold, `--baseline-commit` for only new findings in the MR, `artifacts:when: always`.
- GitLab `artifacts:reports:sast` requires GitLab SAST JSON (`--gitlab-sast-output`); SARIF 2.1.0 is the common format for GitHub, DefectDojo and others.
