## What this module covers

Two objectives from domain 4:

- **4.2** Secure container builds: Dockerfile linting (**hadolint**), minimal and **distroless** images, non-root, **multi-stage** builds.
- **4.3** Image scanning and **gating**: severity thresholds, unfixed vulnerabilities, `.trivyignore` and **VEX**.

Where the controls sit in the pipeline: Dockerfile linting goes into an early stage (it runs on source code, in seconds). Image scanning goes **after the build and before signing and deployment**: you scan exactly the image (by digest) that will go to production.

The threats they prevent: known vulnerabilities in the image's OS packages and libraries, secrets baked into layers, a container running as root, and tools (shell, `curl`, `apt`) an attacker uses after a breach.

In the CKS course you scanned images in the cluster. Here the question is different: **when the build is allowed to fail**, how to deal with hundreds of CVEs in a base image, and how to record the decision "this does not affect us" so that the pipeline respects it.

## What is wrong with this Dockerfile

```dockerfile
FROM python:latest
ADD . /app
WORKDIR /app
RUN apt-get update && apt-get install -y curl iputils-ping
RUN pip install -r requirements.txt
ENV API_TOKEN=glpat-Xk9vQ2mR7tLw4ZpN8sYc
EXPOSE 8080
CMD python app.py
```

| Line | Problem | hadolint | Trivy | Checkov |
|---|---|---|---|---|
| `FROM python:latest` | the build is not reproducible, full image (~1 GB) | DL3007 | DS-0001 | CKV_DOCKER_7 |
| `ADD . /app` | `ADD` unpacks archives and downloads URLs; also copies `.git`, `.env` | DL3020 | DS-0005 | CKV_DOCKER_4 |
| `apt-get install -y curl ...` | no versions, no `--no-install-recommends`, the lists stay in the layer | DL3008, DL3015, DL3009 | | |
| `pip install -r ...` | the pip cache stays in the image | DL3042 | | |
| `ENV API_TOKEN=...` | the secret is in the image configuration, visible to anyone who pulls the image | (no rule) | secret scanner | |
| no `USER` | the process runs as root | (no rule) | DS-0002 | CKV_DOCKER_3 |
| `CMD python app.py` | shell form: the process does not receive SIGTERM | DL3025 | | |

Two things that surprise people:

- The hadolint rule **DL3002** ("Last user should not be root") fires only when you explicitly write `USER root` as the last `USER`. A Dockerfile **without** a `USER` instruction is not reported by hadolint. For that you need Trivy (DS-0002) or Checkov (CKV_DOCKER_3).
- No linter understands that `glpat-...` is a GitLab token. Secrets are caught by secret scanners (gitleaks in the repo, `trivy image --scanners secret` in the image). And once a secret has been in an image that was pushed to a registry, **rotating the token** is mandatory; deleting the line from the Dockerfile does not delete the old layer.

## hadolint

**hadolint** parses the Dockerfile and checks DL (Dockerfile) and SC (ShellCheck on `RUN` commands) rules.

```bash
cd /root/kurs-shop
hadolint Dockerfile
hadolint --failure-threshold error Dockerfile      # fails only on error
hadolint -t warning --ignore DL3008 Dockerfile
hadolint -f sarif Dockerfile > hadolint.sarif
hadolint -f gitlab_codeclimate Dockerfile > hadolint-cq.json
```

The severities are `error`, `warning`, `info`, `style`. By default any finding gives exit 1; `--failure-threshold` (`-t`) says from which severity upward the build fails, but **all** findings are still printed. `--no-fail` always returns 0.

### `.hadolint.yaml`

```yaml
# /root/kurs-shop/.hadolint.yaml
failure-threshold: warning
ignored:
  - DL3059          # multiple consecutive RUNs: readability matters more to us
trustedRegistries:
  - 127.0.0.1:5000
  - registry.kurs-shop.ba
override:
  error:
    - DL3007        # a latest tag breaks the build for us
    - DL3020
```

- `trustedRegistries` enables rule **DL3026**: a `FROM` from a registry outside the list is an error. This is a cheap way to prevent `FROM someuser/python-with-extras`.
- `override` changes the severity of individual rules. That way a rule that is `warning` by default becomes part of the gate even when the threshold is `error`.
- If you use `--ignore` on the command line, the `ignored` list from the file is disregarded. Keep the configuration in one place.

### Inline exception

```dockerfile
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

The comment applies only to the **next** instruction. hadolint has no field for a reason or an expiry date, so write the reason in the line above (`# Debian stable: pinning apt versions breaks the build on every security update; the image is rebuilt daily. SEC-131`).

> **In practice:** DL3008 (pin apt versions) is the most frequently ignored rule, and for good reason: Debian removes old package versions from the archive, so a pinned build fails as soon as a security patch is released. A more mature alternative is to pin the **base image by digest** and rebuild regularly (automatically, e.g. with Renovate) instead of pinning every package.

### Job

```yaml
lint-dockerfile:
  stage: sast
  needs: []
  script:
    - hadolint --no-fail -f gitlab_codeclimate Dockerfile > hadolint-cq.json
    - hadolint Dockerfile      # readable output in the log and an exit code for the gate
  artifacts:
    when: always
    reports:
      codequality: hadolint-cq.json
  rules:
    - changes: [Dockerfile, .hadolint.yaml]
```

GitLab shows the `gitlab_codeclimate` format as Code Quality findings in the MR, directly on the changed lines.

## A secure Dockerfile

### Multi-stage and distroless

A **multi-stage build** separates the build environment (compilers, pip, header files) from the runtime environment. You copy only the result into the final image.

**Distroless** images (the `GoogleContainerTools/distroless` project, `gcr.io/distroless/...`) contain only the language runtime and its dependencies: **no shell, no package manager**, no `curl`. The `:nonroot` tag sets the user `nonroot` (UID 65532); `:debug` adds a busybox shell for troubleshooting and does not go to production.

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim@sha256:<digest> AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --target /install -r requirements.txt
COPY app.py .

FROM gcr.io/distroless/python3-debian13:nonroot@sha256:<digest>
WORKDIR /app
COPY --from=build /install /app/site-packages
COPY --from=build /src/app.py /app/
ENV PYTHONPATH=/app/site-packages
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/bin/python3", "/app/app.py"]
```

What matters here:

- **The Python version in the build stage must match the runtime.** `python3-debian13` has Python 3.13, `python3-debian12` (which is in the lab's local registry) has Python 3.11. Packages with C extensions (PyYAML) installed for a different version will not load.
- **`COPY` instead of `ADD`**, and only the files you need. Plus a `.dockerignore` with `.git`, `.env`, `tests/`, `infra/`.
- **A digest instead of a tag.** The `3.13-slim` tag moves; the digest `sha256:...` is immutable. You get the digest with `crane digest 127.0.0.1:5000/python:3.13-slim`, and you automate updates (Renovate/Dependabot open an MR when the digest changes).
- **A numeric `USER`.** Kubernetes `runAsNonRoot: true` cannot check a user name (`nonroot`), only a UID. With `USER 65532:65532` the kubelet knows it is not root.
- **Exec form `ENTRYPOINT`** (a JSON array): there is no shell that would receive the signal instead of the application, and a distroless image has no shell anyway.
- **No secrets.** If the build needs a token (private PyPI), use a BuildKit secret mount: `RUN --mount=type=secret,id=pip_token ...`; the secret does not end up in a layer or in the history.

### Comparing base images

| Base image | Shell / package manager | Typical number of OS packages | When |
|---|---|---|---|
| `python:3.13` (full) | yes / apt | hundreds | only as a build stage |
| `python:3.13-slim` | yes / apt | ~100 | when the application needs OS tools |
| `alpine:3.x` + Python | yes / apk | few | musl instead of glibc: problems with wheels |
| `distroless/python3-*:nonroot` | no / no | very few | production, when the application has no OS dependencies |
| `scratch` | no / no | zero | static Go/Rust binaries |

Fewer packages means fewer CVEs, fewer false positives in the scanner and fewer tools for an attacker. But distroless has a cost: there is no `kubectl exec ... sh` for debugging (use ephemeral containers, `kubectl debug`), and you cannot add a package with `apt`.

> **In practice:** Moving to distroless often halves the time a team spends triaging image findings, because CVEs in `perl`, `bash`, `ncurses` and similar packages that the application never calls disappear. Developers accept that argument more easily than "it's more secure".

### Building in the pipeline

In a real pipeline the image is built by **BuildKit** (`docker buildx build`), **Buildah** (daemonless, rootless) or a **Kaniko**-compatible builder (the original Google repo was archived in 2025; a fork is maintained). Avoid Docker-in-Docker with a `privileged: true` runner if you can: a privileged runner is a compromised host as soon as someone injects a malicious job.

There is no Docker daemon in the lab, so we assemble the image directly in the registry with **crane** (`127.0.0.1:5000`, start it with `registry-up`):

```bash
registry-up
mkdir -p build/app && cp app.py build/app/
tar -C build -cf app.tar app
crane append -b 127.0.0.1:5000/distroless/python3-debian12:nonroot \
  -f app.tar -t 127.0.0.1:5000/kurs-shop:dev
crane mutate 127.0.0.1:5000/kurs-shop:dev \
  --entrypoint /usr/bin/python3,/app/app.py --workdir /app --user 65532 \
  -t 127.0.0.1:5000/kurs-shop:1.0
crane config 127.0.0.1:5000/kurs-shop:1.0 | jq '.config | {User, Entrypoint, Env}'
crane digest 127.0.0.1:5000/kurs-shop:1.0
```

The example packages only `app.py`; in a real build the dependencies go into the same layer as well (`site-packages` from the build stage, installed for the same Python version). `crane append` adds a layer (a tar archive) on top of the base image, and `crane mutate` changes the configuration (entrypoint, user, working directory). The result is the same kind of OCI image that BuildKit would produce; the scanner and cosign see no difference. The same `crane config` also shows you the problem with the original Dockerfile: `API_TOKEN` sits in `.config.Env` for anyone with access to the registry.

## Scanning an image with Trivy

```bash
IMG=127.0.0.1:5000/python:3.9-slim
trivy image $IMG                                     # all vulnerabilities
trivy image --severity HIGH,CRITICAL $IMG
trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 $IMG
trivy image --scanners vuln,secret $IMG
trivy image --pkg-types os $IMG                      # OS packages only
trivy image --pkg-types library $IMG                 # only pip/npm/... in the image
trivy image --format json --output trivy-image.json $IMG
trivy image --format sarif --output trivy-image.sarif $IMG
```

In the lab Trivy reads images directly from the registry over HTTP (configuration in `/etc/trivy/trivy.yaml`), and the vulnerability database is local; nothing is downloaded from the network. In a pipeline with network access, cache the database (`TRIVY_CACHE_DIR` + GitLab `cache:`) so that each job doesn't download hundreds of megabytes.

Try the same commands on `python:3.9-slim`, `python:3.13-slim` and `distroless/python3-debian12:nonroot`. The difference in the number of findings is the best argument for choosing a base image.

### Thresholds: what breaks the build

Three switches define the gate:

| Flag | What it does |
|---|---|
| `--severity HIGH,CRITICAL` | shows (and counts toward the exit code) only those severities |
| `--exit-code 1` | exit 1 if any finding remains; without it Trivy always returns 0 |
| `--ignore-unfixed` | drops vulnerabilities for which no fixed version exists |

**Unfixed vulnerabilities** are the key decision. `--ignore-unfixed` is shorthand for `--ignore-status affected,will_not_fix,fix_deferred,end_of_life`: only findings with the status `fixed` remain, i.e. the ones a developer **can** resolve by updating. A gate that fails on something nobody can fix only teaches the team to ignore the pipeline. But "unfixed" does not mean "no risk": you still want such findings in the report and in triage.

That is why image scanning is usually split into two jobs:

```yaml
image-scan-report:
  stage: test
  needs: [build-image]
  script:
    - trivy image --format json --output trivy-image.json "$IMAGE"
    - trivy image --format sarif --output trivy-image.sarif "$IMAGE"
  artifacts:
    when: always
    paths: [trivy-image.json, trivy-image.sarif]

image-scan-gate:
  stage: test
  needs: [build-image]
  script:
    - trivy image --severity CRITICAL,HIGH --ignore-unfixed
        --ignorefile .trivyignore.yaml --vex kurs-shop.openvex.json
        --exit-code 1 "$IMAGE"
```

The first job records **everything** (for DefectDojo and trends); the second breaks the build only on what is urgent and fixable. Set the `$IMAGE` variable to the digest the build job produced (e.g. via `artifacts:reports:dotenv`), not to a moving tag; that way you scan exactly the image you are going to sign.

GitLab also has its own template `Jobs/Container-Scanning.gitlab-ci.yml` (it uses Trivy internally) with an `artifacts:reports:container_scanning` report for the MR widget and the Vulnerability Report. On GitHub the equivalent is the `aquasecurity/trivy-action` step with a SARIF upload.

> **In practice:** The threshold does not have to be the same everywhere. A common setup: on an MR only `CRITICAL` with a fix fails, on the main branch `HIGH,CRITICAL` with a fix, and a scheduled nightly scan of existing production images (without a gate) opens tickets. A new vulnerability in an old image is not discovered by a build but by rescanning.

## Exceptions: `.trivyignore` and `.trivyignore.yaml`

Trivy reads a plain `.trivyignore` in the project root automatically. One ID per line, with an optional expiry:

```text
# .trivyignore
# PyYAML 5.3.1: the upgrade to 6.x is in MR !42; until then the app uses only yaml.safe_load. SEC-140
CVE-2020-14343 exp:2026-11-15
```

The YAML variant is more precise (by path or by package PURL) and has a field for the justification. It is marked as experimental and is loaded only with `--ignorefile`:

```yaml
# .trivyignore.yaml
vulnerabilities:
  - id: CVE-2020-14343
    purls:
      - pkg:pypi/pyyaml@5.3.1
    statement: "Upgrade in MR !42; until then only yaml.safe_load (Semgrep rule kurs.yaml-load). SEC-140"
    expired_at: 2026-11-15
secrets:
  - id: generic-api-key
    paths: ["tests/fixtures/fake_keys.txt"]
    statement: "Fake keys for tests"
```

When the date in `exp:` or `expired_at` passes, the exception stops applying and the gate fails again. That is the desired behavior: an exception without an expiry is a permanent risk acceptance that nobody reviews anymore. With `--show-suppressed` Trivy also shows suppressed findings, which is useful for audits.

## VEX: "the vulnerability exists, but it doesn't affect us"

**VEX** (Vulnerability Exploitability eXchange) is a machine-readable statement of whether a product is affected by a particular vulnerability. Unlike `.trivyignore`, which is the internal configuration of a single tool, VEX is a **standardized document** that you can publish alongside the image, sign, and give to a customer or another tool.

Trivy reads OpenVEX, CycloneDX VEX and CSAF (support is marked as experimental):

```json
{
  "@context": "https://openvex.dev/ns/v0.2.0",
  "@id": "https://kurs-shop.ba/vex/kurs-shop-2026-10",
  "author": "Kurs Shop security team",
  "timestamp": "2026-10-16T09:00:00Z",
  "version": 1,
  "statements": [
    {
      "vulnerability": { "name": "CVE-2020-14343" },
      "products": [
        {
          "@id": "pkg:oci/kurs-shop?repository_url=127.0.0.1:5000%2Fkurs-shop",
          "subcomponents": [ { "@id": "pkg:pypi/pyyaml" } ]
        }
      ],
      "status": "not_affected",
      "justification": "vulnerable_code_not_in_execute_path",
      "impact_statement": "The application uses only yaml.safe_load."
    }
  ]
}
```

This statement is true only once `app.py` has been switched from `yaml.load(..., Loader=yaml.Loader)` to `yaml.safe_load`; for the repo as it is now it would be a lie, and a VEX that lies is worse than none. For a vulnerability that has a fix, the right solution is upgrading the package anyway.

```bash
trivy image --vex kurs-shop.openvex.json 127.0.0.1:5000/kurs-shop:1.0
```

The statuses in OpenVEX are `not_affected`, `affected`, `fixed` and `under_investigation`. For `not_affected` a justification (`justification`) is required: e.g. `component_not_present`, `vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`, `vulnerable_code_cannot_be_controlled_by_adversary`, `inline_mitigations_already_exist`. Trivy removes vulnerabilities marked as `not_affected` from the report and records this in the log.

`--vex` can be repeated and combined: a local file, `--vex repo` (public VEX repositories) and `--vex oci` (a VEX attestation attached to the image in the registry, see module 10).

| | `.trivyignore` / `.yaml` | VEX |
|---|---|---|
| Format | Trivy-specific | standard (OpenVEX, CycloneDX, CSAF) |
| Who reads it | Trivy | Trivy, Grype and other tools, customers |
| Justification | free text (`statement`) | prescribed `justification` values |
| Expiry | `exp:` / `expired_at` | none; a new version of the document |
| Distribution | in the repo | with the image, signed (attestation) |
| When | an internal team decision, temporary | a lasting claim about the product |

> **In practice:** Don't write VEX "on a hunch". `vulnerable_code_not_in_execute_path` is a claim someone must be able to verify: a link to a Semgrep rule or a test that proves the vulnerable function is not called. If you don't have that, use `.trivyignore.yaml` with an expiry and come back to the finding.

## Summary

- hadolint lints the Dockerfile: DL3007 (`latest`), DL3020 (`ADD`), DL3008 (pin apt), DL3042 (pip cache), DL3025 (JSON form of CMD), DL3026 (allowed registries); DL3002 fires only for an explicit `USER root`, a missing `USER` is caught by Trivy (DS-0002) and Checkov (CKV_DOCKER_3).
- `.hadolint.yaml`: `failure-threshold`, `ignored`, `trustedRegistries`, `override`; an inline `# hadolint ignore=DLxxxx` applies only to the next instruction.
- A secure Dockerfile: multi-stage, distroless `:nonroot`, base image pinned by digest, numeric `USER 65532`, exec form `ENTRYPOINT`, no secrets (BuildKit secret mount), `.dockerignore`.
- A secret in `ENV` stays in the image configuration: rotate it, don't just delete the line.
- Trivy gate: `--severity`, `--exit-code 1`, `--ignore-unfixed` (= ignore statuses without a fix); separate the reporting job (everything) from the gate job (urgent and fixable).
- Scan the image by the digest the build job produced; rescan old images with a scheduled pipeline.
- Exceptions: `.trivyignore` (`ID exp:date`), `.trivyignore.yaml` (`statement`, `expired_at`, `purls`, `paths`, with `--ignorefile`); VEX (`--vex`) is a standard, distributable `not_affected` claim with a `justification`.
