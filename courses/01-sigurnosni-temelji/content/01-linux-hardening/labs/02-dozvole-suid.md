# Lab 2: Dozvole fajlova i SUID

Prethodni administrator je „da bi radilo“ podijelio previše dozvola. Pronađi i popravi četiri problema, a na kraju napravi bazni popis SUID fajlova za buduće poređenje.

<!-- setup
set -e
useradd -m ana
mkdir -p /etc/app /opt/scripts /srv/share
printf 'DB_HOST=db.internal\nDB_USER=app\nDB_PASSWORD=Ljeto2026!\n' > /etc/app/db.conf
chmod 666 /etc/app/db.conf
printf '#!/bin/bash\n# noćni backup baze\ntar czf /var/backups/app-$(date +%%F).tgz /etc/app\n' > /opt/scripts/backup.sh
chmod 777 /opt/scripts/backup.sh
echo '30 2 * * * root /opt/scripts/backup.sh' > /etc/cron.d/backup
cp /usr/bin/find /usr/local/bin/sfind
chmod 4755 /usr/local/bin/sfind
chmod 777 /srv/share
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Dozvole fajlova i SUID ===
Pronađi preširoke dozvole i nepotrebne SUID fajlove.
EOF
-->

## Pronađi fajlove koje svako može mijenjati

```bash
find / -xdev -type f -perm -0002 2>/dev/null
find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null
```

Prva komanda traži fajlove sa write bitom za „ostale“. Druga traži direktorije u koje svako može pisati, a nemaju sticky bit. Zapiši šta si našao.

## Zaštiti fajl sa lozinkom baze

`/etc/app/db.conf` sadrži lozinku, a svako ga može čitati i mijenjati. Postavi vlasnika `root:root` i dozvole `600`.

```bash
ls -l /etc/app/db.conf
```

<!-- verify
s=$(stat -c '%a %U %G' /etc/app/db.conf)
[ "$s" = "600 root root" ] || { echo "Trenutno: $s (očekivano: 600 root root)"; exit 1; }
-->
<!-- hint
`chown root:root /etc/app/db.conf` pa `chmod 600 /etc/app/db.conf`. U praksi bi aplikacija čitala fajl kao svoj servisni korisnik, pa bi vlasnik bio taj korisnik, a dozvole 600 ili 640.
-->
<!-- solution
chown root:root /etc/app/db.conf && chmod 600 /etc/app/db.conf
-->

## Zatvori put do root-a preko cron skripte

Pogledaj `/etc/cron.d/backup`. Root pokreće `/opt/scripts/backup.sh`, a svako može mijenjati tu skriptu. To znači da korisnik `ana` može upisati bilo šta i to će se izvršiti kao root.

Popravi tako da vlasnik bude root i da ni grupa ni ostali ne mogu pisati u skriptu.

<!-- verify
f=/opt/scripts/backup.sh
[ "$(stat -c %U $f)" = root ] || { echo "Vlasnik nije root"; exit 1; }
m=$(stat -c %a $f)
[ $(( 8#$m & 8#022 )) -eq 0 ] || { echo "Dozvole $m: grupa ili ostali i dalje mogu pisati"; exit 1; }
su ana -s /bin/bash -c "echo test >> $f" 2>/dev/null && { echo "Korisnik ana i dalje može pisati u skriptu"; exit 1; }
exit 0
-->
<!-- hint
`chmod 700 /opt/scripts/backup.sh` (ili `750`). Provjeri i direktorij `/opt/scripts`: ako bi svako mogao pisati u njega, mogao bi zamijeniti cijeli fajl.
-->
<!-- solution
chown root:root /opt/scripts/backup.sh && chmod 700 /opt/scripts/backup.sh
-->

## Ukloni nepotreban SUID

Pronađi sve SUID fajlove:

```bash
find / -xdev -perm -4000 -type f 2>/dev/null
```

Većina je normalna (`passwd`, `su`, `sudo`, `mount`…). Jedan nije: kopija programa `find` sa SUID bitom daje root svakome, jer `find -exec` pokreće komande. Ukloni SUID bit sa tog fajla, ali **ne diraj** sistemske poput `passwd`.

<!-- verify
[ -u /usr/local/bin/sfind ] && { echo "/usr/local/bin/sfind još ima SUID bit"; exit 1; }
[ -u /usr/bin/passwd ] || { echo "Oprez: /usr/bin/passwd je izgubio SUID, a treba mu"; exit 1; }
exit 0
-->
<!-- hint
`chmod u-s /usr/local/bin/sfind`, ili ga potpuno obriši, jer kopija find-a u /usr/local/bin ovdje ničemu ne služi.
-->
<!-- solution
chmod u-s /usr/local/bin/sfind
-->

## Osiguraj dijeljeni direktorij

`/srv/share` ima dozvole `777` bez sticky bita, pa svaki korisnik može brisati i preimenovati tuđe fajlove u njemu. Dodaj sticky bit (kao na `/tmp`) ili ukloni pisanje za ostale.

<!-- verify
m=$(stat -c %a /srv/share)
if [ -k /srv/share ] || [ $(( 8#$m & 8#002 )) -eq 0 ]; then exit 0; fi
echo "Trenutno $m bez sticky bita"; exit 1
-->
<!-- hint
`chmod +t /srv/share` daje `1777`, isto kao `/tmp`. Bolje rješenje u praksi: posebna grupa i `chmod 2770`.
-->
<!-- solution
chmod +t /srv/share
-->

## Napravi bazni popis SUID fajlova

Snimi trenutni (sada čist) popis SUID fajlova. Kasnije ga možeš porediti sa `diff` i otkriti novi SUID fajl.

```bash
find / -xdev -perm -4000 -type f 2>/dev/null | sort > /root/suid-baseline.txt
cat /root/suid-baseline.txt
```

<!-- verify
f=/root/suid-baseline.txt
[ -s $f ] || { echo "Fajl ne postoji ili je prazan"; exit 1; }
grep -q '/usr/bin/passwd' $f || { echo "U popisu nema /usr/bin/passwd"; exit 1; }
grep -q 'sfind' $f && { echo "sfind je i dalje u popisu: snimi popis tek nakon popravke"; exit 1; }
exit 0
-->
<!-- solution
find / -xdev -perm -4000 -type f 2>/dev/null | sort > /root/suid-baseline.txt
-->
