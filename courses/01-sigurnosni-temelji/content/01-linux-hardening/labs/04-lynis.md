# Lab 4: Lynis audit prije i poslije

Ovako izgleda stvarni radni tok: skeniraj, popravi najvažnije, skeniraj ponovo i dokumentuj razliku. Lynis daje *hardening index* od 0 do 100 i listu preporuka.

Jedno skeniranje traje oko minut.

<!-- setup
set -e
sed -i 's/^UMASK.*/UMASK\t\t022/' /etc/login.defs
sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS\t99999/' /etc/login.defs
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Lynis audit ===
Izvještaj: /var/log/lynis-report.dat
EOF
-->

## Prvo skeniranje

```bash
lynis audit system --quick --no-colors > /root/lynis-prije.txt 2>&1
grep hardening_index /var/log/lynis-report.dat
cp /var/log/lynis-report.dat /root/prije.dat
```

Pogledaj preporuke:

```bash
grep '^suggestion' /root/prije.dat | head -30
```

Svaka preporuka ima ID testa (npr. `AUTH-9328`). Detalje dobiješ sa `lynis show details AUTH-9328`.

<!-- verify
[ -s /root/prije.dat ] || { echo "/root/prije.dat ne postoji"; exit 1; }
grep -q '^hardening_index=' /root/prije.dat || { echo "U izvještaju nema hardening_index"; exit 1; }
-->
<!-- solution
lynis audit system --quick --no-colors > /root/lynis-prije.txt 2>&1; cp /var/log/lynis-report.dat /root/prije.dat
-->

## Popravi postavke naloga

U `/etc/login.defs` popravi dvije postavke koje Lynis i CIS ističu:

- `UMASK 027`: novi fajlovi neće biti čitljivi ostalim korisnicima.
- `PASS_MAX_DAYS 365`: lozinke lokalnih naloga ne žive vječno. NIST danas ne preporučuje česte prisilne promjene, ali beskonačan rok i dalje nije dobra praksa.

```bash
nano /etc/login.defs
grep -E '^(UMASK|PASS_MAX_DAYS)' /etc/login.defs
```

<!-- verify
grep -Eq '^UMASK[[:space:]]+027$' /etc/login.defs || { echo "UMASK: $(grep -E '^UMASK' /etc/login.defs)"; exit 1; }
d=$(awk '/^PASS_MAX_DAYS/{print $2}' /etc/login.defs)
[ -n "$d" ] && [ "$d" -le 365 ] || { echo "PASS_MAX_DAYS: $d"; exit 1; }
-->
<!-- hint
Linije već postoje u fajlu. Promijeni vrijednosti, ne dodaj nove linije.
-->
<!-- solution
sed -i 's/^UMASK.*/UMASK\t\t027/; s/^PASS_MAX_DAYS.*/PASS_MAX_DAYS\t365/' /etc/login.defs
-->

## Drugo skeniranje i poređenje

```bash
lynis audit system --quick --no-colors > /root/lynis-poslije.txt 2>&1
echo "Prije:   $(grep hardening_index /root/prije.dat)"
echo "Poslije: $(grep hardening_index /var/log/lynis-report.dat)"
diff <(grep '^suggestion' /root/prije.dat) <(grep '^suggestion' /var/log/lynis-report.dat)
```

Linije sa `<` su preporuke koje su nestale zahvaljujući tvojim popravkama.

> U kontejneru je index niži nego na pravom serveru, jer nema kernela, bootloadera ni servisa koje Lynis očekuje. Bitan je trend, ne apsolutni broj.

<!-- verify
[ /var/log/lynis-report.dat -nt /root/prije.dat ] || { echo "Drugo skeniranje još nije urađeno"; exit 1; }
grep -q '^hardening_index=' /var/log/lynis-report.dat || exit 1
-->
<!-- solution
sleep 1; lynis audit system --quick --no-colors > /root/lynis-poslije.txt 2>&1
-->
