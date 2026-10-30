## What this module covers

The module covers task **4.2** of domain 4 (**Identity and Access Management**, 20% of the exam): designing, implementing, and troubleshooting authorization strategies. Skills:

- **4.2.1** authorization controls for people, applications, and systems (Amazon Verified Permissions, IAM paths, IAM Roles Anywhere, resource policies for cross-account access, role trust policies),
- **4.2.2** ABAC and RBAC strategies (access based on tags and attributes),
- **4.2.3** least privilege IAM policies (permissions boundaries, session policies),
- **4.2.4** analyzing authorization failures (IAM Policy Simulator, IAM Access Analyzer),
- **4.2.5** finding and fixing unintended permissions (IAM Access Analyzer).

This is the most important module of the course. On the exam you will see a JSON policy (or three) and a question such as "why does the user get AccessDenied" or "which change grants access with least privilege". You must know the **evaluation order by heart** and the difference between policies that **grant** permissions and policies that **limit** permissions.

## Policy types

| Type | Where it is attached | Grants permissions? | Whom it affects |
|---|---|---|---|
| **Identity-based policy** | IAM user, group, role | Yes | That principal |
| **Resource-based policy** | A resource (S3 bucket, KMS key, SQS, SNS, Lambda, Secrets Manager, ECR, a role's trust policy…) | Yes | The principals named in `Principal` |
| **Service control policy (SCP)** | Root, OU, or account in Organizations | **No** (maximum only) | **Principals** in member accounts (including the root user) |
| **Resource control policy (RCP)** | Root, OU, or account in Organizations | **No** (maximum only) | **Resources** in member accounts, regardless of who accesses them |
| **Permissions boundary** | IAM user or role | **No** (maximum only) | That principal |
| **Session policy** | Passed on `AssumeRole*` / `GetFederationToken` | **No** (maximum only) | That session |
| **Endpoint policy** | VPC endpoint | **No** | Requests through that endpoint |
| ACL (S3, legacy) | Bucket/object | Yes (cross-account) | Recommendation: disable (Object Ownership = BucketOwnerEnforced) |

Two rules to remember:

1. **An explicit Deny always wins**, regardless of which policy it is in.
2. **Guardrail policies (SCP, RCP, boundary, session, endpoint) never grant permissions.** They only define the upper limit. If no identity or resource policy says `Allow`, the result is an implicit deny.

### SCPs and RCPs in more detail

- SCPs and RCPs work only in an organization with **all features**.
- **They do not affect the management account.** (That is why you do not keep workloads in the management account.)
- **They do not affect service-linked roles.** RCPs also do not affect AWS managed KMS keys.
- When you enable RCPs, `RCPFullAWSAccess` is attached automatically and cannot be detached; for SCPs the default is `FullAWSAccess`. That is why both are typically used as a **deny list**.
- An SCP limits **what principals from my accounts** may do (e.g., "nobody may disable CloudTrail", "only eu-* Regions"). An RCP limits **what may be done with my resources**, even when someone from outside accesses them (e.g., "S3 objects in my organization may be accessed only by principals from the organization").
- RCPs support a subset of services (among them S3, STS, KMS, SQS, Secrets Manager, DynamoDB, ECR, CloudWatch Logs, Cognito, OpenSearch Serverless, and others; the list keeps growing).

RCP example, a **data perimeter** for S3 (only identities from the organization or AWS services):

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
      "StringNotEqualsIfExists": { "aws:PrincipalOrgID": "o-a1b2c3d4e5" },
      "BoolIfExists": { "aws:PrincipalIsAWSService": "false" }
    }
  }]
}
```

SCP example, protecting security services:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ProtectSecurityServices",
    "Effect": "Deny",
    "Action": [
      "cloudtrail:StopLogging", "cloudtrail:DeleteTrail",
      "guardduty:DeleteDetector", "config:StopConfigurationRecorder"
    ],
    "Resource": "*",
    "Condition": {
      "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityBreakGlass" }
    }
  }]
}
```

## Policy evaluation logic

### Within a single account

AWS first authenticates the request, builds the **request context** (principal, action, resource, conditions: IP, time, tags, VPC endpoint…), and then:

1. **Deny evaluation**: reviews **all** applicable policies (SCP, RCP, resource, identity, boundary, session). If any `Deny` statement matches the request → **Deny**, done.
2. **RCP**: if the RCPs of the account that owns the resource do not allow the action → **Deny**.
3. **SCP**: if the SCPs of the principal's account do not allow the action → **Deny**.
4. **Resource-based policy**: if a resource policy allows the request, the outcome depends on **whom** the policy names (see below). In some cases it is an immediate **Allow**.
5. **Identity-based policy**: if no identity policy allows the action (and the resource policy has not already granted Allow) → **Deny** (implicit).
6. **Permissions boundary**: if one exists and does not allow the action → **Deny**.
7. **Session policy**: if the principal is a session with a session policy that does not allow the action → **Deny**. Otherwise → **Allow**.

```text
Request
  │
  ├─ Explicit Deny anywhere? ─────────────────────────── yes → DENY
  ├─ RCP (resource owner) allows? ────────────────────── no  → DENY
  ├─ SCP (principal's account) allows? ───────────────── no  → DENY
  ├─ Resource policy allows (directly to user/session)? yes → ALLOW
  ├─ Identity policy allows? ──────────────────────────── no  → DENY
  ├─ Permissions boundary (if any) allows? ───────────── no  → DENY
  ├─ Session policy (if any) allows? ─────────────────── no  → DENY
  └─ ALLOW
```

### Resource policy in the same account: precisely

In the same account the effective permissions are the **union** of the identity and resource policies: it is enough for one of them to say `Allow`. But the limits (boundary, session policy) do not act equally on all principals:

| The resource policy grants permission to… | Does an implicit deny in the boundary / session policy block it? |
|---|---|
| An **IAM user** by ARN | Does not block (neither the identity policy nor the boundary) |
| An **IAM role** by ARN (`role/...`) | **Blocks**: the request is made by the role session, and a permission granted to the role is limited by the boundary and session policy |
| A **role session** (`assumed-role/Role/session`) | Does not block: the permission is granted directly to the session |
| A **federated user session** (`GetFederationToken`) | Does not block |

Exceptions where the resource policy **must** explicitly allow, even in the same account:

- **Role trust policy**: without it nobody can assume the role.
- **KMS key policy**: IAM policies work only if the key policy enables them (e.g., a statement granting access to `arn:aws:iam::111122223333:root`, i.e., to the account).

An explicit Deny in any policy still wins in all cases.

### Cross-account

When a principal from account A accesses a resource in account B, AWS performs **two evaluations**, and both must result in Allow:

- **Account A (trusted)**: the principal's identity policy must allow the action on the resource in B, and account A's SCPs, the boundary, and the session policy must not block it.
- **Account B (trusting)**: the resource policy must allow the principal from A, and account B's RCPs must not block it.

The union **does not apply** here: a resource policy in B alone is not enough (except for anonymous/public access), and neither is an identity policy in A.

Cross-account S3 example. The bucket policy in account B (222233334444):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowAnalyticsRead",
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:role/AnalyticsReader" },
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::acme-datalake", "arn:aws:s3:::acme-datalake/*"]
  }]
}
```

The identity policy of the `AnalyticsReader` role in account A:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::acme-datalake", "arn:aws:s3:::acme-datalake/*"]
}
```

If the objects are encrypted with an **SSE-KMS** key from account B, you additionally need: the key policy in B allows `kms:Decrypt` for the role from A **and** the identity policy in A allows `kms:Decrypt` on that key. This is the classic cause of "the bucket policy is correct, but I still get AccessDenied".

### Resource policy vs role for cross-account access

| Approach | Advantages | Disadvantages |
|---|---|---|
| **Resource-based policy** (bucket, KMS, SQS…) | The principal keeps its own permissions in its own account (e.g., reads from a bucket in B and writes to a bucket in A in the same call/process). No switching into a role. | Works only for services with resource policies. One policy per resource. |
| **Cross-account role** (`AssumeRole`) | Works for all services; permissions defined centrally in account B; CloudTrail in B shows the session. | The principal gives up its own permissions while using the role. |

> **On the exam:** "A Lambda function in account A must copy objects from a bucket in account B to a bucket in account A" → the simplest is a **bucket policy in B** (resource-based) + an identity policy in A, because the function keeps access to its own bucket. If the service has no resource policy (e.g., the EC2 API), the only way is a **cross-account role**.

### Role trust policy

A trust policy is the role's resource policy: **who** may assume the role. The role's permissions are separate, in the permissions policy.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
    "Action": ["sts:AssumeRole", "sts:TagSession"],
    "Condition": {
      "StringEquals": { "aws:PrincipalTag/Team": "security" },
      "Bool": { "aws:MultiFactorAuthPresent": "true" }
    }
  }]
}
```

`"arn:aws:iam::111122223333:root"` means "account 111122223333": AWS trusts that account, and account A decides through its IAM policies which of its principals may call `sts:AssumeRole`. If you specify a concrete role ARN and then delete and recreate that role, the trust policy stops working (the ARN is internally replaced with an ID).

## Condition keys

| Key | What it checks | Typical use |
|---|---|---|
| **`aws:PrincipalOrgID`** | The principal's organization | Resource policy: "only principals from my organization" without listing accounts |
| **`aws:PrincipalOrgPaths`** | The principal's OU path | Only accounts from the Prod OU |
| **`aws:ResourceOrgID`** | The resource's organization | Identity/SCP: "my people may write only to my organization's buckets" |
| **`aws:SourceVpce`** | The ID of the VPC endpoint the request came through | A bucket accessible only through a specific endpoint |
| **`aws:SourceVpc`** | The VPC the request came from (through an endpoint) | A bucket accessible only from the VPC |
| **`aws:SourceIp`** | The client's public IP address | Restriction to corporate IPs; **does not work** for requests through a VPC endpoint (use `aws:VpcSourceIp` there) |
| **`aws:SecureTransport`** | Whether the request went over TLS | Deny if `false` |
| **`aws:PrincipalTag/<key>`** | A tag on the principal or session | ABAC |
| **`aws:ResourceTag/<key>`** | A tag on an existing resource | ABAC |
| **`aws:RequestTag/<key>`**, **`aws:TagKeys`** | Tags sent in the request (creating, tagging) | Mandatory tags at creation |
| **`aws:CalledVia`** (`CalledViaFirst`, `CalledViaLast`) | The list of services that made calls on the principal's behalf | Allow `s3:GetObject` only when Athena calls |
| **`aws:ViaAWSService`** | `true` when an AWS service uses the principal's credentials to call another service | An exception in IP/VPC Deny rules |
| **`aws:PrincipalIsAWSService`** | Whether the principal is an AWS service (service principal) | An exception for CloudTrail, Config, etc. in the perimeter |
| **`aws:SourceArn`**, **`aws:SourceAccount`** | The resource/account on whose behalf the service accesses | Confused deputy protection for service principals |
| **`aws:MultiFactorAuthPresent`** | MFA in the session | Sensitive actions |
| **`aws:RequestedRegion`** | The Region the request goes to | SCP Region restriction |
| **`aws:PrincipalArn`** | The principal's ARN (for a role: the role ARN, not the session) | An exception for a break-glass role |

### Example: S3 only through a VPC endpoint and only over TLS

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyNotViaVpce",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-payroll", "arn:aws:s3:::acme-payroll/*"],
      "Condition": {
        "StringNotEquals": { "aws:SourceVpce": "vpce-0a1b2c3d4e5f67890" },
        "BoolIfExists": { "aws:ViaAWSService": "false" }
      }
    },
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-payroll", "arn:aws:s3:::acme-payroll/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
```

Multiple keys in one `Condition` block are combined with **AND**; multiple values for the same key with **OR**. The `aws:ViaAWSService` condition prevents the Deny from blocking requests that a service (e.g., Athena or CloudFormation) sends on your behalf from its own addresses.

### Example: aws:CalledVia

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::acme-datalake/*",
  "Condition": { "ForAnyValue:StringEquals": { "aws:CalledVia": ["athena.amazonaws.com"] } }
}
```

The analyst can read the data only through Athena queries, not directly with `aws s3 cp`.

### Operators to recognize

- `StringEquals` / `StringLike` (wildcards `*`, `?`), `ArnLike`, `IpAddress`, `Bool`, `NumericLessThan`, `DateGreaterThan`.
- `...IfExists`: the condition applies only if the key exists in the context (otherwise it is considered satisfied).
- `ForAllValues` / `ForAnyValue` for multivalued keys (`aws:TagKeys`, `aws:CalledVia`). Careful: `ForAllValues` is **true** if the key does not exist or is empty.
- `Null`: `"Null": {"aws:RequestTag/CostCenter": "true"}` means "the tag was not sent".

> **On the exam:** "The bucket must be accessible only to our organization's accounts, including future accounts, with the least maintenance" = **`aws:PrincipalOrgID`** in the bucket policy (or an RCP for all buckets). Listing account IDs is wrong because it requires a change for every new account.

## ABAC vs RBAC

| | **RBAC** (role-based) | **ABAC** (attribute-based) |
|---|---|---|
| Basis | Role/job: `DevOpsAdmin`, `Auditor` | Attributes (tags) of the principal and resource |
| New people | You add them to a group/permission set | Automatically, through attributes from the IdP |
| New projects/resources | You change policies (new ARNs) | No policy change, just correct tags |
| Number of policies | Grows with the number of teams and projects | A small number of generic policies |
| Risk | Role explosion | Someone changes tags → tagging must be protected |

An ABAC policy: a developer may manage EC2 instances only of their own project, and must tag new instances with their project:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageOwnProject",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances", "ec2:RebootInstances"],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": { "StringEquals": { "aws:ResourceTag/Project": "${aws:PrincipalTag/Project}" } }
    },
    {
      "Sid": "CreateOnlyWithOwnProjectTag",
      "Effect": "Allow",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": { "StringEquals": { "aws:RequestTag/Project": "${aws:PrincipalTag/Project}" } }
    },
    {
      "Sid": "NoRetagging",
      "Effect": "Deny",
      "Action": ["ec2:CreateTags", "ec2:DeleteTags"],
      "Resource": "*",
      "Condition": { "StringNotEquals": { "ec2:CreateAction": "RunInstances" } }
    }
  ]
}
```

(In practice `RunInstances` also requires permissions on other resources: AMI, subnet, security group, network interface, volume; this is abridged.)

Where `aws:PrincipalTag` comes from:

- a tag on the IAM user or role,
- **session tags** on `AssumeRole` (`--tags`) or from SAML/OIDC attributes (`https://aws.amazon.com/SAML/Attributes/PrincipalTag:Project`),
- **IAM Identity Center attributes for access control**: attributes from the IdP become session tags.

For ABAC with Identity Center you have one permission set for all teams, and access is determined by the user's `Project` attribute in the IdP.

> **On the exam:** "The company quickly adds new projects and does not want to change IAM policies for every new project" = **ABAC** with `aws:PrincipalTag` = `aws:ResourceTag`. Always check whether the solution prevents the user from changing the tag themselves (Deny on `CreateTags`/`TagResource` or an `aws:TagKeys` condition).

## IAM paths

A **path** is a prefix in the name of an IAM user, role, group, or policy: `arn:aws:iam::111122223333:role/app/payments/PaymentsApi`. It is used for organization and **wildcard permissions**:

```json
{
  "Effect": "Allow",
  "Action": ["iam:PassRole"],
  "Resource": "arn:aws:iam::111122223333:role/app/payments/*"
}
```

The payments team may pass (`iam:PassRole`) only roles under `/app/payments/`. A path does not change permissions by itself and does not appear in the role session ARN (`arn:aws:sts::…:assumed-role/PaymentsApi/session`). Identity Center uses the path `/aws-reserved/sso.amazonaws.com/` for its roles, so resource policies can target all SSO roles via `aws:PrincipalArn` with a wildcard.

## Least privilege: permissions boundaries and session policies

### Permissions boundary

A **permissions boundary** is a managed policy set as the upper limit for an IAM user or role. Effective permissions = the **intersection** of the identity policy and the boundary.

The main scenario is **delegation**: developers may create roles for their Lambda functions themselves, but may never create a role more powerful than allowed.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateRolesOnlyWithBoundary",
      "Effect": "Allow",
      "Action": ["iam:CreateRole", "iam:PutRolePolicy", "iam:AttachRolePolicy"],
      "Resource": "arn:aws:iam::111122223333:role/app/*",
      "Condition": {
        "StringEquals": { "iam:PermissionsBoundary": "arn:aws:iam::111122223333:policy/DevBoundary" }
      }
    },
    {
      "Sid": "NoBoundaryTampering",
      "Effect": "Deny",
      "Action": [
        "iam:DeleteRolePermissionsBoundary",
        "iam:CreatePolicyVersion", "iam:DeletePolicy", "iam:SetDefaultPolicyVersion"
      ],
      "Resource": [
        "arn:aws:iam::111122223333:role/*",
        "arn:aws:iam::111122223333:policy/DevBoundary"
      ]
    }
  ]
}
```

Without the second statement, a developer could remove the boundary or modify the boundary policy itself and thereby escalate privileges.

### Session policy

You pass a **session policy** on `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, or `GetFederationToken`. The session's effective permissions = the intersection of the role policy and the session policy. Example: one role for a multi-tenant application, and on each request a session policy is passed that restricts access to that tenant's prefix.

```bash
aws sts assume-role --role-arn arn:aws:iam::111122223333:role/TenantData \
  --role-session-name tenant-42 \
  --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::acme-tenants/tenant-42/*"}]}'
```

### Comparing the limiting mechanisms

| | SCP | RCP | Permissions boundary | Session policy |
|---|---|---|---|---|
| Who sets it | Organizations admin | Organizations admin | IAM admin (or delegate) | Whoever creates the session |
| Scope | All principals of the account/OU | All resources of the account/OU (supported services) | One user/role | One session |
| Affects the management account | No | No | Yes | Yes |
| Affects external principals | No | **Yes** | No | No |
| Grants permissions | No | No | No | No |
| Typical goal | Guardrail for the entire account | Data perimeter around resources | Delegating role creation | Narrowing a shared role |

> **On the exam:** "Developers must be able to create IAM roles, but those roles must not have more permissions than X" = **permissions boundary** + the `iam:PermissionsBoundary` condition at creation. An SCP is wrong because it would limit the developers and everyone else in the account, not just the new roles.

## IAM Roles Anywhere

**IAM Roles Anywhere** lets workloads **outside AWS** (on-premises servers, another cloud, devices) obtain temporary AWS credentials using **X.509 certificates**, without long-lived access keys.

- **Trust anchor**: the CA you trust, **AWS Private CA** or your own CA (upload the CA certificate).
- **Profile**: which roles may be assumed, optional session/managed policies that further narrow the session, duration.
- The **credential helper** (`aws_signing_helper`) signs the request with the private key and returns credentials through `credential_process` in the AWS CLI/SDK configuration.
- **Revocation**: import a **CRL** into Roles Anywhere; revoked certificates no longer get a session.

The role's trust policy:

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "rolesanywhere.amazonaws.com" },
  "Action": ["sts:AssumeRole", "sts:TagSession", "sts:SetSourceIdentity"],
  "Condition": {
    "StringEquals": { "aws:PrincipalTag/x509Subject/CN": "backup-agent-01.corp.example" },
    "ArnEquals": { "aws:SourceArn": "arn:aws:rolesanywhere:eu-central-1:111122223333:trust-anchor/ta-1234" }
  }
}
```

Certificate attributes (subject, issuer, SAN) become session tags, so the trust policy can allow only specific certificates.

> **On the exam:** "An on-premises server must send backups to S3, and the security policy forbids long-lived access keys; the company already has a PKI" = **IAM Roles Anywhere** with a trust anchor on the corporate CA. Distractors: an IAM user key in Secrets Manager, Systems Manager hybrid activation (when the question asks for certificates and an existing PKI).

## Amazon Verified Permissions

**Amazon Verified Permissions** is a managed service for **authorization inside your application** (not AWS APIs). Policies are written in the **Cedar** language and stored in a **policy store**, and the application asks the service `IsAuthorized` (or `IsAuthorizedWithToken` with a Cognito/OIDC token).

```cedar
permit (
  principal in Group::"doctors",
  action == Action::"viewRecord",
  resource
) when {
  resource.department == principal.department
};

forbid (principal, action, resource)
when { resource.confidential == true && !(principal has clearance) };
```

- Supports RBAC (groups) and ABAC (attributes) in the same policies; `forbid` wins over `permit` (just like Deny in IAM).
- A **schema** validates entities and actions; **policy templates** for recurring permissions (e.g., sharing a document).
- Every decision can be logged for audit, and the authorization logic moves out of the application code.

> **On the exam:** "The application has complex rules about who may see which document, the logic is scattered across the code, and central, auditable authorization is needed for application users" = **Verified Permissions**. IAM policies are for AWS resources, not for objects inside your application.

## Analyzing authorization failures

### Reading the AccessDenied message

Many services now state in the message **which policy type** caused the denial:

```text
User: arn:aws:sts::111122223333:assumed-role/DevRole/ana is not authorized to perform:
s3:GetObject on resource: "arn:aws:s3:::acme-payroll/2026/okt.csv"
with an explicit deny in a resource-based policy
```

Possible variants: `because no identity-based policy allows`, `with an explicit deny in a service control policy`, `because no resource-based policy allows`, `with an explicit deny in a permissions boundary`, `with an explicit deny in a resource control policy`, `with an explicit deny in a session policy`. That phrase tells you immediately where to look.

### IAM Policy Simulator

**IAM Policy Simulator** tests the identity policies, permissions boundaries, SCPs, and resource policies you give it, without making a real call.

- **Principal mode**: the policies of an existing user, group, or role.
- **Custom mode**: a policy you are still writing.
- You can set values for condition keys (IP, tags, MFA).
- Limitations: **does not support RCPs**; results may differ for VPC endpoint policies, role chaining, and complex resource policies.

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::111122223333:role/DevRole \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::acme-payroll/2026/okt.csv
```

### IAM Access Analyzer

| Feature | What it does | When |
|---|---|---|
| **External access analyzer** | Uses logical reasoning to analyze resource policies and finds resources shared **outside the zone of trust** (account or organization), including public access. Per Region. | "Which buckets, KMS keys, roles, Lambda functions, SQS queues… are accessible to someone outside?" |
| **Internal access analyzer** | For selected critical resources, shows which principals **inside** the organization/account have access. | "Who in the organization can read this DynamoDB table?" |
| **Unused access analyzer** | Unused roles, access keys, passwords, and unused permissions (services, actions) of active roles and users. Charged. | Cleaning up excessive permissions |
| **Policy validation** | 100+ grammar and best practice checks (errors, security warnings, suggestions). | In the editor and in CI (`aws accessanalyzer validate-policy`) |
| **Custom policy checks** | `CheckNoNewAccess` (a new version grants no more than the reference), `CheckAccessNotGranted` (the policy does not grant critical actions/resources), `CheckNoPublicAccess` (a resource policy does not open public access). Charged per call. | A gate in CI/CD before deploying IaC |
| **Policy generation** | Builds a least-privilege policy from a role's/user's CloudTrail activity over a given period. | From `*` → the actions actually used |
| **Preview access** | Before applying a policy, shows which findings it would generate. | Checking a bucket policy change |

```bash
# CI/CD gate: the new policy must not grant iam:PassRole or s3:DeleteBucket
aws accessanalyzer check-access-not-granted \
  --policy-document file://role-policy.json \
  --access '[{"actions":["iam:PassRole","s3:DeleteBucket"]}]' \
  --policy-type IDENTITY_POLICY
```

An external access analyzer finding that is intended (e.g., a partner) is archived or covered by an **archive rule**; an unintended one is fixed and followed by a **rescan**. Findings go to Security Hub and EventBridge.

> **On the exam:** "Find all S3 buckets and KMS keys in the organization shared with accounts outside the organization" = **Access Analyzer external access** with the organization as the zone of trust. "Remove permissions that roles have not used in 90 days" = **unused access analyzer** or **policy generation**. "Prevent Terraform in the pipeline from adding a policy that grants more access than before" = the **custom policy check `CheckNoNewAccess`**.

## Summary

- Order: **explicit Deny** (anywhere) → **RCP** → **SCP** → **resource policy** → **identity policy** → **permissions boundary** → **session policy**. Guardrail policies never grant permissions.
- In the same account the identity and resource policies **add up** (union); a resource policy that names a **role** is still limited by the boundary and session policy, while one that names a **session or user** is not. The trust policy and KMS key policy must explicitly allow.
- Cross-account: **both sides** must allow (identity in A + resource in B, with SCPs in A and RCPs in B); with SSE-KMS the key policy is also needed.
- An **SCP** limits the principals of my account, an **RCP** limits access to my resources (including external principals); neither applies to the management account or service-linked roles.
- Key conditions: `aws:PrincipalOrgID`, `aws:SourceVpce`, `aws:SourceIp` (not through an endpoint), `aws:SecureTransport`, `aws:PrincipalTag`/`ResourceTag`/`RequestTag`, `aws:CalledVia`, `aws:ViaAWSService`.
- **ABAC** scales without policy changes but must protect tags; a **boundary** enables safe delegation of role creation; a **session policy** narrows a shared role.
- **Roles Anywhere** = X.509 for workloads outside AWS; **Verified Permissions** (Cedar) = authorization inside the application.
- Troubleshooting: the AccessDenied message states the policy type, **Policy Simulator** (no RCPs), **Access Analyzer** (external, internal, unused, validation, custom checks, generation).
