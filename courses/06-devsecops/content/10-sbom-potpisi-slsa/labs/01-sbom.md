# Lab 1: SBOM za sliku

**SBOM** (Software Bill of Materials) je spisak svega što je u artefaktu: OS paketi, biblioteke, verzije, licence. Pravi se jednom, u buildu, i čuva uz sliku. Kad sutra izađe nova kritična ranjivost, odgovor na pitanje „da li smo pogođeni?“ dobiješ iz SBOM-a, bez ponovnog skeniranja svih slika.

U registriju je `127.0.0.1:5000/kurs-shop:1.1`. Napravićeš SBOM u formatima **CycloneDX** i **SPDX**, skenirati ga i iz njega odgovoriti na pitanje o ranjivosti.

```bash
syft --version
crane ls --insecure 127.0.0.1:5000/kurs-shop
```

<!-- setup
set -e
kurs-repo
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532 >/dev/null
-->

## CycloneDX i SPDX

Syftom napravi SBOM slike `127.0.0.1:5000/kurs-shop:1.1` (izvor `registry:`, bez Docker daemona) u dva fajla:

- `/root/sbom.cdx.json` (CycloneDX JSON),
- `/root/sbom.spdx.json` (SPDX JSON).

```bash
syft scan registry:127.0.0.1:5000/kurs-shop:1.1 -o cyclonedx-json=/root/sbom.cdx.json -o spdx-json=/root/sbom.spdx.json
```

<!-- verify
jq -e '.bomFormat == "CycloneDX" and (.components | length > 50)' /root/sbom.cdx.json >/dev/null 2>&1 || { echo "/root/sbom.cdx.json nije CycloneDX SBOM slike"; exit 1; }
jq -e '.metadata.component.name | test("kurs-shop")' /root/sbom.cdx.json >/dev/null 2>&1 || { echo "CycloneDX SBOM nije za sliku kurs-shop"; exit 1; }
jq -e '(.spdxVersion | startswith("SPDX-")) and (.packages | length > 50)' /root/sbom.spdx.json >/dev/null 2>&1 || { echo "/root/sbom.spdx.json nije SPDX SBOM slike"; exit 1; }
jq -e '[.components[].name] | index("openssl")' /root/sbom.cdx.json >/dev/null || { echo "SBOM ne sadrži OS pakete (openssl): skeniraj sliku, ne repo"; exit 1; }
-->
<!-- hint
Syft prima više `-o format=fajl` izlaza u jednom pokretanju. Lokalni registry radi preko HTTP-a; Syft adresu `127.0.0.1` automatski tretira kao nesiguran registry.
-->
<!-- solution
syft scan registry:127.0.0.1:5000/kurs-shop:1.1 -q -o cyclonedx-json=/root/sbom.cdx.json -o spdx-json=/root/sbom.spdx.json
-->

## Skeniranje SBOM-a

Skeniraj SBOM (ne sliku) Trivyjem. U `/root/sbom-high.txt` upiši broj nalaza ozbiljnosti **HIGH ili CRITICAL** iz tog skena.

```bash
trivy sbom /root/sbom.cdx.json
```

<!-- verify
n=$(trivy sbom -q --format json /root/sbom.cdx.json 2>/dev/null | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length')
[ -n "$n" ] || { echo "trivy sbom ne može pročitati /root/sbom.cdx.json"; exit 1; }
[ "$(tr -d ' \n' < /root/sbom-high.txt 2>/dev/null)" = "$n" ] || { echo "sbom-high.txt nije tačan"; exit 1; }
-->
<!-- hint
```bash
trivy sbom -f json /root/sbom.cdx.json | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length'
```
Isti SBOM možeš skenirati i sutra, sa novijom bazom ranjivosti, bez pristupa slici.
-->
<!-- solution
trivy sbom -q --format json /root/sbom.cdx.json | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' > /root/sbom-high.txt
-->

## Da li smo pogođeni?

Objavljena je nova ranjivost u OpenSSL-u, ispravljena u Debian verziji `3.5.7-1~deb13u4`. Iz SBOM-a (bez ponovnog skeniranja slike) utvrdi koja je verzija paketa `openssl` u slici i upiši je u `/root/openssl.txt`. U `/root/pogodjeni.txt` upiši `da` ako je instalirana verzija starija od ispravljene, inače `ne`.

```bash
jq -r '.components[] | select(.name == "openssl") | .version' /root/sbom.cdx.json
```

<!-- verify
v=$(jq -r '[.components[] | select(.name == "openssl") | .version][0]' /root/sbom.cdx.json)
[ "$(tr -d ' \n' < /root/openssl.txt 2>/dev/null)" = "$v" ] || { echo "openssl.txt nema verziju openssl paketa iz SBOM-a"; exit 1; }
if dpkg --compare-versions "$v" lt "3.5.7-1~deb13u4"; then want=da; else want=ne; fi
[ "$(tr -d ' \n' < /root/pogodjeni.txt 2>/dev/null | tr A-Z a-z)" = "$want" ] || { echo "pogodjeni.txt nije tačan"; exit 1; }
-->
<!-- hint
Debian verzije se ne porede kao obični stringovi (`~` je „manje od ničega“). `dpkg --compare-versions A lt B && echo starija`.
-->
<!-- solution
v=$(jq -r '[.components[] | select(.name == "openssl") | .version][0]' /root/sbom.cdx.json)
echo "$v" > /root/openssl.txt
if dpkg --compare-versions "$v" lt "3.5.7-1~deb13u4"; then echo da; else echo ne; fi > /root/pogodjeni.txt
-->
