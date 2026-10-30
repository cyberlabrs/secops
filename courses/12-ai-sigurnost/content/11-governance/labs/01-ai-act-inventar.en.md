# Lab 1: AI system inventory and classification under the EU AI Act

The first step of AI governance is an **inventory**: which AI systems the company uses or develops, who owns them and which risk category they fall into under the EU AI Act (Regulation (EU) 2024/1689, as amended by the "AI Omnibus," Regulation (EU) 2026/1744). The category determines the obligations: from a prohibition, through a strict conformity assessment, to just a transparency obligation.

The list of use cases is in `/root/ai-act/slucajevi.json` (`slucajevi` = cases, `opis` = description). The descriptions are in Serbian; in English they read:

| ID | Use case |
|---|---|
| S1 | A website chatbot that answers customers' questions about orders |
| S2 | A system that ranks and filters job candidates' CVs |
| S3 | A spam filter for employees' email |
| S4 | A camera that analyzes employees' emotions during work to assess performance |
| S5 | A model that assesses the creditworthiness of natural persons for loan approval |
| S6 | Generating realistic images and videos of people for a marketing campaign |
| S7 | Scoring citizens by their social behavior to grant access to public services |
| S8 | Product recommendations for web shop customers based on previous purchases |
| S9 | AI software that is a safety component of a diagnostic medical device |

```bash
cd /root/ai-act
jq -r '.[] | "\(.id)  \(.opis)"' slucajevi.json
```

<!-- setup
set -e
mkdir -p /root/ai-act
cat > /root/ai-act/slucajevi.json <<'EOF'
[
  {"id": "S1", "opis": "Chatbot na web stranici koji odgovara kupcima na pitanja o narudžbama"},
  {"id": "S2", "opis": "Sistem koji rangira i filtrira CV-jeve kandidata za zapošljavanje"},
  {"id": "S3", "opis": "Filter neželjene e-pošte (spam) za zaposlene"},
  {"id": "S4", "opis": "Kamera sa analizom emocija zaposlenih tokom rada radi procjene učinka"},
  {"id": "S5", "opis": "Model koji procjenjuje kreditnu sposobnost fizičkih lica za odobravanje kredita"},
  {"id": "S6", "opis": "Generisanje realističnih slika i videa osoba za marketinšku kampanju"},
  {"id": "S7", "opis": "Bodovanje građana prema društvenom ponašanju radi pristupa javnim uslugama"},
  {"id": "S8", "opis": "Preporuka proizvoda kupcima u web shopu na osnovu prethodnih kupovina"},
  {"id": "S9", "opis": "AI softver koji je sigurnosna komponenta medicinskog uređaja za dijagnostiku"}
]
EOF
-->

## Classification

For each case determine the category and write an object `{"S1": "<category>", …}` to `/root/ai-act/klasifikacija.json`. Use exactly these Serbian category values, because the check compares them:

- `zabranjeno` (prohibited): prohibited practices (Art. 5),
- `visok_rizik` (high risk): high-risk systems (Annex III, or safety components of products under Annex I),
- `transparentnost` (transparency): systems with transparency obligations (Art. 50: interaction with people, synthetic content),
- `minimalan` (minimal): everything else.

<!-- verify
f=/root/ai-act/klasifikacija.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
want='{"S1":"transparentnost","S2":"visok_rizik","S3":"minimalan","S4":"zabranjeno","S5":"visok_rizik","S6":"transparentnost","S7":"zabranjeno","S8":"minimalan","S9":"visok_rizik"}'
got=$(jq -S -c . $f)
[ "$got" = "$(echo "$want" | jq -S -c .)" ] || {
  echo "some cases are not classified correctly:"
  jq -r --argjson w "$want" 'to_entries[] | select(.value != $w[.key]) | .key' $f | tr '\n' ' '; echo
  exit 1; }
-->
<!-- hint
- Employment (candidate selection) and the creditworthiness of natural persons are on the Annex III list.
- Emotion recognition in the workplace is prohibited (except for medical or safety reasons), as is social scoring.
- A chatbot must say it is AI; synthetic images and video (deepfakes) must be labeled.
- AI as a safety component of a product under sectoral legislation (Annex I, e.g., medical devices) is high-risk.
-->
<!-- solution
echo '{"S1":"transparentnost","S2":"visok_rizik","S3":"minimalan","S4":"zabranjeno","S5":"visok_rizik","S6":"transparentnost","S7":"zabranjeno","S8":"minimalan","S9":"visok_rizik"}' | jq . > /root/ai-act/klasifikacija.json
-->

## Deadlines and inventory

Create `/root/ai-act/inventar.csv` with the header `id,kategorija,primjenjuje_se_od,vlasnik` (id, category, applies from, owner) for **all** cases:

- `primjenjuje_se_od`: the date from which the obligations for that category apply (format `YYYY-MM-DD`):
  - prohibited practices: `2025-02-02`,
  - transparency (Art. 50): `2026-08-02`,
  - high risk under Annex III (S2, S5): the deadline from the AI Omnibus,
  - high risk under Annex I (S9): the deadline from the AI Omnibus,
  - minimal: empty;
- `vlasnik`: the name of the responsible person or team (anything non-empty; an inventory without owners is worthless).

<!-- verify
f=/root/ai-act/inventar.csv
[ -s $f ] || { echo "$f is missing"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "id,kategorija,primjenjuje_se_od,vlasnik" ] || { echo "the header must be id,kategorija,primjenjuje_se_od,vlasnik"; exit 1; }
python3 - <<'EOF' || exit 1
import csv, json, sys
k = json.load(open("/root/ai-act/klasifikacija.json"))
datum = {"zabranjeno": "2025-02-02", "transparentnost": "2026-08-02", "minimalan": ""}
hr = {"S2": "2027-12-02", "S5": "2027-12-02", "S9": "2028-08-02"}
rows = {r["id"]: r for r in csv.DictReader(open("/root/ai-act/inventar.csv"))}
if set(rows) != set(k): sys.exit("the inventory needs all cases S1–S9")
for i, r in rows.items():
    if r["kategorija"] != k[i]: sys.exit(f"{i}: kategorija does not match klasifikacija.json")
    w = hr[i] if k[i] == "visok_rizik" else datum[k[i]]
    if r["primjenjuje_se_od"].strip() != w: sys.exit(f"{i}: primjenjuje_se_od is not correct")
    if not r["vlasnik"].strip(): sys.exit(f"{i}: no owner (vlasnik)")
EOF
-->
<!-- hint
The AI Omnibus (in force since 27 Jul 2026) moved the obligations for high-risk systems: standalone systems under Annex III from 2 Dec 2027, and systems embedded in products under Annex I from 2 Aug 2028. The prohibitions (from 2 Feb 2025) and the obligations for GPAI models (from 2 Aug 2025) were not moved.
-->
<!-- solution
python3 - <<'EOF'
import csv, json
k = json.load(open("/root/ai-act/klasifikacija.json"))
datum = {"zabranjeno": "2025-02-02", "transparentnost": "2026-08-02", "minimalan": ""}
hr = {"S2": "2027-12-02", "S5": "2027-12-02", "S9": "2028-08-02"}
vl = {"S1": "Tim za podršku", "S2": "HR", "S3": "IT operacije", "S4": "HR", "S5": "Kreditni rizik", "S6": "Marketing", "S7": "Pravna služba", "S8": "E-commerce", "S9": "Medicinski proizvodi"}
with open("/root/ai-act/inventar.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "kategorija", "primjenjuje_se_od", "vlasnik"])
    for i in sorted(k): w.writerow([i, k[i], hr[i] if k[i] == "visok_rizik" else datum[k[i]], vl[i]])
EOF
-->
