## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 5 (**Supply Chain Security**, 20% ispita):

- **5.2** Understand your supply chain: odakle dolazi sve što radi u klasteru, **SBOM**, CI/CD, repozitoriji artefakata.
- **5.3** Secure your supply chain: **dozvoljeni registriji**, potpisivanje i provjera artefakata.

Tipični zadaci na ispitu:

- „Skeniraj Trivyjem slike svih Podova u namespaceu `prod`. Obriši Podove čije slike imaju CRITICAL ranjivosti.“
- „Napravi SBOM za sliku `nginx:1.27` u formatu SPDX JSON i sačuvaj ga u `/opt/kurs/sbom.json`.“
- „Uključi **ImagePolicyWebhook** sa zadatom konfiguracijom; ako backend nije dostupan, Podovi se moraju odbiti.“
- „Napravi **ValidatingAdmissionPolicy** koja dozvoljava samo slike iz `registry.internal:5000/`.“
- „Potpiši sliku cosignom i provjeri potpis javnim ključem.“

Minimalne slike (5.1) i statička analiza (5.4) su u modulu 09. Ovdje gradimo na tome: ne samo „da li je slika mala“, nego „znamo li šta je u njoj, odakle dolazi i ko je garantuje“.

## Lanac snabdijevanja: od koda do Poda

**Software supply chain** je sve što se dešava između commita i procesa koji radi u Podu:

| Faza | Šta se dešava | Primjer napada | Odbrana |
|---|---|---|---|
| Izvorni kod | Git repozitorij, zavisnosti (npm, pip, Go moduli) | Zlonamjeran paket, typosquatting, preuzet maintainer | Code review, pinovane verzije, lock fajlovi |
| Build (CI/CD) | Pipeline gradi sliku | Kompromitovan build server ili CI skripta | Izolovan build, kratkotrajni tokeni, **provenance** |
| Registry | Slika se čuva i distribuira | Podmetnuta slika pod istim tagom | Privatni registry, **digest**, potpisi |
| Deploy | Klaster povlači sliku i pokreće je | Slika iz nepoznatog registrija | **Admission** kontrola, provjera potpisa |
| Runtime | Kontejner radi | Exploit poznatog CVE-a | Skeniranje, runtime detekcija (modul 12) |

Tri napada koje vrijedi znati ukratko:

- **SolarWinds (2020):** napadači su kompromitovali build sistem i ubacili backdoor u legitimno, potpisano ažuriranje Orion softvera. Potpis je bio ispravan, ali build nije bio pouzdan.
- **Codecov (2021):** izmijenjena je skripta Bash Uploader koju su CI pipelinei preuzimali i izvršavali. Skripta je slala environment varijable (tokene, ključeve) napadaču. Pouka: CI ima tajne, a `curl | bash` u pipelineu je povjerenje bez provjere.
- **xz utils (2024, CVE-2024-3094):** napadač je godinama gradio povjerenje kao maintainer i ubacio backdoor u `liblzma` u release tarballovima. Pouka: i zavisnost duboko u lancu može biti meta.

### SLSA ukratko

**SLSA** (Supply-chain Levels for Software Artifacts) je okvir sa nivoima zrelosti build procesa. U verziji 1.0 „Build track“ ima nivoe:

| Nivo | Zahtjev (pojednostavljeno) |
|---|---|
| L0 | Nema garancija |
| L1 | Postoji **provenance**: zapis kako je artefakt napravljen |
| L2 | Build na hostovanoj platformi, provenance je potpisan |
| L3 | Ojačana build platforma: buildovi izolovani, tajne za potpis nedostupne korisničkim koracima |

Na ispitu se SLSA ne konfiguriše. Bitno je razumjeti ideju: potpis kaže **ko** je objavio artefakt, provenance kaže **kako** je nastao.

## SBOM: spisak sastojaka

**SBOM** (Software Bill of Materials) je mašinski čitljiv spisak svih komponenti u artefaktu: paketi, verzije, licence, hash vrijednosti. Kada izađe novi CVE (npr. u OpenSSL-u), uz SBOM odmah znaš koje slike su pogođene, bez ponovnog raspakivanja svake slike.

| | **SPDX** | **CycloneDX** |
|---|---|---|
| Ko ga održava | Linux Foundation (ISO/IEC 5962) | OWASP |
| Porijeklo | Licence i usklađenost | Sigurnost i analiza rizika |
| Formati | JSON, tag-value, YAML, RDF | JSON, XML |
| Posebno | Detaljni podaci o licencama | Podrška za VEX (da li je ranjivost zaista iskoristiva) |
| Trivy `--format` | `spdx-json` (ili `spdx` za tag-value) | `cyclonedx` |

### SBOM sa syftom

```bash
# CycloneDX JSON na stdout
syft nginx:1.27 -o cyclonedx-json > /opt/kurs/nginx.cdx.json

# SPDX JSON direktno u fajl
syft nginx:1.27 -o spdx-json=/opt/kurs/nginx.spdx.json

# tabela u terminalu, za brz pregled
syft nginx:1.27
```

### SBOM sa Trivyjem

```bash
trivy image --format cyclonedx --output /opt/kurs/nginx.cdx.json nginx:1.27
trivy image --format spdx-json  --output /opt/kurs/nginx.spdx.json nginx:1.27

# provjera da je fajl zaista SBOM
jq '.bomFormat, .specVersion' /opt/kurs/nginx.cdx.json      # "CycloneDX"
jq '.spdxVersion' /opt/kurs/nginx.spdx.json                  # "SPDX-2.3"
```

### Skeniranje postojećeg SBOM-a

Kada već imaš SBOM (npr. dobio si ga od dobavljača), ne treba ti slika:

```bash
trivy sbom /opt/kurs/nginx.cdx.json
trivy sbom --severity CRITICAL /opt/kurs/nginx.spdx.json
```

> **Na ispitu:** pažljivo pročitaj traženi format. `--format cyclonedx` i `--format spdx-json` su različite stvari, a `--format json` je Trivyjev vlastiti izvještaj o ranjivostima, **ne** SBOM. Ako zadatak kaže „sačuvaj u fajl“, koristi `--output` (ili `-o`), pa provjeri sadržaj sa `head` ili `jq`.

## Skeniranje slika Trivyjem

**Trivy** skenira OS pakete i zavisnosti aplikacija u slici i upoređuje ih sa bazom ranjivosti. U labu je baza lokalna, a slike dolaze iz lokalnog mirrora.

```bash
trivy image nginx:1.19                                   # svi nalazi
trivy image --severity HIGH,CRITICAL nginx:1.19          # samo ozbiljni
trivy image --severity CRITICAL --ignore-unfixed nginx:1.19   # samo oni za koje postoji zakrpa
trivy image -q --severity CRITICAL nginx:1.19            # bez progress poruka
trivy image --exit-code 1 --severity CRITICAL nginx:1.19 # izlazni kod 1 ako ima nalaza (CI gate)
```

| Flag | Značenje |
|---|---|
| `--severity` | Lista nivoa razdvojena zarezom: `UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL` |
| `--ignore-unfixed` | Sakrij ranjivosti za koje još nema ispravljene verzije paketa |
| `--exit-code` | Izlazni kod kada ima nalaza; korisno u CI pipelineu |
| `--format` | `table` (podrazumijevano), `json`, `cyclonedx`, `spdx-json`, `sarif` … |
| `-o`, `--output` | Upiši rezultat u fajl |

Izlaz u tabeli izgleda otprilike ovako:

```text
nginx:1.19 (debian 10.10)
Total: 38 (HIGH: 27, CRITICAL: 11)

│ Library  │ Vulnerability  │ Severity │ Status │ Installed Version │ Fixed Version │ Title
│ libssl1.1│ CVE-2021-3711  │ CRITICAL │ fixed  │ 1.1.1d-0+deb10u6  │ 1.1.1d-0+deb10u7 │ openssl: SM2 ...
```

Linija `Total:` je ono što ti treba za brzu odluku. Kolona `Fixed Version` kaže da li postoji zakrpa.

Trivy ima i druge mete: `trivy fs .` (direktorij sa kodom), `trivy config` (IaC i manifesti) i `trivy k8s` (resursi u klasteru). Na ispitu je najčešći `trivy image`.

### Zadatak: pronađi ranjive slike u namespaceu i ukloni Podove

```bash
# 1. koje slike koriste Podovi u namespaceu prod
kubectl -n prod get pods -o custom-columns='POD:.metadata.name,IMAGES:.spec.containers[*].image'

# ili samo jedinstven spisak slika (uključujući initContainers)
kubectl -n prod get pods -o jsonpath='{range .items[*]}{.spec.initContainers[*].image} {.spec.containers[*].image}{"\n"}{end}' | tr ' ' '\n' | sort -u

# 2. skeniraj svaku sliku, samo CRITICAL
for img in nginx:1.19 redis:7.2 httpd:2.4-alpine; do
  echo "== $img"; trivy image -q --severity CRITICAL "$img" | grep Total
done

# 3. obriši Podove čije slike imaju CRITICAL nalaze
kubectl -n prod delete pod web-1 web-2
```

> **Na ispitu:** pročitaj da li treba obrisati **Pod** ili **Deployment**. Ako je Pod u Deploymentu, brisanjem Poda ReplicaSet odmah pravi novi sa istom ranjivom slikom. Tada obriši ili skaliraj Deployment na 0 (`kubectl scale deploy web --replicas=0`), kako zadatak traži.

## Tag ili digest

Tag (`nginx:1.27`) je pokretna oznaka: vlasnik registrija ga može preusmjeriti na drugu sliku. **Digest** (`nginx@sha256:…`) je hash sadržaja manifesta i ne može se promijeniti.

```bash
# digest slike koju Pod zaista koristi
kubectl -n prod get pod web-1 -o jsonpath='{.status.containerStatuses[*].imageID}'

# na čvoru
crictl images --digests | grep nginx
```

```yaml
containers:
- name: web
  image: registry.internal:5000/nginx@sha256:6af79ae5de407283dcea8b00d5c37ace95441fd58a8b1d2aa1ed93f5511bb18c
```

Uz digest je `imagePullPolicy` manje bitan: ista referenca uvijek znači isti sadržaj. Potpisi (cosign) se takođe vežu za digest, ne za tag.

## Dozvoljeni registriji

Cilj: Pod sa slikom iz nepoznatog registrija ne smije ni nastati. To se radi u **admission** fazi API servera. Imaš tri glavne opcije:

| Mehanizam | Gdje radi | Konfiguracija | Kada |
|---|---|---|---|
| **ValidatingAdmissionPolicy** | U API serveru, CEL izrazi | Kubernetes objekti (`kubectl apply`) | Ugrađeno, GA od 1.30; najbrže na ispitu |
| **ImagePolicyWebhook** | Admission plugin koji pita eksterni servis | Fajlovi na controlplaneu + flagovi kube-apiservera | Kada zadatak daje gotov backend |
| **Kyverno / OPA Gatekeeper** | Eksterni admission webhook | CRD-ovi (ClusterPolicy, ConstraintTemplate) | U produkciji; na ispitu samo ako je već instaliran |

### ValidatingAdmissionPolicy sa CEL-om

**ValidatingAdmissionPolicy** (`admissionregistration.k8s.io/v1`) opisuje pravilo u jeziku **CEL**. Sama politika ne radi ništa dok je ne veže **ValidatingAdmissionPolicyBinding**.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: allowed-registries
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["pods"]
  validations:
  - expression: >-
      object.spec.containers.all(c, c.image.startsWith('registry.internal:5000/')) &&
      (!has(object.spec.initContainers) ||
       object.spec.initContainers.all(c, c.image.startsWith('registry.internal:5000/')))
    message: "Dozvoljene su samo slike iz registry.internal:5000/"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: allowed-registries-prod
spec:
  policyName: allowed-registries
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: prod
```

Važni detalji:

- `object` je objekat koji se kreira; `oldObject` je stara verzija kod UPDATE.
- `has(...)` provjerava da li polje postoji. Bez toga izraz pada na Podu bez `initContainers`, a sa `failurePolicy: Fail` takav Pod bude odbijen.
- `validationActions`: `Deny` (odbij), `Warn` (upozorenje klijentu), `Audit` (zapis u audit log). `Deny` i `Warn` se ne kombinuju.
- Politika na `pods` ne blokira Deployment, nego Podove koje ReplicaSet pokušava da napravi. Deployment se kreira, a greška se vidi u `kubectl describe rs`. Ako želiš da odbiješ i Deployment, dodaj `deployments` u `resourceRules` i izraz za `object.spec.template.spec.containers`.
- Kod `startsWith` piši registry sa kosom crtom na kraju. Bez nje bi `registry.internal:5000.evil.io/x` prošao.

Provjera:

```bash
kubectl apply -f vap.yaml
kubectl -n prod run test --image=docker.io/library/nginx:1.27
# Error from server (Forbidden): pods "test" is forbidden: ValidatingAdmissionPolicy
# 'allowed-registries' with binding 'allowed-registries-prod' denied request: Dozvoljene su samo slike ...
kubectl -n prod run ok --image=registry.internal:5000/nginx:1.27   # prolazi
```

> **Na ispitu:** primjer ValidatingAdmissionPolicy nađeš u dokumentaciji pod „Validating Admission Policy“ (kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/). Najčešća greška je zaboravljen Binding: politika postoji, ali ništa ne blokira.

### ImagePolicyWebhook

**ImagePolicyWebhook** je admission plugin u kube-apiserveru. Za svaki Pod šalje objekat **ImageReview** (`imagepolicy.k8s.io/v1alpha1`) eksternom servisu, sa spiskom slika iz `containers`, `initContainers` i `ephemeralContainers`. Servis odgovara `allowed: true/false`. Na ispitu je backend obično već pripremljen; tvoj posao je da plugin ispravno uključiš.

Potrebna su tri fajla. Prvi je **AdmissionConfiguration**:

```yaml
# /etc/kubernetes/admission/admission-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
- name: ImagePolicyWebhook
  configuration:
    imagePolicy:
      kubeConfigFile: /etc/kubernetes/admission/imagepolicy.kubeconfig
      allowTTL: 50          # sekunde keširanja odobrenja
      denyTTL: 50           # sekunde keširanja odbijanja
      retryBackoff: 500     # milisekunde između ponovnih pokušaja
      defaultAllow: false   # backend nedostupan -> ODBIJ Pod
```

Umjesto `configuration` može stajati `path: imagepolicy-config.yaml` sa posebnim fajlom.

Drugi je **kubeconfig** za backend. `cluster` je servis koji odlučuje (mora `https`), `user` su kredencijali API servera prema njemu:

```yaml
# /etc/kubernetes/admission/imagepolicy.kubeconfig
apiVersion: v1
kind: Config
clusters:
- name: image-checker
  cluster:
    certificate-authority: /etc/kubernetes/admission/ca.crt
    server: https://image-checker.internal:8443/check
users:
- name: kube-apiserver
  user:
    client-certificate: /etc/kubernetes/admission/apiserver-client.crt
    client-key: /etc/kubernetes/admission/apiserver-client.key
contexts:
- name: default
  context:
    cluster: image-checker
    user: kube-apiserver
current-context: default
```

Treći je izmjena static Pod manifesta `/etc/kubernetes/manifests/kube-apiserver.yaml`:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --enable-admission-plugins=NodeRestriction,ImagePolicyWebhook
    - --admission-control-config-file=/etc/kubernetes/admission/admission-config.yaml
    # ... ostali flagovi ostaju
    volumeMounts:
    - name: admission
      mountPath: /etc/kubernetes/admission
      readOnly: true
  volumes:
  - name: admission
    hostPath:
      path: /etc/kubernetes/admission
      type: DirectoryOrCreate
```

**`defaultAllow`** je ključno sigurnosno pitanje: šta raditi kad backend ne odgovara.

| `defaultAllow` | Backend nedostupan | Sigurnosni stav |
|---|---|---|
| `true` | Pod se **prihvata** | Fail-open: dostupnost ispred sigurnosti |
| `false` | Pod se **odbija** | Fail-closed: zadatak obično traži ovo |

> **Na ispitu:** API server radi u kontejneru i vidi samo ono što je montirano. Sve putanje iz AdmissionConfiguration i iz kubeconfiga (CA, sertifikati) moraju biti unutar montiranog direktorija. Ako `kubectl` prestane da odgovara nakon izmjene, gledaj `crictl ps -a | grep kube-apiserver`, `crictl logs <id>` i `journalctl -u kubelet`.

### Kyverno i OPA Gatekeeper ukratko

Oba rade kao **validating/mutating admission webhook** i dodaju vlastite CRD-ove.

| | Kyverno | OPA Gatekeeper |
|---|---|---|
| Jezik politika | YAML (pattern), CEL | Rego |
| Glavni objekti | `ClusterPolicy`, `Policy` (i novi tipovi zasnovani na CEL-u) | `ConstraintTemplate` + Constraint (npr. `K8sAllowedRepos`) |
| Provjera potpisa | Ugrađena (`verifyImages`) | Preko eksternih provajdera |

Gatekeeper primjer za dozvoljene registrije, kad je `ConstraintTemplate` iz biblioteke već instaliran:

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: prod-repos
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
    namespaces: ["prod"]
  parameters:
    repos: ["registry.internal:5000/"]
```

## Potpisivanje slika: cosign

**cosign** (projekat **Sigstore**) potpisuje slike u OCI registriju. Potpis se čuva u istom registriju, pored slike, i vezan je za njen **digest**.

### Potpis ključem

```bash
# par ključeva: cosign.key (šifrovan lozinkom) i cosign.pub
cosign generate-key-pair

# potpiši po digestu (tag se razriješi u digest, ali eksplicitan digest je sigurniji)
cosign sign --key cosign.key registry.internal:5000/app@sha256:3b1f...e9

# provjeri potpis javnim ključem
cosign verify --key cosign.pub registry.internal:5000/app:1.0
```

`cosign verify` vraća izlazni kod 0 i JSON sa podacima o potpisu kada je potpis ispravan, a grešku `no matching signatures` kada nije. Ako neko podmetne drugu sliku pod istim tagom, digest se promijeni i stari potpis više ne važi.

### Keyless potpisivanje

Bez dugotrajnih ključeva: `cosign sign <slika>` (bez `--key`) traži OIDC prijavu (npr. GitHub Actions identitet). **Fulcio** izdaje kratkotrajni sertifikat za taj identitet, a potpis se upisuje u javni transparency log **Rekor**. Provjera tada traži identitet umjesto ključa:

```bash
cosign verify \
  --certificate-identity=https://github.com/firma/app/.github/workflows/build.yml@refs/heads/main \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/firma/app:1.0
```

| | Sa ključem | Keyless |
|---|---|---|
| Šta se čuva | Privatni ključ (tajna) | Ništa dugotrajno |
| Provjera | `--key cosign.pub` | `--certificate-identity` + `--certificate-oidc-issuer` |
| Tipično | Air-gapped okruženja, lab, ispit | CI/CD u oblaku |

### Provjera potpisa na ulazu u klaster

Potpis koristi samo ako ga neko provjerava prije pokretanja. Kubernetes to nema ugrađeno; koristi se admission kontroler:

- **Kyverno** `ClusterPolicy` sa pravilom `verifyImages`: za slike koje odgovaraju `imageReferences` (npr. `registry.internal:5000/*`) traži potpis koji se provjerava zadatim javnim ključem (`attestors` → `keys.publicKeys`). Kyverno usput može zamijeniti tag digestom u Podu.
- **Sigstore policy-controller**: objekat `ClusterImagePolicy` sa ključem ili keyless identitetom; važi za namespaceove sa oznakom `policy.sigstore.dev/include=true`.

Skica Kyverno pravila:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-signed-images
spec:
  rules:
  - name: check-signature
    match:
      any:
      - resources:
          kinds: ["Pod"]
    verifyImages:
    - imageReferences: ["registry.internal:5000/*"]
      failureAction: Enforce      # podrazumijevano je samo Audit
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              ...
              -----END PUBLIC KEY-----
```

> **Na ispitu:** kod cosign zadataka pazi koji ključ ide gdje: `sign` uvijek sa **privatnim** (`cosign.key`, traži lozinku ili `COSIGN_PASSWORD`), `verify` sa **javnim** (`cosign.pub`). Ako treba sačuvati izlaz provjere, preusmjeri ga: `cosign verify --key cosign.pub IMG > /opt/kurs/verify.json`.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| ValidatingAdmissionPolicy ne blokira ništa | Postoji li Binding; poklapa li se `policyName`; `matchResources` bira pravi namespace; `kubectl get validatingadmissionpolicybinding` |
| Svi Podovi odbijeni sa greškom izraza | Izraz pristupa polju koje ne postoji (`initContainers`) bez `has()`; `failurePolicy: Fail` |
| Deployment kreiran, ali nema Podova | Politika odbija Podove: `kubectl describe rs <ime>` pokazuje `FailedCreate` |
| API server ne starta nakon ImagePolicyWebhook | Pogrešna putanja ili nemontiran direktorij, YAML greška u AdmissionConfiguration; `crictl logs`, `/var/log/pods/kube-system_kube-apiserver-*` |
| Svi Podovi odbijeni nakon ImagePolicyWebhook | Backend nedostupan i `defaultAllow: false`; provjeri `server` URL i sertifikate u kubeconfigu |
| `cosign verify` vraća `no matching signatures` | Pogrešan javni ključ, slika promijenjena nakon potpisa (drugi digest), potpis u drugom registriju |
| `trivy sbom` ne nalazi ranjivosti | SBOM napravljen bez paketa (pogrešan format ili prazna slika); provjeri sadržaj sa `jq` |

## Rezime

- Lanac snabdijevanja ide od izvornog koda preko CI/CD i registrija do klastera; svaka faza je meta (SolarWinds: build, Codecov: CI skripta, xz: zavisnost).
- SBOM (SPDX ili CycloneDX) je spisak komponenti: `syft IMG -o spdx-json`, `trivy image --format cyclonedx|spdx-json -o fajl`, a `trivy sbom fajl` skenira postojeći SBOM.
- `trivy image --severity HIGH,CRITICAL --ignore-unfixed IMG`; slike Podova nađeš sa `-o custom-columns` ili `jsonpath`, a kod Deploymenta ukloni izvor, ne samo Pod.
- Digest (`@sha256:`) je nepromjenljiv, tag nije; potpisi se vežu za digest.
- ValidatingAdmissionPolicy (CEL) + ValidatingAdmissionPolicyBinding je najbrži način za dozvoljene registrije; bez Bindinga ne radi ništa.
- ImagePolicyWebhook traži `--enable-admission-plugins`, `--admission-control-config-file`, kubeconfig backenda i montirane volumene; `defaultAllow: false` znači fail-closed.
- cosign: `generate-key-pair`, `sign --key cosign.key`, `verify --key cosign.pub`; provjeru na ulazu u klaster rade Kyverno `verifyImages` ili sigstore policy-controller.
