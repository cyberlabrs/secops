# Lab 1: A transformation in a data collection rule

Windows servers send Security events through the Azure Monitor Agent (AMA). A **data collection rule (DCR)** defines what is collected, and its `transformKql` can filter and modify records **before** they are written to the table: you pay for and keep only what you need.

A transformation is KQL over the virtual table `source` (the incoming records). In the lab, `source` is replaced by the `SecurityEvent` table: the check runs your query as `let source = SecurityEvent; <your transformation>`.

Transformation limitations (in a real DCR): a single expression with no `let` above `source`, no `summarize`, `join` or other operators that combine or aggregate records.

```bash
mkdir -p /root/dcr && cd /root/dcr
kql -c 'SecurityEvent | summarize count() by EventID'
```

<!-- setup
set -e
mkdir -p /root/dcr
-->

## transformKql

Write `/root/dcr/transform.kql` (a single query over `source`, without `.save`) that:

1. keeps only sign-in and sign-out events: `EventID` 4624, 4625 and 4634,
2. adds a column `Uspjesno` (successful; `true` for 4624, otherwise `false`),
3. removes the columns the team does not use: `LmPackageName`, `KeyLength`, `TransmittedServices` (`project-away`).

<!-- verify
f=/root/dcr/transform.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
grep -q '\.save' $f && { echo "the transformation must not contain .save"; exit 1; }
grep -Eqi '\b(summarize|join|union)\b|^\s*let ' $f && { echo "the transformation must not use let, summarize, join or union"; exit 1; }
grep -q '\bsource\b' $f || { echo "the transformation must start from the source table"; exit 1; }
t=$(mktemp -d); { echo 'let source = SecurityEvent;'; cat $f; echo; echo ".save $t/a.csv"; } > $t/q.kql
kql $t/q.kql >/dev/null 2>&1
KQL_PRE='' kql-isto $t/a.csv 'let source = SecurityEvent; source | where EventID in (4624, 4625, 4634) | extend Uspjesno = EventID == 4624 | project-away LmPackageName, KeyLength, TransmittedServices' sort || { rm -rf $t; echo "the transformation result is not correct (filter, column Uspjesno, project-away)"; exit 1; }
head -1 $t/a.csv | tr -d '\r' | tr ',' '\n' | grep -qx "LmPackageName" && { rm -rf $t; echo "column LmPackageName was not removed"; exit 1; }
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

Write `/root/dcr/dcr.json`: a DCR fragment with one element in `properties.dataFlows`:

- `streams`: `["Microsoft-SecurityEvent"]`,
- `destinations`: `["sentinelWorkspace"]`,
- `outputStream`: `"Microsoft-SecurityEvent"`,
- `transformKql`: your transformation from the previous task on a single line (spaces and newlines don't matter).

Also `properties.destinations.logAnalytics` with one destination named `sentinelWorkspace` (`workspaceResourceId` can be an example).

<!-- verify
f=/root/dcr/dcr.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
df='.properties.dataFlows[0]'
jq -e "$df.streams == [\"Microsoft-SecurityEvent\"] and $df.destinations == [\"sentinelWorkspace\"] and $df.outputStream == \"Microsoft-SecurityEvent\"" $f >/dev/null || { echo "streams, destinations or outputStream are not correct"; exit 1; }
jq -e '.properties.destinations.logAnalytics[] | select(.name == "sentinelWorkspace")' $f >/dev/null 2>&1 || { echo "no logAnalytics destination with name sentinelWorkspace"; exit 1; }
n() { tr -s ' \n\t\r' ' ' | sed 's/^ //; s/ $//'; }
[ "$(jq -r "$df.transformKql" $f | n)" = "$(n < /root/dcr/transform.kql)" ] || { echo "transformKql is not the same as /root/dcr/transform.kql"; exit 1; }
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
