# Lab 1: Bezbjedan format i potpisan model

Tim za data science je istrenirao mali model i sačuvao ga u `/root/model/model.pkl` (Python **pickle**). Pickle pri učitavanju može izvršiti proizvoljan kod, pa je učitavanje pickle modela iz nepouzdanog izvora isto što i pokretanje nepoznatog programa (OWASP LLM03: Supply Chain, ATLAS: kompromitovanje lanca snabdijevanja). Politika platforme zato kaže:

1. u produkciju idu samo modeli u formatu **safetensors** (samo tenzori, bez koda),
2. svaki model je **potpisan** u pipelineu, a servis provjerava potpis i hash prije učitavanja.

Ovaj `model.pkl` je napravio tvoj tim i siguran je za konverziju.

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

## Konverzija u safetensors

Učitaj `model.pkl` (vlastiti, povjerljiv fajl) i sačuvaj iste tenzore u `/root/model/model.safetensors` (`safetensors.numpy.save_file`), sa metapodacima `{"format": "np", "verzija": "1.0.0"}`. U `/root/model/model.safetensors.sha256` upiši SHA-256 fajla (samo heks vrijednost).

<!-- verify
cd /root/model
[ -s model.safetensors ] || { echo "nema model.safetensors"; exit 1; }
[ "$(tr -d ' \n' < model.safetensors.sha256 2>/dev/null)" = "$(sha256sum model.safetensors | cut -d' ' -f1)" ] || { echo "model.safetensors.sha256 nije tačan"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import pickle, sys, numpy as np
from safetensors import safe_open
from safetensors.numpy import load_file
orig = pickle.load(open("/root/model/model.pkl", "rb"))
new = load_file("/root/model/model.safetensors")
if set(orig) != set(new): sys.exit("imena tenzora se ne slažu")
for k in orig:
    if not np.array_equal(orig[k], new[k]) or orig[k].dtype != new[k].dtype: sys.exit(f"tenzor {k} se razlikuje")
with safe_open("/root/model/model.safetensors", "np") as f:
    md = f.metadata() or {}
if md.get("verzija") != "1.0.0": sys.exit("metapodaci trebaju verzija: 1.0.0")
EOF
-->
<!-- hint
```python
import pickle
from safetensors.numpy import save_file
model = pickle.load(open("model.pkl", "rb"))   # samo zato što je fajl naš
save_file(model, "model.safetensors", metadata={"format": "np", "verzija": "1.0.0"})
```
Safetensors ima JSON zaglavlje (imena, tipovi, oblici, offseti) i sirove bajtove tenzora; parser ne izvršava ništa.
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

## Potpis

Potpiši `model.safetensors` ključem `/root/model/keys/cosign.key` (lozinka `kurs`) i sačuvaj potpis u bundle `/root/model/model.safetensors.bundle`. Lab nema transparency log:

```bash
COSIGN_PASSWORD=kurs cosign sign-blob --key keys/cosign.key --use-signing-config=false --tlog-upload=false \
  --bundle model.safetensors.bundle -y model.safetensors
cosign verify-blob --key keys/cosign.pub --bundle model.safetensors.bundle --insecure-ignore-tlog=true model.safetensors
```

<!-- verify
cd /root/model
[ -s model.safetensors.bundle ] || { echo "nema model.safetensors.bundle"; exit 1; }
cosign verify-blob --key keys/cosign.pub --bundle model.safetensors.bundle --insecure-ignore-tlog=true model.safetensors >/dev/null 2>&1 || { echo "potpis se ne može provjeriti ključem keys/cosign.pub"; exit 1; }
-->
<!-- hint
U pipelineu bi potpis bio keyless (identitet CI joba), a uz njega i atestacija porijekla: iz kog dataseta i commita je model nastao.
-->
<!-- solution
cd /root/model
COSIGN_PASSWORD=kurs cosign sign-blob --key keys/cosign.key --use-signing-config=false --tlog-upload=false --bundle model.safetensors.bundle -y model.safetensors >/dev/null 2>&1
-->

## Učitavanje samo provjerenog modela

Napiši `/root/model/ucitaj.py` sa funkcijom `ucitaj(put)` koja vraća rječnik tenzora, a podiže izuzetak (`ValueError` ili `RuntimeError`) ako:

- fajl nije `.safetensors` (pickle i ostali formati se odbijaju bez otvaranja),
- SHA-256 ne odgovara fajlu `<put>.sha256`,
- potpis iz `<put>.bundle` ne prolazi `cosign verify-blob` sa `/root/model/keys/cosign.pub`.

<!-- verify
cd /root/model
[ -f ucitaj.py ] || { echo "nema ucitaj.py"; exit 1; }
t=$(mktemp -d); cp model.safetensors model.safetensors.sha256 model.safetensors.bundle $t/
/opt/ai/bin/python - "$t" <<'EOF' || { rm -rf $t; exit 1; }
import importlib.util, sys, shutil, os, numpy as np
t = sys.argv[1]
spec = importlib.util.spec_from_file_location("u", "/root/model/ucitaj.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]; spec.loader.exec_module(m)
d = m.ucitaj("/root/model/model.safetensors")
if "sloj2.bias" not in d: sys.exit("ispravan model se ne učitava")
def mora_pasti(put, opis):
    try:
        m.ucitaj(put)
    except (ValueError, RuntimeError):
        return
    except Exception as e:
        sys.exit(f"{opis}: očekivan ValueError/RuntimeError, dobijeno {type(e).__name__}")
    sys.exit(f"{opis}: model je učitan, a nije smio biti")
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
    raise RuntimeError("potpis modela nije validan")
```
Provjeru radi servis koji učitava model, ne samo pipeline: model u registru može neko zamijeniti nakon builda.
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
