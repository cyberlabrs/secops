## What this module covers

The module covers two objectives from domain 5 (**Supply Chain Security**, 20% of the exam):

- **5.2** Understand your supply chain: where everything running in the cluster comes from, **SBOM**, CI/CD, artifact repositories.
- **5.3** Secure your supply chain: **allowed registries**, signing and verifying artifacts.

Typical exam tasks:

- "Scan the images of all Pods in the `prod` namespace with Trivy. Delete the Pods whose images have CRITICAL vulnerabilities."
- "Create an SBOM for the image `nginx:1.27` in SPDX JSON format and save it to `/opt/kurs/sbom.json`."
- "Enable **ImagePolicyWebhook** with the given configuration; if the backend is unavailable, Pods must be rejected."
- "Create a **ValidatingAdmissionPolicy** that allows only images from `registry.internal:5000/`."
- "Sign an image with cosign and verify the signature with the public key."

Minimal images (5.1) and static analysis (5.4) are in module 09. Here we build on that: not just "is the image small", but "do we know what's in it, where it comes from and who vouches for it".

## The supply chain: from code to Pod

The **software supply chain** is everything that happens between a commit and the process running in a Pod:

| Phase | What happens | Example attack | Defense |
|---|---|---|---|
| Source code | Git repository, dependencies (npm, pip, Go modules) | Malicious package, typosquatting, taken-over maintainer | Code review, pinned versions, lock files |
| Build (CI/CD) | The pipeline builds the image | Compromised build server or CI script | Isolated builds, short-lived tokens, **provenance** |
| Registry | The image is stored and distributed | A planted image under the same tag | Private registry, **digest**, signatures |
| Deploy | The cluster pulls the image and runs it | An image from an unknown registry | **Admission** control, signature verification |
| Runtime | The container runs | Exploit of a known CVE | Scanning, runtime detection (module 12) |

Three attacks worth knowing briefly:

- **SolarWinds (2020):** the attackers compromised the build system and inserted a backdoor into a legitimate, signed update of the Orion software. The signature was valid, but the build wasn't trustworthy.
- **Codecov (2021):** the Bash Uploader script, which CI pipelines downloaded and executed, was modified. The script sent environment variables (tokens, keys) to the attacker. Lesson: CI holds secrets, and `curl | bash` in a pipeline is trust without verification.
- **xz utils (2024, CVE-2024-3094):** the attacker spent years building trust as a maintainer and inserted a backdoor into `liblzma` in the release tarballs. Lesson: even a dependency deep in the chain can be a target.

### SLSA in brief

**SLSA** (Supply-chain Levels for Software Artifacts) is a framework with maturity levels for the build process. In version 1.0 the "Build track" has these levels:

| Level | Requirement (simplified) |
|---|---|
| L0 | No guarantees |
| L1 | **Provenance** exists: a record of how the artifact was built |
| L2 | Build on a hosted platform, the provenance is signed |
| L3 | Hardened build platform: builds are isolated, signing secrets are inaccessible to user-defined steps |

SLSA isn't configured on the exam. What matters is understanding the idea: a signature tells you **who** published an artifact, provenance tells you **how** it was built.

## SBOM: the list of ingredients

An **SBOM** (Software Bill of Materials) is a machine-readable list of all components in an artifact: packages, versions, licenses, hashes. When a new CVE comes out (e.g. in OpenSSL), with an SBOM you immediately know which images are affected, without unpacking every image again.

| | **SPDX** | **CycloneDX** |
|---|---|---|
| Maintained by | Linux Foundation (ISO/IEC 5962) | OWASP |
| Origin | Licensing and compliance | Security and risk analysis |
| Formats | JSON, tag-value, YAML, RDF | JSON, XML |
| Notable | Detailed license data | Support for VEX (whether a vulnerability is actually exploitable) |
| Trivy `--format` | `spdx-json` (or `spdx` for tag-value) | `cyclonedx` |

### SBOM with syft

```bash
# CycloneDX JSON to stdout
syft nginx:1.27 -o cyclonedx-json > /opt/kurs/nginx.cdx.json

# SPDX JSON directly to a file
syft nginx:1.27 -o spdx-json=/opt/kurs/nginx.spdx.json

# table in the terminal, for a quick look
syft nginx:1.27
```

### SBOM with Trivy

```bash
trivy image --format cyclonedx --output /opt/kurs/nginx.cdx.json nginx:1.27
trivy image --format spdx-json  --output /opt/kurs/nginx.spdx.json nginx:1.27

# check that the file really is an SBOM
jq '.bomFormat, .specVersion' /opt/kurs/nginx.cdx.json      # "CycloneDX"
jq '.spdxVersion' /opt/kurs/nginx.spdx.json                  # "SPDX-2.3"
```

### Scanning an existing SBOM

When you already have an SBOM (e.g. you got it from a vendor), you don't need the image:

```bash
trivy sbom /opt/kurs/nginx.cdx.json
trivy sbom --severity CRITICAL /opt/kurs/nginx.spdx.json
```

> **On the exam:** read the requested format carefully. `--format cyclonedx` and `--format spdx-json` are different things, and `--format json` is Trivy's own vulnerability report, **not** an SBOM. If the task says "save to a file", use `--output` (or `-o`), then check the content with `head` or `jq`.

## Scanning images with Trivy

**Trivy** scans the OS packages and application dependencies in an image and compares them against a vulnerability database. In the lab the database is local, and images come from a local mirror.

```bash
trivy image nginx:1.19                                   # all findings
trivy image --severity HIGH,CRITICAL nginx:1.19          # only the serious ones
trivy image --severity CRITICAL --ignore-unfixed nginx:1.19   # only those that have a fix
trivy image -q --severity CRITICAL nginx:1.19            # without progress messages
trivy image --exit-code 1 --severity CRITICAL nginx:1.19 # exit code 1 if there are findings (CI gate)
```

| Flag | Meaning |
|---|---|
| `--severity` | Comma-separated list of levels: `UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL` |
| `--ignore-unfixed` | Hide vulnerabilities for which there is no fixed package version yet |
| `--exit-code` | Exit code when there are findings; useful in a CI pipeline |
| `--format` | `table` (default), `json`, `cyclonedx`, `spdx-json`, `sarif` … |
| `-o`, `--output` | Write the result to a file |

Table output looks roughly like this:

```text
nginx:1.19 (debian 10.10)
Total: 38 (HIGH: 27, CRITICAL: 11)

│ Library  │ Vulnerability  │ Severity │ Status │ Installed Version │ Fixed Version │ Title
│ libssl1.1│ CVE-2021-3711  │ CRITICAL │ fixed  │ 1.1.1d-0+deb10u6  │ 1.1.1d-0+deb10u7 │ openssl: SM2 ...
```

The `Total:` line is what you need for a quick decision. The `Fixed Version` column tells you whether a fix exists.

Trivy also has other targets: `trivy fs .` (a directory with code), `trivy config` (IaC and manifests) and `trivy k8s` (resources in the cluster). On the exam `trivy image` is the most common.

### Task: find vulnerable images in a namespace and remove the Pods

```bash
# 1. which images the Pods in the prod namespace use
kubectl -n prod get pods -o custom-columns='POD:.metadata.name,IMAGES:.spec.containers[*].image'

# or just a unique list of images (including initContainers)
kubectl -n prod get pods -o jsonpath='{range .items[*]}{.spec.initContainers[*].image} {.spec.containers[*].image}{"\n"}{end}' | tr ' ' '\n' | sort -u

# 2. scan each image, CRITICAL only
for img in nginx:1.19 redis:7.2 httpd:2.4-alpine; do
  echo "== $img"; trivy image -q --severity CRITICAL "$img" | grep Total
done

# 3. delete the Pods whose images have CRITICAL findings
kubectl -n prod delete pod web-1 web-2
```

> **On the exam:** read whether you need to delete the **Pod** or the **Deployment**. If the Pod belongs to a Deployment, deleting the Pod makes the ReplicaSet immediately create a new one with the same vulnerable image. In that case delete the Deployment or scale it to 0 (`kubectl scale deploy web --replicas=0`), as the task requires.

## Tag or digest

A tag (`nginx:1.27`) is a movable label: the registry owner can point it to a different image. A **digest** (`nginx@sha256:…`) is the hash of the manifest content and cannot change.

```bash
# digest of the image the Pod is actually using
kubectl -n prod get pod web-1 -o jsonpath='{.status.containerStatuses[*].imageID}'

# on the node
crictl images --digests | grep nginx
```

```yaml
containers:
- name: web
  image: registry.internal:5000/nginx@sha256:6af79ae5de407283dcea8b00d5c37ace95441fd58a8b1d2aa1ed93f5511bb18c
```

With a digest, `imagePullPolicy` matters less: the same reference always means the same content. Signatures (cosign) are also bound to the digest, not the tag.

## Allowed registries

Goal: a Pod with an image from an unknown registry must not even be created. This is done in the API server's **admission** phase. You have three main options:

| Mechanism | Where it runs | Configuration | When |
|---|---|---|---|
| **ValidatingAdmissionPolicy** | In the API server, CEL expressions | Kubernetes objects (`kubectl apply`) | Built in, GA since 1.30; fastest on the exam |
| **ImagePolicyWebhook** | Admission plugin that queries an external service | Files on the controlplane + kube-apiserver flags | When the task provides a ready-made backend |
| **Kyverno / OPA Gatekeeper** | External admission webhook | CRDs (ClusterPolicy, ConstraintTemplate) | In production; on the exam only if already installed |

### ValidatingAdmissionPolicy with CEL

A **ValidatingAdmissionPolicy** (`admissionregistration.k8s.io/v1`) describes a rule in the **CEL** language. The policy by itself does nothing until a **ValidatingAdmissionPolicyBinding** binds it.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: allowed-registries
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["pods"]
  validations:
  - expression: >-
      object.spec.containers.all(c, c.image.startsWith('registry.internal:5000/')) &&
      (!has(object.spec.initContainers) ||
       object.spec.initContainers.all(c, c.image.startsWith('registry.internal:5000/')))
    message: "Only images from registry.internal:5000/ are allowed"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: allowed-registries-prod
spec:
  policyName: allowed-registries
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: prod
```

Important details:

- `object` is the object being created; `oldObject` is the old version on UPDATE.
- `has(...)` checks whether a field exists. Without it the expression fails on a Pod without `initContainers`, and with `failurePolicy: Fail` such a Pod is rejected.
- `validationActions`: `Deny` (reject), `Warn` (warning to the client), `Audit` (entry in the audit log). `Deny` and `Warn` can't be combined.
- A policy on `pods` doesn't block the Deployment, but the Pods the ReplicaSet tries to create. The Deployment is created, and the error shows up in `kubectl describe rs`. If you also want to reject the Deployment, add `deployments` to `resourceRules` and an expression for `object.spec.template.spec.containers`.
- With `startsWith`, write the registry with a trailing slash. Without it, `registry.internal:5000.evil.io/x` would pass.

Verification:

```bash
kubectl apply -f vap.yaml
kubectl -n prod run test --image=docker.io/library/nginx:1.27
# Error from server (Forbidden): pods "test" is forbidden: ValidatingAdmissionPolicy
# 'allowed-registries' with binding 'allowed-registries-prod' denied request: Only images from ...
kubectl -n prod run ok --image=registry.internal:5000/nginx:1.27   # passes
```

> **On the exam:** you'll find a ValidatingAdmissionPolicy example in the documentation under "Validating Admission Policy" (kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/). The most common mistake is a forgotten Binding: the policy exists, but nothing is blocked.

### ImagePolicyWebhook

**ImagePolicyWebhook** is an admission plugin in kube-apiserver. For each Pod it sends an **ImageReview** object (`imagepolicy.k8s.io/v1alpha1`) to an external service, with the list of images from `containers`, `initContainers` and `ephemeralContainers`. The service replies `allowed: true/false`. On the exam the backend is usually already prepared; your job is to enable the plugin correctly.

Three files are needed. The first is the **AdmissionConfiguration**:

```yaml
# /etc/kubernetes/admission/admission-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
- name: ImagePolicyWebhook
  configuration:
    imagePolicy:
      kubeConfigFile: /etc/kubernetes/admission/imagepolicy.kubeconfig
      allowTTL: 50          # seconds to cache approvals
      denyTTL: 50           # seconds to cache denials
      retryBackoff: 500     # milliseconds between retries
      defaultAllow: false   # backend unavailable -> REJECT the Pod
```

Instead of `configuration` you can use `path: imagepolicy-config.yaml` with a separate file.

The second is the **kubeconfig** for the backend. `cluster` is the service that decides (must be `https`), `user` holds the API server's credentials towards it:

```yaml
# /etc/kubernetes/admission/imagepolicy.kubeconfig
apiVersion: v1
kind: Config
clusters:
- name: image-checker
  cluster:
    certificate-authority: /etc/kubernetes/admission/ca.crt
    server: https://image-checker.internal:8443/check
users:
- name: kube-apiserver
  user:
    client-certificate: /etc/kubernetes/admission/apiserver-client.crt
    client-key: /etc/kubernetes/admission/apiserver-client.key
contexts:
- name: default
  context:
    cluster: image-checker
    user: kube-apiserver
current-context: default
```

The third is a change to the static Pod manifest `/etc/kubernetes/manifests/kube-apiserver.yaml`:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --enable-admission-plugins=NodeRestriction,ImagePolicyWebhook
    - --admission-control-config-file=/etc/kubernetes/admission/admission-config.yaml
    # ... the other flags stay
    volumeMounts:
    - name: admission
      mountPath: /etc/kubernetes/admission
      readOnly: true
  volumes:
  - name: admission
    hostPath:
      path: /etc/kubernetes/admission
      type: DirectoryOrCreate
```

**`defaultAllow`** is the key security question: what to do when the backend doesn't respond.

| `defaultAllow` | Backend unavailable | Security posture |
|---|---|---|
| `true` | The Pod is **admitted** | Fail-open: availability over security |
| `false` | The Pod is **rejected** | Fail-closed: the task usually asks for this |

> **On the exam:** the API server runs in a container and sees only what is mounted. All paths in the AdmissionConfiguration and in the kubeconfig (CA, certificates) must be inside the mounted directory. If `kubectl` stops responding after the change, look at `crictl ps -a | grep kube-apiserver`, `crictl logs <id>` and `journalctl -u kubelet`.

### Kyverno and OPA Gatekeeper in brief

Both work as a **validating/mutating admission webhook** and add their own CRDs.

| | Kyverno | OPA Gatekeeper |
|---|---|---|
| Policy language | YAML (pattern), CEL | Rego |
| Main objects | `ClusterPolicy`, `Policy` (and new CEL-based types) | `ConstraintTemplate` + Constraint (e.g. `K8sAllowedRepos`) |
| Signature verification | Built in (`verifyImages`) | Through external providers |

A Gatekeeper example for allowed registries, when the `ConstraintTemplate` from the library is already installed:

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: prod-repos
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
    namespaces: ["prod"]
  parameters:
    repos: ["registry.internal:5000/"]
```

## Signing images: cosign

**cosign** (a **Sigstore** project) signs images in an OCI registry. The signature is stored in the same registry, next to the image, and is bound to its **digest**.

### Signing with a key

```bash
# key pair: cosign.key (password-encrypted) and cosign.pub
cosign generate-key-pair

# sign by digest (a tag is resolved to a digest, but an explicit digest is safer)
cosign sign --key cosign.key registry.internal:5000/app@sha256:3b1f...e9

# verify the signature with the public key
cosign verify --key cosign.pub registry.internal:5000/app:1.0
```

`cosign verify` returns exit code 0 and JSON with the signature data when the signature is valid, and the error `no matching signatures` when it isn't. If someone plants a different image under the same tag, the digest changes and the old signature no longer applies.

### Keyless signing

No long-lived keys: `cosign sign <image>` (without `--key`) asks for an OIDC login (e.g. a GitHub Actions identity). **Fulcio** issues a short-lived certificate for that identity, and the signature is recorded in the public transparency log **Rekor**. Verification then requires an identity instead of a key:

```bash
cosign verify \
  --certificate-identity=https://github.com/firma/app/.github/workflows/build.yml@refs/heads/main \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/firma/app:1.0
```

| | With a key | Keyless |
|---|---|---|
| What is stored | Private key (a secret) | Nothing long-lived |
| Verification | `--key cosign.pub` | `--certificate-identity` + `--certificate-oidc-issuer` |
| Typical use | Air-gapped environments, lab, exam | CI/CD in the cloud |

### Verifying signatures at the cluster entry point

A signature is only useful if someone verifies it before the image runs. Kubernetes doesn't have this built in; an admission controller is used:

- **Kyverno** `ClusterPolicy` with a `verifyImages` rule: for images matching `imageReferences` (e.g. `registry.internal:5000/*`) it requires a signature that is verified with the given public key (`attestors` → `keys.publicKeys`). Along the way, Kyverno can replace the tag with the digest in the Pod.
- **Sigstore policy-controller**: a `ClusterImagePolicy` object with a key or a keyless identity; applies to namespaces labeled `policy.sigstore.dev/include=true`.

Sketch of a Kyverno rule:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-signed-images
spec:
  rules:
  - name: check-signature
    match:
      any:
      - resources:
          kinds: ["Pod"]
    verifyImages:
    - imageReferences: ["registry.internal:5000/*"]
      failureAction: Enforce      # the default is Audit only
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              ...
              -----END PUBLIC KEY-----
```

> **On the exam:** with cosign tasks, watch which key goes where: `sign` always with the **private** key (`cosign.key`, asks for a password or `COSIGN_PASSWORD`), `verify` with the **public** key (`cosign.pub`). If you need to save the verification output, redirect it: `cosign verify --key cosign.pub IMG > /opt/kurs/verify.json`.

## Troubleshooting

| Symptom | What to check |
|---|---|
| ValidatingAdmissionPolicy blocks nothing | Does a Binding exist; does `policyName` match; does `matchResources` select the right namespace; `kubectl get validatingadmissionpolicybinding` |
| All Pods rejected with an expression error | The expression accesses a field that doesn't exist (`initContainers`) without `has()`; `failurePolicy: Fail` |
| Deployment created, but no Pods | The policy rejects the Pods: `kubectl describe rs <name>` shows `FailedCreate` |
| API server doesn't start after ImagePolicyWebhook | Wrong path or unmounted directory, YAML error in the AdmissionConfiguration; `crictl logs`, `/var/log/pods/kube-system_kube-apiserver-*` |
| All Pods rejected after ImagePolicyWebhook | Backend unavailable and `defaultAllow: false`; check the `server` URL and the certificates in the kubeconfig |
| `cosign verify` returns `no matching signatures` | Wrong public key, image changed after signing (different digest), signature in a different registry |
| `trivy sbom` finds no vulnerabilities | SBOM created without packages (wrong format or empty image); check the content with `jq` |

## Summary

- The supply chain runs from source code through CI/CD and registries to the cluster; every phase is a target (SolarWinds: build, Codecov: CI script, xz: dependency).
- An SBOM (SPDX or CycloneDX) is a list of components: `syft IMG -o spdx-json`, `trivy image --format cyclonedx|spdx-json -o file`, and `trivy sbom file` scans an existing SBOM.
- `trivy image --severity HIGH,CRITICAL --ignore-unfixed IMG`; find Pod images with `-o custom-columns` or `jsonpath`, and with a Deployment remove the source, not just the Pod.
- A digest (`@sha256:`) is immutable, a tag isn't; signatures are bound to the digest.
- ValidatingAdmissionPolicy (CEL) + ValidatingAdmissionPolicyBinding is the fastest way to enforce allowed registries; without a Binding it does nothing.
- ImagePolicyWebhook requires `--enable-admission-plugins`, `--admission-control-config-file`, the backend kubeconfig and mounted volumes; `defaultAllow: false` means fail-closed.
- cosign: `generate-key-pair`, `sign --key cosign.key`, `verify --key cosign.pub`; verification at the cluster entry point is done by Kyverno `verifyImages` or the sigstore policy-controller.
