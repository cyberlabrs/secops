## Šta je ATT&CK

**MITRE ATT&CK** je javna baza znanja o tome kako se napadači stvarno ponašaju, sastavljena iz izvještaja o stvarnim incidentima. Daje svima isti rječnik: kad analitičar kaže „T1053.003“, svaki SOC na svijetu zna da se radi o perzistenciji preko crona.

Postoje tri matrice: **Enterprise** (Windows, Linux, macOS, cloud, kontejneri, mreža), **Mobile** i **ICS**.

> Stanje u oktobru 2026: aktuelna je verzija **ATT&CK v19** (april 2026, uz ažuriranje v19.x). Enterprise ima **15 taktika, 222 tehnike i 475 podtehnika**. Prije v19 bilo je 14 taktika.

## TTP: taktike, tehnike, procedure

| Nivo | Pitanje | Primjer |
|---|---|---|
| **Taktika** | **Zašto?** Cilj napadača u tom trenutku | Persistence (TA0003) |
| **Tehnika** | **Kako?** Opšti način postizanja cilja | Scheduled Task/Job (T1053) |
| **Podtehnika** | Konkretnija varijanta | Cron (T1053.003) |
| **Procedura** | Tačno kako je to uradila konkretna grupa ili malver | grupa X dodaje liniju u `/etc/cron.d/` koja svakih 10 minuta preuzima skriptu |

Uz to ATT&CK opisuje i **grupe** (npr. APT29), **softver** (malver i alati), **kampanje**, **mitigacije** (M-oznake) i **detekcije**. Od verzije v18 detekcije su organizovane kao *Detection Strategies* i *Analytics*, vezane za konkretne izvore podataka.

## 15 Enterprise taktika (v19)

| ID | Taktika | Cilj napadača |
|---|---|---|
| TA0043 | Reconnaissance | prikupiti informacije za planiranje |
| TA0042 | Resource Development | pripremiti infrastrukturu, naloge, alate |
| TA0001 | Initial Access | ući u okruženje |
| TA0002 | Execution | pokrenuti kod |
| TA0003 | Persistence | zadržati pristup nakon restarta i promjene lozinki |
| TA0004 | Privilege Escalation | dobiti veća prava |
| TA0005 | **Stealth** | sakriti aktivnost tako da izgleda kao normalno ponašanje |
| TA0112 | **Defense Impairment** | onesposobiti sigurnosne mehanizme, alate i logove da branioci ne vide ili ne vjeruju onome što vide |
| TA0006 | Credential Access | ukrasti kredencijale |
| TA0007 | Discovery | upoznati okruženje |
| TA0008 | Lateral Movement | preći na druge sisteme |
| TA0009 | Collection | prikupiti ciljane podatke |
| TA0011 | Command and Control | komunicirati sa kompromitovanim sistemima |
| TA0010 | Exfiltration | iznijeti podatke |
| TA0040 | Impact | manipulisati, prekinuti ili uništiti sisteme i podatke |

**Promjena u v19:** stara taktika *Defense Evasion* podijeljena je na **Stealth** (zadržala je ID TA0005) i novu **Defense Impairment** (TA0112). Razlika je bitna za detekciju: skrivanje (npr. maskiranje imena procesa) se otkriva drugačije od aktivnog gašenja odbrane (npr. zaustavljanje EDR agenta ili brisanje logova). Stariji materijali, alati i kursevi i dalje pominju 14 taktika i Defense Evasion.

Taktike nisu strogi redoslijed. Napadač se vraća na Discovery nakon svakog lateralnog pomaka, a ista tehnika može služiti za više taktika (npr. validni nalozi su i Initial Access i Persistence).

## Najčešće Linux i cloud tehnike koje braniš

| Tehnika | Taktika | Šta tražiš |
|---|---|---|
| T1078 Valid Accounts | Initial Access, Persistence… | prijave iz neobičnih lokacija, stari nalozi |
| T1190 Exploit Public-Facing Application | Initial Access | ranjive web aplikacije, VPN-ovi |
| T1059.004 Unix Shell | Execution | neobični shell procesi ispod web servera |
| T1053.003 Cron | Persistence | nove linije u `/etc/cron*`, `/var/spool/cron` |
| T1098.004 SSH Authorized Keys | Persistence | izmjene `authorized_keys` |
| T1136.001 Local Account | Persistence | novi korisnici, posebno sa UID 0 |
| T1543.002 Systemd Service | Persistence | novi unit fajlovi u `/etc/systemd/system` |
| T1546.004 Unix Shell Configuration Modification | Persistence | izmjene `.bashrc`, `/etc/profile.d/` |
| T1552.005 Cloud Instance Metadata API | Credential Access | pozivi na `169.254.169.254` iz aplikacija |
| T1496 Resource Hijacking | Impact | kripto rudari: CPU 100%, konekcije na mining poolove |

## Kako SOC i DevSecOps koriste ATT&CK

1. **Mapiranje detekcija**: svako pravilo u SIEM-u dobija oznaku tehnike (`attack.t1053.003` u Sigma pravilima).
2. **Analiza pokrivenosti**: u **ATT&CK Navigatoru** obojiš tehnike koje detektuješ i vidiš rupe.
3. **Threat-informed defense**: kreni od grupa koje napadaju tvoju industriju, uzmi njihove tehnike i provjeri pokrivenost baš za njih.
4. **Purple teaming / emulacija**: Atomic Red Team ima male testove po tehnici (npr. `T1053.003`), pa provjeriš da li se alarm zaista pali.
5. **Izvještaji o incidentima**: hronologija napada opisana tehnikama je jasna i uporediva.

> Pokrivenost nije binarna. Jedno pravilo za T1053.003 ne znači da je cron perzistencija pokrivena u svim varijantama. Navigator koristi skalu (npr. 0 do 3), a ne da/ne.

## Pyramid of Pain

David Bianco je poređao indikatore po tome koliko napadača **boli** kad ih blokiraš:

| Nivo | Indikator | Bol za napadača |
|---|---|---|
| vrh | **TTP-ovi** (ponašanje) | ogroman: mora promijeniti način rada |
| | Alati | izazovan |
| | Artefakti na mreži i hostu | dosadan |
| | Domeni | jednostavan |
| | IP adrese | lak |
| dno | Hash vrijednosti | trivijalan: promijeni jedan bajt |

Zato se zrele detekcije pišu za **ponašanje**, npr. „web server proces pokreće shell“, a ne za hash konkretnog malvera.

## Cyber Kill Chain i ATT&CK

Lockheed Martin Kill Chain ima 7 faza (Reconnaissance, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives). Dobar je za objašnjavanje menadžmentu, ali je previše grub za detekciju. ATT&CK je detaljniji i pokriva i ono što se dešava **nakon** ulaska, gdje braniocu treba najviše pomoći.

## Rezime

- Taktika je zašto, tehnika kako, procedura tačan način.
- v19: 15 Enterprise taktika; Defense Evasion je podijeljen na Stealth (TA0005) i Defense Impairment (TA0112).
- Mapiraj detekcije na tehnike, mjeri pokrivenost i testiraj je emulacijom.
- Detektuj ponašanje (TTP), ne samo hash i IP.
