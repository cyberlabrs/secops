## Ciljevi ispita: 5.4, 5.5 i 5.6

Domen 5 (**Cloud Security Operations**) nosi 17% ispita. Ovaj modul zatvara domen sa tri cilja:

- **5.4 Support digital forensics**: metodologije prikupljanja forenzičkih podataka (forensic data collection methodologies), upravljanje dokazima (evidence management), prikupljanje, akvizicija i očuvanje digitalnih dokaza (collecting, acquiring, and preserving digital evidence),
- **5.5 Manage communication with relevant parties**: dobavljači (vendors), korisnici (customers), partneri (partners), regulatori (regulators) i ostali stakeholderi (other stakeholders),
- **5.6 Manage security operations**: Security Operations Center (SOC), inteligentni nadzor sigurnosnih kontrola (firewall, IDS, IPS, honeypot, network security groups, AI), prikupljanje i analiza logova (SIEM, log management, threat intelligence), Incident Response (IR), procjena ranjivosti (vulnerability assessments) i penetraciono testiranje (penetration testing).

Pravni okvir forenzike i eDiscovery (ISO/IEC 27037/27041/27042/27043, ISO/IEC 27050) detaljno je u modulu 13 (cilj 6.1). Ovdje gledamo **operativnu** stranu: kako tim u cloudu zaista prikuplja i čuva dokaze, koga obavještava i kako vodi SOC.

> **Na ispitu:** CCSP ne pita koju komandu kucaš, nego koju odluku donosiš. Kod forenzike je odgovor gotovo uvijek „sačuvaj integritet dokaza i lanac nadzora (chain of custody)“, a kod komunikacije „poštuj ugovor, zakon i unaprijed dogovoren komunikacioni plan“.

## Digitalna forenzika u cloudu: zašto je drugačije

Klasična forenzika pretpostavlja da istražitelj može fizički uzeti disk, napraviti bit-po-bit kopiju i zapečatiti original. U cloudu to uglavnom nije moguće:

| Izazov | Opis | Posljedica za istragu |
|---|---|---|
| **Multitenancy** | Fizički hardver dijeli više korisnika | Zaplijena servera bi povrijedila podatke drugih tenanata; provajder je ne dozvoljava |
| **Nedostatak fizičkog pristupa** | Korisnik nikad ne vidi disk ni host | Akvizicija ide preko API-ja (snapshot, export) |
| **Volatilnost i elastičnost** | Instance i kontejneri se gase automatski (auto scaling, serverless) | Dokaz može nestati za minute; potrebno automatsko prikupljanje |
| **Distribuiranost podataka** | Podaci su raspoređeni po zonama, regionima, državama | Pitanje nadležnosti (jurisdiction) i zakonitosti prikupljanja |
| **Zavisnost od provajdera** | Logovi hipervizora, mreže i fizičke kontrole su kod CSP-a | Saradnja mora biti ugovorena unaprijed |
| **Model usluge** | U SaaS-u korisnik vidi samo aplikacijske logove | Što je viši model, manje forenzičkih artefakata ima korisnik |
| **Šifrovanje** | Podaci šifrovani ključevima CSP-a ili korisnika | Bez ključa nema čitljivog dokaza; crypto-shredding briše dokaz zauvijek |

### Ko šta može prikupiti po modelu usluge

| Artefakt | IaaS | PaaS | SaaS |
|---|---|---|---|
| Memorija (RAM) guest OS-a | Korisnik (agent ili alat u instanci) | Uglavnom ne | Ne |
| Disk / volumen | Korisnik (snapshot) | Ograničeno | Ne |
| OS i aplikacijski logovi | Korisnik | Djelimično (platformski logovi) | Samo ono što aplikacija izlaže |
| Mrežni flow logovi | Korisnik (ako uključi) | Djelimično | Ne |
| Control plane / API logovi | Korisnik (npr. AWS CloudTrail, Azure Activity Log) | Korisnik | Audit log aplikacije (npr. Microsoft 365 Unified Audit Log) |
| Hipervizor, fizička mreža, data centar | CSP | CSP | CSP |

> **Na ispitu:** ako pitanje kaže da organizacija koristi SaaS i treba forenzičke podatke kojih nema u audit logu, ispravan odgovor je da se oslanja na **ugovor** i saradnju provajdera (ugovorena dostupnost logova, rokovi čuvanja, kontakt za istrage), a ne da „sama napravi image servera“.

## Metodologije prikupljanja forenzičkih podataka (5.4)

Opšte prihvaćen forenzički proces ima faze koje se pojavljuju i u ISO/IEC 27037 i u NIST SP 800-86 (Guide to Integrating Forensic Techniques into Incident Response):

| Faza | NIST SP 800-86 | ISO/IEC 27037 aktivnost | Šta znači u cloudu |
|---|---|---|---|
| 1 | **Collection** | **Identification** | Pronaći gdje su potencijalni dokazi: koji nalog, region, resurs, log |
| 2 | Collection | **Collection / Acquisition** | Collection = fizičko uzimanje uređaja; acquisition = pravljenje kopije. U cloudu skoro uvijek acquisition (snapshot, export logova) |
| 3 | Collection | **Preservation** | Zaštita od izmjene: hash, write-once storage (WORM), legal hold, ograničen pristup |
| 4 | **Examination** | (ISO/IEC 27042) | Izdvajanje relevantnih podataka iz kopije |
| 5 | **Analysis** | (ISO/IEC 27042) | Tumačenje, vremenska linija, zaključci |
| 6 | **Reporting** | (ISO/IEC 27042/27043) | Izvještaj razumljiv pravnicima i menadžmentu, sa metodom koja se može ponoviti |

Ključni principi svake metodologije:

- **Integritet**: analiza se radi na kopiji, nikad na originalu; original i kopija se heširaju (SHA-256) i hash se upisuje u zapisnik.
- **Ponovljivost (repeatability) i reproduktivnost (reproducibility)**: drugi istražitelj istom metodom mora dobiti isti rezultat.
- **Auditabilnost**: svaki korak je dokumentovan (ko, kada, šta, kojim alatom).
- **Opravdanost (justifiability)**: istražitelj mora moći objasniti zašto je izabrao baš tu metodu (ISO/IEC 27037).
- **Redoslijed volatilnosti (order of volatility)**: prvo se prikuplja ono što najbrže nestaje (RFC 3227).

### Redoslijed volatilnosti

| Redoslijed | Izvor | Primjer u cloudu |
|---|---|---|
| 1 | Registri, keš CPU-a | Praktično nedostupno korisniku |
| 2 | Memorija (RAM), tabela procesa, mrežne konekcije | Memory dump iz instance prije gašenja |
| 3 | Privremeni fajl sistemi, swap | Ephemeral / instance store volumen (nestaje kad se instanca zaustavi) |
| 4 | Disk | Snapshot EBS/managed diska |
| 5 | Udaljeni logovi i monitoring | CloudTrail, flow logovi, SIEM |
| 6 | Arhivski mediji | Backup, arhiva u Glacier klasi |

Praktična posljedica: ako je kompromitovana instanca, **ne gasi je** odmah. Izoluj je mrežno (restriktivna security grupa ili network security group), uhvati memoriju, napravi snapshot diska, označi resurs tagom i tek onda odluči o gašenju.

### Automatizovano prikupljanje

Zbog elastičnosti cloud forenzika mora biti spremna unaprijed (**forensic readiness**):

- logovi control planea i data planea uključeni u **svim** nalozima i regionima i centralno sačuvani u posebnom, zaključanom nalogu (log archive),
- immutable storage (Object Lock / WORM) za logove i dokaze,
- unaprijed pripremljen izolovani **forenzički nalog / pretplata** sa alatima i ograničenim pristupom,
- automatizacija (npr. EventBridge + Step Functions ili Azure Logic Apps) koja na nalaz pravi snapshot i memory dump prije nego što auto scaling ugasi instancu,
- sinhronizovano vrijeme (NTP) svih izvora, inače vremenska linija nema smisla,
- ugovorom definisano šta CSP čuva, koliko dugo i kako se traži.

> **Na ispitu:** pitanje „šta je NAJVAŽNIJE uraditi PRIJE incidenta da bi forenzika u cloudu bila moguća“ cilja **forensic readiness**: logovanje, retenciju, ugovorne obaveze CSP-a i plan. Alat za analizu je sporedan.

## Upravljanje dokazima i lanac nadzora (5.4)

**Evidence management** obuhvata cijeli život dokaza od identifikacije do vraćanja ili uništenja. Srce je **chain of custody** (lanac nadzora): hronološki zapis ko je imao dokaz, kada, gdje i zašto, bez prekida.

| Element zapisnika chain of custody | Primjer |
|---|---|
| Jedinstveni identifikator dokaza | EVD-2026-014 |
| Opis | Snapshot volumena vol-0abc, instanca i-0def, region eu-central-1 |
| Vrijeme i način akvizicije | 2026-10-12 14:03 UTC, API CreateSnapshot, IR rola |
| Hash | SHA-256 slike i exportovanih logova |
| Ko je preuzeo i predao | Ime, uloga, potpis (digitalni) |
| Lokacija čuvanja | Forenzički nalog, bucket sa Object Lock (compliance mode), KMS ključ forenzičkog tima |
| Svaki pristup | Ko je otvorio kopiju i zašto |

Pravila dobrog upravljanja dokazima:

1. **Minimalan broj ljudi** ima pristup; pristup se loguje.
2. **Odvajanje**: dokazi se čuvaju van kompromitovanog okruženja (drugi nalog, druga pretplata, drugi ključevi).
3. **Integritet**: hash pri akviziciji i pri svakom korištenju; WORM storage.
4. **Povjerljivost**: dokazi često sadrže lične podatke, pa važe pravila privatnosti (GDPR) i za forenzički tim.
5. **Legal hold**: kad se očekuje sudski postupak, obavezno se obustavlja redovno brisanje (retention policy) za relevantne podatke.
6. **Dokumentovana metoda**: koji alat, verzija, postavke (zbog prihvatljivosti na sudu, **admissibility**).

### Prihvatljivost dokaza

Da bi dokaz bio upotrebljiv u postupku, tradicionalno mora biti:

| Osobina | Značenje |
|---|---|
| **Authentic** | Dokazivo je ono za šta se tvrdi da jeste (hash, chain of custody) |
| **Accurate / reliable** | Metoda prikupljanja je pouzdana i ponovljiva |
| **Complete** | Prikazuje cijelu sliku, ne samo dio koji odgovara jednoj strani |
| **Admissible / legally obtained** | Prikupljen u skladu sa zakonom i nadležnošću (jurisdiction) |
| **Believable** | Razumljiv sudu, porotnicima ili regulatoru |

### Scenario: kompromitovan kontejner

Detekcija prijavljuje sumnjiv proces u podu na managed Kubernetes klasteru. Pod je dio deploymenta sa tri replike i horizontal pod autoscalerom.

1. Označiti pod i node, izolovati ga network policyjem (deny all) i ukloniti iz servisa (izmjenom labela), da kontroler ne bi pravio zamjenu na istom mjestu bez traga.
2. Prikupiti volatilne podatke: procese, mrežne konekcije, sadržaj fajl sistema kontejnera (writable layer), logove.
3. Napraviti snapshot diska noda ako je potrebno.
4. Exportovati audit logove API servera i cloud control planea u forenzički nalog, heširati, upisati u chain of custody.
5. Tek tada brisati pod i izvršiti eradikaciju (nova slika, rotacija tajni).

Pogrešan prvi korak bio bi „odmah obrisati pod da se zaustavi napad“: šteta se zaustavlja izolacijom, a brisanjem nestaje dokaz.

## Komunikacija sa relevantnim stranama (5.5)

Cloud uvodi više strana nego klasičan data centar. Komunikacija mora biti **planirana unaprijed** (komunikacioni plan, kontakt matrica, ugovori) i **kontrolisana** (ko smije šta reći, kome i kada). Pet grupa iz outlinea:

| Strana | Tipična komunikacija | Kanal i osnova | Rizik ako se pogriješi |
|---|---|---|---|
| **Vendors** (CSP, dobavljači, podizvođači) | Prijava incidenta, zahtjev za logove, promjene usluge, planirani prekidi, end-of-life | Ugovor, SLA, support kanal, security kontakt | Kašnjenje istrage, nepoštovanje ugovora |
| **Customers** (korisnici usluge) | Obavještenje o prekidu, incidentu, promjeni uslova, status stranica | SLA, uslovi korištenja, zakon o obavještavanju | Gubitak povjerenja, kazne zbog neobavještavanja |
| **Partners** (poslovni partneri, integracije, federacija identiteta) | Dijeljenje indikatora kompromitacije, koordinacija zajedničkih kontrola | Ugovor o partnerstvu, NDA, ISAC | Širenje incidenta kroz povezane sisteme |
| **Regulators** (nadzorni organi, CERT, sektorski regulator) | Zakonski obavezna prijava povrede podataka ili incidenta, odgovori na upite, izvještaji | Zakon (GDPR, NIS2, DORA, HIPAA, SEC) | Novčane kazne, gubitak licence |
| **Other stakeholders** (uprava, zaposleni, investitori, mediji, policija, osiguravač) | Eskalacija, interna obavještenja, javna izjava, prijava osiguranju | Interne politike, PR plan, polisa osiguranja | Curenje informacija, kontradiktorne izjave, gubitak pokrića |

### Principi komunikacije

- **Need to know**: detalji incidenta idu samo onima kojima trebaju. Tehnički detalji ranjivosti ne idu u javnu izjavu.
- **Jedan glas**: javno komunicira samo ovlaštena osoba (PR, pravna služba), u skladu sa planom.
- **Pravna služba unaprijed**: prije obavještenja regulatora i korisnika uključuje se pravni tim (sadržaj, rokovi, obaveza).
- **Rokovi su zakonski**: npr. GDPR čl. 33 traži prijavu nadzornom organu bez nepotrebnog odlaganja, a gdje je izvodljivo u roku od **72 sata** od saznanja; NIS2 traži rano upozorenje (early warning) u roku od **24 sata**, obavještenje o incidentu u roku od **72 sata** i završni izvještaj u roku od mjesec dana; DORA ima slične faze za finansijski sektor. Detalji su u modulima 13 i 14.
- **Out-of-band kanali**: ako je kompromitovan e-mail ili tenant za saradnju, tim komunicira alternativnim kanalom.
- **Dokumentovanje**: svaka komunikacija tokom incidenta se zapisuje (kasnije služi regulatoru i za lessons learned).
- **Osiguranje**: cyber polisa obično traži obavještenje osiguravača u kratkom roku i odobrenje za angažovanje IR firme; propust može značiti gubitak pokrića.

### Komunikacija sa CSP-om

Provajder obično **ne** obavještava korisnika o svakom događaju, a često komunicira preko status stranice i personal health dashboarda (npr. AWS Health, Azure Service Health). Za korisnika je važno:

- znati koji su ugovorni rokovi CSP-a za obavještavanje o incidentima koji pogađaju njegove podatke,
- imati ažurne kontakte (security contact, alternate contacts na nalogu),
- znati da CSP dijeli informacije prema vlastitim pravilima: korisnik ne može tražiti logove drugih tenanata,
- imati proceduru za zahtjeve tijela vlasti prema CSP-u (CSP može biti zakonski spriječen da obavijesti korisnika, npr. gag order).

> **Na ispitu:** kad incident pogađa lične podatke, a pitanje pita šta uraditi PRVO od ponuđenih koraka komunikacije, gotovo uvijek je ispravno **aktivirati incident response / komunikacioni plan i uključiti pravnu službu** prije nego što se bilo šta javno objavi. Kontroler (cloud customer) ostaje odgovoran za obavještenje regulatora i ispitanika, čak i kad se incident dogodio kod provajdera.

## Security Operations Center (5.6)

**SOC** je funkcija (tim, procesi i tehnologija) koja neprekidno nadzire, otkriva, analizira i odgovara na sigurnosne događaje. U cloudu SOC mora pratiti control plane (API pozive), identitete i konfiguraciju, ne samo mrežu.

| Model SOC-a | Prednosti | Mane | Kada |
|---|---|---|---|
| **Interni (in-house)** | Kontrola, poznavanje okruženja | Skupo, teško naći ljude za 24/7 | Velike, regulisane organizacije |
| **Outsourced / MSSP / MDR** | 24/7 pokrivenost, ekspertiza | Manje konteksta, zavisnost od dobavljača, pitanje pristupa podacima | Mala i srednja preduzeća |
| **Hibridni** | Interni tim za kontekst + MSSP za noćne smjene | Koordinacija, jasne granice odgovornosti | Najčešći model |
| **Virtuelni / distribuirani** | Fleksibilno, bez fizičke prostorije | Zahtijeva dobre alate za saradnju | Cloud-native firme |

Tipične uloge: **Tier 1** analitičar (trijaža alarma), **Tier 2** (dublja analiza, IR), **Tier 3** (threat hunting, forenzika, inženjering detekcija), SOC menadžer, inženjer detekcija (detection engineering), threat intel analitičar.

Mjerila uspjeha SOC-a:

| Metrika | Značenje |
|---|---|
| **MTTD** (mean time to detect) | Prosječno vrijeme od početka napada do otkrivanja |
| **MTTR** (mean time to respond / recover) | Prosječno vrijeme do zaustavljanja ili oporavka |
| Stopa lažnih pozitiva | Udio alarma koji nisu stvarni incidenti (zamor analitičara, alert fatigue) |
| Pokrivenost izvora logova | Koliko kritičnih sistema šalje logove u SIEM |
| Pokrivenost tehnika | Koliko tehnika iz MITRE ATT&CK (Cloud matrix) ima detekciju |

Ako je SOC outsourcan, odgovornost za odluke ostaje kod organizacije. Ugovor mora definisati SLA za trijažu i eskalaciju, ko smije poduzeti containment akcije, gdje se čuvaju logovi i kako MSSP pristupa podacima.

## Inteligentni nadzor sigurnosnih kontrola (5.6)

„Intelligent monitoring“ znači da se kontrole ne samo postave, nego se njihov rad i stanje stalno prate, koreliraju i poboljšavaju, sve češće uz pomoć analitike i AI.

| Kontrola | Funkcija | Cloud oblik | Šta nadzirati |
|---|---|---|---|
| **Firewall** | Filtriranje saobraćaja po pravilima | Cloud native firewall (AWS Network Firewall, Azure Firewall), NGFW appliance, **WAF** za L7 | Pogođena pravila, promjene pravila, pravila „any-any“ |
| **Network security groups / security groups** | Stateful filtriranje na nivou instance ili mrežnog interfejsa | Security group (AWS), NSG (Azure), firewall rules (GCP) | Otvoreni portovi prema 0.0.0.0/0, odstupanje od baseline-a (drift), flow logovi |
| **IDS** | Otkrivanje i alarm (pasivno) | Mirroring saobraćaja ka senzoru, managed threat detection (GuardDuty, Defender for Cloud) | Kvalitet signatura, lažni pozitivi |
| **IPS** | Otkrivanje i blokiranje (inline) | Inline appliance, IPS modul cloud firewalla | Lažni pozitivi koji blokiraju legitiman saobraćaj, latencija |
| **Honeypot / honeynet / honeytoken** | Mamac koji legitimni korisnici ne koriste, pa je svaki pristup sumnjiv | Lažna instanca, lažni access key (canary token), lažni zapis u bazi | Svaki pristup = alarm visoke pouzdanosti |
| **AI / ML analitika** | Otkrivanje anomalija, UEBA, korelacija, pomoć analitičaru | Ugrađeno u SIEM/XDR, generativni asistenti za istragu | Kvalitet modela, objašnjivost, lažni negativi, drift modela |

Važne nijanse:

- **IDS vs IPS**: IDS samo alarmira, IPS blokira. IPS u inline poziciji može prekinuti poslovanje ako je lažni pozitiv; zato se nova pravila često uvode prvo u detection modu.
- **Signature-based vs anomaly/behavior-based**: signature otkriva poznato (malo lažnih pozitiva, ne vidi zero-day), anomaly otkriva odstupanje od normalnog (vidi novo, više lažnih pozitiva).
- **Honeypot** mora biti izolovan i služi otkrivanju, nikad „napadu nazad“. Pravno pitanje je entrapment (navođenje): honeypot pasivno čeka, ne poziva napadača.
- **AI u SOC-u** smanjuje zamor analitičara (grupisanje alarma, sažetak incidenta, prijedlog upita), ali odluke sa velikim uticajem i dalje traže čovjeka (human in the loop). AI sistemi i sami postaju predmet nadzora: prompt injection, curenje podataka kroz model, nepouzdani izlazi.
- **Nadzor kontrola znači i nadzor konfiguracije**: CSPM alati (cloud security posture management) otkrivaju pogrešno konfigurisane kontrole, a promjene kontrola idu kroz change management.

> **Na ispitu:** ako pitanje traži kontrolu sa **najmanje lažnih pozitiva** za otkrivanje unutrašnjeg napadača ili lateralnog kretanja, razmisli o **honeytokenu / honeypotu**: legitimni korisnici ga ne dodiruju. Ako traži da se napad **zaustavi automatski**, to je IPS (ili WAF u blok modu), a ne IDS.

## Prikupljanje i analiza logova (5.6)

| Pojam | Šta je |
|---|---|
| **Log management** | Prikupljanje, normalizacija, čuvanje, zaštita i brisanje logova u skladu sa politikom retencije |
| **SIEM** (Security Information and Event Management) | Centralizuje logove, korelira događaje iz više izvora, generiše alarme, podržava istragu i izvještaje za usklađenost |
| **SOAR** (Security Orchestration, Automation and Response) | Playbookovi koji automatizuju odgovor (obogaćivanje, izolacija, tiket) |
| **XDR** | Integrisana detekcija i odgovor preko endpointa, identiteta, e-maila i clouda, obično od jednog dobavljača |
| **Threat intelligence** | Kontekst o prijetnjama: indikatori (IoC), taktike i tehnike (TTP), akteri; strateška, taktička, operativna, tehnička |
| **UEBA** | Analitika ponašanja korisnika i entiteta (anomalije u prijavama, pristupu podacima) |

### Šta logovati u cloudu

| Sloj | Primjeri | Zašto |
|---|---|---|
| Control plane / management | AWS CloudTrail, Azure Activity Log, GCP Cloud Audit Logs | Ko je promijenio infrastrukturu, IAM, ključeve |
| Identitet | Prijave, MFA, izdavanje tokena (Entra ID sign-in logs, IdP logovi) | Kompromitovani nalozi su najčešći vektor |
| Mreža | VPC / NSG flow logovi, DNS logovi, logovi firewalla i WAF-a | Exfiltracija, C2, skeniranje |
| Data plane | Pristup objektima (S3 data events), baze, ključevi (KMS) | Ko je čitao osjetljive podatke |
| Workload | OS logovi, aplikacijski logovi, Kubernetes audit log, logovi kontejnera | Ponašanje unutar sistema |
| SaaS | Audit logovi SaaS aplikacija | Često zaboravljen izvor |

Dobre prakse:

- **Centralizacija** u poseban nalog sa ograničenim pristupom (napadač koji kompromituje workload ne smije moći brisati logove).
- **Integritet**: validacija integriteta log fajlova (npr. CloudTrail log file validation), WORM storage, hash lanci.
- **Sinhronizacija vremena** i normalizacija formata (npr. OCSF, ECS) za korelaciju.
- **Retencija** prema zakonskim, ugovornim i poslovnim zahtjevima (npr. PCI DSS traži godinu dana historije, od čega tri mjeseca odmah dostupno).
- **Privatnost**: logovi sadrže lične podatke (IP adrese, korisnička imena) i podliježu GDPR-u: minimizacija, pristup po potrebi, definisana retencija.
- **Troškovi**: logovanje svega je skupo; prioritet imaju izvori koji pokrivaju vjerovatne scenarije napada (use case pristup).

### Threat intelligence

| Nivo | Publika | Primjer |
|---|---|---|
| **Strateški** | Uprava, menadžment rizika | Trendovi: ransomware grupe ciljaju SaaS backup |
| **Operativni** | IR tim | Kampanja u toku protiv sektora, način rada aktera |
| **Taktički** | SOC, detection engineering | TTP prema MITRE ATT&CK, npr. zloupotreba OAuth aplikacija |
| **Tehnički** | Alati (SIEM, firewall) | IoC: IP adrese, domeni, hashovi; razmjena preko **STIX/TAXII** |

Izvori: komercijalni feedovi, CSP-ovi (ugrađeni u managed detection), CERT-ovi, sektorski **ISAC**-i, open source. Vrijednost raste sa kontekstom: IoC bez relevantnosti za tvoje okruženje samo stvara šum.

## Incident Response (5.6)

Najčešće citirani okvir je NIST SP 800-61. Revizija 3 (april 2025) uklapa IR u funkcije NIST CSF 2.0 (Govern, Identify, Protect, Detect, Respond, Recover), ali ispitna pitanja i dalje često koriste klasični ciklus iz revizije 2:

| Faza (800-61r2) | Aktivnosti | Cloud specifičnosti |
|---|---|---|
| **Preparation** | Plan, tim, alati, obuka, vježbe (tabletop) | IR role u svim nalozima, forenzički nalog, ugovorena saradnja CSP-a, logovi |
| **Detection & Analysis** | Trijaža, validacija, procjena obima i ozbiljnosti | Korelacija control plane i workload logova, procjena da li je pogođen CSP ili samo tenant |
| **Containment, Eradication & Recovery** | Izolacija, uklanjanje uzroka, obnova | Izolacija preko security grupa i politika, opoziv tokena i ključeva, redeploy iz IaC-a umjesto „čišćenja“ |
| **Post-Incident Activity** | Lessons learned, izvještaj, poboljšanje kontrola | Ažuriranje detekcija i guardraila, provjera ugovora sa CSP-om |

Ključne cloud odluke tokom IR-a:

- **Shared responsibility određuje ko odgovara**: incident u hipervizoru rješava CSP, pogrešna konfiguracija bucketa je problem korisnika.
- **Immutable infrastruktura** olakšava oporavak: kompromitovani resurs se zamjenjuje novim iz provjerenog templatea, a stari čuva kao dokaz.
- **Identitet je novi perimetar**: containment često znači opoziv sesija, rotaciju ključeva i blokadu naloga, a ne samo mrežnu izolaciju.
- **Komunikacija** prema 5.5: pravna služba, regulator, korisnici, CSP.
- **Klasifikacija ozbiljnosti** unaprijed definisana (npr. P1 do P4) sa pravilima eskalacije.

> **Na ispitu:** razlikuj **event** (bilo koji uočljiv događaj), **alert** (događaj koji je alat označio), **incident** (događaj koji ugrožava povjerljivost, integritet ili dostupnost i traži odgovor) i **breach** (incident sa potvrđenim neovlaštenim pristupom podacima, što aktivira zakonske obaveze obavještavanja). Pogrešno proglašen breach ili propušteno obavještenje oboje imaju posljedice.

## Procjena ranjivosti i penetraciono testiranje (5.6)

| Kriterijum | **Vulnerability assessment** | **Penetration testing** |
|---|---|---|
| Cilj | Pronaći i prioritizovati poznate ranjivosti | Dokazati da se ranjivosti mogu iskoristiti i koliki je stvarni uticaj |
| Način | Uglavnom automatizovano skeniranje | Ručno + alati, kreativno povezivanje slabosti |
| Dubina | Široko, plitko | Usko, duboko |
| Učestalost | Kontinuirano ili često (sedmično, mjesečno, pri svakoj promjeni) | Periodično (godišnje, nakon velikih promjena) ili po zahtjevu regulative |
| Rizik po sistem | Nizak | Viši (mogući prekidi) |
| Izlaz | Lista ranjivosti sa CVSS ocjenom | Izvještaj o putanjama napada, dokazi, preporuke |

### Specifičnosti clouda

- **Politika CSP-a**: svaki veliki provajder ima politiku penetracionog testiranja. Neki dozvoljavaju testiranje određenih servisa bez prethodnog odobrenja, ali zabranjuju npr. DoS testove, testiranje infrastrukture drugih tenanata ili samog provajdera. **Uvijek prvo provjeri i poštuj politiku i ugovor.**
- **Ne testiraš ono što ne posjeduješ**: u SaaS-u korisnik obično ne smije testirati aplikaciju provajdera; oslanja se na izvještaje (SOC 2, ISO 27001, CSA STAR) i pravo na audit iz ugovora.
- **Pisano ovlaštenje** (rules of engagement): obim, vremenski okvir, kontakti, šta je zabranjeno, kako se postupa sa pronađenim podacima.
- **Agent-based vs agentless skeniranje**: agentless (snapshot-based) skeneri čitaju disk bez instalacije agenta i pokrivaju kratkotrajne resurse; agenti daju više detalja u realnom vremenu.
- **Pokrivenost cijelog stack-a**: slike kontejnera (u registru i u radu), IaC templatei (prije deploymenta), serverless paketi, konfiguracija (CSPM), zavisnosti (SCA).
- **Prioritizacija po riziku**: CVSS je ozbiljnost, a rizik uzima u obzir izloženost (javno dostupno?), iskorištavanje u praksi (npr. CISA KEV katalog, EPSS) i vrijednost resursa.
- **Tipovi testova** prema znanju testera: **black box** (bez informacija), **gray box** (djelimično), **white box** (pun pristup kodu i arhitekturi). Red team / blue team / purple team vježbe testiraju i detekciju i odgovor, ne samo ranjivosti.

> **Na ispitu:** organizacija želi da testira svoje IaaS okruženje. Šta PRVO? **Pregledati politiku penetracionog testiranja CSP-a i ugovor** i pribaviti pisano ovlaštenje. Testiranje bez toga može prekršiti ugovor, pogoditi druge tenante i biti nezakonito.

## Ko radi šta: uloge u sigurnosnim operacijama

| Aktivnost | Cloud customer | Cloud provider | Treća strana |
|---|---|---|---|
| Nadzor konfiguracije, identiteta i workloada | Odgovoran | Daje alate i logove | MSSP po ugovoru |
| Nadzor fizičke infrastrukture i hipervizora | Ne vidi | Odgovoran | Auditor provjerava (SOC 2, ISO 27001) |
| Prikupljanje dokaza iz guest OS-a (IaaS) | Odgovoran | Ne pristupa podacima korisnika | Forenzička firma po ovlaštenju |
| Dokazi iz infrastrukture provajdera | Traži po ugovoru | Prikuplja po vlastitoj proceduri | Organ vlasti po sudskom nalogu |
| Pentest vlastitih resursa | Odgovoran, uz politiku CSP-a | Definiše pravila | Tester sa pisanim ovlaštenjem |
| Obavještavanje regulatora o povredi ličnih podataka | Odgovoran kao kontroler | Obavještava kontrolera bez odlaganja | Pravni savjetnik pomaže |

### Scenario: komunikacioni plan za cloud incident

Fintech kompanija u EU koristi IaaS i nekoliko SaaS servisa. Komunikacioni plan sadrži:

1. **Kontakt matricu**: interni IR tim, uprava, pravna služba, DPO, PR, CSP security kontakti, MSSP, osiguravač, ključni partneri.
2. **Okidače**: koji tip incidenta aktivira koju grupu (npr. povreda ličnih podataka aktivira DPO-a i pravnu službu; značajan ICT incident aktivira proces prijave po DORA-i).
3. **Rokove**: interni (npr. eskalacija upravi u roku od 1 sata za P1) i zakonske (GDPR, DORA, NIS2 gdje je primjenjiv).
4. **Predloške poruka**: za regulatora, korisnike, partnere i medije, unaprijed pregledane od pravne službe.
5. **Kanale**: primarne i out-of-band (npr. odvojen tenant za saradnju, telefonski lanac).
6. **Odobrenja**: ko odobrava eksterne poruke (obično pravna služba i uprava).
7. **Zapis**: dnevnik komunikacije tokom incidenta, koji kasnije služi kao dokaz usklađenosti.

Plan se testira na tabletop vježbi najmanje jednom godišnje, uključujući scenarij u kojem je incident nastao kod provajdera, a ne kod kompanije.

## Povezivanje: tok jednog incidenta

1. **Honeytoken** (lažni access key u repozitoriju) bude iskorišten, SIEM podiže alarm visoke pouzdanosti.
2. SOC Tier 1 validira, eskalira na Tier 2; incident se klasifikuje kao P2.
3. IR tim opoziva povezane kredencijale, analizira control plane logove i utvrđuje da napadač nije pristupio podacima.
4. Forenzičar exportuje relevantne logove u forenzički nalog, hešira ih i upisuje u chain of custody.
5. Pravna služba procjenjuje da nema povrede ličnih podataka, pa nema obaveze prijave po GDPR-u, ali organizacija kao subjekt NIS2 procjenjuje da li je incident značajan (significant incident).
6. Lessons learned: tajne iz repozitorija uklonjene, uvedeno skeniranje tajni u CI/CD-u, nova detekcija u SIEM-u.

## Tipične zamke na ispitu

| Ponuđeni odgovor zvuči dobro | Zašto je često pogrešan | Bolji izbor |
|---|---|---|
| „Odmah ugasiti kompromitovanu instancu“ | Gubi se memorija i stanje | Izolovati, prikupiti dokaze, pa gasiti |
| „Zatražiti od CSP-a fizički disk“ | Multitenancy, CSP to ne radi | Snapshot / export preko API-ja, ugovorena saradnja |
| „Provajder prijavljuje povredu regulatoru“ | Kontroler je korisnik | Kontroler prijavljuje, CSP obavještava kontrolera |
| „IDS će zaustaviti napad“ | IDS samo alarmira | IPS ili WAF u blok modu |
| „Testirati SaaS aplikaciju provajdera“ | Nije tvoje, krši ugovor | Tražiti izvještaje (SOC 2, ISO, STAR) i pravo na audit |
| „Outsourcati SOC i time prenijeti odgovornost“ | Accountability se ne prenosi | Ugovor, SLA, nadzor MSSP-a |

## Rezime

- Cloud forenzika je ograničena multitenancyjem, nedostatkom fizičkog pristupa, volatilnošću i modelom usluge; što je viši model (SaaS), korisnik ima manje artefakata i više zavisi od **ugovora** sa CSP-om.
- Proces: identifikacija, prikupljanje/akvizicija, očuvanje (ISO/IEC 27037), zatim ispitivanje, analiza i izvještavanje (ISO/IEC 27042, NIST SP 800-86). Analiza na kopiji, hash, **chain of custody**, redoslijed volatilnosti, **forensic readiness**.
- Kompromitovan resurs se prvo **izoluje** i sa njega se uzimaju dokazi, a tek onda gasi ili briše.
- Komunikacija sa vendorima, korisnicima, partnerima, regulatorima i ostalim stakeholderima ide po planu, uz pravnu službu, need to know i zakonske rokove (GDPR 72 h, NIS2 24/72 h).
- SOC može biti interni, outsourcan ili hibridni; odgovornost ostaje kod organizacije. Metrike: MTTD, MTTR, lažni pozitivi, pokrivenost.
- Kontrole (firewall, NSG, IDS/IPS, honeypot, AI) se nadziru i stalno poboljšavaju; IDS alarmira, IPS blokira, honeytoken daje alarm visoke pouzdanosti.
- SIEM centralizuje i korelira logove, SOAR automatizuje odgovor, threat intelligence daje kontekst (strateški do tehnički, STIX/TAXII).
- IR prema NIST SP 800-61; u cloudu presudni su identitet, shared responsibility i immutable infrastruktura.
- Vulnerability assessment je širok i čest, pentest uzak i dubok; u cloudu prvo politika CSP-a, ugovor i pisano ovlaštenje.
