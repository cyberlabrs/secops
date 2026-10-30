## Exam objectives: 2.2

Domain 2 (**Respond to security incidents**) is worth 35–40% of the exam. This module covers objective **2.2 Respond to alerts and incidents in Microsoft Defender for Endpoint** in full:

- **Investigate device timelines** – chronology of events on the device, MITRE techniques, flags, export,
- **Perform actions on the device, including live response and collecting investigation packages** – isolation, containment, restrict app execution, AV scan, live response, investigation package,
- **Perform evidence and entity investigation** – entity pages (file, process, IP, URL, user), evidence and verdicts, Action center,
- **Investigate and remediate incidents identified by automatic attack disruption** – how to recognize a disrupted incident, what was done automatically and how the action is reverted.

Configuring Defender for Endpoint (advanced features, device groups, automation levels, ASR) is objective 1.1 and is covered in module 06. Here the focus is on the analyst who has an open alert and needs to decide what to do next.

Exam questions for this objective are almost always scenarios: "Device X has an alert… You need to collect evidence **without interrupting the user's work** / **prevent lateral movement as quickly as possible** / with the **LEAST administrative effort**. What should you do?" The key is to know exactly what each action does and what it does not do.

## Where the work happens in the Defender portal

Everything that follows is done in the **Microsoft Defender portal** (`security.microsoft.com`). The most important paths:

| What | Path |
|---|---|
| Device list | **Assets** > **Devices** (device inventory) |
| Device page | click the device name in the inventory, an alert or an incident |
| Incidents and alerts | **Investigation & response** > **Incidents & alerts** > **Incidents** / **Alerts** |
| Action center | **Actions & submissions** > **Action center** (tabs **Pending** and **History**) |
| Live response library | **Settings** > **Endpoints** > **Library management** (or from the session itself) |
| Turning on live response | **Settings** > **Endpoints** > **Advanced features** |
| Advanced hunting | **Investigation & response** > **Hunting** > **Advanced hunting** |

You can open the device page from several places: the inventory, the alert queue, the incident graph, global search (name or IP), a file page ("devices where the file was seen") and an IP address or domain page.

## Device page

At the top of the device page is the row of **response actions**; below it are the cards and tabs:

| Part of the page | What it shows |
|---|---|
| **Overview** | cards **Active alerts**, **Logged on users** (last 30 days, most and least frequent user), **Security assessments** (exposure level), **Device health status** |
| **Incidents and alerts** | the alert queue filtered to that device (severity, status, classification, investigation state) |
| **Timeline** | chronology of events and alerts (details below) |
| **Security recommendations** | recommendations from Defender Vulnerability Management |
| **Software inventory**, **Discovered vulnerabilities**, **Missing KBs** | software, CVEs, missing patches |
| **Security policies**, **Effective settings** | endpoint security policies and the actual value of each setting (AV, ASR, exclusions) with its source (Intune, GPO, MDE) |

If an investigation package has already been collected for the device, there is a download link in the **Device details** section.

> **On the exam:** "A user claims that an ASR rule is not active on their device, even though an Intune policy turns it on. Where can you most quickly see which setting actually applies and who set it?" – the **Effective settings** tab on the device page. It shows the actual value, the source (Intune, Group Policy, MDE) and configuration attempts that failed.

## Device timeline

The **Timeline** tab shows, in chronological order, all events and alerts the sensor saw on the device: processes, files, network connections, registry, logons, AV detections, and also response actions (e.g. "scan action submitted" or isolation).

### Key capabilities

| Capability | How it is used |
|---|---|
| **Time range** | default is the last **30 days**; choose day, week, 30 days or a **custom range** (calendar at the top left) |
| **Search** | search bar over events (file name, command line, IP) |
| **Filters** | by data type (**Events** / **Techniques**), event group, **Flagged events**, user |
| **Process tree** | clicking an event opens a side panel with the parent–child process tree |
| **MITRE ATT&CK techniques** | techniques are **bold with a blue icon**; the technique ID and name are tags in **Additional information** |
| **Flag events** | flag icon next to an event; the **Flagged events** filter later builds a "clean" attack chronology |
| **Hunt for related events** | from the event panel, opens advanced hunting with a query for events around the same time on the same device |
| **Export** | export of detailed events for a selected day or a range of **up to 7 days** |
| **Customize columns** | choose which columns are displayed |

In the **Additional information** column you see labels such as *Active threat detected*, *Remediation successful/unsuccessful*, *Warning bypassed by user* (a SmartScreen warning was bypassed), *Suspicious script detected* and the alert category (e.g. **Lateral Movement**) if the event generated an alert.

A note on firewall events (5025, 5031, 5157): they appear in the timeline only if the **Audit Filtering Platform Connection** audit policy is enabled.

If the EDR client (`MsSense.exe`) runs out of resources, it enters **critical mode** and stops processing new events; an event about this appears in the timeline. This matters when you see a "gap" in the chronology.

### Typical investigation flow through the timeline

1. Open the alert and from it the device page, **Timeline** tab.
2. Set a **custom range** around the alert time (e.g. an hour before and after).
3. Filter on **Techniques** to see the MITRE techniques Defender recognized.
4. For a suspicious process, open the **process tree** and check the parent (e.g. `winword.exe` > `powershell.exe`).
5. **Flag** important events (initial vector, persistence, C2 connection).
6. Turn on the **Flagged events** filter and export the chronology for the report.
7. For wider context, click **Hunt for related events** and continue in advanced hunting.

### The same data in advanced hunting

The timeline is a visual view of the same tables you use in KQL. When you need to look at several devices at once or a longer period, switch to advanced hunting:

```kql
// What a suspicious Office process launched on one device
DeviceProcessEvents
| where Timestamp between (datetime(2026-10-14 08:00) .. datetime(2026-10-14 10:00))
| where DeviceName == "ws-fin-07"
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "outlook.exe")
| project Timestamp, InitiatingProcessFileName, FileName, ProcessCommandLine, AccountName
| order by Timestamp asc
```

```kql
// On which other devices the same hash appeared (attack scope)
let badHash = "<SHA256 from the alert>";
union DeviceProcessEvents, DeviceFileEvents
| where Timestamp > ago(30d)
| where SHA256 == badHash
| summarize FirstSeen = min(Timestamp), LastSeen = max(Timestamp), Events = count() by DeviceName
| order by FirstSeen asc
```

> **On the exam:** the question "you need to export events from a device for a 14-day period for the forensics team" has a trap: a timeline export covers **up to 7 days** per export. The solution is two exports or an advanced hunting query with the results exported. If the question asks for "all events related to the same MITRE technique", the answer is **Hunt for related events** from the technique panel.

## Response actions on the device

Actions from the device page. For each one you enter a comment (reason), and all of them are recorded in the **Action center** and as an event in the timeline.

| Action | What it does | Important notes |
|---|---|---|
| **Isolate device** | Cuts the device's network communication but keeps the connection to the Defender for Endpoint service (monitoring and live response keep working) | **Full** or **Selective** isolation (selective can allow Outlook and Teams, plus process and destination exclusions); requires a role with **Active remediation actions**; the device is returned with **Release from isolation** |
| **Contain device** | All **onboarded** devices block inbound and outbound traffic to that device | For **unmanaged** (not onboarded) or compromised devices; does not require an agent on the device itself |
| **Contain IP** | All onboarded devices block communication with the IP address of an undiscovered device | Used by attack disruption; done manually from the IP page |
| **Contain user** | Blocks communication and logons with that user on all onboarded devices | Part of attack disruption and predictive shielding |
| **Restrict app execution** | Applies a code integrity policy: only files signed with a **Microsoft** certificate may run | Requires Microsoft Defender Antivirus; reverted with **Remove app restrictions** |
| **Run antivirus scan** | Quick or full scan with Microsoft Defender Antivirus | Works even when MDAV is in **passive mode** next to another AV |
| **Collect investigation package** | Collects a ZIP with forensic data | Downloaded from the Action center or the device page |
| **Initiate live response session** | Remote shell on the device | Must be turned on in Advanced features |
| **Initiate automated investigation** | Starts an AIR investigation for the device | New alerts from the device are added to the same investigation while it runs |
| **Consult a threat expert** / **Ask Defender Experts** | Question to Microsoft's analysts | Depends on the license |
| **Manage tags**, **Set criticality** | Device tags and criticality | Tags are also used for exclusions from automatic isolation |

A few details that show up in questions:

- Isolation waits for the device for up to **three days** if it is offline at the time of the action; after that the action must be repeated.
- A device behind a **full-tunnel VPN** cannot reach the service after isolation; the recommendation is split tunneling for Defender traffic.
- For environments with a web proxy (PAC, WPAD), **selective isolation** is recommended.
- Isolating a Hyper-V server also blocks traffic for all of its VMs.
- If an isolated device stops responding, a **forcible release** script is downloaded from the device page (valid only for that device, expires in three days).
- Devices onboarded as **high-value assets** may have a restricted set of allowed actions (selective response actions), so some buttons are greyed out.

### Which action when

| Situation | Action |
|---|---|
| An onboarded laptop communicates with C2; lateral movement must be stopped while the investigation continues | **Isolate device** (full), then live response |
| Same, but the user must keep Teams and Outlook | **Isolate device** – **selective** |
| An unmanaged device (BYOD, IoT) on the network is attacking others | **Contain device** |
| The device runs unknown tools, and isolation would interrupt a business process | **Restrict app execution** |
| You need the device state "as it is now" (processes, connections, autoruns) | **Collect investigation package** |
| You need one specific file or the output of a script | **Live response** (`getfile`, `run`) |

> **On the exam:** distinguish **isolate** from **contain**. Isolate is done on the compromised device itself and requires it to be onboarded. Contain is enforced through **all other** onboarded devices, so it also works for devices without an agent. If the scenario says "the device is not onboarded to Defender for Endpoint", isolate is not possible and the correct answer is **Contain device**.

## Investigation package

An investigation package is a ZIP with the current state of the device. It is started with **Collect investigation package** on the device page and downloaded from the **Action center** ("Package collection package available") or the link on the device page. Collection can fail if the battery is low or the connection is **metered**.

### Contents for Windows

| Folder / file | What it contains and what it is for |
|---|---|
| **Autoruns** | contents of the registry keys of known auto-start extensibility points (ASEP) – persistence |
| **Installed programs** | CSV of installed programs |
| **Network connections** | `ActiveNetConnections.txt`, `Arp.txt`, `DnsCache.txt`, `IpConfig.txt`, firewall logs (`pfirewall.log` if present) – C2 and lateral movement |
| **Prefetch files** | copy of `%SystemRoot%\Prefetch` and `PrefetchFilesList.txt` – traces of executed (and deleted) programs |
| **Processes** | CSV of currently running processes |
| **Scheduled tasks** | CSV of scheduled tasks |
| **Security event log** | Security event log (opens in Event Viewer) |
| **Services** | CSV of services and their state |
| **SMB sessions** | `SMBInboundSessions` and `SMBOutboundSession` – lateral movement and exfiltration |
| **System Information** | `SystemInformation.txt` (OS, network adapters) |
| **Temp Directories** | list of files in each user's `%Temp%` |
| **Users and Groups** | local group membership |
| **WdSupportLogs** | `MpCmdRunLog.txt` and `MPSupportFiles.cab` |
| **CollectionSummaryReport.xls** | summary: which items were collected, command, status and errors |

For **macOS and Linux** the package contains processes, open files, network connections (active, listening, ARP, firewall rules), disks, users and groups (logon history, sudoers); on macOS also installed applications, shell history, kernel modules and System Integrity Protection status. On macOS and Linux the package can also be collected from live response with the `collect` command.

> **On the exam:** "You need to determine which scheduled tasks and auto-start entries the attacker left on 20 devices, with the LEAST effort and without interactive work on each device." – **Collect investigation package** (folders **Autoruns** and **Scheduled tasks**). Live response is interactive and one device per session. If the question asks to "verify that all data was collected", the answer is **CollectionSummaryReport.xls**.

## Live response

**Live response** is a remote (cloud-based) shell on the device for real-time forensics and remediation: reviewing processes and persistence, downloading files, running scripts, deleting malicious entities.

### Prerequisites

- In **Settings** > **Endpoints** > **Advanced features**, turn on **Live Response**; for servers, separately **Live Response for Servers** (recommended). This can be done by admins and users with **Manage Portal Settings**.
- **Live Response unsigned script execution** is optional and applies only to **PowerShell** scripts (signature check). Turning it on increases risk.
- The user must have a role with permission for **basic** or **advanced** live response commands (RBAC custom role).
- Uploading to the library from within a session requires **Manage Security Settings**; via the **Library management** page that permission is not needed.
- Supported: Windows 10/11, Windows Server (2012 R2 and 2016 with the unified agent), macOS and Linux.

### Basic and advanced commands

| Basic (investigation) | What it does |
|---|---|
| `processes`, `services`, `drivers` | processes, services, drivers |
| `connections` | active network connections (Windows) |
| `persistence`, `scheduledtasks`, `startupfolders` | known persistence methods (Windows) |
| `registry` | registry values (Windows) |
| `dir`, `cd`, `findfile`, `fileinfo` | navigation and file information |
| `getfile <path>` | download a file from the device (up to **3 GB**) |
| `jobs`, `fg <command ID>`, `status` | background work |

| Advanced (actions) | What it does |
|---|---|
| `library` | list of files in the live response library |
| `putfile` | puts a file from the library on the device (working folder, deleted on restart) |
| `run` | runs a PowerShell (or Bash) script **from the library** |
| `remediate` | entity remediation: file (delete), process (stop + delete image), service, registry entry, scheduled task, startup item |
| `undo` | restores a remediated entity (Windows) |
| `analyze` | analyzes an entity with incrimination engines (Windows) |
| `collect` | forensic package (macOS, Linux) |
| `isolate` / `release` | isolation from the session (macOS) |
| `scan` | quick AV scan (macOS, Linux) |

Example session (commands in the live response console, not PowerShell on the device):

```text
processes -output json > procesi.txt
persistence
scheduledtasks
getfile "C:\Users\ana\AppData\Local\Temp\upd.exe" &
fg 1234
library
run Collect-Triage.ps1 -parameters "-Days 3"
remediate file "C:\Users\ana\AppData\Local\Temp\upd.exe" -auto
```

- `&` at the end of `getfile` sends the download to the background; `fg <command ID>` brings it back to the foreground (the command ID, not the PID).
- `-auto` with `remediate` automatically runs the prerequisite command.
- `Ctrl+C` stops a command **only in the portal**; state-changing actions such as `remediate` may continue on the agent.
- Output can be `-output table` or `-output json`, and redirected to a file with `>`.
- The **Command log** tab records every command (ID, command line, duration, status).

### Limits

| Limit | Value |
|---|---|
| Concurrent sessions per tenant | 50 |
| Concurrent sessions per user | 5 |
| Sessions per device | **1** |
| Session inactivity timeout | 30 minutes |
| Command timeout | 10 minutes (`getfile`, `findfile`, `run`: 30 minutes) |
| `getfile` | 3 GB |
| `fileinfo` | 30 GB |
| Library file | 250 MB |
| `putfile` | Windows 300 MB, other platforms 10 MB |

> **On the exam:** "An analyst tries `run Script.ps1` and gets an error that the script was not found, even though the script is on their computer." – the script must first be **uploaded to the live response library**. If the error says the script is not signed, the solution is to sign it or turn on **Live Response unsigned script execution**. If another analyst cannot open a session on the same device, the reason is the limit of **one session per device**.

## Evidence and entity investigation

### Evidence in an incident and alert

The **Evidence and Response** tab of an incident shows all entities that automated investigation (AIR) analyzed: files, processes, services, IP addresses, URLs, emails, users. Each one has:

- **Verdict**: *Malicious*, *Suspicious*, *Clean* (or no verdict),
- **Remediation status**: e.g. *Remediated*, *Pending approval*, *Not found*.

For items with **Pending approval** you approve or reject the action directly in the tab or in **Action center** > **Pending**. How many actions wait for approval depends on the **automation level** of the device group (module 06): with *Full – remediate threats automatically* actions run on their own, with *Semi* they wait for approval.

### Entity pages

| Entity | What you see | Key actions |
|---|---|---|
| **File** | prevalence in the organization and worldwide, devices where it was seen, signature, VirusTotal detections, Deep analysis report | **Stop and Quarantine File**, **Add Indicator** (allow / block / audit), **Download file**, **Collect file**, **Deep analysis** (sandbox), **Submit to Microsoft** |
| **Process** (from the timeline/alert) | process tree, command line, user | stop and quarantine via the file |
| **IP address** | devices that communicated, geolocation, prevalence | **Contain IP**, indicator |
| **Domain / URL** | devices that visited it, alerts | indicator (block) |
| **User** | alerts, devices the user logged on to, Entra and AD data, risk level | **Contain user**, disable, password reset (via Defender for Identity and Entra integration) |

**Stop and Quarantine File** stops the file's processes and quarantines it on **all devices** where it was seen (not just one). **Add Indicator** with the *Block and remediate* action prevents future execution across the whole organization. The difference matters: the first cleans up what already exists, the second prevents it from reappearing.

**Deep analysis** runs the file in an isolated environment (sandbox) and produces a behavior report (network connections, created files, registry). The file must be available to the service (collected from the device or already known).

### Action center

**Actions & submissions** > **Action center** consolidates manual and automated actions from across Defender XDR (devices, email, identities):

- **Pending** – actions waiting for approval (AIR, two-step approvals),
- **History** – completed actions (with **Undo** available for many: e.g. restoring a file from quarantine, release from isolation).

For each action you see who started it (user, AIR, **AttackDisruption**), when, on which entity, and its status.

> **On the exam:** "A file was detected on one device, but prevalence shows it exists on 40 more. You need to remove it from all devices and prevent it from running again, with the LEAST effort. Which TWO actions?" – **Stop and Quarantine File** (cleans existing copies on all devices) and **Add Indicator** with blocking (prevents future execution). Running an AV scan on 40 devices or live response on each one is too much work.

## Automatic attack disruption

**Automatic attack disruption** is a built-in capability of Defender XDR: it correlates signals from endpoints, identities, email and SaaS apps into a single high-confidence incident (Microsoft cites precision of 99% and above for containment actions) and automatically **contains** the assets the attacker is using. Configuration (prerequisites, exclusions) is objective 1.1; here what matters is what the analyst sees and does afterwards.

### Actions attack disruption can take

| Action | Performed by | Effect |
|---|---|---|
| **Contain device** | Defender for Endpoint | all onboarded devices block communication with the device |
| **Contain IP** | Defender for Endpoint | blocks the IP of an undiscovered / non-onboarded device |
| **Isolate device** | Defender for Endpoint | automatic isolation of a workstation that is an active attacker foothold (end-user workstations only) |
| **Contain user** | Defender for Endpoint | blocks the user's communication and logons on onboarded devices |
| **Disable user** | Defender for Identity | disables the account in AD (via a DC with the MDI sensor) and in Entra ID if synchronized |
| **Revoke user session**, **Suspend user** | Microsoft Entra ID | ends sessions, suspends the account |
| **OAuth app compromise** | Defender for Cloud Apps | protective measures for a compromised OAuth app |
| **Suspend user in Okta**, **Attach deny policy to AWS user** | Sentinel connectors (preview) | actions outside the Microsoft ecosystem |

There is also **predictive shielding**: preventive measures (e.g. proactive contain user, GPO and Safeboot hardening) when the system predicts the attack will progress.

### How to recognize a disrupted incident

- In the incident queue, the **Attack Disruption** tag (alongside the threat type, e.g. ransomware).
- On the incident page, a **yellow bar** below the title describing the automatic action.
- On the incident graph, entities marked with a status (e.g. *contained*, *disabled*).
- The **attack disruption summary** card on the right: summary of actions, **View activities**, **View related assets**.
- The **Activities** tab with the **Performed by: AttackDisruption** filter and the **Policy status** column (*Active*, *Inactive*, *Not applicable*, *No status*) – you see whether containment is still active.
- In **Action center** > **History**, actions with attack disruption as the source.
- Via the API, the incident title ends with "(attack disruption)".

### What the analyst does afterwards

1. **Don't revert right away.** Disruption buys time; the attacker is stopped, not removed.
2. Investigate the incident: attack story, alerts, device timeline, the user's sign-ins.
3. Remediation: password reset and session revocation for compromised accounts, removing persistence (live response, investigation package), quarantining files, blocking indicators.
4. Only once the risk is removed, restore the assets: on the incident graph or entity page, **Release from containment** (device) or **Enable user** (account); the same from the action panel in the **Action center**. An isolated device is returned with **Release from isolation**.
5. Classify the incident (True positive, threat type) and document it.

To exclude critical assets (e.g. devices that must not be isolated, BAS tests), use **automatic attack disruption exclusions** and **policy applications and exclusions** by device tag; an excluded action appears in the Action center with the status **Skipped**. Critical servers (DC, DNS, DHCP) have the **critical asset** tag and get granular containment that blocks only specific ports and directions.

### Hunting for disruption actions

```kql
// All attack disruption actions in the last 30 days (entire organization)
DisruptionAndResponseEvents
| where Timestamp > ago(30d)
| project Timestamp, ActionType, AttackDisruptionCategory, DeviceName, AccountUpn, RemoteIP, IncidentId
| order by Timestamp desc
```

```kql
// Activities blocked because of device or user containment
DeviceEvents
| where Timestamp > ago(7d)
| where ActionType contains "ContainedDevice" or ActionType contains "ContainedUser"
| summarize Blocks = count() by DeviceName, ActionType
| order by Blocks desc
```

`DeviceEvents` does not record the containment itself, but the **blocked attempts** that result from it. To review the actions themselves, use `DisruptionAndResponseEvents` or the **Activities** tab.

> **On the exam:** "An incident has the Attack Disruption tag, the CFO's account is disabled and they cannot work. What should you do FIRST?" – investigate the incident and confirm the threat has been eliminated (password reset, session revocation, removing persistence), and only then **Enable user**. The answer "immediately enable the account from the Action center" is a distractor, because reverting before the investigation gives the attacker access back. If the question asks where you can see whether the user is **currently** still contained, the answer is the **Policy status** column in the **Activities** tab.

## Example: from alert to closed incident

Scenario: alert "Suspicious PowerShell command line" on `ws-fin-07`, user `ana`.

| Step | Where | What |
|---|---|---|
| 1 | Incident | read the attack story, check whether it has the Attack Disruption tag |
| 2 | Device page > Timeline | custom range around the alert, process tree (`outlook.exe` > `winword.exe` > `powershell.exe`), flag events |
| 3 | File from the alert | prevalence; if it is on several devices – **Stop and Quarantine File** + **Add Indicator** |
| 4 | Device page | **Isolate device** if there is a C2 connection |
| 5 | Device page | **Collect investigation package** (autoruns, scheduled tasks, SMB sessions) |
| 6 | Live response | `persistence`, `getfile` of suspicious files, `remediate` |
| 7 | Advanced hunting | the same hash and C2 IP on other devices |
| 8 | User | password reset, session revocation (Entra) |
| 9 | Device page | **Release from isolation**, AV full scan |
| 10 | Incident | classification, comment, closing |

## Summary

- **Device timeline**: default 30 days, custom range, filters (Events/Techniques, Flagged), process tree, MITRE techniques bold with a blue icon, **Hunt for related events**, export **up to 7 days**.
- **Isolate device** requires an onboarded device and keeps the connection to the service; **selective** isolation allows Outlook/Teams and exclusions. **Contain device** works through the other devices and is used for unmanaged devices.
- **Restrict app execution** allows only Microsoft-signed files; **Run antivirus scan** works in passive mode too.
- **Investigation package**: Autoruns, Network connections, Prefetch, Processes, Scheduled tasks, Security event log, Services, SMB sessions, Temp, Users and Groups, **CollectionSummaryReport.xls**; downloaded from the **Action center**.
- **Live response**: turned on in Advanced features (separately for servers), scripts must be in the **library**, unsigned PowerShell requires a separate setting; one session per device, `getfile` up to 3 GB, `remediate` and `undo`.
- **Evidence and Response** tab: verdict (Malicious/Suspicious/Clean) and remediation status; Pending approval is approved in the tab or in **Action center** > **Pending**.
- File: **Stop and Quarantine File** (all existing copies) + **Add Indicator** (future executions), **Deep analysis** for a sandbox report.
- **Automatic attack disruption**: **Attack Disruption** tag, yellow bar, summary card, **Activities** tab with **Policy status**; actions contain device/IP/user, isolate, disable user, revoke session. Reverting (**Release from containment**, **Enable user**) only after investigation and remediation.
- KQL: `DeviceProcessEvents` for the chronology, `DisruptionAndResponseEvents` for disruption actions, `DeviceEvents` with `ContainedDevice`/`ContainedUser` for blocked attempts.
