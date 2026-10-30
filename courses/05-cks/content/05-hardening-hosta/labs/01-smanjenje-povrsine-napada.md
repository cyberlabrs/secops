# Lab 1: Smanjenje površine napada na čvoru

Radni čvor `node01` je godinama „rastao“: na njemu su ostali servisi i alati koji Kubernetesu ne trebaju, a jedan korisnik ima više prava nego što treba. Sve se radi **na node01** (`ssh node01`).

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

## Ko sluša na mreži

Pronađi procese koji slušaju na portovima **21** i **4444** na `node01`. Port 4444 daje root shell svakome ko se poveže (backdoor).

U `/root/servisi.txt` na **controlplane** upiši imena systemd servisa koji su pokrenuli te procese, svaki u svom redu (npr. `nesto.service`).

```bash
ssh node01 ss -tlpn
ssh node01 systemctl status <pid>
```

<!-- verify
f=/root/servisi.txt
grep -qE '^legacy-ftp(\.service)?$' $f 2>/dev/null && grep -qE '^debug-shell(\.service)?$' $f || { echo "servisi.txt treba sadržati legacy-ftp i debug-shell"; exit 1; }
-->
<!-- hint
`ss -tlpn` pokazuje PID procesa (`users:(("socat",pid=…))`). `systemctl status <pid>` kaže kom servisu proces pripada. Alternativa: `lsof -i :4444`.
-->
<!-- solution
printf 'legacy-ftp.service\ndebug-shell.service\n' > /root/servisi.txt
-->

## Ugasi i onemogući servise

Zaustavi i **onemogući** oba servisa na `node01`, tako da se ne vrate ni poslije restarta. Portovi 21 i 4444 više ne smiju slušati.

<!-- verify
for s in legacy-ftp debug-shell; do
  ssh node01 systemctl is-active $s 2>/dev/null | grep -qx active && { echo "$s i dalje radi"; exit 1; }
  ssh node01 systemctl is-enabled $s 2>/dev/null | grep -qx enabled && { echo "$s je i dalje enabled"; exit 1; }
done
ssh node01 ss -tln | grep -qE ':(21|4444) ' && { echo "port 21 ili 4444 i dalje sluša"; exit 1; }
exit 0
-->
<!-- hint
`systemctl disable --now legacy-ftp debug-shell`. Još strožije: `systemctl mask …` sprečava i ručno pokretanje.
-->
<!-- solution
ssh node01 systemctl disable --now legacy-ftp debug-shell >/dev/null 2>&1
-->

## Ukloni nepotrebne pakete

Na `node01` su instalirani alati koji na radnom čvoru nisu potrebni, a napadaču olakšavaju posao: `netcat-openbsd` i `nano`. Ukloni oba paketa (`apt-get purge`).

Napomena: apt u labu nema pristup internetu. Uklanjanje paketa radi i bez njega.

<!-- verify
for p in netcat-openbsd nano; do ssh node01 dpkg -s $p >/dev/null 2>&1 && { echo "paket $p je i dalje instaliran"; exit 1; }; done
exit 0
-->
<!-- solution
ssh node01 'DEBIAN_FRONTEND=noninteractive apt-get purge -y netcat-openbsd nano >/dev/null 2>&1'
-->

## Korisnik sa previše prava

Korisnik `devops-old` na `node01` više ne treba administratorska prava:

1. ukloni ga iz grupe `sudo`,
2. obriši njegov fajl u `/etc/sudoers.d/`,
3. zaključaj nalog (`usermod -L`) i postavi mu shell na `/usr/sbin/nologin`.

<!-- verify
ssh node01 id -nG devops-old 2>/dev/null | grep -qw sudo && { echo "devops-old je i dalje u grupi sudo"; exit 1; }
ssh node01 test -e /etc/sudoers.d/devops-old && { echo "/etc/sudoers.d/devops-old i dalje postoji"; exit 1; }
ssh node01 getent passwd devops-old | grep -q '/usr/sbin/nologin$' || { echo "shell nije /usr/sbin/nologin"; exit 1; }
ssh node01 passwd -S devops-old | awk '{print $2}' | grep -qx L || { echo "nalog nije zaključan"; exit 1; }
-->
<!-- hint
`gpasswd -d devops-old sudo`, `rm /etc/sudoers.d/devops-old`, `usermod -L -s /usr/sbin/nologin devops-old`. Provjera: `sudo -l -U devops-old`.
-->
<!-- solution
ssh node01 'gpasswd -d devops-old sudo >/dev/null; rm -f /etc/sudoers.d/devops-old; usermod -L -s /usr/sbin/nologin devops-old'
-->
