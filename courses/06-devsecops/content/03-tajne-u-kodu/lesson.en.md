## What this module covers

The module covers three objectives from domain 2:

- **2.1** Detecting secrets in code and git history (**gitleaks**, **TruffleHog**).
- **2.2** Preventing leaks: **pre-commit** hooks, **push protection**, **baseline** and **allowlist**.
- **2.3** Responding to a leaked secret: revocation, rotation, investigation, history rewriting.

Where this sits in the pipeline: in three places, in layers. On the developer's machine (pre-commit hook), on the server at push time (push protection) and in the pipeline (a job that scans the MR diff, and periodically the whole history). Secrets management in Vault (2.4) is in module 04.

The threat: a secret (cloud key, token, password, webhook, private key) ends up in git. Git doesn't forget: even when the file is "deleted" in the next commit, the secret is in the history, in every clone, fork, runner cache and in the MR diff. Attackers automatically scan public repos and exploit an AWS key within minutes of the push.

The `/root/kurs-shop` repo has all the classic cases:

- an AWS key and a Slack webhook in the commit "Početna verzija API-ja" ("Initial API version", `config/settings.py`), "removed" by a later commit;
- a hardcoded `SECRET_KEY` in `app.py`;
- a token in `ENV` in the `Dockerfile`;
- a database password in `infra/main.tf`.

## How tools find secrets

Three techniques, usually combined:

- **Regular expressions for known formats.** An AWS access key ID starts with `AKIA` (long-lived) or `ASIA` (temporary), a Slack webhook with `https://hooks.slack.com/services/`, a GitLab PAT with `glpat-`, a GitHub token with `ghp_`. This is the most reliable.
- **Entropy.** Random strings have high Shannon entropy. Useful for generic secrets, but produces false positives (hashes, UUIDs, minified JS).
- **Nearby keywords.** `password=`, `secret`, `token` next to a value. Generic rules (`generic-api-key` in gitleaks) are the biggest source of noise.
- **Verification** (TruffleHog): the tool tries to use the found secret against the vendor's API and tells you whether it is active. A huge advantage for prioritization, but it requires network access (the lab has none, so we work without it).

## gitleaks 8.x

**gitleaks** is a single binary, fast, with good default rules. In version 8.19 the `detect` and `protect` commands were replaced by new subcommands (the old ones still work but are hidden):

| Command | What it scans |
|---|---|
| `gitleaks git [path]` | Git history (via `git log -p`); you set the range with `--log-opts` |
| `gitleaks git --pre-commit --staged` | Only staged changes, for a pre-commit hook |
| `gitleaks dir [path]` | Files on disk, without history (aliases `files`, `directory`) |
| `gitleaks stdin` | Input from standard input (e.g. `docker history`, a log) |

### First scan of kurs-shop

```bash
cd /root/kurs-shop

# current files: finds SECRET_KEY, the token in the Dockerfile, the password in main.tf
gitleaks dir . -v --redact

# full history: the AWS key and the Slack webhook from the old commit show up too
gitleaks git . -v --redact

# reports for tools and for the pipeline
gitleaks git . --redact --report-format json  --report-path gitleaks.json
gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif
jq -r '.[] | [.RuleID, .File, .Commit[0:8], .StartLine] | @tsv' gitleaks.json
```

A typical finding (abbreviated):

```text
Finding:     AWS_ACCESS_KEY_ID = "REDACTED"
RuleID:      aws-access-token
File:        config/settings.py
Line:        4
Commit:      3f2c9a1…
Message:     Početna verzija API-ja
Fingerprint: 3f2c9a1…:config/settings.py:aws-access-token:4
```

Important flags:

| Flag | Meaning |
|---|---|
| `--redact` (or `--redact=50`) | Hide the secret in the output (percentage); mandatory in CI logs |
| `-f, --report-format` | `json`, `csv`, `junit`, `sarif`, `template` |
| `-r, --report-path` | Report file |
| `--log-opts` | Options for `git log`, e.g. `--log-opts="--all"` or a range `A..B` |
| `-c, --config` | Path to the configuration (otherwise `.gitleaks.toml` in the target) |
| `-b, --baseline-path` | Ignore findings already in the baseline report |
| `--exit-code` | Exit code when there are findings (default 1) |
| `--enable-rule` | Only specific rules by ID |
| `--max-target-megabytes` | Skip large files |

The exit code is 0 when there are no findings and 1 when there are (or on error). The gate is based on this.

### Configuration: .gitleaks.toml

Don't write rules from scratch. Extend the defaults and add your own:

```toml
# .gitleaks.toml in the repo root
title = "kurs-shop gitleaks config"

[extend]
useDefault = true
# disabledRules = ["generic-api-key"]   # only if it's too noisy and you have a replacement

[[rules]]
id = "kurs-shop-internal-token"
description = "Interni API token kurs-shopa"
regex = '''kshop_[a-z0-9]{32}'''
keywords = ["kshop_"]
tags = ["internal"]

# global allowlist (gitleaks 8.25+): test fixture files
[[allowlists]]
description = "Lažni ključevi u testnim fixtureima"
paths = ['''tests/fixtures/.*''']

# allowlist for a single rule only: examples in documentation
[[allowlists]]
description = "Placeholderi u docs"
targetRules = ["generic-api-key"]
regexTarget = "line"
regexes = ['''(?i)example|changeme|<your-token>''']
```

Rules can also have their own allowlist (`[[rules.allowlists]]`) with the fields `paths`, `regexes`, `stopwords`, `commits` and `condition = "AND"` when all conditions must hold. `keywords` speed up the scan: the regex is checked only on lines containing the keyword.

Test a rule before you release it into the pipeline:

```bash
echo 'TOKEN = "kshop_0123456789abcdef0123456789abcdef"' | gitleaks stdin -c .gitleaks.toml -v
```

### False positives and exceptions

Three mechanisms, from narrowest to broadest:

1. **Inline comment** `gitleaks:allow` on the line. Fast, but anyone can add it, so track it through review.
```python
TEST_KEY = "AKIAIOSFODNN7EXAMPLE"  # gitleaks:allow (AWS example from the documentation)
```
2. **`.gitleaksignore`** with the fingerprint of the exact finding. For history the format is `commit:file:rule:line`, for a `dir` scan `file:rule:line`. Add a comment with the reason and ticket:
```text
# INC-2026-031: key revoked 2026-10-02, history not rewritten (public forks)
3f2c9a1d5e7b9c0a1f2e3d4c5b6a79881726354a:config/settings.py:aws-access-token:4
3f2c9a1d5e7b9c0a1f2e3d4c5b6a79881726354a:config/settings.py:slack-webhook-url:5
```
3. **Allowlist in `.gitleaks.toml`** (paths, regexes, stopwords): for whole classes of false positives.

> **In practice:** add a fingerprint to `.gitleaksignore` only **after** the secret has been revoked. An exception means "this has been handled", not "we don't care about this". The comment in the file should say who, when, why and the incident number; put changes to `.gitleaksignore` and `.gitleaks.toml` under the security team's CODEOWNERS.

### Baseline for an existing repo

When you first enable gitleaks on an old repo, it finds dozens of historical findings. You can't block all MRs until you resolve them. A **baseline** separates old from new:

```bash
# 1. once: record the existing state (redacted!)
gitleaks git . --redact --report-format json --report-path .gitleaks-baseline.json

# 2. in the pipeline: fail only on new findings
gitleaks git . --redact --baseline-path .gitleaks-baseline.json \
  --report-format sarif --report-path gitleaks.sarif
```

A baseline is not forgiveness: every item in it goes into the backlog (revocation and rotation), and the baseline shrinks as they are resolved.

### gitleaks in a GitLab pipeline

For an MR it's enough to scan the commits the MR brings in; scan the whole history periodically (scheduled pipeline):

```yaml
secret-detection:
  stage: secrets
  needs: []
  variables:
    GIT_DEPTH: "0"                 # history is needed for the commit range to work
  script:
    - |
      if [ -n "$CI_MERGE_REQUEST_DIFF_BASE_SHA" ]; then
        OPTS="$CI_MERGE_REQUEST_DIFF_BASE_SHA..$CI_COMMIT_SHA"
      else
        OPTS="-1"                  # push to a branch: only the latest commit
      fi
      gitleaks git . --redact --log-opts="$OPTS" \
        --report-format sarif --report-path gitleaks.sarif
  artifacts:
    when: always
    paths: [gitleaks.sarif]
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

secret-detection-full-history:
  stage: secrets
  variables:
    GIT_DEPTH: "0"
  script:
    - gitleaks git . --redact --log-opts="--all" --baseline-path .gitleaks-baseline.json
      --report-format json --report-path gitleaks-full.json
  artifacts:
    when: always
    paths: [gitleaks-full.json]
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

Notes:

- This job has **no** `allow_failure`: a new secret in an MR is one of the rare findings that may block from day one (there are few false positives once you disable or narrow the generic rules).
- `artifacts: when: always` keeps the report even when the job fails, which is exactly when you need it.
- Don't use `-v` without `--redact` in CI: the secret would end up in the job log, which more people read than the repo.
- In the lab you run the same job with `gitlab-ci-local secret-detection`.

GitLab also has a ready-made template `Jobs/Secret-Detection.gitlab-ci.yml` (the `secret_detection` job, internally based on gitleaks) that produces its report as `artifacts:reports:secret_detection` (`gl-secret-detection-report.json`), so findings show up in the MR widget and the security dashboard. You enable a one-time history scan with the variable `SECRET_DETECTION_HISTORIC_SCAN: "true"`. Note: `reports:secret_detection` expects GitLab's JSON report format, not SARIF, so keep your gitleaks SARIF as a regular artifact (or import it into DefectDojo, module 12).

```yaml
include:
  - template: Jobs/Secret-Detection.gitlab-ci.yml
```

## TruffleHog 3.x

**TruffleHog** has hundreds of detectors and, crucially, **verification**: for a found key it calls the vendor's API and tells you whether the key works. Results have a status:

| Status | Meaning |
|---|---|
| `verified` | The secret is confirmed active (urgent!) |
| `unverified` | Found, but not confirmed (maybe inactive, maybe no verifier) |
| `unknown` | Verification failed because of an error (e.g. network) |
| `filtered_unverified` | Unverified, which would otherwise be filtered |

You choose statuses with the `--results` flag (default `verified,unverified,unknown`). Instead of the old `--only-verified`, today you use `--results=verified`.

```bash
cd /root

# git history (local repo as a file:// URL); in the lab without network, no verification
trufflehog git file:///root/kurs-shop --no-verification --no-update

# only files on disk
trufflehog filesystem /root/kurs-shop --no-verification --no-update

# JSON for further processing
trufflehog git file:///root/kurs-shop --no-verification --no-update --json \
  | jq -r '[.DetectorName, .SourceMetadata.Data.Git.file, .SourceMetadata.Data.Git.commit[0:8]] | @tsv'
```

In a real environment (with network access) a typical CI invocation is:

```yaml
trufflehog:
  stage: secrets
  variables:
    GIT_DEPTH: "0"
  script:
    - trufflehog git file://. --since-commit "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
      --branch HEAD --results=verified,unknown --fail --no-update --json > trufflehog.json
  artifacts:
    when: always
    paths: [trufflehog.json]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

With `--fail`, TruffleHog returns exit code **183** when there are results (0 = none, 1 = error). You exclude false positives on a line with the `trufflehog:ignore` comment.

### gitleaks or TruffleHog

| | **gitleaks** | **TruffleHog** |
|---|---|---|
| Approach | Regex + entropy + keywords | Per-vendor detectors + verification |
| Liveness verification | No | Yes (requires network) |
| Speed | Very fast | Fast; verification adds time |
| Sources | git, dir, stdin | git, filesystem, GitHub/GitLab org, S3, Docker images and others |
| Configuration and exceptions | `.gitleaks.toml`, `.gitleaksignore`, baseline, `gitleaks:allow` | `--results`, `trufflehog:ignore`, disabling detectors |
| Report | JSON, CSV, JUnit, SARIF, template | JSON |
| Best for | Gate in pre-commit and MR, custom rules | Investigation and prioritization: which secrets are actually live |

A common combination: gitleaks as a fast gate in the hook and the MR, TruffleHog periodically over all of the organization's repos to find **verified** secrets that need to be revoked immediately.

> **In practice:** when you first run a scanner over all of a company's repos, the result is hundreds of findings. Start with `verified` (TruffleHog) and with types that have a clear format (AWS, GitLab PAT, private keys). Leave generic findings for later; otherwise the team spends a week on hashes from tests.

## Prevention: pre-commit and push protection

Detection in the pipeline comes **after** the push: the secret is already on the server, in the history and maybe in a fork. It's better to stop it earlier.

### pre-commit hook

The **pre-commit** framework manages git hooks from the `.pre-commit-config.yaml` file in the repo. The lab has no network, so we use local hooks (`repo: local`) that call the installed binary:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: gitleaks
        name: gitleaks (staged izmjene)
        entry: gitleaks git --pre-commit --staged --redact --verbose
        language: system
        pass_filenames: false
        stages: [pre-commit]
```

```bash
cd /root/kurs-shop
pre-commit install                    # writes .git/hooks/pre-commit
pre-commit run --all-files            # manually over all files (good for the initial rollout)

# test: a commit with a secret must fail
echo 'SLACK = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"' > leak.py
git add leak.py && git commit -m "test"     # the hook blocks the commit
git restore --staged leak.py && rm leak.py
```

In a real environment (with network access), instead of `repo: local` you use the official hook, pinned to a version:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.30.0
    hooks:
      - id: gitleaks
```

Limitation: the hook is on the developer's machine. They can bypass it with `git commit --no-verify`, or never install it. So the hook is not a control you rely on alone; it's a convenience that catches most mistakes before they become an incident.

### Push protection on the server

**Push protection** rejects a push on the server if the new commits contain a secret of a known format:

- **GitHub**: secret scanning push protection (enabled by default for public repos; for private ones as part of GitHub Advanced Security / Secret Protection).
- **GitLab**: **secret push protection** (Ultimate). It's enabled in Secure → Security configuration. It scans only the changes in pushed commits, uses only high-confidence rules and skips large and binary files.

Bypassing is possible and deliberately visible: in GitLab with `[skip secret push protection]` in the commit message or `git push -o secret_push_protection.skip_all`. Every bypass is recorded as an audit event, so the security team can track it.

### Layers together

| Layer | Where it runs | Can it be bypassed? | Catches |
|---|---|---|---|
| pre-commit hook | Developer's laptop | Yes (`--no-verify`, hook not installed) | Most mistakes, before they enter history |
| Push protection | Git server | Yes, but with an audit trail | Known formats before they enter the repo on the server |
| Pipeline job (MR) | Runner | No, if the job is mandatory | Everything that gets past the above, including custom rules |
| Periodic history scan | Runner (schedule) | No | Old secrets, new rules over old history |

> **In practice:** the hook must be fast (seconds) and quiet. If generic rules block every other commit, developers will use `--no-verify` every time. Keep only high-confidence rules in the hook; let broader rules run in the pipeline, where the result goes into a report.

## Responding to a leaked secret

The scenario from the labs: the commit "Početna verzija API-ja" contains an AWS key and a Slack webhook. The developer "removed" them with the next commit. The repo is on the server, and it may have been public for a few hours.

**The first step is not rewriting history, but revoking the secret.** The secret must be considered compromised from the moment it was pushed: deleting it from code or history doesn't undo copies that have already been made.

### Order

1. **Revoke / deactivate** the secret immediately. For an AWS key, deactivate first (fast and reversible), so you don't break production before you find out who uses it.
2. **Rotate**: issue a new secret, put it in Vault or a CI variable (not in code), update the services that use it, then permanently delete the old one.
3. **Investigate**: has the secret been used by someone else? Since when has it been exposed (commit date, repo visibility, forks)?
4. **Clean up the code**: the secret leaves the code; it is read from the environment or Vault.
5. **Rewrite history** if it makes sense (private repo, few clones) and add the fingerprint to `.gitleaksignore` with the incident number.
6. **Prevent recurrence**: hook, push protection, mandatory job, a rule for the internal secret format; a short blameless postmortem.

### AWS key

```bash
KEY=AKIA................     # from the gitleaks finding (without --redact, locally)

# who owns the key and when it was last used
aws iam list-access-keys --user-name kurs-shop-ci
aws iam get-access-key-last-used --access-key-id "$KEY"

# 1. deactivate
aws iam update-access-key --user-name kurs-shop-ci --access-key-id "$KEY" --status Inactive

# 3. investigation: what was done with this key (CloudTrail, last 90 days of management events)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="$KEY" \
  --max-results 50 --query 'Events[].[EventTime,EventName,Username]' --output table

# 2. after the services have been moved to the new key or, better, to an OIDC role
aws iam delete-access-key --user-name kurs-shop-ci --access-key-id "$KEY"
```

In the investigation, look for calls your CI doesn't make (e.g. `RunInstances` in unusual regions, `CreateUser`, `CreateAccessKey`, `GetCallerIdentity` from an unknown IP address). If the key was used, this is no longer a "leaked secret" but an incident in the AWS account: check for new IAM users, keys, roles and resources the attacker may have left behind. The best long-term fix is for CI to have no static key at all (OIDC, module 02).

### Slack webhook and other secrets

- Slack webhook: in the Slack app settings, delete (revoke) that webhook URL and create a new one.
- GitLab/GitHub tokens: revoke the token in the user or project settings, check the audit log for its use.
- The Flask application's `SECRET_KEY`: a new value invalidates existing sessions, which is the goal.
- Database password: change the password, check the database login logs.

### Rewriting history

Once the secrets are revoked, you can remove them from history so that scanners and people no longer find them. The recommended tool is **git filter-repo** (installed separately; the alternative is BFG Repo-Cleaner). `git filter-branch` is slow and git itself doesn't recommend it.

```bash
# work on a fresh clone, never on a working directory with changes
git clone --mirror https://gitlab.kurs-shop.ba/shop/kurs-shop.git kurs-shop-clean.git
cd kurs-shop-clean.git

# replace values in all commits
cat > ../replacements.txt <<'EOF'
regex:AKIA[0-9A-Z]{16}==>AKIA_REMOVED
regex:https://hooks\.slack\.com/services/[A-Za-z0-9/]+==>SLACK_WEBHOOK_REMOVED
EOF
git filter-repo --replace-text ../replacements.txt

# or remove the whole file from the entire history
# git filter-repo --invert-paths --path config/settings.py

# verify
gitleaks git . --log-opts="--all" -v --redact
```

After that you need to force push all branches and tags (temporarily allow force push on protected branches), and on GitLab also clean up the server: Settings → Repository → *Repository cleanup* (upload `filter-repo/commit-map`) or *Remove blobs*, so the old objects also disappear from MR references and caches.

Consequences and limitations:

- All commit hashes change. Every developer must re-clone (or hard reset) the repo; old clones still have the secret.
- Forks, copies on CI runners, artifacts, images and mirrors are not covered.
- On a public repo it's cosmetic: the secret may already have been taken. That's why revocation always comes first.

> **In practice:** for a private repo with many developers it is often more sensible **not** to rewrite history: the secret is revoked and harmless, while rewriting breaks open MRs and local branches for everyone. Add the fingerprint to `.gitleaksignore` with the incident number and the revocation date. Rewrite when the repo is public, when regulation requires it, or when the history contains data that can't be "revoked" (personal data, a root CA private key).

## Summary

- Secrets are found with regexes for known formats, entropy and keywords; TruffleHog adds liveness **verification**.
- gitleaks 8.x: `gitleaks git` (history, `--log-opts`), `gitleaks dir` (files), `--redact`, `--report-format sarif`, exit code 1 on findings; `detect`/`protect` are deprecated.
- Configuration: `.gitleaks.toml` with `[extend] useDefault = true`, your own `[[rules]]` and `[[allowlists]]`; individual exceptions in `.gitleaksignore` (fingerprint + reason); existing findings in a **baseline**.
- In an MR, scan only new commits and block from day one; scan the whole history periodically.
- Layers: pre-commit hook (bypassable), push protection (bypassable with an audit trail), mandatory pipeline job, periodic scan.
- Leaked secret: **revoke first**, then rotate, investigate (CloudTrail, audit logs), clean up the code, and if needed rewrite history with `git filter-repo`.
- Deleting a secret in the next commit solves nothing: the secret is in the history, in clones and in forks.
