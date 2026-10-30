# Lab 1: Roles, groups and an employee leaving

A small team shares a server. Right now everyone can do everything, and former colleague Petar still has access. You'll introduce simple RBAC using Linux groups and carry out the **Leaver** process properly.

| Person | Role | Needs |
|---|---|---|
| ana | developer | read and write in `/srv/projekt` |
| marko | auditor | read-only `/srv/logovi`, no access to the project |
| petar | left the company | nothing |

(`projekt` = project, `logovi` = logs; keep the directory names as they are.)

<!-- setup
set -e
for u in ana marko petar; do useradd -m -s /bin/bash $u; done
mkdir -p /srv/projekt /srv/logovi /home/petar/.ssh
echo 'print("app")' > /srv/projekt/app.py
echo "$(date) login ok" > /srv/logovi/app.log
chmod -R 777 /srv/projekt /srv/logovi
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKeyZaLabPetarLaptop petar@laptop' > /home/petar/.ssh/authorized_keys
chown -R petar:petar /home/petar/.ssh && chmod 700 /home/petar/.ssh && chmod 600 /home/petar/.ssh/authorized_keys
echo '*/5 * * * * curl -s http://example.invalid/sync >/dev/null' | crontab -u petar -
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: RBAC i Leaver ===
Korisnici: ana (dev), marko (revizor), petar (otišao)
EOF
-->

## Create roles as groups

Create the groups `devs` and `auditors`, add `ana` to `devs` and `marko` to `auditors`.

```bash
groupadd devs
groupadd auditors
usermod -aG devs ana
usermod -aG auditors marko
id ana; id marko
```

In RBAC terms a group is a **role**: you grant rights to the group and add people to the group. When someone changes jobs, you change membership, not permissions in dozens of places.

<!-- verify
id -nG ana | tr ' ' '\n' | grep -qx devs || { echo "ana is not in the devs group"; exit 1; }
id -nG marko | tr ' ' '\n' | grep -qx auditors || { echo "marko is not in the auditors group"; exit 1; }
id -nG marko | tr ' ' '\n' | grep -qx devs && { echo "marko should not be in devs"; exit 1; }
exit 0
-->
<!-- solution
groupadd devs; groupadd auditors; usermod -aG devs ana; usermod -aG auditors marko
-->

## Lock the project down to developers

`/srv/projekt` should belong to the `devs` group. Group members read and write, others have no access. Also set the **setgid** bit on the directory (`2770`), so new files automatically belong to the `devs` group.

```bash
chown -R root:devs /srv/projekt
chmod 2770 /srv/projekt
chmod 660 /srv/projekt/app.py
ls -ld /srv/projekt; ls -l /srv/projekt
su - ana -c 'echo test > /srv/projekt/ana.txt && ls -l /srv/projekt/ana.txt'
su - marko -c 'ls /srv/projekt'
```

Ana should succeed, and Marko should get `Permission denied`.

<!-- verify
su - ana -c 'touch /srv/projekt/.provjera-ana' 2>/dev/null || { echo "ana can't write to /srv/projekt"; exit 1; }
[ "$(stat -c %G /srv/projekt/.provjera-ana)" = devs ] || { echo "New files don't belong to the devs group (setgid bit?)"; rm -f /srv/projekt/.provjera-ana; exit 1; }
rm -f /srv/projekt/.provjera-ana
su - marko -c 'ls /srv/projekt' >/dev/null 2>&1 && { echo "marko can still see the project contents"; exit 1; }
su - marko -c 'cat /srv/projekt/app.py' >/dev/null 2>&1 && { echo "marko can still read app.py"; exit 1; }
exit 0
-->
<!-- hint
The setgid bit on a directory is the `2` in `2770`. Without it, a new file gets the primary group of the user who created it (`ana`), so other developers couldn't modify it.
-->
<!-- solution
chown -R root:devs /srv/projekt && chmod 2770 /srv/projekt && chmod 660 /srv/projekt/app.py
-->

## Read-only for auditors

`/srv/logovi` should belong to the `auditors` group. Auditors read but don't modify, and others have no access. Root writes the files.

```bash
chown -R root:auditors /srv/logovi
chmod 750 /srv/logovi
chmod 640 /srv/logovi/app.log
su - marko -c 'cat /srv/logovi/app.log'
su - marko -c 'echo fake > /srv/logovi/app.log'
su - ana -c 'cat /srv/logovi/app.log'
```

<!-- verify
su - marko -c 'cat /srv/logovi/app.log' >/dev/null 2>&1 || { echo "marko can't read the log"; exit 1; }
su - marko -c 'echo x >> /srv/logovi/app.log' 2>/dev/null && { echo "marko can modify the log, and shouldn't be able to"; exit 1; }
su - marko -c 'touch /srv/logovi/novi' 2>/dev/null && { echo "marko can create files in /srv/logovi"; exit 1; }
su - ana -c 'cat /srv/logovi/app.log' >/dev/null 2>&1 && { echo "ana can read the logs, and shouldn't"; exit 1; }
exit 0
-->
<!-- solution
chown -R root:auditors /srv/logovi && chmod 750 /srv/logovi && chmod 640 /srv/logovi/app.log
-->

## Leaver: Petar has left the company

Locking the password is **not enough**: Petar has an SSH key and a cron job that still runs. Do all four things:

1. Lock the account and mark it as expired.
2. Set the shell to `/usr/sbin/nologin`.
3. Remove his SSH keys.
4. Remove his crontab (look at it first, it's evidence of what he was doing).

```bash
crontab -l -u petar
usermod -L -e 1 -s /usr/sbin/nologin petar
rm /home/petar/.ssh/authorized_keys
crontab -r -u petar
passwd -S petar
```

The account is **not deleted right away**: the UID and files remain for auditing and ownership transfer. Deletion comes later, according to company policy.

<!-- verify
passwd -S petar | awk '{print $2}' | grep -qx L || { echo "The account is not locked (passwd -S petar)"; exit 1; }
[ "$(getent passwd petar | cut -d: -f7)" = /usr/sbin/nologin ] || { echo "The shell is not /usr/sbin/nologin"; exit 1; }
[ -s /home/petar/.ssh/authorized_keys ] && { echo "The SSH key still exists"; exit 1; }
crontab -l -u petar >/dev/null 2>&1 && { echo "The crontab still exists"; exit 1; }
exp=$(chage -l petar | grep 'Account expires' | cut -d: -f2 | xargs)
[ "$exp" != never ] || { echo "The account has no expiry date (usermod -e 1)"; exit 1; }
exit 0
-->
<!-- solution
usermod -L -e 1 -s /usr/sbin/nologin petar; rm -f /home/petar/.ssh/authorized_keys; crontab -r -u petar
-->
