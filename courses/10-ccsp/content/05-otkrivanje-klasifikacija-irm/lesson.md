## Ciljevi ispita: 2.4, 2.5 i 2.6

Domen 2 (**Cloud Data Security**) je najteži domen CCSP ispita i nosi 20% pitanja. Ovaj modul pokriva tri cilja koja odgovaraju na pitanja „šta imamo, gdje je i koliko je vrijedno“ i „kako to zaštititi i kada napusti našu kontrolu“:

- **2.4 Implement data discovery**
  - strukturirani podaci (structured data),
  - nestrukturirani podaci (unstructured data),
  - polustrukturirani podaci (semi-structured data),
  - lokacija podataka (data location).
- **2.5 Plan and implement data classification**
  - politike klasifikacije (data classification policies),
  - mapiranje podataka (data mapping),
  - označavanje i tagovanje (data labeling and tagging).
- **2.6 Design and implement Information Rights Management (IRM)**
  - ciljevi: prava nad podacima (data rights), provisioning, modeli pristupa,
  - alati: izdavanje i opoziv certifikata, upravljanje ključevima, IdP.

Logika ovih ciljeva je lanac: **ne možeš klasifikovati ono što nisi otkrio, ne možeš zaštititi ono što nisi klasifikovao**. Discovery daje inventar, klasifikacija daje vrijednost i pravila rukovanja, a kontrole (enkripcija, DLP, IRM) primjenjuju ta pravila. IRM je posebna jer štiti podatak i nakon što izađe iz tvog okruženja.

> **Na ispitu:** kada scenario pita „šta organizacija treba uraditi FIRST“ prije uvođenja DLP-a, enkripcije ili IRM-a, a podaci još nisu inventarisani, tačan odgovor je skoro uvijek **data discovery**, a zatim **klasifikacija**. Kontrola bez klasifikacije ne zna šta štiti.

## Gdje discovery stoji u cloud data lifecycle

ISC2 koristi **cloud secure data lifecycle** sa šest faza: **Create – Store – Use – Share – Archive – Destroy**. Discovery i klasifikacija nisu jednokratni koraci:

| Faza | Uloga discoveryja i klasifikacije |
|---|---|
| Create | Idealno mjesto za klasifikaciju: podatak dobija labelu pri nastanku (automatski ili od autora). |
| Store | Periodični discovery skenira storage i pronalazi neoznačene ili pogrešno označene podatke. |
| Use | Labela određuje ko smije čitati i obrađivati; IRM i DLP je provode. |
| Share | Labela određuje smije li podatak van organizacije i pod kojim uslovima (IRM, DLP). |
| Archive | Klasifikacija određuje retenciju, format i lokaciju arhive (modul 06). |
| Destroy | Klasifikacija određuje metod uništenja (npr. crypto-shredding za osjetljive podatke). |

Praktično: klasifikacija pri nastanku je najjeftinija. Retroaktivni discovery nad petabajtima podataka je skup i nikad potpun, ali je neophodan jer podaci već postoje.

## Tipovi podataka (2.4)

### Strukturirani podaci

**Structured data** ima unaprijed definisanu šemu: relacione baze, tabele, kolone sa tipovima. Discovery je relativno lak jer postoje **metapodaci**: nazivi tabela i kolona (`jmbg`, `card_number`, `email`), tipovi i ograničenja.

Tehnike:

- **metadata-based discovery**: pretraga šeme i kataloga podataka (data catalog) po nazivima kolona i opisima,
- **content-based discovery**: uzorkovanje vrijednosti i provjera obrazaca (regex za IBAN, broj kartice uz Luhn provjeru),
- profilisanje podataka (data profiling): statistika kolona, kardinalnost, procenat null vrijednosti.

Zamka: kolona `notes` ili `comment` u strukturiranoj bazi često sadrži nestrukturirani tekst sa osjetljivim podacima. Zato samo metadata pristup nije dovoljan.

### Nestrukturirani podaci

**Unstructured data** nema šemu: dokumenti, PDF, email poruke, slike, skenirani dokumenti, audio i video, chat. Procjenjuje se da čini većinu podataka u organizaciji i najteži je za discovery.

Tehnike:

- **pattern matching / regular expressions** za poznate formate (brojevi kartica, JMBG, pasoši),
- **lexical analysis** i rječnici ključnih riječi („povjerljivo“, nazivi projekata),
- **exact data match (EDM)** i **document fingerprinting**: hash ili otisak poznatih osjetljivih zapisa i šablona dokumenata,
- **OCR** za slike i skenove,
- **machine learning klasifikatori** (trainable classifiers) za kategorije koje nemaju fiksni obrazac (ugovori, medicinski nalazi, CV).

Svaka tehnika daje **lažno pozitivne i lažno negativne** rezultate. Ručna validacija uzorka i podešavanje pravila su dio procesa.

### Polustrukturirani podaci

**Semi-structured data** ima neku strukturu, ali ne krutu šemu: **JSON, XML, YAML, CSV, logovi, email zaglavlja, NoSQL dokumenti**. Ključevi i tagovi daju kontekst (`"customer_email": ...`), ali se struktura mijenja od zapisa do zapisa.

Discovery kombinuje pristupe: parsiranje ključeva kao metapodataka i content analizu vrijednosti. Data lake je tipično mješavina sva tri tipa.

### Poređenje

| Osobina | Structured | Semi-structured | Unstructured |
|---|---|---|---|
| Primjeri | SQL baze, data warehouse | JSON, XML, logovi, NoSQL | Dokumenti, email, slike, video |
| Šema | Fiksna, unaprijed | Fleksibilna, samoopisujuća | Nema |
| Glavna tehnika | Metadata + uzorkovanje | Parsiranje ključeva + content | Content analiza, EDM, ML, OCR |
| Težina discoveryja | Niska | Srednja | Visoka |
| Tipičan rizik | Osjetljiva kolona bez kontrole | Logovi sa tokenima i PII | Dokumenti razasuti po SaaS-u |

### Tri pristupa discovery analizi

ISC2 literatura razlikuje tri pristupa koje treba prepoznati u pitanju:

| Pristup | Kako radi | Prednost | Slabost |
|---|---|---|---|
| **Metadata-based** | Analizira podatke o podacima: naziv, vlasnik, veličina, datum, nazivi kolona | Brz, jeftin | Ne vidi sadržaj; loši nazivi = promašaj |
| **Label-based** | Oslanja se na postojeće labele i tagove | Precizan ako su labele tačne | Ovisi o disciplini označavanja |
| **Content-based** | Čita sam sadržaj (pattern, hash, ML) | Najtačniji | Najsporiji, skup, ne radi nad šifrovanim sadržajem |

> **Na ispitu:** ako pitanje kaže da su podaci šifrovani na strani klijenta (client-side encryption) i pita zašto content-based discovery ne radi, odgovor je da alat ne vidi plaintext. Rješenje je discovery **prije** enkripcije ili oslanjanje na labele i metapodatke.

## Lokacija podataka (2.4)

U cloudu je pitanje „gdje su podaci“ teže nego on-premises:

- provider replicira podatke između **availability zona** i ponekad regiona,
- backupi, snapshoti i logovi mogu biti u drugoj lokaciji od primarnih podataka,
- SaaS provider može koristiti **podprocesore** (subprocessors) u drugim zemljama,
- CDN kešira sadržaj na edge lokacijama širom svijeta,
- **shadow IT**: zaposleni koriste nesankcionisane SaaS servise, pa podaci završe na mjestima za koja sigurnosni tim ne zna,
- AI servisi mogu slati promptove i podatke na obradu u drugu regiju.

Lokacija je važna zbog **jurisdikcije**:

| Pojam | Značenje |
|---|---|
| **Data residency** | Gdje su podaci fizički pohranjeni (često poslovni ili regulatorni zahtjev). |
| **Data sovereignty** | Podaci podliježu zakonima zemlje u kojoj se nalaze (i ponekad zemlje providera). |
| **Data localization** | Zakon izričito traži da podaci ostanu u zemlji. |
| **Cross-border transfer** | Prenos van jurisdikcije, npr. GDPR traži odgovarajući mehanizam (odluka o adekvatnosti, SCC). |

Alati za otkrivanje lokacije: inventar resursa po regionima (cloud asset inventory), politike koje ograničavaju regione (u AWS-u SCP sa `aws:RequestedRegion`, u Azure-u Azure Policy „Allowed locations“), **CASB** za otkrivanje shadow IT-a kroz analizu proxy i firewall logova, i ugovorne obaveze providera o lokaciji obrade.

Primjer: banka u EU koristi SaaS CRM. Discovery pokaže da provider šalje podatke na podršku u treću zemlju. Prvo pitanje nije tehničko nego pravno i ugovorno: da li ugovor (DPA) to dozvoljava i postoji li mehanizam prenosa.

> **Na ispitu:** pitanje o lokaciji podataka je najčešće pitanje **pravne odgovornosti**. Data owner (cloud customer) ostaje odgovoran za usklađenost čak i kada provider obrađuje podatke. Odgovor tipa „to je odgovornost providera“ je gotovo uvijek pogrešan.

## Izazovi discoveryja u cloudu

| Izazov | Opis | Ublažavanje |
|---|---|---|
| Pristup podacima | U SaaS-u nemaš pristup storageu, samo API-ju providera | Provider-native discovery, CASB API integracija |
| Volumen i trošak | Skeniranje velikih data lakeova košta (egress, API pozivi) | Uzorkovanje, inkrementalno skeniranje |
| Brzina promjena | Resursi nastaju i nestaju za minute | Kontinuirani i event-driven discovery |
| Enkripcija | Content analiza ne vidi šifrovane podatke | Discovery prije enkripcije, labele |
| Kvalitet podataka | Loši nazivi, duplikati, zastarjeli podaci | Data governance, vlasnici podataka |
| Pravne prepreke | Skeniranje privatne komunikacije zaposlenih | Pravna procjena, minimizacija |

Primjer iz prakse: **Amazon Macie** radi content-based discovery osjetljivih podataka u S3; **Microsoft Purview** radi discovery i klasifikaciju preko M365 i Azure izvora; **Google Cloud Sensitive Data Protection** (raniji Cloud DLP) skenira BigQuery i Cloud Storage. Na ispitu se ovi nazivi ne pitaju, ali ti pomažu da prepoznaš koncept.

## Klasifikacija podataka (2.5)

**Data classification** je dodjeljivanje podatku kategorije na osnovu osjetljivosti, vrijednosti i zahtjeva, iz koje slijede **pravila rukovanja** (handling requirements): ko smije pristupiti, da li mora biti šifrovan, gdje smije biti pohranjen, koliko se čuva i kako se uništava.

### Uloge

| Uloga | Odgovornost u klasifikaciji |
|---|---|
| **Data owner** | Odgovoran za podatak; **određuje klasifikaciju** i odobrava pristup. Obično poslovni rukovodilac. |
| **Data custodian** | Implementira kontrole koje klasifikacija traži (backup, enkripcija, pristup). Često IT ili cloud provider. |
| **Data steward** | Brine o kvalitetu, metapodacima i poslovnom značenju podataka. |
| **Data processor** | Obrađuje podatke u ime controllera (GDPR pojam); cloud provider je tipično processor. |
| **Data subject** | Osoba na koju se lični podaci odnose. |

> **Na ispitu:** „Ko je odgovoran za klasifikaciju podataka?“ Odgovor je **data owner**, ne custodian, ne sigurnosni tim i ne cloud provider. Custodian provodi kontrole, owner donosi odluku.

### Politika klasifikacije

Dobra **data classification policy** definiše:

- **nivoe klasifikacije** i jasne kriterijume za svaki nivo,
- **uloge i odgovornosti** (owner, custodian, korisnik),
- **pravila rukovanja** po nivou (pohrana, prenos, dijeljenje, štampa, uništenje),
- proces **reklasifikacije i deklasifikacije** (podatak gubi ili dobija na osjetljivosti, npr. finansijski izvještaj nakon objave),
- šta se radi sa **agregiranim podacima** (agregacija nisko klasifikovanih podataka može dati osjetljiviji skup),
- izuzetke i proces odobravanja,
- periodični pregled.

Kriterijumi za klasifikaciju koje ISC2 navodi:

| Kriterijum | Primjer |
|---|---|
| Tip i format podataka | Lični podaci, zdravstveni podaci, platni podaci, intelektualna svojina |
| Osjetljivost i uticaj otkrivanja | Šta se desi ako procuri: šteta, kazne, reputacija |
| Regulatorni i ugovorni zahtjevi | GDPR, HIPAA, PCI DSS, NDA sa partnerom |
| Jurisdikcija | Gdje je podatak nastao i čiji zakon važi |
| Vlasništvo | Čiji je podatak: organizacije, klijenta, partnera |
| Kontekst i upotreba | Isti podatak u drugom kontekstu može imati drugu osjetljivost |
| Kritičnost / dostupnost | Koliko je podatak važan za poslovanje (utiče na BC/DR) |

### Tipične šeme

| Komercijalna šema | Vladina šema (primjer) | Tipično rukovanje |
|---|---|---|
| Public | Unclassified | Bez posebnih ograničenja |
| Internal | (Sensitive but unclassified) | Samo zaposleni, osnovne kontrole |
| Confidential | Confidential | Enkripcija, need-to-know, DLP |
| Restricted / Highly confidential | Secret / Top Secret | Jaka enkripcija, IRM, strog pristup, logovanje svakog pristupa |

Pravilo: **manje nivoa je bolje**. Šema sa sedam nivoa koju niko ne razumije vodi ka tome da korisnici sve označe istim nivoom. Tri do pet nivoa je praksa.

Za lične podatke se često dodaju kategorije: **PII** (personally identifiable information), **PHI** (protected health information, HIPAA), **cardholder data** (PCI DSS), **posebne kategorije** po GDPR članu 9 (zdravlje, biometrija, vjera, politička opredjeljenja).

### Ko klasifikuje: ručno ili automatski

| Metod | Kako | Kada |
|---|---|---|
| Ručna (user-driven) | Autor bira labelu pri kreiranju | Korisnik najbolje zna kontekst; rizik grešaka i lijenosti |
| Automatska (content-based) | Alat dodjeljuje labelu po sadržaju | Velik volumen, poznati obrasci |
| Preporučena (recommended) | Alat predloži, korisnik potvrdi | Kompromis tačnosti i edukacije |
| Nasljeđena / kontekstualna | Labela iz lokacije (folder, bucket, projekat) | Jednostavno, ali gruba podjela |

## Mapiranje podataka (2.5)

**Data mapping** u CCSP kontekstu ima dva značenja i oba se mogu pitati:

1. **Mapiranje između šema klasifikacije**: kada dvije organizacije razmjenjuju podatke ili kada se podaci sele između sistema, mora se definisati kako se labele jedne strane preslikavaju na labele druge („njihov Restricted = naš Confidential“). Bez toga podatak u prenosu dobije slabiju zaštitu. Primjer: integracija nakon spajanja kompanija ili migracija u novi cloud sistem.
2. **Mapiranje tokova podataka (data flow mapping)**: dokumentovanje odakle podatak dolazi, kroz koje sisteme prolazi, gdje se pohranjuje, ko ga obrađuje i kuda izlazi. Rezultat je **data flow diagram** i inventar. GDPR član 30 traži **evidenciju aktivnosti obrade** (Records of Processing Activities, RoPA), a DPIA ne može bez data mape.

Data mapa treba da sadrži: kategorije podataka, izvore, sisteme i lokacije (uključujući regione), vlasnike, primaoce i podprocesore, pravni osnov obrade, retenciju i primijenjene kontrole.

Praktično mapiranje također povezuje polja: kolona `dob` u jednom sistemu je `date_of_birth` u drugom, i obje moraju imati istu klasifikaciju.

> **Na ispitu:** ako se podaci razmjenjuju sa partnerom koji koristi drugačiju šemu klasifikacije, BEST prvi korak je **mapiranje šema klasifikacije** i dogovor u ugovoru o pravilima rukovanja, a ne „primijeniti najjaču enkripciju na sve“.

## Labeling i tagging (2.5)

Klasifikacija je odluka, a **labela** je njen vidljivi i mašinski čitljiv zapis koji kontrole mogu provesti.

| Pojam | Opis | Primjer |
|---|---|---|
| **Label (vizuelna)** | Oznaka vidljiva čovjeku | Zaglavlje dokumenta „POVJERLJIVO“, vodeni žig |
| **Metadata label** | Atribut u metapodacima fajla ili objekta | Sensitivity label u Office dokumentu |
| **Resource tag** | Key-value par na cloud resursu | `DataClassification=Confidential` na S3 bucketu ili bazi |
| **Persistent label** | Putuje sa podatkom i kada se kopira | Labela ugrađena u fajl + IRM zaštita |

ISC2 navodi šta labela može sadržavati:

- datum kreiranja,
- planirani datum uništenja / kraj retencije,
- vlasnik podatka,
- izvor podatka,
- jurisdikcija,
- nivo klasifikacije,
- ograničenja pristupa i rukovanja (npr. „samo za EU“, „ne dijeliti eksterno“).

Tagovi u cloudu služe za **provođenje politika**: ABAC pravila (u AWS-u `aws:ResourceTag/DataClassification`), automatsko uključivanje enkripcije i backupa, DLP pravila, cost i ownership izvještaje. Zato moraš imati **tagging politiku**: obavezne ključeve, dozvoljene vrijednosti, ko smije mijenjati tag (inače korisnik promijeni `Restricted` u `Public` i zaobiđe kontrolu), i provjeru usklađenosti (Config pravila, Azure Policy, tag policies).

Problemi sa labelama:

- labela se izgubi pri konverziji formata ili kopiranju u sistem koji je ne podržava,
- korisnici označe pogrešno ili sve isto,
- tagovi na resursu ne znače da su svi podaci unutar resursa te klasifikacije,
- labela otkriva da je nešto vrijedno (zato se ponekad ne prikazuje vizuelno).

> **Na ispitu:** pitanje „kako osigurati da klasifikacija ostane sa podatkom kada se kopira u drugi sistem ili pošalje partneru“ vodi ka **persistent labelama u metapodacima** i **IRM-u**, ne ka tagovima na bucketu koji ostaju samo na izvoru.

## Information Rights Management (2.6)

**Information Rights Management (IRM)** štiti sam podatak (dokument, email) tako što ga šifruje i veže uz politiku koja određuje ko šta smije s njim raditi, **bez obzira gdje se podatak nalazi**. Klasična kontrola pristupa štiti kontejner (folder, bucket, aplikaciju); kada se fajl preuzme, zaštita nestaje. IRM zaštita putuje sa fajlom.

Pojmovi: **DRM (Digital Rights Management)** se istorijski koristi za zaštitu medijskog sadržaja za potrošače (muzika, filmovi, e-knjige), a **IRM** (ili Enterprise DRM, E-DRM) za poslovne dokumente. CCSP ih često koristi kao bliske pojmove.

### Kako IRM radi

1. Autor (ili automatska politika na osnovu labele) primijeni zaštitu na dokument.
2. Dokument se šifruje simetričnim ključem; ključ se štiti i čuva kod IRM servera / servisa.
3. Politika (ko, koja prava, do kada) se veže uz dokument.
4. Kada primalac otvori dokument, klijent (IRM-enabled aplikacija ili agent) autentifikuje korisnika kod IdP-a i traži licencu od IRM servisa.
5. Servis provjeri politiku i izda licencu sa pravima; aplikacija ih provodi (npr. zabranjuje štampu).
6. Svaki pristup se loguje.

### Ciljevi i mogućnosti IRM-a

| Mogućnost | Šta znači |
|---|---|
| **Persistent protection** | Zaštita ostaje sa podatkom bez obzira gdje je kopiran ili poslan. |
| **Dynamic policy control** | Vlasnik može naknadno promijeniti prava, i to važi za već poslane kopije. |
| **Automatic expiration** | Pristup automatski prestaje nakon datuma ili perioda. |
| **Continuous audit trail** | Logovanje ko je, kada i odakle pristupio dokumentu. |
| **Replication restrictions** | Ograničenje kopiranja, štampe, snimka ekrana, prosljeđivanja. |
| **Remote rights revocation** | Vlasnik može opozvati pristup na daljinu (npr. bivšem partneru). |

### Data rights

Tipična prava (granularna dozvola po korisniku ili grupi): **view/read, edit, print, copy/extract, forward, save as, export, full control**. Primjer: pravni tim šalje ugovor eksternom advokatu sa pravom samo pregleda, bez štampe i prosljeđivanja, uz istek za 30 dana.

### Provisioning

**Provisioning** u IRM-u znači dodjela prava korisnicima i uređajima:

- korisnici moraju imati **identitet** koji IRM servis prepoznaje: interni direktorij, **federacija** sa partnerom (SAML, OIDC) ili eksterni nalog,
- provisioning i deprovisioning moraju biti povezani sa IAM životnim ciklusom: kada zaposleni ode, pristup zaštićenim dokumentima prestaje,
- uređaji mogu biti uslov (samo upravljani uređaji, compliant mobilni uređaji),
- prava se dodjeljuju kroz **šablone politika** povezane sa nivoima klasifikacije, a ne ručno po dokumentu.

### Modeli pristupa

| Model | Primjena u IRM-u |
|---|---|
| **DAC** | Autor sam određuje ko ima prava (ad hoc zaštita dokumenta). |
| **RBAC** | Prava po ulozi/grupi (npr. „Finansije – read“). |
| **ABAC** | Prava po atributima korisnika, uređaja, lokacije, labele (npr. samo iz EU, samo compliant uređaj). |
| **MAC** | Politiku nameće sistem na osnovu klasifikacije, korisnik je ne može promijeniti. |

U cloudu IRM tipično radi kao servis (npr. **Microsoft Purview Information Protection** sa Azure Rights Management), integrisan sa IdP-om i labelama: labela „Highly Confidential“ automatski primijeni IRM šablon.

Arhitekture: **agent-based** (instaliran klijent ili plugin provodi prava) i **agentless** (pristup kroz web preglednik ili aplikaciju koja nativno podržava IRM). Agentless je lakši za partnere, agent-based daje jaču kontrolu.

### Alati: certifikati, ključevi i identitet

IRM se oslanja na kriptografiju i PKI:

| Komponenta | Uloga |
|---|---|
| **Identity provider (IdP)** | Autentifikacija korisnika prije izdavanja licence. |
| **PKI / certifikati** | Identitet servera i klijenata, potpisivanje licenci i politika, ponekad korisnički certifikati. |
| **Izdavanje certifikata (issuing)** | CA izdaje certifikate korisnicima, uređajima i IRM serveru; vezano uz provisioning. |
| **Opoziv certifikata (revocation)** | Kada je ključ kompromitovan ili korisnik napusti organizaciju: **CRL** (Certificate Revocation List) i **OCSP** (Online Certificate Status Protocol). |
| **Key management** | Čuvanje i rotacija ključeva koji štite sadržaj; ponekad **HYOK/BYOK** (Hold/Bring Your Own Key) za osjetljive podatke. |
| **IRM politika / licencni server** | Izdaje licence, provodi istek i opoziv prava, loguje pristupe. |

Opoziv certifikata i opoziv prava nisu isto: opoziv certifikata poništava identitet ili ključ, a opoziv prava (remote revocation) mijenja politiku za dokument. Oba su potrebna. Ako klijent radi offline sa keširanom licencom, opoziv važi tek kada se licenca istekne ili klijent ponovo poveže, pa se za osjetljive podatke postavlja kratak period offline pristupa.

### Izazovi IRM-a

- **Snažan identitet je preduslov**: bez pouzdane autentifikacije IRM ne zna kome izdaje prava; federacija sa partnerima je čest problem.
- **Kompatibilnost**: primalac mora imati aplikaciju ili agent koji podržava IRM; nisu svi formati i uređaji podržani.
- **Mobilni uređaji i offline rad**.
- **Analogna rupa** (analog hole): korisnik može fotografisati ekran telefonom; IRM to ne sprečava, samo otežava (vodeni žig pomaže pri otkrivanju izvora).
- **Discovery i DLP**: šifrovani sadržaj je nevidljiv content-based alatima ako nemaju pristup ključu.
- **eDiscovery i legal hold**: organizacija mora zadržati sposobnost dešifrovanja (super user funkcija) da bi ispunila zakonske obaveze.
- **Trošak i složenost** upravljanja politikama.

> **Na ispitu:** scenario „povjerljivi dokument se dijeli sa vanjskim partnerom i organizacija mora moći opozvati pristup nakon završetka saradnje“ traži **IRM**. DLP sprečava izlazak podatka, enkripcija u tranzitu štiti prenos, ali samo IRM kontroliše šta primalac radi nakon prijema i omogućava opoziv.

## IRM, DLP i enkripcija: kada šta

| Kontrola | Šta štiti | Gdje prestaje zaštita | Tipično pitanje |
|---|---|---|---|
| Enkripcija at rest | Podatak na disku/storageu | Kada ga ovlaštena aplikacija dešifruje | „Zaštita od krađe medija / pristupa providera“ |
| Enkripcija in transit (TLS) | Podatak u prenosu | Na odredištu | „Presretanje u mreži“ |
| **DLP** | Sprečava neovlašten izlazak (email, upload, USB) | Nakon što podatak legitimno izađe | „Spriječiti slanje kartica emailom“ |
| **IRM** | Upotrebu podatka bilo gdje | Analogna rupa, nepodržani klijenti | „Kontrola nakon dijeljenja, opoziv“ |
| **CASB** | Upotrebu cloud servisa, shadow IT | Van posmatranog saobraćaja/API-ja | „Otkriti nesankcionisane SaaS aplikacije“ |

Ove kontrole se nadopunjuju i sve zavise od klasifikacije: DLP pravila i IRM šabloni se vežu za labele.

## Scenario: od discoveryja do IRM-a

Farmaceutska kompanija seli istraživačke podatke u cloud i dijeli rezultate kliničkih ispitivanja sa univerzitetima.

1. **Discovery**: skeniranje file servera, SharePointa i S3 bucketa. Pronađeni su strukturirani podaci (baza pacijenata), polustrukturirani (JSON eksport laboratorijskih uređaja) i nestrukturirani (izvještaji, skenirani obrasci saglasnosti). Otkriveno je i da istraživači koriste privatni file-sharing servis (shadow IT).
2. **Lokacija**: dio podataka je u regionu van EU; to se mapira na pravne zahtjeve.
3. **Klasifikacija**: data owneri (rukovodioci istraživanja) primjenjuju politiku: zdravstveni podaci pacijenata su „Restricted“, protokoli „Confidential“, objavljeni rezultati „Public“.
4. **Data mapping**: šema univerziteta se mapira na šemu kompanije u ugovoru o saradnji; dokumentuju se tokovi ka partnerima (RoPA).
5. **Labeling**: automatske labele za dokumente sa zdravstvenim podacima, tagovi `DataClassification` na cloud resursima, SCP koji odbija resurse bez taga.
6. **IRM**: dokumenti „Confidential“ koji idu univerzitetima dobijaju IRM šablon: samo pregled, bez štampe, istek na kraju projekta, federacija sa IdP-om univerziteta.

## Rezime

- Lanac je **discovery → klasifikacija → kontrole**; bez inventara nema klasifikacije, bez klasifikacije kontrole ne znaju šta štite.
- **Structured** (šema, metapodaci), **semi-structured** (JSON, XML, logovi), **unstructured** (dokumenti, slike) zahtijevaju različite tehnike; content-based je najtačniji, ali ne vidi šifrovane podatke.
- Tri pristupa discoveryju: **metadata-based, label-based, content-based**.
- **Lokacija podataka** je pitanje jurisdikcije (residency, sovereignty, localization); customer ostaje odgovoran.
- **Data owner** određuje klasifikaciju; custodian provodi kontrole.
- Politika klasifikacije definiše nivoe, kriterijume, rukovanje, reklasifikaciju i agregaciju; manje nivoa je bolje.
- **Data mapping** = preslikavanje šema između organizacija i mapiranje tokova podataka (RoPA, DPIA).
- **Labele** su mašinski čitljiv zapis klasifikacije; tagovi provode politike, a tagging politika mora spriječiti neovlaštenu promjenu.
- **IRM** štiti podatak gdje god bio: persistent protection, dynamic policy, expiration, audit trail, replication restrictions, remote revocation.
- IRM zavisi od snažnog identiteta, PKI-ja (izdavanje i opoziv certifikata, CRL/OCSP) i upravljanja ključevima; ne rješava analognu rupu.
