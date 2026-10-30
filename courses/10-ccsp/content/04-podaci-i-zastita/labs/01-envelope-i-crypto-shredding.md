# Lab 1: Envelope enkripcija i crypto-shredding

U cloudu ne možeš fizički uništiti disk na kome su ti podaci bili (multitenancy, replike, backupi kod provajdera). Zato se podaci **šifruju**, a kad treba „obrisati“ podatke, uništi se **ključ**: to je **crypto-shredding**.

Cloud KMS servisi (AWS KMS, Azure Key Vault, Google Cloud KMS) rade po principu **envelope encryption**: svaki objekat se šifruje vlastitim ključem podataka (**DEK**), a DEK se čuva samo šifrovan glavnim ključem (**KEK**) koji ne napušta KMS/HSM. Ovdje ćeš isto napraviti lokalno, sa `openssl`.

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

## KEK i šifrovanje sa DEK-om

1. Napravi **KEK**: 32 nasumična bajta u `/root/podaci/kek/kek.bin` (u stvarnosti on živi u KMS/HSM-u).
2. Za **svaki** fajl `klijent-*.txt` napravi poseban DEK (32 bajta), šifruj fajl DEK-om (`openssl enc -aes-256-cbc -pbkdf2` je dovoljno za lab; u produkciji AES-GCM), pa:
   - šifrovani sadržaj sačuvaj kao `klijent-<ime>.enc`,
   - DEK šifruj KEK-om i sačuvaj kao `klijent-<ime>.dek.enc`,
   - obriši otvoreni tekst i nešifrovani DEK.

Napiši skriptu `/root/podaci/desifruj.sh <ime>` koja uz pomoć KEK-a vrati originalni sadržaj na stdout.

```bash
openssl rand -out kek/kek.bin 32
openssl rand -out /tmp/dek.bin 32
openssl enc -aes-256-cbc -pbkdf2 -salt -in klijent-ana.txt -out klijent-ana.enc -pass file:/tmp/dek.bin
```

<!-- verify
cd /root/podaci
[ "$(stat -c %s kek/kek.bin 2>/dev/null)" = "32" ] || { echo "kek/kek.bin treba 32 bajta"; exit 1; }
ls klijent-*.txt >/dev/null 2>&1 && { echo "otvoreni tekst klijent-*.txt i dalje postoji"; exit 1; }
for k in ana marko jelena; do
  [ -s klijent-$k.enc ] && [ -s klijent-$k.dek.enc ] || { echo "nedostaje klijent-$k.enc ili klijent-$k.dek.enc"; exit 1; }
  grep -aq "klijent=$k" klijent-$k.enc && { echo "klijent-$k.enc nije šifrovan"; exit 1; }
done
[ "$(cmp -s klijent-ana.dek.enc klijent-marko.dek.enc && echo isti)" = "isti" ] && { echo "svaki fajl treba svoj DEK"; exit 1; }
find / -xdev -name 'dek*.bin' -size 32c 2>/dev/null | grep -q . && { echo "nešifrovani DEK je ostao na disku"; exit 1; }
[ -x desifruj.sh ] || { echo "nema izvršive /root/podaci/desifruj.sh"; exit 1; }
for k in ana marko jelena; do ./desifruj.sh $k 2>/dev/null | grep -q "^klijent=$k$" || { echo "desifruj.sh $k ne vraća originalni sadržaj"; exit 1; }; done
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
Dešifrovanje ide obrnutim redom: prvo DEK KEK-om (u stvarnosti `kms:Decrypt`), pa podaci DEK-om.
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

## Crypto-shredding jednog klijenta

Klijent `marko` je raskinuo ugovor i zahtijeva brisanje podataka (GDPR čl. 17). Kopije njegovog `.enc` fajla postoje i u backupima, koje ne možeš mijenjati.

Uništi **samo njegov DEK** (`klijent-marko.dek.enc`, `shred -u`), a `klijent-marko.enc` ostavi (kao da je u backupu). Podaci ostalih klijenata moraju ostati čitljivi. U `/root/podaci/zapis-brisanja.txt` zapiši datum (UTC), ime klijenta i šta je uništeno.

<!-- verify
cd /root/podaci
[ -f klijent-marko.dek.enc ] && { echo "DEK za marko i dalje postoji"; exit 1; }
[ -s klijent-marko.enc ] || { echo "klijent-marko.enc treba ostati (simulira backup)"; exit 1; }
./desifruj.sh marko >/dev/null 2>&1 && { echo "podaci za marko su i dalje čitljivi"; exit 1; }
for k in ana jelena; do ./desifruj.sh $k 2>/dev/null | grep -q "^klijent=$k$" || { echo "podaci za $k više nisu čitljivi"; exit 1; }; done
grep -qi 'marko' zapis-brisanja.txt 2>/dev/null && grep -Eq '20[0-9]{2}-[0-9]{2}-[0-9]{2}' zapis-brisanja.txt || { echo "zapis-brisanja.txt treba datum i ime klijenta"; exit 1; }
-->
<!-- hint
Zato i jeste svaki klijent dobio svoj DEK: uništenje KEK-a bi obrisalo sve klijente odjednom. Granularnost ključeva određuje granularnost crypto-shreddinga.
-->
<!-- solution
cd /root/podaci
shred -u klijent-marko.dek.enc
echo "$(date -u +%Y-%m-%d) klijent=marko: uništen DEK (klijent-marko.dek.enc); šifrovani podaci u backupima su neupotrebljivi" > zapis-brisanja.txt
-->
