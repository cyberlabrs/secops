## Ciljevi ispita

Ovaj modul pokriva **cilj 3.1** (*Compare and contrast security implications of different architecture models*) i **cilj 3.2** (*Given a scenario, manage the security architecture to best protect the infrastructure*).

Za 3.1 ispit traži da uporediš modele (cloud, on-prem, OT, air-gap, mikroservisi) i znaš koje tehničke i poslovne faktore donose. Za 3.2 dobijaš scenarij i biraš gdje postaviti uređaj, kako segmentirati, kako omogućiti siguran udaljeni pristup i kako se sistem ponaša kad otkaže.

## Cloud arhitektura

### Deployment modeli

| Model (engl.) | Ko koristi infrastrukturu | Sigurnosna implikacija |
|---|---|---|
| **Public** | Više nepovezanih klijenata dijeli infrastrukturu provajdera (AWS, Azure, GCP) | Brz start, ali dijeljena infrastruktura (*multitenancy*) i oslanjanje na provajdera |
| **Private** | Jedna organizacija (u svom data centru ili kod hostera) | Puna kontrola i odgovornost, veći trošak |
| **Hybrid** | Kombinacija privatnog i javnog, povezanih mrežom | Složenost: dosljedne politike i identitet na obje strane, sigurna veza (VPN, Direct Connect, ExpressRoute) |
| **Community** | Više organizacija sa zajedničkim zahtjevima (npr. državne institucije, bolnice) dijeli infrastrukturu | Dijeljeni troškovi i zajednička compliance pravila; potreban dogovor o odgovornostima |

### Shared responsibility model

**Shared responsibility model** (model podijeljene odgovornosti) određuje šta štiti provajder, a šta klijent. Pravilo: provajder je odgovoran za sigurnost **oblaka** (*of the cloud*), klijent za sigurnost **u oblaku** (*in the cloud*).

| Sloj | IaaS (EC2, Azure VM) | PaaS (RDS, App Service) | SaaS (Microsoft 365) |
|---|---|---|---|
| Fizički data centar, hardver | Provajder | Provajder | Provajder |
| Hipervizor, mreža provajdera | Provajder | Provajder | Provajder |
| Operativni sistem, patchevi OS-a | **Klijent** | Provajder | Provajder |
| Runtime, middleware | **Klijent** | Provajder | Provajder |
| Aplikacija | **Klijent** | **Klijent** | Provajder |
| Podaci, identiteti, pristup | **Klijent** | **Klijent** | **Klijent** |

> **Na ispitu:** **Podaci i upravljanje pristupom** su UVIJEK odgovornost klijenta, bez obzira na model. Ako pitanje pita ko patchuje OS na EC2 instanci, odgovor je klijent; ko patchuje OS ispod RDS baze, provajder.

### Serverless

**Serverless** (npr. AWS Lambda, Azure Functions) znači da ne upravljaš serverima: provajder pokreće kod na događaj i naplaćuje po izvršavanju.

- **Plus:** nema OS-a za patchovanje, kratkotrajno izvršavanje, manja površina za trajno uporište napadača.
- **Minus:** odgovornost se seli na **kod, zavisnosti, IAM ulogu funkcije i ulaze iz događaja** (event injection). Preširoka IAM uloga je najčešći problem. Teže je raditi forenziku jer okruženje nestaje.

### Multicloud

**Multicloud** je korištenje više javnih cloud provajdera (npr. AWS + Azure). Prednosti: otpornost na ispad jednog provajdera, izbjegavanje **vendor lock-in**. Mane: više konzola, različiti IAM modeli, teža dosljedna politika i monitoring, više vještina u timu. Pomažu centralizovan identitet (SSO), **CSPM** (*cloud security posture management*) i IaC.

### Infrastructure as Code (IaC)

**IaC** (Terraform, CloudFormation, Bicep, Pulumi) opisuje infrastrukturu kao kod.

| Prednost | Rizik |
|---|---|
| Dosljednost, ponovljivost, isti hardening svuda | Greška u modulu se umnoži u svim okruženjima |
| Code review i istorija u gitu | Tajne u kodu ili u **state fajlu** (Terraform state može sadržati osjetljive vrijednosti) |
| Brz oporavak: okruženje se može ponovo podići | Preširoke dozvole CI/CD pipelinea koji radi `apply` |
| Detekcija **drift**-a (ručnih promjena) | Moduli iz nepouzdanih izvora |

Kontrole: skeniranje IaC-a u pipelineu (npr. Checkov, Trivy), policy-as-code (OPA, Sentinel), zaštićen remote state sa enkripcijom i zaključavanjem, tajne iz secrets managera.

## Ostali arhitekturni modeli

### On-premises

**On-premises** infrastruktura je u tvom prostoru. Imaš punu kontrolu, ali i punu odgovornost: fizička sigurnost, napajanje, hlađenje, hardver, patchevi. Skaliranje traje (nabavka hardvera). Pogodno kad propisi ili latencija zahtijevaju lokalne podatke.

### OT (Operational Technology)

**OT** su sistemi koji upravljaju fizičkim procesima: **ICS** (*industrial control systems*), **SCADA**, **PLC** kontroleri u fabrikama, energetici, vodovodu.

- Prioritet je **dostupnost i bezbjednost ljudi**, ne povjerljivost. Restart radi patcha može zaustaviti proizvodnju.
- Uređaji traju decenijama, često imaju zastarjele OS-ove i protokole bez autentifikacije (Modbus, starije verzije DNP3).
- Zaštita: **segmentacija** OT mreže od IT mreže, strogo kontrolisani prelazi, pasivni monitoring, kompenzacione kontrole tamo gdje patch nije moguć.

### Air-gapped network

**Air-gapped** mreža je **fizički odvojena** od drugih mreža i interneta (nema kabla, nema bežične veze). Koristi se za vojne, kritične i OT sisteme, offline CA root.

Rizik ne nestaje: prenos podataka ide preko **prenosnih medija** (USB) i ljudi. Stuxnet je primjer napada koji je prešao air gap preko USB-a. Kontrole: stroga procedura za medije, skeniranje na kiosku, fizička kontrola pristupa.

### Microservices

**Microservices** dijele aplikaciju na male servise koji komuniciraju preko API-ja (često u Kubernetesu).

- Plus: izolacija kvara i kompromitacije na jedan servis, nezavisno skaliranje i deploy.
- Minus: mnogo više **API endpointa** i mrežnog saobraćaja istok-zapad, mnogo identiteta servisa i tajni.
- Kontrole: **mTLS** između servisa (service mesh, npr. Istio, Linkerd), API gateway, Kubernetes **NetworkPolicy**, zaseban identitet za svaki servis.

### Logička vs fizička segmentacija

| | **Logical segmentation** | **Physical segmentation** |
|---|---|---|
| Kako | VLAN-ovi, subneti, VPC, security grupe, NetworkPolicy, firewall pravila | Odvojeni switchevi, kablovi, uređaji |
| Prednost | Jeftino, fleksibilno, brzo se mijenja kodom | Jača izolacija, greška u konfiguraciji ne spaja mreže |
| Mana | Pogrešna konfiguracija (ili VLAN hopping) ruši izolaciju | Skupo, sporo za izmjene |
| Primjer | Odvojeni subneti za web i bazu u VPC-u | Odvojen hardver za OT ili PCI okruženje |

## Razmatranja pri izboru arhitekture

### Tehnička razmatranja (technical considerations)

| Pojam | Pitanje koje postavljaš |
|---|---|
| **Availability** | Koliko sistem mora biti dostupan? Postoji li jedna tačka otkaza? |
| **Resilience** | Može li izdržati kvar i nastaviti raditi (više zona, redundantnost)? |
| **Proprietary vs. open source** | Zatvoren kod: podrška proizvođača, ali vendor lock-in i manja transparentnost. Open source: pregledljiv kod i zajednica, ali ti si odgovoran za praćenje ranjivosti i podršku. |
| **Usability** | Ako je kontrola prekomplikovana, korisnici je zaobilaze. |
| **Responsibility** | Ko je odgovoran za koji sloj (shared responsibility)? |
| **Compute** | Ima li uređaj dovoljno procesorske snage za enkripciju, agente, logovanje? (IoT i OT često nemaju) |
| **Power requirements** | Potrošnja i napajanje (edge uređaji, OT, data centri, UPS) |
| **Ease of recovery** | Koliko brzo se sistem vraća? IaC i immutable infrastruktura olakšavaju, ručno podešen „snowflake“ server otežava. |

### Poslovna razmatranja (business considerations)

| Pojam | Značenje |
|---|---|
| **Data sovereignty** | Podaci podliježu zakonima zemlje u kojoj se nalaze; bira se cloud regija u skladu s tim |
| **Data classification** | Osjetljiviji podaci traže strožiji model (npr. privatni cloud, posebna enkripcija) |
| **Cost** | CapEx (on-prem hardver) vs OpEx (cloud pretplata); trošak kontrole ne smije premašiti vrijednost zaštite |
| **Ownership** | Ko posjeduje sistem i podatke, ko donosi odluke o riziku |
| **Environmental requirements** | Hlađenje, prostor, vlaga, potrošnja energije, održivost |
| **Scalability** | Može li arhitektura rasti sa opterećenjem (autoscaling u cloudu vs nabavka hardvera) |
| **Risk** | Koliki rizik organizacija prihvata za određeni model |

> **Na ispitu:** Ako scenario kaže „podaci građana EU moraju ostati u EU“, ključna riječ je **data sovereignty** (i data location/residency). Ako kaže „sistem mora preživjeti ispad jednog provajdera“, misli na **multicloud** i **resilience**.

## Infrastrukturna razmatranja (3.2)

### Security zones

**Security zones** (sigurnosne zone) grupišu sisteme sa sličnim nivoom povjerenja. Saobraćaj između zona prolazi kroz kontrolu.

| Zona | Sadržaj |
|---|---|
| **Untrusted** (internet) | Sve spolja |
| **Screened subnet** (ranije DMZ) | Javno dostupni servisi: web, reverse proxy, mail gateway |
| **Trusted / internal** | Interni serveri, baze, korisnici |
| **Management** | Admin interfejsi, jump hostovi, OOB mreža |
| **Guest** | Gosti, izolovani od interne mreže |
| **Restricted** | Najosjetljiviji sistemi (PCI, OT) |

U AWS-u: javni subnet sa ALB-om, privatni subnet sa aplikacijom, izolovani subnet sa bazom bez rute ka internetu.

### Device placement

**Device placement** (postavljanje uređaja) određuje šta uređaj vidi i štiti:

| Uređaj | Tipično mjesto |
|---|---|
| Firewall | Na granici između zona (internet / screened subnet / interna mreža) |
| IPS (inline) | U putanji saobraćaja, iza firewalla, da blokira |
| IDS / senzor | Na **SPAN** portu ili **TAP**-u, pasivno, gdje vidi bitan saobraćaj |
| Load balancer / reverse proxy / WAF | Ispred web servera, u screened subnetu |
| Jump server (bastion) | Management zona, jedina tačka ulaza za admin pristup |
| VPN koncentrator | Na rubu mreže, sesije završavaju u kontrolisanoj zoni |

### Attack surface

**Attack surface** (površina napada) je zbir svih tačaka kroz koje napadač može ući: otvoreni portovi, API-ji, nalozi, servisi, zavisnosti, ljudi. Smanjuje se: gašenjem nepotrebnih servisa, zatvaranjem portova, uklanjanjem javnih IP adresa, minimalnim container imageima, uklanjanjem neiskorištenih naloga i ključeva.

### Diversity

**Diversity** (raznolikost) znači koristiti različite proizvođače, tehnologije ili kontrole u slojevima, tako da jedna ranjivost ili greška ne obori sve. Primjer: spoljni firewall jednog proizvođača, unutrašnji drugog; antivirus na mail gatewayu različit od onog na endpointima. Cijena: više znanja i održavanja.

## Zero Trust arhitektura

**Zero Trust** polazi od pretpostavke da **lokacija u mreži ne daje povjerenje**. Svaki zahtjev se provjerava: ko je korisnik, sa kojeg uređaja, u kakvom je stanju uređaj, kojem resursu pristupa. Načelo: *never trust, always verify*. Referentni dokument je **NIST SP 800-207**.

Elementi koje cilj 3.2 navodi:

- **User authentication**: jaka autentifikacija (MFA, otporna na phishing gdje može), kontinuirana procjena rizika sesije.
- **Device management**: **Health** (stanje uređaja: patchevi, EDR radi, disk enkriptovan) i **Inventory** (uređaj je poznat i upisan u MDM/inventar). Nepoznat ili nezdrav uređaj ne dobija pristup.
- **Application access control**: pristup se daje **po aplikaciji**, ne cijeloj mreži (za razliku od klasičnog VPN-a).

### Control plane i data plane

| Ravan | Uloga | Komponente |
|---|---|---|
| **Control plane** | Odlučuje o pristupu | **Policy Engine** (donosi odluku), **Policy Administrator** (izvršava odluku: uspostavlja ili prekida sesiju, izdaje token); zajedno čine **PDP** (*policy decision point*). Ulazi: adaptive identity, threat intel, stanje uređaja, politike. |
| **Data plane** | Prenosi stvarni saobraćaj | **Subject/system** (korisnik, uređaj), **PEP** (*policy enforcement point*, kapija koja propušta ili blokira prema odluci PDP-a), resurs u **implicit trust zone** iza PEP-a |

Pojmovi koje vrijedi znati: **adaptive identity** (odluka zavisi od konteksta: lokacija, uređaj, ponašanje), **threat scope reduction** (smanjenje dometa napada, npr. pristup samo jednoj aplikaciji), **policy-driven access control**.

> **Na ispitu:** **PDP odlučuje, PEP sprovodi.** Ako pitanje opisuje komponentu „koja stoji između korisnika i aplikacije i propušta ili blokira konekciju“, to je **PEP** (data plane). Komponenta „koja procjenjuje politiku, identitet i stanje uređaja“ je **policy engine / PDP** (control plane).

## Siguran pristup i komunikacija

### VPN i tunneling

**Tunneling** je enkapsulacija jednog protokola u drugi, najčešće uz enkripciju.

| Tehnologija | Napomena |
|---|---|
| **IPsec** | Mrežni sloj; **tunnel mode** enkriptuje cijeli originalni paket (site-to-site), **transport mode** samo payload (host-to-host). AH daje integritet, ESP enkripciju i integritet. |
| **TLS VPN** (SSL VPN) | Remote access preko HTTPS-a, prolazi kroz većinu firewalla |
| **WireGuard** | Moderan, jednostavan VPN protokol |
| **SSH tunel** | Port forwarding preko SSH veze |
| **GRE** | Enkapsulacija **bez** enkripcije; često se kombinuje sa IPsec-om |

**VPN** tipovi:

- **Site-to-site**: povezuje mreže (kancelarija sa VPC-om preko AWS Site-to-Site VPN-a).
- **Remote access**: korisnik sa laptopa ulazi u mrežu.
- **Full tunnel**: sav saobraćaj korisnika ide kroz VPN (bolja vidljivost i kontrola, veće opterećenje).
- **Split tunnel**: samo saobraćaj ka korporativnim mrežama ide kroz VPN, ostalo direktno na internet (manje opterećenje, manja kontrola).

### Remote access

**Remote access** za administratore treba ići kroz kontrolisanu tačku: **jump server/bastion**, VPN ili ZTNA, uz MFA i logovanje sesija. Bolje od otvorenog SSH/RDP porta na internetu su rješenja bez otvorenih ulaznih portova (npr. AWS Systems Manager Session Manager, Azure Bastion).

### User management i user access

**User management** obuhvata kreiranje, izmjenu i gašenje naloga (*provisioning/deprovisioning*). **User access** treba poštovati **least privilege**: svaki korisnik dobija minimalna prava za posao, po mogućnosti vremenski ograničena (*just-in-time*).

### End-to-end encrypted messaging

**End-to-end encrypted messaging** (npr. Signal protokol) enkriptuje poruke tako da ih samo krajnji učesnici mogu pročitati; ni provajder servisa ne vidi sadržaj.

- Plus: zaštita od presretanja i kompromitacije servera.
- Izazovi za organizaciju: DLP i arhiviranje ne vide sadržaj, što može biti problem za **compliance** i **legal hold**; sigurnost zavisi od krajnjih uređaja.

### Out-of-band management

**Out-of-band (OOB) management** je upravljanje uređajima preko **zasebnog kanala**, odvojenog od produkcijske mreže: konzolni serveri, serijski port, iDRAC/iLO/IPMI interfejsi u izolovanoj management mreži, 4G/LTE modem za mrežnu opremu.

- Radi i kad je produkcijska mreža pala ili napadnuta.
- Management interfejsi nisu izloženi korisničkoj mreži.
- OOB mrežu treba dodatno zaštititi (MFA, ACL, logovanje), jer daje pristup svemu.

> **Na ispitu:** „Administratori moraju moći pristupiti ruterima i kad je glavna mreža nedostupna“ znači **out-of-band management**. **In-band** upravljanje koristi istu mrežu kao produkcijski saobraćaj.

### File transfer

| Nesigurno | Sigurna zamjena |
|---|---|
| **FTP** (lozinke u čistom tekstu) | **SFTP** (preko SSH) ili **FTPS** (FTP preko TLS-a) |
| **TFTP** (bez autentifikacije) | SCP/SFTP, HTTPS |
| Slanje fajlova e-mailom | **Managed file transfer (MFT)** sa logovanjem i kontrolom pristupa, presigned URL sa kratkim trajanjem (S3) |

### Security Service Edge (SSE)

**SSE** je skup sigurnosnih servisa isporučenih iz clouda, blizu korisnika gdje god da je:

| Komponenta | Uloga |
|---|---|
| **SWG** (*secure web gateway*) | Filtriranje web saobraćaja, URL kategorije, malver |
| **CASB** (*cloud access security broker*) | Vidljivost i kontrola SaaS aplikacija, shadow IT, DLP |
| **ZTNA** (*zero trust network access*) | Pristup pojedinačnim aplikacijama umjesto cijeloj mreži |
| Često i **FWaaS**, DLP | Firewall i zaštita podataka kao servis |

**SASE** (*secure access service edge*) = SSE + mrežni dio (**SD-WAN**). SSE je dakle sigurnosna polovina SASE-a.

## Upravljanje identitetom za arhitekturu

| Pojam | Objašnjenje |
|---|---|
| **gMSA** (*Group Managed Service Account*) | Active Directory servisni nalog čiju lozinku **automatski generiše i rotira** domen; može se koristiti na više servera (npr. farma IIS servera). Niko ne zna lozinku, pa je ne može ni zloupotrijebiti ni zaboraviti promijeniti. |
| **Least privilege access accounts** | Odvojeni nalozi sa minimalnim pravima: običan nalog za e-mail i web, poseban admin nalog samo za administraciju; servisni nalozi samo sa dozvolama koje servis treba |
| **Privilege creep** | Postepeno nakupljanje prava: korisnik promijeni poziciju, dobije nova prava, a stara mu ostanu. Rješenje: periodični **access review** (recertifikacija) i oduzimanje prava pri promjeni uloge. |

Cloud ekvivalent gMSA ideje: **IAM role** za EC2/Lambda, **managed identity** u Azureu, workload identity u Kubernetesu. Sve izbjegavaju dugotrajne statične ključeve.

> **Na ispitu:** Ako se pita kako izbjeći ručnu rotaciju lozinke servisnog naloga koji koristi više Windows servera, odgovor je **gMSA**. Ako analitičar otkrije da inženjer koji je prije dvije godine prešao iz finansija i dalje ima pristup finansijskom sistemu, to je **privilege creep**.

## Failure modes

**Failure modes** opisuju šta sigurnosni uređaj ili sistem radi kad otkaže.

| Mod | Ponašanje | Prioritet | Primjer |
|---|---|---|---|
| **Fail-open** | Pri kvaru propušta saobraćaj / otključava | **Dostupnost** (ili bezbjednost ljudi) | Inline IPS koji pri kvaru propušta sav saobraćaj da ne prekine poslovanje; vrata koja se otključaju pri požaru |
| **Fail-closed** (fail-secure) | Pri kvaru blokira saobraćaj / zaključava | **Povjerljivost i integritet** | Firewall koji pri padu ne propušta ništa; trezor koji ostaje zaključan |

> **Na ispitu:** Ako je prioritet da posao ne stane, bira se **fail-open**. Ako je prioritet da se ništa neovlašteno ne propusti, **fail-closed**. Kod fizičkih vrata gdje je u pitanju bezbjednost ljudi (požarni izlazi), obično fail-open (fail-safe).

## Rezime

- **Shared responsibility**: provajder štiti oblak, ti štitiš ono u oblaku; podaci i pristup su uvijek tvoji.
- Deployment modeli: **public, private, hybrid, community**; serverless seli fokus na kod i IAM, IaC donosi dosljednost ali i umnožene greške.
- **OT** prioritizuje dostupnost; **air-gap** fizički izoluje, ali prenosni mediji ostaju rizik; **mikroservisi** povećavaju broj API-ja.
- Segmentacija može biti **logička** (VLAN, VPC, security grupe) ili **fizička** (odvojen hardver).
- **Zero Trust**: PDP (policy engine + administrator) u control plane odlučuje, **PEP** u data plane sprovodi; provjera korisnika, uređaja (health, inventory) i pristup po aplikaciji.
- Siguran pristup: VPN (full/split tunnel), jump server, **OOB management**, SFTP/FTPS, E2E messaging, **SSE** (SWG + CASB + ZTNA).
- **gMSA** automatski rotira lozinke servisnih naloga; **privilege creep** se rješava access reviewom.
- **Fail-open** čuva dostupnost, **fail-closed** čuva povjerljivost.
