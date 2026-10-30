## Ciljevi ispita: 1.1 i 1.3

Domen 1 (**Detection**) nosi 16% bodovanog sadržaja SCS-C03. Ovaj modul pokriva dva od tri zadatka:

- **1.1** dizajn i implementacija monitoringa i alarmiranja za nalog ili cijelu organizaciju: analiza workloada, health checks, agregacija događaja, metrike, alarmi i dashboardi, automatske procjene (Config conformance packs, Security Hub, Systems Manager State Manager),
- **1.3** troubleshooting: zašto Lambda, API Gateway ili CloudFront ne loguju, zašto CloudWatch agent ne šalje logove, zašto alarm ili EventBridge pravilo ne okida.

Logovanje i analiza logova (zadatak 1.2) su u sljedećem modulu.

Ispit ovdje rijetko pita „šta je GuardDuty“. Tipično pitanje izgleda ovako: „Kompanija ima 200 naloga u AWS Organizations. Sigurnosni tim želi da svaki novi nalog automatski ima uključenu detekciju prijetnji i da svi nalazi stižu u jedan nalog. Šta uraditi uz NAJMANJE operativnog napora?“ Odgovor je skoro uvijek kombinacija **delegated administrator** naloga, **auto-enable** opcije i centralne agregacije, a ne skripta koja obilazi naloge.

## Analiza workloada: šta uopšte pratiti (1.1.1)

Prije izbora servisa odredi koje prijetnje su realne za workload i koji signal ih otkriva.

| Workload | Prijetnje | Signal / servis |
|---|---|---|
| EC2 flota iza ALB-a | kriptominer, reverse shell, skeniranje | **GuardDuty** (VPC Flow Logs, DNS), **GuardDuty Runtime Monitoring**, Inspector |
| EKS klaster | privilegovan pod, krađa service account tokena | **GuardDuty EKS Protection** (audit logovi) + Runtime Monitoring |
| S3 data lake sa PII | javni bucket, eksfiltracija, osjetljivi podaci | **Amazon Macie**, GuardDuty **S3 Protection**, Security Hub kontrole |
| Upload portal (korisnici šalju fajlove) | malver u objektima | **GuardDuty Malware Protection for S3** |
| Serverless API | zloupotreba ključeva, greške, DoS | CloudWatch metrike (4XX/5XX, Throttles), API Gateway access logs, WAF |
| Cijela organizacija | odstupanje od standarda, loša konfiguracija | **AWS Config** + conformance packs, **Security Hub CSPM** standardi |

> **Na ispitu:** pazi na riječ u zahtjevu. „Detect **malicious activity** / compromised credentials“ = GuardDuty. „Discover **sensitive data** (PII) in S3“ = Macie. „Check resources against **CIS / best practices**“ = Security Hub CSPM ili Config. „Find **software vulnerabilities**“ = Inspector. „**Investigate / visualize** relationships after a finding“ = Detective.

## Amazon GuardDuty

**Amazon GuardDuty** je managed servis za detekciju prijetnji. Koristi threat intelligence, ML i detekciju anomalija nad logovima koje sam čita.

### Foundational data sources

Kada uključiš GuardDuty, on odmah analizira tri izvora:

- **CloudTrail management events**,
- **VPC Flow Logs**,
- **Route 53 Resolver DNS query logs**.

Važno: GuardDuty ih čita **nezavisnim, dupliranim tokom**. Ne moraš sam uključiti flow logove ni DNS logovanje, i GuardDuty ne mijenja tvoju postojeću konfiguraciju logova. Ako na ispitu ponuđeni odgovor kaže „first enable VPC Flow Logs so GuardDuty can analyze them“, to je distraktor.

### Zaštitni planovi (protection plans)

| Plan | Šta dodaje | Napomena |
|---|---|---|
| **S3 Protection** | Analiza CloudTrail **S3 data events** (GetObject, PutObject…) | Otkriva sumnjiv pristup i eksfiltraciju iz bucketa. |
| **EKS Protection** | Analiza **EKS audit logova** | GuardDuty ih čita sam, ne moraš uključiti control plane logging. |
| **Runtime Monitoring** | Agent (eBPF) na EKS, ECS (uključujući Fargate) i EC2 | Vidi procese, fajlove, mrežne konekcije unutar hosta/kontejnera. Agent se može automatski upravljati (automated agent configuration). |
| **Malware Protection for EC2** | Agentless skeniranje EBS volumena (preko snapshota) | **GuardDuty-initiated scan** kad nalaz ukazuje na malver, ili **on-demand scan** po ARN-u instance. |
| **Malware Protection for S3** | Skenira **nove** objekte u odabranim bucketima | Može tagovati objekte rezultatom skeniranja; tag se koristi u bucket policyju da blokira pristup zaraženim objektima. Može se koristiti i bez uključivanja ostatka GuardDutyja. |
| **RDS Protection** | Anomalije u prijavama na Aurora/RDS | |
| **Lambda Protection** | Mrežna aktivnost Lambda funkcija | Npr. funkcija komunicira sa kripto-pool adresom. |

> **Na ispitu:** „Detect malware in files that customers upload to an S3 bucket with the LEAST operational overhead“ = **GuardDuty Malware Protection for S3**, ne Lambda koja pokreće ClamAV. „Detect a reverse shell **inside a container**“ = **Runtime Monitoring**; EKS Protection vidi samo Kubernetes API (audit log), ne procese.

### Extended Threat Detection

**GuardDuty Extended Threat Detection** povezuje više događaja (API pozive, slabe signale i postojeće nalaze) u jedan **attack sequence** nalaz, u prozoru od 24 sata. Bitne činjenice:

- uključen je **automatski** čim je GuardDuty uključen i nema dodatnu cijenu,
- svi attack sequence nalazi su **Critical**,
- tipovi uključuju npr. `AttackSequence:IAM/CompromisedCredentials`, `AttackSequence:S3/CompromisedData`, `AttackSequence:EKS/CompromisedCluster`, `AttackSequence:ECS/CompromisedCluster` i `AttackSequence:EC2/CompromisedInstanceGroup`,
- više uključenih planova = više vrsta sekvenci. Za EKS sekvence treba EKS Protection i/ili Runtime Monitoring, za ECS i EC2 sekvence Runtime Monitoring, za S3 eksfiltraciju S3 Protection.
- arhivirani nalazi (uključujući one koje automatski arhivira **suppression rule**) **ne ulaze** u korelaciju. Preširoko suppression pravilo može „sakriti“ korak napada.

### Multi-account i podešavanje

- U AWS Organizations, management nalog postavlja **delegated administrator** (obično security tooling nalog). Admin uključuje GuardDuty i planove za članove i bira **auto-enable** za nove (ili sve) naloge.
- GuardDuty je **regionalan**: delegated admin i auto-enable treba podesiti u **svakom Regionu** koji koristiš.
- **Trusted IP lists** i **threat lists** (vlastite liste IP adresa), **suppression rules** za poznat benigni šum.
- Nalazi idu u **EventBridge** automatski. Novi nalaz odmah, a ažuriranja postojećeg (ponovljena aktivnost) po podesivoj frekvenciji (15 min, 1 h ili 6 h, podrazumijevano 6 h). Opcionalno izvoz u S3 bucket (šifrovan KMS ključem).

```bash
# iz management naloga: security tooling nalog postaje GuardDuty admin (po Regionu)
aws guardduty enable-organization-admin-account --admin-account-id 222233334444 --region eu-central-1

# iz delegated admin naloga: auto-enable za sve članove, uključujući S3 Protection
aws guardduty update-organization-configuration --detector-id <id> \
  --auto-enable-organization-members ALL \
  --features '[{"Name":"S3_DATA_EVENTS","AutoEnable":"ALL"}]'
```

## AWS Security Hub i Security Hub CSPM

Krajem 2025. AWS je podijelio ovo ime na dva servisa. Na ispitu i u dokumentaciji možeš sresti oba.

| | **AWS Security Hub CSPM** (raniji „Security Hub“) | **AWS Security Hub** (novi, unificirani) |
|---|---|---|
| Uloga | Cloud security posture management: provjere prema standardima | Centralno mjesto za prioritizaciju rizika |
| Šta radi | Kontrole iz **AWS Foundational Security Best Practices (FSBP)**, CIS, PCI DSS, NIST 800-53; prima nalaze GuardDuty, Inspector, Macie, partnera | Korelira signale iz Security Hub CSPM, GuardDuty, Inspector, Macie i IAM Access Analyzer u **exposure findings**; attack path graf; unused access nalazi; ticketing (Jira Cloud, ServiceNow) |
| Format nalaza | **AWS Security Finding Format (ASFF)** | **OCSF** |
| Zavisnost | Većina kontrola koristi **AWS Config** (moraš imati Config recorder) | Koristi nalaze CSPM-a i drugih servisa |

Ključne mogućnosti Security Hub CSPM koje ispit voli:

- **Cross-Region aggregation**: jedan aggregation Region prima nalaze iz povezanih Regiona.
- **Central configuration**: delegated admin pravi **configuration policies** (koji standardi i kontrole su uključeni) i primjenjuje ih na OU ili naloge, u svim Regionima, iz jednog mjesta.
- **Automation rules**: automatski mijenjaju polja nalaza (npr. podigni severity za produkcijske naloge, suprimiraj poznat izuzetak).
- **Custom actions**: dugme u konzoli koje šalje odabrane nalaze u EventBridge (npr. „Isolate instance“).
- Nalazi se ne prikupljaju retroaktivno: samo oni nastali nakon uključivanja.

> **Na ispitu:** „Centrally enable security standards for all accounts **and Regions** and prevent drift“ = Security Hub **central configuration** iz delegated admin naloga. Ako opcija nudi da u svakom nalogu ručno uključiš standard, to nije „the MOST operationally efficient“.

## Amazon Macie

**Amazon Macie** otkriva osjetljive podatke (PII, finansijski podaci, kredencijali) u S3 i ocjenjuje sigurnost bucketa.

- **Automated sensitive data discovery**: kontinuirano uzorkuje objekte u svim bucketima i daje sensitivity score po bucketu. Jeftiniji način da dobiješ pregled cijele organizacije.
- **Sensitive data discovery jobs**: ciljani jednokratni ili zakazani poslovi nad odabranim bucketima.
- **Custom data identifiers** (regex + ključne riječi) i **allow lists** za lažno pozitivne.
- Dvije vrste nalaza: **policy findings** (npr. bucket postao javan, šifrovanje isključeno) i **sensitive data findings**.
- Nalazi idu u EventBridge i u Security Hub. Multi-account preko delegated administratora.

## Amazon Detective kao izvor konteksta

**Amazon Detective** nije alat za alarmiranje, nego za istragu. Gradi **behavior graph** iz CloudTrail logova, VPC Flow Logova i GuardDuty nalaza (opcionalno EKS audit logova i nalaza iz Security Hub CSPM) i čuva do godinu dana podataka. Iz GuardDuty ili Security Hub nalaza jednim klikom (pivot) otvaraš profil entiteta: koje API pozive je ključ radio, sa kojih IP adresa, koliko je to odstupanje od uobičajenog. Detaljno u modulu o odgovoru na incidente.

## Agregacija sigurnosnih događaja (1.1.3)

Referentna arhitektura (AWS Security Reference Architecture) koristi poseban **Security Tooling** nalog:

```text
Management nalog ──(delegira)──> Security Tooling nalog
                                   ├─ GuardDuty delegated admin (svaki Region)
                                   ├─ Security Hub delegated admin + aggregation Region
                                   ├─ Macie, Inspector, Detective, Config aggregator
                                   └─ EventBridge pravila → SNS / Lambda / Step Functions
Log Archive nalog  ── CloudTrail org trail, Config snapshots, Security Lake (modul 2)
Member nalozi      ── workloadi; nalazi i događaji teku prema Security Tooling nalogu
```

Načini agregacije:

- **Delegated administrator** po servisu (GuardDuty, Security Hub, Macie, Inspector, Detective, Config, Firewall Manager…). Ne radi se svakodnevno iz management naloga.
- **AWS Config aggregator** (organization aggregator) za pregled usklađenosti svih naloga i Regiona.
- **EventBridge cross-account**: pravilo u članu šalje događaj na **event bus** u centralnom nalogu; bus ima resource policy koji dozvoljava `events:PutEvents` iz organizacije (`aws:PrincipalOrgID`).
- **CloudWatch cross-account observability**: monitoring nalog vidi metrike, logove i trace-ove izvornih naloga (sink/link) i pravi dashboarde preko svih.
- **Amazon Security Lake**: centralni data lake u OCSF formatu (modul 2).

## Metrike, alarmi i dashboardi (1.1.4)

### Metric filter nad CloudTrail logovima

Klasični CIS zahtjevi („alarm na root prijavu“, „alarm na promjenu security grupe“) rade se tako da CloudTrail šalje logove u **CloudWatch Logs**, a nad log grupom se napravi **metric filter** i **alarm**.

```bash
aws logs put-metric-filter --log-group-name org-trail \
  --filter-name RootUsage \
  --filter-pattern '{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != "AwsServiceEvent" }' \
  --metric-transformations metricName=RootUsageCount,metricNamespace=CISBenchmark,metricValue=1

aws cloudwatch put-metric-alarm --alarm-name root-usage \
  --namespace CISBenchmark --metric-name RootUsageCount \
  --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions arn:aws:sns:eu-central-1:111122223333:security-alerts
```

### Vrste alarma

- **Static threshold**: npr. više od 5 `UnauthorizedOperation` grešaka u 5 minuta.
- **Anomaly detection alarm**: CloudWatch nauči očekivani opseg metrike (sezonalnost) i alarmira kad izađe iz pojasa. Dobro za „neuobičajen broj zahtjeva“ kad ne znaš fiksni prag.
- **Composite alarm**: kombinuje alarme logikom (`ALARM(a) AND ALARM(b)`) i smanjuje šum.
- **Metric math** i **Logs Insights** upiti mogu se dodati na **CloudWatch dashboard**; dashboard može prikazivati metrike više naloga i Regiona.

### EventBridge pravila za nalaze

Nalazi sigurnosnih servisa dolaze u EventBridge u Regionu gdje su nastali. Pravilo filtrira i šalje na target.

```json
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": {
    "severity": [{ "numeric": [">=", 7] }]
  }
}
```

Česti `detail-type`: `GuardDuty Finding`, `Security Hub Findings - Imported` (CSPM, ASFF), `Macie Finding`, `Inspector2 Finding`. Targeti: SNS, Lambda, Step Functions, SSM Automation, SQS, event bus u drugom nalogu, API destination (npr. SIEM ili PagerDuty).

> **Na ispitu:** „Notify the team when GuardDuty generates a **high severity** finding“ = EventBridge pravilo sa numeričkim filterom na `severity` + SNS. Ne CloudWatch alarm nad metrikom, i ne Lambda koja periodično zove `ListFindings`.

## Health checks i monitoring dostupnosti (1.1.2)

- **Route 53 health checks**: provjeravaju endpoint (HTTP/HTTPS/TCP), drugi health check (calculated) ili **stanje CloudWatch alarma**. Za privatne resurse koje Route 53 checkeri ne mogu dosegnuti koristi health check zasnovan na CloudWatch alarmu. Metrika `HealthCheckStatus` objavljuje se u **us-east-1**, pa se tamo pravi i alarm.
- **ELB health checks**: target grupa izbacuje nezdrave targete; metrike `UnHealthyHostCount`, `HTTPCode_ELB_5XX_Count`.
- **CloudWatch Synthetics** canaries: skripte koje periodično simuliraju korisnika (login, API poziv).
- **AWS Health** događaji (npr. `AWS_RISK_CREDENTIALS_EXPOSED` kad AWS otkrije javno izložen ključ) takođe dolaze u EventBridge (`source: aws.health`).

## Automatske procjene i istrage (1.1.5)

| Alat | Šta radi | Primjer |
|---|---|---|
| **AWS Config rules** | Ocjenjuju konfiguraciju resursa (managed ili custom Lambda/Guard pravila) | `s3-bucket-public-read-prohibited`, `restricted-ssh` |
| **Config conformance pack** | Paket pravila + remedijacija u jednom YAML šablonu; **organization conformance pack** se deployuje na sve naloge | Operational Best Practices for CIS, PCI, HIPAA |
| **Config remediation** | Automatska ili ručna remedijacija preko **SSM Automation** dokumenta | `AWS-DisableS3BucketPublicReadWrite` |
| **Security Hub CSPM standardi** | Periodične i promjenama okidane provjere sa skorom | FSBP, CIS |
| **Systems Manager State Manager** | **Association** održava instance u željenom stanju po rasporedu | Uvijek instaliran i pokrenut CloudWatch agent, inventory, zatvoren port |
| **Amazon Inspector** | Kontinuirano skeniranje EC2, ECR imagea, Lambda | CVE nalazi sa prioritetom |

```bash
# State Manager: svakih 30 minuta provjeri da je CloudWatch agent konfigurisan (tag Env=prod)
aws ssm create-association --name AmazonCloudWatch-ManageAgent \
  --targets Key=tag:Env,Values=prod \
  --parameters action=configure,optionalConfigurationSource=ssm,optionalConfigurationLocation=AmazonCloudWatch-linux \
  --schedule-expression "rate(30 minutes)"
```

> **Na ispitu:** „Ensure **continuously** that a configuration stays in the desired state on EC2 instances“ = **State Manager association**. Jednokratna komanda je **Run Command**, a višekoračni workflow (npr. snapshot pa izolacija) je **Automation runbook**.

## Troubleshooting monitoringa i logovanja (1.3)

Na ispitu je skoro uvijek uzrok jedan od tri: **dozvole** (IAM rola ili resource policy), **konfiguracija** (logovanje nije uključeno na pravom mjestu ili u pravom Regionu) ili **mreža** (agent ne može do endpointa).

### Simptom → uzrok → rješenje

| Simptom | Najčešći uzrok | Rješenje |
|---|---|---|
| Lambda radi, ali nema log grupe/logova | Execution rola nema `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` | Dodaj `AWSLambdaBasicExecutionRole` ili ekvivalent. Provjeri i postavku log grupe (Lambda može pisati u custom log grupu) i log level (advanced logging controls, JSON format). |
| API Gateway REST API nema execution logova | Na nivou naloga i Regiona nije postavljen **CloudWatch Logs role ARN** u API Gateway postavkama | Napravi rolu kojoj vjeruje `apigateway.amazonaws.com` (`AmazonAPIGatewayPushToCloudWatchLogs`) i upiši je u account settings, pa uključi logging na **stage-u**. Access logs traže i ARN odredišta i format. |
| CloudFront access logovi ne stižu u S3 (legacy standard logging) | Bucket ima **Object Ownership = Bucket owner enforced** (ACL isključeni) | Legacy logging piše preko ACL-a; uključi ACL-ove ili pređi na **standard logging (v2)**, koji ide preko CloudWatch vended logs (S3, CloudWatch Logs, Firehose). Kod v2 preko API-ja konfiguracija se radi u **us-east-1**. |
| CloudWatch agent radi, ali logovi ne dolaze | Rola instance bez `CloudWatchAgentServerPolicy`; privatni subnet bez NAT-a ili **interface VPC endpointa** za `logs`/`monitoring`; pogrešna putanja fajla ili agent nema pravo čitanja fajla | Popravi rolu, dodaj VPC endpoint, provjeri `file_path` u JSON konfiguraciji i log agenta |
| VPC Flow Logs ka CloudWatch Logs ne rade | IAM rola za flow log nema trust na `vpc-flow-logs.amazonaws.com` ili nema `logs:PutLogEvents` | Popravi trust i permission policy |
| Logovi ka S3 sa SSE-KMS ne stižu | Key policy ne dozvoljava servisu (`delivery.logs.amazonaws.com`, `cloudtrail.amazonaws.com`) `kms:GenerateDataKey*` | Dodaj izjavu u **key policy** uz `aws:SourceAccount`/`aws:SourceArn` |
| EventBridge pravilo ne okida | Pravilo je u drugom Regionu od nalaza; pogrešan event pattern | Napravi pravilo u svakom Regionu ili agregiraj; testiraj pattern sa `aws events test-event-pattern` |
| Pravilo okida, ali SNS poruka ne stiže | SNS topic je šifrovan **KMS ključem** čija key policy ne dozvoljava `events.amazonaws.com`; ili topic policy ne dozvoljava `sns:Publish` | Koristi customer managed key i dodaj dozvolu u key policy; popravi topic policy |
| Lambda target ne dobija događaj | Nema **resource-based policy** na funkciji za `events.amazonaws.com` | `aws lambda add-permission` sa `SourceArn` pravila |
| Route 53 health check stalno „unhealthy“ | Security group ili NACL blokira IP opsege Route 53 health checkera; pogrešan path ili očekivani string | Dozvoli opsege `ROUTE53_HEALTHCHECKS` (iz `ip-ranges.json`), ispravi konfiguraciju |
| GuardDuty Runtime Monitoring pokazuje „unhealthy coverage“ | Agent ne može do GuardDuty endpointa (nema VPC endpointa) ili nije instaliran | Uključi automated agent configuration ili napravi VPC endpoint ručno; provjeri SSM za EC2 |

### CloudWatch agent: brza dijagnostika

```bash
# status agenta
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
# log samog agenta: tu su greške tipa AccessDenied ili "no such file"
sudo tail -50 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
# ponovo učitaj konfiguraciju iz Parameter Store-a
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -c ssm:AmazonCloudWatch-linux -s
```

Dio konfiguracije agenta za logove:

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          { "file_path": "/var/log/secure", "log_group_name": "/ec2/secure", "log_stream_name": "{instance_id}" }
        ]
      }
    }
  }
}
```

> **Na ispitu:** kada „logovi ne stižu“, prvo pogledaj da li opis spominje **privatni subnet bez interneta** (rješenje: VPC endpoint), **novu KMS enkripciju** (rješenje: key policy) ili **novi bucket sa isključenim ACL-ovima** (rješenje: CloudFront v2 logging ili uključeni ACL-ovi). Odgovor „restart the instance“ ili „increase log retention“ gotovo nikad nije tačan.

## Rezime

- GuardDuty čita CloudTrail management, VPC Flow i DNS logove sam; planovi (S3, EKS, Runtime, Malware for EC2/S3, RDS, Lambda) proširuju vidljivost. Extended Threat Detection je uključen automatski i daje Critical attack sequence nalaze.
- U organizaciji: delegated administrator u Security Tooling nalogu, auto-enable i podešavanje u svakom Regionu.
- Security Hub CSPM radi provjere prema standardima (ASFF, zavisi od AWS Config); novi Security Hub korelira signale u exposure nalaze (OCSF).
- Macie = osjetljivi podaci u S3; Detective = istraga i kontekst, ne alarmiranje.
- Alarmi: metric filter nad CloudTrail logovima, anomaly detection i composite alarmi; nalazi idu kroz EventBridge pravila na SNS, Lambda, Step Functions ili SSM.
- Automatske procjene: Config rules i conformance packs sa SSM remedijacijom, Security Hub standardi, State Manager za stalno željeno stanje.
- Troubleshooting: provjeri IAM rolu/resource policy, KMS key policy, Region i mrežni put do endpointa (VPC endpoint).
