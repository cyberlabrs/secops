## Exam objectives: 1.2

Domain 1 (**Manage a security operations environment**) is worth 40–45% of the exam. This module covers objective **1.2 Configure the Microsoft Sentinel SIEM and platform**:

- **Specify Microsoft Sentinel roles**,
- **Manage data retention for XDR and Microsoft Sentinel tables, including Analytics, Data lake, and XDR tiers**,
- **Create and configure Microsoft Sentinel workbooks**,
- **Optimize the Microsoft Sentinel platform, including SOC optimization recommendations**.

Data ingestion (connectors, DCRs) is in module 4, detections in module 5, and data lake KQL jobs, summary rules and notebooks in module 10.

## The architecture in one picture

**Microsoft Sentinel** is a SIEM and SOAR that runs on top of a **Log Analytics workspace**. When you "enable Sentinel", the `SecurityInsights` solution is added to the workspace; the data lives in the workspace tables, and Sentinel adds analytics rules, incidents, automation, workbooks, hunting and threat intelligence.

Since 2025, Sentinel is used through the **Microsoft Defender portal** (unified security operations):

- Sentinel in the Defender portal is **GA**, including for customers without Defender XDR licenses,
- after **March 31, 2027**, Sentinel is no longer supported in the Azure portal; all customers are redirected to the Defender portal,
- new features (data lake, Sentinel graph, case management, SOC optimization via API, Security Copilot agents) arrive first, or only, in the Defender portal,
- Sentinel and Defender XDR incidents are in **a single incident queue**, with automatic alert correlation.

### Where things are in the Defender portal

| Azure portal (Sentinel) | Defender portal |
|---|---|
| **Logs** | **Investigation & response** > **Hunting** > **Advanced hunting** |
| **Incidents** | **Investigation & response** > **Incidents & alerts** > **Incidents** |
| **Workbooks** | **Microsoft Sentinel** > **Threat management** > **Workbooks** |
| **Hunting** | **Microsoft Sentinel** > **Threat management** > **Hunting** |
| **Notebooks** | **Microsoft Sentinel** > **Threat management** > **Notebooks** |
| **MITRE ATT&CK** | **Microsoft Sentinel** > **Threat management** > **MITRE ATT&CK** |
| **Threat intelligence** | **Threat intelligence** > **Intel management** |
| **Content hub** | **Microsoft Sentinel** > **Content management** > **Content hub** |
| **Data connectors** | **Microsoft Sentinel** > **Configuration** > **Data connectors** |
| **Analytics** | **Microsoft Sentinel** > **Configuration** > **Analytics** (and **Custom detection rules** under Hunting) |
| **Watchlists** | **Microsoft Sentinel** > **Configuration** > **Watchlists** |
| **Automation** | **Microsoft Sentinel** > **Configuration** > **Automation** |
| **Settings** | **System** > **Settings** > **Microsoft Sentinel** |
| (none) | **Microsoft Sentinel** > **Configuration** > **Tables** (tiers and retention) |
| **SOC optimization** | **SOC optimization** (in the left menu) |
| **Workspace manager** | not available |

Multiple workspaces can be connected to the Defender portal. One is the **primary workspace**: its alerts are correlated with Defender XDR data into shared incidents. The others are secondary (they are visible and can be investigated, but are not correlated with XDR in the same way).

> **On the exam:** a question like "where in the Defender portal do you configure X" is asking for the path. Remember the pattern: **Threat management** (workbooks, hunting, notebooks, MITRE), **Content management** (content hub, repositories), **Configuration** (data connectors, analytics, watchlists, automation, **tables**), and workspace settings are under **System > Settings > Microsoft Sentinel**. Logs no longer exists as a separate menu – it is advanced hunting.

## Roles (Specify Microsoft Sentinel roles)

The Sentinel SIEM uses **Azure RBAC**. The Sentinel data lake uses **Microsoft Entra ID** roles and Defender **unified RBAC (URBAC)**.

### Built-in Azure roles for Sentinel

| Role | What it can do |
|---|---|
| **Microsoft Sentinel Reader** | Views data, incidents, workbooks, recommendations and other resources; changes nothing |
| **Microsoft Sentinel Responder** | Everything Reader can + **manages incidents** (assignment, status, comments, closing) |
| **Microsoft Sentinel Contributor** | Everything Responder can + **creates and edits** analytics rules, workbooks, watchlists, installs solutions from Content hub |
| **Microsoft Sentinel Playbook Operator** | Lists, views and **manually runs** playbooks |
| **Microsoft Sentinel Automation Contributor** | Allows **Sentinel** (the service account) to add playbooks to automation rules; **not for users** |

What each role can do (including supporting roles):

| Role | Runs playbooks | Creates/edits playbooks | Creates analytics rules, workbooks | Manages incidents | Views data and incidents | Content hub |
|---|---|---|---|---|---|---|
| Sentinel Reader | – | – | – (workbooks with **Workbook Contributor**) | – | ✓ | – |
| Sentinel Responder | – | – | – (workbooks with **Workbook Contributor**) | ✓ | ✓ | – |
| Sentinel Contributor | – | – | ✓ | ✓ | ✓ | ✓ |
| Sentinel Playbook Operator | ✓ | – | – | – | – | – |
| **Logic App Contributor** | ✓ | ✓ | – | – | – | – |

### Additional requirements

| Task | Required |
|---|---|
| Connect a data source (connector) | **Write** permission on the workspace (+ connector-specific permissions) |
| Install content from Content hub | Microsoft Sentinel Contributor on the resource group |
| Create/edit playbooks | **Logic App Contributor** |
| Run playbooks manually | Microsoft Sentinel Playbook Operator |
| Have an automation rule run a playbook | The Sentinel service account needs explicit permissions on the **playbook's resource group**; to grant them, you must be an **Owner** (or have the right to assign roles) |
| Guest (B2B) assigns incidents | **Directory Reader** (Entra role) + Microsoft Sentinel Responder |
| Create/delete a workbook | Microsoft Sentinel Contributor, or a lower Sentinel role + **Workbook Contributor** |

Recommendation: assign roles on the **resource group** that contains the workspace, so they also cover Logic Apps and other resources. If you assign directly on the workspace, the same role must also be assigned on the `SecurityInsights` solution resource.

The broad roles **Owner**, **Contributor**, **Reader** and **Log Analytics Contributor/Reader** also grant access to Sentinel. Assignments are **cumulative**: a user with Reader and Contributor has Contributor rights.

Recommended distribution:

| Persona | Roles |
|---|---|
| SOC analyst | Microsoft Sentinel **Responder** + **Playbook Operator** |
| Security engineer | Microsoft Sentinel **Contributor** + **Logic App Contributor** |
| Service principal for automation (CI/CD) | Microsoft Sentinel Contributor |

### Limited data access

- **Resource-context RBAC** – a user sees only the logs of resources they have access to in Azure (e.g. an application team sees only the logs of its own VMs), without access to the whole workspace.
- **Table-level RBAC** – access only to specific tables.
- **Custom Azure roles** for the Sentinel SIEM; **Defender URBAC custom roles** for the data lake.
- In the Defender portal, unified RBAC also supports more granular (row-level) permissions.

### Data lake roles (Entra ID)

| Need | Role |
|---|---|
| Read all workspaces in the data lake | **Global Reader**, **Security Reader**, **Security Operator**, **Security Administrator**, **Global Administrator** |
| Write to the data lake or to the analytics tier through KQL jobs / notebooks | **Security Operator**, **Security Administrator**, **Global Administrator** |
| Create and manage **jobs** in the data lake | **Security Operator**, **Security Administrator**, **Global Administrator** |
| Read a single workspace in the lake | An Azure role on that workspace (Log Analytics Reader, Sentinel Reader…) |

Microsoft recommends least privilege: Global Administrator only for emergencies.

> **On the exam:** "Analysts need to close incidents and run playbooks manually, but must not change analytics rules" – **Responder + Playbook Operator**. "An engineer needs to create playbooks" – **Logic App Contributor** (Sentinel Contributor does not grant rights on Logic Apps). "An automation rule cannot run a playbook" – grant Sentinel permissions on the playbook's resource group (Sentinel **Settings** > **Playbook permissions**). "A user should see only the logs of their own VMs" – **resource-context RBAC**.

## Retention and tiers (Analytics, Data lake, XDR)

### Three places for data

| Tier | What it is | What it is for |
|---|---|---|
| **Analytics tier** ("hot") | Classic Sentinel/Log Analytics data, indexed | Analytics rules, alerts, advanced hunting, workbooks, all real-time features |
| **Data lake tier** ("cold") | **Microsoft Sentinel data lake**, low-cost long-term storage in an open (Parquet) format | Compliance, forensics, historical trends; KQL jobs, Spark/notebooks, summary rules, search |
| **XDR default tier** | Native Defender XDR data in advanced hunting | 30 days, included in the Defender license, not in the Sentinel workspace |

Data in the analytics tier is **automatically mirrored** to the data lake. There is a single copy of the data; there is no duplicate ingestion.

### Numbers you need to know

| Setting | Value |
|---|---|
| Default analytics retention | **30 days**; Sentinel tables can be extended free of charge to **90 days** (in its tier comparison Microsoft lists 90 days for Sentinel and 30 days for Defender XDR) |
| Maximum analytics retention | **2 years** (with a monthly charge for longer retention) |
| Total retention (analytics + lake) | up to **12 years** |
| Data lake–only retention | from 30 days to **12 years** |
| XDR tables in the analytics tier | up to **90 days** with no storage cost (Sentinel ingestion is charged); beyond 90 days storage is charged too |
| Reducing total retention | deletion only after **30 days**, so a mistake can be reverted |
| Changing analytics retention | takes effect **immediately** |

### Analytics vs Data lake

| | Analytics tier | Data lake tier |
|---|---|---|
| Ingestion price | standard | minimal |
| Queries included in the price | ✓ | ✗ (query processing is charged) |
| Query speed | optimized | slower, for audits and investigations |
| Analytics rules, hunting queries, watchlists, workbooks, playbooks | ✓ | limited / no |
| Advanced hunting | ✓ | ✗ (Data lake exploration is used) |
| Search jobs | ✓ | ✓ |
| Summary rules | ✓ | ✓ (KQL over a single table, extendable with `lookup` to an analytics table) |
| Restore | ✓ | ✗ (KQL jobs and notebooks **promote** data to the analytics tier) |
| Data export | ✓ | ✗ |

### Table types in the Defender portal

| Type | Examples | Management |
|---|---|---|
| **Microsoft Sentinel** | `SigninLogs`, `AzureDiagnostics`, `SecurityAlert`, `AWSCloudTrail`, XDR tables brought into the workspace (`DeviceEvents`, `AlertInfo`) | yes |
| **Custom** | `_CL` (custom sources), `_SRCH` (search job results), summary rule tables | yes |
| **XDR** | tables in the XDR default tier (e.g. `IdentityInfo`) | view only |

**Basic Logs** tables are visible in the Defender portal, but they are still managed from the Log Analytics workspace in Azure (or you switch them to the Analytics plan).

### Managing a table (steps)

1. Defender portal > **Microsoft Sentinel** > **Configuration** > **Tables**.
2. Change the workspace if needed (top left).
3. Select the table → side panel (sources, description, tier, retention) → **Manage table**.
4. Choose:
   - **Analytics tier**: **Analytics retention** (30 days – 2 years) and **Total retention** (up to 12 years in the lake), or
   - **Data Lake tier**: **Retention** from 30 days to 12 years; the data is **only** in the lake.
5. Read the warnings (e.g. moving to the data lake turns off alerting, advanced hunting, analytics rules and custom detections for that table).
6. **Save**.

Limitations and behavior:

- The tier can be changed at any time, but **not for all tables**: some XDR and Sentinel solution tables must stay in the analytics tier because Microsoft services use them for near-real-time analysis.
- For XDR tables: raising retention above 30 days **brings** the table into the Sentinel workspace (analytics tier + mirror to the lake). Setting both retentions back to 30 days **stops** ingestion (and turns off that table in the XDR connector in the Azure portal).
- An XDR table can be sent **only to the data lake**; even then it is available in advanced hunting for 30 days at no extra cost.

Example from the documentation: analytics retention 180 days, total 180 days. If you lower analytics to 90 and leave total at 180, data that is 90–180 days old is no longer in the analytics tier, but remains in the data lake.

Cost examples for an XDR table:

| Analytics | Total | What is charged |
|---|---|---|
| 30 (default) | 30 | nothing extra |
| 90 | 90 | analytics ingestion; 90 days of storage free; no lake cost |
| 90 | 180 | analytics ingestion; 90 additional days in the lake |
| 0 (lake only) | 5 years | lake ingestion + 5 years of storage in the lake |

**Table insights** (on the same **Tables** page) shows volume per tier, ingestion fluctuations (the last 24 h compared with the same day last week), the top 5 tables by volume, **Last data received**, estimated daily cost and volume anomalies. It is used to spot a connector that has gone quiet or a cost spike. It is display only: to alert on "connector is not sending data" you create an analytics rule over `SentinelHealth` or `Usage`.

```kql
// Tables that received no data in the last 24 h, but did earlier
Usage
| where TimeGenerated > ago(7d)
| summarize LastReceived = max(TimeGenerated), GB = sum(Quantity) / 1024 by DataType
| where LastReceived < ago(24h)
```

> **On the exam:** "Firewall logs must be retained for 7 years for regulatory reasons, are rarely searched and are not used in analytics rules. How do you do it MOST CHEAPLY?" – the table in the **Data lake tier** with 7-year retention. "Logs need real-time alerting and then retention for 3 years" – **Analytics tier** (e.g. 90 days analytics) and **Total retention** of 3 years. "We need MDE events in advanced hunting for 60 days" – raise the analytics retention of the XDR table to 60 days (up to 90 days with no storage cost).

## Workbooks

**Workbooks** are interactive reports and dashboards based on **Azure Monitor Workbooks**. Each workbook is an **Azure resource** (in the workspace's resource group), saved as a JSON definition – with no data; the data is read by queries when the workbook is opened.

### From a template

1. Install a solution or a standalone workbook from **Content hub**.
2. **Microsoft Sentinel** > **Threat management** > **Workbooks** > **Templates** tab.
3. Select a template; check **Required data types** (without that data the workbook is empty).
4. **Save** → choose a location; an Azure resource is created.
5. **View saved workbook** → **Edit** to customize → **Done editing**.

Saved workbooks are on the **My workbooks** tab. **Save as** creates a copy (clone) in the same subscription and resource group. Templates cannot be deleted; deleting a saved workbook is permanent.

### From scratch

1. **Workbooks** > **Add workbook** > **Edit**.
2. Add elements: **text**, **parameters**, **query**, **metric**, **links/tabs**, **group**.
3. For a query: **Data source** = **Logs**, **Resource type** = **Log Analytics**, select the workspace(s).
4. **Done editing** > **Save** (name, subscription, resource group).

The most common element is the **TimeRange** parameter, which queries use as `{TimeRange}`:

```kql
SecurityEvent
| where TimeGenerated {TimeRange}
| where EventID == 4625
| summarize FailedCount = count() by bin(TimeGenerated, 1h), Computer
| render timechart
```

A parameter can also be a drop-down list (e.g. `{SelectedComputer}` populated by the query `SecurityEvent | distinct Computer`), so the query uses `| where Computer in ({SelectedComputer})`.

Recommendations from the documentation:

- in workbook queries use **ASIM parsers** (e.g. `_Im_Authentication`) instead of a single table, so the workbook works with every source that gets normalized,
- different workbooks for different personas (network admin, SOC manager),
- auto refresh from **5 minutes to 1 day**; it pauses while editing and turns off when you close the workbook,
- **Print / Save as PDF** exists only in the Azure portal; from the Defender portal use **Open in Azure** (also for some visualizations the Defender portal does not display).

Permissions: at least **Workbook Reader** (viewing) or **Workbook Contributor** (creating and editing) on the workspace's resource group, along with an appropriate Sentinel role for reading the data.

A workbook relies on the **analytics tier**: if a table is moved to the data lake tier, a workbook over it stops showing data.

> **On the exam:** "You need a dashboard of failed Entra sign-ins with the LEAST effort" – install the **Microsoft Entra ID** solution from **Content hub** and save a workbook template (e.g. **Microsoft Entra sign-ins**). "A user sees a workbook but cannot save it" – **Workbook Contributor** (or Sentinel Contributor) is missing. "A PDF report is needed" – open the workbook in the Azure portal (**Open in Azure**) and **Print content** > **Save as PDF**.

## SOC optimization

**SOC optimization** gives concrete recommendations on how to reduce cost without losing coverage and how to close detection gaps. Recommendations are calculated every **24 hours**, are specific to your environment and use the standard Sentinel roles.

Path: Defender portal > **SOC optimization** (in the Azure portal: Sentinel > **Threat management** > **SOC optimization**). When the workspace is in the Defender portal, the recommendations also take other Microsoft security services into account.

### Recommendation types

| Type | What it suggests |
|---|---|
| **Data value** | Tables that are barely used: enable analytics rules or reduce cost (a different plan/tier, stopping ingestion) |
| **Coverage – threat-based** | Detection gaps for specific attacks (e.g. human-operated ransomware): missing rules or sources |
| **Coverage – AI MITRE ATT&CK tagging** (preview) | AI suggests MITRE tactics/techniques for untagged rules |
| **Coverage – risk-based** (preview) | Gaps tied to business risks (operational, financial, reputational, compliance, legal) |
| **Similar organizations** | Data sources used by organizations with a similar profile and industry that you do not have |

### Data value rules

Only **billable tables** that received data in the last **30 days** are considered:

| Observation | Suggested action |
|---|---|
| Table not used in analytics rules/detections for 30 days, but used in workbooks, queries, hunting | Enable analytics templates **or** move the table to a cheaper plan (basic / data lake), if eligible |
| Table not used at all for 30 days | Enable analytics templates **or** stop ingestion and remove the table, or move it to long-term retention |
| Table used only by Azure Monitor | Enable relevant rules **or** move the table to a non-security Log Analytics workspace |
| (preview) The `ConditionalAccessPolicies` column in `SigninLogs` / `AADNonInteractiveUserSignInLogs` is not used | Stop ingesting that column |

If a table is selected for **UEBA** or for a **threat intelligence matching** analytics rule, SOC optimization does not suggest reducing its ingestion.

### Threat-based coverage

The overview shows the coverage level based on the number of active rules compared with the rules Microsoft recommends for the scenario: **High** (over 75%), **Medium** (30–74%), **Low** (0–29%).

| Observation | Action |
|---|---|
| Sources exist, no detections | Enable analytics templates (**Go to Content hub**) |
| Templates exist, no sources | Connect new sources |
| Neither | Connect sources and detections, or install a solution |

From the recommendation details: **View details**, spider charts per tactic, **View threat scenario in MITRE ATT&CK** (the MITRE ATT&CK page pre-filtered for the scenario), **Go to Content hub** or **Change plan** for a table.

### Statuses

| Status | Meaning |
|---|---|
| **Active** | default |
| **In progress** | someone is working on the recommendation |
| **Completed** | everything done; a recommendation is completed **automatically** if a change in the environment makes it irrelevant (e.g. the table started being used in a rule) |
| **Dismissed** | you do not plan to apply it |

Completed and dismissed recommendations can be **reactivated** (they are recalculated, within an hour). Recommendations are also available through the **SOC optimization API**.

### Other cost levers

- **Commitment tiers** – a fixed daily volume at a discount (SOC optimization may suggest one along with data recommendations),
- **Data lake tier** for high-volume, rarely used logs,
- **ingestion-time transformations** in a DCR (filtering columns and rows before ingestion; module 4),
- **summary rules** – aggregating large logs into a small analytics table (module 10),
- **Table insights** for tracking volume and cost per table.

> **On the exam:** "You want to automatically determine which tables you are paying for but not using in detections, and get a suggested action" – **SOC optimization**, **data value** recommendations. "You want to find out which detections are missing for ransomware protection" – a **threat-based coverage** recommendation and **Go to Content hub**. The answer "write KQL over `Usage`" works, but is not the least-effort solution.

## Summary

- Sentinel = Log Analytics workspace + `SecurityInsights`; it is used through the **Defender portal**, and the Azure portal is supported until **March 31, 2027**. The primary workspace is correlated with XDR.
- Roles: **Reader** (views), **Responder** (+ incidents), **Contributor** (+ content and content hub), **Playbook Operator** (runs playbooks), **Automation Contributor** (for the Sentinel service, not users); **Logic App Contributor** for creating playbooks; **Workbook Contributor** for workbooks; assign on the **resource group**. Data lake: Entra roles (Security Reader/Operator/Administrator); jobs require **Security Operator** or higher.
- Tiers: **Analytics** (30 days by default, Sentinel tables up to 90 days free, maximum 2 years), **Data lake** (up to 12 years, cheap, no real-time features), **XDR default** (30 days in advanced hunting). Analytics is mirrored to the lake; total retention up to 12 years. Management: **Microsoft Sentinel > Configuration > Tables > Manage table**.
- Workbooks: an Azure resource (JSON), from **Content hub** templates or from scratch; parameters (`{TimeRange}`), ASIM parsers; Workbook Reader/Contributor; PDF only in the Azure portal.
- **SOC optimization**: data value (30 days of usage), threat-based (High >75%, Medium 30–74%, Low <30%), AI MITRE tagging, risk-based, similar organizations; statuses Active / In progress / Completed / Dismissed; calculated every 24 h.
