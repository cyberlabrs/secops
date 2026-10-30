# Lab 1: Envelope encryption and crypto-shredding

In the cloud you cannot physically destroy the disk your data was on (multi-tenancy, replicas, backups at the provider). That is why data is **encrypted**, and when the data needs to be "deleted", the **key** is destroyed: that is **crypto-shredding**.

Cloud KMS services (AWS KMS, Azure Key Vault, Google Cloud KMS) work on the principle of **envelope encryption**: each object is encrypted with its own data encryption key (**DEK**), and the DEK is stored only encrypted with a master key (**KEK**) that never leaves the KMS/HSM. Here you will do the same locally, with `openssl`.

```bash
cd /root/podaci && ls -la
openssl version
```

<!-- setup
set -e
mkdir -p /root/podaci/kek
cd /root/podaci
for k in ana marko jelena; do printf 'klijent=%s\nugovor=2026-%s\nadresa=Primjer 1, Sarajevo\n' "$k" "$RANDOM" > "klijent-$k.txt"; done
-->

## KEK and encryption with a DEK

1. Create a **KEK**: 32 random bytes in `/root/podaci/kek/kek.bin` (in reality it lives in a KMS/HSM).
2. For **each** `klijent-*.txt` file create a separate DEK (32 bytes), encrypt the file with the DEK (`openssl enc -aes-256-cbc -pbkdf2` is enough for the lab; in production use AES-GCM), then:
   - save the encrypted content as `klijent-<name>.enc`,
   - encrypt the DEK with the KEK and save it as `klijent-<name>.dek.enc`,
   - delete the plaintext and the unencrypted DEK.

Write a script `/root/podaci/desifruj.sh <name>` that uses the KEK to return the original content to stdout.

```bash
openssl rand -out kek/kek.bin 32
openssl rand -out /tmp/dek.bin 32
openssl enc -aes-256-cbc -pbkdf2 -salt -in klijent-ana.txt -out klijent-ana.enc -pass file:/tmp/dek.bin
```

<!-- verify
cd /root/podaci
[ "$(stat -c %s kek/kek.bin 2>/dev/null)" = "32" ] || { echo "kek/kek.bin must be 32 bytes"; exit 1; }
ls klijent-*.txt >/dev/null 2>&1 && { echo "plaintext klijent-*.txt still exists"; exit 1; }
for k in ana marko jelena; do
  [ -s klijent-$k.enc ] && [ -s klijent-$k.dek.enc ] || { echo "missing klijent-$k.enc or klijent-$k.dek.enc"; exit 1; }
  grep -aq "klijent=$k" klijent-$k.enc && { echo "klijent-$k.enc is not encrypted"; exit 1; }
done
[ "$(cmp -s klijent-ana.dek.enc klijent-marko.dek.enc && echo isti)" = "isti" ] && { echo "each file needs its own DEK"; exit 1; }
find / -xdev -name 'dek*.bin' -size 32c 2>/dev/null | grep -q . && { echo "an unencrypted DEK was left on disk"; exit 1; }
[ -x desifruj.sh ] || { echo "no executable /root/podaci/desifruj.sh"; exit 1; }
for k in ana marko jelena; do ./desifruj.sh $k 2>/dev/null | grep -q "^klijent=$k$" || { echo "desifruj.sh $k does not return the original content"; exit 1; }; done
-->
<!-- hint
```bash
for f in klijent-*.txt; do
  n=${f%.txt}
  openssl rand -out /tmp/dek.bin 32
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$f" -out "$n.enc" -pass file:/tmp/dek.bin
  openssl enc -aes-256-cbc -pbkdf2 -salt -in /tmp/dek.bin -out "$n.dek.enc" -pass file:kek/kek.bin
  shred -u /tmp/dek.bin "$f"
done
```
Decryption goes in reverse order: first the DEK with the KEK (in reality `kms:Decrypt`), then the data with the DEK.
-->
<!-- solution
cd /root/podaci
openssl rand -out kek/kek.bin 32
for f in klijent-*.txt; do
  n=${f%.txt}
  openssl rand -out /tmp/dek.bin 32
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$f" -out "$n.enc" -pass file:/tmp/dek.bin
  openssl enc -aes-256-cbc -pbkdf2 -salt -in /tmp/dek.bin -out "$n.dek.enc" -pass file:kek/kek.bin
  shred -u /tmp/dek.bin "$f"
done
cat > desifruj.sh <<'EOF'
#!/bin/bash
# desifruj.sh <ime>: DEK se dešifruje KEK-om, pa podaci DEK-om
set -euo pipefail
cd /root/podaci
dek=$(mktemp); trap 'shred -u "$dek"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -in "klijent-$1.dek.enc" -out "$dek" -pass file:kek/kek.bin
openssl enc -d -aes-256-cbc -pbkdf2 -in "klijent-$1.enc" -pass file:"$dek"
EOF
chmod +x desifruj.sh
-->

## Crypto-shredding a single client

Client `marko` has terminated the contract and requests erasure of his data (GDPR Art. 17). Copies of his `.enc` file also exist in backups, which you cannot modify.

Destroy **only his DEK** (`klijent-marko.dek.enc`, `shred -u`), and leave `klijent-marko.enc` in place (as if it were in a backup). The other clients' data must remain readable. In `/root/podaci/zapis-brisanja.txt` record the date (UTC), the client's name and what was destroyed.

<!-- verify
cd /root/podaci
[ -f klijent-marko.dek.enc ] && { echo "the DEK for marko still exists"; exit 1; }
[ -s klijent-marko.enc ] || { echo "klijent-marko.enc must remain (simulates a backup)"; exit 1; }
./desifruj.sh marko >/dev/null 2>&1 && { echo "data for marko is still readable"; exit 1; }
for k in ana jelena; do ./desifruj.sh $k 2>/dev/null | grep -q "^klijent=$k$" || { echo "data for $k is no longer readable"; exit 1; }; done
grep -qi 'marko' zapis-brisanja.txt 2>/dev/null && grep -Eq '20[0-9]{2}-[0-9]{2}-[0-9]{2}' zapis-brisanja.txt || { echo "zapis-brisanja.txt needs a date and the client's name"; exit 1; }
-->
<!-- hint
That is exactly why each client got its own DEK: destroying the KEK would erase all clients at once. The granularity of keys determines the granularity of crypto-shredding.
-->
<!-- solution
cd /root/podaci
shred -u klijent-marko.dek.enc
echo "$(date -u +%Y-%m-%d) klijent=marko: uništen DEK (klijent-marko.dek.enc); šifrovani podaci u backupima su neupotrebljivi" > zapis-brisanja.txt
-->
