## Ciljevi ispita: domen 2 (2.1–2.6)

Domen 2 (**Asset Security**) nosi oko **12%** ispita po outlineu iz 2027. (u outlineu iz 2024. bilo je 10%). Iako je najmanji domen po broju ciljeva, njegovi pojmovi (vlasnik podatka, klasifikacija, remanence, data states) provlače se kroz sve ostale domene.

- **2.1 Identify and classify information and assets**
  - klasifikacija podataka (data classification),
  - klasifikacija imovine (asset classification).
- **2.2 Establish information and asset handling requirements**
  - fizičko rukovanje (physical),
  - digitalno/elektronsko rukovanje (digital/electronic),
  - šifrovanje podataka (at rest, in transit/motion),
  - sigurno uništavanje medija (secure media destruction).
- **2.3 Provision information and assets securely**
  - vlasništvo nad informacijama i imovinom (ownership),
  - inventar imovine (tangible, intangible),
  - upravljanje imovinom (asset management).
- **2.4 Manage data lifecycle**
  - politika upravljanja podacima (data management policy),
  - održavanje podataka (data maintenance),
  - uloge (owners, controllers, custodians, processors, users/subjects),
  - zadržavanje, prikupljanje, uništavanje, lokacija podataka i data remanence.
- **2.5 Ensure appropriate asset management (EOL, EOS)**
  - politika upravljanja imovinom, zadržavanje imovine, povlačenje imovine (asset retirement).
- **2.6 Determine data security controls and compliance requirements**
  - stanja podataka (in use, in transit, at rest),
  - scoping i tailoring,
  - izbor standarda i kontrola,
  - metode zaštite: DRM, DLP, CASB, CNAPP.

> U outlineu iz 2024. cilj 2.2 nije imao pod-tačke, 2.5 je glasio „Ensure appropriate asset **retention**“ bez pod-tačaka, a 2.6 je imao „Standards selection“ (bez „controls“) i nije pominjao CNAPP. Sadržaj koji ispit očekuje je u suštini isti.

Način razmišljanja za cijeli domen: **vlasnik podatka (data owner) odlučuje, custodian izvršava**. Kontrole se biraju prema **vrijednosti i klasifikaciji** podatka, a klasifikacija je poslovna odluka, ne tehnička.

## Klasifikacija podataka (2.1)

**Klasifikacija (classification)** je svrstavanje informacija u nivoe prema šteti koju bi izazvalo njihovo otkrivanje, izmjena ili nedostupnost. Cilj nije papirologija nego **proporcionalna zaštita**: ne trošiti novac na štićenje javnih podataka, a ne ostaviti tajne nezaštićene.

### Šeme klasifikacije

| Vojna/državna šema (SAD) | Šteta pri otkrivanju | Komercijalna šema (primjer) | Šta tipično obuhvata |
|---|---|---|---|
| **Top Secret** | izuzetno teška (exceptionally grave) | **Confidential / Proprietary** | poslovne tajne, M&A planovi, izvorni kod |
| **Secret** | teška (serious) | **Private** | lični podaci zaposlenih i klijenata, plate, zdravstveni podaci |
| **Confidential** | šteta (damage) | **Sensitive** | interni finansijski izvještaji, projekti, mrežni dijagrami |
| **Unclassified** (uklj. **CUI** / SBU) | nema štete po nacionalnu sigurnost | **Public** | marketing, objavljeni izvještaji |

Pravila koja ispit voli:

- Komercijalne organizacije biraju **svoje** nazive i broj nivoa; važno je da ih bude malo (3–5) i da su jasno definisani. Previše nivoa znači da ih niko ne primjenjuje dosljedno.
- **Controlled Unclassified Information (CUI)** u SAD je i dalje osjetljivo (npr. podaci izvozne kontrole), iako nije klasifikovano.
- Klasifikaciju određuje **vlasnik podatka (data owner)**, a ne IT, custodian ili sigurnosni tim. Sigurnosni tim definiše šemu i savjetuje.
- **Need to know** važi i unutar nivoa: clearance Secret ne daje automatski pristup svim Secret podacima.

### Kriteriji za klasifikaciju

Vlasnik podatka procjenjuje:

- **vrijednost** podatka (za organizaciju i za napadača),
- **starost i korisni vijek** (useful life): vrijednost opada, pa podatak može biti deklasifikovan,
- **povezanost sa osobama** (personal association, PII, PHI),
- **zakonske, regulatorne i ugovorne obaveze** (GDPR, HIPAA, PCI DSS),
- **štetu** po povjerljivost, integritet i dostupnost (FIPS 199: low, moderate, high).

### Proces klasifikacije

1. Identifikovati vlasnika (administratora) podataka.
2. Definisati kriterije i nivoe.
3. Vlasnik klasifikuje podatke i određuje potrebne kontrole za svaki nivo.
4. Dokumentovati izuzetke.
5. Definisati **deklasifikaciju** (declassification) i prenos vlasništva.
6. Obuka zaposlenih i periodična revizija (review) klasifikacije.

**Categorization** i **classification** nisu isto: kategorizacija (FIPS 199, NIST RMF) određuje **uticaj** na sistem (low/moderate/high za C, I, A), a klasifikacija dodjeljuje oznaku osjetljivosti informaciji. Sistem se kategorizuje po **high-water mark** principu: najviši uticaj bilo koje informacije koju obrađuje određuje kategoriju sistema.

### Klasifikacija imovine

**Asset classification** prati klasifikaciju podataka: imovina (server, laptop, USB, papirni registrator, backup traka) nasljeđuje **najvišu klasifikaciju podataka koje sadrži ili obrađuje**. Laptop sa jednim Confidential fajlom tretira se kao Confidential imovina. Imovina se klasifikuje i po svojoj kritičnosti za poslovanje (podrška kritičnom procesu iz BIA), što utiče na prioritet oporavka.

> **Na ispitu:** Kada pitanje pita KO određuje klasifikaciju ili nivo zaštite podatka, odgovor je gotovo uvijek **data owner** (viši menadžer odgovoran za poslovnu funkciju). Custodian (IT) implementira kontrole, sigurnosni tim savjetuje, korisnik poštuje pravila. Ako ponuđeni odgovor kaže „senior management“, to je ukupna odgovornost (accountability) za program, ne klasifikacija pojedinog skupa podataka.

## Rukovanje informacijama i imovinom (2.2)

Kada je klasifikacija određena, organizacija propisuje **zahtjeve rukovanja (handling requirements)** za svaki nivo: kako se označava, čuva, prenosi, dijeli, kopira i uništava.

### Marking i labeling

| Pojam | Značenje | Primjer |
|---|---|---|
| **Marking** | oznaka čitljiva čovjeku | „CONFIDENTIAL“ u zaglavlju dokumenta, naljepnica na kutiji traka |
| **Labeling** | oznaka u metapodacima, čitljiva sistemu | sensitivity label u Microsoft Purview, tag objekta u S3, MAC label u SELinux |

Neoznačen medij treba tretirati kao da ima **najvišu** klasifikaciju koja postoji u okruženju dok se ne utvrdi suprotno. Takođe, oznaka mora ostati i kada se medij deklasifikuje ili sanitizuje (nova oznaka „sanitized“), da se ne bi miješali mediji.

### Fizičko rukovanje

- **Skladištenje**: sefovi i zaključani ormari prema klasifikaciji, kontrolisan pristup, evidencija ko je uzeo medij.
- **Transport**: pouzdani kuriri, zapečaćena ambalaža, dvostruko pakovanje (unutrašnja oznaka klasifikacije, spoljna neutralna), **chain of custody** za osjetljive medije i backup trake.
- **Clean desk policy**, zaključavanje ekrana, štampači sa pull printingom.
- **Rad van kancelarije**: pravila za papirne dokumente kod kuće, putovanja (laptop u ručnom prtljagu, zabrana ostavljanja u autu).

### Digitalno rukovanje

- labele u metapodacima i automatska primjena kontrola (DLP, IRM, šifrovanje po labeli),
- kontrola kopiranja na prenosive medije (USB blokada, šifrovani USB),
- pravila za email (šifrovanje, zabrana slanja na lične adrese),
- logovanje pristupa podacima višeg nivoa,
- sigurno dijeljenje sa trećim stranama (ugovor, NDA, IRM).

### Šifrovanje podataka at rest i in transit

| Stanje | Tehnike | Napomena za ispit |
|---|---|---|
| **At rest** | **FDE** (BitLocker, LUKS, FileVault), šifrovanje fajlova/foldera, **TDE** u bazama, šifrovanje objekata u cloudu, self-encrypting drives (SED) | FDE štiti od krađe uređaja, ali **ne** od napadača koji je prijavljen na sistem; za to treba šifrovanje na nivou aplikacije/polja |
| **In transit / in motion** | **TLS 1.2/1.3**, **IPsec**, SSH, VPN, MACsec | razlikuj **link encryption** (šifruje sve, uključujući zaglavlja, dešifruje na svakom čvoru) i **end-to-end** (šifruje payload, zaglavlja ostaju vidljiva za rutiranje) |
| **In use** | confidential computing (TEE, enclave), homomorfno šifrovanje | detaljnije u 2.6 i modulu kriptografije |

Upravljanje ključevima je dio zahtjeva rukovanja: ključ mora imati istu ili višu zaštitu od podataka koje štiti, a čuva se **odvojeno** od šifrovanih podataka.

### Sigurno uništavanje medija

Ključna referenca je **NIST SP 800-88 Rev. 1 (Guidelines for Media Sanitization)** sa tri nivoa:

| Nivo | Šta znači | Tehnike | Medij se može ponovo koristiti? |
|---|---|---|---|
| **Clear** | štiti od jednostavnih, neinvazivnih tehnika oporavka (alati iz OS-a) | prepisivanje (overwriting) logičkih lokacija, factory reset | da, unutar iste organizacije |
| **Purge** | štiti od laboratorijskih tehnika oporavka | **degaussing** (samo magnetni mediji), **cryptographic erase (CE)**, ATA/NVMe Secure Erase, block erase | da (osim nakon degaussinga HDD-a, koji ga uništava) |
| **Destroy** | medij fizički neupotrebljiv, oporavak nemoguć | **shredding**, **disintegration**, **pulverization**, **incineration**, topljenje | ne |

Česte zamke:

- **Brisanje (deletion) i formatiranje** nisu sanitizacija: uklanjaju pokazivače, a podaci ostaju (data remanence).
- **Degaussing ne djeluje na SSD i flash**, ni na optičke medije. Za SSD se koristi crypto erase, Secure Erase komanda proizvođača ili fizičko uništenje.
- **SSD i wear leveling**: prepisivanje ne dohvata rezervne (over-provisioned) blokove, pa prepisivanje nije pouzdano.
- **Papir**: cross-cut ili micro-cut drobilica, spaljivanje, pulpiranje.
- Nakon sanitizacije: **verifikacija** i **certifikat o uništenju (certificate of destruction)**, posebno kod vanjskog izvođača.
- U cloudu kupac nema pristup mediju: koristi se **crypto-shredding** (uništenje ključa) uz ugovorne garancije provajdera.

> **Na ispitu:** Ako pitanje traži „MOST secure“ ili „BEST“ način da se osjetljiv medij koji napušta organizaciju trajno očisti, odgovor je **fizičko uništenje** (destroy). Ako medij treba ponovo koristiti unutar organizacije, dovoljan je **purge** ili **clear** prema klasifikaciji. Za SSD nikad ne biraj degaussing.

## Sigurno obezbjeđivanje informacija i imovine (2.3)

### Vlasništvo

Svaka informacija i imovina mora imati **vlasnika** (owner) koji je **accountable**: odobrava pristup, određuje klasifikaciju, prihvata rezidualni rizik i odgovara za imovinu. Vlasnik može **delegirati zadatke** (custodian), ali ne i **odgovornost (accountability)**.

| Pojam | Ko | Odgovornost |
|---|---|---|
| **Information/data owner** | rukovodilac poslovne jedinice | klasifikacija, odobravanje pristupa, kriteriji zaštite |
| **Asset/system owner** | rukovodilac odgovoran za sistem | da sistem ima odgovarajuće kontrole, sistemski sigurnosni plan |
| **Business/mission owner** | vlasnik procesa | da sistemi podržavaju poslovni cilj, ravnoteža troška i rizika |

### Inventar imovine

Ne možeš zaštititi ono za šta ne znaš. **Asset inventory** je temelj upravljanja ranjivostima, konfiguracijom, licencama i incidentima (prva CIS kontrola je inventar hardvera, druga softvera).

| Tip imovine | Primjeri | Kako se popisuje |
|---|---|---|
| **Tangible (materijalna)** | serveri, laptopovi, mobilni uređaji, mrežna oprema, mediji, zgrade | CMDB, skeniranje mreže, NAC, MDM, RFID/barkod, nabavna evidencija |
| **Intangible (nematerijalna)** | intelektualna svojina, podaci, softverske licence, reputacija, brend, domeni, certifikati, cloud resursi | registri IP-a, softverski inventar (SAM), SBOM, cloud asset inventory |

Inventar mora biti **tačan i ažuran**: automatizovano otkrivanje (discovery) plus upoređivanje sa nabavkom (shadow IT se otkriva upravo razlikom). Svaka stavka ima vlasnika, klasifikaciju, lokaciju, status u životnom ciklusu.

### Upravljanje imovinom i sigurno obezbjeđivanje

**Asset management** obuhvata cijeli životni ciklus: planiranje i nabavka (sigurnosni zahtjevi u ugovoru), prijem i registracija, konfiguracija prema baselineu (**golden image**), dodjela korisniku, održavanje i patchovanje, promjene kroz **change management**, povlačenje.

Sigurno obezbjeđivanje (provisioning) znači:

- pristup informacijama dodjeljuje se na osnovu **need to know** i **least privilege**, uz odobrenje vlasnika,
- uređaj se izdaje već ojačan (hardened), šifrovan, upisan u MDM/EDR,
- korisnik potpisuje pravila prihvatljive upotrebe (AUP) i potvrdu o zaduženju opreme,
- **deprovisioning** pri promjeni radnog mjesta ili odlasku (povrat opreme, ukidanje pristupa, sprečavanje **privilege creep**),
- periodična revizija prava pristupa (access review) koju potvrđuje vlasnik.

> **Na ispitu:** Kada scenarij opisuje nepoznate uređaje na mreži ili sistem koji niko ne patchuje, PRVI korak je **inventar i dodjela vlasnika**. Tehničke kontrole (NAC, skeniranje ranjivosti) dolaze tek kada znaš šta imaš i ko je odgovoran.

## Upravljanje životnim ciklusom podataka (2.4)

### Politika upravljanja podacima

**Data management policy** je krovni dokument koji definiše uloge, klasifikaciju, kvalitet, zadržavanje, lokaciju i uništavanje podataka. Iz nje proizlaze standardi (npr. standard šifrovanja), procedure (kako se radi sanitizacija) i smjernice. Politiku odobrava **viši menadžment**; bez nje uloge i obaveze nisu provodive.

### Životni ciklus podataka

ISC2 koristi model sličan CSA modelu: **Create/Collect → Store → Use → Share → Archive → Destroy**. Kontrole se razlikuju po fazama, a klasifikacija se dodjeljuje pri nastanku.

### Uloge nad podacima

| Uloga | Definicija | Ključna odgovornost |
|---|---|---|
| **Data owner** | viši rukovodilac odgovoran za podatke | klasifikacija, odobrenje pristupa, accountability |
| **Data controller** (GDPR) | subjekt koji određuje **svrhu i način** obrade ličnih podataka | zakonitost obrade, prava subjekata, odgovornost prema regulatoru |
| **Data processor** (GDPR) | subjekt koji obrađuje lične podatke **u ime** kontrolora | obrada isključivo po uputstvima kontrolora (ugovor, DPA) |
| **Sub-processor** | processor kojeg angažuje processor | samo uz odobrenje kontrolora |
| **Data custodian** | tehnička uloga (IT, DBA, cloud ops) | backup, šifrovanje, patchovanje, sprovođenje kontrola koje je odredio vlasnik |
| **Data steward** | poslovna uloga za kvalitet i metapodatke | tačnost, konzistentnost, poslovna pravila |
| **User** | koristi podatke za posao | poštovanje politika, prijava incidenata |
| **Data subject** | fizičko lice na koje se lični podaci odnose | ima prava (pristup, ispravka, brisanje, prenosivost) |
| **DPO** | službenik za zaštitu podataka (GDPR) | nezavisni savjetnik i kontakt sa regulatorom |

Ista organizacija može biti controller za podatke svojih zaposlenih i processor za podatke koje obrađuje za klijenta. SaaS provajder je tipično **processor**, a kupac **controller**.

> **Na ispitu:** Ključna razlika: **owner/controller odlučuje** (šta, zašto, ko smije), **custodian/processor izvršava** (kako, po uputstvu). Ako pitanje pita ko je odgovoran za backup i primjenu šifrovanja, to je custodian; ko je odgovoran prema regulatoru za zakonitost obrade, to je controller, čak i kada je obradu prepustio processoru.

### Prikupljanje podataka (data collection)

- **Minimizacija (data minimization)**: prikupljaj samo ono što je neophodno za definisanu svrhu. Najjeftinija zaštita podatka je da ga nemaš.
- **Ograničenje svrhe (purpose limitation)** i pravni osnov (saglasnost, ugovor, zakonska obaveza, legitimni interes).
- **Transparentnost**: obavještenje o privatnosti (privacy notice) pri prikupljanju.
- Klasifikacija i označavanje **pri prikupljanju**.

### Lokacija podataka (data location)

| Pojam | Značenje |
|---|---|
| **Data residency** | gdje se podaci fizički čuvaju (često poslovni ili ugovorni izbor) |
| **Data sovereignty** | podaci podliježu zakonima države u kojoj se nalaze |
| **Data localization** | zakon zahtijeva da podaci ostanu u određenoj državi |
| **Prekogranični prenos** | GDPR: odluka o adekvatnosti, SCC, BCR |

U cloudu se lokacija kontroliše izborom regiona, politikama (npr. organizacijske politike koje zabranjuju druge regione) i ugovorom. Treba znati i gdje su **backupi, replike i logovi**, ne samo primarni podaci.

### Održavanje podataka (data maintenance)

Održavanje znači da podaci ostaju **tačni, potpuni, dostupni i zaštićeni** tokom korištenja: kontrole integriteta (validacija unosa, hash, verzionisanje), kvalitet podataka (steward), backup i testiranje oporavka, periodična revizija klasifikacije, ažuriranje i ispravke (pravo subjekta na ispravku), migracija na nove formate prije nego stari postanu nečitljivi.

### Zadržavanje podataka (data retention)

- **Retention policy** definiše koliko dugo se koja vrsta podataka čuva, na osnovu **zakonskih i regulatornih zahtjeva** i poslovne potrebe.
- Čuvanje **duže nego što je potrebno** je rizik (veća šteta pri curenju, troškovi eDiscoveryja, kršenje GDPR principa ograničenja čuvanja).
- Čuvanje **kraće nego što je propisano** je kršenje zakona.
- **Legal hold** (litigation hold) suspenduje redovno brisanje za podatke relevantne za spor ili istragu; ima prioritet nad retention rasporedom.
- Retention mora obuhvatiti i backupe i arhive; arhivirani podaci moraju ostati čitljivi (formati, ključevi, hardver).

### Data remanence

**Data remanence** je ostatak podataka na mediju nakon brisanja. Izvori: neprepisani sektori, slack space, bad sektori, rezervni blokovi na SSD-u, keš memorije, swap i hibernacijski fajlovi, kopije u backupima i snapshotima. Kontrola je pravilna sanitizacija prema NIST SP 800-88 i šifrovanje od početka (pa je moguć crypto erase).

### Uništavanje podataka (data destruction)

Uništavanje se radi **na kraju retention perioda** (osim pod legal holdom), uz evidenciju i, za osjetljive podatke, potvrdu. Metoda zavisi od klasifikacije i medija (tabela u 2.2). U cloudu: brisanje plus crypto-shredding, uz provjeru da su obrisane i replike, snapshoti i backupi.

## Upravljanje imovinom: EOL i EOS (2.5)

### Pojmovi

| Pojam | Značenje | Posljedica |
|---|---|---|
| **End of Life (EOL)** | proizvođač prestaje da prodaje (i često proizvodi) proizvod | više se ne nabavlja, planira se zamjena |
| **End of Support (EOS)** / End of Service Life (EOSL) | proizvođač prestaje da izdaje zakrpe, ažuriranja i podršku | **nove ranjivosti ostaju nezakrpljene**; ovo je sigurnosno kritičan datum |
| **Extended support** | plaćena produžena podrška | privremeno rješenje, skupo |

EOL i EOS datumi se razlikuju po proizvođaču: nekad je EOL datum prestanka prodaje, a podrška traje još godinama. Za sigurnost je presudan **kraj sigurnosnih zakrpa**.

### Politika upravljanja imovinom

**Asset management policy** propisuje: obavezu inventara i vlasnika, praćenje EOL/EOS datuma (u CMDB-u), planiranje zamjene u budžetu prije EOS-a, proces izuzetaka (exception) sa formalnim prihvatanjem rizika, pravila za povlačenje i sanitizaciju.

### Zadržavanje imovine (asset retention)

Imovina se ponekad mora zadržati duže od korisnog vijeka:

- hardver i softver potrebni da bi se **čitale arhive** (stari formati, trake),
- imovina pod **legal holdom** (dokaz u sporu),
- kritični sistemi bez zamjene (OT/ICS sa životnim vijekom od 20+ godina).

Kada se zadržava sistem nakon EOS-a, potrebne su **kompenzacijske kontrole (compensating controls)**: izolacija i segmentacija mreže, uklanjanje sa interneta, application allowlisting, pojačan monitoring, virtuelno patchovanje (IPS/WAF), ograničen pristup. Odluku dokumentuje i rizik prihvata **vlasnik sistema** (risk acceptance), uz rok i plan zamjene.

### Povlačenje imovine (asset retirement)

1. Odobrenje vlasnika i provjera da imovina nije pod legal holdom ili retention obavezom.
2. Migracija ili arhiviranje podataka koji se moraju sačuvati.
3. Ukidanje pristupa, servisnih naloga, certifikata, DNS zapisa, firewall pravila (sprečava „zombie“ resurse i subdomain takeover).
4. **Sanitizacija medija** prema klasifikaciji (clear/purge/destroy), uz verifikaciju.
5. Fizičko odlaganje (reciklaža, prodaja, donacija samo nakon odgovarajuće sanitizacije), ekološki propisi (e-waste).
6. **Certifikat o uništenju** od izvođača i ažuriranje inventara/CMDB-a.

> **Na ispitu:** Kada sistem dostigne EOS a ne može se zamijeniti, NAJBOLJI odgovor nije „nastaviti kao do sada“ ni „odmah ugasiti“ (to ugrožava poslovanje), nego **izolovati ga i primijeniti kompenzacijske kontrole uz formalno prihvatanje rizika i plan migracije**. Sigurnost služi poslovanju.

## Kontrole sigurnosti podataka i usklađenost (2.6)

### Stanja podataka i kontrole

| Stanje | Opis | Glavne prijetnje | Kontrole |
|---|---|---|---|
| **Data at rest** | na disku, u bazi, u backupu, u arhivi | krađa medija, neovlašten pristup, pogrešna konfiguracija storagea | FDE, TDE, šifrovanje fajlova/objekata, kontrola pristupa, DLP discovery, sanitizacija |
| **Data in transit (motion)** | putuje mrežom | prisluškivanje, MITM, izmjena | TLS, IPsec, VPN, SSH, mTLS, DLP mrežni |
| **Data in use** | u memoriji, u obradi, na ekranu | memory scraping, shoulder surfing, maliciozni insajderi, cold boot | kontrola pristupa, **confidential computing (TEE)**, maskiranje na ekranu, DLP endpoint, privacy screen |

Podaci in use su istorijski najslabije zaštićeni jer moraju biti dešifrovani da bi se obrađivali; TEE (Intel SGX/TDX, AMD SEV, ARM TrustZone) i homomorfno šifrovanje to rješavaju djelimično.

### Baseline, scoping i tailoring

**Security baseline** je minimalni skup kontrola za određeni nivo (npr. NIST SP 800-53B baselines low/moderate/high, CIS Benchmarks za konfiguraciju). Organizacija ga prilagođava:

| Pojam | Šta znači | Primjer |
|---|---|---|
| **Scoping** | određivanje koje kontrole iz baselinea **se primjenjuju** na dati sistem (izbacivanje nerelevantnih) | kontrole za bežične mreže izbacujemo jer sistem nema WiFi |
| **Tailoring** | **prilagođavanje** kontrola misiji, okruženju i riziku (parametri, kompenzacijske kontrole, dodatne kontrole) | lozinka 14 umjesto 12 znakova; kompenzacijska kontrola gdje originalna nije izvodljiva |
| **Supplementation** | dodavanje kontrola iznad baselinea | dodatni monitoring za kritičnu aplikaciju |

Scoping je **podskup** tailoringa. Odluke se dokumentuju sa obrazloženjem (ko je odobrio, zašto).

### Izbor standarda i kontrola

Organizacija bira okvire prema industriji, zakonodavstvu i ugovorima:

| Okvir/standard | Namjena |
|---|---|
| **ISO/IEC 27001 / 27002** | ISMS (certifikabilan) i katalog kontrola |
| **NIST SP 800-53** | katalog kontrola za savezne sisteme SAD, široko korišten i van |
| **NIST CSF 2.0** | okvir funkcija Govern, Identify, Protect, Detect, Respond, Recover |
| **CIS Controls / CIS Benchmarks** | prioritizovane kontrole; konfiguracijski baselinei |
| **PCI DSS** | ugovorni standard za kartične podatke |
| **HIPAA, GDPR, SOX, GLBA** | zakonske obaveze (zdravstvo, privatnost, finansijsko izvještavanje, finansije) |
| **COBIT** | IT governance i kontrolni ciljevi |

Kontrole se biraju na osnovu **procjene rizika** i zahtjeva usklađenosti; trošak kontrole ne smije premašiti vrijednost imovine (više u domenu 1).

### Metode zaštite podataka

| Metoda | Šta radi | Gdje djeluje | Ograničenja |
|---|---|---|---|
| **DRM / IRM** (Digital/Information Rights Management) | trajna zaštita dokumenta: ko smije otvoriti, štampati, kopirati, prosljeđivati; istek pristupa; opoziv | prati sam fajl i van organizacije | treba klijentski softver, screenshot i fotografija ekrana i dalje mogući |
| **DLP** (Data Loss Prevention) | otkriva i sprječava neovlašteno iznošenje podataka po sadržaju (regex, fingerprinting, EDM, ML) i labelama | **network** (in motion), **endpoint** (in use, USB, clipboard), **storage/discovery** (at rest), cloud | šifrovan saobraćaj treba TLS inspekciju; lažno pozitivni rezultati; ne vidi sve kanale |
| **CASB** (Cloud Access Security Broker) | posrednik između korisnika i cloud servisa: **visibility** (shadow IT), **compliance**, **data security**, **threat protection** | API režim (out-of-band, skenira podatke u SaaS-u) i proxy režim (forward/reverse, inline) | danas dio **SSE/SASE** platformi |
| **CNAPP** (Cloud-Native Application Protection Platform) | objedinjuje **CSPM** (konfiguracija), **CWPP** (radna opterećenja, kontejneri), **CIEM** (prava u cloudu), skeniranje IaC i image-a, često DSPM | cijeli životni ciklus cloud-native aplikacije, od koda do runtimea | zaštita podataka indirektno: otkriva izložene buckete, pretjerana prava, ranjive workloade |

Dodatne tehnike koje se pojavljuju u istim pitanjima:

- **Tokenizacija**: zamjena osjetljive vrijednosti tokenom bez matematičke veze; original u token vaultu (PCI DSS smanjenje scopea).
- **Maskiranje**: static (kopija za test) i dynamic (na prikazu, po ulozi).
- **Pseudonimizacija**: reverzibilna uz dodatnu informaciju; po GDPR-u i dalje lični podatak.
- **Anonimizacija**: nepovratna; anonimni podaci više nisu lični podaci (ali pažnja na re-identifikaciju kombinovanjem skupova).

> **Na ispitu:** Kad scenarij traži da dokument ostane zaštićen i NAKON što je poslat partneru, odgovor je **DRM/IRM** (DLP štiti granicu, ne prati fajl). Kad traži otkrivanje neodobrenih SaaS aplikacija, odgovor je **CASB**. Kad traži pregled pogrešnih konfiguracija i prava kroz više cloud naloga, odgovor je **CNAPP/CSPM**.

## Scenariji za vježbu razmišljanja

**Scenarij 1: backup trake.** Firma šalje backup trake kurirom u udaljeni sef. Jedna traka je izgubljena u transportu. Šta je trebalo biti PRVO na mjestu? Šifrovanje traka (zaštita at rest koja važi i u transportu) i chain of custody. Nakon gubitka: incident response, procjena da li su trake bile šifrovane (ako jesu i ključ nije kompromitovan, obaveza notifikacije često otpada).

**Scenarij 2: stari ERP.** ERP sistem radi na OS-u koji je prošao EOS, a migracija traje 18 mjeseci. Ispravan pristup: vlasnik sistema formalno prihvata rizik, sistem se segmentira, pristup samo preko jump hosta, pojačan monitoring, virtuelno patchovanje, rok za migraciju u planu.

**Scenarij 3: SaaS i GDPR.** Firma koristi SaaS CRM sa podacima klijenata iz EU. Ko je controller? Firma. SaaS provajder je processor, mora imati DPA ugovor, a firma ostaje odgovorna regulatoru i za izbor provajdera i za lokaciju podataka.

**Scenarij 4: SSD laptopovi.** Laptopovi sa SSD-om se prodaju zaposlenima nakon otpisa. Prepisivanje alatom nije pouzdano zbog wear levelinga; degaussing ne radi. Pravilno: crypto erase (ako je FDE bio uključen od početka, uništenje ključa) ili Secure Erase proizvođača, uz verifikaciju; za visoko osjetljive podatke fizičko uništenje diska.

## Brzi pregled pojmova

| Pojam | Jedna rečenica |
|---|---|
| High-water mark | sistem dobija najvišu kategoriju informacija koje obrađuje |
| Need to know | pristup samo informacijama potrebnim za zadatak, i unutar istog nivoa |
| Declassification | snižavanje klasifikacije kada vrijednost/osjetljivost opadne |
| Chain of custody | dokumentovan lanac ko je imao medij/dokaz i kada |
| Crypto erase | sanitizacija uništenjem ključa kojim su podaci šifrovani |
| Legal hold | suspenzija brisanja zbog spora ili istrage |
| Scoping | izbor relevantnih kontrola iz baselinea |
| Tailoring | prilagođavanje kontrola okruženju i riziku |
| EOS | kraj zakrpa; od tog trenutka ranjivosti ostaju otvorene |
| CASB | posrednik za vidljivost i kontrolu SaaS korištenja |

## Rezime

- Klasifikaciju određuje **data owner** prema vrijednosti, osjetljivosti, zakonskim zahtjevima i starosti podatka; imovina nasljeđuje najvišu klasifikaciju podataka koje sadrži.
- Zahtjevi rukovanja pokrivaju označavanje (marking za ljude, labeling za sisteme), fizičko i digitalno skladištenje, transport, šifrovanje at rest i in transit, i uništavanje.
- NIST SP 800-88: **clear, purge, destroy**. Degaussing ne radi na SSD-u; brisanje i formatiranje nisu sanitizacija; najsigurnije je fizičko uništenje.
- Inventar (tangible i intangible) i vlasnik za svaku stavku su preduslov za sve ostale kontrole.
- Uloge: owner i controller odlučuju; custodian i processor izvršavaju; subject ima prava; steward brine o kvalitetu.
- Životni ciklus podataka: minimizacija pri prikupljanju, poznata lokacija (sovereignty, residency, localization), održavanje integriteta, retention po zakonu, legal hold ima prednost, remanence se rješava sanitizacijom.
- EOS znači nezakrpljene ranjivosti: zamjena ili kompenzacijske kontrole uz formalno prihvatanje rizika; povlačenje imovine završava sanitizacijom, certifikatom i ažuriranim inventarom.
- Stanja podataka (at rest, in transit, in use) traže različite kontrole; baseline se prilagođava **scopingom i tailoringom**; DRM prati fajl, DLP čuva granicu, CASB kontroliše SaaS, CNAPP štiti cloud-native okruženje.
