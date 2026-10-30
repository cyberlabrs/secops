## Šta ovaj modul pokriva

Modul pokriva zadatak **4.1** iz domena 4 (**Identity and Access Management**, 20% ispita, najveći domen): dizajn, implementacija i troubleshooting strategija autentikacije. Vještine:

- **4.1.1** identitetska rješenja za ljude, aplikacije i sisteme (IAM Identity Center, Amazon Cognito, MFA, integracija sa IdP-om),
- **4.1.2** mehanizmi za izdavanje privremenih kredencijala (AWS STS, S3 presigned URL),
- **4.1.3** troubleshooting autentikacije (CloudTrail, Cognito, Identity Center permission sets, AWS Directory Service).

Autentikacija odgovara na pitanje **ko si** (identitet + dokaz), a autorizacija (modul 07) na pitanje **šta smiješ**. Ispit tipično pita: kako zaposleni iz Entra ID/Okta ulaze u 50 naloga, kako mobilna aplikacija dobija pristup S3 bez ključeva u aplikaciji, kako treći dobavljač pristupa tvom nalogu bez confused deputy problema i zašto federacija „ne radi“.

## Mapa: koji identitet za koga

| Ko se prijavljuje | Preporučeno rješenje | Zašto |
|---|---|---|
| Zaposleni (radna snaga) u više naloga | **AWS IAM Identity Center** sa vanjskim IdP-om | Centralno, SSO, privremeni kredencijali, permission sets |
| Krajnji korisnici web/mobilne aplikacije | **Amazon Cognito user pool** | Registracija, prijava, MFA, social/SAML/OIDC federacija, JWT tokeni |
| Krajnji korisnici kojima treba direktan pristup AWS resursima | **Cognito identity pool** | Mijenja token za privremene AWS kredencijale |
| Aplikacija na AWS-u (EC2, Lambda, ECS, EKS) | **IAM uloga** (instance profile, execution role, task role, Pod Identity) | Bez ključeva, automatska rotacija |
| Workload van AWS-a sa X.509 certifikatom | **IAM Roles Anywhere** (detaljno u modulu 07) | Bez dugotrajnih ključeva |
| CI/CD van AWS-a (GitHub Actions, GitLab) | **OIDC identity provider u IAM-u** + `AssumeRoleWithWebIdentity` | Kratkotrajni token po jobu |
| Drugi AWS nalog / dobavljač | **Cross-account uloga** + **external ID** | Bez dijeljenja ključeva |
| Izuzetak: legacy alat koji traži access key | IAM user sa ključem, rotacija, minimalne dozvole | Zadnja opcija |

> **Na ispitu:** „Zaposleni već imaju naloge u Microsoft Entra ID i trebaju pristup za 30 AWS naloga“ = **IAM Identity Center** sa Entra ID kao external IdP (SAML 2.0) i **SCIM** provisioningom. Pravljenje IAM korisnika u svakom nalogu je uvijek pogrešno.

## IAM Identity Center

**AWS IAM Identity Center** (bivši AWS SSO) je preporučeni servis za pristup radne snage AWS nalozima i aplikacijama. Uključuje se u **management** nalogu organizacije (organization instance), a administracija se može delegirati na **delegated administrator** nalog.

### Identity source

Identity Center ima tačno **jedan** identity source:

1. **Identity Center directory**: korisnici i grupe se prave direktno u Identity Centeru.
2. **Active Directory**: AWS Managed Microsoft AD ili self-managed AD preko **AD Connector**-a.
3. **External identity provider**: Okta, Microsoft Entra ID, Ping, Google Workspace i drugi, preko **SAML 2.0**.

Kod vanjskog IdP-a razlikuj dva protokola:

| Protokol | Šta radi |
|---|---|
| **SAML 2.0** | **Autentikacija**: IdP potvrđuje identitet korisnika i šalje assertion. |
| **SCIM** (System for Cross-domain Identity Management) | **Provisioning**: automatski sinhronizuje korisnike i grupe iz IdP-a u Identity Center (kreiranje, izmjena, deaktivacija). |

Bez SCIM-a korisnike i grupe moraš ručno praviti u Identity Centeru da bi im dodijelio pristup. Kad zaposleni ode i deaktivira se u IdP-u, SCIM ga deaktivira i u Identity Centeru.

### Permission sets

**Permission set** je šablon dozvola (AWS managed politike, customer managed politike po imenu, inline politika, opcionalno **permissions boundary**) i **session duration** (1 do 12 sati). Kad dodijeliš grupu + permission set + nalog, Identity Center u tom nalogu napravi IAM ulogu:

```text
arn:aws:iam::222233334444:role/aws-reserved/sso.amazonaws.com/eu-central-1/AWSReservedSSO_DevReadOnly_1a2b3c4d5e6f7a8b
```

Korisnik u **AWS access portalu** bira nalog i ulogu i dobija privremene kredencijale (za konzolu ili CLI: `aws configure sso`, `aws sso login`).

Važni detalji:

- Izmjena permission seta traži **ponovno provisioniranje** u nalozima (konzola to nudi, ili `ProvisionPermissionSet`).
- **Customer managed policy** u permission setu se referencira po imenu i putanji; politika sa tim imenom mora postojati u svakom ciljnom nalogu, inače provisioning pada.
- Ne mijenjaj ručno `AWSReservedSSO_*` uloge; Identity Center ih prepisuje.
- **Attributes for access control**: atributi iz IdP-a (npr. `department`) postaju session tagovi za ABAC (modul 07).
- MFA u Identity Centeru: authenticator aplikacije, security keys i built-in authenticatori (FIDO2/WebAuthn). Kod external IdP-a MFA obično radi IdP.

> **Na ispitu:** „Korisnik se uspješno prijavi u access portal, ali ne vidi nalog Prod“ = nedostaje **assignment** (grupa + permission set + nalog) ili korisnik nije u grupi (SCIM sinhronizacija). „Promijenili smo politiku u permission setu, a korisnici i dalje imaju stare dozvole“ = permission set nije **reprovisioned**.

## Root korisnik i MFA

### MFA tipovi u IAM-u

| Tip | Phishing-resistant | Napomena |
|---|---|---|
| **Passkeys i security keys** (FIDO2/WebAuthn) | Da | Preporučeno. Device-bound (YubiKey) ili synced passkey (iCloud Keychain, Google, 1Password). Uključuje se samo kroz konzolu. |
| **Virtual authenticator** (TOTP aplikacija) | Ne | Privremeno rješenje dok ne stignu ključevi. |
| **Hardware TOTP token** | Ne | Samo tokeni kupljeni od podržanih dobavljača. |
| SMS MFA | — | AWS više ne podržava uključivanje SMS MFA za IAM. |

- Root i svaki IAM korisnik mogu imati do **osam** MFA uređaja bilo kojeg tipa; za prijavu treba jedan.
- **MFA je obavezan za root korisnika** svih tipova naloga (standalone, management i member).
- Passkey/security key se ne može proslijediti STS pozivima (`--serial-number/--token-code` radi samo sa TOTP). Za CLI sa passkeyem koristi se `aws login` ili Identity Center.

### Centralizovani root pristup

Za member naloge u Organizations možeš uključiti **centralized root access**: ukloniš root kredencijale (lozinku, ključeve, MFA) member naloga, a rijetke privilegovane root zadatke (npr. otključavanje S3 bucket politike koja je zaključala sve, brisanje pogrešne SQS politike) radiš iz management ili delegated admin naloga preko **`sts:AssumeRoot`** sa unaprijed definisanom task politikom. Kratkotrajna sesija, sve u CloudTrailu.

### Forsiranje MFA politikom

Za IAM korisnike (kojih treba biti što manje) MFA se forsira politikom sa uslovom `aws:MultiFactorAuthPresent`:

```json
{
  "Sid": "DenyAllExceptMfaSetupWithoutMFA",
  "Effect": "Deny",
  "NotAction": [
    "iam:CreateVirtualMFADevice", "iam:EnableMFADevice",
    "iam:ListMFADevices", "iam:GetUser", "sts:GetSessionToken"
  ],
  "Resource": "*",
  "Condition": { "BoolIfExists": { "aws:MultiFactorAuthPresent": "false" } }
}
```

`BoolIfExists` je bitan: kod poziva sa dugotrajnim access keyem ključ `aws:MultiFactorAuthPresent` ne postoji, pa bi običan `Bool` propustio zahtjev. Za CLI korisnik prvo pozove `GetSessionToken` sa MFA kodom i dobije privremene kredencijale u kojima je MFA prisutan.

## Amazon Cognito

### User pool vs identity pool

| | **User pool** | **Identity pool** (federated identities) |
|---|---|---|
| Uloga | Imenik korisnika i **autentikacija** | **Autorizacija prema AWS-u**: mijenja token za AWS kredencijale |
| Izlaz | JWT tokeni: ID token, access token, refresh token | Privremeni AWS kredencijali (STS) za IAM ulogu |
| Izvori identiteta | Vlastiti korisnici, social (Google, Apple, Facebook, Amazon), SAML, OIDC | User pool, social, SAML, OIDC, developer authenticated, i **guest** (neautentifikovani) |
| Tipična upotreba | Prijava u aplikaciju, zaštita API Gateway/ALB | Mobilna aplikacija direktno piše u S3 ili DynamoDB |

Najčešća kombinacija: korisnik se prijavi u **user pool**, aplikacija dobije ID token, preda ga **identity poolu** i dobije privremene kredencijale za ulogu „authenticated“. Identity pool može mapirati različite uloge po claimovima tokena (rules-based) ili po `cognito:preferred_role` iz grupe user poola.

Trust policy uloge za identity pool:

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "cognito-identity.amazonaws.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "cognito-identity.amazonaws.com:aud": "eu-central-1:11111111-2222-3333-4444-555555555555" },
    "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
  }
}
```

Bez uslova na `aud` bilo koji identity pool (i tuđi) bi mogao preuzeti ulogu. Politika uloge može koristiti `${cognito-identity.amazonaws.com:sub}` da svaki korisnik vidi samo svoj prefiks u S3.

### Sigurnosne funkcije user poola

- **MFA**: TOTP, SMS, email; može biti optional ili required.
- **Passkeys** (WebAuthn) kao passwordless prijava, u svim feature planovima osim **Lite**, kroz choice-based authentication flow. Passkey sa user verification može zadovoljiti MFA zahtjev.
- **Threat protection** (ranije advanced security, plan **Plus**): adaptive authentication po riziku prijave, detekcija kompromitovanih lozinki.
- **AWS WAF** web ACL na user poolu protiv brute force i botova.
- Kratko trajanje access tokena, revokacija refresh tokena, Lambda triggeri (pre sign-up, pre token generation).

> **Na ispitu:** „Mobilna aplikacija treba upload slika u S3 direktno, bez backend servera i bez ugrađenih ključeva“ = **Cognito user pool + identity pool** sa ulogom koja koristi `${cognito-identity.amazonaws.com:sub}` u prefiksu. „Prijava u web aplikaciju i zaštita REST API-ja JWT-om“ = samo **user pool** (API Gateway Cognito authorizer).

## AWS STS i privremeni kredencijali

**AWS Security Token Service (STS)** izdaje privremene kredencijale: access key ID, secret access key i **session token**. Pregled API-ja:

| API | Ko poziva | Trajanje | Tipičan scenarij |
|---|---|---|---|
| **AssumeRole** | IAM korisnik ili uloga sa AWS kredencijalima | 15 min do max session duration uloge (1–12 h, podrazumijevano 1 h). **Role chaining**: max 1 h. | Cross-account pristup, prelazak u admin ulogu, MFA uz uslov. |
| **AssumeRoleWithSAML** | Bilo ko sa SAML assertionom od IdP-a koji je IAM SAML provider | 15 min do max session duration uloge | Direktna SAML federacija u jedan nalog (bez Identity Centera). |
| **AssumeRoleWithWebIdentity** | Bilo ko sa OIDC tokenom (Cognito, IRSA, GitHub Actions) | 15 min do max session duration uloge | Mobilne aplikacije, CI/CD, EKS IRSA. |
| **GetSessionToken** | IAM korisnik ili root | IAM korisnik: 15 min–36 h (podrazumijevano 12 h); root: do 1 h | Dobijanje MFA-zaštićenih kredencijala za CLI. |
| **GetFederationToken** | IAM korisnik | 15 min–36 h | Stariji broker obrasci; sesija ograničena session politikom. |
| **AssumeRoot** | Management ili delegated admin nalog | Kratka sesija | Privilegovani root zadaci u member nalogu. |

Dodatno:

- **Session policy** (`--policy`, `--policy-arns`) dodatno sužava sesiju; ne može dati više od politike uloge.
- **Session tags** (`--tags`) i **source identity** prenose identitet korisnika kroz lanac uloga (vidljivo u CloudTrailu).
- Uslov **`aws:MultiFactorAuthPresent`** ili **`aws:MultiFactorAuthAge`** u trust policy forsira MFA pri `AssumeRole`.
- Kredencijali se ne mogu „opozvati“ pojedinačno; za kompromitovanu ulogu koristi **Revoke active sessions** (dodaje Deny za tokene izdate prije tog trenutka, uslov `aws:TokenIssueTime`).

```bash
# Cross-account AssumeRole sa MFA i external ID
aws sts assume-role \
  --role-arn arn:aws:iam::222233334444:role/AuditReadOnly \
  --role-session-name ana-audit \
  --external-id 7f3c9a12-acme \
  --serial-number arn:aws:iam::111122223333:mfa/ana --token-code 123456 \
  --duration-seconds 3600
```

### External ID i confused deputy

**Confused deputy** problem: dobavljač (npr. SaaS za monitoring troškova) ima jednu svoju AWS ulogu kojom pristupa ulogama mnogih klijenata. Ako napadač, takođe klijent, dobavljaču da **tvoj** role ARN, dobavljač bi u njegovo ime pristupio tvom nalogu. Rješenje: dobavljač za svakog klijenta generiše jedinstveni **external ID**, a ti ga zahtijevaš u trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::999988887777:role/VendorIntegration" },
    "Action": "sts:AssumeRole",
    "Condition": { "StringEquals": { "sts:ExternalId": "7f3c9a12-acme" } }
  }]
}
```

External ID nije tajna lozinka: on sprečava da dobavljač zabunom ili na tuđi zahtjev koristi tvoju ulogu. Za AWS **servise** koji pristupaju tvojim resursima (npr. SNS piše u SQS, CloudTrail piše u S3) isti problem rješavaš uslovima **`aws:SourceArn`** i **`aws:SourceAccount`** u resource politici.

> **Na ispitu:** „Treća strana treba pristup našem nalogu, a mora se spriječiti confused deputy“ = cross-account uloga sa **`sts:ExternalId`** uslovom. Ako je „treća strana“ AWS servis, odgovor je **`aws:SourceArn` / `aws:SourceAccount`**.

## S3 presigned URL

**Presigned URL** daje vremenski ograničen pristup jednom objektu (GET za download, PUT za upload) bez izmjene bucket politike. URL nosi potpis kredencijala onoga ko ga je napravio, pa ima **njegove** dozvole.

| Kredencijali kojima je URL potpisan | Maksimalno važenje |
|---|---|
| IAM user (SigV4), CLI/SDK | do **7 dana** |
| S3 konzola | 1 minut do 12 sati |
| Privremeni kredencijali (uloga, STS) | **dok važe kredencijali**, bez obzira na zadato vrijeme |
| Instance profile | dok važe kredencijali instance (tipično nekoliko sati) |

```bash
aws s3 presign s3://acme-reports/2026/q3.pdf --expires-in 900
```

Česti problemi:

- URL istekne ranije nego što je zadato: potpisan je privremenim kredencijalima (npr. Lambda execution role) koji su istekli.
- `403 AccessDenied`: potpisnik nema `s3:GetObject`, bucket politika ima explicit Deny, ili potpisnik nema `kms:Decrypt` za SSE-KMS objekat.
- Ograničenja: bucket politika može odbiti stare potpise (`s3:signatureAge`) ili zahtjeve van mreže (`aws:SourceIp`, `aws:SourceVpce`).

> **Na ispitu:** „Partner treba preuzeti jedan izvještaj tokom narednih 24 sata, bez AWS naloga“ = **presigned URL**. Ako URL generiše Lambda i „istekne nakon sat vremena“, uzrok je trajanje **sesije uloge**, ne `--expires-in`.

## AWS Directory Service

| Opcija | Šta je | Kad |
|---|---|---|
| **AWS Managed Microsoft AD** | Pravi Microsoft AD (dva domain controllera u dvije AZ) kojim upravlja AWS. Podržava **trust** sa on-prem AD-om, Group Policy, LDAPS, RADIUS MFA. | Windows workloadi na AWS-u (RDS SQL Server, FSx for Windows, WorkSpaces), kad treba AD u cloudu ili trust prema on-prem. |
| **AD Connector** | Proxy koji prosljeđuje zahtjeve on-prem AD-u. Ne čuva korisnike ni cache. Podržava RADIUS MFA. | Korisnici ostaju u on-prem AD-u; prijava u Identity Center, WorkSpaces, konzolu. Traži stalnu mrežnu vezu (VPN/Direct Connect). |
| **Simple AD** | Samba-kompatibilan, osnovne funkcije, bez trustova i bez MFA. | Mala okruženja, rijetko tačan odgovor na ispitu. |

Troubleshooting AD Connector-a: DNS rezolucija on-prem domena, otvoreni portovi (53, 88, 389) prema DC-ovima, ispravan service account sa pravima čitanja, mrežna veza kroz VPN/DX. Ako je VPN pao, prijava preko AD Connector-a ne radi jer nema cache.

> **Na ispitu:** „Korisnici moraju ostati u on-prem AD-u, bez sinhronizacije u cloud, i prijavljivati se u Identity Center“ = **AD Connector**. „Treba AD u AWS-u za Windows aplikacije uz trust prema on-prem domeni“ = **AWS Managed Microsoft AD**.

## Troubleshooting autentikacije

### CloudTrail

Autentikacijski događaji koje treba poznavati:

| Događaj (eventSource) | Šta znači |
|---|---|
| `ConsoleLogin` (`signin.amazonaws.com`) | Prijava u konzolu; `responseElements.ConsoleLogin` je `Success` ili `Failure`, `additionalEventData.MFAUsed`. |
| `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` (`sts.amazonaws.com`) | Ko je preuzeo koju ulogu, sa kog IdP-a, sa kojim session imenom i source identity. |
| `GetSessionToken` | Dobijanje MFA sesije. |
| Identity Center: `CredentialChallenge`, `CredentialVerification`, `UserAuthentication` | Prijava u access portal. `CredentialVerification` kaže da li je faktor (PASSWORD, TOTP, WEBAUTHN) uspio; `UserAuthentication` se loguje tek kad su svi faktori prošli. Kod external IdP-a vidiš samo `UserAuthentication` (MFA radi IdP). Događaje jedne prijave povezuje `AuthWorkflowID`. |

Primjer neuspjele prijave:

```json
{
  "eventSource": "signin.amazonaws.com",
  "eventName": "ConsoleLogin",
  "userIdentity": { "type": "IAMUser", "userName": "marko" },
  "sourceIPAddress": "203.0.113.50",
  "responseElements": { "ConsoleLogin": "Failure" },
  "additionalEventData": { "MFAUsed": "No" },
  "errorMessage": "Failed authentication"
}
```

STS događaji idu u regionu endpointa koji je pozvan; prijave u konzolu za root i neke globalne događaje traži u `us-east-1`. Najjednostavnije je imati **multi-Region organization trail**.

### Tipične greške

| Simptom | Vjerovatni uzrok |
|---|---|
| `AccessDenied` na `sts:AssumeRole` | Trust policy ne navodi pozivaoca, ili pozivalac nema `sts:AssumeRole` u svojoj politici, ili nedostaje external ID/MFA uslov, ili SCP blokira. |
| `InvalidIdentityToken` / `Incorrect token audience` kod `AssumeRoleWithWebIdentity` | Pogrešan `aud`, istekao token, OIDC provider sa pogrešnim URL-om ili thumbprintom. |
| SAML: „Your request included an invalid SAML response“ | Nedostaje atribut `https://aws.amazon.com/SAML/Attributes/Role` ili `RoleSessionName`, pogrešan ARN SAML providera, istekao IdP certifikat, odstupanje sata. |
| `DurationSeconds exceeds the MaxSessionDuration` | Traženo trajanje veće od max session duration uloge ili role chaining (max 1 h). |
| Cognito `NotAuthorizedException` | Pogrešna lozinka, korisnik nije potvrđen, app client nema dozvoljen auth flow, istekao refresh token. |
| Cognito identity pool vraća guest ulogu | Token nije proslijeđen u `Logins` mapu ili provider nije konfigurisan u identity poolu. |

> **Na ispitu:** za „ko se prijavio i odakle“ uvijek je odgovor **CloudTrail** (ili CloudTrail Lake upit), ne VPC Flow Logs. Za „SAML federacija odjednom ne radi za sve korisnike“ prvo provjeri **istekao IdP certifikat / metadata** u IAM SAML provideru ili Identity Centeru.

## Rezime

- Radna snaga ulazi preko **IAM Identity Center**: jedan identity source, **SAML** za prijavu, **SCIM** za provisioning, **permission sets** postaju `AWSReservedSSO_*` uloge u nalozima.
- **Cognito user pool** = prijava i JWT tokeni za aplikaciju; **identity pool** = zamjena tokena za AWS kredencijale (sa `aud` uslovom u trust policy).
- **MFA** je obavezan za root; preferiraj **passkeys/security keys** (FIDO2), do 8 uređaja; za member naloge razmotri **centralizovani root pristup** (`sts:AssumeRoot`).
- **STS**: AssumeRole (cross-account, role chaining max 1 h), AssumeRoleWithSAML, AssumeRoleWithWebIdentity, GetSessionToken (MFA za CLI).
- **External ID** sprečava confused deputy kod trećih strana; za AWS servise koristi **`aws:SourceArn`/`aws:SourceAccount`**.
- **Presigned URL** važi najviše 7 dana sa IAM user ključem, a nikad duže od kredencijala kojima je potpisan.
- **Managed Microsoft AD** (AD u cloudu, trustovi) vs **AD Connector** (proxy, bez cache-a); troubleshooting počinje od **CloudTrail**-a.
