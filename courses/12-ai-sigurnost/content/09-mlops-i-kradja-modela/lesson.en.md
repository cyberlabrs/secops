## What this module covers

Domain 4, part two:

- **4.2** Securing ML pipelines and MLOps platforms: from data to the production endpoint, model promotion gates and the **AI-BOM** (CycloneDX ML-BOM).
- **4.3** Model theft, extraction and privacy attacks: how a model or its training data can be extracted, and which controls prevent it or make it harder.

Module objectives. After this module you should be able to:

- draw an ML pipeline with trust boundaries and name the main risk and control for each stage,
- recognize typical weaknesses of MLOps platforms (notebooks, experiment tracking, model registry, serving),
- define a gate for promoting a model to production (format, signature, AI-BOM, evaluation),
- create and read an AI-BOM in CycloneDX format,
- distinguish weight theft, API-based extraction, membership inference and model inversion, and pick a defense for each.

Module 8 covered the model artifact: safe formats (**safetensors** instead of pickle), scanning and signing. Here we look at the **system around the artifact**: who can train, who can promote a model, what happens when the model reaches serving, and who can copy or imitate it.

## The ML pipeline as a system with trust boundaries

A typical MLOps flow, from raw data to the API:

```text
 [data sources] ──► [feature store / data lake] ──► [training job] ──► [experiment tracking]
        │                       │                          │                    │
   BOUNDARY 1:             BOUNDARY 2:                BOUNDARY 3:          (metrics, artifacts)
   third-party data        who writes to the set      who runs code,            │
                                                      which credentials it has  ▼
                                                                         [model registry]
                                                                                │
                                                                    BOUNDARY 4: promotion
                                                                    (gate: format, signature,
                                                                     AI-BOM, evaluation)
                                                                                │
                                                                                ▼
 [users / applications] ◄── BOUNDARY 5: API ──── [serving: KServe, Triton, vLLM…]
                              (authentication,
                               quotas, logging)
```

Every arrow is a place where someone can plant something (data, code, an artifact) or take something away (weights, data, responses). Unlike classic CI/CD, **data and model weights** are artifacts as important as code: a model trained on poisoned data passes every code test.

### Risks by stage

| Stage | Risk (ATLAS) | Control | Where in the architecture |
|---|---|---|---|
| Data sources | Data poisoning (**AML.T0020** Poison Training Data) | Dataset provenance and versioning, source verification (AML.M0025 Maintain AI Dataset Provenance) | Data lake ingestion |
| Feature store | Unauthorized dataset modification (AML.T0059 Erode Dataset Integrity) | Writes only from the pipeline, immutable versions, dataset hash in metadata | Storage policies |
| Training job | Compromised dependency or base model (**AML.T0010** AI Supply Chain Compromise) | Pinned dependencies, SCA, safetensors, isolated runners | CI/training cluster |
| Training job | Overly broad credentials (theft of data and weights) | Workload identity, short-lived tokens, access only to the buckets needed | IAM |
| Experiment tracking | UI exposed without authentication, artifacts readable by everyone (AML.T0035 AI Artifact Collection) | SSO in front of the UI, private network, per-project ACLs | Network, reverse proxy |
| Model registry | Planted or modified model (AML.T0018 Manipulate AI Model) | Signature, promotion only through the gate, digest instead of "latest" | Registry, CI |
| Serving | Model and data extraction via the API (**AML.T0024**) | Authentication, quotas, minimal output, query pattern detection | API gateway |
| Serving | Weight theft from disk or memory (AML.T0025 Exfiltration via Cyber Means) | Encryption at rest, egress control, node hardening | Kubernetes / VM |

> **In practice:** when you assess an ML platform, don't start with the model. Start with "what credentials does the training job have" and "who can write to the registry". In most incidents involving ML platforms the problem is not an exotic attack on the model but a classic mistake: a dashboard without authentication, a public bucket with artifacts, or a token with admin rights in a notebook.

## Weaknesses of MLOps platforms

MLOps tools grew up in research teams, where the priority was experiment speed, not isolation. A few patterns keep recurring:

| Component | Examples | Typical weakness | Defense |
|---|---|---|---|
| Notebooks | Jupyter, hosted notebooks | Secrets in cells and output; the notebook has the same rights as production | Secrets from a secret manager, separate dev accounts, secret scanning of `.ipynb` |
| Experiment tracking | MLflow, Weights & Biases | UI and API without authentication on the internal network; artifacts available to anyone who knows the URL | Authentication in front of the server, per-experiment ACLs, private artifact store |
| Orchestration | Kubeflow Pipelines, Airflow, Ray | Dashboard or API that allows running arbitrary code; shared service account | Don't expose outside the network, RBAC, separate service accounts per pipeline |
| Model registry | MLflow Model Registry, cloud registries, OCI registry | Anyone who trains can also promote to production | Separate promotion role, CI gate, signature |
| Serving | KServe, Triton, vLLM, TorchServe | Admin/management API exposed together with the inference API; model loaded from an untrusted path | Separate ports and networks, load only signed models from the registry |

Many of these tools have had published vulnerabilities (e.g. path traversal and arbitrary file reads in experiment tracking servers, code execution through unauthenticated orchestrator APIs). The common lesson: **treat an ML platform's management API like the Kubernetes management API**. Whoever reaches it runs code with the platform's privileges.

The minimal network and identity picture:

```text
                    ┌──────────── private ML platform network ─────────────┐
 developer ─SSO──►  │ notebook ──► tracking server ──► artifact store (S3)  │
                    │      │              ▲                                  │
                    │      └──► training job (workload identity: reads     │
                    │            data/v3, writes runs/<id>, NOT registry)   │
                    │                                                        │
                    │ CI gate (only one with: registry:promote) ──► registry │
                    └───────────────────────────────────┬──────────────────┘
                                                        │ pull by digest
                    serving namespace (reads only registry/prod, no egress)
                                                        │
                    API gateway (authn, quotas, logging) ◄── clients
```

> **In practice:** separating "who trains" from "who promotes" is the ML version of the four-eyes principle. A data scientist can register a candidate, but only the pipeline with checks (or a person with a dedicated role) changes the `production` alias. It is also the only way for a signature to mean anything: a signature that anyone with notebook access can apply does not prove the model passed the checks.

## The model promotion gate

The gate is a CI job that sits between the candidate registry and production. It trusts neither the model's name nor its tag; it checks the artifact and its metadata.

What the gate checks:

1. **Format**: only formats that don't execute code on load (safetensors, ONNX without custom operators you don't know). Pickle, `.pt` with pickle content and the like fail.
2. **Integrity and provenance**: file hashes match the manifest, the signature is valid and the signer is the expected identity (see module 8, OpenSSF model signing and `cosign`).
3. **The AI-BOM exists** and lists the base model, datasets and licenses.
4. **Evaluation**: quality metrics and security tests (module 10) above threshold, comparable with the current production version.
5. **Approval**: for high-risk uses, a human approval recorded with the version as well.

Example gate job (GitLab CI style):

```yaml
promote-model:
  stage: promote
  image: kurs-ai-lab:1
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - /opt/ai/bin/python gate/check_format.py model/            # safetensors only
    - cosign verify-blob --key cosign.pub
        --signature model/manifest.json.sig model/manifest.json
    - /opt/ai/bin/python gate/check_manifest.py model/          # hash of every file
    - jq -e '.components[] | select(.type=="machine-learning-model")' aibom.cdx.json
    - /opt/ai/bin/python gate/check_eval.py eval/results.json --min-score 0.92
  environment:
    name: model-production      # protected environment: only this job has registry:promote
```

Format and manifest check, the defensive minimum:

```python
import hashlib, json, pathlib, sys

ALLOWED = {".safetensors", ".json", ".txt"}        # weights + config + tokenizer
model_dir = pathlib.Path(sys.argv[1])
manifest = json.loads((model_dir / "manifest.json").read_text())

errors = []
for f in model_dir.iterdir():
    if f.name in ("manifest.json", "manifest.json.sig"):
        continue
    if f.suffix not in ALLOWED:
        errors.append(f"disallowed format: {f.name}")
        continue
    digest = hashlib.sha256(f.read_bytes()).hexdigest()
    if manifest.get(f.name) != digest:
        errors.append(f"hash mismatch or file not in manifest: {f.name}")
missing = set(manifest) - {f.name for f in model_dir.iterdir()}
errors += [f"file from manifest is missing: {m}" for m in sorted(missing)]

if errors:
    print("\n".join(errors)); sys.exit(1)
print("format and manifest OK")
```

What matters is that the manifest covers **all** model files, not just the weights: a modified `config.json` or tokenizer changes the model's behavior just as much as modified weights. For the same reason OpenSSF model signing signs a manifest of hashes for the entire model directory.

## AI-BOM: the model's bill of materials

An **AI-BOM** (or ML-BOM) extends the SBOM idea to AI systems. Besides software packages it lists:

- the model (name, version, hash, format, license, supplier),
- the **base model** it was fine-tuned from,
- training and evaluation datasets (provenance, version, license, whether they contain personal data),
- information from the **model card**: intended use, limitations, metrics, known risks,
- serving software dependencies (framework, runtime).

Why you need it: when a supplier announces that a base model or dataset is problematic (poisoned, license-disputed, withdrawn), the AI-BOM answers "which of our models use it" without manual archaeology. MITRE ATLAS lists it as mitigation **AML.M0023 AI Bill of Materials**.

### CycloneDX ML-BOM and SPDX 3.0

| | **CycloneDX** | **SPDX 3.0** |
|---|---|---|
| AI support | Since version 1.5: component types `machine-learning-model` and `data`, the `modelCard` field | **AI** and **Dataset** profiles |
| Model card | `modelCard`: `modelParameters` (approach, task, architecture, datasets, inputs/outputs), `quantitativeAnalysis`, `considerations` | AI profile fields (e.g. domain, autonomy, metrics, known limitations) |
| Format | JSON, XML, protobuf | JSON-LD |

A shortened CycloneDX AI-BOM example:

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.6",
  "components": [
    {
      "type": "machine-learning-model",
      "bom-ref": "model-tiketi-klasifikator",
      "name": "tiketi-klasifikator",
      "version": "3.2.0",
      "hashes": [{ "alg": "SHA-256", "content": "9f2c…" }],
      "licenses": [{ "license": { "id": "Apache-2.0" } }],
      "modelCard": {
        "modelParameters": {
          "task": "text-classification",
          "architectureFamily": "transformer",
          "datasets": [{ "ref": "data-tiketi-2026q2" }]
        },
        "considerations": {
          "useCases": ["Routing internal support tickets"],
          "technicalLimitations": ["Not evaluated on English text"]
        }
      }
    },
    {
      "type": "data",
      "bom-ref": "data-tiketi-2026q2",
      "name": "tiketi-2026q2",
      "data": [{ "type": "dataset", "classification": "internal, contains personal data (pseudonymized)" }]
    }
  ],
  "dependencies": [{ "ref": "model-tiketi-klasifikator", "dependsOn": ["data-tiketi-2026q2"] }]
}
```

You still generate the software part (packages in the serving image) with a tool such as `syft`, and you fill in the AI part (model, datasets, model card) from registry and experiment tracking metadata. Queries over an AI-BOM are ordinary `jq` filters:

```bash
# Which models depend on a given dataset?
jq -r --arg ds data-tiketi-2026q2 \
  '.dependencies[] | select(.dependsOn | index($ds)) | .ref' aibom.cdx.json

# Models without a declared license (the gate should fail)
jq -e '[.components[] | select(.type=="machine-learning-model" and (.licenses|not))] | length == 0' aibom.cdx.json
```

> **In practice:** an AI-BOM is only as good as its automation. If someone fills it in by hand once a year, it is wrong by the following week. Generate it in the same pipeline that registers the model, from the same metadata (run ID, dataset hash, base model), and store it with the model version in the registry, just as you store an SBOM with an image.

## Model theft and privacy attacks

A model is valuable for two reasons: **intellectual property** (training cost, data, know-how) and **the data it has memorized**. Attacks are classified by what the attacker has and what they want to obtain. NIST AI 100-2 (2025 edition) groups them as **privacy attacks**; MITRE ATLAS tracks them mostly under the Exfiltration tactic (AML.TA0010).

| Category | What the attacker has | What they get | ID |
|---|---|---|---|
| Weight theft | Access to infrastructure (registry, disk, bucket, insider) | A copy of the model | AML.T0025 Exfiltration via Cyber Means, AML.T0035 AI Artifact Collection |
| Model extraction | Only access to the inference API (AML.T0040) | An approximate copy of the behavior (surrogate model) | AML.T0024.002 Extract AI Model, AML.T0005 Create Proxy AI Model |
| Membership inference | API, sometimes with output probabilities | A conclusion about whether a specific record was in the training set | AML.T0024.000 Infer Training Data Membership |
| Model inversion | API | Reconstruction of properties of the training data | AML.T0024.001 Invert AI Model |
| Data extraction from an LLM | Access to the model | Memorized pieces of training text (personal data, secrets) | AML.T0057 LLM Data Leakage; OWASP **LLM02** Sensitive Information Disclosure |
| Cost and abuse | API without quotas | Mass queries, financial damage | AML.T0034 Cost Harvesting; OWASP **LLM10** Unbounded Consumption |

The OWASP Top 10 for LLM Applications 2025 no longer has a separate "Model Theft" category (it existed in the 2023 version): API-based extraction is part of **LLM10 Unbounded Consumption**, and data leakage from the model is part of **LLM02**.

The common precondition for API-based attacks is a **large number of queries** and **rich output** (probabilities, logits, embeddings, long responses). That is why most defenses come down to three levers: who may ask, how much they may ask, and how much information they get in the response.

### Defenses against weight theft

This is classic data protection, applied to files several tens of gigabytes in size:

| Risk | Control | Where |
|---|---|---|
| Public or overly shared bucket | Public access blocked, ACLs only for the pipeline and serving, encryption with a KMS key | Storage, IAM |
| Insider copies the model | Least privilege, a separate role for reading production weights, logging of every download, DLP alert on large transfers | IAM, audit log |
| Compromised serving pod | Read-only access to the required version only, no internet egress, node hardening | Kubernetes NetworkPolicy, PodSecurity |
| Model on an edge device or client side | Assume it is public; encryption and obfuscation only slow things down | Architecture decision |
| Proving theft | Model **fingerprinting** or watermarking, record of version hashes | Registry, legal process |

ATLAS mitigations: **AML.M0005** Control Access to AI Models and Data at Rest, **AML.M0019** Control Access to AI Models and Data in Production, **AML.M0012** Encrypt Sensitive Information, **AML.M0001** Limit Model Artifact Release.

Watermarks and fingerprints don't prevent theft. They let you prove a model's origin later, so plan them as a forensic control, not a preventive one.

### Defenses against API-based extraction

| Control | What it achieves | ATLAS |
|---|---|---|
| Authenticate every client, no anonymous access | Queries are tied to an identity, quotas make sense | AML.M0019 |
| Quotas per identity and per time window, token budget | Extraction becomes expensive and slow | **AML.M0004** Restrict Number of AI Model Queries |
| Minimal output: class instead of probabilities, rounding, top-1 instead of top-k | Less information per query | **AML.M0002** Passive AI Output Obfuscation |
| Pattern detection: many similar or systematically distributed queries, unusual volume | Early detection, account blocking | **AML.M0024** AI Telemetry Logging |
| Terms of use and contract | Legal basis for blocking and further action | (organizational) |

An example service that returns only what the application needs and keeps a per-client record:

```python
import time, logging
from collections import defaultdict, deque

log = logging.getLogger("inference-audit")
WINDOW_S, MAX_REQ = 3600, 500                 # per client, per hour
history = defaultdict(deque)

def allow(client_id: str) -> bool:
    now = time.time()
    q = history[client_id]
    while q and now - q[0] > WINDOW_S:
        q.popleft()
    if len(q) >= MAX_REQ:
        log.warning("quota exceeded client=%s count=%d", client_id, len(q))
        return False
    q.append(now)
    return True

def public_response(probs: dict[str, float]) -> dict:
    label = max(probs, key=probs.get)
    # The application needs a decision, not the full probability distribution
    return {"label": label, "confidence": "high" if probs[label] >= 0.8 else "low"}

def handle(client_id: str, text: str, model) -> dict:
    if not allow(client_id):
        return {"error": "rate_limited"}
    result = public_response(model.predict_proba(text))
    log.info("client=%s len=%d label=%s", client_id, len(text), result["label"])
    return result
```

In production, quotas and logging live in the API gateway, not in the memory of a single process; the example shows the logic, not the implementation.

> **In practice:** before an API starts returning probabilities, logits or embeddings, ask who actually uses them. Often only one internal team wants them for debugging. In that case the answer is a separate internal endpoint for that team, while the public API returns only the decision. The same logic applies to LLMs: parameters such as token log-probabilities are not needed by end users.

### Defenses for training data privacy

Membership inference, inversion and extraction of memorized text succeed when a model **over-memorizes** individual records (overfitting, duplicates, rare records). Defenses start before training:

| Control | When | Note |
|---|---|---|
| Minimization: don't train on personal data and secrets the model doesn't need | Data preparation | The strongest control; see module 7 |
| Deduplication and secret/PII scanning of the corpus | Data preparation | Duplicates significantly increase memorization |
| Regularization, early stopping, monitoring the train/test gap | Training | Less overfitting, weaker signal for membership inference |
| **Differential privacy** (e.g. DP-SGD) | Training | A formal guarantee, at a cost in accuracy and resources |
| Memorization tests: **canary** records and checking that the model doesn't reproduce them | Evaluation | Part of the promotion gate |
| Output filter for PII and secrets | Serving | Second line of defense, not a substitute for minimization |

```text
 data ──► [minimization, dedup, PII/secrets] ──► training [DP, regularization] ──► eval [canary, MIA test]
                                                                                       │
 client ◄── [PII output filter] ◄── serving [minimal output, quotas] ◄── gate ◄────────┘
```

> **In practice:** fine-tuning on internal documents is a common source of leaks. If the model needs to "know" the content of documents with different access rights, RAG with document-level access control (module 6) is usually a better choice than fine-tuning: access control is enforced on every query instead of disappearing into model weights that anyone with access to the endpoint can probe.

## ML platform checklist

- [ ] Management UIs and APIs (tracking, orchestration, serving admin) are not reachable outside the private network and require authentication.
- [ ] Every pipeline has its own identity; the training job cannot write to the production registry.
- [ ] Promotion to production happens only through the gate: format, manifest and signature, AI-BOM, evaluation.
- [ ] Serving loads the model by digest or version from the registry, not from an arbitrary path.
- [ ] Weights are encrypted at rest, downloads are logged, serving has no internet egress.
- [ ] The API has authentication and per-identity quotas, and returns minimal output.
- [ ] Query telemetry is retained and analyzed for extraction patterns (module 10).
- [ ] Training datasets are minimized, deduplicated and scanned for PII and secrets; a memorization test exists.

## Summary

- An ML pipeline has more artifacts than classic CI/CD: **data, code, weights and metadata**. Every transition between stages is a trust boundary.
- The most common MLOps platform problems are classic ones: exposed management APIs, overly broad credentials, a public artifact store. Treat an ML platform's management API like the Kubernetes API.
- Separate the role that trains from the role that promotes. The promotion gate checks the format (safetensors), manifest and signature, AI-BOM and evaluation.
- The **AI-BOM** (CycloneDX ML-BOM since 1.5, SPDX 3.0 AI and Dataset profiles) lists the model, base model, datasets, licenses and model card; ATLAS tracks it as AML.M0023. Generate it automatically with every version.
- Weight theft (AML.T0025, AML.T0035) is prevented with data protection: IAM, KMS, logging, egress control. Watermarks and fingerprints are for proving, not preventing.
- Extraction and privacy attacks via the API (**AML.T0024** .000/.001/.002) require many queries and rich output: authentication, quotas (AML.M0004), minimal output (AML.M0002) and telemetry (AML.M0024).
- In the OWASP Top 10 for LLM 2025, extraction falls under **LLM10 Unbounded Consumption**, and leakage of memorized data under **LLM02**.
- Training data privacy is protected mostly before training: minimization, dedup, PII scanning; then regularization or differential privacy and a memorization test in the gate.
