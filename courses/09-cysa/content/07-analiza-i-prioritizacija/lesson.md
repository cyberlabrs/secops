## Ciljevi ispita: 2.2 i 2.3

- **2.2** Given a scenario, analyze output from vulnerability assessment tools: prepoznaj alat po izlazu i znaj šta svaki alat radi (network mapping, multipurpose, web, vulnerability, cloud, BAS).
- **2.3** Given a scenario, analyze data to prioritize and mitigate vulnerabilities: kriteriji (exploitability, aktivna eksploatacija, vrijednost imovine, uticaj, dostupnost zakrpe, true/false positive/negative), **CVSS** i **EPSS**, kontekst (internal, external, isolated), strategije ublažavanja i validacija.

Ovo je najpraktičniji dio domena 2. Na ispitu se pojavljuju PBQ zadaci u kojima dobiješ tabelu nalaza (CVE, CVSS, EPSS, da li je u KEV-u, gdje je host) i treba da ih poredaš ili izabereš šta se popravlja prvo. Pored onoga što CompTIA eksplicitno navodi, ovdje radimo i **CISA KEV** i **SSVC**, jer su to izvori koje stvarni timovi (i CompTIA scenariji kroz „active exploitation/threat intelligence“) koriste.

## Alati za procjenu ranjivosti (2.2)

CompTIA traži da prepoznaš alat i protumačiš njegov izlaz. Napadačke mogućnosti ovih alata ovdje gledamo samo kao izvor nalaza i kao način da se provjeri odbrana.

| Kategorija | Alat | Šta radi | Tipičan izlaz |
|---|---|---|---|
| **Network scanning and mapping** | **Angry IP Scanner** | Brz GUI skener IP opsega (ping, portovi, hostname), izvoz u CSV | Lista živih IP-ova sa otvorenim portovima |
| | **Masscan** | Asinhroni skener portova za ogromne opsege (cijeli internet) | `Discovered open port 443/tcp on 10.0.5.12` |
| **Multipurpose** | **Nmap** | Discovery, portovi, verzije, OS, NSE skripte | Tabela PORT/STATE/SERVICE/VERSION |
| | **Metasploit Framework (MSF)** | Okvir za provjeru iskoristivosti ranjivosti (moduli, payloadi); kod odbrane: potvrda da je nalaz stvaran, uz pismeno odobrenje | Status sesije ili modula |
| | **Maltego** | OSINT i vizuelna analiza veza (graf entiteta: domeni, emailovi, IP-ovi, osobe) | Graf transformacija |
| | **Recon-ng** | Modularni OSINT okvir sa workspaceovima i bazom (CLI, sličan MSF-u) | Tabele hostova, kontakata, domena |
| **Web application scanners** | **Burp Suite** | Presretački proxy, ručno i automatsko testiranje web aplikacija | Issues lista sa severity i confidence |
| | **ZAP** (Zed Attack Proxy) | Open-source DAST, proxy, spider, aktivni i baseline sken (DevSecOps kurs, modul DAST) | Alerts: risk + confidence + CWE |
| | **Nikto** | Skener web servera: opasni fajlovi, zastarjele verzije, zaglavlja | Linije sa `+` prefiksom |
| **Vulnerability scanners** | **Nessus** | Komercijalni skener (Tenable), pluginovi, credentialed i compliance skenovi | Plugin ID, risk, CVE, solution |
| | **Nuclei** | Brzi skener zasnovan na YAML šablonima (templates) | `[template-id] [protocol] [severity] URL` |
| | **OpenVAS** (Greenbone) | Open-source skener sa NVT feedom | Rezultati sa QoD (Quality of Detection) |
| **Cloud infrastructure assessment** | **ScoutSuite** | Multi-cloud audit konfiguracije (AWS, Azure, GCP) kroz API | HTML izvještaj po servisu |
| | **Prowler** | Sigurnosne provjere AWS/Azure/GCP/K8s, CIS i drugi okviri | PASS/FAIL po checku |
| | **Trivy** | Ranjivosti slika, fajl sistema, IaC, tajni, Kubernetes | Tabela ili JSON sa CVE i Fixed Version |
| | **Checkov** | Statička analiza IaC-a (Terraform, CloudFormation, K8s, Dockerfile) | `Check: CKV_AWS_20 ... FAILED` |
| **Breach attack simulation (BAS)** | **Atomic Red Team** | Biblioteka malih testova mapiranih na MITRE ATT&CK tehnike | Test po tehnici (npr. T1059.001) i da li je detektovan |
| | **Caldera** | MITRE platforma za automatizovanu emulaciju protivnika sa agentima | Operacija sa koracima i ishodima |

> **Na ispitu:** prepoznavanje po izlazu: `Discovered open port` je **Masscan**; `[critical]` u uglastim zagradama sa imenom šablona je **Nuclei**; linije sa `+ ` i zaglavljima web servera su **Nikto**; `CKV_` je **Checkov**; Plugin ID je **Nessus**; QoD je **OpenVAS**. BAS alati (**Atomic Red Team**, **Caldera**) ne traže ranjivosti, nego provjeravaju da li detekcija i kontrole rade.

### Primjeri izlaza

Nikto protiv vlastitog servisa u labu:

```
$ nikto -h http://127.0.0.1:8080
- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          127.0.0.1
+ Target Hostname:    127.0.0.1
+ Target Port:        8080
---------------------------------------------------------------------------
+ Server: SimpleHTTP/0.6 Python/3.11.2
+ /: The anti-clickjacking X-Frame-Options header is not present.
+ /: The X-Content-Type-Options header is not set.
+ /.git/config: Git config file found. Infos about repo details may be present.
```

Posljednja linija je najozbiljnija: izložen `.git` direktorij može otkriti izvorni kod i tajne. Nedostajuća zaglavlja su nalazi niskog rizika.

Nuclei:

```
[git-config] [http] [medium] http://127.0.0.1:8080/.git/config
[http-missing-security-headers:x-frame-options] [http] [info] http://127.0.0.1:8080
```

Nessus (izvoz u CSV, skraćeno):

| Plugin ID | Risk | Host | Port | Name |
|---|---|---|---|---|
| 104743 | Medium | 10.0.2.15 | 443 | TLS Version 1.0 Protocol Detection |
| 42873 | Medium | 10.0.2.15 | 443 | SSL Medium Strength Cipher Suites Supported (SWEET32) |
| 57582 | Medium | 10.0.2.20 | 8443 | SSL Self-Signed Certificate |
| 51192 | Medium | 10.0.2.20 | 8443 | SSL Certificate Cannot Be Trusted |

Checkov nad Terraformom (DevSecOps kurs, IaC skeniranje):

```
Check: CKV_AWS_20: "S3 Bucket has an ACL defined which allows public READ access."
	FAILED for resource: aws_s3_bucket.reports
	File: /main.tf:12-18
```

Prowler:

```
FAIL  iam_root_mfa_enabled            us-east-1  MFA is not enabled for root account.
PASS  cloudtrail_multi_region_enabled us-east-1  Trail main is multiregion.
```

## Validacija nalaza: true/false positive/negative

| | Ranjivost **postoji** | Ranjivost **ne postoji** |
|---|---|---|
| Skener **prijavljuje** | **True positive**: ispravi | **False positive**: dokumentuj i potisni nakon provjere |
| Skener **ne prijavljuje** | **False negative**: najopasnije, ne znaš da si izložen | **True negative**: sve u redu |

Tipični uzroci:

- **False positive**: banner bez backport informacije, verzija u nazivu fajla, ranjiva funkcija koja se ne koristi, nalaz na već ugašenom hostu.
- **False negative**: firewall blokira skener, istekli kredencijali, zastarjeli plugin feed, servis na nestandardnom portu, ranjivost u dependency koja nije u lockfileu.

Prije nego što označiš nalaz kao false positive: provjeri stvarnu verziju (`dpkg -l`, `rpm -q`, registry), pročitaj advisory distribucije, po potrebi credentialed sken. Potiskivanje (suppress) dokumentuj sa razlogom i datumom, inače ga sljedeći analitičar ne može provjeriti.

> **Na ispitu:** false negative je opasniji od false positive. Ako scenarij pita kako **smanjiti false negative**, odgovori su credentialed sken, ažuran feed, ispravna pozicija skenera i potpun inventar. Za smanjenje **false positive** isto pomaže credentialed sken, plus ručna validacija.

## Kriteriji za prioritizaciju

| Kriterij | Pitanje | Izvor podataka |
|---|---|---|
| **Exploitability** | Koliko je lako iskoristiti? Postoji li javni exploit? | CVSS AV/AC/PR/UI, Exploit Maturity, EPSS |
| **Active exploitation / threat intelligence** | Da li se već koristi u napadima? Ransomware? | **CISA KEV**, vendor advisory, threat intel feedovi (modul 4) |
| **Asset value** | Koliko je sistem bitan i koje podatke drži? | Inventar, BIA, klasifikacija podataka |
| **Impact** | Šta napadač dobija: čitanje podataka, potpunu kontrolu, prekid usluge? | CVSS C/I/A (VC/VI/VA), technical impact |
| **Patch/remediation availability** | Postoji li zakrpa ili samo zaobilazno rješenje? | Vendor, `Fixed Version` u Trivy-ju |
| **True/false positives i negatives** | Je li nalaz stvaran? | Validacija |

CVSS ocjenjuje **ozbiljnost** (severity), ne **rizik**. Rizik nastaje tek kad se doda vjerovatnoća napada (EPSS, KEV) i kontekst imovine.

## CVSS v3.1

**CVSS** (Common Vulnerability Scoring System) održava **FIRST**. Skor je 0.0–10.0, vektor je tekstualni zapis metrika.

### Base metrike

| Metrika | Vrijednosti | Značenje |
|---|---|---|
| **AV** Attack Vector | N (Network), A (Adjacent), L (Local), P (Physical) | Odakle napadač mora biti |
| **AC** Attack Complexity | L, H | Uslovi van kontrole napadača (npr. race, MITM) |
| **PR** Privileges Required | N, L, H | Potrebna prava prije napada |
| **UI** User Interaction | N, R (Required) | Mora li žrtva nešto uraditi |
| **S** Scope | U (Unchanged), C (Changed) | Da li uticaj prelazi u drugu sigurnosnu zonu (npr. VM escape, XSS u browser) |
| **C / I / A** | H, L, N | Uticaj na povjerljivost, integritet, dostupnost |

Ocjene: **None** 0.0, **Low** 0.1–3.9, **Medium** 4.0–6.9, **High** 7.0–8.9, **Critical** 9.0–10.0.

Primjeri (izračunato bibliotekom `cvss` u labu, `/opt/tools/bin/python`):

| Vektor | Skor | Tumačenje |
|---|---|---|
| `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | 9.8 Critical | Mrežni, bez prava, bez korisnika, potpun uticaj (tipičan RCE) |
| `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` | 10.0 Critical | Isto, ali prelazi granicu (Log4Shell, CVE-2021-44228) |
| `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H` | 7.8 High | Lokalna eskalacija privilegija |
| `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` | 6.1 Medium | Tipičan reflected XSS |
| `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` | 5.9 Medium | Curenje podataka uz teške uslove |

### Temporal i environmental (3.1)

- **Temporal**: **E** Exploit Code Maturity (X, H, F, P, U), **RL** Remediation Level (X, U, W, T, O), **RC** Report Confidence (X, C, R, U). Mogu samo smanjiti skor.
- **Environmental**: **CR/IR/AR** Security Requirements (X, H, M, L) i modifikovane base metrike (MAV, MAC, …). Ovo je mjesto gdje organizacija unosi svoj kontekst.

```
$ /opt/tools/bin/python -c "
from cvss import CVSS3
v='CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'
print(CVSS3(v+'/E:U/RL:O/RC:C').scores())
print(CVSS3(v+'/CR:L/IR:L/AR:L/MAV:L').scores())"
(9.8, 8.5, 8.5)
(9.8, 9.8, 6.6)
```

Rezultat je trojka (base, temporal, environmental). Prvi red: nema poznatog exploita i postoji zvanična zakrpa, pa temporal pada na 8.5. Drugi red: sistem je dostupan samo lokalno i ima niske zahtjeve, pa environmental pada na 6.6 (Medium).

> **Na ispitu:** dekodiraj vektor slovo po slovo. `AV:N` + `PR:N` + `UI:N` = napad sa mreže bez naloga i bez žrtve, najopasnija kombinacija. `S:C` znači da uticaj izlazi iz ranjive komponente. Ako pitanje kaže da je server dostupan samo sa interne mreže, to se izražava kroz **environmental** metrike (MAV), ne mijenjanjem base skora.

## CVSS v4.0

CVSS 4.0 (FIRST, novembar 2023) mijenja strukturu. Grupe: **Base**, **Threat**, **Environmental**, **Supplemental**.

| Promjena | v3.1 | v4.0 |
|---|---|---|
| Novi uslov napada | Dio AC | Zasebno **AT** Attack Requirements (N, P): uslovi u ranjivom sistemu (npr. specifična konfiguracija, race) |
| Korisnička interakcija | UI: N, R | UI: **N, P (Passive), A (Active)** |
| Scope | S: U/C | Uklonjen; umjesto njega uticaj na **Vulnerable System** (VC, VI, VA) i **Subsequent System** (SC, SI, SA) |
| Temporal | E, RL, RC | Postaje **Threat**, ostaje samo **E** Exploit Maturity: A (Attacked), P (POC), U (Unreported), X |
| Environmental | CR/IR/AR + modified | Isto, plus MSI/MSA mogu biti **S (Safety)** |
| Supplemental | Ne postoji | **S** Safety, **AU** Automatable, **R** Recovery, **V** Value Density, **RE** Response Effort, **U** Provider Urgency (Clear/Green/Amber/Red); ne mijenjaju skor |
| Računanje | Formula | MacroVector tabela (ekspertsko rangiranje) |

Nomenklatura kaže šta je ušlo u skor: **CVSS-B** (samo base), **CVSS-BT** (base + threat), **CVSS-BE**, **CVSS-BTE**. Kad NVD ili vendor objavi samo base skor, to je CVSS-B i nije cijela priča. Redoslijed u vektoru je obavezan: Base (AV, AC, AT, PR, UI, VC, VI, VA, SC, SI, SA), pa E, pa environmental, pa supplemental.

```
$ /opt/tools/bin/python -c "
from cvss import CVSS4
b='CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'
for s in ['', '/E:A', '/E:P', '/E:U', '/E:A/CR:L/IR:L/AR:L']:
    c=CVSS4(b+s); print(f'{s or \"(base)\":22} {c.base_score} {c.severity}')"
(base)                 9.3 Critical
/E:A                   9.3 Critical
/E:P                   8.9 High
/E:U                   8.1 High
/E:A/CR:L/IR:L/AR:L    8.9 High
```

Uoči: E nedefinisan (X) se računa kao **Attacked**, najgori slučaj, pa je base i `E:A` isti 9.3. Tek kad znaš da exploit nije prijavljen (`E:U`), skor pada. Sa `SC:H/SI:H/SA:H` (uticaj i na sistem iza ranjivog) isti vektor daje 10.0.

> **Na ispitu:** razlike 3.1 i 4.0 koje se najčešće pitaju: v4 **nema Scope** (zamijenjen VC/VI/VA i SC/SI/SA), ima novu metriku **AT**, **UI** ima Passive/Active, **Temporal je postao Threat** sa samo Exploit Maturity, a **Supplemental** metrike (npr. Automatable, Safety) daju kontekst bez promjene skora.

## EPSS

CompTIA ga u ciljevima piše kao „First Exploitability Prediction Scoring System“; zvanično ime je **Exploit Prediction Scoring System** i održava ga **FIRST**. EPSS procjenjuje **vjerovatnoću (0–1) da će CVE biti eksploatisan u divljini u narednih 30 dana**. Skor se objavljuje svakog dana za svaki objavljeni CVE, uz **percentil** (koliki dio svih CVE-ova ima jednak ili niži skor).

| | CVSS | EPSS | CISA KEV |
|---|---|---|---|
| Pitanje | Koliko je ozbiljno ako se iskoristi? | Kolika je vjerovatnoća da će se iskoristiti uskoro? | Da li je već iskorišten? |
| Vrijednost | 0.0–10.0 | 0–1 i percentil | Da/ne (lista) |
| Mijenja se | Rijetko | Dnevno | Dodavanjem unosa |
| Održava | FIRST (skor daje vendor/NVD) | FIRST | CISA |

Format fajla u labu:

```
$ head -3 /opt/kurs/data/epss.csv
#model_version:v2026.06.15,score_date:2026-10-16T12:02:51Z
cve,epss,percentile
CVE-1999-0001,0.04753,0.91763
$ grep -E '^CVE-(2021-44228|2024-3094),' /opt/kurs/data/epss.csv
CVE-2021-44228,0.99999,1.0
CVE-2024-3094,0.909,0.99807
$ awk -F, 'NR>2 && $2>=0.1{n++} END{print n}' /opt/kurs/data/epss.csv
17317
```

(Brojevi zavise od dana kada je slika napravljena.) U ovom snimku manje od 5% od oko 390.000 CVE-ova ima EPSS ≥ 0.1. Zato EPSS dramatično smanjuje gomilu: od hiljada „High“ nalaza samo mali dio ima realnu vjerovatnoću napada.

Čitanje: EPSS 0.02 sa percentilom 0.85 znači „2% šanse u 30 dana, ali to je ipak više od 85% svih CVE-ova“. Percentil pokazuje relativni položaj, a vjerovatnoća apsolutnu procjenu.

> **Na ispitu:** EPSS ne mjeri uticaj, a CVSS ne mjeri vjerovatnoću. Kad dobiješ dva nalaza sa sličnim CVSS-om, viši EPSS ide prvi. Ako je CVE već u KEV-u, EPSS je sporedan: eksploatacija nije vjerovatna, nego potvrđena.

## CISA KEV

**Known Exploited Vulnerabilities (KEV)** katalog CISA objavljuje od novembra 2021. Kriteriji za upis: (1) CVE ID postoji, (2) postoje pouzdani dokazi o **aktivnoj eksploataciji** (javni PoC ili skeniranje nisu dovoljni), (3) postoji jasna radnja ispravke (zakrpa ili mitigacija). Za federalne civilne agencije u SAD-u katalog je obavezujući: BOD 22-01 (2021) zamijenjen je u junu 2026. direktivom **BOD 26-04** „Prioritizing Security Updates Based on Risk“, koja rokove određuje kombinacijom četiri faktora: javna izloženost imovine, KEV status, mogućnost automatizovane eksploatacije i tehnički uticaj (djelimična ili potpuna kontrola). Kad su sva četiri ispunjena, rok je **3 dana** uz forenzičku trijažu; rizik niže kategorije dobija duže rokove, do odlaganja na sljedeću nadogradnju. Za sve ostale organizacije KEV je preporuka i najbolji pojedinačni izvor „patchuj odmah“ signala.

```
$ jq '.count' /opt/kurs/data/kev.json
1748
$ jq '.vulnerabilities[] | select(.cveID=="CVE-2023-4966")
      | {cveID, product, dateAdded, dueDate, knownRansomwareCampaignUse}' /opt/kurs/data/kev.json
{
  "cveID": "CVE-2023-4966",
  "product": "NetScaler ADC and NetScaler Gateway",
  "dateAdded": "2023-10-18",
  "dueDate": "2023-11-08",
  "knownRansomwareCampaignUse": "Known"
}
```

Bitna polja: `requiredAction` (šta uraditi, kod Citrix Bleed i „kill all active and persistent sessions“, jer ukradene sesije preživljavaju zakrpu), `dueDate`, `knownRansomwareCampaignUse` (Known/Unknown), `cwes`, a od BOD 26-04 i `forensicTriage` (Yes/No): da li prije ili uz zakrpu treba provjeriti da li je sistem već kompromitovan.

Spajanje nalaza skenera sa KEV-om i EPSS-om (tipičan lab zadatak):

```
$ trivy image -q -f json -o r.json app:1
$ jq -r '.Results[].Vulnerabilities[]?.VulnerabilityID' r.json | sort -u > cves.txt
$ jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | grep -Fxf cves.txt
CVE-2021-44228
$ awk -F, 'NR==FNR{c[$1];next} ($1 in c)' cves.txt /opt/kurs/data/epss.csv | sort -t, -k2 -gr | head -3
CVE-2021-44228,0.99999,1.0
CVE-2022-42889,0.99931,0.9997
CVE-2020-14343,0.05984,0.93217
```

> **Na ispitu:** KEV je odgovor na kriterij **active exploitation**. Nalaz sa CVSS 7.5 koji je u KEV-u, na internet-facing sistemu, ide ispred CVSS 9.8 nalaza bez poznate eksploatacije na izolovanom sistemu.

## SSVC

**SSVC** (Stakeholder-Specific Vulnerability Categorization), razvijen na Carnegie Mellon SEI i prilagođen od CISA-e, ne daje broj nego **odluku** kroz stablo odlučivanja.

| Tačka odluke (CISA stablo) | Vrijednosti |
|---|---|
| **Exploitation** | None, Public PoC, Active |
| **Automatable** | No, Yes (mogu li koraci 1–4 kill chaina biti automatizovani) |
| **Technical Impact** | Partial, Total (potpuna kontrola nad sistemom) |
| **Mission Prevalence** | Minimal, Support, Essential |
| **Public Well-being Impact** | Minimal, Material, Irreversible |

| Odluka | Značenje |
|---|---|
| **Track** | Nema akcije sada; prati i popravi u standardnom ciklusu |
| **Track\*** | Isto, ali ima osobine koje traže bliže praćenje |
| **Attend** | Pažnja nadređenih; popravi brže od standardnog roka, moguće obavještavanje |
| **Act** | Pažnja nadređenih i rukovodstva; popravi što prije |

Primjer: Exploitation = Active, Automatable = Yes, Technical Impact = Total, Mission Prevalence = Essential → **Act**. Isti CVE sa Exploitation = None na sistemu Minimal prevalence → **Track**. Četiri faktora BOD 26-04 su očigledno izvedena iz istih ideja.

## Kontekst (context awareness)

| Kontekst | Značenje | Uticaj na prioritet |
|---|---|---|
| **External** | Dostupno sa interneta (web, VPN, mail gateway) | Najviši: bilo ko može pokušati, masovno skeniranje |
| **Internal** | Dostupno samo iz interne mreže | Srednji: napadač mora prvo ući (phishing, VPN), ali lateralno kretanje je realno |
| **Isolated** | Air-gapped ili strogo segmentiran sistem bez puta do njega | Niži: eksploatacija traži fizički pristup ili kompromitaciju posrednika |

Isti CVE ima različit prioritet zavisno od konteksta. U CVSS-u se to izražava environmental metrikama (MAV:N/A/L), u SSVC-u kroz exposure (dio CISA-ine primjene stabla) i Mission Prevalence.

Primjer prioritizacije (PBQ stil):

| # | CVE | CVSS | EPSS | KEV | Host | Kontekst | Prioritet |
|---|---|---|---|---|---|---|---|
| A | VPN gateway RCE | 9.8 | 0.94 | Da | vpn01 | External | **1** |
| B | Web app deserialization | 8.1 | 0.42 | Ne | shop01 (PCI) | External | **2** |
| C | Windows LPE | 7.8 | 0.15 | Da | ws-fin-* | Internal | **3** |
| D | Log4j u build serveru | 10.0 | 0.99 | Da | build-old | Isolated, bez mreže | **4** |
| E | Self-signed cert | 5.3 | 0.00 | Ne | intranet | Internal | **5** |

D ima najviši CVSS i EPSS, ali je izolovan, pa napadač nema put do njega. To ne znači „ignoriši“: popravlja se u planu, ali ne ispred izloženih sistema.

## Strategije ublažavanja

| Strategija | Šta znači | Primjer |
|---|---|---|
| **Attack surface management** | Kontinuirano otkrivanje i smanjenje izložene površine (EASM) | Gašenje nekorištenih servisa, zatvaranje portova, uklanjanje zaboravljenih poddomena i cloud resursa |
| **Secure coding best practices** | Ispravka uzroka u kodu, ne simptoma | Parametrizovani upiti, validacija ulaza, output encoding, bez tajni u kodu (SAST u CI) |
| **Patching and configuration management** | Zakrpe kroz kontrolisan proces i držanje baseline konfiguracije | Test → pilot grupa → produkcija, rollback plan; IaC i detekcija drifta |
| **Exceptions** | Formalno prihvatanje rizika kada se ne može popraviti | Potpis vlasnika rizika, obrazloženje, rok važenja, kompenzaciona kontrola, periodični pregled |
| **Compensating controls** | Druga kontrola smanjuje isti rizik | WAF pravilo (virtual patch), segmentacija, IPS potpis, isključivanje ranjive funkcije, pojačan nadzor |

Inhibitori ispravke koje CompTIA voli u scenarijima: **legacy sistemi** bez zakrpe, **proprietary** sistemi gdje vendor mora odobriti promjenu, **MOU/SLA** ugovori koji ograničavaju zastoje, **degradacija** funkcionalnosti, **organizaciona upravljačka struktura** (ko odobrava). Odgovor je tada izuzetak + kompenzaciona kontrola, nikada „ostavi kako jeste bez dokumentacije“.

> **Na ispitu:** zakrpa ne postoji ili se ne smije primijeniti (medicinski uređaj, sertifikovan OT) → **compensating control** (segmentacija, ACL, WAF) i dokumentovan **exception** sa rokom. Ako zakrpa postoji i sistem je izložen → patch, a WAF je samo privremena mjera dok se patch ne primijeni.

## Validacija ispravke (validation of remediation)

Ticket se ne zatvara kad admin kaže „patchovano“, nego kad se to provjeri:

1. **Rescan** istim (po mogućnosti credentialed) skenom: nalaz više ne postoji.
2. **Provjera verzije** na hostu (`dpkg -l openssl`, `trivy image` nove slike).
3. Za kompenzacionu kontrolu: dokaz da radi (WAF blokira test zahtjev, firewall pravilo odbija konekciju iz neovlaštenog segmenta).
4. Za KEV nalaze sa aktivnom eksploatacijom: provjera da sistem nije već kompromitovan (IOC-i, logovi, nepoznati nalozi, web shellovi). Zakrpa ne uklanja napadača koji je već unutra.
5. Ažuriranje metrika: vrijeme do ispravke, SLA usklađenost (modul 11).

```
$ trivy image -q --severity CRITICAL app:2
app:2 (debian 12.7)
Total: 0 (CRITICAL: 0)
```

## Rezime

- 2.2: prepoznaj alat po izlazu: **Angry IP Scanner** i **Masscan** (mapping), **Nmap**, **MSF**, **Maltego**, **Recon-ng** (multipurpose), **Burp**, **ZAP**, **Nikto** (web), **Nessus**, **Nuclei**, **OpenVAS** (vulnerability), **ScoutSuite**, **Prowler**, **Trivy**, **Checkov** (cloud/IaC), **Atomic Red Team** i **Caldera** (BAS, provjera detekcije).
- False negative je opasniji od false positive; credentialed sken i ažuran feed smanjuju oba.
- **CVSS** mjeri ozbiljnost; 3.1 ima Base/Temporal/Environmental i Scope, 4.0 ima Base/Threat/Environmental/Supplemental, metrike AT, VC/VI/VA + SC/SI/SA i UI Passive/Active.
- **EPSS** (FIRST) je vjerovatnoća eksploatacije u narednih 30 dana, dnevno ažurirana, sa percentilom.
- **CISA KEV** potvrđuje aktivnu eksploataciju; BOD 26-04 za federalne agencije veže rokove za izloženost, KEV, automatizovanost i tehnički uticaj.
- **SSVC** daje odluku Track / Track\* / Attend / Act iz Exploitation, Automatable, Technical Impact i misije.
- Kontekst (**external, internal, isolated**) i vrijednost imovine mijenjaju prioritet istog CVE-a.
- Ublažavanje: attack surface management, secure coding, patching i config management, exceptions i compensating controls; svaku ispravku **validiraj** ponovnim skenom.
