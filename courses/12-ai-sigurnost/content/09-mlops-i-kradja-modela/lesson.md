## Šta ovaj modul pokriva

Domen 4, drugi dio:

- **4.2** Sigurnost ML pipelinea i MLOps platformi: od podataka do produkcijskog endpointa, gate-ovi za promociju modela i **AI-BOM** (CycloneDX ML-BOM).
- **4.3** Krađa modela, ekstrakcija i napadi na privatnost: kako se model ili podaci za treniranje mogu izvući, i koje kontrole to sprječavaju ili otežavaju.

Ciljevi modula. Nakon ovog modula trebalo bi da znaš da:

- nacrtaš ML pipeline sa granicama povjerenja i za svaku fazu navedeš glavni rizik i kontrolu,
- prepoznaš tipične slabosti MLOps platformi (notebookovi, experiment tracking, registry modela, serving),
- definišeš gate za promociju modela u produkciju (format, potpis, AI-BOM, evaluacija),
- napraviš i pročitaš AI-BOM u CycloneDX formatu,
- razlikuješ krađu težina, ekstrakciju preko API-ja, membership inference i inverziju modela, i za svaku izabereš odbranu.

Modul 8 je pokrio artefakt modela: sigurne formate (**safetensors** umjesto pickle), skeniranje i potpisivanje. Ovdje gledamo **sistem oko artefakta**: ko može da trenira, ko može da promoviše model, šta se dešava kad model stigne u serving i ko može da ga kopira ili oponaša.

## ML pipeline kao sistem sa granicama povjerenja

Tipičan MLOps tok, od sirovih podataka do API-ja:

```text
 [izvori podataka] ──► [feature store / data lake] ──► [trening job] ──► [experiment tracking]
        │                       │                          │                    │
   GRANICA 1:              GRANICA 2:                 GRANICA 3:           (metrike, artefakti)
   tuđi podaci             ko piše u skup             ko pokreće kod,           │
                                                      koje kredencijale ima     ▼
                                                                         [registry modela]
                                                                                │
                                                                    GRANICA 4: promocija
                                                                    (gate: format, potpis,
                                                                     AI-BOM, evaluacija)
                                                                                │
                                                                                ▼
 [korisnici / aplikacije] ◄── GRANICA 5: API ──── [serving: KServe, Triton, vLLM…]
                              (autentikacija,
                               kvote, logovanje)
```

Svaka strelica je mjesto gdje neko može da podmetne nešto (podatke, kod, artefakt) ili da odnese nešto (težine, podatke, odgovore). Za razliku od klasičnog CI/CD-a, ovdje su **podaci i težine modela** artefakti jednako važni kao kod: model koji je treniran na zatrovanim podacima prolazi sve testove koda.

### Rizici po fazi

| Faza | Rizik (ATLAS) | Kontrola | Gdje u arhitekturi |
|---|---|---|---|
| Izvori podataka | Trovanje podataka (**AML.T0020** Poison Training Data) | Porijeklo i verzionisanje skupova, provjera izvora (AML.M0025 Maintain AI Dataset Provenance) | Ulaz u data lake |
| Feature store | Neovlašćena izmjena skupa (AML.T0059 Erode Dataset Integrity) | Pisanje samo iz pipelinea, nepromjenljive verzije, hash skupa u metapodacima | Storage politike |
| Trening job | Kompromitovana zavisnost ili bazni model (**AML.T0010** AI Supply Chain Compromise) | Pinovane zavisnosti, SCA, safetensors, izolovani runneri | CI/trening klaster |
| Trening job | Previše široki kredencijali (krađa podataka i težina) | Workload identity, kratkotrajni tokeni, pristup samo potrebnim bucketima | IAM |
| Experiment tracking | Izložen UI bez autentikacije, artefakti čitljivi svima (AML.T0035 AI Artifact Collection) | SSO ispred UI-ja, privatna mreža, ACL po projektu | Mreža, reverse proxy |
| Registry modela | Podmetnut ili izmijenjen model (AML.T0018 Manipulate AI Model) | Potpis, promocija samo kroz gate, digest umjesto „latest“ | Registry, CI |
| Serving | Ekstrakcija modela i podataka preko API-ja (**AML.T0024**) | Autentikacija, kvote, minimalan izlaz, detekcija obrazaca upita | API gateway |
| Serving | Krađa težina sa diska ili iz memorije (AML.T0025 Exfiltration via Cyber Means) | Šifrovanje u mirovanju, kontrola egressa, hardening noda | Kubernetes / VM |

> **U praksi:** kad radiš procjenu ML platforme, nemoj početi od modela. Počni od pitanja „koje kredencijale ima trening job“ i „ko može da piše u registry“. U većini incidenata sa ML platformama problem nije egzotičan napad na model, nego klasična greška: dashboard bez autentikacije, javni bucket sa artefaktima ili token sa admin pravima u notebooku.

## Slabosti MLOps platformi

MLOps alati su nastali u istraživačkim timovima, gdje je prioritet bio brzina eksperimenta, a ne izolacija. Nekoliko obrazaca se ponavlja:

| Komponenta | Primjeri | Tipična slabost | Odbrana |
|---|---|---|---|
| Notebookovi | Jupyter, hostovani notebookovi | Tajne u ćelijama i izlazu, notebook ima ista prava kao produkcija | Tajne iz secret managera, odvojeni dev nalozi, skeniranje tajni u `.ipynb` |
| Experiment tracking | MLflow, Weights & Biases | UI i API bez autentikacije u internoj mreži; artefakti dostupni svakome ko zna URL | Autentikacija ispred servera, ACL po eksperimentu, privatni artifact store |
| Orkestracija | Kubeflow Pipelines, Airflow, Ray | Dashboard ili API koji dozvoljava pokretanje proizvoljnog koda; dijeljeni service account | Ne izlagati van mreže, RBAC, posebni service accounti po pipelineu |
| Registry modela | MLflow Model Registry, registry u cloudu, OCI registry | Svako ko trenira može i da promoviše u produkciju | Odvojena uloga za promociju, gate u CI-ju, potpis |
| Serving | KServe, Triton, vLLM, TorchServe | Admin/management API izložen zajedno sa inference API-jem; model se učitava sa nepouzdane putanje | Odvojeni portovi i mreže, učitavanje samo potpisanih modela iz registryja |

Za mnoge od ovih alata su objavljivane ranjivosti (npr. path traversal i čitanje proizvoljnih fajlova u serverima za experiment tracking, izvršavanje koda kroz neautentikovane API-je orkestratora). Zajednička pouka: **upravljački API ML platforme tretiraj kao upravljački API Kubernetesa**. Ko ga dohvati, pokreće kod sa pravima platforme.

Minimalna mrežna i identitetska slika:

```text
                    ┌──────────── privatna mreža ML platforme ─────────────┐
 developer ─SSO──►  │ notebook ──► tracking server ──► artifact store (S3)  │
                    │      │              ▲                                  │
                    │      └──► trening job (workload identity: čita       │
                    │            data/v3, piše runs/<id>, NE piše registry) │
                    │                                                        │
                    │ CI gate (jedini ima pravo: registry:promote) ──► registry │
                    └───────────────────────────────────┬──────────────────┘
                                                        │ pull po digestu
                    serving namespace (čita samo registry/prod, bez egressa)
                                                        │
                    API gateway (authn, kvote, logovanje) ◄── klijenti
```

> **U praksi:** razdvajanje „ko trenira“ od „ko promoviše“ je ML verzija principa četiri oka. Data scientist može da registruje kandidata, ali samo pipeline sa provjerama (ili čovjek sa posebnom ulogom) mijenja alias `production`. To je i jedini način da potpis znači nešto: potpis koji može staviti svako ko ima pristup notebooku ne dokazuje da je model prošao provjere.

## Gate za promociju modela

Gate je CI job koji stoji između registryja kandidata i produkcije. Ne vjeruje imenu ni tagu modela, već provjerava artefakt i njegove metapodatke.

Šta gate provjerava:

1. **Format**: samo formati bez izvršavanja koda pri učitavanju (safetensors, ONNX bez prilagođenih operatora koje ne poznaješ). Pickle, `.pt` sa pickle sadržajem i slično padaju.
2. **Integritet i porijeklo**: hash fajlova odgovara manifestu, potpis važi i potpisnik je očekivani identitet (vidi modul 8, OpenSSF model signing i `cosign`).
3. **AI-BOM postoji** i navodi bazni model, skupove podataka i licence.
4. **Evaluacija**: metrike kvaliteta i sigurnosni testovi (modul 10) iznad praga, uporedivi sa trenutnom produkcijskom verzijom.
5. **Odobrenje**: za visokorizične upotrebe i ljudsko odobrenje zabilježeno uz verziju.

Primjer gate joba (GitLab CI stil):

```yaml
promote-model:
  stage: promote
  image: kurs-ai-lab:1
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - /opt/ai/bin/python gate/check_format.py model/            # samo safetensors
    - cosign verify-blob --key cosign.pub
        --signature model/manifest.json.sig model/manifest.json
    - /opt/ai/bin/python gate/check_manifest.py model/          # hash svakog fajla
    - jq -e '.components[] | select(.type=="machine-learning-model")' aibom.cdx.json
    - /opt/ai/bin/python gate/check_eval.py eval/results.json --min-score 0.92
  environment:
    name: model-production      # zaštićeno okruženje: samo ovaj job ima registry:promote
```

Provjera formata i manifesta, odbrambeni minimum:

```python
import hashlib, json, pathlib, sys

ALLOWED = {".safetensors", ".json", ".txt"}        # težine + konfiguracija + tokenizer
model_dir = pathlib.Path(sys.argv[1])
manifest = json.loads((model_dir / "manifest.json").read_text())

errors = []
for f in model_dir.iterdir():
    if f.name in ("manifest.json", "manifest.json.sig"):
        continue
    if f.suffix not in ALLOWED:
        errors.append(f"nedozvoljen format: {f.name}")
        continue
    digest = hashlib.sha256(f.read_bytes()).hexdigest()
    if manifest.get(f.name) != digest:
        errors.append(f"hash se ne poklapa ili fajl nije u manifestu: {f.name}")
missing = set(manifest) - {f.name for f in model_dir.iterdir()}
errors += [f"fajl iz manifesta nedostaje: {m}" for m in sorted(missing)]

if errors:
    print("\n".join(errors)); sys.exit(1)
print("format i manifest OK")
```

Bitno je da manifest pokriva **sve** fajlove modela, a ne samo težine: izmijenjen `config.json` ili tokenizer mijenja ponašanje modela jednako kao izmijenjene težine. OpenSSF model signing iz istog razloga potpisuje manifest hasheva cijelog direktorija modela.

## AI-BOM: spisak sastojaka modela

**AI-BOM** (ili ML-BOM) proširuje ideju SBOM-a na AI sisteme. Pored softverskih paketa navodi:

- model (ime, verzija, hash, format, licenca, dobavljač),
- **bazni model** iz kojeg je nastao fine-tuning,
- skupove podataka za treniranje i evaluaciju (porijeklo, verzija, licenca, da li sadrže lične podatke),
- informacije iz **model card**: namjena, ograničenja, metrike, poznati rizici,
- softverske zavisnosti servinga (framework, runtime).

Zašto ti treba: kad dobavljač objavi da je bazni model ili skup podataka problematičan (zatrovan, licencno sporan, povučen), AI-BOM odgovara na pitanje „koji naši modeli to koriste“ bez ručne arheologije. MITRE ATLAS ga navodi kao mitigaciju **AML.M0023 AI Bill of Materials**.

### CycloneDX ML-BOM i SPDX 3.0

| | **CycloneDX** | **SPDX 3.0** |
|---|---|---|
| Podrška za AI | Od verzije 1.5: tip komponente `machine-learning-model` i `data`, polje `modelCard` | Profili **AI** i **Dataset** |
| Model card | `modelCard`: `modelParameters` (pristup, zadatak, arhitektura, skupovi, ulazi/izlazi), `quantitativeAnalysis`, `considerations` | Polja AI profila (npr. domen, autonomija, metrike, poznata ograničenja) |
| Format | JSON, XML, protobuf | JSON-LD |

Skraćen primjer CycloneDX AI-BOM-a:

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
          "useCases": ["Rutiranje internih tiketa podrške"],
          "technicalLimitations": ["Nije evaluiran za tekst na engleskom"]
        }
      }
    },
    {
      "type": "data",
      "bom-ref": "data-tiketi-2026q2",
      "name": "tiketi-2026q2",
      "data": [{ "type": "dataset", "classification": "internal, sadrži lične podatke (pseudonimizovano)" }]
    }
  ],
  "dependencies": [{ "ref": "model-tiketi-klasifikator", "dependsOn": ["data-tiketi-2026q2"] }]
}
```

Softverski dio (paketi u slici za serving) i dalje generišeš alatom kao što je `syft`, a AI dio (model, skupovi, model card) dopunjavaš iz metapodataka registryja i experiment trackinga. Upiti nad AI-BOM-om su obični `jq` filteri:

```bash
# Koji modeli zavise od određenog skupa podataka?
jq -r --arg ds data-tiketi-2026q2 \
  '.dependencies[] | select(.dependsOn | index($ds)) | .ref' aibom.cdx.json

# Modeli bez navedene licence (gate treba da padne)
jq -e '[.components[] | select(.type=="machine-learning-model" and (.licenses|not))] | length == 0' aibom.cdx.json
```

> **U praksi:** AI-BOM vrijedi onoliko koliko je automatizovan. Ako ga neko ručno popunjava jednom godišnje, laže već sljedeće sedmice. Generiši ga u istom pipelineu koji registruje model, iz istih metapodataka (run ID, hash skupa, bazni model), i čuvaj ga uz verziju modela u registryju, kao što čuvaš SBOM uz sliku.

## Krađa modela i napadi na privatnost

Model je vrijedan iz dva razloga: **intelektualna svojina** (trošak treniranja, podaci, know-how) i **podaci koje je zapamtio**. Napadi se dijele prema tome šta napadač ima i šta želi da dobije. NIST AI 100-2 (izdanje 2025) svrstava ih u **privacy attacks**; MITRE ATLAS ih vodi uglavnom pod taktikom Exfiltration (AML.TA0010).

| Kategorija | Šta napadač ima | Šta dobija | Oznaka |
|---|---|---|---|
| Krađa težina | Pristup infrastrukturi (registry, disk, bucket, insajder) | Kopiju modela | AML.T0025 Exfiltration via Cyber Means, AML.T0035 AI Artifact Collection |
| Ekstrakcija modela | Samo pristup inference API-ju (AML.T0040) | Približnu kopiju ponašanja (zamjenski model) | AML.T0024.002 Extract AI Model, AML.T0005 Create Proxy AI Model |
| Membership inference | API, ponekad uz izlazne vjerovatnoće | Zaključak da li je određeni zapis bio u skupu za treniranje | AML.T0024.000 Infer Training Data Membership |
| Inverzija modela | API | Rekonstrukciju osobina podataka za treniranje | AML.T0024.001 Invert AI Model |
| Ekstrakcija podataka iz LLM-a | Pristup modelu | Zapamćene dijelove teksta za treniranje (lični podaci, tajne) | AML.T0057 LLM Data Leakage; OWASP **LLM02** Sensitive Information Disclosure |
| Trošak i zloupotreba | API bez kvota | Masovni upiti, finansijska šteta | AML.T0034 Cost Harvesting; OWASP **LLM10** Unbounded Consumption |

OWASP Top 10 za LLM aplikacije 2025 više nema posebnu kategoriju „Model Theft“ (bila je u verziji 2023): ekstrakcija preko API-ja je dio **LLM10 Unbounded Consumption**, a curenje podataka iz modela dio **LLM02**.

Zajednički uslov za napade preko API-ja je **velik broj upita** i **bogat izlaz** (vjerovatnoće, logiti, embeddingi, dugi odgovori). Zato se većina odbrana svodi na tri poluge: ko smije da pita, koliko smije da pita i koliko informacija dobija u odgovoru.

### Odbrane za krađu težina

Ovo je klasična zaštita podataka, primijenjena na fajlove od nekoliko desetina gigabajta:

| Rizik | Kontrola | Gdje |
|---|---|---|
| Javni ili preširoko dijeljen bucket | Blokiran javni pristup, ACL samo za pipeline i serving, šifrovanje ključem iz KMS-a | Storage, IAM |
| Insajder kopira model | Least privilege, odvojena uloga za čitanje produkcijskih težina, logovanje svakog preuzimanja, DLP alarm na velike prenose | IAM, audit log |
| Kompromitovan serving pod | Read-only pristup samo potrebnoj verziji, bez egressa ka internetu, hardening noda | Kubernetes NetworkPolicy, PodSecurity |
| Model na edge uređaju ili kod klijenta | Pretpostavi da je javan; šifrovanje i obfuskacija samo usporavaju | Odluka o arhitekturi |
| Dokazivanje krađe | **Fingerprinting** ili watermark modela, evidencija hasheva verzija | Registry, pravni proces |

ATLAS mitigacije: **AML.M0005** Control Access to AI Models and Data at Rest, **AML.M0019** Control Access to AI Models and Data in Production, **AML.M0012** Encrypt Sensitive Information, **AML.M0001** Limit Model Artifact Release.

Watermark i fingerprint ne sprječavaju krađu. Služe da kasnije dokažeš porijeklo modela, pa ih planiraj kao forenzičku, ne preventivnu kontrolu.

### Odbrane za ekstrakciju preko API-ja

| Kontrola | Šta postiže | ATLAS |
|---|---|---|
| Autentikacija svakog klijenta, bez anonimnog pristupa | Upiti se vežu za identitet, kvote imaju smisla | AML.M0019 |
| Kvote po identitetu i po vremenu, budžet tokena | Ekstrakcija postaje skupa i spora | **AML.M0004** Restrict Number of AI Model Queries |
| Minimalan izlaz: klasa umjesto vjerovatnoća, zaokruživanje, top-1 umjesto top-k | Manje informacija po upitu | **AML.M0002** Passive AI Output Obfuscation |
| Detekcija obrazaca: mnogo sličnih ili sistematski raspoređenih upita, neuobičajen obim | Rano otkrivanje, blokiranje naloga | **AML.M0024** AI Telemetry Logging |
| Uslovi korištenja i ugovor | Pravni osnov za blokadu i postupak | (organizaciona) |

Primjer servisa koji vraća samo ono što aplikaciji treba i vodi evidenciju po klijentu:

```python
import time, logging
from collections import defaultdict, deque

log = logging.getLogger("inference-audit")
WINDOW_S, MAX_REQ = 3600, 500                 # po klijentu, po satu
history = defaultdict(deque)

def allow(client_id: str) -> bool:
    now = time.time()
    q = history[client_id]
    while q and now - q[0] > WINDOW_S:
        q.popleft()
    if len(q) >= MAX_REQ:
        log.warning("kvota prekoračena client=%s count=%d", client_id, len(q))
        return False
    q.append(now)
    return True

def public_response(probs: dict[str, float]) -> dict:
    label = max(probs, key=probs.get)
    # Aplikaciji treba odluka, ne cijela raspodjela vjerovatnoća
    return {"label": label, "confidence": "high" if probs[label] >= 0.8 else "low"}

def handle(client_id: str, text: str, model) -> dict:
    if not allow(client_id):
        return {"error": "rate_limited"}
    result = public_response(model.predict_proba(text))
    log.info("client=%s len=%d label=%s", client_id, len(text), result["label"])
    return result
```

U produkciji se kvote i logovanje drže u API gatewayu, a ne u memoriji jednog procesa; primjer pokazuje logiku, ne implementaciju.

> **U praksi:** prije nego što API počne da vraća vjerovatnoće, logite ili embeddinge, pitaj ko ih stvarno koristi. Često ih traži samo jedan interni tim za debug. Tada je rješenje poseban, interni endpoint za taj tim, a javni API vraća samo odluku. Ista logika važi za LLM: parametri kao što su log-vjerovatnoće tokena ne trebaju krajnjem korisniku.

### Odbrane za privatnost podataka za treniranje

Membership inference, inverzija i ekstrakcija zapamćenog teksta uspijevaju kad model **pretjerano pamti** pojedinačne zapise (overfitting, duplikati, rijetki zapisi). Odbrane počinju prije treniranja:

| Kontrola | Kada | Napomena |
|---|---|---|
| Minimizacija: ne treniraj na ličnim podacima i tajnama koje modelu ne trebaju | Priprema podataka | Najjača kontrola; vidi modul 7 |
| Uklanjanje duplikata i skeniranje tajni/PII u korpusu | Priprema podataka | Duplikati značajno povećavaju pamćenje |
| Regularizacija, rano zaustavljanje, praćenje razlike train/test | Trening | Manji overfitting, manji signal za membership inference |
| **Differential privacy** (npr. DP-SGD) | Trening | Formalna garancija, uz cijenu u tačnosti i resursima |
| Testovi pamćenja: **canary** zapisi i provjera da ih model ne reprodukuje | Evaluacija | Dio gate-a za promociju |
| Filter izlaza za PII i tajne | Serving | Druga linija odbrane, ne zamjena za minimizaciju |

```text
 podaci ──► [minimizacija, dedup, PII/tajne] ──► trening [DP, regularizacija] ──► eval [canary, MIA test]
                                                                                       │
 klijent ◄── [filter izlaza PII] ◄── serving [minimalan izlaz, kvote] ◄── gate ◄────────┘
```

> **U praksi:** fine-tuning na internim dokumentima je čest izvor curenja. Ako model treba da „zna“ sadržaj dokumenata sa različitim pravima pristupa, RAG sa kontrolom pristupa po dokumentu (modul 6) je obično bolji izbor od fine-tuninga: kontrola pristupa se provodi pri svakom upitu, a ne nestaje u težinama modela koje svako ko ima pristup endpointu može da ispituje.

## Kontrolna lista za ML platformu

- [ ] Upravljački UI-jevi i API-ji (tracking, orkestracija, serving admin) nisu dostupni van privatne mreže i traže autentikaciju.
- [ ] Svaki pipeline ima svoj identitet; trening job ne može da piše u produkcijski registry.
- [ ] Promocija u produkciju ide samo kroz gate: format, manifest i potpis, AI-BOM, evaluacija.
- [ ] Serving učitava model po digestu ili verziji iz registryja, ne sa proizvoljne putanje.
- [ ] Težine su šifrovane u mirovanju, preuzimanja se loguju, serving nema egress ka internetu.
- [ ] API ima autentikaciju, kvote po identitetu i vraća minimalan izlaz.
- [ ] Telemetrija upita se čuva i analizira na obrasce ekstrakcije (modul 10).
- [ ] Skupovi za treniranje su minimizovani, bez duplikata i skenirani na PII i tajne; postoji test pamćenja.

## Rezime

- ML pipeline ima više artefakata od klasičnog CI/CD-a: **podaci, kod, težine i metapodaci**. Svaki prelaz između faza je granica povjerenja.
- Najčešći problemi MLOps platformi su klasični: izloženi upravljački API-ji, preširoki kredencijali, javni artifact store. Upravljački API ML platforme tretiraj kao API Kubernetesa.
- Razdvoji ulogu koja trenira od uloge koja promoviše. Gate za promociju provjerava format (safetensors), manifest i potpis, AI-BOM i evaluaciju.
- **AI-BOM** (CycloneDX ML-BOM od 1.5, SPDX 3.0 AI i Dataset profili) navodi model, bazni model, skupove podataka, licence i model card; ATLAS ga vodi kao AML.M0023. Generiši ga automatski uz svaku verziju.
- Krađa težina (AML.T0025, AML.T0035) se sprječava zaštitom podataka: IAM, KMS, logovanje, kontrola egressa. Watermark i fingerprint služe za dokazivanje, ne za sprječavanje.
- Ekstrakcija i napadi na privatnost preko API-ja (**AML.T0024** .000/.001/.002) traže mnogo upita i bogat izlaz: autentikacija, kvote (AML.M0004), minimalan izlaz (AML.M0002) i telemetrija (AML.M0024).
- U OWASP Top 10 za LLM 2025 ekstrakcija spada pod **LLM10 Unbounded Consumption**, a curenje zapamćenih podataka pod **LLM02**.
- Privatnost podataka za treniranje se štiti najviše prije treniranja: minimizacija, dedup, skeniranje PII; zatim regularizacija ili differential privacy i test pamćenja u gate-u.
