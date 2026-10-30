# Lab 1: Auditing an insecure pipeline

A colleague extended the kurs-shop `.gitlab-ci.yml` with a deploy job. The pipeline works, but it violates half of the OWASP Top 10 CI/CD risks: static cloud keys in the YAML, a secret in the log, `curl | bash`, an unpinned image and deploys from every branch, including merge requests from forks.

Your task is to fix it while keeping the pipeline working.

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

## Get the static keys out

The pipeline must get AWS access through **OIDC federation**, not through long-lived keys:

1. Remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `.gitlab-ci.yml` (in reality, revoke the keys immediately: they are already in git history).
2. Add `id_tokens` to the `deploy` job with the token `AWS_ID_TOKEN` and `aud: https://sts.amazonaws.com`, and the variable `AWS_ROLE_ARN: arn:aws:iam::123456789012:role/kurs-shop-deploy`.
3. Remove the printing of secrets to the log (the line with `echo "Koristim ključ …"`, "Using key …").

<!-- verify
cd /root/kurs-shop
f=.gitlab-ci.yml
grep -q 'AKIA' $f && { echo "the AWS key is still in .gitlab-ci.yml"; exit 1; }
grep -q 'AWS_SECRET_ACCESS_KEY' $f && { echo "AWS_SECRET_ACCESS_KEY is still mentioned in .gitlab-ci.yml"; exit 1; }
gitleaks dir $f --no-banner >/dev/null 2>&1 || { echo "gitleaks still finds a secret in .gitlab-ci.yml"; exit 1; }
[ "$(yq '.deploy.id_tokens.AWS_ID_TOKEN.aud' $f)" = "https://sts.amazonaws.com" ] || { echo "deploy has no id_tokens AWS_ID_TOKEN with aud https://sts.amazonaws.com"; exit 1; }
[ "$(yq '.deploy.variables.AWS_ROLE_ARN // .variables.AWS_ROLE_ARN' $f)" = "arn:aws:iam::123456789012:role/kurs-shop-deploy" ] || { echo "the AWS_ROLE_ARN variable is missing"; exit 1; }
yq '.deploy.script | join(" ")' $f | grep -q 'deploy.sh' || { echo "the deploy job no longer runs ./deploy.sh"; exit 1; }
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
In a real job, `deploy.sh` would call `aws sts assume-role-with-web-identity --role-arn "$AWS_ROLE_ARN" --web-identity-token "$AWS_ID_TOKEN" …`, and the role's trust policy would restrict `sub` to `project_path:shop/kurs-shop:ref_type:branch:ref:main`.
-->
<!-- solution
cd /root/kurs-shop
yq -i 'del(.variables.AWS_ACCESS_KEY_ID) | del(.variables.AWS_SECRET_ACCESS_KEY)' .gitlab-ci.yml
yq -i '.deploy.id_tokens.AWS_ID_TOKEN.aud = "https://sts.amazonaws.com" | .deploy.variables.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/kurs-shop-deploy" | .deploy.script = ["./deploy.sh"]' .gitlab-ci.yml
-->

## Deploy only from a protected branch

Right now `deploy` runs on every branch and on every merge request, so anyone with push rights (or the author of an MR from a fork) can execute their own code with the production role (**poisoned pipeline execution**).

1. Restrict `deploy` with a `rules` rule to the default branch (`$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`). No other rules that would trigger it.
2. Add `environment: production` (in GitLab, a protected environment is restricted to approved users).

Check on the current branch `feature/novi-popust` and on `main`:

```bash
gitlab-ci-local --list
git checkout -q main && gitlab-ci-local --list; git checkout -q feature/novi-popust
```

<!-- verify
cd /root/kurs-shop
[ "$(yq '.deploy.environment.name // .deploy.environment' .gitlab-ci.yml)" = "production" ] || { echo "deploy has no environment: production"; exit 1; }
yq '.deploy.rules[].if' .gitlab-ci.yml | grep -q 'CI_COMMIT_BRANCH *== *\$CI_DEFAULT_BRANCH' || { echo "deploy has no rules with \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH"; exit 1; }
[ "$(yq '.deploy | has("only")' .gitlab-ci.yml)" = "false" ] || { echo "don't mix only and rules"; exit 1; }
lst() { gitlab-ci-local --list --variable CI_COMMIT_BRANCH=$1 --variable CI_DEFAULT_BRANCH=main 2>/dev/null | awk '{print $1}'; }
lst feature/provjera | grep -qx deploy && { echo "deploy still runs on the feature/provjera branch"; exit 1; }
lst main | grep -qx deploy || { echo "deploy doesn't run on the main branch either"; exit 1; }
gitlab-ci-local deploy --variable CI_COMMIT_BRANCH=main --variable CI_DEFAULT_BRANCH=main > /tmp/gcl.log 2>&1 || { tail -10 /tmp/gcl.log; echo "the deploy job fails on main"; exit 1; }
-->
<!-- hint
```yaml
deploy:
  stage: deploy
  environment: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```
When a job has `rules` and none of the rules match, the job isn't added to the pipeline. The protection is complemented by a protected `main` branch and variables marked as protected (available only on protected branches).
-->
<!-- solution
cd /root/kurs-shop
yq -i '.deploy.environment = "production" | .deploy.rules = [{"if": "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH"}]' .gitlab-ci.yml
-->

## Lock down what the pipeline executes

1. The job image must not be `:latest`: set `image` to `python:3.13-slim` pinned to a **digest** (`python:3.13-slim@sha256:<64 hex characters>`). The image digest from the local registry: `crane digest --insecure 127.0.0.1:5000/python:3.13-slim`.
2. Remove `curl … | bash` from the `build` job: the tool is installed from a verified source (here the local `sh /opt/kurs/alati/setup.sh`), not by executing an unverified script from the internet.
3. Commit the changes to the `feature/novi-popust` branch. The pipeline must pass: `gitlab-ci-local`.

<!-- verify
cd /root/kurs-shop
img=$(yq '.image.name // .image' .gitlab-ci.yml)
echo "$img" | grep -Eq '^python:3\.13-slim@sha256:[0-9a-f]{64}$' || { echo "image must be python:3.13-slim@sha256:<digest> (currently: $img)"; exit 1; }
grep -Eq 'curl[^|]*\|[[:space:]]*(ba)?sh' .gitlab-ci.yml && { echo "curl | bash is still in the pipeline"; exit 1; }
yq '.build.script | join(" ")' .gitlab-ci.yml | grep -q 'py_compile' || { echo "build no longer compiles app.py"; exit 1; }
git diff --quiet HEAD -- .gitlab-ci.yml || { echo "the changes to .gitlab-ci.yml are not committed"; exit 1; }
[ "$(git rev-parse --abbrev-ref HEAD)" = "feature/novi-popust" ] || { echo "switch back to the feature/novi-popust branch"; exit 1; }
gitlab-ci-local > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the pipeline fails"; exit 1; }
grep -q 'deploy' /tmp/gcl.log && { echo "deploy ran on the feature branch"; exit 1; }
exit 0
-->
<!-- hint
```bash
d=$(crane digest --insecure 127.0.0.1:5000/python:3.13-slim)
yq -i ".image = \"python:3.13-slim@$d\"" .gitlab-ci.yml
```
A digest guarantees that the job always gets the same bytes; the `:latest` tag (and even `:3.13-slim`) can be moved by someone to a different image. Leave digest updates to Renovate so it doesn't go stale.
-->
<!-- solution
cd /root/kurs-shop
d=$(crane digest --insecure 127.0.0.1:5000/python:3.13-slim)
yq -i ".image = \"python:3.13-slim@$d\"" .gitlab-ci.yml
yq -i '.build.script[0] = "sh /opt/kurs/alati/setup.sh"' .gitlab-ci.yml
git commit -qam "Siguran pipeline: OIDC, rules, pinovana slika"
-->
