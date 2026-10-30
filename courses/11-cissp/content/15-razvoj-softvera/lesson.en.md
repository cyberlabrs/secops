## Exam objectives: Domain 8 (8.1–8.5)

Domain 8 (**Software Development Security**) carries **11.2%** of the exam under the 2027 outline (it was 10% in the 2024 outline). It covers five objectives:

- **8.1 Understand and integrate security in the Software Development Life Cycle (SDLC)**: development methodologies (Agile, Waterfall, DevOps, DevSecOps, Scaled Agile Framework), maturity models (CMM, SAMM), operation and maintenance, change management, **Integrated Product Team (IPT)**, **Secure Software Development Framework (SSDF)** and **Software Bill of Materials (SBOM)** requirements, **shift left**,
- **8.2 Identify and apply security controls in software development ecosystems**: programming languages (memory safe, object-oriented), libraries, tool sets, **Integrated Development Environment (IDE)**, runtime, **CI/CD**, software configuration management (CM), code repositories, application security testing (**SAST**, **DAST**),
- **8.3 Assess the effectiveness of software security**: auditing and logging of changes, risk analysis and mitigation,
- **8.4 Assess security impact of acquired software**: **COTS**, managed services (e.g. enterprise applications), open source (**Software Composition Analysis, SCA**), cloud services (SaaS, IaaS, PaaS, FaaS), third-party,
- **8.5 Define and apply secure coding guidelines and standards**: security weaknesses and vulnerabilities at the source-code level, security of **APIs**, secure coding practices.

Differences from the 2024 outline:

| Objective | 2024 outline | 2027 outline |
|---|---|---|
| 8.1 | No SSDF/SBOM or shift left | Added "SSDF and SBOM requirements" and "Shift left" |
| 8.2 | "Programming languages" without examples; AST includes SAST, DAST, SCA and IAST | Examples "memory safe, object-oriented"; AST only SAST/DAST as examples; SCA moved to 8.4 (open source) |
| 8.4 | Cloud: SaaS, IaaS, PaaS | FaaS added; open source with the SCA example |
| 8.5 | A fourth item "Software-defined security" | Item removed |

As a DevSecOps practitioner you know the tools. CISSP does not ask how you configure Semgrep, but **when** and **why** an organization introduces a control, who is responsible and which decision reduces risk the most at the lowest cost.

> **On the exam:** security is cheapest when built in as early as possible. If a question offers "add security requirements in the requirements/design phase" versus "test before production" or "add a WAF", building it in early is almost always the BEST answer. A WAF and a pentest are compensating or verification controls, not a substitute for secure design.

## 8.1 SDLC: phases and where security goes

ISC2 uses a generic SDLC; phase names vary by source, but the logic is the same:

| Phase | Key activities | Security activity |
|---|---|---|
| **Initiation / concept** | Business need, feasibility study | Initial risk assessment, data classification, regulatory requirements (privacy) |
| **Requirements** | Functional and non-functional requirements | Security requirements, **abuse/misuse cases**, privacy requirements |
| **Design** | Architecture, interfaces | **Threat modeling** (STRIDE, PASTA), attack surface reduction, security design review |
| **Development / coding** | Writing code, unit tests | Secure coding standards, peer code review, SAST, SCA |
| **Testing** | Functional, integration, UAT | DAST, IAST, fuzzing, pentest, verification of security requirements |
| **Implementation / deployment** | Installation, migration | Hardening, **certification & accreditation (authorization)**, secure secrets management |
| **Operation and maintenance (O&M)** | Support, patches, monitoring | Patch management, change management, monitoring, periodic reassessments |
| **Disposal** | Decommissioning the system | Archiving or sanitizing data, revoking accounts and keys |

Two terms the exam likes:

- **Certification**: a technical assessment that the system meets security requirements.
- **Accreditation** (in NIST RMF terminology, **authorization**): a formal management decision (Authorizing Official) to accept the residual risk and approve the system's operation.

> **On the exam:** the decision to go live is not technical but business. Who accepts the system's residual risk? The owner/management through accreditation (authorization), not the testing team and not the CISO on their own.

### The cost of late discovery

The classic rule (Boehm, a 2002 NIST study): fixing a defect found in production costs many times more than in the requirements phase. An illustrative ratio:

| Discovery phase | Relative cost of the fix |
|---|---|
| Requirements / design | 1x |
| Coding | 5x |
| Testing | 10x |
| Production | 30x and more |

Example: if the team finds 40 security defects and the average fix in design costs €200, the cost is €8,000. The same defects in production (30x) would cost €240,000, not counting incident costs. That is the economic argument for **shift left**.

## Development methodologies

| Methodology | Characteristics | Security advantages | Security risks |
|---|---|---|---|
| **Waterfall** | Sequential phases, going back is expensive; detailed documentation | Clear checkpoints (gates) for security review; good for regulated environments | Security is often pushed to the end (test phase); changing requirements is expensive |
| **V-model** | Waterfall where each development phase has a corresponding testing phase | Verification and validation planned from the start | Rigidity |
| **Spiral** (Boehm) | Iterative cycles, each starting with **risk analysis** | Risk is explicit in every iteration | Expensive, requires expertise in risk assessment |
| **Prototyping / RAD** | Rapid prototypes, user feedback | Early validation | The prototype "leaks" into production without hardening |
| **Agile** (Scrum, Kanban, XP) | Short sprints, user stories, Agile Manifesto | Fast reaction to new threats; security as part of the Definition of Done | Less documentation; security drops out of the backlog if it is not the product owner's priority |
| **Scaled Agile Framework (SAFe)** | Agile for large organizations: Agile Release Train, Program Increment, portfolio level | Security as an **enabler** and a non-functional requirement at the portfolio level; alignment of multiple teams | Complexity; security must be represented in planning (PI planning) |
| **DevOps** | Merging development and operations, automation, CI/CD, frequent delivery | Fast patches, infrastructure as code, repeatability | Speed without controls; security seen as a "bottleneck" |
| **DevSecOps** | DevOps + security as a shared responsibility, automated controls in the pipeline | Shift left, continuous testing, policy as code | Requires cultural change and training; false positives can block the pipeline |

In Scrum the exam may mention the roles: **product owner** (prioritizes the backlog, and therefore security stories too), **scrum master** (removes impediments), the development team. Security in Agile is introduced through **security user stories**, **abuse cases**, **security champions** in teams and security criteria in the Definition of Done.

### Integrated Product Team (IPT)

An **IPT** is a multidisciplinary team (development, operations, security, QA, legal, procurement, business owner) assembled around a product throughout its lifecycle. The term comes from the US Department of Defense (Integrated Product and Process Development). The point for the exam: security is a **team member from the start**, not an outside auditor at the end; decisions are made jointly and faster, with clear ownership.

### Shift left

**Shift left** means moving security activities earlier in the SDLC: requirements and threat modeling before code, IDE plugins and pre-commit checks before merge, SAST/SCA in CI before deployment. It does not mean removing later controls: DAST, pentesting and runtime monitoring ("shift right") still exist. The goal is a lower cost of fixing and faster feedback to the developer.

> **On the exam:** if a team discovers the same classes of vulnerabilities late, the BEST solution is systemic: developer training, a secure coding standard and automated checks earlier in the process, not "more pentests". A pentest measures, it does not prevent.

## Maturity models

### Capability Maturity Model (CMM / CMMI)

Developed by the SEI (Carnegie Mellon). Five levels:

| Level | Name (CMM) | CMMI name | Description |
|---|---|---|---|
| 1 | **Initial** | Initial | Ad hoc, chaotic, success depends on individuals |
| 2 | **Repeatable** | Managed | Basic project management, processes are repeated at the project level |
| 3 | **Defined** | Defined | Standardized, documented processes at the organization level |
| 4 | **Managed** | Quantitatively Managed | Processes are measured quantitatively (metrics) |
| 5 | **Optimizing** | Optimizing | Continuous improvement based on metrics |

Trap: in the original CMM, level 2 is "Repeatable" and level 4 is "Managed"; in CMMI, level 2 is "Managed" and level 4 is "Quantitatively Managed". The key jump is between 3 (documented) and 4 (measured).

### Software Assurance Maturity Model (SAMM)

**OWASP SAMM** (version 2) is an open model for assessing and improving the security of software development. Five business functions, each with three security practices, each practice with three maturity levels:

| Business function | Security practices |
|---|---|
| **Governance** | Strategy & Metrics, Policy & Compliance, Education & Guidance |
| **Design** | Threat Assessment, Security Requirements, Security Architecture |
| **Implementation** | Secure Build, Secure Deployment, Defect Management |
| **Verification** | Architecture Assessment, Requirements-driven Testing, Security Testing |
| **Operations** | Incident Management, Environment Management, Operational Management |

A related model is **BSIMM** (Building Security In Maturity Model): descriptive, it describes what organizations **actually do** (a survey), while SAMM is **prescriptive** (what should be done).

| Model | Focus | Type |
|---|---|---|
| CMM/CMMI | Maturity of the development process in general | Prescriptive, levels 1–5 |
| SAMM | Maturity of software security | Prescriptive, open, levels 0–3 per practice |
| BSIMM | Software security | Descriptive (benchmark) |

## SSDF and SBOM requirements

**NIST SP 800-218 Secure Software Development Framework (SSDF)** is a set of high-level practices that fit into any SDLC. Four groups:

| Group | Label | Example practices |
|---|---|---|
| **Prepare the Organization** | PO | Define security requirements, roles, training, secure development environments |
| **Protect the Software** | PS | Protect code from unauthorized modification, verify release integrity (signatures), archive releases |
| **Produce Well-Secured Software** | PW | Threat modeling, reuse of vetted components, code review, testing, secure default settings |
| **Respond to Vulnerabilities** | RV | Identify and analyze vulnerabilities, remediate, root cause analysis |

The SSDF became significant through US Executive Order 14028 (2021) and the requirement that software suppliers to the federal government attest to compliance (secure software development attestation). There is also a profile for generative AI (SP 800-218A).

An **SBOM** is a formal, machine-readable inventory of software components (libraries, versions, licenses, dependencies, provenance). Formats: **SPDX** (Linux Foundation, ISO/IEC 5962) and **CycloneDX** (OWASP). The NTIA defined the minimum elements: supplier name, component name, version, unique identifiers, dependency relationship, SBOM author and timestamp. **VEX** (Vulnerability Exploitability eXchange) complements the SBOM with a statement of whether a known vulnerability in a component is actually exploitable in the product.

Why the SBOM is a management topic: when a critical vulnerability is released in a widely used library (Log4Shell 2021), an organization with SBOMs knows within minutes which systems are affected. Without an SBOM, the assessment takes weeks. The SBOM requirement is written into **procurement contracts** and the development policy; the EU Cyber Resilience Act also requires documented components.

> **On the exam:** an SBOM is a transparency and supply chain risk management control, not a control that remediates vulnerabilities by itself. If a question asks how to "most quickly determine exposure to a new library vulnerability across the entire portfolio", the answer is the SBOM/SCA inventory.

## Operation, maintenance and change management in the SDLC

The **O&M** phase lasts the longest. Security activities: tracking component vulnerabilities, patches, monitoring, periodic reassessments and reauthorization when risk changes significantly.

**Change management** in development ensures that every change is requested, assessed (security impact), approved, tested, documented and that a rollback plan exists. Typical flow:

1. Request for change (RFC),
2. Impact assessment (including security),
3. Approval (Change Advisory Board, CAB, or an automated policy for standard changes),
4. Development and testing in a non-production environment,
5. Implementation in a planned window,
6. Verification and documentation; closing the request.

In DevOps the CAB is often replaced by automated controls (mandatory code review, tests, policy as code, signed artifacts), but the principle remains: **no change without a trail and approval**. Emergency changes are approved afterwards, but are always documented.

## 8.2 Security controls in the development ecosystem

### Programming languages

Language generations (an exam classic):

| Generation | Examples | Description |
|---|---|---|
| 1GL | Machine code | Binary instructions |
| 2GL | Assembly | Mnemonics, architecture-dependent |
| 3GL | C, C++, Java, Python | High level, compiled or interpreted |
| 4GL | SQL, report tools | Close to natural language, declarative |
| 5GL | Prolog, constraint-based systems | Problem solving without an algorithm (AI) |

Compiled languages (C, Go) produce binary code: faster, source code is not distributed, but reverse engineering is still possible. Interpreted languages (Python, JavaScript) are executed directly: the source code is visible. Hybrid languages (Java, C#) compile to bytecode executed by a virtual machine.

**Memory-safe languages** (Rust, Go, Java, C#, Python, Swift) prevent an entire class of memory management errors: buffer overflow, use-after-free, double free. C and C++ are not memory safe. Agencies (CISA, NSA, NCSC) recommend a **memory safety roadmap**: new code in memory-safe languages, and existing C/C++ with compiler protections (stack canaries, ASLR, DEP/NX, CFI) and strict review. Large vendors estimate that about 70% of serious vulnerabilities in their C/C++ codebases are related to memory safety.

**Object-oriented programming (OOP)**: terms the exam asks about:

| Term | Meaning | Security significance |
|---|---|---|
| **Encapsulation** (data hiding) | An object hides internal data, access through methods | Reduces attack surface, controlled access |
| **Inheritance** | A class inherits the properties of its parent | A defect in the parent propagates to the children |
| **Polymorphism** | The same call, different behavior per object | Unpredictable behavior if untested |
| **Polyinstantiation** | Multiple instances of the same object/record with different values per classification level | Prevents inference in MLS databases |
| **Cohesion** (high is good) | How focused a module is on a single task | Easier review and testing |
| **Coupling** (low is good) | How much a module depends on others | Less error propagation |

### Libraries, tools, IDE and runtime

- **Libraries**: most modern code is third-party code. Controls: an approved list of sources (internal registry/proxy), version pinning and lock files, integrity checks (hashes, signatures), SCA, monitoring project maintenance. Risks: **typosquatting**, **dependency confusion**, a project being taken over by a malicious maintainer.
- **Tool sets** (compilers, build tools, scanners): must come from trusted sources and be versioned; a compromised build tool endangers every product (example SolarWinds 2020: a modified build process).
- **IDE**: plugins and extensions have access to code and secrets. Controls: approved extensions, security plugins (lint, real-time SAST, secret detection), managed development endpoints or cloud IDE environments.
- **Runtime**: the execution environment (JVM, .NET CLR, container runtime, interpreter). Controls: a patched runtime, minimal images, sandboxing, least privilege, **RASP** (Runtime Application Self-Protection), which detects and blocks an attack from inside the application.

### CI/CD

| Pipeline stage | Control |
|---|---|
| Commit | Signed commits, pre-commit hooks (secret detection), mandatory review (branch protection) |
| Build | Isolated, ephemeral build agents; reproducible builds; SAST, SCA; SBOM generation |
| Test | DAST/IAST in the staging environment, security requirement tests |
| Artifact | Artifact signing, provenance (e.g. SLSA levels), private registry |
| Deploy | Policy as code (admission controls), separate credentials per environment, separation of duties |
| Runtime | Monitoring, RASP/WAF, drift detection |

The pipeline is a **privileged system**: it has credentials for production. Least privilege for runners, short-lived credentials (OIDC federation instead of static keys), protection of the pipeline configuration as code and separation of duties (a developer cannot approve and release their own code to production alone).

### Software configuration management and code repositories

**Software CM** tracks and controls versions of source code, configurations, dependencies and releases: identification of configuration items, change control, status accounting and configuration audit. It makes it possible to know exactly what is in which release and to rebuild a release.

**Code repositories** (Git): controls are MFA and SSO, least privilege per repository, branch protection and mandatory pull request review, prohibiting force-push to the main branch, secret scanning, an access audit log, backups. Public repositories: the risk of leaking secrets and internal code; secrets are never stored in code, but in a vault.

### Application security testing (AST)

| Technique | What it analyzes | When | Advantages | Limitations |
|---|---|---|---|---|
| **SAST** (white box) | Source code, bytecode, binary code without execution | Early: IDE, CI | Exact location of the defect in code; early detection | False positives; does not see runtime configuration; language-dependent |
| **DAST** (black box) | The running application from the outside (HTTP requests) | Test/staging | Language-independent; finds runtime and configuration errors | Late; does not show the line of code; coverage depends on the crawler |
| **IAST** | An agent inside the running application tracks data flow during tests | Test (QA) | Few false positives, shows the line of code | Requires an agent, supported languages, good tests |
| **SCA** | Third-party components: known vulnerabilities (CVE) and licenses | Build, continuously | Dependency inventory, basis for the SBOM | Only known vulnerabilities |
| **RASP** | An agent in production that blocks attacks | Runtime | Real-time protection | Performance; not a substitute for fixing |
| **Fuzzing** | Unexpected/random inputs | Test | Finds parsing errors, crashes | Requires time and instrumentation |

Other techniques mentioned: **manual code review** (peer review, Fagan inspection as the most formal form), misuse case testing, regression testing after changes.

> **On the exam:** watch for the wording in the question. "Before the application is run", "source code analysis" → SAST. "From the outside, without access to code, running application" → DAST. "Vulnerable library versions and licenses" → SCA. "Blocks an attack in production from within the application itself" → RASP.

## 8.3 Assessing the effectiveness of software security

### Auditing and logging of changes

Effectiveness cannot be proven without a trail. What is logged and audited:

- source code changes (who, what, when, who approved; tied to a ticket/RFC),
- changes to the pipeline configuration, environments and infrastructure as code,
- releases and deployments (which artifact, which hash, which environment),
- access to repositories, secrets and production,
- exceptions to security policies (e.g. a bypassed quality gate) with justification and a deadline.

Logs must be protected from modification (separate system, WORM, central SIEM) and periodically reviewed. A **configuration audit** verifies that the actual state matches the approved one. An unauthorized change discovered by an audit is a sign of process weakness, not just an individual incident.

### Risk analysis and mitigation

Effectiveness assessment links findings to risk:

- **Metrics**: number of vulnerabilities by severity, defect density (defects per KLOC), **mean time to remediate** by severity, percentage of releases passing security gates, coverage by tests and threat models, age of open findings.
- **Severity rating**: CVSS (technical severity) + business impact context + likelihood of exploitation (EPSS, CISA KEV catalog).
- **Treatment decisions**: fix (mitigate), compensating control (WAF rule, isolation), acceptance (formal, by the risk owner, with a deadline), avoidance (removing the feature), transfer (insurance, contract).
- **Acceptance testing and regression**: after the fix, verification that the vulnerability was removed and no new ones were introduced.

Example: an application has a critical SQL injection vulnerability; the fix requires 3 weeks of refactoring. The risk manager's decision: an immediate virtual patch on the WAF and enhanced monitoring (compensation), a formally documented temporary residual risk accepted by the application owner, then a permanent fix in the code with a deadline. The WAF by itself is not the end of the story.

> **On the exam:** risk acceptance is a legitimate decision only if made by the **risk owner** (the business owner), informed and documented. A developer or the security team does not "accept risk" by leaving a finding open.

## 8.4 Security impact of acquired software

Regardless of the source, accountability for the data remains with the organization. Process: define security requirements before procurement → vendor assessment (questionnaires, SOC 2 Type II, ISO/IEC 27001, pentest reports, SBOM) → contractual obligations (SLA, incident notification, right to audit, patch deadlines, escrow) → testing before introduction → continuous monitoring.

| Type | Code visibility | Who patches | Main risks | Key controls |
|---|---|---|---|---|
| **COTS** | None (black box) | The vendor | Vulnerabilities you cannot see, default settings, end of support (end of life), vendor going out of business | Contract, certifications (Common Criteria), hardening, **source code escrow**, testing in isolation |
| **Managed services / enterprise applications** (ERP, CRM) | None | The provider | Data concentration, the provider's privileged access, dependency | SLA, right to audit, independent auditor reports, control of provider access, exit strategy |
| **Open source** | Full | The community (or you) | Unmaintained projects, malicious packages, vulnerable transitive dependencies, licenses (GPL copyleft) | **SCA**, approved registry, project health assessment (OpenSSF Scorecard), SBOM, license policy |
| **Third-party (custom, outsourcing)** | By contract | The vendor per the contract | Code quality, hidden functions (backdoor), code ownership | Contractual security requirements, code review, right to test, IP clauses, escrow |
| **Cloud services** | None | Per the shared responsibility model | Misconfiguration, unclear division of responsibility, data location | Shared responsibility matrix, CSPM, SOC 2/CSA STAR, contract |

**Software escrow**: a third party holds the source code of COTS or custom software; if the vendor goes out of business or stops support, the customer receives the code. It protects availability/continuity, not confidentiality.

### Cloud models and responsibility for software security

| Model | Customer is responsible for | Provider is responsible for |
|---|---|---|
| **IaaS** | OS, middleware, runtime, applications, data, IAM, guest network configuration | Physical infrastructure, hypervisor, network |
| **PaaS** | Application code, service configuration, data, IAM | + OS, runtime, middleware |
| **FaaS** (serverless) | Function code, dependencies, function permissions (IAM role), triggers, data | + runtime and execution environment, scaling |
| **SaaS** | Data, users and their permissions, tenant configuration | Almost everything else, including the application |

With **FaaS** (FaaS was not listed in the 2024 outline) the specific risks are: overly broad function permissions, injection through event data, vulnerable dependencies in the function package, poor visibility for forensics. It all comes down to the same rule: **data and access are always the customer's**.

> **On the exam:** before acquiring software, the first step is to define **security requirements** and perform a vendor assessment (due diligence). "Buy it and then test it" or "rely on the vendor's marketing" is not correct. For continuity when there is a risk of a small vendor going out of business → **escrow**.

## 8.5 Secure coding guidelines and standards

### Weaknesses and vulnerabilities at the source-code level

**CWE** (Common Weakness Enumeration, MITRE) catalogs **weaknesses** (classes of defects), and **CVE** catalogs specific **vulnerabilities** in products. The **CWE Top 25** and **OWASP Top 10** are reference lists. A defensive overview (without exploitation details):

| Weakness class | What the problem is | Primary defense |
|---|---|---|
| **Injection** (SQL, OS command, LDAP) | Untrusted input is interpreted as code/a query | Parameterized queries (prepared statements), allowlist input validation, least privilege database account |
| **Cross-Site Scripting (XSS)** | Untrusted content executes in another user's browser | Context-aware output encoding, Content Security Policy, safe template systems |
| **Cross-Site Request Forgery (CSRF)** | The victim's browser sends an authenticated request without the victim's intent | Anti-CSRF tokens, SameSite cookies, re-authentication for critical actions |
| **Buffer overflow** | Writing outside memory bounds | Memory-safe languages, bounds checking, safe functions, compiler protections (ASLR, DEP) |
| **Broken access control / IDOR** | Missing authorization check on the server | Authorization check for every object on the server side, deny by default |
| **Race condition / TOCTOU** | State changes between check and use | Atomic operations, locking |
| **Insecure deserialization** | Deserializing untrusted objects | Avoid it, signed data, type allowlist |
| **Server-Side Request Forgery (SSRF)** | The server sends requests to a destination chosen by the attacker | Destination allowlist, network segmentation, protection of the metadata service |
| **Hardcoded secrets and weak cryptography** | Keys in code, homegrown algorithms | Vault, vetted libraries, never "roll your own crypto" |
| **Insufficient logging and errors** | Detailed error messages, no trail | Generic messages to the user, detailed logs internally, no sensitive data in logs |

Classic terms that still appear on the exam:

- **Backdoor / maintenance hook / trapdoor**: a hidden entry that bypasses controls, often left by a developer. Defense: code review, removal before production.
- **Logic bomb**: code that activates under a condition (a date, a dismissal).
- **Covert channel** (timing, storage): unauthorized transfer of information through a mechanism not intended for communication.
- **Citizen developers / low-code**: applications outside the formal SDLC, governance is needed.

### API security

The **OWASP API Security Top 10** highlights problems specific to APIs: **Broken Object Level Authorization (BOLA)**, weak authentication, excessive exposure of object properties, unrestricted resource consumption, missing function-level authorization, SSRF, misconfiguration, uninventoried ("shadow"/"zombie") APIs, unsafe consumption of third-party APIs.

Controls:

| Control | Description |
|---|---|
| Authentication | OAuth 2.0 / OIDC tokens, mTLS for service-to-service; API keys only for identification, not as the sole protection |
| Authorization | Object- and function-level checks, on the server, for every request |
| Validation | Schema (OpenAPI), strict input and output validation, rejecting unknown fields |
| Rate limiting and quotas | Protection against abuse and DoS |
| API gateway | A central point for authentication, limits, logging, versioning |
| Inventory | A catalog of all APIs and versions; retiring old ones |
| Transport | TLS everywhere |
| Logging | Who called what, without tokens and sensitive data in the log |

REST vs SOAP: SOAP has the built-in **WS-Security** standard (message-level signing and encryption); REST relies on TLS and token standards (OAuth, JWT).

### Secure coding practices

Sources of standards: **OWASP ASVS** (Application Security Verification Standard, levels 1–3), **OWASP Secure Coding Practices**, **SEI CERT** coding standards (per language), **MISRA** (C/C++ in embedded/automotive systems), **NIST SSDF** (PW practice).

Key practices:

1. **Input validation** on the server, by allowlist (what is allowed), not by denylist; canonicalization before validation.
2. **Output encoding** according to context (HTML, URL, JavaScript, SQL).
3. **Authentication and session management** through vetted frameworks; secure cookies (Secure, HttpOnly, SameSite); session expiration.
4. **Authorization**: deny by default, a check for every request, least privilege.
5. **Cryptography**: standard algorithms and libraries, key management outside the code.
6. **Error handling**: fail secure (fail closed), generic messages, no stack traces to the user.
7. **Logging**: security events, integrity protection, no passwords or personal data.
8. **Data protection**: minimization, encryption of sensitive data, no caching of sensitive content.
9. **Dependency management**: approved, up-to-date, scanned components.
10. **Code review and pair programming**, with checklists tied to the standard.

Design principles (Saltzer and Schroeder) behind the practices: least privilege, fail-safe defaults, economy of mechanism (simplicity), complete mediation (every access is checked), open design (security does not depend on the secrecy of the design), separation of privilege, least common mechanism, psychological acceptability.

> **On the exam:** the most effective defense against injection is a **parameterized query**, not filtering special characters or a WAF. For XSS it is **output encoding** (along with input validation). When a question asks for the "primary" control, choose the one in the code; the WAF is an additional layer.

### Note: software-defined security (2024 outline)

In the 2024 outline, objective 8.5 also had the item **software-defined security**: security controls defined and managed in software (SDN segmentation, policy as code, security groups as code, automated policy enforcement). In the 2027 outline this item was removed, and the content partly overlaps with CI/CD and configuration management (8.2, 7.3).

## Scenarios for practicing your reasoning

**Scenario 1.** An organization is moving from Waterfall to Agile. The security team complains that there is no longer a "security gate" before production. BEST approach: build security into the sprints (security user stories, Definition of Done, a security champion in the team, automated SAST/SCA in CI) instead of bringing back one big gate at the end.

**Scenario 2.** A small vendor offers a cheap specialized COTS system that is key to the business. The biggest risk: the vendor goes out of business. Control: **source code escrow** in the contract, along with an exit strategy.

**Scenario 3.** A critical vulnerability has been published in a popular open source library. What FIRST? Determine exposure through the SBOM/SCA inventory, then prioritize by system criticality and exploitability; only then patch.

**Scenario 4.** An audit shows that developers can deploy directly to production without review. Problem: lack of **separation of duties** and change management. Solution: branch protection, mandatory review by another person, deployment only through the pipeline with approval, logging.

## Summary

- SDLC: security in every phase; cheapest in requirements and design (shift left). Accreditation/authorization = management accepts the residual risk.
- Methodologies: Waterfall (gates, rigid), Spiral (risk analysis in every iteration), Agile (sprints, security in the backlog and DoD), SAFe (Agile at the portfolio level), DevOps/DevSecOps (automation, shared responsibility). IPT = a multidisciplinary team from the start.
- Maturity: CMM 1 Initial, 2 Repeatable, 3 Defined, 4 Managed, 5 Optimizing; SAMM: 5 functions × 3 practices, prescriptive; BSIMM descriptive.
- SSDF (NIST SP 800-218): PO, PS, PW, RV. SBOM (SPDX, CycloneDX) = component inventory, key for responding to supply chain vulnerabilities; VEX complements it.
- Ecosystem: memory-safe languages, OOP terms (encapsulation, polyinstantiation, high cohesion / low coupling), libraries from controlled sources, the pipeline as a privileged system, repositories with branch protection and secret scanning.
- AST: SAST (code, early), DAST (running application from the outside), IAST (agent during testing), SCA (components and licenses), RASP (protection in production), fuzzing.
- Effectiveness: logging and auditing of changes, metrics (MTTR, defect density), risk treatment approved by the risk owner.
- Acquired software: security requirements and due diligence before procurement; COTS (escrow, certifications), open source (SCA, licenses), managed/third-party (contract, right to audit), cloud (shared responsibility; data and access always the customer's; FaaS new in 2027).
- Secure coding: CWE/OWASP; parameterized queries, output encoding, server-side authorization, fail secure; API: object-level authorization, gateway, rate limiting, inventory.
