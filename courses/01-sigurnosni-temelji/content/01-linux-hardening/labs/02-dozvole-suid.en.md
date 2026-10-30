# Lab 2: File permissions and SUID

The previous administrator handed out too many permissions "just to make it work". Find and fix four problems, and finally create a baseline inventory of SUID files for future comparison.

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

## Find files anyone can modify

```bash
find / -xdev -type f -perm -0002 2>/dev/null
find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null
```

The first command looks for files with the write bit set for "others". The second looks for directories anyone can write to that lack the sticky bit. Note down what you find.

## Protect the database password file

`/etc/app/db.conf` contains a password, and anyone can read and modify it. Set the owner to `root:root` and permissions to `600`.

```bash
ls -l /etc/app/db.conf
```

<!-- verify
s=$(stat -c '%a %U %G' /etc/app/db.conf)
[ "$s" = "600 root root" ] || { echo "Current: $s (expected: 600 root root)"; exit 1; }
-->
<!-- hint
`chown root:root /etc/app/db.conf` then `chmod 600 /etc/app/db.conf`. In practice the application would read the file as its own service user, so the owner would be that user, with permissions 600 or 640.
-->
<!-- solution
chown root:root /etc/app/db.conf && chmod 600 /etc/app/db.conf
-->

## Close the path to root via the cron script

Look at `/etc/cron.d/backup`. Root runs `/opt/scripts/backup.sh`, and anyone can modify that script. That means user `ana` can write anything into it and it will run as root.

Fix it so the owner is root and neither the group nor others can write to the script.

<!-- verify
f=/opt/scripts/backup.sh
[ "$(stat -c %U $f)" = root ] || { echo "Owner is not root"; exit 1; }
m=$(stat -c %a $f)
[ $(( 8#$m & 8#022 )) -eq 0 ] || { echo "Permissions $m: group or others can still write"; exit 1; }
su ana -s /bin/bash -c "echo test >> $f" 2>/dev/null && { echo "User ana can still write to the script"; exit 1; }
exit 0
-->
<!-- hint
`chmod 700 /opt/scripts/backup.sh` (or `750`). Also check the `/opt/scripts` directory: if anyone could write to it, they could replace the whole file.
-->
<!-- solution
chown root:root /opt/scripts/backup.sh && chmod 700 /opt/scripts/backup.sh
-->

## Remove an unnecessary SUID

Find all SUID files:

```bash
find / -xdev -perm -4000 -type f 2>/dev/null
```

Most are normal (`passwd`, `su`, `sudo`, `mount`…). One is not: a copy of `find` with the SUID bit gives root to everyone, because `find -exec` runs commands. Remove the SUID bit from that file, but **don't touch** system ones like `passwd`.

<!-- verify
[ -u /usr/local/bin/sfind ] && { echo "/usr/local/bin/sfind still has the SUID bit"; exit 1; }
[ -u /usr/bin/passwd ] || { echo "Careful: /usr/bin/passwd lost its SUID bit, and it needs it"; exit 1; }
exit 0
-->
<!-- hint
`chmod u-s /usr/local/bin/sfind`, or delete it entirely, since a copy of find in /usr/local/bin serves no purpose here.
-->
<!-- solution
chmod u-s /usr/local/bin/sfind
-->

## Secure the shared directory

`/srv/share` has permissions `777` without the sticky bit, so any user can delete and rename other people's files in it. Add the sticky bit (as on `/tmp`) or remove write access for others.

<!-- verify
m=$(stat -c %a /srv/share)
if [ -k /srv/share ] || [ $(( 8#$m & 8#002 )) -eq 0 ]; then exit 0; fi
echo "Currently $m without the sticky bit"; exit 1
-->
<!-- hint
`chmod +t /srv/share` gives `1777`, the same as `/tmp`. A better solution in practice: a dedicated group and `chmod 2770`.
-->
<!-- solution
chmod +t /srv/share
-->

## Create a SUID baseline

Save the current (now clean) list of SUID files. Later you can compare against it with `diff` and detect a new SUID file.

```bash
find / -xdev -perm -4000 -type f 2>/dev/null | sort > /root/suid-baseline.txt
cat /root/suid-baseline.txt
```

<!-- verify
f=/root/suid-baseline.txt
[ -s $f ] || { echo "The file doesn't exist or is empty"; exit 1; }
grep -q '/usr/bin/passwd' $f || { echo "/usr/bin/passwd is missing from the list"; exit 1; }
grep -q 'sfind' $f && { echo "sfind is still in the list: save the list only after the fix"; exit 1; }
exit 0
-->
<!-- solution
find / -xdev -perm -4000 -type f 2>/dev/null | sort > /root/suid-baseline.txt
-->
