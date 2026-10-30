## Exam objectives: 2.1, 2.2 and 2.3

Domain 2 (**Cloud Data Security**) is the heaviest domain of the exam at about 20%. This module covers the first three objectives:

- **2.1 Describe cloud data concepts**
  - cloud data lifecycle phases,
  - data dispersion,
  - data flows.
- **2.2 Design and implement cloud data storage architectures**
  - storage types (long-term, ephemeral, raw storage, object storage, volume storage),
  - threats to storage types.
- **2.3 Design and apply data security technologies and strategies**
  - encryption and key management,
  - tokenization,
  - hashing (data integrity, nonrepudiation),
  - Data Loss Prevention (DLP),
  - data obfuscation (masking, anonymization),
  - key, secrets and certificate management.

On the exam this area often asks you to **choose the right technique for a scenario**: when tokenization and when encryption; when masking and when anonymization; why a hash is not encryption. The module comes with the lab **Envelope encryption and crypto-shredding**, where you manually build a DEK/KEK hierarchy and "delete" data by destroying the key.

## Cloud data lifecycle

ISC2 and CSA (Security Guidance) use six phases. The phases are not always linear: data can move from Use to Share and back to Store, and some data never reaches Archive.

| Phase | What happens | Risks | Controls |
|---|---|---|---|
| **Create** | data is generated or modified (entry, upload, generation, import) | data without an owner and classification | **classification and labeling** at creation, a data owner, encryption from the first write |
| **Store** | writing to a repository (usually right after Create) | unauthorized access, misconfiguration | encryption at rest, access control, backup, logging |
| **Use** | data is viewed, processed, used (not permanently modified) | abuse by authorized users, leakage at the endpoint | IAM, DLP, activity logging, IRM, confidential computing |
| **Share** | data is made available to others (users, partners, the public) | leakage outside the organization, loss of control | DLP, **IRM/DRM**, encryption in transit, contracts, export control |
| **Archive** | data moves into long-term storage | loss of keys or formats over the years, unavailability for eDiscovery | encryption, long-term key management, readability checks, a retention policy |
| **Destroy** | permanent removal of the data | residual data (data remanence), copies in backups | **crypto-shredding**, confirmation of destruction, retention and legal hold checks |

Key messages:

- Classification in the **Create** phase determines the controls in **all** subsequent phases. Data that is not classified at creation will likely be unprotected later.
- **Use** is the phase in which data is most often decrypted, so access control, logging and user monitoring matter most there.
- **Share** is the phase with the greatest risk of losing control: once data leaves the organization, technical controls (IRM) and contracts are the only protection.
- **Destroy** in the cloud almost always means **crypto-shredding**, because the customer cannot physically destroy the media.

> **On the exam:** "In which phase of the lifecycle should data classification be applied?" The answer is **Create**. If a question asks for the phase in which data leaves the organization's control, that is **Share**. If the emphasis is on data being decrypted and actively processed, that is **Use**.

### Data-related roles

| Role | Responsibility |
|---|---|
| **Data owner** | accountable for the data, determines classification and who may access it (a business role, not IT) |
| **Data custodian** | implements controls on behalf of the owner (backup, encryption, access); often IT or the CSP |
| **Data steward** | takes care of data quality, metadata and business meaning |
| **Data controller** (GDPR) | determines the purposes and means of processing personal data |
| **Data processor** (GDPR) | processes personal data on behalf of the controller (typically the CSP) |
| **Data subject** | the person to whom the personal data relates |

## Data dispersion

**Data dispersion** is the distribution of data across multiple locations (disks, servers, availability zones, regions) for **availability and resilience**, and sometimes confidentiality.

| Technique | Description | Benefit | Consideration |
|---|---|---|---|
| Replication | complete copies in multiple locations | simple availability | more copies = more places to protect and delete |
| **Erasure coding** | data is split into fragments plus parity fragments; the original is reconstructed from a subset (e.g., any 10 of 16) | resilience with less space than replication | more complex; used by object storage services |
| **Bit splitting** | data is encrypted and split into parts stored at different locations or providers | no single location holds usable data | performance, key management complexity |
| Geo-distribution | copies in multiple regions | DR and lower latency | **jurisdiction and data residency** |

Security aspects of dispersion:

- Dispersion increases availability and durability, but **makes it harder to locate and delete all copies**, which is an argument for crypto-shredding.
- Data spread across multiple countries is subject to multiple jurisdictions; replication between regions must comply with regulation (e.g., GDPR transfers outside the EEA).
- Bit splitting across multiple providers can reduce the risk of a single provider being compromised, but increases availability risk if one part is unavailable (which is why it is combined with erasure coding).

> **On the exam:** when a scenario requires data to remain available even after the loss of an entire data center, with efficient use of space, think **erasure coding / data dispersion**. When it requires that no single provider possess usable data, think **bit splitting**.

## Data flows

A **data flow** describes how data moves between components, users, systems and locations. Without a map of the flows you cannot know where encryption, DLP or a contract is needed.

Tools and practices:

- **Data Flow Diagram (DFD)**: a depiction of sources, processes, stores and **trust boundaries**; the basis for threat modeling (STRIDE),
- **data mapping** (records of processing under GDPR Art. 30): which personal data, from where, where it is stored, to whom it is passed on,
- **data lineage**: the origin and transformations of data through the pipeline,
- monitoring **egress** traffic and transfers between regions.

What to look for on a flow map:

| Element | Question |
|---|---|
| Trust boundaries | where does data cross from one zone into another (internet → application, application → third-party SaaS)? |
| Cross-border transfers | does the data leave the country or the EEA? Which legal mechanism (SCCs, adequacy)? |
| Encryption | is every hop encrypted (TLS, mTLS, VPN)? |
| Third parties | which subcontractors receive the data? |
| Stores | where is data retained, including logs, caches and backups? |

Example scenario: a web shop sends orders from an application in an EU region to an analytics SaaS in the US. The flow map reveals a cross-border transfer of personal data, so the organization must have a legal basis (e.g., the EU-US Data Privacy Framework or SCCs), encryption in transit and minimization (e.g., pseudonymizing the customer ID before sending).

## Storage types by service model

CSA and ISC2 traditionally tie storage types to service models:

| Model | Storage types | Description |
|---|---|---|
| **IaaS** | **raw storage**, **volume storage**, **object storage**, **ephemeral** | raw: a directly mapped physical device (e.g., raw device mapping); volume: a virtual block disk attached to a VM; object: objects through an API |
| **PaaS** | **structured** (databases), **unstructured** (big data, blob) | the provider manages the engine, the customer the data |
| **SaaS** | **information storage and management** (data in the application), **content and file storage** (files through the application) | the customer has access only through the application |

The types the outline explicitly lists:

| Type | Description | Examples | Key characteristics |
|---|---|---|---|
| **Long-term** | cheap archival storage for rarely used data | S3 Glacier, Azure Archive, GCS Archive | low cost, slower retrieval (minutes to hours), often **WORM / object lock** for legal retention |
| **Ephemeral** | temporary storage tied to the life of an instance | instance store, local SSD, emptyDir in Kubernetes | disappears on shutdown; do not store anything permanent; fast |
| **Raw storage** | direct access to a physical device or LUN, without abstraction | raw device mapping, bare-metal disks | high performance, requires careful management and sanitization |
| **Object storage** | a flat namespace of objects with metadata, accessed through an HTTP API | S3, Azure Blob, GCS | almost unlimited scalability, access policies per bucket and object, versioning |
| **Volume storage** | a virtual block device attached to an instance, formatted with a file system | EBS, Azure Managed Disks, Persistent Disk | snapshots, per-volume encryption, attached within a single zone |

Also mentioned are **file storage** (shared NFS/SMB: EFS, Azure Files) and **CDN** (caching content at the edge).

## Threats to storage types

| Type | Typical threats | Controls |
|---|---|---|
| Object storage | **public buckets** due to a wrong policy, overly broad pre-signed URLs, deletion or ransomware encryption of objects | block public access, least privilege bucket policies, versioning + object lock, encryption with a CMK, access logging, Macie/DLP |
| Volume storage | **publicly shared snapshots**, unencrypted volumes, snapshot theft for offline analysis, residual data | default volume encryption, prohibiting public snapshots, IAM over snapshots, crypto-shredding |
| Ephemeral | data loss on shutdown, secrets left on the local disk, loss of forensic evidence | do not store persistent data, local disk encryption, centralized logging |
| Raw storage | residual data between tenants, direct access without abstraction controls | sanitization by the CSP, customer-level encryption |
| Long-term | **loss of keys** over the years, obsolete formats, unauthorized access to the archive, inability to find data for eDiscovery | long-lived key management, WORM, periodic restore testing, indexing |
| Databases (structured) | SQL injection, overly broad access, unencrypted backups, exposed endpoint | private endpoints, IAM authentication, encryption, auditing, masking |

General threats to all types:

- **unauthorized access and leakage** (misconfiguration is the main cause),
- **data loss** (deletion, failure, ransomware),
- **integrity violation** (unauthorized modification),
- **jurisdiction** (data in an inappropriate country),
- **data remanence** (residual data after deletion),
- **denial of service** against the storage service or against cost (mass reads and egress).

> **On the exam:** to protect backups and archives from ransomware, the BEST answer is **immutable (WORM) storage** with versioning and separate credentials, not just more frequent backups: an attacker with administrator rights can delete the backups too if they are not locked.

## Encryption and key management

### Where encryption happens

| Level | Description | Protects against | Does not protect against |
|---|---|---|---|
| **Storage-level** (volume, disk) | the provider encrypts the entire volume or disk | theft of physical media, residual data | users or applications with access to the volume |
| **Object / file-level** | encryption of individual objects or files (SSE or client-side) | unauthorized access to storage without rights to the key | an application that has the right to decrypt |
| **Database-level** (TDE) | the database encrypts data files transparently | theft of database files and backups | SQL access with an authorized account |
| **Column / field-level** | encryption of individual columns (e.g., a national ID number) | the database administrator and overly broad access | an application with the key |
| **Application-level / client-side** | the application encrypts before sending to the cloud | the provider and all layers below | a compromised application |

Rule: **the closer to the application and the data encryption happens, the fewer parties can see the plaintext**, but the greater the complexity (search, indexes, key management).

### Envelope encryption

Cloud KMS services work on the principle of envelope encryption:

1. the application asks the KMS for a new **Data Encryption Key (DEK)**,
2. the KMS returns the DEK in plaintext and the same DEK encrypted with a **Key Encryption Key (KEK)** that never leaves the HSM,
3. the application encrypts the data with the DEK (locally, quickly), stores the **encrypted** DEK alongside the data and wipes the plaintext DEK from memory,
4. to decrypt, it sends the encrypted DEK to the KMS, which (if IAM and the key policy allow) returns the plaintext DEK.

Advantages: large data does not travel to the KMS, each object can have its own DEK, and **destroying the KEK renders all DEKs and the data unusable** (crypto-shredding). That is exactly what you do in this module's lab.

### Special types of encryption

| Technique | Description | When |
|---|---|---|
| **Format-Preserving Encryption (FPE)** | the ciphertext keeps the format of the original (e.g., 16 digits); NIST SP 800-38G (FF1) | legacy systems that expect a specific field format |
| **Homomorphic encryption** | computing on encrypted data without decrypting it | research and narrow applications; still slow for general use |
| **Searchable / deterministic encryption** | the same value yields the same ciphertext, enabling equality search | encrypted columns that are searched; weaker protection against frequency analysis |
| **Client-side encryption** | the application encrypts before writing to the cloud | when the provider must not see the plaintext |

### Who holds the key: a quick reminder

The provider-managed, customer-managed (CMK), BYOK and HYOK models were explained in module 2. For the choice the rule is: the more sensitive the data and the stricter the regulation, the more control over the key the customer should retain, while consciously accepting greater operational responsibility (loss of the key = loss of the data).

### Key lifecycle and good practices

| Phase | Practice |
|---|---|
| Generation | in an HSM (FIPS 140-3), a high-quality source of randomness |
| Distribution | never in plaintext; wrapping with another key |
| Storage | separately from the data; HSM/KMS |
| Use | least privilege over the key (key policy), logging of every use |
| Rotation | regular (e.g., annually) and immediately upon suspected compromise |
| Archiving | keep old versions as long as data encrypted with them exists |
| Destruction | planned, with a waiting period and proof; crypto-shredding |

Separation of duties: key administrators should not have access to the data, and data users should not be able to delete or change key policies.

## Tokenization

**Tokenization** replaces a sensitive value (e.g., a card number) with a **token**, a random value with no mathematical relationship to the original. The original ↔ token mapping is kept in a **token vault**, an isolated and strictly protected system.

| | Encryption | Tokenization |
|---|---|---|
| Relationship to the original | mathematical (key + algorithm) | none; only a mapping in the vault |
| Reversibility | whoever has the key can decrypt | only through the token vault |
| Format | the ciphertext usually changes the format (except FPE) | the token can keep the format (16 digits, last 4 the same) |
| Impact on compliance scope | systems with an encrypted PAN may still be in PCI scope | systems that see only tokens can be taken out of **PCI DSS scope** |
| Typical use | data at rest and in transit in general | cards, national ID numbers, account numbers in applications and analytics |

Architecture: the payment application sends the card number to a tokenization service (often an external payment provider), receives a token and from then on stores only the token. The CRM, analytics and support work with tokens.

> **On the exam:** "The company wants to reduce the number of systems in PCI DSS scope, while applications continue to work with a value of the same format." The BEST answer is **tokenization**. Encryption protects data, but systems with access to the key remain in scope, and hashing is not suitable because card numbers have a small value space and a hash cannot be used for an actual payment.

## Hashing

A **hash function** turns input of arbitrary length into output of fixed length (a digest). Properties: **one-way** (the input cannot be recovered), **deterministic** and **collision-resistant**.

| Use | How | Note |
|---|---|---|
| **Data integrity** | compare the hash before and after transfer or storage | SHA-256/SHA-3; MD5 and SHA-1 are obsolete due to collisions |
| Integrity with authentication | **HMAC**: a hash with a secret key | confirms that the message was not altered by someone without the key |
| **Nonrepudiation** | **digital signature**: the message hash encrypted with the sender's private key | only the owner of the private key could have signed; a hash by itself does not provide nonrepudiation |
| Password storage | slow hashing with a **salt** (Argon2, bcrypt, scrypt, PBKDF2) | the salt prevents rainbow table attacks |
| Integrity of logs and evidence | hash chain, hashing of evidence in forensics (chain of custody) | proves the logs were not altered |
| Deduplication and identification | the file hash as an identifier | e.g., known malware by its hash |

Important differences:

- **Hash ≠ encryption**: encryption is reversible with a key, a hash is not.
- **Hash ≠ nonrepudiation**: anyone can compute a hash; nonrepudiation requires an asymmetric signature tied to an identity (PKI).
- Hashing identifiers with a small value space (phone numbers, cards) without a secret key is weak pseudonymization: an attacker can compute all the hashes.

> **On the exam:** the question "how to prove that a contract was sent by a specific partner and has not been altered" calls for a **digital signature** (hash + private key), not just a hash and not an HMAC (an HMAC uses a shared key, so both parties can produce the same MAC and there is no nonrepudiation).

## Data Loss Prevention (DLP)

**DLP** detects and prevents unauthorized leakage of sensitive data.

| Location | What it monitors | Example |
|---|---|---|
| **Data at rest** (storage DLP) | scans repositories and discovers sensitive data | Macie over S3, Purview over SharePoint |
| **Data in motion** (network DLP) | traffic, email, web uploads | an email gateway blocks sending national ID numbers outside the domain |
| **Data in use** (endpoint DLP) | actions on the device: copying, printing, USB | blocking the copying of a confidential file to USB |
| Cloud/CASB DLP | activity in SaaS applications | blocking public sharing of a document labeled as confidential |

DLP components:

1. **discovery and classification** (where sensitive data is: regex, dictionaries, fingerprinting, ML classifiers, labels),
2. **monitoring** (tracking movement and use),
3. **enforcement** (actions: warn, block, encrypt, quarantine, require justification),
4. **reporting** and incident management.

Challenges in the cloud: encrypted traffic (TLS inspection or API integration), many SaaS applications (CASB), false positives, employee privacy, performance. DLP is only as good as the **classification** it is based on.

Recommended rollout order: first **monitoring mode** (only records and warns), tuning rules and reducing false positives, then gradually **blocking** for the most critical categories.

## Data obfuscation

**Data obfuscation** is the umbrella term for techniques that hide or alter data to reduce exposure.

| Technique | Description | Reversible? | Typical use |
|---|---|---|---|
| **Static masking** | permanently changes the data in a copy (e.g., a test database gets fake names) | no | development and testing with realistic data |
| **Dynamic masking** | data is masked at display time according to role; the original remains in the database | the original exists | support sees only the last 4 digits of the card |
| **Anonymization** | irreversibly removes the link to a person (direct and indirect identifiers) | no | statistics, open data, research; anonymous data is not personal data under the GDPR |
| **Pseudonymization** | identifiers are replaced with pseudonyms; re-identification is possible with additional information kept separately | yes (with a key/table) | analytics with reduced risk; still **personal data** under the GDPR |
| Tokenization | see above | yes (through the vault) | payments |
| Encryption | see above | yes (with the key) | general protection |
| Substitution / shuffling | replacing values with realistic ones or shuffling them among rows | no | test data |
| Nulling / deletion | deleting or replacing with NULL | no | removing unnecessary fields |
| Generalization | reducing precision (year instead of date of birth, region instead of address) | no | supporting anonymization (k-anonymity) |

Notes:

- **Indirect identifiers** (postal code + date of birth + sex) can enable re-identification even without a name. Real anonymization must take them into account (k-anonymity, l-diversity, differential privacy).
- **Pseudonymized data is still personal data** under the GDPR, but pseudonymization is recognized as a protective measure.
- For development and testing the BEST choice is usually **static masking** or synthetic data, not a copy of production.

> **On the exam:** "A research team needs patient data for statistical analysis and must not under any circumstances link it to specific individuals." The answer is **anonymization**. If the team must occasionally re-identify a patient (e.g., to contact them in a study), the answer is **pseudonymization**. If support needs to see only part of the data in the application, the answer is **dynamic masking**.

## Key, secrets and certificate management

| Object | Examples | Cloud tool | Key practices |
|---|---|---|---|
| **Cryptographic keys** | KEK, DEK, signing keys | KMS, Cloud HSM, Key Vault | HSM protection, key policy, rotation, SoD, logging of use |
| **Secrets** | database passwords, API keys, tokens | Secrets Manager, Key Vault, Secret Manager, HashiCorp Vault | never in code or images, automatic rotation, dynamic short-lived secrets, role-based access |
| **Certificates** | TLS certificates, client certificates, code signing | Certificate Manager, private CA | inventory, automatic renewal (ACME), expiry monitoring, protection of private keys |

### Secrets

The most common mistake is a secret in source code, a configuration file, an environment variable in IaC or a container image. Good practice:

- the application gets the secret at runtime from a secrets manager, using its workload identity (role),
- **automatic rotation** (e.g., the database password every 30 days without service interruption),
- **dynamic secrets**: credentials generated on demand with a short TTL,
- scanning repositories and pipelines for accidentally exposed secrets,
- reviewing access to secrets through logs.

### Certificates and PKI

The certificate lifecycle: **request (CSR) → validation → issuance → installation → monitoring → renewal → revocation (CRL, OCSP)**. Risks: expired certificates (service outage), stolen private keys, improperly issued certificates.

In 2025 the CA/Browser Forum adopted a gradual reduction of the maximum validity of public TLS certificates: 200 days from March 2026, 100 days from March 2027 and **47 days from March 2029**. Consequence: manual certificate management becomes unsustainable, so **automation** (ACME, the provider's managed certificates) is a mandatory practice.

A private CA in the cloud (e.g., AWS Private CA, Google CAS) is used for internal services and mTLS; the root CA key is kept in an HSM, and the root is kept offline or strictly restricted.

> **On the exam:** when asked for the BEST way for an application to use a database password, the answer is **a secrets manager with a workload identity and automatic rotation**. An encrypted password in a configuration file still needs a key somewhere in the application ("turtles all the way down").

## Choosing a technique: a scenario guide

| Requirement in the scenario | BEST technique |
|---|---|
| reduce PCI DSS scope, keep the format | tokenization |
| protect data from the provider | client-side encryption with the customer's key (HYOK) |
| prove that a file has not been altered | hash (SHA-256) |
| prove who sent a message | digital signature |
| support sees only the last 4 digits | dynamic masking |
| a test environment with realistic but fake data | static masking / synthetic data |
| statistics without the possibility of identification | anonymization |
| analytics with the possibility of re-identification | pseudonymization |
| prevent sending national ID numbers by email outside the company | DLP (data in motion) |
| find sensitive data in buckets | DLP discovery (data at rest) |
| "delete" data in the cloud | crypto-shredding |
| a database password for an application | secrets manager + role + rotation |

## Example scenario: a telemedicine platform

A startup is developing a platform for video consultations with doctors. Data: health records, recordings, payment cards.

1. **Lifecycle**: records are classified as "health – strictly confidential" at creation (Create); they are stored encrypted with a CMK (Store); doctors view them through the application with logging (Use); they are shared with a laboratory through IRM (Share); they are archived for 10 years as required by law with WORM (Archive); upon expiry they are destroyed by crypto-shredding (Destroy).
2. **Storage**: recordings in object storage with block public access, versioning and object lock; databases in PaaS with a private endpoint.
3. **Dispersion and flows**: replication only within EU regions; the DFD reveals that an analytics tool sends events to the US, so identifiers are removed before sending.
4. **Techniques**: card tokenization at the payment processor; dynamic masking for support; pseudonymization for analytics; DLP on email and in SaaS collaboration.
5. **Keys and secrets**: the KEK in an HSM, a DEK per patient (enabling erasure of a single patient's data by destroying their DEK), secrets in a secrets manager with rotation, automatic TLS certificates.

## Common traps

| Distractor | Why it is wrong |
|---|---|
| "A hash provides nonrepudiation." | a digital signature is required (an asymmetric key tied to an identity) |
| "Pseudonymized data is not personal data." | under the GDPR it is; only anonymous data is not |
| "Tokenization is a type of encryption." | a token has no mathematical relationship to the original |
| "Volume encryption protects against the application administrator." | it protects against media theft, not against authorized access |
| "DLP is deployed immediately in blocking mode." | first monitoring and tuning |
| "Classification is done at archiving." | it is done at creation (Create) |
| "Ephemeral storage is good for application logs." | it disappears with the instance; logs must go to a central location |

## Summary

- Lifecycle: **Create → Store → Use → Share → Archive → Destroy**; classification in Create, the greatest risk of losing control in Share, Destroy in the cloud = crypto-shredding.
- Roles: **owner, custodian, steward**; under the GDPR **controller, processor, subject**.
- **Data dispersion**: replication, **erasure coding**, **bit splitting**; increases availability, but complicates jurisdiction and deletion.
- **Data flows**: DFD, trust boundaries, cross-border transfers, mapping and lineage.
- Storage: **long-term** (archive, WORM), **ephemeral** (disappears), **raw**, **object** (API, buckets), **volume** (block, snapshots); by IaaS/PaaS/SaaS model.
- Threats: public buckets and snapshots, ransomware, loss of keys in the archive, data remanence, jurisdiction.
- Encryption: the closer to the data, the fewer parties see the plaintext; **envelope encryption** (DEK/KEK); the key lifecycle and SoD.
- **Tokenization** (vault, reduces PCI scope) ≠ encryption; **hash** for integrity, **signature** for nonrepudiation, **salt** for passwords.
- **DLP**: at rest, in motion, in use; discovery, monitoring, enforcement; start in monitoring mode.
- Obfuscation: **static/dynamic masking**, **anonymization** (irreversible), **pseudonymization** (still personal data), generalization.
- Keys, secrets and certificates: KMS/HSM, a secrets manager with rotation and workload identity, **automated certificate management** (the road to 47-day TLS certificates).
