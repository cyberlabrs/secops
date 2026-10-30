## What threat modeling is

Threat modeling is structured thinking about what can go wrong **before** it happens. It is cheapest at the design stage: a fix on the whiteboard costs a minute, while the same fix in production costs a sprint or an incident.

Adam Shostack boils it down to **four questions** (Threat Modeling Manifesto):

1. **What are we working on?** Draw the system.
2. **What can go wrong?** Find threats (STRIDE).
3. **What are we going to do about it?** Controls, risk acceptance, redesign.
4. **Did we do a good job?** Verify, test, update the model.

You don't need a perfect model. You need a model the team actually uses and updates when the architecture changes.

## Data flow diagram (DFD)

A DFD has only five elements:

| Element | Notation | Example |
|---|---|---|
| **External entity** | rectangle | user, partner API, IdP |
| **Process** | circle | web application, Lambda function, worker |
| **Data store** | two parallel lines | database, S3 bucket, message queue |
| **Data flow** | arrow | HTTPS request, SQL query, message |
| **Trust boundary** | dashed line | internet / VPC, application / database, user / admin |

**Trust boundaries** are places where the level of trust changes. Most attacks happen there, so that's where you look for threats most carefully. Every flow that crosses a boundary must answer: who is the sender, is the content validated, is the channel protected.

```text
 [User] --HTTPS-->     | (Web API) --SQL--> ||Database||
                       |      \
   boundary: internet  |       \--message--> ||Queue|| --> (Worker) --> [Email service]
```

## STRIDE

STRIDE is Microsoft's mnemonic for six threat categories. Each is the opposite of a security property.

| Letter | Threat | Property violated | Example | Typical controls |
|---|---|---|---|---|
| **S** | Spoofing | authenticity | stolen session cookie, fake service | strong authentication, MFA, mTLS, signed tokens |
| **T** | Tampering | integrity | changing the price in a request, modifying a file on disk | server-side validation, signatures, hashes, write access control |
| **R** | Repudiation | non-repudiation | "I didn't approve that payment" and there's no log | tamper-resistant audit log, signed transactions |
| **I** | Information disclosure | confidentiality | public S3 bucket, stack trace with a password | encryption, least privilege, error masking |
| **D** | Denial of service | availability | flooding an API, expensive query without limits | rate limiting, quotas, autoscaling, timeouts |
| **E** | Elevation of privilege | authorization | a regular user calls an admin endpoint | authorization check on every request, sandboxing |

### STRIDE per element

Not every category is relevant to every DFD element:

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| External entity | ✔ | | ✔ | | | |
| Process | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Data store | | ✔ | ✔* | ✔ | ✔ | |
| Data flow | | ✔ | | ✔ | ✔ | |

\* repudiation applies to a data store when it holds audit logs.

This gives you a systematic procedure: go through each element and the letters relevant to it.

## From threat to decision

There are four responses to every threat:

1. **Mitigate**: add a control. The most common.
2. **Eliminate**: remove the feature or component.
3. **Transfer**: e.g. insurance, or hand part of the responsibility to a provider (managed service).
4. **Accept**: a conscious, documented decision by the risk owner.

For prioritization, a simple **likelihood × impact** estimate (low, medium, high) is enough. DREAD is an older scoring model that is rarely recommended today because it is subjective.

## The output of threat modeling

A useful output is a table the team can track:

| # | Element | STRIDE | Threat | Control | Status |
|---|---|---|---|---|---|
| 1 | Web API | S | a stolen JWT is used from another device | short `exp`, refresh token rotation | done |
| 2 | Flow API→Database | I | traffic to the database isn't encrypted | TLS on the connection, `sslmode=verify-full` | in progress |
| 3 | Message queue | T | any service can write a message | IAM policy: only the Web API writes | open |

Threats without a control become backlog tickets, with an owner.

## Other approaches, briefly

- **PASTA**: a seven-stage process focused on business risk.
- **LINDDUN**: privacy threats (linkability, identifiability, disclosure of personal data…).
- **Attack trees**: the attacker's goal is the root of the tree, and the branches are ways to reach it.
- **MITRE ATT&CK**: useful for real attacker techniques when modeling infrastructure (upcoming modules).

Tools: paper and whiteboard, OWASP Threat Dragon, Microsoft Threat Modeling Tool, threat modeling as code (pytm, Threagile).

## Summary

- Four questions: what are we building, what can go wrong, what will we do, did we do a good job.
- A DFD with trust boundaries is the foundation; threats pile up at the boundaries.
- Walk through STRIDE systematically, element by element.
- Every threat gets a decision and an owner. The model is updated along with the architecture.
