# Lab 2: Signature, provenance and verification before deploy

A registry doesn't guarantee that an image went through the pipeline: anyone with push rights can put anything under the `1.1` tag. That's why the pipeline **signs** the image (cosign), publishes **attestations** alongside it (SBOM and SLSA provenance), and the deploy only accepts an image whose signature and provenance have been verified.

The lab has no access to the public Sigstore (Fulcio, Rekor), so you use a key pair with the transparency log disabled:

- signing: `--use-signing-config=false --tlog-upload=false`,
- verification: `--insecure-ignore-tlog=true`.

In a real pipeline you would use keyless signing with the job's OIDC identity.

```bash
cosign version | tail -4
crane ls --insecure 127.0.0.1:5000/kurs-shop
```

<!-- setup
set -e
kurs-repo
kurs-build 127.0.0.1:5000/python:3.9-slim 127.0.0.1:5000/kurs-shop:1.0 /root/kurs-shop >/dev/null
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532 >/dev/null
-->

## Key and signature

1. Create a key pair in `/root/keys/` (`cosign generate-key-pair`; password from `COSIGN_PASSWORD`). The key must not be in the repo: in a real GitLab it is a masked/protected variable of type File or, better, a KMS key (`--key awskms://…`).
2. Sign the `kurs-shop:1.1` image **by digest**, not by tag.
3. Verify the signature with the public key.

```bash
export COSIGN_PASSWORD=kurs
mkdir -p /root/keys && cd /root/keys && cosign generate-key-pair
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
cosign sign --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y "$IMG"
cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true "$IMG" | jq .
```

<!-- verify
[ -f /root/keys/cosign.key ] && [ -f /root/keys/cosign.pub ] || { echo "no key pair in /root/keys"; exit 1; }
find /root/kurs-shop -name 'cosign.key' | grep -q . && { echo "the private key must not be in the repo"; exit 1; }
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
out=$(cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true "$IMG" 2>/dev/null) || { echo "kurs-shop:1.1 is not signed with the key /root/keys/cosign.key"; exit 1; }
echo "$out" | jq -e '.[] | select(.critical.type == "cosign container image signature" or .critical.type == "https://sigstore.dev/cosign/sign/v1")' >/dev/null 2>&1 || { echo "no image signature (only attestations?)"; exit 1; }
echo "$out" | jq -e '.[0].critical.identity["docker-reference"] | test("kurs-shop")' >/dev/null || { echo "the signature is not for kurs-shop"; exit 1; }
cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true 127.0.0.1:5000/kurs-shop:1.0 >/dev/null 2>&1 && { echo "1.0 is signed too: sign only 1.1"; exit 1; }
exit 0
-->
<!-- hint
The signature is bound to the image **digest**. A tag is a pointer that can move, which is why the deploy is also done by digest (`name@sha256:…`).
-->
<!-- solution
export COSIGN_PASSWORD=kurs
mkdir -p /root/keys && cd /root/keys && cosign generate-key-pair >/dev/null 2>&1
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
cosign sign --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y "$IMG" >/dev/null 2>&1
-->

## Attestations: SBOM and SLSA provenance

Alongside the signed image, publish two attestations (in-toto, signed with the same key):

1. **SBOM**: a CycloneDX SBOM of the image (`syft`), type `cyclonedx`.
2. **SLSA provenance** v1, type `slsaprovenance1`: create the predicate `/root/provenance.json` containing:
   - `buildDefinition.buildType`: `https://gitlab.kurs-shop.ba/ci/kurs-build@v1`,
   - `buildDefinition.resolvedDependencies`: the git repo with `digest.gitCommit` equal to the current commit (`git -C /root/kurs-shop rev-parse HEAD`),
   - `runDetails.builder.id`: `https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7`.

```bash
cosign attest --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y \
  --type slsaprovenance1 --predicate /root/provenance.json "$IMG"
cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true --type slsaprovenance1 "$IMG" \
  | jq -r .payload | base64 -d | jq .predicate
```

<!-- verify
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
p=$(cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true --type slsaprovenance1 "$IMG" 2>/dev/null | jq -r '.payload' | head -1 | base64 -d 2>/dev/null) || true
[ -n "$p" ] || { echo "no verifiable slsaprovenance1 attestation for kurs-shop:1.1"; exit 1; }
echo "$p" | jq -e '.predicateType == "https://slsa.dev/provenance/v1"' >/dev/null || { echo "predicateType is not SLSA provenance v1"; exit 1; }
echo "$p" | jq -e '.predicate.runDetails.builder.id == "https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"' >/dev/null || { echo "builder.id is not correct"; exit 1; }
echo "$p" | jq -e '.predicate.buildDefinition.buildType == "https://gitlab.kurs-shop.ba/ci/kurs-build@v1"' >/dev/null || { echo "buildType is not correct"; exit 1; }
c=$(git -C /root/kurs-shop rev-parse HEAD)
echo "$p" | jq -e --arg c "$c" '[.predicate.buildDefinition.resolvedDependencies[]?.digest.gitCommit] | index($c)' >/dev/null || { echo "resolvedDependencies has no gitCommit of the current commit"; exit 1; }
s=$(cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true --type cyclonedx "$IMG" 2>/dev/null | jq -r '.payload' | head -1 | base64 -d 2>/dev/null)
echo "$s" | jq -e '.predicate.bomFormat == "CycloneDX" and (.predicate.components | length > 50)' >/dev/null 2>&1 || { echo "no CycloneDX SBOM attestation for the image"; exit 1; }
-->
<!-- hint
```json
{
  "buildDefinition": {
    "buildType": "https://gitlab.kurs-shop.ba/ci/kurs-build@v1",
    "externalParameters": {"ref": "main"},
    "resolvedDependencies": [
      {"uri": "git+https://gitlab.kurs-shop.ba/shop/kurs-shop.git", "digest": {"gitCommit": "<sha>"}}
    ]
  },
  "runDetails": {
    "builder": {"id": "https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"},
    "metadata": {"invocationId": "1024"}
  }
}
```
SBOM: `syft scan registry:$IMG -o cyclonedx-json=/root/sbom.cdx.json`, then `cosign attest … --type cyclonedx --predicate /root/sbom.cdx.json`.
-->
<!-- solution
export COSIGN_PASSWORD=kurs
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
c=$(git -C /root/kurs-shop rev-parse HEAD)
jq -n --arg c "$c" '{buildDefinition: {buildType: "https://gitlab.kurs-shop.ba/ci/kurs-build@v1", externalParameters: {ref: "main"}, resolvedDependencies: [{uri: "git+https://gitlab.kurs-shop.ba/shop/kurs-shop.git", digest: {gitCommit: $c}}]}, runDetails: {builder: {id: "https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"}, metadata: {invocationId: "1024"}}}' > /root/provenance.json
cosign attest --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y --type slsaprovenance1 --predicate /root/provenance.json "$IMG" >/dev/null 2>&1
syft scan registry:$IMG -q -o cyclonedx-json=/root/sbom.cdx.json
cosign attest --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y --type cyclonedx --predicate /root/sbom.cdx.json "$IMG" >/dev/null 2>&1
-->

## Verification before deploy

Write `/root/kurs-shop/ci/deploy-gate.sh <image>` that returns 0 and prints `DEPLOY OK` **only** if:

1. the image is given by digest (`…@sha256:…`),
2. it has a signature verifiable with the key `/root/keys/cosign.pub`,
3. it has a `slsaprovenance1` attestation with the same key, with `builder.id` `https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7`.

Otherwise it returns a non-zero exit code. Test it on `kurs-shop:1.1` (by digest), on `kurs-shop:1.0` and on the tag `kurs-shop:1.1`.

<!-- verify
g=/root/kurs-shop/ci/deploy-gate.sh
[ -x $g ] || { echo "$g does not exist or is not executable"; exit 1; }
D11=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
D10=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.0)
$g "$D11" 2>/dev/null | grep -q 'DEPLOY OK' || { echo "the gate rejects the signed image 1.1 with provenance"; exit 1; }
$g "$D10" >/dev/null 2>&1 && { echo "the gate lets the unsigned image 1.0 through"; exit 1; }
$g 127.0.0.1:5000/kurs-shop:1.1 >/dev/null 2>&1 && { echo "the gate lets through an image given by tag"; exit 1; }
# slika potpisana tuđim ključem, sa lažnim builderom
t=$(mktemp -d); cd $t; COSIGN_PASSWORD=x cosign generate-key-pair >/dev/null 2>&1
D12=$(kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.2-test /root/kurs-shop 65532)
COSIGN_PASSWORD=x cosign sign --key cosign.key --use-signing-config=false --tlog-upload=false -y "$D12" >/dev/null 2>&1
$g "$D12" >/dev/null 2>&1 && { rm -rf $t; echo "the gate lets through an image signed with someone else's key"; exit 1; }
# naš potpis, ali provenance sa drugog buildera
COSIGN_PASSWORD=kurs cosign sign --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y "$D12" >/dev/null 2>&1
echo '{"buildDefinition":{"buildType":"x"},"runDetails":{"builder":{"id":"https://laptop.napadac/build"}}}' > p.json
COSIGN_PASSWORD=kurs cosign attest --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y --type slsaprovenance1 --predicate p.json "$D12" >/dev/null 2>&1
$g "$D12" >/dev/null 2>&1 && { rm -rf $t; echo "the gate lets through an image whose provenance is not from our builder"; exit 1; }
rm -rf $t
exit 0
-->
<!-- hint
```bash
#!/bin/bash
set -euo pipefail
img=$1
[[ "$img" == *@sha256:* ]] || { echo "the image must be given by digest"; exit 1; }
cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true "$img" >/dev/null
cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true \
  --type slsaprovenance1 "$img" 2>/dev/null \
  | jq -r .payload | base64 -d \
  | jq -e '.predicate.runDetails.builder.id == "https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"' >/dev/null
echo "DEPLOY OK"
```
Careful: if the image has several provenance attestations, accept it only if **at least one** comes from your builder (or require that all of them do), but never let an error in `jq`/`cosign` slip through (hence `set -o pipefail`).
-->
<!-- solution
mkdir -p /root/kurs-shop/ci
cat > /root/kurs-shop/ci/deploy-gate.sh <<'EOF'
#!/bin/bash
set -euo pipefail
img=$1
pub=/root/keys/cosign.pub
builder="https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"
[[ "$img" == *@sha256:* ]] || { echo "slika mora biti zadata digestom"; exit 1; }
cosign verify --key "$pub" --insecure-ignore-tlog=true "$img" >/dev/null 2>&1 || { echo "nema validnog potpisa"; exit 1; }
att=$(cosign verify-attestation --key "$pub" --insecure-ignore-tlog=true --type slsaprovenance1 "$img" 2>/dev/null) || { echo "nema validne provenance atestacije"; exit 1; }
echo "$att" | jq -r .payload | while read -r p; do echo "$p" | base64 -d; echo; done \
  | jq -s -e --arg b "$builder" 'length > 0 and all(.[]; .predicate.runDetails.builder.id == $b)' >/dev/null || { echo "provenance nije sa našeg buildera"; exit 1; }
echo "DEPLOY OK"
EOF
chmod +x /root/kurs-shop/ci/deploy-gate.sh
-->
