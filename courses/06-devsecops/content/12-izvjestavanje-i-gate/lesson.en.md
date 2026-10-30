## What this module covers

Domain 6, findings management:

- **6.2** Aggregating results: SARIF, merge request reports, vulnerability management platforms (DefectDojo).
- **6.3** Quality gates, triage, risk acceptance with expiry, SLAs and metrics (MTTR, escape rate).

By now the pipeline has about ten scanners: gitleaks, Semgrep, osv-scanner, Trivy, Checkov, hadolint, Conftest, ZAP. Each has its own format, its own severities and its own way of handling exceptions. Without aggregation you get two problems:

- **the developer doesn't see the findings**: they are buried in the logs of ten jobs, so they get ignored;
- **the security team doesn't see the big picture**: it doesn't know how many CRITICAL findings are open, how long they have been open, or whether things are improving.

Where this sits in the pipeline:

```text
 gitleaks  semgrep  osv  trivy  checkov  zap        each job: a report (SARIF/JSON) as an artifact
    └────────┴───────┴─────┴──────┴───────┘
                     │
            ┌────────▼────────┐
            │  security-gate  │  one decision: pass / fail (rules + exceptions with expiry)
            └────────┬────────┘
          ┌──────────┴──────────┐
   MR widget / SARIF        DefectDojo   ──►  triage, SLA, risk with expiry, metrics
   (developer, right away)  (security team, over time)
```

The threat this prevents is organizational rather than technical: **alert fatigue**. When every MR has 200 findings, nobody reads even the one real one.

## SARIF 2.1.0: a common language

**SARIF** (Static Analysis Results Interchange Format) is an OASIS standard for analysis results, version **2.1.0**. Almost every tool in this course can write it:

| Tool | Command |
|---|---|
| gitleaks | `gitleaks git --report-format sarif --report-path gitleaks.sarif` |
| Semgrep | `semgrep scan --config ... --sarif --output semgrep.sarif` |
| osv-scanner | `osv-scanner scan source --format sarif --output osv.sarif -r .` |
| Trivy | `trivy fs --format sarif --output trivy.sarif .` |
| Checkov | `checkov -d infra --output sarif --output-file-path reports` |
| hadolint | `hadolint -f sarif Dockerfile > hadolint.sarif` |
| ZAP | `report` job with `template: sarif-json` |

### Structure

```json
{
  "version": "2.1.0",
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "Semgrep",
          "rules": [
            { "id": "kurs.python.sqli-fstring",
              "shortDescription": { "text": "SQL query built from an f-string" },
              "properties": { "tags": ["CWE-89"] } }
          ]
        }
      },
      "results": [
        {
          "ruleId": "kurs.python.sqli-fstring",
          "level": "error",
          "message": { "text": "User input goes directly into an SQL query" },
          "locations": [
            { "physicalLocation": {
                "artifactLocation": { "uri": "app.py" },
                "region": { "startLine": 37 } } }
          ],
          "partialFingerprints": { "primaryLocationLineHash": "8e1c...:1" }
        }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `runs[]` | One run of one tool; a file can contain several runs |
| `tool.driver.rules[]` | The rule catalog (id, description, tags, CWE) |
| `results[].ruleId` | Which rule fired |
| `results[].level` | `error`, `warning`, `note` or `none` |
| `locations[].physicalLocation` | File (`artifactLocation.uri`) and line (`region.startLine`) |
| `partialFingerprints` | A fingerprint of the finding that survives code moving around; used to track "the same finding as yesterday" |
| `suppressions[]` | The finding is suppressed: `kind` (`inSource`, e.g. `# nosemgrep`, or `external`), `status` (`accepted`, `underReview`, `rejected`) |
| `baselineState` | Compared to the baseline: `new`, `unchanged`, `updated`, `absent` |

SARIF was designed for **static analysis** (file and line). Findings without a location in code (a vulnerability in an image, an alert on a URL) fit it less well: the tool invents a location (e.g. `requirements.txt` or the URL as `uri`). That is why SCA and DAST tools often have a richer JSON format of their own, and SARIF is used for display.

`level` is not the same as vulnerability severity. Trivy, for example, maps CRITICAL and HIGH to `error`, MEDIUM to `warning`, LOW to `note`. If the gate decides by severity, read the tool's native JSON or the `properties` in the SARIF, not just `level`.

### Merging SARIF files

For a single overview you can merge the runs of all tools:

```bash
jq -s '{version: "2.1.0", runs: (map(.runs) | add)}' reports/*.sarif > reports/all.sarif

# number of findings per tool and level, excluding suppressed ones
jq -r '.runs[] | .tool.driver.name as $t
       | .results[] | select((.suppressions // []) | length == 0)
       | "\($t)\t\(.level // "warning")"' reports/all.sarif | sort | uniq -c
```

`.level // "warning"` is an important detail: according to the specification, the default level is `warning` if it is set neither in the result nor in the rule.

> **In practice:** don't build your own dashboard out of SARIF. Merging files is useful for the gate and for a quick overview in CI; for history, deduplication and triage use a platform (GitLab vulnerability report, GitHub code scanning, DefectDojo).

## Findings in the merge request

The developer needs to see **new** findings **in the MR**, not in the job log.

### GitLab

| Mechanism | Format | Tier | Where it shows up |
|---|---|---|---|
| `artifacts:reports:sast`, `secret_detection`, `dependency_scanning`, `container_scanning`, `dast` | GitLab security report JSON (its own schema) | Full display in the MR and vulnerability report: Ultimate | MR security widget, Security tab, vulnerability report |
| `artifacts:reports:sarif` | SARIF 2.1.0 | Ultimate (GA in GitLab 19.2) | Same as above, alongside findings from GitLab's scanners |
| `artifacts:reports:codequality` | JSON array (`description`, `check_name`, `fingerprint`, `severity`, `location`) | MR Reports: Free; pipeline tab: Premium; line annotations: Ultimate | MR widget, diff against the target branch |
| `artifacts:reports:junit` | JUnit XML | Free | Test summary in the MR |
| `artifacts:reports:cyclonedx` | CycloneDX SBOM | Ultimate | Dependency list |

A SARIF job for GitLab Ultimate:

```yaml
sast-semgrep:
  stage: scan
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --metrics=off --sarif --output semgrep.sarif .
  artifacts:
    when: always
    paths: [semgrep.sarif]
    reports:
      sarif: semgrep.sarif
```

An important trap: GitLab processes findings from `reports:sarif` **only if the job succeeds**. A job that fails (including a failed job with `allow_failure: true`) leaves the artifact, but the findings never reach the MR. So the scanner in that job must not fail the job (`semgrep` without `--error`, `trivy` with `--exit-code 0`), and the decision to fail is made by a separate **gate job** that reads the same reports. GitLab also has limits (e.g. 20 runs per file, 5,000 results per run, 10 MB); split or filter larger files.

The **Free** and **Premium** tiers have no security widget. A practical workaround is the `codequality` report: a small `jq` converter from SARIF gives the developer findings in the MR, with a "new in this MR" diff.

```bash
# SARIF -> GitLab code quality (basic mapping)
jq '[.runs[] | .tool.driver.name as $t | .results[] | {
      description: "\($t): \(.message.text)",
      check_name: .ruleId,
      fingerprint: ((.partialFingerprints // {} | tostring) + .ruleId
                    + (.locations[0].physicalLocation.artifactLocation.uri // "")) | @base64,
      severity: ({"error":"critical","warning":"major","note":"minor"}[.level // "warning"] // "info"),
      location: { path: (.locations[0].physicalLocation.artifactLocation.uri // "unknown"),
                  lines: { begin: (.locations[0].physicalLocation.region.startLine // 1) } }
    }]' reports/all.sarif > gl-code-quality.json
```

`fingerprint` must be stable across pipelines: GitLab uses it to know a finding is the same one, so the MR shows only new and resolved findings.

### GitHub

GitHub code scanning accepts SARIF directly (GitHub Advanced Security, or free for public repos):

```yaml
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: semgrep.sarif
    category: semgrep
```

The job needs `permissions: security-events: write`. Findings appear as annotations in the pull request and in the Security tab, and `category` distinguishes multiple uploads from the same tool.

> **In practice:** the developer should see three numbers in the MR: how many **new** findings they introduced, how many of them block the merge, and a link to the details. A list of 300 existing findings in every MR teaches people to skip the widget.

## DefectDojo: a findings platform

**DefectDojo** (an OWASP project, open source with a commercial Pro version) ingests reports from hundreds of tools, deduplicates them, tracks them over time and handles triage, SLAs and risk acceptance. The hierarchy in the open source version:

```text
Product Type  (e.g. "Webshop")
 └─ Product   (kurs-shop)
     └─ Engagement  (CI/CD: main branch, or "Pentest 2026-Q4")
         └─ Test    (one scan type: Trivy, Semgrep, ZAP…)
             └─ Finding
```

The Pro version calls the same levels Organization and Asset.

### Importing from the pipeline

DefectDojo has two API endpoints:

| | `/api/v2/import-scan/` | `/api/v2/reimport-scan/` |
|---|---|---|
| What it does | Every upload creates a **new Test** | Updates an existing Test: new findings are added, missing ones are closed, unchanged ones stay |
| When | Separate snapshots (pentest, one-off audit) | A recurring pipeline: CI scan of the same branch |
| History | Many Tests, deduplication across them | One Test per tool, a clear picture of "what is open now" |

```yaml
defectdojo-upload:
  stage: report
  needs:
    - job: sast-semgrep
      artifacts: true
    - job: image-scan
      artifacts: true
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - |
      curl -sf -X POST "$DOJO_URL/api/v2/reimport-scan/" \
        -H "Authorization: Token $DOJO_API_KEY" \
        -F "scan_type=Trivy Scan" \
        -F "file=@reports/trivy.json" \
        -F "product_type_name=Webshop" \
        -F "product_name=kurs-shop" \
        -F "engagement_name=CI main" \
        -F "test_title=trivy-image" \
        -F "auto_create_context=true" \
        -F "close_old_findings=true" \
        -F "minimum_severity=Low" \
        -F "active=true" -F "verified=false"
  allow_failure: true
```

- `scan_type` must exactly match the parser name (e.g. `Trivy Scan`, `ZAP Scan`, `Gitleaks Scan`, `SARIF`). A tool's dedicated parser is usually better than the generic SARIF one, because it knows the severity, CVE, package and version.
- `close_old_findings=true` closes findings that are no longer in the new report: the fix is recorded automatically.
- `auto_create_context` creates the Product and Engagement if they don't exist; useful, but a typo in a name creates a new Product, so keep the names in CI variables.
- `DOJO_API_KEY` is a protected and masked variable, available only on a protected branch.
- `allow_failure: true` because an unavailable DefectDojo must not stop a release. The gate decides in the pipeline; DefectDojo is the record.
- Upload only from the main branch: findings from MR branches that never get merged only create noise.

### Deduplication

The same CVE reported by Trivy and osv-scanner, or the same finding from 30 consecutive pipelines, should be **one** finding. DefectDojo marks a finding as a duplicate by:

- **Unique ID From Tool**: an ID provided by the tool (e.g. a fingerprint);
- **Hash Code**: a hash of selected fields (e.g. title, CWE, file, line), configurable per parser;
- **Unique ID From Tool or Hash Code**: the ID first, then the hash;
- **Legacy** (open source only): an older algorithm that also takes endpoints into account.

> **In practice:** deduplication is the reason to introduce DefectDojo in the first place. Before going to production, upload the same report twice and check that the number of open findings stays the same. If it grows, you have a problem with the fingerprint or the hash fields, and in a month you will have 10,000 duplicates.

## Quality gate

The **quality gate** (security gate) is the place where all findings are turned into a single decision. A good gate answers four questions:

1. **How severe is it?** Severity (CVSS, tool level).
2. **Is it new?** A finding introduced in this MR or old debt (baseline, `--baseline-commit`, `partialFingerprints`).
3. **Can it be fixed?** Is there a fixed version (`--ignore-unfixed`, `FixedVersion`)?
4. **Is it being exploited?** EPSS, CISA KEV.

### CVSS, EPSS and KEV

| | **CVSS v4.0** (FIRST, 2023) | **EPSS** (FIRST) | **CISA KEV** |
|---|---|---|---|
| Question | How bad is the vulnerability if exploited? | How likely is it to be exploited in the next **30 days**? | Is exploitation in real attacks **confirmed**? |
| Value | 0–10 (Base, Threat, Environmental, Supplemental groups) | Probability 0–1 and percentile, updated daily | Yes/no (catalog), with a deadline for US federal agencies |
| Weakness | Most CVEs are HIGH/CRITICAL | A model, not a fact | Covers a small fraction of CVEs |

Combined, they give reasonable prioritization:

| Condition | Decision |
|---|---|
| In KEV | Blocks immediately, regardless of CVSS |
| CRITICAL/HIGH, fix available, high EPSS (e.g. ≥ 0.1) | Blocks |
| CRITICAL/HIGH, fix available, low EPSS | Blocks on the main branch or becomes an SLA ticket, depending on policy |
| No fix | Does not block; exception with expiry and tracking |
| MEDIUM/LOW | Report and platform, does not block |

The lab is offline, so KEV and EPSS are used from local copies (in a real pipeline a nightly job downloads them from `cisa.gov` and `api.first.org` and caches them):

```bash
# CVEs from the Trivy JSON report that are in the KEV catalog
jq -r '.vulnerabilities[].cveID' known_exploited_vulnerabilities.json | sort -u > kev.txt
jq -r '.Results[]?.Vulnerabilities[]?.VulnerabilityID' reports/trivy.json | sort -u \
  | comm -12 - kev.txt
```

### Exceptions as code, with expiry

Every tool has its own exception mechanism (`.gitleaksignore`, `# nosemgrep`, `osv-scanner.toml` with `ignoreUntil`, `.trivyignore.yaml` with `expired_at`, `#checkov:skip`, ZAP `alertFilter`). Where a tool has no expiry, the organization tracks it centrally. A simple form: one file in the repo, changed only through an MR approved by the security team (CODEOWNERS).

```yaml
# security-exceptions.yaml
- id: CVE-2023-30861
  tool: trivy
  reason: "Flask session cookie; the application does not use Flask session behind a caching proxy"
  owner: tim-shop
  approved_by: security
  expires: "2026-12-31"
- id: kurs.python.subprocess-shell
  tool: semgrep
  reason: "Replacement of the ping endpoint in SHOP-412"
  owner: tim-shop
  approved_by: security
  expires: "2026-11-15"
```

The gate also checks whether any exception has expired:

```bash
TODAY=$(date +%F)
EXPIRED=$(yq -r ".[] | select(.expires < \"$TODAY\") | .id" security-exceptions.yaml)
if [ -n "$EXPIRED" ]; then
  echo "Expired exceptions, review needed: $EXPIRED"; exit 1
fi
```

The date is quoted and in ISO form (`YYYY-MM-DD`), so yq compares it as a string, and such a comparison is also chronologically correct.

### The gate job

```yaml
security-gate:
  stage: gate
  needs: [secrets, sast-semgrep, sca, iac, image-scan, dast-baseline]
  script:
    - ./ci/security-gate.sh reports/ security-exceptions.yaml
  artifacts:
    when: always
    paths: [reports/gate-summary.md]
```

Scanner jobs run with exit code 0 and leave their reports (so GitLab can process them), and `security-gate` alone decides. Advantages:

- one policy in one place, not ten thresholds in ten jobs;
- the same exceptions and expiry dates for all tools;
- `gate-summary.md` gives the developer one overview: what blocks, why, what is excepted and until when.

> **In practice:** the gate needs an **emergency exit** that leaves a trail, e.g. a `SECURITY_GATE_OVERRIDE` variable that only a maintainer can set, with a mandatory ticket link. Without it, at the first urgent production fix someone will delete the gate from `.gitlab-ci.yml` and never put it back.

## Triage

**Triage** is deciding what a finding is and what you do with it. States (names as in DefectDojo):

| State | Meaning | Who decides |
|---|---|---|
| Active, not Verified | A new tool finding nobody has looked at yet | — |
| Verified | Confirmed to be real | Security or the team |
| False Positive | The tool was wrong; document why and tune the rule so it doesn't recur | Security |
| Out of Scope | Not our code/system (e.g. a test fixture) | The team with security |
| Risk Accepted | Real, but we knowingly don't fix it **until a date** | The risk owner (not the developer alone) |
| Mitigated | Fixed (or closed when the finding disappears from a reimport) | Automatically or the team |
| Duplicate | Same as another finding | Automatically (deduplication) |

A false positive and an accepted risk are not the same: a false positive means "there is no problem", an accepted risk means "the problem exists, but we tolerate it temporarily". Mixing the two up is the most common way real vulnerabilities disappear from the record.

### Risk acceptance with expiry

In DefectDojo a **Risk Acceptance** has:

- the findings it applies to, the justification and who accepted it,
- an **expiration date**; without one, the default number of days from the system settings is used,
- options to **reactivate** the findings on expiry (`reactivate_expired`) and to **restart** the SLA (`restart_sla_expired`).

When the date passes, the finding returns to Active and again blocks the gate or starts the SLA. It's the same idea as `expired_at` in `.trivyignore.yaml`: an exception that never expires is a permanently disabled control.

> **In practice:** keep risk acceptance periods short (30–90 days) and tied to severity. When one expires, the owner must confirm the decision again. If you accept the same risk for the fourth time, it is no longer an exception but a decision not to fix it, and it should be recorded as such at management level.

## SLAs and metrics

### SLA by severity

The **SLA** (remediation deadline) depends on severity and is counted from the moment of discovery. An example policy (the numbers are an organizational decision, not a standard):

| Severity | Deadline | Note |
|---|---|---|
| In CISA KEV | 7 days (or less) | Regardless of CVSS |
| Critical | 15 days | |
| High | 30 days | |
| Medium | 90 days | |
| Low | 180 days or backlog | |

DefectDojo configures SLAs per Product (number of days per severity, with `enforce_*` flags) and assigns each finding an SLA expiration date. A reimport doesn't reset the SLA: it is counted from first discovery.

### Metrics

| Metric | How it is calculated | What it tells you |
|---|---|---|
| **MTTR** (mean time to remediate) | Average (better: median) days from discovery to closure, per severity | How fast the team fixes things |
| **SLA compliance** | % of findings closed within the deadline | Whether the policy is realistic |
| **Escape rate** | Findings discovered **after** release (production, pentest, bug bounty) / all findings in the period | How much the pipeline misses |
| Backlog age | Number of open findings by severity and age (0–30, 30–90, 90+ days) | Whether the debt is growing |
| False positive rate | False Positive / all triaged, per tool and rule | Which rule erodes trust |
| Block rate | % of pipelines stopped by the gate | Too high = frustration; zero = the gate may be doing nothing |
| Exceptions | Number active, expired without review, average duration | Whether exceptions are becoming permanent |

An escape rate example: 120 findings were discovered in a quarter; 108 in the pipeline (SAST, SCA, DAST), 12 later (pentest and production monitoring). Escape rate = 12 / 120 = 10%. Analyzing those 12 tells you which control is missing: if they are all IDOR, neither SAST nor ZAP sees them and you need an authorization test.

Calculate MTTR per severity and with the median: a single 400-day-old finding skews the average, while the median shows the typical experience.

> **In practice:** don't measure the number of findings as success. A team that introduces a new scanner "worsens" the metric, and a team that turns off rules "improves" it. Track MTTR, SLA compliance and escape rate; they reward fixes, not hiding.

## Summary

- SARIF 2.1.0 is the common format: `runs[].tool.driver`, `results[]` with `ruleId`, `level` (`error`/`warning`/`note`/`none`), location and `partialFingerprints`; `suppressions` and `baselineState` carry exceptions and "new/old".
- GitLab: `artifacts:reports` (security reports and `sarif` on Ultimate, `codequality` and `junit` also on Free); `reports:sarif` is processed only when the job succeeds, so scanners don't fail the job and a separate gate job decides.
- DefectDojo: `reimport-scan` for recurring CI scans (`close_old_findings` closes what was fixed), `import-scan` for separate snapshots; deduplication by tool ID or hash code.
- The gate decides by severity, newness, fix availability and exploitation (CISA KEV, EPSS), not by CVSS alone.
- Every exception has a reason, an owner, an approval and an expiry date; an expired exception blocks again (DefectDojo `reactivate_expired`, `expired_at`, `ignoreUntil`).
- False positive ≠ accepted risk; an accepted risk is approved by the risk owner, with an expiration date.
- SLA by severity from first discovery; the metrics worth tracking: MTTR (median, per severity), SLA compliance, escape rate, backlog age, false positive rate.
