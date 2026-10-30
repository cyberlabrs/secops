## Exam objectives: 2.4, 2.5, and 2.6

Domain 2 (**Cloud Data Security**) is the hardest domain of the CCSP exam and carries 20% of the questions. This module covers three objectives that answer the questions "what do we have, where is it, and how valuable is it" and "how do we protect it even when it leaves our control":

- **2.4 Implement data discovery**
  - structured data,
  - unstructured data,
  - semi-structured data,
  - data location.
- **2.5 Plan and implement data classification**
  - data classification policies,
  - data mapping,
  - data labeling and tagging.
- **2.6 Design and implement Information Rights Management (IRM)**
  - objectives: data rights, provisioning, access models,
  - tools: issuing and revocation of certificates, key management, IdP.

The logic of these objectives is a chain: **you cannot classify what you have not discovered, and you cannot protect what you have not classified**. Discovery provides the inventory, classification provides the value and handling rules, and controls (encryption, DLP, IRM) enforce those rules. IRM is special because it protects data even after it leaves your environment.

> **On the exam:** when a scenario asks "what should the organization do FIRST" before introducing DLP, encryption, or IRM, and the data has not yet been inventoried, the correct answer is almost always **data discovery**, followed by **classification**. A control without classification does not know what it is protecting.

## Where discovery sits in the cloud data lifecycle

ISC2 uses the **cloud secure data lifecycle** with six phases: **Create – Store – Use – Share – Archive – Destroy**. Discovery and classification are not one-time steps:

| Phase | Role of discovery and classification |
|---|---|
| Create | The ideal place for classification: data receives a label when it is created (automatically or from the author). |
| Store | Periodic discovery scans storage and finds unlabeled or mislabeled data. |
| Use | The label determines who may read and process the data; IRM and DLP enforce it. |
| Share | The label determines whether data may leave the organization and under what conditions (IRM, DLP). |
| Archive | Classification determines retention, format, and archive location (module 06). |
| Destroy | Classification determines the destruction method (e.g., crypto-shredding for sensitive data). |

In practice: classification at creation is the cheapest. Retroactive discovery over petabytes of data is expensive and never complete, but it is necessary because the data already exists.

## Data types (2.4)

### Structured data

**Structured data** has a predefined schema: relational databases, tables, columns with types. Discovery is relatively easy because **metadata** exists: table and column names (`jmbg`, `card_number`, `email`), types, and constraints.

Techniques:

- **metadata-based discovery**: searching the schema and the data catalog by column names and descriptions,
- **content-based discovery**: sampling values and checking patterns (regex for IBAN, card number with a Luhn check),
- data profiling: column statistics, cardinality, percentage of null values.

Trap: a `notes` or `comment` column in a structured database often contains unstructured text with sensitive data. That is why a metadata-only approach is not enough.

### Unstructured data

**Unstructured data** has no schema: documents, PDFs, email messages, images, scanned documents, audio and video, chat. It is estimated to make up the majority of an organization's data and is the hardest to discover.

Techniques:

- **pattern matching / regular expressions** for known formats (card numbers, national ID numbers (JMBG), passports),
- **lexical analysis** and keyword dictionaries ("confidential", project names),
- **exact data match (EDM)** and **document fingerprinting**: a hash or fingerprint of known sensitive records and document templates,
- **OCR** for images and scans,
- **machine learning classifiers** (trainable classifiers) for categories that have no fixed pattern (contracts, medical reports, CVs).

Every technique produces **false positives and false negatives**. Manual validation of a sample and tuning of rules are part of the process.

### Semi-structured data

**Semi-structured data** has some structure, but not a rigid schema: **JSON, XML, YAML, CSV, logs, email headers, NoSQL documents**. Keys and tags provide context (`"customer_email": ...`), but the structure changes from record to record.

Discovery combines approaches: parsing keys as metadata and content analysis of values. A data lake is typically a mix of all three types.

### Comparison

| Attribute | Structured | Semi-structured | Unstructured |
|---|---|---|---|
| Examples | SQL databases, data warehouse | JSON, XML, logs, NoSQL | Documents, email, images, video |
| Schema | Fixed, predefined | Flexible, self-describing | None |
| Main technique | Metadata + sampling | Key parsing + content | Content analysis, EDM, ML, OCR |
| Discovery difficulty | Low | Medium | High |
| Typical risk | Sensitive column without controls | Logs with tokens and PII | Documents scattered across SaaS |

### Three approaches to discovery analysis

ISC2 literature distinguishes three approaches that you need to recognize in a question:

| Approach | How it works | Advantage | Weakness |
|---|---|---|---|
| **Metadata-based** | Analyzes data about the data: name, owner, size, date, column names | Fast, cheap | Does not see content; bad names = a miss |
| **Label-based** | Relies on existing labels and tags | Precise if labels are accurate | Depends on labeling discipline |
| **Content-based** | Reads the content itself (pattern, hash, ML) | Most accurate | Slowest, expensive, does not work on encrypted content |

> **On the exam:** if the question says the data is encrypted on the client side (client-side encryption) and asks why content-based discovery does not work, the answer is that the tool does not see the plaintext. The solution is discovery **before** encryption or relying on labels and metadata.

## Data location (2.4)

In the cloud, the question "where is the data" is harder than on-premises:

- the provider replicates data across **availability zones** and sometimes regions,
- backups, snapshots, and logs may be in a different location from the primary data,
- a SaaS provider may use **subprocessors** in other countries,
- a CDN caches content at edge locations around the world,
- **shadow IT**: employees use unsanctioned SaaS services, so data ends up in places the security team does not know about,
- AI services may send prompts and data for processing to another region.

Location matters because of **jurisdiction**:

| Term | Meaning |
|---|---|
| **Data residency** | Where data is physically stored (often a business or regulatory requirement). |
| **Data sovereignty** | Data is subject to the laws of the country in which it is located (and sometimes the provider's country). |
| **Data localization** | The law explicitly requires data to remain in the country. |
| **Cross-border transfer** | Transfer outside the jurisdiction; e.g., GDPR requires an appropriate mechanism (adequacy decision, SCC). |

Tools for discovering location: resource inventory by region (cloud asset inventory), policies that restrict regions (in AWS an SCP with `aws:RequestedRegion`, in Azure the Azure Policy "Allowed locations"), a **CASB** for discovering shadow IT through analysis of proxy and firewall logs, and the provider's contractual obligations about the processing location.

Example: a bank in the EU uses a SaaS CRM. Discovery shows that the provider sends data to support in a third country. The first question is not technical but legal and contractual: does the contract (DPA) allow it and is there a transfer mechanism?

> **On the exam:** a question about data location is most often a question of **legal responsibility**. The data owner (cloud customer) remains responsible for compliance even when the provider processes the data. An answer like "that is the provider's responsibility" is almost always wrong.

## Discovery challenges in the cloud

| Challenge | Description | Mitigation |
|---|---|---|
| Access to data | In SaaS you have no access to storage, only to the provider's API | Provider-native discovery, CASB API integration |
| Volume and cost | Scanning large data lakes costs money (egress, API calls) | Sampling, incremental scanning |
| Rate of change | Resources are created and disappear within minutes | Continuous and event-driven discovery |
| Encryption | Content analysis does not see encrypted data | Discovery before encryption, labels |
| Data quality | Bad names, duplicates, stale data | Data governance, data owners |
| Legal obstacles | Scanning employees' private communications | Legal assessment, minimization |

A practical example: **Amazon Macie** performs content-based discovery of sensitive data in S3; **Microsoft Purview** performs discovery and classification across M365 and Azure sources; **Google Cloud Sensitive Data Protection** (formerly Cloud DLP) scans BigQuery and Cloud Storage. These names are not asked on the exam, but they help you recognize the concept.

## Data classification (2.5)

**Data classification** is assigning data a category based on sensitivity, value, and requirements, from which **handling requirements** follow: who may access it, whether it must be encrypted, where it may be stored, how long it is retained, and how it is destroyed.

### Roles

| Role | Responsibility in classification |
|---|---|
| **Data owner** | Accountable for the data; **determines the classification** and approves access. Usually a business manager. |
| **Data custodian** | Implements the controls the classification requires (backup, encryption, access). Often IT or the cloud provider. |
| **Data steward** | Looks after data quality, metadata, and business meaning. |
| **Data processor** | Processes data on behalf of the controller (a GDPR term); the cloud provider is typically a processor. |
| **Data subject** | The person to whom the personal data relates. |

> **On the exam:** "Who is responsible for data classification?" The answer is the **data owner**, not the custodian, not the security team, and not the cloud provider. The custodian implements controls, the owner makes the decision.

### Classification policy

A good **data classification policy** defines:

- **classification levels** and clear criteria for each level,
- **roles and responsibilities** (owner, custodian, user),
- **handling rules** per level (storage, transmission, sharing, printing, destruction),
- the process of **reclassification and declassification** (data loses or gains sensitivity, e.g., a financial report after publication),
- what to do with **aggregated data** (aggregation of low-classified data can produce a more sensitive set),
- exceptions and the approval process,
- periodic review.

Classification criteria listed by ISC2:

| Criterion | Example |
|---|---|
| Data type and format | Personal data, health data, payment data, intellectual property |
| Sensitivity and impact of disclosure | What happens if it leaks: damage, fines, reputation |
| Regulatory and contractual requirements | GDPR, HIPAA, PCI DSS, NDA with a partner |
| Jurisdiction | Where the data originated and whose law applies |
| Ownership | Whose data it is: the organization's, a client's, a partner's |
| Context and use | The same data in a different context can have a different sensitivity |
| Criticality / availability | How important the data is to the business (affects BC/DR) |

### Typical schemes

| Commercial scheme | Government scheme (example) | Typical handling |
|---|---|---|
| Public | Unclassified | No special restrictions |
| Internal | (Sensitive but unclassified) | Employees only, basic controls |
| Confidential | Confidential | Encryption, need-to-know, DLP |
| Restricted / Highly confidential | Secret / Top Secret | Strong encryption, IRM, strict access, logging of every access |

Rule: **fewer levels is better**. A scheme with seven levels that nobody understands leads users to mark everything with the same level. Three to five levels is common practice.

For personal data, categories are often added: **PII** (personally identifiable information), **PHI** (protected health information, HIPAA), **cardholder data** (PCI DSS), **special categories** under GDPR Article 9 (health, biometrics, religion, political opinions).

### Who classifies: manual or automatic

| Method | How | When |
|---|---|---|
| Manual (user-driven) | The author chooses the label at creation | The user knows the context best; risk of errors and laziness |
| Automatic (content-based) | A tool assigns the label based on content | Large volume, known patterns |
| Recommended | The tool suggests, the user confirms | A compromise between accuracy and education |
| Inherited / contextual | Label from the location (folder, bucket, project) | Simple, but a coarse division |

## Data mapping (2.5)

**Data mapping** in the CCSP context has two meanings, and both can be asked:

1. **Mapping between classification schemes**: when two organizations exchange data or when data moves between systems, you must define how one party's labels map onto the other's ("their Restricted = our Confidential"). Without this, data in transfer gets weaker protection. Example: integration after a company merger or migration to a new cloud system.
2. **Data flow mapping**: documenting where data comes from, which systems it passes through, where it is stored, who processes it, and where it exits. The result is a **data flow diagram** and an inventory. GDPR Article 30 requires **Records of Processing Activities** (RoPA), and a DPIA is not possible without a data map.

A data map should contain: data categories, sources, systems and locations (including regions), owners, recipients and subprocessors, the legal basis for processing, retention, and the applied controls.

Practical mapping also links fields: the `dob` column in one system is `date_of_birth` in another, and both must have the same classification.

> **On the exam:** if data is exchanged with a partner that uses a different classification scheme, the BEST first step is **mapping the classification schemes** and agreeing on handling rules in the contract, not "apply the strongest encryption to everything".

## Labeling and tagging (2.5)

Classification is a decision, and a **label** is its visible and machine-readable record that controls can enforce.

| Term | Description | Example |
|---|---|---|
| **Label (visual)** | A marking visible to humans | Document header "CONFIDENTIAL", watermark |
| **Metadata label** | An attribute in the metadata of a file or object | Sensitivity label in an Office document |
| **Resource tag** | A key-value pair on a cloud resource | `DataClassification=Confidential` on an S3 bucket or database |
| **Persistent label** | Travels with the data even when it is copied | A label embedded in the file + IRM protection |

ISC2 lists what a label can contain:

- date of creation,
- scheduled date of destruction / end of retention,
- data owner,
- data source,
- jurisdiction,
- classification level,
- access and handling restrictions (e.g., "EU only", "do not share externally").

Tags in the cloud are used for **policy enforcement**: ABAC rules (in AWS `aws:ResourceTag/DataClassification`), automatically enabling encryption and backup, DLP rules, cost and ownership reports. That is why you must have a **tagging policy**: mandatory keys, allowed values, who may change a tag (otherwise a user changes `Restricted` to `Public` and bypasses the control), and compliance checks (Config rules, Azure Policy, tag policies).

Problems with labels:

- the label is lost during format conversion or copying to a system that does not support it,
- users label incorrectly or label everything the same,
- tags on a resource do not mean that all data inside the resource has that classification,
- a label reveals that something is valuable (which is why it is sometimes not displayed visually).

> **On the exam:** the question "how to ensure that classification stays with the data when it is copied to another system or sent to a partner" leads to **persistent labels in metadata** and **IRM**, not to tags on a bucket that remain only at the source.

## Information Rights Management (2.6)

**Information Rights Management (IRM)** protects the data itself (a document, an email) by encrypting it and binding it to a policy that determines who may do what with it, **regardless of where the data is located**. Classic access control protects the container (folder, bucket, application); once the file is downloaded, the protection disappears. IRM protection travels with the file.

Terms: **DRM (Digital Rights Management)** has historically been used to protect consumer media content (music, movies, e-books), and **IRM** (or Enterprise DRM, E-DRM) for business documents. CCSP often uses them as closely related terms.

### How IRM works

1. The author (or an automatic policy based on the label) applies protection to the document.
2. The document is encrypted with a symmetric key; the key is protected and stored with the IRM server / service.
3. The policy (who, which rights, until when) is bound to the document.
4. When the recipient opens the document, the client (an IRM-enabled application or agent) authenticates the user with the IdP and requests a license from the IRM service.
5. The service checks the policy and issues a license with rights; the application enforces them (e.g., prohibits printing).
6. Every access is logged.

### IRM objectives and capabilities

| Capability | What it means |
|---|---|
| **Persistent protection** | Protection stays with the data no matter where it is copied or sent. |
| **Dynamic policy control** | The owner can change rights later, and this applies to copies already sent. |
| **Automatic expiration** | Access automatically ends after a date or period. |
| **Continuous audit trail** | Logging of who accessed the document, when, and from where. |
| **Replication restrictions** | Restricting copying, printing, screenshots, forwarding. |
| **Remote rights revocation** | The owner can revoke access remotely (e.g., for a former partner). |

### Data rights

Typical rights (granular permission per user or group): **view/read, edit, print, copy/extract, forward, save as, export, full control**. Example: the legal team sends a contract to an external lawyer with view-only rights, no printing or forwarding, expiring in 30 days.

### Provisioning

**Provisioning** in IRM means granting rights to users and devices:

- users must have an **identity** that the IRM service recognizes: an internal directory, **federation** with a partner (SAML, OIDC), or an external account,
- provisioning and deprovisioning must be tied to the IAM lifecycle: when an employee leaves, access to protected documents ends,
- devices can be a condition (managed devices only, compliant mobile devices),
- rights are granted through **policy templates** tied to classification levels, not manually per document.

### Access models

| Model | Application in IRM |
|---|---|
| **DAC** | The author decides who has rights (ad hoc document protection). |
| **RBAC** | Rights per role/group (e.g., "Finance – read"). |
| **ABAC** | Rights based on attributes of the user, device, location, label (e.g., EU only, compliant device only). |
| **MAC** | The system imposes the policy based on classification; the user cannot change it. |

In the cloud, IRM typically runs as a service (e.g., **Microsoft Purview Information Protection** with Azure Rights Management), integrated with the IdP and labels: the "Highly Confidential" label automatically applies an IRM template.

Architectures: **agent-based** (an installed client or plugin enforces rights) and **agentless** (access through a web browser or an application that natively supports IRM). Agentless is easier for partners, agent-based gives stronger control.

### Tools: certificates, keys, and identity

IRM relies on cryptography and PKI:

| Component | Role |
|---|---|
| **Identity provider (IdP)** | User authentication before a license is issued. |
| **PKI / certificates** | Server and client identity, signing licenses and policies, sometimes user certificates. |
| **Certificate issuing** | A CA issues certificates to users, devices, and the IRM server; tied to provisioning. |
| **Certificate revocation** | When a key is compromised or a user leaves the organization: **CRL** (Certificate Revocation List) and **OCSP** (Online Certificate Status Protocol). |
| **Key management** | Storage and rotation of keys that protect content; sometimes **HYOK/BYOK** (Hold/Bring Your Own Key) for sensitive data. |
| **IRM policy / license server** | Issues licenses, enforces expiration and revocation of rights, logs access. |

Certificate revocation and rights revocation are not the same: certificate revocation invalidates an identity or key, while rights revocation (remote revocation) changes the policy for a document. Both are needed. If a client works offline with a cached license, revocation takes effect only when the license expires or the client reconnects, so a short offline access period is set for sensitive data.

### IRM challenges

- **Strong identity is a prerequisite**: without reliable authentication, IRM does not know to whom it is granting rights; federation with partners is a common problem.
- **Compatibility**: the recipient must have an application or agent that supports IRM; not all formats and devices are supported.
- **Mobile devices and offline work**.
- **Analog hole**: a user can photograph the screen with a phone; IRM does not prevent this, it only makes it harder (a watermark helps identify the source).
- **Discovery and DLP**: encrypted content is invisible to content-based tools if they do not have access to the key.
- **eDiscovery and legal hold**: the organization must retain the ability to decrypt (super user function) in order to meet legal obligations.
- **Cost and complexity** of policy management.

> **On the exam:** the scenario "a confidential document is shared with an external partner and the organization must be able to revoke access after the collaboration ends" calls for **IRM**. DLP prevents data from leaving, encryption in transit protects the transfer, but only IRM controls what the recipient does after receipt and enables revocation.

## IRM, DLP, and encryption: when to use what

| Control | What it protects | Where protection ends | Typical question |
|---|---|---|---|
| Encryption at rest | Data on disk/storage | When an authorized application decrypts it | "Protection against media theft / provider access" |
| Encryption in transit (TLS) | Data in transit | At the destination | "Interception on the network" |
| **DLP** | Prevents unauthorized exfiltration (email, upload, USB) | After the data legitimately leaves | "Prevent sending card numbers by email" |
| **IRM** | Use of data anywhere | Analog hole, unsupported clients | "Control after sharing, revocation" |
| **CASB** | Use of cloud services, shadow IT | Outside the observed traffic/API | "Discover unsanctioned SaaS applications" |

These controls complement each other and all depend on classification: DLP rules and IRM templates are tied to labels.

## Scenario: from discovery to IRM

A pharmaceutical company is moving research data to the cloud and sharing clinical trial results with universities.

1. **Discovery**: scanning file servers, SharePoint, and S3 buckets. Structured data (patient database), semi-structured data (JSON exports from laboratory devices), and unstructured data (reports, scanned consent forms) were found. It was also discovered that researchers use a private file-sharing service (shadow IT).
2. **Location**: part of the data is in a region outside the EU; this is mapped to legal requirements.
3. **Classification**: the data owners (research managers) apply the policy: patient health data is "Restricted", protocols "Confidential", published results "Public".
4. **Data mapping**: the university's scheme is mapped to the company's scheme in the collaboration agreement; flows to partners are documented (RoPA).
5. **Labeling**: automatic labels for documents with health data, `DataClassification` tags on cloud resources, an SCP that denies resources without the tag.
6. **IRM**: "Confidential" documents going to universities receive an IRM template: view only, no printing, expiration at the end of the project, federation with the university's IdP.

## Summary

- The chain is **discovery → classification → controls**; without an inventory there is no classification, and without classification controls do not know what they protect.
- **Structured** (schema, metadata), **semi-structured** (JSON, XML, logs), and **unstructured** (documents, images) data require different techniques; content-based is the most accurate, but does not see encrypted data.
- Three approaches to discovery: **metadata-based, label-based, content-based**.
- **Data location** is a matter of jurisdiction (residency, sovereignty, localization); the customer remains responsible.
- The **data owner** determines classification; the custodian implements controls.
- The classification policy defines levels, criteria, handling, reclassification, and aggregation; fewer levels is better.
- **Data mapping** = mapping schemes between organizations and mapping data flows (RoPA, DPIA).
- **Labels** are a machine-readable record of classification; tags enforce policies, and the tagging policy must prevent unauthorized changes.
- **IRM** protects data wherever it is: persistent protection, dynamic policy, expiration, audit trail, replication restrictions, remote revocation.
- IRM depends on strong identity, PKI (certificate issuing and revocation, CRL/OCSP), and key management; it does not solve the analog hole.
