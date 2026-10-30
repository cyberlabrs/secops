## Exam objectives: 3.1 (part two)

This module continues objective **3.1 Detect threats by using Microsoft Defender XDR**:

- **Identify threats by using Kusto Query Language (KQL)** – advanced operators for correlation and parsing,
- **Create Advanced Hunting queries** – queries that combine multiple sources and look for anomalies,
- **Create hunting graphs, including blast radius**,
- **Analyze relationships between entities by using Sentinel Graph**.

It is assumed that you know `where`, `project`, `extend`, `summarize`, `bin` and the string operators from the previous module.

## `let`: variables, lists and functions

`let` gives a name to a value or an expression. Every `let` statement ends with a semicolon. In the portal editor, don't leave a blank line between the `let` statements and the query: a blank line separates queries, so only the part under the cursor runs.

```kql
let Period = 7d;                                           // scalar (timespan)
let Threshold = 20;                                        // scalar (number)
let AdminAccounts = dynamic(["admin", "administrator", "root"]);   // list
let FailedIPs =                                            // tabular expression
    SecurityEvent
    | where TimeGenerated > ago(Period) and EventID == 4625
    | summarize Failed = count() by IpAddress
    | where Failed > Threshold
    | project IpAddress;
SecurityEvent
| where TimeGenerated > ago(Period) and EventID == 4624
| where IpAddress in (FailedIPs)                           // success from an IP that had many failures
| where Account has_any (AdminAccounts)
| project TimeGenerated, Account, Computer, IpAddress
```

A function with parameters:

```kql
let ProcessesOnDevice = (Device: string, Since: timespan) {
    DeviceProcessEvents
    | where Timestamp > ago(Since) and DeviceName =~ Device
};
ProcessesOnDevice("ws-fin-042", 2d)
| summarize count() by FileName
```

`materialize()` caches the result of a tabular `let` expression when it is used multiple times in the same query:

```kql
let Events = materialize(SecurityEvent | where TimeGenerated > ago(1d) | where EventID in (4624, 4625));
Events | where EventID == 4625 | count;
```

In Sentinel, a query can also be saved as a workspace **function** (Save > Save as function), and then called by name like a table. This is how **ASIM parsers** work (e.g. `_Im_Authentication`), as well as Defender advanced hunting functions such as `FileProfile()`, `DeviceFromIP()` and `AssignedIPAddresses()`.

```kql
DeviceFileEvents
| where Timestamp > ago(1d) and ActionType == "FileCreated"
| take 100
| invoke FileProfile(SHA256)                // enrichment: prevalence, signature, GlobalPrevalence
| where GlobalPrevalence < 50
```

> **On the exam:** recognize the `let` syntax. Common mistakes in the offered answers: a missing `;` at the end of `let`, a tabular `let` used as a scalar (`where IpAddress == FailedIPs` instead of `in (FailedIPs)`), or a list written as `("a","b")` instead of `dynamic(["a","b"])`.

## `join`: combining two tables

```kql
LeftTable
| join kind=<kind> (RightTable) on CommonColumn
```

If the columns have different names: `on $left.IpAddress == $right.SourceIp`.

### Join kinds

| `kind=` | Result | Use in hunting |
|---|---|---|
| `innerunique` (**default**) | The left side is **deduplicated by key**, then matched with all hits on the right | Fast, but loses left-table rows with the same key |
| `inner` | All matching left × right pairs | When you need every event (e.g. every email with an attachment) |
| `leftouter` | All left rows + matches on the right (empty if none) | Enrichment: keep everything, add info if it exists |
| `rightouter` | All right rows + matches on the left | Same, sides reversed |
| `fullouter` | All rows from both sides | Comparing two sets |
| `leftanti` | Left rows **without** a match on the right | "Devices without MDE", "accounts that have never signed in before" |
| `rightanti` | Right rows without a match on the left | |
| `leftsemi` | Left rows **with** a match on the right, left columns only | Filter: "only IP addresses that are also in the TI list" |
| `rightsemi` | Right rows with a match on the left | |

The `innerunique` trap: if three emails carry the same attachment (the same `SHA256`) and you join `EmailAttachmentInfo` with `DeviceFileEvents` without `kind=`, you will see only one email. That is why Microsoft recommends an explicit `kind=inner` for hunting.

### Joining within a time window

Without a time condition, `join` also pairs events that are days apart. A typical pattern: `join` on the entity, then filter on the time difference.

```kql
// Sign-in to a device within 30 minutes after receiving a malicious email
EmailEvents
| where Timestamp > ago(7d) and ThreatTypes has "Malware"
| project MailTime = Timestamp, Subject, SenderFromAddress,
          AccountName = tostring(split(RecipientEmailAddress, "@")[0])
| join kind=inner (
    DeviceLogonEvents
    | where Timestamp > ago(7d)
    | project LogonTime = Timestamp, AccountName, DeviceName
) on AccountName
| where (LogonTime - MailTime) between (0min .. 30min)
```

### Brute force followed by success (a classic)

```kql
let Failures = SecurityEvent
    | where TimeGenerated > ago(1d) and EventID == 4625
    | summarize Failed = count(), Last = max(TimeGenerated) by Account, IpAddress
    | where Failed > 20;
let Successes = SecurityEvent
    | where TimeGenerated > ago(1d) and EventID == 4624
    | project Success = TimeGenerated, Account, IpAddress, Computer;
Failures
| join kind=inner Successes on Account, IpAddress
| where Success > Last
| project Account, IpAddress, Computer, Failed, Last, Success
```

### `join` performance

- **Smaller table on the left** – the left side is matched against the right, fewer rows = faster.
- **Time filter on both sides**.
- **`project` before joining** – only the columns you need.
- `hint.shufflekey = Column` – for keys with a huge number of distinct values (e.g. `AccountObjectId`).
- `hint.strategy = broadcast` – the left side is small (up to 100,000 rows), the right side is huge.

### `lookup`

`lookup` is a specialized `join` for enriching a large table with a small "dimension" table (e.g. a list of servers and owners). The default is `kind=leftouter`, and the right side is optimized as small.

```kql
let Critical = datatable(Computer: string, Owner: string) [
    "dc01.contoso.com", "IT infrastructure",
    "sql-prod.contoso.com", "Databases"
];
SecurityEvent
| where TimeGenerated > ago(1d) and EventID == 4625
| lookup kind=inner Critical on Computer
```

`datatable` creates a small table directly in the query, useful for lists and for testing.

> **On the exam:** "You need to find devices from `DeviceInfo` that have had no events in `DeviceProcessEvents` in the last 7 days" – that is **`leftanti`** (`DeviceInfo` on the left). "Show all users and, if it exists, their department from `IdentityInfo`" – **`leftouter`**. "Show every email that carries the malicious hash, not just one" – **`inner`** instead of the default `innerunique`.

## `union`: multiple tables into one

`union` stacks the rows of multiple tables one below another (it does not combine columns like `join`). Columns with the same name and type are matched; the others stay empty where they don't exist.

```kql
union withsource=Source DeviceProcessEvents, DeviceNetworkEvents, DeviceFileEvents
| where Timestamp > ago(1d)
| where DeviceName =~ "ws-fin-042"
| summarize Events = count() by Source
```

- `withsource=Column` adds a column with the name of the source table,
- `union Device*` takes all tables whose name starts with `Device` (watch the performance),
- `union isfuzzy=true` doesn't fail if a table doesn't exist (important for rules that need to work across multiple workspaces),
- `search in (T1, T2) "text"` is a fast way to look for a value in several tables without writing a `union`.

| `join` | `union` |
|---|---|
| Combines columns (widens the row) | Stacks rows (lengthens the table) |
| Needs a common key | Doesn't need a key |
| "Which process made this connection?" | "All device activities in one list" |

## Parsing: `parse`, `extract`, `split`, `parse_json`

Logs often have important data in a single text field (a Syslog message, `AdditionalFields`, a command line).

### `parse` (recommended)

`parse` describes a text pattern with `*` for the part you skip and column names for the part you extract.

```kql
// Syslog message: "Failed password for invalid user admin from 203.0.113.7 port 51522 ssh2"
Syslog
| where ProcessName == "sshd" and SyslogMessage has "Failed password"
| parse SyslogMessage with * "for " * "user " User " from " SourceIP " port " Port:int " " *
| summarize Attempts = count() by SourceIP, User
```

Note: the pattern must match every row you want; rows that don't match get empty columns. `parse-where` instead of `parse` drops rows that don't match the pattern. `parse kind=regex` allows regex in the pattern.

### `extract` (regex)

```kql
DeviceProcessEvents
| where Timestamp > ago(1d) and FileName =~ "powershell.exe"
| extend Url = extract(@"(https?://[^\s'""]+)", 1, ProcessCommandLine)
| where isnotempty(Url)
```

`extract(regex, group, text)` returns the given group of the first match. Regex is expensive, so use it only after filtering and only when `parse` can't do the job.

### `split`, `parse_json`, `todynamic`

```kql
// split returns an array; [0] is the first element
| extend User = tostring(split(RecipientEmailAddress, "@")[0])

// JSON in a string -> dynamic, then access fields with a dot or ["name"]
DeviceEvents
| where Timestamp > ago(1d) and ActionType == "UsbDriveMount"
| extend Fields = parse_json(AdditionalFields)
| extend Letter = tostring(Fields.DriveLetter), Manufacturer = tostring(Fields.Manufacturer)
```

Always convert values from a `dynamic` column (`tostring()`, `toint()`) before comparing, grouping or `join`.

For specific formats there are ready-made functions: `parse_command_line()`, `parse_path()`, `parse_url()`, `parse_ipv4()`, `ipv4_is_private()`, `ipv4_is_in_range(IP, "10.0.0.0/8")`.

> **On the exam:** several ways of extracting an IP from text are offered. Microsoft's recommendation is **"parse, don't extract"**: `parse` or a format function (`parse_json`, `parse_command_line`) before `extract()` and `matches regex`, because regex consumes more CPU. Regex is the correct answer only when the format is not consistent.

## `mv-expand`: an array into rows

A column of type `dynamic` (an array) can be expanded so that each element becomes a separate row.

```kql
// AlertInfo has AttackTechniques as a JSON array; how many alerts per MITRE technique?
AlertInfo
| where Timestamp > ago(30d)
| extend Techniques = parse_json(AttackTechniques)
| mv-expand Technique = Techniques to typeof(string)
| summarize Alerts = count() by Technique
| top 10 by Alerts
```

The reverse direction (rows into an array) is `make_set()` and `make_list()` in `summarize`. `mv-apply` applies a subquery to each array separately (e.g. "take the first 3 elements of each array").

## `arg_max` and `arg_min`: the latest state of an entity

`arg_max(Column, *)` returns the **whole row** with the largest value of the column, per group. Classic use: the last known record about a device or an account.

```kql
// Latest state of each device
DeviceInfo
| where Timestamp > ago(7d)
| summarize arg_max(Timestamp, *) by DeviceId
| project DeviceName, OSPlatform, OSVersion, PublicIP, Timestamp
```

```kql
// First sign-in of each account from a new IP address
SigninLogs
| where TimeGenerated > ago(14d)
| summarize arg_min(TimeGenerated, AppDisplayName, Location) by UserPrincipalName, IPAddress
```

| Expression | Returns |
|---|---|
| `max(TimeGenerated)` | only the value (the latest time) |
| `arg_max(TimeGenerated, *)` | the whole row with that time |
| `arg_max(TimeGenerated, A, B)` | the time + columns A and B from that row |
| `take_any(*)` | an arbitrary row (no guarantee which) |

> **On the exam:** "For each device, you need to show only the newest record from `DeviceInfo` with all columns" – `summarize arg_max(Timestamp, *) by DeviceId`. Distractors: `top 1 by Timestamp` (one row for **all** devices), `summarize max(Timestamp) by DeviceId` (loses the other columns), `distinct DeviceId` (no columns).

## Time series and anomalies

`summarize ... by bin()` returns no rows for intervals without data. `make-series` creates a **continuous series** (an array of values) with a given default value for gaps, which is a prerequisite for series analysis.

```kql
make-series Aggregation = count() default=0 on TimeColumn from Start to End step Step by Key
```

The result has one row per key, and `Aggregation` and `TimeColumn` are **arrays** of the same length.

### `series_decompose_anomalies`

The function decomposes the series into seasonality, trend and residual, and flags points that deviate significantly. It returns three arrays: the anomaly flag (`+1` spike, `-1` dip, `0` normal), the score and the expected value (baseline). The second argument is the threshold (default **1.5**; a higher threshold = fewer anomalies).

```kql
// Days with an unusual number of failed sign-ins per computer
let Start = startofday(ago(30d));
let End = startofday(now());
SecurityEvent
| where TimeGenerated between (Start .. End) and EventID == 4625
| make-series Failed = count() default=0 on TimeGenerated from Start to End step 1d by Computer
| extend (Anomalies, Score, Expected) = series_decompose_anomalies(Failed, 2.5)
| mv-expand TimeGenerated to typeof(datetime), Failed to typeof(long),
            Anomalies to typeof(int), Expected to typeof(double)
| where Anomalies == 1                         // spikes only
| project Computer, TimeGenerated, Failed, Expected
```

For visualization without `mv-expand`:

```kql
StormEvents
| make-series Events = count() default=0 on StartTime
    from datetime(2007-01-01) to datetime(2008-01-01) step 1d
| extend Anomalies = series_decompose_anomalies(Events)
| render anomalychart with (anomalycolumns=Anomalies)
```

Related functions: `series_decompose_forecast()` (forecasting), `series_fit_line()` (linear trend), `series_stats()` (min, max, average of a series).

| Approach | When |
|---|---|
| Fixed threshold (`where count_ > 100`) | Simple, but the same threshold for a small and a large server |
| Per-entity statistics (`avg`, `stdev`, then comparison) | Better, but manual |
| `make-series` + `series_decompose_anomalies` | Calculates the baseline per entity on its own, takes the weekly rhythm into account |
| Sentinel **anomalies** (UEBA, ML rules) | Ready-made anomalies without writing queries (objective 1.4) |

> **On the exam:** recognize the chain `make-series ... default=0 ... step` → `series_decompose_anomalies()` → `mv-expand` → `where Anomalies != 0`. If the query uses `summarize ... by bin()` before `series_decompose_anomalies`, that is a mistake: the function needs an **array** (dynamic), not a scalar column.

## Hunting graph and blast radius

Tabular queries have a hard time showing **paths**: "from this compromised account, which critical resources can the attacker reach?". For that, Defender uses graphs powered by **Microsoft Sentinel graph**.

### Hunting graph (advanced hunting)

- Path: **Investigation & response** > **Hunting** > **Advanced hunting**, the hunting graph icon or **Create new** > **Hunting graph**. A **New graph** tab opens.
- The graph has **nodes** (device, user, IP, storage account, key vault…) and **edges** (relationships such as "has permissions to", "can authenticate as", "member of", "frequently logged in by", "has credentials of").
- **Search with Predefined scenarios**: you choose a scenario, enter the inputs, add filters, then **Run scenario**.

Examples of predefined scenarios:

| Scenario | Question |
|---|---|
| **Attack paths to critical asset** | Which paths lead to a critical resource (lateral movement)? |
| **Entity relationship map** | All direct relationships of the selected entity (inbound and outbound) |
| **Paths between two entities** | Is there a path from entity A to entity B? |
| **Access to key vaults** | Who directly or indirectly has access to a key vault? |
| **Users with access to sensitive data** | Which users can reach storage with sensitive data? |
| **Potential data exfiltration by device** | Which storage accounts can a device reach? |
| **Paths to domain admins**, **Paths to domain compromise (DCSync)** | Paths from an unprivileged user to domain takeover |
| **Kerberoast paths to critical assets** | Kerberoast-vulnerable accounts on the path to critical resources |

Filters: source node (**Is critical**, **Is vulnerable**, **Is exposed to the internet**), target node (**Has sensitive data**…), edge type, edge direction, and **Show only the shortest paths**.

Prerequisites: a Defender role for advanced hunting, onboarding to the **Microsoft Sentinel data lake** (the graph is provisioned automatically for a tenant with a data lake) and at least **read** access in **Microsoft Security Exposure Management**. Availability conditions change, so check them in the documentation before rollout.

### Blast radius in the incident graph

In an incident (**Incidents** > incident > attack story graph), you select a node and **View blast radius**. The **eight top-ranked paths** from the compromised entity to predefined critical targets are shown; **View full blast radius list** gives all reachable targets. Important:

- blast radius **extends and replaces** the earlier attack path analysis in the incident,
- it combines the **pre-breach** (exposure, permissions) and **post-breach** (what is compromised) views,
- the paths are **possible**, not confirmed; they are limited by the number of hops (5 cloud, 5 on-prem, 3 hybrid),
- the value depends on how many **critical assets** are classified in Exposure Management,
- a user sees only the nodes within their RBAC scope.

### Microsoft Sentinel graph

**Sentinel graph** is shared graph analytics over data from the data lake (resources, identities, activities, threat intelligence). It is not used directly with KQL but through the experiences built on it:

| Experience | Where |
|---|---|
| Incident graph with **blast radius** | Defender XDR incidents |
| **Hunting graph** | Advanced hunting |
| Attack paths | Exposure Management, Defender for Cloud |
| Data risk graph | Purview Insider Risk Management, Data Security Investigations |
| **Custom graphs** (preview) | Built in a Jupyter notebook (Sentinel extension for VS Code), published as a graph job, queried with the **GQL** language on the **Graphs** page in the Defender portal |

For the exam, the concept matters: a table answers "what happened", a graph answers "what is **connected** and where the attacker **can** go next".

> **On the exam:** "An analyst is investigating an incident with a compromised account and needs to quickly see which critical resources the attacker can reach from that account" – in the incident graph, select the entity and **View blast radius**. "Proactively, without an incident, find who has a path to a specific key vault" – **hunting graph** with the **Access to key vaults** scenario. Writing a `join` query over `IdentityInfo` is possible, but it is not the answer with the least effort.

## Combined example: from suspicion to a list

```kql
// 1) IP addresses doing password spray
let SprayIP = SecurityEvent
    | where TimeGenerated > ago(1d) and EventID == 4625
    | summarize Accounts = dcount(Account) by IpAddress
    | where Accounts > 15
    | project IpAddress;
// 2) Successful sign-ins from those addresses, the latest per account
SecurityEvent
| where TimeGenerated > ago(1d) and EventID == 4624
| where IpAddress in (SprayIP)
| summarize arg_max(TimeGenerated, Computer, LogonType) by Account, IpAddress
// 3) Enrichment: is the account privileged (list from a watchlist)
| join kind=leftouter (_GetWatchlist('PrivilegedAccounts') | project Account = SearchKey, Role) on Account
| extend Priority = iff(isnotempty(Role), "High", "Medium")
```

`_GetWatchlist('name')` reads a Sentinel **watchlist**; the `SearchKey` column is the key you chose when creating the list.

## Summary

- `let` for scalars, lists (`dynamic([...])`), tabular expressions and functions; ends with `;`. `materialize()` caches an expression that is used multiple times.
- `join`: the default is **`innerunique`** (deduplicates the left side); `inner` for all pairs, `leftouter` for enrichment, `leftanti` for "no match", `leftsemi` as a filter. Smaller table on the left, time on both sides, `project` before. `lookup` for a small dimension table.
- `union` stacks the rows of multiple tables; `withsource`, `isfuzzy=true`, wildcard `Device*`.
- Parsing: `parse` / `parse-where` and format functions before `extract()` and regex; `parse_json` + `tostring()`.
- `mv-expand` expands an array into rows; `make_set`/`make_list` do the reverse.
- `arg_max(Timestamp, *) by Entity` = the latest state of an entity.
- `make-series ... default=0` → `series_decompose_anomalies(series, threshold)` → `mv-expand` → filter `Anomalies != 0`; `render anomalychart`.
- **Hunting graph** (advanced hunting, predefined scenarios, filters) and **blast radius** (incident graph, top 8 paths) use **Sentinel graph**; the prerequisites are the Sentinel data lake and Exposure Management read. Custom graphs are queried with GQL.
