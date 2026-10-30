## Exam objectives: 2.1

Objective **2.1 Respond to alerts and incidents in Microsoft Defender XDR** is the broadest objective on the exam. It covers every alert source that ends up in the Defender portal:

- **Investigate and remediate threats by using Microsoft Defender for Office 365, including automatic attack disruption**,
- **Investigate and remediate threats or compromised entities identified by Microsoft Purview** (DLP and Insider Risk Management),
- **Investigate and remediate alerts and incidents identified by Microsoft Defender for Cloud workload protections**,
- **Investigate and remediate security risks identified by Microsoft Defender for Cloud Apps**,
- **Investigate and remediate compromised identities that are identified by Microsoft Entra ID** (ID Protection),
- **Investigate and remediate security alerts from Microsoft Defender for Identity**,
- **Investigate and remediate alerts and incidents identified by Microsoft Sentinel**,
- **Investigate incidents by using agentic AI, including embedded Microsoft Security Copilot**,
- **Investigate complex attacks, such as multi-stage, multi-domain, and lateral movement**,
- **Manage security incidents by using case management**.

Defender for Endpoint (objective 2.2) is in module 07. The common thread here: **one incident queue** in the Defender portal, with each service contributing its own alerts, entities and actions. The exam most often asks "which service or which action" for a given scenario.

## An incident in the Defender portal

**Investigation & response** > **Incidents & alerts** > **Incidents**. Defender XDR automatically correlates alerts from all sources (Endpoint, Office 365, Identity, Cloud Apps, Defender for Cloud, Purview, Entra ID Protection, Sentinel analytics rules) into an **incident** – one attack, one work item.

### Parts of the incident page

| Tab / part | What's there |
|---|---|
| **Attack story** | the alert story (What happened, Actions taken, Related events) and the **incident graph** with entities; replay of the attack over time, filters by severity, status and **service source** |
| **Alerts** | all incident alerts chronologically, with source (service source) and the reason they were linked |
| **Assets** | **Devices**, **Users**, **Mailboxes**, **Apps**, **Cloud resources** |
| **Investigations** | automated investigations (AIR) started by alerts |
| **Evidence and Response** | analyzed entities with a verdict (Malicious, Suspicious, Clean) and remediation status; approving actions |
| **Activities** | a unified chronology of manual and automatic actions (comments, changes, automation rules, playbooks, agents, attack disruption) |
| **Summary** / right panel | kill chain categories, scope, assignment, classification, tags, priority |
| **Similar incidents** | incidents with similar alerts and entities |

On the graph, from an entity node you choose **Go hunt** (All Activity, Related Alerts, All User anomalies with UEBA) – an advanced hunting query for that entity whose results can be **Link to incident**. For incidents on the Sentinel data lake there is also **View blast radius** (module 02 and objective 3.1).

### Managing an incident

- **Assign**, **Status** (*Active*, *In progress*, *Resolved*), **Severity**, **Tags**, **Comments**.
- **Classification** when closing: *True positive* (with a threat type, e.g. multi-staged attack, phishing), *Informational, expected activity* (benign positive), *False positive*.
- **Merge** and **unlink** alerts when correlation is incorrect; manual **Link to incident** from advanced hunting.

> **On the exam:** distinguish the classifications. A penetration test announced to the SOC is **Informational, expected activity** (benign positive) – the alert is correct, but the activity is expected. **False positive** is when the detection wrongly sees maliciousness in benign activity. For IRM alerts the classification is synchronized to Purview: True positive → *Confirmed*, everything else → *Dismissed*.

## Defender for Office 365

### Investigation tools

| Tool | Where | What for |
|---|---|---|
| **Explorer** (Threat Explorer, Plan 2) / **Real-time detections** (Plan 1) | **Email & collaboration** > **Explorer** | searching mail by sender, recipient, URL, hash, verdict; views *All email*, *Malware*, *Phish*, *Campaigns* |
| **Email entity page** | from Explorer, an alert or an incident | header, authentication (SPF, DKIM, DMARC), URLs and attachments, delivery timeline, Security Copilot summary |
| **Submissions** | **Actions & submissions** > **Submissions** | user and admin reports (phish, spam, false positives) |
| **Quarantine** | **Email & collaboration** > **Review** > **Quarantine** | reviewing, releasing, deleting quarantined messages |
| **Tenant Allow/Block List** | **Email & collaboration** > **Policies & rules** | blocking senders, domains, URLs, files |
| **Automated investigation and response (AIR)** | alerts and Action center | automated investigations (e.g. on a user-reported phish) with recommended actions |
| **Advanced hunting** | `EmailEvents`, `EmailUrlInfo`, `EmailAttachmentInfo`, `EmailPostDeliveryEvents`, `UrlClickEvents` | broader queries and remediation from results |

### Remediating delivered mail

From **Explorer** (or advanced hunting) you select messages and **Take action**:

| Action | Effect |
|---|---|
| **Move to junk folder** | moves to Junk |
| **Move to deleted items** | moves to Deleted Items |
| **Soft delete** | to Recoverable Items\Deletions; the user and admin can restore it |
| **Hard delete** | permanent deletion (an admin can restore it via single item recovery while retention lasts) |
| **Move to inbox** | restore (e.g. false positives) |

- **Direct approval**: a user with the **Search and Purge** role (URBAC: *Email & collaboration advanced actions (manage)*) executes immediately.
- **Two-step approval**: someone without the permission chooses **Add to remediation**; another team member approves in **Action center** > **Pending**.
- All remediations are in **Action center** > **History** (30 days). A remediation generates the alert "Administrative action submitted by an Administrator".
- Limits: up to 50 concurrent remediations per organization; from Explorer up to 200,000 messages per query; batches of up to 50,000 are recommended.
- The action has no effect on on-premises, external, failed/dropped or hard-deleted messages.

**Zero-hour auto purge (ZAP)** automatically removes already delivered messages when the verdict changes to malware, phish or spam. The trace is in `EmailPostDeliveryEvents`.

```kql
// Who received and who clicked the phishing URL from the campaign
let phishUrl = "contoso-login.example";
EmailUrlInfo
| where Url has phishUrl
| join kind=inner (EmailEvents | where Timestamp > ago(7d)) on NetworkMessageId
| join kind=leftouter (UrlClickEvents | where Url has phishUrl) on NetworkMessageId
| project Timestamp, RecipientEmailAddress, Subject, DeliveryLocation, ClickedBy = AccountUpn, ActionType
```

### Attack disruption and Office 365

Automatic attack disruption (details in module 07) also covers attacks that start through email and identity, such as **business email compromise (BEC)** and **adversary-in-the-middle (AiTM)** phishing: the compromised account is automatically disabled or suspended, sessions are revoked, and the incident gets the **Attack Disruption** tag. The analyst continues the investigation (mailbox forwarding rules, suspicious OAuth consent, sent messages), cleans up messages through Explorer and only then restores the account.

For user-reported phishing there is also the **Phishing Triage Agent** (a Security Copilot agent): it automatically classifies reported messages as a real threat or a false alarm and explains its conclusion in natural language. Prerequisites are URBAC for Defender for Office 365, *Monitor reported messages in Outlook* turned on, and the alert policy *Email reported by user as malware or phish*.

> **On the exam:** "A phishing message was delivered to 300 mailboxes before the URL was declared malicious. You need to remove it from all mailboxes with the ability to restore it if it was a mistake." – **Explorer** > filter by URL > **Take action** > **Soft delete** (or Move to deleted items). Hard delete is not reversible for the user. If the analyst does not have the **Search and Purge** role, their action goes for approval in **Action center** > **Pending**.

## Microsoft Purview: DLP and Insider Risk Management

### DLP alerts in the Defender portal

**Purview Data Loss Prevention** alerts arrive in the Defender portal as alerts and incidents (service source **Data Loss Prevention**). Defender correlates them with other signals: e.g. downloading a file, uploading it to a personal OneDrive and sharing it externally become one incident.

- Filter in the incident queue: **Service source: Data Loss Prevention**.
- Remediation on entities: user, file, device (e.g. contain user, quarantine file, isolate device), plus actions in Purview.
- In the Purview portal (**Data loss prevention** > **Alerts**) there are the **Events** tabs (individual events) and **Sensitive info types** (which SIT and with what confidence), status *Active / Investigating / Dismissed / Resolved*, and **Summarize with Copilot**.
- License for investigating DLP incidents in Defender: Microsoft 365 E5/A5, Office 365 E5/A5, E5 Compliance or E5 Information Protection and Governance.

### Insider Risk Management alerts

**Insider Risk Management (IRM)** alerts are in the Defender portal if sharing with other security solutions (**Share user risk details with other security solutions**) is turned on in the Purview IRM **Data sharing** settings.

| Topic | Detail |
|---|---|
| Roles | Defender: Security Operator or Security Reader; plus an IRM role group (*Insider Risk Management*, *Analysts* or *Investigators*) |
| Display | alerts grouped into incidents per user, filter **Service source: Microsoft Purview Insider Risk Management**, insider risk level on the user page |
| Synchronization | status, severity and classification are synchronized with Purview within ~30 minutes |
| Advanced hunting | `AlertInfo`, `AlertEvidence`, **`DataSecurityBehaviors`**, **`DataSecurityEvents`** (require the IRM Analyst or Investigator role) |
| Sentinel | the recommendation is the *Microsoft Purview Insider Risk Management* connector; IRM incidents in Defender have no alert content, which can break automation |

```kql
// Upload of sensitive files to personal cloud services (Purview events)
DataSecurityEvents
| where Timestamp > ago(7d)
| where ActionType has "Upload"
| summarize Files = count() by AccountUpn, ActionType
| order by Files desc
```

> **On the exam:** "SOC analysts don't see insider risk alerts in the Defender portal, even though IRM policies work in Purview." – in the Purview IRM settings, turn on **data sharing** with other security solutions, and assign the analysts an IRM role group. If the question asks for the table with enriched events that violate Purview policies, the answer is **DataSecurityEvents**.

## Defender for Cloud (workload protections)

All alerts from **Defender for Cloud** plans (Servers, Storage, SQL, Containers, Key Vault, Resource Manager, App Service, AI…) come into the Defender XDR alert and incident queue, including AWS and GCP resources. Informational alerts are not forwarded.

- On the incident: the **Assets** > **Cloud resources** tab, and a VM has its own entity page. **Open cloud resource page** leads to Defender for Cloud.
- Defender for Cloud alert status is **synchronized** in both directions. Exception: a Defender for Endpoint alert on a cloud resource has no status synchronization between the two portals.
- Remediation: mitigation steps from the alert, **Take action** in Defender for Cloud (e.g. hardening recommendations, **workflow automation** with Logic Apps), and for a VM with the MDE agent also all actions from module 07 (isolate, live response).
- Advanced hunting: `CloudAuditEvents` (ARM and Kubernetes control plane), `CloudProcessEvents`, `CloudStorageAggregatedEvents`.
- Visibility: without a Defender XDR Unified RBAC role for Defender for Cloud alerts, only Global Administrator and Security Administrator see them; the **alert subscription ID** filter narrows to a subscription.

For Sentinel users: use the **Tenant-based Microsoft Defender for Cloud** connector, turn off the old **Subscription-based (Legacy)** connector and analytics rules that create incidents from Defender for Cloud alerts, otherwise duplicates are created.

> **On the exam:** "After connecting Sentinel to Defender XDR, Defender for Cloud alerts appear twice." – turn off the subscription-based (legacy) Defender for Cloud connector and the Microsoft security incident creation rules for Defender for Cloud, and use the tenant-based connector. Incidents come through the Defender XDR integration.

## Defender for Cloud Apps

**Defender for Cloud Apps** provides alerts about risky behavior in SaaS applications (impossible travel, mass download, suspicious inbox rules, ransomware activity in the cloud) and about risky **OAuth apps**.

| What | Where in the Defender portal |
|---|---|
| User and app activities | **Cloud apps** > **Activity log** (the `CloudAppEvents` table in hunting) |
| Policies | **Cloud apps** > **Policies** (activity, anomaly detection, file, session, OAuth app) |
| OAuth apps | **Cloud apps** > **OAuth apps** or **App governance** (if enabled) |
| Discovered apps | **Cloud apps** > **Cloud discovery** (shadow IT) |

**Governance actions** on a user: **Suspend user**, **Require user to sign in again** (session revocation), **Confirm user compromised** (sets high risk in Entra ID Protection, so risk-based policies react). On an OAuth app: **Revoke app** or **Ban app**; automatically through an OAuth app policy. On files: quarantine, removing sharing.

Investigating a suspicious OAuth app: filter on **high permission level** and **community use: not common**, look at **Related activities** and **Consent activities**, the number of users who gave consent, the publisher, and whether the permissions match the purpose.

```kql
// Mass download from SharePoint/OneDrive per user (last 24h)
CloudAppEvents
| where Timestamp > ago(1d)
| where ActionType == "FileDownloaded"
| summarize Downloads = count(), Files = dcount(ObjectName) by AccountDisplayName, IPAddress
| where Downloads > 500
| order by Downloads desc
```

> **On the exam:** "An OAuth app with the *Full access to all mailboxes* permission received consent from three users and sends mail on their behalf. You need to immediately remove access for all users and prevent renewed consent." – in **OAuth apps** (or App governance) **Ban app**. Resetting users' passwords does not revoke the OAuth grant.

## Microsoft Entra ID Protection

**Entra ID Protection** calculates **sign-in risk** (the risk of an individual sign-in) and **user risk** (the likelihood that the account is compromised). Alerts and risky users are also visible in the Defender portal (user page, incidents). Full functionality requires **Entra ID P2** (or Entra Suite).

| Administrator action | Effect on risk | Least privileged role |
|---|---|---|
| **Reset password** (temporary password) | *Remediated* | User Administrator (+ Security Operator for access to ID Protection) |
| Require **secure password change** | *Remediated* | – (the user changes it with MFA) |
| **Dismiss user risk** / **Dismiss risky sign-in** | *Dismissed* (the password is not changed) | Security Operator |
| **Confirm user compromised** | *Confirmed compromised* (risk becomes high) | Security Operator / Security Administrator |
| **Confirm sign-in safe** | reduces risk and trains the model | Security Operator |
| **Block user**, **Revoke sessions** (refresh tokens) | prevents access | User Administrator and related |

Self-remediation: risk-based **Conditional Access** policies require **MFA** for sign-in risk and a **secure password change** (MFA + password change, not SSPR) for user risk. For hybrid users there is the option **Allow on-premises password change to reset user risk** (requires password hash sync). Detections related to token theft (e.g. *Anomalous token*, *Attacker in the Middle*) are no longer automatically remediated by MFA alone.

```kql
// Risky sign-ins and their state (Sentinel workspace)
AADUserRiskEvents
| where TimeGenerated > ago(7d)
| summarize Detections = make_set(RiskEventType), MaxLevel = max(RiskLevel) by UserPrincipalName, RiskState
| order by UserPrincipalName asc
```

> **On the exam:** "The investigation confirmed that the account is compromised. What should you do in Entra ID Protection so that risk-based policies treat the account as high risk and so that the model learns?" – **Confirm user compromised**, then reset the password and **revoke sessions**. **Dismiss user risk** is for the situation where the investigation showed the account was NOT compromised, and it does not change the password.

## Defender for Identity

**Defender for Identity (MDI)** sensors on domain controllers (and AD FS, AD CS, Entra Connect servers) monitor on-premises AD. Alerts are grouped by attack phase: **reconnaissance** (LDAP, SAMR, DNS enumeration), **credential access** (brute force, Kerberoasting, AS-REP roasting), **lateral movement** (pass-the-hash, pass-the-ticket, remote code execution), **domain dominance** (DCSync, Golden Ticket, skeleton key, suspicious changes to sensitive groups).

- Identity page: **Assets** > **Identities** – alerts, devices, activity timeline, **lateral movement paths** (paths by which an attacker can get from a compromised account to sensitive accounts).
- Hunting: `IdentityLogonEvents`, `IdentityQueryEvents`, `IdentityDirectoryEvents`, `IdentityInfo`.

**Remediation actions** (from the identity page, advanced hunting or the Action center; require URBAC **Response (manage)**):

| Action | Identity sources |
|---|---|
| **Disable** / **Enable** | Active Directory, Entra ID, Okta, CyberArk, SailPoint, some SaaS applications |
| **Revoke session** | Entra ID, Okta |
| **Mark as compromised** | Entra ID |
| **Force password change** | Active Directory, Entra ID |

In AD, the action is performed by the MDI sensor on the **domain controller** under the DC's **LocalSystem** account (setting **Manage action accounts** > *Automatically use the sensor's local system account*, mandatory for sensor v3.x). In Entra ID, the action is performed by Microsoft's enterprise application *Microsoft Defender for Identity*.

```kql
// Who was added to sensitive AD groups in the last 7 days
IdentityDirectoryEvents
| where Timestamp > ago(7d)
| where ActionType == "Group Membership changed"
| extend Group = tostring(AdditionalFields["TO.GROUP"])
| where Group in~ ("Domain Admins", "Enterprise Admins", "Administrators")
| project Timestamp, Group, TargetAccountUpn, AccountName, DeviceName
```

## Sentinel incidents in the Defender portal

When a Sentinel workspace is connected to the Defender portal, alerts from **Sentinel analytics rules** enter the same correlation engine as XDR alerts and appear in the **unified incident queue** (service source **Microsoft Sentinel**).

- Sentinel alerts can be merged with Defender alerts into one incident (e.g. a firewall alert from Sentinel + an MDE alert on the same device).
- **Microsoft incident creation rules** in Sentinel are turned off during onboarding, because Defender XDR itself creates incidents from Microsoft services.
- Changes (status, assignment, comments) are synchronized between the Defender portal and the Sentinel workspace; Sentinel **automation rules** and playbooks run on incidents (module 06).
- Sentinel-specific: **tasks** in the incident, **entity pages** with UEBA data, **Run query** from an alert created by an analytics rule, bookmarks from hunting (module 10).
- Remediation for non-Microsoft sources goes through **playbooks** (e.g. blocking an IP on the firewall) or attack disruption connectors (Okta, AWS).

> **On the exam:** "A Sentinel workspace is connected to the Defender portal. An analyst wants an alert from a Sentinel scheduled rule for a Palo Alto firewall to be in the same incident as an MDE alert for the same device." – this is done by **Defender XDR correlation automatically**; no separate rule is needed. If the question asks where incidents from Microsoft services are created, the answer is Defender XDR (incident creation rules in Sentinel are turned off).

## Security Copilot and agentic AI

**Security Copilot** is embedded in the Defender portal for users who have been granted access (Security Compute Units, SCU). Embedded capabilities:

| Capability | Where it appears | What it provides |
|---|---|---|
| **Incident summary** | Copilot panel / tab on the incident page (automatic) | attack overview: what happened, assets, chronology |
| **Guided response** | incident page | recommended actions (triage, containment, remediation) specific to the incident |
| **Script analysis** | attack story, for PowerShell and command lines | explanation (deobfuscation) of the script |
| **File analysis** | file page | detections, certificates, API calls, strings |
| **Device summary**, **Identity summary** | device / user page | posture, unusual behavior, roles and sign-ins |
| **Email summary** | email entity page | summary of the message, URLs and attachments |
| **Incident report** | incident page | report with actions, who did what and when |
| **Query assistant** | advanced hunting | natural language → KQL |
| **Defender Chat** (preview) | **Copilot** button in the top bar | chat aware of the page you are on, plans you approve before execution |

**Agents** (agentic AI) work autonomously over a workflow: the **Phishing Triage Agent** classifies user-reported phishing, and the same agent (Security Alert Triage Agent) is expanding to identity and cloud alerts. Incident cases can run **agentic playbooks** and show the status and output of an agent session. Agents do not classify alerts you suppressed with suppression rules.

> **On the exam:** "An analyst encounters an obfuscated PowerShell command in an alert and needs to quickly understand what it does." – **script analysis** in Security Copilot (from the attack story). For "a summary of an incident with 40 alerts" it is **incident summary**, for "which actions should I take" **guided response**, and for "write KQL from a sentence" **query assistant** in advanced hunting.

## Complex attacks: multi-stage, multi-domain, lateral movement

An attack rarely stays in one service. A typical chain and where you see it:

| Phase | Signal | Service |
|---|---|---|
| Initial access | AiTM phishing mail, URL click | Defender for Office 365 (`EmailEvents`, `UrlClickEvents`) |
| Session theft | anomalous token, sign-in from an unusual location | Entra ID Protection (`AADUserRiskEvents`, `SigninLogs`) |
| Cloud persistence | forwarding rule, OAuth consent | Defender for Cloud Apps (`CloudAppEvents`) |
| Execution on a device | a macro launches PowerShell | Defender for Endpoint (`DeviceProcessEvents`) |
| Lateral movement | pass-the-hash, RDP, SMB toward servers | Defender for Identity + MDE (`IdentityLogonEvents`, `DeviceLogonEvents`) |
| Exfiltration | upload of sensitive files | Purview DLP/IRM (`DataSecurityEvents`), MDCA |

How to investigate:

1. On the **attack story** graph, play the replay over time and filter by **service source** to see which service saw which phase.
2. Find the **pivot entity** (user or device) common to multiple alerts; open its page and **Go hunt** > *All Activity*.
3. For lateral movement: **lateral movement paths** on the identity page (MDI), `DeviceLogonEvents` with `LogonType` *RemoteInteractive*/*Network*, and **blast radius** from the node.
4. **Link to incident** the results from hunting, and **merge** unlinked alerts.
5. Containment by domain: account (disable, revoke), devices (isolate/contain), email (soft delete), application (ban app), cloud resource (Defender for Cloud recommendations).

```kql
// Lateral movement: the same account signs in over the network to many devices in a short time
DeviceLogonEvents
| where Timestamp > ago(1d)
| where LogonType in ("Network", "RemoteInteractive") and ActionType == "LogonSuccess"
| summarize Devices = dcount(DeviceName), DeviceList = make_set(DeviceName, 20) by AccountName, bin(Timestamp, 1h)
| where Devices >= 10
| order by Devices desc
```

## Case management

**Case management** in the Defender portal (the **Cases** page) is the SOC work item that brings together context, collaboration, tasks, evidence and history. It is available **only in the Defender portal**, not in Sentinel in the Azure portal.

| Type | Description |
|---|---|
| **Incident cases** (preview) | created from a correlated incident; the recommended experience for managing incidents (the legacy incident page remains during preview); include the attack story, alerts, assets, evidence, activities and agent sessions |
| **Generic cases** | manually created cases for SecOps work outside the incident flow (e.g. a rule review, investigating multiple incidents, a management request) |

Capabilities: status, priority, assignee, tags, description, **SLA policy**; **tasks** with an owner, due date and closing note; comments and **activity history**; **attachments**; linked objects; **case templates** with custom fields and SLA policies; auditing in the Log Analytics table **`SecurityCaseEvent`**.

| Generic case permission | Defender URBAC | Sentinel role |
|---|---|---|
| View | Security operations > **Security data basics (read)** | Microsoft Sentinel **Reader** |
| Create and manage, assign | Security operations > **Alerts (manage)** | Microsoft Sentinel **Responder** |
| Templates, custom fields, SLA | Authorization and settings > **Core security settings (manage)** | Microsoft Sentinel **Contributor** |

Incident cases use the same permissions as incidents (**Security Data Read** / **Security Data Manage**).

> **On the exam:** "A manager asks for the investigation of three related incidents to be run as one case with tasks for three analysts, due dates and an SLA, in the Defender portal." – a **case** (a generic case with tasks and an SLA policy from a case template). An analyst who only needs to create and assign cases needs **Microsoft Sentinel Responder** (or URBAC *Alerts (manage)*), not Contributor.

## Summary

- The Defender portal has **one incident queue**: Endpoint, Office 365, Identity, Cloud Apps, Defender for Cloud, Purview DLP/IRM, Entra ID Protection and Sentinel alerts are correlated automatically; the **service source** filter separates the sources.
- Incident: attack story and graph, Alerts, Assets, Investigations, **Evidence and Response**, **Activities**; **Go hunt** and **Link to incident**; classification True positive / Informational expected activity / False positive.
- **MDO**: Explorer > Take action (soft/hard delete, move), the **Search and Purge** role or two-step approval in the Action center, ZAP, AIR, Phishing Triage Agent; attack disruption covers BEC and AiTM.
- **Purview**: DLP alerts as incidents (Service source DLP); IRM requires **data sharing** and an IRM role group; tables `DataSecurityEvents` and `DataSecurityBehaviors`.
- **Defender for Cloud**: all alerts except informational, Cloud resources tab, two-way status synchronization, tenant-based connector in Sentinel to avoid duplicates.
- **MDCA**: Activity log, policies, OAuth apps / App governance; Suspend user, Require sign in again, Confirm user compromised, **Ban/Revoke app**.
- **Entra ID Protection** (P2): Confirm compromised vs Dismiss risk; password reset and revoke sessions; risk-based CA for self-remediation.
- **MDI**: phases (recon, credential access, lateral movement, domain dominance), lateral movement paths; actions Disable, Force password change, Revoke session, Mark as compromised; DC LocalSystem account.
- **Security Copilot**: incident summary, guided response, script/file analysis, device/identity summary, incident report, query assistant, Defender Chat; agents (Phishing Triage).
- **Case management**: incident cases (preview) and generic cases, tasks, SLA, templates, `SecurityCaseEvent`, only in the Defender portal.
