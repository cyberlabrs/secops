# Lab 1: Firewall pravila sa nftables

Server `192.168.1.10` ima pet servisa, a trenutno nema nikakav firewall. Napisaćeš **rule-based** host firewall po principu **default deny**: sve je zabranjeno, a dozvoljeno je samo ono što je eksplicitno potrebno.

| Port | Servis | Ko smije pristupiti |
|---|---|---|
| 80, 443 | web | svi |
| 22 | SSH | samo management mreža `10.0.0.0/24` |
| 3306 | baza | samo aplikacijski serveri `192.168.1.0/24` |
| 8080 | stari admin panel | niko (treba ga ugasiti, a do tada blokirati) |

Klijenti su simulirani adresama na ovom istom serveru: `10.0.0.5` (admin), `172.16.0.9` (korisnička mreža) i `192.168.1.20` (aplikacijski server). Skripta `testfw` pokazuje ko do čega može doći.

> U ovom labu sav testni saobraćaj ide preko loopback interfejsa, zato **ne** dodaji uobičajeno pravilo `iif lo accept`, jer bi propustilo sve. Na pravom serveru to pravilo ide na vrh.

<!-- setup
set -e
for a in 192.168.1.10 10.0.0.5 172.16.0.9 192.168.1.20; do ip addr add $a/32 dev lo 2>/dev/null || true; done
for p in 22 80 443 3306 8080; do nohup ncat -lk 192.168.1.10 $p >/dev/null 2>&1 & done
sleep 0.5
cat > /usr/local/bin/testfw <<'EOF'
#!/bin/bash
# matrica dostupnosti: izvor x port
printf '%-14s' "izvor"; for p in 22 80 443 3306 8080; do printf '%-7s' $p; done; echo
for s in 10.0.0.5 172.16.0.9 192.168.1.20; do
  printf '%-14s' $s
  for p in 22 80 443 3306 8080; do
    if timeout 1 ncat -z -s $s 192.168.1.10 $p 2>/dev/null; then printf '%-7s' OK; else printf '%-7s' BLOK; fi
  done; echo
done
EOF
chmod 755 /usr/local/bin/testfw
nft flush ruleset
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Firewall sa nftables ===
Testiraj dostupnost: testfw     Pravila: nft list ruleset
EOF
-->

## Polazno stanje

```bash
ss -tlnp
nft list ruleset
testfw
```

Bez firewalla svi izvori dolaze do svih portova, uključujući bazu i admin panel. Na ispitu se ovo zove preširoka **attack surface**.

## Default deny

Napravi tabelu i `input` lanac sa politikom **drop**. Odmah dozvoli odgovore na već uspostavljene konekcije (**stateful** firewall), jer bi bez toga server prekidao vlastite konekcije.

```bash
nft add table inet filter
nft add chain inet filter input '{ type filter hook input priority 0; policy drop; }'
nft add rule inet filter input ct state established,related accept
nft add rule inet filter input ip saddr 127.0.0.1 accept
nft list ruleset
testfw
```

Sada je sve BLOK. To je ispravno: od ovog trenutka svaku dozvolu dodaješ svjesno.

<!-- verify
nft list chain inet filter input 2>/dev/null | grep -q 'policy drop' || { echo "Lanac inet filter input nema policy drop"; exit 1; }
nft list chain inet filter input | grep -q 'established' || { echo "Nedostaje pravilo za established,related"; exit 1; }
timeout 1 ncat -z -s 172.16.0.9 192.168.1.10 8080 2>/dev/null && { echo "Port 8080 je i dalje dostupan"; exit 1; }
exit 0
-->
<!-- solution
nft add table inet filter
nft add chain inet filter input '{ type filter hook input priority 0; policy drop; }'
nft add rule inet filter input ct state established,related accept
nft add rule inet filter input ip saddr 127.0.0.1 accept
-->

## Web za sve

Dozvoli TCP portove 80 i 443 sa bilo koje adrese. Jedno pravilo može pokriti oba porta pomoću skupa `{ 80, 443 }`.

```bash
nft add rule inet filter input tcp dport '{ 80, 443 }' accept
testfw
```

<!-- verify
for s in 10.0.0.5 172.16.0.9 192.168.1.20; do for p in 80 443; do
  timeout 1 ncat -z -s $s 192.168.1.10 $p 2>/dev/null || { echo "$s ne dolazi do porta $p"; exit 1; }
done; done
-->
<!-- solution
nft add rule inet filter input tcp dport '{ 80, 443 }' accept
-->

## SSH samo iz management mreže, uz rate limit

Dozvoli port 22 samo iz `10.0.0.0/24`. Dodaj i **rate limiting** novih SSH konekcija (npr. 10 u minuti), što usporava brute force napade.

```bash
nft add rule inet filter input ip saddr 10.0.0.0/24 tcp dport 22 ct state new limit rate 10/minute accept
testfw
```

<!-- verify
timeout 1 ncat -z -s 10.0.0.5 192.168.1.10 22 2>/dev/null || { echo "10.0.0.5 (management) ne dolazi do SSH-a"; exit 1; }
for s in 172.16.0.9 192.168.1.20; do timeout 1 ncat -z -s $s 192.168.1.10 22 2>/dev/null && { echo "$s dolazi do SSH-a, a ne bi smio"; exit 1; }; done
nft list chain inet filter input | grep 'dport 22' | grep -q 'limit rate' || { echo "SSH pravilo nema rate limit"; exit 1; }
exit 0
-->
<!-- solution
nft add rule inet filter input ip saddr 10.0.0.0/24 tcp dport 22 ct state new limit rate 10/minute accept
-->

## Baza samo za aplikacijske servere

Dozvoli port 3306 samo iz `192.168.1.0/24`. Admin panel na 8080 ne dobija nikakvo pravilo, pa ga politika `drop` blokira za sve.

Na kraju pokreni `testfw` i uporedi rezultat sa tabelom sa početka laba.

<!-- verify
timeout 1 ncat -z -s 192.168.1.20 192.168.1.10 3306 2>/dev/null || { echo "Aplikacijski server ne dolazi do baze"; exit 1; }
for s in 10.0.0.5 172.16.0.9; do timeout 1 ncat -z -s $s 192.168.1.10 3306 2>/dev/null && { echo "$s dolazi do baze, a ne bi smio"; exit 1; }; done
for s in 10.0.0.5 172.16.0.9 192.168.1.20; do timeout 1 ncat -z -s $s 192.168.1.10 8080 2>/dev/null && { echo "$s dolazi do porta 8080"; exit 1; }; done
exit 0
-->
<!-- hint
`nft add rule inet filter input ip saddr 192.168.1.0/24 tcp dport 3306 accept`
-->
<!-- solution
nft add rule inet filter input ip saddr 192.168.1.0/24 tcp dport 3306 accept
-->

## Sačuvaj konfiguraciju

Pravila dodata komandom `nft` nestaju nakon restarta. Sačuvaj ih u `/etc/nftables.conf`, koji servis `nftables` učitava pri pokretanju:

```bash
echo '#!/usr/sbin/nft -f' > /etc/nftables.conf
echo 'flush ruleset' >> /etc/nftables.conf
nft list ruleset >> /etc/nftables.conf
nft -c -f /etc/nftables.conf && echo "Sintaksa OK"
cat /etc/nftables.conf
```

U praksi ovaj fajl ide u git i distribuira se Ansibleom, a promjena prolazi kroz **change management** (cilj 1.2): odobrenje, test i backout plan. Backout plan je ovdje bukvalno `nft flush ruleset`.

<!-- verify
f=/etc/nftables.conf
nft -c -f $f 2>/dev/null || { echo "$f ne postoji ili ima grešku u sintaksi"; exit 1; }
grep -q 'policy drop' $f || { echo "$f nema policy drop"; exit 1; }
grep -q '3306' $f && grep -q 'dport 22' $f || { echo "$f ne sadrži sva pravila"; exit 1; }
-->
<!-- solution
printf '#!/usr/sbin/nft -f\nflush ruleset\n' > /etc/nftables.conf && nft list ruleset >> /etc/nftables.conf
-->
