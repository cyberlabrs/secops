# Lab 1: From a scanner report to today's list

The scanner returned findings for a server fleet in `/root/vm/nalazi.json` ("nalazi" = findings), enriched with EPSS scores and a KEV flag. You'll apply the prioritization rules from the lesson using `jq`, and then build a package inventory (a mini SBOM) for this server.

The IDs are made up (`CVE-LAB-…`) so they don't get confused with real vulnerabilities.

| Priority | Condition |
|---|---|
| **P1** | `kev == true`, **or** (`epss >= 0.1` **and** `internet == true`) |
| **P2** | not P1, `cvss >= 7` **and** (`internet == true` **or** `epss >= 0.01`) |
| **P3** | neither P1 nor P2, `cvss >= 7` |
| **P4** | everything else |

<!-- setup
set -e
mkdir -p /root/vm
cat > /root/vm/nalazi.json <<'EOF'
[
 {"id":"CVE-LAB-0001","pkg":"openssl","host":"web-01","cvss":9.8,"epss":0.002,"kev":false,"internet":false},
 {"id":"CVE-LAB-0002","pkg":"vpn-firmware","host":"vpn-gw","cvss":7.5,"epss":0.94,"kev":true,"internet":true},
 {"id":"CVE-LAB-0003","pkg":"nginx","host":"web-01","cvss":6.1,"epss":0.12,"kev":false,"internet":true},
 {"id":"CVE-LAB-0004","pkg":"log-lib","host":"app-02","cvss":10.0,"epss":0.97,"kev":true,"internet":false},
 {"id":"CVE-LAB-0005","pkg":"sudo","host":"db-01","cvss":7.8,"epss":0.0004,"kev":false,"internet":false},
 {"id":"CVE-LAB-0006","pkg":"curl","host":"web-02","cvss":8.1,"epss":0.03,"kev":false,"internet":true},
 {"id":"CVE-LAB-0007","pkg":"linux-kernel","host":"db-01","cvss":7.0,"epss":0.015,"kev":false,"internet":false},
 {"id":"CVE-LAB-0008","pkg":"libxml2","host":"app-02","cvss":5.3,"epss":0.0009,"kev":false,"internet":false},
 {"id":"CVE-LAB-0009","pkg":"tomcat","host":"web-02","cvss":9.1,"epss":0.45,"kev":false,"internet":true},
 {"id":"CVE-LAB-0010","pkg":"zlib","host":"app-01","cvss":4.4,"epss":0.2,"kev":false,"internet":false},
 {"id":"CVE-LAB-0011","pkg":"openssh","host":"bastion","cvss":8.1,"epss":0.08,"kev":false,"internet":true},
 {"id":"CVE-LAB-0012","pkg":"git","host":"ci-runner","cvss":7.3,"epss":0.005,"kev":false,"internet":false}
]
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Prioritizacija ranjivosti ===
Podaci: /root/vm/nalazi.json   Alat: jq
EOF
-->

## Get to know the data

```bash
cd /root/vm
jq length nalazi.json
jq -r '.[] | [.id, .host, .cvss, .epss, .kev, .internet] | @tsv' nalazi.json | column -t
```

Sort by CVSS, then by EPSS, and compare which findings come out on top in each case:

```bash
jq -r 'sort_by(-.cvss) | .[:4][] | "\(.id) cvss=\(.cvss) epss=\(.epss)"' nalazi.json
jq -r 'sort_by(-.epss) | .[:4][] | "\(.id) cvss=\(.cvss) epss=\(.epss)"' nalazi.json
```

Notice `CVE-LAB-0001`: CVSS 9.8, but a very low probability of attack, on an internal system.

## P1: patch now

Write a `jq` filter for P1 and write the IDs to `/root/vm/p1.txt`, one per line:

```bash
jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .id' nalazi.json > p1.txt
cat p1.txt
```

Look at `CVE-LAB-0003`: its CVSS is only 6.1 (Medium), but it's on the internet and has a high EPSS, so it goes to P1.

<!-- verify
want="CVE-LAB-0002 CVE-LAB-0003 CVE-LAB-0004 CVE-LAB-0009"
got=$(sort -u /root/vm/p1.txt 2>/dev/null | grep . | xargs)
[ "$got" = "$want" ] || { echo "Got: $got"; exit 1; }
-->
<!-- solution
cd /root/vm && jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .id' nalazi.json > p1.txt
-->

## P2: this month

P2 are findings that are **not** P1, have `cvss >= 7` and (`internet == true` or `epss >= 0.01`). Write the IDs to `/root/vm/p2.txt`.

<!-- verify
want="CVE-LAB-0006 CVE-LAB-0007 CVE-LAB-0011"
got=$(sort -u /root/vm/p2.txt 2>/dev/null | grep . | xargs)
[ "$got" = "$want" ] || { echo "Got: $got"; exit 1; }
-->
<!-- hint
```bash
jq -r '.[] | select((.kev == true or (.epss >= 0.1 and .internet == true)) | not)
             | select(.cvss >= 7 and (.internet == true or .epss >= 0.01)) | .id' nalazi.json > p2.txt
```
-->
<!-- solution
cd /root/vm && jq -r '.[] | select((.kev == true or (.epss >= 0.1 and .internet == true)) | not) | select(.cvss >= 7 and (.internet == true or .epss >= 0.01)) | .id' nalazi.json > p2.txt
-->

## Report by host

A manager asks: "Which hosts have P1 findings?" Create `/root/vm/hostovi-p1.txt` ("hostovi" = hosts) with the unique host names, sorted alphabetically.

```bash
jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .host' nalazi.json | sort -u > hostovi-p1.txt
```

<!-- verify
want="app-02 vpn-gw web-01 web-02"
got=$(grep . /root/vm/hostovi-p1.txt 2>/dev/null | xargs)
[ "$got" = "$want" ] || { echo "Got: $got (expected sorted and without duplicates)"; exit 1; }
-->
<!-- solution
cd /root/vm && jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .host' nalazi.json | sort -u > hostovi-p1.txt
-->

## A mini SBOM for this server

A real SBOM is produced with a tool like Syft or Trivy in CycloneDX or SPDX format. You can see the principle with the package manager too: create `/root/vm/sbom.csv` with all installed packages in the format `package,version`.

```bash
dpkg-query -W -f='${Package},${Version}\n' | sort > /root/vm/sbom.csv
wc -l /root/vm/sbom.csv
grep '^openssl,' /root/vm/sbom.csv
```

Now when a CVE for `openssl` comes out, the answer to "do we have a vulnerable version?" is a single grep command. At company scale, a tool like OWASP Dependency-Track does this over the SBOMs of all services.

<!-- verify
f=/root/vm/sbom.csv
[ -s $f ] || { echo "sbom.csv does not exist"; exit 1; }
n=$(dpkg-query -W -f='${Package}\n' | wc -l)
m=$(grep -c ',' $f)
[ "$n" -eq "$m" ] || { echo "Expected $n packages, the file has $m"; exit 1; }
grep -q "^openssl,$(dpkg-query -W -f='${Version}' openssl)$" $f || { echo "The openssl version doesn't match the installed one"; exit 1; }
-->
<!-- solution
dpkg-query -W -f='${Package},${Version}\n' | sort > /root/vm/sbom.csv
-->
