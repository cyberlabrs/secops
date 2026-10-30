# Lab 1: Metrics for the monthly report

Management wants a monthly SOC report: how quickly we detect, contain, and resolve incidents, and how many times we breached the SLA. The data was exported from the ticketing system to `/root/izvjestaj/incidenti.csv` (times are in UTC).

Some names in this lab are in Serbian and must be used exactly as given. CSV columns: `prioritet` = priority, `kategorija` = category, `nastao` = occurred, `otkriven` = detected, `obuzdan` = contained, `rijesen` = resolved. In the files you write: `sve` = all, `sati_do_obuzdavanja` = hours to containment, `sla_sati` = SLA hours, `sazetak.md` = summary.

Definitions the team uses:

- **MTTD** (mean time to detect): average of `otkriven − nastao`,
- **MTTC** (mean time to contain): average of `obuzdan − otkriven`,
- **MTTR** (mean time to resolve): average of `rijesen − otkriven`.

```bash
cd /root/izvjestaj
column -s, -t incidenti.csv
```

<!-- setup
set -e
mkdir -p /root/izvjestaj
cat > /root/izvjestaj/incidenti.csv <<'EOF'
id,prioritet,kategorija,nastao,otkriven,obuzdan,rijesen
INC-1001,P2,phishing,2026-09-01T08:10:00Z,2026-09-01T09:40:00Z,2026-09-01T11:00:00Z,2026-09-02T10:00:00Z
INC-1002,P1,ransomware,2026-09-03T01:00:00Z,2026-09-03T01:45:00Z,2026-09-03T04:15:00Z,2026-09-05T18:00:00Z
INC-1003,P3,policy,2026-09-05T12:00:00Z,2026-09-07T09:00:00Z,2026-09-08T10:00:00Z,2026-09-10T16:00:00Z
INC-1004,P2,malware,2026-09-09T14:20:00Z,2026-09-09T15:00:00Z,2026-09-10T17:30:00Z,2026-09-11T12:00:00Z
INC-1005,P1,account-compromise,2026-09-12T22:00:00Z,2026-09-13T06:30:00Z,2026-09-13T12:00:00Z,2026-09-14T09:00:00Z
INC-1006,P3,lost-device,2026-09-18T10:00:00Z,2026-09-18T10:30:00Z,2026-09-18T11:00:00Z,2026-09-19T10:00:00Z
INC-1007,P2,data-exposure,2026-09-22T07:00:00Z,2026-09-23T07:00:00Z,2026-09-23T09:00:00Z,2026-09-25T15:00:00Z
INC-1008,P1,ddos,2026-09-27T16:00:00Z,2026-09-27T16:05:00Z,2026-09-27T17:00:00Z,2026-09-27T21:00:00Z
EOF
-->

## MTTD, MTTC, and MTTR

Calculate the three metrics in **hours**, rounded to one decimal place, for all incidents together and separately for P1. Write them to `/root/izvjestaj/metrike.json`:

```json
{ "sve": {"mttd": 0.0, "mttc": 0.0, "mttr": 0.0}, "p1": {"mttd": 0.0, "mttc": 0.0, "mttr": 0.0} }
```

<!-- verify
f=/root/izvjestaj/metrike.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
python3 - <<'EOF' || exit 1
import csv, json, sys
from datetime import datetime
t = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
rows = list(csv.DictReader(open("/root/izvjestaj/incidenti.csv")))
def m(rs):
    h = lambda a, b: (t(b) - t(a)).total_seconds() / 3600
    n = len(rs)
    return {"mttd": round(sum(h(r["nastao"], r["otkriven"]) for r in rs) / n, 1),
            "mttc": round(sum(h(r["otkriven"], r["obuzdan"]) for r in rs) / n, 1),
            "mttr": round(sum(h(r["otkriven"], r["rijesen"]) for r in rs) / n, 1)}
want = {"sve": m(rows), "p1": m([r for r in rows if r["prioritet"] == "P1"])}
got = json.load(open("/root/izvjestaj/metrike.json"))
for g in ("sve", "p1"):
    for k in ("mttd", "mttc", "mttr"):
        try:
            if abs(float(got[g][k]) - want[g][k]) > 0.051: sys.exit(f"{g}.{k} is not correct")
        except (KeyError, TypeError, ValueError):
            sys.exit(f"{g}.{k} is missing")
EOF
-->
<!-- hint
```python
import csv
from datetime import datetime
t = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
hours = (t(r["otkriven"]) - t(r["nastao"])).total_seconds() / 3600
```
-->
<!-- solution
python3 - <<'EOF'
import csv, json
from datetime import datetime
t = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
rows = list(csv.DictReader(open("/root/izvjestaj/incidenti.csv")))
def m(rs):
    h = lambda a, b: (t(b) - t(a)).total_seconds() / 3600
    n = len(rs)
    return {"mttd": round(sum(h(r["nastao"], r["otkriven"]) for r in rs) / n, 1),
            "mttc": round(sum(h(r["otkriven"], r["obuzdan"]) for r in rs) / n, 1),
            "mttr": round(sum(h(r["otkriven"], r["rijesen"]) for r in rs) / n, 1)}
json.dump({"sve": m(rows), "p1": m([r for r in rows if r["prioritet"] == "P1"])}, open("/root/izvjestaj/metrike.json", "w"), indent=2)
EOF
-->

## SLA breaches

Containment SLA (from detection): **P1 4 hours**, **P2 24 hours**, **P3 72 hours**. In `/root/izvjestaj/sla.csv` (header `id,prioritet,sati_do_obuzdavanja,sla_sati`) write only the incidents that breached the SLA, with hours rounded to one decimal place.

Then write a short summary for management in `/root/izvjestaj/sazetak.md` (at most 10 lines): the number of incidents, MTTD and MTTC, the number of SLA breaches, and **one** recommendation. No technical jargon. Start the recommendation line with "Recommendation:".

<!-- verify
python3 - <<'EOF' || exit 1
import csv, sys
from datetime import datetime
t = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
sla = {"P1": 4, "P2": 24, "P3": 72}
want = {}
for r in csv.DictReader(open("/root/izvjestaj/incidenti.csv")):
    h = (t(r["obuzdan"]) - t(r["otkriven"])).total_seconds() / 3600
    if h > sla[r["prioritet"]]: want[r["id"]] = (r["prioritet"], round(h, 1), sla[r["prioritet"]])
try:
    got = {r["id"]: r for r in csv.DictReader(open("/root/izvjestaj/sla.csv"))}
except (FileNotFoundError, KeyError):
    sys.exit("no /root/izvjestaj/sla.csv with the header id,prioritet,sati_do_obuzdavanja,sla_sati")
if set(got) != set(want): sys.exit(f"wrong set of incidents (found {sorted(got)})")
for i, (p, h, s) in want.items():
    g = got[i]
    if g["prioritet"] != p or abs(float(g["sati_do_obuzdavanja"]) - h) > 0.051 or int(float(g["sla_sati"])) != s:
        sys.exit(f"{i}: values are not correct")
EOF
f=/root/izvjestaj/sazetak.md
[ -s $f ] || { echo "no $f"; exit 1; }
[ "$(grep -c . $f)" -le 10 ] || { echo "the summary must have at most 10 lines"; exit 1; }
grep -q '8' $f || { echo "the summary needs the number of incidents (8)"; exit 1; }
grep -qi 'sla' $f || { echo "the summary needs the number of SLA breaches"; exit 1; }
grep -Eqi 'preporu|recommend' $f || { echo "the summary needs one recommendation (a line starting with Recommendation)"; exit 1; }
-->
<!-- hint
A breach is when the time to containment is **greater** than the SLA. In the summary, write about outcomes ("one critical incident was contained 1.5 hours later than agreed"), not tools. Start your recommendation with *Recommendation:*.
-->
<!-- solution
python3 - <<'EOF'
import csv
from datetime import datetime
t = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
sla = {"P1": 4, "P2": 24, "P3": 72}
with open("/root/izvjestaj/sla.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "prioritet", "sati_do_obuzdavanja", "sla_sati"])
    for r in csv.DictReader(open("/root/izvjestaj/incidenti.csv")):
        h = (t(r["obuzdan"]) - t(r["otkriven"])).total_seconds() / 3600
        if h > sla[r["prioritet"]]: w.writerow([r["id"], r["prioritet"], round(h, 1), sla[r["prioritet"]]])
EOF
n=$(($(wc -l < /root/izvjestaj/sla.csv) - 1))
cat > /root/izvjestaj/sazetak.md <<EOF
Septembar 2026: SOC je obradio 8 incidenata.
Prosječno vrijeme do otkrivanja: $(jq .sve.mttd /root/izvjestaj/metrike.json) h; do obuzdavanja: $(jq .sve.mttc /root/izvjestaj/metrike.json) h.
SLA za obuzdavanje prekršen je u $n slučaja.
Preporuka: uvesti dežurstvo van radnog vremena, jer su najveća kašnjenja kod incidenata nastalih noću.
EOF
-->
