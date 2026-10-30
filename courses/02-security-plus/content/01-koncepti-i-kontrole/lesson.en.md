## Exam objectives: 1.1 and 1.2

- **1.1** Explain security concepts and controls: core concepts (CIA, AAA, non-repudiation, Zero Trust, least privilege, defense in depth) and the classification of controls by **category** and **type**.
- **1.2** Given a scenario, demonstrate the impact of change management processes on security: how the change process (CAB, backout plan, maintenance window…) and the technical details of a change (restarts, dependencies, allow lists…) affect security.

The exam rarely asks for a pure definition here. Most often you get a short scenario ("a company puts up a sign…", "a change failed in the middle of the night…") and you have to recognize the concept.

## Defense in depth

**Defense in depth** (layered defense) means you don't rely on a single control. If one layer fails, the next one stops the attack, or at least detects it.

A cloud example for a single web application:

| Layer | Example control |
|---|---|
| Perimeter | AWS WAF / Azure Front Door WAF, DDoS protection |
| Network | Security Groups, NSG, Kubernetes NetworkPolicy |
| Host / container | Image hardening, read-only root FS, no root user |
| Application | Input validation, authentication, rate limiting |
| Data | Encryption at rest (KMS), backup, masking |
| People and processes | Training, code review, change management |
| Detection | CloudTrail, Azure Monitor, SIEM alerts |

All the concepts below (CIA, AAA, Zero Trust, least privilege) are pieces of that layered picture.

## CIA triad

| Concept | Meaning | What threatens it | Typical controls |
|---|---|---|---|
| **Confidentiality** | Only authorized parties can see the data | Leaks, sniffing, a public S3 bucket | Encryption, access control, masking |
| **Integrity** | Data has not been modified without authorization | Tampering, MITM, transmission errors | Hashing, digital signatures, versioning |
| **Availability** | Systems and data are available when needed | DDoS, ransomware, hardware failure | Redundancy, auto-scaling, backup, multi-AZ |

> **On the exam:** Hashes and digital signatures are the answer for **integrity**. Encryption is the answer for **confidentiality**. Redundancy, load balancers, and backups are **availability**. If the question says "ensure the data has not been changed", look for a hash, not encryption.

## AAA

**AAA** describes the three steps of access control. They are preceded by **identification** (you claim who you are, e.g., a username).

| Step | English | Question | Example |
|---|---|---|---|
| Authentication | **Authentication** | Prove that you are you | Password + MFA, client certificate, SSH key |
| Authorization | **Authorization** | What are you allowed to do? | IAM policy, Kubernetes RBAC, Azure RBAC role |
| Accounting | **Accounting** | What did you do, and when? | CloudTrail, Azure Activity Log, kube-apiserver audit log |

AAA doesn't apply only to people. The exam distinguishes:

- **Authenticating people**: passwords, MFA, biometrics.
- **Authenticating systems and devices**: certificates (mTLS), 802.1X for devices on the network, workload identity (e.g., IRSA in EKS or Azure Managed Identity).
- **Authorization models** determine who gets which permissions (details are in a later module on IAM).

RADIUS and TACACS+ are the classic **AAA servers** for network gear and VPNs. TACACS+ separates all three A's and encrypts the entire packet; RADIUS encrypts only the password.

> **On the exam:** "How do we know who deleted the resource?" is **accounting**. "The user logged in but can't see the database" is an **authorization** problem, not authentication.

## Non-repudiation

**Non-repudiation** means the sender cannot later credibly deny having sent a message or performed an action.

- It is achieved with a **digital signature**: you sign with a private key only you have, and anyone can verify with the public key.
- A signature provides **integrity** (the message wasn't modified) and **authenticity of origin** at the same time.
- A symmetric key (e.g., HMAC with a shared secret) **does not** provide non-repudiation: both parties hold the same key, so either could have created the message.
- Audit logs help, but they're stronger when protected against modification (WORM storage, a central SIEM).

Example: signed git commits (GPG/SSH signature) or signed container images (Sigstore cosign) prove who produced an artifact.

## Zero Trust principles

**Zero Trust** rejects the idea that "inside the network = trusted". Every request is verified, no matter where it comes from.

Key principles:

- **Never trust, always verify**: every session is authenticated and authorized.
- **Least privilege** and **just-in-time** access.
- **Assume breach**: design as if the attacker is already inside; segment.
- **Continuous evaluation**: identity, device posture, location, risk.

The architecture is split into two planes:

| Plane | English | Components | Role |
|---|---|---|---|
| Control | **Control plane** | **Policy Engine**, **Policy Administrator**, adaptive identity, threat scope reduction, policy-driven access control | Decides whether access is allowed |
| Data | **Data plane** | **Policy Enforcement Point (PEP)**, subject/system, implicit trust zones | Enforces the decision and passes traffic |

- The **Policy Engine** makes the decision (allow/deny) based on policies and signals.
- The **Policy Administrator** executes the decision: establishes or terminates the session, issues a token.
- The **PEP** is the point traffic passes through (proxy, gateway, agent).

DevOps examples: AWS Verified Access, Azure AD Conditional Access, a service mesh with mTLS and authorization policies (Istio `AuthorizationPolicy`).

> **On the exam:** If the question describes the component that **decides**, it's the Policy Engine. If it describes the component that traffic **passes through** and that allows or blocks it, it's the Policy Enforcement Point.

## Least privilege

**Least privilege**: a user, service, or process gets only the permissions required for the job, and only for as long as it needs them.

- An IAM policy with specific actions and resources instead of `"Action": "*"`.
- A Kubernetes ServiceAccount with a minimal Role, no `cluster-admin`.
- Separate admin accounts and on-demand privileged access (PAM, Azure PIM).
- Periodic access reviews to remove **privilege creep** (permissions piling up as roles change).

Related concepts: **separation of duties** (one person cannot complete a sensitive process alone) and **need to know**.

## Control categories

The category answers **HOW** the control is implemented.

| Category | English | Description | Examples |
|---|---|---|---|
| Technical | **Technical / logical** | Enforced by a system, software, or hardware | Firewall, encryption, MFA, antivirus, IAM policy |
| Managerial | **Managerial / administrative** | Decisions, policies, and risk management | Security policy, risk assessment, data classification |
| Operational | **Operational** | Carried out by people in day-to-day work | Employee training, a guard at the entrance, backup procedure, log review |
| Physical | **Physical / environmental** | Restricts physical access or protects the environment | Lock, fence, camera, fire suppression, server room cooling |

The managerial vs. operational distinction often causes confusion:

- **Managerial** = planning and oversight (the policy says "everyone must complete training").
- **Operational** = execution by people (the training itself, the guard, an administrator manually reviewing logs).

## Control types

The type answers **WHAT** the control does, i.e., when it acts relative to an incident.

| Type | English | What it does | Examples |
|---|---|---|---|
| Preventive | **Preventive** | Stops the incident from happening | Firewall rule, MFA, locked door, least privilege |
| Deterrent | **Deterrent** (in the objectives: "Deterring") | Discourages the attacker but doesn't physically stop them | "CCTV in use" sign, warning login banner, lighting |
| Detective | **Detective** | Discovers and records the incident while it's happening or afterward | IDS, SIEM alert, recording camera, audit log |
| Corrective | **Corrective** | Repairs the damage and restores normal operation | Restore from backup, automatic redeploy of a clean pod, post-incident patch |
| Compensating | **Compensating** | A substitute when the primary control isn't possible | An isolated VLAN for a legacy server that can't be patched |
| Directive | **Directive** | Tells people what to do | Policy, standard, SOP, "Staff only" sign |

The same control can have more than one type. A camera is **detective** (it records), and a visible camera is also a **deterrent**. A control always has both a **category** and a **type**: a firewall is *technical + preventive*, training is *operational + directive*, a "CCTV in use" sign is *physical + deterrent*.

> **On the exam:** The key phrase for **compensating** is that the primary control **cannot** be applied (cost, legacy, technical limitation), so something else is introduced that covers the same risk. The key phrase for **corrective** is "after the incident, restoring to a correct state".

> **On the exam:** **Deterrent** vs. **preventive**: a preventive control actually blocks (a lock). A deterrent only reduces motivation (a sign, a visible camera). If the attacker still *can* get through and the control only scares them, it's a deterrent.

### Examples by combination

| Control | Category | Type |
|---|---|---|
| Security Group allowing only port 443 | Technical | Preventive |
| GuardDuty / Defender for Cloud alert | Technical | Detective |
| Lambda that automatically closes a public S3 bucket | Technical | Corrective |
| Login banner "Unauthorized access is prohibited" | Technical | Deterrent |
| Acceptable use policy (AUP) | Managerial | Directive |
| Annual risk assessment | Managerial | Detective (uncovers risks) |
| Guard at the entrance | Operational | Preventive / deterrent |
| Fence around a data center | Physical | Preventive / deterrent |
| Network segmentation around an unpatched OT device | Technical | Compensating |

## Change management

**Change management** is the formal process by which changes to systems are proposed, assessed, approved, tested, implemented, and documented. It matters for security because **uncontrolled changes** are a common cause of incidents: a port opened "temporarily", logging turned off, a forgotten test account.

### Business processes

| Concept | English | Description |
|---|---|---|
| Change board | **Change Advisory Board (CAB)** | The group that reviews and approves changes. Includes IT, security, system owners, the business. |
| Approval process | **Approval process** | Formal steps: request, assessment, approval or rejection. Emergency changes have an expedited path but are still documented. |
| Ownership | **Ownership** | Every change has an owner who is responsible for carrying it out and for the result. |
| Stakeholders | **Stakeholders** | Everyone affected by the change: users, the support team, the business, security. They must be informed. |
| Impact analysis | **Impact analysis** | What can go wrong, which systems and users are affected, what the security risk is. |
| Test results | **Test results** | Evidence that the change was tried in a staging/test environment before production. |
| Backout plan | **Backout planning** | A predefined way to undo the change (rollback) if it fails. |
| Fail forward | **Fail forward** | Instead of reverting, the problem is solved with a new quick fix. |
| Maintenance window | **Maintenance window** | A pre-agreed period with the least impact on users. |
| Standard procedures | **Standard operating procedures (SOPs)** | Documented steps for routine tasks. Repeatable, fewer errors. |

What this looks like in the DevOps world:

- A pull request with mandatory review is a mini **approval process**.
- A CODEOWNERS file defines **ownership**.
- A CI pipeline with tests and security scans provides **test results**.
- `helm rollback`, `kubectl rollout undo`, or switching blue/green back are the **backout plan**.
- A hotfix pushed straight through the pipeline is **fail forward**.
- A runbook in the wiki is an **SOP**.

> **On the exam:** The **backout plan** is created **before** the change. If the question asks what you should have ready in case the change fails, the answer is a backout plan, not an "incident response plan". **Fail forward** is the decision not to revert but to move ahead with a fix, usually when rollback isn't possible or is riskier (e.g., a database migration that has already changed the schema).

### Technical implications

| Concept | English | What to watch for |
|---|---|---|
| Allow/deny lists | **Allow lists / deny lists** | A new application or version may be blocked by an existing allow list (application allow list, firewall, egress rules). Update them as part of the change. |
| Restricted activities | **Restricted activities** | The change should do only what was approved. Extra "while we're at it" changes are not allowed. |
| Downtime | **Downtime** | Plan it and announce it. Unplanned downtime is a hit to availability. |
| Service restart | **Service restart** | A restart can drop sessions, lose in-memory state, or reveal that the service won't start. |
| Application restart | **Application restart** | The application may lose unsaved configuration or revert to default settings. |
| Legacy applications | **Legacy applications** | Old systems often don't support newer protocols (e.g., TLS 1.2+) and have no documentation. Higher risk of breakage. |
| Dependencies | **Dependencies** | Changing one service can break another (a library, API version, DNS record, certificate). Map them in the impact analysis. |

### Documentation and versioning

- **Updating diagrams**: network and architecture diagrams must reflect the actual state. An outdated diagram leads to wrong decisions and slower incident response.
- **Updating policies/procedures**: if a change alters how work is done, update policies, SOPs, and runbooks.
- **Version control**: all configurations, IaC (Terraform, Bicep), Helm charts, and policies in git. It gives you a history of who changed what, plus the ability to diff and revert. It's also audit evidence.

> **On the exam:** If the scenario is "after the change nobody knows what the network looks like now" or "the incident team used an outdated map", the answer is **updating diagrams / documentation**. If the problem is "we don't know which configuration version worked", the answer is **version control**.

### A typical change flow

1. A request for change (RFC) with a description and an owner.
2. **Impact analysis** and risk assessment.
3. Testing in a non-production environment, attaching **test results**.
4. Preparing the **backout plan**.
5. **CAB approval**.
6. Implementation during the **maintenance window**, with stakeholders notified.
7. Post-change verification.
8. Updating documentation, diagrams, and versions.

## Example: a change through the entire process

Scenario: the team must replace a TLS certificate and disable TLS 1.0/1.1 on a public API gateway.

| Step | What is done | Security reason |
|---|---|---|
| Request and **ownership** | A change request is opened; the owner is the platform team | Clear accountability |
| **Impact analysis** | Check who still uses TLS 1.0 (old mobile clients, a partner's legacy system). Map **dependencies**: DNS, the certificate on the CDN, health checks | Disabling old versions can break **legacy applications** |
| **Test results** | The change is tried in staging, with client tests and a TLS configuration scanner | Evidence the change works |
| **Backout plan** | The old listener and certificate are kept; rollback is a single command in the pipeline | Fast return if something breaks |
| **CAB approval** | The CAB approves on the condition that the partner is notified in advance | **Stakeholders** are involved |
| **Maintenance window** | Tuesday 02:00–03:00 | Least impact on users |
| Implementation | Only approved changes (**restricted activities**), monitoring for errors after the gateway's **service restart** | No unplanned **downtime** |
| Documentation | Updated diagram, an SOP for certificate rotation, a commit in git | **Version control** and **updated diagrams/procedures** |

If the partner reports a problem after the change, the team chooses between **backout** (temporarily re-enable TLS 1.0 with a compensating control) and **fail forward** (help the partner move to TLS 1.2 right away). The decision is documented.

## Classifying a control in two steps

1. **Who or what enforces it?** A system → *technical*. A document or management decision → *managerial*. A person in day-to-day work → *operational*. A physical object or the environment → *physical*.
2. **When and how does it act?** Before the incident and blocks → *preventive*. Before, and only scares → *deterrent*. During or after, discovers → *detective*. After, repairs → *corrective*. In place of an impossible primary control → *compensating*. Tells you what to do → *directive*.

Example: "A Kubernetes admission controller (Kyverno) rejects a pod that requests `privileged: true`" → enforced by a system (*technical*), blocks before it happens (*preventive*). "A policy that all pods must have resource limits" → a document (*managerial*), tells you what to do (*directive*).

## Summary

- **Defense in depth**: multiple layers of controls; no single layer is enough on its own.
- **CIA**: encryption = confidentiality, hash/signature = integrity, redundancy/backup = availability.
- **AAA**: authentication (who you are), authorization (what you may do), accounting (what you did). **Non-repudiation** comes from a digital signature.
- **Zero Trust**: never trust, always verify. The Policy Engine decides, the PEP enforces.
- A control has a **category** (technical, managerial, operational, physical) and a **type** (preventive, deterrent, detective, corrective, compensating, directive).
- **Compensating** = a substitute when the primary control isn't feasible. **Deterrent** only discourages.
- Change management: **CAB**, **impact analysis**, **test results**, a **backout plan** before the change, **maintenance window**, **SOP**.
- Technical consequences of a change: restarts, downtime, dependencies, legacy, allow lists. Always update diagrams, policies, and **version control**.
