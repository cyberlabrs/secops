## Exam objectives: 3.1, 3.2, and 3.3

Domain 3 (**Cloud Platform and Infrastructure Security**) carries 17% of the questions. This module looks at infrastructure from two angles: as a **cloud customer** who must understand what it runs on, and as a **provider or an organization building a private cloud** that designs a data center. Objectives and sub-points:

- **3.1 Comprehend cloud infrastructure components**
  - physical environment,
  - virtualization,
  - network and communications,
  - storage,
  - compute,
  - management plane.
- **3.2 Design a secure data center**
  - logical design (tenant partitioning, access control),
  - physical design (location, buy or build),
  - environmental design (HVAC, multi-vendor pathway connectivity),
  - design resilient (power, HVAC, connectivity).
- **3.3 Analyze risks associated with cloud infrastructure and platforms**
  - risk assessment (identification, analysis),
  - cloud vulnerabilities, threats, and attacks,
  - risk mitigation strategies.

Controls (3.4) and BC/DR (3.5) are in the next module.

## Cloud infrastructure components (3.1)

Every cloud, public or private, consists of the same layers. The difference is who manages which layer.

| Component | What it includes | Who is responsible in the public cloud |
|---|---|---|
| **Physical environment** | Data centers, buildings, power, cooling, servers, network equipment, cabling | Provider (in all models) |
| **Virtualization** | Hypervisor, container runtime, hardware abstraction | Provider; the customer configures guests (IaaS) |
| **Network and communications** | Physical network, SDN, virtual networks, load balancers, DNS, connections to on-prem | Shared: provider the physical and SDN infrastructure, customer the virtual networks and rules |
| **Storage** | Block, file, object storage, databases | Provider the infrastructure; customer the data, access, encryption |
| **Compute** | VMs, containers, serverless functions | IaaS: customer the OS and applications; PaaS/SaaS: increasingly the provider |
| **Management plane** | Console, API, CLI, orchestration and provisioning tools | The provider supplies it; the customer protects access to its tenant |

### Physical environment

The physical environment is the foundation: if an attacker has physical access, all logical controls can be bypassed. In the public cloud, the customer has no access to the data center and no right to a physical audit; trust is built through **third-party reports** (SOC 2 Type II, ISO/IEC 27001, CSA STAR). The provider designs the data center for scale: thousands of identical servers, standardized equipment, automated replacement of failures.

### Virtualization

A **hypervisor** (virtual machine monitor) divides physical hardware among multiple virtual machines.

| Type | Description | Examples | Security |
|---|---|---|---|
| **Type 1 (bare metal)** | Runs directly on the hardware | VMware ESXi, Xen, KVM, Hyper-V, AWS Nitro | Smaller attack surface; the standard in the cloud |
| **Type 2 (hosted)** | Runs as an application on a host OS | VirtualBox, VMware Workstation | The host OS is an additional attack surface; for desktop and development |

Virtualization risks:

- **VM escape**: code from a guest breaks through the hypervisor and gains access to the host or other guests; the worst scenario for multi-tenancy,
- **hypervisor compromise**: whoever controls the hypervisor controls all guests,
- **side-channel attacks** via shared hardware (processor cache, e.g., the Spectre/Meltdown class),
- **VM sprawl**: uncontrolled proliferation of VMs without owners and patches,
- dormant VMs and old images with vulnerabilities,
- **noisy neighbor**: one tenant consumes resources and degrades others (an availability threat).

| Attribute | Virtual machine | Container | Serverless function |
|---|---|---|---|
| Isolation | Hypervisor, own kernel | Shared kernel, namespaces and cgroups | Provider (often a micro-VM) |
| Size and startup | GB, minutes | MB, seconds | Milliseconds to seconds |
| Customer responsibility | OS, patching, application | Image, runtime configuration, orchestration | Code, dependencies, permissions |
| Typical risk | Unpatched OS, sprawl | Privileged containers, vulnerable images | Overly broad permissions, vulnerable libraries |

**Containers** share the host kernel, so isolation is weaker than between VMs; that is why providers often run containers of different tenants in separate VMs or micro-VMs (e.g., Firecracker for AWS Lambda and Fargate).

### Network and communications

Cloud networks are **software-defined**. **SDN (Software-Defined Networking)** separates:

- the **control plane**: decides where traffic goes (rules, routes), centralized and programmable,
- the **data plane**: actually forwards packets.

Advantages: automation, microsegmentation, rapid change. Risk: compromise of the SDN controller affects the entire network, so the controller is protected like the management plane.

Other elements: tenant isolation through overlay networks (VXLAN, GENEVE) instead of only VLANs (VLAN is limited to 4094 IDs), virtual private networks (VPC/VNet), security groups and network ACLs, private connections to on-prem (IPsec VPN, dedicated links), DNS, load balancers, CDN, and DDoS protection. On the exam, also expect the concept of **microsegmentation** and zero trust access (see Domain 1).

### Storage

ISC2 classifies storage by service model, and this is asked:

| Model | Storage type | Description |
|---|---|---|
| **IaaS** | **Volume storage** (block) | A virtual disk attached to a VM (EBS, Azure Managed Disk) |
| | **Object storage** | Objects with metadata via an API (S3, Azure Blob) |
| | **Ephemeral storage** | A temporary disk that disappears with the instance |
| **PaaS** | **Structured** | Relational databases and managed databases |
| | **Unstructured** | Big data, objects, NoSQL |
| **SaaS** | **Information storage and management** | Data entered through the application, in a database run by the provider |
| | **Content and file storage** | Files stored in the application (e.g., document sharing) |
| All | **CDN** | Cached copies of content at edge locations |

Threats to storage: unauthorized access and misconfiguration (public bucket), data loss, data remanence, ransomware, loss of keys. For resilience, providers use replication and **data dispersion** (erasure coding: data is split into fragments with parity distributed across multiple locations, so losing some fragments does not mean losing the data).

### Compute

Compute resources are VMs, containers, and serverless functions. The provider manages allocation through:

| Mechanism | Meaning |
|---|---|
| **Reservations** | A guaranteed minimum of resources for a guest |
| **Limits** | The maximum a guest can consume |
| **Shares** | Priority when competing for resources when there are not enough |

These mechanisms protect availability (against the noisy neighbor effect). For the customer, compute security in IaaS means image hardening, patching, protecting instance metadata (IMDSv2 in AWS), while in serverless the focus shifts to code, dependencies, and permissions.

### Management plane

The **management plane** is the set of tools and APIs used to manage the entire cloud environment: creating and deleting resources, networks, identities, keys. It is the **most critical component**: compromise of the management plane means compromise of everything in the tenant, without any need for a vulnerability in the application.

Protecting the management plane (from the customer's perspective):

- **MFA** for everyone, especially privileged accounts; protection of root/global admin accounts (break-glass procedure),
- **least privilege** and separation of duties, temporary (JIT) permissions,
- federation with the corporate IdP instead of local accounts,
- **logging of all API calls** (CloudTrail, Azure Activity Log) to immutable storage,
- protection and rotation of API keys; prefer short-lived credentials,
- organization-level restrictions (SCP, Azure Policy) that even the account administrator cannot bypass.

The provider, for its part, protects its internal management plane (access to hypervisors, operator tools) with strong network separation and strictly controlled staff access.

### Responsibility by component and service model

| Component | IaaS | PaaS | SaaS |
|---|---|---|---|
| Physical environment | Provider | Provider | Provider |
| Virtualization / hypervisor | Provider | Provider | Provider |
| Network (virtual) | Customer configures | Partly customer (access, endpoints) | Provider |
| Guest OS | Customer | Provider | Provider |
| Runtime, middleware | Customer | Provider | Provider |
| Application | Customer | Customer | Provider |
| Data, identities, access | Customer | Customer | Customer |

The "data, identities, access" row is always the customer's, regardless of the model. That is the key message of the shared responsibility model.

> **On the exam:** if a question asks for the component whose compromise has the GREATEST impact on a cloud customer, the answer is the **management plane** (console and API with administrative rights). Protection starts with **MFA, least privilege, and logging** of administrative access.

## Designing a secure data center (3.2)

This objective is relevant for the provider, for an organization building a private cloud, and for a customer evaluating a provider or colocation.

### Logical design

| Element | Description |
|---|---|
| **Tenant partitioning** | Tenant isolation: separate virtual networks, hypervisor isolation, separate encryption keys per tenant, logical storage partitions; dedicated hosts where needed |
| **Access control** | Who may manage which infrastructure: RBAC for operators, separate administrator accounts, PAM, JIT access, MFA |
| **Separate networks** | Management network separated from the tenant network and the storage network; out-of-band management |
| **Secure baselines** | Standardized, hardened configurations of hosts and hypervisors |
| **Logging and monitoring** | All administrative access to the infrastructure is logged and monitored |

Logical design should also enable **API-driven** management, automation, and compliance checking, because manual operations do not work at scale.

### Physical design: location

Choosing a location is a risk decision:

| Factor | Question |
|---|---|
| Natural hazards | Floods, earthquakes, hurricanes, wildfires; distance from rivers and fault lines |
| Human-made hazards | Proximity to airports, chemical plants, highways carrying hazardous cargo |
| Infrastructure | Reliability of the power grid, multiple independent power feeds, availability of water for cooling, telecom connections |
| Law and politics | Jurisdiction, political stability, data laws, tax incentives |
| Climate | A colder climate reduces cooling costs (free cooling) |
| People and logistics | Availability of qualified staff, access for service and fuel |
| Distance between sites | Far enough that the same disaster does not hit both centers, close enough for replication latency |

Within the site: perimeter (fences, vehicle barriers, lighting), controlled entrances (mantrap, biometrics), zones with increasing access control, video surveillance, security guards, an unmarked building, fire protection (detection, gas-based suppression in server rooms), cable pathways.

### Buy, build, or lease

| Option | Advantages | Disadvantages |
|---|---|---|
| **Build** (build your own) | Full control over design, location, and security | High upfront cost (CapEx), long construction time, expertise required |
| **Buy** (buy an existing one) | Faster than building | You inherit the design and limitations; detailed due diligence required |
| **Lease / colocation** | Low upfront cost, quick start, the provider builds and maintains the building | Shared site, less control, reliance on the contract and reports |
| **Public cloud** | No data center at all, elasticity | Least control over the physical layer, dependence on the provider |

The decision is a business one: cost, risk, compliance requirements, timeframe, and strategy.

### Environmental design: HVAC

**HVAC (Heating, Ventilation, and Air Conditioning)** keeps temperature and humidity within the limits the equipment can tolerate.

- **ASHRAE** guidelines (TC 9.9) give a recommended inlet air temperature range for IT equipment of **18 to 27 °C** (64.4–80.6 °F) and humidity limits via the dew point; too much humidity leads to condensation and corrosion, too little to static electricity.
- **Hot aisle / cold aisle** rack layout: the fronts of the racks face the cold aisle, the backs face the hot aisle; **containment** (enclosing the aisles) prevents air mixing.
- Redundant cooling units, sensor monitoring, efficiency measured through **PUE** (Power Usage Effectiveness = total facility energy / IT equipment energy; ideally 1.0).

### Multi-vendor pathway connectivity

Connectivity to the internet and other sites must be resilient:

- multiple **independent telecom providers** (multi-vendor),
- cables enter the building through **physically separate entrances and routes** (diverse pathways), so that one excavator does not cut all links,
- verification that the two providers do not share the same physical route or the same central office (otherwise redundancy exists only on paper),
- redundant network equipment and routes (BGP with multiple providers).

> **On the exam:** "two ISPs" is not the same as resilient connectivity. If both links run through the same cable route or the same building entrance, there is a **single point of failure**. The BEST answer requires **physically separate paths** from different providers.

### Resilient design

Resilience is built through redundancy in power, cooling, and connectivity. Notation:

| Notation | Meaning |
|---|---|
| **N** | Exactly as much capacity as needed; no redundancy |
| **N+1** | One spare component more than needed |
| **2N** | A fully duplicated system (two independent paths) |
| **2N+1** | A duplicated system plus one additional spare component |

Power:

- two independent power feeds from different substations where possible,
- a **UPS** bridges the outage until the generator takes over (seconds to minutes) and protects against power quality issues,
- **generators** with on-site fuel for several hours or days and priority fuel delivery contracts,
- **PDUs** and dual power supplies in servers connected to separate paths (A and B).

The **Uptime Institute Tier** classification (very common on the exam):

| Tier | Name | Key characteristic | Commonly cited availability |
|---|---|---|---|
| **I** | Basic Capacity | Single path, no redundant components; maintenance requires shutdown | 99.671% |
| **II** | Redundant Capacity Components | Redundant components (N+1), but a single distribution path | 99.741% |
| **III** | Concurrently Maintainable | Every component can be maintained without shutdown; multiple paths (one active) | 99.982% |
| **IV** | Fault Tolerant | Tolerates any single failure without impact; multiple active, physically separated paths (2N) | 99.995% |

The Uptime Institute officially defines tiers by **topology and behavior**, and the availability percentages are an industry approximation. A similar classification is provided by **ANSI/TIA-942** (Rated 1–4), and **BICSI 002** covers design best practices.

> **On the exam:** distinguish **concurrently maintainable** (Tier III: planned maintenance without interruption) from **fault tolerant** (Tier IV: an unplanned failure of any component without interruption). If the scenario requires that the failure of a single component not interrupt operations, Tier IV is required.

### Questions for evaluating a provider's or colocation data center

A customer who cannot visit the data center asks questions through questionnaires (e.g., the **CSA CAIQ**) and verifies the answers in audit reports:

- What Uptime Tier or TIA-942 rating does the facility have, and is the design certified or the constructed facility as well?
- What is the redundancy of power and cooling (N+1, 2N), and how many hours of fuel are on site?
- How many independent telecom providers and physically separate entrances are there?
- How is physical access control handled, and who has access (including subcontractors)?
- How often are generators and failover to backup power tested?
- How are faulty disks sanitized and destroyed?
- Which independent reports cover the facility (SOC 2 Type II, ISO/IEC 27001)?

## Cloud infrastructure risk analysis (3.3)

### Risk assessment

The process according to **ISO 31000** and **NIST SP 800-30**:

1. **Identification**: assets (data, systems, services), threats, vulnerabilities, existing controls.
2. **Analysis**: likelihood and impact.
3. **Evaluation**: comparison with **risk appetite** (how much risk the organization generally accepts) and **risk tolerance** (acceptable deviation).
4. **Treatment**, monitoring, and reporting (risk register).

| Analysis | How | Advantage | Disadvantage |
|---|---|---|---|
| **Qualitative** | Scales (low/medium/high), likelihood and impact matrix | Fast, understandable, does not need precise data | Subjective |
| **Quantitative** | Monetary amounts and frequencies | More objective, suitable for cost-benefit | Requires data that often does not exist |

Quantitative formulas:

- **SLE** (Single Loss Expectancy) = **AV** (Asset Value) × **EF** (Exposure Factor),
- **ALE** (Annualized Loss Expectancy) = SLE × **ARO** (Annualized Rate of Occurrence).

Example: a database is worth 500,000 KM, a leak would destroy 40% of its value (EF 0.4): SLE = 200,000 KM. It is expected once every five years (ARO 0.2): ALE = 40,000 KM. A control that costs 60,000 KM per year and reduces the ALE to 10,000 KM is not cost-effective (savings of 30,000 KM < cost of 60,000 KM).

In the cloud, risk assessment also includes **the risks of the cloud decision itself**: dependence on the provider, jurisdiction, loss of control and visibility, multi-tenancy.

> **On the exam:** before choosing a control, the manager **assesses the risk** (identification and analysis), and the control must cost less than the risk it reduces. The answer "immediately introduce the strongest technical control" without an assessment is usually wrong.

### Cloud vulnerabilities, threats, and attacks

The CSA **Top Threats to Cloud Computing** (2024 edition) emphasizes that the greatest risks today are mostly on the customer's side:

| Threat (CSA 2024) | Example |
|---|---|
| Misconfiguration and inadequate change control | Public bucket, open database, overly broad security group |
| Identity and access management | Overly broad permissions, stolen keys, no MFA |
| Insecure interfaces and APIs | An API without authentication or rate limiting |
| Inadequate cloud security strategy | Lift-and-shift without adapting controls |
| Insecure third-party resources | Compromised libraries, images, SaaS integrations |
| Insecure software development | Secrets in code, vulnerable dependencies |
| Accidental cloud data disclosure | Wrongly shared links, snapshots |
| System vulnerabilities | Unpatched OS and software |
| Limited cloud visibility | No logs, shadow IT |
| Unauthenticated resource sharing | Public links, public snapshots |
| Advanced persistent threats (APT) | Targeted, long-lasting attacks |

Risks specific to cloud infrastructure and platforms:

| Category | Risks |
|---|---|
| Multi-tenancy | VM escape, side-channel, incomplete isolation, noisy neighbor |
| Management plane | Takeover of an administrator account, abuse of API keys |
| Provider | Insider at the provider, bankruptcy, service discontinuation, change of terms |
| **Vendor lock-in** | Proprietary formats and services make migration harder; a risk to portability and BC |
| Legal | Jurisdiction, requests from foreign authorities, eDiscovery over shared infrastructure |
| Availability | Regional outages, DDoS, resource exhaustion, provider configuration errors |
| Data | Data remanence, inadequate deletion, leakage through poorly shared resources |
| Supply chain | Compromised images from the marketplace, hardware components |

Attacks you need to recognize: credential theft and API abuse, cryptomining on compromised accounts, ransomware against cloud storage, DDoS and **economic denial of sustainability** (an attack that drives autoscaling and generates a huge bill), VM escape, side-channel, SSRF against the instance metadata service.

### Risk treatment strategies

| Strategy | Description | Cloud example |
|---|---|---|
| **Avoid** | Abandon the activity that carries the risk | Do not move regulated data to the public cloud |
| **Mitigate / reduce** | Introduce controls that reduce likelihood or impact | Encryption, MFA, multi-region architecture |
| **Transfer / share** | Transfer the financial impact to a third party | Cyber insurance, contractual obligations and the provider's SLA credits |
| **Accept** | Consciously accept a risk within appetite, with the risk owner's approval | Accept the risk of a short outage of a non-critical service |

Examples of treatment for typical infrastructure risks:

| Risk | Mitigation | Transfer | Acceptance (when) |
|---|---|---|---|
| Management plane compromise | MFA, PAM, SCP, logging | Insurance | Never without mitigation |
| Regional outage | Multi-region, DR plan | SLA credits (only partially) | Non-critical systems with a long RTO |
| Vendor lock-in | Portable formats, IaC, exit strategy | Contractual exit clauses | When the benefit of proprietary services outweighs the risk |
| VM escape / side-channel | Patching, dedicated hosts for sensitive workloads | Contractual liability of the provider | For low-sensitivity data |

Important nuances:

- **accountability cannot be transferred**: the customer remains responsible for its data and compliance even when it uses a provider or insurance,
- **residual risk** is what remains after treatment and must be formally accepted,
- risk acceptance is approved by the **risk owner** (management), not the technical team,
- ignoring risk is not a strategy.

> **On the exam:** "The company bought cyber insurance and moved its data to the cloud, so it is no longer responsible for a leak" is false. Transfer shifts the **financial impact**, not the **accountability** to the regulator and clients.

## Scenario: a regional provider builds a private cloud

A regional telecom is building a private cloud for the public sector.

1. **Components**: a Type 1 hypervisor on standardized servers, SDN with a separate management network, object and block storage with erasure coding, a portal and API as the management plane with MFA and logging.
2. **Location**: a riverside site was rejected (flood zone); a site with two power feeds from different substations and two telecom routes was selected.
3. **Build vs colocation**: because of sovereignty and control requirements, building its own facility is chosen; a second site for DR is in a colocation facility 120 km away.
4. **Resilience**: target Tier III (concurrently maintainable), UPS + generators with fuel for 72 hours, N+1 cooling with hot/cold aisle containment.
5. **Logical design**: tenant partitioning through separate virtual networks and keys per tenant; operators use PAM with JIT access.
6. **Risk**: VM escape, management plane compromise, and a regional power outage were identified. Treatment: mitigation (hypervisor patching, MFA and PAM, generators), transfer (insurance), acceptance of residual risk by management.

## Summary

- Cloud infrastructure: **physical environment, virtualization, network, storage, compute, management plane**; the management plane is the most critical.
- A **Type 1** hypervisor is the standard in the cloud; virtualization risks are VM escape, side-channel, sprawl, noisy neighbor.
- **SDN** separates the control plane from the data plane; the controller is protected like the management plane.
- Storage by model: IaaS volume/object/ephemeral, PaaS structured/unstructured, SaaS information storage and content/file storage, plus CDN.
- Compute resources are shared through **reservations, limits, shares**.
- Data center: logical (tenant partitioning, access control), physical (location, build/buy/lease), environmental (HVAC per ASHRAE, hot/cold aisle), connectivity (multi-vendor, physically separate routes).
- Resilience: N, N+1, 2N; **Uptime Tier I–IV**: Tier III concurrently maintainable, Tier IV fault tolerant.
- Risk assessment: identification, analysis (qualitative, quantitative: SLE = AV × EF, ALE = SLE × ARO), evaluation against appetite.
- The biggest cloud threats are misconfiguration and IAM (CSA Top Threats); in addition, multi-tenancy, lock-in, legal, and provider risks.
- Treatment: **avoid, mitigate, transfer, accept**; accountability is not transferred, and residual risk is accepted by the risk owner.
