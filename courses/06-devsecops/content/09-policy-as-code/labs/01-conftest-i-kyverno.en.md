# Lab 1: Policies for Kubernetes manifests

kurs-shop's `k8s/deployment.yaml` runs a privileged container with the node's entire file system (`hostPath: /`) and an image tagged `:latest`. Such a manifest must not get through the pipeline, regardless of what code review says.

You will write rules in **Rego** (Conftest) and tests for them, fix the manifest and express the same policy as a **Kyverno** `ValidatingPolicy`.

The sample manifests are in `/root/primjeri` (examples): the `losi-*.yaml` files are bad Deployments (`losi` = bad; `bez-taga` = without a tag), and `dobar.yaml` is a good one.

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

## Rego rules with Conftest

In `/root/kurs-shop/policy/k8s.rego` (package `main`, Rego v1 syntax) write `deny` rules for a Deployment that catch:

1. a container with `securityContext.privileged: true`,
2. any `hostPath` volume,
3. an image with the `:latest` tag **or without a tag** (a `@sha256:` digest is fine),
4. a container that doesn't run as non-root: `runAsNonRoot: true` must be set on the container **or** at the Pod level (`spec.template.spec.securityContext`).

Every bad example from `/root/primjeri/losi-*.yaml` must fail, and `dobar.yaml` must pass.

```bash
conftest test --policy policy /root/primjeri/
conftest test --policy policy k8s/deployment.yaml
```

<!-- verify
cd /root/kurs-shop
[ -f policy/k8s.rego ] || { echo "policy/k8s.rego does not exist"; exit 1; }
opa check --strict policy/ >/tmp/opa.txt 2>&1 || { cat /tmp/opa.txt | tail -8; echo "policy/ does not parse (Rego v1)"; exit 1; }
for f in /root/primjeri/losi-*.yaml; do
  conftest test --no-color --policy policy "$f" >/dev/null 2>&1 && { echo "$(basename $f) passes, but it should not"; exit 1; }
done
conftest test --no-color --policy policy /root/primjeri/dobar.yaml >/tmp/ct.txt 2>&1 || { cat /tmp/ct.txt; echo "dobar.yaml does not pass (false positive)"; exit 1; }
n=$(conftest test --no-color --policy policy -o json /opt/kurs/kurs-shop/k8s/deployment.yaml 2>/dev/null | jq '[.[].failures[]?] | length')
[ "${n:-0}" -ge 4 ] || { echo "the original deployment.yaml produces $n messages; expected at least 4 (privileged, hostPath, latest, non-root)"; exit 1; }
-->
<!-- hint
```rego
package main

deny contains msg if {
	input.kind == "Deployment"
	some c in input.spec.template.spec.containers
	c.securityContext.privileged == true
	msg := sprintf("container %s is privileged", [c.name])
}

deny contains msg if {
	some v in input.spec.template.spec.volumes
	v.hostPath
	msg := sprintf("volume %s uses hostPath", [v.name])
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
The non-root rule: `not non_root(c)`.
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

## Policy tests and a fixed manifest

1. Write `policy/k8s_test.rego` with at least three `test_` rules (e.g. that a privileged container produces a message and a good Deployment produces none). `conftest verify --policy policy` must pass.
2. Fix `k8s/deployment.yaml`: no `privileged` and no `hostPath`, `runAsNonRoot: true`, image `registry.kurs-shop.ba/kurs-shop:1.4.2`. If the application needs a writable directory, use `emptyDir`.
3. Add a `policy` job (stage `test`) that runs `conftest verify --policy policy` and `conftest test --policy policy k8s/`. `gitlab-ci-local policy` must pass.

<!-- verify
cd /root/kurs-shop
[ "$(grep -cE '^test_' policy/k8s_test.rego 2>/dev/null)" -ge 3 ] || { echo "policy/k8s_test.rego needs at least three test_ rules"; exit 1; }
conftest verify --no-color --policy policy >/tmp/cv.txt 2>&1 || { tail -10 /tmp/cv.txt; echo "conftest verify does not pass"; exit 1; }
conftest test --no-color --policy policy k8s/deployment.yaml >/tmp/ct.txt 2>&1 || { cat /tmp/ct.txt; echo "k8s/deployment.yaml still violates the policy"; exit 1; }
[ "$(yq '.spec.template.spec.containers[0].image' k8s/deployment.yaml)" = "registry.kurs-shop.ba/kurs-shop:1.4.2" ] || { echo "the image must be registry.kurs-shop.ba/kurs-shop:1.4.2"; exit 1; }
[ "$(yq '.spec.replicas' k8s/deployment.yaml)" = "2" ] || { echo "do not change the number of replicas"; exit 1; }
yq '.policy.script | join(" ")' .gitlab-ci.yml | grep -q 'conftest verify' || { echo "the policy job does not run conftest verify"; exit 1; }
yq '.policy.script | join(" ")' .gitlab-ci.yml | grep -q 'conftest test' || { echo "the policy job does not run conftest test"; exit 1; }
gitlab-ci-local policy > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the policy job fails"; exit 1; }
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
`conftest verify` runs all `test_` rules from the policy directory.
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

## The same rules as a Kyverno policy

In the cluster the same rule is enforced by an admission controller. Write `policy/kyverno/kurs-baseline.yaml`: a **ValidatingPolicy** (`policies.kyverno.io/v1`) for Deployments with `validationActions: [Deny]` and CEL expressions that forbid privileged containers, `hostPath` volumes and the `:latest` tag.

Check it with the Kyverno CLI against the examples:

```bash
kyverno apply policy/kyverno/kurs-baseline.yaml --resource /root/primjeri/losi-privileged.yaml
kyverno apply policy/kyverno/kurs-baseline.yaml --resource k8s/deployment.yaml
```

<!-- verify
cd /root/kurs-shop
f=policy/kyverno/kurs-baseline.yaml
[ -f $f ] || { echo "$f does not exist"; exit 1; }
[ "$(yq '.kind' $f)" = "ValidatingPolicy" ] || { echo "kind must be ValidatingPolicy"; exit 1; }
[ "$(yq '.apiVersion' $f)" = "policies.kyverno.io/v1" ] || { echo "apiVersion must be policies.kyverno.io/v1"; exit 1; }
for x in losi-privileged losi-hostpath losi-latest; do
  kyverno apply $f --resource /root/primjeri/$x.yaml >/tmp/ky.txt 2>&1 && { tail -5 /tmp/ky.txt; echo "$x.yaml passes the Kyverno policy"; exit 1; }
done
kyverno apply $f --resource /root/primjeri/dobar.yaml >/tmp/ky.txt 2>&1 || { tail -8 /tmp/ky.txt; echo "dobar.yaml does not pass the Kyverno policy"; exit 1; }
kyverno apply $f --resource k8s/deployment.yaml >/tmp/ky.txt 2>&1 || { tail -8 /tmp/ky.txt; echo "the fixed k8s/deployment.yaml does not pass the Kyverno policy"; exit 1; }
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
      message: "Privileged containers are not allowed."
```
In CEL, accessing a field that doesn't exist is an error, hence `has()`.
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
