## Šta ovaj modul pokriva

Cilj **4.4**: **policy as code** sa OPA/Rego i Conftestom, Kyverno politike i Kyverno CLI.

Gdje je kontrola u pipelineu: na dva mjesta, sa istim pravilima.

1. **U pipelineu** (Conftest, `kyverno apply`): nad manifestima, Helm izlazom ili Terraform planom, u MR-u, prije nego što išta stigne do klastera.
2. **U klasteru** (Kyverno ili OPA Gatekeeper kao **admission controller**): zadnja linija odbrane za sve što zaobiđe pipeline (`kubectl apply` sa laptopa, operator koji pravi resurse).

Koju prijetnju sprječava: konfiguraciju koja je tehnički validna, ali krši pravila organizacije. `k8s/deployment.yaml` u repou je savršen primjer: privilegovan kontejner, `hostPath: /` (cijeli disk čvora) i slika `:latest`. Kubernetes će to rado pokrenuti. Politika ne smije.

Razlika u odnosu na module 07 i 08: tamo koristiš **tuđa** pravila (ugrađene provjere Checkova i Trivyja). Ovdje pišeš **svoja** pravila, verzionišeš ih, testiraš i provodiš isto u CI-ju i u klasteru.

## Rego u OPA 1.x

**OPA** (Open Policy Agent) je opšti engine za politike; jezik je **Rego**. Od verzije 1.0 podrazumijevana je **Rego v1** sintaksa:

- svako tijelo pravila mora imati `if`,
- pravila koja grade skup (multi-value) moraju imati `contains`,
- ključne riječi `in`, `every`, `contains`, `if` rade bez ikakvog importa; `import rego.v1` više nije potreban (smije ostati, radi kompatibilnosti sa starijim alatima),
- `import future.keywords...` je suvišan.

Stara (v0) sintaksa u OPA 1.x pada već pri parsiranju:

```rego
# v0: OPA 1.x ovo odbija (nedostaju `contains` i `if`)
deny[msg] {
  input.kind == "Deployment"
  msg := "..."
}
```

```rego
# v1
deny contains msg if {
	input.kind == "Deployment"
	msg := "..."
}
```

```text
rego_parse_error: `if` keyword is required before rule body
rego_parse_error: `contains` keyword is required for partial set rules
```

Za migraciju starih politika postoji `--v0-compatible` (OPA komande prihvataju staru sintaksu), `opa fmt --v0-v1` (prepisuje v0 politiku u oblik koji radi u obje verzije) i, u Conftestu, `--rego-version v0`. Conftest od verzije 0.60 podrazumijevano koristi v1.

Najčešće konstrukcije:

```rego
package main

# iteracija: `some ... in`
deny contains msg if {
	some c in input.spec.template.spec.containers
	c.securityContext.privileged == true
	msg := sprintf("Kontejner %s je privilegovan", [c.name])
}

# univerzalni kvantifikator: `every`
all_pinned if {
	every c in input.spec.template.spec.containers {
		contains(c.image, "@sha256:")
	}
}
```

Ključna osobina Rega: ako bilo koji izraz u tijelu nije tačan **ili polje ne postoji**, pravilo jednostavno ne važi (nema greške). Zato `c.securityContext.privileged == true` ne puca za kontejner bez `securityContext`; samo ne proizvodi poruku. Isto važi obrnuto, i tu se pravi greška: provjera „mora postojati“ piše se sa `not`, npr. `not c.securityContext.runAsNonRoot`.

### OPA CLI

```bash
opa fmt -w policy/                       # formatiranje (kao gofmt)
opa check --strict policy/               # parsiranje i strože provjere
opa test policy/ -v                      # unit testovi (pravila test_*)
opa eval -d policy/ -i k8s/deployment.yaml "data.main.deny"
```

U pipelineu ti OPA CLI treba za `opa test` i `opa check`; samu evaluaciju nad fajlovima radi Conftest.

## Conftest

**Conftest** je CLI oko OPA-e napravljen za konfiguracione fajlove. Sam parsira YAML, JSON, HCL2, Dockerfile, TOML, INI i druge formate u `input`, pa ti pišeš samo pravila.

Konvencije:

- politike su u direktoriju `policy/` (ili `--policy <dir>`),
- podrazumijevani paket je `main` (drugi sa `--namespace`, svi sa `--all-namespaces`),
- Conftest traži pravila `deny`, `violation` i `warn`, i njihove varijante sa sufiksom (`deny_privileged`, `warn_resources`),
- `deny`/`violation` → **FAIL** (exit 1), `warn` → **WARN** (exit 0, osim sa `--fail-on-warn`).

### Politike za `k8s/deployment.yaml`

```rego
# /root/kurs-shop/policy/k8s.rego
package main

workload_kinds := {"Deployment", "StatefulSet", "DaemonSet", "Job"}

containers contains c if {
	input.kind in workload_kinds
	some c in input.spec.template.spec.containers
}

deny_privileged contains msg if {
	some c in containers
	c.securityContext.privileged == true
	msg := sprintf("%s: kontejner %s je privilegovan", [input.metadata.name, c.name])
}

deny_hostpath contains msg if {
	input.kind in workload_kinds
	some v in input.spec.template.spec.volumes
	v.hostPath
	msg := sprintf("%s: volumen %s montira hostPath %s", [input.metadata.name, v.name, v.hostPath.path])
}

deny_latest contains msg if {
	some c in containers
	endswith(c.image, ":latest")
	msg := sprintf("%s: slika %s koristi tag :latest", [input.metadata.name, c.image])
}

deny_registry contains msg if {
	some c in containers
	not registry_allowed(c.image)
	msg := sprintf("%s: slika %s nije iz dozvoljenog registrija", [input.metadata.name, c.image])
}

registry_allowed(img) if {
	some prefix in data.allowed_registries
	startswith(img, prefix)
}

warn_limits contains msg if {
	some c in containers
	not c.resources.limits.memory
	msg := sprintf("%s: kontejner %s nema memory limit", [input.metadata.name, c.name])
}
```

Spisak dozvoljenih registrija ne hardkoduješ u politiku nego ga daješ kao podatke:

```yaml
# /root/kurs-shop/data/registries.yaml
allowed_registries:
  - registry.kurs-shop.ba/
  - 127.0.0.1:5000/
```

```bash
cd /root/kurs-shop
conftest test k8s/deployment.yaml --data data
```

```text
WARN - k8s/deployment.yaml - main - kurs-shop: kontejner app nema memory limit
FAIL - k8s/deployment.yaml - main - kurs-shop: kontejner app je privilegovan
FAIL - k8s/deployment.yaml - main - kurs-shop: volumen host montira hostPath /
FAIL - k8s/deployment.yaml - main - kurs-shop: slika registry.kurs-shop.ba/kurs-shop:latest koristi tag :latest
```

Korisni flagovi:

| Flag | Šta radi |
|---|---|
| `-p`, `--policy policy/` | gdje su politike (podrazumijevano `policy`) |
| `--namespace terraform` | koji Rego paket se evaluira (podrazumijevano `main`) |
| `--all-namespaces` | svi paketi iz direktorija politika |
| `--data data/` | dodatni JSON/YAML podaci dostupni kao `data.*` |
| `--fail-on-warn` | upozorenja takođe ruše build (exit 1 za warn, 2 za fail) |
| `-o json`, `-o junit`, `-o sarif`, `-o github`, `-o table` | format izlaza |
| `--parser hcl2` | prisili parser kad ekstenzija ne odgovara |
| `--combine` | svi fajlovi u jedan `input` (npr. „svaki Deployment ima Service“) |

### Izuzeća u Conftestu

Zato pravila imaju sufikse: izuzeće se veže za sufiks pravila. Primjer: `node-exporter` legitimno treba `hostPath` za `/proc` i `/sys`.

```rego
# policy/exceptions.rego
package main

exception contains rules if {
	input.kind == "DaemonSet"
	input.metadata.name == "node-exporter"
	rules := ["hostpath"]   # gasi deny_hostpath (i violation_hostpath), ništa drugo
}
```

Izuzeće se u izlazu broji posebno (`... 1 exception`), pa je vidljivo. Rok važenja Conftest nema ugrađen, ali ga možeš izraziti u Regu: dodaj uslov `time.now_ns() < time.parse_rfc3339_ns("2026-12-31T00:00:00Z")` i izuzeće sam prestaje da važi.

> **U praksi:** Prazan string u `rules` (`rules := [""]`) gasi **sva** pravila nazvana samo `deny`. Zato ne piši sve u jedno `deny`: daj svakom pravilu ime (`deny_privileged`, `deny_hostpath`). Tako izuzeće gasi tačno jednu kontrolu, a ne sve.

### Testiranje politika: `conftest verify`

Politika bez testova je kod bez testova: prva izmjena je pokvari, a niko ne primijeti jer pipeline postane zelen.

```rego
# policy/k8s_test.rego
package main

dep(sc, volumes) := {
	"kind": "Deployment",
	"metadata": {"name": "t"},
	"spec": {"template": {"spec": {
		"containers": [{"name": "app", "image": "registry.kurs-shop.ba/app:1.0", "securityContext": sc}],
		"volumes": volumes,
	}}},
}

test_privileged_denied if {
	msgs := deny_privileged with input as dep({"privileged": true}, [])
	count(msgs) == 1
}

test_unprivileged_allowed if {
	count(deny_privileged) == 0 with input as dep({"privileged": false}, [])
}

test_hostpath_denied if {
	msgs := deny_hostpath with input as dep({}, [{"name": "h", "hostPath": {"path": "/"}}])
	count(msgs) == 1
}

test_registry_denied if {
	d := json.patch(dep({}, []), [{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value": "docker.io/evil/app:1.0"}])
	msgs := deny_registry with input as d with data.allowed_registries as ["registry.kurs-shop.ba/"]
	count(msgs) == 1
}
```

```bash
conftest verify --policy policy
# ili direktno OPA-om:
opa test policy/ -v
```

Pravila testova počinju sa `test_`. `with input as ...` i `with data.x as ...` podmeću ulaz i podatke samo za taj izraz.

### Conftest nad Terraform planom

Isti pristup radi i za Terraform, kao dopuna Checkovu iz modula 07 kad ti treba pravilo specifično za firmu. Plan u JSON-u ima stabilnu strukturu (`resource_changes[].change.after`):

```rego
# policy/terraform/rds.rego
package terraform

deny_public_rds contains msg if {
	some rc in input.resource_changes
	rc.type == "aws_db_instance"
	rc.change.after.publicly_accessible == true
	msg := sprintf("%s: RDS ne smije biti javno dostupan", [rc.address])
}
```

```bash
terraform show -json tfplan > tfplan.json
conftest test tfplan.json --policy policy/terraform --namespace terraform
```

> **U praksi:** Prvo uvedi nova pravila kao `warn_...`. Nakon dvije sedmice pogledaj koliko je repoa pogođeno, pošalji timovima uputstvo, pa ih preimenuj u `deny_...`. Pravilo koje preko noći obori 40 pipelinea dobije izuzeće za sve, a ne ispravke.

## Kyverno

**Kyverno** je Kubernetes-nativni policy engine: politike su Kubernetes resursi (YAML), bez novog jezika. U klasteru radi kao admission webhook; u pipelineu isti fajlovi rade kroz **Kyverno CLI**.

### Stanje u 1.19: ClusterPolicy vs CEL politike

| | `ClusterPolicy` / `Policy` (`kyverno.io/v1`) | `ValidatingPolicy` i srodne (`policies.kyverno.io`) |
|---|---|---|
| Jezik | YAML šabloni (`pattern`, anchori), JMESPath | **CEL** izrazi (kao Kubernetes ValidatingAdmissionPolicy) |
| Status u 1.19 | **deprecated**, uklanjanje najavljeno za 1.20 | preporučeni put, puna funkcionalna paritetnost |
| Validacija | `validate` pravilo | `ValidatingPolicy` |
| Potpisi slika | `verifyImages` pravilo | `ImageValidatingPolicy` |
| Mutacija / generisanje | `mutate` / `generate` | `MutatingPolicy` / `GeneratingPolicy` |

Postojećih `ClusterPolicy` ima puno (i u Kyverno biblioteci politika), pa ih moraš znati čitati. Nove politike piši kao `ValidatingPolicy`.

### ValidatingPolicy

```yaml
# /root/kurs-shop/policies/kyverno/deployment-baseline.yaml
apiVersion: policies.kyverno.io/v1
kind: ValidatingPolicy
metadata:
  name: kurs-deployment-baseline
spec:
  validationActions: [Deny]
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          !has(c.securityContext) || !has(c.securityContext.privileged) ||
          c.securityContext.privileged == false)
      message: "Privilegovani kontejneri nisu dozvoljeni."
    - expression: >-
        !has(object.spec.template.spec.volumes) ||
        object.spec.template.spec.volumes.all(v, !has(v.hostPath))
      message: "hostPath volumeni nisu dozvoljeni."
    - expression: >-
        object.spec.template.spec.containers.all(c, !c.image.endsWith(':latest'))
      message: "Tag :latest nije dozvoljen; koristi verziju ili digest."
```

- `validationActions`: `Deny` odbija resurs, `Audit` samo bilježi u policy report. U klaster novu politiku uvodiš sa `[Audit]`, a u pipelineu je odmah tretiraš kao gate.
- `has()` je obavezan za opciona polja: u CEL-u pristup nepostojećem polju je greška, ne „netačno“ kao u Regu.
- Ovdje politika cilja Deployment jer pipeline skenira manifeste iz repoa. U klasteru dodaj i `pods` (ili ekvivalentna pravila za ostale kontrolere), da se ograničenje ne zaobiđe direktnim Podom.

### Ista politika kao ClusterPolicy (stari format)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-privileged
spec:
  background: true
  rules:
    - name: no-privileged
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        failureAction: Enforce
        message: "Privilegovani kontejneri nisu dozvoljeni."
        pattern:
          spec:
            containers:
              - =(securityContext):
                  =(privileged): "false"
```

`=(polje)` je **equality anchor**: „ako polje postoji, mora imati ovu vrijednost“. Kyverno za pravila nad Podovima automatski generiše (**autogen**) pravila za Deployment, StatefulSet, Job i ostale kontrolere; u izvještaju se vide kao `autogen-no-privileged`. `failureAction: Enforce` u pravilu zamijenio je stari `spec.validationFailureAction`.

### `kyverno apply`

```bash
kyverno apply policies/kyverno/ --resource k8s/deployment.yaml
kyverno apply policies/kyverno/deployment-baseline.yaml -r k8s/ --table
kyverno apply policies/kyverno/ -r k8s/ --policy-report     # izlaz kao PolicyReport
kyverno apply policies/kyverno/ -r k8s/ --audit-warn        # Audit politike kao upozorenja
```

```text
Applying 1 policy rule(s) to 1 resource(s)...
policy kurs-deployment-baseline -> resource shop/Deployment/kurs-shop failed:
1 -  Privilegovani kontejneri nisu dozvoljeni.

pass: 0, fail: 1, warn: 0, error: 0, skip: 0
```

Politike su pozicioni argumenti (fajl ili direktorij), resursi idu kroz `--resource`/`-r`. `ValidatingPolicy` prijavljuje poruku prve validacije koja padne; kad developer ispravi privilegovani kontejner, sljedeće pokretanje pokaže `hostPath`. Za `ClusterPolicy` CLI u 1.19 ispisuje i upozorenje da je tip deprecated. Ako neki resurs padne, komanda vraća exit različit od nule, što je dovoljno za gate. `--audit-warn` je koristan kad iste politike u klasteru rade u Audit režimu: u pipelineu ih vidiš kao upozorenja, ne kao pad.

### `kyverno test`

```yaml
# policies/kyverno/tests/kyverno-test.yaml
apiVersion: cli.kyverno.io/v1alpha1
kind: Test
metadata:
  name: kurs-deployment-baseline
policies:
  - ../deployment-baseline.yaml
resources:
  - resources.yaml          # jedan ispravan i jedan loš Deployment
results:
  - isValidatingPolicy: true
    policy: kurs-deployment-baseline
    kind: Deployment
    resources: [good-deploy]
    result: pass
  - isValidatingPolicy: true
    policy: kurs-deployment-baseline
    kind: Deployment
    resources: [bad-deploy]
    result: fail
```

```bash
kyverno test policies/kyverno/tests
```

Za `ClusterPolicy` u `results` navodiš i `rule` (npr. `rule: autogen-no-privileged` za Deployment); za `ValidatingPolicy` nema imenovanih pravila, pa ide `isValidatingPolicy: true`. Mogući rezultati su `pass`, `fail`, `skip` i `warn`. Test pada ako se stvarni rezultat razlikuje od očekivanog, u bilo kom smjeru.

### Potpisi slika u klasteru (najava modula 10)

Provjeru potpisa u admissionu radi `ImageValidatingPolicy` (u starom formatu pravilo `verifyImages`):

```yaml
apiVersion: policies.kyverno.io/v1
kind: ImageValidatingPolicy
metadata:
  name: kurs-shop-signed
spec:
  validationActions: [Deny]
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["pods"]
  matchImageReferences:
    - glob: "registry.kurs-shop.ba/*"
  attestors:
    - name: cosign
      cosign:
        key:
          data: |
            -----BEGIN PUBLIC KEY-----
            ...
            -----END PUBLIC KEY-----
  validations:
    - expression: >-
        images.containers.map(image, verifyImageSignatures(image, [attestors.cosign])).all(e, e > 0)
      message: "Slika nije potpisana ključem kurs-shop pipelinea."
```

Ovo ima smisla samo u klasteru (treba pristup registriju i potpisima). U pipelineu potpis provjeravaš direktno sa `cosign verify` prije deploya.

## Conftest ili Kyverno?

| | Conftest (OPA/Rego) | Kyverno |
|---|---|---|
| Jezik | Rego | YAML (`pattern`) ili CEL |
| Šta provjerava | bilo koji strukturirani fajl: K8s, Terraform plan, Dockerfile, CI YAML, JSON | prvenstveno Kubernetes resurse (CEL politike i JSON payload) |
| U klasteru | preko OPA Gatekeepera (druge politike: `ConstraintTemplate`) | isti fajl politike kao u CLI-ju |
| Testovi | `conftest verify` / `opa test` (Rego testovi) | `kyverno test` (`kyverno-test.yaml`) |
| Izuzeća | `exception` pravila po sufiksu | `PolicyException` resurs, `exclude` u politici |
| Krivulja učenja | Rego traži vrijeme | YAML/CEL poznat Kubernetes timovima |
| Mutacija i generisanje resursa | ne | da |

Praktično pravilo: ako je cilj Kubernetes i želiš **jednu** politiku za pipeline i klaster, Kyverno je manje posla. Ako provjeravaš i Terraform, Dockerfile i CI konfiguraciju, Conftest pokriva sve jednim jezikom. Mnoge organizacije koriste oba: Conftest za „sve što nije Kubernetes“, Kyverno za klaster.

> **U praksi:** Politika koja postoji samo u klasteru otkriva problem tek pri deployu, kad je developer već zaboravio promjenu. Politika koja postoji samo u pipelineu ne štiti od `kubectl apply` sa laptopa. Ista politika na oba mjesta (Kyverno fajl u CI-ju kroz `kyverno apply`, isti fajl u klasteru) daje i brzu povratnu informaciju i garanciju.

## Politike u pipelineu

```yaml
policy-conftest:
  stage: test
  needs: []
  script:
    - conftest verify --policy policy
    - conftest test k8s/ --policy policy --data data -o junit > conftest-junit.xml
  artifacts:
    when: always
    reports:
      junit: conftest-junit.xml

policy-kyverno:
  stage: test
  needs: []
  script:
    - kyverno test policies/kyverno/tests
    - kyverno apply policies/kyverno/ -r k8s/ --table
```

Redoslijed u oba joba je isti: **prvo testovi politika, pa primjena**. Ako je neko pokvario politiku, pipeline pada na `verify`/`test` sa jasnom porukom, umjesto da politika tiho propušta sve. JUnit izvještaj GitLab prikazuje u MR-u kao listu palih „testova“, što je developerima poznatije od sirovog loga.

Pokretanje u labu:

```bash
cd /root/kurs-shop
gitlab-ci-local policy-conftest
gitlab-ci-local policy-kyverno
```

### Centralne politike

Politike ne smiju živjeti samo u repou aplikacije, jer tim može jednim commitom obrisati pravilo koje mu smeta. Drži ih u zasebnom projektu i uključi pinovanu verziju:

```yaml
include:
  - project: security/policies
    ref: v1.4.0
    file: templates/policy-jobs.yml
```

Šablon klonira (ili preuzima kao artefakt) direktorij politika iste verzije. Izmjene politika prolaze review security tima i imaju vlastiti pipeline sa `conftest verify` i `kyverno test`. Aplikacioni repo smije imati samo **izuzeća**, i to u fajlu za koji CODEOWNERS traži odobrenje security tima.

> **U praksi:** Poruka politike je korisnički interfejs. „deny_hostpath“ ne govori ništa; „volumen host montira hostPath / — koristi emptyDir ili PVC, izuzeće traži u #sec-help“ smanjuje broj pitanja na pola. Svaka `msg` neka kaže šta je pogrešno, gdje i šta uraditi.

## Rezime

- Policy as code: vlastita pravila organizacije, verzionisana i testirana, provedena u pipelineu (Conftest, `kyverno apply`) i u klasteru (Kyverno, Gatekeeper).
- OPA 1.x koristi Rego v1: `deny contains msg if { ... }`, `some x in`, `every`; `import rego.v1` nije potreban; v0 sintaksa (`deny[msg] { }`) ne prolazi parsiranje bez načina kompatibilnosti (`--v0-compatible`, u Conftestu `--rego-version v0`).
- Conftest: politike u `policy/`, paket `main` (`--namespace`, `--all-namespaces`), pravila `deny`/`violation`/`warn` sa sufiksima, `--data` za spiskove, `--fail-on-warn`, `-o junit|sarif|json`.
- Izuzeća u Conftestu idu kroz `exception contains rules if { ... rules := ["sufiks"] }`; zato pravila imenuj (`deny_hostpath`), ne sve u jedno `deny`.
- Testovi: `conftest verify` / `opa test` (pravila `test_*`, `with input as`); `kyverno test` sa `kyverno-test.yaml` (`isValidatingPolicy: true` za CEL politike, `rule` za ClusterPolicy).
- Kyverno 1.19: `ClusterPolicy` je deprecated (uklanjanje u 1.20); nove politike su `ValidatingPolicy` (CEL, `validationActions: [Deny|Audit]`) i `ImageValidatingPolicy` za potpise.
- U pipelineu: prvo testovi politika, pa primjena; politike u centralnom repou uključene pinovanom verzijom.
