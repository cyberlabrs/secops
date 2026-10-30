## Exam objectives: 3.4 and 3.5

This module completes Domain 3 (**Cloud Platform and Infrastructure Security**, 17%). After the components and risks were identified in the previous module, here controls are selected and continuity is planned:

- **3.4 Plan and implementation of security controls**
  - physical and environmental protection (e.g., on-premises),
  - identification, authentication and authorization in cloud environments,
  - system, storage and communication protection,
  - audit mechanisms (log collection, correlation, packet capture).
- **3.5 Plan Business Continuity (BC) and Disaster Recovery (DR)**
  - BC/DR strategy,
  - business requirements (RTO, RPO, recovery service level),
  - creation, implementation and testing of the plan.

Controls are selected based on the risk assessment (3.3). Every control must have an owner, be documented and verifiable, and cost less than the risk it reduces.

## Types of controls: a refresher

| Classification by nature | Examples |
|---|---|
| **Administrative (managerial)** | Policies, procedures, training, risk assessment, personnel screening |
| **Technical (logical)** | Encryption, IAM, firewall, logging |
| **Physical** | Fences, locks, cameras, security guards, environmental control |

| Classification by function | Example |
|---|---|
| **Preventive** | MFA, security group, encryption |
| **Detective** | SIEM alert, IDS, log review |
| **Corrective** | Automatic instance isolation, restore from backup |
| **Deterrent** | Warning banners, visible cameras |
| **Compensating** | Additional monitoring when the primary control is not feasible |
| **Directive** | Acceptable use policy |

Frameworks for selecting controls: **NIST SP 800-53** (control families, e.g., PE for physical protection, IA for identification and authentication, AC for access, SC for system and communications protection, AU for audit), **ISO/IEC 27001 Annex A** and **ISO/IEC 27002**, **ISO/IEC 27017** (cloud controls), and the **CSA Cloud Controls Matrix (CCM)**.

NIST SP 800-53 families that correspond directly to the 3.4 sub-points:

| 3.4 sub-point | NIST SP 800-53 families | Example controls |
|---|---|---|
| Physical and environmental protection | **PE** (Physical and Environmental Protection) | PE-3 physical access control, PE-11 emergency power, PE-13 fire protection, PE-14 environmental controls |
| Identification, authentication and authorization | **IA**, **AC** | IA-2 user identification and authentication (MFA), AC-2 account management, AC-6 least privilege |
| System, storage and communication protection | **SC**, **SI**, **CM**, **MP** | SC-8 transmission confidentiality, SC-12/13 keys and cryptography, SC-28 protection of data at rest, SI-2 flaw remediation, CM-6 configuration settings |
| Audit mechanisms | **AU** | AU-2 event logging, AU-6 review and analysis, AU-9 protection of audit information, AU-12 record generation |

### Controls by service model

| Area | IaaS (customer) | PaaS (customer) | SaaS (customer) |
|---|---|---|---|
| Physical | Nothing (provider), verification through reports | Same | Same |
| IAA | IAM, federation, MFA, roles for workloads | IAM for the service and application | Federation/SSO, MFA, roles in the application |
| Systems | OS hardening, patching, EDR | Secure service configuration, code | Secure tenant settings |
| Storage | Volume/object encryption, keys, backups | Database encryption, keys | Encryption options the provider offers, export |
| Communications | VPC, SG, VPN, TLS | Private endpoints, TLS | TLS, access restriction by IP/device |
| Audit | All logs + packet capture | Service and application logs | The audit log the provider exposes |

The higher the model (toward SaaS), the fewer technical controls the customer has, and the more it depends on **contracts and audit reports**.

## Physical and environmental protection (3.4)

In the public cloud, physical protection is implemented by the **provider**; the customer can neither control it nor audit it directly, but instead relies on **SOC 2 Type II**, **ISO/IEC 27001** certification, and **CSA STAR**. The outline specifically emphasizes **on-premises**: in a private or hybrid cloud and with its own equipment, the organization has this responsibility.

| Layer | Controls |
|---|---|
| Perimeter | Fences, vehicle barriers, lighting, video surveillance, security guards, an unmarked building |
| Building entrance | Reception, visitor log, escort, badges, **mantrap** against tailgating |
| Server rooms | Biometrics + badge (MFA), locked cabinets (cage, rack), entry logging |
| Environment | Fire detection and suppression, water detection, temperature and humidity monitoring, HVAC |
| Power | UPS, generators, separate power paths |
| Equipment | Inventory, control of media brought in and taken out, sanitization and destruction of disks |
| Personnel | Pre-employment screening, least privilege for physical access, periodic access review |

Fire protection: smoke detection (early detection, e.g., aspirating detectors), suppression in server rooms with clean agents (gases that do not damage equipment) or **pre-action** sprinkler systems (pipes stay dry until detection is triggered, reducing the risk of accidental water leaks).

> **On the exam:** if a public cloud customer requests evidence of the provider's physical security, the BEST answer is to review an **independent audit report** (SOC 2 Type II, ISO/IEC 27001), not to request a tour of the data center. Providers almost never allow individual physical audits, because that would compromise the security of all tenants.

## Identification, authentication, and authorization in the cloud (3.4)

The IAA chain:

| Step | Question | Cloud mechanisms |
|---|---|---|
| **Identification** | Who do you claim to be? | Username, service ID, workload identity |
| **Authentication** | Prove it | Password + **MFA**, certificates, FIDO2/passkeys, federation |
| **Authorization** | What are you allowed to do? | IAM policies, RBAC, ABAC, resource policies |
| **Accountability** | What did you do? | Audit logs tied to the identity |

Key controls:

- **Federation** with a central IdP (**SAML 2.0**, **OpenID Connect**) instead of local accounts in each cloud and SaaS: one identity, central MFA, fast revocation of access. Account provisioning into SaaS through **SCIM**.
- **MFA** everywhere, and mandatory for privileged accounts; phishing-resistant methods (FIDO2) for administrators.
- **Least privilege** and regular access reviews; tools that suggest removing unused permissions.
- **Privileged Access Management (PAM)**: just-in-time (JIT) administrative access, approval, session recording.
- **Root/global admin account**: not used for everyday work, strong MFA, break-glass procedure, an alert on every use.
- **Workload / machine identities**: roles and short-lived credentials for services (IAM roles, managed identities, workload identity federation) instead of static keys in code.
- **Secrets management**: secrets manager, rotation, prohibition of secrets in repositories.
- **Conditional access**: the decision takes into account the device, location, and sign-in risk.
- **Separation of duties**: e.g., whoever administers keys does not administer data, and whoever manages logs does not manage systems.

> **On the exam:** an organization with dozens of SaaS applications and a problem of "forgotten" accounts of former employees needs **federation (SSO) with a central IdP and automatic provisioning/deprovisioning**. The answer "regularly change passwords in each application" does not address the root cause.

## System, storage, and communication protection (3.4)

### System protection

- **Hardening** according to baselines (CIS Benchmarks), removal of unnecessary services, secure **golden images**,
- **patch management** and vulnerability management; in the cloud it is often better to replace an instance with a new image than to patch in place (immutable infrastructure),
- antimalware and **EDR/CWPP** (cloud workload protection) on hosts and containers,
- **configuration management** and drift detection through Infrastructure as Code and compliance checking tools (CSPM),
- protection of hypervisors and hosts (the provider's responsibility in the public cloud),
- trusted/secure boot and, where needed, **confidential computing** (protection of data in use through hardware enclaves).

### Storage protection

- **encryption at rest** with clearly defined key management (provider-managed, customer-managed, BYOK, HYOK, HSM),
- access control on storage (bucket/blob policies, blocking public access at the organization level),
- versioning, immutability (WORM), and protection of backups against deletion (protection against ransomware),
- **separation of backups** into another account or region, with separate credentials,
- classification and DLP over storage (from module 05).

### Communication protection

| Control | Purpose |
|---|---|
| **TLS 1.2/1.3** | Encryption and integrity of data in transit, server authentication (and client authentication with mTLS) |
| **IPsec VPN / dedicated links** | A secure connection on-prem ↔ cloud |
| **Segmentation and microsegmentation** | Virtual networks, subnets, security groups, network ACLs; limiting lateral movement |
| **Private endpoints** | Access to cloud services without going out to the internet |
| **WAF, DDoS protection** | Protection of applications and availability at the edge |
| **DNS security** | DNSSEC, filtering, query logging |
| **Zero trust** | Every request is authenticated and authorized regardless of network location |

> **On the exam:** distinguish what protects which state: **encryption at rest** protects against access to media and storage, **TLS** protects transmission, and neither protects data **in use**; for that there is confidential computing and access control in the application. The question "the provider must not see the data even during processing" points to confidential computing or client-side encryption.

## Audit mechanisms (3.4)

The outline lists three mechanisms: **log collection, correlation, and packet capture**.

| Mechanism | Description | Cloud specifics |
|---|---|---|
| **Log collection** | Central collection of control plane, OS, application, network, and IdP logs | Native services (CloudTrail, Azure Monitor, Cloud Audit Logs), agents on VMs, a central log archive account |
| **Correlation** | Linking events from different sources into incidents (SIEM) | Format normalization, synchronized time, identity and resource context |
| **Packet capture** | Recording actual network traffic for in-depth analysis | In IaaS through **traffic mirroring** or host agents; in PaaS and SaaS mostly impossible; the customer has no access to the physical network |
| Flow logs | Metadata about flows (source, destination, port, bytes) | VPC/NSG flow logs; cheaper and more available than full packet capture |

Auditing challenges in the cloud:

- **visibility depends on the model**: in SaaS you have only the audit log the provider exposes,
- **packet capture** is limited and expensive; encrypted traffic (TLS) limits its usefulness without decryption,
- logs are spread across accounts, regions, and providers,
- the **right to audit the provider** is defined by contract and is most often exercised through third-party reports, not through a direct audit,
- time synchronization and log retention must be defined.

Example: the incident response team suspects exfiltration from a VM. Flow logs show unusual traffic to an unknown address; the SIEM correlates it with an API call to create a new key an hour earlier; for in-depth analysis, the team enables traffic mirroring to a packet capture sensor on the suspicious instance.

## BC and DR: concepts (3.5)

| Term | Meaning |
|---|---|
| **Business Continuity (BC)** | Continuation of critical business functions during and after a disruption; a broader concept (people, processes, sites, suppliers, communication) |
| **Disaster Recovery (DR)** | Recovery of IT systems and data after a disaster; the technical part of BC |
| **BCP / DRP** | Business continuity plan and disaster recovery plan |
| **BIA (Business Impact Analysis)** | An analysis that identifies critical processes, dependencies, and the impact of disruption over time; the source of RTO/RPO |

Standards: **ISO 22301** (business continuity management system), **NIST SP 800-34 Rev. 1** (contingency planning for information systems), **ISO/IEC 27031** (ICT readiness for business continuity).

### BIA steps

1. Identify business processes and their owners.
2. Determine dependencies: applications, data, infrastructure, people, suppliers, and cloud providers.
3. Assess the impact of disruption over time (financial, legal, reputational, operational, to human safety).
4. Determine the MTD for each process, and from it the RTO, RPO, and RSL.
5. Rank processes by criticality and determine the recovery order.
6. Document and obtain management approval.

A BIA does not assess likelihood; the risk assessment does that. A BIA answers the question "what if it happens", and the risk assessment "how likely is it to happen". Both are inputs to the BC/DR strategy.

### Business requirements: metrics

| Metric | Definition | Example |
|---|---|---|
| **RTO (Recovery Time Objective)** | The target maximum time to restore a service after a disruption | "Online banking must be running within 2 hours" |
| **RPO (Recovery Point Objective)** | The maximum acceptable data loss measured in time; determines the frequency of backup or replication | "We can lose at most 15 minutes of transactions" |
| **RSL (Recovery Service Level)** | The percentage of normal capacity or performance that must be available during the DR state | "In the DR state, 50% capacity is sufficient" |
| **MTD / MAD / MTPD** | Maximum Tolerable Downtime (Period of Disruption): the time after which the disruption threatens the organization's survival | "After 3 days we lose our license" |
| **WRT (Work Recovery Time)** | The time after technical recovery to verify data and return to operation | RTO + WRT ≤ MTD |

Rules the exam tests:

- **RTO must be less than MTD** (RTO + WRT ≤ MTD),
- RPO determines the data strategy: an RPO of 24 hours allows a daily backup, an RPO close to zero requires synchronous replication,
- the shorter the RTO and RPO, the more expensive the solution,
- RTO/RPO are determined by **the business through the BIA**, not by IT,
- RSL enables savings: the DR environment does not need full capacity if the business accepts a reduced service level.

> **On the exam:** "Who determines the RTO and RPO?" **Business process owners through the BIA**, with management approval. IT proposes solutions and the costs of meeting them. If "the IT team based on the capabilities of the backup system" is offered, it is a distractor.

## BC/DR strategy in the cloud (3.5)

ISC2 distinguishes three basic scenarios:

| Scenario | Description | Advantages | Risks |
|---|---|---|---|
| On-prem primary, **cloud as DR** | Production in its own data center, DR in the cloud | No second physical site, pay-per-use | Compatibility, network, testing |
| Cloud primary, **DR with the same provider** (another region/zone) | Multi-AZ or multi-region with the same provider | Simple, same tools, fast replication | An outage or problem at the level of the whole provider; lock-in |
| Cloud primary, **DR with another provider** | Multi-cloud DR | Resilience to an outage, bankruptcy, or legal problem of the provider | Complexity, different services, portability of data and configuration |

Classic site types and their cloud equivalents:

| Classic | Cloud pattern | RTO/RPO | Cost |
|---|---|---|---|
| **Cold site** | **Backup and restore**: only backups in another region, infrastructure is created only in a disaster (IaC) | Hours to days | Lowest |
| **Warm site** | **Pilot light**: core services (e.g., a replicated database) are running, the rest is brought up as needed | Tens of minutes to hours | Low to medium |
| **Warm site+** | **Warm standby**: a scaled-down but functional copy of production, scaled up on failover | Minutes | Medium |
| **Hot site** | **Multi-site active/active**: full production at multiple sites simultaneously | Near zero | Highest |

Key strategy considerations:

- **reliability and location** of the DR site (far enough away, another jurisdiction if permitted),
- **data replication** (synchronous or asynchronous, in line with the RPO),
- **Infrastructure as Code**: the DR environment can be quickly created from code,
- **DNS and network failover** (failover, health checks),
- **dependencies**: identity (IdP), DNS, keys (KMS must be available in the DR region), third parties,
- **capacity**: in a large regional disaster, will the other region have enough capacity (reservations),
- **backup protection** against ransomware (immutability, separate account),
- **contracts and SLA**: what the provider guarantees, and SLA credits do not compensate for business loss,
- **failback** to the primary site after recovery.

### Contract and SLA in the BC/DR context

| Element | Question for the provider |
|---|---|
| Availability SLA | What percentage is guaranteed and how is it measured (per service, per region)? |
| SLA credits | What does the customer get in case of a breach (usually only a discount on the bill, not compensation for damages)? |
| Notification | How quickly does the provider report incidents and outages? |
| Locations | In which regions and jurisdictions can DR copies be located? |
| Portability | How is data exported, in what format and within what timeframe (exit strategy)? |
| Provider BC | Does the provider have its own BCP and how does it test it (evidence through SOC 2 and ISO 22301)? |
| Testing | May the customer perform DR tests and under what conditions? |

Roles in BC/DR:

| Role | Responsibility |
|---|---|
| Management / sponsor | Approves the strategy and budget and accepts residual risk |
| BC/DR coordinator | Leads the creation, maintenance, and testing of the plan |
| Process owners | Define requirements (BIA) and participate in tests |
| Technical teams | Implement and execute recovery procedures |
| Communications and legal | Notification of clients, regulators, and the media |
| Cloud provider | Delivers services according to the contract and SLA, cooperates during an incident |

> **On the exam:** if a scenario states that the main risk is the **provider ceasing operations or going bankrupt**, DR in another region of the same provider **does not solve** the problem. A strategy with **another provider** and portable data is required, with an exit strategy in the contract.

### Choosing a strategy by criticality

Not every system requires the same level of protection. The strategy is chosen per system, from the BIA ranking:

| Criticality | Typical RTO / RPO | Pattern | Example |
|---|---|---|---|
| Critical (tier 0/1) | Minutes / seconds to minutes | Warm standby or active/active | Payments, checkout, emergency services system |
| Important (tier 2) | Hours / up to an hour | Pilot light | Catalog, CRM |
| Supporting (tier 3) | A day / 24 hours | Backup and restore | Internal wiki, reporting |
| Non-critical | Days / days | Backup and restore or risk acceptance | Archival analyses |

This keeps the total cost of DR reasonable: expensive solutions only where the BIA justifies them.

### Backup strategy as the foundation of DR

The **3-2-1** rule still applies in the cloud, with an addition for ransomware:

| Element | Meaning | Cloud example |
|---|---|---|
| 3 copies | Production + two copies | Primary data, a backup in the same region, a copy in another region |
| 2 different media / services | The copies do not share the same failure mechanism | Snapshot + backup to another storage service or another provider |
| 1 off-site | At least one geographically separated copy | Another region or another provider |
| +1 immutable / offline | A copy that an attacker with admin rights cannot delete | Object Lock (compliance mode), vault lock, separate account |
| 0 errors on restore | Regularly tested recovery | Automated restore tests |

### Plan activation: incident or disaster

Not every disruption is a disaster. The plan must clearly define:

- **declaration criteria** (e.g., an expected disruption longer than the RTO, loss of a site or region),
- **who has the authority** to declare a disaster and activate DR (usually a named manager and a deputy),
- **escalation**: the incident response team assesses the situation, and if the disruption exceeds thresholds, BC/DR is activated,
- the **communication chain** and alternative communication channels (in case corporate email is in the affected cloud),
- **failback**: the criteria and procedure for returning to the primary site, including synchronization of data created in the DR state.

With ransomware, DR has a particular nuance: before recovery, you must confirm that the backup is not infected and that the attacker has been removed from the environment, otherwise you recover into a compromised environment. That is why recovery is performed into a **clean environment** (clean room) from immutable backups.

## Creating, implementing, and testing the plan (3.5)

### Phases of plan creation (according to the ISC2 CBK)

1. **Defining the scope**: which processes, systems, and sites; management support.
2. **Gathering requirements and context**: BIA, RTO/RPO/RSL, regulatory requirements.
3. **Analysis**: dependencies, threat scenarios, current capabilities.
4. **Risk assessment**: which scenarios are likely and what they threaten.
5. **Design**: selection of strategy, architecture, and procedures.
6. **Implementation**: building the DR environment, replication, runbooks, roles and contacts, communication plan.
7. **Testing**.
8. **Reporting and revision**: findings, improvements, plan updates.

The plan must contain: roles and responsibilities (who declares a disaster), contact lists (including the provider), activation criteria, detailed recovery steps per system, the recovery order by BIA priorities, communication with employees, clients, and regulators, and the procedure for returning to normal operations. The plan is also kept **outside the systems it protects** (if it is only on a wiki in the same cloud, it will not be available when you need it).

### Testing

| Test type | Description | Impact on production |
|---|---|---|
| **Checklist / read-through** | Participants review the plan and verify that it is up to date | None |
| **Structured walkthrough / tabletop** | The team walks through a scenario around a table and discusses the steps | None |
| **Simulation** | The scenario is simulated up to the point of failover, with real activities but without switching production | Minimal |
| **Parallel test** | DR systems are brought up and process data in parallel while production keeps running | Low |
| **Full interruption (full cutover)** | Production is actually shut down and operations run at the DR site | High risk; rare, with management approval |

Good practice:

- test **regularly** (at least annually) and after major changes,
- tests progress from less risky to more risky,
- testing is easier in the cloud: the DR environment can be brought up from IaC and shut down after the test; **chaos engineering** and game days test resilience under controlled conditions,
- testing at the provider may require **notification and permission** (e.g., load tests),
- measure the achieved RTO/RPO and compare them with the objectives,
- **lessons learned** and plan updates after every test and real incident.

> **On the exam:** "Which test gives the MOST confidence with the LEAST risk to production?" is usually the **parallel test**. Full interruption gives the most confidence, but carries the risk of a real outage. A tabletop is the cheapest, but does not prove that the technology works.

## Common exam traps

- "High availability (multi-AZ) is the same as DR": multi-AZ protects against the failure of one zone, not against configuration errors, data deletion, ransomware, or an outage of an entire region.
- "Replication is a backup": replication also propagates errors and deletions; immutable backups with history are also needed.
- "An SLA credit covers the loss": credits are usually small discounts and do not compensate for business loss.
- "IT determines RTO/RPO": they are determined by the business through the BIA.
- "The plan is done once it is written": a plan without testing and maintenance is worthless.
- "Technology first": in a disaster, the priority is always **human safety**, and only then systems.
- "The customer can audit the provider's physical controls": it relies on independent reports.

## Scenario: an e-commerce platform

An online store runs in a single cloud region. The BIA shows: checkout has an MTD of 8 hours, RTO of 1 hour, RPO of 5 minutes; the product catalog has an RTO of 4 hours, RPO of 24 hours; analytics has an RTO of 3 days. During the DR state, 60% capacity is acceptable (RSL).

1. **Controls (3.4)**: federation with the IdP and MFA for the console, PAM for administrators, database encryption with a customer-managed key replicated to the DR region, TLS everywhere, WAF, central logs in a separate account and SIEM correlation, flow logs and traffic mirroring for critical instances as needed.
2. **Strategy (3.5)**: checkout uses a **warm standby** in another region with asynchronous database replication (RPO in minutes) and scaling to 60% on failover; the catalog uses **pilot light**; analytics uses **backup and restore**.
3. **Dependencies**: KMS keys, IdP, and DNS available in the DR region; backups in a separate account with immutability.
4. **Testing**: a quarterly tabletop, a semi-annual parallel test for checkout with measurement of RTO/RPO, an annual plan review with management.

## Summary

- Controls are selected from the risk assessment; frameworks are NIST SP 800-53, ISO/IEC 27001/27002/27017, and the CSA CCM.
- **Physical protection** in the public cloud is implemented by the provider; the customer verifies it through SOC 2 Type II, ISO/IEC 27001, and CSA STAR; on-prem is the organization's responsibility.
- **IAA in the cloud**: federation (SAML, OIDC), SCIM, MFA, least privilege, PAM/JIT, root account protection, workload identities instead of static keys.
- Protection of **systems** (hardening, patching, CWPP), **storage** (encryption, keys, WORM, separate backups), and **communications** (TLS, VPN, segmentation, private endpoints, zero trust).
- **Audit mechanisms**: log collection, correlation in a SIEM, packet capture (in IaaS through traffic mirroring, impossible in SaaS); flow logs as a cheaper alternative.
- **BC** is broader than **DR**; the BIA provides **RTO, RPO, RSL, MTD**; RTO + WRT ≤ MTD; the metrics are determined by the business.
- Cloud DR scenarios: on-prem → cloud, same provider another region, another provider; patterns backup and restore, pilot light, warm standby, active/active.
- Plan: scope, requirements, analysis, risk, design, implementation, testing, revision; keep it outside the systems it protects.
- Tests: checklist, tabletop, simulation, parallel, full interruption; test regularly and update the plan.
