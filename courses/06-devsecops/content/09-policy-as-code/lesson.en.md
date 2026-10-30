## What this module covers

Objective **4.4**: **policy as code** with OPA/Rego and Conftest, Kyverno policies and the Kyverno CLI.

Where the control sits in the pipeline: in two places, with the same rules.

1. **In the pipeline** (Conftest, `kyverno apply`): on manifests, Helm output or a Terraform plan, in the MR, before anything reaches the cluster.
2. **In the cluster** (Kyverno or OPA Gatekeeper as an **admission controller**): the last line of defense for everything that bypasses the pipeline (`kubectl apply` from a laptop, an operator that creates resources).

The threat it prevents: configuration that is technically valid but violates the organization's rules. `k8s/deployment.yaml` in the repo is a perfect example: a privileged container, `hostPath: /` (the node's entire disk) and an image tagged `:latest`. Kubernetes will happily run it. A policy must not allow it.

The difference from modules 07 and 08: there you use **someone else's** rules (the built-in checks of Checkov and Trivy). Here you write **your own** rules, version them, test them and enforce them the same way in CI and in the cluster.

## Rego in OPA 1.x

**OPA** (Open Policy Agent) is a general-purpose policy engine; its language is **Rego**. Since version 1.0 the default is **Rego v1** syntax:

- every rule body must have `if`,
- rules that build a set (multi-value) must have `contains`,
- the keywords `in`, `every`, `contains`, `if` work without any import; `import rego.v1` is no longer needed (it may stay, for compatibility with older tools),
- `import future.keywords...` is redundant.

The old (v0) syntax fails in OPA 1.x already at parse time:

```rego
# v0: OPA 1.x rejects this (missing `contains` and `if`)
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

For migrating old policies there is `--v0-compatible` (OPA commands accept the old syntax), `opa fmt --v0-v1` (rewrites a v0 policy into a form that works in both versions) and, in Conftest, `--rego-version v0`. Since version 0.60 Conftest uses v1 by default.

The most common constructs:

```rego
package main

# iteration: `some ... in`
deny contains msg if {
	some c in input.spec.template.spec.containers
	c.securityContext.privileged == true
	msg := sprintf("Container %s is privileged", [c.name])
}

# universal quantifier: `every`
all_pinned if {
	every c in input.spec.template.spec.containers {
		contains(c.image, "@sha256:")
	}
}
```

A key property of Rego: if any expression in the body is not true **or a field does not exist**, the rule simply does not hold (there is no error). That is why `c.securityContext.privileged == true` does not blow up for a container without a `securityContext`; it just produces no message. The same applies in reverse, and that is where people make mistakes: a "must exist" check is written with `not`, e.g. `not c.securityContext.runAsNonRoot`.

### OPA CLI

```bash
opa fmt -w policy/                       # formatting (like gofmt)
opa check --strict policy/               # parsing and stricter checks
opa test policy/ -v                      # unit tests (test_* rules)
opa eval -d policy/ -i k8s/deployment.yaml "data.main.deny"
```

In the pipeline you need the OPA CLI for `opa test` and `opa check`; the evaluation over files itself is done by Conftest.

## Conftest

**Conftest** is a CLI around OPA built for configuration files. It parses YAML, JSON, HCL2, Dockerfile, TOML, INI and other formats into `input` itself, so you only write the rules.

Conventions:

- policies live in the `policy/` directory (or `--policy <dir>`),
- the default package is `main` (others with `--namespace`, all of them with `--all-namespaces`),
- Conftest looks for the rules `deny`, `violation` and `warn`, and their suffixed variants (`deny_privileged`, `warn_resources`),
- `deny`/`violation` → **FAIL** (exit 1), `warn` → **WARN** (exit 0, unless `--fail-on-warn` is used).

### Policies for `k8s/deployment.yaml`

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
	msg := sprintf("%s: container %s is privileged", [input.metadata.name, c.name])
}

deny_hostpath contains msg if {
	input.kind in workload_kinds
	some v in input.spec.template.spec.volumes
	v.hostPath
	msg := sprintf("%s: volume %s mounts hostPath %s", [input.metadata.name, v.name, v.hostPath.path])
}

deny_latest contains msg if {
	some c in containers
	endswith(c.image, ":latest")
	msg := sprintf("%s: image %s uses the :latest tag", [input.metadata.name, c.image])
}

deny_registry contains msg if {
	some c in containers
	not registry_allowed(c.image)
	msg := sprintf("%s: image %s is not from an allowed registry", [input.metadata.name, c.image])
}

registry_allowed(img) if {
	some prefix in data.allowed_registries
	startswith(img, prefix)
}

warn_limits contains msg if {
	some c in containers
	not c.resources.limits.memory
	msg := sprintf("%s: container %s has no memory limit", [input.metadata.name, c.name])
}
```

You don't hardcode the list of allowed registries in the policy; you provide it as data:

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
WARN - k8s/deployment.yaml - main - kurs-shop: container app has no memory limit
FAIL - k8s/deployment.yaml - main - kurs-shop: container app is privileged
FAIL - k8s/deployment.yaml - main - kurs-shop: volume host mounts hostPath /
FAIL - k8s/deployment.yaml - main - kurs-shop: image registry.kurs-shop.ba/kurs-shop:latest uses the :latest tag
```

Useful flags:

| Flag | What it does |
|---|---|
| `-p`, `--policy policy/` | where the policies are (default `policy`) |
| `--namespace terraform` | which Rego package is evaluated (default `main`) |
| `--all-namespaces` | all packages from the policy directory |
| `--data data/` | extra JSON/YAML data available as `data.*` |
| `--fail-on-warn` | warnings also break the build (exit 1 for warn, 2 for fail) |
| `-o json`, `-o junit`, `-o sarif`, `-o github`, `-o table` | output format |
| `--parser hcl2` | force a parser when the extension doesn't match |
| `--combine` | all files into one `input` (e.g. "every Deployment has a Service") |

### Exceptions in Conftest

This is why rules have suffixes: an exception is tied to the rule suffix. Example: `node-exporter` legitimately needs `hostPath` for `/proc` and `/sys`.

```rego
# policy/exceptions.rego
package main

exception contains rules if {
	input.kind == "DaemonSet"
	input.metadata.name == "node-exporter"
	rules := ["hostpath"]   # disables deny_hostpath (and violation_hostpath), nothing else
}
```

The exception is counted separately in the output (`... 1 exception`), so it is visible. Conftest has no built-in expiry date, but you can express one in Rego: add the condition `time.now_ns() < time.parse_rfc3339_ns("2026-12-31T00:00:00Z")` and the exception stops applying on its own.

> **In practice:** An empty string in `rules` (`rules := [""]`) disables **all** rules named just `deny`. So don't put everything into a single `deny`: give each rule a name (`deny_privileged`, `deny_hostpath`). That way an exception disables exactly one control, not all of them.

### Testing policies: `conftest verify`

A policy without tests is code without tests: the first change breaks it, and nobody notices because the pipeline turns green.

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
# or directly with OPA:
opa test policy/ -v
```

Test rules start with `test_`. `with input as ...` and `with data.x as ...` substitute input and data for that expression only.

### Conftest on a Terraform plan

The same approach works for Terraform too, as a complement to Checkov from module 07 when you need a company-specific rule. The plan in JSON has a stable structure (`resource_changes[].change.after`):

```rego
# policy/terraform/rds.rego
package terraform

deny_public_rds contains msg if {
	some rc in input.resource_changes
	rc.type == "aws_db_instance"
	rc.change.after.publicly_accessible == true
	msg := sprintf("%s: RDS must not be publicly accessible", [rc.address])
}
```

```bash
terraform show -json tfplan > tfplan.json
conftest test tfplan.json --policy policy/terraform --namespace terraform
```

> **In practice:** Introduce new rules as `warn_...` first. After two weeks look at how many repos are affected, send the teams instructions, then rename them to `deny_...`. A rule that breaks 40 pipelines overnight gets an exception for everyone, not fixes.

## Kyverno

**Kyverno** is a Kubernetes-native policy engine: policies are Kubernetes resources (YAML), with no new language. In the cluster it runs as an admission webhook; in the pipeline the same files run through the **Kyverno CLI**.

### State of things in 1.19: ClusterPolicy vs CEL policies

| | `ClusterPolicy` / `Policy` (`kyverno.io/v1`) | `ValidatingPolicy` and related (`policies.kyverno.io`) |
|---|---|---|
| Language | YAML patterns (`pattern`, anchors), JMESPath | **CEL** expressions (like Kubernetes ValidatingAdmissionPolicy) |
| Status in 1.19 | **deprecated**, removal announced for 1.20 | the recommended path, full feature parity |
| Validation | `validate` rule | `ValidatingPolicy` |
| Image signatures | `verifyImages` rule | `ImageValidatingPolicy` |
| Mutation / generation | `mutate` / `generate` | `MutatingPolicy` / `GeneratingPolicy` |

There are plenty of existing `ClusterPolicy` resources (including in the Kyverno policy library), so you need to be able to read them. Write new policies as `ValidatingPolicy`.

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
      message: "Privileged containers are not allowed."
    - expression: >-
        !has(object.spec.template.spec.volumes) ||
        object.spec.template.spec.volumes.all(v, !has(v.hostPath))
      message: "hostPath volumes are not allowed."
    - expression: >-
        object.spec.template.spec.containers.all(c, !c.image.endsWith(':latest'))
      message: "The :latest tag is not allowed; use a version or a digest."
```

- `validationActions`: `Deny` rejects the resource, `Audit` only records it in a policy report. In the cluster you introduce a new policy with `[Audit]`, while in the pipeline you treat it as a gate right away.
- `has()` is mandatory for optional fields: in CEL, accessing a non-existent field is an error, not "false" as in Rego.
- Here the policy targets Deployments because the pipeline scans manifests from the repo. In the cluster also add `pods` (or equivalent rules for the other controllers), so the restriction can't be bypassed with a bare Pod.

### The same policy as a ClusterPolicy (old format)

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
        message: "Privileged containers are not allowed."
        pattern:
          spec:
            containers:
              - =(securityContext):
                  =(privileged): "false"
```

`=(field)` is an **equality anchor**: "if the field exists, it must have this value". For rules on Pods, Kyverno automatically generates (**autogen**) rules for Deployment, StatefulSet, Job and the other controllers; in the report they show up as `autogen-no-privileged`. `failureAction: Enforce` in the rule replaced the old `spec.validationFailureAction`.

### `kyverno apply`

```bash
kyverno apply policies/kyverno/ --resource k8s/deployment.yaml
kyverno apply policies/kyverno/deployment-baseline.yaml -r k8s/ --table
kyverno apply policies/kyverno/ -r k8s/ --policy-report     # output as a PolicyReport
kyverno apply policies/kyverno/ -r k8s/ --audit-warn        # Audit policies as warnings
```

```text
Applying 1 policy rule(s) to 1 resource(s)...
policy kurs-deployment-baseline -> resource shop/Deployment/kurs-shop failed:
1 -  Privileged containers are not allowed.

pass: 0, fail: 1, warn: 0, error: 0, skip: 0
```

Policies are positional arguments (a file or a directory); resources go through `--resource`/`-r`. A `ValidatingPolicy` reports the message of the first validation that fails; once the developer fixes the privileged container, the next run shows `hostPath`. For a `ClusterPolicy`, the 1.19 CLI also prints a warning that the type is deprecated. If any resource fails, the command returns a non-zero exit code, which is enough for a gate. `--audit-warn` is useful when the same policies run in Audit mode in the cluster: in the pipeline you see them as warnings, not as a failure.

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
  - resources.yaml          # one valid and one bad Deployment
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

For a `ClusterPolicy` you also specify `rule` in `results` (e.g. `rule: autogen-no-privileged` for a Deployment); a `ValidatingPolicy` has no named rules, so you use `isValidatingPolicy: true`. The possible results are `pass`, `fail`, `skip` and `warn`. The test fails if the actual result differs from the expected one, in either direction.

### Image signatures in the cluster (a preview of module 10)

Signature verification at admission is done by an `ImageValidatingPolicy` (in the old format, the `verifyImages` rule):

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
      message: "The image is not signed with the kurs-shop pipeline key."
```

This only makes sense in the cluster (it needs access to the registry and the signatures). In the pipeline you verify the signature directly with `cosign verify` before deploying.

## Conftest or Kyverno?

| | Conftest (OPA/Rego) | Kyverno |
|---|---|---|
| Language | Rego | YAML (`pattern`) or CEL |
| What it checks | any structured file: K8s, Terraform plan, Dockerfile, CI YAML, JSON | primarily Kubernetes resources (CEL policies also a JSON payload) |
| In the cluster | via OPA Gatekeeper (different policies: `ConstraintTemplate`) | the same policy file as in the CLI |
| Tests | `conftest verify` / `opa test` (Rego tests) | `kyverno test` (`kyverno-test.yaml`) |
| Exceptions | `exception` rules by suffix | `PolicyException` resource, `exclude` in the policy |
| Learning curve | Rego takes time | YAML/CEL familiar to Kubernetes teams |
| Resource mutation and generation | no | yes |

Rule of thumb: if the target is Kubernetes and you want **one** policy for both the pipeline and the cluster, Kyverno is less work. If you also check Terraform, Dockerfiles and CI configuration, Conftest covers everything with one language. Many organizations use both: Conftest for "everything that isn't Kubernetes", Kyverno for the cluster.

> **In practice:** A policy that exists only in the cluster catches the problem only at deploy time, when the developer has already forgotten the change. A policy that exists only in the pipeline doesn't protect against `kubectl apply` from a laptop. The same policy in both places (the Kyverno file in CI via `kyverno apply`, the same file in the cluster) gives both fast feedback and a guarantee.

## Policies in the pipeline

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

The order in both jobs is the same: **policy tests first, then enforcement**. If someone broke a policy, the pipeline fails at `verify`/`test` with a clear message, instead of the policy silently letting everything through. GitLab shows the JUnit report in the MR as a list of failed "tests", which is more familiar to developers than a raw log.

Running it in the lab:

```bash
cd /root/kurs-shop
gitlab-ci-local policy-conftest
gitlab-ci-local policy-kyverno
```

### Central policies

Policies must not live only in the application repo, because the team can delete a rule that bothers them with a single commit. Keep them in a separate project and include a pinned version:

```yaml
include:
  - project: security/policies
    ref: v1.4.0
    file: templates/policy-jobs.yml
```

The template clones (or downloads as an artifact) the policy directory of the same version. Policy changes go through security team review and have their own pipeline with `conftest verify` and `kyverno test`. The application repo may contain only **exceptions**, and only in a file for which CODEOWNERS requires approval from the security team.

> **In practice:** A policy message is a user interface. "deny_hostpath" says nothing; "volume host mounts hostPath / — use emptyDir or a PVC, request an exception in #sec-help" cuts the number of questions in half. Make every `msg` say what is wrong, where, and what to do.

## Summary

- Policy as code: the organization's own rules, versioned and tested, enforced in the pipeline (Conftest, `kyverno apply`) and in the cluster (Kyverno, Gatekeeper).
- OPA 1.x uses Rego v1: `deny contains msg if { ... }`, `some x in`, `every`; `import rego.v1` is not needed; v0 syntax (`deny[msg] { }`) doesn't parse without a compatibility mode (`--v0-compatible`, in Conftest `--rego-version v0`).
- Conftest: policies in `policy/`, package `main` (`--namespace`, `--all-namespaces`), `deny`/`violation`/`warn` rules with suffixes, `--data` for lists, `--fail-on-warn`, `-o junit|sarif|json`.
- Exceptions in Conftest go through `exception contains rules if { ... rules := ["suffix"] }`; that's why you name rules (`deny_hostpath`) instead of putting everything into one `deny`.
- Tests: `conftest verify` / `opa test` (`test_*` rules, `with input as`); `kyverno test` with `kyverno-test.yaml` (`isValidatingPolicy: true` for CEL policies, `rule` for ClusterPolicy).
- Kyverno 1.19: `ClusterPolicy` is deprecated (removal in 1.20); new policies are `ValidatingPolicy` (CEL, `validationActions: [Deny|Audit]`) and `ImageValidatingPolicy` for signatures.
- In the pipeline: policy tests first, then enforcement; policies in a central repo included at a pinned version.
