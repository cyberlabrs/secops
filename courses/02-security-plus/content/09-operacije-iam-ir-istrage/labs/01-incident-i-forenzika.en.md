# Lab 1: Incident response and evidence collection

EDR reported a suspicious process on a web server. You're on call. You'll carry out the first incident response steps in exactly the order the exam expects: you collect evidence by **order of volatility**, preserve its integrity with hashes and a **chain of custody**, and only then **isolate** the threat and investigate the disk.

Save all evidence in `/root/dokazi/` (*dokazi* = evidence).

| Order | Source | Why in this order |
|---|---|---|
| 1 | CPU registers, cache, **RAM** (processes, keys in memory) | gone in seconds or on shutdown |
| 2 | network connections, ARP, routing | changes constantly |
| 3 | temporary files, swap | gets overwritten |
| 4 | **disk** | persistent, but can be modified |
| 5 | remote logs, backups | the most persistent |

<!-- setup
set -e
mkdir -p /var/www/html/upload /tmp/.x /root/dokazi
echo '<h1>Prodavnica</h1>' > /var/www/html/index.html
touch -d '2026-09-01 10:00' /var/www/html/index.html
printf '<?php // web shell (lab artefakt, neaktivan)\nif(isset($_REQUEST["c"])){ /* izvrsavanje komandi */ }\n' > /var/www/html/upload/avatar.php
touch -d '2026-10-14 03:12' /var/www/html/upload/avatar.php
cat > /tmp/.x/kupdate <<'EOF'
#!/bin/bash
# simulacija C2 beacona: pokušava se javiti serveru napadača
while true; do timeout 1 bash -c 'exec 3<>/dev/tcp/203.0.113.66/4444' 2>/dev/null; sleep 5; done
EOF
chmod 755 /tmp/.x/kupdate
touch -d '2026-10-14 03:14' /tmp/.x/kupdate
(cd /tmp && nohup /tmp/.x/kupdate >/dev/null 2>&1 &)
dd if=/dev/urandom of=/srv/usb-disk.img bs=1M count=8 2>/dev/null
cat > /root/dokazi/lanac-nadzora.csv <<'EOF'
datum_vrijeme,preuzeo,dokaz,sha256,lokacija
EOF
sleep 1
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Incident i forenzika ===
Dokazi: /root/dokazi/   Lanac nadzora: /root/dokazi/lanac-nadzora.csv
EOF
-->

## Volatile first: processes

Capture the list of all processes with full command lines **before** making any change to the system. Shutting down the server or killing the process would destroy exactly what you need.

```bash
ps auxww > /root/dokazi/procesi.txt
ps -eo pid,ppid,user,etime,cmd --forest | grep -v '\[' | head -30
```

Find the suspicious process (launched from a hidden directory in `/tmp`), then save its details from `/proc`:

```bash
PID=$(pgrep -f /tmp/.x/kupdate | head -1); echo $PID
cat /proc/$PID/cmdline | tr '\0' ' ' > /root/dokazi/proces-cmdline.txt
cp /proc/$PID/exe /root/dokazi/proces-exe.bin
ls -l /proc/$PID/cwd /proc/$PID/exe
```

On a real system, at this step you'd also take a **memory dump** (e.g., AVML or LiME on Linux), because malware often exists only in memory (*fileless*).

<!-- verify
d=/root/dokazi
grep -q '/tmp/.x/kupdate' $d/procesi.txt 2>/dev/null || { echo "procesi.txt does not exist or does not contain the suspicious process"; exit 1; }
grep -q 'kupdate' $d/proces-cmdline.txt 2>/dev/null || { echo "proces-cmdline.txt is missing"; exit 1; }
[ -s $d/proces-exe.bin ] || { echo "No copy of the executable (proces-exe.bin)"; exit 1; }
-->
<!-- solution
ps auxww > /root/dokazi/procesi.txt
PID=$(pgrep -x kupdate | head -1)
cat /proc/$PID/cmdline | tr '\0' ' ' > /root/dokazi/proces-cmdline.txt
cp /proc/$PID/exe /root/dokazi/proces-exe.bin
-->

## Network state and the C2 address

```bash
ss -tanp > /root/dokazi/mreza.txt
cat /tmp/.x/kupdate
```

The process is trying to contact the attacker's server (**command and control**, C2). Write the C2 server's IP address into `/root/dokazi/ioc.txt`. That's an **indicator of compromise** (IoC) you'll pass to the SOC so they can look for it on other servers.

<!-- verify
[ -f /root/dokazi/mreza.txt ] || { echo "mreza.txt is missing"; exit 1; }
grep -q '203.0.113.66' /root/dokazi/ioc.txt 2>/dev/null || { echo "ioc.txt does not contain the C2 server address"; exit 1; }
-->
<!-- solution
ss -tanp > /root/dokazi/mreza.txt; echo 203.0.113.66 > /root/dokazi/ioc.txt
-->

## Evidence integrity and chain of custody

Every piece of evidence gets a hash at the moment of collection. That way you can later prove nobody modified it. Every handover is recorded in the **chain of custody** (`lanac-nadzora.csv`).

```bash
cd /root/dokazi
sha256sum procesi.txt proces-cmdline.txt proces-exe.bin mreza.txt ioc.txt > SHA256SUMS
cat SHA256SUMS
H=$(sha256sum procesi.txt | cut -d' ' -f1)
echo "$(date -u +%FT%TZ),on-call-analyst,procesi.txt,$H,/root/dokazi" >> lanac-nadzora.csv
cat lanac-nadzora.csv
```

<!-- verify
cd /root/dokazi || exit 1
[ -s SHA256SUMS ] || { echo "SHA256SUMS is missing"; exit 1; }
sha256sum -c SHA256SUMS >/dev/null 2>&1 || { echo "sha256sum -c fails (evidence modified after hashing?)"; exit 1; }
for f in procesi.txt proces-exe.bin mreza.txt; do grep -q " $f$" SHA256SUMS || { echo "$f is not in SHA256SUMS"; exit 1; }; done
H=$(sha256sum procesi.txt | cut -d' ' -f1)
grep -q "$H" lanac-nadzora.csv || { echo "The chain of custody has no entry with the hash of procesi.txt"; exit 1; }
-->
<!-- solution
cd /root/dokazi
sha256sum procesi.txt proces-cmdline.txt proces-exe.bin mreza.txt ioc.txt > SHA256SUMS
H=$(sha256sum procesi.txt | cut -d' ' -f1)
echo "$(date -u +%FT%TZ),dezurni-analiticar,procesi.txt,$H,/root/dokazi" >> lanac-nadzora.csv
-->

## Containment: isolate the threat

Only now, with the volatile evidence preserved, do you limit the damage:

1. block outbound traffic to the C2 address (in the cloud this would be isolating the instance with a security group or EDR "network isolation"),
2. stop the process.

```bash
nft add table inet ir
nft add chain inet ir output '{ type filter hook output priority 0; policy accept; }'
nft add rule inet ir output ip daddr 203.0.113.66 drop
pkill -9 -f /tmp/.x/kupdate
nft list ruleset
```

**Don't delete** the file in `/tmp/.x` yet. Deletion is part of the **eradication** phase, and the file is still evidence.

<!-- verify
pgrep -x kupdate >/dev/null && { echo "The process is still running"; exit 1; }
nft list ruleset 2>/dev/null | grep -q 'ip daddr 203.0.113.66 drop' || { echo "No rule blocks 203.0.113.66"; exit 1; }
[ -e /tmp/.x/kupdate ] || { echo "You deleted evidence too early"; exit 1; }
exit 0
-->
<!-- solution
nft add table inet ir
nft add chain inet ir output '{ type filter hook output priority 0; policy accept; }'
nft add rule inet ir output ip daddr 203.0.113.66 drop
pkill -9 -x kupdate; sleep 0.5
-->

## Bit-level disk copy

A USB disk was attached to the server (`/srv/usb-disk.img`). Make a **bit-level** copy (`dd`), verify that the hashes of the original and the copy match, and set the original to read-only. This is the software equivalent of a *write blocker*. Analysis is always done on the copy.

```bash
sha256sum /srv/usb-disk.img
dd if=/srv/usb-disk.img of=/root/dokazi/usb-disk.dd bs=1M status=progress
sha256sum /root/dokazi/usb-disk.dd
chmod 444 /srv/usb-disk.img
```

<!-- verify
[ -f /root/dokazi/usb-disk.dd ] || { echo "/root/dokazi/usb-disk.dd is missing"; exit 1; }
[ "$(sha256sum < /srv/usb-disk.img)" = "$(sha256sum < /root/dokazi/usb-disk.dd)" ] || { echo "The copy's hash differs from the original"; exit 1; }
[ "$(stat -c %a /srv/usb-disk.img)" = 444 ] || { echo "The original is not set to 444"; exit 1; }
-->
<!-- solution
dd if=/srv/usb-disk.img of=/root/dokazi/usb-disk.dd bs=1M 2>/dev/null && chmod 444 /srv/usb-disk.img
-->

## Timeline: how did the attacker get in?

The process was started on October 14 around 03:14. Find the files on the web server that were modified that day. One of them is probably the entry point.

```bash
find /var/www /tmp -type f -newermt '2026-10-14 00:00' ! -newermt '2026-10-15 00:00' -exec ls -l --time-style=full-iso {} \;
```

Write the full path of the **web shell** into `/root/dokazi/ulaz.txt`. A file with PHP code in the image upload directory tells you the application didn't check the file type on upload.

> An attacker can change timestamps (`touch`, *timestomping*). That's why you rely on multiple sources: web server logs, EDR telemetry, and backups.

<!-- verify
grep -qx '/var/www/html/upload/avatar.php' /root/dokazi/ulaz.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/dokazi/ulaz.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo /var/www/html/upload/avatar.php > /root/dokazi/ulaz.txt
-->
