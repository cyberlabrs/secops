# Lab 1: A scheduled analytics rule as code

Sentinel analytics rules can be created in the portal, but teams increasingly keep them in git in YAML format (the same format as the templates in Microsoft's `Azure/Azure-Sentinel` repo, folder `Detections/`) and deploy them through CI (Repositories in Sentinel, ARM/Bicep or Terraform).

You will write a rule for sources with many failed sign-ins on Windows servers, check its query against the lab data and add entity mapping.

```bash
mkdir -p /root/pravila && cd /root/pravila
kql -c 'SecurityEvent | where EventID == 4625 | summarize count() by IpAddress | top 5 by count_'
```

<!-- setup
set -e
mkdir -p /root/pravila
-->

## The rule query

Write `/root/pravila/upit.kql` with a query that returns sources (`IpAddress`) with **more than 30** failed sign-ins (4625), with the columns `IpAddress`, `Neuspjeha` (failures), `Korisnika` (users; the number of distinct `TargetUserName` values) and `Racunar` (computer; `Computer`, any value: `any(Computer)`).

**No time filter** (`ago(...)`): for scheduled rules, Sentinel applies the query period (`queryPeriod`) itself, and a filter in the query would return an empty result in the lab, where the data is from 2024.

At the end of the file, `.save /root/pravila/upit.csv`.

<!-- verify
f=/root/pravila/upit.kql
[ -f $f ] || { echo "$f not found"; exit 1; }
grep -q 'ago(' $f && { echo "the rule query should not use ago(): the period is set by queryPeriod"; exit 1; }
rm -f /root/pravila/upit.csv; kql $f >/dev/null 2>&1
kql-isto /root/pravila/upit.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Racunar = any(Computer) by IpAddress | where Neuspjeha > 30' sort || { echo "result is not correct (IpAddress, Neuspjeha, Korisnika, Racunar; only > 30)"; head -4 /root/pravila/upit.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Racunar = any(Computer) by IpAddress
| where Neuspjeha > 30
```
-->
<!-- solution
printf 'SecurityEvent\n| where EventID == 4625\n| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Racunar = any(Computer) by IpAddress\n| where Neuspjeha > 30\n.save /root/pravila/upit.csv\n' > /root/pravila/upit.kql
kql /root/pravila/upit.kql >/dev/null
-->

## The rule in YAML

Write `/root/pravila/neuspjele-prijave.yaml` with fields as in the Azure-Sentinel repo templates:

- `id` (UUID), `name`, `description`, `severity: Medium`, `kind: Scheduled`, `version: 1.0.0`,
- `requiredDataConnectors`: the `SecurityEvents` connector with `dataTypes: [SecurityEvent]`,
- `queryFrequency: 1h`, `queryPeriod: 1h`, `triggerOperator: gt`, `triggerThreshold: 0`,
- `tactics: [CredentialAccess]`, `relevantTechniques: [T1110]`,
- `query`: the query from the previous task (without the `.save` line, as a `|` multi-line string).

<!-- verify
f=/root/pravila/neuspjele-prijave.yaml
[ -f $f ] || { echo "$f not found"; exit 1; }
yq -e . $f >/dev/null 2>&1 || { echo "$f is not valid YAML"; exit 1; }
yq -r '.id' $f | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || { echo "id must be a UUID"; exit 1; }
for kv in 'severity=Medium' 'kind=Scheduled' 'queryFrequency=1h' 'queryPeriod=1h' 'triggerOperator=gt' 'triggerThreshold=0'; do
  k=${kv%%=*}; v=${kv#*=}
  [ "$(yq -r ".$k" $f)" = "$v" ] || { echo "$k must be $v"; exit 1; }
done
[ -n "$(yq -r '.name // ""' $f)" ] && [ -n "$(yq -r '.description // ""' $f)" ] || { echo "name or description is missing"; exit 1; }
[ "$(yq -r '.version' $f)" = "1.0.0" ] || { echo "version must be 1.0.0"; exit 1; }
yq -r '.requiredDataConnectors[] | select(.connectorId == "SecurityEvents") | .dataTypes[]' $f | grep -qx SecurityEvent || { echo "requiredDataConnectors: SecurityEvents with dataTypes SecurityEvent"; exit 1; }
yq -r '.tactics[]' $f | grep -qx CredentialAccess && yq -r '.relevantTechniques[]' $f | grep -qx T1110 || { echo "tactics CredentialAccess and relevantTechniques T1110"; exit 1; }
yq -r '.query' $f > /tmp/rq.kql; grep -q '\.save' /tmp/rq.kql && { echo "query must not contain .save"; exit 1; }
printf '\n.save /tmp/rq.csv\n' >> /tmp/rq.kql; rm -f /tmp/rq.csv; kql /tmp/rq.kql >/dev/null 2>&1
[ "$(sort /tmp/rq.csv 2>/dev/null)" = "$(sort /root/pravila/upit.csv)" ] && [ -s /tmp/rq.csv ] || { echo "the query in the YAML does not return the same result as upit.kql"; exit 1; }
-->
<!-- hint
```yaml
id: 5d8a1b0e-6b0a-4c3e-9b1e-2f6f2c1d7a10
name: Many failed sign-ins from a single source
description: |
  A source with more than 30 failed sign-ins (4625) in the query period.
severity: Medium
requiredDataConnectors:
  - connectorId: SecurityEvents
    dataTypes:
      - SecurityEvent
queryFrequency: 1h
queryPeriod: 1h
triggerOperator: gt
triggerThreshold: 0
tactics:
  - CredentialAccess
relevantTechniques:
  - T1110
query: |
  SecurityEvent
  | where EventID == 4625
  ...
kind: Scheduled
version: 1.0.0
```
-->
<!-- solution
cat > /root/pravila/neuspjele-prijave.yaml <<'EOF'
id: 5d8a1b0e-6b0a-4c3e-9b1e-2f6f2c1d7a10
name: Mnogo neuspjelih prijava sa jednog izvora
description: |
  Izvor sa više od 30 neuspjelih prijava (4625) na Windows serverima u periodu upita.
severity: Medium
requiredDataConnectors:
  - connectorId: SecurityEvents
    dataTypes:
      - SecurityEvent
queryFrequency: 1h
queryPeriod: 1h
triggerOperator: gt
triggerThreshold: 0
tactics:
  - CredentialAccess
relevantTechniques:
  - T1110
query: |
  SecurityEvent
  | where EventID == 4625
  | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Racunar = any(Computer) by IpAddress
  | where Neuspjeha > 30
kind: Scheduled
version: 1.0.0
EOF
-->

## Entities and grouping

For Sentinel to link alerts to entities (and incidents to each other), add to the rule:

- `entityMappings`: the `IP` entity with the `Address` field → column `IpAddress`, and the `Host` entity with the `HostName` field → column `Racunar`,
- `incidentConfiguration`: `createIncident: true` and `groupingConfiguration` with `enabled: true`, `lookbackDuration: 5h`, `matchingMethod: Selected` and `groupByEntities: [IP]`.

<!-- verify
f=/root/pravila/neuspjele-prijave.yaml
yq -e '.entityMappings[] | select(.entityType == "IP") | .fieldMappings[] | select(.identifier == "Address" and .columnName == "IpAddress")' $f >/dev/null 2>&1 || { echo "missing mapping IP.Address -> IpAddress"; exit 1; }
yq -e '.entityMappings[] | select(.entityType == "Host") | .fieldMappings[] | select(.identifier == "HostName" and .columnName == "Racunar")' $f >/dev/null 2>&1 || { echo "missing mapping Host.HostName -> Racunar"; exit 1; }
[ "$(yq -r '.incidentConfiguration.createIncident' $f)" = "true" ] || { echo "incidentConfiguration.createIncident: true"; exit 1; }
g='.incidentConfiguration.groupingConfiguration'
[ "$(yq -r "$g.enabled" $f)" = "true" ] && [ "$(yq -r "$g.lookbackDuration" $f)" = "5h" ] && [ "$(yq -r "$g.matchingMethod" $f)" = "Selected" ] || { echo "groupingConfiguration: enabled true, lookbackDuration 5h, matchingMethod Selected"; exit 1; }
yq -r "$g.groupByEntities[]" $f | grep -qx IP || { echo "groupByEntities: [IP]"; exit 1; }
for c in $(yq -r '.entityMappings[].fieldMappings[].columnName' $f); do head -1 /root/pravila/upit.csv | tr -d '\r' | tr ',' '\n' | grep -qx "$c" || { echo "column $c from entityMappings does not exist in the query result"; exit 1; }; done
-->
<!-- hint
```yaml
entityMappings:
  - entityType: IP
    fieldMappings:
      - identifier: Address
        columnName: IpAddress
  - entityType: Host
    fieldMappings:
      - identifier: HostName
        columnName: Racunar
incidentConfiguration:
  createIncident: true
  groupingConfiguration:
    enabled: true
    reopenClosedIncident: false
    lookbackDuration: 5h
    matchingMethod: Selected
    groupByEntities:
      - IP
```
-->
<!-- solution
cat >> /root/pravila/neuspjele-prijave.yaml <<'EOF'
entityMappings:
  - entityType: IP
    fieldMappings:
      - identifier: Address
        columnName: IpAddress
  - entityType: Host
    fieldMappings:
      - identifier: HostName
        columnName: Racunar
incidentConfiguration:
  createIncident: true
  groupingConfiguration:
    enabled: true
    reopenClosedIncident: false
    lookbackDuration: 5h
    matchingMethod: Selected
    groupByEntities:
      - IP
EOF
-->
