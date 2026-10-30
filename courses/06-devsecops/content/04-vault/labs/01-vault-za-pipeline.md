# Lab 1: Tajne za pipeline iz Vaulta

Pipeline kurs-shopa treba lozinku baze za migracije. Umjesto CI/CD varijable koja živi zauvijek, job će se prijaviti u **Vault** svojim GitLab **ID tokenom** (JWT) i dobiti kratkotrajni Vault token sa pravom čitanja samo te tajne. Prijava smije uspjeti samo za zaštićenu granu `main` projekta `shop/kurs-shop`.

Vault radi u dev modu na `http://127.0.0.1:8200` (root token: `root`). GitLab OIDC issuer simulira alat `gitlab-id-token`; njegov javni ključ je `/etc/kurs/ci-oidc/public.pem`.

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

## KV tajna i politika

1. U KV v2 engine na putanji `secret/` upiši tajnu `secret/kurs-shop/prod` sa ključevima `db_user=shop` i `db_password=Pr0d-Migr4cije!`.
2. Napravi politiku `kurs-shop-ci` koja dozvoljava **samo čitanje** tajni ispod `kurs-shop/` (ništa drugo).

```bash
vault kv put secret/kurs-shop/prod db_user=shop 'db_password=Pr0d-Migr4cije!'
vault policy write kurs-shop-ci - <<'EOF'
...
EOF
```

<!-- verify
export VAULT_TOKEN=root
[ "$(vault kv get -field=db_password secret/kurs-shop/prod 2>/dev/null)" = 'Pr0d-Migr4cije!' ] || { echo "tajna secret/kurs-shop/prod nema tačan db_password"; exit 1; }
vault policy read kurs-shop-ci >/dev/null 2>&1 || { echo "politika kurs-shop-ci ne postoji"; exit 1; }
t=$(vault token create -policy=kurs-shop-ci -ttl=2m -field=token)
VAULT_TOKEN=$t vault kv get secret/kurs-shop/prod >/dev/null 2>&1 || { echo "politika ne dozvoljava čitanje secret/kurs-shop/prod (KV v2 putanja je secret/data/...)"; exit 1; }
VAULT_TOKEN=$t vault kv put secret/kurs-shop/prod x=y >/dev/null 2>&1 && { echo "politika dozvoljava i pisanje"; exit 1; }
vault kv put secret/drugi-tim/prod a=b >/dev/null
VAULT_TOKEN=$t vault kv get secret/drugi-tim/prod >/dev/null 2>&1 && { echo "politika dozvoljava čitanje tajni drugih timova"; exit 1; }
exit 0
-->
<!-- hint
Kod KV v2 API putanja podataka je `secret/data/<put>`, iako `vault kv get` koristi `secret/<put>`:
```hcl
path "secret/data/kurs-shop/*" {
  capabilities = ["read"]
}
```
Provjera: `vault token capabilities <token> secret/data/kurs-shop/prod`.
-->
<!-- solution
export VAULT_TOKEN=root
vault kv put secret/kurs-shop/prod db_user=shop 'db_password=Pr0d-Migr4cije!' >/dev/null
printf 'path "secret/data/kurs-shop/*" {\n  capabilities = ["read"]\n}\n' | vault policy write kurs-shop-ci - >/dev/null
-->

## JWT prijava za GitLab jobove

1. Uključi auth metodu `jwt` i konfiguriši je da potpis tokena provjerava javnim ključem `/etc/kurs/ci-oidc/public.pem` (`jwt_validation_pubkeys`) i issuerom `https://gitlab.kurs-shop.ba` (`bound_issuer`).
2. Napravi rolu `kurs-shop-main` (`role_type=jwt`):
   - `bound_audiences=https://vault.kurs-shop.ba`,
   - `user_claim=user_email`,
   - `bound_claims`: `project_path=shop/kurs-shop`, `ref=main`, `ref_protected=true`,
   - politika `kurs-shop-ci`, `token_ttl=10m`.
3. Provjeri: token za `main` dobija pristup, token za nezaštićenu granu ne.

```bash
vault write auth/jwt/login role=kurs-shop-main jwt="$(gitlab-id-token)"
vault write auth/jwt/login role=kurs-shop-main jwt="$(gitlab-id-token --ref feature/x --protected false)"
```

<!-- verify
export VAULT_TOKEN=root
vault auth list -format=json | jq -e '."jwt/".type == "jwt"' >/dev/null 2>&1 || { echo "auth metoda jwt nije uključena na jwt/"; exit 1; }
r=$(vault read -format=json auth/jwt/role/kurs-shop-main 2>/dev/null) || { echo "rola kurs-shop-main ne postoji"; exit 1; }
echo "$r" | jq -e '.data.token_policies | index("kurs-shop-ci")' >/dev/null || { echo "rola nema politiku kurs-shop-ci"; exit 1; }
echo "$r" | jq -e '.data.token_ttl > 0 and .data.token_ttl <= 600' >/dev/null || { echo "token_ttl treba biti najviše 10m"; exit 1; }
login() { VAULT_TOKEN= vault write -field=token auth/jwt/login role=kurs-shop-main jwt="$1" 2>/dev/null; }
t=$(login "$(gitlab-id-token)") || { echo "prijava sa tokenom za zaštićenu granu main ne uspijeva"; exit 1; }
VAULT_TOKEN=$t vault kv get -field=db_user secret/kurs-shop/prod >/dev/null 2>&1 || { echo "token dobijen JWT prijavom ne može pročitati tajnu"; exit 1; }
login "$(gitlab-id-token --ref feature/x --protected false)" >/dev/null && { echo "prijava uspijeva i za nezaštićenu granu feature/x"; exit 1; }
login "$(gitlab-id-token --ref main --protected false)" >/dev/null && { echo "prijava uspijeva i kad ref_protected=false"; exit 1; }
login "$(gitlab-id-token --project napadac/fork)" >/dev/null && { echo "prijava uspijeva i za drugi projekat"; exit 1; }
login "$(gitlab-id-token --aud https://drugi.servis)" >/dev/null && { echo "prijava uspijeva i sa pogrešnim audience"; exit 1; }
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
U pravom GitLabu umjesto `jwt_validation_pubkeys` koristi se `oidc_discovery_url=https://gitlab.com` (ili adresa tvoje instance).
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

## Job koji čita tajnu

Dodaj job `migracije` (faza `test`) koji:

1. se prijavi u Vault tokenom iz varijable `VAULT_ID_TOKEN` (u pravom GitLabu nju puni `id_tokens`; ovdje je stavi u `.gitlab-ci-local-variables.yml` kao izlaz `gitlab-id-token`),
2. pročita `db_password` iz `secret/kurs-shop/prod` u varijablu i ispiše samo njenu dužinu (nikad samu vrijednost): `echo "lozinka ima ${#DB_PASSWORD} znakova"`.

U `.gitlab-ci.yml` dodaj i `id_tokens` blok sa `aud: https://vault.kurs-shop.ba`, kako bi job radio i na pravom GitLabu.

<!-- verify
cd /root/kurs-shop
[ "$(yq '.migracije.stage' .gitlab-ci.yml)" = "test" ] || { echo "job migracije ne postoji ili nije u fazi test"; exit 1; }
[ "$(yq '.migracije.id_tokens.VAULT_ID_TOKEN.aud' .gitlab-ci.yml)" = "https://vault.kurs-shop.ba" ] || { echo "nema id_tokens: VAULT_ID_TOKEN sa aud https://vault.kurs-shop.ba"; exit 1; }
s=$(yq '.migracije.script | join("\n")' .gitlab-ci.yml)
echo "$s" | grep -q 'auth/jwt/login' || { echo "job se ne prijavljuje preko auth/jwt/login"; exit 1; }
echo "$s" | grep -qE 'VAULT_TOKEN=.*root|VAULT_TOKEN: *root' && { echo "job ne smije koristiti root token"; exit 1; }
yq '.variables, .migracije.variables' .gitlab-ci.yml | grep -q 'root' && { echo "root token ne smije biti u .gitlab-ci.yml"; exit 1; }
grep -q 'VAULT_ID_TOKEN' .gitlab-ci-local-variables.yml 2>/dev/null || { echo "nema VAULT_ID_TOKEN u .gitlab-ci-local-variables.yml"; exit 1; }
# svjež token (stari je možda istekao)
yq -i ".VAULT_ID_TOKEN = \"$(gitlab-id-token)\"" .gitlab-ci-local-variables.yml
gitlab-ci-local migracije > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job migracije pada"; exit 1; }
grep -q 'lozinka ima 15 znakova' /tmp/gcl.log || { echo "job ne ispisuje 'lozinka ima 15 znakova'"; exit 1; }
grep -q 'Pr0d-Migr4cije' /tmp/gcl.log && { echo "lozinka se pojavljuje u logu joba"; exit 1; }
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
Token ističe za 10 minuta; ako job javi `token is expired`, napravi novi.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.migracije = {"stage": "test", "id_tokens": {"VAULT_ID_TOKEN": {"aud": "https://vault.kurs-shop.ba"}}, "script": ["export VAULT_TOKEN=\"$(vault write -field=token auth/jwt/login role=kurs-shop-main jwt=\"$VAULT_ID_TOKEN\")\"", "DB_PASSWORD=\"$(vault kv get -field=db_password secret/kurs-shop/prod)\"", "echo \"lozinka ima ${#DB_PASSWORD} znakova\""]}' .gitlab-ci.yml
echo "VAULT_ID_TOKEN: $(gitlab-id-token)" > .gitlab-ci-local-variables.yml
-->
