## Ciljevi ispita: 2.1 i 2.2

Domen 2 (**Incident Response**) nosi 14% bodovanog sadržaja i ima dva zadatka, oba u ovom modulu:

- **2.1** dizajn i testiranje plana odgovora: runbooki (Systems Manager OpsCenter, SageMaker AI notebooks), priprema (pristup, sigurnosni alati, manji blast radius, Shield Advanced), testiranje (AWS Fault Injection Service, AWS Resilience Hub), automatska remedijacija (Systems Manager, Automated Forensics Orchestrator for Amazon EC2, Step Functions, Application Recovery Controller, Lambda),
- **2.2** odgovor na događaje: forenzički artefakti, pretraga i korelacija logova, validacija nalaza i procjena obima, containment, eradication i recovery, root cause analysis (Amazon Detective).

Ispit voli dvije vrste pitanja: **redoslijed koraka** („What should the security engineer do FIRST?“) i **automatizaciju** („respond automatically with the LEAST operational overhead“). Kod prvih je pravilo: **sačuvaj dokaze i zaustavi štetu prije nego što brišeš**. Kod drugih: **EventBridge + managed orkestracija** (SSM Automation, Step Functions), a ne skripta na serveru.

## Životni ciklus odgovora na incidente

| Faza (NIST SP 800-61) | U AWS-u |
|---|---|
| **Preparation** | IR role u svim nalozima, Security Tooling i Forensics nalog, uključeni logovi, runbooki, Shield Advanced, vježbe |
| **Detection & Analysis** | GuardDuty, Security Hub, Macie, Inspector, CloudWatch alarmi; validacija nalaza i obim (Detective, Athena) |
| **Containment, Eradication & Recovery** | Izolacija security grupom, deaktivacija ključeva, revoke sessions, SCP; čišćenje; obnova iz AWS Backup ili IaC |
| **Post-incident activity** | Root cause analysis, lessons learned, ažuriranje runbooka i kontrola |

## Plan i runbooki (2.1.1)

**Playbook** opisuje šta radimo za tip incidenta (npr. „kompromitovan IAM ključ“): uloge, komunikacija, odluke. **Runbook** je konkretan, ponovljiv niz koraka, idealno automatizovan.

### Systems Manager alati

- **Systems Manager Automation**: runbook (Automation dokument, YAML/JSON) sa koracima tipa `aws:executeAwsApi`, `aws:runCommand`, `aws:executeScript`, `aws:approve` (ljudsko odobrenje prije destruktivnog koraka). AWS nudi gotove runbooke (`AWS-…`, `AWSSupport-…`), npr. za snapshot ili izolaciju.
- **Systems Manager OpsCenter**: centralno mjesto za **OpsItems** (operativne i sigurnosne probleme). OpsItem se može automatski napraviti iz EventBridge pravila, CloudWatch alarma ili Security Hub nalaza. Uz OpsItem vidiš povezane resurse, istoriju i možeš direktno pokrenuti Automation runbook.
- **Systems Manager Incident Manager**: response plans, kontakti, on-call rasporedi, eskalacije, chat kanali i post-incident analiza. Napomena: AWS je zatvorio Incident Manager za **nove korisnike**; postojeći ga koriste normalno. Za nova rješenja pitanja češće ciljaju OpsCenter, Automation i EventBridge.

```yaml
# Skraćen Automation runbook: izoluj instancu i napravi snapshot
schemaVersion: '0.3'
assumeRole: '{{ AutomationAssumeRole }}'
parameters:
  InstanceId: { type: String }
  IsolationSg: { type: String }
  AutomationAssumeRole: { type: String }
mainSteps:
  - name: approve
    action: aws:approve
    inputs: { Approvers: ['arn:aws:iam::111122223333:role/IR-Lead'], MinRequiredApprovals: 1 }
  - name: isolate
    action: aws:executeAwsApi
    inputs:
      Service: ec2
      Api: ModifyInstanceAttribute
      InstanceId: '{{ InstanceId }}'
      Groups: ['{{ IsolationSg }}']
  - name: tag
    action: aws:createTags
    inputs:
      ResourceType: EC2
      ResourceIds: ['{{ InstanceId }}']
      Tags: [{ Key: 'IR-Status', Value: 'Quarantined' }]
```

### SageMaker AI notebooks za istragu

**Jupyter notebook** u Amazon SageMaker AI je živi runbook za istragu: ćelije sa objašnjenjem i kodom (boto3, Athena upiti nad CloudTrail ili Security Lake, pandas za korelaciju, grafici). Prednosti: istraga je **ponovljiva i dokumentovana**, analitičar ne mora pamtiti upite, a rezultat se čuva kao dio dokumentacije incidenta. Notebook instanca treba raditi u security/forensics nalogu, sa IAM rolom samo za čitanje logova i bez direktnog interneta (VPC-only).

> **Na ispitu:** „Centralized place to track, investigate and **remediate operational and security issues** with associated runbooks“ = **OpsCenter**. „Interactive, repeatable **investigation** of log data with code and documentation“ = **SageMaker AI (Jupyter) notebooks**. „Multi-step remediation with an **approval** step“ = **SSM Automation** sa `aws:approve`.

## Priprema za incidente (2.1.2)

### Pristup prije incidenta

- **IR role** unaprijed u svim nalozima (CloudFormation StackSets ili Control Tower customizations): npr. `IR-ReadOnly` (istraga) i `IR-Containment` (izolacija, deaktivacija ključeva, snapshot). Trust policy dozvoljava preuzimanje samo iz Security Tooling naloga, uz MFA.
- **IAM Identity Center** permission set za IR tim, dodijeljen po potrebi (ili just-in-time pristup).
- **Break-glass** pristup: posebni kredencijali (npr. IAM korisnik sa hardverskim MFA u sefu) za slučaj da Identity Center ili IdP nisu dostupni. Svaka upotreba okida alarm.
- **Forensics nalog**: izolovan nalog sa VPC-om bez interneta, forenzičkim AMI-jem i S3 bucketom sa **Object Lock** za dokaze. Snapshoti se dijele u ovaj nalog.

### Sigurnosni alati i manji blast radius

- Detekcija i logovi uključeni **prije** incidenta (GuardDuty, Security Hub, CloudTrail org trail, flow logs, Resolver logs). Log koji nije uključen ne možeš retroaktivno dobiti.
- **Multi-account** struktura: kompromitovan workload nalog ne dira druge. **SCP** i **RCP** ograničavaju šta i najprivilegovaniji principal u članu može.
- Least privilege, kratkotrajni kredencijali (role umjesto access ključeva), segmentacija mreže, **tagovi** (vlasnik, okruženje, osjetljivost) da u incidentu znaš čiji je resurs.

### AWS Shield Advanced

| Mogućnost | Šta daje |
|---|---|
| Zaštita resursa | CloudFront, Route 53 hosted zone, Global Accelerator, ALB, Classic Load Balancer, Elastic IP (EC2, NLB) |
| **Shield Response Team (SRT)** | AWS tim pomaže tokom DDoS napada. Treba **Business ili Enterprise Support** plan i **SRT access role** (managed politika `AWSShieldDRTAccessPolicy`) da SRT smije mijenjati WAF pravila u tvom nalogu |
| **Proactive engagement** | SRT te sam kontaktira kada je resurs pod napadom; zahtijeva **Route 53 health checks** povezane sa zaštićenim resursima i kontakt podatke |
| **Automatic application layer DDoS mitigation** | Shield sam pravi i primjenjuje WAF pravila protiv L7 DDoS-a (traži web ACL na resursu) |
| Cost protection | Kredit za skaliranje uzrokovano DDoS napadom |
| Protection groups | Grupisanje resursa za preciznije otkrivanje |

> **Na ispitu:** „Allow the **SRT** to help during an attack“ = Business/Enterprise Support + SRT access role. „SRT should **contact us proactively**“ = proactive engagement + **Route 53 health checks** na zaštićenim resursima. Shield Standard je besplatan i automatski, ali nema SRT ni cost protection.

## Testiranje plana (2.1.3)

- **Tabletop exercise**: diskusija scenarija za stolom, bez diranja sistema. Jeftino, otkriva rupe u procesu i komunikaciji.
- **Game day / simulacija**: realan scenario u kontrolisanom okruženju (npr. GuardDuty **sample findings**, namjerno javni testni bucket). Mjeri vrijeme do detekcije i odgovora.
- **AWS Fault Injection Service (FIS)**: kontrolisani eksperimenti. **Experiment template** = akcije (npr. `aws:ec2:stop-instances`, `aws:ec2:terminate-instances`, `aws:network:disrupt-connectivity`, `aws:ssm:send-command`), targeti (po tagu), IAM rola i **stop conditions** (CloudWatch alarm koji prekida eksperiment). Provjerava da li alarmi, automatska remedijacija i oporavak stvarno rade.
- **AWS Resilience Hub**: definišeš aplikaciju i **resiliency policy** (ciljani RTO i RPO), Resilience Hub radi **assessment** i preporučuje poboljšanja, alarme, SOP-ove i FIS eksperimente. Pokazuje da li arhitektura može ispuniti ciljeve oporavka.

> **Na ispitu:** „Validate that the application **can meet RTO/RPO** and get recommendations“ = **Resilience Hub**. „Inject a real failure (stop instances, cut network) with **automatic stop** if customer impact is detected“ = **FIS sa stop condition**.

## Automatska remedijacija (2.1.4)

Obrazac je uvijek isti: **nalaz → EventBridge pravilo → orkestracija → akcija**.

| Orkestracija | Kada |
|---|---|
| **Lambda** | Kratka, jednostavna akcija (deaktiviraj ključ, ukloni javni ACL) |
| **Step Functions** | Više koraka, grananje, čekanje, paralelno izvršavanje, ljudsko odobrenje (callback) |
| **SSM Automation** | Operacije nad EC2 i AWS resursima, gotovi AWS runbooki, `aws:approve` |
| **Config remediation** | Usklađivanje konfiguracije (preko SSM Automation) kada Config pravilo prijavi neusklađenost |
| **Security Hub custom action / automation rules** | Analitičar ručno pokrene akciju iz konzole ili se nalaz automatski obogati |

```json
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": {
    "resource": { "resourceType": ["Instance"] },
    "type": [{ "prefix": "CryptoCurrency:EC2/" }, { "prefix": "Backdoor:EC2/" }]
  }
}
```

### Automated Forensics Orchestrator for Amazon EC2

AWS rješenje (Solutions Library, CloudFormation) za SOC: nalaz iz Security Hub (npr. od GuardDutyja) preko EventBridge pokreće **Step Functions** workflow koji:

1. odlučuje da li treba izolacija i akvizicija (prema akciji i tagovima instance),
2. paralelno prikuplja **memoriju** (preko SSM u S3) i **disk** (EBS snapshoti),
3. izoluje instancu **security grupom**,
4. u forensics nalogu pokreće forenzičku instancu, kači volumen napravljen iz snapshota i radi analizu,
5. čuva dokaze uz chain of custody.

### Amazon Application Recovery Controller (ARC)

ARC pomaže u **recovery** fazi i kod incidenata koji pogađaju dostupnost:

- **Zonal shift / zonal autoshift**: privremeno skloni saobraćaj iz jedne Availability Zone (npr. AZ sa kompromitovanim ili neispravnim deployom),
- **Routing control**: pouzdano prebacivanje DNS saobraćaja između Regiona, uz **safety rules**,
- **Region switch**: orkestriran plan oporavka u drugom Regionu,
- **Readiness check**: stalno provjerava da li je replika spremna (kvote, kapacitet). Nije namijenjen da bude u kritičnom putu failovera.

## Odgovor na sigurnosne događaje (2.2)

### Forenzički artefakti (2.2.1)

Prikupljaj po **redoslijedu volatilnosti**: prvo ono što nestaje (memorija, aktivne konekcije), zatim disk, pa logovi koji su već trajni.

| Artefakt | Kako | Napomena |
|---|---|---|
| Memorija (RAM) | SSM Run Command sa alatom (npr. LiME, AVML) → S3 | Prije gašenja instance; gašenjem nestaje |
| Metapodaci instance | `aws ec2 describe-instances`, ENI, SG, IAM rola, tagovi | Snimi u ticket/bucket |
| Disk | `aws ec2 create-snapshot` za svaki EBS volumen | Snapshot šifrovan CMK-om traži da forensics nalog dobije pravo na ključ |
| Logovi | CloudTrail, flow logs, Resolver logs, aplikacioni logovi | Kopija u forensics bucket sa Object Lock |
| Integritet | SHA-256 hash svakog artefakta, zapis ko je šta radio | **Chain of custody** |

```bash
aws ec2 create-snapshot --volume-id vol-0abc123 \
  --description "IR-2026-117 evidence i-0123456789abcdef0" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=IR-Case,Value=IR-2026-117}]'
aws ec2 modify-snapshot-attribute --snapshot-id snap-0def456 \
  --attribute createVolumePermission --operation-type add --user-ids 444455556666
```

### Kompromitovan IAM access key: koraci

1. **Identifikuj** ključ i vlasnika (GuardDuty nalaz, AWS Health `AWS_RISK_CREDENTIALS_EXPOSED`, CloudTrail `userIdentity.accessKeyId`).
2. **Deaktiviraj** ključ (`aws iam update-access-key --status Inactive`). Ne briši odmah: deaktivacija je reverzibilna i čuva vezu ključa sa dokazima.
3. **Opozovi sesije**: privremeni kredencijali dobijeni sa tim ključem (npr. `AssumeRole`, `GetSessionToken`) važe do isteka. Za role koristi **Revoke active sessions** (politika koja odbija sve tokene izdate prije trenutka opoziva); korisniku dodaj eksplicitni deny.
4. **Analiziraj** šta je ključ radio (Athena/CloudTrail Lake/Detective): novi korisnici, ključevi, role, izmijenjene trust policies, Lambda funkcije, instance u neuobičajenim Regionima.
5. **Ukloni** sve što je napadač napravio (persistence) i vrati izmijenjene politike.
6. **Obriši** kompromitovani ključ i, ako mora postojati, izdaj novi (bolje: pređi na IAM role ili Roles Anywhere). Pregledaj troškove, otvori AWS Support slučaj ako treba.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": { "DateLessThan": { "aws:TokenIssueTime": "2026-10-14T10:00:00Z" } }
  }]
}
```

### Kompromitovana EC2 instanca: koraci

1. **Sačuvaj** instancu: uključi termination protection, postavi shutdown behavior na stop, **taguj** (`IR-Status=Quarantined`, broj slučaja). Ne gasi je i ne terminiraj.
2. **Izvadi iz rotacije**: odvoji iz **Auto Scaling grupe** (inače je ASG može zamijeniti i terminirati) i deregistruj iz target grupa load balancera.
3. **Izoluj mrežu**: dodijeli **izolacionu security grupu** (bez inbound pravila, egress samo prema forenzičkom alatu, npr. SSM VPC endpointu). Pazi na **tracked connections**: promjena SG-a ne prekida već praćene konekcije. AWS preporučuje da prvo staviš SG koji dozvoljava sav saobraćaj (konekcije postaju untracked), pa onda izolacionu SG; ili dodatno koristi **NACL** na subnetu, koji je stateless i odmah prekida saobraćaj.
4. **Oduzmi kredencijale**: zamijeni ili ukloni **instance profile** i opozovi aktivne sesije role (kredencijali preuzeti iz IMDS-a važe do isteka).
5. **Prikupi memoriju**, zatim **EBS snapshote**, i podijeli ih u forensics nalog.
6. **Analiziraj** u forensics nalogu (volumen iz snapshota kao sekundarni disk na forenzičkoj instanci).
7. **Eradication i recovery**: terminiraj kompromitovanu instancu, deployuj novu iz provjerenog AMI-ja i IaC-a, zakrpi uzrok, rotiraj tajne kojima je instanca imala pristup.

> **Na ispitu:** „What should be done FIRST to preserve evidence?“ Odgovori koji kažu „terminate the instance“, „stop the instance“ ili „delete the access key“ su pogrešni za prvi korak: gubi se memorija ili veza sa dokazima. Tačan prvi korak je izolacija ili deaktivacija uz očuvanje stanja.

### Ostali česti scenariji

| Scenario | Prvi koraci |
|---|---|
| S3 bucket postao javan (Macie ili Security Hub nalaz) | Uključi **Block Public Access**, provjeri S3 data events i server access logs ko je čitao objekte, procijeni da li su objekti osjetljivi (Macie) |
| Kompromitovana Lambda funkcija | Postavi **reserved concurrency na 0** (funkcija se ne izvršava), sačuvaj kod i konfiguraciju (verzije), provjeri execution rolu i opozovi njene sesije |
| Sumnjiva root aktivnost | Promijeni root lozinku i MFA, obriši root access ključeve ako postoje, provjeri CloudTrail za sve root pozive; u member nalozima koristi centralizovani root pristup iz management naloga |
| Kompromitovan EKS pod | Izoluj pod (NetworkPolicy ili cordon čvora), sačuvaj audit logove i stanje poda, opozovi kredencijale service accounta i pod identity role |

### Pretraga i korelacija logova (2.2.2)

- Sve logove veži preko **identiteta** (access key ID, ARN role, `sessionContext.sessionIssuer`, `sourceIdentity`), **mrežnih podataka** (IP, ENI, instance-id) i **vremena** (UTC u svim izvorima).
- Lanac AssumeRole poziva prati se kroz CloudTrail: `AssumeRole` događaj ima `responseElements.credentials.accessKeyId` koji se zatim pojavljuje kao `userIdentity.accessKeyId` u sljedećim pozivima.
- Alati: Athena nad org trailom i flow logovima, Security Lake (OCSF, isti upit preko više izvora), CloudWatch Logs Insights nad više log grupa, OpenSearch, Detective.

### Validacija nalaza i obim (2.2.3)

Prije odgovora potvrdi da je nalaz stvaran i odredi obim:

- **Da li je true positive?** Je li IP dio poznatog skenera ili tvog CI sistema? Je li „neuobičajeni Region“ zapravo novi projekat? Sample nalazi imaju oznaku `[SAMPLE]`.
- **Šta je pogođeno?** Polja nalaza: resurs, akcija, actor (IP, ASN, geolokacija), `count`, `firstSeen`/`lastSeen`.
- **Koliko daleko?** Isti ključ ili IP u drugim nalozima i Regionima (Security Hub filter, Athena nad org trailom), povezani nalazi u Detective **finding groups**, attack sequence nalazi GuardDutyja, koje podatke rola može čitati (IAM Access Analyzer, last accessed informacije).
- **Uticaj**: da li su osjetljivi podaci dodirnuti (Macie klasifikacija bucketa, S3 data events).

### Containment, eradication, recovery (2.2.4)

| Resurs | Containment | Eradication / recovery |
|---|---|---|
| IAM korisnik / ključ | Deaktivacija ključa, deny politika, revoke sessions | Brisanje ključeva, uklanjanje persistence, prelazak na role |
| IAM rola | Revoke active sessions, izmjena trust policyja | Pregled i suženje dozvola |
| EC2 | Izolaciona SG, NACL, odvajanje iz ASG/ELB, uklanjanje instance profila | Nova instanca iz provjerenog AMI-ja, patch |
| S3 bucket | Block Public Access, bucket policy deny, isključenje kompromitovanog pristupa | Vraćanje verzija (Versioning), obnova iz AWS Backup |
| Cijeli nalog | **SCP** (deny za kompromitovan nalog ili Region), premještanje u karantinski OU | Rebuild iz IaC, rotacija svih tajni |
| Mreža | Network Firewall/WAF pravilo za blokiranje IP-a ili domena, DNS Firewall | Ukidanje nepotrebnih ruta i pristupa |
| Podaci | | **AWS Backup** obnova (vault sa Vault Lock), point-in-time recovery |

### Root cause analysis (2.2.5)

**Amazon Detective** je glavni AWS alat za RCA:

- **Behavior graph** iz CloudTrail, VPC Flow Logs i GuardDuty nalaza (opcionalno EKS audit logovi i nalazi iz Security Hub CSPM), do godinu dana istorije.
- **Entity profiles**: za IAM korisnika, rolu, IP, EC2 instancu vidiš API pozive, geolokacije, volumen saobraćaja i odstupanje od baseline-a.
- **Finding groups**: Detective grupiše povezane nalaze i entitete u jedan prikaz napada.
- **Investigations** za IAM korisnike i role: izvještaj sa indikatorima kompromitacije i mapiranjem na MITRE ATT&CK taktike.
- Multi-account: administrator behavior grapha (delegated admin) vidi podatke svih članova.

Nakon tehničke analize slijedi **post-incident review** (blameless): šta je bio inicijalni vektor, zašto ga kontrole nisu spriječile ili ranije otkrile, koje kontrole i runbooke treba promijeniti (npr. SCP, Config pravilo, novi alarm).

> **Na ispitu:** „Determine the **root cause** and visualize the activity of the compromised role **over time** with the LEAST effort“ = **Amazon Detective**. Athena upiti daju isti odgovor, ali uz više ručnog rada.

## Rezime

- Plan i runbooki: SSM Automation (sa `aws:approve`), OpsCenter za OpsItems i pokretanje runbooka, SageMaker AI notebooks za ponovljivu istragu; Incident Manager više ne prima nove korisnike.
- Priprema: IR role i break-glass pristup unaprijed, Security Tooling i Forensics nalog, uključeni logovi, multi-account i SCP za manji blast radius, Shield Advanced sa SRT (Business/Enterprise Support, SRT rola) i proactive engagement (Route 53 health checks).
- Testiranje: tabletop, game day, FIS sa stop conditions, Resilience Hub za RTO/RPO procjenu.
- Automatizacija: EventBridge → Lambda / Step Functions / SSM Automation; Automated Forensics Orchestrator za memoriju, disk i izolaciju EC2; ARC za preusmjeravanje saobraćaja u oporavku.
- Ključ: identifikuj, deaktiviraj, opozovi sesije, analiziraj, očisti, obriši. EC2: sačuvaj, izvadi iz ASG/ELB, izoluj (pazi na tracked connections), oduzmi profil, memorija pa snapshot, analiza, rebuild.
- Validiraj nalaz i obim prije velikih akcija; RCA sa Amazon Detective i blameless post-incident review.
