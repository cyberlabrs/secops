## Exam objectives: 1.3 and 1.4

This module covers the second part of Domain 1 (**Cloud Concepts, Architecture and Design**, about 17%):

- **1.3 Understand security concepts relevant to cloud computing**
  - cryptography and key management,
  - identity and access control (user access, privilege access, service access),
  - data and media sanitization (overwriting, cryptographic erase),
  - network security (network security groups, traffic inspection, geofencing),
  - virtualization security (hypervisor, containers, ephemeral computing, serverless, isolation),
  - common threats in the cloud,
  - security hygiene (patching, baselining, immutable architecture, hardening).
- **1.4 Understand design principles of secure cloud computing**
  - cloud secure data lifecycle,
  - cloud-based BC and DR planning,
  - Business Impact Analysis (Cost-Benefit Analysis, ROI),
  - functional security requirements (portability, interoperability, vendor lock-in),
  - security considerations and responsibilities for different cloud categories (SaaS, PaaS, IaaS),
  - cloud design patterns (SANS security principles, Well-Architected Framework, CSA Enterprise Architecture, secure by design),
  - DevOps security.

Objective 1.3 lays the foundations that later domains deepen (cryptography in 2.3, IAM in 4.7, networking in 3.x). In 1.4 ISC2 expects an architect's thinking: how to get from business requirements and risk to a design.

## Cryptography and key management

Encryption in the cloud protects data in three states:

| State | Control | Example |
|---|---|---|
| **Data at rest** | encryption of storage, databases, backups | AES-256 with a key from KMS |
| **Data in transit** | TLS 1.2/1.3, IPsec VPN, MACsec | HTTPS to the API, VPN to the VPC |
| **Data in use** | confidential computing (TEE), homomorphic encryption (research) | Nitro Enclaves, SEV-SNP |

The strength of encryption depends on **key management**, not on the algorithm. The key question on the exam is: **who controls the keys?**

| Model | Who generates and holds the key | Customer control | When it is chosen |
|---|---|---|---|
| Provider-managed keys | the CSP, completely transparently | lowest | basic protection, low requirements |
| **Customer-managed keys (CMK)** in KMS | the provider's KMS; the customer manages policies, rotation, deletion | medium/high | most regulated workloads |
| **Bring Your Own Key (BYOK)** | the customer generates it in its own HSM and imports it into KMS | high | requirement that the key originate outside the CSP |
| **Hold Your Own Key (HYOK)** / external key store | the key never leaves the customer's HSM | highest | the strictest regulatory requirements, sovereignty |

The key lifecycle: **generation → distribution → storage → use → rotation → archiving → destruction**. Principles:

- store keys **separately from the data** they protect,
- use an **HSM** validated to **FIPS 140-2/140-3** for root keys,
- **separation of duties**: the key administrator should not have access to the data and vice versa,
- **envelope encryption**: data is encrypted with a data encryption key (**DEK**), and the DEK with a key encryption key (**KEK**) that never leaves the KMS.

> **On the exam:** when a scenario emphasizes that the organization must be able to **immediately revoke the provider's access to the data**, or meet a requirement that keys be **under the customer's exclusive control**, look for BYOK/HYOK or an external key store. A provider-managed key encrypts the data, but does not give the customer control.

## Identity and access control

The outline distinguishes three types of access:

| Type | Who | Key controls |
|---|---|---|
| **User access** | employees, partners, customers | federation (SAML, OIDC), SSO, MFA, RBAC/ABAC, periodic reviews |
| **Privilege access** | cloud and application administrators | **PAM**, just-in-time and just-enough access, phishing-resistant MFA, session recording, break-glass accounts |
| **Service access** | applications, functions, CI/CD pipelines | roles and workload identities instead of static keys, short-lived tokens, secret rotation |

Principles that recur throughout the exam:

- **Least privilege**: only as many rights as needed, only for as long as needed.
- **Separation of duties**: no single person controls an entire critical process.
- **Need to know**: access to information only if the job requires it.
- **Zero trust**: no implicit trust based on network location; every request is authenticated and authorized.

In the cloud, **identity is the new perimeter**: the management plane is reachable from the internet, so compromised credentials are the most common cause of serious incidents.

> **On the exam:** for an application accessing another service, the BEST answer is almost always **a role / managed identity with temporary credentials**, not a long-lived access key, even if it is "encrypted and rotated every 90 days".

## Data and media sanitization

In the cloud the customer has **no physical access** to the disks: it can neither degauss nor destroy them. It therefore relies on:

| Method | Description | Applicability in the cloud |
|---|---|---|
| **Overwriting** (clearing) | overwriting data with zeros or random data | limited: the customer does not control physical blocks, SSD wear leveling and replicas |
| **Cryptographic erase (crypto-shredding)** | destroying the key with which the data was encrypted; the data becomes unusable | **the primary method for the customer** in the cloud |
| **Degaussing** | magnetic erasure of media | only the CSP, for magnetic media; does not work on SSDs |
| **Physical destruction** (shredding, crushing, incineration) | destroying the media | performed by the CSP in the data center, evidenced through audit reports |

The reference is **NIST SP 800-88 Rev. 1** (Guidelines for Media Sanitization), with the categories **Clear, Purge, Destroy**. In NIST, cryptographic erase is a type of purge method.

For crypto-shredding to be valid:

1. the data must be encrypted **from the first write** (including backups and replicas),
2. the key must exist only in controlled locations (no unencrypted copies),
3. the destruction of the key must be recorded (audit trail) and irreversible after a waiting period.

> **On the exam:** "An organization is leaving a public provider and must ensure that its data cannot be recovered. Which method is BEST?" The answer is **cryptographic erasure**. Degaussing and physical destruction are not under the customer's control in a multi-tenant environment.

## Network security

| Control | Description | Note |
|---|---|---|
| **Network Security Groups / security groups** | a stateful virtual firewall at the instance or interface level | default deny inbound, rules per port and source |
| Network ACL | a stateless filter at the subnet level | an additional layer (defense in depth) |
| **Traffic inspection** | IDS/IPS, NGFW, WAF, TLS inspection, VPC traffic mirroring | in the cloud often done in a central "inspection VPC" |
| **Geofencing** | restricting access or operation by geographic location | country blocking on the WAF/CDN, conditional access by location, region restrictions for data |
| Microsegmentation | fine-grained segmentation between workloads | reduces lateral movement |
| Private connectivity | VPN, Direct Connect / ExpressRoute, private endpoints | data does not travel over the public internet |
| DDoS protection | absorption and filtering at the network edge | Shield, Azure DDoS Protection, CDN |

Geofencing has two meanings the exam may use: **access-based** (allow sign-in only from certain countries) and **data location-based** (resources may exist only in approved regions, e.g., for data residency). IP-based geofencing can be bypassed with a VPN, so it is a supplementary control, not the only one.

## Virtualization security

| Technology | Main risks | Controls | Who is responsible |
|---|---|---|---|
| **Hypervisor** | VM escape, side-channel attacks, compromised management interface | hardening, minimal code, hardware isolation, rapid patching | CSP (in the public cloud) |
| **Containers** | shared kernel, privileged containers, vulnerable images, poisoned registry | image scanning and signing, non-root, read-only FS, seccomp/AppArmor, pod security | customer (image, configuration); CSP for a managed control plane |
| **Ephemeral computing** | loss of forensic evidence, secrets in memory, short-lived resources outside the inventory | centralized logging, automated evidence collection, IaC | customer |
| **Serverless** | excessive function permissions, event injection, vulnerable dependencies | least privilege per function, input validation, dependency scanning | customer (code and IAM), CSP (runtime) |
| **Isolation** | leakage between tenants or workloads | dedicated hosts where needed, microVMs (Firecracker, gVisor), network segmentation | shared |

**Ephemeral** resources (instances in an auto-scaling group, containers, functions) are short-lived. Advantage: it is harder for an attacker to maintain persistence. Drawback: when the resource disappears, so does the evidence, so logs must go immediately to central, immutable storage.

## Common threats in the cloud

A source ISC2 often follows is the **CSA Top Threats to Cloud Computing** (the "Pandemic Eleven" edition and newer reports). Typical threats:

| Threat | Example | Key control |
|---|---|---|
| Misconfiguration and inadequate change control | public storage bucket, open database port | CSPM, policy as code, IaC review |
| Poor IAM and credential management | keys in a repository, no MFA | MFA, short-lived credentials, secrets management |
| Insecure interfaces and APIs | API without authentication or rate limiting | API gateway, authentication, validation |
| Inadequate cloud security strategy | migration without architecture and governance | reference architecture, policies |
| Vulnerabilities in software and the supply chain | poisoned library, vulnerable image | SCA, SBOM, signing |
| Data loss and leakage | exfiltration through shared links | DLP, encryption, classification |
| Account hijacking | phishing of an administrator | phishing-resistant MFA, monitoring |
| Malicious insider | an administrator abuses access | SoD, PAM, logging |
| Denial of service and cost attacks | DDoS, denial of wallet | DDoS protection, limits, budget alarms |
| Insufficient visibility and logging | logs not enabled or not retained | central SIEM, management plane logging |
| Abuse of cloud resources | a cryptominer on a stolen account | anomaly detection, quotas |
| Attacks on AI systems | prompt injection, data poisoning | data validation, guardrails (see 1.6) |

> **On the exam:** statistics and CSA reports consistently show that **misconfiguration by the customer** is the most common cause of cloud incidents, not a breach of the provider's infrastructure. If a question asks for the MOST LIKELY cause of a leak from cloud storage, it is almost always misconfiguration.

## Security hygiene

| Practice | Description | Cloud context |
|---|---|---|
| **Patching** | regular application of security patches | in IaaS the customer patches the OS; in PaaS/SaaS the provider; automation (patch manager) |
| **Baselining** | a defined, approved secure configuration as a reference | CIS Benchmarks, golden image, drift detection |
| **Hardening** | reducing the attack surface | disabling unnecessary services and ports, removing default accounts, minimal images |
| **Immutable architecture** | servers are not changed after deployment; a change = a new image and replacement | no configuration drift, easy rollback, "cattle, not pets" |

With the **immutable** approach a patch is not installed on a live server. A new golden image with the patch is built, tested and used to replace the old instances (blue/green or rolling deployment). SSH access to production servers then becomes unnecessary, which reduces risk.

## Cloud secure data lifecycle

CSA and ISC2 use six phases of the data lifecycle (in detail in module 4, objective 2.1):

| Phase | Security focus in the design |
|---|---|
| **Create** | classification and labeling at creation, data owner |
| **Store** | encryption, access control, backup |
| **Use** | access control, DLP, logging, confidential computing |
| **Share** | DLP, IRM/DRM, encryption in transit, data sharing agreements |
| **Archive** | long-term encryption, key management over the years, format availability |
| **Destroy** | crypto-shredding, proof of destruction, retention policies |

Design principle: **security is planned for each phase in advance**, and classification in the Create phase determines the controls in all subsequent phases.

## Cloud-based BC and DR planning

**Business Continuity (BC)** is the organization's ability to continue critical business functions during a disruption. **Disaster Recovery (DR)** is a technical subset: recovery of IT systems and data.

Key metrics:

| Metric | Meaning | Example |
|---|---|---|
| **RTO** (Recovery Time Objective) | the longest acceptable time until the service is recovered | 4 hours |
| **RPO** (Recovery Point Objective) | the largest acceptable data loss measured in time | 15 minutes |
| **RSL** (Recovery Service Level) | the percentage of normal capacity required during an emergency | 60% |
| **MTD / MAD** (Maximum Tolerable Downtime) | the time after which the organization suffers irreparable harm | 24 hours; the RTO must be less |

Cloud DR strategies (from cheapest and slowest to most expensive and fastest):

| Strategy | Description | RTO / RPO | Cost |
|---|---|---|---|
| Backup and restore | backups in another region, everything is rebuilt from backup | hours to days | lowest |
| Pilot light | a minimal core (e.g., a replicated database) runs constantly | tens of minutes to hours | low |
| Warm standby | a scaled-down but fully functional copy | minutes | medium |
| Multi-site active/active | full capacity in multiple regions simultaneously | near zero | highest |

Cloud-specific considerations: DR in **another region** (or at another provider for critical systems), failover testing, **dependence on a single provider** as a risk, resource quotas in the DR region, replication of keys and IAM, and checking whether the contract and SLA cover recovery scenarios. Responsibility for the BC/DR plan remains with the customer.

## Business Impact Analysis (BIA)

A **BIA** identifies critical business processes, their dependencies and the impact of disruption, and derives the MTD, RTO and RPO from that. Steps:

1. identify business processes and owners,
2. assess the impact of disruption over time (financial, regulatory, reputational, operational),
3. determine the MTD, RTO and RPO per process,
4. map dependencies (applications, data, cloud services, suppliers),
5. prioritize recovery.

Economic analyses accompany the BIA:

| Analysis | Question | Formula / example |
|---|---|---|
| **Cost-Benefit Analysis (CBA)** | is the cost of the control lower than the benefit (reduced risk)? | warm standby €50,000/year vs an expected loss of €200,000/year → justified |
| **Return On Investment (ROI)** | what is the return on the investment? | ROI = (benefit − cost) / cost |
| ALE (link to risk analysis) | annualized loss expectancy | ALE = SLE × ARO |

When deciding on a migration to the cloud, the CBA also includes hidden costs: egress traffic, training, tools for multiple environments, an exit strategy.

> **On the exam:** in BC/DR planning, **the BIA comes before** choosing a DR strategy. If a question asks what to do FIRST and the options are "choose warm standby", "configure replication" and "conduct a BIA", the answer is the BIA. A control must never cost more than the value of what it protects.

## Functional security requirements

| Requirement | Meaning | How it is achieved |
|---|---|---|
| **Portability** | moving data and applications between providers | containers, Kubernetes, IaC with abstraction, open formats |
| **Interoperability** | components of different providers and systems working together | open standards (SAML, OIDC, OpenAPI, SCIM) |
| **Vendor lock-in** | dependence on a single provider due to proprietary services, formats or exit costs | abstraction layers, an exit plan, contract clauses, choosing standard services |

Example: a company uses one provider's proprietary serverless database for all applications. When the provider raises prices by 40%, migration would take a year because the data model is tied to that service's API. The risk should have been recognized in the design phase, and at least an exit plan and an estimate of the exit cost should have been documented.

Lock-in is not always bad: managed proprietary services often provide better security with less work. The architect consciously decides where to accept lock-in and where to avoid it, and documents the exit strategy.

Besides lock-in there is also **vendor lock-out**: the provider goes out of business, is acquired or discontinues the service, and the customer is left without access. It is mitigated with escrow arrangements, regular data exports and reversibility clauses.

## Responsibilities by service category

| Layer | IaaS | PaaS | SaaS |
|---|---|---|---|
| Data and classification | customer | customer | customer |
| Identities and access | customer | customer | customer |
| Application | customer | customer | CSP (customer configures) |
| Runtime / middleware | customer | CSP | CSP |
| Operating system | customer | CSP | CSP |
| Virtualization | CSP | CSP | CSP |
| Data center network, physical hardware | CSP | CSP | CSP |
| Physical security | CSP | CSP | CSP |

Specific security focus:

- **IaaS**: OS hardening and patching, security groups, volume encryption, image management, logging.
- **PaaS**: code security, service configuration, secrets in the application, isolation between applications on the same platform.
- **SaaS**: IAM and SSO, sharing configuration, DLP and a **CASB** for visibility, provider assessment (SOC 2), data export.

> **On the exam:** as you move from IaaS toward SaaS, **customer control decreases and reliance on the contract, SLA and audit reports increases**. For SaaS the customer's most important tools are the provider assessment and the contract; for IaaS, its own technical controls.

## Cloud design patterns

| Framework | What it provides | Key ideas |
|---|---|---|
| **SANS security principles** | general secure design principles | least privilege, defense in depth, fail securely, separation of duties, economy of mechanism, complete mediation |
| **Well-Architected Framework** (AWS, Azure, Google) | pillars for evaluating an architecture | AWS: operational excellence, **security**, reliability, performance efficiency, cost optimization, sustainability |
| **CSA Enterprise Architecture** (formerly TCI) | a reference architecture for cloud security | domains: Business Operation Support Services (BOSS), ITOS, Technology Solution Services, Security and Risk Management; linked to the CCM |
| **Secure by design** (CISA and partners) | manufacturers take ownership of product security | secure default settings (secure by default), MFA at no extra cost, eliminating classes of vulnerabilities, transparency |

Other principles that appear: **defense in depth** (multiple layers of controls), **zero trust**, **privacy by design** (GDPR Art. 25), **fail secure** (on failure the system closes access) and **security as code**.

## DevOps security (DevSecOps)

DevOps brings development and operations together for fast delivery. **DevSecOps** builds security into every phase ("**shift left**") instead of checking at the end.

| Pipeline phase | Security control |
|---|---|
| Plan | threat modeling, security requirements |
| Code | pre-commit secret scanning, IDE linters, code review |
| Build | **SAST**, **SCA** (vulnerable dependencies), SBOM, artifact signing |
| Test | **DAST**, IAST, fuzzing |
| Release / deploy | IaC and image scanning, policy as code, approvals |
| Operate / monitor | runtime protection, CSPM, logging, feedback into development |

Key principles: automating security checks in CI/CD, **secrets never in code**, the pipeline as a critical system (protecting runners and deployment credentials), **immutable** artifacts and **supply chain** security (SLSA, signed images).

Example scenario: a team pasted production AWS keys into a configuration file and pushed it to a public repository. The first response is **revocation and rotation** of the credentials and log analysis for abuse; the permanent fix is secret scanning in the pipeline and moving the pipeline to OIDC federation with short-lived tokens.

## KMS or a dedicated HSM

| | Cloud KMS | Cloud HSM (dedicated) |
|---|---|---|
| Model | a multi-tenant managed service | a single-tenant HSM device in the provider's data center |
| Control | the customer manages key policies, the CSP manages the infrastructure | the customer has exclusive control over the HSM and keys |
| Validation | the HSMs behind KMS are usually FIPS 140-2/140-3 Level 3 | FIPS 140-2/140-3 Level 3 |
| Integration | native with the provider's services | requires more work (PKCS#11, JCE, CNG) |
| When | most cases | regulation requires a single-tenant HSM, custom cryptographic operations, CA keys |

Key rotation limits the amount of data encrypted with a single key and the damage from a compromise. KMS usually rotates key material automatically while retaining old versions for decryption; this is **not** re-encryption of existing data.

## Testing the BC/DR plan

A plan that has not been tested does not exist. Types of tests, from least to most invasive:

| Test | Description | Impact on production |
|---|---|---|
| Checklist / read-through | participants review the plan | none |
| Structured walkthrough / tabletop | the team walks through a scenario around a table | none |
| Simulation | an incident is simulated, procedures are performed without an actual failover | minimal |
| Parallel test | DR systems are brought up and process data in parallel with production | low |
| Full interruption (cutover) | production is actually shut down and switched to DR | high risk; rare |

In the cloud, parallel tests are easier to run because the DR environment can be brought up from IaC and shut down after the test. **Chaos engineering** (deliberately inducing failures) is a modern addition that checks resilience continuously.

## Zero trust in cloud design

**Zero trust** (NIST SP 800-207) starts from the assumption that the network is already compromised:

- every request is authenticated and authorized based on identity, device posture and context,
- access is per session and per resource, with least privilege,
- components: **Policy Decision Point (PDP)** and **Policy Enforcement Point (PEP)**,
- continuous monitoring and collection of telemetry for decisions.

In the cloud, zero trust is implemented through an identity-aware proxy (ZTNA), conditional access, microsegmentation, mTLS between services (service mesh) and private endpoints instead of public exposure.

> **On the exam:** if the options are "a VPN that gives full access to the internal network after sign-in" and "per-application access with identity and device posture checks for every request", the zero trust answer is the second.

## Example scenario: design for a fintech application

A fintech startup is building a payments application on a public provider's IaaS/PaaS. Requirements: PCI DSS, RTO 1 hour, RPO 5 minutes, a small team.

1. The **BIA** establishes that payment processing is critical (MTD 4 hours), while reporting is not (MTD 3 days).
2. **DR**: warm standby in another region for payment processing (RTO/RPO met), backup and restore for reporting (the CBA shows that the more expensive option is not justified).
3. **Keys**: customer-managed keys in KMS with HSM protection, replicated to the DR region; tokenization of card numbers.
4. **Access**: SSO with MFA, PAM with just-in-time access for production, roles for services.
5. **Hygiene**: immutable golden images, a CIS baseline, automated image patching in the pipeline.
6. **Lock-in**: they consciously accept the provider's managed database, but package the application in containers for portability and document an exit plan.

## Common traps

| Distractor | Why it is wrong |
|---|---|
| "Degaussing is the best sanitization in the public cloud." | the customer has no physical access; crypto-shredding is the customer's method |
| "Encryption with the provider's key gives the customer full control." | control comes from CMK, BYOK, HYOK |
| "RPO is the time until restart." | that is RTO; RPO is the acceptable data loss |
| "First choose the DR strategy, then do the BIA." | the BIA determines the requirements for the strategy |
| "In SaaS the customer has no security obligations." | data, IAM and configuration remain with the customer |
| "Patching live servers is best practice in an immutable architecture." | in the immutable model the image is replaced |
| "IP-based geofencing is a sufficient access control." | it is easily bypassed with a VPN; it is a supplementary control alongside IAM and MFA |
| "Automatic KMS key rotation re-encrypts all old data." | rotation changes the key material for new operations; old data is not re-encrypted |

## Summary

- Cryptography protects data **at rest, in transit, in use**; the key question is **who controls the keys** (provider-managed → CMK → BYOK → HYOK). Envelope encryption: DEK + KEK.
- IAM: **user, privilege, service access**; least privilege, SoD, zero trust; roles and short-lived credentials for services; PAM and JIT for administrators.
- Sanitization in the cloud: **cryptographic erase** for the customer; overwriting is limited, degaussing and physical destruction are performed by the CSP. Reference: **NIST SP 800-88** (Clear, Purge, Destroy).
- Networking: **security groups**, NACLs, **traffic inspection**, **geofencing**, microsegmentation, private connectivity.
- Virtualization: hypervisor (CSP), containers, **ephemeral** and **serverless** (customer: code, IAM, logs), isolation.
- Most common threat: **misconfiguration**; then IAM, insecure APIs, supply chain, insiders.
- Hygiene: **patching, baselining, hardening, immutable architecture**.
- Design: data lifecycle (Create–Store–Use–Share–Archive–Destroy), **BIA before DR**, RTO/RPO/RSL/MTD, CBA and ROI.
- Functional requirements: **portability, interoperability, vendor lock-in** (and lock-out).
- The customer's responsibility grows from SaaS to IaaS; data and IAM are always theirs.
- Frameworks: **SANS principles, Well-Architected, CSA Enterprise Architecture, secure by design**; **DevSecOps** = shift left and automation in the pipeline.
