# Lab 1: Lov na perzistenciju

Monitoring je javio neobičan izlazni saobraćaj sa ovog servera. Napadač je izgubio inicijalni pristup, ali je prije toga postavio **pet mehanizama perzistencije**. Pronađi svaki, ukloni ga i zabilježi ATT&CK tehniku u izvještaj `/root/nalazi.txt`, jednu po liniji, u formatu:

```text
T1053.003 /etc/cron.d/ime-fajla
```

Svi „zlonamjerni“ fajlovi su bezopasni: samo upisuju liniju u log. Ponašaj se kao da nisu.

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

Pregledaj sve lokacije gdje cron traži poslove:

```bash
ls -la /etc/cron.d/ /etc/cron.hourly/ /etc/cron.daily/ /var/spool/cron/crontabs/ 2>/dev/null
cat /etc/cron.d/*
cat /etc/crontab
```

Jedan posao pokreće skriptu iz skrivenog direktorija u `/var/tmp`. Drugi (logrotate) je legitiman, njega ne diraj. Obriši zlonamjerni fajl i dodaj nalaz:

```bash
echo "T1053.003 /etc/cron.d/IME" >> /root/nalazi.txt
```

<!-- verify
[ -e /etc/cron.d/sys-update ] && { echo "Zlonamjerni cron fajl i dalje postoji"; exit 1; }
[ -e /etc/cron.d/logrotate-noc ] || { echo "Obrisao si i legitimni logrotate posao"; exit 1; }
grep -q 'T1053.003' /root/nalazi.txt || { echo "U /root/nalazi.txt nema T1053.003"; exit 1; }
-->
<!-- solution
rm /etc/cron.d/sys-update && echo "T1053.003 /etc/cron.d/sys-update" >> /root/nalazi.txt
-->

## SSH ključevi (T1098.004)

```bash
cat /root/.ssh/authorized_keys
cat /root/poznati-kljucevi.txt
```

Uporedi ključeve sa odobrenom listom iz CMDB-a. Ukloni ključ koji nije na listi, a odobrene ostavi.

<!-- verify
f=/root/.ssh/authorized_keys
grep -q 'backup@ops-srv' $f && { echo "Neodobreni ključ je i dalje u authorized_keys"; exit 1; }
grep -q 'admin@laptop' $f && grep -q 'ci-deploy@github' $f || { echo "Obrisao si i odobreni ključ"; exit 1; }
grep -q 'T1098.004' /root/nalazi.txt || { echo "U /root/nalazi.txt nema T1098.004"; exit 1; }
-->
<!-- hint
`sed -i '/backup@ops-srv/d' /root/.ssh/authorized_keys`. Prije brisanja kopiraj fajl u dokaze. U praksi se `authorized_keys` upravlja centralno (Ansible, SSH CA), pa svako odstupanje od željenog stanja diže alarm.
-->
<!-- solution
sed -i '/backup@ops-srv/d' /root/.ssh/authorized_keys && echo "T1098.004 /root/.ssh/authorized_keys" >> /root/nalazi.txt
-->

## Skriveni root nalog (T1136.001)

Svaki nalog sa UID 0 **je root**, bez obzira na ime.

```bash
awk -F: '$3 == 0 {print $1, $6, $7}' /etc/passwd
```

Ukloni nalog koji nije `root`. `userdel` može odbiti brisanje, jer UID 0 koriste aktivni procesi (procesi root-a), pa ukloni linije direktno iz `/etc/passwd` i `/etc/shadow`.

<!-- verify
n=$(awk -F: '$3 == 0' /etc/passwd | grep -vc '^root:')
[ "$n" -eq 0 ] || { echo "I dalje postoji nalog sa UID 0 osim root"; exit 1; }
grep -q '^sysbackup:' /etc/shadow && { echo "Nalog je i dalje u /etc/shadow"; exit 1; }
grep -q '^root:' /etc/passwd || { echo "Oprez: obrisao si root"; exit 1; }
grep -q 'T1136.001' /root/nalazi.txt || { echo "U /root/nalazi.txt nema T1136.001"; exit 1; }
-->
<!-- hint
`sed -i '/^sysbackup:/d' /etc/passwd /etc/shadow`, pa provjeri sa `pwck -r`.
-->
<!-- solution
sed -i '/^sysbackup:/d' /etc/passwd /etc/shadow && echo "T1136.001 sysbackup (UID 0)" >> /root/nalazi.txt
-->

## Shell konfiguracija (T1546.004)

Skripte u `/etc/profile.d/` izvršavaju se pri **svakoj** prijavi bilo kojeg korisnika. Pronađi onu koja pokreće nešto iz `/var/tmp`:

```bash
grep -rn 'var/tmp' /etc/profile.d/ /etc/profile /etc/bash.bashrc /root/.bashrc /root/.profile 2>/dev/null
```

Ukloni je i zabilježi.

<!-- verify
grep -rqs 'var/tmp/.sys' /etc/profile.d/ /etc/profile /etc/bash.bashrc && { echo "Neki shell init fajl i dalje pokreće /var/tmp/.sys"; exit 1; }
grep -q 'T1546.004' /root/nalazi.txt || { echo "U /root/nalazi.txt nema T1546.004"; exit 1; }
-->
<!-- solution
rm /etc/profile.d/zz-motd.sh && echo "T1546.004 /etc/profile.d/zz-motd.sh" >> /root/nalazi.txt
-->

## Systemd servis (T1543.002) i čišćenje

Napadač je napravio servis sa imenom koje zvuči sistemski. Pronađi unit fajlove koji pokreću nešto izvan standardnih putanja:

```bash
grep -rl 'ExecStart=/var/tmp\|ExecStart=/tmp\|ExecStart=/dev/shm' /etc/systemd/system/ 2>/dev/null
ls -la /etc/systemd/system/multi-user.target.wants/
```

Ukloni unit fajl **i** symlink kojim je omogućen. Na pravom sistemu bi prvo pokrenuo `systemctl disable --now ime.service`.

Na kraju obriši cijeli `/var/tmp/.sys`, kad su svi mehanizmi koji ga pokreću uklonjeni. Ponovo provjeri izvještaj: mora imati svih pet tehnika.

```bash
cat /root/nalazi.txt
```

<!-- verify
ls /etc/systemd/system/dbus-helper.service /etc/systemd/system/multi-user.target.wants/dbus-helper.service >/dev/null 2>&1 && { echo "Unit fajl ili symlink i dalje postoji"; exit 1; }
[ -L /etc/systemd/system/multi-user.target.wants/dbus-helper.service ] && { echo "Ostao je pokvaren symlink"; exit 1; }
[ -e /var/tmp/.sys ] && { echo "/var/tmp/.sys i dalje postoji"; exit 1; }
for t in T1053.003 T1098.004 T1136.001 T1546.004 T1543.002; do grep -q $t /root/nalazi.txt || { echo "Izvještaju nedostaje $t"; exit 1; }; done
exit 0
-->
<!-- solution
rm -f /etc/systemd/system/multi-user.target.wants/dbus-helper.service /etc/systemd/system/dbus-helper.service
rm -rf /var/tmp/.sys
echo "T1543.002 /etc/systemd/system/dbus-helper.service" >> /root/nalazi.txt
-->
