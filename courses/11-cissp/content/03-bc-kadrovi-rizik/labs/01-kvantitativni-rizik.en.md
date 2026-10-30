# Lab 1: Quantitative risk analysis

On the CISSP exam you calculate: **SLE = AV × EF**, **ALE = SLE × ARO**, and a control is cost-effective if the reduction in ALE is greater than its annual cost (**value of the control = ALE before − ALE after − annual cost of the control**). You will perform an analysis for a company's risk register and recommend controls.

```bash
cd /root/rizik
column -s, -t rizici.csv
column -s, -t kontrole.csv
```

<!-- setup
set -e
mkdir -p /root/rizik
cat > /root/rizik/rizici.csv <<'EOF'
id,prijetnja,imovina,av,ef,aro
R1,Ransomware na file serveru,File server i podaci,400000,0.6,0.25
R2,Kvar diska bez redundanse,Baza narudžbi,120000,0.4,0.5
R3,Krađa laptopa sa podacima,Laptopi prodaje,60000,0.15,4
R4,Poplava u server sobi,Server soba,900000,0.8,0.02
EOF
cat > /root/rizik/kontrole.csv <<'EOF'
kontrola,rizik,godisnji_trosak,novi_ef,novi_aro
Nepromjenljivi backup i EDR,R1,30000,0.1,0.25
RAID 10 i monitoring,R2,8000,0.4,0.05
Enkripcija diska na laptopima,R3,6000,0.02,4
Premještanje u kolokaciju,R4,25000,0.8,0.002
EOF
-->

## SLE and ALE

For each risk, calculate the SLE and ALE and write them to `/root/rizik/analiza.csv` with the header `id,sle,ale` (rounded to whole numbers), sorted by ALE in descending order. Write the ID of the risk with the highest ALE to `/root/rizik/najveci.txt`.

<!-- verify
python3 - <<'EOF' || exit 1
import csv, sys
r = list(csv.DictReader(open("/root/rizik/rizici.csv")))
want = sorted([(x["id"], round(float(x["av"]) * float(x["ef"])), round(float(x["av"]) * float(x["ef"]) * float(x["aro"]))) for x in r], key=lambda t: -t[2])
try:
    got = [(g["id"], round(float(g["sle"])), round(float(g["ale"]))) for g in csv.DictReader(open("/root/rizik/analiza.csv"))]
except (FileNotFoundError, KeyError, ValueError):
    sys.exit("missing /root/rizik/analiza.csv with the header id,sle,ale")
if got != want: sys.exit(f"analiza.csv is incorrect or not sorted by ALE in descending order")
if open("/root/rizik/najveci.txt").read().strip() != want[0][0]: sys.exit("najveci.txt is incorrect")
EOF
-->
<!-- hint
SLE = AV × EF (loss in a single event), ALE = SLE × ARO (expected annual loss). E.g., R1: 400,000 × 0.6 = 240,000; × 0.25 = 60,000.
-->
<!-- solution
python3 - <<'EOF'
import csv
r = list(csv.DictReader(open("/root/rizik/rizici.csv")))
rows = sorted([(x["id"], round(float(x["av"]) * float(x["ef"])), round(float(x["av"]) * float(x["ef"]) * float(x["aro"]))) for x in r], key=lambda t: -t[2])
with open("/root/rizik/analiza.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "sle", "ale"]); w.writerows(rows)
open("/root/rizik/najveci.txt", "w").write(rows[0][0] + "\n")
EOF
-->

## Cost-effectiveness of controls

For each control, calculate the ALE after the control (with the new EF and ARO) and the **value of the control** = ALE before − ALE after − annual cost. Write the results to `/root/rizik/kontrole-ocjena.csv` with the header `kontrola,rizik,ale_prije,ale_poslije,vrijednost,preporuka` (whole numbers; `preporuka` is `uvesti` (implement) if the value is greater than 0, otherwise `ne` (no)).

<!-- verify
python3 - <<'EOF' || exit 1
import csv, sys
R = {x["id"]: x for x in csv.DictReader(open("/root/rizik/rizici.csv"))}
want = {}
for k in csv.DictReader(open("/root/rizik/kontrole.csv")):
    r = R[k["rizik"]]; av = float(r["av"])
    pre = av * float(r["ef"]) * float(r["aro"]); post = av * float(k["novi_ef"]) * float(k["novi_aro"])
    v = pre - post - float(k["godisnji_trosak"])
    want[k["kontrola"]] = (k["rizik"], round(pre), round(post), round(v), "uvesti" if v > 0 else "ne")
try:
    got = {g["kontrola"]: (g["rizik"], round(float(g["ale_prije"])), round(float(g["ale_poslije"])), round(float(g["vrijednost"])), g["preporuka"].strip()) for g in csv.DictReader(open("/root/rizik/kontrole-ocjena.csv"))}
except (FileNotFoundError, KeyError, ValueError):
    sys.exit("missing /root/rizik/kontrole-ocjena.csv with the required header")
for k, w in want.items():
    if k not in got: sys.exit(f"missing control: {k}")
    if got[k] != w: sys.exit(f"{k}: expected {w}, got {got[k]}")
EOF
-->
<!-- hint
A control that reduces risk but costs more than it saves is not cost-effective: the manager then chooses another control, or accepts or transfers the risk (e.g., insurance). Note: a control can change the EF (less damage per event) or the ARO (less frequent events).
-->
<!-- solution
python3 - <<'EOF'
import csv
R = {x["id"]: x for x in csv.DictReader(open("/root/rizik/rizici.csv"))}
with open("/root/rizik/kontrole-ocjena.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["kontrola", "rizik", "ale_prije", "ale_poslije", "vrijednost", "preporuka"])
    for k in csv.DictReader(open("/root/rizik/kontrole.csv")):
        r = R[k["rizik"]]; av = float(r["av"])
        pre = av * float(r["ef"]) * float(r["aro"]); post = av * float(k["novi_ef"]) * float(k["novi_aro"])
        v = pre - post - float(k["godisnji_trosak"])
        w.writerow([k["kontrola"], k["rizik"], round(pre), round(post), round(v), "uvesti" if v > 0 else "ne"])
EOF
-->
