## What this module covers

This module covers two objectives from domain 1 (**Cluster Architecture, Installation & Configuration**, 25% of the exam):

- **1.6** Use Helm and Kustomize to install cluster components,
- **1.8** Understand CRDs, install and configure operators.

Typical exam tasks:

- "Install a chart from a repository/local `.tgz` file into namespace `ingress` with a given value (`--set` or a values file)."
- "Upgrade the release to a new chart version" or "roll the release back to the previous revision".
- "Render (`helm template`) the manifests to a file without installing."
- "Apply the Kustomize overlay `prod` and change the image tag / replica count."
- "Install the CRDs and the operator from manifests, then create a custom resource following the example", or "write all fields of a CRD to a file".

On the exam **helm.sh/docs** is allowed documentation, so know where the command reference is (`helm.sh/docs/helm/helm_install`).

## Helm basics

**Helm** is a package manager for Kubernetes. Concepts:

| Concept | Meaning |
|---|---|
| **Chart** | A package: `Chart.yaml`, `values.yaml`, `templates/` (Go templating), optionally `crds/` |
| **Repository** | An HTTP server with `index.yaml` and charts; alternatively an OCI registry (`oci://...`) |
| **Release** | An instance of a chart in the cluster, with a name and namespace |
| **Revision** | Every install/upgrade/rollback creates a new revision |
| **Values** | Chart parameters; you override them with `-f` and `--set` |

Helm has no server-side component: it stores release state in **Secrets** of type `helm.sh/release.v1` in the release namespace (`kubectl get secret -n <ns> -l owner=helm`).

### Helm 4: what is new for users

The lab uses **Helm 4** (released November 2025). The commands are the same as in Helm 3, with a few differences:

| Helm 3 | Helm 4 |
|---|---|
| `--atomic` | `--rollback-on-failure` (the old flag works, with a deprecation warning) |
| `--force` | `--force-replace` (the old flag works, with a warning) |
| Client-side apply (3-way merge) | **Server-side apply** by default for new installs; upgrade and rollback keep the previous revision's method (flag `--server-side`) |
| `--wait` is a bool | `--wait` takes a strategy: `watcher` (the default when you give just `--wait`), `hookOnly` (the default without the flag), `legacy` |
| A post-renderer is an executable | A post-renderer is a **plugin** |
| `helm registry login https://...` | `helm registry login` takes only the domain name |

`apiVersion: v2` charts work unchanged. Charts v3 are experimental and not an exam topic.

### Repositories and search

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm repo list
helm search repo traefik                 # in the added repositories
helm search repo traefik/traefik --versions
helm search hub prometheus               # Artifact Hub (needs internet)
helm show chart traefik/traefik
helm show values traefik/traefik > values.yaml
helm pull traefik/traefik --version <version> --untar   # download and unpack the chart
```

The lab has no internet: the Traefik chart is already in `/opt/kurs/charts/`. Helm works with a local `.tgz` file or an unpacked directory just like with `repo/chart`:

```bash
ls /opt/kurs/charts/
helm show values /opt/kurs/charts/traefik-*.tgz | less
```

### Installation

```bash
helm install traefik /opt/kurs/charts/traefik-*.tgz \
  -n traefik --create-namespace \
  --set deployment.replicas=2 \
  --set service.spec.type=NodePort

helm install traefik traefik/traefik --version <version> -n traefik --create-namespace -f my-values.yaml
```

- `-n` is the release namespace. Without `--create-namespace` the install fails if the namespace does not exist.
- `-f`/`--values` and `--set` can be repeated. The later one wins; `--set` takes precedence over `-f`.
- `--set` uses a dot for nested fields (`a.b.c=1`) and an index for lists (`args[0]=--debug`). A dot inside a key is escaped (`--set 'nodeSelector.kubernetes\.io/os=linux'`), and a comma in a value with `\,`.
- `--set-string` forces a string (e.g. `--set-string podAnnotations.version=1.0`).

Without `--wait`, Helm finishes as soon as the API server accepts the objects (hooks are still waited for). With `--wait` it waits for Deployments/Pods to be ready, up to `--timeout` (5m by default).

### Inspecting, upgrading, rolling back

```bash
helm list -n traefik
helm list -A                         # all namespaces
helm list -A --failed               # only releases in the failed state
helm status traefik -n traefik
helm get values traefik -n traefik   # only the values you set
helm get values traefik -n traefik --all
helm get manifest traefik -n traefik

helm upgrade traefik /opt/kurs/charts/traefik-*.tgz -n traefik --reuse-values --set deployment.replicas=3
helm upgrade --install traefik /opt/kurs/charts/traefik-*.tgz -n traefik --create-namespace -f values.yaml

helm history traefik -n traefik
helm rollback traefik 1 -n traefik   # to revision 1
helm rollback traefik -n traefik     # without a number: to the previous revision

helm uninstall traefik -n traefik
helm uninstall traefik -n traefik --keep-history
```

Important with `helm upgrade`:

- Without `--reuse-values` and without `-f`, an upgrade uses the **chart's default values** + whatever you pass in that command. Previously set `--set` values are lost.
- `--reuse-values` takes the previous revision's values and adds the new `--set`/`-f`.
- `upgrade --install` is idempotent: it installs if the release does not exist, otherwise it upgrades. Good for scripts.
- A rollback creates a **new revision** (e.g. 3) with the content of an old one (e.g. 1); history is not deleted.

### helm template

`helm template` renders manifests locally, without installing and without a release in the cluster:

```bash
helm template traefik /opt/kurs/charts/traefik-*.tgz -n traefik \
  --set service.spec.type=NodePort > /root/traefik.yaml
kubectl apply -f /root/traefik.yaml --dry-run=server
```

Objects created this way are not visible in `helm list`: you applied them with kubectl. `helm install --dry-run=client` also prints the manifests, but together with other release information.

> **On the exam:** read whether the task asks for an *installation* (`helm install`, the release exists in `helm list`) or a *manifest in a file* (`helm template ... > file`). Give the release namespace with `-n`, also in `helm list`; without `-n` Helm looks only at the current namespace and the release "does not exist".

> **On the exam:** do not guess value names. `helm show values <chart> | grep -n -A5 replicas` quickly shows the exact key and nesting.

### CRDs in Helm charts

A chart can carry CRDs in the `crds/` directory. Helm installs them **before** the other manifests and **only on the first install**: `helm upgrade` does not update them, and `helm uninstall` does not delete them (deleting a CRD would delete all its custom resources). The `--skip-crds` flag skips CRD installation. That is why operators often have a separate chart or manifest just for the CRDs.

## Kustomize

**Kustomize** customizes plain YAML manifests without templating: you have base manifests and a `kustomization.yaml` that says what to change. It is built into kubectl:

```bash
kubectl kustomize overlays/prod          # print the result
kubectl apply -k overlays/prod           # apply
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

| Field | What it does |
|---|---|
| `resources` | A list of files, directories (with their own `kustomization.yaml`) or URLs |
| `namespace` | Sets the namespace on all namespaced objects |
| `namePrefix` / `nameSuffix` | Adds a prefix/suffix to names and updates references (e.g. a ConfigMap in a Deployment) |
| `labels` | Adds labels; with `includeSelectors: true` also to selectors (careful: a Deployment selector is immutable) |
| `commonLabels` | The older, **deprecated** form that always changes selectors too |
| `images` | Changes an image by name: `newName`, `newTag` or `digest` |
| `replicas` | Changes the replica count by object name |
| `configMapGenerator` / `secretGenerator` | Creates a ConfigMap/Secret from `literals`, `files` or `envs`, with a hash suffix in the name |
| `patches` | Strategic merge or JSON 6902 patches |

Generators add a **hash suffix** (e.g. `web-config-7g9k2fbt5h`) and update all references to it. When the content changes, the name changes, so the Deployment gets a new Pod template and does a rolling update. You can turn this off with `generatorOptions: {disableNameSuffixHash: true}`.

The lab has no separate `kustomize` binary (and therefore no `kustomize edit set image`): you edit `kustomization.yaml` by hand in vim and check the result with `kubectl kustomize`.

### Patches

A strategic merge patch is a partial manifest: it identifies the object by `kind` and `metadata.name` and merges fields (container lists are merged by `name`).

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

A **JSON 6902** patch is a list of operations (`add`, `remove`, `replace`, `move`, `copy`, `test`) on a JSON path and **always requires a `target`**:

```yaml
patches:
- path: resources-patch.yaml          # strategic merge (target is optional)
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

The old `patchesStrategicMerge` and `patchesJson6902` fields have been replaced by the single `patches` field.

### Base and overlays

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

The base does not know about the overlay; the overlay references the base through `resources`. The namespace from `namespace:` must exist before `apply -k` (or add it as a resource in the overlay).

> **On the exam:** before `kubectl apply -k` always run `kubectl kustomize <dir>` and check the result (namespace, prefixed name, image tag). A common trap: `kubectl apply -f dir/` ignores `kustomization.yaml` and applies the raw files; Kustomize needs `-k`.

### Helm vs Kustomize

| | Helm | Kustomize |
|---|---|---|
| Approach | Templating (`{{ .Values.x }}`) | Patching plain YAML |
| Parameters | `values.yaml`, `--set`, `-f` | Overlays, patches, `images`, `replicas` |
| State in the cluster | Release and revisions (Secrets) | None; only the applied objects |
| Rollback | `helm rollback` | Re-apply an older version from Git |
| Tool | `helm` | `kubectl kustomize`, `kubectl apply -k` |

## CustomResourceDefinition (CRD)

A **CustomResourceDefinition** extends the Kubernetes API with a new resource type. Once the CRD is created, the API server immediately serves a new endpoint `/apis/<group>/<version>/[namespaces/<ns>/]<plural>`, and objects of the new type (**custom resources**, CRs) are stored in etcd just like built-in ones.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.kurs.local            # must be <plural>.<group>
spec:
  group: kurs.local
  scope: Namespaced                   # or Cluster
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: ["bk"]
  versions:
  - name: v1
    served: true                      # the API serves this version
    storage: true                     # exactly one version is the storage version
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

A custom resource:

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

Key rules:

- `metadata.name` = `<names.plural>.<spec.group>`; otherwise the CRD is not accepted.
- In `apiextensions.k8s.io/v1` **the schema is required** and must be structural (every field has a `type`). The API server **drops** fields that are not in the schema (pruning), except under `x-kubernetes-preserve-unknown-fields: true`.
- Validation (`required`, `minimum`, `enum`, `pattern`) runs on the API server: an invalid CR fails at `kubectl apply`.
- Multiple versions: all with `served: true` are available, exactly one is `storage: true`.
- **Deleting a CRD deletes all CRs of that type.**

```bash
kubectl get crd
kubectl get crd backups.kurs.local -o yaml
kubectl api-resources --api-group=kurs.local
kubectl explain backup.spec                 # works thanks to openAPIV3Schema
kubectl explain backup.spec --recursive
kubectl get backups -A                      # or: kubectl get bk -A
kubectl describe backup db-nightly
```

> **On the exam:** a task like "write all `spec` fields of resource X from CRD Y to a file" is solved fastest with `kubectl explain <kind>.spec > /path` (or `--recursive`). You can see the resource name for `explain` in the NAME/SHORTNAMES column of `kubectl api-resources`.

## The operator pattern

A CRD by itself only stores data: a `Backup` object does nothing until something processes it. An **operator** = CRD + a **controller** that knows how to manage an application (database backup, failover, upgrade).

The controller's **reconcile loop**:

1. **Watch**: follows the CRs (and the objects it creates itself) via the API server.
2. **Compare** the desired state (`spec`) with the actual state in the cluster.
3. **Act**: creates/changes/deletes Deployments, StatefulSets, CronJobs, Secrets...
4. **Write the status** into the CR's `status` (usually through the `/status` subresource).
5. Repeat on every change and periodically.

The built-in controllers in `kube-controller-manager` use the same principle (Deployment → ReplicaSet → Pods). An operator is usually a Deployment in its own namespace, with its own ServiceAccount.

### Installing an operator

Two common ways:

```bash
# 1. Manifest (CRD + namespace + RBAC + Deployment in one or more files)
kubectl apply -f /opt/kurs/manifests/<operator>.yaml
kubectl apply --server-side -f crds.yaml    # large CRDs: the last-applied annotation exceeds the limit

# 2. Helm chart
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set crds.enabled=true
```

Checking after installation:

```bash
kubectl get crd | grep <group>
kubectl get deploy,pods -n <operator-ns>
kubectl logs -n <operator-ns> deploy/<operator> --tail=50
kubectl get <cr-kind> -A
```

Order matters: the CRD must exist before the CR. If you have a CRD and a CR in the same file, the first `kubectl apply` may report `no matches for kind "Backup" in version "kurs.local/v1"`; repeat the apply once the CRD is `Established` (`kubectl wait --for=condition=Established crd/backups.kurs.local`).

### The RBAC an operator needs

The controller runs under its own ServiceAccount, so it needs a ClusterRole (or a Role, if the operator is limited to one namespace):

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

The rules for CRs (`list`/`watch` on `backups`) and for `backups/status` are separate: without `/status` the operator does its job but cannot write the status.

> **On the exam:** if the operator does not react to a new CR, look at the operator logs first. Messages like `backups.kurs.local is forbidden: User "system:serviceaccount:...` mean RBAC is missing, not that the CR is wrong.

## Troubleshooting

| Symptom | Cause and check |
|---|---|
| `Error: INSTALLATION FAILED: cannot re-use a name that is still in use` | The release exists: `helm list -A`, use `helm upgrade --install` |
| `helm list` does not show the release | Wrong namespace: `helm list -A` |
| `Error: ... namespaces "x" not found` | Add `--create-namespace` |
| Earlier settings lost after an upgrade | An upgrade without `--reuse-values`/`-f` reverts to the chart defaults |
| Release in the `failed` or `pending-upgrade` state | `helm history`, then `helm rollback`; in the future `--rollback-on-failure` |
| `kubectl apply -k`: `no such file` / `accumulating resources` | Wrong relative path in `resources` (e.g. `../../base`) |
| Deployment selector "field is immutable" after kustomize | `includeSelectors: true` or `commonLabels` changed the selector |
| `no matches for kind "X" in version "..."` | The CRD is not installed or not `Established`; wrong `apiVersion` in the CR |
| The CR is created, but nothing happens | The operator is not running or has no RBAC; look at the operator logs |
| `unknown field "spec.foo"` or a field disappears | The field is not in the `openAPIV3Schema` (strict validation / pruning) |

## Summary

- Helm: `repo add/update`, `search repo`, `show values`, `install -n --create-namespace -f/--set`, `upgrade --install`, `list -A`, `history`, `rollback`, `uninstall`; a local `.tgz` is used just like `repo/chart`.
- Helm 4: `--rollback-on-failure` and `--force-replace` replace `--atomic` and `--force`, server-side apply is the default for new installs, `--wait` takes a strategy.
- `helm template` renders manifests without a release; `helm upgrade` without `--reuse-values` reverts to the chart defaults; a rollback creates a new revision.
- Kustomize: `resources`, `namespace`, `namePrefix`, `labels`, `images`, `replicas`, generators with a hash suffix, `patches` (strategic merge or JSON 6902 with `target`); `kubectl kustomize` to preview, `kubectl apply -k` to apply.
- Base + overlays: the overlay references the base through `resources: [../../base]` and adds its own changes.
- CRD: name `<plural>.<group>`, `scope`, `versions` (exactly one `storage`), a required structural `openAPIV3Schema`; deleting a CRD deletes all CRs; `kubectl explain` also works for CRs.
- Operator = CRD + controller with a reconcile loop; it is installed with a manifest or Helm and needs RBAC for its CRs, `/status`, the objects it manages, events and leases.
