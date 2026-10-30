## Ciljevi ispita: 4.1 i 4.2

Domen 4 (**Reporting and Communication**) nosi 16% ispita. Mali je, ali pitanja su scenarijska i „mekša“: ko je pravi primalac informacije, koji izvještaj odgovara publici i koja metrika mjeri traženo.

- **4.1** objasniti važnost izvještavanja i komunikacije o ranjivostima: vulnerability scan reports, compliance findings, risk scorecards, action plans (escalation, dependencies), **inhibitors to remediation**, identifikacija stakeholdera, metrike i KPI (trends, top risks, SLA),
- **4.2** objasniti važnost izvještavanja i komunikacije u sigurnosnim operacijama i odgovoru na incidente: incident declaration and escalation, executive summary, communication plan (legal, PR, regulatori, policija, klijenti), operational security awareness (communication channels), post-incident reporting (after action report, lessons learned, RCA), shift/incident handover, internal threat intelligence report, metrike (alert volume, false-positive rate, true-positive rate, MTTC, MTTD, MTTR…, phishing click rate).

Poslije modula treba da znaš da izabereš pravi format izvještaja za publiku, prepoznaš inhibitor remedijacije iz scenarija, izračunaš osnovne SOC metrike i znaš ko mora biti obaviješten.

## Izvještavanje o ranjivostima (4.1)

### Vulnerability scan reports

Skener (Nessus, Qualys, OpenVAS, ili u našem labu `trivy`/`osv-scanner`) daje sirove nalaze. Izvještaj mora biti prilagođen publici:

| Publika | Šta treba | Format |
|---|---|---|
| **Sistem administratori / DevOps** | Tačan host, paket, verzija, CVE, fiksna verzija, koraci | Detaljna lista po assetu, tiket po nalazu ili grupi |
| **Menadžer tima / vlasnik servisa** | Koliko ima, koliko kasni, koji su kritični | Sažetak po sistemu, SLA status |
| **CISO / uprava** | Trend rizika, top rizici, usklađenost | Risk scorecard, dashboard, executive summary |
| **Revizor / compliance** | Dokaz o skeniranju i remedijaciji u roku | Compliance izvještaj (PCI DSS ASV, izuzeci) |

Primjer pretvaranja sirovog izlaza u tehničku listu za vlasnika sistema:

```
$ trivy image --format json -o scan.json registry.local/payments:2.4
$ jq -r '.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL" or .Severity=="HIGH")
        | [.VulnerabilityID, .PkgName, .InstalledVersion, .FixedVersion, .Severity] | @tsv' scan.json
CVE-2024-45337  golang.org/x/crypto  v0.21.0  0.31.0   CRITICAL
CVE-2025-22869  golang.org/x/crypto  v0.21.0  0.35.0   HIGH
CVE-2024-6119   libssl3              3.0.13   3.0.15   HIGH
```

Dobar izvještaj za uprave ne sadrži ovakvu tabelu nego zaključak: „platni servis ima 1 kritičnu ranjivost sa javnim exploitom, rok za remedijaciju je 7 dana, popravka je u toku“.

Tipični dijelovi izvještaja o skeniranju:

| Dio | Sadržaj |
|---|---|
| Obim i metoda | Koji rasponi/asseti, autentifikovano ili ne, alat i verzija plugin baze, datum |
| Sažetak | Broj nalaza po ozbiljnosti, poređenje sa prošlim skenom, top rizici |
| Nalazi | Asset, port/servis, CVE, CVSS (i vektor), EPSS, KEV, dokaz (banner, verzija paketa) |
| Preporuke | Ispravka (verzija, konfiguracija), workaround, kompenzaciona kontrola |
| Izuzeci | Prihvaćeni rizici i false positive sa obrazloženjem i datumom isteka |

Primjer dokaza iz mrežnog skena koji ide uz nalaz (verzija servisa kao razlog nalaza):

```
$ nmap -sV -p 22,443 127.0.0.1
PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)
443/tcp open  ssl/http nginx 1.22.1
```

Neautentifikovani sken vidi samo banner; autentifikovani sken provjerava stvarnu verziju paketa i daje manje false positive nalaza (backportovane zakrpe). To je čest razlog zašto vlasnik sistema osporava nalaz, pa izvještaj treba navesti metodu.

Prioritet u izvještaju dolazi iz modula 07: CVSS + **EPSS** + **CISA KEV** + kritičnost asseta. Nalaz sa KEV liste uvijek ide u „top rizike“.

```
$ jq -r '.vulnerabilities[] | select(.cveID=="CVE-2024-6387") | .dateAdded, .dueDate' /opt/kurs/data/kev.json
```

(Ako nema izlaza, CVE nije u lokalnoj kopiji KEV-a; za stavke koje jesu, `dueDate` je rok za US federalne agencije, koristan i kao interni benchmark.)

### Compliance findings

Nalazi usklađenosti porede stanje sa zahtjevom standarda ili regulative: PCI DSS (kvartalni interni i eksterni ASV skenovi, ispravka high-risk nalaza), HIPAA, ISO 27001, CIS Benchmarks, interne politike. Izvještaj navodi **kontrolu**, **nalaz**, **dokaz** i **plan** (ili odobren izuzetak sa kompenzacionom kontrolom).

### Risk scorecards

Scorecard je sažet pregled rizika po poslovnoj jedinici, sistemu ili vlasniku, obično sa ocjenom ili bojom (crveno/žuto/zeleno):

| Poslovna jedinica | Kritične otvorene | Van SLA | KEV nalazi | Trend (30 dana) | Ocjena |
|---|---|---|---|---|---|
| Plaćanja | 1 | 0 | 1 | ↓ | Žuto |
| HR portal | 4 | 3 | 2 | ↑ | Crveno |
| Interni wiki | 0 | 0 | 0 | → | Zeleno |

Scorecard služi upravi da uporedi jedinice i pokrene odgovornost vlasnika.

### Action plans: escalation i dependencies

**Action plan** (remediation plan) za nalaz ili grupu nalaza sadrži: šta se radi (patch, konfiguracija, kompenzaciona kontrola), vlasnika, rok, **zavisnosti** i put **eskalacije**.

- **Dependencies**: remedijacija zavisi od nečega drugog: dobavljač mora izdati verziju, aplikacija zahtijeva novu verziju Jave, potreban je change window, druga ekipa mora prvo migrirati bazu.
- **Escalation**: ako vlasnik ne ispuni rok iz SLA-a, nalaz se eskalira višem menadžmentu (i na kraju risk owneru koji mora formalno prihvatiti rizik ili obezbijediti resurse).

```
Nalaz:       CVE-2024-6387 (OpenSSH regreSSHion) na bastion-01
Akcija:      Upgrade openssh-server na 1:9.2p1-2+deb12u3
Vlasnik:     Infrastruktura (D. Hodžić)        Rok (SLA kritično): 7 dana
Zavisnost:   Change window u subotu; test pristupa jump hostu
Privremeno:  LoginGraceTime 0 + pristup samo sa VPN subneta (kompenzaciona kontrola)
Eskalacija:  Dan 8 -> menadžer infrastrukture; dan 15 -> CISO / risk acceptance
```

> **Na ispitu:** ako vlasnik sistema ne zakrpi u roku i ne odgovara → **eskalacija** po dogovorenom putu (do risk ownera), ne „analitičar sam instalira patch“. Ako patch čeka novu verziju aplikacije drugog tima → **dependency** u action planu.

### Inhibitors to remediation

Ispit voli scenarij u kojem se ranjivost **ne može** odmah zakrpiti. Prepoznaj inhibitor i ponudi kompenzacionu kontrolu:

| Inhibitor | Primjer | Šta uraditi |
|---|---|---|
| **Contractual agreements** | Ugovor/garancija dobavljača zabranjuje izmjene na medicinskom uređaju; SLA ugovor sa klijentom zabranjuje downtime | Pregovor sa dobavljačem, segmentacija, monitoring |
| **Organizational governance** | Svaka promjena mora kroz CAB koji se sastaje mjesečno; nejasno vlasništvo | Hitni (emergency) change proces, jasan RACI |
| **Business process interruption** | Patch traži restart ERP-a usred zatvaranja godine | Zakazati u change window, privremena mitigacija (WAF, ACL) |
| **Degrading functionality** | Patch ili hardening kvari funkcionalnost (npr. isključenje TLS 1.0 ruši stari klijent) | Testiranje, izuzetak sa rokom, kompenzaciona kontrola |
| **Legacy systems** | Windows Server 2012 bez podrške, nema više zakrpa | Izolacija, plan zamjene, virtual patching, pojačan monitoring |
| **Proprietary systems** | Zatvoren sistem (SCADA, uređaj dobavljača) koji kupac ne smije mijenjati | Zahtjev dobavljaču, mrežna segmentacija |
| **Patch availability** | Zakrpa još ne postoji (zero-day) ili dobavljač kasni | Workaround iz advisoryja, IPS potpis, onemogućiti ranjivu funkciju |

> **Na ispitu:** „Sistem pokreće proizvodnu liniju, dobavljač ne dozvoljava instalaciju zakrpa, a sistem ne smije stati“ → kombinacija **proprietary/contractual** inhibitora; NAJBOLJI odgovor je **kompenzaciona kontrola** (segmentacija, ACL, monitoring), ne „ignoriši“ i ne „zakrpi bez odobrenja“.

### Stakeholder identification and communication

Ko treba da zna o ranjivostima: **vlasnici sistema i aplikacija** (izvršavaju), **IT operacije / DevOps**, **change management (CAB)**, **risk owneri i uprava** (prihvataju rizik, daju resurse), **compliance/revizija**, **dobavljači** (third-party proizvodi), **pravni tim** (ugovorne obaveze). Komunikacija treba biti redovna (sedmični izvještaj, mjesečni scorecard) i dvosmjerna (vlasnici prijavljuju false positive i izuzetke).

Primjer **RACI** matrice za remedijaciju kritičnog nalaza (R = izvršava, A = odgovoran, C = konsultovan, I = informisan):

| Aktivnost | VM tim | Vlasnik sistema | CAB | CISO / risk owner |
|---|---|---|---|---|
| Skeniranje i validacija nalaza | R/A | C | | I |
| Primjena zakrpe | C | R/A | C | I |
| Odobrenje promjene | | C | R/A | |
| Prihvatanje rizika (izuzetak) | C | R | | A |
| Verifikacija ponovnim skenom | R/A | I | | I |

Bez jasnog vlasnika nalaz „visi“ između timova; zato je **nejasno vlasništvo** klasičan governance inhibitor.

Kratka poruka vlasniku je često efikasnija od PDF-a od 200 strana:

```
Predmet: [KRITIČNO, SLA 7 dana] OpenSSH na bastion-01 (CVE-2024-6387)
Šta: udaljeno izvršavanje koda prije autentikacije, javni PoC, internet-facing host.
Ispravka: openssh-server >= 1:9.2p1-2+deb12u3. Privremeno: LoginGraceTime 0.
Rok: 10.10.2026. Status pratimo u tiketu VM-2291; ponovni sken nakon promjene.
```

### Metrike i KPI za ranjivosti

| Metrika | Šta pokazuje |
|---|---|
| **Trends** | Broj otvorenih nalaza po ozbiljnosti kroz vrijeme; nove vs zatvorene; da li program napreduje |
| **Top risks** | Najrizičniji nalazi/asseti (KEV, visok EPSS, internet-facing, kritičan asset) |
| **SLA compliance** | Procenat nalaza zatvorenih u roku (npr. kritično 7 dana, visoko 30, srednje 90) |
| **Mean time to remediate** (MTTR za ranjivosti) | Prosječno vrijeme od otkrivanja do potvrđene ispravke |
| **Vulnerability age / backlog** | Koliko dugo su nalazi otvoreni; koliko je van SLA-a |
| **Scan coverage** | Procenat asseta koji su skenirani (i autentifikovano) |

Izračun SLA usklađenosti iz izvoza tiketa:

```
$ jq -r '[.[] | select(.severity=="critical" and .closed)
          | ((.closed|fromdateiso8601) - (.found|fromdateiso8601))/86400] as $d
          | "zatvoreno: \($d|length)  u roku (<=7d): \([$d[]|select(.<=7)]|length)  prosjek dana: \($d|add/length|.*10|round/10)"' vulns.json
zatvoreno: 24  u roku (<=7d): 19  prosjek dana: 5.8
```

SLA usklađenost je 19/24 ≈ 79%. Ako je cilj 95%, to je tema za izvještaj sa eskalacijom.

> **Na ispitu:** „Uprava želi da vidi da li program upravljanja ranjivostima napreduje“ → **trend** metrike i scorecard kroz vrijeme, ne lista CVE-ova. „Mjeriti da li timovi poštuju rokove“ → **SLA** usklađenost.

## Izvještavanje u SecOps i IR (4.2)

### Incident declaration and escalation

**Deklaracija incidenta** je formalna odluka da događaj postaje incident (prema kriterijumima iz IR plana; u NIST 800-61r3 DE.AE-08). Od tog trenutka važe pravila: imenuje se incident commander, otvara se incident kanal, kreće sat za regulatorne rokove, uključuju se definisani stakeholderi. Eskalacija nakon deklaracije prati ozbiljnost: P1 obavezno uključuje CISO-a, pravni tim i komunikacije.

### Communication plan: ko mora znati

| Stakeholder | Zašto | Napomena |
|---|---|---|
| **Stakeholder identification** | Unaprijed popisani kontakti (sa zamjenama) po tipu incidenta | Dio pripreme; RACI |
| **Legal team** | Procjena obaveza obavještavanja, privilegija komunikacije, legal hold, ugovori | Uključiti rano; često sva eksterna komunikacija ide preko pravnog tima |
| **Public relations** | Jedinstvena, tačna poruka medijima i javnosti | Analitičari ne daju izjave |
| **Regulatory reporting agencies** | Zakonske obaveze i rokovi | Npr. GDPR: nadzornom tijelu u roku od **72 sata** od saznanja za povredu ličnih podataka; NIS2: rano upozorenje u **24 h**, obavještenje u **72 h**, završni izvještaj u roku od mjesec dana; SEC (US javne kompanije): Form 8-K u 4 radna dana od utvrđivanja materijalnosti |
| **Law enforcement** | Krivična djela (ransomware, iznuda, CSAM) | Odluku donose uprava i pravni tim; utiče na čuvanje dokaza |
| **Customers** | Pogođeni klijenti i partneri | Ugovorne obaveze (DPA, SLA), poruka usaglašena sa PR i pravnim timom |

> **Na ispitu:** analitičar koji primi upit novinara ga **preusmjerava na PR**. Odluku o obavještavanju policije ili regulatora donose **uprava i pravni tim** prema planu, ne pojedinačni analitičar. „Ko PRVI“ kod povrede ličnih podataka → obično **pravni tim** (procjena obaveza).

### Operational security awareness: communication channels

Tokom incidenta komunikacija mora biti **need-to-know** i sigurna:

- pretpostavi da je napadač možda u emailu i chat alatu: koristi **out-of-band** kanal (zaseban tenant, telefon, šifrovana aplikacija),
- ne pominji detalje incidenta u otvorenim kanalima, tiketima dostupnim svima ili na društvenim mrežama,
- kodno ime incidenta umjesto opisnog imena,
- ograniči listu primalaca; ne prosljeđuj IoC-e van tima bez odobrenja (napadač može pratiti javne TI izvore).

### Executive summary

Executive summary je za upravu: **jedna strana**, bez žargona, fokus na **poslovni uticaj**, rizik, šta je urađeno, šta se traži (odluka, budžet). Struktura:

```
Incident IR-2026-041 (P1) - sažetak za upravu, stanje 03.10.2026. 16:00
Šta se desilo:  Phishing email je omogućio napadaču pristup 3 laptopa u Računovodstvu.
Uticaj:         Nema dokaza o krađi podataka klijenata; 4 h zastoja fakturisanja.
Stanje:         Napad zadržan 02.10. u 08:45; sistemi očišćeni i vraćeni u rad.
Rizik:          Nizak rizik ponavljanja nakon blokiranja makroa i rotacije naloga.
Potrebna odluka: Odobriti nabavku FIDO2 ključeva za finansije (procjena 6.000 EUR).
```

### Post-incident reporting

| Izvještaj | Sadržaj | Publika |
|---|---|---|
| **After action report** (AAR) | Činjenice: timeline, obim, uticaj, preduzete akcije, šta je radilo i šta nije, korektivne akcije | Uprava, IR tim, revizija |
| **Lessons learned** | Sastanak (blameless) i zaključci: šta poboljšati u ljudima, procesu, tehnologiji; ažuriranje plana i playbookova | Svi učesnici |
| **Root cause analysis** | Zašto se desilo (5 Whys, fishbone), uzrok vs simptom | Tehnički timovi, risk owneri |

Kostur after action reporta:

```
AFTER ACTION REPORT  IR-2026-041   Klasifikacija: INTERNO / povjerljivo
1. Sažetak (executive summary)
2. Obim i uticaj: 3 hosta, 1 servisni nalog, 4 h zastoja fakturisanja, bez exfiltracije PII
3. Timeline (UTC): od isporuke emaila 08:09 do zatvaranja incidenta 05.10. 14:00
4. Metrike incidenta: dwell time 31 min, vrijeme do containmenta 31 min od alarma
5. Šta je radilo: EDR izolacija, playbook za phishing, out-of-band kanal
6. Šta nije radilo: GPO za makroe nije pokrivao OU Finansije; nije bilo detekcije za PsExec
7. Root cause: vidi RCA (prilog A)
8. Korektivne akcije: vlasnik, rok, verifikacija (prilog B)
9. Prilozi: lista IoC-a, ATT&CK mapiranje, chain of custody zapisi
```

Lessons learned sastanak se održava **ubrzo** nakon zatvaranja (dok je sjećanje svježe), uključuje sve uloge i fokusira se na proces, ne na krivca. Ključna pitanja: šta se desilo i kada, kako je osoblje postupilo, šta bi drugačije uradili, koje informacije su falile ranije, koji indikatori da se prate ubuduće, koji alati ili resursi trebaju.

### Shift/incident handover

U SOC-u 24/7 i u dugim incidentima, **handover** između smjena mora biti strukturiran da se ništa ne izgubi:

```
HANDOVER  02.10.2026 20:00 UTC  (dnevna -> noćna smjena)
Otvoreni incidenti:  IR-2026-041 (P1)  - hostovi izolovani, čeka se reimage HR-DT-03
Akcije u toku:       Forenzika memorije FIN-LT-11 (L. Petrić), ETA 23:00
Pratiti:             Novi pokušaji ka 203.0.113.0/24 (blok na FW, alarm aktivan)
Odluke na čekanju:   Pravni tim do 09:00 o obavještavanju klijenta X
Kontakti:            IR lead: A. Vojić (tel. u planu), dežurni infrastruktura: D. Hodžić
```

Dobar handover je pisan (u tiketu/incident kanalu), sa usmenim pregledom i jasnim vlasnikom svake otvorene stavke.

### Internal threat intelligence report

Interni TI izvještaj je **prilagođen organizaciji i okruženju**: ne prepričava generički vendor izvještaj, nego kaže šta znači za nas. Sadrži: relevantne prijetnje za industriju, opažene IoC-e i TTP-e (ATT&CK) iz vlastitih incidenata, da li smo izloženi (koje verzije imamo), pokrivenost detekcijama i preporuke. Publike: SOC (taktički IoC-i i detekcije), IT (operativno: šta zakrpiti), uprava (strateški trend).

> **Na ispitu:** „Izvještaj o novoj kampanji treba biti koristan SOC-u“ → **internal threat intel report** sa TTP-ovima mapiranim na ATT&CK i provjerom izloženosti u našem okruženju. Executive summary je za upravu, AAR je nakon incidenta.

## SOC metrike i KPI

| Metrika | Definicija | Napomena |
|---|---|---|
| **Alert volume** | Broj alarma po periodu/izvoru/pravilu | Rast bez rasta incidenata = šum, alert fatigue |
| **False-positive rate** | FP / (FP + TP) među trijažiranim alarmima | Visok FP → tuning pravila |
| **True-positive rate** | TP / (TP + FP) (u SOC praksi: udio alarma koji su stvarni) | Mjeri kvalitet detekcija |
| **Mean time to detect (MTTD)** | Prosjek od početka kompromitacije do detekcije | Mjeri vidljivost; vezano za dwell time |
| **Mean time to respond (MTTR)** | Prosjek od detekcije/alarma do početka odgovora ili containmenta | Mjeri brzinu SOC-a |
| **Mean time to remediate** | Prosjek od detekcije do potpune ispravke (i za ranjivosti) | „MTTR“ je dvosmislen: provjeri kontekst pitanja |
| **Mean time to close** | Prosjek od otvaranja do zatvaranja tiketa/incidenta | Uključuje dokumentaciju |
| **Phishing campaign click rate** | Kliknuli / primili u simuliranoj kampanji | Uz report rate pokazuje efekat awareness treninga |

Napomena o definicijama: u statistici je true-positive rate isto što i sensitivity (TP / (TP + FN)), ali FN se u SOC-u rijetko zna, pa se u praksi FP/TP stopa računa nad alarmima koje je analitičar zatvorio. Na ispitu se drži jednostavnog tumačenja: koliki udio alarma je stvaran, a koliki lažan.

Izračun iz izvoza tiketa (vremena u epoch sekundama):

```
$ jq -r 'map(select(.verdict!=null)) as $a
  | ($a|map(select(.verdict=="FP"))|length) as $fp | ($a|length) as $n
  | ($a|map(select(.verdict=="TP")) | map((.detected-.started)/3600) | add/length) as $mttd
  | ($a|map(select(.verdict=="TP")) | map((.contained-.detected)/60) | add/length) as $mttr
  | "alarma: \($n)  FP stopa: \($fp*100/$n|round)%  MTTD: \($mttd|.*10|round/10) h  MTTR: \($mttr|round) min"' alerts.json
alarma: 1240  FP stopa: 87%  MTTD: 19.4 h  MTTR: 42 min
```

Tumačenje: 87% lažnih alarma znači alert fatigue i potrebu za tuningom (modul 05, efikasnost). MTTD od 19 h je loš za ransomware scenarije; MTTR od 42 min je dobar.

Pravila za dobre metrike:

- metrika mora biti vezana za cilj (smanjiti rizik, ne „zatvoriti što više tiketa“),
- prati **trend**, ne samo jednu vrijednost,
- izbjegavaj metrike koje potiču loše ponašanje (npr. nagrađivanje brzog zatvaranja dovodi do površne trijaže),
- prikazuj po publici: SOC lead gleda FP po pravilu, uprava MTTD/MTTR trend i rizik.

> **Na ispitu:** „Mjeriti koliko brzo SOC otkriva prijetnje“ → **MTTD**; „koliko brzo reaguje nakon otkrivanja“ → **MTTR (respond)**; „koliko je pravilo bučno“ → **false-positive rate**; „efikasnost awareness programa“ → **phishing click rate** (uz stopu prijave) kroz više kampanja.

## Dashboardi

Dashboard je stalni vizuelni prikaz metrika, za razliku od periodičnog izvještaja. Primjeri:

| Dashboard | Publika | Sadržaj |
|---|---|---|
| SOC operativni | Analitičari, SOC lead | Otvoreni alarmi po ozbiljnosti, red čekanja, SLA tajmeri, top pravila po FP |
| Vulnerability management | Vlasnici sistema, VM tim | Otvoreni nalazi po timu, van SLA, KEV nalazi, trend |
| Izvršni | CISO, uprava | Risk score, MTTD/MTTR trend, incidenti po mjesecu, usklađenost |

Dobar dashboard ima mali broj ključnih brojeva, trendove i jasne pragove; ne prikazuje sve što SIEM može izbrojati.

## Rezime

- Izvještaj o ranjivostima prilagodi publici: detalji za administratore, scorecard i trendovi za upravu, dokaz za compliance.
- Action plan ima vlasnika, rok, **dependencies** i put **eskalacije** do risk ownera.
- Inhibitori remedijacije: contractual, governance, business process interruption, degrading functionality, legacy, proprietary, patch availability → odgovor je obično **kompenzaciona kontrola** + plan.
- KPI za ranjivosti: trends, top risks, **SLA** usklađenost, vrijeme do remedijacije.
- IR komunikacija: deklaracija i eskalacija po planu; legal, PR, regulatori (GDPR 72 h, NIS2 24/72 h), policija, klijenti; out-of-band kanali i need-to-know.
- Executive summary (jedna strana, poslovni uticaj), AAR, lessons learned (blameless), RCA, handover između smjena, interni TI izvještaj prilagođen okruženju.
- SOC metrike: alert volume, FP/TP stopa, **MTTD**, **MTTR** (respond/remediate), mean time to close, phishing click rate; prati trend i veži metriku za cilj.
