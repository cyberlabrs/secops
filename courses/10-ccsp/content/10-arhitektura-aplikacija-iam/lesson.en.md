## Exam objectives: 4.6 and 4.7

This module closes domain 4 (**Cloud Application Security**, 16% of the exam) with two objectives:

- **4.6 Comprehend and apply the specifics of cloud application architecture**
  - supplemental security components: Web Application Firewall (WAF), Database Activity Monitoring (DAM), XML firewalls, API gateway, load balancer,
  - cryptography,
  - sandboxing,
  - application virtualization and orchestration: microservices, containers, Docker, Kubernetes.
- **4.7 Design appropriate Identity and Access Management (IAM) solutions**
  - federated identity,
  - Identity Providers (IdP),
  - Single Sign-On (SSO),
  - Multi-Factor Authentication (MFA),
  - Cloud Access Security Broker (CASB),
  - secrets, key, and certificate management.

From the AWS Security Specialty and CKS courses you know the concrete services: AWS WAF, ALB, API Gateway, KMS, Secrets Manager, IAM Identity Center, Kubernetes RBAC and NetworkPolicy. CCSP asks you to describe these things in a vendor-neutral way and to choose **the right component for the right problem** and **the right identity design for the right collaboration model**. Questions often offer two controls that both "help", but only one is primarily intended for the described risk.

## Supplemental security components (4.6)

### Why "supplemental"

The word **supplemental** matters: these components are a layer of **defense in depth** in front of or around the application. They do not replace securely written code. A WAF that blocks SQL injection does not fix the vulnerable query; it buys time and reduces exposure until the code is fixed (**virtual patching**).

### Component overview

| Component | OSI layer / placement | Primary function | What it does NOT do |
|---|---|---|---|
| **WAF** (Web Application Firewall) | L7, in front of the web application | filters HTTP(S) requests by rules (OWASP Top 10 patterns, rate-based rules, geo, bot protection) | does not protect against business logic and authorization flaws, does not see the database |
| **DAM** (Database Activity Monitoring) | alongside the database (agent or network sensor) | monitors and alerts on SQL activity in real time, including privileged users; can block | does not protect the web tier, does not replace encryption |
| **XML firewall** | L7, in front of XML/SOAP services | validates the XML schema, checks WS-Security signatures, protects against XML attacks (XXE, XML bomb), transforms messages | not a general web firewall for JSON/HTML |
| **API gateway** | L7, entry point for APIs | authentication and authorization of calls, rate limiting and quotas, routing, transformation, logging, versioning | not a replacement for object-level authorization in the service |
| **Load balancer** | L4 (network) or L7 (application) | traffic distribution, health checks, TLS termination, availability | not a security filter by itself (although it hides the backend and absorbs part of a DoS) |

Additional components ISC2 materials mention in this context: **IDS/IPS**, **DLP**, **anti-malware** for uploads, **CDN** with DDoS protection, **RASP**.

### WAF in more detail

A WAF works in one of two models:

- **Negative model (blocklist)**: blocks known attacks (signatures, managed rule sets, e.g., the OWASP Core Rule Set). Easy to introduce, but misses new variants.
- **Positive model (allowlist)**: allows only known good (permitted paths, methods, parameters). Stronger, but requires maintenance.

Typical rollout: the WAF first runs in **detection/count** mode to see false positives, then in **blocking** mode. In the cloud, the WAF is attached to a CDN, load balancer, or API gateway (in AWS: CloudFront, ALB, API Gateway).

### DAM in more detail

DAM answers the question "who did what in the database", including DBAs whose actions the database's native logs may not record independently. A key property is **separation of duties**: DAM monitors database administrators, so it must not be managed by the same people. In PaaS databases (managed DB), a host agent is often not possible, so the service's native audit logs sent to a SIEM, or DAM solutions that support that service, are used.

### XML firewall and API gateway

An XML firewall is specialized for SOAP and XML: it checks that a message is valid against the schema (XSD), that the signature and encryption conform to WS-Security, and rejects malicious constructs such as external entities. Today this function is often part of an API gateway or an enterprise service bus.

An API gateway is the central point for all API calls. It provides consistent authentication (JWT/OAuth token validation), per-client quotas, logging, and hiding of the internal topology. In a microservice architecture, the gateway protects **north-south** traffic (from outside in), while a **service mesh** (e.g., Istio, Linkerd) protects **east-west** traffic between services through mTLS and policies.

> **On the exam:** recognize the keyword. "Protecting SOAP services and validating XML messages" = XML firewall. "Monitoring privileged database users in real time" = DAM. "Blocking SQL injection and XSS in front of a web application without changing code" = WAF. "Rate limiting and authentication for all APIs in one place" = API gateway. "Load distribution and health checks" = load balancer.

### Where the components sit in the reference architecture

The typical path of a request in a cloud web application with layered protection:

1. **DNS and CDN** with DDoS protection absorb volumetric attacks at the network edge.
2. **WAF** on the CDN or load balancer filters L7 attacks and bots.
3. **Load balancer** terminates TLS (and re-encrypts toward the backend if needed), performs health checks, and distributes traffic.
4. **API gateway** validates tokens, enforces quotas, and routes to services.
5. **Application services** in private subnets, with no direct internet access, with their own per-object authorization.
6. **Service mesh** protects east-west traffic with mTLS between services.
7. **Database** in an isolated subnet, encrypted, monitored through **DAM** or native audit logs sent to the SIEM.
8. All layers send logs to a **central SIEM**, outside the control of those layers' administrators.

Each layer catches a different class of problems; none covers everything alone. That is the essence of the defense in depth approach ISC2 expects.

### Scenario

An e-commerce company has an SQL injection vulnerability in an old module, and the code fix will take three weeks. What to do FIRST? Deploy a WAF rule (virtual patch) to reduce exposure immediately, with monitoring in DAM or database logs, and fix the code in parallel. The WAF is a temporary compensating control; the permanent solution is a parameterized query.

## Cryptography in cloud applications (4.6)

Cryptography appears in multiple CCSP domains (data protection is domain 2). Here the focus is on **application architecture**: what is encrypted where, and who holds the keys.

| Data state | Technique | Note |
|---|---|---|
| **Data in transit** | TLS 1.2/1.3, mTLS between services, IPsec VPN | TLS termination at the load balancer means traffic behind it is unencrypted unless it is re-encrypted |
| **Data at rest** | volume, object, and database encryption; envelope encryption | keys in a KMS or HSM |
| **Data in use** | confidential computing (TEE, e.g., Intel SGX/TDX, AMD SEV), homomorphic encryption (limited) | protects data even from host administrators |

**Envelope encryption**: data is encrypted with a **data encryption key** (DEK), and the DEK is encrypted with a **key encryption key** (KEK) that never leaves the KMS/HSM. Advantages: large data is encrypted locally and quickly, KEK rotation does not require re-encrypting all data, and access to data is controlled through access to the KEK.

Encryption levels in an application:

| Level | Who sees plaintext | Advantage | Drawback |
|---|---|---|---|
| Storage-level (transparent disk/service encryption) | anyone with access through the service | simple, protects against media theft | does not protect against a compromised application or excessive permissions |
| Database-level (TDE, column encryption) | the database and authorized queries | more granular | the database administrator can still see the data |
| Application-level (the application encrypts before sending) | only the application holding the key | strongest protection from the CSP and DBA | harder searching, more complex management |

To search encrypted data, **tokenization** (replacing a value with a token, original in a vault) and **format-preserving encryption** are used. The same applies to AI applications: training data and vector databases are sensitive data and are encrypted like any other.

> **On the exam:** when the requirement is that "neither the CSP nor the database administrator may see the data", the BEST answer is application-level (or client-side) encryption with customer-controlled keys, not transparent disk encryption. Transparent encryption protects against physical theft of media, not against someone who legitimately accesses data through the service.

## Sandboxing (4.6)

**Sandboxing** is running code in an isolated environment with limited access to system resources, so that malicious or faulty code cannot affect the rest of the system.

Uses in the cloud:

- **Testing and analyzing untrusted code**: malware detonation sandbox for attachments and uploads.
- **Tenant isolation**: serverless platforms run different customers' functions in lightweight micro-VMs (e.g., Firecracker in AWS Lambda), while gVisor and Kata Containers provide stronger container isolation.
- **Development and testing**: separate environments with no access to production.
- **Browser and plugin isolation**: third-party code runs with minimal privileges.
- **AI agents**: LLM-generated code runs in a sandbox with no access to the network and secrets.

Technical mechanisms: separate processes and users, Linux namespaces and cgroups, seccomp profiles, AppArmor/SELinux, micro-VMs, separate cloud accounts or projects, network isolation.

Relationship to related terms: **application virtualization** (e.g., running an application in an isolated container or through tools like App-V/Wine) abstracts the application from the OS and isolates it along the way; a sandbox is primarily a security concept.

## Application virtualization and orchestration (4.6)

### Microservices

A **microservice architecture** breaks an application into small, independently deployable services that communicate via APIs or messages.

| Aspect | Monolith | Microservices |
|---|---|---|
| Attack surface | fewer entry points, but one compromise = the whole application | more APIs and network flows, but compromise of one service can be isolated |
| Authentication between components | in-process calls | service-to-service authentication (mTLS, tokens, workload identity) |
| Secrets | one place | many services, a central secrets manager is needed |
| Logging | one log | distributed, a correlation ID and central log are needed |
| Patching | everything at once | service by service, faster, but more artifacts |
| Least privilege | coarse granularity | each service has only its own permissions |

### Containers and Docker

A **container** packages an application with its dependencies and shares the host kernel. It is lighter than a VM, but isolation is weaker: a kernel vulnerability or misconfiguration (privileged container, mounted Docker socket, root user) can lead to escape to the host.

| Criterion | Virtual machine | Container |
|---|---|---|
| Isolation | hypervisor, separate kernel | namespaces and cgroups, shared kernel |
| Size and startup | GB, minutes | MB, seconds |
| Security boundary | stronger | weaker, requires hardening |
| Patching | OS in every VM | image rebuild, not patching at runtime |

Key container controls (you know them from CKS):

- **minimal base image** (distroless, alpine), without unnecessary tools,
- **image scanning** in the registry and pipeline, image signing,
- **non-root user**, read-only root filesystem, no privileged mode, restricted Linux capabilities,
- **immutability**: a running container is not patched; a new image is built,
- secrets through a secrets mechanism, not in the image or in Dockerfile variables,
- runtime detection (e.g., Falco) for unexpected processes and syscalls.

**Docker** is the platform and format that popularized containers; image formats are now standardized through the **OCI** (Open Container Initiative).

### Kubernetes and orchestration

**Orchestration** automates deployment, scaling, recovery, and networking of containers. **Kubernetes** is the de facto standard. Security topics:

| Area | Control |
|---|---|
| Control plane | protected API server, etcd encrypted and not reachable from outside, audit logging |
| Authentication and authorization | RBAC with least privilege, no cluster-admin for applications, OIDC integration for users |
| Workload security | Pod Security Standards (restricted), securityContext, admission controls (e.g., OPA Gatekeeper, Kyverno) |
| Network | NetworkPolicy (default deny), service mesh with mTLS |
| Secrets | Kubernetes Secrets with encryption in etcd or an external secrets manager |
| Supply chain | only signed images from approved registries (admission policy) |
| Multitenancy | namespaces are a logical, not a hard boundary; for strict requirements, separate clusters |

In managed Kubernetes services (EKS, AKS, GKE), the CSP manages the control plane, and the customer is responsible for workloads, RBAC, network policies, and node configuration (shared responsibility).

> **On the exam:** a container is not a security boundary equal to a VM. If the scenario requires running **untrusted code from different customers** on the same host, the BEST answer is stronger isolation (micro-VM, sandbox runtime, or separate hosts), not just a separate namespace.

## IAM solution design (4.7)

### Basic concepts

- **Identification**: a claim of who you are (username).
- **Authentication**: proof of the claim (password, key, biometrics).
- **Authorization**: what you are allowed to do.
- **Accountability**: tracing actions to an identity (logs).
- **Identity lifecycle**: provisioning, role changes, periodic access reviews (recertification), deprovisioning. The most common failure is forgotten deprovisioning of former employees' accounts, especially in SaaS applications outside the central IdP.

For automatic creation and removal of accounts in SaaS applications, **SCIM** (System for Cross-domain Identity Management) is used.

### Identity Providers (IdP)

An **Identity Provider (IdP)** is a system that authenticates the user and issues assertions (claims, tokens) about their identity and attributes. A **Service Provider (SP)**, in OIDC terminology a **Relying Party (RP)**, is the application that accepts those assertions and grants access based on them.

Examples of IdPs: Microsoft Entra ID, Okta, Ping Identity, Google Workspace, AWS IAM Identity Center (as an IdP or intermediary), Keycloak, AD FS. Advantages of a central IdP: one place for password and MFA policies, one place to revoke access, central auditing.

### Federated identity

**Federation** is a trust relationship between organizations (or domains) in which one party accepts identities authenticated by the other. The user uses their home account to access a partner's or CSP's resources.

| Protocol | Format | Main purpose | Note |
|---|---|---|---|
| **SAML 2.0** | XML assertions, signed | enterprise web SSO and federation | mature, common for SaaS; IdP-initiated and SP-initiated flows |
| **OAuth 2.0** | access tokens (often JWT) | **authorization**: delegated API access | not an authentication protocol |
| **OpenID Connect (OIDC)** | ID token (JWT) over OAuth 2.0 | **authentication** for web, mobile, and SPA applications | modern standard, workload federation (e.g., CI/CD to the cloud) |
| **WS-Federation** | XML | older Microsoft federation | found in legacy environments |
| **Kerberos** | tickets | authentication within a domain (AD) | not intended for internet federation |

Federation models:

- **Hub-and-spoke** (trusted third party): a central IdP or broker that everyone trusts; scales well.
- **Mesh / web of trust**: each organization trusts every other directly; does not scale (n×(n−1)/2 relationships).

Workload federation is also important for DevSecOps: a CI/CD pipeline obtains short-lived cloud credentials via an OIDC token instead of storing long-lived access keys.

> **On the exam:** OAuth is for **authorization** (delegated access), OIDC adds **authentication** (who the user is), SAML is the XML standard for enterprise SSO and federation. If a question says an application uses an OAuth access token as proof of the user's identity, that is a design flaw; the correct approach is an OIDC ID token.

### Single Sign-On (SSO)

**SSO** lets a user authenticate once and access multiple applications without re-entering credentials. Federation is the mechanism that enables SSO across organizational boundaries and between on-prem and the cloud.

| Benefits | Risks and controls |
|---|---|
| fewer passwords, less phishing and reuse | the IdP becomes a **single point of failure** and a high-value target |
| central MFA and policies | compromise of one account opens all applications → strong MFA is mandatory |
| fast access revocation in one place | IdP availability must be high; plan for break-glass accounts |
| better auditing | session duration and re-authentication for sensitive actions (step-up) |

**Break-glass** (emergency access) accounts are a small number of tightly guarded accounts that do not depend on federation, for the case when the IdP is unavailable. They are used extremely rarely, and every use triggers an alert.

### Multi-Factor Authentication (MFA)

Authentication factors:

| Type | Description | Examples |
|---|---|---|
| **Something you know** | knowledge | password, PIN |
| **Something you have** | possession | hardware key, smart card, phone with an authenticator app |
| **Something you are** | inherence (biometrics) | fingerprint, face |
| (additional context) | location, behavior, device | used for adaptive / risk-based authentication, not as a standalone factor |

MFA means at least two **different types** of factors. A password and a security question are two factors of the same type, so they are not MFA.

Strength of MFA methods (from weaker to stronger): SMS/voice OTP (vulnerable to SIM swap and interception), TOTP app, push notification (vulnerable to **MFA fatigue**, mitigated by number matching), **phishing-resistant MFA**: FIDO2/WebAuthn security keys and **passkeys**, smart card / PIV. Phishing-resistant methods bind authentication to the domain and a cryptographic key, so a fake site cannot use them.

In the cloud, MFA is mandatory at minimum for: root/main accounts, administrators, console access, privileged operations, and remote access.

### Cloud Access Security Broker (CASB)

A **CASB** is a security point between the organization's users and cloud services that enforces the organization's policies on cloud usage. Gartner's four pillars: **visibility** (including **shadow IT** discovery), **compliance**, **data security** (DLP, encryption, tokenization), and **threat protection** (anomalies, compromised accounts, malware).

| Mode | How it works | Advantage | Limitation |
|---|---|---|---|
| **API-based** (out-of-band) | connects to the SaaS application's API | sees data at rest, does not affect performance, also covers unmanaged devices | not real-time, depends on the vendor's API |
| **Forward proxy** (inline) | user traffic goes through a proxy (agent or PAC on the device) | real-time control, shadow IT discovery | requires device management |
| **Reverse proxy** (inline) | the user is redirected through the proxy via IdP integration | also works for unmanaged devices | can break application functionality |
| **Log analysis** (discovery) | analysis of firewall and proxy logs | quickly discovers cloud services in use | visibility only, no control |

CASB is now often part of a broader **SSE** (Security Service Edge) or **SASE** platform, together with a secure web gateway and ZTNA.

A note on terminology: the **cloud service broker** from ISO/IEC 17789 and NIST SP 500-292 is a **role** (an intermediary that aggregates, integrates, or customizes services), while a CASB is a **security tool**. The exam may use them as distractors for each other.

> **On the exam:** "Discover which unapproved SaaS applications employees use" = CASB (discovery / shadow IT). "Apply DLP to data already in an approved SaaS" = API-based CASB. When management asks what to do FIRST about shadow IT, the answer is discovery and risk assessment (visibility), and only then policy and blocking.

### Secrets, key, and certificate management

**Secrets** are database passwords, API keys, tokens, connection strings. **Keys** are cryptographic material (symmetric, asymmetric). **Certificates** bind a public key to an identity (X.509).

| Object | Where it is stored | Key practices |
|---|---|---|
| Secrets | secrets manager / vault (e.g., AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) | never in code, image, or repository; automatic rotation; dynamic short-lived secrets; access by workload identity; access auditing |
| Cryptographic keys | KMS, cloud HSM, on-prem HSM | separation of duties (who manages the key ≠ who uses the data), rotation, access control to the key, deletion protection (waiting period), backup |
| Certificates | certificate manager, internal PKI | inventory of all certificates, automatic renewal (ACME), expiry monitoring, short validity periods, revocation (CRL/OCSP) |

Key control options in the cloud (more in domain 2):

| Model | Who generates and holds the key | Customer control |
|---|---|---|
| CSP-managed keys | CSP | lowest |
| Customer-managed keys in the CSP KMS | CSP KMS, the customer manages policies | medium |
| **BYOK** (Bring Your Own Key) | the customer generates it and imports it into the CSP KMS | higher, the key is still at the CSP |
| **HYOK / external key store** (Hold Your Own Key) | the key stays outside the CSP, in the customer's HSM | highest, but also the highest operational complexity and availability risk |

Key management follows a lifecycle: generation, distribution, storage, use, rotation, archiving, revocation, and destruction. Key destruction is the basis of **crypto-shredding**.

An expired certificate is one of the most common causes of service outages. That is why automatic renewal and a certificate inventory are both an operational and a security control.

> **On the exam:** separation of duties for keys is a frequent topic. If the same administrator manages both the keys and the data, compromise of one account exposes everything. The BEST design separates the key administrator role from the role that uses the key for decryption, and logs every key use.

## Authorization models and privileged access (4.7)

IAM design does not end with authentication. Once you know who the user is, you decide what they may do.

| Model | Decision based on | Advantage | Drawback | Cloud example |
|---|---|---|---|---|
| **DAC** (Discretionary) | the resource owner grants access | flexible | uncontrolled spread of permissions | file sharing in SaaS storage |
| **MAC** (Mandatory) | classification labels and clearance | strict control | rigid, expensive to maintain | government and military systems |
| **RBAC** (Role-Based) | the user's role | easy to review | role explosion in large organizations | Kubernetes RBAC, Azure RBAC |
| **ABAC** (Attribute-Based) | attributes of the user, resource, and context (tags, department, location, time) | fine granularity, scales | harder to understand and review | AWS policies with conditions on tags |
| **ReBAC** (Relationship-Based) | relationships between entities (owner, team member) | natural for collaborative applications | specialized systems | document sharing in SaaS |

**Zero trust** (NIST SP 800-207) is an architectural principle in which no request is trusted in advance because of its network location. Every access is decided dynamically based on identity, device posture, context, and resource sensitivity, through a **policy decision point** (PDP) and a **policy enforcement point** (PEP). In the cloud, where the perimeter practically does not exist, identity becomes the new perimeter.

**Privileged Access Management (PAM)** controls the most dangerous accounts:

- **just-in-time** (JIT) access: privilege is granted temporarily, on request and with approval, instead of permanently,
- **just-enough** access: only the permissions needed for the task,
- recording and monitoring of privileged sessions,
- vaulting and automatic rotation of privileged passwords,
- separate administrator accounts (the admin does not read e-mail from the same account),
- periodic review of privileged roles.

> **On the exam:** when a scenario describes many permanent administrator accounts, the BEST answer is usually just-in-time privileged access with approval and logging, not just "a stronger password" or "more MFA". Reducing the number and duration of privileges reduces the attack surface, while MFA only makes abuse of existing privileges harder.

### Token security

Modern IAM relies on tokens (most often **JWT**, JSON Web Token). Token handling mistakes are common in cloud applications:

| Risk | Control |
|---|---|
| accepting a token without signature verification or with `alg: none` | always validate the signature and the allowed algorithm on the server |
| a token for another application accepted by ours | check `aud` (audience) and `iss` (issuer) |
| long-lived tokens that cannot be revoked | short access tokens, refresh tokens with rotation and revocation |
| token in a URL or log | send it in a header, mask it in logs |
| token theft from the browser | secure storage (HttpOnly cookies), PKCE for public clients, token binding/DPoP where possible |
| excessive scope | minimal scope per client |

### Choosing an IAM solution by scenario

| Requirement | Solution |
|---|---|
| employees access dozens of SaaS applications | central IdP + SSO (SAML/OIDC) + SCIM |
| a partner accesses our portal | federation with the partner's IdP |
| customers (B2C) register in our application | CIAM (customer IAM) with OIDC, social login, risk-based MFA |
| a pipeline needs access to a cloud account | workload identity federation (OIDC), short-lived credentials |
| a service in the cluster needs access to a database | workload identity + dynamic secrets from a vault |
| controlling the use of unapproved SaaS | CASB |
| cloud environment administrators | PAM, JIT, phishing-resistant MFA, separate admin accounts |
| a regulator requires that the key is never held by the CSP | HYOK / external key store |

## Scenarios

**Scenario 1.** A company has 40 SaaS applications, each with its own accounts. Employees leave, and accounts stay active for months. BEST solution: a central IdP with SSO (SAML/OIDC) and SCIM provisioning, so that disabling the account in the IdP removes access everywhere, along with periodic access reviews.

**Scenario 2.** A developer committed a database password to a public repository. FIRST step: immediately **rotate/revoke** the secret (treat it as compromised), then check access logs, remove it from history, and introduce a secrets manager and secret scanning in the pipeline. Deleting the commit without rotation does not help because the secret is already public.

**Scenario 3.** A partner needs access to an internal portal. Instead of creating local accounts for the partner's employees, it is BEST to federate with the partner's IdP; the partner manages its users, and you control authorization and the federation terms by contract.

**Scenario 4.** Employees use unapproved AI chat services and paste confidential documents into them. FIRST: CASB discovery to determine the scope and risk, then an acceptable use policy, an approved alternative, and inline DLP controls for unapproved services.

## Summary

- **4.6 components**: WAF (L7, OWASP patterns, virtual patching), DAM (database activity, DBA monitoring, separation of duties), XML firewall (SOAP/XML, schema, WS-Security), API gateway (central authentication, quotas, logging; north-south), load balancer (availability, health checks, TLS termination). All are **supplemental**, not a replacement for secure code.
- **Cryptography**: TLS in transit, envelope encryption at rest (DEK/KEK), confidential computing for data in use; application-level encryption when the CSP and DBA must not see the data.
- **Sandboxing**: isolated execution of untrusted code (micro-VM, gVisor, seccomp, separate accounts).
- **Microservices and containers**: larger attack surface, service-to-service authentication, minimal and signed images, non-root, immutable; Kubernetes RBAC, Pod Security Standards, NetworkPolicy, Secret encryption, admission controls. A container is not a boundary equal to a VM.
- **4.7 IAM**: the IdP issues assertions, the SP/RP accepts them; federation through SAML (XML, enterprise), OAuth 2.0 (authorization), OIDC (authentication); SSO with strong MFA and break-glass accounts; SCIM for the lifecycle.
- **MFA**: different factor types; phishing-resistant FIDO2/passkeys are the strongest, SMS the weakest.
- **CASB**: visibility, compliance, data security, threat protection; API-based vs. proxy (forward/reverse); shadow IT visibility first.
- **Secrets, keys, certificates**: secrets manager with rotation, KMS/HSM with separation of duties, BYOK vs. HYOK, certificate inventory and automatic renewal; rotate a compromised secret FIRST.
