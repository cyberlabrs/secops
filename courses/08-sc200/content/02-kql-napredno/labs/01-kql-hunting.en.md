# Lab 1: KQL over security tables

The tables in the lab are Microsoft's public sample data for Sentinel:

- `SecurityEvent`: Windows Security events from the `devops-vm` server (mostly 4625, failed sign-ins),
- `AzureFirewall`: Azure Firewall logs (the `Type` column distinguishes `AZFWNetworkRule`, `AZFWNatRule`, `AZFWIdpsSignature`, `AZFWThreatIntel`),
- `DeviceProcessEvents`: processes from devices in Defender for Endpoint.

Note: in this data set the `Account` column was corrupted during export (`#NAME?`); the user name is in `TargetUserName`.

```bash
kql -c 'SecurityEvent | summarize count() by EventID'
kql -c 'SecurityEvent | where EventID == 4625 | take 3 | project TimeGenerated, IpAddress, TargetUserName, LogonType'
```

<!-- setup
set -e
mkdir -p /root/kql
cat > /root/kql/poznate-ip.csv <<'EOF'
IpAddress,Opis
66.90.100.200,Interni skener ranjivosti (odobren)
194.169.175.17,Pentest partner, ugovor SEC-88
EOF
-->

## Failed sign-ins per source

Write `/root/kql/izvori.kql`: for 4625 events, per `IpAddress`, calculate

- `Neuspjeha` (failures; number of events), `Korisnika` (users; number of distinct `TargetUserName` values),
- `Prvi` and `Zadnji` (first and last; the earliest and latest `TimeGenerated`),

keep only sources with **20 or more** failures and sort by `Neuspjeha` descending. Save to `/root/kql/izvori.csv`.

<!-- verify
[ -f /root/kql/izvori.kql ] || { echo "/root/kql/izvori.kql not found"; exit 1; }
rm -f /root/kql/izvori.csv; kql /root/kql/izvori.kql >/dev/null 2>&1
kql-isto /root/kql/izvori.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Prvi = min(TimeGenerated), Zadnji = max(TimeGenerated) by IpAddress | where Neuspjeha >= 20 | order by Neuspjeha desc' sort || { echo "result is not correct (columns IpAddress, Neuspjeha, Korisnika, Prvi, Zadnji; only >= 20)"; head -4 /root/kql/izvori.csv 2>/dev/null; exit 1; }
head -1 /root/kql/izvori.csv | tr -d '\r' | grep -qx 'IpAddress,Neuspjeha,Korisnika,Prvi,Zadnji' || { echo "the column order must be IpAddress,Neuspjeha,Korisnika,Prvi,Zadnji"; exit 1; }
-->
<!-- hint
```kql
SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName),
            Prvi = min(TimeGenerated), Zadnji = max(TimeGenerated) by IpAddress
| where Neuspjeha >= 20
| order by Neuspjeha desc
```
A single source with many different user names is a typical password spray pattern.
-->
<!-- solution
cat > /root/kql/izvori.kql <<'EOF'
SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Prvi = min(TimeGenerated), Zadnji = max(TimeGenerated) by IpAddress
| where Neuspjeha >= 20
| order by Neuspjeha desc
.save /root/kql/izvori.csv
EOF
kql /root/kql/izvori.kql >/dev/null
-->

## Exclude known sources (watchlist)

The team has a list of approved sources (`/root/kql/poznate-ip.csv`; in Sentinel this would be a **watchlist**). Write `/root/kql/nepoznati.kql` that:

1. loads the list as a table: `.load /root/kql/poznate-ip.csv PoznateIp` (the first line of the file),
2. uses `let` to build the set of sources from the previous task (20+ failures),
3. removes the known sources with `join kind=leftanti`,
4. returns `IpAddress` and `Neuspjeha`, descending by `Neuspjeha`, and saves to `/root/kql/nepoznati.csv`.

<!-- verify
f=/root/kql/nepoznati.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
grep -q 'leftanti' $f || { echo "use join kind=leftanti"; exit 1; }
grep -q '^\s*let ' $f || { echo "use let"; exit 1; }
rm -f /root/kql/nepoznati.csv; kql $f >/dev/null 2>&1
KQL_PRE='.load /root/kql/poznate-ip.csv PoznateIp' kql-isto /root/kql/nepoznati.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count() by IpAddress | where Neuspjeha >= 20 | join kind=leftanti PoznateIp on IpAddress | project IpAddress, Neuspjeha | order by Neuspjeha desc' sort || { echo "result is not correct (IpAddress, Neuspjeha; without known sources)"; head -4 /root/kql/nepoznati.csv 2>/dev/null; exit 1; }
grep -q '66.90.100.200' /root/kql/nepoznati.csv && { echo "known source 66.90.100.200 was not removed"; exit 1; }
exit 0
-->
<!-- hint
```kql
.load /root/kql/poznate-ip.csv PoznateIp

let Izvori = SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count() by IpAddress
| where Neuspjeha >= 20;
Izvori
| join kind=leftanti PoznateIp on IpAddress
| project IpAddress, Neuspjeha
| order by Neuspjeha desc
```
In Sentinel: `_GetWatchlist('PoznateIp')` instead of `.load`.
-->
<!-- solution
cat > /root/kql/nepoznati.kql <<'EOF'
.load /root/kql/poznate-ip.csv PoznateIp

let Izvori = SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count() by IpAddress
| where Neuspjeha >= 20;
Izvori
| join kind=leftanti PoznateIp on IpAddress
| project IpAddress, Neuspjeha
| order by Neuspjeha desc
.save /root/kql/nepoznati.csv
EOF
kql /root/kql/nepoznati.kql >/dev/null
-->

## Firewall: decisions per log type

Write `/root/kql/firewall.kql`: for each `Type` in `AzureFirewall`, calculate `Ukupno` (total), `Dozvoljeno` (allowed; `Action == "Allow"`) and `Blokirano` (blocked; `Action` is `Deny` or `drop`) using `countif()`, sorted by `Type`. Save to `/root/kql/firewall.csv`.

<!-- verify
f=/root/kql/firewall.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
grep -q 'countif' $f || { echo "use countif()"; exit 1; }
rm -f /root/kql/firewall.csv; kql $f >/dev/null 2>&1
kql-isto /root/kql/firewall.csv 'AzureFirewall | summarize Ukupno = count(), Dozvoljeno = countif(Action == "Allow"), Blokirano = countif(Action in ("Deny", "drop")) by Type | order by Type asc' || { echo "result is not correct (Type, Ukupno, Dozvoljeno, Blokirano; sorted by Type)"; cat /root/kql/firewall.csv 2>/dev/null; exit 1; }
-->
<!-- hint
`countif(Action in ("Deny", "drop"))`. Watch the case: different log types write the action differently (`Deny` and `drop`); `in~` compares case-insensitively.
-->
<!-- solution
printf 'AzureFirewall\n| summarize Ukupno = count(), Dozvoljeno = countif(Action == "Allow"), Blokirano = countif(Action in ("Deny", "drop")) by Type\n| order by Type asc\n.save /root/kql/firewall.csv\n' > /root/kql/firewall.kql
kql /root/kql/firewall.kql >/dev/null
-->
