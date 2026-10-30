# Lab 3: sudo i najmanje privilegije

Dva servisna korisnika imaju preširoka sudo prava:

- `deploy` treba samo restartovati aplikaciju, a ima puni root.
- `ops` treba čitati logove, a dobio je `less` kroz sudo, iz kojeg se može pokrenuti shell.

Smanji im prava na minimum koji im treba za posao.

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

## Pregledaj trenutna prava

```bash
sudo -l -U deploy
sudo -l -U ops
ls -l /etc/sudoers.d/
```

Odgovori sebi: šta `deploy` može uraditi? Kako bi `ops` dobio root shell kroz `less`? (Unutar `less` se kuca `!bash`.)

## Ograniči deploy korisnika

Promijeni pravilo za `deploy` tako da smije pokrenuti **samo** `/usr/local/bin/restart-app` kao root, bez lozinke. Koristi `visudo` da ne napraviš sintaksnu grešku:

```bash
visudo -f /etc/sudoers.d/90-deploy
```

Testiraj kao taj korisnik:

```bash
su - deploy -c 'sudo -n /usr/local/bin/restart-app'
su - deploy -c 'sudo -n id'
```

Prva komanda treba uspjeti, druga treba biti odbijena.

<!-- verify
visudo -cf /etc/sudoers.d/90-deploy 2>&1 | grep -q 'parsed OK' || { echo "Sintaksna greška u 90-deploy:"; visudo -cf /etc/sudoers.d/90-deploy; exit 1; }
su - deploy -c 'sudo -n /usr/local/bin/restart-app' >/dev/null 2>&1 || { echo "deploy ne može pokrenuti restart-app"; exit 1; }
su - deploy -c 'sudo -n id' >/dev/null 2>&1 && { echo "deploy i dalje može pokrenuti bilo šta (npr. id) kao root"; exit 1; }
exit 0
-->
<!-- hint
Sadržaj fajla treba biti jedna linija:

    deploy ALL=(root) NOPASSWD: /usr/local/bin/restart-app

Uvijek puna putanja do komande.
-->
<!-- solution
echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/restart-app' > /etc/sudoers.d/90-deploy
-->

## Zamijeni sudo pravilo za ops korisnika grupom

`ops` samo čita logove. Za to mu ne treba sudo: na Ubuntuu grupa `adm` može čitati većinu logova u `/var/log`.

1. Dodaj `ops` u grupu `adm`.
2. Obriši `/etc/sudoers.d/91-ops`.

```bash
usermod -aG adm ops
rm /etc/sudoers.d/91-ops
su - ops -c 'cat /var/log/app.log'
```

<!-- verify
id -nG ops | tr ' ' '\n' | grep -qx adm || { echo "ops nije u grupi adm"; exit 1; }
sudo -l -U ops 2>&1 | grep -q 'not allowed' || { echo "ops i dalje ima sudo pravila:"; sudo -l -U ops; exit 1; }
su - ops -c 'cat /var/log/app.log' >/dev/null 2>&1 || { echo "ops ne može čitati /var/log/app.log"; exit 1; }
exit 0
-->
<!-- hint
`usermod -aG adm ops`. Bez `-a` bi `-G` zamijenio sve dodatne grupe korisnika, a ne dodao novu.
-->
<!-- solution
usermod -aG adm ops && rm -f /etc/sudoers.d/91-ops
-->

## Provjeri dozvole sudoers fajlova

Svi fajlovi u `/etc/sudoers.d/` trebaju imati dozvole `440` i vlasnika root. Jedan ih nema. Popravi to i na kraju pokreni `visudo -c`.

```bash
ls -l /etc/sudoers.d/
visudo -c
```

<!-- verify
bad=$(find /etc/sudoers.d -type f ! -name README \( ! -perm 440 -o ! -user root \))
[ -z "$bad" ] || { echo "Pogrešne dozvole: $bad"; exit 1; }
visudo -c >/dev/null || exit 1
-->
<!-- hint
`chmod 440 /etc/sudoers.d/90-deploy`. visudo -f čuva postojeće dozvole fajla, pa je 644 iz pripreme ostao.
-->
<!-- solution
chmod 440 /etc/sudoers.d/90-deploy
-->
