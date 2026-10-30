# Lab 1: Reducing the attack surface of a node

The worker node `node01` has "grown" over the years: services and tools that Kubernetes doesn't need are still on it, and one user has more rights than necessary. Everything is done **on node01** (`ssh node01`).

```bash
ssh node01
ss -tlpn
systemctl list-units --type=service --state=running
```

<!-- setup
set -e
cluster-up
ssh node01 'bash -s' <<'EOF'
cat > /etc/systemd/system/legacy-ftp.service <<'U'
[Unit]
Description=Stari FTP servis za razmjenu fajlova
[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:21,fork,reuseaddr SYSTEM:"echo 220 legacy ftp ready"
Restart=always
[Install]
WantedBy=multi-user.target
U
cat > /etc/systemd/system/debug-shell.service <<'U'
[Unit]
Description=Debug shell (privremeno)
[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:4444,fork,reuseaddr EXEC:/bin/bash
Restart=always
[Install]
WantedBy=multi-user.target
U
systemctl daemon-reload
systemctl enable --now legacy-ftp debug-shell >/dev/null 2>&1
useradd -m -s /bin/bash devops-old
usermod -aG sudo devops-old
echo 'devops-old ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/devops-old
chmod 440 /etc/sudoers.d/devops-old
EOF
-->

## Who is listening on the network

Find the processes listening on ports **21** and **4444** on `node01`. Port 4444 gives a root shell to anyone who connects (a backdoor).

Write to `/root/servisi.txt` on **controlplane** the names of the systemd services that started those processes, one per line (e.g. `something.service`).

```bash
ssh node01 ss -tlpn
ssh node01 systemctl status <pid>
```

<!-- verify
f=/root/servisi.txt
grep -qE '^legacy-ftp(\.service)?$' $f 2>/dev/null && grep -qE '^debug-shell(\.service)?$' $f || { echo "servisi.txt must contain legacy-ftp and debug-shell"; exit 1; }
-->
<!-- hint
`ss -tlpn` shows the process PID (`users:(("socat",pid=…))`). `systemctl status <pid>` tells which service the process belongs to. Alternative: `lsof -i :4444`.
-->
<!-- solution
printf 'legacy-ftp.service\ndebug-shell.service\n' > /root/servisi.txt
-->

## Stop and disable the services

Stop and **disable** both services on `node01` so they don't come back even after a restart. Ports 21 and 4444 must no longer be listening.

<!-- verify
for s in legacy-ftp debug-shell; do
  ssh node01 systemctl is-active $s 2>/dev/null | grep -qx active && { echo "$s is still running"; exit 1; }
  ssh node01 systemctl is-enabled $s 2>/dev/null | grep -qx enabled && { echo "$s is still enabled"; exit 1; }
done
ssh node01 ss -tln | grep -qE ':(21|4444) ' && { echo "port 21 or 4444 is still listening"; exit 1; }
exit 0
-->
<!-- hint
`systemctl disable --now legacy-ftp debug-shell`. Even stricter: `systemctl mask …` also prevents manual starts.
-->
<!-- solution
ssh node01 systemctl disable --now legacy-ftp debug-shell >/dev/null 2>&1
-->

## Remove unneeded packages

`node01` has tools installed that aren't needed on a worker node and make an attacker's job easier: `netcat-openbsd` and `nano`. Remove both packages (`apt-get purge`).

Note: apt in the lab has no internet access. Removing packages works without it.

<!-- verify
for p in netcat-openbsd nano; do ssh node01 dpkg -s $p >/dev/null 2>&1 && { echo "package $p is still installed"; exit 1; }; done
exit 0
-->
<!-- solution
ssh node01 'DEBIAN_FRONTEND=noninteractive apt-get purge -y netcat-openbsd nano >/dev/null 2>&1'
-->

## A user with too many rights

The user `devops-old` on `node01` no longer needs administrator rights:

1. remove them from the `sudo` group,
2. delete their file in `/etc/sudoers.d/`,
3. lock the account (`usermod -L`) and set their shell to `/usr/sbin/nologin`.

<!-- verify
ssh node01 id -nG devops-old 2>/dev/null | grep -qw sudo && { echo "devops-old is still in the sudo group"; exit 1; }
ssh node01 test -e /etc/sudoers.d/devops-old && { echo "/etc/sudoers.d/devops-old still exists"; exit 1; }
ssh node01 getent passwd devops-old | grep -q '/usr/sbin/nologin$' || { echo "the shell is not /usr/sbin/nologin"; exit 1; }
ssh node01 passwd -S devops-old | awk '{print $2}' | grep -qx L || { echo "the account is not locked"; exit 1; }
-->
<!-- hint
`gpasswd -d devops-old sudo`, `rm /etc/sudoers.d/devops-old`, `usermod -L -s /usr/sbin/nologin devops-old`. Check: `sudo -l -U devops-old`.
-->
<!-- solution
ssh node01 'gpasswd -d devops-old sudo >/dev/null; rm -f /etc/sudoers.d/devops-old; usermod -L -s /usr/sbin/nologin devops-old'
-->
