## Ciljevi ispita: 4.5, 4.6, 4.7 i 4.8

Ovaj modul završava domen 4 (**Security Operations**, 27% ispita):

- **4.5** primijeniti koncepte upravljanja identitetom i pristupom (IAM): nalozi, SSO, federacija, MFA, modeli kontrole pristupa, lozinke i passkeys,
- **4.6** primijeniti automatizaciju i orkestraciju (skripte, SOAR, CI/CD, AI mogućnosti),
- **4.7** sažeti aktivnosti odgovora na incident (od pripreme do post-incident izvještaja),
- **4.8** koristiti podatke, artefakte i izvore u sigurnosnoj istrazi (logovi, NetFlow, pcap, memory dump, integritet, log parsing).

Ispit očekuje da u scenariju prepoznaš **tačan protokol** (SAML vs OAuth vs OIDC), **tačan model pristupa** (RBAC vs ABAC vs MAC…), **tačnu fazu** incidenta i **tačan izvor podataka** za pitanje istrage.

## 4.5 Identity and access management (IAM)

### Životni ciklus naloga

- **Provisioning** (kreiranje i dodjela pristupa): kad zaposleni dođe ili promijeni ulogu. Najbolje automatski iz HR sistema (izvor istine) prema IdP-u (npr. Entra ID, Okta) i dalje prema aplikacijama preko **SCIM**-a.
- **Deprovisioning** (ukidanje): kad zaposleni ode, **odmah** onemogući nalog, opozovi sesije i tokene, ključeve i certifikate. Zaboravljeni nalozi bivših zaposlenih (*orphaned accounts*) su čest put napada.
- **Permissions assignments and implications**: dozvole dodjeljuj prema **least privilege**. Opasnost je **privilege creep** (gomilanje dozvola kroz promjene uloga): osoba prelazi iz tima u tim i zadrži sve stare dozvole.
- **Identity proofing** (provjera identiteta): dokazivanje da je osoba ona za koju se predstavlja **prije** izdavanja naloga ili kredencijala: lična karta, video verifikacija, provjera kod HR-a. Važno i kod resetovanja MFA na help desku (meta socijalnog inženjeringa).

### Federation i SSO

- **SSO** (Single sign-on): jedna prijava daje pristup više aplikacija. Manje lozinki, centralna kontrola, ali IdP postaje vrijedna meta (zato MFA na IdP-u).
- **Federation** (federacija): povjerenje između **različitih organizacija/domena** identiteta. Korisnik se prijavljuje kod svog **IdP**-a (Identity Provider), a **SP** (Service Provider) ili RP (Relying Party) vjeruje tvrdnji. Primjer: prijava u AWS konzolu korporativnim Entra ID nalogom.

| Protokol | Namjena | Format/ključne riječi | Primjer |
|---|---|---|---|
| **SAML** 2.0 | **Autentikacija** (i atributi) za web SSO i federaciju. | XML **assertion**, potpisan; IdP i SP. | Prijava u Salesforce ili AWS konzolu preko korporativnog IdP-a. |
| **OAuth** 2.0 | **Autorizacija**: delegirani pristup resursima bez dijeljenja lozinke. | **Access token**, scopes, consent ekran. | „Aplikacija X želi pristup tvom Google kalendaru“. |
| **OIDC** (OpenID Connect) | **Autentikacija** izgrađena **na OAuth 2.0**. | **ID token** u **JWT** formatu. | „Sign in with Google/Microsoft“ u modernim web i mobilnim aplikacijama. |
| **LDAP** | Protokol za upit i izmjenu **imeničkog servisa** (directory). | TCP 389; **LDAPS** na 636 (TLS). DN, npr. `cn=Ana,ou=IT,dc=firma,dc=ba`. | Aplikacija provjerava korisnika i grupe u Active Directory. |

> **Na ispitu:** OAuth = **autorizacija** (šta aplikacija smije raditi u tvoje ime), OIDC = **autentikacija** (ko si) preko OAuth-a, SAML = XML-bazirana autentikacija za enterprise web SSO. Ako se u pitanju spominje „XML assertion“ → SAML; „access token i scope“ → OAuth; „ID token / JWT za prijavu“ → OIDC. LDAP sam po sebi nije SSO protokol nego pristup direktoriju; nešifrovan LDAP na 389 zamijeni sa LDAPS.

### Account types (vrste naloga)

| Vrsta | Opis | Kontrole |
|---|---|---|
| **User** | Standardni nalog za svakodnevni rad. | Least privilege, MFA. |
| **Privileged – Global** | Admin nad cijelim okruženjem (Domain Admin, Global Administrator, AWS root). | PAM, MFA otporan na phishing, odvojen admin nalog, minimalan broj. |
| **Privileged – Local** | Admin samo na jednom sistemu (lokalni Administrator, root na serveru). | Jedinstvena lozinka po mašini (npr. Windows LAPS), bez dijeljenja. |
| **Service** | Nalog pod kojim radi aplikacija ili servis, nije za ljude. | Bez interaktivne prijave, managed identity / gMSA, rotacija tajni, minimalne dozvole. |
| **Third-party** | Nalog za dobavljača, konsultanta, partnera. | Vremenski ograničen, nadzor sesija, gašenje po završetku ugovora. |
| **Emergency access** (*break-glass*) | Nalog za hitne situacije kada normalni pristup ne radi (IdP pao, MFA servis nedostupan). | Jaka lozinka u sefu, isključen iz politika koje bi ga mogle zaključati, **alarm na svaku upotrebu**, redovan test. |

> **Na ispitu:** „Admin dnevno čita email sa Domain Admin nalogom“ je kršenje: admini trebaju **odvojen** privilegovani nalog. „Nalog koji radi kad SSO/MFA ne radi“ = **emergency access / break-glass**.

### MFA (multifactor authentication)

Kategorije faktora:

| Kategorija | Primjeri |
|---|---|
| **Something you know** (znanje) | Lozinka, PIN, sigurnosno pitanje. |
| **Something you have** (posjedovanje) | Hard token, soft token (authenticator app), pametna kartica, telefon za SMS OTP. |
| **Something you are** (inherentnost) | Otisak prsta, lice, šarenica, glas. |
| **Somewhere you are** (lokacija) | GPS, IP geolokacija. |
| **Something you do** (ponašanje) | Ritam kucanja, način hoda. |

MFA znači faktore iz **različitih** kategorija. Lozinka + PIN su oba „know“, dakle to nije MFA.

- **Hard token**: fizički uređaj: FIDO2 sigurnosni ključ (YubiKey), privjesak koji prikazuje kod.
- **Soft token**: softver na uređaju koji generiše kod ili prima push: Microsoft Authenticator, Google Authenticator.
- **OTP** (One-time password): jednokratni kod. **HOTP** je baziran na brojaču (događaju), **TOTP** na vremenu (kod važi kratko, tipično 30 sekundi). SMS OTP je najslabija varijanta (SIM swapping, presretanje).
- **Biometrics**: pogodnost i jaka veza sa osobom, ali biometrija se **ne može promijeniti** ako procuri. Pojmovi: **FAR** (false acceptance rate, prihvatanje pogrešne osobe), **FRR** (false rejection rate, odbijanje prave osobe), **CER** (crossover error rate, tačka gdje su FAR i FRR jednaki; niži CER = tačniji sistem).
- **Backup codes**: unaprijed generisani jednokratni kodovi za oporavak kad izgubiš MFA uređaj. Čuvaj ih offline ili u password manageru; svaki važi samo jednom.

> **Na ispitu:** push notifikacije su ranjive na **MFA fatigue** (bombardovanje zahtjevima); ublažava se **number matching**-om. Najjači izbor protiv phishinga je **FIDO2/passkey** (vezan za domen, ne može se upisati na lažni sajt).

### Access control models (modeli kontrole pristupa)

| Model | Ko/šta odlučuje | Primjer |
|---|---|---|
| **Rule-based** | Globalna pravila koja važe za sve, bez obzira na korisnika. | Firewall ACL; „pristup samo iz korporativne IP mreže“. |
| **Role-based** (RBAC) | Dozvole su vezane za **ulogu** (posao), korisnik dobija ulogu. | Kubernetes `Role`/`RoleBinding`, Azure RBAC „Reader“, grupa „Računovodstvo“. |
| **Time-based** | Pristup samo u određenom vremenskom prozoru. | Logon hours u AD-u; pristup samo radnim danima 7–19h. |
| **Mandatory** (MAC) | **Sistem** na osnovu **labela** (klasifikacija i clearance); korisnik ne može mijenjati. | Vojni nivoi Secret/Top Secret, SELinux. |
| **Discretionary** (DAC) | **Vlasnik** resursa odlučuje kome daje pristup. | Linux `chmod`, NTFS dozvole koje postavlja vlasnik fajla, dijeljenje dokumenta. |
| **Just-in-time** (JIT) | Privilegija se dodjeljuje **na zahtjev, privremeno**, i automatski ističe. | Azure PIM: admin aktivira ulogu na 2 sata uz odobrenje; nema stalnih (*standing*) privilegija. |

> **Na ispitu:** „Vlasnik fajla odlučuje“ = **DAC**. „Labele i clearance, korisnik ne može promijeniti“ = **MAC**. „Pristup prema poziciji u firmi“ = **RBAC**. „Pravila za sve korisnike, npr. po IP adresi“ = **rule-based**. „Bez stalnih admin prava, aktivacija na zahtjev“ = **JIT**.

### Access management, access review

- **Authentication**: dokazivanje identiteta (prije autorizacije, koja određuje šta smiješ).
- **Policies**:
  - **Logical/technical** politike: nameće ih sistem (Conditional Access u Entra ID: „blokiraj prijavu iz nepoznatih zemalja“, „traži MFA za admin portal“; IAM policy u AWS-u; politika lozinki u GPO-u).
  - **Administrative/business** politike: pisana pravila organizacije (politika prihvatljivog korištenja, procedura za odobravanje pristupa, onboarding/offboarding proces).
- **Access review** (pregled pristupa, *recertification*): periodično vlasnici resursa ili menadžeri potvrđuju da korisnici i dalje trebaju svoje dozvole. Hvata privilege creep i zaboravljene naloge.

### Password concepts

- **Password managers**: generišu i čuvaju jedinstvene, duge lozinke za svaki servis. Rješavaju problem reuse.
- **Passwordless**: prijava bez lozinke: passkey, Windows Hello for Business, magic link, push sa biometrijom.
- **Passkey**: FIDO2/WebAuthn kredencijal na bazi **para ključeva**. Privatni ključ ostaje na uređaju (ili u sinhronizovanom sefu platforme), server čuva samo javni ključ. Otključava se biometrijom ili PIN-om, **otporan na phishing** jer je vezan za tačan domen, a server nema šta da procuri.
- **Password best practices**:

| Praksa | Smjernica |
|---|---|
| **Length** (dužina) | Najvažniji faktor; duge passphrase su jače i lakše za pamćenje. |
| **Complexity** (kompleksnost) | Savremene smjernice (NIST SP 800-63B) daju manju težinu prisilnim pravilima kombinovanja znakova od dužine i provjere protiv liste loših lozinki. Ispit i dalje poznaje complexity kao kontrolu. |
| **Reuse** (ponovna upotreba) | Zabraniti (password history); reuse omogućava **credential stuffing**. |
| **Expiration** (istek, maximum age) | Periodična promjena bez razloga se više ne preporučuje; obavezna promjena kad postoji sumnja na kompromitaciju. |
| **Age** (minimum age) | Minimalna starost sprječava da korisnik odmah promijeni lozinku više puta i vrati se na staru, zaobilazeći istoriju. |
| **Compromised credential monitoring** | Provjera lozinki/naloga protiv baza procurjelih kredencijala (npr. Have I Been Pwned, Entra ID Protection „leaked credentials“). |
| **Account auditing** | Pregled naloga i njihove aktivnosti: neaktivni nalozi, nalozi bez vlasnika, neuobičajene prijave. |
| **Policy report** | Izvještaj o usklađenosti sa politikom lozinki (koliko naloga nema MFA, ima lozinku koja nikad ne ističe…). |

> **Na ispitu:** ako korisnici mijenjaju lozinku 5 puta zaredom da bi se vratili na staru, rješenje je **minimum password age** (uz history). Ako je problem ista lozinka na više sajtova, rješenje je **password manager** (i zabrana reuse).

## 4.6 Automatizacija i orkestracija

### Use cases (primjene)

| Primjena | Primjer |
|---|---|
| **User provisioning** | Novi zaposleni u HR sistemu → automatski nalog, grupe, licence (SCIM). |
| **Resource provisioning** | Terraform/Bicep kreira mrežu, VM-ove i politike iz koda (IaC). |
| **Desired state management** | Alat stalno vraća sistem u definisano stanje: Ansible, Azure Policy, Kubernetes kontroleri, GitOps (Argo CD). Ručna izmjena (*drift*) se otkrije i ispravi. |
| **Anomaly detection** | Automatsko otkrivanje odstupanja od uobičajenog (npr. GuardDuty, UEBA). |
| **Ticket management** | Uzbuna automatski otvara, obogaćuje i dodjeljuje tiket (Jira, ServiceNow). |

### AI mogućnosti

- **Agentic**: AI agent samostalno planira i izvršava više koraka (npr. prikupi kontekst o uzbuni, pretraži logove, predloži i uz odobrenje izvrši izolaciju hosta). Treba mu stroge granice i ljudsko odobrenje za rizične akcije.
- **Chatbot**: konverzacijski interfejs, npr. analitičar pita prirodnim jezikom „prikaži sve neuspjele prijave za korisnika X“ ili korisnik prijavljuje incident.
- **Predictive analysis**: predviđanje na osnovu istorije (koji sistemi će vjerovatno biti napadnuti, koja ranjivost će se eksploatisati).
- **AI-augmented baselines**: AI uči šta je normalno ponašanje korisnika, hostova i saobraćaja i dinamički prilagođava baseline, pa tačnije prepoznaje anomalije od statičnih pragova.

### Considerations (na šta paziti)

- **Guardrails**: ograničenja šta automatizacija/AI smije uraditi (npr. agent smije izolovati najviše jedan host bez odobrenja; nikad ne briše produkcijske resurse; approval gate u pipelineu).
- **Automation logic**: greška u logici se ponavlja brzinom mašine (pogrešan playbook može izolovati pola mreže).
- **Process engineering**: prvo dobro definiši i pojednostavi proces, pa ga tek onda automatizuj; loš proces automatizovan ostaje loš.
- **Complexity**: više integracija = više stvari koje mogu pući i teže održavanje.
- **Financial**: trošak licenci, razvoja i održavanja naspram uštede.
- **Process risks**: **single point of failure** (ako SOAR padne), zastarjeli skriptovi (*technical debt*), zavisnost od jedne osobe koja razumije skriptu.
- **Deployment**: testiraj automatizaciju u staging okruženju, uvodi postepeno, imaj rollback.

### Intended outcomes, SecOps, workflows

- **Intended outcomes**: efficiency/time saving, **enforcing baselines** (svaki sistem ima istu sigurnu konfiguraciju), continuous improvements, productivity improvements, **reduced downtime**, increased proactivity (manje reakcije, više prevencije), plus manje ljudskih grešaka i brža reakcija.
- **SecOps / CI/CD**: sigurnosne provjere ugrađene u pipeline (SAST, skeniranje zavisnosti i image-a, secrets scanning, IaC skeniranje). Pipeline može **zaustaviti build** (*security gate*) ako nađe kritičan nalaz.
- **Workflows**:
  - **Automation**: jedan zadatak se izvršava bez čovjeka (skripta koja resetuje nalog).
  - **Integrations**: povezivanje alata preko API-ja (SIEM ↔ EDR ↔ ticketing ↔ chat).
  - **Orchestration** povezuje automatizovane korake u cijeli tok. **SOAR** (Security Orchestration, Automation and Response) izvršava **playbookove**: npr. phishing uzbuna → izvuci URL-ove → provjeri reputaciju → obriši poruku iz svih inboxa → blokiraj domen → otvori tiket.

> **Na ispitu:** automatizacija = **pojedinačan zadatak**, orkestracija = **povezivanje više automatizovanih zadataka i alata u tok**. Ako pitanje traži rizik automatizacije, tipični odgovori su complexity, single point of failure i technical debt. Ako traži zaštitu od AI agenta koji radi previše, odgovor je **guardrails**.

## 4.7 Odgovor na incident (incident response)

Faze prema ciljevima ispita:

| Faza | Ključne aktivnosti |
|---|---|
| **Preparation** | IR plan, uloge, alati, kontakti, obuka i testiranje. |
| **Identification** | Detekcija i potvrda da je incident stvaran, određivanje opsega. |
| **Investigation** | Forenzika, prikupljanje dokaza, chain of custody, e-discovery. |
| **Containment** | Zaustaviti širenje: izolacija/karantin. |
| **Negotiation** | Kod ransomware/iznude: pregovori (uz pravni savjet, osiguravača i specijalizovane pregovarače). |
| **Eradication/recovery** | Ukloniti uzrok (malver, nalozi napadača, ranjivost), vratiti sisteme u rad. |
| **Notification/external reporting** | Obavijestiti zainteresovane strane i nadležne. |
| **Post-incident** | Lessons learned, root cause analysis, post-incident izvještaj. |

### Preparation (priprema)

- **Training**: obuka IR tima i zaposlenih (kako prijaviti incident).
- **Testing**: provjera da plan i alati rade.
  - **Tabletop exercise**: tim za stolom **diskutuje** scenario korak po korak („šta radimo ako…“), bez diranja sistema. Jeftino, otkriva rupe u planu i ulogama.
  - **Simulation**: realističnija vježba, npr. simulirani phishing ili simulirani napad koji tim mora otkriti i obraditi.
- **Playbooks**: unaprijed definisani koraci za određeni tip incidenta (ransomware, phishing, kompromitovan cloud ključ). Mogu se automatizovati u SOAR-u.
- **Roles**: ko je incident commander, ko komunicira sa menadžmentom, pravnicima, PR-om, ko radi forenziku. CSIRT tim.

### Identification (identifikacija)

- **Detection**: uzbune iz SIEM-a, EDR-a, IDS-a, prijave korisnika.
- **Internal advisory**: interna obavještenja i upozorenja (npr. interni tim za threat intel javlja da je kampanja usmjerena na nas).
- **External advisory**: spoljna upozorenja: CERT-ovi, CISA advisories, upozorenja dobavljača, ISAC-ovi.
- **Threat hunting**: proaktivno traženje napadača koji su promakli alatima, na osnovu hipoteze („da li neko koristi PowerShell za download sa sumnjivih domena?“).

### Investigation (istraga)

- **Digital forensics**: naučno prikupljanje i analiza dokaza tako da budu upotrebljivi i na sudu. Prikupljanje po **order of volatility** (vidi 4.8), rad na kopijama, ne na originalu, uz hash.
- **Chain of custody** (lanac nadzora): dokumentovan zapis ko je, kada i zašto imao dokaz u posjedu i šta je radio sa njim. Prekid lanca može učiniti dokaz neprihvatljivim.
- **E-discovery**: identifikacija, prikupljanje i predaja elektronski uskladištenih podataka (email, dokumenti, chat) za pravni postupak.
- **Preservation** (legal hold): obaveza čuvanja relevantnih podataka kad se očekuje spor ili istraga; automatsko brisanje i rotacija se zaustavljaju za te podatke (npr. litigation hold na mailboxu u Microsoft 365, S3 Object Lock).

### Containment, negotiation, eradication/recovery

- **Containment**: **Quarantine/isolation**: izolacija hosta preko EDR-a, premještanje u izolovanu VLAN-u, blokiranje naloga, izmjena security grupe u cloudu da instanca nema izlaz. Cilj je zaustaviti širenje, ali sačuvati dokaze (ne gasi odmah mašinu, gubiš RAM).
- **Negotiation**: kod ransomware/iznude odluka o pregovorima uključuje menadžment, pravnike, osiguravača i, gdje je propisano, nadležne organe. Plaćanje ne garantuje dešifrovanje ni brisanje ukradenih podataka i može biti zakonski ograničeno (sankcije).
- **Eradication/recovery**: ukloni malver i perzistenciju, zatvori ranjivost, resetuj kompromitovane kredencijale; vrati sisteme iz **čistih** backupa ili ponovo izgradi iz IaC-a (*rebuild* je pouzdaniji od „čišćenja“), pojačan monitoring nakon povratka.

### Notification/external reporting

- **Stakeholders**: menadžment, uprava, interni timovi.
- **Customers**: kupci čiji su podaci pogođeni.
- **Law enforcement**: policija ili specijalizovane jedinice za visokotehnološki kriminal.
- **Mandatory**: obavezno izvještavanje propisano zakonom ili ugovorom, u zadanim rokovima (npr. GDPR traži obavještenje nadzornog organa o povredi ličnih podataka bez odlaganja, gdje je izvodljivo u roku od 72 sata; NIS2 propisuje rokove za rano upozorenje). Uvijek uključi pravnu službu.

### Post-incident

- **Lessons learned**: sastanak nakon incidenta: šta je radilo, šta nije, šta mijenjamo. Bez traženja krivca (*blameless*).
- **Root cause analysis** (RCA): pronalaženje stvarnog uzroka (npr. „5 zašto“), ne samo simptoma.
- **Post-incident reporting (PIR)**: formalni izvještaj: vremenska linija, uticaj, uzrok, preduzete mjere i preporuke. Rezultati se vraćaju u fazu Preparation (ažurirani playbookovi).

> **Na ispitu:** izolacija hosta = **containment**; uklanjanje malvera i reimage = **eradication/recovery**; „diskusija scenarija u sali bez tehničkih akcija“ = **tabletop**; „dokument ko je imao dokaz“ = **chain of custody**; „zabrana brisanja emailova zbog tužbe“ = **legal hold/preservation**. Pitanje „šta PRVO“ nakon potvrde incidenta obično cilja na **containment**.

## 4.8 Podaci i izvori u istrazi

### Log and trace data types

| Tip | Šta sadrži | Primjer pitanja koje odgovara |
|---|---|---|
| **Access and accounting – logical** | Ko je pristupio kojem sistemu/podatku i šta je radio. | Ko je otvorio fajl sa platama? |
| **Access and accounting – physical** | Bedž kartice, ulazi u prostorije, video. | Ko je ušao u server salu u 2h? |
| **Device** | Logovi mrežnih i drugih uređaja (switch, router, AP). | Kada je port pao? |
| **Server** | OS logovi (Windows Event Log, `/var/log/`, journald). | Koji servis je instaliran? |
| **Application** | Logovi aplikacije (web server access log, greške). | Koji URL je pozvan sa SQLi payloadom? |
| **Authentication** | Prijave i neuspjele prijave (Windows 4624/4625, Entra sign-in log, `/var/log/auth.log`). | Da li je bilo password sprayinga? |
| **Communication** | Email, chat, VoIP zapisi. | Kome je poslan phishing email? |
| **Audit** | Zapisi o promjenama konfiguracije i privilegovanim akcijama (CloudTrail, K8s audit, auditd). | Ko je izmijenio security grupu? |
| **Endpoint** | EDR telemetrija: procesi, komandne linije, fajlovi, konekcije. | Koji proces je pokrenuo PowerShell? |
| **Network** | Firewall, proxy, DNS, IDS logovi. | Na koji domen je host pravio upite? |
| **Metadata** | Podaci o podacima: vrijeme kreiranja fajla, autor dokumenta, email zaglavlja, EXIF iz fotografije. | Sa kog servera je stigao email? Ko je autor dokumenta? |

### Data sources

- **Vulnerability scans**: pokazuju da li je napadnuti sistem imao poznatu ranjivost (mogući vektor ulaska).
- **Automated reports**: periodični izvještaji iz alata (npr. dnevni izvještaj EDR-a ili CSPM-a).
- **NetFlow/IPFIX**: metapodaci o tokovima (ko, kome, kada, koliko). Nema sadržaja paketa. Dobro za obim i obrasce (eksfiltracija, beaconing, lateralno kretanje).
- **Packet captures** (pcap): pun sadržaj saobraćaja (Wireshark, tcpdump). Pokazuje tačno šta je preneseno (ako nije šifrovano), ali zauzima mnogo prostora.
- **Surveillance footage**: video nadzor (fizički pristup, krađa uređaja).
- **Security tools**: SIEM, EDR, IDS, DLP, firewall konzole.
- **Dashboards**: brzi pregled stanja i trendova za početak istrage.

> **Na ispitu:** „Treba vidjeti šta je TAČNO preneseno“ = **packet capture**. „Treba vidjeti koliko podataka i ka kome, uz malo prostora“ = **NetFlow/IPFIX**. „Ko je ušao u prostoriju“ = **physical access log** ili **surveillance footage**.

### File/log integrity

Dokaz mora biti nepromijenjen od trenutka prikupljanja:

- **Hashing**: izračunaj hash (SHA-256) pri prikupljanju i ponovo pri analizi; ako se poklapaju, dokaz nije mijenjan.
- **Write blocker**: hardverski ili softverski uređaj koji sprječava upis na originalni disk tokom kopiranja.
- Logovi: centralizovano slanje u SIEM (napadač na hostu ne može lako obrisati kopiju), nepromjenjivo skladište (WORM/Object Lock), **CloudTrail log file validation**, file integrity monitoring (FIM).

```bash
sha256sum disk.img > disk.img.sha256     # zabilježi hash
sha256sum -c disk.img.sha256             # kasnije provjeri: "disk.img: OK"
```

### System image

| Tip | Šta je | Kada |
|---|---|---|
| **Memory dump** | Snimak RAM-a: procesi, mrežne konekcije, ključevi za enkripciju, malver koji živi samo u memoriji (*fileless*). | **Prvo**, prije gašenja mašine, jer je najnestabilnije. |
| **Bit-level copy** (forenzička slika) | Kopija diska bit po bit, uključujući obrisane fajlove i slobodan prostor (npr. `dd`, FTK Imager, E01 format). | Za punu forenzičku analizu diska. Obična kopija fajlova ne hvata obrisano. |
| **Snapshot** | Trenutna slika stanja VM-a ili cloud diska (EBS snapshot, Azure disk snapshot). | Brzo očuvanje stanja u virtuelnim/cloud okruženjima, prije izmjena ili gašenja. |

### Order of volatility (redoslijed nestabilnosti)

Prikupljaj od **najnestabilnijeg** ka najstabilnijem (smjernica RFC 3227):

1. CPU registri i keš
2. Tabela rutiranja, ARP keš, tabela procesa, statistike kernela, **RAM**
3. Privremeni fajl sistemi (`/tmp`, swap/pagefile)
4. Disk
5. Udaljeni logovi i podaci monitoringa
6. Fizička konfiguracija i topologija mreže
7. Arhivski mediji (backup trake)

### Stakeholders u istrazi

- **HR** (Human Resources): kod istraga koje uključuju zaposlene (insider prijetnja, kršenje politike), disciplinske mjere, offboarding.
- **Accounts** (računovodstvo/finansije i vlasnici poslovnih naloga): kod finansijskih prevara (BEC, lažne fakture), procjene troška incidenta i plaćanja; vlasnici pogođenih naloga potvrđuju šta je legitimna aktivnost.
- **Legal** (pravna služba): obavezno izvještavanje, legal hold, e-discovery, komunikacija sa policijom, rizik odgovornosti; često vodi istragu da bi se zaštitila povjerljivost (*attorney-client privilege*).

### Log-parsing techniques

Analitičar mora brzo izvući ono što treba iz velikih logova.

```bash
# grep: sve neuspjele SSH prijave
grep "Failed password" /var/log/auth.log

# grep + regex: izvuci IP adrese i prebroj pokušaje po IP-u
grep "Failed password" /var/log/auth.log \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort | uniq -c | sort -rn | head

# awk: kolona 9 je HTTP status u nginx/Apache combined formatu; broj 404 odgovora po IP-u
awk '$9 == 404 {print $1}' access.log | sort | uniq -c | sort -rn | head

# jq: CloudTrail JSON, ko je brisao security grupe ili mijenjao IAM
jq -r '.Records[] | select(.eventName | test("^Delete|^PutUserPolicy|^AttachUserPolicy"))
       | [.eventTime, .userIdentity.arn, .eventName, .sourceIPAddress] | @tsv' cloudtrail.json

# Windows (PowerShell): neuspjele prijave, Event ID 4625
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 50
```

U SIEM-u se isto radi upitnim jezikom (Splunk SPL, KQL u Sentinelu), npr. KQL: `SigninLogs | where ResultType != "0" | summarize count() by IPAddress`.

Savjeti: normalizuj vremenske zone (UTC) prije korelacije; pravi **timeline**; traži prvo pojavljivanje indikatora (IP, hash, korisnik) i šta se desilo neposredno prije i poslije.

> **Na ispitu:** prepoznaj šta komanda radi: `grep` filtrira linije, `-E` regex, `uniq -c` broji, `jq` parsira JSON (cloud logovi), `awk` izvlači kolone. Mnogo `4625` događaja za mnogo različitih naloga sa jedne IP adrese = **password spraying**; mnogo za jedan nalog = **brute force**.

## Rezime

- Provisioning iz HR izvora istine, deprovisioning odmah; identity proofing prije izdavanja kredencijala; access review hvata privilege creep.
- SAML = XML assertion za enterprise SSO; OAuth = autorizacija (access token); OIDC = autentikacija na OAuth-u (ID token, JWT); LDAP = direktorij (LDAPS 636).
- Nalozi: odvojeni privilegovani nalozi, service nalozi bez interaktivne prijave, third-party vremenski ograničeni, break-glass sa alarmom na upotrebu.
- MFA = različite kategorije faktora; FIDO2/passkey je otporan na phishing; SMS OTP najslabiji; backup kodovi za oporavak.
- Modeli: DAC (vlasnik), MAC (labele), RBAC (uloga), rule-based (globalna pravila), time-based, JIT (privremeno, bez standing privilegija).
- Automatizacija: provisioning, desired state, anomaly detection, tiketi; SOAR orkestrira playbookove; rizici su complexity, SPOF i technical debt; AI agenti traže guardrails.
- IR: Preparation → Identification → Investigation → Containment → (Negotiation) → Eradication/recovery → Notification → Post-incident; tabletop je diskusija, chain of custody i legal hold čuvaju dokaze.
- Istraga: biraj izvor prema pitanju (NetFlow vs pcap, auth vs audit log), prikupljaj po order of volatility (RAM prije diska), hashuj dokaze, parsiraj logove sa grep/regex/awk/jq.
