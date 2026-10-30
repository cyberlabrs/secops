# Lab 1: Integritet, enkripcija, potpis i envelope enkripcija

Četiri zadatka koja pokrivaju sve iz lekcije: otkrivanje izmijenjenog fajla, šifrovanje lozinkom, potpisivanje izdanja i envelope enkripcija kakvu radi KMS.

Radi u `/root/kripto`.

<!-- setup
set -e
mkdir -p /root/kripto/releases /var/lib/kms && cd /root/kripto/releases
for v in 1.0 1.1 1.2; do head -c 4096 /dev/urandom > app-$v.tar.gz; done
sha256sum app-*.tar.gz > SHA256SUMS
printf 'X' | dd of=app-1.1.tar.gz bs=1 seek=100 conv=notrunc 2>/dev/null
cd /root/kripto
printf 'DB_PASSWORD=Zima2026!\nAPI_KEY=sk_live_kurslab_0000\n' > tajna.txt
openssl rand -base64 24 > lozinka.txt
chmod 600 lozinka.txt
echo "Izvještaj o prihodima Q3 - POVJERLJIVO" > izvjestaj.txt
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /var/lib/kms/kek-private.pem 2>/dev/null
openssl pkey -in /var/lib/kms/kek-private.pem -pubout -out /root/kripto/kms-public.pem
chmod 600 /var/lib/kms/kek-private.pem
cp tajna.txt /var/lib/kms/.tajna.orig
cp izvjestaj.txt /var/lib/kms/.izvjestaj.orig
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Kriptografija u praksi ===
Radni direktorij: /root/kripto
EOF
-->

## Integritet: koji fajl je izmijenjen?

U `releases/` su tri izdanja aplikacije i `SHA256SUMS` sa hash-evima objavljenim u trenutku izdavanja. Jedan fajl je u međuvremenu izmijenjen. Pronađi ga i upiši njegovo ime u `/root/kripto/izmijenjen.txt`.

```bash
cd /root/kripto/releases
sha256sum -c SHA256SUMS
```

Pitanje za razmišljanje: ako napadač može izmijeniti fajl na serveru, može li izmijeniti i `SHA256SUMS`? Zato se `SHA256SUMS` **potpisuje** (vidi treći korak).

<!-- verify
grep -q 'app-1.1.tar.gz' /root/kripto/izmijenjen.txt 2>/dev/null || { echo "Netačno ili prazno"; exit 1; }
grep -qE 'app-1\.(0|2)' /root/kripto/izmijenjen.txt && { echo "Upiši samo izmijenjen fajl"; exit 1; }
exit 0
-->
<!-- solution
cd /root/kripto/releases && sha256sum -c SHA256SUMS 2>/dev/null | grep FAILED | cut -d: -f1 > /root/kripto/izmijenjen.txt
-->

## Šifruj fajl lozinkom

Šifruj `tajna.txt` u `tajna.txt.enc` pomoću AES-256 i lozinke iz `lozinka.txt`. Ključ se izvodi iz lozinke funkcijom PBKDF2 sa mnogo iteracija, a zatim **obriši** otvoreni tekst.

```bash
cd /root/kripto
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in tajna.txt -out tajna.txt.enc -pass file:lozinka.txt
xxd tajna.txt.enc | head -3
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in tajna.txt.enc -pass file:lozinka.txt
shred -u tajna.txt
```

Bez `-pbkdf2` openssl koristi stari, slabi način izvođenja ključa (jedna MD5 iteracija). `openssl enc` ne podržava GCM; za stvarnu upotrebu koristi `age`, `sops` ili KMS. Ovdje je cilj da vidiš princip.

<!-- verify
cd /root/kripto
[ -e tajna.txt ] && { echo "Otvoreni tekst tajna.txt i dalje postoji"; exit 1; }
[ -s tajna.txt.enc ] || { echo "tajna.txt.enc ne postoji"; exit 1; }
grep -q 'DB_PASSWORD' tajna.txt.enc && { echo "tajna.txt.enc nije šifrovan"; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in tajna.txt.enc -pass file:lozinka.txt 2>/dev/null | cmp -s - /var/lib/kms/.tajna.orig || { echo "Dešifrovanje sa -pbkdf2 -iter 600000 ne daje originalni sadržaj"; exit 1; }
-->
<!-- hint
Provjera dešifruje fajl sa tačno ovim parametrima: `-aes-256-cbc -pbkdf2 -iter 600000`. Ako si koristio drugačije, šifruj ponovo. Original je, za svaki slučaj, ostao kod „KMS-a“, pa ga možeš vratiti: `cp /var/lib/kms/.tajna.orig tajna.txt`.
-->
<!-- solution
cd /root/kripto && openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in tajna.txt -out tajna.txt.enc -pass file:lozinka.txt && shred -u tajna.txt
-->

## Potpiši SHA256SUMS sa Ed25519

Napravi par ključeva Ed25519 i potpiši `releases/SHA256SUMS`. Korisnici koji imaju tvoj javni ključ mogu provjeriti da hash-eve nije niko mijenjao.

```bash
cd /root/kripto
openssl genpkey -algorithm ed25519 -out potpis-private.pem
openssl pkey -in potpis-private.pem -pubout -out potpis-public.pem
chmod 600 potpis-private.pem
openssl pkeyutl -sign -inkey potpis-private.pem -rawin -in releases/SHA256SUMS -out releases/SHA256SUMS.sig
openssl pkeyutl -verify -pubin -inkey potpis-public.pem -rawin -in releases/SHA256SUMS -sigfile releases/SHA256SUMS.sig
```

Probaj izmijeniti jedan znak u `SHA256SUMS` i ponovo pokreni provjeru, pa vrati fajl. U stvarnom svijetu ovo radi `cosign sign-blob` ili GPG, a javni ključ se objavljuje odvojeno od fajlova.

<!-- verify
cd /root/kripto
[ -f potpis-public.pem ] && [ -f releases/SHA256SUMS.sig ] || { echo "Nedostaje javni ključ ili potpis"; exit 1; }
openssl pkey -pubin -in potpis-public.pem -noout -text 2>/dev/null | grep -qi 'ED25519' || { echo "Ključ nije Ed25519"; exit 1; }
openssl pkeyutl -verify -pubin -inkey potpis-public.pem -rawin -in releases/SHA256SUMS -sigfile releases/SHA256SUMS.sig >/dev/null 2>&1 || { echo "Potpis se ne slaže sa trenutnim SHA256SUMS"; exit 1; }
[ "$(stat -c %a potpis-private.pem)" = 600 ] || { echo "Privatni ključ treba dozvole 600"; exit 1; }
-->
<!-- solution
cd /root/kripto
openssl genpkey -algorithm ed25519 -out potpis-private.pem && openssl pkey -in potpis-private.pem -pubout -out potpis-public.pem && chmod 600 potpis-private.pem
openssl pkeyutl -sign -inkey potpis-private.pem -rawin -in releases/SHA256SUMS -out releases/SHA256SUMS.sig
-->

## Envelope enkripcija

Simuliraćeš ono što KMS radi za S3 ili EBS. „KMS“ ima master ključ (KEK), a ti imaš samo njegov javni dio u `kms-public.pem`. Privatni KEK je u `/var/lib/kms/`, kao da je u HSM-u, i ne diraš ga.

1. Generiši slučajan data key (DEK).
2. Šifruj `izvjestaj.txt` DEK-om.
3. Šifruj DEK javnim KEK-om (RSA-OAEP).
4. Obriši otvoreni DEK i otvoreni izvještaj. Ostaju samo `izvjestaj.txt.enc` i `dek.enc`.

```bash
cd /root/kripto
openssl rand -hex 32 > dek.txt
openssl enc -aes-256-cbc -pbkdf2 -in izvjestaj.txt -out izvjestaj.txt.enc -pass file:dek.txt
openssl pkeyutl -encrypt -pubin -inkey kms-public.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
  -in dek.txt -out dek.enc
shred -u dek.txt izvjestaj.txt
ls -l
```

Za dešifrovanje bi aplikacija poslala `dek.enc` KMS-u. KMS ga dešifruje samo ako IAM dozvoljava, i zabilježi poziv. Aplikacija zatim dešifruje podatke DEK-om. Rotacija KEK-a znači ponovo šifrovati samo male DEK-ove, a ne terabajte podataka.

<!-- verify
cd /root/kripto
for f in dek.txt izvjestaj.txt; do [ -e $f ] && { echo "$f i dalje postoji u otvorenom obliku"; exit 1; }; done
[ -s dek.enc ] && [ -s izvjestaj.txt.enc ] || { echo "Nedostaje dek.enc ili izvjestaj.txt.enc"; exit 1; }
openssl pkeyutl -decrypt -inkey /var/lib/kms/kek-private.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in dek.enc -out /tmp/dek.check 2>/dev/null || { echo "KMS ne može dešifrovati dek.enc (OAEP sa SHA-256?)"; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -in izvjestaj.txt.enc -pass file:/tmp/dek.check 2>/dev/null | cmp -s - /var/lib/kms/.izvjestaj.orig
r=$?; rm -f /tmp/dek.check
[ $r -eq 0 ] || { echo "Dešifrovani DEK ne otključava izvještaj"; exit 1; }
-->
<!-- solution
cd /root/kripto
openssl rand -hex 32 > dek.txt
openssl enc -aes-256-cbc -pbkdf2 -in izvjestaj.txt -out izvjestaj.txt.enc -pass file:dek.txt
openssl pkeyutl -encrypt -pubin -inkey kms-public.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in dek.txt -out dek.enc
shred -u dek.txt izvjestaj.txt
-->
