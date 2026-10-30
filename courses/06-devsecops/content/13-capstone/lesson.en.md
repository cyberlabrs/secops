## Capstone goal

In the learning plan this phase has no exam: the proof of knowledge is a **pipeline** you build yourself and can explain in an interview. The capstone lab combines all modules of this course into a single `.gitlab-ci.yml` for the `kurs-shop` repo:

- the pipeline fails when it finds a secret, a critical vulnerability, an insecure Terraform configuration or an unsigned image,
- it passes when the code is fixed or when a justified exception with an expiry date exists,
- at the end it leaves artifacts: reports (SARIF/JSON), an SBOM, the image signature and provenance.

The lab has a 150-minute countdown. Tasks are checked by running your jobs with `gitlab-ci-local`, so a job has to work, not just exist in the YAML.

## Pipeline architecture

```text
 commit / MR
    │
    ▼
 ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
 │ secrets │  │   sast   │  │   sca    │  │   iac   │   fast checks, in parallel
 └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬────┘   (minutes, on every MR)
      └────────────┴──── needs ───┴─────────────┘
                         │
                    ┌────▼────┐
                    │  build  │  image + SBOM
                    └────┬────┘
              ┌──────────┼───────────┐
        ┌─────▼─────┐ ┌──▼───┐ ┌─────▼─────┐
        │image-scan │ │ dast │ │  policy   │   checks on the artifact
        └─────┬─────┘ └──┬───┘ └─────┬─────┘
              └──────────┼───────────┘
                    ┌────▼────┐
                    │  sign   │  cosign signature + attestations (protected branch only)
                    └────┬────┘
                    ┌────▼────┐
                    │ deploy  │  signature verification before deploy
                    └─────────┘
```

The order follows the cost of a mistake:

1. **Cheap and fast checks go first.** Secret scanning, SAST, SCA and IaC run on the source code in seconds or minutes and do not depend on each other, so they run in parallel in the same `stage` or with `needs: []`.
2. **Build only once the code passes.** There is no point building and scanning an image if the repo contains a leaked key.
3. **Artifact checks** (image scanning, DAST against the running application, policies on manifests) run on what will actually go to production.
4. **Signing is the last step before deploy** and runs only for what has passed all checks. That is why the signature means "this image passed our pipeline", not just "we built this".
5. **Deploy verifies the signature** instead of trusting the tag name.

## When the build may fail

| Finding | On an MR | On the main branch |
|---|---|---|
| Secret in code or history (new finding) | fails | fails |
| SAST: ERROR (injection, deserialization) | fails | fails |
| SAST: WARNING | warning (`allow_failure`) | warning |
| SCA: CRITICAL/HIGH with a fix available | fails | fails |
| SCA: no fix | warning + exception with expiry | same |
| IaC: finding without a justified exception | fails | fails |
| Image: CRITICAL with a fix | fails | fails |
| DAST baseline: FAIL rules | fails | fails |
| Unsigned image | not deployed | not deployed |

A rule from practice: **new code must not introduce new problems**, while old debt is paid down in a planned way, with exceptions that expire. When you introduce a tool into an existing repo, first run it with `allow_failure: true` and a baseline, then turn it into a gate once the team has cleaned up the existing findings.

> **In practice:** every exception (`.gitleaksignore`, `# nosemgrep`, `osv-scanner.toml`, `#checkov:skip`, `.trivyignore.yaml`) must have a **reason** and, where the tool supports it, an **expiry date**. An exception without an expiry is a permanently disabled control.

## `.gitlab-ci.yml` skeleton

This is a starting point, not the solution: in the lab you fill in the commands and thresholds.

```yaml
stages: [scan, build, verify, sign, deploy]

default:
  interruptible: true

secrets:
  stage: scan
  script:
    - gitleaks git --redact --report-format sarif --report-path gitleaks.sarif
  artifacts:
    when: always
    paths: [gitleaks.sarif]

sast:
  stage: scan
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --error --sarif --output semgrep.sarif .
  artifacts:
    when: always
    paths: [semgrep.sarif]

# sca, iac ...

build:
  stage: build
  script:
    - ./ci/build.sh            # image to the registry + SBOM
  artifacts:
    paths: [image.txt, sbom.cdx.json]

image-scan:
  stage: verify
  needs: [build]
  script:
    - trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 "$(cat image.txt)"

sign:
  stage: sign
  needs: [build, image-scan]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - cosign sign --key "$COSIGN_KEY" "$(cat image.txt)"
```

> **In practice:** `artifacts: when: always` matters for security jobs. Without it the report disappears exactly when the job failed, which is when you need it most.

## What is left for real GitLab

The lab runs offline, so some things in it are only simulated. In a real project:

- **Images** are built with BuildKit (`docker buildx`), Buildah or Kaniko, not `crane append`.
- **Signing** is usually keyless (cosign + the job's OIDC identity via `id_tokens`, Fulcio and Rekor), with no key in a variable.
- **Secrets** come from Vault via `id_tokens` and `secrets:vault`, or from a cloud secret manager via OIDC federation, not as CI/CD variables.
- **Reports** go to `artifacts:reports` (`sast`, `secret_detection`, `dependency_scanning`, `container_scanning`, `cyclonedx`) or to a platform such as DefectDojo, so the developer sees them in the merge request.
- **Pipeline protection**: protected branches, mandatory approval for changes to `.gitlab-ci.yml` (CODEOWNERS), pinned images and `include` with `ref`, runners isolated by sensitivity.

## How to present the project

For your portfolio, create a public repo with:

1. `README.md`: a pipeline diagram and a table "control → threat it prevents → what we do with findings".
2. An example merge request that the pipeline blocks (leaked secret, vulnerable dependency) and its fix.
3. An exception policy: who approves, how long it lasts, where it is recorded.
4. Metrics: number of findings per tool over time, time to fix (MTTR), the share of builds the gate stops.

In an interview you will be asked **why** a control is in that place and what you do when false positives block the team, and less often which tool you use.

## Summary

- Fast source code checks (secrets, SAST, SCA, IaC) run in parallel and first; the build runs only once they pass.
- The image is scanned, tested (DAST) and checked against policies before signing; the signature means "it passed the pipeline".
- Deploy trusts the signature and the digest, not the tag.
- The gate fails on new severe findings; old debt goes into exceptions with a reason and an expiry date.
- Security jobs keep their reports even when they fail (`artifacts: when: always`).
- In a real environment: keyless signing, secrets from Vault via OIDC, reports in the MR, and the pipeline itself protected.
