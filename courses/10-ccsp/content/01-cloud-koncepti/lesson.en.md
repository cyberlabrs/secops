## Exam objectives: 1.1 and 1.2

Domain 1 (**Cloud Concepts, Architecture and Design**) carries about 17% of the exam. This module covers the first two objectives:

- **1.1 Understand cloud computing concepts**
  - cloud computing definitions,
  - roles and responsibilities (cloud service customer, Cloud Service Provider, cloud service partner, cloud service broker, regulator),
  - essential characteristics (on-demand self-service, broad network access, multi-tenancy, rapid elasticity and scalability, resource pooling, measured service),
  - building block technologies (virtualization, storage, networking, databases, orchestration).
- **1.2 Describe cloud reference architecture**
  - cloud computing activities,
  - cloud service capabilities (application, platform, infrastructure capability types),
  - cloud service categories (SaaS, PaaS, IaaS),
  - deployment models (public, private, hybrid, community, multi-cloud),
  - cloud shared considerations (interoperability, portability, reversibility, availability, security, privacy, resiliency, performance, governance, maintenance and versioning, SLA, auditability, regulatory, outsourcing),
  - impact of related technologies (data science, ML, AI, blockchain, IoT, containers, quantum computing, edge computing, confidential computing).

This is the "vocabulary" of the entire exam. Questions on these objectives are rarely pure definitions: more often you get a scenario ("the organization wants to avoid dependence on a single provider… which characteristic/consideration is MOST important?") and you must recognize which term ISC2 expects there. ISC2 terminology comes from two sources worth remembering: **NIST SP 800-145** (the definition and five characteristics) and **ISO/IEC 17788 / 17789** (overview, vocabulary and reference architecture).

## Definition of cloud computing

**NIST SP 800-145** defines cloud computing as a model for enabling ubiquitous, convenient, **on-demand** network access to a shared pool of configurable computing resources (networks, servers, storage, applications, services) that can be rapidly provisioned and released with minimal management effort or service provider interaction.

The NIST model has three parts: **5 essential characteristics**, **3 service models** (SaaS, PaaS, IaaS) and **4 deployment models** (public, private, hybrid, community).

**ISO/IEC 17788** gives almost the same definition, but lists **six** key characteristics (it adds **multi-tenancy**) and defines a wider set of service categories (CaaS, CompaaS, DSaaS, NaaS…). The 2026 CCSP outline explicitly lists multi-tenancy and "rapid elasticity and scalability", so it combines both sources.

> **On the exam:** if a question asks for "the NIST definition of cloud computing", look for the option with "on-demand", "shared pool of configurable resources" and "rapidly provisioned and released with minimal management effort". Hosting on a single leased server without self-service and elasticity is NOT cloud, even though it is "somewhere else".

## Roles and responsibilities (ISO/IEC 17789)

ISO/IEC 17789 defines **roles** and sub-roles. The same organization can have multiple roles: e.g., a SaaS company is a **CSP** to its customers and a **cloud service customer** to the IaaS provider it runs on.

| Role | Who it is | Key responsibilities |
|---|---|---|
| **Cloud Service Customer (CSC)** | an organization that uses cloud services under a contract | managing data, identities and access, using the service, responsibility for compliance (accountability stays with it!) |
| **Cloud Service Provider (CSP)** | an organization that makes services available | operating the service, infrastructure, physical security, SLA, business support |
| **Cloud Service Partner (CSN)** | a third party that supports the CSP or CSC | sub-roles: **cloud service developer**, **cloud auditor**, **cloud service broker** |
| **Cloud Service Broker** | an intermediary between the customer and one or more providers | aggregation, integration, customization, contract negotiation |
| **Cloud Auditor** | an independent party that evaluates services | auditing controls, reports (SOC 2, ISO 27001), compliance assessment |
| **Regulator** | a government or sector authority | sets legal requirements (GDPR, HIPAA; PCI DSS is an industry standard, not a law), imposes penalties |

NIST SP 500-292 (NIST Cloud Computing Reference Architecture) uses a slightly different set: **cloud consumer, cloud provider, cloud broker, cloud auditor, cloud carrier** (the network operator that carries the traffic). Both vocabularies can appear on the exam.

### Cloud service broker: three roles (NIST)

- **Service intermediation**: enhances a single service (e.g., adds identity management or reporting),
- **Service aggregation**: combines multiple services into a new one,
- **Service arbitrage**: like aggregation, but the broker dynamically chooses the provider (e.g., the cheapest or the fastest).

### Accountability vs responsibility

The most important lesson of this section: **responsibility for execution can be shared or transferred, but ultimate accountability for the data stays with the data owner, i.e., the cloud customer.** Under the GDPR the customer is usually the **data controller** and the CSP the **data processor**.

> **On the exam:** "Who is ULTIMATELY accountable for protecting the personal data of clients that a company holds in a SaaS application?" The answer is the **cloud customer (data owner/controller)**, never the CSP, broker or auditor. A contract can transfer tasks, but not accountability.

## Essential characteristics

| Characteristic | What it means | Security consequence |
|---|---|---|
| **On-demand self-service** | the customer provisions resources through a portal/API, without human interaction with the CSP | **shadow IT**, need for governance and limits (SCPs, quotas), IAM control over the API |
| **Broad network access** | access over the network through standard mechanisms (browser, mobile, API) | larger attack surface, need for strong authentication (MFA) and encryption in transit |
| **Resource pooling** | resources are shared among customers and dynamically assigned; **location independence** | the customer does not know the exact location of the data → questions of jurisdiction, data residency |
| **Multi-tenancy** | multiple customers (tenants) share the same infrastructure with logical isolation | risk of leakage between tenants (side channels, isolation failure), **noisy neighbor** |
| **Rapid elasticity and scalability** | resources quickly grow/shrink and appear unlimited to the customer | availability and resilience against DDoS, but also **cost risk** (denial of wallet) |
| **Measured service** | usage is metered, controlled and billed (pay-as-you-go) | metering data is a source for anomaly detection and chargeback |

The difference between **scalability** and **elasticity**: scalability is a system's ability to grow (vertically: a bigger machine; horizontally: more machines), while elasticity is **automatic** adjustment up and down according to load.

> **On the exam:** when a scenario says "the company does not know which data center its data is in", the characteristic in question is **resource pooling** (location independence). When it says "the bills went up because auto-scaling responded to an attack", that is a combination of **rapid elasticity** and **measured service**.

## Building block technologies

| Building block | Role in the cloud | Real-world example |
|---|---|---|
| **Virtualization** | hardware abstraction, the foundation of multi-tenancy; Type 1 (bare-metal) and Type 2 (hosted) hypervisors | AWS Nitro, KVM, Hyper-V, VMware ESXi |
| **Storage** | object, block (volume), file, ephemeral | S3, EBS, EFS, Azure Blob |
| **Networking** | SDN, virtual networks, load balancers, overlay | VPC, security groups, Transit Gateway |
| **Databases** | relational and NoSQL, managed (DBaaS) | RDS, DynamoDB, Cloud SQL |
| **Orchestration** | automated management of resources and workloads | Kubernetes, Terraform, CloudFormation |

Key terms:

- **Software-Defined Networking (SDN)** separates the **control plane** (routing decisions) from the **data plane** (packet forwarding); management is centralized and programmable. From a security standpoint: a compromised SDN controller = a compromised entire network.
- The **management plane** is the set of APIs and consoles through which you manage the entire cloud. It is the "crown jewel": whoever controls it controls everything.
- **Orchestration** ties the automation of multiple steps (e.g., deploying an application = network + VM + database + DNS) into a single flow.

## Cloud computing activities (ISO/IEC 17789)

ISO/IEC 17789 describes activities by role. For the exam it is important to understand that **each role has its own set of activities**:

| Role | Typical activities |
|---|---|
| Cloud service customer | using the service, administration (users, access), business management (contract, payment), integration with its own systems |
| Cloud service provider | preparing and running the service (operations), deployment, security management, network management, monitoring, customer relationship management, peering with other CSPs |
| Cloud service partner | developing services (developer), auditing (auditor), intermediation (broker) |

## Cloud service capabilities

ISO/IEC 17788 distinguishes **capability types** (what the customer gets) from **service categories** (how the service is packaged):

| Capability type | What the customer controls | Typical category |
|---|---|---|
| **Application capabilities** | only use of the application and user settings | SaaS |
| **Platform capabilities** | deploying and managing its own applications on a runtime provided by the provider | PaaS |
| **Infrastructure capabilities** | processing, storage and networking; the customer manages the OS and everything above it | IaaS |

## Service categories: SaaS, PaaS, IaaS

| | IaaS | PaaS | SaaS |
|---|---|---|---|
| The customer gets | VMs, network, storage | runtime, middleware, managed database | a ready-made application |
| The customer manages | OS, OS patches, middleware, application, data, IAM, network rules | code, application configuration, data, IAM | data, users and access, tenant configuration |
| The provider manages | physical layer, hypervisor, data center network | + OS, runtime, platform patches | + application |
| Customer control | highest | medium | lowest |
| Examples | EC2, Azure VM, GCE | Elastic Beanstalk, App Service, Lambda (often FaaS), Cloud Run | Microsoft 365, Salesforce, Workday |
| Key risk | misconfigured OS, unpatched VMs | code security, vendor lock-in to platform APIs | weak IAM control, leakage through sharing, lack of visibility |

In **all** models the customer remains responsible for **data**, **identities and access** and **classification**. That is the basis of the **shared responsibility model**.

Other "as a Service" categories that ISO/IEC 17788 mentions: **CaaS** (Communications as a Service), **CompaaS** (Compute as a Service), **DSaaS** (Data Storage as a Service), **NaaS** (Network as a Service). In practice you also encounter **FaaS** (serverless), **DBaaS**, **SECaaS** (Security as a Service) and **AIaaS**.

> **On the exam:** always run responsibility questions through the question "who manages that layer?". Patching the OS on EC2 is the **customer's** responsibility (IaaS). Patching the OS under Azure App Service is the **provider's** responsibility (PaaS). Configuring document sharing in Microsoft 365 is the **customer's** responsibility (SaaS), even though the provider manages everything else.

## Deployment models

| Model | Description | Advantages | Disadvantages / risks |
|---|---|---|---|
| **Public** | infrastructure available to the general public, owned by the CSP | low entry cost, elasticity, global reach | multi-tenancy, less control, data location questions |
| **Private** | infrastructure for a single organization only; can be on-prem or at a third party | control, compliance, customization | expensive, limited elasticity, the organization carries all operations |
| **Community** | shared by several organizations with common interests (mission, regulation) | cost sharing within a controlled group | governance and responsibility among members must be clearly contracted |
| **Hybrid** | a combination of two or more distinct models bound together by technology that enables data and application portability | **cloud bursting**, gradual migration, sensitive data stays private | complexity, consistency of IAM and policies across the boundary |
| **Multi-cloud** | using multiple public providers | avoiding lock-in, resilience, best service for each purpose | more tools, more skills, fragmented visibility and policies |

**Hybrid** and **multi-cloud** are not the same: hybrid mixes **types** (e.g., private + public), multi-cloud uses **multiple providers** (e.g., AWS + Azure). An organization can be both.

Example scenario: a hospital keeps patient records in a private data center because of regulation, but runs analytics on anonymized data in the public cloud. That is **hybrid**. A group of five regional banks jointly builds infrastructure for a payment system with the same regulatory requirements: that is **community**.

## Cloud shared considerations

ISO/IEC 17788 calls them **cross-cutting aspects**: topics that apply to all roles and all models.

| Consideration | The question you ask | How it is addressed |
|---|---|---|
| **Interoperability** | can systems of different providers and my own systems work together and exchange data? | open standards and APIs, standard formats |
| **Portability** | can I move data and applications to another provider with minimal effort? | containers, IaC, data export in open formats |
| **Reversibility** | can I **exit** the service, get my data back and receive confirmation that it was deleted at the CSP? | exit clauses in the contract, an exit plan, deadlines for return and deletion |
| **Availability** | is the service available when I need it? | SLA, multi-AZ/multi-region, BC/DR |
| **Security** | are the CIA objectives met? | shared responsibility, controls, audit |
| **Privacy** | is personal data protected according to the law? | DPA, data residency, minimization |
| **Resiliency** | can the service withstand a failure and recover? | redundancy, failover, chaos testing |
| **Performance** | does the service meet speed and capacity requirements? | SLA metrics, monitoring, region selection |
| **Governance** | who makes decisions, under which policies, with what oversight? | policies, roles, guardrails, approval processes |
| **Maintenance and versioning** | how does the CSP change services and APIs, and how far in advance does it notify? | contractual notices, deprecation policies, testing |
| **Service levels and SLA** | what is guaranteed and what happens if it is not met? | measurable metrics, penalties (service credits) |
| **Auditability** | can I or an independent auditor obtain evidence of controls? | SOC 2, ISO 27001, logs, right to audit |
| **Regulatory** | which laws and regulations apply to the data and services? | mapping requirements, choice of jurisdiction |
| **Outsourcing** | what am I transferring to a third party and how do I retain control? | vendor management, contract, oversight |

Three terms are most often confused:

- **Interoperability**: systems work **together** (e.g., a SIEM in AWS reads logs from Azure).
- **Portability**: a system **moves** from one platform to another.
- **Reversibility**: the customer **exits** the cloud service and gets its data back, and the CSP deletes it within the agreed period.

> **On the exam:** "The organization wants to ensure that after the contract is terminated it gets all its data back and the provider deletes it within 30 days. Which concept does this refer to?" The answer is **reversibility**, not portability. Portability would be correct if the emphasis were on moving to another provider without rework.

### SLA in brief

A **Service Level Agreement (SLA)** is the part of a contract with measurable commitments: availability (e.g., 99.95% monthly), support response time, RTO/RPO for managed services, log retention. Alongside the SLA come **SLOs** (objectives) and **SLIs** (measured indicators). The typical remedy for a missed SLA is a **service credit**, which rarely covers the actual business loss: that is why BC/DR planning remains the customer's responsibility.

## Impact of related technologies

| Technology | What it is | Security aspects in the cloud |
|---|---|---|
| **Data science** | extracting knowledge from large data sets | concentration of sensitive data in data lakes, controlling analysts' access |
| **Machine learning (ML)** | systems that learn from data without being explicitly programmed | data poisoning, quality and provenance of training data, the model as an asset |
| **Artificial intelligence (AI)** | the broader field of systems that imitate human reasoning, including generative AI | prompt injection, data leakage through prompts, hallucinations, regulation (EU AI Act) |
| **Blockchain** | a distributed, immutable (append-only) ledger with consensus | integrity and nonrepudiation, but a problem with the "right to erasure" (GDPR) and protecting private keys |
| **Internet of Things (IoT)** | a huge number of devices sending data to the cloud | weak device authentication, firmware patching, a huge number of entry points |
| **Containers** | lightweight application isolation by sharing the host kernel | weaker isolation than VMs, vulnerable images, supply chain, the orchestrator as a target |
| **Quantum computing** | computers that can break RSA/ECC (Shor's algorithm) and weaken symmetric ciphers (Grover) | **harvest now, decrypt later**; transition to **post-quantum cryptography** (NIST FIPS 203/204/205) |
| **Edge computing** | processing close to the data source (at the network edge) for lower latency | physical security of edge devices, distributed management, policy synchronization |
| **Confidential computing** | protecting data **in use** in a hardware-isolated environment (**Trusted Execution Environment, TEE**) | protects against CSP administrators and a compromised hypervisor; examples: AMD SEV-SNP, Intel TDX/SGX, AWS Nitro Enclaves |

Context to remember:

- Encryption protects data **at rest** and **in transit**; **confidential computing** closes the third state: **data in use**.
- Quantum risk is not only a future one: an adversary records encrypted traffic today and waits. That is why the move to PQC for long-term confidential data is being planned now (crypto-agility, a cryptographic inventory).
- **Fog computing** is an intermediate layer between the edge and the cloud; it sometimes appears as a distractor.

> **On the exam:** "An organization processes medical data in the public cloud and does not want even the provider's administrators to be able to see the data during processing. Which technology fits BEST?" Encryption at rest and TLS are correct, but they do not protect data **while it is being processed**. The answer is **confidential computing (TEE)**.

## Building blocks in more detail: virtualization and hypervisors

Virtualization is the technology that makes the cloud economically possible. A **hypervisor** (Virtual Machine Monitor) divides a physical host into multiple isolated virtual machines.

| | Type 1 (bare-metal) | Type 2 (hosted) |
|---|---|---|
| Where it runs | directly on the hardware | as an application on a host OS |
| Examples | ESXi, Hyper-V, KVM, Xen, Nitro | VirtualBox, VMware Workstation |
| Attack surface | smaller (no general-purpose OS underneath) | larger (host OS vulnerabilities) |
| Use | public and private cloud | development, testing, desktop |

Cloud providers use **Type 1** hypervisors. The most serious threat is **VM escape**: an attacker breaks out of a guest machine into the hypervisor and gains access to other tenants. That is why isolation between tenants is the CSP's responsibility, and the customer verifies it through audit reports, not through its own testing of the hypervisor.

Containers share the **host kernel**, so isolation is weaker than with VMs. Serverless (FaaS) goes a step further: the customer sees only the function, while the runtime, OS and scaling are on the provider. More on virtualization security in the next module (1.3).

## Building blocks in more detail: storage, networking, databases and orchestration

Storage in the cloud comes in several forms (in detail in the data module, objective 2.2):

- **object storage**: files as objects with metadata in a flat namespace, accessed through an API (S3, Blob),
- **volume/block storage**: a virtual disk attached to a VM (EBS, Managed Disks),
- **file storage**: a shared file system (NFS/SMB: EFS, Azure Files),
- **ephemeral storage**: a local disk that disappears when the instance is shut down.

Networking in the cloud is almost always **software-defined**: virtual networks (VPC/VNet), subnets, routing tables and filters (security groups, NACLs) exist as API objects. The advantage is that network policy can be versioned and reviewed like code; the drawback is that a single wrong change through the API can expose the entire environment to the internet.

Databases are offered as **DBaaS**: the provider patches the engine and handles backup and replication, while the customer is responsible for the schema, access, encryption (choice of key) and data.

Orchestration and **Infrastructure as Code (IaC)** make it possible to describe the entire environment declaratively. For security this means **repeatability** (the same secure baseline every time), **review** (code review and static analysis before deployment) and fast recovery (rebuilding from code).

> **On the exam:** when a question asks for the GREATEST risk in the cloud as a whole and the **management plane** (console/API) is offered, that is usually the correct answer: compromised administrative credentials give control over all resources at once. That is why MFA, least privilege and logging of API calls are the first line of defense.

## Cloud bursting, governance and outsourcing

**Cloud bursting** is a hybrid pattern: an application runs in a private cloud, and when the load exceeds capacity, the excess "spills over" into the public cloud. Security prerequisites:

- the same identity system (federation) and the same policies in both environments,
- an encrypted connection (VPN or private link),
- data classification that determines what is allowed to cross into the public part.

**Governance** in the cloud means that the organization retains control over decisions even though operations are at the provider. Key elements:

| Element | Example |
|---|---|
| Policies | allowed regions, mandatory encryption, approved services |
| Roles and responsibilities | a RACI matrix between the customer, the CSP and the broker |
| Guardrails | preventive controls at the organization level (e.g., SCPs in AWS Organizations, Azure Policy) |
| Oversight | continuous compliance checking, reports to management |
| Vendor management | assessing the CSP before contracting and periodically (objective 1.5) |

**Outsourcing** to a CSP transfers the **execution** of a service, but not the **risk** as a whole. The organization must know what it has transferred, how it monitors it and what it does if the supplier fails. Special attention should be paid to the **chain of subcontractors** (fourth parties): a SaaS provider running on another provider's IaaS adds one more link with which the customer has no direct contract.

### Maintenance and versioning

The provider changes services constantly: new API versions, retirement of old ones (deprecation), changes to default settings. The customer should:

- define in the contract a **notice period** for significant changes,
- follow the provider's announcements (release notes, roadmap),
- test applications on new versions in a non-production environment,
- know when maintenance is planned (**maintenance window**) and how it affects the SLA.

### SLA metrics

| Metric | What it measures | Example |
|---|---|---|
| Availability / uptime | the percentage of time the service is available | 99.9% = about 43 minutes of downtime per month |
| Response time | the reaction time of support or the system | P1 incident: response within 15 minutes |
| Throughput / performance | processing capacity | X requests per second |
| Data durability | the probability that data will not be lost | 99.999999999% (11 nines) |
| Incident notification | the deadline for notification of a security incident | 24 or 72 hours |
| Data return / deletion | the deadline for returning and deleting data after termination | 30 days |

> **On the exam:** if the SLA guarantees 99.9% and the business requires 99.99%, **the contract by itself does not solve the problem**. The best answer is an architecture that makes it possible (multiple zones/regions or multiple providers) and a BC/DR plan, not just asking for bigger service credits.

## Quantum computing and post-quantum cryptography

A sufficiently large quantum computer (a so-called **CRQC**, cryptographically relevant quantum computer) would:

- with Shor's algorithm, break asymmetric cryptography based on factoring and the discrete logarithm (**RSA, DH, ECC**),
- with Grover's algorithm, halve the effective length of a symmetric key (AES-128 → about 64 bits of security, while AES-256 remains strong enough).

In 2024 NIST published the first PQC standards: **FIPS 203 (ML-KEM)** for key establishment, **FIPS 204 (ML-DSA)** and **FIPS 205 (SLH-DSA)** for digital signatures. For a cloud architect, the practical steps are:

1. **a cryptographic inventory** (where RSA/ECC is used: TLS, signatures, KMS, PKI),
2. **crypto-agility** (the ability to replace an algorithm without redesigning the system),
3. tracking provider support (hybrid TLS with ML-KEM already exists at the large CSPs),
4. prioritizing data with a long confidentiality lifetime.

## Edge, IoT and containers in practice

- **IoT** in the cloud typically goes through managed services (e.g., AWS IoT Core, Azure IoT Hub) with a **certificate per device**. The biggest risks are default passwords, the inability to patch and physical access to the device.
- **Edge** moves part of the processing closer to the user (CDN functions, local zones, devices in a factory). Controls must be as strong as in the central cloud, but they are managed centrally.
- **Containers** are the foundation of modern portability: the same image runs on any Kubernetes cluster. This helps portability and interoperability, but introduces supply chain risks (untrusted base images) and requires image scanning and signing.

## Example scenario: from definition to decision

A mid-sized insurance company plans to move its CRM system to the cloud. Management asks the security architect for a recommendation.

1. **Service category**: CRM exists as SaaS (Salesforce, Dynamics). The company has no development team, so SaaS is the logical choice because it transfers the most operational responsibility.
2. **Roles**: the company is the **cloud service customer** and the **data controller**; the SaaS provider is the CSP and the **data processor**; the intermediary that builds the integration with the core system is a **cloud service partner** (broker/integrator).
3. **Shared considerations**: check **reversibility** (export of all data and deletion after termination), **auditability** (SOC 2 Type II, ISO 27001), **regulatory** (where the data is, GDPR), **SLA** (availability, support).
4. **Accountability**: regardless of the choice, accountability for client data stays with the insurance company.

The architect does not start from tools but from business requirements and risk, then chooses the service model and deployment model, and only then the controls.

## Second scenario: choosing a deployment model

A national statistics agency and three ministries have the same requirements: the data must remain in the country, only vetted officials have access, and the system must handle peak load during the population census.

| Option | Assessment |
|---|---|
| Public cloud in a region outside the country | rejected: violates the data location requirement |
| A separate private cloud for each institution | meets the requirements, but at four times the cost and without sharing capacity |
| **Community cloud** for all four institutions | they share costs and common regulatory requirements; recommended |
| Community + bursting anonymized aggregates into public | possible for peak load, with strict classification |

Key questions the architect asks: who owns the infrastructure and who is the operator, how are costs and responsibilities shared, how are disputes resolved and what happens when one institution leaves (**reversibility** within the community).

## Quick guide: keyword in the question → term

| If the question says… | ISC2 expects |
|---|---|
| "without contacting the provider, through a portal" | on-demand self-service |
| "access from any device over the internet" | broad network access |
| "the exact location of resources is unknown" | resource pooling (location independence) |
| "multiple customers on the same hardware" | multi-tenancy |
| "automatically grows and shrinks" | rapid elasticity |
| "paid per use" | measured service |
| "an intermediary that chooses the cheapest provider" | cloud broker – service arbitrage |
| "independent assessment of the provider's controls" | cloud auditor |
| "network operator between the customer and the CSP" | cloud carrier (NIST) |
| "move an application to another provider" | portability |
| "systems of two providers exchange data" | interoperability |
| "return data and confirm deletion after termination" | reversibility |
| "protecting data during processing from CSP admins" | confidential computing |
| "record today, decrypt tomorrow" | quantum – harvest now, decrypt later |

> **On the exam:** ISC2 likes answers that start from **business requirements and risk**. If two options are technically correct and one says "first determine requirements / classify the data / assess the risk", that one is often the BEST or FIRST answer.

## Common traps

| Distractor | Why it is wrong |
|---|---|
| "The CSP is responsible for data in SaaS because it manages the application." | data, access and classification are always on the customer |
| "Multi-cloud and hybrid cloud are synonyms." | hybrid = multiple deployment types, multi-cloud = multiple providers |
| "A private cloud must be on-premises." | a private cloud can be hosted by a third party; what matters is that it serves a single organization |
| "Elasticity and scalability are the same." | elasticity is automatic adjustment in both directions |
| "An SLA service credit protects the business from loss." | the credit is usually small and does not replace BC/DR |
| "Portability means exiting the contract." | that is reversibility |

## Summary

- **NIST SP 800-145**: 5 characteristics, 3 service models, 4 deployment models. **ISO/IEC 17788** adds **multi-tenancy** as a sixth characteristic; **ISO/IEC 17789** defines roles and activities.
- Roles: **customer, provider, partner** (developer, auditor, broker) and **regulator**; NIST adds the **carrier**. Accountability for data stays with the **customer**.
- Characteristics: **on-demand self-service, broad network access, resource pooling, multi-tenancy, rapid elasticity/scalability, measured service**, each with its own security consequence.
- Building blocks: **virtualization, storage, networking (SDN), databases, orchestration**; the **management plane** is the most critical point.
- **Capability types** (application, platform, infrastructure) ↔ **categories** (SaaS, PaaS, IaaS). The "higher" the model, the less the customer controls, but **data and IAM are always theirs**.
- Deployment: **public, private, community, hybrid, multi-cloud**; hybrid ≠ multi-cloud.
- Shared considerations: in particular, distinguish **interoperability** (working together), **portability** (moving) and **reversibility** (exit and deletion).
- Related technologies: AI/ML, blockchain, IoT, containers, **quantum** (PQC, harvest now decrypt later), **edge**, **confidential computing** (data in use, TEE).
