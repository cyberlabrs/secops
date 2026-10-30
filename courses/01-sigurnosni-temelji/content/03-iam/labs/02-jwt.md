# Lab 2: Pregled JWT tokena

API je dobio tri tokena. Tvoj zadatak je da ih pregledaš onako kako bi to radio server: dekodiraš ih, provjeriš algoritam, rok važenja i potpis, i odlučiš koje treba odbiti.

Tokeni su u `/root/tokeni/`, a dijeljena HMAC tajna servera je u `/root/tokeni/secret.txt`.

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

## Dekodiraj tokene

JWT su tri base64url dijela razdvojena tačkom. Dekodiraj header i payload svakog tokena:

```bash
cd /root/tokeni
for t in t1 t2 t3 t4; do
  echo "== $t"
  cut -d. -f1 $t.jwt | b64d
  cut -d. -f2 $t.jwt | b64d
done
```

Primijeti da za čitanje nije trebala nikakva tajna. **Payload nije šifrovan**, pa u token ne idu povjerljivi podaci.

## Provjeri rok važenja

Polje `exp` je Unix vrijeme. Uporedi ga sa trenutnim:

```bash
date +%s
for t in t1 t2 t3 t4; do echo "$t exp=$(cut -d. -f2 /root/tokeni/$t.jwt | b64d | jq .exp)"; done
```

Koji token je istekao?

## Provjeri potpis

Za HS256 potpis je HMAC-SHA256 nad `header.payload` sa dijeljenom tajnom. Izračunaj ga sam i uporedi sa trećim dijelom tokena:

```bash
cd /root/tokeni
for t in t1 t3 t4; do
  hp=$(cut -d. -f1,2 $t.jwt)
  sig=$(cut -d. -f3 $t.jwt)
  calc=$(printf '%s' "$hp" | openssl dgst -sha256 -hmac "$(cat secret.txt)" -binary | base64 | tr '+/' '-_' | tr -d '=')
  [ "$sig" = "$calc" ] && echo "$t: potpis ISPRAVAN" || echo "$t: potpis NEISPRAVAN"
done
```

Pogledaj i `t2`: kakav algoritam piše u headeru i ima li uopšte potpis?

## Odluka: koje tokene server mora odbiti

Upiši imena tokena koje server mora odbiti (npr. `t9`), svaki u svoj red, u `/root/odbij.txt`. Ispravan token ne smije biti na listi.

Razlozi za odbijanje koje si vidio:

- `alg: none`: token bez potpisa. Biblioteka mora imati **listu dozvoljenih algoritama** i nikad ne smije vjerovati `alg` polju iz samog tokena.
- istekao `exp`
- potpis ne odgovara tajni: token je falsifikovan ili ga je izdao neko drugi

<!-- verify
f=/root/odbij.txt
[ -s $f ] || { echo "Fajl /root/odbij.txt je prazan"; exit 1; }
for t in t2 t3 t4; do grep -qw $t $f || { echo "Nedostaje token koji treba odbiti"; exit 1; }; done
grep -qw t1 $f && { echo "t1 je ispravan token: ne treba ga odbiti"; exit 1; }
exit 0
-->
<!-- hint
Jedan token je ispravan: HS256, ispravan potpis, važeći `exp`. Ostala tri imaju po jedan problem: bez potpisa, istekao, pogrešan potpis.
-->
<!-- solution
printf 't2\nt3\nt4\n' > /root/odbij.txt
-->
