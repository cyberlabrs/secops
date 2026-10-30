# Lab 1: CSR, wildcard certificate, revocation (CRL and OCSP)

The company runs an internal certificate authority (CA). You'll create a **CSR** for a **wildcard** certificate, issue it, then **revoke** it because of a compromised key and verify the revocation in both ways the exam asks about: **CRL** and **OCSP**.

The CA is already prepared in `/root/pki` (key, certificate, and the `ca.cnf` configuration with the issued-certificate database `index.txt`).

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

## Create a CSR for the wildcard

A CSR (*certificate signing request*) contains the **public** key and the subject details, signed with the private key. The private key never leaves the server that created it.

The wildcard `*.primjer-firma.ba` covers `www.primjer-firma.ba` and `api.primjer-firma.ba`, but **not** `primjer-firma.ba` itself or `a.b.primjer-firma.ba`. That's why the apex domain is added as a separate SAN.

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
openssl req -in wildcard.csr -noout -verify 2>&1 | grep -qiE 'verify OK|Certificate request self-signature verify OK' || { echo "wildcard.csr does not exist or its signature is invalid"; exit 1; }
san=$(openssl req -in wildcard.csr -noout -text | grep -A1 'Alternative' | tail -1)
echo "$san" | grep -q 'DNS:\*.primjer-firma.ba' || { echo "SAN is missing DNS:*.primjer-firma.ba"; exit 1; }
echo "$san" | grep -qE 'DNS:primjer-firma.ba(,|$)' || { echo "SAN is missing the apex domain primjer-firma.ba"; exit 1; }
-->
<!-- solution
cd /root/pki
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout wildcard.key -out wildcard.csr -subj "/CN=*.primjer-firma.ba/O=Primjer Firma" -addext "subjectAltName=DNS:*.primjer-firma.ba,DNS:primjer-firma.ba" 2>/dev/null
chmod 600 wildcard.key
-->

## Issue the certificate

The CA signs the CSR. `copy_extensions = copy` in `ca.cnf` carries the SAN over from the CSR. At a real CA, someone would first verify that the applicant actually controls the domain.

```bash
cd /root/pki
openssl ca -batch -config ca.cnf -in wildcard.csr -out wildcard.crt
openssl verify -CAfile ca.crt wildcard.crt
openssl x509 -in wildcard.crt -noout -serial -enddate -ext subjectAltName,authorityInfoAccess,crlDistributionPoints
cat index.txt
```

The certificate contains the addresses where a client checks revocation: **CRL Distribution Points** and **OCSP** in the Authority Information Access field. `index.txt` now has a line starting with `V` (valid).

<!-- verify
cd /root/pki
openssl verify -CAfile ca.crt wildcard.crt 2>&1 | grep -q 'wildcard.crt: OK' || { echo "wildcard.crt was not issued by the internal CA"; exit 1; }
grep -q '^V.*\*.primjer-firma.ba' index.txt || { echo "The certificate is not recorded in index.txt (use openssl ca)"; exit 1; }
-->
<!-- solution
cd /root/pki && openssl ca -batch -config ca.cnf -in wildcard.csr -out wildcard.crt 2>/dev/null
-->

## Revoke the certificate and publish a CRL

A developer accidentally committed `wildcard.key` to a public repository. The key is compromised, so the certificate must be revoked immediately, even though it's valid for another 90 days. With a wildcard certificate this affects **all** subdomains at once: that's the price of convenience.

```bash
cd /root/pki
openssl ca -config ca.cnf -revoke wildcard.crt -crl_reason keyCompromise
openssl ca -config ca.cnf -gencrl -out interna.crl
openssl crl -in interna.crl -noout -text | head -20
cat index.txt
```

Verify the certificate **with** CRL checking:

```bash
cat ca.crt interna.crl > ca-i-crl.pem
openssl verify -crl_check -CAfile ca-i-crl.pem wildcard.crt
```

<!-- verify
cd /root/pki
grep -q '^R.*keyCompromise' index.txt || { echo "The certificate was not revoked with the keyCompromise reason"; exit 1; }
[ -f interna.crl ] || { echo "interna.crl is missing"; exit 1; }
s=$(openssl x509 -in wildcard.crt -noout -serial | cut -d= -f2)
openssl crl -in interna.crl -noout -text | grep -q "Serial Number: $s" || { echo "Serial number $s is not in the CRL (generate the CRL after revoking)"; exit 1; }
cat ca.crt interna.crl > /tmp/chk.pem
openssl verify -crl_check -CAfile /tmp/chk.pem wildcard.crt 2>&1 | grep -q 'certificate revoked' || { echo "Verification with the CRL does not report the revocation"; exit 1; }
-->
<!-- solution
cd /root/pki
openssl ca -config ca.cnf -revoke wildcard.crt -crl_reason keyCompromise 2>/dev/null
openssl ca -config ca.cnf -gencrl -out interna.crl 2>/dev/null
-->

## Check revocation via OCSP

A CRL is a list the client must download in full and that is refreshed periodically (here every 7 days). **OCSP** answers the question for **one** certificate, in real time. Start a small OCSP responder on top of the CA database:

```bash
cd /root/pki
nohup openssl ocsp -index index.txt -port 8888 -rsigner ca.crt -rkey ca.key -CA ca.crt -ignore_err >/tmp/ocsp.log 2>&1 &
sleep 1
openssl ocsp -issuer ca.crt -cert wildcard.crt -url http://127.0.0.1:8888 -CAfile ca.crt
```

Write the certificate status that OCSP returned (one word, exactly as printed) into `/root/pki/ocsp-status.txt`.

> **OCSP stapling**: the server itself periodically obtains a signed OCSP response and sends it to the client in the TLS handshake. The client doesn't have to contact the CA, which is faster and protects the user's privacy.

<!-- verify
grep -qix 'revoked' /root/pki/ocsp-status.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/pki/ocsp-status.txt 2>/dev/null)"; exit 1; }
cd /root/pki && openssl ocsp -issuer ca.crt -cert wildcard.crt -url http://127.0.0.1:8888 -CAfile ca.crt 2>/dev/null | grep -q 'wildcard.crt: revoked' || { echo "The OCSP responder is not running on port 8888"; exit 1; }
-->
<!-- solution
cd /root/pki
(nohup openssl ocsp -index index.txt -port 8888 -rsigner ca.crt -rkey ca.key -CA ca.crt -ignore_err >/tmp/ocsp.log 2>&1 &)
sleep 1
echo revoked > /root/pki/ocsp-status.txt
-->
