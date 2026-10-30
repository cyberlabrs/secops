## Cilj ispita: 6.1

Ovaj modul pokriva zadatak **6.1** iz domena 6 (**Security Foundations and Governance**, 14% ispita): strategija za centralno kreiranje i upravljanje AWS nalozima. Vještine:

- **6.1.1** postavljanje i konfiguracija organizacije u **AWS Organizations**,
- **6.1.2** **AWS Control Tower** u novom i postojećem okruženju, uz opcione i custom kontrole,
- **6.1.3** organization policies za upravljanje dozvolama: **SCP**, **RCP**, **AI services opt-out**, **declarative policies**,
- **6.1.4** centralno upravljanje sigurnosnim servisima (**delegated administrator**),
- **6.1.5** upravljanje root kredencijalima: centralizovan root pristup za member naloge, MFA, break-glass procedure.

Pitanja iz ovog zadatka gotovo uvijek opisuju organizaciju sa desetinama ili stotinama naloga i traže rješenje koje radi **automatski i za buduće naloge**. Fraze „across all accounts“, „including accounts created in the future“ i „with the LEAST operational overhead“ vode prema organization policies, Control Tower kontrolama i delegated administratoru, a ne prema skriptama po nalogu.

## 6.1.1 AWS Organizations i dizajn OU po SRA

**AWS Organizations** grupiše naloge u hijerarhiju: **root** → **organizational units (OU)** → nalozi. **Management account** (ranije „master“) kreira organizaciju, plaća račun i jedini može mijenjati organization policies, osim ako se upravljanje delegira. Organizacija mora imati uključen **all features** mod da bi radile SCP, RCP i ostale politike (samo consolidated billing nije dovoljno).

### Preporučena struktura (AWS Security Reference Architecture)

**AWS SRA** preporučuje da management account ostane gotovo prazan, a sigurnosne funkcije budu u posebnim nalozima unutar **Security OU**:

| OU / nalog | Svrha |
|---|---|
| **Management account** | Samo Organizations, billing, (eventualno) Control Tower. Bez radnih opterećenja. SCP i RCP **ne djeluju** na njega, pa je rizičan za bilo šta drugo. |
| **Security OU → Log Archive** | Nepromjenjivi centralni logovi: organization CloudTrail, Config snapshotovi, VPC Flow Logs, S3 sa Object Lock. Malo ko ima pristup. |
| **Security OU → Security Tooling (Audit)** | Delegated administrator za GuardDuty, Security Hub, Macie, Inspector, Detective, Config aggregator, IAM Access Analyzer. SOC radi odavde. |
| **Infrastructure OU** | Network nalog (Transit Gateway, Network Firewall, Route 53), shared services. |
| **Workloads OU** (Prod / Non-prod) | Aplikacioni nalozi; različite SCP za prod i dev. |
| **Sandbox OU** | Eksperimenti, stroži budžet i SCP koji brani povezivanje sa korporativnom mrežom. |
| **Suspended / Policy staging OU** | Nalozi za zatvaranje (deny-all SCP) i testiranje novih politika prije šire primjene. |

```bash
aws organizations create-organizational-unit --parent-id r-ab12 --name Security
aws organizations move-account --account-id 222222222222 \
  --source-parent-id r-ab12 --destination-parent-id ou-ab12-security
aws organizations enable-aws-service-access --service-principal guardduty.amazonaws.com
```

OU se gnijezde najviše pet nivoa ispod roota. Politike se nasljeđuju niz hijerarhiju, pa OU dizajniraj po **sigurnosnim zahtjevima** (prod vs dev, regulisano vs neregulisano), a ne po organigramu firme.

> **Na ispitu:** „gdje držati centralne logove tako da ih ni administratori aplikacionih naloga ne mogu mijenjati“ = **Log Archive** nalog u Security OU (uz S3 Object Lock i SCP). „Gdje pokrenuti GuardDuty/Security Hub administraciju“ = **Security Tooling (Audit)** nalog kao delegated administrator, nikad management account.

## 6.1.2 AWS Control Tower

**AWS Control Tower** automatski postavlja **landing zone**: dobro konfigurisano multi-account okruženje nad Organizations.

Šta landing zone pravi:
- **Security OU** sa nalozima **Log Archive** i **Audit**,
- organization **CloudTrail** trail i AWS Config prema Log Archive nalogu,
- (opciono) **IAM Identity Center** za pristup nalozima,
- osnovne kontrole i **Account Factory** za nove naloge.

### Kontrole (controls, ranije guardrails)

| Ponašanje | Implementacija | Status |
|---|---|---|
| **Preventive** | SCP, **RCP** i **declarative policies** iz Organizations | enforced / not enabled |
| **Detective** | AWS Config rules (dio i kroz Security Hub service-managed standard) | clear / in violation / not enabled |
| **Proactive** | **CloudFormation Hooks**: provjera resursa **prije** kreiranja | PASS / FAIL / SKIP |

Po **guidance** kontrole su **mandatory**, **strongly recommended** i **elective**. Kontrole se uključuju po OU i važe za sve naloge u njemu. Primjeri: „Disallow changes to CloudTrail“, „Detect whether MFA for the root user is enabled“, **Region deny** kontrola koja blokira rad van odobrenih regiona. Management account je namjerno izuzet od kontrola.

### Account Factory i proširenja

- **Account Factory**: kreiranje standardizovanih naloga (Service Catalog proizvod u pozadini); nalog dobija baseline i kontrole svog OU.
- **Account Factory for Terraform (AFT)**: isti proces kroz Terraform i GitOps pipeline, za timove koji već rade u Terraformu.
- **Customizations for AWS Control Tower (CfCT)** i **Account Factory Customization (AFC)**: dodatni CloudFormation šabloni i SCP-ovi primijenjeni pri kreiranju naloga.

### Postojeće okruženje

Control Tower se može postaviti **u postojećoj organizaciji**. Postojeći OU se **registruje** (Register OU) i time se njegovi nalozi **enroll-uju**; svaki nalog dobija rolu `AWSControlTowerExecution` i kontrole OU-a. Nalog koji ne ispunjava preduslove (npr. postojeći Config recorder ili delivery channel u konfliktu) ostaje *Enrollment failed* dok se problem ne riješi i OU ponovo registruje. Ručne izmjene resursa koje Control Tower pravi (npr. brisanje njegovih SCP-ova, premještanje naloga mimo njega) izazivaju **drift**, koji se popravlja kroz *Repair* landing zone.

> **Na ispitu:** „uspostaviti multi-account okruženje sa centralnim logovanjem i gotovim kontrolama uz NAJMANJE operativnog napora“ = **Control Tower**. „Spriječiti kreiranje nešifrovanog S3 bucketa kroz CloudFormation **prije** deploya“ = **proactive** kontrola (Hooks). „Detektovati već postojeće neusklađene resurse“ = **detective** kontrola (Config). „Onemogućiti akciju bez obzira na IAM“ = **preventive** (SCP/RCP).

## 6.1.3 Organization policies

Organizations ima dvije grupe politika:

- **Authorization policies**: **SCP** i **RCP**. Ograničavaju **maksimalne dozvole**, nikad ih ne daju.
- **Management policies**: **declarative policies** (EC2 i drugi servisi), **tag policies**, **backup policies**, **AI services opt-out policies**, chat applications politike i druge. One postavljaju konfiguraciju servisa.

### SCP vs RCP vs ostale granice dozvola

| | **SCP** | **RCP** | Permission boundary | Session policy |
|---|---|---|---|---|
| Na šta se kači | Root, OU, nalog | Root, OU, nalog | IAM user ili rola | Pri `AssumeRole`/federaciji |
| Šta ograničava | **Principale** (useri, role, root) u member nalozima | **Resurse** u member nalozima, bez obzira ko pristupa (i iz drugih organizacija) | Jednog principala | Jednu sesiju |
| Daje li dozvole | Ne | Ne | Ne | Ne |
| Management account | Ne djeluje | Ne djeluje | Djeluje | Djeluje |
| Service-linked role | Ne djeluje | Ne djeluje | — | — |
| Default | `FullAWSAccess` | `RCPFullAWSAccess` (ne može se ukloniti) | — | — |
| Servisi | Svi | Podskup (npr. S3, KMS, STS, SQS, Secrets Manager, DynamoDB, ECR, CloudWatch Logs…) | Svi | Svi |

Logika evaluacije: zahtjev prolazi samo ako ga **dozvoli** identity ili resource policy **i** ako ga ne zabrani nijedan eksplicitni `Deny`, **i** ako ga dozvoljavaju SCP-ovi na **svakom nivou** od roota do naloga principala **i** RCP-ovi na svakom nivou do naloga resursa. Eksplicitni `Deny` bilo gdje uvijek pobjeđuje.

**SCP primjer**: zabrana isključivanja sigurnosnih servisa i rada van odobrenih regiona, uz izuzetak za platform rolu.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ProtectSecurityServices",
      "Effect": "Deny",
      "Action": ["guardduty:DeleteDetector", "guardduty:DisassociateFromAdministratorAccount",
                 "cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "config:StopConfigurationRecorder",
                 "organizations:LeaveOrganization"],
      "Resource": "*",
      "Condition": {"ArnNotLike": {"aws:PrincipalArn": "arn:aws:iam::*:role/OrgPlatformAdmin"}}
    },
    {
      "Sid": "DenyOtherRegions",
      "Effect": "Deny",
      "NotAction": ["iam:*", "organizations:*", "sts:*", "support:*", "cloudfront:*", "route53:*"],
      "Resource": "*",
      "Condition": {"StringNotEquals": {"aws:RequestedRegion": ["eu-central-1", "eu-west-1"]}}
    }
  ]
}
```

**RCP primjer**: **data perimeter**, resursi organizacije dostupni samo principalima iz organizacije ili AWS servisima. Ovo štiti i od pogrešno napisane bucket policy koja daje pristup stranom nalogu.

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
      "StringNotEqualsIfExists": {"aws:PrincipalOrgID": "o-abc123"},
      "BoolIfExists": {"aws:PrincipalIsAWSService": "false"}
    }
  }]
}
```

RCP ne djeluje na AWS managed KMS ključeve i na service-linked role. Prije kačenja na root testiraj ga na pojedinačnom nalogu ili policy staging OU i prati `AccessDenied` u CloudTrailu.

> **Na ispitu:** „spriječiti developere u svim nalozima da isključe CloudTrail“ = **SCP**. „Nijedan principal van organizacije ne smije pristupiti S3 bucketima i KMS ključevima, čak i ako bucket policy to greškom dozvoli“ = **RCP**. „Ograničiti šta developer smije dati roli koju sam kreira“ = **permission boundary**. SCP i RCP ne štite management account: zato tamo nema radnih opterećenja.

### Declarative policies

**Declarative policies** postavljaju i drže željenu konfiguraciju servisa **na nivou control planea servisa**, a ne kroz zabranu API poziva. Prednosti: konfiguracija važi i kada servis doda nove API-je, važi za nove naloge automatski, i obuhvata i service-linked role. Postoji **custom error message** (npr. link na interni wiki) i **account status report** koji pokazuje trenutno stanje atributa po nalozima prije uključivanja.

Za **EC2** (ključ `ec2_attributes`) podržani su, između ostalog: **VPC Block Public Access**, **Serial Console Access**, **Image Block Public Access** (dijeljenje AMI-ja), **Allowed Images Settings** (koji AMI-ji smiju biti korišteni), **Instance Metadata** podrazumijevane vrijednosti (npr. obavezan IMDSv2) i **Snapshot Block Public Access**.

```json
{
  "ec2_attributes": {
    "image_block_public_access": {"state": {"@@assign": "block_new_sharing"}},
    "snapshot_block_public_access": {"state": {"@@assign": "block_all_sharing"}},
    "instance_metadata_defaults": {"http_tokens": {"@@assign": "required"}},
    "exception_message": {"@@assign": "Blokirano politikom organizacije. Vidi wiki/cloud-policy"}
  }
}
```

Kad se declarative policy ukloni, atribut se vraća u stanje prije politike. Administrator naloga ne može lokalno promijeniti atribut koji politika drži.

> **Na ispitu:** „zabraniti javno dijeljenje AMI-ja i EBS snapshotova u svim nalozima, uključujući buduće API-je, uz NAJMANJE održavanja“ = **declarative policy** za EC2, a ne SCP sa listom API akcija koju treba ažurirati.

### AI services opt-out, tag i backup politike

- **AI services opt-out policies**: AWS AI servisi mogu koristiti sadržaj korisnika za unapređenje servisa. Politika na rootu isključuje to za sve naloge (ključ `default`) ili za pojedine servise; nakon opt-outa servis briše ranije sačuvan sadržaj koji mu nije potreban za rad.

```json
{
  "services": {
    "default": {"opt_out_policy": {"@@assign": "optOut"}},
    "@@operators_allowed_for_child_policies": ["@@none"]
  }
}
```

- **Tag policies**: standardizuju ključeve i dozvoljene vrijednosti tagova (npr. `CostCenter` sa tačnim velikim slovima), a sa `enforced_for` mogu odbiti neusklađeno tagovanje za navedene tipove resursa. Detaljnije u modulu 11.
- **Backup policies**: centralno definišu AWS Backup planove (raspored, retencija, kopija u drugi region/nalog) za naloge u OU.

## 6.1.4 Delegated administrator za sigurnosne servise

Sigurnosni servisi se uključuju za cijelu organizaciju iz jednog naloga. Management account registruje **delegated administrator** (najčešće Security Tooling nalog), koji onda upravlja servisom za sve member naloge, automatski uključuje nove naloge i vidi sve nalaze.

| Servis | Šta delegated admin radi |
|---|---|
| **Amazon GuardDuty** | Auto-enable za nove naloge, zaštitni planovi (S3, EKS, Runtime Monitoring, Malware Protection), svi nalazi; po regionu. |
| **AWS Security Hub** | Centralna konfiguracija standarda i kontrola kroz configuration policies, agregacija nalaza iz regiona. |
| **Amazon Macie** | Discovery poslovi i nalazi za S3 u svim nalozima. |
| **Amazon Inspector** | Skeniranje EC2, ECR i Lambda u svim nalozima. |
| **Amazon Detective** | Graf ponašanja za istragu nalaza iz cijele organizacije. |
| **AWS Config** | Organization Config rules, conformance packs i aggregator. |
| **IAM Access Analyzer** | Analyzer sa organizacijom kao zonom povjerenja. |
| **AWS Firewall Manager** | Centralne politike za WAF, SG, Network Firewall (vidi modul 11). |
| **IAM** (root access management) | Centralizovan root pristup za member naloge. |

```bash
# iz management naloga, u svakom regionu gdje se GuardDuty koristi
aws guardduty enable-organization-admin-account --admin-account-id 333333333333
# iz delegated admin naloga
aws guardduty update-organization-configuration --detector-id <id> --auto-enable-organization-members ALL
```

> **Na ispitu:** „SOC tim mora vidjeti GuardDuty nalaze iz svih 300 naloga, a novi nalozi moraju biti automatski uključeni“ = **delegated administrator** u Security Tooling nalogu + **auto-enable**. Ručno pozivanje member naloga (invitations) je stari, sporiji način i nije odgovor kad postoji Organizations.

## 6.1.5 Root user: centralizacija, MFA i break-glass

### Centralizovan root pristup za member naloge

IAM **Root access management** (preduslov: trusted access za IAM u Organizations) ima dvije mogućnosti:

1. **Root credentials management**: management account ili **delegated administrator za IAM** može **obrisati** root lozinku, access ključeve, signing certifikate i deaktivirati MFA u member nalozima. **Novi nalozi kreirani kroz Organizations nemaju root kredencijale.** Member nalog tada ne može ni prijavu ni oporavak lozinke roota, osim ako se eksplicitno dozvoli.
2. **Privileged root actions in member accounts**: umjesto prijave kao root, centralni tim pokreće kratku privilegovanu sesiju `sts:AssumeRoot` ograničenu **task policy**-jem na jedan zadatak.

```bash
aws organizations enable-aws-service-access --service-principal iam.amazonaws.com
aws iam enable-organizations-root-credentials-management
aws iam enable-organizations-root-sessions
aws organizations register-delegated-administrator \
  --service-principal iam.amazonaws.com --account-id 333333333333

# privilegovana sesija (regionalni STS endpoint, globalni nije podržan)
aws sts assume-root --target-principal 444444444444 \
  --task-policy-arn arn=arn:aws:iam::aws:policy/root-task/S3UnlockBucketPolicy \
  --duration-seconds 900
```

Task politike (AWS managed): `IAMAuditRootUserCredentials`, `IAMCreateRootUserPassword` (dozvoli oporavak lozinke), `IAMDeleteRootUserCredentials`, `S3UnlockBucketPolicy` (obriši bucket policy koja blokira sve principale), `SQSUnlockQueuePolicy`. Uslov `sts:TaskPolicyArn` ograničava koje task politike neka rola smije koristiti. `sts:AssumeRoot` ne može pozvati root korisnik, već IAM rola ili user sa tim pravom.

### MFA i zaštita roota

- Management account root: jaka lozinka, **MFA** (FIDO2 passkey/security key ili hardverski token; root podržava više MFA uređaja), bez access ključeva, kontakt email na distribucionoj listi koju kontroliše firma.
- AWS sada forsira MFA za root korisnike, ali MFA mora biti registrovan; Control Tower i Security Hub imaju kontrole koje provjeravaju root MFA i root access ključeve.
- Alarm na svaku upotrebu roota: EventBridge pravilo na CloudTrail događaje gdje je `userIdentity.type` = `Root`.

```json
{
  "source": ["aws.signin", "aws.cloudtrail"],
  "detail": {"userIdentity": {"type": ["Root"]}}
}
```

### Break-glass procedura

Break-glass je unaprijed pripremljen, rijetko korišten pristup za situacije kada redovni put ne radi (npr. IdP/IAM Identity Center nedostupan, pogrešna SCP zaključala administratore).

- Mali broj **break-glass IAM korisnika ili rola** (npr. u management ili posebnom nalogu), sa hardverskim MFA, lozinkom u sefu i podijeljenim znanjem (dvije osobe).
- Isključeni iz SCP ograničenja samo koliko je nužno (uslov `aws:PrincipalArn`), a svaka upotreba diže alarm visokog prioriteta.
- Redovno testiranje (npr. kvartalno) i rotacija nakon svake upotrebe; procedura dokumentovana u IR runbooku.
- Za member naloge sa obrisanim root kredencijalima, „break-glass za root“ je **AssumeRoot** iz delegated admin naloga ili privremeno **Allow password recovery**, a nakon zadatka ponovo brisanje kredencijala.

> **Na ispitu:** „bucket policy sa `Deny` za `Principal: *` zaključala je bucket u member nalogu, a root kredencijali tog naloga su obrisani“ = **`sts:AssumeRoot` sa `S3UnlockBucketPolicy`** iz management ili delegated admin naloga. „Spriječiti da iko koristi root u 200 member naloga“ = **root credentials management** (brisanje kredencijala), uz SCP koji brani akcije root principala kao dodatni sloj.

## Rezime

- Po **SRA**: management account bez radnih opterećenja; **Security OU** sa **Log Archive** i **Security Tooling (Audit)** nalogom; OU po sigurnosnim zahtjevima.
- **Control Tower** pravi landing zone; kontrole su **preventive** (SCP/RCP/declarative), **detective** (Config) i **proactive** (CloudFormation Hooks); postojeći OU se **registruje**.
- **SCP** ograničava principale, **RCP** ograničava resurse (i za spoljne principale); nijedna ne daje dozvole i nijedna ne djeluje na management account ni service-linked role.
- **Declarative policies** drže konfiguraciju servisa (npr. EC2: block public access za AMI/snapshot, IMDSv2, VPC BPA) i za buduće API-je, uz custom poruku greške.
- **AI services opt-out**, **tag** i **backup** politike su management policies za centralnu konfiguraciju.
- **Delegated administrator** u Security Tooling nalogu + auto-enable je standard za GuardDuty, Security Hub, Macie, Inspector, Config, Detective, Access Analyzer.
- **Centralizovan root pristup**: brisanje root kredencijala member naloga i privilegovane `sts:AssumeRoot` sesije sa task politikama; root MFA i alarm na svaku upotrebu roota; testirana break-glass procedura.
