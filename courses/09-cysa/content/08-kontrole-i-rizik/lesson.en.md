## Exam objectives: 2.4

- **2.4** Explain concepts related to control types, risks, and vulnerability management: control types (administrative, technical, physical), control functions (preventative, detective, responsive, corrective), risk concepts (risk appetite, inherent, residual), strategies (accept, transfer, avoid, mitigate), policies, governance, and **SLOs**, application security (**SAST**, **DAST**, **SAMM**), and third-party risk (supply chain, **SCA**, **SBOM**).

This objective is conceptual ("Explain"), but CompTIA tests it through scenarios: "what type of control is this", "what is the risk that remains called", "is this accepting or transferring risk". You know a large part of it from the Security+ course (modules 1 and 10) and from the DevSecOps course (SAST, SCA, SBOM). What matters here is learning the **CySA+ terminology**, because it differs from Security+.

## Control types

CySA+ CS0-004 uses three categories. Security+ has four (managerial, operational, technical, physical), so watch the mapping:

| CySA+ type | Security+ equivalent | What it is | Examples |
|---|---|---|---|
| **Administrative** | Managerial + part of operational | Policies, procedures, processes, training, risk management | Vulnerability management policy, risk assessment, security awareness training, background check, change management |
| **Technical** (logical) | Technical | Controls enforced by technology | Firewall, EDR, MFA, encryption, WAF, ACL, SIEM rule |
| **Physical** | Physical | Controls over physical access and the environment | Fence, lock, badge reader, cameras, guard, fire suppression |

> **On the exam:** if the answer options contain only administrative, technical, and physical, policy and training are **administrative**. Don't look for "managerial" or "operational" if they aren't among the options; CySA+ puts them under administrative.

## Control functions

The function tells **when** and **how** a control acts relative to an incident:

| Function | When it acts | Examples |
|---|---|---|
| **Preventative** | Before the incident, prevents it | Firewall rule, MFA, patch, least privilege, input validation, locked door |
| **Detective** | During or after, detects | SIEM correlation, IDS, Wazuh/Sigma/Falco rules (detection lab), FIM, cameras, log review, vulnerability scan |
| **Responsive** | Once the incident is detected, reacts to contain it | SOAR playbook that isolates a host, EDR network containment, automatic IP blocking, IR team |
| **Corrective** | After the incident, restores a correct state and fixes the cause | Restore from backup, reimage, applying a patch after the incident, fixing a wrong rule |

**Responsive** is CySA+-specific: Security+ doesn't have it as a separate category. The difference from corrective: responsive **stops ongoing damage** (containment), corrective **repairs the consequences and the cause** (recovery). EDR host isolation is responsive; reimaging that host and patching are corrective.

A single control can have several functions, and the question asks for the **primary** one. A vulnerability scan is detective (it detects a weakness), and the patch that follows is preventative against future attacks or corrective if the vulnerability has already been exploited.

> **On the exam:** watch the words in the scenario. "Prevent" and "block before" = preventative. "Detect", "notice", "alert" = detective. "Automatically isolate", "contain", "respond" = responsive. "Restore", "recover", "fix after" = corrective.

Combined, every control has a type and a function:

| Control | Type | Function |
|---|---|---|
| Policy requiring patches within 15 days | Administrative | Preventative |
| Quarterly access rights review | Administrative | Detective |
| Incident response plan and call list | Administrative | Responsive |
| WAF rule for a known CVE (virtual patch) | Technical | Preventative |
| Falco rule for a shell in a container | Technical | Detective |
| SOAR playbook that disables a compromised account | Technical | Responsive |
| Database restore from an immutable backup | Technical | Corrective |
| Guard at the data center entrance | Physical | Preventative (and detective) |
| CCTV footage | Physical | Detective |
| Fire suppression system | Physical | Responsive/corrective |

### Compensating controls

From module 7 you know that an unpatched system is protected by a **compensating control**. In CySA+ this is not a separate function in objective 2.4, but a mitigation strategy (2.3). A compensating control must: cover the same risk as the original, be documented, have an owner, and have a review date. PCI DSS even has a formal template for it (Compensating Controls Worksheet).

## Risk concepts

**Risk** = likelihood × impact. In vulnerability management: a threat exploits a vulnerability on an asset.

| Term | Definition | Example |
|---|---|---|
| **Inherent risk** | Risk **before** controls are applied | Public web server with an unpatched RCE, without a WAF or segmentation |
| **Residual risk** | Risk that **remains** after controls | The same server with a WAF and segmentation: lower risk, but not zero (WAF bypass, zero-day) |
| **Risk appetite** | How much risk the organization is **willing** to accept in pursuit of its objectives (strategic, broad) | "We accept moderate risk for faster product launches, but zero tolerance for card data leaks" |
| **Risk tolerance** | Acceptable deviation around the appetite for a specific metric | "Critical findings on exposed systems must not stay open longer than 7 days" |
| **Risk threshold** | The limit beyond which action or escalation is required | "EPSS > 0.1 or KEV automatically goes into the emergency cycle" |

The relationship: inherent − effect of controls = residual. If residual is above the risk appetite, you need more controls (mitigate), transfer, or abandoning the activity (avoid). If it is below, the risk is formally accepted (accept).

> **On the exam:** "the risk that remains after all controls have been implemented" is always **residual risk**. "Risk before controls" is **inherent**. The amount of risk management is willing to bear is **risk appetite**. Residual risk never goes down to zero.

### Quantitative and qualitative

A quick reminder from Security+: **SLE** = AV × EF (asset value × percentage lost), **ALE** = SLE × ARO (annual rate of occurrence). A control makes sense if its annual cost is lower than the reduction in ALE. Qualitatively, risk is expressed with a matrix (Low/Medium/High/Critical), which is more common in practice in vulnerability reports.

Example: a database worth €200,000, an incident would destroy 50% of its value (EF 0.5), expected once every four years (ARO 0.25). SLE = €100,000, ALE = €25,000. A control costing €8,000 a year that reduces ARO to 0.05 brings ALE down to €5,000, so it saves €20,000 at a cost of €8,000: it pays off.

## Risk management strategies

| Strategy | What you do | Example in vulnerability management |
|---|---|---|
| **Mitigate** (reduce) | Reduce likelihood or impact with controls | Patch, WAF rule, segmentation, MFA, CIS hardening |
| **Transfer** (share) | Shift the financial burden to a third party | Cyber insurance, a contract with an MSSP or cloud provider that takes responsibility for part of the stack |
| **Avoid** | Eliminate the activity that creates the risk | Shutting down a legacy FTP service, dropping an integration with an untrustworthy vendor, removing unsupported software |
| **Accept** | Consciously accept the risk without additional measures | Low-risk finding on an isolated system; cost of remediation higher than the potential loss; formal exception signed by the owner |

Important nuances:

- Transfer moves the **financial consequences**, not accountability: if customer data leaks, the regulator and customers still hold you responsible.
- Accept must be **formal and documented** (risk register, owner, deadline, review). Not deciding is not acceptance, it's negligence.
- Avoid is often the cheapest response for unnecessary services: the best patch for an unused service is to turn it off.

> **On the exam:** buying cyber insurance = **transfer**. Shutting down a service or abandoning a project = **avoid**. Applying a patch or WAF = **mitigate**. Management signs off that it knows about the vulnerability and does nothing because the cost is too high = **accept**.

## Risk register

The **risk register** is the central record of risks. For vulnerabilities that can't be remediated right away, an entry looks like this:

| Field | Example |
|---|---|
| ID | RR-2026-041 |
| Description | CVE-2024-XXXX in MRI device firmware, patch awaiting recertification |
| Asset and owner | MR-01, head of radiology |
| Inherent risk | High (CVSS 8.8, internal access, device critical to operations) |
| Controls | Separate VLAN, ACL only toward the PACS server, enhanced monitoring |
| Residual risk | Medium |
| Decision | Accept (exception) until 30 April 2027 |
| Review | Monthly; reassess if the CVE enters KEV |

## Policies, governance, and SLOs

A vulnerability management program rests on documents and roles:

- **Policy**: high level, approved by management: "all systems must be scanned and vulnerabilities remediated within deadlines based on criticality".
- **Standard**: mandatory specific requirements: "internal servers are scanned with a credentialed scan weekly".
- **Procedure**: the steps: how a ticket is opened, who approves an exception.
- **Guideline**: a recommendation, not mandatory.
- **Governance**: who decides and who is accountable. Typically RACI: SecOps scans and prioritizes (Responsible for findings), system owners remediate (Responsible for remediation), the CISO is Accountable for the program, management approves the risk appetite and exceptions above the threshold.

### SLA, SLO, and SLI

| Term | Meaning | Example |
|---|---|---|
| **SLI** (indicator) | The measured value | Time from detection to remediation for each finding |
| **SLO** (objective) | Internal target for the SLI | 95% of critical findings on exposed systems remediated within 7 days |
| **SLA** (agreement) | Contractual obligation to another party, with consequences | An MSP is contractually bound to patch critical vulnerabilities within 72 hours |

Typical internal remediation SLOs (example; each organization defines them in policy):

| Category | Internet-facing | Internal |
|---|---|---|
| KEV or active exploitation | 72 hours | 7 days |
| Critical (CVSS 9.0–10.0) | 7 days | 15 days |
| High (7.0–8.9) | 15 days | 30 days |
| Medium (4.0–6.9) | 30 days | 90 days |
| Low | Next maintenance cycle | Next maintenance cycle |

SLOs are the basis for metrics (compliance percentage, **MTTR**, number of breaches) and for reporting to management (module 11). When a deadline can't be met, an exception is opened, not a silent overrun.

> **On the exam:** an **SLO** is an internal target (e.g., "critical within 15 days"), an **SLA** a contract with consequences. If the question asks what should be defined to measure whether vulnerabilities are remediated fast enough, the answer is a deadline per criticality in the policy, i.e., an SLO.

## Application security

### SAST and DAST

| | **SAST** (Static Application Security Testing) | **DAST** (Dynamic Application Security Testing) |
|---|---|---|
| What it tests | Source code, bytecode, or binary, without running it | The running application, from the outside, like an attacker (black-box) |
| When | Early: IDE, pull request, CI (shift left) | Later: test/staging environment, before release |
| Findings | Exact line of code, SQLi, hardcoded secrets, insecure functions | Runtime vulnerabilities: XSS, misconfigured headers, auth issues, server configuration |
| Weaknesses | More false positives, doesn't see runtime/configuration | Doesn't see code, doesn't cover unexplored paths, slower |
| Tools | Semgrep, SonarQube, CodeQL, Bandit | OWASP ZAP, Burp Suite, Nikto |

Example SAST finding (Semgrep, as in the DevSecOps course):

```
$ semgrep --config p/python app/
  app/db.py
     python.lang.security.audit.formatted-sql-query.formatted-sql-query
        Detected possible formatted SQL query. Use parameterized queries instead.
         14┆ cur.execute(f"SELECT * FROM users WHERE name = '{name}'")
```

Example DAST finding (ZAP baseline scan):

```
WARN-NEW: Content Security Policy (CSP) Header Not Set [10038] x 3
WARN-NEW: Missing Anti-clickjacking Header [10020] x 2
FAIL-NEW: 0	FAIL-INPROG: 0	WARN-NEW: 2	WARN-INPROG: 0	INFO: 4	IGNORE: 0	PASS: 52
```

Related terms: **IAST** (an agent in the application during testing), **RASP** (runtime protection), **fuzzing**. SAST and DAST complement each other: SAST finds the cause in the code, DAST confirms what is actually exposed.

> **On the exam:** "analysis of source code without running it, in the CI pipeline" = **SAST**. "Testing the running application in staging, from the outside" = **DAST**. "Vulnerabilities in third-party libraries" = **SCA**, not SAST.

### SAMM

**OWASP SAMM** (Software Assurance Maturity Model, v2) is a framework for measuring and improving the maturity of secure software development. It doesn't test the application, but the organization's **process**.

| Business function | Security practices |
|---|---|
| **Governance** | Strategy & Metrics, Policy & Compliance, Education & Guidance |
| **Design** | Threat Assessment, Security Requirements, Security Architecture |
| **Implementation** | Secure Build, Secure Deployment, Defect Management |
| **Verification** | Architecture Assessment, Requirements-driven Testing, Security Testing |
| **Operations** | Incident Management, Environment Management, Operational Management |

Five functions, 15 practices, each rated at **maturity levels 1–3** (0 = the practice doesn't exist). The organization performs an assessment, sets a target level per practice, and builds a roadmap. SAMM is **prescriptive** (it says what should be done); BSIMM is **descriptive** (it describes what other organizations do).

## Third-party risk

### Supply chain

A supply chain attack compromises a vendor to reach its customers. Well-known examples: **SolarWinds Orion** (2020, compromised build process), **3CX** (2023, trojanized desktop client), **xz utils** (2024, maintainer backdoor, CVE-2024-3094), **MOVEit** (2023, mass exploitation of a file transfer service at hundreds of organizations).

Controls for vendor risk:

- **Vendor assessment** before the contract: questionnaires (SIG, CAIQ), SOC 2 Type II report, ISO 27001 certificate, penetration test report.
- **Contract clauses**: right-to-audit, incident notification deadlines, SLA for vulnerability remediation, obligation to deliver an SBOM.
- **Continuous monitoring**: tracking vendor advisories, security rating scores, KEV entries for their products.
- **Technical controls**: least privilege for vendor access, dedicated accounts, segmentation, verification of software and update signatures.

### SCA

**SCA** (Software Composition Analysis) identifies open-source and third-party components in an application, their vulnerabilities (CVE, GHSA, OSV), and licenses. In the DevSecOps course you did this with osv-scanner, Trivy, and Dependabot.

```
$ osv-scanner scan source -r .
Scanned /src/app/package-lock.json file and found 412 packages
╭─────────────────────────────────────┬──────┬───────────┬─────────┬─────────┬───────────────────╮
│ OSV URL                             │ CVSS │ ECOSYSTEM │ PACKAGE │ VERSION │ SOURCE            │
├─────────────────────────────────────┼──────┼───────────┼─────────┼─────────┼───────────────────┤
│ https://osv.dev/GHSA-grv7-fg5c-xmjg │ 7.5  │ npm       │ braces  │ 3.0.2   │ package-lock.json │
╰─────────────────────────────────────┴──────┴───────────┴─────────┴─────────┴───────────────────╯
```

Important for the analyst: **transitive dependencies** (dependencies of dependencies) make up most of the code and most of the findings; a vulnerable library isn't necessarily exploitable if the vulnerable function is never called (**reachability**), which is documented through VEX.

### SBOM

An **SBOM** (Software Bill of Materials) is a formal, machine-readable inventory of all software components (name, version, supplier, hash, license, dependencies). Formats: **SPDX** (Linux Foundation, ISO/IEC 5962) and **CycloneDX** (OWASP). The SBOM is accompanied by **VEX** (Vulnerability Exploitability eXchange): the vendor's statement of whether a component is actually affected (`not_affected`, `affected`, `fixed`, `under_investigation`).

```
$ trivy image --format cyclonedx -o sbom.cdx.json app:1
$ jq -r '.components[] | select(.name=="log4j-core") | "\(.name) \(.version)"' sbom.cdx.json
log4j-core 2.14.1
$ trivy sbom -q --severity CRITICAL sbom.cdx.json | grep CVE-2021-44228
│ org.apache.logging.log4j:log4j-core │ CVE-2021-44228 │ CRITICAL │ fixed  │ 2.14.1 │ 2.15.0, 2.3.1, 2.12.2 │ ...
```

The value of an SBOM shows when a new critical CVE comes out: instead of rescanning all systems from scratch, you search the existing SBOMs and within minutes know which applications contain the vulnerable version. As in the DevSecOps course: the SBOM is generated in the pipeline, signed (cosign), and stored alongside the artifact.

> **On the exam:** "how to quickly determine which applications contain a vulnerable library after a new CVE is published" = **SBOM**. "A tool that detects vulnerable open-source dependencies and licenses in CI" = **SCA**. "Assessing a vendor's security before signing a contract" = **third-party / vendor risk assessment**.

### Shared responsibility with cloud and SaaS providers

A cloud provider is also a third party. Who patches what depends on the model (as in the AWS Security course):

| Model | Provider patches | You patch and scan |
|---|---|---|
| **IaaS** (EC2, VM) | Hypervisor, physical hosts | OS, middleware, application, configuration |
| **PaaS** (RDS, App Service, EKS control plane) | OS and platform | Application, configuration, data, access |
| **SaaS** (Microsoft 365, Salesforce) | Almost everything | Account configuration, identities, data sharing |

A scanner reporting a vulnerability in a component managed by the provider doesn't lead to your patch, but to checking the provider's advisory and, if needed, escalating through the contract.

## The exception process in practice

When a vulnerability can't be remediated within the SLO deadline, the policy prescribes a process, not improvisation:

1. **Request** from the system owner: which finding, why it can't be remediated (no patch, vendor certification, business downtime), until when.
2. **Risk assessment** by SecOps: CVSS, EPSS, KEV, context, what an attacker would gain.
3. **Compensating controls**: what is introduced instead of remediation and how it is verified to work.
4. **Approval** at a level that matches the risk: manager for Low/Medium, CISO or management for High/Critical (threshold from the risk appetite).
5. **Entry in the risk register** with an expiration date.
6. **Periodic review**: the exception expires automatically; reassessment if conditions change (e.g., the CVE enters KEV, a public exploit appears).

In the scanner, the finding is then not deleted but marked as "risk accepted" with a reference to the exception, so the metrics stay honest.

## Verifying control effectiveness

A control that exists on paper is not the same as a control that works:

| Method | What it verifies | Example |
|---|---|---|
| **Documentation review** | Whether the control exists and is approved | Patching policy, signed exception |
| **Technical verification** | Whether the control is actually configured | `nft list ruleset` shows the rule; MFA is required for all admin accounts |
| **Testing** | Whether the control stops or detects an attack | BAS test (Atomic Red Team) triggers a Sigma rule; WAF blocks a test payload |
| **Metrics** | Whether the control works consistently over time | Percentage of hosts with an agent, SLO compliance, number of findings per category |
| **Audit** | Independent confirmation | Internal audit, external ISO 27001 or PCI DSS assessor |

Example of a technical check that a compensating control (segmentation) works, from a segment that shouldn't have access:

```
$ nmap -Pn -p 104,11112 10.20.30.15
PORT      STATE    SERVICE
104/tcp   filtered dicom
11112/tcp filtered dicom
```

`filtered` is the desired result here: the MRI device's DICOM services are not reachable from the user network.

## Connecting to other domain 2 objectives

| From 2.4 | Where it's used |
|---|---|
| Risk appetite and SLO | Prioritization thresholds and deadlines (2.3), metrics in reports (4.1) |
| Residual risk and accept | Exceptions and compensating controls (2.3) |
| SAST/DAST/SCA | Sources of findings alongside network scanners (2.1, 2.2) |
| SBOM | Component inventory, supplement to the asset inventory (2.1) |
| Control functions | Classifying measures from the IR process (domain 3): responsive is containment, corrective is recovery |

## Summary

- CySA+ control types: **administrative**, **technical**, **physical** (Security+ managerial/operational are administrative here).
- Functions: **preventative** (prevent), **detective** (detect), **responsive** (react and contain), **corrective** (correct and recover).
- **Inherent risk** is before controls, **residual risk** after; **risk appetite** determines how much residual risk management accepts.
- Strategies: **mitigate**, **transfer** (insurance, but accountability remains), **avoid** (stop the activity), **accept** (formal, documented, with a deadline).
- Policy → standard → procedure; governance defines who is accountable; an **SLO** is the internal remediation deadline per criticality, an **SLA** the contractual one.
- **SAST** tests code without running it, **DAST** the running application from the outside; **OWASP SAMM** measures process maturity through 5 functions and 15 practices, levels 1–3.
- Third-party risk: supply chain attacks (SolarWinds, 3CX, xz utils), vendor assessment and contracts, **SCA** for dependencies, **SBOM** (SPDX, CycloneDX) with **VEX** for fast response to new CVEs.
