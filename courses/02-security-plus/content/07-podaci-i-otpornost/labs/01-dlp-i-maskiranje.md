# Lab 1: Pronađi, klasifikuj i zaštiti osjetljive podatke

Na dijeljenom disku `/srv/share` je nakupljeno svega i svačega. Prije migracije u cloud treba pronaći fajlove sa brojevima platnih kartica (PCI DSS), označiti ih i zaštititi. To je ono što **DLP** alat radi automatski: prepoznaje obrasce, smanjuje lažne pozitive validacijom (npr. Luhn algoritam za kartice) i primjenjuje zaštitu.

Metode iz cilja 3.3 koje ćeš primijeniti: **masking**, **deidentification** (pseudonimizacija hash-om) i **marking/labeling**.

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

## Pronađi kandidate

Regularni izraz za broj kartice (13–16 cifara, opciono sa razmacima ili crticama):

```bash
cd /srv/share
grep -rEn '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' .
```

Pogledaj rezultate. Neki su stvarne kartice, a neki nisu: kod za popust, serijski broj laptopa. Ovo su **lažni pozitivi** i zbog njih ljudi isključuju DLP pravila.

## Smanji lažne pozitive Luhn provjerom

Brojevi kartica imaju kontrolnu cifru (Luhn algoritam). Propusti kandidate kroz `luhn` i zadrži samo fajlove sa stvarnim karticama:

```bash
for f in $(grep -rlE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' /srv/share); do
  if grep -oE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' "$f" | luhn | grep -q .; then echo "$f"; fi
done | sort > /root/dlp/nalazi.txt
cat /root/dlp/nalazi.txt
```

Provjeri listu. Treba da sadrži samo fajlove sa stvarnim brojevima kartica, a ne i kod za popust ni serijski broj.

<!-- verify
got=$(sort -u /root/dlp/nalazi.txt 2>/dev/null | grep . | xargs)
want="/srv/share/it/stari-ticket-4471.txt /srv/share/prodaja/export-2026-09.csv"
[ "$got" = "$want" ] || { echo "Dobijeno: $got"; exit 1; }
-->
<!-- hint
`4111 2222 3333 4444` ne prolazi Luhn provjeru, a serijski broj `1234567890123456` takođe ne. Ako ti oni ostanu na listi, provjeri da filtriraš kroz `luhn`.
-->
<!-- solution
for f in $(grep -rlE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' /srv/share); do if grep -oE '\b([0-9]{4}[ -]?){3}[0-9]{1,4}\b' "$f" | luhn | grep -q .; then echo "$f"; fi; done | sort > /root/dlp/nalazi.txt
-->

## Maskiraj izvoz za analitiku

Analitičarima treba izvoz prodaje, ali ne i puni brojevi kartica. Napravi `/root/dlp/export-masked.csv` u kojem je od kartice vidljivo **samo zadnje 4 cifre** (`**** **** **** 1234`), kao na računu iz prodavnice.

```bash
sed -E 's/\b[0-9]{4} [0-9]{4} [0-9]{4} ([0-9]{4})\b/**** **** **** \1/' \
  /srv/share/prodaja/export-2026-09.csv > /root/dlp/export-masked.csv
cat /root/dlp/export-masked.csv
```

**Masking** je nepovratan za onoga ko vidi podatak. Kad sistemu treba i originalni broj (npr. za povrat novca), koristi se **tokenization**: kartica se zamijeni tokenom, a original čuva samo trezor tokena kod procesora plaćanja.

<!-- verify
f=/root/dlp/export-masked.csv
[ -s $f ] || { echo "Nema $f"; exit 1; }
[ $(wc -l < $f) -eq 9 ] || { echo "Fajl treba imati 9 linija (zaglavlje + 8 redova)"; exit 1; }
grep -qE '[0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4}' $f && { echo "U fajlu je i dalje pun broj kartice"; exit 1; }
orig=$(cut -d, -f4 /srv/share/prodaja/export-2026-09.csv | tail -n +2 | awk '{print $4}' | xargs)
got=$(cut -d, -f4 $f | tail -n +2 | awk '{print $4}' | xargs)
[ "$orig" = "$got" ] || { echo "Zadnje 4 cifre nisu sačuvane"; exit 1; }
-->
<!-- solution
sed -E 's/\b[0-9]{4} [0-9]{4} [0-9]{4} ([0-9]{4})\b/**** **** **** \1/' /srv/share/prodaja/export-2026-09.csv > /root/dlp/export-masked.csv
-->

## Deidentifikuj HR podatke

`hr/plate.csv` sadrži JMBG. Za statistiku plata po godištu ne treba nam identitet osobe. Napravi `/root/dlp/plate-pseudo.csv` u kojem je JMBG zamijenjen HMAC-SHA256 vrijednošću sa tajnim ključem (**pseudonimizacija**). Isti JMBG uvijek daje isti pseudonim, pa se zapisi i dalje mogu spajati. Bez ključa se iz pseudonima ne može doći do JMBG-a.

```bash
openssl rand -hex 32 > /root/dlp/pseudo.key && chmod 600 /root/dlp/pseudo.key
K=$(cat /root/dlp/pseudo.key)
{ echo "ime,id,neto"; tail -n +2 /srv/share/hr/plate.csv | while IFS=, read ime jmbg neto; do
  h=$(printf '%s' "$jmbg" | openssl dgst -sha256 -hmac "$K" -r | cut -c1-16)
  echo "$ime,$h,$neto"; done; } > /root/dlp/plate-pseudo.csv
cat /root/dlp/plate-pseudo.csv
```

> Običan hash JMBG-a **bez** ključa nije dovoljan: JMBG ima malo mogućih vrijednosti i strukturu (datum rođenja, region), pa se može pogoditi grubom silom. Zato HMAC sa tajnim ključem. Po GDPR-u pseudonimizovani podaci su i dalje lični podaci; tek **anonimizovani** podaci nisu.

<!-- verify
f=/root/dlp/plate-pseudo.csv
[ -s $f ] || { echo "Nema $f"; exit 1; }
grep -qE '[0-9]{13}' $f && { echo "U fajlu je i dalje JMBG"; exit 1; }
K=$(cat /root/dlp/pseudo.key 2>/dev/null) ; [ -n "$K" ] || { echo "Nema ključa /root/dlp/pseudo.key"; exit 1; }
want=$(printf '%s' 0101990170001 | openssl dgst -sha256 -hmac "$K" -r | cut -c1-16)
grep -q "$want" $f || { echo "Pseudonim ne odgovara HMAC-SHA256 vrijednosti sa ključem"; exit 1; }
-->
<!-- solution
openssl rand -hex 32 > /root/dlp/pseudo.key && chmod 600 /root/dlp/pseudo.key
K=$(cat /root/dlp/pseudo.key)
{ echo "ime,id,neto"; tail -n +2 /srv/share/hr/plate.csv | while IFS=, read ime jmbg neto; do h=$(printf '%s' "$jmbg" | openssl dgst -sha256 -hmac "$K" -r | cut -c1-16); echo "$ime,$h,$neto"; done; } > /root/dlp/plate-pseudo.csv
-->

## Označi i zaštiti originale

Klasifikacija bez kontrole pristupa je samo etiketa. Za tri fajla sa osjetljivim podacima (dva sa karticama i `hr/plate.csv`):

1. upiši fajl i oznaku `Restricted` u registar klasifikacije `/root/dlp/klasifikacija.csv` (format `putanja,oznaka`),
2. ukloni pristup svima osim vlasnika (`chmod 600`, vlasnik root).

```bash
for f in /srv/share/prodaja/export-2026-09.csv /srv/share/it/stari-ticket-4471.txt /srv/share/hr/plate.csv; do
  chown root:root "$f"; chmod 600 "$f"; echo "$f,Restricted" >> /root/dlp/klasifikacija.csv
done
cat /root/dlp/klasifikacija.csv
ls -l /srv/share/*/
```

U cloudu bi isto uradio **tagovima** na objektima (npr. `classification=restricted`), politikama koje ih koriste i servisima kao što su Amazon Macie ili Microsoft Purview, koji ovo otkrivanje rade automatski.

<!-- verify
for f in /srv/share/prodaja/export-2026-09.csv /srv/share/it/stari-ticket-4471.txt /srv/share/hr/plate.csv; do
  [ "$(stat -c '%a %U' $f)" = "600 root" ] || { echo "$f nema 600 root"; exit 1; }
  grep -q "^$f,Restricted$" /root/dlp/klasifikacija.csv 2>/dev/null || { echo "$f nije u registru kao Restricted"; exit 1; }
done
[ "$(stat -c %a /srv/share/marketing/brosura.txt)" = 600 ] && { echo "Javni fajl brosura.txt ne treba zaključavati"; exit 1; }
exit 0
-->
<!-- solution
for f in /srv/share/prodaja/export-2026-09.csv /srv/share/it/stari-ticket-4471.txt /srv/share/hr/plate.csv; do chown root:root "$f"; chmod 600 "$f"; echo "$f,Restricted" >> /root/dlp/klasifikacija.csv; done
-->
