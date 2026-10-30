## What this module covers

The module covers task **4.1** of domain 4 (**Identity and Access Management**, 20% of the exam, the largest domain): designing, implementing, and troubleshooting authentication strategies. Skills:

- **4.1.1** identity solutions for people, applications, and systems (IAM Identity Center, Amazon Cognito, MFA, IdP integration),
- **4.1.2** mechanisms for issuing temporary credentials (AWS STS, S3 presigned URLs),
- **4.1.3** troubleshooting authentication (CloudTrail, Cognito, Identity Center permission sets, AWS Directory Service).

Authentication answers the question **who are you** (identity + proof), and authorization (module 07) answers **what are you allowed to do**. The exam typically asks: how employees from Entra ID/Okta get into 50 accounts, how a mobile app gets access to S3 without keys in the app, how a third-party vendor accesses your account without the confused deputy problem, and why federation "does not work".

## Map: which identity for whom

| Who signs in | Recommended solution | Why |
|---|---|---|
| Employees (workforce) in multiple accounts | **AWS IAM Identity Center** with an external IdP | Central, SSO, temporary credentials, permission sets |
| End users of a web/mobile application | **Amazon Cognito user pool** | Sign-up, sign-in, MFA, social/SAML/OIDC federation, JWT tokens |
| End users who need direct access to AWS resources | **Cognito identity pool** | Exchanges a token for temporary AWS credentials |
| An application on AWS (EC2, Lambda, ECS, EKS) | **IAM role** (instance profile, execution role, task role, Pod Identity) | No keys, automatic rotation |
| A workload outside AWS with an X.509 certificate | **IAM Roles Anywhere** (details in module 07) | No long-lived keys |
| CI/CD outside AWS (GitHub Actions, GitLab) | **OIDC identity provider in IAM** + `AssumeRoleWithWebIdentity` | A short-lived token per job |
| Another AWS account / vendor | **Cross-account role** + **external ID** | No key sharing |
| Exception: a legacy tool that requires an access key | IAM user with a key, rotation, minimal permissions | Last resort |

> **On the exam:** "Employees already have accounts in Microsoft Entra ID and need access to 30 AWS accounts" = **IAM Identity Center** with Entra ID as the external IdP (SAML 2.0) and **SCIM** provisioning. Creating IAM users in every account is always wrong.

## IAM Identity Center

**AWS IAM Identity Center** (formerly AWS SSO) is the recommended service for workforce access to AWS accounts and applications. It is enabled in the organization's **management** account (organization instance), and administration can be delegated to a **delegated administrator** account.

### Identity source

Identity Center has exactly **one** identity source:

1. **Identity Center directory**: users and groups are created directly in Identity Center.
2. **Active Directory**: AWS Managed Microsoft AD or a self-managed AD through **AD Connector**.
3. **External identity provider**: Okta, Microsoft Entra ID, Ping, Google Workspace, and others, via **SAML 2.0**.

With an external IdP, distinguish between two protocols:

| Protocol | What it does |
|---|---|
| **SAML 2.0** | **Authentication**: the IdP confirms the user's identity and sends an assertion. |
| **SCIM** (System for Cross-domain Identity Management) | **Provisioning**: automatically synchronizes users and groups from the IdP into Identity Center (create, update, deactivate). |

Without SCIM, you must create users and groups manually in Identity Center to assign them access. When an employee leaves and is deactivated in the IdP, SCIM deactivates them in Identity Center as well.

### Permission sets

A **permission set** is a template of permissions (AWS managed policies, customer managed policies by name, an inline policy, optionally a **permissions boundary**) and a **session duration** (1 to 12 hours). When you assign a group + permission set + account, Identity Center creates an IAM role in that account:

```text
arn:aws:iam::222233334444:role/aws-reserved/sso.amazonaws.com/eu-central-1/AWSReservedSSO_DevReadOnly_1a2b3c4d5e6f7a8b
```

In the **AWS access portal** the user picks an account and role and receives temporary credentials (for the console or CLI: `aws configure sso`, `aws sso login`).

Important details:

- Changing a permission set requires **reprovisioning** in the accounts (the console offers it, or `ProvisionPermissionSet`).
- A **customer managed policy** in a permission set is referenced by name and path; a policy with that name must exist in every target account, otherwise provisioning fails.
- Do not modify the `AWSReservedSSO_*` roles manually; Identity Center overwrites them.
- **Attributes for access control**: attributes from the IdP (e.g., `department`) become session tags for ABAC (module 07).
- MFA in Identity Center: authenticator apps, security keys, and built-in authenticators (FIDO2/WebAuthn). With an external IdP, MFA is usually handled by the IdP.

> **On the exam:** "A user signs in to the access portal successfully but does not see the Prod account" = a missing **assignment** (group + permission set + account) or the user is not in the group (SCIM synchronization). "We changed the policy in a permission set, but users still have the old permissions" = the permission set was not **reprovisioned**.

## Root user and MFA

### MFA types in IAM

| Type | Phishing-resistant | Note |
|---|---|---|
| **Passkeys and security keys** (FIDO2/WebAuthn) | Yes | Recommended. Device-bound (YubiKey) or synced passkey (iCloud Keychain, Google, 1Password). Can be enabled only through the console. |
| **Virtual authenticator** (TOTP app) | No | A temporary solution until keys arrive. |
| **Hardware TOTP token** | No | Only tokens purchased from supported vendors. |
| SMS MFA | — | AWS no longer supports enabling SMS MFA for IAM. |

- The root user and every IAM user can have up to **eight** MFA devices of any type; one is needed to sign in.
- **MFA is mandatory for the root user** of all account types (standalone, management, and member).
- A passkey/security key cannot be passed to STS calls (`--serial-number/--token-code` works only with TOTP). For the CLI with a passkey, use `aws login` or Identity Center.

### Centralized root access

For member accounts in Organizations you can enable **centralized root access**: you remove the root credentials (password, keys, MFA) of member accounts, and the rare privileged root tasks (e.g., unlocking an S3 bucket policy that locked everyone out, deleting a faulty SQS policy) are performed from the management or delegated admin account via **`sts:AssumeRoot`** with a predefined task policy. A short-lived session, everything in CloudTrail.

### Enforcing MFA with a policy

For IAM users (of which there should be as few as possible), MFA is enforced with a policy using the `aws:MultiFactorAuthPresent` condition:

```json
{
  "Sid": "DenyAllExceptMfaSetupWithoutMFA",
  "Effect": "Deny",
  "NotAction": [
    "iam:CreateVirtualMFADevice", "iam:EnableMFADevice",
    "iam:ListMFADevices", "iam:GetUser", "sts:GetSessionToken"
  ],
  "Resource": "*",
  "Condition": { "BoolIfExists": { "aws:MultiFactorAuthPresent": "false" } }
}
```

`BoolIfExists` matters: for calls made with a long-lived access key, the `aws:MultiFactorAuthPresent` key does not exist, so a plain `Bool` would let the request through. For the CLI, the user first calls `GetSessionToken` with an MFA code and receives temporary credentials in which MFA is present.

## Amazon Cognito

### User pool vs identity pool

| | **User pool** | **Identity pool** (federated identities) |
|---|---|---|
| Role | User directory and **authentication** | **Authorization to AWS**: exchanges a token for AWS credentials |
| Output | JWT tokens: ID token, access token, refresh token | Temporary AWS credentials (STS) for an IAM role |
| Identity sources | Own users, social (Google, Apple, Facebook, Amazon), SAML, OIDC | User pool, social, SAML, OIDC, developer authenticated, and **guest** (unauthenticated) |
| Typical use | Signing in to an application, protecting API Gateway/ALB | A mobile app writes directly to S3 or DynamoDB |

The most common combination: the user signs in to the **user pool**, the app gets an ID token, passes it to the **identity pool**, and gets temporary credentials for the "authenticated" role. An identity pool can map different roles based on token claims (rules-based) or on `cognito:preferred_role` from a user pool group.

Trust policy of a role for an identity pool:

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "cognito-identity.amazonaws.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "cognito-identity.amazonaws.com:aud": "eu-central-1:11111111-2222-3333-4444-555555555555" },
    "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
  }
}
```

Without a condition on `aud`, any identity pool (including someone else's) could assume the role. The role's policy can use `${cognito-identity.amazonaws.com:sub}` so that each user sees only their own prefix in S3.

### User pool security features

- **MFA**: TOTP, SMS, email; can be optional or required.
- **Passkeys** (WebAuthn) as passwordless sign-in, in all feature plans except **Lite**, through the choice-based authentication flow. A passkey with user verification can satisfy an MFA requirement.
- **Threat protection** (formerly advanced security, **Plus** plan): adaptive authentication based on sign-in risk, compromised password detection.
- An **AWS WAF** web ACL on the user pool against brute force and bots.
- Short access token lifetime, refresh token revocation, Lambda triggers (pre sign-up, pre token generation).

> **On the exam:** "A mobile app needs to upload images to S3 directly, without a backend server and without embedded keys" = **Cognito user pool + identity pool** with a role that uses `${cognito-identity.amazonaws.com:sub}` in the prefix. "Signing in to a web application and protecting a REST API with a JWT" = just a **user pool** (API Gateway Cognito authorizer).

## AWS STS and temporary credentials

**AWS Security Token Service (STS)** issues temporary credentials: an access key ID, a secret access key, and a **session token**. API overview:

| API | Who calls it | Duration | Typical scenario |
|---|---|---|---|
| **AssumeRole** | An IAM user or role with AWS credentials | 15 min up to the role's max session duration (1–12 h, default 1 h). **Role chaining**: max 1 h. | Cross-account access, switching to an admin role, MFA via a condition. |
| **AssumeRoleWithSAML** | Anyone with a SAML assertion from an IdP that is an IAM SAML provider | 15 min up to the role's max session duration | Direct SAML federation into one account (without Identity Center). |
| **AssumeRoleWithWebIdentity** | Anyone with an OIDC token (Cognito, IRSA, GitHub Actions) | 15 min up to the role's max session duration | Mobile apps, CI/CD, EKS IRSA. |
| **GetSessionToken** | An IAM user or root | IAM user: 15 min–36 h (default 12 h); root: up to 1 h | Obtaining MFA-protected credentials for the CLI. |
| **GetFederationToken** | An IAM user | 15 min–36 h | Older broker patterns; the session is limited by a session policy. |
| **AssumeRoot** | The management or delegated admin account | A short session | Privileged root tasks in a member account. |

Additionally:

- A **session policy** (`--policy`, `--policy-arns`) further narrows the session; it cannot grant more than the role's policy.
- **Session tags** (`--tags`) and **source identity** carry the user's identity through a chain of roles (visible in CloudTrail).
- The **`aws:MultiFactorAuthPresent`** or **`aws:MultiFactorAuthAge`** condition in the trust policy enforces MFA on `AssumeRole`.
- Credentials cannot be "revoked" individually; for a compromised role use **Revoke active sessions** (adds a Deny for tokens issued before that moment, condition `aws:TokenIssueTime`).

```bash
# Cross-account AssumeRole with MFA and an external ID
aws sts assume-role \
  --role-arn arn:aws:iam::222233334444:role/AuditReadOnly \
  --role-session-name ana-audit \
  --external-id 7f3c9a12-acme \
  --serial-number arn:aws:iam::111122223333:mfa/ana --token-code 123456 \
  --duration-seconds 3600
```

### External ID and the confused deputy

The **confused deputy** problem: a vendor (e.g., a cost monitoring SaaS) has a single AWS role of its own that it uses to access the roles of many customers. If an attacker, also a customer, gives the vendor **your** role ARN, the vendor would access your account on the attacker's behalf. The fix: the vendor generates a unique **external ID** for each customer, and you require it in the trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::999988887777:role/VendorIntegration" },
    "Action": "sts:AssumeRole",
    "Condition": { "StringEquals": { "sts:ExternalId": "7f3c9a12-acme" } }
  }]
}
```

An external ID is not a secret password: it prevents the vendor from using your role by mistake or at someone else's request. For AWS **services** that access your resources (e.g., SNS writes to SQS, CloudTrail writes to S3), you solve the same problem with the **`aws:SourceArn`** and **`aws:SourceAccount`** conditions in the resource policy.

> **On the exam:** "A third party needs access to our account, and the confused deputy problem must be prevented" = a cross-account role with an **`sts:ExternalId`** condition. If the "third party" is an AWS service, the answer is **`aws:SourceArn` / `aws:SourceAccount`**.

## S3 presigned URLs

A **presigned URL** gives time-limited access to a single object (GET for download, PUT for upload) without changing the bucket policy. The URL carries the signature of the credentials of whoever created it, so it has **their** permissions.

| Credentials used to sign the URL | Maximum validity |
|---|---|
| IAM user (SigV4), CLI/SDK | up to **7 days** |
| S3 console | 1 minute to 12 hours |
| Temporary credentials (role, STS) | **as long as the credentials are valid**, regardless of the requested time |
| Instance profile | as long as the instance credentials are valid (typically a few hours) |

```bash
aws s3 presign s3://acme-reports/2026/q3.pdf --expires-in 900
```

Common problems:

- The URL expires earlier than requested: it was signed with temporary credentials (e.g., a Lambda execution role) that expired.
- `403 AccessDenied`: the signer lacks `s3:GetObject`, the bucket policy has an explicit Deny, or the signer lacks `kms:Decrypt` for an SSE-KMS object.
- Restrictions: a bucket policy can reject old signatures (`s3:signatureAge`) or requests from outside the network (`aws:SourceIp`, `aws:SourceVpce`).

> **On the exam:** "A partner needs to download one report within the next 24 hours, without an AWS account" = **presigned URL**. If the URL is generated by Lambda and "expires after an hour", the cause is the **role session** duration, not `--expires-in`.

## AWS Directory Service

| Option | What it is | When |
|---|---|---|
| **AWS Managed Microsoft AD** | A real Microsoft AD (two domain controllers in two AZs) managed by AWS. Supports a **trust** with on-premises AD, Group Policy, LDAPS, RADIUS MFA. | Windows workloads on AWS (RDS SQL Server, FSx for Windows, WorkSpaces), when you need AD in the cloud or a trust to on-premises. |
| **AD Connector** | A proxy that forwards requests to the on-premises AD. Stores no users and no cache. Supports RADIUS MFA. | Users stay in the on-premises AD; sign-in to Identity Center, WorkSpaces, the console. Requires a constant network connection (VPN/Direct Connect). |
| **Simple AD** | Samba-compatible, basic features, no trusts and no MFA. | Small environments; rarely the correct answer on the exam. |

Troubleshooting AD Connector: DNS resolution of the on-premises domain, open ports (53, 88, 389) to the DCs, a correct service account with read permissions, network connectivity through VPN/DX. If the VPN goes down, sign-in through AD Connector does not work because there is no cache.

> **On the exam:** "Users must remain in the on-premises AD, without synchronization to the cloud, and sign in to Identity Center" = **AD Connector**. "We need AD in AWS for Windows applications with a trust to the on-premises domain" = **AWS Managed Microsoft AD**.

## Troubleshooting authentication

### CloudTrail

Authentication events you should know:

| Event (eventSource) | What it means |
|---|---|
| `ConsoleLogin` (`signin.amazonaws.com`) | Console sign-in; `responseElements.ConsoleLogin` is `Success` or `Failure`, `additionalEventData.MFAUsed`. |
| `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` (`sts.amazonaws.com`) | Who assumed which role, from which IdP, with which session name and source identity. |
| `GetSessionToken` | Obtaining an MFA session. |
| Identity Center: `CredentialChallenge`, `CredentialVerification`, `UserAuthentication` | Sign-in to the access portal. `CredentialVerification` says whether a factor (PASSWORD, TOTP, WEBAUTHN) succeeded; `UserAuthentication` is logged only when all factors have passed. With an external IdP you see only `UserAuthentication` (the IdP handles MFA). The events of one sign-in are linked by `AuthWorkflowID`. |

Example of a failed sign-in:

```json
{
  "eventSource": "signin.amazonaws.com",
  "eventName": "ConsoleLogin",
  "userIdentity": { "type": "IAMUser", "userName": "marko" },
  "sourceIPAddress": "203.0.113.50",
  "responseElements": { "ConsoleLogin": "Failure" },
  "additionalEventData": { "MFAUsed": "No" },
  "errorMessage": "Failed authentication"
}
```

STS events go to the Region of the endpoint that was called; look for root console sign-ins and some global events in `us-east-1`. The simplest approach is to have a **multi-Region organization trail**.

### Typical errors

| Symptom | Likely cause |
|---|---|
| `AccessDenied` on `sts:AssumeRole` | The trust policy does not name the caller, or the caller lacks `sts:AssumeRole` in its own policy, or the external ID/MFA condition is missing, or an SCP blocks it. |
| `InvalidIdentityToken` / `Incorrect token audience` with `AssumeRoleWithWebIdentity` | Wrong `aud`, expired token, OIDC provider with the wrong URL or thumbprint. |
| SAML: "Your request included an invalid SAML response" | Missing `https://aws.amazon.com/SAML/Attributes/Role` or `RoleSessionName` attribute, wrong SAML provider ARN, expired IdP certificate, clock skew. |
| `DurationSeconds exceeds the MaxSessionDuration` | The requested duration exceeds the role's max session duration, or role chaining (max 1 h). |
| Cognito `NotAuthorizedException` | Wrong password, user not confirmed, the app client does not allow the auth flow, expired refresh token. |
| Cognito identity pool returns the guest role | The token was not passed in the `Logins` map, or the provider is not configured in the identity pool. |

> **On the exam:** for "who signed in and from where", the answer is always **CloudTrail** (or a CloudTrail Lake query), not VPC Flow Logs. For "SAML federation suddenly stopped working for all users", first check for an **expired IdP certificate / metadata** in the IAM SAML provider or Identity Center.

## Summary

- The workforce comes in through **IAM Identity Center**: one identity source, **SAML** for sign-in, **SCIM** for provisioning, **permission sets** become `AWSReservedSSO_*` roles in the accounts.
- **Cognito user pool** = sign-in and JWT tokens for the application; **identity pool** = exchanging tokens for AWS credentials (with an `aud` condition in the trust policy).
- **MFA** is mandatory for root; prefer **passkeys/security keys** (FIDO2), up to 8 devices; for member accounts consider **centralized root access** (`sts:AssumeRoot`).
- **STS**: AssumeRole (cross-account, role chaining max 1 h), AssumeRoleWithSAML, AssumeRoleWithWebIdentity, GetSessionToken (MFA for the CLI).
- An **external ID** prevents the confused deputy problem with third parties; for AWS services use **`aws:SourceArn`/`aws:SourceAccount`**.
- A **presigned URL** is valid for at most 7 days with an IAM user key, and never longer than the credentials it was signed with.
- **Managed Microsoft AD** (AD in the cloud, trusts) vs **AD Connector** (proxy, no cache); troubleshooting starts with **CloudTrail**.
