# Lab 1: Otkrivanje i klasifikacija podataka

Prije zaštite moraš znati **gdje su osjetljivi podaci**. Tim je izvezao fajlove iz dijeljenog cloud storagea u `/root/storage/`. Napravićeš jednostavan alat za **data discovery** (prepoznavanje obrazaca), klasifikovati fajlove po politici i napraviti maskiranu kopiju za testno okruženje.

U cloudu ovo rade servisi kao Amazon Macie, Microsoft Purview ili Google Sensitive Data Protection; princip je isti: obrasci + provjera (npr. Luhn za kartice) + kontekst.

```bash
cd /root/storage && ls -la
head -5 *.csv *.txt
```

<!-- setup
set -e
mkdir -p /root/storage
cd /root/storage
cat > kupci.csv <<'EOF'
id,ime,email,iban
1,Ana Kovač,ana.kovac@primjer.ba,BA391290079401028494
2,Marko Petrović,marko.p@primjer.ba,BA393385804800211234
3,Jelena Ilić,jelena@primjer.rs,BA391011001234567890
EOF
cat > placanja.csv <<'EOF'
datum,iznos,kartica,status
2026-09-01,49.90,4111 1111 1111 1111,OK
2026-09-02,120.00,5555555555554444,OK
2026-09-03,15.00,4111 1111 1111 1112,ODBIJENO
EOF
cat > newsletter.txt <<'EOF'
Prijave za newsletter (septembar):
ivan@primjer.ba
sara.m@primjer.hr
EOF
cat > cjenovnik.txt <<'EOF'
Kafa 4.50 KM
Kakao 3.20 KM
Čaj 2.90 KM
Narudžba broj 1234 5678 9012 3456 nije pronađena.
EOF
cat > interni-plan.txt <<'EOF'
Plan migracije na novi CRM do kraja godine.
Kontakt: projekt@primjer.ba
EOF
-->

## Otkrivanje

Napiši `/root/discovery.py` koji za svaki fajl u `/root/storage/` utvrdi koje kategorije sadrži:

- `email`: adresa e-pošte,
- `iban`: IBAN (dva slova, dvije cifre, pa 11–30 alfanumeričkih znakova),
- `kartica`: broj kartice od 13–19 cifara (dozvoljeni razmaci ili crtice između grupa) koji **prolazi Luhn provjeru**.

Rezultat upiši u `/root/klasifikacija.csv` sa zaglavljem `fajl,kategorije` (ime fajla bez putanje; kategorije abecedno, razdvojene sa `;`, prazno ako ih nema), sortirano po imenu fajla.

<!-- verify
f=/root/klasifikacija.csv
[ -s $f ] || { echo "nema $f (pokreni /root/discovery.py)"; exit 1; }
python3 /root/discovery.py >/dev/null 2>&1 || { echo "discovery.py vraća grešku"; exit 1; }
want='fajl,kategorije
cjenovnik.txt,
interni-plan.txt,email
kupci.csv,email;iban
newsletter.txt,email
placanja.csv,kartica'
[ "$(head -6 $f | tr -d '\r')" = "$want" ] || { echo "klasifikacija.csv nije tačna. Očekivani format i redoslijed: fajl,kategorije; pazi da 4111 1111 1111 1112 i 1234 5678 9012 3456 ne prolaze Luhn"; cat $f; exit 1; }
-->
<!-- hint
Luhn: od desna udvostruči svaku drugu cifru, ako je rezultat > 9 oduzmi 9, saberi sve; broj je validan ako je zbir djeljiv sa 10.
```python
def luhn(s):
    d = [int(c) for c in s][::-1]
    t = sum(d[0::2]) + sum(sum(divmod(2 * x, 10)) for x in d[1::2])
    return t % 10 == 0
```
Kandidate za kartice traži regexom `\b(?:\d[ -]?){13,19}\b`, pa ukloni razmake/crtice prije Luhna.
-->
<!-- solution
cat > /root/discovery.py <<'EOF'
import csv, os, re
D = "/root/storage"
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")
CARD = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")
def luhn(s):
    d = [int(c) for c in s][::-1]
    t = sum(d[0::2]) + sum(sum(divmod(2 * x, 10)) for x in d[1::2])
    return t % 10 == 0
rows = []
for f in sorted(os.listdir(D)):
    s = open(os.path.join(D, f), encoding="utf-8").read()
    k = set()
    if EMAIL.search(s): k.add("email")
    if IBAN.search(s): k.add("iban")
    for m in CARD.finditer(s):
        n = re.sub(r"[ -]", "", m.group())
        if 13 <= len(n) <= 19 and luhn(n): k.add("kartica")
    rows.append([f, ";".join(sorted(k))])
with open("/root/klasifikacija.csv", "w", newline="") as o:
    w = csv.writer(o); w.writerow(["fajl", "kategorije"]); w.writerows(rows)
EOF
python3 /root/discovery.py
-->

## Klasa i maskiranje

Politika klasifikacije: fajl sa karticom ili IBAN-om je `Povjerljivo`, fajl samo sa e-poštom je `Interno`, ostalo je `Javno`. Dodaj kolonu `klasa` u `/root/klasifikacija.csv` (zaglavlje `fajl,kategorije,klasa`).

Zatim napravi maskirane kopije za testno okruženje u `/root/test-storage/` (isti nazivi fajlova): u svim fajlovima broj kartice zamijeni oblikom `**** **** **** 1111` (zadnje 4 cifre), a IBAN zadrži samo prva 4 i zadnja 4 znaka sa zvjezdicama između (npr. `BA39************8494`). Ostali sadržaj ostaje isti.

<!-- verify
f=/root/klasifikacija.csv
want='fajl,kategorije,klasa
cjenovnik.txt,,Javno
interni-plan.txt,email,Interno
kupci.csv,email;iban,Povjerljivo
newsletter.txt,email,Interno
placanja.csv,kartica,Povjerljivo'
[ "$(head -6 $f | tr -d '\r')" = "$want" ] || { echo "klasifikacija.csv (sa kolonom klasa) nije tačna"; cat $f; exit 1; }
t=/root/test-storage
for x in kupci.csv placanja.csv newsletter.txt cjenovnik.txt interni-plan.txt; do [ -f $t/$x ] || { echo "nema $t/$x"; exit 1; }; done
grep -q '4111 1111 1111 1111\|5555555555554444' $t/placanja.csv && { echo "brojevi kartica nisu maskirani"; exit 1; }
grep -q '^2026-09-01,49.90,\*\*\*\* \*\*\*\* \*\*\*\* 1111,OK$' $t/placanja.csv && grep -q '\*\*\*\* \*\*\*\* \*\*\*\* 4444' $t/placanja.csv || { echo "kartice treba maskirati kao **** **** **** <zadnje 4>"; exit 1; }
grep -q 'BA391290079401028494' $t/kupci.csv && { echo "IBAN nije maskiran"; exit 1; }
grep -q '^1,Ana Kovač,ana.kovac@primjer.ba,BA39\*\{12\}8494$' $t/kupci.csv || { echo "IBAN treba maskirati kao BA39************8494 (ostatak reda isti)"; exit 1; }
cmp -s /root/storage/cjenovnik.txt $t/cjenovnik.txt || { echo "cjenovnik.txt se ne smije mijenjati (1234 5678 9012 3456 nije validna kartica)"; exit 1; }
grep -q '4111 1111 1111 1112' $t/placanja.csv || { echo "4111 1111 1111 1112 nije validna kartica i ne treba je maskirati"; exit 1; }
-->
<!-- hint
Maskiraj samo ono što je otkrivanje prepoznalo (Luhn), inače maskiraš i brojeve narudžbi. U Pythonu: `re.sub(pattern, funkcija, tekst)` gdje funkcija provjeri Luhn i vrati maskiranu ili originalnu vrijednost.
-->
<!-- solution
python3 - <<'EOF'
import csv, os, re
D, T = "/root/storage", "/root/test-storage"
os.makedirs(T, exist_ok=True)
IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")
CARD = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")
def luhn(s):
    d = [int(c) for c in s][::-1]
    return (sum(d[0::2]) + sum(sum(divmod(2 * x, 10)) for x in d[1::2])) % 10 == 0
def card(m):
    n = re.sub(r"[ -]", "", m.group())
    return f"**** **** **** {n[-4:]}" if 13 <= len(n) <= 19 and luhn(n) else m.group()
for f in os.listdir(D):
    s = open(os.path.join(D, f), encoding="utf-8").read()
    s = CARD.sub(card, s)
    s = IBAN.sub(lambda m: m.group()[:4] + "*" * (len(m.group()) - 8) + m.group()[-4:], s)
    open(os.path.join(T, f), "w", encoding="utf-8").write(s)
rows = list(csv.reader(open("/root/klasifikacija.csv")))
out = [["fajl", "kategorije", "klasa"]]
for f, k in rows[1:]:
    ks = set(k.split(";")) if k else set()
    out.append([f, k, "Povjerljivo" if ks & {"kartica", "iban"} else ("Interno" if "email" in ks else "Javno")])
with open("/root/klasifikacija.csv", "w", newline="") as o:
    csv.writer(o).writerows(out)
EOF
-->
