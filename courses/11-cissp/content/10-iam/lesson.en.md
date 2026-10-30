## Exam Objectives: Domain 5 (5.1–5.6)

Domain 5 is **Identity and Access Management (IAM)** and carries **13.6%** of the exam under the 2027 outline (13% in the 2024 outline). Objectives:

- **5.1 Manage physical and logical access to assets (e.g., provision, control, review, revoke)**
  - information, applications, systems, services, devices, identities, facilities.
- **5.2 Design identification and authentication strategy (e.g., people, devices, and services)**
  - groups and roles,
  - Authentication, Authorization, Accounting (AAA),
  - session management,
  - registration, proofing, and establishment of identity,
  - Federated Identity Management (FIM),
  - credential management systems (e.g., password vault),
  - Single sign-on (SSO),
  - Just-In-Time,
  - passwordless authentication (FIDO, WebAuthn, passkeys, biometrics).
- **5.3 Federated identity with a third-party service**: on-premises, hybrid, cloud.
- **5.4 Implement and manage authorization mechanisms**
  - RBAC, ABAC, Rule-based (RuBAC), Risk-Adaptable Access Control (RAdAC), MAC, DAC,
  - access policy enforcement (policy decision point, policy enforcement point).
- **5.5 Manage the identity and access provisioning lifecycle**
  - account access review (user, system, service),
  - provisioning and deprovisioning (on/offboarding, transfers),
  - role definition and transition,
  - privilege escalation (administrator groups/sudo, usage auditing, Principle of Least Privilege),
  - service accounts management.
- **5.6 Implement authentication and authorization systems**.

> In the 2024 outline, objective 5.1 reads "Control physical and logical access to assets" and has no **identities** sub-item; passwordless is not a separate sub-item but an example under AAA (together with MFA); 5.4 lists "Rule-based" and "Risk-based access control" (instead of RuBAC and RAdAC); in 5.5, privilege escalation mentions only sudo and auditing, without PoLP; and 5.6 is only "Implement authentication systems", without authorization.

You know the mechanics from AWS IAM, Kubernetes RBAC and Entra/Okta practice. The CISSP asks for the classic concepts (identification vs authentication, factors, FRR/FAR/CER, Kerberos, access control models) and the management view: who approves, who reviews, when access is revoked.

## Basic Concepts and Authentication Factors

The access chain: **identification** (a claim of identity, e.g., a username) → **authentication** (proof) → **authorization** (what the subject may do) → **accounting/auditing** (recording) → **accountability** (a person answers for their actions, which requires unique identities and log integrity).

| Factor | Type | Examples |
|---|---|---|
| **Something you know** | Type 1 | password, PIN, answer to a question |
| **Something you have** | Type 2 | smart card, hardware key, TOTP app, phone |
| **Something you are** | Type 3 | fingerprint, iris, face, palm geometry |
| Somewhere you are | context | location, IP, geofencing |
| Something you do | context | keystroke dynamics, signature |

**MFA** requires factors of **different types**. A password plus a PIN are two factors of the same type, so that is not MFA.

### Biometrics and Errors

| Metric | Meaning |
|---|---|
| **FRR** (False Rejection Rate), **Type I** error | a legitimate user is rejected (inconvenience) |
| **FAR** (False Acceptance Rate), **Type II** error | an unauthorized person is accepted (security risk) |
| **CER / EER** (Crossover / Equal Error Rate) | the point where FRR = FAR; **lower CER = more accurate system** |

Example: system A has a CER of 2%, system B 0.5%. To compare accuracy, choose B. Increasing sensitivity reduces FAR but increases FRR. For a bank vault a higher FRR is acceptable; for the cafeteria entrance a lower one.

Other biometric concepts: **enrollment** (registration, time and number of attempts), **throughput** (how fast a person gets through, acceptable ~6–10 s), user acceptance (retina scanning is invasive and reveals health information), template protection, because biometrics cannot be changed like a password.

> **On the exam:** the question "which biometric system is the MOST ACCURATE" is answered by comparing CER, not FAR or FRR individually. And if the question asks for the worst error from a security standpoint, that is Type II (FAR).

## Managing Physical and Logical Access to Assets (5.1)

The 2027 outline explicitly lists the access lifecycle: **provision → control → review → revoke**. It applies to all asset types:

| Asset | Access control example | Typical gap |
|---|---|---|
| **Information** | classification, ACLs on data, DLP, encryption with key control | shared links without expiration |
| **Applications** | SSO, in-application roles, object-level authorization | local accounts bypassing SSO |
| **Systems** | PAM, jump host, controlled local admin accounts (LAPS) | shared root |
| **Services** | service accounts, API keys, workload identity | long-lived keys in code |
| **Devices** | device certificate, MDM, 802.1X | unknown devices on the network |
| **Identities** | managing the identities themselves: lifecycle, privileged and non-human identities, IdP protection | abandoned (orphan) identities owned by no one |
| **Facilities** | badges, mantrap, guards, CCTV, zones | a former employee's badge still works |

Physical access: **mantrap / access control vestibule** (prevents tailgating and piggybacking), proximity cards, guards, entry logs. Logical and physical access should be linked: when HR terminates an employee, both the accounts and the badge are disabled (converged IAM).

Principles that apply everywhere: **need to know** (access to information only if it is required for the job), **least privilege** (minimum rights), **separation of duties**, **default deny**.

## Identification and Authentication Strategy (5.2)

### Groups and Roles

A **group** is a set of subjects that are assigned the same rights (an administrative convenience). A **role** represents a business function and the bundle of rights needed for it. Roles should be defined from business processes (role engineering), not by copying an existing user's rights ("give him the same as Marko"), which leads to **privilege creep**.

### AAA

**Authentication, Authorization, Accounting**. Centralized AAA protocols:

| Protocol | Transport | Encryption | AAA | Use |
|---|---|---|---|---|
| **RADIUS** | UDP 1812/1813 | password only | authentication and authorization combined | network access, VPN, Wi-Fi (802.1X) |
| **TACACS+** | TCP 49 | entire payload | separated | network device administration, per-command authorization |
| **Diameter** | TCP/SCTP | TLS/IPSec | more advanced successor to RADIUS | mobile networks (4G/5G), roaming |

### Session Management

- **Session timeout** (absolute) and **idle timeout** (inactivity); shorter for privileged sessions.
- Secure session tokens: random, sufficiently long, over TLS, cookies with `Secure`, `HttpOnly`, `SameSite`; a new session after login (protection against **session fixation**).
- **Re-authentication** for sensitive actions (step-up).
- Limiting concurrent sessions; central session revocation when an account is disabled or compromised.
- Screen locking on the endpoint.

### Registration, Proofing, and Establishment of Identity

**Identity proofing** proves that a person is who they claim to be, before credentials are issued. NIST SP 800-63 defines levels:

| Level | What it means |
|---|---|
| **IAL** (Identity Assurance Level) 1–3 | strength of identity proofing at registration (from self-assertion to in-person or supervised remote document verification) |
| **AAL** (Authenticator Assurance Level) 1–3 | strength of authentication (AAL2: MFA; AAL3: hardware, phishing-resistant authenticator) |
| **FAL** (Federation Assurance Level) 1–3 | strength of the federation assertion (signing, encryption, key binding) |

Procedures: checking an ID document, comparing with a photo, **knowledge-based authentication** (questions from credit history, increasingly weak due to data breaches), verification through a known channel. For employees, the HR hiring process (background check) is the basis for issuing an identity.

### Credential Management

- **Password vault / password manager**: for users' personal passwords; a **PAM vault** for privileged accounts with check-out/check-in, automatic rotation and session recording.
- A **secrets manager** for machine secrets (API keys, DB passwords) with rotation.
- Password policy per NIST SP 800-63B: length over complexity, checking against a list of compromised passwords, **no periodic forced changes** (except on suspected compromise), no hint questions.
- Passwords are stored as a **salted hash** with a slow algorithm (bcrypt, scrypt, Argon2, PBKDF2).

### SSO and Just-In-Time

**SSO** allows a single login for multiple systems. Advantages: fewer passwords, central deactivation, better experience. Drawback: a compromised SSO account opens everything, so SSO is **always paired with strong MFA**. Classic SSO mechanisms: **Kerberos** (on the LAN), **SESAME** (an extension of Kerberos with asymmetric cryptography), federation (SAML, OIDC) for the web.

**Just-In-Time** has two meanings:

- **JIT access (privileges)**: a privilege is granted on request, for a limited time, with approval, and is revoked automatically. The goal is **zero standing privileges**.
- **JIT provisioning**: an account in the application (SP) is created automatically at the first federated login, based on attributes from the SAML assertion or OIDC token.

### Passwordless Authentication

| Term | Description |
|---|---|
| **FIDO2** | a FIDO Alliance standard; consists of **WebAuthn** (W3C, browser API) and **CTAP** (protocol between the browser and the authenticator) |
| **WebAuthn** | the site (relying party) registers a public key; at login the authenticator signs a challenge with the private key; the key is bound to the domain (origin), so it is **phishing-resistant** |
| **Passkeys** | FIDO credentials that can be synchronized across the user's devices (synced) or bound to a device (device-bound, hardware key) |
| **Biometrics** | most often locally unlocks the private key on the device; the biometric data never leaves the device |
| **Magic link, push** | passwordless, but not phishing-resistant at the FIDO level (push fatigue) |

No password is transmitted or stored on the server, so there is nothing to leak from the database. The risk moves to account recovery, which must be as strong as the login itself.

> **On the exam:** when a scenario requires **phishing-resistant** authentication for administrators or for AAL3, the answer is a FIDO2/WebAuthn hardware key, not SMS OTP or a push notification. SMS is the weakest second factor (SIM swap, interception).

## Kerberos

A classic SSO protocol (MIT, Active Directory). It uses **symmetric cryptography** and a trusted third party, the **KDC** (Key Distribution Center), which contains the **AS** (Authentication Service) and the **TGS** (Ticket Granting Service).

1. The client sends a request to the AS (with a timestamp encrypted with a key derived from the password, pre-authentication).
2. The AS returns a **TGT** (Ticket Granting Ticket), encrypted with the KDC's key, and a session key.
3. When it needs a service, the client sends the TGT and an authenticator to the TGS.
4. The TGS returns a **service ticket** encrypted with the service's key.
5. The client presents the service ticket to the service, the service decrypts it with its own key and lets the client in.

| Property | Consequence |
|---|---|
| the password is not sent over the network | protection against eavesdropping |
| timestamps in tickets | **time synchronization** (NTP) is critical, typical tolerance 5 min |
| the KDC is a central point | **single point of failure** and the most valuable target; redundant KDCs, physical and logical protection |
| tickets in client memory | risk of ticket theft (pass-the-ticket); defense: endpoint protection, short ticket lifetime, Credential Guard |
| service account keys derived from passwords | weak service account passwords put tickets at risk; long, rotated passwords or managed service accounts |

## Federation with a Third Party (5.3)

**Federated Identity Management (FIM)** is trust between domains: the **IdP** (Identity Provider) authenticates the user, and the **SP/RP** (Service Provider / Relying Party) trusts its assertion. The user does not get a new account with a password at every application.

| Standard | Format | Purpose | Note |
|---|---|---|---|
| **SAML 2.0** | XML assertions, signed | **authentication and attributes** for enterprise web SSO | roles: principal, IdP, SP; SP-initiated and IdP-initiated flow |
| **OAuth 2.0** | access token (often JWT) | **delegated authorization** (an application accesses a resource on the user's behalf) | **not an authentication protocol**; grant types: authorization code (+PKCE), client credentials, device code |
| **OIDC** (OpenID Connect) | ID token (JWT) over OAuth 2.0 | **authentication** on top of OAuth, modern and mobile applications | UserInfo endpoint, scopes |
| **WS-Federation** | XML | older Microsoft federation | — |
| **SCIM** | REST/JSON | **provisioning** of accounts and groups between IdP and SP | solves deprovisioning in SaaS |
| **XACML** | XML | authorization policy language (PDP/PEP) | ABAC |
| **SPML** | XML | older provisioning standard | replaced by SCIM |

### Deployment Models

| Model | Description | Security concerns |
|---|---|---|
| **On-premises** | IdP in your own data center (AD FS, Shibboleth), federation toward partners | full control, but you maintain availability and patching; IdP exposed to the internet |
| **Cloud** | IDaaS (Entra ID, Okta, Ping) | trust in the provider, SLA, data location, the provider is a target (supply chain), exit strategy |
| **Hybrid** | on-prem AD synchronized with a cloud IdP (sync agent, pass-through or federation) | the synchronization service and its credentials are privileged; inconsistency between directories; a compromised on-prem AD spreads to the cloud |

Management requirements for federation with a third party: a contract with defined responsibilities, attribute and role mapping, an account deactivation process (deprovisioning through SCIM), logging on both sides, right to audit, a plan for IdP outage (break-glass accounts that do not depend on federation).

> **On the exam:** if a question describes "an application needs to access the user's calendar without knowing their password", the answer is OAuth (delegation). If it asks for "SSO into a partner's web application for employees, enterprise, XML", the answer is SAML. If it asks for "user authentication in a mobile application via an existing account", the answer is OIDC.

## Authorization Mechanisms (5.4)

| Model | Who decides | Decision basis | Example | Advantage / drawback |
|---|---|---|---|---|
| **DAC** (Discretionary) | **object owner** | ACLs set by the owner | NTFS permissions, sharing a file in Drive | flexible; susceptible to Trojans and owner mistakes |
| **MAC** (Mandatory) | **the system**, according to policy | **labels** (object classification) and subject **clearance**, plus need to know (categories/compartments) | military systems, SELinux | strongest, centralized; rigid and expensive |
| **RBAC** (Role-based) | administrator | role (business function) | HR role, Kubernetes Role | scalable, supports SoD; "role explosion" |
| **RuBAC** (Rule-based) | administrator | global rules that apply to all subjects | firewall ACL, "access only on weekdays 8 a.m.–4 p.m." | simple; does not distinguish between users |
| **ABAC** (Attribute-based) | policy | attributes of subject, object, action and environment | "a physician from department X may read patient records of department X from a managed device" | most granular, contextual; complex to maintain and audit |
| **RAdAC** (Risk-Adaptable) | real-time policy | assessment of **risk** and operational need at the time of the request | step-up MFA or denial for an unusual location, risky sign-in | dynamic; depends on signal quality |

Additionally: **content-dependent** (decision based on content, e.g., a database view hides the salary column), **context-dependent** (based on context: time, location, sequence), **non-discretionary** (centrally managed, often equated with RBAC), **lattice-based** (upper and lower bound, MAC).

Watch the abbreviation: on the exam "RBAC" almost always means role-based; rule-based is written out in full or as RuBAC.

### PDP and PEP

Per XACML and NIST SP 800-207 (Zero Trust):

| Component | Role |
|---|---|
| **PEP** (Policy Enforcement Point) | intercepts the request and enforces the decision (gateway, proxy, application, sidecar) |
| **PDP** (Policy Decision Point) | evaluates the policy and makes the allow/deny decision; in 800-207 it consists of the **Policy Engine** and the **Policy Administrator** |
| **PIP** (Policy Information Point) | attribute sources (directory, EDR status, threat intel) |
| **PAP** (Policy Administration Point) | where policies are written and managed |

Separating the decision from enforcement enables central policy and consistency across many PEPs.

> **On the exam:** "the data owner alone determines who has access" is DAC. "The system compares the sensitivity label and the clearance, and the user cannot change it" is MAC. "Rights depend on the job position, and on transfer only the role changes" is RBAC. "The decision takes into account attributes of the user, resource and environment" is ABAC. "The decision changes according to the current risk assessment" is RAdAC.

## Identity and Access Lifecycle (5.5)

### Provisioning and Deprovisioning

- **Onboarding**: a request from HR (the source of truth), approval by the manager and the data owner, role assignment, training and signing the AUP before access.
- **Transfer**: assigning the new role **and removing the old one**. A failure here is the main source of **privilege creep** (aggregation).
- **Offboarding**: revoking access **at the moment** of departure, and for involuntary termination **before or at the same time** as the employee is notified. Return of equipment and badge, transfer of data ownership, keeping the account disabled rather than immediately deleted, for audit and data reasons.
- Automation through IGA (Identity Governance and Administration) and SCIM reduces errors and orphan accounts.

### Role Definition and Transition

Roles are defined by business function, with a role owner. When a person takes on a new role (promotion, temporary replacement, reorganization), a transition period should be defined, rights that are no longer needed removed, and it should be verified that the combination of old and new rights does not violate **separation of duties** (e.g., the same person creates a vendor and approves payment).

### Access Review

| Account type | What is checked |
|---|---|
| **User** | whether the user still needs each right; recertification by the manager and data owner |
| **System** | local and administrator accounts on systems, default accounts |
| **Service** | service accounts, their owner, privileges, usage, credential age |

Frequency based on risk: privileged accounts more often (quarterly), others annually or upon change. The review is performed by the **data owner / manager** (who knows what is needed), not by the IT staff who granted the rights. Inactive accounts (e.g., 90 days) are disabled.

### Privilege Escalation

- **Principle of Least Privilege (PoLP)**: daily work with a standard account; administrator rights only when needed, through a **separate admin account**, `sudo` or JIT/PAM, never through permanent membership in Domain Admins.
- **sudo** allows running specific commands as another user, with logging; the `sudoers` configuration should restrict commands rather than grant `ALL`.
- **Administrator groups** (Domain Admins, Enterprise Admins, local Administrators, cloud owner roles): a minimal number of members, monitoring of every membership change.
- **Usage auditing**: every escalation is logged and monitored in the SIEM; alerts on unexpected additions to admin groups; recording of privileged sessions; periodic log review by someone who is not an administrator (SoD).
- Unauthorized escalation (vertical: a user becomes admin; horizontal: access to other users' data at the same level) is prevented with patching, hardening and object-level authorization.

### Service Accounts

Non-human identities (service accounts, API keys, workload identities, bots) now outnumber human ones. Rules:

- every service account has a **human owner** and a documented purpose,
- interactive login is prohibited,
- least privilege, never shared between applications,
- credentials in a vault, automatic rotation, or even better **short-lived credentials** (managed identities, gMSA, IAM roles, workload identity federation) without static secrets,
- included in access reviews and offboarding (when the application is retired).

> **On the exam:** when an employee is transferred, the correct answer almost always includes **removing** the old rights, not just adding new ones. In a termination for misconduct, access is revoked before or during the termination meeting, never a day later.

## Authentication and Authorization Systems (5.6)

This objective has no sub-items in the outline; it covers implementing everything described above. Typical systems and what you need to know:

| System | Role | Key facts |
|---|---|---|
| **LDAP / directory** | store of identities and attributes | LDAPS (636) or StartTLS; hierarchy (DN, OU) |
| **Active Directory** | directory + Kerberos + group policies | KDC on domain controllers; tier-0 protection (DCs, admin accounts) |
| **Kerberos** | SSO in the domain | TGT, service ticket, NTP, KDC as SPOF |
| **RADIUS / TACACS+ / Diameter** | centralized AAA | see the table in 5.2 |
| **SAML / OIDC / OAuth IdP** | federation and web SSO | see 5.3 |
| **PAM** | privileged access | vault, JIT, session recording, rotation |
| **IGA** | lifecycle management and recertification | connected to HR, SoD rules |
| **Policy engine** (XACML, OPA) | central authorization | PDP/PEP model |
| **Smart cards / PIV / CAC** | Type 2 factor with a certificate | PKI dependency, CRL/OCSP |

What matters in implementation: redundancy of the IdP and KDC (the availability of the entire business depends on them), protecting the IAM system itself as a tier-0 asset, logging all authentication and authorization decisions, break-glass accounts with strict control and alerting on use, and testing the account recovery process.

### Authentication Attacks from the Defender's Perspective

| Threat | Description | Control |
|---|---|---|
| Brute force / password spraying | many attempts on one account or one password on many accounts | lockout/throttling, MFA, monitoring failed logins |
| Credential stuffing | reuse of leaked passwords | MFA, checking against a list of compromised passwords |
| Offline hash attack (dictionary, rainbow tables) | after theft of the password database | salt, slow hash, database protection |
| Pass-the-hash / pass-the-ticket | misuse of a stolen hash or ticket | endpoint protection, tiering, Credential Guard, short tickets |
| MFA fatigue | repeated push requests | number matching, FIDO2 |
| Session hijacking | theft of the session token | TLS, secure cookies, session binding, short lifetime |

## Access Control Administration and Additional Concepts

### Centralized, Decentralized, and Hybrid Administration

| Model | Description | Advantage | Drawback |
|---|---|---|---|
| **Centralized** | one team/system manages all rights (IdP, IGA) | consistency, easier audit, fast deactivation | bottleneck, SPOF |
| **Decentralized** | system owners and local administrators manage their own rights | speed, closeness to the business | inconsistency, forgotten accounts, difficult review |
| **Hybrid** | central identity and policies, local management of roles within the application | balance | clearly defined responsibilities are mandatory |

### Roles and Responsibilities in IAM

| Role | Responsibility |
|---|---|
| **Data owner** | determines who may access the data, approves access, participates in reviews |
| **Data custodian** | technically implements the owner's decisions (granting rights, backup) |
| **User's manager** | confirms the business need, recertifies their people |
| **Security / IAM team** | policies, tools, monitoring, metrics |
| **Auditor** | independently verifies that the process works |

### Comparison of SSO and Federation Mechanisms

| Criterion | Kerberos | SAML 2.0 | OIDC |
|---|---|---|---|
| Environment | internal network, domain | web, between organizations | web, mobile and SPA applications, APIs |
| Cryptography | symmetric (KDC) | XML signature (asymmetric) | JWT signature (asymmetric or HMAC) |
| Token | TGT and service ticket | assertion | ID token (+ access token) |
| Trusted third party | KDC | IdP | OpenID Provider |
| Typical risk | ticket theft, KDC SPOF | incorrect signature validation, long assertion lifetime | incorrect token validation (audience, issuer), token leakage |

### Separation of Duties (SoD) Matrix

Example conflicting combinations that an IGA tool must block or require an exception with a compensating control for:

| Function A | Function B | Why it is a conflict |
|---|---|---|
| creating vendors | approving payments | fictitious vendor and payout |
| code development | deploying to production without review | unauthorized changes |
| system administration | reviewing that system's logs | covering tracks |
| granting rights | approving one's own request | self-granting of privileges |

When a small organization cannot separate duties, the compensating controls are **job rotation**, **mandatory vacation**, independent log review and dual control (**two-person rule**) for the most critical actions.

> **On the exam:** who approves access to data? The **data owner**, not the system administrator and not the security team. The administrator (custodian) only implements the decision. Questions often offer "IT administrator" as a tempting but wrong answer.

## Scenarios

**Scenario 1.** A bank is introducing a SaaS CRM and wants employees to use their existing corporate accounts, with the CRM account disabled the same day an employee leaves. Solution: SAML or OIDC federation with the corporate IdP, MFA at the IdP, **SCIM** for provisioning and deprovisioning, mapping groups to CRM roles, a contract with obligations for data deletion and logging.

**Scenario 2.** An internal audit finds that 40% of ERP users have rights that do not match their job, mostly after internal transfers. The cause is the process (transfer without removing rights), not the technology. FIRST step: fix the role transition process and introduce periodic recertification by managers; then do a one-time cleanup of excessive rights.

**Scenario 3.** A DevOps team keeps a long-lived service account key with admin rights in CI variables. Recommendation: workload identity federation (short-lived tokens without a static secret), least privilege per pipeline, an account owner, inclusion in access reviews.

## Summary

- Identification → authentication → authorization → accounting → accountability. MFA = different factor types.
- FRR (Type I), FAR (Type II, more dangerous), CER/EER: lower = more accurate biometric system.
- 5.1: provision, control, review, revoke for information, applications, systems, services, devices, identities and facilities; physical and logical access linked.
- 5.2: groups and roles, AAA (RADIUS, TACACS+, Diameter), sessions (timeout, re-authentication), proofing (IAL/AAL/FAL), vaults, SSO with MFA, JIT access and JIT provisioning, phishing-resistant FIDO2/WebAuthn/passkeys.
- Kerberos: KDC (AS + TGS), TGT, service ticket, symmetric cryptography, NTP, the KDC is a SPOF.
- 5.3: SAML (authentication, XML), OAuth (delegated authorization), OIDC (authentication on top of OAuth), SCIM (provisioning); on-prem, cloud, hybrid models and their risks.
- 5.4: DAC (owner), MAC (labels, system), RBAC (role), RuBAC (global rules), ABAC (attributes), RAdAC (real-time risk); the PEP enforces, the PDP decides, the PIP supplies attributes, the PAP manages policies.
- 5.5: onboarding, transfer (remove the old), offboarding (immediately); access review by the owner; PoLP, separate admin accounts, sudo, escalation auditing; service accounts with an owner and short-lived credentials.
- 5.6: directory, Kerberos, AAA, IdP, PAM, IGA, policy engine; IAM systems are tier-0 assets with redundancy and a break-glass procedure.
