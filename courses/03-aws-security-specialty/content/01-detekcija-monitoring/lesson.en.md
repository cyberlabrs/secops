## Exam objectives: 1.1 and 1.3

Domain 1 (**Detection**) carries 16% of the scored content on SCS-C03. This module covers two of its three tasks:

- **1.1** designing and implementing monitoring and alerting for an account or an entire organization: workload analysis, health checks, event aggregation, metrics, alarms and dashboards, automated assessments (Config conformance packs, Security Hub, Systems Manager State Manager),
- **1.3** troubleshooting: why Lambda, API Gateway, or CloudFront are not logging, why the CloudWatch agent is not sending logs, why an alarm or EventBridge rule does not fire.

Logging and log analysis (task 1.2) are covered in the next module.

The exam rarely asks "what is GuardDuty" here. A typical question looks like this: "A company has 200 accounts in AWS Organizations. The security team wants every new account to automatically have threat detection enabled and all findings delivered to one account. What should they do with the LEAST operational overhead?" The answer is almost always a combination of a **delegated administrator** account, the **auto-enable** option, and central aggregation, not a script that loops through accounts.

## Workload analysis: what to monitor in the first place (1.1.1)

Before choosing services, determine which threats are realistic for the workload and which signal detects them.

| Workload | Threats | Signal / service |
|---|---|---|
| EC2 fleet behind an ALB | cryptominer, reverse shell, scanning | **GuardDuty** (VPC Flow Logs, DNS), **GuardDuty Runtime Monitoring**, Inspector |
| EKS cluster | privileged pod, service account token theft | **GuardDuty EKS Protection** (audit logs) + Runtime Monitoring |
| S3 data lake with PII | public bucket, exfiltration, sensitive data | **Amazon Macie**, GuardDuty **S3 Protection**, Security Hub controls |
| Upload portal (users submit files) | malware in objects | **GuardDuty Malware Protection for S3** |
| Serverless API | key abuse, errors, DoS | CloudWatch metrics (4XX/5XX, Throttles), API Gateway access logs, WAF |
| Entire organization | drift from standards, misconfiguration | **AWS Config** + conformance packs, **Security Hub CSPM** standards |

> **On the exam:** watch the wording of the requirement. "Detect **malicious activity** / compromised credentials" = GuardDuty. "Discover **sensitive data** (PII) in S3" = Macie. "Check resources against **CIS / best practices**" = Security Hub CSPM or Config. "Find **software vulnerabilities**" = Inspector. "**Investigate / visualize** relationships after a finding" = Detective.

## Amazon GuardDuty

**Amazon GuardDuty** is a managed threat detection service. It uses threat intelligence, ML, and anomaly detection over logs that it reads on its own.

### Foundational data sources

When you enable GuardDuty, it immediately analyzes three sources:

- **CloudTrail management events**,
- **VPC Flow Logs**,
- **Route 53 Resolver DNS query logs**.

Important: GuardDuty reads them through an **independent, duplicated stream**. You do not need to enable flow logs or DNS logging yourself, and GuardDuty does not change your existing log configuration. If an answer option on the exam says "first enable VPC Flow Logs so GuardDuty can analyze them", that is a distractor.

### Protection plans

| Plan | What it adds | Note |
|---|---|---|
| **S3 Protection** | Analysis of CloudTrail **S3 data events** (GetObject, PutObject…) | Detects suspicious access and exfiltration from buckets. |
| **EKS Protection** | Analysis of **EKS audit logs** | GuardDuty reads them itself; you do not need to enable control plane logging. |
| **Runtime Monitoring** | Agent (eBPF) on EKS, ECS (including Fargate), and EC2 | Sees processes, files, and network connections inside the host/container. The agent can be managed automatically (automated agent configuration). |
| **Malware Protection for EC2** | Agentless scanning of EBS volumes (via snapshots) | **GuardDuty-initiated scan** when a finding indicates malware, or an **on-demand scan** by instance ARN. |
| **Malware Protection for S3** | Scans **new** objects in selected buckets | Can tag objects with the scan result; the tag is used in a bucket policy to block access to infected objects. Can be used without enabling the rest of GuardDuty. |
| **RDS Protection** | Anomalies in Aurora/RDS logins | |
| **Lambda Protection** | Network activity of Lambda functions | E.g., a function communicating with a crypto-pool address. |

> **On the exam:** "Detect malware in files that customers upload to an S3 bucket with the LEAST operational overhead" = **GuardDuty Malware Protection for S3**, not a Lambda function running ClamAV. "Detect a reverse shell **inside a container**" = **Runtime Monitoring**; EKS Protection sees only the Kubernetes API (audit log), not processes.

### Extended Threat Detection

**GuardDuty Extended Threat Detection** correlates multiple events (API calls, weak signals, and existing findings) into a single **attack sequence** finding within a 24-hour window. Key facts:

- it is enabled **automatically** as soon as GuardDuty is enabled and has no additional cost,
- all attack sequence findings are **Critical**,
- types include, e.g., `AttackSequence:IAM/CompromisedCredentials`, `AttackSequence:S3/CompromisedData`, `AttackSequence:EKS/CompromisedCluster`, `AttackSequence:ECS/CompromisedCluster`, and `AttackSequence:EC2/CompromisedInstanceGroup`,
- more enabled plans = more kinds of sequences. EKS sequences need EKS Protection and/or Runtime Monitoring, ECS and EC2 sequences need Runtime Monitoring, S3 exfiltration needs S3 Protection.
- archived findings (including those archived automatically by a **suppression rule**) are **not included** in correlation. An overly broad suppression rule can "hide" a step of an attack.

### Multi-account and configuration

- In AWS Organizations, the management account designates a **delegated administrator** (usually the security tooling account). The admin enables GuardDuty and plans for members and selects **auto-enable** for new (or all) accounts.
- GuardDuty is **regional**: the delegated admin and auto-enable must be configured in **every Region** you use.
- **Trusted IP lists** and **threat lists** (your own lists of IP addresses), **suppression rules** for known benign noise.
- Findings go to **EventBridge** automatically. A new finding immediately, and updates to an existing one (repeated activity) at a configurable frequency (15 min, 1 h, or 6 h, default 6 h). Optional export to an S3 bucket (encrypted with a KMS key).

```bash
# from the management account: the security tooling account becomes the GuardDuty admin (per Region)
aws guardduty enable-organization-admin-account --admin-account-id 222233334444 --region eu-central-1

# from the delegated admin account: auto-enable for all members, including S3 Protection
aws guardduty update-organization-configuration --detector-id <id> \
  --auto-enable-organization-members ALL \
  --features '[{"Name":"S3_DATA_EVENTS","AutoEnable":"ALL"}]'
```

## AWS Security Hub and Security Hub CSPM

In late 2025, AWS split this name into two services. You may encounter both on the exam and in the documentation.

| | **AWS Security Hub CSPM** (formerly "Security Hub") | **AWS Security Hub** (new, unified) |
|---|---|---|
| Role | Cloud security posture management: checks against standards | Central place for risk prioritization |
| What it does | Controls from **AWS Foundational Security Best Practices (FSBP)**, CIS, PCI DSS, NIST 800-53; receives findings from GuardDuty, Inspector, Macie, partners | Correlates signals from Security Hub CSPM, GuardDuty, Inspector, Macie, and IAM Access Analyzer into **exposure findings**; attack path graph; unused access findings; ticketing (Jira Cloud, ServiceNow) |
| Finding format | **AWS Security Finding Format (ASFF)** | **OCSF** |
| Dependency | Most controls use **AWS Config** (you must have a Config recorder) | Uses findings from CSPM and other services |

Key Security Hub CSPM capabilities the exam likes:

- **Cross-Region aggregation**: one aggregation Region receives findings from linked Regions.
- **Central configuration**: the delegated admin creates **configuration policies** (which standards and controls are enabled) and applies them to OUs or accounts, in all Regions, from one place.
- **Automation rules**: automatically modify finding fields (e.g., raise severity for production accounts, suppress a known exception).
- **Custom actions**: a console button that sends selected findings to EventBridge (e.g., "Isolate instance").
- Findings are not collected retroactively: only those created after enablement.

> **On the exam:** "Centrally enable security standards for all accounts **and Regions** and prevent drift" = Security Hub **central configuration** from the delegated admin account. If an option suggests manually enabling a standard in each account, that is not "the MOST operationally efficient".

## Amazon Macie

**Amazon Macie** discovers sensitive data (PII, financial data, credentials) in S3 and evaluates bucket security.

- **Automated sensitive data discovery**: continuously samples objects across all buckets and gives a sensitivity score per bucket. A cheaper way to get an overview of the entire organization.
- **Sensitive data discovery jobs**: targeted one-time or scheduled jobs over selected buckets.
- **Custom data identifiers** (regex + keywords) and **allow lists** for false positives.
- Two kinds of findings: **policy findings** (e.g., a bucket became public, encryption disabled) and **sensitive data findings**.
- Findings go to EventBridge and Security Hub. Multi-account via a delegated administrator.

## Amazon Detective as a source of context

**Amazon Detective** is not an alerting tool but an investigation tool. It builds a **behavior graph** from CloudTrail logs, VPC Flow Logs, and GuardDuty findings (optionally EKS audit logs and Security Hub CSPM findings) and retains up to a year of data. From a GuardDuty or Security Hub finding you open an entity profile with one click (pivot): which API calls the key made, from which IP addresses, how much that deviates from the norm. Details in the incident response module.

## Aggregating security events (1.1.3)

The reference architecture (AWS Security Reference Architecture) uses a dedicated **Security Tooling** account:

```text
Management account ──(delegates)──> Security Tooling account
                                   ├─ GuardDuty delegated admin (every Region)
                                   ├─ Security Hub delegated admin + aggregation Region
                                   ├─ Macie, Inspector, Detective, Config aggregator
                                   └─ EventBridge rules → SNS / Lambda / Step Functions
Log Archive account  ── CloudTrail org trail, Config snapshots, Security Lake (module 2)
Member accounts      ── workloads; findings and events flow to the Security Tooling account
```

Aggregation options:

- **Delegated administrator** per service (GuardDuty, Security Hub, Macie, Inspector, Detective, Config, Firewall Manager…). Day-to-day work is not done from the management account.
- **AWS Config aggregator** (organization aggregator) for a compliance view across all accounts and Regions.
- **EventBridge cross-account**: a rule in a member account sends the event to an **event bus** in the central account; the bus has a resource policy allowing `events:PutEvents` from the organization (`aws:PrincipalOrgID`).
- **CloudWatch cross-account observability**: a monitoring account sees metrics, logs, and traces from source accounts (sink/link) and builds dashboards across all of them.
- **Amazon Security Lake**: a central data lake in OCSF format (module 2).

## Metrics, alarms, and dashboards (1.1.4)

### Metric filter over CloudTrail logs

Classic CIS requirements ("alarm on root sign-in", "alarm on security group change") are implemented by having CloudTrail send logs to **CloudWatch Logs** and creating a **metric filter** and an **alarm** on the log group.

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

### Alarm types

- **Static threshold**: e.g., more than 5 `UnauthorizedOperation` errors in 5 minutes.
- **Anomaly detection alarm**: CloudWatch learns the expected range of a metric (seasonality) and alarms when it leaves the band. Good for "unusual number of requests" when you do not know a fixed threshold.
- **Composite alarm**: combines alarms with logic (`ALARM(a) AND ALARM(b)`) and reduces noise.
- **Metric math** and **Logs Insights** queries can be added to a **CloudWatch dashboard**; a dashboard can show metrics from multiple accounts and Regions.

### EventBridge rules for findings

Findings from security services arrive in EventBridge in the Region where they were created. A rule filters them and sends them to a target.

```json
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": {
    "severity": [{ "numeric": [">=", 7] }]
  }
}
```

Common `detail-type` values: `GuardDuty Finding`, `Security Hub Findings - Imported` (CSPM, ASFF), `Macie Finding`, `Inspector2 Finding`. Targets: SNS, Lambda, Step Functions, SSM Automation, SQS, an event bus in another account, an API destination (e.g., a SIEM or PagerDuty).

> **On the exam:** "Notify the team when GuardDuty generates a **high severity** finding" = an EventBridge rule with a numeric filter on `severity` + SNS. Not a CloudWatch alarm on a metric, and not a Lambda function that periodically calls `ListFindings`.

## Health checks and availability monitoring (1.1.2)

- **Route 53 health checks**: check an endpoint (HTTP/HTTPS/TCP), another health check (calculated), or the **state of a CloudWatch alarm**. For private resources that Route 53 checkers cannot reach, use a health check based on a CloudWatch alarm. The `HealthCheckStatus` metric is published in **us-east-1**, so that is where you create the alarm.
- **ELB health checks**: the target group removes unhealthy targets; metrics `UnHealthyHostCount`, `HTTPCode_ELB_5XX_Count`.
- **CloudWatch Synthetics** canaries: scripts that periodically simulate a user (login, API call).
- **AWS Health** events (e.g., `AWS_RISK_CREDENTIALS_EXPOSED` when AWS detects a publicly exposed key) also arrive in EventBridge (`source: aws.health`).

## Automated assessments and investigations (1.1.5)

| Tool | What it does | Example |
|---|---|---|
| **AWS Config rules** | Evaluate resource configuration (managed or custom Lambda/Guard rules) | `s3-bucket-public-read-prohibited`, `restricted-ssh` |
| **Config conformance pack** | A bundle of rules + remediation in one YAML template; an **organization conformance pack** is deployed to all accounts | Operational Best Practices for CIS, PCI, HIPAA |
| **Config remediation** | Automatic or manual remediation via an **SSM Automation** document | `AWS-DisableS3BucketPublicReadWrite` |
| **Security Hub CSPM standards** | Periodic and change-triggered checks with a score | FSBP, CIS |
| **Systems Manager State Manager** | An **association** keeps instances in the desired state on a schedule | CloudWatch agent always installed and running, inventory, a closed port |
| **Amazon Inspector** | Continuous scanning of EC2, ECR images, Lambda | Prioritized CVE findings |

```bash
# State Manager: every 30 minutes verify that the CloudWatch agent is configured (tag Env=prod)
aws ssm create-association --name AmazonCloudWatch-ManageAgent \
  --targets Key=tag:Env,Values=prod \
  --parameters action=configure,optionalConfigurationSource=ssm,optionalConfigurationLocation=AmazonCloudWatch-linux \
  --schedule-expression "rate(30 minutes)"
```

> **On the exam:** "Ensure **continuously** that a configuration stays in the desired state on EC2 instances" = **State Manager association**. A one-time command is **Run Command**, and a multi-step workflow (e.g., snapshot, then isolation) is an **Automation runbook**.

## Troubleshooting monitoring and logging (1.3)

On the exam the cause is almost always one of three: **permissions** (IAM role or resource policy), **configuration** (logging not enabled in the right place or the right Region), or **network** (the agent cannot reach the endpoint).

### Symptom → cause → fix

| Symptom | Most common cause | Fix |
|---|---|---|
| Lambda runs, but there is no log group/logs | The execution role lacks `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` | Add `AWSLambdaBasicExecutionRole` or an equivalent. Also check the log group setting (Lambda can write to a custom log group) and the log level (advanced logging controls, JSON format). |
| API Gateway REST API has no execution logs | The **CloudWatch Logs role ARN** is not set in the API Gateway settings at the account and Region level | Create a role trusted by `apigateway.amazonaws.com` (`AmazonAPIGatewayPushToCloudWatchLogs`) and enter it in account settings, then enable logging on the **stage**. Access logs also require a destination ARN and a format. |
| CloudFront access logs do not arrive in S3 (legacy standard logging) | The bucket has **Object Ownership = Bucket owner enforced** (ACLs disabled) | Legacy logging writes via ACLs; enable ACLs or switch to **standard logging (v2)**, which goes through CloudWatch vended logs (S3, CloudWatch Logs, Firehose). For v2 via the API, configuration is done in **us-east-1**. |
| CloudWatch agent runs, but logs do not arrive | Instance role without `CloudWatchAgentServerPolicy`; private subnet without NAT or an **interface VPC endpoint** for `logs`/`monitoring`; wrong file path or the agent cannot read the file | Fix the role, add a VPC endpoint, check `file_path` in the JSON configuration and the agent log |
| VPC Flow Logs to CloudWatch Logs do not work | The flow log IAM role has no trust for `vpc-flow-logs.amazonaws.com` or lacks `logs:PutLogEvents` | Fix the trust and permission policy |
| Logs to S3 with SSE-KMS do not arrive | The key policy does not allow the service (`delivery.logs.amazonaws.com`, `cloudtrail.amazonaws.com`) `kms:GenerateDataKey*` | Add a statement to the **key policy** with `aws:SourceAccount`/`aws:SourceArn` |
| EventBridge rule does not fire | The rule is in a different Region from the finding; wrong event pattern | Create the rule in every Region or aggregate; test the pattern with `aws events test-event-pattern` |
| The rule fires, but the SNS message does not arrive | The SNS topic is encrypted with a **KMS key** whose key policy does not allow `events.amazonaws.com`; or the topic policy does not allow `sns:Publish` | Use a customer managed key and add the permission to the key policy; fix the topic policy |
| Lambda target does not receive the event | No **resource-based policy** on the function for `events.amazonaws.com` | `aws lambda add-permission` with the rule's `SourceArn` |
| Route 53 health check is always "unhealthy" | A security group or NACL blocks the Route 53 health checker IP ranges; wrong path or expected string | Allow the `ROUTE53_HEALTHCHECKS` ranges (from `ip-ranges.json`), fix the configuration |
| GuardDuty Runtime Monitoring shows "unhealthy coverage" | The agent cannot reach the GuardDuty endpoint (no VPC endpoint) or is not installed | Enable automated agent configuration or create the VPC endpoint manually; check SSM for EC2 |

### CloudWatch agent: quick diagnostics

```bash
# agent status
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
# the agent's own log: this is where AccessDenied or "no such file" errors show up
sudo tail -50 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
# reload the configuration from Parameter Store
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -c ssm:AmazonCloudWatch-linux -s
```

The logs part of the agent configuration:

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

> **On the exam:** when "logs are not arriving", first check whether the description mentions a **private subnet without internet access** (fix: VPC endpoint), **new KMS encryption** (fix: key policy), or a **new bucket with ACLs disabled** (fix: CloudFront v2 logging or enabled ACLs). The answer "restart the instance" or "increase log retention" is almost never correct.

## Summary

- GuardDuty reads CloudTrail management, VPC Flow, and DNS logs on its own; plans (S3, EKS, Runtime, Malware for EC2/S3, RDS, Lambda) extend visibility. Extended Threat Detection is enabled automatically and produces Critical attack sequence findings.
- In an organization: delegated administrator in the Security Tooling account, auto-enable, and configuration in every Region.
- Security Hub CSPM runs checks against standards (ASFF, depends on AWS Config); the new Security Hub correlates signals into exposure findings (OCSF).
- Macie = sensitive data in S3; Detective = investigation and context, not alerting.
- Alarms: metric filter over CloudTrail logs, anomaly detection and composite alarms; findings flow through EventBridge rules to SNS, Lambda, Step Functions, or SSM.
- Automated assessments: Config rules and conformance packs with SSM remediation, Security Hub standards, State Manager for a continuously desired state.
- Troubleshooting: check the IAM role/resource policy, the KMS key policy, the Region, and the network path to the endpoint (VPC endpoint).
