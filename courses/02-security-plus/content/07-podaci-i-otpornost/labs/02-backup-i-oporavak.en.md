# Lab 2: Backup, retention, and restore testing

A backup that has never been restored isn't a backup, it's a hope. In this lab you'll create a backup with a hash manifest, apply a **retention** policy, survive simulated ransomware through **restoration testing**, and calculate whether the **RPO** was met.

The application stores its data in `/srv/app/data`, and backups go to `/backup`.

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

## Create a backup with a manifest

Create an archive of the data with the date and time in its name, and alongside it a file with the archive's SHA-256 hash. The hash later proves that the backup hasn't been damaged or modified.

```bash
B=/backup/app-$(date +%F-%H%M).tar.gz
tar czf $B -C /srv/app data
sha256sum $B > $B.sha256
tar tzf $B | head
ls -lt /backup | head -5
```

<!-- verify
B=$(ls -t /backup/app-*.tar.gz 2>/dev/null | head -1)
[ -n "$B" ] && tar tzf $B 2>/dev/null | grep -q 'data/orders.db' || { echo "The newest backup does not contain data/orders.db"; exit 1; }
[ -f $B.sha256 ] && sha256sum -c $B.sha256 >/dev/null 2>&1 || { echo "No valid $B.sha256"; exit 1; }
-->
<!-- solution
B=/backup/app-$(date +%F-%H%M).tar.gz; tar czf $B -C /srv/app data && sha256sum $B > $B.sha256
-->

## Retention

The policy says: keep daily backups for **7 days**. Older ones should be deleted, because they take up space, and keeping data longer than necessary is also a legal risk (GDPR). There are 20 old daily backups in `/backup`.

Look at what would be deleted first, and only then delete:

```bash
find /backup -name 'app-*.tar.gz' -mtime +7 -print
find /backup -name 'app-*.tar.gz' -mtime +7 -delete
ls -lt /backup
```

> Always `-print` first, then `-delete`. Real systems also have **immutability** (e.g., S3 Object Lock, Azure immutable blob storage): a backup can't be deleted or modified before its retention expires, even with admin rights. That's the key protection against ransomware that first hunts down and deletes backups.

<!-- verify
old=$(find /backup -name 'app-*.tar.gz' -mtime +7 | wc -l)
[ "$old" -eq 0 ] || { echo "$old backups older than 7 days remain"; exit 1; }
n=$(ls /backup/app-*.tar.gz | wc -l)
[ "$n" -ge 7 ] || { echo "You deleted too much: only $n backups remain"; exit 1; }
-->
<!-- solution
find /backup -name 'app-*.tar.gz' -mtime +7 -delete
-->

## Incident: ransomware

Run the simulation. It "encrypts" the application's files and leaves the backups alone:

```bash
simulacija-ransomware
ls -R /srv/app/data | head
```

Restore the data from the **newest** backup. First verify the archive's integrity, extract it to a **new** location, and then replace the infected directory. Keep the infected directory as evidence.

```bash
B=$(ls -t /backup/app-*.tar.gz | head -1); echo $B
sha256sum -c $B.sha256
mkdir -p /srv/restore && tar xzf $B -C /srv/restore
mv /srv/app/data /srv/app/data.zarazeno-$(date +%s)
mv /srv/restore/data /srv/app/data
```

Then **test the restore**: compare the hashes of the restored files with the manifest of the original data and check that the database works.

```bash
cd /srv/app && find data -type f -exec sha256sum {} \; | sort -k2 | diff - /var/lib/kurs/data.sha256 && echo "Restore OK"
python3 -c "import sqlite3; print(sqlite3.connect('/srv/app/data/orders.db').execute('select count(*) from orders').fetchone())"
```

<!-- verify
[ -d /srv/app/data ] || { echo "/srv/app/data does not exist"; exit 1; }
find /srv/app/data -name '*.locked' | grep -q . && { echo "/srv/app/data still contains locked files"; exit 1; }
(cd /srv/app && find data -type f -exec sha256sum {} \; | sort -k2 | diff -q - /var/lib/kurs/data.sha256 >/dev/null) || { echo "The restored files do not match the original data"; exit 1; }
ls -d /srv/app/data.zarazeno-* >/dev/null 2>&1 || { echo "The infected directory was not kept as evidence"; exit 1; }
-->
<!-- solution
simulacija-ransomware >/dev/null
B=$(ls -t /backup/app-*.tar.gz | head -1)
mkdir -p /srv/restore && tar xzf $B -C /srv/restore
mv /srv/app/data /srv/app/data.zarazeno-$(date +%s) && mv /srv/restore/data /srv/app/data
-->

## RPO and RTO

Scenario for the calculation: the daily backup runs at 02:00, and the ransomware hit at 14:30 the same day. All changes after the last backup are lost. The business requirement is **RPO = 4 hours** and **RTO = 2 hours**.

Write two lines into `/root/rpo.txt`:

1. how many hours of data were lost (e.g., `7.5`),
2. how often (in hours, at most) a backup must run for the 4-hour RPO to be met.

| Term | Question | Answer from this scenario |
|---|---|---|
| **RPO** | how much data (in time) can we afford to lose? | determines backup frequency |
| **RTO** | how quickly must the system be running again? | determines restore speed; measured with a test like this one |
| **MTTR** | how long does a repair take on average? | from incident history |
| **MTBF** | how much time passes between failures on average? | component reliability |

<!-- verify
f=/root/rpo.txt
a=$(sed -n 1p $f 2>/dev/null | tr ',' '.' | xargs); b=$(sed -n 2p $f 2>/dev/null | tr ',' '.' | xargs)
python3 -c "import sys; sys.exit(0 if abs(float('$a')-12.5)<0.01 else 1)" 2>/dev/null || { echo "First line: data was lost from 02:00 to 14:30"; exit 1; }
python3 -c "import sys; sys.exit(0 if 0<float('$b')<=4 else 1)" 2>/dev/null || { echo "Second line: a backup must run at least every 4 hours"; exit 1; }
-->
<!-- solution
printf '12.5\n4\n' > /root/rpo.txt
-->
