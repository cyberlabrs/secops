# Lab 1: KQL basics on StormEvents

`StormEvents` is Microsoft's data set for learning KQL (storms in the USA, 2007). The same syntax works in Sentinel, Defender XDR advanced hunting and Azure Data Explorer.

In the lab, KQL is executed by the `kql` tool (the open-source Kusto-Loco engine). You write queries into a file; separate multiple queries in the same file with a blank line, and `.save <file.csv>` after a query saves its result.

```bash
kql -c 'StormEvents | take 5'
kql -c 'StormEvents | getschema'
mkdir -p /root/kql && cd /root/kql
```

<!-- setup
set -e
mkdir -p /root/kql
-->

## States with the most events

Write `/root/kql/drzave.kql`: the five states with the most events, columns `State` and `Dogadjaja` (events), from largest to smallest. Save the result to `/root/kql/drzave.csv`.

```kql
StormEvents
| summarize Dogadjaja = count() by State
| ...
```

<!-- verify
[ -f /root/kql/drzave.kql ] || { echo "/root/kql/drzave.kql not found"; exit 1; }
grep -q '\.save' /root/kql/drzave.kql || { echo "drzave.kql needs .save /root/kql/drzave.csv"; exit 1; }
rm -f /root/kql/drzave.csv; kql /root/kql/drzave.kql >/dev/null 2>&1
kql-isto /root/kql/drzave.csv 'StormEvents | summarize Dogadjaja = count() by State | top 5 by Dogadjaja desc' || { echo "result is not correct (columns State, Dogadjaja; 5 rows; descending)"; head -7 /root/kql/drzave.csv 2>/dev/null; exit 1; }
-->
<!-- hint
`top 5 by Dogadjaja desc` sorts and limits in one step (same as `order by … desc | take 5`).
```kql
StormEvents
| summarize Dogadjaja = count() by State
| top 5 by Dogadjaja desc
.save /root/kql/drzave.csv
```
-->
<!-- solution
printf 'StormEvents\n| summarize Dogadjaja = count() by State\n| top 5 by Dogadjaja desc\n.save /root/kql/drzave.csv\n' > /root/kql/drzave.kql
kql /root/kql/drzave.kql >/dev/null
-->

## Damage by event type

Write `/root/kql/steta.kql`: only events with `DamageProperty` greater than 0, total property damage per `EventType` in a column named `Steta` (damage), the three types with the highest damage. Save to `/root/kql/steta.csv`.

<!-- verify
[ -f /root/kql/steta.kql ] || { echo "/root/kql/steta.kql not found"; exit 1; }
rm -f /root/kql/steta.csv; kql /root/kql/steta.kql >/dev/null 2>&1
kql-isto /root/kql/steta.csv 'StormEvents | where DamageProperty > 0 | summarize Steta = sum(DamageProperty) by EventType | top 3 by Steta desc' || { echo "result is not correct (columns EventType, Steta; 3 rows)"; head -5 /root/kql/steta.csv 2>/dev/null; exit 1; }
grep -qi 'where' /root/kql/steta.kql || { echo "filter with where DamageProperty > 0"; exit 1; }
-->
<!-- hint
Filter as early as possible (`where` before `summarize`): in Sentinel that is the difference between a query that takes a second and one that times out.
-->
<!-- solution
printf 'StormEvents\n| where DamageProperty > 0\n| summarize Steta = sum(DamageProperty) by EventType\n| top 3 by Steta desc\n.save /root/kql/steta.csv\n' > /root/kql/steta.kql
kql /root/kql/steta.kql >/dev/null
-->

## Tornadoes by month

Write `/root/kql/tornada.kql`: the number of `Tornado` events per month, columns `Mjesec` (month; the start of the month, `startofmonth(StartTime)`) and `Tornada` (tornadoes), sorted from January to December. Save to `/root/kql/tornada.csv`.

In Sentinel, a query like this would end with `| render timechart`.

<!-- verify
[ -f /root/kql/tornada.kql ] || { echo "/root/kql/tornada.kql not found"; exit 1; }
rm -f /root/kql/tornada.csv; kql /root/kql/tornada.kql >/dev/null 2>&1
kql-isto /root/kql/tornada.csv 'StormEvents | where EventType == "Tornado" | summarize Tornada = count() by Mjesec = startofmonth(StartTime) | order by Mjesec asc' || { echo "result is not correct (columns Mjesec, Tornada; 12 rows; ascending by month)"; head -4 /root/kql/tornada.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
StormEvents
| where EventType == "Tornado"
| summarize Tornada = count() by Mjesec = startofmonth(StartTime)
| order by Mjesec asc
```
`==` is case-sensitive; `=~` is not.
-->
<!-- solution
printf 'StormEvents\n| where EventType == "Tornado"\n| summarize Tornada = count() by Mjesec = startofmonth(StartTime)\n| order by Mjesec asc\n.save /root/kql/tornada.csv\n' > /root/kql/tornada.kql
kql /root/kql/tornada.kql >/dev/null
-->
