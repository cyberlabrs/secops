# Lab 2: Email zaštita sa SPF, DKIM i DMARC

Firma `primjer-firma.ba` dobija prijave da neko šalje lažne fakture u njeno ime (**BEC**). Pregledaćeš zaglavlja primljenih poruka, a zatim popraviti DNS zapise domena tako da lažne poruke budu odbijene.

Domen šalje poštu preko Microsoft 365 i jednog vlastitog servera `203.0.113.25`. Fajlovi su u `/root/email/`.

| Mehanizam | Šta provjerava | Gdje živi |
|---|---|---|
| **SPF** | da li je IP adresa pošiljaoca ovlaštena za domen (envelope from) | TXT na domenu |
| **DKIM** | kriptografski potpis zaglavlja i tijela poruke | TXT na `selektor._domainkey.domen` |
| **DMARC** | da li SPF ili DKIM prolazi **i** poklapa se sa vidljivim From domenom; šta raditi ako ne | TXT na `_dmarc.domen` |
| **BIMI** | logo brenda uz poruke koje prolaze DMARC sa politikom quarantine/reject | TXT na `default._bimi.domen` |

<!-- setup
set -e
mkdir -p /root/email/poruke && cd /root/email
cat > zona.txt <<'EOF'
; DNS zapisi za primjer-firma.ba (izvod)
primjer-firma.ba.            3600 IN TXT "v=spf1 +all"
_dmarc.primjer-firma.ba.     3600 IN TXT "v=DMARC1; p=none"
EOF
cat > poruke/1.eml <<'EOF'
Authentication-Results: mx.partner.ba;
 spf=pass smtp.mailfrom=primjer-firma.ba;
 dkim=pass header.d=primjer-firma.ba header.s=selector1;
 dmarc=pass header.from=primjer-firma.ba
From: Računovodstvo <racuni@primjer-firma.ba>
Subject: Faktura 2026-311
EOF
cat > poruke/2.eml <<'EOF'
Authentication-Results: mx.partner.ba;
 spf=pass smtp.mailfrom=primjer-firrna.ba;
 dkim=pass header.d=primjer-firrna.ba header.s=s1;
 dmarc=pass header.from=primjer-firrna.ba
From: Direktor <direktor@primjer-firrna.ba>
Subject: HITNO: promjena računa za uplatu
EOF
cat > poruke/3.eml <<'EOF'
Authentication-Results: mx.partner.ba;
 spf=pass smtp.mailfrom=bulk-sender.example;
 dkim=none;
 dmarc=fail (p=none) header.from=primjer-firma.ba
From: Računovodstvo <racuni@primjer-firma.ba>
Subject: Nova faktura, platiti danas
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: SPF, DKIM, DMARC ===
Fajlovi: /root/email/zona.txt i /root/email/poruke/
EOF
-->

## Pročitaj zaglavlja

```bash
cd /root/email/poruke
for f in *.eml; do echo "== $f"; cat $f; echo; done
```

Za svaku poruku pogledaj tri rezultata (`spf=`, `dkim=`, `dmarc=`) i domen u `From:` zaglavlju.

- Poruka 3 je **spoofing** stvarnog domena: SPF prolazi, ali za tuđi domen (`bulk-sender.example`), pa nema **poravnanja** (*alignment*) sa From domenom. DMARC zato pada, ali politika `p=none` kaže primaocu da je ipak isporuči.
- Poruka 2 prolazi **sve** provjere. Pogledaj pažljivo domen: `primjer-firrna.ba` (`rn` umjesto `m`). Ovo je **typosquatting**: napadač je registrovao sličan domen i ispravno ga podesio. SPF, DKIM i DMARC tu ne pomažu; pomažu obuka korisnika (cilj 5.6), označavanje vanjskih poruka i nadzor sličnih domena.

U `/root/email/odgovor.txt` upiši brojeve **obje** zlonamjerne poruke, svaki u svoj red.

<!-- verify
f=/root/email/odgovor.txt
got=$(grep -oE '[0-9]+' $f 2>/dev/null | sort -u | xargs)
[ "$got" = "2 3" ] || { echo "Dobijeno: $got"; exit 1; }
-->
<!-- solution
printf '2\n3\n' > /root/email/odgovor.txt
-->

## Popravi SPF

Trenutni zapis `v=spf1 +all` znači „**svako** smije slati poštu u naše ime“, a to je gore nego da SPF zapis uopšte ne postoji. U `zona.txt` zamijeni ga zapisom koji dozvoljava samo:

- Microsoft 365: `include:spf.protection.outlook.com`
- vlastiti server: `ip4:203.0.113.25`

i završava se sa `-all` (**hard fail**: sve ostalo odbij). `~all` je *soft fail*, a koristi se samo u prelaznom periodu.

```bash
nano /root/email/zona.txt
grep spf1 /root/email/zona.txt
```

<!-- verify
spf=$(grep -o '"v=spf1[^"]*"' /root/email/zona.txt | tr -d '"')
[ -n "$spf" ] || { echo "Nema SPF zapisa"; exit 1; }
echo "$spf" | grep -q '+all' && { echo "SPF i dalje sadrži +all"; exit 1; }
echo "$spf" | grep -q 'include:spf.protection.outlook.com' || { echo "Nedostaje include za Microsoft 365"; exit 1; }
echo "$spf" | grep -q 'ip4:203.0.113.25' || { echo "Nedostaje ip4:203.0.113.25"; exit 1; }
echo "$spf" | grep -qE ' -all$' || { echo "SPF se ne završava sa -all"; exit 1; }
[ $(grep -c 'v=spf1' /root/email/zona.txt) -eq 1 ] || { echo "Domen smije imati samo JEDAN SPF zapis"; exit 1; }
-->
<!-- solution
sed -i 's|"v=spf1 +all"|"v=spf1 ip4:203.0.113.25 include:spf.protection.outlook.com -all"|' /root/email/zona.txt
-->

## Objavi DKIM ključ

Generiši RSA par ključeva od 2048 bita za DKIM selektor `s2026`. Privatni ključ ostaje na mail serveru, a javni se objavljuje u DNS-u.

```bash
cd /root/email
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out dkim-s2026.key
chmod 600 dkim-s2026.key
P=$(openssl pkey -in dkim-s2026.key -pubout | grep -v '^-----' | tr -d '\n')
echo "s2026._domainkey.primjer-firma.ba. 3600 IN TXT \"v=DKIM1; k=rsa; p=$P\"" >> zona.txt
tail -1 zona.txt | cut -c1-120
```

Primalac iz zaglavlja `DKIM-Signature` pročita domen (`d=`) i selektor (`s=`), preuzme javni ključ iz DNS-a i provjeri potpis.

<!-- verify
cd /root/email
[ -f dkim-s2026.key ] || { echo "Nema dkim-s2026.key"; exit 1; }
rec=$(grep '^s2026._domainkey.primjer-firma.ba' zona.txt | grep -o 'p=[A-Za-z0-9+/=]*' | cut -c3-)
[ -n "$rec" ] || { echo "Nema DKIM zapisa za selektor s2026"; exit 1; }
want=$(openssl pkey -in dkim-s2026.key -pubout | grep -v '^-----' | tr -d '\n')
[ "$rec" = "$want" ] || { echo "Javni ključ u DNS zapisu ne odgovara privatnom ključu"; exit 1; }
openssl pkey -in dkim-s2026.key -noout -text 2>/dev/null | grep -q '2048 bit' || { echo "Ključ nije 2048 bita"; exit 1; }
-->
<!-- solution
cd /root/email
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out dkim-s2026.key 2>/dev/null && chmod 600 dkim-s2026.key
P=$(openssl pkey -in dkim-s2026.key -pubout | grep -v '^-----' | tr -d '\n')
echo "s2026._domainkey.primjer-firma.ba. 3600 IN TXT \"v=DKIM1; k=rsa; p=$P\"" >> zona.txt
-->

## DMARC: od praćenja do odbijanja

`p=none` samo prati i ništa ne blokira. Zato je poruka 3 isporučena. Promijeni DMARC zapis tako da:

- politika bude `p=reject`,
- agregirani izvještaji idu na `rua=mailto:dmarc@primjer-firma.ba`.

U praksi se ide postepeno: `none` (skupljaj izvještaje i pronađi sve legitimne pošiljaoce), pa `quarantine` (spam folder), pa `reject`. Tek uz `quarantine` ili `reject` može se uvesti i **BIMI**.

<!-- verify
d=$(grep '^_dmarc.primjer-firma.ba' /root/email/zona.txt | grep -o '"v=DMARC1[^"]*"')
[ -n "$d" ] || { echo "Nema DMARC zapisa"; exit 1; }
echo "$d" | grep -qE 'p=reject' || { echo "Politika nije p=reject"; exit 1; }
echo "$d" | grep -q 'rua=mailto:dmarc@primjer-firma.ba' || { echo "Nedostaje rua=mailto:dmarc@primjer-firma.ba"; exit 1; }
-->
<!-- solution
sed -i 's|"v=DMARC1; p=none"|"v=DMARC1; p=reject; rua=mailto:dmarc@primjer-firma.ba"|' /root/email/zona.txt
-->
