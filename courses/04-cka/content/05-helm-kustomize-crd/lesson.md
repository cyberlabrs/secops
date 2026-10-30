## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 1 (**Cluster Architecture, Installation & Configuration**, 25% ispita):

- **1.6** Use Helm and Kustomize to install cluster components,
- **1.8** Understand CRDs, install and configure operators.

Tipični zadaci na ispitu:

- „Instaliraj chart iz repozitorija/lokalnog `.tgz` fajla u namespace `ingress` sa zadatom vrijednošću (`--set` ili values fajl).“
- „Nadogradi release na novu verziju charta“ ili „vrati release na prethodnu reviziju“.
- „Ispiši (`helm template`) manifeste u fajl bez instalacije.“
- „Primijeni Kustomize overlay `prod` i promijeni image tag / broj replika.“
- „Instaliraj CRD-ove i operator iz manifesta, pa napravi custom resource po primjeru“, ili „ispiši sva polja CRD-a u fajl“.

Na ispitu je **helm.sh/docs** dozvoljena dokumentacija, pa znaj gdje je referenca komandi (`helm.sh/docs/helm/helm_install`).

## Helm osnove

**Helm** je package manager za Kubernetes. Pojmovi:

| Pojam | Značenje |
|---|---|
| **Chart** | Paket: `Chart.yaml`, `values.yaml`, `templates/` (Go templating), opciono `crds/` |
| **Repository** | HTTP server sa `index.yaml` i chartovima; alternativno OCI registry (`oci://...`) |
| **Release** | Instanca charta u klasteru, sa imenom i namespaceom |
| **Revision** | Svaki install/upgrade/rollback pravi novu reviziju |
| **Values** | Parametri charta; ti ih prepisuješ sa `-f` i `--set` |

Helm nema serversku komponentu: stanje releasea čuva u **Secretima** tipa `helm.sh/release.v1` u namespaceu releasea (`kubectl get secret -n <ns> -l owner=helm`).

### Helm 4: šta je novo za korisnika

Lab koristi **Helm 4** (izašao novembra 2025). Komande su iste kao u Helm 3, uz nekoliko razlika:

| Helm 3 | Helm 4 |
|---|---|
| `--atomic` | `--rollback-on-failure` (stari flag radi, uz upozorenje o deprecation) |
| `--force` | `--force-replace` (stari flag radi, uz upozorenje) |
| Client-side apply (3-way merge) | **Server-side apply** podrazumijevano za nove instalacije; upgrade i rollback zadržavaju metod prethodne revizije (flag `--server-side`) |
| `--wait` je bool | `--wait` prima strategiju: `watcher` (podrazumijevano kad navedeš samo `--wait`), `hookOnly` (podrazumijevano bez flaga), `legacy` |
| Post-renderer je izvršni fajl | Post-renderer je **plugin** |
| `helm registry login https://...` | `helm registry login` prima samo ime domena |

Chartovi `apiVersion: v2` rade bez izmjena. Charts v3 su eksperimentalni i nisu tema ispita.

### Repozitorij i pretraga

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm repo list
helm search repo traefik                 # u dodatim repozitorijima
helm search repo traefik/traefik --versions
helm search hub prometheus               # Artifact Hub (treba internet)
helm show chart traefik/traefik
helm show values traefik/traefik > values.yaml
helm pull traefik/traefik --version <verzija> --untar   # skini i raspakuj chart
```

Lab nema internet: Traefik chart je već u `/opt/kurs/charts/`. Helm radi sa lokalnim `.tgz` fajlom ili raspakovanim direktorijem isto kao sa `repo/chart`:

```bash
ls /opt/kurs/charts/
helm show values /opt/kurs/charts/traefik-*.tgz | less
```

### Instalacija

```bash
helm install traefik /opt/kurs/charts/traefik-*.tgz \
  -n traefik --create-namespace \
  --set deployment.replicas=2 \
  --set service.spec.type=NodePort

helm install traefik traefik/traefik --version <verzija> -n traefik --create-namespace -f my-values.yaml
```

- `-n` je namespace releasea. Bez `--create-namespace` instalacija pada ako namespace ne postoji.
- `-f`/`--values` i `--set` se mogu ponavljati. Kasniji pobjeđuje; `--set` ima prednost nad `-f`.
- `--set` za ugniježđena polja koristi tačku (`a.b.c=1`), za liste indeks (`args[0]=--debug`). Tačka u samom ključu se escapuje (`--set 'nodeSelector.kubernetes\.io/os=linux'`), a zarez u vrijednosti sa `\,`.
- `--set-string` forsira string (npr. `--set-string podAnnotations.version=1.0`).

Bez `--wait` Helm završava čim API server prihvati objekte (hooks se i dalje čekaju). Sa `--wait` čeka da Deploymenti/Podovi budu spremni, do `--timeout` (podrazumijevano 5m).

### Pregled, upgrade, rollback

```bash
helm list -n traefik
helm list -A                         # svi namespaceovi
helm list -A --failed               # samo releasei u stanju failed
helm status traefik -n traefik
helm get values traefik -n traefik   # samo vrijednosti koje si ti zadao
helm get values traefik -n traefik --all
helm get manifest traefik -n traefik

helm upgrade traefik /opt/kurs/charts/traefik-*.tgz -n traefik --reuse-values --set deployment.replicas=3
helm upgrade --install traefik /opt/kurs/charts/traefik-*.tgz -n traefik --create-namespace -f values.yaml

helm history traefik -n traefik
helm rollback traefik 1 -n traefik   # na reviziju 1
helm rollback traefik -n traefik     # bez broja: na prethodnu reviziju

helm uninstall traefik -n traefik
helm uninstall traefik -n traefik --keep-history
```

Važno kod `helm upgrade`:

- Bez `--reuse-values` i bez `-f` upgrade koristi **podrazumijevane vrijednosti charta** + ono što daš u toj komandi. Ranije zadate `--set` vrijednosti se gube.
- `--reuse-values` uzima vrijednosti prethodne revizije i dodaje nove `--set`/`-f`.
- `upgrade --install` je idempotentan: instalira ako release ne postoji, inače nadogradi. Pogodan za skripte.
- Rollback pravi **novu reviziju** (npr. 3) sa sadržajem stare (npr. 1); istorija se ne briše.

### helm template

`helm template` renderuje manifeste lokalno, bez instalacije i bez releasea u klasteru:

```bash
helm template traefik /opt/kurs/charts/traefik-*.tgz -n traefik \
  --set service.spec.type=NodePort > /root/traefik.yaml
kubectl apply -f /root/traefik.yaml --dry-run=server
```

Release napravljen ovako nije vidljiv u `helm list`: objekte si primijenio kubectlom. `helm install --dry-run=client` takođe ispisuje manifeste, ali uz ostale informacije o releaseu.

> **Na ispitu:** pročitaj da li zadatak traži *instalaciju* (`helm install`, release postoji u `helm list`) ili *manifest u fajlu* (`helm template ... > fajl`). Namespace releasea zadaj sa `-n` i u `helm list`; bez `-n` Helm gleda samo trenutni namespace i release „ne postoji“.

> **Na ispitu:** za nazive vrijednosti ne pogađaj. `helm show values <chart> | grep -n -A5 replicas` brzo pokaže tačan ključ i ugniježđenost.

### CRD-ovi u Helm chartovima

Chart može nositi CRD-ove u direktoriju `crds/`. Helm ih instalira **prije** ostalih manifesta i **samo pri prvoj instalaciji**: `helm upgrade` ih ne ažurira, a `helm uninstall` ih ne briše (brisanje CRD-a bi obrisalo sve custom resurse). Flag `--skip-crds` preskače instalaciju CRD-ova. Zato operatori često imaju poseban chart ili manifest samo za CRD-ove.

## Kustomize

**Kustomize** prilagođava obične YAML manifeste bez templatinga: imaš bazne manifeste i `kustomization.yaml` koji kaže šta da se promijeni. Ugrađen je u kubectl:

```bash
kubectl kustomize overlays/prod          # ispiši rezultat
kubectl apply -k overlays/prod           # primijeni
kubectl diff -k overlays/prod
kubectl delete -k overlays/prod
```

### kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: web
namePrefix: prod-
labels:
- pairs:
    app.kubernetes.io/part-of: shop
  includeSelectors: false
resources:
- deployment.yaml
- service.yaml
images:
- name: nginx
  newTag: "1.28"
replicas:
- name: web
  count: 3
configMapGenerator:
- name: web-config
  literals:
  - LOG_LEVEL=info
  files:
  - nginx.conf
secretGenerator:
- name: web-secret
  literals:
  - API_KEY=s3cr3t
```

| Polje | Šta radi |
|---|---|
| `resources` | Lista fajlova, direktorija (sa svojim `kustomization.yaml`) ili URL-ova |
| `namespace` | Postavlja namespace na sve namespaced objekte |
| `namePrefix` / `nameSuffix` | Dodaje prefiks/sufiks imenima i ažurira reference (npr. ConfigMap u Deploymentu) |
| `labels` | Dodaje labele; sa `includeSelectors: true` i u selectore (oprez: selector Deploymenta je immutable) |
| `commonLabels` | Stariji, **deprecated** oblik koji uvijek mijenja i selectore |
| `images` | Mijenja image po imenu: `newName`, `newTag` ili `digest` |
| `replicas` | Mijenja broj replika po imenu objekta |
| `configMapGenerator` / `secretGenerator` | Pravi ConfigMap/Secret iz `literals`, `files` ili `envs`, sa hash sufiksom u imenu |
| `patches` | Strategic merge ili JSON 6902 zakrpe |

Generatori dodaju **hash sufiks** (npr. `web-config-7g9k2fbt5h`) i ažuriraju sve reference na njega. Kad se sadržaj promijeni, mijenja se ime, pa Deployment dobija novi Pod template i radi rolling update. To se isključuje sa `generatorOptions: {disableNameSuffixHash: true}`.

U labu nema posebnog `kustomize` binarnog fajla (pa ni `kustomize edit set image`): `kustomization.yaml` mijenjaš ručno u vim-u, a rezultat provjeravaš sa `kubectl kustomize`.

### Patches

Strategic merge patch je djelimičan manifest: identifikuje objekat po `kind` i `metadata.name` i spaja polja (liste kontejnera spaja po `name`).

```yaml
# overlays/prod/resources-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  template:
    spec:
      containers:
      - name: nginx
        resources:
          limits:
            memory: 256Mi
```

**JSON 6902** patch je lista operacija (`add`, `remove`, `replace`, `move`, `copy`, `test`) nad JSON putanjom i **uvijek traži `target`**:

```yaml
patches:
- path: resources-patch.yaml          # strategic merge (target nije obavezan)
- target:
    group: apps
    version: v1
    kind: Deployment
    name: web
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 5
    - op: add
      path: /spec/template/spec/containers/0/env
      value:
      - name: MODE
        value: prod
```

Stara polja `patchesStrategicMerge` i `patchesJson6902` zamijenjena su jednim poljem `patches`.

### Base i overlays

```text
app/
├── base/
│   ├── kustomization.yaml     # resources: deployment.yaml, service.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    └── prod/
        ├── kustomization.yaml
        └── resources-patch.yaml
```

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: prod
resources:
- ../../base
images:
- name: nginx
  newTag: "1.28"
patches:
- path: resources-patch.yaml
```

Base ne zna za overlay; overlay referencira base kroz `resources`. Namespace iz `namespace:` mora postojati prije `apply -k` (ili ga dodaj kao resurs u overlay).

> **Na ispitu:** prije `kubectl apply -k` uvijek pokreni `kubectl kustomize <dir>` i provjeri rezultat (namespace, ime sa prefiksom, image tag). Česta zamka: `kubectl apply -f dir/` ignoriše `kustomization.yaml` i primjenjuje sirove fajlove; za Kustomize treba `-k`.

### Helm vs Kustomize

| | Helm | Kustomize |
|---|---|---|
| Pristup | Templating (`{{ .Values.x }}`) | Patchovanje običnog YAML-a |
| Parametri | `values.yaml`, `--set`, `-f` | Overlays, patches, `images`, `replicas` |
| Stanje u klasteru | Release i revizije (Secreti) | Nema; samo primijenjeni objekti |
| Rollback | `helm rollback` | Ponovo primijeni stariju verziju iz Gita |
| Alat | `helm` | `kubectl kustomize`, `kubectl apply -k` |

## CustomResourceDefinition (CRD)

**CustomResourceDefinition** proširuje Kubernetes API novim tipom resursa. Kad se CRD kreira, API server odmah servira novi endpoint `/apis/<group>/<version>/[namespaces/<ns>/]<plural>`, a objekti novog tipa (**custom resources**, CR) čuvaju se u etcd-u kao i ugrađeni.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.kurs.local            # mora biti <plural>.<group>
spec:
  group: kurs.local
  scope: Namespaced                   # ili Cluster
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: ["bk"]
  versions:
  - name: v1
    served: true                      # API servira ovu verziju
    storage: true                     # tačno jedna verzija je storage
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["schedule", "target"]
            properties:
              schedule:
                type: string
                description: Cron izraz za backup
              target:
                type: string
              retention:
                type: integer
                minimum: 1
                default: 7
    additionalPrinterColumns:
    - name: Schedule
      type: string
      jsonPath: .spec.schedule
```

Custom resource:

```yaml
apiVersion: kurs.local/v1
kind: Backup
metadata:
  name: db-nightly
  namespace: default
spec:
  schedule: "0 2 * * *"
  target: postgres
```

Ključna pravila:

- `metadata.name` = `<names.plural>.<spec.group>`; inače se CRD ne prihvata.
- U `apiextensions.k8s.io/v1` **schema je obavezna** i mora biti strukturna (svako polje ima `type`). Polja koja nisu u schemi API server **odbacuje** (pruning), osim ispod `x-kubernetes-preserve-unknown-fields: true`.
- Validacija (`required`, `minimum`, `enum`, `pattern`) se izvršava na API serveru: neispravan CR pada pri `kubectl apply`.
- Više verzija: sve sa `served: true` su dostupne, tačno jedna je `storage: true`.
- **Brisanje CRD-a briše sve CR-ove tog tipa.**

```bash
kubectl get crd
kubectl get crd backups.kurs.local -o yaml
kubectl api-resources --api-group=kurs.local
kubectl explain backup.spec                 # radi zahvaljujući openAPIV3Schema
kubectl explain backup.spec --recursive
kubectl get backups -A                      # ili: kubectl get bk -A
kubectl describe backup db-nightly
```

> **Na ispitu:** zadatak tipa „ispiši sva polja `spec` resursa X iz CRD-a Y u fajl“ najbrže rješavaš sa `kubectl explain <kind>.spec > /putanja` (ili `--recursive`). Ime resursa za `explain` vidiš u koloni NAME/SHORTNAMES iz `kubectl api-resources`.

## Operator pattern

CRD sam po sebi samo čuva podatke: `Backup` objekat ništa ne radi dok ga neko ne obrađuje. **Operator** = CRD + **controller** koji zna kako upravljati aplikacijom (backup baze, failover, upgrade).

**Reconcile petlja** controllera:

1. **Watch**: prati CR-ove (i objekte koje sam pravi) preko API servera.
2. **Uporedi** željeno stanje (`spec`) sa stvarnim stanjem u klasteru.
3. **Djeluj**: kreira/mijenja/briše Deploymente, StatefulSetove, CronJobove, Secrete...
4. **Upiši status** u `status` CR-a (najčešće kroz subresurs `/status`).
5. Ponavljaj na svaku promjenu i periodično.

Isti princip koriste ugrađeni kontroleri u `kube-controller-manager` (Deployment → ReplicaSet → Podovi). Operator je obično Deployment u svom namespaceu, sa vlastitim ServiceAccountom.

### Instalacija operatora

Dva uobičajena načina:

```bash
# 1. Manifest (CRD + namespace + RBAC + Deployment u jednom fajlu ili više)
kubectl apply -f /opt/kurs/manifests/<operator>.yaml
kubectl apply --server-side -f crds.yaml    # veliki CRD-ovi: anotacija last-applied prelazi limit

# 2. Helm chart
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set crds.enabled=true
```

Provjera nakon instalacije:

```bash
kubectl get crd | grep <grupa>
kubectl get deploy,pods -n <operator-ns>
kubectl logs -n <operator-ns> deploy/<operator> --tail=50
kubectl get <cr-kind> -A
```

Redoslijed je bitan: CRD mora postojati prije CR-a. Ako u istom fajlu imaš CRD i CR, prvi `kubectl apply` može prijaviti `no matches for kind "Backup" in version "kurs.local/v1"`; ponovi apply kad je CRD `Established` (`kubectl wait --for=condition=Established crd/backups.kurs.local`).

### RBAC koji operator treba

Controller radi pod svojim ServiceAccountom, pa mu treba ClusterRole (ili Role, ako je operator ograničen na jedan namespace):

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backup-operator
rules:
- apiGroups: ["kurs.local"]
  resources: ["backups"]
  verbs: ["get", "list", "watch", "update", "patch"]
- apiGroups: ["kurs.local"]
  resources: ["backups/status"]
  verbs: ["get", "update", "patch"]
- apiGroups: ["batch"]
  resources: ["cronjobs"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["events"]
  verbs: ["create", "patch"]
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]               # leader election
  verbs: ["get", "create", "update"]
```

```bash
kubectl create clusterrolebinding backup-operator \
  --clusterrole=backup-operator --serviceaccount=backup-system:backup-operator
kubectl auth can-i watch backups.kurs.local -A \
  --as=system:serviceaccount:backup-system:backup-operator
```

Pravila za CR-ove (`list`/`watch` na `backups`) i za `backups/status` su odvojena: bez `/status` operator radi posao, ali ne može upisati status.

> **Na ispitu:** ako operator ne reaguje na novi CR, prvo pogledaj logove operatora. Poruke tipa `backups.kurs.local is forbidden: User "system:serviceaccount:...` znače da nedostaje RBAC, a ne da CR nije dobar.

## Troubleshooting

| Simptom | Uzrok i provjera |
|---|---|
| `Error: INSTALLATION FAILED: cannot re-use a name that is still in use` | Release postoji: `helm list -A`, koristi `helm upgrade --install` |
| `helm list` ne prikazuje release | Pogrešan namespace: `helm list -A` |
| `Error: ... namespaces "x" not found` | Dodaj `--create-namespace` |
| Nakon upgrade-a izgubljena ranija podešavanja | Upgrade bez `--reuse-values`/`-f` vraća defaulte charta |
| Release u stanju `failed` ili `pending-upgrade` | `helm history`, pa `helm rollback`; ubuduće `--rollback-on-failure` |
| `kubectl apply -k`: `no such file` / `accumulating resources` | Pogrešna relativna putanja u `resources` (npr. `../../base`) |
| Selector Deploymenta „field is immutable“ nakon kustomize | `includeSelectors: true` ili `commonLabels` promijenili selector |
| `no matches for kind "X" in version "..."` | CRD nije instaliran ili nije `Established`; pogrešan `apiVersion` CR-a |
| CR se kreira, ali ništa se ne dešava | Operator ne radi ili nema RBAC; pogledaj logove operatora |
| `unknown field "spec.foo"` ili polje nestane | Polje nije u `openAPIV3Schema` (strict validacija / pruning) |

## Rezime

- Helm: `repo add/update`, `search repo`, `show values`, `install -n --create-namespace -f/--set`, `upgrade --install`, `list -A`, `history`, `rollback`, `uninstall`; lokalni `.tgz` se koristi isto kao `repo/chart`.
- Helm 4: `--rollback-on-failure` i `--force-replace` zamjenjuju `--atomic` i `--force`, server-side apply je podrazumijevan za nove instalacije, `--wait` prima strategiju.
- `helm template` renderuje manifeste bez releasea; `helm upgrade` bez `--reuse-values` vraća defaulte charta; rollback pravi novu reviziju.
- Kustomize: `resources`, `namespace`, `namePrefix`, `labels`, `images`, `replicas`, generatori sa hash sufiksom, `patches` (strategic merge ili JSON 6902 sa `target`); `kubectl kustomize` za pregled, `kubectl apply -k` za primjenu.
- Base + overlays: overlay referencira base kroz `resources: [../../base]` i dodaje svoje izmjene.
- CRD: ime `<plural>.<group>`, `scope`, `versions` (tačno jedna `storage`), obavezna strukturna `openAPIV3Schema`; brisanje CRD-a briše sve CR-ove; `kubectl explain` radi i za CR-ove.
- Operator = CRD + controller sa reconcile petljom; instalira se manifestom ili Helmom, i treba RBAC za svoje CR-ove, `/status`, objekte kojima upravlja, events i leases.
