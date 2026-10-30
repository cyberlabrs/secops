## Exam objectives: 3.2

Domain 3 (**Perform threat hunting**) accounts for 20–25% of the exam. The first objective (3.1) is hunting in Defender XDR (advanced hunting, graphs). This module covers the second objective, **3.2 Detect threats by using the Microsoft Sentinel platform**, with four items:

- **Create and monitor hunting queries** – hunting queries, bookmarks and hunts in Sentinel,
- **Create and manage KQL jobs in Data lake** – one-time and scheduled KQL jobs over the data lake tier,
- **Create and manage Summary rule tables for querying** – summary rules that condense high-volume logs into a small Analytics table,
- **Hunt for threats by using Notebooks, including connection to the Sentinel MCP Server** – Jupyter notebooks (Spark over the data lake) and the Sentinel MCP server for AI agents.

The exam likes "which feature" questions here: you get a scenario (the data is in the data lake and needs to be searched rarely; it needs to be compared with an analytics rule every hour; Python and machine learning are needed) and you choose between a hunting query, a KQL job, a summary rule, a notebook or a search job. That is why the most important thing is to know **what each feature is for and where its limit is**.

Reminder from module 03: Sentinel in the Azure portal is supported **until 31 March 2027**, after which only the **Microsoft Defender portal** is used. All paths in this module are from the Defender portal.

## The threat hunting process

Hunting is proactive: you don't wait for an alert, you set a **hypothesis** ("an attacker is using password spray against our servers") and verify it in the data. A typical flow:

1. **Hypothesis** – from a threat intelligence report, the MITRE ATT&CK matrix, hunting query results or an incident.
2. **Search** – hunting queries, advanced hunting, data lake exploration, notebook.
3. **Recording findings** – bookmarks, comments in the hunt.
4. **Action** – an incident from a bookmark, a new analytics rule, a new threat indicator.
5. **Improvement** – what was manual becomes a detection or a scheduled job (KQL job, summary rule).

| Tool | Where | When you use it |
|---|---|---|
| **Hunting queries** | **Microsoft Sentinel** > **Threat management** > **Hunting** | Built-in and your own queries over the analytics tier, overview by MITRE tactics |
| **Advanced hunting** | **Investigation & response** > **Hunting** > **Advanced hunting** | Ad hoc KQL over Defender XDR and Sentinel tables (module 01/02) |
| **Data lake exploration – KQL queries** | **Microsoft Sentinel** > **Data lake exploration** > **KQL queries** | Interactive KQL over data in the data lake tier |
| **KQL jobs** | **Microsoft Sentinel** > **Data lake exploration** > **Jobs** | A one-time or scheduled query that writes its result to a table |
| **Summary rules** | **Microsoft Sentinel** > **Configuration** > **Summary rules** | Periodic summarization of high-volume logs into an Analytics `_CL` table |
| **Notebooks** | VS Code + **Microsoft Sentinel** extension | Python/PySpark, ML, visualizations over the data lake |
| **Sentinel MCP server** | VS Code, Security Copilot, Copilot Studio, Microsoft Foundry | Searching data in natural language through an AI agent |

## Hunting queries

### Queries tab

Path: **Microsoft Sentinel** > **Threat management** > **Hunting**, tab **Queries**.

This tab contains:

- **out-of-the-box** hunting queries installed from **Content hub** solutions (e.g. the Windows Security Events solution brings its own hunting queries),
- **custom** queries that you created yourself or cloned and modified.

Each query has a description, required data sources, MITRE ATT&CK **tactics** (icons at the top, e.g. Initial access, Persistence, Exfiltration) and **techniques** (the **Techniques** column).

| Action / column | What it does |
|---|---|
| **Run all queries** / **Run selected queries** | Runs all or the selected queries; the **Results** column shows the number of hits |
| **Results** filter *N/A* | Queries that are not active because a data source is missing; the info icon says which connector is needed |
| **Results delta** / **Results delta percentage** | Compares the results of the last 24 h with the previous 24–48 h – reveals spikes |
| **MITRE ATT&CK tactic bar** | Number of queries per tactic, changes according to the active filters |
| **Favorites** | Favorite queries **run automatically** every time the Hunting page is opened |
| **Run Query** in the query details | Runs a single query; **View Results** opens the results in the query editor |
| **New alert rule** > **Create Microsoft Sentinel alert** | Creates a scheduled analytics rule from the query through the **Analytics rule wizard** |

> **On the exam:** "You need to find hunting queries whose number of results rose sharply compared to the previous day." The answer is sorting/filtering by **Results delta** (or **Results delta percentage**). "Queries that return nothing because there is no data" are those with **N/A** in the Results column. "The query should run on its own when you open the Hunting page" – add it to **favorites**.

### Creating a custom hunting query

1. **Hunting** > **Queries** > **New query** (or a clone of an existing one: **Clone query**).
2. Enter the name, description and KQL query.
3. **Entity mapping** – map columns to entities (Account, Host, IP, File, URL…), as with analytics rules.
4. **Tactics and techniques** – MITRE mapping.
5. **Create**.

An example hunting query: password spray on Windows servers (many different accounts from the same IP address, mostly unsuccessful).

```kql
// Password spray: one IP address, many different accounts, failed sign-ins
let lookback = 1d;
SecurityEvent
| where TimeGenerated > ago(lookback)
| where EventID == 4625
| where isnotempty(IpAddress) and IpAddress != "-"
| summarize FailedCount = count(),
            DistinctAccounts = dcount(Account),
            Accounts = make_set(Account, 20),
            FirstSeen = min(TimeGenerated),
            LastSeen = max(TimeGenerated)
    by IpAddress, Computer
| where DistinctAccounts >= 10
| extend IPCustomEntity = IpAddress, HostCustomEntity = Computer
| order by DistinctAccounts desc
```

Columns like `IPCustomEntity` are the old style; in new queries you map entities in the **Entity mapping** section, but you will still come across such names in the Azure-Sentinel GitHub repository.

A second example, over a Defender for Endpoint table: encoded PowerShell launched from an Office application.

```kql
DeviceProcessEvents
| where TimeGenerated > ago(7d)
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where InitiatingProcessFileName in~ ("winword.exe", "excel.exe", "outlook.exe")
| where ProcessCommandLine has_any ("-enc", "-encodedcommand", "frombase64string")
| project TimeGenerated, DeviceName, AccountName, InitiatingProcessFileName, ProcessCommandLine
```

### When a hunting query becomes a detection

A hunting query doesn't run on its own (except favorites when the page is opened) and doesn't create alerts. If a query consistently produces valuable results, turn it into a **scheduled analytics rule** (Sentinel) or a **custom detection rule** (advanced hunting). From the Hunting page: open the results > **New alert rule** > **Create Microsoft Sentinel alert**.

### Livestream no longer exists

Sentinel used to have **livestream** (a query that runs continuously and reports new hits). **Livestream is no longer available.** For the same scenarios Microsoft recommends **KQL jobs**, **analytics rules** or **playbooks**. If you see livestream as an option in a question, it is a distractor in the current version of the exam.

## Bookmarks

During hunting you come across a row that is suspicious. A **bookmark** saves it together with the query that returned it.

1. In the query results, select rows and choose **Add bookmark**. One bookmark is created for each selected row.
2. Add **tags** and **notes**. Tags are used for grouping (e.g. a campaign tag).
3. **Entity mapping** and **MITRE ATT&CK** mapping – by default they are taken from the hunting query, and they can be extended.
4. All bookmarks are on the **Bookmarks** tab of the Hunting page.
5. **Investigate** opens the entity graph and timeline for the bookmark.
6. Select one or more bookmarks > **Incident actions** > **Create new incident** or **Add to existing incident**.

Bookmarks are written to the **`HuntingBookmark`** table in the workspace, so you can search them and join them with other data:

```kql
HuntingBookmark
| where TimeGenerated > ago(14d)
| where Tags has "password-spray"
| project TimeGenerated, BookmarkName, CreatedBy, Notes, QueryText
```

An important limitation: **bookmarks don't exist on the Advanced hunting** page. They are available only through **Microsoft Sentinel** > **Threat management** > **Hunting**. In advanced hunting, to preserve context you link results to an incident (**Link to incident**), use saved queries or incident tags.

> **On the exam:** "An analyst found a suspicious sign-in in a hunting query result and wants to save it as evidence and later create an incident from it." Answer: **Add bookmark**, then **Incident actions** > **Create new incident**. If the question asks for bookmarks to be analyzed with KQL, the table is **`HuntingBookmark`**. If the scenario says "I'm working on the Advanced hunting page and want a bookmark" – that isn't possible; you need the Sentinel Hunting page or **Link to incident**.

## Hunts (preview)

**Hunts** are hunting "projects" in Sentinel: they bring together the hypothesis, queries, bookmarks, comments and outcome.

| Phase | In the portal |
|---|---|
| Define a hypothesis | Inspiration from the MITRE map, hunting query results, Content hub solutions |
| Investigate | On the **Queries** tab select queries > **New hunt**; run them and **bookmark results directly into the hunt** |
| Act | UEBA entity pages, a playbook on a bookmarked entity, new analytics rules, threat indicators, incidents |
| Track the outcome | Hypothesis status (validated / not), comments; the hunt automatically links the resulting rules and incidents; hunting program metrics |

Microsoft recommends that you first try a summary rule query on the **Hunts** page itself.

## Where the data is: analytics tier and data lake tier

For hunting over long periods it matters where the data is (in detail in module 03):

| Tier | For what | Query |
|---|---|---|
| **Analytics** | Detections, hunting queries, advanced hunting, workbooks | Full KQL, fast, more expensive storage |
| **Data lake** | Long-term, cheap retention of high-volume logs (up to 12 years) | Data lake exploration, KQL jobs, notebooks; slower, you pay per query (data scan) |

Data that is **only in the data lake tier** is not visible in advanced hunting or to analytics rules. For a hunting query or detection to use it, you must **move it to the analytics tier**: with a KQL job (full or filtered data) or a summary rule (summarized data).

The older tools for the archive in a Log Analytics workspace are the **search job** (result in a new table with the **`_SRCH`** suffix) and **restore** (temporarily bringing archived data back into a table with the **`_RST`** suffix). In the Defender portal with the data lake, think of KQL jobs first for such scenarios.

## Data lake exploration: KQL queries

Path: **Microsoft Sentinel** > **Data lake exploration** > **KQL queries**.

- You choose one or more **source workspaces**. With multiple workspaces, tables with the same name and schema are automatically combined (`union`); you select a specific workspace with `workspace("WorkspaceName").Table`.
- Besides data lake tables, you can also query **federated tables** (e.g. Microsoft Entra ID, Microsoft 365, Microsoft Resource Graph) without ingesting into the workspace.
- From the editor you can start **Create job** directly if the query needs to be repeated or the result saved.

## KQL jobs in the data lake

A **KQL job** is a **one-time or scheduled** KQL query over the data lake (and federated tables) whose result is **written to a table**. Typical uses:

- a long one-time query for an incident investigation (e.g. 18 months of firewall logs for one IP address),
- aggregation and enrichment of low-fidelity logs,
- retroactive comparison with threat intelligence (TI matching),
- anomaly scanning across multiple tables (`join`, `union`).

### Destination table

| Destination | New table suffix | Note |
|---|---|---|
| Analytics tier (Sentinel workspace) | **`_KQL_CL`** | The result is available in advanced hunting, analytics rules and workbooks |
| Data lake tier (**System tables** workspace) | **`_KQL`** | Writing to system tables is in preview; speeds up later investigations |
| Existing table (append) | – | The result schema must match the table schema, otherwise the job fails |

Federated tables cannot be a destination. Storage in the analytics tier is more expensive, so in the query `project` only the needed columns and filter before writing.

### Creating a job

1. **Microsoft Sentinel** > **Data lake exploration** > **Jobs** > **Create job** (or **Create job** from the KQL editor, or **Create from template**).
2. **Job name** – unique in the tenant, up to 256 characters, **without `#` and `-`**.
3. **Job description**.
4. **Select workspace** – the destination workspace (Sentinel workspace or **System tables**), then a new table or **Add to an existing table**.
5. **Prepare the query** – the query and **Selected workspaces** (source workspaces). If the query has no time range, check the time picker.
6. **Schedule the query job** – **One time** (runs immediately after creation) or **Scheduled job**: **Repeat frequency** (By minute, Hourly, Daily, Weekly, Monthly), **Repeat every**, **From** (at the earliest **30 minutes** after creation) and **To** or **Set job to run indefinitely**.
7. **Submit**.

Editing a one-time job **runs it again immediately**.

### Permissions

- A Microsoft Entra ID role that grants access to the data lake (reading all workspaces, writing to the analytics tier, scheduling jobs).
- For **new custom tables in the analytics tier**: the data lake **managed identity** (system-assigned, named `msg-resources-<guid>`) must have **Log Analytics Contributor** on the destination Log Analytics workspace (**Access control (IAM)** > **Add role assignment**).

> **On the exam:** "A KQL job was created, but it fails when trying to create a new table in the analytics tier." Check whether the data lake managed identity (`msg-resources-<guid>`) has the **Log Analytics Contributor** role on the workspace. For the question "what is the table created by the job called" – the suffix is **`_KQL_CL`** (analytics) or **`_KQL`** (system tables in the data lake); a summary rule creates **`_CL`**, the notebook example uses **`_SPRK`**.

### KQL job limits

| Parameter | Value |
|---|---|
| Concurrent execution per tenant | **5** (excess jobs are rejected, not queued) |
| Query timeout | **1 hour** (partial results possible) |
| Enabled jobs per tenant | **100** |
| Output tables per job | **1** |
| Query time range | up to **12 years** |
| Unsupported in the query | `adx()`, `arg()`, `externaldata()`, `ingestion_time()`, user-defined functions |
| Columns that are overwritten | `TenantId`, `Type`, `_ResourceId`, `_BilledSize`… and `TimeGenerated` if older than 2 days |

Because of the last row: if the original event time matters, write it to a **separate column** (e.g. `EventTime = TimeGenerated`).

Jobs that read from a deleted source workspace automatically go into the **Disabled** state.

### Data lake latency

New data in the data lake becomes available with a delay of up to **15 minutes**. A scheduled job with a short lookback therefore shifts the window back:

```kql
let lookback = 1h;
let delay = 15m;
let endTime = now() - delay;
let startTime = endTime - lookback;
AzureFirewall
| where TimeGenerated between (startTime .. endTime)
| where Action == "Deny"
| summarize DeniedCount = count(),
            Ports = make_set(DestinationPort, 50),
            EventTime = min(TimeGenerated)
    by SourceIp, DestinationIp, Protocol
| where DeniedCount > 100
```

You know the same pattern (a `now() - delay` window) from analytics rules with ingestion delay. Overlapping the lookback and the frequency (e.g. lookback 70 min, job every 60) reduces the risk of missing late events.

### Templates

**Create from template** offers ready-made jobs (Hunting, Baseline, Anomaly detection), e.g. **Network log IOC matching** (every hour, TI comparison against `CommonSecurityLog`), **Daily process execution trend**, **New processes observed in last 24 hours**, **Windows suspicious login outside normal hours**. The template fills in the query and schedule; you choose the destination workspace.

## Summary rules

A **summary rule** periodically runs an aggregation KQL query over a high-volume table and writes the result to a **custom table with the Analytics plan** (`<name>_CL`). The idea: raw logs stay in a cheap tier (data lake / Auxiliary / Basic), and only the summary goes to Analytics, which is small, fast and cheap for queries and detections.

Benefits:

- **analysis and reporting** over long periods,
- **savings** on verbose logs (firewall, proxy, DNS, flow),
- **privacy**: a summary without sensitive columns, with access to the raw data restricted.

### Creating

Prerequisites: a Sentinel workspace with data, the **Microsoft Sentinel Contributor** role, the workspace onboarded to the Defender portal.

1. **Microsoft Sentinel** > **Configuration** > **Summary rules** > **+ Create**.
2. **Name**, **Description**, **Destination table**: **Existing custom log table** or **New custom log table** (the name gets `_CL`).
3. Recommended: enable **SummaryLogs** diagnostics on the workspace (run history and errors; charged additionally).
4. **Set summary logic** – the query; **Preview results**.
5. **Query scheduling** – how often (= **bin size**), an optional **delay** in minutes, start.
6. **Review + create** > **Save**.

In the rule list: viewing data in Logs, **run history**, enable/disable, edit. **Deleting a summary rule is irreversible.** Ready-made templates are in the **Content hub** (filter **Content type: Summary rules**), then on the **Templates** tab of the Summary rules page > **Create**.

Example: daily summarization of firewall traffic by source and destination.

```kql
// Summary rule query - NO time filter, the range is determined by the bin size
AzureFirewall
| summarize Connections = count(),
            DeniedConnections = countif(Action == "Deny"),
            Ports = make_set(DestinationPort, 100),
            FirstSeen = min(TimeGenerated),
            LastSeen = max(TimeGenerated)
    by SourceIp, DestinationIp, Protocol
```

The hunting query then runs over the small table, not over terabytes of raw logs:

```kql
FirewallDaily_CL
| where TimeGenerated > ago(90d)
| where DestinationIp == "203.0.113.50"
| summarize TotalConnections = sum(Connections), Sources = make_set(SourceIp)
    by bin(_BinStartTime, 1d)
```

### Rules and limits

| Item | Value |
|---|---|
| **Bin size** | 20, 30, 60, 120, 180, 360, 720 or 1440 minutes |
| Destination table | Custom `_CL`, **Analytics** plan |
| Columns that are added | **`_RuleName`**, **`_RuleLastModifiedTime`**, **`_BinSize`**, **`_BinStartTime`** |
| Active rules per workspace | **100** |
| History | Only recent data is processed (up to 24 h back), no backfill of old data |
| Time filter in the query | **Don't add one** – it is combined with the bin and gives only the intersection |
| Source with the Analytics plan | All operators except `workspaces()`, `app()`, `resource()`, `ADX()`, `ARG()` and the `bag_unpack`, `narrow`, `pivot` plugins |
| Source with the Basic plan | One table + `lookup` to up to **5** Analytics tables |
| Other unsupported | User-defined functions, `union *`, `isfuzzy=true`, a workspace transformation on the destination table |
| Default delay | 3.5 min up to 10% of the bin size (for late data); `binDelay` can be configured |
| Retry | 10 attempts in 8 hours for a failed bin; after that a manual retry |
| Cost | The rule is free; you pay for the query (data scan for Basic/Auxiliary) and ingestion of the results into Analytics |

> **On the exam:** "Firewall logs (1 TB per day) are in a cheap tier. You need an analytics rule that compares traffic with a TI list every hour, at the LOWEST cost." The answer is a **summary rule** that summarizes the logs every hour (bin 60) into a `_CL` table, and an analytics rule over that table. Distractors: moving the whole table to Analytics (expensive), a search job (one-time, not scheduled). A KQL trap: a summary rule query with `where TimeGenerated > ago(1h)` – a time filter is not added.

### KQL job or summary rule?

| | **KQL job** | **Summary rule** |
|---|---|---|
| Where it is created | **Data lake exploration** > **Jobs** | **Configuration** > **Summary rules** |
| Source | Data lake tier, federated tables, multiple workspaces | Tables in the workspace (Analytics, Basic, Auxiliary) |
| Schedule | One time or By minute/Hourly/Daily/Weekly/Monthly | Fixed bin: 20 min to 24 h |
| Historical data | Yes, up to 12 years back | No, only recent data |
| Destination | Analytics (`_KQL_CL`), data lake (`_KQL`), existing table | Analytics `_CL` |
| Timeout | 1 h | According to the workspace query API limits |
| Typical use | Incident investigation over old data, retro TI matching, baseline | Continuous summarization of a high-volume source for detections and reports |

## Notebooks

When hunting becomes too big for one query (multiple steps, Python, ML, visualizations, external data), a **Jupyter notebook** is used.

### Classic Sentinel notebooks

The classic approach: **Notebooks** in Sentinel, execution in an **Azure Machine Learning** workspace, the **MSTICPy** library (Microsoft Threat Intelligence Center). MSTICPy queries Log Analytics, enriches data (TI, geolocation), decodes base64, creates timeline and process tree visualizations, and detects anomalies in sessions. These notebooks read the **analytics tier** through the Log Analytics API.

### Notebooks over the Sentinel data lake (VS Code)

The new approach for the data lake:

1. Onboarding to the **Microsoft Sentinel data lake**.
2. In VS Code install the **Microsoft Sentinel** extension (Extensions Marketplace, "Sentinel") and optionally **GitHub Copilot**.
3. Sign in through the Sentinel icon; on the left you see **Lake tables** (and **Federated tables** under **System tables**) and **Jobs**.
4. A new Jupyter notebook, kernel **Microsoft Sentinel**, choose a **runtime pool** (Small, Medium, Large). The Spark session takes a few minutes to start.

Data access goes through the **`MicrosoftSentinelProvider`** class from the `sentinel_lake.providers` module:

```python
from sentinel_lake.providers import MicrosoftSentinelProvider
data_provider = MicrosoftSentinelProvider(spark)

# Read a table from the data lake into a Spark DataFrame
df = data_provider.read_table("SecurityEvent")

# Failed sign-ins grouped by IP address
failed = (df.filter(df.EventID == 4625)
            .groupBy("IpAddress")
            .count()
            .orderBy("count", ascending=False))
failed.show(20)

# Write the result to a new table
data_provider.save_as_table(failed, "FailedLogonsByIp_SPRK", write_options={"mode": "overwrite"})
```

| Runtime pool | For what |
|---|---|
| **Small** | Development, testing, light analysis; cheapest |
| **Medium** | ETL with joins/aggregations, training ML models |
| **Large** | Deep learning, large joins and shuffles, time-critical jobs |

| Limit | Value |
|---|---|
| Language | Python (PySpark) |
| Libraries | Only Azure Synapse libraries 3.4 + Sentinel Provider; **no pip install** |
| Interactive query | 2 hours |
| Interactive session inactivity | 20 minutes (session timeout configurable, default 30 min) |
| Notebook job | 8 hours; at most **3** concurrent, the rest queued |
| Display in VS Code | 100,000 rows |
| Analytics custom tables | Not deleted from the notebook, but in Log Analytics |

To write to new analytics tier tables, the data lake managed identity needs **Log Analytics Contributor**, the same as for KQL jobs.

**Notebook jobs**: a notebook can be scheduled from the Sentinel extension (one time or periodically) to process data and write to the data lake or analytics tier – similar to a KQL job, but with Python.

> **On the exam:** "An analyst needs to train an anomaly detection model over 12 months of data from the data lake and write the result to a table." That is a **notebook** (PySpark through `MicrosoftSentinelProvider`, `save_as_table`), not a summary rule (no history, no ML) or a hunting query. If only a scheduled KQL aggregation is needed, the simpler answer is a **KQL job**.

## Sentinel MCP server

**Model Context Protocol (MCP)** is an open protocol through which an AI client (e.g. GitHub Copilot in VS Code) calls tools on a server. The **Microsoft Sentinel MCP server** is hosted by Microsoft (no infrastructure), authentication is through **Microsoft Entra**, and the tools are grouped into **collections**:

| Collection | Purpose |
|---|---|
| **Data exploration** | Table search, KQL over the data lake, entity analysis, graph tools |
| **Triage** | Incident triage and hunting through the Defender API (uses your existing permissions) |
| **Agent creation** | Creating Security Copilot agents from a natural-language description |

The data exploration collection is at `https://sentinel.microsoft.com/mcp/data-exploration`.

| Tool | What it does |
|---|---|
| `search_tables` | Semantic search of the table catalog; returns relevant tables and schemas |
| `query_lake` | Runs a single KQL query against a data lake workspace |
| `list_sentinel_workspaces` | Lists data lake workspaces (name and ID); run first |
| `analyze_user_entity`, `analyze_url_entity` | AI analysis of a user or URL with a verdict; returns an analysis ID |
| `get_entity_analysis` | Retrieves the entity analysis result (by ID) |
| Graph tools (preview), e.g. `find_blastradius`, `find_walkable_paths` | Reasoning over Sentinel graphs (blast radius, paths) |

Prerequisites and permissions:

- onboarding to the **Sentinel data lake** (for most tools),
- at least **Security Reader** (or Security Operator / Security Administrator) to list and call tools,
- the entity analyzer consumes **Security Compute Units (SCU)** and requires the **Security Copilot Contributor** role,
- `analyze_user_entity` works with a window of at most 7 days and requires tables such as `SigninLogs`, `AlertEvidence`, `CloudAppEvents`, `IdentityInfo` in the data lake.

Supported clients: **Visual Studio Code** (GitHub Copilot), **Microsoft Security Copilot**, **Microsoft Copilot Studio**, **Microsoft Foundry**.

### Notebook and MCP together

In VS Code you have both tools in the same place: the Sentinel extension for notebooks and the Sentinel MCP server added as an MCP server (HTTP) for GitHub Copilot in agent mode. A typical hunting flow:

1. Prompt to the agent: "Find the tables with failed sign-ins and write a password spray query for the last 7 days." The agent calls `list_sentinel_workspaces`, `search_tables`, then `query_lake` (and fixes the KQL itself if the query fails).
2. When the query returns interesting IP addresses and accounts, you move the logic into a notebook (PySpark over a longer period, visualization).
3. For suspicious accounts you call `analyze_user_entity` and then `get_entity_analysis`.
4. You write the result to a table (`save_as_table`) or create a KQL job / analytics rule.

This is defensive work over your own data: the agent only reads the data lake within your permissions.

> **On the exam:** "The SOC wants analysts in VS Code to search Sentinel data lake tables with natural-language questions, without knowing the schema." Answer: add the **Sentinel MCP server** (data exploration collection) to VS Code and use GitHub Copilot; the minimum role is **Security Reader**. If **entity analysis with a verdict** is also required, **Security Copilot Contributor** and SCUs are needed. Distractor: "install MSTICPy in Azure ML" (those are classic notebooks, not MCP).

## How to choose on the exam

| Requirement in the question | Feature |
|---|---|
| Built-in queries by MITRE tactics, overview of spikes | **Hunting queries** (Results delta) |
| Save a suspicious row and create an incident | **Bookmark** > **Incident actions** |
| Hypothesis, queries, notes and outcome in one place | **Hunts** (preview) |
| A one-time query over a year of data in the data lake, result for further analysis | **KQL job** (one time) |
| Process data from the data lake every hour and use the result in a detection | **KQL job** (scheduled) or a **summary rule** if the source is in the workspace and summarization is enough |
| Continuous summarization of verbose logs into a small Analytics table | **Summary rule** |
| Python, ML, visualization over the data lake | **Notebook** (VS Code, Spark) |
| Natural language and an AI agent over the data lake | **Sentinel MCP server** |
| Continuous monitoring of new query results | Not livestream (retired) – **analytics rule** or **KQL job** |

## Summary

- Hunting queries are at **Microsoft Sentinel** > **Threat management** > **Hunting** > **Queries**: Content hub and custom queries, MITRE tactics/techniques, **Run all queries**, **Results delta** for spikes, *N/A* for queries without a source, favorites run when the page is opened. A query is turned into a detection through **New alert rule** > **Create Microsoft Sentinel alert**.
- **Bookmarks** save result rows with the query, tags, notes, entities and MITRE mapping; **Incident actions** create an incident or add to an existing one; the data is in the **`HuntingBookmark`** table; bookmarks are not available in Advanced hunting.
- **Hunts** (preview) bring together the hypothesis, queries, bookmarks and outcome. **Livestream no longer exists** – the replacements are KQL jobs, analytics rules, playbooks.
- **KQL jobs** (**Data lake exploration** > **Jobs**): one-time or scheduled queries over the data lake and federated tables; new tables `_KQL_CL` (analytics) or `_KQL` (system tables); limits of 5 concurrent, 1 h, 100 jobs, 12 years; start at least 30 min after creation; no `adx()`, `arg()`, `externaldata()`, `ingestion_time()` or UDFs; latency up to 15 min (`now() - delay`); the managed identity `msg-resources-<guid>` needs **Log Analytics Contributor**.
- **Summary rules** (**Configuration** > **Summary rules**): bin 20 min to 24 h, destination `_CL` with the Analytics plan, additional columns `_RuleName`, `_RuleLastModifiedTime`, `_BinSize`, `_BinStartTime`, at most 100 active rules, no time filter in the query, no backfill; role **Microsoft Sentinel Contributor**; templates in the Content hub.
- **Notebooks**: classic (Azure ML, MSTICPy, analytics tier) and data lake notebooks in VS Code (**Microsoft Sentinel** extension, `MicrosoftSentinelProvider`, `read_table`, `save_as_table`, Small/Medium/Large pool, Python only, notebook jobs up to 8 h, 3 concurrent).
- **Sentinel MCP server**: hosted, Entra authentication, data exploration / triage / agent creation collections; tools `search_tables`, `query_lake`, `list_sentinel_workspaces`, `analyze_user_entity`, `analyze_url_entity`, `get_entity_analysis`; at least **Security Reader**, the entity analyzer consumes SCUs (**Security Copilot Contributor**); clients VS Code, Security Copilot, Copilot Studio, Microsoft Foundry.
