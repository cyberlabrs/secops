## What this module covers

The module covers two objectives from domain 5 (**Supply Chain Security**, 20% of the exam):

- **5.1 Minimize base image footprint**: choosing a base image, multi-stage builds, a non-root user, pinning versions and removing everything that is useful to an attacker.
- **5.4 Perform static analysis of user workloads and container images (e.g. Kubesec, KubeLinter)**: tools that read a manifest or Dockerfile and report dangerous settings before you run anything.

Typical exam tasks:

- "A Dockerfile is given in `/opt/app/Dockerfile`. Fix two security issues (e.g. `USER root`, the `latest` tag) without changing functionality."
- "Scan the manifests in `/opt/manifests/` with `kubesec` and write the name of the one with the worst score to `/root/worst.txt`."
- "Run `kube-linter` against the Deployment and fix all findings from the `privileged-container` and `run-as-non-root` categories."
- "Of three Deployments, delete those that break the rules: privileged, hostPath to `/`, or a Secret in an env variable."

The exam usually has no Docker, so you don't build images: you read and fix Dockerfiles and YAML. What matters is recognizing the problem quickly.

## Why a small image is more secure

Every package in an image is a potential vulnerability (CVE) and a potential tool for an attacker. If an attacker gets code execution in a container and the image contains `bash`, `curl`, `wget`, `apt` and `nc`, they can easily download more tools and move further. In an image without a shell and package manager that step is much harder.

| Base image | Size (order of magnitude) | Shell / package manager | When |
|---|---|---|---|
| `ubuntu`, `debian` | tens of MB | yes / apt | Development, when many tools are needed |
| `alpine` | a few MB | `sh` (busybox) / apk | A small image with basic tools; musl libc instead of glibc |
| **distroless** (`gcr.io/distroless/...`) | MB to tens of MB | **no** / no | Production: only the runtime (glibc, CA certificates, tzdata), no shell |
| **scratch** | 0 | no / no | Statically linked binaries (Go with `CGO_ENABLED=0`) |
| Chainguard (`cgr.dev/chainguard/...`) | small | mostly no | Minimal images with frequent patches, few CVEs |

Distroless images have variants:

- `gcr.io/distroless/static-debian12` for static binaries, `base-debian12` when glibc is needed, plus language images (e.g. `java`, `python3`, `nodejs`).
- The `:nonroot` tag runs the process as the user `nonroot` (UID 65532).
- The `:debug` tag adds a busybox shell. Use it only for troubleshooting, never in production.

> **On the exam:** if the task asks you to "reduce the image's attack surface", the expected answer is usually replacing the base image with a smaller one (`alpine` or distroless) with a **specific tag**, not `latest`. Don't change what the application needs to run (e.g. the language runtime).

## Multi-stage builds

Build tools (compiler, `git`, `make`, dev dependencies) aren't needed in the image that runs. A multi-stage build leaves them in the first stage and copies only the result into the final image.

```dockerfile
# stage 1: build
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/app

# stage 2: runtime
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app"]
```

- The final image has no Go toolchain, no source code and no shell.
- `COPY --from=build` copies only the binary.
- For Go, `FROM scratch` is also possible, but then you have to add the CA certificates and `/etc/passwd` yourself if the application needs them.

## A non-root user

A container running as root (UID 0) becomes root on the node in case of an escape or misconfiguration (hostPath, privileged). By default, if the Dockerfile has no `USER`, the process runs as root.

```dockerfile
FROM alpine:3.22
RUN addgroup -S app && adduser -S -G app -u 10001 app
COPY --chown=app:app app /usr/local/bin/app
USER 10001
ENTRYPOINT ["/usr/local/bin/app"]
```

- Use a **numeric** UID in `USER`. The kubelet with `runAsNonRoot: true` can only verify a numeric UID; it can't reliably verify a user name (`USER app`), so it refuses to start.
- `USER` must be the **last** relevant line: `USER root` after `USER app` brings back root.
- You enforce the same in Kubernetes (`runAsNonRoot`, `runAsUser`), the topic of the previous module.

## Pinning versions and digests

| Notation | Problem / advantage |
|---|---|
| `FROM nginx` or `FROM nginx:latest` | Every build may get a different image; you don't know what runs in production |
| `FROM nginx:1.27` | Better, but a tag can move (a new patch of the same version or a malicious change) |
| `FROM nginx:1.27.5@sha256:<digest>` | Immutable: the digest is a hash of the content, same digest = same image |

You find an image's digest like this:

```bash
crictl images --digests | grep nginx
crictl inspecti docker.io/library/nginx:1.27 | grep -A2 repoDigests
kubectl get pod web -o jsonpath='{.status.containerStatuses[0].imageID}{"\n"}'
```

In a Kubernetes manifest you can also use `image: nginx@sha256:...`. The same applies to packages in the image: `apk add --no-cache curl=8.14.1-r1` instead of just `curl` (the specific version is an example).

## Dockerfile: good practices

| Practice | Bad | Good |
|---|---|---|
| Copying files | `ADD app.tar.gz /app` or `ADD https://...` | `COPY app /app`; `ADD` automatically extracts archives and downloads URLs, which is unexpected |
| Secrets | `ENV DB_PASSWORD=...`, `ARG TOKEN` then `RUN` with it, `COPY id_rsa` | BuildKit `RUN --mount=type=secret,id=...`; the secret doesn't stay in a layer |
| Deleting in a later layer | `COPY key.pem .` then `RUN rm key.pem` | The file stays in the earlier layer and can be read with `docker history`/by unpacking the image |
| Build context | No `.dockerignore` | `.dockerignore` with `.git`, `.env`, `*.pem`, `node_modules` |
| Package cache | `RUN apt-get install -y curl` | `RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*` |
| Tools | `RUN apk add bash curl vim netcat-openbsd` | Only what the application needs at runtime |
| Startup | `CMD python app.py` (shell form) | `ENTRYPOINT ["python", "app.py"]` (exec form, the process receives signals) |
| Health | No check | `HEALTHCHECK CMD ["/app", "health"]` for Docker; Kubernetes uses probes, the kubelet ignores `HEALTHCHECK` |

An example of a build-time secret that doesn't leak into a layer:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --omit=dev
COPY . .
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t app:1.0 .
```

### Removing the shell and tools

When the base isn't distroless, you can remove tools at the end of the build:

```dockerfile
FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
 && rm -f /bin/sh /bin/ash /usr/bin/wget /usr/bin/nc
```

Careful: put the `rm` in the same `RUN` line as the last step, and only once the application no longer needs a shell (exec-form `ENTRYPOINT`). Combined with `readOnlyRootFilesystem: true` in the Pod, it also prevents an attacker from adding tools at runtime.

> **On the exam:** for "fix the Dockerfile" tasks you usually need to change exactly what was asked, e.g. `USER root` to `USER nobody` or `USER 65535`, `ubuntu:latest` to `ubuntu:22.04`. Don't rework the whole file; the checker often looks at specific lines.

## Static analysis of manifests

Static analysis reads YAML (or a Helm template) and evaluates security settings without running anything. It belongs in CI before `kubectl apply`, but is also useful manually on the exam.

### kubesec

**kubesec** scores Pods, Deployments, StatefulSets and DaemonSets with points. Positive points for good practices, negative for dangerous ones.

```bash
kubesec scan pod.yaml
kubesec scan deploy.yaml --format table
kubectl get deploy web -o yaml | kubesec scan -
helm template ./chart | kubesec scan /dev/stdin
kubesec print-rules --format table          # all rules with points
```

Output (JSON, shortened):

```json
[
  {
    "object": "Pod/web.default",
    "valid": true,
    "message": "Failed with a score of -30 points",
    "score": -30,
    "scoring": {
      "critical": [
        {
          "selector": "containers[] .securityContext .privileged == true",
          "reason": "Privileged containers can allow almost completely unrestricted host access",
          "points": -30
        }
      ],
      "advise": [
        {
          "selector": "containers[] .securityContext .runAsNonRoot == true",
          "reason": "Force the running image to run as a non-root user to ensure least privilege",
          "points": 1
        }
      ]
    }
  }
]
```

- `scoring.critical`: matched rules with negative points (dangerous settings).
- `scoring.passed`: matched rules with positive points (good settings you already have).
- `scoring.advise`: what you can add to raise the score (in the JSON the key is spelled `advise`).
- `score`: the sum of points of all matched rules; higher is better. If the score is below 0, `message` says `Failed with a score of ...`, otherwise `Passed with a score of ...`.

Some rules and points (from `kubesec print-rules`):

| Rule | Condition | Points |
|---|---|---|
| Privileged | `securityContext.privileged == true` | −30 |
| CapSysAdmin | `capabilities.add == SYS_ADMIN` | −30 |
| HostNetwork / HostPID / HostIPC | `.spec.hostNetwork == true` etc. | −9 |
| DockerSock | hostPath `/var/run/docker.sock` | −9 |
| AllowPrivilegeEscalation | `allowPrivilegeEscalation == true` | −7 |
| SecretsAsEnvironmentVariables | `env.valueFrom.secretKeyRef` / `envFrom.secretRef` | −5 |
| ReadOnlyRootFilesystem, RunAsNonRoot, CapDropAll | set | +1 |
| RunAsUser | `runAsUser > 10000` | +1 |
| ServiceAccountName | set | +3 |
| ApparmorAny | `appArmorProfile.type` set | +3 |

Quickly comparing several files:

```bash
for f in /opt/manifests/*.yaml; do echo "$f $(kubesec scan $f | jq '.[0].score')"; done | sort -k2 -n
```

> **On the exam:** kubesec output is JSON, so `jq '.[0].score'` and `jq '.[0].scoring.critical'` save time. In real work don't send manifests to the public `v2.kubesec.io` service: the local binary or the Docker image (`kubesec/kubesec:v2`) does the same.

### kube-linter

**kube-linter** (StackRox) checks manifests and Helm charts against a list of checks. When it finds a problem it returns a non-zero exit code, which makes it suitable for CI.

```bash
kube-linter lint deploy.yaml
kube-linter lint /opt/manifests/
kube-linter lint ./chart                         # a Helm chart directly
kube-linter checks list                          # all checks and whether they are defaults
kube-linter lint --include privileged-container,run-as-non-root deploy.yaml
kube-linter lint --exclude unset-cpu-requirements,unset-memory-requirements deploy.yaml
kube-linter lint --format json deploy.yaml
```

Example output:

```text
deploy.yaml: (object: default/web apps/v1, Kind=Deployment) container "web" does not have a read-only root file system (check: no-read-only-root-fs, remediation: Set readOnlyRootFilesystem to true in the container securityContext.)

deploy.yaml: (object: default/web apps/v1, Kind=Deployment) container "web" is not set to runAsNonRoot (check: run-as-non-root, remediation: ...)

Error: found 2 lint errors
```

Security-relevant default checks:

| Check | What it looks for |
|---|---|
| `privileged-container` | `privileged: true` |
| `privilege-escalation-container` | `allowPrivilegeEscalation` isn't `false` |
| `run-as-non-root` | Missing `runAsNonRoot: true` / non-root UID |
| `no-read-only-root-fs` | Missing `readOnlyRootFilesystem: true` |
| `host-network`, `host-pid`, `host-ipc` | Sharing host namespaces |
| `sensitive-host-mounts` | hostPath to sensitive paths (`/etc`, `/proc`, `/var/run/docker.sock`…) |
| `docker-sock` | The Docker socket is mounted |
| `latest-tag` | An image without a tag or with `:latest` |
| `env-var-secret` | A secret value directly in env |
| `drop-net-raw-capability` | `NET_RAW` isn't dropped |
| `unsafe-sysctls` | Unsafe sysctl values |

Configuration in `.kube-linter.yaml` (looked up in the current directory) or via `--config`:

```yaml
checks:
  doNotAutoAddDefaults: true
  include:
  - privileged-container
  - run-as-non-root
  - latest-tag
```

An exception for a single object goes in an annotation with a justification:

```yaml
metadata:
  annotations:
    ignore-check.kube-linter.io/privileged-container: "CNI agent needs kernel access"
```

### Trivy config

Besides vulnerabilities in images, **Trivy** also scans for misconfigurations in Kubernetes manifests, Dockerfiles, Helm charts and Terraform. The `config` subcommand is used for that:

```bash
trivy config /opt/manifests/
trivy config --severity HIGH,CRITICAL /opt/app/
trivy config --exit-code 1 --severity CRITICAL deploy.yaml
trivy fs --scanners misconfig /opt/app/          # the same through the fs scanner
```

The output groups findings by file (file type in parentheses, e.g. `(kubernetes)`, `(dockerfile)`) and gives the check ID, severity and description, e.g. `KSV012` (the container should have `runAsNonRoot`), `KSV023` (hostPath volume) or `DS002` (the Dockerfile runs as root). The lab environment has Trivy 0.74; image scanning is the topic of the supply chain module.

### hadolint (in brief)

**hadolint** is a linter for Dockerfiles. It is useful in CI, and its rules have `DL...` IDs:

```bash
hadolint Dockerfile
```

| Rule | Meaning |
|---|---|
| DL3006 | Always specify the base image tag |
| DL3007 | Don't use `latest` |
| DL3002 | The last `USER` must not be root |
| DL3020 | Use `COPY` instead of `ADD` for files and directories |
| DL3008 | Pin apt package versions |

## Manual analysis on the exam

Tools aren't always installed, or the task says "review and fix". Have a list of what you're looking for.

### In a Kubernetes manifest

| What you look for | Why it is dangerous |
|---|---|
| `privileged: true` | Practically root on the node |
| `hostPath` (especially `/`, `/etc`, `/var/run/docker.sock`, `/var/lib/kubelet`) | Reading and modifying the node's files |
| `hostNetwork`, `hostPID`, `hostIPC: true` | Sees the node's network and processes |
| `runAsUser: 0`, no `runAsNonRoot` | The process is root |
| `allowPrivilegeEscalation: true` or missing | setuid escalation |
| `capabilities.add: [SYS_ADMIN, NET_ADMIN, ...]` | Dangerous capabilities |
| `image: ...:latest` or no tag | An unpredictable image |
| `env` with a `value:` that looks like a password/token, `secretKeyRef` in env | A secret in an env variable |
| `automountServiceAccountToken` isn't `false` when the Pod doesn't need the API | The token is available to an attacker |
| No `readOnlyRootFilesystem` | An attacker can modify files in the container |

A quick search through files:

```bash
grep -nE 'privileged: true|hostPath|hostNetwork|hostPID|hostIPC|runAsUser: 0|:latest|SYS_ADMIN|allowPrivilegeEscalation: true' /opt/manifests/*.yaml
kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[].securityContext.privileged==true) | .metadata.namespace+"/"+.metadata.name'
```

### In a Dockerfile

| What you look for | Fix |
|---|---|
| `FROM image:latest` or no tag | A specific tag, ideally a digest |
| No `USER` or `USER root` at the end | `USER` with a non-root numeric UID |
| `ENV PASSWORD=...`, `ARG TOKEN`, `COPY .ssh` | Remove the secret, use a build secret or a Kubernetes Secret at runtime |
| `ADD` with a URL or archive | `COPY` (or an explicit download with hash verification) |
| `apt-get install` of debug tools (curl, vim, netcat) | Remove; use multi-stage |
| `chmod 777`, `sudo` in the image | Remove |
| A large base image for a static binary | distroless or scratch |

An example task. A Dockerfile is given:

```dockerfile
FROM ubuntu:latest
ENV API_TOKEN=abc123
RUN apt-get update && apt-get install -y curl python3
COPY app.py /app.py
USER root
CMD python3 /app.py
```

The fixed version:

```dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*
COPY app.py /app.py
USER 65535
CMD ["python3", "/app.py"]
```

The token goes into a Kubernetes Secret mounted as a volume, and the application doesn't need `curl` at runtime.

> **On the exam:** when the task says "find the Pod that violates X and delete it", first list (`kubectl get pod -n X -o yaml | grep -n ...`) and write down the names, and only then delete. Deleting the wrong Pod in a task with a checker means zero points for that task.

## Troubleshooting

| Symptom | What to check |
|---|---|
| A Pod with `runAsNonRoot: true` in `CreateContainerConfigError` | The image has no `USER` or has a name instead of a numeric UID; add `runAsUser` or fix the Dockerfile |
| Distroless container: `kubectl exec ... -- sh` returns `executable file not found` | Expected, there's no shell; use `kubectl debug` with an ephemeral container |
| The application crashes after moving to distroless | A missing library (static vs base variant) or CA certificates |
| `kube-linter` doesn't report an expected check | The check isn't a default or is excluded in `.kube-linter.yaml`; `kube-linter checks list` |
| kubesec returns `valid: false` or the message `This resource kind is not supported by kubesec` | The manifest fails schema validation, or kubesec doesn't score that object type (e.g. Service) |
| `trivy config` finds nothing in a file | The file isn't recognized as a Kubernetes manifest (missing `apiVersion`/`kind`) |

## Summary

- A smaller image = fewer CVEs and fewer tools for an attacker; distroless and scratch have no shell or package manager.
- A multi-stage build keeps compilers and source code out of the final image (`COPY --from=build`).
- `USER` with a non-root numeric UID as the last `USER` line; confirm the same in the Pod with `runAsNonRoot`.
- Pin the tag, and for immutability also the digest (`image@sha256:...`); `latest` is forbidden in serious environments.
- Never put secrets in `ENV`, `ARG` or layers; use `COPY` instead of `ADD`, and a `.dockerignore`.
- kubesec gives a score (`critical` negative, `advise` positive), kube-linter a list of findings with the check name and an exit code, `trivy config` misconfiguration findings for YAML and Dockerfiles.
- On the exam, look manually for: privileged, hostPath, host namespaces, root, `latest`, secrets in env, dangerous capabilities.
