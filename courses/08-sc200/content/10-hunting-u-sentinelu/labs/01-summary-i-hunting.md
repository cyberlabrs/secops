# Lab 1: Summary tabela i hunting nad njom

Sirovi logovi u **data lake** tieru su jeftini za čuvanje, ali skupi za česte upite. **Summary rules** periodično agregiraju podatke u manju tabelu (npr. po satu), nad kojom hunting upiti rade brzo i dugo unazad.

Ovdje ćeš ručno uraditi ono što summary rule radi automatski: napraviti tabelu agregata, učitati je i nad njom napisati hunting upit.

```bash
mkdir -p /root/lake && cd /root/lake
kql -c 'SecurityEvent | summarize min(TimeGenerated), max(TimeGenerated), count()'
```

<!-- setup
set -e
mkdir -p /root/lake
-->

## Summary tabela

Napiši `/root/lake/sazetak.kql` koji za neuspjele prijave (4625) pravi agregat po satu i izvoru: kolone `Sat` (`bin(TimeGenerated, 1h)`), `IpAddress`, `Neuspjeha` i `Korisnika` (`dcount(TargetUserName)`). Snimi ga u `/root/lake/SazetakPrijava.csv`.

<!-- verify
f=/root/lake/sazetak.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
rm -f /root/lake/SazetakPrijava.csv; kql $f >/dev/null 2>&1
kql-isto /root/lake/SazetakPrijava.csv 'SecurityEvent | where EventID == 4625 | summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName) by Sat = bin(TimeGenerated, 1h), IpAddress' sort || { echo "rezultat nije tačan (Sat, IpAddress, Neuspjeha, Korisnika)"; head -3 /root/lake/SazetakPrijava.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
SecurityEvent
| where EventID == 4625
| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName) by Sat = bin(TimeGenerated, 1h), IpAddress
.save /root/lake/SazetakPrijava.csv
```
U Sentinelu summary rule ima isti upit, interval (npr. 1h) i odredišnu tabelu (`SazetakPrijava_CL`).
-->
<!-- solution
printf 'SecurityEvent\n| where EventID == 4625\n| summarize Neuspjeha = count(), Korisnika = dcount(TargetUserName) by Sat = bin(TimeGenerated, 1h), IpAddress\n.save /root/lake/SazetakPrijava.csv\n' > /root/lake/sazetak.kql
kql /root/lake/sazetak.kql >/dev/null
-->

## Hunting nad summary tabelom

Napiši `/root/lake/hunting.kql` koji **ne čita** `SecurityEvent`, nego učita `SazetakPrijava.csv` kao tabelu `SazetakPrijava` (`.load`) i pronađe izvore aktivne u **više od jednog** sata: kolone `IpAddress`, `Sati` (broj različitih sati), `Ukupno` (zbir `Neuspjeha`), sortirano po `Ukupno` opadajuće. Snimi u `/root/lake/uporni.csv`.

<!-- verify
f=/root/lake/hunting.kql
[ -f $f ] || { echo "nema $f"; exit 1; }
grep -q 'SecurityEvent' $f && { echo "hunting upit treba da čita SazetakPrijava, ne SecurityEvent"; exit 1; }
grep -q '\.load' $f || { echo "učitaj SazetakPrijava.csv sa .load"; exit 1; }
rm -f /root/lake/uporni.csv; kql $f >/dev/null 2>&1
KQL_PRE='.load /root/lake/SazetakPrijava.csv SazetakPrijava' kql-isto /root/lake/uporni.csv 'SazetakPrijava | summarize Sati = dcount(Sat), Ukupno = sum(Neuspjeha) by IpAddress | where Sati > 1 | order by Ukupno desc' sort || { echo "rezultat nije tačan (IpAddress, Sati, Ukupno; samo > 1 sat)"; head -4 /root/lake/uporni.csv 2>/dev/null; exit 1; }
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
