# Lab 1: Hunting for persistence

Monitoring reported unusual outbound traffic from this server. The attacker has lost their initial access, but before that they set up **five persistence mechanisms**. Find each one, remove it and record the ATT&CK technique in the report `/root/nalazi.txt` ("nalazi" = findings), one per line, in the format:

```text
T1053.003 /etc/cron.d/file-name
```

All the "malicious" files are harmless: they only write a line to a log. Act as if they weren't.

<!-- setup
set -e
mkdir -p /var/tmp/.sys /root/.ssh /etc/systemd/system/multi-user.target.wants
cat > /var/tmp/.sys/update.sh <<'EOF'
#!/bin/bash
echo "$(date) beacon" >> /var/tmp/.sys/.log
EOF
chmod 755 /var/tmp/.sys/update.sh
echo '*/10 * * * * root /var/tmp/.sys/update.sh >/dev/null 2>&1' > /etc/cron.d/sys-update
echo '0 3 * * * root /usr/sbin/logrotate /etc/logrotate.conf' > /etc/cron.d/logrotate-noc
cat > /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKursLabAdminLaptopKljuc0000000000000001 admin@laptop
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKursLabPersistencija00000000000000000666 backup@ops-srv
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKursLabCiDeployKljuc000000000000000002 ci-deploy@github
EOF
chmod 600 /root/.ssh/authorized_keys
cat > /root/poznati-kljucevi.txt <<'EOF'
# Odobreni SSH ključevi za root (iz CMDB-a)
admin@laptop
ci-deploy@github
EOF
echo 'sysbackup:x:0:0:System Backup:/var/tmp/.sys:/bin/bash' >> /etc/passwd
echo 'sysbackup:$6$kurslab$Gv9yQ6Wm2t0mY9h1m6c7m1QXH2bqzYbqk4d3F7cR8p1n0uX0v5wqN3y1o9mJ8bq0vM8sGx5mGxK1QWl0vZf3h/:20000:0:99999:7:::' >> /etc/shadow
cat > /etc/profile.d/zz-motd.sh <<'EOF'
# prikaz poruke dana
(/var/tmp/.sys/update.sh &) >/dev/null 2>&1
EOF
cat > /etc/systemd/system/dbus-helper.service <<'EOF'
[Unit]
Description=D-Bus Helper Service

[Service]
ExecStart=/var/tmp/.sys/update.sh
Restart=always
RestartSec=600

[Install]
WantedBy=multi-user.target
EOF
ln -sf /etc/systemd/system/dbus-helper.service /etc/systemd/system/multi-user.target.wants/dbus-helper.service
touch /root/nalazi.txt
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Lov na perzistenciju ===
Pet mehanizama. Izvještaj: /root/nalazi.txt  (format: TEHNIKA putanja)
EOF
-->

## Cron (T1053.003)

Review all the locations where cron looks for jobs:

```bash
ls -la /etc/cron.d/ /etc/cron.hourly/ /etc/cron.daily/ /var/spool/cron/crontabs/ 2>/dev/null
cat /etc/cron.d/*
cat /etc/crontab
```

One job runs a script from a hidden directory in `/var/tmp`. The other (logrotate) is legitimate; don't touch it. Delete the malicious file and add the finding:

```bash
echo "T1053.003 /etc/cron.d/NAME" >> /root/nalazi.txt
```

<!-- verify
[ -e /etc/cron.d/sys-update ] && { echo "The malicious cron file still exists"; exit 1; }
[ -e /etc/cron.d/logrotate-noc ] || { echo "You also deleted the legitimate logrotate job"; exit 1; }
grep -q 'T1053.003' /root/nalazi.txt || { echo "/root/nalazi.txt doesn't contain T1053.003"; exit 1; }
-->
<!-- solution
rm /etc/cron.d/sys-update && echo "T1053.003 /etc/cron.d/sys-update" >> /root/nalazi.txt
-->

## SSH keys (T1098.004)

```bash
cat /root/.ssh/authorized_keys
cat /root/poznati-kljucevi.txt
```

Compare the keys with the approved list from the CMDB (`poznati-kljucevi.txt` = known keys). Remove the key that isn't on the list, and keep the approved ones.

<!-- verify
f=/root/.ssh/authorized_keys
grep -q 'backup@ops-srv' $f && { echo "The unapproved key is still in authorized_keys"; exit 1; }
grep -q 'admin@laptop' $f && grep -q 'ci-deploy@github' $f || { echo "You also deleted an approved key"; exit 1; }
grep -q 'T1098.004' /root/nalazi.txt || { echo "/root/nalazi.txt doesn't contain T1098.004"; exit 1; }
-->
<!-- hint
`sed -i '/backup@ops-srv/d' /root/.ssh/authorized_keys`. Copy the file to your evidence before deleting. In practice `authorized_keys` is managed centrally (Ansible, SSH CA), so any deviation from the desired state raises an alert.
-->
<!-- solution
sed -i '/backup@ops-srv/d' /root/.ssh/authorized_keys && echo "T1098.004 /root/.ssh/authorized_keys" >> /root/nalazi.txt
-->

## Hidden root account (T1136.001)

Every account with UID 0 **is root**, regardless of its name.

```bash
awk -F: '$3 == 0 {print $1, $6, $7}' /etc/passwd
```

Remove the account that isn't `root`. `userdel` may refuse to delete it, because UID 0 is used by active processes (root's processes), so remove the lines directly from `/etc/passwd` and `/etc/shadow`.

<!-- verify
n=$(awk -F: '$3 == 0' /etc/passwd | grep -vc '^root:')
[ "$n" -eq 0 ] || { echo "There is still an account with UID 0 other than root"; exit 1; }
grep -q '^sysbackup:' /etc/shadow && { echo "The account is still in /etc/shadow"; exit 1; }
grep -q '^root:' /etc/passwd || { echo "Careful: you deleted root"; exit 1; }
grep -q 'T1136.001' /root/nalazi.txt || { echo "/root/nalazi.txt doesn't contain T1136.001"; exit 1; }
-->
<!-- hint
`sed -i '/^sysbackup:/d' /etc/passwd /etc/shadow`, then check with `pwck -r`.
-->
<!-- solution
sed -i '/^sysbackup:/d' /etc/passwd /etc/shadow && echo "T1136.001 sysbackup (UID 0)" >> /root/nalazi.txt
-->

## Shell configuration (T1546.004)

Scripts in `/etc/profile.d/` run on **every** login by any user. Find the one that runs something from `/var/tmp`:

```bash
grep -rn 'var/tmp' /etc/profile.d/ /etc/profile /etc/bash.bashrc /root/.bashrc /root/.profile 2>/dev/null
```

Remove it and record it.

<!-- verify
grep -rqs 'var/tmp/.sys' /etc/profile.d/ /etc/profile /etc/bash.bashrc && { echo "A shell init file still runs /var/tmp/.sys"; exit 1; }
grep -q 'T1546.004' /root/nalazi.txt || { echo "/root/nalazi.txt doesn't contain T1546.004"; exit 1; }
-->
<!-- solution
rm /etc/profile.d/zz-motd.sh && echo "T1546.004 /etc/profile.d/zz-motd.sh" >> /root/nalazi.txt
-->

## Systemd service (T1543.002) and cleanup

The attacker created a service with a system-sounding name. Find unit files that run something outside standard paths:

```bash
grep -rl 'ExecStart=/var/tmp\|ExecStart=/tmp\|ExecStart=/dev/shm' /etc/systemd/system/ 2>/dev/null
ls -la /etc/systemd/system/multi-user.target.wants/
```

Remove the unit file **and** the symlink that enables it. On a real system you would first run `systemctl disable --now name.service`.

Finally, delete the whole `/var/tmp/.sys` directory, once all mechanisms that launch it have been removed. Check the report again: it must contain all five techniques.

```bash
cat /root/nalazi.txt
```

<!-- verify
ls /etc/systemd/system/dbus-helper.service /etc/systemd/system/multi-user.target.wants/dbus-helper.service >/dev/null 2>&1 && { echo "The unit file or symlink still exists"; exit 1; }
[ -L /etc/systemd/system/multi-user.target.wants/dbus-helper.service ] && { echo "A broken symlink was left behind"; exit 1; }
[ -e /var/tmp/.sys ] && { echo "/var/tmp/.sys still exists"; exit 1; }
for t in T1053.003 T1098.004 T1136.001 T1546.004 T1543.002; do grep -q $t /root/nalazi.txt || { echo "The report is missing $t"; exit 1; }; done
exit 0
-->
<!-- solution
rm -f /etc/systemd/system/multi-user.target.wants/dbus-helper.service /etc/systemd/system/dbus-helper.service
rm -rf /var/tmp/.sys
echo "T1543.002 /etc/systemd/system/dbus-helper.service" >> /root/nalazi.txt
-->
