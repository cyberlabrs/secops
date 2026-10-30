## What this module covers

Domain 4, ML pipeline and model supply chain:

- **4.1** Model supply chain: safe serialization formats, model scanning, provenance and signing.

After this module you should be able to:

- list the components of the model supply chain and map the risks to OWASP **LLM03:2025 Supply Chain** and MITRE ATLAS,
- explain why loading a pickle file is code execution and which formats and settings prevent it,
- migrate safely from the pickle format to **safetensors**,
- use model scanners and understand what they can't detect,
- pin, sign and verify a model before deployment (OpenSSF Model Signing, cosign) and describe it in an AI-BOM.

## What the model supply chain consists of

A model you download from a public hub is not a single file. It is a set of artifacts, and each one comes from someone:

| Component | Example | Risk |
|---|---|---|
| Weights | `model.safetensors`, `pytorch_model.bin`, `model.gguf` | Code execution at load time (pickle), a backdoor in behavior |
| Configuration and tokenizer | `config.json`, `tokenizer.json` | Changed behavior, pointing to custom code |
| Custom model code | Python files shipped with the model (`trust_remote_code`) | Arbitrary code at load time |
| Adapters | A LoRA adapter from a third-party source | The same risks as weights, smaller and easier to slip in |
| Libraries | PyTorch, transformers, serving runtime | Vulnerabilities, malicious packages (classic SCA) |
| Data | Fine-tuning and evaluation datasets | Poisoning (module 07) |
| Infrastructure | Hub, internal registry, bucket | Version substitution, a tag that moves |

Mapping to frameworks:

- OWASP **LLM03:2025 Supply Chain** (vulnerable components, malicious or unverified models, adapters, weak license and provenance terms),
- OWASP **LLM04:2025 Data and Model Poisoning** for backdoors built into weights,
- MITRE ATLAS **AML.T0010 AI Supply Chain Compromise** with sub-techniques for AI software (**.001**), data (**.002**) and model (**.003**), **AML.T0058 Publish Poisoned Models**, **AML.T0011.000 Unsafe AI Artifacts** (a user loads an unsafe artifact) and **AML.T0018.002 Embed Malware** (malicious code in a model artifact).

```text
 public hub / vendor                      your organization
 ┌──────────────┐   ┌──────────── MODEL INTAKE (isolated) ─────────────┐   ┌──────────────┐
 │ model repo   │──►│ pin (commit) → scan → convert to                 │──►│ internal     │
 │ (weights,    │   │ safetensors → evaluate → sign → AI-BOM           │   │ model        │
 │  code,config)│   └──────────────────────────────────────────────────┘   │ registry     │
 └──────────────┘                                                          └──────┬───────┘
                                                                                  │
                                             serving: signature and format check ◄┘
                                             (loads only safetensors, no remote code)
```

> **In practice:** treat a model from a hub as a binary from the internet, not as "data." Nobody on your team would run an `.exe` from an unknown repo on a build server with production secrets. Loading a pickle model from the same place is the same act.

## Why pickle is dangerous

Python's **pickle** module stores not just data but also instructions for how to rebuild the object. Those instructions can call any function available in the environment. That is why the official Python documentation warns: never unpickle data from an untrusted or unauthenticated source. Loading (`pickle.load`, and anything that uses it underneath) is **code execution** with the process's rights: access to files, the network, secrets in the environment.

The problem isn't limited to files with the `.pkl` extension:

| Format / API | Uses pickle? | Note |
|---|---|---|
| PyTorch `.pt`, `.pth`, `.bin` (`torch.save`) | Yes, inside a ZIP archive | Since PyTorch 2.6 `torch.load` defaults to `weights_only=True` (a restricted unpickler) |
| `joblib`, `pickle` (scikit-learn models) | Yes | No safe default loading method |
| NumPy `.npy`/`.npz` | Only for object arrays | `np.load` defaults to `allow_pickle=False`; don't change that for untrusted files |
| Keras `.keras` | No (ZIP + JSON + weights) | Lambda layers contain code; Keras 3 has `safe_mode=True`, which blocks them, so don't disable it |
| Legacy Keras HDF5 `.h5` | No, but can carry serialized layer code | Prefer the newer format |
| **safetensors** | No | Only tensors and metadata, no code |
| GGUF | No | A format for local LLM runtimes; the risk is in the runtime's parser, so keep it up to date |
| ONNX | No (protobuf) | A graph of operations; custom operators and external files need attention |

Safe default settings in popular libraries:

```python
import torch, numpy as np
from transformers import AutoModel

state = torch.load("model.pt", weights_only=True)      # explicit, also on older versions
arr = np.load("features.npy", allow_pickle=False)      # the default, but be explicit
model = AutoModel.from_pretrained(
    "/models/interni/klasifikator",                    # a local, verified directory
    trust_remote_code=False,                           # the default; never True for an unknown repo
    use_safetensors=True,                              # refuse to load if there is no safetensors
)
```

`weights_only=True` significantly reduces the risk, but it is still an unpickler with an allowlist, so the goal is a **code-free format**, not just a better-configured pickle.

## safetensors

**safetensors** is a format developed by Hugging Face for storing tensors safely. Its structure is deliberately simple:

```text
┌──────────────┬──────────────────────────────────────┬──────────────────────────┐
│ 8 bytes:     │ JSON header:                          │ raw tensor bytes          │
│ header       │ {"tezina1": {"dtype":"F32",           │ (one contiguous block)    │
│ length       │   "shape":[768,768],                  │                          │
│ (u64, LE)    │   "data_offsets":[0,2359296]}, ...,   │                          │
│              │  "__metadata__": {...}}               │                          │
└──────────────┴──────────────────────────────────────┴──────────────────────────┘
```

What it gives you:

- **no code execution** at load time: the parser reads JSON and copies bytes,
- the header can be inspected without loading the tensors (sizes, types, metadata),
- fast loading and memory mapping (zero-copy),
- the format has undergone an independent security audit (Trail of Bits, 2023) and is today the default for most models on the Hugging Face Hub.

```python
import json, struct
import numpy as np
from safetensors.numpy import save_file, load_file

# saving and loading
save_file({"w": np.zeros((4, 4), dtype=np.float32)}, "model.safetensors",
          metadata={"source": "interni-trening", "version": "1.2.0"})
tensors = load_file("model.safetensors")

# inspecting the header without loading tensors (e.g., in a pre-deployment check)
with open("model.safetensors", "rb") as f:
    n = struct.unpack("<Q", f.read(8))[0]
    if n > 100 * 1024 * 1024:
        raise ValueError("suspiciously large header")
    header = json.loads(f.read(n))
print(header["__metadata__"], [k for k in header if k != "__metadata__"])
```

safetensors solves the problem of **code execution at load time**. It doesn't solve the problem of **content**: weights in safetensors format can still contain a backdoor or be the wrong model. That is why the format goes together with provenance, signing and evaluation.

## Migrating from pickle to safetensors

Conversion requires loading the pickle file once, and that is exactly the risky operation. The order of decisions:

1. **Does a safetensors version exist at the source?** Most models on hubs are already published in safetensors format. Download that and don't convert anything.
2. If it doesn't exist and the model comes from **your own** training: change the training pipeline to save safetensors and re-export.
3. If you must convert someone else's pickle: do it in an **isolated, ephemeral environment** without network or secrets, after static scanning, with `weights_only=True`, and verify the result.

```python
# convert.py - runs in a container: --network none, read-only input, no credentials
import sys, torch, numpy as np
from safetensors.numpy import save_file, load_file

src, dst = sys.argv[1], sys.argv[2]
state = torch.load(src, map_location="cpu", weights_only=True)   # restricted unpickler
arrays = {k: v.detach().cpu().numpy() for k, v in state.items()}
save_file(arrays, dst, metadata={"converted_from": src})

back = load_file(dst)
assert set(back) == set(arrays)
assert all(np.array_equal(back[k], arrays[k]) for k in arrays)    # the same tensors
```

After conversion:

- compute the hash of the new file and record it in the registry,
- sign the safetensors file (next section),
- retire the pickle version; serving must no longer be able to load it,
- add a CI check that rejects `.pt`, `.pth`, `.bin`, `.pkl`, `.joblib` in the model directory for deployment.

```yaml
# model-policy.yaml - rules for serving
allowed_formats: [safetensors, gguf, onnx]
denied_extensions: [.pkl, .pickle, .pt, .pth, .bin, .joblib, .h5]
require_signature: true
trusted_signers:
  - identity: ml-release@firma.rs
trust_remote_code: false
source: internal-registry-only     # no direct download from a public hub in production
```

> **In practice:** the quickest win is an inventory: find all model files in repos, buckets and images (search by extension and by "magic" bytes) and flag which ones are pickle. Most teams discover old `.pkl` scikit-learn models that nobody has touched in years, but that are loaded in production every time the service starts.

## Model scanning

Model scanners statically inspect artifacts without loading them: for pickle, they analyze the instruction stream and look for imports of functions that can execute code (e.g., from process or network modules). Examples of open-source tools are **ModelScan** (Protect AI), **picklescan** and **fickling** (Trail of Bits), and the Hugging Face Hub itself also scans published files and shows warnings.

You can understand the same principle through the standard library. `pickletools.genops` reads instructions **without executing them** and lets you check imports against an allowlist:

```python
import pickletools, sys

ALLOWED = {("collections", "OrderedDict"), ("torch._utils", "_rebuild_tensor_v2"),
           ("torch", "FloatStorage"), ("numpy.core.multiarray", "_reconstruct")}

def imported_globals(data: bytes):
    """Statically extracts (module, name) from GLOBAL instructions; nothing is executed."""
    found, strings = [], []
    for op, arg, _ in pickletools.genops(data):
        if op.name in ("SHORT_BINUNICODE", "BINUNICODE", "UNICODE"):
            strings.append(arg)
        elif op.name == "GLOBAL":
            found.append(tuple(arg.split(" ", 1)))
        elif op.name == "STACK_GLOBAL" and len(strings) >= 2:
            found.append((strings[-2], strings[-1]))
    return found

data = open(sys.argv[1], "rb").read()
bad = [g for g in imported_globals(data) if g not in ALLOWED]
if bad:
    sys.exit(f"REJECTED: imports outside the allowlist: {bad}")
```

This is a simplified example for understanding; in a pipeline use a maintained scanner. You should know the limits of scanning:

| Limitation | Consequence | Control |
|---|---|---|
| A blocklist approach (a list of "dangerous" functions) can be bypassed | The scanner says "clean," but the file isn't | An allowlist approach or, better, a code-free format |
| The scanner doesn't see the model's behavior | A backdoor in the weights gets through (ATLAS **AML.T0018.000**) | Provenance, evaluation, behavior tests |
| New formats and containers (ZIP, nested files) | The scanner doesn't unpack everything | An up-to-date scanner, rejecting unknown formats |
| Scanning only at download time | The file is later swapped in the bucket | Signing and verification at deployment |

Scanning is a **signal at intake**, not proof of safety. The main controls are a code-free format, provenance and signing.

> **In practice:** make the scanner a mandatory intake step and a CI check over the model directory, with the rule "a finding blocks, an exception requires approval." The warnings a hub shows are useful to a developer choosing a model, but they aren't your control: you don't know which scanner version they use or when the file was scanned.

### Vulnerabilities in ML libraries and runtimes

The supply chain isn't just the model. Libraries for loading and serving (PyTorch, transformers, runtimes for GGUF and ONNX, serving servers) have vulnerabilities like any software, including bugs in format parsers. Therefore:

- libraries go through the same SCA process as other dependencies (the DevSecOps course, module 06),
- versions are pinned in a lock file, and the serving image is scanned and signed,
- the serving process runs as non-root, without unnecessary capabilities and with restricted network egress, so that a parser bug has the smallest possible reach.

## Provenance: pinning and an internal registry

- **Pin the exact revision.** On git-based hubs, reference a commit hash, not the `main` branch or a tag that can move:

  ```python
  AutoModel.from_pretrained("org/model", revision="a1b2c3d4e5f6...", use_safetensors=True)
  ```

- **An internal registry or mirror.** Production downloads only from an internal registry (e.g., MLflow Model Registry, an OCI registry, a versioned bucket), which a model enters through the intake process. Direct egress to public hubs from production is blocked.
- **Verify the publisher.** The organization on the hub, history, model card, license. Names that resemble well-known organizations are a known substitution pattern (typosquatting).
- **Record provenance**: where from, which revision, who approved it, the hash of every file, the results of scanning and evaluation.

## Model signing

A signature answers two questions: is this **exactly that** model (integrity), and **who** published it (identity). A hash in the registry answers only the first, and only while the registry is intact.

### OpenSSF Model Signing

The **OpenSSF Model Signing** project (the `model_signing` library and CLI, version 1.0 released in April 2025) signs the model as a whole: it computes the hash of every file in the model directory, builds a **manifest** and signs the manifest. The signature is in **Sigstore bundle** format, so it works with existing Sigstore tools. It supports keyless signing via Sigstore (OIDC identity, transparency log) and signing with a key or certificate for environments without internet access.

```bash
pip install model-signing

# keyless (Sigstore): identity from an OIDC login, entry in the transparency log
model_signing sign ./klasifikator --signature model.sig
model_signing verify ./klasifikator --signature model.sig \
  --identity "ml-release@firma.rs" --identity-provider "https://accounts.google.com"

# with a key (e.g., internally, without internet)
model_signing sign key ./klasifikator --private-key release.key --signature model.sig
model_signing verify key ./klasifikator --signature model.sig --public-key release.pub
```

The advantage of a manifest: modifying, adding or deleting any file in the directory (including `config.json` or the tokenizer) breaks verification, and the signature is separate from the model, so the model doesn't need to be repackaged.

### cosign for individual artifacts

If you distribute a model as a single file or as an OCI artifact, you can use **cosign** just like for images (the DevSecOps course, module 10). In an offline environment, like the lab, you use a key pair without a transparency log. The example is for cosign 3.x (in the lab), which stores the signature in a Sigstore bundle:

```bash
cosign generate-key-pair                                   # cosign.key, cosign.pub
cosign sign-blob --key cosign.key --use-signing-config=false --tlog-upload=false \
  --bundle model.safetensors.bundle -y model.safetensors
cosign verify-blob --key cosign.pub --insecure-ignore-tlog=true \
  --bundle model.safetensors.bundle model.safetensors
```

cosign 2.x has no `--use-signing-config`, and the signature is usually stored as a separate file (`--output-signature`).

### Verification at deployment

A signature nobody verifies protects nothing. Verification happens **immediately before loading**, in the same environment where the model is used:

```text
 registry ──► init container / loader:
                1. download model + signature (by digest, not by name)
                2. verify (expected identity or public key from configuration)
                3. check the format (only safetensors/gguf/onnx) and the policy
                4. only then start serving ── failure = the pod doesn't start
```

> **In practice:** keep the public key or the expected signer identity in configuration controlled by the platform team (e.g., a ConfigMap under GitOps review), not alongside the model itself. If the check is "a signature that arrives in the same bucket, verified with a key from the same bucket," an attacker who swaps the model also swaps the key.

## AI-BOM: what's in the model

An **AI-BOM** (or **ML-BOM**) is an SBOM extended for AI: which models, data and libraries the system uses and where they come from. **CycloneDX** since version 1.5 has the component type `machine-learning-model` with a `modelCard` object (model parameters, quantitative analysis, considerations on use and limitations) and the type `data` for datasets. **SPDX 3.0** has AI and Dataset profiles for the same purpose.

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.6",
  "components": [
    {
      "type": "machine-learning-model",
      "name": "klasifikator-tiketa",
      "version": "1.2.0",
      "hashes": [{ "alg": "SHA-256", "content": "4e1f…" }],
      "externalReferences": [{ "type": "distribution", "url": "https://registry.interno/models/klasifikator-tiketa/1.2.0" }],
      "modelCard": {
        "modelParameters": { "task": "text-classification", "architectureFamily": "transformer" },
        "considerations": { "useCases": ["support ticket routing"] }
      }
    },
    { "type": "data", "name": "tiketi-klasifikacija", "version": "2026.09.1" }
  ]
}
```

You add the libraries from the environment (PyTorch, transformers) with the same SBOM tools as for any software (e.g., `syft`), and the model and data components from the registry and the data card. Generating the AI-BOM as part of the MLOps pipeline is the topic of module 09.

## Intake process for third-party models

| Step | Question | Evidence |
|---|---|---|
| Request | Who needs the model and for what? | A ticket with an owner and purpose |
| Source and license | Who is the publisher, does the license allow the use? | Model card, license, organization check |
| Pin | Which exact revision? | Commit hash, hash of every file |
| Format | Is there a safetensors version? Is remote code needed? | File list; rejection without justification |
| Scanning | Are there suspicious artifacts? | Scanner report |
| Evaluation | Does the model work as expected, including on security tests? | Results on an internal set (module 10) |
| Signing and registry | Is the internal copy signed? | Signature, registry entry, AI-BOM |
| Review | When is the model reassessed? | Date, triggers (new version, a CVE in the runtime) |

## Summary

- The model supply chain consists of weights, configuration, tokenizer, custom code, adapters, libraries, data and the registry; OWASP **LLM03:2025**, ATLAS **AML.T0010** (.001 software, .002 data, .003 model), **AML.T0058**, **AML.T0011.000**.
- Loading a **pickle** file is code execution. That includes PyTorch `.pt/.pth/.bin` and `joblib`. Settings: `weights_only=True`, `allow_pickle=False`, `safe_mode=True`, `trust_remote_code=False`.
- **safetensors** has no code: a JSON header and raw tensors. It solves code execution at load time, not a backdoor in the content.
- Migration: first look for safetensors at the source; if you must convert, do it in isolation, without network or secrets, verify the tensors, sign the result and forbid pickle in serving.
- Scanners (ModelScan, picklescan, fickling) are a signal at intake; a blocklist can be bypassed, and they don't see the model's behavior.
- Provenance: pin the commit hash, download from an internal registry, verify the publisher and the license.
- **OpenSSF Model Signing** signs a manifest of the hashes of all files (Sigstore bundle, keyless or with a key); **cosign** for individual artifacts. Verification happens immediately before loading, with a key or identity that doesn't come with the model.
- **AI-BOM**: CycloneDX `machine-learning-model` with `modelCard` and `data` components (since 1.5), SPDX 3.0 AI and Dataset profiles.
