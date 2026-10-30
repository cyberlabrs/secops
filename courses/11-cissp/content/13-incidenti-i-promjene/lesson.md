## Ciljevi ispita: 7.6, 7.7, 7.8 i 7.9

Domen 7 (**Security Operations**) nosi 12,8% ispita po outlineu iz 2027. (u outlineu iz 2024. 13%). Ovaj modul pokriva četiri cilja:

- **7.6 Conduct incident management**: detekcija (detection), odgovor (response), ublažavanje (mitigation), izvještavanje (reporting), oporavak (recovery), otklanjanje uzroka (remediation), naučene lekcije (lessons learned),
- **7.7 Operate and maintain detection and preventative measures**: firewalli (next generation, web application, network), sandboxing, IDS i IPS, zaštita krajnjih tačaka (anti-malware, **Endpoint Detection and Response (EDR)**, **Extended Detection and Response (XDR)**), honeypots/honeynets, allowlist/denylist, sigurnosne usluge trećih strana (DDoS scrubbing, MSSP), alati zasnovani na ML i AI,
- **7.8 Implement and support patch and vulnerability based management**,
- **7.9 Understand and participate in change management processes**.

> U outlineu iz 2024. cilj 7.7 je umjesto „Endpoint Protection (anti-malware, EDR, XDR)“ imao samo **Anti-malware**, umjesto „Allowlist/Denylist“ stari termin **Whitelisting/blacklisting**, a „Third-party provided security services“ bez primjera (DDoS scrubbing, MSSP). Cilj 7.8 se zvao „Implement and support patch and vulnerability management“. Sadržaj je suštinski isti; nova terminologija (allowlist/denylist) je ono što ćeš vidjeti u pitanjima.

Logovanje, SIEM, SOAR, UEBA i threat intelligence (7.2) su u modulu 12, a oporavak, DR i BC (7.10–7.13) u modulu 14. Ovdje gledamo **životni ciklus incidenta**, kontrole koje ga sprečavaju i otkrivaju, i dva procesa koja drže sistem u poznatom stanju: zakrpe i upravljanje promjenama.

> **Na ispitu:** u incidentu redoslijed odluka je uvijek isti: **ljudska sigurnost**, pa **zaustavljanje štete (containment)**, pa **očuvanje dokaza**, pa povratak u rad. Odgovor „odmah sve obriši i reinstaliraj“ skoro nikad nije PRVI korak, a „istraži ko je to uradio“ nije posao IR tima prije nego što je šteta zaustavljena.

## Događaj, alarm, incident

ISC2 pravi jasnu razliku između pojmova. Ne miješaj ih u pitanjima:

| Pojam | Definicija | Primjer |
|---|---|---|
| **Event** (događaj) | Bilo koja uočljiva pojava u sistemu ili mreži | Korisnik se prijavio, paket je stigao na port 443 |
| **Adverse event** | Događaj sa negativnom posljedicom | Pad servera, poplava paketa |
| **Alert / alarm** | Obavještenje alata da je događaj možda sumnjiv | SIEM pravilo: 50 neuspjelih prijava za 1 min |
| **Security incident** | Događaj koji ugrožava povjerljivost, integritet ili dostupnost, ili krši politiku | Ransomware na file serveru, zloupotreba privilegija |
| **Breach** (povreda podataka) | Incident u kojem su podaci potvrđeno otkriveni neovlaštenoj strani | Izvoz baze klijenata napadaču |

Svaki incident je događaj, ali nije svaki događaj incident. **Breach** ima pravne posljedice (obavještavanje regulatora i pogođenih lica, GDPR 72 sata), pa odluku da je nešto breach donosi menadžment uz pravnu službu, ne analitičar sam.

### Vrste incidenata koje ISC2 navodi

- napadi uskraćivanjem usluge (DoS/DDoS),
- malware (virus, crv, trojanac, ransomware),
- neovlašteni pristup i zloupotreba privilegija (insider),
- neprimjerena upotreba (kršenje AUP-a),
- curenje podataka,
- **zero-day** eksploatacije, za koje ne postoji potpis ni zakrpa.

## Incident management: procesi i modeli (7.6)

Postoje tri modela koja ćeš sresti. Ispit uglavnom koristi ISC2 listu iz outlinea, ali pitanja se mogu oslanjati i na NIST:

| ISC2 CBK (7 koraka) | NIST SP 800-61r2 (4 faze) | NIST SP 800-61r3 (2025, CSF 2.0) |
|---|---|---|
| — (priprema je preduslov) | **Preparation** | Govern, Identify, Protect (priprema) |
| **Detection** | Detection & Analysis | **Detect** |
| **Response** | Containment, Eradication & Recovery | **Respond** |
| **Mitigation** | Containment | Respond |
| **Reporting** | (kroz sve faze) | Respond |
| **Recovery** | Containment, Eradication & Recovery | **Recover** |
| **Remediation** | Eradication | Recover / Identify (improvement) |
| **Lessons learned** | **Post-Incident Activity** | Identify (Improvement) |

Mnemonik za ISC2 redoslijed: **D-R-M-R-R-R-L** (Detection, Response, Mitigation, Reporting, Recovery, Remediation, Lessons learned).

> **Na ispitu:** **priprema (preparation)** nije u ISC2 listi od sedam koraka, ali je najvažnija faza. Ako pitanje pita šta je organizacija trebala uraditi da incident prođe bolje, odgovor je najčešće nešto iz pripreme: IR plan, definisan tim, obuka, kontakti, alati i logovi koji već postoje.

### Priprema

- **Incident response plan** odobren od višeg menadžmenta (senior management), sa definicijom incidenta, ulogama, ovlaštenjima i kriterijima eskalacije.
- **CSIRT / CIRT** (Computer Security Incident Response Team): sigurnost, IT operacije, pravna služba, HR, PR/komunikacije, menadžment. Pravna služba i HR su obavezni jer incident može završiti otpuštanjem ili sudom.
- Unaprijed odobren **communications plan** (ko smije razgovarati s medijima, regulatorom, policijom).
- Alati: jump bag (forenzički alati, prazni mediji, kablovi), pristupni nalozi za hitne slučajeve (break-glass), sinhronizovano vrijeme (NTP) na svim sistemima.

### 1. Detection (detekcija)

Izvori detekcije: IDS/IPS, EDR, SIEM korelacija, antivirus, prijava korisnika, help desk, treća strana (CERT, partner, novinar). Prvi zadatak je **triage**: potvrditi da je incident stvaran (a ne false positive), procijeniti obim i odrediti **prioritet**.

| Faktor prioriteta | Pitanje |
|---|---|
| Funkcionalni uticaj | Koliko je poslovnih funkcija pogođeno? |
| Informacioni uticaj | Da li su povjerljivi ili regulisani podaci ugroženi? |
| Mogućnost oporavka | Da li se možemo oporaviti, za koliko vremena i resursa? |

### 2. Response (odgovor)

Aktiviranje CSIRT-a po planu. Odluke: ko vodi incident, ko komunicira, da li se uključuju policija i pravna služba. U ovoj fazi se dokumentuje svaki korak (vrijeme, akcija, ko).

### 3. Mitigation (ublažavanje, containment)

Cilj je **ograničiti štetu i spriječiti širenje**, ne riješiti uzrok. Primjeri: izolacija hosta u karantinski VLAN, blokiranje IP-a na firewallu, onemogućavanje kompromitovanog naloga, isključivanje mrežnog kabla (ne napajanja).

| Strategija containmenta | Prednost | Mana |
|---|---|---|
| Mrežna izolacija hosta | Zaustavlja širenje, RAM ostaje očuvan | Napadač može primijetiti i obrisati tragove |
| Gašenje sistema | Potpuno zaustavljanje | Gubi se volatilni dokaz (memorija, mrežne konekcije) |
| Praćenje napadača (sandbox, honeynet) | Prikupljanje informacija | Rizik dalje štete i pravni rizik; odluka menadžmenta |
| Blokiranje na perimetru | Brzo, ne dira host | Napadač može promijeniti infrastrukturu |

> **Na ispitu:** ako se nudi „isključi mrežni kabl“ i „isključi napajanje“, bolji je mrežni kabl jer čuva sadržaj memorije. Izuzetak: ako se aktivno brišu ili šifruju podaci (npr. destruktivni malware u toku), ograničavanje štete može biti važnije od dokaza, ali to odlučuje plan i menadžment.

### 4. Reporting (izvještavanje)

Izvještavanje teče kroz cijeli incident, ne samo na kraju:

- **interno**: menadžment po definisanoj eskalaciji, vlasnici podataka i sistema,
- **eksterno**: regulatori (GDPR 72 sata od saznanja, NIS2 rano upozorenje u 24 sata i obavještenje u 72 sata, HIPAA, PCI DSS prema kartičarskim kućama), pogođena lica, policija, osiguravač, partneri po ugovoru,
- odluku o obavještavanju policije i javnosti donosi **viši menadžment uz pravnu službu**, ne tehnički tim.

### 5. Recovery (oporavak)

Vraćanje sistema u produkciju: restauracija iz čistih backupa ili čistog imagea, provjera integriteta, pojačan monitoring nakon povratka. Sistem se vraća u rad tek kad je potvrđeno da napadač više nema pristup.

### 6. Remediation (otklanjanje uzroka)

Uklanjanje **korijenskog uzroka (root cause)** da se incident ne ponovi: zakrpa ranjivosti, promjena konfiguracije, ukidanje loših naloga, izmjena procesa. Ovdje se radi **root cause analysis (RCA)**. Remediation često ide kroz upravljanje promjenama i patch management (7.8, 7.9).

### 7. Lessons learned (naučene lekcije)

Sastanak nakon incidenta (post-incident review), idealno u roku od nekoliko dana, sa svim učesnicima, **bez traženja krivca (blameless)**. Pitanja: šta se desilo, kada, kako smo reagovali, šta bismo uradili drugačije, koje kontrole ili obuka nedostaju. Izlaz: ažuriran IR plan, nove kontrole, nova SIEM pravila, izvještaj menadžmentu.

> **Na ispitu:** pitanje „koji je cilj lessons learned faze“ ima odgovor „unaprijediti proces i spriječiti ponavljanje“, a ne „utvrditi ko je kriv“ ili „pripremiti dokaze za sud“. Ako pitanje traži fazu koja se najčešće preskače, odgovor je lessons learned.

### Remediation, mitigation, recovery: nijanse

| Pojam | Pitanje na koje odgovara | Primjer kod ransomwarea |
|---|---|---|
| **Mitigation** | Kako zaustaviti štetu sada? | Izolovati zaražene segmente, onemogućiti SMB između segmenata |
| **Recovery** | Kako vratiti poslovanje? | Restaurirati servere iz nepromjenjivih (immutable) backupa |
| **Remediation** | Kako spriječiti ponavljanje? | Zakrpiti VPN uređaj preko kojeg je napadač ušao, uvesti MFA |

### Scenarij: incident u toku

Petak u 18h. EDR javlja da je na računovodstvenom računaru pokrenut proces koji masovno šifruje dijeljene foldere. Ispravan slijed odluka:

1. Analitičar potvrđuje alarm (triage) i po planu eskalira voditelju incidenta.
2. EDR izoluje host sa mreže (mitigation), zadržava ga upaljenim radi memorije.
3. Voditelj incidenta aktivira CSIRT, obavještava menadžment i pravnu službu (response, reporting).
4. Prikupljaju se dokazi: memorija, image diska, logovi (veza sa 7.1, modul 12).
5. Utvrđuje se obim: koji su još hostovi pogođeni (threat hunting u EDR/SIEM).
6. Restauracija iz čistih backupa (recovery), uz potvrdu da su backupovi neinficirani.
7. Pronalazi se ulazna tačka (phishing + makro) i uklanja (remediation): blokada makroa, obuka, pravilo na e-mail gatewayu.
8. Lessons learned sastanak, ažuriranje plana i izvještaj.

## Detektivne i preventivne mjere (7.7)

### Firewalli

| Tip | Sloj (OSI) | Šta vidi | Tipična upotreba |
|---|---|---|---|
| **Static packet filter** | 3 (i 4) | IP adrese, portove, protokol; bez stanja | ACL na ruteru |
| **Stateful inspection** | 3–4 | Stanje konekcije (state table) | Klasični perimetarski firewall |
| **Circuit-level proxy** (SOCKS) | 5 | Uspostavu sesije, ne sadržaj | Posredovanje TCP sesija |
| **Application-level proxy** | 7 | Sadržaj protokola (HTTP, FTP) | Proxy za odlazni web saobraćaj |
| **Next-Generation Firewall (NGFW)** | 3–7 | Aplikacije bez obzira na port, korisnika, TLS inspekciju, integrisani IPS, threat intel | Savremeni perimetar i interna segmentacija |
| **Web Application Firewall (WAF)** | 7 (HTTP/S) | Zahtjeve prema web aplikaciji: SQLi, XSS, OWASP Top 10 | Ispred web aplikacija i API-ja |
| **Network firewall** (host vs. mrežni) | 3–4 | Saobraćaj segmenta ili jednog hosta | Segmentacija, host-based firewall na serveru |

Arhitekture: **screened host**, **screened subnet (DMZ)** sa dva firewalla, **bastion host**, **multihomed** (dual-homed) firewall. Pravilo svakog firewalla je **implicit deny**: sve što nije eksplicitno dozvoljeno je zabranjeno.

> **Na ispitu:** WAF štiti web aplikaciju od napada na aplikacijskom nivou, ali **nije zamjena za sigurno kodiranje**. Ako pitanje pita šta je BEST dugoročno rješenje za SQL injection, odgovor je parametrizovani upiti i validacija ulaza (domen 8); WAF je kompenzaciona kontrola dok se kod ne popravi.

### IDS i IPS

| Kriterij | IDS | IPS |
|---|---|---|
| Postavljanje | Pasivno (SPAN port, TAP) | **Inline**, sav saobraćaj prolazi kroz njega |
| Reakcija | Alarm (detektivna kontrola) | Blokira, odbacuje, resetuje (preventivna kontrola) |
| Rizik false positive | Višak alarma | Blokiran legitimni saobraćaj (uticaj na dostupnost) |
| Kvar uređaja | Ne utiče na saobraćaj | Treba odlučiti: **fail-open** (dostupnost) ili **fail-closed** (sigurnost) |

Po mjestu: **NIDS/NIPS** (mreža) i **HIDS/HIPS** (host; vidi šifrovan saobraćaj nakon dešifrovanja, integritet fajlova). Po metodi detekcije:

| Metoda | Kako radi | Prednost | Mana |
|---|---|---|---|
| **Signature / knowledge-based** | Poređenje sa bazom poznatih potpisa | Malo false positive | Ne vidi zero-day; baza mora biti ažurna |
| **Anomaly / behavior-based** (statistički) | Odstupanje od naučene osnovice (baseline) | Može otkriti nepoznate napade | Više false positive; treba period učenja |
| **Stateful protocol analysis** (specification-based) | Poređenje sa očekivanim ponašanjem protokola | Otkriva zloupotrebu protokola | Zahtjevno za resurse, ne pokriva sve protokole |
| **Heuristic** | Pravila i procjena sumnjivog ponašanja | Pokriva varijante poznatog malwarea | Podešavanje |

| Ishod | Značenje | Koji je opasniji |
|---|---|---|
| **True positive** | Napad i alarm | — |
| **False positive** | Alarm bez napada | Troši vrijeme, dovodi do zamora od alarma |
| **True negative** | Nema napada, nema alarma | — |
| **False negative** | Napad bez alarma | **Najopasniji**: napad prolazi neprimijećeno |

### Zaštita krajnjih tačaka: anti-malware, EDR, XDR

| Alat | Fokus | Kako otkriva | Reakcija |
|---|---|---|---|
| **Anti-malware** (AV) | Poznati malware na hostu | Potpisi, heuristika | Karantin, brisanje fajla |
| **EDR** | Ponašanje na endpointu, telemetrija (procesi, registry, mreža) | Behaviour analytics, IOC, IOA | Izolacija hosta, kill procesa, rollback, forenzička telemetrija za threat hunting |
| **XDR** | Korelacija preko endpointa, mreže, e-maila, identiteta, clouda | Centralna analitika više slojeva | Koordiniran odgovor kroz više kontrola |
| **MDR** (Managed Detection and Response) | EDR/XDR + tim provajdera 24/7 | Ljudi + alat | Provajder reaguje po dogovorenom playbooku |

Anti-malware politika: centralno upravljanje, automatsko ažuriranje potpisa, korisnik ne smije isključiti zaštitu, skeniranje na više slojeva (e-mail gateway, proxy, endpoint) jer to je defense in depth. Dobra praksa je **različiti proizvođači** na gatewayu i endpointu.

### Sandboxing

**Sandbox** je izolovano okruženje u kojem se nepoznat kod pokreće i posmatra prije nego što stigne korisniku (npr. detonacija priloga na e-mail gatewayu) ili u kojem aplikacija radi sa ograničenim pravima (browser sandbox, kontejner, Java/JS sandbox). Ograničenje: napredni malware prepoznaje virtuelno okruženje i odgađa zlonamjerno ponašanje (sandbox evasion), pa sandbox dopunjuje, a ne zamjenjuje EDR.

### Honeypots i honeynets

- **Honeypot**: lažni sistem bez legitimnih korisnika; svaki pristup je sumnjiv, pa je stopa false positive niska.
- **Honeynet**: mreža honeypotova koja simulira cijelo okruženje.
- **Honeytoken / canary**: lažni podatak (lažni nalog, lažni zapis u bazi, lažni API ključ) čija upotreba okida alarm.
- **Padded cell**: sistem u koji IDS preusmjerava napadača da bude posmatran.

Pravna granica: **enticement** (mamljenje) je dozvoljeno, napadač je već namjeravao napasti, a mi mu samo pružamo primamljiv cilj. **Entrapment** (navođenje na djelo koje osoba nije namjeravala) nije etično i može učiniti dokaze neprihvatljivim. Honeypot mora biti izolovan da ne postane odskočna daska za napad na treće strane.

> **Na ispitu:** razlika enticement vs. entrapment je klasično pitanje. Ako honeypot ima baner „besplatni filmovi, preuzmi ovdje“ da namami korisnike koji nisu imali namjeru napadati, to je entrapment. Honeypot sa ranjivim servisom na internetu koji napadač sam pronađe je enticement.

### Allowlist i denylist

| Pristup | Logika | Prednost | Mana |
|---|---|---|---|
| **Allowlist** (ranije whitelisting) | Dozvoljeno je samo ono sa liste, sve ostalo zabranjeno (default deny) | Najjača zaštita od nepoznatog malwarea i zero-daya | Administrativni teret, zahtijeva upravljanje promjenama |
| **Denylist** (ranije blacklisting) | Zabranjeno je ono sa liste, sve ostalo dozvoljeno (default allow) | Lako za uvođenje | Ne štiti od nepoznatog; lista nikad nije potpuna |

Application allowlisting se zasniva na hashu fajla (najsigurnije, ali svaka verzija mijenja hash), digitalnom potpisu izdavača ili putanji (najslabije). Pogodno je za sisteme koji se rijetko mijenjaju: kiosk, ICS/SCADA, POS terminali, serveri.

### Sigurnosne usluge trećih strana

| Usluga | Šta dobijaš | Na šta paziti |
|---|---|---|
| **MSSP** (Managed Security Service Provider) | SOC 24/7, upravljanje firewallima, IDS, SIEM | SLA (vrijeme reakcije), pristup logovima, ko smije donositi odluke o blokiranju |
| **MDR** | Detekcija i odgovor na endpointima i šire | Ovlaštenja za izolaciju, eskalacija |
| **DDoS scrubbing** | Saobraćaj se preusmjerava (BGP ili DNS) kroz centar za čišćenje provajdera, čist se vraća | Vrijeme aktivacije (always-on vs. on-demand), kapacitet, TLS ključevi |
| **CDN** | Distribucija i apsorpcija volumetrijskih napada | Dijeljena odgovornost za WAF pravila |
| **Security-as-a-Service** (SECaaS) | E-mail filtering, SWG, CASB, SSE | Lokacija podataka, ugovor |

Princip: **odgovornost se ne može prenijeti (outsourcati)**, samo izvršenje. Organizacija ostaje odgovorna za zaštitu podataka, pa mora imati ugovor, SLA, pravo na audit (right to audit) i periodičnu provjeru (SOC 2 Type II izvještaj).

> **Na ispitu:** kad organizacija angažuje MSSP, pitanje „ko je odgovoran ako dođe do breacha“ ima odgovor: **organizacija (vlasnik podataka)**. MSSP je odgovoran po ugovoru, ali pravna i regulatorna odgovornost ostaje kod vlasnika.

### ML i AI alati

Primjena: UEBA i otkrivanje anomalija, klasifikacija phishinga, prioritizacija alarma, automatizovana trijaža u SOAR-u, AI asistenti za analitičare. Rizici koje ISC2 očekuje da prepoznaš:

- **false positive/negative** i potreba za podešavanjem (tuning),
- **adversarial ML**: trovanje podataka za treniranje (data poisoning), izbjegavanje modela (evasion),
- netransparentnost odluka (explainability), što je problem kod dokaza i audita,
- pretjerano oslanjanje: **čovjek mora ostati u petlji (human in the loop)** za odluke sa velikim uticajem,
- privatnost podataka koji se šalju AI servisu.

## Patch i vulnerability management (7.8)

**Vulnerability management** je kontinuiran proces pronalaženja, procjene, prioritizacije i otklanjanja ranjivosti; **patch management** je njegov dio koji se bavi primjenom zakrpa. Ranjivosti se ne otklanjaju samo zakrpom: postoje i promjena konfiguracije, kompenzacione kontrole, povlačenje sistema iz upotrebe.

### Životni ciklus

| Korak | Aktivnost |
|---|---|
| 1. **Inventar imovine** | Ne možeš zakrpiti ono za šta ne znaš (CMDB, asset discovery) |
| 2. **Identifikacija** | Skeniranje ranjivosti (authenticated vs. unauthenticated), praćenje biltena proizvođača, CVE, CISA KEV |
| 3. **Procjena i prioritizacija** | CVSS, EPSS, da li je na KEV listi, kritičnost imovine, izloženost internetu |
| 4. **Testiranje zakrpe** | U testnom okruženju koje odgovara produkciji |
| 5. **Odobrenje** | Kroz upravljanje promjenama (CAB) |
| 6. **Primjena (deployment)** | Fazno: pilot grupa, pa ostatak; u definisanom prozoru održavanja |
| 7. **Verifikacija** | Ponovno skeniranje, provjera da je zakrpa zaista primijenjena |
| 8. **Izvještavanje i dokumentacija** | Metrike, ažuriran CMDB i baseline |

### Prioritizacija: CVSS nije dovoljan

| Izvor | Šta govori |
|---|---|
| **CVE** | Jedinstveni identifikator ranjivosti |
| **CVSS** (v3.1 / v4.0) | Ozbiljnost (0–10): base, temporal/threat, environmental metrike |
| **EPSS** | Vjerovatnoća eksploatacije u narednih 30 dana |
| **CISA KEV** | Ranjivost se potvrđeno aktivno eksploatiše |
| **Kontekst organizacije** | Kritičnost sistema, izloženost, postojeće kompenzacione kontrole |

Rizik = vjerovatnoća x uticaj. Ranjivost CVSS 9,8 na izolovanom testnom serveru može biti manji prioritet od CVSS 7,5 na internet-izloženom VPN uređaju koji je na KEV listi.

### Vrste zakrpa i rizici

- **Hotfix / quick fix**: hitna ispravka jedne greške, ponekad bez punog testiranja.
- **Patch / update**: redovna ispravka.
- **Service pack / rollup**: skup zakrpa.
- **Emergency patch**: za aktivno eksploatisan zero-day; ide kroz **hitnu promjenu (emergency change)** i dokumentuje se naknadno.

Ako zakrpa ne postoji ili se ne smije primijeniti (legacy sistem, medicinski uređaj, ICS koji proizvođač ne podržava), koristi se **kompenzaciona kontrola**: segmentacija, virtual patching (IPS/WAF pravilo), allowlisting, pojačan monitoring. Odluka o prihvatanju preostalog rizika je na **vlasniku rizika/sistema**, dokumentovana kao izuzetak (risk exception) sa rokom.

### Metrike

- vrijeme od objave do primjene zakrpe (mean time to patch / remediate),
- procenat sistema usklađenih sa baseline-om,
- broj otvorenih kritičnih ranjivosti starijih od SLA roka,
- broj izuzetaka i njihova starost.

> **Na ispitu:** pitanje „šta uraditi PRIJE primjene kritične zakrpe na produkciju“ ima odgovor **testirati je i proći kroz change management**, osim ako scenario jasno kaže da je u toku aktivna eksploatacija; i tada se ide hitnim postupkom promjene, ne zaobilaženjem procesa. Automatska primjena svih zakrpa direktno na produkciju nije BEST odgovor.

## Change management (7.9)

**Change management** osigurava da se promjene na sistemima rade kontrolisano: zatražene, procijenjene, odobrene, testirane, dokumentovane, uz mogućnost povratka. Cilj sa sigurnosnog aspekta: **spriječiti da promjena smanji sigurnost ili dostupnost** i održati sistem u poznatom stanju. Usko je vezan sa **configuration management** (7.3, modul 12): CM definiše baseline, a change management kontroliše odstupanja od njega.

### Proces

| Korak | Šta se dešava | Ko |
|---|---|---|
| 1. **Request (RFC)** | Formalni zahtjev: šta, zašto, uticaj, plan povratka | Podnosilac |
| 2. **Review / impact analysis** | Procjena rizika, sigurnosnog uticaja, zavisnosti, resursa | Tehnički tim, sigurnost |
| 3. **Approval** | Odobrenje ili odbijanje | **Change Advisory Board (CAB)** ili change manager |
| 4. **Test** | Provjera u testnom okruženju | Implementator, QA |
| 5. **Schedule & notify** | Prozor održavanja, obavještenje korisnika | Change manager |
| 6. **Implement** | Primjena po planu | Implementator |
| 7. **Verify / validate** | Da li promjena radi i nije narušila sigurnost | Implementator, vlasnik sistema |
| 8. **Document & close** | Ažuriranje CMDB, baseline-a, dokumentacije | Change manager |

Ako promjena pođe loše, aktivira se **backout / rollback plan**, koji je morao postojati prije odobrenja.

### Vrste promjena (ITIL terminologija)

| Vrsta | Opis | Odobrenje |
|---|---|---|
| **Standard** | Unaprijed odobrena, niskog rizika, ponovljiva (npr. reset lozinke, dodavanje korisnika po proceduri) | Prethodno odobren model, bez CAB-a |
| **Normal** | Svaka promjena koja nije standardna ni hitna | CAB |
| **Emergency** | Hitna, zbog incidenta ili kritične ranjivosti | **ECAB** (emergency CAB) ili ovlaštena osoba; dokumentacija i retrospektivni pregled odmah nakon |

> **Na ispitu:** hitna promjena **ne zaobilazi** change management, nego ide skraćenim postupkom i dokumentuje se naknadno. Ako pitanje opisuje administratora koji je „brzo popravio“ firewall pravilo bez ikakvog zapisa, to je kršenje procesa čak i ako je ishod bio dobar. Neodobrena promjena je sama po sebi sigurnosni incident ili barem nalaz audita.

### Sigurnosna uloga u change managementu

- Sigurnost je **član CAB-a** i procjenjuje sigurnosni uticaj svake promjene.
- **Separation of duties**: ko razvija ne odobrava i ne prebacuje u produkciju sam.
- Neovlaštene promjene se otkrivaju kroz **file integrity monitoring** (FIM), poređenje sa baseline-om, drift detection u IaC-u i audit logove.
- **Versioning** i dokumentacija omogućavaju rekonstrukciju šta je promijenjeno i kada (važno za incident i forenziku).

### Change management u DevOps okruženju

U CI/CD-u CAB se ne sastaje za svaki commit. Kontrole se ugrađuju u pipeline: pull request sa obaveznim pregledom (peer review = odobrenje), automatski testovi i sigurnosni skeneri (quality gates), potpisani artefakti, IaC kao jedini put promjene infrastrukture, audit trail u repozitoriju. Ovo je i dalje change management, samo automatizovan; promjene niskog rizika postaju „standardne“. Više u modulu 15 (8.1, 8.2).

### Scenarij: neovlaštena promjena

Tokom noći monitoring prijavljuje da je na produkcijskom web serveru izmijenjen konfiguracioni fajl. Nema otvorenog RFC-a. Ispravan pristup:

1. Tretirati to kao **potencijalni incident** (dok se ne dokaže suprotno), jer neovlaštena promjena može biti napad.
2. Uporediti sa baseline-om i utvrditi ko je i kako izvršio promjenu (audit log).
3. Ako je administrator radio bez odobrenja: vratiti na odobreno stanje kroz proces, eskalirati menadžmentu, ponovo obučiti; ako nije: incident response.
4. Lessons learned: zašto tehnička kontrola (npr. ograničen pristup, PAM) nije spriječila promjenu.

## Povezivanje: kako ciljevi 7.6–7.9 rade zajedno

| Situacija | Proces | Veza |
|---|---|---|
| EDR otkrije ransomware | Incident management (7.6) | Detekcija dolazi iz kontrola 7.7 |
| Uzrok je nezakrpljen VPN | Remediation → vulnerability management (7.8) | Hitna zakrpa |
| Hitna zakrpa na produkciji | Emergency change (7.9) | ECAB, naknadna dokumentacija |
| Lessons learned | Nova SIEM pravila, allowlisting | Povratno u 7.7 i baseline (7.3) |

## Rezime

- **Event → alert → incident → breach**: svaki sljedeći je uži skup; breach ima pravne obaveze obavještavanja i o njemu odlučuje menadžment s pravnom službom.
- ISC2 koraci incident managementa: **Detection, Response, Mitigation, Reporting, Recovery, Remediation, Lessons learned**; priprema je preduslov i najvažnija faza. NIST 800-61r2: Preparation, Detection & Analysis, Containment/Eradication/Recovery, Post-Incident.
- Prioriteti: ljudski život, containment, očuvanje dokaza, oporavak. Izolacija mreže bolja od gašenja (čuva RAM). Mitigation zaustavlja štetu, recovery vraća poslovanje, remediation uklanja uzrok.
- Lessons learned je blameless i cilj je unapređenje procesa.
- Firewalli: packet filter, stateful, proxy, NGFW (aplikacije, korisnici, IPS), WAF (L7 HTTP, kompenzaciona kontrola, ne zamjena za siguran kod); implicit deny.
- IDS pasivan i alarmira, IPS inline i blokira (fail-open vs. fail-closed). Signature ne vidi zero-day, anomaly ima više false positive. **False negative je najopasniji.**
- Anti-malware (potpisi) → EDR (ponašanje, izolacija, telemetrija) → XDR (korelacija više slojeva) → MDR (usluga).
- Sandbox detonira nepoznat kod; honeypot/honeynet/honeytoken imaju nisku stopu false positive; **enticement je dozvoljen, entrapment nije**.
- Allowlist (default deny) je jača od denylist; termini zamjenjuju whitelisting/blacklisting iz outlinea 2024.
- Treće strane (MSSP, MDR, DDoS scrubbing): izvršenje se outsourca, **odgovornost ne**; ugovor, SLA, right to audit.
- ML/AI: tuning, adversarial ML, explainability, human in the loop.
- Vulnerability management: inventar → identifikacija → prioritizacija (CVSS + EPSS + KEV + kontekst) → test → odobrenje → fazna primjena → verifikacija. Bez zakrpe: kompenzaciona kontrola i dokumentovan izuzetak vlasnika rizika.
- Change management: RFC → analiza uticaja → CAB → test → raspored → implementacija → verifikacija → dokumentacija, uvijek sa backout planom. Standard / normal / emergency (ECAB, naknadna dokumentacija). Hitno ne znači mimo procesa.
