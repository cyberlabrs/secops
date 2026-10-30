## Exam objectives: 1.4

This module covers objective **1.4 Configure detections** from domain 1 (Manage a security operations environment, 40–45%). Bullets from the study guide (as of 21 Oct 2026):

- create **custom detection rules** by using **Advanced hunting** in Microsoft Defender XDR,
- manage custom detection rules in Defender XDR,
- configure and manage **analytics rules** in the Microsoft Sentinel SIEM: **scheduled**, **near-real-time (NRT)**, **threat intelligence** and **machine learning**,
- analyze attack vector coverage by using the **MITRE ATT&CK** matrix,
- configure **anomalies** in Microsoft Sentinel.

An important change in 2025/2026: the Microsoft Sentinel documentation states that **custom detections** are now the recommended way to create new rules over data from both Sentinel and Defender XDR (lower ingestion cost, real-time detections, response actions, automatic entity mapping). Analytics rules in Sentinel still exist, work in the Defender portal and are on the exam. You need to know both worlds and when to use which.

## Alerts, incidents and who creates them

- An **alert** is a single signal produced by a rule or a product.
- An **incident** is a container of related alerts (the whole "story" of an attack).

When a Sentinel workspace is onboarded to the Defender portal, **incidents are created by the Defender XDR correlation engine**, including for Sentinel alerts. Consequences the exam likes:

| Item | Behavior after onboarding to the Defender portal |
|---|---|
| **Fusion** (Advanced multistage attack detection) | the rule is **turned off**; correlation is taken over by the Defender XDR engine |
| **Microsoft security** (incident creation) rules | automatically **deactivated** to avoid duplicates |
| Alert grouping in an analytics rule | the setting is visible, but incident grouping and merging is controlled by the Defender XDR engine |
| Rule with incident creation turned off | its alerts are **not visible** in the Defender portal |
| Alert tuning | Defender XDR alert tuning can also be applied to Sentinel alerts |

> **On the exam:** "After onboarding Sentinel to the Defender portal, the Advanced multistage attack detection rule is disabled. What do you need to do to keep correlation?" Nothing: correlation is now done by **Defender XDR**. Turning Fusion back on is neither possible nor necessary.

## Custom detection rules in Defender XDR

A **custom detection rule** is an **advanced hunting** query that runs periodically (or continuously), generates alerts and optionally triggers response actions. It can read Defender XDR tables (`Device*`, `Email*`, `Identity*`, `CloudAppEvents`…) and, when Sentinel is onboarded, tables from the Sentinel workspace.

### Permissions

- For Defender data: **Security settings (manage)** in Defender unified RBAC, or the Entra role **Security Administrator**. **Security Operator** is enough only if RBAC in Defender for Endpoint is turned off; with RBAC turned on you also need **Manage security settings**.
- Permissions are per source: someone with manage rights only for Defender for Office 365 can create rules over `Email*` tables, but not over `Identity*`.
- For Sentinel data: **Microsoft Sentinel Contributor** or higher on the workspace.
- For device scope: the user must have rights to all device groups in the rule's scope (a rule on "All devices" can only be edited by someone with rights to all groups).

### Creation

Two entry points:

1. `Investigation & response > Hunting > Advanced hunting` → write and run the query → **Create detection rule** (advantage: you see the results first).
2. `Hunting > Custom detection rules` → **+ Create detection rule** (the wizard opens right away, you enter the query in it).

Wizard steps: query → alert details → enrichment (dynamic title, custom details, entities) → actions → scope → review and **Create**. The rule runs immediately and the first time checks data from the last 30 days.

### Columns the query must return

| Column | Why |
|---|---|
| `Timestamp` or `TimeGenerated` | alert time; without it the time is set based on the lookback |
| `DeviceId` + `ReportId` (MDE tables) | correct device group scope and process tree |
| `Timestamp` + `ReportId` (other Defender tables) | identifies the original event, enriched timeline |
| a strong asset identifier: `DeviceId`/`DeviceName`, `RecipientEmailAddress`/`SenderFromAddress`, `AccountObjectId`/`AccountSid`/`AccountUpn` | automatic mapping of impacted assets |

Simple queries without `project` and `summarize` return these columns on their own. When you aggregate, return them with `arg_max`:

```kql
DeviceProcessEvents
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where ProcessCommandLine has_any ("-EncodedCommand", "-enc ")
| summarize (Timestamp, ReportId) = arg_max(Timestamp, ReportId), Executions = count() by DeviceId, DeviceName, AccountUpn
| where Executions >= 3
```

Microsoft recommends that you **do not filter on `Timestamp`** in a custom detection: the service prefilters the data based on the lookback itself (and looks at `ingestion_time()` because of ingestion delay). Each run can generate at most **150 alerts**, so narrow the query so it doesn't alert on normal day-to-day activity.

### Frequency and lookback

| Frequency | Lookback (rules with Defender XDR data) |
|---|---|
| **Every 24 hours** | 30 days |
| **Every 12 hours** | 48 hours |
| **Every 3 hours** | 12 hours |
| **Every hour** | 4 hours |
| **Continuous (NRT)** | events are checked as they arrive |
| **Custom** | only for rules over data **exclusively from Sentinel**: from 5 minutes to 14 days |

For rules over Sentinel data only, the lookback is configurable: with a frequency more often than once an hour the lookback is less than 48 hours; with a frequency of once a day or less often, up to 30 days.

**Continuous (NRT)** frequency is possible if the query:

- reads **only one table**,
- uses only supported KQL operators,
- has no `join`, `union` or `externaldata`,
- has no comments.

Supported tables include e.g. `DeviceProcessEvents`, `DeviceNetworkEvents`, `DeviceFileEvents`, `EmailEvents`, `IdentityLogonEvents`, `CloudAppEvents`, and on the Sentinel side `SecurityEvent`, `CommonSecurityLog`, `SigninLogs`, `AuditLogs`, `AzureActivity`, `OfficeActivity`, `AWSCloudTrail`. The custom detection rules page has **Migrate now**, which shows existing rules compatible with NRT and moves them to Continuous frequency.

> **On the exam:** "A custom detection rule must alert within a few minutes, and the query does a `join` between `DeviceProcessEvents` and `DeviceNetworkEvents`." Continuous (NRT) is not possible because of the `join` and the two tables. Options: rewrite the query to use one table, or accept **Every hour**.

### Alert details and enrichment

- **Detection name**, **Alert title**, **Severity**, **Category**, **MITRE ATT&CK** tactic, techniques and sub-techniques, **Description**, **Recommended actions**, optionally a link to a **threat analytics** report.
- **Dynamic title and description**: columns in double curly braces, e.g. `PowerShell with encoded command on {{DeviceName}}`. Up to three columns per field.
- **Custom details**: up to 20 key-value pairs, up to 4 KB total per alert (beyond that the whole set is dropped).
- **Entity mapping**: **Impacted assets** (Account, Device, Mailbox, Cloud application, Azure/AWS/GCP resource) and **Related evidence** (Process, File, Registry value, IP, URL, DNS, OAuth application…). For Defender data the entities are selected automatically, for Sentinel data manually. Entities affect how alerts are grouped into incidents.

### Response actions

Actions are available when the rule reads Defender data:

| Object | Actions | Required column |
|---|---|---|
| Device | Isolate device, Collect investigation package, Run antivirus scan, Initiate investigation, Restrict app execution | `DeviceId` |
| File | Allow/Block, Quarantine file | `SHA1`, `SHA256` or `InitiatingProcessSHA1/256` |
| User | Mark user as compromised, Disable user, Reset user authentication | `AccountObjectId`; for disable/reset also the SID (`AccountSid`…) |
| Email | Move to mailbox folder, Delete email (soft/hard) | `NetworkMessageId` + `RecipientEmailAddress` |

**Scope**: All devices or specific device groups. The rule reads data and runs actions only on devices in scope.

> **On the exam:** "A custom detection rule must automatically isolate the device, but the Isolate device option is unavailable." The query doesn't return `DeviceId`. Email actions require `NetworkMessageId` and `RecipientEmailAddress`.

### Managing existing rules

On the `Hunting > Custom detection rules` page you see the list of rules with status, last and next run, and result. For a rule you can:

- **Run** (run now), **Edit**, **Turn off / Turn on**, **Delete**,
- open the details and review **triggered alerts** and **triggered actions**,
- use **Migrate now** to move compatible rules to Continuous (NRT).

A change takes effect from the next scheduled run. Review rules regularly: false positives mean the query needs narrowing. Built-in **alert tuning** does not apply to alerts from custom detections, so you handle noise in the query itself.

Duplicates: when the lookback is longer than the frequency, the same event can be seen multiple times; custom detections automatically group and deduplicate identical events into one alert.

## Analytics rules in Sentinel

Path: Defender portal `Microsoft Sentinel > Configuration > Analytics` (Azure portal: `Microsoft Sentinel > Analytics`). Tabs: **Active rules**, **Rule templates**, **Anomalies**. You get more templates by installing solutions from the Content hub.

### Rule types

| Type | How it works | Customization |
|---|---|---|
| **Scheduled** | KQL query run periodically over a lookback period; alert when the result exceeds a threshold | full |
| **Near-real-time (NRT)** | runs every minute over data ingested in the previous minute | most scheduled rule options |
| **Microsoft security** | creates incidents from alerts of Microsoft products | filters; **not available** with Defender XDR integration or the Defender portal |
| **Threat intelligence** (Microsoft Threat Intelligence Analytics) | matches Microsoft indicators against CEF, Syslog and Windows DNS data | not customizable, only turn on/off |
| **Fusion** (Advanced multistage attack detection) | ML correlation of alerts from multiple products | not customizable; turned off in the Defender portal |
| **ML Behavior Analytics** (preview) | ML detection of anomalous SSH and RDP logins | not customizable |
| **Anomaly** | ML baseline, writes to the `Anomalies` table, doesn't create alerts | duplicate with changed threshold and parameters |

### Scheduled rule: the wizard

**General**: name, description, **Severity**, **MITRE ATT&CK** tactics and techniques, status.

**Set rule logic**:

- **Rule query** (KQL),
- **Alert enhancement**: **Entity mapping** (up to 10 mappings, each with up to 3 identifiers), **Custom details** (columns shown in the alert), **Alert details** (dynamic title, description, severity, tactics from query columns),
- **Query scheduling**: **Run query every** (from 5 minutes to 14 days) and **Lookup data from the last** (up to 14 days),
- **Alert threshold**: e.g. "Is greater than 0",
- **Event grouping**: **Group all events into a single alert** or **Trigger an alert for each event**,
- **Suppression**: stop running the rule for a set time after it generates an alert.

**Incident settings**: **Create incidents from alerts triggered by this analytics rule**, and **Alert grouping** (grouping alerts into one incident within a time window: all together, by matching all entities, or by selected entities and details; option to reopen closed incidents). In the Defender portal this grouping is in practice controlled by the Defender XDR correlation engine, and reopening closed incidents doesn't work: new alerts create a new incident.

**Automated response**: automation rules tied to this rule (see the automation module).

Scheduled rules run with a built-in five-minute delay because of ingestion delay.

Example scheduled rule: many failed logons from a single IP address:

```kql
SecurityEvent
| where EventID == 4625
| summarize FailedLogons = count(), TargetAccounts = dcount(Account), FirstSeen = min(TimeGenerated), LastSeen = max(TimeGenerated) by IpAddress, Computer
| where FailedLogons >= 20
| extend AlertTitle = strcat("Brute force from ", IpAddress, " on ", Computer)
```

With this query: Run query every 1 hour, Lookup data from the last 1 hour, threshold > 0, entity mapping **IP** → `IpAddress`, **Host** → `Computer`, Alert details: title from the `AlertTitle` column, tactic **Credential Access**, technique T1110.

> **On the exam:** "The rule runs every 5 minutes with a 1-hour lookback and analysts get 12 alerts for the same attack." The lookback is longer than the frequency, so the same events are seen multiple times. Solutions: make the frequency and lookback equal, or turn on **suppression** for 1 hour.

### NRT rules

- Hard-coded: they run **every minute** and cover events **ingested** in the previous minute.
- They use **ingestion time**, not `TimeGenerated`, with a built-in two-minute delay; so source delay is not a problem.
- At most **50 NRT rules** per customer.
- They work correctly only for sources with ingestion delay under 12 hours.
- The query can read **multiple tables** and multiple workspaces.
- They can produce up to 30 single-event alerts; beyond that, 29 individual alerts and a thirtieth summary alert.
- They support entity mapping, custom details, dynamic alert details, alert grouping, suppression and automation rules.
- There is no frequency or lookback setting.

| Requirement | Rule |
|---|---|
| Alert within a minute for a critical event (e.g. addition to Domain Admins) | **NRT** |
| Aggregation over 24 hours (e.g. number of failed logons per day) | **Scheduled** |
| Correlation with a watchlist or TI via `join` over an hour of data | **Scheduled** (NRT supports multiple tables, but covers only a minute of data) |
| Query over Defender XDR tables with automatic device isolation | **Custom detection** |

Example NRT candidate: an account added to a privileged group (EventID 4728, 4732, 4756):

```kql
SecurityEvent
| where EventID in (4728, 4732, 4756)
| where TargetUserName in ("Domain Admins", "Administrators", "Enterprise Admins")
| project TimeGenerated, Computer, SubjectAccount, MemberName, TargetUserName, EventID
```

### Threat intelligence rules

Two kinds:

1. **Microsoft Threat Intelligence Analytics** (matching analytics): a single rule, not customizable. When you turn it on, it matches domain, IP and URL indicators from Microsoft Threat Intelligence against CEF, Syslog and Windows DNS data and creates high-fidelity alerts.
2. **TI templates** from the **Threat Intelligence** solution (e.g. matching IP indicators against various tables): scheduled rules you can customize.

Example of your own scheduled rule that matches active IP indicators against Azure Firewall logs:

```kql
let Indicators = ThreatIntelIndicators
    | where TimeGenerated > ago(14d)
    | summarize arg_max(TimeGenerated, *) by Id
    | where IsActive == true and ValidUntil > now()
    | where ObservableKey == "ipv4-addr:value"
    | project IndicatorIp = ObservableValue, Confidence;
AzureFirewall
| where TimeGenerated > ago(1h)
| join kind=inner Indicators on $left.DestinationIp == $right.IndicatorIp
| project TimeGenerated, SourceIp, DestinationIp, DestinationPort, Action, Confidence
```

Entity mapping: IP → `DestinationIp` (indicator) and IP → `SourceIp` (internal host).

### Machine learning rules and Fusion

- **ML Behavior Analytics** (preview): Microsoft ML models for anomalous **SSH** and **RDP** logins based on IP, geolocation and user history. They can't be modified, only turned on.
- **Fusion**: turned on by default in the Azure portal, it correlates low-fidelity alerts from multiple products into high-fidelity incidents. In the Defender portal (and with Defender XDR incident integration) it is **not available**; it's replaced by Defender XDR correlation.
- **Anomaly** rules are also ML (see below).

> **On the exam:** the question "which rule type can use any KQL and custom thresholds" = **scheduled**. "Which type can't be customized" = Microsoft Threat Intelligence Analytics, Fusion, ML Behavior Analytics. "Which one doesn't generate alerts" = **anomaly**.

### Rule health

If a rule fails repeatedly (e.g. the author loses access to another workspace in an MSSP scenario), Sentinel **automatically disables** it and adds "AUTO DISABLED" to its name. When health monitoring is turned on, the errors are visible in the `SentinelHealth` table:

```kql
SentinelHealth
| where TimeGenerated > ago(7d)
| where SentinelResourceType == "Analytics Rule"
| where Status != "Success"
| summarize Failures = count(), LastFailure = max(TimeGenerated) by SentinelResourceName, Status
| order by Failures desc
```

You can **export rules to an ARM template** and import them into another workspace, or manage them as code through **repositories** (GitHub, Azure DevOps).

## Custom detection or analytics rule?

| Criterion | Custom detection (Defender XDR) | Analytics rule (Sentinel) |
|---|---|---|
| Data | Defender XDR tables + Sentinel tables | Sentinel workspace (including XDR data if ingested into the workspace) |
| Defender XDR data without ingestion into Sentinel | yes (up to 30 days in advanced hunting) | no, it must be ingested into the workspace |
| Actions on device, file, user, email | built into the rule | through a playbook |
| Real-time | Continuous (NRT) for supported tables | NRT rule (max 50) |
| Frequency | 1h, 3h, 12h, 24h, Continuous; Custom 5 min–14 days for Sentinel-only | 5 min–14 days, lookback up to 14 days |
| Entity mapping | Impacted assets + Related evidence | up to 10 mappings |
| Alert tuning | built-in tuning doesn't apply | Defender alert tuning after onboarding |

Microsoft's transition guide recommends: if a detection uses both Defender XDR and Sentinel data, and you don't need to keep the XDR data longer than 30 days, create a **custom detection** that reads both sources, without ingesting the XDR data into Sentinel.

> **On the exam:** "You need a detection that combines `DeviceProcessEvents` (Defender for Endpoint) and `CommonSecurityLog` (firewall in Sentinel), automatically isolates the device and doesn't increase ingestion cost." Answer: a **custom detection rule** in the Defender portal. An analytics rule would require ingesting `DeviceProcessEvents` into the workspace and a playbook for isolation.

## MITRE ATT&CK coverage

Page: Defender portal `Microsoft Sentinel > Threat management > MITRE ATT&CK` (Azure portal: `Threat management > MITRE ATT&CK (Preview)`). The page is in preview and is currently aligned with **MITRE ATT&CK version 18**.

What it shows:

- **Current coverage**: a matrix of tactics and techniques, colored by the number of **active scheduled and NRT rules** that have that technique.
- **Simulated coverage** (**Simulated rules**): what the matrix would look like if you turned on the available templates (analytics rule templates, hunting queries).
- **Technique details**: description, link to MITRE, links to active rules and available hunting queries; in the Defender portal also recommended detections and products for that technique.
- In the Defender portal, the **View MITRE by threat scenario** filter shows coverage for a specific threat scenario.

Coverage is calculated from the **tactics and techniques you assigned to rules**. A rule without MITRE mapping doesn't contribute to the matrix, even if it actually detects the technique. Rule techniques are also carried over to incidents.

Gap analysis procedure:

1. Open the MITRE ATT&CK page and find techniques without active detections for your priority tactics (e.g. Credential Access, Lateral Movement).
2. Turn on **Simulated rules** and see which templates cover those techniques.
3. Check that you have the required data sources (the template lists its required data sources).
4. Activate the template or write your own rule and map the tactic and technique in the **General** tab.
5. Look at the matrix again.

> **On the exam:** "You created a scheduled rule for Kerberoasting, but technique T1558 still shows as uncovered in the MITRE ATT&CK matrix." The rule doesn't have the technique mapped in its settings (General tab). The matrix doesn't analyze the query text.

## Anomalies

**Anomaly** rules use ML to learn a behavioral baseline and flag deviations. Anomalies by themselves don't mean an attack, so they **don't generate alerts**: they are written to the `Anomalies` table and used as context in detections, investigations and hunting. Some anomalies come from the **UEBA** engine (baseline per entity, peers and organization).

Configuration: `Microsoft Sentinel > Configuration > Analytics > Anomalies`.

- Filters: status, tactics, techniques, data sources.
- Rule details: description, tactics and techniques, **Parameters**, **Threshold**, frequency, status **Production** or **Flighting**, template version.
- Built-in rules **can't be edited or deleted**. You can only switch between Production/Flighting.

Tuning:

1. Right-click the rule → **Duplicate**. A copy is created with the suffix " - Customized", **disabled**, in **Flighting** mode (label FLGT).
2. **Edit** the copy: change the **threshold** and parameters; results are visible in **Results preview**.
3. Turn on the copy. The original keeps running in **Production**.
4. Compare the results in the `Anomalies` table.
5. When you're satisfied, switch the copy to **Production**; the original automatically moves to Flighting (two versions of the same rule can't be in production at the same time).

Each built-in rule can have only **one** customized copy.

```kql
Anomalies
| where TimeGenerated > ago(1d)
| where AnomalyTemplateId contains "<RuleId>"
| project TimeGenerated, AnomalyTemplateName, RuleStatus, Score, UserName, Entities, AnomalyReasons
| order by Score desc
```

A query on `AnomalyTemplateId` returns anomalies from both the original and the copy, because the copy's `AnomalyTemplateId` is the same as the original's `RuleId`. If a rule produces too many anomalies, the threshold is probably too low.

Example of using anomalies in a detection: alert only when a user has both failed logons and an anomaly in the same period:

```kql
let AnomalousUsers = Anomalies
    | where TimeGenerated > ago(1d)
    | where isnotempty(UserName)
    | distinct UserName;
SecurityEvent
| where TimeGenerated > ago(1d)
| where EventID == 4625
| extend UserName = tostring(split(Account, "\\")[1])
| where UserName in (AnomalousUsers)
| summarize FailedLogons = count() by UserName, Computer
```

> **On the exam:** "An anomaly rule generates too many anomalies. You need to test a higher threshold without interrupting the existing rule." Answer: **Duplicate**, raise the threshold on the copy, leave it in **Flighting** and compare. Editing the built-in rule directly isn't possible.

## Lab: detection queries in the lab

In the lab (`lokql`) you can check a rule's logic before turning it into a detection. How many alerts a brute force rule would produce with different thresholds:

```kql
SecurityEvent
| where EventID == 4625
| summarize FailedLogons = count() by IpAddress, Computer
| summarize Over5 = countif(FailedLogons > 5), Over20 = countif(FailedLogons > 20), Over50 = countif(FailedLogons > 50)
```

And which parent processes launch PowerShell, as a basis for a custom detection:

```kql
DeviceProcessEvents
| where FileName =~ "powershell.exe"
| summarize Executions = count(), Devices = dcount(DeviceName) by InitiatingProcessFileName
| order by Executions desc
```

## Summary

- **Custom detections** are now the recommended way to build new detections over Defender XDR and Sentinel data. They are created from **Advanced hunting** (**Create detection rule**) or from the **Custom detection rules** page.
- The query must return `Timestamp`/`TimeGenerated`, `ReportId` and `DeviceId` (for MDE); actions require the matching columns (`DeviceId`, SHA1/SHA256, `AccountObjectId`/SID, `NetworkMessageId` + `RecipientEmailAddress`). Max 150 alerts per run.
- Frequencies: 24h (lookback 30d), 12h (48h), 3h (12h), 1h (4h), **Continuous (NRT)** for one table without join/union/externaldata, **Custom** 5 min–14 days only for Sentinel data.
- Sentinel types: **Scheduled** (5 min–14 days, lookback up to 14 days), **NRT** (every minute, ingestion time, max 50, multiple tables), **Microsoft security** (unavailable in the Defender portal), **Threat intelligence** (Microsoft Threat Intelligence Analytics, CEF/Syslog/DNS), **ML Behavior Analytics** (SSH/RDP), **Fusion** (turned off in the Defender portal), **Anomaly**.
- Entity mapping, custom details and dynamic alert details enrich alerts and affect correlation into incidents.
- The **MITRE ATT&CK** page shows coverage from active scheduled and NRT rules based on assigned techniques, plus simulated coverage from templates; ATT&CK v18.
- **Anomalies** don't create alerts, they write to the `Anomalies` table; tuning goes through **Duplicate** → Flighting → Production.
