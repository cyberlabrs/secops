# Lab 2: pre-commit hook and a custom rule

A pipeline job detects a secret only **after** the push, when it is already on the server. It's cheaper to stop it on the developer's laptop, before the commit. That is what the **pre-commit** framework is for.

Kurs Shop also uses internal API tokens of the form `kshop_` + 32 hexadecimal characters. The built-in gitleaks rules don't recognize them, so you will write a custom rule.

```bash
cd /root/kurs-shop
pre-commit --version
gitleaks git --help | grep -A1 -- --pre-commit
```

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
sed -i '/API_TOKEN/d' Dockerfile && git commit -qam "Uklonjen token iz Dockerfilea"
-->

## Hook before the commit

1. Create `.pre-commit-config.yaml` with a **local** hook (`repo: local`, because the lab has no access to GitHub) with id `gitleaks`, which runs `gitleaks git --pre-commit --staged --redact --verbose` (`language: system`, `pass_filenames: false`).
2. Install the hook in the repo (`pre-commit install`).
3. Check: committing a file with an AWS key must be rejected.

```bash
printf 'KEY = "AKIAZ7XQ4MPLW2NRT5VB"\n' > test.py
git add test.py && git commit -m test      # must fail
git rm -q --cached test.py && rm test.py
```

<!-- verify
cd /root/kurs-shop
[ -f .pre-commit-config.yaml ] || { echo ".pre-commit-config.yaml is missing"; exit 1; }
[ "$(yq '.repos[] | select(.repo == "local") | .hooks[] | select(.id == "gitleaks") | .id' .pre-commit-config.yaml)" = "gitleaks" ] || { echo "there is no local hook with id: gitleaks"; exit 1; }
[ -x .git/hooks/pre-commit ] && grep -q pre-commit .git/hooks/pre-commit || { echo "the hook is not installed (pre-commit install)"; exit 1; }
git status --porcelain | grep -q 'test.py' && { echo "remove test.py from the repo"; exit 1; }
printf 'AWS_KEY = "AKIAZ7XQ4MPLW2NRT5VB"\n' > zz_provjera.py && git add zz_provjera.py
if git commit -qm "provjera hooka" >/dev/null 2>&1; then git reset -q --hard HEAD~1; echo "a commit with an AWS key went through: the hook doesn't work"; exit 1; fi
git rm -q --cached zz_provjera.py; rm -f zz_provjera.py
printf '# obična izmjena\n' >> README.md && git add README.md
git commit -qm "provjera hooka: čist commit" >/dev/null 2>&1 || { git checkout -q -- README.md; git reset -q; echo "the hook also rejects a commit without secrets"; exit 1; }
git reset -q --hard HEAD~1
-->
<!-- hint
```yaml
repos:
  - repo: local
    hooks:
      - id: gitleaks
        name: gitleaks
        entry: gitleaks git --pre-commit --staged --redact --verbose
        language: system
        pass_filenames: false
```
The hook can be bypassed with `git commit --no-verify`. That's why pre-commit is only the first line of defense, and the pipeline job remains mandatory.
-->
<!-- solution
cd /root/kurs-shop
cat > .pre-commit-config.yaml <<'EOF'
repos:
  - repo: local
    hooks:
      - id: gitleaks
        name: gitleaks
        entry: gitleaks git --pre-commit --staged --redact --verbose
        language: system
        pass_filenames: false
EOF
pre-commit install >/dev/null
git add .pre-commit-config.yaml && git commit -qm "pre-commit: gitleaks"
-->

## A custom rule for internal tokens

Create `.gitleaks.toml` in the repo root that:

- keeps all the built-in rules (`[extend]` with `useDefault = true`),
- adds a rule `id = "kurs-shop-api-token"` for tokens `kshop_` + exactly 32 lowercase hexadecimal characters (`[0-9a-f]{32}`), with the keyword `kshop_`.

Gitleaks automatically reads `.gitleaks.toml` from the directory it scans, so the hook uses it too. Check:

```bash
printf 'TOKEN = "kshop_3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e"\n' > /tmp/t/x.py
gitleaks dir /tmp/t -v -c .gitleaks.toml
```

<!-- verify
cd /root/kurs-shop
[ -f .gitleaks.toml ] || { echo ".gitleaks.toml is missing"; exit 1; }
t=$(mktemp -d)
printf 'TOKEN = "kshop_3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e"\n' > $t/a.py
gitleaks dir $t -c .gitleaks.toml --no-banner --report-format json --report-path $t/r.json >/dev/null 2>&1
jq -e '[.[] | select(.RuleID == "kurs-shop-api-token")] | length == 1' $t/r.json >/dev/null 2>&1 || { rm -rf $t; echo "the kurs-shop-api-token rule does not find the kshop_ token"; exit 1; }
rm -f $t/a.py $t/r.json
printf 'X = "kshop_nije-token"\nY = "kshop_3F9A1C7E5B2D4F6A8C0E1B3D5F7A9C2"\n' > $t/b.py
gitleaks dir $t -c .gitleaks.toml --no-banner --report-format json --report-path $t/r.json >/dev/null 2>&1
jq -e '[.[] | select(.RuleID == "kurs-shop-api-token")] | length == 0' $t/r.json >/dev/null 2>&1 || { rm -rf $t; echo "the rule is too broad (it also matches values that are not 32 lowercase hex characters)"; exit 1; }
rm -f $t/b.py $t/r.json
printf 'KEY = "AKIAZ7XQ4MPLW2NRT5VB"\n' > $t/c.py
gitleaks dir $t -c .gitleaks.toml --no-banner >/dev/null 2>&1 && { rm -rf $t; echo "the built-in rules no longer work (useDefault = true?)"; exit 1; }
rm -rf $t
-->
<!-- hint
```toml
[extend]
useDefault = true

[[rules]]
id = "kurs-shop-api-token"
description = "Kurs Shop interni API token"
regex = '''kshop_[0-9a-f]{32}\b'''
keywords = ["kshop_"]
```
`keywords` speeds up scanning: the regex is checked only on text that contains one of the keywords.
-->
<!-- solution
cd /root/kurs-shop
cat > .gitleaks.toml <<'EOF'
[extend]
useDefault = true

[[rules]]
id = "kurs-shop-api-token"
description = "Kurs Shop interni API token"
regex = '''kshop_[0-9a-f]{32}\b'''
keywords = ["kshop_"]
EOF
-->
