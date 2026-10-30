## Ciljevi ispita: 6.2 i 6.3

Ovaj modul pokriva dva zadatka iz domena 6 (**Security Foundations and Governance**, 14% ispita):

- **6.2** sigurna i konzistentna strategija deployovanja resursa:
  - **6.2.1** IaC za konzistentan i siguran deploy preko više naloga (CloudFormation StackSets, third-party IaC alati, CloudFormation Guard, cfn-lint),
  - **6.2.2** tagovi za organizaciju resursa (odjel, cost center, okruženje),
  - **6.2.3** centralno nametanje politika i konfiguracija (AWS Firewall Manager),
  - **6.2.4** sigurno dijeljenje resursa među nalozima (AWS Service Catalog, AWS RAM).
- **6.3** procjena usklađenosti resursa:
  - **6.3.1** pravila za detekciju i remedijaciju neusklađenih resursa i obavještenja (AWS Config, Security Hub),
  - **6.3.2** prikupljanje i organizacija dokaza (AWS Audit Manager, AWS Artifact),
  - **6.3.3** procjena arhitekture prema AWS najboljim praksama (AWS Well-Architected Tool).

Ispit ovdje voli pitanja oblika „isti baseline u svim nalozima, uključujući nove“, „spriječiti grešku **prije** deploya“ i „dokazati auditoru usklađenost uz najmanje ručnog rada“. Razlikuj **prevenciju prije deploya** (Guard, cfn-lint, Hooks, Checkov u CI), **prevenciju u runtime-u** (SCP, Firewall Manager) i **detekciju nakon deploya** (Config, Security Hub).

## 6.2.1 Infrastructure as code

### CloudFormation StackSets

**StackSets** deployuju isti CloudFormation šablon kao stack instance u više naloga i regiona jednom operacijom.

| | **Self-managed permissions** | **Service-managed permissions** |
|---|---|---|
| Role | Ručno kreiraš `AWSCloudFormationStackSetAdministrationRole` (admin nalog) i `AWSCloudFormationStackSetExecutionRole` (svaki ciljni nalog) | CloudFormation sam pravi potrebne role preko trusted access sa Organizations |
| Ciljevi | Lista ID-jeva naloga | **OU** ili cijela organizacija |
| Novi nalozi | Moraš ih dodati ručno | **Automatic deployment**: nalog dodat u OU automatski dobija stack; nalog koji napusti OU može dobiti uklanjanje stacka |
| Ko upravlja | Bilo koji nalog | Management account ili **delegated administrator** za StackSets |

```bash
aws cloudformation create-stack-set --stack-set-name security-baseline \
  --template-body file://baseline.yaml --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false \
  --capabilities CAPABILITY_NAMED_IAM --call-as DELEGATED_ADMIN

aws cloudformation create-stack-instances --stack-set-name security-baseline \
  --deployment-targets OrganizationalUnitIds=ou-ab12-prod \
  --regions eu-central-1 eu-west-1 \
  --operation-preferences MaxConcurrentPercentage=25,FailureTolerancePercentage=10 \
  --call-as DELEGATED_ADMIN
```

Tipičan sadržaj security baseline StackSet-a: IAM role za SOC i break-glass, EventBridge pravila koja šalju događaje u security nalog, Config pravila, podrazumijevana enkripcija EBS-a.

### Zaštita stackova: stack policy, termination protection, drift

- **Stack policy**: JSON koji određuje koji resursi stacka **smiju biti ažurirani**. Npr. zabrana `Update:Replace` i `Update:Delete` za produkcijsku bazu, da greška u šablonu ne zamijeni RDS instancu. Može se privremeno zaobići posebnom politikom za jedno ažuriranje.
- **Termination protection**: sprječava brisanje cijelog stacka. **`DeletionPolicy: Retain`** / `Snapshot` čuva resurs ili snapshot kada se stack obriše.
- **Drift detection**: upoređuje stvarnu konfiguraciju sa šablonom i pokazuje ručne izmjene (`MODIFIED`, `DELETED`). Radi i za StackSets.

```json
{
  "Statement": [
    {"Effect": "Allow", "Action": "Update:*", "Principal": "*", "Resource": "*"},
    {"Effect": "Deny", "Action": ["Update:Replace", "Update:Delete"], "Principal": "*",
     "Resource": "LogicalResourceId/OrdersDatabase"}
  ]
}
```

```bash
aws cloudformation detect-stack-drift --stack-name orders-prod
aws cloudformation describe-stack-resource-drifts --stack-name orders-prod \
  --stack-resource-drift-status-filters MODIFIED DELETED
```

### Provjera šablona: cfn-lint, CloudFormation Guard, Hooks

| Alat | Kada radi | Šta provjerava |
|---|---|---|
| **cfn-lint** | Lokalno i u CI, prije deploya | Ispravnost šablona prema specifikaciji resursa: nepostojeća svojstva, pogrešni tipovi, loše reference. Fokus je ispravnost, uz nekoliko best-practice pravila. |
| **CloudFormation Guard** (`cfn-guard`) | CI, Config custom policy rules, Hooks | **Policy-as-code** na vlastitom DSL-u: „svaki S3 bucket mora imati enkripciju i blokiran javni pristup“. Radi nad bilo kojim JSON/YAML (i Terraform plan JSON, Kubernetes manifesti). |
| **CloudFormation Hooks** | U CloudFormation servisu, **prije** kreiranja/izmjene resursa | Guard hooks, Lambda hooks ili custom hooks; mod **FAIL** (blokiraj) ili **WARN**. Ne mogu se zaobići lokalnim preskakanjem CI koraka. Control Tower proactive kontrole su hooks. |

```text
# s3_secure.guard
let buckets = Resources.*[ Type == 'AWS::S3::Bucket' ]
rule s3_encrypted_and_private when %buckets !empty {
  %buckets.Properties.BucketEncryption exists
  %buckets.Properties.PublicAccessBlockConfiguration.BlockPublicAcls == true
  %buckets.Properties.PublicAccessBlockConfiguration.RestrictPublicBuckets == true
}
```

```bash
cfn-lint templates/*.yaml
cfn-guard validate --data templates/ --rules rules/s3_secure.guard
```

### Terraform i third-party alati

Za Terraform (i CloudFormation, Kubernetes, Dockerfile) koriste se skeneri kao **Checkov** i **tfsec** (danas dio alata Trivy) u CI pipeline-u. Oni hvataju javne buckete, `0.0.0.0/0` na portu 22, nešifrovane volumene, IAM `*:*` prije `terraform apply`. Sigurnosne prakse za Terraform:

- **state** sadrži osjetljive vrijednosti: S3 backend sa SSE-KMS, verzionisanjem, blokiranim javnim pristupom i lockingom,
- CI pristupa AWS-u kroz **OIDC** federaciju i kratkotrajne role, ne kroz trajne access ključeve,
- odvojene role po okruženju; prod deploy samo iz zaštićene grane uz review.

```bash
checkov -d infra/ --framework terraform --compact
terraform plan -out tf.plan && terraform show -json tf.plan > plan.json
cfn-guard validate --data plan.json --rules rules/tf_plan.guard
```

> **Na ispitu:** „spriječiti nesiguran resurs **prije** deploya u CI pipeline-u“ = **cfn-guard / Checkov** u pipeline-u; „spriječiti ga čak i ako neko deployuje mimo pipeline-a kroz CloudFormation“ = **CloudFormation Hooks** (ili Control Tower proactive kontrola). „Isti baseline u svim nalozima, uključujući buduće“ = **StackSets sa service-managed permissions i automatic deployment**. cfn-lint provjerava sintaksu i ispravnost, a ne sigurnosnu politiku kompanije.

## 6.2.2 Tagovi i tagging strategija

Tagovi su metapodaci `ključ=vrijednost` koji služe za troškove, automatizaciju, pristup i usklađenost. Dobra strategija ima mali broj **obaveznih** tagova sa jasnim vrijednostima:

| Tag | Primjer | Upotreba |
|---|---|---|
| `Environment` | `prod`, `staging`, `dev` | Različite politike i backup po okruženju, Firewall Manager scope |
| `CostCenter` | `CC-1042` | Cost allocation tags u billing izvještajima |
| `Department` / `Team` | `payments` | ABAC, odgovornost za nalaze |
| `Owner` | `team-payments@firma.ba` | Kome slati nalaze i alarme |
| `DataClassification` | `confidential` | Macie, backup i enkripcijske politike |

Kako nametnuti tagove:
- **Tag policies** (Organizations) za ispravno pisanje ključa i dozvoljene vrijednosti, sa `enforced_for` za odbijanje neusklađenih operacija.
- **SCP** sa `aws:RequestTag` / `aws:TagKeys` za obavezan tag pri kreiranju.
- **AWS Config** pravilo `required-tags` za detekciju postojećih resursa bez taga.
- Tag u IaC modulima (`default_tags` u Terraform AWS provideru, `Tags` u StackSets).

```json
{
  "tags": {
    "costcenter": {
      "tag_key": {"@@assign": "CostCenter"},
      "tag_value": {"@@assign": ["CC-1042", "CC-2001", "CC-3100"]},
      "enforced_for": {"@@assign": ["ec2:instance", "s3:bucket"]}
    }
  }
}
```

### Veza sa ABAC-om

**Attribute-based access control (ABAC)** dozvoljava pristup kada se tag principala poklapa sa tagom resursa. Tada je kritično da korisnici **ne mogu mijenjati** tagove koji odlučuju o pristupu.

```json
{
  "Version": "2012-10-17",
  "Statement": [
{
  "Effect": "Allow",
  "Action": ["ec2:StartInstances", "ec2:StopInstances"],
  "Resource": "*",
  "Condition": {"StringEquals": {"aws:ResourceTag/Team": "${aws:PrincipalTag/Team}"}}
},
{
  "Effect": "Deny",
  "Action": ["ec2:CreateTags", "ec2:DeleteTags"],
  "Resource": "*",
  "Condition": {"ForAnyValue:StringEquals": {"aws:TagKeys": ["Team"]}}
}
  ]
}
```

> **Na ispitu:** „tag `costcenter`, `CostCenter` i `Cost-Center` miješaju se u billing izvještajima“ = **tag policy**. „Dozvoliti pristup bez nove politike za svaki novi projekat“ = **ABAC** sa `aws:PrincipalTag` i `aws:ResourceTag`, uz zaštitu tagova od izmjene. „Pronaći postojeće resurse bez taga“ = Config `required-tags`.

## 6.2.3 AWS Firewall Manager

**AWS Firewall Manager** centralno primjenjuje zaštitne politike na naloge u organizaciji i **automatski ih primjenjuje na nove naloge i resurse** u scope-u. Preduslovi: AWS Organizations, **Firewall Manager administrator** nalog (može biti delegiran, npr. Security Tooling ili Network nalog) i **AWS Config** uključen u nalozima i regionima koje politika pokriva.

| Tip politike | Šta radi |
|---|---|
| **AWS WAF** | Web ACL sa obaveznim rule grupama koje se izvršavaju **prve i zadnje**; vlasnik naloga može dodati svoja pravila između. Na ALB, API Gateway, CloudFront, AppSync… |
| **Shield Advanced** | Uključuje Shield Advanced zaštitu za izabrane tipove resursa u svim nalozima. |
| **Security group** | *Common* (zajednička SG zakačena na resurse), *content audit* (pravila koja SG ne smiju imati, npr. 0.0.0.0/0 na 22), *usage audit* (neiskorištene i duple SG). |
| **Network ACL** | Osnovni NACL zapisi u svim subnetima u scope-u. |
| **AWS Network Firewall** | Kreira firewall endpointe i politiku u VPC-ovima u scope-u (distribuirano ili centralizovano). |
| **Route 53 Resolver DNS Firewall** | Kači DNS Firewall rule grupe (npr. blokada malicioznih domena) na VPC-ove. |
| **Third-party** | Palo Alto Cloud NGFW, Fortigate CNF. |

Scope se zadaje po nalozima, OU, tipu resursa i **tagovima** (npr. samo resursi sa `Environment=prod`). Svaka politika može samo prijaviti neusklađenost ili **automatski remedijirati**.

> **Na ispitu:** „svaki novi ALB u bilo kom nalogu mora automatski dobiti obavezna WAF pravila (npr. AWS Managed Rules)“ = **Firewall Manager WAF politika**, ne StackSet ni ručni web ACL. „Pronaći i ukloniti SG pravila koja otvaraju SSH prema internetu u svim nalozima“ = Firewall Manager **security group content audit** politika sa remedijacijom.

## 6.2.4 Dijeljenje resursa: Service Catalog i AWS RAM

### AWS Service Catalog

**Service Catalog** nudi korisnicima samo odobrene, unaprijed sigurno konfigurisane proizvode (CloudFormation ili Terraform šabloni).

- **Portfolio**: skup proizvoda sa pristupom za određene IAM principale ili grupe. Portfolio se može **dijeliti** drugim nalozima ili cijeloj organizaciji/OU.
- **Product**: verzionisan šablon (npr. „šifrovani S3 bucket“, „EKS namespace sa standardnim politikama“).
- **Constraints**:
  - **Launch constraint**: IAM rola koju Service Catalog koristi za provisioning. Korisnik ne treba prava na same servise, samo pravo da pokrene proizvod. Ovo je ključno za **least privilege**.
  - **Template constraint**: ograničava vrijednosti parametara (npr. samo `t3.small` i `t3.medium`).
  - **Notification**, **tag update**, **StackSet** constraints.
- **TagOptions** nameću ispravne tagove na provisionovane proizvode.

### AWS Resource Access Manager (RAM)

**AWS RAM** dijeli resurse bez kopiranja: **VPC subneti** (VPC sharing), Transit Gateway, Route 53 Resolver pravila, prefix liste, AWS Private CA, Network Firewall politike, License Manager konfiguracije i drugo.

- Uz uključeno dijeljenje sa Organizations, dijeljenje unutar organizacije ne traži prihvatanje pozivnice; nalozi van organizacije moraju prihvatiti.
- Može se dijeliti na OU, pa novi nalozi u OU automatski dobijaju pristup.
- **Managed permissions** određuju šta korisnik dijeljenog resursa smije (npr. samo korištenje subneta, ne i izmjenu).
- Vlasnik zadržava kontrolu; kod VPC sharinga učesnik kreira svoje resurse u dijeljenom subnetu, ali ne može mijenjati VPC, rute ni tuđe resurse.

```bash
aws ram enable-sharing-with-aws-organization
aws ram create-resource-share --name shared-prod-subnets \
  --resource-arns arn:aws:ec2:eu-central-1:555555555555:subnet/subnet-0abc \
  --principals arn:aws:organizations::111111111111:ou/o-abc123/ou-ab12-prod
```

> **Na ispitu:** „developeri moraju moći kreirati odobrene resurse bez direktnih IAM prava na EC2/RDS“ = **Service Catalog sa launch constraint**. „Aplikacioni nalozi koriste centralno upravljanu mrežu bez peeringa i bez svog VPC-a“ = **VPC sharing kroz RAM**. RAM ne kopira resurs i ne radi sa svim tipovima; Service Catalog dijeli **šablone**, RAM dijeli **postojeće resurse**.

## 6.3.1 AWS Config i Security Hub

### AWS Config rules

**AWS Config** bilježi konfiguraciju resursa kroz vrijeme i ocjenjuje je pravilima.

| Vrsta pravila | Opis |
|---|---|
| **Managed rules** | Gotova AWS pravila: `s3-bucket-public-read-prohibited`, `encrypted-volumes`, `restricted-ssh`, `iam-root-access-key-check`, `required-tags`… |
| **Custom policy rules** | Pravila napisana u **CloudFormation Guard** DSL-u, bez Lambda funkcije. |
| **Custom Lambda rules** | Lambda funkcija sa proizvoljnom logikom (npr. poziv eksternog CMDB-a). |

Okidači: **configuration change** (kad se resurs promijeni), **periodic** (npr. svaka 24 sata) ili oba. Neka pravila podržavaju i **proactive** evaluaciju prije kreiranja resursa.

**Automatska remedijacija**: pravilu se pridruži **SSM Automation** runbook (AWS ili vlastiti), sa automatskim pokretanjem i brojem pokušaja. Npr. `AWS-DisableS3BucketPublicReadWrite` ili `AWSConfigRemediation-RemoveUnrestrictedSourceIngressRules`.

```bash
aws configservice put-remediation-configurations --remediation-configurations '[{
  "ConfigRuleName": "s3-bucket-public-read-prohibited",
  "TargetType": "SSM_DOCUMENT",
  "TargetId": "AWS-DisableS3BucketPublicReadWrite",
  "Parameters": {
    "AutomationAssumeRole": {"StaticValue": {"Values": ["arn:aws:iam::444444444444:role/ConfigRemediation"]}},
    "S3BucketName": {"ResourceValue": {"Value": "RESOURCE_ID"}}
  },
  "Automatic": true, "MaximumAutomaticAttempts": 3, "RetryAttemptSeconds": 60
}]'
```

**Obavještenja**: promjena usklađenosti šalje događaj u **EventBridge** (`Config Rules Compliance Change`), odakle ide na SNS, Slack (preko AWS Chatbot / Amazon Q Developer in chat applications) ili ticketing.

**Na nivou organizacije**:
- **Organization Config rules** i **organization conformance packs** iz management ili delegated admin naloga uključuju ista pravila u svim nalozima.
- **Conformance pack**: paket pravila i remedijacija kao jedan YAML (npr. „Operational Best Practices for PCI DSS“, „CIS“); daje ocjenu usklađenosti po paketu.
- **Aggregator**: objedinjuje Config podatke i usklađenost iz više naloga i regiona u jedan nalog (organization aggregator iz delegated admin naloga). Aggregator **samo prikazuje**; pravila i remedijacija se izvršavaju u svakom nalogu.

### Security Hub

**AWS Security Hub CSPM** (originalni Security Hub, preimenovan 2025) izvršava sigurnosne **standarde** kao skup kontrola nad Config podacima (zato traži uključen AWS Config recording):

- **AWS Foundational Security Best Practices (FSBP)**: AWS-ove preporuke za mnoge servise,
- **CIS AWS Foundations Benchmark**, **PCI DSS**, **NIST SP 800-53**, NIST SP 800-171, AWS Resource Tagging Standard i service-managed standardi (npr. za Control Tower).

Automatizacija:
- **Central configuration**: delegated admin kroz **configuration policies** određuje koji su standardi i kontrole uključeni po OU i nalogu, za sve regione povezane sa home regionom.
- **Automation rules**: automatski mijenjaju polja nalaza (npr. podigni severity za prod nalog, suppress za poznati izuzetak).
- **EventBridge**: nalazi i **custom actions** pokreću Lambda/SSM za remedijaciju ili ticket.
- Cross-Region agregacija nalaza u jedan region.

Novi **AWS Security Hub** (2025) objedinjuje nalaze iz GuardDuty, Inspector, Macie i CSPM-a u OCSF formatu i dodaje korelaciju rizika; za usklađenost sa standardima i dalje se koriste CSPM kontrole.

> **Na ispitu:** „automatski ukloniti javni pristup S3 bucketu čim se pojavi“ = **Config pravilo + automatska remedijacija SSM Automation runbookom**. „Jedan pogled na usklađenost svih 200 naloga“ = **Config aggregator** (ili Security Hub sa delegated adminom). „Mjeriti usklađenost sa CIS benchmarkom u cijeloj organizaciji“ = **Security Hub CSPM CIS standard** ili Config conformance pack. Aggregator ne remedira.

## 6.3.2 Dokazi za audit: Audit Manager i AWS Artifact

### AWS Audit Manager

**AWS Audit Manager** kontinuirano prikuplja **dokaze** (evidence) i mapira ih na kontrole iz **frameworka**.

- **Frameworks**: gotovi (npr. CIS, PCI DSS, HIPAA, SOC 2, GDPR, NIST, AWS best practices) ili **custom** frameworki sa vlastitim kontrolama.
- **Assessment**: framework primijenjen na izabrane naloge i servise; uz organizaciju koristi delegated admin.
- **Izvori dokaza**: AWS Config ocjene, Security Hub nalazi, CloudTrail aktivnost korisnika, snimci konfiguracije preko API poziva i **ručni dokazi** (upload dokumenata, npr. politika obuke).
- **Delegations**: kontrole se dodjeljuju vlasnicima na pregled; **assessment report** se generiše u S3 bucket za auditora. Evidence finder omogućava pretragu dokaza.

Napomena o dostupnosti: AWS je najavio da Audit Manager od 30. aprila 2026. nije otvoren za nove korisnike i prelazi u maintenance mode; postojeći korisnici ga i dalje koriste, a kao alternativu AWS predlaže Config conformance packs. Ispit ga i dalje navodi u vještini 6.3.2.

### AWS Artifact

**AWS Artifact** je portal za **AWS-ove** compliance dokumente:

- **Reports**: SOC 1/2/3 izvještaji, PCI DSS Attestation of Compliance, ISO certifikati, i izvještaji nekih nezavisnih prodavaca sa AWS Marketplacea. Koriste se kao dokaz za dio odgovornosti koji pripada AWS-u (shared responsibility).
- **Agreements**: npr. **Business Associate Addendum (BAA)** za HIPAA. Management account može prihvatiti ugovor za **cijelu organizaciju**.
- Pristup se kontroliše IAM-om (npr. `artifact:GetReport`), a notifikacije javljaju nove izvještaje.

> **Na ispitu:** „auditor traži AWS-ov SOC 2 izvještaj ili PCI AOC“ = **AWS Artifact**. „Kontinuirano prikupljati dokaze o **našim** kontrolama i pripremiti izvještaj za audit“ = **Audit Manager**. „Kompanija mora potpisati BAA za sve naloge prije obrade PHI“ = Artifact **organization agreement** iz management naloga.

## 6.3.3 AWS Well-Architected Tool i Security pillar

**AWS Well-Architected Tool** je besplatan servis za strukturiran pregled **workloada** pitanjima iz Well-Architected Frameworka.

- **Lenses**: osnovni Well-Architected Framework (šest stubova), specijalizovani lensovi (npr. Serverless, SaaS, Generative AI) i **custom lenses** za interne standarde.
- Rezultat: lista **high-risk issues (HRI)** i medium-risk, **improvement plan** sa preporukama, **milestones** za praćenje napretka kroz vrijeme.
- Workload se može dijeliti sa drugim nalozima; integracija sa Trusted Advisor podacima.

**Security pillar** oblasti: security foundations, identity and access management, detection, infrastructure protection, data protection, incident response i application security. Principi: jak identitet i least privilege, traceability, sigurnost na svim slojevima, automatizacija, zaštita podataka u prenosu i mirovanju, držanje ljudi dalje od podataka i priprema za incidente.

> **Na ispitu:** „procijeniti arhitekturu workloada prema AWS sigurnosnim najboljim praksama i pratiti napredak kroz vrijeme“ = **Well-Architected Tool** (Security pillar, milestones). Ne miješaj ga sa Security Hubom (kontinuirane tehničke provjere resursa) ni sa Trusted Advisorom (automatske provjere naloga).

## Rezime

- **StackSets sa service-managed permissions** i automatic deployment daju isti baseline u svim OU nalozima, uključujući nove; **stack policy**, termination protection i **drift detection** štite stackove.
- **cfn-lint** = ispravnost šablona; **CloudFormation Guard** i **Checkov/tfsec** = policy-as-code u CI; **Hooks** = provjera u samom CloudFormation-u prije kreiranja.
- Tagging strategija sa malo obaveznih tagova; **tag policies** za pisanje i vrijednosti, SCP/Config za prisustvo; **ABAC** traži zaštitu tagova od izmjene.
- **Firewall Manager** centralno nameće WAF, Shield Advanced, SG, NACL, Network Firewall i DNS Firewall politike i automatski pokriva nove naloge; traži Organizations i AWS Config.
- **Service Catalog** (portfolio, launch constraint za least privilege) dijeli odobrene šablone; **RAM** dijeli postojeće resurse (subneti, TGW, Private CA).
- **Config**: managed, Guard i Lambda pravila, **SSM Automation** remedijacija, conformance packs i aggregator (samo prikaz); **Security Hub CSPM** standardi FSBP i CIS uz central configuration i automation rules.
- **Audit Manager** prikuplja dokaze o tvojim kontrolama; **AWS Artifact** daje AWS-ove izvještaje i ugovore (BAA); **Well-Architected Tool** procjenjuje workload kroz Security pillar.
