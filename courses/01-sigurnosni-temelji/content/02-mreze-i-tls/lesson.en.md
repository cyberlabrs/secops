## The network from a security angle

As a DevOps engineer you know how networks work. The security view adds three questions: **what is exposed**, **who is allowed to talk to whom**, and **is traffic protected and visible**.

## The TCP/IP refresher you need for security

| Layer | Examples | Typical attacks | Defense |
|---|---|---|---|
| L2 (link) | Ethernet, ARP, VLAN | ARP spoofing, VLAN hopping | port security, DAI, separate VLANs |
| L3 (network) | IP, ICMP, routing | IP spoofing, scanning | ingress and egress filtering, anti-spoofing |
| L4 (transport) | TCP, UDP | SYN flood, port scanning | SYN cookies, rate limiting, firewall |
| L7 (application) | HTTP, DNS, SMTP | injection, API abuse | WAF, validation, authentication |

**TCP three-way handshake:** `SYN` → `SYN-ACK` → `ACK`. Scanning is built on this:

- **Connect scan** (`nmap -sT`): completes the full handshake. Works without root, but leaves a trace in application logs.
- **SYN scan** (`nmap -sS`): sends SYN and answers SYN-ACK with RST. It is faster and needs raw sockets (root).
- Port states in nmap: `open` (something is listening), `closed` (the host replied with RST), `filtered` (no response, probably a firewall).

> Scan only systems you own or have written authorization to test. The same applies to every tool in this course.

### The first question of every review: who is listening?

```bash
ss -tulpn          # listening TCP and UDP ports, with the process
ss -tnp state established
```

`0.0.0.0:5432` means the database listens on **all** interfaces. `127.0.0.1:5432` means local only. The difference between the two is the difference between an incident and a good night's sleep.

## DNS

DNS translates names into addresses and is almost always allowed through the firewall, which is why attackers love it.

- **DNS spoofing / cache poisoning**: a forged response redirects the victim. Defense: **DNSSEC** (signed records) and resolvers that validate it.
- **DNS tunneling**: data is exfiltrated through subdomains (`aGVsbG8.napadac.com`). Detection: unusually long names, a high number of queries to one domain, high entropy.
- **Subdomain takeover**: a CNAME points to a deleted cloud resource, and the attacker registers it. Defense: an inventory of DNS records and cleanup.
- **DoH/DoT** (DNS over HTTPS/TLS) protect privacy, but also bypass corporate DNS monitoring.

## TLS and PKI

TLS provides three things: **confidentiality** (encryption), **integrity** (data hasn't been modified) and **server authenticity** (certificate).

### How a certificate is validated

1. The server sends its certificate and the **intermediate** certificates (the chain).
2. The client builds a chain up to a **root CA** it trusts (the trust store in the OS or browser).
3. It checks: the signature of every link, the validity period, that the hostname matches the **SAN** field (Subject Alternative Name; CN is no longer used for this), and revocation status.

The most common mistake in practice: the server doesn't send the intermediate certificate. Browsers sometimes "fix" this on their own, while `curl` and applications fail.

### Versions and settings

| Item | Recommendation (Mozilla "intermediate" profile) |
|---|---|
| Versions | TLS 1.2 and 1.3; SSL, TLS 1.0 and 1.1 disabled |
| Key exchange | ECDHE (forward secrecy) |
| Ciphers | AEAD: AES-GCM, ChaCha20-Poly1305 |
| HSTS | `Strict-Transport-Security: max-age=63072000` once you're sure everything works over HTTPS |
| Certificates | automated issuance and renewal (ACME, cert-manager) |

**Forward secrecy** means: if someone later steals the server's private key, they can't decrypt previously captured traffic, because the session keys were ephemeral.

**mTLS** (mutual TLS): the client also presents a certificate. The standard for service-to-service communication (service mesh: Istio, Linkerd).

### openssl commands you'll use all the time

```bash
openssl s_client -connect host:443 -servername host </dev/null   # view the chain and version
openssl x509 -in cert.pem -noout -text                             # certificate details
openssl x509 -in cert.pem -noout -enddate -ext subjectAltName
openssl verify -CAfile ca.pem -untrusted intermediate.pem cert.pem
```

## Segmentation

A flat network means: once an attacker gets onto one system, they see everything. Segmentation limits **lateral movement**.

- **Network level**: VPC/VNet subnets, security groups, NSGs, firewalls between zones (public, application, database).
- **Microsegmentation**: rules per workload, not per subnet. In Kubernetes this is `NetworkPolicy` (by default everything is allowed until you add a policy).
- **Egress control**: restrict **outbound** traffic too. Most malware has to "phone home"; a database server has no reason to open connections to the internet.

Rule: **deny by default**, then allow exactly what is needed.

## WAF

A Web Application Firewall inspects HTTP requests and blocks known attack patterns (SQLi, XSS, path traversal) before they reach the application. Examples: AWS WAF, Azure WAF, Cloudflare, ModSecurity with the **OWASP Core Rule Set**.

- A WAF is an **additional layer**, not a replacement for secure code.
- Start in *detection/count* mode, analyze false positives, then switch to *block*.

## Zero trust

The old model: "inside the network = trusted". Zero trust (NIST SP 800-207): **network location does not grant trust**. Every request is verified.

Principles:

1. Verify explicitly: user identity **and** device posture, for every request.
2. Least privilege and *just-in-time* access.
3. *Assume breach*: segment, encrypt internal traffic, monitor everything.

In practice: SSO + MFA, Conditional Access, an identity-aware proxy instead of a VPN to the whole network, mTLS between services.

## Summary

- Know what is listening (`ss -tulpn`) and why.
- TLS 1.2+ with forward secrecy, a correct chain, SAN and automatic renewal.
- Segment and control egress; deny by default.
- WAF and zero trust are layers, not silver bullets.
