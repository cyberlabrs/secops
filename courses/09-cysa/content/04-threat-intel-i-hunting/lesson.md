## Cilj ispita: 1.4

- **1.4** Explain threat intelligence and threat-hunting concepts: akteri prijetnji (APT, insider), TTP-ovi (heat maps, Pyramid of Pain, MITRE ATT&CK, atribucija), faktori povjerenja (timeliness, relevance, accuracy), metode i izvori prikupljanja (OSINT, closed-source, dijeljenje), životni ciklus IoC-a (prikupljanje, analiza, primjena; atomic i behavioral), threat modeling (STRIDE), threat mapping i cyber deception.

Nakon ovog modula trebalo bi da znaš:

- razlikovati vrste aktera i šta svaka znači za odbranu;
- objasniti zašto su TTP-ovi vredniji od hash-eva (Pyramid of Pain);
- ocijeniti kvalitet obavještajnog podatka (pravovremenost, relevantnost, tačnost);
- provesti IoC od prikupljanja do primjene u SIEM-u i EDR-u;
- planirati threat hunt zasnovan na hipotezi i ATT&CK heat mapi;
- primijeniti STRIDE i cyber deception (honeypot, honeytoken, canary).

U Security+ kursu si upoznao aktere, a u detection labu i SC-200 kursu mapirao detekcije na ATT&CK i pisao hunting upite. CySA+ to povezuje u program: **kako intel pretvoriti u detekcije i hunt-ove**.

## Threat intelligence: osnovni pojmovi

**Threat intelligence** je podatak o prijetnjama koji je prikupljen, obrađen i analiziran tako da podrži odluku. Sirov feed IP adresa nije intel dok ga neko ne stavi u kontekst.

| Nivo | Publika | Sadržaj | Primjer |
|---|---|---|---|
| **Strategic** | Uprava, CISO | Trendovi, rizik, motivi | „Ransomware grupe ciljaju zdravstvo u regionu“ |
| **Operational** | SOC menadžment, IR | Kampanje, namjere, vrijeme | „Kampanja X koristi lažne fakture ovog mjeseca“ |
| **Tactical** | Analitičari, inženjeri detekcije | TTP-ovi, IoC-i | „T1059.001 sa `-enc`, C2 na 198.51.100.23“ |

Životni ciklus intela: **planning/direction** (šta nam treba, intelligence requirements) → **collection** → **processing** (normalizacija, deduplikacija) → **analysis** → **dissemination** (pravim ljudima u pravom formatu) → **feedback**.

## Akteri prijetnji

| Akter | Motiv | Resursi | Šta znači za odbranu |
|---|---|---|---|
| **APT** (advanced persistent threat) | Špijunaža, sabotaža, ponekad finansije | Veliki, često državna podrška | Dugo zadržavanje, prilagođeni alati, LOTL; potreban hunting, ne samo potpisi |
| **Insider threat** | Osveta, novac, nemar | Legitiman pristup | Teško se vidi pravilima; UEBA, DLP, najmanje privilegije, offboarding |
| Organizovani kriminal | Novac | Veliki | Ransomware, BEC, RaaS ekosistem |
| Hacktivisti | Ideologija | Mali do srednji | DDoS, deface, curenje podataka |
| Nation-state | Geopolitika | Najveći | Supply chain, zero-day |
| Unskilled attacker | Zabava, reputacija | Mali | Javni alati, buka |

**Insider** može biti **zlonamjeran** (namjerno krade ili sabotira) ili **nenamjeran** (greškom šalje podatke, pada na phishing). Indikatori zlonamjernog insajdera: pristup podacima van uloge, masovno preuzimanje prije odlaska iz firme, rad u neuobičajeno vrijeme, pokušaji zaobilaženja DLP-a.

> **Na ispitu:** **APT** = dugotrajno, prikriveno prisustvo, prilagođeni alati i ciljanje konkretne organizacije. Ključne riječi su „persistent“, „months“, „stealthy“. Za **insajdera** sa legitimnim pristupom najbolja detekcija je **UEBA** i DLP, a ne IDS potpisi.

## TTP-ovi

**TTP** (tactics, techniques, and procedures): **taktika** je cilj (npr. Credential Access), **tehnika** način (OS Credential Dumping, T1003), **procedura** konkretna implementacija određenog aktera (npr. dump LSASS memorije određenim alatom i parametrima).

### MITRE ATT&CK

Već poznat iz detection laba: matrica taktika (Reconnaissance → Impact) i tehnika sa ID-jevima, za Enterprise (Windows, Linux, macOS, cloud, kontejneri), Mobile i ICS. U threat intelu ATT&CK služi kao **zajednički jezik**: izvještaj o grupi navodi tehnike, a ti provjeravaš imaš li detekciju za svaku.

### Heat maps

**Heat mapa** je ATT&CK matrica obojena po nekoj mjeri, najčešće u **ATT&CK Navigatoru**:

- koliko često grupe relevantne za tvoj sektor koriste tehniku (**prijetnja**);
- koliko dobro tvoje detekcije pokrivaju tehniku (**pokrivenost**);
- razlika (gap) između ta dva sloja = prioritet za nove detekcije i hunt.

```text
Tehnika                          Upotreba (aktori sektora)   Naša pokrivenost   Gap
T1566.001 Spearphishing Attach.  ██████████ 9/10             ████████ visoka     nizak
T1059.001 PowerShell             █████████  8/10             ██████   srednja    srednji
T1003.001 LSASS Memory           ███████    7/10             ██       niska      VISOK  ← hunt
T1021.002 SMB/Admin Shares       ██████     6/10             ████     srednja    srednji
```

### Pyramid of Pain

David Bianco je IoC-e poredao po tome koliko „boli“ napadača kada ih ti otkriješ i blokiraš:

```text
                 /\
                /  \        TTPs                  ← najteže promijeniti (Tough!)
               /----\
              / Tools\      Alati                 ← Challenging
             /--------\
            / Network/ \    Mrežni i host
           / Host Artif.\   artefakti             ← Annoying
          /--------------\
         /  Domain Names  \                       ← Simple
        /------------------\
       /    IP Addresses    \                     ← Easy
      /----------------------\
     /     Hash Values        \                   ← Trivial
    /--------------------------\
```

Hash se mijenja jednim bajtom, IP adresa za minut, domen za dolar. Detekcija ponašanja (npr. „Office proces pokreće PowerShell koji preuzima sadržaj“) pogađa **TTP** i tjera napadača da mijenja način rada, što je skupo.

> **Na ispitu:** Pitanje „koja detekcija bi napadaču nanijela NAJVIŠE štete / bila najteža za zaobilaženje“ → vrh piramide: **TTP-ovi** (ponašanje). Najlakše zaobići: **hash vrijednosti**.

### Atribucija

**Atribucija** je pripisivanje aktivnosti konkretnom akteru. Zasniva se na preklapanju TTP-ova, infrastrukture, alata, vremena aktivnosti, jezika u kodu i ciljeva. Problemi: dijeljeni i javni alati, **false flag** operacije (namjerno podmetnuti tragovi), ograničen pogled jedne organizacije. Za većinu SOC-ova atribucija je manje važna od detekcije i obuzdavanja; korisna je kada otkrije **šta akter obično radi dalje**, pa možeš proaktivno tražiti sljedeći korak.

## Faktori povjerenja u intel

Svaki obavještajni podatak se ocjenjuje prije nego što ga pretvoriš u blokadu:

| Faktor | Pitanje | Primjer lošeg |
|---|---|---|
| **Timeliness** | Da li je još aktuelan? | IP adresa C2 servera iz izvještaja starog 14 mjeseci, danas pripada cloud provajderu |
| **Relevance** | Da li se odnosi na nas (sektor, tehnologija, region)? | IoC-i za SCADA napade u firmi bez OT-a |
| **Accuracy** | Da li je tačan i provjeren? | Feed koji označava 8.8.8.8 kao zlonamjeran |

Mnogi izvori koriste i **Admiralty (NATO) sistem**: pouzdanost izvora A–F i vjerodostojnost informacije 1–6 (A1 = potpuno pouzdan izvor, potvrđena informacija). Loš intel ima cijenu: **lažno pozitivni alarmi** i blokade legitimnih servisa.

> **Na ispitu:** Ako blokada iz feeda prekine legitiman servis (npr. CDN adresu koja je ranije bila zlonamjerna), problem je **timeliness/accuracy** feeda. Rješenje je **istek (aging) IoC-a** i ocjenjivanje izvora, a ne odustajanje od intela.

## Metode i izvori prikupljanja

| Vrsta | Primjeri | Prednosti | Mane |
|---|---|---|---|
| **OSINT** | Javni izvještaji proizvođača, CISA savjeti i KEV, abuse.ch (URLhaus, MalwareBazaar, ThreatFox), OTX, blogovi, društvene mreže, certificate transparency logovi, paste sajtovi | Besplatno, mnogo | Šum, različit kvalitet, dostupno i napadaču |
| **Closed-source** | Komercijalni feedovi (Recorded Future, Mandiant), ISAC razmjena, interna telemetrija, dark web monitoring provajdera | Kuriran, kontekst, ekskluzivno | Cijena, NDA, ograničeno dijeljenje |
| **Interni izvori** | Vlastiti incidenti, SIEM, EDR, honeypot | Najrelevantniji | Ograničen pogled |

### Dijeljenje (threat intelligence sharing)

- **ISAC/ISAO** (Information Sharing and Analysis Center): sektorske zajednice (FS-ISAC za finansije, H-ISAC za zdravstvo), nacionalni **CERT/CSIRT** timovi.
- **STIX 2.1** (Structured Threat Information Expression): JSON format za objekte (indicator, malware, threat-actor, attack-pattern, relationship).
- **TAXII 2.1**: protokol (HTTPS API) za razmjenu STIX sadržaja; kolekcije i kanali.
- **TLP 2.0** (Traffic Light Protocol, FIRST): **TLP:RED** (samo prisutni), **TLP:AMBER** (organizacija i klijenti po potrebi), **TLP:AMBER+STRICT** (samo organizacija), **TLP:GREEN** (zajednica), **TLP:CLEAR** (javno).

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--7b1e...",
  "name": "C2 server kampanje FakturaX",
  "pattern": "[ipv4-addr:value = '198.51.100.23']",
  "pattern_type": "stix",
  "valid_from": "2026-10-14T00:00:00Z",
  "valid_until": "2026-11-14T00:00:00Z",
  "confidence": 80,
  "object_marking_refs": ["marking-definition--...tlp-amber"]
}
```

Obrati pažnju na `valid_until` (timeliness ugrađen u IoC) i `confidence`.

## Indicator of compromise: životni ciklus

1. **Collection**: iz feedova, izvještaja, sopstvenih incidenata (hash iz EDR-a, domen iz proxy loga), sandboxa.
2. **Analysis**: validacija (da li je legitiman servis?), deduplikacija, obogaćivanje (WHOIS, pasivni DNS, VirusTotal), ocjena povjerenja, mapiranje na ATT&CK i aktera.
3. **Application/usage**: blokada (firewall, DNS sinkhole, EDR), detekciono pravilo u SIEM-u, **retro-hunt** (pretraga istorijskih logova: da li smo već bili pogođeni?), dijeljenje sa zajednicom, i na kraju **povlačenje** kad istekne.

### Tipovi IoC-a

| Tip | Opis | Primjeri | Trajnost |
|---|---|---|---|
| **Atomic** | Ne može se dalje razložiti, ima smisla sam za sebe | IP adresa, domen, e-mail adresa, URL | Kratka |
| **Computed** | Izveden iz podataka | Hash fajla, JA3/JA4 otisak, regex | Kratka do srednja |
| **Behavioral** | Kombinacija ponašanja, često mapirana na TTP | „Word → PowerShell `-enc` → konekcija na novoregistrovan domen“ | Duga |

Ciljevi ispita eksplicitno traže **atomic** i **behavioral**; computed je treći tip iz istog izvornog modela (Lockheed Martin), dobro ga je znati.

```bash
# Retro-hunt: da li je iko u zadnjih 90 dana pričao sa IoC adresom (Zeek conn.log)
$ zcat /logs/zeek/2026-0[7-9]-*/conn.*.log.gz /logs/zeek/2026-10-*/conn.*.log.gz \
    | zeek-cut ts id.orig_h id.resp_h id.resp_p | awk '$3=="198.51.100.23"' | head -3
1758012311.20  10.0.4.15  198.51.100.23  443
```

### Od izvještaja do akcije

Kada stigne savjet (npr. CISA advisory o kampanji koja iskorištava VPN uređaje), analitičar ga razlaže ovako:

| Dio izvještaja | Pitanje | Akcija |
|---|---|---|
| Pogođena tehnologija i CVE | Imamo li taj proizvod i verziju? | Upit u inventar, provjera KEV statusa, hitno patchovanje (domen 2) |
| Atomic IoC-i (IP, domeni) | Da li smo ih vidjeli? | Retro-hunt u proxy, DNS i firewall logovima, privremena blokada sa istekom |
| Computed IoC-i (hash) | Postoje li fajlovi na diskovima? | EDR pretraga, YARA nad diskovima |
| TTP-ovi (ATT&CK ID) | Imamo li detekciju za svaku tehniku? | Ažuriranje heat mape, hunt za tehnike bez pokrivenosti |
| Preporučene mitigacije | Šta je primjenjivo kod nas? | Change zahtjev, kompenzacione kontrole |

## Threat hunting

**Threat hunting** je proaktivna potraga za prijetnjama koje su zaobišle postojeće detekcije, uz pretpostavku da je kompromitacija moguća (**assume breach**). Razlika od monitoringa: monitoring reaguje na alarm, hunting počinje bez alarma.

| Pristup | Polazi od | Primjer |
|---|---|---|
| **Hypothesis-driven** | Hipoteze zasnovane na intelu ili ATT&CK gapu | „Grupa iz izvještaja koristi scheduled tasks za perzistenciju; tražimo nove zadatke van GPO-a“ |
| **Intel-driven (IoC)** | Konkretnih IoC-a | Retro-hunt za hash i domene iz CISA savjeta |
| **Data/analytics-driven** | Anomalija u podacima | Stack counting: rijetki procesi roditelji, rijetki User-Agenti |

Proces: **hipoteza → prikupljanje podataka → istraga (upiti, stacking, vizualizacija) → nalaz → odgovor ili nova detekcija → dokumentacija**. Najvrednija izlazna vrijednost hunta je često **nova automatska detekcija** i popunjena rupa u vidljivosti.

```text
// KQL: rijetki parent-child parovi na svim endpointima (stacking)
DeviceProcessEvents
| where Timestamp > ago(30d)
| summarize hosts=dcount(DeviceName), cnt=count() by InitiatingProcessFileName, FileName
| where hosts <= 2
| order by cnt asc
```

> **Na ispitu:** Hunting je **proaktivan** i počinje **hipotezom**; ako scenarij kaže „nije bilo alarma, ali tim želi provjeriti da li je napadač prisutan“, odgovor je threat hunting. Rezultat uspješnog hunta treba pretvoriti u **automatizovanu detekciju**.

### Primjer hunta od početka do kraja

**1. Okidač (intel):** ISAC dijeli TLP:AMBER izvještaj da grupa koja cilja finansijski sektor nakon ulaska kopira memoriju LSASS procesa (T1003.001), koristeći `rundll32.exe` sa `comsvcs.dll` i parametrom `MiniDump`. Heat mapa pokazuje da za tu tehniku imamo nisku pokrivenost.

**2. Hipoteza:** „Ako je grupa prisutna kod nas, u zadnjih 30 dana postoji pristup memoriji `lsass.exe` iz procesa koji nije sigurnosni alat, ili `rundll32` sa `comsvcs.dll`.“

**3. Podaci:** EDR (DeviceProcessEvents), Sysmon Event ID 10 (ProcessAccess) i 1 (ProcessCreate), Security 4688. Provjeri da su podaci uopšte dostupni na svim hostovima: hunt bez telemetrije daje lažnu sigurnost.

**4. Istraga:**

```text
// KQL: rundll32 sa comsvcs i MiniDump
DeviceProcessEvents
| where Timestamp > ago(30d)
| where FileName =~ "rundll32.exe" and ProcessCommandLine has_all ("comsvcs", "MiniDump")
| project Timestamp, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName
```

```text
Timestamp            DeviceName  AccountName  ProcessCommandLine                                         InitiatingProcessFileName
2026-10-02 02:14:51  FIN-WS-031  svc_backup   rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump 712 C:\ProgramData\d.bin full   cmd.exe
```

**5. Nalaz i odgovor:** jedan pogodak na radnoj stanici, servisni nalog, 02:14 noću. Otvara se incident (eskalacija u IR proces, modul 10), resetuju se kredencijali naloga koji su bili prijavljeni na host.

**6. Detekcija:** hunt se pretvara u trajno pravilo (Sigma u YAML-u, kao u detection labu) da se sljedeći put ne mora tražiti ručno:

```yaml
title: LSASS dump preko comsvcs.dll
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: '\rundll32.exe'
    CommandLine|contains|all: ['comsvcs', 'MiniDump']
  condition: selection
level: high
tags: [attack.credential_access, attack.t1003.001]
```

**7. Dokumentacija i dijeljenje:** nalazi i novi IoC-i se vraćaju u MISP, a heat mapa se ažurira (pokrivenost T1003.001 sada je srednja).

### Insider threat: specifični indikatori

Insajderski hunt se ne oslanja na malver nego na **odstupanje od uloge i istorije**:

- pristup repozitorijima ili folderima koje korisnik nikad ranije nije otvarao;
- nagli rast preuzimanja ili štampanja nakon što je zaposleni dao otkaz (HR signal);
- upotreba ličnog cloud storage-a ili USB-a sa poslovnog računara;
- pokušaji pristupa resursima koji vraćaju „access denied“ (testiranje granica);
- rad van uobičajenog radnog vremena bez poslovnog razloga.

Kombinacija **HR podataka, UEBA i DLP** je ključna, uz pažljivu pravnu i privatnosnu proceduru (insajderske istrage se vode zajedno sa HR-om i pravnom službom).

## Threat modeling: STRIDE

**Threat modeling** sistematski traži prijetnje u dizajnu sistema, najbolje prije implementacije. **STRIDE** (Microsoft) klasifikuje prijetnje po svojstvu koje narušavaju:

| Prijetnja | Narušava | Primjer | Kontrola |
|---|---|---|---|
| **S**poofing | Autentikaciju | Lažno predstavljanje kao drugi korisnik ili servis | MFA, mTLS, potpisani tokeni |
| **T**ampering | Integritet | Izmjena podataka u prenosu ili bazi | Hash, potpis, TLS, kontrola pristupa |
| **R**epudiation | Neporecivost | Korisnik poriče da je izvršio transakciju | Audit logovi zaštićeni od izmjene, potpisi |
| **I**nformation disclosure | Povjerljivost | Curenje podataka kroz grešku ili loš pristup | Enkripcija, least privilege |
| **D**enial of service | Dostupnost | Preopterećenje servisa | Rate limiting, autoscaling, CDN |
| **E**levation of privilege | Autorizaciju | Običan korisnik postaje admin | Provjera autorizacije, sandboxing |

Model se pravi nad **data flow dijagramom** (procesi, skladišta, tokovi, granice povjerenja), kao u modulu modelovanja prijetnji iz sigurnosnih temelja. Za SOC je izlaz threat modela lista mjesta gdje treba logovanje i detekcija.

## Threat mapping

**Threat mapping** povezuje prijetnje sa imovinom i kontrolama: koje tehnike relevantnih aktera pogađaju koje sisteme, i koje detekcije i kontrole ih pokrivaju. U praksi se radi kao ATT&CK mapiranje (heat mapa pokrivenosti), uz vezu sa inventarom imovine i rezultatima threat modela. Izlaz su prioriteti: gdje nemaš vidljivost, a prijetnja je vjerovatna.

## Cyber deception

**Cyber deception** postavlja mamce koje legitimni korisnici nikad ne dodiruju, pa svaki dodir ima vrlo malo lažno pozitivnih alarma.

| Tehnika | Opis | Šta otkriva |
|---|---|---|
| **Honeypot** | Lažni sistem ili servis (SSH, SMB, RDP) | Skeniranje i lateral movement |
| **Honeynet** | Mreža honeypotova | Ponašanje napadača kroz više koraka |
| **Honeytoken / canary token** | Lažni kredencijal, API ključ, dokument ili DNS zapis koji javlja kada se upotrijebi | Krađu podataka i kredencijala |
| **Honey account** | Lažni AD nalog (npr. sa SPN-om) | Kerberoasting, enumeraciju naloga |
| **Honeyfile** | Fajl „lozinke.xlsx“ na share-u | Neovlašten pristup share-u |
| **DNS sinkhole** | Preusmjerava zlonamjerne domene na kontrolisanu adresu | Zaražene hostove koji pokušavaju C2 |

```text
EventID 4769  Account Name: j.kovac  Service Name: svc_sql_backup  Ticket Encryption Type: 0x17
# svc_sql_backup je honey account: nijedan legitiman servis ga ne koristi
```

> **Na ispitu:** Kada se traži detekcija sa **vrlo malo lažno pozitivnih** rezultata za lateral movement ili krađu kredencijala, odgovor je često **honeytoken/honeypot**. Deception ne sprječava napad, nego ga rano otkriva; mamci moraju biti izolovani da ne postanu odskočna daska.

## Rezime

- Intel ima strateški, operativni i taktički nivo i životni ciklus od zahtjeva do povratne informacije.
- **APT**: dugotrajno, prikriveno, ciljano; **insider**: legitiman pristup, otkriva ga UEBA i DLP.
- **TTP** > alati > artefakti > domeni > IP > hash (**Pyramid of Pain**); detekcija ponašanja je najteža za zaobilaženje.
- **ATT&CK heat mapa** pokazuje razliku između prijetnje i pokrivenosti; to su prioriteti za hunt i nove detekcije.
- **Atribucija** je nesigurna (false flag, dijeljeni alati) i za SOC sporedna.
- Kvalitet intela: **timeliness, relevance, accuracy**; IoC-i moraju isteći.
- Izvori: **OSINT**, **closed-source**, interni; dijeljenje kroz ISAC, **STIX/TAXII**, uz **TLP 2.0**.
- IoC: **collection → analysis → application** (blokada, detekcija, retro-hunt); tipovi **atomic** i **behavioral** (plus computed).
- **Threat hunting** je proaktivan, kreće od hipoteze i završava novom detekcijom.
- **STRIDE**: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege.
- **Cyber deception** (honeypot, honeytoken, honey account) daje rana upozorenja sa malo lažnih alarma.
