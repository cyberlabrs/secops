# Lab 2: Potpis, provenance i provjera prije deploya

Registry ne garantuje da je slika prošla pipeline: svako sa pravom pusha može postaviti bilo šta pod tag `1.1`. Zato pipeline sliku **potpisuje** (cosign), uz nju objavljuje **atestacije** (SBOM i SLSA provenance), a deploy pristaje samo na sliku čiji su potpis i provenance provjereni.

Lab nema pristup javnom Sigstoreu (Fulcio, Rekor), pa koristiš par ključeva i isključen transparency log:

- potpisivanje: `--use-signing-config=false --tlog-upload=false`,
- provjera: `--insecure-ignore-tlog=true`.

U pravom pipelineu koristio bi se keyless potpis sa OIDC identitetom joba.

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

## Ključ i potpis

1. Napravi par ključeva u `/root/keys/` (`cosign generate-key-pair`; lozinka iz `COSIGN_PASSWORD`). Ključ ne smije biti u repou: u pravom GitLabu je masked/protected varijabla tipa File ili, bolje, KMS ključ (`--key awskms://…`).
2. Potpiši sliku `kurs-shop:1.1` **po digestu**, ne po tagu.
3. Provjeri potpis javnim ključem.

```bash
export COSIGN_PASSWORD=kurs
mkdir -p /root/keys && cd /root/keys && cosign generate-key-pair
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
cosign sign --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y "$IMG"
cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true "$IMG" | jq .
```

<!-- verify
[ -f /root/keys/cosign.key ] && [ -f /root/keys/cosign.pub ] || { echo "nema para ključeva u /root/keys"; exit 1; }
find /root/kurs-shop -name 'cosign.key' | grep -q . && { echo "privatni ključ ne smije biti u repou"; exit 1; }
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
out=$(cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true "$IMG" 2>/dev/null) || { echo "kurs-shop:1.1 nije potpisana ključem /root/keys/cosign.key"; exit 1; }
echo "$out" | jq -e '.[] | select(.critical.type == "cosign container image signature" or .critical.type == "https://sigstore.dev/cosign/sign/v1")' >/dev/null 2>&1 || { echo "nema potpisa slike (samo atestacije?)"; exit 1; }
echo "$out" | jq -e '.[0].critical.identity["docker-reference"] | test("kurs-shop")' >/dev/null || { echo "potpis nije za kurs-shop"; exit 1; }
cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true 127.0.0.1:5000/kurs-shop:1.0 >/dev/null 2>&1 && { echo "i 1.0 je potpisana: potpiši samo 1.1"; exit 1; }
exit 0
-->
<!-- hint
Potpis se veže za **digest** slike. Tag je pokazivač koji se može pomjeriti, zato se i deploy radi po digestu (`ime@sha256:…`).
-->
<!-- solution
export COSIGN_PASSWORD=kurs
mkdir -p /root/keys && cd /root/keys && cosign generate-key-pair >/dev/null 2>&1
IMG=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
cosign sign --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y "$IMG" >/dev/null 2>&1
-->

## Atestacije: SBOM i SLSA provenance

Uz potpisanu sliku objavi dvije atestacije (in-toto, potpisane istim ključem):

1. **SBOM**: CycloneDX SBOM slike (`syft`), tip `cyclonedx`.
2. **SLSA provenance** v1, tip `slsaprovenance1`: napravi predikat `/root/provenance.json` u kome su:
   - `buildDefinition.buildType`: `https://gitlab.kurs-shop.ba/ci/kurs-build@v1`,
   - `buildDefinition.resolvedDependencies`: git repo sa `digest.gitCommit` jednakim trenutnom commitu (`git -C /root/kurs-shop rev-parse HEAD`),
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
[ -n "$p" ] || { echo "nema provjerljive slsaprovenance1 atestacije za kurs-shop:1.1"; exit 1; }
echo "$p" | jq -e '.predicateType == "https://slsa.dev/provenance/v1"' >/dev/null || { echo "predicateType nije SLSA provenance v1"; exit 1; }
echo "$p" | jq -e '.predicate.runDetails.builder.id == "https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"' >/dev/null || { echo "builder.id nije tačan"; exit 1; }
echo "$p" | jq -e '.predicate.buildDefinition.buildType == "https://gitlab.kurs-shop.ba/ci/kurs-build@v1"' >/dev/null || { echo "buildType nije tačan"; exit 1; }
c=$(git -C /root/kurs-shop rev-parse HEAD)
echo "$p" | jq -e --arg c "$c" '[.predicate.buildDefinition.resolvedDependencies[]?.digest.gitCommit] | index($c)' >/dev/null || { echo "resolvedDependencies nema gitCommit trenutnog commita"; exit 1; }
s=$(cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true --type cyclonedx "$IMG" 2>/dev/null | jq -r '.payload' | head -1 | base64 -d 2>/dev/null)
echo "$s" | jq -e '.predicate.bomFormat == "CycloneDX" and (.predicate.components | length > 50)' >/dev/null 2>&1 || { echo "nema CycloneDX SBOM atestacije slike"; exit 1; }
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
SBOM: `syft scan registry:$IMG -o cyclonedx-json=/root/sbom.cdx.json`, pa `cosign attest … --type cyclonedx --predicate /root/sbom.cdx.json`.
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

## Provjera prije deploya

Napiši `/root/kurs-shop/ci/deploy-gate.sh <slika>` koji vraća 0 i ispisuje `DEPLOY OK` **samo** ako:

1. je slika zadata po digestu (`…@sha256:…`),
2. ima potpis provjerljiv ključem `/root/keys/cosign.pub`,
3. ima `slsaprovenance1` atestaciju istim ključem, sa `builder.id` `https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7`.

Inače vraća izlazni kod različit od 0. Provjeri na `kurs-shop:1.1` (po digestu), na `kurs-shop:1.0` i na tagu `kurs-shop:1.1`.

<!-- verify
g=/root/kurs-shop/ci/deploy-gate.sh
[ -x $g ] || { echo "$g ne postoji ili nije izvršiv"; exit 1; }
D11=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1)
D10=127.0.0.1:5000/kurs-shop@$(crane digest --insecure 127.0.0.1:5000/kurs-shop:1.0)
$g "$D11" 2>/dev/null | grep -q 'DEPLOY OK' || { echo "gate odbija potpisanu sliku 1.1 sa provenanceom"; exit 1; }
$g "$D10" >/dev/null 2>&1 && { echo "gate pušta nepotpisanu sliku 1.0"; exit 1; }
$g 127.0.0.1:5000/kurs-shop:1.1 >/dev/null 2>&1 && { echo "gate pušta sliku zadatu tagom"; exit 1; }
# slika potpisana tuđim ključem, sa lažnim builderom
t=$(mktemp -d); cd $t; COSIGN_PASSWORD=x cosign generate-key-pair >/dev/null 2>&1
D12=$(kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.2-test /root/kurs-shop 65532)
COSIGN_PASSWORD=x cosign sign --key cosign.key --use-signing-config=false --tlog-upload=false -y "$D12" >/dev/null 2>&1
$g "$D12" >/dev/null 2>&1 && { rm -rf $t; echo "gate pušta sliku potpisanu tuđim ključem"; exit 1; }
# naš potpis, ali provenance sa drugog buildera
COSIGN_PASSWORD=kurs cosign sign --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y "$D12" >/dev/null 2>&1
echo '{"buildDefinition":{"buildType":"x"},"runDetails":{"builder":{"id":"https://laptop.napadac/build"}}}' > p.json
COSIGN_PASSWORD=kurs cosign attest --key /root/keys/cosign.key --use-signing-config=false --tlog-upload=false -y --type slsaprovenance1 --predicate p.json "$D12" >/dev/null 2>&1
$g "$D12" >/dev/null 2>&1 && { rm -rf $t; echo "gate pušta sliku čiji provenance nije sa našeg buildera"; exit 1; }
rm -rf $t
exit 0
-->
<!-- hint
```bash
#!/bin/bash
set -euo pipefail
img=$1
[[ "$img" == *@sha256:* ]] || { echo "slika mora biti zadata digestom"; exit 1; }
cosign verify --key /root/keys/cosign.pub --insecure-ignore-tlog=true "$img" >/dev/null
cosign verify-attestation --key /root/keys/cosign.pub --insecure-ignore-tlog=true \
  --type slsaprovenance1 "$img" 2>/dev/null \
  | jq -r .payload | base64 -d \
  | jq -e '.predicate.runDetails.builder.id == "https://gitlab.kurs-shop.ba/shop/kurs-shop/-/runners/7"' >/dev/null
echo "DEPLOY OK"
```
Pazi: ako slika ima više provenance atestacija, prihvati je samo ako **barem jedna** dolazi sa tvog buildera (ili zahtijevaj da sve dolaze), ali nikad ne propuštaj grešku u `jq`/`cosign` (zato `set -o pipefail`).
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
