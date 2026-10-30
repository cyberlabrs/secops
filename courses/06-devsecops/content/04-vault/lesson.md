## Šta ovaj modul pokriva

Cilj **2.4**: upravljanje tajnama u HashiCorp Vaultu. Obrađujemo KV v2, politike, auth metode (AppRole i JWT/OIDC za GitLab), dinamičke tajne, tokene i lease, te na nivou koncepta Vault Agent i External Secrets Operator.

Prethodni modul je tražio tajne koje su već procurile u kod. Ovaj modul odgovara na pitanje: **gdje tajna treba da živi** da do curenja uopšte ne dođe?

| Gdje u pipelineu | Šta radi Vault | Koju prijetnju sprječava |
|---|---|---|
| Job prije deploya | Pipeline dokazuje identitet (ID token) i dobija kratkotrajan Vault token | Statične tajne u CI/CD varijablama koje svaki maintainer može pročitati |
| Deploy / runtime | Aplikacija čita tajnu iz Vaulta ili je dobija preko Agenta/operatora | Tajne u `ENV` Dockerfilea, u `config/settings.py`, u git istoriji |
| Pristup bazi i oblaku | Vault pravi kredencijale „na zahtjev“ sa TTL-om | Dugovječni AWS ključevi i dijeljene DB lozinke koje niko ne rotira |

U `kurs-shop` repou imamo sve antipaterne: AWS ključ i Slack webhook u istoriji `config/settings.py`, hardkodovan `SECRET_KEY` u `app.py`, lozinku za RDS u `infra/main.tf` i token u `ENV` Dockerfilea. Na kraju modula sve to treba da dolazi iz Vaulta.

Srodni sertifikat: **HashiCorp Certified: Vault Associate (003)**. Ispit pokriva upravo ove teme (auth metode, politike, tokeni, lease, KV, dinamičke tajne, response wrapping, Vault arhitektura). Ovaj modul nije priprema za cijeli ispit, ali pokriva veći dio onoga što se tamo pita.

## Vault u dvije minute

**HashiCorp Vault** je centralni servis za tajne. Klijent se prvo **autentifikuje** preko neke **auth metode** (token, AppRole, JWT, Kubernetes, AWS IAM...). Vault mu izda **token** za koji su vezane **politike** (policies). Sa tim tokenom klijent čita ili pravi tajne u **secrets engineima** (KV, database, AWS, PKI, Transit...).

```
klijent ──(identitet)──> auth metoda ──> token + politike ──> secrets engine
```

Ključni pojmovi:

- **Seal / unseal**: Vault na disku čuva samo šifrovane podatke. Nakon starta je zapečaćen (**sealed**) dok ne dobije ključ (Shamir dijelovi ili **auto-unseal** preko KMS-a/HSM-a).
- **Token**: sve u Vaultu na kraju koristi token. Ima TTL, politike i **accessor** (referenca kojom se token može pregledati ili opozvati bez poznavanja samog tokena).
- **Lease**: dinamičke tajne imaju **lease** sa TTL-om. Lease se može obnoviti (`renew`) ili opozvati (`revoke`), a po isteku Vault sam briše kredencijal.
- **Path**: sve je putanja. Politike daju dozvole nad putanjama, a auth metode i engineovi su montirani na putanje (`auth/jwt/`, `secret/`, `database/`).

### Dev server za lab

U labu radimo sa Vault 2.1 dev serverom:

```bash
vault server -dev -dev-root-token-id=root &
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root
vault status
```

Dev mod je **samo za učenje**: podaci su u memoriji (nestaju restartom), Vault je automatski unsealed, root token je poznat, nema TLS-a, a KV v2 je već montiran na `secret/`. U produkciji: Raft integrisano skladište, TLS, auto-unseal, audit uređaj i root token koji se opoziva odmah nakon inicijalne konfiguracije.

> **U praksi:** Prvo što uključiš na pravom Vaultu je audit: `vault audit enable file file_path=/var/log/vault/audit.log`. Vrijednosti tajni se u audit logu hešuju (HMAC), ali vidiš ko je, kada i koju putanju čitao. Kada tajna ipak procuri, to je jedini način da odgovoriš na pitanje „ko je imao pristup“.

## KV v2: statične tajne sa verzijama

**KV v2** (key/value, verzija 2) čuva statične tajne i pamti njihove verzije. Dev server ga montira na `secret/`. Na pravom serveru:

```bash
vault secrets enable -path=secret kv-v2
```

Osnovne komande:

```bash
# upis (svaki put nova verzija)
vault kv put -mount=secret kurs-shop/prod/app secret_key='8f3c...' slack_webhook='https://hooks.slack.com/...'

# čitanje cijele tajne i jednog polja
vault kv get -mount=secret kurs-shop/prod/app
vault kv get -mount=secret -field=secret_key kurs-shop/prod/app

# izmjena jednog polja bez brisanja ostalih
vault kv patch -mount=secret kurs-shop/prod/app slack_webhook='https://hooks.slack.com/novi'

# verzije, povratak, brisanje
vault kv metadata get -mount=secret kurs-shop/prod/app
vault kv rollback -mount=secret -version=1 kurs-shop/prod/app
vault kv delete  -mount=secret kurs-shop/prod/app          # soft delete zadnje verzije (undelete moguć)
vault kv destroy -mount=secret -versions=2 kurs-shop/prod/app  # trajno brisanje verzije
vault kv metadata put -mount=secret -max-versions=10 kurs-shop/prod/app
```

`vault kv put secret/kurs-shop/prod/app ...` (bez `-mount`) radi isto; `-mount` je čitljiviji jer jasno odvaja mount od putanje.

### Zamka: KV v2 putanje u API-ju i politikama

CLI piše `secret/kurs-shop/prod/app`, ali API ispod koristi drugačije putanje:

| Operacija | Stvarna API putanja |
|---|---|
| čitanje / pisanje podataka | `secret/data/kurs-shop/prod/app` |
| lista ključeva, metapodaci | `secret/metadata/kurs-shop/prod/app` |
| soft delete određenih verzija | `secret/delete/kurs-shop/prod/app` |
| vraćanje obrisanih verzija | `secret/undelete/kurs-shop/prod/app` |
| trajno uništavanje | `secret/destroy/kurs-shop/prod/app` |

Zato politika mora pominjati `secret/data/...`. Politika nad `secret/kurs-shop/*` daje **403 permission denied** za `vault kv get`, iako na prvi pogled izgleda ispravno. Ovo je najčešća greška kod KV v2 i omiljena tema ispitnih pitanja.

## Politike: ko smije šta

Politike su HCL fajlovi. Sve što nije dozvoljeno je zabranjeno (**default deny**), a `deny` uvijek pobjeđuje.

```hcl
# kurs-shop-ci.hcl: šta smije CI job kurs-shop projekta
path "secret/data/kurs-shop/ci/*" {
  capabilities = ["read"]
}

path "secret/metadata/kurs-shop/ci/*" {
  capabilities = ["list"]
}

# dinamički kredencijali za bazu, samo read-only uloga
path "database/creds/kurs-shop-ro" {
  capabilities = ["read"]
}

# eksplicitna zabrana: CI nikad ne dira produkcijske tajne aplikacije
path "secret/data/kurs-shop/prod/*" {
  capabilities = ["deny"]
}
```

Capabilities: `create`, `read`, `update`, `patch`, `delete`, `list`, `sudo`, `deny` (i `subscribe` za evente). `*` na kraju putanje je prefiks, `+` zamjenjuje tačno jedan segment (`secret/data/+/ci/*`).

```bash
vault policy write kurs-shop-ci kurs-shop-ci.hcl
vault policy read kurs-shop-ci

# test: napravi token sa politikom i provjeri šta smije
vault token create -policy=kurs-shop-ci -ttl=15m -format=json | jq -r .auth.client_token
vault token capabilities <token> secret/data/kurs-shop/ci/registry
vault token capabilities <token> secret/data/kurs-shop/prod/app
```

`vault token capabilities` je najbrži način da provjeriš politiku prije nego što je daš pipelineu. Vrati npr. `read` ili `deny`.

Ugrađene politike: `default` (svaki token je dobija; npr. lookup sopstvenog tokena) i `root` (sve; ne vezuj je ni za šta osim hitnih slučajeva).

> **U praksi:** Politike drži u gitu (npr. `vault-config` repo sa Terraform `vault` providerom) i mijenjaj ih kroz merge request sa reviewom. Ručno kucanje `vault policy write` na produkciji brzo pravi drift. Jedna politika po aplikaciji i okruženju (`kurs-shop-ci`, `kurs-shop-prod-app`) je lakša za audit od jedne velike „devops“ politike.

## Tokeni, TTL i lease

| Pojam | Šta znači | Komanda |
|---|---|---|
| `ttl` | koliko token/lease važi dok se ne obnovi | `vault token create -ttl=1h` |
| `max_ttl` / `explicit_max_ttl` | gornja granica, obnova je ne može preći | `-explicit-max-ttl=4h` |
| **service token** | standardni token, može se obnavljati i praviti djecu, ima accessor | default |
| **batch token** | lagan, ne upisuje se u storage, ne može se obnoviti; dobar za kratke CI jobove | `-type=batch` |
| **periodic token** | obnavlja se unedogled ako se obnavlja unutar perioda | `-period=24h` |
| **orphan token** | nema roditelja, ne umire kad roditelj bude opozvan | `-orphan` |

Opoziv tokena opoziva i sve njegove tokene-djecu i lease-ove koje je napravio. Zato je opoziv tokena kompromitovanog joba jedna komanda.

```bash
vault token lookup                          # šta je moj token, koje politike, koliki TTL
vault token revoke -accessor <accessor>     # opoziv bez poznavanja tokena
vault lease renew  <lease_id>
vault lease revoke <lease_id>
vault lease revoke -prefix database/creds/kurs-shop-ro   # svi DB kredencijali te uloge
```

## AppRole: identitet za mašine bez platforme

**AppRole** je auth metoda za aplikacije i skripte koje nemaju „prirodan“ identitet (kao što Kubernetes ima ServiceAccount, a GitLab ID token). Login traži dva dijela:

- **role_id**: nije tajna, kao korisničko ime. Može biti u konfiguraciji aplikacije.
- **secret_id**: tajna, kratkog vijeka, idealno jednokratna. Dostavlja se odvojenim kanalom.

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

Problem „**secret zero**“: AppRole samo pomjera pitanje „kako aplikacija dobija prvu tajnu“. Rješenje je da secret_id dostavlja treći, pouzdan sistem (orkestrator, deploy alat) i to kroz **response wrapping**:

```bash
# Vault vraća wrapping token (jednokratan, 120 s) umjesto samog secret_id
vault write -wrap-ttl=120s -f auth/approle/role/kurs-shop-batch/secret-id

# aplikacija ga raspakuje; ako je neko već raspakovao, unwrap pada i to je alarm
vault unwrap <wrapping_token>
```

> **U praksi:** Za GitLab pipeline AppRole više nije prvi izbor. Ako `role_id` i `secret_id` staviš u CI/CD varijable, dobio si opet statičnu tajnu u GitLabu, samo sa dodatnim korakom. AppRole koristi za sisteme koji nemaju OIDC identitet (stari cron server, on-prem aplikacija); za CI koristi JWT.

## JWT auth: GitLab pipeline bez statičnih tajni

GitLab svakom jobu može izdati **ID token** (JWT potpisan ključem GitLab instance). `CI_JOB_JWT` i `CI_JOB_JWT_V2` su uklonjeni (GitLab 17.0); danas se token eksplicitno traži ključem `id_tokens` i obavezno ima **`aud`** (audience).

Neki claimovi u GitLab ID tokenu: `sub` (`project_path:shop/kurs-shop:ref_type:branch:ref:main`), `project_id`, `project_path`, `namespace_path`, `ref`, `ref_type`, `ref_protected`, `environment`, `environment_protected`, `pipeline_source`, `user_login`, `user_email`.

### Vault strana

```bash
vault auth enable jwt

vault write auth/jwt/config \
    oidc_discovery_url="https://gitlab.kurs-shop.ba" \
    bound_issuer="https://gitlab.kurs-shop.ba"
```

Vault preko `oidc_discovery_url` povlači javne ključeve GitLaba (JWKS) i provjerava potpis svakog tokena. Ako Vault ne može doći do GitLaba, umjesto toga se postavlja `jwks_url` ili `jwt_validation_pubkeys` (javni ključ direktno u konfiguraciji). Na jednom mountu je dozvoljen samo jedan od ova tri načina.

U labu nema GitLab servera ni mreže. Alat `gitlab-id-token` izdaje JWT sa istim claimovima kakve GitLab daje jobu (`--aud`, `--project`, `--ref`, `--protected` biraju vrijednosti), potpisan ključem iz `/etc/kurs/ci-oidc/`. Zato Vault u labu konfigurišemo javnim ključem:

```bash
gitlab-id-token >/dev/null      # pri prvom pokretanju napravi par ključeva
vault write auth/jwt/config \
    jwt_validation_pubkeys=@/etc/kurs/ci-oidc/public.pem \
    bound_issuer="https://gitlab.kurs-shop.ba"

# token kakav bi dobio job sa nezaštićene feature grane
gitlab-id-token --ref napad --protected false
```

Uloga za deploy sa `main` grane (`bound_claims` je mapa, pa se uloga piše kao JSON):

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

Šta svako polje radi:

| Polje | Svrha | Šta se desi bez njega |
|---|---|---|
| `bound_audiences` | token mora imati `aud` = Vault URL | token izdat za neki drugi servis (npr. AWS) može se iskoristiti i za Vault |
| `bound_claims.project_path` | samo ovaj projekat | **svaki projekat** na GitLab instanci dobija ovu ulogu |
| `ref_protected: "true"` | samo zaštićene grane/tagovi | developer napravi granu `napad`, izmijeni `.gitlab-ci.yml` i pročita produkcijske tajne |
| `user_claim` | koji claim postaje ime entiteta u Vaultu (audit) | obavezno polje; bez njega uloga se ne može napraviti |
| `token_ttl` | kratak vijek tokena | token iz joba važi satima nakon što je job gotov |

`bound_claims` vrijednosti se porede kao stringovi, pa `"true"` (string) a ne `true`. Sa `bound_claims_type: glob` možeš pisati npr. `"ref": "release-*"`.

> **U praksi:** Uvijek pravi bar dvije uloge: `kurs-shop-ci` (bilo koja grana, samo tajne za testove) i `kurs-shop-deploy` (samo zaštićena grana ili `environment: production`, produkcijske tajne). Tako MR iz feature grane nikad ne može doći do produkcije, čak ni ako neko izmijeni pipeline. To je direktna odbrana od **poisoned pipeline execution** napada (cilj 1.3).

### GitLab strana: `secrets:vault` (Premium/Ultimate)

```yaml
deploy:
  stage: deploy
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.kurs-shop.ba
  secrets:
    DB_PASSWORD:
      vault: kurs-shop/prod/db/password@secret   # putanja/polje@mount, KV v2
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

`kurs-shop/prod/db/password@secret` znači: mount `secret`, putanja `kurs-shop/prod/db`, polje `password`. Runner čita `secret/data/kurs-shop/prod/db`. Bez `file: false` varijabla `DB_PASSWORD` sadrži **putanju do privremenog fajla** sa tajnom, ne samu tajnu (to je default, da tajna ne završi slučajno u `env` ispisu).

### GitLab strana: Vault CLI (radi na svim tierovima)

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

Isti princip na GitHub Actionsu: `permissions: id-token: write` i akcija `hashicorp/vault-action` sa `method: jwt`; `bound_claims` tada provjerava `repository`, `ref`, `environment` iz GitHub tokena.

## Dinamičke tajne

Statična tajna živi dok je neko ne rotira (u praksi: zauvijek). **Dinamička tajna** se pravi u trenutku zahtjeva, jedinstvena je po klijentu i ima lease. Kad lease istekne, Vault briše korisnika u bazi ili ključ u AWS-u.

### Database secrets engine

```bash
vault secrets enable database

vault write database/config/kurs-shop-db \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@db.kurs-shop.internal:5432/shop" \
    allowed_roles="kurs-shop-ro,kurs-shop-app" \
    username="vault_admin" \
    password="pocetna-lozinka"

# odmah rotiraj root lozinku: od sada je zna samo Vault
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

Za postojeće korisnike koje ne smiješ brisati postoje **static roles** (`database/static-roles/...`): Vault samo periodično rotira lozinku postojećeg korisnika.

### AWS secrets engine

```bash
vault secrets enable aws
vault write aws/config/root access_key=... secret_key=... region=eu-central-1

# assumed_role: Vault radi STS AssumeRole, nema IAM korisnika za čišćenje
vault write aws/roles/kurs-shop-deploy \
    credential_type=assumed_role \
    role_arns=arn:aws:iam::123456789012:role/kurs-shop-deploy

vault write aws/sts/kurs-shop-deploy ttl=15m
```

Sa `credential_type=iam_user` Vault pravi pravog IAM korisnika i briše ga po isteku lease-a (`vault read aws/creds/<uloga>`). Ako pipeline treba samo AWS, razmotri i direktan GitLab OIDC → AWS IAM (cilj 1.4) bez Vaulta u sredini; Vault ima smisla kad želiš jedno mjesto politika i audita za sve sisteme.

| | Statična (KV) | Dinamička (database, AWS) |
|---|---|---|
| Ko pravi kredencijal | čovjek | Vault, na zahtjev |
| Životni vijek | dok se ne rotira | TTL lease-a (minute, sati) |
| Dijeljenje | isti za sve klijente | jedinstven po klijentu, audit tačno zna ko |
| Posljedica curenja | ručna rotacija, traženje svih korisnika | `vault lease revoke`, ili samo sačekaj TTL |
| Kada koristiti | API ključevi trećih strana, webhooks | baze, oblak, sve što Vault zna da administrira |

> **U praksi:** Dinamičke tajne uvodi prvo za CI pristup bazi i oblaku: tu je dobit najveća, a aplikacija se ne mijenja. Za runtime aplikacije pazi na TTL: konekcioni pool mora podnijeti promjenu lozinke, inače dobiješ incident u 3 ujutro kad lease istekne. Dobar početni kompromis je `default_ttl` od nekoliko sati i Vault Agent koji obnavlja lease.

## Kako tajna stiže do aplikacije

Aplikacija ne treba nužno znati za Vault. Dva česta obrasca:

**Vault Agent** je isti `vault` binarni fajl pokrenut kao `vault agent -config=agent.hcl`, obično kao sidecar ili systemd servis:

- **auto_auth**: sam se loguje (Kubernetes, AppRole, AWS...) i obnavlja token;
- **template**: renderuje tajne u fajl (npr. `config.env`) i ponovo ga renderuje kad se tajna promijeni ili lease obnovi;
- **cache / API proxy**: aplikacija zove lokalni Agent umjesto Vaulta.

Varijanta za Kubernetes je **Vault Agent Injector** (anotacije na Podu ubacuju Agent sidecar).

**External Secrets Operator (ESO)** je Kubernetes operator koji čita tajne iz eksternog sistema (Vault, AWS Secrets Manager, GCP...) i pravi obične Kubernetes `Secret` objekte. Konfiguriše se resursima `SecretStore`/`ClusterSecretStore` (kako doći do Vaulta) i `ExternalSecret` (koje ključeve preslikati i koliko često osvježavati). HashiCorp ima i sopstveni **Vault Secrets Operator (VSO)** sa istom idejom.

| | Vault Agent (sidecar) | External Secrets Operator / VSO |
|---|---|---|
| Gdje je tajna | fajl u Podu (tmpfs volumen) | Kubernetes Secret (etcd) |
| Dinamičke tajne i obnova lease-a | da, prirodno | ograničeno; ESO osvježava periodično |
| Promjena aplikacije | ne (čita fajl) | ne (čita env ili volumen) |
| Mana | sidecar u svakom Podu | tajna je u etcd-u, treba encryption at rest i RBAC |

U ovom kursu ih ne konfigurišemo u detalje; bitno je znati izabrati obrazac i da ni jedan ne zahtijeva da tajna bude u git repou ili u slici.

## Popravka kurs-shop

Plan migracije tajni iz repoa u Vault:

1. Opozovi procurjele tajne (AWS ključ, Slack webhook) kod izdavača; to je modul 03. Vault ne popravlja curenje koje se već desilo.
2. Upiši nove vrijednosti u KV: `vault kv put -mount=secret kurs-shop/prod/app secret_key=... slack_webhook=...`.
3. U `app.py` zamijeni hardkodovan `SECRET_KEY` čitanjem iz okruženja (`os.environ["SECRET_KEY"]`), koje puni Vault Agent ili ESO.
4. Iz `Dockerfile` ukloni `ENV` sa tokenom; tajne se ne peku u sliku.
5. RDS lozinku iz `infra/main.tf` prebaci na database engine ili barem na KV + `vault_kv_secret_v2` data source (pazi: Terraform state tada sadrži tajnu, pa state mora biti šifrovan i zaštićen).
6. U `.gitlab-ci.yml` dodaj `id_tokens` i JWT login, a CI/CD varijable sa tajnama obriši.
7. Pokreni gitleaks (modul 03) da potvrdiš da nova tajna nije završila u kodu.

## Rezime

- Vault: identitet (auth metoda) → token sa politikama → secrets engine. Sve je putanja, sve je default deny, `deny` pobjeđuje.
- KV v2 čuva verzije; u politikama piši `secret/data/...` za podatke i `secret/metadata/...` za listanje, inače dobijaš 403.
- `vault token capabilities` provjerava politiku prije nego što je pipeline dobije.
- AppRole (`role_id` + `secret_id`) je za mašine bez platformskog identiteta; secret_id dostavljaj kroz response wrapping.
- GitLab → Vault ide preko `id_tokens` sa `aud` i JWT uloge sa `bound_audiences` i `bound_claims` (`project_path`, `ref_protected`); `CI_JOB_JWT` više ne postoji.
- Dinamičke tajne (database, AWS) su jedinstvene po klijentu i nestaju po isteku lease-a; curenje rješava `vault lease revoke`.
- Vault Agent i ESO/VSO dostavljaju tajne aplikaciji bez da tajna ikad bude u repou ili slici.
- Dev server (`vault server -dev`) je samo za učenje: memorija, root token, bez TLS-a.
