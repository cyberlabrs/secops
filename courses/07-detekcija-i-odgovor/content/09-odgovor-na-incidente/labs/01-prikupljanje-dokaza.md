# Lab 1: Skripta za prikupljanje dokaza (live response)

Kad Wazuh javi sumnjiv događaj na serveru, prvih nekoliko minuta odlučuje šta ćeš moći dokazati. Napisaćeš skriptu koju dežurni pokreće na serveru prije bilo kakve intervencije: prikuplja podatke **redom volatilnosti** (RFC 3227), računa hash svakog fajla i pakuje sve sa zapisom o lancu nadzora (**chain of custody**).

```bash
wazuh-start
ls /root/ir
```

<!-- setup
set -e
mkdir -p /root/ir /root/dokazi
wazuh-start >/dev/null
-->

## Skripta

Napiši izvršivu `/root/ir/prikupi.sh` koja:

1. pravi direktorij `/root/dokazi/<hostname>-<UTC vrijeme u obliku 20261016T101500Z>/` i na kraju ispisuje njegovu putanju (zadnji red izlaza),
2. u njega upisuje, ovim redom (od najvolatilnijeg):
   - `00-vrijeme.txt`: `date -u` i `uptime`,
   - `01-procesi.txt`: `ps auxwwf`,
   - `02-mreza.txt`: `ss -tunap`,
   - `03-otvoreni-fajlovi.txt`: `lsof -n`,
   - `04-prijave.txt`: `who` i sadržaj `/etc/passwd`,
   - `05-cron.txt`: crontab svakog korisnika (`crontab -l -u <korisnik>`) i sadržaj `/etc/cron.d`,
   - `06-auth.log`: kopija `/var/log/auth.log`,
3. pravi `SHA256SUMS` sa SHA-256 svih prikupljenih fajlova (relativne putanje, da `sha256sum -c` radi iz tog direktorija),
4. ne mijenja ništa van `/root/dokazi/` (ne restartuje servise, ne briše fajlove).

<!-- verify
s=/root/ir/prikupi.sh
[ -x $s ] || { echo "$s ne postoji ili nije izvršiv"; exit 1; }
before=$(ls /root/dokazi | wc -l)
out=$($s 2>/dev/null) || { echo "skripta vraća grešku"; exit 1; }
d=$(echo "$out" | tail -1)
[ -d "$d" ] || { echo "zadnji red izlaza nije putanja direktorija ($d)"; exit 1; }
basename "$d" | grep -Eq "^$(hostname)-[0-9]{8}T[0-9]{6}Z$" || { echo "ime direktorija nije <hostname>-YYYYmmddTHHMMSSZ"; exit 1; }
case "$d" in /root/dokazi/*) ;; *) echo "direktorij nije u /root/dokazi"; exit 1;; esac
for f in 00-vrijeme.txt 01-procesi.txt 02-mreza.txt 03-otvoreni-fajlovi.txt 04-prijave.txt 05-cron.txt 06-auth.log SHA256SUMS; do
  [ -s "$d/$f" ] || { echo "nema ili je prazan $f"; exit 1; }
done
grep -q 'wazuh-analysisd' "$d/01-procesi.txt" || { echo "01-procesi.txt ne sadrži procese (ps auxwwf)"; exit 1; }
grep -q 'root:x:0:0' "$d/04-prijave.txt" || { echo "04-prijave.txt ne sadrži /etc/passwd"; exit 1; }
grep -q 'sshd' "$d/02-mreza.txt" || { echo "02-mreza.txt ne sadrži mrežne sockete sa procesima (ss -tunap)"; exit 1; }
(cd "$d" && sha256sum -c --quiet SHA256SUMS) || { echo "sha256sum -c SHA256SUMS ne prolazi"; exit 1; }
[ "$(grep -c . "$d/SHA256SUMS")" -ge 7 ] || { echo "SHA256SUMS ne pokriva svih 7 fajlova"; exit 1; }
grep -q '/' "$d/SHA256SUMS" && { echo "SHA256SUMS treba relativne putanje"; exit 1; }
exit 0
-->
<!-- hint
```bash
#!/bin/bash
set -euo pipefail
d=/root/dokazi/$(hostname)-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$d"; cd "$d"
{ date -u; uptime; } > 00-vrijeme.txt
ps auxwwf > 01-procesi.txt
...
sha256sum 0* > SHA256SUMS
echo "$d"
```
Pazi da greška jednog alata (npr. `crontab -l` za korisnika bez crontaba) ne prekine cijelu skriptu: `crontab -l -u "$u" 2>/dev/null || true`.
-->
<!-- solution
cat > /root/ir/prikupi.sh <<'EOF'
#!/bin/bash
# Live response: prikupljanje dokaza redom volatilnosti (RFC 3227)
set -uo pipefail
d=/root/dokazi/$(hostname)-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$d" && cd "$d" || exit 1
{ date -u; uptime; } > 00-vrijeme.txt
ps auxwwf > 01-procesi.txt
ss -tunap > 02-mreza.txt
lsof -n > 03-otvoreni-fajlovi.txt 2>/dev/null
{ who; echo "--- /etc/passwd"; cat /etc/passwd; } > 04-prijave.txt
{ for u in $(cut -d: -f1 /etc/passwd); do c=$(crontab -l -u "$u" 2>/dev/null) && printf '### %s\n%s\n' "$u" "$c"; done
  echo "--- /etc/cron.d"; for f in /etc/cron.d/*; do [ -f "$f" ] && { echo "### $f"; cat "$f"; }; done; } > 05-cron.txt
cp /var/log/auth.log 06-auth.log
sha256sum 0* > SHA256SUMS
echo "$d"
EOF
chmod +x /root/ir/prikupi.sh
-->

## Arhiva i lanac nadzora

Napiši `/root/ir/zapakuj.sh <direktorij> <ime-dežurnog>` koja:

1. pakuje direktorij u `<direktorij>.tar.gz` (pored njega),
2. računa SHA-256 arhive,
3. dodaje red u `/root/dokazi/lanac-nadzora.csv` (zaglavlje `vrijeme_utc,ko,radnja,fajl,sha256`, napravi ga ako fajl ne postoji): vrijeme u UTC (ISO 8601), ime dežurnog, radnja `prikupljeno`, puna putanja arhive i hash.

Zatim pokreni obje skripte jednu za drugom.

```bash
d=$(/root/ir/prikupi.sh | tail -1)
/root/ir/zapakuj.sh "$d" "ana.dezurna"
cat /root/dokazi/lanac-nadzora.csv
```

<!-- verify
z=/root/ir/zapakuj.sh
[ -x $z ] || { echo "$z ne postoji ili nije izvršiv"; exit 1; }
d=$(/root/ir/prikupi.sh 2>/dev/null | tail -1)
n0=$(grep -c . /root/dokazi/lanac-nadzora.csv 2>/dev/null || echo 0)
$z "$d" "provjera.dezurni" >/dev/null 2>&1 || { echo "zapakuj.sh vraća grešku"; exit 1; }
[ -s "$d.tar.gz" ] || { echo "nema arhive $d.tar.gz"; exit 1; }
tar -tzf "$d.tar.gz" | grep -q 'SHA256SUMS' || { echo "arhiva ne sadrži prikupljene fajlove"; exit 1; }
c=/root/dokazi/lanac-nadzora.csv
[ "$(head -1 $c)" = "vrijeme_utc,ko,radnja,fajl,sha256" ] || { echo "prvi red lanac-nadzora.csv treba biti zaglavlje vrijeme_utc,ko,radnja,fajl,sha256"; exit 1; }
[ "$(grep -c '^vrijeme_utc' $c)" = "1" ] || { echo "zaglavlje se ponavlja"; exit 1; }
l=$(tail -1 $c)
h=$(sha256sum "$d.tar.gz" | cut -d' ' -f1)
echo "$l" | grep -q ",provjera.dezurni,prikupljeno,$d.tar.gz,$h$" || { echo "zadnji red ne odgovara (ko, radnja, putanja arhive, sha256): $l"; exit 1; }
echo "$l" | cut -d, -f1 | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' || { echo "vrijeme nije ISO 8601 u UTC (npr. 2026-10-16T10:15:00Z)"; exit 1; }
[ "$(grep -c . $c)" -gt "$n0" ] || { echo "red nije dodat"; exit 1; }
grep -q 'ana.dezurna' $c || { echo "nisi zapakovao dokaze kao ana.dezurna"; exit 1; }
-->
<!-- hint
```bash
#!/bin/bash
set -euo pipefail
d=${1%/}; ko=$2
tar -czf "$d.tar.gz" -C "$(dirname "$d")" "$(basename "$d")"
h=$(sha256sum "$d.tar.gz" | cut -d' ' -f1)
c=/root/dokazi/lanac-nadzora.csv
[ -f "$c" ] || echo "vrijeme_utc,ko,radnja,fajl,sha256" > "$c"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ),$ko,prikupljeno,$d.tar.gz,$h" >> "$c"
```
U stvarnosti arhivu odmah kopiraš na mjesto sa kontrolisanim pristupom (npr. S3 bucket sa Object Lock), a svaki sljedeći korak (kopiranje, analiza, predaja) dobija novi red u lancu nadzora.
-->
<!-- solution
cat > /root/ir/zapakuj.sh <<'EOF'
#!/bin/bash
set -euo pipefail
d=${1%/}; ko=$2
tar -czf "$d.tar.gz" -C "$(dirname "$d")" "$(basename "$d")"
h=$(sha256sum "$d.tar.gz" | cut -d' ' -f1)
c=/root/dokazi/lanac-nadzora.csv
[ -f "$c" ] || echo "vrijeme_utc,ko,radnja,fajl,sha256" > "$c"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ),$ko,prikupljeno,$d.tar.gz,$h" >> "$c"
EOF
chmod +x /root/ir/zapakuj.sh
d=$(/root/ir/prikupi.sh | tail -1); sleep 1
/root/ir/zapakuj.sh "$d" "ana.dezurna"
-->
