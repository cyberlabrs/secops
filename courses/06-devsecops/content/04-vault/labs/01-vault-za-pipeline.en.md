# Lab 1: Pipeline secrets from Vault

The kurs-shop pipeline needs the database password for migrations. Instead of a CI/CD variable that lives forever, the job will log in to **Vault** with its GitLab **ID token** (JWT) and get a short-lived Vault token that can read only that secret. Login may succeed only for the protected `main` branch of the `shop/kurs-shop` project.

Vault runs in dev mode at `http://127.0.0.1:8200` (root token: `root`). The GitLab OIDC issuer is simulated by the `gitlab-id-token` tool; its public key is `/etc/kurs/ci-oidc/public.pem`.

```bash
export VAULT_TOKEN=root
vault status
gitlab-id-token --help
gitlab-id-token | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

<!-- setup
set -e
kurs-repo
pkill -x vault 2>/dev/null || true
nohup vault server -dev -dev-root-token-id=root -dev-listen-address=127.0.0.1:8200 >/var/log/vault.log 2>&1 &
for i in $(seq 50); do VAULT_TOKEN=root vault status >/dev/null 2>&1 && break; sleep 0.3; done
gitlab-id-token >/dev/null
echo 'export VAULT_ADDR=http://127.0.0.1:8200' >> /root/.bashrc
-->

## KV secret and policy

1. In the KV v2 engine at the `secret/` path, write the secret `secret/kurs-shop/prod` with the keys `db_user=shop` and `db_password=Pr0d-Migr4cije!`.
2. Create a policy `kurs-shop-ci` that allows **only reading** secrets under `kurs-shop/` (nothing else).

```bash
vault kv put secret/kurs-shop/prod db_user=shop 'db_password=Pr0d-Migr4cije!'
vault policy write kurs-shop-ci - <<'EOF'
...
EOF
```

<!-- verify
export VAULT_TOKEN=root
[ "$(vault kv get -field=db_password secret/kurs-shop/prod 2>/dev/null)" = 'Pr0d-Migr4cije!' ] || { echo "the secret secret/kurs-shop/prod does not have the correct db_password"; exit 1; }
vault policy read kurs-shop-ci >/dev/null 2>&1 || { echo "the kurs-shop-ci policy does not exist"; exit 1; }
t=$(vault token create -policy=kurs-shop-ci -ttl=2m -field=token)
VAULT_TOKEN=$t vault kv get secret/kurs-shop/prod >/dev/null 2>&1 || { echo "the policy does not allow reading secret/kurs-shop/prod (the KV v2 path is secret/data/...)"; exit 1; }
VAULT_TOKEN=$t vault kv put secret/kurs-shop/prod x=y >/dev/null 2>&1 && { echo "the policy also allows writing"; exit 1; }
vault kv put secret/drugi-tim/prod a=b >/dev/null
VAULT_TOKEN=$t vault kv get secret/drugi-tim/prod >/dev/null 2>&1 && { echo "the policy allows reading other teams' secrets"; exit 1; }
exit 0
-->
<!-- hint
With KV v2 the API data path is `secret/data/<path>`, even though `vault kv get` uses `secret/<path>`:
```hcl
path "secret/data/kurs-shop/*" {
  capabilities = ["read"]
}
```
Check: `vault token capabilities <token> secret/data/kurs-shop/prod`.
-->
<!-- solution
export VAULT_TOKEN=root
vault kv put secret/kurs-shop/prod db_user=shop 'db_password=Pr0d-Migr4cije!' >/dev/null
printf 'path "secret/data/kurs-shop/*" {\n  capabilities = ["read"]\n}\n' | vault policy write kurs-shop-ci - >/dev/null
-->

## JWT login for GitLab jobs

1. Enable the `jwt` auth method and configure it to verify the token signature with the public key `/etc/kurs/ci-oidc/public.pem` (`jwt_validation_pubkeys`) and the issuer `https://gitlab.kurs-shop.ba` (`bound_issuer`).
2. Create the role `kurs-shop-main` (`role_type=jwt`):
   - `bound_audiences=https://vault.kurs-shop.ba`,
   - `user_claim=user_email`,
   - `bound_claims`: `project_path=shop/kurs-shop`, `ref=main`, `ref_protected=true`,
   - policy `kurs-shop-ci`, `token_ttl=10m`.
3. Check: a token for `main` gets access, a token for an unprotected branch does not.

```bash
vault write auth/jwt/login role=kurs-shop-main jwt="$(gitlab-id-token)"
vault write auth/jwt/login role=kurs-shop-main jwt="$(gitlab-id-token --ref feature/x --protected false)"
```

<!-- verify
export VAULT_TOKEN=root
vault auth list -format=json | jq -e '."jwt/".type == "jwt"' >/dev/null 2>&1 || { echo "the jwt auth method is not enabled at jwt/"; exit 1; }
r=$(vault read -format=json auth/jwt/role/kurs-shop-main 2>/dev/null) || { echo "the kurs-shop-main role does not exist"; exit 1; }
echo "$r" | jq -e '.data.token_policies | index("kurs-shop-ci")' >/dev/null || { echo "the role does not have the kurs-shop-ci policy"; exit 1; }
echo "$r" | jq -e '.data.token_ttl > 0 and .data.token_ttl <= 600' >/dev/null || { echo "token_ttl must be at most 10m"; exit 1; }
login() { VAULT_TOKEN= vault write -field=token auth/jwt/login role=kurs-shop-main jwt="$1" 2>/dev/null; }
t=$(login "$(gitlab-id-token)") || { echo "login with a token for the protected main branch does not succeed"; exit 1; }
VAULT_TOKEN=$t vault kv get -field=db_user secret/kurs-shop/prod >/dev/null 2>&1 || { echo "the token obtained via JWT login cannot read the secret"; exit 1; }
login "$(gitlab-id-token --ref feature/x --protected false)" >/dev/null && { echo "login also succeeds for the unprotected branch feature/x"; exit 1; }
login "$(gitlab-id-token --ref main --protected false)" >/dev/null && { echo "login also succeeds when ref_protected=false"; exit 1; }
login "$(gitlab-id-token --project napadac/fork)" >/dev/null && { echo "login also succeeds for a different project"; exit 1; }
login "$(gitlab-id-token --aud https://drugi.servis)" >/dev/null && { echo "login also succeeds with the wrong audience"; exit 1; }
exit 0
-->
<!-- hint
```bash
vault auth enable jwt
vault write auth/jwt/config jwt_validation_pubkeys=@/etc/kurs/ci-oidc/public.pem bound_issuer=https://gitlab.kurs-shop.ba
vault write auth/jwt/role/kurs-shop-main - <<'EOF'
{
  "role_type": "jwt",
  "user_claim": "user_email",
  "bound_audiences": ["https://vault.kurs-shop.ba"],
  "bound_claims": {"project_path": "shop/kurs-shop", "ref": "main", "ref_protected": "true"},
  "token_policies": ["kurs-shop-ci"],
  "token_ttl": "10m"
}
EOF
```
In real GitLab, instead of `jwt_validation_pubkeys` you use `oidc_discovery_url=https://gitlab.com` (or your instance's address).
-->
<!-- solution
export VAULT_TOKEN=root
vault auth enable jwt >/dev/null
vault write auth/jwt/config jwt_validation_pubkeys=@/etc/kurs/ci-oidc/public.pem bound_issuer=https://gitlab.kurs-shop.ba >/dev/null
vault write auth/jwt/role/kurs-shop-main - >/dev/null <<'EOF'
{
  "role_type": "jwt",
  "user_claim": "user_email",
  "bound_audiences": ["https://vault.kurs-shop.ba"],
  "bound_claims": {"project_path": "shop/kurs-shop", "ref": "main", "ref_protected": "true"},
  "token_policies": ["kurs-shop-ci"],
  "token_ttl": "10m"
}
EOF
-->

## A job that reads the secret

Add a job `migracije` ("migrations", stage `test`) that:

1. logs in to Vault with the token from the `VAULT_ID_TOKEN` variable (in real GitLab it is populated by `id_tokens`; here put it in `.gitlab-ci-local-variables.yml` as the output of `gitlab-id-token`),
2. reads `db_password` from `secret/kurs-shop/prod` into a variable and prints only its length (never the value itself), using exactly this message (Serbian for "the password has N characters"): `echo "lozinka ima ${#DB_PASSWORD} znakova"`.

In `.gitlab-ci.yml` also add an `id_tokens` block with `aud: https://vault.kurs-shop.ba`, so that the job also works on real GitLab.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.migracije.stage' .gitlab-ci.yml)" = "test" ] || { echo "the migracije job does not exist or is not in the test stage"; exit 1; }
[ "$(yq '.migracije.id_tokens.VAULT_ID_TOKEN.aud' .gitlab-ci.yml)" = "https://vault.kurs-shop.ba" ] || { echo "no id_tokens: VAULT_ID_TOKEN with aud https://vault.kurs-shop.ba"; exit 1; }
s=$(yq '.migracije.script | join("\n")' .gitlab-ci.yml)
echo "$s" | grep -q 'auth/jwt/login' || { echo "the job does not log in via auth/jwt/login"; exit 1; }
echo "$s" | grep -qE 'VAULT_TOKEN=.*root|VAULT_TOKEN: *root' && { echo "the job must not use the root token"; exit 1; }
yq '.variables, .migracije.variables' .gitlab-ci.yml | grep -q 'root' && { echo "the root token must not be in .gitlab-ci.yml"; exit 1; }
grep -q 'VAULT_ID_TOKEN' .gitlab-ci-local-variables.yml 2>/dev/null || { echo "no VAULT_ID_TOKEN in .gitlab-ci-local-variables.yml"; exit 1; }
# svjež token (stari je možda istekao)
yq -i ".VAULT_ID_TOKEN = \"$(gitlab-id-token)\"" .gitlab-ci-local-variables.yml
gitlab-ci-local migracije > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the migracije job fails"; exit 1; }
grep -q 'lozinka ima 15 znakova' /tmp/gcl.log || { echo "the job does not print 'lozinka ima 15 znakova'"; exit 1; }
grep -q 'Pr0d-Migr4cije' /tmp/gcl.log && { echo "the password appears in the job log"; exit 1; }
exit 0
-->
<!-- hint
```yaml
migracije:
  stage: test
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  script:
    - export VAULT_TOKEN="$(vault write -field=token auth/jwt/login role=kurs-shop-main jwt="$VAULT_ID_TOKEN")"
    - DB_PASSWORD="$(vault kv get -field=db_password secret/kurs-shop/prod)"
    - echo "lozinka ima ${#DB_PASSWORD} znakova"
```
```bash
echo "VAULT_ID_TOKEN: $(gitlab-id-token)" > .gitlab-ci-local-variables.yml
```
The token expires in 10 minutes; if the job reports `token is expired`, create a new one.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.migracije = {"stage": "test", "id_tokens": {"VAULT_ID_TOKEN": {"aud": "https://vault.kurs-shop.ba"}}, "script": ["export VAULT_TOKEN=\"$(vault write -field=token auth/jwt/login role=kurs-shop-main jwt=\"$VAULT_ID_TOKEN\")\"", "DB_PASSWORD=\"$(vault kv get -field=db_password secret/kurs-shop/prod)\"", "echo \"lozinka ima ${#DB_PASSWORD} znakova\""]}' .gitlab-ci.yml
echo "VAULT_ID_TOKEN: $(gitlab-id-token)" > .gitlab-ci-local-variables.yml
-->
