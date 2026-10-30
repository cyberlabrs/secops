# Lab 1: Find, classify, and protect sensitive data

All sorts of things have piled up on the shared drive `/srv/share`. Before the migration to the cloud, you need to find the files containing payment card numbers (PCI DSS), label them, and protect them. That's what a **DLP** tool does automatically: it recognizes patterns, reduces false positives through validation (e.g., the Luhn algorithm for cards), and applies protection.

Methods from objective 3.3 that you'll apply: **masking**, **deidentification** (pseudonymization with a hash), and **marking/labeling**.

<!-- setup
set -e
mkdir -p /srv/share/{prodaja,hr,marketing,it} /root/dlp
python3 - <<'PY'
import random
random.seed(3)
def luhn_ok(n):
    s=0
    for i,d in enumerate(reversed(n)):
        d=int(d)
        if i%2==1:
            d*=2
            if d>9: d-=9
        s+=d
    return s%10==0
def make_card(prefix):
    while True:
        n = prefix + "".join(str(random.randint(0,9)) for _ in range(15-len(prefix)))
        for c in "0123456789":
            if luhn_ok(n+c): return n+c
rows=["id,kupac,email,kartica,iznos"]
for i in range(1,9):
    c=make_card(random.choice(["4","51","55"]))
    rows.append(f"{i},Kupac {i},kupac{i}@primjer.ba,{c[:4]} {c[4:8]} {c[8:12]} {c[12:]},{random.randint(20,900)}.00")
open("/srv/share/prodaja/export-2026-09.csv","w").write("\n".join(rows)+"\n")
open("/srv/share/marketing/kampanja.txt","w").write("Kod za popust: 4111 2222 3333 4444 vrijedi do kraja mjeseca.\nTelefon podrške: 033 123 456\n")
c=make_card("4")
open("/srv/share/it/stari-ticket-4471.txt","w").write(f"Korisnik je u ticket upisao karticu {c} da provjerimo uplatu.\n")
open("/srv/share/hr/plate.csv","w").write("ime,jmbg,neto\nAna A.,0101990170001,2100\nMarko M.,1505985170012,2400\n")
open("/srv/share/marketing/brosura.txt","w").write("Posjetite nas na sajmu. Broj štanda 12.\n")
open("/srv/share/it/inventar.csv","w").write("serijski,model\n1234567890123456,Laptop X1\n")
PY
cat > /usr/local/bin/luhn <<'EOF'
#!/usr/bin/env python3
# čita brojeve (sa razmacima ili crticama) sa stdin-a i ispisuje samo one koji prolaze Luhn provjeru
import sys, re
def ok(n):
    s = 0
    for i, d in enumerate(reversed(n)):
        d = int(d)
        if i % 2: d = d * 2 - 9 if d * 2 > 9 else d * 2
        s += d
    return s % 10 == 0
for line in sys.stdin:
    n = re.sub(r"[ -]", "", line.strip())
    if 13 <= len(n) <= 19 and n.isdigit() and ok(n): print(line.strip())
EOF
chmod 755 /usr/local/bin/luhn
chmod -R a+rwX /srv/share
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: DLP ===
Podaci: /srv/share   Pomoćni alat: luhn   Rezultati: /root/dlp/
EOF
-->

## Find the candidates

A regular expression for a card number (13–16 digits, optionally with spaces or dashes):

```bash
cd /srv/share
grep -rEn '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' .
```

Look at the results. Some are real cards and some aren't: a discount code, a laptop serial number. These are **false positives**, and they're the reason people disable DLP rules.

## Reduce false positives with a Luhn check

Card numbers have a check digit (the Luhn algorithm). Pass the candidates through `luhn` and keep only the files with real cards:

```bash
for f in $(grep -rlE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' /srv/share); do
  if grep -oE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' "$f" | luhn | grep -q .; then echo "$f"; fi
done | sort > /root/dlp/nalazi.txt
cat /root/dlp/nalazi.txt
```

Check the list. It should contain only the files with real card numbers, not the discount code or the serial number.

<!-- verify
got=$(sort -u /root/dlp/nalazi.txt 2>/dev/null | grep . | xargs)
want="/srv/share/it/stari-ticket-4471.txt /srv/share/prodaja/export-2026-09.csv"
[ "$got" = "$want" ] || { echo "Got: $got"; exit 1; }
-->
<!-- hint
`4111 2222 3333 4444` doesn't pass the Luhn check, and neither does the serial number `1234567890123456`. If they stay on your list, make sure you're filtering through `luhn`.
-->
<!-- solution
for f in $(grep -rlE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' /srv/share); do if grep -oE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' "$f" | luhn | grep -q .; then echo "$f"; fi; done | sort > /root/dlp/nalazi.txt
-->

## Mask the export for analytics

Analysts need the sales export, but not the full card numbers. Create `/root/dlp/export-masked.csv` in which **only the last 4 digits** of the card are visible (`**** **** **** 1234`), like on a store receipt.

```bash
sed -E 's/\b[0-9]{4} [0-9]{4} [0-9]{4} ([0-9]{4})\b/**** **** **** \1/' \
  /srv/share/prodaja/export-2026-09.csv > /root/dlp/export-masked.csv
cat /root/dlp/export-masked.csv
```

**Masking** is irreversible for whoever views the data. When a system also needs the original number (e.g., for a refund), **tokenization** is used: the card is replaced with a token, and the original is kept only in the token vault at the payment processor.

<!-- verify
f=/root/dlp/export-masked.csv
[ -s $f ] || { echo "$f is missing"; exit 1; }
[ $(wc -l < $f) -eq 9 ] || { echo "The file should have 9 lines (header + 8 rows)"; exit 1; }
grep -qE '[0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4}' $f && { echo "The file still contains a full card number"; exit 1; }
orig=$(cut -d, -f4 /srv/share/prodaja/export-2026-09.csv | tail -n +2 | awk '{print $4}' | xargs)
got=$(cut -d, -f4 $f | tail -n +2 | awk '{print $4}' | xargs)
[ "$orig" = "$got" ] || { echo "The last 4 digits were not preserved"; exit 1; }
-->
<!-- solution
sed -E 's/\b[0-9]{4} [0-9]{4} [0-9]{4} ([0-9]{4})\b/**** **** **** \1/' /srv/share/prodaja/export-2026-09.csv > /root/dlp/export-masked.csv
-->

## Deidentify the HR data

`hr/plate.csv` (salaries) contains the JMBG (a national ID number). For salary statistics by birth year we don't need the person's identity. Create `/root/dlp/plate-pseudo.csv` in which the JMBG is replaced with an HMAC-SHA256 value using a secret key (**pseudonymization**). The same JMBG always produces the same pseudonym, so records can still be joined. Without the key, the JMBG can't be derived from the pseudonym.

```bash
openssl rand -hex 32 > /root/dlp/pseudo.key && chmod 600 /root/dlp/pseudo.key
K=$(cat /root/dlp/pseudo.key)
{ echo "ime,id,neto"; tail -n +2 /srv/share/hr/plate.csv | while IFS=, read ime jmbg neto; do
  h=$(printf '%s' "$jmbg" | openssl dgst -sha256 -hmac "$K" -r | cut -c1-16)
  echo "$ime,$h,$neto"; done; } > /root/dlp/plate-pseudo.csv
cat /root/dlp/plate-pseudo.csv
```

> A plain hash of the JMBG **without** a key isn't enough: the JMBG has few possible values and a known structure (date of birth, region), so it can be brute-forced. That's why HMAC with a secret key. Under GDPR, pseudonymized data is still personal data; only **anonymized** data isn't.

<!-- verify
f=/root/dlp/plate-pseudo.csv
[ -s $f ] || { echo "$f is missing"; exit 1; }
grep -qE '[0-9]{13}' $f && { echo "The file still contains a JMBG"; exit 1; }
K=$(cat /root/dlp/pseudo.key 2>/dev/null) ; [ -n "$K" ] || { echo "The key /root/dlp/pseudo.key is missing"; exit 1; }
want=$(printf '%s' 0101990170001 | openssl dgst -sha256 -hmac "$K" -r | cut -c1-16)
grep -q "$want" $f || { echo "The pseudonym does not match the HMAC-SHA256 value with the key"; exit 1; }
-->
<!-- solution
openssl rand -hex 32 > /root/dlp/pseudo.key && chmod 600 /root/dlp/pseudo.key
K=$(cat /root/dlp/pseudo.key)
{ echo "ime,id,neto"; tail -n +2 /srv/share/hr/plate.csv | while IFS=, read ime jmbg neto; do h=$(printf '%s' "$jmbg" | openssl dgst -sha256 -hmac "$K" -r | cut -c1-16); echo "$ime,$h,$neto"; done; } > /root/dlp/plate-pseudo.csv
-->

## Label and protect the originals

Classification without access control is just a label. For the three files with sensitive data (the two with cards and `hr/plate.csv`):

1. add the file and the label `Restricted` to the classification register `/root/dlp/klasifikacija.csv` (format `putanja,oznaka`, i.e., path,label),
2. remove access for everyone except the owner (`chmod 600`, owner root).

```bash
for f in /srv/share/prodaja/export-2026-09.csv /srv/share/it/stari-ticket-4471.txt /srv/share/hr/plate.csv; do
  chown root:root "$f"; chmod 600 "$f"; echo "$f,Restricted" >> /root/dlp/klasifikacija.csv
done
cat /root/dlp/klasifikacija.csv
ls -l /srv/share/*/
```

In the cloud you'd do the same with **tags** on objects (e.g., `classification=restricted`), policies that use them, and services such as Amazon Macie or Microsoft Purview, which perform this discovery automatically.

<!-- verify
for f in /srv/share/prodaja/export-2026-09.csv /srv/share/it/stari-ticket-4471.txt /srv/share/hr/plate.csv; do
  [ "$(stat -c '%a %U' $f)" = "600 root" ] || { echo "$f is not 600 root"; exit 1; }
  grep -q "^$f,Restricted$" /root/dlp/klasifikacija.csv 2>/dev/null || { echo "$f is not in the register as Restricted"; exit 1; }
done
[ "$(stat -c %a /srv/share/marketing/brosura.txt)" = 600 ] && { echo "The public file brosura.txt should not be locked down"; exit 1; }
exit 0
-->
<!-- solution
for f in /srv/share/prodaja/export-2026-09.csv /srv/share/it/stari-ticket-4471.txt /srv/share/hr/plate.csv; do chown root:root "$f"; chmod 600 "$f"; echo "$f,Restricted" >> /root/dlp/klasifikacija.csv; done
-->
