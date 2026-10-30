# Lab 1: An SBOM for the image

An **SBOM** (Software Bill of Materials) is a list of everything in an artifact: OS packages, libraries, versions, licenses. It is generated once, in the build, and kept alongside the image. When a new critical vulnerability comes out tomorrow, you get the answer to "are we affected?" from the SBOM, without rescanning every image.

The registry contains `127.0.0.1:5000/kurs-shop:1.1`. You will create an SBOM in the **CycloneDX** and **SPDX** formats, scan it, and use it to answer a question about a vulnerability.

```bash
syft --version
crane ls --insecure 127.0.0.1:5000/kurs-shop
```

<!-- setup
set -e
kurs-repo
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532 >/dev/null
-->

## CycloneDX and SPDX

Use Syft to create an SBOM of the image `127.0.0.1:5000/kurs-shop:1.1` (source `registry:`, no Docker daemon) in two files:

- `/root/sbom.cdx.json` (CycloneDX JSON),
- `/root/sbom.spdx.json` (SPDX JSON).

```bash
syft scan registry:127.0.0.1:5000/kurs-shop:1.1 -o cyclonedx-json=/root/sbom.cdx.json -o spdx-json=/root/sbom.spdx.json
```

<!-- verify
jq -e '.bomFormat == "CycloneDX" and (.components | length > 50)' /root/sbom.cdx.json >/dev/null 2>&1 || { echo "/root/sbom.cdx.json is not a CycloneDX SBOM of the image"; exit 1; }
jq -e '.metadata.component.name | test("kurs-shop")' /root/sbom.cdx.json >/dev/null 2>&1 || { echo "the CycloneDX SBOM is not for the kurs-shop image"; exit 1; }
jq -e '(.spdxVersion | startswith("SPDX-")) and (.packages | length > 50)' /root/sbom.spdx.json >/dev/null 2>&1 || { echo "/root/sbom.spdx.json is not an SPDX SBOM of the image"; exit 1; }
jq -e '[.components[].name] | index("openssl")' /root/sbom.cdx.json >/dev/null || { echo "the SBOM contains no OS packages (openssl): scan the image, not the repo"; exit 1; }
-->
<!-- hint
Syft accepts several `-o format=file` outputs in a single run. The local registry runs over HTTP; Syft automatically treats the address `127.0.0.1` as an insecure registry.
-->
<!-- solution
syft scan registry:127.0.0.1:5000/kurs-shop:1.1 -q -o cyclonedx-json=/root/sbom.cdx.json -o spdx-json=/root/sbom.spdx.json
-->

## Scanning the SBOM

Scan the SBOM (not the image) with Trivy. Write the number of findings with severity **HIGH or CRITICAL** from that scan to `/root/sbom-high.txt`.

```bash
trivy sbom /root/sbom.cdx.json
```

<!-- verify
n=$(trivy sbom -q --format json /root/sbom.cdx.json 2>/dev/null | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length')
[ -n "$n" ] || { echo "trivy sbom cannot read /root/sbom.cdx.json"; exit 1; }
[ "$(tr -d ' \n' < /root/sbom-high.txt 2>/dev/null)" = "$n" ] || { echo "sbom-high.txt is not correct"; exit 1; }
-->
<!-- hint
```bash
trivy sbom -f json /root/sbom.cdx.json | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length'
```
You can scan the same SBOM tomorrow too, with a newer vulnerability database, without access to the image.
-->
<!-- solution
trivy sbom -q --format json /root/sbom.cdx.json | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' > /root/sbom-high.txt
-->

## Are we affected?

A new OpenSSL vulnerability has been published, fixed in Debian version `3.5.7-1~deb13u4`. From the SBOM (without rescanning the image) determine which version of the `openssl` package is in the image and write it to `/root/openssl.txt`. In `/root/pogodjeni.txt` ("affected") write `da` (yes) if the installed version is older than the fixed one, otherwise `ne` (no).

```bash
jq -r '.components[] | select(.name == "openssl") | .version' /root/sbom.cdx.json
```

<!-- verify
v=$(jq -r '[.components[] | select(.name == "openssl") | .version][0]' /root/sbom.cdx.json)
[ "$(tr -d ' \n' < /root/openssl.txt 2>/dev/null)" = "$v" ] || { echo "openssl.txt does not contain the openssl package version from the SBOM"; exit 1; }
if dpkg --compare-versions "$v" lt "3.5.7-1~deb13u4"; then want=da; else want=ne; fi
[ "$(tr -d ' \n' < /root/pogodjeni.txt 2>/dev/null | tr A-Z a-z)" = "$want" ] || { echo "pogodjeni.txt is not correct"; exit 1; }
-->
<!-- hint
Debian versions are not compared as plain strings (`~` is "less than nothing"). `dpkg --compare-versions A lt B && echo older`.
-->
<!-- solution
v=$(jq -r '[.components[] | select(.name == "openssl") | .version][0]' /root/sbom.cdx.json)
echo "$v" > /root/openssl.txt
if dpkg --compare-versions "$v" lt "3.5.7-1~deb13u4"; then echo da; else echo ne; fi > /root/pogodjeni.txt
-->
