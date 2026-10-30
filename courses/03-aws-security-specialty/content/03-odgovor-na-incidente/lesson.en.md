## Exam objectives: 2.1 and 2.2

Domain 2 (**Incident Response**) carries 14% of the scored content and has two tasks, both covered in this module:

- **2.1** designing and testing a response plan: runbooks (Systems Manager OpsCenter, SageMaker AI notebooks), preparation (access, security tooling, smaller blast radius, Shield Advanced), testing (AWS Fault Injection Service, AWS Resilience Hub), automated remediation (Systems Manager, Automated Forensics Orchestrator for Amazon EC2, Step Functions, Application Recovery Controller, Lambda),
- **2.2** responding to events: forensic artifacts, log search and correlation, finding validation and scoping, containment, eradication and recovery, root cause analysis (Amazon Detective).

The exam likes two kinds of questions: **order of steps** ("What should the security engineer do FIRST?") and **automation** ("respond automatically with the LEAST operational overhead"). For the first kind the rule is: **preserve evidence and stop the damage before you delete anything**. For the second: **EventBridge + managed orchestration** (SSM Automation, Step Functions), not a script on a server.

## Incident response lifecycle

| Phase (NIST SP 800-61) | In AWS |
|---|---|
| **Preparation** | IR roles in all accounts, Security Tooling and Forensics accounts, logs enabled, runbooks, Shield Advanced, exercises |
| **Detection & Analysis** | GuardDuty, Security Hub, Macie, Inspector, CloudWatch alarms; finding validation and scope (Detective, Athena) |
| **Containment, Eradication & Recovery** | Isolation with a security group, key deactivation, revoke sessions, SCP; cleanup; restore from AWS Backup or IaC |
| **Post-incident activity** | Root cause analysis, lessons learned, updating runbooks and controls |

## Plan and runbooks (2.1.1)

A **playbook** describes what we do for a type of incident (e.g., "compromised IAM key"): roles, communication, decisions. A **runbook** is a concrete, repeatable sequence of steps, ideally automated.

### Systems Manager tools

- **Systems Manager Automation**: a runbook (Automation document, YAML/JSON) with steps such as `aws:executeAwsApi`, `aws:runCommand`, `aws:executeScript`, `aws:approve` (human approval before a destructive step). AWS provides ready-made runbooks (`AWS-…`, `AWSSupport-…`), e.g., for snapshots or isolation.
- **Systems Manager OpsCenter**: a central place for **OpsItems** (operational and security issues). An OpsItem can be created automatically from an EventBridge rule, a CloudWatch alarm, or a Security Hub finding. With an OpsItem you see related resources and history, and you can run an Automation runbook directly.
- **Systems Manager Incident Manager**: response plans, contacts, on-call schedules, escalations, chat channels, and post-incident analysis. Note: AWS has closed Incident Manager to **new customers**; existing customers use it normally. For new solutions, questions more often target OpsCenter, Automation, and EventBridge.

```yaml
# Abridged Automation runbook: isolate an instance and create a snapshot
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

### SageMaker AI notebooks for investigation

A **Jupyter notebook** in Amazon SageMaker AI is a living investigation runbook: cells with explanations and code (boto3, Athena queries over CloudTrail or Security Lake, pandas for correlation, charts). Advantages: the investigation is **repeatable and documented**, the analyst does not have to remember queries, and the result is kept as part of the incident documentation. The notebook instance should run in the security/forensics account, with an IAM role that can only read logs and without direct internet access (VPC-only).

> **On the exam:** "Centralized place to track, investigate and **remediate operational and security issues** with associated runbooks" = **OpsCenter**. "Interactive, repeatable **investigation** of log data with code and documentation" = **SageMaker AI (Jupyter) notebooks**. "Multi-step remediation with an **approval** step" = **SSM Automation** with `aws:approve`.

## Incident preparation (2.1.2)

### Access before an incident

- **IR roles** in all accounts in advance (CloudFormation StackSets or Control Tower customizations): e.g., `IR-ReadOnly` (investigation) and `IR-Containment` (isolation, key deactivation, snapshots). The trust policy allows assumption only from the Security Tooling account, with MFA.
- An **IAM Identity Center** permission set for the IR team, assigned as needed (or just-in-time access).
- **Break-glass** access: separate credentials (e.g., an IAM user with a hardware MFA device kept in a safe) in case Identity Center or the IdP are unavailable. Every use triggers an alarm.
- **Forensics account**: an isolated account with a VPC without internet access, a forensic AMI, and an S3 bucket with **Object Lock** for evidence. Snapshots are shared into this account.

### Security tooling and a smaller blast radius

- Detection and logs enabled **before** an incident (GuardDuty, Security Hub, CloudTrail org trail, flow logs, Resolver logs). A log that was not enabled cannot be obtained retroactively.
- A **multi-account** structure: a compromised workload account does not affect others. **SCPs** and **RCPs** limit what even the most privileged principal in a member account can do.
- Least privilege, short-lived credentials (roles instead of access keys), network segmentation, **tags** (owner, environment, sensitivity) so that during an incident you know whose resource it is.

### AWS Shield Advanced

| Capability | What it provides |
|---|---|
| Resource protection | CloudFront, Route 53 hosted zone, Global Accelerator, ALB, Classic Load Balancer, Elastic IP (EC2, NLB) |
| **Shield Response Team (SRT)** | An AWS team that helps during a DDoS attack. Requires a **Business or Enterprise Support** plan and an **SRT access role** (managed policy `AWSShieldDRTAccessPolicy`) so the SRT may modify WAF rules in your account |
| **Proactive engagement** | The SRT contacts you itself when a resource is under attack; requires **Route 53 health checks** associated with the protected resources and contact details |
| **Automatic application layer DDoS mitigation** | Shield creates and applies WAF rules against L7 DDoS on its own (requires a web ACL on the resource) |
| Cost protection | Credit for scaling caused by a DDoS attack |
| Protection groups | Grouping resources for more precise detection |

> **On the exam:** "Allow the **SRT** to help during an attack" = Business/Enterprise Support + SRT access role. "SRT should **contact us proactively**" = proactive engagement + **Route 53 health checks** on the protected resources. Shield Standard is free and automatic, but has neither the SRT nor cost protection.

## Testing the plan (2.1.3)

- **Tabletop exercise**: a discussion of a scenario around a table, without touching systems. Cheap, and it uncovers gaps in process and communication.
- **Game day / simulation**: a realistic scenario in a controlled environment (e.g., GuardDuty **sample findings**, an intentionally public test bucket). Measures time to detection and response.
- **AWS Fault Injection Service (FIS)**: controlled experiments. An **experiment template** = actions (e.g., `aws:ec2:stop-instances`, `aws:ec2:terminate-instances`, `aws:network:disrupt-connectivity`, `aws:ssm:send-command`), targets (by tag), an IAM role, and **stop conditions** (a CloudWatch alarm that stops the experiment). Verifies whether alarms, automated remediation, and recovery actually work.
- **AWS Resilience Hub**: you define an application and a **resiliency policy** (target RTO and RPO); Resilience Hub runs an **assessment** and recommends improvements, alarms, SOPs, and FIS experiments. Shows whether the architecture can meet the recovery targets.

> **On the exam:** "Validate that the application **can meet RTO/RPO** and get recommendations" = **Resilience Hub**. "Inject a real failure (stop instances, cut network) with **automatic stop** if customer impact is detected" = **FIS with a stop condition**.

## Automated remediation (2.1.4)

The pattern is always the same: **finding → EventBridge rule → orchestration → action**.

| Orchestration | When |
|---|---|
| **Lambda** | A short, simple action (deactivate a key, remove a public ACL) |
| **Step Functions** | Multiple steps, branching, waiting, parallel execution, human approval (callback) |
| **SSM Automation** | Operations on EC2 and AWS resources, ready-made AWS runbooks, `aws:approve` |
| **Config remediation** | Bringing configuration into compliance (via SSM Automation) when a Config rule reports noncompliance |
| **Security Hub custom action / automation rules** | An analyst manually triggers an action from the console, or a finding is enriched automatically |

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

An AWS solution (Solutions Library, CloudFormation) for a SOC: a finding from Security Hub (e.g., from GuardDuty) triggers, via EventBridge, a **Step Functions** workflow that:

1. decides whether isolation and acquisition are needed (based on the action and the instance tags),
2. collects **memory** (via SSM to S3) and **disk** (EBS snapshots) in parallel,
3. isolates the instance with a **security group**,
4. launches a forensic instance in the forensics account, attaches a volume created from the snapshot, and runs the analysis,
5. preserves evidence with a chain of custody.

### Amazon Application Recovery Controller (ARC)

ARC helps in the **recovery** phase and in incidents that affect availability:

- **Zonal shift / zonal autoshift**: temporarily move traffic away from one Availability Zone (e.g., an AZ with a compromised or faulty deployment),
- **Routing control**: reliable switching of DNS traffic between Regions, with **safety rules**,
- **Region switch**: an orchestrated recovery plan in another Region,
- **Readiness check**: continuously checks whether a replica is ready (quotas, capacity). It is not intended to be in the critical path of a failover.

## Responding to security events (2.2)

### Forensic artifacts (2.2.1)

Collect in **order of volatility**: first what disappears (memory, active connections), then disk, then logs that are already durable.

| Artifact | How | Note |
|---|---|---|
| Memory (RAM) | SSM Run Command with a tool (e.g., LiME, AVML) → S3 | Before shutting down the instance; shutdown destroys it |
| Instance metadata | `aws ec2 describe-instances`, ENI, SG, IAM role, tags | Record in the ticket/bucket |
| Disk | `aws ec2 create-snapshot` for every EBS volume | A snapshot encrypted with a CMK requires the forensics account to be granted access to the key |
| Logs | CloudTrail, flow logs, Resolver logs, application logs | Copy to a forensics bucket with Object Lock |
| Integrity | SHA-256 hash of every artifact, a record of who did what | **Chain of custody** |

```bash
aws ec2 create-snapshot --volume-id vol-0abc123 \
  --description "IR-2026-117 evidence i-0123456789abcdef0" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=IR-Case,Value=IR-2026-117}]'
aws ec2 modify-snapshot-attribute --snapshot-id snap-0def456 \
  --attribute createVolumePermission --operation-type add --user-ids 444455556666
```

### Compromised IAM access key: steps

1. **Identify** the key and its owner (GuardDuty finding, AWS Health `AWS_RISK_CREDENTIALS_EXPOSED`, CloudTrail `userIdentity.accessKeyId`).
2. **Deactivate** the key (`aws iam update-access-key --status Inactive`). Do not delete it immediately: deactivation is reversible and preserves the link between the key and the evidence.
3. **Revoke sessions**: temporary credentials obtained with that key (e.g., `AssumeRole`, `GetSessionToken`) remain valid until they expire. For roles use **Revoke active sessions** (a policy that denies all tokens issued before the revocation time); for a user add an explicit deny.
4. **Analyze** what the key did (Athena/CloudTrail Lake/Detective): new users, keys, roles, modified trust policies, Lambda functions, instances in unusual Regions.
5. **Remove** everything the attacker created (persistence) and restore modified policies.
6. **Delete** the compromised key and, if one must exist, issue a new one (better: move to IAM roles or Roles Anywhere). Review costs and open an AWS Support case if needed.

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

### Compromised EC2 instance: steps

1. **Preserve** the instance: enable termination protection, set shutdown behavior to stop, **tag** it (`IR-Status=Quarantined`, case number). Do not shut it down or terminate it.
2. **Take it out of rotation**: detach it from the **Auto Scaling group** (otherwise the ASG may replace and terminate it) and deregister it from load balancer target groups.
3. **Isolate the network**: assign an **isolation security group** (no inbound rules, egress only to the forensic tooling, e.g., the SSM VPC endpoint). Watch out for **tracked connections**: changing the SG does not terminate already-tracked connections. AWS recommends first applying an SG that allows all traffic (connections become untracked) and then the isolation SG; or additionally use a **NACL** on the subnet, which is stateless and stops traffic immediately.
4. **Remove credentials**: replace or remove the **instance profile** and revoke the role's active sessions (credentials taken from IMDS remain valid until they expire).
5. **Collect memory**, then **EBS snapshots**, and share them into the forensics account.
6. **Analyze** in the forensics account (a volume from the snapshot as a secondary disk on a forensic instance).
7. **Eradication and recovery**: terminate the compromised instance, deploy a new one from a verified AMI and IaC, patch the root cause, rotate the secrets the instance had access to.

> **On the exam:** "What should be done FIRST to preserve evidence?" Answers that say "terminate the instance", "stop the instance", or "delete the access key" are wrong for the first step: memory or the link to the evidence is lost. The correct first step is isolation or deactivation while preserving state.

### Other common scenarios

| Scenario | First steps |
|---|---|
| An S3 bucket became public (Macie or Security Hub finding) | Enable **Block Public Access**, check S3 data events and server access logs for who read objects, assess whether the objects are sensitive (Macie) |
| Compromised Lambda function | Set **reserved concurrency to 0** (the function does not run), preserve code and configuration (versions), check the execution role and revoke its sessions |
| Suspicious root activity | Change the root password and MFA, delete root access keys if any exist, check CloudTrail for all root calls; in member accounts use centralized root access from the management account |
| Compromised EKS pod | Isolate the pod (NetworkPolicy or cordon the node), preserve audit logs and pod state, revoke the service account credentials and pod identity role |

### Log search and correlation (2.2.2)

- Link all logs by **identity** (access key ID, role ARN, `sessionContext.sessionIssuer`, `sourceIdentity`), **network data** (IP, ENI, instance-id), and **time** (UTC in all sources).
- A chain of AssumeRole calls is followed through CloudTrail: the `AssumeRole` event has `responseElements.credentials.accessKeyId`, which then appears as `userIdentity.accessKeyId` in subsequent calls.
- Tools: Athena over the org trail and flow logs, Security Lake (OCSF, the same query across multiple sources), CloudWatch Logs Insights over multiple log groups, OpenSearch, Detective.

### Finding validation and scope (2.2.3)

Before responding, confirm that the finding is real and determine its scope:

- **Is it a true positive?** Is the IP part of a known scanner or your CI system? Is the "unusual Region" actually a new project? Sample findings are marked `[SAMPLE]`.
- **What is affected?** Finding fields: resource, action, actor (IP, ASN, geolocation), `count`, `firstSeen`/`lastSeen`.
- **How far does it go?** The same key or IP in other accounts and Regions (Security Hub filter, Athena over the org trail), related findings in Detective **finding groups**, GuardDuty attack sequence findings, what data the role can read (IAM Access Analyzer, last accessed information).
- **Impact**: whether sensitive data was touched (Macie bucket classification, S3 data events).

### Containment, eradication, recovery (2.2.4)

| Resource | Containment | Eradication / recovery |
|---|---|---|
| IAM user / key | Key deactivation, deny policy, revoke sessions | Deleting keys, removing persistence, moving to roles |
| IAM role | Revoke active sessions, change the trust policy | Review and narrow permissions |
| EC2 | Isolation SG, NACL, detaching from ASG/ELB, removing the instance profile | New instance from a verified AMI, patch |
| S3 bucket | Block Public Access, bucket policy deny, cutting off compromised access | Restoring versions (Versioning), restore from AWS Backup |
| Entire account | **SCP** (deny for the compromised account or Region), moving to a quarantine OU | Rebuild from IaC, rotation of all secrets |
| Network | Network Firewall/WAF rule to block an IP or domain, DNS Firewall | Removing unnecessary routes and access |
| Data | | **AWS Backup** restore (vault with Vault Lock), point-in-time recovery |

### Root cause analysis (2.2.5)

**Amazon Detective** is the main AWS tool for RCA:

- **Behavior graph** from CloudTrail, VPC Flow Logs, and GuardDuty findings (optionally EKS audit logs and Security Hub CSPM findings), up to a year of history.
- **Entity profiles**: for an IAM user, role, IP, or EC2 instance you see API calls, geolocations, traffic volume, and deviation from the baseline.
- **Finding groups**: Detective groups related findings and entities into a single view of an attack.
- **Investigations** for IAM users and roles: a report with indicators of compromise and mapping to MITRE ATT&CK tactics.
- Multi-account: the behavior graph administrator (delegated admin) sees data from all members.

Technical analysis is followed by a **post-incident review** (blameless): what was the initial vector, why the controls did not prevent or detect it earlier, which controls and runbooks need to change (e.g., an SCP, a Config rule, a new alarm).

> **On the exam:** "Determine the **root cause** and visualize the activity of the compromised role **over time** with the LEAST effort" = **Amazon Detective**. Athena queries give the same answer, but with more manual work.

## Summary

- Plan and runbooks: SSM Automation (with `aws:approve`), OpsCenter for OpsItems and running runbooks, SageMaker AI notebooks for repeatable investigation; Incident Manager no longer accepts new customers.
- Preparation: IR roles and break-glass access in advance, Security Tooling and Forensics accounts, logs enabled, multi-account and SCPs for a smaller blast radius, Shield Advanced with the SRT (Business/Enterprise Support, SRT role) and proactive engagement (Route 53 health checks).
- Testing: tabletop, game day, FIS with stop conditions, Resilience Hub for RTO/RPO assessment.
- Automation: EventBridge → Lambda / Step Functions / SSM Automation; Automated Forensics Orchestrator for EC2 memory, disk, and isolation; ARC for redirecting traffic during recovery.
- Key: identify, deactivate, revoke sessions, analyze, clean up, delete. EC2: preserve, remove from ASG/ELB, isolate (watch for tracked connections), remove the profile, memory then snapshot, analysis, rebuild.
- Validate the finding and its scope before major actions; RCA with Amazon Detective and a blameless post-incident review.
