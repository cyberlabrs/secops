## Šta ovaj modul pokriva

Modul pokriva dva zadatka iz domena 5 (**Data Protection**, 18% ispita):

- **5.1** kontrole za podatke **u prenosu**: forsiranje TLS-a (ELB security policies, TLS konfiguracije), privatan pristup resursima (PrivateLink, VPC endpointi, Client VPN, Verified Access), enkripcija između resursa (EMR, EKS, SageMaker AI, Nitro).
- **5.2** kontrole za podatke **u mirovanju**: izbor ključa i tipa enkripcije (KMS, CloudHSM, client-side, server-side), integritet (S3 Object Lock, Glacier Vault Lock, versioning, code signing, validacija fajlova), automatski lifecycle i retencija (S3 Lifecycle, EFS Lifecycle, FSx for Lustre backup), replikacija i backup (Data Lifecycle Manager, AWS Backup, zaštita od ransomwarea, DataSync).

Upravljanje ključevima i tajnama (KMS rotacija, imported key material, Secrets Manager, Private CA) je u modulu 09. Ovdje biraš **gdje** i **kako** se šifruje i kako se podaci štite od izmjene i brisanja.

## 5.1 Podaci u prenosu

### Forsiranje TLS-a na Elastic Load Balancingu

**Application Load Balancer** (HTTPS listener) i **Network Load Balancer** (TLS listener) terminiraju TLS. Koje verzije protokola i šifri prihvataju određuje **security policy** listenera.

| Policy (primjeri) | Šta znači |
|---|---|
| `ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09` | Podrazumijevana u konzoli: TLS 1.3 i 1.2, restriktivne šifre, post-quantum hibridna razmjena ključeva |
| `ELBSecurityPolicy-TLS13-1-2-2021-06` | TLS 1.3 + 1.2 |
| `ELBSecurityPolicy-TLS13-1-3-2021-06` | Samo TLS 1.3 |
| `ELBSecurityPolicy-TLS13-1-2-FIPS-2023-04` | FIPS varijanta |
| `ELBSecurityPolicy-2016-08` | Stara, dozvoljava TLS 1.0/1.1; podrazumijevana kad listener praviš kroz CLI/CloudFormation bez navođenja politike |

```bash
aws elbv2 modify-listener --listener-arn arn:aws:elasticloadbalancing:...:listener/app/web/... \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06
```

Ostale kontrole:

- **HTTP → HTTPS redirect** pravilo na portu 80.
- **End-to-end enkripcija**: ALB ponovo šifruje prema targetu (target group protokol HTTPS). NLB može raditi **TCP passthrough** pa TLS terminira sama aplikacija.
- **Mutual TLS (mTLS)** na ALB-u: **verify** mod (ALB provjerava klijentski certifikat prema **trust store**-u) ili **passthrough** (certifikat se prosljeđuje targetu u headeru).
- Certifikati iz **AWS Certificate Manager (ACM)**: besplatni javni certifikati sa automatskom obnovom (DNS validacija), privatni preko AWS Private CA.
- Koja TLS verzija je stvarno korištena vidi se u ALB **connection logs** i access logovima.

> **Na ispitu:** „Revizija traži da load balancer prihvata samo TLS 1.2 ili noviji, uz najmanje napora“ = promijeni **security policy** HTTPS listenera. Mijenjanje koda aplikacije ili postavljanje WAF pravila je distraktor. Pazi na zamku: listener napravljen kroz IaC bez `SslPolicy` dobija staru `ELBSecurityPolicy-2016-08`.

### CloudFront

| Podešavanje | Opcije | Napomena |
|---|---|---|
| **Viewer protocol policy** | HTTP and HTTPS / **Redirect HTTP to HTTPS** / **HTTPS only** | Između klijenta i edge lokacije |
| **Security policy** (viewer) | npr. `TLSv1.2_2021` | Minimalna TLS verzija i šifre za klijente |
| **Origin protocol policy** | HTTP only / **HTTPS only** / Match viewer | Između CloudFronta i origina |
| Origin SSL protocols | TLS verzije prema originu | Origin certifikat mora biti od trusted CA i odgovarati imenu origina |
| Certifikat za vlastiti domen | ACM certifikat u **us-east-1** | Za ALB certifikat mora biti u regionu ALB-a |

Za S3 origin koristi **Origin Access Control (OAC)** (bucket politika dozvoljava samo `cloudfront.amazonaws.com` uz `aws:SourceArn` distribucije). **Field-level encryption** šifruje pojedinačna polja forme (npr. broj kartice) javnim ključem na edgeu, pa ih dalje kroz sistem vidi samo servis sa privatnim ključem.

### aws:SecureTransport u bucket politici

S3 prihvata i HTTP. Da forsiraš TLS, dodaj Deny kad je `aws:SecureTransport` `false`; uz to možeš zahtijevati minimalnu TLS verziju ključem `s3:TlsVersion`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyHttp",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-records", "arn:aws:s3:::acme-records/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "DenyOldTls",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-records", "arn:aws:s3:::acme-records/*"],
      "Condition": { "NumericLessThan": { "s3:TlsVersion": "1.2" } }
    }
  ]
}
```

AWS Config pravilo `s3-bucket-ssl-requests-only` provjerava da li bucket politika ima ovakav Deny. Za RDS koristi parametar grupu (`rds.force_ssl`, `require_secure_transport` za MySQL), za ElastiCache in-transit encryption pri kreiranju.

### Privatan pristup: endpointi, PrivateLink, VPN, Verified Access

| | **Gateway endpoint** | **Interface endpoint** (PrivateLink) |
|---|---|---|
| Servisi | Samo **S3** i **DynamoDB** | Većina AWS servisa, SaaS i tvoji servisi |
| Kako radi | Ruta (prefix list) u route tabeli | ENI sa privatnom IP u subnetu, privatni DNS |
| Security group | Ne | Da |
| Dostupan sa on-prem / iz peered VPC | **Ne** | **Da** (preko VPN/DX/TGW) |
| Cijena | Bez naknade | Po satu i po GB |
| Endpoint policy | Da | Da (većina servisa) |

**Endpoint policy** ograničava šta se smije raditi **kroz** endpoint (npr. samo buckete tvoje organizacije, sprečava eksfiltraciju u tuđi bucket):

```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
    "Resource": "*",
    "Condition": { "StringEquals": { "aws:ResourceOrgID": "o-a1b2c3d4e5" } }
  }]
}
```

Bucket politika sa uslovom `aws:SourceVpce` (modul 07) je druga strana iste priče: endpoint politika kaže „kroz ovaj endpoint samo do naših resursa“, a bucket politika „ovaj bucket samo kroz naš endpoint“.

**AWS PrivateLink** za vlastite servise: provider pravi **endpoint service** iza **Network Load Balancera** (ili GWLB), consumer pravi interface endpoint. Saobraćaj je jednosmjeran (consumer → provider), ne izlaže cijelu VPC, radi i sa preklapajućim CIDR-ovima, provider ručno ili automatski prihvata konekcije.

**AWS Client VPN**: managed OpenVPN-bazirani VPN za korisnike. Autentikacija: mutual certifikati, Active Directory, SAML federacija (npr. Okta/Entra ID uz MFA). **Authorization rules** po grupi određuju koje mreže korisnik vidi, a security group na endpointu dodatno filtrira. Split-tunnel šalje kroz VPN samo saobraćaj za AWS mreže. Saobraćaj je šifrovan TLS-om.

**AWS Verified Access**: zero trust pristup aplikacijama **bez VPN-a**. Svaki zahtjev se ocjenjuje na osnovu identiteta (IAM Identity Center ili OIDC trust provider) i stanja uređaja (device trust provider, npr. Jamf, CrowdStrike, JumpCloud) prema **Cedar** politikama. Podržava HTTP(S) aplikacije, a od 2025. i ne-HTTP resurse (TCP, SSH, RDP) preko Connectivity Clienta. Svaki pokušaj pristupa se loguje.

> **Na ispitu:** „Zaposleni moraju pristupati internoj web aplikaciji bez VPN-a, samo sa korporativnih uređaja i uz provjeru identiteta pri svakom zahtjevu“ = **Verified Access**. „Udaljeni administratori trebaju mrežni pristup cijelom privatnom subnetu“ = **Client VPN**. „Aplikacija u privatnom subnetu treba S3 bez NAT-a, uz najmanje troškova“ = **gateway endpoint**. „On-prem server treba privatan pristup S3“ = **interface endpoint** za S3.

### Enkripcija između čvorova (inter-node)

| Servis | Kako se uključuje |
|---|---|
| **Amazon EMR** | **Security configuration** sa in-transit enkripcijom: TLS certifikati (PEM arhiva u S3 ili custom certificate provider). Šifruje saobraćaj između čvorova (npr. shuffle, RPC) i prema S3 (TLS). Ista konfiguracija definiše i at-rest (S3, lokalni diskovi, EBS). |
| **Amazon EKS** | **Kubernetes API podaci (uključujući Secrets)**: podrazumijevana **envelope encryption** sa KMS v2 na verzijama 1.28+, AWS owned ključ ili tvoj customer managed KMS ključ. **Pod-to-pod**: VPC CNI sam ne šifruje; opcije su Nitro instance tipovi sa automatskom enkripcijom, **service mesh sa mTLS** (npr. Istio) ili WireGuard enkripcija u CNI-ju (Cilium, Calico). |
| **SageMaker AI** | **Inter-container traffic encryption** (`EnableInterContainerTrafficEncryption`) za distribuirani training; uz to `EnableNetworkIsolation`, VPC i KMS za volumene i izlaz. Enkripcija može produžiti trajanje treninga. |
| **Nitro** | Određeni instance tipovi (npr. C6i, M6i, R6i, C7g, M7i i noviji) automatski šifruju saobraćaj između instanci (AEAD, 256-bit) bez uticaja na performanse, ako su u istom regionu, u istoj ili peered VPC-i i saobraćaj ne prolazi kroz virtuelni uređaj (load balancer, transit gateway). |

Dodatno: sav saobraćaj između AZ-ova i regiona AWS šifruje na fizičkom sloju, a cross-Region VPC peering i TGW peering saobraćaj se šifruje pri izlasku iz regiona.

```bash
# Koji instance tipovi podržavaju Nitro enkripciju u prenosu
aws ec2 describe-instance-types \
  --filters Name=network-info.encryption-in-transit-supported,Values=true \
  --query "InstanceTypes[*].InstanceType" --output text
```

> **Na ispitu:** „HPC klaster mora šifrovati saobraćaj između instanci bez uticaja na performanse i bez izmjene aplikacije“ = **Nitro instance tipovi** sa podrškom za encryption in transit, u istoj VPC-i, bez load balancera između. „Distribuirani SageMaker training mora šifrovati saobraćaj između kontejnera“ = **inter-container traffic encryption**.

## 5.2 Podaci u mirovanju

### KMS vs CloudHSM vs custom key store

| | **AWS KMS** | **KMS + CloudHSM key store** | **KMS + external key store (XKS)** | **AWS CloudHSM** (direktno) |
|---|---|---|---|---|
| Ko upravlja HSM-om | AWS (multi-tenant, FIPS 140-3 Level 3 validirani HSM-ovi) | Ti (tvoj CloudHSM klaster) | Ti (HSM van AWS-a) | Ti (single-tenant klaster) |
| Integracija sa AWS servisima | Potpuna | Potpuna (kroz KMS) | Potpuna (kroz KMS) | Nema direktne; aplikacija koristi PKCS#11, JCE, OpenSSL |
| Ko ima kontrolu nad ključem | AWS čuva materijal, ti kontrolišeš politike | Materijal u tvom HSM-u | Materijal nikad ne ulazi u AWS | Samo ti (AWS nema pristup) |
| Tipičan razlog | Podrazumijevani izbor | Regulativa traži single-tenant HSM, a želiš KMS integraciju | Regulativa traži ključ van clouda | Vlastita kriptografija, SSL offload, Oracle TDE, asimetrični ključevi pod punom kontrolom |
| Operativni napor | Najmanji | Srednji | Najveći | Visok |

### Tipovi enkripcije za S3

| Tip | Ključ | Kad |
|---|---|---|
| **SSE-S3** | S3 managed ključevi | Podrazumijevano za sve nove objekte od 2023. |
| **SSE-KMS** | KMS ključ (AWS managed `aws/s3` ili customer managed) | Kontrola pristupa ključu, audit u CloudTrailu, odvajanje dužnosti |
| **DSSE-KMS** | KMS, dva sloja enkripcije | Regulativa koja traži dvoslojnu enkripciju |
| **SSE-C** | Ključ šalje klijent u svakom zahtjevu (samo HTTPS) | Rijetko. Od aprila 2026. **blokiran podrazumijevano** za nove buckete; mora se eksplicitno dozvoliti (`BlockedEncryptionTypes`) |
| **Client-side** | Ključ kod klijenta (AWS Encryption SDK, Amazon S3 Encryption Client, KMS ili vlastiti) | Podaci ne smiju biti nešifrovani ni na strani AWS-a |

**S3 Bucket Keys**: S3 pravi kratkotrajni ključ na nivou bucketa iz KMS ključa, pa drastično smanjuje broj KMS poziva (trošak i throttling). Posljedica: u CloudTrailu encryption context je ARN bucketa, ne objekta. Bucket Keys ne rade sa DSSE-KMS.

Forsiranje određenog ključa za upload:

```json
{
  "Sid": "DenyWrongKey",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::acme-records/*",
  "Condition": {
    "StringNotEqualsIfExists": {
      "s3:x-amz-server-side-encryption-aws-kms-key-id": "arn:aws:kms:eu-central-1:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab"
    }
  }
}
```

Jednostavnije je postaviti **default encryption** bucketa na SSE-KMS sa tim ključem; Deny politika dodatno sprečava da klijent eksplicitno zatraži drugi ključ. Za SSE-KMS upload treba `kms:GenerateDataKey`, a za download `kms:Decrypt` na ključu.

### EBS, RDS i ostali servisi

- **EBS encryption by default** se uključuje **po regionu** (`aws ec2 enable-ebs-encryption-by-default`); sve nove EBS jedinice i snapshoti se šifruju, uz izbor podrazumijevanog KMS ključa.
- Postojeći nešifrovani volumen: snapshot → **copy snapshot sa enkripcijom** → novi volumen iz šifrovanog snapshota.
- **RDS**: enkripcija se bira pri kreiranju i ne može se isključiti. Nešifrovanu bazu šifruješ: snapshot → copy sa KMS ključem → restore. Read replica u istom regionu koristi istu enkripciju.
- Dijeljenje šifrovanog snapshota sa drugim nalogom traži **customer managed** ključ (AWS managed ključ se ne može dijeliti) i dozvolu za taj nalog u key policy.
- **EFS** i **DynamoDB**, **SQS**, **SNS**: enkripcija sa KMS ključem; EFS enkripcija at rest se bira pri kreiranju file systema.

> **Na ispitu:** „Svi novi EBS volumeni u nalogu moraju biti šifrovani, uz najmanje napora“ = **EBS encryption by default** u svakom regionu (i SCP/Config za kontrolu). „Šifrovati postojeću RDS bazu“ = **snapshot → encrypted copy → restore**, ne postoji prekidač na živoj instanci. „Regulativa traži single-tenant HSM pod kontrolom kompanije, a podaci su u S3 i EBS“ = **KMS custom key store sa CloudHSM**.

### Integritet podataka

**S3 Versioning**: svaka izmjena pravi novu verziju, brisanje stavlja **delete marker**. Štiti od slučajnog prepisivanja, ali ne od namjernog brisanja verzija.

**MFA Delete**: za trajno brisanje verzije ili promjenu versioning stanja traži MFA. Može ga uključiti samo **root** korisnik, preko CLI/API-ja.

**S3 Object Lock** (WORM, zahtijeva versioning; može se uključiti i na postojećem bucketu):

| | **Governance mode** | **Compliance mode** | **Legal hold** |
|---|---|---|---|
| Ko može skratiti/ukloniti zaštitu | Korisnik sa `s3:BypassGovernanceRetention` i headerom `x-amz-bypass-governance-retention` | **Niko**, ni root, do isteka retencije | Korisnik sa `s3:PutObjectLegalHold` |
| Trajanje | Retention period | Retention period (može se samo produžiti) | Bez roka, dok se ne skine |
| Upotreba | Zaštita od većine korisnika, uz izuzetke; testiranje | Regulativa (SEC 17a-4, FINRA) | Sudski spor, istraga |

```bash
aws s3api put-object-lock-configuration --bucket acme-audit \
  --object-lock-configuration '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Years":7}}}'
```

**Glacier Vault Lock**: politika na vaultu originalnog (vault-based) Amazon Glacier servisa. `InitiateVaultLock` pokreće 24 sata za testiranje, `CompleteVaultLock` je čini nepromjenjivom. Vault-based Glacier više ne prima nove korisnike; za nova rješenja AWS preporučuje **S3 Glacier storage klase** u bucketu sa **Object Lock**-om.

**Code signing**:

- **AWS Signer** pravi **signing profile**; Lambda **code signing configuration** navodi dozvoljene profile i akciju za nepotpisan ili izmijenjen kod: **Warn** (deploy prolazi, CloudWatch metrika) ili **Enforce** (deploy se odbija). Provjerava se integritet, istek i opoziv potpisa.
- Container image se potpisuje Signerom (Notation), a provjera se radi u klasteru (npr. admission controller).

**Validacija fajlova**:

- **CloudTrail log file integrity validation**: digest fajlovi sa SHA-256 hashevima, potpisani svakog sata. `aws cloudtrail validate-logs --trail-arn ... --start-time ...` otkriva izmijenjene ili obrisane logove.
- **S3 checksums** (CRC32, CRC32C, CRC64NVME, SHA-1, SHA-256) pri uploadu; S3 provjerava integritet i čuva checksum uz objekat.
- **DataSync** verifikuje integritet podataka tokom i nakon prenosa.

> **Na ispitu:** „Logovi moraju biti nepromjenjivi 7 godina i niko, uključujući root, ne smije ih obrisati“ = **Object Lock compliance mode**. „Zaštita od brisanja, ali security tim mora moći izuzetno obrisati objekat“ = **governance mode**. „Čuvati objekte dok traje sudski spor, bez poznatog roka“ = **legal hold**. „Dokazati da CloudTrail logovi nisu mijenjani“ = **log file integrity validation**.

### Lifecycle i retencija

**S3 Lifecycle** pravila po prefiksu ili tagu:

- **Transition** u jeftinije klase (Standard-IA, Glacier Instant/Flexible Retrieval, Deep Archive) nakon N dana,
- **Expiration** trenutnih verzija, **NoncurrentVersionExpiration** za stare verzije, brisanje nedovršenih multipart uploada i suvišnih delete markera.

Lifecycle ne može obrisati objekat zaštićen Object Lockom prije isteka retencije. Kombinacija: Object Lock čuva minimalni rok, lifecycle briše nakon njega.

```json
{
  "Rules": [{
    "ID": "logs-retention",
    "Filter": { "Prefix": "logs/" },
    "Status": "Enabled",
    "Transitions": [{ "Days": 30, "StorageClass": "STANDARD_IA" }, { "Days": 180, "StorageClass": "DEEP_ARCHIVE" }],
    "Expiration": { "Days": 2555 },
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
  }]
}
```

**EFS Lifecycle management**: fajlovi koji se ne koriste prelaze u **Infrequent Access** i **Archive** klasu nakon zadatog broja dana, a opcionalno se vraćaju u Standard pri prvom pristupu.

**FSx for Lustre backup**: automatski dnevni backup sa retencijom **0–90 dana** (0 isključuje) i user-initiated backupi koji ne ističu. Backup je podržan samo na **persistent** file sistemima koji **nisu povezani sa S3 data repositoryjem**; scratch file sistemi nemaju backup. AWS Backup daje duže retencije, raspored i cross-region/cross-account kopije.

### Backup, replikacija i ransomware

**AWS Backup** centralizuje backup za EC2, EBS, RDS/Aurora, DynamoDB, EFS, FSx, S3 i druge servise:

- **Backup plan** (raspored, retencija, lifecycle u cold storage) + **resource assignment** po tagu.
- **Backup vault** šifrovan KMS ključem, sa **vault access policy** (npr. Deny `backup:DeleteRecoveryPoint`).
- **Cross-Region i cross-account copy** (unutar organizacije) u izolovan backup nalog.
- **Backup policies** u Organizations za centralno nametanje planova.
- **AWS Backup Audit Manager** za izvještaje usklađenosti, **restore testing** za automatsku provjeru oporavka.

**AWS Backup Vault Lock**:

| | Governance | Compliance |
|---|---|---|
| Uklanjanje locka | Korisnik sa dovoljnim IAM dozvolama | Samo tokom **grace time** (najmanje 3 dana); nakon toga niko, ni AWS |
| Brisanje recovery pointa prije isteka | Nije dozvoljeno ni root-u | Nije dozvoljeno ni root-u |
| Min/max retencija | Opcionalno | Opcionalno |

**Logically air-gapped vault**: poseban tip vaulta, **uvijek zaključan u compliance modu**, šifrovan AWS owned ili customer managed ključem, backupi se čuvaju u nalogu kojim upravlja AWS Backup. Dijeli se sa drugim nalozima (i drugim organizacijama) preko **AWS RAM**-a, pa se oporavak može uraditi iz čistog naloga; uz **multi-party approval** moguć je oporavak i kad je vlasnički nalog nedostupan.

**Amazon Data Lifecycle Manager (DLM)**: automatski EBS snapshoti i EBS-backed AMI-ji po tagu, retencija, **cross-Region copy**, **cross-account sharing**, fast snapshot restore, arhiviranje snapshota. Jednostavnije od AWS Backup-a kad su u pitanju samo EBS/AMI.

**Recycle Bin** zadržava obrisane EBS snapshote i AMI-je određeni period (retention rule, koje se mogu zaključati), pa se slučajno ili zlonamjerno brisanje može poništiti.

**AWS DataSync**: online prenos podataka između on-prem storagea (NFS, SMB, HDFS, object storage), drugih cloudova i AWS-a (S3, EFS, FSx). Agent, TLS u prenosu, verifikacija integriteta, rasporedi, IAM uloga za pristup S3, može kroz VPC interface endpoint.

### Ransomware zaštita: slojevi

1. **Spriječi brisanje**: Object Lock (compliance), Backup Vault Lock, SCP koji zabranjuje `backup:DeleteRecoveryPoint`, `s3:PutBucketVersioning` i `kms:ScheduleKeyDeletion` osim break-glass ulozi.
2. **Izoluj kopije**: cross-account copy u poseban backup nalog ili logically air-gapped vault, sa drugim administratorima.
3. **Ključevi**: ako napadač zakaže brisanje KMS ključa, svi backupi postaju nečitljivi. Zaštiti key policy i prati `ScheduleKeyDeletion` (EventBridge alarm).
4. **Detekcija**: GuardDuty (uključujući Malware Protection za S3 i AWS Backup), alarmi na masovno brisanje/šifrovanje.
5. **Testiraj oporavak**: restore testing u AWS Backup.

> **Na ispitu:** „Backupi moraju preživjeti kompromitaciju produkcijskog naloga, uključujući root pristup napadača“ = **cross-account kopija u backup nalog sa Vault Lock u compliance modu** ili **logically air-gapped vault**. Sam versioning ili backup u istom nalogu nije dovoljan.

## Rezime

- TLS forsiraš **security policy** na ALB/NLB listeneru, viewer/origin protocol policy na **CloudFrontu** (ACM certifikat u us-east-1) i **`aws:SecureTransport`** Deny u bucket politici.
- **Gateway endpoint** (S3, DynamoDB, besplatan, ne radi sa on-prem) vs **interface endpoint** (PrivateLink, ENI, SG, radi sa on-prem); **endpoint politika** + **`aws:SourceVpce`** zatvaraju perimetar.
- **Client VPN** = mrežni pristup; **Verified Access** = zero trust pristup aplikaciji po zahtjevu (identitet + uređaj, Cedar), bez VPN-a.
- Inter-node: **EMR security configuration**, **EKS envelope encryption** (podrazumijevano 1.28+) + mTLS/WireGuard za pod-to-pod, **SageMaker inter-container encryption**, **Nitro** automatska enkripcija između podržanih instanci.
- **KMS** je podrazumijevani izbor; **CloudHSM** (ili KMS custom key store) za single-tenant kontrolu; **XKS** za ključ van AWS-a. S3: SSE-S3, SSE-KMS (+ Bucket Keys), DSSE-KMS, SSE-C (blokiran podrazumijevano), client-side.
- Integritet: **Object Lock** (governance / compliance / legal hold), **Glacier Vault Lock**, **MFA Delete**, **Lambda code signing** (Warn/Enforce), **CloudTrail log validation**.
- Retencija i backup: **S3 Lifecycle**, **EFS Lifecycle**, **FSx for Lustre** backup (persistent, 0–90 dana), **AWS Backup** sa **Vault Lock**, cross-account kopijama i **logically air-gapped vaultom**, **DLM** za EBS, **DataSync** za siguran prenos.
