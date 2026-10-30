# Lab 2: Backup, retencija i test vraćanja

Backup koji nikad nije vraćen nije backup, nego nada. U ovom labu ćeš napraviti backup sa manifestom hash-eva, primijeniti politiku **retencije**, preživjeti simulirani ransomware **testom vraćanja** (*restoration testing*) i izračunati da li je ispunjen **RPO**.

Aplikacija čuva podatke u `/srv/app/data`, a backupi idu u `/backup`.

<!-- setup
set -e
mkdir -p /srv/app/data/racuni /backup /var/lib/kurs
python3 - <<'PY'
import random, sqlite3
random.seed(34)
db = sqlite3.connect("/srv/app/data/orders.db")
db.execute("create table orders(id integer primary key, kupac text, iznos real)")
db.executemany("insert into orders values(?,?,?)", [(i, f"kupac{i}", round(random.uniform(10, 500), 2)) for i in range(1, 501)])
db.commit(); db.close()
for i in range(1, 21):
    open(f"/srv/app/data/racuni/racun-{i:04d}.txt", "w").write(f"Račun {i}\nIznos: {random.randint(10,900)} KM\n")
open("/srv/app/data/config.yaml", "w").write("app: prodavnica\nverzija: 3.2\n")
PY
(cd /srv/app && find data -type f -exec sha256sum {} \; | sort -k2 > /var/lib/kurs/data.sha256)
for d in $(seq 1 20); do
  f=/backup/app-$(date -d "-$d day" +%F)-0200.tar.gz
  echo "stari backup $d" | gzip > $f
  touch -d "-$d day" $f
done
cat > /usr/local/bin/simulacija-ransomware <<'EOF'
#!/bin/bash
# SIMULACIJA: "šifruje" (base64) i preimenuje fajlove aplikacije, ostavlja poruku. Backupe ne dira.
for f in $(find /srv/app/data -type f ! -name '*.locked'); do base64 "$f" > "$f.locked" && rm "$f"; done
echo "Vaši fajlovi su šifrovani. (Ovo je vježba.)" > /srv/app/data/PROCITAJ-ME.txt
echo "Simulacija završena: $(find /srv/app/data -name '*.locked' | wc -l) fajlova zaključano."
EOF
chmod 755 /usr/local/bin/simulacija-ransomware
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Backup i oporavak ===
Podaci: /srv/app/data   Backupi: /backup
EOF
-->

## Napravi backup sa manifestom

Napravi arhivu podataka sa datumom i vremenom u imenu, a uz nju fajl sa SHA-256 hash-em arhive. Hash ti kasnije dokazuje da backup nije oštećen ni izmijenjen.

```bash
B=/backup/app-$(date +%F-%H%M).tar.gz
tar czf $B -C /srv/app data
sha256sum $B > $B.sha256
tar tzf $B | head
ls -lt /backup | head -5
```

<!-- verify
B=$(ls -t /backup/app-*.tar.gz 2>/dev/null | head -1)
[ -n "$B" ] && tar tzf $B 2>/dev/null | grep -q 'data/orders.db' || { echo "Najnoviji backup ne sadrži data/orders.db"; exit 1; }
[ -f $B.sha256 ] && sha256sum -c $B.sha256 >/dev/null 2>&1 || { echo "Nema ispravnog $B.sha256"; exit 1; }
-->
<!-- solution
B=/backup/app-$(date +%F-%H%M).tar.gz; tar czf $B -C /srv/app data && sha256sum $B > $B.sha256
-->

## Retencija

Politika kaže: dnevne backupe čuvaj **7 dana**. Starije treba obrisati, jer zauzimaju prostor, a čuvanje podataka duže nego što treba je i pravni rizik (GDPR). U `/backup` je 20 starih dnevnih backupa.

Pogledaj šta bi bilo obrisano, pa tek onda briši:

```bash
find /backup -name 'app-*.tar.gz' -mtime +7 -print
find /backup -name 'app-*.tar.gz' -mtime +7 -delete
ls -lt /backup
```

> Uvijek prvo `-print`, pa `-delete`. Pravi sistemi imaju i **immutability** (npr. S3 Object Lock, Azure immutable blob storage): backup se ne može obrisati ni izmijeniti prije isteka retencije, čak ni sa admin pravima. To je ključna zaštita od ransomwarea koji prvo traži i briše backupe.

<!-- verify
old=$(find /backup -name 'app-*.tar.gz' -mtime +7 | wc -l)
[ "$old" -eq 0 ] || { echo "Ostalo je $old backupa starijih od 7 dana"; exit 1; }
n=$(ls /backup/app-*.tar.gz | wc -l)
[ "$n" -ge 7 ] || { echo "Obrisao si previše: ostalo je samo $n backupa"; exit 1; }
-->
<!-- solution
find /backup -name 'app-*.tar.gz' -mtime +7 -delete
-->

## Incident: ransomware

Pokreni simulaciju. Ona „šifruje“ fajlove aplikacije, a backupe ne dira:

```bash
simulacija-ransomware
ls -R /srv/app/data | head
```

Vrati podatke iz **najnovijeg** backupa. Prvo provjeri integritet arhive, raspakuj je na **novu** lokaciju, pa zamijeni zaraženi direktorij. Zaraženi direktorij sačuvaj kao dokaz.

```bash
B=$(ls -t /backup/app-*.tar.gz | head -1); echo $B
sha256sum -c $B.sha256
mkdir -p /srv/restore && tar xzf $B -C /srv/restore
mv /srv/app/data /srv/app/data.zarazeno-$(date +%s)
mv /srv/restore/data /srv/app/data
```

Zatim **testiraj vraćanje**: uporedi hash-eve vraćenih fajlova sa manifestom originalnih podataka i provjeri da baza radi.

```bash
cd /srv/app && find data -type f -exec sha256sum {} \; | sort -k2 | diff - /var/lib/kurs/data.sha256 && echo "Vraćanje ispravno"
python3 -c "import sqlite3; print(sqlite3.connect('/srv/app/data/orders.db').execute('select count(*) from orders').fetchone())"
```

<!-- verify
[ -d /srv/app/data ] || { echo "/srv/app/data ne postoji"; exit 1; }
find /srv/app/data -name '*.locked' | grep -q . && { echo "U /srv/app/data su i dalje zaključani fajlovi"; exit 1; }
(cd /srv/app && find data -type f -exec sha256sum {} \; | sort -k2 | diff -q - /var/lib/kurs/data.sha256 >/dev/null) || { echo "Vraćeni fajlovi se ne poklapaju sa originalnim podacima"; exit 1; }
ls -d /srv/app/data.zarazeno-* >/dev/null 2>&1 || { echo "Zaraženi direktorij nije sačuvan kao dokaz"; exit 1; }
-->
<!-- solution
simulacija-ransomware >/dev/null
B=$(ls -t /backup/app-*.tar.gz | head -1)
mkdir -p /srv/restore && tar xzf $B -C /srv/restore
mv /srv/app/data /srv/app/data.zarazeno-$(date +%s) && mv /srv/restore/data /srv/app/data
-->

## RPO i RTO

Scenario za proračun: dnevni backup se pravi u 02:00, a ransomware je udario u 14:30 istog dana. Sve promjene nakon zadnjeg backupa su izgubljene. Poslovni zahtjev je **RPO = 4 sata** i **RTO = 2 sata**.

U `/root/rpo.txt` upiši dvije linije:

1. koliko je sati podataka izgubljeno (npr. `7.5`),
2. koliko često (u satima, najviše) se backup mora praviti da bi RPO od 4 sata bio ispunjen.

| Pojam | Pitanje | Odgovor iz ovog scenarija |
|---|---|---|
| **RPO** | koliko podataka (u vremenu) smijemo izgubiti? | određuje učestalost backupa |
| **RTO** | za koliko vremena sistem mora ponovo raditi? | određuje brzinu vraćanja; mjeri se testom kao što je ovaj |
| **MTTR** | koliko prosječno traje popravka? | iz istorije incidenata |
| **MTBF** | koliko prosječno prođe između kvarova? | pouzdanost komponente |

<!-- verify
f=/root/rpo.txt
a=$(sed -n 1p $f 2>/dev/null | tr ',' '.' | xargs); b=$(sed -n 2p $f 2>/dev/null | tr ',' '.' | xargs)
python3 -c "import sys; sys.exit(0 if abs(float('$a')-12.5)<0.01 else 1)" 2>/dev/null || { echo "Prva linija: izgubljeno je od 02:00 do 14:30"; exit 1; }
python3 -c "import sys; sys.exit(0 if 0<float('$b')<=4 else 1)" 2>/dev/null || { echo "Druga linija: backup mora biti barem svaka 4 sata"; exit 1; }
-->
<!-- solution
printf '12.5\n4\n' > /root/rpo.txt
-->
