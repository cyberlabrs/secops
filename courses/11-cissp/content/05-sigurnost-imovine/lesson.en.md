## Exam objectives: Domain 2 (2.1–2.6)

Domain 2 (**Asset Security**) carries about **12%** of the exam under the 2027 outline (it was 10% in the 2024 outline). Although it is the smallest domain by number of objectives, its concepts (data owner, classification, remanence, data states) run through all the other domains.

- **2.1 Identify and classify information and assets**
  - data classification,
  - asset classification.
- **2.2 Establish information and asset handling requirements**
  - physical handling,
  - digital/electronic handling,
  - data encryption (at rest, in transit/motion),
  - secure media destruction.
- **2.3 Provision information and assets securely**
  - ownership of information and assets,
  - asset inventory (tangible, intangible),
  - asset management.
- **2.4 Manage data lifecycle**
  - data management policy,
  - data maintenance,
  - roles (owners, controllers, custodians, processors, users/subjects),
  - data retention, collection, destruction, location, and data remanence.
- **2.5 Ensure appropriate asset management (EOL, EOS)**
  - asset management policy, asset retention, asset retirement.
- **2.6 Determine data security controls and compliance requirements**
  - data states (in use, in transit, at rest),
  - scoping and tailoring,
  - standards and controls selection,
  - protection methods: DRM, DLP, CASB, CNAPP.

> In the 2024 outline, objective 2.2 had no sub-items, 2.5 read "Ensure appropriate asset **retention**" with no sub-items, and 2.6 had "Standards selection" (without "controls") and did not mention CNAPP. The content the exam expects is essentially the same.

The mindset for the whole domain: **the data owner decides, the custodian executes**. Controls are chosen according to the **value and classification** of the data, and classification is a business decision, not a technical one.

## Data classification (2.1)

**Classification** is assigning information to levels according to the harm its disclosure, modification, or unavailability would cause. The goal is not paperwork but **proportional protection**: do not spend money protecting public data, and do not leave secrets unprotected.

### Classification schemes

| Military/government scheme (US) | Harm upon disclosure | Commercial scheme (example) | What it typically covers |
|---|---|---|---|
| **Top Secret** | exceptionally grave | **Confidential / Proprietary** | trade secrets, M&A plans, source code |
| **Secret** | serious | **Private** | personal data of employees and customers, salaries, health data |
| **Confidential** | damage | **Sensitive** | internal financial reports, projects, network diagrams |
| **Unclassified** (incl. **CUI** / SBU) | no harm to national security | **Public** | marketing, published reports |

Rules the exam likes:

- Commercial organizations choose **their own** names and number of levels; what matters is that there are few of them (3–5) and that they are clearly defined. Too many levels means no one applies them consistently.
- **Controlled Unclassified Information (CUI)** in the US is still sensitive (e.g., export-controlled data), even though it is not classified.
- Classification is determined by the **data owner**, not by IT, the custodian, or the security team. The security team defines the scheme and advises.
- **Need to know** applies within a level too: a Secret clearance does not automatically grant access to all Secret data.

### Classification criteria

The data owner assesses:

- the **value** of the data (to the organization and to an attacker),
- **age and useful life**: value declines, so data may be declassified,
- **personal association** (PII, PHI),
- **legal, regulatory, and contractual obligations** (GDPR, HIPAA, PCI DSS),
- the **harm** to confidentiality, integrity, and availability (FIPS 199: low, moderate, high).

### Classification process

1. Identify the owner (administrator) of the data.
2. Define the criteria and levels.
3. The owner classifies the data and determines the controls required for each level.
4. Document exceptions.
5. Define **declassification** and the transfer of ownership.
6. Employee training and periodic review of the classification.

**Categorization** and **classification** are not the same: categorization (FIPS 199, NIST RMF) determines the **impact** on the system (low/moderate/high for C, I, A), while classification assigns a sensitivity label to information. A system is categorized according to the **high-water mark** principle: the highest impact of any information it processes determines the system's category.

### Asset classification

**Asset classification** follows data classification: an asset (server, laptop, USB, paper binder, backup tape) inherits the **highest classification of the data it contains or processes**. A laptop with a single Confidential file is treated as a Confidential asset. Assets are also classified by their criticality to the business (supporting a critical process from the BIA), which affects the recovery priority.

> **On the exam:** when a question asks WHO determines the classification or protection level of data, the answer is almost always the **data owner** (the senior manager responsible for the business function). The custodian (IT) implements controls, the security team advises, the user follows the rules. If an answer option says "senior management", that is overall accountability for the program, not the classification of a particular data set.

## Information and asset handling (2.2)

Once the classification is determined, the organization prescribes **handling requirements** for each level: how it is marked, stored, transmitted, shared, copied, and destroyed.

### Marking and labeling

| Term | Meaning | Example |
|---|---|---|
| **Marking** | a human-readable designation | "CONFIDENTIAL" in a document header, a sticker on a box of tapes |
| **Labeling** | a designation in metadata, readable by systems | a sensitivity label in Microsoft Purview, an object tag in S3, a MAC label in SELinux |

Unlabeled media should be treated as if it had the **highest** classification present in the environment until proven otherwise. Also, the marking must remain when media is declassified or sanitized (a new "sanitized" marking), so that media does not get mixed up.

### Physical handling

- **Storage**: safes and locked cabinets according to classification, controlled access, a record of who took the media.
- **Transport**: trusted couriers, sealed packaging, double wrapping (inner classification marking, neutral outer one), **chain of custody** for sensitive media and backup tapes.
- **Clean desk policy**, screen locking, printers with pull printing.
- **Working outside the office**: rules for paper documents at home, travel (laptop in carry-on baggage, never left in a car).

### Digital handling

- labels in metadata and automatic application of controls (DLP, IRM, encryption by label),
- control of copying to removable media (USB blocking, encrypted USB),
- email rules (encryption, prohibition on sending to personal addresses),
- logging access to higher-level data,
- secure sharing with third parties (contract, NDA, IRM).

### Encrypting data at rest and in transit

| State | Techniques | Exam note |
|---|---|---|
| **At rest** | **FDE** (BitLocker, LUKS, FileVault), file/folder encryption, **TDE** in databases, cloud object encryption, self-encrypting drives (SED) | FDE protects against device theft, but **not** against an attacker who is logged on to the system; that requires application/field-level encryption |
| **In transit / in motion** | **TLS 1.2/1.3**, **IPsec**, SSH, VPN, MACsec | distinguish **link encryption** (encrypts everything, including headers, decrypts at each node) from **end-to-end** (encrypts the payload, headers remain visible for routing) |
| **In use** | confidential computing (TEE, enclave), homomorphic encryption | more detail in 2.6 and the cryptography module |

Key management is part of the handling requirements: a key must have the same or higher protection than the data it protects, and it is stored **separately** from the encrypted data.

### Secure media destruction

The key reference is **NIST SP 800-88 Rev. 1 (Guidelines for Media Sanitization)** with three levels:

| Level | What it means | Techniques | Can the media be reused? |
|---|---|---|---|
| **Clear** | protects against simple, non-invasive recovery techniques (OS tools) | overwriting logical locations, factory reset | yes, within the same organization |
| **Purge** | protects against laboratory recovery techniques | **degaussing** (magnetic media only), **cryptographic erase (CE)**, ATA/NVMe Secure Erase, block erase | yes (except after degaussing an HDD, which destroys it) |
| **Destroy** | media physically unusable, recovery impossible | **shredding**, **disintegration**, **pulverization**, **incineration**, melting | no |

Common traps:

- **Deletion and formatting** are not sanitization: they remove pointers, and the data remains (data remanence).
- **Degaussing does not work on SSDs and flash**, nor on optical media. For SSDs, crypto erase, the manufacturer's Secure Erase command, or physical destruction is used.
- **SSDs and wear leveling**: overwriting does not reach spare (over-provisioned) blocks, so overwriting is not reliable.
- **Paper**: cross-cut or micro-cut shredder, burning, pulping.
- After sanitization: **verification** and a **certificate of destruction**, especially with an external contractor.
- In the cloud the customer has no access to the media: **crypto-shredding** (destroying the key) is used, along with the provider's contractual guarantees.

> **On the exam:** if a question asks for the "MOST secure" or "BEST" way to permanently clean sensitive media that is leaving the organization, the answer is **physical destruction** (destroy). If the media is to be reused within the organization, **purge** or **clear** according to the classification is sufficient. Never choose degaussing for an SSD.

## Provisioning information and assets securely (2.3)

### Ownership

Every piece of information and every asset must have an **owner** who is **accountable**: approves access, determines the classification, accepts residual risk, and answers for the asset. The owner can **delegate tasks** (custodian), but not **accountability**.

| Term | Who | Responsibility |
|---|---|---|
| **Information/data owner** | business unit manager | classification, approving access, protection criteria |
| **Asset/system owner** | manager responsible for the system | that the system has adequate controls, the system security plan |
| **Business/mission owner** | process owner | that systems support the business objective, balancing cost and risk |

### Asset inventory

You cannot protect what you do not know about. The **asset inventory** is the foundation of vulnerability, configuration, license, and incident management (the first CIS control is the hardware inventory, the second the software inventory).

| Asset type | Examples | How it is inventoried |
|---|---|---|
| **Tangible** | servers, laptops, mobile devices, network equipment, media, buildings | CMDB, network scanning, NAC, MDM, RFID/barcode, procurement records |
| **Intangible** | intellectual property, data, software licenses, reputation, brand, domains, certificates, cloud resources | IP registers, software inventory (SAM), SBOM, cloud asset inventory |

The inventory must be **accurate and up to date**: automated discovery plus comparison with procurement (shadow IT is discovered precisely through the difference). Each item has an owner, a classification, a location, and a lifecycle status.

### Asset management and secure provisioning

**Asset management** covers the entire lifecycle: planning and procurement (security requirements in the contract), receipt and registration, configuration according to the baseline (**golden image**), assignment to a user, maintenance and patching, changes through **change management**, retirement.

Secure provisioning means:

- access to information is granted based on **need to know** and **least privilege**, with the owner's approval,
- a device is issued already hardened, encrypted, and enrolled in MDM/EDR,
- the user signs the acceptable use policy (AUP) and an equipment acknowledgment,
- **deprovisioning** upon a job change or departure (return of equipment, revoking access, preventing **privilege creep**),
- periodic access review confirmed by the owner.

> **On the exam:** when a scenario describes unknown devices on the network or a system that nobody patches, the FIRST step is **inventory and assigning an owner**. Technical controls (NAC, vulnerability scanning) come only once you know what you have and who is responsible.

## Managing the data lifecycle (2.4)

### Data management policy

The **data management policy** is the umbrella document that defines roles, classification, quality, retention, location, and destruction of data. Standards (e.g., an encryption standard), procedures (how sanitization is done), and guidelines derive from it. The policy is approved by **senior management**; without it, roles and obligations are not enforceable.

### Data lifecycle

ISC2 uses a model similar to the CSA model: **Create/Collect → Store → Use → Share → Archive → Destroy**. Controls differ by phase, and classification is assigned at creation.

### Data roles

| Role | Definition | Key responsibility |
|---|---|---|
| **Data owner** | senior manager responsible for the data | classification, approving access, accountability |
| **Data controller** (GDPR) | the entity that determines the **purpose and means** of processing personal data | lawfulness of processing, data subject rights, accountability to the regulator |
| **Data processor** (GDPR) | the entity that processes personal data **on behalf of** the controller | processing only on the controller's instructions (contract, DPA) |
| **Sub-processor** | a processor engaged by a processor | only with the controller's approval |
| **Data custodian** | technical role (IT, DBA, cloud ops) | backup, encryption, patching, implementing the controls set by the owner |
| **Data steward** | business role for quality and metadata | accuracy, consistency, business rules |
| **User** | uses data for work | following policies, reporting incidents |
| **Data subject** | the natural person to whom personal data relates | has rights (access, rectification, erasure, portability) |
| **DPO** | data protection officer (GDPR) | independent advisor and contact with the regulator |

The same organization can be a controller for its employees' data and a processor for data it processes for a client. A SaaS provider is typically a **processor**, and the customer the **controller**.

> **On the exam:** the key difference: the **owner/controller decides** (what, why, who may), the **custodian/processor executes** (how, as instructed). If a question asks who is responsible for backups and applying encryption, that is the custodian; who is accountable to the regulator for the lawfulness of processing, that is the controller, even when it has outsourced the processing to a processor.

### Data collection

- **Data minimization**: collect only what is necessary for the defined purpose. The cheapest protection for data is not having it.
- **Purpose limitation** and a legal basis (consent, contract, legal obligation, legitimate interest).
- **Transparency**: a privacy notice at collection.
- Classification and labeling **at collection**.

### Data location

| Term | Meaning |
|---|---|
| **Data residency** | where data is physically stored (often a business or contractual choice) |
| **Data sovereignty** | data is subject to the laws of the country where it is located |
| **Data localization** | the law requires data to remain in a particular country |
| **Cross-border transfer** | GDPR: adequacy decision, SCC, BCR |

In the cloud, location is controlled through the choice of region, policies (e.g., organization policies that prohibit other regions), and contract. You also need to know where the **backups, replicas, and logs** are, not just the primary data.

### Data maintenance

Maintenance means that data remains **accurate, complete, available, and protected** during use: integrity controls (input validation, hashes, versioning), data quality (steward), backup and recovery testing, periodic review of classification, updates and corrections (the data subject's right to rectification), migration to new formats before the old ones become unreadable.

### Data retention

- A **retention policy** defines how long each type of data is kept, based on **legal and regulatory requirements** and business needs.
- Keeping data **longer than necessary** is a risk (greater harm from a leak, eDiscovery costs, violating the GDPR storage limitation principle).
- Keeping data **for less time than required** is a violation of the law.
- A **legal hold** (litigation hold) suspends routine deletion for data relevant to a dispute or investigation; it takes priority over the retention schedule.
- Retention must also cover backups and archives; archived data must remain readable (formats, keys, hardware).

### Data remanence

**Data remanence** is the residual data on media after deletion. Sources: sectors that were not overwritten, slack space, bad sectors, spare blocks on SSDs, caches, swap and hibernation files, copies in backups and snapshots. The control is proper sanitization according to NIST SP 800-88, and encryption from the start (so that crypto erase is possible).

### Data destruction

Destruction is performed **at the end of the retention period** (unless under a legal hold), with records and, for sensitive data, confirmation. The method depends on the classification and the media (table in 2.2). In the cloud: deletion plus crypto-shredding, verifying that replicas, snapshots, and backups have also been deleted.

## Asset management: EOL and EOS (2.5)

### Terms

| Term | Meaning | Consequence |
|---|---|---|
| **End of Life (EOL)** | the vendor stops selling (and often manufacturing) the product | no longer procured, replacement is planned |
| **End of Support (EOS)** / End of Service Life (EOSL) | the vendor stops issuing patches, updates, and support | **new vulnerabilities remain unpatched**; this is the security-critical date |
| **Extended support** | paid extended support | a temporary, expensive solution |

EOL and EOS dates differ by vendor: sometimes EOL is the date sales stop, while support continues for years. What matters for security is the **end of security patches**.

### Asset management policy

The **asset management policy** prescribes: the obligation to maintain an inventory and owners, tracking EOL/EOS dates (in the CMDB), budgeting for replacement before EOS, an exception process with formal risk acceptance, and rules for retirement and sanitization.

### Asset retention

Assets sometimes have to be retained beyond their useful life:

- hardware and software needed to **read archives** (old formats, tapes),
- assets under a **legal hold** (evidence in a dispute),
- critical systems with no replacement (OT/ICS with a lifespan of 20+ years).

When a system is retained after EOS, **compensating controls** are needed: network isolation and segmentation, removal from the internet, application allowlisting, increased monitoring, virtual patching (IPS/WAF), restricted access. The decision is documented and the risk is accepted by the **system owner** (risk acceptance), with a deadline and a replacement plan.

### Asset retirement

1. The owner's approval and verification that the asset is not under a legal hold or retention obligation.
2. Migration or archiving of data that must be preserved.
3. Revoking access, service accounts, certificates, DNS records, firewall rules (prevents "zombie" resources and subdomain takeover).
4. **Media sanitization** according to classification (clear/purge/destroy), with verification.
5. Physical disposal (recycling, sale, donation only after appropriate sanitization), environmental regulations (e-waste).
6. A **certificate of destruction** from the contractor and updating the inventory/CMDB.

> **On the exam:** when a system reaches EOS and cannot be replaced, the BEST answer is neither "carry on as before" nor "shut it down immediately" (that endangers the business), but **isolate it and apply compensating controls with formal risk acceptance and a migration plan**. Security serves the business.

## Data security controls and compliance (2.6)

### Data states and controls

| State | Description | Main threats | Controls |
|---|---|---|---|
| **Data at rest** | on disk, in a database, in a backup, in an archive | media theft, unauthorized access, storage misconfiguration | FDE, TDE, file/object encryption, access control, DLP discovery, sanitization |
| **Data in transit (motion)** | traveling over the network | eavesdropping, MITM, modification | TLS, IPsec, VPN, SSH, mTLS, network DLP |
| **Data in use** | in memory, being processed, on screen | memory scraping, shoulder surfing, malicious insiders, cold boot | access control, **confidential computing (TEE)**, on-screen masking, endpoint DLP, privacy screen |

Data in use has historically been the least protected because it must be decrypted to be processed; TEEs (Intel SGX/TDX, AMD SEV, ARM TrustZone) and homomorphic encryption partially solve this.

### Baselines, scoping, and tailoring

A **security baseline** is the minimum set of controls for a given level (e.g., the NIST SP 800-53B low/moderate/high baselines, CIS Benchmarks for configuration). The organization adapts it:

| Term | What it means | Example |
|---|---|---|
| **Scoping** | determining which controls from the baseline **apply** to a given system (removing irrelevant ones) | we remove wireless network controls because the system has no Wi-Fi |
| **Tailoring** | **adapting** controls to the mission, environment, and risk (parameters, compensating controls, additional controls) | a 14-character password instead of 12; a compensating control where the original is not feasible |
| **Supplementation** | adding controls above the baseline | additional monitoring for a critical application |

Scoping is a **subset** of tailoring. Decisions are documented with a rationale (who approved it, why).

### Standards and controls selection

The organization chooses frameworks according to industry, legislation, and contracts:

| Framework/standard | Purpose |
|---|---|
| **ISO/IEC 27001 / 27002** | ISMS (certifiable) and control catalog |
| **NIST SP 800-53** | control catalog for US federal systems, widely used outside them too |
| **NIST CSF 2.0** | framework with the functions Govern, Identify, Protect, Detect, Respond, Recover |
| **CIS Controls / CIS Benchmarks** | prioritized controls; configuration baselines |
| **PCI DSS** | contractual standard for card data |
| **HIPAA, GDPR, SOX, GLBA** | legal obligations (healthcare, privacy, financial reporting, finance) |
| **COBIT** | IT governance and control objectives |

Controls are chosen based on **risk assessment** and compliance requirements; the cost of a control must not exceed the value of the asset (more in Domain 1).

### Data protection methods

| Method | What it does | Where it operates | Limitations |
|---|---|---|---|
| **DRM / IRM** (Digital/Information Rights Management) | persistent document protection: who may open, print, copy, forward; access expiration; revocation | travels with the file itself, even outside the organization | requires client software; screenshots and photos of the screen are still possible |
| **DLP** (Data Loss Prevention) | detects and prevents unauthorized exfiltration of data based on content (regex, fingerprinting, EDM, ML) and labels | **network** (in motion), **endpoint** (in use, USB, clipboard), **storage/discovery** (at rest), cloud | encrypted traffic requires TLS inspection; false positives; does not see all channels |
| **CASB** (Cloud Access Security Broker) | intermediary between users and cloud services: **visibility** (shadow IT), **compliance**, **data security**, **threat protection** | API mode (out-of-band, scans data in SaaS) and proxy mode (forward/reverse, inline) | today part of **SSE/SASE** platforms |
| **CNAPP** (Cloud-Native Application Protection Platform) | unifies **CSPM** (configuration), **CWPP** (workloads, containers), **CIEM** (cloud entitlements), IaC and image scanning, often DSPM | the entire lifecycle of a cloud-native application, from code to runtime | protects data indirectly: detects exposed buckets, excessive permissions, vulnerable workloads |

Additional techniques that appear in the same questions:

- **Tokenization**: replacing a sensitive value with a token that has no mathematical relationship to it; the original is in a token vault (reduces PCI DSS scope).
- **Masking**: static (a copy for testing) and dynamic (on display, by role).
- **Pseudonymization**: reversible with additional information; under GDPR still personal data.
- **Anonymization**: irreversible; anonymous data is no longer personal data (but beware of re-identification by combining data sets).

> **On the exam:** when a scenario requires a document to remain protected even AFTER it has been sent to a partner, the answer is **DRM/IRM** (DLP protects the boundary, it does not follow the file). When it requires discovering unapproved SaaS applications, the answer is **CASB**. When it requires a view of misconfigurations and permissions across multiple cloud accounts, the answer is **CNAPP/CSPM**.

## Scenarios for practicing the mindset

**Scenario 1: backup tapes.** A company sends backup tapes by courier to a remote vault. One tape is lost in transit. What should have been in place FIRST? Encryption of the tapes (at-rest protection that also applies in transport) and chain of custody. After the loss: incident response, determining whether the tapes were encrypted (if they were and the key was not compromised, the notification obligation often does not apply).

**Scenario 2: an old ERP.** An ERP system runs on an OS that is past EOS, and the migration will take 18 months. The correct approach: the system owner formally accepts the risk, the system is segmented, access only through a jump host, increased monitoring, virtual patching, a migration deadline in the plan.

**Scenario 3: SaaS and GDPR.** A company uses a SaaS CRM with data on EU customers. Who is the controller? The company. The SaaS provider is the processor and must have a DPA, and the company remains accountable to the regulator both for its choice of provider and for the location of the data.

**Scenario 4: SSD laptops.** Laptops with SSDs are sold to employees after being written off. Overwriting with a tool is not reliable because of wear leveling; degaussing does not work. Correct: crypto erase (if FDE was enabled from the start, destroying the key) or the manufacturer's Secure Erase, with verification; for highly sensitive data, physical destruction of the drive.

## Quick review of terms

| Term | In one sentence |
|---|---|
| High-water mark | a system gets the highest category of the information it processes |
| Need to know | access only to the information required for the task, even within the same level |
| Declassification | lowering the classification when value/sensitivity declines |
| Chain of custody | a documented chain of who had the media/evidence and when |
| Crypto erase | sanitization by destroying the key with which the data was encrypted |
| Legal hold | suspension of deletion because of a dispute or investigation |
| Scoping | selecting the relevant controls from the baseline |
| Tailoring | adapting controls to the environment and risk |
| EOS | the end of patches; from that moment on, vulnerabilities remain open |
| CASB | an intermediary for visibility and control of SaaS usage |

## Summary

- Classification is determined by the **data owner** according to the value, sensitivity, legal requirements, and age of the data; an asset inherits the highest classification of the data it contains.
- Handling requirements cover labeling (marking for people, labeling for systems), physical and digital storage, transport, encryption at rest and in transit, and destruction.
- NIST SP 800-88: **clear, purge, destroy**. Degaussing does not work on SSDs; deletion and formatting are not sanitization; physical destruction is the most secure.
- An inventory (tangible and intangible) and an owner for each item are the prerequisite for all other controls.
- Roles: the owner and controller decide; the custodian and processor execute; the subject has rights; the steward looks after quality.
- Data lifecycle: minimization at collection, known location (sovereignty, residency, localization), maintaining integrity, retention according to the law, legal hold takes precedence, remanence is addressed by sanitization.
- EOS means unpatched vulnerabilities: replacement or compensating controls with formal risk acceptance; asset retirement ends with sanitization, a certificate, and an updated inventory.
- Data states (at rest, in transit, in use) require different controls; the baseline is adapted through **scoping and tailoring**; DRM follows the file, DLP guards the boundary, CASB controls SaaS, CNAPP protects the cloud-native environment.
