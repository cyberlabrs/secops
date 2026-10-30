## Problem: previše nalaza

Prvo skeniranje kontejnera ili flote servera obično vrati **hiljade** nalaza. Godišnje se objavi više desetina hiljada novih CVE-ova, a samo mali procenat se ikad iskoristi u stvarnim napadima. Upravljanje ranjivostima nije „popravi sve“, nego **popravi prvo ono što će te stvarno pogoditi**.

Ciklus:

1. **Inventar**: šta imaš (hostovi, imagei, paketi, SBOM)?
2. **Otkrivanje**: skeneri (Trivy, Grype, Inspector, Defender, Qualys…).
3. **Prioritizacija**: CVSS + EPSS + KEV + kontekst tvog okruženja.
4. **Sanacija**: zakrpa, nadogradnja, konfiguracija ili kompenzaciona kontrola.
5. **Provjera i metrike**: ponovno skeniranje, MTTR, poštovanje SLA rokova.

## CVE i CWE

| | CVE | CWE |
|---|---|---|
| Šta je | **konkretna** ranjivost u konkretnom proizvodu | **vrsta** slabosti |
| Primjer | CVE-2021-44228 (Log4Shell u Log4j) | CWE-89 (SQL injection), CWE-79 (XSS) |
| Ko održava | CVE Program (MITRE + CNA organizacije) | MITRE |

**NVD** (NIST) dodaje CVSS ocjene i CPE oznake proizvoda. Od 2024. NVD kasni sa obradom, pa se sve više koriste i drugi izvori: ocjene samog proizvođača (CNA), GitHub Advisory Database, OSV.dev, CISA Vulnrichment.

## CVSS 4.0

**CVSS** (Common Vulnerability Scoring System, FIRST) ocjenjuje **ozbiljnost** od 0 do 10. Verzija 4.0 je objavljena u novembru 2023. Mnogi izvori i alati i dalje prikazuju 3.1, pa uvijek provjeri koja verzija stoji uz broj.

| Grupa metrika | Šta mjeri | Ko je postavlja |
|---|---|---|
| **Base** | svojstva same ranjivosti | proizvođač / NVD |
| **Threat** (u 3.1 *Temporal*) | da li postoji exploit (`E`) | korisnik / threat intel |
| **Environmental** | važnost sistema kod tebe, kompenzacione kontrole | ti |
| **Supplemental** | dodatni kontekst (Safety, Automatable, Recovery…), **ne mijenja** ocjenu | proizvođač / ti |

Ključne Base metrike u 4.0:

- **AV** (Attack Vector): Network, Adjacent, Local, Physical
- **AC** (Attack Complexity) i novi **AT** (Attack Requirements)
- **PR** (Privileges Required), **UI** (User Interaction: None, Passive, Active)
- Uticaj na **ranjivi sistem** (VC, VI, VA) i odvojeno na **naredne sisteme** (SC, SI, SA). Ovo je zamijenilo nejasni „Scope“ iz 3.1.

Nazivi ocjena: **CVSS-B** (samo Base), **CVSS-BT** (Base + Threat), **CVSS-BE**, **CVSS-BTE**.

| Ocjena | Ozbiljnost |
|---|---|
| 0.1 – 3.9 | Low |
| 4.0 – 6.9 | Medium |
| 7.0 – 8.9 | High |
| 9.0 – 10.0 | Critical |

> **CVSS mjeri ozbiljnost, a ne rizik.** CVSS 9.8 u biblioteci koju tvoj kod nikad ne poziva, na sistemu bez mrežnog pristupa, manje je hitan od CVSS 7.5 na javnom VPN uređaju koji se aktivno napada.

## EPSS

**EPSS** (Exploit Prediction Scoring System, FIRST) daje **vjerovatnoću (0 do 1) da će CVE biti iskorišten u stvarnim napadima u narednih 30 dana**. Ocjene se objavljuju svaki dan za svaki CVE. Aktuelni model je **EPSS v4**, objavljen 17. marta 2025.

- **Score** je apsolutna vjerovatnoća, npr. 0.153 = 15.3%.
- **Percentil** pokazuje gdje je CVE u odnosu na sve ostale. Ocjena od 10% je već oko 88. percentila, jer većina CVE-ova ima vrlo nisku vjerovatnoću.
- Prikazuj oboje: „15.3% (92. percentil)“.

EPSS odgovara na pitanje **„hoće li ovo neko napasti?“**, a CVSS na pitanje **„koliko bi bilo loše?“**. Trebaju ti oba.

## CISA KEV

**Known Exploited Vulnerabilities** katalog (CISA) sadrži CVE-ove za koje postoje **dokazi aktivnog iskorištavanja**. Američke federalne agencije ih moraju zakrpiti u zadanom roku, a za sve ostale je to najjači signal prioriteta. Polje `knownRansomwareCampaignUse` označava upotrebu u ransomware kampanjama.

Ako je CVE u KEV-u, a sistem je izložen, to nije stvar za sljedeći sprint.

## Prioritizacija u praksi

Jednostavna i odbranjiva logika:

| Prioritet | Uslov | Primjer SLA |
|---|---|---|
| **P1** | u KEV-u, **ili** EPSS ≥ 0.1 na sistemu izloženom internetu | 48h – 7 dana |
| **P2** | CVSS ≥ 7 i (izložen **ili** EPSS ≥ 0.01) | 30 dana |
| **P3** | CVSS ≥ 7, interni sistem, nizak EPSS | 90 dana |
| **P4** | ostalo | redovni ciklus ažuriranja |

Pragovi su primjer. Svaka firma ih podešava prema apetitu za rizik. Postoji i formalniji model, **SSVC** (Stakeholder-Specific Vulnerability Categorization, CISA), koji vodi kroz stablo odluka: iskorištavanje, automatizovanost, tehnički uticaj, misija.

Kontekst koji samo ti znaš:

- Da li je ranjivi paket uopšte **učitan i dostupan** (reachability)?
- Da li je sistem izložen internetu?
- Kakvi su podaci na sistemu i koliko je kritičan za biznis?
- Postoje li kompenzacione kontrole (WAF pravilo, isključena funkcionalnost)?

## SBOM i VEX

- **SBOM** (Software Bill of Materials): popis svih komponenti i verzija u artefaktu. Formati: **CycloneDX** i **SPDX**. Alati: Syft, Trivy, `docker sbom`. Kad izađe novi kritični CVE, SBOM odgovara na pitanje „gdje sve to imamo?“ za minut umjesto za sedmicu.
- **VEX** (Vulnerability Exploitability eXchange): izjava proizvođača da li ga CVE stvarno pogađa: `not_affected`, `affected`, `fixed`, `under_investigation`, uz obrazloženje (npr. `vulnerable_code_not_in_execute_path`). VEX smanjuje lažne pozitive u izvještajima skenera.

## Kontejneri i cloud

- Manja slika znači manje paketa i manje CVE-ova: distroless, Alpine, `-slim` varijante, multi-stage build.
- Gradi sliku iznova redovno, ne samo kad mijenjaš kod: bazna slika dobija zakrpe.
- Skeniraj u CI-ju (fail na KEV ili kritične ranjivosti sa popravkom) **i** u registru, jer se novi CVE-ovi pojavljuju za stare slike.
- Upravljani servisi (RDS, Lambda runtime) prebacuju dio krpljenja na provajdera (*shared responsibility*).

## Metrike

- **MTTR** (mean time to remediate) po prioritetu.
- Procenat nalaza u SLA roku.
- Broj izloženih sistema sa KEV ranjivostima. Ovaj broj treba stalno težiti nuli.
- Starost najstarijeg otvorenog P1/P2 nalaza.

## Rezime

- CVE je konkretna ranjivost, CWE vrsta slabosti.
- CVSS je ozbiljnost, EPSS vjerovatnoća napada, KEV dokaz napada. Kontekst odlučuje.
- SBOM ti govori gdje je ranjiva komponenta, a VEX da li je stvarno ranjiva.
- Mjeri MTTR i SLA, a ne broj nalaza.
