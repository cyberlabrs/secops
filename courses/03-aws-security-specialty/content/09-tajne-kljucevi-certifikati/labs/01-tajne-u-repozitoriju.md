# Lab 1: Tajne u git repozitoriju

Developer je prije nekoliko sedmica commitao AWS access ključ u repozitorij servisa `narudzbe`, a zatim ga „obrisao“ u sljedećem commitu. Ključ je i dalje u **istoriji** repozitorija, a repo je vidjelo više ljudi i CI sistema.

Uradićeš ono što ispit i praksa traže tim redom: **pronađi**, **opozovi i rotiraj**, **ukloni iz koda** (zamijeni Secrets Managerom), **spriječi ponavljanje** (pre-commit hook) i tek na kraju **očisti istoriju**.

Repo je u `/root/narudzbe`. Alat je **gitleaks**. U AWS-u slično rade **Amazon CodeGuru Security** / **Amazon Q Developer** skeniranje i **GitHub secret scanning**. AWS i sam prati javne repozitorije i stavlja procurjele ključeve u karantin (politika `AWSCompromisedKeyQuarantine`).

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

## Pronađi tajne

Skeniraj **cijelu istoriju** i, odvojeno, samo trenutne fajlove:

```bash
cd /root/narudzbe
git log --oneline
gitleaks git -v --no-banner .
gitleaks dir -v --no-banner .
```

Skeniranje samo trenutnih fajlova bi propustilo AWS ključ: obrisan je iz koda, ali živi u commitu. Zato CI skenira istoriju, a ne samo trenutno stanje koda.

U `/root/nalaz.txt` upiši tri linije:

1. Access Key ID koji je procurio,
2. kratki SHA (7 znakova) commita u kojem je ključ **dodan**,
3. ID pravila (RuleID) pod kojim gitleaks prijavljuje Slack webhook.

<!-- verify
f=/root/nalaz.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "AKIAQ3EGTV7KZ4PLM2NX" ] || { echo "Prva linija: Access Key ID"; exit 1; }
want=$(cd /root/narudzbe && git log --format=%h --abbrev=7 --grep='Dodan pristup S3' --all | tail -1)
got=$(sed -n 2p $f | xargs | cut -c1-7)
[ -n "$want" ] || { echo "Commit sa ključem više ne postoji u istoriji. Ovaj korak se radi prije čišćenja istorije."; exit 1; }
[ "$got" = "$want" ] || { echo "Druga linija: SHA commita koji je DODAO ključ"; exit 1; }
[ "$(sed -n 3p $f | xargs)" = "slack-webhook-url" ] || { echo "Treća linija: RuleID za Slack webhook"; exit 1; }
-->
<!-- solution
cd /root/narudzbe && printf 'AKIAQ3EGTV7KZ4PLM2NX\n%s\nslack-webhook-url\n' "$(git log --format=%h --abbrev=7 --grep='Dodan pristup S3' | tail -1)" > /root/nalaz.txt
-->

## Rotacija prije čišćenja

Prvi potez **nije** brisanje iz gita. Ključ je možda već kopiran, pa se mora učiniti beskorisnim. Pripremi `/root/rotacija.sh` sa komandama koje bi pokrenuo u nalogu:

1. deaktiviraj procurjeli ključ (`aws iam update-access-key … --status Inactive`),
2. u CloudTrail-u provjeri da li ga je neko koristio od 15. septembra (`aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=…`),
3. tek kad je provjera gotova, obriši ga (`aws iam delete-access-key`).

Za Slack webhook rotacija znači generisanje novog URL-a u Slacku i opoziv starog.

<!-- verify
f=/root/rotacija.sh
[ -f $f ] && bash -n $f || { echo "rotacija.sh ne postoji ili ima sintaksnu grešku"; exit 1; }
grep -qE 'update-access-key.*AKIAQ3EGTV7KZ4PLM2NX.*Inactive|update-access-key.*Inactive.*AKIAQ3EGTV7KZ4PLM2NX' $f || { echo "Nema deaktivacije ključa"; exit 1; }
grep -qE 'lookup-events.*AccessKeyId.*AKIAQ3EGTV7KZ4PLM2NX' $f || { echo "Nema provjere upotrebe ključa u CloudTrail-u"; exit 1; }
a=$(grep -n 'update-access-key' $f | head -1 | cut -d: -f1); b=$(grep -n 'delete-access-key' $f | head -1 | cut -d: -f1)
[ -n "$b" ] || { echo "Nema brisanja ključa na kraju"; exit 1; }
[ "$a" -lt "$b" ] || { echo "Deaktivacija mora biti prije brisanja"; exit 1; }
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

## Ukloni tajne iz koda

`notify.py` i dalje ima Slack webhook u kodu. Prepravi ga tako da URL čita iz varijable okruženja `SLACK_WEBHOOK_URL`. U Lambdi bi ta vrijednost dolazila iz **Secrets Managera** (npr. preko *Parameters and Secrets Lambda Extension*), a ne iz koda. Commituj promjenu.

```bash
nano notify.py
gitleaks dir -v --no-banner .
git commit -am "Slack webhook iz okruženja"
```

AWS ključ u aplikaciji ne treba zamijeniti drugim ključem nego **IAM rolom** (Lambda execution role). Statični ključevi u kodu su anti-obrazac sam po sebi.

<!-- verify
cd /root/narudzbe
gitleaks dir --no-banner . >/dev/null 2>&1 || { echo "gitleaks i dalje nalazi tajnu u trenutnim fajlovima"; exit 1; }
grep -q 'SLACK_WEBHOOK_URL' notify.py || { echo "notify.py ne čita SLACK_WEBHOOK_URL"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Promjena nije commitovana"; exit 1; }
-->
<!-- solution
cd /root/narudzbe && sed -i 's|^SLACK_WEBHOOK = .*|SLACK_WEBHOOK = os.environ["SLACK_WEBHOOK_URL"]|; s|^import json, urllib.request|import json, os, urllib.request|' notify.py && git commit -qam "Slack webhook iz okruženja"
-->

## Pre-commit hook

Napravi `.git/hooks/pre-commit` koji pokreće gitleaks nad **staged** promjenama i blokira commit ako nađe tajnu:

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/sh
exec gitleaks git --pre-commit --staged --no-banner --redact -v .
EOF
chmod +x .git/hooks/pre-commit
```

Testiraj ga:

```bash
echo 'TOKEN = "AKIAQ7XMBT2LW9RD4KZC"' > test_tajna.py
git add test_tajna.py
git commit -m "test"
git reset -q HEAD test_tajna.py && rm test_tajna.py
```

Commit mora biti odbijen. Lokalni hook je prva linija odbrane, ali ga developer može zaobići (`--no-verify`), zato ista provjera mora postojati i u CI-ju.

<!-- verify
cd /root/narudzbe
[ -x .git/hooks/pre-commit ] || { echo "Nema izvršnog .git/hooks/pre-commit"; exit 1; }
echo 'TOKEN = "AKIAQ7XMBT2LW9RD4KZC"' > /tmp/hooktest.py && cp /tmp/hooktest.py ./hooktest_x.py && git add hooktest_x.py
if git commit -qm "hook test" >/dev/null 2>&1; then git reset -q --hard HEAD~1; echo "Hook nije blokirao commit sa tajnom"; exit 1; fi
git reset -q HEAD hooktest_x.py; rm -f hooktest_x.py
exit 0
-->
<!-- solution
cd /root/narudzbe && printf '#!/bin/sh\nexec gitleaks git --pre-commit --staged --no-banner --redact -v .\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
-->

## Očisti istoriju

Tek sada, kad je ključ opozvan, uklanjaš ga iz istorije. Ovdje koristimo `git filter-branch`, jer je dostupan svuda. U praksi se koristi brži `git filter-repo` ili BFG. Prepisujemo `config.py` u **svakom** commitu, a zatim brišemo sve što još čuva staru istoriju: backup refove, reflog i nedostupne objekte.

```bash
cd /root/narudzbe
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --tree-filter \
  "sed -i '/AWS_ACCESS_KEY_ID\|AWS_SECRET_ACCESS_KEY\|privremeno/d' config.py; sed -i 's|^SLACK_WEBHOOK = \".*\"|SLACK_WEBHOOK = os.environ[\"SLACK_WEBHOOK_URL\"]|' notify.py 2>/dev/null || true" -- --all
git for-each-ref --format='%(refname)' refs/original/ | xargs -r -n1 git update-ref -d
git reflog expire --expire=now --all
git gc --prune=now --quiet
gitleaks git -v --no-banner . && echo "Istorija je čista"
```

Prepisivanje istorije mijenja SHA svih commitova. Svi koji su klonirali repo moraju ga ponovo klonirati, a forkovi i stari klonovi i dalje imaju ključ. Zato rotacija uvijek ide **prva**.

<!-- verify
cd /root/narudzbe
gitleaks git --no-banner . >/dev/null 2>&1 || { echo "gitleaks i dalje nalazi tajne u istoriji (refs/original? reflog?)"; exit 1; }
git log --all -p | grep -q 'AKIAQ3EGTV7KZ4PLM2NX' && { echo "Ključ je i dalje u istoriji"; exit 1; }
[ -n "$(git log --oneline | head -1)" ] || { echo "Repozitorij nema commitova"; exit 1; }
grep -q 'AWS_REGION' config.py || { echo "config.py je izgubio AWS_REGION"; exit 1; }
-->
<!-- solution
cd /root/narudzbe
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --tree-filter "sed -i '/AWS_ACCESS_KEY_ID\|AWS_SECRET_ACCESS_KEY\|privremeno/d' config.py; sed -i 's|^SLACK_WEBHOOK = \".*\"|SLACK_WEBHOOK = os.environ[\"SLACK_WEBHOOK_URL\"]|' notify.py 2>/dev/null || true" -- --all >/dev/null 2>&1
git for-each-ref --format='%(refname)' refs/original/ | xargs -r -n1 git update-ref -d
git reflog expire --expire=now --all && git gc --prune=now --quiet
-->
