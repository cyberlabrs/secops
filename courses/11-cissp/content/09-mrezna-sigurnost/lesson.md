## Ciljevi ispita: domen 4 (4.1–4.3)

Domen 4 je **Communication and Network Security** i nosi **12,8%** ispita po outlineu iz 2027. (U outlineu iz 2024. težina je 13%.) Ovaj modul pokriva sva tri cilja:

- **4.1 Apply secure design principles in network architectures**
  - OSI i TCP/IP modeli,
  - IPv4 i IPv6 (unicast, broadcast, multicast, anycast),
  - sigurni protokoli (IPSec, SSH, SSL/TLS),
  - implikacije višeslojnih protokola (multilayer protocols),
  - konvergirani protokoli (iSCSI, VoIP, InfiniBand over Ethernet, Compute Express Link),
  - transportna arhitektura (topologija, data/control/management plane, cut-through/store-and-forward),
  - metrike performansi (bandwidth, latency, jitter, throughput, signal-to-noise ratio),
  - tokovi saobraćaja (north-south, east-west),
  - fizička segmentacija (in-band, out-of-band, air-gapped),
  - logička segmentacija (VLAN, VPN, Virtual Routing and Forwarding, virtual domain),
  - mikrosegmentacija (overlay/enkapsulacija, distribuirani firewalli, ruteri, IDS/IPS, Zero Trust),
  - edge mreže (ingress/egress, peering),
  - bežične mreže (Bluetooth, Wi-Fi, Zigbee, satelit),
  - celularne mreže (4G, 5G),
  - CDN,
  - SDN (API, SD-WAN, NFV),
  - VPC,
  - monitoring i upravljanje (observability, traffic flow/shaping, capacity management, fault detection and handling),
  - software-defined security.
- **4.2 Secure network components**
  - rad infrastrukture (redundantno napajanje, garancija, podrška),
  - NAC sistemi (fizička i virtuelna rješenja),
  - prenosni mediji (fizička zaštita medija, kvalitet propagacije signala),
  - endpoint security (host-based).
- **4.3 Implement secure communication channels according to design**
  - glas, video i saradnja (konferencije, video sale za sastanke),
  - data communications (backhaul mreže, satelit),
  - udaljeni pristup (administrativne funkcije mreže, rad od kuće),
  - povezivanje trećih strana (telekom operateri, hardverska podrška).

> U outlineu iz 2024. pod-tačka **software-defined security** ne postoji, u 4.3 stoji „Zoom rooms“ umjesto „video meeting rooms“, a kod udaljenog pristupa nema „remote working“. Sadržaj je inače isti.

Ti znaš VPC-ove, NetworkPolicy, service mesh i WAF iz prakse. CISSP ovdje ne traži konfiguraciju nego **vokabular i odluku**: na kojem OSI sloju radi kontrola, koji protokol daje koju sigurnosnu uslugu (CIA, autentifikacija, nonrepudiation), i koji dizajn najbolje odgovara poslovnom zahtjevu uz najmanji rizik.

## OSI i TCP/IP model (4.1)

### Slojevi, PDU i tipični uređaji

| # | OSI sloj | PDU | Protokoli / primjeri | Uređaji i kontrole |
|---|---|---|---|---|
| 7 | **Application** | data | HTTP, DNS, SMTP, SNMP, LDAP, SIP | WAF, proxy, application firewall |
| 6 | **Presentation** | data | kodiranje, kompresija, enkripcija (ASCII, JPEG, MIME) | — |
| 5 | **Session** | data | uspostava i prekid sesije (NetBIOS, RPC, SOCKS) | circuit-level gateway |
| 4 | **Transport** | segment (TCP) / datagram (UDP) | TCP, UDP, (TLS se često svrstava ovdje ili 5–6) | stateful firewall, L4 load balancer |
| 3 | **Network** | packet | IP, ICMP, IPSec, OSPF, BGP | router, packet filter firewall |
| 2 | **Data Link** | frame | Ethernet, 802.1Q, ARP, PPP, 802.11 MAC | switch, bridge, WAP |
| 1 | **Physical** | bit | kablovi, signali, 802.11 radio | hub, repeater, modem |

Mnemonika odozgo: **All People Seem To Need Data Processing**. Odozdo: **Please Do Not Throw Sausage Pizza Away**.

TCP/IP model ima četiri sloja: **Application** (OSI 5–7), **Transport** (Host-to-Host, OSI 4), **Internet** (OSI 3) i **Network Access / Link** (OSI 1–2).

| Pojam | Značenje |
|---|---|
| **Encapsulation** | svaki sloj dodaje zaglavlje pri slanju; deencapsulation pri prijemu |
| **TCP** | connection-oriented, three-way handshake (SYN, SYN/ACK, ACK), pouzdan, redoslijed |
| **UDP** | connectionless, bez potvrde, brz; DNS upiti, VoIP, streaming, SNMP, syslog |
| **ARP** | IP → MAC na L2; nema autentifikaciju, pa je osnova za ARP spoofing (odbrana: Dynamic ARP Inspection, statički unosi za kritične uređaje) |

### Firewalli po generacijama

| Tip | Sloj | Odluka na osnovu | Napomena |
|---|---|---|---|
| **Packet filter** (static) | 3–4 | IP, port, protokol (ACL) | brz, ne pamti stanje |
| **Stateful inspection** | 3–4 | tabela stanja konekcija | standard u perimetru |
| **Circuit-level gateway** | 5 | uspostava sesije (SOCKS) | ne gleda sadržaj |
| **Application-level gateway / proxy** | 7 | sadržaj protokola | najdublja inspekcija, sporiji |
| **NGFW** | 3–7 | aplikacija, korisnik, IPS, TLS inspekcija | konvergencija funkcija |
| **WAF** | 7 | HTTP obrasci | štiti web aplikaciju |

Arhitekture: **screened host** (router + bastion), **screened subnet / DMZ** (dva firewalla ili jedan sa tri interfejsa), **dual-homed / multi-homed** host. **Bastion host** je ojačan sistem izložen nepovjerljivoj mreži.

> **Na ispitu:** kada pitanje traži „na kojem sloju“, odgovori po funkciji, ne po proizvodu. Router odlučuje po IP adresi, dakle L3; switch po MAC adresi, L2; WAF i proxy razumiju HTTP, L7. Ako pitanje spominje „frame“, misli na L2; „packet“ na L3; „segment“ na L4.

## IPv4, IPv6 i načini adresiranja (4.1)

| Način | Opis | IPv4 | IPv6 |
|---|---|---|---|
| **Unicast** | jedan prema jednom | da | da |
| **Broadcast** | jedan prema svima u segmentu | da (255.255.255.255, directed broadcast) | **ne postoji** |
| **Multicast** | jedan prema grupi koja se pretplatila | 224.0.0.0/4, IGMP | ff00::/8, MLD |
| **Anycast** | jedan prema najbližem od više čvorova sa istom adresom | preko BGP-a (DNS root, CDN) | izvorno podržan |

IPv6 razlike bitne za sigurnost:

- 128-bitne adrese, ogroman prostor, pa je klasično skeniranje cijelog subneta nepraktično (ali ne i nemoguće uz predvidive adrese).
- **SLAAC** (stateless autoconfiguration) i **Neighbor Discovery Protocol** zamjenjuju ARP; rizik su lažni Router Advertisement paketi (odbrana: **RA Guard**, SEND).
- IPSec je bio obavezan dio specifikacije IPv6 implementacija, a danas je preporučen; nije automatski uključen.
- **Dual stack** i tuneli (6to4, Teredo) često zaobilaze IPv4 sigurnosne kontrole. Ako mreža „nema IPv6“, a hostovi ga imaju uključenog, postoji neprimijećen kanal.
- NAT nije sigurnosna kontrola u IPv6 svijetu; filtriranje mora biti eksplicitno.

Privatni IPv4 rasponi (RFC 1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. APIPA: 169.254.0.0/16. IPv6 ekvivalenti: unique local fc00::/7, link-local fe80::/10.

## Sigurni protokoli (4.1)

| Protokol | Sloj | Šta daje | Ključni detalji |
|---|---|---|---|
| **IPSec** | 3 | povjerljivost, integritet, autentifikacija izvora, anti-replay | **AH** (integritet + autentifikacija, bez enkripcije, ne radi kroz NAT), **ESP** (enkripcija + integritet), **IKE** (pregovor ključeva, Security Associations) |
| IPSec **transport mode** | — | štiti payload, originalno IP zaglavlje ostaje | host-to-host |
| IPSec **tunnel mode** | — | enkapsulira cijeli originalni paket u novi | site-to-site VPN, gateway-to-gateway |
| **TLS 1.2/1.3** | 4–7 | povjerljivost, integritet, autentifikacija servera (i klijenta kod **mTLS**) | TLS 1.3 uklanja statički RSA key exchange, obavezan forward secrecy |
| **SSL** | — | zastario i nesiguran (SSL 2.0/3.0) | na ispitu „SSL“ često znači TLS; izbor je uvijek najnovija verzija TLS-a |
| **SSH** | 7 | sigurna zamjena za Telnet, rlogin, FTP (SFTP, SCP), port forwarding | autentifikacija ključem umjesto lozinke |
| **SNMPv3** | 7 | autentifikacija i enkripcija | v1/v2c šalju community string u čistom tekstu |
| **DNSSEC** | 7 | integritet i autentičnost DNS odgovora | **ne daje povjerljivost**; za to DoH/DoT |
| **S/MIME, PGP** | 7 | potpis i enkripcija e-maila | nonrepudiation kroz digitalni potpis |
| **HTTPS, LDAPS, FTPS, SMTPS** | 7 | protokol preko TLS-a | — |

Nesigurni protokoli koje treba zamijeniti: Telnet → SSH, FTP → SFTP/FTPS, HTTP → HTTPS, SNMPv1/2 → SNMPv3, LDAP → LDAPS (ili StartTLS), TFTP → SFTP.

> **Na ispitu:** „IPSec bez enkripcije“ je AH. „Zaštita cijelog originalnog paketa između dva gatewaya“ je ESP u tunnel modu. „Integritet DNS-a“ je DNSSEC, ali ako se traži privatnost upita, DNSSEC nije odgovor. Ako ponuđeni odgovori kažu „SSL 3.0“ i „TLS 1.3“, bira se TLS 1.3.

## Višeslojni i konvergirani protokoli (4.1)

**Multilayer protocol** je protokol koji obuhvata više slojeva ili enkapsulira druge protokole. Klasičan primjer na ispitu je **DNP3** (industrijski SCADA protokol): projektovan za zatvorene mreže, bez autentifikacije, a danas putuje preko TCP/IP-a. Implikacije:

- **Prednost**: fleksibilnost, mogu raditi preko postojeće infrastrukture.
- **Rizik**: **covert channels** (skriveni kanali), zaobilaženje filtera (protokol unutar protokola, npr. tunelovanje preko DNS-a ili HTTP-a), enkapsulirani saobraćaj koji firewall ne razumije, VLAN hopping preko dvostrukog 802.1Q taga.
- **Kontrola**: deep packet inspection, protokolno-svjesni firewalli, segmentacija OT mreža.

**Converged protocols** spajaju specijalizovane protokole sa standardnim mrežama (obično IP ili Ethernet):

| Protokol | Šta konvergira | Sigurnosna pažnja |
|---|---|---|
| **iSCSI** | SCSI blok-storage preko IP-a (port 3260) | izolovan storage VLAN, CHAP autentifikacija, IPSec za enkripciju |
| **FCoE** (Fibre Channel over Ethernet) | FC preko Etherneta (L2, nije rutabilan) | zahtijeva lossless Ethernet, odvojen segment |
| **VoIP** (SIP, RTP) | glas preko IP-a | SRTP i SIPS/TLS, odvojen voice VLAN, QoS, zaštita od toll frauda |
| **InfiniBand over Ethernet (RoCE)** | RDMA (direktan pristup memoriji) preko Etherneta | visoke performanse u HPC i AI klasterima; RDMA zaobilazi OS kontrole, pa je segmentacija ključna |
| **Compute Express Link (CXL)** | koherentna veza CPU, memorije i akceleratora preko PCIe | dijeljena memorija između uređaja, rizik curenja podataka između domena; zaštita kroz IDE (integritet i enkripcija linka) |
| **MPLS** | label switching između L2 i L3 („sloj 2,5“) | odvaja saobraćaj korisnika, ali **ne šifruje** |

> **Na ispitu:** konvergencija smanjuje troškove, ali **gubi se fizička izolacija** koju je specijalizovana mreža imala. Ispravan odgovor je skoro uvijek logička izolacija (VLAN, poseban segment) plus autentifikacija i enkripcija na nivou protokola.

## Transportna arhitektura i performanse (4.1)

### Topologije

| Topologija | Prednost | Mana |
|---|---|---|
| **Bus** | jednostavna | jedna greška na kablu ruši sve, kolizije |
| **Star** | izolacija kvara na jedan čvor | centralni uređaj je single point of failure |
| **Ring** | predvidiv pristup (token) | kvar jednog čvora prekida prsten (osim dual ring, FDDI) |
| **Mesh** (full/partial) | najveća redundansa | skupa, složena |
| **Spine-leaf** | predvidiva latencija u data centru, east-west saobraćaj | potrebno mnogo linkova |

### Planovi (planes)

| Plane | Funkcija | Zaštita |
|---|---|---|
| **Data plane** (forwarding) | prosljeđuje korisnički saobraćaj | ACL, firewall, enkripcija |
| **Control plane** | odlučuje kuda (routing protokoli, STP, ARP) | autentifikacija routing protokola (OSPF/BGP MD5 ili TCP-AO), CoPP (control plane policing) |
| **Management plane** | administracija uređaja (SSH, SNMP, API) | odvojena management mreža (OOB), MFA, RBAC, logovanje |

### Načini prosljeđivanja na switchu

- **Store-and-forward**: primi cijeli frame, provjeri **FCS/CRC**, pa prosljeđuje. Veća latencija, ali odbacuje oštećene frameove.
- **Cut-through**: prosljeđuje čim pročita odredišnu MAC adresu. Minimalna latencija (HPC, trading), ali propušta oštećene frameove.
- **Fragment-free**: kompromis, čita prvih 64 bajta.

### Metrike performansi

| Metrika | Definicija | Zašto je bitna za sigurnost |
|---|---|---|
| **Bandwidth** | teoretski kapacitet linka (npr. 1 Gb/s) | DDoS planiranje, dimenzionisanje |
| **Throughput** | stvarno prenesena količina u jedinici vremena | uvijek ≤ bandwidth; pad ukazuje na problem ili napad |
| **Latency** | kašnjenje od izvora do odredišta | IPS i TLS inspekcija dodaju latenciju |
| **Jitter** | varijacija latencije | ubija VoIP i video kvalitet |
| **SNR** (signal-to-noise ratio) | odnos snage signala i šuma, u dB | nizak SNR = greške, retransmisije; bežični signal koji „curi“ van objekta je i rizik povjerljivosti |

Primjer: link od 100 Mb/s, mjereno 62 Mb/s korisnog prenosa. Bandwidth je 100, throughput 62. Ako je latencija 40, 45, 38 i 60 ms, prosjek je 45,75 ms, a jitter (raspon odstupanja) je visok zbog skoka na 60 ms, što će se primijetiti u VoIP pozivu.

## Tokovi saobraćaja i segmentacija (4.1)

**North-south** je saobraćaj koji ulazi u ili izlazi iz data centra/VPC-a (klijenti, internet). **East-west** je saobraćaj između servera, servisa i podova unutar okruženja. Klasični perimetarski firewall vidi samo north-south; lateralno kretanje napadača je east-west. Zato moderni dizajn dodaje kontrole unutra.

### Fizička segmentacija

| Vrsta | Opis | Primjer |
|---|---|---|
| **In-band management** | upravljanje kroz istu mrežu kojom ide produkcijski saobraćaj | SSH na produkcijski interfejs |
| **Out-of-band (OOB)** | odvojena, nezavisna mreža za upravljanje | konzolni serveri, iDRAC/iLO na posebnoj mreži, LTE modem za hitni pristup |
| **Air-gapped** | potpuno fizički odvojena mreža, bez veze sa drugim mrežama | klasifikovani sistemi, OT sigurnosni sistemi, offline root CA |

Air gap nije apsolutan: prenosivi mediji, održavanje dobavljača i elektromagnetna emanacija mogu ga premostiti. Prateće kontrole su kontrola medija (kiosk za skeniranje), fizička sigurnost i TEMPEST zaštita.

### Logička segmentacija

| Tehnika | Sloj | Šta odvaja |
|---|---|---|
| **VLAN** (802.1Q) | 2 | broadcast domene na istom switchu; rizik VLAN hopping (odbrana: isključiti DTP, native VLAN koji se ne koristi, explicit trunk) |
| **VPN** | 3 ili više | logički privatan tunel preko javne mreže |
| **VRF** (Virtual Routing and Forwarding) | 3 | više nezavisnih routing tabela na istom ruteru; preklapajući adresni prostori |
| **Virtual domain** (VDOM, virtuelni kontekst) | 3–7 | jedan fizički firewall podijeljen u više logičkih firewalla sa odvojenom administracijom |

### Mikrosegmentacija

**Micro-segmentation** primjenjuje politiku na nivou pojedinačnog workloada, ne cijelog subneta. Komponente iz outlinea:

- **Overlay/enkapsulacija**: VXLAN, Geneve, GRE. Logička mreža preko fizičke, nezavisna od fizičke topologije.
- **Distribuirani firewalli**: pravila se izvršavaju u hipervizoru ili na hostu (npr. security grupe, Kubernetes NetworkPolicy).
- **Distribuirani ruteri** i **IDS/IPS** na svakom hostu ili u service meshu.
- **Zero Trust**: nema implicitnog povjerenja na osnovu lokacije u mreži; svaki zahtjev se autentifikuje, autorizuje i provjerava kontekst (NIST SP 800-207: PDP/PEP, o tome više u IAM modulu).

> **Na ispitu:** kada scenario opisuje napadača koji se nakon kompromitovanja jednog servera lateralno širi kroz „ravnu“ mrežu, najbolji dugoročni odgovor je mikrosegmentacija/Zero Trust, ne još jedan perimetarski firewall. Ako pitanje traži upravljanje mrežnim uređajima kada je produkcijska mreža pod napadom, odgovor je out-of-band management.

## Edge, bežične i celularne mreže (4.1)

### Edge mreže

- **Ingress filtering**: odbaciti dolazne pakete sa izvornim adresama koje ne mogu doći spolja (vlastiti opseg, RFC 1918, bogon). **Egress filtering**: odbaciti odlazne pakete sa tuđim izvornim adresama (BCP 38), čime organizacija ne učestvuje u spoofing DDoS-u i ograničava eksfiltraciju.
- **Peering**: direktna razmjena saobraćaja između mreža (IXP, privatni peering, cloud peering). Rizici: BGP hijacking i route leak; kontrole: **RPKI** (validacija porijekla rute), filtriranje prefiksa, ugovori.

### Bežične mreže

| Standard / tehnologija | Ključne sigurnosne činjenice |
|---|---|
| **WEP** | slomljen (RC4, kratak IV); nikad |
| **WPA** | TKIP, prelazno rješenje; zastario |
| **WPA2** | AES-CCMP; Personal (PSK) ili **Enterprise (802.1X/EAP + RADIUS)** |
| **WPA3** | **SAE** (Simultaneous Authentication of Equals) umjesto PSK, otpornost na offline napad na lozinku, forward secrecy; Enterprise 192-bit mod; OWE za otvorene mreže |
| **Bluetooth** | rizici: bluejacking (neželjene poruke), bluesnarfing (krađa podataka), bluebugging (preuzimanje kontrole); kontrole: isključiti discoverable mod, ažuran firmware, BLE uparivanje sa zaštitom |
| **Zigbee** | IEEE 802.15.4, mesh, mala potrošnja (IoT, pametne zgrade); AES-128, ali ključevi se često distribuiraju nesigurno pri uparivanju |
| **Satelit** | velika latencija (GEO ~600 ms round-trip), LEO manja; rizik prisluškivanja i ometanja, potrebna enkripcija end-to-end |

EAP metode: **EAP-TLS** (certifikat i na klijentu, najjači), **PEAP** i **EAP-TTLS** (TLS tunel, unutra lozinka), **EAP-FAST** (Cisco, PAC), **LEAP** (zastario). Lažna pristupna tačka (**evil twin**, rogue AP) se otkriva WIDS/WIPS sistemom.

### Celularne mreže

| Generacija | Bitno za ispit |
|---|---|
| **4G LTE** | međusobna autentifikacija pretplatnika i mreže (AKA), enkripcija radio interfejsa; downgrade na 2G uklanja te zaštite |
| **5G** | skriveni identitet pretplatnika (**SUCI** umjesto IMSI u čistom tekstu), **network slicing** (logičke mreže sa različitim SLA i izolacijom), MEC (edge computing), privatne 5G mreže za industriju; mnogo više IoT uređaja i softverski definisana jezgra (veća površina napada) |

Celularna veza zaobilazi korporativni perimetar: uređaj sa hotspotom je nekontrolisan most. Politika i MDM to rješavaju.

## CDN, SDN, VPC i software-defined security (4.1)

**CDN** (Content Delivery Network) kešira sadržaj na geografski raspoređenim edge čvorovima (anycast). Sigurnosne koristi: apsorbuje volumetrijski DDoS, skriva origin, WAF na edgeu, TLS terminacija. Rizici: povjeravanje TLS ključeva i sadržaja trećoj strani, keširanje osjetljivih odgovora, origin dostupan zaobilaženjem CDN-a (kontrola: origin prima samo saobraćaj od CDN-a).

**SDN** (Software Defined Networking) odvaja **control plane** (centralni kontroler) od **data planea** (switchevi). Kontroler komunicira sa uređajima kroz **southbound API** (npr. OpenFlow), a sa aplikacijama i orkestracijom kroz **northbound API** (REST).

| Pojam | Opis | Sigurnost |
|---|---|---|
| **SDN kontroler** | centralni mozak mreže | najvredniji cilj: kompromitovan kontroler = kompromitovana mreža; HA, hardening, MFA, mTLS prema uređajima |
| **SD-WAN** | softverski upravljan WAN preko više transporta (MPLS, internet, LTE) sa centralnom politikom | enkripcija tunela (IPSec), često uz **SASE** (SD-WAN + cloud sigurnost: SWG, CASB, ZTNA, FWaaS) |
| **NFV** (Network Functions Virtualization) | firewall, router, load balancer kao virtuelne mašine/kontejneri umjesto hardvera | sigurnost hipervizora, izolacija VNF-ova, upravljanje image-ima |

**VPC** (Virtual Private Cloud) je logički izolovana mreža kod cloud provajdera: subneti (javni/privatni), route tabele, internet i NAT gateway, **security grupe** (stateful, na nivou instance) i **network ACL** (stateless, na nivou subneta), VPC peering, privatni endpointi, flow logovi. Shared responsibility: provajder izoluje VPC-ove, ti konfigurišeš sve unutar svog.

**Software-defined security** (novo u outlineu iz 2027.) je sigurnosna politika izražena kao kod i primijenjena programski kroz API-je: security grupe i politike definisane u IaC-u, automatska karantina workloada iz SOAR-a, politike koje prate workload kada se preseli (ne vezane za IP adresu ili fizički port), mikrosegmentacija upravljana iz centralne konzole. Prednost je dosljednost i brzina; rizik je da greška u kodu ili kompromitovan pipeline mijenja sigurnost cijelog okruženja odjednom. Zato se na politiku primjenjuje change management, code review i verzionisanje.

## Monitoring i upravljanje mrežom (4.1)

| Funkcija | Sadržaj |
|---|---|
| **Network observability** | metrike, logovi, tokovi (NetFlow/IPFIX, VPC flow logs), paketni uvid (TAP, SPAN), telemetrija; cilj je razumjeti ponašanje, ne samo „radi/ne radi“ |
| **Traffic flow / shaping** | QoS, prioritizacija (glas ispred backupa), ograničavanje brzine (rate limiting, policing), zaštita kritičnog saobraćaja tokom zagušenja |
| **Capacity management** | praćenje trendova i planiranje prije nego što zagušenje postane problem dostupnosti |
| **Fault detection and handling** | SNMP trapovi, syslog, health checks, automatski failover, eskalacija i RCA |

Network TAP je pasivan i pouzdaniji za dokaze od SPAN porta (koji pod opterećenjem odbacuje pakete).

## Sigurne mrežne komponente (4.2)

### Rad infrastrukture

Dostupnost mrežne opreme je dio CIA trijade:

- **Redundantno napajanje**: dvostruka napajanja u uređaju (dual PSU) na dva nezavisna kruga, UPS za premošćavanje, generator za duže ispade.
- **Redundancija opreme i puteva**: HA parovi, dva ISP-a, različite trase kablova (path diversity).
- **Garancija i podrška**: ugovor o održavanju (vrijeme zamjene dijela, npr. 4h NBD), pristup firmware zakrpama, **EOL/EOS** praćenje. Uređaj bez podrške dobavljača ne dobija sigurnosne zakrpe, što je rizik koji mora biti evidentiran ili uklonjen.
- Rezervni dijelovi na lokaciji (cold spares) za kritične komponente.

### NAC (Network Access Control)

NAC odlučuje da li uređaj smije na mrežu i u koji segment, na osnovu identiteta i stanja (**posture**): verzija OS-a, zakrpe, EDR aktivan, enkripcija diska.

| Pojam | Opis |
|---|---|
| **802.1X** | port-based NAC: **supplicant** (klijent), **authenticator** (switch/WAP), **authentication server** (RADIUS) |
| **Pre-admission** | provjera prije pristupa mreži |
| **Post-admission** | stalna provjera nakon pristupa, ponovna procjena |
| **Agent / agentless** | trajni ili rastvorljivi (dissolvable) agent ili skeniranje bez agenta |
| **Remediation / quarantine VLAN** | neusklađen uređaj ide u ograničeni segment dok se ne popravi |
| **Fizički NAC** | appliance u kampusu, kontrola fizičkih portova |
| **Virtuelni NAC** | softversko rješenje u virtuelnom ili cloud okruženju; dio ZTNA pristupa |

MAC filtriranje nije jaka kontrola jer se MAC adresa lako lažira.

### Prenosni mediji

| Medij | Osobine | Sigurnost |
|---|---|---|
| **Coaxial** | otporniji na EMI od UTP-a | zastario u LAN-u |
| **Twisted pair (UTP/STP)** | jeftin, do ~100 m; STP oklopljen | emanacija, prisluškivanje fizičkim pristupom, crosstalk |
| **Fiber optic** | nema EMI, velike udaljenosti, teško prisluškivanje (ali moguće savijanjem) | najbolji izbor za zaštitu od emanacije i interferencije |
| **Bežični** | signal ide van zidova | enkripcija obavezna, kontrola snage i položaja antena |

Kvalitet propagacije signala: **attenuation** (slabljenje sa dužinom), **crosstalk** (preslušavanje između parica), **EMI/RFI** (interferencija). Fizička zaštita medija: kablovi kroz zaključane kanale i plenum prostor (plenum-rated kabl zbog toksičnog dima), zaključani ormari, pregled kablovskih trasa, zaštita od tapova.

### Endpoint security

Host-based kontrole: **HIDS/HIPS**, host firewall, **EDR/XDR**, anti-malware, application allowlisting, enkripcija diska, hardening (CIS benchmark), patch management, **MDM/UEM** za mobilne uređaje, DLP agent. Na CISSP-u je endpoint posljednja linija odbrane u defense in depth modelu i ključni element Zero Trusta (stanje uređaja je ulaz u odluku o pristupu).

> **Na ispitu:** ako je pitanje „koji medij BEST štiti od prisluškivanja zasnovanog na emanaciji i od EMI“, odgovor je optika. Ako je pitanje kako spriječiti da nepoznat laptop dobije pristup kada se fizički priključi u utičnicu u sali za sastanke, odgovor je 802.1X/NAC, ne MAC filtriranje.

## Sigurni komunikacioni kanali (4.3)

### Glas, video i saradnja

- **VoIP**: SIP (signalizacija, preko TLS-a = SIPS), RTP (media, šifrovano = **SRTP**). Odvojen voice VLAN, QoS za jitter, zaštita od **toll frauda** (neovlašteni međunarodni pozivi kroz kompromitovan PBX), **vishing** i **SPIT** (spam over internet telephony).
- **PBX**: tradicionalni rizik je **phreaking** i daljinski pristup za održavanje (DISA); promijeniti podrazumijevane lozinke, isključiti nekorišćene funkcije.
- **Konferencije i video sale**: pristup sastanku lozinkom/čekaonicom, sprečavanje neovlaštenog ulaska („zoombombing“), end-to-end enkripcija gdje je potrebna, kontrola snimanja i čuvanja snimaka (privatnost, zakonski zahtjevi), **sobni uređaji** (kamere, mikrofoni, ekrani u sali) kao IoT: ažuriranje firmware-a, odvojen segment, isključivanje kada se ne koriste.
- **Kolaboracijski alati** (chat, dijeljenje fajlova): klasifikacija i DLP, eksterni gosti, retencija, eDiscovery.

### Data communications

- **Backhaul**: veza između edge lokacija (bazne stanice, filijale) i jezgra mreže. Često ide preko treće strane ili mikrotalasa, pa zahtijeva enkripciju (IPSec, MACsec) i redundanciju.
- **Satelitske veze**: za udaljene lokacije (brodovi, rudnici), visoka latencija kod GEO, ograničen bandwidth, mogućnost prisluškivanja sa širokog područja (footprint). End-to-end enkripcija i rezervni put.
- **Leased line, MPLS, Frame Relay, ATM** (klasični WAN): MPLS izoluje, ali ne šifruje.
- **MACsec** (802.1AE): enkripcija na L2, hop-by-hop.

### Udaljeni pristup

| Opcija | Opis | Kada |
|---|---|---|
| **Site-to-site VPN** | IPSec tunel između gatewaya | filijale, partner |
| **Remote access VPN** | klijent (IPSec ili TLS/SSL VPN) | zaposleni van kancelarije |
| **Split tunneling** | samo korporativni saobraćaj ide kroz tunel | manji teret, ali uređaj je istovremeno na internetu i u korporativnoj mreži (rizik); **full tunnel** je sigurniji |
| **ZTNA** | pristup pojedinačnoj aplikaciji nakon provjere identiteta i stanja uređaja | zamjena za VPN koji daje pristup cijeloj mreži |
| **Jump box / bastion / PAM** | posrednik za administrativni pristup, sa snimanjem sesije | **administrativne funkcije mreže** |
| **VDI** | podaci ostaju u data centru, na endpoint ide samo slika | rad sa nepouzdanih uređaja |

Klasični protokoli autentifikacije za udaljeni pristup: **PAP** (lozinka u čistom tekstu, nikad), **CHAP** (challenge-response, periodična reautentifikacija), **EAP** (okvir za razne metode). AAA serveri: **RADIUS** (UDP, šifruje samo lozinku, kombinuje autentifikaciju i autorizaciju) i **TACACS+** (TCP, šifruje cijeli payload, odvaja AAA funkcije, idealan za administraciju mrežnih uređaja jer daje autorizaciju po komandi).

**Rad od kuće** (remote working, novo u 2027.): kućni ruter i porodični uređaji su nepovjerljiva mreža. Kontrole: upravljani uređaj, full-tunnel VPN ili ZTNA, MFA, EDR, politika fizičke privatnosti (ekran, razgovori), zabrana štampanja osjetljivih dokumenata kod kuće ili pravila za uništavanje.

### Povezivanje trećih strana

- **Telekom provajderi**: ugovor i SLA (dostupnost, vrijeme otklanjanja), redundantni provajderi sa različitim trasama, enkripcija preko njihove mreže jer provajder nije u tvojoj zoni povjerenja.
- **Hardverska podrška i dobavljači**: udaljeni pristup dobavljača samo kroz kontrolisani kanal (PAM, vremenski ograničen, odobren, snimljen), poseban **extranet** ili DMZ segment, princip najmanjih privilegija, ugovorne obaveze (NDA, pravo na audit, obavještavanje o incidentu). Klasičan napad preko HVAC dobavljača pokazuje zašto pristup treće strane mora biti segmentiran.
- **Interconnection Security Agreement (ISA)** i **MOU/MOA** dokumentuju tehničke i upravljačke uslove povezivanja dvije organizacije (NIST SP 800-47).

> **Na ispitu:** pitanje o pristupu dobavljača obično nudi „dati VPN nalog sa trajnim pristupom“ i „vremenski ograničen, nadziran pristup kroz posrednika uz ugovor“. Biraj drugo. A prije tehnike, pravi PRVI korak je ugovor i procjena rizika treće strane.

## Scenariji

**Scenario 1.** Bolnica uvodi IP telefoniju na postojeću mrežu i istovremeno pacijentima nudi gost Wi-Fi. Šta je najvažnije? Odvojeni VLAN-ovi za glas, medicinske uređaje, korisnike i goste; QoS za glas; SRTP/SIPS; gost Wi-Fi bez ikakvog puta prema internoj mreži; WPA3-Enterprise za osoblje. Sigurnost života: medicinski uređaji i komunikacija hitne službe imaju prioritet u dizajnu redundancije.

**Scenario 2.** Fabrika ima SCADA sistem koji koristi DNP3, a uprava želi da inženjeri prate proizvodnju od kuće. Ispravan pristup: procjena rizika, OT mreža ostaje segmentirana (Purdue model), pristup kroz DMZ i jump host uz MFA, jednosmjerni prenos podataka za izvještaje (data diode) gdje je moguće, nikakav direktan pristup sa interneta.

**Scenario 3.** Napadač je kompromitovao web server u DMZ-u i sa njega skenira bazu podataka u internoj mreži, jer firewall dozvoljava sav saobraćaj iz DMZ-a prema bazi. Uzrok je loša politika (previše dozvola), a rješenje je allowlist samo potrebnog porta od aplikacionog servera prema bazi, mikrosegmentacija i IDS na east-west saobraćaju.

## Rezime

- OSI: 7 slojeva, PDU (bit, frame, packet, segment, data), uređaji i kontrole po sloju; TCP/IP ima 4 sloja.
- IPv6 nema broadcast, ima anycast i multicast; dual stack i tuneli zaobilaze IPv4 kontrole.
- IPSec: AH (bez enkripcije), ESP (sa enkripcijom), transport vs tunnel mode, IKE. TLS 1.3 umjesto SSL-a. DNSSEC daje integritet, ne povjerljivost.
- Multilayer protokoli (DNP3) i enkapsulacija otvaraju covert channels; konvergirani protokoli (iSCSI, FCoE, VoIP, RoCE, CXL) gube fizičku izolaciju.
- Data/control/management plane; store-and-forward provjerava CRC, cut-through je brži; bandwidth ≠ throughput, jitter je varijacija latencije.
- North-south vs east-west; OOB management; air gap; VLAN, VPN, VRF, virtual domain; mikrosegmentacija i Zero Trust protiv lateralnog kretanja.
- Ingress/egress filtering, RPKI za peering; WPA3/SAE, 802.1X/EAP-TLS; 5G SUCI i network slicing.
- CDN apsorbuje DDoS; SDN centralizuje control plane (kontroler je ključna meta); SD-WAN, NFV, VPC; software-defined security je politika kao kod.
- Komponente: redundantno napajanje, podrška i EOL, NAC/802.1X sa posture provjerom, optika protiv EMI i emanacije, host-based zaštita.
- Kanali: SRTP/SIPS, zaštita video sala i snimaka, šifrovan backhaul i satelit, ZTNA i full tunnel, TACACS+ za administraciju, kontrolisan i ugovorom pokriven pristup trećih strana.
