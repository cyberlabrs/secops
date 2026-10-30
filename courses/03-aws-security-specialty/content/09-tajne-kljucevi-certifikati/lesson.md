## Cilj ispita: 5.3

Ovaj modul pokriva zadatak **5.3** iz domena 5 (**Data Protection**, 18% ispita): dizajn i implementacija kontrola koje štite povjerljive podatke, kredencijale, tajne i kriptografski materijal ključeva. Vještine koje ispit provjerava:

- **5.3.1** upravljanje tajnama i njihova rotacija (AWS Secrets Manager),
- **5.3.2** rad sa uvezenim materijalom ključa (imported key material) i external key store,
- **5.3.3** razlike između uvezenog i AWS-generisanog materijala ključa,
- **5.3.4** maskiranje osjetljivih podataka (CloudWatch Logs data protection policies, SNS message data protection),
- **5.3.5** kreiranje i upravljanje ključevima i certifikatima u jednom ili više regiona (customer managed KMS keys, AWS Private CA).

Tipično pitanje izgleda ovako: „Kompanija mora rotirati lozinku baze svakih 30 dana bez prekida rada aplikacije“ ili „regulator traži da ključ bude generisan van AWS-a i da ga kompanija može odmah učiniti neupotrebljivim“. Ključ je prepoznati **koji servis** i **koju opciju** tog servisa pitanje zapravo traži, i izabrati rješenje sa najmanje vlastitog koda.

## 5.3.1 AWS Secrets Manager

**AWS Secrets Manager** čuva tajne (lozinke baza, API ključeve, OAuth tokene) šifrovane KMS ključem i nudi **ugrađenu rotaciju**, verzionisanje, resource policy i replikaciju u druge regione. Aplikacija tajnu dohvata u runtime-u (`GetSecretValue`), umjesto da je drži u kodu, env varijabli ili Terraform state-u.

```bash
aws secretsmanager create-secret --name prod/orders/db \
  --kms-key-id alias/secrets-prod \
  --secret-string '{"username":"orders_app","password":"...","host":"orders.cluster-x.eu-central-1.rds.amazonaws.com"}'

aws secretsmanager get-secret-value --secret-id prod/orders/db --query SecretString
```

### Verzije i staging labele

Svaka tajna ima više verzija, a labele kažu koja je koja:

| Labela | Značenje |
|---|---|
| `AWSCURRENT` | Trenutna vrijednost; nju dobija `GetSecretValue` bez dodatnih parametara. |
| `AWSPENDING` | Nova vrijednost tokom rotacije, još nije potvrđena. |
| `AWSPREVIOUS` | Prethodna vrijednost; korisna za rollback i za klijente koji još drže stari keš. |

### Rotacija: Lambda funkcija ili managed rotation

**Rotation by Lambda function**: Secrets Manager poziva Lambda funkciju u četiri koraka: `createSecret` (generiši novu vrijednost kao `AWSPENDING`), `setSecret` (postavi je u bazi ili servisu), `testSecret` (provjeri da radi), `finishSecret` (prebaci `AWSCURRENT` na novu verziju). AWS nudi gotove šablone funkcija za RDS, Aurora, Redshift, DocumentDB i druge; za proizvoljni API ključ pišeš svoju funkciju.

Lambda za rotaciju mora imati **mrežni pristup** i bazi i Secrets Manager API-ju. Ako je u privatnom subnetu bez NAT-a, treba joj **interface VPC endpoint** za Secrets Manager. Ovo je čest uzrok greške „rotation failed“ u pitanjima.

**Managed rotation**: neki servisi sami upravljaju tajnom i njenom rotacijom, bez Lambda funkcije koju ti održavaš. Primjeri: master lozinka za **Amazon RDS** i **Aurora** (`--manage-master-user-password`), Amazon Redshift admin lozinka, Amazon DocumentDB master korisnik.

```bash
aws rds modify-db-instance --db-instance-identifier orders \
  --manage-master-user-password \
  --master-user-secret-kms-key-id alias/secrets-prod --apply-immediately
```

Raspored rotacije zadaje se kao broj dana ili `rate()`/`cron()` izraz; najčešće je moguće rotirati svaka četiri sata.

### Single user vs alternating users

| Strategija | Kako radi | Kada |
|---|---|---|
| **Single user** | Mijenja se lozinka istog korisnika baze. | Jednostavno; kratko vrijeme u kojem stari keš klijenta ne radi. Dobro za aplikacije sa retry logikom. |
| **Alternating users** | Postoje dva korisnika sa istim pravima (npr. `app` i `app_clone`); rotacija mijenja lozinku neaktivnog i onda ga proglasi trenutnim. | Visoka dostupnost: prethodni kredencijali i dalje rade do sljedeće rotacije. Treba **posebna superuser tajna** sa pravom da mijenja korisnike. |

> **Na ispitu:** „rotirati lozinku bez ikakvog prekida konekcija“ ili „aplikacija kešira kredencijale“ = **alternating users**. „Rotirati master lozinku RDS-a uz NAJMANJE operativnog napora“ = **managed rotation** (RDS upravlja tajnom u Secrets Manageru), a ne vlastita Lambda funkcija. Ako rotacija pada i Lambda je u privatnom subnetu, odgovor je VPC endpoint ili NAT, a ne veći timeout.

### Resource policy i cross-account pristup

Za pristup tajni iz drugog naloga trebaju **tri** stvari:

1. **Resource policy** na tajni koja dozvoljava principal iz naloga B (`secretsmanager:GetSecretValue`).
2. **Identity policy** u nalogu B koja dozvoljava isti poziv na ARN tajne.
3. Tajna mora biti šifrovana **customer managed KMS ključem** čiji key policy dozvoljava nalogu B `kms:Decrypt`. Tajna šifrovana AWS managed ključem `aws/secretsmanager` **ne može** se koristiti cross-account, jer njegov key policy ne možeš mijenjati.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::222222222222:role/orders-app"},
    "Action": "secretsmanager:GetSecretValue",
    "Resource": "*"
  }]
}
```

Resource policy se može provjeriti prije snimanja: `aws secretsmanager validate-resource-policy`, a opcija `--block-public-policy` odbija politiku koja bi tajnu otvorila široko.

### Replikacija u druge regione

Secrets Manager može **replicirati tajnu** u druge regione (`replicate-secret-to-regions`). Replika ima isti naziv, vrijednost se sinhronizuje sa primarne, a rotacija se konfiguriše samo na primarnoj. Svaka replika se šifruje KMS ključem iz svog regiona (možeš zadati ključ po regionu). Koristi se za DR i multi-Region aplikacije.

### Parameter Store SecureString

**AWS Systems Manager Parameter Store** čuva konfiguraciju; tip **SecureString** šifruje vrijednost KMS ključem.

| | Secrets Manager | Parameter Store SecureString |
|---|---|---|
| Ugrađena rotacija | Da (Lambda ili managed) | Ne; rotaciju pravite sami |
| Resource policy na tajni | Da | Ne (pristup preko IAM-a; advanced parametri se mogu dijeliti kroz RAM) |
| Replikacija u regione | Da | Ne |
| Generisanje nasumične lozinke | Da (`get-random-password`) | Ne |
| Hijerarhija i konfiguracija | Ograničeno | Odlično (`/app/prod/...`, `GetParametersByPath`) |
| Cijena | Plaća se po tajni i API pozivima | Standard tier bez posebne naknade za čuvanje |

> **Na ispitu:** ako pitanje traži **automatsku rotaciju**, **cross-account** pristup ili **replikaciju**, odgovor je Secrets Manager. Ako traži „najjeftinije čuvanje konfiguracije i nekoliko šifrovanih vrijednosti bez rotacije“, odgovor je Parameter Store SecureString.

## 5.3.5 AWS KMS: tipovi ključeva i kontrola pristupa

### Ko posjeduje ključ

| Tip | Ko upravlja | Key policy | Rotacija | Vidljiv u nalogu |
|---|---|---|---|---|
| **Customer managed key** | Ti | Ti je pišeš | Opciona automatska (period 90–2560 dana, default 365) i on-demand | Da, plaćaš ga |
| **AWS managed key** (`aws/s3`, `aws/ebs`…) | AWS servis u tvoje ime | Ne možeš je mijenjati | Automatski svake godine | Da |
| **AWS owned key** | AWS servis, dijeli se među nalozima | Ne vidiš je | Određuje servis | Ne |

Customer managed ključ biraš kad trebaš: kontrolu nad key policy (npr. cross-account), vlastiti raspored rotacije, mogućnost onemogućavanja ili brisanja ključa, imported material ili custom key store.

### Key policy, IAM politike i grants

Svaki KMS ključ **mora** imati key policy. IAM politike za KMS djeluju **samo ako key policy to dozvoli**, obično izjavom koja daje pristup root principalu naloga:

```json
{
  "Sid": "EnableIAMPolicies",
  "Effect": "Allow",
  "Principal": {"AWS": "arn:aws:iam::111111111111:root"},
  "Action": "kms:*",
  "Resource": "*"
}
```

Bez te izjave čak ni administrator naloga ne može koristiti ključ kroz IAM politiku. Pristup tada dolazi samo od principala eksplicitno navedenih u key policy.

**Grants** su privremena, programska delegacija prava na ključ (npr. EBS daje EC2 pravo da dešifruje volumen dok je zakačen). Kreiraju se sa `CreateGrant`, povlače sa `RetireGrant`/`RevokeGrant` i ne mijenjaju key policy. Dobri su za kratkotrajna, uska prava koja daju servisi.

Cross-account upotreba ključa: key policy u nalogu A dozvoljava nalog B, **i** IAM politika u nalogu B dozvoljava principalu taj ključ. Oba moraju reći „da“.

### Uslovi: encryption context i kms:ViaService

**Encryption context** je skup ključ-vrijednost parova koji se kriptografski vezuje za ciphertext (kao AAD): za dešifrovanje mora se poslati isti kontekst. Ne šifruje se i vidi se u CloudTrail logu, pa ne stavljaj tajne u njega. Koristan je za uslove u politici:

```json
{
  "Effect": "Allow",
  "Principal": {"AWS": "arn:aws:iam::111111111111:role/orders-app"},
  "Action": "kms:Decrypt",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "secretsmanager.eu-central-1.amazonaws.com",
      "kms:EncryptionContext:SecretARN": "arn:aws:secretsmanager:eu-central-1:111111111111:secret:prod/orders/db-AbCdEf"
    }
  }
}
```

Ova izjava u key policy dozvoljava roli da dešifruje **samo** kroz Secrets Manager i **samo** za jednu tajnu (Secrets Manager kao encryption context šalje ARN tajne).

**`kms:ViaService`** ograničava upotrebu ključa samo na zahtjeve koje u ime principala šalje određeni AWS servis. Tako rola može dešifrovati S3 objekte, ali ne može direktno pozvati `kms:Decrypt` iz CLI-ja nad istim ključem.

> **Na ispitu:** „ključ smije koristiti samo RDS, a ne korisnici direktno“ = `kms:ViaService`. „Ciphertext jednog tenanta ne smije se dešifrovati u kontekstu drugog“ = **encryption context** uslov. „Dati EC2/Auto Scaling privremeno pravo na ključ“ = **grant**. AWS managed ključ nikad nije odgovor kad treba cross-account pristup ili prilagođen key policy.

### Rotacija KMS ključeva

- **Automatic rotation**: samo za simetrične customer managed ključeve sa materijalom koji generiše KMS (origin `AWS_KMS`). Key ID i ARN ostaju isti; stari materijal se čuva zauvijek da bi se stari ciphertext mogao dešifrovati. Podaci se **ne** re-šifruju.
- **On-demand rotation** (`rotate-key-on-demand`): odmah rotira materijal, nezavisno od automatskog rasporeda. Radi za simetrične ključeve sa `AWS_KMS` i sa `EXTERNAL` (imported) materijalom. Broj on-demand rotacija po ključu je ograničen.
- **Manual rotation**: napraviš novi ključ i prebaciš **alias** na njega. Jedina opcija za asimetrične i HMAC ključeve i ključeve u custom key store.

```bash
aws kms enable-key-rotation --key-id alias/app-data --rotation-period-in-days 180
aws kms rotate-key-on-demand --key-id alias/app-data
aws kms list-key-rotations --key-id alias/app-data
```

### Brisanje ključa i waiting period

Ključ se ne briše odmah: `ScheduleKeyDeletion` uvodi **waiting period od 7 do 30 dana** (default 30). U tom periodu ključ je u stanju *Pending deletion*, ne može se koristiti i brisanje se može otkazati. Nakon brisanja svi podaci šifrovani njime su trajno nedostupni. Dobra praksa: prvo **disable** ključ, prati CloudTrail i CloudWatch alarm na pokušaje upotrebe (greške zbog stanja ključa), pa tek onda zakaži brisanje. Pravo `kms:ScheduleKeyDeletion` drži uskim i čuvaj SCP-om.

### Multi-Region keys

**Multi-Region key** je skup povezanih ključeva u različitim regionima sa **istim key ID-jem (prefiks `mrk-`) i istim materijalom**. Ciphertext iz jednog regiona može se dešifrovati u drugom bez poziva prema drugom regionu. Postoji jedan **primary** i jedna ili više **replica** ključeva; svaka ima **vlastiti key policy**, grants i alias. Rotacija se uključuje na primarnom i prenosi na replike.

Koristi ih za: globalne DynamoDB tabele sa client-side enkripcijom, DR gdje se šifrovani podaci kopiraju između regiona, potpise koji se provjeravaju u više regiona. Ne koristi ih „za svaki slučaj“: regulativa o lokaciji podataka često traži da ključ ostane u jednom regionu.

> **Na ispitu:** „podaci šifrovani u us-east-1 moraju se dešifrovati u eu-west-1 i nakon gubitka primarnog regiona, bez re-šifrovanja“ = **multi-Region key** (replica). Single-Region ključ se ne može kopirati u drugi region.

## 5.3.2 i 5.3.3 Imported key material (BYOK)

Sa **imported key material** kreiraš KMS ključ bez materijala (`--origin EXTERNAL`), preuzmeš javni wrapping ključ i import token, šifruješ svoj materijal i uvezeš ga.

```bash
aws kms create-key --origin EXTERNAL --description "BYOK payments"
aws kms get-parameters-for-import --key-id <id> \
  --wrapping-algorithm RSAES_OAEP_SHA_256 --wrapping-key-spec RSA_4096
# materijal se šifruje javnim wrapping ključem lokalno (npr. openssl)
aws kms import-key-material --key-id <id> \
  --encrypted-key-material fileb://material.enc --import-token fileb://token.bin \
  --expiration-model KEY_MATERIAL_EXPIRES --valid-to 2027-06-30T00:00:00Z
```

### Razlike u odnosu na AWS-generisan materijal

| Osobina | AWS-generated (`AWS_KMS`) | Imported (`EXTERNAL`) |
|---|---|---|
| Ko generiše materijal | KMS u svojim HSM-ovima | Ti, u svom sistemu (npr. on-prem HSM) |
| Trajnost | Odgovornost AWS-a | **Ti** čuvaš original; KMS ima kopiju |
| Expiry | Nema | Možeš zadati datum isteka (`KEY_MATERIAL_EXPIRES`) |
| Trenutno uklanjanje | Samo disable ili brisanje uz 7–30 dana čekanja | `DeleteImportedKeyMaterial` odmah, ključ ide u *Pending import* |
| Ponovno vraćanje | Nema (nakon brisanja ključa) | Ponovni import **istog** materijala vraća ključ u upotrebu |
| Automatska rotacija | Da | **Ne**; samo on-demand nakon uvoza novog materijala, ili ručno (novi ključ + alias) |
| Custom key store | Moguće | Nije podržano |
| Tipovi ključeva | Svi | Simetrični, asimetrični, HMAC, multi-Region |

Kada materijal istekne ili ga obrišeš, ključ se ne može koristiti, ali resursi koji su već keširali **data key** (npr. zakačen EBS volumen) mogu raditi dok se ključ ponovo ne zatraži. Za istek postoji CloudWatch metrika, pa se lako napravi alarm prije isteka.

> **Na ispitu:** „ključ mora biti generisan u našem on-prem HSM-u, a kompanija mora moći **odmah** učiniti ključ neupotrebljivim i kasnije ga vratiti“ = **imported key material** + `DeleteImportedKeyMaterial`. „Ključni materijal **nikad** ne smije biti u AWS-u, operacije se izvode van AWS-a“ = **external key store (XKS)**. Ne miješaj BYOK (kopija materijala je u KMS-u) i HYOK (materijal ostaje kod tebe).

## Custom key stores: CloudHSM i XKS

| | Standardni KMS | **AWS CloudHSM key store** | **External key store (XKS)** |
|---|---|---|---|
| Gdje je materijal | KMS HSM-ovi (FIPS 140-3 Level 3) | Tvoj CloudHSM klaster u VPC-u (single-tenant) | Tvoj eksterni key manager van AWS-a |
| Ko održava dostupnost | AWS | Ti (klaster mora imati barem dva aktivna HSM-a u različitim AZ) | Ti (proxy, mreža, key manager) |
| Veza sa KMS-om | Interno | KMS koristi kripto korisnika `kmsuser` u klasteru | KMS zove tvoj **XKS proxy** (javni endpoint ili VPC endpoint service) |
| Tipovi ključeva | Svi | Samo simetrični | Samo simetrični |
| Automatska rotacija, imported material, multi-Region | Da | Ne | Ne |
| Tipičan razlog | Većina slučajeva | Zahtjev za single-tenant HSM pod tvojom kontrolom | Regulativa: ključ mora ostati van AWS-a (HYOK, suverenitet podataka) |

XKS koristi **double encryption**: KMS prvo šifruje vlastitim materijalom ključa, pa tvoj eksterni ključ šifruje rezultat. Ako isključiš proxy ili key manager, AWS gubi pristup svim podacima zaštićenim tim ključem (osim kratko keširanih data ključeva). To je moćna kontrola, ali i rizik po dostupnost i latenciju.

Direktan **AWS CloudHSM** (bez KMS-a) biraš kad aplikacija treba standardne interfejse (PKCS#11, JCE, OpenSSL), npr. za TLS offload ili potpisivanje, i kad nije potrebna integracija sa AWS servisima.

> **Na ispitu:** „AWS servisi (S3, EBS, RDS) moraju koristiti ključ, ali materijal mora biti u single-tenant HSM-u kojim upravljamo“ = **CloudHSM key store**. Samo CloudHSM (bez KMS-a) ne radi sa SSE-KMS u S3 i EBS.

## 5.3.4 Maskiranje osjetljivih podataka

### CloudWatch Logs data protection policies

**Data protection policy** u CloudWatch Logs traži osjetljive podatke u log događajima **pri ingestiji** i maskira ih na svim izlazima (konzola, Logs Insights, metric i subscription filteri). Može se postaviti na **nivou naloga** (važi za sve postojeće i buduće log grupe) i na pojedinačnoj log grupi; ako postoje obje, primjenjuju se obje.

- **Managed data identifiers**: gotovi obrasci za kredencijale (AWS secret key, privatni ključ), finansije (brojevi kartica), PII, PHI i identifikatore uređaja (IP, MAC).
- **Custom data identifiers**: vlastiti regex, npr. interni broj kupca.
- **Audit**: nalazi se šalju u drugu log grupu, S3 ili Firehose; metrika `LogEventsWithFindings` omogućava alarm.
- Nemaskirane podatke vidi samo principal sa pravom **`logs:Unmask`**.
- Podaci uneseni **prije** uključivanja politike se ne maskiraju naknadno.

```json
{
  "Name": "mask-pii",
  "Version": "2021-06-01",
  "Statement": [
    {"Sid": "audit", "DataIdentifier": ["arn:aws:dataprotection::aws:data-identifier/EmailAddress",
       "arn:aws:dataprotection::aws:data-identifier/CreditCardNumber"],
     "Operation": {"Audit": {"FindingsDestination": {"S3": {"Bucket": "log-findings-111111111111"}}}}},
    {"Sid": "mask", "DataIdentifier": ["arn:aws:dataprotection::aws:data-identifier/EmailAddress",
       "arn:aws:dataprotection::aws:data-identifier/CreditCardNumber"],
     "Operation": {"Deidentify": {"MaskConfig": {}}}}
  ]
}
```

```bash
aws logs put-data-protection-policy --log-group-identifier /app/payments \
  --policy-document file://mask-pii.json
```

### Amazon SNS message data protection

**SNS message data protection** primjenjuje politiku na poruke koje prolaze kroz topic: **Audit** (prijavi nalaze), **De-identify** (maskiraj ili ukloni osjetljive dijelove) i **Deny** (blokiraj objavu ili isporuku). Pravila se definišu po smjeru: **inbound** (od publishera) i **outbound** (prema pojedinim pretplatnicima), pa jedan pretplatnik može dobiti punu, a drugi maskiranu poruku.

Napomena o dostupnosti: AWS je najavio da SNS message data protection od 30. aprila 2026. nije dostupan **novim** korisnicima; postojeći korisnici ga i dalje mogu koristiti. Kao alternativu AWS predlaže Lambda funkciju pretplaćenu na topic koja provjerava poruke (npr. uz Amazon Bedrock Guardrails) i objavljuje očišćenu poruku u drugi topic. Ispit ga i dalje navodi kao primjer, pa znaj šta radi.

> **Na ispitu:** „developeri moraju vidjeti logove, ali brojevi kartica ne smiju biti vidljivi; samo security tim smije vidjeti original“ = **CloudWatch Logs data protection policy** + `logs:Unmask` samo za security rolu. Macie nije odgovor: on skenira S3, ne maskira logove u letu.

## 5.3.5 Certifikati: ACM i AWS Private CA

### AWS Certificate Manager (ACM)

- **Public certifikati** su besplatni, za integrisane servise (ELB, CloudFront, API Gateway…). Validacija preko **DNS** (CNAME zapis) ili emaila. Sa DNS validacijom ACM **automatski obnavlja** certifikat dok god CNAME postoji i certifikat je u upotrebi.
- **Imported certifikati** (od eksterne CA) se **ne** obnavljaju automatski; ACM šalje događaje o skorom isteku u EventBridge (i AWS Config ima pravilo `acm-certificate-expiration-check`).
- **Private certifikati** se izdaju iz AWS Private CA kroz ACM i mogu se izvesti (export) za upotrebu na EC2, on-prem, u kontejnerima.
- Certifikati su **regionalni**. CloudFront koristi samo certifikat iz **us-east-1**; za ALB u više regiona tražiš certifikat u svakom regionu.

### AWS Private CA

**AWS Private Certificate Authority** je upravljana privatna CA za interne servise, mTLS, IoT uređaje, IAM Roles Anywhere i slično.

- **Hijerarhija**: root CA (najbolje bez direktnog izdavanja krajnjih certifikata, ili čak van AWS-a) → subordinate CA → krajnji certifikati. Root se rijetko koristi, subordinate se lakše opoziva i zamjenjuje.
- **Revokacija**: CRL u S3 bucketu ili OCSP.
- **Short-lived certificate mode**: CA izdaje samo certifikate sa važenjem do **7 dana**, jeftinija je od general-purpose CA, a kratko važenje zamjenjuje potrebu za revokacijom. ACM ne može izdavati certifikate iz takve CA.
- **Cross-account dijeljenje**: CA se dijeli kroz **AWS RAM** (Resource Access Manager) drugim nalozima ili cijeloj organizaciji, tako da aplikacioni nalozi izdaju certifikate iz centralne CA bez kopiranja CA u svaki nalog.
- Pristup izdavanju kontrolišu IAM politike (`acm-pca:IssueCertificate`) i resource policy na CA; CloudTrail bilježi svako izdavanje.

```bash
aws ram create-resource-share --name shared-issuing-ca \
  --resource-arns arn:aws:acm-pca:eu-central-1:111111111111:certificate-authority/abcd-1234 \
  --principals arn:aws:organizations::111111111111:ou/o-abc123/ou-prod-xyz
```

> **Na ispitu:** „interni servisi u 40 naloga trebaju privatne TLS certifikate iz jedne centralne CA uz NAJMANJE operativnog napora“ = **AWS Private CA u security nalogu + dijeljenje kroz RAM** i izdavanje preko ACM-a (automatska obnova). „Certifikati za kratkotrajne kontejnere, bez CRL/OCSP infrastrukture“ = **short-lived certificate mode**. „CloudFront ne vidi certifikat iz eu-west-1“ = certifikat mora biti u **us-east-1**.

## Rezime

- **Secrets Manager** je izbor kad treba rotacija, cross-account pristup ili replikacija; **managed rotation** za RDS/Aurora/Redshift/DocumentDB je najmanje napora, a **alternating users** daje rotaciju bez prekida.
- Cross-account tajna traži resource policy, IAM politiku u drugom nalogu i **customer managed** KMS ključ.
- KMS key policy je osnova; IAM politike rade samo ako ih key policy omogući; **grants** su privremena delegacija; `kms:ViaService` i **encryption context** sužavaju upotrebu.
- Automatska rotacija samo za simetrične `AWS_KMS` ključeve; on-demand i za imported; ostalo ručno preko aliasa. Brisanje ključa ima **7–30 dana** čekanja.
- **Imported material**: ti čuvaš original, možeš zadati istek i odmah ga obrisati (*Pending import*), pa ponovo uvesti isti materijal; nema automatske rotacije.
- **CloudHSM key store** = single-tenant HSM pod tvojom kontrolom; **XKS** = materijal ostaje van AWS-a (HYOK, double encryption), uz tvoj rizik po dostupnost.
- **CloudWatch Logs data protection** maskira PII pri ingestiji, a original vidi samo `logs:Unmask`; SNS data protection radi audit/de-identify/deny po smjeru poruke.
- ACM certifikati su regionalni (CloudFront = us-east-1); **Private CA** dijeliš kroz **RAM**, a short-lived mode daje certifikate do 7 dana bez revokacije.
