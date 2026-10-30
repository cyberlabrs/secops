# Lab 1: Secrets in git history

In September a developer committed an AWS key and a Slack webhook, and a week later "removed" them with a new commit. They are no longer in the current code, but git remembers every version of the file.

You will find them with **gitleaks**, record them as resolved (after rotation) and add a job that blocks any new secret.

```bash
cd /root/kurs-shop
git log --oneline
gitleaks dir . -v
gitleaks git . -v
```

<!-- setup
set -e
kurs-repo
-->

## Find the leaked secrets

1. Scan the repo's **entire history** and save the report in JSON format to `/root/gitleaks.json`.
2. Write the full SHA of the commit in which the secrets were first added to `/root/commit.txt`.

```bash
gitleaks git . --report-format json --report-path /root/gitleaks.json
jq -r '.[] | [.RuleID, .File, .Commit[0:8]] | @tsv' /root/gitleaks.json
```

<!-- verify
[ -s /root/gitleaks.json ] || { echo "/root/gitleaks.json does not exist"; exit 1; }
jq -e 'type == "array"' /root/gitleaks.json >/dev/null 2>&1 || { echo "gitleaks.json is not a gitleaks JSON report"; exit 1; }
jq -e '[.[] | select(.File == "config/settings.py")] | length > 0' /root/gitleaks.json >/dev/null || { echo "the report has no findings from history (config/settings.py): did you scan the git history?"; exit 1; }
want=$(cd /root/kurs-shop && git log --format=%H --diff-filter=A -- config/settings.py | tail -1)
[ "$(tr -d ' \n' < /root/commit.txt 2>/dev/null)" = "$want" ] || { echo "commit.txt does not contain the correct full SHA of the commit with the secrets"; exit 1; }
-->
<!-- hint
`gitleaks dir` scans only files on disk; `gitleaks git` goes through all commits. In the JSON report the `Commit` field is the SHA, and `git log --format=%H` gives the full SHA.
-->
<!-- solution
cd /root/kurs-shop
gitleaks git . --report-format json --report-path /root/gitleaks.json >/dev/null 2>&1 || true
jq -r '[.[] | select(.File == "config/settings.py")][0].Commit' /root/gitleaks.json > /root/commit.txt
-->

## A secret in the current code

`gitleaks dir .` also finds a secret that is **still** in the code: a GitLab token in the `Dockerfile` (`ENV API_TOKEN=…`). The token must not be in the image or in the repo.

Remove the line with the token from the `Dockerfile` and commit the change. After that, `gitleaks dir .` must find nothing.

<!-- verify
cd /root/kurs-shop
grep -q 'glpat-' Dockerfile && { echo "the Dockerfile still contains the token"; exit 1; }
gitleaks dir . --no-banner >/dev/null 2>&1 || { echo "gitleaks dir . still finds a secret in the current files"; exit 1; }
git diff --quiet HEAD -- Dockerfile || { echo "the Dockerfile change is not committed"; exit 1; }
git log -1 --format=%H -- Dockerfile | xargs -I{} git show {} -- Dockerfile | grep -q '^-.*glpat-' || { echo "there is no commit that removes the token from the Dockerfile"; exit 1; }
-->
<!-- hint
```bash
sed -i '/API_TOKEN/d' Dockerfile
git commit -am "Uklonjen token iz Dockerfilea"
```
Deleting it from the code doesn't undo the leak: the token is still in the history, so in reality revoke it in GitLab immediately.
-->
<!-- solution
cd /root/kurs-shop
sed -i '/API_TOKEN/d' Dockerfile
git commit -qam "Uklonjen token iz Dockerfilea"
-->

## Record the resolved findings and add a job

All keys have been revoked and replaced (rotated). You don't want to rewrite the old findings out of history (`git filter-repo` would change the SHA of every commit), but you also don't want the pipeline to fail forever because of them.

1. Add the **fingerprint** of every existing finding to `.gitleaksignore` in the repo root (the `Fingerprint` field from the report, one per line) and commit the file.
2. Add a `secret-detection` job (stage `test`) that runs `gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif` and keeps `gitleaks.sarif` as an artifact even when it fails.
3. The pipeline (`gitlab-ci-local secret-detection`) must now pass, and any **new** secret must make it fail.

```bash
gitleaks git . --report-format json --report-path /tmp/sve.json
jq -r '.[].Fingerprint' /tmp/sve.json > .gitleaksignore
```

<!-- verify
cd /root/kurs-shop
[ -s .gitleaksignore ] || { echo ".gitleaksignore is missing"; exit 1; }
git ls-files --error-unmatch .gitleaksignore >/dev/null 2>&1 || { echo ".gitleaksignore is not committed"; exit 1; }
gitleaks git . --no-banner >/dev/null 2>&1 || { echo "gitleaks git still fails: some old finding is not in .gitleaksignore"; exit 1; }
[ "$(yq '.["secret-detection"].stage' .gitlab-ci.yml)" = "test" ] || { echo "the secret-detection job does not exist or is not in the test stage"; exit 1; }
yq '.["secret-detection"].script | join(" ")' .gitlab-ci.yml | grep -q 'gitleaks git' || { echo "secret-detection does not run gitleaks git"; exit 1; }
[ "$(yq '.["secret-detection"].artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "the artifact needs artifacts: when: always"; exit 1; }
yq '.["secret-detection"].artifacts.paths[]' .gitlab-ci.yml | grep -qx 'gitleaks.sarif' || { echo "gitleaks.sarif is not in artifacts.paths"; exit 1; }
[ "$(yq '.["secret-detection"].allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "secret-detection must not have allow_failure"; exit 1; }
rm -f gitleaks.sarif
gitlab-ci-local secret-detection > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the secret-detection job fails on a clean repo"; exit 1; }
[ -s gitleaks.sarif ] || { echo "the job did not produce gitleaks.sarif"; exit 1; }
t=$(mktemp -d) && git clone -q . $t/r && cd $t/r && cp /root/kurs-shop/.gitlab-ci.yml . 2>/dev/null
printf 'SLACK = "https://hooks.slack.com/services/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"\n' > novi.py && git add novi.py && git commit -qm test
gitleaks git . --no-banner >/dev/null 2>&1 && { rm -rf $t; echo "a new secret does not fail the check: is .gitleaksignore too broad?"; exit 1; }
rm -rf $t
exit 0
-->
<!-- hint
```yaml
secret-detection:
  stage: test
  script:
    - gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif
  artifacts:
    when: always
    paths: [gitleaks.sarif]
```
A fingerprint has the form `commit:file:rule:line`, so it ignores exactly that finding in that commit. The same key added in a new commit will be reported again.
-->
<!-- solution
cd /root/kurs-shop
gitleaks git . --report-format json --report-path /tmp/sve.json >/dev/null 2>&1 || true
jq -r '.[].Fingerprint' /tmp/sve.json > .gitleaksignore
git add .gitleaksignore && git commit -qm "Evidentirani rotirani nalazi"
yq -i '.["secret-detection"] = {"stage": "test", "script": ["gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif"], "artifacts": {"when": "always", "paths": ["gitleaks.sarif"]}}' .gitlab-ci.yml
gitlab-ci-local secret-detection >/dev/null 2>&1
-->
