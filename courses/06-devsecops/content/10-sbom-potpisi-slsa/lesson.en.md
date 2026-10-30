## What this module covers

Domain 5, supply chain integrity:

- **5.1** SBOM: CycloneDX and SPDX, generating with Syft and Trivy, scanning SBOMs, regulatory drivers (EU CRA, US EO 14028).
- **5.2** Signing artifacts with cosign: key pairs, keyless (Fulcio, Rekor), verification.
- **5.3** Provenance and attestations: in-toto, SLSA levels and the build track.
- **5.4** Enforcing integrity at deploy time: verifying signatures and attestations before deploy, admission policies.

So far every control has looked at **source code** (secrets, SAST, SCA, IaC). This module looks at the **artifact** that comes out of the build: the `kurs-shop` image. Its place in the pipeline:

```text
build ──► sbom ──► image-scan ──► sign + attest ──► verify ──► deploy
           │                          │                │
    list of ingredients       "this passed        "don't trust the tag,
                               our pipeline"       verify the signature"
```

Threats these controls prevent:

| Threat | Example | Control |
|---|---|---|
| You don't know what is in the image when a new CVE comes out | Log4Shell 2021: teams spent days searching for where `log4j` is | An **SBOM** with every build |
| A substituted image under the same tag | An attacker with registry access pushes `kurs-shop:1.4` | A signature bound to the **digest** |
| An image built outside the pipeline | A developer pushes an image from a laptop | Verifying the signer's **identity** |
| A compromised build | SolarWinds: a correctly signed but poisoned build | **Provenance**, a hardened builder (SLSA L3) |
| A deploy bypasses all checks | `kubectl apply` with an unsigned image | An **admission** policy (Kyverno) |

The CKS course showed these tools at the cluster level. Here we build them into the pipeline: which job produces what, what is kept as an artifact and when the build fails.

## SBOM: the list of ingredients

An **SBOM** (Software Bill of Materials) is a machine-readable list of an artifact's components: names, versions, identifiers (**purl**, CPE), hashes, licenses and relationships between components. An SBOM by itself says nothing about vulnerabilities. It becomes valuable when you compare it against a vulnerability database, today and again in six months, without unpacking the image again.

### CycloneDX and SPDX

| | **CycloneDX** | **SPDX** |
|---|---|---|
| Maintained by | OWASP, standardized as **ECMA-424** | Linux Foundation; SPDX 2.2.1 is **ISO/IEC 5962:2021** |
| Current versions | 1.6 and 1.7 (October 2025) | 2.3 (widely supported) and 3.0 |
| Origin | Security and risk analysis | Licensing and compliance |
| Formats | JSON, XML, protobuf | JSON, tag-value, YAML, RDF; 3.0 is JSON-LD |
| Notable | VEX, services (SaaSBOM), hardware, cryptography (CBOM), ML models | Detailed licensing; 3.0 introduces profiles (Security, Build, AI, Dataset…) |
| Syft `-o` | `cyclonedx-json`, `cyclonedx-xml` | `spdx-json`, `spdx-tag-value` |
| Trivy `--format` | `cyclonedx` | `spdx-json`, `spdx` |

For the pipeline the choice matters less than consistency: pick one format for the whole organization, so downstream tools (DefectDojo, Dependency-Track, GitLab) don't have to understand both. In practice **CycloneDX JSON** is more common in security tooling, and SPDX when the legal team asks for licenses.

> **In practice:** when a tool supports several versions of the specification, check what the tool consuming the SBOM can read. A newer format version is useless if your Dependency-Track or scanner doesn't understand it. Syft lets you choose the version, e.g. `-o cyclonedx-json@1.6`.

### What an SBOM must contain

The NTIA (USA, 2021) defined the **minimum elements** that everyone still cites:

- supplier name, component name, version,
- other unique identifiers (purl, CPE),
- dependency relationship (who includes whom),
- author of the SBOM data and a timestamp.

In addition: the SBOM is generated automatically (not by hand) and again with every build. In 2025 CISA published a draft of extended minimum elements (e.g. component hash, license, name of the tool that generated the SBOM). Syft and Trivy fill in these fields themselves.

### Generating an SBOM: Syft

Syft builds an SBOM from a directory, an image in a registry or an archive. The command is `syft scan <source>`:

```bash
cd /root/kurs-shop

# source code: Python and npm dependencies from requirements.txt and package-lock.json
syft scan dir:. -o cyclonedx-json=sbom-src.cdx.json

# image from the local registry (HTTP, no TLS)
export SYFT_REGISTRY_INSECURE_USE_HTTP=true
syft scan registry:127.0.0.1:5000/kurs-shop:1.0 \
  -o cyclonedx-json=sbom.cdx.json \
  -o spdx-json=sbom.spdx.json

# quick view in the terminal
syft scan registry:127.0.0.1:5000/kurs-shop:1.0 -o table
```

Several `-o` options in a single run produce several formats from one analysis. The source prefix (`dir:`, `registry:`, `oci-dir:`, `docker-archive:`) tells Syft where to read from, so it doesn't have to guess and doesn't need a Docker daemon.

The difference between a source SBOM and an image SBOM matters:

| | Source code SBOM | Image SBOM |
|---|---|---|
| Contains | What the lock files declare | What is actually installed: OS packages (dpkg/apk), Python packages, binaries |
| Misses | OS packages, dependencies installed in the Dockerfile | Dev dependencies that are not in the image |
| When | Early, on the MR | After the build, for the release |

For releases and regulation, what counts is the SBOM of **what you ship**, i.e. the image.

### Generating an SBOM: Trivy

Trivy produces an SBOM with the same commands it uses for scanning, just with a different format:

```bash
trivy image --format cyclonedx --output sbom.cdx.json 127.0.0.1:5000/kurs-shop:1.0
trivy fs --format spdx-json --output sbom-src.spdx.json /root/kurs-shop
```

If you already use Trivy for image scanning (module 08), you don't have to introduce Syft. Syft has the edge when you need more formats or a more precise catalog of binaries; Trivy when you want a single tool.

### Scanning an SBOM

An SBOM generated once can be scanned any number of times, without the image:

```bash
trivy sbom --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 sbom.cdx.json
```

This is the basis of **continuous monitoring**: every night a job takes the SBOMs of all images currently in production and scans them against the latest database. If a CVE in `werkzeug 2.2.2` is published tomorrow, you will find out without a new build.

```yaml
sbom-rescan:
  stage: verify
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - for f in sboms/*.cdx.json; do
        trivy sbom --severity CRITICAL --exit-code 1 "$f" || FAILED=1;
      done
    - exit ${FAILED:-0}
```

### SBOM in the pipeline

```yaml
sbom:
  stage: build
  needs: [build]
  variables:
    SYFT_REGISTRY_INSECURE_USE_HTTP: "true"   # only for the local lab registry
  script:
    - IMAGE="$(cat image.txt)"                 # e.g. 127.0.0.1:5000/kurs-shop@sha256:...
    - syft scan "registry:$IMAGE" -o cyclonedx-json=sbom.cdx.json
    - jq -e '.bomFormat == "CycloneDX" and (.components | length > 0)' sbom.cdx.json
  artifacts:
    paths: [sbom.cdx.json]
    reports:
      cyclonedx: sbom.cdx.json     # GitLab Ultimate: dependency list in the project
    expire_in: 1 year
```

Three details:

1. The SBOM is generated for the **digest**, not the tag. A tag can move, so an SBOM for `:latest` means nothing a week later.
2. The `jq -e` check catches the most common silent failure: the tool produced a valid but empty SBOM (wrong source, no lock file).
3. An SBOM as a job artifact expires (`expire_in`). For long-term retention, **attach it to the image as an attestation** (later in this module) or send it to Dependency-Track or DefectDojo.

> **In practice:** an SBOM nobody reads is just paperwork for the audit. The first useful step is a nightly `trivy sbom` over what is in production; the second is sending SBOMs to a tool that answers "which services contain `PyYAML 5.3.1`?" in a second.

### Regulatory drivers

| Regulation | What it requires | Status (October 2026) |
|---|---|---|
| **US EO 14028** (May 2021) | Federal agencies require software suppliers to follow secure development (NIST SSDF) and provide an SBOM | Kicked off the whole SBOM industry; the NTIA minimum elements came out of it |
| **EU Cyber Resilience Act** (Regulation (EU) 2024/2847) | Manufacturers of products with digital elements: vulnerability handling, an SBOM (at least top-level dependencies) in the technical documentation, reporting of actively exploited vulnerabilities | In force since December 2024; **reporting obligations from 11 Sep 2026**; full application **11 Dec 2027** |

What to know about the CRA:

- The SBOM does not have to be public; it must exist in the technical documentation and be provided to the market surveillance authority on request.
- From 11 Sep 2026 a manufacturer must report an **actively exploited vulnerability** and a severe incident through the ENISA reporting platform: an early warning within 24 hours. Without an SBOM you cannot quickly say whether your product is affected.
- Fines go up to 15 million euros or 2.5% of annual turnover.

> **In practice:** don't build an "SBOM for the regulator" as a separate process. If every release has an SBOM bound to the digest and attested alongside the image, the CRA documentation is a by-product of the pipeline.

## Signing: cosign

A signature answers **who** published the artifact and whether it has been modified. **cosign** (the **Sigstore** project) signs OCI images and arbitrary files (blobs), and stores the signature in the same registry as the image.

You always sign the **digest**, not the tag:

```bash
crane digest 127.0.0.1:5000/kurs-shop:1.0
# sha256:3f1c...
IMAGE=127.0.0.1:5000/kurs-shop@$(crane digest 127.0.0.1:5000/kurs-shop:1.0)
```

cosign refuses or warns when given a tag, because the signature would then apply to whichever image the tag pointed to at that moment, and you can't be sure which one that is.

### Signing with a key pair

```bash
# password for the private key from a variable, no interactive prompt
export COSIGN_PASSWORD='lab-lozinka'
cosign generate-key-pair            # creates cosign.key (encrypted) and cosign.pub

cosign sign --key cosign.key "$IMAGE"
cosign verify --key cosign.pub "$IMAGE"
```

The key can also live in a KMS or Vault, so the private key never reaches the runner: `--key awskms://...`, `--key hashivault://kurs-shop`, `--key gitlab://shop/kurs-shop` (cosign can generate the pair itself and write it into the project's GitLab CI/CD variables).

### What changed in cosign v3

The lab uses cosign 3.1. Compared to v2:

| | cosign v2 | cosign v3 |
|---|---|---|
| Signature format | A separate OCI object with the tag `sha256-<digest>.sig` | **Sigstore bundle** (protobuf/JSON) as the default format |
| Where in the registry | `.sig` / `.att` tag scheme | **OCI 1.1 referrer** of the image (on a registry without the Referrers API a fallback tag is used) |
| Service addresses | `--rekor-url`, `--fulcio-url` flags | **Signing config** and **trusted root** from the Sigstore TUF repository; your own via `--signing-config` and `--trusted-root` |
| Disabling Rekor | `--tlog-upload=false` | A signing config without a transparency log; the old flag is deprecated and only works with `--use-signing-config=false` |
| `sign-blob` | `--output-signature`, `--output-certificate` | A single file `--bundle artifact.sigstore.json`; the old `--output-*` flags are deprecated |

To see what is attached to an image: `cosign tree "$IMAGE"`.

The consequence for the pipeline: **the verifier must understand the new format**. If you sign with cosign v3, check that the admission controller (Kyverno, Sigstore policy-controller) and old scripts using cosign v2 can read the bundle from the referrer. Upgrade the verification side first, and only then the signing side.

### Lab without a network

The lab has no access to the public Rekor or the TUF repository, so you sign with a key without writing to the transparency log:

```bash
cosign sign --key cosign.key --use-signing-config=false --tlog-upload=false "$IMAGE"
cosign verify --key cosign.pub --insecure-ignore-tlog=true "$IMAGE"
```

Both signing flags are marked as deprecated in v3 (cosign prints a warning), but they work. The cleaner v3 approach is your own signing config without a Rekor service, created with `cosign signing-config create`. In production with public Sigstore you need none of this.

### Keyless signing: Fulcio and Rekor

**Keyless** doesn't mean "without a key", but "without a key you manage":

1. cosign creates a temporary (ephemeral) key pair in memory.
2. The job presents an **OIDC token** for its identity (GitLab `id_tokens`, GitHub Actions OIDC).
3. **Fulcio** (the Sigstore CA) issues a short-lived certificate (about 10 minutes) that binds the public key to that identity.
4. cosign signs the digest and writes the signature and certificate to **Rekor**, a public, append-only **transparency log**.
5. The private key is discarded. A later verification doesn't ask "who has the key", but "was the signature created while the certificate was valid, and who is in the certificate".

GitLab job (gitlab.com):

```yaml
sign:
  stage: sign
  needs: [build, image-scan]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: sigstore
  script:
    - cosign sign --yes "$(cat image.txt)"
```

cosign finds `SIGSTORE_ID_TOKEN` on its own. Verification must state **who** is allowed to sign:

```bash
cosign verify "$IMAGE" \
  --certificate-oidc-issuer "https://gitlab.com" \
  --certificate-identity "https://gitlab.com/shop/kurs-shop//.gitlab-ci.yml@refs/heads/main"
```

A GitLab job's identity is `<instance>/<project path>//<CI file path>@<ref>`. The double slash is not a typo: without it verification fails with "none of the expected identities matched". For GitHub Actions the issuer is `https://token.actions.githubusercontent.com`, and the identity is the workflow file path with the ref.

For multiple branches or repos there are `--certificate-identity-regexp` and `--certificate-oidc-issuer-regexp`. Write the regex narrowly and with anchors (`^…$`): `.*kurs-shop.*` also accepts `evil/kurs-shop-fork`.

> **In practice:** the public Fulcio only accepts tokens from known issuers (gitlab.com, GitHub and others). A self-managed GitLab such as `gitlab.kurs-shop.ba` needs a **private Sigstore** (its own Fulcio and Rekor) for keyless, or stays with a key in a KMS/Vault. Also: the signature and identity go into the public Rekor, so the name of a private repo becomes public.

### Key or keyless

| | Key pair (KMS/Vault) | Keyless (Fulcio + Rekor) |
|---|---|---|
| Secret management | Rotating, protecting and revoking the key is your job | No long-lived key |
| What verification proves | "Someone who has the key" | "This job, this repo, this branch" |
| Theft | A stolen key signs anything until you revoke it | The attacker needs the OIDC token of a protected job |
| Transparency | Optional (Rekor) | Mandatory, public log |
| Offline / air-gapped | Works | Needs a private Sigstore |
| Verification in policy | Public key | Issuer + identity (subject) |

### Signing in the pipeline: rules

- Only a job on a **protected branch** or tag signs (`rules`), never an MR from a fork.
- The signature comes **after** scanning and tests (`needs: [image-scan, dast]`). Then the signature means "it passed our pipeline", not just "we built this".
- The key or `id_tokens` exist only in the signing job; the build job doesn't see them.
- For a key in a CI/CD variable: **protected** and **masked**, of type *File* (`--key "$COSIGN_KEY"` receives a path), with the password in a separate `COSIGN_PASSWORD` variable.

> **In practice:** the most common mistake is not a weak key but weak verification. `cosign verify` without `--certificate-identity` (or with the regex `.*`) accepts a signature from **anyone** who has a GitHub or GitLab account. A signature without an identity check is just a checksum.

## Provenance and attestations

A signature says who. **Provenance** says **how**: which builder, from which commit, with which parameters and inputs the artifact was produced. An **attestation** is a signed statement about an artifact; provenance is one kind of attestation, an SBOM attached to an image is another, a scan result a third.

### in-toto Statement

The common format for all attestations is the **in-toto Statement**. It always has three parts:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    { "name": "127.0.0.1:5000/kurs-shop",
      "digest": { "sha256": "3f1c..." } }
  ],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": { "...": "content depends on predicateType" }
}
```

- `subject`: which artifact the statement refers to (by digest).
- `predicateType`: what kind of statement it is (SLSA provenance, CycloneDX, SPDX, OpenVEX, test results…).
- `predicate`: the content itself.

The Statement is signed and wrapped in a **DSSE** envelope (Dead Simple Signing Envelope), so the signature also covers the content type. cosign does this itself.

The original **in-toto** framework goes further: a **layout** describes all the steps of the chain (who may perform which step, what the input and output are), and **link** files are evidence that a step was performed. Most pipelines today use only the attestation format (Statement), not the full layout.

### SLSA provenance

The `https://slsa.dev/provenance/v1` predicate has two parts:

```json
{
  "buildDefinition": {
    "buildType": "https://gitlab.com/...",
    "externalParameters": { "source": "git+https://gitlab.kurs-shop.ba/shop/kurs-shop@refs/heads/main" },
    "internalParameters": { "CI_PIPELINE_ID": "4711" },
    "resolvedDependencies": [
      { "uri": "git+https://gitlab.kurs-shop.ba/shop/kurs-shop", "digest": { "gitCommit": "a1b2c3..." } }
    ]
  },
  "runDetails": {
    "builder": { "id": "https://gitlab.kurs-shop.ba/runners/shared" },
    "metadata": { "invocationId": "...", "startedOn": "2026-10-16T09:00:00Z" }
  }
}
```

During verification you look mostly at `builder.id` (was it built by our trusted builder) and `externalParameters`/`resolvedDependencies` (was it built from our repo and a protected branch).

### SLSA levels

**SLSA** (Supply-chain Levels for Software Artifacts) version 1.x organizes requirements into **tracks**. The current specification is v1.2, which adds a **Source track** alongside the **Build track**.

Build track:

| Level | Name | What it requires |
|---|---|---|
| L0 | No guarantees | Nothing (local build, tests) |
| L1 | Provenance exists | A consistent build process; the platform automatically generates provenance (builder, process, inputs) and it is distributed; it may be unsigned |
| L2 | Hosted build platform | Build on a hosted platform that **signs the provenance itself**; the consumer verifies its authenticity |
| L3 | Hardened builds | Builds are **isolated** from one another (even within the same project), and the **secrets for signing provenance are inaccessible** to the user-defined build steps |

Source track (v1.2): L1 versioning in a VCS, L2 preserved history and source provenance, L3 technical controls on named branches/tags, L4 mandatory review by two trusted persons.

The key difference between L2 and L3: at L2 the platform signs the provenance, but a user `script:` step could reach the signing key and forge provenance. At L3 that is not possible: signing is done by a component outside user code.

> **In practice:** provenance that your own `script:` builds with `jq` and signs with a key from a CI variable is a useful record, but it is not L2/L3, because the same script can write anything. Higher levels require that the platform (the runner, GitHub attestations) generates and signs the provenance, not your job.

### Provenance on GitLab and GitHub

The **GitLab** runner generates provenance for **job artifacts** when you set a variable:

```yaml
build-wheel:
  variables:
    RUNNER_GENERATE_ARTIFACTS_METADATA: "true"
  script:
    - python -m build
  artifacts:
    name: kurs-shop-wheel
    paths: [dist/]
```

Alongside the artifact you get `kurs-shop-wheel-metadata.json` (or `artifacts-metadata.json` without a name): an in-toto Statement with a SLSA v1 provenance predicate. This covers job artifacts, not the image in the registry; for the image you create the provenance yourself and attach it with cosign.

**GitHub** has **artifact attestations**: the `actions/attest-build-provenance` action creates and signs SLSA provenance via Sigstore, and `gh attestation verify oci://<image> --owner <org>` verifies it. GitHub presents this as Build L2, and with a reusable workflow as an isolated build, as Build L3.

### Attestations with cosign

cosign attaches any predicate to an image as a signed attestation:

```bash
# SBOM as an attestation
cosign attest --key cosign.key --type cyclonedx --predicate sbom.cdx.json "$IMAGE"

# provenance (predicate created in the job)
cosign attest --key cosign.key --type slsaprovenance1 --predicate provenance.json "$IMAGE"

# verification: attestation signature + predicate type
cosign verify-attestation --key cosign.pub --type slsaprovenance1 "$IMAGE" \
  | jq -r '.payload' | base64 -d | jq '.predicate.runDetails.builder.id'
```

`--type` accepts shorthands (`slsaprovenance1`, `cyclonedx`, `spdxjson`, `openvex`, `vuln`, `custom`) or the full predicate URI. In the offline lab add the same flags as for `sign`/`verify` (no Rekor).

`verify-attestation` can also check the content against a policy right away: `--policy policy.rego` (or CUE). That way "provenance exists" becomes "provenance says it was built by our runner from the `main` branch".

> **In practice:** an SBOM attached to the image as an attestation is better than an SBOM in a job artifact: it travels with the image across registries, doesn't expire after `expire_in` and is signed, so you know nobody replaced it.

## Enforcement at deploy time

A signature nobody verifies protects nothing. Verification goes in two places:

1. **In the pipeline**, in the deploy job, before `kubectl apply`: fast feedback.
2. **In the cluster**, as an admission policy: the only check you cannot bypass with a manual `kubectl` or another pipeline.

### Deploy job

```yaml
deploy:
  stage: deploy
  needs: [sign]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - IMAGE="$(cat image.txt)"
    - cosign verify --key "$COSIGN_PUB" "$IMAGE"
    - cosign verify-attestation --key "$COSIGN_PUB" --type slsaprovenance1 "$IMAGE" > /dev/null
    - yq -i ".spec.template.spec.containers[0].image = \"$IMAGE\"" k8s/deployment.yaml
    - kubectl apply -f k8s/deployment.yaml
```

The deploy writes the verified **digest** into the manifest. If it wrote the tag, the cluster could pull a different image from the one whose signature the job just verified.

### Kyverno: ImageValidatingPolicy

Kyverno 1.19 marks the old `ClusterPolicy`/`Policy` (`kyverno.io/v1`) as deprecated, with removal planned for 1.20. For image verification the new type is **`ImageValidatingPolicy`** (`policies.kyverno.io/v1`, stable since 1.17/1.18), with CEL expressions:

```yaml
apiVersion: policies.kyverno.io/v1
kind: ImageValidatingPolicy
metadata:
  name: kurs-shop-potpisan
spec:
  validationActions: [Deny]
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: [v1]
        operations: [CREATE, UPDATE]
        resources: [pods]
  matchImageReferences:
    - glob: "registry.kurs-shop.ba/kurs-shop*"
  attestors:
    - name: shopKey
      cosign:
        key:
          data: |
            -----BEGIN PUBLIC KEY-----
            MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
            -----END PUBLIC KEY-----
  attestations:
    - name: provenance
      intoto:
        type: https://slsa.dev/provenance/v1
  validationConfigurations:
    mutateDigest: true      # replace the tag in the Pod with the digest
    verifyDigest: true      # the image must be referenced by digest
    required: true          # a matching image must pass verification
  validations:
    - expression: >-
        images.containers.map(image,
          verifyImageSignatures(image, [attestors.shopKey])).all(e, e > 0)
      message: "kurs-shop image is not signed with the pipeline key"
    - expression: >-
        images.containers.map(image,
          verifyAttestationSignatures(image, attestations.provenance, [attestors.shopKey])).all(e, e > 0)
      message: "kurs-shop image has no signed SLSA provenance"
```

For keyless, instead of `key` you specify `keyless.identities` with `issuer` and `subject` (or `subjectRegExp`), the same as `--certificate-oidc-issuer` and `--certificate-identity` with cosign. The attestation content is read with `extractPayload(image, attestations.provenance)` and checked with CEL (e.g. that `builder.id` matches your runner).

The old form, `ClusterPolicy` with `verifyImages` (`imageReferences`, `attestors`, `mutateDigest`), still works in 1.19 with a warning. If you find it in an existing cluster, plan the migration before upgrading to 1.20.

### Policy in the pipeline: Kyverno CLI

You test the same policy before it reaches the cluster:

```bash
kyverno apply policies/kurs-shop-potpisan.yaml --resource k8s/deployment.yaml
kyverno test policies/      # looks for kyverno-test.yaml with the expected results
```

To verify signatures the CLI must fetch them from the registry, so the resource in the test must reference an image in a registry the job can reach (in the lab, `127.0.0.1:5000`).

> **In practice:** introduce admission verification in two steps. First `validationActions: [Audit]` for a week or two: you see which images in the cluster are not signed (sidecars, operators, third-party images). Only once the exceptions are listed (a separate policy or a `PolicyException` for vendor images) switch to `Deny`. A policy that blocks `kube-system` on day one ends up disabled.

### What you verify, and when

| Check | Pipeline (deploy job) | Admission (Kyverno) |
|---|---|---|
| Can be bypassed | Yes (manual deploy, another pipeline) | No, if the policy is `Deny` for all namespaces |
| Feedback | Immediately, in the job log | When the Pod is created, a message in `kubectl`/Argo CD |
| What it checks | Signature, attestations, policy over content | Signature, attestations, CEL over content |
| Role | Fail fast | The final gate |

## Summary

- An SBOM (CycloneDX or SPDX) is generated for the image **digest** with every build (Syft or Trivy), checked to be non-empty and rescanned (`trivy sbom`) when new CVEs come out.
- EU CRA: reporting of actively exploited vulnerabilities from 11 Sep 2026, full application 11 Dec 2027; the SBOM goes into the technical documentation. US EO 14028 started the SBOM requirements in 2021.
- cosign signs the digest; v3 defaults to the Sigstore bundle as an OCI 1.1 referrer and a signing config/trusted root from TUF, so the verifier must also be ready for the new format.
- Keyless binds the signature to the job's OIDC identity (Fulcio certificate, Rekor log); verification without `--certificate-identity` and `--certificate-oidc-issuer` has no value.
- Attestation = a signed in-toto Statement (`subject`, `predicateType`, `predicate`); SLSA provenance v1 describes the builder and inputs.
- SLSA Build L1: provenance exists; L2: a hosted platform signs it; L3: isolated builds and a signing key inaccessible to user steps.
- The deploy job verifies the signature and attestations and deploys the **digest**; Kyverno `ImageValidatingPolicy` is the final gate in the cluster, introduced first as Audit and then as Deny.
