## Exam objectives: 2.7, 2.8, and 2.9

This module completes Domain 2 (**Cloud Data Security**, 20%). It covers the end of the data lifecycle, the ability to prove what happens to data, and a new topic from the 2026 outline, the protection of AI/ML data:

- **2.7 Plan and implement data retention, deletion and archiving policies**
  - data retention policies,
  - data deletion procedures and mechanisms,
  - data archiving procedures and mechanisms,
  - legal hold (authorized access, deletion prevention).
- **2.8 Design and implement auditability, traceability and accountability of data events**
  - definition of event sources and requirement of event attributes (identity, IP address, geolocation),
  - logging, storage, and analysis of data events,
  - chain of custody and non-repudiation.
- **2.9 Comprehend data protection of Artificial Intelligence (AI) and Machine Learning (ML) data**
  - data set and model privacy,
  - data set and model security (validation, verification).

In the **Create – Store – Use – Share – Archive – Destroy** lifecycle, objective 2.7 covers the **Archive** and **Destroy** phases, objective 2.8 spans all phases (every phase produces events), and 2.9 applies the same principles to training data and to the models themselves.

## Retention policies (2.7)

A **data retention policy** determines how long each category of data is kept, in what form, and what is done when the period expires. Retention is a compromise between two opposing pressures:

- **keep it long enough**: legal and contractual obligations, business needs, defense in disputes,
- **do not keep it longer than necessary**: the GDPR principle of **storage limitation**, cost, the risk of leakage, and the scope of eDiscovery (everything you have, you must hand over).

Elements of a retention policy according to ISC2:

| Element | What it defines |
|---|---|
| **Retention periods** | The retention period per data category (from classification and regulation). |
| **Data formats** | The format in which data is kept so that it remains readable for the entire period. |
| **Data security** | Which controls apply during retention (encryption, access). |
| **Data retrieval procedures** | How and how quickly data can be retrieved (e.g., for a court or regulator). |
| **Data classification** | The link between classification levels and periods. |
| **Applicable regulations** | Which laws and standards determine the period. |
| **Monitoring, maintenance and enforcement** | Who verifies that the policy is enforced, and how. |

Examples of regulatory periods worth knowing (the exam rarely asks for specific numbers, but it does require understanding that regulation determines the period):

| Regulation | Example requirement |
|---|---|
| **PCI DSS v4.0** | Audit logs are retained for at least 12 months, with the last 3 months immediately available for analysis. |
| **HIPAA** | Documentation of security policies and procedures is retained for 6 years. |
| **SOX / SEC** | Audit workpapers and related documentation are retained for 7 years. |
| **GDPR** | No fixed period: personal data is kept only as long as necessary for the purpose (storage limitation). |
| National regulations | Accounting and tax documentation has legally prescribed periods. |

When periods overlap, the **longest applicable period** applies, unless a privacy law requires deletion; in that case, the legal department decides and documents the basis.

> **On the exam:** the retention period is not determined by IT or the cloud provider, but by **regulation, contracts, and business needs** through a policy approved by management, with the participation of the legal department and data owners. If an answer says "keep everything forever just in case", it is wrong: it increases risk and violates storage limitation.

### Retention in the cloud

The cloud makes automation easier: **lifecycle policies** (in AWS S3 Lifecycle, in Azure Blob lifecycle management) move data to cheaper classes and delete it when the period expires; **retention policies** in SaaS (e.g., Microsoft Purview retention) retain and delete email and documents. But the customer must know:

- how long the **provider** keeps backup copies and logs after deletion,
- what happens to data upon **contract termination** (export deadline, confirmation of deletion),
- in which regions the copies are located.

This is addressed through the **contract** (clauses on data retention, return, and deletion), because the customer cannot physically inspect the provider's media.

Contract clauses concerning retention and deletion:

| Clause | What it should define |
|---|---|
| Retention by the provider | How long the provider keeps the customer's data, backups, and logs |
| Data return | Format, deadline, and method of exporting data upon termination |
| Deletion upon termination | The deadline for deleting all copies, including backups, and the method |
| Proof of deletion | A confirmation or certificate, or coverage in audit reports |
| Legal hold and eDiscovery | The provider's ability to preserve data and cooperate in proceedings |
| Subprocessors | Whether and where subprocessors hold copies and how they delete them |

Retention by service model:

| Model | Who technically enforces retention | Note |
|---|---|---|
| IaaS | Customer (lifecycle policies, backup software) | The customer controls snapshots and replicas as well |
| PaaS | Mostly the customer through service settings | Automatic database backups have their own periods that need to be configured |
| SaaS | Provider, through the options it exposes | If the SaaS does not offer long enough retention, export or a third-party backup is required |

## Data deletion (2.7)

Deletion in the cloud is difficult because the customer has no access to physical media, data is replicated, and storage is shared with other tenants. The term **data remanence** refers to residual data that remains after an attempt to delete it.

**NIST SP 800-88 Rev. 2** (Guidelines for Media Sanitization, September 2025, which replaced Rev. 1 from 2014) defines three levels of sanitization and explicitly includes virtual/logical storage such as the cloud:

| Method | Description | Example | Possible in the cloud for the customer? |
|---|---|---|---|
| **Clear** | Logical techniques on user-addressable space; protects against simple recovery | Overwriting, factory reset | Partially (overwriting volumes), unreliable due to virtualization |
| **Purge** | Techniques that also protect against laboratory recovery | **Cryptographic erase**, block erase, degaussing | Yes, through **crypto-shredding** |
| **Destroy** | The medium becomes unusable | Shredding, incineration, melting, disintegration | No, the provider does this |

Methods that ISC2 traditionally lists:

| Method | Note |
|---|---|
| **Overwriting** | Overwriting with zeros or random data; on SSDs and in the cloud it does not guarantee that all blocks are overwritten. |
| **Degaussing** | A strong magnetic field; works only on magnetic media (HDDs, tapes), not on SSDs; unavailable to the customer in the cloud. |
| **Physical destruction** | The most secure, but only for the provider or on-prem equipment. |
| **Cryptographic erasure (crypto-shredding)** | Data is encrypted, and all keys are deleted; the remaining ciphertext is unusable. |

### Crypto-shredding

**Crypto-shredding** is the only practical way for a cloud customer to achieve purge-level sanitization. Prerequisites:

1. data is **encrypted from the start** (including backups, snapshots, and replicas),
2. the key is under the customer's control (customer-managed key, BYOK/HYOK, HSM),
3. **all copies of the key** are destroyed, including key backups and escrow,
4. the destruction is documented.

In AWS this corresponds to deleting a KMS key (`ScheduleKeyDeletion` with a waiting period of 7–30 days); all data encrypted with that key becomes unreadable. This is also why key deletion is a dangerous operation: a key deleted by mistake means permanent data loss.

> **On the exam:** "What is the BEST method for a cloud customer to ensure that data cannot be recovered after leaving a provider?" The answer is **crypto-shredding**. Degaussing and physical destruction are not available to the customer, and overwriting is not reliable in virtualized and replicated storage.

### Deletion procedure

A good deletion procedure includes:

- triggers: retention expiry, a data subject request (GDPR **right to erasure**), contract termination, system decommissioning,
- a check that the data **is not under legal hold** before deletion,
- a list of all locations (primary storage, replicas, backups, logs, caches, data lakes, copies in test environments),
- the method according to classification,
- **verification** and **documentation** (certificate of destruction / sanitization record),
- from the provider: a contractual obligation and evidence of media sanitization (covered through SOC 2 and ISO/IEC 27001 reports, because the customer cannot audit physical disks).

A sanitization record typically contains: a description of the media or resource, the data category, the method (clear, purge, destroy), the tool, the date, the person performing it, the verification result, and a signature. In the cloud, this can be a key destruction record with the key identifier and a list of the resources it protected.

## Archiving (2.7)

**Data archiving** is moving data that is no longer actively used, but must be retained, to long-term and cheaper storage. An archive is not a backup:

| Attribute | Backup | Archive |
|---|---|---|
| Purpose | Recovery after loss or failure | Long-term retention for legal, business, historical reasons |
| Content | A copy of active data | Original data removed from active use |
| Period | Short to medium (days, weeks) | Long (years, decades) |
| Access | Fast restore | Rare, may take hours |
| Relation to BC/DR | Direct (RPO/RTO) | Indirect |

Elements of the archiving procedure:

- **Encryption and key management**: keys must be retained as long as the archive. A lost key = a lost archive; key rotation must not make old archives unreadable.
- **Data format**: will software that reads the format exist in 10 years? Prefer open formats and periodic migration.
- **Media and technology**: tapes, cold storage classes (S3 Glacier Deep Archive, Azure Archive tier); retrieval time is measured in hours.
- **Location**: the jurisdiction of the archive, geographic distance from the primary location.
- **Integrity and immutability**: **WORM** (write once, read many), in the cloud S3 Object Lock or Azure immutable blob storage.
- **Restore procedures and testing**: an archive that has not been tested is not an archive.
- **Indexing and search**: so that data can be found for eDiscovery.

> **On the exam:** for long-term encrypted archives, the MOST important risk is **loss of keys or an unreadable format**, not storage speed. An answer that ensures long-term key retention and a tested restore is better than an answer about a cheaper storage class.

## Legal hold (2.7)

**Legal hold** (litigation hold) is the obligation to preserve all data relevant to a lawsuit, investigation, or regulatory proceeding, **from the moment the dispute is reasonably anticipated**, not only when the lawsuit arrives. Legal hold **suspends regular retention and deletion** for the data in scope.

Key requirements from the outline:

| Requirement | Implementation |
|---|---|
| **Deletion prevention** | Automatic deletion (lifecycle, retention policies) must not delete data under hold; users must not modify or delete it. In the cloud: S3 Object Lock legal hold, M365 litigation hold, eDiscovery hold. |
| **Authorized access** | Only authorized persons (legal department, eDiscovery team) have access to data under hold, with logging. |
| Scope | Identification of data custodians, systems, time period, data types. |
| Notification | Written notice to employees who hold relevant data. |
| Release | The hold is formally released when the legal department decides; only then does regular retention resume. |

The role of the cloud provider: the customer must know whether the provider can technically preserve data (including metadata), in what format it can hand it over, and within what timeframe. This is defined in the contract. **eDiscovery** (identification, preservation, collection, processing, review, and production of electronic evidence; see **ISO/IEC 27050** and the EDRM model) is covered in more detail in Domains 5 and 6.

> **On the exam:** if a legal hold and a retention policy conflict, **the legal hold takes precedence**. Deleting data under hold (even automatically, by policy) is **spoliation** of evidence and can have serious legal consequences.

## Event sources and attributes (2.8)

**Auditability** is the ability to determine afterwards what happened, **traceability** is the ability to follow an action through systems back to its source, and **accountability** is the ability to tie an action to a specific responsible subject. All three require well-defined events.

### Event sources by service model

| Model | What the customer can log | What depends on the provider |
|---|---|---|
| **IaaS** | OS, applications, databases, network flow logs, control plane API calls | Hypervisor, physical network, data center |
| **PaaS** | Application logs, data access, API calls | OS, runtime, platform components |
| **SaaS** | Whatever the provider exposes: user and administrator audit logs | Almost everything; visibility is the lowest |

That is why **log availability and granularity** are an important criterion when choosing a provider and an item in the contract (log types, retention, format, export API).

Typical sources of data events: control plane audit logs (AWS CloudTrail, Azure Activity Log), data access logs (CloudTrail data events, S3 server access logs, database audit), IdP sign-in logs, DLP and CASB events, the IRM audit trail, application logs.

### Required event attributes

The OWASP Logging Cheat Sheet provides a practical framework: **when, where, who, what**.

| Category | Attributes |
|---|---|
| **When** | Timestamp in UTC with time zone, synchronized (NTP); event time and log write time |
| **Where** | Application, service, host, region, URL or API endpoint, **geolocation** |
| **Who** | **User identity** or service identity (including an assumed role), **source IP address**, device, session ID |
| **What** | Event type, action, object (which data), result (success/failure), severity, reason |

Geolocation from an IP address is useful for detecting impossible travel and violations of location requirements, but it is approximate (VPN, proxy, NAT, cloud egress addresses). An IP address by itself is not an identity: behind NAT or a load balancer you see the address of a device along the path, so you should also log `X-Forwarded-For` or an equivalent.

What **not to log**: passwords, session tokens, keys, full card numbers, unnecessary personal data. Logs are themselves sensitive data and are subject to classification, retention, and GDPR.

> **On the exam:** the requirement "we must prove WHO accessed the data" calls for **unique identities** (no shared accounts) and logs with the identity, time, and object. A shared administrator account destroys accountability no matter how many logs there are.

## Logging, storage, and analysis (2.8)

| Phase | Good practice |
|---|---|
| **Collection** | Centralization from all sources and accounts; standardized format; synchronized time. |
| **Transmission** | Encrypted (TLS), with delivery confirmation. |
| **Storage** | A separate account or project for logs (log archive), restricted access, encryption, **immutability** (WORM, Object Lock), **integrity** (hash chains, digital signatures; e.g., CloudTrail log file validation). |
| **Retention** | According to regulation (e.g., PCI DSS 12 months); hot and cold tiers. |
| **Analysis** | **SIEM** for normalization, correlation, and alerting; UEBA for anomalies; SOAR for automated response. |
| **Access** | Separated from the administrators of the systems being logged (separation of duties), so that an administrator cannot erase their tracks. |

Typical detection use cases over data events:

| Case | Signal in the logs |
|---|---|
| Mass download | An unusually large number of GetObject calls/reads by a single identity in a short time |
| Permission change | A bucket or shared folder became public, new external shares |
| Logging disabled | A trail stopped, a log group deleted, retention changed |
| Key deletion | Scheduled deletion or disabling of an encryption key |
| Access from an unexpected location | Geolocation outside allowed countries, impossible travel |
| Privileged data access | An administrator reads business data outside working hours or without a ticket |

An event that disables or modifies logging is itself high-risk and should trigger an alert, because attackers often remove their tracks first.

Challenges in the cloud: different formats between providers, ingestion cost, log delivery latency, logs in multiple regions, limited visibility in SaaS, and the fact that the provider controls part of the infrastructure.

## Chain of custody and non-repudiation (2.8)

**Chain of custody** is a documented, unbroken record of who collected the evidence, when, how, who stored, transferred, and analyzed it, and that the evidence has not been altered. Without it, the evidence may be inadmissible in court. Guidelines for the identification, collection, acquisition, and preservation of digital evidence are provided by **ISO/IEC 27037**.

Elements of chain of custody:

- unique identification of the evidence,
- who collected it, when, where, and using which method,
- a **hash value** (e.g., SHA-256) at collection and at every handover,
- every change of custodian documented and signed,
- secure storage (physically and logically controlled access),
- working on copies, with the original left intact.

In the cloud this is harder: the customer often cannot physically collect the media; disk snapshots, memory, and logs are collected through APIs, and part of the evidence is held only by the provider. That is why the contract should define **provider cooperation in investigations** and the method of handing over evidence.

**Non-repudiation** means that a subject cannot credibly deny having performed an action. It is achieved through a combination of:

| Mechanism | Contribution |
|---|---|
| **Digital signature** (private key held only by the subject) | Proves origin and integrity |
| **Strong authentication** (MFA, unique accounts) | Ties the action to a person |
| **Trusted timestamping** | Proves when |
| **Protected, immutable logs** | Evidence cannot be altered afterwards |
| **Hashing** | Integrity, but by itself does not prove origin |

> **On the exam:** a hash provides **integrity**, but not non-repudiation, because anyone can compute a hash. Non-repudiation requires a **digital signature** (asymmetric cryptography) together with a reliable identity. A symmetric MAC also does not provide non-repudiation, because both parties share the key.

## Protecting AI/ML data (2.9)

AI systems have two new types of assets that need protection: **data sets** (training, validation, test, fine-tuning data, RAG document stores, prompts and responses) and **models** (weights, architecture, hyperparameters, configuration). The same principles from this domain apply to them (discovery, classification, lifecycle, logging), along with new threats.

The cloud data lifecycle applied to AI:

| Phase | AI example | Key control |
|---|---|---|
| Create | Data collection and labeling, generation of synthetic data | Legal basis, provenance, label quality |
| Store | Data lake with data sets, model registry, vector database for RAG | Classification, encryption, IAM, versioning |
| Use | Training, fine-tuning, inference | Isolated environments, logging, query limits |
| Share | Sharing a model or data set with partners, public API | Contracts, licenses, output filtering |
| Archive | Retaining versions of data sets and models for reproducibility and audit | Retention, integrity, documentation |
| Destroy | Retiring a model, deleting data sets at a data subject's request | Deleting all copies and derived artifacts, crypto-shredding |

Important: **derived artifacts** (embeddings in a vector database, response caches, prompt logs, training checkpoints) can also contain sensitive data and must be classified the same as the source data set.

Relevant frameworks: **NIST AI RMF (AI 100-1)** with the functions Govern, Map, Measure, Manage; **NIST AI 100-2**, a taxonomy of attacks on ML (adversarial machine learning); **ISO/IEC 42001**, an AI management system; the **OWASP Top 10 for LLM Applications**; the **EU AI Act**, which for high-risk systems requires data governance (quality, representativeness, provenance of data sets).

### Data set and model privacy

| Risk | Description |
|---|---|
| **PII in training data** | Personal data ends up in the data set without a legal basis or outside the purpose for which it was collected. |
| **Memorization / data leakage** | The model memorizes and reproduces parts of the training data (e.g., personal data, secrets). |
| **Membership inference** | An attacker determines whether a specific record was in the training set (e.g., that a person was a patient). |
| **Model inversion** | Reconstruction of sensitive attributes from the model's output. |
| **Model extraction / stealing** | Copying a model's functionality through mass queries; the model is intellectual property. |
| **Leakage through prompts** | Users enter confidential data into an external AI service that stores it or uses it for training. |

Privacy controls:

- **data minimization** and **purpose limitation**: use only the data needed for the purpose, with a legal basis (GDPR also applies to training),
- **anonymization** and **pseudonymization** before training; masking and tokenization,
- **differential privacy**: controlled noise during training limits what the model reveals about an individual,
- **synthetic data** instead of real data where possible,
- **federated learning**: the model is trained locally, and only updates are shared centrally,
- output filtering and rate limiting against extraction,
- contracts with the AI provider: whether data is used for training, prompt retention, processing location,
- data subject rights: deleting data from a data set is possible, but from an already trained model it is difficult (machine unlearning is immature), so minimization before training is more important.

### Data set and model security

| Threat | Description | Control |
|---|---|---|
| **Data poisoning** | Inserting malicious or incorrect data into a data set to change the model's behavior (including backdoor triggers) | Provenance, validation, access control on the data set, anomaly detection |
| **Model tampering** | Altering weights or replacing the model | Integrity (hash, **model signing**), controlled registry |
| **Supply chain** | Pre-trained models and data sets downloaded from public sources may be compromised; some model formats can execute code when loaded | Trusted sources, scanning, safe formats, **AI-BOM** |
| **Evasion / adversarial examples** | Inputs crafted to fool the model in production | Robustness testing, monitoring |
| **Prompt injection** (LLM) | Instructions in input or documents that change the model's behavior | Separating data from instructions, filtering, least privilege for tools |
| **Unauthorized access** | Theft of a data set or weights from storage | Classification, encryption, IAM, logging |

**Validation and verification** are explicitly in the outline:

| Term | Question | Examples for data | Examples for models |
|---|---|---|---|
| **Verification** | Is what we have correct and unaltered, in line with the specification? ("built right") | Hash and signature of the data set, provenance check, data lineage | Model signature and hash, checking that the approved version is in production |
| **Validation** | Is the data or model fit for purpose? ("right thing") | Checking schema, quality, representativeness, outliers, bias, duplicates | Accuracy testing on a separate test set, robustness testing, **red teaming**, fairness assessment |

In practice this looks like an MLOps pipeline with security gates: data enters only from known sources, it is versioned, the hash is recorded, automatic validation rejects anomalies, the model is tested and signed before publication to the registry, and production loads only signed versions. A **model card** and a **datasheet** document the purpose, limitations, and data provenance.

> **On the exam:** AI questions in the CCSP are managerial: first **classify and inventory** data sets and models as assets, establish the **legal basis** for using personal data, and ensure **provenance and integrity** throughout the chain. An answer such as "disable all AI services" or "trust the model provider" is rarely the best.

## Common exam traps

- "We deleted the objects, so the data is destroyed": in the cloud, replicas, backups, and data remanence remain; you need crypto-shredding or contractual sanitization.
- "Degaussing for SSDs": it does not work; degaussing is only for magnetic media.
- "Archive = backup": different purpose, period, and access.
- "Retention takes precedence over legal hold": it is the other way around.
- "A hash provides non-repudiation": no, only integrity.
- "An IP address identifies the user": no, identity comes from authentication.
- "An AI model is just software": the model and the data set are assets that must be classified, protected, and tracked through the lifecycle.

## Scenario: an insurance company and retention, audit, and AI

An insurance company uses the cloud to process claims and trains a fraud detection model.

1. **Retention**: the policy sets 10 years for policy documentation (national regulation), 12 months for audit logs of payment card systems (PCI DSS), and deletes personal data of rejected job candidates after 6 months. Lifecycle policies automatically move old cases to the archive tier.
2. **Archive**: archives are encrypted with customer-managed keys whose retention equals the retention of the archive; a restore of a sample is tested annually.
3. **Legal hold**: a client announces a lawsuit. The legal department places a hold on the cases and emails of the employees involved; lifecycle deletion is suspended for them.
4. **Deletion**: when retention expires, the data is deleted, and for an entire project being shut down, crypto-shredding of a dedicated key is used.
5. **Audit**: all access to cases is logged with identity, IP address, geolocation, and object, into an immutable log archive; the SIEM alerts on mass downloads.
6. **AI**: the training data set is pseudonymized, data provenance is documented, the data set is versioned and hashed; the model is validated on a test set and checked for bias, signed, and published to the registry.

## Summary

- Retention is determined by **regulation, contracts, and business needs**; the policy defines periods, formats, security, retrieval, monitoring. Do not keep data longer than necessary.
- **NIST SP 800-88 Rev. 2**: **clear, purge, destroy**; in the cloud, the customer can realistically use only **crypto-shredding** (purge through cryptographic erase).
- Crypto-shredding requires encryption from the start, control over the key, and destruction of **all copies of the key**.
- An archive is not a backup; the biggest risks are lost keys and an unreadable format; WORM for immutability; test the restore.
- **Legal hold** suspends retention and deletion, takes precedence over policy, begins when a dispute is reasonably anticipated; access only for authorized persons.
- Events must have **when, where, who, what**: time (NTP), identity, IP, geolocation, object, and result; do not log secrets.
- Logs are centralized, protected from modification, separated from administrators, and analyzed in a SIEM.
- **Chain of custody** documents every step of evidence handling (ISO/IEC 27037); **non-repudiation** requires a digital signature and strong identity, while a hash provides only integrity.
- AI/ML: protect data sets and models as assets; privacy (minimization, anonymization, differential privacy) and security (poisoning, tampering, supply chain); **verification** = integrity and provenance, **validation** = fitness for purpose.
