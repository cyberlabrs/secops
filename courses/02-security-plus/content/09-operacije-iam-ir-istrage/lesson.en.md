## Exam objectives: 4.5, 4.6, 4.7, and 4.8

This module completes domain 4 (**Security Operations**, 27% of the exam):

- **4.5** apply identity and access management (IAM) concepts: accounts, SSO, federation, MFA, access control models, passwords, and passkeys,
- **4.6** apply automation and orchestration (scripts, SOAR, CI/CD, AI capabilities),
- **4.7** summarize incident response activities (from preparation to the post-incident report),
- **4.8** use data, artifacts, and sources in a security investigation (logs, NetFlow, pcap, memory dumps, integrity, log parsing).

The exam expects you to recognize the **correct protocol** in a scenario (SAML vs OAuth vs OIDC), the **correct access model** (RBAC vs ABAC vs MAC…), the **correct incident phase**, and the **correct data source** for an investigation question.

## 4.5 Identity and access management (IAM)

### Account lifecycle

- **Provisioning** (creating accounts and granting access): when an employee joins or changes roles. Ideally automated from the HR system (source of truth) to the IdP (e.g., Entra ID, Okta) and on to applications via **SCIM**.
- **Deprovisioning** (removal): when an employee leaves, **immediately** disable the account and revoke sessions and tokens, keys, and certificates. Forgotten accounts of former employees (*orphaned accounts*) are a common attack path.
- **Permissions assignments and implications**: assign permissions according to **least privilege**. The danger is **privilege creep** (permissions piling up through role changes): a person moves from team to team and keeps all the old permissions.
- **Identity proofing**: proving that a person is who they claim to be **before** an account or credential is issued: ID card, video verification, confirmation with HR. Also important when the help desk resets MFA (a social engineering target).

### Federation and SSO

- **SSO** (Single sign-on): one sign-in grants access to multiple applications. Fewer passwords and central control, but the IdP becomes a valuable target (hence MFA on the IdP).
- **Federation**: trust between **different organizations/identity domains**. The user signs in with their own **IdP** (Identity Provider), and the **SP** (Service Provider) or RP (Relying Party) trusts the assertion. Example: signing in to the AWS console with a corporate Entra ID account.

| Protocol | Purpose | Format/keywords | Example |
|---|---|---|---|
| **SAML** 2.0 | **Authentication** (and attributes) for web SSO and federation. | Signed XML **assertion**; IdP and SP. | Signing in to Salesforce or the AWS console through the corporate IdP. |
| **OAuth** 2.0 | **Authorization**: delegated access to resources without sharing a password. | **Access token**, scopes, consent screen. | "App X wants access to your Google Calendar". |
| **OIDC** (OpenID Connect) | **Authentication** built **on OAuth 2.0**. | **ID token** in **JWT** format. | "Sign in with Google/Microsoft" in modern web and mobile apps. |
| **LDAP** | Protocol for querying and modifying a **directory service**. | TCP 389; **LDAPS** on 636 (TLS). DN, e.g., `cn=Ana,ou=IT,dc=firma,dc=ba`. | An application checks a user and groups in Active Directory. |

> **On the exam:** OAuth = **authorization** (what an app may do on your behalf), OIDC = **authentication** (who you are) over OAuth, SAML = XML-based authentication for enterprise web SSO. If the question mentions an "XML assertion" → SAML; "access token and scope" → OAuth; "ID token / JWT for sign-in" → OIDC. LDAP by itself is not an SSO protocol but directory access; replace unencrypted LDAP on 389 with LDAPS.

### Account types

| Type | Description | Controls |
|---|---|---|
| **User** | Standard account for everyday work. | Least privilege, MFA. |
| **Privileged – Global** | Admin over the entire environment (Domain Admin, Global Administrator, AWS root). | PAM, phishing-resistant MFA, separate admin account, minimal number. |
| **Privileged – Local** | Admin on a single system only (local Administrator, root on a server). | Unique password per machine (e.g., Windows LAPS), no sharing. |
| **Service** | Account an application or service runs under, not for humans. | No interactive logon, managed identity / gMSA, secret rotation, minimal permissions. |
| **Third-party** | Account for a vendor, consultant, or partner. | Time-limited, session monitoring, disabled when the contract ends. |
| **Emergency access** (*break-glass*) | Account for emergencies when normal access does not work (IdP down, MFA service unavailable). | Strong password in a safe, excluded from policies that could lock it out, **alert on every use**, regular testing. |

> **On the exam:** "An admin reads email daily with a Domain Admin account" is a violation: admins need a **separate** privileged account. "An account that works when SSO/MFA does not" = **emergency access / break-glass**.

### MFA (multifactor authentication)

Factor categories:

| Category | Examples |
|---|---|
| **Something you know** (knowledge) | Password, PIN, security question. |
| **Something you have** (possession) | Hard token, soft token (authenticator app), smart card, phone for SMS OTP. |
| **Something you are** (inherence) | Fingerprint, face, iris, voice. |
| **Somewhere you are** (location) | GPS, IP geolocation. |
| **Something you do** (behavior) | Typing rhythm, gait. |

MFA means factors from **different** categories. A password + PIN are both "know", so that is not MFA.

- **Hard token**: a physical device: FIDO2 security key (YubiKey), a key fob that displays a code.
- **Soft token**: software on a device that generates a code or receives a push: Microsoft Authenticator, Google Authenticator.
- **OTP** (One-time password): a single-use code. **HOTP** is counter-based (event), **TOTP** is time-based (the code is valid briefly, typically 30 seconds). SMS OTP is the weakest variant (SIM swapping, interception).
- **Biometrics**: convenient and strongly tied to the person, but biometrics **cannot be changed** if they leak. Terms: **FAR** (false acceptance rate, accepting the wrong person), **FRR** (false rejection rate, rejecting the right person), **CER** (crossover error rate, the point where FAR and FRR are equal; lower CER = more accurate system).
- **Backup codes**: pre-generated single-use codes for recovery when you lose your MFA device. Store them offline or in a password manager; each is valid only once.

> **On the exam:** push notifications are vulnerable to **MFA fatigue** (bombarding with requests); mitigated with **number matching**. The strongest choice against phishing is **FIDO2/passkey** (bound to the domain, cannot be entered on a fake site).

### Access control models

| Model | Who/what decides | Example |
|---|---|---|
| **Rule-based** | Global rules that apply to everyone, regardless of user. | Firewall ACL; "access only from the corporate IP network". |
| **Role-based** (RBAC) | Permissions are tied to a **role** (job), the user gets the role. | Kubernetes `Role`/`RoleBinding`, Azure RBAC "Reader", an "Accounting" group. |
| **Time-based** | Access only within a specific time window. | Logon hours in AD; access only on weekdays 7am–7pm. |
| **Mandatory** (MAC) | The **system**, based on **labels** (classification and clearance); the user cannot change them. | Military levels Secret/Top Secret, SELinux. |
| **Discretionary** (DAC) | The resource **owner** decides who gets access. | Linux `chmod`, NTFS permissions set by the file owner, sharing a document. |
| **Just-in-time** (JIT) | Privilege is granted **on request, temporarily**, and expires automatically. | Azure PIM: an admin activates a role for 2 hours with approval; no *standing* privileges. |

> **On the exam:** "The file owner decides" = **DAC**. "Labels and clearance, the user cannot change them" = **MAC**. "Access based on position in the company" = **RBAC**. "Rules for all users, e.g., by IP address" = **rule-based**. "No standing admin rights, activation on request" = **JIT**.

### Access management, access review

- **Authentication**: proving identity (before authorization, which determines what you are allowed to do).
- **Policies**:
  - **Logical/technical** policies: enforced by the system (Conditional Access in Entra ID: "block sign-ins from unknown countries", "require MFA for the admin portal"; an IAM policy in AWS; a password policy in a GPO).
  - **Administrative/business** policies: written organizational rules (acceptable use policy, access approval procedure, onboarding/offboarding process).
- **Access review** (*recertification*): resource owners or managers periodically confirm that users still need their permissions. Catches privilege creep and forgotten accounts.

### Password concepts

- **Password managers**: generate and store unique, long passwords for every service. They solve the reuse problem.
- **Passwordless**: sign-in without a password: passkey, Windows Hello for Business, magic link, push with biometrics.
- **Passkey**: a FIDO2/WebAuthn credential based on a **key pair**. The private key stays on the device (or in the platform's synced vault), the server stores only the public key. Unlocked with biometrics or a PIN, **phishing-resistant** because it is bound to the exact domain, and the server has nothing to leak.
- **Password best practices**:

| Practice | Guideline |
|---|---|
| **Length** | The most important factor; long passphrases are stronger and easier to remember. |
| **Complexity** | Current guidance (NIST SP 800-63B) gives less weight to forced character-composition rules than to length and checking against a list of bad passwords. The exam still treats complexity as a control. |
| **Reuse** | Prohibit it (password history); reuse enables **credential stuffing**. |
| **Expiration** (maximum age) | Periodic changes without reason are no longer recommended; a change is mandatory when compromise is suspected. |
| **Age** (minimum age) | A minimum age prevents a user from changing the password several times in a row to get back to the old one, bypassing history. |
| **Compromised credential monitoring** | Checking passwords/accounts against databases of leaked credentials (e.g., Have I Been Pwned, Entra ID Protection "leaked credentials"). |
| **Account auditing** | Reviewing accounts and their activity: inactive accounts, ownerless accounts, unusual sign-ins. |
| **Policy report** | A report on compliance with the password policy (how many accounts lack MFA, have a password that never expires…). |

> **On the exam:** if users change their password 5 times in a row to get back to the old one, the fix is **minimum password age** (together with history). If the problem is the same password on multiple sites, the fix is a **password manager** (and a reuse ban).

## 4.6 Automation and orchestration

### Use cases

| Use case | Example |
|---|---|
| **User provisioning** | New employee in the HR system → automatic account, groups, licenses (SCIM). |
| **Resource provisioning** | Terraform/Bicep creates the network, VMs, and policies from code (IaC). |
| **Desired state management** | A tool continuously returns the system to the defined state: Ansible, Azure Policy, Kubernetes controllers, GitOps (Argo CD). Manual changes (*drift*) are detected and corrected. |
| **Anomaly detection** | Automatic detection of deviations from normal (e.g., GuardDuty, UEBA). |
| **Ticket management** | An alert automatically opens, enriches, and assigns a ticket (Jira, ServiceNow). |

### AI capabilities

- **Agentic**: an AI agent independently plans and executes multiple steps (e.g., gathers context about an alert, searches logs, proposes and, with approval, performs host isolation). It needs strict boundaries and human approval for risky actions.
- **Chatbot**: a conversational interface, e.g., an analyst asks in natural language "show all failed sign-ins for user X" or a user reports an incident.
- **Predictive analysis**: predictions based on history (which systems are likely to be attacked, which vulnerability will be exploited).
- **AI-augmented baselines**: AI learns what normal behavior of users, hosts, and traffic looks like and dynamically adjusts the baseline, so it recognizes anomalies more accurately than static thresholds.

### Considerations

- **Guardrails**: limits on what automation/AI may do (e.g., the agent may isolate at most one host without approval; never deletes production resources; an approval gate in the pipeline).
- **Automation logic**: a logic error repeats at machine speed (a wrong playbook can isolate half the network).
- **Process engineering**: first define and simplify the process well, and only then automate it; a bad process automated is still bad.
- **Complexity**: more integrations = more things that can break and harder maintenance.
- **Financial**: cost of licenses, development, and maintenance versus savings.
- **Process risks**: **single point of failure** (if SOAR goes down), outdated scripts (*technical debt*), dependence on one person who understands the script.
- **Deployment**: test automation in a staging environment, roll out gradually, have a rollback.

### Intended outcomes, SecOps, workflows

- **Intended outcomes**: efficiency/time saving, **enforcing baselines** (every system has the same secure configuration), continuous improvements, productivity improvements, **reduced downtime**, increased proactivity (less reaction, more prevention), plus fewer human errors and faster response.
- **SecOps / CI/CD**: security checks built into the pipeline (SAST, dependency and image scanning, secrets scanning, IaC scanning). The pipeline can **stop the build** (*security gate*) if it finds a critical finding.
- **Workflows**:
  - **Automation**: a single task runs without a human (a script that resets an account).
  - **Integrations**: connecting tools via APIs (SIEM ↔ EDR ↔ ticketing ↔ chat).
  - **Orchestration** links automated steps into an entire flow. **SOAR** (Security Orchestration, Automation and Response) runs **playbooks**: e.g., phishing alert → extract URLs → check reputation → delete the message from all inboxes → block the domain → open a ticket.

> **On the exam:** automation = **a single task**, orchestration = **linking multiple automated tasks and tools into a flow**. If the question asks about an automation risk, typical answers are complexity, single point of failure, and technical debt. If it asks for protection against an AI agent that does too much, the answer is **guardrails**.

## 4.7 Incident response

Phases according to the exam objectives:

| Phase | Key activities |
|---|---|
| **Preparation** | IR plan, roles, tools, contacts, training, and testing. |
| **Identification** | Detection and confirmation that the incident is real, determining scope. |
| **Investigation** | Forensics, evidence collection, chain of custody, e-discovery. |
| **Containment** | Stop the spread: isolation/quarantine. |
| **Negotiation** | For ransomware/extortion: negotiations (with legal counsel, the insurer, and specialized negotiators). |
| **Eradication/recovery** | Remove the cause (malware, attacker accounts, vulnerability), return systems to operation. |
| **Notification/external reporting** | Notify stakeholders and authorities. |
| **Post-incident** | Lessons learned, root cause analysis, post-incident report. |

### Preparation

- **Training**: training the IR team and employees (how to report an incident).
- **Testing**: verifying that the plan and tools work.
  - **Tabletop exercise**: the team sits at a table and **discusses** a scenario step by step ("what do we do if…"), without touching systems. Cheap, reveals gaps in the plan and roles.
  - **Simulation**: a more realistic exercise, e.g., a simulated phishing campaign or a simulated attack the team must detect and handle.
- **Playbooks**: predefined steps for a specific incident type (ransomware, phishing, compromised cloud key). They can be automated in SOAR.
- **Roles**: who is the incident commander, who communicates with management, legal, and PR, who does forensics. The CSIRT team.

### Identification

- **Detection**: alerts from the SIEM, EDR, IDS, user reports.
- **Internal advisory**: internal notices and warnings (e.g., the internal threat intel team reports that a campaign is targeting us).
- **External advisory**: external warnings: CERTs, CISA advisories, vendor warnings, ISACs.
- **Threat hunting**: proactively searching for attackers who slipped past the tools, based on a hypothesis ("is anyone using PowerShell to download from suspicious domains?").

### Investigation

- **Digital forensics**: scientific collection and analysis of evidence so it is usable in court as well. Collect by **order of volatility** (see 4.8), work on copies, not the original, with hashes.
- **Chain of custody**: a documented record of who had the evidence, when and why, and what they did with it. A break in the chain can make the evidence inadmissible.
- **E-discovery**: identifying, collecting, and producing electronically stored information (email, documents, chat) for legal proceedings.
- **Preservation** (legal hold): the obligation to retain relevant data when litigation or an investigation is anticipated; automatic deletion and rotation are suspended for that data (e.g., litigation hold on a mailbox in Microsoft 365, S3 Object Lock).

### Containment, negotiation, eradication/recovery

- **Containment**: **Quarantine/isolation**: isolating a host via EDR, moving it to an isolated VLAN, blocking an account, changing the security group in the cloud so the instance has no egress. The goal is to stop the spread but preserve evidence (don't shut the machine down right away, you lose RAM).
- **Negotiation**: for ransomware/extortion, the decision to negotiate involves management, legal, the insurer, and, where required, the authorities. Paying guarantees neither decryption nor deletion of stolen data and may be legally restricted (sanctions).
- **Eradication/recovery**: remove malware and persistence, close the vulnerability, reset compromised credentials; restore systems from **clean** backups or rebuild from IaC (a *rebuild* is more reliable than "cleaning"), with increased monitoring after restoration.

### Notification/external reporting

- **Stakeholders**: management, the board, internal teams.
- **Customers**: customers whose data was affected.
- **Law enforcement**: police or specialized high-tech crime units.
- **Mandatory**: reporting required by law or contract, within set deadlines (e.g., GDPR requires notifying the supervisory authority of a personal data breach without undue delay and, where feasible, within 72 hours; NIS2 sets deadlines for an early warning). Always involve the legal department.

### Post-incident

- **Lessons learned**: a meeting after the incident: what worked, what didn't, what we change. No finger-pointing (*blameless*).
- **Root cause analysis** (RCA): finding the actual cause (e.g., "5 whys"), not just the symptoms.
- **Post-incident reporting (PIR)**: a formal report: timeline, impact, cause, actions taken, and recommendations. The results feed back into the Preparation phase (updated playbooks).

> **On the exam:** isolating a host = **containment**; removing malware and reimaging = **eradication/recovery**; "discussing a scenario in a conference room without technical actions" = **tabletop**; "a document of who had the evidence" = **chain of custody**; "a ban on deleting emails because of a lawsuit" = **legal hold/preservation**. A "what FIRST" question after the incident is confirmed usually targets **containment**.

## 4.8 Data and sources in an investigation

### Log and trace data types

| Type | What it contains | Example question it answers |
|---|---|---|
| **Access and accounting – logical** | Who accessed which system/data and what they did. | Who opened the payroll file? |
| **Access and accounting – physical** | Badge cards, room entries, video. | Who entered the server room at 2am? |
| **Device** | Logs from network and other devices (switch, router, AP). | When did the port go down? |
| **Server** | OS logs (Windows Event Log, `/var/log/`, journald). | Which service was installed? |
| **Application** | Application logs (web server access log, errors). | Which URL was called with an SQLi payload? |
| **Authentication** | Sign-ins and failed sign-ins (Windows 4624/4625, Entra sign-in log, `/var/log/auth.log`). | Was there password spraying? |
| **Communication** | Email, chat, VoIP records. | Who was the phishing email sent to? |
| **Audit** | Records of configuration changes and privileged actions (CloudTrail, K8s audit, auditd). | Who modified the security group? |
| **Endpoint** | EDR telemetry: processes, command lines, files, connections. | Which process launched PowerShell? |
| **Network** | Firewall, proxy, DNS, IDS logs. | Which domain did the host query? |
| **Metadata** | Data about data: file creation time, document author, email headers, EXIF from a photo. | Which server did the email come from? Who authored the document? |

### Data sources

- **Vulnerability scans**: show whether the attacked system had a known vulnerability (a possible entry vector).
- **Automated reports**: periodic reports from tools (e.g., a daily EDR or CSPM report).
- **NetFlow/IPFIX**: flow metadata (who, to whom, when, how much). No packet contents. Good for volume and patterns (exfiltration, beaconing, lateral movement).
- **Packet captures** (pcap): full traffic contents (Wireshark, tcpdump). Shows exactly what was transferred (if not encrypted), but takes a lot of space.
- **Surveillance footage**: video surveillance (physical access, device theft).
- **Security tools**: SIEM, EDR, IDS, DLP, firewall consoles.
- **Dashboards**: a quick overview of status and trends to start an investigation.

> **On the exam:** "Need to see EXACTLY what was transferred" = **packet capture**. "Need to see how much data went where, using little space" = **NetFlow/IPFIX**. "Who entered the room" = **physical access log** or **surveillance footage**.

### File/log integrity

Evidence must remain unchanged from the moment it was collected:

- **Hashing**: compute a hash (SHA-256) at collection and again at analysis; if they match, the evidence was not modified.
- **Write blocker**: a hardware or software device that prevents writes to the original disk during copying.
- Logs: centralized forwarding to the SIEM (an attacker on the host can't easily delete the copy), immutable storage (WORM/Object Lock), **CloudTrail log file validation**, file integrity monitoring (FIM).

```bash
sha256sum disk.img > disk.img.sha256     # record the hash
sha256sum -c disk.img.sha256             # verify later: "disk.img: OK"
```

### System image

| Type | What it is | When |
|---|---|---|
| **Memory dump** | A snapshot of RAM: processes, network connections, encryption keys, malware that lives only in memory (*fileless*). | **First**, before shutting down the machine, because it is the most volatile. |
| **Bit-level copy** (forensic image) | A bit-by-bit copy of the disk, including deleted files and free space (e.g., `dd`, FTK Imager, E01 format). | For full forensic disk analysis. A plain file copy does not capture deleted data. |
| **Snapshot** | A point-in-time image of a VM or cloud disk (EBS snapshot, Azure disk snapshot). | Quickly preserving state in virtual/cloud environments, before changes or shutdown. |

### Order of volatility

Collect from the **most volatile** to the most stable (RFC 3227 guideline):

1. CPU registers and cache
2. Routing table, ARP cache, process table, kernel statistics, **RAM**
3. Temporary file systems (`/tmp`, swap/pagefile)
4. Disk
5. Remote logs and monitoring data
6. Physical configuration and network topology
7. Archival media (backup tapes)

### Stakeholders in an investigation

- **HR** (Human Resources): for investigations involving employees (insider threat, policy violation), disciplinary measures, offboarding.
- **Accounts** (accounting/finance and business account owners): for financial fraud (BEC, fake invoices), estimating incident cost and payments; owners of affected accounts confirm what is legitimate activity.
- **Legal**: mandatory reporting, legal hold, e-discovery, communication with law enforcement, liability risk; often leads the investigation to protect confidentiality (*attorney-client privilege*).

### Log-parsing techniques

An analyst must quickly extract what's needed from large logs.

```bash
# grep: all failed SSH logins
grep "Failed password" /var/log/auth.log

# grep + regex: extract IP addresses and count attempts per IP
grep "Failed password" /var/log/auth.log \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort | uniq -c | sort -rn | head

# awk: column 9 is the HTTP status in nginx/Apache combined format; number of 404 responses per IP
awk '$9 == 404 {print $1}' access.log | sort | uniq -c | sort -rn | head

# jq: CloudTrail JSON, who deleted security groups or changed IAM
jq -r '.Records[] | select(.eventName | test("^Delete|^PutUserPolicy|^AttachUserPolicy"))
       | [.eventTime, .userIdentity.arn, .eventName, .sourceIPAddress] | @tsv' cloudtrail.json

# Windows (PowerShell): failed logons, Event ID 4625
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 50
```

In a SIEM the same is done with a query language (Splunk SPL, KQL in Sentinel), e.g., KQL: `SigninLogs | where ResultType != "0" | summarize count() by IPAddress`.

Tips: normalize time zones (UTC) before correlating; build a **timeline**; look for the first appearance of an indicator (IP, hash, user) and what happened immediately before and after.

> **On the exam:** recognize what a command does: `grep` filters lines, `-E` regex, `uniq -c` counts, `jq` parses JSON (cloud logs), `awk` extracts columns. Many `4625` events for many different accounts from one IP address = **password spraying**; many for one account = **brute force**.

## Summary

- Provisioning from the HR source of truth, deprovisioning immediately; identity proofing before issuing credentials; access review catches privilege creep.
- SAML = XML assertion for enterprise SSO; OAuth = authorization (access token); OIDC = authentication on top of OAuth (ID token, JWT); LDAP = directory (LDAPS 636).
- Accounts: separate privileged accounts, service accounts without interactive logon, time-limited third-party accounts, break-glass with an alert on use.
- MFA = different factor categories; FIDO2/passkey is phishing-resistant; SMS OTP is the weakest; backup codes for recovery.
- Models: DAC (owner), MAC (labels), RBAC (role), rule-based (global rules), time-based, JIT (temporary, no standing privileges).
- Automation: provisioning, desired state, anomaly detection, tickets; SOAR orchestrates playbooks; risks are complexity, SPOF, and technical debt; AI agents need guardrails.
- IR: Preparation → Identification → Investigation → Containment → (Negotiation) → Eradication/recovery → Notification → Post-incident; a tabletop is a discussion, chain of custody and legal hold preserve evidence.
- Investigation: choose the source based on the question (NetFlow vs pcap, auth vs audit log), collect by order of volatility (RAM before disk), hash evidence, parse logs with grep/regex/awk/jq.
