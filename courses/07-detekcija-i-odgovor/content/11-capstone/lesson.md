## Cilj capstonea

Faza 4 nema ispit: dokaz znanja su detekcije i plan odgovora koje možeš pokazati i objasniti. U capstone labu novi servis `kurs-pay` dobija kompletan „detection package“, onako kako bi ga dobio u firmi prije puštanja u produkciju:

1. **Telemetrija**: log stiže na pravo mjesto (rsyslog) i SIEM ga razumije (Wazuh dekoder).
2. **Detekcije**: pravila sa jasnim nivoom, korelacijom i ATT&CK oznakom.
3. **Integritet**: konfiguracija koja određuje rizik (limiti) je pod FIM-om.
4. **Prenosivost**: ista logika kao Sigma pravilo, testirano nad pozitivnim i negativnim primjerima, konvertovano za SIEM koji koristi centralni tim.
5. **Odgovor**: runbook koji dežurni može izvršiti bez tebe.

Lab ima odbrojavanje od 120 minuta.

## Kako izgleda dobar „detection package“

| Dio | Pitanje na koje odgovara | Gdje živi |
|---|---|---|
| Opis prijetnje | Šta tačno želimo uhvatiti i zašto je to rizik? | README pored pravila |
| Izvor podataka | Koji log, koja polja, koliko kasni? | dokumentacija izvora, dekoder |
| Logika | Uslov, prag, prozor korelacije | Wazuh/Sigma pravilo |
| Testovi | Pozitivni i negativni primjeri, uključujući granične | `testovi/` uz pravilo, CI |
| Lažni pozitivi | Ko legitimno radi isto? Kako ga isključujemo? | `falsepositives`, izuzeci |
| Ozbiljnost i ATT&CK | Koliko hitno, koja tehnika | `level`, `tags` / `<mitre>` |
| Odgovor | Šta dežurni radi kad se okine | runbook |

> **U praksi:** granični slučajevi (`999` i `1000`, „isti korisnik“ i „različiti korisnici“) hvataju najviše grešaka u pravilima. Piši ih prvo, pa tek onda pravilo.

## Wazuh i Sigma zajedno

Wazuh pravilo radi na hostu i u Wazuh manageru, odmah, i može pokrenuti active response. Sigma pravilo je format nezavisan od alata: isti fajl postaje Splunk, Elastic ili KQL upit kad centralni SOC koristi drugi SIEM. U praksi tim drži Sigma pravila u git repou (detection as code), a CI ih provjerava (`sigma check`), testira (Zircolite ili SIEM nad testnim podacima) i konvertuje.

```text
pravilo.yml ──► sigma check ──► testovi (pozitivni/negativni) ──► sigma convert ──► SIEM
     ▲                                                                              │
     └──────────────── podešavanje (lažni pozitivi, novi izvori) ◄─────── alarmi ───┘
```

## Runbook kao proizvod

Runbook čita neko ko nije pisao pravilo, često noću. Zato:

- svaki korak je radnja („blokiraj nalog operatera u kurs-pay“), ne savjet („razmotri blokadu“),
- komande su kompletne i kopiraju se direktno,
- jasno je **ko odlučuje** (incident commander, vlasnik servisa) i **koga se obavještava**,
- poslije svakog incidenta runbook se ažurira (sekcija „Nakon incidenta“).

> **U praksi:** runbook testiraj na vježbi (tabletop) prije prvog pravog incidenta. Najčešći nalaz je da dežurni nema prava da izvrši korak iz obuzdavanja.

## Šta pokazati u portfoliju

- Repo sa Wazuh pravilima i dekoderima, Sigma pravilima i testnim primjerima, plus CI koji ih provjerava.
- ATT&CK Navigator sloj pokrivenosti i lista praznina sa planom.
- Dva ili tri runbooka i kratak izvještaj sa vježbe.

Sljedeći korak u planu je **SC-200**: isti principi u Microsoft Sentinelu i Defender XDR-u, sa KQL-om umjesto Wazuh pravila.

## Rezime

- Detekcija je paket: izvor, logika, testovi, lažni pozitivi, ozbiljnost, ATT&CK i runbook.
- Granični testni slučajevi pišu se prije pravila.
- Wazuh pravilo reaguje lokalno i brzo; Sigma pravilo nosi istu logiku u bilo koji SIEM.
- Konfiguracija koja određuje rizik ide pod FIM.
- Runbook su konkretne radnje i odluke, testirane na vježbi.
