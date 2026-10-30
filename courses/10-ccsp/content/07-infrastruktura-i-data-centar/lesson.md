## Ciljevi ispita: 3.1, 3.2 i 3.3

Domen 3 (**Cloud Platform and Infrastructure Security**) nosi 17% pitanja. Ovaj modul gleda infrastrukturu iz dva ugla: kao **cloud customer** koji mora razumjeti na čemu radi i kao **provider ili organizacija koja gradi privatni cloud** i projektuje data centar. Ciljevi i pod-tačke:

- **3.1 Comprehend cloud infrastructure components**
  - fizičko okruženje (physical environment),
  - virtualizacija (virtualization),
  - mreža i komunikacije (network and communications),
  - storage,
  - compute,
  - management plane.
- **3.2 Design a secure data center**
  - logički dizajn (tenant partitioning, kontrola pristupa),
  - fizički dizajn (lokacija, kupiti ili graditi),
  - dizajn okruženja (HVAC, multi-vendor pathway connectivity),
  - dizajn otpornosti (napajanje, HVAC, konekcija).
- **3.3 Analyze risks associated with cloud infrastructure and platforms**
  - procjena rizika (identifikacija, analiza),
  - cloud ranjivosti, prijetnje i napadi,
  - strategije tretmana rizika.

Kontrole (3.4) i BC/DR (3.5) su u sljedećem modulu.

## Komponente cloud infrastrukture (3.1)

Svaki cloud, javni ili privatni, sastoji se od istih slojeva. Razlika je ko upravlja kojim slojem.

| Komponenta | Šta obuhvata | Ko je odgovoran u javnom cloudu |
|---|---|---|
| **Physical environment** | Data centri, zgrade, napajanje, hlađenje, serveri, mrežna oprema, kablovi | Provider (u svim modelima) |
| **Virtualization** | Hypervisor, kontejnerski runtime, apstrakcija hardvera | Provider; customer konfiguriše goste (IaaS) |
| **Network and communications** | Fizička mreža, SDN, virtuelne mreže, load balanceri, DNS, konekcije prema on-prem | Podijeljeno: provider fizička i SDN infrastruktura, customer virtuelne mreže i pravila |
| **Storage** | Blok, fajl, objektni storage, baze | Provider infrastruktura; customer podaci, pristup, enkripcija |
| **Compute** | VM-ovi, kontejneri, serverless funkcije | IaaS: customer OS i aplikacije; PaaS/SaaS: sve više provider |
| **Management plane** | Konzola, API, CLI, alati za orkestraciju i provisioning | Provider ga obezbjeđuje; customer štiti pristup svom tenantu |

### Fizičko okruženje

Fizičko okruženje je temelj: ako napadač ima fizički pristup, sve logičke kontrole se mogu zaobići. U javnom cloudu customer nema pristup data centru i nema pravo fizičke revizije; povjerenje se gradi kroz **izvještaje trećih strana** (SOC 2 Type II, ISO/IEC 27001, CSA STAR). Provider projektuje data centar za skalu: hiljade identičnih servera, standardizovana oprema, automatizovana zamjena kvarova.

### Virtualizacija

**Hypervisor** (virtual machine monitor) dijeli fizički hardver između više virtuelnih mašina.

| Tip | Opis | Primjeri | Sigurnost |
|---|---|---|---|
| **Type 1 (bare metal)** | Radi direktno na hardveru | VMware ESXi, Xen, KVM, Hyper-V, AWS Nitro | Manja površina napada; standard u cloudu |
| **Type 2 (hosted)** | Radi kao aplikacija na host OS-u | VirtualBox, VMware Workstation | Host OS je dodatna površina napada; za desktop i razvoj |

Rizici virtualizacije:

- **VM escape**: kod iz gosta probije hypervisor i dobije pristup hostu ili drugim gostima; najteži scenarij za multi-tenancy,
- **hypervisor kompromitacija**: ko kontroliše hypervisor, kontroliše sve goste,
- **side-channel napadi** preko dijeljenog hardvera (keš procesora, npr. klasa Spectre/Meltdown),
- **VM sprawl**: nekontrolisano umnožavanje VM-ova bez vlasnika i zakrpa,
- neaktivni (dormant) VM-ovi i stari image-i sa ranjivostima,
- **noisy neighbor**: jedan tenant troši resurse i degradira druge (prijetnja dostupnosti).

| Osobina | Virtuelna mašina | Kontejner | Serverless funkcija |
|---|---|---|---|
| Izolacija | Hypervisor, vlastiti kernel | Dijeljeni kernel, namespaces i cgroups | Provider (često mikro-VM) |
| Veličina i start | GB, minute | MB, sekunde | Milisekunde do sekunde |
| Customer odgovornost | OS, patching, aplikacija | Image, runtime konfiguracija, orkestracija | Kod, zavisnosti, ovlaštenja |
| Tipičan rizik | Nezakrpljen OS, sprawl | Privilegovani kontejneri, ranjivi image-i | Preširoka ovlaštenja, ranjive biblioteke |

**Kontejneri** dijele kernel hosta, pa je izolacija slabija nego između VM-ova; zato provideri često pokreću kontejnere različitih tenanta u odvojenim VM-ovima ili mikro-VM-ovima (npr. Firecracker kod AWS Lambda i Fargate).

### Mreža i komunikacije

Cloud mreže su **softverski definisane**. **SDN (Software-Defined Networking)** odvaja:

- **control plane**: odlučuje kuda saobraćaj ide (pravila, rute), centralizovan i programabilan,
- **data plane**: stvarno prosljeđuje pakete.

Prednosti: automatizacija, mikrosegmentacija, brza izmjena. Rizik: kompromitacija SDN kontrolera utiče na cijelu mrežu, pa se kontroler štiti kao management plane.

Ostali elementi: izolacija tenanta kroz overlay mreže (VXLAN, GENEVE) umjesto samo VLAN-ova (VLAN ima ograničenje od 4094 ID-a), virtuelne privatne mreže (VPC/VNet), security grupe i mrežni ACL-ovi, privatne konekcije prema on-prem (IPsec VPN, dedicated linkovi), DNS, load balanceri, CDN i zaštita od DDoS-a. Na ispitu očekuj i pojam **mikrosegmentacije** i zero trust pristupa (vidi domen 1).

### Storage

ISC2 klasifikuje storage po modelu usluge, i to se pita:

| Model | Tip storagea | Opis |
|---|---|---|
| **IaaS** | **Volume storage** (block) | Virtuelni disk prikačen VM-u (EBS, Azure Managed Disk) |
| | **Object storage** | Objekti sa metapodacima kroz API (S3, Azure Blob) |
| | **Ephemeral storage** | Privremeni disk koji nestaje sa instancom |
| **PaaS** | **Structured** | Relacione baze i managed baze |
| | **Unstructured** | Big data, objekti, NoSQL |
| **SaaS** | **Information storage and management** | Podaci uneseni kroz aplikaciju, u bazi koju vodi provider |
| | **Content and file storage** | Fajlovi pohranjeni u aplikaciji (npr. dijeljenje dokumenata) |
| Svi | **CDN** | Keširane kopije sadržaja na edge lokacijama |

Prijetnje storageu: neovlašten pristup i pogrešna konfiguracija (javni bucket), gubitak podataka, data remanence, ransomware, gubitak ključeva. Za otpornost provideri koriste replikaciju i **data dispersion** (erasure coding: podaci se dijele na fragmente sa paritetom raspoređene na više lokacija, pa gubitak dijela fragmenata ne znači gubitak podataka).

### Compute

Compute resursi su VM-ovi, kontejneri i serverless funkcije. Provider upravlja raspodjelom kroz:

| Mehanizam | Značenje |
|---|---|
| **Reservations** | Garantovani minimum resursa za gosta |
| **Limits** | Maksimum koji gost može potrošiti |
| **Shares** | Prioritet pri nadmetanju za resurse kada ih nema dovoljno |

Ovi mehanizmi štite dostupnost (protiv noisy neighbor efekta). Za customera, compute sigurnost u IaaS-u znači hardening image-a, patching, zaštitu metapodataka instance (IMDSv2 u AWS-u), a u serverlessu fokus prelazi na kod, zavisnosti i ovlaštenja.

### Management plane

**Management plane** je skup alata i API-ja kojima se upravlja cijelim cloud okruženjem: kreiranje i brisanje resursa, mreže, identiteta, ključeva. To je **najkritičnija komponenta**: kompromitacija management planea znači kompromitaciju svega u tenantu, bez ikakve potrebe za ranjivošću u aplikaciji.

Zaštita management planea (iz ugla customera):

- **MFA** za sve, posebno privilegovane naloge; zaštita root/global admin naloga (break-glass procedura),
- **least privilege** i odvajanje dužnosti, privremena (JIT) ovlaštenja,
- federacija sa korporativnim IdP-om umjesto lokalnih naloga,
- **logovanje svih API poziva** (CloudTrail, Azure Activity Log) u nepromjenjiv storage,
- zaštita i rotacija API ključeva; preferirati kratkotrajne kredencijale,
- ograničenja na nivou organizacije (SCP, Azure Policy) koja ni administrator naloga ne može zaobići.

Provider sa svoje strane štiti svoj interni management plane (pristup hypervisorima, alatima operatera) jakim odvajanjem mreža i strogo kontrolisanim pristupom osoblja.

### Odgovornost po komponentama i modelima usluge

| Komponenta | IaaS | PaaS | SaaS |
|---|---|---|---|
| Fizičko okruženje | Provider | Provider | Provider |
| Virtualizacija / hypervisor | Provider | Provider | Provider |
| Mreža (virtuelna) | Customer konfiguriše | Djelimično customer (pristup, endpointi) | Provider |
| OS gosta | Customer | Provider | Provider |
| Runtime, middleware | Customer | Provider | Provider |
| Aplikacija | Customer | Customer | Provider |
| Podaci, identiteti, pristup | Customer | Customer | Customer |

Red „podaci, identiteti, pristup“ je uvijek na customeru, bez obzira na model. To je ključna poruka shared responsibility modela.

> **Na ispitu:** ako pitanje traži komponentu čija kompromitacija ima NAJVEĆI uticaj na cloud customera, odgovor je **management plane** (konzola i API sa administratorskim pravima). Zaštita počinje sa **MFA, least privilege i logovanjem** administratorskog pristupa.

## Dizajn sigurnog data centra (3.2)

Ovaj cilj je relevantan za providera, za organizaciju koja gradi privatni cloud i za customera koji ocjenjuje providera ili colocation.

### Logički dizajn

| Element | Opis |
|---|---|
| **Tenant partitioning** | Izolacija tenanta: odvojene virtuelne mreže, hypervisor izolacija, odvojeni ključevi enkripcije po tenantu, logičke particije storagea; po potrebi dedicated hostovi |
| **Access control** | Ko smije upravljati kojom infrastrukturom: RBAC za operatere, odvojeni administratorski nalozi, PAM, JIT pristup, MFA |
| **Odvojene mreže** | Management mreža odvojena od mreže tenanta i mreže za storage; out-of-band upravljanje |
| **Sigurni baseline-i** | Standardizovane, hardenovane konfiguracije hostova i hypervisora |
| **Logovanje i monitoring** | Svi administratorski pristupi infrastrukturi se loguju i prate |

Logički dizajn treba da omogući i **API-driven** upravljanje, automatizaciju i provjeru usklađenosti, jer ručne operacije u skali ne funkcionišu.

### Fizički dizajn: lokacija

Izbor lokacije je odluka o riziku:

| Faktor | Pitanje |
|---|---|
| Prirodne opasnosti | Poplave, zemljotresi, uragani, šumski požari; udaljenost od rijeka i rasjeda |
| Ljudske opasnosti | Blizina aerodroma, hemijskih postrojenja, autoputeva sa opasnim teretom |
| Infrastruktura | Pouzdanost elektro mreže, više nezavisnih napojnih vodova, dostupnost vode za hlađenje, telekom konekcije |
| Pravo i politika | Jurisdikcija, politička stabilnost, zakoni o podacima, poreske olakšice |
| Klima | Hladnija klima smanjuje trošak hlađenja (free cooling) |
| Ljudi i logistika | Dostupnost kvalifikovanog osoblja, pristup za servis i gorivo |
| Udaljenost između lokacija | Dovoljno daleko da ista katastrofa ne pogodi oba centra, dovoljno blizu za latenciju replikacije |

Unutar lokacije: perimetar (ograde, barijere protiv vozila, rasvjeta), kontrolisani ulazi (mantrap, biometrija), zone sa rastućom kontrolom pristupa, video nadzor, zaštitari, nemarkirana zgrada, zaštita od požara (detekcija, gas-based gašenje u serverskim salama), kablovski putevi.

### Kupiti, graditi ili zakupiti

| Opcija | Prednosti | Nedostaci |
|---|---|---|
| **Build** (izgraditi vlastiti) | Puna kontrola nad dizajnom, lokacijom i sigurnošću | Visok početni trošak (CapEx), dugo vrijeme izgradnje, potrebna stručnost |
| **Buy** (kupiti postojeći) | Brže od izgradnje | Nasljeđuješ dizajn i ograničenja; potrebna detaljna provjera |
| **Lease / colocation** | Nizak početni trošak, brz početak, provider gradi i održava zgradu | Dijeljena lokacija, manje kontrole, oslanjanje na ugovor i izvještaje |
| **Javni cloud** | Nema data centra uopšte, elastičnost | Najmanje kontrole nad fizičkim slojem, zavisnost od providera |

Odluka je poslovna: trošak, rizik, zahtjevi usklađenosti, vremenski okvir i strategija.

### Dizajn okruženja: HVAC

**HVAC (Heating, Ventilation, and Air Conditioning)** održava temperaturu i vlažnost u granicama koje oprema podnosi.

- **ASHRAE** smjernice (TC 9.9) daju preporučeni opseg temperature ulaznog vazduha za IT opremu od **18 do 27 °C** (64,4–80,6 °F) i ograničenja vlažnosti preko tačke rose; previše vlage vodi kondenzaciji i koroziji, premalo statičkom elektricitetu.
- **Hot aisle / cold aisle** raspored ormara: prednje strane ormara gledaju u hladni prolaz, zadnje u topli; **containment** (zatvaranje prolaza) sprečava miješanje vazduha.
- Redundantne rashladne jedinice, monitoring senzorima, efikasnost se mjeri kroz **PUE** (Power Usage Effectiveness = ukupna energija objekta / energija IT opreme; idealno 1,0).

### Multi-vendor pathway connectivity

Konekcija prema internetu i drugim lokacijama mora biti otporna:

- više **nezavisnih telekom providera** (multi-vendor),
- kablovi ulaze u zgradu kroz **fizički odvojene ulaze i trase** (diverse pathways), da jedan bager ne prekine sve linkove,
- provjera da dva providera ne dijele istu fizičku trasu ili istu centralu (inače je redundansa samo na papiru),
- redundantna mrežna oprema i rute (BGP sa više providera).

> **Na ispitu:** „dva ISP-a“ nije isto što i otporna konekcija. Ako oba linka prolaze istom kablovskom trasom ili kroz isti ulaz u zgradu, postoji **single point of failure**. BEST odgovor traži **fizički odvojene puteve** od različitih providera.

### Dizajn otpornosti

Otpornost se gradi redundansom u napajanju, hlađenju i konekcijama. Notacija:

| Notacija | Značenje |
|---|---|
| **N** | Tačno onoliko kapaciteta koliko je potrebno; bez redundanse |
| **N+1** | Jedna rezervna komponenta više od potrebnog |
| **2N** | Potpuno duplirani sistem (dvije nezavisne staze) |
| **2N+1** | Duplirani sistem plus još jedna rezervna komponenta |

Napajanje:

- dva nezavisna napojna voda iz različitih trafostanica gdje je moguće,
- **UPS** premošćava prekid dok generator ne preuzme (sekunde do minuta) i štiti od kvaliteta napona,
- **generatori** sa gorivom na lokaciji za više sati ili dana i ugovorima o prioritetnoj dopremi goriva,
- **PDU** i dvostruki izvori napajanja u serverima povezani na odvojene staze (A i B).

**Uptime Institute Tier** klasifikacija (vrlo česta na ispitu):

| Tier | Naziv | Ključna osobina | Često citirana dostupnost |
|---|---|---|---|
| **I** | Basic Capacity | Jedna staza, bez redundantnih komponenti; održavanje traži gašenje | 99,671% |
| **II** | Redundant Capacity Components | Redundantne komponente (N+1), ali jedna distributivna staza | 99,741% |
| **III** | Concurrently Maintainable | Svaka komponenta se može održavati bez gašenja; više staza (jedna aktivna) | 99,982% |
| **IV** | Fault Tolerant | Podnosi bilo koji pojedinačni kvar bez uticaja; više aktivnih, fizički odvojenih staza (2N) | 99,995% |

Uptime Institute zvanično definiše tierove po **topologiji i ponašanju**, a procenti dostupnosti su industrijska aproksimacija. Sličnu klasifikaciju daje **ANSI/TIA-942** (Rated 1–4), a **BICSI 002** pokriva najbolje prakse dizajna.

> **Na ispitu:** razlikuj **concurrently maintainable** (Tier III: planirano održavanje bez prekida) od **fault tolerant** (Tier IV: neplaniran kvar bilo koje komponente bez prekida). Ako scenario traži da kvar jedne komponente ne prekine rad, traži se Tier IV.

### Pitanja za ocjenu data centra providera ili colocationa

Customer koji ne može obići data centar postavlja pitanja kroz upitnike (npr. **CSA CAIQ**) i provjerava odgovore u audit izvještajima:

- Koji Uptime Tier ili TIA-942 rating ima objekat i da li je certifikovan dizajn ili i izgrađeni objekat?
- Kolika je redundansa napajanja i hlađenja (N+1, 2N) i za koliko sati ima goriva na lokaciji?
- Koliko nezavisnih telekom providera i fizički odvojenih ulaza postoji?
- Kako je riješena fizička kontrola pristupa i ko ima pristup (uključujući podizvođače)?
- Koliko često se testiraju generatori i prelazak na rezervno napajanje?
- Kako se sanitizuju i uništavaju neispravni diskovi?
- Koji nezavisni izvještaji pokrivaju objekat (SOC 2 Type II, ISO/IEC 27001)?

## Analiza rizika cloud infrastrukture (3.3)

### Procjena rizika

Proces prema **ISO 31000** i **NIST SP 800-30**:

1. **Identifikacija**: imovina (podaci, sistemi, servisi), prijetnje, ranjivosti, postojeće kontrole.
2. **Analiza**: vjerovatnoća i uticaj.
3. **Evaluacija**: poređenje sa **risk appetite** (koliki rizik organizacija generalno prihvata) i **risk tolerance** (prihvatljivo odstupanje).
4. **Tretman**, praćenje i izvještavanje (risk register).

| Analiza | Kako | Prednost | Nedostatak |
|---|---|---|---|
| **Kvalitativna** | Skale (nisko/srednje/visoko), matrica vjerovatnoće i uticaja | Brza, razumljiva, ne treba precizne podatke | Subjektivna |
| **Kvantitativna** | Novčani iznosi i učestalosti | Objektivnija, pogodna za cost-benefit | Traži podatke koji često ne postoje |

Kvantitativne formule:

- **SLE** (Single Loss Expectancy) = **AV** (Asset Value) × **EF** (Exposure Factor),
- **ALE** (Annualized Loss Expectancy) = SLE × **ARO** (Annualized Rate of Occurrence).

Primjer: baza vrijedi 500.000 KM, curenje bi uništilo 40% vrijednosti (EF 0,4): SLE = 200.000 KM. Očekuje se jednom u pet godina (ARO 0,2): ALE = 40.000 KM. Kontrola koja godišnje košta 60.000 KM, a smanjuje ALE na 10.000 KM, nije isplativa (ušteda 30.000 KM < trošak 60.000 KM).

U cloudu procjena rizika uključuje i **rizike same odluke o cloudu**: zavisnost od providera, jurisdikciju, gubitak kontrole i vidljivosti, multi-tenancy.

> **Na ispitu:** prije izbora kontrole menadžer **procjenjuje rizik** (identifikacija i analiza), a kontrola mora koštati manje od rizika koji smanjuje. Odgovor „odmah uvesti najjaču tehničku kontrolu“ bez procjene je obično pogrešan.

### Cloud ranjivosti, prijetnje i napadi

CSA **Top Threats to Cloud Computing** (izdanje 2024) ističe da su najveći rizici danas uglavnom na strani customera:

| Prijetnja (CSA 2024) | Primjer |
|---|---|
| Misconfiguration i loša kontrola promjena | Javni bucket, otvorena baza, preširoka security grupa |
| Identity and access management | Preširoka ovlaštenja, ukradeni ključevi, nema MFA |
| Nesigurni interfejsi i API-ji | API bez autentifikacije ili rate limitinga |
| Neadekvatna cloud sigurnosna strategija | Lift-and-shift bez prilagođavanja kontrola |
| Nesigurni resursi trećih strana | Kompromitovane biblioteke, image-i, SaaS integracije |
| Nesigurni razvoj softvera | Tajne u kodu, ranjive zavisnosti |
| Slučajno otkrivanje podataka | Pogrešno podijeljeni linkovi, snapshoti |
| Sistemske ranjivosti | Nezakrpljeni OS i softver |
| Ograničena vidljivost | Nema logova, shadow IT |
| Neautentifikovano dijeljenje resursa | Javni linkovi, javni snapshoti |
| Napredne trajne prijetnje (APT) | Ciljani, dugotrajni napadi |

Rizici specifični za cloud infrastrukturu i platformu:

| Kategorija | Rizici |
|---|---|
| Multi-tenancy | VM escape, side-channel, nepotpuna izolacija, noisy neighbor |
| Management plane | Preuzimanje administratorskog naloga, zloupotreba API ključeva |
| Provider | Insajder kod providera, bankrot, prestanak usluge, promjena uslova |
| **Vendor lock-in** | Vlasnički formati i servisi otežavaju prelazak; rizik po portabilnost i BC |
| Pravni | Jurisdikcija, zahtjevi stranih vlasti, eDiscovery nad dijeljenom infrastrukturom |
| Dostupnost | Regionalni ispadi, DDoS, iscrpljivanje resursa, greške u konfiguraciji providera |
| Podaci | Data remanence, neadekvatno brisanje, curenje kroz loše podijeljene resurse |
| Lanac snabdijevanja | Kompromitovani image-i iz marketplacea, hardverske komponente |

Napadi koje treba prepoznati: krađa kredencijala i zloupotreba API-ja, kriptomajning na kompromitovanim nalozima, ransomware nad cloud storageom, DDoS i **economic denial of sustainability** (napad koji tjera autoscaling i pravi ogroman račun), VM escape, side-channel, SSRF prema servisu metapodataka instance.

### Strategije tretmana rizika

| Strategija | Opis | Cloud primjer |
|---|---|---|
| **Avoid** (izbjegavanje) | Odustati od aktivnosti koja nosi rizik | Ne seliti regulisane podatke u javni cloud |
| **Mitigate / reduce** (ublažavanje) | Uvesti kontrole koje smanjuju vjerovatnoću ili uticaj | Enkripcija, MFA, multi-region arhitektura |
| **Transfer / share** (prenos) | Prenijeti finansijski uticaj na treću stranu | Cyber osiguranje, ugovorne obaveze i SLA krediti providera |
| **Accept** (prihvatanje) | Svjesno prihvatiti rizik unutar apetita, uz odobrenje vlasnika rizika | Prihvatiti rizik kratkog ispada nekritičnog servisa |

Primjeri tretmana za tipične rizike infrastrukture:

| Rizik | Mitigacija | Transfer | Prihvatanje (kada) |
|---|---|---|---|
| Kompromitacija management planea | MFA, PAM, SCP, logovanje | Osiguranje | Nikad bez mitigacije |
| Regionalni ispad | Multi-region, DR plan | SLA krediti (samo djelimično) | Nekritični sistemi sa dugim RTO |
| Vendor lock-in | Portabilni formati, IaC, izlazna strategija | Ugovorne klauzule o izlasku | Kada je korist vlasničkih servisa veća od rizika |
| VM escape / side-channel | Patching, dedicated hostovi za osjetljive workloade | Ugovorna odgovornost providera | Za podatke niske osjetljivosti |

Važne nijanse:

- **odgovornost (accountability) se ne može prenijeti**: customer ostaje odgovoran za svoje podatke i usklađenost i kada koristi providera ili osiguranje,
- **rezidualni rizik** je ono što ostaje nakon tretmana i mora biti formalno prihvaćen,
- prihvatanje rizika odobrava **vlasnik rizika** (rukovodstvo), ne tehnički tim,
- ignorisanje rizika nije strategija.

> **Na ispitu:** „Kompanija je kupila cyber osiguranje i premjestila podatke u cloud, pa više nije odgovorna za curenje“ je netačno. Transfer prenosi **finansijski uticaj**, ne **odgovornost** prema regulatoru i klijentima.

## Scenario: regionalni provider gradi privatni cloud

Regionalni telekom gradi privatni cloud za javni sektor.

1. **Komponente**: Type 1 hypervisor na standardizovanim serverima, SDN sa odvojenom management mrežom, objektni i blok storage sa erasure codingom, portal i API kao management plane sa MFA i logovanjem.
2. **Lokacija**: odbačena lokacija uz rijeku (poplavna zona); izabrana lokacija sa dva napojna voda iz različitih trafostanica i dvije telekom trase.
3. **Build vs colocation**: zbog zahtjeva o suverenitetu i kontroli bira se vlastita izgradnja; druga lokacija za DR je u colocationu 120 km dalje.
4. **Otpornost**: cilj Tier III (concurrently maintainable), UPS + generatori sa gorivom za 72 sata, rashlađivanje N+1 sa hot/cold aisle containmentom.
5. **Logički dizajn**: tenant partitioning kroz odvojene virtuelne mreže i ključeve po tenantu; operateri koriste PAM sa JIT pristupom.
6. **Rizik**: identifikovani su VM escape, kompromitacija management planea i regionalni ispad napajanja. Tretman: mitigacija (patching hypervisora, MFA i PAM, generatori), transfer (osiguranje), prihvatanje rezidualnog rizika od strane uprave.

## Rezime

- Cloud infrastruktura: **physical environment, virtualization, network, storage, compute, management plane**; management plane je najkritičniji.
- **Type 1** hypervisor je standard u cloudu; rizici virtualizacije su VM escape, side-channel, sprawl, noisy neighbor.
- **SDN** odvaja control plane od data planea; kontroler se štiti kao management plane.
- Storage po modelu: IaaS volume/object/ephemeral, PaaS structured/unstructured, SaaS information storage i content/file storage, plus CDN.
- Compute resursi se dijele kroz **reservations, limits, shares**.
- Data centar: logički (tenant partitioning, access control), fizički (lokacija, build/buy/lease), okruženje (HVAC po ASHRAE, hot/cold aisle), konekcije (multi-vendor, fizički odvojene trase).
- Otpornost: N, N+1, 2N; **Uptime Tier I–IV**: Tier III concurrently maintainable, Tier IV fault tolerant.
- Procjena rizika: identifikacija, analiza (kvalitativna, kvantitativna: SLE = AV × EF, ALE = SLE × ARO), evaluacija prema apetitu.
- Najveće cloud prijetnje su misconfiguration i IAM (CSA Top Threats); uz to multi-tenancy, lock-in, pravni i provider rizici.
- Tretman: **avoid, mitigate, transfer, accept**; odgovornost se ne prenosi, rezidualni rizik prihvata vlasnik rizika.
