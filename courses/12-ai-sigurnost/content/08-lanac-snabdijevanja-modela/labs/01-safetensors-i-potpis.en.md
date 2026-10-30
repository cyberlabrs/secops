# Lab 1: A safe format and a signed model

The data science team trained a small model and saved it in `/root/model/model.pkl` (Python **pickle**). Pickle can execute arbitrary code at load time, so loading a pickle model from an untrusted source is the same as running an unknown program (OWASP LLM03: Supply Chain, ATLAS: supply chain compromise). That is why the platform policy says:

1. only models in **safetensors** format (tensors only, no code) go to production,
2. every model is **signed** in the pipeline, and the service verifies the signature and hash before loading.

This `model.pkl` was made by your team and is safe to convert.

```bash
cd /root/model && ls -la
/opt/ai/bin/python -c "import safetensors, numpy; print(safetensors.__version__, numpy.__version__)"
```

<!-- setup
set -e
mkdir -p /root/model/keys
cd /root/model
/opt/ai/bin/python - <<'EOF'
import pickle, numpy as np
rng = np.random.default_rng(7)
model = {"sloj1.tezine": rng.standard_normal((16, 8)).astype(np.float32),
         "sloj1.bias": np.zeros(8, dtype=np.float32),
         "sloj2.tezine": rng.standard_normal((8, 3)).astype(np.float32),
         "sloj2.bias": np.array([0.1, -0.2, 0.05], dtype=np.float32)}
pickle.dump(model, open("model.pkl", "wb"))
EOF
cd keys && COSIGN_PASSWORD=kurs cosign generate-key-pair >/dev/null 2>&1
-->

## Converting to safetensors

Load `model.pkl` (your own, trusted file) and save the same tensors to `/root/model/model.safetensors` (`safetensors.numpy.save_file`), with the metadata `{"format": "np", "verzija": "1.0.0"}` (`verzija` = version; keep the key exactly as written). Write the file's SHA-256 (just the hex value) to `/root/model/model.safetensors.sha256`.

<!-- verify
cd /root/model
[ -s model.safetensors ] || { echo "model.safetensors is missing"; exit 1; }
[ "$(tr -d ' \n' < model.safetensors.sha256 2>/dev/null)" = "$(sha256sum model.safetensors | cut -d' ' -f1)" ] || { echo "model.safetensors.sha256 is not correct"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import pickle, sys, numpy as np
from safetensors import safe_open
from safetensors.numpy import load_file
orig = pickle.load(open("/root/model/model.pkl", "rb"))
new = load_file("/root/model/model.safetensors")
if set(orig) != set(new): sys.exit("the tensor names don't match")
for k in orig:
    if not np.array_equal(orig[k], new[k]) or orig[k].dtype != new[k].dtype: sys.exit(f"tensor {k} differs")
with safe_open("/root/model/model.safetensors", "np") as f:
    md = f.metadata() or {}
if md.get("verzija") != "1.0.0": sys.exit("the metadata needs verzija: 1.0.0")
EOF
-->
<!-- hint
```python
import pickle
from safetensors.numpy import save_file
model = pickle.load(open("model.pkl", "rb"))   # only because the file is ours
save_file(model, "model.safetensors", metadata={"format": "np", "verzija": "1.0.0"})
```
Safetensors has a JSON header (names, types, shapes, offsets) and raw tensor bytes; the parser executes nothing.
-->
<!-- solution
cd /root/model
/opt/ai/bin/python - <<'EOF'
import pickle
from safetensors.numpy import save_file
model = pickle.load(open("/root/model/model.pkl", "rb"))
save_file(model, "/root/model/model.safetensors", metadata={"format": "np", "verzija": "1.0.0"})
EOF
sha256sum model.safetensors | cut -d' ' -f1 > model.safetensors.sha256
-->

## Signing

Sign `model.safetensors` with the key `/root/model/keys/cosign.key` (password `kurs`) and save the signature in the bundle `/root/model/model.safetensors.bundle`. The lab has no transparency log:

```bash
COSIGN_PASSWORD=kurs cosign sign-blob --key keys/cosign.key --use-signing-config=false --tlog-upload=false \
  --bundle model.safetensors.bundle -y model.safetensors
cosign verify-blob --key keys/cosign.pub --bundle model.safetensors.bundle --insecure-ignore-tlog=true model.safetensors
```

<!-- verify
cd /root/model
[ -s model.safetensors.bundle ] || { echo "model.safetensors.bundle is missing"; exit 1; }
cosign verify-blob --key keys/cosign.pub --bundle model.safetensors.bundle --insecure-ignore-tlog=true model.safetensors >/dev/null 2>&1 || { echo "the signature can't be verified with keys/cosign.pub"; exit 1; }
-->
<!-- hint
In a pipeline the signature would be keyless (the CI job's identity), accompanied by a provenance attestation: which dataset and commit the model was built from.
-->
<!-- solution
cd /root/model
COSIGN_PASSWORD=kurs cosign sign-blob --key keys/cosign.key --use-signing-config=false --tlog-upload=false --bundle model.safetensors.bundle -y model.safetensors >/dev/null 2>&1
-->

## Loading only a verified model

Write `/root/model/ucitaj.py` with a function `ucitaj(put)` (load(path)) that returns a dictionary of tensors, and raises an exception (`ValueError` or `RuntimeError`) if:

- the file is not `.safetensors` (pickle and other formats are rejected without being opened),
- the SHA-256 doesn't match the file `<path>.sha256`,
- the signature from `<path>.bundle` doesn't pass `cosign verify-blob` with `/root/model/keys/cosign.pub`.

<!-- verify
cd /root/model
[ -f ucitaj.py ] || { echo "ucitaj.py is missing"; exit 1; }
t=$(mktemp -d); cp model.safetensors model.safetensors.sha256 model.safetensors.bundle $t/
/opt/ai/bin/python - "$t" <<'EOF' || { rm -rf $t; exit 1; }
import importlib.util, sys, shutil, os, numpy as np
t = sys.argv[1]
spec = importlib.util.spec_from_file_location("u", "/root/model/ucitaj.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]; spec.loader.exec_module(m)
d = m.ucitaj("/root/model/model.safetensors")
if "sloj2.bias" not in d: sys.exit("a valid model doesn't load")
def mora_pasti(put, opis):
    try:
        m.ucitaj(put)
    except (ValueError, RuntimeError):
        return
    except Exception as e:
        sys.exit(f"{opis}: expected ValueError/RuntimeError, got {type(e).__name__}")
    sys.exit(f"{opis}: the model was loaded, but it must not be")
mora_pasti("/root/model/model.pkl", "pickle fajl")
p = os.path.join(t, "model.safetensors")
b = bytearray(open(p, "rb").read()); b[-1] ^= 0x01; open(p, "wb").write(b)
open(p + ".sha256", "w").write(__import__("hashlib").sha256(b).hexdigest())
mora_pasti(p, "izmijenjen model sa ažuriranim hashom (potpis ne odgovara)")
shutil.copy("/root/model/model.safetensors", p)
open(p + ".sha256", "w").write("0" * 64)
mora_pasti(p, "pogrešan hash")
EOF
rm -rf $t
-->
<!-- hint
```python
import hashlib, subprocess
r = subprocess.run(["cosign", "verify-blob", "--key", "/root/model/keys/cosign.pub",
                    "--bundle", put + ".bundle", "--insecure-ignore-tlog=true", put], capture_output=True)
if r.returncode != 0:
    raise RuntimeError("model signature is not valid")
```
The check is done by the service that loads the model, not just the pipeline: someone can swap the model in the registry after the build.
-->
<!-- solution
cat > /root/model/ucitaj.py <<'EOF'
import hashlib, subprocess
from safetensors.numpy import load_file

PUB = "/root/model/keys/cosign.pub"

def ucitaj(put):
    if not put.endswith(".safetensors"):
        raise ValueError("dozvoljen je samo safetensors format")
    h = hashlib.sha256(open(put, "rb").read()).hexdigest()
    if open(put + ".sha256").read().strip() != h:
        raise ValueError("hash modela ne odgovara")
    r = subprocess.run(["cosign", "verify-blob", "--key", PUB, "--bundle", put + ".bundle",
                        "--insecure-ignore-tlog=true", put], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("potpis modela nije validan")
    return load_file(put)
EOF
-->
