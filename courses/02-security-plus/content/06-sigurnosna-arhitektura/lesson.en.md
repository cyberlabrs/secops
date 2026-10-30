## Exam objectives

This module covers **objective 3.1** (*Compare and contrast security implications of different architecture models*) and **objective 3.2** (*Given a scenario, manage the security architecture to best protect the infrastructure*).

For 3.1 the exam asks you to compare models (cloud, on-prem, OT, air-gap, microservices) and know which technical and business factors they bring. For 3.2 you get a scenario and choose where to place a device, how to segment, how to enable secure remote access, and how the system behaves when it fails.

## Cloud architecture

### Deployment models

| Model | Who uses the infrastructure | Security implication |
|---|---|---|
| **Public** | Many unrelated customers share the provider's infrastructure (AWS, Azure, GCP) | Fast start, but shared infrastructure (*multitenancy*) and reliance on the provider |
| **Private** | A single organization (in its own data center or at a hosting provider) | Full control and responsibility, higher cost |
| **Hybrid** | A combination of private and public, connected by a network | Complexity: consistent policies and identity on both sides, a secure link (VPN, Direct Connect, ExpressRoute) |
| **Community** | Several organizations with shared requirements (e.g., government institutions, hospitals) share infrastructure | Shared costs and common compliance rules; requires agreement on responsibilities |

### Shared responsibility model

The **shared responsibility model** determines what the provider protects and what the customer protects. The rule: the provider is responsible for security **of the cloud**, the customer for security **in the cloud**.

| Layer | IaaS (EC2, Azure VM) | PaaS (RDS, App Service) | SaaS (Microsoft 365) |
|---|---|---|---|
| Physical data center, hardware | Provider | Provider | Provider |
| Hypervisor, provider network | Provider | Provider | Provider |
| Operating system, OS patches | **Customer** | Provider | Provider |
| Runtime, middleware | **Customer** | Provider | Provider |
| Application | **Customer** | **Customer** | Provider |
| Data, identities, access | **Customer** | **Customer** | **Customer** |

> **On the exam:** **Data and access management** are ALWAYS the customer's responsibility, regardless of the model. If a question asks who patches the OS on an EC2 instance, the answer is the customer; who patches the OS under an RDS database, the provider.

### Serverless

**Serverless** (e.g., AWS Lambda, Azure Functions) means you don't manage servers: the provider runs code in response to events and bills per execution.

- **Pro:** no OS to patch, short-lived execution, a smaller surface for a persistent attacker foothold.
- **Con:** responsibility shifts to **the code, dependencies, the function's IAM role, and event inputs** (event injection). An overly broad IAM role is the most common problem. Forensics is harder because the environment disappears.

### Multicloud

**Multicloud** means using several public cloud providers (e.g., AWS + Azure). Advantages: resilience to an outage at one provider, avoiding **vendor lock-in**. Disadvantages: more consoles, different IAM models, harder consistent policy and monitoring, more skills needed on the team. Centralized identity (SSO), **CSPM** (*cloud security posture management*), and IaC help.

### Infrastructure as Code (IaC)

**IaC** (Terraform, CloudFormation, Bicep, Pulumi) describes infrastructure as code.

| Advantage | Risk |
|---|---|
| Consistency, repeatability, the same hardening everywhere | A bug in a module is multiplied across all environments |
| Code review and history in git | Secrets in code or in the **state file** (Terraform state can contain sensitive values) |
| Fast recovery: the environment can be rebuilt | Overly broad permissions for the CI/CD pipeline that runs `apply` |
| **Drift** detection (manual changes) | Modules from untrusted sources |

Controls: IaC scanning in the pipeline (e.g., Checkov, Trivy), policy-as-code (OPA, Sentinel), a protected remote state with encryption and locking, secrets from a secrets manager.

## Other architecture models

### On-premises

**On-premises** infrastructure is in your own facility. You have full control, but also full responsibility: physical security, power, cooling, hardware, patches. Scaling takes time (hardware procurement). Suitable when regulations or latency require local data.

### OT (Operational Technology)

**OT** is systems that control physical processes: **ICS** (*industrial control systems*), **SCADA**, **PLC** controllers in factories, energy, and water utilities.

- The priority is **availability and human safety**, not confidentiality. A restart for a patch can stop production.
- Devices last for decades, often have outdated OSes and protocols without authentication (Modbus, older versions of DNP3).
- Protection: **segmentation** of the OT network from the IT network, strictly controlled crossings, passive monitoring, compensating controls where patching isn't possible.

### Air-gapped network

An **air-gapped** network is **physically separated** from other networks and the internet (no cable, no wireless link). It's used for military, critical, and OT systems and for an offline root CA.

The risk doesn't disappear: data transfer happens via **removable media** (USB) and people. Stuxnet is an example of an attack that crossed an air gap via USB. Controls: a strict media procedure, scanning at a kiosk, physical access control.

### Microservices

**Microservices** split an application into small services that communicate through APIs (often in Kubernetes).

- Pro: isolation of failure and compromise to a single service, independent scaling and deployment.
- Con: many more **API endpoints** and east-west network traffic, many service identities and secrets.
- Controls: **mTLS** between services (service mesh, e.g., Istio, Linkerd), an API gateway, Kubernetes **NetworkPolicy**, a separate identity for each service.

### Logical vs physical segmentation

| | **Logical segmentation** | **Physical segmentation** |
|---|---|---|
| How | VLANs, subnets, VPCs, security groups, NetworkPolicy, firewall rules | Separate switches, cables, devices |
| Advantage | Cheap, flexible, quickly changed through code | Stronger isolation, a configuration error doesn't join networks |
| Disadvantage | A misconfiguration (or VLAN hopping) breaks isolation | Expensive, slow to change |
| Example | Separate subnets for web and database in a VPC | Separate hardware for an OT or PCI environment |

## Considerations when choosing an architecture

### Technical considerations

| Term | The question you ask |
|---|---|
| **Availability** | How available does the system have to be? Is there a single point of failure? |
| **Resilience** | Can it withstand a failure and keep running (multiple zones, redundancy)? |
| **Proprietary vs. open source** | Closed source: vendor support, but vendor lock-in and less transparency. Open source: reviewable code and a community, but you're responsible for tracking vulnerabilities and support. |
| **Usability** | If a control is too complicated, users work around it. |
| **Responsibility** | Who is responsible for which layer (shared responsibility)? |
| **Compute** | Does the device have enough processing power for encryption, agents, logging? (IoT and OT often don't) |
| **Power requirements** | Consumption and power supply (edge devices, OT, data centers, UPS) |
| **Ease of recovery** | How quickly does the system come back? IaC and immutable infrastructure make it easier, a manually configured "snowflake" server makes it harder. |

### Business considerations

| Term | Meaning |
|---|---|
| **Data sovereignty** | Data is subject to the laws of the country where it's located; the cloud region is chosen accordingly |
| **Data classification** | More sensitive data calls for a stricter model (e.g., private cloud, special encryption) |
| **Cost** | CapEx (on-prem hardware) vs OpEx (cloud subscription); the cost of a control must not exceed the value of the protection |
| **Ownership** | Who owns the system and the data, who makes risk decisions |
| **Environmental requirements** | Cooling, space, humidity, energy consumption, sustainability |
| **Scalability** | Can the architecture grow with the load (autoscaling in the cloud vs hardware procurement) |
| **Risk** | How much risk the organization accepts for a given model |

> **On the exam:** If a scenario says "EU citizens' data must stay in the EU," the keyword is **data sovereignty** (and data location/residency). If it says "the system must survive an outage at one provider," think **multicloud** and **resilience**.

## Infrastructure considerations (3.2)

### Security zones

**Security zones** group systems with a similar level of trust. Traffic between zones passes through a control.

| Zone | Contents |
|---|---|
| **Untrusted** (internet) | Everything outside |
| **Screened subnet** (formerly DMZ) | Publicly accessible services: web, reverse proxy, mail gateway |
| **Trusted / internal** | Internal servers, databases, users |
| **Management** | Admin interfaces, jump hosts, the OOB network |
| **Guest** | Guests, isolated from the internal network |
| **Restricted** | The most sensitive systems (PCI, OT) |

In AWS: a public subnet with the ALB, a private subnet with the application, an isolated subnet with the database and no route to the internet.

### Device placement

**Device placement** determines what a device sees and protects:

| Device | Typical location |
|---|---|
| Firewall | At the boundary between zones (internet / screened subnet / internal network) |
| IPS (inline) | In the traffic path, behind the firewall, so it can block |
| IDS / sensor | On a **SPAN** port or a **TAP**, passively, where it sees the relevant traffic |
| Load balancer / reverse proxy / WAF | In front of the web servers, in the screened subnet |
| Jump server (bastion) | Management zone, the only entry point for admin access |
| VPN concentrator | At the network edge, sessions terminate in a controlled zone |

### Attack surface

The **attack surface** is the sum of all points through which an attacker can get in: open ports, APIs, accounts, services, dependencies, people. It's reduced by: turning off unnecessary services, closing ports, removing public IP addresses, minimal container images, removing unused accounts and keys.

### Diversity

**Diversity** means using different vendors, technologies, or controls in the layers, so that one vulnerability or mistake doesn't take everything down. Example: an outer firewall from one vendor and an inner one from another; antivirus on the mail gateway different from the one on endpoints. The cost: more knowledge and maintenance.

## Zero Trust architecture

**Zero Trust** starts from the assumption that **network location does not grant trust**. Every request is verified: who the user is, from which device, what state the device is in, which resource is being accessed. The principle: *never trust, always verify*. The reference document is **NIST SP 800-207**.

Elements listed in objective 3.2:

- **User authentication**: strong authentication (MFA, phishing-resistant where possible), continuous session risk assessment.
- **Device management**: **Health** (device state: patches, EDR running, disk encrypted) and **Inventory** (the device is known and enrolled in MDM/inventory). An unknown or unhealthy device doesn't get access.
- **Application access control**: access is granted **per application**, not to the whole network (unlike a classic VPN).

### Control plane and data plane

| Plane | Role | Components |
|---|---|---|
| **Control plane** | Decides on access | **Policy Engine** (makes the decision), **Policy Administrator** (executes the decision: establishes or terminates the session, issues a token); together they form the **PDP** (*policy decision point*). Inputs: adaptive identity, threat intel, device state, policies. |
| **Data plane** | Carries the actual traffic | **Subject/system** (user, device), **PEP** (*policy enforcement point*, the gate that allows or blocks according to the PDP's decision), the resource in the **implicit trust zone** behind the PEP |

Terms worth knowing: **adaptive identity** (the decision depends on context: location, device, behavior), **threat scope reduction** (reducing an attack's reach, e.g., access to only one application), **policy-driven access control**.

> **On the exam:** **The PDP decides, the PEP enforces.** If a question describes a component "that sits between the user and the application and allows or blocks the connection," that's the **PEP** (data plane). The component "that evaluates policy, identity, and device state" is the **policy engine / PDP** (control plane).

## Secure access and communication

### VPN and tunneling

**Tunneling** is encapsulating one protocol inside another, usually with encryption.

| Technology | Note |
|---|---|
| **IPsec** | Network layer; **tunnel mode** encrypts the entire original packet (site-to-site), **transport mode** only the payload (host-to-host). AH provides integrity, ESP provides encryption and integrity. |
| **TLS VPN** (SSL VPN) | Remote access over HTTPS, passes through most firewalls |
| **WireGuard** | A modern, simple VPN protocol |
| **SSH tunnel** | Port forwarding over an SSH connection |
| **GRE** | Encapsulation **without** encryption; often combined with IPsec |

**VPN** types:

- **Site-to-site**: connects networks (an office with a VPC via AWS Site-to-Site VPN).
- **Remote access**: a user on a laptop connects to the network.
- **Full tunnel**: all of the user's traffic goes through the VPN (better visibility and control, higher load).
- **Split tunnel**: only traffic to corporate networks goes through the VPN, the rest goes directly to the internet (lower load, less control).

### Remote access

**Remote access** for administrators should go through a controlled point: a **jump server/bastion**, VPN, or ZTNA, with MFA and session logging. Better than an open SSH/RDP port on the internet are solutions with no open inbound ports (e.g., AWS Systems Manager Session Manager, Azure Bastion).

### User management and user access

**User management** covers creating, modifying, and disabling accounts (*provisioning/deprovisioning*). **User access** should follow **least privilege**: each user gets the minimum rights needed for the job, preferably time-limited (*just-in-time*).

### End-to-end encrypted messaging

**End-to-end encrypted messaging** (e.g., the Signal protocol) encrypts messages so that only the endpoints can read them; even the service provider can't see the content.

- Pro: protection against interception and server compromise.
- Challenges for the organization: DLP and archiving can't see the content, which can be a problem for **compliance** and **legal hold**; security depends on the end devices.

### Out-of-band management

**Out-of-band (OOB) management** is managing devices over a **separate channel**, isolated from the production network: console servers, serial ports, iDRAC/iLO/IPMI interfaces on an isolated management network, a 4G/LTE modem for network gear.

- It works even when the production network is down or under attack.
- Management interfaces aren't exposed to the user network.
- The OOB network needs extra protection (MFA, ACLs, logging), because it gives access to everything.

> **On the exam:** "Administrators must be able to reach the routers even when the main network is unavailable" means **out-of-band management**. **In-band** management uses the same network as production traffic.

### File transfer

| Insecure | Secure replacement |
|---|---|
| **FTP** (passwords in cleartext) | **SFTP** (over SSH) or **FTPS** (FTP over TLS) |
| **TFTP** (no authentication) | SCP/SFTP, HTTPS |
| Sending files by email | **Managed file transfer (MFT)** with logging and access control, a short-lived presigned URL (S3) |

### Security Service Edge (SSE)

**SSE** is a set of security services delivered from the cloud, close to the user wherever they are:

| Component | Role |
|---|---|
| **SWG** (*secure web gateway*) | Web traffic filtering, URL categories, malware |
| **CASB** (*cloud access security broker*) | Visibility and control over SaaS applications, shadow IT, DLP |
| **ZTNA** (*zero trust network access*) | Access to individual applications instead of the whole network |
| Often also **FWaaS**, DLP | Firewall and data protection as a service |

**SASE** (*secure access service edge*) = SSE + the networking part (**SD-WAN**). So SSE is the security half of SASE.

## Identity management for architecture

| Term | Explanation |
|---|---|
| **gMSA** (*Group Managed Service Account*) | An Active Directory service account whose password is **automatically generated and rotated** by the domain; it can be used on multiple servers (e.g., an IIS server farm). Nobody knows the password, so nobody can misuse it or forget to change it. |
| **Least privilege access accounts** | Separate accounts with minimal rights: a regular account for email and web, a separate admin account only for administration; service accounts with only the permissions the service needs |
| **Privilege creep** | Gradual accumulation of rights: a user changes positions, gets new rights, and keeps the old ones. Fix: periodic **access reviews** (recertification) and removing rights when the role changes. |

The cloud equivalent of the gMSA idea: an **IAM role** for EC2/Lambda, a **managed identity** in Azure, workload identity in Kubernetes. All of them avoid long-lived static keys.

> **On the exam:** If you're asked how to avoid manually rotating the password of a service account used by several Windows servers, the answer is **gMSA**. If an analyst discovers that an engineer who moved from finance two years ago still has access to the finance system, that's **privilege creep**.

## Failure modes

**Failure modes** describe what a security device or system does when it fails.

| Mode | Behavior | Priority | Example |
|---|---|---|---|
| **Fail-open** | On failure, lets traffic through / unlocks | **Availability** (or human safety) | An inline IPS that passes all traffic when it fails so as not to interrupt business; doors that unlock during a fire |
| **Fail-closed** (fail-secure) | On failure, blocks traffic / locks | **Confidentiality and integrity** | A firewall that passes nothing when it goes down; a vault that stays locked |

> **On the exam:** If the priority is that business doesn't stop, choose **fail-open**. If the priority is that nothing unauthorized gets through, **fail-closed**. For physical doors where human safety is at stake (fire exits), usually fail-open (fail-safe).

## Summary

- **Shared responsibility**: the provider protects the cloud, you protect what's in the cloud; data and access are always yours.
- Deployment models: **public, private, hybrid, community**; serverless shifts the focus to code and IAM, IaC brings consistency but also multiplied mistakes.
- **OT** prioritizes availability; an **air gap** physically isolates, but removable media remain a risk; **microservices** increase the number of APIs.
- Segmentation can be **logical** (VLAN, VPC, security groups) or **physical** (separate hardware).
- **Zero Trust**: the PDP (policy engine + administrator) in the control plane decides, the **PEP** in the data plane enforces; verification of the user, the device (health, inventory), and per-application access.
- Secure access: VPN (full/split tunnel), jump server, **OOB management**, SFTP/FTPS, E2E messaging, **SSE** (SWG + CASB + ZTNA).
- **gMSA** automatically rotates service account passwords; **privilege creep** is solved with access reviews.
- **Fail-open** preserves availability, **fail-closed** preserves confidentiality.
