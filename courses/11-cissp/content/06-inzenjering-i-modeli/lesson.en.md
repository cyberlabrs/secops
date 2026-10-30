## Exam Objectives: 3.1–3.5

Domain 3 (**Security Architecture and Engineering**) carries about **12.8%** of the exam (13% in the 2024 outline). This module covers the first five objectives; cryptography is in the next module, and sites, facilities and the system life cycle are in module 08.

- **3.1 Research, implement, and manage engineering processes using secure design principles**
  - threat modeling, least privilege (PoLP), defense in depth (DiD), secure defaults, fail securely,
  - separation of duties (SoD), keep it simple and small, privacy by design (PETs),
  - shared responsibility, SASE, well-architected framework, rotation of duties, two-person integrity, Zero Trust (ZT).
- **3.2 Understand the fundamental concepts of security models** (e.g., Biba, Star, Bell-LaPadula).
- **3.3 Select controls based upon systems security requirements.**
- **3.4 Understand security capabilities of information systems** (memory protection, TPM, HSM, encryption/decryption).
- **3.5 Assess and mitigate the vulnerabilities of security architectures, designs, and solution elements**
  - client-based, server-based, database, embedded, IoT, cryptographic, HPC systems,
  - microservices and containerization, OT and ICS, edge computing,
  - cloud (SaaS, IaaS, PaaS, serverless/FaaS), supply chain risk, virtualized, autonomous, quantum computing, distributed systems.

> In the 2024 outline, 3.1 did not include well-architected framework, rotation of duties or two-person integrity, and Zero Trust read "Zero trust or trust but verify". 3.4 had no HSM. In 3.5, microservices and containerization were separate, serverless was a separate item, ICS appeared without OT, and supply chain risk, autonomous systems and quantum computing did not exist.

## Secure Design Principles (3.1)

The classic sources are **Saltzer and Schroeder** (1975) and NIST SP 800-160 (Systems Security Engineering). The principles are applied **from the start** (security by design), because adding security later is more expensive and weaker.

| Principle | Essence | Example |
|---|---|---|
| **Least privilege (PoLP)** | a subject gets the minimum rights needed for the task, for the minimum time | JIT access, a service account with read-only rights on a single bucket |
| **Defense in depth (DiD)** | multiple independent layers of controls (administrative, technical, physical) | WAF + validation in the application + parameterized queries + least privilege on the database |
| **Secure defaults** | the system is secure "out of the box"; the user must consciously weaken it | closed ports, unnecessary services disabled, no default passwords |
| **Fail securely (fail-safe/fail-secure)** | on error the system moves to a secure state and does not disclose information | a failing firewall blocks traffic; generic error message |
| **Separation of duties (SoD)** | a critical task is split among several people so that one cannot commit fraud alone | whoever creates a vendor does not approve the payment |
| **Keep it simple and small (KISS)** | smaller and simpler solutions have a smaller attack surface and are easier to verify | small security kernel, minimal container image |
| **Privacy by design** | privacy built into the design and defaults (Ann Cavoukian's 7 principles) | minimization, pseudonymization, PETs |
| **Shared responsibility** | division of responsibility between provider and customer (cloud, MSSP) | IaaS: the customer is responsible for the OS, data, IAM |
| **SASE** | convergence of networking (SD-WAN) and security (SWG, CASB, ZTNA, FWaaS) delivered from the cloud | users everywhere get the same policy close to them |
| **Well-architected framework** | provider best-practice frameworks (AWS, Azure, GCP) with a security pillar | architecture review against the Security pillar |
| **Rotation of duties** | periodic change of roles; uncovers fraud and reduces dependence on a single person | administrator rotation, mandatory vacation |
| **Two-person integrity (TPI)** | two authorized people must be present **at the same time** for a critical action | opening a safe with keys, CA root key, a launch |
| **Zero Trust (ZT)** | no implicit trust based on network location; every request is verified | NIST SP 800-207: PE/PA (PDP) decide, PEP enforces |

Additional classic principles: **complete mediation** (every access is checked), **economy of mechanism** (KISS), **open design** (security does not depend on secrecy of the design, Kerckhoffs's principle), **least common mechanism**, **psychological acceptability** (a control that users bypass is not a control), **trust but verify** (older model: trust with subsequent verification).

Distinctions the exam tests:

- **SoD vs two-person integrity vs dual control vs split knowledge**: SoD assigns **different steps** of a process to different people; TPI/dual control requires **two people for the same step**; split knowledge means no single person knows the whole secret (e.g., halves of a password).
- **Fail-safe vs fail-secure**: for physical doors, **fail-safe** (fail-open) unlocks on power loss to protect people, **fail-secure** (fail-closed) stays locked to protect assets. For emergency exits **life comes first**: fail-safe.
- **Zero Trust components (NIST SP 800-207)**: **Policy Engine** (decision), **Policy Administrator** (executes the decision, establishes the session), together the **PDP**; **Policy Enforcement Point (PEP)** in the data plane. Inputs: identity, device posture, context, threat intel.

### Privacy by design and PETs

The seven principles (Cavoukian, the basis for GDPR Art. 25 "data protection by design and by default"):

1. proactive, not reactive; preventive, not remedial,
2. privacy as the **default setting**,
3. privacy embedded into design,
4. full functionality: positive-sum, not zero-sum (privacy **and** security),
5. end-to-end protection across the full life cycle,
6. visibility and transparency,
7. respect for user privacy (user-centric).

**Privacy-enhancing technologies (PETs)**: pseudonymization and tokenization, anonymization (k-anonymity, l-diversity), **differential privacy** (controlled noise in aggregate results), **homomorphic encryption** (computation on encrypted data), **secure multi-party computation**, **zero-knowledge proofs**, federated learning, confidential computing.

### Shared responsibility

| Layer | On-prem | IaaS | PaaS | SaaS |
|---|---|---|---|---|
| Data, classification, user access | customer | customer | customer | customer |
| Application | customer | customer | customer | provider |
| OS, middleware, runtime | customer | customer | provider | provider |
| Virtualization, hardware, network | customer | provider | provider | provider |
| Physical security of the data center | customer | provider | provider | provider |

The customer **always** remains responsible for data, identities and access, and **cannot transfer accountability** to the provider, only the execution of some controls.

### SASE and Zero Trust in practice

**SASE** (Gartner, 2019) combines **SD-WAN** with **Security Service Edge (SSE)**: **SWG** (secure web gateway), **CASB**, **ZTNA** (replacement for classic VPN), **FWaaS**, often DLP and RBI. Advantage: the same policy for a user in the office, at home and on the road, enforced at the provider's nearest PoP.

Zero Trust tenets (NIST SP 800-207): all data sources and services are resources; communication is secured regardless of network location; access is granted **per session**; the decision is **dynamic** (identity, device, behavior, context); the organization monitors the integrity and posture of all devices; authentication and authorization are strictly enforced before access; as much information as possible is collected to improve policy. ZT is not a product but an **architecture and strategy**; microsegmentation, strong authentication (MFA), device posture checks and least privilege are its building blocks.

> **On the exam:** When a question asks for a control against fraud by a single person in a payment process, the answer is **separation of duties**. When it asks for detecting fraud that already exists, the answer is often **rotation of duties** or **mandatory vacation** (fraud comes to light when another person takes over the job). When it asks for two people to perform one critical action together, the answer is **two-person integrity / dual control**.

### Threat modeling

Threat modeling is the structured discovery of threats in a design, **as early as possible** in the life cycle and again at significant changes. General questions (Shostack): what are we building, what can go wrong, what are we going to do about it, did we do a good job.

| Methodology | Focus | Key points |
|---|---|---|
| **STRIDE** (Microsoft) | threat categories per DFD element | **S**poofing (authentication), **T**ampering (integrity), **R**epudiation (non-repudiation), **I**nformation disclosure (confidentiality), **D**enial of service (availability), **E**levation of privilege (authorization) |
| **PASTA** | risk-centric, 7 stages, from business objectives to attack analysis | links threats to business impact |
| **DREAD** | ranking: Damage, Reproducibility, Exploitability, Affected users, Discoverability | subjective, less used today |
| **VAST** | scalable, agile, for large organizations | process and application models |
| **Attack trees** | attacker's goal at the root, paths as branches | good for analyzing alternative paths |
| **LINDDUN** | privacy threats | Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance |
| **MITRE ATT&CK** | tactics and techniques of real attackers | used for validation and detection |

Process: system decomposition (DFD, trust boundaries, entry points), threat identification, ranking, mitigation (avoid, mitigate, transfer, accept), validation.

## Security Models (3.2)

Models are formal descriptions of the rules by which a policy is enforced. The **policy** says what is wanted, the **model** formally describes how, and the **mechanism** (e.g., the reference monitor) enforces it.

### Basic concepts

- **State machine model**: a system is secure if it starts in a secure state and every transition leads to a secure state (basis for BLP and Biba).
- **Information flow model**: controls flows between levels; also reveals **covert channels**.
- **Noninterference model** (Goguen-Meseguer): actions of a subject at a higher level must not be visible to or affect subjects at a lower level.
- **Lattice-based model**: subjects and objects have labels in a lattice (level + categories/compartments); access is determined by the least upper bound and greatest lower bound.

### Bell-LaPadula (BLP), confidentiality

Developed for the US military (1973), it protects **only confidentiality** and enforces **MAC**.

| Rule | Formulation | Mnemonic |
|---|---|---|
| **Simple Security Property** | a subject must not read an object at a higher level | **no read up** |
| **\* (Star) Security Property** | a subject must not write to an object at a lower level | **no write down** (prevents leaking downward) |
| **Strong Star Property** | read and write only at one's own level | read/write same level |
| **Discretionary Security Property** | additionally, an access matrix (need to know) | DAC within MAC |

Limitations: does not protect integrity or availability, does not address covert channels; the **tranquility** principle (labels do not change during operation) and the permitted role of a **trusted subject** for declassification.

### Biba, integrity

Biba (1977) is an "upside-down" BLP and protects **integrity**.

| Rule | Formulation | Mnemonic |
|---|---|---|
| **Simple Integrity Property** | a subject must not read an object of lower integrity | **no read down** (don't contaminate yourself with untrusted data) |
| **\* (Star) Integrity Property** | a subject must not write to an object of higher integrity | **no write up** |
| **Invocation Property** | a subject must not invoke a subject of higher integrity | no call up |

> **On the exam:** "Star" in the outline refers to the **\* properties** (Star property) that define the write rules. Remember: "**simple** = read, **star** = write". BLP: no read up, no write down (**confidentiality**). Biba: no read down, no write up (**integrity**). If a question says an analyst must not use data from the internet to update the official database, that is Biba.

### Other models

| Model | Protects | Essence |
|---|---|---|
| **Clark-Wilson** | integrity (commercial) | a subject accesses an object **only through a program**: **CDI** (constrained data item), **UDI** (unconstrained), **TP** (transformation procedure, well-formed transaction), **IVP** (integrity verification procedure); access triple subject-program-object; built-in **SoD** and audit; addresses all three integrity goals |
| **Brewer-Nash (Chinese Wall)** | conflict of interest | rights change **dynamically** based on previous accesses: whoever has seen Bank A's data must not see the data of competing Bank B (consulting firms, audit) |
| **Graham-Denning** | secure creation/deletion of subjects and objects and assignment of rights | 8 protection rules (create/delete object, create/delete subject, read/grant/delete/transfer access right) |
| **Harrison-Ruzzo-Ullman (HRU)** | integrity of access rights | extends Graham-Denning; shows that the general safety problem is undecidable |
| **Take-Grant** | propagation of rights | directed graph with take, grant, create, remove rules |
| **Lipner** | confidentiality + integrity | combines BLP and Biba for commercial environments |
| **Sutherland** | integrity | based on noninterference and state machine, prevents interference |

### Example: decisions under the BLP and Biba models

The subject has level **Secret** (BLP) and a medium integrity level (Biba).

| Action | Object | BLP (confidentiality) | Biba (integrity) |
|---|---|---|---|
| read | Top Secret / high integrity | denied (no read up) | allowed |
| read | Confidential / low integrity | allowed | denied (no read down) |
| write | Top Secret / high integrity | allowed (write up, "blind write") | denied (no write up) |
| write | Confidential / low integrity | denied (no write down) | allowed |
| read and write | same level | allowed (strong star: only here) | allowed |

The models are clearly **duals**: what BLP allows, Biba denies. That is why an organization protecting both confidentiality and integrity cannot use only one of them (Lipner combines them).

### Model comparison

| Model | Goal | Type | Keyword in the question |
|---|---|---|---|
| Bell-LaPadula | confidentiality | MAC, lattice, state machine | "military", "leaking downward", "clearance" |
| Biba | integrity | lattice, state machine | "contamination of trusted data" |
| Clark-Wilson | integrity | commercial, well-formed transactions | "only through the application", "accounting", "SoD" |
| Brewer-Nash | conflict of interest | dynamic | "competitors", "consultant" |
| Graham-Denning | rights management | access matrix | "creating and deleting subjects and objects" |
| Take-Grant | propagation of rights | graph | "transferring rights from subject to subject" |
| Noninterference | preventing covert channels | information flow | "actions at a higher level do not affect the lower one" |

The three integrity goals (Clark-Wilson addresses all of them, Biba only the first): prevent **unauthorized** users from modifying data; prevent **authorized** users from making unauthorized modifications; maintain **internal and external consistency**.

## Selecting Controls Based on Security Requirements (3.3)

Controls are selected **from requirements**, and requirements come from the mission, risk assessment, data classification and legal obligations. Typical flow (NIST RMF, SP 800-37):

1. **Prepare** (context, roles, risk strategy).
2. **Categorize** the system (FIPS 199: low/moderate/high impact on C, I, A; high-water mark).
3. **Select** controls (FIPS 200 + SP 800-53 baseline from SP 800-53B, then tailoring).
4. **Implement** controls and document them in the system security plan (SSP).
5. **Assess** (independent assessment of effectiveness).
6. **Authorize** (an authorized official, the **Authorizing Official**, accepts residual risk and issues the **ATO**).
7. **Monitor** (continuous monitoring).

### Certification and accreditation

- **Certification**: technical evaluation that the system meets security requirements.
- **Accreditation (authorization)**: **formal management decision** to accept residual risk and allow the system to operate. Accreditation is a risk decision, not a technical test.

### Product evaluation criteria

| Framework | Status | Essence |
|---|---|---|
| **TCSEC (Orange Book)** | historical (US) | classes D, C1, C2, B1, B2, B3, A1; confidentiality only, standalone systems |
| **ITSEC** | historical (Europe) | separates functionality (F) and assurance (E0–E6) |
| **Common Criteria (ISO/IEC 15408)** | current international | **Protection Profile (PP)**: customer requirements for a product class; **Security Target (ST)**: vendor claims; **Target of Evaluation (TOE)**: the product being evaluated; **EAL1–EAL7** assurance levels |

| EAL | Description |
|---|---|
| EAL1 | functionally tested |
| EAL2 | structurally tested |
| EAL3 | methodically tested and checked |
| EAL4 | methodically designed, tested, and reviewed (typically the highest economical level for commercial products) |
| EAL5 | semiformally designed and tested |
| EAL6 | semiformally verified design and tested |
| EAL7 | formally verified design and tested |

Important: EAL measures **confidence in the correctness** of the implementation (assurance), not "how secure the product is". The evaluation is valid only for the **evaluated configuration**. For cryptographic modules, **FIPS 140-3** is used.

> **On the exam:** When selecting a product, FIRST define the **requirements** (functional and security, derived from risk), and only then look at the certificate. A Common Criteria EAL does not guarantee that the product fits your environment; that is verified by comparing the Security Target with your Protection Profile or requirements.

## Security Capabilities of Information Systems (3.4)

### Protection architecture

- **Trusted Computing Base (TCB)**: all hardware, firmware and software that enforces the security policy. It must be as small as possible. The **security perimeter** is the boundary between the TCB and the rest of the system.
- **Reference monitor**: an abstract concept that mediates every access of a subject to an object. It must be **tamperproof**, **always invoked (complete mediation)** and **small enough to be verified**.
- **Security kernel**: the implementation of the reference monitor in the TCB.
- **Protection rings**: ring 0 (kernel), rings 1–2 (drivers, OS services), ring 3 (user applications). On x86, rings 0 and 3 are used in practice, and the hypervisor runs in "ring −1" (VMX root).
- **Processor modes**: supervisor (kernel) vs problem/user mode.

### Memory protection and isolation

| Mechanism | What it prevents |
|---|---|
| **Process isolation** and virtual memory | a process cannot see another process's memory |
| **Memory segmentation / paging** with permissions | execution or writing outside the allocated space |
| **DEP / NX bit** | executing code from data pages (stack, heap) |
| **ASLR** | predictable addresses for an exploit |
| **Stack canaries, CFI** | hijacking of the execution flow |
| **Data hiding, abstraction, layering** | direct access to internal structures |
| **IOMMU** | DMA attacks from peripherals |

### Hardware security capabilities

| Component | Purpose | Key for the exam |
|---|---|---|
| **TPM** (Trusted Platform Module, ISO/IEC 11889) | chip on the motherboard or firmware; the platform's **root of trust** | **PCR** registers hold measurements of the boot chain (**measured boot**); **sealing** binds a key to the system state (BitLocker); **remote attestation**; endorsement key unique per chip |
| **HSM** (Hardware Security Module) | dedicated device (or cloud service) for generating, storing and using keys | keys **never leave** the HSM in plaintext; tamper-evident/tamper-responsive; **FIPS 140-3** levels 1–4; CA root keys, payment transactions, KMS |
| **Secure enclave / TEE** | isolated execution in the CPU (Intel SGX/TDX, AMD SEV, ARM TrustZone, Apple Secure Enclave) | protection of **data in use**; confidential computing |
| **Secure boot / UEFI** | verifies the signature of the bootloader and kernel | **secure boot** blocks unsigned code; **measured boot** records into the TPM for later verification |
| **Cryptographic accelerators** (AES-NI) | hardware encryption/decryption | enables FDE and TLS without a significant performance hit |
| **Self-encrypting drive (SED)**, Opal | encryption in the disk controller | fast crypto erase |

**Encryption/decryption as a system capability**: the system should support encryption at rest (FDE, TDE), in transit (TLS/IPsec), key management through TPM/HSM/KMS, and separation of keys from data. Algorithm details are in module 07.

**TPM vs HSM**: a TPM is cheap, bound to a single platform, and serves platform integrity and protection of that device's keys. An HSM is dedicated, high-performance, for centralized management of many keys and cryptographic operations for many applications.

### Other capabilities

- **Virtualization and hypervisors** (Type 1 bare-metal, Type 2 hosted) for isolation.
- **Fault tolerance** and redundancy (RAID, clusters).
- **Interfaces**: constrained interfaces (constrained UI), API gateway as a control point.
- **Security modes of operation** (classic): **dedicated** (everyone has clearance, formal approval and need to know for everything), **system high** (clearance and approval for everything, need to know not for everything), **compartmented** (clearance for everything, approval and need to know only for a part), **multilevel** (different clearances, the system enforces separation, requires a trusted TCB).

> **On the exam:** If a scenario asks for proof that a server was not started with a modified bootloader or kernel, the answer is **TPM with measured boot and remote attestation**. If it asks for centralized, FIPS-validated storage of a root CA key or keys for payment transactions, the answer is **HSM**.

## Architecture Vulnerabilities and Mitigations (3.5)

### Recurring general vulnerabilities

- **Covert channels**: **storage** (information through a shared resource, e.g., the existence of a file) and **timing** (through timing patterns). Mitigation: information flow analysis, limiting shared resources, noise.
- **TOCTOU / race condition**: the state changes between check and use. Mitigation: atomic operations, locking.
- **Maintenance hooks / backdoors**: hidden access left by the development team. Mitigation: code review, removal before production.
- **Emanations**: electromagnetic radiation; **TEMPEST** standards, Faraday cage, white noise, control zones.
- **Aggregation and inference** (databases): combining lower-classified data yields higher-classified information.

### Systems overview

| System | Typical vulnerabilities | Mitigations |
|---|---|---|
| **Client-based** (endpoint, desktop, mobile) | malware, outdated applications and plugins, locally cached data, applets, phishing | hardening, EDR, patching, least privilege (no local admin), FDE, allowlisting, MDM |
| **Server-based** | unnecessary services, misconfiguration, vulnerable web/app servers, data flow control | CIS benchmarks, minimal installation, segmentation, patch and config management, WAF |
| **Database systems** | **aggregation**, **inference**, SQL injection, excessive privileges, unencrypted backups | **polyinstantiation** (multiple versions of a record per level), **views**, cell suppression, noise/perturbation, parameterized queries, TDE, DAM; **ACID** (atomicity, consistency, isolation, durability) for transaction integrity |
| **Cryptographic systems** | weak or outdated algorithms, poor implementation, poor key management, weak RNG | validated libraries (FIPS 140-3), crypto agility, KMS/HSM, don't roll your own crypto |
| **IoT** | default passwords, no patches, insecure updates, unencrypted communication, weak physical design | segmentation (separate VLAN), changing credentials, procurement from vendors with a support policy, signed updates |
| **Embedded systems** (firmware, RTOS, cars, medical devices) | long service life, hard to patch, limited resources, exposed debug (JTAG) | secure boot, signed firmware, debug disabled, network isolation, **wrappers** and static environments |
| **Microservices and containerization** | large API surface, east-west traffic, vulnerable images, privileged containers, shared kernel, secrets in images | API gateway, **mTLS and service mesh**, image scanning and SBOM, non-root, read-only fs, seccomp/AppArmor, network policies, secrets manager |
| **HPC** (clusters, grid) | performance over security, shared resources, many users, fast interconnect without controls | segmentation, strict authentication, job scheduler monitoring, namespace isolation |
| **OT and ICS** (SCADA, DCS, PLC, RTU, HMI) | legacy protocols without authentication (Modbus, DNP3), long service life, availability and human safety ahead of confidentiality, IT/OT convergence | **Purdue model** and segmentation into zones and conduits (**ISA/IEC 62443**), DMZ between IT and OT, data diode, passive monitoring, strict change management |
| **Edge computing** (and fog) | physically unprotected locations, many distributed nodes, limited management | zero-touch provisioning, encryption, centralized management and attestation, physical protection |
| **Cloud: IaaS / PaaS / SaaS** | misconfiguration, IAM errors, misunderstanding the shared responsibility model, multi-tenancy | CSPM/CNAPP, IaC scanning, least privilege, logging (CloudTrail), contracts and SLAs |
| **Serverless / FaaS** | excessive function permissions, event injection, vulnerable dependencies, short-lived resources hard to monitor | per-function IAM role, event validation, SCA, centralized logs, timeouts and limits |
| **Virtualized systems** | **VM escape**, **VM sprawl**, vulnerable hypervisor, abandoned images with data, inter-VM traffic | hypervisor patching, VM life cycle management, separate management network, microsegmentation |
| **Distributed systems** | consistency, authentication between nodes, multiple points of attack, harder forensics | mTLS, central identity, synchronized time, consensus protocols, central logs |
| **Autonomous systems** (drones, autonomous vehicles, robotics, AI agents) | sensor manipulation (GPS spoofing, adversarial inputs), unpredictable decisions, human safety | human-in-the-loop/on-the-loop, fail-safe behavior, sensor validation (fusion), limited operational domain, model testing and monitoring |
| **Quantum computing** | threat to asymmetric cryptography (Shor) and weakening of symmetric (Grover); **harvest now, decrypt later** | cryptographic inventory, **crypto agility**, migration to **PQC** (NIST FIPS 203/204/205), longer symmetric keys (AES-256) |
| **Supply chain risk** | compromised vendor hardware, firmware or software, counterfeit components, vulnerable dependencies | SCRM program, vendor assessment, **SBOM**, signed artifacts (SLSA), provenance verification, contractual requirements, trusted distributors |

> **On the exam:** For OT/ICS systems the priority is **availability and human safety**, not confidentiality. Aggressive scanning or automatic patching of a running PLC can cause an outage and physical damage. The BEST answer is usually **segmentation and passive monitoring** with carefully planned changes.

### OT/ICS and the Purdue model

| Level | Content |
|---|---|
| 5 | enterprise network, internet access |
| 4 | business logistics (ERP, email) |
| 3.5 | **IT/OT DMZ** (historian replica, jump hosts, patch server) |
| 3 | site operations (historian, MES, engineering workstations) |
| 2 | process supervision (**HMI**, **SCADA** servers) |
| 1 | basic control (**PLC**, **RTU**, DCS controllers) |
| 0 | physical process (sensors, actuators, valves, motors) |

Traffic between IT and OT must not go directly; everything passes through the DMZ (level 3.5). **ISA/IEC 62443** introduces **zones and conduits** and security levels (SL 1–4). The triad priority in an OT environment is reversed: **A-I-C** (plus safety), unlike IT where C is often emphasized.

### Cloud models and serverless

| Model | Customer controls | Key risks on the customer side |
|---|---|---|
| **IaaS** | OS, network rules, applications, data | unpatched OS, open security groups, public snapshots |
| **PaaS** | application, service configuration, data | weak service configuration, secrets in code, permissions |
| **SaaS** | users, tenant configuration, data | oversharing, weak IAM/SSO, shadow IT |
| **Serverless / FaaS** | function code, triggers, IAM role | excessive permissions, injection through events, vulnerable dependencies |

Common theme: most cloud incidents stem from **customer misconfiguration and IAM errors**, not from a provider breach.

### Databases: aggregation, inference, polyinstantiation

- **Aggregation**: a user with the right to see individual lower-classified data combines it and obtains higher-classified information (e.g., the locations of individual units reveal the force deployment).
- **Inference**: a user **deduces** confidential information from available data (e.g., the department budget minus the known salaries yields the director's salary).
- **Polyinstantiation**: the same primary key has different records for different classification levels, so a lower-level user cannot infer that a secret record exists.
- Controls: context-dependent access control, views, cell suppression, partitioning, noise and perturbation.

### Virtualization and containers

| Aspect | VM | Container |
|---|---|---|
| Isolation | hypervisor, separate kernel | shared host kernel (namespaces, cgroups) |
| Main risk | VM escape, sprawl | container escape through the kernel, privileged container, vulnerable image |
| Controls | hypervisor patching, segmentation | non-root, seccomp, read-only, image scanning, admission control |

Sandboxed variants (gVisor, Kata Containers, Firecracker microVM) give containers isolation closer to that of a VM.

## Scenarios

**Scenario 1: consulting firm.** A consultant worked for Bank A; the firm gets an engagement from competing Bank B. Which model prevents the same consultant from accessing Bank B's data? **Brewer-Nash**, because rights change dynamically based on previous access.

**Scenario 2: accounting.** Users must not modify the general ledger table directly; all changes go through an application that checks the rules, and a consistency check is run periodically. That is **Clark-Wilson** (TP and IVP, access only through a program).

**Scenario 3: smart cameras.** An office bought IP cameras with factory passwords that the vendor does not update. Best step: a separate network zone without access to the internet and the corporate network, changing the passwords, and in the future procurement with security requirements and a support policy.

**Scenario 4: CA key.** The root CA key must be protected so that no single person can use it alone. Combination: **HSM** + **M-of-N control** (dual control/two-person integrity) + offline root.

## Quick Glossary

| Term | One sentence |
|---|---|
| Reference monitor | abstract concept that mediates every access; tamperproof, always invoked, verifiable |
| Security kernel | implementation of the reference monitor |
| TCB | all components that enforce the policy; the smaller, the better |
| Tranquility | labels of subjects and objects do not change during operation (BLP) |
| Polyinstantiation | multiple records with the same key at different levels, against inference |
| Covert channel | information flow that bypasses policy (storage or timing) |
| TOCTOU | state change between check and use |
| PCR | register in the TPM holding measurements of the boot chain |
| EAL | level of confidence in the evaluation (1–7), not a measure of security |
| ATO | formal authorization to operate a system with accepted residual risk |
| VM sprawl | uncontrolled proliferation of VMs without owners and patching |
| Harvest now, decrypt later | today's encrypted traffic is recorded for decryption by a quantum computer |

## Summary

- Secure design principles: least privilege, defense in depth, secure defaults, fail securely, SoD, KISS, privacy by design, shared responsibility, SASE, well-architected, rotation of duties, two-person integrity, Zero Trust (PDP/PEP per NIST SP 800-207).
- Threat modeling is done early and repeated: STRIDE (categories), PASTA (risk), DREAD (ranking), attack trees, LINDDUN (privacy).
- **BLP** (confidentiality): no read up, no write down. **Biba** (integrity): no read down, no write up. **Simple = read, star = write.** Clark-Wilson: access only through TPs, CDI/UDI/IVP, SoD. Brewer-Nash: conflict of interest, dynamic rights. Graham-Denning and HRU: rights management.
- Controls are selected from requirements and risk (RMF: categorize, select, implement, assess, authorize, monitor); accreditation is a **management decision** to accept risk. Common Criteria: PP, ST, TOE, EAL1–7 (assurance, not "security").
- System capabilities: TCB, reference monitor (tamperproof, always invoked, verifiable), rings, memory protection, **TPM** (root of trust, measured boot, sealing, attestation), **HSM** (FIPS 140-3, keys never leave), TEE.
- Vulnerabilities by system type and their mitigations; in particular: aggregation/inference/polyinstantiation in databases, OT/ICS where safety is the priority, VM escape and sprawl, containers with a shared kernel, the quantum threat and crypto agility, supply chain with SBOM.
