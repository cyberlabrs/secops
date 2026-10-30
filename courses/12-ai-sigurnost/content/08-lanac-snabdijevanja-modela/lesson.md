## Šta ovaj modul pokriva

Domen 4, ML pipeline i lanac snabdijevanja modela:

- **4.1** Lanac snabdijevanja modela: sigurni formati serijalizacije, skeniranje modela, porijeklo i potpisivanje.

Poslije ovog modula treba da znaš:

- da nabrojiš komponente lanca snabdijevanja modela i mapiraš rizike na OWASP **LLM03:2025 Supply Chain** i MITRE ATLAS,
- da objasniš zašto je učitavanje pickle fajla izvršavanje koda i koji formati i podešavanja to sprječavaju,
- da bezbjedno pređeš sa pickle formata na **safetensors**,
- da koristiš skenere modela i razumiješ šta ne mogu otkriti,
- da pinuješ, potpišeš i provjeriš model prije deploya (OpenSSF Model Signing, cosign) i opišeš ga u AI-BOM-u.

## Šta je sve lanac snabdijevanja modela

Model koji preuzmeš sa javnog huba nije jedan fajl. To je skup artefakata, i svaki dolazi od nekoga:

| Komponenta | Primjer | Rizik |
|---|---|---|
| Težine | `model.safetensors`, `pytorch_model.bin`, `model.gguf` | Izvršavanje koda pri učitavanju (pickle), backdoor u ponašanju |
| Konfiguracija i tokenizer | `config.json`, `tokenizer.json` | Izmjena ponašanja, upućivanje na prilagođeni kod |
| Prilagođeni kod modela | Python fajlovi uz model (`trust_remote_code`) | Proizvoljan kod pri učitavanju |
| Adapteri | LoRA adapter iz trećeg izvora | Isti rizici kao težine, manji i lakše se podmeću |
| Biblioteke | PyTorch, transformers, runtime za serving | Ranjivosti, zlonamjerni paketi (klasičan SCA) |
| Podaci | Skupovi za fine-tuning i evaluaciju | Trovanje (modul 07) |
| Infrastruktura | Hub, interni registry, bucket | Podmetanje verzije, tag koji se pomjera |

Mapiranje na okvire:

- OWASP **LLM03:2025 Supply Chain** (ranjive komponente, zlonamjerni ili neprovjereni modeli, adapteri, slabi uslovi licenci i porijekla),
- OWASP **LLM04:2025 Data and Model Poisoning** za backdoore ugrađene u težine,
- MITRE ATLAS **AML.T0010 AI Supply Chain Compromise** sa podtehnikama za AI softver (**.001**), podatke (**.002**) i model (**.003**), **AML.T0058 Publish Poisoned Models**, **AML.T0011.000 Unsafe AI Artifacts** (korisnik učita nebezbjedan artefakt) i **AML.T0018.002 Embed Malware** (zlonamjeran kod u artefaktu modela).

```text
 javni hub / dobavljač                    tvoja organizacija
 ┌──────────────┐   ┌──────────── MODEL INTAKE (izolovano) ────────────┐   ┌──────────────┐
 │ model repo   │──►│ pin (commit) → skeniranje → konverzija u         │──►│ interni      │
 │ (težine,     │   │ safetensors → evaluacija → potpis → AI-BOM       │   │ model        │
 │  kod, config)│   └──────────────────────────────────────────────────┘   │ registry     │
 └──────────────┘                                                          └──────┬───────┘
                                                                                  │
                                             serving: provjera potpisa i formata ◄┘
                                             (učitava samo safetensors, bez remote code)
```

> **U praksi:** tretiraj model sa huba kao binarni fajl sa interneta, a ne kao „podatke“. Niko u tvom timu ne bi pokrenuo `.exe` iz nepoznatog repoa na build serveru sa produkcionim tajnama. Učitavanje pickle modela sa istog mjesta je isti čin.

## Zašto je pickle opasan

Python modul **pickle** ne čuva samo podatke nego i uputstva kako da se objekat ponovo napravi. Ta uputstva mogu pozvati bilo koju funkciju dostupnu u okruženju. Zvanična Python dokumentacija zato upozorava: nikad ne učitavaj pickle podatke iz nepouzdanog ili neprovjerenog izvora. Učitavanje (`pickle.load`, i sve što ga koristi ispod) je **izvršavanje koda** sa pravima procesa: pristup fajlovima, mreži, tajnama u okruženju.

Problem nije samo u fajlovima sa nastavkom `.pkl`:

| Format / API | Koristi pickle? | Napomena |
|---|---|---|
| PyTorch `.pt`, `.pth`, `.bin` (`torch.save`) | Da, unutar ZIP arhive | Od PyTorch 2.6 `torch.load` podrazumijevano koristi `weights_only=True` (ograničen unpickler) |
| `joblib`, `pickle` (scikit-learn modeli) | Da | Nema bezbjednog podrazumijevanog načina učitavanja |
| NumPy `.npy`/`.npz` | Samo za objektne nizove | `np.load` podrazumijevano ima `allow_pickle=False`; ne mijenjaj to za nepouzdane fajlove |
| Keras `.keras` | Ne (ZIP + JSON + težine) | Lambda slojevi sadrže kod; Keras 3 ima `safe_mode=True` koji ga blokira, ne isključuj ga |
| Stari Keras HDF5 `.h5` | Ne, ali može nositi serijalizovan kod slojeva | Preferiraj noviji format |
| **safetensors** | Ne | Samo tenzori i metadata, bez koda |
| GGUF | Ne | Format za lokalne LLM runtimeove; rizik je u parseru runtimea, drži ga ažurnim |
| ONNX | Ne (protobuf) | Graf operacija; prilagođeni operatori i eksterni fajlovi traže pažnju |

Podrazumijevana sigurna podešavanja u popularnim bibliotekama:

```python
import torch, numpy as np
from transformers import AutoModel

state = torch.load("model.pt", weights_only=True)      # eksplicitno, i na starijim verzijama
arr = np.load("features.npy", allow_pickle=False)      # podrazumijevano, ali budi eksplicitan
model = AutoModel.from_pretrained(
    "/models/interni/klasifikator",                    # lokalni, provjeren direktorij
    trust_remote_code=False,                           # podrazumijevano; nikad True za nepoznat repo
    use_safetensors=True,                              # odbij učitavanje ako nema safetensors
)
```

`weights_only=True` značajno smanjuje rizik, ali je i dalje unpickler sa allowlistom, pa je cilj **format bez koda**, a ne samo bolje podešen pickle.

## safetensors

**safetensors** je format koji je razvio Hugging Face za bezbjedno čuvanje tenzora. Struktura je namjerno jednostavna:

```text
┌──────────────┬──────────────────────────────────────┬──────────────────────────┐
│ 8 bajtova:   │ JSON zaglavlje:                       │ sirovi bajtovi tenzora    │
│ dužina       │ {"tezina1": {"dtype":"F32",           │ (jedan kontinuiran blok)  │
│ zaglavlja    │   "shape":[768,768],                  │                          │
│ (u64, LE)    │   "data_offsets":[0,2359296]}, ...,   │                          │
│              │  "__metadata__": {...}}               │                          │
└──────────────┴──────────────────────────────────────┴──────────────────────────┘
```

Šta to daje:

- **nema izvršavanja koda** pri učitavanju: parser čita JSON i kopira bajtove,
- zaglavlje se može pregledati bez učitavanja tenzora (veličine, tipovi, metadata),
- brzo učitavanje i mapiranje u memoriju (zero-copy),
- format je prošao nezavisan sigurnosni audit (Trail of Bits, 2023) i danas je podrazumijevan za većinu modela na Hugging Face Hubu.

```python
import json, struct
import numpy as np
from safetensors.numpy import save_file, load_file

# čuvanje i učitavanje
save_file({"w": np.zeros((4, 4), dtype=np.float32)}, "model.safetensors",
          metadata={"source": "interni-trening", "version": "1.2.0"})
tensors = load_file("model.safetensors")

# pregled zaglavlja bez učitavanja tenzora (npr. u provjeri prije deploya)
with open("model.safetensors", "rb") as f:
    n = struct.unpack("<Q", f.read(8))[0]
    if n > 100 * 1024 * 1024:
        raise ValueError("sumnjivo veliko zaglavlje")
    header = json.loads(f.read(n))
print(header["__metadata__"], [k for k in header if k != "__metadata__"])
```

safetensors rješava problem **izvršavanja koda pri učitavanju**. Ne rješava problem **sadržaja**: težine u safetensors formatu i dalje mogu imati backdoor ili biti pogrešan model. Zato format ide zajedno sa porijeklom, potpisom i evaluacijom.

## Prelazak sa pickle na safetensors

Konverzija zahtijeva da se pickle fajl jednom učita, a to je upravo rizična operacija. Redoslijed odluka:

1. **Postoji li safetensors verzija kod izvora?** Većina modela na hubovima je već objavljena u safetensors formatu. Preuzmi nju i ne konvertuj ništa.
2. Ako ne postoji, a model je iz **tvog** treninga: promijeni pipeline za treniranje da čuva safetensors i ponovo izvezi.
3. Ako moraš konvertovati tuđi pickle: radi to u **izolovanom, efemernom okruženju** bez mreže i bez tajni, poslije statičkog skeniranja, sa `weights_only=True`, i provjeri rezultat.

```python
# convert.py - pokreće se u kontejneru: --network none, read-only ulaz, bez kredencijala
import sys, torch, numpy as np
from safetensors.numpy import save_file, load_file

src, dst = sys.argv[1], sys.argv[2]
state = torch.load(src, map_location="cpu", weights_only=True)   # ograničen unpickler
arrays = {k: v.detach().cpu().numpy() for k, v in state.items()}
save_file(arrays, dst, metadata={"converted_from": src})

back = load_file(dst)
assert set(back) == set(arrays)
assert all(np.array_equal(back[k], arrays[k]) for k in arrays)    # isti tenzori
```

Poslije konverzije:

- izračunaj hash novog fajla i upiši ga u registry,
- potpiši safetensors fajl (sljedeća sekcija),
- povuci pickle verziju iz upotrebe; serving je više ne smije moći učitati,
- dodaj u CI provjeru koja odbija `.pt`, `.pth`, `.bin`, `.pkl`, `.joblib` u direktoriju modela za deploy.

```yaml
# model-policy.yaml - pravila za serving
allowed_formats: [safetensors, gguf, onnx]
denied_extensions: [.pkl, .pickle, .pt, .pth, .bin, .joblib, .h5]
require_signature: true
trusted_signers:
  - identity: ml-release@firma.rs
trust_remote_code: false
source: internal-registry-only     # nema direktnog preuzimanja sa javnog huba u produkciji
```

> **U praksi:** najbrža pobjeda je popis: pronađi sve fajlove modela u repoima, bucketima i slikama (pretraga po nastavcima i po „magic“ bajtovima) i označi koji su pickle. Većina timova otkrije stare `.pkl` scikit-learn modele koje niko nije dirao godinama, a koji se učitavaju u produkciji pri svakom startu servisa.

## Skeniranje modela

Skeneri modela statički pregledaju artefakte bez učitavanja: za pickle analiziraju niz instrukcija i traže uvoze funkcija koje mogu izvršiti kod (npr. iz modula za procese ili mrežu). Primjeri alata otvorenog koda su **ModelScan** (Protect AI), **picklescan** i **fickling** (Trail of Bits), a Hugging Face Hub i sam skenira objavljene fajlove i prikazuje upozorenja.

Isti princip možeš razumjeti kroz standardnu biblioteku. `pickletools.genops` čita instrukcije **bez izvršavanja** i omogućava provjeru uvoza po allowlisti:

```python
import pickletools, sys

ALLOWED = {("collections", "OrderedDict"), ("torch._utils", "_rebuild_tensor_v2"),
           ("torch", "FloatStorage"), ("numpy.core.multiarray", "_reconstruct")}

def imported_globals(data: bytes):
    """Statički izvlači (modul, ime) iz GLOBAL instrukcija; ništa se ne izvršava."""
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
    sys.exit(f"ODBIJENO: uvozi van allowliste: {bad}")
```

Ovo je pojednostavljen primjer za razumijevanje; u pipelineu koristi održavan skener. Ograničenja skeniranja treba znati:

| Ograničenje | Posljedica | Kontrola |
|---|---|---|
| Blocklist pristup (lista „opasnih“ funkcija) se može zaobići | Skener kaže „čisto“, a fajl nije | Allowlist pristup ili, bolje, format bez koda |
| Skener ne vidi ponašanje modela | Backdoor u težinama prolazi (ATLAS **AML.T0018.000**) | Porijeklo, evaluacija, testovi ponašanja |
| Novi formati i kontejneri (ZIP, ugniježđeni fajlovi) | Skener ne raspakuje sve | Ažuran skener, odbijanje nepoznatih formata |
| Skeniranje samo pri preuzimanju | Kasnija zamjena fajla u bucketu | Potpis i provjera pri deployu |

Skeniranje je **signal na ulazu**, a ne dokaz bezbjednosti. Glavne kontrole su format bez koda, porijeklo i potpis.

> **U praksi:** skener postavi kao obavezan korak intakea i kao CI provjeru nad direktorijem modela, sa pravilom „nalaz blokira, izuzetak traži odobrenje“. Upozorenja koja prikazuje hub korisna su developeru pri izboru modela, ali nisu tvoja kontrola: ne znaš koju verziju skenera koriste ni kada je fajl skeniran.

### Ranjivosti ML biblioteka i runtimea

Lanac snabdijevanja nije samo model. Biblioteke za učitavanje i serving (PyTorch, transformers, runtimeovi za GGUF i ONNX, serving serveri) imaju ranjivosti kao i svaki softver, uključujući greške u parserima formata. Zato:

- biblioteke idu kroz isti SCA proces kao ostale zavisnosti (DevSecOps kurs, modul 06),
- verzije su pinovane u lock fajlu, a slika za serving se skenira i potpisuje,
- serving proces radi kao non-root, bez nepotrebnih capabilities i sa ograničenim izlazom na mrežu, da bi greška u parseru imala što manji domet.

## Porijeklo: pinovanje i interni registry

- **Pinuj tačnu reviziju.** Na hubovima zasnovanim na gitu referenciraj commit hash, ne granu `main` ni tag koji se može pomjeriti:

  ```python
  AutoModel.from_pretrained("org/model", revision="a1b2c3d4e5f6...", use_safetensors=True)
  ```

- **Interni registry ili mirror.** Produkcija preuzima samo iz internog registryja (npr. MLflow Model Registry, OCI registry, verzionisan bucket), u koji model ulazi kroz intake proces. Direktan izlaz ka javnim hubovima iz produkcije je blokiran.
- **Provjeri izdavača.** Organizacija na hubu, istorija, model card, licenca. Imena koja liče na poznate organizacije su poznat obrazac podmetanja (typosquatting).
- **Zabilježi porijeklo**: odakle, koja revizija, ko je odobrio, hash svakog fajla, rezultat skeniranja i evaluacije.

## Potpisivanje modela

Potpis odgovara na dva pitanja: da li je ovo **tačno onaj** model (integritet) i **ko** ga je objavio (identitet). Hash u registryju odgovara samo na prvo, i samo dok je registry netaknut.

### OpenSSF Model Signing

Projekat **OpenSSF Model Signing** (biblioteka i CLI `model_signing`, verzija 1.0 objavljena u aprilu 2025) potpisuje model kao cjelinu: izračuna hash svakog fajla u direktoriju modela, napravi **manifest** i potpiše manifest. Potpis je u formatu **Sigstore bundle**, pa radi sa postojećim Sigstore alatima. Podržava keyless potpis preko Sigstore-a (OIDC identitet, transparentni log) i potpis ključem ili sertifikatom za okruženja bez interneta.

```bash
pip install model-signing

# keyless (Sigstore): identitet iz OIDC prijave, zapis u transparentnom logu
model_signing sign ./klasifikator --signature model.sig
model_signing verify ./klasifikator --signature model.sig \
  --identity "ml-release@firma.rs" --identity-provider "https://accounts.google.com"

# ključem (npr. interno, bez interneta)
model_signing sign key ./klasifikator --private-key release.key --signature model.sig
model_signing verify key ./klasifikator --signature model.sig --public-key release.pub
```

Prednost manifesta: izmjena, dodavanje ili brisanje bilo kog fajla u direktoriju (uključujući `config.json` ili tokenizer) ruši provjeru, a potpis je odvojen od modela, pa model ne treba prepakovati.

### cosign za pojedinačne artefakte

Ako model distribuiraš kao jedan fajl ili kao OCI artefakt, možeš koristiti **cosign** kao i za slike (DevSecOps kurs, modul 10). U offline okruženju, poput laba, koristi se par ključeva bez transparentnog loga. Primjer je za cosign 3.x (u labu), koji potpis čuva u Sigstore bundleu:

```bash
cosign generate-key-pair                                   # cosign.key, cosign.pub
cosign sign-blob --key cosign.key --use-signing-config=false --tlog-upload=false \
  --bundle model.safetensors.bundle -y model.safetensors
cosign verify-blob --key cosign.pub --insecure-ignore-tlog=true \
  --bundle model.safetensors.bundle model.safetensors
```

U cosignu 2.x nema `--use-signing-config`, a potpis se obično čuva kao poseban fajl (`--output-signature`).

### Provjera pri deployu

Potpis koji niko ne provjerava ne štiti ništa. Provjera ide **neposredno prije učitavanja**, u istom okruženju u kojem se model koristi:

```text
 registry ──► init kontejner / loader:
                1. preuzmi model + potpis (po digestu, ne po imenu)
                2. verify (očekivani identitet ili javni ključ iz konfiguracije)
                3. provjeri format (samo safetensors/gguf/onnx) i politiku
                4. tek onda pokreni serving ── neuspjeh = pod ne starta
```

> **U praksi:** javni ključ ili očekivani identitet potpisnika drži u konfiguraciji koju kontroliše platformski tim (npr. ConfigMap pod GitOps reviewom), a ne uz sam model. Ako je provjera „potpis koji dolazi u istom bucketu, provjeren ključem iz istog bucketa“, napadač koji zamijeni model zamijeni i ključ.

## AI-BOM: šta je u modelu

**AI-BOM** (ili **ML-BOM**) je SBOM proširen za AI: koje modele, podatke i biblioteke sistem koristi i odakle dolaze. **CycloneDX** od verzije 1.5 ima tip komponente `machine-learning-model` sa objektom `modelCard` (parametri modela, kvantitativna analiza, razmatranja o upotrebi i ograničenjima) i tip `data` za skupove podataka. **SPDX 3.0** ima profile AI i Dataset za istu namjenu.

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
        "considerations": { "useCases": ["rutiranje tiketa podrške"] }
      }
    },
    { "type": "data", "name": "tiketi-klasifikacija", "version": "2026.09.1" }
  ]
}
```

Biblioteke iz okruženja (PyTorch, transformers) dodaješ istim SBOM alatima kao za bilo koji softver (npr. `syft`), a komponente modela i podataka iz registryja i data card-a. Generisanje AI-BOM-a kao dijela MLOps pipelinea je tema modula 09.

## Intake proces za modele treće strane

| Korak | Pitanje | Dokaz |
|---|---|---|
| Zahtjev | Ko treba model i za šta? | Tiket sa vlasnikom i namjenom |
| Izvor i licenca | Ko je izdavač, da li licenca dozvoljava upotrebu? | Model card, licenca, provjera organizacije |
| Pin | Koja tačno revizija? | Commit hash, hash svakog fajla |
| Format | Postoji li safetensors? Treba li remote code? | Lista fajlova; odbijanje bez opravdanja |
| Skeniranje | Ima li sumnjivih artefakata? | Izvještaj skenera |
| Evaluacija | Radi li model očekivano, i na sigurnosnim testovima? | Rezultati na internom skupu (modul 10) |
| Potpis i registry | Da li je interna kopija potpisana? | Potpis, zapis u registryju, AI-BOM |
| Pregled | Kada se model ponovo procjenjuje? | Datum, okidači (nova verzija, CVE u runtimeu) |

## Rezime

- Lanac snabdijevanja modela čine težine, konfiguracija, tokenizer, prilagođeni kod, adapteri, biblioteke, podaci i registry; OWASP **LLM03:2025**, ATLAS **AML.T0010** (.001 softver, .002 podaci, .003 model), **AML.T0058**, **AML.T0011.000**.
- Učitavanje **pickle** fajla je izvršavanje koda. To uključuje PyTorch `.pt/.pth/.bin` i `joblib`. Podešavanja: `weights_only=True`, `allow_pickle=False`, `safe_mode=True`, `trust_remote_code=False`.
- **safetensors** nema kod: zaglavlje u JSON-u i sirovi tenzori. Rješava izvršavanje koda pri učitavanju, ne i backdoor u sadržaju.
- Prelazak: prvo traži safetensors kod izvora; ako moraš konvertovati, radi to izolovano, bez mreže i tajni, provjeri tenzore, potpiši rezultat i zabrani pickle u servingu.
- Skeneri (ModelScan, picklescan, fickling) su signal na ulazu; blocklist se može zaobići, a ponašanje modela ne vide.
- Porijeklo: pinuj commit hash, preuzimaj iz internog registryja, provjeri izdavača i licencu.
- **OpenSSF Model Signing** potpisuje manifest hash vrijednosti svih fajlova (Sigstore bundle, keyless ili ključem); **cosign** za pojedinačne artefakte. Provjera ide neposredno prije učitavanja, sa ključem ili identitetom koji ne dolazi uz model.
- **AI-BOM**: CycloneDX `machine-learning-model` sa `modelCard` i `data` komponentama (od 1.5), SPDX 3.0 AI i Dataset profili.
