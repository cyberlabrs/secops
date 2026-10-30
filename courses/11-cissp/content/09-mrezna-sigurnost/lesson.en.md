## Exam Objectives: Domain 4 (4.1–4.3)

Domain 4 is **Communication and Network Security** and carries **12.8%** of the exam according to the 2027 outline. (In the 2024 outline the weight is 13%.) This module covers all three objectives:

- **4.1 Apply secure design principles in network architectures**
  - OSI and TCP/IP models,
  - IPv4 and IPv6 (unicast, broadcast, multicast, anycast),
  - secure protocols (IPSec, SSH, SSL/TLS),
  - implications of multilayer protocols,
  - converged protocols (iSCSI, VoIP, InfiniBand over Ethernet, Compute Express Link),
  - transport architecture (topology, data/control/management plane, cut-through/store-and-forward),
  - performance metrics (bandwidth, latency, jitter, throughput, signal-to-noise ratio),
  - traffic flows (north-south, east-west),
  - physical segmentation (in-band, out-of-band, air-gapped),
  - logical segmentation (VLAN, VPN, Virtual Routing and Forwarding, virtual domain),
  - micro-segmentation (overlay/encapsulation, distributed firewalls, routers, IDS/IPS, Zero Trust),
  - edge networks (ingress/egress, peering),
  - wireless networks (Bluetooth, Wi-Fi, Zigbee, satellite),
  - cellular networks (4G, 5G),
  - CDN,
  - SDN (API, SD-WAN, NFV),
  - VPC,
  - monitoring and management (observability, traffic flow/shaping, capacity management, fault detection and handling),
  - software-defined security.
- **4.2 Secure network components**
  - operation of infrastructure (redundant power, warranty, support),
  - NAC systems (physical and virtual solutions),
  - transmission media (physical security of media, signal propagation quality),
  - endpoint security (host-based).
- **4.3 Implement secure communication channels according to design**
  - voice, video, and collaboration (conferencing, video meeting rooms),
  - data communications (backhaul networks, satellite),
  - remote access (network administrative functions, remote working),
  - third-party connectivity (telecom providers, hardware support).

> In the 2024 outline the sub-item **software-defined security** does not exist, 4.3 says "Zoom rooms" instead of "video meeting rooms", and remote access does not include "remote working". The content is otherwise the same.

You know VPCs, NetworkPolicy, service mesh and WAF from practice. Here the CISSP does not ask for configuration but for **vocabulary and decisions**: at which OSI layer a control operates, which protocol provides which security service (CIA, authentication, nonrepudiation), and which design best fits a business requirement with the least risk.

## OSI and TCP/IP Model (4.1)

### Layers, PDUs and typical devices

| # | OSI layer | PDU | Protocols / examples | Devices and controls |
|---|---|---|---|---|
| 7 | **Application** | data | HTTP, DNS, SMTP, SNMP, LDAP, SIP | WAF, proxy, application firewall |
| 6 | **Presentation** | data | encoding, compression, encryption (ASCII, JPEG, MIME) | — |
| 5 | **Session** | data | session establishment and teardown (NetBIOS, RPC, SOCKS) | circuit-level gateway |
| 4 | **Transport** | segment (TCP) / datagram (UDP) | TCP, UDP, (TLS is often placed here or at 5–6) | stateful firewall, L4 load balancer |
| 3 | **Network** | packet | IP, ICMP, IPSec, OSPF, BGP | router, packet filter firewall |
| 2 | **Data Link** | frame | Ethernet, 802.1Q, ARP, PPP, 802.11 MAC | switch, bridge, WAP |
| 1 | **Physical** | bit | cables, signals, 802.11 radio | hub, repeater, modem |

Mnemonic from the top: **All People Seem To Need Data Processing**. From the bottom: **Please Do Not Throw Sausage Pizza Away**.

The TCP/IP model has four layers: **Application** (OSI 5–7), **Transport** (Host-to-Host, OSI 4), **Internet** (OSI 3) and **Network Access / Link** (OSI 1–2).

| Term | Meaning |
|---|---|
| **Encapsulation** | each layer adds a header when sending; deencapsulation on receipt |
| **TCP** | connection-oriented, three-way handshake (SYN, SYN/ACK, ACK), reliable, ordered |
| **UDP** | connectionless, no acknowledgment, fast; DNS queries, VoIP, streaming, SNMP, syslog |
| **ARP** | IP → MAC at L2; has no authentication, so it is the basis for ARP spoofing (defense: Dynamic ARP Inspection, static entries for critical devices) |

### Firewalls by generation

| Type | Layer | Decision based on | Note |
|---|---|---|---|
| **Packet filter** (static) | 3–4 | IP, port, protocol (ACL) | fast, does not keep state |
| **Stateful inspection** | 3–4 | connection state table | the standard at the perimeter |
| **Circuit-level gateway** | 5 | session establishment (SOCKS) | does not look at content |
| **Application-level gateway / proxy** | 7 | protocol content | deepest inspection, slower |
| **NGFW** | 3–7 | application, user, IPS, TLS inspection | convergence of functions |
| **WAF** | 7 | HTTP patterns | protects a web application |

Architectures: **screened host** (router + bastion), **screened subnet / DMZ** (two firewalls or one with three interfaces), **dual-homed / multi-homed** host. A **bastion host** is a hardened system exposed to an untrusted network.

> **On the exam:** when a question asks "at which layer", answer by function, not by product. A router decides by IP address, so L3; a switch by MAC address, L2; a WAF and a proxy understand HTTP, L7. If the question mentions a "frame", it means L2; "packet" means L3; "segment" means L4.

## IPv4, IPv6 and Addressing Methods (4.1)

| Method | Description | IPv4 | IPv6 |
|---|---|---|---|
| **Unicast** | one to one | yes | yes |
| **Broadcast** | one to everyone in the segment | yes (255.255.255.255, directed broadcast) | **does not exist** |
| **Multicast** | one to a group that has subscribed | 224.0.0.0/4, IGMP | ff00::/8, MLD |
| **Anycast** | one to the nearest of several nodes with the same address | via BGP (DNS root, CDN) | natively supported |

IPv6 differences relevant to security:

- 128-bit addresses, an enormous space, so classic scanning of an entire subnet is impractical (but not impossible with predictable addresses).
- **SLAAC** (stateless autoconfiguration) and the **Neighbor Discovery Protocol** replace ARP; the risk is rogue Router Advertisement packets (defense: **RA Guard**, SEND).
- IPSec was a mandatory part of the specification for IPv6 implementations, and today it is recommended; it is not automatically enabled.
- **Dual stack** and tunnels (6to4, Teredo) often bypass IPv4 security controls. If the network "has no IPv6" but hosts have it enabled, there is an unnoticed channel.
- NAT is not a security control in the IPv6 world; filtering must be explicit.

Private IPv4 ranges (RFC 1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. APIPA: 169.254.0.0/16. IPv6 equivalents: unique local fc00::/7, link-local fe80::/10.

## Secure Protocols (4.1)

| Protocol | Layer | What it provides | Key details |
|---|---|---|---|
| **IPSec** | 3 | confidentiality, integrity, source authentication, anti-replay | **AH** (integrity + authentication, no encryption, does not work through NAT), **ESP** (encryption + integrity), **IKE** (key negotiation, Security Associations) |
| IPSec **transport mode** | — | protects the payload, the original IP header remains | host-to-host |
| IPSec **tunnel mode** | — | encapsulates the entire original packet in a new one | site-to-site VPN, gateway-to-gateway |
| **TLS 1.2/1.3** | 4–7 | confidentiality, integrity, server authentication (and client authentication with **mTLS**) | TLS 1.3 removes static RSA key exchange, forward secrecy mandatory |
| **SSL** | — | obsolete and insecure (SSL 2.0/3.0) | on the exam "SSL" often means TLS; the choice is always the latest TLS version |
| **SSH** | 7 | secure replacement for Telnet, rlogin, FTP (SFTP, SCP), port forwarding | key authentication instead of a password |
| **SNMPv3** | 7 | authentication and encryption | v1/v2c send the community string in cleartext |
| **DNSSEC** | 7 | integrity and authenticity of DNS responses | **does not provide confidentiality**; for that, DoH/DoT |
| **S/MIME, PGP** | 7 | email signing and encryption | nonrepudiation through a digital signature |
| **HTTPS, LDAPS, FTPS, SMTPS** | 7 | the protocol over TLS | — |

Insecure protocols that should be replaced: Telnet → SSH, FTP → SFTP/FTPS, HTTP → HTTPS, SNMPv1/2 → SNMPv3, LDAP → LDAPS (or StartTLS), TFTP → SFTP.

> **On the exam:** "IPSec without encryption" is AH. "Protecting the entire original packet between two gateways" is ESP in tunnel mode. "DNS integrity" is DNSSEC, but if query privacy is required, DNSSEC is not the answer. If the answer options say "SSL 3.0" and "TLS 1.3", choose TLS 1.3.

## Multilayer and Converged Protocols (4.1)

A **multilayer protocol** is a protocol that spans multiple layers or encapsulates other protocols. The classic exam example is **DNP3** (an industrial SCADA protocol): designed for closed networks, without authentication, and today it travels over TCP/IP. Implications:

- **Advantage**: flexibility, they can run over existing infrastructure.
- **Risk**: **covert channels**, filter bypass (protocol within a protocol, e.g., tunneling over DNS or HTTP), encapsulated traffic the firewall does not understand, VLAN hopping via a double 802.1Q tag.
- **Control**: deep packet inspection, protocol-aware firewalls, segmentation of OT networks.

**Converged protocols** combine specialized protocols with standard networks (usually IP or Ethernet):

| Protocol | What it converges | Security consideration |
|---|---|---|
| **iSCSI** | SCSI block storage over IP (port 3260) | isolated storage VLAN, CHAP authentication, IPSec for encryption |
| **FCoE** (Fibre Channel over Ethernet) | FC over Ethernet (L2, not routable) | requires lossless Ethernet, separate segment |
| **VoIP** (SIP, RTP) | voice over IP | SRTP and SIPS/TLS, separate voice VLAN, QoS, protection against toll fraud |
| **InfiniBand over Ethernet (RoCE)** | RDMA (direct memory access) over Ethernet | high performance in HPC and AI clusters; RDMA bypasses OS controls, so segmentation is key |
| **Compute Express Link (CXL)** | coherent link between CPU, memory and accelerators over PCIe | shared memory between devices, risk of data leakage between domains; protection through IDE (link integrity and encryption) |
| **MPLS** | label switching between L2 and L3 ("layer 2.5") | separates customer traffic, but **does not encrypt** |

> **On the exam:** convergence reduces costs, but **the physical isolation** that the specialized network had **is lost**. The correct answer is almost always logical isolation (VLAN, separate segment) plus authentication and encryption at the protocol level.

## Transport Architecture and Performance (4.1)

### Topologies

| Topology | Advantage | Disadvantage |
|---|---|---|
| **Bus** | simple | a single cable fault brings everything down, collisions |
| **Star** | fault isolated to one node | the central device is a single point of failure |
| **Ring** | predictable access (token) | failure of one node breaks the ring (except dual ring, FDDI) |
| **Mesh** (full/partial) | greatest redundancy | expensive, complex |
| **Spine-leaf** | predictable latency in the data center, east-west traffic | many links required |

### Planes

| Plane | Function | Protection |
|---|---|---|
| **Data plane** (forwarding) | forwards user traffic | ACL, firewall, encryption |
| **Control plane** | decides where (routing protocols, STP, ARP) | routing protocol authentication (OSPF/BGP MD5 or TCP-AO), CoPP (control plane policing) |
| **Management plane** | device administration (SSH, SNMP, API) | separate management network (OOB), MFA, RBAC, logging |

### Switch forwarding methods

- **Store-and-forward**: receives the whole frame, checks the **FCS/CRC**, then forwards. Higher latency, but discards corrupted frames.
- **Cut-through**: forwards as soon as it reads the destination MAC address. Minimal latency (HPC, trading), but passes corrupted frames.
- **Fragment-free**: a compromise, reads the first 64 bytes.

### Performance metrics

| Metric | Definition | Why it matters for security |
|---|---|---|
| **Bandwidth** | theoretical link capacity (e.g., 1 Gb/s) | DDoS planning, sizing |
| **Throughput** | the amount actually transferred per unit of time | always ≤ bandwidth; a drop indicates a problem or an attack |
| **Latency** | delay from source to destination | IPS and TLS inspection add latency |
| **Jitter** | variation in latency | kills VoIP and video quality |
| **SNR** (signal-to-noise ratio) | ratio of signal power to noise, in dB | low SNR = errors, retransmissions; a wireless signal that "leaks" outside the facility is also a confidentiality risk |

Example: a 100 Mb/s link, 62 Mb/s of useful transfer measured. Bandwidth is 100, throughput 62. If latency is 40, 45, 38 and 60 ms, the average is 45.75 ms, and jitter (range of deviation) is high because of the jump to 60 ms, which will be noticeable in a VoIP call.

## Traffic Flows and Segmentation (4.1)

**North-south** is traffic entering or leaving the data center/VPC (clients, internet). **East-west** is traffic between servers, services and pods within the environment. A classic perimeter firewall sees only north-south; an attacker's lateral movement is east-west. That is why modern design adds controls inside.

### Physical segmentation

| Type | Description | Example |
|---|---|---|
| **In-band management** | management through the same network that carries production traffic | SSH to the production interface |
| **Out-of-band (OOB)** | a separate, independent management network | console servers, iDRAC/iLO on a separate network, LTE modem for emergency access |
| **Air-gapped** | a completely physically separated network, with no connection to other networks | classified systems, OT safety systems, offline root CA |

An air gap is not absolute: removable media, vendor maintenance and electromagnetic emanation can bridge it. Supporting controls are media control (scanning kiosk), physical security and TEMPEST protection.

### Logical segmentation

| Technique | Layer | What it separates |
|---|---|---|
| **VLAN** (802.1Q) | 2 | broadcast domains on the same switch; risk of VLAN hopping (defense: disable DTP, an unused native VLAN, explicit trunks) |
| **VPN** | 3 or higher | a logically private tunnel over a public network |
| **VRF** (Virtual Routing and Forwarding) | 3 | multiple independent routing tables on the same router; overlapping address spaces |
| **Virtual domain** (VDOM, virtual context) | 3–7 | one physical firewall split into multiple logical firewalls with separate administration |

### Micro-segmentation

**Micro-segmentation** applies policy at the level of an individual workload, not an entire subnet. Components from the outline:

- **Overlay/encapsulation**: VXLAN, Geneve, GRE. A logical network over the physical one, independent of the physical topology.
- **Distributed firewalls**: rules are enforced in the hypervisor or on the host (e.g., security groups, Kubernetes NetworkPolicy).
- **Distributed routers** and **IDS/IPS** on each host or in the service mesh.
- **Zero Trust**: no implicit trust based on network location; every request is authenticated, authorized and its context checked (NIST SP 800-207: PDP/PEP, more on this in the IAM module).

> **On the exam:** when a scenario describes an attacker who, after compromising one server, spreads laterally through a "flat" network, the best long-term answer is micro-segmentation/Zero Trust, not yet another perimeter firewall. If the question asks about managing network devices while the production network is under attack, the answer is out-of-band management.

## Edge, Wireless and Cellular Networks (4.1)

### Edge networks

- **Ingress filtering**: drop incoming packets with source addresses that cannot come from outside (own range, RFC 1918, bogons). **Egress filtering**: drop outgoing packets with other parties' source addresses (BCP 38), so the organization does not take part in spoofed DDoS and limits exfiltration.
- **Peering**: direct exchange of traffic between networks (IXP, private peering, cloud peering). Risks: BGP hijacking and route leaks; controls: **RPKI** (route origin validation), prefix filtering, contracts.

### Wireless networks

| Standard / technology | Key security facts |
|---|---|
| **WEP** | broken (RC4, short IV); never |
| **WPA** | TKIP, interim solution; obsolete |
| **WPA2** | AES-CCMP; Personal (PSK) or **Enterprise (802.1X/EAP + RADIUS)** |
| **WPA3** | **SAE** (Simultaneous Authentication of Equals) instead of PSK, resistance to offline password attacks, forward secrecy; Enterprise 192-bit mode; OWE for open networks |
| **Bluetooth** | risks: bluejacking (unsolicited messages), bluesnarfing (data theft), bluebugging (taking control); controls: disable discoverable mode, up-to-date firmware, BLE pairing with protection |
| **Zigbee** | IEEE 802.15.4, mesh, low power (IoT, smart buildings); AES-128, but keys are often distributed insecurely during pairing |
| **Satellite** | high latency (GEO ~600 ms round-trip), LEO lower; risk of eavesdropping and jamming, end-to-end encryption required |

EAP methods: **EAP-TLS** (certificate on the client too, strongest), **PEAP** and **EAP-TTLS** (TLS tunnel, password inside), **EAP-FAST** (Cisco, PAC), **LEAP** (obsolete). A fake access point (**evil twin**, rogue AP) is detected with a WIDS/WIPS system.

### Cellular networks

| Generation | Important for the exam |
|---|---|
| **4G LTE** | mutual authentication of subscriber and network (AKA), radio interface encryption; a downgrade to 2G removes these protections |
| **5G** | concealed subscriber identity (**SUCI** instead of the IMSI in cleartext), **network slicing** (logical networks with different SLAs and isolation), MEC (edge computing), private 5G networks for industry; many more IoT devices and a software-defined core (larger attack surface) |

A cellular connection bypasses the corporate perimeter: a device with a hotspot is an uncontrolled bridge. Policy and MDM address this.

## CDN, SDN, VPC and Software-Defined Security (4.1)

A **CDN** (Content Delivery Network) caches content on geographically distributed edge nodes (anycast). Security benefits: absorbs volumetric DDoS, hides the origin, WAF at the edge, TLS termination. Risks: entrusting TLS keys and content to a third party, caching sensitive responses, an origin reachable by bypassing the CDN (control: the origin accepts only traffic from the CDN).

**SDN** (Software Defined Networking) separates the **control plane** (central controller) from the **data plane** (switches). The controller communicates with devices through the **southbound API** (e.g., OpenFlow), and with applications and orchestration through the **northbound API** (REST).

| Term | Description | Security |
|---|---|---|
| **SDN controller** | the central brain of the network | the most valuable target: compromised controller = compromised network; HA, hardening, MFA, mTLS toward devices |
| **SD-WAN** | software-managed WAN over multiple transports (MPLS, internet, LTE) with central policy | tunnel encryption (IPSec), often with **SASE** (SD-WAN + cloud security: SWG, CASB, ZTNA, FWaaS) |
| **NFV** (Network Functions Virtualization) | firewall, router, load balancer as virtual machines/containers instead of hardware | hypervisor security, VNF isolation, image management |

A **VPC** (Virtual Private Cloud) is a logically isolated network at a cloud provider: subnets (public/private), route tables, internet and NAT gateways, **security groups** (stateful, at the instance level) and **network ACLs** (stateless, at the subnet level), VPC peering, private endpoints, flow logs. Shared responsibility: the provider isolates VPCs, you configure everything inside yours.

**Software-defined security** (new in the 2027 outline) is security policy expressed as code and applied programmatically through APIs: security groups and policies defined in IaC, automatic workload quarantine from SOAR, policies that follow a workload when it moves (not tied to an IP address or physical port), micro-segmentation managed from a central console. The advantage is consistency and speed; the risk is that a code error or a compromised pipeline changes the security of the entire environment at once. That is why change management, code review and versioning are applied to the policy.

## Network Monitoring and Management (4.1)

| Function | Content |
|---|---|
| **Network observability** | metrics, logs, flows (NetFlow/IPFIX, VPC flow logs), packet visibility (TAP, SPAN), telemetry; the goal is to understand behavior, not just "up/down" |
| **Traffic flow / shaping** | QoS, prioritization (voice ahead of backup), rate limiting, policing, protecting critical traffic during congestion |
| **Capacity management** | tracking trends and planning before congestion becomes an availability problem |
| **Fault detection and handling** | SNMP traps, syslog, health checks, automatic failover, escalation and RCA |

A network TAP is passive and more reliable for evidence than a SPAN port (which drops packets under load).

## Secure Network Components (4.2)

### Operation of infrastructure

Availability of network equipment is part of the CIA triad:

- **Redundant power**: dual power supplies in the device (dual PSU) on two independent circuits, UPS for bridging, generator for longer outages.
- **Redundancy of equipment and paths**: HA pairs, two ISPs, different cable routes (path diversity).
- **Warranty and support**: maintenance contract (part replacement time, e.g., 4h NBD), access to firmware patches, **EOL/EOS** tracking. A device without vendor support receives no security patches, which is a risk that must be recorded or eliminated.
- On-site spare parts (cold spares) for critical components.

### NAC (Network Access Control)

NAC decides whether a device may join the network and in which segment, based on identity and state (**posture**): OS version, patches, EDR active, disk encryption.

| Term | Description |
|---|---|
| **802.1X** | port-based NAC: **supplicant** (client), **authenticator** (switch/WAP), **authentication server** (RADIUS) |
| **Pre-admission** | check before network access |
| **Post-admission** | continuous checking after access, reassessment |
| **Agent / agentless** | persistent or dissolvable agent, or agentless scanning |
| **Remediation / quarantine VLAN** | a noncompliant device goes into a restricted segment until it is fixed |
| **Physical NAC** | an appliance on the campus, control of physical ports |
| **Virtual NAC** | a software solution in a virtual or cloud environment; part of the ZTNA approach |

MAC filtering is not a strong control because a MAC address is easily spoofed.

### Transmission media

| Medium | Properties | Security |
|---|---|---|
| **Coaxial** | more resistant to EMI than UTP | obsolete in LANs |
| **Twisted pair (UTP/STP)** | cheap, up to ~100 m; STP shielded | emanation, eavesdropping through physical access, crosstalk |
| **Fiber optic** | no EMI, long distances, hard to tap (but possible by bending) | best choice for protection against emanation and interference |
| **Wireless** | the signal goes beyond the walls | encryption mandatory, control of antenna power and placement |

Signal propagation quality: **attenuation** (weakening with length), **crosstalk** (interference between pairs), **EMI/RFI** (interference). Physical protection of media: cables through locked conduits and plenum space (plenum-rated cable because of toxic smoke), locked cabinets, inspection of cable routes, protection against taps.

### Endpoint security

Host-based controls: **HIDS/HIPS**, host firewall, **EDR/XDR**, anti-malware, application allowlisting, disk encryption, hardening (CIS benchmark), patch management, **MDM/UEM** for mobile devices, DLP agent. On the CISSP, the endpoint is the last line of defense in the defense in depth model and a key element of Zero Trust (device posture is an input to the access decision).

> **On the exam:** if the question is "which medium BEST protects against emanation-based eavesdropping and EMI", the answer is fiber optics. If the question is how to prevent an unknown laptop from gaining access when physically plugged into a wall jack in a meeting room, the answer is 802.1X/NAC, not MAC filtering.

## Secure Communication Channels (4.3)

### Voice, video and collaboration

- **VoIP**: SIP (signaling, over TLS = SIPS), RTP (media, encrypted = **SRTP**). Separate voice VLAN, QoS for jitter, protection against **toll fraud** (unauthorized international calls through a compromised PBX), **vishing** and **SPIT** (spam over internet telephony).
- **PBX**: the traditional risk is **phreaking** and remote maintenance access (DISA); change default passwords, disable unused features.
- **Conferencing and video rooms**: meeting access with a password/waiting room, preventing unauthorized entry ("zoombombing"), end-to-end encryption where needed, control over recording and retention of recordings (privacy, legal requirements), **room devices** (cameras, microphones, displays in the room) as IoT: firmware updates, separate segment, turning them off when not in use.
- **Collaboration tools** (chat, file sharing): classification and DLP, external guests, retention, eDiscovery.

### Data communications

- **Backhaul**: the link between edge sites (base stations, branches) and the network core. It often runs over a third party or microwave, so it requires encryption (IPSec, MACsec) and redundancy.
- **Satellite links**: for remote sites (ships, mines), high latency with GEO, limited bandwidth, possibility of eavesdropping over a wide area (footprint). End-to-end encryption and a backup path.
- **Leased line, MPLS, Frame Relay, ATM** (classic WAN): MPLS isolates but does not encrypt.
- **MACsec** (802.1AE): encryption at L2, hop-by-hop.

### Remote access

| Option | Description | When |
|---|---|---|
| **Site-to-site VPN** | IPSec tunnel between gateways | branches, partner |
| **Remote access VPN** | client (IPSec or TLS/SSL VPN) | employees outside the office |
| **Split tunneling** | only corporate traffic goes through the tunnel | lower load, but the device is on the internet and in the corporate network at the same time (risk); a **full tunnel** is more secure |
| **ZTNA** | access to an individual application after verifying identity and device posture | replacement for a VPN that gives access to the whole network |
| **Jump box / bastion / PAM** | an intermediary for administrative access, with session recording | **network administrative functions** |
| **VDI** | data stays in the data center, only the image goes to the endpoint | working from untrusted devices |

Classic authentication protocols for remote access: **PAP** (cleartext password, never), **CHAP** (challenge-response, periodic reauthentication), **EAP** (a framework for various methods). AAA servers: **RADIUS** (UDP, encrypts only the password, combines authentication and authorization) and **TACACS+** (TCP, encrypts the entire payload, separates AAA functions, ideal for administering network devices because it provides per-command authorization).

**Remote working** (new in 2027): the home router and family devices are an untrusted network. Controls: managed device, full-tunnel VPN or ZTNA, MFA, EDR, a physical privacy policy (screen, conversations), a ban on printing sensitive documents at home or rules for their destruction.

### Third-party connectivity

- **Telecom providers**: contract and SLA (availability, time to repair), redundant providers with different routes, encryption over their network because the provider is not in your trust zone.
- **Hardware support and vendors**: vendor remote access only through a controlled channel (PAM, time-limited, approved, recorded), a separate **extranet** or DMZ segment, the principle of least privilege, contractual obligations (NDA, right to audit, incident notification). The classic attack through an HVAC vendor shows why third-party access must be segmented.
- An **Interconnection Security Agreement (ISA)** and an **MOU/MOA** document the technical and management conditions for connecting two organizations (NIST SP 800-47).

> **On the exam:** a question about vendor access usually offers "give a VPN account with permanent access" and "time-limited, monitored access through an intermediary, under contract". Choose the latter. And before the technology, the real FIRST step is the contract and the third-party risk assessment.

## Scenarios

**Scenario 1.** A hospital introduces IP telephony on the existing network and at the same time offers patients guest Wi-Fi. What is most important? Separate VLANs for voice, medical devices, users and guests; QoS for voice; SRTP/SIPS; guest Wi-Fi with no path at all to the internal network; WPA3-Enterprise for staff. Life safety: medical devices and emergency communications take priority in the redundancy design.

**Scenario 2.** A factory has a SCADA system that uses DNP3, and management wants engineers to monitor production from home. Correct approach: risk assessment, the OT network stays segmented (Purdue model), access through a DMZ and a jump host with MFA, one-way data transfer for reports (data diode) where possible, no direct access from the internet.

**Scenario 3.** An attacker has compromised a web server in the DMZ and is scanning the database in the internal network from it, because the firewall allows all traffic from the DMZ to the database. The cause is a bad policy (too many permissions), and the solution is an allowlist of only the required port from the application server to the database, micro-segmentation and IDS on east-west traffic.

## Summary

- OSI: 7 layers, PDUs (bit, frame, packet, segment, data), devices and controls per layer; TCP/IP has 4 layers.
- IPv6 has no broadcast, it has anycast and multicast; dual stack and tunnels bypass IPv4 controls.
- IPSec: AH (no encryption), ESP (with encryption), transport vs tunnel mode, IKE. TLS 1.3 instead of SSL. DNSSEC provides integrity, not confidentiality.
- Multilayer protocols (DNP3) and encapsulation open covert channels; converged protocols (iSCSI, FCoE, VoIP, RoCE, CXL) lose physical isolation.
- Data/control/management plane; store-and-forward checks the CRC, cut-through is faster; bandwidth ≠ throughput, jitter is the variation in latency.
- North-south vs east-west; OOB management; air gap; VLAN, VPN, VRF, virtual domain; micro-segmentation and Zero Trust against lateral movement.
- Ingress/egress filtering, RPKI for peering; WPA3/SAE, 802.1X/EAP-TLS; 5G SUCI and network slicing.
- A CDN absorbs DDoS; SDN centralizes the control plane (the controller is a key target); SD-WAN, NFV, VPC; software-defined security is policy as code.
- Components: redundant power, support and EOL, NAC/802.1X with posture checking, fiber against EMI and emanation, host-based protection.
- Channels: SRTP/SIPS, protection of video rooms and recordings, encrypted backhaul and satellite, ZTNA and full tunnel, TACACS+ for administration, controlled and contract-covered third-party access.
