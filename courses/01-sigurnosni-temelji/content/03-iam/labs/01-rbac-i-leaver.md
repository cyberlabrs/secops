# Lab 1: Uloge, grupe i odlazak zaposlenog

Mali tim dijeli server. Trenutno svi mogu sve, a bivši kolega Petar i dalje ima pristup. Uvešćeš jednostavan RBAC pomoću Linux grupa i odraditi **Leaver** proces kako treba.

| Osoba | Uloga | Treba |
|---|---|---|
| ana | developer | čitanje i pisanje u `/srv/projekt` |
| marko | revizor | samo čitanje `/srv/logovi`, bez pristupa projektu |
| petar | napustio firmu | ništa |

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

## Napravi uloge kao grupe

Napravi grupe `devs` i `auditors`, dodaj `ana` u `devs` i `marko` u `auditors`.

```bash
groupadd devs
groupadd auditors
usermod -aG devs ana
usermod -aG auditors marko
id ana; id marko
```

U RBAC terminologiji grupa je **uloga**: prava dodjeljuješ grupi, a ljude dodaješ u grupu. Kad neko promijeni posao, mijenjaš članstvo, a ne dozvole na desetinama mjesta.

<!-- verify
id -nG ana | tr ' ' '\n' | grep -qx devs || { echo "ana nije u grupi devs"; exit 1; }
id -nG marko | tr ' ' '\n' | grep -qx auditors || { echo "marko nije u grupi auditors"; exit 1; }
id -nG marko | tr ' ' '\n' | grep -qx devs && { echo "marko ne treba biti u devs"; exit 1; }
exit 0
-->
<!-- solution
groupadd devs; groupadd auditors; usermod -aG devs ana; usermod -aG auditors marko
-->

## Zaključaj projekat za developere

`/srv/projekt` treba pripadati grupi `devs`. Članovi grupe čitaju i pišu, ostali nemaju pristup. Postavi i **setgid** bit na direktorij (`2770`), tako da novi fajlovi automatski pripadaju grupi `devs`.

```bash
chown -R root:devs /srv/projekt
chmod 2770 /srv/projekt
chmod 660 /srv/projekt/app.py
ls -ld /srv/projekt; ls -l /srv/projekt
su - ana -c 'echo test > /srv/projekt/ana.txt && ls -l /srv/projekt/ana.txt'
su - marko -c 'ls /srv/projekt'
```

Ana treba uspjeti, a Marko treba dobiti `Permission denied`.

<!-- verify
su - ana -c 'touch /srv/projekt/.provjera-ana' 2>/dev/null || { echo "ana ne može pisati u /srv/projekt"; exit 1; }
[ "$(stat -c %G /srv/projekt/.provjera-ana)" = devs ] || { echo "Novi fajlovi ne pripadaju grupi devs (setgid bit?)"; rm -f /srv/projekt/.provjera-ana; exit 1; }
rm -f /srv/projekt/.provjera-ana
su - marko -c 'ls /srv/projekt' >/dev/null 2>&1 && { echo "marko i dalje vidi sadržaj projekta"; exit 1; }
su - marko -c 'cat /srv/projekt/app.py' >/dev/null 2>&1 && { echo "marko i dalje može čitati app.py"; exit 1; }
exit 0
-->
<!-- hint
Setgid bit na direktoriju je ono `2` u `2770`. Bez njega novi fajl dobija primarnu grupu korisnika koji ga je napravio (`ana`), pa ga ostali developeri ne bi mogli mijenjati.
-->
<!-- solution
chown -R root:devs /srv/projekt && chmod 2770 /srv/projekt && chmod 660 /srv/projekt/app.py
-->

## Samo čitanje za revizore

`/srv/logovi` treba pripadati grupi `auditors`. Revizori čitaju, ali ne mijenjaju, a ostali nemaju pristup. Fajlove upisuje root.

```bash
chown -R root:auditors /srv/logovi
chmod 750 /srv/logovi
chmod 640 /srv/logovi/app.log
su - marko -c 'cat /srv/logovi/app.log'
su - marko -c 'echo lazni > /srv/logovi/app.log'
su - ana -c 'cat /srv/logovi/app.log'
```

<!-- verify
su - marko -c 'cat /srv/logovi/app.log' >/dev/null 2>&1 || { echo "marko ne može čitati log"; exit 1; }
su - marko -c 'echo x >> /srv/logovi/app.log' 2>/dev/null && { echo "marko može mijenjati log, a ne bi smio"; exit 1; }
su - marko -c 'touch /srv/logovi/novi' 2>/dev/null && { echo "marko može praviti fajlove u /srv/logovi"; exit 1; }
su - ana -c 'cat /srv/logovi/app.log' >/dev/null 2>&1 && { echo "ana može čitati logove, a ne treba"; exit 1; }
exit 0
-->
<!-- solution
chown -R root:auditors /srv/logovi && chmod 750 /srv/logovi && chmod 640 /srv/logovi/app.log
-->

## Leaver: Petar je napustio firmu

Zaključavanje lozinke **nije dovoljno**: Petar ima SSH ključ i cron posao koji se i dalje izvršava. Uradi sve četiri stvari:

1. Zaključaj nalog i postavi da je istekao.
2. Postavi shell na `/usr/sbin/nologin`.
3. Ukloni njegove SSH ključeve.
4. Ukloni njegov crontab (prvo ga pogledaj, to je dokaz šta je radio).

```bash
crontab -l -u petar
usermod -L -e 1 -s /usr/sbin/nologin petar
rm /home/petar/.ssh/authorized_keys
crontab -r -u petar
passwd -S petar
```

Nalog se **ne briše odmah**: UID i fajlovi ostaju zbog audita i prenosa vlasništva. Brisanje dolazi kasnije, po politici firme.

<!-- verify
passwd -S petar | awk '{print $2}' | grep -qx L || { echo "Nalog nije zaključan (passwd -S petar)"; exit 1; }
[ "$(getent passwd petar | cut -d: -f7)" = /usr/sbin/nologin ] || { echo "Shell nije /usr/sbin/nologin"; exit 1; }
[ -s /home/petar/.ssh/authorized_keys ] && { echo "SSH ključ i dalje postoji"; exit 1; }
crontab -l -u petar >/dev/null 2>&1 && { echo "Crontab i dalje postoji"; exit 1; }
exp=$(chage -l petar | grep 'Account expires' | cut -d: -f2 | xargs)
[ "$exp" != never ] || { echo "Nalog nema datum isteka (usermod -e 1)"; exit 1; }
exit 0
-->
<!-- solution
usermod -L -e 1 -s /usr/sbin/nologin petar; rm -f /home/petar/.ssh/authorized_keys; crontab -r -u petar
-->
