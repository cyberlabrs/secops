# Lab 1: Kvantitativna analiza rizika

Na CISSP ispitu se računa: **SLE = AV × EF**, **ALE = SLE × ARO**, a kontrola je isplativa ako je smanjenje ALE-a veće od njene godišnje cijene (**vrijednost kontrole = ALE prije − ALE poslije − godišnji trošak kontrole**). Uradićeš analizu za registar rizika jedne firme i preporučiti kontrole.

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

## SLE i ALE

Za svaki rizik izračunaj SLE i ALE i upiši u `/root/rizik/analiza.csv` sa zaglavljem `id,sle,ale` (zaokruženo na cijeli broj), sortirano po ALE opadajuće. U `/root/rizik/najveci.txt` upiši ID rizika sa najvećim ALE.

<!-- verify
python3 - <<'EOF' || exit 1
import csv, sys
r = list(csv.DictReader(open("/root/rizik/rizici.csv")))
want = sorted([(x["id"], round(float(x["av"]) * float(x["ef"])), round(float(x["av"]) * float(x["ef"]) * float(x["aro"]))) for x in r], key=lambda t: -t[2])
try:
    got = [(g["id"], round(float(g["sle"])), round(float(g["ale"]))) for g in csv.DictReader(open("/root/rizik/analiza.csv"))]
except (FileNotFoundError, KeyError, ValueError):
    sys.exit("nema /root/rizik/analiza.csv sa zaglavljem id,sle,ale")
if got != want: sys.exit(f"analiza.csv nije tačna ili nije sortirana po ALE opadajuće")
if open("/root/rizik/najveci.txt").read().strip() != want[0][0]: sys.exit("najveci.txt nije tačan")
EOF
-->
<!-- hint
SLE = AV × EF (gubitak u jednom događaju), ALE = SLE × ARO (očekivani godišnji gubitak). Npr. R1: 400 000 × 0,6 = 240 000; × 0,25 = 60 000.
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

## Isplativost kontrola

Za svaku kontrolu izračunaj ALE poslije kontrole (sa novim EF i ARO) i **vrijednost kontrole** = ALE prije − ALE poslije − godišnji trošak. Upiši u `/root/rizik/kontrole-ocjena.csv` sa zaglavljem `kontrola,rizik,ale_prije,ale_poslije,vrijednost,preporuka` (cijeli brojevi; `preporuka` je `uvesti` ako je vrijednost veća od 0, inače `ne`).

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
    sys.exit("nema /root/rizik/kontrole-ocjena.csv sa traženim zaglavljem")
for k, w in want.items():
    if k not in got: sys.exit(f"nedostaje kontrola: {k}")
    if got[k] != w: sys.exit(f"{k}: očekivano {w}, ima {got[k]}")
EOF
-->
<!-- hint
Kontrola koja smanji rizik ali košta više nego što uštedi nije isplativa: menadžer tada bira drugu kontrolu, prihvata ili prenosi rizik (npr. osiguranje). Pazi: kontrola može mijenjati EF (manja šteta po događaju) ili ARO (rjeđi događaji).
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
