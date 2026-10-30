# Lab 1: Attack indicators in logs

The SIEM reported an increased number of failed logins. You've received a log export for the last 24 hours. Your task is to recognize **brute force**, **password spraying**, web application attacks, and **impossible travel**, and write your answers into `/root/odgovori/`.

This is the kind of task Security+ tests through objective 2.5 (indicators of malicious activity) and 4.8 (log-parsing techniques). You'll use `grep`, `awk`, `sort`, `uniq`, and `jq`.

The logs are in `/var/log/lab/`.

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

## Get to know the logs

```bash
cd /var/log/lab
ls -l
head -5 auth.log
head -3 access.log
head -3 signins.jsonl
wc -l *
```

In `auth.log` (sshd), the most important lines are `Failed password` and `Accepted`. In the web log, what matters is the request path, the status code, and the User-Agent.

## Brute force

Brute force is **many** attempts from **one source** against a **small number of accounts**. Count failed logins per IP address:

```bash
grep 'Failed password' auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn | head
```

Write the attacker's IP address (just the address) into `/root/odgovori/bruteforce.txt`.

<!-- verify
grep -qx '203.0.113.50' /root/odgovori/bruteforce.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/odgovori/bruteforce.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
cd /var/log/lab && grep 'Failed password' auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn | head -1 | awk '{print $3}' > /root/odgovori/bruteforce.txt
-->

## Did the attack succeed?

The most important question after a brute force attack: is there a **successful** login from the same address? If there is, this is no longer an attempt but an **incident**.

```bash
grep 'Accepted' auth.log | grep 203.0.113.50
```

Write the **username** of the compromised account into `/root/odgovori/kompromitovan.txt`.

> An indicator from the exam objectives: a series of failed logins, followed by a successful login. On top of that, a **password** login (`Accepted password`) on a server where everyone else uses keys (`publickey`) is an additional red flag.

<!-- verify
grep -qx 'admin' /root/odgovori/kompromitovan.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/odgovori/kompromitovan.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
cd /var/log/lab && grep 'Accepted' auth.log | grep 203.0.113.50 | grep -oE 'for [a-z]+' | awk '{print $2}' > /root/odgovori/kompromitovan.txt
-->

## Password spraying

Password spraying is the opposite pattern: **one or two common passwords** are tried against **many different accounts**, slowly, so as not to trigger account lockout. It's hard to spot by the number of attempts. You need to count **distinct users** per IP address.

```bash
grep 'Failed password' auth.log \
  | sed -E 's/.*Failed password for (invalid user )?([^ ]+) from ([0-9.]+).*/\3 \2/' \
  | sort -u | awk '{print $1}' | uniq -c | sort -rn | head
```

Write two lines into `/root/odgovori/spraying.txt`: the IP address, and below it the **number of distinct usernames** that address tried.

<!-- verify
f=/root/odgovori/spraying.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "198.51.100.23" ] || { echo "The first line should be the IP address"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "25" ] || { echo "Second line: the number of distinct users is incorrect"; exit 1; }
-->
<!-- hint
The brute force IP (203.0.113.50) tried only 2 users, but 80 times. The spraying IP tried many users, each once, 4 minutes apart.
-->
<!-- solution
printf '198.51.100.23\n25\n' > /root/odgovori/spraying.txt
-->

## Web application attacks

In `access.log`, look for indicators of **injection** and **directory traversal** attacks: `UNION SELECT`, `' OR '1'='1`, `../`, encoded `%2F`, and a suspicious User-Agent.

```bash
grep -iE "union|select|%27|'|\.\./|%2e%2e|%2f" access.log | head
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5
grep -c sqlmap access.log
```

In `/root/odgovori/web.txt`, write the attacker's IP address on the first line and the name of the tool they used (visible in the User-Agent) on the second.

<!-- verify
f=/root/odgovori/web.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "192.0.2.77" ] || { echo "The first line should be the attacker's IP"; exit 1; }
sed -n 2p $f | grep -qi sqlmap || { echo "Second line: the tool from the User-Agent"; exit 1; }
-->
<!-- solution
printf '192.0.2.77\nsqlmap\n' > /root/odgovori/web.txt
-->

## Impossible travel

`signins.jsonl` contains sign-ins to the cloud IdP. **Impossible travel** is a pair of successful sign-ins by the same user from locations that are too far apart for the time between them (e.g., Sarajevo, and 30 minutes later Singapore). Either the credentials were stolen, or someone else is using the session token.

```bash
jq -r '[.user, .time, .city, .country] | @tsv' signins.jsonl | sort -k1,1 -k2,2 | column -t
jq -r 'select(.country != "BA" and .country != "RS" and .country != "HR") | "\(.user) \(.time) \(.city)"' signins.jsonl
```

Notice that MFA succeeded on both sign-ins. That points to theft of the **session token** or to MFA fatigue / AitM phishing, not just password theft.

Write the username into `/root/odgovori/travel.txt`.

<!-- verify
grep -qx 'lejla' /root/odgovori/travel.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/odgovori/travel.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo lejla > /root/odgovori/travel.txt
-->
