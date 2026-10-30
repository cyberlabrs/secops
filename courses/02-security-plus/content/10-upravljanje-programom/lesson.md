## Ciljevi ispita

Ovaj modul pokriva cijeli **domen 5** (*Security Program Management and Oversight*), ciljeve **5.1 do 5.6**:

- **5.1** GRC artefakti (politike, standardi, procedure, smjernice, planovi)
- **5.2** upravljanje rizikom, uključujući računanje **SLE, ALE i ARO**
- **5.3** rizik trećih strana (izbor dobavljača, ugovori, nadzor)
- **5.4** elementi compliancea i prava na privatnost
- **5.5** audit, procjene i penetraciono testiranje
- **5.6** program sigurnosne svijesti (security awareness)

Ovo je „menadžerski“ domen. Pitanja su često definicijska, ali u scenariju: treba prepoznati koji dokument, ugovor ili tretman rizika odgovara opisu. Za DevOps inženjera ovo je svijet u kojem nastaju zahtjevi koje kasnije implementiraš u Terraformu i pipelineu.

## 5.1 GRC artefakti

**GRC** (*governance, risk, compliance*) artefakti su dokumenti kojima organizacija definiše šta i kako radi u sigurnosti. Ključno je razlikovati koliko su obavezni i koliko su detaljni.

| Artefakt (engl.) | Obavezan? | Nivo detalja | Odgovara na pitanje |
|---|---|---|---|
| **Policy** | Da | Visok nivo, odobrava uprava | **Šta** i **zašto** |
| **Standard** | Da | Konkretni zahtjevi | **Šta tačno** (koja vrijednost, koja tehnologija) |
| **Procedure** | Da | Korak po korak | **Kako** |
| **Guideline** | Ne (preporuka) | Savjet, najbolja praksa | **Kako bi bilo dobro** |
| **Plan** | Da, za određen događaj | Uloge, koraci, kontakti | **Šta radimo kad se desi X** |

Primjer lanca: *politika* kaže „podaci at rest moraju biti šifrovani“; *standard* kaže „AES-256, ključevi u KMS-u, rotacija godišnje“; *procedura* opisuje korake za uključivanje enkripcije na novom RDS-u; *smjernica* preporučuje korištenje Terraform modula tima za platformu.

### Guidelines

| Vrsta | Primjer |
|---|---|
| **Benchmarks** | CIS Benchmarks za Linux, Kubernetes, AWS |
| **Advisories** | Sigurnosna upozorenja proizvođača ili agencija (npr. CISA advisory o aktivno iskorištavanoj ranjivosti) |
| **Implementation guides** | Vodiči proizvođača za sigurnu instalaciju i konfiguraciju |
| **Reference architecture** | Provjeren arhitekturni obrazac (npr. AWS Security Reference Architecture, landing zone) |

### Standards

| Vrsta | Primjer |
|---|---|
| **Baselines** | Minimalna sigurnosna konfiguracija za tip sistema (hardened AMI, golden image) |
| **Passwords** | Dužina, složenost, MFA, upravljanje lozinkama (moderne smjernice favorizuju dužinu i provjeru protiv procurjelih lozinki umjesto čestih obaveznih promjena) |
| **Physical security** | Kontrola ulaza, kamere, zaključavanje server sala |
| **RFC** (*request for comments*) | Internet standardi koje objavljuje IETF (npr. TLS 1.3 je RFC 8446) |
| **Encryption** | Dozvoljeni algoritmi, dužine ključeva, upravljanje ključevima |

### Procedures

- **SOP** (*standard operating procedure*): formalno opisan, ponovljiv postupak za rutinski posao (npr. onboarding korisnika, promjena firewall pravila).
- **Runbook**: konkretni koraci za određenu operativnu situaciju, često djelimično automatizovani (npr. „pod u CrashLoopBackOff“, „izolacija kompromitovane EC2 instance“). U SOC-u se automatizovani runbookovi pokreću kroz SOAR.

### Plans

- **Business continuity plan (BCP)**: kako poslovanje nastavlja rad tokom poremećaja.
- **Disaster recovery plan (DRP)**: kako se vraćaju IT sistemi i podaci.

### Policies

| Politika (engl.) | Sadržaj |
|---|---|
| **Information security policy** | Krovna politika: ciljevi, uloge, odgovornosti sigurnosnog programa |
| **Acceptable use policy (AUP)** | Šta zaposleni smiju i ne smiju raditi sa resursima firme (internet, e-mail, AI alati) |
| **BYOD** | Pravila za lične uređaje: MDM, razdvajanje poslovnih podataka, brisanje na daljinu |
| **Clean desk** | Bez osjetljivih papira i otključanih ekrana kad se napusti radno mjesto |
| **Incident response** | Ovlaštenja, uloge i obaveze kod incidenta |
| **Data classification and retention** | Klase podataka i koliko se dugo čuvaju |
| **Access control** | Kako se dodjeljuju, provjeravaju i oduzimaju prava (least privilege, access review) |
| **Data disposal** | Kako se podaci i mediji sigurno uništavaju |
| **Vulnerability disclosure** | Kako spoljni istraživači prijavljuju ranjivosti (kontakt, `security.txt`, pravila, safe harbor) |
| **Privacy** | Kako organizacija prikuplja, koristi i štiti lične podatke |

> **Na ispitu:** Politika je **obavezna i opšta**, standard je **obavezan i konkretan**, procedura je **korak po korak**, smjernica je **preporuka**. Ako pitanje kaže „dokument koji preporučuje, ali ne nameće“, odgovor je **guideline**. Ako kaže „sve lozinke moraju imati najmanje 14 znakova“, to je **standard**.

## 5.2 Upravljanje rizikom

### Proces

1. **Risk identification**: **asset identification** (šta imamo i koliko vrijedi) i **stakeholder ownership** (ko je vlasnik imovine i rizika).
2. **Risk assessment**: **scoring** (ocjena, npr. 1–5 za vjerovatnoću i uticaj) i **categorization** (operativni, finansijski, pravni, tehnički, reputacijski rizik).
3. **Risk analysis**: **impact** (uticaj), **likelihood/probability** (vjerovatnoća), **owner** (vlasnik rizika), **current mitigations** (postojeće kontrole). Može biti kvalitativna ili kvantitativna.
4. **Risk treatment**: šta radimo sa rizikom.
5. **Praćenje** kroz **risk register**.

### Kvalitativna vs kvantitativna analiza

| | **Qualitative** | **Quantitative** |
|---|---|---|
| Izražavanje | Kategorije: nizak/srednji/visok, matrica vjerovatnoća × uticaj (heat map) | Novac i brojevi: SLE, ALE, ARO |
| Prednost | Brza, ne treba precizne podatke | Omogućava cost-benefit analizu kontrola |
| Mana | Subjektivna | Traži pouzdane podatke koje je teško dobiti |

### SLE, ARO, ALE

| Pojam (engl.) | Značenje | Formula |
|---|---|---|
| **AV** (*asset value*) | Vrijednost imovine | |
| **EF** (*exposure factor*) | Procenat vrijednosti izgubljen u jednom događaju | 0–100% |
| **SLE** (*single loss expectancy*) | Gubitak od **jednog** događaja | **SLE = AV × EF** |
| **ARO** (*annualized rate of occurrence*) | Koliko puta **godišnje** očekujemo događaj | 0,25 = jednom u 4 godine |
| **ALE** (*annualized loss expectancy*) | Očekivani **godišnji** gubitak | **ALE = SLE × ARO** |

**Primjer 1.** Laptop vrijedi 2.000 €, krađa znači potpun gubitak (EF = 100%), firma godišnje izgubi 12 laptopova (ARO = 12).

- SLE = 2.000 € × 1,0 = 2.000 €
- ALE = 2.000 € × 12 = 24.000 €

**Primjer 2.** Data centar vrijedi 500.000 €. Poplava bi uništila 40% (EF = 0,4). Poplava se očekuje jednom u 20 godina (ARO = 0,05).

- SLE = 500.000 € × 0,4 = 200.000 €
- ALE = 200.000 € × 0,05 = 10.000 €

**Cost-benefit kontrole.** Ako zaštita od poplave košta 15.000 € godišnje, a ALE je 10.000 €, kontrola košta više nego što štiti, pa je razumnije **prenijeti** (osiguranje) ili **prihvatiti** rizik. Vrijednost kontrole = ALE prije − ALE poslije − godišnji trošak kontrole.

> **Na ispitu:** Pazi na ARO zadat kao „jednom u N godina“: ARO = 1/N. „Jednom u 5 godina“ je 0,2, a ne 5. SLE je za **jedan** događaj, ALE za **godinu**. Ako pitanje daje AV i EF, prvo računaj SLE.

### Risk register

**Risk register** je centralna evidencija rizika: opis, kategorija, vlasnik, vjerovatnoća, uticaj, ocjena, postojeće kontrole, plan tretmana, status, rok. Ključne aktivnosti iz ciljeva:

- **Communication**: register je alat za komunikaciju rizika upravi i vlasnicima.
- **Reviews**: redovno ažuriranje (rizici se mijenjaju, kontrole se uvode).

Često se vode i **KRI** (*key risk indicators*), metrike koje upozoravaju da rizik raste.

### Risk treatment

| Tretman (engl.) | Opis | Primjer |
|---|---|---|
| **Mitigating** | Smanjiti vjerovatnoću ili uticaj kontrolama | MFA, WAF, backup |
| **Transferring** | Prebaciti finansijski teret na treću stranu | Cyber osiguranje, outsourcing ugovor sa odgovornošću |
| **Avoiding** | Prestati sa aktivnošću koja nosi rizik | Ugasiti zastarjeli servis, ne ući na rizično tržište |
| **Accepting** | Svjesno prihvatiti rizik (obično kad je u okviru apetita ili je kontrola preskupa) | Formalni **exception/exemption** sa potpisom vlasnika rizika i rokom |

> **Na ispitu:** Osiguranje je **transfer**, ali samo finansijskog dijela; reputacijska šteta i odgovornost za podatke ostaju. Gašenje funkcionalnosti je **avoid**. Ako je trošak kontrole veći od ALE-a, tipičan odgovor je **accept** (ili transfer).

### Poslovna razmatranja

| Pojam (engl.) | Značenje |
|---|---|
| **Business impact analysis (BIA)** | Utvrđuje kritične poslovne funkcije, uticaj njihovog prekida kroz vrijeme i iz toga izvodi RTO, RPO i prioritete oporavka |
| **Risk appetite** | Koliko rizika organizacija **želi** preuzeti radi ciljeva (npr. *expansionary* = sklonija riziku, *conservative* = oprezna, *neutral*) |
| **Risk tolerance / threshold** | Prihvatljivo odstupanje i granica iznad koje se rizik mora tretirati |
| **Inherent risk** | Rizik prije kontrola |
| **Residual risk** | Rizik koji **ostaje nakon** primjene kontrola; treba biti unutar apetita |
| **Stakeholder involvement** | Uključivanje vlasnika procesa, pravnog tima, IT-a u odluke o riziku |
| **Management oversight** | Uprava (i odbor) nadzire i odgovara za odluke o riziku |
| **Regulatory** i **Legal** | Propisi i ugovori mogu nametnuti kontrole bez obzira na apetit |

## 5.3 Rizik trećih strana

Dobavljači (SaaS, cloud, MSP, outsourcing) imaju pristup podacima i sistemima, pa njihov rizik postaje tvoj. Napadi preko lanca snabdijevanja su čest put kompromitacije.

### Izbor dobavljača (vendor selection)

| Dokument (engl.) | Svrha |
|---|---|
| **RFI** (*request for information*) | Rana faza: prikupljanje opštih informacija o mogućnostima dobavljača |
| **EOI** (*expression of interest*) | Dobavljači iskazuju interes za projekat; služi za suženje liste prije formalnog postupka |
| **RFP** (*request for proposal*) | Detaljan zahtjev: dobavljač predlaže **rješenje**, pristup i cijenu |
| **RFQ** (*request for quote*) | Zahtjeve već znaš; tražiš **cijenu** za tačno definisan proizvod/uslugu |

- **Due diligence**: provjera dobavljača prije ugovora: finansijska stabilnost, sigurnosna praksa (SOC 2 izvještaj, ISO 27001 certifikat, upitnici), istorija incidenata, podizvođači, lokacija podataka.
- **Conflict of interest**: osoba koja bira dobavljača ne smije imati lični interes (npr. rođak vlasnik firme); mora se prijaviti i izuzeti.

### Vrste ugovora (agreement types)

| Ugovor (engl.) | Sadržaj | Obavezujući? |
|---|---|---|
| **MSA** (*master services agreement*) | Opšti okvirni uslovi saradnje za sve buduće poslove (odgovornost, plaćanje, povjerljivost) | Da |
| **SOW** (*statement of work*) | Konkretan posao pod MSA-om: obim, isporuke, rokovi, cijena | Da |
| **SLA** (*service-level agreement*) | Obavezan nivo usluge i posljedice ako nije ispunjen (npr. kredit na računu) | Da |
| **SLO** (*service-level objective*) | Konkretan mjerljiv cilj unutar SLA-a (npr. dostupnost 99,9% mjesečno, odgovor na P1 za 15 min) | Dio SLA-a |
| **NDA** (*non-disclosure agreement*) | Obaveza čuvanja povjerljivih informacija | Da |
| **MOU** (*memorandum of understanding*) | Izjava o zajedničkoj namjeri i saradnji, obično **neformalna** i ne pravno obavezujuća | Uglavnom ne |
| **MOA** (*memorandum of agreement*) | Formalniji od MOU-a: detaljno definiše uloge i odgovornosti strana | Više obavezujući od MOU-a |

> **Na ispitu:** **MSA = okvir**, **SOW = konkretan projekat** pod okvirom. **SLA = obećanje sa posljedicama**, **SLO = brojka koja se mjeri**. **MOU** je najlabaviji: namjera, ne obaveza.

### Nadzor dobavljača (vendor monitoring)

- **Right to audit**: ugovorna klauzula koja ti daje pravo da provjeriš (ili angažuješ revizora da provjeri) kontrole dobavljača. Bez nje ne možeš tražiti reviziju.
- **Service-level monitoring**: praćenje da li se SLA/SLO ispunjavaju.
- **Vendor registry**: inventar svih dobavljača, šta rade, kojim podacima pristupaju, nivo rizika.
- **Vendor assessment**: periodična procjena (upitnici, dokazi, pregledi).
- **Compliance attestation**: dobavljač dokazuje usklađenost (npr. SOC 2 Type II izvještaj, ISO 27001 certifikat, PCI DSS AOC).
- **Penetration testing**: pen test dobavljačevog sistema ili rezultat njihovog nezavisnog testa.

### Ograničenja (limitations/constraints)

| Ograničenje | Primjer |
|---|---|
| **Staffing limitations** | Nema dovoljno ljudi za procjenu svih dobavljača |
| **Resource availability** | Budžet, alati, vrijeme |
| **Environment** | Dobavljač radi u okruženju koje ne možeš pregledati (veliki cloud provajder ne dozvoljava fizičku reviziju) |
| **Legal and regulatory factors** | Propisi ograničavaju šta smiješ dijeliti ili gdje |
| **Geography/jurisdiction** | Dobavljač u drugoj državi podliježe drugim zakonima |
| **Financial/ROI** | Procjena košta više nego što vrijedi za malog dobavljača |
| **Vendor lock-in** | Teško i skupo promijeniti dobavljača (vlasnički formati, API-ji) |
| **Assurance mechanisms** | Oslanjanje na certifikate i izvještaje umjesto direktne provjere, sa njihovim ograničenjima |

### Rules of engagement

**Rules of engagement (RoE)** definišu pravila za testiranje ili saradnju: šta je u opsegu (*scope*), koje tehnike su dozvoljene ili zabranjene (npr. bez DoS-a, bez socijalnog inženjeringa), vremenski prozori, kontakti za eskalaciju, rukovanje pronađenim podacima i pravna ovlaštenja. Bez potpisanog RoE pen test može biti krivično djelo.

## 5.4 Compliance

### Compliance training

- **Data handling**: kako postupati sa klasifikovanim i ličnim podacima.
- **AML/CTF** (*anti-money laundering / counter-terrorism financing*): prepoznavanje sumnjivih transakcija i obaveza prijave (banke, fintech, kripto).
- **Anti-bribery**: zabrana davanja i primanja mita (npr. američki FCPA, britanski UK Bribery Act).

### Compliance monitoring

- **Attestations**: formalna izjava (često potpisana od rukovodstva ili nezavisnog revizora) da su zahtjevi ispunjeni.
- **Acknowledgements**: zaposleni potvrđuju da su pročitali i razumjeli politiku (npr. AUP pri zapošljavanju i godišnje).

Automatizacija u cloudu: AWS Config pravila, Azure Policy, Security Hub standardi, kontinuirano mjerenje usklađenosti.

### Posljedice neusklađenosti (consequences of non-compliance)

| Posljedica (engl.) | Primjer |
|---|---|
| **Reputational damage** | Gubitak povjerenja klijenata nakon javnog incidenta |
| **Financial** | Kazne regulatora (GDPR kazne mogu biti procenat globalnog prometa) |
| **Legal** | Tužbe, krivična odgovornost |
| **Contractual** | Raskid ugovora, penali prema partnerima |
| **Sanctions** | Mjere regulatora ili država, zabrana poslovanja sa određenim stranama |
| **Loss of license** | Gubitak dozvole za rad (banka, bolnica) ili prava na obradu kartica |

### Privatnost

| Pravo / pojam (engl.) | Značenje |
|---|---|
| **Right to be forgotten** | Pravo da se lični podaci izbrišu kad više nema osnova za obradu (GDPR „pravo na brisanje“) |
| **Opt-in / opt-out** | Opt-in: obrada tek nakon aktivnog pristanka; opt-out: obrada dok se osoba ne usprotivi |
| **Data correction** | Pravo na ispravku netačnih podataka |
| **Processing restrictions** | Pravo da se obrada ograniči (podaci se čuvaju, ali se ne koriste) npr. dok se rješava spor o tačnosti |
| **Processing prevention** | Pravo da se spriječi (usprotivi) određena obrada, npr. direktni marketing |
| **Controller vs. processor** | Controller određuje svrhu i način obrade i odgovoran je; processor obrađuje po nalogu controllera |
| **Ownership** | Ko „posjeduje“ podatke; subjekt ima prava nad svojim ličnim podacima i kad ih firma čuva |

### Pravna usklađenost (legal compliance)

- **Legal hold**: nalog (od pravnog tima zbog spora ili istrage) da se relevantni podaci **sačuvaju i ne brišu**, čak i ako bi ih retention politika inače obrisala. U cloudu: S3 Object Lock legal hold, Microsoft 365 litigation hold.
- **Legal orders**: sudski nalozi, subpoena, zahtjevi organa da se podaci predaju ili sačuvaju.
- **Data retention requirements**: propisi koji određuju minimalno (a ponekad i maksimalno) trajanje čuvanja (npr. finansijski zapisi).

> **Na ispitu:** Ako firma očekuje tužbu i treba spriječiti brisanje e-mailova, odgovor je **legal hold**, koji ima prednost nad redovnom retention politikom. Korisnik koji traži brisanje svojih podataka koristi **right to be forgotten**.

## 5.5 Audit i procjene

### Prikupljanje podataka (data gathering)

| Metoda (engl.) | Opis |
|---|---|
| **Sampling** | Pregled reprezentativnog uzorka (npr. 25 od 1.000 promjena) umjesto svega |
| **Questionnaires/surveys** | Upitnici za veći broj ljudi ili dobavljača |
| **Interviews** | Razgovor sa vlasnicima procesa i administratorima |
| **Assertion** | Tvrdnja rukovodstva da kontrola postoji i radi, koju revizor zatim provjerava dokazima |
| **Reference sources** | Okviri za strukturiranje analize prijetnji |

**Reference sources**:

| Model | Za šta služi |
|---|---|
| **MITRE ATT&CK** | Baza **taktika** (cilj napadača, npr. persistence) i **tehnika** (kako, npr. scheduled task) zasnovana na stvarnim napadima; koristi se za mapiranje detekcija i gap analizu |
| **Cyber Kill Chain** (Lockheed Martin) | Sedam faza napada: Reconnaissance, Weaponization, Delivery, Exploitation, Installation, Command and Control (C2), Actions on Objectives. Odbrana nastoji prekinuti lanac što ranije. |
| **Diamond Model of Intrusion Analysis** | Svaki događaj opisuje kroz četiri vrha: **adversary**, **capability**, **infrastructure**, **victim** i njihove veze |

### Scoping

- **Audit charter**: formalni dokument koji daje audit funkciji **ovlaštenje**, definiše svrhu, opseg, odgovornosti i kome odgovara (obično audit komitetu).
- **Frequency**: koliko često se audit radi (godišnje, kvartalno, kontinuirano) prema riziku i propisima.

### Vrste angažmana

| Vrsta (engl.) | Opis |
|---|---|
| **Gap analysis** | Poređenje trenutnog stanja sa ciljnim (npr. sa ISO 27001 ili NIST CSF) i lista nedostataka |
| **Internal: compliance** | Interni tim provjerava usklađenost sa politikama i propisima |
| **Internal: audit committee** | Odbor (obično dio upravnog odbora) koji nadzire audit i izvještavanje |
| **Internal: self-assessments** | Timovi sami procjenjuju svoje kontrole (npr. upitnik za svaki tim) |
| **External: examinations** | Formalan pregled od strane spoljne strane, često regulatora |
| **External: assessments** | Spoljna procjena kontrola ili rizika |
| **External: regulatory** | Audit koji nalaže regulator (npr. bankarski supervizor) |
| **External: independent third-party audits** | Nezavisni revizor (npr. SOC 2, ISO 27001 certifikacioni audit) |
| **Benchmarking** | Poređenje sa industrijom ili sa drugim organizacijama |

### Penetraciono testiranje

| Vrsta (engl.) | Šta tester zna |
|---|---|
| **Known environment** (ranije *white box*) | Sve: arhitekturu, kod, kredencijale |
| **Partially known environment** (*gray box*) | Dio informacija, npr. korisnički nalog |
| **Unknown environment** (*black box*) | Ništa osim cilja; simulira spoljnog napadača |

| Vrsta (engl.) | Opis |
|---|---|
| **Physical** | Test fizičke sigurnosti: ulazak u zgradu, tailgating, brave |
| **Offensive** | Napadački tim (**red team**) |
| **Defensive** | Odbrambeni tim (**blue team**) detektuje i reaguje |
| **Integrated** | Red i blue rade zajedno i razmjenjuju nalaze (**purple team**) |

**Reconnaissance**:

- **Passive**: bez direktnog kontakta sa ciljem: OSINT, DNS zapisi iz javnih izvora, certificate transparency logovi, LinkedIn, Shodan.
- **Active**: direktna interakcija: skeniranje portova (nmap), banner grabbing, enumeracija servisa. Može biti detektovana.

> **Na ispitu:** Ako tester dobije dokumentaciju mreže i kod, to je **known environment**. Ako pretražuje javne zapise bez slanja paketa ka cilju, to je **passive reconnaissance**. Red + blue zajedno je **integrated** (purple).

### Okviri i standardi

| Kategorija | Primjer |
|---|---|
| **Industry-based standards** | PCI DSS (kartična industrija), NERC CIP (energetika) |
| **International standards** | ISO/IEC 27001, ISO/IEC 27002 |
| **Region-specific standards** | GDPR i NIS2 (EU), propisi pojedinih država |

### Functional i behavioral testing

- **Functional testing**: provjera da li kontrola **radi kako je dizajnirana** (npr. da li MFA zaista blokira prijavu bez drugog faktora, da li backup može da se vrati).
- **Behavioral testing**: provjera **ponašanja ljudi** (ili sistema) u realnim uslovima, npr. phishing simulacija, test da li će zaposleni pustiti nepoznatu osobu u zgradu.

## 5.6 Security awareness

### Tipovi obuke

| Tip (engl.) | Kada |
|---|---|
| **Initial/onboarding** | Pri zapošljavanju, prije pristupa sistemima |
| **Ongoing** | Redovno (godišnje, kvartalno, mikro-lekcije) |
| **Targeted** | Za određene uloge ili rizične grupe (finansije za BEC, developeri za siguran kod, admini) |
| **Corrective** | Nakon greške ili incidenta, npr. korisnik je kliknuo na simulirani phishing |

### Načini isporuke (delivery mechanisms)

- **LMS** (*learning management system*): platforma za kurseve, praćenje završetka i testove.
- **Self-service portals**: materijali i alati koje korisnik koristi sam kad treba (baza znanja, dugme „prijavi phishing“).
- **One-to-one**: individualna obuka ili mentorstvo (npr. corrective razgovor).
- **One-to-many**: predavanje, webinar, radionica za grupu.

### Mjerenje efikasnosti

- **Metrics**: procenat klikova i (važnije) **procenat prijava** u phishing simulacijama, vrijeme do prijave, procenat završene obuke, broj incidenata uzrokovanih ljudskom greškom.
- **Managerial reports**: izvještaji rukovodiocima o stanju njihovih timova.
- **Personnel behavior risk scoring**: ocjena rizika pojedinca na osnovu ponašanja (ponovljeni klikovi, ignorisanje upozorenja, rizične aktivnosti), da bi se usmjerila ciljana obuka.

### Teme obuke

| Tema (engl.) | Ključna poruka |
|---|---|
| **Social engineering** | Phishing, vishing, smishing, pretexting; provjeri kroz drugi kanal |
| **Emerging security topics** | Nove prijetnje: deepfake glas i video, AI generisan phishing, QR phishing |
| **Password and credential management** | Password manager, MFA, bez ponovne upotrebe lozinki, passkeys |
| **Remote work/teleworking/hybrid** | Sigurna kućna mreža, VPN/ZTNA, javni Wi-Fi, privatnost ekrana |
| **BYOD** | Pravila za lične uređaje, MDM, odvajanje podataka |
| **Business email compromise (BEC)** | Lažni nalozi za plaćanje sa kompromitovanog ili lažnog naloga direktora/dobavljača; uvijek potvrdi promjenu računa telefonom na poznat broj |
| **Removable media and cables** | Ne priključuj nađene USB uređaje; zlonamjerni kablovi mogu sadržati implantat koji glumi tastaturu |
| **Situational awareness** | Pazi ko je iza tebe (shoulder surfing), ko ulazi za tobom (tailgating), neobične situacije |
| **Operational security (OPSEC)** | Ne objavljuj na društvenim mrežama detalje o sistemima, projektima, putovanjima rukovodstva |

> **Na ispitu:** Ako su korisnici u finansijama meta lažnih zahtjeva za promjenu računa dobavljača, najbolja mjera je **targeted training o BEC-u** uz proceduru provjere telefonom. Ako se pita koja metrika najbolje pokazuje uspjeh programa, **porast stope prijava** phishinga je jači pokazatelj od samog pada klikova.

## Rezime

- **Policy** (šta, obavezno) → **standard** (konkretni zahtjevi) → **procedure** (kako, SOP/runbook); **guideline** je preporuka; **plan** je za određeni događaj (BC, DR).
- Rizik: identifikacija → procjena → analiza → tretman → register. Tretmani: **mitigate, transfer, avoid, accept**.
- **SLE = AV × EF**, **ALE = SLE × ARO**; ARO „jednom u N godina“ = 1/N. Kontrola ima smisla ako smanjenje ALE-a premašuje njen godišnji trošak.
- **Residual risk** ostaje nakon kontrola i mora biti unutar **risk appetite**; **BIA** daje kritične funkcije, RTO i RPO.
- Dobavljači: RFI → (EOI) → RFP/RFQ, due diligence; **MSA** okvir, **SOW** posao, **SLA/SLO** nivo usluge, **NDA**, **MOU/MOA**; **right to audit** mora biti u ugovoru.
- Privatnost: right to be forgotten, opt-in/opt-out, ispravka, ograničenje i sprečavanje obrade; **legal hold** ima prednost nad retention politikom.
- Audit: sampling, interviews, assertions; ATT&CK, Kill Chain, Diamond Model; known/partially known/unknown pen test; passive vs active recon.
- Awareness: onboarding, ongoing, targeted, corrective; mjeri se stopom prijava i risk scoringom; BEC i deepfake su ključne teme.
