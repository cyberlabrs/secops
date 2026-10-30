## Exam objective: 1.2

Task **1.2 Design and implement logging solutions** is the broadest task in domain 1. Skills the exam tests:

- **1.2.1** choosing log sources and storage locations based on a requirement,
- **1.2.2** configuring logging: a CloudTrail trail for the organization, a dedicated logging account, the CloudWatch agent,
- **1.2.3** log storage and data lake (Amazon Security Lake) and integration with third-party tools (SIEM),
- **1.2.4** log analysis: CloudWatch Logs Insights, Amazon Athena, Security Hub findings,
- **1.2.5** normalization, parsing, and correlation: Amazon OpenSearch Service, AWS Lambda, Amazon Managed Grafana,
- **1.2.6** sources based on network design and threats: VPC Flow Logs, Transit Gateway flow logs, Route 53 Resolver logs.

Typical questions: "Which log detects X?", "How do you guarantee that no one can modify the logs?", "How do you cheaply query logs from the last 5 years?". The key is knowing **what each log contains and what it does not**.

## Which log for which threat (1.2.1, 1.2.6)

| Investigation question | Log source |
|---|---|
| Who deleted an IAM role, changed a security group, disabled CloudTrail? | **CloudTrail management events** |
| Who read or deleted an object in S3? Who invoked a Lambda function? | **CloudTrail data events** (not enabled by default) |
| Which API calls went through a VPC endpoint, including denied calls from other accounts? | **CloudTrail network activity events** |
| An unusual spike in the number of API calls or errors | **CloudTrail Insights events** |
| Which IP addresses tried SSH to an instance, how many bytes left? | **VPC Flow Logs** |
| Traffic between VPCs and the on-premises network through a Transit Gateway | **Transit Gateway flow logs** |
| Which domains did an instance resolve (C2, DNS tunneling)? | **Route 53 Resolver query logs** |
| HTTP requests, status codes, user agent, paths | **ALB/NLB access logs**, **CloudFront logs**, **API Gateway access logs** |
| Which requests were blocked by an SQLi/XSS rule or a rate limit | **AWS WAF logs** |
| Who accessed objects of a static website (referer, HTTP status), at low cost | **S3 server access logs** |
| Kubernetes API calls (kubectl exec, RBAC changes) | **EKS control plane audit logs** |
| OS and application logs on EC2 | **CloudWatch agent** → CloudWatch Logs |

> **On the exam:** VPC Flow Logs record **metadata** (IP, port, bytes, ACCEPT/REJECT), not packet contents. For contents you need **Traffic Mirroring**. Flow logs also **do not record** traffic to the Amazon DNS server (Route 53 Resolver), the instance metadata service (169.254.169.254), the Amazon Time Sync Service, and DHCP. For DNS use **Route 53 Resolver query logs**.

## AWS CloudTrail

### Event types

| Type | What it records | Default |
|---|---|---|
| **Management events** | Control plane operations (CreateUser, PutBucketPolicy, RunInstances), read and write | Yes (in a trail: read+write) |
| **Data events** | Data operations: S3 objects, Lambda Invoke, DynamoDB items, and other resource types | No; enabled with **advanced event selectors** (filter by resource, eventName, readOnly…) |
| **Network activity events** | API calls that go through a VPC endpoint, including those denied by the endpoint policy | No |
| **Insights events** | Deviations from the baseline in **API call rate** and **API error rate**, for management and data events | No (charged extra) |

**Event history** in the console shows 90 days of management events for free, but only for one account and Region. It is not a long-term solution.

### Organization trail and the Log Archive account (1.2.2)

- An **organization trail** is created by the **management account** or a **delegated administrator** for CloudTrail. It records all accounts, including future ones.
- Members can see the trail but cannot delete, stop, or modify it.
- Structure in the bucket: `AWSLogs/o-exampleorgid/111122223333/CloudTrail/eu-central-1/2026/10/14/...`.
- The bucket lives in a dedicated **Log Archive** account (AWS Security Reference Architecture; Control Tower creates it automatically). Only a few roles have access (read for investigations), and nobody has delete.

Bucket policy in the Log Archive account (abridged):

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

If the bucket is encrypted with **SSE-KMS**, the key policy must allow `cloudtrail.amazonaws.com` the `kms:GenerateDataKey*` action (with `aws:SourceArn`), and allow `kms:Decrypt` for those who read the logs.

### Integrity and immutability

- **Log file integrity validation**: every hour CloudTrail creates a **digest file** with SHA-256 hashes of the log files, signed with a private key (RSA). Digest files are chained. Verification:

```bash
aws cloudtrail validate-logs \
  --trail-arn arn:aws:cloudtrail:eu-central-1:111111111111:trail/org-trail \
  --start-time 2026-10-01T00:00:00Z
```

- **S3 Object Lock** (compliance mode) prevents deletion and overwriting, even by the root user, until the retention period expires.
- An **SCP** that denies `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `cloudtrail:UpdateTrail` in member accounts.
- Validation **proves** that a file was modified or deleted; Object Lock **prevents** it. On the exam you often need both.

> **On the exam:** "Prove to auditors that log files were not **modified or deleted** after delivery" = **log file integrity validation**. "**Prevent** anyone, including administrators, from deleting logs for 7 years" = **S3 Object Lock in compliance mode** (governance mode allows deletion with a special permission).

### Example CloudTrail record

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

Fields you use most often in an investigation: `userIdentity` (who, with which key, through which role: `sessionContext.sessionIssuer`), `sourceIPAddress`, `eventName`, `errorCode` (AccessDenied suggests reconnaissance), `requestParameters`.

### CloudTrail Lake

**CloudTrail Lake** stores events in an **event data store** (columnar ORC format) and allows SQL queries (Trino) without setting up Athena yourself. An event data store can ingest CloudTrail events, Config configuration items, Audit Manager evidence, and events from outside AWS (integrations via `PutAuditEvents`). Retention is up to about 10 years with the appropriate pricing option; federation into the AWS Glue Data Catalog for Athena queries is available.

Availability note: AWS announced that from **May 31, 2026**, CloudTrail Lake is no longer open to new customers; existing customers continue to use it. For new solutions you will more often choose a trail to S3 + Athena or Security Lake, but the term may still appear in questions.

## CloudWatch Logs and a dedicated logging account (1.2.2)

- A **log group** has a retention period (from 1 day to unlimited) and optionally a **KMS key** (the key policy must allow `logs.<region>.amazonaws.com`).
- The **CloudWatch agent** sends OS and application logs and metrics (configuration in Parameter Store, see module 1).
- A **subscription filter** streams logs in real time to **Lambda**, **Kinesis Data Streams**, **Amazon Data Firehose**, or **OpenSearch Service**. There is a small number of subscription filters per log group (two), so for broader cases there is also an **account-level subscription filter policy**.
- **Central logging account**: in the destination account you create a **CloudWatch Logs destination** (backed by Kinesis Data Streams or Firehose) with a destination policy that allows the source accounts or the entire organization. In the source accounts the subscription filter points to the destination ARN.

```bash
# in the source account: send all logs from the VPC flow log group to the central destination
aws logs put-subscription-filter --log-group-name /vpc/flow \
  --filter-name to-central --filter-pattern "" \
  --destination-arn arn:aws:logs:eu-central-1:999988887777:destination:central-sec-logs
```

- **CloudWatch cross-account observability** (a monitoring account + links from source accounts) lets one account search the logs and metrics of others without copying data.
- A **data protection policy** on a log group masks sensitive data (details in the data protection module).

> **On the exam:** "Stream logs from all accounts to a central account in **near real time** for a SIEM" = **subscription filter → CloudWatch Logs destination → Kinesis Data Streams/Firehose**. Export to S3 (`create-export-task`) is not real time.

## Amazon Security Lake and OCSF (1.2.3)

**Amazon Security Lake** builds a security data lake in your account (S3 buckets that you manage):

- **Normalization**: converts data from supported AWS sources to **Apache Parquet** and the **Open Cybersecurity Schema Framework (OCSF)** schema.
- **AWS sources**: CloudTrail management and data events (S3, Lambda), EKS audit logs, Route 53 Resolver query logs, Security Hub CSPM findings, VPC Flow Logs, AWS WAFv2 logs.
- **Custom sources**: third-party and on-premises data, which you must deliver already in OCSF/Parquet format.
- **Multi-account**: a delegated administrator from Organizations; a **rollup Region** consolidates data from multiple Regions (watch for data residency requirements).
- **Lifecycle**: retention and transition to cheaper S3 storage classes.
- **Subscribers**:
  - a **data access** subscriber receives notifications (SQS/HTTPS endpoint) and reads objects directly from S3, typically a SIEM that ingests data,
  - a **query access** subscriber receives tables through **AWS Lake Formation** sharing and queries them in place (Athena, Redshift, partner tools).

> **On the exam:** "Normalize security logs from AWS **and third-party** sources into an **open standard schema** and let an external SIEM consume them" = **Security Lake** (OCSF) + subscriber. Security Hub CSPM uses ASFF and is not a data lake for raw logs.

### SIEM integration

| Method | When |
|---|---|
| Security Lake subscriber (data or query access) | The SIEM supports OCSF/Security Lake (many partners have a ready-made integration) |
| Firehose → HTTP endpoint / Splunk / OpenSearch | Real-time log streaming |
| S3 + SQS notifications | The SIEM itself pulls new files from the bucket |
| EventBridge API destination | Sending individual findings to a SIEM/ticketing system |

## Log analysis (1.2.4)

| Tool | Best for | Limitation |
|---|---|---|
| **CloudWatch Logs Insights** | Quick ad hoc queries over log groups, multiple groups at once | Only data in CloudWatch Logs; you pay for scanned volume |
| **Amazon Athena** | SQL over S3 (CloudTrail, VPC Flow, ALB, CloudFront, WAF logs), long-term data | Needs a table in the Glue Data Catalog; partitions for performance |
| **CloudTrail Lake** | SQL over CloudTrail events without setting up tables | Existing customers only (see above) |
| **Security Hub** | Reviewing, filtering, and grouping findings (insights) | Findings, not raw logs |

### CloudWatch Logs Insights examples

```text
# VPC Flow Logs: who most often attempts SSH and gets rejected
fields @timestamp, srcAddr, dstAddr, dstPort, action
| filter action = "REJECT" and dstPort = 22
| stats count(*) as attempts by srcAddr
| sort attempts desc
| limit 20
```

```text
# CloudTrail in CloudWatch Logs: who gets AccessDenied (possible reconnaissance)
fields @timestamp, eventName, userIdentity.arn, sourceIPAddress
| filter errorCode in ["AccessDenied", "UnauthorizedOperation"]
| stats count(*) as denied by userIdentity.arn, eventName
| sort denied desc
```

```text
# Lambda: errors per hour
filter @message like /ERROR/
| stats count(*) as errors by bin(1h)
```

### Athena examples

For CloudTrail, use a table with **partition projection** so that Athena does not scan every year of logs:

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
-- what the compromised access key did over the last two weeks
SELECT eventtime, eventsource, eventname, sourceipaddress, awsregion, errorcode
FROM cloudtrail_logs
WHERE useridentity.accesskeyid = 'AKIAIOSFODNN7EXAMPLE'
  AND "timestamp" >= '2026/10/01'
ORDER BY eventtime;
```

```sql
-- VPC Flow Logs in S3: the largest outbound flows to the internet
SELECT srcaddr, dstaddr, SUM(bytes) AS total_bytes
FROM vpc_flow_logs
WHERE action = 'ACCEPT' AND flow_direction = 'egress'
  AND day = '2026/10/14'
GROUP BY srcaddr, dstaddr
ORDER BY total_bytes DESC
LIMIT 20;
```

Athena tips: write flow logs to S3 in **Parquet** format with **Hive-compatible** partitions, filter by partition (date, Region, account), and store query results in an encrypted bucket.

> **On the exam:** "Athena queries over CloudTrail logs are **slow and expensive**" = partitioning (partition projection) and filtering by partition, or conversion to Parquet. Increasing "Athena capacity" is not the answer.

## Normalization, parsing, and correlation (1.2.5)

- **Amazon OpenSearch Service**: full-text search, dashboards (OpenSearch Dashboards), **Security Analytics** (detectors, Sigma rules), and event correlation. Good for a SOC that needs near real-time search.
- **AWS Lambda**: parsing and enrichment. Typically as a **Firehose data transformation** (each batch passes through the function: parsing, adding GeoIP data or account names, masking) or as a subscription filter target.
- **Amazon Managed Grafana**: managed Grafana with sign-in through IAM Identity Center (or SAML). Combines multiple sources (CloudWatch, Athena, OpenSearch, Timestream, Prometheus) into a single dashboard for correlation.
- **Security Lake + Athena**: OCSF means the same query works over CloudTrail, flow, and DNS data because the fields are normalized.

Example pipeline: CloudWatch Logs (multiple accounts) → subscription filter → Firehose → Lambda (normalization, enrichment) → OpenSearch Service (search) and S3 (archive).

## Network log sources in detail (1.2.6)

### VPC Flow Logs

Level: **VPC**, **subnet**, or **ENI**. Destinations: **CloudWatch Logs**, **S3** (plain text or Parquet), **Amazon Data Firehose**. Aggregation interval of 10 min (default) or 1 min. Delivery is best effort.

The **default format** contains version 2 fields:

```text
version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes start end action log-status
2 111122223333 eni-0a1b2c3d 198.51.100.7 10.0.1.25 51544 22 6 3 180 1760433000 1760433060 REJECT OK
```

For more fields you use a **custom format**. The `version` field in a record is the highest version of the fields used.

| Version | Important fields | Purpose |
|---|---|---|
| 2 (default) | srcaddr, dstaddr, ports, protocol, bytes, action, log-status | Basic analysis |
| 3 | vpc-id, subnet-id, instance-id, **tcp-flags**, type, **pkt-srcaddr**, **pkt-dstaddr** | Original IP addresses behind a NAT gateway or EKS pods; SYN without a reply (scanning) |
| 4 | region, az-id, sublocation-type, sublocation-id | Location (AZ, Local Zone, Outpost) |
| 5 | **pkt-src-aws-service**, **pkt-dst-aws-service**, **flow-direction**, **traffic-path** | Whether the destination is an AWS service (e.g., S3), direction, which path traffic leaves through (IGW, VGW, peering, endpoint) |
| 7 | ecs-cluster-name, ecs-task-id, ecs-service-name… | Linking a flow to an ECS task |
| 8 and later | reject-reason (e.g., VPC Block Public Access), encryption-status, instance and ENI tags | Why a flow was rejected, whether it is encrypted |

### Transit Gateway flow logs

They record flows **on the transit gateway** (per attachment), including traffic between VPCs, VPN, and Direct Connect attachments. Useful in a hub-and-spoke architecture when you investigate lateral movement between VPCs or traffic with the on-premises network, without enabling flow logs in every spoke VPC.

### Route 53 Resolver query logs

They record DNS queries from a VPC to the Route 53 Resolver (name, record type, response, source instance). The configuration is shared through **AWS RAM** across multiple VPCs and accounts. Used to detect C2 domains and DNS tunneling. To **block** malicious domains, use **Route 53 Resolver DNS Firewall**.

### Other sources

- **ELB access logs**: disabled by default, go to S3 (the bucket policy must allow log delivery). ALB also has **connection logs** (TLS details, mTLS).
- **CloudFront**: standard logging (v2) to S3, CloudWatch Logs, or Firehose; **real-time logs** to Kinesis Data Streams for immediately available data.
- **S3 server access logs**: free to enable (you pay only for storage), best-effort delivery, contain HTTP details. **CloudTrail data events** are structured, more reliable, include identity, and can go to CloudWatch Logs and EventBridge, but they are charged.
- **AWS WAF logs**: the destination is a CloudWatch Logs log group, S3 bucket, or Firehose stream whose name **must start with `aws-waf-logs-`**. Fields with sensitive data (e.g., the `Authorization` header) can be **redacted**, and a logging filter can keep only blocked requests.
- **AWS Network Firewall**: alert, flow, and TLS logs to S3, CloudWatch Logs, or Firehose.

## Summary

- Know what each log contains: CloudTrail management/data/network activity/Insights, flow logs (metadata, no DNS or IMDS), Resolver query logs (DNS), WAF/ALB/CloudFront logs (HTTP).
- Organization trail from the management or delegated admin account into a bucket in the Log Archive account; members cannot modify it.
- Integrity: log file validation (proof), Object Lock compliance (prevention), SCP against stopping trails, KMS key policy for the service.
- Central CloudWatch logging account: subscription filter → destination → Kinesis/Firehose; cross-account observability for viewing without copying.
- Security Lake normalizes to OCSF/Parquet and has data access and query access (Lake Formation) subscribers for a SIEM.
- Analysis: Logs Insights for ad hoc queries in CloudWatch Logs, Athena with partitions for S3, OpenSearch for search and correlation, Lambda for enrichment, Managed Grafana for shared dashboards.
- Flow log versions: v3 (pkt-srcaddr, tcp-flags), v5 (pkt-dst-aws-service, flow-direction, traffic-path); Transit Gateway flow logs for hub-and-spoke.
