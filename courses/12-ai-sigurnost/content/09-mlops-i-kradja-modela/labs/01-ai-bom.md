# Lab 1: AI-BOM za model

Kao što SBOM opisuje softver, **AI-BOM** opisuje model: šta je, ko ga je napravio, na kojim podacima je treniran, pod kojom licencom i sa kojim hashom. CycloneDX (od verzije 1.5) ima tip komponente `machine-learning-model` i **model card**, i tip `data` za skupove podataka. AI-BOM se traži sve češće (inventar za EU AI Act, procjena dobavljača, odgovor na incident: „koji servisi koriste model X?“).

U `/root/mlbom/` je model `klasifikator-tiketa.safetensors` i podaci o njemu u `opis.json`.

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

Napravi `/root/mlbom/aibom.cdx.json` (CycloneDX **1.6**, JSON) sa:

- `bomFormat: "CycloneDX"`, `specVersion: "1.6"`, `serialNumber` (`urn:uuid:…`), `version: 1`,
- komponentom tipa `machine-learning-model` (`bom-ref` npr. `model-klasifikator`): `name`, `version`, `supplier.name`, `licenses` (Apache-2.0), `hashes` sa SHA-256 fajla modela, i `modelCard` sa `modelParameters.task` i `modelParameters.architectureFamily` iz `opis.json` te `considerations.technicalLimitations` (ograničenja iz opisa),
- komponentom tipa `data` za dataset (`bom-ref` npr. `dataset-tiketi`, `name`, `version`),
- vezom u `dependencies`: model zavisi od dataseta.

<!-- verify
f=/root/mlbom/aibom.cdx.json
jq -e . $f >/dev/null 2>&1 || { echo "$f ne postoji ili nije JSON"; exit 1; }
jq -e '.bomFormat == "CycloneDX" and .specVersion == "1.6" and (.serialNumber | test("^urn:uuid:[0-9a-f-]{36}$")) and .version == 1' $f >/dev/null || { echo "zaglavlje BOM-a nije tačno (bomFormat, specVersion 1.6, serialNumber urn:uuid, version 1)"; exit 1; }
h=$(sha256sum /root/mlbom/klasifikator-tiketa.safetensors | cut -d' ' -f1)
m='[.components[] | select(.type == "machine-learning-model")][0]'
jq -e "$m | .name == \"klasifikator-tiketa\" and .version == \"2.1.0\"" $f >/dev/null || { echo "model komponenta: name/version"; exit 1; }
jq -e "$m | .supplier.name | test(\"Kurs Shop\")" $f >/dev/null || { echo "model komponenta: supplier.name"; exit 1; }
jq -e "$m | [.licenses[]? | (.license.id // .license.name // .expression)] | index(\"Apache-2.0\")" $f >/dev/null || { echo "model komponenta: licenca Apache-2.0"; exit 1; }
jq -e --arg h "$h" "$m | [.hashes[]? | select(.alg == \"SHA-256\") | .content] | index(\$h)" $f >/dev/null || { echo "model komponenta: SHA-256 hash fajla modela"; exit 1; }
jq -e "$m | .modelCard.modelParameters.task == \"text-classification\" and .modelCard.modelParameters.architectureFamily == \"logistic-regression\"" $f >/dev/null || { echo "modelCard.modelParameters: task i architectureFamily"; exit 1; }
jq -e "$m | [.modelCard.considerations.technicalLimitations[]?] | length > 0" $f >/dev/null || { echo "modelCard.considerations.technicalLimitations"; exit 1; }
d='[.components[] | select(.type == "data")][0]'
jq -e "$d | .name == \"tiketi-podrske-2025\" and .version == \"2025.12\"" $f >/dev/null || { echo "data komponenta za dataset (name, version)"; exit 1; }
mr=$(jq -r "$m | .[\"bom-ref\"]" $f); dr=$(jq -r "$d | .[\"bom-ref\"]" $f)
jq -e --arg m "$mr" --arg d "$dr" '[.dependencies[]? | select(.ref == $m) | .dependsOn[]?] | index($d)' $f >/dev/null || { echo "dependencies: model ($mr) treba zavisiti od dataseta ($dr)"; exit 1; }
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
