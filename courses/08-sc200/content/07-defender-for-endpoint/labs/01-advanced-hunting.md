# Lab 1: Advanced hunting nad DeviceProcessEvents

`DeviceProcessEvents` je Defender for Endpoint tabela sa svakim pokrenutim procesom: ko ga je pokrenuo (`InitiatingProcess…`), sa kojom komandnom linijom, na kom uređaju. U labu su Microsoftovi primjeri sa jednog uređaja (`pc-984412.contoso.com`).

```bash
mkdir -p /root/mde && cd /root/mde
kql -c 'DeviceProcessEvents | take 3 | project Timestamp, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine'
```

<!-- setup
set -e
mkdir -p /root/mde
-->

## Ko pokreće procese

Napiši `/root/mde/roditelji.kql`: broj pokrenutih procesa po paru roditelj → dijete (`InitiatingProcessFileName`, `FileName`) u koloni `Pokretanja`, opadajuće. Snimi u `/root/mde/roditelji.csv`.

<!-- verify
f=/root/mde/roditelji.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
rm -f /root/mde/roditelji.csv; kql $f >/dev/null 2>&1
kql-isto /root/mde/roditelji.csv 'DeviceProcessEvents | summarize Pokretanja = count() by InitiatingProcessFileName, FileName | order by Pokretanja desc' sort || { echo "rezultat nije tačan (InitiatingProcessFileName, FileName, Pokretanja)"; head -4 /root/mde/roditelji.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
DeviceProcessEvents
| summarize Pokretanja = count() by InitiatingProcessFileName, FileName
| order by Pokretanja desc
.save /root/mde/roditelji.csv
```
U pravom okruženju ovakav pregled (stacking) brzo pokaže rijetke parove, npr. Office aplikaciju koja pokreće skriptni interpreter.
-->
<!-- solution
printf 'DeviceProcessEvents\n| summarize Pokretanja = count() by InitiatingProcessFileName, FileName\n| order by Pokretanja desc\n.save /root/mde/roditelji.csv\n' > /root/mde/roditelji.kql
kql /root/mde/roditelji.kql >/dev/null
-->

## Upit za custom detection rule

Defender XDR **custom detection rule** zahtijeva da rezultat upita sadrži kolone `Timestamp`, `DeviceId` i `ReportId` (za događaje uređaja), da bi alarm mogao povezati uređaj i događaj.

Napiši `/root/mde/detekcija.kql`: procesi koje je pokrenuo `powershell.exe` ili `bash.exe` (`InitiatingProcessFileName`, bez obzira na velika slova), sa kolonama `Timestamp`, `DeviceId`, `ReportId`, `DeviceName`, `InitiatingProcessFileName`, `FileName`, `ProcessCommandLine`, sortirano po `Timestamp`. Snimi u `/root/mde/detekcija.csv`.

<!-- verify
f=/root/mde/detekcija.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
rm -f /root/mde/detekcija.csv; kql $f >/dev/null 2>&1
h=$(head -1 /root/mde/detekcija.csv 2>/dev/null | tr -d '\r')
for c in Timestamp DeviceId ReportId; do echo "$h" | tr ',' '\n' | grep -qx $c || { echo "rezultat nema obaveznu kolonu $c"; exit 1; }; done
kql-isto /root/mde/detekcija.csv 'DeviceProcessEvents | where InitiatingProcessFileName in~ ("powershell.exe", "bash.exe") | project Timestamp, DeviceId, ReportId, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine | order by Timestamp asc' sort || { echo "rezultat nije tačan"; head -3 /root/mde/detekcija.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
DeviceProcessEvents
| where InitiatingProcessFileName in~ ("powershell.exe", "bash.exe")
| project Timestamp, DeviceId, ReportId, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine
| order by Timestamp asc
```
`in~` poredi bez obzira na velika slova (`PowerShell.exe` i `powershell.exe`).
-->
<!-- solution
printf 'DeviceProcessEvents\n| where InitiatingProcessFileName in~ ("powershell.exe", "bash.exe")\n| project Timestamp, DeviceId, ReportId, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine\n| order by Timestamp asc\n.save /root/mde/detekcija.csv\n' > /root/mde/detekcija.kql
kql /root/mde/detekcija.kql >/dev/null
-->
