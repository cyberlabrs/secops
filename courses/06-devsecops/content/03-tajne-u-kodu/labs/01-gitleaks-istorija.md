# Lab 1: Tajne u git istoriji

Developer je u septembru commitovao AWS ključ i Slack webhook, a sedmicu kasnije ih „uklonio“ novim commitom. U trenutnom kodu ih više nema, ali git pamti svaku verziju fajla.

Pronaći ćeš ih **gitleaksom**, evidentirati ih kao riješene (nakon rotacije) i dodati job koji blokira svaku novu tajnu.

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

## Pronađi procurjele tajne

1. Skeniraj **cijelu istoriju** repoa i sačuvaj izvještaj u JSON formatu u `/root/gitleaks.json`.
2. U `/root/commit.txt` upiši puni SHA commita u kome su tajne prvi put dodate.

```bash
gitleaks git . --report-format json --report-path /root/gitleaks.json
jq -r '.[] | [.RuleID, .File, .Commit[0:8]] | @tsv' /root/gitleaks.json
```

<!-- verify
[ -s /root/gitleaks.json ] || { echo "/root/gitleaks.json ne postoji"; exit 1; }
jq -e 'type == "array"' /root/gitleaks.json >/dev/null 2>&1 || { echo "gitleaks.json nije JSON izvještaj gitleaksa"; exit 1; }
jq -e '[.[] | select(.File == "config/settings.py")] | length > 0' /root/gitleaks.json >/dev/null || { echo "izvještaj nema nalaze iz istorije (config/settings.py): da li si skenirao git istoriju?"; exit 1; }
want=$(cd /root/kurs-shop && git log --format=%H --diff-filter=A -- config/settings.py | tail -1)
[ "$(tr -d ' \n' < /root/commit.txt 2>/dev/null)" = "$want" ] || { echo "commit.txt nema tačan puni SHA commita sa tajnama"; exit 1; }
-->
<!-- hint
`gitleaks dir` skenira samo fajlove na disku; `gitleaks git` prolazi kroz sve commitove. U JSON izvještaju polje `Commit` je SHA, a `git log --format=%H` daje puni SHA.
-->
<!-- solution
cd /root/kurs-shop
gitleaks git . --report-format json --report-path /root/gitleaks.json >/dev/null 2>&1 || true
jq -r '[.[] | select(.File == "config/settings.py")][0].Commit' /root/gitleaks.json > /root/commit.txt
-->

## Tajna u trenutnom kodu

`gitleaks dir .` nalazi i tajnu koja je **i dalje** u kodu: GitLab token u `Dockerfile`u (`ENV API_TOKEN=…`). Token se ne smije nalaziti u slici ni u repou.

Ukloni liniju sa tokenom iz `Dockerfile`a i commituj izmjenu. Nakon toga `gitleaks dir .` ne smije naći ništa.

<!-- verify
cd /root/kurs-shop
grep -q 'glpat-' Dockerfile && { echo "Dockerfile i dalje sadrži token"; exit 1; }
gitleaks dir . --no-banner >/dev/null 2>&1 || { echo "gitleaks dir . i dalje nalazi tajnu u trenutnim fajlovima"; exit 1; }
git diff --quiet HEAD -- Dockerfile || { echo "izmjena Dockerfilea nije commitovana"; exit 1; }
git log -1 --format=%H -- Dockerfile | xargs -I{} git show {} -- Dockerfile | grep -q '^-.*glpat-' || { echo "nema commita koji uklanja token iz Dockerfilea"; exit 1; }
-->
<!-- hint
```bash
sed -i '/API_TOKEN/d' Dockerfile
git commit -am "Uklonjen token iz Dockerfilea"
```
Brisanje iz koda ne poništava curenje: token je i dalje u istoriji, pa ga u stvarnosti odmah opozovi u GitLabu.
-->
<!-- solution
cd /root/kurs-shop
sed -i '/API_TOKEN/d' Dockerfile
git commit -qam "Uklonjen token iz Dockerfilea"
-->

## Evidentiraj riješene nalaze i dodaj job

Svi ključevi su opozvani i zamijenjeni (rotirani). Stare nalaze iz istorije ne želiš prepisivati (`git filter-repo` bi promijenio SHA svih commitova), ali ne želiš ni da pipeline zauvijek pada zbog njih.

1. Dodaj **fingerprint** svakog postojećeg nalaza u `.gitleaksignore` u korijenu repoa (polje `Fingerprint` iz izvještaja, jedan po redu) i commituj fajl.
2. Dodaj job `secret-detection` (faza `test`) koji pokreće `gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif` i čuva `gitleaks.sarif` kao artefakt i kad padne.
3. Pipeline (`gitlab-ci-local secret-detection`) sada mora proći, a svaka **nova** tajna mora ga oboriti.

```bash
gitleaks git . --report-format json --report-path /tmp/sve.json
jq -r '.[].Fingerprint' /tmp/sve.json > .gitleaksignore
```

<!-- verify
cd /root/kurs-shop
[ -s .gitleaksignore ] || { echo "nema .gitleaksignore"; exit 1; }
git ls-files --error-unmatch .gitleaksignore >/dev/null 2>&1 || { echo ".gitleaksignore nije commitovan"; exit 1; }
gitleaks git . --no-banner >/dev/null 2>&1 || { echo "gitleaks git i dalje pada: neki stari nalaz nije u .gitleaksignore"; exit 1; }
[ "$(yq '.["secret-detection"].stage' .gitlab-ci.yml)" = "test" ] || { echo "job secret-detection ne postoji ili nije u fazi test"; exit 1; }
yq '.["secret-detection"].script | join(" ")' .gitlab-ci.yml | grep -q 'gitleaks git' || { echo "secret-detection ne pokreće gitleaks git"; exit 1; }
[ "$(yq '.["secret-detection"].artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "artefakt treba artifacts: when: always"; exit 1; }
yq '.["secret-detection"].artifacts.paths[]' .gitlab-ci.yml | grep -qx 'gitleaks.sarif' || { echo "gitleaks.sarif nije u artifacts.paths"; exit 1; }
[ "$(yq '.["secret-detection"].allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "secret-detection ne smije imati allow_failure"; exit 1; }
rm -f gitleaks.sarif
gitlab-ci-local secret-detection > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job secret-detection pada na čistom repou"; exit 1; }
[ -s gitleaks.sarif ] || { echo "job nije napravio gitleaks.sarif"; exit 1; }
t=$(mktemp -d) && git clone -q . $t/r && cd $t/r && cp /root/kurs-shop/.gitlab-ci.yml . 2>/dev/null
printf 'SLACK = "https://hooks.slack.com/services/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"\n' > novi.py && git add novi.py && git commit -qm test
gitleaks git . --no-banner >/dev/null 2>&1 && { rm -rf $t; echo "nova tajna ne obara provjeru: .gitleaksignore je preširok?"; exit 1; }
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
Fingerprint ima oblik `commit:fajl:pravilo:linija`, pa ignoriše tačno taj nalaz u tom commitu. Isti ključ dodat u novom commitu biće ponovo prijavljen.
-->
<!-- solution
cd /root/kurs-shop
gitleaks git . --report-format json --report-path /tmp/sve.json >/dev/null 2>&1 || true
jq -r '.[].Fingerprint' /tmp/sve.json > .gitleaksignore
git add .gitleaksignore && git commit -qm "Evidentirani rotirani nalazi"
yq -i '.["secret-detection"] = {"stage": "test", "script": ["gitleaks git . --redact --report-format sarif --report-path gitleaks.sarif"], "artifacts": {"when": "always", "paths": ["gitleaks.sarif"]}}' .gitlab-ci.yml
gitlab-ci-local secret-detection >/dev/null 2>&1
-->
