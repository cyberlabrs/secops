## Exam objectives: 4.1 and 4.2

Domain 4 (**Reporting and Communication**) accounts for 16% of the exam. It's small, but the questions are scenario-based and "softer": who is the right recipient of the information, which report fits the audience, and which metric measures what is being asked.

- **4.1** explain the importance of vulnerability reporting and communication: vulnerability scan reports, compliance findings, risk scorecards, action plans (escalation, dependencies), **inhibitors to remediation**, stakeholder identification, metrics and KPIs (trends, top risks, SLA),
- **4.2** explain the importance of reporting and communication in security operations and incident response: incident declaration and escalation, executive summary, communication plan (legal, PR, regulators, law enforcement, customers), operational security awareness (communication channels), post-incident reporting (after action report, lessons learned, RCA), shift/incident handover, internal threat intelligence report, metrics (alert volume, false-positive rate, true-positive rate, MTTC, MTTD, MTTR…, phishing click rate).

After this module you should be able to choose the right report format for the audience, recognize an inhibitor to remediation from a scenario, calculate basic SOC metrics, and know who must be notified.

## Vulnerability reporting (4.1)

### Vulnerability scan reports

A scanner (Nessus, Qualys, OpenVAS, or in our lab `trivy`/`osv-scanner`) produces raw findings. The report must be tailored to the audience:

| Audience | What they need | Format |
|---|---|---|
| **System administrators / DevOps** | Exact host, package, version, CVE, fixed version, steps | Detailed list per asset, ticket per finding or group |
| **Team manager / service owner** | How many, how overdue, which are critical | Summary per system, SLA status |
| **CISO / management** | Risk trend, top risks, compliance | Risk scorecard, dashboard, executive summary |
| **Auditor / compliance** | Proof of scanning and remediation on time | Compliance report (PCI DSS ASV, exceptions) |

An example of turning raw output into a technical list for the system owner:

```
$ trivy image --format json -o scan.json registry.local/payments:2.4
$ jq -r '.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL" or .Severity=="HIGH")
        | [.VulnerabilityID, .PkgName, .InstalledVersion, .FixedVersion, .Severity] | @tsv' scan.json
CVE-2024-45337  golang.org/x/crypto  v0.21.0  0.31.0   CRITICAL
CVE-2025-22869  golang.org/x/crypto  v0.21.0  0.35.0   HIGH
CVE-2024-6119   libssl3              3.0.13   3.0.15   HIGH
```

A good report for management doesn't contain a table like this but a conclusion: "the payments service has 1 critical vulnerability with a public exploit, the remediation deadline is 7 days, the fix is in progress".

Typical parts of a scan report:

| Part | Content |
|---|---|
| Scope and method | Which ranges/assets, credentialed or not, tool and plugin database version, date |
| Summary | Number of findings by severity, comparison with the previous scan, top risks |
| Findings | Asset, port/service, CVE, CVSS (and vector), EPSS, KEV, evidence (banner, package version) |
| Recommendations | Fix (version, configuration), workaround, compensating control |
| Exceptions | Accepted risks and false positives with justification and expiration date |

An example of evidence from a network scan that goes with a finding (the service version as the reason for the finding):

```
$ nmap -sV -p 22,443 127.0.0.1
PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)
443/tcp open  ssl/http nginx 1.22.1
```

A non-credentialed scan sees only the banner; a credentialed scan checks the actual package version and produces fewer false positives (backported patches). That is a common reason why a system owner disputes a finding, so the report should state the method.

Priority in the report comes from module 07: CVSS + **EPSS** + **CISA KEV** + asset criticality. A finding on the KEV list always goes into the "top risks".

```
$ jq -r '.vulnerabilities[] | select(.cveID=="CVE-2024-6387") | .dateAdded, .dueDate' /opt/kurs/data/kev.json
```

(If there's no output, the CVE isn't in the local copy of KEV; for entries that are, `dueDate` is the deadline for US federal agencies, also useful as an internal benchmark.)

### Compliance findings

Compliance findings compare the current state with a requirement of a standard or regulation: PCI DSS (quarterly internal and external ASV scans, remediation of high-risk findings), HIPAA, ISO 27001, CIS Benchmarks, internal policies. The report states the **control**, the **finding**, the **evidence**, and the **plan** (or an approved exception with a compensating control).

### Risk scorecards

A scorecard is a concise overview of risk per business unit, system, or owner, usually with a score or color (red/yellow/green):

| Business unit | Critical open | Outside SLA | KEV findings | Trend (30 days) | Rating |
|---|---|---|---|---|---|
| Payments | 1 | 0 | 1 | ↓ | Yellow |
| HR portal | 4 | 3 | 2 | ↑ | Red |
| Internal wiki | 0 | 0 | 0 | → | Green |

The scorecard lets management compare units and drive owner accountability.

### Action plans: escalation and dependencies

An **action plan** (remediation plan) for a finding or group of findings contains: what is being done (patch, configuration, compensating control), owner, deadline, **dependencies**, and the **escalation** path.

- **Dependencies**: remediation depends on something else: the vendor must release a version, the application requires a new Java version, a change window is needed, another team must migrate the database first.
- **Escalation**: if the owner doesn't meet the SLA deadline, the finding is escalated to higher management (and ultimately to the risk owner, who must formally accept the risk or provide resources).

```
Finding:     CVE-2024-6387 (OpenSSH regreSSHion) on bastion-01
Action:      Upgrade openssh-server to 1:9.2p1-2+deb12u3
Owner:       Infrastructure (D. Hodžić)        Deadline (critical SLA): 7 days
Dependency:  Change window on Saturday; test access to the jump host
Interim:     LoginGraceTime 0 + access only from the VPN subnet (compensating control)
Escalation:  Day 8 -> infrastructure manager; day 15 -> CISO / risk acceptance
```

> **On the exam:** if the system owner doesn't patch on time and doesn't respond → **escalation** along the agreed path (up to the risk owner), not "the analyst installs the patch themselves". If the patch is waiting on a new version of another team's application → a **dependency** in the action plan.

### Inhibitors to remediation

The exam likes scenarios in which a vulnerability **cannot** be patched right away. Recognize the inhibitor and offer a compensating control:

| Inhibitor | Example | What to do |
|---|---|---|
| **Contractual agreements** | The vendor contract/warranty prohibits changes to a medical device; an SLA with a customer prohibits downtime | Negotiate with the vendor, segmentation, monitoring |
| **Organizational governance** | Every change must go through a CAB that meets monthly; unclear ownership | Emergency change process, clear RACI |
| **Business process interruption** | The patch requires an ERP restart in the middle of year-end closing | Schedule in a change window, temporary mitigation (WAF, ACL) |
| **Degrading functionality** | A patch or hardening breaks functionality (e.g., disabling TLS 1.0 breaks an old client) | Testing, exception with a deadline, compensating control |
| **Legacy systems** | Windows Server 2012 out of support, no more patches | Isolation, replacement plan, virtual patching, enhanced monitoring |
| **Proprietary systems** | A closed system (SCADA, vendor appliance) that the customer may not modify | Request to the vendor, network segmentation |
| **Patch availability** | A patch doesn't exist yet (zero-day) or the vendor is late | Workaround from the advisory, IPS signature, disable the vulnerable feature |

> **On the exam:** "The system runs a production line, the vendor doesn't allow patches to be installed, and the system must not stop" → a combination of **proprietary/contractual** inhibitors; the BEST answer is a **compensating control** (segmentation, ACL, monitoring), not "ignore it" and not "patch without approval".

### Stakeholder identification and communication

Who needs to know about vulnerabilities: **system and application owners** (they execute), **IT operations / DevOps**, **change management (CAB)**, **risk owners and management** (they accept risk, provide resources), **compliance/audit**, **vendors** (third-party products), the **legal team** (contractual obligations). Communication should be regular (weekly report, monthly scorecard) and two-way (owners report false positives and exceptions).

An example **RACI** matrix for remediating a critical finding (R = responsible, A = accountable, C = consulted, I = informed):

| Activity | VM team | System owner | CAB | CISO / risk owner |
|---|---|---|---|---|
| Scanning and validating findings | R/A | C | | I |
| Applying the patch | C | R/A | C | I |
| Approving the change | | C | R/A | |
| Accepting risk (exception) | C | R | | A |
| Verification with a rescan | R/A | I | | I |

Without a clear owner, a finding "hangs" between teams; that's why **unclear ownership** is a classic governance inhibitor.

A short message to the owner is often more effective than a 200-page PDF:

```
Subject: [CRITICAL, SLA 7 days] OpenSSH on bastion-01 (CVE-2024-6387)
What: pre-authentication remote code execution, public PoC, internet-facing host.
Fix: openssh-server >= 1:9.2p1-2+deb12u3. Interim: LoginGraceTime 0.
Deadline: 10 Oct 2026. Status tracked in ticket VM-2291; rescan after the change.
```

### Vulnerability metrics and KPIs

| Metric | What it shows |
|---|---|
| **Trends** | Number of open findings by severity over time; new vs closed; whether the program is improving |
| **Top risks** | The riskiest findings/assets (KEV, high EPSS, internet-facing, critical asset) |
| **SLA compliance** | Percentage of findings closed on time (e.g., critical 7 days, high 30, medium 90) |
| **Mean time to remediate** (MTTR for vulnerabilities) | Average time from detection to confirmed fix |
| **Vulnerability age / backlog** | How long findings have been open; how many are outside SLA |
| **Scan coverage** | Percentage of assets that are scanned (and credentialed) |

Calculating SLA compliance from a ticket export:

```
$ jq -r '[.[] | select(.severity=="critical" and .closed)
          | ((.closed|fromdateiso8601) - (.found|fromdateiso8601))/86400] as $d
          | "closed: \($d|length)  on time (<=7d): \([$d[]|select(.<=7)]|length)  average days: \($d|add/length|.*10|round/10)"' vulns.json
closed: 24  on time (<=7d): 19  average days: 5.8
```

SLA compliance is 19/24 ≈ 79%. If the target is 95%, that's a topic for a report with escalation.

> **On the exam:** "Management wants to see whether the vulnerability management program is improving" → **trend** metrics and a scorecard over time, not a list of CVEs. "Measure whether teams meet deadlines" → **SLA** compliance.

## Reporting in SecOps and IR (4.2)

### Incident declaration and escalation

**Incident declaration** is the formal decision that an event becomes an incident (according to the criteria in the IR plan; in NIST 800-61r3 DE.AE-08). From that moment rules apply: an incident commander is appointed, an incident channel is opened, the clock starts for regulatory deadlines, the defined stakeholders are brought in. Escalation after declaration follows severity: a P1 always involves the CISO, the legal team, and communications.

### Communication plan: who must know

| Stakeholder | Why | Note |
|---|---|---|
| **Stakeholder identification** | Contacts listed in advance (with backups) per incident type | Part of preparation; RACI |
| **Legal team** | Assessing notification obligations, privileged communication, legal hold, contracts | Involve early; often all external communication goes through the legal team |
| **Public relations** | A single, accurate message to the media and the public | Analysts don't make statements |
| **Regulatory reporting agencies** | Legal obligations and deadlines | E.g., GDPR: to the supervisory authority within **72 hours** of becoming aware of a personal data breach; NIS2: early warning within **24 h**, notification within **72 h**, final report within one month; SEC (US public companies): Form 8-K within 4 business days of determining materiality |
| **Law enforcement** | Criminal offenses (ransomware, extortion, CSAM) | The decision is made by management and the legal team; it affects evidence preservation |
| **Customers** | Affected customers and partners | Contractual obligations (DPA, SLA), message aligned with PR and the legal team |

> **On the exam:** an analyst who receives a journalist's inquiry **redirects it to PR**. The decision to notify law enforcement or a regulator is made by **management and the legal team** according to the plan, not by an individual analyst. "Who FIRST" in a personal data breach → usually the **legal team** (assessing obligations).

### Operational security awareness: communication channels

During an incident, communication must be **need-to-know** and secure:

- assume the attacker may be in email and the chat tool: use an **out-of-band** channel (separate tenant, phone, encrypted app),
- don't mention incident details in open channels, tickets visible to everyone, or on social media,
- use an incident code name instead of a descriptive name,
- limit the recipient list; don't forward IoCs outside the team without approval (the attacker may monitor public TI sources).

### Executive summary

The executive summary is for management: **one page**, no jargon, focused on **business impact**, risk, what has been done, and what is being requested (a decision, budget). Structure:

```
Incident IR-2026-041 (P1) - management summary, as of 3 Oct 2026 16:00
What happened:   A phishing email gave the attacker access to 3 laptops in Accounting.
Impact:          No evidence of customer data theft; 4 h invoicing downtime.
Status:          Attack contained on 2 Oct at 08:45; systems cleaned and back in operation.
Risk:            Low risk of recurrence after blocking macros and rotating accounts.
Decision needed: Approve the purchase of FIDO2 keys for finance (estimate EUR 6,000).
```

### Post-incident reporting

| Report | Content | Audience |
|---|---|---|
| **After action report** (AAR) | Facts: timeline, scope, impact, actions taken, what worked and what didn't, corrective actions | Management, IR team, audit |
| **Lessons learned** | Meeting (blameless) and conclusions: what to improve in people, process, technology; updating the plan and playbooks | All participants |
| **Root cause analysis** | Why it happened (5 Whys, fishbone), cause vs symptom | Technical teams, risk owners |

Skeleton of an after action report:

```
AFTER ACTION REPORT  IR-2026-041   Classification: INTERNAL / confidential
1. Summary (executive summary)
2. Scope and impact: 3 hosts, 1 service account, 4 h invoicing downtime, no PII exfiltration
3. Timeline (UTC): from email delivery at 08:09 to incident closure on 5 Oct 14:00
4. Incident metrics: dwell time 31 min, time to containment 31 min from the alert
5. What worked: EDR isolation, phishing playbook, out-of-band channel
6. What didn't work: the macro GPO didn't cover the Finance OU; no detection for PsExec
7. Root cause: see RCA (appendix A)
8. Corrective actions: owner, deadline, verification (appendix B)
9. Appendices: IoC list, ATT&CK mapping, chain of custody records
```

The lessons learned meeting is held **soon** after closure (while memories are fresh), includes all roles, and focuses on the process, not on a culprit. Key questions: what happened and when, how did staff perform, what would they do differently, what information was needed sooner, which indicators to watch for in the future, which tools or resources are needed.

### Shift/incident handover

In a 24/7 SOC and during long incidents, the **handover** between shifts must be structured so that nothing is lost:

```
HANDOVER  2 Oct 2026 20:00 UTC  (day -> night shift)
Open incidents:      IR-2026-041 (P1)  - hosts isolated, waiting for reimage of HR-DT-03
Actions in progress: Memory forensics of FIN-LT-11 (L. Petrić), ETA 23:00
Watch:               New attempts toward 203.0.113.0/24 (blocked on FW, alert active)
Pending decisions:   Legal team by 09:00 on notifying customer X
Contacts:            IR lead: A. Vojić (phone in the plan), infrastructure on-call: D. Hodžić
```

A good handover is written (in the ticket/incident channel), with a verbal walkthrough and a clear owner for each open item.

### Internal threat intelligence report

An internal TI report is **tailored to the organization and its environment**: it doesn't retell a generic vendor report but says what it means for us. It contains: relevant threats for the industry, observed IoCs and TTPs (ATT&CK) from our own incidents, whether we are exposed (which versions we run), detection coverage, and recommendations. Audiences: SOC (tactical IoCs and detections), IT (operational: what to patch), management (strategic trend).

> **On the exam:** "A report on a new campaign should be useful to the SOC" → an **internal threat intel report** with TTPs mapped to ATT&CK and an exposure check in our environment. The executive summary is for management, the AAR comes after the incident.

## SOC metrics and KPIs

| Metric | Definition | Note |
|---|---|---|
| **Alert volume** | Number of alerts per period/source/rule | Growth without growth in incidents = noise, alert fatigue |
| **False-positive rate** | FP / (FP + TP) among triaged alerts | High FP → rule tuning |
| **True-positive rate** | TP / (TP + FP) (in SOC practice: the share of alerts that are real) | Measures detection quality |
| **Mean time to detect (MTTD)** | Average from the start of the compromise to detection | Measures visibility; related to dwell time |
| **Mean time to respond (MTTR)** | Average from detection/alert to the start of response or containment | Measures SOC speed |
| **Mean time to remediate** | Average from detection to full remediation (also for vulnerabilities) | "MTTR" is ambiguous: check the context of the question |
| **Mean time to close** | Average from opening to closing a ticket/incident | Includes documentation |
| **Phishing campaign click rate** | Clicked / received in a simulated campaign | Together with the report rate, shows the effect of awareness training |

A note on definitions: in statistics, the true-positive rate is the same as sensitivity (TP / (TP + FN)), but FN is rarely known in a SOC, so in practice the FP/TP rate is calculated over the alerts the analyst closed. On the exam, stick to the simple interpretation: what share of alerts is real and what share is false.

Calculation from a ticket export (times in epoch seconds):

```
$ jq -r 'map(select(.verdict!=null)) as $a
  | ($a|map(select(.verdict=="FP"))|length) as $fp | ($a|length) as $n
  | ($a|map(select(.verdict=="TP")) | map((.detected-.started)/3600) | add/length) as $mttd
  | ($a|map(select(.verdict=="TP")) | map((.contained-.detected)/60) | add/length) as $mttr
  | "alerts: \($n)  FP rate: \($fp*100/$n|round)%  MTTD: \($mttd|.*10|round/10) h  MTTR: \($mttr|round) min"' alerts.json
alerts: 1240  FP rate: 87%  MTTD: 19.4 h  MTTR: 42 min
```

Interpretation: 87% false alerts means alert fatigue and a need for tuning (module 05, efficiency). An MTTD of 19 h is poor for ransomware scenarios; an MTTR of 42 min is good.

Rules for good metrics:

- a metric must be tied to a goal (reduce risk, not "close as many tickets as possible"),
- track the **trend**, not just a single value,
- avoid metrics that encourage bad behavior (e.g., rewarding fast closure leads to superficial triage),
- present by audience: the SOC lead looks at FP per rule, management at the MTTD/MTTR trend and risk.

> **On the exam:** "Measure how quickly the SOC detects threats" → **MTTD**; "how quickly it reacts after detection" → **MTTR (respond)**; "how noisy a rule is" → **false-positive rate**; "effectiveness of the awareness program" → **phishing click rate** (together with the report rate) across several campaigns.

## Dashboards

A dashboard is a permanent visual display of metrics, as opposed to a periodic report. Examples:

| Dashboard | Audience | Content |
|---|---|---|
| SOC operational | Analysts, SOC lead | Open alerts by severity, queue, SLA timers, top rules by FP |
| Vulnerability management | System owners, VM team | Open findings per team, outside SLA, KEV findings, trend |
| Executive | CISO, management | Risk score, MTTD/MTTR trend, incidents per month, compliance |

A good dashboard has a small number of key figures, trends, and clear thresholds; it doesn't display everything the SIEM can count.

## Summary

- Tailor the vulnerability report to the audience: details for administrators, scorecard and trends for management, evidence for compliance.
- An action plan has an owner, a deadline, **dependencies**, and an **escalation** path up to the risk owner.
- Inhibitors to remediation: contractual, governance, business process interruption, degrading functionality, legacy, proprietary, patch availability → the answer is usually a **compensating control** + a plan.
- Vulnerability KPIs: trends, top risks, **SLA** compliance, time to remediate.
- IR communication: declaration and escalation according to the plan; legal, PR, regulators (GDPR 72 h, NIS2 24/72 h), law enforcement, customers; out-of-band channels and need-to-know.
- Executive summary (one page, business impact), AAR, lessons learned (blameless), RCA, shift handover, internal TI report tailored to the environment.
- SOC metrics: alert volume, FP/TP rate, **MTTD**, **MTTR** (respond/remediate), mean time to close, phishing click rate; track the trend and tie each metric to a goal.
