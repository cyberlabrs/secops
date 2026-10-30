# Lab 2: Email protection with SPF, DKIM, and DMARC

The company `primjer-firma.ba` is receiving reports that someone is sending fake invoices in its name (**BEC**). You'll review the headers of received messages and then fix the domain's DNS records so that fake messages get rejected.

The domain sends mail through Microsoft 365 and one of its own servers, `203.0.113.25`. The files are in `/root/email/`.

| Mechanism | What it checks | Where it lives |
|---|---|---|
| **SPF** | whether the sender's IP address is authorized for the domain (envelope from) | TXT on the domain |
| **DKIM** | a cryptographic signature over the message headers and body | TXT on `selektor._domainkey.domen` (selector._domainkey.domain) |
| **DMARC** | whether SPF or DKIM passes **and** matches the visible From domain; what to do if not | TXT on `_dmarc.domen` (_dmarc.domain) |
| **BIMI** | the brand logo next to messages that pass DMARC with a quarantine/reject policy | TXT on `default._bimi.domen` (default._bimi.domain) |

<!-- setup
set -e
mkdir -p /root/email/poruke && cd /root/email
cat > zona.txt <<'EOF'
; DNS zapisi za primjer-firma.ba (izvod)
primjer-firma.ba.            3600 IN TXT "v=spf1 +all"
_dmarc.primjer-firma.ba.     3600 IN TXT "v=DMARC1; p=none"
EOF
cat > poruke/1.eml <<'EOF'
Authentication-Results: mx.partner.ba;
 spf=pass smtp.mailfrom=primjer-firma.ba;
 dkim=pass header.d=primjer-firma.ba header.s=selector1;
 dmarc=pass header.from=primjer-firma.ba
From: Računovodstvo <racuni@primjer-firma.ba>
Subject: Faktura 2026-311
EOF
cat > poruke/2.eml <<'EOF'
Authentication-Results: mx.partner.ba;
 spf=pass smtp.mailfrom=primjer-firrna.ba;
 dkim=pass header.d=primjer-firrna.ba header.s=s1;
 dmarc=pass header.from=primjer-firrna.ba
From: Direktor <direktor@primjer-firrna.ba>
Subject: HITNO: promjena računa za uplatu
EOF
cat > poruke/3.eml <<'EOF'
Authentication-Results: mx.partner.ba;
 spf=pass smtp.mailfrom=bulk-sender.example;
 dkim=none;
 dmarc=fail (p=none) header.from=primjer-firma.ba
From: Računovodstvo <racuni@primjer-firma.ba>
Subject: Nova faktura, platiti danas
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: SPF, DKIM, DMARC ===
Fajlovi: /root/email/zona.txt i /root/email/poruke/
EOF
-->

## Read the headers

```bash
cd /root/email/poruke
for f in *.eml; do echo "== $f"; cat $f; echo; done
```

For each message, look at the three results (`spf=`, `dkim=`, `dmarc=`) and the domain in the `From:` header.

- Message 3 is **spoofing** of the real domain: SPF passes, but for someone else's domain (`bulk-sender.example`), so there's no **alignment** with the From domain. DMARC therefore fails, but the `p=none` policy tells the recipient to deliver it anyway.
- Message 2 passes **all** checks. Look carefully at the domain: `primjer-firrna.ba` (`rn` instead of `m`). This is **typosquatting**: the attacker registered a look-alike domain and configured it correctly. SPF, DKIM, and DMARC don't help here; user training (objective 5.6), tagging external messages, and monitoring look-alike domains do.

In `/root/email/odgovor.txt`, write the numbers of **both** malicious messages, each on its own line.

<!-- verify
f=/root/email/odgovor.txt
got=$(grep -oE '[0-9]+' $f 2>/dev/null | sort -u | xargs)
[ "$got" = "2 3" ] || { echo "Got: $got"; exit 1; }
-->
<!-- solution
printf '2\n3\n' > /root/email/odgovor.txt
-->

## Fix SPF

The current record `v=spf1 +all` means "**anyone** may send mail in our name," which is worse than having no SPF record at all. In `zona.txt`, replace it with a record that allows only:

- Microsoft 365: `include:spf.protection.outlook.com`
- your own server: `ip4:203.0.113.25`

and ends with `-all` (**hard fail**: reject everything else). `~all` is a *soft fail* and is used only during a transition period.

```bash
nano /root/email/zona.txt
grep spf1 /root/email/zona.txt
```

<!-- verify
spf=$(grep -o '"v=spf1[^"]*"' /root/email/zona.txt | tr -d '"')
[ -n "$spf" ] || { echo "No SPF record"; exit 1; }
echo "$spf" | grep -q '+all' && { echo "SPF still contains +all"; exit 1; }
echo "$spf" | grep -q 'include:spf.protection.outlook.com' || { echo "The include for Microsoft 365 is missing"; exit 1; }
echo "$spf" | grep -q 'ip4:203.0.113.25' || { echo "ip4:203.0.113.25 is missing"; exit 1; }
echo "$spf" | grep -qE ' -all$' || { echo "SPF does not end with -all"; exit 1; }
[ $(grep -c 'v=spf1' /root/email/zona.txt) -eq 1 ] || { echo "A domain may have only ONE SPF record"; exit 1; }
-->
<!-- solution
sed -i 's|"v=spf1 +all"|"v=spf1 ip4:203.0.113.25 include:spf.protection.outlook.com -all"|' /root/email/zona.txt
-->

## Publish the DKIM key

Generate a 2048-bit RSA key pair for the DKIM selector `s2026`. The private key stays on the mail server, and the public key is published in DNS.

```bash
cd /root/email
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out dkim-s2026.key
chmod 600 dkim-s2026.key
P=$(openssl pkey -in dkim-s2026.key -pubout | grep -v '^-----' | tr -d '\n')
echo "s2026._domainkey.primjer-firma.ba. 3600 IN TXT \"v=DKIM1; k=rsa; p=$P\"" >> zona.txt
tail -1 zona.txt | cut -c1-120
```

From the `DKIM-Signature` header, the recipient reads the domain (`d=`) and the selector (`s=`), fetches the public key from DNS, and verifies the signature.

<!-- verify
cd /root/email
[ -f dkim-s2026.key ] || { echo "dkim-s2026.key is missing"; exit 1; }
rec=$(grep '^s2026._domainkey.primjer-firma.ba' zona.txt | grep -o 'p=[A-Za-z0-9+/=]*' | cut -c3-)
[ -n "$rec" ] || { echo "No DKIM record for selector s2026"; exit 1; }
want=$(openssl pkey -in dkim-s2026.key -pubout | grep -v '^-----' | tr -d '\n')
[ "$rec" = "$want" ] || { echo "The public key in the DNS record does not match the private key"; exit 1; }
openssl pkey -in dkim-s2026.key -noout -text 2>/dev/null | grep -q '2048 bit' || { echo "The key is not 2048 bits"; exit 1; }
-->
<!-- solution
cd /root/email
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out dkim-s2026.key 2>/dev/null && chmod 600 dkim-s2026.key
P=$(openssl pkey -in dkim-s2026.key -pubout | grep -v '^-----' | tr -d '\n')
echo "s2026._domainkey.primjer-firma.ba. 3600 IN TXT \"v=DKIM1; k=rsa; p=$P\"" >> zona.txt
-->

## DMARC: from monitoring to rejection

`p=none` only monitors and blocks nothing. That's why message 3 was delivered. Change the DMARC record so that:

- the policy is `p=reject`,
- aggregate reports go to `rua=mailto:dmarc@primjer-firma.ba`.

In practice you go step by step: `none` (collect reports and find all legitimate senders), then `quarantine` (spam folder), then `reject`. **BIMI** can only be introduced once you're at `quarantine` or `reject`.

<!-- verify
d=$(grep '^_dmarc.primjer-firma.ba' /root/email/zona.txt | grep -o '"v=DMARC1[^"]*"')
[ -n "$d" ] || { echo "No DMARC record"; exit 1; }
echo "$d" | grep -qE 'p=reject' || { echo "The policy is not p=reject"; exit 1; }
echo "$d" | grep -q 'rua=mailto:dmarc@primjer-firma.ba' || { echo "rua=mailto:dmarc@primjer-firma.ba is missing"; exit 1; }
-->
<!-- solution
sed -i 's|"v=DMARC1; p=none"|"v=DMARC1; p=reject; rua=mailto:dmarc@primjer-firma.ba"|' /root/email/zona.txt
-->
