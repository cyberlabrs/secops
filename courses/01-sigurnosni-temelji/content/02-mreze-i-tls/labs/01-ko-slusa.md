# Lab 1: Ko sluša na ovom serveru?

Preuzimaš server o kojem ne znaš ništa. Prvi korak svakog sigurnosnog pregleda je inventar: koji portovi su otvoreni, koji proces stoji iza njih i da li uopšte treba da budu dostupni.

Mreža kontejnera je izolovana, pa skeniramo samo `127.0.0.1`, odnosno vlastiti server.

<!-- setup
set -e
mkdir -p /srv/admin /etc/app /tmp/.cache
echo '<h1>Interni admin panel</h1>' > /srv/admin/index.html
cat > /etc/app/db.env <<'EOF'
# adresa na kojoj "baza" sluša
BIND=0.0.0.0
PORT=5432
EOF
cat > /usr/local/bin/start-db <<'EOF'
#!/bin/bash
. /etc/app/db.env
[ -f /run/db.pid ] && kill "$(cat /run/db.pid)" 2>/dev/null && sleep 0.3
nohup ncat -lk "$BIND" "$PORT" >/dev/null 2>&1 &
echo $! > /run/db.pid
echo "baza pokrenuta na $BIND:$PORT"
EOF
chmod 755 /usr/local/bin/start-db
/usr/local/bin/start-db >/dev/null
(cd /srv/admin && nohup python3 -m http.server 8080 --bind 127.0.0.1 >/dev/null 2>&1 &)
cp /usr/bin/ncat /tmp/.cache/kworkerd
(cd /tmp && nohup /tmp/.cache/kworkerd -lk 0.0.0.0 4444 >/dev/null 2>&1 &)
sleep 1
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Ko sluša na ovom serveru? ===
Alati: ss, nmap, ps, ls -l /proc/PID/exe
EOF
-->

## Inventar portova

Pogledaj šta sluša i koji proces stoji iza svakog porta:

```bash
ss -tulpn
```

Zatim isto pogledaj spolja, kako bi to vidio napadač, pomoću nmap connect skeniranja svih portova:

```bash
nmap -sT -p- 127.0.0.1
nmap -sT -sV -p 4444,5432,8080 127.0.0.1
```

Za svaki port zapiši: proces, adresu (`0.0.0.0` ili `127.0.0.1`) i da li ti izgleda legitimno.

## Identifikuj sumnjiv proces

Jedan proces se predstavlja kao kernel thread (`kworker`), ali kernel threadovi ne slušaju na TCP portovima i nemaju binarni fajl na disku. Pronađi **punu putanju** do njegovog izvršnog fajla i upiši je u `/root/odgovor.txt`.

```bash
ss -tlnp | grep 4444
ls -l /proc/PID/exe        # zamijeni PID brojem iz ss izlaza
```

<!-- verify
grep -q '/tmp/.cache/kworkerd' /root/odgovor.txt 2>/dev/null || { echo "U /root/odgovor.txt nema tačne putanje"; exit 1; }
-->
<!-- hint
`ss -tlnp` u koloni `users:` daje `pid=`. Zatim `readlink /proc/<pid>/exe > /root/odgovor.txt`. Skriveni direktorij u `/tmp` i ime koje imitira sistemski proces su klasični znakovi zlonamjernog softvera.
-->
<!-- solution
readlink /proc/$(pgrep -x kworkerd | head -1)/exe > /root/odgovor.txt
-->

## Ukloni ga

U pravom incidentu bi **prvo** sačuvao dokaze (kopiju binarnog fajla, `/proc/PID/` informacije, mrežne konekcije), pa tek onda čistio. Uradi to ukratko:

```bash
mkdir -p /root/dokazi
cp /tmp/.cache/kworkerd /root/dokazi/
sha256sum /root/dokazi/kworkerd > /root/dokazi/hash.txt
```

Zatim zaustavi proces i obriši fajl iz `/tmp/.cache`.

<!-- verify
ss -tln | grep -q ':4444 ' && { echo "Port 4444 i dalje sluša"; exit 1; }
[ -e /tmp/.cache/kworkerd ] && { echo "/tmp/.cache/kworkerd i dalje postoji"; exit 1; }
[ -s /root/dokazi/hash.txt ] || { echo "Nisi sačuvao hash dokaza u /root/dokazi/hash.txt"; exit 1; }
exit 0
-->
<!-- hint
`kill <PID>` (ili `pkill -x kworkerd`), pa `rm /tmp/.cache/kworkerd`.
-->
<!-- solution
mkdir -p /root/dokazi && cp /tmp/.cache/kworkerd /root/dokazi/ && sha256sum /root/dokazi/kworkerd > /root/dokazi/hash.txt
pkill -x kworkerd; sleep 0.5; rm -f /tmp/.cache/kworkerd
-->

## Zatvori bazu na localhost

„Baza“ na portu 5432 sluša na svim interfejsima, a koriste je samo aplikacije na ovom serveru. Promijeni `BIND` u `/etc/app/db.env` na `127.0.0.1` i ponovo pokreni servis:

```bash
nano /etc/app/db.env
start-db
ss -tlnp | grep 5432
```

Admin panel na 8080 već ispravno sluša samo na `127.0.0.1`. Uporedi ga sa bazom.

<!-- verify
ss -tln | grep -q '127.0.0.1:5432 ' || { echo "Ništa ne sluša na 127.0.0.1:5432"; exit 1; }
ss -tln | grep -Eq '(0\.0\.0\.0|\*):5432 ' && { echo "Baza i dalje sluša na svim interfejsima"; exit 1; }
exit 0
-->
<!-- solution
sed -i 's/^BIND=.*/BIND=127.0.0.1/' /etc/app/db.env && start-db && sleep 1
-->
