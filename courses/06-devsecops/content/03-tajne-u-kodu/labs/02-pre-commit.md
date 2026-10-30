# Lab 2: pre-commit hook i vlastito pravilo

Job u pipelineu otkriva tajnu tek **nakon** pusha, kad je ona već na serveru. Jeftinije je zaustaviti je na laptopu developera, prije commita. Za to služi framework **pre-commit**.

Kurs Shop koristi i interne API tokene oblika `kshop_` + 32 heksadecimalna znaka. Ugrađena pravila gitleaksa ih ne prepoznaju, pa ćeš napisati vlastito pravilo.

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

## Hook prije commita

1. Napravi `.pre-commit-config.yaml` sa **lokalnim** hookom (`repo: local`, jer lab nema pristup GitHubu) id-a `gitleaks`, koji pokreće `gitleaks git --pre-commit --staged --redact --verbose` (`language: system`, `pass_filenames: false`).
2. Instaliraj hook u repo (`pre-commit install`).
3. Provjeri: commit fajla sa AWS ključem mora biti odbijen.

```bash
printf 'KEY = "AKIAZ7XQ4MPLW2NRT5VB"\n' > test.py
git add test.py && git commit -m test      # mora pasti
git rm -q --cached test.py && rm test.py
```

<!-- verify
cd /root/kurs-shop
[ -f .pre-commit-config.yaml ] || { echo "nema .pre-commit-config.yaml"; exit 1; }
[ "$(yq '.repos[] | select(.repo == "local") | .hooks[] | select(.id == "gitleaks") | .id' .pre-commit-config.yaml)" = "gitleaks" ] || { echo "nema lokalnog hooka sa id: gitleaks"; exit 1; }
[ -x .git/hooks/pre-commit ] && grep -q pre-commit .git/hooks/pre-commit || { echo "hook nije instaliran (pre-commit install)"; exit 1; }
git status --porcelain | grep -q 'test.py' && { echo "ukloni test.py iz repoa"; exit 1; }
printf 'AWS_KEY = "AKIAZ7XQ4MPLW2NRT5VB"\n' > zz_provjera.py && git add zz_provjera.py
if git commit -qm "provjera hooka" >/dev/null 2>&1; then git reset -q --hard HEAD~1; echo "commit sa AWS ključem je prošao: hook ne radi"; exit 1; fi
git rm -q --cached zz_provjera.py; rm -f zz_provjera.py
printf '# obična izmjena\n' >> README.md && git add README.md
git commit -qm "provjera hooka: čist commit" >/dev/null 2>&1 || { git checkout -q -- README.md; git reset -q; echo "hook odbija i commit bez tajni"; exit 1; }
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
Hook se može zaobići sa `git commit --no-verify`. Zato je pre-commit samo prva linija odbrane, a job u pipelineu ostaje obavezan.
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

## Vlastito pravilo za interne tokene

Napravi `.gitleaks.toml` u korijenu repoa koji:

- zadržava sva ugrađena pravila (`[extend]` sa `useDefault = true`),
- dodaje pravilo `id = "kurs-shop-api-token"` za tokene `kshop_` + tačno 32 mala heksadecimalna znaka (`[0-9a-f]{32}`), sa ključnom riječi `kshop_`.

Gitleaks automatski čita `.gitleaks.toml` iz direktorija koji skenira, pa ga koristi i hook. Provjeri:

```bash
printf 'TOKEN = "kshop_3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e"\n' > /tmp/t/x.py
gitleaks dir /tmp/t -v -c .gitleaks.toml
```

<!-- verify
cd /root/kurs-shop
[ -f .gitleaks.toml ] || { echo "nema .gitleaks.toml"; exit 1; }
t=$(mktemp -d)
printf 'TOKEN = "kshop_3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e"\n' > $t/a.py
gitleaks dir $t -c .gitleaks.toml --no-banner --report-format json --report-path $t/r.json >/dev/null 2>&1
jq -e '[.[] | select(.RuleID == "kurs-shop-api-token")] | length == 1' $t/r.json >/dev/null 2>&1 || { rm -rf $t; echo "pravilo kurs-shop-api-token ne pronalazi kshop_ token"; exit 1; }
rm -f $t/a.py $t/r.json
printf 'X = "kshop_nije-token"\nY = "kshop_3F9A1C7E5B2D4F6A8C0E1B3D5F7A9C2"\n' > $t/b.py
gitleaks dir $t -c .gitleaks.toml --no-banner --report-format json --report-path $t/r.json >/dev/null 2>&1
jq -e '[.[] | select(.RuleID == "kurs-shop-api-token")] | length == 0' $t/r.json >/dev/null 2>&1 || { rm -rf $t; echo "pravilo je preširoko (hvata i vrijednosti koje nisu 32 mala heksa znaka)"; exit 1; }
rm -f $t/b.py $t/r.json
printf 'KEY = "AKIAZ7XQ4MPLW2NRT5VB"\n' > $t/c.py
gitleaks dir $t -c .gitleaks.toml --no-banner >/dev/null 2>&1 && { rm -rf $t; echo "ugrađena pravila više ne rade (useDefault = true?)"; exit 1; }
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
`keywords` ubrzava skeniranje: regex se provjerava samo na tekstu koji sadrži neku od ključnih riječi.
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
