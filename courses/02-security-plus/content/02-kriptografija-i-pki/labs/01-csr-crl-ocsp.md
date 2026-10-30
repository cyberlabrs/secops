# Lab 1: CSR, wildcard certifikat, opoziv (CRL i OCSP)

Firma ima internu certifikacionu agenciju (CA). Napravićeš **CSR** za **wildcard** certifikat, izdati ga, a onda ga zbog kompromitovanog ključa **opozvati** i provjeriti opoziv na oba načina koje ispit traži: **CRL** i **OCSP**.

CA je već pripremljena u `/root/pki` (ključ, certifikat i konfiguracija `ca.cnf` sa bazom izdatih certifikata `index.txt`).

<!-- setup
set -e
mkdir -p /root/pki/novi && cd /root/pki
touch index.txt && echo 1000 > serial && echo 1000 > crlnumber
cat > ca.cnf <<'EOF'
[ ca ]
default_ca = interna_ca

[ interna_ca ]
dir             = /root/pki
database        = $dir/index.txt
new_certs_dir   = $dir/novi
certificate     = $dir/ca.crt
private_key     = $dir/ca.key
serial          = $dir/serial
crlnumber       = $dir/crlnumber
default_md      = sha256
default_days    = 90
default_crl_days = 7
policy          = politika
copy_extensions = copy
x509_extensions = server_ext
unique_subject  = no

[ politika ]
commonName      = supplied
organizationName = optional

[ server_ext ]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = serverAuth
authorityInfoAccess = OCSP;URI:http://127.0.0.1:8888
crlDistributionPoints = URI:http://pki.primjer-firma.ba/interna.crl
EOF
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout ca.key -out ca.crt -days 3650 \
  -subj "/CN=Primjer Firma Interna CA/O=Primjer Firma" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
chmod 600 ca.key
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: CSR, CRL, OCSP ===
CA: /root/pki (ca.cnf, ca.crt, ca.key, index.txt)
EOF
-->

## Napravi CSR za wildcard

CSR (*certificate signing request*) sadrži **javni** ključ i podatke o subjektu, potpisan privatnim ključem. Privatni ključ nikad ne napušta server koji ga je napravio.

Wildcard `*.primjer-firma.ba` pokriva `www.primjer-firma.ba` i `api.primjer-firma.ba`, ali **ne** i sam `primjer-firma.ba` niti `a.b.primjer-firma.ba`. Zato se apex domen dodaje kao zaseban SAN.

```bash
cd /root/pki
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout wildcard.key -out wildcard.csr \
  -subj "/CN=*.primjer-firma.ba/O=Primjer Firma" \
  -addext "subjectAltName=DNS:*.primjer-firma.ba,DNS:primjer-firma.ba"
chmod 600 wildcard.key
openssl req -in wildcard.csr -noout -text | grep -A1 -E 'Subject:|Alternative'
openssl req -in wildcard.csr -noout -verify
```

<!-- verify
cd /root/pki
openssl req -in wildcard.csr -noout -verify 2>&1 | grep -qiE 'verify OK|Certificate request self-signature verify OK' || { echo "wildcard.csr ne postoji ili potpis nije ispravan"; exit 1; }
san=$(openssl req -in wildcard.csr -noout -text | grep -A1 'Alternative' | tail -1)
echo "$san" | grep -q 'DNS:\*.primjer-firma.ba' || { echo "SAN nema DNS:*.primjer-firma.ba"; exit 1; }
echo "$san" | grep -qE 'DNS:primjer-firma.ba(,|$)' || { echo "SAN nema apex domen primjer-firma.ba"; exit 1; }
-->
<!-- solution
cd /root/pki
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout wildcard.key -out wildcard.csr -subj "/CN=*.primjer-firma.ba/O=Primjer Firma" -addext "subjectAltName=DNS:*.primjer-firma.ba,DNS:primjer-firma.ba" 2>/dev/null
chmod 600 wildcard.key
-->

## Izdaj certifikat

CA potpisuje CSR. `copy_extensions = copy` u `ca.cnf` prenosi SAN iz CSR-a. Na pravoj CA bi neko prvo provjerio da podnosilac stvarno kontroliše domen.

```bash
cd /root/pki
openssl ca -batch -config ca.cnf -in wildcard.csr -out wildcard.crt
openssl verify -CAfile ca.crt wildcard.crt
openssl x509 -in wildcard.crt -noout -serial -enddate -ext subjectAltName,authorityInfoAccess,crlDistributionPoints
cat index.txt
```

Certifikat sadrži adrese na kojima klijent provjerava opoziv: **CRL Distribution Points** i **OCSP** u polju Authority Information Access. U `index.txt` je sada red koji počinje sa `V` (valid).

<!-- verify
cd /root/pki
openssl verify -CAfile ca.crt wildcard.crt 2>&1 | grep -q 'wildcard.crt: OK' || { echo "wildcard.crt nije izdat od interne CA"; exit 1; }
grep -q '^V.*\*.primjer-firma.ba' index.txt || { echo "Certifikat nije zabilježen u index.txt (koristi openssl ca)"; exit 1; }
-->
<!-- solution
cd /root/pki && openssl ca -batch -config ca.cnf -in wildcard.csr -out wildcard.crt 2>/dev/null
-->

## Opozovi certifikat i objavi CRL

Developer je slučajno commitao `wildcard.key` u javni repozitorij. Ključ je kompromitovan, pa certifikat odmah mora biti opozvan, iako važi još 90 dana. Kod wildcard certifikata to pogađa **sve** poddomene odjednom: to je cijena praktičnosti.

```bash
cd /root/pki
openssl ca -config ca.cnf -revoke wildcard.crt -crl_reason keyCompromise
openssl ca -config ca.cnf -gencrl -out interna.crl
openssl crl -in interna.crl -noout -text | head -20
cat index.txt
```

Provjeri certifikat **sa** provjerom CRL-a:

```bash
cat ca.crt interna.crl > ca-i-crl.pem
openssl verify -crl_check -CAfile ca-i-crl.pem wildcard.crt
```

<!-- verify
cd /root/pki
grep -q '^R.*keyCompromise' index.txt || { echo "Certifikat nije opozvan sa razlogom keyCompromise"; exit 1; }
[ -f interna.crl ] || { echo "Nema interna.crl"; exit 1; }
s=$(openssl x509 -in wildcard.crt -noout -serial | cut -d= -f2)
openssl crl -in interna.crl -noout -text | grep -q "Serial Number: $s" || { echo "Serijski broj $s nije u CRL-u (generiši CRL nakon opoziva)"; exit 1; }
cat ca.crt interna.crl > /tmp/chk.pem
openssl verify -crl_check -CAfile /tmp/chk.pem wildcard.crt 2>&1 | grep -q 'certificate revoked' || { echo "Provjera sa CRL-om ne javlja opoziv"; exit 1; }
-->
<!-- solution
cd /root/pki
openssl ca -config ca.cnf -revoke wildcard.crt -crl_reason keyCompromise 2>/dev/null
openssl ca -config ca.cnf -gencrl -out interna.crl 2>/dev/null
-->

## Provjeri opoziv preko OCSP-a

CRL je lista koju klijent mora preuzeti cijelu i koja se osvježava periodično (ovdje svakih 7 dana). **OCSP** odgovara na pitanje za **jedan** certifikat, u realnom vremenu. Pokreni mali OCSP responder nad bazom CA:

```bash
cd /root/pki
nohup openssl ocsp -index index.txt -port 8888 -rsigner ca.crt -rkey ca.key -CA ca.crt -ignore_err >/tmp/ocsp.log 2>&1 &
sleep 1
openssl ocsp -issuer ca.crt -cert wildcard.crt -url http://127.0.0.1:8888 -CAfile ca.crt
```

Upiši status certifikata koji je OCSP vratio (jedna riječ) u `/root/pki/ocsp-status.txt`.

> **OCSP stapling**: server sam periodično dobija potpisan OCSP odgovor i šalje ga klijentu u TLS handshakeu. Klijent tako ne mora kontaktirati CA, što je brže i čuva privatnost korisnika.

<!-- verify
grep -qix 'revoked' /root/pki/ocsp-status.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/pki/ocsp-status.txt 2>/dev/null)"; exit 1; }
cd /root/pki && openssl ocsp -issuer ca.crt -cert wildcard.crt -url http://127.0.0.1:8888 -CAfile ca.crt 2>/dev/null | grep -q 'wildcard.crt: revoked' || { echo "OCSP responder ne radi na portu 8888"; exit 1; }
-->
<!-- solution
cd /root/pki
(nohup openssl ocsp -index index.txt -port 8888 -rsigner ca.crt -rkey ca.key -CA ca.crt -ignore_err >/tmp/ocsp.log 2>&1 &)
sleep 1
echo revoked > /root/pki/ocsp-status.txt
-->
