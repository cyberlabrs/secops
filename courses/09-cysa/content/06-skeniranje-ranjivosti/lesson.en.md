## Exam objectives: 2.1

- **2.1** Given a scenario, implement the appropriate vulnerability scanning method: from asset inventory and scan planning, through choosing the scan type (internal/external, agent/agentless, credentialed/non-credentialed, passive/active), to discovery scanning and checking compliance with baseline standards (PCI DSS, CIS, ISO 27000).

Domain 2 (Vulnerability Management) accounts for **26%** of the exam. Objective 2.1 is scenario-based: you'll get a description of an environment (OT network, PCI segment, cloud, laptops off the network) and need to choose the method that gives accurate results, doesn't take down production, and satisfies regulations.

In the Security+ course (module 4) you learned what a vulnerability is, and in the DevSecOps course you scanned images with Trivy and dependencies with osv-scanner. CySA+ looks at it from the perspective of the analyst who runs the scanning **program**: what we scan, when, with which approach, and how we know coverage is complete.

## Vulnerability management lifecycle

Scanning is only one phase. CompTIA questions often ask you to recognize which phase you're in:

| Phase | What you do | Example |
|---|---|---|
| **Asset inventory / discovery** | Find out what exists | CMDB, discovery scan, cloud API inventory |
| **Planning** | Scope, schedule, permissions, impact | Scan window at 02:00, exclude a fragile PLC |
| **Scanning** | Run the appropriate scan type | Credentialed scan of Windows servers |
| **Analysis** | Validate findings, remove false positives | Check for a backported patch on Debian |
| **Prioritization** | Rank by risk | CVSS + EPSS + KEV + asset value (module 7) |
| **Remediation / mitigation** | Patch, configuration, compensating control | Updating OpenSSL, WAF rule |
| **Validation** | A rescan confirms the fix | Rescan shows the finding no longer exists |
| **Reporting** | Metrics, trends, SLA | Mean time to remediate by criticality (module 11) |

> **On the exam:** if a question asks what to do **FIRST** before launching a scanning program, the answer is almost always **asset inventory** (you can't protect what you don't know about), followed immediately by defining scope and approval (**scope / authorization**).

## Asset inventory

**Asset inventory** is the foundation: a scanner without an inventory doesn't know whether it covered 60% or 100% of the environment. Inventory sources:

- **CMDB** (Configuration Management Database) and ITSM tools: the official list, but often outdated.
- **Discovery scans** (ping sweep, ARP, nmap): find even what nobody recorded (shadow IT, forgotten servers).
- **Cloud API**: AWS Config, `aws ec2 describe-instances`, Azure Resource Graph. As in the AWS Security course: Config rules and Security Hub provide inventory and findings per account and region.
- **EDR/MDM agents**: Defender for Endpoint, Intune, Wazuh agent (detection lab) report installed software.
- **Passive monitoring**: DHCP logs, NetFlow, Zeek `conn.log` reveal devices that talk on the network.
- **SBOM**: an inventory of components inside software (module 8).

Every inventory item should have: an owner (**asset owner**), criticality (**asset criticality / value**), data classification, location (internet-facing, internal, isolated), and operational status. Those attributes later feed directly into prioritization (objective 2.3, "asset value" and "context awareness").

> **On the exam:** a difference between the number of hosts in the CMDB and the number of hosts found by a discovery scan is a finding in itself: **unmanaged or rogue systems**. The correct response is to add them to the inventory, find the owner, and include them in scanning, not just ignore them.

## Planning considerations

CompTIA lists six things to consider before scanning:

| Consideration | Question you ask | Typical decision |
|---|---|---|
| **Scheduling** | When and how often? | Outside business hours, in a maintenance window; continuous for agents; after every change; PCI requires quarterly |
| **Operations** | Does the scan disrupt the business? | Coordination with system owners and the NOC, change ticket, emergency stop contact |
| **Performance** | How much load on the network and hosts? | Limit parallelism and speed (throttling), agents instead of a network scan over the WAN |
| **Sensitivity levels** | How aggressive is the scan? | Safe checks, no DoS tests; disable "dangerous plugins" in production |
| **Segmentation** | Can the scanner even reach the target? | A scanner in each segment or firewall rules for the scanner IP; dedicated scanners for OT and the PCI CDE |
| **Regulatory requirements** | What do regulations require? | PCI DSS: internal and external scan quarterly and after significant change, external by an ASV |

### Sensitivity levels

The **sensitivity level** (a "scan policy" or "scan config" in Nessus/OpenVAS) determines how many tests and which kinds are run:

- **Discovery / host enumeration**: only whether the host exists and which ports are open.
- **Safe / non-intrusive**: version and configuration checks, without sending payloads that could crash a service.
- **Full / intrusive**: includes checks that try to actually trigger the vulnerability or a DoS. Only with explicit approval and in a test environment.

Old ICS/SCADA devices, printers, and medical devices can go down from an aggressive TCP scan alone. For them, choose passive monitoring or a very gentle scan in an agreed window.

> **On the exam:** a scenario like "after the scan, a PLC in the factory restarted" or "a hospital device stopped working" calls for **passive scanning** or reduced scan sensitivity (safe checks, throttling) with coordination with the owner, not "turn off scanning" or "scan more often".

### Segmentation and scanner placement

If the firewall between the scanner and the target only allows port 443, the scan will report the host as "clean", which is a **false negative**. Solutions: place a **scanner appliance** in each segment, allow the scanner's IP address on the firewall (and document it), or use agents. In AWS: Amazon Inspector uses the SSM agent and does not depend on Security Groups, as you saw in the AWS course.

## Scan types

### Internal vs. external

| | **Internal** | **External** |
|---|---|---|
| Scanner position | Inside the network (behind the perimeter) | From the internet, outside the perimeter |
| What it sees | All internal services, the lateral surface | Only what is exposed to the internet |
| Simulates | An insider or an attacker who is already inside | An external attacker |
| PCI DSS | Internal scan quarterly (req. 11.3.1) | External scan quarterly by an **ASV** (Approved Scanning Vendor) (req. 11.3.2) |

### Agent vs. agentless

| | **Agent-based** | **Agentless** |
|---|---|---|
| How it works | Software on the host collects data locally and sends it to the server | The scanner connects over the network (SSH, WinRM, SMB, SNMP, API) |
| Advantages | Works for laptops off the network, no network load, continuous | No installation, covers devices where an agent can't run (network gear, appliances, IoT) |
| Disadvantages | Installation and maintenance, resource consumption, doesn't work on appliances | Needs network access and credentials, loads the network, only at scan time |
| Examples | Nessus Agent, Qualys Cloud Agent, Amazon Inspector (SSM), Defender Vulnerability Management | Nessus/OpenVAS network scan, cloud API scanners (Prowler, ScoutSuite) |

> **On the exam:** "employees work from home, laptops rarely connect to the VPN, and the scanner never finds them on the network" calls for **agent-based** scanning. "Network devices and appliances on which software cannot be installed" call for **agentless**.

### Credentialed vs. non-credentialed

A **credentialed** (authenticated) scan logs in to the host (SSH key, Windows domain service account, SNMPv3) and reads installed packages, versions, the registry, and configuration. A **non-credentialed** scan sees only what the host reveals over the network (banners, service responses).

| | Credentialed | Non-credentialed |
|---|---|---|
| Accuracy | High: knows the exact package version, including backported patches | Lower: guesses from banners, more false positives and false negatives |
| Perspective | As an administrator (insider) | As an attacker without access |
| Covers | Local vulnerabilities (kernel, client software, browser), configuration, missing patches | Only network-exposed services |
| Risk | Scanner credentials are a valuable target: least privilege, vault, rotation | No credentials to protect |

Best practice for scanner credentials: a dedicated account used only for scanning, the minimum sufficient permissions (on Linux often sudo for reading packages), storage in the scanner's vault or a PAM, monitoring of that account's sign-ins in the SIEM (an unusual sign-in from an IP that isn't the scanner is an alert).

> **On the exam:** "the scan reports a vulnerable OpenSSH version, but the admin insists the server is fully updated": a typical false positive of a non-credentialed scan on a distribution that backports patches (Debian, RHEL). The solution is a **credentialed scan**, not manually deleting the finding.

### Passive vs. active

- **Active scanning** sends packets and requests to targets (nmap, Nessus). Fast and complete, but generates traffic and can affect fragile systems.
- **Passive scanning** only listens to traffic (SPAN port, TAP) and infers which devices, OSs, and versions exist. Examples: Zeek, p0f, Tenable Nessus Network Monitor, OT tools such as Nozomi or Claroty. It doesn't load systems, but sees only what communicates.

An example of passive insight from a pcap (in the lab you scan and capture only your own services on 127.0.0.1):

```
$ tshark -r capture.pcap -Y 'http.server' -T fields -e ip.src -e tcp.srcport -e http.server | sort -u
127.0.0.1	8080	SimpleHTTP/0.6 Python/3.11.2
```

Without sending a single extra packet to the server, we learned the service and version, purely from responses that crossed the network anyway.

## Discovery scanning

### Mapping scans

A **mapping scan** (network mapping) discovers which hosts exist and how the network is structured: live hosts, subnets, paths. Tools: nmap ping sweep (`-sn`), Angry IP Scanner, Masscan for huge ranges (module 7). The result is compared with the inventory.

```
$ nmap -sn 127.0.0.1/30
Starting Nmap 7.93 ( https://nmap.org ) at 2026-10-16 09:12 UTC
Nmap scan report for localhost (127.0.0.1)
Host is up.
Nmap scan report for 127.0.0.2
Host is up.
Nmap scan report for 127.0.0.3
Host is up.
Nmap done: 4 IP addresses (3 hosts up) scanned in 0.03 seconds
```

(The entire 127.0.0.0/8 range answers locally, so this serves only as a demonstration of the format. On a real network `-sn` uses ARP on the local segment and ICMP/TCP probes toward remote ones.)

### Device fingerprinting

**Device fingerprinting** determines what a device is: OS, type, service version. Techniques:

- **Banner grabbing** and **service version detection** (`nmap -sV`).
- **OS fingerprinting** (`nmap -O`): analysis of the TCP/IP stack (TTL, window size, TCP options).
- Passive fingerprinting: p0f, JA3/JA4 TLS client hash, DHCP fingerprint.

```
$ python3 -m http.server 8080 &
$ nmap -sV -p 1-10000 127.0.0.1
Starting Nmap 7.93 ( https://nmap.org ) at 2026-10-16 09:15 UTC
Nmap scan report for localhost (127.0.0.1)
Host is up (0.000060s latency).
Not shown: 9999 closed tcp ports (reset)
PORT     STATE SERVICE VERSION
8080/tcp open  http    SimpleHTTPServer 0.6 (Python 3.11.2)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.51 seconds
```

Interpreting nmap port states:

| State | Meaning | What you conclude |
|---|---|---|
| `open` | An application accepts connections | The service is reachable; check whether it should be |
| `closed` | The host responds (RST), but nobody is listening | The host is alive, the port is not in use |
| `filtered` | No response or ICMP unreachable | Firewall or ACL between the scanner and the target |
| `open\|filtered` | Cannot be distinguished (UDP, FIN scan) | Additional verification needed |

> **On the exam:** many `filtered` ports in the result mean the scanner **cannot see** the target through the firewall. For an accurate scan you need to change the scanner's position or the rules; otherwise the result gives a false sense of security (false negative).

XML output is used for reports and automation:

```
$ nmap -sV -p 8080 -oX scan.xml 127.0.0.1 >/dev/null
$ grep -o '<service [^>]*>' scan.xml
<service name="http" product="SimpleHTTPServer" version="0.6" extrainfo="Python 3.11.2" method="probed" conf="10"/>
```

The field `method="probed" conf="10"` says the version was determined by an active probe, not guessed from the port number (`method="table" conf="3"`).

## Security baseline scanning

**Baseline (configuration compliance) scanning** doesn't look for CVEs, but for deviations from a prescribed secure configuration. The question isn't "is there a bug", but "is the system configured the way the policy says".

| Standard | What it is | What is scanned |
|---|---|---|
| **PCI DSS** (Payment Card Industry Data Security Standard, v4.0.1) | A contractual standard of the card brands for everyone who processes cardholder data | Req. 11.3: internal and external scan quarterly and after significant changes; the external scan is performed by an ASV; rescan until high-risk/critical findings are resolved. Req. 2.2: secure system configurations |
| **CIS Benchmarks** | Free consensus-based hardening guides (OS, cloud, Kubernetes, databases) with Level 1 and Level 2 profiles | Passwords, services, auditing, permissions; tools: CIS-CAT, Nessus/OpenVAS compliance policies, kube-bench (CKS course), Prowler (CIS AWS Foundations) |
| **ISO 27000 series** (ISO/IEC 27001 and 27002) | International standard for an ISMS; 27001 Annex A controls, 27002 guidance for them | Control 8.8 "Management of technical vulnerabilities" requires a process for identifying and mitigating vulnerabilities; 8.9 "Configuration management" |

An example baseline scan report (the format produced by CIS-CAT and scanner compliance policies):

```
CIS Debian Linux 12 Benchmark v1.1.0 - Level 1 Server
[PASS] 1.1.2.1  Ensure /tmp is a separate partition
[FAIL] 5.2.7    Ensure sshd PermitRootLogin is disabled        (found: PermitRootLogin yes)
[FAIL] 5.2.10   Ensure sshd MaxAuthTries is set to 4 or less   (found: 6)
[PASS] 6.1.1    Ensure permissions on /etc/passwd are configured
Score: 187/214 (87%)
```

You did the same in the CKS course with kube-bench (CIS Kubernetes Benchmark) and in the Linux hardening module of the fundamentals course. In the SCAP world the same job is done by **OpenSCAP** and XCCDF profiles.

> **On the exam:** if a scenario mentions cardholder data and quarterly scans, think **PCI DSS** (and an ASV for the external scan). If it asks for "prescriptive hardening guidance for a specific OS", the answer is a **CIS Benchmark**. If it talks about an ISMS and organizational certification, that's **ISO 27001**.

## Special environments

| Environment | Challenge | Approach |
|---|---|---|
| **OT / ICS / SCADA** | Fragile devices, availability above all, legacy protocols (Modbus, DNP3) | Passive monitoring, scanning only during planned downtime, vendor-approved tools |
| **Cloud (IaaS)** | Ephemeral resources, shared responsibility, provider rules | Agents (Inspector, Defender for Cloud), CSPM/API scanners (Prowler, ScoutSuite), image scanning in the registry |
| **Containers and Kubernetes** | Short lifetime, immutable images | Image scanning in CI and the registry (Trivy), admission control (CKS course), runtime (Falco) |
| **IoT and medical devices** | No agent, limited resources, device certification | Passive, segmentation, compensating controls |
| **Mobile and remote users** | Rarely on the network | Agents, MDM reports |
| **Web applications** | Vulnerabilities in logic, not in package versions | DAST (ZAP, Burp), SAST in CI (module 8) |

For cloud there's also the question of permission: AWS, Azure, and GCP today allow scanning your own resources for most services without prior approval, but prohibit DoS tests and scanning the provider's infrastructure. You don't scan SaaS (e.g., Microsoft 365) yourself; instead you check its configuration through the API (SSPM).

## Lab examples: scanning with your own tools

Trivy for an image or file system (the same tool as in the DevSecOps course; here we treat it as a source of findings for the vulnerability management program):

```
$ trivy fs --scanners vuln --severity MEDIUM,HIGH,CRITICAL /opt/app
2026-10-16T09:20:11Z	INFO	Number of language-specific files	num=1

requirements.txt (pip)
Total: 2 (MEDIUM: 1, CRITICAL: 1)

┌──────────┬────────────────┬──────────┬────────┬───────────────────┬───────────────┬──────────────────────────────────┐
│ Library  │ Vulnerability  │ Severity │ Status │ Installed Version │ Fixed Version │              Title               │
├──────────┼────────────────┼──────────┼────────┼───────────────────┼───────────────┼──────────────────────────────────┤
│ jinja2   │ CVE-2024-22195 │ MEDIUM   │ fixed  │ 2.11.3            │ 3.1.3         │ jinja2: HTML attribute injection │
│ pyyaml   │ CVE-2020-14343 │ CRITICAL │ fixed  │ 5.3.1             │ 5.4           │ PyYAML: incomplete fix for ...   │
└──────────┴────────────────┴──────────┴────────┴───────────────────┴───────────────┴──────────────────────────────────┘
```

osv-scanner for a lockfile, checking against the OSV database (in an offline lab it works with a local database if one has been prepared):

```
$ osv-scanner scan source --lockfile requirements.txt
╭─────────────────────────────────────┬──────┬───────────┬─────────┬─────────┬──────────────────╮
│ OSV URL                             │ CVSS │ ECOSYSTEM │ PACKAGE │ VERSION │ SOURCE           │
├─────────────────────────────────────┼──────┼───────────┼─────────┼─────────┼──────────────────┤
│ https://osv.dev/GHSA-8q59-q68h-6hv4 │ 9.8  │ PyPI      │ pyyaml  │ 5.3.1   │ requirements.txt │
╰─────────────────────────────────────┴──────┴───────────┴─────────┴─────────┴──────────────────╯
```

These are **agentless, credentialed-equivalent** findings: the tool reads the actual package versions, so accuracy is high. A network scan of the same host (nmap) sees only port 8080 and knows nothing about PyYAML.

## Scanning limitations and mistakes

| Problem | Consequence | Remedy |
|---|---|---|
| Incomplete inventory | Unscanned hosts (a program-level false negative) | Discovery + CMDB reconciliation |
| Firewall/IPS blocks the scanner | Filtered ports, missing findings | Scanner placement, allowlisting the scanner IP (documented), agents |
| Non-credentialed scan | Guessing from banners | Credentialed scan |
| Outdated plugin feed | New CVEs aren't checked | Automatic feed update before the scan |
| Aggressive policy in production | Service outage | Safe checks, maintenance window, test environment |
| Scanning only once a year | Long exposure time | Continuous scanning (agents), after changes |
| IDS/EDR alerts on the scan | Noise in the SOC, analysts swamped | Announcing the scan, tuning rules for the scanner IP (with monitoring so it isn't abused) |

> **On the exam:** questions like "the analyst received a report with no findings at all for the entire DMZ segment" want you to suspect **coverage** (firewall, wrong scope, expired scanner credentials), not conclude that the segment is secure.

## Quick guide to choosing a method

| Scenario | Best choice |
|---|---|
| Laptops that are rarely in the office | Agent-based |
| Routers, switches, firewall appliances | Agentless (SNMPv3/SSH credentialed) |
| Exact list of missing patches on servers | Credentialed |
| How an attacker on the internet sees us | External, non-credentialed |
| Quarterly requirement for cardholder systems | PCI DSS: internal + external (ASV) |
| Fragile PLCs and HMIs in a factory | Passive |
| What exists at all in a newly acquired network | Discovery (mapping + fingerprinting) |
| Compliance with hardening guidelines | Baseline scan (CIS Benchmark, SCAP) |
| Container images before deployment | Scanning in CI/registry (Trivy) |

## Example scanning plan

What a documented plan looks like for a medium-sized organization (a PBQ may present such a table and ask you to match a system with a method):

| Asset group | Method | Frequency | Note |
|---|---|---|---|
| Public web and VPN gateway | External, non-credentialed + ASV | Weekly + quarterly ASV | Prime candidates for KEV findings |
| Windows and Linux servers | Internal, credentialed, agentless | Weekly, at night | Service account from the vault |
| Laptops | Agent-based | Continuous | Report as soon as the device checks in |
| Network equipment | Agentless, SNMPv3/SSH | Monthly | Safe checks |
| PCI CDE segment | Internal + external, PCI DSS baseline | Quarterly and after significant change | Scanner inside the segment |
| OT network | Passive (SPAN) | Continuous | Active scan only during planned downtime |
| Container images | Trivy in CI and the registry | Every build + daily rescan | New CVEs for an old image |
| Cloud accounts | API/CSPM (Prowler, ScoutSuite) | Daily | CIS AWS Foundations |

Each row also has an owner, an emergency scan-stop contact, and a remediation deadline by criticality (SLO, module 8).

### Approval and rules of engagement

Scanning without the system owner's written approval is both an organizational and a legal problem. The plan therefore contains:

- **Scope**: exact IP ranges, domains, and cloud accounts, with explicitly stated exclusions.
- **Authorization**: signatures of the asset owner and security management; for third parties (hosting, MSP, SaaS), their approval or their rules.
- **Communication**: the SOC and NOC know the scanner IP and schedule, so the scan doesn't trigger an incident (or, worse, so a real attack isn't dismissed as "it's just the scanner").
- **Handling results**: vulnerability reports are sensitive data (a map of weak points), so they are stored with restricted access.

> **On the exam:** if the SOC sees scanning from an IP address that is **not** the documented scanner, or at a time outside the plan, it is treated as potential reconnaissance and investigated, even when it looks like a routine Nessus scan.

## Summary

- A scanning program starts with an **asset inventory**: the owner, criticality, location, and data classification of each system later determine priority.
- Planning includes **scheduling, operations, performance, sensitivity levels, segmentation, and regulatory requirements**; the biggest risks are taking down production or getting a falsely clean report.
- **Internal** sees as an insider, **external** as an attacker on the internet; PCI DSS requires both, quarterly, the external one via an ASV.
- **Agent** is for remote and mobile hosts and continuous monitoring; **agentless** is for devices where nothing can be installed.
- A **credentialed** scan is more accurate and reduces false positives (backports) and false negatives (local vulnerabilities); protect scanner credentials like a privileged account.
- **Passive** scanning is for OT, medical, and fragile devices; **active** is faster and more complete.
- **Discovery**: mapping scans (what exists) and device fingerprinting (what it is and which version); `filtered` ports mean the scanner can't see the target.
- **Baseline scanning** checks configuration against **PCI DSS**, **CIS Benchmarks**, and **ISO 27000** requirements; it doesn't look for CVEs.
