## Ciljevi ispita: 5.1, 5.2 i 5.3

Domen 5 (**Cloud Security Operations**) nosi 17% ispita. Ovaj modul pokriva operativni rad na infrastrukturi i operativne standarde; forenzika, SOC i incident management (5.4–5.6) su u sljedećem modulu.

- **5.1 Build and implement physical and logical infrastructure for cloud environment**
  - hardware specific security configuration requirements (HSM, TPM),
  - secure by default,
  - installation and configuration of management plane tools,
  - virtual hardware specific security configuration requirements (network, storage, memory, CPU, hypervisor type 1 and 2),
  - installation of guest OS virtualization toolsets.
- **5.2 Operate and maintain physical and logical infrastructure for cloud environment**
  - access controls for local and remote access (RDP, secure terminal access, SSH, console-based access, jumpboxes, virtual client, SSO),
  - secure network configuration (VLAN, TLS, DHCP, DNSSEC, VPN),
  - network security controls (firewalls, IDS, IPS, honeypots, vulnerability assessments, network security groups, bastion host, segmentation),
  - OS hardening through baselines, monitoring and remediation (Windows, Linux, VMware),
  - patch management,
  - availability of guest OS,
  - availability of clustered hosts (distributed resource scheduling, dynamic optimization, storage clusters, maintenance mode, HA),
  - performance and capacity monitoring (network, compute, storage, response time),
  - hardware monitoring (disk, CPU, fan speed, temperature),
  - configuration of host and guest OS backup and restore functions,
  - management plane (scheduling, orchestration, maintenance).
- **5.3 Implement operational controls and standards**: NIST, ISO, HIPAA, COBIT, CIS Controls, COSO, ITIL, ISO/IEC 20000-1.

Važno za perspektivu: mnoge stavke iz 5.1 i 5.2 (hardver, hipervizor, klasteri hostova, temperatura ventilatora) u javnom cloudu radi **CSP**. Ispit ih ipak pita jer CCSP kandidat može raditi i kod CSP-a ili graditi privatni cloud, a kao kupac mora znati šta da traži od CSP-a i kako to provjeriti (SOC 2, ISO 27001, ugovor). Uvijek se pitaj: **ko je ovdje odgovoran po modelu usluge?**

| Operativni zadatak | IaaS | PaaS | SaaS |
|---|---|---|---|
| Fizički hardver, HSM/TPM u hostovima, hlađenje, monitoring ventilatora | CSP | CSP | CSP |
| Hipervizor, klasteri hostova, DRS, maintenance mode | CSP | CSP | CSP |
| Guest OS: hardening, patching, toolset, backup | kupac | CSP | CSP |
| Runtime, middleware, baza kao servis | kupac | CSP (kupac konfiguriše) | CSP |
| Virtuelna mreža: subneti, NSG, firewall pravila, VPN | kupac | dijeljeno | CSP |
| Pristup za upravljanje (SSH, RDP, bastion) | kupac | uglavnom nema | nema |
| Identiteti, MFA, uloge u management planeu | kupac | kupac | kupac |
| Podaci, klasifikacija, enkripcija i ključevi | kupac | kupac | kupac (uz opcije CSP-a) |
| Logovanje i monitoring vlastitih resursa | kupac | kupac | kupac (koliko SaaS dozvoljava) |

Ono što ostaje kod CSP-a kupac ne može sam konfigurisati, ali može i mora **verifikovati**: kroz SOC 2 Type II, ISO/IEC 27001/27017 certifikate, CSA STAR registar, ugovor i SLA. Ono što je kod kupca, kupac mora i konfigurisati i dokazati revizoru.

Primjer razmišljanja: ako revizor traži dokaz da se hipervizori u IaaS okruženju redovno patchuju, kupac ne prikuplja logove sa hipervizora (nema pristup), nego dostavlja SOC 2 Type II izvještaj CSP-a i provjerava relevantne kontrole i izuzetke u njemu, uz komplementarne kontrole kupca (CUEC) koje sam mora ispuniti.

## Hardverske sigurnosne komponente (5.1)

### HSM i TPM

| Kriterij | **HSM** (Hardware Security Module) | **TPM** (Trusted Platform Module) |
|---|---|---|
| Oblik | namjenski uređaj (mrežni, PCIe kartica) ili cloud servis | čip na matičnoj ploči ili firmware (fTPM), vTPM za VM |
| Namjena | generisanje, čuvanje i upotreba ključeva za mnogo aplikacija; visoke performanse | integritet i identitet jedne platforme: measured boot, sealing ključeva, atestacija |
| Ključevi | ključevi organizacije, CA ključevi, ključevi za plaćanja | ključevi vezani za konkretan uređaj (endorsement key, storage root key) |
| Certifikacija | FIPS 140-2/140-3 (Level 3 tipično), Common Criteria | TCG specifikacija (TPM 2.0), FIPS za neke implementacije |
| Cloud primjer | AWS CloudHSM, Azure Managed HSM, KMS koristi HSM ispod | Nitro/shielded VM sa vTPM-om, BitLocker ključ u TPM-u |
| Zaštita od neovlaštenog pristupa | tamper-evident / tamper-resistant / tamper-responsive (briše ključeve) | ograničena fizička zaštita, otpornost na softverske napade |

Sigurnosni zahtjevi pri konfiguraciji HSM-a:

- **razdvajanje uloga** (security officer, crypto user, auditor), **M of N** kontrola za osjetljive operacije (npr. 3 od 5 ključnih skrbnika),
- backup ključeva u drugi HSM ili zaštićen omot, nikad u plaintextu,
- mrežna izolacija HSM-a i autentifikacija klijenata,
- logovanje svih operacija i nadzor,
- firmware pod kontrolom i ažuriran po proceduri proizvođača.

TPM se koristi za **secure boot** i **measured boot**: svaka komponenta boot lanca se mjeri (hash) u PCR registre, pa se može dokazati (atestirati) da host nije izmijenjen prije nego što dobije ključeve ili workloade. U cloudu ovo omogućava **trusted compute pools**: osjetljivi workloadi se raspoređuju samo na atestirane hostove.

> **Na ispitu:** HSM je za **ključeve organizacije** i kriptografske operacije na skali, TPM je za **integritet i identitet jedne mašine**. Kada pitanje traži FIPS 140 Level 3 zaštitu ključa sa isključivom kontrolom kupca u cloudu, odgovor je dedicated (single-tenant) cloud HSM, ne multi-tenant KMS.

### Secure by default

**Secure by default** znači da je proizvod ili sistem siguran odmah po instalaciji, bez dodatnih koraka: nepotrebne usluge isključene, nema default lozinki, enkripcija uključena, logovanje uključeno, minimalne dozvole, javni pristup isključen. Srodni pojmovi su **secure by design** (sigurnost ugrađena u dizajn) i **secure in deployment**. CISA inicijativa „Secure by Design“ stavlja teret na proizvođače da isporuče sigurne podrazumijevane postavke.

Primjeri u cloudu: blokiran javni pristup storageu na nivou naloga, enkripcija novih volumena podrazumijevano uključena, IMDSv2 obavezan, default security grupa bez ulaznih pravila, guardrails kroz organizacijske politike (SCP, Azure Policy) koje zabranjuju nesigurne konfiguracije.

| Princip | Pitanje | Primjer |
|---|---|---|
| Secure by design | da li je sigurnost u arhitekturi? | odvojeni nalozi po okruženju, zero trust |
| Secure by default | da li je početno stanje sigurno? | javni pristup isključen, enkripcija uključena |
| Secure in deployment | da li je sigurno i nakon instalacije i promjena? | hardening baseline, drift detekcija |

## Management plane (5.1 i 5.2)

**Management plane** je skup alata i interfejsa kojima se upravlja cijelim cloud okruženjem: web konzola, CLI, API, orkestracijski alati, hipervizor management (npr. vCenter), IaC alati. Kompromis management planea je najgori mogući scenarij: napadač kontroliše sve resurse, može ih obrisati, kopirati snapshotove ili isključiti logovanje.

Instalacija i konfiguracija alata management planea (5.1):

- **izolovana management mreža** (out-of-band ili odvojen VLAN/VPC), bez pristupa sa interneta osim kroz kontrolisane tačke,
- **jaka autentifikacija** (phishing-resistant MFA), SSO preko centralnog IdP-a, break-glass nalozi,
- **least privilege i RBAC**, odvojene uloge za mrežu, compute, storage, sigurnost i audit,
- **logovanje svih akcija** na management planeu u nepromjenjivo, odvojeno skladište (u AWS-u organization CloudTrail u log archive nalogu),
- hardening i patching samih alata (vCenter, orkestrator, CI/CD),
- provjera integriteta instalacionih paketa (hash, potpis).

Operativne funkcije management planea (5.2):

| Funkcija | Opis | Sigurnosni aspekt |
|---|---|---|
| **Scheduling** | raspoređivanje workloada na hostove i zadataka u vremenu | ne smještati osjetljive workloade na neatestirane hostove; planirati održavanje van špica |
| **Orchestration** | automatizovano kreiranje, povezivanje i skaliranje resursa | IaC pod change controlom, zaštita kredencijala orkestratora |
| **Maintenance** | patching, upgrade, zamjena hardvera | maintenance mode, live migracija, komunikacija prema kupcima, change management |

> **Na ispitu:** management plane je najvrijednija meta u cloudu. Kada se pita koja kontrola je NAJVAŽNIJA za administrativni pristup cloud konzoli, odgovor je jaka (phishing-resistant) MFA uz least privilege i logovanje, a ne mrežni firewall, jer je konzola po definiciji dostupna preko interneta.

## Virtuelni hardver i hipervizor (5.1)

### Tipovi hipervizora

| Kriterij | **Type 1** (bare metal) | **Type 2** (hosted) |
|---|---|---|
| Gdje radi | direktno na hardveru | kao aplikacija na host OS-u |
| Primjeri | VMware ESXi, Microsoft Hyper-V, Xen, KVM (u kernelu), AWS Nitro | VMware Workstation, Oracle VirtualBox, Parallels |
| Napadna površina | manja (nema opšteg OS-a ispod) | veća: ranjivosti host OS-a ugrožavaju sve VM-ove |
| Performanse | visoke | niže |
| Upotreba | data centri, cloud | razvoj, testiranje, desktop |

Cloud provajderi koriste Type 1 hipervizore. Type 2 nikad nije prikladan za produkcijski multitenant cloud.

Glavne prijetnje hipervizoru: **VM escape** (bijeg iz gosta na hipervizor), **side-channel napadi** preko dijeljenog CPU keša, **VM sprawl** (nekontrolisano umnožavanje VM-ova), **hyperjacking** (instaliranje zlonamjernog hipervizora), neovlašten pristup snapshotovima i imagima.

### Sigurnosna konfiguracija virtuelnog hardvera

| Resurs | Rizik | Konfiguracija |
|---|---|---|
| **Mreža** | sniffing i spoofing u virtuelnom switchu, east-west kretanje | virtuelni switch sa odbacivanjem promiscuous moda, MAC spoofinga i forged transmits; VLAN/VXLAN segmentacija; mikrosegmentacija; odvojena management, storage i vMotion mreža |
| **Storage** | pristup tuđim podacima, ostaci podataka (data remanence) | enkripcija volumena, LUN masking/zoning, brisanje (zeroing) prije ponovne dodjele, odvojena storage mreža |
| **Memorija** | čitanje memorije drugih VM-ova, ballooning i swap koji izlažu podatke | memorijska izolacija, enkripcija memorije (AMD SEV, Intel TDX), isključiti deduplikaciju stranica (TPS) između VM-ova radi side-channel rizika, zaštita swap fajlova |
| **CPU** | side-channel (Spectre, Meltdown, L1TF), noisy neighbor | mikrokod i patch hipervizora, core scheduling / isključen SMT za osjetljive workloade, rezervacije i limiti, dedicated hostovi |
| **Hipervizor** | VM escape, neovlaštena administracija | minimalna instalacija, patching, secure boot i TPM atestacija, lockdown mode, odvojena management mreža, logovanje |

Dodatne preporuke za VM-ove: ukloniti nepotrebni virtuelni hardver (floppy, CD, serijski i USB portovi), isključiti copy/paste i drag-and-drop između konzole i gosta u produkciji, ograničiti pristup konzoli VM-a.

### Instalacija guest OS virtualization toolseta

**Guest OS virtualization toolset** (npr. VMware Tools, Hyper-V Integration Services, cloud agenti kao AWS SSM Agent, Azure VM Agent, QEMU guest agent) je softver u gostu koji poboljšava performanse i integraciju: optimizovani drajveri, sinhronizacija vremena, graceful shutdown, quiescing za konzistentne snapshotove, heartbeat, upravljanje iz management planea.

Sigurnosni aspekti:

- toolset ima **privilegovan kanal** između gosta i hipervizora, pa je dio napadne površine,
- instalirati iz pouzdanog izvora, provjeriti potpis, držati ga ažurnim kroz patch management,
- instalirati samo potrebne komponente i isključiti nepotrebne funkcije (npr. dijeljenje fajlova sa hostom),
- kontrolisati ko kroz management plane smije koristiti agent za izvršavanje komandi u gostu (npr. SSM Run Command ovlasti su ekvivalent root pristupa).

## Pristup za upravljanje: lokalni i udaljeni (5.2)

| Metoda | Upotreba | Rizici | Kontrole |
|---|---|---|---|
| **RDP** (Remote Desktop Protocol) | grafički pristup Windows hostovima | brute force, ranjivosti protokola, izlaganje porta 3389 internetu | nikad direktno na internet; kroz VPN, jumpbox ili RD Gateway; NLA (Network Level Authentication); MFA; TLS |
| **SSH** (Secure Shell) | terminal na Linux/Unix | krađa privatnih ključeva, slabe lozinke, nekontrolisani authorized_keys | samo ključevi ili SSH certifikati (kratkotrajni), zabrana root logina i lozinki, MFA, centralno upravljanje ključevima |
| **Secure terminal access** | opšti pojam za šifrovan i autentifikovan terminalski pristup | telnet i drugi nešifrovani protokoli | samo šifrovani protokoli, logovanje sesija |
| **Console-based access** | konzola VM-a kroz hipervizor ili cloud serijska konzola | zaobilazi mrežne kontrole guest OS-a | strogi RBAC, MFA, logovanje, samo za oporavak |
| **Jumpbox / bastion host** | jedna ojačana tačka ulaza u privatnu mrežu | ako je kompromitovan, otvara sve | hardening, MFA, snimanje sesija, minimalni softver, patching, ograničen izvorni IP |
| **Virtual client** (VDI, virtuelni desktop) | administratori i korisnici rade sa centralno upravljanog desktopa | dijeljena infrastruktura | podaci ne napuštaju data centar, privileged access workstations |
| **SSO** | jedan identitet za sve alate | IdP kao single point of failure | jak MFA, break-glass nalozi |

Moderan trend su **identity-aware proxy** i managed session servisi (npr. AWS Systems Manager Session Manager, Azure Bastion, GCP IAP) koji daju shell ili RDP bez otvorenih ulaznih portova i bez dugotrajnih SSH ključeva, uz IAM autorizaciju i logovanje svake sesije. Za administratore se preporučuju **privileged access workstations** (PAW): ojačani uređaji koji služe samo za administraciju.

> **Na ispitu:** ako scenarij opisuje RDP ili SSH izložen internetu na svakom serveru, NAJBOLJI odgovor je centralizovati pristup kroz bastion/jumpbox ili managed session servis sa MFA i logovanjem, i zatvoriti direktne portove. „Promijeniti port na nestandardni“ je security through obscurity i nikad nije najbolji odgovor.

## Sigurna mrežna konfiguracija (5.2)

| Tehnologija | Svrha | Sigurnosna napomena |
|---|---|---|
| **VLAN** | logička segmentacija L2 mreže | VLAN hopping (double tagging, switch spoofing); ne koristiti native VLAN za saobraćaj, isključiti DTP; u cloudu se umjesto VLAN-a koriste VPC/VNet i subneti, a u data centrima VXLAN zbog limita od 4094 VLAN-a |
| **TLS** | povjerljivost i integritet u prenosu | TLS 1.2 minimum, poželjno 1.3; isključiti stare verzije i slabe šifre; upravljanje certifikatima; mTLS za servise |
| **DHCP** | automatska dodjela IP adresa | rogue DHCP server i DHCP starvation; **DHCP snooping** na switchevima; u cloudu DHCP upravlja CSP |
| **DNSSEC** | integritet i autentičnost DNS odgovora (potpisi) | štiti od DNS cache poisoninga i spoofinga; **ne šifruje** upite (za privatnost: DoH/DoT) |
| **VPN** | šifrovan tunel preko nepovjerljive mreže | IPsec (site-to-site, L3) ili TLS/SSL VPN (udaljeni korisnici); MFA; split tunneling je rizik; za zero trust se prelazi na ZTNA |

Razlika koja se često pita: **DNSSEC daje integritet i autentičnost porijekla, ne povjerljivost.** Ako je zahtjev da niko na mreži ne vidi koje domene korisnici traže, odgovor je DNS over HTTPS/TLS, ne DNSSEC.

## Mrežne sigurnosne kontrole (5.2)

| Kontrola | Funkcija | Napomena za cloud |
|---|---|---|
| **Firewall** | filtriranje saobraćaja: stateless (paketni), stateful, NGFW (L7, identitet korisnika, IPS) | cloud-native firewall servisi ili virtuelni appliance; host firewall u gostu |
| **IDS** (Intrusion Detection System) | otkriva i alarmira, pasivan | u cloudu preko traffic mirroringa ili flow logova; HIDS na hostu |
| **IPS** (Intrusion Prevention System) | inline, blokira | lažni pozitivi mogu prekinuti legitiman saobraćaj; uticaj na latenciju |
| **Honeypot / honeynet** | mamac za otkrivanje i proučavanje napadača | mora biti izolovan; pravna pitanja (ne smije se koristiti kao **entrapment**, nego **enticement**); honeytokeni (lažni kredencijali) su lagana varijanta |
| **Vulnerability assessment** | periodično i kontinuirano skeniranje ranjivosti | provjeriti politiku CSP-a o skeniranju; autentifikovano skeniranje daje tačnije rezultate; agent-based za efemerne instance |
| **Network security groups** | stateful filtriranje na nivou instance ili mrežne kartice | default deny ulazno; reference na druge grupe umjesto IP opsega |
| **Bastion host** | ojačana tačka ulaza za administraciju | jedini host sa javnim pristupom za upravljanje |
| **Segmentation** | razdvajanje mreže u zone po povjerenju i funkciji | subneti, VPC-ovi, mikrosegmentacija (po workloadu), odvojeni nalozi |

Usporedba IDS i IPS po posljedici greške:

| Kriterij | IDS | IPS |
|---|---|---|
| Položaj | out-of-band (kopija saobraćaja) | inline |
| Lažni pozitiv | nepotreban alarm | blokiran legitiman saobraćaj |
| Lažni negativ | propušten napad | propušten napad |
| Uticaj na dostupnost | nema | može izazvati prekid ako padne (fail open / fail closed odluka) |

Vulnerability assessment nije isto što i penetration test:

| Kriterij | Vulnerability assessment | Penetration test |
|---|---|---|
| Cilj | pronaći i katalogizirati poznate ranjivosti | dokazati da se ranjivosti mogu iskoristiti i koliki je uticaj |
| Način | automatizovani skeneri, široko | ručno, ciljano, uz pravila angažmana |
| Učestalost | kontinuirano ili često (sedmično, mjesečno) | periodično (godišnje, nakon velikih promjena) |
| Rezultat | lista ranjivosti sa ocjenom (CVSS) | izvještaj o napadnim putanjama i poslovnom uticaju |

> **Na ispitu:** pri uvođenju IPS-a u produkciju, NAJBOLJI pristup je prvo rad u detekcijskom modu i podešavanje pravila, pa tek onda blokiranje. Kod honeypota, ispit voli pravnu nijansu: honeypot smije privući napadača koji već ima namjeru (enticement), ali ne smije navoditi nekoga da počini djelo koje inače ne bi (entrapment). Prije uvođenja konsultuj pravnu službu.

## Hardening operativnog sistema (5.2)

Hardening je proces smanjenja napadne površine kroz primjenu **baseline** konfiguracije, praćenje odstupanja i remedijaciju.

Ciklus:

1. **Baseline**: izabrati standard (CIS Benchmarks, DISA STIG, Microsoft Security Baselines, VMware Security Configuration Guide / vSphere hardening guide) i prilagoditi ga organizaciji.
2. **Implementacija**: ugraditi baseline u **golden image** i IaC/konfiguracijski menadžment (Ansible, Group Policy, DSC).
3. **Monitoring**: kontinuirano provjeravati usklađenost (SCAP skeneri, CIS-CAT, cloud configuration servisi, agenti).
4. **Remedijacija**: automatski ili kroz change proces vratiti konfiguraciju; za immutable infrastrukturu zamijeniti instancu novom iz ažurnog imagea.

| Platforma | Tipične mjere |
|---|---|
| **Windows** | Group Policy baselines, isključiti SMBv1 i nepotrebne servise, LAPS za lokalne admin lozinke, Credential Guard, BitLocker, AppLocker/WDAC, audit politike |
| **Linux** | minimalna instalacija, SSH hardening, SELinux/AppArmor, auditd, isključiti nepotrebne servise, sysctl mrežne postavke, nepotrebni SUID fajlovi |
| **VMware** (ESXi/vCenter) | lockdown mode, isključen SSH/ESXi Shell osim po potrebi, secure boot, odvojena management mreža, uloge u vCenteru, sinhronizacija vremena, syslog na centralni server |

> **Na ispitu:** golden image + automatska provjera usklađenosti + zamjena umjesto ručnog popravljanja je zreo pristup u cloudu. Ako pitanje nudi „ručno se prijaviti na svaki server i promijeniti postavku“, to je skoro uvijek pogrešan odgovor kada postoji automatizovana alternativa.

## Patch management (5.2)

Proces upravljanja zakrpama:

1. **Inventar** sistema i softvera (ne možeš patchovati ono što ne znaš da imaš).
2. **Praćenje** objava proizvođača i ranjivosti (CVE, CVSS, CISA KEV katalog aktivno iskorištavanih ranjivosti).
3. **Procjena i prioritizacija** po riziku: kritičnost ranjivosti, izloženost, vrijednost sistema, postojanje exploita.
4. **Testiranje** u neprodukcijskom okruženju.
5. **Odobrenje** kroz change management (hitne zakrpe kroz emergency change).
6. **Deploy** po fazama (pilot, zatim talasi), uz plan rollbacka.
7. **Verifikacija** (skeniranje nakon patcha) i **dokumentacija**.

Specifičnosti clouda:

- odgovornost zavisi od modela: u IaaS-u kupac patchuje guest OS, u PaaS-u CSP patchuje platformu, a kupac svoj kod i zavisnosti, u SaaS-u sve patchuje CSP,
- **immutable infrastruktura**: ne patchuje se instanca, nego se gradi novi image i zamjenjuju instance (rolling ili blue/green),
- automatizacija kroz patch servise (npr. Systems Manager Patch Manager, Azure Update Manager),
- kad zakrpa ne postoji ili se ne može odmah primijeniti: **kompenzacione kontrole** (WAF, izolacija, isključivanje ranjive funkcije) i formalno prihvatanje rizika.

## Dostupnost: guest OS i klasterisani hostovi (5.2)

### Dostupnost guest OS-a

Za dostupnost gosta brine kombinacija: redundantnih instanci u više zona dostupnosti iza load balancera, health checkova sa automatskom zamjenom (auto-healing), konzistentnih backupa i snapshotova, automatskog oporavka instance kod kvara hosta, i dobrog kapacitetnog planiranja. U cloudu je pravilo **dizajnirati za kvar**: pojedinačna instanca nije pouzdana, sistem jeste.

### Dostupnost klasterisanih hostova

| Funkcija | Opis |
|---|---|
| **Distributed Resource Scheduling (DRS)** | automatsko raspoređivanje i premještanje VM-ova između hostova u klasteru prema opterećenju i pravilima (affinity/anti-affinity) |
| **Dynamic optimization** | kontinuirano balansiranje resursa (CPU, memorija, energija); Microsoft termin u SCVMM-u; uključuje gašenje neiskorištenih hostova (power optimization) |
| **Storage clusters** | više storage čvorova kao jedan sistem; **tightly coupled** (dijeljeni backplane, visoke performanse, ograničeno skaliranje) vs. **loosely coupled** (nezavisni čvorovi, bolje skaliranje, manje performanse) |
| **Maintenance mode** | host se izuzima iz rasporeda, VM-ovi se live-migriraju na druge hostove prije održavanja; nema novih workloada na hostu |
| **High Availability (HA)** | ako host padne, VM-ovi se automatski restartuju na drugim hostovima; zahtijeva rezervni kapacitet (N+1) |
| **Fault tolerance** | sekundarna kopija VM-a radi u lock-stepu, nema prekida ni kod kvara hosta; skuplje |

> **Na ispitu:** maintenance mode je ključ za održavanje bez prekida usluge: prvo premjestiti workloade, pa tek onda patchovati ili mijenjati hardver. Anti-affinity pravila osiguravaju da redundantni VM-ovi iste aplikacije nisu na istom hostu, inače HA ne pomaže.

## Monitoring performansi, kapaciteta i hardvera (5.2)

| Oblast | Metrike | Zašto je sigurnosno važno |
|---|---|---|
| **Mreža** | propusnost, latencija, gubitak paketa, broj konekcija | DDoS, eksfiltracija (neočekivan izlazni saobraćaj) |
| **Compute** | CPU, memorija, broj procesa | kriptominer (trajno visok CPU), curenje memorije |
| **Storage** | IOPS, latencija, kapacitet, rast | ransomware (nagli rast pisanja), popunjavanje diska ruši logovanje |
| **Response time** | vrijeme odgovora aplikacije, error rate | indikator dostupnosti i SLA |
| **Hardver** | zdravlje diskova (SMART), temperatura CPU-a, brzina ventilatora, napajanje | preventivna zamjena prije kvara; pregrijavanje može ukazivati na problem hlađenja u data centru |

Monitoring ima smisla samo uz **baseline** normalnog ponašanja, **pragove** i **alarme** koji idu odgovornim ljudima. Kapacitetno planiranje koristi trendove da bi se resursi dodali prije nego što ponestanu; u cloudu autoskaliranje rješava dio problema, ali kvote i budžet i dalje traže praćenje. Hardverski monitoring u javnom cloudu radi CSP; kupac ga vidi indirektno kroz health događaje (npr. AWS Health, planirani retirement instanci).

## Backup i restore hosta i gosta (5.2)

| Pristup | Opis | Prednosti | Pažnja |
|---|---|---|---|
| **Snapshot** | stanje volumena ili VM-a u trenutku | brz, inkrementalan | nije pravi backup ako je u istom sistemu i regionu; konzistentnost (quiesce) |
| **Agent-based backup u gostu** | agent kopira fajlove i aplikacijske podatke | konzistentni aplikacijski backupi, granularan restore | agent treba održavati |
| **Agentless (na nivou hipervizora)** | backup VM-a kroz API hipervizora | jednostavno, cijeli VM | manja granularnost |
| **Host konfiguracija** | backup konfiguracije hipervizora, management alata | brz oporavak infrastrukture | čuva se van hosta |

Sigurnosne prakse:

- pravilo **3-2-1** (tri kopije, dva medija, jedna van lokacije) i proširenje **3-2-1-1-0** (jedna kopija nepromjenjiva ili offline, nula grešaka pri provjeri),
- **immutable backupi** (object lock, WORM) i odvojen nalog za backupe radi zaštite od ransomwarea i kompromitovanog administratora,
- enkripcija backupa i upravljanje ključevima (izgubljen ključ = izgubljen backup),
- kopije u drugi region u skladu sa pravilima rezidencije podataka,
- **redovno testiranje restorea**: backup koji nije testiran je nada, ne kontrola,
- backup prati RPO, a vrijeme restorea RTO (detaljno u BC/DR modulu).

## Operativne kontrole i standardi (5.3)

Cilj 5.3 traži da znaš koji okvir služi čemu i kako operativni procesi (posebno ITSM) podržavaju sigurnost.

| Okvir / standard | Tip | Fokus | Kada ga izabrati |
|---|---|---|---|
| **NIST CSF 2.0** | okvir | funkcije Govern, Identify, Protect, Detect, Respond, Recover | zajednički jezik za program sigurnosti i komunikaciju sa upravom |
| **NIST SP 800-53 Rev. 5** | katalog kontrola | detaljne sigurnosne i privatnosne kontrole | US federalni sistemi, FedRAMP, detaljan katalog |
| **NIST SP 800-145 / 800-146 / 800-210** | definicije i smjernice za cloud | definicija clouda, preporuke, kontrola pristupa | terminologija |
| **ISO/IEC 27001** | certifikabilni standard za ISMS | sistem upravljanja informacionom sigurnošću, Annex A kontrole | međunarodna certifikacija organizacije |
| **ISO/IEC 27002** | smjernice za kontrole | implementacija kontrola | uputstvo uz 27001 |
| **ISO/IEC 27017 / 27018** | cloud ekstenzije | 27017: cloud sigurnosne kontrole; 27018: zaštita PII u javnom cloudu | cloud provajderi i kupci |
| **ISO/IEC 20000-1** | certifikabilni standard za **IT service management** sistem | zahtjevi za SMS (service management system) | certifikacija upravljanja IT uslugama |
| **ITIL 4** | okvir najboljih praksi za ITSM | prakse: incident, problem, change enablement, release, deployment, configuration, service level, availability, capacity, continuity, information security management | operativni procesi i organizacija IT službe |
| **COBIT 2019** (ISACA) | okvir upravljanja i governance IT-a | povezivanje IT ciljeva sa poslovnim, governance vs. management | upravljanje IT-om iz ugla uprave i revizije |
| **COSO** | okvir interne kontrole (Internal Control – Integrated Framework) i ERM | kontrolno okruženje, procjena rizika, kontrolne aktivnosti, informacije i komunikacija, monitoring | finansijsko izvještavanje, SOX, interna revizija |
| **CIS Controls v8.1** | prioritizovan skup sigurnosnih mjera | 18 kontrola, Implementation Groups IG1–IG3 | praktičan početak, posebno za manje organizacije |
| **CIS Benchmarks** | konfiguracijski baseline za konkretne proizvode | hardening OS-a, cloud naloga, Kubernetesa | tehnički hardening |
| **HIPAA** | US zakon | zaštita zdravstvenih podataka (PHI): Privacy, Security i Breach Notification Rule; BAA sa provajderima | organizacije koje obrađuju PHI u SAD-u |

Napomena: ISO/IEC 20000-1 je za ITSM ono što je ISO/IEC 27001 za sigurnost: **certifikabilni standard za sistem upravljanja**, dok je ITIL **skup praksi** bez certifikacije organizacije (certificiraju se pojedinci). Dobro se slažu: ITIL daje „kako“, 20000-1 daje „šta mora postojati“ za certifikaciju.

> **Na ispitu:** razlikuj nivoe. COBIT i COSO su **governance i interna kontrola** (uprava, revizori). ISO 27001 i ISO 20000-1 su **certifikabilni sistemi upravljanja**. ITIL je **operativna praksa** za IT usluge. CIS Controls su **prioritizovane tehničke mjere**, a CIS Benchmarks **konkretne konfiguracije**. NIST 800-53 je **katalog kontrola**, CSF je **okvir na visokom nivou**. HIPAA je **zakon**, a ne okvir koji biraš.

### ITSM procesi koji podržavaju sigurnost

Tradicionalni CCSP sadržaj uz 5.3 obrađuje ove procese (ITIL / ISO 20000-1):

| Proces | Cilj | Sigurnosna veza |
|---|---|---|
| **Change management** (change enablement) | kontrolisane promjene uz procjenu rizika i odobrenje (CAB) | sprečava neovlaštene i rizične promjene; standardne, normalne i hitne promjene |
| **Configuration management** | CMDB, konfiguracijske stavke (CI) i odnosi među njima | znaš šta imaš i kako je povezano; osnova za procjenu uticaja |
| **Release i deployment management** | planiranje, testiranje i uvođenje releasea | sigurnosni testovi prije produkcije, rollback |
| **Incident management** | što brže vratiti uslugu | sigurnosni incidenti su podskup; razlikuj od problem managementa |
| **Problem management** | pronaći i ukloniti korijenski uzrok ponavljajućih incidenata | root cause analysis, known error baza |
| **Service level management** | definisati i pratiti SLA, OLA, UC | sigurnosne metrike u SLA |
| **Availability management** | osigurati dogovorenu dostupnost | redundancija, HA |
| **Capacity management** | dovoljno resursa sada i u budućnosti | sprečava prekide zbog nedostatka resursa |
| **Continuity management** | nastavak usluge nakon katastrofe | BCP/DRP, testovi |
| **Information security management** | povjerljivost, integritet, dostupnost usluga | politika sigurnosti, rizik, kontrole |
| **Continual improvement** | stalno poboljšanje usluga i procesa | lekcije iz incidenata, PDCA ciklus |

Incident i problem se često miješaju: **incident management** vraća uslugu (workaround je prihvatljiv), **problem management** traži i uklanja uzrok. Ako se isti incident ponavlja svake sedmice, otvaraš problem record.

> **Na ispitu:** svaka promjena u produkciji, uključujući hitne sigurnosne zakrpe, ide kroz change management. Hitna promjena (emergency change) ima ubrzano odobrenje i naknadnu dokumentaciju, ali ne zaobilazi proces. Odgovor „administrator primijeni zakrpu odmah bez evidencije jer je kritično“ je pogrešan.

## Primjeri scenarija

**Scenarij 1.** Privatni cloud na VMware-u; tim treba patchovati ESXi hostove bez prekida usluga. Redoslijed: change odobren, host u **maintenance mode** (DRS live-migrira VM-ove), patch, verifikacija, izlazak iz maintenance moda, sljedeći host. Kapacitet klastera mora podnijeti jedan host manje (N+1).

**Scenarij 2.** Skener pokazuje da 30% Linux instanci odstupa od CIS baselinea, jer su administratori mijenjali postavke ručno. NAJBOLJE: baseline u golden image i konfiguracijski menadžment, kontinuirani monitoring usklađenosti, automatska remedijacija ili zamjena instanci, i ograničenje direktnog pristupa serverima.

**Scenarij 3.** Kupac IaaS-a pita ko odgovara za temperaturu i ventilatore u serverima i firmware hipervizora. Odgovor: CSP. Kupac to provjerava kroz SOC 2 Type II i ISO 27001 izvještaje i ugovor, a sam odgovara za guest OS, mrežne kontrole u svom VPC-u, podatke i identitete.

**Scenarij 4.** Uprava traži jedan okvir da uskladi IT ciljeve sa poslovnim i da ga koriste interni revizori. NAJBOLJI izbor je COBIT. Ako traže certifikaciju upravljanja IT uslugama za ugovor sa klijentom, to je ISO/IEC 20000-1.

## Rezime

- **5.1 hardver**: HSM za ključeve organizacije (FIPS 140, M of N, tamper zaštita), TPM za integritet platforme (measured boot, atestacija, vTPM). Secure by default: sigurno početno stanje bez dodatnih koraka.
- **Management plane** je najvrednija meta: izolovana mreža, phishing-resistant MFA, least privilege, nepromjenjivi logovi; operativno obuhvata scheduling, orkestraciju i maintenance.
- **Hipervizor**: Type 1 (bare metal, cloud) vs. Type 2 (hosted, manje siguran). Virtuelni hardver: mreža (vSwitch postavke, segmentacija), storage (enkripcija, zeroing), memorija (izolacija, enkripcija), CPU (side-channel, patch mikrokoda). Guest toolset je privilegovan kanal: ažuran, minimalan, kontrolisan.
- **5.2 pristup**: RDP i SSH nikad direktno na internet; bastion/jumpbox ili managed session sa MFA i logovanjem; SSH certifikati; PAW.
- **Mreža**: VLAN (i VLAN hopping), TLS 1.2+, DHCP snooping, DNSSEC (integritet, ne povjerljivost), VPN (IPsec, TLS). Kontrole: firewall, IDS (pasivan) vs. IPS (inline), honeypot (enticement, ne entrapment), vulnerability assessment, NSG, bastion, segmentacija.
- **Hardening**: baseline (CIS, STIG, vendor guide) → golden image → monitoring → remedijacija; Windows, Linux, VMware specifičnosti.
- **Patch management**: inventar, prioritizacija po riziku, test, change, faze, verifikacija; immutable zamjena u cloudu; kompenzacione kontrole.
- **Dostupnost**: DRS, dynamic optimization, storage klasteri (tightly vs. loosely coupled), maintenance mode, HA i anti-affinity. Monitoring mreže, compute, storagea, response timea i hardvera uz baseline i alarme. Backup: 3-2-1(-1-0), immutable, enkripcija, testiran restore.
- **5.3**: NIST CSF 2.0 i 800-53, ISO 27001/27017/27018, ISO/IEC 20000-1 (ITSM certifikacija), ITIL (prakse), COBIT (IT governance), COSO (interna kontrola), CIS Controls i Benchmarks, HIPAA (zakon). ITSM procesi: change, configuration, release, incident vs. problem, SLM, availability, capacity, continuity, info security, continual improvement.
