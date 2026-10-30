## Exam objectives

This module covers **objective 3.3** (*Summarize concepts and strategies used to protect data*) and **objective 3.4** (*Explain the importance of resilience and recovery in security architecture*).

For 3.3 the exam expects you to recognize the state and classification of data, pick the right protection method (masking vs tokenization vs hashing…) and know who is responsible for what. For 3.4 it expects you to choose a recovery site type, a redundancy and backup strategy, and to tell the recovery metrics apart.

## Data types and states

### Data types

| Type | Description | Example | Protection |
|---|---|---|---|
| **Structured** | Predefined schema, rows and columns | A PostgreSQL table, CSV | Easy to search, classify and mask per column |
| **Unstructured** | No fixed schema | Email, PDFs, images, Slack messages, logs | Harder to find sensitive data; requires DLP and content classification |

Most organizational data is estimated to be unstructured, and that is where sensitive data most often gets "lost" (e.g., a password on a wiki page).

### Data states

| State | Where the data is | Typical protection |
|---|---|---|
| **Data at rest** | On disk, in a database, in an S3 bucket, on backup tape | Disk/volume encryption (BitLocker, LUKS, EBS/S3 encryption with KMS), access control |
| **Data in transit** | Traveling over the network | TLS, IPsec, SSH, VPN |
| **Data in use** | In memory, being processed by the CPU | Process access control, **confidential computing** (secure enclave, e.g., AWS Nitro Enclaves, Azure confidential VMs), masking in the application |

> **On the exam:** Data in use is the hardest to protect because data must be decrypted to be processed. If a question mentions "data in RAM" or "trusted execution environment / secure enclave," the answer is **data in use**.

## Data classification

**Data classification** sets the level of protection based on the damage that disclosure, modification or loss would cause.

| Class | Typical meaning |
|---|---|
| **Top secret** | Government classification; disclosure would cause exceptionally grave damage to national security |
| **Secret** | Government; serious damage |
| **Confidential** | Government (lower level) or business: data only for authorized people (contracts, trade secrets) |
| **Restricted** | Strictly limited access, only a small group; a leak causes significant damage |
| **Sensitive** | Data whose disclosure harms individuals or the company (PII, health, financial) |
| **Critical** | Data the business cannot function without; the emphasis is on **availability and integrity** |
| **Public** | Intended for the public; no harm from disclosure (but integrity still matters) |

Government systems typically use the hierarchy **top secret > secret > confidential > unclassified**. Commercial organizations choose their own labels (e.g., restricted, confidential, internal, public); what matters is that they are defined in policy and applied consistently.

## Data protection methods

| Method | What it does | Reversible? | Example |
|---|---|---|---|
| **Encryption** | Uses a key to turn data into an unreadable form | Yes, with the key | AES-256 for a database, TLS for traffic |
| **Hashing** | One-way function producing a fixed-length fingerprint | No | Passwords (bcrypt/Argon2 with a salt), file integrity checks (SHA-256) |
| **Masking** | Hides part of the data when displayed | The original stays in the source | `**** **** **** 4821`, masked data for a test environment |
| **Tokenization** | Replaces a sensitive value with a random token; the original lives in a protected **token vault** | Yes, only through the vault | A card number replaced by a token at the payment provider; reduces PCI DSS scope |
| **Obfuscation** | Deliberately makes code or data hard to understand | Partially | JavaScript obfuscation, renaming identifiers |
| **Data transpose** | Rearranges (permutes) data elements or structure (e.g., character order, or swapping rows and columns) so the original is not directly readable | Yes, if you know the rule | Similar to a transposition cipher; weak protection on its own |
| **Deidentification** | Removes or alters identifiers so data cannot be linked to a person | Depends | **Anonymization** (irreversible) vs **pseudonymization** (reversible with an extra key/table) |
| **Filtering** | Lets only allowed data through, strips sensitive data | n/a | Removing PII from logs before sending them to the SIEM, a DLP filter on egress, filtering columns in a query |

> **On the exam:** **Tokenization** vs **encryption**: a token has no mathematical relationship to the original, so it cannot be "decrypted"; the mapping exists only in the vault. **Masking** is for display (e.g., a call center sees the last 4 digits). **Hashing** is one-way and used for passwords and integrity. When the goal is reducing **PCI DSS scope**, tokenization is typically correct.

## Data protection roles

| Role | Responsibility | DevOps example |
|---|---|---|
| **Data owner** | Senior manager who is **accountable** for the data: sets the classification and who may access it | VP of Sales for CRM data |
| **Data custodian** | **Implements** the controls the owner defines: encryption, backup, permissions | The Ops/DBA team configuring RDS encryption and backups |
| **Data steward** | Looks after data **quality**, meaning, metadata and usage rules | A data governance analyst maintaining the data catalog |
| **Data operator** | A person or system that **works with the data** day to day (enters, processes, runs jobs) according to the rules | An operator running an ETL job, an application processing orders |
| **Data controller** | (GDPR term) **Determines the purpose and means** of processing personal data | A company collecting customer data |
| **Data processor** | Processes personal data **on behalf of** the controller | An email marketing SaaS provider |
| **Data subprocessor** | A third party the **processor** engages for part of the processing | The cloud provider on which the SaaS provider hosts the data |

> **On the exam:** **The owner decides, the custodian implements.** If a question asks "who sets the classification," the answer is the owner; "who takes backups and applies encryption," the custodian. The **controller** sets the purpose, the **processor** acts on instructions, the **subprocessor** is the processor's subcontractor.

## Data handling

- **Endpoints**: laptops and mobile devices carry data outside the office. Controls: disk encryption, MDM, a DLP agent, USB blocking.
- **Marking and labeling**: a classification label on a document, file or resource (e.g., Microsoft Purview sensitivity labels, AWS tags `classification=confidential`). The label lets DLP and people know how to handle it.
- **Geofencing**: access or a feature is allowed only within a defined geographic area (e.g., an app works only on company premises, conditional access blocks sign-ins from certain countries).
- **Data location**: where data physically resides (country, region), important for sovereignty and regulations.
- **Data placement**: a deliberate decision about where to put which data (which region, system, zone) based on classification, performance and regulations.

## Data lifecycle

| Phase | Security activities |
|---|---|
| **Creation** | Classify and label immediately when created |
| **Management** | Access control, encryption, monitoring, updates |
| **Distribution** | Secure transfer, DLP, sharing only with authorized parties |
| **Retention** | Keep data as long as regulations and the business require, no longer |
| **Disposal** | Secure destruction: wiping/overwriting, **crypto-shredding** (destroying the key), physical destruction of media, certificate of destruction |

### Example: the lifecycle in AWS

1. **Creation**: a new S3 bucket gets the tag `classification=confidential` through a Terraform module; without the tag the pipeline rejects the deploy.
2. **Management**: default encryption with a KMS key, Block Public Access, IAM policies per classification, CloudTrail logging of access.
3. **Distribution**: sharing only through short-lived presigned URLs or a cross-account role, never a public link.
4. **Retention**: a lifecycle rule moves objects to a cheaper storage class after 90 days and keeps them as long as regulations require.
5. **Disposal**: lifecycle expiration deletes objects; for an entire dataset you can schedule deletion of the KMS key (crypto-shredding).

### Destruction methods

| Method | When |
|---|---|
| **Overwriting / wiping** | The media will be reused; data is overwritten |
| **Degaussing** | Magnetic media (HDDs, tapes); also destroys the drive as usable media |
| **Crypto-shredding** | Cloud and SSDs where you have no physical access; deleting the key makes the data unreadable |
| **Physical destruction** | Shredding, crushing, incineration; the highest level of assurance |
| **Certificate of destruction** | Proof from an external vendor that destruction was performed (for audits) |

For SSDs, classic overwriting is not reliable because of wear leveling; use the manufacturer's built-in secure erase, crypto-shredding or physical destruction.

## Data compliance categories

| Category | Example regulations and standards |
|---|---|
| **Standards** | PCI DSS (cards), ISO/IEC 27001, NIST frameworks |
| **Health data** | HIPAA (US), GDPR special categories of data (EU) |
| **Personal information** | GDPR, CCPA/CPRA, national data protection laws |
| **Financial** | SOX (financial reporting), GLBA, PCI DSS |
| **Child/minor data** | COPPA (US), GDPR special rules for children's consent |
| **Intellectual property** | Trade secrets, patents, source code |
| **Legal data** | Communications with attorneys, evidence, data under **legal hold** |

## Resilience: recovery sites (3.4)

| Site | State | Activation time | Cost |
|---|---|---|---|
| **Hot site** | Fully equipped, data replicated in near real time | Minutes to hours | Highest |
| **Warm site** | Hardware and network ready, data from periodic backups | Hours to days | Medium |
| **Cold site** | Space, power, cooling; no equipment or data | Days to weeks | Lowest |

In the cloud: hot ≈ **multi-site active/active**, warm ≈ **warm standby** (a scaled-down version runs all the time), cold ≈ **backup and restore** or **pilot light** (only the core, e.g., a replicated database, runs; the rest is spun up with IaC).

**Environmental** considerations: the recovery site should be **geographically distant** enough not to be hit by the same disaster (flood, earthquake, regional power outage), but close enough for latency and for staff to get there. Climate, natural hazards, power and accessibility are all considered.

> **On the exam:** If the scenario asks for the **shortest recovery time** regardless of cost, the answer is a **hot site**. If it asks for the **lowest cost** and accepts days of downtime, a **cold site**. Warm is the compromise.

## Platform diversity

**Platform diversity** reduces the risk that a single vulnerability or failure takes everything down:

- **Vendor platform**: different vendors or cloud providers.
- **Hardware**: different hardware models/manufacturers (a firmware bug does not affect everything).
- **Virtualization**: different hypervisors, or a mix of VMs and containers.

## Redundancy

| Solution | Description |
|---|---|
| **Load balancing** | Distributes traffic across multiple servers; one failing does not bring down the service |
| **Clustering** | Multiple nodes act as one system; **active/active** (all working) or **active/passive** (a standby waits) |
| **Autoscaling** | Automatically adds or removes instances based on load (AWS Auto Scaling Group, K8s HPA) |
| **High availability (HA)** | Design with no single point of failure: multiple availability zones, redundant components |
| **Multicloud systems** | Spreading across multiple providers for resilience against one provider's outage |

### Power

| Device | Role |
|---|---|
| **UPS** (*uninterruptible power supply*) | Battery: takes over power **instantly** during an outage, briefly (minutes), enough for a clean shutdown or for the generator to start |
| **RPS** (*redundant power supply*) | Two (or more) power supplies in the same device; one failing does not shut down the server; ideally connected to different circuits |
| **Power generator** | Diesel/gas generator for **extended** outages; it needs time to start (which is why the UPS bridges the gap) |
| **Surge protector** | Protects against voltage spikes (surges); does not provide power during an outage |

### Storage

Storage redundancy: **RAID** (e.g., RAID 1 mirroring, RAID 5/6 with parity, RAID 10), replication between sites or regions (S3 Cross-Region Replication), redundant SAN paths. Important: **RAID and replication are not backups**. If you delete or encrypt a file (ransomware), the change gets replicated.

## Backups

| Aspect | What it means |
|---|---|
| **Retention** | How long copies are kept (e.g., dailies for 30 days, monthlies for a year); aligned with regulations and the RPO |
| **Immutability** | A copy cannot be modified or deleted until it expires, not even by an admin (**WORM**, S3 Object Lock, Azure immutable storage). Key against ransomware. |
| **Scope** | What gets backed up and how: **full** (everything), **incremental** (changes since the last backup of any kind), **differential** (changes since the last full), snapshot, whole system vs data only |
| **Restoration testing** | Regularly restoring from backup to prove it works and to measure the actual recovery time |

| Type | Backup | Restore |
|---|---|---|
| Full | Slowest, most space | Fastest: only one set |
| Incremental | Fastest, least space | Slowest: full + **all** incrementals in order |
| Differential | Grows each day until the next full | Full + the **latest** differential |

### Backups in the cloud

- A **snapshot** (EBS, Azure disk) is fast and convenient, but if it lives in the same account and region as production, an attacker with admin rights can delete it.
- **AWS Backup** / **Azure Backup** with **vault lock** provide central policy, retention and immutability.
- Copying to a **separate account** (e.g., a dedicated backup account in AWS Organizations) with different credentials limits the impact of a compromised production account.
- Protect backup keys (KMS) separately: if an attacker deletes the key, the backup is useless.
- For Kubernetes: back up etcd and persistent volumes (e.g., Velero), plus the IaC and GitOps repository as the source of truth for configuration.

The **3-2-1** rule: three copies, on two different media, one off-site (today often also one offline/immutable).

> **On the exam:** A backup that has never been tested is not a reliable backup. If the scenario asks how to be sure data can be restored, the answer is **restoration testing**. If it asks how to protect backups from ransomware that has admin rights, the answer is **immutability** (and an offline copy).

## Resilience testing

| Test | Description |
|---|---|
| **Tabletop exercise** | A discussion of a scenario around a table, without touching systems (cheapest) |
| **Simulation** | An incident or disaster is simulated and the team works through the procedures, with more realistic triggers (e.g., simulated phishing, a simulated outage) |
| **Failover** | Actually switching operations from the primary to the secondary system or site |
| **Parallel processing** | The secondary system processes the same data **in parallel** with the primary and the results are compared; production is not put at risk |

## DR, BC and capacity planning

- **Business continuity (BC)**: how the organization **continues business functions** during and after a disruption (people, processes, alternate sites, manual procedures). The broader term.
- **Disaster recovery (DR)**: how **IT systems and data are restored** after a disaster. Part of BC.

| | **Business continuity** | **Disaster recovery** |
|---|---|---|
| Focus | Business processes and people | IT systems and data |
| Question | How do we keep working? | How do we restore systems? |
| Example | The call center switches to working from home, manual order processing | Bringing the application up in another AWS region from backup |
| Input | BIA (critical functions, RTO, RPO) | BIA and BCP |

- **Capacity planning**: planning to have enough **people** (backups, trained staff), **technology** (licenses, software) and **infrastructure** (compute, storage, network) for normal load, growth and operating during recovery. In the cloud: service quotas in the DR region, reserved capacity.

## Recovery metrics

| Metric | Question | Example |
|---|---|---|
| **RTO** (*recovery time objective*) | How long can we be **down**? | The service must be running no later than 4 hours after an outage |
| **RPO** (*recovery point objective*) | How much **data** can we lose (measured in time)? | RPO 15 min: backup/replication at least every 15 minutes |
| **MTTR** (*mean time to repair*) | Average time to repair after a failure | 12 h of repairs in total / 4 failures = 3 h |
| **MTBF** (*mean time between failures*) | Average operating time between failures (reliability) | 9,000 h of operation / 3 failures = 3,000 h |

- Lower RTO and RPO = a more expensive solution (hot site, continuous replication).
- Higher MTBF = a more reliable device. Lower MTTR = faster repair.

> **On the exam:** **RPO looks backward** (to which point in the past we restore data), **RTO looks forward** (how long until we are operational again). "We can lose at most one hour of transactions" is RPO. "The system must be online within two hours" is RTO.

## Summary

- Data is **structured** or **unstructured**; the states are **at rest, in transit, in use**, and in use is the hardest to protect.
- Classification (public to top secret, plus sensitive, restricted, critical) drives controls; labeling enables automation.
- **Tokenization** (vault, PCI scope), **masking** (display), **hashing** (one-way), **encryption** (reversible with a key), **deidentification** (anonymization/pseudonymization).
- The **owner** decides, the **custodian** implements, the **steward** looks after quality; the **controller** sets the purpose, the **processor** and **subprocessor** process on instruction.
- Sites: **hot** (fast, expensive), **warm**, **cold** (slow, cheap); consider geographic risks.
- Power: a **UPS** bridges the gap, a **generator** lasts, an **RPS** protects against a power supply failure inside a device, a **surge protector** against voltage spikes.
- Backups need retention, **immutability** and **restoration testing**; RAID and replication are not backups.
- **RTO** = how long we can be down, **RPO** = how much data we can lose, **MTTR** = average repair time, **MTBF** = reliability.
