## Exam objectives: 2.4 and 2.5

- **2.4** Explain types of vulnerabilities and attack surfaces: everywhere weaknesses exist, from outdated software and poor configuration to LLMs and identity providers.
- **2.5** Given a scenario, analyze indicators of malicious activity: from a description of symptoms or a log, recognize the type of malware or attack and the indicator of compromise.

This is the largest part of domain 2 and carries a lot of questions on the exam. Objective 2.5 is scenario-based: you'll get a log, a description of behavior, or a message, and you need to say what's going on.

## Vulnerabilities and attack surface

### Outdated, unpatched, and unmanaged systems

| Term | English term | What it means | Example |
|---|---|---|---|
| Unsupported products | **Unsupported products** | The vendor no longer releases patches (end of life / end of support) | Windows Server 2012 R2 without ESU, an old out-of-support Kubernetes version |
| Unpatched systems | **Unpatched systems** | A patch exists but hasn't been applied | A server missing the patch for a known CVE for months |
| Obsolete systems | **Obsolete systems** | Outdated technology, often with no replacement and no experts who know it | Old mainframe software, a device that only supports SMBv1 |
| Unmanaged systems | **Unmanaged systems** | A system nobody tracks: not in inventory, no agent, no updates | A forgotten EC2 instance from an old project, a "temporary" test server |
| Ports and services | **Ports and services** | Unnecessarily open ports and running services increase the attack surface | Redis 6379 or the Kubernetes dashboard open to the internet |

> **On the exam:** **Unsupported** = patches **don't exist** and never will. **Unpatched** = a patch **exists** but isn't installed. For an unsupported system the answer is replacement (upgrade) or a compensating control (isolation), not "install the patch."

### Applications

- **Race conditions**: the outcome depends on the order or timing of parallel operations.
  - **Time-of-check (TOC)**: the moment the program checks a condition (whether a file exists, whether the user has sufficient funds, whether they have permission).
  - **Time-of-use (TOU)**: the moment the program uses the resource.
  - **TOCTOU** vulnerability: the attacker changes the state between the check and the use. Examples: a program checks that `/tmp/report` isn't a symlink, but before writing, the attacker replaces it with a symlink to `/etc/passwd`; two simultaneous withdrawal requests pass the balance check, so the money is paid out twice.
  - Protection: atomic operations, locking, database transactions, idempotent requests.
- **Malicious update**: a legitimate update channel delivers malicious code. Example: the backdoor inserted into the **xz utils** library in 2024 (CVE-2024-3094) by a maintainer who had built trust for years. Protection: signed updates, version pinning, monitoring dependency changes, SBOM.

### Code

- **Hardcoded secrets**: passwords, API keys, and tokens written directly into code or configuration that goes into git. Once they enter the repository history, they're considered compromised. Protection: a secret manager (AWS Secrets Manager, Azure Key Vault, Vault), secret scanners (gitleaks, GitHub secret scanning) in pre-commit and CI.
- **Unsafe exception handling**: an error reveals too much (stack trace, framework version, SQL query, paths), or on error the application is left in an insecure state (e.g., it skips the authorization check, which is called **fail open**). Correct approach: a generic message to the user, details only in the log, **fail closed** (fail secure).

### OS and virtualization

- **OS-based**: kernel and system service vulnerabilities, weak defaults, unnecessary services, bad permissions (SUID, world-writable files). Fix: hardening, patching, CIS benchmarks.
- **Virtualization**:
  - **VM escape**: code in the guest (VM) breaks out to the hypervisor and gains access to other VMs. The container analog is **container escape** (a privileged container, a mounted Docker socket, a runtime vulnerability).
  - **Resource reuse**: memory or disk from a previous tenant isn't wiped before being assigned to a new VM.
  - **VM sprawl**: uncontrolled multiplication of VMs that nobody tracks (related to unmanaged systems).

### Zero-day and cryptographic vulnerabilities

- **Zero-day**: a vulnerability the vendor doesn't know about yet or has no patch for yet, while attackers are already exploiting it. Signature-based tools don't recognize it. Defense: defense in depth, behavioral detection (EDR), segmentation, fast virtual patching (a WAF rule).
- **Cryptographic vulnerabilities**: weak or obsolete algorithms (MD5, SHA-1, DES, RC4), short keys, old protocol versions (SSL, TLS 1.0), poor implementation (reused nonce, weak random number generator), expired certificates, keys in code.

### Accounts, devices, and shadow IT

- **Unmanaged / stale credentials**: accounts of former employees, service accounts without an owner, long-lived IAM access keys, tokens that never expire. Protection: offboarding, rotation, short-lived credentials (OIDC federation in CI/CD instead of static keys), periodic review.
- **Rogue devices**: unapproved devices connected to the network, e.g., a Raspberry Pi plugged in behind a printer, a personal router, a **rogue access point**. Protection: 802.1X/NAC, monitoring new MAC addresses, physical surveillance.
- **Shadow IT**: systems and services employees use without IT's knowledge or approval (personal SaaS accounts, an unofficial cloud account on the team's credit card). The problem: no monitoring, backups, or data control. Discovery: CASB, DNS/proxy log analysis, expense reviews.

### Wireless and mobile

- **Wireless and low-powered communications**: Wi-Fi with weak encryption (WEP, WPA2 with a weak password), Bluetooth Low Energy, Zigbee, LoRa, and other IoT protocols. Low-power devices often lack the resources for strong cryptography and are rarely updated.
- **Mobile devices**:
  - **Sideloading**: installing apps outside the official store, without vetting.
  - **Jailbreaking** (iOS) / **rooting** (Android): removing the OS's security restrictions.
  - Lost devices, outdated OS versions, BYOD without MDM.

### LLMs and identity providers

- **Large language models (LLMs)** as an attack surface: applications that use an LLM expose new inputs. Main risks: **prompt injection** (direct or indirect, via a document or web page the model reads), leakage of sensitive data from the context, an LLM agent with excessive permissions that takes actions, insecure handling of model output (output executed directly as code or SQL). Covered in detail in the AI threats module (objective 2.6).
- **Identity providers (IdP)**: Entra ID, Okta, Google Workspace, Keycloak. The IdP is the "master key": if an attacker compromises the IdP, an admin account in it, or the token signing key, they can sign in to **all** applications connected via SSO. Risks: admin account takeover, forged SAML/OIDC tokens, malicious OAuth apps, misconfigured federations, attacks on the helpdesk to reset MFA. Protection: phishing-resistant MFA for admins, monitoring IdP configuration changes, protecting signing keys, a minimal number of global admins.

### Misconfiguration and public resources

- **Misconfiguration**: default passwords, an exposed management interface, overly permissive IAM policies (`*:*`), disabled logging, a Kubernetes pod with `privileged: true`. One of the most common causes of cloud incidents.
- **Public repositories**: secrets, internal hostnames, and configurations in public GitHub repositories; a private repository accidentally made public; malicious packages in public registries (typosquatting on npm/PyPI, dependency confusion).
- **Public object storage**: an S3 bucket, Azure Blob container, or GCS bucket with public access containing backups or personal data. Protection: S3 Block Public Access at the account level, Azure "Allow Blob anonymous access" disabled, CSPM tools that report public resources.

> **On the exam:** If a scenario mentions a password or key found in code or git history, the **first step** is to **revoke and rotate** the secret. Deleting the file from the repository doesn't help, because the secret stays in the history and may already have been copied.

## Malware

| Type | English term | Key characteristic | Indicators |
|---|---|---|---|
| Ransomware | **Ransomware** | Encrypts data and demands a ransom. Often also steals data before encrypting (double extortion). | Mass file renaming with a new extension, a ransom note, deletion of shadow copies (`vssadmin delete shadows`), high disk I/O |
| Trojan | **Trojan** | Poses as a legitimate program | Cracked software, a fake installer; often installs a **RAT** (remote access trojan) |
| Worm | **Worm** | Spreads across the network on its own, **without user interaction** | A sudden spike in scanning and traffic on one port between internal hosts |
| Spyware | **Spyware** | Secretly collects data about the user | Unusual outbound traffic, unknown processes |
| Adware | **Adware** | Shows unwanted ads, changes the browser | Pop-ups, a changed home page and search engine |
| Virus | **Virus** | Inserts itself into other files and **needs a user action** to run and spread | Modified executables, changed hashes |
| Rootkit | **Rootkit** | Hides deep in the system (kernel, bootloader, firmware) and conceals other processes and files | OS tools show nothing, but an outside view (offline scanning, network traffic) shows activity |
| Keylogger | **Keylogger** | Records keystrokes | Stolen passwords without phishing, an unknown process with keyboard access |
| Logic bomb | **Logic bomb** | Code that waits for a condition (a date, an account deletion) and then causes damage | Damage at a precise time, often linked to an insider |
| Fileless malware | **Fileless malware** | Lives in memory and uses legitimate tools (PowerShell, WMI), with no executable on disk | Encoded PowerShell commands (`-EncodedCommand`), suspicious child processes of Office apps, persistence in the registry or WMI subscriptions |

> **On the exam:** A **virus** needs a user (running a file), a **worm** spreads by itself. A **trojan** poses as a useful program. **Rootkit** is the keyword when "system tools show nothing suspicious, yet there's activity." **Logic bomb** = a trigger (a date or an event).

## Physical attacks

| Attack | English term | Description | Control |
|---|---|---|---|
| Following someone in | **Tailgating** | An unauthorized person goes through a door behind an authorized one. (When the authorized person knowingly lets them in, it's also called piggybacking.) | Access vestibule, turnstile, training, guard |
| Looking over a shoulder | **Shoulder surfing** | Watching a screen or keyboard to get a PIN or password | Privacy filters, awareness, desk layout |
| Skimming | **Skimming** | A device on an ATM, POS terminal, or card reader copies card data | Device inspection, contactless payment with tokenization, surveillance |
| Forced entry | **Forced entry** | Physically breaking through doors, windows, server cabinets | Reinforced doors, alarms, sensors, cameras |

## Network attacks

| Attack | Description | Indicators |
|---|---|---|
| **DDoS** (Distributed Denial of Service) | Many devices (a botnet) overwhelm the target. Volumetric, protocol (SYN flood), and application (HTTP flood). **Amplification/reflection**: a small query to a DNS or NTP server with the victim's spoofed IP address produces a large response toward the victim. | A sudden traffic spike from many sources, service unavailable |
| **Protocol downgrade** | The attacker forces the parties to use an older, weaker protocol version or cipher (e.g., TLS 1.0, HTTP instead of HTTPS: SSL stripping) | Connections using old protocol versions, missing HSTS |
| **Rogue** (rogue AP, rogue DHCP) | An unauthorized access point or DHCP server. An **evil twin** imitates a legitimate SSID. | Two APs with the same SSID, an unexpected gateway or DNS server |
| **Sniffing** | Intercepting and reading traffic | An interface in promiscuous mode, unencrypted protocols |
| **Spoofing** | Faking an identity: IP, MAC, ARP, sender email address | An ARP table with one MAC address for multiple IPs |
| **On-path** (formerly man-in-the-middle) | The attacker positions themselves between two parties and reads or modifies traffic (ARP poisoning, evil twin, malicious proxy) | Certificate warnings, gratuitous ARP messages |
| **DNS attacks** | Attacks on or through DNS: redirection, **domain hijacking** (taking over the registration), DNS tunneling (exfiltrating data through DNS queries) | Unusually long or frequent DNS queries, changed NS records |
| **Cache poisoning** | Injecting fake records into a DNS resolver's cache, so all users get the attacker's IP address | Domains resolve to unexpected IP addresses. Protection: **DNSSEC** |

## Social engineering attacks

| Attack | Channel | Key difference |
|---|---|---|
| **Phishing** | Email | Mass, generic messages |
| **Spear phishing** | Email or message | Targeted at a specific person or group, personalized |
| **Whaling** | Email, call | Targets **senior executives** (CEO, CFO) |
| **Smishing** | **SMS** (and RCS) | Phishing via text messages |
| **Vishing** | **Voice call** | A fake banker, fake IT support, increasingly with a cloned voice |
| **Quishing** | **QR code** | A link hidden in a QR code (email, flyer, PDF, a sticker on a parking meter) |
| **Impersonation** | Any | Posing as someone the victim trusts (helpdesk, vendor, executive) |
| **Deepfake** | Video, voice, image | AI-generated fake video or voice of a real person. Example: an employee approved large payments after a video call with "executives" who were deepfakes. |

Defense: training and simulations, **out-of-band verification** (callback to a known number, not the number in the message), a dual-approval process for payments, DMARC, phishing-resistant MFA (FIDO2/passkeys).

> **On the exam:** The channel determines the name: SMS = **smishing**, voice = **vishing**, QR code = **quishing** (even when the QR code arrives by email). The target determines it too: an executive = **whaling**, a specific person or team = **spear phishing**. A fake AI-generated video or voice = **deepfake**.

## Application attacks

| Attack | Description | Example indicator |
|---|---|---|
| **Injection** | Unvalidated input is executed as part of a query or command: SQL injection, command injection, LDAP, XSS (injecting a script into a page) | `' OR '1'='1' --` in a parameter, `; cat /etc/passwd` in a form field, `<script>` in a comment |
| **Buffer overflow** | A program writes more data than the buffer can hold and overwrites adjacent memory, which can lead to code execution | A program crash, long runs of the same character (`AAAA…`) in the input, a NOP sled (`0x90…`) |
| **Replay** | The attacker resends a captured valid request or token | The same request or token several times, with the same timestamp or nonce |
| **Privilege escalation** | Gaining more rights than assigned: **vertical** (user → admin) or **horizontal** (access to another user's data at the same level) | An account is added to an admin group, a process running as root started from a user session |
| **Forgery** | Forging requests: **CSRF** (the victim's browser sends a request to a site where they're logged in), **SSRF** (the server is tricked into sending requests to internal resources, e.g., cloud metadata `169.254.169.254`) | Requests with an unexpected Referer, the server accessing the metadata service |
| **Directory traversal** | Accessing files outside the permitted directory using `../` | `GET /download?file=../../../etc/passwd`, encoded `%2e%2e%2f` |

Defense: input validation and parameterized queries, a WAF, memory-safe languages and protections (ASLR, DEP), anti-CSRF tokens and SameSite cookies, IMDSv2 in AWS against SSRF credential theft.

> **On the exam:** Recognize them by the signature in the log: `'` and `OR 1=1` = **SQL injection**, `../` = **directory traversal**, a long run of the same character = **buffer overflow**, `<script>` = **XSS** (a type of injection attack), the same request repeated = **replay**.

## Credential attacks

| Attack | Description | Indicator |
|---|---|---|
| **Brute force** | Many passwords against **one** account (online) or against stolen hashes (offline) | Many failed logins on one account, **account lockout** |
| **Password spraying** | **One or a few** common passwords against **many** accounts, slowly, to avoid lockout | One failure each on hundreds of accounts from the same source, the same password |
| **User enumeration** | Discovering which usernames exist | Different messages for "user doesn't exist" vs. "wrong password," different response times |
| **Replay** | Reusing an intercepted hash, token, or cookie (e.g., **pass-the-hash**) | A login with a valid token from an unexpected location |
| **MFA bypass** | Getting around the second factor: **MFA fatigue** (push bombing: the user gets dozens of push requests until they approve one), **AiTM phishing** (a proxy page steals the session cookie after MFA), **SIM swapping** (taking over a phone number for SMS codes), tricking the helpdesk into resetting MFA | Many rejected push requests and then one approved; a new MFA method registered right after a reset |

In addition: **credential stuffing** = using username/password pairs leaked from other sites (it works because people reuse passwords).

> **On the exam:** **Spraying** = many accounts, few passwords. **Brute force** = one account, many passwords. If the question says there's no account lockout but there are failed logins spread across many users, it's spraying. For MFA bypass via push bombing, the answer is **number matching** or phishing-resistant MFA (FIDO2).

## Indicators of compromise

**Indicators of compromise (IoC)** are traces showing that an attack has happened or is in progress.

| Indicator | English term | What to look for |
|---|---|---|
| Hash | **Hash** | A file hash matches known malware (VirusTotal, threat feed) |
| IP address | **IP address** | Communication with a known C2 address or a Tor exit node |
| Domain | **Domain** | Queries to newly registered, look-alike (typosquat), or DGA domains |
| Malicious processes | **Malicious processes** | An unknown process, a legitimate name in the wrong path (`svchost.exe` in `C:\Users\Public`), Word launching PowerShell |
| File system artifacts | **File system artifacts** | New files in temp folders, hidden directories, a ransom note, a cron job/scheduled task for persistence |
| Timestamps | **Timestamp** | Activity outside working hours; **timestomping** (the attacker changes file dates to blend in) |
| Log manipulation | **Log manipulation** | Gaps in logs, a cleared Security log (Event ID 1102), CloudTrail disabled (`StopLogging`) |
| Excessive resource consumption | **Excessive resource consumption** | CPU at 100% (cryptomining), unusually large outbound traffic (exfiltration), a full disk |
| Plaintext strings | **Plaintext strings** | Hardcoded URLs, IPs, commands, or passwords visible in a binary (`strings`) or in memory |
| Account lockout | **Account lockout** | Many locked accounts (brute force) or a user locked out even though they didn't log in |
| Impossible travel | **Impossible travel** | A login from Belgrade and then, 20 minutes later, from Singapore for the same account |
| Concurrent sessions | **Concurrent sessions** | The same account active from two devices or locations at the same time when that isn't expected |

Cloud examples: GuardDuty findings (e.g., EC2 instance credentials used outside AWS), Entra ID Identity Protection (impossible travel, atypical travel, anomalous token), Defender for Cloud.

> **On the exam:** **Impossible travel** = two logins from locations that are physically impossible in that time. **Concurrent sessions** = simultaneously active sessions of the same account. Both suggest stolen credentials or a stolen token. The first step is usually to **revoke sessions and reset credentials**.

## Exercise: reading logs

Objective 2.5 starts with "Given a scenario, analyze." On the exam you'll see short log excerpts. Practice recognizing the signatures.

### Example 1: web server

```text
10.0.4.21 - - [12/Oct/2026:03:14:07] "GET /img?name=..%2f..%2f..%2fetc%2fpasswd HTTP/1.1" 200 1843
10.0.4.21 - - [12/Oct/2026:03:14:09] "GET /search?q=1%27%20UNION%20SELECT%20user,pass%20FROM%20users-- HTTP/1.1" 500 312
```

- First line: `..%2f` is URL-encoded `../`, and the `200` response has a size typical of `/etc/passwd`. **Directory traversal**, and a successful one.
- Second line: `%27` is an apostrophe, and `UNION SELECT` and `--` are the signature of a **SQL injection** attack. The `500` response suggests the application doesn't handle errors well.
- Both requests at 3 a.m. from the same address: the same attacker, an automated tool.

### Example 2: authentication

```text
03:00:01 FAIL user=a.petrovic   src=185.220.x.x
03:00:04 FAIL user=m.jovanovic  src=185.220.x.x
03:00:06 FAIL user=s.kovacevic  src=185.220.x.x
... (1,200 different users, one attempt each)
03:41:17 OK   user=d.markovic   src=185.220.x.x
```

One attempt per account across many accounts, with no lockout = **password spraying**. One success means `d.markovic` had a weak password. Next steps: reset the password, revoke sessions, check what the account did after 03:41, block the source, roll out MFA, and check passwords against a list of leaked passwords.

For comparison, **brute force** would look like hundreds of `FAIL user=a.petrovic` in a row, followed by `ACCOUNT LOCKED`.

### Example 3: endpoint

```text
ParentImage: C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE
Image:       C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
CommandLine: powershell -nop -w hidden -EncodedCommand SQBFAFgAIAAoAE4AZQB3AC0ATwBi...
```

Excel shouldn't launch PowerShell. A hidden window (`-w hidden`) and an encoded command are the classic signature of a macro attack leading to **fileless malware** and **living-off-the-land**. The initial vector is most likely **attachment-based** (a macro in an Excel attachment).

### Example 4: cloud

```text
eventName: StopLogging        userIdentity: arn:aws:iam::1111:user/ci-deploy  sourceIP: 45.x.x.x
eventName: CreateUser         userName: support-backup
eventName: AttachUserPolicy   policyArn: arn:aws:iam::aws:policy/AdministratorAccess
```

- `StopLogging` on CloudTrail = **log manipulation**.
- A CI account with a static key used from an unknown IP address = compromised **stale/hardcoded credentials**.
- Creating a new admin user = **privilege escalation** and persistence.
- Response: deactivate the key, delete the new user, re-enable logging, investigate what was done, move to short-lived credentials (OIDC) in CI/CD.

## Similar terms the exam mixes up

| Pair | How to tell them apart |
|---|---|
| Virus vs worm | A virus needs the user to run a file. A worm spreads by itself over the network. |
| Trojan vs RAT | A trojan is the delivery method (the disguise). A RAT is the function (remote access). A trojan often installs a RAT. |
| Spyware vs keylogger | A keylogger is a narrower kind of spyware that records keystrokes. |
| Brute force vs spraying | One account and many passwords vs. many accounts and few passwords. |
| Replay vs on-path | Replay resends captured data later. On-path actively sits between the parties in real time. |
| Spoofing vs on-path | Spoofing is faking an identity (often the means). On-path is a position for interception (the goal). |
| DNS cache poisoning vs domain hijacking | Poisoning injects fake records into a resolver's cache. Hijacking takes over the domain registration itself at the registrar. |
| Phishing vs spear phishing vs whaling | Mass vs. targeted vs. targeted at an executive. |
| Unsupported vs unpatched | No patch exists vs. a patch exists but isn't applied. |
| Zero-day vs unpatched | With a zero-day, the patch doesn't exist yet. Once the patch is out and not applied, the system is unpatched. |
| Shadow IT vs rogue device | Shadow IT is unapproved services and systems (often SaaS or cloud). A rogue device is an unapproved physical device on the network. |
| Tailgating vs piggybacking | With tailgating, the authorized person doesn't know. With piggybacking, they knowingly let the person in. The exam often calls both tailgating. |

## Reducing the attack surface in a DevOps environment

| Area | Concrete measure |
|---|---|
| Inventory | Tagging all resources, AWS Config / Azure Resource Graph to find unmanaged resources |
| Patching | Regularly rebuilding container images, automated patching (SSM Patch Manager, Azure Update Manager), tracking EOL dates |
| Ports | Security Groups and NSGs on a deny-by-default basis, no `0.0.0.0/0` on management ports |
| Secrets | A secret manager, secret scanning in CI, short-lived credentials via OIDC federation |
| Configuration | IaC with policy-as-code checks (Checkov, tfsec, OPA/Kyverno), CSPM |
| Public resources | Block Public Access at the account level, no anonymous access to Blob storage |
| Dependencies | SBOM, scanning images and libraries, pinning versions and hashes, a private registry mirror |
| Identity | Phishing-resistant MFA for admins, PIM for privileged roles, reviewing OAuth apps in the IdP |
| LLM applications | Least privilege for the tools the model calls, human approval for sensitive actions, validation of model output |

## Summary

- **Unsupported** (no patches) vs **unpatched** (a patch exists). Unmanaged systems, unnecessary ports and services, shadow IT, and rogue devices increase the attack surface.
- **TOCTOU race condition**: the state changes between the check and the use. A **malicious update** abuses trust in the update channel.
- Code: **hardcoded secrets** (rotate immediately) and **unsafe exception handling** (leaked details, fail open).
- New attack surface: **LLMs** (prompt injection, excessive permissions) and the **identity provider** (compromise = access to all SSO applications). Public repositories and public object storage are common sources of leaks.
- Malware: virus (needs a user), worm (spreads by itself), trojan (disguise), rootkit (hides), logic bomb (trigger), fileless (memory + legitimate tools), ransomware (encryption and extortion).
- Social engineering by channel: smishing (SMS), vishing (voice), quishing (QR), deepfake (AI video/voice); by target: spear phishing, whaling.
- Application signatures: `' OR 1=1` injection, `../` traversal, `AAAA…` buffer overflow, a repeated request is replay. Credentials: spraying (many accounts) vs brute force (one account), MFA fatigue.
- IoCs: hash, IP, domain, processes, artifacts, timestamps, log manipulation, resources, plaintext strings, lockout, **impossible travel**, **concurrent sessions**.
