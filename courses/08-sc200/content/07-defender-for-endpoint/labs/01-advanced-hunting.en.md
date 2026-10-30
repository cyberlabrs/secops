# Lab 1: Advanced hunting over DeviceProcessEvents

`DeviceProcessEvents` is the Defender for Endpoint table with every started process: who started it (`InitiatingProcess…`), with which command line, on which device. The lab contains Microsoft sample data from a single device (`pc-984412.contoso.com`).

```bash
mkdir -p /root/mde && cd /root/mde
kql -c 'DeviceProcessEvents | take 3 | project Timestamp, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine'
```

<!-- setup
set -e
mkdir -p /root/mde
-->

## Who starts processes

Write `/root/mde/roditelji.kql`: the number of started processes per parent → child pair (`InitiatingProcessFileName`, `FileName`) in a column named `Pokretanja` (launches), descending. Save to `/root/mde/roditelji.csv`.

<!-- verify
f=/root/mde/roditelji.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
rm -f /root/mde/roditelji.csv; kql $f >/dev/null 2>&1
kql-isto /root/mde/roditelji.csv 'DeviceProcessEvents | summarize Pokretanja = count() by InitiatingProcessFileName, FileName | order by Pokretanja desc' sort || { echo "result is not correct (InitiatingProcessFileName, FileName, Pokretanja)"; head -4 /root/mde/roditelji.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
DeviceProcessEvents
| summarize Pokretanja = count() by InitiatingProcessFileName, FileName
| order by Pokretanja desc
.save /root/mde/roditelji.csv
```
In a real environment, an overview like this (stacking) quickly reveals rare pairs, e.g. an Office application launching a script interpreter.
-->
<!-- solution
printf 'DeviceProcessEvents\n| summarize Pokretanja = count() by InitiatingProcessFileName, FileName\n| order by Pokretanja desc\n.save /root/mde/roditelji.csv\n' > /root/mde/roditelji.kql
kql /root/mde/roditelji.kql >/dev/null
-->

## Query for a custom detection rule

A Defender XDR **custom detection rule** requires the query result to contain the `Timestamp`, `DeviceId` and `ReportId` columns (for device events), so that the alert can link the device and the event.

Write `/root/mde/detekcija.kql`: processes started by `powershell.exe` or `bash.exe` (`InitiatingProcessFileName`, case-insensitive), with the columns `Timestamp`, `DeviceId`, `ReportId`, `DeviceName`, `InitiatingProcessFileName`, `FileName`, `ProcessCommandLine`, sorted by `Timestamp`. Save to `/root/mde/detekcija.csv`.

<!-- verify
f=/root/mde/detekcija.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
rm -f /root/mde/detekcija.csv; kql $f >/dev/null 2>&1
h=$(head -1 /root/mde/detekcija.csv 2>/dev/null | tr -d '\r')
for c in Timestamp DeviceId ReportId; do echo "$h" | tr ',' '\n' | grep -qx $c || { echo "result is missing the required column $c"; exit 1; }; done
kql-isto /root/mde/detekcija.csv 'DeviceProcessEvents | where InitiatingProcessFileName in~ ("powershell.exe", "bash.exe") | project Timestamp, DeviceId, ReportId, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine | order by Timestamp asc' sort || { echo "result is not correct"; head -3 /root/mde/detekcija.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
DeviceProcessEvents
| where InitiatingProcessFileName in~ ("powershell.exe", "bash.exe")
| project Timestamp, DeviceId, ReportId, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine
| order by Timestamp asc
```
`in~` compares case-insensitively (`PowerShell.exe` and `powershell.exe`).
-->
<!-- solution
printf 'DeviceProcessEvents\n| where InitiatingProcessFileName in~ ("powershell.exe", "bash.exe")\n| project Timestamp, DeviceId, ReportId, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine\n| order by Timestamp asc\n.save /root/mde/detekcija.csv\n' > /root/mde/detekcija.kql
kql /root/mde/detekcija.kql >/dev/null
-->
