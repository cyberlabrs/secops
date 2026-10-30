# Lab 1: A summary table and hunting over it

Raw logs in the **data lake** tier are cheap to store but expensive to query frequently. **Summary rules** periodically aggregate data into a smaller table (e.g. per hour), over which hunting queries run quickly and far back in time.

Here you will do manually what a summary rule does automatically: create an aggregate table, load it and write a hunting query over it.

```bash
mkdir -p /root/lake && cd /root/lake
kql -c 'SecurityEvent | summarize min(TimeGenerated), max(TimeGenerated), count()'
```

<!-- setup
set -e
mkdir -p /root/lake
-->

## Summary table

Write `/root/lake/sazetak.kql` that creates an aggregate of failed sign-ins (4625) per hour and source: columns `Sat` (hour; `bin(TimeGenerated, 1h)`), `IpAddress`, `Neuspjeha` (failures) and `Korisnika` (users; `dcount(TargetUserName)`). Save it to `/root/lake/SazetakPrijava.csv`.

<!-- verify
f=/root/lake/sazetak.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
rm -f /root/lake/SazetakPrijava.csv; kql $f >/dev/null 2>&1
kql-isto /root/lake/SazetakPrijava.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName) by Sat = bin(TimeGenerated, 1h), IpAddress' sort || { echo "result is not correct (Sat, IpAddress, Neuspjeha, Korisnika)"; head -3 /root/lake/SazetakPrijava.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName) by Sat = bin(TimeGenerated, 1h), IpAddress
.save /root/lake/SazetakPrijava.csv
```
In Sentinel, a summary rule has the same query, an interval (e.g. 1h) and a destination table (`SazetakPrijava_CL`).
-->
<!-- solution
printf 'SecurityEvent\n| where EventID == 4625\n| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName) by Sat = bin(TimeGenerated, 1h), IpAddress\n.save /root/lake/SazetakPrijava.csv\n' > /root/lake/sazetak.kql
kql /root/lake/sazetak.kql >/dev/null
-->

## Hunting over the summary table

Write `/root/lake/hunting.kql` that **does not read** `SecurityEvent`, but loads `SazetakPrijava.csv` as the table `SazetakPrijava` (`.load`) and finds sources active in **more than one** hour: columns `IpAddress`, `Sati` (hours; the number of distinct hours), `Ukupno` (total; the sum of `Neuspjeha`), sorted by `Ukupno` descending. Save to `/root/lake/uporni.csv`.

<!-- verify
f=/root/lake/hunting.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
grep -q 'SecurityEvent' $f && { echo "the hunting query should read SazetakPrijava, not SecurityEvent"; exit 1; }
grep -q '\.load' $f || { echo "load SazetakPrijava.csv with .load"; exit 1; }
rm -f /root/lake/uporni.csv; kql $f >/dev/null 2>&1
KQL_PRE='.load /root/lake/SazetakPrijava.csv SazetakPrijava' kql-isto /root/lake/uporni.csv 'SazetakPrijava | summarize Sati = dcount(Sat), Ukupno = sum(Neuspjeha) by IpAddress | where Sati > 1 | order by Ukupno desc' sort || { echo "result is not correct (IpAddress, Sati, Ukupno; only > 1 hour)"; head -4 /root/lake/uporni.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
.load /root/lake/SazetakPrijava.csv SazetakPrijava

SazetakPrijava
| summarize Sati = dcount(Sat), Ukupno = sum(Neuspjeha) by IpAddress
| where Sati > 1
| order by Ukupno desc
.save /root/lake/uporni.csv
```
-->
<!-- solution
printf '.load /root/lake/SazetakPrijava.csv SazetakPrijava\n\nSazetakPrijava\n| summarize Sati = dcount(Sat), Ukupno = sum(Neuspjeha) by IpAddress\n| where Sati > 1\n| order by Ukupno desc\n.save /root/lake/uporni.csv\n' > /root/lake/hunting.kql
kql /root/lake/hunting.kql >/dev/null
-->
