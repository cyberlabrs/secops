## Exam objectives: 1.3

This module covers objective **1.3 Ingest data into the Microsoft Sentinel SIEM and platform** from domain 1 (Manage a security operations environment, 40–45%). Bullets from the official study guide (as of 21 Oct 2026):

- select data connectors based on source requirements, including Windows logs and security events,
- collect Windows Security events with the **Windows Security Events via AMA** connector, including **data collection rules (DCR)**,
- plan and configure collection through **Windows Event Forwarding (WEF)**,
- plan and configure the **Syslog via AMA** and **Common Event Format (CEF) via AMA** connectors,
- collect **Azure activity** logs by using **Azure Policy** and **resource diagnostic settings**,
- ingest **threat indicators** into Sentinel,
- create **custom log tables** in the workspace.

Exam questions for this objective rarely ask "what is a connector". A typical scenario reads: "You have 300 on-premises Windows servers and a Linux forwarder for a firewall. You need to collect only events 4624 and 4625 and minimize costs. What should you do?" The answer depends on three things: **which agent** (AMA, not legacy), **which table** the data ends up in, and **where filtering happens** (DCR at the source or a transformation).

> Portal note: Microsoft Sentinel in the Azure portal will no longer be supported **after 31 March 2027** and will then remain only in the **Microsoft Defender portal**. In this module we give paths for the Defender portal (`Microsoft Sentinel > Configuration > Data connectors`), and where it matters, for the Azure portal as well.

## How data reaches Sentinel

Sentinel is built on top of a **Log Analytics workspace**. Every connector ultimately writes rows into some table of the workspace. There are several ingestion mechanisms:

| Mechanism | Example sources | Typical table |
|---|---|---|
| **Service-to-service (API) connectors** | Microsoft Entra ID, Microsoft 365, Defender XDR | `SigninLogs`, `AuditLogs`, `OfficeActivity` |
| **Diagnostic settings** | Azure resources, Azure Activity, Key Vault | `AzureActivity`, `AzureDiagnostics` or resource-specific tables |
| **Azure Monitor Agent (AMA) + DCR** | Windows servers, Linux machines, log forwarder | `SecurityEvent`, `WindowsEvent`, `Syslog`, `CommonSecurityLog` |
| **Codeless Connector Framework (CCF)** | Partner SaaS APIs | vendor tables, often `_CL` |
| **Logs Ingestion API** | your own application, a script | custom `_CL` table |
| **Threat intelligence connectors / upload API** | TAXII servers, TIP platforms | `ThreatIntelIndicators`, `ThreatIntelObjects` |

Connectors are installed through the **Content hub**: you install a **solution** (e.g. "Windows Security Events", "Common Event Format", "Syslog", "Threat Intelligence"), and it brings the connector, analytics rule templates, workbooks and parsers. A common exam trap is the answer "select the connector in the Data connectors gallery" when the connector hasn't even been installed: first the **Content hub**, then the connector.

Path in the Defender portal:

1. `Microsoft Sentinel > Content management > Content hub` → find the solution → **Install**.
2. `Microsoft Sentinel > Configuration > Data connectors` → select the connector → **Open connector page**.
3. On the connector page: prerequisites, then configuration (e.g. **+Create data collection rule**).

## Choosing a connector for Windows logs

For Windows there are two AMA connectors, and they write to **different tables**. This is the most common trap in this objective.

| Requirement | Connector | Table |
|---|---|---|
| Security log from servers (directly from each machine) | **Windows Security Events via AMA** | `SecurityEvent` |
| Events that WEF already collects on the collector (WEC) | **Windows Forwarded Events** | `WindowsEvent` |
| Other Windows event logs (System, Application, Sysmon) | DCR through Azure Monitor (Windows Event Logs) | `Event` |
| DNS server logs | **Windows DNS Events via AMA** | `ASimDnsActivityLogs` |
| Windows Firewall logs | **Windows Firewall Events via AMA** | `ASimNetworkSessionLogs` |

The official documentation explicitly says: events collected through Windows Event Forwarding are written to `WindowsEvent`, **including** those from the Security log, and **not** to `SecurityEvent`. Many built-in analytics rules (and some NRT rules) read `SecurityEvent` and won't see data that exists only in `WindowsEvent`. If you need those rules without changes, use Windows Security Events via AMA; otherwise adapt the queries to `WindowsEvent` or use **ASIM** parsers.

> **On the exam:** if the scenario says "the built-in analytics rules for Windows Security events must work without changes", the answer is **Windows Security Events via AMA** (table `SecurityEvent`). If it says "the organization already has a WEF infrastructure and an agent must not be installed on every server", the answer is **Windows Forwarded Events** on the WEC server (table `WindowsEvent`) together with ASIM parsers.

### Legacy agent

The **Log Analytics agent (MMA/OMS)** has been retired (August 2024). All new scenarios go through the **Azure Monitor Agent**. If an offered answer says "install the Log Analytics agent and enable the Security Events connector", it is a distractor. The same applies to the old CEF flow with the OMS agent on the forwarder: it has been replaced by **CEF via AMA**.

## Windows Security Events via AMA and DCR

### Prerequisites

- Read and write permissions on the Sentinel workspace.
- A machine that **is not an Azure VM** (a physical server, an on-premises VM, a VM in another cloud) must have **Azure Arc** (Connected Machine agent) installed and enabled **before** you enable the AMA connector. Without Arc, the machine doesn't appear in the resource list in the DCR wizard.
- The "Windows Security Events" solution installed from the Content hub.

### Creating a DCR in the portal

1. `Microsoft Sentinel > Configuration > Data connectors` → **Windows Security Events via AMA** → **Open connector page**.
2. Under **Configuration**, select **+Create data collection rule**.
3. **Basics**: the rule name, the subscription and the resource group where the DCR lives. The DCR doesn't have to be in the same resource group or subscription as the machines; it is enough that they are in the same tenant.
4. **Resources**: **+Add resource(s)**, then select subscriptions, resource groups or individual machines (Azure VMs and Arc-enabled servers). The wizard installs AMA on the selected machines that don't have it.
5. **Collect**: select an event set.
6. **Review + create** → **Create**.

All DCRs, including those created through the API, can later be seen on the connector page under **Configuration**, where you can edit or delete them.

### Event sets

| Event set | What it collects | When |
|---|---|---|
| **All events** | all Windows security and AppLocker events | full audit, forensics, higher cost |
| **Common** | a standard set for an audit trail (logon, account management, policy changes…) | the recommended balance |
| **Minimal** | a small set that can indicate a threat; not a full audit trail | minimal cost with basic detection |
| **Custom** | your **XPath** queries | precisely defined EventIDs or logs |

For **Custom**, you enter XPath expressions. AMA supports only **XPath 1.0**. According to the documentation, you can enter up to 20 expressions in one field, and a single rule can have up to 100 fields. An example XPath query that takes only successful and failed logons from the Security log:

```text
Security!*[System[(EventID=4624 or EventID=4625)]]
```

You can test XPath locally with the PowerShell cmdlet `Get-WinEvent` and the `-FilterXPath` parameter:

```powershell
$XPath = '*[System[(EventID=4624 or EventID=4625)]]'
Get-WinEvent -LogName 'Security' -FilterXPath $XPath -MaxEvents 5
```

If you get "The specified query is invalid", the syntax is not correct. If you get "No events were found…", the query may be correct; there just aren't any such events locally.

> **On the exam:** "You need to collect only EventIDs 4624, 4625 and 4688 from Windows servers and **minimize ingestion costs**." The correct answer is the **Custom** event set with an XPath query in the DCR. Filtering in the DCR happens **at the source** (the agent doesn't send the rest), so it isn't paid for. The answers "collect All events and then delete the excess with a query" or "create an analytics rule that ignores the other events" don't reduce cost.

### What a DCR actually is

A **data collection rule** is a standalone Azure resource that describes:

- **dataSources**: what is collected (e.g. `windowsEventLogs` with the `Microsoft-SecurityEvent` stream and `xPathQueries`),
- **destinations**: which workspace it goes to,
- **dataFlows**: which stream goes to which destination, optionally with a transformation (`transformKql`).

A DCR is linked to a machine through a **DCR association (DCRA)**. One machine can have multiple DCRs, and one DCR can be associated with many machines. That's why DCRs scale: you define once and assign to a group of servers. MSSPs and infrastructure-as-code teams create DCRs through the REST API or ARM/Bicep templates instead of the wizard.

### Verifying that data arrives

After creating the DCR, first check that AMA is sending a heartbeat, then whether events are arriving:

```kql
Heartbeat
| where TimeGenerated > ago(1h)
| where Category == "Azure Monitor Agent"
| summarize LastHeartbeat = max(TimeGenerated) by Computer, OSType
| order by LastHeartbeat desc
```

```kql
SecurityEvent
| where TimeGenerated > ago(1d)
| summarize Events = count() by Computer, EventID
| order by Events desc
```

If the machine has a heartbeat but no `SecurityEvent` rows, check whether the DCR is associated with that machine and whether the XPath actually matches events that exist.

## Windows Event Forwarding (WEF)

**Windows Event Forwarding** is a built-in Windows mechanism: source computers send events to a **Windows Event Collector (WEC)** server over WinRM, according to a **subscription** configuration (most often source-initiated, distributed through Group Policy). The events end up in the **Forwarded Events** log on the collector.

Why you would use it instead of an agent on every server:

- organizational policy doesn't allow installing additional agents on domain controllers or sensitive servers,
- a WEF infrastructure already exists and is well configured,
- the network allows outbound internet access (443) only from a few collectors.

### Planning

1. On the source computers, configure audit policies (Advanced Audit Policy) so that the desired events are generated at all.
2. Configure the WEC server and the subscription (which events, from which machines). Filtering in the WEF subscription reduces traffic and collector load.
3. Install **AMA** on the WEC server. If the WEC is not an Azure VM, first onboard it to **Azure Arc**.
4. In Sentinel, install the solution and open the **Windows Forwarded Events** connector, create a DCR with the WEC server as the resource.
5. Deploy the **ASIM** parsers for `WindowsEvent` (the documentation recommends this for normalization).
6. Check that the analytics rules you use read `WindowsEvent` or ASIM, not only `SecurityEvent`.

Scaling: a single WEC has limited capacity, so large environments use multiple collectors (e.g. per site or per server type) and split the subscriptions.

```kql
WindowsEvent
| where TimeGenerated > ago(1d)
| where Channel == "Security"
| summarize Events = count() by Computer, EventID
| order by Events desc
```

> **On the exam:** "After enabling the Windows Forwarded Events connector, the built-in brute force rule (which reads `SecurityEvent`) doesn't generate alerts, even though events are arriving." Cause: the events are in `WindowsEvent`. Solution: adapt the query or use the ASIM parser, or collect directly with the Windows Security Events via AMA connector.

## Syslog via AMA and CEF via AMA

### The difference between Syslog and CEF

- **Syslog** is a general message format from Linux machines and network devices. It ends up in the `Syslog` table (columns `Facility`, `SeverityLevel`, `SyslogMessage`, `HostName`…).
- **CEF (Common Event Format)** is a structured format on top of Syslog used by many firewalls and security appliances (`CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|Extension`). It ends up in the `CommonSecurityLog` table (columns `DeviceVendor`, `DeviceProduct`, `SourceIP`, `DestinationIP`, `Activity`…).

If the device supports CEF, choose **CEF via AMA**: you get parsed columns and built-in rules that read `CommonSecurityLog`.

### Architecture with a log forwarder

```text
[Firewall / appliance] --syslog/CEF (514 UDP/TCP)--> [Linux forwarder: rsyslog or syslog-ng + AMA] --HTTPS 443--> [Log Analytics workspace]
```

Devices can't have an agent, so they send messages to a **Linux log forwarder**. On the forwarder, the syslog daemon (rsyslog or syslog-ng) receives messages on port 514 and forwards them locally to AMA (port 28330), and AMA sends them to the workspace.

### Forwarder prerequisites

- A dedicated Linux VM with an OS supported by AMA.
- If it is not an Azure VM, it must have the **Azure Arc Connected Machine agent**.
- Python 2.7 or 3 (for the installation script).
- `rsyslog` or `syslog-ng` enabled.
- Roles: **Virtual Machine Contributor** or **Azure Connected Machine Resource Administrator** (agent installation) and **Monitoring Contributor** (DCR creation).
- If devices send over the internet (a forwarder in the cloud), configure TLS in the syslog daemon.

### Steps

1. From the Content hub, install the solution for the device or the general "Common Event Format" / "Syslog" solution.
2. `Data connectors` → **Common Event Format (CEF) via AMA** (or **Syslog via AMA**) → **Open connector page** → **+Create data collection rule**.
3. **Resources**: select the forwarder VM (if it's not in the list, it probably doesn't have the Arc agent).
4. **Collect**: for each **facility**, select the **minimum log level**. Selecting `LOG_ERR` collects `LOG_ERR`, `LOG_CRIT`, `LOG_ALERT` and `LOG_EMERG`.
5. **Review + create**. The wizard installs AMA on the forwarder.
6. On the forwarder, run the installation script from the connector page:

```bash
sudo wget -O Forwarder_AMA_installer.py https://raw.githubusercontent.com/Azure/Azure-Sentinel/master/DataConnectors/Syslog/Forwarder_AMA_installer.py && sudo python3 Forwarder_AMA_installer.py
```

The script configures rsyslog or syslog-ng to listen on port **514 UDP and TCP** and restarts the daemon.

7. On the device, configure sending logs to the forwarder's IP.
8. Test (`netstat -lnptv` for the listener, `logger` for a test message) and check in the workspace:

```kql
CommonSecurityLog
| where TimeGenerated > ago(1d)
| summarize Events = count() by DeviceVendor, DeviceProduct
| order by Events desc
```

```kql
Syslog
| where TimeGenerated > ago(1d)
| summarize Events = count() by Facility, SeverityLevel
| order by Events desc
```

### Data duplication

If you use the same **facility** for both the Syslog and the CEF stream, the same messages can end up in both `Syslog` and `CommonSecurityLog`, so you pay twice. Solution: separate the facilities (e.g. CEF devices send to `local4`, and the Syslog DCR doesn't take `local4`) or filter with a transformation in the DCR.

> **On the exam:** "CEF messages from the firewall arrive in both the `Syslog` and the `CommonSecurityLog` table." Answer: the Syslog and CEF DCRs use **the same facility**; remove that facility from the Syslog DCR. The answer "disable the CEF connector" loses the parsed columns.

Scaling: for high volume, use multiple forwarders (e.g. a Virtual Machine Scale Set behind a load balancer with round-robin distribution) and configure the daemon not to keep unnecessary logs locally, because a full disk stops AMA.

## Azure activity logs: Azure Policy and diagnostic settings

The **Azure Activity log** records operations at the subscription level (control plane): who created, deleted or modified a resource, RBAC changes, Service Health. In Sentinel it ends up in the `AzureActivity` table.

### How it is connected

The **Azure Activity** connector uses the **diagnostic settings** pipeline: a diagnostic setting is created at the subscription level that sends the Activity log to the workspace. So that you don't have to do this manually for every subscription, the connector offers an **Azure Policy** assignment:

1. `Data connectors` → **Azure Activity** → **Open connector page** → **Launch Azure Policy Assignment wizard**.
2. Policy: **Configure Azure Activity logs to stream to specified Log Analytics workspace**.
3. **Scope**: a management group or a subscription (the Activity log is at the subscription level, so a resource group is not a meaningful scope).
4. **Parameters**: select the Sentinel workspace.
5. **Remediation**: check **Create a remediation task**. A policy with the `DeployIfNotExists` effect covers new subscriptions on its own, but **existing** ones need a remediation task.
6. **Review + create**.

Assigning the policy requires the **Owner** role (or another role that can assign policies and give the managed identity the necessary permissions) at the assignment scope.

> **On the exam:** "The policy was assigned to a management group, new subscriptions send `AzureActivity`, but existing ones don't." A **remediation task** is missing. If "wait 24 hours" is offered, it is a distractor: `DeployIfNotExists` doesn't change existing resources without remediation.

If you used the old (legacy) method of connecting the Activity log, the documentation requires you to first **disconnect the subscriptions from the legacy method**, and only then enable the new connector; otherwise you get duplicate data.

### Diagnostic settings for other Azure resources

For resources such as Key Vault, Storage accounts, NSGs or Azure Firewall, logs are also sent through **diagnostic settings** (`Resource > Monitoring > Diagnostic settings > Add diagnostic setting > Send to Log Analytics workspace`). Many Sentinel connectors for Azure services have the same option with an Azure Policy assignment (e.g. "Deploy - Configure diagnostic settings for … to Log Analytics workspace") to cover all resources of that type.

The destination can be **Azure diagnostics** mode (everything in `AzureDiagnostics`) or **Resource specific** mode (separate tables per category, e.g. `AZFWNetworkRule` for Azure Firewall). Resource specific is recommended: a smaller table, a clearer schema, faster queries.

```kql
AzureActivity
| where TimeGenerated > ago(7d)
| where OperationNameValue has "roleAssignments/write"
| where ActivityStatusValue == "Success"
| project TimeGenerated, Caller, CallerIpAddress, ResourceGroup, _ResourceId
| order by TimeGenerated desc
```

## Threat indicators

### Threat intelligence sources

| Method | What it does | Status |
|---|---|---|
| **Microsoft Defender Threat Intelligence** connector | Microsoft IOCs; standard (public IOCs, OSINT) and premium (Microsoft IOCs, enriched OSINT) | active |
| **Threat Intelligence - TAXII** connector | a built-in TAXII client pulls STIX 2.0/2.1 from TAXII 2.x servers; needs the **API root** and **collection ID** | active |
| **Threat Intelligence upload API** | a TIP or your own application sends STIX objects over REST; **no connector needed**; the Entra application needs the **Microsoft Sentinel Contributor** role; the endpoint is at the workspace level | recommended for TIP integrations |
| **Threat Intelligence Platforms** connector | the old tiIndicators Graph API, indicators only | **being deprecated** |
| Manual creation / file import | an analyst creates a STIX object or imports a file in the management interface | active |

All connectors are part of the **Threat Intelligence** solution in the Content hub. In the Defender portal, TI is managed under **Threat intelligence > Intel management** (in the Azure portal, `Microsoft Sentinel > Threat management > Threat intelligence`).

> **On the exam:** "The organization uses a TIP that supports STIX and REST, and requires a solution that also supports other STIX objects (threat actor, attack pattern), not only indicators." Answer: **Threat Intelligence upload API**. The **Threat Intelligence Platforms** connector supports only indicators and is being deprecated. If the source offers a **TAXII 2.x** server, the answer is the **Threat Intelligence - TAXII** connector.

### Tables

- `ThreatIntelIndicators`: STIX indicators (IP, domain, URL, hash, certificate…).
- `ThreatIntelObjects`: other STIX objects (threat actor, attack pattern, identity, relationship).
- The old `ThreatIntelligenceIndicator` table no longer receives data (ingestion stopped after 31 July 2025). Queries, rules and workbooks should be moved to the new tables.

Sentinel periodically (every 7–10 days) rewrites all TI data for query efficiency, and deduplication is based on the `Id` field: the version with the newest `TimeGenerated` applies. That's why queries take the latest version of an indicator:

```kql
ThreatIntelIndicators
| where TimeGenerated > ago(14d)
| summarize arg_max(TimeGenerated, *) by Id
| where IsActive == true and ValidUntil > now()
| where ObservableKey == "ipv4-addr:value"
| project IndicatorIp = ObservableValue, Confidence, ValidUntil
```

### Ingestion rules for TI

**Ingestion rules** filter or modify TI objects from **connectors** before they are written: e.g. drop low-confidence indicators that haven't been updated in 6 months, extend `Valid until` for trusted sources, add a tag. Rules run in order until one performs **Delete**. They don't affect data from the upload API or manually created objects, and new rules take effect within up to 15 minutes.

### Using indicators

TI is used through analytics rules from templates (matching by indicator type and data source) and through the **Microsoft Threat Intelligence Analytics** rule (matching analytics), which compares Microsoft's indicators with CEF, Syslog and Windows DNS data. More on that in the detections module.

## Custom log tables

When a source has no ready-made connector, you send the data to a **custom table**:

- a custom table name **ends with `_CL`** (the portal adds the suffix automatically; via CLI, API or a template you add it yourself),
- every table must have a `TimeGenerated` column; if the data doesn't have it, Azure Monitor adds it in the transformation,
- custom columns in **Azure (built-in)** tables end with `_CF`.

### Table plans

| Plan | Purpose |
|---|---|
| **Analytics** (default) | data for detections, analytics rules and interactive queries |
| **Basic** | logs you rarely search, cheaper ingestion, limited KQL |
| **Auxiliary / Lake** | high volume, low detection value; in Sentinel it maps to the **data lake** tier |

More about tiers and retention (Analytics, Data lake, XDR) in the Sentinel platform module. What matters here: you choose the plan when **creating** the table, based on whether you need the data for real-time detection.

### Creating a DCR-based custom table (portal)

1. `Log Analytics workspace > Tables > Create > New custom log (DCR-based)`.
2. The table name (without `_CL`), an optional description, the **Table plan**.
3. Select an existing DCR or **Create a new data collection rule**.
4. Select a **data collection endpoint (DCE)** if needed.
5. **Browse for files**: upload a JSON file with sample data.
6. **Transformation editor**: write the KQL transformation, **Run**, then **Apply**.
7. Review the schema, **Create**.

To send data from an application, use the **Logs Ingestion API**: the application (an Entra app registration or a managed identity with the **Monitoring Metrics Publisher** role on the DCR) sends JSON to the DCR endpoint. A DCR of type **Direct** has its own `logsIngestion` endpoint and doesn't need a separate DCE.

Other variants of custom ingestion through AMA: the **Custom Logs via AMA** connector for text and JSON files from a VM (a DCR with a text/JSON log source).

> **On the exam:** "An application in your own data center needs to send JSON records to Sentinel, and the `EventTime` field should become `TimeGenerated`." Answer: a custom `_CL` table + a DCR with a transformation + the **Logs Ingestion API**. The HTTP Data Collector API (the old method) and MMA custom logs are legacy and are not the correct answer.

## DCR transformations in KQL

A **transformation** is a KQL query in the DCR (`transformKql`) that runs on **every incoming record before it is written** to the table. The input is the virtual table `source`. It is used for:

- **filtering rows** (reducing cost, dropping noise),
- **removing or masking columns** (e.g. personal data),
- **parsing** and adding columns,
- **routing** to another table (multiple dataFlows from the same stream).

Limitations: a transformation works record by record, so it doesn't support operators that look at multiple rows or tables, such as `summarize`, `join`, `union`, `top`, `sort`. Allowed are `where`, `extend`, `project`, `project-away`, `project-rename`, `parse`, scalar functions like `parse_json()`, `tostring()`, `todatetime()`, `iif()`, `case()`, `split()`, `strcat()`, `substring()` and similar.

Example 1: a transformation for a custom table from an application. It converts the time field into `TimeGenerated`, drops debug messages and masks the user name:

```kql
source
| extend TimeGenerated = todatetime(EventTime)
| where Severity != "Debug"
| extend UserMasked = strcat(substring(UserName, 0, 2), "***")
| project TimeGenerated, Computer, Severity, Message, UserMasked
```

Example 2: a transformation in a Syslog DCR that drops informational messages from one facility and lets the rest through:

```kql
source
| where not(Facility == "daemon" and SeverityLevel in ("info", "debug"))
```

Example 3: reducing columns in the `SecurityEvent` stream (keep only what detections use):

```kql
source
| where EventID in (4624, 4625, 4672, 4688, 4720, 4732)
| project-away EventData
```

### Workspace transformation DCR

For tables that are populated by a mechanism that **doesn't use a DCR** (e.g. some diagnostic settings flows), you define the transformation in the **workspace transformation DCR** (`Log Analytics workspace > Tables > ... > Create transformation`). A workspace can have only one such DCR, and in it one transformation for each supported table.

| Where to filter | When |
|---|---|
| XPath in the DCR (Windows) | you know the exact EventIDs; the agent doesn't even read anything else |
| Facility and log level in the DCR (Syslog/CEF) | coarse filtering by source and severity |
| `transformKql` in the DCR | filtering by message content, masking, parsing, routing |
| Workspace transformation DCR | tables that don't come through a DCR |
| TI ingestion rules | only for threat intelligence from connectors |

### Monitoring volume

Before and after introducing filters, check how much data is actually coming in:

```kql
Usage
| where TimeGenerated > ago(30d)
| where IsBillable == true
| summarize IngestedGB = round(sum(Quantity) / 1024, 2) by DataType
| order by IngestedGB desc
```

## Lab: checking the data in the lab

In the lab (the `lokql` tool) you have `SecurityEvent`, `DeviceProcessEvents`, `AzureFirewall` and `StormEvents`. The queries from this module that read `SecurityEvent` work locally. Example: how many events would remain if the DCR collected only logons (4624 and 4625):

```kql
SecurityEvent
| summarize Total = count(), Logons = countif(EventID in (4624, 4625))
| extend PercentKept = round(100.0 * Logons / Total, 1)
```

And which types of Azure Firewall traffic dominate, which helps you decide what to filter with a transformation:

```kql
AzureFirewall
| summarize Events = count() by Type, Action
| order by Events desc
```

## Summary

- Connectors are installed through the **Content hub** (solution), then configured on the connector page. Sentinel in the Azure portal will no longer be supported after **31 March 2027**.
- **Windows Security Events via AMA** writes to `SecurityEvent`; **Windows Forwarded Events** (WEF/WEC) writes to `WindowsEvent`, so built-in rules for `SecurityEvent` don't see that data without adaptation or ASIM.
- Machines outside Azure need **Azure Arc** before the AMA connector. The legacy Log Analytics agent (MMA) has been retired.
- Event sets: **All**, **Common**, **Minimal**, **Custom** (XPath 1.0). Filtering in the DCR reduces cost because the excess isn't sent.
- **Syslog via AMA** → `Syslog`, **CEF via AMA** → `CommonSecurityLog`; a Linux forwarder with rsyslog/syslog-ng + AMA, port 514, installation script `Forwarder_AMA_installer.py`. The same facility for both = duplicate data.
- **Azure Activity**: the Azure Policy "Configure Azure Activity logs to stream to specified Log Analytics workspace", scope a subscription or management group, a **remediation task** for existing subscriptions.
- TI: **Defender Threat Intelligence**, **TAXII** (STIX 2.x), **upload API** (recommended, no connector, Microsoft Sentinel Contributor role), the TIP connector is being deprecated. Tables `ThreatIntelIndicators` and `ThreatIntelObjects`.
- Custom tables have the **`_CL`** suffix, an **Analytics/Basic/Auxiliary** plan, and data arrives through the **Logs Ingestion API** and a DCR.
- **DCR transformations** (`transformKql`, input `source`) filter, mask and parse record by record; no `summarize` or `join`.
