## Ciljevi ispita: 3.4 i 3.5

Ovaj modul završava domen 3 (**Cloud Platform and Infrastructure Security**, 17%). Nakon što su u prethodnom modulu identifikovani komponente i rizici, ovdje se biraju kontrole i planira kontinuitet:

- **3.4 Plan and implementation of security controls**
  - fizička i okolišna zaštita (npr. on-premises),
  - identifikacija, autentifikacija i autorizacija u cloud okruženjima,
  - zaštita sistema, storagea i komunikacija,
  - audit mehanizmi (prikupljanje logova, korelacija, packet capture).
- **3.5 Plan Business Continuity (BC) and Disaster Recovery (DR)**
  - BC/DR strategija,
  - poslovni zahtjevi (RTO, RPO, recovery service level),
  - kreiranje, implementacija i testiranje plana.

Kontrole se biraju na osnovu procjene rizika (3.3). Svaka kontrola mora imati vlasnika, biti dokumentovana i provjerljiva, i koštati manje od rizika koji smanjuje.

## Vrste kontrola: podsjetnik

| Podjela po prirodi | Primjeri |
|---|---|
| **Administrativne (managerial)** | Politike, procedure, obuka, procjena rizika, provjera osoblja |
| **Tehničke (logical)** | Enkripcija, IAM, firewall, logovanje |
| **Fizičke** | Ograde, brave, kamere, zaštitari, kontrola okruženja |

| Podjela po funkciji | Primjer |
|---|---|
| **Preventive** | MFA, security grupa, enkripcija |
| **Detective** | SIEM alarm, IDS, revizija logova |
| **Corrective** | Automatska izolacija instance, restore iz backupa |
| **Deterrent** | Upozoravajući baneri, vidljive kamere |
| **Compensating** | Dodatni monitoring kada primarna kontrola nije izvodljiva |
| **Directive** | Politika prihvatljive upotrebe |

Okviri za izbor kontrola: **NIST SP 800-53** (familije kontrola, npr. PE za fizičku zaštitu, IA za identifikaciju i autentifikaciju, AC za pristup, SC za zaštitu sistema i komunikacija, AU za audit), **ISO/IEC 27001 Annex A** i **ISO/IEC 27002**, **ISO/IEC 27017** (cloud kontrole), te **CSA Cloud Controls Matrix (CCM)**.

Familije NIST SP 800-53 koje direktno odgovaraju pod-tačkama 3.4:

| Pod-tačka 3.4 | NIST SP 800-53 familije | Primjeri kontrola |
|---|---|---|
| Physical and environmental protection | **PE** (Physical and Environmental Protection) | PE-3 kontrola fizičkog pristupa, PE-11 rezervno napajanje, PE-13 zaštita od požara, PE-14 kontrola okruženja |
| Identification, authentication and authorization | **IA**, **AC** | IA-2 identifikacija i autentifikacija korisnika (MFA), AC-2 upravljanje nalozima, AC-6 least privilege |
| System, storage and communication protection | **SC**, **SI**, **CM**, **MP** | SC-8 povjerljivost u prenosu, SC-12/13 ključevi i kriptografija, SC-28 zaštita podataka at rest, SI-2 otklanjanje grešaka, CM-6 konfiguracione postavke |
| Audit mechanisms | **AU** | AU-2 događaji, AU-6 pregled i analiza, AU-9 zaštita audit informacija, AU-12 generisanje zapisa |

### Kontrole po modelu usluge

| Oblast | IaaS (customer) | PaaS (customer) | SaaS (customer) |
|---|---|---|---|
| Fizička | Ništa (provider), provjera kroz izvještaje | Isto | Isto |
| IAA | IAM, federacija, MFA, role za workloade | IAM za servis i aplikaciju | Federacija/SSO, MFA, uloge u aplikaciji |
| Sistemi | Hardening OS-a, patching, EDR | Sigurna konfiguracija servisa, kod | Sigurne postavke tenanta |
| Storage | Enkripcija volumena/objekata, ključevi, backupi | Enkripcija baze, ključevi | Opcije enkripcije koje provider nudi, izvoz |
| Komunikacije | VPC, SG, VPN, TLS | Privatni endpointi, TLS | TLS, ograničenje pristupa po IP/uređaju |
| Audit | Svi logovi + packet capture | Logovi servisa i aplikacije | Audit log koji provider izlaže |

Što je model viši (prema SaaS-u), customer ima manje tehničkih kontrola, a više zavisi od **ugovora i audit izvještaja**.

## Fizička i okolišna zaštita (3.4)

U javnom cloudu fizičku zaštitu provodi **provider**; customer je ne može kontrolisati ni direktno revidirati, nego se oslanja na **SOC 2 Type II**, **ISO/IEC 27001** certifikat i **CSA STAR**. Outline posebno naglašava **on-premises**: u privatnom ili hibridnom cloudu i kod vlastite opreme ovu odgovornost ima organizacija.

| Sloj | Kontrole |
|---|---|
| Perimetar | Ograde, barijere protiv vozila, rasvjeta, video nadzor, zaštitari, nemarkirana zgrada |
| Ulaz u zgradu | Recepcija, evidencija posjetilaca, pratnja, kartice, **mantrap** protiv tailgatinga |
| Serverske sale | Biometrija + kartica (MFA), zaključani ormari (cage, rack), logovanje ulaska |
| Okruženje | Detekcija i gašenje požara, detekcija vode, monitoring temperature i vlažnosti, HVAC |
| Napajanje | UPS, generatori, odvojene staze napajanja |
| Oprema | Inventar, kontrola unosa i iznosa medija, sanitizacija i uništenje diskova |
| Osoblje | Provjera prije zapošljavanja, princip najmanjih privilegija za fizički pristup, periodični pregled pristupa |

Zaštita od požara: detekcija dima (rana detekcija, npr. aspiracioni detektori), gašenje u serverskim salama čistim agensima (gasovi koji ne oštećuju opremu) ili **pre-action** sprinkler sistemima (cijevi su suhe dok se ne aktivira detekcija, pa se smanjuje rizik slučajnog curenja vode).

> **Na ispitu:** ako customer javnog clouda traži dokaz o fizičkoj sigurnosti providera, BEST odgovor je pregled **nezavisnog audit izvještaja** (SOC 2 Type II, ISO/IEC 27001), a ne zahtjev za obilazak data centra. Provideri gotovo nikad ne dozvoljavaju individualne fizičke revizije, jer bi to ugrozilo sigurnost svih tenanta.

## Identifikacija, autentifikacija i autorizacija u cloudu (3.4)

IAA lanac:

| Korak | Pitanje | Cloud mehanizmi |
|---|---|---|
| **Identification** | Ko tvrdiš da jesi? | Korisničko ime, ID servisa, workload identitet |
| **Authentication** | Dokaži | Lozinka + **MFA**, certifikati, FIDO2/passkeys, federacija |
| **Authorization** | Šta smiješ? | IAM politike, RBAC, ABAC, resource policies |
| **Accountability** | Šta si uradio? | Audit logovi vezani uz identitet |

Ključne kontrole:

- **Federacija** sa centralnim IdP-om (**SAML 2.0**, **OpenID Connect**) umjesto lokalnih naloga u svakom cloudu i SaaS-u: jedan identitet, centralni MFA, brzo ukidanje pristupa. Provisioning naloga u SaaS kroz **SCIM**.
- **MFA** svuda, a obavezno za privilegovane naloge; otporni metodi (FIDO2) za administratore.
- **Least privilege** i redovni pregled ovlaštenja (access review); alati koji predlažu uklanjanje neiskorištenih ovlaštenja.
- **Privileged Access Management (PAM)**: just-in-time (JIT) administratorski pristup, odobravanje, snimanje sesija.
- **Root/global admin nalog**: ne koristi se za svakodnevni rad, jak MFA, break-glass procedura, alarm na svaku upotrebu.
- **Workload / machine identiteti**: role i kratkotrajni kredencijali za servise (IAM role, managed identities, workload identity federation) umjesto statičkih ključeva u kodu.
- **Upravljanje tajnama**: secrets manager, rotacija, zabrana tajni u repozitorijima.
- **Uslovni pristup (conditional access)**: odluka uzima u obzir uređaj, lokaciju, rizik prijave.
- **Separation of duties**: npr. ko administrira ključeve ne administrira podatke, ko upravlja logovima ne upravlja sistemima.

> **Na ispitu:** organizacija sa desetinama SaaS aplikacija i problemom „zaboravljenih“ naloga bivših zaposlenih treba **federaciju (SSO) sa centralnim IdP-om i automatski provisioning/deprovisioning**. Odgovor „redovno mijenjati lozinke u svakoj aplikaciji“ ne rješava uzrok.

## Zaštita sistema, storagea i komunikacija (3.4)

### Zaštita sistema

- **Hardening** po baseline-ima (CIS Benchmarks), uklanjanje nepotrebnih servisa, sigurni **golden image-i**,
- **patch management** i upravljanje ranjivostima; u cloudu je često bolje zamijeniti instancu novim imageom nego patchovati u mjestu (immutable infrastructure),
- antimalver i **EDR/CWPP** (cloud workload protection) na hostovima i kontejnerima,
- **configuration management** i detekcija odstupanja (drift) kroz Infrastructure as Code i alate za provjeru usklađenosti (CSPM),
- zaštita hypervisora i hostova (odgovornost providera u javnom cloudu),
- trusted/secure boot i, gdje treba, **confidential computing** (zaštita podataka u upotrebi kroz hardverske enklave).

### Zaštita storagea

- **enkripcija at rest** sa jasno definisanim upravljanjem ključevima (provider-managed, customer-managed, BYOK, HYOK, HSM),
- kontrola pristupa storageu (bucket/blob politike, blokiranje javnog pristupa na nivou organizacije),
- verzionisanje, nepromjenjivost (WORM) i zaštita backupa od brisanja (zaštita od ransomwarea),
- **odvajanje backupa** u drugi nalog ili region, sa odvojenim kredencijalima,
- klasifikacija i DLP nad storageom (iz modula 05).

### Zaštita komunikacija

| Kontrola | Svrha |
|---|---|
| **TLS 1.2/1.3** | Enkripcija i integritet podataka u tranzitu, autentifikacija servera (i klijenta kod mTLS) |
| **IPsec VPN / dedicated linkovi** | Sigurna veza on-prem ↔ cloud |
| **Segmentacija i mikrosegmentacija** | Virtuelne mreže, subneti, security grupe, network ACL-ovi; ograničenje lateralnog kretanja |
| **Privatni endpointi** | Pristup cloud servisima bez izlaska na internet |
| **WAF, DDoS zaštita** | Zaštita aplikacija i dostupnosti na edgeu |
| **DNS sigurnost** | DNSSEC, filtriranje, logovanje upita |
| **Zero trust** | Svaki zahtjev se autentifikuje i autorizuje bez obzira na mrežnu lokaciju |

> **Na ispitu:** razlikuj šta štiti koju fazu: **enkripcija at rest** štiti od pristupa medijima i storageu, **TLS** štiti prenos, a ni jedno ni drugo ne štiti podatak **u upotrebi**; za to postoje confidential computing i kontrola pristupa u aplikaciji. Pitanje „provider ne smije vidjeti podatke čak ni tokom obrade“ upućuje na confidential computing ili enkripciju na strani klijenta.

## Audit mehanizmi (3.4)

Outline navodi tri mehanizma: **prikupljanje logova, korelaciju i packet capture**.

| Mehanizam | Opis | Cloud specifičnosti |
|---|---|---|
| **Log collection** | Centralno prikupljanje logova control planea, OS-a, aplikacija, mreže, IdP-a | Native servisi (CloudTrail, Azure Monitor, Cloud Audit Logs), agenti na VM-ovima, centralni log archive nalog |
| **Correlation** | Povezivanje događaja iz različitih izvora u incidente (SIEM) | Normalizacija formata, sinhronizovano vrijeme, kontekst identiteta i resursa |
| **Packet capture** | Snimanje stvarnog mrežnog saobraćaja za dubinsku analizu | U IaaS-u kroz **traffic mirroring** ili agente na hostu; u PaaS-u i SaaS-u uglavnom nemoguće; customer nema pristup fizičkoj mreži |
| Flow logs | Metapodaci o tokovima (izvor, odredište, port, bajtovi) | VPC/NSG flow logs; jeftiniji i dostupniji od punog packet capturea |

Izazovi auditiranja u cloudu:

- **vidljivost zavisi od modela**: u SaaS-u imaš samo audit log koji provider izloži,
- **packet capture** je ograničen i skup; enkriptovan saobraćaj (TLS) ograničava korist bez dešifrovanja,
- logovi su raspoređeni po nalozima, regionima i providerima,
- **pravo na audit providera** se definiše ugovorom i najčešće se ostvaruje kroz izvještaje trećih strana, ne kroz direktnu reviziju,
- vremenska sinhronizacija i retencija logova moraju biti definisani.

Primjer: tim za odgovor na incidente sumnja na eksfiltraciju iz VM-a. Flow logovi pokazuju neuobičajen saobraćaj prema nepoznatoj adresi; SIEM korelira to sa API pozivom za kreiranje novog ključa sat ranije; za dubinsku analizu tim uključuje traffic mirroring prema senzoru za packet capture na sumnjivoj instanci.

## BC i DR: pojmovi (3.5)

| Pojam | Značenje |
|---|---|
| **Business Continuity (BC)** | Nastavak kritičnih poslovnih funkcija tokom i nakon poremećaja; širi pojam (ljudi, procesi, lokacije, dobavljači, komunikacija) |
| **Disaster Recovery (DR)** | Oporavak IT sistema i podataka nakon katastrofe; tehnički dio BC-a |
| **BCP / DRP** | Plan kontinuiteta poslovanja i plan oporavka od katastrofe |
| **BIA (Business Impact Analysis)** | Analiza koja identifikuje kritične procese, zavisnosti i uticaj prekida kroz vrijeme; izvor RTO/RPO |

Standardi: **ISO 22301** (sistem upravljanja kontinuitetom poslovanja), **NIST SP 800-34 Rev. 1** (contingency planning za informacione sisteme), **ISO/IEC 27031** (ICT spremnost za kontinuitet).

### Koraci BIA

1. Identifikovati poslovne procese i njihove vlasnike.
2. Utvrditi zavisnosti: aplikacije, podaci, infrastruktura, ljudi, dobavljači i cloud provideri.
3. Procijeniti uticaj prekida kroz vrijeme (finansijski, pravni, reputacioni, operativni, po sigurnost ljudi).
4. Odrediti MTD za svaki proces, a iz njega RTO, RPO i RSL.
5. Rangirati procese po kritičnosti i odrediti redoslijed oporavka.
6. Dokumentovati i dobiti odobrenje uprave.

BIA ne procjenjuje vjerovatnoću; to radi procjena rizika. BIA odgovara na pitanje „šta ako se desi“, a procjena rizika „koliko je vjerovatno da se desi“. Obje su ulaz u BC/DR strategiju.

### Poslovni zahtjevi: metrike

| Metrika | Definicija | Primjer |
|---|---|---|
| **RTO (Recovery Time Objective)** | Ciljano maksimalno vrijeme do ponovnog uspostavljanja servisa nakon prekida | „Online bankarstvo mora raditi za 2 sata“ |
| **RPO (Recovery Point Objective)** | Maksimalan prihvatljiv gubitak podataka mjeren vremenom; određuje učestalost backupa ili replikacije | „Smijemo izgubiti najviše 15 minuta transakcija“ |
| **RSL (Recovery Service Level)** | Procenat normalnog kapaciteta ili performansi koji mora biti dostupan tokom DR stanja | „U DR stanju dovoljno je 50% kapaciteta“ |
| **MTD / MAD / MTPD** | Maximum Tolerable Downtime (Period of Disruption): vrijeme nakon kojeg prekid ugrožava opstanak organizacije | „Nakon 3 dana gubimo licencu“ |
| **WRT (Work Recovery Time)** | Vrijeme nakon tehničkog oporavka za provjeru podataka i povratak u rad | RTO + WRT ≤ MTD |

Pravila koja ispit provjerava:

- **RTO mora biti manji od MTD** (RTO + WRT ≤ MTD),
- RPO određuje strategiju podataka: RPO od 24 sata dozvoljava dnevni backup, RPO blizu nule traži sinhronu replikaciju,
- što su RTO i RPO kraći, to je rješenje skuplje,
- RTO/RPO određuje **poslovanje kroz BIA**, a ne IT,
- RSL omogućava uštedu: DR okruženje ne mora imati pun kapacitet ako poslovanje prihvati smanjen nivo usluge.

> **Na ispitu:** „Ko određuje RTO i RPO?“ **Vlasnici poslovnih procesa kroz BIA**, uz odobrenje uprave. IT predlaže rješenja i troškove koji ih ispunjavaju. Ako je ponuđeno „IT tim na osnovu mogućnosti backup sistema“, to je distraktor.

## BC/DR strategija u cloudu (3.5)

ISC2 razlikuje tri osnovna scenarija:

| Scenarij | Opis | Prednosti | Rizici |
|---|---|---|---|
| On-prem primarno, **cloud kao DR** | Produkcija u vlastitom data centru, DR u cloudu | Nema druge fizičke lokacije, plaćanje po upotrebi | Kompatibilnost, mreža, testiranje |
| Cloud primarno, **DR kod istog providera** (drugi region/zona) | Multi-AZ ili multi-region kod istog providera | Jednostavno, isti alati, brza replikacija | Ispad ili problem na nivou cijelog providera; lock-in |
| Cloud primarno, **DR kod drugog providera** | Multi-cloud DR | Otpornost na ispad, bankrot ili pravni problem providera | Složenost, različiti servisi, portabilnost podataka i konfiguracija |

Klasični tipovi lokacija i njihovi cloud ekvivalenti:

| Klasično | Cloud obrazac | RTO/RPO | Trošak |
|---|---|---|---|
| **Cold site** | **Backup and restore**: samo backupi u drugom regionu, infrastruktura se pravi tek pri katastrofi (IaC) | Sati do dana | Najniži |
| **Warm site** | **Pilot light**: osnovni servisi (npr. replicirana baza) rade, ostalo se podiže po potrebi | Desetine minuta do sati | Nizak do srednji |
| **Warm site+** | **Warm standby**: umanjena, ali funkcionalna kopija produkcije, skalira se pri prelasku | Minute | Srednji |
| **Hot site** | **Multi-site active/active**: puna produkcija na više lokacija istovremeno | Skoro nula | Najviši |

Ključna razmatranja strategije:

- **pouzdanost i lokacija** DR lokacije (dovoljno daleko, druga jurisdikcija ako je dozvoljeno),
- **replikacija podataka** (sinhrona ili asinhrona, u skladu sa RPO),
- **Infrastructure as Code**: DR okruženje se može brzo kreirati iz koda,
- **DNS i mrežno prebacivanje** (failover, health checks),
- **zavisnosti**: identitet (IdP), DNS, ključevi (KMS mora biti dostupan u DR regionu), treće strane,
- **kapaciteti**: hoće li u velikoj regionalnoj katastrofi drugi region imati dovoljno kapaciteta (rezervacije),
- **zaštita backupa** od ransomwarea (nepromjenjivost, odvojen nalog),
- **ugovori i SLA**: šta provider garantuje, a SLA krediti ne nadoknađuju poslovni gubitak,
- **povratak (failback)** na primarnu lokaciju nakon oporavka.

### Ugovor i SLA u kontekstu BC/DR

| Element | Pitanje za providera |
|---|---|
| SLA dostupnosti | Koliki procenat se garantuje i kako se mjeri (po servisu, regionu)? |
| SLA krediti | Šta customer dobija pri kršenju (obično samo popust na račun, ne naknadu štete)? |
| Obavještavanje | Koliko brzo provider javlja incidente i ispade? |
| Lokacije | U kojim regionima i jurisdikcijama mogu biti DR kopije? |
| Prenosivost | Kako se podaci izvoze, u kom formatu i roku (izlazna strategija)? |
| BC providera | Ima li provider vlastiti BCP i kako ga testira (dokaz kroz SOC 2 i ISO 22301)? |
| Testiranje | Smije li customer izvoditi DR testove i pod kojim uslovima? |

Uloge u BC/DR:

| Uloga | Odgovornost |
|---|---|
| Uprava / sponzor | Odobrava strategiju, budžet i prihvata rezidualni rizik |
| BC/DR koordinator | Vodi izradu, održavanje i testiranje plana |
| Vlasnici procesa | Definišu zahtjeve (BIA) i učestvuju u testovima |
| Tehnički timovi | Implementiraju i izvršavaju procedure oporavka |
| Komunikacije i pravna služba | Obavještavanje klijenata, regulatora i medija |
| Cloud provider | Isporučuje usluge prema ugovoru i SLA, sarađuje pri incidentu |

> **Na ispitu:** ako scenario navodi da je glavni rizik **prestanak rada ili bankrot providera**, DR u drugom regionu istog providera **ne rješava** problem. Traži se strategija sa **drugim providerom** i portabilnim podacima, uz izlaznu strategiju u ugovoru.

### Izbor strategije po kritičnosti

Ne traži svaki sistem isti nivo zaštite. Strategija se bira po sistemu, iz BIA rangiranja:

| Kritičnost | Tipičan RTO / RPO | Obrazac | Primjer |
|---|---|---|---|
| Kritičan (tier 0/1) | Minute / sekunde do minuta | Warm standby ili active/active | Plaćanja, checkout, sistem hitnih službi |
| Važan (tier 2) | Sati / do sat vremena | Pilot light | Katalog, CRM |
| Podržavajući (tier 3) | Dan / 24 sata | Backup and restore | Interni wiki, izvještavanje |
| Nekritičan | Dani / dani | Backup and restore ili prihvatanje rizika | Arhivske analize |

Ukupan trošak DR-a se tako drži razumnim: skupa rješenja samo tamo gdje BIA to opravdava.

### Backup strategija kao temelj DR-a

Pravilo **3-2-1** i dalje važi u cloudu, uz dopunu za ransomware:

| Element | Značenje | Cloud primjer |
|---|---|---|
| 3 kopije | Produkcija + dvije kopije | Primarni podaci, backup u istom regionu, kopija u drugom regionu |
| 2 različita medija / servisa | Kopije ne dijele isti mehanizam kvara | Snapshot + backup u drugi storage servis ili drugog providera |
| 1 van lokacije | Bar jedna kopija geografski odvojena | Drugi region ili drugi provider |
| +1 nepromjenjiva / offline | Kopija koju napadač sa admin pravima ne može obrisati | Object Lock (compliance mode), vault lock, odvojen nalog |
| 0 grešaka pri restoreu | Redovno testiran oporavak | Automatizovani restore testovi |

### Aktivacija plana: incident ili katastrofa

Nije svaki prekid katastrofa. Plan mora jasno definisati:

- **kriterije proglašenja** (npr. očekivani prekid duži od RTO-a, gubitak lokacije ili regiona),
- **ko ima ovlaštenje** da proglasi katastrofu i aktivira DR (obično imenovani rukovodilac i zamjenik),
- **eskalaciju**: incident response tim procjenjuje situaciju, a ako prekid prelazi pragove, aktivira se BC/DR,
- **komunikacioni lanac** i alternativne kanale komunikacije (ako je korporativni email u pogođenom cloudu),
- **povratak (failback)**: kriterije i proceduru vraćanja na primarnu lokaciju, uključujući sinhronizaciju podataka nastalih u DR stanju.

Kod ransomwarea DR ima posebnu nijansu: prije oporavka treba utvrditi da backup nije zaražen i da je napadač uklonjen iz okruženja, inače se oporavlja u kompromitovano okruženje. Zato se oporavak radi u **čisto okruženje** (clean room) iz nepromjenjivih backupa.

## Kreiranje, implementacija i testiranje plana (3.5)

### Faze kreiranja plana (prema ISC2 CBK)

1. **Definisanje opsega** (scope): koji procesi, sistemi i lokacije; podrška uprave.
2. **Prikupljanje zahtjeva i konteksta**: BIA, RTO/RPO/RSL, regulatorni zahtjevi.
3. **Analiza**: zavisnosti, scenariji prijetnji, trenutne mogućnosti.
4. **Procjena rizika**: koji scenariji su vjerovatni i šta ugrožavaju.
5. **Dizajn**: izbor strategije, arhitekture i procedura.
6. **Implementacija**: izgradnja DR okruženja, replikacija, runbookovi, uloge i kontakti, komunikacioni plan.
7. **Testiranje**.
8. **Izvještavanje i revizija**: nalazi, poboljšanja, ažuriranje plana.

Plan mora sadržavati: uloge i odgovornosti (ko proglašava katastrofu), kontakt liste (uključujući providera), kriterije aktivacije, detaljne korake oporavka po sistemu, redoslijed oporavka po prioritetima iz BIA, komunikaciju prema zaposlenima, klijentima i regulatorima, i postupak povratka u normalan rad. Plan se čuva i **van sistema koji štiti** (ako je samo na wikiju u istom cloudu, neće biti dostupan kada ga trebaš).

### Testiranje

| Tip testa | Opis | Uticaj na produkciju |
|---|---|---|
| **Checklist / read-through** | Učesnici pregledaju plan i provjeravaju da je ažuran | Nikakav |
| **Structured walkthrough / tabletop** | Tim prolazi kroz scenarij za stolom i diskutuje korake | Nikakav |
| **Simulation** | Simulira se scenarij do tačke prelaska, uz stvarne aktivnosti bez prebacivanja produkcije | Minimalan |
| **Parallel test** | DR sistemi se podignu i obrađuju podatke paralelno, produkcija i dalje radi | Mali |
| **Full interruption (full cutover)** | Produkcija se stvarno gasi i radi se na DR lokaciji | Visok rizik; rijetko, uz odobrenje uprave |

Dobra praksa:

- testirati **redovno** (najmanje godišnje) i nakon većih promjena,
- testovi idu od manje ka više rizičnim,
- u cloudu je lakše testirati: DR okruženje se može podići iz IaC-a i ugasiti nakon testa; **chaos engineering** i game days testiraju otpornost u kontrolisanim uslovima,
- testiranje kod providera može zahtijevati **najavu i dozvolu** (npr. testovi opterećenja),
- mjeriti postignute RTO/RPO i porediti sa ciljevima,
- **lessons learned** i ažuriranje plana nakon svakog testa i stvarnog incidenta.

> **Na ispitu:** „Koji test daje NAJVIŠE povjerenja uz NAJMANJI rizik za produkciju?“ obično je **parallel test**. Full interruption daje najviše povjerenja, ali nosi rizik stvarnog prekida. Tabletop je najjeftiniji, ali ne dokazuje da tehnika radi.

## Česte zamke na ispitu

- „Visoka dostupnost (multi-AZ) je isto što i DR“: multi-AZ štiti od kvara jedne zone, ne od greške u konfiguraciji, brisanja podataka, ransomwarea ili ispada cijelog regiona.
- „Replikacija je backup“: replikacija prenosi i greške i brisanje; potrebni su i nepromjenjivi backupi sa istorijom.
- „SLA kredit pokriva gubitak“: krediti su obično mali popusti i ne nadoknađuju poslovni gubitak.
- „IT određuje RTO/RPO“: određuje ih poslovanje kroz BIA.
- „Plan je gotov kada je napisan“: plan bez testiranja i održavanja ne vrijedi.
- „Prvo tehnologija“: u katastrofi je prioritet uvijek **sigurnost ljudi**, pa tek onda sistemi.
- „Customer može auditovati fizičke kontrole providera“: oslanja se na nezavisne izvještaje.

## Scenario: e-commerce platforma

Online prodavnica radi u jednom cloud regionu. BIA pokazuje: checkout ima MTD 8 sati, RTO 1 sat, RPO 5 minuta; katalog proizvoda RTO 4 sata, RPO 24 sata; analitika RTO 3 dana. Tokom DR stanja prihvatljivo je 60% kapaciteta (RSL).

1. **Kontrole (3.4)**: federacija sa IdP-om i MFA za konzolu, PAM za administratore, enkripcija baze customer-managed ključem replikovanim u DR region, TLS svuda, WAF, centralni logovi u odvojenom nalogu i SIEM korelacija, flow logovi i traffic mirroring za kritične instance po potrebi.
2. **Strategija (3.5)**: checkout koristi **warm standby** u drugom regionu sa asinhronom replikacijom baze (RPO u minutama) i skaliranjem na 60% pri prelasku; katalog koristi **pilot light**; analitika **backup and restore**.
3. **Zavisnosti**: KMS ključevi, IdP i DNS dostupni u DR regionu; backupi u odvojenom nalogu sa nepromjenjivošću.
4. **Testiranje**: kvartalni tabletop, polugodišnji parallel test za checkout sa mjerenjem RTO/RPO, godišnja revizija plana sa upravom.

## Rezime

- Kontrole se biraju iz procjene rizika; okviri su NIST SP 800-53, ISO/IEC 27001/27002/27017 i CSA CCM.
- **Fizičku zaštitu** u javnom cloudu provodi provider; customer je provjerava kroz SOC 2 Type II, ISO/IEC 27001 i CSA STAR; on-prem je odgovornost organizacije.
- **IAA u cloudu**: federacija (SAML, OIDC), SCIM, MFA, least privilege, PAM/JIT, zaštita root naloga, workload identiteti umjesto statičkih ključeva.
- **Zaštita sistema** (hardening, patching, CWPP), **storagea** (enkripcija, ključevi, WORM, odvojeni backupi) i **komunikacija** (TLS, VPN, segmentacija, privatni endpointi, zero trust).
- **Audit mehanizmi**: log collection, korelacija u SIEM-u, packet capture (u IaaS-u kroz traffic mirroring, u SaaS-u nemoguć); flow logs kao jeftinija alternativa.
- **BC** je širi od **DR**; BIA daje **RTO, RPO, RSL, MTD**; RTO + WRT ≤ MTD; metrike određuje poslovanje.
- Cloud DR scenariji: on-prem → cloud, isti provider drugi region, drugi provider; obrasci backup and restore, pilot light, warm standby, active/active.
- Plan: opseg, zahtjevi, analiza, rizik, dizajn, implementacija, testiranje, revizija; čuvati ga van sistema koji štiti.
- Testovi: checklist, tabletop, simulation, parallel, full interruption; testirati redovno i ažurirati plan.
