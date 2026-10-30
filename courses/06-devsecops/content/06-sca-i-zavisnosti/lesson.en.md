## What this module covers

Three objectives from domain 3:

- **3.2** **SCA** (Software Composition Analysis): vulnerable dependencies from lockfiles (osv-scanner, Trivy) and prioritization by **CVSS**, **EPSS** and **KEV**.
- **3.3** Dependency hygiene: pinning, automated updates (Renovate, Dependabot), **dependency confusion**, **typosquatting** and malicious packages.
- **3.4** Open source license compliance.

| Where in the pipeline | Control | Threat it prevents |
|---|---|---|
| MR job | SCA scan of lockfiles, gate on new severe findings | a known-vulnerable version getting into `main` |
| Scheduled (nightly) pipeline | re-scan without code changes | a new CVE in a library that hasn't changed in months |
| Update bot | Renovate / Dependabot MRs | outdated dependencies, "update debt" |
| Dependency installation | a single internal index, hash checks, `npm ci` | dependency confusion, a planted package |
| Release | license check | a GPL/AGPL component in a closed-source product |

In a typical application 70–90% of the code comes from dependencies. `kurs-shop` has only 9 direct packages (6 in `requirements.txt`, 3 in `frontend/package-lock.json`), and osv-scanner finds dozens of known vulnerabilities in them.

## Manifest, lockfile and transitive dependencies

| Term | Example | What it contains |
|---|---|---|
| **manifest** | `package.json`, `pyproject.toml` | what you want, often a range (`^4.17.0`, `>=2.0`) |
| **lockfile** | `package-lock.json`, `poetry.lock`, `uv.lock` | exactly what is installed, including **transitive** dependencies and hashes |
| `requirements.txt` | `flask==2.2.2` | depends on how it was made: hand-written it is a manifest, `pip freeze` / `pip-compile` output is a lockfile |

SCA is only as accurate as its input. `kurs-shop/requirements.txt` is hand-written: it lists `flask==2.2.2`, but not `itsdangerous`, `click` or `MarkupSafe`, which Flask pulls in. Consequences:

- **Trivy** reads only direct dependencies from `requirements.txt` (and only those pinned with `==`, unless you use `--detection-priority comprehensive`).
- **osv-scanner** in online mode tries to resolve transitive dependencies through the deps.dev service; in offline mode (the lab) it sees only what is written in the file.

The solution is a real lockfile:

```bash
# pip-tools: builds a complete, pinned requirements.txt with hashes from requirements.in
pip-compile --generate-hashes requirements.in -o requirements.txt
pip install --require-hashes -r requirements.txt
```

## osv-scanner

**osv-scanner** (Google) compares packages against the **OSV** database (osv.dev), which aggregates GitHub Security Advisories (GHSA), PyPA (PYSEC), Go, RustSec, npm and other sources. The advantage of the OSV format is precision: for each package it describes exactly the affected version ranges in its ecosystem.

```bash
cd /root/kurs-shop
osv-scanner scan source --offline-vulnerabilities -r .
```

The lab has no network: the databases for PyPI, npm and Go are downloaded in advance, and the variable `OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY=/opt/osv-db` says where they are. Variants:

| Flag | What it does |
|---|---|
| `--offline-vulnerabilities` | vulnerabilities from the local database; other features (resolving transitive dependencies) may still use the network |
| `--offline` | completely without network; the local database must exist |
| `--download-offline-databases` | together with an offline flag, downloads/refreshes the local databases (in CI, in a separate job or cache) |
| `-r` | recursively through directories |
| `-L <file>` | one specific lockfile, e.g. `-L frontend/package-lock.json` |
| `--format` | `table` (default), `json`, `sarif`, `markdown`, `html`, `cyclonedx-1-5`, `spdx-2-3`... |
| `--output-file` | write the result to a file (`--output` is the deprecated name) |
| `--config` | one configuration file for all scanned lockfiles |

Result (abbreviated; exact numbers depend on the database date):

```
Total 9 packages affected by N known vulnerabilities (N Critical, N High, N Medium, ...) from 2 ecosystems.

| OSV URL                             | CVSS | ECOSYSTEM | PACKAGE  | VERSION | FIXED VERSION | SOURCE                     |
| https://osv.dev/PYSEC-2023-62       | 8.7  | PyPI      | flask    | 2.2.2   | 2.2.5         | requirements.txt           |
| https://osv.dev/GHSA-m2qf-hxjv-5gpq |      |           |          |         |               |                            |
| https://osv.dev/GHSA-xvch-5gv4-984h | 9.8  | npm       | minimist | 1.2.5   | 1.2.6         | frontend/package-lock.json |
```

The same vulnerability has several IDs (**aliases**): `PYSEC-2021-142`, `GHSA-8q59-q68h-6hv4` and `CVE-2020-14343` are the same hole in PyYAML. osv-scanner groups them into one row.

Exit codes: `0` packages found, no vulnerabilities; `1` vulnerabilities found; `127` general error; `128` no packages found. In a pipeline, `128` means the job is scanning nothing (wrong path, no lockfile) and should be treated as a job error, not as "clean".

### Exceptions: `osv-scanner.toml`

osv-scanner looks for `osv-scanner.toml` in the same directory as the lockfile (it is not inherited by subdirectories); `--config` sets one file for all of them.

```toml
# /root/kurs-shop/osv-scanner.toml
[[IgnoredVulns]]
id = "GHSA-8q59-q68h-6hv4"          # CVE-2020-14343, PyYAML FullLoader
ignoreUntil = 2026-11-30            # no quotes; after this date the finding comes back
reason = "Ne koristimo full_load; nadogradnja na 6.x u SHOP-231. Odobrio: AppSec, 2026-10-16"

[[PackageOverrides]]
name = "lodash"
ecosystem = "npm"
vulnerability.ignore = true
effectiveUntil = 2026-12-31
reason = "Frontend se gasi u Q4, zamjena u SHOP-240"
```

(The `reason` strings say: "We don't use full_load; upgrade to 6.x in SHOP-231. Approved by: AppSec, 2026-10-16" and "The frontend is being retired in Q4, replacement in SHOP-240".)

Ignoring also works via aliases: `id = "GHSA-8q59-q68h-6hv4"` also hides `PYSEC-2021-142`. During a scan osv-scanner prints `... have been filtered out because: <reason>`, so the exception is visible in the job log.

> **In practice:** An exception without an expiry is a permanent risk acceptance that nobody approved. Team rule: every `IgnoredVulns` entry has an `ignoreUntil` at most 90 days ahead, a `reason` with a ticket and the name of the person who approved it, and the file is protected by CODEOWNERS so that AppSec must approve any change.

### Guided remediation

`osv-scanner fix` proposes upgrades that remove the most vulnerabilities with the fewest changes. It is an experimental feature, supports **npm** (`package-lock.json`, `package.json`) and **Maven** (`pom.xml`), and by default pulls version data from deps.dev (it needs the network, so it doesn't work in the lab):

```bash
osv-scanner fix --strategy=in-place -L frontend/package-lock.json
osv-scanner fix --strategy=relax -M frontend/package.json -L frontend/package-lock.json --max-depth=1
```

### Call analysis

For Go (and experimentally Rust), osv-scanner performs **call analysis**: it checks whether your code actually calls the vulnerable function and marks uncalled vulnerabilities as such. This is one form of **reachability** analysis; osv-scanner doesn't have it for Python and npm.

## Trivy for dependencies

You know Trivy from CKS for images; the same tool also scans a repository:

```bash
trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 1 .
trivy fs --scanners vuln --include-dev-deps frontend/
trivy fs --scanners vuln --format sarif --output trivy-sca.sarif .
trivy fs --format cyclonedx --output sbom.cdx.json .
```

`trivy fs` runs the `vuln` and `secret` scanners by default. In the lab the `trivy` wrapper sets `TRIVY_SKIP_DB_UPDATE=true` and unpacks the database from the image, so it works without network. npm dev dependencies are not reported without `--include-dev-deps`.

Exceptions in `.trivyignore.yaml` (specified explicitly with `--ignorefile`):

```yaml
vulnerabilities:
  - id: CVE-2020-14343
    paths:
      - requirements.txt
    expired_at: 2026-11-30
    statement: "Ne koristimo full_load; nadogradnja u SHOP-231"
```

```bash
trivy fs --scanners vuln --ignorefile .trivyignore.yaml --exit-code 1 .
```

### osv-scanner or Trivy

| | osv-scanner | Trivy |
|---|---|---|
| Database | OSV (osv.dev) | trivy-db (NVD, GHSA, distributions...) |
| Focus | application dependencies, precise per-ecosystem ranges | everything: OS packages, dependencies, misconfig, secrets, licenses |
| Transitive from manifest | yes, online (deps.dev) | no for `requirements.txt` |
| Exceptions with expiry | `osv-scanner.toml` (`ignoreUntil`) | `.trivyignore.yaml` (`expired_at`), `.trivyignore` (`exp:`) |
| VEX | no | yes (`--vex`) |
| Remediation | `osv-scanner fix` (npm, Maven) | no |
| When to choose it | primary SCA for code | one tool for code, images and IaC |

Many teams use both: osv-scanner in the MR over lockfiles, Trivy over the image (module 08). Differences in the number of findings between tools are normal (different databases and different interpretation of ranges); what matters is that the gate uses one agreed source of truth.

## SCA in the pipeline

```yaml
osv-scanner:
  stage: security
  script:
    - osv-scanner scan source --offline-vulnerabilities -r . --format sarif --output-file osv.sarif
  artifacts:
    when: always
    paths: [osv.sarif]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_PIPELINE_SOURCE == "schedule"

trivy-sca:
  stage: security
  script:
    - trivy fs --scanners vuln --format cyclonedx --output gl-sbom.cdx.json .
    - trivy fs --scanners vuln --severity CRITICAL --ignorefile .trivyignore.yaml --exit-code 1 .
  artifacts:
    when: always
    reports:
      cyclonedx: gl-sbom.cdx.json
```

- The first Trivy call only produces a report; the second is the **gate** (it fails only on CRITICAL findings that are not excepted).
- The `schedule` rule matters: a new vulnerability in `jinja2 3.1.2` is published without a single commit in the repo. Without a nightly pipeline you discover it only at the next code change.
- GitLab's dependency scanning (Ultimate) now works on the basis of an **SBOM**: the analyzer produces a CycloneDX SBOM, and GitLab compares it with its advisory database and continuously re-checks it as new advisories are published. The old Gemnasium analyzer is obsolete (deprecated in 17.9).

In the lab: `gitlab-ci-local osv-scanner`, then `jq '.runs[0].results | length' osv.sarif`.

> **In practice:** Don't block an MR because of a vulnerability that MR didn't introduce. If `requests 2.25.1` has been vulnerable for a year, a developer changing CSS shouldn't fail on it. Let the MR gate look only at changed lockfiles or at new findings relative to the target branch (DefectDojo or GitLab do this through deduplication, module 12), while existing findings go to the backlog with SLA deadlines.

## Prioritization: CVSS, EPSS, KEV

`kurs-shop` has dozens of findings. Fixing everything at once is not realistic; you need to know what comes first.

| Signal | What it measures | What it does NOT measure |
|---|---|---|
| **CVSS** (v3.1, v4.0) | severity: how bad it is if exploited (base score 0–10) | likelihood of attack; your context |
| **EPSS** (FIRST) | the probability that a CVE will be exploited in the next 30 days (0–1) and the percentile relative to all CVEs | the damage in your system |
| **CISA KEV** | that the vulnerability has been **proven exploited** in real attacks | vulnerabilities nobody has exploited yet |
| **Reachability / context** | whether your code uses the vulnerable function, whether the service is exposed | none of the above |

### CVSS

The CVSS base score is severity, not risk. **CVSS v4.0** divides metrics into Base, Threat, Environmental and Supplemental and has a nomenclature: `CVSS-B` (base only), `CVSS-BT` (base + threat), `CVSS-BE`, `CVSS-BTE`. Most scanners still show the base score (v3.1 or v4.0, depending on the source), i.e. without information about exploitation and without your environment.

### EPSS

**EPSS** (Exploit Prediction Scoring System) is calculated by FIRST every day for every published CVE. The result is two numbers:

- `epss`: the probability of exploitation activity in the next 30 days (e.g. `0.02` = 2%);
- `percentile`: what fraction of all CVEs has a lower or equal score.

```bash
# public API (no network in the lab; you do this on a workstation or in CI with network access)
curl -s "https://api.first.org/data/v1/epss?cve=CVE-2021-44906" | jq '.data[] | {cve, epss, percentile, date}'
```

The model changes periodically (v4 in 2025, v5 in 2026), and scores can then jump abruptly. That's why you should also store the score date in the report.

### KEV

The **CISA Known Exploited Vulnerabilities** catalog contains vulnerabilities that meet three conditions: they have a CVE ID, there is reliable evidence of active exploitation, and there is a clear remediation step. For US federal agencies KEV is binding: since June 2026 this is governed by directive **BOD 26-04** (which replaced BOD 22-01) with risk-dependent deadlines, and for the most critical combination (publicly exposed system, KEV, automated exploitation, full system control) the deadline is 3 days. For everyone else KEV is the strongest single signal for priority.

The catalog is available as JSON; the per-vulnerability fields include `cveID`, `vendorProject`, `product`, `dateAdded`, `dueDate`, `requiredAction`, `knownRansomwareCampaignUse`.

```bash
# offline copy of the catalog in the CI cache; cross-referencing with osv-scanner findings
osv-scanner scan source --offline-vulnerabilities -r . --format json --output-file osv.json
jq -r '.results[].packages[].vulnerabilities[].aliases[]? | select(startswith("CVE-"))' osv.json | sort -u > cves.txt
jq -r '.vulnerabilities[].cveID' known_exploited_vulnerabilities.json | sort -u > kev.txt
comm -12 cves.txt kev.txt      # CVEs that are both in our code and in KEV
```

For `kurs-shop` the intersection is empty at the time of writing: none of the vulnerabilities in these libraries is in KEV. That doesn't mean "it doesn't matter", but that priority is determined by severity, EPSS and context.

### Context changes priority

Two examples from `kurs-shop`:

- **Werkzeug 2.2.2, CVE-2024-34069**: a vulnerability in the Werkzeug debugger. For most applications it is irrelevant because the debugger is not enabled. `kurs-shop` runs it with `debug=True`, so here it is real (and the SAST finding `flask-debug` reinforces it).
- **PyYAML 5.3.1, CVE-2020-14343**: the vulnerability is in `full_load`/`FullLoader`. The application uses `yaml.Loader`, which is insecure by design, so the problem is serious regardless of the CVE. The fix is `yaml.safe_load` (SAST) **and** an upgrade (SCA).

An example priority policy (adapt it to your team):

| Condition | Priority | Remediation deadline |
|---|---|---|
| in KEV | P1 | 72 h, or block deploy |
| CVSS ≥ 9 and EPSS percentile ≥ 0.95, or confirmed reachability | P1 | 7 days |
| CVSS ≥ 7 | P2 | 30 days |
| everything else | P3 | next regular update cycle |
| no fix available | track | VEX statement or compensating control |

> **In practice:** Prioritization is not the scanner's job but work you do once and write down as a policy. Once the policy is written (KEV first, then EPSS + CVSS, then the rest), triage becomes mechanical and a developer doesn't have to decide which of 69 findings matters. The biggest gain is usually that 5–10% of findings get P1/P2, and the rest goes through regular updates.

## Dependency hygiene

### Pinning

| What | How | Why |
|---|---|---|
| Python | `==` + hash (`pip-compile --generate-hashes`, `pip install --require-hashes`) | the same version everywhere; a planted file with the same version fails the hash |
| npm | `package-lock.json` in git, `npm ci` in CI (not `npm install`) | `npm ci` installs exactly the lock and fails if the lock and `package.json` disagree |
| npm install scripts | `npm ci --ignore-scripts` where possible | `preinstall`/`postinstall` is the most common path for a malicious package to reach a CI runner |
| Images in CI | `image: python:3.13-slim@sha256:...` | a tag can move, a digest can't |
| GitLab `include` | `ref:` to a tag or SHA | a change to a shared template doesn't silently enter your pipeline |

Pinning without automated updates means freezing vulnerabilities in place. That's why pinning always goes together with an update bot.

### Renovate and Dependabot

| | **Renovate** | **Dependabot** |
|---|---|---|
| Platforms | GitLab, GitHub, Bitbucket, Azure DevOps, Gitea... | GitHub (built in) |
| How it runs | self-hosted (a CI job, e.g. a scheduled GitLab pipeline) or a hosted app | GitHub service |
| Configuration | `renovate.json` | `.github/dependabot.yml` |
| Waiting for new versions | `minimumReleaseAge` | `cooldown` |
| Grouping | `packageRules` | `groups` |
| Automerge | built in (`automerge`) | via GitHub auto-merge and branch protection |
| Security MRs | `vulnerabilityAlerts`, `osvVulnerabilityAlerts` | Dependabot security updates |

For GitLab, Renovate is the natural choice:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "minimumReleaseAge": "3 days",
  "osvVulnerabilityAlerts": true,
  "prConcurrentLimit": 5,
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchPackageNames": ["flask", "werkzeug", "jinja2"],
      "groupName": "flask stack"
    },
    {
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

```yaml
renovate:
  image: renovate/renovate@sha256:<digest>
  variables:
    RENOVATE_PLATFORM: gitlab
    RENOVATE_ENDPOINT: https://gitlab.kurs-shop.ba/api/v4
    RENOVATE_REPOSITORIES: shop/kurs-shop
  script:
    - renovate
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

`RENOVATE_TOKEN` is a masked and protected variable holding a project access token with minimal permissions. On GitHub:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 5
    groups:
      python-minor:
        update-types: ["minor", "patch"]
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

`minimumReleaseAge` / `cooldown` are now also a security control: malicious versions of popular packages are usually detected and removed within a few hours to a couple of days. A bot that waits several days before proposing an update skips them.

> **In practice:** Enable automerge only for patch versions and only if the pipeline has real tests. Group related packages (Flask, Werkzeug, Jinja2) so you don't get three MRs that break each other. If the team gets 40 MRs a week, they will stop reading them; `prConcurrentLimit`, groups and the schedule matter more than installing the bot itself.

### Dependency confusion

In 2021 the researcher Alex Birsan demonstrated an attack against dozens of large companies: an internal package `kurs-shop-utils` exists only on the internal registry, an attacker publishes a public package with the same name and a higher version, and the package manager picks the public one.

The classic cause in Python:

```bash
# DANGEROUS: pip looks at both indexes and picks the highest version, regardless of where it comes from
pip install --extra-index-url https://pypi.kurs-shop.ba/simple kurs-shop-utils
```

Defense:

- **one** index: `--index-url` pointing to an internal proxy (Artifactory, Nexus, GitLab package registry) that never asks the public registry for internal names;
- an npm **scope** for internal packages and `.npmrc` with `@kurs-shop:registry=https://npm.kurs-shop.ba/`;
- reserving internal names (or the scope) on the public registry;
- a lockfile with hashes: a different file with the same version fails the check.

### Typosquatting and malicious packages

**Typosquatting** is a package with a name similar to a popular one (`reqeusts`, `python-dateutils`, `lodahs`) that waits for a typo. A more serious case is a compromised legitimate package: `event-stream` (2018), `ua-parser-js` (2021), and in September 2025 the account of a maintainer of popular npm packages (`chalk`, `debug` and others) was taken over via phishing, and soon afterwards the self-replicating worm "Shai-Hulud" appeared, which stole tokens from developer machines and CI and used them to publish infected versions of other packages.

Defense in the pipeline:

- OSV also has records of malicious packages (IDs `MAL-...`, from OpenSSF Malicious Packages); osv-scanner reports them just like vulnerabilities. (In the lab the npm database is reduced and has no `MAL-` records.)
- `minimumReleaseAge`/`cooldown` on the bot, `npm ci --ignore-scripts` where possible.
- Code review of an MR that **adds** a new dependency: who maintains it, how old it is, how many downloads it has.
- The CI job that installs dependencies has no production secrets (modules 02 and 04).

## Open source licenses

Every dependency comes with a license, and the license determines the obligations on distribution. Rough categories:

| Category | Examples (SPDX ID) | Obligation (simplified) |
|---|---|---|
| Permissive | `MIT`, `BSD-3-Clause`, `Apache-2.0`, `ISC` | keep the copyright and license text; for Apache-2.0 also the NOTICE file |
| Weak copyleft | `LGPL-2.1`, `LGPL-3.0`, `MPL-2.0` | you must publish changes to the library itself; not your code |
| Strong copyleft | `GPL-2.0`, `GPL-3.0` | if you distribute a product derived from GPL code, you must offer the source code under the GPL |
| Network copyleft | `AGPL-3.0` | users over the network (SaaS) also have a right to the source code |
| Not open source (OSI) | `SSPL-1.0`, `BUSL-1.1`, "Commons Clause" | restrictions on commercial use; legal review |
| Unknown | no license, non-standard text | you have no right to use it until it's clarified |

Licenses are written as **SPDX** identifiers and expressions: `MIT OR Apache-2.0` (you pick one), `GPL-2.0-only WITH Classpath-exception-2.0`.

### Trivy licenses

Trivy sorts licenses into categories (Google's classification) and assigns them a severity: **forbidden** = CRITICAL, **restricted** = HIGH, **reciprocal** = MEDIUM, notice/permissive/unencumbered = LOW, unknown = UNKNOWN. That's why licenses are gated with the same flags as vulnerabilities:

```bash
trivy image --scanners license --severity HIGH,CRITICAL --exit-code 1 127.0.0.1:5000/python:3.13-slim
trivy fs --scanners license --license-full .
```

An important limitation: Trivy reads licenses from **installed** packages (`node_modules`, `site-packages/*/METADATA`, OS packages in the image), not from `requirements.txt` or `package-lock.json` alone. That's why it's most reliable to check licenses on the finished image or after `npm ci` / `pip install` in the job. `--license-full` additionally looks for license texts in source files and is slower.

The organization's policy goes into the Trivy configuration (`trivy --generate-default-config` gives a starting file):

```yaml
# trivy.yaml
license:
  forbidden:
    - AGPL-3.0
    - SSPL-1.0
  restricted:
    - GPL-2.0
    - GPL-3.0
```

An approved exception goes into `.trivyignore.yaml`, again with an expiry and a justification:

```yaml
licenses:
  - id: GPL-2.0
    paths:
      - "usr/share/doc/bash/copyright"
    statement: "OS paket u baznoj slici, ne distribuiramo izmijenjen; odobrio Legal, LEGAL-88"
```

(The statement says: "OS package in the base image, we don't distribute it modified; approved by Legal, LEGAL-88".)

osv-scanner has `--licenses="MIT,Apache-2.0,BSD-3-Clause"` (an allowlist), but it pulls license data from deps.dev, so it doesn't work in the lab without network.

> **In practice:** Licenses are not only a security topic: the policy (what is forbidden, what is restricted) is written by the legal department, and you turn it into configuration. GPL in an internal tool you never distribute is usually fine; the same GPL in firmware you sell is not. That's why you gate licenses in the release pipeline of a product that gets distributed, and only warn in the MR. An SBOM (module 10) with every release is the evidence of what was shipped.

## Fixing kurs-shop

1. `requirements.in` with the direct dependencies, `pip-compile --generate-hashes` for a complete lockfile.
2. Upgrade the Python stack (Flask 3.x, Werkzeug 3.x, Jinja2, requests, PyYAML 6.x, gunicorn) and the frontend (`axios`, `lodash`, `minimist` to fixed versions).
3. Replace `yaml.load(..., Loader=yaml.Loader)` with `yaml.safe_load` and turn off `debug=True` (SAST, module 05).
4. Add the `osv-scanner` and `trivy-sca` jobs with a gate, and a nightly scheduled pipeline.
5. Whatever can't be fixed right away goes into `osv-scanner.toml` with `ignoreUntil` and a ticket.
6. Add Renovate with `minimumReleaseAge` and groups.

## Summary

- SCA looks for known-vulnerable dependency versions; it is only as accurate as the lockfile is complete (a hand-written `requirements.txt` has no transitive dependencies).
- osv-scanner: `scan source -r .`, offline with a local database, exceptions in `osv-scanner.toml` with `ignoreUntil` and `reason`; exit `1` = vulnerabilities, `128` = no packages.
- Trivy: `trivy fs --scanners vuln --severity ... --exit-code 1`, exceptions in `.trivyignore.yaml` with `expired_at` and `statement`.
- Run SCA both in the MR and in a scheduled pipeline: a new CVE doesn't need a new commit.
- Priority: KEV (proven exploitation) > EPSS (probability, 30 days) + CVSS (severity) > context and reachability; write the policy down once.
- Pin (hashes, `npm ci`, image digests, `include` with `ref`) and update automatically (Renovate, Dependabot) with `minimumReleaseAge`/`cooldown`.
- Dependency confusion is prevented by a single internal index and scopes; typosquatting and compromised packages by reviewing new dependencies, `MAL-` records and waiting on new versions.
- Licenses: Trivy categories (forbidden = CRITICAL, restricted = HIGH) and a gate over installed packages or the image; the policy is set by the legal department.
