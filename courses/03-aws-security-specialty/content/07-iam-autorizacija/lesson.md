## Šta ovaj modul pokriva

Modul pokriva zadatak **4.2** iz domena 4 (**Identity and Access Management**, 20% ispita): dizajn, implementacija i troubleshooting strategija autorizacije. Vještine:

- **4.2.1** autorizacione kontrole za ljude, aplikacije i sisteme (Amazon Verified Permissions, IAM paths, IAM Roles Anywhere, resource policies za cross-account, role trust policies),
- **4.2.2** ABAC i RBAC strategije (pristup na osnovu tagova i atributa),
- **4.2.3** IAM politike po principu least privilege (permission boundaries, session policies),
- **4.2.4** analiza autorizacionih grešaka (IAM Policy Simulator, IAM Access Analyzer),
- **4.2.5** pronalaženje i ispravljanje neželjenih dozvola (IAM Access Analyzer).

Ovo je najvažniji modul kursa. Na ispitu ćeš vidjeti JSON politiku (ili tri) i pitanje „zašto korisnik dobija AccessDenied“ ili „koja izmjena daje pristup uz least privilege“. Moraš znati **redoslijed evaluacije napamet** i razliku između politika koje **daju** dozvole i politika koje **ograničavaju** dozvole.

## Tipovi politika

| Tip | Gdje se kači | Daje dozvole? | Na koga utiče |
|---|---|---|---|
| **Identity-based policy** | IAM user, grupa, uloga | Da | Taj principal |
| **Resource-based policy** | Resurs (S3 bucket, KMS key, SQS, SNS, Lambda, Secrets Manager, ECR, trust policy uloge…) | Da | Principali navedeni u `Principal` |
| **Service control policy (SCP)** | Root, OU ili nalog u Organizations | **Ne** (samo maksimum) | **Principali** u member nalozima (uključujući root korisnika) |
| **Resource control policy (RCP)** | Root, OU ili nalog u Organizations | **Ne** (samo maksimum) | **Resursi** u member nalozima, bez obzira ko pristupa |
| **Permissions boundary** | IAM user ili uloga | **Ne** (samo maksimum) | Taj principal |
| **Session policy** | Proslijeđena pri `AssumeRole*` / `GetFederationToken` | **Ne** (samo maksimum) | Ta sesija |
| **Endpoint policy** | VPC endpoint | **Ne** | Zahtjevi kroz taj endpoint |
| ACL (S3, legacy) | Bucket/objekat | Da (cross-account) | Preporuka: isključiti (Object Ownership = BucketOwnerEnforced) |

Dva pravila koja treba zapamtiti:

1. **Explicit Deny uvijek pobjeđuje**, bez obzira u kojoj politici je.
2. **Guardrail politike (SCP, RCP, boundary, session, endpoint) nikad ne daju dozvolu.** One samo definišu gornju granicu. Ako nijedna identity ili resource politika ne kaže `Allow`, rezultat je implicit deny.

### SCP i RCP detaljnije

- SCP i RCP rade samo u organizaciji sa **all features**.
- **Ne utiču na management nalog.** (Zato u management nalogu ne držiš workloade.)
- **Ne utiču na service-linked uloge.** RCP ne utiče ni na AWS managed KMS ključeve.
- Kad uključiš RCP, automatski se kači `RCPFullAWSAccess` koji se ne može skinuti; kod SCP-a podrazumijevani je `FullAWSAccess`. Zato se oba tipično koriste kao **deny lista**.
- SCP ograničava **ko iz mojih naloga** šta smije (npr. „niko ne smije isključiti CloudTrail“, „samo regioni eu-*“). RCP ograničava **šta se smije raditi sa mojim resursima**, pa i kad pristupa neko spolja (npr. „S3 objektima u mojoj organizaciji smiju pristupati samo principali iz organizacije“).
- RCP podržava podskup servisa (među njima S3, STS, KMS, SQS, Secrets Manager, DynamoDB, ECR, CloudWatch Logs, Cognito, OpenSearch Serverless i drugi; lista raste).

RCP primjer, **data perimeter** za S3 (samo identiteti iz organizacije ili AWS servisi):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "EnforceOrgIdentities",
    "Effect": "Deny",
    "Principal": "*",
    "Action": ["s3:*", "sqs:*", "kms:*", "secretsmanager:*", "sts:AssumeRole"],
    "Resource": "*",
    "Condition": {
      "StringNotEqualsIfExists": { "aws:PrincipalOrgID": "o-a1b2c3d4e5" },
      "BoolIfExists": { "aws:PrincipalIsAWSService": "false" }
    }
  }]
}
```

SCP primjer, zaštita sigurnosnih servisa:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ProtectSecurityServices",
    "Effect": "Deny",
    "Action": [
      "cloudtrail:StopLogging", "cloudtrail:DeleteTrail",
      "guardduty:DeleteDetector", "config:StopConfigurationRecorder"
    ],
    "Resource": "*",
    "Condition": {
      "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityBreakGlass" }
    }
  }]
}
```

## Logika evaluacije politika

### Unutar jednog naloga

AWS prvo autentifikuje zahtjev, sastavi **request context** (principal, akcija, resurs, uslovi: IP, vrijeme, tagovi, VPC endpoint…), a zatim:

1. **Deny evaluation**: pregleda **sve** primjenjive politike (SCP, RCP, resource, identity, boundary, session). Ako ijedan `Deny` statement odgovara zahtjevu → **Deny**, kraj.
2. **RCP**: ako RCP-ovi naloga koji posjeduje resurs ne dozvoljavaju akciju → **Deny**.
3. **SCP**: ako SCP-ovi naloga principala ne dozvoljavaju akciju → **Deny**.
4. **Resource-based policy**: ako resource politika dozvoljava zahtjev, ishod zavisi od toga **koga** politika navodi (vidi ispod). U nekim slučajevima to je odmah **Allow**.
5. **Identity-based policy**: ako nijedna identity politika ne dozvoljava akciju (a resource politika nije već dala Allow) → **Deny** (implicit).
6. **Permissions boundary**: ako postoji i ne dozvoljava akciju → **Deny**.
7. **Session policy**: ako je principal sesija sa session politikom koja ne dozvoljava akciju → **Deny**. Inače → **Allow**.

```text
Zahtjev
  │
  ├─ Postoji explicit Deny bilo gdje? ───────────────── da → DENY
  ├─ RCP (vlasnik resursa) dozvoljava? ──────────────── ne → DENY
  ├─ SCP (nalog principala) dozvoljava? ─────────────── ne → DENY
  ├─ Resource policy dozvoljava (direktno useru/sesiji)? da → ALLOW
  ├─ Identity policy dozvoljava? ─────────────────────── ne → DENY
  ├─ Permissions boundary (ako postoji) dozvoljava? ─── ne → DENY
  ├─ Session policy (ako postoji) dozvoljava? ───────── ne → DENY
  └─ ALLOW
```

### Resource policy u istom nalogu: precizno

U istom nalogu efektivne dozvole su **unija** identity i resource politike: dovoljno je da jedna kaže `Allow`. Ali granice (boundary, session policy) ne djeluju jednako na sve principale:

| Resource politika daje dozvolu… | Da li implicit deny u boundary / session policy blokira? |
|---|---|
| **IAM useru** po ARN-u | Ne blokira (ni identity politika ni boundary) |
| **IAM ulozi** po ARN-u (`role/...`) | **Blokira**: zahtjev pravi sesija uloge, a dozvola data ulozi je ograničena boundaryjem i session policy |
| **Sesiji uloge** (`assumed-role/Role/session`) | Ne blokira: dozvola je data direktno sesiji |
| **Federated user sesiji** (`GetFederationToken`) | Ne blokira |

Izuzeci kod kojih resource politika **mora** eksplicitno dozvoliti, čak i u istom nalogu:

- **Role trust policy**: bez nje niko ne može preuzeti ulogu.
- **KMS key policy**: IAM politike rade samo ako key policy to omogući (npr. statement koji daje pristup `arn:aws:iam::111122223333:root`, tj. nalogu).

Explicit Deny u bilo kojoj politici i dalje pobjeđuje u svim slučajevima.

### Cross-account

Kad principal iz naloga A pristupa resursu u nalogu B, AWS radi **dvije evaluacije** i obje moraju dati Allow:

- **Nalog A (trusted)**: identity politika principala mora dozvoliti akciju na resursu u B, a SCP-ovi naloga A, boundary i session policy ne smiju to blokirati.
- **Nalog B (trusting)**: resource politika mora dozvoliti principala iz A, a RCP-ovi naloga B ne smiju to blokirati.

Unija ovdje **ne važi**: resource politika u B sama nije dovoljna (osim kod anonimnog/javnog pristupa), niti je dovoljna identity politika u A.

Cross-account S3 primjer. Bucket politika u nalogu B (222233334444):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowAnalyticsRead",
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:role/AnalyticsReader" },
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::acme-datalake", "arn:aws:s3:::acme-datalake/*"]
  }]
}
```

Identity politika uloge `AnalyticsReader` u nalogu A:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::acme-datalake", "arn:aws:s3:::acme-datalake/*"]
}
```

Ako su objekti šifrovani **SSE-KMS** ključem iz naloga B, potrebno je još: key policy u B dozvoljava `kms:Decrypt` za ulogu iz A **i** identity politika u A dozvoljava `kms:Decrypt` na tom ključu. Ovo je klasičan uzrok „bucket politika je ispravna, a i dalje AccessDenied“.

### Resource policy vs uloga za cross-account

| Pristup | Prednosti | Mane |
|---|---|---|
| **Resource-based policy** (bucket, KMS, SQS…) | Principal zadržava svoje dozvole u svom nalogu (npr. čita iz bucketa u B i piše u bucket u A u istom pozivu/procesu). Nema prelaska u ulogu. | Radi samo za servise sa resource politikama. Politika po resursu. |
| **Cross-account uloga** (`AssumeRole`) | Radi za sve servise; centralno definisane dozvole u nalogu B; CloudTrail u B pokazuje sesiju. | Principal se odriče svojih dozvola dok koristi ulogu. |

> **Na ispitu:** „Lambda u nalogu A mora kopirati objekte iz bucketa u nalogu B u bucket u nalogu A“ → najjednostavnije je **bucket politika u B** (resource-based) + identity politika u A, jer funkcija zadržava pristup svom bucketu. Ako servis nema resource politiku (npr. EC2 API), jedini put je **cross-account uloga**.

### Role trust policy

Trust policy je resource politika uloge: **ko** smije preuzeti ulogu. Dozvole uloge su posebno, u permissions politici.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
    "Action": ["sts:AssumeRole", "sts:TagSession"],
    "Condition": {
      "StringEquals": { "aws:PrincipalTag/Team": "security" },
      "Bool": { "aws:MultiFactorAuthPresent": "true" }
    }
  }]
}
```

`"arn:aws:iam::111122223333:root"` znači „nalog 111122223333“: AWS vjeruje tom nalogu, a nalog A svojim IAM politikama odlučuje ko od njegovih principala smije pozvati `sts:AssumeRole`. Ako navedeš konkretan role ARN pa tu ulogu obrišeš i ponovo napraviš, trust policy prestaje raditi (ARN se interno zamijeni ID-jem).

## Condition keys

| Ključ | Šta provjerava | Tipična upotreba |
|---|---|---|
| **`aws:PrincipalOrgID`** | Organizacija principala | Resource politika: „samo principali iz moje organizacije“ bez nabrajanja naloga |
| **`aws:PrincipalOrgPaths`** | Putanja OU principala | Samo nalozi iz OU Prod |
| **`aws:ResourceOrgID`** | Organizacija resursa | Identity/SCP: „moji ljudi smiju pisati samo u buckete moje organizacije“ |
| **`aws:SourceVpce`** | ID VPC endpointa kroz koji je zahtjev došao | Bucket dostupan samo kroz određeni endpoint |
| **`aws:SourceVpc`** | VPC iz kog je zahtjev došao (kroz endpoint) | Bucket dostupan samo iz VPC-a |
| **`aws:SourceIp`** | Javna IP adresa klijenta | Ograničenje na korporativne IP; **ne radi** za zahtjeve kroz VPC endpoint (tamo `aws:VpcSourceIp`) |
| **`aws:SecureTransport`** | Da li je zahtjev išao preko TLS-a | Deny ako je `false` |
| **`aws:PrincipalTag/<key>`** | Tag na principalu ili sesiji | ABAC |
| **`aws:ResourceTag/<key>`** | Tag na postojećem resursu | ABAC |
| **`aws:RequestTag/<key>`**, **`aws:TagKeys`** | Tagovi poslani u zahtjevu (kreiranje, tagovanje) | Obavezni tagovi pri kreiranju |
| **`aws:CalledVia`** (`CalledViaFirst`, `CalledViaLast`) | Lista servisa koji su pozvali u ime principala | Dozvoli `s3:GetObject` samo kad poziva Athena |
| **`aws:ViaAWSService`** | `true` kad AWS servis koristi kredencijale principala za poziv drugog servisa | Izuzetak u IP/VPC Deny pravilima |
| **`aws:PrincipalIsAWSService`** | Da li je principal AWS servis (servisni principal) | Izuzetak za CloudTrail, Config itd. u perimetru |
| **`aws:SourceArn`**, **`aws:SourceAccount`** | Resurs/nalog u čije ime servis pristupa | Confused deputy zaštita kod servisnih principala |
| **`aws:MultiFactorAuthPresent`** | MFA u sesiji | Osjetljive akcije |
| **`aws:RequestedRegion`** | Region u koji ide zahtjev | SCP region ograničenje |
| **`aws:PrincipalArn`** | ARN principala (za ulogu: ARN uloge, ne sesije) | Izuzetak za break-glass ulogu |

### Primjer: S3 samo kroz VPC endpoint i samo preko TLS-a

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyNotViaVpce",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-payroll", "arn:aws:s3:::acme-payroll/*"],
      "Condition": {
        "StringNotEquals": { "aws:SourceVpce": "vpce-0a1b2c3d4e5f67890" },
        "BoolIfExists": { "aws:ViaAWSService": "false" }
      }
    },
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-payroll", "arn:aws:s3:::acme-payroll/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
```

Više ključeva u jednom `Condition` bloku se spaja sa **AND**; više vrijednosti za isti ključ sa **OR**. Uslov `aws:ViaAWSService` sprečava da Deny blokira zahtjeve koje servis (npr. Athena ili CloudFormation) šalje u tvoje ime sa svojih adresa.

### Primjer: aws:CalledVia

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::acme-datalake/*",
  "Condition": { "ForAnyValue:StringEquals": { "aws:CalledVia": ["athena.amazonaws.com"] } }
}
```

Analitičar može čitati podatke samo kroz Athena upite, ne direktno sa `aws s3 cp`.

### Operatori koje treba prepoznati

- `StringEquals` / `StringLike` (wildcard `*`, `?`), `ArnLike`, `IpAddress`, `Bool`, `NumericLessThan`, `DateGreaterThan`.
- `...IfExists`: uslov se primjenjuje samo ako ključ postoji u kontekstu (inače se smatra ispunjenim).
- `ForAllValues` / `ForAnyValue` za ključeve sa više vrijednosti (`aws:TagKeys`, `aws:CalledVia`). Pazi: `ForAllValues` je **tačno** ako ključ ne postoji ili je prazan.
- `Null`: `"Null": {"aws:RequestTag/CostCenter": "true"}` znači „tag nije poslan“.

> **Na ispitu:** „Bucket mora biti dostupan samo nalozima naše organizacije, uključujući buduće naloge, uz najmanje održavanja“ = **`aws:PrincipalOrgID`** u bucket politici (ili RCP za sve buckete). Nabrajanje account ID-jeva je pogrešno jer traži izmjenu za svaki novi nalog.

## ABAC vs RBAC

| | **RBAC** (role-based) | **ABAC** (attribute-based) |
|---|---|---|
| Osnova | Uloga/posao: `DevOpsAdmin`, `Auditor` | Atributi (tagovi) principala i resursa |
| Nove osobe | Dodaš u grupu/permission set | Automatski, preko atributa iz IdP-a |
| Novi projekti/resursi | Mijenjaš politike (novi ARN-ovi) | Bez izmjene politike, samo ispravni tagovi |
| Broj politika | Raste sa brojem timova i projekata | Mali broj generičkih politika |
| Rizik | Eksplozija uloga | Neko mijenja tagove → mora se zaštititi tagovanje |

ABAC politika: developer smije upravljati EC2 instancama samo svog projekta, i nove instance mora tagovati svojim projektom:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageOwnProject",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances", "ec2:RebootInstances"],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": { "StringEquals": { "aws:ResourceTag/Project": "${aws:PrincipalTag/Project}" } }
    },
    {
      "Sid": "CreateOnlyWithOwnProjectTag",
      "Effect": "Allow",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": { "StringEquals": { "aws:RequestTag/Project": "${aws:PrincipalTag/Project}" } }
    },
    {
      "Sid": "NoRetagging",
      "Effect": "Deny",
      "Action": ["ec2:CreateTags", "ec2:DeleteTags"],
      "Resource": "*",
      "Condition": { "StringNotEquals": { "ec2:CreateAction": "RunInstances" } }
    }
  ]
}
```

(U praksi `RunInstances` traži i dozvole na druge resurse: AMI, subnet, security group, mrežni interfejs, volumen; ovdje je skraćeno.)

Odakle dolazi `aws:PrincipalTag`:

- tag na IAM korisniku ili ulozi,
- **session tags** pri `AssumeRole` (`--tags`) ili iz SAML/OIDC atributa (`https://aws.amazon.com/SAML/Attributes/PrincipalTag:Project`),
- **IAM Identity Center attributes for access control**: atributi iz IdP-a postaju session tagovi.

Za ABAC sa Identity Centerom imaš jedan permission set za sve timove, a pristup određuje atribut `Project` korisnika u IdP-u.

> **Na ispitu:** „Kompanija brzo dodaje nove projekte i ne želi mijenjati IAM politike za svaki novi projekat“ = **ABAC** sa `aws:PrincipalTag` = `aws:ResourceTag`. Uvijek obrati pažnju da li rješenje sprečava korisnika da sam promijeni tag (Deny na `CreateTags`/`TagResource` ili `aws:TagKeys` uslov).

## IAM paths

**Path** je prefiks u imenu IAM korisnika, uloge, grupe ili politike: `arn:aws:iam::111122223333:role/app/payments/PaymentsApi`. Koristi se za organizaciju i **wildcard ovlasti**:

```json
{
  "Effect": "Allow",
  "Action": ["iam:PassRole"],
  "Resource": "arn:aws:iam::111122223333:role/app/payments/*"
}
```

Tim za plaćanja smije proslijediti (`iam:PassRole`) samo uloge pod `/app/payments/`. Path ne mijenja dozvole sam po sebi i ne pojavljuje se u ARN-u sesije uloge (`arn:aws:sts::…:assumed-role/PaymentsApi/sesija`). Identity Center koristi path `/aws-reserved/sso.amazonaws.com/` za svoje uloge, pa resource politike mogu ciljati sve SSO uloge preko `aws:PrincipalArn` sa wildcardom.

## Least privilege: permission boundaries i session policies

### Permissions boundary

**Permissions boundary** je managed politika postavljena kao gornja granica za IAM korisnika ili ulogu. Efektivne dozvole = **presjek** identity politike i boundaryja.

Glavni scenarij je **delegacija**: developeri smiju sami praviti uloge za svoje Lambda funkcije, ali nikad ne smiju napraviti ulogu jaču od dozvoljenog.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateRolesOnlyWithBoundary",
      "Effect": "Allow",
      "Action": ["iam:CreateRole", "iam:PutRolePolicy", "iam:AttachRolePolicy"],
      "Resource": "arn:aws:iam::111122223333:role/app/*",
      "Condition": {
        "StringEquals": { "iam:PermissionsBoundary": "arn:aws:iam::111122223333:policy/DevBoundary" }
      }
    },
    {
      "Sid": "NoBoundaryTampering",
      "Effect": "Deny",
      "Action": [
        "iam:DeleteRolePermissionsBoundary",
        "iam:CreatePolicyVersion", "iam:DeletePolicy", "iam:SetDefaultPolicyVersion"
      ],
      "Resource": [
        "arn:aws:iam::111122223333:role/*",
        "arn:aws:iam::111122223333:policy/DevBoundary"
      ]
    }
  ]
}
```

Bez drugog statementa developer bi mogao skinuti boundary ili izmijeniti samu boundary politiku i tako eskalirati privilegije.

### Session policy

**Session policy** proslijeđuješ pri `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` ili `GetFederationToken`. Efektivne dozvole sesije = presjek politike uloge i session politike. Primjer: jedna uloga za multi-tenant aplikaciju, a pri svakom zahtjevu se proslijedi session policy koja ograničava pristup na prefiks tog tenanta.

```bash
aws sts assume-role --role-arn arn:aws:iam::111122223333:role/TenantData \
  --role-session-name tenant-42 \
  --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::acme-tenants/tenant-42/*"}]}'
```

### Poređenje mehanizama ograničavanja

| | SCP | RCP | Permissions boundary | Session policy |
|---|---|---|---|---|
| Ko postavlja | Organizations admin | Organizations admin | IAM admin (ili delegirani) | Onaj ko kreira sesiju |
| Opseg | Svi principali naloga/OU | Svi resursi naloga/OU (podržani servisi) | Jedan user/uloga | Jedna sesija |
| Utiče na management nalog | Ne | Ne | Da | Da |
| Utiče na eksterne principale | Ne | **Da** | Ne | Ne |
| Daje dozvole | Ne | Ne | Ne | Ne |
| Tipičan cilj | Guardrail za cijeli nalog | Data perimeter oko resursa | Delegacija kreiranja uloga | Sužavanje dijeljene uloge |

> **Na ispitu:** „Developeri moraju moći praviti IAM uloge, ali te uloge ne smiju imati više dozvola od X“ = **permissions boundary** + uslov `iam:PermissionsBoundary` pri kreiranju. SCP je pogrešan jer bi ograničio i developere i sve ostale u nalogu, a ne samo nove uloge.

## IAM Roles Anywhere

**IAM Roles Anywhere** omogućava workloadima **van AWS-a** (on-prem serveri, drugi cloud, uređaji) da dobiju privremene AWS kredencijale preko **X.509 certifikata**, bez dugotrajnih access keyeva.

- **Trust anchor**: CA kojoj vjeruješ, **AWS Private CA** ili vlastita CA (upload certifikata CA).
- **Profile**: koje uloge se smiju preuzeti, opcionalne session/managed politike koje dodatno sužavaju sesiju, trajanje.
- **Credential helper** (`aws_signing_helper`) potpisuje zahtjev privatnim ključem i vraća kredencijale kroz `credential_process` u AWS CLI/SDK konfiguraciji.
- **Revokacija**: uvezi **CRL** u Roles Anywhere; opozvani certifikati više ne dobijaju sesiju.

Trust policy uloge:

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "rolesanywhere.amazonaws.com" },
  "Action": ["sts:AssumeRole", "sts:TagSession", "sts:SetSourceIdentity"],
  "Condition": {
    "StringEquals": { "aws:PrincipalTag/x509Subject/CN": "backup-agent-01.corp.example" },
    "ArnEquals": { "aws:SourceArn": "arn:aws:rolesanywhere:eu-central-1:111122223333:trust-anchor/ta-1234" }
  }
}
```

Atributi certifikata (subject, issuer, SAN) postaju session tagovi, pa trust policy može dozvoliti samo određene certifikate.

> **Na ispitu:** „On-prem server mora slati backup u S3, a security politika zabranjuje dugotrajne access keyeve; kompanija već ima PKI“ = **IAM Roles Anywhere** sa trust anchorom na korporativni CA. Distraktori: IAM user ključ u Secrets Manageru, Systems Manager hybrid activation (kad pitanje traži certifikate i postojeći PKI).

## Amazon Verified Permissions

**Amazon Verified Permissions** je managed servis za **autorizaciju unutar tvoje aplikacije** (ne AWS API-ja). Politike se pišu u jeziku **Cedar** i čuvaju u **policy store**-u, a aplikacija pita servis `IsAuthorized` (ili `IsAuthorizedWithToken` sa Cognito/OIDC tokenom).

```cedar
permit (
  principal in Group::"doctors",
  action == Action::"viewRecord",
  resource
) when {
  resource.department == principal.department
};

forbid (principal, action, resource)
when { resource.confidential == true && !(principal has clearance) };
```

- Podržava RBAC (grupe) i ABAC (atributi) u istim politikama, `forbid` pobjeđuje `permit` (isto kao Deny u IAM-u).
- **Schema** validira entitete i akcije, **policy templates** za ponavljajuće dozvole (npr. dijeljenje dokumenta).
- Svaka odluka se može logovati za audit, a autorizaciona logika izlazi iz koda aplikacije.

> **Na ispitu:** „Aplikacija ima složena pravila ko smije vidjeti koji dokument, logika je rasuta po kodu, potrebna je centralna, auditabilna autorizacija za korisnike aplikacije“ = **Verified Permissions**. IAM politike su za AWS resurse, ne za objekte unutar tvoje aplikacije.

## Analiza autorizacionih grešaka

### Čitanje AccessDenied poruke

Mnogi servisi danas u poruci kažu **koji tip politike** je uzrokovao odbijanje:

```text
User: arn:aws:sts::111122223333:assumed-role/DevRole/ana is not authorized to perform:
s3:GetObject on resource: "arn:aws:s3:::acme-payroll/2026/okt.csv"
with an explicit deny in a resource-based policy
```

Moguće varijante: `because no identity-based policy allows`, `with an explicit deny in a service control policy`, `because no resource-based policy allows`, `with an explicit deny in a permissions boundary`, `with an explicit deny in a resource control policy`, `with an explicit deny in a session policy`. Ta fraza ti odmah kaže gdje gledati.

### IAM Policy Simulator

**IAM Policy Simulator** testira identity politike, permission boundaries, SCP-ove i resource politike koje mu daš, bez stvarnog poziva.

- **Principal mode**: politike postojećeg korisnika, grupe ili uloge.
- **Custom mode**: politika koju još pišeš.
- Možeš zadati vrijednosti condition ključeva (IP, tagovi, MFA).
- Ograničenja: **ne podržava RCP**; rezultati mogu odstupati za VPC endpoint politike, role chaining i složene resource politike.

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::111122223333:role/DevRole \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::acme-payroll/2026/okt.csv
```

### IAM Access Analyzer

| Funkcija | Šta radi | Kad |
|---|---|---|
| **External access analyzer** | Logičkim rezonovanjem analizira resource politike i nalazi resurse dijeljene **van zone povjerenja** (nalog ili organizacija), uključujući javni pristup. Po regionu. | „Koji bucketi, KMS ključevi, uloge, Lambda funkcije, SQS redovi… su dostupni nekom spolja?“ |
| **Internal access analyzer** | Za odabrane kritične resurse pokazuje koji principali **unutar** organizacije/naloga imaju pristup. | „Ko u organizaciji može čitati ovu DynamoDB tabelu?“ |
| **Unused access analyzer** | Nekorištene uloge, access keyevi, lozinke, te nekorištene dozvole (servisi, akcije) aktivnih uloga i korisnika. Plaća se. | Čišćenje prekomjernih dozvola |
| **Policy validation** | 100+ provjera gramatike i best practice-a (greške, sigurnosna upozorenja, prijedlozi). | U editoru i u CI (`aws accessanalyzer validate-policy`) |
| **Custom policy checks** | `CheckNoNewAccess` (nova verzija ne daje više od referentne), `CheckAccessNotGranted` (politika ne daje kritične akcije/resurse), `CheckNoPublicAccess` (resource politika ne otvara javni pristup). Plaća se po pozivu. | Gate u CI/CD prije deploya IaC-a |
| **Policy generation** | Pravi least-privilege politiku iz CloudTrail aktivnosti uloge/korisnika za zadati period. | Početak od `*` → stvarno korištene akcije |
| **Preview access** | Prije primjene politike pokaže koje bi nalaze generisala. | Provjera izmjene bucket politike |

```bash
# CI/CD gate: nova politika ne smije dati iam:PassRole ni s3:DeleteBucket
aws accessanalyzer check-access-not-granted \
  --policy-document file://role-policy.json \
  --access '[{"actions":["iam:PassRole","s3:DeleteBucket"]}]' \
  --policy-type IDENTITY_POLICY
```

Nalaz external access analyzera koji je namjeran (npr. partner) arhiviraš ili napraviš **archive rule**; neželjen ispraviš i uradiš **rescan**. Nalazi idu u Security Hub i EventBridge.

> **Na ispitu:** „Pronaći sve S3 buckete i KMS ključeve u organizaciji dijeljene sa nalozima van organizacije“ = **Access Analyzer external access** sa organizacijom kao zonom povjerenja. „Ukloniti dozvole koje uloge nisu koristile 90 dana“ = **unused access analyzer** ili **policy generation**. „Spriječiti u pipeline-u da Terraform doda politiku koja daje više pristupa nego prije“ = **custom policy check `CheckNoNewAccess`**.

## Rezime

- Redoslijed: **explicit Deny** (bilo gdje) → **RCP** → **SCP** → **resource policy** → **identity policy** → **permissions boundary** → **session policy**. Guardrail politike nikad ne daju dozvolu.
- U istom nalogu identity i resource politika se **sabiraju** (unija); resource politika koja imenuje **ulogu** i dalje je ograničena boundaryjem i session policy, a ona koja imenuje **sesiju ili usera** nije. Trust policy i KMS key policy moraju eksplicitno dozvoliti.
- Cross-account: **obje strane** moraju dozvoliti (identity u A + resource u B, uz SCP u A i RCP u B); kod SSE-KMS treba i key policy.
- **SCP** ograničava principale mog naloga, **RCP** ograničava pristup mojim resursima (i eksternim principalima); nijedan ne važi za management nalog ni service-linked uloge.
- Ključni uslovi: `aws:PrincipalOrgID`, `aws:SourceVpce`, `aws:SourceIp` (ne kroz endpoint), `aws:SecureTransport`, `aws:PrincipalTag`/`ResourceTag`/`RequestTag`, `aws:CalledVia`, `aws:ViaAWSService`.
- **ABAC** skalira bez izmjene politika, ali mora zaštititi tagove; **boundary** omogućava sigurnu delegaciju kreiranja uloga; **session policy** sužava dijeljenu ulogu.
- **Roles Anywhere** = X.509 za workloade van AWS-a; **Verified Permissions** (Cedar) = autorizacija unutar aplikacije.
- Troubleshooting: poruka AccessDenied kaže tip politike, **Policy Simulator** (bez RCP), **Access Analyzer** (external, internal, unused, validation, custom checks, generation).
