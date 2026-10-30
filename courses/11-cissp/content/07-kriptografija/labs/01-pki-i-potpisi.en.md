# Lab 1: PKI, Signatures and Integrity with openssl

The cryptographic concepts from the exam (hash, MAC, digital signature, certificate, chain of trust) are understood fastest when you build them yourself. You will create a small internal PKI: a root CA, a server certificate signed by that CA, chain verification and a document signature.

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

Create a root CA:

- private key `/root/pki/ca.key` (EC, curve `prime256v1`, or RSA 3072),
- self-signed certificate `/root/pki/ca.crt` with subject `CN=Kurs Root CA`, valid for 3650 days, with the extensions `basicConstraints=critical,CA:TRUE` and `keyUsage=critical,keyCertSign,cRLSign`.

```bash
openssl req -x509 -new -key ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
```

<!-- verify
cd /root/pki
[ -s ca.key ] && [ -s ca.crt ] || { echo "ca.key or ca.crt is missing"; exit 1; }
openssl x509 -in ca.crt -noout -subject 2>/dev/null | grep -q 'CN *= *Kurs Root CA' || { echo "the subject must be CN=Kurs Root CA"; exit 1; }
[ "$(openssl x509 -in ca.crt -noout -subject -nameopt RFC2253 | sed 's/subject=//')" = "$(openssl x509 -in ca.crt -noout -issuer -nameopt RFC2253 | sed 's/issuer=//')" ] || { echo "ca.crt is not self-signed"; exit 1; }
openssl x509 -in ca.crt -noout -text | grep -A1 'Basic Constraints: critical' | grep -q 'CA:TRUE' || { echo "basicConstraints=critical,CA:TRUE is missing"; exit 1; }
openssl x509 -in ca.crt -noout -text | grep -A1 'Key Usage: critical' | grep -q 'Certificate Sign' || { echo "keyUsage keyCertSign is missing"; exit 1; }
[ "$(openssl x509 -in ca.crt -noout -pubkey | openssl sha256)" = "$(openssl pkey -in ca.key -pubout | openssl sha256)" ] || { echo "ca.key does not match ca.crt"; exit 1; }
-->
<!-- hint
```bash
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
```
A root CA is self-signed (issuer = subject). Trust in it is established outside the PKI: by manually installing it as trusted (trust store).
-->
<!-- solution
cd /root/pki
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
openssl req -x509 -new -key ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Root CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
-->

## Server Certificate

1. Create the key `/root/pki/server.key` and a certificate signing request (CSR) `/root/pki/server.csr` for `CN=portal.kurs.ba`.
2. Use the CA to sign the certificate `/root/pki/server.crt` (valid for 397 days) with `subjectAltName=DNS:portal.kurs.ba,DNS:www.kurs.ba`, `extendedKeyUsage=serverAuth` and `basicConstraints=CA:FALSE`.
3. Verify the chain: `openssl verify -CAfile ca.crt server.crt`.

<!-- verify
cd /root/pki
[ -s server.key ] && [ -s server.csr ] && [ -s server.crt ] || { echo "server.key, server.csr or server.crt is missing"; exit 1; }
openssl req -in server.csr -noout -verify >/dev/null 2>&1 || { echo "server.csr is not a valid CSR"; exit 1; }
openssl verify -CAfile ca.crt server.crt 2>/dev/null | grep -q ': OK' || { echo "server.crt is not signed by Kurs Root CA (openssl verify)"; exit 1; }
t=$(openssl x509 -in server.crt -noout -text)
echo "$t" | grep -q 'DNS:portal.kurs.ba' && echo "$t" | grep -q 'DNS:www.kurs.ba' || { echo "the SAN must contain DNS:portal.kurs.ba and DNS:www.kurs.ba"; exit 1; }
echo "$t" | grep -A1 'Extended Key Usage' | grep -q 'TLS Web Server Authentication' || { echo "extendedKeyUsage serverAuth is missing"; exit 1; }
echo "$t" | grep -A1 'Basic Constraints' | grep -q 'CA:FALSE' || { echo "server.crt must have CA:FALSE"; exit 1; }
d=$(( ( $(date -d "$(openssl x509 -in server.crt -noout -enddate | cut -d= -f2)" +%s) - $(date -d "$(openssl x509 -in server.crt -noout -startdate | cut -d= -f2)" +%s) ) / 86400 ))
[ "$d" -le 398 ] && [ "$d" -ge 396 ] || { echo "validity must be 397 days (currently $d)"; exit 1; }
[ "$(openssl x509 -in server.crt -noout -pubkey | openssl sha256)" = "$(openssl pkey -in server.key -pubout | openssl sha256)" ] || { echo "server.key does not match server.crt"; exit 1; }
-->
<!-- hint
```bash
openssl ecparam -name prime256v1 -genkey -noout -out server.key
openssl req -new -key server.key -out server.csr -subj "/CN=portal.kurs.ba"
printf 'subjectAltName=DNS:portal.kurs.ba,DNS:www.kurs.ba\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 397 -extfile server.ext
```
Browsers look at the SAN, not the CN. Public TLS certificates today are valid for at most 398 days, and the CA/Browser Forum is gradually shortening that period.
-->
<!-- solution
cd /root/pki
openssl ecparam -name prime256v1 -genkey -noout -out server.key
openssl req -new -key server.key -out server.csr -subj "/CN=portal.kurs.ba"
printf 'subjectAltName=DNS:portal.kurs.ba,DNS:www.kurs.ba\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 397 -extfile server.ext 2>/dev/null
-->

## Hash, Signature and Non-Repudiation

1. Compute the SHA-256 of `ugovor.txt` (the contract) and write only the hex value to `/root/pki/ugovor.sha256`.
2. Sign `ugovor.txt` with the server key (`server.key`, SHA-256) into `/root/pki/ugovor.sig`.
3. In `/root/pki/odgovori.txt`, answer on three lines: (a) what the hash alone proves, (b) what the signature adds, (c) why HMAC with a shared key does not provide non-repudiation.

Signature verification: the public key from `server.crt` + `openssl dgst -sha256 -verify`.

<!-- verify
cd /root/pki
[ "$(tr -d ' \n' < ugovor.sha256 2>/dev/null)" = "$(sha256sum ugovor.txt | cut -d' ' -f1)" ] || { echo "ugovor.sha256 does not contain the correct SHA-256"; exit 1; }
[ -s ugovor.sig ] || { echo "ugovor.sig is missing"; exit 1; }
openssl x509 -in server.crt -noout -pubkey > /tmp/pub.pem
openssl dgst -sha256 -verify /tmp/pub.pem -signature ugovor.sig ugovor.txt >/dev/null 2>&1 || { echo "the signature cannot be verified with the public key from server.crt"; exit 1; }
cp ugovor.txt /tmp/izmijenjen.txt; echo "dodatak" >> /tmp/izmijenjen.txt
openssl dgst -sha256 -verify /tmp/pub.pem -signature ugovor.sig /tmp/izmijenjen.txt >/dev/null 2>&1 && { echo "the signature also passes for a modified document?"; exit 1; }
[ "$(grep -c . odgovori.txt 2>/dev/null)" -ge 3 ] || { echo "odgovori.txt needs three answers"; exit 1; }
grep -Eqi 'integritet|izmijen|promjen|integrity|modif|chang|alter' odgovori.txt && grep -Eqi 'porec|autent|privatn|identitet|repudi|authent|private|identity' odgovori.txt && grep -Eqi 'dijel|oba|zajedn|simetri|isti ključ|shar|both|symmetr|same key' odgovori.txt || { echo "the answers should mention integrity, authenticity/non-repudiation and the shared key"; exit 1; }
-->
<!-- hint
```bash
sha256sum ugovor.txt | cut -d' ' -f1 > ugovor.sha256
openssl dgst -sha256 -sign server.key -out ugovor.sig ugovor.txt
```
A hash shows whether the content has changed, but anyone can recompute it. A signature with the private key proves who signed. With HMAC both parties have the key, so either of them can produce the same MAC.
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
