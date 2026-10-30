# Lab 1: Harden the SSH server

You've been handed a server with the default SSH configuration, and someone also added a cloud-init file along the way. Your task is to bring it up to CIS recommendations and to verify the **effective** configuration, not just what's written in the main file.

To edit files use `nano` (Ctrl+O saves, Ctrl+X exits) or `vim`.

<!-- setup
set -e
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
grep -q '^PermitRootLogin' /etc/ssh/sshd_config || echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 6/' /etc/ssh/sshd_config
sed -i 's/^#\?X11Forwarding.*/X11Forwarding yes/' /etc/ssh/sshd_config
mkdir -p /etc/ssh/sshd_config.d /run/sshd
cat > /etc/ssh/sshd_config.d/50-cloud-init.conf <<'EOF'
# dodao cloud-init pri kreiranju instance
PasswordAuthentication yes
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Ojačaj SSH server ===
Konfiguracija: /etc/ssh/sshd_config i /etc/ssh/sshd_config.d/
Efektivne vrijednosti: sshd -T
EOF
-->

## Look at the current state

Print the effective values of the key options:

```bash
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|x11forwarding|maxauthtries) '
```

Then see where they come from:

```bash
grep -nE '^(Include|PermitRootLogin|PasswordAuthentication|X11Forwarding|MaxAuthTries)' /etc/ssh/sshd_config
ls -l /etc/ssh/sshd_config.d/
```

Notice that `Include` sits at the **top** of the main file. That will matter in the third step.

## Disable root login

In `/etc/ssh/sshd_config` set `PermitRootLogin no`.

```bash
nano /etc/ssh/sshd_config
```

Then check the effective value with `sshd -T | grep permitrootlogin`.

<!-- verify
sshd -T 2>&1 | grep -qx 'permitrootlogin no' || { echo "Effective: $(sshd -T 2>&1 | grep -i permitrootlogin)"; exit 1; }
-->
<!-- hint
The line `PermitRootLogin yes` already exists in the main file. Change `yes` to `no`; don't add another line at the end, because for SSH options the **first** value found wins.
-->
<!-- solution
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
-->

## Disable password login

Set `PasswordAuthentication no` so that the **effective** value is `no`. Careful: changing only the main file is not enough.

<!-- verify
v=$(sshd -T 2>&1 | grep -i '^passwordauthentication')
[ "$v" = "passwordauthentication no" ] || { echo "Effective: $v"; echo "Look at the files in /etc/ssh/sshd_config.d/"; exit 1; }
-->
<!-- hint
`/etc/ssh/sshd_config.d/50-cloud-init.conf` is loaded before the rest of the main file and sets `PasswordAuthentication yes`. The first value wins. Change it to `no` in that file (or delete the file). This is a common real-world problem on cloud instances.
-->
<!-- solution
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf
-->

## Other CIS settings

Set:

- `MaxAuthTries 3`
- `X11Forwarding no`
- `KbdInteractiveAuthentication no`

Finally, check the syntax. If `sshd -t` prints nothing, the configuration is valid.

```bash
sshd -t && echo "Syntax OK"
```

<!-- verify
sshd -t || exit 1
cfg=$(sshd -T 2>&1)
ok=1
echo "$cfg" | grep -qx 'maxauthtries 3' || { echo "maxauthtries: $(echo "$cfg" | grep ^maxauthtries)"; ok=0; }
echo "$cfg" | grep -qx 'x11forwarding no' || { echo "x11forwarding: $(echo "$cfg" | grep ^x11forwarding)"; ok=0; }
echo "$cfg" | grep -qx 'kbdinteractiveauthentication no' || { echo "kbdinteractiveauthentication: $(echo "$cfg" | grep ^kbdinteractiveauthentication)"; ok=0; }
[ $ok = 1 ]
-->
<!-- hint
`KbdInteractiveAuthentication` already exists in the main file, and `MaxAuthTries` and `X11Forwarding` were set at the start of the lab. Modify the existing lines instead of adding new ones.
-->
<!-- solution
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/; s/^#\?X11Forwarding.*/X11Forwarding no/; s/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
-->

## Start the server and confirm it is listening

Start the SSH server with the new configuration and check that it listens on port 22:

```bash
/usr/sbin/sshd
ss -tlnp | grep ':22 '
```

On a real system you would use `systemctl reload ssh`, with an existing session kept open as a fallback.

<!-- verify
ss -tln | grep -q ':22 ' || { echo "Nothing is listening on port 22"; exit 1; }
-->
<!-- solution
/usr/sbin/sshd
-->
