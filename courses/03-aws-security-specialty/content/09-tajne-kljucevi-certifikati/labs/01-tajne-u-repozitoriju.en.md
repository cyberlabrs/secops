# Lab 1: Secrets in a git repository

A few weeks ago a developer committed an AWS access key to the repository of the `narudzbe` (orders) service and then "deleted" it in the next commit. The key is still in the repository's **history**, and the repo has been seen by several people and CI systems.

You will do what the exam and practice require, in this order: **find**, **revoke and rotate**, **remove from code** (replace with Secrets Manager), **prevent recurrence** (pre-commit hook), and only at the end **clean the history**.

The repo is in `/root/narudzbe`. The tool is **gitleaks**. In AWS, **Amazon CodeGuru Security** / **Amazon Q Developer** scanning and **GitHub secret scanning** do similar work. AWS itself also monitors public repositories and quarantines leaked keys (the `AWSCompromisedKeyQuarantine` policy).

<!-- setup
set -e
mkdir -p /root/narudzbe && cd /root/narudzbe
git init -q
cat > app.py <<'EOF'
import os
from config import AWS_REGION

def handler(event, context):
    return {"status": "ok", "region": AWS_REGION}
EOF
printf 'AWS_REGION = "eu-central-1"\n' > config.py
git add . && GIT_COMMITTER_DATE="2026-09-01T10:00:00" git commit -q --date "2026-09-01T10:00:00" -m "Početna verzija servisa"
cat > config.py <<'EOF'
AWS_REGION = "eu-central-1"
# privremeno, za lokalno testiranje
AWS_ACCESS_KEY_ID = "AKIAQ3EGTV7KZ4PLM2NX"
AWS_SECRET_ACCESS_KEY = "u8Jd2kq9ZtW4xPv7Lr3NbYc6Hs1Fe5Ga0QmXoTi"
EOF
git add . && GIT_COMMITTER_DATE="2026-09-15T16:42:00" git commit -q --date "2026-09-15T16:42:00" -m "Dodan pristup S3 za izvoz"
printf 'AWS_REGION = "eu-central-1"\n' > config.py
cat > notify.py <<'EOF'
import json, urllib.request
SLACK_WEBHOOK = "https://hooks.slack.com/services/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"

def notify(msg):
    req = urllib.request.Request(SLACK_WEBHOOK, data=json.dumps({"text": msg}).encode())
    urllib.request.urlopen(req)
EOF
git add . && GIT_COMMITTER_DATE="2026-09-16T09:05:00" git commit -q --date "2026-09-16T09:05:00" -m "Uklonjeni ključevi, dodane Slack notifikacije"
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Tajne u git repozitoriju ===
Repo: /root/narudzbe    Skeniranje: gitleaks git -v .    (trenutni fajlovi: gitleaks dir -v .)
EOF
-->

## Find the secrets

Scan the **entire history** and, separately, only the current files:

```bash
cd /root/narudzbe
git log --oneline
gitleaks git -v --no-banner .
gitleaks dir -v --no-banner .
```

Scanning only the current files would miss the AWS key: it was deleted from the code, but it lives on in a commit. That is why CI scans the history, not just the current state of the code.

Write three lines to `/root/nalaz.txt`:

1. the Access Key ID that leaked,
2. the short SHA (7 characters) of the commit in which the key was **added** (its message is `Dodan pristup S3 za izvoz`, "Added S3 access for export"),
3. the rule ID (RuleID) under which gitleaks reports the Slack webhook.

<!-- verify
f=/root/nalaz.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "AKIAQ3EGTV7KZ4PLM2NX" ] || { echo "First line: the Access Key ID"; exit 1; }
want=$(cd /root/narudzbe && git log --format=%h --abbrev=7 --grep='Dodan pristup S3' --all | tail -1)
got=$(sed -n 2p $f | xargs | cut -c1-7)
[ -n "$want" ] || { echo "The commit with the key no longer exists in the history. This step is done before cleaning the history."; exit 1; }
[ "$got" = "$want" ] || { echo "Second line: the SHA of the commit that ADDED the key"; exit 1; }
[ "$(sed -n 3p $f | xargs)" = "slack-webhook-url" ] || { echo "Third line: the RuleID for the Slack webhook"; exit 1; }
-->
<!-- solution
cd /root/narudzbe && printf 'AKIAQ3EGTV7KZ4PLM2NX\n%s\nslack-webhook-url\n' "$(git log --format=%h --abbrev=7 --grep='Dodan pristup S3' | tail -1)" > /root/nalaz.txt
-->

## Rotation before cleanup

The first move is **not** deleting from git. The key may already have been copied, so it must be made useless. Prepare `/root/rotacija.sh` with the commands you would run in the account:

1. deactivate the leaked key (`aws iam update-access-key … --status Inactive`),
2. check in CloudTrail whether anyone has used it since September 15 (`aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=…`),
3. only once the check is done, delete it (`aws iam delete-access-key`).

For the Slack webhook, rotation means generating a new URL in Slack and revoking the old one.

<!-- verify
f=/root/rotacija.sh
[ -f $f ] && bash -n $f || { echo "rotacija.sh does not exist or has a syntax error"; exit 1; }
grep -qE 'update-access-key.*AKIAQ3EGTV7KZ4PLM2NX.*Inactive|update-access-key.*Inactive.*AKIAQ3EGTV7KZ4PLM2NX' $f || { echo "The key is not deactivated"; exit 1; }
grep -qE 'lookup-events.*AccessKeyId.*AKIAQ3EGTV7KZ4PLM2NX' $f || { echo "There is no CloudTrail check of the key's usage"; exit 1; }
a=$(grep -n 'update-access-key' $f | head -1 | cut -d: -f1); b=$(grep -n 'delete-access-key' $f | head -1 | cut -d: -f1)
[ -n "$b" ] || { echo "The key is not deleted at the end"; exit 1; }
[ "$a" -lt "$b" ] || { echo "Deactivation must come before deletion"; exit 1; }
-->
<!-- solution
cat > /root/rotacija.sh <<'EOF'
#!/bin/bash
set -euo pipefail
aws iam update-access-key --user-name dev-narudzbe --access-key-id AKIAQ3EGTV7KZ4PLM2NX --status Inactive
aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAQ3EGTV7KZ4PLM2NX --start-time 2026-09-15
aws iam delete-access-key --user-name dev-narudzbe --access-key-id AKIAQ3EGTV7KZ4PLM2NX
EOF
-->

## Remove the secrets from the code

`notify.py` still has the Slack webhook in the code. Rewrite it so that it reads the URL from the `SLACK_WEBHOOK_URL` environment variable. In Lambda, that value would come from **Secrets Manager** (e.g., through the *Parameters and Secrets Lambda Extension*), not from code. Commit the change.

```bash
nano notify.py
gitleaks dir -v --no-banner .
git commit -am "Slack webhook from environment"
```

The AWS key in the application should not be replaced with another key but with an **IAM role** (Lambda execution role). Static keys in code are an anti-pattern in themselves.

<!-- verify
cd /root/narudzbe
gitleaks dir --no-banner . >/dev/null 2>&1 || { echo "gitleaks still finds a secret in the current files"; exit 1; }
grep -q 'SLACK_WEBHOOK_URL' notify.py || { echo "notify.py does not read SLACK_WEBHOOK_URL"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "The change is not committed"; exit 1; }
-->
<!-- solution
cd /root/narudzbe && sed -i 's|^SLACK_WEBHOOK = .*|SLACK_WEBHOOK = os.environ["SLACK_WEBHOOK_URL"]|; s|^import json, urllib.request|import json, os, urllib.request|' notify.py && git commit -qam "Slack webhook iz okruženja"
-->

## Pre-commit hook

Create `.git/hooks/pre-commit` that runs gitleaks on **staged** changes and blocks the commit if it finds a secret:

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/sh
exec gitleaks git --pre-commit --staged --no-banner --redact -v .
EOF
chmod +x .git/hooks/pre-commit
```

Test it:

```bash
echo 'TOKEN = "AKIAQ7XMBT2LW9RD4KZC"' > test_tajna.py
git add test_tajna.py
git commit -m "test"
git reset -q HEAD test_tajna.py && rm test_tajna.py
```

The commit must be rejected. A local hook is the first line of defense, but a developer can bypass it (`--no-verify`), so the same check must also exist in CI.

<!-- verify
cd /root/narudzbe
[ -x .git/hooks/pre-commit ] || { echo "There is no executable .git/hooks/pre-commit"; exit 1; }
echo 'TOKEN = "AKIAQ7XMBT2LW9RD4KZC"' > /tmp/hooktest.py && cp /tmp/hooktest.py ./hooktest_x.py && git add hooktest_x.py
if git commit -qm "hook test" >/dev/null 2>&1; then git reset -q --hard HEAD~1; echo "The hook did not block a commit with a secret"; exit 1; fi
git reset -q HEAD hooktest_x.py; rm -f hooktest_x.py
exit 0
-->
<!-- solution
cd /root/narudzbe && printf '#!/bin/sh\nexec gitleaks git --pre-commit --staged --no-banner --redact -v .\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
-->

## Clean the history

Only now, once the key has been revoked, do you remove it from the history. Here we use `git filter-branch` because it is available everywhere. In practice the faster `git filter-repo` or BFG is used. We rewrite `config.py` in **every** commit, and then delete everything that still keeps the old history: backup refs, the reflog, and unreachable objects.

```bash
cd /root/narudzbe
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --tree-filter \
  "sed -i '/AWS_ACCESS_KEY_ID\|AWS_SECRET_ACCESS_KEY\|privremeno/d' config.py; sed -i 's|^SLACK_WEBHOOK = \".*\"|SLACK_WEBHOOK = os.environ[\"SLACK_WEBHOOK_URL\"]|' notify.py 2>/dev/null || true" -- --all
git for-each-ref --format='%(refname)' refs/original/ | xargs -r -n1 git update-ref -d
git reflog expire --expire=now --all
git gc --prune=now --quiet
gitleaks git -v --no-banner . && echo "History is clean"
```

(`privremeno` in the sed pattern matches the Serbian comment "temporary" that was committed together with the key.)

Rewriting history changes the SHA of every commit. Everyone who cloned the repo must clone it again, and forks and old clones still have the key. That is why rotation always comes **first**.

<!-- verify
cd /root/narudzbe
gitleaks git --no-banner . >/dev/null 2>&1 || { echo "gitleaks still finds secrets in the history (refs/original? reflog?)"; exit 1; }
git log --all -p | grep -q 'AKIAQ3EGTV7KZ4PLM2NX' && { echo "The key is still in the history"; exit 1; }
[ -n "$(git log --oneline | head -1)" ] || { echo "The repository has no commits"; exit 1; }
grep -q 'AWS_REGION' config.py || { echo "config.py lost AWS_REGION"; exit 1; }
-->
<!-- solution
cd /root/narudzbe
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --tree-filter "sed -i '/AWS_ACCESS_KEY_ID\|AWS_SECRET_ACCESS_KEY\|privremeno/d' config.py; sed -i 's|^SLACK_WEBHOOK = \".*\"|SLACK_WEBHOOK = os.environ[\"SLACK_WEBHOOK_URL\"]|' notify.py 2>/dev/null || true" -- --all >/dev/null 2>&1
git for-each-ref --format='%(refname)' refs/original/ | xargs -r -n1 git update-ref -d
git reflog expire --expire=now --all && git gc --prune=now --quiet
-->
