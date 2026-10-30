# Lab 1: Indikatori napada u logovima

SIEM je javio povećan broj neuspjelih prijava. Dobio si izvoz logova za posljednja 24 sata. Tvoj zadatak je da prepoznaš **brute force**, **password spraying**, napade na web aplikaciju i **impossible travel**, pa odgovore upišeš u `/root/odgovori/`.

Ovo je tip zadatka koji Security+ ispituje kroz cilj 2.5 (indikatori zlonamjerne aktivnosti) i 4.8 (log-parsing tehnike). Koristiš `grep`, `awk`, `sort`, `uniq` i `jq`.

Logovi su u `/var/log/lab/`.

<!-- setup
set -e
mkdir -p /var/log/lab /root/odgovori
python3 - <<'PY'
import random, json, datetime
random.seed(801)
base = datetime.datetime(2026, 10, 14, 0, 0, 0)
lines = []
def ts(sec):
    t = base + datetime.timedelta(seconds=sec)
    return t.strftime("%b %d %H:%M:%S")
users = ["ana","marko","ivana","petar","sara","nikola","jelena","dino","lejla","amir"]
# normalne prijave iz interne mreže
for i in range(40):
    s = random.randint(0, 86000)
    u = random.choice(users)
    lines.append((s, f"{ts(s)} web-01 sshd[{1000+i}]: Accepted publickey for {u} from 10.0.0.{random.randint(10,60)} port {random.randint(40000,60000)} ssh2"))
# pokoja greška korisnika
for i in range(6):
    s = random.randint(0, 86000)
    u = random.choice(users)
    lines.append((s, f"{ts(s)} web-01 sshd[{2000+i}]: Failed password for {u} from 10.0.0.{random.randint(10,60)} port {random.randint(40000,60000)} ssh2"))
# brute force na admin i root iz jedne adrese, pa uspjeh
start = 30000
for i in range(80):
    s = start + i * 3
    u = "root" if i % 3 == 0 else "admin"
    lines.append((s, f"{ts(s)} web-01 sshd[{3000+i}]: Failed password for {u} from 203.0.113.50 port {50000+i} ssh2"))
s = start + 80 * 3 + 5
lines.append((s, f"{ts(s)} web-01 sshd[3999]: Accepted password for admin from 203.0.113.50 port 51111 ssh2"))
# password spraying: mnogo korisnika, po jedan pokušaj, sporo
spray_users = users + ["it-support","backup","test","guest","hr","finance","devops","jenkins","oracle","postgres","ftp","www-data","deploy","monitor","sales"]
for i, u in enumerate(spray_users):
    s = 50000 + i * 240
    kind = "Failed password for" if u in users else "Failed password for invalid user"
    lines.append((s, f"{ts(s)} web-01 sshd[{4000+i}]: {kind} {u} from 198.51.100.23 port {52000+i} ssh2"))
lines.sort()
open("/var/log/lab/auth.log","w").write("\n".join(l for _, l in lines) + "\n")

# web access log (combined format)
web = []
paths = ["/","/login","/products","/products?id=12","/cart","/static/app.js","/api/orders","/about"]
agents = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)","Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)","Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"]
for i in range(300):
    s = random.randint(0, 86000)
    ip = f"10.20.{random.randint(1,4)}.{random.randint(2,250)}"
    t = (base + datetime.timedelta(seconds=s)).strftime("%d/%b/%Y:%H:%M:%S +0200")
    web.append((s, f'{ip} - - [{t}] "GET {random.choice(paths)} HTTP/1.1" 200 {random.randint(300,9000)} "-" "{random.choice(agents)}"'))
bad = ["/products?id=12%20UNION%20SELECT%20username,password%20FROM%20users--",
       "/products?id=12'%20OR%20'1'='1",
       "/download?file=../../../../etc/passwd",
       "/download?file=..%2F..%2F..%2F..%2Fetc%2Fshadow",
       "/products?id=12;%20DROP%20TABLE%20orders--",
       "/download?file=....//....//etc/passwd"]
for i in range(18):
    s = 60000 + i * 20
    t = (base + datetime.timedelta(seconds=s)).strftime("%d/%b/%Y:%H:%M:%S +0200")
    p = bad[i % len(bad)]
    code = 500 if "UNION" in p or "DROP" in p else 404
    web.append((s, f'192.0.2.77 - - [{t}] "GET {p} HTTP/1.1" {code} 312 "-" "sqlmap/1.8"'))
web.sort()
open("/var/log/lab/access.log","w").write("\n".join(l for _, l in web) + "\n")

# prijave u cloud IdP (JSON lines)
sign = []
cities = [("Sarajevo","BA"),("Beograd","RS"),("Zagreb","HR"),("Novi Sad","RS")]
for u in users:
    for k in range(3):
        c = random.choice(cities)
        sign.append({"user":u,"time":(base+datetime.timedelta(hours=7+k*3,minutes=random.randint(0,50))).isoformat()+"Z","city":c[0],"country":c[1],"result":"success","mfa":True})
sign.append({"user":"lejla","time":(base+datetime.timedelta(hours=8,minutes=2)).isoformat()+"Z","city":"Sarajevo","country":"BA","result":"success","mfa":True})
sign.append({"user":"lejla","time":(base+datetime.timedelta(hours=8,minutes=31)).isoformat()+"Z","city":"Singapore","country":"SG","result":"success","mfa":True})
sign.sort(key=lambda x: x["time"])
open("/var/log/lab/signins.jsonl","w").write("\n".join(json.dumps(x) for x in sign) + "\n")
PY
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Indikatori napada u logovima ===
Logovi: /var/log/lab/   Odgovori: /root/odgovori/
EOF
-->

## Upoznaj logove

```bash
cd /var/log/lab
ls -l
head -5 auth.log
head -3 access.log
head -3 signins.jsonl
wc -l *
```

Za `auth.log` (sshd) najvažnije su linije `Failed password` i `Accepted`. Za web log je bitna putanja zahtjeva, statusni kod i User-Agent.

## Brute force

Brute force je **mnogo** pokušaja iz **jednog izvora** na **mali broj naloga**. Prebroj neuspjele prijave po IP adresi:

```bash
grep 'Failed password' auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn | head
```

Upiši IP adresu napadača (samo adresu) u `/root/odgovori/bruteforce.txt`.

<!-- verify
grep -qx '203.0.113.50' /root/odgovori/bruteforce.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/odgovori/bruteforce.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
cd /var/log/lab && grep 'Failed password' auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn | head -1 | awk '{print $3}' > /root/odgovori/bruteforce.txt
-->

## Da li je napad uspio?

Najvažnije pitanje nakon brute force napada: postoji li **uspješna** prijava sa iste adrese? Ako postoji, ovo više nije pokušaj nego **incident**.

```bash
grep 'Accepted' auth.log | grep 203.0.113.50
```

Upiši **korisničko ime** kompromitovanog naloga u `/root/odgovori/kompromitovan.txt`.

> Indikator iz ciljeva ispita: niz neuspjelih prijava, pa uspješna prijava. Uz to, prijava **lozinkom** (`Accepted password`) na server gdje svi ostali koriste ključeve (`publickey`) je dodatni crveni signal.

<!-- verify
grep -qx 'admin' /root/odgovori/kompromitovan.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/odgovori/kompromitovan.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
cd /var/log/lab && grep 'Accepted' auth.log | grep 203.0.113.50 | grep -oE 'for [a-z]+' | awk '{print $2}' > /root/odgovori/kompromitovan.txt
-->

## Password spraying

Password spraying je obrnut obrazac: **jedna ili dvije česte lozinke** se probaju na **mnogo različitih naloga**, sporo, da ne bi okinulo zaključavanje naloga. Po broju pokušaja ga je teško uočiti. Treba brojati **različite korisnike** po IP adresi.

```bash
grep 'Failed password' auth.log \
  | sed -E 's/.*Failed password for (invalid user )?([^ ]+) from ([0-9.]+).*/\3 \2/' \
  | sort -u | awk '{print $1}' | uniq -c | sort -rn | head
```

U `/root/odgovori/spraying.txt` upiši dvije linije: IP adresu, a ispod nje **broj različitih korisničkih imena** koja je ta adresa probala.

<!-- verify
f=/root/odgovori/spraying.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "198.51.100.23" ] || { echo "Prva linija treba biti IP adresa"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "25" ] || { echo "Druga linija: broj različitih korisnika nije tačan"; exit 1; }
-->
<!-- hint
Brute force IP (203.0.113.50) je probao samo 2 korisnika, ali 80 puta. Spraying IP je probao mnogo korisnika, svakog jednom, sa razmakom od 4 minute.
-->
<!-- solution
printf '198.51.100.23\n25\n' > /root/odgovori/spraying.txt
-->

## Napadi na web aplikaciju

U `access.log` potraži indikatore **injection** i **directory traversal** napada: `UNION SELECT`, `' OR '1'='1`, `../`, kodirano `%2F` i sumnjiv User-Agent.

```bash
grep -iE "union|select|%27|'|\.\./|%2e%2e|%2f" access.log | head
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5
grep -c sqlmap access.log
```

U `/root/odgovori/web.txt` upiši IP adresu napadača u prvu liniju, a u drugu ime alata koji je koristio (vidi se u User-Agentu).

<!-- verify
f=/root/odgovori/web.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "192.0.2.77" ] || { echo "Prva linija treba biti IP napadača"; exit 1; }
sed -n 2p $f | grep -qi sqlmap || { echo "Druga linija: alat iz User-Agenta"; exit 1; }
-->
<!-- solution
printf '192.0.2.77\nsqlmap\n' > /root/odgovori/web.txt
-->

## Impossible travel

`signins.jsonl` su prijave u cloud IdP. **Impossible travel** je par uspješnih prijava istog korisnika sa lokacija koje su previše udaljene za vrijeme između njih (npr. Sarajevo, pa 30 minuta kasnije Singapur). Ili su kredencijali ukradeni, ili sesijski token koristi neko drugi.

```bash
jq -r '[.user, .time, .city, .country] | @tsv' signins.jsonl | sort -k1,1 -k2,2 | column -t
jq -r 'select(.country != "BA" and .country != "RS" and .country != "HR") | "\(.user) \(.time) \(.city)"' signins.jsonl
```

Primijeti da je MFA bio uspješan na obje prijave. To upućuje na krađu **sesijskog tokena** ili na MFA fatigue / AitM phishing, a ne samo na krađu lozinke.

Upiši korisničko ime u `/root/odgovori/travel.txt`.

<!-- verify
grep -qx 'lejla' /root/odgovori/travel.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/odgovori/travel.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo lejla > /root/odgovori/travel.txt
-->
