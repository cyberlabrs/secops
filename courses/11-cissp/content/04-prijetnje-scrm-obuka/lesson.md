## Ciljevi ispita: 1.10, 1.11 i 1.12

- **1.10 Understand and apply threat modeling concepts and methodologies**
- **1.11 Apply Supply Chain Risk Management (SCRM) concepts**
  - Risks associated with the acquisition of products and services from suppliers and providers (e.g., product tampering, counterfeits, implants, reputational)
  - Risk mitigations (e.g., third-party assessment and monitoring, minimum security requirements, service level requirements, silicon root of trust, physically unclonable function, Software Bill of Materials (SBOM))
- **1.12 Establish, maintain, and measure a security awareness, education, and training program**
  - Methods and techniques to increase awareness and training (e.g., security champions, gamification)
  - Program effectiveness evaluation and stakeholder engagement
  - Periodic content reviews to include emerging technologies and trends (e.g., cryptocurrency, Artificial Intelligence (AI), blockchain)

U outlineu iz 2024. rizici lanca snabdijevanja nisu navodili **reputacioni** rizik; cilj 1.12 je glasio „Establish and maintain“ (bez „measure“), među metodama su eksplicitno bili **social engineering** i **phishing** (simulacije), a evaluacija programa nije pominjala **stakeholder engagement**. Phishing simulacije i obuka o socijalnom inženjeringu i dalje su sastavni dio programa, samo nisu više primjer u tekstu outlinea.

> **Na ispitu:** threat modeling je najjeftiniji kada se radi **rano** (u fazi dizajna), a SCRM i obuka su upravljački programi sa vlasnikom, metrikama i ciklusom preispitivanja. Odgovor „kupiti alat“ rijetko pobjeđuje odgovor „uspostaviti proces sa zahtjevima i mjerenjem“.

## Modelovanje prijetnji (1.10)

**Threat modeling** je strukturiran proces identifikacije, procjene i ublažavanja prijetnji za sistem, idealno tokom dizajna, i ponovo pri značajnim promjenama. Četiri pitanja (Adam Shostack, Threat Modeling Manifesto):

1. **Na čemu radimo?** (model sistema: DFD, granice povjerenja)
2. **Šta može poći naopako?** (prijetnje, npr. STRIDE)
3. **Šta ćemo uraditi povodom toga?** (kontrole, prihvatanje, prenos)
4. **Jesmo li dobro uradili posao?** (validacija, preispitivanje)

### Pristupi

| Pristup | Fokus | Kada |
|---|---|---|
| **Asset-centric** (usmjeren na imovinu) | Šta je vrijedno i kako može biti ugroženo | Upravljanje rizikom, BIA |
| **Attacker-centric** (usmjeren na napadača) | Ko su protivnici, njihovi motivi i sposobnosti (TTP) | Threat intelligence, red team |
| **Software / system-centric** (usmjeren na dizajn) | Komponente, tokovi podataka, granice povjerenja | Razvoj, arhitektura |
| **Proactive vs reactive** | Tokom dizajna (defensive) vs. nakon objave (adversarial: pentest, fuzzing, bug bounty) | Oba su potrebna |

### Elementi modela

| Element | Opis |
|---|---|
| **DFD** (Data Flow Diagram) | Eksterni entiteti, procesi, skladišta podataka, tokovi podataka |
| **Trust boundary** | Mjesto gdje se mijenja nivo povjerenja (internet ↔ DMZ, korisnik ↔ kernel, tenant ↔ provajder); tu se pojavljuje najviše prijetnji |
| **Attack surface** | Sve tačke kroz koje napadač može komunicirati sa sistemom |
| **Entry points / assets** | Ulazi u sistem / šta se štiti |

### Metodologije

| Metodologija | Porijeklo | Suština |
|---|---|---|
| **STRIDE** | Microsoft | Kategorizacija prijetnji po elementu DFD-a (vidi tabelu ispod) |
| **PASTA** (Process for Attack Simulation and Threat Analysis) | VerSprite | **Sedam faza**, risk-centric, povezuje poslovne ciljeve sa simulacijom napada |
| **VAST** (Visual, Agile, Simple Threat) | ThreatModeler | Skalabilno za agilne timove i enterprise; aplikacijski i operativni modeli |
| **DREAD** | Microsoft (napušten interno) | Ocjena rizika prijetnje: Damage, Reproducibility, Exploitability, Affected users, Discoverability; subjektivan |
| **Trike** | Open source | Risk-based, polazi od modela zahtjeva i prihvatljivog rizika po imovini (CRUD prava aktera) |
| **OCTAVE** | Carnegie Mellon SEI | Organizacijska procjena rizika, samousmjerena, imovinski fokus |
| **LINDDUN** | KU Leuven | **Privatnosne** prijetnje: Linking, Identifying, Non-repudiation, Detecting, Data disclosure, Unawareness, Non-compliance |
| **Attack trees** | Bruce Schneier | Stablo: korijen je cilj napadača, grane su načini ostvarenja (AND/OR čvorovi) |
| **MITRE ATT&CK** | MITRE | Baza znanja taktika, tehnika i procedura protivnika iz stvarnih napada; koristi se za attacker-centric modelovanje i pokrivenost detekcije |
| **Cyber Kill Chain** | Lockheed Martin | Faze napada: reconnaissance, weaponization, delivery, exploitation, installation, C2, actions on objectives |
| **Diamond Model** | | Adversary, capability, infrastructure, victim |
| **hTMM, CVSS** | SEI / FIRST | Hibridni model; CVSS je ocjena ozbiljnosti ranjivosti, ne model prijetnji |

### STRIDE

| Prijetnja | Narušeno svojstvo | Primjer | Tipična kontrola |
|---|---|---|---|
| **S**poofing | Authenticity (autentifikacija) | Lažni login, ukraden token | MFA, sertifikati, mTLS |
| **T**ampering | Integrity | Izmjena parametara u zahtjevu, izmjena fajla | Potpisi, heševi, kontrola pristupa, validacija |
| **R**epudiation | Non-repudiation | Korisnik poriče transakciju, nema logova | Audit log otporan na izmjene, digitalni potpisi |
| **I**nformation disclosure | Confidentiality | Curenje kroz poruke o greškama, nešifrovan saobraćaj | Šifrovanje, least privilege, sanitizacija grešaka |
| **D**enial of service | Availability | Iscrpljivanje resursa | Rate limiting, autoscaling, kvote, CDN |
| **E**levation of privilege | Authorization | Običan korisnik postaje admin | Least privilege, provjera autorizacije na serveru, sandboxing |

**STRIDE-per-element**: procesi su podložni svim šest kategorijama; tokovi podataka T, I, D; skladišta podataka T, I, D (i R za logove); eksterni entiteti S i R.

### PASTA: sedam faza

| Faza | Sadržaj |
|---|---|
| 1 | Definisanje poslovnih ciljeva i sigurnosnih zahtjeva |
| 2 | Definisanje tehničkog obima |
| 3 | Dekompozicija aplikacije (DFD, uloge, granice povjerenja) |
| 4 | Analiza prijetnji (threat intelligence) |
| 5 | Analiza ranjivosti i slabosti |
| 6 | Modelovanje i simulacija napada (attack trees) |
| 7 | Analiza rizika i uticaja, kontrole |

### DREAD primjer

Ranjivost: IDOR u API-ju omogućava čitanje tuđih faktura. Ocjene 1–10: Damage 7, Reproducibility 10, Exploitability 8, Affected users 9, Discoverability 6 → prosjek **8,0** = visok prioritet. Problem DREAD-a je subjektivnost (posebno Discoverability, jer se pretpostavlja da će napadač sve otkriti), zbog čega ga je Microsoft napustio; danas se češće koristi CVSS plus poslovni kontekst.

### Scenarij: threat model za cloud API

Tim gradi API za plaćanja u Kubernetesu iza API gatewaya. DFD: mobilna aplikacija (eksterni entitet) → gateway → servis plaćanja → baza i eksterni procesor kartica. Granice povjerenja: internet/gateway, klaster/baza, organizacija/procesor. STRIDE pronalazi: spoofing mobilnog klijenta (kontrola: OAuth 2.0 sa PKCE, attestation aplikacije), tampering iznosa (potpis poruke, provjera na serveru), repudiation (nepromjenjiv audit log), disclosure PAN-a (tokenizacija), DoS na gatewayu (rate limiting), EoP preko servisnog naloga (least privilege RBAC, workload identity). Svaki nalaz ide u backlog sa vlasnikom, a preostali rizik prihvata vlasnik proizvoda.

> **Na ispitu:** STRIDE je za **kategorizaciju prijetnji**, DREAD za **rangiranje**, PASTA je **risk-centric sedmofazna** metodologija, LINDDUN je za **privatnost**, ATT&CK opisuje **ponašanje protivnika**. Kada pitanje pita KADA raditi threat modeling, odgovor je što ranije u SDLC-u (dizajn) i ponovo pri značajnoj promjeni.

### Attack tree primjer

Cilj napadača: **preuzeti administratorski nalog cloud konzole**.

```
[OR] Preuzeti admin nalog
 ├─ [AND] Phishing lozinke
 │    ├─ Ukrasti lozinku lažnom stranicom
 │    └─ Zaobići MFA (MFA fatigue ili AitM proxy)
 ├─ Ukrasti dugoročni pristupni ključ iz repozitorijuma koda
 ├─ [AND] Kompromitovati laptop administratora
 │    ├─ Izvršiti malver na laptopu
 │    └─ Preuzeti sesijski token iz preglednika
 └─ Zloupotrijebiti preširoka prava CI/CD servisnog naloga
```

Svaki list se ocjenjuje (trošak, vjerovatnoća, potrebna vještina), a kontrole se biraju tako da prekinu najjeftinije puteve: phishing-otporna MFA (FIDO2) prekida AND granu phishinga, skeniranje tajni i zabrana dugoročnih ključeva prekida drugu granu, a least privilege za CI/CD posljednju. Attack trees su ulaz u fazu 6 PASTA metodologije.

### Modelovanje prijetnji za AI sisteme

Za sisteme sa mašinskim učenjem i LLM-ovima koriste se dodatni katalozi: **MITRE ATLAS** (taktike i tehnike protiv AI sistema), **OWASP Top 10 for LLM Applications** (prompt injection, osjetljivo otkrivanje informacija, data i model poisoning, prekomjerna autonomija agenta i dr.) i **NIST AI 100-2** (taksonomija adversarial ML). STRIDE i dalje radi: tampering trening podataka je poisoning, information disclosure je curenje podataka iz modela, elevation of privilege je agent koji izvršava alate sa pravima širim od korisnika.

| Granica povjerenja u LLM aplikaciji | Tipična prijetnja | Kontrola |
|---|---|---|
| Korisnik ↔ model | Direktni prompt injection | Ograničenje uloge modela, filtriranje ulaza i izlaza |
| Eksterni sadržaj (web, dokumenti) ↔ model | Indirektni prompt injection | Tretirati sadržaj kao nepouzdan, razdvojiti instrukcije od podataka |
| Model ↔ alati i API-ji | Prekomjerna autonomija, EoP | Least privilege za alate, potvrda čovjeka za osjetljive radnje |
| Trening pipeline ↔ izvori podataka | Poisoning | Provenance podataka, validacija, kontrola pristupa |

### Gdje threat modeling ulazi u organizaciju

| Proces | Uloga threat modela |
|---|---|
| SDLC / DevSecOps | Dizajn review, sigurnosni zahtjevi, testni slučajevi |
| Upravljanje rizikom | Ulaz za identifikaciju prijetnji (1.9) |
| SOC | Prioritizacija detekcija prema ATT&CK tehnikama relevantnim za organizaciju |
| SCRM | Prijetnje iz lanca snabdijevanja (1.11) |
| Arhitektura | Validacija granica povjerenja i zero trust dizajna |

## Upravljanje rizikom lanca snabdijevanja (1.11)

**Supply Chain Risk Management (SCRM / C-SCRM)** upravlja rizicima koji nastaju jer organizacija zavisi od dobavljača proizvoda, softvera i usluga, kao i od njihovih dobavljača (četvrte strane, **fourth parties**). Referentni dokumenti: **NIST SP 800-161 Rev. 1** (C-SCRM), **NIST CSF 2.0** (kategorija GV.SC), **ISO/IEC 27036** (sigurnost u odnosima sa dobavljačima), **ISO 28000** (sigurnost lanca snabdijevanja), **NIST SSDF (SP 800-218)** za sigurni razvoj softvera, **SLSA** okvir za integritet build procesa.

### Rizici nabavke proizvoda i usluga

| Rizik | Opis | Primjer |
|---|---|---|
| **Product tampering** | Neovlašćena izmjena proizvoda tokom proizvodnje, isporuke ili ažuriranja | Kompromitovan build server ubacuje backdoor u potpisano ažuriranje (SolarWinds 2020); presretanje hardvera u isporuci |
| **Counterfeits** | Krivotvoreni ili reciklirani dijelovi predstavljeni kao originalni | Lažni mrežni uređaji ili čipovi sa lošijim kvalitetom i mogućim skrivenim funkcijama |
| **Implants** | Skrivene hardverske ili firmware komponente koje omogućavaju nadzor ili kontrolu | Dodatni čip na matičnoj ploči, zlonamjeran firmware u BMC-u ili mrežnoj kartici |
| **Reputational** (novo 2027.) | Šteta ugledu zbog postupaka dobavljača | Dobavljač koristi prinudni rad, ima curenje podataka naših klijenata, pod sankcijama je ili je povezan sa neprijateljskom državom |
| Kompromitovan softver / zavisnosti | Zlonamjerni paketi, preuzeti nalozi održavalaca, typosquatting | Backdoor u kompresionoj biblioteci (xz utils 2024), zlonamjerni npm paketi |
| Koncentracija i dostupnost | Zavisnost od jednog dobavljača ili regiona | Nestašica čipova, otkaz jednog cloud regiona, geopolitički rizik |
| Usluge i MSP | Provajder upravljanih usluga sa privilegovanim pristupom | Napad na MSP-ov RMM alat širi ransomware na sve klijente (Kaseya 2021) |
| Gubitak podataka kod dobavljača | Treća strana kompromitovana | Curenje podataka iz SaaS-a ili kod ugovornog obrađivača |

### Mitigacije

| Mitigacija | Kako pomaže |
|---|---|
| **Third-party assessment** | Upitnici (SIG, CAIQ), SOC 2 Type II, ISO 27001 certifikat, penetracioni testovi, posjete lokaciji, procjena po nivou rizika (tiering dobavljača) |
| **Third-party monitoring** | Kontinuirano praćenje: security rating servisi, praćenje vijesti i sankcija, godišnja ponovna procjena, praćenje promjena vlasništva |
| **Minimum security requirements** | Ugovorni zahtjevi: MFA, šifrovanje, zakrpe, SSDF praksa, obaveza prijave incidenta, pravo na audit, zahtjevi i za podugovarače (flow-down) |
| **Service level requirements** | SLA sa dostupnošću, RTO/RPO, rokovima za zakrpe kritičnih ranjivosti, rokovima prijave incidenta |
| **Silicon root of trust** | Nepromjenjiv kod i ključevi u hardveru (npr. TPM, Google Titan, AWS Nitro, Apple Secure Enclave) koji verifikuju firmware prije pokretanja: **secure boot / measured boot** lanac povjerenja od silicijuma |
| **Physically Unclonable Function (PUF)** | Jedinstven „otisak“ čipa koji proizlazi iz neizbježnih varijacija u proizvodnji; služi za identifikaciju i izvođenje ključeva bez njihovog čuvanja, otežava krivotvorenje i kloniranje |
| **SBOM** (Software Bill of Materials) | Mašinski čitljiv popis svih komponenti softvera, verzija, dobavljača i licenci (formati **SPDX**, **CycloneDX**); omogućava brz odgovor kada se objavi ranjivost u komponenti; uz **VEX** (Vulnerability Exploitability eXchange) govori da li je ranjivost zaista iskoristiva |
| Provjera porijekla i integriteta | Kupovina od ovlašćenih distributera, potpisani paketi i firmware, provenance atestacije (SLSA, Sigstore), anti-tamper pakovanje |
| Diverzifikacija | Više dobavljača, izlazna strategija, escrow izvornog koda |
| Ugovorni i pravni instrumenti | Odgovornost, osiguranje, raskid, vraćanje i uništenje podataka |

### Hardverski lanac povjerenja

| Korak pokretanja | Ko verifikuje | Šta se postiže |
|---|---|---|
| Boot ROM u silicijumu (root of trust) | Nepromjenjiv kod u čipu sa javnim ključem proizvođača | Prva instrukcija je pouzdana jer se ne može izmijeniti |
| Firmware (UEFI, BMC) | Boot ROM provjerava potpis | Otkriva izmijenjen ili krivotvoren firmware |
| Bootloader i kernel | Firmware provjerava potpis (secure boot) | Sprječava bootkite |
| Mjerenja u TPM PCR registre (measured boot) | TPM bilježi heševe svake faze | **Remote attestation**: udaljeni verifikator potvrđuje stanje prije izdavanja tajni |

PUF dopunjuje ovaj lanac: ključ uređaja se ne upisuje u memoriju (odakle bi se mogao izvući), nego se rekonstruiše iz fizičkih svojstava čipa pri svakom pokretanju, pa kloniran ili krivotvoren čip ne može proizvesti isti odgovor.

### SBOM detaljnije

NTIA **minimalni elementi** SBOM-a: ime dobavljača, ime komponente, verzija, drugi jedinstveni identifikatori (npr. PURL, CPE), odnosi zavisnosti, autor SBOM podataka i vremenska oznaka. Praktični zahtjevi:

| Zahtjev | Zašto |
|---|---|
| SBOM se generiše automatski u build pipelineu | Ručni SBOM brzo zastarijeva |
| Uključuje tranzitivne zavisnosti | Većina ranjivosti je duboko u stablu |
| Potpisan i povezan sa artefaktom | Integritet i sljedivost |
| Dobavljači ga isporučuju uz proizvod (ugovorni zahtjev) | Vidljivost i za kupljeni softver |
| Kontinuirano se poredi sa bazama ranjivosti | Brza detekcija pogođenih sistema |

### Regulatorni pritisak na lanac snabdijevanja

| Propis | Zahtjev |
|---|---|
| **US Executive Order 14028** (2021) | Sigurni razvoj softvera za vladine dobavljače, SBOM, NIST SSDF atestacija |
| **NIS2** | Sigurnost lanca snabdijevanja kao obavezna mjera upravljanja rizikom |
| **DORA** | Upravljanje rizikom ICT trećih strana, registar ugovora, nadzor kritičnih ICT provajdera |
| **EU Cyber Resilience Act** | Sigurnosni zahtjevi za proizvode sa digitalnim elementima, upravljanje ranjivostima i SBOM tokom životnog vijeka proizvoda |

### Životni ciklus odnosa sa dobavljačem

| Faza | SCRM aktivnosti |
|---|---|
| Planiranje i izbor | Kategorizacija po kritičnosti (tiering), definisanje zahtjeva, due diligence |
| Ugovaranje | Minimalni sigurnosni zahtjevi, SLA, pravo na audit, prijava incidenta, flow-down na podugovarače |
| Isporuka i prijem | Provjera integriteta (potpisi, SBOM, anti-tamper), testiranje prije uvođenja |
| Rad | Monitoring, periodične procjene, upravljanje promjenama |
| Završetak | Ukidanje pristupa, povrat i uništenje podataka, prelazak na drugog dobavljača |

### Scenarij: objavljena ranjivost u biblioteci

Objavljena je kritična ranjivost u široko korištenoj logging biblioteci. Organizacija koja ima **SBOM** za sve aplikacije i od dobavljača za kupljeni softver za sat vremena zna koji sistemi su pogođeni; organizacija bez SBOM-a sedmicama skenira i pita dobavljače. VEX dokumenti dobavljača dodatno pokazuju da u nekim proizvodima ranjiva funkcija nije dostupna, pa se zakrpe prioritizuju tamo gdje je stvarni rizik.

> **Na ispitu:** SBOM ne sprječava ranjivosti, nego daje **vidljivost** potrebnu za brz odgovor i upravljanje licencama. Silicon root of trust i PUF su hardverske mitigacije protiv tamperinga, implantata i krivotvorina. Najbolja prva mjera za novog kritičnog dobavljača je **procjena prije ugovora** i ugovorni minimalni zahtjevi, ne kasnije pregovaranje.

### Tiering dobavljača

| Nivo | Kriterijum | Dubina procjene |
|---|---|---|
| Tier 1 (kritičan) | Pristup osjetljivim podacima ili privilegovan pristup, kritičan za posao | Detaljan upitnik, SOC 2 Type II, pravo na audit, godišnja ponovna procjena, kontinuiran monitoring |
| Tier 2 (važan) | Ograničen pristup podacima, zamjenjiv uz napor | Standardni upitnik, certifikati, procjena svake dvije godine |
| Tier 3 (nizak) | Bez pristupa podacima i sistemima | Osnovna provjera (sankcije, finansijska stabilnost) |

## Program svijesti, edukacije i obuke (1.12)

ISC2 razlikuje tri nivoa:

| Nivo | Cilj | Publika | Primjeri | Ishod |
|---|---|---|---|---|
| **Awareness** (svijest) | Promijeniti pažnju i ponašanje; „šta“ | Svi zaposleni | Posteri, newsletteri, kratki video, banneri, phishing simulacije | Prepoznavanje prijetnje, prijava |
| **Training** (obuka) | Naučiti vještinu za posao; „kako“ | Određene uloge | Obuka za developere o sigurnom kodiranju, obuka administratora, obuka za odgovor na incidente | Sposobnost obavljanja zadatka sigurno |
| **Education** (edukacija) | Dubinsko razumijevanje; „zašto“ | Sigurnosni profesionalci | Fakultet, certifikati (CISSP), dugoročni programi | Sposobnost donošenja odluka i dizajna |

### Uspostavljanje programa

1. Podrška uprave i vlasnik programa (obično CISO ili tim za svijest).
2. Procjena potreba: rizici (npr. phishing, BEC), regulatorni zahtjevi (PCI DSS, HIPAA, NIS2 traže obuku), uloge.
3. Segmentacija publike: svi zaposleni, rukovodioci, developeri, administratori, finansije (BEC), HR, izvođači.
4. Izbor metoda i sadržaja, plan za godinu.
5. Sprovođenje: obuka pri zapošljavanju (prije pristupa sistemima) i najmanje godišnje, plus kontinuirane mikro-aktivnosti.
6. Mjerenje i izvještavanje.
7. Periodično preispitivanje sadržaja.

### Primjer godišnjeg plana

| Kvartal | Aktivnosti | Publika |
|---|---|---|
| Q1 | Obavezna godišnja obuka (politike, klasifikacija, prijava incidenata), phishing simulacija | Svi |
| Q2 | Obuka o BEC i deepfake prevarama, procedura povratnog poziva | Finansije, asistenti uprave |
| Q2 | Radionica sigurnog kodiranja (OWASP Top 10), CTF | Developeri, champions |
| Q3 | Tabletop vježba ransomware incidenta | Uprava, IT, PR, pravna služba |
| Q4 | Kampanja u mjesecu svijesti o kibernetičkoj sigurnosti, gamifikovani kviz, nagrade | Svi |
| Kontinuirano | Mikro-moduli mjesečno, simulacije, just-in-time poruke, obuka pri zapošljavanju | Svi, novi zaposleni |

### Metode i tehnike

| Metoda | Opis | Prednost |
|---|---|---|
| **Security champions** | Zaposleni u poslovnim i razvojnim timovima koji su lokalni ambasadori sigurnosti, dobijaju dodatnu obuku i prenose znanje | Skalira sigurnosni tim, kulturno prihvatanje, rani signali iz timova |
| **Gamification** | Bodovi, rang liste, značke, CTF takmičenja, escape room, nagrade | Motivacija i angažman, bolje pamćenje |
| **Phishing simulacije** | Kontrolisani lažni phishing mailovi uz trenutnu edukaciju pri kliku | Mjerljivo ponašanje, realna praksa |
| **Socijalni inženjering obuka** | Vishing, smishing, pretexting, tailgating, BEC, deepfake glas/video | Prepoznavanje manipulacije |
| **Mikroučenje** (microlearning) | Kratki moduli od 3–5 minuta | Bolje zadržavanje, manje ometanja |
| **Tabletop vježbe** | Scenariji incidenta za rukovodstvo i tehničke timove | Pripremljenost, uloge |
| **Just-in-time** | Edukacija u trenutku rizične radnje (npr. upozorenje pri dijeljenju fajla van organizacije) | Kontekst |
| **Obuka zasnovana na ulozi** (role-based) | Sadržaj prilagođen poslu | Relevantnost |

### Program security championa

| Element | Dobra praksa |
|---|---|
| Izbor | Dobrovoljci sa interesom, jedan po timu ili proizvodu |
| Vrijeme | Formalno odobren dio radnog vremena (npr. 10–20%), uz podršku rukovodioca |
| Obuka | Dublja obuka (threat modeling, sigurno kodiranje, alati u pipelineu) |
| Zadaci | Prvi kontakt za sigurnosna pitanja u timu, učešće u dizajn reviewu i trijaži nalaza |
| Zajednica | Redovni sastanci, kanal za razmjenu, pristup sigurnosnom timu |
| Priznanje | Vidljivost, certifikati, uticaj na ocjenu rada |
| Mjerenje | Broj threat modela, vrijeme do ispravke nalaza u timovima sa championom u odnosu na timove bez njega |

> **Na ispitu:** kažnjavanje zaposlenih koji kliknu na simulaciju nije cilj; cilj je promjena ponašanja i kultura u kojoj se incidenti **prijavljuju**. Program mora biti prilagođen publici: obuka za developere i za finansijsku službu se razlikuju. Najefikasniji program je kontinuiran, ne godišnji jednokratni video.

### Mjerenje efikasnosti

Kirkpatrickov model sa četiri nivoa je koristan okvir:

| Nivo | Pitanje | Metrika |
|---|---|---|
| 1 Reakcija | Da li je polaznicima bilo korisno? | Ankete zadovoljstva |
| 2 Učenje | Da li su naučili? | Testovi prije i poslije obuke |
| 3 Ponašanje | Da li se ponašaju drugačije? | **Stopa klika** u phishing simulacijama, **stopa prijave** sumnjivih mailova, vrijeme do prijave, broj kršenja politika |
| 4 Rezultati | Da li je rizik smanjen? | Broj stvarnih incidenata uzrokovanih ljudskom greškom, gubici od BEC-a, nalazi audita |

Metrike: procenat završene obuke (completion rate je KPI aktivnosti, ne efikasnosti), stopa klika i stopa prijave, trend kroz vrijeme, poređenje po odjeljenjima. **Stopa prijave** je često vrijednija od stope klika, jer pokazuje aktivnu kulturu.

#### Primjer

U januaru je 22% zaposlenih kliknulo na simulaciju, a 8% je prijavilo. Nakon šest mjeseci mikroučenja i gamifikacije: 7% klik, 54% prijava, medijana vremena do prve prijave 4 minute. Broj stvarnih kompromitovanih naloga pao je sa 9 na 2 po kvartalu. To je dokaz efikasnosti na nivoima 3 i 4, a ne samo podatak da je 100% ljudi „pogledalo video“.

### Angažman stakeholdera (novo 2027.)

| Stakeholder | Zašto ga uključiti | Kako |
|---|---|---|
| Uprava | Mandat, budžet, primjer (tone at the top) | Kvartalni izvještaj sa metrikama rizika, učešće u tabletop vježbama |
| HR | Onboarding, disciplinske procedure, kultura | Integracija obuke u proces zapošljavanja i ocjenjivanja |
| Pravna služba i compliance | Regulatorni zahtjevi obuke, privatnost simulacija | Pregled sadržaja i politike simulacija |
| Komunikacije / marketing | Kvalitet poruka, kampanje | Zajedničke kampanje (npr. Cybersecurity Awareness Month u oktobru) |
| Rukovodioci odjeljenja | Relevantnost i vrijeme za obuku | Prilagođeni sadržaj, champions u timovima |
| Predstavnici zaposlenih / sindikat | Povjerenje, prihvatanje nadzora | Transparentnost o phishing simulacijama |

### Periodično preispitivanje sadržaja

Sadržaj se preispituje najmanje godišnje i kada se pojave nove prijetnje ili tehnologije:

| Tema u nastajanju | Šta zaposleni treba da znaju |
|---|---|
| **AI** | Ne unositi povjerljive podatke u javne AI alate; prepoznati deepfake glas i video (npr. lažni poziv „direktora“ za hitnu uplatu); AI-generisani phishing bez gramatičkih grešaka; politika prihvatljive upotrebe AI |
| **Kriptovalute** | Prevare sa investicijama, lažne mjenjačnice, ransomware traži plaćanje u kriptovalutama, kriptodžeking (neovlašćeno rudarenje na resursima organizacije) |
| **Blockchain** | Šta stvarno garantuje (integritet i nepromjenjivost zapisa) i šta ne (povjerljivost, ispravnost pametnih ugovora); rizik izgubljenih privatnih ključeva i novčanika |
| QR kod phishing (quishing) | Ne skenirati nepoznate QR kodove za prijavu |
| MFA fatigue | Ne odobravati neočekivane push zahtjeve, prijaviti ih |
| Rad na daljinu | Kućne mreže, javni Wi-Fi, fizička sigurnost uređaja |

> **Na ispitu:** kada se pojavi nova prijetnja (npr. deepfake prevare), ispravan odgovor je **ažurirati sadržaj programa** i ciljano obavijestiti rizične grupe (finansije), uz procedure verifikacije (povratni poziv na poznat broj), a ne čekati sljedeći godišnji ciklus.

## Povezivanje tri cilja

| Cilj | Pitanje | Izlaz |
|---|---|---|
| 1.10 Threat modeling | Šta može poći naopako u našem sistemu? | Lista prijetnji, kontrole, preostali rizik |
| 1.11 SCRM | Šta može poći naopako zbog onih od kojih kupujemo? | Zahtjevi prema dobavljačima, procjene, SBOM, hardverski korijen povjerenja |
| 1.12 Svijest i obuka | Šta može poći naopako zbog ljudi i kako to smanjiti? | Program sa metrikama ponašanja i rezultata |

Sva tri se vraćaju u proces upravljanja rizikom iz 1.9: identifikovane prijetnje ulaze u registar rizika, tretman ima vlasnika, a efikasnost se mjeri i izvještava.

## Tipične zamke

| Zamka | Ispravno razmišljanje |
|---|---|
| CVSS kao metodologija modelovanja prijetnji | CVSS ocjenjuje ozbiljnost poznate ranjivosti; threat model traži prijetnje u dizajnu |
| Threat modeling tek prije produkcije | Najjeftinije u dizajnu, uz ponavljanje pri promjenama |
| SOC 2 izvještaj dobavljača kao kraj procjene | Pročitati obim, izuzetke i komplementarne kontrole korisnika (CUEC), pratiti kontinuirano |
| SBOM kao sigurnosna kontrola koja sprječava napad | SBOM daje vidljivost; sprječavanje dolazi od procesa koji ga koristi |
| Completion rate kao dokaz efikasnosti obuke | Mjeriti ponašanje i rezultate |
| Kažnjavanje za klik u simulaciji | Edukacija i kultura prijavljivanja |

## Rezime

- **Threat modeling**: četiri pitanja; asset-, attacker- i software-centric; DFD i granice povjerenja; što ranije u SDLC-u i pri promjenama.
- **STRIDE**: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege; mapira se na svojstva iz 1.2.
- **PASTA** (sedam faza, risk-centric), **VAST** (agilno, skalabilno), **DREAD** (rangiranje, subjektivno), **Trike**, **OCTAVE**, **LINDDUN** (privatnost), **attack trees**, **ATT&CK**, **Kill Chain**.
- **SCRM rizici**: tampering, krivotvorine, implantati, reputacioni rizik (novo 2027.), kompromitovane zavisnosti, koncentracija, MSP.
- **SCRM mitigacije**: procjena i monitoring trećih strana, minimalni zahtjevi i flow-down, SLA, silicon root of trust, PUF, SBOM (SPDX, CycloneDX) uz VEX, provenance i potpisi; tiering dobavljača.
- **Awareness / training / education**: šta / kako / zašto.
- **Metode**: security champions, gamification, phishing simulacije, mikroučenje, role-based, just-in-time.
- **Mjerenje**: Kirkpatrick 1–4; ponašanje (klik i prijava) i rezultati (incidenti) važniji od procenta završene obuke.
- **Stakeholderi i sadržaj**: uprava, HR, pravna služba, komunikacije; godišnje i ad hoc preispitivanje sa temama AI, kriptovaluta i blockchaina.
