# Lab 2: Inspecting JWT tokens

An API has received several tokens. Your task is to inspect them the way a server would: decode them, check the algorithm, expiry and signature, and decide which ones must be rejected.

The tokens are in `/root/tokeni/` ("tokeni" = tokens), and the server's shared HMAC secret is in `/root/tokeni/secret.txt`.

<!-- setup
set -e
mkdir -p /root/tokeni && cd /root/tokeni
python3 - <<'PY'
import base64, hmac, hashlib, json, time
def b64(d): return base64.urlsafe_b64encode(d).rstrip(b'=').decode()
secret = b'kurs-lab-tajna-2026'
open('secret.txt','wb').write(secret)
now = int(time.time())
def sign(h, p, key=secret):
    hp = b64(json.dumps(h, separators=(',',':')).encode()) + '.' + b64(json.dumps(p, separators=(',',':')).encode())
    if h['alg'] == 'none': return hp + '.'
    return hp + '.' + b64(hmac.new(key, hp.encode(), hashlib.sha256).digest())
base = {'iss':'https://idp.lab.local','aud':'orders-api'}
open('t1.jwt','w').write(sign({'alg':'HS256','typ':'JWT'}, {**base,'sub':'ana','role':'user','iat':now,'exp':now+3600}))
open('t2.jwt','w').write(sign({'alg':'none','typ':'JWT'}, {**base,'sub':'ana','role':'admin','iat':now,'exp':now+3600}))
open('t3.jwt','w').write(sign({'alg':'HS256','typ':'JWT'}, {**base,'sub':'marko','role':'user','iat':now-90000,'exp':now-86400}))
open('t4.jwt','w').write(sign({'alg':'HS256','typ':'JWT'}, {**base,'sub':'ana','role':'admin','iat':now,'exp':now+3600}, key=b'pogresna-tajna'))
PY
cat > /usr/local/bin/b64d <<'EOF'
#!/bin/bash
# dekodira base64url (JWT dio) sa stdin-a
s=$(cat | tr '_-' '/+'); while [ $(( ${#s} % 4 )) -ne 0 ]; do s="$s="; done; echo "$s" | base64 -d 2>/dev/null; echo
EOF
chmod 755 /usr/local/bin/b64d
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Pregled JWT tokena ===
Tokeni: /root/tokeni/t1.jwt .. t4.jwt   Pomoćni alat: b64d (dekodira base64url)
EOF
-->

## Decode the tokens

A JWT is three base64url parts separated by dots. Decode the header and payload of each token:

```bash
cd /root/tokeni
for t in t1 t2 t3 t4; do
  echo "== $t"
  cut -d. -f1 $t.jwt | b64d
  cut -d. -f2 $t.jwt | b64d
done
```

Notice that reading them required no secret at all. **The payload is not encrypted**, so confidential data doesn't belong in a token.

## Check the expiry

The `exp` field is Unix time. Compare it with the current time:

```bash
date +%s
for t in t1 t2 t3 t4; do echo "$t exp=$(cut -d. -f2 /root/tokeni/$t.jwt | b64d | jq .exp)"; done
```

Which token has expired?

## Verify the signature

For HS256 the signature is HMAC-SHA256 over `header.payload` with the shared secret. Compute it yourself and compare it with the third part of the token:

```bash
cd /root/tokeni
for t in t1 t3 t4; do
  hp=$(cut -d. -f1,2 $t.jwt)
  sig=$(cut -d. -f3 $t.jwt)
  calc=$(printf '%s' "$hp" | openssl dgst -sha256 -hmac "$(cat secret.txt)" -binary | base64 | tr '+/' '-_' | tr -d '=')
  [ "$sig" = "$calc" ] && echo "$t: signature VALID" || echo "$t: signature INVALID"
done
```

Also look at `t2`: which algorithm does its header say, and does it have a signature at all?

## Decision: which tokens must the server reject

Write the names of the tokens the server must reject (e.g. `t9`), one per line, to `/root/odbij.txt` ("odbij" = reject). A valid token must not be on the list.

Rejection reasons you've seen:

- `alg: none`: a token without a signature. The library must have an **allowlist of algorithms** and must never trust the `alg` field from the token itself.
- an expired `exp`
- the signature doesn't match the secret: the token is forged or was issued by someone else

<!-- verify
f=/root/odbij.txt
[ -s $f ] || { echo "The file /root/odbij.txt is empty"; exit 1; }
for t in t2 t3 t4; do grep -qw $t $f || { echo "A token that should be rejected is missing"; exit 1; }; done
grep -qw t1 $f && { echo "t1 is a valid token: it shouldn't be rejected"; exit 1; }
exit 0
-->
<!-- hint
One token is valid: HS256, correct signature, valid `exp`. The other three each have one problem: no signature, expired, wrong signature.
-->
<!-- solution
printf 't2\nt3\nt4\n' > /root/odbij.txt
-->
