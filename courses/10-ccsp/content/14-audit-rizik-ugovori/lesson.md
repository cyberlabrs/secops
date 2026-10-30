## Ciljevi ispita: 6.3, 6.4 i 6.5

Ovaj modul zatvara domen 6 (**Legal, Risk and Compliance**, 13%) i cijeli ispit:

- **6.3 Understand audit processes, methodologies, and required adaptations for a cloud environment**: interne i eksterne audit kontrole, uticaj audit zahtjeva, izazovi assurancea zbog virtualizacije i clouda, tipovi audit izvještaja (SSAE, SOC, ISAE), ograničenja u izjavama o obimu (restrictions of audit scope statements), gap analiza (control analysis, baselines, risk and control self-assessment), planiranje audita, interni ISMS, interni sistem kontrola informacione sigurnosti, politike (organizacione, funkcionalne, cloud), identifikacija i uključivanje stakeholdera, posebni zahtjevi visoko regulisanih industrija (NERC CIP, HIPAA, HITECH, PCI), uticaj distribuiranog IT modela (različite lokacije, prelazak pravnih jurisdikcija),
- **6.4 Understand implications of cloud to enterprise risk management**: procjena programa upravljanja rizikom provajdera (kontrole, metodologije, politike, risk profile, risk appetite), razlika između uloga nad podacima (owner, controller, custodian, processor, steward), zahtjevi regulatorne transparentnosti (breach notification, SOX, GDPR), tretman rizika (avoid, mitigate, transfer, share, accept), različiti okviri rizika, metrike za upravljanje rizikom, procjena okruženja rizika (service, vendor, infrastructure, business),
- **6.5 Understand outsourcing and cloud contract design**: poslovni zahtjevi (SLA, MSA, SOW), upravljanje dobavljačima (vendor assessments, vendor lock-in, vendor viability, escrow), upravljanje ugovorima (right to audit, metrics, definitions, termination, litigation, assurance, compliance, access to cloud/data, cyber risk insurance, data ownership, security requirements) i upravljanje lancem snabdijevanja (ISO/IEC 27036).

> **Na ispitu:** u cloudu korisnik gotovo nikad ne može sam auditovati data centar provajdera. Ispravan odgovor na „kako dobiti assurance o kontrolama CSP-a“ je skoro uvijek **nezavisni izvještaj treće strane** (SOC 2 Type II, ISO/IEC 27001 certifikat, CSA STAR) uz ugovorna prava, a ne lična posjeta ili vlastiti pentest infrastrukture provajdera.

## Interni i eksterni audit (6.3)

| | **Interni audit** | **Eksterni audit** |
|---|---|---|
| Ko | Zaposleni ili ugovoreni auditori koji izvještavaju komitet za reviziju (audit committee) | Nezavisna firma (CPA, certifikaciono tijelo, QSA) |
| Svrha | Pomoć upravi: efikasnost kontrola, upravljanje rizikom, priprema za eksterni audit | Nezavisno mišljenje za treće strane: regulatore, kupce, investitore |
| Nezavisnost | Organizaciona (izvještava odbor, ne IT) | Potpuna, propisana standardima |
| Rezultat | Interni izvještaj, preporuke | Mišljenje (opinion), certifikat, SOC izvještaj, ROC |
| Učestalost | Prema planu zasnovanom na riziku | Godišnje ili prema regulativi / certifikacionom ciklusu |

**Model tri linije** (IIA): prva linija su operativni menadžeri koji posjeduju rizik i kontrole, druga linija su funkcije rizika i usklađenosti (compliance, CISO kao nadzor), treća linija je interni audit sa nezavisnim uvjeravanjem. Eksterni auditori i regulatori su van tog modela.

**Interne audit kontrole** su kontrole kojima organizacija sama provjerava sebe (nadzor, logovanje, periodične provjere pristupa, CSPM, interni audit). **Eksterne audit kontrole** su one koje provjerava nezavisna strana i za koje izdaje mišljenje.

### Interni sistem kontrola i ISMS

**ISMS** (Information Security Management System) po **ISO/IEC 27001:2022** je sistem upravljanja zasnovan na riziku i ciklusu Plan-Do-Check-Act:

| Klauzula | Sadržaj |
|---|---|
| 4 Context | Kontekst, zainteresovane strane, obim (scope) ISMS-a, uključujući cloud usluge |
| 5 Leadership | Opredijeljenost uprave, politika, uloge |
| 6 Planning | Procjena i tretman rizika, Statement of Applicability (SoA), ciljevi |
| 7 Support | Resursi, kompetencije, svijest, dokumentacija |
| 8 Operation | Sprovođenje tretmana rizika |
| 9 Performance evaluation | Mjerenje, **interni audit**, preispitivanje od strane uprave |
| 10 Improvement | Neusklađenosti, korektivne mjere, stalno poboljšanje |

Annex A ima 93 kontrole u četiri teme (organizacione, ljudske, fizičke, tehnološke), uključujući kontrolu 5.23 o sigurnosti korištenja cloud usluga. **ISO/IEC 27017** dodaje cloud-specifične smjernice, a **ISO/IEC 27018** zaštitu PII (modul 13).

**Interni sistem kontrola informacione sigurnosti** je širi pojam: sve preventivne, detektivne i korektivne kontrole (administrativne, tehničke, fizičke) kroz koje organizacija upravlja rizikom. Okviri: COSO Internal Control (za finansijsko izvještavanje), COBIT (upravljanje IT-om), NIST SP 800-53, CSA CCM.

### Politike

| Nivo | Primjeri | Ko odobrava |
|---|---|---|
| **Organizacione** | Krovna politika informacione sigurnosti, politika upravljanja rizikom | Uprava / odbor |
| **Funkcionalne** | Klasifikacija podataka, kontrola pristupa, prihvatljivo korištenje, upravljanje incidentima, backup, kriptografija | CISO / vlasnici funkcija |
| **Cloud computing politike** | Koji modeli i provajderi su dozvoljeni, odobravanje novih cloud servisa, klasifikacija podataka dozvoljena u cloudu, obavezni guardraili, shadow IT | CISO + IT + pravna služba |

Cloud politika mora pratiti postojeće organizacione politike, a ne ih zamijeniti. Tipičan problem je **shadow IT**: poslovne jedinice same ugovaraju SaaS kreditnom karticom, mimo procjene rizika i politike.

## Uticaj audit zahtjeva i izazovi assurancea u cloudu (6.3)

Audit zahtjevi utiču na izbor provajdera, arhitekturu i ugovor: ako regulator traži dokaze o kontrolama, korisnik mora unaprijed obezbijediti logove, izvještaje i pravo na informacije.

| Izazov virtualizacije i clouda | Zašto je problem | Kako se rješava |
|---|---|---|
| Nema fizičkog pristupa | Auditor ne može obići data centar | Izvještaji treće strane (SOC 2, ISO 27001), CSA STAR |
| Multitenancy | Audit jednog korisnika ne smije otkriti druge | Provajder dozvoljava samo agregirane izvještaje |
| Efemerni resursi | Uzorkovanje servera koji postoje minutama | Audit konfiguracije i IaC-a, kontinuirani nadzor, logovi |
| Hipervizor i skriveni slojevi | Korisnik ne vidi kontrole ispod svoje granice | Shared responsibility matrica, izvještaji CSP-a |
| Brze promjene | Izvještaj star 9 mjeseci možda ne odražava stanje | **Bridge (gap) letter**, kontinuirani audit, automatizovani dokazi |
| Podizvođači CSP-a | Kontrole su kod četvrte strane | Inclusive vs carve-out metod, CSOC |
| Distribuirani IT i jurisdikcije | Podaci i timovi u više država | Pravna analiza, lokalni zahtjevi, više audita |

## Tipovi audit izvještaja (6.3)

U SAD standarde atestacije donosi AICPA (**SSAE**, Statements on Standards for Attestation Engagements, trenutno SSAE 18 i kasniji dopuni), a međunarodno IAASB (**ISAE**). Na njima se zasnivaju **SOC** (System and Organization Controls; ranije Service Organization Control) izvještaji.

| Izvještaj | Standard | Fokus | Publika |
|---|---|---|---|
| **SOC 1** | SSAE 18 (AT-C 320); međunarodno **ISAE 3402** | Kontrole relevantne za finansijsko izvještavanje korisnika (ICFR) | Ograničena: korisnici usluge i njihovi finansijski auditori |
| **SOC 2** | SSAE 18 (AT-C 205) uz Trust Services Criteria; međunarodno ISAE 3000 | Security (obavezno), Availability, Processing Integrity, Confidentiality, Privacy | Ograničena: korisnici, potencijalni korisnici i drugi koji razumiju sistem, obično uz NDA |
| **SOC 3** | Isti kriterijumi kao SOC 2 | Sažetak, bez detalja testova | Opšta upotreba (general use), može biti javno objavljen |

| Tip | Šta pokazuje |
|---|---|
| **Type I** | Opis sistema i **dizajn** kontrola u jednoj tački vremena |
| **Type II** | Dizajn i **operativna efikasnost** kontrola kroz period (obično 6 do 12 mjeseci), uz testove auditora |

Elementi SOC 2 izvještaja koje cloud korisnik treba čitati: mišljenje auditora (unqualified, qualified, adverse, disclaimer), opis sistema i granice (šta je u obimu), period, izuzeci (exceptions) u testovima, **CUEC** (complementary user entity controls: kontrole koje korisnik mora sam provesti da bi kontrole provajdera bile efikasne) i odnos prema podizvođačima.

**Inclusive vs carve-out**: kod inclusive metode kontrole podizvođača (npr. colocation data centra) su u izvještaju; kod carve-out metode su isključene, pa korisnik mora tražiti poseban izvještaj podizvođača.

### Ostali oblici assurancea

| Oblik | Opis |
|---|---|
| **ISO/IEC 27001 certifikat** | Certifikaciono tijelo potvrđuje ISMS; važi tri godine uz godišnje nadzorne audite. Pročitati **obim** i **SoA** |
| **CSA STAR** | Level 1: samoprocjena (CAIQ, javno u STAR registru); Level 2: treća strana (STAR Certification uz ISO 27001, STAR Attestation uz SOC 2); viši nivo: kontinuirani nadzor |
| **PCI DSS AOC / ROC** | Attestation of Compliance i Report on Compliance koje izdaje QSA |
| **FedRAMP** | Autorizacija za US federalne agencije (Low, Moderate, High) |
| **Nacionalne šeme** | Npr. BSI C5 (Njemačka), ENS (Španija), sektorske šeme u EU |

> **Na ispitu:** potencijalni kupac želi detaljan dokaz da su sigurnosne kontrole provajdera radile efikasno tokom prošle godine → **SOC 2 Type II**. Javni marketing dokaz → SOC 3. Kontrole za finansijske izvještaje kupca → SOC 1. Samo dizajn u jednom danu → Type I.

## Ograničenja izjava o obimu (6.3)

**Scope statement** u SOC/ISAE izvještaju precizno kaže šta je auditovano. Sve van toga nije pokriveno, a korisnici često pogrešno pretpostavljaju da „SOC 2 provajdera“ pokriva sve njegove servise.

Tipična ograničenja:

- samo određeni servisi, regioni ili data centri,
- samo određeni Trust Services kriterijumi (npr. samo Security, bez Privacy),
- određen period (Type II) ili datum (Type I),
- carve-out podizvođača,
- pretpostavljene CUEC kontrole na strani korisnika,
- **ograničenje upotrebe (restricted use)**: SOC 1 i SOC 2 su namijenjeni određenim korisnicima i ne smiju se dalje distribuirati bez odobrenja; SOC 3 je za opštu upotrebu,
- izjava auditora o odgovornosti uprave za opis sistema i o inherentnim ograničenjima kontrola.

Primjer: provajder ima SOC 2 Type II za IaaS u EU, ali novi AI servis i region u Aziji su lansirani nakon perioda. Za te servise izvještaj **ne daje** uvjeravanje: treba tražiti bridge letter, sljedeći izvještaj ili drugu potvrdu.

## Gap analiza (6.3)

**Gap analiza** upoređuje trenutno stanje sa ciljnim (standard, regulativa, baseline) i daje listu nedostataka za tretman.

| Tehnika | Opis |
|---|---|
| **Control analysis** | Za svaku zahtijevanu kontrolu: postoji li, je li dizajnirana ispravno, radi li efikasno |
| **Baseline** | Poređenje sa minimalnim skupom kontrola (npr. CIS Benchmarks, CSA CCM, interni cloud baseline, NIST SP 800-53 baseline) |
| **Risk and Control Self-Assessment (RCSA)** | Vlasnici procesa sami procjenjuju rizike i kontrole kroz radionice ili upitnike; jeftino i uključuje prvu liniju, ali je manje objektivno |

Gap analiza se često radi prije certifikacije (npr. prije ISO 27001 audita) i prije migracije u cloud (šta provajder pokriva, šta korisnik mora dodati). Nezavisan izvođač daje objektivnost; interni tim bolje zna kontekst.

## Planiranje audita i stakeholderi (6.3)

Tipične faze audit plana:

1. **Definisati ciljeve** (npr. usklađenost sa PCI DSS-om, efikasnost IAM kontrola u cloudu).
2. **Definisati obim**: sistemi, lokacije, servisi, period, uključeni provajderi, kriterijumi; identifikovati šta pokrivaju izvještaji CSP-a.
3. **Sprovesti audit**: prikupljanje dokaza (intervjui, dokumentacija, testovi, automatizovani dokazi iz cloud API-ja), uzorkovanje.
4. **Izvještavanje i praćenje**: nalazi, preporuke, plan korektivnih mjera, lessons learned i prilagođavanje sljedećeg plana.

Stakeholderi koje treba identifikovati i uključiti: uprava i audit committee, vlasnici poslovnih procesa i podataka, IT i cloud operacije, CISO, DPO, pravna služba, nabavka (ugovori sa CSP-om), cloud provajder (dostupnost izvještaja, kontakti), eksterni auditori, regulatori. Cloud uvodi nove stakeholdere (CSP, broker, MSP) čija saradnja mora biti ugovorena.

## Visoko regulisane industrije (6.3)

| Zahtjev | Industrija | Cloud implikacije |
|---|---|---|
| **NERC CIP** | Elektroenergetski sistem Sjeverne Amerike (bulk electric system) | Kategorizacija sistema po uticaju, zaštita BES Cyber System Information (BCSI), upravljanje pristupom i osobljem, fizička i elektronska perimetarska zaštita; korištenje clouda za BCSI je dozvoljeno uz stroge kontrole, a za operativne sisteme je vrlo ograničeno |
| **HIPAA** | Zdravstvo SAD | BAA sa CSP-om, Security Rule (administrativne, fizičke, tehničke mjere), procjena rizika, audit logovi pristupa ePHI |
| **HITECH** | Zdravstvo SAD | Proširuje HIPAA na business associates, pojačava kazne i uvodi Breach Notification Rule (pojedinci bez nepotrebnog odlaganja, najkasnije 60 dana; HHS; mediji ako je pogođeno više od 500 osoba u državi) |
| **PCI DSS** (v4.0.1) | Svi koji obrađuju kartične podatke | 12 zahtjeva, smanjenje obima (cardholder data environment), QSA i ROC ili SAQ, provajder kao TPSP mora dati AOC i jasnu podjelu odgovornosti (responsibility matrix) |
| **SOX** | Javne kompanije u SAD | Kontrole nad sistemima koji utiču na finansijske izvještaje; SOC 1 izvještaji provajdera |
| **DORA / NIS2** | EU finansije / esencijalni i važni subjekti | Upravljanje ICT rizikom trećih strana, registar ugovora (DORA register of information), testiranje otpornosti, prijava incidenata |

## Distribuirani IT model (6.3)

Kad su podaci, provajderi, timovi i korisnici u više država, audit mora uzeti u obzir:

- različite zakone o privatnosti i lokalizaciji (modul 13),
- različite audit standarde i prihvatljive dokaze (SSAE vs ISAE, nacionalne šeme),
- prava pristupa auditora podacima u drugoj državi,
- vremenske zone i jezike za intervjue i dokumentaciju,
- konsolidaciju nalaza na nivou grupe, a ne samo pojedinačnih entiteta.

> **Na ispitu:** prije oslanjanja na izvještaj provajdera, auditor (i korisnik) mora provjeriti **obim, period, mišljenje, izuzetke i CUEC**. Izvještaj koji ne pokriva servis ili region koji koristiš nije dokaz za taj servis.

## Upravljanje rizikom preduzeća i cloud (6.4)

**Enterprise Risk Management (ERM)** je upravljanje svim rizicima organizacije na integrisan način. Cloud rizik je dio ERM-a: odluka da se usluga preseli u cloud mijenja profil rizika (manje vlastite infrastrukture, više zavisnosti od dobavljača, novi pravni rizici).

### Procjena programa upravljanja rizikom provajdera

| Šta se procjenjuje | Pitanja i dokazi |
|---|---|
| **Kontrole** | Postoje li i rade li (SOC 2 Type II, ISO 27001 SoA, CSA CCM/CAIQ odgovori) |
| **Metodologije** | Koji okvir rizika CSP koristi (ISO 31000, ISO/IEC 27005, NIST), koliko često procjenjuje rizik |
| **Politike** | Sigurnosne, privatnosti, incidenata, podizvođača; usklađenost sa politikama korisnika |
| **Risk profile** | Koncentracija rizika, istorija incidenata, finansijska stabilnost, geopolitički rizici |
| **Risk appetite** | Koliki rizik CSP prihvata; mora biti kompatibilan sa apetitom korisnika (npr. CSP brzo uvodi beta servise, a banka ima nizak apetit) |

**Risk appetite** je količina rizika koju je organizacija spremna prihvatiti u ostvarivanju ciljeva (strateški nivo). **Risk tolerance** je prihvatljivo odstupanje za konkretan cilj ili metriku. **Risk capacity** je maksimum koji organizacija može podnijeti.

## Uloge nad podacima (6.4)

| Uloga | Odgovornost | Cloud primjer |
|---|---|---|
| **Data owner** | Krajnja odgovornost (accountability) za podatke: klasifikacija, ko smije pristupiti, retencija | Direktor HR-a za podatke zaposlenih |
| **Data controller** | Pravni pojam (GDPR): određuje svrhu i način obrade ličnih podataka | Kompanija koja koristi SaaS HR sistem |
| **Data processor** | Obrađuje lične podatke u ime kontrolera, po uputstvima | SaaS provajder HR sistema |
| **Data custodian** | Svakodnevno čuvanje i tehnička zaštita: backup, šifrovanje, pristup, prema zahtjevima vlasnika | IT/cloud operacije korisnika ili CSP za slojeve koje upravlja |
| **Data steward** | Kvalitet, značenje, metapodaci, upravljanje podacima (data governance) u ime vlasnika | Poslovni analitičar odgovoran za tačnost matičnih podataka |
| **Data subject** | Lice na koje se lični podaci odnose | Zaposleni |

Ključne nijanse: owner je **poslovna** uloga i ostaje u organizaciji korisnika; custodian sprovodi zaštitu, ali ne odlučuje o klasifikaciji; processor po GDPR-u ne smije koristiti podatke za vlastite svrhe; odgovornost (accountability) se **ne prenosi** na provajdera ugovorom.

## Zahtjevi regulatorne transparentnosti (6.4)

| Zahtjev | Šta traži | Rok / ključ |
|---|---|---|
| **GDPR breach notification** | Prijava nadzornom organu; obavještenje ispitanika kod visokog rizika | 72 h nadzornom organu gdje je izvodljivo; ispitanicima bez nepotrebnog odlaganja |
| **GDPR transparentnost** (čl. 12–14) | Jasne informacije o obradi, svrhama, primaocima, prenosima, pravima | Pri prikupljanju podataka |
| **SOX** (Sarbanes-Oxley) | Sekcija 302: CEO i CFO lično potvrđuju tačnost izvještaja i kontrola; sekcija 404: procjena interne kontrole nad finansijskim izvještavanjem (ICFR) i mišljenje eksternog auditora za veće kompanije | Godišnje; cloud sistemi koji utiču na finansije su u obimu |
| **US državni zakoni o povredi** | Sve savezne države imaju zakone o obavještavanju | Različiti rokovi i pragovi |
| **HIPAA/HITECH** | Pojedinci, HHS, mediji | Najkasnije 60 dana |
| **SEC** | Materijalni sajber incidenti javnih kompanija | Četiri radna dana od utvrđivanja materijalnosti |
| **NIS2 / DORA** | Značajni / veliki ICT incidenti | Faze: rano obavještenje, srednji, završni izvještaj |

Cloud implikacija: korisnik ne može ispuniti rokove bez **ugovorne obaveze CSP-a** da ga brzo obavijesti i da mu da potrebne informacije.

## Tretman rizika (6.4)

| Strategija | Opis | Cloud primjer |
|---|---|---|
| **Avoid** (izbjegavanje) | Ne raditi aktivnost koja stvara rizik | Ne seliti posebne kategorije podataka u javni cloud |
| **Mitigate / reduce** (ublažavanje) | Kontrole smanjuju vjerovatnoću ili uticaj | Šifrovanje sa ključevima korisnika, multi-region arhitektura |
| **Transfer** (prenos) | Finansijske posljedice prelaze na treću stranu | Cyber osiguranje, ugovorne naknade štete |
| **Share** (dijeljenje) | Rizik i odgovornost se dijele | Shared responsibility model, zajednički poduhvat |
| **Accept** (prihvatanje) | Svjesno prihvatanje preostalog rizika unutar apetita, uz odobrenje vlasnika rizika | Prihvatanje rizika kratkog prekida ne-kritičnog SaaS-a |

Važno: **odgovornost (accountability) se ne može prenijeti**. Osiguranje prenosi finansijski gubitak, ali reputaciju i zakonsku odgovornost kontrolera ne. Prihvatanje rizika mora biti formalno, dokumentovano i od strane ovlaštene osobe (vlasnika rizika), ne od tehničkog osoblja.

## Okviri rizika (6.4)

| Okvir | Karakteristika |
|---|---|
| **ISO 31000:2018** | Opšti principi i proces upravljanja rizikom za svaku organizaciju |
| **ISO/IEC 27005:2022** | Upravljanje rizikom informacione sigurnosti, podrška ISO 27001 |
| **NIST SP 800-37 Rev. 2 (RMF)** | Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor |
| **NIST SP 800-30 Rev. 1** | Vodič za sprovođenje procjene rizika |
| **NIST CSF 2.0** (2024) | Funkcije Govern, Identify, Protect, Detect, Respond, Recover; Govern uključuje upravljanje rizikom lanca snabdijevanja |
| **COSO ERM** (2017) | Integracija rizika sa strategijom i performansama |
| **ENISA Cloud Computing Risk Assessment** | Katalog cloud rizika (npr. lock-in, gubitak upravljanja, izolacija, usklađenost) |
| **FAIR** | Kvantitativna analiza rizika u novčanim iznosima |
| **NIST AI RMF 1.0** i **ISO/IEC 23894** | Upravljanje rizicima AI sistema (Govern, Map, Measure, Manage kod NIST-a) |
| **CSA CCM** | Matrica cloud kontrola mapirana na druge okvire |

## Metrike za upravljanje rizikom (6.4)

| Metrika | Šta mjeri | Primjer |
|---|---|---|
| **KRI** (Key Risk Indicator) | Rano upozorenje o rastu rizika | Broj javno izloženih bucketa, kritične ranjivosti starije od 30 dana |
| **KPI** (Key Performance Indicator) | Uspješnost procesa | Procenat sistema zakrpljenih u SLA roku |
| **KCI** (Key Control Indicator) | Efikasnost kontrole | Procenat naloga sa MFA, uspješni testovi restore-a |
| **SLE** = AV × EF | Očekivani gubitak jednog događaja | Vrijednost 200.000 × izloženost 25% = 50.000 |
| **ALE** = SLE × ARO | Godišnji očekivani gubitak | 50.000 × 0,5 = 25.000 godišnje |
| Residual risk | Rizik nakon kontrola | Mora biti unutar apetita |

Dobre metrike su mjerljive, relevantne za poslovanje, uporedive kroz vrijeme i povezane sa vlasnikom. Upravi se prikazuju trendovi i odnos prema apetitu, a ne sirove tehničke brojke.

## Procjena okruženja rizika (6.4)

| Dimenzija | Šta se gleda |
|---|---|
| **Service** | Kritičnost usluge za poslovanje, model (IaaS/PaaS/SaaS), SLA, zrelost servisa (GA vs preview) |
| **Vendor** | Finansijska stabilnost, reputacija, certifikati, istorija incidenata, podizvođači, koncentracija (previše usluga kod jednog provajdera) |
| **Infrastructure** | Lokacije data centara, redundantnost, izolacija tenanata, fizička sigurnost |
| **Business** | Regulatorni zahtjevi, uticaj prekida, strateški rizik lock-ina, reputacija |

> **Na ispitu:** kada pitanje traži šta menadžer radi PRVO prije izbora provajdera ili migracije, ispravan odgovor je najčešće **procjena rizika** u odnosu na poslovne zahtjeve i apetit, a tek onda izbor kontrola ili potpisivanje ugovora.

## Ugovori i outsourcing: poslovni zahtjevi (6.5)

| Dokument | Svrha | Sadržaj |
|---|---|---|
| **MSA** (Master Service Agreement) | Krovni ugovor koji uređuje cijeli odnos | Opšti uslovi, odgovornost, povjerljivost, intelektualna svojina, nadležnost, raskid |
| **SOW** (Statement of Work) | Konkretan posao ili projekat pod MSA-om | Opseg, isporučevine, rokovi, cijena, prihvatanje |
| **SLA** (Service-Level Agreement) | Mjerljiv nivo usluge | Dostupnost (npr. 99,9%), vrijeme odziva podrške, RTO/RPO, način mjerenja, isključenja, service credits |
| **OLA** (Operational-Level Agreement) | Interni dogovor između timova koji podržava SLA | Npr. mrežni tim garantuje vrijeme intervencije |
| **DPA / BAA** | Zaštita ličnih / zdravstvenih podataka | GDPR čl. 28 / HIPAA |
| **AUP** (Acceptable Use Policy) | Šta korisnik smije raditi na usluzi | Zabrane zloupotrebe |

Nijanse SLA-a u cloudu: SLA javnih provajdera je standardizovan i rijetko se pregovara; **service credits** (popust na račun) obično su jedini pravni lijek i ne pokrivaju stvarnu poslovnu štetu; dostupnost od 99,9% znači oko 8,8 sati prekida godišnje, a 99,99% oko 53 minuta. Korisnik zato dizajnira arhitekturu za vlastite ciljeve (multi-AZ, multi-region), a ne oslanja se samo na SLA.

## Upravljanje dobavljačima (6.5)

| Aktivnost | Sadržaj |
|---|---|
| **Vendor assessment** | Due diligence prije ugovora i periodično: upitnici (CSA CAIQ, SIG), SOC 2 / ISO izvještaji, finansijska analiza, reference, procjena podizvođača; dubina po kritičnosti (tiering) |
| **Vendor lock-in** | Zavisnost od vlasničkih servisa, formata i API-ja koja otežava prelazak; ublažava se otvorenim standardima, kontejnerima, IaC-om, apstrakcijom, exit planom, provjerom prenosivosti podataka i pravima iz EU Data Act-a |
| **Vendor viability** | Može li dobavljač opstati: finansijska stabilnost, tržišna pozicija, rizik preuzimanja ili gašenja servisa |
| **Escrow** | Treća strana (escrow agent) čuva izvorni kod, podatke ili dokumentaciju i predaje ih korisniku kod definisanih događaja (stečaj, prestanak podrške) |

Kod SaaS-a je klasični source code escrow često manje koristan (nema infrastrukture da se kod pokrene), pa se kombinuje sa redovnim exportom podataka i **SaaS escrow** rješenjima koja čuvaju i okruženje.

## Upravljanje ugovorima: ključne klauzule (6.5)

| Klauzula | Šta osigurava | Napomena za cloud |
|---|---|---|
| **Right to audit** | Pravo korisnika ili njegovog auditora da provjeri kontrole | CSP-ovi ga obično zamjenjuju izvještajima treće strane; regulisani sektori (DORA, EBA) traže pravo na pristup i audit |
| **Metrics** | Šta se mjeri i kako (dostupnost, vrijeme odziva, MTTR) | Ko mjeri i odakle; korisnik treba vlastiti nadzor |
| **Definitions** | Precizno značenje pojmova („dostupnost“, „incident“, „podaci korisnika“, „prekid“) | Nejasna definicija dostupnosti poništava SLA |
| **Termination** | Raskid zbog kršenja ili bez razloga, otkazni rok, pomoć pri tranziciji | Povrat podataka u upotrebljivom formatu u roku, zatim potvrđeno brisanje |
| **Litigation** | Merodavno pravo, nadležni sud, arbitraža, ograničenje odgovornosti, obeštećenje (indemnification) | Spor sa globalnim CSP-om pred stranim sudom je skup |
| **Assurance** | Koje izvještaje i certifikate CSP dostavlja i koliko često | SOC 2 Type II godišnje, bridge letter |
| **Compliance** | Usklađenost sa zakonima i standardima, obaveza obavještavanja o promjenama | Npr. PCI DSS AOC, ISO 27001, GDPR |
| **Access to cloud/data** | Dostupnost podataka u svakom trenutku, uključujući tokom spora i nakon raskida | Zabrana zadržavanja podataka kao sredstva pritiska |
| **Cyber risk insurance** | Obaveza dobavljača da ima osiguranje i minimalni iznos | Korisnik zasebno procjenjuje vlastitu polisu |
| **Data ownership** | Korisnik ostaje vlasnik podataka; CSP ih ne smije koristiti za druge svrhe | Uključiti metapodatke, logove i izvedene podatke; zabrana treniranja AI na podacima korisnika |
| **Security requirements** | Minimalne kontrole: šifrovanje, IAM, logovanje, prijava incidenata u roku, podizvođači, lokacija | Flow-down na podizvođače |

> **Na ispitu:** najveći rizik pri raskidu ugovora sa cloud provajderom je **gubitak pristupa podacima ili nemogućnost prenosa**. Najbolja zaštita su klauzule o povratu podataka u dogovorenom formatu i roku, pomoći pri tranziciji i potvrđenom brisanju, uz testiran exit plan.

## Upravljanje lancem snabdijevanja (6.5)

**ISO/IEC 27036** (Information security for supplier relationships):

| Dio | Sadržaj |
|---|---|
| **27036-1** | Pregled i koncepti odnosa sa dobavljačima |
| **27036-2** | Zahtjevi za definisanje, sprovođenje i nadzor sigurnosti u odnosima sa dobavljačima |
| **27036-3** | Smjernice za sigurnost lanca snabdijevanja hardvera, softvera i usluga (ICT supply chain) |
| **27036-4** | Smjernice za sigurnost cloud usluga |

Životni ciklus odnosa sa dobavljačem: planiranje (procjena potrebe i rizika), izbor dobavljača, ugovaranje, upravljanje odnosom (nadzor, audit, promjene), završetak (povrat podataka, opoziv pristupa).

Cloud lanac snabdijevanja je dubok: CSP koristi podizvođače (data centri, hardver, softverske komponente), a SaaS provajder često radi na IaaS-u drugog provajdera (**četvrta strana**). Mjere:

- registar dobavljača i podizvođača, tiering po kritičnosti,
- flow-down sigurnosnih zahtjeva kroz ugovore,
- **SBOM** i provjera porijekla softvera, potpisani artefakti,
- praćenje koncentracionog rizika (mnogo kritičnih usluga kod jednog CSP-a),
- regulatorni zahtjevi: NIS2 (sigurnost lanca snabdijevanja), DORA (registar informacija o ICT ugovorima, strategija za izlazak), NIST SP 800-161 Rev. 1 (C-SCRM).

## Scenario: izbor SaaS dobavljača za obradu plata

Srednja kompanija bira SaaS za obračun plata (lični i finansijski podaci, posebne kategorije za bolovanja).

1. **Procjena rizika** (6.4): kritičnost usluge, vrsta podataka, regulative (GDPR, porezni propisi), apetit uprave.
2. **Vendor assessment**: SOC 2 Type II (provjera obima, perioda, izuzetaka, CUEC), ISO 27001 i 27701, CAIQ u STAR registru, finansijska stabilnost.
3. **DPIA** (modul 13) i analiza prenosa podataka van EU.
4. **Ugovor**: MSA + DPA + SLA; definicije dostupnosti, prijava incidenata u roku koji omogućava ispunjenje 72 h, pravo na informacije i audit kroz izvještaje, lista podizvođača sa pravom prigovora, vlasništvo nad podacima, povrat podataka u CSV/standardnom formatu u roku od 30 dana nakon raskida i potvrda brisanja, osiguranje dobavljača.
5. **Tretman preostalog rizika**: redovni export podataka (mitigate), cyber osiguranje (transfer), formalno prihvatanje preostalog rizika od strane vlasnika (accept).
6. **Nadzor**: KRI (incidenti dobavljača, kašnjenje izvještaja), godišnje preispitivanje.

## Tipične zamke na ispitu

| Tvrdnja | Ispravno |
|---|---|
| „SOC 2 provajdera pokriva sve njegove servise“ | Samo servise, regione i period iz scope statementa |
| „SOC 3 je detaljniji od SOC 2“ | SOC 3 je sažetak za opštu upotrebu, bez detalja testova |
| „Type I dokazuje da kontrole rade“ | Type I pokazuje samo dizajn u jednoj tački; efikasnost kroz period je Type II |
| „Osiguranjem smo prenijeli rizik u potpunosti“ | Prenosi se finansijski gubitak, ne accountability i reputacija |
| „Custodian odlučuje o klasifikaciji“ | O klasifikaciji odlučuje owner; custodian sprovodi zaštitu |
| „Service credits nadoknađuju štetu“ | Obično su mali popust i jedini lijek; arhitektura mora pokriti vlastite ciljeve |
| „Right to audit znači da možemo ući u data centar CSP-a“ | Kod velikih CSP-ova najčešće se ostvaruje kroz izvještaje treće strane, osim gdje regulativa traži više |

> **Na ispitu:** kad dva odgovora izgledaju tačno, a jedan je tehnička kontrola, a drugi upravljačka odluka zasnovana na riziku ili ugovoru, CCSP najčešće nagrađuje upravljački odgovor (procjena rizika, ugovorna odredba, politika), jer on određuje koje tehničke kontrole trebaju.

## Rezime

- Interni audit služi upravi, eksterni daje nezavisno mišljenje trećim stranama; model tri linije; ISMS po ISO/IEC 27001:2022 (interni audit u klauzuli 9.2).
- Politike: organizacione, funkcionalne i cloud; cloud politika slijedi krovnu, sprečava shadow IT.
- Cloud otežava assurance (nema fizičkog pristupa, multitenancy, efemerni resursi), pa se korisnik oslanja na izvještaje treće strane uz ugovorna prava.
- SOC 1 (ICFR, ISAE 3402), SOC 2 (Trust Services Criteria, ograničena upotreba), SOC 3 (opšta upotreba); Type I dizajn u tački, Type II efikasnost kroz period. Uvijek čitaj obim, period, mišljenje, izuzetke, CUEC i carve-out.
- Gap analiza: control analysis, baseline, RCSA. Planiranje audita: ciljevi, obim, sprovođenje, izvještaj i lessons learned; uključiti stakeholdere, uključujući CSP.
- Regulisane industrije: NERC CIP, HIPAA/HITECH (BAA, 60 dana), PCI DSS (QSA, AOC, podjela odgovornosti), SOX, DORA/NIS2.
- Uloge: owner (accountability), controller, processor, custodian (tehnička zaštita), steward (kvalitet i značenje).
- Transparentnost: GDPR 72 h, SOX 302/404, SEC, HIPAA; korisnik zavisi od ugovorne obaveze CSP-a da ga obavijesti.
- Tretman rizika: avoid, mitigate, transfer, share, accept; accountability se ne prenosi. Okviri: ISO 31000, 27005, NIST RMF/CSF 2.0, COSO, ENISA, FAIR, NIST AI RMF. Metrike: KRI, KPI, KCI, ALE = SLE × ARO.
- Ugovori: MSA (krovni), SOW (posao), SLA (mjerljiv nivo, service credits); klauzule za audit, definicije, raskid, sporove, vlasništvo i pristup podacima, osiguranje i sigurnosne zahtjeve.
- Upravljanje dobavljačima: assessment, lock-in, viability, escrow. Lanac snabdijevanja: ISO/IEC 27036 (dio 4 za cloud), četvrte strane, SBOM, koncentracioni rizik.
