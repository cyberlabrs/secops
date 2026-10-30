## Ciljevi ispita: 7.10 – 7.15

Domen 7 (**Security Operations**) nosi 12,8% ispita (u outlineu iz 2024. 13%). Ovaj modul zatvara domen sa šest ciljeva koji se bave time šta radiš kada se nešto pokvari, izgori ili poplavi, i kako štitiš ljude i objekte:

- **7.10 Implement recovery strategies**: strategije čuvanja backupa (cloud, onsite, offsite, immutable, encrypted), više lokacija za obradu (multiple processing sites), otpornost sistema, visoka dostupnost (HA), Quality of Service (QoS) i tolerancija na greške (fault tolerance), strategije rezervnih lokacija (cold, warm, hot, resource capacity agreements).
- **7.11 Implement Disaster Recovery (DR) processes**: odgovor (response), osoblje (personnel), komunikacija (metode, prioritizacija), procjena (assessment), obnova (restoration), obuka i svijest (training and awareness), naučene lekcije (lessons learned), metrike (baseline, MTTR, MTBF).
- **7.12 Test disaster recovery plans (DRP)**: read-through/tabletop, walkthrough, simulation, parallel, full interruption, komunikacija (interna/eksterna).
- **7.13 Participate in Business Continuity (BC) planning exercises**.
- **7.14 Implement and manage physical security**: eksterne i interne sigurnosne kontrole.
- **7.15 Address personnel safety and security concerns**: putovanja (travel), upravljanje vanrednim situacijama (emergency management), sigurnosna obuka i svijest, prinuda (duress).

> U outlineu iz 2024. backup primjeri su bili samo „cloud storage, onsite, offsite“ (immutable i encrypted su novi), rezervne lokacije su bile „cold vs. hot“ (warm je sada eksplicitan), DR komunikacija nije imala „prioritization“, a pod-tačka **Metrics** (baseline, MTTR, MTBF) nije postojala. Cilj 7.13 se zvao „BC planning **and** exercises“, 7.14 je imao „**Perimeter** security controls“ umjesto „External“, a 7.15 je uz obuku navodio primjere insider threat, uticaj društvenih mreža i 2FA fatigue.

Analiza uticaja na poslovanje (**Business Impact Analysis, BIA**) i sam BCP program obrađeni su u modulu 3 (cilj 1.8). Ovdje pretpostavljamo da BIA već postoji i da su iz nje izašle ciljne vrijednosti oporavka; sada ih pretvaramo u tehničke strategije, procese i testove.

> **Na ispitu:** u svakom scenariju DR/BC i fizičke sigurnosti **ljudski život i bezbjednost su na prvom mjestu**. Ako je jedan od odgovora „evakuisati ljude“, „obezbijediti sigurnost osoblja“ ili „otvoriti vrata u slučaju požara (fail-safe)“, on gotovo uvijek pobjeđuje odgovore o podacima, opremi ili novcu.

## Ključne metrike oporavka (podsjetnik iz BIA)

Strategija oporavka se ne bira prema tehnologiji nego prema brojevima iz BIA.

| Metrika | Puni naziv | Pitanje na koje odgovara | Ko je određuje |
|---|---|---|---|
| **MTD** / **MAD** / **MTPD** | Maximum Tolerable Downtime / Maximum Allowable Disruption / Max. Tolerable Period of Disruption | Koliko dugo poslovni proces smije biti nedostupan prije neprihvatljive štete? | Vlasnik procesa / menadžment (BIA) |
| **RTO** | Recovery Time Objective | Za koliko vremena sistem mora biti ponovo dostupan? | BIA, mora biti ≤ MTD |
| **WRT** | Work Recovery Time | Koliko traje provjera i vraćanje podataka/rada nakon što je sistem tehnički podignut? | Tehnički i poslovni timovi |
| **RPO** | Recovery Point Objective | Koliko podataka (vremenski) smijemo izgubiti? | BIA; diktira učestalost backupa/replikacije |
| **RCO** | Recovery Consistency Objective | Koliko konzistentni podaci moraju biti nakon oporavka? | Rjeđe na ispitu |

Osnovna jednačina:

```
RTO + WRT ≤ MTD
```

**Primjer:** MTD za sistem naplate je 24 h. Restore iz backupa i podizanje servera traje 10 h (RTO), a provjera knjiženja i unos papirnih transakcija 6 h (WRT). 10 + 6 = 16 h ≤ 24 h, strategija je prihvatljiva. Ako bi restore trajao 20 h, 20 + 6 = 26 h > 24 h, pa treba brža strategija (warm site, replikacija).

**RPO primjer:** RPO je 4 h, a pun backup se radi jednom dnevno u 01:00. Ako se kvar desi u 23:00, gubi se 22 h podataka, što krši RPO. Rješenje: inkrementalni backup ili snapshot svaka 4 h, ili asinhrona replikacija.

> **Na ispitu:** RPO je o **podacima** (koliko unazad), RTO je o **vremenu** (koliko dugo do ponovnog rada). Kraći RPO znači češći backup/replikaciju; kraći RTO znači topliju lokaciju i više redundanse, pa i veću cijenu. Strategiju bira menadžment na osnovu odnosa cijene i rizika, a ne IT.

## Strategije backupa (7.10)

### Tipovi backupa

| Tip | Šta kopira | Archive bit | Brzina backupa | Brzina restore-a | Za restore treba |
|---|---|---|---|---|---|
| **Full** | Sve | Briše | Najsporiji | Najbrži | Samo zadnji full |
| **Incremental** | Promjene od zadnjeg backupa bilo kog tipa | Briše | Najbrži | Najsporiji | Zadnji full + **svi** inkrementalni |
| **Differential** | Promjene od zadnjeg full-a | **Ne briše** | Srednje (raste kroz sedmicu) | Srednje | Zadnji full + **zadnji** diferencijalni |
| **Synthetic full** | Spaja full i inkremente na backup serveru | — | Bez opterećenja produkcije | Kao full | Sintetički full |
| **Snapshot** | Stanje volumena u trenutku (copy-on-write) | — | Trenutno | Brzo | Isti storage (nije pravi backup ako je na istom sistemu) |

**Primjer:** full u nedjelju, kvar u četvrtak ujutru. Sa inkrementalnim: full + pon + uto + sri (4 skupa). Sa diferencijalnim: full + sri (2 skupa).

### Rotacija medija

- **GFS (Grandfather-Father-Son)**: dnevni (son), sedmični (father), mjesečni (grandfather) backup sa različitim retencijama.
- **Tower of Hanoi**: složenija šema koja daje dužu istoriju sa manje medija.
- **Pravilo 3-2-1**: 3 kopije podataka, na 2 različita medija, 1 van lokacije. Moderna varijanta **3-2-1-1-0**: plus 1 kopija offline/immutable i 0 grešaka pri verifikaciji restore-a.

### Gdje čuvati backup

| Strategija | Prednost | Mana | Napomena |
|---|---|---|---|
| **Onsite** | Brz restore | Isti događaj (požar, ransomware) uništava i original i backup | Samo za brze, lokalne oporavke |
| **Offsite** | Preživljava gubitak lokacije | Sporiji restore, transport | Dovoljna udaljenost da ista katastrofa ne pogodi obje lokacije |
| **Cloud storage** | Elastičnost, geo-redundansa, bez transporta medija | Zavisnost od mreže i provajdera, egress troškovi, jurisdikcija | Shared responsibility: konfiguracija i ključevi su tvoji |
| **Immutable** (WORM, object lock) | Ne može se izmijeniti ni obrisati do isteka retencije, ni sa admin pravima | Troši prostor, greška u retenciji je skupa | Ključna odbrana od ransomwarea koji prvo briše backupe |
| **Encrypted** | Povjerljivost pri transportu i gubitku medija | Gubitak ključa = gubitak backupa | Ključevi se čuvaju odvojeno od backupa i takođe imaju backup (escrow) |
| **Air-gapped / offline** | Fizički nedostupan napadaču | Spor, ručni proces | Traka u sefu je i dalje validna strategija |

Ostale tehnike prenosa podataka na udaljenu lokaciju:

- **Electronic vaulting**: periodičan masovni prenos backupa na udaljenu lokaciju.
- **Remote journaling**: prenos transakcionih logova (journala) češće, npr. svaki sat; omogućava restore do skoro posljednje transakcije.
- **Remote mirroring / replikacija**: **sinhrona** (RPO ≈ 0, ali latencija ograničava udaljenost) ili **asinhrona** (RPO sekunde–minute, bez ograničenja udaljenosti).

> **Na ispitu:** backup koji nikad nije testiran restore-om **nije backup**. Kada pitanje pita šta je NAJVAŽNIJE za strategiju backupa, traži odgovor o redovnom testiranju restore-a i čuvanju kopije van dometa istog incidenta (offsite/immutable), a ne o brzini ili cijeni medija.

## Otpornost, visoka dostupnost i tolerancija na greške (7.10)

| Pojam | Značenje | Primjer |
|---|---|---|
| **System resilience** | Sposobnost da sistem nastavi rad ili se brzo oporavi uprkos kvaru ili napadu | Graceful degradation, automatski failover |
| **High Availability (HA)** | Sistem dostupan u visokom procentu vremena, minimalni prekidi | Klaster, load balancer, aktivni/pasivni čvorovi |
| **Fault tolerance** | Rad bez prekida i pri otkazu komponente | RAID 1, dvostruki napajači, redundantne mrežne kartice |
| **Redundancy** | Duplirane komponente da nema single point of failure | N+1 hlađenje, dva ISP-a |
| **QoS** | Prioritet kritičnom saobraćaju pod opterećenjem | VoIP i kontrolni saobraćaj ispred backup saobraćaja |

Razlika: HA dopušta kratak prekid (failover traje sekunde), fault tolerance teži nultom prekidu. Fault tolerance je skuplja.

### Dostupnost u „devetkama“

| Dostupnost | Dozvoljeni prekid godišnje |
|---|---|
| 99% | ~3,65 dana |
| 99,9% | ~8,76 h |
| 99,99% | ~52,6 min |
| 99,999% | ~5,26 min |

Dostupnost iz pouzdanosti: `A = MTBF / (MTBF + MTTR)`. Ako je MTBF 9.990 h a MTTR 10 h, A = 9.990 / 10.000 = 99,9%.

### RAID

| Nivo | Tehnika | Min. diskova | Tolerancija | Napomena |
|---|---|---|---|---|
| **RAID 0** | Striping | 2 | **Nema** | Samo performanse, nije fault tolerant |
| **RAID 1** | Mirroring | 2 | 1 disk | 50% kapaciteta |
| **RAID 5** | Striping + distribuirani parity | 3 | 1 disk | Spor rebuild na velikim diskovima |
| **RAID 6** | Dvostruki parity | 4 | 2 diska | Bolji za velike nizove |
| **RAID 10 (1+0)** | Mirror pa stripe | 4 | 1 po mirroru | Performanse + redundansa |

RAID nije backup: brisanje, ransomware i korupcija se trenutno repliciraju na sve diskove.

### Ostali elementi otpornosti

- **Napajanje**: UPS (premošćava kratke prekide i daje vrijeme za uredno gašenje), generator (dugi prekidi, treba gorivo i testiranje), dvostruki napojni vodovi. Pojmovi: **fault** (trenutni gubitak), **blackout** (dugi gubitak), **sag/dip** (kratki pad napona), **brownout** (dugi pad), **spike** (kratki skok), **surge** (dugi skok), **inrush** (početni udar pri uključenju).
- **Clustering** (aktivno/aktivno ili aktivno/pasivno), **load balancing**, **geo-redundansa** u više regiona/zona.
- **Multiple processing sites**: više lokacija koje istovremeno obrađuju opterećenje (active-active), pa gubitak jedne smanjuje kapacitet ali ne prekida rad. U cloudu: multi-AZ i multi-region.

## Strategije rezervnih lokacija (7.10)

| Lokacija | Šta ima | Vrijeme aktivacije | Cijena | Testiranje |
|---|---|---|---|---|
| **Cold site** | Prostor, struja, klima, bez opreme i podataka | Sedmice | Najniža | Teško realno testirati |
| **Warm site** | Prostor i dio opreme, povezivost; podaci nisu aktuelni | Sati do dana | Srednja | Djelimično |
| **Hot site** | Kompletna oprema, aktuelni ili skoro aktuelni podaci | Minuti do sati | Visoka | Da |
| **Mirrored / redundant site** | Potpuna kopija koja radi paralelno (active-active) | Trenutno | Najviša | Stalno |
| **Mobile site** | Kamion/kontejner sa opremom | Sati–dani | Srednja | Da |
| **Cloud DR (DRaaS)** | Pilot light, warm standby, multi-site u cloudu | Zavisi od modela | Plaćaš po korištenju | Lako |

Ugovorni modeli:

- **Reciprocal agreement (mutual assistance)**: dvije organizacije se dogovore da ugoste jedna drugu. Jeftino, ali teško provodivo, problem kapaciteta, povjerljivosti i istovremene katastrofe u istom regionu. ISC2 ga smatra najslabijom opcijom.
- **Service bureau / ugovor sa vendorom**: provajder garantuje kapacitet po potrebi.
- **Resource capacity agreement**: ugovor kojim provajder (npr. DR ili cloud) garantuje rezervisan kapacitet (procesorski, storage, prostor) u slučaju katastrofe; ključno je provjeriti da isti kapacitet nije obećan previše klijenata (oversubscription).

Cloud analogija: **backup & restore** ≈ cold, **pilot light** ≈ cold/warm (samo jezgro, npr. baza, radi), **warm standby** ≈ warm (umanjena verzija radi), **multi-site active-active** ≈ hot/mirrored.

> **Na ispitu:** izbor lokacije uvijek vežeš za MTD/RTO. Ako je MTD 2 sedmice, hot site je **rasipanje novca**; ako je MTD 4 h, cold site je **neprihvatljiv**. Najisplativija strategija je ona koja jedva zadovoljava RTO, ne ona koja je najbrža.

## DR procesi (7.11)

**Disaster Recovery Plan (DRP)** je tehnički, IT-orijentisan dio šireg **Business Continuity Plana (BCP)**. BCP drži poslovanje u radu tokom poremećaja; DRP vraća IT sisteme i lokaciju u normalan rad.

| | BCP | DRP |
|---|---|---|
| Fokus | Kritični poslovni procesi | IT sistemi, podaci, lokacija |
| Vremenski okvir | Tokom i poslije poremećaja | Neposredno poslije katastrofe |
| Pokretač | Strateški, vlasnik je izvršni menadžment | Taktički, tehnički timovi |
| Uključuje | BIA, strategije kontinuiteta, DRP, COOP, krizno komuniciranje | Response, assessment, restoration, failback |

### Faze DR procesa

| Faza | Šta se radi |
|---|---|
| **Response (odgovor)** | Aktivacija plana, prvo bezbjednost ljudi, okupljanje tima, proglašenje katastrofe od ovlaštene osobe |
| **Assessment (procjena)** | Procjena štete i obima (damage assessment), odluka da li se prelazi na rezervnu lokaciju |
| **Restoration (obnova)** | Podizanje kritičnih sistema na rezervnoj lokaciji po prioritetu iz BIA, zatim obnova primarne lokacije |
| **Failback / reconstitution** | Povratak na primarnu lokaciju |
| **Lessons learned** | Post-incident review, ažuriranje plana |

Važni principi obnove:

- Na rezervnu lokaciju se prvo prebacuju **najkritičniji** procesi (najmanji MTD).
- Pri povratku na primarnu lokaciju prvo se vraćaju **najmanje kritični** procesi, jer oni služe kao test da je primarna lokacija zaista ispravna. Kritični procesi ostaju na rezervnoj lokaciji dok se primarna ne dokaže.
- Katastrofa se zvanično završava tek kada se sva operacija vrati na primarnu (ili novu trajnu) lokaciju.

> **Na ispitu:** kada se vraćaš na primarnu lokaciju, **prvo se vraćaju najmanje kritične funkcije**. Ovo je klasična zamka jer je suprotno logici pri prelasku na rezervnu lokaciju.

### Osoblje (personnel)

- Jasne uloge: DR koordinator, damage assessment tim, recovery tim, salvage tim (spašavanje i obnova primarne lokacije), komunikacioni tim, pravni i HR predstavnik.
- **Cross-training** i zamjenici: plan ne smije zavisiti od jedne osobe.
- Briga o ljudima: porodice, smještaj, prevoz, psihološka podrška, isplata plata. Osoblje koje brine za porodicu neće raditi oporavak.
- Pozivno stablo (**call tree**) za mobilizaciju.

### Komunikacija (metode i prioritizacija)

- **Metode**: telefonsko pozivno stablo, SMS i automatizovani sistemi masovnog obavještavanja, satelitski telefoni, radio, out-of-band kanali (ako je e-mail pao ili je kompromitovan, ne koristiš ga), unaprijed pripremljene web stranice za status.
- **Prioritizacija**: prvo hitne službe i bezbjednost osoblja, zatim DR tim i menadžment, zatim zaposleni, zatim klijenti, partneri, regulatori, i na kraju mediji. Samo ovlašteni portparol (**PR/spokesperson**) govori medijima, sa unaprijed odobrenim porukama.
- Regulatorna obavještenja imaju zakonske rokove (npr. GDPR 72 h za povredu podataka), pa ulaze u plan.

### Obuka i svijest

Svaki član DR tima mora znati svoju ulogu bez čitanja plana prvi put tokom katastrofe. Svi zaposleni treba da znaju osnovno: evakuacione puteve, mjesto okupljanja, kome se javljaju. Obuka se ponavlja pri promjeni plana, osoblja ili sistema.

### Metrike (baseline, MTTR, MTBF)

| Metrika | Formula / značenje | Upotreba |
|---|---|---|
| **Baseline** | Normalni nivo performansi i dostupnosti prije incidenta | Referenca za „oporavljeno“ i za poređenje u lessons learned |
| **MTBF** (Mean Time Between Failures) | Ukupno vrijeme rada / broj kvarova (popravljive komponente) | Pouzdanost, planiranje rezervnih dijelova |
| **MTTF** (Mean Time To Failure) | Prosječan vijek nepopravljive komponente | Planiranje zamjene |
| **MTTR** (Mean Time To Repair/Resolve/Recover) | Ukupno vrijeme popravke / broj kvarova | Efikasnost oporavka, mora biti ispod RTO |
| **Dostupnost** | MTBF / (MTBF + MTTR) | SLA |

**Primjer računa:** storage niz je radio 8.760 h (godinu) i imao 4 kvara. Ukupno vrijeme popravke je bilo 20 h.

- MTBF = (8.760 − 20) / 4 = 2.185 h (često se aproksimira sa 8.760 / 4 = 2.190 h)
- MTTR = 20 / 4 = 5 h
- Dostupnost = 2.185 / (2.185 + 5) ≈ 99,77%

Ako je RTO za taj sistem 4 h, MTTR od 5 h pokazuje da strategija ne zadovoljava cilj, pa je potrebna redundansa ili brži proces.

### Lessons learned

Nakon svakog DR događaja i testa: šta je radilo, šta nije, gdje su se RTO/RPO prekoračili, šta se mijenja u planu. Rezultat je ažuriran plan i akcioni plan sa vlasnicima i rokovima, a ne traženje krivca.

## Testiranje DR planova (7.12)

Testovi se poređaju od najmanje do najviše ometajućih:

| Test | Opis | Uticaj na produkciju | Šta dokazuje |
|---|---|---|---|
| **Read-through (checklist)** | Članovi samostalno čitaju plan i provjeravaju kontakte, procedure | Nikakav | Plan je aktuelan i potpun |
| **Tabletop / structured walkthrough** | Tim zajedno u sobi prolazi kroz scenarij, diskusija | Nikakav | Razumijevanje uloga, rupe u planu |
| **Walkthrough** | Učesnici fizički obilaze korake (lokacije, oprema) bez stvarne aktivacije | Nikakav | Praktična izvodljivost koraka |
| **Simulation** | Simulira se katastrofa, tim izvodi reakciju do određene tačke, bez prebacivanja produkcije | Minimalan | Reakcija pod pritiskom |
| **Parallel** | Sistemi se podižu na rezervnoj lokaciji i obrađuju podatke paralelno; primarna radi normalno | Mali (opterećenje, troškovi) | Rezervna lokacija stvarno radi |
| **Full interruption (full-scale)** | Primarna lokacija se gasi, rad prelazi na rezervnu | **Visok rizik** | Potpuni dokaz; može izazvati stvarnu katastrofu |

Napomena o terminologiji: neki izvori (i stariji ISC2 materijal) koriste „structured walkthrough“ kao sinonim za tabletop. Outline navodi oba odvojeno; ključ je redoslijed rasta ometanja.

**Komunikacija tokom testa:**

- **Interna**: najava testa učesnicima i menadžmentu, status tokom testa, jasna oznaka „OVO JE TEST“ u svim porukama da se ne izazove panika.
- **Eksterna**: obavještavanje vendora, DR provajdera, ISP-a, ponekad regulatora ili klijenata (posebno za parallel i full interruption). U outlineu iz 2024. primjeri su bili stakeholders, status testa i regulatori.

> **Na ispitu:** full interruption test zahtijeva **odobrenje višeg menadžmenta** i izvodi se tek kada su manje ometajući testovi uspješni. Ako pitanje pita koji test NAJBOLJE potvrđuje rad rezervne lokacije **bez uticaja na produkciju**, odgovor je **parallel**.

## BC vježbe (7.13)

Uloga sigurnosnog stručnjaka u BC programu je da **učestvuje** (planiranje vodi vlasnik poslovanja i BC koordinator, uz podršku višeg menadžmenta). Vježbe potvrđuju BCP kao cjelinu, a ne samo IT:

- **Ciljevi vježbe**: definisani unaprijed (npr. potvrditi da se platni promet nastavi za 4 h sa ručnim procedurama).
- **Učesnici**: poslovne jedinice, IT, sigurnost, pravna služba, HR, komunikacije, ključni dobavljači.
- **Scenarij**: realan i zasnovan na procjeni rizika (pandemija, gubitak data centra, ransomware, otkaz ključnog dobavljača).
- **Posmatrači (observers)** i **facilitator** bilježe nalaze.
- **After-action report** i ažuriranje BCP-a.
- Učestalost: najmanje godišnje i pri značajnoj promjeni (reorganizacija, nova lokacija, novi kritični sistem).

Životni ciklus BCP-a (NIST SP 800-34, ISO 22301): inicijacija i politika → BIA → preventivne kontrole → strategije oporavka → razvoj plana → **testiranje, obuka i vježbe** → održavanje plana. ISO 22301 koristi termin **exercising** za vježbe, a ISO 22313 daje smjernice.

**COOP (Continuity of Operations Plan)** održava esencijalne funkcije na alternativnoj lokaciji do 30 dana (NIST termin). **Crisis communications plan** i **Occupant Emergency Plan (OEP)** su srodni planovi.

> **Na ispitu:** BCP mora imati **podršku i odobrenje višeg menadžmenta**; najčešći razlog neuspjeha BCP-a je plan koji se ne održava i ne testira. Ako se pita šta je PRVI korak u BC planiranju, odgovor je inicijacija projekta i podrška menadžmenta (politika), a ne tehnička strategija.

## Fizička sigurnost (7.14)

Fizička sigurnost slijedi slojevit pristup (**defense in depth**) i redoslijed funkcija: **deter → deny → detect → delay → determine → decide/respond**. Dizajn prostora: **CPTED** (Crime Prevention Through Environmental Design) koristi prirodni nadzor (vidljivost), prirodnu kontrolu pristupa (usmjeravanje kretanja) i teritorijalno pojačanje (jasno označen privatni prostor).

### Eksterne kontrole (perimetar i lokacija)

| Kontrola | Detalji |
|---|---|
| **Izbor lokacije** | Rizik od poplava, zemljotresa, kriminala; blizina hitnih službi; neupadljivost objekta |
| **Ograde** | 1–1,2 m odvraća slučajne prolaznike; 1,8–2,1 m teško se preskače; 2,4 m sa bodljikavom žicom zaustavlja odlučnog napadača |
| **Bollards (stubići)** | Spriječavaju proboj vozilom |
| **Rasvjeta** | NIST standard: kritične zone 2 stope visine i 2 foot-candle osvjetljenja; svjetlo usmjereno ka spolja, prema napadaču, ne u oči čuvara |
| **CCTV** | Odvraća i detektuje; snimci kao dokaz; PTZ, analitika |
| **Čuvari i psi** | Najfleksibilnija kontrola (procjena, odluka), ali skupa i podložna socijalnom inženjeringu |
| **Kapije i parking** | Kontrola ulaza vozila, odvojen parking posjetilaca |

### Interne kontrole

| Kontrola | Detalji |
|---|---|
| **Mantrap / access control vestibule** | Dvoja vrata, samo jedna otvorena; sprečava tailgating i piggybacking |
| **Turnstiles** | Prolaz jedne osobe |
| **Brave** | Mehaničke (pin tumbler, kombinacijske), elektronske, pametne kartice, biometrija |
| **Badge i registar posjetilaca** | Posjetioci u pratnji (escort), vidljive oznake |
| **Zoniranje** | Javne zone, kancelarije, data centar; strožija kontrola prema unutra |
| **Senzori** | Pokret, vibracija, kontakt na vratima i prozorima, staklo |
| **Server sala** | Bez prozora, unutrašnji dio zgrade, ne u podrumu (poplava) ni na zadnjem spratu (krov), zidovi od ploče do ploče, logovanje pristupa |
| **Okolina** | Temperatura 18–27 °C, vlažnost 40–60% (prenisko = statički elektricitet, previsoko = korozija/kondenzacija), pozitivan pritisak vazduha |

### Fail-safe vs fail-secure

| | Fail-safe (fail-open) | Fail-secure (fail-closed) |
|---|---|---|
| Ponašanje pri nestanku struje | Vrata se otključaju | Vrata ostaju zaključana |
| Prioritet | Ljudski život | Zaštita imovine |
| Gdje | Izlazi za evakuaciju, glavna vrata zgrade | Sefovi, server sala (sa ručnim izlazom iznutra) |

### Zaštita od požara

| Klasa (US) | Gorivo | Sredstvo za gašenje |
|---|---|---|
| **A** | Obični zapaljivi materijali (papir, drvo) | Voda, pjena |
| **B** | Zapaljive tečnosti | CO₂, pjena, prah |
| **C** | Električna oprema | CO₂, čisti agensi (FM-200, Novec 1230), **ne voda** |
| **D** | Zapaljivi metali | Suhi prah |
| **K** | Ulja za kuvanje | Mokra hemikalija |

Sistemi prskalica:

| Sistem | Kako radi | Upotreba |
|---|---|---|
| **Wet pipe** | Voda stalno u cijevima, aktivira se toplotom | Najčešći, najjeftiniji; rizik curenja |
| **Dry pipe** | Cijevi pod vazduhom, voda ulazi tek pri aktivaciji | Hladni prostori (smrzavanje) |
| **Pre-action** | Dvostepeno: detektor puni cijevi, pa toplota otvara glavu | **Preporučeno za data centre** (manje lažnih aktivacija) |
| **Deluge** | Sve glave otvorene, ogromna količina vode | Industrijski objekti, ne za IT |

Gasni sistemi (FM-200, Inergen, Novec) gase bez vode; **Halon** je zabranjen zbog ozonskog omotača. CO₂ je opasan za ljude, pa se koristi samo u prostorima bez ljudi ili sa odgodom i alarmom. Detektori: dima (jonizacioni, fotoelektrični), toplote (fiksna temperatura, rate-of-rise), plamena (IR/UV).

> **Na ispitu:** najvažniji cilj fizičke sigurnosti i zaštite od požara je **bezbjednost ljudi**. Zato izlazi moraju biti fail-safe, a gasni sistem mora imati alarm i odgodu prije ispuštanja. Kod izbora prskalica za data centar, **pre-action** je tipičan „BEST“ odgovor.

## Bezbjednost i sigurnost osoblja (7.15)

### Putovanja (travel)

- Procjena rizika destinacije prije puta (politička situacija, zdravlje, zakoni o šifrovanju i pregledu uređaja na granici).
- **Loaner** laptopi i telefoni sa minimalnim podacima; po povratku se reimaguju.
- VPN, full-disk encryption, izbjegavanje javnog Wi-Fi-ja, privacy filter na ekranu.
- Ne ostavljati uređaje u hotelskoj sobi (rizik „evil maid“ napada), ne prihvatati poklone USB uređaja.
- Praćenje lokacije zaposlenih (uz pristanak), plan evakuacije iz zemlje, kontakt za hitne slučajeve 24/7, putno osiguranje.

### Upravljanje vanrednim situacijama (emergency management)

- **Occupant Emergency Plan (OEP)**: evakuacija, sklanjanje (shelter-in-place), lockdown.
- Evakuacioni putevi, mjesta okupljanja, **floor warden**i koji provjeravaju prostorije i broje ljude.
- Vježbe evakuacije, osoblje obučeno za prvu pomoć.
- Saradnja sa hitnim službama; nakon događaja: briga o povrijeđenima, porodicama, komunikacija.
- Scenariji: požar, zemljotres, aktivni napadač, pandemija, hemijski incident.

### Sigurnosna obuka i svijest

Obuka specifična za bezbjednost osoblja: prepoznavanje socijalnog inženjeringa, tailgating, prijava sumnjivih situacija, ponašanje na putovanjima, zaštita od insajderske prijetnje, rizik objavljivanja lokacije i rasporeda na društvenim mrežama, odbijanje neočekivanih MFA zahtjeva (**MFA/2FA fatigue**, push bombing). Mjeri se efikasnost (stopa prijave phishing simulacija, broj incidenata).

### Prinuda (duress)

Situacija kada je zaposleni prisiljen prijetnjom da uradi nešto protiv volje (otvori sef, unese lozinku, deaktivira alarm).

- **Duress kod / šifra**: posebna lozinka ili PIN koji otvara sistem ali tiho alarmira obezbjeđenje.
- **Panic button** (taster za uzbunu) na recepciji i kod blagajne.
- Dogovorene kodne riječi u razgovoru („recite Marku da je kafa hladna“).
- Pravilo: zaposleni **sarađuje** i ne rizikuje život; imovina se može nadoknaditi.
- **Two-person rule** smanjuje vrijednost prinude nad jednom osobom.

> **Na ispitu:** u scenariju prinude ispravan odgovor je **postupiti po zahtjevu i diskretno aktivirati duress alarm**, a ne pružati otpor. Organizacija štiti ljude; kontrole poput duress koda i dual control postoje da bi ljudi mogli sarađivati bez da napadač dobije potpunu kontrolu.

## Scenariji za vježbu

**Scenarij 1.** Banka ima MTD od 8 h za core banking. Trenutna strategija je cold site i dnevni backup na trake koje se nose u sef. Menadžment pita da li je to dovoljno. Odgovor: ne, cold site treba sedmice za aktivaciju, a dnevni backup daje RPO do 24 h. Potrebna je hot ili warm lokacija sa replikacijom; konačnu odluku donosi menadžment na osnovu troška i rizika.

**Scenarij 2.** Nakon poplave, sistemi rade sa rezervne lokacije tri sedmice. Primarna lokacija je popravljena. Šta se vraća prvo? Najmanje kritični sistemi (npr. intranet, arhiva), da se dokaže ispravnost primarne lokacije, a core sistemi tek na kraju.

**Scenarij 3.** Ransomware je šifrovao produkciju i obrisao backupe na NAS-u u istoj mreži. Lessons learned: backupi moraju imati immutable/offline kopiju i odvojene kredencijale; restore se redovno testira.

## Rezime

- **RTO + WRT ≤ MTD**; RPO određuje učestalost backupa/replikacije; brojeve daje BIA (modul 3), strategiju bira menadžment.
- Backup: full/incremental/differential (archive bit), 3-2-1(-1-0), offsite + **immutable** + **encrypted** (ključevi odvojeno), testiraj restore. RAID i snapshot nisu backup.
- Otpornost: HA (kratak failover) vs fault tolerance (bez prekida), QoS, multiple processing sites (active-active); A = MTBF / (MTBF + MTTR).
- Lokacije: cold (sedmice) → warm (sati–dani) → hot (minuti–sati) → mirrored (trenutno); reciprocal agreement je najslabiji; resource capacity agreement garantuje kapacitet.
- DR procesi: response → assessment → restoration → failback → lessons learned; na rezervu prvo najkritičnije, nazad prvo najmanje kritično; komunikacija sa prioritetima i ovlaštenim portparolom; metrike baseline/MTTR/MTBF.
- DR testovi po rastu ometanja: read-through → tabletop → walkthrough → simulation → parallel → full interruption (odobrenje menadžmenta).
- BC vježbe: sigurnost učestvuje, ciljevi i scenariji unaprijed, after-action report, najmanje godišnje.
- Fizička sigurnost: deter-deny-detect-delay, CPTED, eksterne (ograde, rasvjeta, bollards, CCTV, čuvari) i interne kontrole (mantrap, zone, brave); fail-safe za ljude; pre-action za data centar; klasa C bez vode.
- Osoblje: putovanja (loaner uređaji), OEP i evakuacija, obuka (insider, društvene mreže, MFA fatigue), prinuda (sarađuj, duress kod).
- Ljudski život je uvijek prvi.
