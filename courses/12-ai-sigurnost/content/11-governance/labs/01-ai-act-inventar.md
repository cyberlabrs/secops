# Lab 1: Inventar AI sistema i klasifikacija po EU AI Actu

Prvi korak AI governancea je **inventar**: koje AI sisteme firma koristi ili razvija, ko je vlasnik i u koju kategoriju rizika spadaju po EU AI Actu (Uredba (EU) 2024/1689, sa izmjenama iz „AI Omnibusa“, Uredba (EU) 2026/1744). Kategorija određuje obaveze: od zabrane, preko stroge procjene usklađenosti, do samo obaveze transparentnosti.

Lista slučajeva upotrebe je u `/root/ai-act/slucajevi.json`.

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

## Klasifikacija

Za svaki slučaj odredi kategoriju i upiši u `/root/ai-act/klasifikacija.json` objekat `{"S1": "<kategorija>", …}`. Kategorije:

- `zabranjeno`: zabranjene prakse (čl. 5),
- `visok_rizik`: visokorizični sistemi (Aneks III, ili sigurnosne komponente proizvoda iz Aneksa I),
- `transparentnost`: sistemi sa obavezama transparentnosti (čl. 50: interakcija sa ljudima, sintetički sadržaj),
- `minimalan`: ostalo.

<!-- verify
f=/root/ai-act/klasifikacija.json
jq -e . $f >/dev/null 2>&1 || { echo "$f ne postoji ili nije JSON"; exit 1; }
want='{"S1":"transparentnost","S2":"visok_rizik","S3":"minimalan","S4":"zabranjeno","S5":"visok_rizik","S6":"transparentnost","S7":"zabranjeno","S8":"minimalan","S9":"visok_rizik"}'
got=$(jq -S -c . $f)
[ "$got" = "$(echo "$want" | jq -S -c .)" ] || {
  echo "neki slučajevi nisu tačno klasifikovani:"
  jq -r --argjson w "$want" 'to_entries[] | select(.value != $w[.key]) | .key' $f | tr '\n' ' '; echo
  exit 1; }
-->
<!-- hint
- Zapošljavanje (selekcija kandidata) i kreditna sposobnost fizičkih lica su na listi Aneksa III.
- Prepoznavanje emocija na radnom mjestu je zabranjeno (osim iz medicinskih ili sigurnosnih razloga), kao i socijalno bodovanje.
- Chatbot mora reći da je AI; sintetičke slike i video (deepfake) moraju biti označeni.
- AI kao sigurnosna komponenta proizvoda pod sektorskim propisima (Aneks I, npr. medicinski uređaji) je visokorizičan.
-->
<!-- solution
echo '{"S1":"transparentnost","S2":"visok_rizik","S3":"minimalan","S4":"zabranjeno","S5":"visok_rizik","S6":"transparentnost","S7":"zabranjeno","S8":"minimalan","S9":"visok_rizik"}' | jq . > /root/ai-act/klasifikacija.json
-->

## Rokovi i inventar

Napravi `/root/ai-act/inventar.csv` sa zaglavljem `id,kategorija,primjenjuje_se_od,vlasnik` za **sve** slučajeve:

- `primjenjuje_se_od`: datum od kada se primjenjuju obaveze za tu kategoriju (format `GGGG-MM-DD`):
  - zabranjene prakse: `2025-02-02`,
  - transparentnost (čl. 50): `2026-08-02`,
  - visok rizik iz Aneksa III (S2, S5): rok iz AI Omnibusa,
  - visok rizik iz Aneksa I (S9): rok iz AI Omnibusa,
  - minimalan: prazno;
- `vlasnik`: ime odgovorne osobe ili tima (bilo šta neprazno; inventar bez vlasnika ne vrijedi).

<!-- verify
f=/root/ai-act/inventar.csv
[ -s $f ] || { echo "nema $f"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "id,kategorija,primjenjuje_se_od,vlasnik" ] || { echo "zaglavlje treba id,kategorija,primjenjuje_se_od,vlasnik"; exit 1; }
python3 - <<'EOF' || exit 1
import csv, json, sys
k = json.load(open("/root/ai-act/klasifikacija.json"))
datum = {"zabranjeno": "2025-02-02", "transparentnost": "2026-08-02", "minimalan": ""}
hr = {"S2": "2027-12-02", "S5": "2027-12-02", "S9": "2028-08-02"}
rows = {r["id"]: r for r in csv.DictReader(open("/root/ai-act/inventar.csv"))}
if set(rows) != set(k): sys.exit("inventar treba sve slučajeve S1–S9")
for i, r in rows.items():
    if r["kategorija"] != k[i]: sys.exit(f"{i}: kategorija se ne slaže sa klasifikacija.json")
    w = hr[i] if k[i] == "visok_rizik" else datum[k[i]]
    if r["primjenjuje_se_od"].strip() != w: sys.exit(f"{i}: primjenjuje_se_od nije tačan")
    if not r["vlasnik"].strip(): sys.exit(f"{i}: nema vlasnika")
EOF
-->
<!-- hint
AI Omnibus (na snazi od 27. 7. 2026) pomjerio je obaveze za visokorizične sisteme: samostalni sistemi iz Aneksa III od 2. 12. 2027, a sistemi ugrađeni u proizvode iz Aneksa I od 2. 8. 2028. Zabrane (od 2. 2. 2025) i obaveze za GPAI modele (od 2. 8. 2025) nisu pomjerene.
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
