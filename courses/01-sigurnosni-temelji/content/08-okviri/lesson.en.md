## Why engineers need frameworks

Frameworks are a common language between engineers, management, auditors and customers. When a customer asks "do you have SOC 2?" or an auditor asks for "evidence for control A.8.8", you need to know what that means and how your pipeline, IAM and logs provide that evidence.

| Framework | Type | Question it answers |
|---|---|---|
| **NIST CSF 2.0** | risk management framework | How do we organize the entire security program? |
| **CIS Controls v8.1** | prioritized list of technical controls | What exactly should we do, and in what order? |
| **ISO/IEC 27001:2022** | certifiable ISMS standard | Do we have a security management system that an independent party can certify? |
| **SOC 2** | independent auditor's report (AICPA) | Can a customer trust our controls? |

## NIST Cybersecurity Framework 2.0

Published in February 2024. It is intended for **all** organizations, not just critical infrastructure. It has **six functions**:

| Function | ID | Essence | DevOps example |
|---|---|---|---|
| **Govern** | GV | strategy, roles, policies, supply chain risk | who owns the cloud account, secrets policy |
| **Identify** | ID | asset inventory, risk assessment | resource inventory, SBOM, data classification |
| **Protect** | PR | protective controls | IAM, MFA, encryption, hardening, training |
| **Detect** | DE | detecting attacks and anomalies | GuardDuty, Defender, SIEM rules, Falco |
| **Respond** | RS | incident response | runbooks, isolation, communication |
| **Recover** | RC | recovery | backup and restore, recovery testing, lessons learned |

**Govern** is new in 2.0 and sits at the center: without clear roles, policies and oversight, the other five functions don't hold together.

Structure: function → **category** (e.g. PR.AA Identity Management, Authentication, and Access Control) → **subcategory** (a specific outcome). The CSF describes **outcomes**, not tools. It's used together with **profiles** (current and target) and **tiers** (1 to 4, risk management maturity).

## CIS Critical Security Controls v8.1

18 controls with a total of 153 *safeguards*, ordered by what reduces risk the most:

| # | Control | # | Control |
|---|---|---|---|
| 1 | Inventory and Control of Enterprise Assets | 10 | Malware Defenses |
| 2 | Inventory and Control of Software Assets | 11 | Data Recovery |
| 3 | Data Protection | 12 | Network Infrastructure Management |
| 4 | Secure Configuration of Enterprise Assets and Software | 13 | Network Monitoring and Defense |
| 5 | Account Management | 14 | Security Awareness and Skills Training |
| 6 | Access Control Management | 15 | Service Provider Management |
| 7 | Continuous Vulnerability Management | 16 | Application Software Security |
| 8 | Audit Log Management | 17 | Incident Response Management |
| 9 | Email and Web Browser Protections | 18 | Penetration Testing |

**Implementation Groups (IG):**

- **IG1**: "essential cyber hygiene", the minimum for every organization (small companies, limited IT staff).
- **IG2**: IG1 + safeguards for organizations with more systems and more sensitive data.
- **IG3**: all safeguards, for organizations targeted by sophisticated attackers.

Version 8.1 added the **Govern** function to the safeguard mapping, to align with NIST CSF 2.0.

> Don't confuse **CIS Controls** (what to do at the organizational level) with **CIS Benchmarks** (detailed settings for a specific system, e.g. Ubuntu 24.04 or EKS). Benchmarks are a way to satisfy control 4.

## ISO/IEC 27001:2022

The international standard for an **ISMS** (Information Security Management System). A company gets **certified** through an external audit; the certificate is valid for 3 years with annual surveillance audits.

- The main body (clauses 4 to 10) requires a **management system**: context, leadership, risk assessment and treatment, measurement, internal audit and continual improvement (Plan-Do-Check-Act).
- **Annex A** has **93 controls** in four themes: organizational (37), people (8), physical (14) and technological (34). The 2022 version added e.g. *threat intelligence*, *cloud services security*, *secure coding*, *data masking* and *configuration management*.
- **Statement of Applicability (SoA)**: a document that states, for each of the 93 controls, whether it applies and why.
- Certificates on the old version (2013) expired at the end of October 2025.

**ISO/IEC 27002** is the companion guide with instructions on how to implement each Annex A control.

## SOC 2

A report (not a certificate) by an independent CPA auditor against the AICPA **Trust Services Criteria**:

| Criterion | Required? |
|---|---|
| **Security** (Common Criteria) | always |
| Availability | optional |
| Processing Integrity | optional |
| Confidentiality | optional |
| Privacy | optional |

- **Type I**: whether controls are **well designed** at a point in time.
- **Type II**: whether controls **actually operated** over a period (usually 3 to 12 months). Customers mostly ask for Type II.

For an engineer, SOC 2 means **evidence**: change logs, approved pull requests, access reviews, evidence of backups and recovery testing, offboarding tickets. Automated evidence collection (tools such as Vanta, Drata, Secureframe) saves months of work.

## Regulations that may affect you

- **GDPR**: protection of EU citizens' personal data; it also applies to companies outside the EU that offer them services. Breach notification within 72 hours.
- **NIS2**: EU cybersecurity directive for "essential" and "important" entities (energy, transport, healthcare, digital infrastructure, cloud providers…), with personal accountability for management and incident reporting deadlines (early warning within 24 hours).
- **DORA**: EU regulation on digital operational resilience for the financial sector and its ICT suppliers, applicable since January 2025.
- **EU Cyber Resilience Act**: security requirements for products with digital elements (hardware and software), including an obligation to report actively exploited vulnerabilities.
- Local information security and data protection laws in Bosnia and Herzegovina, Serbia, Croatia and Montenegro are being aligned with EU rules. For specific obligations, check the current regulation and your legal department.

## How to connect this with everyday work

| Your work | NIST CSF | CIS | ISO 27001 Annex A (example) |
|---|---|---|---|
| Terraform + Checkov in the pipeline | PR | 4, 16 | A.8.9 Configuration management |
| Trivy image scanning | ID | 7 | A.8.8 Management of technical vulnerabilities |
| SSO + MFA + PIM | PR | 5, 6 | A.5.15–A.5.18, A.8.5 |
| CloudTrail to a central log account | DE | 8 | A.8.15 Logging |
| Backup with a restore test | RC | 11 | A.8.13 Information backup |
| Incident runbook | RS | 17 | A.5.24–A.5.28 |

One well-documented technical control provides evidence for several frameworks at once. That's why mature teams maintain **one** list of controls mapped to all the frameworks they must satisfy.

## Summary

- NIST CSF 2.0: six functions; Govern is new and central.
- CIS Controls v8.1: 18 controls, 153 safeguards, IG1 is the mandatory minimum.
- ISO 27001:2022: a certifiable ISMS, 93 controls in Annex A, SoA.
- SOC 2: an auditor's report; Type II proves controls work over time.
- Map your technical work to frameworks once and use it as evidence everywhere.
