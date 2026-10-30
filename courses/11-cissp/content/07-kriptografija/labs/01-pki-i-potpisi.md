# Lab 1: PKI, potpisi i integritet sa openssl

Kriptografski pojmovi sa ispita (hash, MAC, digitalni potpis, certifikat, lanac povjerenja) najbrže se razumiju kad ih napraviš sam. Napravićeš malu internu PKI: root CA, certifikat servera potpisan tim CA, provjeru lanca i potpis dokumenta.

```bash
openssl version
mkdir -p /root/pki && cd /root/pki
```

<!-- setup
set -e
mkdir -p /root/pki
printf 'Ugovor o obradi podataka, verzija 3\nStrane: Kurs d.o.o. i Primjer d.o.o.\n' > /root/pki/ugovor.txt
-->

## Root CA

Napravi root CA:

- privatni ključ `/root/pki/ca.key` (EC, kriva `prime256v1`, ili RSA 3072),
- samopotpisan certifikat `/root/pki/ca.crt` sa subjektom `CN=Kurs Root CA`, važenje 3650 dana, sa ekstenzijama `basicConstraints=critical,CA:TRUE` i `keyUsage=critical,keyCertSign,cRLSign`.

```bash
openssl req -x509 -new -key ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
```

<!-- verify
cd /root/pki
[ -s ca.key ] && [ -s ca.crt ] || { echo "nema ca.key ili ca.crt"; exit 1; }
openssl x509 -in ca.crt -noout -subject 2>/dev/null | grep -q 'CN *= *Kurs Root CA' || { echo "subjekt treba CN=Kurs Root CA"; exit 1; }
[ "$(openssl x509 -in ca.crt -noout -subject -nameopt RFC2253 | sed 's/subject=//')" = "$(openssl x509 -in ca.crt -noout -issuer -nameopt RFC2253 | sed 's/issuer=//')" ] || { echo "ca.crt nije samopotpisan"; exit 1; }
openssl x509 -in ca.crt -noout -text | grep -A1 'Basic Constraints: critical' | grep -q 'CA:TRUE' || { echo "nedostaje basicConstraints=critical,CA:TRUE"; exit 1; }
openssl x509 -in ca.crt -noout -text | grep -A1 'Key Usage: critical' | grep -q 'Certificate Sign' || { echo "nedostaje keyUsage keyCertSign"; exit 1; }
[ "$(openssl x509 -in ca.crt -noout -pubkey | openssl sha256)" = "$(openssl pkey -in ca.key -pubout | openssl sha256)" ] || { echo "ca.key ne odgovara ca.crt"; exit 1; }
-->
<!-- hint
```bash
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
```
Root CA je samopotpisan (izdavalac = subjekt). Povjerenje u njega nastaje van PKI-ja: tako što ga ručno instaliraš kao pouzdan (trust store).
-->
<!-- solution
cd /root/pki
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
openssl req -x509 -new -key ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Root CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
-->

## Certifikat servera

1. Napravi ključ `/root/pki/server.key` i zahtjev (CSR) `/root/pki/server.csr` za `CN=portal.kurs.ba`.
2. CA-om potpiši certifikat `/root/pki/server.crt` (važenje 397 dana) sa `subjectAltName=DNS:portal.kurs.ba,DNS:www.kurs.ba`, `extendedKeyUsage=serverAuth` i `basicConstraints=CA:FALSE`.
3. Provjeri lanac: `openssl verify -CAfile ca.crt server.crt`.

<!-- verify
cd /root/pki
[ -s server.key ] && [ -s server.csr ] && [ -s server.crt ] || { echo "nedostaje server.key, server.csr ili server.crt"; exit 1; }
openssl req -in server.csr -noout -verify >/dev/null 2>&1 || { echo "server.csr nije ispravan CSR"; exit 1; }
openssl verify -CAfile ca.crt server.crt 2>/dev/null | grep -q ': OK' || { echo "server.crt nije potpisan od Kurs Root CA (openssl verify)"; exit 1; }
t=$(openssl x509 -in server.crt -noout -text)
echo "$t" | grep -q 'DNS:portal.kurs.ba' && echo "$t" | grep -q 'DNS:www.kurs.ba' || { echo "SAN treba DNS:portal.kurs.ba i DNS:www.kurs.ba"; exit 1; }
echo "$t" | grep -A1 'Extended Key Usage' | grep -q 'TLS Web Server Authentication' || { echo "nedostaje extendedKeyUsage serverAuth"; exit 1; }
echo "$t" | grep -A1 'Basic Constraints' | grep -q 'CA:FALSE' || { echo "server.crt treba CA:FALSE"; exit 1; }
d=$(( ( $(date -d "$(openssl x509 -in server.crt -noout -enddate | cut -d= -f2)" +%s) - $(date -d "$(openssl x509 -in server.crt -noout -startdate | cut -d= -f2)" +%s) ) / 86400 ))
[ "$d" -le 398 ] && [ "$d" -ge 396 ] || { echo "važenje treba 397 dana (sada $d)"; exit 1; }
[ "$(openssl x509 -in server.crt -noout -pubkey | openssl sha256)" = "$(openssl pkey -in server.key -pubout | openssl sha256)" ] || { echo "server.key ne odgovara server.crt"; exit 1; }
-->
<!-- hint
```bash
openssl ecparam -name prime256v1 -genkey -noout -out server.key
openssl req -new -key server.key -out server.csr -subj "/CN=portal.kurs.ba"
printf 'subjectAltName=DNS:portal.kurs.ba,DNS:www.kurs.ba\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 397 -extfile server.ext
```
Browseri gledaju SAN, ne CN. Javni TLS certifikati danas važe najviše 398 dana, a CA/Browser Forum taj rok postepeno skraćuje.
-->
<!-- solution
cd /root/pki
openssl ecparam -name prime256v1 -genkey -noout -out server.key
openssl req -new -key server.key -out server.csr -subj "/CN=portal.kurs.ba"
printf 'subjectAltName=DNS:portal.kurs.ba,DNS:www.kurs.ba\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 397 -extfile server.ext 2>/dev/null
-->

## Hash, potpis i neporecivost

1. Izračunaj SHA-256 `ugovor.txt` i upiši samo heks vrijednost u `/root/pki/ugovor.sha256`.
2. Potpiši `ugovor.txt` ključem servera (`server.key`, SHA-256) u `/root/pki/ugovor.sig`.
3. U `/root/pki/odgovori.txt` u tri reda odgovori: (a) šta dokazuje sam hash, (b) šta dodaje potpis, (c) zašto HMAC sa dijeljenim ključem ne daje neporecivost.

Provjera potpisa: javni ključ iz `server.crt` + `openssl dgst -sha256 -verify`.

<!-- verify
cd /root/pki
[ "$(tr -d ' \n' < ugovor.sha256 2>/dev/null)" = "$(sha256sum ugovor.txt | cut -d' ' -f1)" ] || { echo "ugovor.sha256 ne sadrži tačan SHA-256"; exit 1; }
[ -s ugovor.sig ] || { echo "nema ugovor.sig"; exit 1; }
openssl x509 -in server.crt -noout -pubkey > /tmp/pub.pem
openssl dgst -sha256 -verify /tmp/pub.pem -signature ugovor.sig ugovor.txt >/dev/null 2>&1 || { echo "potpis se ne može provjeriti javnim ključem iz server.crt"; exit 1; }
cp ugovor.txt /tmp/izmijenjen.txt; echo "dodatak" >> /tmp/izmijenjen.txt
openssl dgst -sha256 -verify /tmp/pub.pem -signature ugovor.sig /tmp/izmijenjen.txt >/dev/null 2>&1 && { echo "potpis prolazi i za izmijenjen dokument?"; exit 1; }
[ "$(grep -c . odgovori.txt 2>/dev/null)" -ge 3 ] || { echo "odgovori.txt treba tri odgovora"; exit 1; }
grep -Eqi 'integritet|izmijen|promjen' odgovori.txt && grep -Eqi 'porec|autent|privatn|identitet' odgovori.txt && grep -Eqi 'dijel|oba|zajedn|simetri|isti ključ' odgovori.txt || { echo "odgovori trebaju pomenuti integritet, autentičnost/neporecivost i dijeljeni ključ"; exit 1; }
-->
<!-- hint
```bash
sha256sum ugovor.txt | cut -d' ' -f1 > ugovor.sha256
openssl dgst -sha256 -sign server.key -out ugovor.sig ugovor.txt
```
Hash pokazuje da li se sadržaj promijenio, ali ga svako može ponovo izračunati. Potpis privatnim ključem dokazuje ko je potpisao. Kod HMAC-a ključ imaju obje strane, pa bilo koja od njih može napraviti isti MAC.
-->
<!-- solution
cd /root/pki
sha256sum ugovor.txt | cut -d' ' -f1 > ugovor.sha256
openssl dgst -sha256 -sign server.key -out ugovor.sig ugovor.txt
cat > odgovori.txt <<'EOF'
a) Hash dokazuje samo integritet: da se sadržaj nije promijenio, ali ga svako može ponovo izračunati.
b) Potpis privatnim ključem dodaje autentičnost i neporecivost: samo vlasnik ključa ga je mogao napraviti, a provjerava ga svako javnim ključem iz certifikata.
c) HMAC koristi dijeljeni simetrični ključ koji imaju obje strane, pa bilo koja od njih može napraviti isti MAC i nema neporecivosti.
EOF
-->
