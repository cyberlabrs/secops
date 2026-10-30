## Exam objective: 5.3

This module covers task **5.3** of domain 5 (**Data Protection**, 18% of the exam): designing and implementing controls that protect confidential data, credentials, secrets, and cryptographic key material. Skills the exam tests:

- **5.3.1** managing secrets and rotating them (AWS Secrets Manager),
- **5.3.2** working with imported key material and an external key store,
- **5.3.3** the differences between imported and AWS-generated key material,
- **5.3.4** masking sensitive data (CloudWatch Logs data protection policies, SNS message data protection),
- **5.3.5** creating and managing keys and certificates in one or more Regions (customer managed KMS keys, AWS Private CA).

A typical question looks like this: "A company must rotate a database password every 30 days without interrupting the application" or "a regulator requires the key to be generated outside AWS and the company to be able to make it unusable immediately". The key is to recognize **which service** and **which option** of that service the question is actually asking for, and to pick the solution with the least custom code.

## 5.3.1 AWS Secrets Manager

**AWS Secrets Manager** stores secrets (database passwords, API keys, OAuth tokens) encrypted with a KMS key and offers **built-in rotation**, versioning, a resource policy, and replication to other Regions. The application retrieves the secret at runtime (`GetSecretValue`) instead of keeping it in code, an environment variable, or Terraform state.

```bash
aws secretsmanager create-secret --name prod/orders/db \
  --kms-key-id alias/secrets-prod \
  --secret-string '{"username":"orders_app","password":"...","host":"orders.cluster-x.eu-central-1.rds.amazonaws.com"}'

aws secretsmanager get-secret-value --secret-id prod/orders/db --query SecretString
```

### Versions and staging labels

Every secret has multiple versions, and labels say which is which:

| Label | Meaning |
|---|---|
| `AWSCURRENT` | The current value; this is what `GetSecretValue` returns without additional parameters. |
| `AWSPENDING` | The new value during rotation, not yet confirmed. |
| `AWSPREVIOUS` | The previous value; useful for rollback and for clients that still hold an old cache. |

### Rotation: Lambda function or managed rotation

**Rotation by Lambda function**: Secrets Manager invokes a Lambda function in four steps: `createSecret` (generate a new value as `AWSPENDING`), `setSecret` (set it in the database or service), `testSecret` (verify it works), `finishSecret` (move `AWSCURRENT` to the new version). AWS provides ready-made function templates for RDS, Aurora, Redshift, DocumentDB, and others; for an arbitrary API key you write your own function.

The rotation Lambda must have **network access** to both the database and the Secrets Manager API. If it is in a private subnet without NAT, it needs an **interface VPC endpoint** for Secrets Manager. This is a common cause of a "rotation failed" error in questions.

**Managed rotation**: some services manage the secret and its rotation themselves, without a Lambda function that you maintain. Examples: the master password for **Amazon RDS** and **Aurora** (`--manage-master-user-password`), the Amazon Redshift admin password, the Amazon DocumentDB master user.

```bash
aws rds modify-db-instance --db-instance-identifier orders \
  --manage-master-user-password \
  --master-user-secret-kms-key-id alias/secrets-prod --apply-immediately
```

The rotation schedule is set as a number of days or a `rate()`/`cron()` expression; the most frequent possible rotation is every four hours.

### Single user vs alternating users

| Strategy | How it works | When |
|---|---|---|
| **Single user** | The password of the same database user is changed. | Simple; a short window in which a client's old cache does not work. Good for applications with retry logic. |
| **Alternating users** | There are two users with the same rights (e.g., `app` and `app_clone`); rotation changes the password of the inactive one and then makes it current. | High availability: the previous credentials keep working until the next rotation. Requires a **separate superuser secret** with the right to modify users. |

> **On the exam:** "rotate the password without any interruption of connections" or "the application caches credentials" = **alternating users**. "Rotate the RDS master password with the LEAST operational overhead" = **managed rotation** (RDS manages the secret in Secrets Manager), not your own Lambda function. If rotation fails and the Lambda function is in a private subnet, the answer is a VPC endpoint or NAT, not a longer timeout.

### Resource policy and cross-account access

Accessing a secret from another account requires **three** things:

1. A **resource policy** on the secret that allows the principal from account B (`secretsmanager:GetSecretValue`).
2. An **identity policy** in account B that allows the same call on the secret's ARN.
3. The secret must be encrypted with a **customer managed KMS key** whose key policy allows account B `kms:Decrypt`. A secret encrypted with the AWS managed key `aws/secretsmanager` **cannot** be used cross-account, because you cannot change its key policy.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::222222222222:role/orders-app"},
    "Action": "secretsmanager:GetSecretValue",
    "Resource": "*"
  }]
}
```

A resource policy can be checked before saving: `aws secretsmanager validate-resource-policy`, and the `--block-public-policy` option rejects a policy that would open the secret broadly.

### Replication to other Regions

Secrets Manager can **replicate a secret** to other Regions (`replicate-secret-to-regions`). The replica has the same name, the value is synchronized from the primary, and rotation is configured only on the primary. Each replica is encrypted with a KMS key from its own Region (you can specify a key per Region). Used for DR and multi-Region applications.

### Parameter Store SecureString

**AWS Systems Manager Parameter Store** stores configuration; the **SecureString** type encrypts the value with a KMS key.

| | Secrets Manager | Parameter Store SecureString |
|---|---|---|
| Built-in rotation | Yes (Lambda or managed) | No; you build rotation yourself |
| Resource policy on the secret | Yes | No (access via IAM; advanced parameters can be shared through RAM) |
| Replication to Regions | Yes | No |
| Random password generation | Yes (`get-random-password`) | No |
| Hierarchy and configuration | Limited | Excellent (`/app/prod/...`, `GetParametersByPath`) |
| Price | Charged per secret and per API call | Standard tier has no separate storage charge |

> **On the exam:** if the question asks for **automatic rotation**, **cross-account** access, or **replication**, the answer is Secrets Manager. If it asks for "the cheapest storage of configuration and a few encrypted values without rotation", the answer is Parameter Store SecureString.

## 5.3.5 AWS KMS: key types and access control

### Who owns the key

| Type | Who manages it | Key policy | Rotation | Visible in the account |
|---|---|---|---|---|
| **Customer managed key** | You | You write it | Optional automatic (period 90–2560 days, default 365) and on-demand | Yes, you pay for it |
| **AWS managed key** (`aws/s3`, `aws/ebs`…) | An AWS service on your behalf | You cannot change it | Automatically every year | Yes |
| **AWS owned key** | An AWS service, shared across accounts | You do not see it | Determined by the service | No |

You choose a customer managed key when you need: control over the key policy (e.g., cross-account), your own rotation schedule, the ability to disable or delete the key, imported material, or a custom key store.

### Key policy, IAM policies, and grants

Every KMS key **must** have a key policy. IAM policies for KMS work **only if the key policy allows it**, usually with a statement granting access to the account's root principal:

```json
{
  "Sid": "EnableIAMPolicies",
  "Effect": "Allow",
  "Principal": {"AWS": "arn:aws:iam::111111111111:root"},
  "Action": "kms:*",
  "Resource": "*"
}
```

Without that statement, not even the account administrator can use the key through an IAM policy. Access then comes only from principals explicitly named in the key policy.

**Grants** are a temporary, programmatic delegation of rights on a key (e.g., EBS gives EC2 the right to decrypt a volume while it is attached). They are created with `CreateGrant`, withdrawn with `RetireGrant`/`RevokeGrant`, and do not change the key policy. They are good for short-lived, narrow rights granted by services.

Cross-account use of a key: the key policy in account A allows account B, **and** an IAM policy in account B allows the principal that key. Both must say "yes".

### Conditions: encryption context and kms:ViaService

An **encryption context** is a set of key-value pairs that is cryptographically bound to the ciphertext (as AAD): the same context must be sent to decrypt. It is not encrypted and is visible in the CloudTrail log, so do not put secrets in it. It is useful for policy conditions:

```json
{
  "Effect": "Allow",
  "Principal": {"AWS": "arn:aws:iam::111111111111:role/orders-app"},
  "Action": "kms:Decrypt",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "secretsmanager.eu-central-1.amazonaws.com",
      "kms:EncryptionContext:SecretARN": "arn:aws:secretsmanager:eu-central-1:111111111111:secret:prod/orders/db-AbCdEf"
    }
  }
}
```

This statement in the key policy allows the role to decrypt **only** through Secrets Manager and **only** for one secret (Secrets Manager sends the secret's ARN as the encryption context).

**`kms:ViaService`** restricts use of the key to requests that a specific AWS service sends on the principal's behalf. That way a role can decrypt S3 objects but cannot call `kms:Decrypt` directly from the CLI on the same key.

> **On the exam:** "the key may be used only by RDS, not by users directly" = `kms:ViaService`. "One tenant's ciphertext must not be decryptable in the context of another" = an **encryption context** condition. "Give EC2/Auto Scaling temporary rights to the key" = a **grant**. An AWS managed key is never the answer when you need cross-account access or a custom key policy.

### KMS key rotation

- **Automatic rotation**: only for symmetric customer managed keys with material generated by KMS (origin `AWS_KMS`). The key ID and ARN stay the same; the old material is kept forever so old ciphertext can be decrypted. Data is **not** re-encrypted.
- **On-demand rotation** (`rotate-key-on-demand`): rotates the material immediately, independent of the automatic schedule. Works for symmetric keys with `AWS_KMS` and with `EXTERNAL` (imported) material. The number of on-demand rotations per key is limited.
- **Manual rotation**: you create a new key and move the **alias** to it. The only option for asymmetric and HMAC keys and keys in a custom key store.

```bash
aws kms enable-key-rotation --key-id alias/app-data --rotation-period-in-days 180
aws kms rotate-key-on-demand --key-id alias/app-data
aws kms list-key-rotations --key-id alias/app-data
```

### Key deletion and the waiting period

A key is not deleted immediately: `ScheduleKeyDeletion` introduces a **waiting period of 7 to 30 days** (default 30). During that period the key is in the *Pending deletion* state, cannot be used, and the deletion can be canceled. After deletion, all data encrypted with it is permanently inaccessible. Good practice: first **disable** the key, watch CloudTrail and a CloudWatch alarm on attempted use (errors due to the key state), and only then schedule deletion. Keep the `kms:ScheduleKeyDeletion` permission narrow and protect it with an SCP.

### Multi-Region keys

A **multi-Region key** is a set of related keys in different Regions with the **same key ID (prefix `mrk-`) and the same material**. Ciphertext from one Region can be decrypted in another without a call to the other Region. There is one **primary** and one or more **replica** keys; each has **its own key policy**, grants, and alias. Rotation is enabled on the primary and propagates to the replicas.

Use them for: global DynamoDB tables with client-side encryption, DR where encrypted data is copied between Regions, signatures that are verified in multiple Regions. Do not use them "just in case": data residency regulations often require the key to stay in one Region.

> **On the exam:** "data encrypted in us-east-1 must be decryptable in eu-west-1 even after the loss of the primary Region, without re-encryption" = a **multi-Region key** (replica). A single-Region key cannot be copied to another Region.

## 5.3.2 and 5.3.3 Imported key material (BYOK)

With **imported key material** you create a KMS key without material (`--origin EXTERNAL`), download a public wrapping key and an import token, encrypt your material, and import it.

```bash
aws kms create-key --origin EXTERNAL --description "BYOK payments"
aws kms get-parameters-for-import --key-id <id> \
  --wrapping-algorithm RSAES_OAEP_SHA_256 --wrapping-key-spec RSA_4096
# the material is encrypted locally with the public wrapping key (e.g., openssl)
aws kms import-key-material --key-id <id> \
  --encrypted-key-material fileb://material.enc --import-token fileb://token.bin \
  --expiration-model KEY_MATERIAL_EXPIRES --valid-to 2027-06-30T00:00:00Z
```

### Differences from AWS-generated material

| Property | AWS-generated (`AWS_KMS`) | Imported (`EXTERNAL`) |
|---|---|---|
| Who generates the material | KMS in its HSMs | You, in your own system (e.g., an on-premises HSM) |
| Durability | AWS's responsibility | **You** keep the original; KMS has a copy |
| Expiry | None | You can set an expiration date (`KEY_MATERIAL_EXPIRES`) |
| Immediate removal | Only disable, or deletion with a 7–30 day wait | `DeleteImportedKeyMaterial` immediately; the key goes to *Pending import* |
| Restoring | Not possible (after the key is deleted) | Re-importing the **same** material puts the key back into use |
| Automatic rotation | Yes | **No**; only on-demand after importing new material, or manual (new key + alias) |
| Custom key store | Possible | Not supported |
| Key types | All | Symmetric, asymmetric, HMAC, multi-Region |

When the material expires or you delete it, the key cannot be used, but resources that have already cached a **data key** (e.g., an attached EBS volume) can keep working until the key is requested again. There is a CloudWatch metric for expiration, so it is easy to set an alarm before expiry.

> **On the exam:** "the key must be generated in our on-premises HSM, and the company must be able to make the key unusable **immediately** and restore it later" = **imported key material** + `DeleteImportedKeyMaterial`. "Key material must **never** be in AWS, and operations are performed outside AWS" = **external key store (XKS)**. Do not confuse BYOK (a copy of the material is in KMS) with HYOK (the material stays with you).

## Custom key stores: CloudHSM and XKS

| | Standard KMS | **AWS CloudHSM key store** | **External key store (XKS)** |
|---|---|---|---|
| Where the material is | KMS HSMs (FIPS 140-3 Level 3) | Your CloudHSM cluster in a VPC (single-tenant) | Your external key manager outside AWS |
| Who maintains availability | AWS | You (the cluster must have at least two active HSMs in different AZs) | You (proxy, network, key manager) |
| Connection to KMS | Internal | KMS uses the `kmsuser` crypto user in the cluster | KMS calls your **XKS proxy** (a public endpoint or a VPC endpoint service) |
| Key types | All | Symmetric only | Symmetric only |
| Automatic rotation, imported material, multi-Region | Yes | No | No |
| Typical reason | Most cases | A requirement for a single-tenant HSM under your control | Regulation: the key must stay outside AWS (HYOK, data sovereignty) |

XKS uses **double encryption**: KMS first encrypts with its own key material, then your external key encrypts the result. If you shut down the proxy or the key manager, AWS loses access to all data protected by that key (except briefly cached data keys). It is a powerful control, but also a risk to availability and latency.

You choose direct **AWS CloudHSM** (without KMS) when the application needs standard interfaces (PKCS#11, JCE, OpenSSL), e.g., for TLS offload or signing, and when integration with AWS services is not needed.

> **On the exam:** "AWS services (S3, EBS, RDS) must use the key, but the material must be in a single-tenant HSM that we manage" = **CloudHSM key store**. CloudHSM alone (without KMS) does not work with SSE-KMS in S3 and EBS.

## 5.3.4 Masking sensitive data

### CloudWatch Logs data protection policies

A **data protection policy** in CloudWatch Logs looks for sensitive data in log events **at ingestion** and masks it on all outputs (console, Logs Insights, metric and subscription filters). It can be set at the **account level** (applies to all existing and future log groups) and on an individual log group; if both exist, both apply.

- **Managed data identifiers**: ready-made patterns for credentials (AWS secret key, private key), financial data (card numbers), PII, PHI, and device identifiers (IP, MAC).
- **Custom data identifiers**: your own regex, e.g., an internal customer number.
- **Audit**: findings are sent to another log group, S3, or Firehose; the `LogEventsWithFindings` metric enables an alarm.
- Only a principal with the **`logs:Unmask`** permission sees unmasked data.
- Data ingested **before** the policy was enabled is not masked retroactively.

```json
{
  "Name": "mask-pii",
  "Version": "2021-06-01",
  "Statement": [
    {"Sid": "audit", "DataIdentifier": ["arn:aws:dataprotection::aws:data-identifier/EmailAddress",
       "arn:aws:dataprotection::aws:data-identifier/CreditCardNumber"],
     "Operation": {"Audit": {"FindingsDestination": {"S3": {"Bucket": "log-findings-111111111111"}}}}},
    {"Sid": "mask", "DataIdentifier": ["arn:aws:dataprotection::aws:data-identifier/EmailAddress",
       "arn:aws:dataprotection::aws:data-identifier/CreditCardNumber"],
     "Operation": {"Deidentify": {"MaskConfig": {}}}}
  ]
}
```

```bash
aws logs put-data-protection-policy --log-group-identifier /app/payments \
  --policy-document file://mask-pii.json
```

### Amazon SNS message data protection

**SNS message data protection** applies a policy to messages passing through a topic: **Audit** (report findings), **De-identify** (mask or remove sensitive parts), and **Deny** (block publishing or delivery). Rules are defined per direction: **inbound** (from the publisher) and **outbound** (to individual subscribers), so one subscriber can get the full message and another a masked one.

Availability note: AWS announced that from April 30, 2026, SNS message data protection is not available to **new** customers; existing customers can still use it. As an alternative, AWS suggests a Lambda function subscribed to the topic that inspects messages (e.g., with Amazon Bedrock Guardrails) and publishes a cleaned message to another topic. The exam still lists it as an example, so know what it does.

> **On the exam:** "developers must see the logs, but card numbers must not be visible; only the security team may see the original" = **CloudWatch Logs data protection policy** + `logs:Unmask` only for the security role. Macie is not the answer: it scans S3 and does not mask logs in flight.

## 5.3.5 Certificates: ACM and AWS Private CA

### AWS Certificate Manager (ACM)

- **Public certificates** are free, for integrated services (ELB, CloudFront, API Gateway…). Validation via **DNS** (a CNAME record) or email. With DNS validation, ACM **renews the certificate automatically** as long as the CNAME exists and the certificate is in use.
- **Imported certificates** (from an external CA) are **not** renewed automatically; ACM sends events about upcoming expiration to EventBridge (and AWS Config has the rule `acm-certificate-expiration-check`).
- **Private certificates** are issued from AWS Private CA through ACM and can be exported for use on EC2, on-premises, and in containers.
- Certificates are **regional**. CloudFront uses only a certificate from **us-east-1**; for an ALB in multiple Regions you request a certificate in each Region.

### AWS Private CA

**AWS Private Certificate Authority** is a managed private CA for internal services, mTLS, IoT devices, IAM Roles Anywhere, and similar uses.

- **Hierarchy**: root CA (ideally without directly issuing end-entity certificates, or even outside AWS) → subordinate CA → end-entity certificates. The root is used rarely; a subordinate is easier to revoke and replace.
- **Revocation**: a CRL in an S3 bucket or OCSP.
- **Short-lived certificate mode**: the CA issues only certificates valid for up to **7 days**, it is cheaper than a general-purpose CA, and the short validity replaces the need for revocation. ACM cannot issue certificates from such a CA.
- **Cross-account sharing**: the CA is shared through **AWS RAM** (Resource Access Manager) with other accounts or the entire organization, so application accounts issue certificates from a central CA without copying the CA into every account.
- Access to issuance is controlled by IAM policies (`acm-pca:IssueCertificate`) and a resource policy on the CA; CloudTrail records every issuance.

```bash
aws ram create-resource-share --name shared-issuing-ca \
  --resource-arns arn:aws:acm-pca:eu-central-1:111111111111:certificate-authority/abcd-1234 \
  --principals arn:aws:organizations::111111111111:ou/o-abc123/ou-prod-xyz
```

> **On the exam:** "internal services in 40 accounts need private TLS certificates from one central CA with the LEAST operational overhead" = **AWS Private CA in the security account + sharing through RAM** and issuance through ACM (automatic renewal). "Certificates for short-lived containers, without CRL/OCSP infrastructure" = **short-lived certificate mode**. "CloudFront does not see a certificate from eu-west-1" = the certificate must be in **us-east-1**.

## Summary

- **Secrets Manager** is the choice when you need rotation, cross-account access, or replication; **managed rotation** for RDS/Aurora/Redshift/DocumentDB is the least effort, and **alternating users** gives rotation without interruption.
- A cross-account secret requires a resource policy, an IAM policy in the other account, and a **customer managed** KMS key.
- The KMS key policy is the foundation; IAM policies work only if the key policy enables them; **grants** are temporary delegation; `kms:ViaService` and the **encryption context** narrow usage.
- Automatic rotation only for symmetric `AWS_KMS` keys; on-demand also for imported; everything else manually via an alias. Key deletion has a **7–30 day** waiting period.
- **Imported material**: you keep the original, can set an expiration and delete it immediately (*Pending import*), then re-import the same material; there is no automatic rotation.
- **CloudHSM key store** = a single-tenant HSM under your control; **XKS** = the material stays outside AWS (HYOK, double encryption), at your own risk to availability.
- **CloudWatch Logs data protection** masks PII at ingestion, and only `logs:Unmask` sees the original; SNS data protection does audit/de-identify/deny per message direction.
- ACM certificates are regional (CloudFront = us-east-1); you share **Private CA** through **RAM**, and short-lived mode provides certificates of up to 7 days without revocation.
