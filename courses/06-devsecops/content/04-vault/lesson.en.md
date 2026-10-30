## What this module covers

Objective **2.4**: secrets management in HashiCorp Vault. We cover KV v2, policies, auth methods (AppRole and JWT/OIDC for GitLab), dynamic secrets, tokens and leases, and, at a conceptual level, Vault Agent and the External Secrets Operator.

The previous module looked for secrets that had already leaked into code. This module answers the question: **where should a secret live** so that a leak never happens in the first place?

| Where in the pipeline | What Vault does | Which threat it prevents |
|---|---|---|
| Job before deploy | The pipeline proves its identity (ID token) and gets a short-lived Vault token | Static secrets in CI/CD variables that any maintainer can read |
| Deploy / runtime | The application reads the secret from Vault or gets it via an Agent/operator | Secrets in a Dockerfile `ENV`, in `config/settings.py`, in git history |
| Database and cloud access | Vault creates credentials "on demand" with a TTL | Long-lived AWS keys and shared DB passwords that nobody rotates |

The `kurs-shop` repo has every anti-pattern: an AWS key and a Slack webhook in the history of `config/settings.py`, a hardcoded `SECRET_KEY` in `app.py`, the RDS password in `infra/main.tf`, and a token in a Dockerfile `ENV`. By the end of the module all of that should come from Vault.

Related certification: **HashiCorp Certified: Vault Associate (003)**. The exam covers exactly these topics (auth methods, policies, tokens, leases, KV, dynamic secrets, response wrapping, Vault architecture). This module is not preparation for the whole exam, but it covers most of what is asked there.

## Vault in two minutes

**HashiCorp Vault** is a central service for secrets. A client first **authenticates** through an **auth method** (token, AppRole, JWT, Kubernetes, AWS IAM...). Vault issues it a **token** with attached **policies**. With that token the client reads or creates secrets in **secrets engines** (KV, database, AWS, PKI, Transit...).

```
client ──(identity)──> auth method ──> token + policies ──> secrets engine
```

Key concepts:

- **Seal / unseal**: Vault stores only encrypted data on disk. After startup it is **sealed** until it gets the key (Shamir shares or **auto-unseal** via a KMS/HSM).
- **Token**: everything in Vault ultimately uses a token. It has a TTL, policies and an **accessor** (a reference that lets you inspect or revoke the token without knowing the token itself).
- **Lease**: dynamic secrets have a **lease** with a TTL. A lease can be renewed (`renew`) or revoked (`revoke`), and when it expires Vault deletes the credential itself.
- **Path**: everything is a path. Policies grant permissions on paths, and auth methods and engines are mounted at paths (`auth/jwt/`, `secret/`, `database/`).

### Dev server for the lab

In the lab we work with a Vault 2.1 dev server:

```bash
vault server -dev -dev-root-token-id=root &
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root
vault status
```

Dev mode is **for learning only**: data is in memory (it disappears on restart), Vault is automatically unsealed, the root token is known, there is no TLS, and KV v2 is already mounted at `secret/`. In production: Raft integrated storage, TLS, auto-unseal, an audit device, and a root token that is revoked immediately after the initial configuration.

> **In practice:** The first thing you enable on a real Vault is audit: `vault audit enable file file_path=/var/log/vault/audit.log`. Secret values are hashed (HMAC) in the audit log, but you can see who read which path and when. When a secret does leak, this is the only way to answer the question "who had access".

## KV v2: static secrets with versions

**KV v2** (key/value, version 2) stores static secrets and remembers their versions. The dev server mounts it at `secret/`. On a real server:

```bash
vault secrets enable -path=secret kv-v2
```

Basic commands:

```bash
# write (a new version every time)
vault kv put -mount=secret kurs-shop/prod/app secret_key='8f3c...' slack_webhook='https://hooks.slack.com/...'

# read the whole secret and a single field
vault kv get -mount=secret kurs-shop/prod/app
vault kv get -mount=secret -field=secret_key kurs-shop/prod/app

# change one field without deleting the others
vault kv patch -mount=secret kurs-shop/prod/app slack_webhook='https://hooks.slack.com/novi'

# versions, rollback, deletion
vault kv metadata get -mount=secret kurs-shop/prod/app
vault kv rollback -mount=secret -version=1 kurs-shop/prod/app
vault kv delete  -mount=secret kurs-shop/prod/app          # soft delete of the latest version (undelete possible)
vault kv destroy -mount=secret -versions=2 kurs-shop/prod/app  # permanently delete a version
vault kv metadata put -mount=secret -max-versions=10 kurs-shop/prod/app
```

`vault kv put secret/kurs-shop/prod/app ...` (without `-mount`) does the same; `-mount` is more readable because it clearly separates the mount from the path.

### Pitfall: KV v2 paths in the API and in policies

The CLI says `secret/kurs-shop/prod/app`, but the API underneath uses different paths:

| Operation | Actual API path |
|---|---|
| reading / writing data | `secret/data/kurs-shop/prod/app` |
| listing keys, metadata | `secret/metadata/kurs-shop/prod/app` |
| soft delete of specific versions | `secret/delete/kurs-shop/prod/app` |
| restoring deleted versions | `secret/undelete/kurs-shop/prod/app` |
| permanent destruction | `secret/destroy/kurs-shop/prod/app` |

That is why a policy must mention `secret/data/...`. A policy on `secret/kurs-shop/*` gives **403 permission denied** for `vault kv get`, even though it looks correct at first glance. This is the most common KV v2 mistake and a favorite exam topic.

## Policies: who may do what

Policies are HCL files. Everything that is not allowed is forbidden (**default deny**), and `deny` always wins.

```hcl
# kurs-shop-ci.hcl: what the kurs-shop project's CI job may do
path "secret/data/kurs-shop/ci/*" {
  capabilities = ["read"]
}

path "secret/metadata/kurs-shop/ci/*" {
  capabilities = ["list"]
}

# dynamic database credentials, read-only role only
path "database/creds/kurs-shop-ro" {
  capabilities = ["read"]
}

# explicit deny: CI never touches the application's production secrets
path "secret/data/kurs-shop/prod/*" {
  capabilities = ["deny"]
}
```

Capabilities: `create`, `read`, `update`, `patch`, `delete`, `list`, `sudo`, `deny` (and `subscribe` for events). A `*` at the end of a path is a prefix; `+` matches exactly one segment (`secret/data/+/ci/*`).

```bash
vault policy write kurs-shop-ci kurs-shop-ci.hcl
vault policy read kurs-shop-ci

# test: create a token with the policy and check what it may do
vault token create -policy=kurs-shop-ci -ttl=15m -format=json | jq -r .auth.client_token
vault token capabilities <token> secret/data/kurs-shop/ci/registry
vault token capabilities <token> secret/data/kurs-shop/prod/app
```

`vault token capabilities` is the fastest way to check a policy before you hand it to a pipeline. It returns, e.g., `read` or `deny`.

Built-in policies: `default` (every token gets it; e.g., lookup of its own token) and `root` (everything; don't attach it to anything except emergencies).

> **In practice:** Keep policies in git (e.g., a `vault-config` repo with the Terraform `vault` provider) and change them through a merge request with review. Typing `vault policy write` by hand in production quickly creates drift. One policy per application and environment (`kurs-shop-ci`, `kurs-shop-prod-app`) is easier to audit than one big "devops" policy.

## Tokens, TTL and leases

| Term | What it means | Command |
|---|---|---|
| `ttl` | how long a token/lease is valid until it is renewed | `vault token create -ttl=1h` |
| `max_ttl` / `explicit_max_ttl` | upper limit that renewal cannot exceed | `-explicit-max-ttl=4h` |
| **service token** | standard token, can be renewed and create children, has an accessor | default |
| **batch token** | lightweight, not written to storage, cannot be renewed; good for short CI jobs | `-type=batch` |
| **periodic token** | renews indefinitely as long as it is renewed within the period | `-period=24h` |
| **orphan token** | has no parent, does not die when the parent is revoked | `-orphan` |

Revoking a token also revokes all its child tokens and the leases it created. That is why revoking a compromised job's token is a single command.

```bash
vault token lookup                          # what my token is, which policies, what TTL
vault token revoke -accessor <accessor>     # revoke without knowing the token
vault lease renew  <lease_id>
vault lease revoke <lease_id>
vault lease revoke -prefix database/creds/kurs-shop-ro   # all DB credentials of that role
```

## AppRole: identity for machines without a platform

**AppRole** is an auth method for applications and scripts that have no "natural" identity (the way Kubernetes has a ServiceAccount and GitLab has an ID token). Login requires two parts:

- **role_id**: not a secret, like a username. It can be in the application's configuration.
- **secret_id**: a secret, short-lived, ideally single-use. It is delivered through a separate channel.

```bash
vault auth enable approle

vault write auth/approle/role/kurs-shop-batch \
    token_policies=kurs-shop-ci \
    token_type=batch \
    token_ttl=10m \
    token_max_ttl=20m \
    secret_id_ttl=30m \
    secret_id_num_uses=1 \
    secret_id_bound_cidrs=10.10.0.0/16

vault read -field=role_id auth/approle/role/kurs-shop-batch/role-id
vault write -f -field=secret_id auth/approle/role/kurs-shop-batch/secret-id

vault write auth/approle/login role_id=<role_id> secret_id=<secret_id>
```

The "**secret zero**" problem: AppRole only moves the question of "how does the application get its first secret". The solution is for a third, trusted system (an orchestrator, a deploy tool) to deliver the secret_id, using **response wrapping**:

```bash
# Vault returns a wrapping token (single-use, 120 s) instead of the secret_id itself
vault write -wrap-ttl=120s -f auth/approle/role/kurs-shop-batch/secret-id

# the application unwraps it; if someone already unwrapped it, unwrap fails and that is an alarm
vault unwrap <wrapping_token>
```

> **In practice:** For a GitLab pipeline, AppRole is no longer the first choice. If you put `role_id` and `secret_id` in CI/CD variables, you are back to a static secret in GitLab, just with an extra step. Use AppRole for systems that have no OIDC identity (an old cron server, an on-prem application); for CI use JWT.

## JWT auth: a GitLab pipeline without static secrets

GitLab can issue each job an **ID token** (a JWT signed with the GitLab instance's key). `CI_JOB_JWT` and `CI_JOB_JWT_V2` have been removed (GitLab 17.0); today the token is requested explicitly with the `id_tokens` key and must have an **`aud`** (audience).

Some claims in the GitLab ID token: `sub` (`project_path:shop/kurs-shop:ref_type:branch:ref:main`), `project_id`, `project_path`, `namespace_path`, `ref`, `ref_type`, `ref_protected`, `environment`, `environment_protected`, `pipeline_source`, `user_login`, `user_email`.

### The Vault side

```bash
vault auth enable jwt

vault write auth/jwt/config \
    oidc_discovery_url="https://gitlab.kurs-shop.ba" \
    bound_issuer="https://gitlab.kurs-shop.ba"
```

Through `oidc_discovery_url` Vault fetches GitLab's public keys (JWKS) and verifies the signature of every token. If Vault cannot reach GitLab, you set `jwks_url` or `jwt_validation_pubkeys` (the public key directly in the configuration) instead. Only one of these three methods is allowed on a single mount.

The lab has no GitLab server and no network. The `gitlab-id-token` tool issues a JWT with the same claims GitLab gives a job (`--aud`, `--project`, `--ref`, `--protected` pick the values), signed with a key from `/etc/kurs/ci-oidc/`. That is why in the lab we configure Vault with a public key:

```bash
gitlab-id-token >/dev/null      # on first run it creates a key pair
vault write auth/jwt/config \
    jwt_validation_pubkeys=@/etc/kurs/ci-oidc/public.pem \
    bound_issuer="https://gitlab.kurs-shop.ba"

# the token a job from an unprotected feature branch would get
gitlab-id-token --ref napad --protected false
```

A role for deploying from the `main` branch (`bound_claims` is a map, so the role is written as JSON):

```bash
vault write auth/jwt/role/kurs-shop-deploy - <<'EOF'
{
  "role_type": "jwt",
  "bound_audiences": ["https://vault.kurs-shop.ba"],
  "user_claim": "user_email",
  "bound_claims_type": "glob",
  "bound_claims": {
    "project_path": "shop/kurs-shop",
    "ref": "main",
    "ref_type": "branch",
    "ref_protected": "true"
  },
  "token_policies": ["kurs-shop-deploy"],
  "token_type": "batch",
  "token_ttl": "10m",
  "token_explicit_max_ttl": "15m"
}
EOF
```

What each field does:

| Field | Purpose | What happens without it |
|---|---|---|
| `bound_audiences` | the token must have `aud` = Vault URL | a token issued for some other service (e.g., AWS) can also be used for Vault |
| `bound_claims.project_path` | only this project | **every project** on the GitLab instance gets this role |
| `ref_protected: "true"` | only protected branches/tags | a developer creates a branch `napad` ("attack"), edits `.gitlab-ci.yml` and reads production secrets |
| `user_claim` | which claim becomes the entity name in Vault (audit) | a required field; without it the role cannot be created |
| `token_ttl` | short token lifetime | the job's token stays valid for hours after the job has finished |

`bound_claims` values are compared as strings, so `"true"` (a string), not `true`. With `bound_claims_type: glob` you can write, e.g., `"ref": "release-*"`.

> **In practice:** Always create at least two roles: `kurs-shop-ci` (any branch, only secrets for tests) and `kurs-shop-deploy` (only a protected branch or `environment: production`, production secrets). That way an MR from a feature branch can never reach production, even if someone modifies the pipeline. This is a direct defense against a **poisoned pipeline execution** attack (objective 1.3).

### The GitLab side: `secrets:vault` (Premium/Ultimate)

```yaml
deploy:
  stage: deploy
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  secrets:
    DB_PASSWORD:
      vault: kurs-shop/prod/db/password@secret   # path/field@mount, KV v2
      token: $VAULT_ID_TOKEN
      file: false
  variables:
    VAULT_SERVER_URL: https://vault.kurs-shop.ba
    VAULT_AUTH_ROLE: kurs-shop-deploy
    VAULT_AUTH_PATH: jwt
  script:
    - ./deploy.sh
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

`kurs-shop/prod/db/password@secret` means: mount `secret`, path `kurs-shop/prod/db`, field `password`. The runner reads `secret/data/kurs-shop/prod/db`. Without `file: false` the `DB_PASSWORD` variable contains **the path to a temporary file** with the secret, not the secret itself (that is the default, so the secret doesn't accidentally end up in an `env` dump).

### The GitLab side: Vault CLI (works on all tiers)

```yaml
deploy:
  image: hashicorp/vault:2.1
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  variables:
    VAULT_ADDR: https://vault.kurs-shop.ba
  script:
    - export VAULT_TOKEN="$(vault write -field=token auth/jwt/login role=kurs-shop-deploy jwt="$VAULT_ID_TOKEN")"
    - export DB_PASSWORD="$(vault kv get -mount=secret -field=password kurs-shop/prod/db)"
    - ./deploy.sh
```

The same principle on GitHub Actions: `permissions: id-token: write` and the `hashicorp/vault-action` action with `method: jwt`; `bound_claims` then checks `repository`, `ref`, `environment` from the GitHub token.

## Dynamic secrets

A static secret lives until someone rotates it (in practice: forever). A **dynamic secret** is created at the moment of the request, is unique per client and has a lease. When the lease expires, Vault deletes the user in the database or the key in AWS.

### Database secrets engine

```bash
vault secrets enable database

vault write database/config/kurs-shop-db \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@db.kurs-shop.internal:5432/shop" \
    allowed_roles="kurs-shop-ro,kurs-shop-app" \
    username="vault_admin" \
    password="pocetna-lozinka"

# rotate the root password immediately: from now on only Vault knows it
vault write -force database/rotate-root/kurs-shop-db

vault write database/roles/kurs-shop-ro \
    db_name=kurs-shop-db \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl=1h \
    max_ttl=8h

vault read database/creds/kurs-shop-ro
# lease_id   database/creds/kurs-shop-ro/AbC...
# username   v-jwt-kurs-sho-ro-x7Gq...
# password   ...
```

For existing users that you must not delete there are **static roles** (`database/static-roles/...`): Vault only periodically rotates the existing user's password.

### AWS secrets engine

```bash
vault secrets enable aws
vault write aws/config/root access_key=... secret_key=... region=eu-central-1

# assumed_role: Vault does STS AssumeRole, there is no IAM user to clean up
vault write aws/roles/kurs-shop-deploy \
    credential_type=assumed_role \
    role_arns=arn:aws:iam::123456789012:role/kurs-shop-deploy

vault write aws/sts/kurs-shop-deploy ttl=15m
```

With `credential_type=iam_user` Vault creates a real IAM user and deletes it when the lease expires (`vault read aws/creds/<role>`). If the pipeline needs only AWS, also consider direct GitLab OIDC → AWS IAM (objective 1.4) without Vault in the middle; Vault makes sense when you want one place for policies and audit across all systems.

| | Static (KV) | Dynamic (database, AWS) |
|---|---|---|
| Who creates the credential | a human | Vault, on demand |
| Lifetime | until it is rotated | the lease TTL (minutes, hours) |
| Sharing | the same for all clients | unique per client, audit knows exactly who |
| Consequence of a leak | manual rotation, hunting down all users | `vault lease revoke`, or just wait for the TTL |
| When to use | third-party API keys, webhooks | databases, cloud, anything Vault knows how to administer |

> **In practice:** Introduce dynamic secrets first for CI access to databases and the cloud: that is where the gain is biggest, and the application doesn't change. For application runtime watch the TTL: the connection pool must tolerate a password change, otherwise you get an incident at 3 a.m. when the lease expires. A good starting compromise is a `default_ttl` of a few hours plus a Vault Agent that renews the lease.

## How the secret reaches the application

The application doesn't necessarily need to know about Vault. Two common patterns:

**Vault Agent** is the same `vault` binary run as `vault agent -config=agent.hcl`, usually as a sidecar or a systemd service:

- **auto_auth**: logs in by itself (Kubernetes, AppRole, AWS...) and renews the token;
- **template**: renders secrets into a file (e.g., `config.env`) and re-renders it when the secret changes or the lease is renewed;
- **cache / API proxy**: the application calls the local Agent instead of Vault.

The Kubernetes variant is the **Vault Agent Injector** (annotations on the Pod inject an Agent sidecar).

**External Secrets Operator (ESO)** is a Kubernetes operator that reads secrets from an external system (Vault, AWS Secrets Manager, GCP...) and creates ordinary Kubernetes `Secret` objects. It is configured with `SecretStore`/`ClusterSecretStore` resources (how to reach Vault) and `ExternalSecret` (which keys to map and how often to refresh). HashiCorp also has its own **Vault Secrets Operator (VSO)** with the same idea.

| | Vault Agent (sidecar) | External Secrets Operator / VSO |
|---|---|---|
| Where the secret is | a file in the Pod (tmpfs volume) | a Kubernetes Secret (etcd) |
| Dynamic secrets and lease renewal | yes, naturally | limited; ESO refreshes periodically |
| Application change | no (reads a file) | no (reads env or a volume) |
| Drawback | a sidecar in every Pod | the secret is in etcd, needs encryption at rest and RBAC |

In this course we don't configure them in detail; what matters is knowing how to choose a pattern, and that neither requires the secret to be in the git repo or in the image.

## Fixing kurs-shop

Plan for migrating secrets from the repo into Vault:

1. Revoke the leaked secrets (AWS key, Slack webhook) with the issuer; that is module 03. Vault doesn't fix a leak that has already happened.
2. Write the new values into KV: `vault kv put -mount=secret kurs-shop/prod/app secret_key=... slack_webhook=...`.
3. In `app.py` replace the hardcoded `SECRET_KEY` with a read from the environment (`os.environ["SECRET_KEY"]`), populated by Vault Agent or ESO.
4. Remove the `ENV` with the token from the `Dockerfile`; secrets are not baked into the image.
5. Move the RDS password from `infra/main.tf` to the database engine, or at least to KV + the `vault_kv_secret_v2` data source (careful: the Terraform state then contains the secret, so the state must be encrypted and protected).
6. In `.gitlab-ci.yml` add `id_tokens` and a JWT login, and delete the CI/CD variables holding secrets.
7. Run gitleaks (module 03) to confirm the new secret didn't end up in the code.

## Summary

- Vault: identity (auth method) → token with policies → secrets engine. Everything is a path, everything is default deny, `deny` wins.
- KV v2 keeps versions; in policies write `secret/data/...` for data and `secret/metadata/...` for listing, otherwise you get 403.
- `vault token capabilities` checks a policy before the pipeline gets it.
- AppRole (`role_id` + `secret_id`) is for machines without a platform identity; deliver the secret_id through response wrapping.
- GitLab → Vault goes through `id_tokens` with `aud` and a JWT role with `bound_audiences` and `bound_claims` (`project_path`, `ref_protected`); `CI_JOB_JWT` no longer exists.
- Dynamic secrets (database, AWS) are unique per client and disappear when the lease expires; a leak is handled with `vault lease revoke`.
- Vault Agent and ESO/VSO deliver secrets to the application without the secret ever being in the repo or the image.
- The dev server (`vault server -dev`) is for learning only: memory, root token, no TLS.
