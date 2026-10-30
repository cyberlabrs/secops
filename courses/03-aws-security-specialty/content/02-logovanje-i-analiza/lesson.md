## Cilj ispita: 1.2

Zadatak **1.2 Design and implement logging solutions** je najširi zadatak domena 1. Vještine koje ispit provjerava:

- **1.2.1** izabrati izvore logova i mjesto čuvanja prema zahtjevu,
- **1.2.2** konfigurisati logovanje: CloudTrail trail za organizaciju, poseban logging nalog, CloudWatch agent,
- **1.2.3** log storage i data lake (Amazon Security Lake) i integracija sa third-party alatima (SIEM),
- **1.2.4** analiza logova: CloudWatch Logs Insights, Amazon Athena, Security Hub nalazi,
- **1.2.5** normalizacija, parsiranje i korelacija: Amazon OpenSearch Service, AWS Lambda, Amazon Managed Grafana,
- **1.2.6** izvori prema mrežnom dizajnu i prijetnjama: VPC Flow Logs, Transit Gateway flow logs, Route 53 Resolver logs.

Tipična pitanja: „Koji log otkriva X?“, „Kako garantovati da logove niko ne može izmijeniti?“, „Kako jeftino upitati logove iz posljednjih 5 godina?“. Ključ je znati **šta koji log sadrži, a šta ne**.

## Koji log za koju prijetnju (1.2.1, 1.2.6)

| Pitanje istrage | Izvor logova |
|---|---|
| Ko je obrisao IAM rolu, promijenio security grupu, isključio CloudTrail? | **CloudTrail management events** |
| Ko je pročitao ili obrisao objekat u S3? Ko je pozvao Lambda funkciju? | **CloudTrail data events** (nisu uključeni podrazumijevano) |
| Koji API pozivi su prošli kroz VPC endpoint, uključujući odbijene iz drugih naloga? | **CloudTrail network activity events** |
| Neuobičajen skok broja API poziva ili grešaka | **CloudTrail Insights events** |
| Koje IP adrese su pokušale SSH na instancu, koliko bajtova je izašlo? | **VPC Flow Logs** |
| Saobraćaj između VPC-ova i on-premises mreže kroz Transit Gateway | **Transit Gateway flow logs** |
| Koje domene je instanca razriješila (C2, DNS tunneling)? | **Route 53 Resolver query logs** |
| HTTP zahtjevi, status kodovi, user-agent, putanje | **ALB/NLB access logs**, **CloudFront logs**, **API Gateway access logs** |
| Koji zahtjevi su blokirani SQLi/XSS pravilom ili rate limitom | **AWS WAF logs** |
| Ko je pristupao objektima statičkog sajta (referer, HTTP status), uz nisku cijenu | **S3 server access logs** |
| Kubernetes API pozivi (kubectl exec, RBAC izmjene) | **EKS control plane audit logs** |
| Logovi OS-a i aplikacije na EC2 | **CloudWatch agent** → CloudWatch Logs |

> **Na ispitu:** VPC Flow Logs bilježe **metapodatke** (IP, port, bajtovi, ACCEPT/REJECT), ne sadržaj paketa. Za sadržaj treba **Traffic Mirroring**. Flow logs takođe **ne bilježe** saobraćaj prema Amazon DNS serveru (Route 53 Resolver), instance metadata servisu (169.254.169.254), Amazon Time Sync servisu i DHCP. Za DNS koristi **Route 53 Resolver query logs**.

## AWS CloudTrail

### Vrste događaja

| Vrsta | Šta bilježi | Podrazumijevano |
|---|---|---|
| **Management events** | Control plane operacije (CreateUser, PutBucketPolicy, RunInstances), read i write | Da (u trailu: read+write) |
| **Data events** | Operacije nad podacima: S3 objekti, Lambda Invoke, DynamoDB stavke i drugi tipovi resursa | Ne; uključuje se uz **advanced event selectors** (filter po resursu, eventName, readOnly…) |
| **Network activity events** | API pozivi koji prolaze kroz VPC endpoint, uključujući one odbijene endpoint policyjem | Ne |
| **Insights events** | Odstupanja od baseline-a u **API call rate** i **API error rate**, za management i data events | Ne (dodatno se plaća) |

**Event history** u konzoli besplatno prikazuje 90 dana management eventa, ali samo za jedan nalog i Region. To nije dugoročno rješenje.

### Organization trail i Log Archive nalog (1.2.2)

- **Organization trail** pravi **management nalog** ili **delegated administrator** za CloudTrail. Bilježi sve naloge, uključujući buduće.
- Članovi vide trail, ali ga ne mogu obrisati, ugasiti niti mijenjati.
- Struktura u bucketu: `AWSLogs/o-exampleorgid/111122223333/CloudTrail/eu-central-1/2026/10/14/...`.
- Bucket je u posebnom **Log Archive** nalogu (AWS Security Reference Architecture, Control Tower ga pravi automatski). Pristup imaju samo rijetke role (čitanje za istragu), niko nema delete.

Bucket policy u Log Archive nalogu (skraćeno):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailAclCheck",
      "Effect": "Allow",
      "Principal": { "Service": "cloudtrail.amazonaws.com" },
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::org-trail-logs",
      "Condition": { "StringEquals": { "aws:SourceArn": "arn:aws:cloudtrail:eu-central-1:111111111111:trail/org-trail" } }
    },
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": { "Service": "cloudtrail.amazonaws.com" },
      "Action": "s3:PutObject",
      "Resource": [
        "arn:aws:s3:::org-trail-logs/AWSLogs/111111111111/*",
        "arn:aws:s3:::org-trail-logs/AWSLogs/o-exampleorgid/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control",
          "aws:SourceArn": "arn:aws:cloudtrail:eu-central-1:111111111111:trail/org-trail"
        }
      }
    }
  ]
}
```

Ako je bucket šifrovan **SSE-KMS**, key policy mora dozvoliti `cloudtrail.amazonaws.com` akciju `kms:GenerateDataKey*` (uz `aws:SourceArn`), a onima koji čitaju logove `kms:Decrypt`.

### Integritet i nepromjenjivost

- **Log file integrity validation**: CloudTrail svaki sat pravi **digest fajl** sa SHA-256 hashevima log fajlova, potpisan privatnim ključem (RSA). Digest fajlovi su ulančani. Provjera:

```bash
aws cloudtrail validate-logs \
  --trail-arn arn:aws:cloudtrail:eu-central-1:111111111111:trail/org-trail \
  --start-time 2026-10-01T00:00:00Z
```

- **S3 Object Lock** (compliance mode) sprečava brisanje i prepisivanje čak i za root korisnika do isteka retencije.
- **SCP** koja zabranjuje `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `cloudtrail:UpdateTrail` u članovima.
- Validacija **dokazuje** da je fajl izmijenjen ili obrisan; Object Lock to **sprečava**. Na ispitu često treba oboje.

> **Na ispitu:** „Prove to auditors that log files were not **modified or deleted** after delivery“ = **log file integrity validation**. „**Prevent** anyone, including administrators, from deleting logs for 7 years“ = **S3 Object Lock u compliance modu** (governance mode dozvoljava brisanje uz posebnu dozvolu).

### Primjer CloudTrail zapisa

```json
{
  "eventTime": "2026-10-14T09:12:44Z",
  "eventSource": "iam.amazonaws.com",
  "eventName": "CreateAccessKey",
  "awsRegion": "us-east-1",
  "sourceIPAddress": "203.0.113.50",
  "userAgent": "aws-cli/2.17.0",
  "userIdentity": {
    "type": "IAMUser",
    "arn": "arn:aws:iam::111122223333:user/ci-deployer",
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE"
  },
  "requestParameters": { "userName": "backup-svc" },
  "readOnly": false,
  "eventType": "AwsApiCall"
}
```

Polja koja najčešće koristiš u istrazi: `userIdentity` (ko, sa kojim ključem, preko koje role: `sessionContext.sessionIssuer`), `sourceIPAddress`, `eventName`, `errorCode` (AccessDenied znači izviđanje), `requestParameters`.

### CloudTrail Lake

**CloudTrail Lake** čuva događaje u **event data store** (kolonarni ORC format) i omogućava SQL upite (Trino) bez vlastitog Athena podešavanja. Event data store može primati CloudTrail događaje, Config configuration items, Audit Manager evidence i događaje izvan AWS-a (integracije preko `PutAuditEvents`). Retencija do oko 10 godina uz odgovarajuću cjenovnu opciju; postoji federacija u AWS Glue Data Catalog za Athena upite.

Napomena o dostupnosti: AWS je najavio da CloudTrail Lake od **31. maja 2026.** više nije otvoren za nove korisnike; postojeći korisnici ga i dalje koriste. Za nova rješenja češće ćeš birati trail u S3 + Athena ili Security Lake, ali pojam se može pojaviti u pitanjima.

## CloudWatch Logs i dedicirani logging nalog (1.2.2)

- **Log group** ima retenciju (od 1 dana do neograničeno) i opcionalno **KMS ključ** (key policy mora dozvoliti `logs.<region>.amazonaws.com`).
- **CloudWatch agent** šalje OS i aplikacione logove i metrike (konfiguracija u Parameter Store, vidi modul 1).
- **Subscription filter** šalje logove u realnom vremenu na **Lambda**, **Kinesis Data Streams**, **Amazon Data Firehose** ili **OpenSearch Service**. Po log grupi postoji mali broj subscription filtera (dva), pa za šire slučajeve postoji i **account-level subscription filter policy**.
- **Centralni logging nalog**: u odredišnom nalogu napraviš **CloudWatch Logs destination** (iza nje Kinesis Data Streams ili Firehose) sa destination policyjem koji dozvoljava izvorne naloge ili cijelu organizaciju. U izvornim nalozima subscription filter pokazuje na ARN destinacije.

```bash
# u izvornom nalogu: šalji sve logove VPC flow log grupe u centralnu destinaciju
aws logs put-subscription-filter --log-group-name /vpc/flow \
  --filter-name to-central --filter-pattern "" \
  --destination-arn arn:aws:logs:eu-central-1:999988887777:destination:central-sec-logs
```

- **CloudWatch cross-account observability** (monitoring nalog + linkovi iz izvornih naloga) omogućava da jedan nalog pretražuje logove i metrike drugih bez kopiranja podataka.
- **Data protection policy** na log grupi maskira osjetljive podatke (detaljno u modulu o zaštiti podataka).

> **Na ispitu:** „Stream logs from all accounts to a central account in **near real time** for a SIEM“ = **subscription filter → CloudWatch Logs destination → Kinesis Data Streams/Firehose**. Izvoz u S3 (`create-export-task`) nije real-time.

## Amazon Security Lake i OCSF (1.2.3)

**Amazon Security Lake** pravi sigurnosni data lake u tvom nalogu (S3 bucketi kojima ti upravljaš):

- **Normalizacija**: podatke iz podržanih AWS izvora konvertuje u **Apache Parquet** i šemu **Open Cybersecurity Schema Framework (OCSF)**.
- **AWS izvori**: CloudTrail management i data events (S3, Lambda), EKS audit logs, Route 53 Resolver query logs, Security Hub CSPM nalazi, VPC Flow Logs, AWS WAFv2 logs.
- **Custom sources**: third-party i on-prem podaci, koje moraš dostaviti već u OCSF/Parquet formatu.
- **Multi-account**: delegated administrator iz Organizations; **rollup Region** konsoliduje podatke iz više Regiona (pazi na zahtjeve o rezidentnosti podataka).
- **Lifecycle**: retencija i prelazak u jeftinije S3 klase.
- **Subscribers**:
  - **data access** subscriber dobija obavještenja (SQS/HTTPS endpoint) i čita objekte direktno iz S3, tipično SIEM koji uvozi podatke,
  - **query access** subscriber dobija tabele preko **AWS Lake Formation** dijeljenja i upituje ih na mjestu (Athena, Redshift, partnerski alati).

> **Na ispitu:** „Normalize security logs from AWS **and third-party** sources into an **open standard schema** and let an external SIEM consume them“ = **Security Lake** (OCSF) + subscriber. Security Hub CSPM koristi ASFF i nije data lake za sirove logove.

### Integracija sa SIEM-om

| Način | Kada |
|---|---|
| Security Lake subscriber (data ili query access) | SIEM podržava OCSF/Security Lake (više partnera ima gotovu integraciju) |
| Firehose → HTTP endpoint / Splunk / OpenSearch | Streaming logova u realnom vremenu |
| S3 + SQS obavještenja | SIEM sam vuče nove fajlove iz bucketa |
| EventBridge API destination | Slanje pojedinačnih nalaza u SIEM/ticketing |

## Analiza logova (1.2.4)

| Alat | Najbolji za | Ograničenje |
|---|---|---|
| **CloudWatch Logs Insights** | Brze ad hoc upite nad log grupama, više grupa odjednom | Samo podaci u CloudWatch Logs; plaća se skenirani volumen |
| **Amazon Athena** | SQL nad S3 (CloudTrail, VPC Flow, ALB, CloudFront, WAF logovi), dugoročni podaci | Treba tabela u Glue Data Catalog; za performanse particije |
| **CloudTrail Lake** | SQL nad CloudTrail događajima bez podešavanja tabela | Samo za postojeće korisnike (vidi gore) |
| **Security Hub** | Pregled, filtriranje i grupisanje nalaza (insights) | Nalazi, ne sirovi logovi |

### CloudWatch Logs Insights primjeri

```text
# VPC Flow Logs: ko najčešće pokušava SSH i biva odbijen
fields @timestamp, srcAddr, dstAddr, dstPort, action
| filter action = "REJECT" and dstPort = 22
| stats count(*) as attempts by srcAddr
| sort attempts desc
| limit 20
```

```text
# CloudTrail u CloudWatch Logs: ko dobija AccessDenied (moguće izviđanje)
fields @timestamp, eventName, userIdentity.arn, sourceIPAddress
| filter errorCode in ["AccessDenied", "UnauthorizedOperation"]
| stats count(*) as denied by userIdentity.arn, eventName
| sort denied desc
```

```text
# Lambda: greške po satu
filter @message like /ERROR/
| stats count(*) as errors by bin(1h)
```

### Athena primjeri

Za CloudTrail koristi tabelu sa **partition projection**, da Athena ne skenira sve godine logova:

```sql
CREATE EXTERNAL TABLE cloudtrail_logs (
  eventtime STRING, eventsource STRING, eventname STRING, awsregion STRING,
  sourceipaddress STRING, useragent STRING, errorcode STRING,
  useridentity STRUCT<type:STRING, arn:STRING, accountid:STRING, accesskeyid:STRING>,
  requestparameters STRING, responseelements STRING
)
PARTITIONED BY (`timestamp` STRING)
ROW FORMAT SERDE 'org.apache.hive.hcatalog.data.JsonSerDe'
STORED AS INPUTFORMAT 'com.amazon.emr.cloudtrail.CloudTrailInputFormat'
OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION 's3://org-trail-logs/AWSLogs/o-exampleorgid/111122223333/CloudTrail/eu-central-1/'
TBLPROPERTIES (
  'projection.enabled'='true',
  'projection.timestamp.type'='date',
  'projection.timestamp.format'='yyyy/MM/dd',
  'projection.timestamp.range'='2024/01/01,NOW',
  'projection.timestamp.interval'='1',
  'projection.timestamp.interval.unit'='DAYS',
  'storage.location.template'='s3://org-trail-logs/AWSLogs/o-exampleorgid/111122223333/CloudTrail/eu-central-1/${timestamp}'
);
```

```sql
-- šta je radio kompromitovani access key u posljednje dvije sedmice
SELECT eventtime, eventsource, eventname, sourceipaddress, awsregion, errorcode
FROM cloudtrail_logs
WHERE useridentity.accesskeyid = 'AKIAIOSFODNN7EXAMPLE'
  AND "timestamp" >= '2026/10/01'
ORDER BY eventtime;
```

```sql
-- VPC Flow Logs u S3: najveći odlazni tokovi prema internetu
SELECT srcaddr, dstaddr, SUM(bytes) AS total_bytes
FROM vpc_flow_logs
WHERE action = 'ACCEPT' AND flow_direction = 'egress'
  AND day = '2026/10/14'
GROUP BY srcaddr, dstaddr
ORDER BY total_bytes DESC
LIMIT 20;
```

Savjeti za Athena: flow logove u S3 piši u **Parquet** formatu sa **Hive-compatible** particijama, filtriraj po particiji (datum, Region, nalog) i čuvaj rezultate upita u šifrovanom bucketu.

> **Na ispitu:** „Athena queries over CloudTrail logs are **slow and expensive**“ = particionisanje (partition projection) i filtriranje po particiji, ili konverzija u Parquet. Povećanje „Athena kapaciteta“ nije rješenje.

## Normalizacija, parsiranje i korelacija (1.2.5)

- **Amazon OpenSearch Service**: full-text pretraga, dashboardi (OpenSearch Dashboards), **Security Analytics** (detektori, Sigma pravila) i korelacija događaja. Dobra za SOC koji treba pretragu skoro u realnom vremenu.
- **AWS Lambda**: parsiranje i obogaćivanje. Tipično kao **Firehose data transformation** (svaki batch prolazi kroz funkciju: parsiranje, dodavanje GeoIP podataka ili naziva naloga, maskiranje) ili kao target subscription filtera.
- **Amazon Managed Grafana**: managed Grafana sa prijavom preko IAM Identity Center (ili SAML). Spaja više izvora (CloudWatch, Athena, OpenSearch, Timestream, Prometheus) u jedan dashboard za korelaciju.
- **Security Lake + Athena**: OCSF znači da isti upit radi nad CloudTrail, flow i DNS podacima jer su polja normalizovana.

Primjer pipelinea: CloudWatch Logs (više naloga) → subscription filter → Firehose → Lambda (normalizacija, obogaćivanje) → OpenSearch Service (pretraga) i S3 (arhiva).

## Mrežni izvori logova u detalje (1.2.6)

### VPC Flow Logs

Nivo: **VPC**, **subnet** ili **ENI**. Odredišta: **CloudWatch Logs**, **S3** (plain text ili Parquet), **Amazon Data Firehose**. Agregacioni interval 10 min (podrazumijevano) ili 1 min. Isporuka je best effort.

**Default format** sadrži polja verzije 2:

```text
version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes start end action log-status
2 111122223333 eni-0a1b2c3d 198.51.100.7 10.0.1.25 51544 22 6 3 180 1760433000 1760433060 REJECT OK
```

Za više polja koristiš **custom format**. Polje `version` u zapisu je najviša verzija upotrijebljenih polja.

| Verzija | Važna polja | Čemu služe |
|---|---|---|
| 2 (default) | srcaddr, dstaddr, ports, protocol, bytes, action, log-status | Osnovna analiza |
| 3 | vpc-id, subnet-id, instance-id, **tcp-flags**, type, **pkt-srcaddr**, **pkt-dstaddr** | Originalne IP adrese iza NAT gatewaya ili EKS podova; SYN bez odgovora (skeniranje) |
| 4 | region, az-id, sublocation-type, sublocation-id | Lokacija (AZ, Local Zone, Outpost) |
| 5 | **pkt-src-aws-service**, **pkt-dst-aws-service**, **flow-direction**, **traffic-path** | Da li je odredište AWS servis (npr. S3), smjer, kojim putem izlazi (IGW, VGW, peering, endpoint) |
| 7 | ecs-cluster-name, ecs-task-id, ecs-service-name… | Vezivanje toka za ECS task |
| 8 i novije | reject-reason (npr. VPC Block Public Access), encryption-status, oznake instanci i ENI-ja | Zašto je tok odbijen, da li je šifrovan |

### Transit Gateway flow logs

Bilježe tokove **na transit gatewayu** (po attachmentu), uključujući saobraćaj između VPC-ova, VPN i Direct Connect attachmenata. Korisno u hub-and-spoke arhitekturi kada istražuješ lateralno kretanje između VPC-ova ili saobraćaj sa on-premises mrežom, bez uključivanja flow logova u svakom spoke VPC-u.

### Route 53 Resolver query logs

Bilježe DNS upite iz VPC-a prema Route 53 Resolveru (ime, tip zapisa, odgovor, izvorna instanca). Konfiguracija se dijeli kroz **AWS RAM** na više VPC-ova i naloga. Koristi se za otkrivanje C2 domena i DNS tunelovanja. Za **blokiranje** zlonamjernih domena koristi **Route 53 Resolver DNS Firewall**.

### Ostali izvori

- **ELB access logs**: isključeni podrazumijevano, idu u S3 (bucket policy mora dozvoliti log delivery). ALB ima i **connection logs** (TLS detalji, mTLS).
- **CloudFront**: standard logging (v2) u S3, CloudWatch Logs ili Firehose; **real-time logs** u Kinesis Data Streams za odmah dostupne podatke.
- **S3 server access logs**: besplatno se uključuju (plaća se samo storage), best effort isporuka, sadrže HTTP detalje. **CloudTrail data events** su strukturisani, pouzdaniji, sa identitetom i mogu ići u CloudWatch Logs i EventBridge, ali se plaćaju.
- **AWS WAF logs**: odredište je CloudWatch Logs log grupa, S3 bucket ili Firehose stream čije ime **mora počinjati sa `aws-waf-logs-`**. Polja sa osjetljivim podacima (npr. `Authorization` header) mogu se **redaktovati**, a logging filter može čuvati samo blokirane zahtjeve.
- **AWS Network Firewall**: alert, flow i TLS logovi u S3, CloudWatch Logs ili Firehose.

## Rezime

- Znaj šta koji log sadrži: CloudTrail management/data/network activity/Insights, flow logs (metapodaci, bez DNS-a i IMDS-a), Resolver query logs (DNS), WAF/ALB/CloudFront logovi (HTTP).
- Organization trail iz management ili delegated admin naloga u bucket Log Archive naloga; članovi ga ne mogu mijenjati.
- Integritet: log file validation (dokaz), Object Lock compliance (sprečavanje), SCP protiv gašenja trailova, KMS key policy za servis.
- Centralni CloudWatch logging nalog: subscription filter → destination → Kinesis/Firehose; cross-account observability za pregled bez kopiranja.
- Security Lake normalizuje u OCSF/Parquet, ima data access i query access (Lake Formation) subscribere za SIEM.
- Analiza: Logs Insights za ad hoc u CloudWatch Logs, Athena sa particijama za S3, OpenSearch za pretragu i korelaciju, Lambda za obogaćivanje, Managed Grafana za zajedničke dashboarde.
- Flow log verzije: v3 (pkt-srcaddr, tcp-flags), v5 (pkt-dst-aws-service, flow-direction, traffic-path); Transit Gateway flow logs za hub-and-spoke.
