## Exam objectives: Domain 6 (6.1–6.5)

Domain 6 is **Security Assessment and Testing** and carries **11.2%** of the exam under the 2027 outline. (In the 2024 outline, 12%.) Objectives:

- **6.1 Design and validate assessment, test, and audit strategies**
  - internal (within organization control),
  - third-party (outside of enterprise control),
  - external (outside of organization control),
  - location (on-premise, cloud, hybrid).
- **6.2 Conduct security controls testing**
  - vulnerability assessment,
  - coverage analysis,
  - penetration testing,
  - interface testing (user interface, network interface, API),
  - log reviews,
  - synthetic transactions/benchmarks,
  - code review and testing,
  - misuse case testing,
  - attack simulations,
  - compliance checks.
- **6.3 Collect security process data (e.g., technical, administrative)**
  - account management,
  - training and awareness,
  - management review and approval,
  - Disaster Recovery (DR) and Business Continuity (BC),
  - key performance and risk indicators,
  - backup verification data.
- **6.4 Analyze test/audit output and generate report**
  - remediation,
  - exception handling,
  - responsible disclosure.
- **6.5 Conduct or facilitate security audits**
  - internal, third-party, external, location (on-premises, cloud, hybrid).

> In the 2024 outline, penetration testing has the example "red, blue, and/or purple team exercises", "breach attack simulations" appears instead of "attack simulations", objective 6.4 reads "Analyze test output" (without audit), and "ethical disclosure" appears instead of "responsible disclosure". Objectives 6.1, 6.3 and 6.5 are the same in content.

From practice you know scanners, SAST/DAST, pentest reports and SOC 2. What CISSP asks here: **who** tests (internal, external, third party), **what** each type of test proves, **when** testing happens, how metrics are collected and interpreted, and what a manager does with findings (risk-based priority, exceptions, management approval).

## Assessment, testing and audit strategy (6.1)

### Three terms that get mixed up

| Term | What it is | Who does it | Result |
|---|---|---|---|
| **Test** | verification that a control works as intended (technical, repeatable) | technical team, tool | test result (pass/fail, finding) |
| **Assessment** | broader evaluation of the security posture, often several tests + interviews + documentation review | internal or external assessor | risk evaluation and recommendations |
| **Audit** | formal, independent verification of compliance with a standard, policy or law, backed by evidence | **independent** auditor | opinion/report on compliance |

### Who tests

The outline distinguishes three perspectives. The key is **who controls the environment and who controls the assessor**:

| Type | Definition from the outline | Example | Advantage | Limitation |
|---|---|---|---|---|
| **Internal** | within organization control | internal vulnerability team, internal audit | knowledge of the environment, continuity, lower cost | less independence, "blind spots" |
| **External** | outside of organization control | regulator, certification body, external auditor engaged by a third party or by law | highest independence and credibility | the organization does not set scope and timing at will |
| **Third-party** | outside of enterprise control | you assess a supplier; or an independent firm tests your systems under your contract; a provider's SOC 2 report | independence with a contractually defined scope | depends on the contract, the right to audit and trust in the third party |

On the exam: an **internal** audit reports to management (usually the audit committee) and helps improvement; an **external** audit serves stakeholders outside the organization (regulator, investors, customers); **third-party** most often refers to assessing suppliers and the supply chain (or to someone else's report on a supplier that you rely on).

### Location

| Location | Specifics |
|---|---|
| **On-premises** | full access, physical access, your own rules of engagement |
| **Cloud** | shared responsibility: you test only what you are responsible for; **the provider's penetration testing policy** (some require notice, some prohibit certain tests, e.g. DoS); IaaS gives more options than SaaS, where you rely on the provider's reports (SOC 2, ISO 27001, CSA STAR) |
| **Hybrid** | testing the connections and trust between environments (federation, VPN, synchronization), consistency of controls on both sides, clear scope boundaries |

### Strategy design

1. Start from **business objectives and the risk assessment** (what is most valuable, what the law requires).
2. Define the **scope**, methods, frequency, responsibilities and resources.
3. Obtain **management approval** and, for technical tests, written permission and **rules of engagement** (Rules of Engagement: scope, timing, contacts, what is prohibited, data handling).
4. **Validate** the strategy: do the tests really measure what they should, do they cover all critical controls (see coverage analysis), are the results usable for decisions.
5. Update periodically according to changes in threats, technology and regulation.

Standards and frameworks: **NIST SP 800-115** (technical testing), **NIST SP 800-53A** (control assessment), **NIST SP 800-137** (ISCM, continuous monitoring), **ISO/IEC 27001/27002** and **ISO 19011** (audit guidelines), **PTES**, **OSSTMM**, **OWASP Testing Guide**.

> **On the exam:** before any technical test, the FIRST step is **written management approval** and an agreed scope. A test without permission is an attack, regardless of intent. If the question is "who grants permission for a pentest", the answer is senior management/the system owner, not the administrator.

## Security controls testing (6.2)

### Vulnerability assessment vs penetration testing

| Criterion | Vulnerability assessment | Penetration testing |
|---|---|---|
| Goal | identify and rank known vulnerabilities | prove that vulnerabilities can be exploited and how large the impact is |
| Method | automated scanners, configuration review | manual work with tools, chaining vulnerabilities |
| Depth | broad, shallow | narrow, deep |
| Risk to systems | low | higher (can cause an outage) |
| Frequency | regular (e.g. monthly, continuous) | periodic (e.g. annually) and after major changes |
| Result | list of vulnerabilities with a score (CVSS) | report on proven attack paths and business impact |

Scanning terms: **credentialed (authenticated)** scanning gives a more accurate picture with fewer false positives than **non-credentialed**; a **false positive** (a reported vulnerability that does not exist) wastes time, a **false negative** (a missed vulnerability) is more dangerous. Standards: **SCAP** (a common language for automation): **CVE** (vulnerability identifier), **CVSS** (severity score 0–10), **CPE** (platform identification), **CCE** (configuration), **XCCDF** (checklist format), **OVAL** (language for checking state).

### Phases and types of penetration tests

Phases (NIST SP 800-115): **planning** → **discovery** (reconnaissance and vulnerability scanning) → **attack** (exploitation attempts, escalation, additional discovery) → **reporting**. Other models add reconnaissance, enumeration, post-exploitation and cleanup.

| Tester knowledge | Description | What it simulates |
|---|---|---|
| **Black box** (zero knowledge) | the tester knows nothing | an outside attacker; most realistic, slowest |
| **Gray box** (partial knowledge) | partial knowledge, e.g. a user account | an attacker with stolen credentials or an insider |
| **White box** (full knowledge, crystal box) | full access to documentation and code | most thorough coverage for the given time |

| Defender knowledge | Description |
|---|---|
| **Blind** | the tester knows nothing; defenders know about the test |
| **Double-blind** | neither the tester nor the defenders (SOC) know the details; tests both detection and response |
| **Targeted** | both sides know, collaboration |

Teams: **red team** (attack, simulates the adversary), **blue team** (defense and detection), **purple team** (joint work to improve detection), **white team** (referees, rules, coordination). The 2024 outline lists them explicitly with pentesting.

### Attack simulations

**Attack simulations** (in 2024 "breach attack simulations", BAS) are automated, continuous and safe simulations of attacker techniques (e.g. mapped to MITRE ATT&CK) to verify whether controls (EDR, SIEM rules, DLP, segmentation) **detect and block** what they should. The difference from a pentest: repeatability and frequency instead of creativity; control effectiveness is measured over time. In a broader sense this also includes red team exercises, **tabletop** exercises and **phishing simulations**.

### Coverage analysis

**Coverage analysis** answers the question "how much of what should be tested has actually been tested". Examples:

- **Code coverage** in software testing: the percentage of statements, branches, conditions and functions executed by the tests. Branch coverage is stricter than statement coverage.
- **Asset coverage**: what percentage of assets in the inventory is scanned by the vulnerability scanner, has EDR, sends logs to the SIEM.
- **Control coverage**: which controls from the framework were tested during the period; **detection coverage** against ATT&CK techniques.

Calculation example: the inventory has 1,200 servers, and in the last 30 days the scanner scanned 1,020. Coverage = 1,020 / 1,200 = **85%**. The remaining 15% is unknown risk; first investigate why (unreachable segments, powered-off hosts, wrong inventory).

### Interface testing

| Interface | What is tested |
|---|---|
| **User interface** | input validation, error messages that do not leak information, role-based access control, session behavior |
| **Network interface** | open ports, protocols, segmentation, encryption in transit |
| **API** | object- and function-level authentication and authorization, rate limiting, schema validation, data leakage, versioning (OWASP API Security Top 10) |
| Physical interface | device ports, consoles, debug interfaces |

Interface testing also checks the **boundaries between components**: whether a module properly handles unexpected data from another module. Integration testing is where this is done.

### Log reviews

Log review uncovers incidents, policy violations and control irregularities. Good practice:

- centralization in a SIEM, synchronized time (NTP), protection of log integrity (WORM, hash, separate accounts),
- automated correlation and alerts plus periodic manual review of critical events,
- **clipping level** (threshold): record/alert only when the number of events exceeds a threshold (e.g. 5 failed logins), to reduce noise,
- review is performed by someone who is **not** an administrator of the observed system (SoD),
- retention according to law and policy.

### Synthetic transactions and benchmarks

**Synthetic transactions** are scripted, predefined transactions executed periodically to verify availability, performance and functionality (e.g. a robot goes through login and purchase every 5 min). The opposite is **Real User Monitoring (RUM)**, passive monitoring of real users. Synthetic tests detect a problem even when there are no users (at night), while RUM shows the real experience.

**Benchmarks** are reference values: performance (a baseline for comparison) or security configurations (**CIS Benchmarks**, DISA STIG) against which deviation is measured.

### Code review and testing

| Method | Description | When |
|---|---|---|
| **Manual code review / peer review** | people read the code, find logic errors | before merging code |
| **Fagan inspection** | formal, most rigorous review: planning, overview, preparation, inspection, rework, follow-up | critical software |
| **SAST** (static) | analysis of source code without executing it | early in the SDLC, in the IDE and CI |
| **DAST** (dynamic) | testing a running application from the outside | test/staging environment |
| **IAST** | an agent inside the application during tests | combines the advantages |
| **SCA** | analysis of third-party components and libraries | continuously |
| **Fuzzing** | sending invalid, random or mutated inputs: **mutation (dumb)** modifies existing inputs, **generation (intelligent)** builds inputs from a protocol model | finding crashes and input-handling errors |
| **Unit / integration / regression / acceptance** | functional testing at different levels | throughout the SDLC |

**Static** testing does not execute the code, **dynamic** testing executes it. **Positive** tests check expected behavior, **negative** tests check invalid inputs.

### Misuse case testing

A **use case** describes how a legitimate user uses the system. A **misuse case** (abuse case) describes how a malicious actor would abuse it, e.g. "a customer changes the price in the request", "a user accesses someone else's order by changing the ID". Tests are written to confirm that the system rejects such behavior. They come from threat modeling (STRIDE) and business logic, which automated scanners do not understand.

### Compliance checks

Verifying that systems are configured according to policy, standard or law: automated configuration checks (SCAP, CIS, cloud posture management), checking PCI DSS, HIPAA or an internal baseline configuration. Continuous compliance checks are part of **ISCM** (Information Security Continuous Monitoring).

> **On the exam:** distinguish what each test proves. A scanner **identifies** a vulnerability; a pentest **proves** exploitability and impact; a synthetic transaction verifies **availability and function**; a misuse case verifies **resistance to abuse of business logic**; coverage analysis measures **how much has been tested**. If the question asks for "the least disruptive way to regularly find known vulnerabilities", that is a credentialed vulnerability scan, not a pentest.

## Collecting security process data (6.3)

Technical tests verify controls; process data shows whether the **program** works. The outline lists technical and administrative data:

| Area | Data examples |
|---|---|
| **Account management** | number of accounts disabled on time after departure, number of orphan accounts, percentage of completed recertifications, number of privileged accounts, time from request to provisioning |
| **Training and awareness** | percentage of employees who completed training, test results, click rate and reporting rate in phishing simulations, trend over time |
| **Management review and approval** | minutes of management reviews (ISO 27001 clause 9.3), approved policies and exceptions, risk acceptance decisions, action tracking |
| **DR and BC** | test results (tabletop, walkthrough, simulation, parallel, full interruption), achieved RTO/RPO versus targets, currency of plans, number of trained team members |
| **KPI and KRI** | see below |
| **Backup verification data** | percentage of successful backup jobs, results of **restore tests**, integrity checks, restore time, offline/immutable copies |

### KPI vs KRI

| | **KPI** (Key Performance Indicator) | **KRI** (Key Risk Indicator) |
|---|---|---|
| Question | how well are we doing? (in the past) | how much is risk growing? (early warning signal) |
| Example | 95% of critical patches applied within 14 days; MTTD and MTTR of incidents | the number of systems on an unsupported OS is growing; increase in failed logins from new locations; number of open critical findings older than 90 days |
| Link | measures the effectiveness of processes and controls | tied to **risk appetite** and thresholds that trigger escalation |

A good metric is **SMART** (specific, measurable, achievable, relevant, time-bound), has an owner, a data source and a target value. Metrics for management are expressed in business terms (trend, risk, impact), not raw vulnerability counts.

Example of a KRI with a threshold: "percentage of endpoints without EDR"; green < 2%, yellow 2–5%, red > 5% (escalation to the CISO). If 260 of 4,000 endpoints have no agent, the value is 6.5%, red, so the risk is escalated.

### Backup verification

A backup that has not been restored has not been proven. Data to collect: job success, **periodic restore tests** (single file, entire system, entire site), hash comparison, measured recovery time versus RTO, age of the last good copy versus RPO, existence of an isolated copy resistant to ransomware (the **3-2-1** rule, or 3-2-1-1-0: one offline/immutable, zero errors during verification).

> **On the exam:** "the best evidence that the backup process works" is a **successful restore test**, not a log of a successful backup. Likewise, the best evidence of training effectiveness is not the attendance percentage but a change in behavior (e.g. a drop in click rate and a rise in reports in phishing simulations).

## Analyzing results and reporting (6.4)

### From findings to a report

1. **Validation**: confirm findings, remove false positives.
2. **Risk-based prioritization**: severity (CVSS) + likelihood of exploitation (e.g. EPSS, KEV list) + value and exposure of the asset + existing compensating controls. A critical vulnerability on an isolated test system may be a lower priority than a medium one on a publicly exposed system with personal data.
3. **Report tailored to the audience**: an **executive summary** for management (business risk, trend, recommendations, decisions needed), a technical section for teams (details, evidence, steps to reproduce in a controlled environment, remediation recommendations), methodology and scope.
4. A vulnerability report is a **sensitive document** and is classified and distributed on a need-to-know basis.

### Remediation

- A remediation plan with an **owner**, a deadline (SLA by severity, e.g. critical 7–15 days) and tracking (**POA&M**, Plan of Action and Milestones).
- Fix the root cause, not just the symptoms (e.g. correct the patch management process, not just one patch).
- **Verification** of the fix by retesting.
- Fixes go through **change management**.

### Exception handling

When a finding cannot be remediated (business reason, legacy system, cost greater than benefit):

- a formal exception request with justification and a risk assessment,
- **compensating controls** (segmentation, enhanced monitoring),
- approval by the **risk owner** at the appropriate management level (not by a technician),
- an **expiration date** for the exception and periodic review,
- recording in the risk register.

An exception is a form of **risk acceptance**; it must never be permanent and unrecorded.

### Responsible disclosure

**Responsible disclosure** (in the 2024 outline **ethical disclosure**; a synonym is **coordinated vulnerability disclosure**, CVD) is the procedure when a researcher or organization discovers a vulnerability in someone else's product or system:

| Model | Description | Assessment |
|---|---|---|
| **Responsible / coordinated** | private notification of the vendor, a reasonable deadline for the fix (often 90 days), then public disclosure, with a coordinator (CERT/CSIRT) if needed | recommended; balances user protection and pressure to fix |
| **Full disclosure** | immediately publish all details | endangers users before a patch |
| **Non-disclosure** | never publish | the vulnerability remains, users are unaware of the risk |

On the organization's side: a published **vulnerability disclosure policy (VDP)**, a contact (e.g. `security.txt`), safe harbor for researchers who follow the rules, possibly a **bug bounty** program, internal handling of reports, CVE assignment. ISO/IEC 29147 (disclosure) and ISO/IEC 30111 (vulnerability handling) are the reference standards. The ISC2 Code of Ethics (protect society, act honorably and legally) guides the professional's behavior.

> **On the exam:** if during a test at a client you find a vulnerability in a third-party product, you do not publish it and you do not ignore it: you notify the client according to the contract and the vendor through a coordinated process. If during a pentest you come across evidence that the system is already compromised or illegal content, you stop and immediately notify the contact from the rules of engagement.

## Security audits (6.5)

### Types of audits

| Type | Who performs it | Reports to | Example |
|---|---|---|---|
| **Internal** | the organization's internal audit (independent of IT, reports to the audit committee) | management, board | annual internal audit plan for IT controls |
| **External** | an independent auditor outside the organization, often required by law or for certification | shareholders, regulator, certification body | audit of financial statements (SOX), ISO 27001 certification, PCI DSS QSA |
| **Third-party** | the organization (or an engaged auditor) assesses a supplier; or relies on an independent auditor's report on the supplier | you, as the service customer | audit of a cloud provider based on the right-to-audit clause in the contract, review of a SOC 2 Type II report |

To **facilitate** an audit means: prepare evidence, provide access to people and systems, designate a contact person, keep to the scope, and track findings to closure.

### SOC reports (SSAE 18 / ISAE 3402)

| Report | Content | Audience |
|---|---|---|
| **SOC 1** | controls relevant to the customer's **financial reporting** | the customer's auditors and finance |
| **SOC 2** | controls under the **Trust Services Criteria** (security, availability, processing integrity, confidentiality, privacy) | customers, under NDA (restricted distribution) |
| **SOC 3** | summary of SOC 2 without details | public, marketing |
| **Type I** | control design **at a point in time** | — |
| **Type II** | design **and operating effectiveness** over a period (usually 6–12 months) | stronger evidence |

When using someone else's SOC 2 report, check: the period it covers, the scope (which services and locations), the auditor's opinion (unqualified or qualified), exceptions in testing, **complementary user entity controls** (CUEC, controls you must have for the provider's controls to be effective) and subservice organizations (carve-out vs inclusive).

### Audit process

1. **Planning**: objectives, scope, criteria (standard, policy), team, schedule; auditor independence.
2. **Evidence collection**: interviews, documentation review, observation, re-performance, **sampling** (statistical or judgmental).
3. **Analysis and findings**: each finding has a condition (what is), criteria (what should be), cause, effect and recommendation.
4. **Report** and management response with an action plan.
5. **Follow-up** to closure.

### Audit location

- **On-premises**: physical inspection, direct access to systems.
- **Cloud**: the right to audit is limited; providers rarely allow individual physical audits, so **third-party attestations** are used (SOC 2, ISO 27001, CSA STAR, FedRAMP), along with checking your part of the shared responsibility model (configuration, IAM, data).
- **Hybrid**: a combination, with emphasis on boundaries and consistency of controls between environments.

> **On the exam:** when you cannot audit a cloud provider yourself, the BEST choice is reviewing an independent **SOC 2 Type II** report (or an ISO 27001 certificate with the statement of applicability) and checking the CUECs, not sending your own auditors into its data center. Type II is stronger evidence than Type I because it shows the controls operating over time.

## Continuous monitoring and additional assessment tools

### ISCM per NIST SP 800-137

**Information Security Continuous Monitoring** connects the tests from 6.2 and the metrics from 6.3 into an ongoing process:

| Step | Content |
|---|---|
| 1. **Define** | a strategy based on risk and risk tolerance |
| 2. **Establish** | the program: metrics, monitoring and assessment frequency, architecture |
| 3. **Implement** | data collection, automation where possible |
| 4. **Analyze / Report** | analysis and reporting of findings |
| 5. **Respond** | response: remediation, acceptance, avoidance, risk transfer |
| 6. **Review / Update** | review and improvement of the program |

### Types of DR/BC plan tests (a data source for 6.3)

| Test | Description | Business impact |
|---|---|---|
| **Read-through / checklist** | team members review the plan | none |
| **Walkthrough / tabletop** | group discussion of a scenario step by step | none |
| **Simulation** | a simulated event, the team performs procedures without failing over production | minimal |
| **Parallel** | systems are brought up at the alternate site, production runs normally | small |
| **Full interruption** | production is actually shut down and failed over | highest risk; rarely and with management approval |

### Audit evidence

| Type of evidence | Example | Strength |
|---|---|---|
| **Re-performance** | the auditor repeats the control (e.g. attempts access with a disabled account) | strongest |
| **Inspection** | review of records, configuration, logs | strong |
| **Observation** | observing a process being performed | medium (people behave better when observed) |
| **Inquiry** | interview, statement | weakest on its own; must be corroborated |

Evidence the auditor collects personally is stronger than evidence handed over by the audited party; evidence from an independent source is stronger than internal evidence.

### Example of finding prioritization

| Finding | CVSS | Exposure | Data | Exploited in the wild | Priority |
|---|---|---|---|---|---|
| A: RCE on an internal test server with no data | 9.8 | internal, isolated segment | none | yes | high, but behind B |
| B: authentication bypass on a public portal with personal data | 8.1 | internet | personal data | yes (on the KEV list) | **highest** |
| C: outdated TLS version on an internal API | 5.3 | internal | internal | no | medium/low |

CVSS measures technical severity; **risk** adds likelihood and business impact in your environment. That is why B goes ahead of A despite a lower CVSS.

> **On the exam:** when a question asks which vulnerability to remediate FIRST, do not automatically choose the highest CVSS. Look at exposure, asset and data value, active exploitation and existing controls. The correct answer is the one with the greatest **business risk**.

## Scenarios

**Scenario 1.** Management asks whether the controls are effective. The CISO has monthly scanner reports with 14,000 vulnerabilities. The correct response is not to send the list, but a report with the trend of critical findings on critical assets, scan coverage, adherence to remediation SLAs (KPI) and growing risks (KRI), along with the decisions required from management.

**Scenario 2.** A pentest found a critical vulnerability in a legacy manufacturing system that cannot be patched for two years. Correct procedure: risk assessment, compensating controls (segment isolation, access allowlist, monitoring), a formal exception approved by the risk owner, an expiration date and periodic review, a replacement plan.

**Scenario 3.** A company is moving to a SaaS ERP and the auditor asks for evidence of the provider's controls. The organization obtains a SOC 1 Type II (financial reporting) and a SOC 2 Type II (security and availability), checks the period, exceptions and CUECs, and documents its own controls (access, configuration, user reviews).

## Summary

- Test (does the control work), assessment (broader evaluation), audit (formal independent verification of compliance).
- Internal (within organization control), external (outside of organization control, highest independence), third-party (outside of enterprise control, suppliers and independent assessors under contract); location changes what you may test (provider cloud policies, shared responsibility).
- The strategy starts from risk and objectives, requires written management approval and rules of engagement, and must be validated (coverage).
- Vulnerability assessment (broad, identifies) vs pentest (deep, proves); black/gray/white box; blind and double-blind; red, blue, purple, white team; attack simulations (BAS) continuously measure detection.
- Coverage analysis (code, assets, controls), interface testing (UI, network, API), log review (SIEM, clipping level, SoD), synthetic transactions vs RUM, benchmarks (CIS), code review (Fagan, SAST, DAST, IAST, SCA, fuzzing), misuse cases, compliance checks (SCAP).
- 6.3: data on accounts, training, management review, DR/BC tests, KPIs (performance) and KRIs (early risk signal), backup verification through restore tests.
- 6.4: validation and risk-based priority, a report tailored to the audience, remediation with an owner, deadline and retest, exceptions with compensating controls, risk owner approval and an expiration date, responsible (coordinated) disclosure.
- 6.5: internal, external and third-party audits; SOC 1/2/3, Type I vs Type II, CUEC; the audit process from planning to follow-up; in the cloud you rely on attestations.
