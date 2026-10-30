# Lab 3: sudo and least privilege

Two service users have overly broad sudo rights:

- `deploy` only needs to restart the application, but has full root.
- `ops` needs to read logs, but was given `less` through sudo, from which a shell can be spawned.

Reduce their rights to the minimum they need for their job.

<!-- setup
set -e
useradd -m -s /bin/bash deploy
useradd -m -s /bin/bash ops
printf '#!/bin/bash\necho "aplikacija restartovana u $(date +%%T)"\n' > /usr/local/bin/restart-app
chmod 755 /usr/local/bin/restart-app
echo 'deploy ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/90-deploy
echo 'ops ALL=(root) NOPASSWD: /usr/bin/less /var/log/*' > /etc/sudoers.d/91-ops
chmod 644 /etc/sudoers.d/90-deploy
chmod 440 /etc/sudoers.d/91-ops
echo "$(date) app start" > /var/log/app.log
chgrp adm /var/log/app.log && chmod 640 /var/log/app.log
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: sudo i najmanje privilegije ===
Pravila: /etc/sudoers.d/   Uređuj sa: visudo -f /etc/sudoers.d/IME
EOF
-->

## Review the current rights

```bash
sudo -l -U deploy
sudo -l -U ops
ls -l /etc/sudoers.d/
```

Ask yourself: what can `deploy` do? How would `ops` get a root shell through `less`? (Inside `less` you type `!bash`.)

## Restrict the deploy user

Change the rule for `deploy` so it may run **only** `/usr/local/bin/restart-app` as root, without a password. Use `visudo` so you don't make a syntax error:

```bash
visudo -f /etc/sudoers.d/90-deploy
```

Test as that user:

```bash
su - deploy -c 'sudo -n /usr/local/bin/restart-app'
su - deploy -c 'sudo -n id'
```

The first command should succeed, the second should be denied.

<!-- verify
visudo -cf /etc/sudoers.d/90-deploy 2>&1 | grep -q 'parsed OK' || { echo "Syntax error in 90-deploy:"; visudo -cf /etc/sudoers.d/90-deploy; exit 1; }
su - deploy -c 'sudo -n /usr/local/bin/restart-app' >/dev/null 2>&1 || { echo "deploy can't run restart-app"; exit 1; }
su - deploy -c 'sudo -n id' >/dev/null 2>&1 && { echo "deploy can still run anything (e.g. id) as root"; exit 1; }
exit 0
-->
<!-- hint
The file should contain a single line:

    deploy ALL=(root) NOPASSWD: /usr/local/bin/restart-app

Always use the full path to the command.
-->
<!-- solution
echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/restart-app' > /etc/sudoers.d/90-deploy
-->

## Replace the ops sudo rule with a group

`ops` only reads logs. It doesn't need sudo for that: on Ubuntu the `adm` group can read most logs in `/var/log`.

1. Add `ops` to the `adm` group.
2. Delete `/etc/sudoers.d/91-ops`.

```bash
usermod -aG adm ops
rm /etc/sudoers.d/91-ops
su - ops -c 'cat /var/log/app.log'
```

<!-- verify
id -nG ops | tr ' ' '\n' | grep -qx adm || { echo "ops is not in the adm group"; exit 1; }
sudo -l -U ops 2>&1 | grep -q 'not allowed' || { echo "ops still has sudo rules:"; sudo -l -U ops; exit 1; }
su - ops -c 'cat /var/log/app.log' >/dev/null 2>&1 || { echo "ops can't read /var/log/app.log"; exit 1; }
exit 0
-->
<!-- hint
`usermod -aG adm ops`. Without `-a`, `-G` would replace all of the user's supplementary groups instead of adding a new one.
-->
<!-- solution
usermod -aG adm ops && rm -f /etc/sudoers.d/91-ops
-->

## Check sudoers file permissions

All files in `/etc/sudoers.d/` should have permissions `440` and be owned by root. One of them doesn't. Fix it and finally run `visudo -c`.

```bash
ls -l /etc/sudoers.d/
visudo -c
```

<!-- verify
bad=$(find /etc/sudoers.d -type f ! -name README \( ! -perm 440 -o ! -user root \))
[ -z "$bad" ] || { echo "Wrong permissions: $bad"; exit 1; }
visudo -c >/dev/null || exit 1
-->
<!-- hint
`chmod 440 /etc/sudoers.d/90-deploy`. visudo -f keeps the file's existing permissions, so the 644 from setup remained.
-->
<!-- solution
chmod 440 /etc/sudoers.d/90-deploy
-->
