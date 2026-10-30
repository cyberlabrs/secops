# Lab 1: VPC Flow Logs and Route 53 Resolver logs

GuardDuty was not enabled in this account (that is the first audit finding), so you do the analysis manually over raw logs. `/root/logs/` contains VPC Flow Logs (default version 2 format) and Route 53 Resolver query logs for VPC `10.0.0.0/16` over the last few hours.

Find four things GuardDuty would have reported: **port scanning**, **data exfiltration**, **crypto mining**, and **DNS tunneling**.

Default Flow Log record format (v2):

```text
version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes start end action log-status
```

`protocol` is the IANA number (6 = TCP, 17 = UDP), and `action` is `ACCEPT` or `REJECT` (the security group or NACL decision).

<!-- setup
set -e
mkdir -p /root/logs /root/nalazi
python3 - <<'PY'
import random, json, datetime
random.seed(42)
ACC = "111122223333"
t0 = 1792000000
lines = []
def fl(eni, s, d, sp, dp, proto, pk, by, act, t):
    lines.append((t, f"2 {ACC} {eni} {s} {d} {sp} {dp} {proto} {pk} {by} {t} {t+60} {act} OK"))
internal = [f"10.0.{a}.{b}" for a in (1, 2, 3, 4) for b in range(10, 30)]
for i in range(1500):
    t = t0 + random.randint(0, 14000)
    s = random.choice(internal); d = random.choice(internal + ["52.94.133.131", "3.5.140.2", "18.192.0.10"])
    dp = random.choice([443, 443, 443, 5432, 6379, 53, 8080])
    fl("eni-0a1b2c3d4e5f60001", s, d, random.randint(32768, 60999), dp, 6 if dp != 53 else 17, random.randint(3, 80), random.randint(200, 90000), "ACCEPT", t)
# skeniranje portova iz kompromitovane instance
for p in list(range(1, 1025, 3)) + [3306, 5432, 6379, 8080, 9200, 27017]:
    t = t0 + 5000 + p
    tgt = random.choice(["10.0.1.11", "10.0.1.12", "10.0.1.13"])
    fl("eni-0a1b2c3d4e5f60023", "10.0.4.23", tgt, 51515, p, 6, 1, 44, "REJECT" if p not in (443, 5432) else "ACCEPT", t)
# exfil: velike količine podataka prema jednoj vanjskoj adresi
for i in range(40):
    fl("eni-0a1b2c3d4e5f60015", "10.0.2.15", "198.51.100.200", 49152 + i, 443, 6, 9000, 12_500_000, "ACCEPT", t0 + 9000 + i * 30)
# kripto rudarenje: stratum protokol na portu 3333
for i in range(60):
    fl("eni-0a1b2c3d4e5f60044", "10.0.3.44", "203.0.113.99", 40000 + i, 3333, 6, 40, 3200, "ACCEPT", t0 + 1000 + i * 200)
lines.sort()
open("/root/logs/vpc-flow.log", "w").write("\n".join(l for _, l in lines) + "\n")

# Route 53 Resolver query logs (JSON lines)
q = []
base = datetime.datetime(2026, 10, 14, 6, 0, 0)
normal = ["api.primjer-firma.ba", "s3.eu-central-1.amazonaws.com", "sts.eu-central-1.amazonaws.com", "github.com",
          "registry.npmjs.org", "db.internal.primjer-firma.ba", "pypi.org", "logs.eu-central-1.amazonaws.com"]
def rq(t, src, name, typ="A", rcode="NOERROR"):
    q.append({"version": "1.100000", "account_id": ACC, "region": "eu-central-1", "vpc_id": "vpc-0abc1234def567890",
              "query_timestamp": (base + datetime.timedelta(seconds=t)).strftime("%Y-%m-%dT%H:%M:%SZ"),
              "query_name": name + ".", "query_type": typ, "query_class": "IN", "rcode": rcode, "answers": [],
              "srcaddr": src, "srcport": str(random.randint(30000, 60000)), "transport": "UDP",
              "srcids": {"instance": "i-0" + "%016x" % random.getrandbits(64)}})
for i in range(800):
    rq(random.randint(0, 14000), random.choice(internal), random.choice(normal))
alphabet = "abcdefghijklmnopqrstuvwxyz234567"
for i in range(150):
    label = "".join(random.choice(alphabet) for _ in range(random.randint(40, 60)))
    rq(3000 + i * 20, "10.0.1.27", f"{label}.t.cdn-sync-update.com", typ="TXT")
for i in range(5):
    rq(random.randint(0, 14000), "10.0.2.12", "cdn-sync-update.com")
q.sort(key=lambda x: x["query_timestamp"])
open("/root/logs/resolver-query.log", "w").write("\n".join(json.dumps(x) for x in q) + "\n")
PY
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: VPC Flow Logs i Resolver logovi ===
Logovi: /root/logs/   Nalazi: /root/nalazi/
EOF
-->

## Get to know the data

```bash
cd /root/logs
head -3 vpc-flow.log
wc -l vpc-flow.log resolver-query.log
awk '{print $13}' vpc-flow.log | sort | uniq -c
head -1 resolver-query.log | jq .
```

Fields are separated by spaces, so `awk '{print $4}'` gives `srcaddr`, `$5` `dstaddr`, `$7` `dstport`, `$10` `bytes`, and `$13` `action`.

In AWS you would read these logs with **Athena** (a table over S3), with **CloudWatch Logs Insights**, or through **Security Lake** in OCSF format. For example, in Logs Insights:

```text
fields srcAddr, dstPort
| filter action = "REJECT"
| stats count_distinct(dstPort) as ports by srcAddr
| sort ports desc
```

## Port scanning

A scanner tries many **different ports**, and most attempts are rejected. Count the distinct destination ports with `REJECT` per source:

```bash
awk '$13 == "REJECT" {print $4, $7}' vpc-flow.log | sort -u | awk '{print $1}' | uniq -c | sort -rn | head
```

Write the IP address of the scanning instance to `/root/nalazi/scan.txt`.

<!-- verify
grep -qx '10.0.4.23' /root/nalazi/scan.txt 2>/dev/null || { echo "Incorrect or empty: $(cat /root/nalazi/scan.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo 10.0.4.23 > /root/nalazi/scan.txt
-->

## Data exfiltration

Sum the bytes sent per pair (internal source, **external** destination). Internal addresses start with `10.`, and AWS service addresses (e.g., S3) are expected, because applications write there.

```bash
awk '$5 !~ /^10\./ {b[$4" "$5] += $10} END {for (k in b) printf "%.1f MB  %s\n", b[k]/1e6, k}' vpc-flow.log | sort -rn | head -5
```

Write two lines to `/root/nalazi/exfil.txt`: the internal source IP address and the external IP address the data went to.

> The protection for a case like this is **egress control**: outbound internet traffic only through NAT and **AWS Network Firewall** with an allow list of domains, and traffic to AWS services through **VPC endpoints** with endpoint policies.

<!-- verify
f=/root/nalazi/exfil.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "10.0.2.15" ] || { echo "First line: the internal source"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "198.51.100.200" ] || { echo "Second line: the external destination"; exit 1; }
-->
<!-- solution
printf '10.0.2.15\n198.51.100.200\n' > /root/nalazi/exfil.txt
-->

## Crypto mining

Miners connect to a *mining pool* over the **stratum** protocol, most often on ports such as 3333, 4444, or 14444. The connections are long-lived, carry little data, and repeat.

```bash
awk '$7 == 3333 || $7 == 4444 || $7 == 14444 {print $4, $5, $7}' vpc-flow.log | sort | uniq -c
```

Write the internal IP address of the mining instance to `/root/nalazi/mining.txt`. GuardDuty would report this as `CryptoCurrency:EC2/BitcoinTool.B` (via the pool's IP address or DNS name).

<!-- verify
grep -qx '10.0.3.44' /root/nalazi/mining.txt 2>/dev/null || { echo "Incorrect or empty"; exit 1; }
-->
<!-- solution
echo 10.0.3.44 > /root/nalazi/mining.txt
-->

## DNS tunneling

VPC Flow Logs do not record traffic to the Route 53 Resolver at the VPC+2 address. That is why **Resolver query logs** are the only source for DNS attacks. Tunneling shows up as many queries with long, random subdomains to a single domain, often of type `TXT`.

```bash
jq -r '.query_name' resolver-query.log | awk -F. '{print $(NF-2)"."$(NF-1)}' | sort | uniq -c | sort -rn | head
jq -r 'select(.query_type == "TXT") | [.srcaddr, .query_name] | @tsv' resolver-query.log | head -3
jq -r 'select(.query_name | test("cdn-sync-update")) | .query_name | length' resolver-query.log | sort -n | tail -3
```

Write two lines to `/root/nalazi/dns.txt`: the attacker's domain (e.g., `example.com`) and the IP address of the tunneling instance.

> Protection: **Route 53 Resolver DNS Firewall** with managed lists and domain blocking, centrally through **Firewall Manager**. GuardDuty analyzes DNS logs automatically, without enabling Resolver query logs separately.

<!-- verify
f=/root/nalazi/dns.txt
sed -n 1p $f 2>/dev/null | grep -qx 'cdn-sync-update.com\.\?' || { echo "First line: the attacker's domain"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "10.0.1.27" ] || { echo "Second line: the IP of the tunneling instance"; exit 1; }
-->
<!-- hint
Two sources query `cdn-sync-update.com`. One made a couple of ordinary `A` queries, and the other made 150 `TXT` queries with random subdomains. The second one is tunneling.
-->
<!-- solution
printf 'cdn-sync-update.com\n10.0.1.27\n' > /root/nalazi/dns.txt
-->
