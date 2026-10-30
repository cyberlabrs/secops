# Lab 1: Who is listening on this server?

You're taking over a server you know nothing about. The first step of every security review is an inventory: which ports are open, which process is behind them, and whether they should be reachable at all.

The container network is isolated, so we scan only `127.0.0.1`, i.e. our own server.

<!-- setup
set -e
mkdir -p /srv/admin /etc/app /tmp/.cache
echo '<h1>Interni admin panel</h1>' > /srv/admin/index.html
cat > /etc/app/db.env <<'EOF'
# adresa na kojoj "baza" sluša
BIND=0.0.0.0
PORT=5432
EOF
cat > /usr/local/bin/start-db <<'EOF'
#!/bin/bash
. /etc/app/db.env
[ -f /run/db.pid ] && kill "$(cat /run/db.pid)" 2>/dev/null && sleep 0.3
nohup ncat -lk "$BIND" "$PORT" >/dev/null 2>&1 &
echo $! > /run/db.pid
echo "baza pokrenuta na $BIND:$PORT"
EOF
chmod 755 /usr/local/bin/start-db
/usr/local/bin/start-db >/dev/null
(cd /srv/admin && nohup python3 -m http.server 8080 --bind 127.0.0.1 >/dev/null 2>&1 &)
cp /usr/bin/ncat /tmp/.cache/kworkerd
(cd /tmp && nohup /tmp/.cache/kworkerd -lk 0.0.0.0 4444 >/dev/null 2>&1 &)
sleep 1
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Ko sluša na ovom serveru? ===
Alati: ss, nmap, ps, ls -l /proc/PID/exe
EOF
-->

## Port inventory

See what is listening and which process is behind each port:

```bash
ss -tulpn
```

Then look at the same thing from the outside, the way an attacker would see it, with an nmap connect scan of all ports:

```bash
nmap -sT -p- 127.0.0.1
nmap -sT -sV -p 4444,5432,8080 127.0.0.1
```

For each port note: the process, the address (`0.0.0.0` or `127.0.0.1`) and whether it looks legitimate to you.

## Identify the suspicious process

One process poses as a kernel thread (`kworker`), but kernel threads don't listen on TCP ports and have no binary on disk. Find the **full path** to its executable and write it to `/root/odgovor.txt` ("odgovor" = answer).

```bash
ss -tlnp | grep 4444
ls -l /proc/PID/exe        # replace PID with the number from the ss output
```

<!-- verify
grep -q '/tmp/.cache/kworkerd' /root/odgovor.txt 2>/dev/null || { echo "/root/odgovor.txt doesn't contain the correct path"; exit 1; }
-->
<!-- hint
`ss -tlnp` gives `pid=` in the `users:` column. Then `readlink /proc/<pid>/exe > /root/odgovor.txt`. A hidden directory in `/tmp` and a name that imitates a system process are classic signs of malware.
-->
<!-- solution
readlink /proc/$(pgrep -x kworkerd | head -1)/exe > /root/odgovor.txt
-->

## Remove it

In a real incident you would **first** preserve evidence (a copy of the binary, `/proc/PID/` information, network connections), and only then clean up. Do a short version of that (`dokazi` = evidence):

```bash
mkdir -p /root/dokazi
cp /tmp/.cache/kworkerd /root/dokazi/
sha256sum /root/dokazi/kworkerd > /root/dokazi/hash.txt
```

Then stop the process and delete the file from `/tmp/.cache`.

<!-- verify
ss -tln | grep -q ':4444 ' && { echo "Port 4444 is still listening"; exit 1; }
[ -e /tmp/.cache/kworkerd ] && { echo "/tmp/.cache/kworkerd still exists"; exit 1; }
[ -s /root/dokazi/hash.txt ] || { echo "You haven't saved the evidence hash in /root/dokazi/hash.txt"; exit 1; }
exit 0
-->
<!-- hint
`kill <PID>` (or `pkill -x kworkerd`), then `rm /tmp/.cache/kworkerd`.
-->
<!-- solution
mkdir -p /root/dokazi && cp /tmp/.cache/kworkerd /root/dokazi/ && sha256sum /root/dokazi/kworkerd > /root/dokazi/hash.txt
pkill -x kworkerd; sleep 0.5; rm -f /tmp/.cache/kworkerd
-->

## Restrict the database to localhost

The "database" on port 5432 listens on all interfaces, but it is used only by applications on this server. Change `BIND` in `/etc/app/db.env` to `127.0.0.1` and restart the service:

```bash
nano /etc/app/db.env
start-db
ss -tlnp | grep 5432
```

The admin panel on 8080 already correctly listens only on `127.0.0.1`. Compare it with the database.

<!-- verify
ss -tln | grep -q '127.0.0.1:5432 ' || { echo "Nothing is listening on 127.0.0.1:5432"; exit 1; }
ss -tln | grep -Eq '(0\.0\.0\.0|\*):5432 ' && { echo "The database still listens on all interfaces"; exit 1; }
exit 0
-->
<!-- solution
sed -i 's/^BIND=.*/BIND=127.0.0.1/' /etc/app/db.env && start-db && sleep 1
-->
