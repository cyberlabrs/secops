## Exam objectives: 1.1

This module covers objective **1.1 Configure automation for Microsoft Defender XDR and Microsoft Sentinel** from domain 1 (Manage a security operations environment, 40–45%). Bullets from the study guide (as of 21 Oct 2026):

- **email notifications** in Defender XDR: incidents, actions and **threat analytics**,
- **alert notifications** in Defender XDR: **tuning**, **suppression** and **correlation**,
- **advanced features** in Microsoft Defender for Endpoint,
- **rules settings** in Defender for Endpoint,
- **custom data collection** in Defender for Endpoint,
- security policies for Defender for Endpoint, including **attack surface reduction (ASR)** rules,
- managing **automated investigation and response (AIR)** capabilities,
- **automatic attack disruption**,
- **device groups**, permissions and **automation levels** in Defender for Endpoint,
- **automation rules** in Microsoft Sentinel,
- **playbooks** in Microsoft Sentinel.

Most Defender XDR settings are under `System > Settings` in the Defender portal (`security.microsoft.com`): `Settings > Microsoft Defender XDR` (shared settings) and `Settings > Endpoints` (Defender for Endpoint). Sentinel automation is under `Microsoft Sentinel > Configuration > Automation`.

## Email notifications in Defender XDR

Path: `Settings > Microsoft Defender XDR > General > Email notifications`. There are three tabs:

| Tab | What it sends | Typical options |
|---|---|---|
| **Incidents** | an email when an incident is created or an alert is added | severity, alert source (service source), device groups, include organization name, link to the tenant portal, recipients |
| **Actions** | an email about **response actions** | **Action source** (manual, automated), specific actions, **Device groups scope**, **Action status** (completed, failed), recipients |
| **Threat analytics** | an email when a **threat analytics** report is published or updated | which reports (all or selected categories), recipients |

The procedure is the same for each type: **Add notification rule** → Basics (name, description) → Notification settings → Recipients (**Send test email**) → Review → **Submit**.

Permissions: configuration requires the **Manage security settings** permission (in the basic permissions model: Security Administrator or higher). With RBAC, a user can create, change and receive notifications only for the device groups they are allowed to manage.

Automated actions in the Actions tab include **automatic attack disruption** and **automated investigation and response**. Action notifications do not yet support actions from custom detections.

> **On the exam:** "The server team should receive an email only when a device from the Servers device group is isolated, either manually or automatically." Answer: a notification rule in the **Actions** tab, Action source manual + automated, the isolate action, **Device groups scope** = Servers. The **Incidents** tab sends mail for incidents, not for actions.

## Alert notifications: tuning, suppression, correlation

### Alert tuning

**Alert tuning** (formerly **alert suppression**) automatically hides or resolves alerts when expected organizational behavior occurs. Path: `Settings > Microsoft Defender XDR > Rules > Alert tuning`, or **Tune alert** from the alert page.

- **Select service sources**: the products the rule applies to (you only see those you have permissions for).
- **Conditions**: based on evidence types (file, process, scheduled task, AMSI script, WMI event…), with AND/OR and grouping; up to **200 conditions** per rule.
- **Action**:
  - **Hide alert**: suppresses the alert and prevents an incident; the alert remains in `AlertInfo` and `AlertEvidence`. Works **only for Defender for Endpoint** alerts.
  - **Resolve alert**: the alert and related incidents are created with the resolved status.
  - **Set as behavior**: the signal becomes a **behavior** (tables `BehaviorInfo`, `BehaviorEntities`), does not appear in the queue and does not create an incident; not supported for Defender for Cloud and Defender for Office 365.

There are also **built-in** tuning rules for common benign activities; you can review them and turn them off (**Disable**). Neither built-in nor custom tuning **applies** to alerts from **custom detection** rules and Custom TI indicators: there you handle noise in the query or indicator itself.

After onboarding Sentinel to the Defender portal, alert tuning can also be applied to **Sentinel** alerts.

> **On the exam:** "An internal backup tool triggers the same Defender for Endpoint alert every night. The alert must not create an incident, but the data must remain available for hunting." Answer: alert tuning with the **Hide alert** action (or **Set as behavior**) and a condition on the tool's process/file. Turning off the whole detection or deleting alerts is not correct.

### Correlation

Defender XDR automatically correlates alerts from all sources (including Sentinel) into incidents. This is affected by:

- **entities** in alerts (which is why entity mapping in rules matters),
- the advanced feature **Restrict correlation to within scoped device groups** in Defender for Endpoint: alerts from different device groups are not merged into one incident. Useful when local SOC teams see only their own groups; the global SOC then sees more, smaller incidents. The change applies only to future correlations.
- **Alert service settings** (`Settings > Microsoft Defender XDR > Alert service settings`): e.g. which Microsoft Entra ID Protection alerts flow into Defender (the default is **High-risk detections only**, it can be changed to High + Medium or All detections).

## Defender for Endpoint advanced features

Path: `Settings > Endpoints > General > Advanced features` → **On/Off** → **Save preferences**.

| Feature | What it does |
|---|---|
| **Restrict correlation to within scoped device groups** | alert correlation only within a device group |
| **Enable EDR in block mode** | EDR blocks malicious artifacts even when Defender Antivirus is in passive mode |
| **Automatically resolve alerts** | automatically resolves alerts where no threat was found or the threat was remediated |
| **Allow or block file** | blocking files by hash; requires Defender Antivirus as the active AV and cloud-based protection |
| **Custom network indicators** | indicators for IP, domain and URL (allow/block) |
| **Tamper protection** | prevents turning off and changing protection |
| **Show user details** | user data from Entra ID in investigations |
| **Microsoft Defender for Cloud Apps** | forwarding signals to Defender for Cloud Apps |
| **Web content filtering** | blocking website categories |
| **Device discovery** | discovering unmanaged devices on the network |
| **Download quarantined files** | backup of quarantined files for download |
| **Live response** / **Live response for servers** / **Live response unsigned script execution** | remote session on a device, on servers, and execution of unsigned scripts |
| **Microsoft Intune connection** | sharing device risk for Conditional Access |
| **Share endpoint alerts with Microsoft Compliance Center** | alerts for Insider Risk Management |
| **Preview features** | access to preview features |

> **On the exam:** "An analyst cannot start a live response session on a Windows Server, but can on workstations." Turn on **Live response for servers**. If they need to run their own unsigned scripts, additionally **Live response unsigned script execution**.

## Rules settings in Defender for Endpoint

Path: `Settings > Endpoints > Rules`. The most important parts:

- **Indicators**: your own IoCs for **file hashes**, **IP addresses**, **URLs/domains** and **certificates**. Actions: **Allow**, **Audit**, **Warn**, **Block execution**, **Block and remediate** (depending on type). Scoped by device groups. IP and URL require the **Custom network indicators** advanced feature and network protection in block mode; files require **Allow or block file**.
- **Alert suppression / tuning**: leads to alert tuning (see above).
- **Web content filtering** policies.
- **Custom Data Collection** (see below).
- **Asset rule management** (in Defender XDR settings): **dynamic tags** for devices, used by custom data collection and attack disruption policy application.

## Custom data collection in Defender for Endpoint

**Custom data collection** extends telemetry beyond the default: you define rules with filters (folder path, process name, network connections…) and the additional events are sent to your **Microsoft Sentinel** workspace. The feature is in preview.

Prerequisites:

- a **Defender for Endpoint Plan 2** license,
- a connected **Microsoft Sentinel workspace** (currently one workspace per tenant for this feature; the workspace is also selected when creating a rule),
- **dynamic tags** from **Asset Rule Management** (manual tags are not supported),
- Windows 10/11 (client 10.8805+) or Windows Server 2019+.

Creation: `Settings > Endpoints > Rules > Custom Data Collection` → select the workspace → **Create rule** → General Information → table, action and conditions → scope (all devices or a dynamic tag) → **Submit**. The rule reaches devices within 20 minutes to 1 hour.

| Table | Content |
|---|---|
| `DeviceCustomProcessEvents` | process creation and termination |
| `DeviceCustomImageLoadEvents` | DLL loading |
| `DeviceCustomFileEvents` | file creation, modification, deletion |
| `DeviceCustomNetworkEvents` | network connections |
| `DeviceCustomScriptEvents` | script execution (PowerShell, JavaScript…) |

Limit: **75,000 events per rule per device in 24 hours** (rolling). When reached, that rule stops collecting on that device until the window expires. Ingestion into Sentinel is billed at Sentinel prices, so start with a pilot group.

Checking that the rule works:

```kql
search in (DeviceCustomFileEvents, DeviceCustomScriptEvents, DeviceCustomNetworkEvents, DeviceCustomProcessEvents, DeviceCustomImageLoadEvents) "your_device_id"
| where DeviceId == "your_device_id"
| summarize EventCount = count() by RuleName, RuleLastModificationTime, $table
| order by RuleLastModificationTime desc
```

> **On the exam:** "You created a custom data collection rule with the manual tag Finance-Servers and no events arrive." Custom data collection supports only **dynamic tags** from Asset Rule Management. Create a dynamic rule for the tag and wait for it to run.

## Security policies and ASR rules

**Attack surface reduction (ASR)** rules block behaviors that malware commonly uses: Office applications launching child processes, credential theft from LSASS, execution of obfuscated scripts, executables from email, persistence through WMI subscriptions, abuse of vulnerable signed drivers.

Configuration methods:

- **Microsoft Intune**: `Endpoint security > Attack surface reduction`,
- **Defender for Endpoint security settings management**: `Endpoints > Configuration management > Endpoint security policies` in the Defender portal (devices without Intune),
- Group Policy, PowerShell (`Set-MpPreference` / `Add-MpPreference`), Configuration Manager.

Rule modes:

| Mode | Behavior |
|---|---|
| **Not configured** / **Disabled** | the rule does not work |
| **Audit** | only records what would have been blocked |
| **Warn** | the user gets a warning and can bypass it |
| **Block** | the behavior is blocked |

Recommended procedure: turn the rules on in **Audit**, analyze the impact in advanced hunting or the ASR report, add **exclusions** (files, folders) for legitimate applications, then switch to **Block**. Microsoft designates several rules as **standard protection** (e.g. blocking credential theft from LSASS, abuse of vulnerable signed drivers, persistence through WMI) that can be turned on in Block right away with little risk.

```kql
DeviceEvents
| where Timestamp > ago(7d)
| where ActionType startswith "Asr"
| summarize Events = count(), Devices = dcount(DeviceId) by ActionType, FileName, InitiatingProcessFileName
| order by Events desc
```

`ActionType` ends with `Audited` or `Blocked` (e.g. `AsrLsassCredentialTheftAudited`), so from the same query you see what Block mode would stop.

> **On the exam:** "You need to introduce an ASR rule for Office macro child processes without disrupting business applications." First **Audit**, then analysis of `DeviceEvents` with an `ActionType` starting with `Asr`, exclusions, then **Block**. Going directly to Block across the whole organization is the wrong first step.

## Automated investigation and response (AIR)

AIR is a built-in "virtual analyst": an alert starts an investigation, every piece of evidence gets a verdict (**Malicious**, **Suspicious**, **No threats found**), and for malicious and suspicious entities **remediation actions** are proposed or executed (quarantining a file, stopping a process, isolation, blocking a URL, deleting an email…). AIR covers devices (Defender for Endpoint), email and content (Defender for Office 365) and identities.

**Important change (from 1 September 2026):** in **Defender for Endpoint**, AIR no longer works as a separate investigation experience and cannot be started manually. Its detection and response capabilities are part of the default antivirus protection and work automatically; for on-demand investigation Microsoft recommends a **full antivirus scan**. Scripts, playbooks and integrations that manually started AIR on a device need to be adjusted. AIR for **Defender for Office 365** remains available.

What you still manage:

- The **Automation level** per device group determines whether remediation actions run automatically or wait for approval (see the table below).
- **Action center** (`Actions & submissions > Action center`): the **Pending** tab (awaiting approval; pending actions for devices expire after 7 days and then behave as rejected) and the **History** tab (completed actions, with the option to **Undo**).
- In an incident, the **Investigations** tab shows automated investigations and their results.
- The **Automated investigation & response** card on the portal home page leads to pending actions.

Approving or rejecting actions requires the appropriate permission: for devices **Active remediation actions** (MDE RBAC) or Security Administrator, and for email actions in Defender for Office 365 also the **Search and Purge** role.

> **On the exam:** "A remediation action on a file in `C:\Windows\System32` is awaiting approval, while the same kind of action in `Downloads` was executed automatically." The device group has **Semi - require approval for core folders remediation**. Approve it in **Action center > Pending**.

## Device groups, permissions and automation levels

### Device groups

Path: `Settings > Endpoints > Permissions > Device groups` → **Add device group**:

1. **General**: name, description, **Automation level**.
2. **Devices**: membership rules by device name, domain, **tag** and operating system.
3. **Preview devices**: check who falls into the group.
4. **User access**: which Entra user groups (with MDE roles) have access to the group.

Groups have a **rank**: a device belongs to the highest-ranked group whose rules it matches. Devices that do not belong to any group go to **Ungrouped devices (default)**. Creating device groups is available in Defender for Endpoint Plan 1 and Plan 2.

### Automation levels

| Automation level | Behavior |
|---|---|
| **Full - remediate threats automatically** | automatic remediation; recommended; default for tenants created since 16 Aug 2020 |
| **Semi - require approval for all folders** | all remediation actions on files wait for approval |
| **Semi - require approval for core folders remediation** | approval for files in system folders (e.g. `\windows\*`), the rest automatically |
| **Semi - require approval for non-temp folders remediation** | automatic only in temp and download folders, the rest waits for approval |
| **No automated response** | no automated investigation or remediation; not recommended |

The device group automation level is also visible in `Settings > Microsoft Defender XDR > Automated response > Devices > Device groups`, where the group's relationship to **automatic attack disruption** is managed.

### Permissions

Defender for Endpoint uses either the old model (`Settings > Endpoints > Roles`) or **Microsoft Defender XDR Unified RBAC** (`Settings > Microsoft Defender XDR > Permissions and roles`). A role is assigned to an Entra group, and access to devices is limited through device groups. Example permissions: view data, alerts investigation, **active remediation actions**, **live response** (basic or advanced), **manage security settings**. Principle: a local SOC analyst gets a role only for the device groups of their location.

> **On the exam:** "Production servers must not be automatically remediated, but workstations must be." Create a device group for servers (rule by tag or OS) with **Semi - require approval for all folders** (or No automated response if explicitly required) and a rank above the general group; workstations stay on **Full**.

## Automatic attack disruption

**Automatic attack disruption** uses high-confidence signals from Defender XDR (and Sentinel) to automatically **stop** the attacker during an attack (spreading ransomware, business email compromise, AiTM phishing, compromised accounts):

- **Contain device** (including unmanaged devices via onboarded ones), automatic **isolation** of a workstation (preview),
- **Contain user** / **Disable user** (on-premises AD via Defender for Identity, Entra ID),
- actions in Okta and AWS (preview) when the Sentinel workspace is connected with the corresponding connector.

Incidents with such actions get the **Attack Disruption** tag, and the actions are visible in the incident and in the **Action center** (History), from where they can be undone (e.g. release from containment, enable user).

### Prerequisites

- License (e.g. Microsoft 365 E5/A5, MDE Plan 2, Defender for Identity, Defender for Office 365 Plan 2…).
- Product deployment: each product must be deployed to perform its action (e.g. MDE for contain device).
- **Defender for Endpoint**: device discovery set to **Standard discovery** (for contain device), Sense client 10.8470+ for contain user, device groups on **Full** (recommended) or Semi; a group on **No automated response** is excluded from containment.
- **Defender for Identity**: auditing on domain controllers, a correct **action account** (default LocalSystem), a sensor on the DC where the account is disabled.
- **Defender for Cloud Apps**: Microsoft 365 connector with all options.
- **Defender for Office 365**: mailboxes in Exchange Online, mailbox auditing (`MailItemsAccessed`, `UpdateInboxRules`, `MoveToDeletedItems`, `SoftDelete`, `HardDelete`).
- Roles for configuration: e.g. Security Administrator or Security Operator.

### Exclusions

Path: `Settings > Microsoft Defender XDR > Automated response`:

- **Identities** → **Add user exclusion**: accounts that are never automatically disabled (break-glass, service accounts).
- **Devices** → **Device groups** tab: the group's automation level for attack disruption (same levels as above).
- **Devices** → **IPs**: IP addresses, ranges and subnets that are not contained.
- **Devices** → **Policy application** (preview): for devices with a dynamic tag, you exclude only specific disruption controls.

Microsoft does not recommend exclusions because they reduce protection. A full opt-out is only possible through a support request ("Attack disruption opt-out"); alerts still arrive, just without automatic actions.

> **On the exam:** "Attack disruption must never disable the break-glass account emergency-admin, and everything else should stay automatic." Answer: a **user exclusion** in `Automated response > Identities`. Turning off attack disruption or setting all groups to No automated response is too much.

Also watch out for your own automation: a script that regularly re-enables all employee accounts can undo a disable performed by attack disruption.

## Microsoft Sentinel automation rules

**Automation rules** centrally manage the response to incidents and alerts without writing code. Path: `Microsoft Sentinel > Configuration > Automation > Automation rules` (in the Defender portal), or from the **Automated response** tab of an analytics rule.

### Triggers

| Trigger | Fires when |
|---|---|
| **When incident is created** | in the Defender portal: an incident is created in the Defender portal (from any source) |
| **When incident is updated** | change of status, owner, severity, added alerts, comments, tags, tactics |
| **When alert is created** | an alert from a Sentinel **Scheduled** or **NRT** rule |

In the Defender portal, the alert trigger works only for **Sentinel** alerts; for Defender XDR alerts, the **Enhanced Alert Trigger** is used in a playbook.

### Conditions and actions

- **Conditions**: incident properties (analytics rule name, severity, status, tags, entities…), operators equals, contains, starts with…; for the update trigger also state changes (**changed**, **changed from**, **changed to**, **added**) and **Updated by** (application, user, AIR, alert grouping, playbook, automation rule, other).
- **Actions**: **Change status** (closing with a reason and comment), **Change severity**, **Assign owner**, **Add tags**, **Add task**, **Run playbook**. Actions run in order.
- **Expiration date**: the rule is turned off after the date (e.g. during a penetration test).
- **Order**: rules run **sequentially** by number; each trigger type has its own order; a later rule sees the incident as the previous one left it. All create rules run before update rules.

Typical scenarios: suppressing noisy incidents (close as benign with an expiration), automatic owner assignment, tagging, task lists for analysts, running one playbook for all analytics rules.

### Differences in the Defender portal

- The **Incident provider** condition has been removed; all incidents have the **Microsoft XDR** provider, so rules also run on Defender XDR incidents. To restrict to Sentinel, use the **Analytic rule name** condition.
- `SecurityIncident` no longer has the **Description** field; rules that use it in a condition do not work.
- Don't rely on the **incident title** in conditions (correlation can change it); use the analytics rule name and tags.
- It can take up to **10 minutes** from an alert to an automation rule running; multiple changes to the same incident within 5–10 minutes are sent as one (the last) change.
- Creating an automation rule directly from an incident is only possible in the Azure portal; in the Defender portal you create it on the **Automation** page.

> **On the exam:** "During a penetration test from 1 to 5 November, all rules from IP address 10.10.5.20 should be automatically closed as benign positive." Answer: an **automation rule**, trigger incident created, a condition on the IP entity, action Change status → Closed (Benign Positive), **Expiration date** 5 November. A playbook is not needed.

## Microsoft Sentinel playbooks

A **playbook** is a workflow in **Azure Logic Apps** (Consumption or Standard) that performs more complex actions: enrichment (WHOIS, geolocation), synchronization with a ticketing system (ServiceNow), notifications (Teams, Slack, email), response (blocking a user in Entra ID, isolating a device via the MDE API, blocking an IP on the firewall).

### Triggers

- **Microsoft Sentinel incident**: recommended; the incident has alerts, entities and comments.
- **Microsoft Sentinel alert**: for alerts from rules that don't create incidents.
- **Microsoft Sentinel entity**: manual run on an entity.

An automation rule can run only playbooks with the **same trigger type** (incident → incident, alert → alert). In the Defender portal, manually running a playbook on an **alert** or **entity** is currently not supported; on an incident it is, when the incident is synchronized with Sentinel.

### Permissions

| Role | Purpose |
|---|---|
| **Owner** / **User Access Administrator** | granting Sentinel permissions on the playbook's resource group |
| **Microsoft Sentinel Contributor** | attaching a playbook to an analytics or automation rule |
| **Microsoft Sentinel Responder** | access to the incident for a manual run, but not the run itself |
| **Microsoft Sentinel Playbook Operator** | manually running playbooks |
| **Microsoft Sentinel Automation Contributor** | assigned to the **Sentinel service account**, not to a user; allows automation rules to run playbooks |
| **Logic App Contributor** (Consumption) | editing and running playbooks |
| **Logic Apps Standard Developer / Contributor / Operator** (Standard) | working with Standard logic apps |

When an automation rule runs a playbook, the **Microsoft Sentinel service account** is used, which must have the **Microsoft Sentinel Automation Contributor** role on the **resource group** where the playbook is. In the automation rule wizard, a playbook without that permission is grayed out; the **Manage playbook permissions** link assigns the role (this requires Owner on that resource group). In an MSSP scenario with Azure Lighthouse, delegation is needed for the **Azure Security Insights** application with the same role.

For playbook authentication to other services, Microsoft recommends the logic app's **managed identity** instead of user credentials in connections.

Playbook templates (preview) come from the **Content hub** and from the Azure-Sentinel GitHub repository; active playbooks are shown in the **Active playbooks** tab, templates in **Playbook templates**.

> **On the exam:** "An automation rule cannot select a playbook; the playbook is grayed out in the list." The Sentinel service account does not have **Microsoft Sentinel Automation Contributor** on the playbook's resource group. Solution: **Manage playbook permissions** (as Owner of the resource group). Assigning Logic App Contributor to the analyst does not solve the problem.

## Automation rule or playbook?

| Requirement | Solution |
|---|---|
| Changing status, severity, owner, tags, adding tasks | **automation rule** |
| Temporarily closing noisy incidents | **automation rule** with an expiration date |
| Enrichment with data from an external API | **playbook** |
| A ServiceNow ticket and two-way synchronization | **playbook** (incident created + incident updated automation rules) |
| A message to a Teams channel | **playbook** |
| The same playbook for all analytics rules | **automation rule** without a rule condition, action Run playbook |
| Isolating a device when a detection over Defender data fires | a **custom detection** action or attack disruption, not necessarily a playbook |

## Monitoring automation

When health monitoring for automation is enabled, automation rule runs (including playbook runs) are recorded in `SentinelHealth`:

```kql
SentinelHealth
| where TimeGenerated > ago(7d)
| where SentinelResourceType == "Automation rule"
| summarize Runs = count(), Failures = countif(Status != "Success") by SentinelResourceName
| order by Failures desc
```

Reviewing actions in Defender XDR through advanced hunting, e.g. which alerts came from which detection and how many per source:

```kql
AlertInfo
| where Timestamp > ago(7d)
| summarize Alerts = count() by ServiceSource, DetectionSource, Severity
| order by Alerts desc
```

## Lab: checking before automating

Before an automation rule automatically closes incidents for some IP address, check in the lab how much activity comes from it and whether it really is just a test:

```kql
SecurityEvent
| where IpAddress == "10.10.5.20"
| summarize Events = count(), Accounts = dcount(Account), Computers = dcount(Computer) by EventID
```

And before ASR or custom detection actions, which processes the rule would hit:

```kql
DeviceProcessEvents
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "powerpnt.exe")
| summarize Executions = count(), Devices = dcount(DeviceName) by FileName
| order by Executions desc
```

## Summary

- Email notifications: `Settings > Microsoft Defender XDR > Email notifications`, tabs **Incidents**, **Actions** (manual/automated, device groups, status) and **Threat analytics**; requires **Manage security settings**.
- **Alert tuning** (formerly suppression): Hide alert (MDE only), Resolve alert, Set as behavior; up to 200 conditions; does not apply to custom detections. Correlation is done by Defender XDR; **Restrict correlation to within scoped device groups** is an option in MDE advanced features.
- MDE **advanced features**: EDR in block mode, automatically resolve alerts, allow or block file, custom network indicators, tamper protection, live response (also for servers, and unsigned scripts), device discovery…
- **Rules** in MDE: indicators (Allow, Audit, Warn, Block execution, Block and remediate), **Custom Data Collection** (MDE P2, Sentinel workspace, dynamic tags only, `DeviceCustom*` tables, 75,000 events per rule per device in 24h).
- **ASR**: Audit → analysis (`DeviceEvents`, `ActionType` starts with `Asr`) → exclusions → Block; configuration through Intune or security settings management.
- **AIR**: from 1 Sep 2026, in MDE it is no longer a separate investigation nor a manual trigger, it works through AV protection; the Action center (Pending/History) and automation levels still govern remediation; MDO AIR remains.
- **Automation levels**: Full (recommended), three Semi variants, No automated response; set per **device group** (rank, rules by tag/OS, user access).
- **Attack disruption**: contain device/user, disable user; exclusions for identities, device groups, IPs and policy application; opt-out only through support.
- **Automation rules**: triggers incident created/updated and alert created, conditions, actions, order, expiration; in the Defender portal there is no Incident provider condition.
- **Playbooks**: Logic Apps; the Sentinel service account needs **Microsoft Sentinel Automation Contributor** on the playbook's resource group; managed identity for authentication.
