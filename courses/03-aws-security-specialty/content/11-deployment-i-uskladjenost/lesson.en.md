## Exam objectives: 6.2 and 6.3

This module covers two tasks of domain 6 (**Security Foundations and Governance**, 14% of the exam):

- **6.2** a secure and consistent resource deployment strategy:
  - **6.2.1** IaC for consistent and secure deployment across multiple accounts (CloudFormation StackSets, third-party IaC tools, CloudFormation Guard, cfn-lint),
  - **6.2.2** tags for organizing resources (department, cost center, environment),
  - **6.2.3** central enforcement of policies and configurations (AWS Firewall Manager),
  - **6.2.4** secure sharing of resources between accounts (AWS Service Catalog, AWS RAM).
- **6.3** evaluating resource compliance:
  - **6.3.1** rules for detecting and remediating noncompliant resources, and notifications (AWS Config, Security Hub),
  - **6.3.2** collecting and organizing evidence (AWS Audit Manager, AWS Artifact),
  - **6.3.3** evaluating architecture against AWS best practices (AWS Well-Architected Tool).

Here the exam likes questions of the form "the same baseline in all accounts, including new ones", "prevent the mistake **before** deployment", and "prove compliance to an auditor with the least manual work". Distinguish **prevention before deployment** (Guard, cfn-lint, Hooks, Checkov in CI), **prevention at runtime** (SCP, Firewall Manager), and **detection after deployment** (Config, Security Hub).

## 6.2.1 Infrastructure as code

### CloudFormation StackSets

**StackSets** deploy the same CloudFormation template as stack instances across multiple accounts and Regions in a single operation.

| | **Self-managed permissions** | **Service-managed permissions** |
|---|---|---|
| Roles | You manually create `AWSCloudFormationStackSetAdministrationRole` (admin account) and `AWSCloudFormationStackSetExecutionRole` (every target account) | CloudFormation creates the required roles itself through trusted access with Organizations |
| Targets | A list of account IDs | **OUs** or the entire organization |
| New accounts | You must add them manually | **Automatic deployment**: an account added to the OU automatically gets the stack; an account that leaves the OU can have the stack removed |
| Who manages it | Any account | The management account or a **delegated administrator** for StackSets |

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

Typical content of a security baseline StackSet: IAM roles for the SOC and break-glass, EventBridge rules that send events to the security account, Config rules, EBS encryption by default.

### Protecting stacks: stack policy, termination protection, drift

- **Stack policy**: JSON that determines which stack resources **may be updated**. E.g., denying `Update:Replace` and `Update:Delete` for the production database, so a mistake in the template does not replace the RDS instance. It can be temporarily overridden with a special policy for a single update.
- **Termination protection**: prevents deleting the entire stack. **`DeletionPolicy: Retain`** / `Snapshot` keeps the resource or a snapshot when the stack is deleted.
- **Drift detection**: compares the actual configuration with the template and shows manual changes (`MODIFIED`, `DELETED`). Also works for StackSets.

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

### Checking templates: cfn-lint, CloudFormation Guard, Hooks

| Tool | When it runs | What it checks |
|---|---|---|
| **cfn-lint** | Locally and in CI, before deployment | Template correctness against the resource specification: nonexistent properties, wrong types, bad references. The focus is correctness, with a few best-practice rules. |
| **CloudFormation Guard** (`cfn-guard`) | CI, Config custom policy rules, Hooks | **Policy-as-code** in its own DSL: "every S3 bucket must have encryption and blocked public access". Works on any JSON/YAML (including Terraform plan JSON, Kubernetes manifests). |
| **CloudFormation Hooks** | In the CloudFormation service, **before** a resource is created/changed | Guard hooks, Lambda hooks, or custom hooks; **FAIL** (block) or **WARN** mode. They cannot be bypassed by locally skipping a CI step. Control Tower proactive controls are hooks. |

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

### Terraform and third-party tools

For Terraform (and CloudFormation, Kubernetes, Dockerfile), scanners such as **Checkov** and **tfsec** (now part of the Trivy tool) are used in the CI pipeline. They catch public buckets, `0.0.0.0/0` on port 22, unencrypted volumes, and IAM `*:*` before `terraform apply`. Security practices for Terraform:

- **state** contains sensitive values: an S3 backend with SSE-KMS, versioning, blocked public access, and locking,
- CI accesses AWS through **OIDC** federation and short-lived roles, not through long-lived access keys,
- separate roles per environment; prod deployment only from a protected branch with review.

```bash
checkov -d infra/ --framework terraform --compact
terraform plan -out tf.plan && terraform show -json tf.plan > plan.json
cfn-guard validate --data plan.json --rules rules/tf_plan.guard
```

> **On the exam:** "prevent an insecure resource **before** deployment in the CI pipeline" = **cfn-guard / Checkov** in the pipeline; "prevent it even if someone deploys outside the pipeline through CloudFormation" = **CloudFormation Hooks** (or a Control Tower proactive control). "The same baseline in all accounts, including future ones" = **StackSets with service-managed permissions and automatic deployment**. cfn-lint checks syntax and correctness, not the company's security policy.

## 6.2.2 Tags and tagging strategy

Tags are `key=value` metadata used for cost, automation, access, and compliance. A good strategy has a small number of **mandatory** tags with clear values:

| Tag | Example | Use |
|---|---|---|
| `Environment` | `prod`, `staging`, `dev` | Different policies and backup per environment, Firewall Manager scope |
| `CostCenter` | `CC-1042` | Cost allocation tags in billing reports |
| `Department` / `Team` | `payments` | ABAC, ownership of findings |
| `Owner` | `team-payments@firma.ba` | Whom to send findings and alarms to |
| `DataClassification` | `confidential` | Macie, backup, and encryption policies |

How to enforce tags:
- **Tag policies** (Organizations) for the correct key spelling and allowed values, with `enforced_for` to reject noncompliant operations.
- An **SCP** with `aws:RequestTag` / `aws:TagKeys` for a mandatory tag at creation.
- The **AWS Config** rule `required-tags` to detect existing resources without the tag.
- Tags in IaC modules (`default_tags` in the Terraform AWS provider, `Tags` in StackSets).

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

### The link to ABAC

**Attribute-based access control (ABAC)** allows access when the principal's tag matches the resource's tag. It is then critical that users **cannot change** the tags that decide access.

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

> **On the exam:** "the tags `costcenter`, `CostCenter`, and `Cost-Center` are mixed in billing reports" = **tag policy**. "Allow access without a new policy for every new project" = **ABAC** with `aws:PrincipalTag` and `aws:ResourceTag`, with the tags protected from modification. "Find existing resources without the tag" = Config `required-tags`.

## 6.2.3 AWS Firewall Manager

**AWS Firewall Manager** centrally applies protection policies to the accounts in an organization and **automatically applies them to new accounts and resources** in scope. Prerequisites: AWS Organizations, a **Firewall Manager administrator** account (can be delegated, e.g., the Security Tooling or Network account), and **AWS Config** enabled in the accounts and Regions the policy covers.

| Policy type | What it does |
|---|---|
| **AWS WAF** | A web ACL with mandatory rule groups that run **first and last**; the account owner can add their own rules in between. On ALB, API Gateway, CloudFront, AppSync… |
| **Shield Advanced** | Enables Shield Advanced protection for the selected resource types in all accounts. |
| **Security group** | *Common* (a shared SG attached to resources), *content audit* (rules that SGs must not have, e.g., 0.0.0.0/0 on 22), *usage audit* (unused and duplicate SGs). |
| **Network ACL** | Baseline NACL entries in all subnets in scope. |
| **AWS Network Firewall** | Creates firewall endpoints and the policy in the VPCs in scope (distributed or centralized). |
| **Route 53 Resolver DNS Firewall** | Attaches DNS Firewall rule groups (e.g., blocking malicious domains) to VPCs. |
| **Third-party** | Palo Alto Cloud NGFW, Fortigate CNF. |

Scope is set by accounts, OUs, resource type, and **tags** (e.g., only resources with `Environment=prod`). Each policy can either only report noncompliance or **remediate automatically**.

> **On the exam:** "every new ALB in any account must automatically get the mandatory WAF rules (e.g., AWS Managed Rules)" = a **Firewall Manager WAF policy**, not a StackSet or a manual web ACL. "Find and remove SG rules that open SSH to the internet in all accounts" = a Firewall Manager **security group content audit** policy with remediation.

## 6.2.4 Sharing resources: Service Catalog and AWS RAM

### AWS Service Catalog

**Service Catalog** offers users only approved, securely preconfigured products (CloudFormation or Terraform templates).

- **Portfolio**: a set of products with access for specific IAM principals or groups. A portfolio can be **shared** with other accounts or the entire organization/OU.
- **Product**: a versioned template (e.g., "encrypted S3 bucket", "EKS namespace with standard policies").
- **Constraints**:
  - **Launch constraint**: the IAM role that Service Catalog uses for provisioning. The user needs no permissions on the services themselves, only the permission to launch the product. This is key for **least privilege**.
  - **Template constraint**: restricts parameter values (e.g., only `t3.small` and `t3.medium`).
  - **Notification**, **tag update**, and **StackSet** constraints.
- **TagOptions** enforce correct tags on provisioned products.

### AWS Resource Access Manager (RAM)

**AWS RAM** shares resources without copying them: **VPC subnets** (VPC sharing), Transit Gateway, Route 53 Resolver rules, prefix lists, AWS Private CA, Network Firewall policies, License Manager configurations, and more.

- With sharing with Organizations enabled, sharing within the organization does not require accepting an invitation; accounts outside the organization must accept.
- You can share with an OU, so new accounts in the OU automatically get access.
- **Managed permissions** determine what a consumer of the shared resource may do (e.g., only use the subnet, not modify it).
- The owner keeps control; with VPC sharing, a participant creates its own resources in the shared subnet but cannot modify the VPC, routes, or other participants' resources.

```bash
aws ram enable-sharing-with-aws-organization
aws ram create-resource-share --name shared-prod-subnets \
  --resource-arns arn:aws:ec2:eu-central-1:555555555555:subnet/subnet-0abc \
  --principals arn:aws:organizations::111111111111:ou/o-abc123/ou-ab12-prod
```

> **On the exam:** "developers must be able to create approved resources without direct IAM permissions on EC2/RDS" = **Service Catalog with a launch constraint**. "Application accounts use a centrally managed network without peering and without their own VPC" = **VPC sharing through RAM**. RAM does not copy the resource and does not work with all types; Service Catalog shares **templates**, RAM shares **existing resources**.

## 6.3.1 AWS Config and Security Hub

### AWS Config rules

**AWS Config** records resource configuration over time and evaluates it with rules.

| Rule type | Description |
|---|---|
| **Managed rules** | Ready-made AWS rules: `s3-bucket-public-read-prohibited`, `encrypted-volumes`, `restricted-ssh`, `iam-root-access-key-check`, `required-tags`… |
| **Custom policy rules** | Rules written in the **CloudFormation Guard** DSL, without a Lambda function. |
| **Custom Lambda rules** | A Lambda function with arbitrary logic (e.g., calling an external CMDB). |

Triggers: **configuration change** (when the resource changes), **periodic** (e.g., every 24 hours), or both. Some rules also support **proactive** evaluation before a resource is created.

**Automatic remediation**: an **SSM Automation** runbook (AWS or your own) is associated with the rule, with automatic execution and a number of retries. E.g., `AWS-DisableS3BucketPublicReadWrite` or `AWSConfigRemediation-RemoveUnrestrictedSourceIngressRules`.

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

**Notifications**: a compliance change sends an event to **EventBridge** (`Config Rules Compliance Change`), from where it goes to SNS, Slack (via AWS Chatbot / Amazon Q Developer in chat applications), or ticketing.

**At the organization level**:
- **Organization Config rules** and **organization conformance packs** from the management or delegated admin account enable the same rules in all accounts.
- **Conformance pack**: a bundle of rules and remediations as a single YAML (e.g., "Operational Best Practices for PCI DSS", "CIS"); provides a compliance score per pack.
- **Aggregator**: consolidates Config data and compliance from multiple accounts and Regions into one account (an organization aggregator from the delegated admin account). An aggregator **only displays**; rules and remediation run in each account.

### Security Hub

**AWS Security Hub CSPM** (the original Security Hub, renamed in 2025) runs security **standards** as a set of controls over Config data (which is why it requires AWS Config recording to be enabled):

- **AWS Foundational Security Best Practices (FSBP)**: AWS recommendations for many services,
- **CIS AWS Foundations Benchmark**, **PCI DSS**, **NIST SP 800-53**, NIST SP 800-171, the AWS Resource Tagging Standard, and service-managed standards (e.g., for Control Tower).

Automation:
- **Central configuration**: the delegated admin uses **configuration policies** to determine which standards and controls are enabled per OU and account, for all Regions linked to the home Region.
- **Automation rules**: automatically modify finding fields (e.g., raise severity for a prod account, suppress a known exception).
- **EventBridge**: findings and **custom actions** trigger Lambda/SSM for remediation or a ticket.
- Cross-Region aggregation of findings into one Region.

The new **AWS Security Hub** (2025) consolidates findings from GuardDuty, Inspector, Macie, and CSPM in OCSF format and adds risk correlation; for compliance with standards, the CSPM controls are still used.

> **On the exam:** "automatically remove public access to an S3 bucket as soon as it appears" = **a Config rule + automatic remediation with an SSM Automation runbook**. "A single view of compliance for all 200 accounts" = a **Config aggregator** (or Security Hub with a delegated admin). "Measure compliance with the CIS benchmark across the organization" = the **Security Hub CSPM CIS standard** or a Config conformance pack. An aggregator does not remediate.

## 6.3.2 Evidence for audits: Audit Manager and AWS Artifact

### AWS Audit Manager

**AWS Audit Manager** continuously collects **evidence** and maps it to controls from a **framework**.

- **Frameworks**: prebuilt ones (e.g., CIS, PCI DSS, HIPAA, SOC 2, GDPR, NIST, AWS best practices) or **custom** frameworks with your own controls.
- **Assessment**: a framework applied to selected accounts and services; with an organization it uses a delegated admin.
- **Evidence sources**: AWS Config evaluations, Security Hub findings, CloudTrail user activity, configuration snapshots via API calls, and **manual evidence** (uploaded documents, e.g., a training policy).
- **Delegations**: controls are assigned to owners for review; an **assessment report** is generated into an S3 bucket for the auditor. Evidence finder enables searching the evidence.

Availability note: AWS announced that from April 30, 2026, Audit Manager is not open to new customers and is moving to maintenance mode; existing customers continue to use it, and AWS suggests Config conformance packs as an alternative. The exam still lists it under skill 6.3.2.

### AWS Artifact

**AWS Artifact** is the portal for **AWS's own** compliance documents:

- **Reports**: SOC 1/2/3 reports, the PCI DSS Attestation of Compliance, ISO certificates, and reports from some independent software vendors on AWS Marketplace. They are used as evidence for the part of the responsibility that belongs to AWS (shared responsibility).
- **Agreements**: e.g., the **Business Associate Addendum (BAA)** for HIPAA. The management account can accept an agreement for the **entire organization**.
- Access is controlled with IAM (e.g., `artifact:GetReport`), and notifications announce new reports.

> **On the exam:** "the auditor requests AWS's SOC 2 report or PCI AOC" = **AWS Artifact**. "Continuously collect evidence about **our** controls and prepare a report for the audit" = **Audit Manager**. "The company must sign a BAA for all accounts before processing PHI" = an Artifact **organization agreement** from the management account.

## 6.3.3 AWS Well-Architected Tool and the Security pillar

The **AWS Well-Architected Tool** is a free service for a structured review of a **workload** with questions from the Well-Architected Framework.

- **Lenses**: the core Well-Architected Framework (six pillars), specialized lenses (e.g., Serverless, SaaS, Generative AI), and **custom lenses** for internal standards.
- Result: a list of **high-risk issues (HRIs)** and medium-risk issues, an **improvement plan** with recommendations, and **milestones** for tracking progress over time.
- A workload can be shared with other accounts; integration with Trusted Advisor data.

**Security pillar** areas: security foundations, identity and access management, detection, infrastructure protection, data protection, incident response, and application security. Principles: a strong identity foundation and least privilege, traceability, security at all layers, automation, protecting data in transit and at rest, keeping people away from data, and preparing for incidents.

> **On the exam:** "evaluate a workload's architecture against AWS security best practices and track progress over time" = **Well-Architected Tool** (Security pillar, milestones). Do not confuse it with Security Hub (continuous technical checks of resources) or with Trusted Advisor (automated account checks).

## Summary

- **StackSets with service-managed permissions** and automatic deployment provide the same baseline in all OU accounts, including new ones; a **stack policy**, termination protection, and **drift detection** protect stacks.
- **cfn-lint** = template correctness; **CloudFormation Guard** and **Checkov/tfsec** = policy-as-code in CI; **Hooks** = checks inside CloudFormation itself before creation.
- A tagging strategy with few mandatory tags; **tag policies** for spelling and values, SCP/Config for presence; **ABAC** requires protecting tags from modification.
- **Firewall Manager** centrally enforces WAF, Shield Advanced, SG, NACL, Network Firewall, and DNS Firewall policies and automatically covers new accounts; it requires Organizations and AWS Config.
- **Service Catalog** (portfolio, launch constraint for least privilege) shares approved templates; **RAM** shares existing resources (subnets, TGW, Private CA).
- **Config**: managed, Guard, and Lambda rules, **SSM Automation** remediation, conformance packs, and the aggregator (display only); **Security Hub CSPM** FSBP and CIS standards with central configuration and automation rules.
- **Audit Manager** collects evidence about your controls; **AWS Artifact** provides AWS's reports and agreements (BAA); the **Well-Architected Tool** evaluates a workload through the Security pillar.
