## Exam objectives: 5.1, 5.2 and 5.3

Domain 5 (**Cloud Security Operations**) carries 17% of the exam. This module covers operational work on infrastructure and operational standards; forensics, the SOC, and incident management (5.4–5.6) are in the next module.

- **5.1 Build and implement physical and logical infrastructure for cloud environment**
  - hardware specific security configuration requirements (HSM, TPM),
  - secure by default,
  - installation and configuration of management plane tools,
  - virtual hardware specific security configuration requirements (network, storage, memory, CPU, hypervisor type 1 and 2),
  - installation of guest OS virtualization toolsets.
- **5.2 Operate and maintain physical and logical infrastructure for cloud environment**
  - access controls for local and remote access (RDP, secure terminal access, SSH, console-based access, jumpboxes, virtual client, SSO),
  - secure network configuration (VLAN, TLS, DHCP, DNSSEC, VPN),
  - network security controls (firewalls, IDS, IPS, honeypots, vulnerability assessments, network security groups, bastion host, segmentation),
  - OS hardening through baselines, monitoring and remediation (Windows, Linux, VMware),
  - patch management,
  - availability of guest OS,
  - availability of clustered hosts (distributed resource scheduling, dynamic optimization, storage clusters, maintenance mode, HA),
  - performance and capacity monitoring (network, compute, storage, response time),
  - hardware monitoring (disk, CPU, fan speed, temperature),
  - configuration of host and guest OS backup and restore functions,
  - management plane (scheduling, orchestration, maintenance).
- **5.3 Implement operational controls and standards**: NIST, ISO, HIPAA, COBIT, CIS Controls, COSO, ITIL, ISO/IEC 20000-1.

Important for perspective: in the public cloud, many items from 5.1 and 5.2 (hardware, hypervisor, host clusters, fan temperature) are handled by the **CSP**. The exam still asks about them because a CCSP candidate may work at a CSP or build a private cloud, and as a customer must know what to ask of the CSP and how to verify it (SOC 2, ISO 27001, contract). Always ask yourself: **who is responsible here under the service model?**

| Operational task | IaaS | PaaS | SaaS |
|---|---|---|---|
| Physical hardware, HSM/TPM in hosts, cooling, fan monitoring | CSP | CSP | CSP |
| Hypervisor, host clusters, DRS, maintenance mode | CSP | CSP | CSP |
| Guest OS: hardening, patching, toolset, backup | customer | CSP | CSP |
| Runtime, middleware, database as a service | customer | CSP (customer configures) | CSP |
| Virtual network: subnets, NSG, firewall rules, VPN | customer | shared | CSP |
| Management access (SSH, RDP, bastion) | customer | mostly none | none |
| Identities, MFA, roles in the management plane | customer | customer | customer |
| Data, classification, encryption, and keys | customer | customer | customer (with CSP options) |
| Logging and monitoring of own resources | customer | customer | customer (as far as the SaaS allows) |

What remains with the CSP the customer cannot configure themselves, but can and must **verify**: through SOC 2 Type II, ISO/IEC 27001/27017 certificates, the CSA STAR registry, the contract, and the SLA. What is with the customer, the customer must both configure and prove to the auditor.

An example of the reasoning: if an auditor asks for proof that the hypervisors in an IaaS environment are regularly patched, the customer does not collect logs from the hypervisor (it has no access), but provides the CSP's SOC 2 Type II report and checks the relevant controls and exceptions in it, along with the complementary user entity controls (CUEC) that it must meet itself.

## Hardware security components (5.1)

### HSM and TPM

| Criterion | **HSM** (Hardware Security Module) | **TPM** (Trusted Platform Module) |
|---|---|---|
| Form | dedicated device (network, PCIe card) or cloud service | chip on the motherboard or firmware (fTPM), vTPM for a VM |
| Purpose | generating, storing, and using keys for many applications; high performance | integrity and identity of a single platform: measured boot, key sealing, attestation |
| Keys | organizational keys, CA keys, payment keys | keys bound to a specific device (endorsement key, storage root key) |
| Certification | FIPS 140-2/140-3 (typically Level 3), Common Criteria | TCG specification (TPM 2.0), FIPS for some implementations |
| Cloud example | AWS CloudHSM, Azure Managed HSM, KMS uses HSMs underneath | Nitro/shielded VM with vTPM, BitLocker key in the TPM |
| Tamper protection | tamper-evident / tamper-resistant / tamper-responsive (erases keys) | limited physical protection, resistance to software attacks |

Security requirements when configuring an HSM:

- **separation of roles** (security officer, crypto user, auditor), **M of N** control for sensitive operations (e.g., 3 of 5 key custodians),
- key backup to another HSM or a protected wrapper, never in plaintext,
- network isolation of the HSM and client authentication,
- logging and monitoring of all operations,
- firmware under control and updated according to the manufacturer's procedure.

The TPM is used for **secure boot** and **measured boot**: each component of the boot chain is measured (hashed) into PCR registers, so it can be proven (attested) that the host has not been modified before it receives keys or workloads. In the cloud this enables **trusted compute pools**: sensitive workloads are scheduled only onto attested hosts.

> **On the exam:** an HSM is for **organizational keys** and cryptographic operations at scale, a TPM is for the **integrity and identity of a single machine**. When a question requires FIPS 140 Level 3 key protection with exclusive customer control in the cloud, the answer is a dedicated (single-tenant) cloud HSM, not a multi-tenant KMS.

### Secure by default

**Secure by default** means that a product or system is secure immediately upon installation, without additional steps: unnecessary services disabled, no default passwords, encryption enabled, logging enabled, minimal permissions, public access disabled. Related terms are **secure by design** (security built into the design) and **secure in deployment**. The CISA "Secure by Design" initiative places the burden on manufacturers to ship secure default settings.

Cloud examples: public storage access blocked at the account level, encryption of new volumes enabled by default, IMDSv2 required, a default security group with no inbound rules, guardrails through organizational policies (SCP, Azure Policy) that prohibit insecure configurations.

| Principle | Question | Example |
|---|---|---|
| Secure by design | is security in the architecture? | separate accounts per environment, zero trust |
| Secure by default | is the initial state secure? | public access disabled, encryption enabled |
| Secure in deployment | is it secure after installation and changes too? | hardening baseline, drift detection |

## Management plane (5.1 and 5.2)

The **management plane** is the set of tools and interfaces used to manage the entire cloud environment: web console, CLI, API, orchestration tools, hypervisor management (e.g., vCenter), IaC tools. Compromise of the management plane is the worst possible scenario: the attacker controls all resources and can delete them, copy snapshots, or disable logging.

Installation and configuration of management plane tools (5.1):

- **isolated management network** (out-of-band or a separate VLAN/VPC), with no internet access except through controlled points,
- **strong authentication** (phishing-resistant MFA), SSO via the central IdP, break-glass accounts,
- **least privilege and RBAC**, separate roles for network, compute, storage, security, and audit,
- **logging of all actions** on the management plane to immutable, separate storage (in AWS, an organization CloudTrail in the log archive account),
- hardening and patching of the tools themselves (vCenter, orchestrator, CI/CD),
- integrity verification of installation packages (hash, signature).

Operational functions of the management plane (5.2):

| Function | Description | Security aspect |
|---|---|---|
| **Scheduling** | placing workloads on hosts and tasks in time | do not place sensitive workloads on unattested hosts; plan maintenance outside peak hours |
| **Orchestration** | automated creation, connection, and scaling of resources | IaC under change control, protection of orchestrator credentials |
| **Maintenance** | patching, upgrades, hardware replacement | maintenance mode, live migration, communication to customers, change management |

> **On the exam:** the management plane is the most valuable target in the cloud. When asked which control is MOST important for administrative access to the cloud console, the answer is strong (phishing-resistant) MFA with least privilege and logging, not a network firewall, because the console is by definition reachable over the internet.

## Virtual hardware and the hypervisor (5.1)

### Hypervisor types

| Criterion | **Type 1** (bare metal) | **Type 2** (hosted) |
|---|---|---|
| Where it runs | directly on hardware | as an application on a host OS |
| Examples | VMware ESXi, Microsoft Hyper-V, Xen, KVM (in the kernel), AWS Nitro | VMware Workstation, Oracle VirtualBox, Parallels |
| Attack surface | smaller (no general-purpose OS underneath) | larger: host OS vulnerabilities endanger all VMs |
| Performance | high | lower |
| Use | data centers, cloud | development, testing, desktop |

Cloud providers use Type 1 hypervisors. Type 2 is never appropriate for a production multitenant cloud.

Main threats to the hypervisor: **VM escape** (breaking out of the guest to the hypervisor), **side-channel attacks** via the shared CPU cache, **VM sprawl** (uncontrolled proliferation of VMs), **hyperjacking** (installing a malicious hypervisor), unauthorized access to snapshots and images.

### Security configuration of virtual hardware

| Resource | Risk | Configuration |
|---|---|---|
| **Network** | sniffing and spoofing in the virtual switch, east-west movement | virtual switch rejecting promiscuous mode, MAC spoofing, and forged transmits; VLAN/VXLAN segmentation; microsegmentation; separate management, storage, and vMotion networks |
| **Storage** | access to others' data, data remnants (data remanence) | volume encryption, LUN masking/zoning, wiping (zeroing) before reallocation, separate storage network |
| **Memory** | reading other VMs' memory, ballooning and swap exposing data | memory isolation, memory encryption (AMD SEV, Intel TDX), disable inter-VM page deduplication (TPS) due to side-channel risk, protect swap files |
| **CPU** | side-channel (Spectre, Meltdown, L1TF), noisy neighbor | microcode and hypervisor patches, core scheduling / SMT disabled for sensitive workloads, reservations and limits, dedicated hosts |
| **Hypervisor** | VM escape, unauthorized administration | minimal installation, patching, secure boot and TPM attestation, lockdown mode, separate management network, logging |

Additional VM recommendations: remove unnecessary virtual hardware (floppy, CD, serial and USB ports), disable copy/paste and drag-and-drop between the console and the guest in production, restrict access to the VM console.

### Installing the guest OS virtualization toolset

The **guest OS virtualization toolset** (e.g., VMware Tools, Hyper-V Integration Services, cloud agents such as AWS SSM Agent, Azure VM Agent, QEMU guest agent) is software in the guest that improves performance and integration: optimized drivers, time synchronization, graceful shutdown, quiescing for consistent snapshots, heartbeat, management from the management plane.

Security aspects:

- the toolset has a **privileged channel** between the guest and the hypervisor, so it is part of the attack surface,
- install it from a trusted source, verify the signature, keep it up to date through patch management,
- install only the needed components and disable unnecessary features (e.g., file sharing with the host),
- control who may use the agent through the management plane to execute commands in the guest (e.g., SSM Run Command permissions are equivalent to root access).

## Management access: local and remote (5.2)

| Method | Use | Risks | Controls |
|---|---|---|---|
| **RDP** (Remote Desktop Protocol) | graphical access to Windows hosts | brute force, protocol vulnerabilities, exposing port 3389 to the internet | never directly on the internet; via VPN, jumpbox, or RD Gateway; NLA (Network Level Authentication); MFA; TLS |
| **SSH** (Secure Shell) | terminal on Linux/Unix | theft of private keys, weak passwords, uncontrolled authorized_keys | keys or (short-lived) SSH certificates only, no root login or passwords, MFA, central key management |
| **Secure terminal access** | general term for encrypted and authenticated terminal access | telnet and other unencrypted protocols | encrypted protocols only, session logging |
| **Console-based access** | VM console through the hypervisor or cloud serial console | bypasses the guest OS network controls | strict RBAC, MFA, logging, for recovery only |
| **Jumpbox / bastion host** | a single hardened entry point into a private network | if compromised, it opens everything | hardening, MFA, session recording, minimal software, patching, restricted source IP |
| **Virtual client** (VDI, virtual desktop) | administrators and users work from a centrally managed desktop | shared infrastructure | data does not leave the data center, privileged access workstations |
| **SSO** | one identity for all tools | IdP as a single point of failure | strong MFA, break-glass accounts |

A modern trend is **identity-aware proxies** and managed session services (e.g., AWS Systems Manager Session Manager, Azure Bastion, GCP IAP) that provide a shell or RDP without open inbound ports and without long-lived SSH keys, with IAM authorization and logging of every session. For administrators, **privileged access workstations** (PAW) are recommended: hardened devices used only for administration.

> **On the exam:** if a scenario describes RDP or SSH exposed to the internet on every server, the BEST answer is to centralize access through a bastion/jumpbox or a managed session service with MFA and logging, and close the direct ports. "Change the port to a non-standard one" is security through obscurity and is never the best answer.

## Secure network configuration (5.2)

| Technology | Purpose | Security note |
|---|---|---|
| **VLAN** | logical segmentation of an L2 network | VLAN hopping (double tagging, switch spoofing); do not use the native VLAN for traffic, disable DTP; in the cloud, VPC/VNet and subnets are used instead of VLANs, and in data centers VXLAN because of the 4094-VLAN limit |
| **TLS** | confidentiality and integrity in transit | TLS 1.2 minimum, preferably 1.3; disable old versions and weak ciphers; certificate management; mTLS for services |
| **DHCP** | automatic IP address assignment | rogue DHCP server and DHCP starvation; **DHCP snooping** on switches; in the cloud, DHCP is managed by the CSP |
| **DNSSEC** | integrity and authenticity of DNS responses (signatures) | protects against DNS cache poisoning and spoofing; **does not encrypt** queries (for privacy: DoH/DoT) |
| **VPN** | encrypted tunnel over an untrusted network | IPsec (site-to-site, L3) or TLS/SSL VPN (remote users); MFA; split tunneling is a risk; for zero trust, the move is to ZTNA |

A frequently tested distinction: **DNSSEC provides integrity and origin authenticity, not confidentiality.** If the requirement is that no one on the network can see which domains users look up, the answer is DNS over HTTPS/TLS, not DNSSEC.

## Network security controls (5.2)

| Control | Function | Cloud note |
|---|---|---|
| **Firewall** | traffic filtering: stateless (packet), stateful, NGFW (L7, user identity, IPS) | cloud-native firewall services or a virtual appliance; host firewall in the guest |
| **IDS** (Intrusion Detection System) | detects and alerts, passive | in the cloud via traffic mirroring or flow logs; HIDS on the host |
| **IPS** (Intrusion Prevention System) | inline, blocks | false positives can disrupt legitimate traffic; impact on latency |
| **Honeypot / honeynet** | a decoy to detect and study attackers | must be isolated; legal issues (must not be used as **entrapment**, but as **enticement**); honeytokens (fake credentials) are a lightweight variant |
| **Vulnerability assessment** | periodic and continuous vulnerability scanning | check the CSP's scanning policy; authenticated scanning gives more accurate results; agent-based for ephemeral instances |
| **Network security groups** | stateful filtering at the instance or network interface level | default deny inbound; references to other groups instead of IP ranges |
| **Bastion host** | hardened entry point for administration | the only host with public access for management |
| **Segmentation** | dividing the network into zones by trust and function | subnets, VPCs, microsegmentation (per workload), separate accounts |

Comparison of IDS and IPS by the consequence of an error:

| Criterion | IDS | IPS |
|---|---|---|
| Position | out-of-band (copy of traffic) | inline |
| False positive | unnecessary alert | legitimate traffic blocked |
| False negative | missed attack | missed attack |
| Impact on availability | none | can cause an outage if it fails (fail open / fail closed decision) |

A vulnerability assessment is not the same as a penetration test:

| Criterion | Vulnerability assessment | Penetration test |
|---|---|---|
| Goal | find and catalog known vulnerabilities | prove that vulnerabilities can be exploited and what the impact is |
| Method | automated scanners, broad | manual, targeted, with rules of engagement |
| Frequency | continuous or frequent (weekly, monthly) | periodic (annually, after major changes) |
| Result | list of vulnerabilities with a score (CVSS) | report on attack paths and business impact |

> **On the exam:** when introducing an IPS into production, the BEST approach is first to run in detection mode and tune the rules, and only then block. For honeypots, the exam likes the legal nuance: a honeypot may attract an attacker who already has intent (enticement), but must not induce someone to commit an act they otherwise would not (entrapment). Consult the legal department before deployment.

## Operating system hardening (5.2)

Hardening is the process of reducing the attack surface by applying a **baseline** configuration, monitoring deviations, and remediating.

Cycle:

1. **Baseline**: choose a standard (CIS Benchmarks, DISA STIG, Microsoft Security Baselines, VMware Security Configuration Guide / vSphere hardening guide) and tailor it to the organization.
2. **Implementation**: build the baseline into a **golden image** and IaC/configuration management (Ansible, Group Policy, DSC).
3. **Monitoring**: continuously check compliance (SCAP scanners, CIS-CAT, cloud configuration services, agents).
4. **Remediation**: restore the configuration automatically or through the change process; for immutable infrastructure, replace the instance with a new one from an updated image.

| Platform | Typical measures |
|---|---|
| **Windows** | Group Policy baselines, disable SMBv1 and unnecessary services, LAPS for local admin passwords, Credential Guard, BitLocker, AppLocker/WDAC, audit policies |
| **Linux** | minimal installation, SSH hardening, SELinux/AppArmor, auditd, disable unnecessary services, sysctl network settings, unnecessary SUID files |
| **VMware** (ESXi/vCenter) | lockdown mode, SSH/ESXi Shell disabled except when needed, secure boot, separate management network, roles in vCenter, time synchronization, syslog to a central server |

> **On the exam:** golden image + automated compliance checking + replacement instead of manual fixing is the mature approach in the cloud. If a question offers "log in to each server manually and change the setting", that is almost always the wrong answer when an automated alternative exists.

## Patch management (5.2)

The patch management process:

1. **Inventory** of systems and software (you cannot patch what you don't know you have).
2. **Tracking** vendor releases and vulnerabilities (CVE, CVSS, the CISA KEV catalog of actively exploited vulnerabilities).
3. **Assessment and prioritization** by risk: vulnerability criticality, exposure, system value, existence of an exploit.
4. **Testing** in a non-production environment.
5. **Approval** through change management (urgent patches through an emergency change).
6. **Deployment** in phases (pilot, then waves), with a rollback plan.
7. **Verification** (scanning after the patch) and **documentation**.

Cloud specifics:

- responsibility depends on the model: in IaaS the customer patches the guest OS, in PaaS the CSP patches the platform and the customer its own code and dependencies, in SaaS the CSP patches everything,
- **immutable infrastructure**: the instance is not patched; a new image is built and instances are replaced (rolling or blue/green),
- automation through patch services (e.g., Systems Manager Patch Manager, Azure Update Manager),
- when a patch does not exist or cannot be applied immediately: **compensating controls** (WAF, isolation, disabling the vulnerable feature) and formal risk acceptance.

## Availability: guest OS and clustered hosts (5.2)

### Guest OS availability

Guest availability is ensured by a combination of: redundant instances in multiple availability zones behind a load balancer, health checks with automatic replacement (auto-healing), consistent backups and snapshots, automatic instance recovery on host failure, and good capacity planning. In the cloud the rule is **design for failure**: an individual instance is not reliable, the system is.

### Availability of clustered hosts

| Function | Description |
|---|---|
| **Distributed Resource Scheduling (DRS)** | automatic placement and movement of VMs between hosts in a cluster based on load and rules (affinity/anti-affinity) |
| **Dynamic optimization** | continuous balancing of resources (CPU, memory, power); a Microsoft term in SCVMM; includes powering off unused hosts (power optimization) |
| **Storage clusters** | multiple storage nodes as one system; **tightly coupled** (shared backplane, high performance, limited scaling) vs. **loosely coupled** (independent nodes, better scaling, lower performance) |
| **Maintenance mode** | the host is removed from scheduling, VMs are live-migrated to other hosts before maintenance; no new workloads on the host |
| **High Availability (HA)** | if a host fails, VMs are automatically restarted on other hosts; requires spare capacity (N+1) |
| **Fault tolerance** | a secondary copy of the VM runs in lock-step, no interruption even on host failure; more expensive |

> **On the exam:** maintenance mode is the key to maintenance without service interruption: first move the workloads, then patch or change hardware. Anti-affinity rules ensure that redundant VMs of the same application are not on the same host; otherwise HA does not help.

## Performance, capacity, and hardware monitoring (5.2)

| Area | Metrics | Why it matters for security |
|---|---|---|
| **Network** | throughput, latency, packet loss, number of connections | DDoS, exfiltration (unexpected outbound traffic) |
| **Compute** | CPU, memory, number of processes | cryptominer (persistently high CPU), memory leaks |
| **Storage** | IOPS, latency, capacity, growth | ransomware (sudden surge in writes), a full disk breaks logging |
| **Response time** | application response time, error rate | indicator of availability and SLA |
| **Hardware** | disk health (SMART), CPU temperature, fan speed, power supply | preventive replacement before failure; overheating may indicate a cooling problem in the data center |

Monitoring makes sense only with a **baseline** of normal behavior, **thresholds**, and **alerts** that go to responsible people. Capacity planning uses trends to add resources before they run out; in the cloud, autoscaling solves part of the problem, but quotas and budget still require monitoring. In the public cloud, hardware monitoring is done by the CSP; the customer sees it indirectly through health events (e.g., AWS Health, scheduled instance retirement).

## Host and guest backup and restore (5.2)

| Approach | Description | Advantages | Caution |
|---|---|---|---|
| **Snapshot** | state of a volume or VM at a point in time | fast, incremental | not a true backup if in the same system and region; consistency (quiesce) |
| **Agent-based backup in the guest** | an agent copies files and application data | consistent application backups, granular restore | the agent needs maintenance |
| **Agentless (hypervisor level)** | VM backup through the hypervisor API | simple, whole VM | less granularity |
| **Host configuration** | backup of the hypervisor and management tool configuration | fast infrastructure recovery | stored off the host |

Security practices:

- the **3-2-1** rule (three copies, two media, one off-site) and the extension **3-2-1-1-0** (one copy immutable or offline, zero errors on verification),
- **immutable backups** (object lock, WORM) and a separate account for backups to protect against ransomware and a compromised administrator,
- backup encryption and key management (lost key = lost backup),
- copies to another region in line with data residency rules,
- **regular restore testing**: an untested backup is a hope, not a control,
- backup follows the RPO, and restore time the RTO (in detail in the BC/DR module).

## Operational controls and standards (5.3)

Objective 5.3 requires you to know which framework serves what and how operational processes (especially ITSM) support security.

| Framework / standard | Type | Focus | When to choose it |
|---|---|---|---|
| **NIST CSF 2.0** | framework | functions Govern, Identify, Protect, Detect, Respond, Recover | a common language for the security program and communication with management |
| **NIST SP 800-53 Rev. 5** | control catalog | detailed security and privacy controls | US federal systems, FedRAMP, detailed catalog |
| **NIST SP 800-145 / 800-146 / 800-210** | cloud definitions and guidance | definition of cloud, recommendations, access control | terminology |
| **ISO/IEC 27001** | certifiable standard for an ISMS | information security management system, Annex A controls | international certification of the organization |
| **ISO/IEC 27002** | control guidance | implementation of controls | guidance accompanying 27001 |
| **ISO/IEC 27017 / 27018** | cloud extensions | 27017: cloud security controls; 27018: protection of PII in the public cloud | cloud providers and customers |
| **ISO/IEC 20000-1** | certifiable standard for an **IT service management** system | requirements for an SMS (service management system) | certification of IT service management |
| **ITIL 4** | best-practice framework for ITSM | practices: incident, problem, change enablement, release, deployment, configuration, service level, availability, capacity, continuity, information security management | operational processes and organization of the IT function |
| **COBIT 2019** (ISACA) | IT governance and management framework | aligning IT goals with business goals, governance vs. management | managing IT from the perspective of management and audit |
| **COSO** | internal control framework (Internal Control – Integrated Framework) and ERM | control environment, risk assessment, control activities, information and communication, monitoring | financial reporting, SOX, internal audit |
| **CIS Controls v8.1** | prioritized set of security measures | 18 controls, Implementation Groups IG1–IG3 | a practical start, especially for smaller organizations |
| **CIS Benchmarks** | configuration baseline for specific products | hardening of OSs, cloud accounts, Kubernetes | technical hardening |
| **HIPAA** | US law | protection of health data (PHI): Privacy, Security, and Breach Notification Rule; BAA with providers | organizations processing PHI in the US |

Note: ISO/IEC 20000-1 is to ITSM what ISO/IEC 27001 is to security: a **certifiable management system standard**, while ITIL is a **set of practices** without organizational certification (individuals are certified). They fit together well: ITIL provides the "how", 20000-1 provides "what must exist" for certification.

> **On the exam:** distinguish the levels. COBIT and COSO are **governance and internal control** (management, auditors). ISO 27001 and ISO 20000-1 are **certifiable management systems**. ITIL is **operational practice** for IT services. CIS Controls are **prioritized technical measures**, and CIS Benchmarks are **concrete configurations**. NIST 800-53 is a **control catalog**, the CSF is a **high-level framework**. HIPAA is a **law**, not a framework you choose.

### ITSM processes that support security

Traditional CCSP content under 5.3 covers these processes (ITIL / ISO 20000-1):

| Process | Goal | Security link |
|---|---|---|
| **Change management** (change enablement) | controlled changes with risk assessment and approval (CAB) | prevents unauthorized and risky changes; standard, normal, and emergency changes |
| **Configuration management** | CMDB, configuration items (CIs) and the relationships between them | you know what you have and how it is connected; basis for impact assessment |
| **Release and deployment management** | planning, testing, and rolling out releases | security tests before production, rollback |
| **Incident management** | restore the service as quickly as possible | security incidents are a subset; distinguish from problem management |
| **Problem management** | find and remove the root cause of recurring incidents | root cause analysis, known error database |
| **Service level management** | define and monitor SLAs, OLAs, UCs | security metrics in the SLA |
| **Availability management** | ensure the agreed availability | redundancy, HA |
| **Capacity management** | enough resources now and in the future | prevents outages due to lack of resources |
| **Continuity management** | continuation of service after a disaster | BCP/DRP, tests |
| **Information security management** | confidentiality, integrity, availability of services | security policy, risk, controls |
| **Continual improvement** | ongoing improvement of services and processes | lessons from incidents, PDCA cycle |

Incident and problem are often confused: **incident management** restores the service (a workaround is acceptable), **problem management** finds and removes the cause. If the same incident recurs every week, you open a problem record.

> **On the exam:** every change in production, including urgent security patches, goes through change management. An emergency change has expedited approval and after-the-fact documentation, but does not bypass the process. The answer "the administrator applies the patch immediately without a record because it is critical" is wrong.

## Example scenarios

**Scenario 1.** A private cloud on VMware; the team needs to patch ESXi hosts without service interruption. Order: change approved, host into **maintenance mode** (DRS live-migrates the VMs), patch, verification, exit maintenance mode, next host. The cluster capacity must tolerate one fewer host (N+1).

**Scenario 2.** A scanner shows that 30% of Linux instances deviate from the CIS baseline because administrators changed settings manually. BEST: the baseline in a golden image and configuration management, continuous compliance monitoring, automatic remediation or instance replacement, and restricting direct access to servers.

**Scenario 3.** An IaaS customer asks who is responsible for the temperature and fans in the servers and the hypervisor firmware. Answer: the CSP. The customer verifies this through SOC 2 Type II and ISO 27001 reports and the contract, and is itself responsible for the guest OS, network controls in its VPC, data, and identities.

**Scenario 4.** Management wants one framework to align IT goals with business goals that internal auditors can also use. The BEST choice is COBIT. If they require certification of IT service management for a client contract, that is ISO/IEC 20000-1.

## Summary

- **5.1 hardware**: HSM for organizational keys (FIPS 140, M of N, tamper protection), TPM for platform integrity (measured boot, attestation, vTPM). Secure by default: a secure initial state without additional steps.
- The **management plane** is the most valuable target: isolated network, phishing-resistant MFA, least privilege, immutable logs; operationally it covers scheduling, orchestration, and maintenance.
- **Hypervisor**: Type 1 (bare metal, cloud) vs. Type 2 (hosted, less secure). Virtual hardware: network (vSwitch settings, segmentation), storage (encryption, zeroing), memory (isolation, encryption), CPU (side-channel, microcode patches). The guest toolset is a privileged channel: up to date, minimal, controlled.
- **5.2 access**: RDP and SSH never directly on the internet; bastion/jumpbox or managed session with MFA and logging; SSH certificates; PAW.
- **Network**: VLAN (and VLAN hopping), TLS 1.2+, DHCP snooping, DNSSEC (integrity, not confidentiality), VPN (IPsec, TLS). Controls: firewall, IDS (passive) vs. IPS (inline), honeypot (enticement, not entrapment), vulnerability assessment, NSG, bastion, segmentation.
- **Hardening**: baseline (CIS, STIG, vendor guide) → golden image → monitoring → remediation; Windows, Linux, VMware specifics.
- **Patch management**: inventory, risk-based prioritization, test, change, phases, verification; immutable replacement in the cloud; compensating controls.
- **Availability**: DRS, dynamic optimization, storage clusters (tightly vs. loosely coupled), maintenance mode, HA and anti-affinity. Monitoring of network, compute, storage, response time, and hardware with baselines and alerts. Backup: 3-2-1(-1-0), immutable, encryption, tested restore.
- **5.3**: NIST CSF 2.0 and 800-53, ISO 27001/27017/27018, ISO/IEC 20000-1 (ITSM certification), ITIL (practices), COBIT (IT governance), COSO (internal control), CIS Controls and Benchmarks, HIPAA (law). ITSM processes: change, configuration, release, incident vs. problem, SLM, availability, capacity, continuity, information security, continual improvement.
