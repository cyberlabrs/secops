## Ciljevi ispita: 1.1 i 1.2

Domen 1 (**Cloud Concepts, Architecture and Design**) nosi oko 17% ispita. Ovaj modul pokriva prva dva cilja:

- **1.1 Understand cloud computing concepts**
  - definicije cloud computinga,
  - uloge i odgovornosti (cloud service customer, Cloud Service Provider, cloud service partner, cloud service broker, regulator),
  - esencijalne karakteristike (on-demand self-service, broad network access, multi-tenancy, rapid elasticity and scalability, resource pooling, measured service),
  - gradivne tehnologije (virtualizacija, storage, mreža, baze podataka, orkestracija).
- **1.2 Describe cloud reference architecture**
  - cloud computing aktivnosti,
  - cloud service capabilities (application, platform, infrastructure capability types),
  - kategorije usluga (SaaS, PaaS, IaaS),
  - deployment modeli (public, private, hybrid, community, multi-cloud),
  - zajednička razmatranja (interoperability, portability, reversibility, availability, security, privacy, resiliency, performance, governance, maintenance and versioning, SLA, auditability, regulatory, outsourcing),
  - uticaj srodnih tehnologija (data science, ML, AI, blockchain, IoT, kontejneri, kvantno računarstvo, edge computing, confidential computing).

Ovo je „rječnik“ cijelog ispita. Pitanja iz ovih ciljeva rijetko su čista definicija: češće dobiješ scenario („organizacija želi da izbjegne zavisnost od jednog provajdera… koja karakteristika/razmatranje je NAJVAŽNIJE?“) i moraš prepoznati koji pojam ISC2 tu očekuje. ISC2 terminologija dolazi iz dva izvora koje vrijedi zapamtiti: **NIST SP 800-145** (definicija i pet karakteristika) i **ISO/IEC 17788 / 17789** (pregled, rječnik i referentna arhitektura).

## Definicija cloud computinga

**NIST SP 800-145** definiše cloud computing kao model koji omogućava sveprisutan, praktičan mrežni pristup **na zahtjev** zajedničkom skupu konfigurabilnih računarskih resursa (mreže, serveri, storage, aplikacije, servisi) koji se mogu brzo dodijeliti i osloboditi uz minimalan napor upravljanja ili interakciju sa provajderom.

NIST model ima tri dijela: **5 esencijalnih karakteristika**, **3 modela usluga** (SaaS, PaaS, IaaS) i **4 deployment modela** (public, private, hybrid, community).

**ISO/IEC 17788** daje skoro istu definiciju, ali navodi **šest** ključnih karakteristika (dodaje **multi-tenancy**) i definiše širi skup kategorija usluga (CaaS, CompaaS, DSaaS, NaaS…). Outline CCSP-a za 2026. eksplicitno navodi multi-tenancy i „rapid elasticity and scalability“, dakle kombinuje oba izvora.

> **Na ispitu:** ako pitanje traži „definiciju cloud computinga po NIST-u“, traži opciju sa „on-demand“, „shared pool of configurable resources“ i „rapidly provisioned and released with minimal management effort“. Hosting na jednom zakupljenom serveru bez self-servicea i elastičnosti NIJE cloud, iako je „negdje drugdje“.

## Uloge i odgovornosti (ISO/IEC 17789)

ISO/IEC 17789 definiše **uloge** (role) i pod-uloge. Ista organizacija može imati više uloga: npr. SaaS firma je **CSP** prema svojim kupcima, a **cloud service customer** prema IaaS provajderu na kom radi.

| Uloga | Ko je to | Ključne odgovornosti |
|---|---|---|
| **Cloud Service Customer (CSC)** | organizacija koja koristi cloud usluge na osnovu ugovora | upravljanje podacima, identitetima i pristupom, korištenje usluge, odgovornost za usklađenost (accountability ostaje kod nje!) |
| **Cloud Service Provider (CSP)** | organizacija koja usluge čini dostupnim | rad usluge, infrastruktura, fizička sigurnost, SLA, poslovna podrška |
| **Cloud Service Partner (CSN)** | treća strana koja podržava CSP ili CSC | pod-uloge: **cloud service developer**, **cloud auditor**, **cloud service broker** |
| **Cloud Service Broker** | posrednik između korisnika i jednog ili više provajdera | agregacija, integracija, prilagođavanje (customization), pregovaranje ugovora |
| **Cloud Auditor** | nezavisna strana koja ocjenjuje usluge | audit kontrola, izvještaji (SOC 2, ISO 27001), ocjena usklađenosti |
| **Regulator** | državni ili sektorski organ | postavlja zakonske zahtjeve (GDPR, HIPAA, PCI DSS je industrijski, ne zakonski), kažnjava |

NIST SP 500-292 (NIST Cloud Computing Reference Architecture) koristi malo drugačiji skup: **cloud consumer, cloud provider, cloud broker, cloud auditor, cloud carrier** (mrežni operater koji prenosi saobraćaj). Na ispitu se mogu pojaviti oba rječnika.

### Cloud service broker: tri uloge (NIST)

- **Service intermediation**: poboljšava jednu uslugu (npr. dodaje identity management ili reporting),
- **Service aggregation**: spaja više usluga u jednu novu,
- **Service arbitrage**: kao agregacija, ali broker dinamički bira provajdera (npr. najjeftiniji ili najbrži).

### Accountability vs responsibility

Najvažnija lekcija ove sekcije: **odgovornost za izvršenje (responsibility) se može podijeliti ili prenijeti, ali krajnja odgovornost (accountability) za podatke ostaje kod vlasnika podataka, tj. cloud customera.** Po GDPR-u je customer obično **data controller**, a CSP **data processor**.

> **Na ispitu:** „Ko je KRAJNJE odgovoran za zaštitu ličnih podataka klijenata koje firma drži u SaaS aplikaciji?“ Odgovor je **cloud customer (data owner/controller)**, nikad CSP, broker ili auditor. Ugovor može prebaciti zadatke, ali ne i accountability.

## Esencijalne karakteristike

| Karakteristika | Šta znači | Sigurnosna posljedica |
|---|---|---|
| **On-demand self-service** | korisnik sam dodjeljuje resurse preko portala/API-ja, bez ljudske interakcije sa CSP-om | **shadow IT**, potreba za governance i limitima (SCP, kvote), IAM kontrola nad API-jem |
| **Broad network access** | pristup preko mreže standardnim mehanizmima (browser, mobilni, API) | veća površina napada, potreba za jakom autentikacijom (MFA) i šifrovanjem u prenosu |
| **Resource pooling** | resursi se dijele među korisnicima i dinamički dodjeljuju; **location independence** | korisnik ne zna tačnu lokaciju podataka → pitanje jurisdikcije, data residency |
| **Multi-tenancy** | više korisnika (tenanta) dijeli istu infrastrukturu uz logičku izolaciju | rizik od curenja između tenanta (side-channel, greška izolacije), **noisy neighbor** |
| **Rapid elasticity and scalability** | resursi se brzo povećavaju/smanjuju, za korisnika djeluju neograničeno | dostupnost i otpornost na DDoS, ali i **rizik troška** (denial of wallet) |
| **Measured service** | korištenje se mjeri, kontroliše i naplaćuje (pay-as-you-go) | mjerni podaci su izvor za detekciju anomalija i chargeback |

Razlika **scalability** i **elasticity**: scalability je sposobnost sistema da raste (vertikalno: veća mašina; horizontalno: više mašina), elasticity je **automatsko** prilagođavanje gore i dolje prema opterećenju.

> **Na ispitu:** kada scenario kaže „firma ne zna u kojem data centru su joj podaci“, karakteristika u pitanju je **resource pooling** (location independence). Kada kaže „računi su porasli jer je auto-scaling odgovorio na napad“, to je kombinacija **rapid elasticity** i **measured service**.

## Gradivne tehnologije (building blocks)

| Gradivni blok | Uloga u cloudu | Primjer iz prakse |
|---|---|---|
| **Virtualizacija** | apstrakcija hardvera, temelj multi-tenancyja; hypervisor Type 1 (bare-metal) i Type 2 (hosted) | AWS Nitro, KVM, Hyper-V, VMware ESXi |
| **Storage** | objektni, blok (volume), fajl, ephemeral | S3, EBS, EFS, Azure Blob |
| **Networking** | SDN, virtualne mreže, load balanceri, overlay | VPC, security grupe, Transit Gateway |
| **Databases** | relacione i NoSQL, managed (DBaaS) | RDS, DynamoDB, Cloud SQL |
| **Orchestration** | automatizovano upravljanje resursima i workloadima | Kubernetes, Terraform, CloudFormation |

Ključni pojmovi:

- **Software-Defined Networking (SDN)** odvaja **control plane** (odluke o rutiranju) od **data plane** (prosljeđivanje paketa); upravljanje je centralizovano i programabilno. Sigurnosno: kompromitovan SDN kontroler = kompromitovana cijela mreža.
- **Management plane** je skup API-ja i konzola kojima upravljaš cijelim cloudom. To je „krunski dragulj“: ko ga kontroliše, kontroliše sve.
- **Orkestracija** povezuje automatizaciju više koraka (npr. deploy aplikacije = mreža + VM + baza + DNS) u jedan tok.

## Cloud computing aktivnosti (ISO/IEC 17789)

ISO/IEC 17789 opisuje aktivnosti po ulogama. Na ispitu je važno razumjeti da **svaka uloga ima svoj skup aktivnosti**:

| Uloga | Tipične aktivnosti |
|---|---|
| Cloud service customer | korištenje usluge, administracija (korisnici, pristup), poslovno upravljanje (ugovor, plaćanje), integracija sa sopstvenim sistemima |
| Cloud service provider | priprema i rad usluge (operations), deploy, upravljanje sigurnošću, upravljanje mrežom, nadzor, upravljanje odnosima sa korisnicima, peering sa drugim CSP-ovima |
| Cloud service partner | razvoj usluga (developer), audit (auditor), posredovanje (broker) |

## Cloud service capabilities

ISO/IEC 17788 razlikuje **capability types** (šta korisnik dobija) od **service categories** (kako je usluga upakovana):

| Capability type | Šta korisnik kontroliše | Tipična kategorija |
|---|---|---|
| **Application capabilities** | samo korištenje aplikacije i podešavanja korisnika | SaaS |
| **Platform capabilities** | deploy i upravljanje sopstvenim aplikacijama na runtimeu koji daje provajder | PaaS |
| **Infrastructure capabilities** | procesiranje, storage i mreža; korisnik upravlja OS-om i svime iznad | IaaS |

## Kategorije usluga: SaaS, PaaS, IaaS

| | IaaS | PaaS | SaaS |
|---|---|---|---|
| Korisnik dobija | VM, mreža, storage | runtime, middleware, managed baza | gotova aplikacija |
| Korisnik upravlja | OS, patchevi OS-a, middleware, aplikacija, podaci, IAM, mrežna pravila | kod, konfiguracija aplikacije, podaci, IAM | podaci, korisnici i pristup, konfiguracija tenanta |
| Provajder upravlja | fizika, hypervisor, mreža data centra | + OS, runtime, patchevi platforme | + aplikacija |
| Kontrola korisnika | najveća | srednja | najmanja |
| Primjeri | EC2, Azure VM, GCE | Elastic Beanstalk, App Service, Lambda (često FaaS), Cloud Run | Microsoft 365, Salesforce, Workday |
| Ključni rizik | loše konfigurisani OS, nezakrpljene VM | sigurnost koda, vendor lock-in na API platforme | slaba IAM kontrola, curenje preko dijeljenja, nedostatak vidljivosti |

U **svim** modelima customer ostaje odgovoran za **podatke**, **identitete i pristup** i **klasifikaciju**. To je osnova **shared responsibility modela**.

Ostale „as a Service“ kategorije koje ISO/IEC 17788 pominje: **CaaS** (Communications as a Service), **CompaaS** (Compute as a Service), **DSaaS** (Data Storage as a Service), **NaaS** (Network as a Service). U praksi se sreću i **FaaS** (serverless), **DBaaS**, **SECaaS** (Security as a Service) i **AIaaS**.

> **Na ispitu:** pitanja o odgovornosti uvijek prođi kroz pitanje „ko upravlja tim slojem?“. Patch OS-a na EC2 je odgovornost **customera** (IaaS). Patch OS-a ispod Azure App Service je odgovornost **provajdera** (PaaS). Podešavanje dijeljenja dokumenata u Microsoft 365 je odgovornost **customera** (SaaS), iako provajder upravlja svime ostalim.

## Deployment modeli

| Model | Opis | Prednosti | Mane / rizici |
|---|---|---|---|
| **Public** | infrastruktura dostupna široj javnosti, u vlasništvu CSP-a | niska cijena ulaska, elastičnost, globalni doseg | multi-tenancy, manje kontrole, pitanje lokacije podataka |
| **Private** | infrastruktura samo za jednu organizaciju; može biti on-prem ili kod treće strane | kontrola, usklađenost, prilagođavanje | skupo, ograničena elastičnost, organizacija nosi sve operacije |
| **Community** | dijeli je više organizacija sa zajedničkim interesima (misija, regulativa) | dijeljenje troškova uz kontrolisanu grupu | upravljanje i odgovornost među članovima mora biti jasno ugovoreno |
| **Hybrid** | kombinacija dva ili više različitih modela povezanih tehnologijom koja omogućava prenos podataka i aplikacija | **cloud bursting**, postepena migracija, osjetljivi podaci ostaju privatno | složenost, konzistentnost IAM-a i politika preko granice |
| **Multi-cloud** | korištenje više javnih provajdera | izbjegavanje lock-ina, otpornost, najbolji servis po namjeni | više alata, više vještina, fragmentisana vidljivost i politike |

**Hybrid** i **multi-cloud** nisu isto: hybrid miješa **tipove** (npr. private + public), multi-cloud koristi **više provajdera** (npr. AWS + Azure). Organizacija može biti oboje.

Primjer scenarija: bolnica drži kartone pacijenata u privatnom data centru zbog regulative, ali analitiku anonimizovanih podataka radi u javnom cloudu. To je **hybrid**. Grupa od pet regionalnih banaka zajedno gradi infrastrukturu za sistem plaćanja sa istim regulatornim zahtjevima: to je **community**.

## Zajednička razmatranja (cloud shared considerations)

ISO/IEC 17788 zove ih **cross-cutting aspects**: teme koje važe za sve uloge i sve modele.

| Razmatranje | Pitanje koje postavljaš | Kako se adresira |
|---|---|---|
| **Interoperability** | mogu li sistemi različitih provajdera i moji sistemi raditi zajedno i razmjenjivati podatke? | otvoreni standardi i API-ji, standardni formati |
| **Portability** | mogu li premjestiti podatke i aplikacije kod drugog provajdera uz minimalan napor? | kontejneri, IaC, izvoz podataka u otvorenim formatima |
| **Reversibility** | mogu li **izaći** iz usluge, vratiti podatke i dobiti potvrdu da su obrisani kod CSP-a? | exit klauzule u ugovoru, plan izlaska, rokovi vraćanja i brisanja |
| **Availability** | je li usluga dostupna kada je trebam? | SLA, multi-AZ/multi-region, BC/DR |
| **Security** | jesu li CIA ciljevi ispunjeni? | shared responsibility, kontrole, audit |
| **Privacy** | štite li se lični podaci po zakonu? | DPA, data residency, minimizacija |
| **Resiliency** | može li usluga podnijeti kvar i oporaviti se? | redundansa, failover, chaos testing |
| **Performance** | ispunjava li usluga zahtjeve brzine i kapaciteta? | SLA metrike, monitoring, izbor regiona |
| **Governance** | ko donosi odluke, po kojim politikama, uz kakav nadzor? | politike, uloge, guardrails, procesi odobravanja |
| **Maintenance and versioning** | kako CSP mijenja usluge i API-je i koliko unaprijed obavještava? | ugovorna obavještenja, deprecation politike, testiranje |
| **Service levels i SLA** | šta je garantovano i šta ako nije ispunjeno? | mjerljive metrike, kazne (service credits) |
| **Auditability** | mogu li ja ili nezavisni auditor dobiti dokaz o kontrolama? | SOC 2, ISO 27001, logovi, pravo na audit |
| **Regulatory** | koji zakoni i propisi važe za podatke i usluge? | mapiranje zahtjeva, izbor jurisdikcije |
| **Outsourcing** | šta prenosim na treću stranu i kako zadržavam kontrolu? | upravljanje dobavljačima, ugovor, nadzor |

Tri pojma se najčešće miješaju:

- **Interoperability**: sistemi rade **zajedno** (npr. SIEM u AWS-u čita logove iz Azurea).
- **Portability**: sistem se **seli** sa jedne platforme na drugu.
- **Reversibility**: korisnik **izlazi** iz cloud usluge i vraća podatke, a CSP ih briše u dogovorenom roku.

> **Na ispitu:** „Organizacija želi osigurati da nakon raskida ugovora dobije sve podatke nazad i da ih provajder obriše u roku od 30 dana. Na koji koncept se ovo odnosi?“ Odgovor je **reversibility**, ne portability. Portability bi bila tačna da je naglasak na premještanju kod drugog provajdera bez prepravljanja.

### SLA ukratko

**Service Level Agreement (SLA)** je dio ugovora sa mjerljivim obavezama: dostupnost (npr. 99,95% mjesečno), vrijeme odziva podrške, RTO/RPO za managed usluge, zadržavanje logova. Uz SLA idu **SLO** (ciljevi) i **SLI** (mjerni indikatori). Tipičan lijek za neispunjen SLA je **service credit**, što rijetko pokriva stvarnu poslovnu štetu: zato BC/DR planiranje ostaje odgovornost customera.

## Uticaj srodnih tehnologija

| Tehnologija | Šta je | Sigurnosni aspekti u cloudu |
|---|---|---|
| **Data science** | izvlačenje znanja iz velikih skupova podataka | koncentracija osjetljivih podataka u data lakeovima, kontrola pristupa analitičara |
| **Machine learning (ML)** | sistemi koji uče iz podataka bez eksplicitnog programiranja | data poisoning, kvalitet i porijeklo podataka za trening, model kao imovina |
| **Artificial intelligence (AI)** | šira oblast sistema koji oponašaju ljudsko rasuđivanje, uključujući generativni AI | prompt injection, curenje podataka kroz prompt, halucinacije, regulativa (EU AI Act) |
| **Blockchain** | distribuirana, nepromjenjiva (append-only) knjiga sa konsenzusom | integritet i nonrepudiation, ali problem „prava na brisanje“ (GDPR) i zaštite privatnih ključeva |
| **Internet of Things (IoT)** | ogroman broj uređaja koji šalju podatke u cloud | slaba autentikacija uređaja, zakrpe firmvera, ogroman broj ulaznih tačaka |
| **Kontejneri** | lagana izolacija aplikacija dijeljenjem kernela hosta | slabija izolacija od VM-a, ranjivi imagei, supply chain, orkestrator kao meta |
| **Quantum computing** | računari koji mogu razbiti RSA/ECC (Shorov algoritam) i oslabiti simetrične šifre (Grover) | **harvest now, decrypt later**; prelazak na **post-quantum kriptografiju** (NIST FIPS 203/204/205) |
| **Edge computing** | obrada blizu izvora podataka (na rubu mreže) radi manjeg kašnjenja | fizička sigurnost edge uređaja, distribuirano upravljanje, sinhronizacija politika |
| **Confidential computing** | zaštita podataka **u upotrebi** u hardverski izolovanom okruženju (**Trusted Execution Environment, TEE**) | štiti od administratora CSP-a i kompromitovanog hypervisora; primjeri: AMD SEV-SNP, Intel TDX/SGX, AWS Nitro Enclaves |

Konteksti koje treba zapamtiti:

- Šifrovanje štiti podatke **at rest** i **in transit**; **confidential computing** zatvara treće stanje: **data in use**.
- Kvantni rizik nije samo budući: protivnik danas snima šifrovani saobraćaj i čeka. Zato se za dugoročno povjerljive podatke prelazak na PQC planira sada (crypto-agility, inventar kriptografije).
- **Fog computing** je međusloj između edgea i clouda; ponekad se pojavljuje kao distraktor.

> **Na ispitu:** „Organizacija obrađuje medicinske podatke u javnom cloudu i ne želi da čak ni administratori provajdera mogu vidjeti podatke tokom obrade. Koja tehnologija NAJBOLJE odgovara?“ Šifrovanje at rest i TLS su tačni, ali ne štite podatke **dok se obrađuju**. Odgovor je **confidential computing (TEE)**.

## Gradivni blokovi detaljnije: virtualizacija i hypervisori

Virtualizacija je tehnologija koja cloud čini ekonomski mogućim. **Hypervisor** (Virtual Machine Monitor) dijeli fizički host na više izolovanih virtualnih mašina.

| | Type 1 (bare-metal) | Type 2 (hosted) |
|---|---|---|
| Gdje radi | direktno na hardveru | kao aplikacija na host OS-u |
| Primjeri | ESXi, Hyper-V, KVM, Xen, Nitro | VirtualBox, VMware Workstation |
| Površina napada | manja (nema opšteg OS-a ispod) | veća (ranjivosti host OS-a) |
| Upotreba | javni i privatni cloud | razvoj, testiranje, desktop |

Cloud provajderi koriste **Type 1** hypervisore. Najozbiljnija prijetnja je **VM escape**: napadač iz gostujuće mašine izađe u hypervisor i dobije pristup drugim tenantima. Zato je izolacija između tenanta odgovornost CSP-a, a customer je provjerava kroz audit izvještaje, a ne kroz sopstveno testiranje hypervisora.

Kontejneri dijele **kernel hosta**, pa je izolacija slabija od VM-a. Serverless (FaaS) ide korak dalje: customer vidi samo funkciju, a runtime, OS i skaliranje su na provajderu. Detaljnije o sigurnosti virtualizacije u sljedećem modulu (1.3).

## Gradivni blokovi detaljnije: storage, mreža, baze i orkestracija

Storage u cloudu ima nekoliko oblika (detaljno u modulu o podacima, cilj 2.2):

- **objektni storage**: fajlovi kao objekti sa metapodacima u ravnom namespaceu, pristup preko API-ja (S3, Blob),
- **volume/blok storage**: virtualni disk zakačen za VM (EBS, Managed Disks),
- **fajl storage**: dijeljeni fajl sistem (NFS/SMB: EFS, Azure Files),
- **ephemeral storage**: lokalni disk koji nestaje kada se instanca ugasi.

Mreža u cloudu je gotovo uvijek **softverski definisana**: virtualne mreže (VPC/VNet), podmreže, tabele rutiranja i filteri (security grupe, NACL) postoje kao API objekti. Prednost je što se mrežna politika može verzionisati i revidirati kao kod; mana je što jedna pogrešna izmjena preko API-ja može izložiti cijelo okruženje internetu.

Baze podataka se nude kao **DBaaS**: provajder patchuje engine, radi backup i replikaciju, a customer odgovara za šemu, pristup, šifrovanje (izbor ključa) i podatke.

Orkestracija i **Infrastructure as Code (IaC)** omogućavaju da se cijelo okruženje opiše deklarativno. Za sigurnost to znači **ponovljivost** (isti siguran baseline svaki put), **reviziju** (code review i statička analiza prije deploya) i brz oporavak (ponovno podizanje iz koda).

> **Na ispitu:** kada pitanje traži NAJVEĆI rizik u cloudu kao cjelini, a ponuđen je **management plane** (konzola/API), to je obično tačan odgovor: kompromitovani administrativni kredencijali daju kontrolu nad svim resursima istovremeno. Zato su MFA, najmanje privilegije i logovanje API poziva prva linija odbrane.

## Cloud bursting, governance i outsourcing

**Cloud bursting** je hibridni obrazac: aplikacija radi u privatnom cloudu, a kada opterećenje premaši kapacitet, višak se „prelije“ u javni cloud. Sigurnosni preduslovi:

- isti identitetski sistem (federacija) i iste politike u oba okruženja,
- šifrovana veza (VPN ili privatni link),
- klasifikacija podataka koja određuje šta smije preći u javni dio.

**Governance** u cloudu znači da organizacija zadržava kontrolu nad odlukama iako je operacija kod provajdera. Ključni elementi:

| Element | Primjer |
|---|---|
| Politike | dozvoljeni regioni, obavezno šifrovanje, odobreni servisi |
| Uloge i odgovornosti | RACI matrica između customera, CSP-a i brokera |
| Guardrails | preventivne kontrole na nivou organizacije (npr. SCP u AWS Organizations, Azure Policy) |
| Nadzor | kontinuirana provjera usklađenosti, izvještaji upravi |
| Upravljanje dobavljačima | procjena CSP-a prije ugovora i periodično (cilj 1.5) |

**Outsourcing** na CSP prenosi **izvršenje** usluge, ali ne i **rizik** u cjelini. Organizacija mora znati šta je prenijela, kako to nadzire i šta radi ako dobavljač zakaže. Posebno treba paziti na **lanac podizvođača** (fourth parties): SaaS provajder koji radi na IaaS-u drugog provajdera dodaje još jednu kariku za koju customer nema direktan ugovor.

### Maintenance and versioning

Provajder mijenja usluge stalno: nove verzije API-ja, ukidanje starih (deprecation), promjene podrazumijevanih postavki. Customer treba:

- ugovorom definisati **rok obavještenja** o značajnim promjenama,
- pratiti objave provajdera (release notes, roadmap),
- testirati aplikacije na novim verzijama u neprodukcijskom okruženju,
- znati kada je planirano održavanje (**maintenance window**) i kako utiče na SLA.

### Metrike u SLA

| Metrika | Šta mjeri | Primjer |
|---|---|---|
| Availability / uptime | procenat vremena kada je usluga dostupna | 99,9% = oko 43 minuta prekida mjesečno |
| Response time | vrijeme reakcije podrške ili sistema | P1 incident: odgovor u 15 minuta |
| Throughput / performance | kapacitet obrade | X zahtjeva u sekundi |
| Data durability | vjerovatnoća da podatak neće biti izgubljen | 99,999999999% (11 devetki) |
| Incident notification | rok obavještavanja o sigurnosnom incidentu | 24 ili 72 sata |
| Data return / deletion | rok vraćanja i brisanja podataka nakon raskida | 30 dana |

> **Na ispitu:** ako SLA garantuje 99,9%, a poslovanje zahtijeva 99,99%, **ugovor sam po sebi ne rješava problem**. Najbolji odgovor je arhitektura koja to omogućava (više zona/regiona ili više provajdera) i BC/DR plan, a ne samo traženje većih service creditova.

## Kvantno računarstvo i post-quantum kriptografija

Kvantni računar dovoljne veličine (tzv. **CRQC**, cryptographically relevant quantum computer) bi:

- Shorovim algoritmom razbio asimetričnu kriptografiju zasnovanu na faktorizaciji i diskretnom logaritmu (**RSA, DH, ECC**),
- Groverovim algoritmom prepolovio efektivnu dužinu simetričnog ključa (AES-128 → oko 64 bita sigurnosti, dok AES-256 ostaje dovoljno jak).

NIST je 2024. objavio prve PQC standarde: **FIPS 203 (ML-KEM)** za razmjenu ključeva, **FIPS 204 (ML-DSA)** i **FIPS 205 (SLH-DSA)** za digitalne potpise. Za cloud arhitektu praktični koraci su:

1. **inventar kriptografije** (gdje se koristi RSA/ECC: TLS, potpisi, KMS, PKI),
2. **crypto-agility** (sposobnost zamjene algoritma bez redizajna sistema),
3. praćenje podrške provajdera (hibridni TLS sa ML-KEM već postoji kod velikih CSP-ova),
4. prioritet podacima sa dugim rokom povjerljivosti.

## Edge, IoT i kontejneri u praksi

- **IoT** u cloudu tipično ide preko managed servisa (npr. AWS IoT Core, Azure IoT Hub) sa **certifikatom po uređaju**. Najveći rizici su podrazumijevane lozinke, nemogućnost zakrpe i fizički pristup uređaju.
- **Edge** prenosi dio obrade bliže korisniku (CDN funkcije, lokalne zone, uređaji u fabrici). Kontrole moraju biti jednako jake kao u centralnom cloudu, ali se njima upravlja centralno.
- **Kontejneri** su osnova moderne portabilnosti: isti image radi na bilo kom Kubernetes klasteru. To pomaže portability i interoperability, ali uvodi rizike supply chaina (nepouzdani base imagei) i zahtijeva skeniranje i potpisivanje imagea.

## Primjer scenarija: od definicije do odluke

Srednja osiguravajuća kuća planira prelazak CRM sistema u cloud. Uprava pita sigurnosnog arhitektu za preporuku.

1. **Kategorija usluge**: CRM postoji kao SaaS (Salesforce, Dynamics). Firma nema razvojni tim, pa je SaaS logičan izbor jer prebacuje najviše operativne odgovornosti.
2. **Uloge**: firma je **cloud service customer** i **data controller**; SaaS provajder je CSP i **data processor**; posrednik koji radi integraciju sa core sistemom je **cloud service partner** (broker/integrator).
3. **Shared considerations**: provjeriti **reversibility** (izvoz svih podataka i brisanje nakon raskida), **auditability** (SOC 2 Type II, ISO 27001), **regulatory** (gdje su podaci, GDPR), **SLA** (dostupnost, podrška).
4. **Accountability**: bez obzira na izbor, odgovornost za podatke klijenata ostaje kod osiguravajuće kuće.

Arhitekta ne kreće od alata nego od zahtjeva poslovanja i rizika, pa bira model usluge i deployment model, a tek onda kontrole.

## Drugi scenario: izbor deployment modela

Državna agencija za statistiku i tri ministarstva imaju iste zahtjeve: podaci moraju ostati u zemlji, pristup imaju samo provjereni službenici, a sistem mora podnijeti vršno opterećenje tokom popisa stanovništva.

| Opcija | Ocjena |
|---|---|
| Public cloud u regionu van zemlje | odbačeno: krši zahtjev o lokaciji podataka |
| Private cloud za svaku instituciju posebno | ispunjava zahtjeve, ali četiri puta veći trošak i bez dijeljenja kapaciteta |
| **Community cloud** za sve četiri institucije | dijele troškove i zajedničke regulatorne zahtjeve; preporuka |
| Community + bursting anonimizovanih agregata u public | moguće za vršno opterećenje, uz strogu klasifikaciju |

Ključna pitanja koja arhitekta postavlja: ko je vlasnik infrastrukture i ko je operater, kako se dijele troškovi i odgovornosti, kako se rješavaju sporovi i šta se dešava kada jedna institucija izađe (**reversibility** unutar zajednice).

## Brzi vodič: ključna riječ u pitanju → pojam

| Ako pitanje kaže… | ISC2 očekuje |
|---|---|
| „bez kontakta sa provajderom, preko portala“ | on-demand self-service |
| „pristup sa bilo kog uređaja preko interneta“ | broad network access |
| „ne zna se tačna lokacija resursa“ | resource pooling (location independence) |
| „više korisnika na istom hardveru“ | multi-tenancy |
| „automatski raste i smanjuje se“ | rapid elasticity |
| „plaća se po korištenju“ | measured service |
| „posrednik koji bira najjeftinijeg provajdera“ | cloud broker – service arbitrage |
| „nezavisna ocjena kontrola provajdera“ | cloud auditor |
| „mrežni operater između korisnika i CSP-a“ | cloud carrier (NIST) |
| „premjestiti aplikaciju kod drugog provajdera“ | portability |
| „sistemi dva provajdera razmjenjuju podatke“ | interoperability |
| „vratiti podatke i potvrda brisanja nakon raskida“ | reversibility |
| „zaštita podataka tokom obrade od admina CSP-a“ | confidential computing |
| „danas snimaju, sutra dešifruju“ | quantum – harvest now, decrypt later |

> **Na ispitu:** ISC2 voli odgovore koji polaze od **poslovnih zahtjeva i rizika**. Ako su dvije opcije tehnički tačne, a jedna kaže „prvo utvrditi zahtjeve / klasifikovati podatke / procijeniti rizik“, ta je često BEST ili FIRST odgovor.

## Česte zamke

| Distraktor | Zašto je pogrešan |
|---|---|
| „CSP je odgovoran za podatke u SaaS-u jer upravlja aplikacijom.“ | podaci, pristup i klasifikacija su uvijek na customeru |
| „Multi-cloud i hybrid cloud su sinonimi.“ | hybrid = više tipova deploymenta, multi-cloud = više provajdera |
| „Private cloud mora biti on-premises.“ | private cloud može hostovati treća strana, bitno je da je za jednu organizaciju |
| „Elastičnost i skalabilnost su isto.“ | elastičnost je automatsko prilagođavanje u oba smjera |
| „SLA service credit štiti posao od gubitka.“ | credit je obično mali i ne zamjenjuje BC/DR |
| „Portability znači izlazak iz ugovora.“ | to je reversibility |

## Rezime

- **NIST SP 800-145**: 5 karakteristika, 3 modela usluga, 4 deployment modela. **ISO/IEC 17788** dodaje **multi-tenancy** kao šestu karakteristiku; **ISO/IEC 17789** definiše uloge i aktivnosti.
- Uloge: **customer, provider, partner** (developer, auditor, broker) i **regulator**; NIST dodaje **carrier**. Accountability za podatke ostaje kod **customera**.
- Karakteristike: **on-demand self-service, broad network access, resource pooling, multi-tenancy, rapid elasticity/scalability, measured service**, svaka sa svojom sigurnosnom posljedicom.
- Gradivni blokovi: **virtualizacija, storage, mreža (SDN), baze, orkestracija**; **management plane** je najkritičnija tačka.
- **Capability types** (application, platform, infrastructure) ↔ **kategorije** (SaaS, PaaS, IaaS). Što je model „viši“, customer kontroliše manje, ali **podaci i IAM su uvijek njegovi**.
- Deployment: **public, private, community, hybrid, multi-cloud**; hybrid ≠ multi-cloud.
- Shared considerations: posebno razlikuj **interoperability** (rade zajedno), **portability** (selidba) i **reversibility** (izlazak i brisanje).
- Srodne tehnologije: AI/ML, blockchain, IoT, kontejneri, **quantum** (PQC, harvest now decrypt later), **edge**, **confidential computing** (data in use, TEE).
