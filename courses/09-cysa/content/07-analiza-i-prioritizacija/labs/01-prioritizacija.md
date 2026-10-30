# Lab 1: Prioritizacija ranjivosti (CVSS, EPSS, KEV)

Skener vrati stotine nalaza; tim ih može popraviti desetak sedmično. CVSS kaže koliko je ranjivost **ozbiljna**, **EPSS** procjenjuje vjerovatnoću da će biti iskorištena u narednih 30 dana, a **CISA KEV** je spisak ranjivosti za koje se zna da se **već** iskorištavaju.

U labu su lokalne kopije: `/opt/kurs/data/kev.json` (CISA KEV) i `/opt/kurs/data/epss.csv` (FIRST EPSS, prvi red je komentar sa verzijom modela).

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

## Sken slike

Skeniraj `127.0.0.1:5000/kurs-shop:1.0` Trivyjem (samo ranjivosti) u JSON `/root/prio/sken.json`. U `/root/prio/sken-cve.txt` upiši jedinstvene CVE ID-jeve, jedan po redu, sortirano, a u `/root/prio/sken-u-kev.txt` one koji su u CISA KEV (fajl može biti prazan, ali mora postojati).

<!-- verify
[ -s /root/prio/sken.json ] || { echo "nema /root/prio/sken.json"; exit 1; }
jq -e '.ArtifactName | test("kurs-shop:1.0")' /root/prio/sken.json >/dev/null 2>&1 || { echo "sken.json nije za kurs-shop:1.0"; exit 1; }
want=$(jq -r '[.Results[].Vulnerabilities[]?.VulnerabilityID | select(startswith("CVE-"))] | unique | .[]' /root/prio/sken.json)
[ "$(grep -E '^CVE-' /root/prio/sken-cve.txt 2>/dev/null | sort -u)" = "$(echo "$want" | sort -u)" ] || { echo "sken-cve.txt ne sadrži tačno jedinstvene CVE iz skena"; exit 1; }
[ -f /root/prio/sken-u-kev.txt ] || { echo "nema /root/prio/sken-u-kev.txt"; exit 1; }
k=$(jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | sort -u | comm -12 - <(echo "$want" | sort -u))
[ "$(grep -E '^CVE-' /root/prio/sken-u-kev.txt | sort -u)" = "$k" ] || { echo "sken-u-kev.txt nije tačan"; exit 1; }
-->
<!-- hint
```bash
trivy image --scanners vuln -f json -o /root/prio/sken.json 127.0.0.1:5000/kurs-shop:1.0
jq -r '[.Results[].Vulnerabilities[]?.VulnerabilityID] | unique | .[]' /root/prio/sken.json | grep '^CVE-' > /root/prio/sken-cve.txt
jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | sort -u | comm -12 - /root/prio/sken-cve.txt > /root/prio/sken-u-kev.txt
```
`comm` traži sortirane ulaze.
-->
<!-- solution
trivy image -q --scanners vuln -f json -o /root/prio/sken.json 127.0.0.1:5000/kurs-shop:1.0
jq -r '[.Results[].Vulnerabilities[]?.VulnerabilityID] | unique | .[]' /root/prio/sken.json | grep '^CVE-' | sort -u > /root/prio/sken-cve.txt
jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | sort -u | comm -12 - /root/prio/sken-cve.txt > /root/prio/sken-u-kev.txt
-->

## Prioriteti po politici

Politika tima za `/root/prio/izvjestaj.csv`:

- **P1** (popravka u 72 sata): CVE je u CISA KEV,
- **P2** (14 dana): nije u KEV, ali je EPSS ≥ **0.1** ili CVSS ≥ **9.0**,
- **P3** (90 dana): sve ostalo.

Napravi `/root/prio/prioriteti.csv` sa zaglavljem `cve,imovina,cvss,kev,epss,prioritet` (`kev` je `da`/`ne`, `epss` kao u fajlu, prazno ako CVE nije u EPSS-u), sortirano po prioritetu (P1 prvo), pa po EPSS-u opadajuće.

<!-- verify
f=/root/prio/prioriteti.csv
[ -s $f ] || { echo "nema $f"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "cve,imovina,cvss,kev,epss,prioritet" ] || { echo "zaglavlje treba cve,imovina,cvss,kev,epss,prioritet"; exit 1; }
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
    if not g: sys.exit(f"{w[0]} nedostaje")
    if g[3] != w[3]: sys.exit(f"{w[0]}: kev treba biti {w[3]}")
    if (g[4] and w[4] and abs(float(g[4]) - float(w[4])) > 1e-6) or (bool(g[4]) != bool(w[4])): sys.exit(f"{w[0]}: epss nije tačan")
    if g[5] != w[5]: sys.exit(f"{w[0]}: prioritet treba biti {w[5]}")
if len(got) != len(want): sys.exit("broj redova se ne slaže sa izvjestaj.csv")
order = [g[0] for g in got]
exp = [w[0] for w in sorted(want, key=lambda w: (w[5], -(float(w[4]) if w[4] else -1)))]
if [gd[c][5] for c in order] != sorted(gd[c][5] for c in order): sys.exit("redovi nisu sortirani po prioritetu (P1 prvo)")
for pr in ("P1", "P2", "P3"):
    seq = [float(gd[c][4]) if gd[c][4] else -1 for c in order if gd[c][5] == pr]
    if seq != sorted(seq, reverse=True): sys.exit(f"u grupi {pr} redovi nisu sortirani po EPSS opadajuće")
EOF
-->
<!-- hint
Python je najlakši: učitaj KEV ID-jeve u `set`, EPSS u `dict` (preskoči red koji počinje sa `#` i zaglavlje), pa za svaki red izvještaja odredi prioritet i sortiraj sa `key=(prioritet, -epss)`.
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

## CVSS vektori

Izračunaj base score za ove vektore i upiši ih u `/root/prio/cvss.json` kao objekat `{"<vektor>": <score>, …}`:

```text
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H
CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N
CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N
CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:A/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N
```

Kalkulator: `cvss_calculator` ili Python biblioteka `cvss` (`/opt/tools/bin/python`). Zatim u `/root/prio/zasto.txt` u jednoj-dvije rečenice objasni zašto drugi vektor ima niži score od prvog iako su C/I/A isti.

<!-- verify
f=/root/prio/cvss.json
jq -e . $f >/dev/null 2>&1 || { echo "$f ne postoji ili nije JSON"; exit 1; }
/opt/tools/bin/python - <<'EOF' || exit 1
import json, sys
from cvss import CVSS3, CVSS4
d = json.load(open("/root/prio/cvss.json"))
V = ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
     "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N", "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
     "CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:A/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N"]
for v in V:
    s = float(CVSS4(v).base_score) if v.startswith("CVSS:4") else float(CVSS3(v).scores()[0])
    if v not in d: sys.exit(f"nedostaje vektor {v}")
    if abs(float(d[v]) - s) > 0.05: sys.exit(f"{v}: score nije tačan")
EOF
w=$(wc -w < /root/prio/zasto.txt 2>/dev/null || echo 0)
[ "$w" -ge 8 ] || { echo "zasto.txt treba objašnjenje (AV i PR)"; exit 1; }
grep -Eqi 'AV|lokal|local|PR|privilegij|pristup' /root/prio/zasto.txt || { echo "objašnjenje treba pomenuti vektor pristupa (AV) i privilegije (PR)"; exit 1; }
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
