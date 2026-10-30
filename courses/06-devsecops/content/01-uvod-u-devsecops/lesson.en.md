## What this module covers

This is the introductory module of the course. It covers two objectives from domain 1:

- **1.1** DevSecOps principles: **shift-left**, a secure SDLC following the **NIST SSDF** framework, the **OWASP DSOMM** and **OWASP SAMM** maturity models.
- **1.2** Threat modeling for the application and the pipeline, and choosing controls per pipeline stage.

Where this sits in the pipeline: everywhere and nowhere. This module does not add a job; it gives you a map: which controls exist, in which stage we place them, what each one prevents, and in what order we introduce them. The rest of the course fills in that map, control by control, on the `/root/kurs-shop` repo.

The threat we prevent: a security problem discovered only in production (or discovered by an attacker). That is when the fix is most expensive and the exposure lasts longest.

At the end of the module you run the existing pipeline locally and make a plan: which controls it is missing and in what order you add them.

## From DevOps to DevSecOps

DevOps shortened the path from commit to production from weeks to minutes. Classic security (a yearly pentest, a manual review before release) cannot keep up with that pace: it either becomes a bottleneck or gets bypassed.

**DevSecOps** means security becomes part of the same workflow:

- controls are **automated** and run in the pipeline, not in a spreadsheet someone fills in;
- findings reach the **developer**, in the merge request, while the code is still fresh;
- responsibility is **shared**: the security team builds rules and tools (often as a "platform"), teams use them;
- rules are **code** (policy as code, scanner configurations in the repo) and go through the same review as the application.

### Shift-left, but also shift-right

**Shift-left** means moving a check as early as possible in the lifecycle: into the IDE, a pre-commit hook, the merge request. The reason is economic and practical: a secret caught in a pre-commit hook never enters git history; the same secret found in production requires revocation, rotation, investigation and history rewriting (module 03).

But not everything can be moved left:

- **DAST** (module 11) needs a running application.
- New vulnerabilities (CVEs) are published for code that is already in production. An image that was clean yesterday can have a CRITICAL finding today.
- Runtime detection (Falco, CloudTrail, WAF) catches what slipped past all the controls.

That is why, alongside shift-left, people talk about **shift-right**: monitoring and re-scanning what has already shipped. A mature program has both.

> **In practice:** "shift-left" does not mean "dump the work on developers." If a developer gets 400 unprioritized findings in an MR, they will learn to ignore them. Shift-left only works when the signal is clean: few false positives, a clear message about what to fix and how.

## Secure SDLC: NIST SSDF

**NIST SP 800-218**, the **Secure Software Development Framework (SSDF)**, is a framework of practices for secure software development. The current final version is **1.1** (February 2022). In December 2025 NIST published a draft of **SP 800-218 Rev. 1 (SSDF 1.2)**; until the draft becomes final, reference 1.1 and track the changes. There is also the **SP 800-218A** profile for generative AI.

The SSDF does not prescribe tools. It describes **what** an organization should do, grouped into four practice groups:

| Group | Name | What it means in the pipeline (examples) |
|---|---|---|
| **PO** | Prepare the Organization | Defined security requirements, roles, criteria for security checks (e.g. "a CRITICAL vulnerability blocks the release"), a secure build environment and tooling |
| **PS** | Protect the Software | Protecting code from unauthorized changes (protected branches, review), a mechanism to verify release integrity (signatures), archiving releases with provenance data (SBOM, provenance) |
| **PW** | Produce Well-Secured Software | Threat modeling in design, code review and analysis (SAST, code review), testing executable code (DAST), verifying third-party components (SCA), secure defaults |
| **RV** | Respond to Vulnerabilities | Ongoing vulnerability discovery, assessment and prioritization, remediation, root cause analysis so the class of bug does not recur |

Each practice has an identifier (e.g. **PW.7** review human-readable code, **PW.8** test executable code, **PS.2** verify release integrity) and tasks (e.g. PW.7.2). These identifiers are useful when you build a report for an audit: you can map every job in the pipeline to a practice.

```yaml
# Example: a comment in .gitlab-ci.yml that ties a job to an SSDF practice
secret-scan:        # SSDF PS.1 (protect code), PW.7 (code analysis)
  stage: test
  script:
    - gitleaks git --redact --report-format sarif --report-path gitleaks.sarif
```

In the US the SSDF became the basis for software vendors' self-attestation to the government (the CISA Secure Software Development Attestation Form, a consequence of **EO 14028**). In the EU a similar role for products with digital elements is played by the **Cyber Resilience Act** (details in module 10).

> **In practice:** when management asks "are we SSDF compliant," don't answer with a list of tools. Build a table: practice → control → evidence (job, artifact, policy). A pipeline that produces SARIF reports, SBOMs and signatures automatically provides most of the evidence.

## Maturity models: DSOMM and SAMM

The SSDF says what to do. Maturity models help you answer the question: **where are we now and what is the next step**.

### OWASP DSOMM

The **OWASP DevSecOps Maturity Model (DSOMM)** was built specifically for the pipeline. Activities are grouped into **dimensions** and sub-dimensions, and each activity has a maturity level (lower level = a basic, easy-to-adopt practice; higher = advanced, more expensive). The dimensions are:

- **Build and Deployment** (e.g. a defined build process, artifact signing, secrets management in the pipeline)
- **Culture and Organization** (education, security champions, processes)
- **Implementation** (hardening the application and infrastructure, e.g. minimal images, secure headers)
- **Information Gathering** (logging, monitoring, finding metrics)
- **Test and Verification** (SAST, SCA, DAST, infrastructure tests, findings management)

DSOMM also has a tool (a web application) where you mark which activities are implemented and get a heat map per dimension. It is good for conversations with the team: "we're strong on Test and Verification, Build and Deployment is lagging."

### OWASP SAMM v2

**OWASP SAMM (Software Assurance Maturity Model) v2** is a broader, organizational model. It has **5 business functions**, each with **3 security practices** (15 in total), and each practice has two streams (stream A and B) and **3 maturity levels**:

| Business function | Practices |
|---|---|
| Governance | Strategy & Metrics, Policy & Compliance, Education & Guidance |
| Design | Threat Assessment, Security Requirements, Security Architecture |
| Implementation | Secure Build, Secure Deployment, Defect Management |
| Verification | Architecture Assessment, Requirements-driven Testing, Security Testing |
| Operations | Incident Management, Environment Management, Operational Management |

A SAMM assessment is done with a questionnaire (there is an official toolbox), and the result is a score per practice and a target profile.

### When to use which

| | **NIST SSDF** | **OWASP SAMM v2** | **OWASP DSOMM** |
|---|---|---|---|
| Type | Practice framework (what to do) | Organizational maturity model | Maturity model for DevSecOps activities |
| Focus | Whole SDLC, compliance, suppliers | Whole software security program, including governance | Pipeline, automation, technical activities |
| Granularity | Practices and tasks (PO/PS/PW/RV) | 15 practices × 3 levels | Many concrete activities per level |
| For whom | Audit, management, customers | CISO, AppSec program | DevOps/platform and AppSec teams |
| Typical use | "Prove you do secure development" | Annual assessment and roadmap | Sprint-level plan: what to introduce next |

These frameworks are not mutually exclusive. A common combination: SSDF as an obligation to customers and regulators, SAMM for the annual program assessment, DSOMM for the pipeline team's concrete plan.

> **In practice:** don't try to reach the top level in every dimension right away. Pick two or three lower-level activities that give the most value (secret detection, SCA over lockfiles, protected branches), roll them out to all repos, and only then go deeper. Ten repos with basic controls are worth more than one "perfect" repo.

## Threat modeling

**Threat modeling** is structured thinking about what can go wrong. The simplest framework is the four questions (Adam Shostack, Threat Modeling Manifesto):

1. What are we working on? (a diagram: components, data flows, **trust boundaries**)
2. What can go wrong? (threats)
3. What are we going to do about it? (controls, risk acceptance)
4. Did we do a good job? (verification, iteration)

### STRIDE

For question 2 the most common tool is **STRIDE**, organized by threat category:

| Letter | Threat | Property violated | Example in kurs-shop | Example in the pipeline |
|---|---|---|---|---|
| **S** | Spoofing | Authenticity | A stolen `SECRET_KEY` allows forged sessions | Someone impersonates a CI job to AWS with a stolen static key |
| **T** | Tampering | Integrity | SQL injection changes data in the database | A modified `.gitlab-ci.yml` or a dependency with malicious code |
| **R** | Repudiation | Non-repudiation | No audit log for an order change | A force push to `main` with no trace of who did it |
| **I** | Information disclosure | Confidentiality | `debug=True` reveals the stack trace and configuration | A secret printed in a job log or left in an artifact |
| **D** | Denial of service | Availability | Expensive queries without limits | A crypto miner on a shared runner |
| **E** | Elevation of privilege | Authorization | `subprocess` with `shell=True` gives command execution | A job on a runner with privileged Docker takes over the host |

Alternatives and complements: **LINDDUN** (privacy), **PASTA** (risk-centric, with business context), attack trees. For diagrams people use **OWASP Threat Dragon** or threat models as code (e.g. `pytm`), which can live in the repo and change through MRs.

### The pipeline is also a system you model

Most teams model the application and forget the pipeline. Yet the pipeline has access to source code, production secrets, the registry and the cloud account. Trust boundaries in a typical GitLab flow:

```text
 developer laptop ──push──▶ GitLab (repo, MR, variables)
                                │ triggers
                                ▼
                         runner (executes scripts from the repo!)
                     ┌──────────┼──────────────┬──────────────┐
                     ▼          ▼              ▼              ▼
              package registries OCI registry  Vault / AWS    Kubernetes
              (PyPI, npm)       (images)       (secrets, IAM) (deploy)
```

The key observation: **the pipeline executes everything in the repo**. Whoever can change `.gitlab-ci.yml`, a `Makefile`, `requirements.txt` or a test script can run code on the runner with that job's secrets. This is the basis of the **Poisoned Pipeline Execution** attack (module 02).

### A short exercise on kurs-shop

Take `/root/kurs-shop` and walk through the components:

```bash
cd /root/kurs-shop
git log --oneline | head
ls -R | head -40
cat .gitlab-ci.yml
```

Example result (abridged):

| Component | Threat (STRIDE) | Control | Stage | Module |
|---|---|---|---|---|
| `config/settings.py` in history | I: leaked AWS key and Slack webhook | gitleaks over full history, pre-commit hook, rotation | pre-commit, MR | 03 |
| `app.py` | T/E: SQL injection, command injection, `yaml.load` | Semgrep SAST with `--error` for HIGH rules | MR | 05 |
| `requirements.txt`, `package-lock.json` | T: known vulnerabilities in dependencies | osv-scanner / Trivy SCA | MR | 06 |
| `infra/main.tf` | I/E: public S3, SG port 22 open to the world, public RDS | Checkov / Trivy config | MR | 07 |
| `Dockerfile` | E: root, `latest`, token in `ENV` | hadolint, Trivy image | build | 08 |
| `k8s/deployment.yaml` | E: privileged, hostPath `/` | Conftest / Kyverno | MR and admission | 09 |
| built image | T: substituted image | SBOM, cosign signature, provenance | release | 10 |
| running application | I: missing security headers | ZAP baseline | staging | 11 |
| `.gitlab-ci.yml` | T/E: pipeline modification, secret theft | protected branches, CODEOWNERS, `id_tokens` | platform | 02 |

> **In practice:** a threat model does not have to be a 40-page document. An hour with the team, a whiteboard, a data flow diagram and STRIDE per trust boundary give 80% of the value. Repeat it when the architecture changes significantly (a new integration, a new kind of secret, a new deploy target), not on a calendar schedule.

## Controls per pipeline stage

Once you know the threats, you choose controls. Each control has its natural place: as early as possible, but only once there is something to check.

| Stage | Control | Tool in the course | What it catches | Speed |
|---|---|---|---|---|
| IDE / pre-commit | Secret detection, lint | gitleaks, pre-commit | Secrets before they enter history | seconds |
| Push (server) | Push protection | GitLab secret push protection, GitHub push protection | Secrets that bypassed the local hook | seconds |
| MR / commit | **SAST** | Semgrep | Vulnerable patterns in code | seconds–minutes |
| MR / commit | **SCA** | osv-scanner, Trivy fs | Known CVEs in dependencies, licenses | seconds |
| MR / commit | IaC scanning | Checkov, Trivy config | Misconfigurations in Terraform, K8s, Dockerfiles | seconds |
| MR / commit | Policy as code | Conftest/OPA, Kyverno CLI | Violations of internal rules (e.g. no privileged) | seconds |
| Build | Image scanning, Dockerfile lint | Trivy image, hadolint | OS packages, root user, secrets in layers | minutes |
| Release | SBOM, signature, provenance | Syft, cosign, SLSA | Artifact substitution, unknown contents | seconds |
| Staging | **DAST** | OWASP ZAP | Vulnerabilities visible only at runtime (headers, injections) | minutes–hours |
| Deploy | Admission control | Kyverno (verifyImages) | Unsigned images, forbidden settings | instant |
| Production | Continuous scanning, monitoring | Trivy over the registry, runtime tools | New CVEs in old artifacts | continuous |

### SAST, SCA, DAST, IAST

| | **SAST** | **SCA** | **DAST** | **IAST** |
|---|---|---|---|---|
| What it analyzes | Source code (without running it) | Dependencies and their versions | The running application from outside (HTTP) | The application from inside, an agent in the runtime during tests |
| When in the pipeline | MR, early | MR, early; and continuously over production | After deploy to a test environment | During integration tests |
| Strength | Exact line of code, fast | Fast, clear fix (upgrade) | Findings that are actually exploitable | Few false positives, context |
| Weakness | False positives, doesn't see runtime configuration | Doesn't know whether the vulnerable function is used | Slow, doesn't know where the bug is in the code | Agent per language, needs good test coverage |
| In the course | Semgrep (module 05) | osv-scanner, Trivy (module 06) | ZAP (module 11) | theory only |

### Gate: when the pipeline may fail

A **quality gate** (or **security gate**) is a rule that decides whether a build passes. Three states are useful:

- **informational**: the tool runs, results go into a report, the build never fails (`allow_failure: true` or `--exit-code 0`);
- **warning**: the job is yellow (`allow_failure: true` with a non-zero exit code), but the pipeline continues;
- **blocking**: the job fails and the deploy goes no further.

The typical path for a new tool: informational (2–4 weeks, you measure false positives) → blocking only for new high-severity findings → gradually stricter. Details on thresholds and exceptions are in module 12.

```yaml
# New tool, first two weeks: runs, but doesn't block
sast:
  stage: test
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off --sarif --output semgrep.sarif .
  artifacts:
    when: always
    paths: [semgrep.sarif]
  allow_failure: true
```

GitLab also allows finer control: `allow_failure: exit_codes: [2]` means only exit code 2 is "allowed" (e.g. a warning), and any other failure blocks.

```yaml
iac-scan:
  script:
    - ./scripts/iac-gate.sh     # exit 0 = clean, 2 = only MEDIUM findings, 1 = HIGH/CRITICAL
  allow_failure:
    exit_codes: [2]
```

> **In practice:** a blocking gate without an exception process is a recipe for `allow_failure: true` everywhere within a month. Before you turn on blocking, agree on: who approves an exception, where it is recorded (e.g. `.trivyignore.yaml` with an expiry, via MR), and how long it is valid.

## The first pipeline: what we have

The repo has only build and test. Look at it and run it locally with **gitlab-ci-local** (it executes real GitLab CI syntax in the container's shell):

```bash
cd /root/kurs-shop
cat .gitlab-ci.yml
gitlab-ci-local --list          # list of jobs, stage and when
gitlab-ci-local                 # run the whole pipeline
gitlab-ci-local test            # run only the "test" job
```

Variables that in GitLab would live in Settings → CI/CD → Variables go here into `.gitlab-ci-local-variables.yml` (don't commit that file; add it to `.gitignore`):

```yaml
# .gitlab-ci-local-variables.yml
REGISTRY: 127.0.0.1:5000
```

### Skeleton of a DevSecOps pipeline

The goal of the course is a pipeline roughly of this shape. This is just the skeleton; we fill in each job in its own module.

```yaml
stages: [secrets, test, build, scan-image, release, dast]

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG

secret-detection:       # module 03
  stage: secrets
  script: [ "gitleaks git --redact --report-format sarif --report-path gitleaks.sarif" ]

sast:                   # module 05
  stage: test
  needs: []
  script: [ "semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off --error ." ]

sca:                    # module 06
  stage: test
  needs: []
  script: [ "osv-scanner scan source --offline-vulnerabilities -r ." ]

iac:                    # module 07
  stage: test
  needs: []
  script: [ "checkov -d infra --framework terraform" ]

build:
  stage: build
  script: [ "echo 'image build (crane in the lab, BuildKit/Kaniko/Buildah in practice)'" ]

image-scan:             # module 08
  stage: scan-image
  script: [ "trivy image --severity HIGH,CRITICAL --exit-code 1 $REGISTRY/kurs-shop:$CI_COMMIT_SHORT_SHA" ]
```

Notice `needs: []` on the fast scanners: they don't wait for the previous stage, so the developer gets SAST, SCA and IaC scan results in parallel, within seconds. `workflow:rules` prevents duplicate pipelines (branch + MR) for the same commit.

> **In practice:** the rollout order that hurts least: (1) secret detection, because it's cheap and the damage is the greatest; (2) SCA, because the fix is usually just an upgrade; (3) IaC scanning; (4) SAST with a small set of high-confidence rules; (5) image scanning; (6) signatures and admission; (7) DAST. Each step informational first, then blocking.

### Metrics

To know whether the program is progressing, measure:

- **MTTR** for findings by severity (how many days from discovery to fix);
- the number of open CRITICAL/HIGH findings per service over time;
- the false positive rate per tool (if it's high, developers stop reading findings);
- coverage: what percentage of repos has each control;
- the number of exceptions and how many expired without review.

## Related certifications

There is no single mandatory exam for this phase. If you want proof of knowledge: **Practical DevSecOps CDP** (a hands-on exam on a pipeline), **HashiCorp Vault Associate (003)** for secrets, GitLab Certified Security Specialist and GitHub Advanced Security for platform features.

## Summary

- DevSecOps = automated security controls in the same flow as build and deploy, with findings that reach the developer in the MR.
- **Shift-left** lowers the cost of a fix, but **shift-right** (continuous scanning, DAST, monitoring) is still needed.
- **NIST SSDF** (SP 800-218, current 1.1; 1.2 draft from December 2025) groups practices into **PO, PS, PW, RV**; you can map each job to a practice as evidence.
- **OWASP SAMM v2**: 5 business functions × 3 practices × 3 levels, for an organizational program. **OWASP DSOMM**: dimensions and activities per level, for the pipeline team's plan.
- Threat modeling: the four questions and **STRIDE**; model the **pipeline** too, because it executes everything from the repo and holds secrets.
- Put each control in the earliest stage where it has something to check: secrets in pre-commit, SAST/SCA/IaC in the MR, images at build, DAST in staging, admission at deploy.
- Every new gate starts as informational, then becomes blocking for new severe findings, with an agreed exception process.
