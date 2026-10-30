## Exam objective: 6.1

This module covers task **6.1** of domain 6 (**Security Foundations and Governance**, 14% of the exam): a strategy for centrally creating and managing AWS accounts. Skills:

- **6.1.1** setting up and configuring an organization in **AWS Organizations**,
- **6.1.2** **AWS Control Tower** in a new and an existing environment, with optional and custom controls,
- **6.1.3** organization policies for managing permissions: **SCP**, **RCP**, **AI services opt-out**, **declarative policies**,
- **6.1.4** central management of security services (**delegated administrator**),
- **6.1.5** managing root credentials: centralized root access for member accounts, MFA, break-glass procedures.

Questions on this task almost always describe an organization with dozens or hundreds of accounts and ask for a solution that works **automatically and for future accounts**. Phrases such as "across all accounts", "including accounts created in the future", and "with the LEAST operational overhead" point to organization policies, Control Tower controls, and a delegated administrator, not to per-account scripts.

## 6.1.1 AWS Organizations and OU design per the SRA

**AWS Organizations** groups accounts into a hierarchy: **root** → **organizational units (OUs)** → accounts. The **management account** (formerly "master") creates the organization, pays the bill, and is the only one that can change organization policies, unless management is delegated. The organization must have **all features** mode enabled for SCPs, RCPs, and the other policies to work (consolidated billing alone is not enough).

### Recommended structure (AWS Security Reference Architecture)

The **AWS SRA** recommends keeping the management account almost empty, with security functions in dedicated accounts within a **Security OU**:

| OU / account | Purpose |
|---|---|
| **Management account** | Only Organizations, billing, (possibly) Control Tower. No workloads. SCPs and RCPs **do not apply** to it, so it is risky for anything else. |
| **Security OU → Log Archive** | Immutable central logs: organization CloudTrail, Config snapshots, VPC Flow Logs, S3 with Object Lock. Very few people have access. |
| **Security OU → Security Tooling (Audit)** | Delegated administrator for GuardDuty, Security Hub, Macie, Inspector, Detective, Config aggregator, IAM Access Analyzer. The SOC works from here. |
| **Infrastructure OU** | Network account (Transit Gateway, Network Firewall, Route 53), shared services. |
| **Workloads OU** (Prod / Non-prod) | Application accounts; different SCPs for prod and dev. |
| **Sandbox OU** | Experiments, a stricter budget, and an SCP that forbids connecting to the corporate network. |
| **Suspended / Policy staging OU** | Accounts to be closed (deny-all SCP) and testing of new policies before broader rollout. |

```bash
aws organizations create-organizational-unit --parent-id r-ab12 --name Security
aws organizations move-account --account-id 222222222222 \
  --source-parent-id r-ab12 --destination-parent-id ou-ab12-security
aws organizations enable-aws-service-access --service-principal guardduty.amazonaws.com
```

OUs can be nested at most five levels below the root. Policies are inherited down the hierarchy, so design OUs around **security requirements** (prod vs dev, regulated vs unregulated), not around the company's org chart.

> **On the exam:** "where to keep central logs so that even application account administrators cannot modify them" = the **Log Archive** account in the Security OU (with S3 Object Lock and an SCP). "Where to run GuardDuty/Security Hub administration" = the **Security Tooling (Audit)** account as the delegated administrator, never the management account.

## 6.1.2 AWS Control Tower

**AWS Control Tower** automatically sets up a **landing zone**: a well-configured multi-account environment on top of Organizations.

What the landing zone creates:
- a **Security OU** with the **Log Archive** and **Audit** accounts,
- an organization **CloudTrail** trail and AWS Config delivering to the Log Archive account,
- (optionally) **IAM Identity Center** for account access,
- baseline controls and **Account Factory** for new accounts.

### Controls (formerly guardrails)

| Behavior | Implementation | Status |
|---|---|---|
| **Preventive** | SCPs, **RCPs**, and **declarative policies** from Organizations | enforced / not enabled |
| **Detective** | AWS Config rules (some also through a Security Hub service-managed standard) | clear / in violation / not enabled |
| **Proactive** | **CloudFormation Hooks**: checks resources **before** they are created | PASS / FAIL / SKIP |

By **guidance**, controls are **mandatory**, **strongly recommended**, and **elective**. Controls are enabled per OU and apply to all accounts in it. Examples: "Disallow changes to CloudTrail", "Detect whether MFA for the root user is enabled", and the **Region deny** control that blocks activity outside approved Regions. The management account is intentionally exempt from controls.

### Account Factory and extensions

- **Account Factory**: creating standardized accounts (a Service Catalog product behind the scenes); the account gets the baseline and the controls of its OU.
- **Account Factory for Terraform (AFT)**: the same process through Terraform and a GitOps pipeline, for teams that already work in Terraform.
- **Customizations for AWS Control Tower (CfCT)** and **Account Factory Customization (AFC)**: additional CloudFormation templates and SCPs applied when an account is created.

### Existing environment

Control Tower can be set up **in an existing organization**. An existing OU is **registered** (Register OU), which **enrolls** its accounts; each account gets the `AWSControlTowerExecution` role and the OU's controls. An account that does not meet the prerequisites (e.g., an existing Config recorder or delivery channel in conflict) stays in *Enrollment failed* until the problem is resolved and the OU is registered again. Manual changes to resources that Control Tower creates (e.g., deleting its SCPs, moving accounts outside of it) cause **drift**, which is fixed through *Repair* of the landing zone.

> **On the exam:** "establish a multi-account environment with central logging and ready-made controls with the LEAST operational overhead" = **Control Tower**. "Prevent creation of an unencrypted S3 bucket through CloudFormation **before** deployment" = a **proactive** control (Hooks). "Detect existing noncompliant resources" = a **detective** control (Config). "Block an action regardless of IAM" = **preventive** (SCP/RCP).

## 6.1.3 Organization policies

Organizations has two groups of policies:

- **Authorization policies**: **SCPs** and **RCPs**. They limit the **maximum permissions** and never grant them.
- **Management policies**: **declarative policies** (EC2 and other services), **tag policies**, **backup policies**, **AI services opt-out policies**, chat applications policies, and others. They set service configuration.

### SCP vs RCP vs other permission limits

| | **SCP** | **RCP** | Permissions boundary | Session policy |
|---|---|---|---|---|
| Attached to | Root, OU, account | Root, OU, account | IAM user or role | On `AssumeRole`/federation |
| What it limits | **Principals** (users, roles, root) in member accounts | **Resources** in member accounts, regardless of who accesses them (including from other organizations) | One principal | One session |
| Grants permissions | No | No | No | No |
| Management account | Does not apply | Does not apply | Applies | Applies |
| Service-linked role | Does not apply | Does not apply | — | — |
| Default | `FullAWSAccess` | `RCPFullAWSAccess` (cannot be removed) | — | — |
| Services | All | A subset (e.g., S3, KMS, STS, SQS, Secrets Manager, DynamoDB, ECR, CloudWatch Logs…) | All | All |

Evaluation logic: a request succeeds only if an identity or resource policy **allows** it **and** no explicit `Deny` forbids it, **and** the SCPs at **every level** from the root to the principal's account allow it, **and** the RCPs at every level down to the resource's account allow it. An explicit `Deny` anywhere always wins.

**SCP example**: denying the disabling of security services and activity outside approved Regions, with an exception for the platform role.

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

**RCP example**: a **data perimeter**, the organization's resources accessible only to principals from the organization or AWS services. This also protects against a badly written bucket policy that grants access to a foreign account.

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

An RCP does not apply to AWS managed KMS keys or to service-linked roles. Before attaching it to the root, test it on an individual account or the policy staging OU and watch for `AccessDenied` in CloudTrail.

> **On the exam:** "prevent developers in all accounts from disabling CloudTrail" = **SCP**. "No principal outside the organization may access S3 buckets and KMS keys, even if a bucket policy mistakenly allows it" = **RCP**. "Limit what a developer may grant to a role they create themselves" = **permissions boundary**. SCPs and RCPs do not protect the management account: that is why there are no workloads there.

### Declarative policies

**Declarative policies** set and maintain the desired service configuration **at the service's control plane**, not by denying API calls. Advantages: the configuration holds even when the service adds new APIs, it applies to new accounts automatically, and it also covers service-linked roles. There is a **custom error message** (e.g., a link to an internal wiki) and an **account status report** that shows the current state of the attributes per account before enabling.

For **EC2** (key `ec2_attributes`), supported attributes include, among others: **VPC Block Public Access**, **Serial Console Access**, **Image Block Public Access** (AMI sharing), **Allowed Images Settings** (which AMIs may be used), **Instance Metadata** defaults (e.g., IMDSv2 required), and **Snapshot Block Public Access**.

```json
{
  "ec2_attributes": {
    "image_block_public_access": {"state": {"@@assign": "block_new_sharing"}},
    "snapshot_block_public_access": {"state": {"@@assign": "block_all_sharing"}},
    "instance_metadata_defaults": {"http_tokens": {"@@assign": "required"}},
    "exception_message": {"@@assign": "Blocked by organization policy. See wiki/cloud-policy"}
  }
}
```

When a declarative policy is removed, the attribute returns to its state before the policy. An account administrator cannot locally change an attribute that the policy maintains.

> **On the exam:** "forbid public sharing of AMIs and EBS snapshots in all accounts, including future APIs, with the LEAST maintenance" = a **declarative policy** for EC2, not an SCP with a list of API actions that has to be updated.

### AI services opt-out, tag, and backup policies

- **AI services opt-out policies**: AWS AI services may use customer content to improve the service. A policy at the root disables this for all accounts (the `default` key) or for individual services; after opting out, the service deletes previously stored content that it does not need to operate.

```json
{
  "services": {
    "default": {"opt_out_policy": {"@@assign": "optOut"}},
    "@@operators_allowed_for_child_policies": ["@@none"]
  }
}
```

- **Tag policies**: standardize tag keys and allowed values (e.g., `CostCenter` with exact capitalization), and with `enforced_for` they can reject noncompliant tagging for the listed resource types. More in module 11.
- **Backup policies**: centrally define AWS Backup plans (schedule, retention, copy to another Region/account) for the accounts in an OU.

## 6.1.4 Delegated administrator for security services

Security services are enabled for the entire organization from one account. The management account registers a **delegated administrator** (most often the Security Tooling account), which then manages the service for all member accounts, automatically enables new accounts, and sees all findings.

| Service | What the delegated admin does |
|---|---|
| **Amazon GuardDuty** | Auto-enable for new accounts, protection plans (S3, EKS, Runtime Monitoring, Malware Protection), all findings; per Region. |
| **AWS Security Hub** | Central configuration of standards and controls through configuration policies, aggregation of findings from Regions. |
| **Amazon Macie** | Discovery jobs and findings for S3 in all accounts. |
| **Amazon Inspector** | Scanning EC2, ECR, and Lambda in all accounts. |
| **Amazon Detective** | A behavior graph for investigating findings from the entire organization. |
| **AWS Config** | Organization Config rules, conformance packs, and the aggregator. |
| **IAM Access Analyzer** | An analyzer with the organization as the zone of trust. |
| **AWS Firewall Manager** | Central policies for WAF, SGs, Network Firewall (see module 11). |
| **IAM** (root access management) | Centralized root access for member accounts. |

```bash
# from the management account, in every Region where GuardDuty is used
aws guardduty enable-organization-admin-account --admin-account-id 333333333333
# from the delegated admin account
aws guardduty update-organization-configuration --detector-id <id> --auto-enable-organization-members ALL
```

> **On the exam:** "The SOC team must see GuardDuty findings from all 300 accounts, and new accounts must be enabled automatically" = a **delegated administrator** in the Security Tooling account + **auto-enable**. Manually inviting member accounts (invitations) is the old, slower way and is not the answer when Organizations exists.

## 6.1.5 Root user: centralization, MFA, and break-glass

### Centralized root access for member accounts

IAM **Root access management** (prerequisite: trusted access for IAM in Organizations) has two capabilities:

1. **Root credentials management**: the management account or a **delegated administrator for IAM** can **delete** the root password, access keys, and signing certificates and deactivate MFA in member accounts. **New accounts created through Organizations have no root credentials.** The member account then cannot sign in as root or recover the root password, unless explicitly allowed.
2. **Privileged root actions in member accounts**: instead of signing in as root, the central team starts a short privileged `sts:AssumeRoot` session limited by a **task policy** to a single task.

```bash
aws organizations enable-aws-service-access --service-principal iam.amazonaws.com
aws iam enable-organizations-root-credentials-management
aws iam enable-organizations-root-sessions
aws organizations register-delegated-administrator \
  --service-principal iam.amazonaws.com --account-id 333333333333

# privileged session (regional STS endpoint; the global one is not supported)
aws sts assume-root --target-principal 444444444444 \
  --task-policy-arn arn=arn:aws:iam::aws:policy/root-task/S3UnlockBucketPolicy \
  --duration-seconds 900
```

Task policies (AWS managed): `IAMAuditRootUserCredentials`, `IAMCreateRootUserPassword` (allow password recovery), `IAMDeleteRootUserCredentials`, `S3UnlockBucketPolicy` (delete a bucket policy that blocks all principals), `SQSUnlockQueuePolicy`. The `sts:TaskPolicyArn` condition restricts which task policies a role may use. `sts:AssumeRoot` cannot be called by the root user, only by an IAM role or user with that permission.

### MFA and protecting root

- Management account root: a strong password, **MFA** (FIDO2 passkey/security key or a hardware token; root supports multiple MFA devices), no access keys, and a contact email on a distribution list that the company controls.
- AWS now enforces MFA for root users, but MFA must be registered; Control Tower and Security Hub have controls that check root MFA and root access keys.
- An alarm on every use of root: an EventBridge rule on CloudTrail events where `userIdentity.type` = `Root`.

```json
{
  "source": ["aws.signin", "aws.cloudtrail"],
  "detail": {"userIdentity": {"type": ["Root"]}}
}
```

### Break-glass procedure

Break-glass is pre-prepared, rarely used access for situations when the regular path does not work (e.g., the IdP/IAM Identity Center is unavailable, or a faulty SCP locked out the administrators).

- A small number of **break-glass IAM users or roles** (e.g., in the management account or a dedicated account), with hardware MFA, the password in a safe, and split knowledge (two people).
- Excluded from SCP restrictions only as much as necessary (an `aws:PrincipalArn` condition), and every use raises a high-priority alarm.
- Regular testing (e.g., quarterly) and rotation after every use; the procedure documented in the IR runbook.
- For member accounts with deleted root credentials, "break-glass for root" is **AssumeRoot** from the delegated admin account or a temporary **Allow password recovery**, followed by deleting the credentials again after the task.

> **On the exam:** "a bucket policy with a `Deny` for `Principal: *` locked a bucket in a member account, and that account's root credentials have been deleted" = **`sts:AssumeRoot` with `S3UnlockBucketPolicy`** from the management or delegated admin account. "Prevent anyone from using root in 200 member accounts" = **root credentials management** (deleting the credentials), with an SCP that denies root principal actions as an additional layer.

## Summary

- Per the **SRA**: a management account without workloads; a **Security OU** with a **Log Archive** and a **Security Tooling (Audit)** account; OUs based on security requirements.
- **Control Tower** creates the landing zone; controls are **preventive** (SCP/RCP/declarative), **detective** (Config), and **proactive** (CloudFormation Hooks); an existing OU is **registered**.
- An **SCP** limits principals, an **RCP** limits resources (including for external principals); neither grants permissions, and neither applies to the management account or service-linked roles.
- **Declarative policies** maintain service configuration (e.g., EC2: block public access for AMIs/snapshots, IMDSv2, VPC BPA) even for future APIs, with a custom error message.
- **AI services opt-out**, **tag**, and **backup** policies are management policies for central configuration.
- A **delegated administrator** in the Security Tooling account + auto-enable is the standard for GuardDuty, Security Hub, Macie, Inspector, Config, Detective, and Access Analyzer.
- **Centralized root access**: deleting member account root credentials and privileged `sts:AssumeRoot` sessions with task policies; root MFA and an alarm on every root use; a tested break-glass procedure.
