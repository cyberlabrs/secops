# Lab 2: Allowed registries and signed artifacts

Two rules for production:

1. Pods in namespaces labeled `policy=strict` may only use images from the approved registry `docker.io/library/`, specified by their **full name**, without the `latest` tag.
2. Deployment manifests must be **signed**, and the signature is verified before they are applied.

The first rule is enforced by a **ValidatingAdmissionPolicy** (CEL, built into Kubernetes), and the second by **cosign**.

<!-- setup
set -e
cluster-up
kubectl create ns shop >/dev/null
kubectl label ns shop policy=strict >/dev/null
kubectl create ns sandbox >/dev/null
mkdir -p /root/release
cat > /root/release/deploy.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata: {name: shop, namespace: shop}
spec:
  replicas: 1
  selector: {matchLabels: {app: shop}}
  template:
    metadata: {labels: {app: shop}}
    spec:
      containers:
      - name: shop
        image: docker.io/library/nginx:1.28
EOF
-->

## ValidatingAdmissionPolicy

Create:

1. A **ValidatingAdmissionPolicy** `allowed-registries` for `CREATE` and `UPDATE` on `pods`, with a CEL validation: every container must have an image that starts with `docker.io/library/` and doesn't end with `:latest`. Error message: `image must be from docker.io/library and without the latest tag`.
2. A **ValidatingAdmissionPolicyBinding** `allowed-registries-strict` with `validationActions: [Deny]`, limited to namespaces labeled `policy=strict`.

```bash
kubectl -n shop run ok --image=docker.io/library/nginx:1.28
kubectl -n shop run los1 --image=nginx:1.28
kubectl -n shop run los2 --image=docker.io/library/nginx:latest
kubectl -n sandbox run slobodno --image=nginx:1.28
```

The first and last commands must succeed, and the other two must be rejected.

<!-- verify
kubectl get validatingadmissionpolicy allowed-registries >/dev/null 2>&1 || { echo "the ValidatingAdmissionPolicy allowed-registries does not exist"; exit 1; }
kubectl get validatingadmissionpolicybinding allowed-registries-strict >/dev/null 2>&1 || { echo "the binding allowed-registries-strict does not exist"; exit 1; }
d() { kubectl -n $1 run vap-test --image=$2 --dry-run=server -o name >/dev/null 2>&1; }
d shop docker.io/library/nginx:1.28 || { echo "an allowed image was rejected in shop"; exit 1; }
d shop nginx:1.28 && { echo "the short name nginx:1.28 is allowed in shop"; exit 1; }
d shop docker.io/library/nginx:latest && { echo "the latest tag is allowed in shop"; exit 1; }
d shop quay.io/nesto/app:1.0 && { echo "an image from another registry is allowed in shop"; exit 1; }
d sandbox nginx:1.28 || { echo "the policy also applies in sandbox, but it should not"; exit 1; }
out=$(kubectl -n shop run vap-test --image=nginx:1.28 --dry-run=server 2>&1)
echo "$out" | grep -q 'docker.io/library' || { echo "the error message is not set: $out"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: allowed-registries}
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["pods"]
  validations:
  - expression: "object.spec.containers.all(c, c.image.startsWith('docker.io/library/') && !c.image.endsWith(':latest'))"
    message: "image must be from docker.io/library and without the latest tag"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: {name: allowed-registries-strict}
spec:
  policyName: allowed-registries
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels: {policy: strict}
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: allowed-registries}
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["pods"]
  validations:
  - expression: "object.spec.containers.all(c, c.image.startsWith('docker.io/library/') && !c.image.endsWith(':latest'))"
    message: "image mora biti iz docker.io/library i bez taga latest"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: {name: allowed-registries-strict}
spec:
  policyName: allowed-registries
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels: {policy: strict}
EOF
sleep 3
-->

## Sign the release manifest

With **cosign**, create a key pair in `/root/release/` (`cosign.key`, `cosign.pub`) with the password `kurs` (the `COSIGN_PASSWORD` variable), and sign `/root/release/deploy.yaml`. Save the signature to `/root/release/deploy.yaml.sig`.

The lab has no access to the public transparency log (Rekor), so disable uploading to it (`--tlog-upload=false`).

```bash
cd /root/release
export COSIGN_PASSWORD=kurs
cosign generate-key-pair
cosign sign-blob --key cosign.key --tlog-upload=false --output-signature deploy.yaml.sig deploy.yaml
```

<!-- verify
cd /root/release 2>/dev/null || { echo "/root/release does not exist"; exit 1; }
[ -s cosign.pub ] && [ -s cosign.key ] && [ -s deploy.yaml.sig ] || { echo "cosign.key, cosign.pub or deploy.yaml.sig is missing"; exit 1; }
cosign verify-blob --key cosign.pub --signature deploy.yaml.sig --insecure-ignore-tlog=true deploy.yaml >/dev/null 2>&1 || { echo "the signature does not match deploy.yaml"; exit 1; }
-->
<!-- solution
cd /root/release
export COSIGN_PASSWORD=kurs
cosign generate-key-pair >/dev/null 2>&1
cosign sign-blob --yes --key cosign.key --tlog-upload=false --output-signature deploy.yaml.sig deploy.yaml >/dev/null 2>&1
-->

## Verify the signature before deploying

Create a script `/root/release/deploy.sh` that **first verifies the signature** (`cosign verify-blob` with `cosign.pub`, `--insecure-ignore-tlog=true`) and only if the signature is valid runs `kubectl apply -f deploy.yaml`. If the signature is invalid, the script must exit with an error and apply nothing.

Run it so that the Deployment `shop` is up and running in the `shop` namespace (the image also passes your admission policy).

<!-- verify
s=/root/release/deploy.sh
[ -x $s ] || { echo "$s does not exist or is not executable"; exit 1; }
[ "$(kubectl -n shop get deploy shop -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "1" ] || { echo "the Deployment shop is not running (run deploy.sh)"; exit 1; }
cp /root/release/deploy.yaml /tmp/deploy.yaml.bak
sed -i 's/replicas: 1/replicas: 5/' /root/release/deploy.yaml
(cd /root/release && $s) >/dev/null 2>&1; rc=$?
cp /tmp/deploy.yaml.bak /root/release/deploy.yaml
[ $rc -ne 0 ] || { echo "the script accepted a modified manifest"; exit 1; }
[ "$(kubectl -n shop get deploy shop -o jsonpath='{.spec.replicas}')" = "1" ] || { echo "the modified manifest was applied"; kubectl -n shop scale deploy shop --replicas=1 >/dev/null; exit 1; }
-->
<!-- hint
```bash
#!/bin/bash
set -e
cd /root/release
cosign verify-blob --key cosign.pub --signature deploy.yaml.sig --insecure-ignore-tlog=true deploy.yaml
kubectl apply -f deploy.yaml
```
`set -e` stops the script as soon as the signature verification returns an error.
-->
<!-- solution
cat > /root/release/deploy.sh <<'EOF'
#!/bin/bash
set -e
cd /root/release
cosign verify-blob --key cosign.pub --signature deploy.yaml.sig --insecure-ignore-tlog=true deploy.yaml
kubectl apply -f deploy.yaml
EOF
chmod +x /root/release/deploy.sh
/root/release/deploy.sh >/dev/null 2>&1
kubectl -n shop rollout status deploy/shop --timeout=120s
-->
