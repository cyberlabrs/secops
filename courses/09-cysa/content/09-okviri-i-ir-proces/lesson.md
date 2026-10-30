## Ciljevi ispita: 3.1 i 3.2

Ovaj modul otvara domen 3 (**Incident Response and Management**, 24% ispita):

- **3.1** sažeti koncepte okvira metodologije napada: **Cyber Kill Chain**, **Diamond Model of Intrusion Analysis** i **MITRE ATT&CK**,
- **3.2** sažeti proces odgovora na incident: **Preparation**, **Detection**, **Analysis**, **Containment**, **Eradication**, **Recovery**, **Post-incident**.

Poslije modula treba da znaš:

- da za dati scenarij kažeš u kojoj je fazi Kill Chaina napadač i gdje ga je najjeftinije zaustaviti,
- da popuniš četiri vrha Diamond modela iz opisa incidenta i objasniš **pivoting**,
- da razlikuješ **tactic**, **technique**, **sub-technique** i **procedure** u ATT&CK-u i pročitaš ID poput `T1059.001`,
- da poredaš faze IR procesa i prepoznaš aktivnost koja pripada svakoj fazi,
- kako **NIST SP 800-61r3** (april 2025) mapira staru petlju na funkcije **CSF 2.0**.

Ovo već znaš iz Security+ (IR faze) i SC-200 (ATT&CK mapiranje u Defender XDR/Sentinelu). Ovdje je fokus na analitičarskom uglu: kako okvir koristiš da opišeš, predvidiš i prekineš napad.

## Zašto okviri napada

Okvir metodologije napada daje **zajednički rječnik**. Kad SOC kaže „napadač je u fazi lateral movement“, svi znaju šta to znači, koje logove treba gledati i koji je sljedeći vjerovatan korak. Okviri služe za:

- **opis** incidenta (izvještaj, threat intel razmjena),
- **predviđanje** sljedećeg koraka napadača,
- **procjenu pokrivenosti** detekcijama (gdje nemamo vidljivost),
- **planiranje kontrola** (gdje prekidamo lanac).

| Okvir | Autor | Struktura | Najbolje za |
|---|---|---|---|
| **Cyber Kill Chain** | Lockheed Martin (2011) | 7 linearnih faza | Visok nivo: gdje prekinuti napad, komunikacija sa menadžmentom |
| **Diamond Model** | Caltagirone, Pendergast, Betz (2013) | 4 vrha + meta-svojstva | Analiza pojedinačnog događaja, atribucija, pivoting kroz threat intel |
| **MITRE ATT&CK** | MITRE (javna baza, od 2013/2015) | Matrica taktika × tehnika, sa procedurama iz stvarnih napada | Detaljno mapiranje ponašanja, pokrivenost detekcija, threat hunting, emulacija |

> **Na ispitu:** pitaj se koliko je detaljan opis. „Sedam faza, prekid lanca“ → **Kill Chain**. „Adversary, capability, infrastructure, victim“ → **Diamond**. „Taktika/tehnika sa ID-em, mapiranje detekcija, gap analiza“ → **ATT&CK**.

## Cyber Kill Chain

Lockheed Martin je posudio vojni koncept „lanca ubijanja“: napad je niz koraka i **prekid bilo koje karike** zaustavlja napad. Što ranije prekineš, to je jeftinije.

| # | Faza | Šta napadač radi | Šta branilac vidi / radi |
|---|---|---|---|
| 1 | **Reconnaissance** | Prikuplja informacije: OSINT, LinkedIn, skeniranje javnih servisa | Logovi skeniranja na perimetru, smanjenje javnog footprinta |
| 2 | **Weaponization** | Spaja exploit i payload (npr. makro dokument sa loaderom) | Branilac ovo **ne vidi** direktno; pomaže threat intel o alatima |
| 3 | **Delivery** | Dostava: phishing email, USB, kompromitovan sajt | Email gateway, URL filtering, sandbox priloga |
| 4 | **Exploitation** | Iskorištava ranjivost ili korisnika (makro se pokrene) | EDR, patching, ASR pravila, onemogućeni makroi |
| 5 | **Installation** | Instalira backdoor, persistence (servis, Run ključ, scheduled task) | EDR, FIM, Sysmon event 13 (registry), Windows 4698/7045 |
| 6 | **Command and Control (C2)** | Uspostavlja kanal ka svojoj infrastrukturi (beaconing) | DNS/proxy logovi, NetFlow, IDS, blokiranje domena |
| 7 | **Actions on Objectives** | Krađa podataka, enkripcija (ransomware), sabotaža | DLP, egress monitoring, backup, segmentacija |

Primjer povezivanja sa onim što si radio u detection labu: Wazuh alarm na novi servis (Windows **7045**) znači da je napadač najmanje u fazi **Installation**. Ako u isto vrijeme proxy pokazuje pravilne konekcije na rijedak domen svakih 60 sekundi, već je u fazi **C2**.

```
$ tshark -r beacon.pcap -Y "dns.qry.name contains \"cdn-upd\"" -T fields -e frame.time_relative -e dns.qry.name
0.000000     cdn-upd4te.example
60.012331    cdn-upd4te.example
120.009871   cdn-upd4te.example
180.010442   cdn-upd4te.example
```

Pravilan razmak od ~60 s (mali **jitter**) je klasičan indikator beaconinga, tj. faze 6.

**Ograničenja Kill Chaina** (često pitanje):

- fokusiran je na **perimetar** i malver; slabo opisuje insajdere, napade preko kredencijala ili cloud bez malvera,
- **linearan** je, a stvarni napadi se vraćaju u ranije faze (novi recon iznutra, lateral movement),
- faze 1 i 2 se dešavaju kod napadača, pa ih branilac skoro ne vidi.

Zato postoje proširenja poput **Unified Kill Chain** (Paul Pols, 18 faza u tri ciklusa: In, Through, Out) koja kombinuje Kill Chain i ATT&CK.

> **Na ispitu:** „U kojoj fazi organizacija ima NAJMANJE vidljivosti?“ → **Weaponization** (dešava se na napadačevoj infrastrukturi). „Gdje je NAJBOLJE prekinuti napad?“ → što ranije, obično **Delivery** (email filter, blokiranje priloga). Phishing email = Delivery, pokretanje makroa = Exploitation, scheduled task = Installation.

## Diamond Model of Intrusion Analysis

Diamond model opisuje **jedan događaj** (event) kroz četiri međusobno povezana vrha:

```
                Adversary
               /         \
              /           \
     Infrastructure ---- Capability
              \           /
               \         /
                 Victim
```

| Vrh | Značenje | Primjer |
|---|---|---|
| **Adversary** | Ko napada (operator i/ili naručilac) | APT grupa, ransomware afilijat, insajder |
| **Capability** | Čime napada: alati, malver, tehnike | Phishing makro, Cobalt Strike beacon, exploit za CVE |
| **Infrastructure** | Preko čega isporučuje i upravlja | C2 domeni i IP adrese, kompromitovani email serveri, VPS |
| **Victim** | Meta: osoba, organizacija, sistem, imovina | Računovodstvo, laptop `FIN-LT-07`, email `ana@firma.ba` |

Ivice povezuju vrhove: adversary **razvija** capability i **koristi** infrastrukturu, capability se **primjenjuje** na victim, infrastruktura **povezuje** napadača i žrtvu.

**Meta-svojstva** (meta-features) događaja: **timestamp**, **phase** (npr. faza Kill Chaina), **result** (uspjeh/neuspjeh), **direction** (npr. infrastructure → victim), **methodology** (klasa aktivnosti, npr. spear phishing) i **resources** (šta je napadaču trebalo: novac, znanje, pristup).

Dvije proširene ose:

- **Social-political**: odnos napadača i žrtve, motiv (finansijski, špijunaža, haktivizam),
- **Technology**: veza capability–infrastructure (npr. malver koristi DNS tunel).

### Pivoting

Glavna praktična vrijednost: iz jednog poznatog vrha **pivotiraš** na ostale. Iz poznate C2 IP adrese (infrastructure) pretražiš passive DNS i nađeš druge domene iste grupe, iz njih druge žrtve u svojoj mreži, iz uzorka malvera (capability) nađeš druge kampanje.

```
$ jq -r '.[] | select(.c2=="203.0.113.45") | "\(.host)\t\(.first_seen)"' edr_netconn.json
FIN-LT-07      2026-10-02T08:14:11Z
FIN-LT-11      2026-10-02T09:02:47Z
HR-DT-03       2026-10-03T07:55:09Z
```

Jedna infrastruktura → tri žrtve. To je pivot od vrha Infrastructure ka Victim.

**Activity thread** povezuje više Diamond događaja jednog napada hronološki (po fazama Kill Chaina), a **activity group** grupiše slične threadove (isti napadač ili kampanja).

> **Na ispitu:** pitanje navede elemente i traži model: „analitičar je identifikovao napadača, njegov alat, C2 server i ciljanog korisnika“ → **Diamond Model**. Ako pitanje pita šta je C2 domen u Diamond modelu → **Infrastructure**; malver → **Capability**.

## MITRE ATT&CK

**ATT&CK** (Adversarial Tactics, Techniques, and Common Knowledge) je javna baza znanja o ponašanju napadača, zasnovana na **stvarnim, opaženim** napadima. Postoje tri matrice: **Enterprise** (Windows, Linux, macOS, cloud, mreža, kontejneri, ESXi), **Mobile** i **ICS**.

| Pojam | Pitanje | Primjer |
|---|---|---|
| **Tactic** | **Zašto**: cilj napadača u tom koraku | `TA0003` Persistence |
| **Technique** | **Kako** postiže cilj | `T1053` Scheduled Task/Job |
| **Sub-technique** | Konkretnija varijanta | `T1053.005` Scheduled Task (Windows) |
| **Procedure** | Kako je **konkretna grupa** to izvela | Grupa X kreira task `\Microsoft\Update` koji pokreće `rundll32` |
| **Mitigation** | Kontrola koja sprečava tehniku | `M1026` Privileged Account Management |
| **Detection strategy / Analytic** | Kako detektovati (od v18, oktobar 2025, zamjenjuje stare Data Sources) | Analitika za kreiranje taska na Windowsu sa log izvorima |

Enterprise taktike (14), redom kako se obično prikazuju:

| ID | Taktika | ID | Taktika |
|---|---|---|---|
| TA0043 | Reconnaissance | TA0007 | Discovery |
| TA0042 | Resource Development | TA0008 | Lateral Movement |
| TA0001 | Initial Access | TA0009 | Collection |
| TA0002 | Execution | TA0011 | Command and Control |
| TA0003 | Persistence | TA0010 | Exfiltration |
| TA0004 | Privilege Escalation | TA0040 | Impact |
| TA0005 | Defense Evasion | | |
| TA0006 | Credential Access | | |

Za razliku od Kill Chaina, ATT&CK **nije linearan**: tehnike iz iste taktike se ponavljaju na raznim mjestima napada.

### Mapiranje alarma na ATT&CK

Kao u detection labu (Sigma pravila imaju `tags: attack.t1059.001`), alarme i nalaze mapiraš na tehnike. Primjer iz Windows logova (Security 4688 sa komandnom linijom):

```
EventID     : 4688
NewProcess  : C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
CommandLine : powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBi...
Parent      : C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE
```

| Opažanje | Taktika | Tehnika |
|---|---|---|
| Word pokreće PowerShell | Execution | T1204.002 User Execution: Malicious File |
| `-enc` base64 komanda | Execution / Defense Evasion | T1059.001 PowerShell, T1027 Obfuscated Files or Information |
| `schtasks /create` poslije | Persistence | T1053.005 Scheduled Task |
| Pravilni HTTPS pozivi ka rijetkom domenu | Command and Control | T1071.001 Web Protocols |

Upotrebe ATT&CK-a u SOC-u:

- **Detection coverage / gap analysis**: u **ATT&CK Navigatoru** obojiš tehnike koje pokrivaš pravilima i vidiš rupe,
- **Threat-informed defense**: iz izvještaja o grupi koja cilja tvoju industriju uzmeš njene tehnike i provjeriš da li ih detektuješ,
- **Threat hunting**: hipoteza po tehnici (npr. „tražimo T1003.001 LSASS dump“),
- **Adversary emulation** / purple team: test detekcija simulacijom tehnika (npr. Atomic Red Team, CALDERA),
- **Izvještavanje**: zajednički jezik u incident izvještaju i threat intel razmjeni (STIX objekti nose ATT&CK ID).

Srodni MITRE projekti: **D3FEND** (odbrambene tehnike, „ATT&CK za branioce“), **ATLAS** (napadi na AI/ML sisteme, korisno za cilj 1.6), **CAPEC** (obrasci napada na aplikacije), **Engage** (deception).

> **Na ispitu:** „Tactic“ je **zašto**, „technique“ je **kako**, „procedure“ je **konkretna implementacija** grupe (TTP). Pitanje „tim želi da utvrdi koje ponašanje napadača NE detektuje“ → mapiranje detekcija na **ATT&CK** (Navigator, gap analysis). ID sa tačkom (`T1059.001`) je **sub-technique**.

## Okviri za testiranje: OSSTMM i OWASP

U CS0-003 ciljevima su uz okvire napada bili i okviri metodologije testiranja. CS0-004 u 3.1 eksplicitno navodi samo Kill Chain, Diamond i ATT&CK, ali pojmovi se pojavljuju u distraktorima i u domenu 2 (skeniranje i testiranje), pa ih treba prepoznati:

| Okvir | Šta je | Ključne riječi |
|---|---|---|
| **OSSTMM** (Open Source Security Testing Methodology Manual, ISECOM) | Recenzirana metodologija **operativnog** sigurnosnog testiranja i mjerenja | Kanali (human, physical, wireless, telecommunications, data networks), **RAV** (risk assessment values), mjerljivi rezultati |
| **OWASP Web Security Testing Guide** (WSTG) | Vodič za testiranje **web aplikacija** | Testovi sa ID-em (npr. `WSTG-INPV-05` SQL injection), kategorije: autentikacija, sesije, validacija ulaza |
| **OWASP Top 10** | Lista najkritičnijih rizika web aplikacija (svijest, ne metodologija testiranja) | Broken Access Control, Injection… |
| **PTES** | Penetration Testing Execution Standard | Faze od pre-engagement do izvještaja |

Razlika u ulozi: ATT&CK/Kill Chain/Diamond opisuju **kako napadač radi** (analiza i odbrana), dok OSSTMM/WSTG opisuju **kako mi testiramo** sistem.

## Proces odgovora na incident (3.2)

CS0-004 navodi sedam faza. To je razdvojena verzija klasične NIST petlje:

```
Preparation → Detection → Analysis → Containment → Eradication → Recovery → Post-incident
     ^                                                                          |
     +---------------------------- lessons learned -----------------------------+
```

| Faza | Ključne aktivnosti | Tipičan artefakt |
|---|---|---|
| **Preparation** | IR plan i politika, uloge (CSIRT), playbookovi, alati (EDR, SIEM, forenzički kit), logovanje i retencija, trening, tabletop, kontakti (pravni, PR, regulator, policija) | IR plan, communication plan, kontakt lista, jump bag |
| **Detection** | Uočavanje mogućeg incidenta: SIEM alarmi, EDR, IDS, prijave korisnika, threat intel, treće strane | Alarm/tiket, prvi događaj |
| **Analysis** | Validacija (true/false positive), određivanje obima (scope), uticaja i ozbiljnosti, korelacija, timeline, deklaracija incidenta | Timeline, lista IoC-a, kategorija i prioritet |
| **Containment** | Zaustavljanje širenja: izolacija hosta (EDR), blokiranje IP/domena, onemogućavanje naloga, segmentacija; kratkoročno i dugoročno | Lista izolovanih sistema, promjene na firewallu |
| **Eradication** | Uklanjanje uzroka: malver, persistence, zlonamjerni nalozi, ranjivost koju je napadač iskoristio; reimage | Čisti sistemi, zakrpljena ranjivost, resetovani kredencijali |
| **Recovery** | Vraćanje u produkciju: restore iz čistog backupa, provjera integriteta, pojačan monitoring, release from isolation | Potvrda da servis radi, pojačani monitoring |
| **Post-incident** | Lessons learned sastanak, **root cause analysis**, after action report, ažuriranje plana, playbookova i detekcija, čuvanje dokaza | AAR, korektivne akcije |

Detalji tehnika (trijaža, dokazi, izolacija, RCA) su u sljedećem modulu (3.3), a izvještaji u modulu 11 (4.2).

### Containment strategije

| Strategija | Kada | Rizik |
|---|---|---|
| **Isolation** (izolacija hosta preko EDR-a, karantinski VLAN) | Jasno kompromitovan endpoint | Napadač primijeti i promijeni taktiku |
| **Segmentation** (ACL, mikrosegmentacija) | Ograničiti kretanje između zona | Utiče na legitimne poslovne tokove |
| **Removal** (fizičko isključenje sa mreže) | Kritičan slučaj, nema EDR-a | Gubitak volatilnih podataka ako se isključi napajanje |
| **Monitoring bez prekida** („watch and learn“) | Rijetko, uz odobrenje uprave i pravnog tima, da se sazna obim | Šteta se nastavlja; mora biti svjesna odluka |

Kriterijumi za izbor strategije (iz NIST-a): potencijalna šteta i krađa resursa, potreba za čuvanjem dokaza, dostupnost servisa, vrijeme i resursi za implementaciju, efikasnost (djelimično ili potpuno zadržavanje) i trajanje rješenja.

> **Na ispitu:** pitanja „šta uraditi PRVO“ kad je potvrđen ransomware na jednom hostu → **izolacija** (containment), ne reimage (eradication) i ne restore (recovery). Ne gasi mašinu ako trebaju volatilni dokazi: izoluj je mrežno. Ažuriranje playbooka nakon incidenta → **Post-incident**. Pisanje playbooka unaprijed → **Preparation**.

### Tipični zadaci po fazi: prepoznaj fazu

```
[08:14] Korisnik prijavljuje čudan prozor nakon otvaranja fakture   -> Detection
[08:30] Analitičar potvrđuje da je alarm true positive, 3 hosta     -> Analysis
[08:41] EDR: "Isolate device" na FIN-LT-07, FIN-LT-11, HR-DT-03     -> Containment
[08:45] Blokiran domen cdn-upd4te.example na DNS/proxyju            -> Containment
[10:20] Uklonjen scheduled task, hostovi reimageovani               -> Eradication
[12:05] Restore podataka iz backupa od 01.10., provjera hash-eva    -> Recovery
[+5 dana] Lessons learned, RCA: makroi iz interneta nisu blokirani  -> Post-incident
```

## NIST SP 800-61r3 i CSF 2.0

U aprilu 2025. NIST je objavio **SP 800-61 Rev. 3** „Incident Response Recommendations and Considerations for Cybersecurity Risk Management“, koji **zamjenjuje Rev. 2** (2012). Glavna promjena: umjesto zasebne četvorofazne petlje, IR se posmatra kroz šest funkcija **NIST CSF 2.0**.

Stara petlja (Rev. 2) imala je četiri faze: **Preparation**; **Detection & Analysis**; **Containment, Eradication & Recovery**; **Post-Incident Activity**. Rev. 3 obrazlaže da su incidenti danas česti, dugotrajni (sedmice i mjeseci) i da lekcije treba dijeliti **odmah**, a ne tek po završetku.

| Stara faza (Rev. 2) | CSF 2.0 funkcije (Rev. 3) |
|---|---|
| Preparation | **Govern**, **Identify** (sve kategorije), **Protect** |
| Detection & Analysis | **Detect**, Identify (Improvement) |
| Containment, Eradication & Recovery | **Respond**, **Recover**, Identify (Improvement) |
| Post-Incident Activity | Identify (**Improvement**, ID.IM) |

Model u Rev. 3 ima dva nivoa: donji (Govern, Identify, Protect) su šire aktivnosti upravljanja rizikom koje **podržavaju** IR, a gornji (Detect, Respond, Recover) su sam odgovor na incident. U sredini je **kontinuirano unapređenje** (ID.IM): lekcije iz svih funkcija se stalno vraćaju u sve funkcije.

Korisne CSF kategorije iz Rev. 3 koje se direktno slažu sa ispitnim pojmovima:

| CSF kategorija | Sadržaj | Ispitni pojam |
|---|---|---|
| **DE.AE** Adverse Event Analysis | Korelacija, procjena uticaja i obima, CTI, **deklaracija incidenta** (DE.AE-08) | Detection, Analysis |
| **RS.MA** Incident Management | Izvršenje plana, **trijaža** (RS.MA-02), kategorizacija i prioritizacija, **eskalacija** (RS.MA-04), kriterijumi za recovery | Triage, escalation |
| **RS.AN** Incident Analysis | Redoslijed događaja i **root cause** (RS.AN-03), zapis akcija, integritet podataka, magnituda | Timeline, RCA, evidence |
| **RS.CO** Incident Response Reporting and Communication | Obavještavanje internih i eksternih strana | Communication plan |
| **RS.MI** Incident Mitigation | **Containment** (RS.MI-01), **eradication** (RS.MI-02) | Containment, eradication |
| **RC.RP** Incident Recovery Plan Execution | Restore, integritet backupa, **after-action report** (RC.RP-06) | Recovery |
| **RC.CO** Incident Recovery Communication | Komunikacija tokom oporavka | Communication |

CompTIA ciljevi i dalje koriste imena faza (Preparation… Post-incident), pa na ispitu odgovaraj po fazama. Rev. 3 znanje ti treba da prepoznaš modernu terminologiju i da shvatiš da je preparation dio šireg upravljanja rizikom.

> **Na ispitu:** ako pitanje traži redoslijed, koristi CompTIA niz: **Preparation → Detection → Analysis → Containment → Eradication → Recovery → Post-incident**. Ako se pomene NIST 800-61r3, poveži ga sa **CSF 2.0** funkcijama (Govern, Identify, Protect, Detect, Respond, Recover) i kontinuiranim unapređenjem.

## Povezivanje okvira i IR procesa

U praksi okviri i proces rade zajedno:

| IR faza | Kako pomažu okviri |
|---|---|
| Preparation | ATT&CK gap analiza određuje koje detekcije i logove treba dodati; tabletop scenariji po tehnikama poznatih grupa |
| Detection | Alarmi nose ATT&CK tagove (Sigma, Defender, Wazuh `rule.mitre.id`) |
| Analysis | Kill Chain faza govori koliko je napadač napredovao; Diamond pivoting otkriva druge žrtve |
| Containment | Prekid lanca: blokada C2 infrastrukture (Diamond vrh Infrastructure) |
| Eradication | ATT&CK Persistence tehnike su ček-lista šta sve treba ukloniti |
| Post-incident | Izvještaj mapira napad na ATT&CK; novi detekcijski use case-ovi za propuštene tehnike |

Primjer Wazuh alarma sa ATT&CK poljima (kao u detection labu):

```
$ jq '.rule | {id, description, mitre}' alert.json
{
  "id": "100210",
  "description": "Scheduled task created via schtasks (custom rule)",
  "mitre": {
    "id": ["T1053.005"],
    "tactic": ["Execution", "Persistence", "Privilege Escalation"],
    "technique": ["Scheduled Task"]
  }
}
```

Primijeti da jedna tehnika pripada **više taktika**: scheduled task može služiti za pokretanje, opstanak i podizanje privilegija.

## Rezime

- **Cyber Kill Chain** (Lockheed Martin): 7 linearnih faza (Reconnaissance, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives); prekini lanac što ranije; slab za insajdere i napade bez malvera.
- **Diamond Model**: Adversary, Capability, Infrastructure, Victim + meta-svojstva; služi za analizu događaja i **pivoting** sa poznatog vrha na nepoznate.
- **MITRE ATT&CK**: taktika (zašto), tehnika (kako), sub-tehnika (`T1059.001`), procedura (konkretna grupa); koristi se za mapiranje detekcija, gap analizu, hunting i emulaciju. Od v18 detekcije su opisane kroz **Detection Strategies** i **Analytics**.
- OSSTMM i OWASP WSTG su metodologije **testiranja**, ne modeli ponašanja napadača.
- CompTIA IR proces: **Preparation → Detection → Analysis → Containment → Eradication → Recovery → Post-incident**, sa lekcijama koje se vraćaju u pripremu.
- **NIST SP 800-61r3** (april 2025) zamjenjuje Rev. 2 i mapira IR na **CSF 2.0** funkcije; naglasak na kontinuiranom unapređenju (ID.IM).
- Pri „FIRST/NEXT“ pitanjima prvo odredi fazu u kojoj se scenarij nalazi, pa izaberi aktivnost iz te faze.
