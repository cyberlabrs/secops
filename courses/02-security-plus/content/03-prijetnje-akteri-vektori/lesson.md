## Ciljevi ispita: 2.1, 2.2 i 2.3

- **2.1** Explain characteristics of threats and vulnerabilities: threat feeds i izvori obavještajnih podataka, likelihood i impact, životni ciklus, CVE, CVSS i prioritizacija.
- **2.2** Describe common threat actors and motivations: ko napada, zašto i sa kolikim resursima.
- **2.3** Describe threat vectors and sources: kojim putem napad ulazi u organizaciju.

Ispit daje opis napadača ili napada i traži da ga klasifikuješ: koji akter, koja motivacija, koji vektor.

## Prijetnje i ranjivosti: osnovni pojmovi

| Pojam | Značenje | Primjer |
|---|---|---|
| **Threat** (prijetnja) | Bilo šta što može iskoristiti slabost i nanijeti štetu | Ransomware grupa, poplava, nezadovoljan zaposleni |
| **Vulnerability** (ranjivost) | Slabost u sistemu, procesu ili ljudima | Nepatchovan Jenkins, javni S3 bucket |
| **Threat vector** | Put kojim napad stiže do mete | Phishing e-mail, izložen RDP, zaražen USB |
| **Attack surface** | Ukupan skup tačaka gdje napadač može pokušati | Svi javni endpointi, nalozi, zaposleni, dobavljači |
| **Likelihood** (vjerovatnoća) | Koliko je vjerovatno da se prijetnja ostvari | Ranjivost sa javnim exploitom i aktivnim napadima = visoka |
| **Impact** (uticaj) | Kolika je šteta ako se ostvari | Curenje podataka svih klijenata = visok |

Rizik se pojednostavljeno procjenjuje kao **likelihood × impact**. Ista ranjivost ima drugačiji rizik na javnom produkcionom serveru i na izolovanom test VM-u.

## Threat intelligence

### Izvori obavještajnih podataka

**Intelligence sources** su odakle dolaze informacije o prijetnjama.

| Izvor | Opis | Primjeri |
|---|---|---|
| **OSINT** (open-source intelligence) | Javno dostupni podaci | Blogovi istraživača, CISA savjeti, društvene mreže, Shodan, javni GitHub |
| **Proprietary / commercial** | Plaćeni servisi proizvođača | Feedovi velikih sigurnosnih kompanija, threat intel platforme |
| **ISAC** (Information Sharing and Analysis Center) | Razmjena između organizacija iste industrije | FS-ISAC (finansije), H-ISAC (zdravstvo) |
| **Government** | Državne agencije i CERT-ovi | CISA, nacionalni CERT-ovi, CISA **KEV** katalog (Known Exploited Vulnerabilities) |
| **Dark web** | Forumi i tržišta gdje se prodaju podaci i alati | Praćenje da li se prodaju kredencijali tvoje firme |
| **Internal** | Vlastiti logovi, incidenti, honeypotovi | SIEM podaci, rezultati prethodnih incidenata |

### Threat feeds

**Threat feed** je automatizovan, kontinuiran tok indikatora (IP adrese, domeni, hashevi, URL-ovi) i informacija o kampanjama.

- Standardni formati: **STIX** (struktura podataka o prijetnjama) i **TAXII** (protokol za razmjenu STIX podataka). Ovo omogućava da SIEM, firewall ili EDR automatski uvoze indikatore.
- Platforme: **MISP** (open-source dijeljenje indikatora).
- Kvalitet feeda: ažurnost (**timeliness**), tačnost, relevantnost za tvoju industriju i **confidence level**. Loš feed pravi lažne alarme.
- MITRE **ATT&CK** nije feed nego baza taktika i tehnika napadača. Korisna za mapiranje šta napadač radi.

### Životni ciklus

Ciljevi navode **Life cycle**. Za threat intelligence, tipičan ciklus:

1. **Requirements / direction**: šta trebamo znati (npr. „koje grupe napadaju fintech u regiji?").
2. **Collection**: prikupljanje iz izvora i feedova.
3. **Processing**: normalizacija, deduplikacija, prevod formata.
4. **Analysis**: tumačenje, povezivanje, procjena relevantnosti.
5. **Dissemination**: dostava onima kojima treba (SOC, uprava, DevOps).
6. **Feedback**: da li je bilo korisno, šta promijeniti.

Pojam „life cycle" se može odnositi i na životni ciklus same prijetnje ili ranjivosti: otkrivanje, objava, dostupnost exploita, aktivno iskorištavanje, patch, remedijacija. Što ranjivost duže ostane otvorena nakon objave, raste vjerovatnoća napada.

> **Na ispitu:** „Banke dijele informacije o prijetnjama koje ciljaju upravo njihov sektor" → **ISAC**. „Automatska razmjena indikatora između sistema" → **STIX/TAXII** threat feed. „Javni izvori" → **OSINT**.

## CVE, CVSS i prioritizacija

### CVE

**Common Vulnerabilities and Exposures (CVE)** je javni katalog jedinstvenih identifikatora za poznate ranjivosti, npr. `CVE-2021-44228` (Log4Shell).

- CVE daje **ime i kratak opis**, ne ocjenu ozbiljnosti.
- Program vodi MITRE, a ID-jeve dodjeljuju **CNA** organizacije (proizvođači, istraživačke grupe).
- **NVD** (National Vulnerability Database) dodaje CVSS ocjene, CPE (koji proizvodi su pogođeni) i reference.
- Skeneri (Trivy, Grype, Amazon Inspector, Defender for Cloud) prijavljuju nalaze kao CVE ID-jeve.

### CVSS

**Common Vulnerability Scoring System (CVSS)** daje ocjenu ozbiljnosti od 0.0 do 10.0.

| Ocjena | Ozbiljnost |
|---|---|
| 0.0 | None |
| 0.1 – 3.9 | Low |
| 4.0 – 6.9 | Medium |
| 7.0 – 8.9 | High |
| 9.0 – 10.0 | Critical |

- **Base** metrike: svojstva same ranjivosti (attack vector: network/adjacent/local/physical, attack complexity, potrebne privilegije, user interaction, uticaj na C/I/A).
- **Temporal** (v3.1) / **Threat** (v4.0) metrike: da li postoji exploit, zrelost exploita.
- **Environmental** metrike: prilagođavanje tvom okruženju (koliko je pogođeni sistem važan).
- Aktuelna verzija je **CVSS v4.0** (2023.), ali se v3.1 i dalje masovno koristi.

### Prioritizacija

**Prioritization**: CVSS sam nije dovoljan. Ispravan redoslijed uzima u obzir:

- **Exploitability**: postoji li javni exploit, je li na CISA KEV listi, kolika je EPSS vjerovatnoća iskorištavanja.
- **Exposure**: je li sistem dostupan sa interneta.
- **Asset criticality**: produkcija sa ličnim podacima vs test okruženje.
- **Compensating controls**: WAF pravilo, segmentacija.

**Vulnerability types**: ranjivosti se grupišu po vrsti (aplikacione, OS, konfiguracione, kriptografske, hardverske, zero-day…). Detalji su u sljedećem modulu (cilj 2.4).

> **Na ispitu:** Kad pitanje nudi „najviši CVSS" i „aktivno iskorištavanu ranjivost na javnom sistemu", tačan odgovor je obično ova druga. Prioritizacija = ozbiljnost + vjerovatnoća + izloženost + vrijednost imovine.

## Akteri prijetnji

### Tipovi aktera

| Akter | Engleski | Tipična motivacija | Resursi / sofisticiranost |
|---|---|---|---|
| Državno sponzorisani | **State-sponsored** (nation-state) | Espionage, politička i vojna prednost, sabotaža infrastrukture | Vrlo visoki. Zero-day exploiti, dugotrajne kampanje (APT). |
| Organizovani kriminal | **Crime syndicate / organized crime** | Finansijska korist, iznuda (ransomware) | Visoki. Profesionalno organizovani, ransomware-as-a-service. |
| Haktivista | **Hacktivist** | Ideološka, politička, društvena poruka | Niski do srednji. DDoS, deface, curenje podataka. |
| Terorista | **Terrorist** | Strah i haos, ideologija | Promjenljivo. Meta: kritična infrastruktura, propaganda. |
| Insajder | **Insider** | Osveta, finansije, špijunaža za konkurenciju | Ima legitiman pristup i znanje o sistemima |
| Nenamjerni | **Accidental / unintentional** | Nema zle namjere | Greška: pogrešna konfiguracija, poslat fajl pogrešnoj osobi |
| Konkurent | **Competitor** | Intelektualna svojina, tržišna prednost, sabotaža | Srednji do visoki, ponekad preko insajdera |
| Neiskusni napadač | **Unskilled attacker** (ranije „script kiddie") | Radoznalost, slava, zabava | Niski. Koristi gotove alate i skripte bez razumijevanja. |

### Motivacije

| Motivacija | Engleski | Primjer |
|---|---|---|
| Finansijska | **Financial** | Krađa kartica, ransomware, kripto-mining |
| Uticaj | **Influence** | Dezinformacione kampanje, uticaj na izbore |
| Intelektualna svojina | **Intellectual property** | Krađa izvornog koda, dizajna, formula |
| Slava | **Notoriety** | Hvalisanje na forumima, deface poznatog sajta |
| Špijunaža | **Espionage** | Dugotrajno tiho prikupljanje podataka |
| Strah/haos | **Fear / chaos** | Napad na bolnice ili vodovod |
| Iznuda | **Extortion** | „Platite ili objavljujemo podatke" (double extortion) |
| Radoznalost | **General curiosity** | „Šta je iza ovog porta?" |
| Osveta | **Revenge** | Otpušteni admin briše resurse |
| Ideološka | **Ideological** | Napad u ime uvjerenja ili pokreta |
| Politička | **Political** | Ciljanje vlade ili partije |
| Etička | **Ethical** | Penetration tester, bug bounty istraživač, odgovorno prijavljivanje ranjivosti |

> **Na ispitu:** Ključ je motivacija: **hacktivist** = ideološka/politička poruka, **organized crime** = novac, **nation-state** = špijunaža i dugotrajan tih pristup, **competitor** = IP. „Koristi gotove alate sa interneta bez dubljeg znanja" = **unskilled attacker**.

### Atributi aktera

- **Internal / external**: insajder ima pristup i znanje, pa ga perimetarske kontrole ne zaustavljaju. Kontrole: least privilege, separation of duties, praćenje aktivnosti, offboarding.
- **Resources / funding**: država i organizovani kriminal imaju novac za zero-day exploite, infrastrukturu i timove. Haktivista i neiskusni napadač nemaju.
- **Level of sophistication / capability**: od pokretanja gotovih skripti do razvoja vlastitog malvera i implantata u firmware.

### APT

**Advanced Persistent Threat (APT)** je napadač (najčešće državno sponzorisan, nekad i vrlo sposobna kriminalna grupa) koji:

- **Advanced**: koristi sofisticirane tehnike, prilagođen malver, ponekad zero-day.
- **Persistent**: ostaje u mreži mjesecima ili godinama, neprimijećen.
- **Threat**: ima jasan cilj (špijunaža, priprema sabotaže).

APT-ovi često koriste **living-off-the-land** tehnike i legitimne naloge da bi izbjegli detekciju.

## Vektori napada

### Message-based (poruke)

| Vektor | Napomena |
|---|---|
| **Email** | Phishing, zlonamjerni linkovi i prilozi, BEC (business email compromise). Zaštita: SPF, DKIM, DMARC, filtriranje, obuka. |
| **SMS** | Smishing: lažna dostava paketa, lažna banka, OTP kodovi |
| **RCS** (Rich Communication Services) | Nasljednik SMS-a sa slikama i dugmadima. Iste prevare, bogatiji sadržaj, poruke izgledaju uvjerljivije. |
| **Instant messaging** | WhatsApp, Telegram, Signal: lažno predstavljanje, linkovi, prilozi |
| **Collaboration tools** | Teams, Slack: napadač iz eksternog tenanta se predstavlja kao IT helpdesk; dijeljeni zlonamjerni fajlovi; korisnici vjeruju internim kanalima više nego e-mailu |

### Image-based (slike)

- **QR codes**: QR kod vodi na lažnu login stranicu. Zaobilazi e-mail filtere koji provjeravaju samo tekstualne linkove, a korisnik otvara link na telefonu van korporativne zaštite (**quishing**).
- **Embedded content**: zlonamjerni sadržaj u slikama (npr. SVG fajlovi koji sadrže JavaScript, slike koje skrivaju payload steganografijom, tracking pikseli).
- **CAPTCHA**: lažne CAPTCHA stranice koje traže od korisnika da „potvrdi da je čovjek" tako što kopira i pokrene komandu u Run dijalogu ili terminalu (tehnika poznata kao „ClickFix"). Napadači takođe koriste prave CAPTCHA-e da sakriju phishing stranicu od automatskih skenera.

### Attachment-based (prilozi)

- **Embedded macros**: VBA makroi u Office dokumentima. Microsoft podrazumijevano blokira makroe u fajlovima sa interneta (Mark of the Web), pa napadači prelaze na druge formate.
- **RTF documents**: RTF može sadržati ugrađene objekte (OLE) i iskorištavati ranjivosti u parseru.
- **PDFs**: linkovi ka phishing stranicama, ugrađeni JavaScript, QR kodovi u PDF-u.

### Browser-based (pregledač)

| Vektor | Rizik |
|---|---|
| **Extensions** | Ekstenzija sa širokim dozvolama čita sve stranice. Legitimna ekstenzija može biti prodata ili kompromitovana pa dobije zlonamjerni update. |
| **JavaScript** | Zlonamjerni skriptovi na kompromitovanim sajtovima: skimming kartica (Magecart), XSS, drive-by download |
| **Password managers** | Autofill na lažnoj stranici, kompromitovan vault ili lažna ekstenzija password managera |
| **Cookies** | Kradu se infostealer malverom ili XSS-om, omogućavaju preuzimanje sesije |
| **Session tokens** | Ukraden token = prijavljen korisnik **bez lozinke i bez MFA**. Zato su infostealeri danas veliki problem. |

### Network-based (mreža)

- **Infrastructure devices**: ruteri, firewalli, VPN koncentratori i load balanceri na rubu mreže su omiljena meta (često nemaju EDR, a ranjivosti se brzo iskorištavaju).
- **Virtualized devices**: virtuelni firewalli, hipervizori, virtuelni switchevi. Kompromitacija hipervizora (npr. ESXi) pogađa sve VM-ove.
- **Session keys**: ako napadač dođe do ključeva sesije (slaba kriptografija, memorija servera, nedostatak PFS), može dešifrovati ili preuzeti saobraćaj.

### Remote access (udaljeni pristup)

- **Remote desktop (RDP)**: izložen RDP na internetu je jedan od najčešćih ulaza za ransomware. Brute force, ukradeni kredencijali, ranjivosti.
- **VNC**: često slabo zaštićen, ponekad bez lozinke ili bez enkripcije.
- **VPN**: ranjivosti u VPN uređajima i kredencijali bez MFA.

Zaštita: ne izlagati RDP/VNC direktno na internet, koristiti VPN ili ZTNA sa MFA, bastion host ili AWS Systems Manager Session Manager / Azure Bastion.

### Endpoint-based

- **Mobile devices**, **tablets**: zlonamjerne aplikacije, sideloading, izgubljeni uređaji, BYOD bez MDM-a.
- **Workstations**, **servers**: klasične mete malvera i lateralnog kretanja.
- **Trusted devices**: uređaj kojem sistem vjeruje (zapamćen za MFA, registrovan u Intune/Entra) postaje vrijedan cilj: ako je kompromitovan, napadač nasljeđuje to povjerenje.
- **Built-in tools** i **living-off-the-land tools (LOTL)**: napadač koristi alate koji su već na sistemu (PowerShell, WMI, `certutil`, `bitsadmin`, `rundll32`, `ssh`, `curl`, cloud CLI) umjesto da donese svoj malver. Teže se otkriva jer su alati legitimni i potpisani.

> **Na ispitu:** „Napadač koristi PowerShell i WMI koji su već instalirani, bez novih fajlova na disku" → **living-off-the-land**. Odbrana: logovanje (PowerShell script block logging), EDR sa analizom ponašanja, ograničavanje alata (application control).

### Supply chain-based

Napad kroz nekoga kome već vjeruješ:

| Izvor | Primjer rizika |
|---|---|
| **Third-party providers** | Kompromitovana biblioteka (npm, PyPI), zlonamjerni update softvera dobavljača |
| **Managed service providers (MSP)** | MSP ima admin pristup mnogim klijentima. Kompromitacija MSP-a ili njegovog RMM alata = pristup svima. |
| **Logistic providers** | Hardver presretnut i izmijenjen tokom isporuke, krivotvorene komponente |
| **SaaS providers** | Curenje podataka kod SaaS dobavljača, kompromitovane OAuth integracije sa pristupom tvojim podacima |

DevOps kontrole: SBOM, potpisani artefakti, pinovanje verzija i hasheva, privatni registry, provjera dobavljača (vendor assessment), least privilege za integracije.

### External media-based

- **Malicious USB**: ostavljen USB na parkingu (baiting), USB koji se predstavlja kao tastatura i kuca komande (HID napad), USB koji fizički oštećuje uređaj. Zaštita: blokada USB storage-a preko politike, onemogućen autorun, obuka.

### Human-based

- **Impersonation**: napadač se predstavlja kao IT podrška, direktor, dobavljač.
- **Contractor**: spoljni saradnik sa privremenim pristupom, često sa više prava nego što treba i sa lošim offboardingom.
- **Visitor**: posjetilac u zgradi bez pratnje može ukopčati uređaj ili fotografisati ekrane.
- **Biometric**: lažiranje biometrije (odštampan otisak, fotografija lica, deepfake glasa) ili krađa biometrijskih podataka koji se ne mogu promijeniti kao lozinka.
- **Watering hole**: napadač kompromituje sajt koji meta često posjećuje (forum industrije, lokalni restoran, sajt dobavljača) i čeka da žrtve dođu.

### IoT-based

- **Cameras**, **sensors**, **printers**: često imaju default lozinke, rijetke update-e i stoje u istoj mreži kao radne stanice. Mirai botnet je zarazio stotine hiljada kamera i rutera preko default kredencijala. Printeri čuvaju kopije dokumenata i mogu biti ulaz u mrežu.

### OT-based

**Operational technology (OT)**: industrijski sistemi (ICS, SCADA, PLC) u fabrikama, energetici, vodovodu. Dugi vijek opreme, protokoli bez autentifikacije, patchovanje teško jer zahtijeva zaustavljanje proizvodnje. Posljedica napada je fizička (sigurnost ljudi, prekid snabdijevanja).

### Physical-based

- **Lock and key**: obijanje brava (lock picking), kopiranje ključeva, nezaključana vrata.
- **Access vestibule** (ranije „mantrap"): prostor sa dvoje vrata gdje se jedna otvaraju tek kad se druga zatvore. Kontrola protiv tailgatinga, a slabost ako je loše podešena.
- **Access passes**: kloniranje RFID kartica, posuđene ili ukradene kartice, lažne propusnice.

### Signal-based

- **Bluetooth**: bluejacking (slanje neželjenih poruka), bluesnarfing (krađa podataka), ranjivosti u Bluetooth stacku.
- **RF** (radio frequency): ometanje (jamming), presretanje bežičnog saobraćaja, replay daljinskih upravljača i ključeva automobila.
- **NFC**: presretanje ili relay napadi na beskontaktno plaćanje i kartice za pristup na vrlo maloj udaljenosti.

> **Na ispitu:** **Watering hole** se razlikuje od phishinga po tome što napadač **ne šalje** ništa žrtvi, nego čeka na sajtu koji ona sama posjećuje. **Supply chain** se razlikuje po tome što napad dolazi kroz **pouzdanog dobavljača ili softver**.

## Rezime

- Rizik = **likelihood × impact**. Izvori obavještajnih podataka: OSINT, komercijalni, ISAC, vladini (CISA KEV), dark web, interni.
- **Threat feeds** automatski dostavljaju indikatore, standardno preko **STIX/TAXII**. Threat intel ima životni ciklus od zahtjeva do povratne informacije.
- **CVE** = ID ranjivosti. **CVSS** = ocjena ozbiljnosti 0–10. Prioritizuj po ozbiljnosti, exploitabilnosti (KEV, EPSS), izloženosti i važnosti sistema.
- Akteri: nation-state (špijunaža, APT), organized crime (novac), hacktivist (ideologija), insider (pristup), competitor (IP), unskilled attacker (gotovi alati), accidental (greška), terrorist (strah/haos).
- Atributi: internal/external, resursi, sofisticiranost.
- Vektori: poruke (email, SMS, RCS, IM, Teams/Slack), slike (QR, CAPTCHA), prilozi (makroi, RTF, PDF), pregledač (ekstenzije, tokeni), mreža, remote access (RDP, VNC, VPN), endpoint (LOTL), supply chain (MSP, SaaS), USB, ljudi (watering hole), IoT, OT, fizički i signali (Bluetooth, RF, NFC).
- **Living-off-the-land** = zloupotreba legitimnih alata koji su već na sistemu.
