# Lab 1: Data discovery and classification

Before protecting data, you must know **where the sensitive data is**. The team exported files from shared cloud storage to `/root/storage/`. You will build a simple **data discovery** tool (pattern recognition), classify the files according to policy, and create a masked copy for the test environment.

In the cloud, this is done by services such as Amazon Macie, Microsoft Purview, or Google Sensitive Data Protection; the principle is the same: patterns + validation (e.g., Luhn for cards) + context.

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

## Discovery

Write `/root/discovery.py` that determines, for each file in `/root/storage/`, which categories it contains:

- `email`: an email address,
- `iban`: an IBAN (two letters, two digits, then 11–30 alphanumeric characters),
- `kartica` (card): a card number of 13–19 digits (spaces or hyphens allowed between groups) that **passes the Luhn check**.

Write the result to `/root/klasifikacija.csv` with the header `fajl,kategorije` (file name without path; categories in alphabetical order, separated by `;`, empty if there are none), sorted by file name.

<!-- verify
f=/root/klasifikacija.csv
[ -s $f ] || { echo "missing $f (run /root/discovery.py)"; exit 1; }
python3 /root/discovery.py >/dev/null 2>&1 || { echo "discovery.py returns an error"; exit 1; }
want='fajl,kategorije
cjenovnik.txt,
interni-plan.txt,email
kupci.csv,email;iban
newsletter.txt,email
placanja.csv,kartica'
[ "$(head -6 $f | tr -d '\r')" = "$want" ] || { echo "klasifikacija.csv is not correct. Expected format and order: fajl,kategorije; note that 4111 1111 1111 1112 and 1234 5678 9012 3456 do not pass Luhn"; cat $f; exit 1; }
-->
<!-- hint
Luhn: starting from the right, double every second digit, if the result is > 9 subtract 9, add everything up; the number is valid if the sum is divisible by 10.
```python
def luhn(s):
    d = [int(c) for c in s][::-1]
    t = sum(d[0::2]) + sum(sum(divmod(2 * x, 10)) for x in d[1::2])
    return t % 10 == 0
```
Find card candidates with the regex `\b(?:\d[ -]?){13,19}\b`, then remove spaces/hyphens before the Luhn check.
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

## Class and masking

Classification policy: a file with a card or an IBAN is `Povjerljivo` (Confidential), a file with only email is `Interno` (Internal), everything else is `Javno` (Public). Add a `klasa` (class) column to `/root/klasifikacija.csv` (header `fajl,kategorije,klasa`).

Then create masked copies for the test environment in `/root/test-storage/` (same file names): in all files, replace the card number with the form `**** **** **** 1111` (last 4 digits), and for the IBAN keep only the first 4 and last 4 characters with asterisks in between (e.g., `BA39************8494`). All other content stays the same.

<!-- verify
f=/root/klasifikacija.csv
want='fajl,kategorije,klasa
cjenovnik.txt,,Javno
interni-plan.txt,email,Interno
kupci.csv,email;iban,Povjerljivo
newsletter.txt,email,Interno
placanja.csv,kartica,Povjerljivo'
[ "$(head -6 $f | tr -d '\r')" = "$want" ] || { echo "klasifikacija.csv (with the klasa column) is not correct"; cat $f; exit 1; }
t=/root/test-storage
for x in kupci.csv placanja.csv newsletter.txt cjenovnik.txt interni-plan.txt; do [ -f $t/$x ] || { echo "missing $t/$x"; exit 1; }; done
grep -q '4111 1111 1111 1111\|5555555555554444' $t/placanja.csv && { echo "card numbers are not masked"; exit 1; }
grep -q '^2026-09-01,49.90,\*\*\*\* \*\*\*\* \*\*\*\* 1111,OK$' $t/placanja.csv && grep -q '\*\*\*\* \*\*\*\* \*\*\*\* 4444' $t/placanja.csv || { echo "cards must be masked as **** **** **** <last 4>"; exit 1; }
grep -q 'BA391290079401028494' $t/kupci.csv && { echo "IBAN is not masked"; exit 1; }
grep -q '^1,Ana Kovač,ana.kovac@primjer.ba,BA39\*\{12\}8494$' $t/kupci.csv || { echo "IBAN must be masked as BA39************8494 (rest of the line unchanged)"; exit 1; }
cmp -s /root/storage/cjenovnik.txt $t/cjenovnik.txt || { echo "cjenovnik.txt must not be changed (1234 5678 9012 3456 is not a valid card)"; exit 1; }
grep -q '4111 1111 1111 1112' $t/placanja.csv || { echo "4111 1111 1111 1112 is not a valid card and must not be masked"; exit 1; }
-->
<!-- hint
Mask only what discovery recognized (Luhn), otherwise you will also mask order numbers. In Python: `re.sub(pattern, function, text)` where the function checks Luhn and returns the masked or the original value.
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
