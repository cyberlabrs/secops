# Lab 1: Evidence collection script (live response)

When Wazuh reports a suspicious event on a server, the first few minutes decide what you will be able to prove. You will write a script that the on-call engineer runs on the server before any intervention: it collects data in **order of volatility** (RFC 3227), computes a hash of every file and packages everything together with a **chain of custody** record.

The file, directory and value names in this lab are in Serbian and must be used exactly as given: `prikupi.sh` = collect, `zapakuj.sh` = package, `dokazi` = evidence, `vrijeme` = time, `procesi` = processes, `mreza` = network, `otvoreni-fajlovi` = open files, `prijave` = logins, `lanac-nadzora.csv` = chain of custody, `ko` = who, `radnja` = action, `fajl` = file, `prikupljeno` = collected, `dezurna`/`dezurni` = on-call.

```bash
wazuh-start
ls /root/ir
```

<!-- setup
set -e
mkdir -p /root/ir /root/dokazi
wazuh-start >/dev/null
-->

## The script

Write an executable `/root/ir/prikupi.sh` that:

1. creates the directory `/root/dokazi/<hostname>-<UTC time in the form 20261016T101500Z>/` and prints its path at the end (the last line of output),
2. writes into it, in this order (from most volatile):
   - `00-vrijeme.txt`: `date -u` and `uptime`,
   - `01-procesi.txt`: `ps auxwwf`,
   - `02-mreza.txt`: `ss -tunap`,
   - `03-otvoreni-fajlovi.txt`: `lsof -n`,
   - `04-prijave.txt`: `who` and the contents of `/etc/passwd`,
   - `05-cron.txt`: every user's crontab (`crontab -l -u <user>`) and the contents of `/etc/cron.d`,
   - `06-auth.log`: a copy of `/var/log/auth.log`,
3. creates `SHA256SUMS` with the SHA-256 of all collected files (relative paths, so that `sha256sum -c` works from that directory),
4. changes nothing outside `/root/dokazi/` (does not restart services, does not delete files).

<!-- verify
s=/root/ir/prikupi.sh
[ -x $s ] || { echo "$s does not exist or is not executable"; exit 1; }
before=$(ls /root/dokazi | wc -l)
out=$($s 2>/dev/null) || { echo "the script returns an error"; exit 1; }
d=$(echo "$out" | tail -1)
[ -d "$d" ] || { echo "the last line of output is not a directory path ($d)"; exit 1; }
basename "$d" | grep -Eq "^$(hostname)-[0-9]{8}T[0-9]{6}Z$" || { echo "the directory name is not <hostname>-YYYYmmddTHHMMSSZ"; exit 1; }
case "$d" in /root/dokazi/*) ;; *) echo "the directory is not in /root/dokazi"; exit 1;; esac
for f in 00-vrijeme.txt 01-procesi.txt 02-mreza.txt 03-otvoreni-fajlovi.txt 04-prijave.txt 05-cron.txt 06-auth.log SHA256SUMS; do
  [ -s "$d/$f" ] || { echo "$f is missing or empty"; exit 1; }
done
grep -q 'wazuh-analysisd' "$d/01-procesi.txt" || { echo "01-procesi.txt does not contain processes (ps auxwwf)"; exit 1; }
grep -q 'root:x:0:0' "$d/04-prijave.txt" || { echo "04-prijave.txt does not contain /etc/passwd"; exit 1; }
grep -q 'sshd' "$d/02-mreza.txt" || { echo "02-mreza.txt does not contain network sockets with processes (ss -tunap)"; exit 1; }
(cd "$d" && sha256sum -c --quiet SHA256SUMS) || { echo "sha256sum -c SHA256SUMS does not pass"; exit 1; }
[ "$(grep -c . "$d/SHA256SUMS")" -ge 7 ] || { echo "SHA256SUMS does not cover all 7 files"; exit 1; }
grep -q '/' "$d/SHA256SUMS" && { echo "SHA256SUMS needs relative paths"; exit 1; }
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
Make sure an error from one tool (e.g. `crontab -l` for a user without a crontab) does not abort the whole script: `crontab -l -u "$u" 2>/dev/null || true`.
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

## Archive and chain of custody

Write `/root/ir/zapakuj.sh <directory> <on-call-name>` that:

1. packages the directory into `<directory>.tar.gz` (next to it),
2. computes the SHA-256 of the archive,
3. appends a line to `/root/dokazi/lanac-nadzora.csv` (header `vrijeme_utc,ko,radnja,fajl,sha256`; create it if the file does not exist): the time in UTC (ISO 8601), the on-call engineer's name, the action `prikupljeno`, the full path of the archive and the hash.

Then run both scripts one after the other.

```bash
d=$(/root/ir/prikupi.sh | tail -1)
/root/ir/zapakuj.sh "$d" "ana.dezurna"
cat /root/dokazi/lanac-nadzora.csv
```

<!-- verify
z=/root/ir/zapakuj.sh
[ -x $z ] || { echo "$z does not exist or is not executable"; exit 1; }
d=$(/root/ir/prikupi.sh 2>/dev/null | tail -1)
n0=$(grep -c . /root/dokazi/lanac-nadzora.csv 2>/dev/null || echo 0)
$z "$d" "provjera.dezurni" >/dev/null 2>&1 || { echo "zapakuj.sh returns an error"; exit 1; }
[ -s "$d.tar.gz" ] || { echo "no archive $d.tar.gz"; exit 1; }
tar -tzf "$d.tar.gz" | grep -q 'SHA256SUMS' || { echo "the archive does not contain the collected files"; exit 1; }
c=/root/dokazi/lanac-nadzora.csv
[ "$(head -1 $c)" = "vrijeme_utc,ko,radnja,fajl,sha256" ] || { echo "the first line of lanac-nadzora.csv must be the header vrijeme_utc,ko,radnja,fajl,sha256"; exit 1; }
[ "$(grep -c '^vrijeme_utc' $c)" = "1" ] || { echo "the header is repeated"; exit 1; }
l=$(tail -1 $c)
h=$(sha256sum "$d.tar.gz" | cut -d' ' -f1)
echo "$l" | grep -q ",provjera.dezurni,prikupljeno,$d.tar.gz,$h$" || { echo "the last line does not match (who, action, archive path, sha256): $l"; exit 1; }
echo "$l" | cut -d, -f1 | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' || { echo "the time is not ISO 8601 in UTC (e.g. 2026-10-16T10:15:00Z)"; exit 1; }
[ "$(grep -c . $c)" -gt "$n0" ] || { echo "no line was appended"; exit 1; }
grep -q 'ana.dezurna' $c || { echo "you have not packaged the evidence as ana.dezurna"; exit 1; }
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
In reality you copy the archive immediately to a location with controlled access (e.g. an S3 bucket with Object Lock), and every subsequent step (copying, analysis, handover) gets a new line in the chain of custody.
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
