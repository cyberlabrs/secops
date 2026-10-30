# Lab 1: An AI-BOM for a model

Just as an SBOM describes software, an **AI-BOM** describes a model: what it is, who made it, what data it was trained on, under which license and with which hash. CycloneDX (since version 1.5) has the component type `machine-learning-model` with a **model card**, and the type `data` for datasets. AI-BOMs are requested more and more often (inventory for the EU AI Act, vendor assessment, incident response: "which services use model X?").

`/root/mlbom/` contains the model `klasifikator-tiketa.safetensors` (ticket classifier) and information about it in `opis.json` (description). The keys in `opis.json` are in Serbian: `ime` = name, `verzija` = version, `dobavljac` = supplier, `licenca` = license, `zadatak` = task, `arhitektura` = architecture, `opis` = description, `ograničenja` = limitations.

```bash
cd /root/mlbom
cat opis.json
sha256sum klasifikator-tiketa.safetensors
```

<!-- setup
set -e
mkdir -p /root/mlbom
cd /root/mlbom
/opt/ai/bin/python - <<'EOF'
import numpy as np
from safetensors.numpy import save_file
rng = np.random.default_rng(42)
save_file({"w": rng.standard_normal((32, 4)).astype(np.float32), "b": np.zeros(4, dtype=np.float32)}, "klasifikator-tiketa.safetensors", metadata={"verzija": "2.1.0"})
EOF
cat > opis.json <<'EOF'
{
  "ime": "klasifikator-tiketa",
  "verzija": "2.1.0",
  "dobavljac": "Kurs Shop d.o.o., ML tim",
  "licenca": "Apache-2.0",
  "zadatak": "text-classification",
  "arhitektura": "logistic-regression",
  "dataset": {"ime": "tiketi-podrske-2025", "verzija": "2025.12", "opis": "Anonimizovani tiketi podrške 2023–2025", "licenca": "proprietary"},
  "ograničenja": "Samo bosanski/srpski/hrvatski jezik; ne koristiti za odluke o kupcima bez provjere čovjeka"
}
EOF
-->

## CycloneDX ML-BOM

Create `/root/mlbom/aibom.cdx.json` (CycloneDX **1.6**, JSON) with:

- `bomFormat: "CycloneDX"`, `specVersion: "1.6"`, `serialNumber` (`urn:uuid:…`), `version: 1`,
- a component of type `machine-learning-model` (`bom-ref` e.g. `model-klasifikator`): `name`, `version`, `supplier.name`, `licenses` (Apache-2.0), `hashes` with the SHA-256 of the model file, and a `modelCard` with `modelParameters.task` and `modelParameters.architectureFamily` from `opis.json`, plus `considerations.technicalLimitations` (the limitations from the description),
- a component of type `data` for the dataset (`bom-ref` e.g. `dataset-tiketi`, `name`, `version`),
- a relationship in `dependencies`: the model depends on the dataset.

<!-- verify
f=/root/mlbom/aibom.cdx.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
jq -e '.bomFormat == "CycloneDX" and .specVersion == "1.6" and (.serialNumber | test("^urn:uuid:[0-9a-f-]{36}$")) and .version == 1' $f >/dev/null || { echo "the BOM header is not correct (bomFormat, specVersion 1.6, serialNumber urn:uuid, version 1)"; exit 1; }
h=$(sha256sum /root/mlbom/klasifikator-tiketa.safetensors | cut -d' ' -f1)
m='[.components[] | select(.type == "machine-learning-model")][0]'
jq -e "$m | .name == \"klasifikator-tiketa\" and .version == \"2.1.0\"" $f >/dev/null || { echo "model component: name/version"; exit 1; }
jq -e "$m | .supplier.name | test(\"Kurs Shop\")" $f >/dev/null || { echo "model component: supplier.name"; exit 1; }
jq -e "$m | [.licenses[]? | (.license.id // .license.name // .expression)] | index(\"Apache-2.0\")" $f >/dev/null || { echo "model component: license Apache-2.0"; exit 1; }
jq -e --arg h "$h" "$m | [.hashes[]? | select(.alg == \"SHA-256\") | .content] | index(\$h)" $f >/dev/null || { echo "model component: SHA-256 hash of the model file"; exit 1; }
jq -e "$m | .modelCard.modelParameters.task == \"text-classification\" and .modelCard.modelParameters.architectureFamily == \"logistic-regression\"" $f >/dev/null || { echo "modelCard.modelParameters: task and architectureFamily"; exit 1; }
jq -e "$m | [.modelCard.considerations.technicalLimitations[]?] | length > 0" $f >/dev/null || { echo "modelCard.considerations.technicalLimitations"; exit 1; }
d='[.components[] | select(.type == "data")][0]'
jq -e "$d | .name == \"tiketi-podrske-2025\" and .version == \"2025.12\"" $f >/dev/null || { echo "data component for the dataset (name, version)"; exit 1; }
mr=$(jq -r "$m | .[\"bom-ref\"]" $f); dr=$(jq -r "$d | .[\"bom-ref\"]" $f)
jq -e --arg m "$mr" --arg d "$dr" '[.dependencies[]? | select(.ref == $m) | .dependsOn[]?] | index($d)' $f >/dev/null || { echo "dependencies: the model ($mr) must depend on the dataset ($dr)"; exit 1; }
-->
<!-- hint
```json
{
  "type": "machine-learning-model",
  "bom-ref": "model-klasifikator",
  "name": "klasifikator-tiketa",
  "version": "2.1.0",
  "supplier": {"name": "Kurs Shop d.o.o., ML tim"},
  "licenses": [{"license": {"id": "Apache-2.0"}}],
  "hashes": [{"alg": "SHA-256", "content": "<sha256>"}],
  "modelCard": {
    "modelParameters": {"task": "text-classification", "architectureFamily": "logistic-regression"},
    "considerations": {"technicalLimitations": ["…"]}
  }
}
```
UUID: `python3 -c 'import uuid; print(uuid.uuid4())'`.
-->
<!-- solution
cd /root/mlbom
/opt/ai/bin/python - <<'EOF'
import hashlib, json, uuid
o = json.load(open("/root/mlbom/opis.json"))
h = hashlib.sha256(open("/root/mlbom/klasifikator-tiketa.safetensors", "rb").read()).hexdigest()
bom = {
  "bomFormat": "CycloneDX", "specVersion": "1.6", "serialNumber": f"urn:uuid:{uuid.uuid4()}", "version": 1,
  "components": [
    {"type": "machine-learning-model", "bom-ref": "model-klasifikator", "name": o["ime"], "version": o["verzija"],
     "supplier": {"name": o["dobavljac"]}, "licenses": [{"license": {"id": o["licenca"]}}],
     "hashes": [{"alg": "SHA-256", "content": h}],
     "modelCard": {"modelParameters": {"task": o["zadatak"], "architectureFamily": o["arhitektura"],
                                       "datasets": [{"ref": "dataset-tiketi"}]},
                   "considerations": {"technicalLimitations": [o["ograničenja"]]}}},
    {"type": "data", "bom-ref": "dataset-tiketi", "name": o["dataset"]["ime"], "version": o["dataset"]["verzija"],
     "description": o["dataset"]["opis"]}
  ],
  "dependencies": [{"ref": "model-klasifikator", "dependsOn": ["dataset-tiketi"]}]
}
json.dump(bom, open("/root/mlbom/aibom.cdx.json", "w"), indent=2, ensure_ascii=False)
EOF
-->
