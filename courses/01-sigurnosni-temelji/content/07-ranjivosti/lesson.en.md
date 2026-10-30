## The problem: too many findings

The first scan of containers or a server fleet usually returns **thousands** of findings. Tens of thousands of new CVEs are published every year, and only a small percentage are ever exploited in real attacks. Vulnerability management isn't "fix everything", it's **fix first what will actually hit you**.

The cycle:

1. **Inventory**: what do you have (hosts, images, packages, SBOM)?
2. **Discovery**: scanners (Trivy, Grype, Inspector, Defender, Qualys…).
3. **Prioritization**: CVSS + EPSS + KEV + the context of your environment.
4. **Remediation**: patch, upgrade, configuration change or compensating control.
5. **Verification and metrics**: rescanning, MTTR, SLA compliance.

## CVE and CWE

| | CVE | CWE |
|---|---|---|
| What it is | a **specific** vulnerability in a specific product | a **type** of weakness |
| Example | CVE-2021-44228 (Log4Shell in Log4j) | CWE-89 (SQL injection), CWE-79 (XSS) |
| Maintained by | CVE Program (MITRE + CNA organizations) | MITRE |

**NVD** (NIST) adds CVSS scores and CPE product identifiers. Since 2024 the NVD has had a processing backlog, so other sources are increasingly used: the vendor's own scores (CNA), the GitHub Advisory Database, OSV.dev, CISA Vulnrichment.

## CVSS 4.0

**CVSS** (Common Vulnerability Scoring System, FIRST) rates **severity** from 0 to 10. Version 4.0 was published in November 2023. Many sources and tools still show 3.1, so always check which version accompanies the number.

| Metric group | What it measures | Who sets it |
|---|---|---|
| **Base** | properties of the vulnerability itself | vendor / NVD |
| **Threat** (*Temporal* in 3.1) | whether an exploit exists (`E`) | user / threat intel |
| **Environmental** | the system's importance to you, compensating controls | you |
| **Supplemental** | additional context (Safety, Automatable, Recovery…), does **not** change the score | vendor / you |

Key Base metrics in 4.0:

- **AV** (Attack Vector): Network, Adjacent, Local, Physical
- **AC** (Attack Complexity) and the new **AT** (Attack Requirements)
- **PR** (Privileges Required), **UI** (User Interaction: None, Passive, Active)
- Impact on the **vulnerable system** (VC, VI, VA) and separately on **subsequent systems** (SC, SI, SA). This replaced the vague "Scope" from 3.1.

Score names: **CVSS-B** (Base only), **CVSS-BT** (Base + Threat), **CVSS-BE**, **CVSS-BTE**.

| Score | Severity |
|---|---|
| 0.1 – 3.9 | Low |
| 4.0 – 6.9 | Medium |
| 7.0 – 8.9 | High |
| 9.0 – 10.0 | Critical |

> **CVSS measures severity, not risk.** A CVSS 9.8 in a library your code never calls, on a system without network access, is less urgent than a CVSS 7.5 on an internet-facing VPN appliance that is being actively attacked.

## EPSS

**EPSS** (Exploit Prediction Scoring System, FIRST) gives **the probability (0 to 1) that a CVE will be exploited in real attacks within the next 30 days**. Scores are published daily for every CVE. The current model is **EPSS v4**, released on March 17, 2025.

- The **score** is an absolute probability, e.g. 0.153 = 15.3%.
- The **percentile** shows where the CVE sits relative to all others. A score of 10% is already around the 88th percentile, because most CVEs have a very low probability.
- Show both: "15.3% (92nd percentile)".

EPSS answers the question **"will anyone attack this?"**, and CVSS the question **"how bad would it be?"**. You need both.

## CISA KEV

The **Known Exploited Vulnerabilities** catalog (CISA) contains CVEs for which there is **evidence of active exploitation**. US federal agencies must patch them within a set deadline, and for everyone else it is the strongest priority signal. The `knownRansomwareCampaignUse` field marks use in ransomware campaigns.

If a CVE is in KEV and the system is exposed, it's not something for the next sprint.

## Prioritization in practice

A simple, defensible logic:

| Priority | Condition | Example SLA |
|---|---|---|
| **P1** | in KEV, **or** EPSS ≥ 0.1 on an internet-facing system | 48h – 7 days |
| **P2** | CVSS ≥ 7 and (exposed **or** EPSS ≥ 0.01) | 30 days |
| **P3** | CVSS ≥ 7, internal system, low EPSS | 90 days |
| **P4** | everything else | regular update cycle |

The thresholds are an example. Every company tunes them to its risk appetite. There is also a more formal model, **SSVC** (Stakeholder-Specific Vulnerability Categorization, CISA), which walks you through a decision tree: exploitation, automatability, technical impact, mission.

Context only you know:

- Is the vulnerable package even **loaded and reachable** (reachability)?
- Is the system exposed to the internet?
- What data is on the system and how business-critical is it?
- Are there compensating controls (a WAF rule, a disabled feature)?

## SBOM and VEX

- **SBOM** (Software Bill of Materials): a list of all components and versions in an artifact. Formats: **CycloneDX** and **SPDX**. Tools: Syft, Trivy, `docker sbom`. When a new critical CVE comes out, the SBOM answers "where do we have this?" in a minute instead of a week.
- **VEX** (Vulnerability Exploitability eXchange): a vendor statement on whether a CVE actually affects the product: `not_affected`, `affected`, `fixed`, `under_investigation`, with a justification (e.g. `vulnerable_code_not_in_execute_path`). VEX reduces false positives in scanner reports.

## Containers and cloud

- A smaller image means fewer packages and fewer CVEs: distroless, Alpine, `-slim` variants, multi-stage builds.
- Rebuild the image regularly, not just when you change code: the base image receives patches.
- Scan in CI (fail on KEV or critical vulnerabilities that have a fix) **and** in the registry, because new CVEs show up for old images.
- Managed services (RDS, Lambda runtimes) shift part of the patching to the provider (*shared responsibility*).

## Metrics

- **MTTR** (mean time to remediate) per priority.
- Percentage of findings remediated within SLA.
- Number of exposed systems with KEV vulnerabilities. This number should constantly trend toward zero.
- Age of the oldest open P1/P2 finding.

## Summary

- A CVE is a specific vulnerability, a CWE a type of weakness.
- CVSS is severity, EPSS the probability of attack, KEV evidence of attack. Context decides.
- An SBOM tells you where the vulnerable component is, and VEX whether it's actually vulnerable.
- Measure MTTR and SLA, not the number of findings.
