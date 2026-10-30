## Exam objectives: 3.1 (part one)

Domain 3 (**Perform threat hunting**) is worth 20–25% of the exam, but KQL runs through all of SC-200: analytics rules, custom detections, workbooks, hunting queries and incident investigations are all KQL. This module covers the first three items of objective **3.1 Detect threats by using Microsoft Defender XDR**:

- **Identify the appropriate table to use in a KQL query** – which table to open for a given question,
- **Identify threats by using Kusto Query Language (KQL)** – reading and writing queries,
- **Create Advanced Hunting queries** – working on the **Advanced hunting** page of the Defender portal.

Advanced operators (`join`, `parse`, `make-series`…) and hunting graphs are covered in the next module.

On the exam you do not run KQL. You get a query with blanks ("fill in the operator"), a query to interpret ("how many rows does it return", "what does it show") or a scenario in which you pick the table. That is why you need to recognize the operators by heart and know their pitfalls.

## Where KQL is written

Since 2025, Microsoft Sentinel runs in the **Microsoft Defender portal** (unified security operations). Sentinel in the Azure portal is supported **until March 31, 2027**; after that, all customers use only the Defender portal. For KQL this means one place for everything:

| Location | Path in the Defender portal | What you do there |
|---|---|---|
| **Advanced hunting** | **Investigation & response** > **Hunting** > **Advanced hunting** | Queries over Defender XDR tables and (when a workspace is connected) over Sentinel tables |
| Sentinel "Logs" | same: the Azure portal **Logs** page is replaced by **Advanced hunting** in the Defender portal | Queries over the Log Analytics workspace |
| **Custom detection rules** | **Investigation & response** > **Hunting** > **Custom detection rules** | A query that runs on a schedule and generates alerts |
| Data lake exploration | **Microsoft Sentinel** > **Data lake exploration** | KQL over data that lives only in the data lake tier (module 10) |

Advanced hunting has two modes:

- **Guided mode** – a query builder that requires no KQL (you pick the source, filters, conditions),
- **Advanced mode** – a KQL editor with IntelliSense, the table schema and samples.

A query built in guided mode can be switched to advanced mode and edited further as KQL.

### Advanced hunting limits

| Parameter | Value |
|---|---|
| Data range (native Defender XDR) | **30 days** |
| Range for Sentinel tables | whatever the workspace **analytics** retention is set to |
| Maximum number of rows in a result | **100,000** |
| Maximum result size | **64 MB** (a partial result is returned with a message) |
| Query timeout | **10 minutes** |
| CPU | quota based on tenant size, in **15-minute** cycles; warning above 10%, blocked at 100% |

Data that lives **only in the data lake tier** is not visible in advanced hunting. For that data you use data lake exploration or KQL jobs.

All data in advanced hunting is in **UTC**. The portal displays results in the time zone you configured, but write the query (e.g. `datetime(2026-10-01 08:00)`) in UTC.

> **On the exam:** "You need to search Defender for Endpoint events older than 30 days with the LEAST effort" – advanced hunting on its own does not go beyond 30 days. The solution is to connect a Sentinel workspace and raise the **analytics retention** of the table (e.g. `DeviceProcessEvents`) above 30 days, or to use the Streaming API to external storage. The answer "increase retention in the Defender for Endpoint settings" is a distractor.

## Which table? (Identify the appropriate table)

This is pure memorization and earns easy points on the exam. Defender XDR tables are grouped by prefix.

### Defender XDR (advanced hunting schema)

| Table | What it contains | Typical question |
|---|---|---|
| `DeviceProcessEvents` | Process creation, command line, parent process | "Who launched `powershell.exe -enc`?" |
| `DeviceNetworkEvents` | Network connections from the device (RemoteIP, RemotePort, RemoteUrl) | "Which device connected to the attacker's IP?" |
| `DeviceFileEvents` | File creation, modification, deletion, rename | "Where was the file with this SHA256 written to disk?" |
| `DeviceRegistryEvents` | Registry changes | "Who added a Run key for persistence?" |
| `DeviceLogonEvents` | Sign-ins to the device (local, RDP, network) | "Failed RDP sign-ins to a server" |
| `DeviceImageLoadEvents` | DLL loads | "Which process loaded a suspicious DLL?" |
| `DeviceEvents` | Miscellaneous: ASR, exploit protection, USB, AV detections (`ActionType` tells them apart) | "How many ASR blocks per rule?" |
| `DeviceInfo`, `DeviceNetworkInfo` | Device inventory: OS, IP addresses, network adapters | "Which OS does device X run?" |
| `DeviceTvmSoftwareVulnerabilities` | Vulnerabilities (Defender Vulnerability Management) | "Devices with CVE-2026-xxxx" |
| `EmailEvents` | Email delivery: sender, recipient, verdict | "Who received the phishing campaign?" |
| `EmailAttachmentInfo` | Attachments (name, SHA256) | "Which emails carried this hash?" |
| `EmailUrlInfo` | URLs in emails | "Which emails contain domain X?" |
| `EmailPostDeliveryEvents` | ZAP and manual actions after delivery | "Did ZAP remove the email?" |
| `UrlClickEvents` | Clicks through Safe Links | "Who clicked the link?" |
| `IdentityLogonEvents` | Sign-ins to AD (Defender for Identity) and Entra | "Failed Kerberos/NTLM sign-ins" |
| `IdentityQueryEvents` | LDAP, DNS, SAMR queries against the DC | "Who is doing AD reconnaissance?" |
| `IdentityDirectoryEvents` | AD changes (groups, passwords) | "Who was added to Domain Admins?" |
| `IdentityInfo` | Account attributes (department, title, SID) | enriching results |
| `CloudAppEvents` | Activity in cloud apps (Defender for Cloud Apps, M365) | "Who mass-downloaded files from SharePoint?" |
| `AlertInfo`, `AlertEvidence` | Alerts from all Defender services and the entities in them | "All alerts for device X in 7 days" |

Defender XDR tables have the time column **`Timestamp`**. When the same tables are sent to a Sentinel workspace, they also get **`TimeGenerated`**.

### Sentinel / Log Analytics tables

| Table | Source |
|---|---|
| `SecurityEvent` | Windows Security log via AMA (4624 successful logon, 4625 failed, 4688 process, 4720 account created…) |
| `SigninLogs`, `AADNonInteractiveUserSignInLogs` | Microsoft Entra sign-ins (interactive / non-interactive) |
| `AuditLogs` | Microsoft Entra audit (changes to users, groups, applications) |
| `AzureActivity` | Azure control plane (who deleted a resource, assigned a role) |
| `OfficeActivity` | Microsoft 365 audit (Exchange, SharePoint, Teams) via the Sentinel connector |
| `CommonSecurityLog` | CEF (firewall, proxy appliances) |
| `Syslog` | Linux and network devices in Syslog format |
| `AzureFirewall` / `AZFW*` | Azure Firewall logs (legacy `AzureDiagnostics` or resource-specific tables) |
| `SecurityAlert`, `SecurityIncident` | Alerts and incidents in Sentinel |
| `Usage`, `SentinelHealth` | Ingestion volume and connector/rule health |

Sentinel tables have the **`TimeGenerated`** column. Custom tables have the **`_CL`** suffix.

> **On the exam:** watch for the difference between similar tables. A process on a **device with Defender for Endpoint** = `DeviceProcessEvents`. A process from a **Windows server without MDE, via AMA** = `SecurityEvent` with `EventID == 4688`. A sign-in to **Entra ID** = `SigninLogs`; a sign-in to a **domain controller** = `IdentityLogonEvents`; a sign-in to **the device itself** = `DeviceLogonEvents`. Who **changed an Azure resource** = `AzureActivity`, and who **changed a user in Entra** = `AuditLogs`.

## Query structure

A KQL query is a **data flow**: it starts with a table, and each `|` (pipe) passes the result to the next operator. Order matters.

```kql
// Failed sign-ins to Windows servers in the last 24 hours
SecurityEvent
| where TimeGenerated > ago(24h)
| where EventID == 4625
| summarize Failed = count() by Account, Computer
| where Failed > 10
| sort by Failed desc
```

Rules:

- table and column names are **case-sensitive** (`securityevent` does not work),
- comments start with `//`,
- multiple statements are separated with a semicolon `;` (matters for `let`, next module),
- strings go in `"..."` or `'...'`; `@"C:\Windows"` is a verbatim string (the backslash is not escaped).

## Basic operators

### Exploring data: `take`, `count`, `getschema`

```kql
SecurityEvent | take 10          // 10 arbitrary rows, to get to know the columns
SecurityEvent | count            // number of rows
SecurityEvent | getschema        // columns and types
```

`take` and `limit` are synonyms. Rows are not sorted, so `take` does not guarantee the "newest" ones.

### Filtering: `where`

```kql
SecurityEvent
| where TimeGenerated between (datetime(2026-10-01) .. datetime(2026-10-02))
| where EventID in (4624, 4625)
| where LogonType == 10                      // RemoteInteractive (RDP)
| where Account !endswith "$"                // no computer accounts
```

Multiple conditions in one `where` are combined with `and` / `or`. `not()` negates an expression. `isempty()`, `isnotempty()`, `isnull()` check for empty values.

### Columns: `project`, `project-away`, `project-rename`, `extend`

| Operator | What it does |
|---|---|
| `project A, B, C=expression` | keep **only** the listed columns (can also compute a new one) |
| `project-away A, B` | remove the listed columns, keep the rest |
| `project-rename New = Old` | rename a column |
| `project-reorder A, B` | change the order (the others remain) |
| `extend X = expression` | **add** a column, all existing ones remain |

```kql
DeviceProcessEvents
| where Timestamp > ago(7d)
| where FileName =~ "powershell.exe"
| extend CmdLength = strlen(ProcessCommandLine)
| where CmdLength > 1000
| project Timestamp, DeviceName, AccountName, CmdLength, ProcessCommandLine
```

A common pitfall: after `project`, columns that were not listed no longer exist. If `project Timestamp, DeviceName` is followed by `where AccountName == "x"`, the query fails.

### Aggregation: `summarize`

`summarize` groups rows and computes aggregations. The result has **only** the `by` columns and the aggregations.

| Function | Meaning |
|---|---|
| `count()` | number of rows |
| `countif(condition)` | number of rows that meet the condition |
| `dcount(Column)` | number of distinct values (an estimate, accurate enough for hunting) |
| `sum()`, `avg()`, `min()`, `max()` | numeric aggregations |
| `make_set(Column)` | array of distinct values (dynamic) |
| `make_list(Column)` | array of all values, with duplicates |
| `arg_max(Column, *)` | the whole row with the largest value (next module) |

```kql
// Password spray: one IP address, many different accounts
SecurityEvent
| where TimeGenerated > ago(1d)
| where EventID == 4625
| summarize Attempts = count(), AccountCount = dcount(Account), Accounts = make_set(Account, 20)
    by IpAddress
| where AccountCount > 15
```

Brute force against one account looks different: many attempts, **one** account, so you group `by Account` and filter on `count()`. A spray has many accounts with few attempts per account, so the key is `dcount(Account)`.

### Time windows: `bin()`

`bin()` rounds a value down to a step. Together with `summarize` it builds a histogram over time.

```kql
SecurityEvent
| where TimeGenerated > ago(7d)
| where EventID == 4625
| summarize Failed = count() by bin(TimeGenerated, 1h)
| render timechart
```

A gap in the data (an hour with no failed sign-ins) does **not** show up as a row with zero; the row simply does not exist. For a continuous series with zeros you use `make-series` (next module).

### Sorting and top values: `sort`, `top`, `distinct`

```kql
StormEvents
| summarize Damage = sum(DamageProperty) by State
| top 5 by Damage desc
```

- `sort by X desc` (synonym `order by`) – the default is **descending** (`desc`),
- `top N by X` = sort and take the first N, more efficient than `sort | take`,
- `distinct A, B` – unique combinations of columns.

### Visualization: `render`

`render` is always the **last** operator and does not change the data, only the display.

| Visualization | When |
|---|---|
| `timechart` | a value over time (x is a datetime) |
| `columnchart` / `barchart` | comparing categories (vertical / horizontal) |
| `piechart` | share of categories |
| `areachart`, `linechart` | trends |
| `anomalychart` | a series with anomalies marked (with `series_decompose_anomalies`) |

```kql
StormEvents
| summarize Events = count() by EventType
| top 10 by Events
| render piechart
```

> **On the exam:** a question like "You need to display the number of failed sign-ins per hour for the last 7 days as a line chart. How should you complete the query?" – the required combination is `summarize count() by bin(TimeGenerated, 1h)` and `render timechart`. The distractors are `bin(TimeGenerated, 7d)` (a single bar), `top` instead of `summarize`, and `render piechart`.

## Time in queries

| Expression | Meaning |
|---|---|
| `ago(1h)`, `ago(7d)`, `ago(30m)` | now minus a time span |
| `now()` | current time (UTC) |
| `datetime(2026-10-01 08:00)` | a specific point in time (UTC) |
| `between (A .. B)` | inclusive from A to B |
| `startofday()`, `startofweek()`, `startofmonth()` | start of a period |
| `datetime_diff('minute', T2, T1)` | difference in units |
| `T2 - T1` | the result is a `timespan` (e.g. `00:05:00`) |
| `format_datetime(T, 'yyyy-MM-dd')` | formatting for display |
| `hourofday(T)`, `dayofweek(T)` | extracting a part (for "sign-ins outside working hours") |

```kql
// Sign-ins outside working hours (UTC) and on weekends
SigninLogs
| where TimeGenerated > ago(14d)
| extend Hour = hourofday(TimeGenerated), Day = dayofweek(TimeGenerated)
| where Hour !between (6 .. 18) or Day in (0d, 6d)    // 0d = Sunday, 6d = Saturday
| summarize SignIns = count() by UserPrincipalName
```

### Time picker vs. filter in the query

Advanced hunting and Sentinel have a **time range** picker above the editor. If the query contains its own filter on the time column (`where Timestamp > ago(3d)`), the filter in the query applies and the picker shows "Set in query". On the exam it is assumed that the filter in the query is part of the solution.

The time filter always goes **first**. Data is partitioned by time, so a time filter immediately discards a large part of the data set.

### Note for the lab

The lab tables (`StormEvents` from 2007, `SecurityEvent`, `DeviceProcessEvents`, `AzureFirewall` from Microsoft's samples) have **old dates**. `ago(1d)` over them returns zero rows. In the lab, filter with `datetime(...)` or first look at the range:

```kql
SecurityEvent
| summarize From = min(TimeGenerated), To = max(TimeGenerated)
```

## String operators and performance

Sentinel and Defender index strings by **terms** (sequences of alphanumeric characters separated by non-alphanumeric ones). Operators that work on whole terms use the index and are fast; operators that look for a substring have to read everything.

| Operator | Meaning | Case | Example that is `true` |
|---|---|---|---|
| `==` | exactly equal | sensitive | `"cmd.exe" == "cmd.exe"` |
| `=~` | equal | insensitive | `"CMD.EXE" =~ "cmd.exe"` |
| `!=`, `!~` | not equal | sensitive / insensitive | |
| `has` | contains a **whole term** | insensitive | `"net user /add" has "user"` |
| `has_cs` | whole term | sensitive | |
| `contains` | contains a **substring** | insensitive | `"mimikatz.exe" contains "katz"` |
| `contains_cs` | substring | sensitive | |
| `startswith`, `endswith` | start / end | insensitive | `"svc_backup" startswith "svc_"` |
| `hasprefix`, `hassuffix` | term starts / ends with | insensitive | |
| `in (...)`, `in~ (...)` | one of the values | sensitive / insensitive | `FileName in~ ("cmd.exe","powershell.exe")` |
| `has_any (...)` | any of the terms | insensitive | `ProcessCommandLine has_any ("-enc","-encodedcommand")` |
| `has_all (...)` | all terms | insensitive | |
| `matches regex` | regular expression | sensitive | |

Key differences:

- `"mimikatz.exe" has "katz"` is **false** – "katz" is not a whole term (the terms are `mimikatz` and `exe`). `contains "katz"` is true.
- `has` is faster than `contains` and is usually enough, because you are looking for a file name, a user or a parameter, not part of a word.
- Terms of **3 characters or fewer** are not indexed. `has "-w"` or `has "ps"` is expensive and unreliable.
- Every operator has a negation with `!`: `!has`, `!contains`, `!in`, `!startswith`.

```kql
DeviceProcessEvents
| where Timestamp > ago(7d)
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where ProcessCommandLine has_any ("-encodedcommand", "-enc", "frombase64string")
| project Timestamp, DeviceName, AccountName, InitiatingProcessFileName, ProcessCommandLine
```

### Rules for fast queries (Microsoft best practices)

1. **Filter early** – time first, then the most selective condition, and only then `extend`, parsing and `summarize`.
2. **`has` instead of `contains`** when you are looking for a whole word.
3. **Case-sensitive is faster** – `==` and `has_cs` instead of `=~` and `has` when you know the exact form.
4. **Filter on a table column, not a computed column** – `where FileName =~ "x"` instead of `extend f = tolower(FileName) | where f == "x"`.
5. **Target a column** – avoid `search "x"` and `where * has "x"`; if you must, use `search in (Table1, Table2) "x"`.
6. **`project` before `join`** – fewer columns, less memory.
7. **Avoid regex** when `parse` or `has` do the same job.
8. **Estimate the size first** – `count` before running a query that returns everything.

For command lines, Microsoft recommends the opposite direction: attackers change letter case and quotes, so you use a **case-insensitive** comparison and filter on the **file name** (`FileName in~ ("net.exe","net1.exe")`), not on the exact command line.

> **On the exam:** "A query uses `where ProcessCommandLine contains "Invoke-Mimikatz"` and frequently exceeds the CPU quota. Which TWO changes reduce consumption without losing results?" – add a time filter at the beginning and replace `contains` with `has` (a whole term is being searched). Converting the column to lowercase with `extend` and `search *` both increase consumption.

## Queries for Defender XDR: typical patterns

### Searching by indicator (IoC)

```kql
let Hash = "e5f2b1c8a7d6e4f3c2b1a0e9d8c7b6a5f4e3d2c1b0a9e8d7c6b5a4f3e2d1c0b9";
DeviceFileEvents
| where Timestamp > ago(30d)
| where SHA256 == Hash
| project Timestamp, DeviceName, ActionType, FolderPath, InitiatingProcessFileName
```

### Alerts per device

```kql
AlertEvidence
| where Timestamp > ago(7d)
| where DeviceName =~ "ws-fin-042"
| distinct AlertId, Title, ServiceSource
```

### Processes launched by Office

```kql
DeviceProcessEvents
| where Timestamp > ago(7d)
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "powerpnt.exe")
| where FileName in~ ("cmd.exe", "powershell.exe", "wscript.exe", "mshta.exe", "rundll32.exe")
| summarize Times = count() by DeviceName, InitiatingProcessFileName, FileName
```

### Network from Azure Firewall logs

```kql
AzureFirewall
| where Action == "Deny"
| summarize Blocks = count(), Ports = dcount(DestinationPort) by SourceIp
| where Ports > 20      // many ports from one address = scanning
| sort by Ports desc
```

### From query to detection

A query from advanced hunting can be saved (**Save** > shared or personal query) or turned into a rule (**Create detection rule**). For a custom detection, the query must return the **`Timestamp`** and **`ReportId`** columns (or the equivalent for the table) and at least one entity identifier (e.g. `DeviceId`). Details are in the module on detections (objective 1.4).

## How to read a query on the exam

When you get an unfamiliar query, go through it line by line and, for each pipe, note **which columns exist** and **what one row represents**:

```kql
SecurityEvent                                  // row = one Windows event
| where EventID == 4625                         // row = one failed sign-in
| summarize C = count() by Account, bin(TimeGenerated, 1h)   // row = account × hour
| where C > 50                                  // only account-hours with >50 failures
| summarize Hours = count() by Account          // row = account; Hours = number of such hours
```

The question "what does the `Hours` column represent" has the answer: the number of hours in which the account had more than 50 failed sign-ins. This technique solves most KQL questions.

> **On the exam:** watch the order of `where` and `summarize`. `summarize count() by Account | where count_ > 10` filters **groups**; `where ... | summarize` filters **rows** before grouping. The default column name for `count()` without an alias is **`count_`**, and for `dcount(Account)` it is `dcount_Account`.

## Summary

- In SC-200, KQL is written in **Advanced hunting** (Defender portal), for XDR and Sentinel tables. Sentinel in the Azure portal is retired on **March 31, 2027**.
- Advanced hunting: **30 days** of XDR data, **100,000** rows, **64 MB**, **10 min** timeout, CPU quota in 15-minute cycles. Data lake–only data is not in advanced hunting.
- Tables: `Device*` (MDE), `Email*`/`UrlClickEvents` (MDO), `Identity*` (MDI), `CloudAppEvents` (MDCA), `AlertInfo`/`AlertEvidence`; Sentinel: `SecurityEvent`, `SigninLogs`, `AuditLogs`, `AzureActivity`, `CommonSecurityLog`, `Syslog`. XDR uses `Timestamp`, Sentinel uses `TimeGenerated`.
- Operators: `where`, `project` (only the listed ones), `extend` (add), `summarize` (group, only `by` + aggregations), `bin` (time steps), `top`, `sort`, `distinct`, `render` (last).
- `has` = whole term (fast, index), `contains` = substring (slow); `==` case-sensitive, `=~` insensitive; terms of ≤3 characters are not indexed.
- Filter on time first, filter on table columns, project before `join`, avoid regex and `search *`.
