# Lab 1: KQL osnove na StormEvents

`StormEvents` je Microsoftov skup podataka za učenje KQL-a (oluje u SAD-u, 2007). Ista sintaksa radi u Sentinelu, Defender XDR advanced huntingu i Azure Data Exploreru.

U labu KQL izvršava alat `kql` (open-source engine Kusto-Loco). Upite pišeš u fajl; više upita u istom fajlu odvoji praznim redom, a `.save <fajl.csv>` iza upita snima njegov rezultat.

```bash
kql -c 'StormEvents | take 5'
kql -c 'StormEvents | getschema'
mkdir -p /root/kql && cd /root/kql
```

<!-- setup
set -e
mkdir -p /root/kql
-->

## Države sa najviše događaja

Napiši `/root/kql/drzave.kql`: pet država sa najviše događaja, kolone `State` i `Dogadjaja`, od najveće prema manjoj. Rezultat snimi u `/root/kql/drzave.csv`.

```kql
StormEvents
| summarize Dogadjaja = count() by State
| ...
```

<!-- verify
[ -f /root/kql/drzave.kql ] || { echo "nema /root/kql/drzave.kql"; exit 1; }
grep -q '\.save' /root/kql/drzave.kql || { echo "drzave.kql treba .save /root/kql/drzave.csv"; exit 1; }
rm -f /root/kql/drzave.csv; kql /root/kql/drzave.kql >/dev/null 2>&1
kql-isto /root/kql/drzave.csv 'StormEvents | summarize Dogadjaja = count() by State | top 5 by Dogadjaja desc' || { echo "rezultat nije tačan (kolone State, Dogadjaja; 5 redova; opadajuće)"; head -7 /root/kql/drzave.csv 2>/dev/null; exit 1; }
-->
<!-- hint
`top 5 by Dogadjaja desc` sortira i ograniči u jednom koraku (isto kao `order by … desc | take 5`).
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

## Šteta po tipu događaja

Napiši `/root/kql/steta.kql`: samo događaji sa `DamageProperty` većom od 0, ukupna šteta na imovini po `EventType` u koloni `Steta`, tri tipa sa najvećom štetom. Snimi u `/root/kql/steta.csv`.

<!-- verify
[ -f /root/kql/steta.kql ] || { echo "nema /root/kql/steta.kql"; exit 1; }
rm -f /root/kql/steta.csv; kql /root/kql/steta.kql >/dev/null 2>&1
kql-isto /root/kql/steta.csv 'StormEvents | where DamageProperty > 0 | summarize Steta = sum(DamageProperty) by EventType | top 3 by Steta desc' || { echo "rezultat nije tačan (kolone EventType, Steta; 3 reda)"; head -5 /root/kql/steta.csv 2>/dev/null; exit 1; }
grep -qi 'where' /root/kql/steta.kql || { echo "filtriraj where DamageProperty > 0"; exit 1; }
-->
<!-- hint
Filtriraj što ranije (`where` prije `summarize`): u Sentinelu je to razlika između upita od sekunde i upita koji istekne.
-->
<!-- solution
printf 'StormEvents\n| where DamageProperty > 0\n| summarize Steta = sum(DamageProperty) by EventType\n| top 3 by Steta desc\n.save /root/kql/steta.csv\n' > /root/kql/steta.kql
kql /root/kql/steta.kql >/dev/null
-->

## Tornada po mjesecima

Napiši `/root/kql/tornada.kql`: broj događaja tipa `Tornado` po mjesecu, kolone `Mjesec` (početak mjeseca, `startofmonth(StartTime)`) i `Tornada`, sortirano od januara prema decembru. Snimi u `/root/kql/tornada.csv`.

U Sentinelu bi ovakav upit završio sa `| render timechart`.

<!-- verify
[ -f /root/kql/tornada.kql ] || { echo "nema /root/kql/tornada.kql"; exit 1; }
rm -f /root/kql/tornada.csv; kql /root/kql/tornada.kql >/dev/null 2>&1
kql-isto /root/kql/tornada.csv 'StormEvents | where EventType == "Tornado" | summarize Tornada = count() by Mjesec = startofmonth(StartTime) | order by Mjesec asc' || { echo "rezultat nije tačan (kolone Mjesec, Tornada; 12 redova; rastuće po mjesecu)"; head -4 /root/kql/tornada.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
StormEvents
| where EventType == "Tornado"
| summarize Tornada = count() by Mjesec = startofmonth(StartTime)
| order by Mjesec asc
```
`==` je osjetljiv na velika i mala slova; `=~` nije.
-->
<!-- solution
printf 'StormEvents\n| where EventType == "Tornado"\n| summarize Tornada = count() by Mjesec = startofmonth(StartTime)\n| order by Mjesec asc\n.save /root/kql/tornada.csv\n' > /root/kql/tornada.kql
kql /root/kql/tornada.kql >/dev/null
-->
