## Ciljevi ispita: 1.3 i 1.4

Ovaj modul pokriva drugi dio Domena 1 (**Cloud Concepts, Architecture and Design**, oko 17%):

- **1.3 Understand security concepts relevant to cloud computing**
  - kriptografija i upravljanje ključevima,
  - identitet i kontrola pristupa (user access, privilege access, service access),
  - sanitizacija podataka i medija (overwriting, cryptographic erase),
  - mrežna sigurnost (network security groups, traffic inspection, geofencing),
  - sigurnost virtualizacije (hypervisor, kontejneri, ephemeral computing, serverless, izolacija),
  - česte cloud prijetnje,
  - sigurnosna higijena (patching, baselining, immutable architecture, hardening).
- **1.4 Understand design principles of secure cloud computing**
  - cloud secure data lifecycle,
  - cloud BC i DR planiranje,
  - Business Impact Analysis (Cost-Benefit Analysis, ROI),
  - funkcionalni sigurnosni zahtjevi (portability, interoperability, vendor lock-in),
  - sigurnosna razmatranja i odgovornosti po kategorijama (SaaS, PaaS, IaaS),
  - cloud design patterns (SANS security principles, Well-Architected Framework, CSA Enterprise Architecture, secure by design),
  - DevOps security.

U 1.3 su temelji koje kasnije domene produbljuju (kriptografija u 2.3, IAM u 4.7, mreža u 3.x). U 1.4 ISC2 traži razmišljanje arhitekte: kako od poslovnih zahtjeva i rizika doći do dizajna.

## Kriptografija i upravljanje ključevima

Šifrovanje u cloudu štiti podatke u tri stanja:

| Stanje | Kontrola | Primjer |
|---|---|---|
| **Data at rest** | šifrovanje storagea, baza, backupa | AES-256 sa ključem iz KMS-a |
| **Data in transit** | TLS 1.2/1.3, IPsec VPN, MACsec | HTTPS do API-ja, VPN do VPC-a |
| **Data in use** | confidential computing (TEE), homomorfna enkripcija (istraživački) | Nitro Enclaves, SEV-SNP |

Snaga šifrovanja zavisi od **upravljanja ključevima**, ne od algoritma. Ključno pitanje na ispitu je: **ko kontroliše ključeve?**

| Model | Ko generiše i drži ključ | Kontrola customera | Kada se bira |
|---|---|---|---|
| Provider-managed keys | CSP, potpuno transparentno | najmanja | osnovna zaštita, niski zahtjevi |
| **Customer-managed keys (CMK)** u KMS-u | KMS provajdera, customer upravlja politikama, rotacijom, brisanjem | srednja/velika | većina regulisanih workloada |
| **Bring Your Own Key (BYOK)** | customer generiše u svom HSM-u i uvozi u KMS | velika | zahtjev da ključ nastane van CSP-a |
| **Hold Your Own Key (HYOK)** / external key store | ključ nikad ne napušta HSM customera | najveća | najstroži regulatorni zahtjevi, suverenitet |

Životni ciklus ključa: **generisanje → distribucija → skladištenje → korištenje → rotacija → arhiviranje → uništavanje**. Principi:

- ključeve čuvati **odvojeno od podataka** koje štite,
- koristiti **HSM** validiran po **FIPS 140-2/140-3** za korijenske ključeve,
- **separation of duties**: administrator ključeva ne treba imati pristup podacima i obrnuto,
- **envelope encryption**: podaci se šifruju ključem podataka (**DEK**), a DEK ključem za šifrovanje ključeva (**KEK**) koji ne napušta KMS.

> **Na ispitu:** kada scenario naglašava da organizacija mora moći **odmah opozvati pristup provajdera podacima** ili ispuniti zahtjev da ključevi budu **pod isključivom kontrolom customera**, traži BYOK/HYOK ili eksterni key store. Provider-managed ključ šifruje podatke, ali ne daje customeru kontrolu.

## Identitet i kontrola pristupa

Outline razlikuje tri vrste pristupa:

| Vrsta | Ko | Ključne kontrole |
|---|---|---|
| **User access** | zaposleni, partneri, korisnici | federacija (SAML, OIDC), SSO, MFA, RBAC/ABAC, periodične revizije |
| **Privilege access** | administratori clouda i aplikacija | **PAM**, just-in-time i just-enough pristup, MFA otporan na phishing, snimanje sesija, break-glass nalozi |
| **Service access** | aplikacije, funkcije, CI/CD pipeline | role i workload identiteti umjesto statičnih ključeva, kratkotrajni tokeni, rotacija tajni |

Principi koji se ponavljaju kroz cijeli ispit:

- **Least privilege**: samo onoliko prava koliko je potrebno, samo dok je potrebno.
- **Separation of duties**: nijedna osoba ne kontroliše cijeli kritični proces.
- **Need to know**: pristup informacijama samo ako ih posao zahtijeva.
- **Zero trust**: nema implicitnog povjerenja na osnovu mrežne lokacije; svaki zahtjev se autentifikuje i autorizuje.

U cloudu je **identitet novi perimetar**: management plane je dostupan sa interneta, pa su kompromitovani kredencijali najčešći uzrok ozbiljnih incidenata.

> **Na ispitu:** za pristup aplikacije drugom servisu NAJBOLJI odgovor je gotovo uvijek **rola / managed identity sa privremenim kredencijalima**, a ne dugotrajni pristupni ključ, čak ni ako je „šifrovan i rotiran svakih 90 dana“.

## Sanitizacija podataka i medija

U cloudu customer **nema fizički pristup** diskovima: ne može ih degausirati ni uništiti. Zato se oslanja na:

| Metoda | Opis | Primjenjivost u cloudu |
|---|---|---|
| **Overwriting** (clearing) | prepisivanje podataka nulama ili nasumičnim podacima | ograničeno: customer ne kontroliše fizičke blokove, SSD wear leveling i replike |
| **Cryptographic erase (crypto-shredding)** | uništavanje ključa kojim su podaci šifrovani; podaci postaju neupotrebljivi | **primarna metoda za customera** u cloudu |
| **Degaussing** | magnetsko brisanje medija | samo CSP, za magnetne medije; ne radi na SSD-u |
| **Fizičko uništavanje** (shredding, drobljenje, spaljivanje) | uništenje medija | radi ga CSP u data centru, dokazuje se audit izvještajima |

Referenca je **NIST SP 800-88 Rev. 1** (Guidelines for Media Sanitization), sa kategorijama **Clear, Purge, Destroy**. Cryptographic erase je u NIST-u vrsta purge metode.

Da bi crypto-shredding bio validan:

1. podaci moraju biti šifrovani **od prvog upisa** (uključujući backupe i replike),
2. ključ mora postojati samo na kontrolisanim mjestima (bez nešifrovanih kopija),
3. uništenje ključa mora biti zabilježeno (audit trail) i nepovratno nakon perioda čekanja.

> **Na ispitu:** „Organizacija napušta javnog provajdera i mora osigurati da njeni podaci ne mogu biti povraćeni. Koja metoda je NAJBOLJA?“ Odgovor je **cryptographic erasure**. Degaussing i fizičko uništavanje nisu u kontroli customera u multi-tenant okruženju.

## Mrežna sigurnost

| Kontrola | Opis | Napomena |
|---|---|---|
| **Network Security Groups / security grupe** | stateful virtualni firewall na nivou instance ili interfejsa | default deny inbound, pravila po portu i izvoru |
| Network ACL | stateless filter na nivou podmreže | dodatni sloj (defense in depth) |
| **Traffic inspection** | IDS/IPS, NGFW, WAF, TLS inspekcija, VPC traffic mirroring | u cloudu se često radi u centralnom „inspection VPC-u“ |
| **Geofencing** | ograničavanje pristupa ili rada prema geografskoj lokaciji | blokada zemalja na WAF/CDN-u, uslovni pristup po lokaciji, ograničenje regiona za podatke |
| Mikrosegmentacija | fina segmentacija između workloada | smanjuje lateralno kretanje |
| Privatna povezanost | VPN, Direct Connect / ExpressRoute, privatni endpointi | podaci ne idu preko javnog interneta |
| DDoS zaštita | apsorpcija i filtriranje na rubu mreže | Shield, Azure DDoS Protection, CDN |

Geofencing ima dva značenja koja ispit može koristiti: **pristupni** (dozvoli prijavu samo iz određenih zemalja) i **lokacijski za podatke** (resursi smiju postojati samo u odobrenim regionima, npr. zbog data residency). Geofencing po IP adresi se može zaobići VPN-om, pa je dopunska, a ne jedina kontrola.

## Sigurnost virtualizacije

| Tehnologija | Glavni rizici | Kontrole | Ko je odgovoran |
|---|---|---|---|
| **Hypervisor** | VM escape, side-channel napadi, kompromitovan management interfejs | hardening, minimalan kod, hardverska izolacija, brzo patchovanje | CSP (u javnom cloudu) |
| **Kontejneri** | dijeljeni kernel, privilegovani kontejneri, ranjivi imagei, otrovani registry | skeniranje i potpisivanje imagea, non-root, read-only FS, seccomp/AppArmor, pod security | customer (image, konfiguracija); CSP za managed control plane |
| **Ephemeral computing** | gubitak forenzičkih dokaza, tajne u memoriji, kratkotrajni resursi van inventara | centralno logovanje, automatsko prikupljanje dokaza, IaC | customer |
| **Serverless** | prevelike dozvole funkcije, ubacivanje događaja (event injection), ranjive zavisnosti | least privilege po funkciji, validacija ulaza, skeniranje zavisnosti | customer (kod i IAM), CSP (runtime) |
| **Izolacija** | curenje između tenanta ili workloada | dedicated hostovi po potrebi, mikroVM (Firecracker, gVisor), mrežna segmentacija | zajedničko |

**Ephemeral** resursi (instance u auto-scaling grupi, kontejneri, funkcije) žive kratko. Prednost: napadač teže zadržava perzistenciju. Mana: kada resurs nestane, nestaju i dokazi, pa logovi moraju odmah ići u centralno, nepromjenjivo skladište.

## Česte cloud prijetnje

Izvor koji ISC2 često prati je **CSA Top Threats to Cloud Computing** (izdanje „Pandemic Eleven“ i noviji izvještaji). Tipične prijetnje:

| Prijetnja | Primjer | Ključna kontrola |
|---|---|---|
| Pogrešna konfiguracija i neadekvatna kontrola promjena | javni storage bucket, otvoren port baze | CSPM, policy as code, IaC review |
| Loš IAM i upravljanje kredencijalima | ključevi u repozitorijumu, bez MFA | MFA, kratkotrajni kredencijali, secrets management |
| Nesigurni interfejsi i API-ji | API bez autentikacije ili rate limitinga | API gateway, autentikacija, validacija |
| Neadekvatna cloud security strategija | migracija bez arhitekture i governancea | referentna arhitektura, politike |
| Ranjivosti u softveru i supply chainu | otrovana biblioteka, ranjiv image | SCA, SBOM, potpisivanje |
| Gubitak i curenje podataka | eksfiltracija preko dijeljenih linkova | DLP, šifrovanje, klasifikacija |
| Otmica naloga (account hijacking) | phishing administratora | MFA otporan na phishing, monitoring |
| Malicious insider | administrator zloupotrebljava pristup | SoD, PAM, logovanje |
| Napadi uskraćivanja usluge i trošak | DDoS, denial of wallet | DDoS zaštita, limiti, budžetski alarmi |
| Nedovoljna vidljivost i logovanje | logovi nisu uključeni ili se ne čuvaju | centralni SIEM, logovanje management planea |
| Zloupotreba cloud resursa | kriptominer na ukradenom nalogu | detekcija anomalija, kvote |
| Napadi na AI sisteme | prompt injection, data poisoning | validacija podataka, guardrails (vidi 1.6) |

> **Na ispitu:** statistike i CSA izvještaji dosljedno pokazuju da je **pogrešna konfiguracija od strane customera** najčešći uzrok cloud incidenata, a ne proboj infrastrukture provajdera. Ako pitanje traži NAJVJEROVATNIJI uzrok curenja iz cloud storagea, to je skoro uvijek misconfiguration.

## Sigurnosna higijena

| Praksa | Opis | Cloud kontekst |
|---|---|---|
| **Patching** | redovna primjena sigurnosnih zakrpa | u IaaS-u customer patchuje OS; u PaaS/SaaS-u provajder; automatizacija (patch manager) |
| **Baselining** | definisana, odobrena sigurna konfiguracija kao referenca | CIS Benchmarks, golden image, detekcija odstupanja (drift) |
| **Hardening** | smanjenje površine napada | gašenje nepotrebnih servisa i portova, uklanjanje default naloga, minimalni imagei |
| **Immutable architecture** | serveri se ne mijenjaju nakon deploya; promjena = novi image i zamjena | nema configuration drifta, lak rollback, „cattle, not pets“ |

Kod **immutable** pristupa zakrpa se ne instalira na živi server. Pravi se novi golden image sa zakrpom, testira se i zamjenjuje stare instance (blue/green ili rolling deploy). SSH pristup produkcijskim serverima tada postaje nepotreban, što smanjuje rizik.

## Cloud secure data lifecycle

CSA i ISC2 koriste šest faza životnog ciklusa podataka (detaljno u modulu 4, cilj 2.1):

| Faza | Sigurnosni fokus u dizajnu |
|---|---|
| **Create** | klasifikacija i označavanje pri nastanku, vlasnik podatka |
| **Store** | šifrovanje, kontrola pristupa, backup |
| **Use** | kontrola pristupa, DLP, logovanje, confidential computing |
| **Share** | DLP, IRM/DRM, šifrovanje u prenosu, ugovori o dijeljenju |
| **Archive** | dugoročno šifrovanje, upravljanje ključevima kroz godine, dostupnost formata |
| **Destroy** | crypto-shredding, dokaz o uništenju, retention politike |

Princip dizajna: **sigurnost se planira za svaku fazu unaprijed**, a klasifikacija u fazi Create određuje kontrole u svim narednim fazama.

## Cloud-based BC i DR planiranje

**Business Continuity (BC)** je sposobnost organizacije da nastavi kritične poslovne funkcije tokom poremećaja. **Disaster Recovery (DR)** je tehnički podskup: oporavak IT sistema i podataka.

Ključne metrike:

| Metrika | Značenje | Primjer |
|---|---|---|
| **RTO** (Recovery Time Objective) | najduže prihvatljivo vrijeme do oporavka usluge | 4 sata |
| **RPO** (Recovery Point Objective) | najveći prihvatljiv gubitak podataka mjeren vremenom | 15 minuta |
| **RSL** (Recovery Service Level) | procenat normalnog kapaciteta potreban tokom vanrednog stanja | 60% |
| **MTD / MAD** (Maximum Tolerable Downtime) | vrijeme nakon kog organizacija trpi nepopravljivu štetu | 24 sata; RTO mora biti manji |

Cloud DR strategije (od najjeftinije i najsporije do najskuplje i najbrže):

| Strategija | Opis | RTO / RPO | Trošak |
|---|---|---|---|
| Backup and restore | backupi u drugom regionu, sve se podiže iz backupa | sati do dana | najniži |
| Pilot light | minimalno jezgro (npr. replicirana baza) stalno radi | desetine minuta do sati | nizak |
| Warm standby | umanjena, ali potpuno funkcionalna kopija | minute | srednji |
| Multi-site active/active | puni kapacitet u više regiona istovremeno | blizu nule | najviši |

Cloud-specifična razmatranja: DR u **drugom regionu** (ili kod drugog provajdera za kritične sisteme), testiranje failovera, **zavisnost od jednog provajdera** kao rizik, kvote resursa u DR regionu, replikacija ključeva i IAM-a, i provjera da li ugovor i SLA pokrivaju scenarije oporavka. Odgovornost za BC/DR plan ostaje na customeru.

## Business Impact Analysis (BIA)

**BIA** identifikuje kritične poslovne procese, njihove zavisnosti i uticaj prekida, i iz toga izvodi MTD, RTO i RPO. Koraci:

1. identifikovati poslovne procese i vlasnike,
2. procijeniti uticaj prekida kroz vrijeme (finansijski, regulatorni, reputacioni, operativni),
3. odrediti MTD, RTO i RPO po procesu,
4. mapirati zavisnosti (aplikacije, podaci, cloud servisi, dobavljači),
5. prioritizovati oporavak.

Uz BIA idu ekonomske analize:

| Analiza | Pitanje | Formula / primjer |
|---|---|---|
| **Cost-Benefit Analysis (CBA)** | je li trošak kontrole manji od koristi (smanjenog rizika)? | warm standby 50.000 €/god vs očekivani gubitak od 200.000 €/god → opravdano |
| **Return On Investment (ROI)** | koliki je povrat ulaganja? | ROI = (korist − trošak) / trošak |
| ALE (veza sa analizom rizika) | očekivani godišnji gubitak | ALE = SLE × ARO |

Kod odluke o migraciji u cloud CBA uključuje i skrivene troškove: egress saobraćaj, obuka, alati za više okruženja, izlazna strategija.

> **Na ispitu:** pri planiranju BC/DR, **BIA dolazi prije** izbora DR strategije. Ako pitanje pita šta uraditi FIRST, a ponuđeni su „izabrati warm standby“, „konfigurisati replikaciju“ i „sprovesti BIA“, odgovor je BIA. Kontrola nikad ne smije koštati više od vrijednosti onoga što štiti.

## Funkcionalni sigurnosni zahtjevi

| Zahtjev | Značenje | Kako se postiže |
|---|---|---|
| **Portability** | premještanje podataka i aplikacija između provajdera | kontejneri, Kubernetes, IaC sa apstrakcijom, otvoreni formati |
| **Interoperability** | zajednički rad komponenti različitih provajdera i sistema | otvoreni standardi (SAML, OIDC, OpenAPI, SCIM) |
| **Vendor lock-in** | zavisnost od jednog provajdera zbog vlasničkih servisa, formata ili troška izlaska | apstrakcijski slojevi, exit plan, ugovorne klauzule, izbor standardnih servisa |

Primjer: firma koristi vlasničku serverless bazu jednog provajdera za sve aplikacije. Kada provajder poveća cijene za 40%, migracija bi trajala godinu dana jer je model podataka vezan za API tog servisa. Rizik je trebalo prepoznati u fazi dizajna i barem dokumentovati izlazni plan i procjenu troška izlaska.

Lock-in nije uvijek loš: managed vlasnički servisi često daju bolju sigurnost uz manje rada. Arhitekta svjesno odlučuje gdje prihvata lock-in, a gdje ga izbjegava, i dokumentuje izlaznu strategiju.

Pored lock-ina postoji i **vendor lock-out**: provajder prestane poslovati, bude kupljen ili ukine uslugu, pa customer ostane bez pristupa. Ublažava se escrow aranžmanima, redovnim izvozom podataka i reversibility klauzulama.

## Odgovornosti po kategorijama usluga

| Sloj | IaaS | PaaS | SaaS |
|---|---|---|---|
| Podaci i klasifikacija | customer | customer | customer |
| Identiteti i pristup | customer | customer | customer |
| Aplikacija | customer | customer | CSP (customer konfiguriše) |
| Runtime / middleware | customer | CSP | CSP |
| Operativni sistem | customer | CSP | CSP |
| Virtualizacija | CSP | CSP | CSP |
| Mreža data centra, fizički hardver | CSP | CSP | CSP |
| Fizička sigurnost | CSP | CSP | CSP |

Specifični sigurnosni fokus:

- **IaaS**: hardening i patching OS-a, security grupe, šifrovanje volumena, upravljanje imageima, logovanje.
- **PaaS**: sigurnost koda, konfiguracija servisa, tajne u aplikaciji, izolacija između aplikacija na istoj platformi.
- **SaaS**: IAM i SSO, konfiguracija dijeljenja, DLP i **CASB** za vidljivost, procjena provajdera (SOC 2), izvoz podataka.

> **Na ispitu:** kako se ide od IaaS ka SaaS, **kontrola customera opada, a oslanjanje na ugovor, SLA i audit izvještaje raste**. Za SaaS je najvažniji alat customera procjena provajdera i ugovor, a za IaaS sopstvene tehničke kontrole.

## Cloud design patterns

| Okvir | Šta daje | Ključne ideje |
|---|---|---|
| **SANS security principles** | opšti principi sigurnog dizajna | least privilege, defense in depth, fail securely, separation of duties, economy of mechanism, complete mediation |
| **Well-Architected Framework** (AWS, Azure, Google) | stubovi za ocjenu arhitekture | AWS: operational excellence, **security**, reliability, performance efficiency, cost optimization, sustainability |
| **CSA Enterprise Architecture** (ranije TCI) | referentna arhitektura za sigurnost clouda | domeni: Business Operation Support Services (BOSS), ITOS, Technology Solution Services, Security and Risk Management; povezan sa CCM |
| **Secure by design** (CISA i partneri) | proizvođači preuzimaju odgovornost za sigurnost proizvoda | sigurne podrazumijevane postavke (secure by default), MFA bez doplate, eliminacija klasa ranjivosti, transparentnost |

Drugi principi koji se pojavljuju: **defense in depth** (više slojeva kontrola), **zero trust**, **privacy by design** (GDPR čl. 25), **fail secure** (kod kvara sistem zatvara pristup) i **security as code**.

## DevOps security (DevSecOps)

DevOps spaja razvoj i operacije radi brze isporuke. **DevSecOps** ugrađuje sigurnost u svaku fazu („**shift left**“) umjesto provjere na kraju.

| Faza pipelinea | Sigurnosna kontrola |
|---|---|
| Plan | threat modeling, sigurnosni zahtjevi |
| Code | pre-commit skeniranje tajni, IDE linteri, code review |
| Build | **SAST**, **SCA** (ranjive zavisnosti), SBOM, potpisivanje artefakata |
| Test | **DAST**, IAST, fuzzing |
| Release / deploy | skeniranje IaC-a i imagea, policy as code, odobrenja |
| Operate / monitor | runtime zaštita, CSPM, logovanje, feedback u razvoj |

Ključni principi: automatizacija sigurnosnih provjera u CI/CD, **tajne nikad u kodu**, pipeline kao kritičan sistem (zaštita runnera i kredencijala za deploy), **immutable** artefakti i **supply chain** sigurnost (SLSA, potpisani imagei).

Primjer scenarija: tim je produkcijske AWS ključeve zalijepio u konfiguracioni fajl i pushovao u javni repozitorijum. Prva reakcija je **opoziv i rotacija** kredencijala i analiza logova za zloupotrebu; trajno rješenje je skeniranje tajni u pipelineu i prelazak na OIDC federaciju pipelinea sa kratkotrajnim tokenima.

## KMS ili namjenski HSM

| | Cloud KMS | Cloud HSM (dedicated) |
|---|---|---|
| Model | multi-tenant managed servis | single-tenant HSM uređaj u data centru provajdera |
| Kontrola | customer upravlja politikama ključeva, CSP upravlja infrastrukturom | customer ima ekskluzivnu kontrolu nad HSM-om i ključevima |
| Validacija | HSM-ovi iza KMS-a obično FIPS 140-2/140-3 Level 3 | FIPS 140-2/140-3 Level 3 |
| Integracija | nativna sa servisima provajdera | traži više rada (PKCS#11, JCE, CNG) |
| Kada | većina slučajeva | regulativa traži single-tenant HSM, sopstvene kriptografske operacije, CA ključevi |

Rotacija ključeva ograničava količinu podataka šifrovanih jednim ključem i štetu od kompromitacije. KMS obično automatski rotira materijal ključa uz zadržavanje starih verzija za dešifrovanje; to **nije** ponovno šifrovanje postojećih podataka.

## Testiranje BC/DR plana

Plan koji nije testiran ne postoji. Tipovi testova, od najmanje do najviše invazivnog:

| Test | Opis | Uticaj na produkciju |
|---|---|---|
| Checklist / read-through | učesnici pregledaju plan | nikakav |
| Structured walkthrough / tabletop | tim prolazi kroz scenario za stolom | nikakav |
| Simulation | simulira se incident, procedure se izvode bez stvarnog failovera | minimalan |
| Parallel test | DR sistemi se podižu i obrađuju podatke paralelno sa produkcijom | nizak |
| Full interruption (cutover) | produkcija se zaista gasi i prelazi na DR | visok rizik; rijetko |

U cloudu se paralelni testovi lakše izvode jer se DR okruženje može podići iz IaC-a i ugasiti nakon testa. **Chaos engineering** (namjerno izazivanje kvarova) je moderni dodatak koji provjerava otpornost kontinuirano.

## Zero trust u cloud dizajnu

**Zero trust** (NIST SP 800-207) polazi od pretpostavke da je mreža već kompromitovana:

- svaki zahtjev se autentifikuje i autorizuje na osnovu identiteta, stanja uređaja i konteksta,
- pristup je po sesiji i po resursu, sa najmanjim privilegijama,
- komponente: **Policy Decision Point (PDP)** i **Policy Enforcement Point (PEP)**,
- kontinuirano praćenje i prikupljanje telemetrije za odluke.

U cloudu se zero trust ostvaruje kroz identitetski proxy (ZTNA), uslovni pristup, mikrosegmentaciju, mTLS između servisa (service mesh) i privatne endpointe umjesto javnog izlaganja.

> **Na ispitu:** ako se nudi „VPN koji daje pun pristup internoj mreži nakon prijave“ i „pristup po aplikaciji uz provjeru identiteta i stanja uređaja za svaki zahtjev“, zero trust odgovor je drugi.

## Primjer scenarija: dizajn za fintech aplikaciju

Fintech startup gradi aplikaciju za plaćanja na IaaS/PaaS-u javnog provajdera. Zahtjevi: PCI DSS, RTO 1 sat, RPO 5 minuta, mali tim.

1. **BIA** utvrđuje da je obrada plaćanja kritična (MTD 4 sata), a izvještavanje nije (MTD 3 dana).
2. **DR**: warm standby u drugom regionu za obradu plaćanja (RTO/RPO ispunjeni), backup and restore za izvještavanje (CBA pokazuje da skuplja opcija nije opravdana).
3. **Ključevi**: customer-managed ključevi u KMS-u sa HSM zaštitom, replicirani u DR region; tokenizacija brojeva kartica.
4. **Pristup**: SSO sa MFA, PAM sa just-in-time pristupom za produkciju, role za servise.
5. **Higijena**: immutable golden imagei, CIS baseline, automatsko patchovanje imagea u pipelineu.
6. **Lock-in**: svjesno prihvataju managed bazu provajdera, ali aplikaciju pakuju u kontejnere zbog portabilnosti i dokumentuju exit plan.

## Česte zamke

| Distraktor | Zašto je pogrešan |
|---|---|
| „Degaussing je najbolja sanitizacija u javnom cloudu.“ | customer nema fizički pristup; crypto-shredding je metoda customera |
| „Šifrovanje ključem provajdera daje customeru punu kontrolu.“ | kontrolu daju CMK, BYOK, HYOK |
| „RPO je vrijeme do ponovnog pokretanja.“ | to je RTO; RPO je prihvatljiv gubitak podataka |
| „Prvo izaberi DR strategiju, pa uradi BIA.“ | BIA određuje zahtjeve za strategiju |
| „U SaaS-u customer nema sigurnosnih obaveza.“ | podaci, IAM i konfiguracija ostaju kod customera |
| „Patchovanje živih servera je najbolja praksa u immutable arhitekturi.“ | u immutable modelu se zamjenjuje image |
| „Geofencing po IP adresi je dovoljna kontrola pristupa.“ | lako se zaobilazi VPN-om; to je dopunska kontrola uz IAM i MFA |
| „Automatska rotacija KMS ključa ponovo šifruje sve stare podatke.“ | rotacija mijenja materijal ključa za nove operacije; stari podaci se ne prešifruju |

## Rezime

- Kriptografija štiti **at rest, in transit, in use**; ključno pitanje je **ko kontroliše ključeve** (provider-managed → CMK → BYOK → HYOK). Envelope encryption: DEK + KEK.
- IAM: **user, privilege, service access**; least privilege, SoD, zero trust; za servise role i kratkotrajni kredencijali; za administratore PAM i JIT.
- Sanitizacija u cloudu: **cryptographic erase** za customera; overwriting je ograničen, degaussing i fizičko uništavanje radi CSP. Referenca **NIST SP 800-88** (Clear, Purge, Destroy).
- Mreža: **security grupe**, NACL, **traffic inspection**, **geofencing**, mikrosegmentacija, privatna povezanost.
- Virtualizacija: hypervisor (CSP), kontejneri, **ephemeral** i **serverless** (customer: kod, IAM, logovi), izolacija.
- Najčešća prijetnja: **misconfiguration**; zatim IAM, nesigurni API-ji, supply chain, insideri.
- Higijena: **patching, baselining, hardening, immutable architecture**.
- Dizajn: data lifecycle (Create–Store–Use–Share–Archive–Destroy), **BIA prije DR-a**, RTO/RPO/RSL/MTD, CBA i ROI.
- Funkcionalni zahtjevi: **portability, interoperability, vendor lock-in** (i lock-out).
- Odgovornost raste za customera od SaaS ka IaaS; podaci i IAM uvijek njegovi.
- Okviri: **SANS principi, Well-Architected, CSA Enterprise Architecture, secure by design**; **DevSecOps** = shift left i automatizacija u pipelineu.
