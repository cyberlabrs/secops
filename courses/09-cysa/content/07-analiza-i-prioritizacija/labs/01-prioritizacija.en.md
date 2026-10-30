# Lab 1: Vulnerability prioritization (CVSS, EPSS, KEV)

The scanner returns hundreds of findings; the team can fix about ten per week. CVSS tells you how **severe** a vulnerability is, **EPSS** estimates the probability that it will be exploited in the next 30 days, and **CISA KEV** is the list of vulnerabilities known to be **already** exploited.

The lab has local copies: `/opt/kurs/data/kev.json` (CISA KEV) and `/opt/kurs/data/epss.csv` (FIRST EPSS; the first line is a comment with the model version).

```bash
jq '.vulnerabilities[0]' /opt/kurs/data/kev.json
head -3 /opt/kurs/data/epss.csv
cat /root/prio/izvjestaj.csv
```

<!-- setup
set -e
mkdir -p /root/prio
kurs-repo >/dev/null
kurs-build 127.0.0.1:5000/python:3.9-slim 127.0.0.1:5000/kurs-shop:1.0 /root/kurs-shop >/dev/null
cat > /root/prio/izvjestaj.csv <<'EOF'
cve,imovina,cvss
CVE-2021-44228,app-server-01,10.0
CVE-2023-4966,vpn-gw-01,9.4
CVE-2014-0160,legacy-lb-02,7.5
CVE-2024-3094,build-agent-03,10.0
CVE-2020-14343,kurs-shop,9.8
CVE-2023-30861,kurs-shop,7.5
CVE-2023-38545,build-agent-03,9.8
CVE-2024-6387,bastion-01,8.1
EOF
-->

## Image scan

Scan `127.0.0.1:5000/kurs-shop:1.0` with Trivy (vulnerabilities only) into the JSON file `/root/prio/sken.json`. In `/root/prio/sken-cve.txt` write the unique CVE IDs, one per line, sorted, and in `/root/prio/sken-u-kev.txt` the ones that are in CISA KEV (the file may be empty, but it must exist).

<!-- verify
[ -s /root/prio/sken.json ] || { echo "missing /root/prio/sken.json"; exit 1; }
jq -e '.ArtifactName | test("kurs-shop:1.0")' /root/prio/sken.json >/dev/null 2>&1 || { echo "sken.json is not for kurs-shop:1.0"; exit 1; }
want=$(jq -r '[.Results[].Vulnerabilities[]?.VulnerabilityID | select(startswith("CVE-"))] | unique | .[]' /root/prio/sken.json)
[ "$(grep -E '^CVE-' /root/prio/sken-cve.txt 2>/dev/null | sort -u)" = "$(echo "$want" | sort -u)" ] || { echo "sken-cve.txt does not contain exactly the unique CVEs from the scan"; exit 1; }
[ -f /root/prio/sken-u-kev.txt ] || { echo "missing /root/prio/sken-u-kev.txt"; exit 1; }
k=$(jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | sort -u | comm -12 - <(echo "$want" | sort -u))
[ "$(grep -E '^CVE-' /root/prio/sken-u-kev.txt | sort -u)" = "$k" ] || { echo "sken-u-kev.txt is not correct"; exit 1; }
-->
<!-- hint
```bash
trivy image --scanners vuln -f json -o /root/prio/sken.json 127.0.0.1:5000/kurs-shop:1.0
jq -r '[.Results[].Vulnerabilities[]?.VulnerabilityID] | unique | .[]' /root/prio/sken.json | grep '^CVE-' > /root/prio/sken-cve.txt
jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | sort -u | comm -12 - /root/prio/sken-cve.txt > /root/prio/sken-u-kev.txt
```
`comm` requires sorted input.
-->
<!-- solution
trivy image -q --scanners vuln -f json -o /root/prio/sken.json 127.0.0.1:5000/kurs-shop:1.0
jq -r '[.Results[].Vulnerabilities[]?.VulnerabilityID] | unique | .[]' /root/prio/sken.json | grep '^CVE-' | sort -u > /root/prio/sken-cve.txt
jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | sort -u | comm -12 - /root/prio/sken-cve.txt > /root/prio/sken-u-kev.txt
-->

## Priorities per policy

The team's policy for `/root/prio/izvjestaj.csv`:

- **P1** (fix within 72 hours): the CVE is in CISA KEV,
- **P2** (14 days): not in KEV, but EPSS ≥ **0.1** or CVSS ≥ **9.0**,
- **P3** (90 days): everything else.

Create `/root/prio/prioriteti.csv` with the header `cve,imovina,cvss,kev,epss,prioritet` (`imovina` = asset, `prioritet` = priority; `kev` is `da`/`ne` (yes/no), `epss` as in the file, empty if the CVE isn't in EPSS), sorted by priority (P1 first), then by EPSS descending.

<!-- verify
f=/root/prio/prioriteti.csv
[ -s $f ] || { echo "missing $f"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "cve,imovina,cvss,kev,epss,prioritet" ] || { echo "the header must be cve,imovina,cvss,kev,epss,prioritet"; exit 1; }
python3 - <<'EOF' || exit 1
import csv, json, sys
kev = {v["cveID"] for v in json.load(open("/opt/kurs/data/kev.json"))["vulnerabilities"]}
ep = {}
for row in csv.reader(open("/opt/kurs/data/epss.csv")):
    if row and row[0].startswith("CVE-"): ep[row[0]] = row[1]
want = []
for r in csv.DictReader(open("/root/prio/izvjestaj.csv")):
    k = r["cve"] in kev; e = ep.get(r["cve"], "")
    p = "P1" if k else ("P2" if (e and float(e) >= 0.1) or float(r["cvss"]) >= 9.0 else "P3")
    want.append((r["cve"], r["imovina"], r["cvss"], "da" if k else "ne", e, p))
got = [tuple(x.strip() for x in r) for r in list(csv.reader(open("/root/prio/prioriteti.csv")))[1:] if r]
gd = {g[0]: g for g in got}
for w in want:
    g = gd.get(w[0])
    if not g: sys.exit(f"{w[0]} is missing")
    if g[3] != w[3]: sys.exit(f"{w[0]}: kev should be {w[3]}")
    if (g[4] and w[4] and abs(float(g[4]) - float(w[4])) > 1e-6) or (bool(g[4]) != bool(w[4])): sys.exit(f"{w[0]}: epss is not correct")
    if g[5] != w[5]: sys.exit(f"{w[0]}: prioritet should be {w[5]}")
if len(got) != len(want): sys.exit("the number of rows does not match izvjestaj.csv")
order = [g[0] for g in got]
exp = [w[0] for w in sorted(want, key=lambda w: (w[5], -(float(w[4]) if w[4] else -1)))]
if [gd[c][5] for c in order] != sorted(gd[c][5] for c in order): sys.exit("rows are not sorted by priority (P1 first)")
for pr in ("P1", "P2", "P3"):
    seq = [float(gd[c][4]) if gd[c][4] else -1 for c in order if gd[c][5] == pr]
    if seq != sorted(seq, reverse=True): sys.exit(f"in group {pr} rows are not sorted by EPSS descending")
EOF
-->
<!-- hint
Python is easiest: load the KEV IDs into a `set`, EPSS into a `dict` (skip the line starting with `#` and the header), then determine the priority for each report row and sort with `key=(prioritet, -epss)`.
-->
<!-- solution
python3 - <<'EOF'
import csv, json
kev = {v["cveID"] for v in json.load(open("/opt/kurs/data/kev.json"))["vulnerabilities"]}
ep = {}
for row in csv.reader(open("/opt/kurs/data/epss.csv")):
    if row and row[0].startswith("CVE-"): ep[row[0]] = row[1]
rows = []
for r in csv.DictReader(open("/root/prio/izvjestaj.csv")):
    k = r["cve"] in kev; e = ep.get(r["cve"], "")
    p = "P1" if k else ("P2" if (e and float(e) >= 0.1) or float(r["cvss"]) >= 9.0 else "P3")
    rows.append([r["cve"], r["imovina"], r["cvss"], "da" if k else "ne", e, p])
rows.sort(key=lambda w: (w[5], -(float(w[4]) if w[4] else -1)))
with open("/root/prio/prioriteti.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["cve", "imovina", "cvss", "kev", "epss", "prioritet"]); w.writerows(rows)
EOF
-->

## CVSS vectors

Calculate the base score for these vectors and write them to `/root/prio/cvss.json` as an object `{"<vector>": <score>, …}`:

```text
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H
CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N
CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N
CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:A/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N
```

Calculator: `cvss_calculator` or the Python library `cvss` (`/opt/tools/bin/python`). Then, in `/root/prio/zasto.txt`, explain in one or two sentences why the second vector has a lower score than the first even though C/I/A are the same.

<!-- verify
f=/root/prio/cvss.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
/opt/tools/bin/python - <<'EOF' || exit 1
import json, sys
from cvss import CVSS3, CVSS4
d = json.load(open("/root/prio/cvss.json"))
V = ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
     "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N", "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
     "CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:A/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N"]
for v in V:
    s = float(CVSS4(v).base_score) if v.startswith("CVSS:4") else float(CVSS3(v).scores()[0])
    if v not in d: sys.exit(f"missing vector {v}")
    if abs(float(d[v]) - s) > 0.05: sys.exit(f"{v}: score is not correct")
EOF
w=$(wc -w < /root/prio/zasto.txt 2>/dev/null || echo 0)
[ "$w" -ge 8 ] || { echo "zasto.txt needs an explanation (AV and PR)"; exit 1; }
grep -Eqi 'AV|lokal|local|PR|privilegij|pristup' /root/prio/zasto.txt || { echo "the explanation should mention the attack vector (AV) and privileges (PR)"; exit 1; }
-->
<!-- hint
```python
from cvss import CVSS3, CVSS4
CVSS3("CVSS:3.1/...").scores()[0]   # base score
CVSS4("CVSS:4.0/...").base_score
```
-->
<!-- solution
/opt/tools/bin/python - <<'EOF'
import json
from cvss import CVSS3, CVSS4
V = ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
     "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N", "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
     "CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:A/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N"]
d = {v: (float(CVSS4(v).base_score) if v.startswith("CVSS:4") else float(CVSS3(v).scores()[0])) for v in V}
json.dump(d, open("/root/prio/cvss.json", "w"), indent=2)
EOF
echo "Drugi vektor traži lokalni pristup (AV:L umjesto AV:N) i niske privilegije (PR:L umjesto PR:N), pa je napad teže izvesti i base score je niži." > /root/prio/zasto.txt
-->
