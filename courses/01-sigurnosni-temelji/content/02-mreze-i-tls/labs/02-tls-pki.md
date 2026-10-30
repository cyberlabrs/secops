# Lab 2: Vlastiti PKI i TLS sa openssl

Napravićeš mali PKI: root CA, certifikat servera sa ispravnim SAN-om i TLS server koji `curl` prihvata bez `-k`. Na kraju ćeš pronaći certifikat koji uskoro ističe, a to je zadatak koji se u praksi radi stalno.

Radi u direktoriju `/root/pki`.

<!-- setup
set -e
mkdir -p /root/pki /etc/ssl/app
cd /etc/ssl/app
for n in api:400 billing:12 portal:200; do
  name=${n%%:*}; days=${n##*:}
  openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/$name.key -out $name.pem -days $days -subj "/CN=$name.lab.local" 2>/dev/null
done
rm -f /tmp/*.key
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: PKI i TLS ===
Radni direktorij: /root/pki
EOF
-->

## Napravi root CA

Root CA je samopotpisani certifikat sa `CA:TRUE`. Koristimo EC ključ (P-256): manji je i brži od RSA, a jednako siguran.

```bash
cd /root/pki
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Lab Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl x509 -in ca.crt -noout -subject -issuer -ext basicConstraints
chmod 600 ca.key
```

Subject i issuer su isti, jer je certifikat samopotpisan.

<!-- verify
cd /root/pki || exit 1
[ -f ca.crt ] && [ -f ca.key ] || { echo "Nema ca.crt ili ca.key u /root/pki"; exit 1; }
openssl x509 -in ca.crt -noout -ext basicConstraints 2>/dev/null | grep -q 'CA:TRUE' || { echo "ca.crt nema CA:TRUE"; exit 1; }
[ "$(stat -c %a ca.key)" = 600 ] || { echo "ca.key treba dozvole 600"; exit 1; }
-->
<!-- solution
cd /root/pki
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Lab Root CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
chmod 600 ca.key
-->

## Izdaj certifikat za server

Napravi ključ i CSR (zahtjev za potpis) za `app.lab.local`, a zatim ga potpiši svojim CA. Najvažniji dio je **SAN**: bez njega klijenti odbijaju certifikat bez obzira na CN.

```bash
cd /root/pki
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout server.key -out server.csr -subj "/CN=app.lab.local"
cat > server.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=DNS:app.lab.local,DNS:localhost,IP:127.0.0.1
EOF
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 90 -extfile server.ext
openssl verify -CAfile ca.crt server.crt
openssl x509 -in server.crt -noout -ext subjectAltName -enddate
```

Rok od 90 dana nije slučajan: kratki rokovi i automatska obnova su današnji standard.

<!-- verify
cd /root/pki || exit 1
openssl verify -CAfile ca.crt server.crt 2>&1 | grep -q 'server.crt: OK' || { echo "server.crt nije potpisan tvojim CA"; exit 1; }
openssl x509 -in server.crt -noout -ext subjectAltName 2>/dev/null | grep -q 'DNS:app.lab.local' || { echo "SAN ne sadrži DNS:app.lab.local"; exit 1; }
openssl x509 -in server.crt -noout -ext basicConstraints 2>/dev/null | grep -q 'CA:TRUE' && { echo "Serverski certifikat ne smije biti CA"; exit 1; }
exit 0
-->
<!-- hint
Ako `openssl verify` javlja grešku, provjeri da si potpisao sa `-CA ca.crt -CAkey ca.key`, a ne napravio novi samopotpisani certifikat.
-->
<!-- solution
cd /root/pki
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout server.key -out server.csr -subj "/CN=app.lab.local" 2>/dev/null
printf 'basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:app.lab.local,DNS:localhost,IP:127.0.0.1\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 90 -extfile server.ext 2>/dev/null
-->

## Pokreni TLS server i spoji se bez -k

Pokreni jednostavan TLS server samo sa TLS 1.2 i 1.3:

```bash
cd /root/pki
nohup openssl s_server -accept 8443 -cert server.crt -key server.key -www -no_tls1 -no_tls1_1 >/tmp/s_server.log 2>&1 &
sleep 1
curl --cacert ca.crt --resolve app.lab.local:8443:127.0.0.1 https://app.lab.local:8443/ | head -5
```

`--cacert` govori curl-u da vjeruje tvom CA. `--resolve` mapira ime na IP bez DNS-a. Probaj i bez `--cacert` da vidiš grešku koju bi dobio klijent koji ne vjeruje tvom CA.

Pogledaj šta je dogovoreno:

```bash
openssl s_client -connect 127.0.0.1:8443 -servername app.lab.local -CAfile ca.crt </dev/null 2>/dev/null | grep -E 'Protocol|Cipher|Verify return'
```

<!-- verify
curl -s --max-time 5 --cacert /root/pki/ca.crt --resolve app.lab.local:8443:127.0.0.1 https://app.lab.local:8443/ >/dev/null || { echo "curl se ne može spojiti uz provjeru certifikata"; exit 1; }
-->
<!-- solution
cd /root/pki && (nohup openssl s_server -accept 8443 -cert server.crt -key server.key -www -no_tls1 -no_tls1_1 >/tmp/s_server.log 2>&1 &) ; sleep 1
-->

## Pronađi certifikat koji uskoro ističe

U `/etc/ssl/app/` su tri produkcijska certifikata. Jedan ističe za manje od 30 dana. Pronađi ga i upiši njegovo ime fajla (npr. `xyz.pem`) u `/root/istice.txt`.

```bash
for f in /etc/ssl/app/*.pem; do
  echo "$f: $(openssl x509 -in $f -noout -enddate)"
  openssl x509 -in $f -noout -checkend $((30*24*3600)) >/dev/null || echo "  ^ ISTIČE ZA MANJE OD 30 DANA"
done
```

`-checkend N` vraća grešku ako certifikat ističe u narednih N sekundi. Ovakva petlja u cronu ili monitoringu sprečava ispade zbog isteklih certifikata.

<!-- verify
grep -qx 'billing.pem' /root/istice.txt 2>/dev/null || grep -q '^/etc/ssl/app/billing.pem$' /root/istice.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/istice.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo billing.pem > /root/istice.txt
-->
