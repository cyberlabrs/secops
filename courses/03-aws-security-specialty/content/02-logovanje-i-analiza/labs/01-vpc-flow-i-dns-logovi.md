# Lab 1: VPC Flow Logs i Route 53 Resolver logovi

GuardDuty u ovom nalogu nije bio uključen (to je prvi nalaz revizije), pa analizu radiš ručno nad sirovim logovima. U `/root/logs/` su VPC Flow Logs (podrazumijevani format verzije 2) i Route 53 Resolver query logovi za VPC `10.0.0.0/16` u posljednjih nekoliko sati.

Pronađi četiri stvari koje bi GuardDuty prijavio: **skeniranje portova**, **izvlačenje podataka** (*exfiltration*), **kripto rudarenje** i **DNS tunelovanje**.

Podrazumijevani format Flow Log zapisa (v2):

```text
version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes start end action log-status
```

`protocol` je IANA broj (6 = TCP, 17 = UDP), a `action` je `ACCEPT` ili `REJECT` (odluka security grupe ili NACL-a).

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

## Upoznaj podatke

```bash
cd /root/logs
head -3 vpc-flow.log
wc -l vpc-flow.log resolver-query.log
awk '{print $13}' vpc-flow.log | sort | uniq -c
head -1 resolver-query.log | jq .
```

Polja su razdvojena razmakom, pa `awk '{print $4}'` daje `srcaddr`, `$5` `dstaddr`, `$7` `dstport`, `$10` `bytes`, a `$13` `action`.

U AWS-u bi ove logove čitao **Athena**-om (tabela nad S3), **CloudWatch Logs Insights**-om ili kroz **Security Lake** u OCSF formatu. Na primjer, u Logs Insights:

```text
fields srcAddr, dstPort
| filter action = "REJECT"
| stats count_distinct(dstPort) as portovi by srcAddr
| sort portovi desc
```

## Skeniranje portova

Skener pokušava mnogo **različitih portova**, a većina pokušaja je odbijena. Prebroj različite odredišne portove sa `REJECT` po izvoru:

```bash
awk '$13 == "REJECT" {print $4, $7}' vpc-flow.log | sort -u | awk '{print $1}' | uniq -c | sort -rn | head
```

U `/root/nalazi/scan.txt` upiši IP adresu instance koja skenira.

<!-- verify
grep -qx '10.0.4.23' /root/nalazi/scan.txt 2>/dev/null || { echo "Netačno ili prazno: $(cat /root/nalazi/scan.txt 2>/dev/null)"; exit 1; }
-->
<!-- solution
echo 10.0.4.23 > /root/nalazi/scan.txt
-->

## Izvlačenje podataka

Saberi poslane bajtove po paru (interni izvor, **vanjsko** odredište). Interne adrese počinju sa `10.`, a AWS servisne adrese (npr. S3) su očekivane, jer aplikacije tamo pišu.

```bash
awk '$5 !~ /^10\./ {b[$4" "$5] += $10} END {for (k in b) printf "%.1f MB  %s\n", b[k]/1e6, k}' vpc-flow.log | sort -rn | head -5
```

U `/root/nalazi/exfil.txt` upiši dvije linije: internu IP adresu izvora i vanjsku IP adresu na koju su podaci otišli.

> Za ovakav slučaj zaštita je **egress kontrola**: izlaz prema internetu samo kroz NAT i **AWS Network Firewall** sa listom dozvoljenih domena, a prema AWS servisima kroz **VPC endpoint**e sa endpoint politikama.

<!-- verify
f=/root/nalazi/exfil.txt
[ "$(sed -n 1p $f 2>/dev/null | xargs)" = "10.0.2.15" ] || { echo "Prva linija: interni izvor"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "198.51.100.200" ] || { echo "Druga linija: vanjsko odredište"; exit 1; }
-->
<!-- solution
printf '10.0.2.15\n198.51.100.200\n' > /root/nalazi/exfil.txt
-->

## Kripto rudarenje

Rudari se spajaju na *mining pool* preko **stratum** protokola, najčešće na portovima kao što su 3333, 4444 ili 14444. Konekcije su dugotrajne, sa malo podataka i ponavljaju se.

```bash
awk '$7 == 3333 || $7 == 4444 || $7 == 14444 {print $4, $5, $7}' vpc-flow.log | sort | uniq -c
```

U `/root/nalazi/mining.txt` upiši internu IP adresu instance koja rudari. GuardDuty bi ovo prijavio kao `CryptoCurrency:EC2/BitcoinTool.B` (preko IP adrese ili DNS imena poola).

<!-- verify
grep -qx '10.0.3.44' /root/nalazi/mining.txt 2>/dev/null || { echo "Netačno ili prazno"; exit 1; }
-->
<!-- solution
echo 10.0.3.44 > /root/nalazi/mining.txt
-->

## DNS tunelovanje

VPC Flow Logs ne bilježe saobraćaj prema Route 53 Resolveru na VPC+2 adresi. Zato su **Resolver query logovi** jedini izvor za DNS napade. Tunelovanje se vidi kao mnogo upita sa dugim, nasumičnim poddomenima prema jednom domenu, često tipa `TXT`.

```bash
jq -r '.query_name' resolver-query.log | awk -F. '{print $(NF-2)"."$(NF-1)}' | sort | uniq -c | sort -rn | head
jq -r 'select(.query_type == "TXT") | [.srcaddr, .query_name] | @tsv' resolver-query.log | head -3
jq -r 'select(.query_name | test("cdn-sync-update")) | .query_name | length' resolver-query.log | sort -n | tail -3
```

U `/root/nalazi/dns.txt` upiši dvije linije: domen napadača (npr. `primjer.com`) i IP adresu instance koja tuneluje.

> Zaštita: **Route 53 Resolver DNS Firewall** sa managed listama i blokiranjem domena, centralno kroz **Firewall Manager**. GuardDuty analizira DNS logove automatski, bez posebnog uključivanja Resolver query logova.

<!-- verify
f=/root/nalazi/dns.txt
sed -n 1p $f 2>/dev/null | grep -qx 'cdn-sync-update.com\.\?' || { echo "Prva linija: domen napadača"; exit 1; }
[ "$(sed -n 2p $f | xargs)" = "10.0.1.27" ] || { echo "Druga linija: IP instance koja tuneluje"; exit 1; }
-->
<!-- hint
Dva izvora pitaju za `cdn-sync-update.com`. Jedan je postavio par običnih `A` upita, a drugi 150 `TXT` upita sa nasumičnim poddomenima. Tuneluje ovaj drugi.
-->
<!-- solution
printf 'cdn-sync-update.com\n10.0.1.27\n' > /root/nalazi/dns.txt
-->
