## Ciljevi ispita: 2.4

- **2.4** Explain concepts related to control types, risks, and vulnerability management: tipovi kontrola (administrative, technical, physical), funkcije kontrola (preventative, detective, responsive, corrective), pojmovi rizika (risk appetite, inherent, residual), strategije (accept, transfer, avoid, mitigate), politike, governance i **SLO**-ovi, sigurnost aplikacija (**SAST**, **DAST**, **SAMM**) i rizik trećih strana (supply chain, **SCA**, **SBOM**).

Ovaj cilj je konceptualan („Explain“), ali CompTIA ga provjerava kroz scenarije: „koji tip kontrole je ovo“, „kako se zove rizik koji ostaje“, „šta je ovo, prihvatanje ili prenos rizika“. Veliki dio znaš iz Security+ kursa (modul 1 i 10) i iz DevSecOps kursa (SAST, SCA, SBOM). Ovdje je bitno naučiti **CySA+ terminologiju**, jer se razlikuje od Security+.

## Tipovi kontrola (control types)

CySA+ CS0-004 koristi tri kategorije. Security+ ih ima četiri (managerial, operational, technical, physical), pa pazi na mapiranje:

| CySA+ tip | Security+ ekvivalent | Šta je | Primjeri |
|---|---|---|---|
| **Administrative** | Managerial + dio operational | Politike, procedure, procesi, obuka, upravljanje rizikom | Politika upravljanja ranjivostima, procjena rizika, security awareness obuka, background check, change management |
| **Technical** (logical) | Technical | Kontrole koje sprovodi tehnologija | Firewall, EDR, MFA, enkripcija, WAF, ACL, SIEM pravilo |
| **Physical** | Physical | Kontrole fizičkog pristupa i okruženja | Ograda, brava, kartični čitač, kamere, čuvar, gašenje požara |

> **Na ispitu:** ako ponuđeni odgovori sadrže samo administrative, technical i physical, politika i obuka su **administrative**. Ne traži „managerial“ ili „operational“ ako ih nema među opcijama; CySA+ ih podvodi pod administrative.

## Funkcije kontrola (control functions)

Funkcija kaže **kada** i **kako** kontrola djeluje u odnosu na incident:

| Funkcija | Kada djeluje | Primjeri |
|---|---|---|
| **Preventative** | Prije incidenta, sprečava ga | Firewall pravilo, MFA, patch, least privilege, input validacija, zaključana vrata |
| **Detective** | Tokom ili nakon, otkriva | SIEM korelacija, IDS, Wazuh/Sigma/Falco pravila (detection lab), FIM, kamere, revizija logova, sken ranjivosti |
| **Responsive** | Kad je incident otkriven, reaguje da ga obuzda | SOAR playbook koji izoluje host, EDR network containment, automatsko blokiranje IP-a, IR tim |
| **Corrective** | Nakon incidenta, vraća u ispravno stanje i ispravlja uzrok | Restore iz backupa, reimage, primjena zakrpe nakon incidenta, ispravka pogrešnog pravila |

**Responsive** je CySA+ specifičnost: Security+ je nema kao zasebnu kategoriju. Razlika prema corrective: responsive **zaustavlja štetu u toku** (containment), corrective **popravlja posljedice i uzrok** (recovery). EDR izolacija hosta je responsive; reimage tog hosta i patch su corrective.

Jedna kontrola može imati više funkcija, a pitanje traži **primarnu**. Sken ranjivosti je detective (otkriva slabost), a patch koji slijedi je preventative za buduće napade ili corrective ako je ranjivost već iskorištena.

> **Na ispitu:** pazi na riječi u scenariju. „Spriječiti“ i „blokirati prije“ = preventative. „Otkriti“, „uočiti“, „alarm“ = detective. „Automatski izolovati“, „obuzdati“, „odgovoriti“ = responsive. „Vratiti“, „oporaviti“, „ispraviti nakon“ = corrective.

Kombinovano, svaka kontrola ima tip i funkciju:

| Kontrola | Tip | Funkcija |
|---|---|---|
| Politika obaveznih zakrpa u roku od 15 dana | Administrative | Preventative |
| Kvartalni pregled pristupnih prava | Administrative | Detective |
| Incident response plan i pozivna lista | Administrative | Responsive |
| WAF pravilo za poznati CVE (virtual patch) | Technical | Preventative |
| Falco pravilo za shell u kontejneru | Technical | Detective |
| SOAR playbook koji onemogućava kompromitovan nalog | Technical | Responsive |
| Restore baze iz nepromjenljivog backupa | Technical | Corrective |
| Čuvar na ulazu u data centar | Physical | Preventative (i detective) |
| CCTV snimak | Physical | Detective |
| Sistem za gašenje požara | Physical | Responsive/corrective |

### Kompenzacione kontrole

Iz modula 7 znaš da se nepatchovani sistem štiti **kompenzacionom kontrolom**. Kod CySA+ to nije posebna funkcija u ciljevima 2.4, nego strategija ublažavanja (2.3). Kompenzaciona kontrola mora: pokrivati isti rizik kao originalna, biti dokumentovana, imati vlasnika i rok pregleda. PCI DSS za to ima i formalni obrazac (Compensating Controls Worksheet).

## Pojmovi rizika

**Rizik** = vjerovatnoća (likelihood) × uticaj (impact). U upravljanju ranjivostima: prijetnja (threat) iskorištava ranjivost (vulnerability) na imovini (asset).

| Pojam | Definicija | Primjer |
|---|---|---|
| **Inherent risk** | Rizik **prije** primjene kontrola | Javni web server sa nezakrpljenim RCE-om, bez WAF-a i segmentacije |
| **Residual risk** | Rizik koji **ostaje** nakon kontrola | Isti server sa WAF-om i segmentacijom: rizik manji, ali nije nula (zaobilaženje WAF-a, zero-day) |
| **Risk appetite** | Koliko rizika organizacija **želi** da prihvati u potjeri za ciljevima (strateški, širok) | „Prihvatamo umjeren rizik za brže lansiranje proizvoda, ali nula tolerancije za curenje kartičnih podataka“ |
| **Risk tolerance** | Prihvatljivo odstupanje oko appetita za konkretnu metriku | „Kritični nalazi na izloženim sistemima ne smiju biti otvoreni duže od 7 dana“ |
| **Risk threshold** | Granica nakon koje je potrebna akcija ili eskalacija | „EPSS > 0.1 ili KEV automatski ide u hitni ciklus“ |

Odnos: inherent − efekat kontrola = residual. Ako je residual veći od risk appetita, treba još kontrola (mitigate), prenos (transfer) ili odustajanje od aktivnosti (avoid). Ako je ispod, rizik se formalno prihvata (accept).

> **Na ispitu:** „rizik koji ostaje nakon što su sve kontrole implementirane“ je uvijek **residual risk**. „Rizik prije kontrola“ je **inherent**. Količina rizika koju je uprava spremna podnijeti je **risk appetite**. Residual risk se nikad ne svodi na nulu.

### Kvantitativno i kvalitativno

Kratki podsjetnik iz Security+: **SLE** = AV × EF (vrijednost imovine × procenat izgubljenog), **ALE** = SLE × ARO (godišnja učestalost). Kontrola ima smisla ako je njen godišnji trošak manji od smanjenja ALE. Kvalitativno se rizik iskazuje matricom (Low/Medium/High/Critical) i to je u praksi češće u izvještajima o ranjivostima.

Primjer: baza vrijedna 200.000 €, incident bi uništio 50% vrijednosti (EF 0.5), očekuje se jednom u četiri godine (ARO 0.25). SLE = 100.000 €, ALE = 25.000 €. Kontrola koja košta 8.000 € godišnje i smanjuje ARO na 0.05 spušta ALE na 5.000 €, pa štedi 20.000 € uz trošak od 8.000 €: isplati se.

## Strategije upravljanja rizikom

| Strategija | Šta radiš | Primjer u upravljanju ranjivostima |
|---|---|---|
| **Mitigate** (reduce) | Smanjuješ vjerovatnoću ili uticaj kontrolama | Patch, WAF pravilo, segmentacija, MFA, hardening po CIS-u |
| **Transfer** (share) | Prebacuješ finansijski teret na treću stranu | Cyber osiguranje, ugovor sa MSSP-om ili cloud provajderom koji preuzima odgovornost za dio stacka |
| **Avoid** | Ukidaš aktivnost koja stvara rizik | Gašenje zastarjelog FTP servisa, odustajanje od integracije sa nepouzdanim vendorom, uklanjanje nepodržanog softvera |
| **Accept** | Svjesno prihvataš rizik bez dodatnih mjera | Nalaz niskog rizika na izolovanom sistemu; trošak ispravke veći od mogućeg gubitka; formalni exception sa potpisom vlasnika |

Važne nijanse:

- Transfer prenosi **finansijske posljedice**, ne odgovornost: ako procure podaci klijenata, regulator i klijenti i dalje traže odgovor od tebe.
- Accept mora biti **formalan i dokumentovan** (risk register, vlasnik, rok, pregled). Neodlučivanje nije prihvatanje, nego nemar.
- Avoid je često najjeftiniji odgovor za nepotrebne servise: najbolja zakrpa za nekorišten servis je ugasiti ga.

> **Na ispitu:** kupovina cyber osiguranja = **transfer**. Gašenje servisa ili odustajanje od projekta = **avoid**. Primjena zakrpe ili WAF-a = **mitigate**. Uprava potpisuje da zna za ranjivost i ne radi ništa jer je trošak prevelik = **accept**.

## Risk register

**Risk register** je centralni zapis rizika. Za ranjivosti koje se ne mogu odmah ispraviti, unos izgleda ovako:

| Polje | Primjer |
|---|---|
| ID | RR-2026-041 |
| Opis | CVE-2024-XXXX u firmveru MR uređaja, zakrpa čeka recertifikaciju |
| Imovina i vlasnik | MR-01, šef radiologije |
| Inherent risk | High (CVSS 8.8, interni pristup, uređaj kritičan za rad) |
| Kontrole | Zaseban VLAN, ACL samo prema PACS serveru, pojačan monitoring |
| Residual risk | Medium |
| Odluka | Accept (exception) do 30. 4. 2027. |
| Pregled | Mjesečno; ponovo ocijeniti ako CVE uđe u KEV |

## Politike, governance i SLO-ovi

Program upravljanja ranjivostima počiva na dokumentima i ulogama:

- **Politika (policy)**: visok nivo, odobrava uprava: „svi sistemi moraju biti skenirani i ranjivosti ispravljene u rokovima prema kritičnosti“.
- **Standard**: obavezni konkretni zahtjevi: „interni serveri se skeniraju credentialed skenom sedmično“.
- **Procedura**: koraci: kako se otvara tiket, ko odobrava exception.
- **Smjernica (guideline)**: preporuka, nije obavezna.
- **Governance**: ko odlučuje i ko odgovara. Tipično RACI: SecOps skenira i prioritizuje (Responsible za nalaze), vlasnici sistema ispravljaju (Responsible za ispravku), CISO je Accountable za program, uprava odobrava risk appetite i izuzetke iznad praga.

### SLA, SLO i SLI

| Pojam | Značenje | Primjer |
|---|---|---|
| **SLI** (indicator) | Mjerena vrijednost | Vrijeme od otkrivanja do ispravke za svaki nalaz |
| **SLO** (objective) | Interni cilj za SLI | 95% kritičnih nalaza na izloženim sistemima ispravljeno za 7 dana |
| **SLA** (agreement) | Ugovorna obaveza prema drugoj strani, sa posljedicama | MSP se ugovorom obavezuje na patch kritičnih ranjivosti za 72 sata |

Tipični interni SLO-ovi za ispravku (primjer; svaka organizacija ih definiše u politici):

| Kategorija | Izloženo internetu | Interno |
|---|---|---|
| KEV ili aktivna eksploatacija | 72 sata | 7 dana |
| Critical (CVSS 9.0–10.0) | 7 dana | 15 dana |
| High (7.0–8.9) | 15 dana | 30 dana |
| Medium (4.0–6.9) | 30 dana | 90 dana |
| Low | Sljedeći ciklus održavanja | Sljedeći ciklus održavanja |

SLO-ovi su osnova za metrike (procenat ispunjenja, **MTTR**, broj prekoračenja) i za izvještavanje upravi (modul 11). Kada se rok ne može ispuniti, otvara se exception, a ne tiho prekoračenje.

> **Na ispitu:** **SLO** je interni cilj (npr. „kritično za 15 dana“), **SLA** ugovor sa posljedicama. Ako pitanje pita šta treba definisati da bi se mjerilo da li se ranjivosti ispravljaju dovoljno brzo, odgovor je rok po kritičnosti u politici, odnosno SLO.

## Sigurnost aplikacija

### SAST i DAST

| | **SAST** (Static Application Security Testing) | **DAST** (Dynamic Application Security Testing) |
|---|---|---|
| Šta testira | Izvorni kod, bytecode ili binarni fajl, bez pokretanja | Aplikaciju koja radi, spolja, kao napadač (black-box) |
| Kada | Rano: IDE, pull request, CI (shift left) | Kasnije: test/staging okruženje, prije releasea |
| Nalazi | Tačna linija koda, SQLi, hardkodovane tajne, nesigurne funkcije | Ranjivosti u izvršavanju: XSS, loše konfigurisana zaglavlja, auth problemi, server konfiguracija |
| Slabosti | Više false positive, ne vidi runtime/konfiguraciju | Ne vidi kod, ne pokriva neistražene putanje, sporiji |
| Alati | Semgrep, SonarQube, CodeQL, Bandit | OWASP ZAP, Burp Suite, Nikto |

Primjer SAST nalaza (Semgrep, kao u DevSecOps kursu):

```
$ semgrep --config p/python app/
  app/db.py
     python.lang.security.audit.formatted-sql-query.formatted-sql-query
        Detected possible formatted SQL query. Use parameterized queries instead.
         14┆ cur.execute(f"SELECT * FROM users WHERE name = '{name}'")
```

Primjer DAST nalaza (ZAP baseline sken):

```
WARN-NEW: Content Security Policy (CSP) Header Not Set [10038] x 3
WARN-NEW: Missing Anti-clickjacking Header [10020] x 2
FAIL-NEW: 0	FAIL-INPROG: 0	WARN-NEW: 2	WARN-INPROG: 0	INFO: 4	IGNORE: 0	PASS: 52
```

Srodni pojmovi: **IAST** (agent u aplikaciji tokom testiranja), **RASP** (zaštita u runtimeu), **fuzzing**. SAST i DAST se dopunjuju: SAST nalazi uzrok u kodu, DAST potvrđuje šta je stvarno izloženo.

> **Na ispitu:** „analiza izvornog koda bez pokretanja, u CI pipelineu“ = **SAST**. „Testiranje pokrenute aplikacije u stagingu, spolja“ = **DAST**. „Ranjivosti u bibliotekama trećih strana“ = **SCA**, ne SAST.

### SAMM

**OWASP SAMM** (Software Assurance Maturity Model, v2) je okvir za mjerenje i unapređenje zrelosti sigurnog razvoja softvera. Ne testira aplikaciju, nego **proces** organizacije.

| Poslovna funkcija | Sigurnosne prakse |
|---|---|
| **Governance** | Strategy & Metrics, Policy & Compliance, Education & Guidance |
| **Design** | Threat Assessment, Security Requirements, Security Architecture |
| **Implementation** | Secure Build, Secure Deployment, Defect Management |
| **Verification** | Architecture Assessment, Requirements-driven Testing, Security Testing |
| **Operations** | Incident Management, Environment Management, Operational Management |

Pet funkcija, 15 praksi, svaka ocijenjena na **nivoima zrelosti 1–3** (0 = praksa ne postoji). Organizacija radi procjenu (assessment), postavi ciljni nivo po praksi i pravi roadmap. SAMM je **preskriptivan** (kaže šta treba raditi); BSIMM je **deskriptivan** (opisuje šta druge organizacije rade).

## Rizik trećih strana (third-party risk)

### Supply chain

Napad na lanac snabdijevanja kompromituje dobavljača da bi stigao do njegovih korisnika. Poznati primjeri: **SolarWinds Orion** (2020, kompromitovan build proces), **3CX** (2023, trojanizovan desktop klijent), **xz utils** (2024, backdoor maintainera, CVE-2024-3094), **MOVEit** (2023, masovna eksploatacija servisa za prenos fajlova kod stotina organizacija).

Kontrole za rizik dobavljača:

- **Vendor assessment** prije ugovora: upitnici (SIG, CAIQ), SOC 2 Type II izvještaj, ISO 27001 certifikat, penetracioni test izvještaj.
- **Ugovorne odredbe**: right-to-audit, rokovi obavještavanja o incidentu, SLA za ispravku ranjivosti, obaveza dostavljanja SBOM-a.
- **Kontinuirani nadzor**: praćenje advisoryja dobavljača, ocjene sigurnosnog rejtinga, KEV unosi za njihove proizvode.
- **Tehničke kontrole**: least privilege za pristup dobavljača, posebni nalozi, segmentacija, provjera potpisa softvera i update-a.

### SCA

**SCA** (Software Composition Analysis) identifikuje open-source i third-party komponente u aplikaciji, njihove ranjivosti (CVE, GHSA, OSV) i licence. U DevSecOps kursu si to radio sa osv-scannerom, Trivy-jem i Dependabotom.

```
$ osv-scanner scan source -r .
Scanned /src/app/package-lock.json file and found 412 packages
╭─────────────────────────────────────┬──────┬───────────┬─────────┬─────────┬───────────────────╮
│ OSV URL                             │ CVSS │ ECOSYSTEM │ PACKAGE │ VERSION │ SOURCE            │
├─────────────────────────────────────┼──────┼───────────┼─────────┼─────────┼───────────────────┤
│ https://osv.dev/GHSA-grv7-fg5c-xmjg │ 7.5  │ npm       │ braces  │ 3.0.2   │ package-lock.json │
╰─────────────────────────────────────┴──────┴───────────┴─────────┴─────────┴───────────────────╯
```

Bitno za analitičara: **tranzitivne zavisnosti** (zavisnosti zavisnosti) čine većinu koda i većinu nalaza; ranjiva biblioteka nije nužno iskoristiva ako se ranjiva funkcija ne poziva (**reachability**), što se dokumentuje kroz VEX.

### SBOM

**SBOM** (Software Bill of Materials) je formalni, mašinski čitljiv popis svih komponenti softvera (ime, verzija, dobavljač, hash, licenca, zavisnosti). Formati: **SPDX** (Linux Foundation, ISO/IEC 5962) i **CycloneDX** (OWASP). Uz SBOM ide **VEX** (Vulnerability Exploitability eXchange): izjava proizvođača da li je komponenta zaista pogođena (`not_affected`, `affected`, `fixed`, `under_investigation`).

```
$ trivy image --format cyclonedx -o sbom.cdx.json app:1
$ jq -r '.components[] | select(.name=="log4j-core") | "\(.name) \(.version)"' sbom.cdx.json
log4j-core 2.14.1
$ trivy sbom -q --severity CRITICAL sbom.cdx.json | grep CVE-2021-44228
│ org.apache.logging.log4j:log4j-core │ CVE-2021-44228 │ CRITICAL │ fixed  │ 2.14.1 │ 2.15.0, 2.3.1, 2.12.2 │ ...
```

Vrijednost SBOM-a se vidi kad izađe novi kritičan CVE: umjesto da skeniraš sve sisteme ispočetka, pretražiš postojeće SBOM-ove i za minute znaš koje aplikacije sadrže ranjivu verziju. Kao u DevSecOps kursu: SBOM se generiše u pipelineu, potpisuje (cosign) i čuva uz artefakt.

> **Na ispitu:** „kako brzo utvrditi koje aplikacije sadrže ranjivu biblioteku nakon objave novog CVE-a“ = **SBOM**. „Alat koji u CI otkriva ranjive open-source zavisnosti i licence“ = **SCA**. „Procjena sigurnosti dobavljača prije ugovora“ = **third-party / vendor risk assessment**.

### Dijeljena odgovornost kod cloud i SaaS dobavljača

Cloud provajder je takođe treća strana. Ko patchuje šta zavisi od modela (kao u AWS Security kursu):

| Model | Provajder patchuje | Ti patchuješ i skeniraš |
|---|---|---|
| **IaaS** (EC2, VM) | Hipervizor, fizički hostovi | OS, middleware, aplikaciju, konfiguraciju |
| **PaaS** (RDS, App Service, EKS control plane) | OS i platformu | Aplikaciju, konfiguraciju, podatke, pristup |
| **SaaS** (Microsoft 365, Salesforce) | Gotovo sve | Konfiguraciju naloga, identitete, dijeljenje podataka |

Skener koji prijavi ranjivost u komponenti koju upravlja provajder ne vodi do tvog patcha, nego do provjere provajderovog advisoryja i, po potrebi, eskalacije kroz ugovor.

## Proces izuzetka (exception) u praksi

Kada ranjivost ne može biti ispravljena u roku iz SLO-a, politika propisuje proces, a ne improvizaciju:

1. **Zahtjev** vlasnika sistema: koji nalaz, zašto se ne može ispraviti (nema zakrpe, vendor certifikacija, poslovni zastoj), do kada.
2. **Procjena rizika** od strane SecOps-a: CVSS, EPSS, KEV, kontekst, šta bi napadač dobio.
3. **Kompenzacione kontrole**: šta se uvodi umjesto ispravke i kako se provjerava da radi.
4. **Odobrenje** na nivou koji odgovara riziku: menadžer za Low/Medium, CISO ili uprava za High/Critical (prag iz risk appetita).
5. **Upis u risk register** sa datumom isteka.
6. **Periodični pregled**: izuzetak automatski ističe; ponovna procjena ako se promijene uslovi (npr. CVE uđe u KEV, pojavi se javni exploit).

U skeneru se nalaz tada ne briše, nego označava kao „risk accepted“ sa referencom na izuzetak, da metrike ostanu poštene.

## Provjera efikasnosti kontrola

Kontrola koja postoji na papiru nije isto što i kontrola koja radi:

| Metoda | Šta provjerava | Primjer |
|---|---|---|
| **Pregled dokumentacije** | Postoji li kontrola i je li odobrena | Politika patchovanja, potpisani exception |
| **Tehnička provjera** | Je li kontrola stvarno konfigurisana | `nft list ruleset` pokazuje pravilo; MFA je obavezan za sve admin naloge |
| **Testiranje** | Da li kontrola zaustavlja ili otkriva napad | BAS test (Atomic Red Team) okida Sigma pravilo; WAF blokira test payload |
| **Metrike** | Radi li kontrola dosljedno kroz vrijeme | Procenat hostova sa agentom, SLO usklađenost, broj nalaza po kategoriji |
| **Audit** | Nezavisna potvrda | Interni audit, eksterni ISO 27001 ili PCI DSS procjenitelj |

Primjer tehničke provjere da kompenzaciona kontrola (segmentacija) radi, iz segmenta koji ne bi smio imati pristup:

```
$ nmap -Pn -p 104,11112 10.20.30.15
PORT      STATE    SERVICE
104/tcp   filtered dicom
11112/tcp filtered dicom
```

`filtered` je ovdje željeni rezultat: DICOM servisi MR uređaja nisu dostupni iz korisničke mreže.

## Povezivanje sa ostalim ciljevima domena 2

| Iz 2.4 | Gdje se koristi |
|---|---|
| Risk appetite i SLO | Pragovi prioritizacije i rokovi (2.3), metrike u izvještajima (4.1) |
| Residual risk i accept | Exceptions i kompenzacione kontrole (2.3) |
| SAST/DAST/SCA | Izvori nalaza uz mrežne skenere (2.1, 2.2) |
| SBOM | Inventar komponenti, dopuna asset inventoryja (2.1) |
| Control functions | Klasifikacija mjera iz IR procesa (domen 3): responsive je containment, corrective je recovery |

## Rezime

- CySA+ tipovi kontrola: **administrative**, **technical**, **physical** (Security+ managerial/operational ovdje su administrative).
- Funkcije: **preventative** (spriječi), **detective** (otkrij), **responsive** (reaguj i obuzdaj), **corrective** (ispravi i oporavi).
- **Inherent risk** je prije kontrola, **residual risk** poslije; **risk appetite** određuje koliko residual rizika uprava prihvata.
- Strategije: **mitigate**, **transfer** (osiguranje, ali odgovornost ostaje), **avoid** (ugasi aktivnost), **accept** (formalno, dokumentovano, sa rokom).
- Politika → standard → procedura; governance definiše ko je odgovoran; **SLO** je interni rok ispravke po kritičnosti, **SLA** ugovorni.
- **SAST** testira kod bez pokretanja, **DAST** pokrenutu aplikaciju spolja; **OWASP SAMM** mjeri zrelost procesa kroz 5 funkcija i 15 praksi, nivoi 1–3.
- Third-party risk: supply chain napadi (SolarWinds, 3CX, xz utils), vendor assessment i ugovori, **SCA** za zavisnosti, **SBOM** (SPDX, CycloneDX) uz **VEX** za brz odgovor na nove CVE-ove.
