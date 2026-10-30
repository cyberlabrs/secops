## What this module covers

Domain 3, RAG and data:

- **3.2** Data protection for AI: personal data, training data governance, data poisoning defenses.

After this module you should be able to:

- map where personal data enters an AI system and where it can leave it (training, prompts, logs, feedback),
- apply data protection principles (minimization, purpose limitation, retention) to training and inference,
- establish dataset governance: inventory, provenance, versioning, licenses, access,
- explain the classes of data poisoning per NIST AI 100-2 and OWASP **LLM04:2025 Data and Model Poisoning**, and put controls into the data pipeline,
- connect these controls to the EU AI Act's data requirements for high-risk systems.

## Data across the AI system lifecycle

In a classic application, data lives in the database and in the logs. In an AI system, data passes through more places, and some of them are hard to "clean up" afterwards:

```text
 collection ──► labeling ──► training set ──► training / fine-tuning ──► model
     │              │                 │                        │                  │
  sources,      people or         versioned              weights can          inference
  licenses,     vendors           snapshot (hash)        memorize               │
  consent       (access!)                                data                   ▼
                                                                    prompts, responses, logs
                                                                                │
        ◄────────────── feedback loop: user ratings, new examples ◄─────────────┘
```

| Place | Risk | Primary control |
|---|---|---|
| Collection | Data without a legal basis or license | Source inventory, legal basis, per-source license |
| Labeling | People or vendors accessing sensitive data; deliberately wrong labels | Pseudonymization before labeling, contract, label quality control |
| Training set | Poisoning, unauthorized changes, unknown provenance | Immutable snapshots with a hash, access control, validation |
| Model weights | Memorization and reproduction of personal data | Minimization and deduplication before training, leakage evaluation |
| Prompts and logs | Users enter personal data and business secrets | Redaction, retention, log access, vendor terms |
| Feedback loop | Poisoning through user ratings and examples | Review before retraining, trust levels |

## Personal data in AI systems

### Principles that apply to models too

**GDPR** in the EU and the **Law on Personal Data Protection** (ZZPL) in Serbia, which is largely aligned with GDPR, make no exception for AI. The principles translate directly into engineering decisions:

| Principle | Question for the AI system | Engineering control |
|---|---|---|
| Lawfulness and legal basis | On what basis may we use this data for training? | The legal basis recorded with every source in the inventory |
| Purpose limitation | Data collected for customer support: may it be used for training? | A purpose label on the dataset; the pipeline rejects a dataset without an allowed purpose |
| **Minimization** | Does the model need the name, national ID number and address to learn ticket classification? | Removal or pseudonymization before training |
| Accuracy | What if the model "knows" outdated data about a person? | Versioning, the ability to retrain |
| Storage limitation | How long do we keep prompts and logs? | A defined period and automatic deletion |
| Integrity and confidentiality | Who has access to datasets and logs? | RBAC, encryption, audit |

For processing likely to pose a high risk (new technologies, large-scale processing, profiling), both regulations require a **data protection impact assessment** (DPIA). Most projects that train or fine-tune models on customer or employee data fall into this category.

### Memorization and privacy attacks

Models can **memorize** parts of their training data and reproduce them in a response, especially rare strings that repeat (e.g., an email signature with a phone number). In its adversarial ML taxonomy, NIST AI 100-2 also describes privacy attacks: data reconstruction, **membership inference** (inferring whether a record was in the training set) and extraction of data from the model. More in module 09; what matters here is the consequence for data governance:

**Personal data that has made it into the model's weights cannot be reliably "deleted" without retraining.** That is why minimization happens before training, not after.

Controls that reduce memorization and leakage:

- removing and pseudonymizing direct identifiers before training,
- **deduplication**: repeated records are memorized much more easily,
- training techniques with formal privacy guarantees (**differential privacy**) where the risk is high and the loss of accuracy is acceptable,
- evaluation before release: a test of whether the model reproduces canaries or known sensitive strings from the dataset,
- output filtering for personal data as an additional layer (module 04).

> **In practice:** before you ask "how do we anonymize the data for fine-tuning," ask "does the model need this data at all." For ticket classification or documentation summarization, the model almost never needs names and numbers. What never enters the dataset can't leak, and doesn't need a DPIA justification either.

### Personal data in prompts and logs

At inference time users enter data themselves: customer emails, contracts, health data. That data ends up in the application's logs, in the model vendor's logs and sometimes in datasets for future training.

| Question | Control |
|---|---|
| Does the vendor use our prompts for training? | Contract and account settings; business plans usually exclude it, but verify |
| How long does the vendor keep prompts? | A contractual retention period; for sensitive cases, zero-retention options where available |
| What do we log? | Redaction before writing; full prompts only where needed, with a shorter period and narrower access |
| Who reads the logs? | Access as for production data, with auditing |
| What if a user pastes a secret? | Secret detection on input and in logs, rotation if the secret reached the vendor |

```python
import re

PATTERNS = {
    "EMAIL": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "IBAN":  re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
    "JMBG":  re.compile(r"\b\d{13}\b"),
    "PHONE": re.compile(r"\+?\d[\d /-]{7,}\d"),
}

def redact(text: str) -> tuple[str, dict]:
    """Replaces personal data with labels before logging or sending to a training set."""
    counts = {}
    for label, rx in PATTERNS.items():
        text, n = rx.subn(f"[{label}]", text)
        if n:
            counts[label] = n
    return text, counts            # counts go into metrics, not the original values
```

(JMBG is the 13-digit national personal identification number used in Serbia and the region.)

Regex is a good start, but it misses names, addresses and free text. In production you use dedicated personal data detection tools (e.g., Microsoft Presidio, a combination of rules and NER models), and measure how much they miss on a manually labeled sample.

## Training data governance

### Dataset inventory and documentation

Every dataset used for training, fine-tuning or evaluation is an **artifact**, just like code: it has an owner, a version and provenance. The "datasheets for datasets" practice and **data cards** require documenting, alongside the dataset:

- the source and collection method, the legal basis and the license,
- the purpose and permitted use (and prohibited use),
- whether it contains personal or special-category data and how it was processed,
- known limitations and biases, distribution across relevant groups,
- the version, the snapshot hash, and who approved it.

```yaml
# datasets/tiketi-klasifikacija/datacard.yaml
name: tiketi-klasifikacija
version: 2026.09.1
owner: tim-podrska-ml
sources:
  - system: helpdesk
    period: 2024-01..2026-08
    legal_basis: legitimni_interes        # confirmed with the DPO, ref. DPIA-2026-014
    license: interno
purpose: [klasifikacija_tiketa]
forbidden_use: [profilisanje_zaposlenih]
personal_data:
  direct_identifiers: removed             # redaction v3, report in reports/
  special_categories: none_detected
snapshot:
  uri: s3://ml-data/tiketi/2026.09.1/
  manifest_sha256: 9b2e…
approved_by: [vlasnik-podataka, dpo]
```

(Values in this example: `tiketi-klasifikacija` = ticket classification, `legitimni_interes` = legitimate interest, `interno` = internal, `profilisanje_zaposlenih` = employee profiling, `vlasnik-podataka` = data owner.)

### Provenance, versioning and integrity

- A training set is an **immutable snapshot**: new data means a new version, not a change to the existing one.
- The snapshot comes with a **manifest** containing the hash of every file; the training pipeline verifies the manifest before starting.
- Data versioning tools (e.g., DVC, lakeFS or versioned object storage with object lock) provide the link "this model was trained on exactly this version of the data."
- Only the pipeline and a small number of people have write access to datasets; read access is separate from write access.
- Lineage: from a model in production you must be able to get to the version of the dataset, the code and the training configuration. That is a prerequisite for responding to a poisoning incident and for regulatory requirements.

```python
import hashlib, json, pathlib, sys

def verify_manifest(root: str, manifest_path: str) -> None:
    manifest = json.loads(pathlib.Path(manifest_path).read_text())
    bad = []
    for rel, expected in manifest["files"].items():
        h = hashlib.sha256(pathlib.Path(root, rel).read_bytes()).hexdigest()
        if h != expected:
            bad.append(rel)
    extra = {str(p.relative_to(root)) for p in pathlib.Path(root).rglob("*") if p.is_file()} - set(manifest["files"])
    if bad or extra:
        sys.exit(f"dataset integrity violated: modified={bad} unexpected={sorted(extra)}")
```

A manifest is only as strong as the protection of the manifest itself: it is stored separately from the data, with narrower write rights, and ideally signed (the same principle as model signing in module 08).

> **In practice:** ask the ML team to show the exact dataset version a production model was trained on. If the answer is "it was the folder `data/final_v2_novo` on someone's laptop," the first task isn't advanced poisoning detection but versioning and a manifest. Without lineage you can't even establish that a poisoning incident happened.

### EU AI Act data requirements

For high-risk systems, **Article 10 of the EU AI Act** (Regulation (EU) 2024/1689) requires data governance practices for training, validation and testing datasets: documented design and collection decisions, provenance, preparation (labeling, cleaning), examination of possible biases and measures to detect and mitigate them, and that datasets be relevant, sufficiently representative and, to the best extent possible, free of errors and complete for the intended purpose. Special categories of personal data may exceptionally be processed to detect and correct bias, subject to strict safeguards.

Deadlines: after the amendments in the **AI Omnibus** package (Regulation (EU) 2026/1744), the obligations for high-risk systems under Annex III apply from 2 December 2027, and for those under Annex I from 2 August 2028. The practices in this module (inventory, data cards, lineage, bias checks) are exactly what will be requested as evidence, so they are worth introducing before the deadline. Classifying systems by risk is the topic of module 11.

### Pseudonymization is not anonymization

Teams often say "the data is anonymized" when they have only replaced names with labels. The difference matters legally and technically:

| Technique | What it does | Is the data still personal? |
|---|---|---|
| **Pseudonymization** | Identifiers replaced with labels or tokens; a linking key exists somewhere | Yes. GDPR and ZZPL still apply; it reduces risk but doesn't exempt |
| Redaction | Identifiers removed from the text | It depends on what remains: free text often contains enough for re-identification |
| **Anonymization** | The person can't be identified by reasonably available means | No, but real anonymization is hard to achieve and to prove |
| Synthetic data | New records generated from a model of real data | It depends: the generator can reproduce real records; verification is needed |
| Aggregation | Only aggregate values | Usually not, except for very small groups |

A combination of rare attributes (postal code, date of birth, occupation) is often enough for identification. That is why an anonymization claim is documented and checked with the DPO, and the data card states the exact technique, not a general term.

### Fine-tuning at the model vendor

When fine-tuning is done through a vendor's API, the training set leaves the organization. In addition to the questions in the prompts table, it is worth asking:

- where the uploaded datasets and the fine-tuned model are stored, and how they are deleted,
- whether the fine-tuned model is available only to your organization,
- whether the vendor runs its own checks on the dataset's content and what happens to rejected records,
- whether the contract covers data transfers outside the EU/EEA, if applicable.

> **In practice:** introduce a rule that no dataset goes to training (internally or at a vendor) without a data card signed by the data owner. It is a small administrative step that forces the team to answer the questions about legal basis, personal data and license before the data gets into the weights, while the answer is still cheap.

## Data poisoning

### Taxonomy

**NIST AI 100-2** (Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations) distinguishes poisoning attacks by goal:

| Class (NIST AI 100-2) | Attacker goal | What the consequence looks like |
|---|---|---|
| **Availability poisoning** | General degradation of the model | Accuracy drops for everyone, the model becomes unusable |
| **Targeted poisoning** | Wrong behavior for specific inputs | The model fails only on selected examples |
| **Backdoor poisoning** | Hidden behavior activated by a trigger | The model works normally until a specific pattern appears |
| **Model poisoning** | Direct modification of the model or its updates | E.g., a malicious update in federated learning |

With generative models the same patterns appear in fine-tuning data, in instruction datasets and in the feedback loop (user ratings). OWASP covers this as **LLM04:2025 Data and Model Poisoning**, and MITRE ATLAS as **AML.T0020 Poison Training Data**, **AML.T0019 Publish Poisoned Datasets** and **AML.T0010.002** (data supply chain compromise).

### Conditions that enable poisoning

- data from sources an attacker can influence: the public web, open datasets, forums, tickets and user ratings,
- datasets downloaded by URL without an integrity check (the content at a URL can change after the list is published, e.g., when a domain expires and someone else takes it over),
- broad write access to internal datasets,
- no review and no statistical check before training,
- no lineage, so a poisoned dataset can be neither found nor removed.

### Defense by stage

| Stage | Control | ATLAS mitigation |
|---|---|---|
| Source selection | A source allowlist with an owner; a trust assessment for public datasets | — |
| Download | A content hash at first download, compared at every subsequent one; downloading from trusted mirrors | **AML.M0025** Maintain AI Dataset Provenance |
| Intake | Schema validation, deduplication, outlier detection, label distribution compared to the previous version | **AML.M0007** Sanitize Training Data |
| Storage | Immutable snapshots, manifest, write access control | **AML.M0005** Control Access to AI Models and Data at Rest |
| Training | Manifest verification before starting; an isolated environment | **AML.M0014** Verify AI Artifacts |
| Evaluation | Comparison with the previous model on a fixed set, tests for known triggers and targeted classes | **AML.M0008** Validate AI Model |
| Feedback loop | User ratings don't go straight into training; review, a per-user contribution limit | — |

### Statistical checks before training

Simple checks catch many errors and crude poisoning attempts. They don't guarantee detection of a carefully crafted backdoor, but they raise the cost of the attack and provide a signal:

```python
import numpy as np

def label_shift(prev: np.ndarray, curr: np.ndarray, n_classes: int, tol=0.05) -> list[int]:
    """Returns the classes whose share changed by more than tol compared to the previous dataset version."""
    p = np.bincount(prev, minlength=n_classes) / len(prev)
    c = np.bincount(curr, minlength=n_classes) / len(curr)
    return [k for k in range(n_classes) if abs(p[k] - c[k]) > tol]

def duplicate_ratio(texts: list[str]) -> float:
    norm = [" ".join(t.lower().split()) for t in texts]
    return 1 - len(set(norm)) / len(norm)

# Gate in the pipeline: a change in distribution, a sudden rise in duplicates or a large
# contribution from a single source/user stops training and opens a review.
```

| Signal | Possible cause |
|---|---|
| The share of one class suddenly rose | An error in the source or targeted poisoning |
| Many near-identical examples | Mass injection of the same pattern |
| A single user or source contributes a large share of new examples | Abuse of the feedback loop |
| The model is better on average, worse on one subgroup | Targeted poisoning or bias |
| An unusual string repeats in examples with the same label | A possible backdoor trigger |

> **In practice:** the feedback loop is the most often neglected poisoning path. A "thumbs up" button that directly feeds the dataset for the next fine-tune means that anyone with an account writes into your training data. Introduce a per-user contribution limit, sample review and a separate trust level for such data.

### If poisoning is discovered

1. Stop training and deployment of new versions that use the suspect dataset.
2. Use lineage to find all models trained on that version of the data.
3. Roll production back to the last model trained on a verified version (this is why old models and datasets are kept).
4. Remove the poisoned records, create a new dataset version and retrain.
5. Determine how the data got in and close that path (source, access, feedback loop).

## Data pipeline checklist

| Area | Question | Evidence |
|---|---|---|
| Inventory | Does every dataset have an owner, purpose, legal basis and license? | Data card |
| Personal data | Were direct identifiers removed before training? | Redaction report, miss-rate measurement |
| DPIA | Was an impact assessment done where processing is risky? | DPIA document |
| Integrity | Is the dataset an immutable snapshot with a protected manifest? | Manifest, signature, object lock |
| Access | Who can write to datasets and logs? | IAM policy, audit log |
| Validation | Does the pipeline have a statistical gate before training? | Pipeline configuration, reports |
| Lineage | Can you get from the model to the data version? | Entry in the model registry |
| Logs | Are redaction and retention periods defined? | Configuration, policy |
| Vendors | Do contracts exclude training on our data and define retention? | Contract, account settings |
| Recovery | Are the previous model and dataset kept for rollback? | Registry, retention policy |

## Mapping to frameworks

| Topic | Framework | What it requires |
|---|---|---|
| Data and model poisoning | OWASP LLM04:2025 | Data provenance, validation and isolation, evaluation |
| Personal data in responses | OWASP LLM02:2025 Sensitive Information Disclosure | Minimization, redaction, output filtering |
| Attacks on data | NIST AI 100-2 | Taxonomy of poisoning and privacy attacks |
| Data risk management | NIST AI RMF (Map and Measure functions) | Documented data, measurement of bias and quality |
| High-risk system data | EU AI Act, Article 10 | Data governance, representativeness, bias |
| Personal data protection | GDPR, ZZPL | Legal basis, minimization, DPIA, data subject rights |
| AI system management | ISO/IEC 42001 (Annex A, data for AI systems) | Processes for data quality, provenance and preparation |

## Summary

- Data in an AI system passes through collection, labeling, datasets, model weights, prompts, logs and the feedback loop; each place has its own risk and owner.
- GDPR and ZZPL apply to AI too: legal basis, purpose limitation, **minimization**, retention periods, a DPIA for risky processing.
- Personal data in the model's weights can't be reliably deleted without retraining: minimize and deduplicate beforehand, and evaluate leakage before release.
- Prompts and logs: redaction before logging, retention periods, vendor terms (training, retention), secret detection.
- A training set is an artifact: data card, owner, legal basis, license, an immutable snapshot with a manifest, access control, lineage to the model.
- EU AI Act Article 10 requires data governance and bias examination for high-risk systems; under the AI Omnibus, Annex III from 2 Dec 2027, Annex I from 2 Aug 2028.
- Poisoning (NIST AI 100-2): availability, targeted, backdoor and model poisoning; OWASP **LLM04:2025**, ATLAS **AML.T0020**, **AML.T0019**, **AML.T0010.002**.
- Defense: a source allowlist, a hash at download, validation and statistical checks, immutable snapshots, evaluation against the previous model, a controlled feedback loop and a plan for rolling back to a verified model.
