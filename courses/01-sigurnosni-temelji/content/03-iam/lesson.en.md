## Identity is the new perimeter

In the cloud there is no clear "inside" and "outside". Whoever has a valid token or key can access a resource from anywhere. That's why IAM is the most important security control today, and misconfigured permissions and stolen credentials are among the most common causes of cloud incidents.

## Authentication and authorization

| | Authentication (AuthN) | Authorization (AuthZ) |
|---|---|---|
| Question | **Who are you?** | **What are you allowed to do?** |
| Examples | password, key, certificate, MFA, token | IAM policy, RBAC role, ACL |
| Failure | an attacker impersonates you | a logged-in user does more than they should |

The third part is **accounting / audit**: a record of who did what (CloudTrail, Azure Activity Log, auth.log). Together they're called **AAA**.

## Least privilege

Every identity (human, service, CI pipeline) gets only what it needs, only for as long as it needs it.

- Start from **nothing** and add, rather than starting from admin and taking away.
- Use tools that suggest policies based on actual usage (AWS IAM Access Analyzer, Azure Entra permissions management).
- **Just-in-time (JIT)** access: a privileged role is activated on request and expires (Azure PIM, AWS Identity Center with temporary access).
- **Separation of duties**: the same person shouldn't write, approve, and release a change to production.

## Access control models

| Model | Idea | Example |
|---|---|---|
| **DAC** (discretionary) | the resource owner decides | Linux file permissions |
| **MAC** (mandatory) | the system enforces rules based on labels | SELinux, AppArmor, military classifications |
| **RBAC** (role-based) | rights are granted to roles, users are assigned roles | Kubernetes RBAC, Azure RBAC |
| **ABAC** (attribute-based) | decision based on user, resource and context attributes | AWS policies with tags and `Condition` |
| **ReBAC** (relationship-based) | decision based on the relationship between entities | Google Zanzibar, OpenFGA ("document owner") |

RBAC is easy to understand, but roles multiply quickly (*role explosion*). ABAC scales better, but is harder to verify.

## Federation and SSO

Instead of every application storing passwords, an **identity provider (IdP)** confirms identity, and the application (**service provider / relying party**) trusts the IdP.

| Protocol | Purpose | Format | Typical use |
|---|---|---|---|
| **SAML 2.0** | authentication (SSO) | XML assertion | enterprise SaaS, older web applications |
| **OAuth 2.0** | **delegated authorization** | access token | API access on behalf of a user |
| **OIDC** | authentication **on top of** OAuth 2.0 | ID token (JWT) | modern web and mobile apps, CI/CD |

> A common mistake: OAuth 2.0 by itself is **not** a login protocol. An access token says what the client is allowed to do, not who the user is. OIDC and its ID token are what convey identity.

### OIDC in CI/CD (workload identity federation)

Instead of long-lived cloud keys in GitHub secrets, the pipeline gets a short-lived OIDC token from GitHub, and AWS/Azure/GCP exchanges it for temporary credentials. There's no static key that can leak. This is the recommended practice today.

Watch the trust conditions: restrict the `sub` claim to the exact repo and branch (e.g. `repo:firma/app:ref:refs/heads/main`), otherwise any repo could assume the role.

### JWT in brief

A JWT has three parts: `header.payload.signature`, each base64url-encoded. The payload is **readable by anyone**, because it is only encoded, not encrypted. The server must:

- verify the signature and allow only the expected algorithm (never `alg: none`),
- check `exp`, `iss` and `aud`,
- not put secrets in the payload.

## MFA

Factors: something you **know** (password), something you **have** (phone, key), something you **are** (biometrics). Two factors of the same kind are not MFA.

Not all MFA methods are equally strong:

| Method | Phishing resistance |
|---|---|
| SMS / voice call | weak (SIM swap, interception) |
| TOTP app (6 digits) | medium: the user can still type the code into a fake page |
| Push notification | medium: MFA fatigue attacks ("spamming" requests until the user approves); number matching helps |
| **FIDO2 / WebAuthn / passkeys** | **strong**: the key is bound to the domain and won't sign for a fake site |

For admin accounts the goal is **phishing-resistant MFA** (FIDO2 keys or passkeys).

## Passwords today (NIST SP 800-63B)

- Length over complexity: a minimum of 8 characters, better 15+. Allow long passphrases.
- Do **not** require periodic changes without reason; change them when there is evidence of compromise.
- Check new passwords against breached-password lists (e.g. the Have I Been Pwned k-anonymity API).
- No security questions ("pet's name").

## Service identities and secrets

Machine identities now vastly outnumber human ones.

- Use **managed identities / IAM roles / workload identity** instead of static keys.
- If a key must exist: store it in a vault (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault), rotate it and never commit it to git.
- Every service has **its own** identity; a shared account destroys the audit trail.

## Account lifecycle (Joiner, Mover, Leaver)

| Phase | What must happen | Typical gap |
|---|---|---|
| **Joiner** | account from the HR system, role based on position | manually copying rights "like colleague X" |
| **Mover** | old rights are **removed**, new ones added | accumulation of rights (*privilege creep*) |
| **Leaver** | the account is locked immediately, keys and tokens are revoked | active SSH keys and API tokens of a former employee |

Periodic **access reviews** catch what slipped through: the resource owner confirms whether each person still needs access.

**Break-glass accounts**: one or two emergency admin accounts that don't depend on SSO, with a strong password in a safe and an alert on every login.

## Summary

- Identity is the perimeter. AuthN confirms who someone is, AuthZ determines what they may do.
- Least privilege, JIT access and separation of duties.
- OIDC for login and federation in CI/CD, OAuth 2.0 for delegation, SAML in enterprise environments.
- Phishing-resistant MFA for privileged accounts.
- Joiner, Mover, Leaver processes and regular access reviews.
