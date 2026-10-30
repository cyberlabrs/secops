## Ciljevi ispita: 2.7, 2.8 i 2.9

Ovaj modul završava domen 2 (**Cloud Data Security**, 20%). Pokriva kraj životnog ciklusa podataka, dokazivost onoga što se s podacima dešava i novu temu iz outlinea 2026, zaštitu AI/ML podataka:

- **2.7 Plan and implement data retention, deletion and archiving policies**
  - politike retencije (data retention policies),
  - procedure i mehanizmi brisanja (data deletion procedures and mechanisms),
  - procedure i mehanizmi arhiviranja (data archiving procedures and mechanisms),
  - legal hold (ovlašten pristup, sprečavanje brisanja).
- **2.8 Design and implement auditability, traceability and accountability of data events**
  - definisanje izvora događaja i obaveznih atributa (identitet, IP adresa, geolokacija),
  - logovanje, pohrana i analiza događaja nad podacima,
  - chain of custody i non-repudiation.
- **2.9 Comprehend data protection of Artificial Intelligence (AI) and Machine Learning (ML) data**
  - privatnost skupova podataka i modela (data set and model privacy),
  - sigurnost skupova podataka i modela (validacija, verifikacija).

U životnom ciklusu **Create – Store – Use – Share – Archive – Destroy** cilj 2.7 pokriva faze **Archive** i **Destroy**, cilj 2.8 prati sve faze (svaka faza proizvodi događaje), a 2.9 primjenjuje iste principe na podatke za treniranje i na same modele.

## Politike retencije (2.7)

**Data retention policy** određuje koliko dugo se koja kategorija podataka čuva, u kom obliku i šta se radi kada rok istekne. Retencija je kompromis dva suprotna pritiska:

- **čuvati dovoljno dugo**: zakonske i ugovorne obaveze, poslovne potrebe, odbrana u sporovima,
- **ne čuvati duže nego što treba**: GDPR princip **storage limitation**, trošak, rizik curenja i obim eDiscoveryja (sve što imaš, moraš predati).

Elementi politike retencije prema ISC2:

| Element | Šta definiše |
|---|---|
| **Retention periods** | Rok čuvanja po kategoriji podataka (iz klasifikacije i regulative). |
| **Data formats** | U kom formatu se čuva da bi bio čitljiv kroz cijeli rok. |
| **Data security** | Koje kontrole važe tokom retencije (enkripcija, pristup). |
| **Data retrieval procedures** | Kako i za koliko vremena se podatak može vratiti (npr. za sud ili regulatora). |
| **Data classification** | Veza između nivoa klasifikacije i rokova. |
| **Applicable regulations** | Koji zakoni i standardi određuju rok. |
| **Monitoring, maintenance and enforcement** | Ko provjerava da se politika provodi i kako. |

Primjeri regulatornih rokova koje vrijedi poznavati (konkretne brojke ispit rijetko traži, ali traži razumijevanje da rok određuje regulativa):

| Regulativa | Primjer zahtjeva |
|---|---|
| **PCI DSS v4.0** | Audit logovi se čuvaju najmanje 12 mjeseci, posljednja 3 mjeseca odmah dostupna za analizu. |
| **HIPAA** | Dokumentacija politika i procedura sigurnosti čuva se 6 godina. |
| **SOX / SEC** | Revizorski radni papiri i povezana dokumentacija čuvaju se 7 godina. |
| **GDPR** | Nema fiksnog roka: lični podaci se čuvaju samo koliko je potrebno za svrhu (storage limitation). |
| Domaći propisi | Računovodstvena i poreska dokumentacija ima zakonom propisane rokove. |

Kada se rokovi preklapaju, primjenjuje se **najduži važeći rok**, osim ako zakon o privatnosti zahtijeva brisanje; tada pravna služba odlučuje i dokumentuje osnov.

> **Na ispitu:** retencijski rok ne određuje IT niti cloud provider, nego **regulativa, ugovori i poslovne potrebe** kroz politiku koju odobrava uprava, uz učešće pravne službe i data ownera. Ako odgovor kaže „čuvati sve zauvijek za svaki slučaj“, to je pogrešno: povećava rizik i krši storage limitation.

### Retencija u cloudu

Cloud olakšava automatizaciju: **lifecycle politike** (u AWS-u S3 Lifecycle, u Azure-u Blob lifecycle management) prebacuju podatke u jeftinije klase i brišu ih po isteku roka; **retention politike** u SaaS-u (npr. Microsoft Purview retention) čuvaju i brišu email i dokumente. Ali customer mora znati:

- koliko dugo **provider** čuva backup kopije i logove nakon brisanja,
- šta se dešava sa podacima po **raskidu ugovora** (rok za izvoz, potvrda brisanja),
- u kojim regionima su kopije.

To se rješava **ugovorom** (klauzule o retenciji, povratu i brisanju podataka), jer customer ne može fizički provjeriti providerove medije.

Ugovorne klauzule koje se tiču retencije i brisanja:

| Klauzula | Šta treba da definiše |
|---|---|
| Retencija kod providera | Koliko dugo provider čuva podatke, backupe i logove customera |
| Povrat podataka (data return) | Format, rok i način izvoza podataka po raskidu |
| Brisanje po raskidu | Rok brisanja svih kopija, uključujući backupe, i metod |
| Dokaz brisanja | Potvrda ili certifikat, odnosno pokrivenost u audit izvještajima |
| Legal hold i eDiscovery | Sposobnost providera da sačuva podatke i saradnja u postupcima |
| Podprocesori | Da li i gdje podprocesori drže kopije i kako ih brišu |

Retencija po modelu usluge:

| Model | Ko tehnički provodi retenciju | Napomena |
|---|---|---|
| IaaS | Customer (lifecycle politike, backup softver) | Customer kontroliše i snapshote i replike |
| PaaS | Uglavnom customer kroz postavke servisa | Automatski backupi baza imaju vlastite rokove koje treba podesiti |
| SaaS | Provider, kroz opcije koje izloži | Ako SaaS nema dovoljno dugu retenciju, potreban je izvoz ili third-party backup |

## Brisanje podataka (2.7)

Brisanje u cloudu je teško jer customer nema pristup fizičkim medijima, podaci su replicirani, a storage je dijeljen sa drugim tenantima. Pojam **data remanence** označava ostatke podataka koji ostanu nakon pokušaja brisanja.

**NIST SP 800-88 Rev. 2** (Guidelines for Media Sanitization, septembar 2025, zamijenio Rev. 1 iz 2014) definiše tri nivoa sanitizacije i eksplicitno uključuje i virtuelni/logički storage poput clouda:

| Metod | Opis | Primjer | Moguć u cloudu za customera? |
|---|---|---|---|
| **Clear** | Logičke tehnike nad korisnički dostupnim prostorom; štiti od jednostavnog oporavka | Prepisivanje (overwriting), reset na fabričke postavke | Djelimično (prepisivanje volumena), nepouzdano zbog virtualizacije |
| **Purge** | Tehnike koje štite i od laboratorijskog oporavka | **Cryptographic erase**, block erase, degaussing | Da, kroz **crypto-shredding** |
| **Destroy** | Medij postaje neupotrebljiv | Drobljenje, spaljivanje, topljenje, dezintegracija | Ne, to radi provider |

Metode koje ISC2 tradicionalno navodi:

| Metoda | Napomena |
|---|---|
| **Overwriting** | Prepisivanje nulama ili nasumičnim podacima; na SSD-u i u cloudu ne garantuje da su svi blokovi prepisani. |
| **Degaussing** | Jako magnetno polje; radi samo na magnetnim medijima (HDD, trake), ne na SSD-u; u cloudu nedostupno customeru. |
| **Physical destruction** | Najsigurnije, ali samo za provajdera ili on-prem opremu. |
| **Cryptographic erasure (crypto-shredding)** | Podaci su šifrovani, a brišu se svi ključevi; preostali šifrat je neupotrebljiv. |

### Crypto-shredding

**Crypto-shredding** je jedini praktičan način da cloud customer postigne sanitizaciju na nivou purge. Preduslovi:

1. podaci su **šifrovani od početka** (uključujući backupe, snapshote i replike),
2. ključ je pod kontrolom customera (customer-managed key, BYOK/HYOK, HSM),
3. **sve kopije ključa** se uništavaju, uključujući backupe ključa i escrow,
4. uništenje se dokumentuje.

U AWS-u to odgovara brisanju KMS ključa (`ScheduleKeyDeletion` sa periodom čekanja 7–30 dana); svi podaci šifrovani tim ključem postaju nečitljivi. Zbog toga je brisanje ključa i opasna operacija: pogrešno obrisan ključ je trajan gubitak podataka.

> **Na ispitu:** „Koji je BEST metod da cloud customer osigura da podaci ne mogu biti oporavljeni nakon napuštanja providera?“ Odgovor je **crypto-shredding**. Degaussing i fizičko uništenje nisu dostupni customeru, a prepisivanje nije pouzdano u virtualizovanom i repliciranom storageu.

### Procedura brisanja

Dobra procedura brisanja sadrži:

- okidače: istek retencije, zahtjev ispitanika (GDPR **right to erasure**), raskid ugovora, dekomisija sistema,
- provjeru da podatak **nije pod legal holdom** prije brisanja,
- popis svih lokacija (primarni storage, replike, backupi, logovi, keševi, data lakeovi, kopije u test okruženjima),
- metod po klasifikaciji,
- **verifikaciju** i **dokumentaciju** (certificate of destruction / sanitization record),
- od providera: ugovorna obaveza i dokaz o sanitizaciji medija (pokriva se kroz SOC 2 i ISO/IEC 27001 izvještaje, jer customer ne može auditovati fizičke diskove).

Zapis o sanitizaciji (sanitization record) tipično sadrži: opis medija ili resursa, kategoriju podataka, metod (clear, purge, destroy), alat, datum, izvršioca, rezultat verifikacije i potpis. U cloudu to može biti zapis o uništenju ključa sa identifikatorom ključa i listom resursa koje je štitio.

## Arhiviranje (2.7)

**Data archiving** je premještanje podataka koji se više aktivno ne koriste, ali se moraju čuvati, u dugoročni i jeftiniji storage. Arhiva nije backup:

| Osobina | Backup | Arhiva |
|---|---|---|
| Svrha | Oporavak nakon gubitka ili kvara | Dugoročno čuvanje za zakon, poslovanje, istoriju |
| Sadržaj | Kopija aktivnih podataka | Originalni podaci koji su uklonjeni iz aktivne upotrebe |
| Rok | Kratak do srednji (dani, sedmice) | Dug (godine, decenije) |
| Pristup | Brz restore | Rijedak, može trajati satima |
| Veza sa BC/DR | Direktna (RPO/RTO) | Indirektna |

Elementi procedure arhiviranja:

- **Enkripcija i upravljanje ključevima**: ključevi se moraju čuvati koliko i arhiva. Izgubljen ključ = izgubljena arhiva; rotacija ključa ne smije učiniti stare arhive nečitljivim.
- **Format podataka**: hoće li za 10 godina postojati softver koji čita format? Preferirati otvorene formate i periodičnu migraciju.
- **Medij i tehnologija**: trake, cold storage klase (S3 Glacier Deep Archive, Azure Archive tier); vrijeme povrata se mjeri satima.
- **Lokacija**: jurisdikcija arhive, geografska udaljenost od primarne lokacije.
- **Integritet i nepromjenjivost**: **WORM** (write once, read many), u cloudu S3 Object Lock ili Azure immutable blob storage.
- **Restore procedure i testiranje**: arhiva koja nije testirana nije arhiva.
- **Indeksiranje i pretraga**: da se podaci mogu pronaći za eDiscovery.

> **Na ispitu:** kod dugoročnih šifrovanih arhiva MOST important rizik je **gubitak ključeva ili nečitljiv format**, ne brzina storagea. Odgovor koji osigurava dugoročno čuvanje ključeva i testiran restore je bolji od odgovora o jeftinijoj klasi storagea.

## Legal hold (2.7)

**Legal hold** (litigation hold) je obaveza da se sačuvaju svi podaci relevantni za sudski spor, istragu ili regulatorni postupak, **od trenutka kada se spor razumno očekuje**, ne tek kada stigne tužba. Legal hold **suspenduje redovnu retenciju i brisanje** za obuhvaćene podatke.

Ključni zahtjevi iz outlinea:

| Zahtjev | Implementacija |
|---|---|
| **Deletion prevention** | Automatsko brisanje (lifecycle, retention politike) ne smije obrisati podatke pod holdom; korisnici ih ne smiju mijenjati ni brisati. U cloudu: S3 Object Lock legal hold, M365 litigation hold, eDiscovery hold. |
| **Authorized access** | Pristup podacima pod holdom imaju samo ovlaštene osobe (pravna služba, eDiscovery tim), uz logovanje. |
| Opseg | Identifikacija čuvara podataka (custodians), sistema, perioda, tipova podataka. |
| Obavještenje | Pisano obavještenje zaposlenima koji drže relevantne podatke. |
| Ukidanje | Hold se ukida formalno kada pravna služba odluči; tek tada nastavlja redovna retencija. |

Uloga cloud providera: customer mora znati može li provider tehnički sačuvati podatke (uključujući metapodatke), u kom formatu ih može predati i u kom roku. Ovo se definiše u ugovoru. **eDiscovery** (identifikacija, čuvanje, prikupljanje, obrada, pregled i predaja elektronskih dokaza; vidi **ISO/IEC 27050** i EDRM model) se detaljnije obrađuje u domenu 5 i 6.

> **Na ispitu:** ako se legal hold i retencijska politika sukobe, **legal hold ima prednost**. Brisanje podataka pod holdom (čak i automatsko, po politici) je **spoliation** dokaza i može imati teške pravne posljedice.

## Izvori i atributi događaja (2.8)

**Auditability** je mogućnost da se naknadno utvrdi šta se desilo, **traceability** da se radnja prati kroz sisteme do izvora, a **accountability** da se radnja veže za konkretnog odgovornog subjekta. Sve tri zahtijevaju dobro definisane događaje.

### Izvori događaja po modelu usluge

| Model | Šta customer može logovati | Šta zavisi od providera |
|---|---|---|
| **IaaS** | OS, aplikacije, baze, mrežni flow logovi, API pozivi control planea | Hypervisor, fizička mreža, data centar |
| **PaaS** | Aplikacijski logovi, pristup podacima, API pozivi | OS, runtime, platformske komponente |
| **SaaS** | Ono što provider izloži: audit log korisnika i administratora | Gotovo sve; vidljivost je najmanja |

Zbog toga je **dostupnost i granularnost logova** važan kriterij pri izboru providera i stavka ugovora (vrste logova, retencija, format, API za izvoz).

Tipični izvori događaja nad podacima: audit logovi control planea (AWS CloudTrail, Azure Activity Log), data access logovi (CloudTrail data events, S3 server access logs, database audit), IdP logovi prijava, DLP i CASB događaji, IRM audit trail, aplikacijski logovi.

### Obavezni atributi događaja

OWASP Logging Cheat Sheet daje praktičan okvir: **when, where, who, what**.

| Kategorija | Atributi |
|---|---|
| **When** | Vremenska oznaka u UTC sa vremenskom zonom, sinhronizovana (NTP); vrijeme događaja i vrijeme upisa |
| **Where** | Aplikacija, servis, host, region, URL ili API endpoint, **geolokacija** |
| **Who** | **Identitet korisnika** ili servisa (uključujući preuzetu rolu), **izvorna IP adresa**, uređaj, session ID |
| **What** | Tip događaja, akcija, objekt (koji podatak), rezultat (uspjeh/neuspjeh), ozbiljnost, razlog |

Geolokacija iz IP adrese je korisna za otkrivanje nemogućeg putovanja (impossible travel) i kršenja zahtjeva o lokaciji, ali je približna (VPN, proxy, NAT, cloud egress adrese). IP adresa sama po sebi nije identitet: iza NAT-a ili load balancera vidiš adresu uređaja na putu, pa treba logovati i `X-Forwarded-For` ili ekvivalent.

Šta **ne logovati**: lozinke, tokene sesija, ključeve, pune brojeve kartica, nepotrebne lične podatke. Logovi su i sami osjetljivi podaci i podliježu klasifikaciji, retenciji i GDPR-u.

> **Na ispitu:** zahtjev „moramo dokazati KO je pristupio podatku“ traži **jedinstvene identitete** (bez dijeljenih naloga) i logove sa identitetom, vremenom i objektom. Dijeljeni administratorski nalog uništava accountability bez obzira koliko je logova.

## Logovanje, pohrana i analiza (2.8)

| Faza | Dobra praksa |
|---|---|
| **Prikupljanje** | Centralizacija iz svih izvora i naloga; standardizovan format; sinhronizovano vrijeme. |
| **Prenos** | Šifrovano (TLS), sa potvrdom isporuke. |
| **Pohrana** | Poseban nalog ili projekat za logove (log archive), ograničen pristup, enkripcija, **nepromjenjivost** (WORM, Object Lock), **integritet** (hash lanci, digitalni potpisi; npr. CloudTrail log file validation). |
| **Retencija** | Po regulativi (npr. PCI DSS 12 mjeseci); hot i cold slojevi. |
| **Analiza** | **SIEM** za normalizaciju, korelaciju i alarmiranje; UEBA za anomalije; SOAR za automatski odgovor. |
| **Pristup** | Odvojen od administratora sistema koji se loguju (separation of duties), da administrator ne može brisati tragove. |

Tipični detekcijski slučajevi (use cases) nad događajima sa podacima:

| Slučaj | Signal u logovima |
|---|---|
| Masovno preuzimanje | Neuobičajeno velik broj GetObject/čitanja jednog identiteta u kratkom vremenu |
| Promjena dozvola | Bucket ili dijeljeni folder postao javan, nova eksterna dijeljenja |
| Gašenje logovanja | Zaustavljen trail, obrisana log grupa, promijenjena retencija |
| Brisanje ključa | Zakazano brisanje ili onemogućen ključ enkripcije |
| Pristup iz neočekivane lokacije | Geolokacija van dozvoljenih zemalja, nemoguće putovanje |
| Privilegovan pristup podacima | Administrator čita poslovne podatke van radnog vremena ili bez tiketa |

Događaj gašenja ili izmjene logovanja je sam po sebi visoko rizičan i treba ga alarmirati, jer napadači često prvo uklanjaju tragove.

Izazovi u cloudu: različiti formati između providera, trošak ingestije, kašnjenje isporuke logova, logovi u više regiona, ograničena vidljivost u SaaS-u, i to što provider kontroliše dio infrastrukture.

## Chain of custody i non-repudiation (2.8)

**Chain of custody** je dokumentovan, neprekinut zapis o tome ko je prikupio dokaz, kada, kako, ko ga je čuvao, prenosio i analizirao, i da dokaz nije izmijenjen. Bez njega dokaz može biti neprihvatljiv na sudu. Smjernice za identifikaciju, prikupljanje, akviziciju i očuvanje digitalnih dokaza daje **ISO/IEC 27037**.

Elementi chain of custody:

- jedinstvena identifikacija dokaza,
- ko je prikupio, kada, gdje i kojom metodom,
- **hash vrijednost** (npr. SHA-256) pri prikupljanju i pri svakoj predaji,
- svaka promjena čuvara dokumentovana i potpisana,
- sigurno čuvanje (fizički i logički kontrolisan pristup),
- rad na kopijama, original ostaje netaknut.

U cloudu je to teže: customer često ne može fizički prikupiti medij; snapshot diska, memorija i logovi se prikupljaju kroz API, a dio dokaza ima samo provider. Zato ugovor treba da definiše **saradnju providera u istragama** i način predaje dokaza.

**Non-repudiation** (neporecivost) znači da subjekt ne može uvjerljivo poreći da je izvršio radnju. Ostvaruje se kombinacijom:

| Mehanizam | Doprinos |
|---|---|
| **Digitalni potpis** (privatni ključ samo kod subjekta) | Dokazuje porijeklo i integritet |
| **Jaka autentifikacija** (MFA, jedinstveni nalozi) | Veže radnju za osobu |
| **Pouzdane vremenske oznake** (trusted timestamping) | Dokazuje kada |
| **Zaštićeni, nepromjenjivi logovi** | Dokaz se ne može naknadno izmijeniti |
| **Hashing** | Integritet, ali sam po sebi ne dokazuje porijeklo |

> **Na ispitu:** hash daje **integritet**, ali ne i non-repudiation, jer hash može izračunati bilo ko. Za neporecivost treba **digitalni potpis** (asimetrična kriptografija) uz pouzdan identitet. Simetrični MAC također ne daje neporecivost, jer ključ dijele obje strane.

## Zaštita AI/ML podataka (2.9)

AI sistemi imaju dva nova tipa imovine koje treba zaštititi: **skupove podataka** (training, validation, test, podaci za fine-tuning, RAG baze dokumenata, promptovi i odgovori) i **modele** (težine, arhitektura, hiperparametri, konfiguracija). Na njih se primjenjuju isti principi iz ovog domena (discovery, klasifikacija, lifecycle, logovanje), uz nove prijetnje.

Cloud data lifecycle primijenjen na AI:

| Faza | AI primjer | Ključna kontrola |
|---|---|---|
| Create | Prikupljanje i označavanje podataka, generisanje sintetičkih podataka | Pravni osnov, provenance, kvalitet labela |
| Store | Data lake sa skupovima, model registry, vektorska baza za RAG | Klasifikacija, enkripcija, IAM, verzionisanje |
| Use | Treniranje, fine-tuning, inference | Izolovana okruženja, logovanje, ograničenje upita |
| Share | Dijeljenje modela ili skupa sa partnerima, javni API | Ugovori, licence, filtriranje izlaza |
| Archive | Čuvanje verzija skupova i modela radi reproduktivnosti i revizije | Retencija, integritet, dokumentacija |
| Destroy | Povlačenje modela, brisanje skupova na zahtjev ispitanika | Brisanje svih kopija i izvedenih artefakata, crypto-shredding |

Važno: i **izvedeni artefakti** (embeddings u vektorskoj bazi, keš odgovora, logovi promptova, checkpointi treniranja) mogu sadržavati osjetljive podatke i moraju se klasifikovati jednako kao izvorni skup.

Relevantni okviri: **NIST AI RMF (AI 100-1)** sa funkcijama Govern, Map, Measure, Manage; **NIST AI 100-2** taksonomija napada na ML (adversarial machine learning); **ISO/IEC 42001** sistem upravljanja AI-jem; **OWASP Top 10 for LLM Applications**; **EU AI Act**, koji za visokorizične sisteme traži upravljanje podacima (kvalitet, reprezentativnost, porijeklo skupova podataka).

### Privatnost skupova podataka i modela

| Rizik | Opis |
|---|---|
| **PII u podacima za treniranje** | Lični podaci završe u skupu bez pravnog osnova ili mimo svrhe za koju su prikupljeni. |
| **Memorization / data leakage** | Model zapamti i reprodukuje dijelove podataka za treniranje (npr. lične podatke, tajne). |
| **Membership inference** | Napadač utvrđuje da li je određeni zapis bio u skupu za treniranje (npr. da je osoba bila pacijent). |
| **Model inversion** | Rekonstrukcija osjetljivih osobina iz izlaza modela. |
| **Model extraction / stealing** | Kopiranje funkcionalnosti modela kroz masovne upite; model je intelektualna svojina. |
| **Curenje kroz promptove** | Korisnici unose povjerljive podatke u eksterni AI servis koji ih čuva ili koristi za treniranje. |

Kontrole za privatnost:

- **data minimization** i **purpose limitation**: koristiti samo podatke potrebne za svrhu, uz pravni osnov (GDPR važi i za treniranje),
- **anonimizacija** i **pseudonimizacija** prije treniranja; maskiranje i tokenizacija,
- **differential privacy**: kontrolisani šum pri treniranju ograničava šta model otkriva o pojedincu,
- **synthetic data** umjesto stvarnih podataka gdje je moguće,
- **federated learning**: model se trenira lokalno, centralno se dijele samo ažuriranja,
- filtriranje izlaza (output filtering) i ograničenje broja upita (rate limiting) protiv extractiona,
- ugovori sa AI providerom: da li se podaci koriste za treniranje, retencija promptova, lokacija obrade,
- prava ispitanika: brisanje podataka iz skupa je moguće, ali iz već istreniranog modela teško (machine unlearning je nezreo), pa je minimizacija prije treniranja važnija.

### Sigurnost skupova podataka i modela

| Prijetnja | Opis | Kontrola |
|---|---|---|
| **Data poisoning** | Ubacivanje zlonamjernih ili pogrešnih podataka u skup da bi se promijenilo ponašanje modela (uključujući backdoor okidače) | Provenance, validacija, kontrola pristupa skupu, detekcija anomalija |
| **Model tampering** | Izmjena težina ili zamjena modela | Integritet (hash, **potpisivanje modela**), kontrolisan registry |
| **Supply chain** | Preuzeti pre-trained modeli i skupovi iz javnih izvora mogu biti kompromitovani; neki formati modela mogu izvršiti kod pri učitavanju | Pouzdani izvori, skeniranje, sigurni formati, **AI-BOM** |
| **Evasion / adversarial examples** | Ulazi napravljeni da prevare model u produkciji | Testiranje robusnosti, monitoring |
| **Prompt injection** (LLM) | Instrukcije u ulazu ili dokumentima koje mijenjaju ponašanje modela | Odvajanje podataka od instrukcija, filtriranje, minimalna ovlaštenja alata |
| **Neovlašten pristup** | Krađa skupa podataka ili težina iz storagea | Klasifikacija, enkripcija, IAM, logovanje |

**Validacija i verifikacija** su eksplicitno u outlineu:

| Pojam | Pitanje | Primjeri za podatke | Primjeri za modele |
|---|---|---|---|
| **Verification** | Da li je ono što imamo ispravno i nepromijenjeno, u skladu sa specifikacijom? („built right“) | Hash i potpis skupa, provjera porijekla (provenance), data lineage | Potpis i hash modela, provjera da je u produkciji odobrena verzija |
| **Validation** | Da li je podatak ili model prikladan za namjenu? („right thing“) | Provjera šeme, kvaliteta, reprezentativnosti, outliera, pristrasnosti (bias), duplikata | Testiranje tačnosti na odvojenom test skupu, testiranje robusnosti, **red teaming**, procjena fairnessa |

Praktično to izgleda kao MLOps pipeline sa sigurnosnim kapijama: podaci ulaze samo iz poznatih izvora, verzionišu se, hash se bilježi, automatska validacija odbija anomalije, model se testira i potpisuje prije objave u registry, a produkcija učitava samo potpisane verzije. **Model card** i **datasheet** dokumentuju namjenu, ograničenja i porijeklo podataka.

> **Na ispitu:** AI pitanja u CCSP-u su upravljačka: prvo **klasifikuj i inventariši** skupove podataka i modele kao imovinu, utvrdi **pravni osnov** za upotrebu ličnih podataka, i osiguraj **provenance i integritet** u lancu. Odgovor „isključiti sve AI servise“ ili „vjerovati provideru modela“ je rijetko najbolji.

## Česte zamke na ispitu

- „Obrisali smo objekte, dakle podaci su uništeni“: u cloudu ostaju replike, backupi i data remanence; tražiš crypto-shredding ili ugovornu sanitizaciju.
- „Degaussing za SSD“: ne radi; degaussing je samo za magnetne medije.
- „Arhiva = backup“: različita svrha, rok i pristup.
- „Retencija ima prednost nad legal holdom“: obrnuto je.
- „Hash obezbjeđuje neporecivost“: ne, samo integritet.
- „IP adresa identifikuje korisnika“: ne, identitet dolazi iz autentifikacije.
- „AI model je samo softver“: model i skup podataka su imovina koju treba klasifikovati, štititi i pratiti kroz lifecycle.

## Scenario: osiguravajuća kuća i retencija, audit i AI

Osiguravajuća kuća koristi cloud za obradu odštetnih zahtjeva i trenira model za otkrivanje prevara.

1. **Retencija**: politika određuje 10 godina za dokumentaciju polisa (domaći propis), 12 mjeseci za audit logove sistema sa platnim karticama (PCI DSS), a lične podatke odbijenih kandidata za posao briše nakon 6 mjeseci. Lifecycle politike automatski prebacuju stare predmete u archive tier.
2. **Arhiva**: arhive su šifrovane customer-managed ključevima čija retencija je jednaka retenciji arhive; godišnje se testira restore uzorka.
3. **Legal hold**: klijent najavljuje tužbu. Pravna služba stavlja hold na predmete i emailove uključenih zaposlenih; lifecycle brisanje za njih je suspendovano.
4. **Brisanje**: po isteku retencije podaci se brišu, a za cijeli projekat koji se gasi koristi se crypto-shredding namjenskog ključa.
5. **Audit**: svi pristupi predmetima logovani sa identitetom, IP adresom, geolokacijom i objektom, u nepromjenjivi log archive; SIEM alarmira na masovna preuzimanja.
6. **AI**: skup za treniranje je pseudonimizovan, porijeklo podataka dokumentovano, skup verzionisan i hashovan; model je validiran na test skupu i provjeren na pristrasnost, potpisan i objavljen u registry.

## Rezime

- Retenciju određuju **regulativa, ugovori i poslovne potrebe**; politika definiše rokove, formate, sigurnost, povrat, monitoring. Ne čuvaj duže nego što treba.
- **NIST SP 800-88 Rev. 2**: **clear, purge, destroy**; u cloudu customer realno može samo **crypto-shredding** (purge kroz cryptographic erase).
- Crypto-shredding traži enkripciju od početka, kontrolu nad ključem i uništenje **svih kopija ključa**.
- Arhiva nije backup; najveći rizici su izgubljeni ključevi i nečitljiv format; WORM za nepromjenjivost; testiraj restore.
- **Legal hold** suspenduje retenciju i brisanje, ima prednost nad politikom, počinje kada se spor razumno očekuje; pristup samo ovlaštenim osobama.
- Događaji moraju imati **when, where, who, what**: vrijeme (NTP), identitet, IP, geolokaciju, objekt i rezultat; ne loguj tajne.
- Logovi se centralizuju, štite od izmjene, odvajaju od administratora i analiziraju u SIEM-u.
- **Chain of custody** dokumentuje svaki korak rukovanja dokazom (ISO/IEC 27037); **non-repudiation** traži digitalni potpis i jak identitet, hash daje samo integritet.
- AI/ML: zaštiti skupove podataka i modele kao imovinu; privatnost (minimizacija, anonimizacija, differential privacy) i sigurnost (poisoning, tampering, supply chain); **verifikacija** = integritet i porijeklo, **validacija** = prikladnost za namjenu.
