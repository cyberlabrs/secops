## OWASP and why the Top 10 matters

**OWASP** (Open Worldwide Application Security Project) is a nonprofit community that publishes free standards and tools. The **OWASP Top 10** is an *awareness* document, not a complete standard: the ten most important risk categories for web applications, compiled from testing data and a community survey.

The current edition is **OWASP Top 10:2025**, the eighth, which replaced the 2021 version. For thorough application verification there is **OWASP ASVS** (Application Security Verification Standard), and for practical advice the **Cheat Sheet Series**.

## OWASP Top 10:2025

| # | Category | In short |
|---|---|---|
| A01 | **Broken Access Control** | a user does or sees more than they should; since 2025 it also includes SSRF |
| A02 | **Security Misconfiguration** | default passwords, debug in production, overly broad CORS/cloud settings |
| A03 | **Software Supply Chain Failures** | vulnerable or compromised dependencies, build systems, registries (new, broader than the old "Vulnerable Components") |
| A04 | **Cryptographic Failures** | unencrypted data, weak algorithms, poor key management |
| A05 | **Injection** | SQL, NoSQL, OS commands, LDAP, XSS: data is interpreted as code |
| A06 | **Insecure Design** | a flaw in the design itself, not the implementation (e.g. no limit on password resets) |
| A07 | **Authentication Failures** | weak passwords, credential stuffing, poor session management |
| A08 | **Software or Data Integrity Failures** | unsigned updates, insecure deserialization, CI/CD without integrity checks |
| A09 | **Security Logging & Alerting Failures** | an attack isn't logged or doesn't trigger an alert (2025 also emphasizes alerting) |
| A10 | **Mishandling of Exceptional Conditions** | poorly handled errors: *fail open*, leaked details, inconsistent state (new) |

What changed compared to 2021:

- **New:** A03 Software Supply Chain Failures and A10 Mishandling of Exceptional Conditions.
- **SSRF** is no longer a separate category; it is now part of A01.
- Security Misconfiguration jumped from 5th to 2nd place.

## The most important categories in code

### A01 Broken Access Control

The most common form is **IDOR** (Insecure Direct Object Reference): the application takes an ID from the request and returns the object without checking whether it belongs to that user.

```python
# vulnerable
order = db.get_order(request.args["id"])
# correct: ownership is part of the query
order = db.get_order(id=request.args["id"], owner=current_user.id)
```

Rules: **deny by default**, server-side checks on **every** request, authorization at the object level, not just the route. Hiding a button in the UI is not access control.

**SSRF**: the server fetches a user-supplied URL and can thereby reach internal addresses, e.g. the cloud metadata service at `169.254.169.254`. Defense: an allowlist of destinations, blocking private ranges, **IMDSv2** on AWS, egress control.

### A05 Injection

The cause is always the same: **data and code are mixed in the same string**.

```python
# vulnerable: input becomes part of the SQL
cur.execute(f"SELECT * FROM users WHERE name = '{name}'")
# correct: parameterized query, the database knows what is data
cur.execute("SELECT * FROM users WHERE name = ?", (name,))
```

- SQL: parameterized queries or an ORM (no manual string concatenation).
- OS commands: avoid the shell; `subprocess.run([...], shell=False)`.
- XSS: context-aware output escaping (template engines do this automatically) and **Content-Security-Policy**.
- Input validation is an additional layer, not a replacement for parameterization.

### A02 Security Misconfiguration

Typical findings: debug mode in production, default admin accounts, unnecessary services and ports, `Access-Control-Allow-Origin: *` with credentials, public buckets, missing security HTTP headers. The defense is **repeatable, automated hardening** (IaC + scanners such as Checkov and Trivy) and identical settings across all environments.

### A03 Software Supply Chain Failures

- A dependency inventory (**SBOM**) and scanners (Dependabot, Renovate, Trivy, osv-scanner).
- Pinned versions (lock files), hash verification, a private mirror.
- Watch out for **typosquatting** and **dependency confusion** (an internal package name published publicly).
- Artifact signing (Sigstore/cosign) and SLSA levels for builds.

### A04 Cryptographic Failures

- TLS everywhere; encryption of sensitive data at rest.
- Passwords are **not encrypted but hashed** with a slow algorithm: **Argon2id**, scrypt or bcrypt. Never MD5/SHA-1/SHA-256 without a salt and work factor.
- Keys in a KMS or vault, not in code.

### A07 Authentication Failures

Credential stuffing (leaked email/password pairs from other sites), no attempt limits, sessions that never expire, session IDs in the URL. Defense: MFA, rate limiting, checking against breached passwords, a new session after login.

### A10 Mishandling of Exceptional Conditions

When something breaks, the system must **fail closed**:

```python
# vulnerable: if the authorization service doesn't respond, everyone becomes an admin
def is_admin(user):
    try:
        return authz.check(user, "admin")
    except Exception:
        return True
```

Also: generic messages to the user, details only in internal logs, transactions that roll back to a consistent state.

## OWASP API Security Top 10 (2023)

APIs have their own list because their typical problem is authorization over objects and properties:

| # | Risk | In short |
|---|---|---|
| API1 | **Broken Object Level Authorization (BOLA)** | IDOR for APIs: `/orders/123` returns someone else's order |
| API2 | Broken Authentication | weak tokens, no login limits |
| API3 | Broken Object Property Level Authorization | the API returns or accepts fields it shouldn't (*mass assignment*, `"isAdmin": true`) |
| API4 | Unrestricted Resource Consumption | no limits on size, request count or cost (SMS, AI calls) |
| API5 | Broken Function Level Authorization | a regular user calls an admin function |
| API6 | Unrestricted Access to Sensitive Business Flows | automated abuse of a legitimate flow (a bot buying all the tickets) |
| API7 | Server Side Request Forgery | the API fetches a user-supplied URL |
| API8 | Security Misconfiguration | CORS, verbose errors, missing TLS |
| API9 | Improper Inventory Management | forgotten `v1` or test versions of the API |
| API10 | Unsafe Consumption of APIs | blind trust in third-party API responses |

## Where this fits into DevSecOps

| Tool | Catches |
|---|---|
| SAST (Semgrep, CodeQL) | injection, dangerous functions, hardcoded secrets in code |
| SCA (Trivy, Dependabot, osv-scanner) | A03: vulnerable dependencies |
| Secret scanning (gitleaks, trufflehog) | secrets in the repo |
| DAST (OWASP ZAP) | misconfiguration, missing headers, some injection in the running application |
| IaC scanners (Checkov, Trivy config) | A02 in Terraform and Kubernetes manifests |

Scanners **rarely** find BOLA/IDOR and logic flaws. Those need code review, authorization tests and threat modeling.

## Summary

- Top 10:2025: A01 Broken Access Control is still number one; Supply Chain (A03) and Exceptional Conditions (A10) are new.
- Injection is solved with parameterization, not filtering.
- Access control on the server, per object, deny by default.
- Passwords are hashed with Argon2id/bcrypt, and systems fail closed.
