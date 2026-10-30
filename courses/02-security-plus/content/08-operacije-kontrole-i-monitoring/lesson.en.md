## Exam objectives: 4.1, 4.2, 4.3, and 4.4

This module covers most of domain 4 (**Security Operations**, 27% of the exam, the largest domain):

- **4.1** apply mitigating controls and techniques in a given scenario (segmentation, deception, IDS/IPS, firewalls, NAC, EDR, email security, SELinux…),
- **4.2** explain the security implications of managing hardware, software, and data as assets,
- **4.3** perform vulnerability management tasks (identification, prioritization, remediation, verification, reporting),
- **4.4** explain alerting and monitoring concepts and tools (SIEM, NetFlow, SNMP, syslog, SCAP, dashboards).

Here the exam likes scenarios such as: "What is the BEST control for this problem?" The key is to recognize **which layer** the problem is on (network, host, application, email, identity) and pick the tool that works on exactly that layer.

## 4.1 Mitigating controls and techniques

### Segmentation, access control, hardening, sandboxing

| Term | What it is | DevOps/cloud example |
|---|---|---|
| **Segmentation** | Dividing the network into zones so a compromised part can't see the rest. Limits **lateral movement**. | A VPC with separate subnets, Security Groups, Kubernetes `NetworkPolicy`, a dedicated VLAN for IoT. |
| **Access controls** | Who may do what: ACLs, permissions, IAM policies. | AWS IAM policy, Azure RBAC, an ACL on an S3 bucket. |
| **Hardening** | Reducing the attack surface: turn off unnecessary services, close ports, change default passwords, apply patches and a benchmark. | CIS Benchmark for Ubuntu, a distroless container image, `readOnlyRootFilesystem`. |
| **Sandboxing** | Running untrusted code in an isolated environment without access to the rest of the system. | Detonating a suspicious attachment in the email gateway's sandbox, gVisor/Firecracker, the browser sandbox. |

> **On the exam:** "Prevent a compromised IoT device from being used to attack servers" = **segmentation**. "Analyze a suspicious attachment without risk to production" = **sandboxing**. "Remove unnecessary services and default accounts" = **hardening**.

### Deception and disruption technology

The goal: get the attacker to waste time on fake resources and **alert** us in the process. Legitimate users never touch these resources, so **any** access is suspicious (almost zero false alarms).

| Term | What it is | Example |
|---|---|---|
| **Honeypot** | A single fake system that looks vulnerable. | A fake SSH server on port 22 that records login attempts. |
| **Honeynet** | A network of several honeypots, a more realistic environment. | A fake subnet with "web," "DB," and "file" servers. |
| **Honeyfile** | A fake file with an enticing name; opening it triggers an alert. | `lozinke_2026.xlsx` ("passwords") on a file share with an audit rule. |
| **Honeytoken** | A fake piece of data/credential that serves no purpose except detection. | A fake AWS access key in a repository; a CloudTrail alert on any use. A fake record in the customer database. |
| **Canary account** | A fake user account (often with a "privileged" name) that nobody uses. | An `svc-backup-admin` account in AD; every login attempt is an alert. |

> **On the exam:** a honeyfile is a **file**, a honeytoken is **data or a credential** (key, token, record), a canary account is an **account**. If the question says "a fake API key planted in code to detect a leak," the answer is **honeytoken**.

### Monitoring/alerting, MDM, application control

- **Monitoring/alerting**: continuous monitoring and automatic alerts (covered in detail in 4.4).
- **MDM** (Mobile Device Management): central management of mobile devices: enforcing a PIN and encryption, **remote wipe**, containerization of work data, installing/blocking apps. Examples: Microsoft Intune, Jamf.
- **Application control**:
  - **Allow list**: **only** what's on the list runs. The strongest protection, but it requires maintenance. Examples: AppLocker, Windows Defender Application Control (WDAC).
  - **Block list**: everything is allowed except what's listed. Easier to maintain, but new malware isn't on the list.

> **On the exam:** for a kiosk, POS terminal, or industrial system (fixed purpose), the best choice is an **allow list**. "Zero-day malware still ran" is the typical weakness of a **block list**.

### Intrusion detection/prevention systems

| System | Where it works | What it does |
|---|---|---|
| **NIDS** | On the network, passively (via a SPAN port or TAP). | Detects and alerts, doesn't block. |
| **NIPS** | On the network, **inline** (traffic passes through it). | Detects and **blocks** in real time. |
| **HIDS** | Agent on the host. | Monitors logs, file integrity, processes; alerts. |
| **HIPS** | Agent on the host. | Additionally blocks malicious actions on the host. |
| **WIPS** | Wireless network (sensors). | Detects and suppresses rogue APs, evil twins, deauth attacks. |

Detection methods: **signature-based** (known signatures, fast, doesn't catch zero-days) and **anomaly/behavior-based** (deviation from a baseline, catches the unknown, more false alarms).

> **On the exam:** IDS = detection (passive), IPS = prevention (inline). If a device "must be inline" or "must stop the attack," it's an IPS. If the question says an IPS failure interrupted traffic, that's the cost of inline placement (fail-closed). A network sensor can't see the content of **encrypted** traffic; a HIDS/EDR on the host itself helps there.

### Firewalls

| Term | Description |
|---|---|
| **Rule-based** | Rules (ACLs) by source, destination, port, protocol; processed top to bottom, first match wins, with an **implicit deny** at the end. |
| **Layer 4** | Decides based on IP addresses, ports, and connection state (stateful). Fast, but doesn't understand the application. |
| **Layer 7** (NGFW, application-aware) | Understands the application protocol: distinguishes, e.g., Facebook chat from Facebook games on the same port 443, works with user identity. |
| **WAF** (Web application firewall) | Protects **web applications** at L7: SQL injection, XSS, path traversal (e.g., the OWASP Core Rule Set). AWS WAF, Azure Front Door WAF, ModSecurity. |
| **Rate-limiting requests** | Limits the number of requests per source over time; mitigates brute force, scraping, and application-layer DoS attacks. E.g., `limit_req` in nginx, API Gateway throttling. |
| **UTM** (Unified threat management) | One device with multiple functions: firewall, IPS, antivirus, content filter, VPN. Simple for small companies, but a **single point of failure** and a bottleneck. |

```text
# example rule-based rules (first match wins)
1  ALLOW  TCP  any          -> 10.0.1.10  443
2  ALLOW  TCP  10.0.9.0/24  -> 10.0.1.10  22
3  DENY   ANY  any          -> any        any    # implicit deny, written out explicitly
```

> **On the exam:** "Protect a web application from SQL injection without changing the code" = **WAF**. "A small company wants one device for everything" = **UTM**. "A rule doesn't work even though it was added" often means it sits below a broader DENY rule (ordering).

### Content filter

- **DLP** (Data loss prevention): recognizes sensitive data (card numbers, national ID numbers, classification labels) and blocks/encrypts/alerts when it leaves the organization. Works on the endpoint, network, email, and in the cloud (e.g., Microsoft Purview DLP).
- **Agent-based** filtering: an agent on the device filters web traffic regardless of where the device is (home, hotel). Good for remote workers.
- **Centralized proxy**: all web traffic goes through a central proxy that filters URL categories and scans content. It only covers traffic that actually passes through the proxy (i.e., through the corporate network or VPN).

> **On the exam:** "Laptops work from home without a VPN, and filtering must apply everywhere" = **agent-based** filter. "An employee sends a file with card numbers to a personal email" = **DLP**.

### Endpoint security

| Tool | Description |
|---|---|
| **Antivirus** | Traditional malware detection, primarily by signatures. |
| **EDR** (Endpoint detection and response) | An agent records endpoint telemetry (processes, network, registry), detects behavior, and enables **response**: host isolation, killing processes, forensics. E.g., Microsoft Defender for Endpoint, CrowdStrike Falcon. |
| **XDR** (Extended detection and response) | Extends EDR: correlates data from endpoints, network, email, identity, and cloud in a single platform. |

> **On the exam:** "We need to remotely isolate an infected laptop from the network and see the process tree" = **EDR**. "Correlation of endpoint + email + identity in one tool" = **XDR**.

### Network access control (NAC)

NAC decides whether a device may join the network and in which zone.

- **802.1X**: port-based authentication. Three roles: **supplicant** (client), **authenticator** (switch or AP), **authentication server** (usually **RADIUS**). Uses EAP (e.g., EAP-TLS with certificates). Until authentication succeeds, the port passes only EAP traffic.
- **Endpoint posture/compliance**: checking the device's state before access (up-to-date OS, EDR enabled, disk encryption). A non-compliant device goes to a **quarantine/remediation VLAN**. The agent can be **persistent** or **dissolvable**, and there's also agentless checking.
- **Captive portal**: a web page that appears before network access (accepting terms, guest sign-in). Typical for guests and hotel Wi-Fi.

> **On the exam:** "A switch port must require authentication before network access" = **802.1X**. "An unpatched laptop goes into quarantine" = **posture assessment**. "Guests accept the terms of use" = **captive portal**.

### Repositories: secrets scanning

**Secrets scanning** looks for passwords, API keys, tokens, and private keys in code and commit history. Tools: GitHub secret scanning and push protection, GitLab secret detection, gitleaks, trufflehog. It's best to scan **before** the push (pre-commit hook, push protection), because a secret that has been pushed stays in the history.

```bash
gitleaks detect --source . --redact      # scan the repository, including history
```

If a secret has leaked: **revoke/rotate it first**, and only then clean the history. Deleting the commit doesn't help if the key has already been copied.

### Application security

- **Input validation**: the server checks the type, length, format, and range of every input; an allow list (what's permitted) is preferred. The main defense against injection attacks (along with parameterized queries). Client-side-only validation (JavaScript) is easily bypassed.
- **Secure cookies**: the attributes `Secure` (HTTPS only), `HttpOnly` (JavaScript can't read it, protecting the session cookie from XSS theft), `SameSite` (restricts sending in cross-site requests, helps against CSRF).

```http
Set-Cookie: session=af3c...; Secure; HttpOnly; SameSite=Strict; Path=/
```

- **Static code analysis** (SAST): analyzing source code **without executing it**, in the CI pipeline (e.g., Semgrep, SonarQube, CodeQL). The opposite is dynamic analysis (DAST), which tests the application while it runs.
- **Code signing**: signing code with the publisher's private key; the user/system verifies **integrity** and **origin** (that the code wasn't modified and comes from the stated publisher). In the container world: image signing (e.g., Sigstore cosign) and verification at deploy time.

> **On the exam:** code signing proves **who** published the code and that it **wasn't modified**, but it does NOT prove the code is secure or bug-free.

### Email security: SPF, DKIM, DMARC, BIMI

All four are published as **DNS TXT records** of the sender's domain, and they're checked by the **receiving server**.

| Mechanism | What it checks | Where the record lives |
|---|---|---|
| **SPF** (Sender Policy Framework) | Whether the **IP address** of the sending server is authorized for the domain (from the envelope-from/Return-Path). | `example.com` TXT |
| **DKIM** (DomainKeys Identified Mail) | A **digital signature** over the message headers and body; proves integrity and that the domain signed it. The public key is in DNS. | `selektor._domainkey.example.com` TXT |
| **DMARC** | **Policy**: what to do if SPF/DKIM fail or aren't **aligned** with the visible From address, and where to send **reports**. | `_dmarc.example.com` TXT |
| **BIMI** (Brand Indicators for Message Identification) | Displays the brand's **logo** next to the message in supported email clients. Requires DMARC in enforcement mode (quarantine or reject). | `default._bimi.example.com` TXT |

Example records:

```text
; SPF: Microsoft 365 and one IP are allowed; everything else hard fails
example.com.                     TXT "v=spf1 include:spf.protection.outlook.com ip4:203.0.113.10 -all"

; DKIM: public key for selector "s1" (the signature in the message carries d=example.com; s=s1)
s1._domainkey.example.com.       TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."

; DMARC: reject messages that fail, send aggregate reports to the address
_dmarc.example.com.              TXT "v=DMARC1; p=reject; rua=mailto:dmarc-izvjestaji@example.com; adkim=s; aspf=s"

; BIMI: the logo in SVG format and (optionally) a certificate confirming the right to the mark
default._bimi.example.com.       TXT "v=BIMI1; l=https://example.com/brand/logo.svg; a=https://example.com/brand/vmc.pem"
```

Details to know:

- SPF qualifiers: `-all` = hard fail (reject), `~all` = soft fail (mark), `?all` = neutral. SPF has a limit of **10 DNS lookups**; too many `include:` entries break the check.
- SPF breaks with forwarding because the IP changes; DKIM usually survives forwarding because the signature travels with the message.
- DMARC policies: `p=none` (monitor and send reports only), `p=quarantine` (to spam), `p=reject` (reject). Recommended rollout path: none → quarantine → reject, while monitoring the `rua` reports.
- DMARC passes if **at least one** of SPF or DKIM passes **and** is aligned with the domain in the From header.

> **On the exam:** "Confirm the message wasn't modified in transit" = **DKIM**. "List which servers may send mail for the domain" = **SPF**. "Tell recipients to reject spoofed messages and send reports" = **DMARC**. "Show the company logo in the inbox" = **BIMI**.

### Operating systems security

- **Group Policy** (Windows/Active Directory): centrally enforcing settings via GPOs: password policy, account lockout, AppLocker, firewall, USB restrictions. Order of application: **Local → Site → Domain → OU** (later overrides earlier). Commands: `gpupdate /force` (apply now), `gpresult /r` (what was actually applied).
- **SELinux** (Security-Enhanced Linux): an implementation of **MAC** (mandatory access control) in the Linux kernel. Every process and file has a **context** (label); the policy determines what a process type may do with a file type, even if the process is root.

```bash
getenforce                 # Enforcing | Permissive | Disabled
setenforce 0               # temporarily switch to Permissive (logs only, doesn't block)
ls -Z /var/www/html        # show the SELinux context of files
ausearch -m avc -ts recent # review denied (AVC) accesses
```

Modes: **Enforcing** (enforces and logs), **Permissive** (logs only, useful for diagnostics), **Disabled**. The equivalent on Debian/Ubuntu is AppArmor.

> **On the exam:** "Restrict what a compromised web server process may do even if it runs as root" = **SELinux** (MAC). "Enforce settings on a thousand Windows computers in the domain" = **Group Policy**.

## 4.2 Asset management

You can't protect what you don't know exists. Inventory is the foundation for vulnerability management, incident response, and licensing. It applies to **hardware**, **software**, and **data**.

| Lifecycle phase | What happens | Security implication |
|---|---|---|
| **Planning/scoping** | What we need, for what purpose, what requirements (security, regulatory). | Security requirements come in from the start, not as an afterthought. |
| **Acquisition/procurement process** | Purchasing from vetted suppliers, contracts, licenses. | Supply chain risk (counterfeit hardware, software with a backdoor); vendor vetting. |
| **Assignment/accounting** | Recording in the inventory (CMDB), assigning an **owner**, classification. | Clear accountability for patches and access; classification determines the controls. |
| **Monitoring/asset tracking** | Tracking location, state, versions, licenses; discovering unauthorized assets (*shadow IT*). | An unrecorded server doesn't get patches and isn't monitored. |
| **Disposal/decommissioning** | Secure retirement: wiping/destroying media, revoking access, updating the inventory. | Data leaks from discarded disks; forgotten DNS records and cloud resources (subdomain takeover). |

Wiping methods in the disposal phase: **sanitization** (e.g., cryptographic erase or overwriting), **destruction** (physical destruction: shredding, incineration, degaussing for magnetic media), with a **certificate of destruction** from the service provider.

DevOps examples: tagging cloud resources (`Owner`, `Environment`, `DataClassification`), AWS Config / Azure Resource Graph for inventory, an SBOM as an inventory of software components.

> **On the exam:** "Who is responsible for this server?" is an **assignment/accounting** question (ownership). "Old disks were sold with data on them" is a failure in **disposal/decommissioning**. "An unknown device was found on the network" = **asset tracking**.

## 4.3 Vulnerability management

The cycle: **Identification → Prioritization (analysis) → Remediation → Verification → Reporting**, and around again.

### Identification methods

- **Scanning**: vulnerability scanners (Nessus, OpenVAS/Greenbone, Qualys, container scanners such as Trivy).
  - **Credentialed**: sees installed packages and configuration from the inside, more accurate, fewer false positives.
  - **Non-credentialed**: sees what an attacker sees from the outside.
  - **Agent** vs **agentless**, **internal** vs **external** scanning.
- **IPAM** (IP Address Management): a record of the address space, DHCP, and DNS. Helps discover devices that aren't in the inventory and determine what needs scanning (you can't scan a subnet you don't know about).
- **CSPM** (Cloud security posture management): continuously checks cloud configuration against best practices and standards: a public S3 bucket, a security group open to `0.0.0.0/0`, an unencrypted disk, a root account without MFA. Examples: Microsoft Defender for Cloud, AWS Security Hub, Wiz, Prisma Cloud.
- **Source code review**: manual or automated (SAST) code review to find vulnerabilities before production.

### Prioritization

- **Severity assessment**: estimating severity, most often with a **CVSS** (Common Vulnerability Scoring System) score from 0 to 10: Low 0.1–3.9, Medium 4.0–6.9, High 7.0–8.9, Critical 9.0–10.0. CVSS is only the starting point: consider **exposure** (internet-facing?), **asset criticality**, whether there's **active exploitation** (e.g., the CISA KEV catalog) and the probability of exploitation (EPSS), as well as existing compensating controls.
- **Penetration test report review**: reviewing the pentest findings. A pentest shows what's **actually exploitable** and attack chains (several medium vulnerabilities chained into a critical path), so it's a good input for prioritization.

Terms: **false positive** (the scanner reports a vulnerability that isn't there), **false negative** (a vulnerability exists but the scanner doesn't report it; more dangerous because it gives a false sense of security).

### Remediation, Verification, Reporting

- **Remediation**: patching, configuration changes, upgrades; if a patch doesn't exist or can't be applied: **compensating controls** (e.g., a WAF rule, segmentation), an **exception/exemption** with formal risk acceptance; with cyber insurance, part of the risk is transferred.
- **Verification**: a **rescan** or retest to confirm the vulnerability is actually gone; an audit; checking that the patch didn't break functionality.
- **Reporting**:
  - **Internal**: reports for management and teams (trends, number of open criticals, time to remediation).
  - **External**: how the outside world reports vulnerabilities **to us**:
    - **Bounty program** (bug bounty): rewards for researchers who report vulnerabilities, with clear rules and scope (e.g., via HackerOne or Bugcrowd).
    - **Responsible disclosure policies**: how to report (e.g., `security.txt`), what's allowed, the deadline before public disclosure, a promise not to sue the researcher if they follow the rules.

```text
# https://example.com/.well-known/security.txt  (RFC 9116)
Contact: mailto:security@example.com
Expires: 2027-10-01T00:00:00Z
Policy: https://example.com/security/disclosure
```

> **On the exam:** after applying a patch, the next step is **verification** (rescan), not the report. When two findings have the same CVSS, priority goes to the one on an internet-facing system or the one being actively exploited.

## 4.4 Alerting and monitoring

### What we monitor

- **Systems**: CPU, memory, disk, processes, logins, services on servers and workstations.
- **Application**: application logs, errors, failed logins, unusual request patterns.
- **Infrastructure**: network devices, hypervisors, the cloud control plane (CloudTrail, Azure Activity Log), the Kubernetes audit log.

### Activities

| Activity | Description |
|---|---|
| **Log aggregation** | Collecting logs from many sources in one place, with format normalization and time synchronization (NTP!). |
| **Alerting** | Automatic notifications when a rule/correlation fires. |
| **Scanning** | Periodic scanning of vulnerabilities and configurations. |
| **Archiving** | Long-term log storage (retention) for investigations and regulations; cheaper storage, immutable (WORM/immutable). |
| **Reporting** | Periodic reports on status, trends, and compliance. |
| **Alert tuning** | Adjusting rules to reduce false positives without losing real detections. Counters **alert fatigue**. |

> **On the exam:** "The SOC team ignores alerts because there are too many and most are false" = **alert tuning** is needed. The fix is NOT turning off rules entirely.

### Tools

- **SIEM** (Security information and event management): aggregates and normalizes logs, **correlates** events from multiple sources, alerts, and supports investigations and compliance reports. Examples: Splunk, Microsoft Sentinel, Elastic Security.
- **Agents/agentless**: an agent on the host sends richer data and works even off the network, but it must be installed and maintained; agentless (e.g., via API, WMI, SSH, syslog) is easier to roll out but provides less detail.
- **Benchmarks**: reference secure configurations (CIS Benchmarks, DISA STIG) against which compliance is checked.
- **Antivirus** and **DLP**: sources of alerts (malware detection, data exfiltration attempts).
- **Vulnerability scanners**: sources of vulnerability findings.
- **Orchestration**: automatically connecting tools and responses (SOAR, more in module 09).
- **Packet analyzer**: capturing and analyzing packets (Wireshark, tcpdump). Provides the **full content** of traffic.

### Protocols

| Protocol | What it provides | Note |
|---|---|---|
| **NetFlow** (and the IETF standard **IPFIX**) | **Metadata** about flows: who talked to whom, when, which ports, how many bytes. **No packet content.** | Excellent for spotting exfiltration (a large outbound flow) and beaconing, takes little space. |
| **SNMP** | Monitoring and managing network devices; a **trap** = the device reports an event on its own. | UDP 161 (queries) and 162 (traps). v1/v2c use a community string in cleartext; use **SNMPv3** (authentication + encryption). |
| **syslog** | A standard log format and transport (Linux, network devices). | Traditionally UDP 514; more secure over TLS (TCP 6514). |
| **SCAP** (Security Content Automation Protocol) | A NIST suite of standards for automated compliance and vulnerability checking: CVE, CVSS, CPE, CCE, XCCDF (checklist), OVAL (state checks). | Lets different tools exchange and run the same checks, e.g., `oscap` with a CIS/STIG profile. |

```bash
# SCAP check of a Linux host against a profile (OpenSCAP)
oscap xccdf eval --profile xccdf_org.ssgproject.content_profile_cis \
  --report izvjestaj.html /usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml
```

### Automated alerts, port mirroring, dashboards, NMS

- **Automated alerts**: alerts sent automatically (email, Slack, PagerDuty, a ticket) when a threshold is reached or a rule matches.
- **Port mirroring** (SPAN): the switch copies traffic from one or more ports to a port where an IDS or packet analyzer is listening. The alternative is a physical **network TAP** (more reliable, doesn't drop packets under load).
- **Dashboards**: a real-time visual overview of status (number of alerts, top attack sources, patch status) for the SOC and management.
- **Network management systems (NMS)**: central tools for monitoring network devices (availability, performance, configuration), mostly via SNMP. E.g., Zabbix, PRTG, LibreNMS.

> **On the exam:** "We need to see which internal host is sending large amounts of data out, without storing packet content" = **NetFlow**. "We need packet content" = **packet capture** via **port mirroring**. "Correlating logs from the firewall, AD, and servers" = **SIEM**.

## Summary

- Choose the control by the layer of the problem: network (segmentation, firewall, NIDS/NIPS, NAC), host (EDR, HIPS, application allow list, SELinux, GPO), application (WAF, input validation, secure cookies, SAST, code signing), email (SPF, DKIM, DMARC, BIMI).
- Deception: honeypot/honeynet (systems), honeyfile (file), honeytoken (data/credential), canary account (account); any touch is an alert.
- An IDS detects passively, an IPS blocks inline; a WAF protects web applications at L7; a UTM is all-in-one, but a single point of failure.
- 802.1X = supplicant + authenticator + RADIUS; a posture check sends non-compliant devices to quarantine; a captive portal for guests.
- SPF = who may send (IP), DKIM = signature and integrity, DMARC = policy + reports + alignment, BIMI = logo with DMARC enforcement.
- Asset lifecycle: planning → acquisition → assignment (owner!) → monitoring/tracking → disposal (sanitization, certificate of destruction).
- Vulnerability management: identification (scanning, IPAM, CSPM, code review) → prioritization (CVSS + context + pentest) → remediation → verification (rescan) → reporting (internal, bug bounty, responsible disclosure).
- Monitoring: a SIEM correlates, NetFlow provides metadata, packet capture provides content, SNMPv3 for devices, syslog for logs, SCAP for automated compliance; alert tuning against alert fatigue.
