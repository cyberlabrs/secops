# Lab 1: Scheduled analytics rule kao kod

Sentinel analytics pravila mogu se praviti u portalu, ali timovi ih sve češće drže u gitu u YAML formatu (isti format kao šabloni u Microsoftovom repou `Azure/Azure-Sentinel`, folder `Detections/`) i postavljaju kroz CI (Repositories u Sentinelu, ARM/Bicep ili Terraform).

Napisaćeš pravilo za izvore sa mnogo neuspjelih prijava na Windows serverima, provjeriti njegov upit nad podacima iz laba i dodati mapiranje entiteta.

```bash
mkdir -p /root/pravila && cd /root/pravila
kql -c 'SecurityEvent | where EventID == 4625 | summarize count() by IpAddress | top 5 by count_'
```

<!-- setup
set -e
mkdir -p /root/pravila
-->

## Upit pravila

Napiši `/root/pravila/upit.kql` sa upitom koji vraća izvore (`IpAddress`) sa **više od 30** neuspjelih prijava (4625), sa kolonama `IpAddress`, `Neuspjeha`, `Korisnika` (broj različitih `TargetUserName`) i `Racunar` (`Computer`, bilo koja vrijednost: `any(Computer)`).

**Bez vremenskog filtera** (`ago(...)`): kod scheduled pravila Sentinel sam primjenjuje period upita (`queryPeriod`), a filter u upitu bi u labu, gdje su podaci iz 2024., vratio prazan rezultat.

Na kraju fajla `.save /root/pravila/upit.csv`.

<!-- verify
f=/root/pravila/upit.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
grep -q 'ago(' $f && { echo "upit pravila ne treba ago(): period zadaje queryPeriod"; exit 1; }
rm -f /root/pravila/upit.csv; kql $f >/dev/null 2>&1
kql-isto /root/pravila/upit.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Racunar = any(Computer) by IpAddress | where Neuspjeha > 30' sort || { echo "rezultat nije tačan (IpAddress, Neuspjeha, Korisnika, Racunar; samo > 30)"; head -4 /root/pravila/upit.csv 2>/dev/null; exit 1; }
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

## Pravilo u YAML-u

Napiši `/root/pravila/neuspjele-prijave.yaml` sa poljima kao u šablonima Azure-Sentinel repoa:

- `id` (UUID), `name`, `description`, `severity: Medium`, `kind: Scheduled`, `version: 1.0.0`,
- `requiredDataConnectors`: konektor `SecurityEvents` sa `dataTypes: [SecurityEvent]`,
- `queryFrequency: 1h`, `queryPeriod: 1h`, `triggerOperator: gt`, `triggerThreshold: 0`,
- `tactics: [CredentialAccess]`, `relevantTechniques: [T1110]`,
- `query`: upit iz prethodnog zadatka (bez `.save` reda, kao višelinijski string `|`).

<!-- verify
f=/root/pravila/neuspjele-prijave.yaml
[ -f $f ] || { echo "nema $f"; exit 1; }
yq -e . $f >/dev/null 2>&1 || { echo "$f nije validan YAML"; exit 1; }
yq -r '.id' $f | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || { echo "id treba biti UUID"; exit 1; }
for kv in 'severity=Medium' 'kind=Scheduled' 'queryFrequency=1h' 'queryPeriod=1h' 'triggerOperator=gt' 'triggerThreshold=0'; do
  k=${kv%%=*}; v=${kv#*=}
  [ "$(yq -r ".$k" $f)" = "$v" ] || { echo "$k treba biti $v"; exit 1; }
done
[ -n "$(yq -r '.name // ""' $f)" ] && [ -n "$(yq -r '.description // ""' $f)" ] || { echo "nedostaje name ili description"; exit 1; }
[ "$(yq -r '.version' $f)" = "1.0.0" ] || { echo "version treba 1.0.0"; exit 1; }
yq -r '.requiredDataConnectors[] | select(.connectorId == "SecurityEvents") | .dataTypes[]' $f | grep -qx SecurityEvent || { echo "requiredDataConnectors: SecurityEvents sa dataTypes SecurityEvent"; exit 1; }
yq -r '.tactics[]' $f | grep -qx CredentialAccess && yq -r '.relevantTechniques[]' $f | grep -qx T1110 || { echo "tactics CredentialAccess i relevantTechniques T1110"; exit 1; }
yq -r '.query' $f > /tmp/rq.kql; grep -q '\.save' /tmp/rq.kql && { echo "query ne smije imati .save"; exit 1; }
printf '\n.save /tmp/rq.csv\n' >> /tmp/rq.kql; rm -f /tmp/rq.csv; kql /tmp/rq.kql >/dev/null 2>&1
[ "$(sort /tmp/rq.csv 2>/dev/null)" = "$(sort /root/pravila/upit.csv)" ] && [ -s /tmp/rq.csv ] || { echo "query u YAML-u ne daje isti rezultat kao upit.kql"; exit 1; }
-->
<!-- hint
```yaml
id: 5d8a1b0e-6b0a-4c3e-9b1e-2f6f2c1d7a10
name: Mnogo neuspjelih prijava sa jednog izvora
description: |
  Izvor sa više od 30 neuspjelih prijava (4625) u periodu upita.
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

## Entiteti i grupisanje

Da bi Sentinel povezivao alarme sa entitetima (i incidente međusobno), dodaj u pravilo:

- `entityMappings`: entitet `IP` sa poljem `Address` → kolona `IpAddress`, i entitet `Host` sa poljem `HostName` → kolona `Racunar`,
- `incidentConfiguration`: `createIncident: true` i `groupingConfiguration` sa `enabled: true`, `lookbackDuration: 5h`, `matchingMethod: Selected` i `groupByEntities: [IP]`.

<!-- verify
f=/root/pravila/neuspjele-prijave.yaml
yq -e '.entityMappings[] | select(.entityType == "IP") | .fieldMappings[] | select(.identifier == "Address" and .columnName == "IpAddress")' $f >/dev/null 2>&1 || { echo "nema mapiranja IP.Address -> IpAddress"; exit 1; }
yq -e '.entityMappings[] | select(.entityType == "Host") | .fieldMappings[] | select(.identifier == "HostName" and .columnName == "Racunar")' $f >/dev/null 2>&1 || { echo "nema mapiranja Host.HostName -> Racunar"; exit 1; }
[ "$(yq -r '.incidentConfiguration.createIncident' $f)" = "true" ] || { echo "incidentConfiguration.createIncident: true"; exit 1; }
g='.incidentConfiguration.groupingConfiguration'
[ "$(yq -r "$g.enabled" $f)" = "true" ] && [ "$(yq -r "$g.lookbackDuration" $f)" = "5h" ] && [ "$(yq -r "$g.matchingMethod" $f)" = "Selected" ] || { echo "groupingConfiguration: enabled true, lookbackDuration 5h, matchingMethod Selected"; exit 1; }
yq -r "$g.groupByEntities[]" $f | grep -qx IP || { echo "groupByEntities: [IP]"; exit 1; }
for c in $(yq -r '.entityMappings[].fieldMappings[].columnName' $f); do head -1 /root/pravila/upit.csv | tr -d '\r' | tr ',' '\n' | grep -qx "$c" || { echo "kolona $c iz entityMappings ne postoji u rezultatu upita"; exit 1; }; done
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
