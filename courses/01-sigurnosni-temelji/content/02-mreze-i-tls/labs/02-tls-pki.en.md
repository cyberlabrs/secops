# Lab 2: Your own PKI and TLS with openssl

You'll build a small PKI: a root CA, a server certificate with a correct SAN, and a TLS server that `curl` accepts without `-k`. Finally, you'll find a certificate that is about to expire, a task that comes up constantly in practice.

Work in the `/root/pki` directory.

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

## Create a root CA

A root CA is a self-signed certificate with `CA:TRUE`. We use an EC key (P-256): it is smaller and faster than RSA, and equally secure.

```bash
cd /root/pki
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Lab Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl x509 -in ca.crt -noout -subject -issuer -ext basicConstraints
chmod 600 ca.key
```

Subject and issuer are the same, because the certificate is self-signed.

<!-- verify
cd /root/pki || exit 1
[ -f ca.crt ] && [ -f ca.key ] || { echo "ca.crt or ca.key is missing in /root/pki"; exit 1; }
openssl x509 -in ca.crt -noout -ext basicConstraints 2>/dev/null | grep -q 'CA:TRUE' || { echo "ca.crt doesn't have CA:TRUE"; exit 1; }
[ "$(stat -c %a ca.key)" = 600 ] || { echo "ca.key needs permissions 600"; exit 1; }
-->
<!-- solution
cd /root/pki
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout ca.key -out ca.crt -days 3650 -subj "/CN=Kurs Lab Root CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
chmod 600 ca.key
-->

## Issue a server certificate

Create a key and a CSR (certificate signing request) for `app.lab.local`, then sign it with your CA. The most important part is the **SAN**: without it, clients reject the certificate regardless of the CN.

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

The 90-day validity is not accidental: short lifetimes and automatic renewal are today's standard.

<!-- verify
cd /root/pki || exit 1
openssl verify -CAfile ca.crt server.crt 2>&1 | grep -q 'server.crt: OK' || { echo "server.crt is not signed by your CA"; exit 1; }
openssl x509 -in server.crt -noout -ext subjectAltName 2>/dev/null | grep -q 'DNS:app.lab.local' || { echo "The SAN doesn't contain DNS:app.lab.local"; exit 1; }
openssl x509 -in server.crt -noout -ext basicConstraints 2>/dev/null | grep -q 'CA:TRUE' && { echo "The server certificate must not be a CA"; exit 1; }
exit 0
-->
<!-- hint
If `openssl verify` reports an error, check that you signed with `-CA ca.crt -CAkey ca.key` instead of creating a new self-signed certificate.
-->
<!-- solution
cd /root/pki
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout server.key -out server.csr -subj "/CN=app.lab.local" 2>/dev/null
printf 'basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:app.lab.local,DNS:localhost,IP:127.0.0.1\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 90 -extfile server.ext 2>/dev/null
-->

## Start a TLS server and connect without -k

Start a simple TLS server with only TLS 1.2 and 1.3:

```bash
cd /root/pki
nohup openssl s_server -accept 8443 -cert server.crt -key server.key -www -no_tls1 -no_tls1_1 >/tmp/s_server.log 2>&1 &
sleep 1
curl --cacert ca.crt --resolve app.lab.local:8443:127.0.0.1 https://app.lab.local:8443/ | head -5
```

`--cacert` tells curl to trust your CA. `--resolve` maps the name to an IP without DNS. Also try it without `--cacert` to see the error a client that doesn't trust your CA would get.

See what was negotiated:

```bash
openssl s_client -connect 127.0.0.1:8443 -servername app.lab.local -CAfile ca.crt </dev/null 2>/dev/null | grep -E 'Protocol|Cipher|Verify return'
```

<!-- verify
curl -s --max-time 5 --cacert /root/pki/ca.crt --resolve app.lab.local:8443:127.0.0.1 https://app.lab.local:8443/ >/dev/null || { echo "curl can't connect with certificate verification"; exit 1; }
-->
<!-- solution
cd /root/pki && (nohup openssl s_server -accept 8443 -cert server.crt -key server.key -www -no_tls1 -no_tls1_1 >/tmp/s_server.log 2>&1 &) ; sleep 1
-->

## Find the certificate that expires soon

`/etc/ssl/app/` contains three production certificates. One expires in less than 30 days. Find it and write its file name (e.g. `xyz.pem`) to `/root/istice.txt` ("istice" = expires).

```bash
for f in /etc/ssl/app/*.pem; do
  echo "$f: $(openssl x509 -in $f -noout -enddate)"
  openssl x509 -in $f -noout -checkend $((30*24*3600)) >/dev/null || echo "  ^ EXPIRES IN LESS THAN 30 DAYS"
done
```

`-checkend N` returns an error if the certificate expires within the next N seconds. A loop like this in cron or monitoring prevents outages caused by expired certificates.

<!-- verify
grep -qx 'billing.pem' /root/istice.txt 2>/dev/null || grep -q '^/etc/ssl/app/billing.pem$' /root/istice.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/istice.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo billing.pem > /root/istice.txt
-->
