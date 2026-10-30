## Zašto inženjeru trebaju okviri

Okviri su zajednički jezik između inženjera, menadžmenta, auditora i kupaca. Kad kupac pita „imate li SOC 2?“ ili auditor traži „dokaz za kontrolu A.8.8“, ti treba da znaš šta to znači i kako tvoj pipeline, IAM i logovi daju taj dokaz.

| Okvir | Vrsta | Pitanje na koje odgovara |
|---|---|---|
| **NIST CSF 2.0** | okvir za upravljanje rizikom | Kako organizovati cijeli sigurnosni program? |
| **CIS Controls v8.1** | prioritizovana lista tehničkih kontrola | Šta konkretno uraditi, i kojim redom? |
| **ISO/IEC 27001:2022** | certifikabilan standard za ISMS | Imamo li sistem upravljanja sigurnošću koji neko nezavisan može certifikovati? |
| **SOC 2** | izvještaj nezavisnog revizora (AICPA) | Može li kupac vjerovati našim kontrolama? |

## NIST Cybersecurity Framework 2.0

Objavljen u februaru 2024. Namijenjen je **svim** organizacijama, ne samo kritičnoj infrastrukturi. Ima **šest funkcija**:

| Funkcija | Oznaka | Suština | Primjer iz DevOps svijeta |
|---|---|---|---|
| **Govern** | GV | strategija, uloge, politike, rizik lanca snabdijevanja | ko je vlasnik cloud naloga, politika za tajne |
| **Identify** | ID | inventar imovine, procjena rizika | inventar resursa, SBOM, klasifikacija podataka |
| **Protect** | PR | zaštitne kontrole | IAM, MFA, enkripcija, hardening, obuka |
| **Detect** | DE | otkrivanje napada i anomalija | GuardDuty, Defender, SIEM pravila, Falco |
| **Respond** | RS | reakcija na incident | runbookovi, izolacija, komunikacija |
| **Recover** | RC | oporavak | backup i restore, testiranje oporavka, lekcije |

**Govern** je novi u 2.0 i stoji u centru: bez jasnih uloga, politika i nadzora ostalih pet funkcija se ne drži zajedno.

Struktura: funkcija → **kategorija** (npr. PR.AA Identity Management, Authentication, and Access Control) → **podkategorija** (konkretan ishod). CSF opisuje **ishode**, a ne alate. Uz njega se koriste **profili** (trenutni i ciljni) i **tiers** (1 do 4, zrelost upravljanja rizikom).

## CIS Critical Security Controls v8.1

18 kontrola sa ukupno 153 zaštitne mjere (*safeguards*), poređanih po tome šta najviše smanjuje rizik:

| # | Kontrola | # | Kontrola |
|---|---|---|---|
| 1 | Inventory and Control of Enterprise Assets | 10 | Malware Defenses |
| 2 | Inventory and Control of Software Assets | 11 | Data Recovery |
| 3 | Data Protection | 12 | Network Infrastructure Management |
| 4 | Secure Configuration of Enterprise Assets and Software | 13 | Network Monitoring and Defense |
| 5 | Account Management | 14 | Security Awareness and Skills Training |
| 6 | Access Control Management | 15 | Service Provider Management |
| 7 | Continuous Vulnerability Management | 16 | Application Software Security |
| 8 | Audit Log Management | 17 | Incident Response Management |
| 9 | Email and Web Browser Protections | 18 | Penetration Testing |

**Implementation Groups (IG):**

- **IG1**: „osnovna sajber higijena“, minimum za svaku organizaciju (male firme, ograničen IT tim).
- **IG2**: IG1 + mjere za organizacije sa više sistema i osjetljivijim podacima.
- **IG3**: sve mjere, za organizacije koje su meta sofisticiranih napadača.

Verzija 8.1 dodala je funkciju **Govern** u mapiranje mjera, da bi se uskladila sa NIST CSF 2.0.

> Ne miješaj **CIS Controls** (šta raditi na nivou organizacije) i **CIS Benchmarks** (detaljne postavke za konkretan sistem, npr. Ubuntu 24.04 ili EKS). Benchmarks su način da ispuniš kontrolu 4.

## ISO/IEC 27001:2022

Međunarodni standard za **ISMS** (Information Security Management System). Firma se **certifikuje** kroz eksternu reviziju, certifikat važi 3 godine uz godišnje nadzorne revizije.

- Glavni dio (klauzule 4 do 10) traži **sistem upravljanja**: kontekst, liderstvo, procjenu i tretman rizika, mjerenje, internu reviziju i stalno poboljšanje (Plan-Do-Check-Act).
- **Annex A** ima **93 kontrole** u četiri teme: organizacione (37), ljudske (8), fizičke (14) i tehnološke (34). Verzija 2022 dodala je npr. *threat intelligence*, *cloud services security*, *secure coding*, *data masking* i *configuration management*.
- **Statement of Applicability (SoA)**: dokument koji za svaku od 93 kontrole kaže da li se primjenjuje i zašto.
- Certifikati na staroj verziji (2013) prestali su važiti krajem oktobra 2025.

**ISO/IEC 27002** je prateći vodič sa uputstvima kako implementirati svaku kontrolu iz Annexa A.

## SOC 2

Izvještaj (ne certifikat) nezavisnog CPA revizora prema AICPA **Trust Services Criteria**:

| Kriterij | Obavezan? |
|---|---|
| **Security** (Common Criteria) | uvijek |
| Availability | opcionalno |
| Processing Integrity | opcionalno |
| Confidentiality | opcionalno |
| Privacy | opcionalno |

- **Type I**: da li su kontrole **dobro dizajnirane** u jednom trenutku.
- **Type II**: da li su kontrole **stvarno radile** tokom perioda (obično 3 do 12 mjeseci). Kupci uglavnom traže Type II.

Za inženjera SOC 2 znači **dokaze**: logove promjena, odobrene pull requestove, revizije pristupa, dokaze o backupu i testiranju oporavka, offboarding tikete. Automatizovani dokazi (alati kao Vanta, Drata, Secureframe) uštede mjesece rada.

## Regulativa koja te može pogoditi

- **GDPR**: zaštita podataka o ličnosti građana EU; važi i za firme van EU koje im nude usluge. Prijava povrede u roku od 72 sata.
- **NIS2**: EU direktiva o kibernetičkoj sigurnosti za „bitne“ i „važne“ subjekte (energija, transport, zdravstvo, digitalna infrastruktura, cloud provajderi…), sa ličnom odgovornošću uprave i rokovima prijave incidenta (rano upozorenje u 24 sata).
- **DORA**: EU uredba za digitalnu otpornost finansijskog sektora i njegovih ICT dobavljača, u primjeni od januara 2025.
- **EU Cyber Resilience Act**: sigurnosni zahtjevi za proizvode sa digitalnim elementima (hardver i softver), uključujući obavezu prijave aktivno iskorištenih ranjivosti.
- Lokalni zakoni o informacionoj sigurnosti i zaštiti podataka u BiH, Srbiji, Hrvatskoj i Crnoj Gori se usklađuju sa EU pravilima. Za konkretne obaveze provjeri važeći propis i pravnu službu.

## Kako ovo povezati sa svakodnevnim radom

| Tvoj posao | NIST CSF | CIS | ISO 27001 Annex A (primjer) |
|---|---|---|---|
| Terraform + Checkov u pipeline-u | PR | 4, 16 | A.8.9 Configuration management |
| Trivy skeniranje slika | ID | 7 | A.8.8 Management of technical vulnerabilities |
| SSO + MFA + PIM | PR | 5, 6 | A.5.15–A.5.18, A.8.5 |
| CloudTrail u centralni log nalog | DE | 8 | A.8.15 Logging |
| Backup sa testom vraćanja | RC | 11 | A.8.13 Information backup |
| Incident runbook | RS | 17 | A.5.24–A.5.28 |

Jedna dobro dokumentovana tehnička kontrola daje dokaz za više okvira odjednom. Zato zreli timovi održavaju **jednu** listu kontrola sa mapiranjem na sve okvire koje moraju ispuniti.

## Rezime

- NIST CSF 2.0: šest funkcija, Govern je nova i centralna.
- CIS Controls v8.1: 18 kontrola, 153 mjere, IG1 je obavezni minimum.
- ISO 27001:2022: certifikabilan ISMS, 93 kontrole u Annex A, SoA.
- SOC 2: izvještaj revizora; Type II dokazuje da kontrole rade kroz vrijeme.
- Tehnički rad mapiraj na okvire jednom i koristi ga kao dokaz svuda.
