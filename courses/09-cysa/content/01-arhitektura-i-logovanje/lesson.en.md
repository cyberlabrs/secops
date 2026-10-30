## Exam objective: 1.1

- **1.1** Explain concepts related to system and network architecture in security operations: logging (ingestion, configuration, integrity, time synchronization, retention), operating system (hardening, file structure, critical files, processes), infrastructure (cloud native, virtualization, containerization, API), device management (mobile, endpoint), network architecture (ZTNA, SASE, hybrid cloud), IAM (PAM, authentication and authorization, secrets management), encryption, data protection and critical infrastructure (OT, ICS, SCADA).

After this module you should know:

- how a log travels from the source to the SIEM and where along that path evidence gets lost or corrupted;
- why NTP, retention and log integrity are forensic questions, not just "IT hygiene";
- which files and processes on Windows and Linux an analyst must recognize by heart;
- how architecture (containers, serverless, ZTNA, SASE, OT) changes what you can see and do;
- where PAM, secrets management and encryption fit into the daily work of a SOC.

You have already seen most of this in the Security+ and AWS courses from the "how it is built" angle. CySA+ asks about the same material from the analyst's angle: **what telemetry does this architecture give me, and what does it deny me**.

## Logging: from source to SIEM

As in the detection lab (Wazuh agent → manager → indexer) and in the SC-200 course (connectors → Log Analytics workspace), every log follows the same path:

```
source (OS, application, firewall, cloud API)
  → collection (agent, syslog, API poll, Event Hub/Kinesis)
  → parsing and normalization (fields, time zone, event type)
  → enrichment (GeoIP, asset, user, threat intel)
  → storage (hot/warm/cold, retention)
  → correlation and alerts
```

### Ingestion

**Ingestion** is the process of bringing logs into a central system. These questions appear on the exam:

| Method | How it works | Advantage | Disadvantage |
|---|---|---|---|
| **Agent** (Wazuh, Splunk UF, AMA) | A process on the host reads local logs and sends them | Rich data, buffering when the network goes down | Must be installed and maintained |
| **Agentless / syslog** | The device sends on its own (UDP/TCP 514, TLS 6514) | Works for network devices and appliances | UDP loses messages, no buffer |
| **API pull** | The SIEM periodically reads an API (CloudTrail, M365) | The only option for SaaS | Latency, API limits |
| **Streaming** | Event Hub, Kinesis, Kafka | High volume in near real time | More complex setup |
| **Forwarder / collector** | An intermediary (Logstash, Cribl, syslog-ng) | Filtering and normalization before the SIEM | Yet another point of failure |

Parsing is where evidence is silently lost: if the parser does not recognize the format, the `src_ip` field stays empty and a rule that filters by IP address never fires. That is why, after adding a source, you always check whether the fields are being populated.

```text
# Raw syslog from a firewall
<134>Oct 16 08:14:02 fw01 kernel: DROP IN=eth0 SRC=203.0.113.45 DST=10.0.1.20 PROTO=TCP SPT=51544 DPT=3389

# After parsing (JSON in the SIEM)
{"host":"fw01","action":"DROP","src_ip":"203.0.113.45","dst_ip":"10.0.1.20","dst_port":3389,"proto":"TCP"}
```

### Configuration

Logging does not work "by itself". The most common reasons there is no evidence during an incident:

- **Audit policy is not enabled**: by default Windows does not log process creation with the command line (Event ID 4688 + "Include command line in process creation events"), nor PowerShell Script Block Logging (4104).
- **Logging level too low**: the application logs only `ERROR`, so failed logons (`WARN`) disappear.
- **Cloud logs are not enabled**: e.g., S3 data events or VPC Flow Logs are optional and cost extra.
- **The local log is overwritten**: the Windows Security log has a maximum size and "overwrite as needed".

```powershell
# Windows: check whether process creation is audited
auditpol /get /subcategory:"Process Creation"
# Process Creation        No Auditing     ← bad
auditpol /set /subcategory:"Process Creation" /success:enable
```

```bash
# Linux: auditd rule to watch changes to /etc/passwd
auditctl -w /etc/passwd -p wa -k identity
ausearch -k identity --start today
```

> **On the exam:** When a scenario says "the analyst cannot find events about executed commands" or "the log does not contain the command line", the answer is almost always **logging configuration** (audit policy, verbosity), not a new tool. Fix the source first, then the SIEM.

### Integrity and security

An attacker who gains administrative rights first tries to remove their traces: Event ID **1102** (Security log cleared) on Windows, `history -c`, deleting `/var/log/auth.log`, turning off CloudTrail (`StopLogging`). Protection:

- **Real-time centralization**: a copy is already in the SIEM before the attacker manages to delete the local log.
- **A separate account and network for logs**: e.g., an AWS log archive account (as in the AWS course), where even the production admin has no right to delete.
- **WORM / immutable storage**: S3 Object Lock, Azure immutable blob.
- **Hashes and signatures**: CloudTrail log file validation, a hash chain over the archive.
- **Access control**: logs contain personal data and secrets, so reading logs is a privilege.

```bash
$ aws cloudtrail validate-logs --trail-arn arn:aws:cloudtrail:eu-central-1:111122223333:trail/org --start-time 2026-10-15T00:00Z
Results requested for 2026-10-15T00:00:00Z to 2026-10-16T08:00:00Z
Results found for 2026-10-15T00:00:00Z to 2026-10-16T08:00:00Z:
24/24 digest files valid
1430/1431 log files valid, 1/1431 log files INVALID
```

One invalid file means someone changed the content after delivery: that by itself is an indicator of compromise.

### Time synchronization

Without a common time, correlation does not work: if the firewall is 4 minutes ahead of the domain controller, "logon, then connection to C2" looks like "connection, then logon". Rules:

- All devices use **NTP** (or PTP in OT/finance) from the same trusted source; in a Windows domain the PDC emulator is the time source.
- Logs are stored in **UTC**, and the time zone is added only on display.
- The SIEM distinguishes **event time** (when it happened) and **ingest time** (when it arrived); a large gap means latency or a forged time.

```bash
$ chronyc tracking
Reference ID    : C0A80001 (ntp1.corp.local)
System time     : 0.000214 seconds slow of NTP time
Leap status     : Normal

$ timedatectl
               Local time: Thu 2026-10-16 10:14:02 CEST
           Universal time: Thu 2026-10-16 08:14:02 UTC
System clock synchronized: yes
```

> **On the exam:** If events from different systems "don't line up" in the timeline or the order is illogical, the root cause is **time synchronization** (NTP). The question "what should be checked first before correlating logs from multiple sources" usually targets exactly this.

### Retention

Retention is how long you keep logs. It is determined by three things: **regulation** (PCI DSS requires 12 months, 3 of them immediately available; some sectors even longer), **operational needs** (the average time to detect an attack is often longer than a month) and **cost**.

| Tier | Purpose | Example |
|---|---|---|
| Hot | Active search, rules | 30–90 days in the SIEM |
| Warm/cold | Investigations, less frequent searches | Data lake, Sentinel auxiliary/archive |
| Archive | Regulation, legal hold | S3 Glacier with Object Lock |

You don't keep "everything forever": logs contain personal data, so GDPR and internal policy also require an **upper** limit, except when a **legal hold** is in effect.

## Operating system

### System hardening

**Hardening** reduces the attack surface: remove unnecessary services and packages, close ports, apply least privilege, enable logging, apply patches. The yardsticks are the **CIS Benchmarks** and DISA STIGs (you saw CIS in the CKS course for Kubernetes). What matters to the analyst is that a hardened system has a **predictable baseline**, so deviations are easier to spot.

### File structure and critical files

On the exam you need to recognize a path and say why a change to it is suspicious.

| OS | File / location | Why it is critical |
|---|---|---|
| Linux | `/etc/passwd`, `/etc/shadow` | Accounts and password hashes; a new account with UID 0 is a backdoor |
| Linux | `/etc/sudoers`, `/etc/sudoers.d/` | Who may become root |
| Linux | `~/.ssh/authorized_keys` | An added key = persistent access without a password |
| Linux | `/etc/crontab`, `/var/spool/cron/`, `/etc/systemd/system/` | Persistence |
| Linux | `/tmp`, `/dev/shm`, `/var/tmp` | World-writable; a favorite place for attacker tools |
| Linux | `/var/log/auth.log` (`/var/log/secure`) | Logons, sudo, SSH |
| Windows | `C:\Windows\System32\config\SAM`, `SYSTEM`, `SECURITY` | Registry hives with hashes |
| Windows | `C:\Windows\System32\drivers\etc\hosts` | Domain redirection |
| Windows | `C:\Windows\System32\winevt\Logs\*.evtx` | Event logs |
| Windows | `%APPDATA%`, `%TEMP%`, `C:\Users\Public` | User-writable: a common malware location |
| Windows | `HKLM\...\CurrentVersion\Run`, `RunOnce` | Autostart persistence |
| Windows | `C:\Windows\System32\Tasks\` | Scheduled tasks |

```bash
# Linux: accounts with UID 0 (should only be root)
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
sysbackup        ← suspicious

# Files in /etc modified in the last 24 hours
$ find /etc -type f -mtime -1 -ls
```

### System processes

An analyst must know what a "normal" process tree looks like. On Windows:

| Process | Normal parent | Normal path | Suspicious if |
|---|---|---|---|
| `smss.exe` | System | `System32` | Multiple instances that stay running |
| `wininit.exe` | smss.exe | `System32` | More than one instance |
| `services.exe` | wininit.exe | `System32` | Parent is not wininit |
| `lsass.exe` | wininit.exe | `System32` | Multiple instances, a different parent, the name `lsas.exe` |
| `svchost.exe` | services.exe | `System32` | Parent is not services.exe, no `-k` parameter |
| `explorer.exe` | userinit.exe (which exits) | `C:\Windows` | Launched from `%TEMP%` |

On Linux, PID 1 is `systemd` (or `init`), kernel threads are in square brackets (`[kworker/0:1]`), and processes with no file on disk or running from `/tmp` are suspicious:

```bash
$ ps -eo pid,ppid,user,cmd --forest | head
    1     0 root     /sbin/init
  612     1 root     /usr/sbin/sshd -D
 4410   612 root      \_ sshd: deploy [priv]
 4433  4410 deploy        \_ -bash
 4501  4433 deploy            \_ /tmp/.x/kworker -c /tmp/.x/c.json   ← fake name, /tmp path

$ ls -l /proc/4501/exe
lrwxrwxrwx 1 deploy deploy 0 Oct 16 08:20 /proc/4501/exe -> /tmp/.x/kworker (deleted)
```

`(deleted)` means the binary was deleted after it was launched: a classic indicator of malware hiding its traces.

> **On the exam:** `svchost.exe` whose parent is not `services.exe`, `lsass.exe` outside `System32`, or a process with a system process name containing a typo (process typosquatting) are the answer to the question "which process is MOST likely malicious".

## Infrastructure and system architecture

| Model | What the analyst sees | What is lost | Key logs |
|---|---|---|---|
| **Virtualization** (VM) | Full OS, classic logs, memory and disk snapshots | The hypervisor is a separate layer the guest cannot see | Hypervisor logs, guest logs |
| **Containerization** | Processes per container, images, runtime events | A container is short-lived; its disk disappears with it | Runtime (Falco), K8s audit log, stdout |
| **Cloud native** (serverless, managed services) | API calls and configuration | OS access, disk forensics | CloudTrail, Activity Log, application logs |
| **API** | Who called what, with which token | Content, if the body is not logged | API gateway logs, WAF |

For containers, what you did in the CKS course applies: **immutability** (a running container is not modified; a new image is built instead), image scanning and runtime detection. The consequence for the analyst is that evidence disappears with the pod, so logs must be shipped out immediately (stdout → log agent) and forensics must be planned in advance (e.g., checkpointing a container before deletion).

**APIs** are today the main entry point into applications and the cloud. Important concepts: authentication with a key or token (OAuth 2.0 bearer), **rate limiting**, the gateway as the central logging point, and **API inventory** (forgotten "shadow" APIs are not monitored). The OWASP API Security Top 10 (e.g., BOLA, broken object level authorization) is a good framework for reading indicators.

## Device management

- **Mobile**: **MDM/UEM** (Intune, Jamf) enforces a PIN, encryption, allowed applications, remote wipe, and separates the business and personal profile (Android Work Profile, BYOD). For the SOC, MDM is a telemetry source: whether the device is **compliant**, rooted, or running an outdated OS. Conditional Access can deny sign-in from a noncompliant device.
- **Endpoint**: **EDR** agent, patch management, configuration baselines (GPO, Intune), software inventory. An unmanaged endpoint is a blind spot: no telemetry, no one-click isolation.

## Network architecture

### Zero Trust and ZTNA

**Zero Trust**: never trust based on network location; always verify identity, device and context for every request (NIST SP 800-207). **ZTNA** (Zero Trust Network Access) is its practical application: instead of a VPN that "drops" the user into the whole network, a broker grants access only to a specific application, after verifying identity and device posture.

| | Classic VPN | ZTNA |
|---|---|---|
| Access | Whole network (or subnet) | Individual application |
| Decision | Once, when connecting | Continuously, per request |
| Lateral movement | Easy once inside | Harder, applications are invisible |
| Visibility | VPN concentrator logs | A log of every application access with identity |

### SASE

**SASE** (Secure Access Service Edge) combines networking (SD-WAN) and security functions delivered from the cloud: **SWG** (secure web gateway), **CASB**, **ZTNA**, **FWaaS** and DLP. The user, wherever they are, goes through the nearest SASE point of presence. For the SOC this means one place with logs of web traffic, SaaS usage and application access, regardless of whether the user works from home or from the office.

### Hybrid cloud

**Hybrid cloud** combines on-prem and public cloud (often several clouds). Challenges for the SOC: different log formats, identity that spans boundaries (Entra Connect, federation), network links (VPN, Direct Connect/ExpressRoute) as a path for lateral movement, and the **shared responsibility model** (the provider secures the cloud, you secure what you put in it).

> **On the exam:** "Remote workers need access to only one internal application, with a device posture check, without access to the rest of the network" → **ZTNA**. "Unify SD-WAN, web filtering, CASB and ZTNA as a cloud service for distributed offices" → **SASE**.

## Identity and access management

Identity is today the main perimeter: most cloud incidents start with a stolen credential, not an exploit.

### Authentication and authorization

- **Authentication** (who you are): password, **MFA** (TOTP, push, FIDO2/passkey), certificates, biometrics.
- **Authorization** (what you may do): RBAC, ABAC, policies (IAM policy, Conditional Access).
- **SSO and federation**: **SAML** (XML assertion, enterprise web applications), **OAuth 2.0** (delegated authorization, access token), **OpenID Connect** (identity on top of OAuth, an ID token in JWT format), Kerberos in an AD domain.
- **Phishing-resistant MFA** (FIDO2, smart card) is the answer to AiTM phishing and MFA fatigue; SMS and push without number matching are not.

### PAM

**PAM** (Privileged Access Management) controls administrative accounts:

- a **vault** for privileged passwords with check-out/check-in and automatic rotation;
- **just-in-time (JIT)** access: rights are granted for a limited time, with approval (Entra PIM, AWS IAM Identity Center with temporary roles);
- **session recording** and monitoring of privileged sessions;
- separate admin accounts and a **privileged access workstation** (PAW).

For the analyst, PAM is both a source of evidence (who checked out the domain admin password and when) and of detection (a privileged logon without a check-out from the vault = bypassing the control).

### Secrets management

Secrets (API keys, database passwords, certificates) do not go into code, images or CI variables in plaintext. **HashiCorp Vault**, AWS Secrets Manager and Azure Key Vault (you saw them in the DevSecOps course) are used, along with:

- **dynamic secrets** that are generated on request and expire;
- **rotation** and auditing of every read;
- **workload identity** (OIDC federation, IAM roles for services) instead of static keys.

> **On the exam:** A static, long-lived key in a configuration is a problem solved with **secrets management** (vault + rotation), while broad, standing admin rights are solved with **PAM with JIT access**. Don't mix them up: PAM is for human privileged accounts, a secrets manager is for machine secrets.

## Encryption and data protection

| Data state | Technique | Example |
|---|---|---|
| **At rest** | Disk and database encryption (AES-256), KMS, envelope encryption | BitLocker, LUKS, S3 SSE-KMS, TDE |
| **In transit** | TLS 1.2/1.3, IPsec, SSH, mTLS | HTTPS, service mesh mTLS |
| **In use** | Confidential computing (enclaves) | AMD SEV, Intel TDX, Nitro Enclaves |

The trade-off for the SOC: encryption in transit hides content from the IDS. That is why you rely on **metadata** (JA3/JA4 fingerprints, SNI, connection size and rhythm, certificates) or on **TLS inspection** at the proxy, where it is legally and technically permitted.

**Data protection**:

- **Classification** (public, internal, confidential, strictly confidential) determines controls;
- **DLP** on the endpoint, the network and in the cloud (detection of PII, card numbers, sensitivity labels);
- **Masking, tokenization, anonymization and pseudonymization** (tokenization is common for CHD under PCI DSS);
- **Data sovereignty** and data location (GDPR), encrypted backups with tested restores.

## Critical infrastructure: OT, ICS, SCADA

**OT** (Operational Technology) is hardware and software that controls physical processes. **ICS** (Industrial Control System) is a broader term for control systems in industry, and **SCADA** (Supervisory Control and Data Acquisition) is a type of ICS for supervising geographically distributed facilities (water supply, power grid, gas pipeline). Components: **PLC** (programmable logic controller), **RTU**, **HMI** (operator screen), historian.

| | IT | OT |
|---|---|---|
| Priority | Confidentiality (CIA) | **Availability and human safety** (AIC) |
| Lifespan | 3–5 years | 15–30 years |
| Patches | Monthly | Rarely, with plant shutdown and vendor certification |
| Protocols | TCP/IP, TLS | Modbus, DNP3, S7, BACnet: often without authentication |
| Active scanning | Routine | Risky, can crash a PLC |

Protection: **segmentation** following the Purdue model and IEC 62443 zones and conduits, a **unidirectional gateway** (data diode), a DMZ between IT and OT, **passive** network monitoring (an IDS that understands industrial protocols), and tightly controlled vendor remote access.

> **On the exam:** For OT/ICS/SCADA the correct answer is almost never "install the patch immediately" or "run an active scan". Choose **segmentation, passive monitoring and compensating controls**, because process availability is what matters most.

## Putting it together: what to ask about a new architecture

When you get a new system to monitor, the analyst's checklist:

1. What logs does it produce and are they enabled (configuration)?
2. How do they reach the SIEM and are they parsed (ingestion)?
3. Is time synchronized (NTP, UTC)?
4. Who can delete or modify the logs (integrity)?
5. How long are they kept and does that satisfy regulation (retention)?
6. How do people and services authenticate (IAM, PAM, secrets)?
7. Where is sensitive data and how is it protected (encryption, DLP)?

## Summary

- The log path: source → collection → parsing → enrichment → storage → correlation. Most evidence is lost in source **configuration** and **parsing**.
- Log **integrity**: real-time centralization, a separate account, WORM, hash validation. Event 1102 and `StopLogging` are indicators.
- **NTP and UTC** are a prerequisite for correlation; distinguish event time from ingest time.
- **Retention** is determined by regulation (PCI DSS 12 months, 3 immediately available), operational needs and cost, with an upper limit for privacy reasons.
- Know the **critical files** (`/etc/shadow`, `authorized_keys`, SAM, Run keys) and the **normal process tree** (`services.exe` → `svchost.exe`, `wininit.exe` → `lsass.exe`).
- Containers and serverless reduce host forensics: ship evidence out immediately, rely on runtime and audit logs.
- **ZTNA** = per-application access after verification; **SASE** = SD-WAN + SWG + CASB + ZTNA + FWaaS from the cloud.
- **PAM** (JIT, vault, session recording) for human privileges; **secrets management** (Vault, rotation, workload identity) for machine ones.
- Encryption in transit hides content, so the SOC uses metadata or TLS inspection.
- **OT/ICS/SCADA**: availability above all, segmentation and passive monitoring instead of aggressive scanning and rapid patching.
