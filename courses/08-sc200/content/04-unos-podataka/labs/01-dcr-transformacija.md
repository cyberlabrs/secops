# Lab 1: Transformacija u Data Collection Rule

Windows serveri šalju Security događaje preko Azure Monitor Agenta (AMA). **Data collection rule (DCR)** određuje šta se skuplja, a njen `transformKql` može filtrirati i mijenjati zapise **prije** upisa u tabelu: plaćaš i čuvaš samo ono što ti treba.

Transformacija je KQL nad virtuelnom tabelom `source` (dolazni zapisi). U labu je `source` zamijenjena tabelom `SecurityEvent`: provjera tvoj upit izvršava kao `let source = SecurityEvent; <tvoja transformacija>`.

Ograničenja transformacija (u stvarnom DCR-u): jedan izraz bez `let` iznad `source`, bez `summarize`, `join` i ostalih operatora koji spajaju ili agregiraju zapise.

```bash
mkdir -p /root/dcr && cd /root/dcr
kql -c 'SecurityEvent | summarize count() by EventID'
```

<!-- setup
set -e
mkdir -p /root/dcr
-->

## transformKql

Napiši `/root/dcr/transform.kql` (jedan upit nad `source`, bez `.save`) koji:

1. zadržava samo događaje prijave i odjave: `EventID` 4624, 4625 i 4634,
2. dodaje kolonu `Uspjesno` (`true` za 4624, inače `false`),
3. izbacuje kolone koje tim ne koristi: `LmPackageName`, `KeyLength`, `TransmittedServices` (`project-away`).

<!-- verify
f=/root/dcr/transform.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
grep -q '\.save' $f && { echo "transformacija ne smije imati .save"; exit 1; }
grep -Eqi '\b(summarize|join|union)\b|^\s*let ' $f && { echo "transformacija ne smije koristiti let, summarize, join ili union"; exit 1; }
grep -q '\bsource\b' $f || { echo "transformacija mora krenuti od tabele source"; exit 1; }
t=$(mktemp -d); { echo 'let source = SecurityEvent;'; cat $f; echo; echo ".save $t/a.csv"; } > $t/q.kql
kql $t/q.kql >/dev/null 2>&1
KQL_PRE='' kql-isto $t/a.csv 'let source = SecurityEvent; source | where EventID in (4624, 4625, 4634) | extend Uspjesno = EventID == 4624 | project-away LmPackageName, KeyLength, TransmittedServices' sort || { rm -rf $t; echo "rezultat transformacije nije tačan (filter, kolona Uspjesno, project-away)"; exit 1; }
head -1 $t/a.csv | tr -d '\r' | tr ',' '\n' | grep -qx "LmPackageName" && { rm -rf $t; echo "kolona LmPackageName nije izbačena"; exit 1; }
rm -rf $t
-->
<!-- hint
```kql
source
| where EventID in (4624, 4625, 4634)
| extend Uspjesno = EventID == 4624
| project-away LmPackageName, KeyLength, TransmittedServices
```
-->
<!-- solution
printf 'source\n| where EventID in (4624, 4625, 4634)\n| extend Uspjesno = EventID == 4624\n| project-away LmPackageName, KeyLength, TransmittedServices\n' > /root/dcr/transform.kql
-->

## DCR dataFlow

Napiši `/root/dcr/dcr.json`: isječak DCR-a sa jednim elementom u `properties.dataFlows`:

- `streams`: `["Microsoft-SecurityEvent"]`,
- `destinations`: `["sentinelWorkspace"]`,
- `outputStream`: `"Microsoft-SecurityEvent"`,
- `transformKql`: tvoja transformacija iz prethodnog zadatka u jednom redu (razmaci i novi redovi nisu bitni).

Uz to `properties.destinations.logAnalytics` sa jednim odredištem imena `sentinelWorkspace` (`workspaceResourceId` može biti primjer).

<!-- verify
f=/root/dcr/dcr.json
jq -e . $f >/dev/null 2>&1 || { echo "$f ne postoji ili nije JSON"; exit 1; }
df='.properties.dataFlows[0]'
jq -e "$df.streams == [\"Microsoft-SecurityEvent\"] and $df.destinations == [\"sentinelWorkspace\"] and $df.outputStream == \"Microsoft-SecurityEvent\"" $f >/dev/null || { echo "streams, destinations ili outputStream nisu tačni"; exit 1; }
jq -e '.properties.destinations.logAnalytics[] | select(.name == "sentinelWorkspace")' $f >/dev/null 2>&1 || { echo "nema odredišta logAnalytics sa name sentinelWorkspace"; exit 1; }
n() { tr -s ' \n\t\r' ' ' | sed 's/^ //; s/ $//'; }
[ "$(jq -r "$df.transformKql" $f | n)" = "$(n < /root/dcr/transform.kql)" ] || { echo "transformKql nije isti kao /root/dcr/transform.kql"; exit 1; }
-->
<!-- hint
```bash
jq -n --arg t "$(tr '\n' ' ' < /root/dcr/transform.kql)" '{
  properties: {
    destinations: { logAnalytics: [ { name: "sentinelWorkspace",
      workspaceResourceId: "/subscriptions/<sub>/resourceGroups/rg-sec/providers/Microsoft.OperationalInsights/workspaces/law-sentinel" } ] },
    dataFlows: [ { streams: ["Microsoft-SecurityEvent"], destinations: ["sentinelWorkspace"],
                   outputStream: "Microsoft-SecurityEvent", transformKql: $t } ]
  } }' > /root/dcr/dcr.json
```
-->
<!-- solution
jq -n --arg t "$(tr '\n' ' ' < /root/dcr/transform.kql)" '{properties: {destinations: {logAnalytics: [{name: "sentinelWorkspace", workspaceResourceId: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-sec/providers/Microsoft.OperationalInsights/workspaces/law-sentinel"}]}, dataFlows: [{streams: ["Microsoft-SecurityEvent"], destinations: ["sentinelWorkspace"], outputStream: "Microsoft-SecurityEvent", transformKql: $t}]}}' > /root/dcr/dcr.json
-->
