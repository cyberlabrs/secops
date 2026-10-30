## Why scenarios

In the previous courses each tool was learned separately: KQL in SC-200, CloudTrail in AWS Security Specialty, audit logs and Falco in CKS, Wazuh and Sigma in the detection lab, gitleaks in DevSecOps, prompt injection in AI security. A real incident does not respect those boundaries. Phishing starts in email, continues in Entra ID, crosses over VPN to a Linux server and ends with a database being exfiltrated. A leaked AWS key starts in git history, and the damage is measured in CloudTrail and S3.

This course has four scenarios. In each one you get an alert or a report, a set of evidence and a task: establish what happened, contain the attacker, build a timeline and write a report. This lesson gives the procedure that applies to all four.

## Response phases according to NIST SP 800-61r3

**NIST SP 800-61 Rev. 3** (April 2025) organizes incident response by the functions of **CSF 2.0**. In practice teams still work in phases; the mapping is simple:

| Working phase | CSF 2.0 functions | What you do in a scenario |
|---|---|---|
| Preparation | Govern, Identify, Protect | logs exist, clocks are synchronized, you know who decides (in the scenarios this is already done or missing, and that is a finding) |
| Detection and analysis | Detect (DE.AE), Respond (RS.AN) | alert triage, investigation by source, scope, timeline |
| Containment | Respond (RS.MI-01) | close the access the attacker has now, without destroying evidence |
| Eradication | Respond (RS.MI-02) | remove persistence and the weakness that enabled the attack |
| Recovery | Recover (RC.RP) | return systems and accounts to a known good state, heightened monitoring |
| Post-incident | Identify (ID.IM) | lessons learned, new detections and controls |

The phases are not strictly sequential. Containment often starts in the middle of analysis (as soon as you see an active attacker session), and analysis continues after containment (what else was touched). NIST r3 stresses that lessons are recorded right away, not only at the end.

## Triage: the first 15 minutes

Before you open the first log, answer the triage questions. Write the answers down: they are the first lines of the report.

1. **What is the trigger?** An alert (which rule, which level), a user report, a message from outside (a partner, a CERT, a researcher). When did it arrive, in which time zone?
2. **Is it real?** Could it be a false positive? What would explain it as legitimate activity (a business trip, a scheduled job, a test)?
3. **What is affected?** Which account, host, service, data. How critical is it (crown jewel or test server)?
4. **Does the attacker still have access?** An active session, a VPN connection, a process, a key. This decides how fast you must contain.
5. **What are the IOCs?** IP addresses, domains, hashes, user names, access keys. You search further with them.
6. **Who needs to know?** The system owner, management, legal (personal data, notification deadlines), communications.

From the answers follow the **priority** (e.g. P1 when the attacker has active access to production or data, P3 when the attempt was blocked) and the decision "incident or not" (CSF `DE.AE-08`).

## A timeline in UTC

The timeline is the backbone of the investigation and the report. Rules:

- **Everything in UTC.** The ticket is in local time, the email `Date` header has `+0200`, `auth.log` has neither a year nor a zone, CloudTrail is in UTC with `Z`, Wazuh has `+0000`. Convert everything to one form: ISO 8601 with `Z`, e.g. `2026-10-13T08:12:05Z`.
- **One event, one line**, with its source: `time, source, event`. The source lets you verify every claim.
- **Check the source's clock.** If a host has no NTP, its logs run late or early; record that as a finding.
- **Distinguish fact from conclusion.** "08:24:02 Accepted password for jkovac from 10.8.0.23" is a fact; "the attacker enters jump01" is a conclusion that follows from several facts.

```bash
date -u -d '2026-10-13 11:38 +0200' +%Y-%m-%dT%H:%M:%SZ       # 2026-10-13T09:38:00Z
date -u -d @1791877327 +%Y-%m-%dT%H:%M:%SZ                     # Unix epoch (DKIM t=) in UTC
jq -r '.eventTime' cloudtrail.json                             # CloudTrail is already in UTC
```

For a CSV timeline `sort` is enough, because ISO 8601 in UTC has the same lexical and chronological order.

## Pivoting between sources

No single source tells the whole story. A pivot is moving from one source to another through a value both contain:

| Field | Pivot example |
|---|---|
| **IP address** | `SigninLogs.IPAddress` → VPN log (public → internal address) → `auth.log` (`from 10.8.0.23`) |
| **User name** | Entra UPN `jelena.kovac@...` → Linux `jkovac` (SSSD) → `sudo` records |
| **Access key** | gitleaks finding `AKIA...` → CloudTrail `userIdentity.accessKeyId` → a new IAM user |
| **Token or session** | `SessionId` in sign-ins; a ServiceAccount token in the Kubernetes audit log (`user.username`) |
| **Hash** | an email attachment → `EmailAttachmentInfo` → `DeviceFileEvents` |
| **Time** | when there is no shared field: events within the same few-second window on related systems |
| **Container / pod** | Falco `k8s.pod.name` → audit log `objectRef.name` → the image and vulnerability in the Trivy report |

Write every pivot in your working notes (RS.AN-06: recording investigation actions): which query, over which source, what it returned. That way another analyst can retrace your path.

Queries from the scenarios:

```kql
SigninLogs
| where IPAddress == "203.0.113.77"
| summarize count() by ResultType, AppDisplayName
```

```bash
jq -r 'select(.userIdentity.accessKeyId == "AKIA...") | [.eventTime, .eventName, .sourceIPAddress] | @tsv' cloudtrail.json
jq -r 'select(.user.username | startswith("system:serviceaccount:")) | [.requestReceivedTimestamp, .verb, .objectRef.resource] | @tsv' audit.log
grep -E 'Accepted|sudo:|crontab\[' auth.log
```

## Evidence handling

Evidence you cannot defend is worthless. The basic rules (in detail in course 07, module Incident response):

- **Order of volatility** (RFC 3227): first memory, processes and network connections, then files, then logs on remote systems and archives. Shutting a host down wipes the most volatile evidence.
- **Work on a copy.** Keep the original (log, disk image, SIEM export) untouched; analyze a copy.
- **Hash immediately.** `sha256sum` of every file at the time of collection; the hash goes into the chain of custody.
- **Chain of custody**: who, when, what, with which hash, handed to whom. Every transfer is a new line.
- **Collect before cleaning.** Save `authorized_keys`, a crontab, a malicious pod or an IAM policy first (a file, `kubectl get -o yaml`, `get-policy-version`), and only then delete it.
- **Do not alert the attacker needlessly.** Actions the attacker can see (disabling an account, deleting a file) are done when you are ready to close all doors at once.

## Containment: what first

The order is almost always the same, from the widest access to the narrowest:

1. **Identity and access**: revoke sessions and tokens, deactivate keys, reset passwords, remove the attacker's MFA methods, users and keys.
2. **Network**: block the attacker's addresses, isolate the host or pod (NetworkPolicy, security group, network segment).
3. **Evidence** from the affected systems.
4. **Persistence**: keys, cron, new IAM users and policies, privileged pods, poisoned documents.
5. **Root cause**: the vulnerability, the overly broad permission, the leaked secret.

Every action goes into the timeline with its time and who performed it: containment is part of the incident's history too.

## The report

The report is read by both management and the technical team, so it has two levels:

| Section | Content |
|---|---|
| **Summary** | 3–5 sentences: what happened, when, what was affected, whether it is contained. No jargon. |
| **Timeline** | the key events in UTC with their source |
| **Root cause** | the technical cause (vulnerability, leaked key) and the organizational one (no DMARC `p=reject`, no code review for secrets) |
| **Scope and impact** | accounts, hosts, data (how many records, which categories), business impact, notification obligations |
| **Actions taken** | containment, eradication, recovery, with times |
| **Recommendations** | concrete, with an owner and a deadline; new detections (Sigma, KQL, Wazuh rule) |
| **Appendices** | IOC list, queries, evidence hashes, mapping to MITRE ATT&CK or ATLAS |

A good recommendation says **what**, **who** and **by when**: "DMARC for drinalog.example to `p=reject` by 1 Dec (owner: mail team)", not "improve email security".

## The four scenarios

| Scenario | Story | Evidence sources and tools | Courses it builds on |
|---|---|---|---|
| **1. Phishing and a compromised account** | a fake sign-in page, MFA fatigue, VPN, SSH to a jump host, `authorized_keys` and cron, database exfiltration | `.eml` headers, KQL over `SigninLogs` and `AuditLogs`, VPN log, `auth.log`, Wazuh alerts | 01, 02, 07, 08, 09 |
| **2. A leaked secret and AWS** | an AWS key in git history and a CI log, enumeration, privilege escalation, S3 data | gitleaks, git, CloudTrail with `jq`, IAM policies, Sigma and Zircolite | 03, 06, 07 |
| **3. A Kubernetes cluster** | a vulnerable application, a shell in a pod, a ServiceAccount token, secrets, a privileged pod | Falco alerts, Trivy report, Kubernetes audit log, RBAC manifests, NetworkPolicy | 04, 05, 07 |
| **4. An AI agent** | indirect prompt injection in a knowledge-base document, the agent exfiltrates data through its tools | the agent's tool-call traces, the email gateway log, a tool guard policy, OWASP LLM Top 10, MITRE ATLAS | 12, 07, 01 |

Each scenario has a lesson with the story, the attack chain, evidence by source, decision points and detections, a quiz with log snippets and a 45–60 minute lab in which you run the investigation yourself: answers are written to files and checked automatically.

Lab tip: before the first step, skim all the evidence (`ls -R`, `head`, `wc -l`, `getschema`) and sketch a rough timeline. Only then go into detail.

## Links to other courses

- [Detection and response: Incident response](#/07-detekcija-i-odgovor/m/09-odgovor-na-incidente): NIST SP 800-61r3, CSF 2.0, roles, order of volatility, chain of custody.
- [Detection and response: Containment and runbooks](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): runbooks for typical incidents.
- [Detection and response: MITRE ATT&CK](#/07-detekcija-i-odgovor/m/05-mitre-attack): mapping techniques and detections.
- [CySA+: Frameworks and the IR process](#/09-cysa/m/09-okviri-i-ir-proces) and [CySA+: IR techniques](#/09-cysa/m/10-ir-tehnike): response phases and investigation techniques.
- [CySA+: Reporting](#/09-cysa/m/11-izvjestavanje): incident reports and metrics.
- [SC-200: Defender XDR incidents](#/08-sc200/m/08-defender-xdr-incidenti): triage and investigation of incidents in the portal.
- [AWS Security Specialty: Incident response](#/03-aws-security-specialty/m/03-odgovor-na-incidente): IR in AWS.
- [CKS: Audit logs](#/05-cks/m/11-audit-logovi) and [CKS: Runtime security](#/05-cks/m/12-runtime-security): evidence in Kubernetes.
- [AI security: Testing and monitoring](#/12-ai-sigurnost/m/10-testiranje-i-monitoring): logging and monitoring of AI systems.
- Scenarios: [1. Phishing and an account](#/13-scenariji/m/02-phishing-i-nalog), [2. A leaked secret and AWS](#/13-scenariji/m/03-procurjela-tajna-aws), [3. Kubernetes](#/13-scenariji/m/04-kubernetes-kompromitacija), [4. AI agent](#/13-scenariji/m/05-ai-agent-incident).
