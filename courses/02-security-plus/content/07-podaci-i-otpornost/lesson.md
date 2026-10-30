## Ciljevi ispita

Ovaj modul pokriva **cilj 3.3** (*Summarize concepts and strategies used to protect data*) i **cilj 3.4** (*Explain the importance of resilience and recovery in security architecture*).

Za 3.3 ispit traži da prepoznaš stanje i klasifikaciju podataka, izabereš pravu metodu zaštite (masking vs tokenization vs hashing…) i znaš ko je za šta odgovoran. Za 3.4 traži da izabereš tip lokacije za oporavak, strategiju redundantnosti i backupa i da razlikuješ metrike oporavka.

## Vrste i stanja podataka

### Data types

| Tip (engl.) | Opis | Primjer | Zaštita |
|---|---|---|---|
| **Structured** | Unaprijed definisana šema, redovi i kolone | Tabela u PostgreSQL-u, CSV | Lako se pretražuje, klasifikuje i maskira po koloni |
| **Unstructured** | Bez fiksne šeme | E-mail, PDF, slike, Slack poruke, logovi | Teže je pronaći osjetljive podatke; potrebni DLP i klasifikacija sadržaja |

Procjena je da je većina podataka u organizacijama nestrukturisana, i tu se osjetljivi podaci najčešće „izgube“ (npr. lozinka u wiki stranici).

### Data states

| Stanje (engl.) | Gdje je podatak | Tipična zaštita |
|---|---|---|
| **Data at rest** | Na disku, u bazi, u S3 bucketu, na backup traci | Enkripcija diska/volumena (BitLocker, LUKS, EBS/S3 encryption sa KMS), kontrola pristupa |
| **Data in transit** | Putuje mrežom | TLS, IPsec, SSH, VPN |
| **Data in use** | U memoriji, CPU ga obrađuje | Kontrola pristupa procesu, **confidential computing** (secure enclave, npr. AWS Nitro Enclaves, Azure confidential VM), maskiranje u aplikaciji |

> **Na ispitu:** Data in use je najteže zaštititi jer podatak mora biti dešifrovan da bi se obradio. Ako pitanje spominje „podaci u RAM-u“ ili „trusted execution environment / secure enclave“, odgovor je **data in use**.

## Klasifikacija podataka

**Data classification** određuje nivo zaštite prema šteti koju bi otkrivanje, izmjena ili gubitak izazvali.

| Klasa (engl.) | Tipično značenje |
|---|---|
| **Top secret** | Državna klasifikacija; otkrivanje bi izazvalo izuzetno tešku štetu nacionalnoj sigurnosti |
| **Secret** | Državna; ozbiljna šteta |
| **Confidential** | Državna (niži stepen) ili poslovna: podaci samo za ovlaštene (ugovori, poslovne tajne) |
| **Restricted** | Strogo ograničen pristup, samo uska grupa; curenje izaziva značajnu štetu |
| **Sensitive** | Podaci čije otkrivanje šteti pojedincima ili firmi (PII, zdravstveni, finansijski) |
| **Critical** | Podaci bez kojih poslovanje ne može funkcionisati; naglasak je na **dostupnosti i integritetu** |
| **Public** | Namijenjeno javnosti; nema štete od otkrivanja (ali integritet je i dalje važan) |

Državni sistemi tipično koriste hijerarhiju **top secret > secret > confidential > unclassified**. Komercijalne organizacije biraju svoje nazive (npr. restricted, confidential, internal, public); bitno je da su definisani u politici i dosljedno primijenjeni.

## Metode zaštite podataka

| Metoda (engl.) | Šta radi | Reverzibilno? | Primjer |
|---|---|---|---|
| **Encryption** | Ključem pretvara podatak u nečitljiv oblik | Da, sa ključem | AES-256 za bazu, TLS za saobraćaj |
| **Hashing** | Jednosmjerna funkcija daje otisak fiksne dužine | Ne | Lozinke (bcrypt/Argon2 sa saltom), provjera integriteta fajla (SHA-256) |
| **Masking** | Sakriva dio podatka pri prikazu | Original ostaje u izvoru | `**** **** **** 4821`, maskirani podaci za test okruženje |
| **Tokenization** | Zamjenjuje osjetljivu vrijednost nasumičnim tokenom; original u zaštićenom **token vaultu** | Da, samo preko vaulta | Broj kartice zamijenjen tokenom kod payment providera; smanjuje PCI DSS opseg |
| **Obfuscation** | Namjerno otežava razumijevanje (koda ili podataka) | Djelimično | Obfuskacija JavaScripta, zamjena naziva |
| **Data transpose** | Preraspoređuje (permutuje) elemente podatka ili strukturu (npr. redoslijed znakova ili zamjena redova i kolona) tako da original nije direktno čitljiv | Da, ko zna pravilo | Slično transpozicionoj šifri; slaba zaštita ako se koristi sama |
| **Deidentification** | Uklanja ili mijenja identifikatore da se podatak ne može povezati sa osobom | Zavisi | **Anonymization** (nepovratno) vs **pseudonymization** (povratno uz dodatni ključ/tabelu) |
| **Filtering** | Propušta samo dozvoljene podatke, odstranjuje osjetljive | n/a | Uklanjanje PII iz logova prije slanja u SIEM, DLP filter na izlazu, filtriranje kolona u upitu |

> **Na ispitu:** **Tokenization** vs **encryption**: token nema matematičku vezu sa originalom, pa se ne može „dešifrovati“; mapiranje je samo u vaultu. **Masking** je za prikaz (npr. call centar vidi zadnje 4 cifre). **Hashing** je jednosmjeran i koristi se za lozinke i integritet. Kad se traži smanjenje **PCI DSS opsega**, tipično je tačna tokenizacija.

## Uloge u zaštiti podataka

| Uloga (engl.) | Odgovornost | DevOps primjer |
|---|---|---|
| **Data owner** | Viši rukovodilac koji je **odgovoran** (*accountable*) za podatke: određuje klasifikaciju i ko smije pristupiti | Direktor prodaje za CRM podatke |
| **Data custodian** | **Implementira** kontrole koje owner odredi: enkripcija, backup, dozvole | Ops/DBA tim koji podešava RDS enkripciju i backup |
| **Data steward** | Brine o **kvalitetu**, značenju, metapodacima i pravilima korištenja podataka | Data governance analitičar koji održava katalog podataka |
| **Data operator** | Osoba ili sistem koji svakodnevno **radi sa podacima** (unosi, obrađuje, pokreće procese) u skladu sa pravilima | Operater koji pokreće ETL job, aplikacija koja obrađuje narudžbe |
| **Data controller** | (GDPR pojam) **Određuje svrhu i način** obrade ličnih podataka | Firma koja prikuplja podatke kupaca |
| **Data processor** | Obrađuje lične podatke **u ime** controllera | SaaS provajder e-mail marketinga |
| **Data subprocessor** | Treća strana koju **processor** angažuje za dio obrade | Cloud provajder na kojem SaaS provajder hostuje podatke |

> **Na ispitu:** **Owner odlučuje, custodian sprovodi.** Ako pitanje kaže „ko određuje klasifikaciju“, odgovor je owner; „ko pravi backup i primjenjuje enkripciju“, custodian. **Controller** određuje svrhu, **processor** radi po nalogu, **subprocessor** je podizvođač processora.

## Rukovanje podacima (data handling)

- **Endpoints**: laptopovi i mobilni uređaji nose podatke van kancelarije. Kontrole: enkripcija diska, MDM, DLP agent, blokada USB-a.
- **Marking and labeling**: oznaka klasifikacije na dokumentu, fajlu ili resursu (npr. Microsoft Purview sensitivity labels, AWS tagovi `classification=confidential`). Oznaka omogućava da DLP i ljudi znaju kako postupati.
- **Geofencing**: pristup ili funkcija dozvoljeni samo unutar definisanog geografskog područja (npr. aplikacija radi samo na lokaciji firme, conditional access blokira prijave iz određenih zemalja).
- **Data location**: gdje se podaci fizički nalaze (država, region), važno zbog sovereigntyja i propisa.
- **Data placement**: svjesna odluka gdje smjestiti koji podatak (koji region, koji sistem, koja zona) prema klasifikaciji, performansama i propisima.

## Životni ciklus podataka

| Faza (engl.) | Sigurnosne aktivnosti |
|---|---|
| **Creation** | Klasifikacija i označavanje odmah pri nastanku |
| **Management** | Kontrola pristupa, enkripcija, praćenje, ažuriranje |
| **Distribution** | Siguran prenos, DLP, dijeljenje samo ovlaštenima |
| **Retention** | Čuvanje onoliko koliko zahtijevaju propisi i poslovanje, ne duže |
| **Disposal** | Sigurno uništavanje: brisanje/prepisivanje, **crypto-shredding** (uništenje ključa), fizičko uništenje medija, sertifikat o uništenju |

### Primjer: životni ciklus u AWS-u

1. **Creation**: novi S3 bucket dobija tag `classification=confidential` kroz Terraform modul; bez taga pipeline odbija deploy.
2. **Management**: default enkripcija sa KMS ključem, Block Public Access, IAM politike po klasifikaciji, CloudTrail logovanje pristupa.
3. **Distribution**: dijeljenje samo kroz presigned URL sa kratkim trajanjem ili cross-account ulogu, nikad javni link.
4. **Retention**: lifecycle pravilo premješta objekte u jeftiniju klasu nakon 90 dana i drži ih koliko propis traži.
5. **Disposal**: lifecycle expiration briše objekte; za cijeli skup podataka može se zakazati brisanje KMS ključa (crypto-shredding).

### Metode uništavanja

| Metoda | Kada |
|---|---|
| **Overwriting / wiping** | Medij se ponovo koristi; prepisivanje podataka |
| **Degaussing** | Magnetni mediji (HDD, trake); uništava i sam disk kao upotrebljiv medij |
| **Crypto-shredding** | Cloud i SSD gdje nemaš fizički pristup; brisanjem ključa podaci postaju nečitljivi |
| **Physical destruction** | Usitnjavanje (shredding), drobljenje, spaljivanje; najviši nivo sigurnosti |
| **Certificate of destruction** | Dokaz od spoljnog izvođača da je uništenje obavljeno (za audit) |

Za SSD diskove klasično prepisivanje nije pouzdano zbog wear levelinga; koristi se ugrađeno sigurno brisanje proizvođača, crypto-shredding ili fizičko uništenje.

## Compliance kategorije podataka

| Kategorija | Primjeri propisa i standarda |
|---|---|
| **Standards** | PCI DSS (kartice), ISO/IEC 27001, NIST okviri |
| **Health data** | HIPAA (SAD), GDPR posebne kategorije podataka (EU) |
| **Personal information** | GDPR, CCPA/CPRA, nacionalni zakoni o zaštiti ličnih podataka |
| **Financial** | SOX (finansijsko izvještavanje), GLBA, PCI DSS |
| **Child/minor data** | COPPA (SAD), GDPR posebna pravila za pristanak djece |
| **Intellectual property** | Poslovne tajne, patenti, izvorni kod |
| **Legal data** | Komunikacija sa advokatima, dokazi, podaci pod **legal hold**-om |

## Otpornost: lokacije za oporavak (3.4)

| Lokacija (engl.) | Stanje | Vrijeme aktivacije | Trošak |
|---|---|---|---|
| **Hot site** | Potpuno opremljena, podaci replicirani gotovo u realnom vremenu | Minuti do sati | Najveći |
| **Warm site** | Hardver i mreža spremni, podaci iz povremenih backupa | Sati do dani | Srednji |
| **Cold site** | Prostor, struja, hlađenje, bez opreme i podataka | Dani do sedmice | Najmanji |

U cloudu: hot ≈ **multi-site active/active**, warm ≈ **warm standby** (umanjena verzija stalno radi), cold ≈ **backup and restore** ili **pilot light** (samo jezgro, npr. replicirana baza, ostalo se podiže IaC-om).

**Environmental** razmatranja: lokacija za oporavak treba biti dovoljno **geografski udaljena** da je ne pogodi ista katastrofa (poplava, zemljotres, nestanak struje u regionu), ali dovoljno blizu za latenciju i dolazak osoblja. Uzimaju se u obzir klima, prirodni rizici, napajanje i pristupačnost.

> **Na ispitu:** Ako scenario traži **najkraće vrijeme oporavka** bez obzira na trošak, odgovor je **hot site**. Ako traži **najniži trošak** i prihvata dane zastoja, **cold site**. Warm je kompromis.

## Platform diversity

**Platform diversity** smanjuje rizik da jedna ranjivost ili kvar obori sve:

- **Vendor platform**: različiti proizvođači ili cloud provajderi.
- **Hardware**: različiti modeli/proizvođači hardvera (greška u firmwareu ne pogađa sve).
- **Virtualization**: različiti hipervizori ili mješavina VM-ova i containera.

## Redundantnost

| Rješenje (engl.) | Opis |
|---|---|
| **Load balancing** | Raspoređuje saobraćaj na više servera; ispad jednog ne ruši servis |
| **Clustering** | Više čvorova radi kao jedan sistem; **active/active** (svi rade) ili **active/passive** (rezervni čeka) |
| **Autoscaling** | Automatski dodaje ili uklanja instance prema opterećenju (AWS Auto Scaling Group, K8s HPA) |
| **High availability (HA)** | Dizajn bez jedne tačke otkaza: više zona dostupnosti, redundantne komponente |
| **Multicloud systems** | Raspodjela preko više provajdera radi otpornosti na ispad jednog |

### Napajanje

| Uređaj (engl.) | Uloga |
|---|---|
| **UPS** (*uninterruptible power supply*) | Baterija: **trenutno** preuzima napajanje pri nestanku struje, kratko (minute), dovoljno za uredno gašenje ili pokretanje generatora |
| **RPS** (*redundant power supply*) | Dva (ili više) napajanja u istom uređaju; kvar jednog ne gasi server; najbolje spojiti na različite strujne krugove |
| **Power generator** | Dizel/gas generator za **dugotrajne** nestanke; treba mu vrijeme da se pokrene (zato UPS premošćava) |
| **Surge protector** | Štiti od naponskih udara (prenapona), ne daje napajanje pri nestanku |

### Storage

Redundantnost skladišta: **RAID** (npr. RAID 1 mirroring, RAID 5/6 sa paritetom, RAID 10), replikacija između lokacija ili regiona (S3 Cross-Region Replication), redundantne SAN putanje. Važno: **RAID i replikacija nisu backup**. Ako obrišeš ili šifruješ fajl (ransomware), promjena se replicira.

## Backupi

| Aspekt (engl.) | Šta znači |
|---|---|
| **Retention** | Koliko dugo se čuvaju kopije (npr. dnevne 30 dana, mjesečne godinu dana); usklađeno sa propisima i RPO-om |
| **Immutability** | Kopija se ne može izmijeniti ni obrisati do isteka roka, ni od strane admina (**WORM**, S3 Object Lock, Azure immutable storage). Ključno protiv ransomwarea. |
| **Scope** | Šta se backupuje i kako: **full** (sve), **incremental** (promjene od posljednjeg bilo kojeg backupa), **differential** (promjene od posljednjeg full), snapshot, cijeli sistem vs samo podaci |
| **Restoration testing** | Redovno vraćanje iz backupa da se dokaže da radi i da se izmjeri stvarno vrijeme oporavka |

| Tip | Backup | Restore |
|---|---|---|
| Full | Najsporiji, najviše prostora | Najbrži: samo jedan set |
| Incremental | Najbrži, najmanje prostora | Najsporiji: full + **svi** incrementali redom |
| Differential | Raste svaki dan do sljedećeg full | Full + **posljednji** differential |

### Backupi u cloudu

- **Snapshot** (EBS, Azure disk) je brz i praktičan, ali ako je u istom nalogu i regionu kao produkcija, napadač sa admin pravima ga može obrisati.
- **AWS Backup** / **Azure Backup** sa **vault lockom** daju centralnu politiku, retention i immutability.
- Kopija u **zaseban nalog** (npr. poseban backup account u AWS Organizations) sa drugim kredencijalima smanjuje uticaj kompromitacije produkcionog naloga.
- Backup ključeve (KMS) zaštiti posebno: ako napadač obriše ključ, backup je beskoristan.
- Za Kubernetes: backup etcd-a i perzistentnih volumena (npr. Velero), plus IaC i GitOps repozitorijum kao izvor istine za konfiguraciju.

Pravilo **3-2-1**: tri kopije, na dva različita medija, jedna van lokacije (danas često i jedna offline/immutable).

> **Na ispitu:** Backup koji nikad nije testiran nije pouzdan backup. Ako scenario pita kako biti siguran da se podaci mogu vratiti, odgovor je **restoration testing**. Ako pita kako zaštititi backupe od ransomwarea koji ima admin prava, odgovor je **immutability** (i offline kopija).

## Testiranje otpornosti

| Test (engl.) | Opis |
|---|---|
| **Tabletop exercise** | Diskusija scenarija za stolom, bez diranja sistema (najjeftinije) |
| **Simulation** | Simulira se incident ili katastrofa i tim prolazi kroz postupke, sa realističnijim okidačima (npr. simulirani phishing, simulirani ispad) |
| **Failover** | Stvarno prebacivanje rada sa primarnog na sekundarni sistem ili lokaciju |
| **Parallel processing** | Sekundarni sistem obrađuje iste podatke **paralelno** sa primarnim, a rezultati se porede; produkcija nije ugrožena |

## DR, BC i capacity planning

- **Business continuity (BC)**: kako organizacija **nastavlja poslovne funkcije** tokom i nakon poremećaja (ljudi, procesi, alternativne lokacije, ručne procedure). Širi pojam.
- **Disaster recovery (DR)**: kako se **IT sistemi i podaci vraćaju** nakon katastrofe. Dio BC-a.

| | **Business continuity** | **Disaster recovery** |
|---|---|---|
| Fokus | Poslovni procesi i ljudi | IT sistemi i podaci |
| Pitanje | Kako nastavljamo raditi? | Kako vraćamo sisteme? |
| Primjer | Call centar prelazi na rad od kuće, ručna obrada narudžbi | Podizanje aplikacije u drugom AWS regionu iz backupa |
| Ulaz | BIA (kritične funkcije, RTO, RPO) | BIA i BCP |

- **Capacity planning**: planiranje da ima dovoljno **ljudi** (zamjene, obučeno osoblje), **tehnologije** (licence, softver) i **infrastrukture** (compute, storage, mreža) za normalno opterećenje, rast i rad tokom oporavka. U cloudu: kvote servisa u DR regionu, rezervisani kapacitet.

## Metrike oporavka

| Metrika (engl.) | Pitanje | Primjer |
|---|---|---|
| **RTO** (*recovery time objective*) | Koliko dugo smijemo biti **ugašeni**? | Servis mora raditi najkasnije 4 sata nakon ispada |
| **RPO** (*recovery point objective*) | Koliko **podataka** smijemo izgubiti (mjereno vremenom)? | RPO 15 min: backup/replikacija najmanje svakih 15 minuta |
| **MTTR** (*mean time to repair*) | Prosječno vrijeme popravke nakon kvara | Ukupno 12 h popravki / 4 kvara = 3 h |
| **MTBF** (*mean time between failures*) | Prosječno vrijeme rada između kvarova (pouzdanost) | 9.000 h rada / 3 kvara = 3.000 h |

- Manji RTO i RPO = skuplje rješenje (hot site, kontinuirana replikacija).
- Veći MTBF = pouzdaniji uređaj. Manji MTTR = brži popravak.

> **Na ispitu:** **RPO gleda unazad** (do koje tačke u prošlosti vraćamo podatke), **RTO gleda unaprijed** (koliko dugo do ponovnog rada). „Smijemo izgubiti najviše sat vremena transakcija“ je RPO. „Sistem mora biti online za dva sata“ je RTO.

## Rezime

- Podaci su **structured** ili **unstructured**; stanja su **at rest, in transit, in use**, a in use je najteže zaštititi.
- Klasifikacija (public do top secret, plus sensitive, restricted, critical) određuje kontrole; oznake (labeling) omogućavaju automatizaciju.
- **Tokenization** (vault, PCI opseg), **masking** (prikaz), **hashing** (jednosmjerno), **encryption** (povratno ključem), **deidentification** (anonimizacija/pseudonimizacija).
- **Owner** odlučuje, **custodian** sprovodi, **steward** brine o kvalitetu; **controller** određuje svrhu, **processor** i **subprocessor** obrađuju po nalogu.
- Lokacije: **hot** (brzo, skupo), **warm**, **cold** (sporo, jeftino); uzmi u obzir geografske rizike.
- Napajanje: **UPS** premošćava, **generator** traje, **RPS** štiti od kvara napajanja u uređaju, **surge protector** od prenapona.
- Backupi trebaju retention, **immutability** i **restoration testing**; RAID i replikacija nisu backup.
- **RTO** = koliko dugo smijemo biti dolje, **RPO** = koliko podataka smijemo izgubiti, **MTTR** = prosječna popravka, **MTBF** = pouzdanost.
