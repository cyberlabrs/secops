# Lab 1: KQL nad sigurnosnim tabelama

Tabele u labu su Microsoftovi javni primjeri podataka za Sentinel:

- `SecurityEvent`: Windows Security događaji sa servera `devops-vm` (uglavnom 4625, neuspjele prijave),
- `AzureFirewall`: logovi Azure Firewalla (kolona `Type` razlikuje `AZFWNetworkRule`, `AZFWNatRule`, `AZFWIdpsSignature`, `AZFWThreatIntel`),
- `DeviceProcessEvents`: procesi sa uređaja u Defender for Endpointu.

Napomena: u ovom skupu kolona `Account` je oštećena pri izvozu (`#NAME?`); korisničko ime je u `TargetUserName`.

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

## Neuspjele prijave po izvoru

Napiši `/root/kql/izvori.kql`: za događaje 4625 po `IpAddress` izračunaj

- `Neuspjeha` (broj događaja), `Korisnika` (broj različitih `TargetUserName`),
- `Prvi` i `Zadnji` (najranije i najkasnije `TimeGenerated`),

zadrži samo izvore sa **20 ili više** neuspjeha i sortiraj po `Neuspjeha` opadajuće. Snimi u `/root/kql/izvori.csv`.

<!-- verify
[ -f /root/kql/izvori.kql ] || { echo "nema /root/kql/izvori.kql"; exit 1; }
rm -f /root/kql/izvori.csv; kql /root/kql/izvori.kql >/dev/null 2>&1
kql-isto /root/kql/izvori.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName), Prvi = min(TimeGenerated), Zadnji = max(TimeGenerated) by IpAddress | where Neuspjeha >= 20 | order by Neuspjeha desc' sort || { echo "rezultat nije tačan (kolone IpAddress, Neuspjeha, Korisnika, Prvi, Zadnji; samo >= 20)"; head -4 /root/kql/izvori.csv 2>/dev/null; exit 1; }
head -1 /root/kql/izvori.csv | tr -d '\r' | grep -qx 'IpAddress,Neuspjeha,Korisnika,Prvi,Zadnji' || { echo "redoslijed kolona treba biti IpAddress,Neuspjeha,Korisnika,Prvi,Zadnji"; exit 1; }
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
Jedan izvor sa mnogo različitih korisničkih imena tipičan je obrazac password sprayja.
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

## Izuzmi poznate izvore (watchlist)

Tim ima listu odobrenih izvora (`/root/kql/poznate-ip.csv`, u Sentinelu bi to bila **watchlist**). Napiši `/root/kql/nepoznati.kql` koji:

1. učita listu kao tabelu: `.load /root/kql/poznate-ip.csv PoznateIp` (prvi red fajla),
2. pomoću `let` napravi skup izvora iz prethodnog zadatka (20+ neuspjeha),
3. `join kind=leftanti` izbaci poznate izvore,
4. vrati `IpAddress` i `Neuspjeha`, opadajuće po `Neuspjeha`, i snimi u `/root/kql/nepoznati.csv`.

<!-- verify
f=/root/kql/nepoznati.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
grep -q 'leftanti' $f || { echo "koristi join kind=leftanti"; exit 1; }
grep -q '^\s*let ' $f || { echo "koristi let"; exit 1; }
rm -f /root/kql/nepoznati.csv; kql $f >/dev/null 2>&1
KQL_PRE='.load /root/kql/poznate-ip.csv PoznateIp' kql-isto /root/kql/nepoznati.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count() by IpAddress | where Neuspjeha >= 20 | join kind=leftanti PoznateIp on IpAddress | project IpAddress, Neuspjeha | order by Neuspjeha desc' sort || { echo "rezultat nije tačan (IpAddress, Neuspjeha; bez poznatih izvora)"; head -4 /root/kql/nepoznati.csv 2>/dev/null; exit 1; }
grep -q '66.90.100.200' /root/kql/nepoznati.csv && { echo "poznati izvor 66.90.100.200 nije izbačen"; exit 1; }
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
U Sentinelu: `_GetWatchlist('PoznateIp')` umjesto `.load`.
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

## Firewall: odluke po tipu loga

Napiši `/root/kql/firewall.kql`: za svaki `Type` iz `AzureFirewall` izračunaj `Ukupno`, `Dozvoljeno` (`Action == "Allow"`) i `Blokirano` (`Action` je `Deny` ili `drop`) pomoću `countif()`, sortirano po `Type`. Snimi u `/root/kql/firewall.csv`.

<!-- verify
f=/root/kql/firewall.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
grep -q 'countif' $f || { echo "koristi countif()"; exit 1; }
rm -f /root/kql/firewall.csv; kql $f >/dev/null 2>&1
kql-isto /root/kql/firewall.csv 'AzureFirewall | summarize Ukupno = count(), Dozvoljeno = countif(Action == "Allow"), Blokirano = countif(Action in ("Deny", "drop")) by Type | order by Type asc' || { echo "rezultat nije tačan (Type, Ukupno, Dozvoljeno, Blokirano; sortirano po Type)"; cat /root/kql/firewall.csv 2>/dev/null; exit 1; }
-->
<!-- hint
`countif(Action in ("Deny", "drop"))`. Pazi na velika slova: različiti tipovi loga pišu akciju različito (`Deny` i `drop`); `in~` poredi bez obzira na velika slova.
-->
<!-- solution
printf 'AzureFirewall\n| summarize Ukupno = count(), Dozvoljeno = countif(Action == "Allow"), Blokirano = countif(Action in ("Deny", "drop")) by Type\n| order by Type asc\n.save /root/kql/firewall.csv\n' > /root/kql/firewall.kql
kql /root/kql/firewall.kql >/dev/null
-->
