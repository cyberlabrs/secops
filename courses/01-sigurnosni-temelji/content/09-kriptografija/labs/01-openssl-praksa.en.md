# Lab 1: Integrity, encryption, signatures and envelope encryption

Four tasks that cover everything from the lesson: detecting a modified file, password-based encryption, signing a release, and envelope encryption the way KMS does it.

Work in `/root/kripto`. Some file names are Serbian; keep them exactly as given (`tajna` = secret, `lozinka` = password, `izvjestaj` = report, `potpis` = signature).

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

## Integrity: which file was modified?

`releases/` contains three application releases and `SHA256SUMS` with the hashes published at release time. One file has been modified since. Find it and write its name to `/root/kripto/izmijenjen.txt` ("izmijenjen" = modified).

```bash
cd /root/kripto/releases
sha256sum -c SHA256SUMS
```

Something to think about: if an attacker can modify a file on the server, can they also modify `SHA256SUMS`? That's why `SHA256SUMS` gets **signed** (see the third step).

<!-- verify
grep -q 'app-1.1.tar.gz' /root/kripto/izmijenjen.txt 2>/dev/null || { echo "Incorrect or empty"; exit 1; }
grep -qE 'app-1\.(0|2)' /root/kripto/izmijenjen.txt && { echo "Write only the modified file"; exit 1; }
exit 0
-->
<!-- solution
cd /root/kripto/releases && sha256sum -c SHA256SUMS 2>/dev/null | grep FAILED | cut -d: -f1 > /root/kripto/izmijenjen.txt
-->

## Encrypt a file with a password

Encrypt `tajna.txt` into `tajna.txt.enc` using AES-256 and the password from `lozinka.txt`. The key is derived from the password with PBKDF2 and many iterations; then **delete** the plaintext.

```bash
cd /root/kripto
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in tajna.txt -out tajna.txt.enc -pass file:lozinka.txt
xxd tajna.txt.enc | head -3
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in tajna.txt.enc -pass file:lozinka.txt
shred -u tajna.txt
```

Without `-pbkdf2`, openssl uses the old, weak key derivation (a single MD5 iteration). `openssl enc` doesn't support GCM; for real use, use `age`, `sops` or KMS. The goal here is to see the principle.

<!-- verify
cd /root/kripto
[ -e tajna.txt ] && { echo "The plaintext tajna.txt still exists"; exit 1; }
[ -s tajna.txt.enc ] || { echo "tajna.txt.enc does not exist"; exit 1; }
grep -q 'DB_PASSWORD' tajna.txt.enc && { echo "tajna.txt.enc is not encrypted"; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in tajna.txt.enc -pass file:lozinka.txt 2>/dev/null | cmp -s - /var/lib/kms/.tajna.orig || { echo "Decrypting with -pbkdf2 -iter 600000 doesn't yield the original content"; exit 1; }
-->
<!-- hint
The check decrypts the file with exactly these parameters: `-aes-256-cbc -pbkdf2 -iter 600000`. If you used different ones, encrypt again. Just in case, the original was kept by the "KMS", so you can restore it: `cp /var/lib/kms/.tajna.orig tajna.txt`.
-->
<!-- solution
cd /root/kripto && openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in tajna.txt -out tajna.txt.enc -pass file:lozinka.txt && shred -u tajna.txt
-->

## Sign SHA256SUMS with Ed25519

Create an Ed25519 key pair and sign `releases/SHA256SUMS`. Users who have your public key can verify that nobody has tampered with the hashes.

```bash
cd /root/kripto
openssl genpkey -algorithm ed25519 -out potpis-private.pem
openssl pkey -in potpis-private.pem -pubout -out potpis-public.pem
chmod 600 potpis-private.pem
openssl pkeyutl -sign -inkey potpis-private.pem -rawin -in releases/SHA256SUMS -out releases/SHA256SUMS.sig
openssl pkeyutl -verify -pubin -inkey potpis-public.pem -rawin -in releases/SHA256SUMS -sigfile releases/SHA256SUMS.sig
```

Try changing one character in `SHA256SUMS` and run the verification again, then restore the file. In the real world this is done with `cosign sign-blob` or GPG, and the public key is published separately from the files.

<!-- verify
cd /root/kripto
[ -f potpis-public.pem ] && [ -f releases/SHA256SUMS.sig ] || { echo "The public key or signature is missing"; exit 1; }
openssl pkey -pubin -in potpis-public.pem -noout -text 2>/dev/null | grep -qi 'ED25519' || { echo "The key is not Ed25519"; exit 1; }
openssl pkeyutl -verify -pubin -inkey potpis-public.pem -rawin -in releases/SHA256SUMS -sigfile releases/SHA256SUMS.sig >/dev/null 2>&1 || { echo "The signature doesn't match the current SHA256SUMS"; exit 1; }
[ "$(stat -c %a potpis-private.pem)" = 600 ] || { echo "The private key needs permissions 600"; exit 1; }
-->
<!-- solution
cd /root/kripto
openssl genpkey -algorithm ed25519 -out potpis-private.pem && openssl pkey -in potpis-private.pem -pubout -out potpis-public.pem && chmod 600 potpis-private.pem
openssl pkeyutl -sign -inkey potpis-private.pem -rawin -in releases/SHA256SUMS -out releases/SHA256SUMS.sig
-->

## Envelope encryption

You'll simulate what KMS does for S3 or EBS. The "KMS" has a master key (KEK), and you only have its public part in `kms-public.pem`. The private KEK is in `/var/lib/kms/`, as if it were in an HSM, and you don't touch it.

1. Generate a random data key (DEK).
2. Encrypt `izvjestaj.txt` with the DEK.
3. Encrypt the DEK with the public KEK (RSA-OAEP).
4. Delete the plaintext DEK and the plaintext report. Only `izvjestaj.txt.enc` and `dek.enc` remain.

```bash
cd /root/kripto
openssl rand -hex 32 > dek.txt
openssl enc -aes-256-cbc -pbkdf2 -in izvjestaj.txt -out izvjestaj.txt.enc -pass file:dek.txt
openssl pkeyutl -encrypt -pubin -inkey kms-public.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
  -in dek.txt -out dek.enc
shred -u dek.txt izvjestaj.txt
ls -l
```

To decrypt, the application would send `dek.enc` to KMS. KMS decrypts it only if IAM allows it, and logs the call. The application then decrypts the data with the DEK. Rotating the KEK means re-encrypting only the small DEKs, not terabytes of data.

<!-- verify
cd /root/kripto
for f in dek.txt izvjestaj.txt; do [ -e $f ] && { echo "$f still exists in plaintext"; exit 1; }; done
[ -s dek.enc ] && [ -s izvjestaj.txt.enc ] || { echo "dek.enc or izvjestaj.txt.enc is missing"; exit 1; }
openssl pkeyutl -decrypt -inkey /var/lib/kms/kek-private.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in dek.enc -out /tmp/dek.check 2>/dev/null || { echo "KMS can't decrypt dek.enc (OAEP with SHA-256?)"; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -in izvjestaj.txt.enc -pass file:/tmp/dek.check 2>/dev/null | cmp -s - /var/lib/kms/.izvjestaj.orig
r=$?; rm -f /tmp/dek.check
[ $r -eq 0 ] || { echo "The decrypted DEK doesn't unlock the report"; exit 1; }
-->
<!-- solution
cd /root/kripto
openssl rand -hex 32 > dek.txt
openssl enc -aes-256-cbc -pbkdf2 -in izvjestaj.txt -out izvjestaj.txt.enc -pass file:dek.txt
openssl pkeyutl -encrypt -pubin -inkey kms-public.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in dek.txt -out dek.enc
shred -u dek.txt izvjestaj.txt
-->
