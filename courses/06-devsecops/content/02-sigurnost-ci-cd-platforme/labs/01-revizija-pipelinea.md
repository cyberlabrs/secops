# Lab 1: Revizija nesigurnog pipelinea

Kolega je proširio `.gitlab-ci.yml` kurs-shopa jobom za deploy. Pipeline radi, ali krši pola OWASP Top 10 CI/CD rizika: statični cloud ključevi u YAML-u, tajna u logu, `curl | bash`, nepinovana slika i deploy sa svake grane, uključujući merge requestove iz forkova.

Tvoj zadatak je da ga popraviš, a da pipeline i dalje radi.

```bash
cd /root/kurs-shop
cat .gitlab-ci.yml
git branch -a
```

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
cat > deploy.sh <<'EOF'
#!/bin/sh
# simulacija deploya: u pravom pipelineu ovdje ide aws/kubectl/helm
echo "deploy kurs-shop na ${CI_ENVIRONMENT_NAME:-?} sa grane ${CI_COMMIT_BRANCH:-?}"
EOF
chmod +x deploy.sh
mkdir -p /opt/kurs/alati && cat > /opt/kurs/alati/setup.sh <<'EOF'
echo "instaliram alate..."
EOF
cat > .gitlab-ci.yml <<'EOF'
image: python:latest

variables:
  AWS_DEFAULT_REGION: eu-central-1
  AWS_ACCESS_KEY_ID: AKIAZ5QWX7KURSDPL0Y1
  AWS_SECRET_ACCESS_KEY: "u7Fh2Kq9Lm4Np8Rs3Tv6Wx1Yz5Ab0Cd7Ef2Gh9Jk"

stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - curl -sSL https://install.kurs-tools.ba/setup.sh | bash || sh /opt/kurs/alati/setup.sh
    - python3 -m py_compile app.py

unit-test:
  stage: test
  script:
    - /opt/app-venv/bin/python -c "import tests.test_app as t; t.test_health(); t.test_products(); print('testovi prošli')"

deploy:
  stage: deploy
  script:
    - echo "Koristim ključ $AWS_ACCESS_KEY_ID / $AWS_SECRET_ACCESS_KEY"
    - ./deploy.sh
EOF
git add -A && git commit -qm "Deploy job"
git checkout -qb feature/novi-popust
-->

## Statični ključevi napolje

Pipeline mora dobiti AWS pristup preko **OIDC federacije**, ne preko trajnih ključeva:

1. Ukloni `AWS_ACCESS_KEY_ID` i `AWS_SECRET_ACCESS_KEY` iz `.gitlab-ci.yml` (ključeve u stvarnosti odmah opozovi: već su u git istoriji).
2. Jobu `deploy` dodaj `id_tokens` sa tokenom `AWS_ID_TOKEN` i `aud: https://sts.amazonaws.com`, i varijablu `AWS_ROLE_ARN: arn:aws:iam::123456789012:role/kurs-shop-deploy`.
3. Ukloni ispis tajni iz loga (red sa `echo "Koristim ključ …"`).

<!-- verify
cd /root/kurs-shop
f=.gitlab-ci.yml
grep -q 'AKIA' $f && { echo "AWS ključ je i dalje u .gitlab-ci.yml"; exit 1; }
grep -q 'AWS_SECRET_ACCESS_KEY' $f && { echo "AWS_SECRET_ACCESS_KEY se i dalje pominje u .gitlab-ci.yml"; exit 1; }
gitleaks dir $f --no-banner >/dev/null 2>&1 || { echo "gitleaks i dalje nalazi tajnu u .gitlab-ci.yml"; exit 1; }
[ "$(yq '.deploy.id_tokens.AWS_ID_TOKEN.aud' $f)" = "https://sts.amazonaws.com" ] || { echo "deploy nema id_tokens AWS_ID_TOKEN sa aud https://sts.amazonaws.com"; exit 1; }
[ "$(yq '.deploy.variables.AWS_ROLE_ARN // .variables.AWS_ROLE_ARN' $f)" = "arn:aws:iam::123456789012:role/kurs-shop-deploy" ] || { echo "nema varijable AWS_ROLE_ARN"; exit 1; }
yq '.deploy.script | join(" ")' $f | grep -q 'deploy.sh' || { echo "deploy job više ne pokreće ./deploy.sh"; exit 1; }
-->
<!-- hint
```yaml
deploy:
  stage: deploy
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://sts.amazonaws.com
  variables:
    AWS_ROLE_ARN: arn:aws:iam::123456789012:role/kurs-shop-deploy
  script:
    - ./deploy.sh
```
U pravom jobu `deploy.sh` bi pozvao `aws sts assume-role-with-web-identity --role-arn "$AWS_ROLE_ARN" --web-identity-token "$AWS_ID_TOKEN" …`, a trust policy role bi ograničila `sub` na `project_path:shop/kurs-shop:ref_type:branch:ref:main`.
-->
<!-- solution
cd /root/kurs-shop
yq -i 'del(.variables.AWS_ACCESS_KEY_ID) | del(.variables.AWS_SECRET_ACCESS_KEY)' .gitlab-ci.yml
yq -i '.deploy.id_tokens.AWS_ID_TOKEN.aud = "https://sts.amazonaws.com" | .deploy.variables.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/kurs-shop-deploy" | .deploy.script = ["./deploy.sh"]' .gitlab-ci.yml
-->

## Deploy samo sa zaštićene grane

Sada se `deploy` pokreće na svakoj grani i na svakom merge requestu, pa bilo ko sa pravom pusha (ili autor MR-a iz forka) može izvršiti svoj kod sa produkcijskom rolom (**poisoned pipeline execution**).

1. Ograniči `deploy` pravilom `rules` na podrazumijevanu granu (`$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`). Bez drugih pravila koja bi ga pokrenula.
2. Dodaj `environment: production` (u GitLabu se protected environment ograničava na odobrene korisnike).

Provjeri na trenutnoj grani `feature/novi-popust` i na `main`:

```bash
gitlab-ci-local --list
git checkout -q main && gitlab-ci-local --list; git checkout -q feature/novi-popust
```

<!-- verify
cd /root/kurs-shop
[ "$(yq '.deploy.environment.name // .deploy.environment' .gitlab-ci.yml)" = "production" ] || { echo "deploy nema environment: production"; exit 1; }
yq '.deploy.rules[].if' .gitlab-ci.yml | grep -q 'CI_COMMIT_BRANCH *== *\$CI_DEFAULT_BRANCH' || { echo "deploy nema rules sa \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH"; exit 1; }
[ "$(yq '.deploy | has("only")' .gitlab-ci.yml)" = "false" ] || { echo "ne miješaj only i rules"; exit 1; }
lst() { gitlab-ci-local --list --variable CI_COMMIT_BRANCH=$1 --variable CI_DEFAULT_BRANCH=main 2>/dev/null | awk '{print $1}'; }
lst feature/provjera | grep -qx deploy && { echo "deploy se i dalje pokreće na grani feature/provjera"; exit 1; }
lst main | grep -qx deploy || { echo "deploy se ne pokreće ni na grani main"; exit 1; }
gitlab-ci-local deploy --variable CI_COMMIT_BRANCH=main --variable CI_DEFAULT_BRANCH=main > /tmp/gcl.log 2>&1 || { tail -10 /tmp/gcl.log; echo "deploy job na main pada"; exit 1; }
-->
<!-- hint
```yaml
deploy:
  stage: deploy
  environment: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```
Kad job ima `rules`, a nijedno pravilo ne odgovara, job se ne dodaje u pipeline. Zaštitu dopunjuju protected branch `main` i varijable označene kao protected (dostupne samo na zaštićenim granama).
-->
<!-- solution
cd /root/kurs-shop
yq -i '.deploy.environment = "production" | .deploy.rules = [{"if": "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH"}]' .gitlab-ci.yml
-->

## Zaključaj ono što pipeline izvršava

1. Slika joba ne smije biti `:latest`: postavi `image` na `python:3.13-slim` pinovan na **digest** (`python:3.13-slim@sha256:<64 heksa znaka>`). Digest slike iz lokalnog registrija: `crane digest --insecure 127.0.0.1:5000/python:3.13-slim`.
2. Ukloni `curl … | bash` iz joba `build`: alat se instalira iz provjerenog izvora (ovdje lokalni `sh /opt/kurs/alati/setup.sh`), a ne izvršavanjem skripte sa interneta bez provjere.
3. Commituj izmjene na granu `feature/novi-popust`. Pipeline mora proći: `gitlab-ci-local`.

<!-- verify
cd /root/kurs-shop
img=$(yq '.image.name // .image' .gitlab-ci.yml)
echo "$img" | grep -Eq '^python:3\.13-slim@sha256:[0-9a-f]{64}$' || { echo "image treba biti python:3.13-slim@sha256:<digest> (sada: $img)"; exit 1; }
grep -Eq 'curl[^|]*\|[[:space:]]*(ba)?sh' .gitlab-ci.yml && { echo "curl | bash je i dalje u pipelineu"; exit 1; }
yq '.build.script | join(" ")' .gitlab-ci.yml | grep -q 'py_compile' || { echo "build više ne kompajlira app.py"; exit 1; }
git diff --quiet HEAD -- .gitlab-ci.yml || { echo "izmjene .gitlab-ci.yml nisu commitovane"; exit 1; }
[ "$(git rev-parse --abbrev-ref HEAD)" = "feature/novi-popust" ] || { echo "vrati se na granu feature/novi-popust"; exit 1; }
gitlab-ci-local > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "pipeline pada"; exit 1; }
grep -q 'deploy' /tmp/gcl.log && { echo "deploy se pokrenuo na feature grani"; exit 1; }
exit 0
-->
<!-- hint
```bash
d=$(crane digest --insecure 127.0.0.1:5000/python:3.13-slim)
yq -i ".image = \"python:3.13-slim@$d\"" .gitlab-ci.yml
```
Digest garantuje da job uvijek dobija iste bajtove; tag `:latest` (pa i `:3.13-slim`) može neko pomjeriti na drugu sliku. Ažuriranje digesta prepusti Renovateu, da ne zastari.
-->
<!-- solution
cd /root/kurs-shop
d=$(crane digest --insecure 127.0.0.1:5000/python:3.13-slim)
yq -i ".image = \"python:3.13-slim@$d\"" .gitlab-ci.yml
yq -i '.build.script[0] = "sh /opt/kurs/alati/setup.sh"' .gitlab-ci.yml
git commit -qam "Siguran pipeline: OIDC, rules, pinovana slika"
-->
