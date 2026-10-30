## Ciljevi ispita: 1.5 i 1.6

Ovaj modul završava Domen 1 (**Cloud Concepts, Architecture and Design**, oko 17%):

- **1.5 Evaluate Cloud Service Providers (CSP)**
  - verifikacija prema kriterijima (verification against criteria),
  - sertifikacije sistema i proizvoda (system/subsystem product certifications: Common Criteria, FIPS 140-2).
- **1.6 Comprehend Artificial Intelligence (AI)/Machine Learning (ML)** (nova tema u outlineu od 2026)
  - otkrivanje i analiza prijetnji u cloudu (cloud threat detection and analysis),
  - validacija i verifikacija izvora podataka (data source validation and verification),
  - Security Orchestration, Automation and Response (SOAR),
  - etička pitanja (ethical concerns),
  - regulatorni zahtjevi (regulatory requirements).

U 1.5 je ključno razumjeti **kako customer stiče povjerenje u provajdera** kojeg ne može sam auditirati, i razliku između sertifikacije **organizacije/usluge** (ISO 27001, SOC 2, CSA STAR) i sertifikacije **proizvoda** (Common Criteria, FIPS 140). U 1.6 ISC2 ne traži da znaš trenirati modele, nego da razumiješ AI kao **alat sigurnosti** (detekcija, SOAR) i kao **izvor rizika** (podaci, etika, regulativa).

## Zašto se CSP procjenjuje

Customer prenosi izvršenje, ali ne i accountability (modul 1). Zato mora imati dokaz da provajder ispravno radi svoj dio shared responsibility modela. Problem: veliki provajderi **ne dozvoljavaju** svakom od miliona korisnika da dođe na audit data centra. Rješenje je **povjerenje kroz nezavisnu treću stranu**: provajder se jednom auditira prema poznatom standardu, a customer koristi izvještaj ili sertifikat.

Proces procjene (vendor due diligence) tipično izgleda ovako:

1. **definisati kriterije** na osnovu poslovnih, regulatornih i sigurnosnih zahtjeva (šta mora biti ispunjeno),
2. prikupiti **dokaze** (sertifikati, audit izvještaji, CAIQ upitnik, ugovor i DPA),
3. **verifikovati** dokaze: obim (scope), period, izuzeci, ko je izdao, je li važeći,
4. identifikovati **praznine** i odlučiti: dodatne kontrole kod customera, ugovorne klauzule, prihvatanje rizika ili odbijanje provajdera,
5. **kontinuirano** pratiti (novi izvještaji svake godine, incidenti, promjene usluga).

> **Na ispitu:** prije izbora provajdera prvi korak nije „tražiti SOC 2“, nego **definisati zahtjeve (kriterije)**. Tek kada znaš šta ti treba (npr. PCI DSS, data residency u EU, FIPS 140 validirani HSM) možeš verifikovati da li provajder to ispunjava.

## Verifikacija prema kriterijima: standardi i programi

| Standard / program | Šta je | Šta dokazuje | Napomena |
|---|---|---|---|
| **ISO/IEC 27001** | sistem upravljanja informacionom sigurnošću (ISMS) | organizacija sistemski upravlja rizicima | sertifikat; provjeri **Statement of Applicability (SoA)** i obim |
| **ISO/IEC 27002** | katalog kontrola (smjernice) | — | nije sertifikacioni standard |
| **ISO/IEC 27017** | smjernice za kontrole u cloudu (za CSP i CSC) | proširenje 27002 za cloud | dodaje npr. podjelu uloga, sanitizaciju virtualnih okruženja |
| **ISO/IEC 27018** | zaštita PII u javnom cloudu kada je CSP processor | upravljanje ličnim podacima | relevantno za GDPR |
| **ISO/IEC 27701** | proširenje ISMS-a na upravljanje privatnošću (PIMS) | privatnost za controllere i processore | od 2025. i samostalni standard |
| **ISO 22301** | upravljanje kontinuitetom poslovanja (BCMS) | BC sposobnost provajdera | |
| **SOC 1 / SOC 2 / SOC 3** (SSAE 18, AICPA) | izvještaji o kontrolama uslužne organizacije | SOC 1: finansijsko izvještavanje; SOC 2: Trust Services Criteria; SOC 3: javni sažetak | Type I = dizajn u trenutku; **Type II = efikasnost kroz period** |
| **ISAE 3402** | međunarodni ekvivalent SOC 1 | | |
| **CSA STAR** | registar sigurnosti, povjerenja i usklađenosti CSA | nivoi povjerenja (vidi dalje) | zasnovan na **CCM** |
| **PCI DSS** | standard za podatke platnih kartica | AOC i ROC od QSA | industrijski, ugovorno obavezujući |
| **FedRAMP** | program SAD-a za autorizaciju cloud usluga za federalnu vladu | baseline Low/Moderate/High po NIST SP 800-53 | |
| **EUCS / BSI C5 / ENS** | evropske i nacionalne cloud šeme | C5 (Njemačka), ENS (Španija), EUCS u pripremi na nivou EU | |

### SOC izvještaji ukratko

| Izvještaj | Namjena | Ko ga čita | Distribucija |
|---|---|---|---|
| **SOC 1** | kontrole relevantne za finansijsko izvještavanje korisnika (ICFR) | revizori finansijskih izvještaja | ograničena |
| **SOC 2** | Trust Services Criteria: **Security** (obavezno), Availability, Processing Integrity, Confidentiality, Privacy | sigurnosni timovi, menadžeri rizika | ograničena (NDA) |
| **SOC 3** | sažetak SOC 2 bez detalja testova | javnost, marketing | javna |

Za sigurnosnu procjenu CSP-a najkorisniji je **SOC 2 Type II**: pokazuje da su kontrole **radile** tokom perioda (obično 6–12 mjeseci), a ne samo da postoje.

Kod čitanja SOC 2 izvještaja obrati pažnju na:

- **obim** (koje usluge i regioni su uključeni),
- **izuzetke** (exceptions) i mišljenje revizora (qualified opinion),
- **Complementary User Entity Controls (CUEC)**: kontrole koje **customer** mora sprovesti da bi kontrole provajdera bile efikasne,
- **carve-out vs inclusive** metod za podizvođače (npr. SaaS provajder isključuje IaaS ispod sebe).

> **Na ispitu:** ako SaaS provajder koristi carve-out metod za svoj IaaS, SOC 2 izvještaj SaaS-a **ne pokriva** kontrole IaaS-a. Menadžer rizika tada treba pribaviti i izvještaj IaaS provajdera (fourth party). CUEC-ovi su obaveza customera i često se previde.

### CSA STAR i Cloud Controls Matrix

**Cloud Controls Matrix (CCM)** je CSA katalog cloud kontrola (verzija 4 ima 17 domena i 197 kontrola) mapiran na ISO 27001/27017/27018, NIST, PCI DSS i druge. Uz CCM ide **CAIQ** (Consensus Assessments Initiative Questionnaire), standardizovani upitnik kojim provajder opisuje svoje kontrole.

| STAR nivo | Kako | Snaga dokaza |
|---|---|---|
| **Level 1: Self-Assessment** | provajder sam popuni CAIQ i objavi ga u STAR registru | najslabiji (samoprocjena) |
| **Level 2: Third-Party Audit** | **STAR Certification** (uz ISO 27001) ili **STAR Attestation** (uz SOC 2), nezavisni auditor | jak |
| **Level 3: Continuous** (Continuous Auditing) | kontinuirano praćenje i izvještavanje | najjači, u razvoju |

CSA je 2025. objavio i **AI Controls Matrix (AICM)** sa kontrolama za AI sisteme, kao proširenje CCM pristupa.

> **Na ispitu:** razlikuj **self-assessment** (STAR Level 1, CAIQ) od **nezavisnog audita** (STAR Level 2, SOC 2 Type II, ISO 27001 sertifikat). Kada pitanje traži NAJVIŠI nivo povjerenja, samoprocjena nikad nije tačan odgovor.

### Šta ako provajder nema traženi dokaz

| Situacija | Opcije |
|---|---|
| nema sertifikata, ali je mali i niskorizičan | upitnik, intervju, ugovorne garancije, prihvatanje rizika |
| izvještaj je istekao (stariji od 12 mjeseci) | tražiti **bridge letter** (gap letter) za period do novog izvještaja |
| obim ne pokriva uslugu koju koristimo | ne oslanjati se na izvještaj za tu uslugu; tražiti dodatni dokaz ili odbiti |
| izvještaj ima izuzetke | procijeniti uticaj, tražiti plan sanacije, kompenzacione kontrole kod customera |
| regulativa traži pravo na audit | ugovorna klauzula **right to audit**, često zamijenjena prihvatanjem izvještaja trećih strana |

## Sertifikacije proizvoda: Common Criteria i FIPS 140

Gore navedeni standardi ocjenjuju **organizaciju ili uslugu**. Common Criteria i FIPS 140 ocjenjuju **konkretan proizvod ili modul** (system/subsystem), npr. hypervisor, firewall ili HSM.

| | Common Criteria (ISO/IEC 15408) | FIPS 140-2 / 140-3 |
|---|---|---|
| Šta se ocjenjuje | sigurnosne funkcije IT proizvoda | kriptografski moduli (hardver, softver, firmver) |
| Ko | akreditovane laboratorije, šema priznata kroz **CCRA** (međunarodni sporazum) | **CMVP** (NIST i kanadski CCCS), akreditovane laboratorije |
| Nivoi | **EAL1–EAL7** (dubina evaluacije) | **Level 1–4** (fizička i logička zaštita) |
| Ključni pojmovi | **Protection Profile (PP)**, **Security Target (ST)**, **Target of Evaluation (TOE)** | odobreni algoritmi, zaštita od neovlaštenog pristupa (tamper) |
| Primjer u cloudu | hypervisor, firewall, OS evaluirani prema PP | HSM iza KMS-a, kriptografske biblioteke |

### Common Criteria

- **Protection Profile (PP)**: skup sigurnosnih zahtjeva za klasu proizvoda (npr. „mrežni uređaji“), nezavisan od proizvođača. Danas je dominantan pristup evaluacija prema PP-u (cPP, collaborative Protection Profile).
- **Security Target (ST)**: dokument proizvođača koji tvrdi koje sigurnosne funkcije proizvod ima (može se pozvati na PP).
- **Target of Evaluation (TOE)**: konkretan proizvod i konfiguracija koja se evaluira.

| EAL | Naziv |
|---|---|
| EAL1 | functionally tested |
| EAL2 | structurally tested |
| EAL3 | methodically tested and checked |
| EAL4 | methodically designed, tested and reviewed (najviši uobičajeni komercijalni nivo) |
| EAL5 | semiformally designed and tested |
| EAL6 | semiformally verified design and tested |
| EAL7 | formally verified design and tested |

Važno: **EAL mjeri dubinu i strogost evaluacije, ne „koliko je proizvod siguran“**. Proizvod sa EAL4 evaluiran prema uskom ST-u može imati manje sigurnosnih funkcija od proizvoda sa EAL2. Uz to, sertifikat važi samo za **evaluiranu konfiguraciju i verziju**.

### FIPS 140

| Nivo | Zahtjevi |
|---|---|
| **Level 1** | odobreni algoritmi, bez posebne fizičke zaštite (npr. softverska biblioteka) |
| **Level 2** | tamper-evidence (pečati, premazi), autentikacija zasnovana na ulogama |
| **Level 3** | tamper-resistance i reakcija (brisanje ključeva pri pokušaju otvaranja), autentikacija zasnovana na identitetu, fizičko razdvajanje interfejsa |
| **Level 4** | potpuna zaštita omotača, zaštita od napada iz okruženja (napon, temperatura) |

**FIPS 140-3** (zasnovan na ISO/IEC 19790 i 24759) zamijenio je FIPS 140-2: nove validacije po 140-2 nisu prihvatane od 2021, a preostali FIPS 140-2 sertifikati prelaze na **historical** listu CMVP-a **21. 9. 2026**. Outline i dalje pominje FIPS 140-2, ali u praksi i nabavkama treba tražiti **FIPS 140-3** validaciju. Moduli na historical listi se ne bi trebali birati za nove sisteme kod federalnih korisnika u SAD-u.

Cloud KMS servisi velikih provajdera koriste HSM-ove validirane na **FIPS 140 Level 3** (ili Level 2 za cijeli servis uz Level 3 za HSM-ove); namjenski cloud HSM servisi nude Level 3.

> **Na ispitu:** „Regulativa zahtijeva da kriptografski ključevi budu zaštićeni u modulu koji briše ključeve pri pokušaju fizičkog otvaranja.“ To je **FIPS 140 Level 3** (tamper-response). Level 2 samo pokazuje tragove pokušaja (tamper-evidence). Ako pitanje traži sertifikaciju **kriptografskog modula**, odgovor je FIPS 140, ne Common Criteria ni ISO 27001.

## Kriteriji van sertifikata

Sertifikati pokrivaju kontrole, ali procjena provajdera uključuje i poslovne i ugovorne kriterije:

| Kriterij | Šta provjeriti |
|---|---|
| Lokacija i jurisdikcija | regioni, mogućnost ograničenja podataka na zemlju/EU, zakoni koji važe za provajdera (npr. CLOUD Act) |
| Podizvođači (sub-processors) | lista, obavještavanje o promjenama, pravo prigovora |
| Finansijska stabilnost | rizik prestanka poslovanja (vendor lock-out) |
| Upravljanje incidentima | rokovi obavještavanja, saradnja u istrazi, pristup logovima |
| Podrška i SLA | nivoi podrške, metrike, service credits |
| Izlazak (reversibility) | izvoz podataka, formati, rokovi brisanja, pomoć pri tranziciji |
| Transparentnost | trust portal, javni status usluga, objavljivanje izvještaja |
| Upravljanje ključevima | podrška za CMK/BYOK/HYOK, FIPS validacija HSM-ova |
| Penetration testing | politika provajdera o testiranju koje radi customer |

### Kako čitati ISO 27001 sertifikat

- provjeri **ko je izdao** sertifikat i da li je certifikaciono tijelo akreditovano,
- provjeri **obim** (scope): koje lokacije, usluge i procesi su uključeni,
- provjeri **datum važenja** (ciklus je tri godine, uz godišnje nadzorne audite),
- zatraži **Statement of Applicability** da vidiš koje kontrole Aneksa A su uključene ili isključene i zašto,
- sertifikat potvrđuje da **sistem upravljanja** postoji i radi, ali ne detaljno testira efikasnost svake kontrole kao SOC 2 Type II.

## Primjer scenarija: izbor SaaS provajdera za zdravstvo

Bolnica bira SaaS za zakazivanje pregleda koji obrađuje zdravstvene podatke građana EU.

1. **Kriteriji**: GDPR (posebne kategorije podataka), data residency u EU, šifrovanje sa customer-managed ključem, dostupnost 99,9%, pravo na izvoz podataka.
2. **Dokazi**: ISO 27001 + 27017 + 27018 sertifikati sa SoA, SOC 2 Type II (Security, Availability, Confidentiality, Privacy), STAR Level 2, DPA (data processing agreement) i lista podizvođača.
3. **Verifikacija**: SOC 2 koristi carve-out za IaaS → bolnica pribavlja SOC 2 IaaS provajdera; izvještaj ima jedan izuzetak u reviziji pristupa → traži plan sanacije; CUEC traže da bolnica uključi SSO i MFA → bolnica to preuzima.
4. **Odluka**: provajder se prihvata uz ugovorne klauzule o obavještavanju o incidentu u 24 sata, izvozu podataka i godišnjem dostavljanju novih izvještaja.

## AI/ML u cloud sigurnosti: osnovni pojmovi

| Pojam | Značenje |
|---|---|
| **Artificial Intelligence (AI)** | sistemi koji izvode zadatke koji obično traže ljudsku inteligenciju |
| **Machine Learning (ML)** | podskup AI: modeli uče obrasce iz podataka |
| Supervised learning | učenje na označenim primjerima (npr. „phishing / nije phishing“) |
| Unsupervised learning | pronalaženje obrazaca bez oznaka (klasterizacija, detekcija anomalija) |
| **Generative AI / LLM** | modeli koji generišu tekst, kod, slike; veliki jezički modeli |
| Training / inference | učenje modela / korištenje naučenog modela za predviđanje |
| False positive / false negative | lažni alarm / propuštena prijetnja |
| Model drift | pad tačnosti modela kada se stvarni podaci promijene u odnosu na podatke za trening |

## Otkrivanje i analiza prijetnji pomoću AI/ML

Cloud generiše ogromne količine telemetrije (API logovi, flow logovi, DNS, endpoint, identitet). Ljudi ne mogu ručno pregledati sve, pa ML pomaže:

| Primjena | Kako ML pomaže | Primjer u praksi |
|---|---|---|
| **Detekcija anomalija** | uči normalno ponašanje i označava odstupanja | neobična API aktivnost, prijava iz nove zemlje |
| **UEBA** (User and Entity Behavior Analytics) | profili ponašanja korisnika i entiteta | insider koji odjednom preuzima velike količine podataka |
| Klasifikacija malvera i phishinga | supervised modeli na poznatim uzorcima | email zaštita, sandbox |
| Korelacija i prioritizacija alarma | grupisanje povezanih događaja u incident, ocjena rizika | SIEM/XDR incidenti umjesto hiljada alarma |
| Threat intelligence | obrada velikih izvora indikatora | obogaćivanje alarma |
| GenAI asistenti za analitičare | sažimanje incidenata, pisanje upita, objašnjenje skripti | security copilots u SIEM-u |

Primjeri iz prakse: **Amazon GuardDuty** koristi ML i detekciju anomalija nad CloudTrailom, VPC Flow Logs i DNS logovima; **Microsoft Sentinel** i **Defender XDR** koriste UEBA i fuziju alarma; **Google Security Operations** primjenjuje slične tehnike.

Ograničenja koja ISC2 očekuje da znaš:

- ML **ne zamjenjuje** analitičara; potreban je **human-in-the-loop** za odluke sa velikim uticajem,
- modeli imaju lažno pozitivne i lažno negativne rezultate i treba ih podešavati,
- napadač može pokušati izbjeći detekciju (**adversarial evasion**) ili polako „naučiti“ model da zlonamjerno ponašanje smatra normalnim,
- kvalitet detekcije zavisi od **kvaliteta i potpunosti podataka**.

### Kako se mjeri kvalitet ML detekcije

| Metrika | Značenje | Zašto je važna |
|---|---|---|
| **Precision** | od svih alarma, koliko je stvarnih prijetnji | niska precision = zamor od alarma (alert fatigue) |
| **Recall** (detection rate) | od svih stvarnih prijetnji, koliko je otkriveno | nizak recall = propušteni napadi |
| False positive rate | udio lažnih alarma | opterećenje SOC-a |
| MTTD / MTTR | prosječno vrijeme do otkrivanja / odgovora | poslovni uticaj detekcije i automatizacije |

Precision i recall se obično međusobno isključuju: osjetljiviji model hvata više napada, ali daje i više lažnih alarma. Podešavanje praga je **poslovna odluka** zasnovana na riziku.

## Validacija i verifikacija izvora podataka

„Garbage in, garbage out“: model je onoliko dobar koliko i podaci na kojima uči i koje analizira. **Data source validation** provjerava da su podaci tačni, potpuni i odgovarajući; **verification** potvrđuje porijeklo i integritet (da podaci dolaze od onoga od koga tvrde i da nisu mijenjani).

| Prijetnja | Opis | Kontrole |
|---|---|---|
| **Data poisoning** | napadač ubacuje zlonamjerne ili pogrešne podatke u trening skup | kontrolisani izvori, validacija i čišćenje podataka, detekcija outliera, pristup samo ovlaštenima |
| Backdoor u modelu | model se ponaša normalno osim na okidaču koji zna napadač | provjera porijekla modela, testiranje, potpisani modeli |
| Pristrasni ili nereprezentativni podaci | model donosi sistematski pogrešne odluke za neke grupe | analiza skupa podataka, metrike pravičnosti |
| Nepotpuna telemetrija | logovi nisu uključeni ili su izgubljeni | provjera pokrivenosti izvora, alarmi za prekid toka logova |
| Lažirani logovi | napadač ubacuje lažne događaje da zavara analizu | integritet logova (hash, potpis, WORM), autentikacija izvora |
| Model drift | stvarnost se promijenila | kontinuirano mjerenje tačnosti, ponovni trening |

Ključni pojmovi:

- **Data provenance / lineage**: evidencija porijekla podataka i svih transformacija od izvora do modela.
- **Integritet**: hash vrijednosti i digitalni potpisi skupova podataka i modela; nepromjenjivo (WORM) skladište za logove.
- **AI supply chain**: unaprijed trenirani modeli i skupovi podataka iz javnih repozitorija su treća strana i moraju se procijeniti (npr. **AI BOM**, model cards).

> **Na ispitu:** kada ML sistem za detekciju počne propuštati očigledne napade nakon što je „naučio“ na podacima iz okruženja, prva sumnja je **data poisoning ili drift**, a NAJBOLJA kontrola je validacija i kontrola izvora podataka za trening, ne samo „bolji algoritam“.

## Security Orchestration, Automation and Response (SOAR)

**SOAR** povezuje sigurnosne alate (orchestration), automatizuje ponovljive korake (automation) i podržava upravljanje incidentima (response) kroz **playbookove**.

| Komponenta | Primjer |
|---|---|
| **Orchestration** | integracija SIEM-a, EDR-a, IAM-a, ticketing sistema i cloud API-ja |
| **Automation** | obogaćivanje alarma (whois, reputacija IP-a), izolacija instance, opoziv sesije |
| **Response** | case management, metrike (MTTD, MTTR), dokumentacija |

Tipičan playbook za kompromitovani pristupni ključ u cloudu:

1. alarm iz detekcije (npr. GuardDuty/Defender nalaz),
2. automatsko obogaćivanje (ko je vlasnik ključa, odakle su pozivi),
3. automatska deaktivacija ključa i opoziv sesija,
4. snimanje dokaza (logovi, snapshot),
5. obavještenje analitičaru i otvaranje slučaja,
6. ljudska odluka o daljim koracima (eskalacija, komunikacija).

Primjeri alata: Microsoft Sentinel (playbookovi na Logic Apps), AWS (EventBridge + Lambda/Step Functions, Security Hub automatizacije), Google SecOps SOAR, Splunk SOAR, Cortex XSOAR.

AI u SOAR-u: ML pomaže prioritizaciji i preporukama, a GenAI generiše sažetke i nacrte playbookova. Rizici: automatizovana akcija nad pogrešno klasifikovanim alarmom može ugasiti produkcijski sistem; zato se akcije sa velikim uticajem rade uz **ljudsko odobrenje**, a playbookovi se testiraju i verzionišu.

> **Na ispitu:** SOAR je NAJBOLJI odgovor kada problem glasi „analitičari su preopterećeni ponavljajućim ručnim koracima i vrijeme odgovora je predugo“. SIEM prikuplja i koreliše; SOAR **automatizuje odgovor**. Potpuno autonomne destruktivne akcije bez ljudskog nadzora nisu poželjne.

## Etička pitanja AI-ja

| Princip / problem | Opis | Kontrola |
|---|---|---|
| **Bias / pravičnost** | model sistematski diskriminiše grupe (npr. pri zapošljavanju ili kreditima) | reprezentativni podaci, testovi pravičnosti, revizija |
| **Transparentnost** | ljudi znaju da komuniciraju sa AI-jem ili da AI odlučuje | obavještenje korisnika, označavanje generisanog sadržaja |
| **Explainability** | može li se objasniti zašto je model donio odluku | objašnjivi modeli, dokumentacija (model cards) |
| **Accountability** | ko odgovara za štetu koju AI izazove | jasno vlasništvo nad modelom, governance |
| **Privatnost** | modeli mogu memorisati i otkriti lične podatke iz treninga | minimizacija, anonimizacija, kontrola šta ide u prompt |
| **Ljudski nadzor** | odluke sa značajnim uticajem ne bi smjele biti potpuno automatske | human-in-the-loop, pravo na žalbu |
| Sigurnost i zloupotreba | deepfake, automatizovani phishing, prompt injection | guardrails, monitoring zloupotrebe |
| Intelektualna svojina | podaci za trening zaštićeni autorskim pravom | provjera licenci izvora |

## Regulatorni zahtjevi za AI

| Okvir | Tip | Ključno |
|---|---|---|
| **EU AI Act** (Uredba (EU) 2024/1689) | zakon EU | pristup zasnovan na riziku: **zabranjene prakse** (npr. socijalno bodovanje, manipulacija), **visokorizični sistemi** (zapošljavanje, krediti, kritična infrastruktura) sa strogim obavezama, **ograničen rizik** (obaveze transparentnosti, npr. chatbotovi i deepfake), **minimalan rizik**; posebne obaveze za modele opšte namjene (GPAI) |
| **GDPR** | zakon EU | čl. 22: pravo da se ne bude predmet isključivo automatizovane odluke sa pravnim ili značajnim učinkom; DPIA; zakonit osnov za obradu podataka za trening |
| **NIST AI RMF 1.0** (i GenAI profil) | dobrovoljni okvir SAD | funkcije **Govern, Map, Measure, Manage** |
| **ISO/IEC 42001** | sertifikacioni standard | sistem upravljanja AI-jem (AIMS), struktura slična ISO 27001 |
| ISO/IEC 23894 | smjernice | upravljanje rizicima AI-ja |
| Sektorski propisi | razni | finansije, zdravstvo i zaštita potrošača primjenjuju postojeća pravila i na AI odluke |

Vremenski okvir EU AI Acta: stupio na snagu 1. 8. 2024; zabrane važe od 2. 2. 2025; obaveze za GPAI modele od 2. 8. 2025; obaveze za visokorizične sisteme prvobitno su bile predviđene od 2. 8. 2026, ali ih je „AI Omnibus“ (Uredba (EU) 2026/1744, na snazi od 27. 7. 2026) pomjerio: samostalni sistemi iz Aneksa III od 2. 12. 2027, sistemi ugrađeni u proizvode iz Aneksa I od 2. 8. 2028. Kao i kod GDPR-a, primjenjuje se **eksteritorijalno**: na pružaoce i korisnike čiji se sistemi koriste u EU.

Za cloud customera to znači: koristiš li AI servis provajdera (npr. managed LLM), ti si i dalje odgovoran za **svrhu i način upotrebe**, procjenu rizika, transparentnost prema korisnicima i zaštitu podataka koje šalješ modelu. Ugovorom provjeri da li provajder koristi tvoje promptove i podatke za trening svojih modela i gdje se obrada vrši.

> **Na ispitu:** banka u EU uvodi model koji automatski odbija zahtjeve za kredit. NAJBOLJI prvi korak je **procjena rizika i usklađenosti** (DPIA po GDPR-u, klasifikacija po AI Actu kao visokorizičan sistem) i obezbjeđivanje ljudskog nadzora, prije produkcijske upotrebe, a ne samo testiranje tačnosti modela.

## Shared responsibility za AI servise

| Sloj | Vlastiti model na IaaS-u | Managed model (AI PaaS) | AI funkcija u SaaS-u |
|---|---|---|---|
| Infrastruktura i GPU | CSP | CSP | CSP |
| Model (trening, zaštita, verzije) | customer | CSP (osnovni model), customer (fine-tuning) | CSP |
| Podaci za trening i kontekst (RAG) | customer | customer | customer (šta dijeli) |
| Promptovi, izlazi i guardrails | customer | zajedničko | uglavnom CSP, customer konfiguriše |
| IAM i pristup | customer | customer | customer |
| Svrha upotrebe i regulativa | customer | customer | customer |

Isti obrazac kao kod SaaS/PaaS/IaaS: što je usluga „viša“, customer kontroliše manje, ali **podaci, pristup i svrha upotrebe** uvijek ostaju njegovi.

## Prijetnje AI sistemima u cloudu

Iako je fokus 1.6 na upotrebi AI-ja, ispit može pitati i o zaštiti samih AI sistema:

| Prijetnja | Opis |
|---|---|
| **Prompt injection** | ulaz (direktan ili indirektan, npr. iz dokumenta) navodi LLM da zanemari instrukcije ili otkrije podatke |
| Sensitive information disclosure | model u odgovoru otkriva povjerljive podatke iz treninga ili konteksta |
| Model theft / extraction | krađa modela ili rekonstrukcija kroz masovne upite |
| Model inversion / membership inference | izvlačenje informacija o podacima za trening |
| Excessive agency | AI agent ima previše dozvola i može izvršiti štetne akcije |
| Data poisoning | vidi gore |

Referentni izvori: **OWASP Top 10 for LLM Applications**, **MITRE ATLAS** (taktike napada na AI sisteme), **CSA AICM**.

## Primjer scenarija: GenAI asistent u SOC-u

SOC tim želi uvesti GenAI asistenta koji sažima incidente i predlaže korake odgovora, a radi na managed LLM servisu cloud provajdera.

1. **Procjena provajdera**: da li servis koristi podatke customera za trening, gdje se obrada vrši, koje sertifikate ima (ISO 27001, SOC 2, ISO/IEC 42001).
2. **Podaci**: logovi sadrže lične podatke i tajne; uvodi se maskiranje prije slanja u prompt i minimalno zadržavanje.
3. **Validacija**: asistent smije čitati samo provjerene izvore (SIEM), a izlaz se tretira kao prijedlog.
4. **SOAR integracija**: asistent može pokrenuti samo neutralne akcije (obogaćivanje, ticket); izolacija sistema traži odobrenje analitičara.
5. **Governance**: vlasnik sistema, evidencija upotrebe, periodična procjena tačnosti i halucinacija, obuka analitičara.

## Česte zamke

| Distraktor | Zašto je pogrešan |
|---|---|
| „STAR Level 1 je nezavisni audit.“ | Level 1 je samoprocjena (CAIQ) |
| „SOC 3 daje najviše detalja za procjenu provajdera.“ | SOC 3 je javni sažetak; za procjenu treba SOC 2 Type II |
| „Viši EAL znači da je proizvod sigurniji.“ | EAL mjeri dubinu evaluacije prema ST-u |
| „FIPS 140 sertifikuje cloud uslugu u cjelini.“ | FIPS 140 validira kriptografski modul |
| „SOAR zamjenjuje SIEM.“ | SIEM prikuplja i koreliše, SOAR automatizuje odgovor; komplementarni su |
| „AI odluke su objektivne jer ih donosi mašina.“ | model nasljeđuje pristrasnost iz podataka |
| „Korištenjem AI servisa provajdera regulatorna odgovornost prelazi na njega.“ | customer ostaje odgovoran za svrhu i upotrebu |

## Rezime

- Procjena CSP-a: **kriteriji → dokazi → verifikacija → praznine → kontinuirano praćenje**. Povjerenje se gradi preko **nezavisnih trećih strana**.
- Standardi za organizaciju/uslugu: **ISO 27001** (+ 27017 cloud, 27018 PII, 27701 privatnost), **SOC 2 Type II**, **CSA STAR** (Level 1 samoprocjena, Level 2 audit, Level 3 kontinuirano) na osnovu **CCM** i **CAIQ**, PCI DSS, FedRAMP, C5.
- Kod SOC 2 provjeri **obim, izuzetke, CUEC i carve-out**; za istekao izvještaj traži **bridge letter**.
- Sertifikacija proizvoda: **Common Criteria** (ISO/IEC 15408, EAL1–7, PP, ST, TOE) i **FIPS 140** (Level 1–4; Level 3 = tamper-response). **FIPS 140-3** je zamijenio 140-2; 140-2 sertifikati idu na historical listu 21. 9. 2026.
- AI/ML u detekciji: anomalije, **UEBA**, korelacija; ograničenja: lažni rezultati, evasion, potreba za ljudskim nadzorom.
- **Validacija izvora podataka**: provenance/lineage, integritet, zaštita od **data poisoninga**, praćenje drifta.
- **SOAR**: orchestration + automation + response kroz playbookove; destruktivne akcije uz ljudsko odobrenje.
- Etika: **bias, transparentnost, explainability, accountability, privatnost, ljudski nadzor**.
- Regulativa: **EU AI Act** (pristup po riziku), **GDPR čl. 22**, **NIST AI RMF** (Govern, Map, Measure, Manage), **ISO/IEC 42001**. Customer ostaje odgovoran za upotrebu AI-ja.
