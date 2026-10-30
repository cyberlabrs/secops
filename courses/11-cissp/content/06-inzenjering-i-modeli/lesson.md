## Ciljevi ispita: 3.1–3.5

Domen 3 (**Security Architecture and Engineering**) nosi oko **12,8%** ispita (u outlineu iz 2024. 13%). Ovaj modul pokriva prvih pet ciljeva; kriptografija je u sljedećem modulu, a objekti i životni ciklus sistema u modulu 08.

- **3.1 Research, implement, and manage engineering processes using secure design principles**
  - threat modeling, least privilege (PoLP), defense in depth (DiD), secure defaults, fail securely,
  - separation of duties (SoD), keep it simple and small, privacy by design (PETs),
  - shared responsibility, SASE, well-architected framework, rotation of duties, two-person integrity, Zero Trust (ZT).
- **3.2 Understand the fundamental concepts of security models** (npr. Biba, Star, Bell-LaPadula).
- **3.3 Select controls based upon systems security requirements.**
- **3.4 Understand security capabilities of information systems** (memory protection, TPM, HSM, encryption/decryption).
- **3.5 Assess and mitigate the vulnerabilities of security architectures, designs, and solution elements**
  - client-based, server-based, database, embedded, IoT, cryptographic, HPC sistemi,
  - microservices i containerization, OT i ICS, edge computing,
  - cloud (SaaS, IaaS, PaaS, serverless/FaaS), supply chain risk, virtualized, autonomous, quantum computing, distributed systems.

> U outlineu iz 2024. 3.1 nije imao well-architected framework, rotation of duties ni two-person integrity, a Zero Trust je glasio „Zero trust or trust but verify“. U 3.4 nije bilo HSM-a. U 3.5 microservices i containerization su bili odvojeni, serverless je bio posebna stavka, ICS bez OT, a supply chain risk, autonomous systems i quantum computing nisu postojali.

## Principi sigurnog dizajna (3.1)

Klasični izvor su **Saltzer i Schroeder** (1975) i NIST SP 800-160 (Systems Security Engineering). Principi se primjenjuju **od početka** (security by design), jer je ugradnja sigurnosti kasnije skuplja i slabija.

| Princip | Suština | Primjer |
|---|---|---|
| **Least privilege (PoLP)** | subjekt dobija minimum prava potreban za zadatak, minimum vremena | JIT pristup, servisni nalog samo sa read pravom na jedan bucket |
| **Defense in depth (DiD)** | više nezavisnih slojeva kontrola (administrativne, tehničke, fizičke) | WAF + validacija u aplikaciji + parametrizovani upiti + least privilege na bazi |
| **Secure defaults** | sistem je siguran „iz kutije“; korisnik mora svjesno oslabiti | zatvoreni portovi, isključeni nepotrebni servisi, bez default lozinki |
| **Fail securely (fail-safe/fail-secure)** | pri grešci sistem prelazi u sigurno stanje i ne otkriva informacije | firewall pri padu blokira saobraćaj; generička poruka greške |
| **Separation of duties (SoD)** | kritičan zadatak podijeljen na više osoba da jedna ne može sama izvršiti prevaru | ko kreira dobavljača ne odobrava plaćanje |
| **Keep it simple and small (KISS)** | manja i jednostavnija rješenja imaju manju površinu napada i lakše se verifikuju | mali security kernel, minimalni container image |
| **Privacy by design** | privatnost ugrađena u dizajn i default (7 principa Ann Cavoukian) | minimizacija, pseudonimizacija, PETs |
| **Shared responsibility** | podjela odgovornosti između provajdera i kupca (cloud, MSSP) | IaaS: kupac odgovara za OS, podatke, IAM |
| **SASE** | konvergencija mreže (SD-WAN) i sigurnosti (SWG, CASB, ZTNA, FWaaS) iz clouda | korisnici svuda dobijaju istu politiku blizu sebe |
| **Well-architected framework** | provajderski okviri najboljih praksi (AWS, Azure, GCP) sa stubom sigurnosti | review arhitekture prema Security pillaru |
| **Rotation of duties** | periodična promjena uloga; otkriva prevaru i smanjuje zavisnost od jedne osobe | rotacija administratora, obavezni godišnji odmor (mandatory vacation) |
| **Two-person integrity (TPI)** | dvije ovlaštene osobe moraju biti **istovremeno** prisutne za kritičnu radnju | otvaranje sefa sa ključevima, root ključ CA, lansiranje |
| **Zero Trust (ZT)** | nema implicitnog povjerenja na osnovu lokacije u mreži; svaki zahtjev se provjerava | NIST SP 800-207: PE/PA (PDP) odlučuju, PEP sprovodi |

Dodatni klasični principi: **complete mediation** (svaki pristup se provjerava), **economy of mechanism** (KISS), **open design** (sigurnost ne zavisi od tajnosti dizajna, Kerckhoffsov princip), **least common mechanism**, **psychological acceptability** (kontrola koju korisnici zaobilaze nije kontrola), **trust but verify** (stariji model: povjerenje uz naknadnu provjeru).

Razlike koje ispit testira:

- **SoD vs two-person integrity vs dual control vs split knowledge**: SoD dijeli **različite korake** procesa na različite osobe; TPI/dual control traži **dvije osobe za isti korak**; split knowledge znači da nijedna osoba ne zna cijelu tajnu (npr. polovine lozinke).
- **Fail-safe vs fail-secure**: kod fizičkih vrata **fail-safe** (fail-open) otključava pri nestanku struje radi zaštite ljudi, **fail-secure** (fail-closed) ostaje zaključano radi zaštite imovine. Kod evakuacionih izlaza **život je na prvom mjestu**: fail-safe.
- **Zero Trust komponente (NIST SP 800-207)**: **Policy Engine** (odluka), **Policy Administrator** (izvršava odluku, uspostavlja sesiju), zajedno **PDP**; **Policy Enforcement Point (PEP)** u data planeu. Ulazi: identitet, stanje uređaja, kontekst, threat intel.

### Privacy by design i PETs

Sedam principa (Cavoukian, osnova za GDPR čl. 25 „data protection by design and by default“):

1. proaktivno, ne reaktivno; preventivno, ne korektivno,
2. privatnost kao **podrazumijevana postavka** (default),
3. privatnost ugrađena u dizajn,
4. puna funkcionalnost: pozitivan zbir, ne nulti zbir (privatnost **i** sigurnost),
5. zaštita kroz cijeli životni ciklus (end-to-end),
6. vidljivost i transparentnost,
7. poštovanje privatnosti korisnika (user-centric).

**Privacy-enhancing technologies (PETs)**: pseudonimizacija i tokenizacija, anonimizacija (k-anonymity, l-diversity), **differential privacy** (kontrolisani šum u agregatnim rezultatima), **homomorfno šifrovanje** (računanje nad šifrovanim podacima), **secure multi-party computation**, **zero-knowledge proofs**, federated learning, confidential computing.

### Shared responsibility

| Sloj | On-prem | IaaS | PaaS | SaaS |
|---|---|---|---|---|
| Podaci, klasifikacija, pristup korisnika | kupac | kupac | kupac | kupac |
| Aplikacija | kupac | kupac | kupac | provajder |
| OS, middleware, runtime | kupac | kupac | provajder | provajder |
| Virtualizacija, hardver, mreža | kupac | provajder | provajder | provajder |
| Fizička sigurnost data centra | kupac | provajder | provajder | provajder |

Kupac **uvijek** ostaje odgovoran za podatke, identitete i pristup, i **ne može prenijeti odgovornost (accountability)** na provajdera, samo izvršenje dijela kontrola.

### SASE i Zero Trust u praksi

**SASE** (Gartner, 2019) spaja **SD-WAN** sa **Security Service Edge (SSE)**: **SWG** (secure web gateway), **CASB**, **ZTNA** (zamjena za klasični VPN), **FWaaS**, često DLP i RBI. Prednost: ista politika za korisnika u kancelariji, kod kuće i na putu, sprovedena u najbližoj PoP tački provajdera.

Zero Trust principi (NIST SP 800-207): svi izvori podataka i servisi su resursi; komunikacija se štiti bez obzira na lokaciju u mreži; pristup se odobrava **po sesiji**; odluka je **dinamična** (identitet, uređaj, ponašanje, kontekst); organizacija prati integritet i stanje svih uređaja; autentifikacija i autorizacija su strogo sprovedene prije pristupa; prikuplja se što više informacija za poboljšanje politike. ZT nije proizvod nego **arhitektura i strategija**; mikrosegmentacija, jaka autentifikacija (MFA), provjera stanja uređaja i least privilege su njeni gradivni blokovi.

> **Na ispitu:** Kada pitanje traži kontrolu protiv prevare jedne osobe u procesu plaćanja, odgovor je **separation of duties**. Kada traži otkrivanje već postojeće prevare, često je odgovor **rotation of duties** ili **mandatory vacation** (prevara izlazi na vidjelo kada druga osoba preuzme posao). Kada traži da dvije osobe zajedno izvrše jednu kritičnu radnju, odgovor je **two-person integrity / dual control**.

### Threat modeling

Threat modeling je strukturisano otkrivanje prijetnji u dizajnu, **što ranije** u životnom ciklusu i ponovo pri značajnim promjenama. Opšta pitanja (Shostack): šta gradimo, šta može poći naopako, šta ćemo uraditi, jesmo li dobro uradili.

| Metodologija | Fokus | Ključno |
|---|---|---|
| **STRIDE** (Microsoft) | kategorije prijetnji po elementu DFD-a | **S**poofing (autentifikacija), **T**ampering (integritet), **R**epudiation (neporecivost), **I**nformation disclosure (povjerljivost), **D**enial of service (dostupnost), **E**levation of privilege (autorizacija) |
| **PASTA** | rizik-centrična, 7 faza, od poslovnih ciljeva do analize napada | povezuje prijetnje sa poslovnim uticajem |
| **DREAD** | rangiranje: Damage, Reproducibility, Exploitability, Affected users, Discoverability | subjektivno, danas manje korišteno |
| **VAST** | skalabilno, agilno, za velike organizacije | procesni i aplikacioni modeli |
| **Attack trees** | cilj napadača u korijenu, putevi kao grane | dobro za analizu alternativnih puteva |
| **LINDDUN** | prijetnje privatnosti | Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance |
| **MITRE ATT&CK** | taktike i tehnike stvarnih napadača | koristi se za validaciju i detekciju |

Proces: dekompozicija sistema (DFD, granice povjerenja/trust boundaries, ulazne tačke), identifikacija prijetnji, rangiranje, mitigacija (izbjeći, ublažiti, prenijeti, prihvatiti), validacija.

## Modeli sigurnosti (3.2)

Modeli su formalni opisi pravila kojima se sprovodi politika. **Politika** kaže šta se želi, **model** formalno opisuje kako, a **mehanizam** (npr. reference monitor) to sprovodi.

### Osnovni koncepti

- **State machine model**: sistem je siguran ako počinje u sigurnom stanju i svaki prelaz vodi u sigurno stanje (osnova za BLP i Bibu).
- **Information flow model**: kontroliše tokove između nivoa; otkriva i **covert channels**.
- **Noninterference model** (Goguen-Meseguer): radnje subjekta na višem nivou ne smiju biti vidljive niti uticati na subjekte nižeg nivoa.
- **Lattice-based model**: subjekti i objekti imaju oznake u rešetki (nivo + kategorije/compartments); pristup je određen najmanjom gornjom i najvećom donjom granicom.

### Bell-LaPadula (BLP), povjerljivost

Razvijen za vojsku SAD (1973), štiti **samo povjerljivost**, sprovodi **MAC**.

| Pravilo | Formulacija | Mnemonik |
|---|---|---|
| **Simple Security Property** | subjekt ne smije čitati objekat višeg nivoa | **no read up** |
| **\* (Star) Security Property** | subjekt ne smije pisati u objekat nižeg nivoa | **no write down** (sprečava curenje naniže) |
| **Strong Star Property** | čitanje i pisanje samo na svom nivou | read/write same level |
| **Discretionary Security Property** | dodatno, matrica pristupa (need to know) | DAC unutar MAC-a |

Ograničenja: ne štiti integritet ni dostupnost, ne rješava covert channels; **tranquility** princip (oznake se ne mijenjaju tokom rada) i dozvoljena uloga **trusted subject** za deklasifikaciju.

### Biba, integritet

Biba (1977) je „naopaki“ BLP i štiti **integritet**.

| Pravilo | Formulacija | Mnemonik |
|---|---|---|
| **Simple Integrity Property** | subjekt ne smije čitati objekat nižeg integriteta | **no read down** (ne zagađuj se nepouzdanim podacima) |
| **\* (Star) Integrity Property** | subjekt ne smije pisati u objekat višeg integriteta | **no write up** |
| **Invocation Property** | subjekt ne smije pozivati (invoke) subjekat višeg integriteta | no call up |

> **Na ispitu:** „Star“ iz outlinea odnosi se na **\* svojstva** (Star property) koja definišu pravila pisanja. Zapamti: „**simple** = čitanje, **star** = pisanje“. BLP: no read up, no write down (**povjerljivost**). Biba: no read down, no write up (**integritet**). Ako pitanje kaže da analitičar ne smije koristiti podatke sa interneta da bi ažurirao zvaničnu bazu, to je Biba.

### Ostali modeli

| Model | Štiti | Suština |
|---|---|---|
| **Clark-Wilson** | integritet (komercijalni) | subjekt pristupa objektu **samo preko programa**: **CDI** (constrained data item), **UDI** (unconstrained), **TP** (transformation procedure, well-formed transaction), **IVP** (integrity verification procedure); access triple subjekt-program-objekat; ugrađen **SoD** i audit; adresira sva tri cilja integriteta |
| **Brewer-Nash (Chinese Wall)** | sukob interesa | prava se **dinamički** mijenjaju na osnovu ranijih pristupa: ko je vidio podatke banke A ne smije vidjeti podatke konkurentske banke B (konsultantske firme, revizija) |
| **Graham-Denning** | sigurno kreiranje/brisanje subjekata i objekata i dodjela prava | 8 zaštitnih pravila (create/delete object, create/delete subject, read/grant/delete/transfer access right) |
| **Harrison-Ruzzo-Ullman (HRU)** | integritet prava pristupa | proširuje Graham-Denning; pokazuje da je opšte pitanje sigurnosti (safety problem) neodlučivo |
| **Take-Grant** | propagacija prava | usmjereni graf sa pravilima take, grant, create, remove |
| **Lipner** | povjerljivost + integritet | kombinuje BLP i Bibu za komercijalna okruženja |
| **Sutherland** | integritet | zasnovan na noninterference i state machine, sprečava interferenciju |

### Primjer: odluke po BLP i Biba modelu

Subjekt ima nivo **Secret** (BLP) odnosno srednji nivo integriteta (Biba).

| Radnja | Objekat | BLP (povjerljivost) | Biba (integritet) |
|---|---|---|---|
| čitanje | Top Secret / visok integritet | zabranjeno (no read up) | dozvoljeno |
| čitanje | Confidential / nizak integritet | dozvoljeno | zabranjeno (no read down) |
| pisanje | Top Secret / visok integritet | dozvoljeno (pisanje naviše, „blind write“) | zabranjeno (no write up) |
| pisanje | Confidential / nizak integritet | zabranjeno (no write down) | dozvoljeno |
| čitanje i pisanje | isti nivo | dozvoljeno (strong star: samo ovdje) | dozvoljeno |

Vidi se da su modeli **dualni**: ono što BLP dozvoljava, Biba zabranjuje. Zato organizacija koja štiti i povjerljivost i integritet ne može koristiti samo jedan od njih (Lipner ih kombinuje).

### Poređenje modela

| Model | Cilj | Tip | Ključna riječ u pitanju |
|---|---|---|---|
| Bell-LaPadula | povjerljivost | MAC, lattice, state machine | „vojska“, „curenje naniže“, „clearance“ |
| Biba | integritet | lattice, state machine | „kontaminacija pouzdanih podataka“ |
| Clark-Wilson | integritet | komercijalni, well-formed transactions | „samo kroz aplikaciju“, „računovodstvo“, „SoD“ |
| Brewer-Nash | sukob interesa | dinamički | „konkurenti“, „konsultant“ |
| Graham-Denning | upravljanje pravima | access matrix | „kreiranje i brisanje subjekata i objekata“ |
| Take-Grant | propagacija prava | graf | „prenos prava sa subjekta na subjekt“ |
| Noninterference | sprečavanje covert channels | information flow | „radnje na višem nivou ne utiču na niži“ |

Tri cilja integriteta (Clark-Wilson ih sve adresira, Biba samo prvi): sprečiti **neovlaštene** korisnike da mijenjaju podatke; sprečiti **ovlaštene** korisnike da prave neovlaštene izmjene; održati **unutrašnju i spoljnu konzistentnost**.

## Izbor kontrola na osnovu sigurnosnih zahtjeva (3.3)

Kontrole se biraju **iz zahtjeva**, a zahtjevi iz misije, procjene rizika, klasifikacije podataka i zakonskih obaveza. Tipičan tok (NIST RMF, SP 800-37):

1. **Prepare** (kontekst, uloge, strategija rizika).
2. **Categorize** sistem (FIPS 199: uticaj low/moderate/high na C, I, A; high-water mark).
3. **Select** kontrole (FIPS 200 + SP 800-53 baseline iz SP 800-53B, pa tailoring).
4. **Implement** kontrole i dokumentuj u sistemskom sigurnosnom planu (SSP).
5. **Assess** (nezavisna procjena efikasnosti).
6. **Authorize** (ovlašteni službenik, **Authorizing Official**, prihvata rezidualni rizik i izdaje **ATO**).
7. **Monitor** (kontinuirani monitoring).

### Certifikacija i akreditacija

- **Certification**: tehnička procjena da sistem ispunjava sigurnosne zahtjeve.
- **Accreditation (authorization)**: **formalna odluka menadžmenta** da prihvata rezidualni rizik i dozvoljava rad sistema. Akreditacija je odluka o riziku, ne tehnički test.

### Kriteriji evaluacije proizvoda

| Okvir | Status | Suština |
|---|---|---|
| **TCSEC (Orange Book)** | istorijski (SAD) | klase D, C1, C2, B1, B2, B3, A1; samo povjerljivost, samostalni sistemi |
| **ITSEC** | istorijski (Evropa) | odvaja funkcionalnost (F) i assurance (E0–E6) |
| **Common Criteria (ISO/IEC 15408)** | važeći međunarodni | **Protection Profile (PP)**: zahtjevi kupca za klasu proizvoda; **Security Target (ST)**: tvrdnje proizvođača; **Target of Evaluation (TOE)**: proizvod koji se ocjenjuje; **EAL1–EAL7** nivoi assurancea |

| EAL | Opis |
|---|---|
| EAL1 | functionally tested |
| EAL2 | structurally tested |
| EAL3 | methodically tested and checked |
| EAL4 | methodically designed, tested, and reviewed (najviši tipično ekonomičan za komercijalne proizvode) |
| EAL5 | semiformally designed and tested |
| EAL6 | semiformally verified design and tested |
| EAL7 | formally verified design and tested |

Važno: EAL mjeri **povjerenje u ispravnost** implementacije (assurance), ne „koliko je proizvod siguran“. Evaluacija važi samo za **evaluiranu konfiguraciju**. Za kriptografske module koristi se **FIPS 140-3**.

> **Na ispitu:** Kada se bira proizvod, PRVO se definišu **zahtjevi** (funkcionalni i sigurnosni, iz rizika), pa se tek onda gleda certifikat. Common Criteria EAL ne garantuje da proizvod odgovara tvom okruženju; to se provjerava upoređivanjem Security Targeta sa tvojim Protection Profileom ili zahtjevima.

## Sigurnosne sposobnosti informacionih sistema (3.4)

### Arhitektura zaštite

- **Trusted Computing Base (TCB)**: sav hardver, firmware i softver koji sprovodi sigurnosnu politiku. Mora biti što manji. **Security perimeter** je granica između TCB-a i ostatka sistema.
- **Reference monitor**: apstraktni koncept koji posreduje svaki pristup subjekta objektu. Mora biti **tamperproof**, **uvijek pozvan (complete mediation)** i **dovoljno mali da se verifikuje**.
- **Security kernel**: implementacija reference monitora u TCB-u.
- **Protection rings**: ring 0 (kernel), ring 1–2 (drajveri, OS servisi), ring 3 (korisničke aplikacije). Na x86 se u praksi koriste ring 0 i 3, a hipervizor radi u „ring −1“ (VMX root).
- **Režimi procesora**: supervisor (kernel) vs problem/user mode.

### Zaštita memorije i izolacija

| Mehanizam | Šta sprečava |
|---|---|
| **Process isolation** i virtualna memorija | proces ne vidi memoriju drugog procesa |
| **Memory segmentation / paging** sa dozvolama | izvršavanje ili pisanje van dodijeljenog prostora |
| **DEP / NX bit** | izvršavanje koda iz data stranica (stack, heap) |
| **ASLR** | predvidljive adrese za exploit |
| **Stack canaries, CFI** | preusmjeravanje toka izvršavanja |
| **Data hiding, abstraction, layering** | direktan pristup unutrašnjim strukturama |
| **IOMMU** | DMA napade sa periferija |

### Hardverske sigurnosne sposobnosti

| Komponenta | Namjena | Ključno za ispit |
|---|---|---|
| **TPM** (Trusted Platform Module, ISO/IEC 11889) | čip na matičnoj ploči ili firmware; **root of trust** platforme | **PCR** registri čuvaju mjerenja boot lanca (**measured boot**); **sealing** veže ključ za stanje sistema (BitLocker); **remote attestation**; endorsement key jedinstven po čipu |
| **HSM** (Hardware Security Module) | namjenski uređaj (ili cloud servis) za generisanje, čuvanje i korištenje ključeva | ključevi **ne napuštaju** HSM u čistom obliku; tamper-evident/tamper-responsive; **FIPS 140-3** nivoi 1–4; CA root ključevi, platne transakcije, KMS |
| **Secure enclave / TEE** | izolovano izvršavanje u CPU-u (Intel SGX/TDX, AMD SEV, ARM TrustZone, Apple Secure Enclave) | zaštita **data in use**; confidential computing |
| **Secure boot / UEFI** | provjerava potpis bootloadera i kernela | **secure boot** blokira nepotpisano; **measured boot** bilježi u TPM za kasniju provjeru |
| **Kriptografski akceleratori** (AES-NI) | hardversko šifrovanje/dešifrovanje | omogućava FDE i TLS bez značajnog pada performansi |
| **Self-encrypting drive (SED)**, Opal | šifrovanje u kontroleru diska | brz crypto erase |

**Encryption/decryption kao sposobnost sistema**: sistem treba da podržava šifrovanje at rest (FDE, TDE), in transit (TLS/IPsec), upravljanje ključevima kroz TPM/HSM/KMS i odvojenost ključeva od podataka. Detalji algoritama su u modulu 07.

**TPM vs HSM**: TPM je jeftin, vezan za jednu platformu, služi integritetu platforme i zaštiti ključeva tog uređaja. HSM je namjenski, visokih performansi, za centralno upravljanje mnogo ključeva i kriptografske operacije za mnoge aplikacije.

### Ostale sposobnosti

- **Virtualizacija i hipervizori** (Type 1 bare-metal, Type 2 hosted) za izolaciju.
- **Fault tolerance** i redundansa (RAID, klasteri).
- **Interfejsi**: ograničeni interfejsi (constrained UI), API gateway kao kontrolna tačka.
- **Security modes of operation** (klasika): **dedicated** (svi imaju clearance, odobrenje i need to know za sve), **system high** (clearance i odobrenje za sve, need to know ne za sve), **compartmented** (clearance za sve, odobrenje i need to know samo za dio), **multilevel** (različiti clearancei, sistem sprovodi razdvajanje, zahtijeva pouzdan TCB).

> **Na ispitu:** Ako scenarij traži dokaz da server nije pokrenut sa izmijenjenim bootloaderom ili kernelom, odgovor je **TPM sa measured bootom i remote attestationom**. Ako traži centralno, FIPS-validirano čuvanje root CA ključa ili ključeva za platne transakcije, odgovor je **HSM**.

## Ranjivosti arhitektura i mitigacije (3.5)

### Opšte ranjivosti koje se ponavljaju

- **Covert channels**: **storage** (informacija kroz zajednički resurs, npr. postojanje fajla) i **timing** (kroz vremenske obrasce). Mitigacija: analiza toka informacija, ograničavanje dijeljenih resursa, noise.
- **TOCTOU / race condition**: stanje se promijeni između provjere i upotrebe. Mitigacija: atomične operacije, zaključavanje.
- **Maintenance hooks / backdoors**: skriveni pristup ostavljen od razvojnog tima. Mitigacija: code review, uklanjanje prije produkcije.
- **Emanations**: elektromagnetno zračenje; **TEMPEST** standardi, Faradejev kavez, white noise, kontrolne zone.
- **Aggregation i inference** (baze): spajanje podataka niže klasifikacije daje informaciju više klasifikacije.

### Pregled sistema

| Sistem | Tipične ranjivosti | Mitigacije |
|---|---|---|
| **Client-based** (endpoint, desktop, mobilni) | malware, zastarjele aplikacije i pluginovi, lokalno keširani podaci, applets, phishing | hardening, EDR, patchovanje, least privilege (bez lokalnog admina), FDE, allowlisting, MDM |
| **Server-based** | nepotrebni servisi, pogrešna konfiguracija, ranjivi web/app serveri, data flow kontrola | CIS benchmarks, minimalna instalacija, segmentacija, patch i config management, WAF |
| **Database systems** | **aggregation**, **inference**, SQL injection, pretjerana prava, neshifrovani backupi | **polyinstantiation** (više verzija zapisa po nivoima), **views**, cell suppression, noise/perturbation, parametrizovani upiti, TDE, DAM; **ACID** (atomicity, consistency, isolation, durability) za integritet transakcija |
| **Cryptographic systems** | slabi ili zastarjeli algoritmi, loša implementacija, loše upravljanje ključevima, slab RNG | validirane biblioteke (FIPS 140-3), crypto agility, KMS/HSM, ne praviti sopstvenu kriptografiju |
| **IoT** | default lozinke, nema zakrpa, nesiguran update, nešifrovana komunikacija, slab fizički dizajn | segmentacija (zaseban VLAN), promjena kredencijala, nabavka od proizvođača sa politikom podrške, potpisani update |
| **Embedded systems** (firmware, RTOS, automobili, medicinski uređaji) | dug životni vijek, teško patchovanje, ograničeni resursi, izložen debug (JTAG) | secure boot, potpisan firmware, isključen debug, mrežna izolacija, **wrapper** i statički okruženja |
| **Microservices i containerization** | velika površina API-ja, east-west saobraćaj, ranjivi image-i, privilegovani kontejneri, dijeljeni kernel, tajne u image-u | API gateway, **mTLS i service mesh**, skeniranje image-a i SBOM, non-root, read-only fs, seccomp/AppArmor, network policies, secrets manager |
| **HPC** (klasteri, grid) | performanse ispred sigurnosti, dijeljeni resursi, mnogo korisnika, brzi interkonekt bez kontrola | segmentacija, stroga autentifikacija, nadzor job schedulera, izolacija namespacea |
| **OT i ICS** (SCADA, DCS, PLC, RTU, HMI) | legacy protokoli bez autentifikacije (Modbus, DNP3), dug životni vijek, dostupnost i bezbjednost ljudi ispred povjerljivosti, konvergencija IT/OT | **Purdue model** i segmentacija zona i kanala (**ISA/IEC 62443**), DMZ između IT i OT, data diode, pasivni monitoring, strog change management |
| **Edge computing** (i fog) | fizički nezaštićene lokacije, mnogo distribuiranih čvorova, ograničeno upravljanje | zero-touch provisioning, šifrovanje, centralno upravljanje i attestation, fizička zaštita |
| **Cloud: IaaS / PaaS / SaaS** | pogrešna konfiguracija, IAM greške, nerazumijevanje shared responsibility modela, multi-tenancy | CSPM/CNAPP, IaC skeniranje, least privilege, logovanje (CloudTrail), ugovori i SLA |
| **Serverless / FaaS** | pretjerana prava funkcije, event injection, ranjive zavisnosti, kratkoživući resursi teški za monitoring | per-funkcija IAM uloga, validacija događaja, SCA, centralizovani logovi, timeouts i limiti |
| **Virtualized systems** | **VM escape**, **VM sprawl**, ranjiv hipervizor, napuštene slike sa podacima, inter-VM saobraćaj | patchovanje hipervizora, upravljanje životnim ciklusom VM-ova, separacija upravljačke mreže, mikrosegmentacija |
| **Distributed systems** | konzistentnost, autentifikacija između čvorova, više tačaka napada, teža forenzika | mTLS, centralni identitet, sinhronizovano vrijeme, konsenzus protokoli, centralni logovi |
| **Autonomous systems** (dronovi, autonomna vozila, robotika, AI agenti) | manipulacija senzorima (spoofing GPS, adversarial ulazi), nepredvidive odluke, bezbjednost ljudi | human-in-the-loop/on-the-loop, fail-safe ponašanje, validacija senzora (fuzija), ograničen domen djelovanja, testiranje i nadzor modela |
| **Quantum computing** | prijetnja asimetričnoj kriptografiji (Shor) i oslabljivanje simetrične (Grover); **harvest now, decrypt later** | inventar kriptografije, **crypto agility**, migracija na **PQC** (NIST FIPS 203/204/205), duži simetrični ključevi (AES-256) |
| **Supply chain risk** | kompromitovan hardver, firmware ili softver dobavljača, krivotvorene komponente, ranjive zavisnosti | SCRM program, procjena dobavljača, **SBOM**, potpisani artefakti (SLSA), provjera porijekla, ugovorni zahtjevi, pouzdani distributeri |

> **Na ispitu:** Kod OT/ICS sistema prioritet je **dostupnost i bezbjednost ljudi** (safety), ne povjerljivost. Agresivno skeniranje ili automatsko patchovanje PLC-a u radu može izazvati prekid i fizičku štetu. NAJBOLJI odgovor je obično **segmentacija i pasivni monitoring** uz pažljivo planirane promjene.

### OT/ICS i Purdue model

| Nivo | Sadržaj |
|---|---|
| 5 | enterprise mreža, internet pristup |
| 4 | poslovna logistika (ERP, email) |
| 3.5 | **IT/OT DMZ** (historian replika, jump hostovi, patch server) |
| 3 | operacije pogona (historian, MES, inženjerske stanice) |
| 2 | nadzor procesa (**HMI**, **SCADA** serveri) |
| 1 | osnovna kontrola (**PLC**, **RTU**, DCS kontroleri) |
| 0 | fizički proces (senzori, aktuatori, ventili, motori) |

Saobraćaj između IT i OT ne smije ići direktno; sve prolazi kroz DMZ (nivo 3.5). **ISA/IEC 62443** uvodi **zones and conduits** i nivoe sigurnosti (SL 1–4). Prioritet trijade u OT okruženju je obrnut: **A-I-C** (plus safety), za razliku od IT gdje se često naglašava C.

### Cloud modeli i serverless

| Model | Kupac kontroliše | Ključni rizici na strani kupca |
|---|---|---|
| **IaaS** | OS, mrežna pravila, aplikacije, podatke | nezakrpljeni OS, otvoreni security groupovi, javni snapshoti |
| **PaaS** | aplikaciju, konfiguraciju servisa, podatke | slaba konfiguracija servisa, tajne u kodu, prava |
| **SaaS** | korisnike, konfiguraciju tenanta, podatke | pretjerano dijeljenje, slab IAM/SSO, shadow IT |
| **Serverless / FaaS** | kod funkcije, okidače, IAM ulogu | pretjerana prava, injection kroz događaje, ranjive zavisnosti |

Zajednička tema: najveći broj incidenata u cloudu potiče od **pogrešne konfiguracije i IAM grešaka kupca**, ne od proboja provajdera.

### Baze podataka: aggregation, inference, polyinstantiation

- **Aggregation**: korisnik sa pravom da vidi pojedinačne podatke niže klasifikacije spaja ih i dobija informaciju više klasifikacije (npr. lokacije pojedinačnih jedinica daju raspored snaga).
- **Inference**: korisnik **zaključuje** povjerljivu informaciju iz dostupnih podataka (npr. budžet odjeljenja minus poznate plate daje platu direktora).
- **Polyinstantiation**: isti primarni ključ ima različite zapise za različite nivoe klasifikacije, pa korisnik nižeg nivoa ne može zaključiti da postoji tajni zapis.
- Kontrole: kontekstno zavisna kontrola pristupa, views, cell suppression, partitioning, noise and perturbation.

### Virtualizacija i kontejneri

| Aspekt | VM | Kontejner |
|---|---|---|
| Izolacija | hipervizor, zaseban kernel | dijeljeni kernel hosta (namespaces, cgroups) |
| Glavni rizik | VM escape, sprawl | container escape kroz kernel, privilegovani kontejner, ranjiv image |
| Kontrole | patch hipervizora, segmentacija | non-root, seccomp, read-only, image scanning, admission control |

Sandboxovane varijante (gVisor, Kata Containers, Firecracker microVM) daju kontejnerima izolaciju bližu VM-u.

## Scenariji

**Scenarij 1: konsultantska firma.** Konsultant je radio za Banku A; firma dobija posao od konkurentske Banke B. Koji model sprječava da isti konsultant pristupi podacima Banke B? **Brewer-Nash**, jer se prava mijenjaju dinamički na osnovu prethodnog pristupa.

**Scenarij 2: računovodstvo.** Korisnici ne smiju direktno mijenjati tabelu glavne knjige; sve izmjene idu kroz aplikaciju koja provjerava pravila, a periodično se pokreće provjera konzistentnosti. To je **Clark-Wilson** (TP i IVP, pristup samo preko programa).

**Scenarij 3: pametne kamere.** Kancelarija je kupila IP kamere sa fabričkim lozinkama koje proizvođač ne ažurira. Najbolji korak: zasebna mrežna zona bez pristupa internetu i korporativnoj mreži, promjena lozinki, a ubuduće nabavka uz sigurnosne zahtjeve i politiku podrške.

**Scenarij 4: CA ključ.** Root CA ključ mora biti zaštićen tako da ga nijedna osoba ne može sama upotrijebiti. Kombinacija: **HSM** + **M-of-N kontrola** (dual control/two-person integrity) + offline root.

## Brzi pregled pojmova

| Pojam | Jedna rečenica |
|---|---|
| Reference monitor | apstraktni koncept koji posreduje svaki pristup; tamperproof, uvijek pozvan, verifikabilan |
| Security kernel | implementacija reference monitora |
| TCB | sve komponente koje sprovode politiku; što manje, to bolje |
| Tranquility | oznake subjekata i objekata se ne mijenjaju tokom rada (BLP) |
| Polyinstantiation | više zapisa sa istim ključem na različitim nivoima, protiv inference |
| Covert channel | tok informacija mimo politike (storage ili timing) |
| TOCTOU | promjena stanja između provjere i upotrebe |
| PCR | registar u TPM-u sa mjerenjima boot lanca |
| EAL | nivo povjerenja u evaluaciju (1–7), ne mjera sigurnosti |
| ATO | formalno ovlašćenje za rad sistema uz prihvaćeni rezidualni rizik |
| VM sprawl | nekontrolisano umnožavanje VM-ova bez vlasnika i patchovanja |
| Harvest now, decrypt later | današnji šifrovani saobraćaj se snima za dešifrovanje kvantnim računarom |

## Rezime

- Principi sigurnog dizajna: least privilege, defense in depth, secure defaults, fail securely, SoD, KISS, privacy by design, shared responsibility, SASE, well-architected, rotation of duties, two-person integrity, Zero Trust (PDP/PEP po NIST SP 800-207).
- Threat modeling se radi rano i ponavlja: STRIDE (kategorije), PASTA (rizik), DREAD (rangiranje), attack trees, LINDDUN (privatnost).
- **BLP** (povjerljivost): no read up, no write down. **Biba** (integritet): no read down, no write up. **Simple = čitanje, star = pisanje.** Clark-Wilson: pristup samo kroz TP, CDI/UDI/IVP, SoD. Brewer-Nash: sukob interesa, dinamička prava. Graham-Denning i HRU: upravljanje pravima.
- Kontrole se biraju iz zahtjeva i rizika (RMF: categorize, select, implement, assess, authorize, monitor); akreditacija je **odluka menadžmenta** o prihvatanju rizika. Common Criteria: PP, ST, TOE, EAL1–7 (assurance, ne „sigurnost“).
- Sposobnosti sistema: TCB, reference monitor (tamperproof, uvijek pozvan, verifikabilan), rings, zaštita memorije, **TPM** (root of trust, measured boot, sealing, attestation), **HSM** (FIPS 140-3, ključevi ne izlaze), TEE.
- Ranjivosti po tipovima sistema i njihove mitigacije; posebno: aggregation/inference/polyinstantiation u bazama, OT/ICS gdje je safety prioritet, VM escape i sprawl, kontejneri sa dijeljenim kernelom, kvantna prijetnja i crypto agility, supply chain sa SBOM-om.
