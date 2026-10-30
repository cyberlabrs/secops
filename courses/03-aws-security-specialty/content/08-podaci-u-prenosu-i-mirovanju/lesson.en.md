## What this module covers

The module covers two tasks of domain 5 (**Data Protection**, 18% of the exam):

- **5.1** controls for data **in transit**: enforcing TLS (ELB security policies, TLS configurations), private access to resources (PrivateLink, VPC endpoints, Client VPN, Verified Access), encryption between resources (EMR, EKS, SageMaker AI, Nitro).
- **5.2** controls for data **at rest**: choosing the key and encryption type (KMS, CloudHSM, client-side, server-side), integrity (S3 Object Lock, Glacier Vault Lock, versioning, code signing, file validation), automated lifecycle and retention (S3 Lifecycle, EFS Lifecycle, FSx for Lustre backup), replication and backup (Data Lifecycle Manager, AWS Backup, ransomware protection, DataSync).

Key and secret management (KMS rotation, imported key material, Secrets Manager, Private CA) is in module 09. Here you choose **where** and **how** data is encrypted and how it is protected from modification and deletion.

## 5.1 Data in transit

### Enforcing TLS on Elastic Load Balancing

An **Application Load Balancer** (HTTPS listener) and a **Network Load Balancer** (TLS listener) terminate TLS. Which protocol versions and ciphers they accept is determined by the listener's **security policy**.

| Policy (examples) | What it means |
|---|---|
| `ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09` | The console default: TLS 1.3 and 1.2, restrictive ciphers, post-quantum hybrid key exchange |
| `ELBSecurityPolicy-TLS13-1-2-2021-06` | TLS 1.3 + 1.2 |
| `ELBSecurityPolicy-TLS13-1-3-2021-06` | TLS 1.3 only |
| `ELBSecurityPolicy-TLS13-1-2-FIPS-2023-04` | FIPS variant |
| `ELBSecurityPolicy-2016-08` | Old, allows TLS 1.0/1.1; the default when you create a listener through the CLI/CloudFormation without specifying a policy |

```bash
aws elbv2 modify-listener --listener-arn arn:aws:elasticloadbalancing:...:listener/app/web/... \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06
```

Other controls:

- An **HTTP → HTTPS redirect** rule on port 80.
- **End-to-end encryption**: the ALB re-encrypts toward the target (target group protocol HTTPS). An NLB can do **TCP passthrough** so that the application itself terminates TLS.
- **Mutual TLS (mTLS)** on the ALB: **verify** mode (the ALB checks the client certificate against a **trust store**) or **passthrough** (the certificate is forwarded to the target in a header).
- Certificates from **AWS Certificate Manager (ACM)**: free public certificates with automatic renewal (DNS validation), private ones via AWS Private CA.
- Which TLS version was actually used is visible in the ALB **connection logs** and access logs.

> **On the exam:** "An audit requires the load balancer to accept only TLS 1.2 or later, with the least effort" = change the HTTPS listener's **security policy**. Changing application code or adding WAF rules is a distractor. Watch for the trap: a listener created through IaC without `SslPolicy` gets the old `ELBSecurityPolicy-2016-08`.

### CloudFront

| Setting | Options | Note |
|---|---|---|
| **Viewer protocol policy** | HTTP and HTTPS / **Redirect HTTP to HTTPS** / **HTTPS only** | Between the client and the edge location |
| **Security policy** (viewer) | e.g., `TLSv1.2_2021` | Minimum TLS version and ciphers for clients |
| **Origin protocol policy** | HTTP only / **HTTPS only** / Match viewer | Between CloudFront and the origin |
| Origin SSL protocols | TLS versions toward the origin | The origin certificate must be from a trusted CA and match the origin name |
| Certificate for your own domain | ACM certificate in **us-east-1** | For an ALB, the certificate must be in the ALB's Region |

For an S3 origin use **Origin Access Control (OAC)** (the bucket policy allows only `cloudfront.amazonaws.com` with the distribution's `aws:SourceArn`). **Field-level encryption** encrypts individual form fields (e.g., the card number) with a public key at the edge, so further through the system only the service with the private key can see them.

### aws:SecureTransport in a bucket policy

S3 also accepts HTTP. To enforce TLS, add a Deny when `aws:SecureTransport` is `false`; you can additionally require a minimum TLS version with the `s3:TlsVersion` key.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyHttp",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-records", "arn:aws:s3:::acme-records/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "DenyOldTls",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-records", "arn:aws:s3:::acme-records/*"],
      "Condition": { "NumericLessThan": { "s3:TlsVersion": "1.2" } }
    }
  ]
}
```

The AWS Config rule `s3-bucket-ssl-requests-only` checks whether the bucket policy has such a Deny. For RDS use a parameter group (`rds.force_ssl`, `require_secure_transport` for MySQL); for ElastiCache, in-transit encryption at creation.

### Private access: endpoints, PrivateLink, VPN, Verified Access

| | **Gateway endpoint** | **Interface endpoint** (PrivateLink) |
|---|---|---|
| Services | Only **S3** and **DynamoDB** | Most AWS services, SaaS, and your own services |
| How it works | A route (prefix list) in the route table | An ENI with a private IP in the subnet, private DNS |
| Security group | No | Yes |
| Reachable from on-premises / a peered VPC | **No** | **Yes** (via VPN/DX/TGW) |
| Cost | No charge | Per hour and per GB |
| Endpoint policy | Yes | Yes (most services) |

An **endpoint policy** limits what may be done **through** the endpoint (e.g., only your organization's buckets, preventing exfiltration to someone else's bucket):

```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
    "Resource": "*",
    "Condition": { "StringEquals": { "aws:ResourceOrgID": "o-a1b2c3d4e5" } }
  }]
}
```

A bucket policy with the `aws:SourceVpce` condition (module 07) is the other side of the same story: the endpoint policy says "through this endpoint, only to our resources", and the bucket policy says "this bucket, only through our endpoint".

**AWS PrivateLink** for your own services: the provider creates an **endpoint service** behind a **Network Load Balancer** (or GWLB), and the consumer creates an interface endpoint. Traffic is one-way (consumer → provider), it does not expose the whole VPC, it works even with overlapping CIDRs, and the provider accepts connections manually or automatically.

**AWS Client VPN**: a managed OpenVPN-based VPN for users. Authentication: mutual certificates, Active Directory, SAML federation (e.g., Okta/Entra ID with MFA). **Authorization rules** per group determine which networks a user sees, and a security group on the endpoint filters further. Split tunnel sends only traffic for AWS networks through the VPN. Traffic is encrypted with TLS.

**AWS Verified Access**: zero trust access to applications **without a VPN**. Every request is evaluated based on identity (IAM Identity Center or an OIDC trust provider) and device posture (a device trust provider, e.g., Jamf, CrowdStrike, JumpCloud) against **Cedar** policies. It supports HTTP(S) applications, and since 2025 also non-HTTP resources (TCP, SSH, RDP) through the Connectivity Client. Every access attempt is logged.

> **On the exam:** "Employees must access an internal web application without a VPN, only from corporate devices and with identity verification on every request" = **Verified Access**. "Remote administrators need network access to an entire private subnet" = **Client VPN**. "An application in a private subnet needs S3 without NAT, at the lowest cost" = **gateway endpoint**. "An on-premises server needs private access to S3" = an **interface endpoint** for S3.

### Inter-node encryption

| Service | How it is enabled |
|---|---|
| **Amazon EMR** | A **security configuration** with in-transit encryption: TLS certificates (a PEM archive in S3 or a custom certificate provider). Encrypts traffic between nodes (e.g., shuffle, RPC) and to S3 (TLS). The same configuration also defines at-rest encryption (S3, local disks, EBS). |
| **Amazon EKS** | **Kubernetes API data (including Secrets)**: default **envelope encryption** with KMS v2 on versions 1.28+, with an AWS owned key or your customer managed KMS key. **Pod-to-pod**: the VPC CNI does not encrypt on its own; the options are Nitro instance types with automatic encryption, a **service mesh with mTLS** (e.g., Istio), or WireGuard encryption in the CNI (Cilium, Calico). |
| **SageMaker AI** | **Inter-container traffic encryption** (`EnableInterContainerTrafficEncryption`) for distributed training; additionally `EnableNetworkIsolation`, a VPC, and KMS for volumes and output. Encryption can lengthen training time. |
| **Nitro** | Certain instance types (e.g., C6i, M6i, R6i, C7g, M7i, and later) automatically encrypt traffic between instances (AEAD, 256-bit) with no performance impact, if they are in the same Region, in the same or a peered VPC, and the traffic does not pass through a virtual appliance (load balancer, transit gateway). |

Additionally: AWS encrypts all traffic between AZs and Regions at the physical layer, and cross-Region VPC peering and TGW peering traffic is encrypted when it leaves the Region.

```bash
# Which instance types support Nitro encryption in transit
aws ec2 describe-instance-types \
  --filters Name=network-info.encryption-in-transit-supported,Values=true \
  --query "InstanceTypes[*].InstanceType" --output text
```

> **On the exam:** "An HPC cluster must encrypt traffic between instances with no performance impact and no application changes" = **Nitro instance types** with encryption in transit support, in the same VPC, with no load balancer in between. "Distributed SageMaker training must encrypt traffic between containers" = **inter-container traffic encryption**.

## 5.2 Data at rest

### KMS vs CloudHSM vs custom key store

| | **AWS KMS** | **KMS + CloudHSM key store** | **KMS + external key store (XKS)** | **AWS CloudHSM** (directly) |
|---|---|---|---|---|
| Who manages the HSM | AWS (multi-tenant, FIPS 140-3 Level 3 validated HSMs) | You (your CloudHSM cluster) | You (an HSM outside AWS) | You (a single-tenant cluster) |
| Integration with AWS services | Full | Full (through KMS) | Full (through KMS) | None directly; the application uses PKCS#11, JCE, OpenSSL |
| Who controls the key | AWS stores the material, you control the policies | The material is in your HSM | The material never enters AWS | Only you (AWS has no access) |
| Typical reason | The default choice | Regulation requires a single-tenant HSM, and you want KMS integration | Regulation requires the key outside the cloud | Your own cryptography, SSL offload, Oracle TDE, asymmetric keys under full control |
| Operational effort | Lowest | Medium | Highest | High |

### Encryption types for S3

| Type | Key | When |
|---|---|---|
| **SSE-S3** | S3 managed keys | The default for all new objects since 2023 |
| **SSE-KMS** | A KMS key (AWS managed `aws/s3` or customer managed) | Access control to the key, audit in CloudTrail, separation of duties |
| **DSSE-KMS** | KMS, two layers of encryption | Regulation that requires dual-layer encryption |
| **SSE-C** | The client sends the key in every request (HTTPS only) | Rarely. Since April 2026 **blocked by default** for new buckets; must be explicitly allowed (`BlockedEncryptionTypes`) |
| **Client-side** | The key stays with the client (AWS Encryption SDK, Amazon S3 Encryption Client, KMS or your own) | Data must not be unencrypted even on the AWS side |

**S3 Bucket Keys**: S3 creates a short-lived bucket-level key from the KMS key, which drastically reduces the number of KMS calls (cost and throttling). Consequence: in CloudTrail the encryption context is the bucket ARN, not the object. Bucket Keys do not work with DSSE-KMS.

Enforcing a specific key for uploads:

```json
{
  "Sid": "DenyWrongKey",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::acme-records/*",
  "Condition": {
    "StringNotEqualsIfExists": {
      "s3:x-amz-server-side-encryption-aws-kms-key-id": "arn:aws:kms:eu-central-1:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab"
    }
  }
}
```

It is simpler to set the bucket's **default encryption** to SSE-KMS with that key; the Deny policy additionally prevents a client from explicitly requesting a different key. An SSE-KMS upload requires `kms:GenerateDataKey`, and a download requires `kms:Decrypt` on the key.

### EBS, RDS, and other services

- **EBS encryption by default** is enabled **per Region** (`aws ec2 enable-ebs-encryption-by-default`); all new EBS volumes and snapshots are encrypted, with a choice of default KMS key.
- An existing unencrypted volume: snapshot → **copy snapshot with encryption** → new volume from the encrypted snapshot.
- **RDS**: encryption is chosen at creation and cannot be disabled. To encrypt an unencrypted database: snapshot → copy with a KMS key → restore. A read replica in the same Region uses the same encryption.
- Sharing an encrypted snapshot with another account requires a **customer managed** key (an AWS managed key cannot be shared) and a permission for that account in the key policy.
- **EFS** and **DynamoDB**, **SQS**, **SNS**: encryption with a KMS key; EFS encryption at rest is chosen when the file system is created.

> **On the exam:** "All new EBS volumes in the account must be encrypted, with the least effort" = **EBS encryption by default** in every Region (plus SCP/Config for control). "Encrypt an existing RDS database" = **snapshot → encrypted copy → restore**; there is no switch on a live instance. "Regulation requires a single-tenant HSM under the company's control, and the data is in S3 and EBS" = **KMS custom key store with CloudHSM**.

### Data integrity

**S3 Versioning**: every change creates a new version, and a delete places a **delete marker**. It protects against accidental overwriting, but not against deliberate deletion of versions.

**MFA Delete**: requires MFA to permanently delete a version or change the versioning state. Only the **root** user can enable it, through the CLI/API.

**S3 Object Lock** (WORM, requires versioning; can also be enabled on an existing bucket):

| | **Governance mode** | **Compliance mode** | **Legal hold** |
|---|---|---|---|
| Who can shorten/remove the protection | A user with `s3:BypassGovernanceRetention` and the `x-amz-bypass-governance-retention` header | **Nobody**, not even root, until the retention expires | A user with `s3:PutObjectLegalHold` |
| Duration | Retention period | Retention period (can only be extended) | No end date, until removed |
| Use | Protection from most users, with exceptions; testing | Regulation (SEC 17a-4, FINRA) | Litigation, investigation |

```bash
aws s3api put-object-lock-configuration --bucket acme-audit \
  --object-lock-configuration '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Years":7}}}'
```

**Glacier Vault Lock**: a policy on a vault of the original (vault-based) Amazon Glacier service. `InitiateVaultLock` starts a 24-hour testing window, and `CompleteVaultLock` makes it immutable. Vault-based Glacier no longer accepts new customers; for new solutions AWS recommends the **S3 Glacier storage classes** in a bucket with **Object Lock**.

**Code signing**:

- **AWS Signer** creates a **signing profile**; a Lambda **code signing configuration** lists the allowed profiles and the action for unsigned or modified code: **Warn** (the deployment goes through, a CloudWatch metric) or **Enforce** (the deployment is rejected). Integrity, expiration, and revocation of the signature are checked.
- A container image is signed with Signer (Notation), and verification is done in the cluster (e.g., an admission controller).

**File validation**:

- **CloudTrail log file integrity validation**: digest files with SHA-256 hashes, signed every hour. `aws cloudtrail validate-logs --trail-arn ... --start-time ...` detects modified or deleted logs.
- **S3 checksums** (CRC32, CRC32C, CRC64NVME, SHA-1, SHA-256) on upload; S3 verifies integrity and stores the checksum with the object.
- **DataSync** verifies data integrity during and after transfer.

> **On the exam:** "Logs must be immutable for 7 years and nobody, including root, may delete them" = **Object Lock compliance mode**. "Protection from deletion, but the security team must be able to delete an object in exceptional cases" = **governance mode**. "Keep objects for the duration of litigation, with no known end date" = **legal hold**. "Prove that CloudTrail logs were not modified" = **log file integrity validation**.

### Lifecycle and retention

**S3 Lifecycle** rules by prefix or tag:

- **Transition** to cheaper classes (Standard-IA, Glacier Instant/Flexible Retrieval, Deep Archive) after N days,
- **Expiration** of current versions, **NoncurrentVersionExpiration** for old versions, deletion of incomplete multipart uploads and redundant delete markers.

Lifecycle cannot delete an object protected by Object Lock before the retention expires. Combination: Object Lock keeps the minimum period, and lifecycle deletes after it.

```json
{
  "Rules": [{
    "ID": "logs-retention",
    "Filter": { "Prefix": "logs/" },
    "Status": "Enabled",
    "Transitions": [{ "Days": 30, "StorageClass": "STANDARD_IA" }, { "Days": 180, "StorageClass": "DEEP_ARCHIVE" }],
    "Expiration": { "Days": 2555 },
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
  }]
}
```

**EFS Lifecycle management**: files that are not used move to the **Infrequent Access** and **Archive** classes after a set number of days, and optionally move back to Standard on first access.

**FSx for Lustre backup**: automatic daily backup with a retention of **0–90 days** (0 disables it) and user-initiated backups that do not expire. Backup is supported only on **persistent** file systems that are **not linked to an S3 data repository**; scratch file systems have no backup. AWS Backup provides longer retention, scheduling, and cross-Region/cross-account copies.

### Backup, replication, and ransomware

**AWS Backup** centralizes backup for EC2, EBS, RDS/Aurora, DynamoDB, EFS, FSx, S3, and other services:

- A **backup plan** (schedule, retention, lifecycle to cold storage) + **resource assignment** by tag.
- A **backup vault** encrypted with a KMS key, with a **vault access policy** (e.g., Deny `backup:DeleteRecoveryPoint`).
- **Cross-Region and cross-account copy** (within the organization) to an isolated backup account.
- **Backup policies** in Organizations to enforce plans centrally.
- **AWS Backup Audit Manager** for compliance reports, **restore testing** for automatic verification of recovery.

**AWS Backup Vault Lock**:

| | Governance | Compliance |
|---|---|---|
| Removing the lock | A user with sufficient IAM permissions | Only during the **grace time** (at least 3 days); after that nobody, not even AWS |
| Deleting a recovery point before expiration | Not allowed, not even for root | Not allowed, not even for root |
| Min/max retention | Optional | Optional |

**Logically air-gapped vault**: a special type of vault, **always locked in compliance mode**, encrypted with an AWS owned or customer managed key, with backups stored in an account managed by AWS Backup. It is shared with other accounts (and other organizations) through **AWS RAM**, so recovery can be done from a clean account; with **multi-party approval**, recovery is possible even when the owning account is unavailable.

**Amazon Data Lifecycle Manager (DLM)**: automatic EBS snapshots and EBS-backed AMIs by tag, retention, **cross-Region copy**, **cross-account sharing**, fast snapshot restore, snapshot archiving. Simpler than AWS Backup when only EBS/AMIs are involved.

**Recycle Bin** retains deleted EBS snapshots and AMIs for a set period (retention rules, which can be locked), so accidental or malicious deletion can be undone.

**AWS DataSync**: online data transfer between on-premises storage (NFS, SMB, HDFS, object storage), other clouds, and AWS (S3, EFS, FSx). An agent, TLS in transit, integrity verification, schedules, an IAM role for S3 access; it can work through a VPC interface endpoint.

### Ransomware protection: layers

1. **Prevent deletion**: Object Lock (compliance), Backup Vault Lock, an SCP that denies `backup:DeleteRecoveryPoint`, `s3:PutBucketVersioning`, and `kms:ScheduleKeyDeletion` except for a break-glass role.
2. **Isolate copies**: cross-account copy to a separate backup account or a logically air-gapped vault, with different administrators.
3. **Keys**: if an attacker schedules deletion of a KMS key, all backups become unreadable. Protect the key policy and monitor `ScheduleKeyDeletion` (EventBridge alarm).
4. **Detection**: GuardDuty (including Malware Protection for S3 and AWS Backup), alarms on mass deletion/encryption.
5. **Test recovery**: restore testing in AWS Backup.

> **On the exam:** "Backups must survive a compromise of the production account, including root access by the attacker" = **cross-account copy to a backup account with Vault Lock in compliance mode** or a **logically air-gapped vault**. Versioning alone or a backup in the same account is not enough.

## Summary

- You enforce TLS with the **security policy** on the ALB/NLB listener, the viewer/origin protocol policy on **CloudFront** (ACM certificate in us-east-1), and an **`aws:SecureTransport`** Deny in the bucket policy.
- **Gateway endpoint** (S3, DynamoDB, free, does not work from on-premises) vs **interface endpoint** (PrivateLink, ENI, SG, works from on-premises); an **endpoint policy** + **`aws:SourceVpce`** close the perimeter.
- **Client VPN** = network access; **Verified Access** = zero trust per-request application access (identity + device, Cedar), without a VPN.
- Inter-node: **EMR security configuration**, **EKS envelope encryption** (default on 1.28+) + mTLS/WireGuard for pod-to-pod, **SageMaker inter-container encryption**, **Nitro** automatic encryption between supported instances.
- **KMS** is the default choice; **CloudHSM** (or a KMS custom key store) for single-tenant control; **XKS** for a key outside AWS. S3: SSE-S3, SSE-KMS (+ Bucket Keys), DSSE-KMS, SSE-C (blocked by default), client-side.
- Integrity: **Object Lock** (governance / compliance / legal hold), **Glacier Vault Lock**, **MFA Delete**, **Lambda code signing** (Warn/Enforce), **CloudTrail log validation**.
- Retention and backup: **S3 Lifecycle**, **EFS Lifecycle**, **FSx for Lustre** backup (persistent, 0–90 days), **AWS Backup** with **Vault Lock**, cross-account copies, and a **logically air-gapped vault**, **DLM** for EBS, **DataSync** for secure transfer.
