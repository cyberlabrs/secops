# Lab 2: Dozvoljeni registriji i potpisani artefakti

Dva pravila za produkciju:

1. Podovi u namespaceovima označenim sa `policy=strict` smiju koristiti samo slike iz odobrenog registrija `docker.io/library/`, navedene **punim imenom**, bez taga `latest`.
2. Manifesti za deploy moraju biti **potpisani**, a potpis se provjerava prije primjene.

Prvo pravilo provodi **ValidatingAdmissionPolicy** (CEL, ugrađen u Kubernetes), a drugo **cosign**.

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

Napravi:

1. **ValidatingAdmissionPolicy** `allowed-registries` za `CREATE` i `UPDATE` nad `pods`, sa CEL validacijom: svaki kontejner mora imati image koji počinje sa `docker.io/library/` i ne završava sa `:latest`. Poruka greške: `image mora biti iz docker.io/library i bez taga latest`.
2. **ValidatingAdmissionPolicyBinding** `allowed-registries-strict` sa `validationActions: [Deny]`, ograničen na namespaceove sa oznakom `policy=strict`.

```bash
kubectl -n shop run ok --image=docker.io/library/nginx:1.28
kubectl -n shop run los1 --image=nginx:1.28
kubectl -n shop run los2 --image=docker.io/library/nginx:latest
kubectl -n sandbox run slobodno --image=nginx:1.28
```

Prva i posljednja komanda moraju proći, a druge dvije biti odbijene.

<!-- verify
kubectl get validatingadmissionpolicy allowed-registries >/dev/null 2>&1 || { echo "ValidatingAdmissionPolicy allowed-registries ne postoji"; exit 1; }
kubectl get validatingadmissionpolicybinding allowed-registries-strict >/dev/null 2>&1 || { echo "binding allowed-registries-strict ne postoji"; exit 1; }
d() { kubectl -n $1 run vap-test --image=$2 --dry-run=server -o name >/dev/null 2>&1; }
d shop docker.io/library/nginx:1.28 || { echo "dozvoljena slika je odbijena u shop"; exit 1; }
d shop nginx:1.28 && { echo "kratko ime nginx:1.28 je dozvoljeno u shop"; exit 1; }
d shop docker.io/library/nginx:latest && { echo "tag latest je dozvoljen u shop"; exit 1; }
d shop quay.io/nesto/app:1.0 && { echo "slika iz drugog registrija je dozvoljena u shop"; exit 1; }
d sandbox nginx:1.28 || { echo "politika važi i u sandbox, a ne bi smjela"; exit 1; }
out=$(kubectl -n shop run vap-test --image=nginx:1.28 --dry-run=server 2>&1)
echo "$out" | grep -q 'docker.io/library' || { echo "poruka greške nije postavljena: $out"; exit 1; }
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

## Potpiši release manifest

Sa **cosign**-om napravi par ključeva u `/root/release/` (`cosign.key`, `cosign.pub`), sa lozinkom `kurs` (varijabla `COSIGN_PASSWORD`), i potpiši `/root/release/deploy.yaml`. Potpis sačuvaj u `/root/release/deploy.yaml.sig`.

Lab nema pristup javnom transparency logu (Rekor), pa upis u njega isključi (`--tlog-upload=false`).

```bash
cd /root/release
export COSIGN_PASSWORD=kurs
cosign generate-key-pair
cosign sign-blob --key cosign.key --tlog-upload=false --output-signature deploy.yaml.sig deploy.yaml
```

<!-- verify
cd /root/release 2>/dev/null || { echo "nema /root/release"; exit 1; }
[ -s cosign.pub ] && [ -s cosign.key ] && [ -s deploy.yaml.sig ] || { echo "nedostaje cosign.key, cosign.pub ili deploy.yaml.sig"; exit 1; }
cosign verify-blob --key cosign.pub --signature deploy.yaml.sig --insecure-ignore-tlog=true deploy.yaml >/dev/null 2>&1 || { echo "potpis ne odgovara deploy.yaml"; exit 1; }
-->
<!-- solution
cd /root/release
export COSIGN_PASSWORD=kurs
cosign generate-key-pair >/dev/null 2>&1
cosign sign-blob --yes --key cosign.key --tlog-upload=false --output-signature deploy.yaml.sig deploy.yaml >/dev/null 2>&1
-->

## Provjera potpisa prije deploya

Napravi skriptu `/root/release/deploy.sh`, koja **prvo provjeri potpis** (`cosign verify-blob` sa `cosign.pub`, `--insecure-ignore-tlog=true`) i tek ako je potpis ispravan radi `kubectl apply -f deploy.yaml`. Ako potpis ne valja, skripta mora izaći sa greškom i ništa ne primijeniti.

Pokreni je, tako da Deployment `shop` proradi u namespaceu `shop` (slika prolazi i tvoju admission politiku).

<!-- verify
s=/root/release/deploy.sh
[ -x $s ] || { echo "$s ne postoji ili nije izvršna"; exit 1; }
[ "$(kubectl -n shop get deploy shop -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "1" ] || { echo "Deployment shop ne radi (pokreni deploy.sh)"; exit 1; }
cp /root/release/deploy.yaml /tmp/deploy.yaml.bak
sed -i 's/replicas: 1/replicas: 5/' /root/release/deploy.yaml
(cd /root/release && $s) >/dev/null 2>&1; rc=$?
cp /tmp/deploy.yaml.bak /root/release/deploy.yaml
[ $rc -ne 0 ] || { echo "skripta je prihvatila izmijenjen manifest"; exit 1; }
[ "$(kubectl -n shop get deploy shop -o jsonpath='{.spec.replicas}')" = "1" ] || { echo "izmijenjen manifest je primijenjen"; kubectl -n shop scale deploy shop --replicas=1 >/dev/null; exit 1; }
-->
<!-- hint
```bash
#!/bin/bash
set -e
cd /root/release
cosign verify-blob --key cosign.pub --signature deploy.yaml.sig --insecure-ignore-tlog=true deploy.yaml
kubectl apply -f deploy.yaml
```
`set -e` prekida skriptu čim provjera potpisa vrati grešku.
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
