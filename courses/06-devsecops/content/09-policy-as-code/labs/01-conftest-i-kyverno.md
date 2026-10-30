# Lab 1: Politike za Kubernetes manifeste

`k8s/deployment.yaml` kurs-shopa pokreće privilegovan kontejner sa cijelim fajl sistemom čvora (`hostPath: /`) i slikom `:latest`. Takav manifest ne smije proći pipeline, bez obzira na to šta kaže code review.

Napisaćeš pravila u **Regu** (Conftest), testove za njih, popraviti manifest i istu politiku izraziti kao **Kyverno** `ValidatingPolicy`.

```bash
cd /root/kurs-shop
cat k8s/deployment.yaml
ls /root/primjeri
conftest --version; opa version | head -1; kyverno version
```

<!-- setup
set -e
kurs-repo
mkdir -p /root/primjeri
cat > /root/primjeri/losi-privileged.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: a}
spec:
  selector: {matchLabels: {app: a}}
  template:
    metadata: {labels: {app: a}}
    spec:
      containers:
      - name: a
        image: registry.kurs-shop.ba/a:1.2.0
        securityContext: {privileged: true, runAsNonRoot: true}
EOF
cat > /root/primjeri/losi-hostpath.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: b}
spec:
  selector: {matchLabels: {app: b}}
  template:
    metadata: {labels: {app: b}}
    spec:
      containers:
      - name: b
        image: registry.kurs-shop.ba/b:2.0.1
        securityContext: {runAsNonRoot: true}
        volumeMounts: [{name: d, mountPath: /d}]
      volumes:
      - name: d
        hostPath: {path: /var/run/docker.sock}
EOF
cat > /root/primjeri/losi-latest.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: c}
spec:
  selector: {matchLabels: {app: c}}
  template:
    metadata: {labels: {app: c}}
    spec:
      containers:
      - name: c
        image: registry.kurs-shop.ba/c:latest
        securityContext: {runAsNonRoot: true}
EOF
cat > /root/primjeri/losi-bez-taga.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: d}
spec:
  selector: {matchLabels: {app: d}}
  template:
    metadata: {labels: {app: d}}
    spec:
      containers:
      - name: d
        image: registry.kurs-shop.ba/d
        securityContext: {runAsNonRoot: true}
EOF
cat > /root/primjeri/losi-root.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: e}
spec:
  selector: {matchLabels: {app: e}}
  template:
    metadata: {labels: {app: e}}
    spec:
      containers:
      - name: e
        image: registry.kurs-shop.ba/e:1.0.0
EOF
cat > /root/primjeri/dobar.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: ok}
spec:
  selector: {matchLabels: {app: ok}}
  template:
    metadata: {labels: {app: ok}}
    spec:
      securityContext: {runAsNonRoot: true}
      containers:
      - name: ok
        image: registry.kurs-shop.ba/ok@sha256:3b1c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c
        volumeMounts: [{name: tmp, mountPath: /tmp}]
      volumes:
      - name: tmp
        emptyDir: {}
EOF
-->

## Rego pravila sa Conftestom

U `/root/kurs-shop/policy/k8s.rego` (paket `main`, Rego v1 sintaksa) napiši `deny` pravila za Deployment:

1. kontejner sa `securityContext.privileged: true`,
2. bilo koji `hostPath` volumen,
3. slika sa tagom `:latest` **ili bez taga** (digest `@sha256:` je u redu),
4. kontejner koji ne radi kao non-root: `runAsNonRoot: true` mora biti postavljen na kontejneru **ili** na nivou Poda (`spec.template.spec.securityContext`).

Svaki loš primjer iz `/root/primjeri/losi-*.yaml` mora pasti, a `dobar.yaml` proći.

```bash
conftest test --policy policy /root/primjeri/
conftest test --policy policy k8s/deployment.yaml
```

<!-- verify
cd /root/kurs-shop
[ -f policy/k8s.rego ] || { echo "nema policy/k8s.rego"; exit 1; }
opa check --strict policy/ >/tmp/opa.txt 2>&1 || { cat /tmp/opa.txt | tail -8; echo "policy/ se ne parsira (Rego v1)"; exit 1; }
for f in /root/primjeri/losi-*.yaml; do
  conftest test --no-color --policy policy "$f" >/dev/null 2>&1 && { echo "$(basename $f) prolazi, a ne bi smio"; exit 1; }
done
conftest test --no-color --policy policy /root/primjeri/dobar.yaml >/tmp/ct.txt 2>&1 || { cat /tmp/ct.txt; echo "dobar.yaml ne prolazi (lažni pozitiv)"; exit 1; }
n=$(conftest test --no-color --policy policy -o json /opt/kurs/kurs-shop/k8s/deployment.yaml 2>/dev/null | jq '[.[].failures[]?] | length')
[ "${n:-0}" -ge 4 ] || { echo "originalni deployment.yaml daje $n poruka; očekivano barem 4 (privileged, hostPath, latest, non-root)"; exit 1; }
-->
<!-- hint
```rego
package main

deny contains msg if {
	input.kind == "Deployment"
	some c in input.spec.template.spec.containers
	c.securityContext.privileged == true
	msg := sprintf("kontejner %s je privilegovan", [c.name])
}

deny contains msg if {
	some v in input.spec.template.spec.volumes
	v.hostPath
	msg := sprintf("volumen %s koristi hostPath", [v.name])
}

lose_slika(img) if endswith(img, ":latest")
lose_slika(img) if {
	not contains(img, "@sha256:")
	parts := split(img, "/")
	not contains(parts[count(parts) - 1], ":")
}

non_root(c) if c.securityContext.runAsNonRoot == true
non_root(_) if input.spec.template.spec.securityContext.runAsNonRoot == true
```
Pravilo za non-root: `not non_root(c)`.
-->
<!-- solution
cd /root/kurs-shop
mkdir -p policy
cat > policy/k8s.rego <<'EOF'
package main

deny contains msg if {
	input.kind == "Deployment"
	some c in input.spec.template.spec.containers
	c.securityContext.privileged == true
	msg := sprintf("kontejner %s je privilegovan", [c.name])
}

deny contains msg if {
	input.kind == "Deployment"
	some v in input.spec.template.spec.volumes
	v.hostPath
	msg := sprintf("volumen %s koristi hostPath", [v.name])
}

deny contains msg if {
	input.kind == "Deployment"
	some c in input.spec.template.spec.containers
	lose_slika(c.image)
	msg := sprintf("slika %s nema fiksnu verziju (latest ili bez taga)", [c.image])
}

deny contains msg if {
	input.kind == "Deployment"
	some c in input.spec.template.spec.containers
	not non_root(c)
	msg := sprintf("kontejner %s nema runAsNonRoot: true", [c.name])
}

lose_slika(img) if endswith(img, ":latest")

lose_slika(img) if {
	not contains(img, "@sha256:")
	parts := split(img, "/")
	not contains(parts[count(parts) - 1], ":")
}

non_root(c) if c.securityContext.runAsNonRoot == true

non_root(_) if input.spec.template.spec.securityContext.runAsNonRoot == true
EOF
-->

## Testovi politike i popravljen manifest

1. Napiši `policy/k8s_test.rego` sa barem tri `test_` pravila (npr. da privilegovan kontejner daje poruku, a dobar Deployment ne daje nijednu). `conftest verify --policy policy` mora proći.
2. Popravi `k8s/deployment.yaml`: bez `privileged` i `hostPath`, `runAsNonRoot: true`, slika `registry.kurs-shop.ba/kurs-shop:1.4.2`. Ako aplikaciji treba upisiv direktorij, koristi `emptyDir`.
3. Dodaj job `policy` (faza `test`) koji pokreće `conftest verify --policy policy` i `conftest test --policy policy k8s/`. `gitlab-ci-local policy` mora proći.

<!-- verify
cd /root/kurs-shop
[ "$(grep -cE '^test_' policy/k8s_test.rego 2>/dev/null)" -ge 3 ] || { echo "policy/k8s_test.rego treba barem tri test_ pravila"; exit 1; }
conftest verify --no-color --policy policy >/tmp/cv.txt 2>&1 || { tail -10 /tmp/cv.txt; echo "conftest verify ne prolazi"; exit 1; }
conftest test --no-color --policy policy k8s/deployment.yaml >/tmp/ct.txt 2>&1 || { cat /tmp/ct.txt; echo "k8s/deployment.yaml i dalje krši politiku"; exit 1; }
[ "$(yq '.spec.template.spec.containers[0].image' k8s/deployment.yaml)" = "registry.kurs-shop.ba/kurs-shop:1.4.2" ] || { echo "slika treba biti registry.kurs-shop.ba/kurs-shop:1.4.2"; exit 1; }
[ "$(yq '.spec.replicas' k8s/deployment.yaml)" = "2" ] || { echo "ne mijenjaj broj replika"; exit 1; }
yq '.policy.script | join(" ")' .gitlab-ci.yml | grep -q 'conftest verify' || { echo "job policy ne pokreće conftest verify"; exit 1; }
yq '.policy.script | join(" ")' .gitlab-ci.yml | grep -q 'conftest test' || { echo "job policy ne pokreće conftest test"; exit 1; }
gitlab-ci-local policy > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job policy pada"; exit 1; }
-->
<!-- hint
```rego
package main

test_privileged_odbijen if {
	count(deny) > 0 with input as {"kind": "Deployment", "spec": {"template": {"spec": {
		"securityContext": {"runAsNonRoot": true},
		"containers": [{"name": "a", "image": "r/a:1", "securityContext": {"privileged": true}}]}}}}
}
```
`conftest verify` pokreće sva `test_` pravila iz direktorija politika.
-->
<!-- solution
cd /root/kurs-shop
cat > policy/k8s_test.rego <<'EOF'
package main

dobar := {"kind": "Deployment", "spec": {"template": {"spec": {
	"securityContext": {"runAsNonRoot": true},
	"containers": [{"name": "a", "image": "r/a:1.0"}],
}}}}

test_dobar_prolazi if {
	count(deny) == 0 with input as dobar
}

test_privileged_odbijen if {
	count(deny) > 0 with input as json.patch(dobar, [{"op": "add", "path": "/spec/template/spec/containers/0/securityContext", "value": {"privileged": true}}])
}

test_latest_odbijen if {
	count(deny) > 0 with input as json.patch(dobar, [{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value": "r/a:latest"}])
}

test_hostpath_odbijen if {
	count(deny) > 0 with input as json.patch(dobar, [{"op": "add", "path": "/spec/template/spec/volumes", "value": [{"name": "h", "hostPath": {"path": "/"}}]}])
}
EOF
cat > k8s/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kurs-shop
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kurs-shop
  template:
    metadata:
      labels:
        app: kurs-shop
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
      containers:
      - name: app
        image: registry.kurs-shop.ba/kurs-shop:1.4.2
        ports:
        - containerPort: 8080
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
EOF
yq -i '.policy = {"stage": "test", "script": ["conftest verify --policy policy", "conftest test --policy policy k8s/"]}' .gitlab-ci.yml
-->

## Ista pravila kao Kyverno politika

U klasteru isto pravilo provodi admission controller. Napiši `policy/kyverno/kurs-baseline.yaml`: **ValidatingPolicy** (`policies.kyverno.io/v1`) za Deploymente sa `validationActions: [Deny]` i CEL izrazima koji zabranjuju privilegovane kontejnere, `hostPath` volumene i tag `:latest`.

Provjeri je Kyverno CLI-jem nad primjerima:

```bash
kyverno apply policy/kyverno/kurs-baseline.yaml --resource /root/primjeri/losi-privileged.yaml
kyverno apply policy/kyverno/kurs-baseline.yaml --resource k8s/deployment.yaml
```

<!-- verify
cd /root/kurs-shop
f=policy/kyverno/kurs-baseline.yaml
[ -f $f ] || { echo "nema $f"; exit 1; }
[ "$(yq '.kind' $f)" = "ValidatingPolicy" ] || { echo "kind treba biti ValidatingPolicy"; exit 1; }
[ "$(yq '.apiVersion' $f)" = "policies.kyverno.io/v1" ] || { echo "apiVersion treba biti policies.kyverno.io/v1"; exit 1; }
for x in losi-privileged losi-hostpath losi-latest; do
  kyverno apply $f --resource /root/primjeri/$x.yaml >/tmp/ky.txt 2>&1 && { tail -5 /tmp/ky.txt; echo "$x.yaml prolazi Kyverno politiku"; exit 1; }
done
kyverno apply $f --resource /root/primjeri/dobar.yaml >/tmp/ky.txt 2>&1 || { tail -8 /tmp/ky.txt; echo "dobar.yaml ne prolazi Kyverno politiku"; exit 1; }
kyverno apply $f --resource k8s/deployment.yaml >/tmp/ky.txt 2>&1 || { tail -8 /tmp/ky.txt; echo "popravljen k8s/deployment.yaml ne prolazi Kyverno politiku"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: policies.kyverno.io/v1
kind: ValidatingPolicy
metadata:
  name: kurs-baseline
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
```
U CEL-u pristup polju koje ne postoji je greška, zato `has()`.
-->
<!-- solution
cd /root/kurs-shop
mkdir -p policy/kyverno
cat > policy/kyverno/kurs-baseline.yaml <<'EOF'
apiVersion: policies.kyverno.io/v1
kind: ValidatingPolicy
metadata:
  name: kurs-baseline
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
      message: "Tag :latest nije dozvoljen."
EOF
-->
