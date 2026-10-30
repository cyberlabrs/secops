# Lab 1: Odgovor na incident i prikupljanje dokaza

EDR je javio sumnjiv proces na web serveru. Ti si dežurni. Uradićeš prve korake odgovora na incident tačno onim redom koji ispit traži: dokaze prikupljaš po **redoslijedu nestalnosti** (*order of volatility*), čuvaš njihov integritet hash-evima i lancem nadzora (*chain of custody*), tek onda **izoluješ** prijetnju i istražuješ disk.

Sve dokaze spremaj u `/root/dokazi/`.

| Redoslijed | Izvor | Zašto ovim redom |
|---|---|---|
| 1 | CPU registri, keš, **RAM** (procesi, ključevi u memoriji) | nestaje za sekunde ili gašenjem |
| 2 | mrežne konekcije, ARP, routing | mijenja se stalno |
| 3 | privremeni fajlovi, swap | prepisuje se |
| 4 | **disk** | trajno, ali se može izmijeniti |
| 5 | udaljeni logovi, backup | najtrajnije |

<!-- setup
set -e
mkdir -p /var/www/html/upload /tmp/.x /root/dokazi
echo '<h1>Prodavnica</h1>' > /var/www/html/index.html
touch -d '2026-09-01 10:00' /var/www/html/index.html
printf '<?php // web shell (lab artefakt, neaktivan)\nif(isset($_REQUEST["c"])){ /* izvrsavanje komandi */ }\n' > /var/www/html/upload/avatar.php
touch -d '2026-10-14 03:12' /var/www/html/upload/avatar.php
cat > /tmp/.x/kupdate <<'EOF'
#!/bin/bash
# simulacija C2 beacona: pokušava se javiti serveru napadača
while true; do timeout 1 bash -c 'exec 3<>/dev/tcp/203.0.113.66/4444' 2>/dev/null; sleep 5; done
EOF
chmod 755 /tmp/.x/kupdate
touch -d '2026-10-14 03:14' /tmp/.x/kupdate
(cd /tmp && nohup /tmp/.x/kupdate >/dev/null 2>&1 &)
dd if=/dev/urandom of=/srv/usb-disk.img bs=1M count=8 2>/dev/null
cat > /root/dokazi/lanac-nadzora.csv <<'EOF'
datum_vrijeme,preuzeo,dokaz,sha256,lokacija
EOF
sleep 1
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Incident i forenzika ===
Dokazi: /root/dokazi/   Lanac nadzora: /root/dokazi/lanac-nadzora.csv
EOF
-->

## Volatilno prvo: procesi

Snimi listu svih procesa sa punim komandnim linijama, **prije** bilo kakve promjene na sistemu. Gašenje servera ili ubijanje procesa uništilo bi upravo ono što ti treba.

```bash
ps auxww > /root/dokazi/procesi.txt
ps -eo pid,ppid,user,etime,cmd --forest | grep -v '\[' | head -30
```

Pronađi sumnjiv proces (pokrenut iz skrivenog direktorija u `/tmp`), pa sačuvaj podatke o njemu iz `/proc`:

```bash
PID=$(pgrep -f /tmp/.x/kupdate | head -1); echo $PID
cat /proc/$PID/cmdline | tr '\0' ' ' > /root/dokazi/proces-cmdline.txt
cp /proc/$PID/exe /root/dokazi/proces-exe.bin
ls -l /proc/$PID/cwd /proc/$PID/exe
```

Na pravom sistemu bi u ovom koraku napravio i **memory dump** (npr. AVML ili LiME na Linuxu), jer malver često postoji samo u memoriji (*fileless*).

<!-- verify
d=/root/dokazi
grep -q '/tmp/.x/kupdate' $d/procesi.txt 2>/dev/null || { echo "procesi.txt ne postoji ili ne sadrži sumnjiv proces"; exit 1; }
grep -q 'kupdate' $d/proces-cmdline.txt 2>/dev/null || { echo "Nema proces-cmdline.txt"; exit 1; }
[ -s $d/proces-exe.bin ] || { echo "Nema kopije izvršnog fajla (proces-exe.bin)"; exit 1; }
-->
<!-- solution
ps auxww > /root/dokazi/procesi.txt
PID=$(pgrep -x kupdate | head -1)
cat /proc/$PID/cmdline | tr '\0' ' ' > /root/dokazi/proces-cmdline.txt
cp /proc/$PID/exe /root/dokazi/proces-exe.bin
-->

## Mrežno stanje i C2 adresa

```bash
ss -tanp > /root/dokazi/mreza.txt
cat /tmp/.x/kupdate
```

Proces pokušava kontaktirati server napadača (**command and control**, C2). Upiši IP adresu C2 servera u `/root/dokazi/ioc.txt`. To je **indikator kompromitacije** (IoC) koji ćeš proslijediti SOC-u da ga potraže na ostalim serverima.

<!-- verify
[ -f /root/dokazi/mreza.txt ] || { echo "Nema mreza.txt"; exit 1; }
grep -q '203.0.113.66' /root/dokazi/ioc.txt 2>/dev/null || { echo "ioc.txt ne sadrži adresu C2 servera"; exit 1; }
-->
<!-- solution
ss -tanp > /root/dokazi/mreza.txt; echo 203.0.113.66 > /root/dokazi/ioc.txt
-->

## Integritet dokaza i lanac nadzora

Svaki dokaz dobija hash u trenutku prikupljanja. Tako kasnije možeš dokazati da ga niko nije mijenjao. Svaka primopredaja se upisuje u **chain of custody**.

```bash
cd /root/dokazi
sha256sum procesi.txt proces-cmdline.txt proces-exe.bin mreza.txt ioc.txt > SHA256SUMS
cat SHA256SUMS
H=$(sha256sum procesi.txt | cut -d' ' -f1)
echo "$(date -u +%FT%TZ),dežurni-analitičar,procesi.txt,$H,/root/dokazi" >> lanac-nadzora.csv
cat lanac-nadzora.csv
```

<!-- verify
cd /root/dokazi || exit 1
[ -s SHA256SUMS ] || { echo "Nema SHA256SUMS"; exit 1; }
sha256sum -c SHA256SUMS >/dev/null 2>&1 || { echo "sha256sum -c ne prolazi (dokaz izmijenjen nakon hash-a?)"; exit 1; }
for f in procesi.txt proces-exe.bin mreza.txt; do grep -q " $f$" SHA256SUMS || { echo "$f nije u SHA256SUMS"; exit 1; }; done
H=$(sha256sum procesi.txt | cut -d' ' -f1)
grep -q "$H" lanac-nadzora.csv || { echo "Lanac nadzora nema unos sa hash-om fajla procesi.txt"; exit 1; }
-->
<!-- solution
cd /root/dokazi
sha256sum procesi.txt proces-cmdline.txt proces-exe.bin mreza.txt ioc.txt > SHA256SUMS
H=$(sha256sum procesi.txt | cut -d' ' -f1)
echo "$(date -u +%FT%TZ),dezurni-analiticar,procesi.txt,$H,/root/dokazi" >> lanac-nadzora.csv
-->

## Containment: izoluj prijetnju

Tek sada, kad su volatilni dokazi sačuvani, ograniči štetu:

1. blokiraj izlazni saobraćaj prema C2 adresi (u cloudu bi to bila izolacija instance pomoću security grupe ili EDR „network isolation“),
2. zaustavi proces.

```bash
nft add table inet ir
nft add chain inet ir output '{ type filter hook output priority 0; policy accept; }'
nft add rule inet ir output ip daddr 203.0.113.66 drop
pkill -9 -f /tmp/.x/kupdate
nft list ruleset
```

Fajl iz `/tmp/.x` za sada **ne briši**. Brisanje je dio faze **eradication**, a fajl je još dokaz.

<!-- verify
pgrep -x kupdate >/dev/null && { echo "Proces i dalje radi"; exit 1; }
nft list ruleset 2>/dev/null | grep -q 'ip daddr 203.0.113.66 drop' || { echo "Nema pravila koje blokira 203.0.113.66"; exit 1; }
[ -e /tmp/.x/kupdate ] || { echo "Obrisao si dokaz prije vremena"; exit 1; }
exit 0
-->
<!-- solution
nft add table inet ir
nft add chain inet ir output '{ type filter hook output priority 0; policy accept; }'
nft add rule inet ir output ip daddr 203.0.113.66 drop
pkill -9 -x kupdate; sleep 0.5
-->

## Bit-level kopija diska

Na serveru je bio priključen USB disk (`/srv/usb-disk.img`). Napravi **bit-level** kopiju (`dd`), provjeri da su hash-evi originala i kopije isti, i postavi original na samo-čitanje. Ovo je softverski ekvivalent *write blockera*. Analiza se uvijek radi na kopiji.

```bash
sha256sum /srv/usb-disk.img
dd if=/srv/usb-disk.img of=/root/dokazi/usb-disk.dd bs=1M status=progress
sha256sum /root/dokazi/usb-disk.dd
chmod 444 /srv/usb-disk.img
```

<!-- verify
[ -f /root/dokazi/usb-disk.dd ] || { echo "Nema /root/dokazi/usb-disk.dd"; exit 1; }
[ "$(sha256sum < /srv/usb-disk.img)" = "$(sha256sum < /root/dokazi/usb-disk.dd)" ] || { echo "Hash kopije se razlikuje od originala"; exit 1; }
[ "$(stat -c %a /srv/usb-disk.img)" = 444 ] || { echo "Original nije postavljen na 444"; exit 1; }
-->
<!-- solution
dd if=/srv/usb-disk.img of=/root/dokazi/usb-disk.dd bs=1M 2>/dev/null && chmod 444 /srv/usb-disk.img
-->

## Vremenska linija: kako je napadač ušao?

Proces je nastao 14. oktobra oko 03:14. Pronađi fajlove na web serveru koji su izmijenjeni tog dana. Jedan od njih je vjerovatno ulazna tačka.

```bash
find /var/www /tmp -type f -newermt '2026-10-14 00:00' ! -newermt '2026-10-15 00:00' -exec ls -l --time-style=full-iso {} \;
```

Upiši punu putanju do **web shella** u `/root/dokazi/ulaz.txt`. Fajl sa PHP kodom u direktoriju za upload slika govori da aplikacija nije provjeravala tip fajla pri uploadu.

> Timestampove napadač može promijeniti (`touch`, *timestomping*). Zato se oslanjaš na više izvora: web server logove, EDR telemetriju i backup.

<!-- verify
grep -qx '/var/www/html/upload/avatar.php' /root/dokazi/ulaz.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/dokazi/ulaz.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo /var/www/html/upload/avatar.php > /root/dokazi/ulaz.txt
-->
