## Ciljevi ispita: 7.1 – 7.5

Domen 7 (**Security Operations**) nosi oko 12,8% ispita (u outlineu iz 2024. 13%). Ovaj modul pokriva prvih pet ciljeva domena, „mirnodopsku“ stranu operacija: kako se istražuje, kako se nadzire, kako se drži konfiguracija pod kontrolom i koji principi važe za svakodnevni rad.

- **7.1 Understand and comply with investigations**
  - Evidence collection and handling
  - Digital forensics tools, tactics, and procedures
  - Investigative techniques
  - Artifacts (e.g., data, computer, network, mobile device)
  - Reporting and documentation
- **7.2 Conduct logging and monitoring activities**
  - Intrusion Detection and Prevention (IDPS)
  - Security Information and Event Management (SIEM)
  - Egress monitoring (e.g., Data Loss Prevention (DLP))
  - Log management
  - Security Orchestration, Automation and Response (SOAR)
  - Threat intelligence (e.g., threat feeds, threat hunting)
  - Continuous monitoring and tuning
  - User and entity behavior analytics (UEBA)
- **7.3 Perform Configuration Management (CM)** (e.g., provisioning, baselining, automation)
- **7.4 Apply foundational security operations concepts** (e.g., Defense in Depth (DiD))
  - Need-to-know/least privilege
  - Privileged account management
  - Separation of Duties (SoD) and responsibilities
  - Job rotation
- **7.5 Apply resource protection**
  - Media management
  - Data states (e.g., in use, in transit, at rest)
  - Media protection techniques (e.g., archiving, encryption, disposal/reuse)

> U outlineu iz 2024. 7.2 nije imao posebnu pod-tačku **SOAR**, a egress monitoring nije imao primjer DLP; 7.4 je imao i pod-tačku **Service-level agreements (SLA)** i govorio je „Segregation of Duties“, bez primjera DiD; 7.5 je govorio samo „Data at rest/data in transit“ (bez **data in use**), a tehnike zaštite medija bez primjera. Sadržaj ovdje pokriva obje verzije.

Pravni okvir istraga (vrste istraga, standardi dokaza, criminal/civil/regulatory) uveden je u modulu 2 (cilj 1.6); ovdje je fokus na tome **kako se istraga sprovodi i dokumentuje**. Incident management (7.6) je u modulu 13.

> **Na ispitu:** domen 7 je pun pitanja tipa „šta je PRVO“. Redoslijed razmišljanja: bezbjednost ljudi → zaustavljanje štete uz očuvanje dokaza → obavještavanje po politici → tehnička akcija. Analitičar nikad ne „rješava sam“ ono što politika dodjeljuje menadžmentu, pravnoj službi ili policiji.

## 7.1 Istrage: vrste i ko vodi

| Vrsta istrage | Ko pokreće | Standard dokaza | Tipičan ishod |
|---|---|---|---|
| **Administrative / operational** | Organizacija (IT, HR, menadžment) | Interni, najblaži | Disciplinska mjera, popravka procesa, root cause |
| **Criminal** | Policija, tužilaštvo | **Beyond a reasonable doubt** | Zatvor, novčana kazna |
| **Civil** | Strana u sporu (tužilac) | **Preponderance of the evidence** (više vjerovatno nego ne) | Naknada štete |
| **Regulatory** | Regulator (npr. agencija za zaštitu podataka, FINRA, SEC) | Zavisi od propisa | Kazne, naredbe, gubitak licence |
| **Industry standards** | Ugovorna tijela (npr. PCI SSC) | Ugovorni | Gubitak certifikata, penali |
| **eDiscovery** | Sudski spor | Pravila postupka | Predaja relevantnih ESI podataka |

Ključno: administrativna istraga može **postati** krivična. Zato se od prvog trenutka radi kao da će dokaz završiti na sudu.

> **Na ispitu:** kada interna istraga otkrije moguće krivično djelo (npr. dječja pornografija, prevara velikih razmjera), ispravan korak je zaustaviti dalje „čeprkanje“, sačuvati dokaze i uključiti **pravnu službu / višeg menadžera** koji odlučuje o prijavi policiji. Analitičar ne zove policiju na svoju ruku, ali ni ne briše niti „istražuje dalje“.

## Evidence collection and handling

### Vrste dokaza

| Vrsta | Opis | Primjer |
|---|---|---|
| **Real (physical) evidence** | Fizički predmet | Disk, laptop, USB |
| **Documentary evidence** | Pisani zapisi, uključujući logove | Logovi, e-mail, ugovor |
| **Testimonial evidence** | Iskaz svjedoka | Svjedočenje administratora, vještaka |
| **Demonstrative evidence** | Pomoćni prikaz za sud | Dijagram mreže, vremenska linija |
| **Best evidence** | Original dokumenta | Originalni ugovor, ne kopija |
| **Secondary evidence** | Kopija ili usmeni opis | Fotokopija |
| **Direct / circumstantial / corroborative** | Dokazuje direktno / posredno / potkrepljuje drugi dokaz | Snimak kamere / prisustvo u logu / potvrda iz drugog izvora |
| **Hearsay** | Iskaz iz druge ruke; logovi su po pravilu izuzetak ako su **business records** vođeni redovno | Log koji se ne vodi rutinski može biti osporen |

Pravila **best evidence rule** (original ima prednost) i **parol evidence rule** (pisani ugovor se ne mijenja usmenim dogovorima) poznata su iz domena 1.

### Pet osobina prihvatljivog dokaza

Dokaz mora biti:

1. **Relevant** (relevantan): odnosi se na činjenicu u sporu.
2. **Authentic / Material**: dokazivo je ono za šta se tvrdi (hash, chain of custody).
3. **Complete**: cijela slika, uključujući oslobađajuće dokaze (exculpatory).
4. **Reliable / Accurate**: prikupljen pouzdanom, prihvaćenom metodom.
5. **Admissible / Believable**: prikupljen zakonito i razumljiv sudu.

Klasična formulacija na ispitu: dokaz mora biti **sufficient, reliable, relevant** (i prikupljen zakonito).

### Chain of custody

**Chain of custody** (lanac nadzora) je dokumentovana istorija svakog dokaza: ko ga je prikupio, kada, gdje, kako je označen, ko ga je i zašto preuzeo, gdje je čuvan. Prekid u lancu ne znači automatski da je dokaz neupotrebljiv, ali ga suprotna strana napada.

Zapis tipično sadrži: jedinstveni broj dokaza, opis (serijski broj, model), datum i vrijeme, ime osobe, potpis, razlog predaje, lokaciju čuvanja, hash vrijednosti.

### Redoslijed volatilnosti (RFC 3227)

| Redoslijed | Izvor | Zašto |
|---|---|---|
| 1 | CPU registri, keš | Nestaju za nanosekunde |
| 2 | Routing tabela, ARP keš, tabela procesa, statistika kernela, **RAM** | Nestaje gašenjem |
| 3 | Privremeni fajl sistemi, swap | Prepisuju se |
| 4 | Disk | Trajno, ali se mijenja upotrebom |
| 5 | Udaljeni logovi i monitoring podaci | Rotiraju se po retenciji |
| 6 | Fizička konfiguracija, topologija mreže | Relativno stabilno |
| 7 | Arhivski mediji (backup trake) | Najstabilnije |

> **Na ispitu:** „Sistem je kompromitovan i još radi. Šta PRVO?“ Ne gasiti (gubi se RAM), ne restartovati, ne pokretati antivirus na originalu. Izolovati od mreže (ako politika to traži), prikupiti volatilne podatke, zatim napraviti forenzičku kopiju diska. Izuzetak: ako se šteta aktivno širi (npr. ransomware šifruje dijeljene diskove), zaustavljanje štete može imati prednost, a to je odluka po IR planu.

### Locard i MOM

- **Locard's exchange principle**: svaki kontakt ostavlja trag; počinilac uvijek nešto ostavi i nešto ponese (logovi, artefakti).
- **MOM**: **Motive, Opportunity, Means** – okvir za procjenu osumnjičenog.

## Digital forensics: alati, taktike, procedure

Forenzički proces (ISO/IEC 27037 za identifikaciju, prikupljanje, akviziciju i očuvanje; ISO/IEC 27042 za analizu; NIST SP 800-86):

| Faza | Šta se radi | Ključna kontrola |
|---|---|---|
| **Identification** | Prepoznati potencijalne izvore dokaza | Dokumentacija scene, fotografije |
| **Preservation** | Spriječiti izmjenu | Izolacija, legal hold, zabrana pristupa |
| **Collection / Acquisition** | Uzeti uređaj ili napraviti kopiju | **Write blocker**, bit-stream image |
| **Examination** | Izdvojiti relevantne podatke | Rad samo na kopiji |
| **Analysis** | Tumačiti, napraviti timeline | Validirani alati, ponovljivost |
| **Presentation / Reporting** | Izvještaj i svjedočenje | Jasan, nepristrasan jezik |

### Ključne procedure

- **Bit-stream (forensic) image**: kopija svakog sektora, uključujući slack space i nealocirani prostor, ne samo fajlova. Logička kopija (copy fajlova) nije dovoljna za forenziku.
- **Hashing**: hash originala i kopije (SHA-256) pri akviziciji i pri svakoj kasnijoj provjeri; podudarnost dokazuje integritet.
- **Write blocker** (hardverski ili softverski): sprečava upis na izvorni medij tokom akvizicije.
- **Rad na kopiji**: original se zapečati i čuva; analizira se radna kopija (često kopija kopije).
- **Validacija alata**: alat mora biti opšte prihvaćen i testiran (npr. NIST CFTT program testira forenzičke alate).
- **Live forensics vs dead-box**: live pristup hvata memoriju, otvorene konekcije, ključeve za šifrovanje diska; dead-box (ugašen sistem) je jednostavniji za integritet, ali gubi volatilne podatke.

Kategorije alata (opisno): alati za akviziciju diska i memorije, forenzički paketi za analizu fajl sistema, alati za analizu memorije, analizatori mrežnog saobraćaja (pcap), alati za mobilne uređaje, alati za timeline i hash baze poznatih fajlova (npr. NSRL za isključivanje poznatih sistemskih fajlova).

## Investigative techniques

| Tehnika | Opis |
|---|---|
| **Intervjui** | Neformalni razgovor sa svjedocima; **interrogation** osumnjičenog radi obučena osoba, uz pravnu službu i HR, sa poštovanjem prava zaposlenog |
| **Timeline analysis** | Spajanje događaja iz više izvora po vremenu; preduslov je **sinhronizovano vrijeme (NTP)** |
| **Link analysis** | Povezivanje entiteta (nalozi, IP, uređaji) |
| **Root cause analysis** | Zašto se desilo (5 Whys, Ishikawa) |
| **Malware analysis** | Statička i dinamička (u sandboxu), iz ugla odbrane: IoC, ponašanje |
| **Surveillance** | Fizička (kamere) i računarska (praćenje aktivnosti) – samo uz pravni osnov i politiku o nadzoru |
| **Undercover / sting** | Uglavnom domen policije; organizacija ne smije podsticati djelo |

Pojmovi koje ISC2 voli:

- **Enticement** (mamljenje): legalno – privlačenje napadača koji već ima namjeru (npr. honeypot sa zanimljivim imenom servera).
- **Entrapment** (navođenje): nelegalno/neetično – navođenje osobe koja nije imala namjeru da počini djelo. Dokazi dobijeni entrapmentom su neprihvatljivi.
- **Search warrant** vs **subpoena** vs **voluntary surrender**: policija treba nalog; organizacija može dobrovoljno predati podatke (uz pravnu službu); zaposleni koji je potpisao politiku prihvatljive upotrebe nema očekivanje privatnosti na službenoj opremi.
- **Exigent circumstances**: hitne okolnosti (prijeti uništenje dokaza) dozvoljavaju policiji zaplijenu bez naloga.

> **Na ispitu:** pravo organizacije da nadzire i pretražuje službene uređaje počiva na **politici koju je zaposleni potpisao** i na **banneru** (login banner/warning) koji kaže da nema očekivanja privatnosti. Ako pitanje pita šta je najvažnije PRIJE nadzora zaposlenih, odgovor je politika i obavještenje, ne alat.

## Artifacts: šta i gdje tražiti

| Kategorija | Primjeri artefakata | Napomena |
|---|---|---|
| **Data** | Fajlovi, metapodaci (MAC vremena: modified/accessed/changed), baze, slack space, obrisani fajlovi | Metapodaci često važniji od sadržaja |
| **Computer** | RAM, registry, prefetch, event logovi, istorija pregledača, swap/hibernation fajl, korisnički profili | RAM sadrži ključeve, procese, mrežne veze |
| **Network** | Pcap, NetFlow/IPFIX, firewall i proxy logovi, DNS logovi, DHCP lease (veza IP–uređaj) | Full packet capture skup, flow jeftin |
| **Mobile device** | SIM, IMEI/IMSI, poruke, lokacijski podaci, aplikacije, cloud backup | Faraday kesa da se spriječi daljinsko brisanje |
| **Cloud** | API/audit logovi, snapshot, flow logovi | Zavisi od modela usluge i ugovora |
| **Embedded/IoT** | Firmware, interni logovi | Često nema standardnih alata |

Mobilni uređaji: izolovati od mreže (**Faraday bag**, airplane mode), ne gasiti ako je otključan (gubi se dostupnost šifrovanih podataka), dokumentovati stanje ekrana.

## Reporting and documentation

Izvještaj istrage mora biti:

- **činjeničan i nepristrasan**: nalazi odvojeni od mišljenja, bez spekulacija;
- **ponovljiv**: opisani alati, verzije, metode i hash vrijednosti;
- **razumljiv** ciljnoj publici (menadžment, sud, regulator) – tehnički detalji u prilogu;
- **potpun**: uključuje i ono što ne ide u prilog hipotezi;
- **zaštićen**: označen klasifikacijom, distribucija na need-to-know osnovi, često pod **attorney-client privilege** ako ga naručuje pravna služba.

Tipična struktura: sažetak za menadžment, obim i ovlašćenje, metodologija, vremenska linija, nalazi, zaključci, preporuke, prilozi (chain of custody, hash vrijednosti, logovi).

**Expert witness** (vještak) može davati mišljenje; **fact witness** svjedoči samo o onome što je vidio i uradio.

## 7.2 Logging i monitoring

### IDPS

| Kriterijum | IDS | IPS |
|---|---|---|
| Položaj | Pasivno (SPAN/TAP) | **Inline** |
| Akcija | Alarm | Blokira, resetuje sesiju |
| Rizik lažnog pozitiva | Buka za analitičare | Prekid legitimnog poslovanja |
| Rizik kvara | Nema uticaja na saobraćaj | Fail-open ili fail-closed odluka |

| Metoda detekcije | Kako radi | Prednost | Mana |
|---|---|---|---|
| **Signature / knowledge-based** | Poređenje sa poznatim obrascima | Malo lažnih pozitiva | Ne vidi zero-day |
| **Anomaly / behavior / statistical** | Odstupanje od baseline-a | Vidi nepoznato | Više lažnih pozitiva, treba učenje |
| **Stateful protocol analysis / specification** | Poređenje sa očekivanim ponašanjem protokola | Hvata zloupotrebu protokola | Zahtjevno za resurse |
| **Heuristic** | Pravila ponašanja | Djelimično nepoznate prijetnje | Podešavanje |

**NIDS/NIPS** gleda mrežu (slijep za šifrovani saobraćaj bez TLS inspekcije), **HIDS/HIPS** gleda host (vidi dešifrovano, ali troši resurse hosta i napadač ga može isključiti).

Ishodi detekcije:

| | Napad postoji | Napad ne postoji |
|---|---|---|
| **Alarm** | True positive | **False positive** (Type I) |
| **Nema alarma** | **False negative** (Type II) – najopasniji | True negative |

### Log management

Životni ciklus loga: generisanje → prenos → normalizacija → skladištenje → analiza → retencija → bezbjedno uništenje (NIST SP 800-92).

| Kontrola | Zašto |
|---|---|
| **Centralizacija** (syslog, agent) | Napadač na hostu ne može obrisati kopiju |
| **Sinhronizacija vremena (NTP)** | Korelacija i dokazna vrijednost |
| **Integritet** (WORM, hash, potpisivanje) | Dokaz da log nije mijenjan |
| **Retencija po politici i zakonu** | Previše kratko = nema dokaza; predugo = trošak i pravni rizik |
| **Kontrola pristupa** | Administrator sistema ne smije brisati vlastite logove (SoD) |
| **Klipovanje / threshold** (**clipping levels**) | Bilježi se tek kada se pređe prag (npr. 5 neuspješnih logovanja) |
| **Zaštita od preplavljivanja** | Kapacitet, rotacija, alarm kada se logovanje zaustavi |

Šta logovati: ko (identitet), šta (akcija, objekat), kada (vrijeme), gdje (izvor, odredište), ishod (uspjeh/neuspjeh). Ne logovati lozinke, pune brojeve kartica i nepotrebne lične podatke.

### SIEM, SOAR, UEBA

| Alat | Uloga | Ključna vrijednost |
|---|---|---|
| **SIEM** | Agregacija, normalizacija, **korelacija**, alarmiranje, izvještaji, retencija | Vidi obrazac koji nijedan pojedinačni log ne vidi |
| **SOAR** | Playbookovi, orkestracija alata, automatizovani odgovor, case management | Brzina i konzistentnost, smanjuje MTTR i zamor analitičara |
| **UEBA** | ML/statistički baseline ponašanja korisnika i entiteta (hostova, servisnih naloga) | Insider threat, kompromitovani nalozi, „nemoguće putovanje“ |

SOAR automatizacija se uvodi postepeno: prvo obogaćivanje (enrichment) i tiketi, zatim akcije sa ljudskim odobrenjem, tek onda potpuno automatske akcije niskog rizika.

### Egress monitoring i DLP

**Egress monitoring** prati šta **izlazi** iz organizacije: exfiltracija, C2 saobraćaj, curenje podataka.

| DLP tip | Gdje | Šta vidi |
|---|---|---|
| **Network DLP** | Na izlazu (proxy, gateway) | Data in transit; slijep za šifrovano bez inspekcije |
| **Endpoint DLP** | Agent na uređaju | Data in use: USB, štampa, clipboard |
| **Storage / discovery DLP** | Repozitoriji, share-ovi, cloud | Data at rest: gdje su osjetljivi podaci |
| **Cloud DLP / CASB** | SaaS | Dijeljenje, upload |

DLP pretpostavlja da su podaci **klasifikovani i označeni** – bez klasifikacije DLP ne zna šta štiti. Tehnike detekcije: pattern matching (regex), fingerprinting dokumenata, exact data match, oznake (labels). Ostale tehnike egress monitoringa: proxy i DNS logovi, otkrivanje **steganografije**, **watermarking** dokumenata.

### Threat intelligence i threat hunting

| Pojam | Opis |
|---|---|
| **Threat feed** | Mašinski čitljiv tok IoC-a (IP, domeni, hash), često STIX/TAXII |
| **Strateška / taktička / operativna / tehnička** TI | Za upravu / TTP za arhitekte / konkretne kampanje / IoC za alate |
| **Threat hunting** | Proaktivna, hipotezom vođena potraga za prijetnjom koja je **zaobišla** postojeće alarme |
| **MITRE ATT&CK** | Baza TTP-ova za hipoteze i mapiranje detekcija |
| **Cyber Kill Chain** | Faze napada (recon → actions on objectives) |
| **Pyramid of Pain** | Hash je lako promijeniti, TTP teško – detekcije na TTP nivou su vrjednije |

Threat feed bez konteksta i provjere kvaliteta stvara buku; TI je vrijedan kad je **relevantan** za industriju i okruženje, **pravovremen** i **akcionabilan**.

### Continuous monitoring and tuning

**Information Security Continuous Monitoring (ISCM)**, NIST SP 800-137: definisati strategiju → uspostaviti program (metrike, učestalost) → implementirati → analizirati i izvještavati → reagovati → revidirati. **Tuning** smanjuje lažne pozitive (izuzeci, pragovi) bez stvaranja lažnih negativa; svaka izmjena pravila prolazi kroz change management i dokumentuje se.

> **Na ispitu:** ako SOC „guši“ previše alarma, najbolji odgovor nije isključiti pravila niti zaposliti još analitičara, nego **tuning** zasnovan na riziku (prioritizacija po kritičnosti imovine, baseline, korelacija) i eventualno automatizacija (SOAR). Ako pitanje traži otkrivanje nepoznatog napadača koji je već unutra, odgovor je **threat hunting**, a za anomalije u ponašanju naloga **UEBA**.

## 7.3 Configuration Management

**Configuration management (CM)** održava sisteme u poznatom, odobrenom stanju. Povezan je sa change managementom (7.9, modul 13): change management odlučuje **da li** se nešto mijenja, CM osigurava **da je** stanje dokumentovano i usklađeno.

| Element | Opis |
|---|---|
| **Provisioning** | Kreiranje sistema iz odobrenog, ojačanog templatea (golden image), sa sigurnim podrazumijevanim postavkama |
| **Baselining** | Dokumentovana, odobrena konfiguracija (npr. CIS Benchmark, DISA STIG) kao referentna tačka |
| **Automation** | IaC i alati za konfiguraciju; ponovljivost, manje ljudske greške, brz oporavak |
| **CMDB** | Baza **configuration items (CI)** i njihovih veza |
| **Configuration audit / drift detection** | Poređenje stvarnog stanja sa baseline-om |
| **Versioning** | Svaka baseline verzija je označena i može se vratiti |

NIST SP 800-128 faze: planiranje → identifikacija i implementacija konfiguracija → kontrola promjena konfiguracije → monitoring. Proces klasičnog CM-a (iz domena softvera): **configuration identification, configuration control, configuration status accounting, configuration audit**.

> **Na ispitu:** ako se otkrije odstupanje od baseline-a (drift), ispravna reakcija nije „ručno vratiti na serveru“ bez traga, nego istražiti uzrok (neovlašćena promjena = mogući incident), vratiti kroz kontrolisani proces i ažurirati dokumentaciju. Automatizacija bez kontrole promjena samo brže širi grešku.

## 7.4 Osnovni koncepti sigurnosnih operacija

### Defense in Depth (DiD)

Više slojeva **različitih** kontrola (administrativne, tehničke, fizičke; preventivne, detektivne, korektivne) tako da otkaz jednog sloja ne znači kompromitaciju. Primjer: politika + obuka, MFA, segmentacija, EDR, enkripcija, logovanje, fizička kontrola pristupa. DiD se često kombinuje sa **zero trust** principom (nema implicitnog povjerenja na osnovu lokacije).

### Need-to-know i least privilege

| Princip | Pitanje | Primjer |
|---|---|---|
| **Least privilege** | Koja **prava/akcije** su minimalno potrebne? | Operater backupa može čitati, ali ne brisati |
| **Need-to-know** | Kojim **podacima** treba pristup za ovaj posao? | Analitičar sa clearance „Secret“ vidi samo dosijee svog slučaja |

Clearance odgovara na „smije li uopšte“, need-to-know na „treba li baš ovo“. Pojmovi: **privilege creep / aggregation** (gomilanje prava pri promjeni pozicije) – rješenje su periodične **access reviews** (recertifikacija).

### Privileged account management (PAM)

- Odvojeni privilegovani nalozi (ne koristiti admin nalog za e-mail i web).
- **Just-in-time (JIT)** i **just-enough administration (JEA)**: privilegija se dodjeljuje privremeno i usko.
- Vault za lozinke i ključeve, automatska rotacija, **break-glass** nalozi sa nadzorom.
- Snimanje i nadzor privilegovanih sesija; pregled logova radi neko **ko nije** administrator.
- Servisni nalozi: inventar, bez interaktivnog logovanja, rotacija tajni.
- Češće i strože access reviews za privilegovane naloge.

### Separation of Duties i odgovornosti

**SoD** dijeli kritičan proces tako da nijedna osoba ne može sama izvršiti i prikriti zloupotrebu. Primjeri: developer ne deployuje u produkciju; ko kreira dobavljača ne odobrava plaćanje; administrator ne briše audit logove; security administrator ≠ system administrator.

Povezane kontrole:

- **Two-person integrity / dual control**: dvije osobe moraju zajedno izvršiti akciju (npr. ključ od trezora, root ključ CA).
- **Split knowledge**: niko ne zna cijelu tajnu (npr. M-of-N key recovery).
- **Collusion** (dogovor) je preostali rizik SoD-a; ublažava se rotacijom i obaveznim odmorom.

### Job rotation i mandatory vacation

| Kontrola | Svrha |
|---|---|
| **Job rotation** | Otkrivanje prevara (novi čovjek vidi nepravilnosti), unakrsna obuka, smanjenje zavisnosti od pojedinca |
| **Mandatory vacation** | Detektivna: osoba odsutna npr. 1–2 sedmice, druga obavlja posao i otkriva prikrivene radnje |

> **Na ispitu:** razlikuj svrhu: SoD je **preventivna** kontrola protiv prevare jedne osobe; job rotation i mandatory vacation su prvenstveno **detektivne** (i odvraćajuće). Ako pitanje kaže „zaposleni nikad ne uzima godišnji odmor i jedini zna proces plaćanja“, odgovor je mandatory vacation / job rotation.

### SLA (iz outlinea 2024.)

**Service-level agreement (SLA)** definiše mjerljive nivoe usluge (dostupnost, vrijeme odziva, vrijeme rješavanja incidenta) i posljedice nepoštovanja; interni pandan je **OLA** (operational-level agreement). Za security operacije važni su: rokovi obavještavanja o incidentu, pravo na audit, dostupnost logova. Outline 2027. SLA više ne navodi kao zasebnu pod-tačku 7.4 (ugovori sa trećim stranama pokriveni su u domenu 1).

## 7.5 Zaštita resursa

### Media management

| Aktivnost | Kontrole |
|---|---|
| **Označavanje (labeling)** | Klasifikacija vidljiva na mediju i u inventaru |
| **Inventar i praćenje** | Ko ima medij, gdje je, chain of custody za transport |
| **Skladištenje** | Zaključano, kontrolisani uslovi (temperatura, vlaga, magnetna polja), offsite za backup |
| **Transport** | Šifrovano, kurir od povjerenja, zapečaćeni kontejneri, evidencija |
| **Rukovanje** | Samo ovlašćeno osoblje, **media librarian** kao uloga |
| **Životni vijek (MTBF, broj upisa)** | Zamjena prije otkaza, provjera čitljivosti arhiva |

### Data states

| Stanje | Prijetnje | Kontrole |
|---|---|---|
| **At rest** | Krađa medija, neovlašćen pristup | Full-disk / database / file enkripcija, kontrola pristupa, upravljanje ključevima |
| **In transit** | Prisluškivanje, MitM | TLS, IPsec, VPN, mTLS |
| **In use** | Dump memorije, side-channel, screen scraping | **Confidential computing** (TEE, secure enclave), maskiranje, endpoint DLP, kontrola pristupa sesiji |

Data in use je najteže zaštititi jer se podaci u memoriji obrađuju u čistom tekstu; zato outline 2027. ističe sva tri stanja.

### Tehnike zaštite medija

**Archiving**: dugoročno čuvanje po retenciji; format i medij moraju ostati čitljivi (periodična migracija), arhiva se šifruje i testira restore. **Encryption**: štiti medij pri gubitku ili krađi; ključ se čuva odvojeno.

**Disposal/reuse** (NIST SP 800-88):

| Metoda | Opis | Ponovna upotreba |
|---|---|---|
| **Clear** | Logičko prepisivanje svih adresabilnih lokacija | Unutar organizacije, isti nivo klasifikacije |
| **Purge** | Otporno na laboratorijski oporavak: **degaussing** (samo magnetni mediji), **cryptographic erase**, block erase za SSD | Moguće van kontrole organizacije (zavisno od politike) |
| **Destroy** | Usitnjavanje, spaljivanje, topljenje, pulverizacija | Ne |

Napomene: **degaussing** ne radi na SSD-u ni optičkim medijima; kod SSD-a prepisivanje nije pouzdano zbog wear levelinga, pa se koristi crypto erase, ugrađeni sanitize ili uništenje. **Data remanence** (zaostali podaci) je rizik koji ove metode rješavaju. Brisanje fajla ili formatiranje nije sanitizacija. Nakon sanitizacije – **verifikacija** i **sertifikat o uništenju** ako to radi treća strana.

> **Na ispitu:** za najosjetljivije podatke i medij koji napušta organizaciju najsigurniji izbor je **fizičko uništenje**. Za cloud, gdje fizički pristup nije moguć, odgovor je **cryptographic erasure (crypto-shredding)**. Ako se medij ponovo koristi u istom okruženju i istom nivou klasifikacije, dovoljno je **clear**.

## Scenariji

**Scenarij 1.** HR traži od SOC-a da „pogleda e-mailove“ zaposlenog osumnjičenog za curenje podataka. Ispravno: provjeriti postoji li politika koja dozvoljava nadzor i ovlašćenje (pravna služba, HR, menadžment), raditi preko formalne istrage, sačuvati dokaze uz chain of custody i ograničiti pristup na need-to-know. Ne raditi neformalno „usluge“.

**Scenarij 2.** DLP alarm: veliki upload na lični cloud storage. Prvo triage (lažan pozitiv? ovlašćen prenos?), zatim eskalacija po playbooku; ako se potvrdi, sačuvati logove proxyja i endpointa prije nego što rotiraju.

**Scenarij 3.** Analitičar primijeti da je servisni nalog počeo da se loguje interaktivno noću iz druge zemlje. UEBA anomalija → potvrditi, onemogućiti/rotirati kredencijale kroz IR proces, provjeriti PAM evidenciju.

## Rezime

- Istraga se od početka vodi kao da će dokaz ići na sud: zakonito prikupljanje, **chain of custody**, hash, rad na kopiji, **order of volatility**, dokumentacija.
- Dokaz: relevantan, autentičan, potpun, pouzdan, prihvatljiv; **enticement** je dozvoljen, **entrapment** nije; pravo nadzora daju politika i banner.
- Artefakti: data, computer, network, mobile, cloud; izvještaj je činjeničan, ponovljiv i prilagođen publici.
- IDS alarmira, IPS blokira inline; signature vs anomaly; **false negative** je najopasniji.
- SIEM korelira, SOAR automatizuje odgovor, UEBA otkriva anomalije ponašanja; DLP i egress monitoring prate izlaz podataka i zahtijevaju klasifikaciju.
- Threat hunting je proaktivan i vođen hipotezom; continuous monitoring (SP 800-137) i tuning kroz change management.
- CM: provisioning iz golden imagea, baseline, automatizacija, CMDB, drift detection.
- DiD, least privilege i need-to-know, PAM (JIT, vault, nadzor sesija), SoD (preventivno), job rotation i mandatory vacation (detektivno).
- Data states: at rest, in transit, **in use**; sanitizacija po SP 800-88: clear, purge, destroy; degaussing ne radi na SSD-u.
- U outlineu iz 2024: bez SOAR i data in use, sa SLA u 7.4.
