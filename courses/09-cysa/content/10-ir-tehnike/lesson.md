## Cilj ispita: 3.3

**3.3 Given a scenario, implement incident response techniques.** Ovo je cilj sa najviše podtema u domenu 3 i čest izvor PBQ pitanja (redoslijed koraka, chain of custody, timeline). CS0-004 navodi:

- **pripremu**: incident response plan, communication plan, playbookovi, uloge, trening (tabletop, simulacija),
- **rad sa podacima**: log collection, log correlation, log augmentation and enrichment, alerts and notifications,
- **analizu**: triage, timeline, severity and impact, prioritization,
- **dokaze**: chain of custody, data integrity validation, preservation, legal hold,
- **akciju**: isolating affected targets, escalation, remediation and verification, release from isolation, restoration,
- **zatvaranje**: root cause analysis (RCA), corrective action development.

Poslije modula treba da znaš da za dati scenarij izabereš **sljedeći ispravan korak**, ispravno rukuješ dokazima i obrazložiš kada se host smije vratiti u mrežu.

## Planovi, playbookovi i uloge

### Incident response plan i communication plan

| Dokument | Sadržaj | Ko ga odobrava |
|---|---|---|
| **IR policy** | Zašto i ko: ovlaštenja CSIRT-a, definicija incidenta, obaveze | Uprava |
| **Incident response plan** | Kako organizacija odgovara: faze, uloge, kriterijumi ozbiljnosti, eskalacija, kontakti, metrike | CISO/uprava |
| **Communication plan** | Ko, kome, kada i kojim kanalom komunicira: interno, pravni tim, PR, regulator, policija, klijenti; **out-of-band** kanali | IR lider, pravni tim, PR |
| **Playbook** | Konkretni koraci za **tip** incidenta (phishing, ransomware, kompromitovan nalog, DDoS) | SOC/IR tim |
| **Runbook** | Tehnička uputstva za jednu operaciju (kako izolovati host u EDR-u, kako resetovati krbtgt) | Tim koji održava sistem |

Communication plan mora predvidjeti da je primarni kanal možda kompromitovan: ako napadač čita email domene, tim koristi **out-of-band** komunikaciju (zaseban chat tenant, telefon, Signal grupa). Detalje o stakeholderima obrađuje modul 11 (4.2).

### Playbook

Playbook daje dosljednost i brzinu, posebno kad je dio **SOAR** automatizacije (kao u SC-200 kursu sa Sentinel playbookovima). Tipična struktura:

```
Playbook: Phishing sa zlonamjernim prilogom
Okidač:   Prijava korisnika (Report phishing) ili alarm email gateway-a
1. Trijaža: izvuci zaglavlja, URL-ove, hash priloga; obogati (VT, TI platforma)
2. Obim:    pretraži mail logove - ko je još primio isti Message-ID/hash
3. Odluka:  klik/otvaranje?  NE -> purge poruka, zatvori kao "contained"
                             DA -> eskaliraj na Tier 2, idi na korak 4
4. Containment: izoluj host (EDR), revoke sesije, reset lozinke, blok domena
5. Dokazi:  memorijski dump i triage paket prije reimagea
6. Eradication/Recovery: reimage, restore korisničkih fajlova
7. Zatvaranje: tiket, IoC u blocklistu, metrika (MTTD/MTTR)
```

### Uloge

| Uloga | Odgovornost |
|---|---|
| **Incident commander / IR lead** | Vodi incident, donosi odluke, koordinira, jedini izvor statusa |
| **SOC Tier 1** | Trijaža alarma, prva validacija, eskalacija po pravilima |
| **SOC Tier 2/3, IR analitičar** | Dubinska analiza, containment, hunting |
| **Forenzičar** | Prikupljanje i analiza dokaza, chain of custody |
| **System/network owneri, IT** | Izvođenje promjena (izolacija, patch, restore) |
| **Pravni tim** | Obaveze obavještavanja, legal hold, kontakt sa policijom |
| **PR / komunikacije** | Eksterne izjave, mediji, klijenti |
| **HR** | Incidenti sa zaposlenima (insajder) |
| **Uprava / izvršni sponzor** | Poslovne odluke: gašenje servisa, plaćanje, javna objava |

> **Na ispitu:** razlikuj **plan** (organizaciono: ko, kada, eskalacija) od **playbooka** (koraci za tip incidenta) i **runbooka** (tehnička procedura). Ako je email kompromitovan, odgovor je **out-of-band** komunikacija. Izjave medijima daje **PR**, ne analitičar.

### Trening: tabletop i simulacija

| Vrsta | Opis | Prednost | Mana |
|---|---|---|---|
| **Tabletop** | Diskusija nad scenarijem za stolom, moderator uvodi „injectove“ | Jeftino, uključuje upravu i pravni tim, otkriva rupe u planu i komunikaciji | Ne testira tehničke kontrole |
| **Simulation** (functional exercise, purple team, cyber range) | Realna ili emulirana aktivnost u okruženju, tim stvarno reaguje | Testira alate, detekcije, vrijeme reakcije | Skuplje, rizik po produkciju |
| **Full-scale** | Cijela organizacija, više timova, često i eksterni partneri | Najrealnije | Najskuplje i najteže organizovati |

> **Na ispitu:** „Najmanje skupo, uključiti izvršne direktore, provjeriti communication plan“ → **tabletop**. „Provjeriti da li SOC zaista detektuje i zadrži napad“ → **simulation**.

## Log collection, korelacija i obogaćivanje

Ovo je poznato iz detection laba (Wazuh agent → manager, Sigma → SIEM upiti), pa ovdje samo ispitni ugao.

| Pojam | Značenje | Primjer |
|---|---|---|
| **Log collection** | Centralno prikupljanje (agent, syslog, API, WEF) uz **vremensku sinhronizaciju** (NTP) i retenciju | Windows Security, Sysmon, auth.log, firewall, proxy, cloud audit (CloudTrail) |
| **Log correlation** | Povezivanje događaja iz više izvora u jedan obrazac | 20 neuspjelih prijava + 1 uspješna sa istog IP-a + novi MFA uređaj |
| **Log augmentation / enrichment** | Dodavanje konteksta događaju | GeoIP, reputacija IP-a (TI), vlasnik i kritičnost asseta iz CMDB-a, korisnikov odjel iz IdP-a |
| **Alerts and notifications** | Pravila generišu alarm; notifikacija ide pravoj osobi pravim kanalom po ozbiljnosti | Kritičan alarm → pager dežurnom; nizak → red u SIEM-u |

Bez NTP-a korelacija i timeline su nepouzdani. Primjer obogaćivanja jednog događaja sa `jq`:

```
$ jq -s '.[0] as $a | .[1] as $cmdb | $a + {asset: $cmdb[$a.host]}' alert.json cmdb.json
{
  "time": "2026-10-02T08:14:11Z",
  "host": "FIN-LT-07",
  "dst_ip": "203.0.113.45",
  "rule": "Beaconing to rare domain",
  "asset": { "owner": "Računovodstvo", "criticality": "high", "pii": true }
}
```

Isti alarm na laptopu sa PII podacima ima veći prioritet nego na test VM-u: to je smisao obogaćivanja.

> **Na ispitu:** „Analitičari troše vrijeme tražeći vlasnika i kritičnost hosta za svaki alarm“ → **enrichment** (CMDB/asset inventory u SIEM-u). „Događaji iz firewall-a i AD-a imaju različito vrijeme“ → **NTP sinhronizacija** prije korelacije.

## Triage, timeline, ozbiljnost i prioritet

### Triage

**Triage** je brza procjena alarma: da li je stvaran, koliko je ozbiljan i ko ga preuzima. Pitanja trijaže:

1. Da li je **true positive** ili false positive (provjera konteksta, poznati benigni uzrok)?
2. Koji **asset** i koji **korisnik**? Kolika je kritičnost?
3. Da li je aktivno (napadač je još unutra) ili istorijski?
4. Koliki je **obim** (scope): jedan host ili više?
5. Treba li **eskalacija** odmah?

### Establishment of a timeline

Timeline je hronološki niz događaja iz svih izvora, u **UTC**-u. Služi za određivanje **patient zero**, ulaznog vektora, **dwell time**-a i obima. Primjer kombinovanja izvora:

```
2026-10-02T08:09:55Z  mail-gw   Delivered  from=billing@supp1ier.example  to=ana@firma.ba  att=Faktura_10.docm
2026-10-02T08:14:02Z  FIN-LT-07 Sysmon 1   WINWORD.EXE -> powershell.exe -nop -w hidden -enc ...
2026-10-02T08:14:11Z  proxy     CONNECT    FIN-LT-07 -> cdn-upd4te.example:443
2026-10-02T08:16:40Z  FIN-LT-07 4698       Scheduled task created: \Microsoft\UpdateCheck
2026-10-02T09:02:47Z  FIN-LT-11 4624 (3)   Logon type 3 from FIN-LT-07 user=svc_backup
2026-10-02T09:03:15Z  FIN-LT-11 7045       Service installed: PSEXESVC
```

Iz ovoga čitaš: vektor je phishing prilog, patient zero je `FIN-LT-07`, napadač se lateralno kreće sa servisnim nalogom `svc_backup` (dakle i taj nalog treba resetovati), a dwell time do otkrivanja je razlika između 08:14 i trenutka prvog alarma.

Na Linuxu sličan materijal daju `journalctl --since` i `auth.log`, a za mrežu `tshark`:

```
$ tshark -r incident.pcap -q -z conv,ip | head -6
IPv4 Conversations
                                   <-     ->     Total    Relative   Duration
10.10.20.17  <-> 203.0.113.45      412 KB  9 MB   9.4 MB   0.03      5400.12
10.10.20.17  <-> 10.10.1.5          31 KB  44 KB  75 KB    12.10     3.20
```

Asimetrija (9 MB odlazno ka eksternoj adresi) ukazuje na moguću exfiltraciju i ulazi u timeline.

### Determining severity and impact; prioritization

| Dimenzija | Pitanje | Primjeri |
|---|---|---|
| **Functional impact** | Koliko je pogođeno poslovanje? | None, low, medium, high (servis nedostupan) |
| **Information impact** | Šta je sa podacima? | None, privacy breach (PII), proprietary breach, integrity loss |
| **Recoverability** | Koliko je teško oporaviti? | Regular, supplemented (dodatni resursi), extended (nepredvidivo), not recoverable |
| **Scope** | Koliko sistema, korisnika, lokacija? | 1 host vs cijeli domen |
| **Kritičnost asseta** | Koliko je sistem važan? | Domain controller, platni sistem, PHI |

Prioritet je kombinacija ozbiljnosti, kritičnosti asseta i hitnosti (da li napad traje). Tipična matrica:

| Ozbiljnost \ Kritičnost | Niska | Srednja | Visoka |
|---|---|---|---|
| **Visoka** (aktivno, podaci, širenje) | P2 | P1 | P1 |
| **Srednja** | P3 | P2 | P1 |
| **Niska** | P4 | P3 | P2 |

> **Na ispitu:** kad su dva incidenta istovremena, prioritet ima onaj sa većim **poslovnim uticajem** i **aktivnim** napadom (npr. kompromitovan DC ili exfiltracija PII), a ne onaj sa „strašnijim“ imenom malvera. Ako je oporavak „not recoverable“ (npr. podaci objavljeni), fokus prelazi na obavještavanje.

## Prikupljanje dokaza

Ako postoji šansa za sudski postupak, disciplinski postupak ili regulatornu istragu, dokazi moraju biti **prihvatljivi** (admissible). Četiri ključna pojma iz ciljeva:

### Chain of custody

Dokumentovan trag **ko je imao dokaz, kada, gdje i zašto**, od prikupljanja do suda. Svaka predaja se bilježi i potpisuje. Ako lanac ima rupu, odbrana može osporiti dokaz.

```
Dokaz #: IR-2026-041-E03     Opis: SSD 512 GB, serijski S4EVNX0R..., iz FIN-LT-07
SHA-256 (image): 9f2c...e41a
Datum/vrijeme (UTC)   Predao             Primio             Svrha                  Lokacija
2026-10-02 10:05      M. Kovač (IT)      A. Vojić (IR)      Prikupljanje           Kancelarija 3.12
2026-10-02 11:30      A. Vojić (IR)      Evidencija (sef)   Pohrana                Sef forenzike #2
2026-10-04 09:00      Evidencija (sef)   L. Petrić (DFIR)   Analiza (kopija)       Forenzički lab
```

### Data integrity validation

Hash originala i kopije mora biti isti. Analiza se radi **na kopiji**, uz **write blocker** pri izradi imagea.

```
$ sha256sum /evidence/FIN-LT-07.E01 /evidence/work/FIN-LT-07-copy.E01
9f2c0b...e41a  /evidence/FIN-LT-07.E01
9f2c0b...e41a  /evidence/work/FIN-LT-07-copy.E01
$ sha256sum -c FIN-LT-07.sha256
/evidence/FIN-LT-07.E01: OK
```

Isto važi za logove i pcap-ove izvučene iz SIEM-a: zabilježi hash pri eksportu.

### Preservation

Čuvanje dokaza u izvornom stanju: poštovanje **order of volatility** (CPU/cache → RAM → mrežne konekcije i procesi → swap/temp → disk → udaljeni logovi → arhive), snimanje memorije **prije** gašenja, snapshot cloud diska, izvoz logova prije nego ih rotacija obriše, sigurna pohrana (sef, kontrola pristupa). Ne radi se reimage prije prikupljanja.

### Legal hold

Nalog pravnog tima (ili suda) da se određeni podaci **ne brišu niti mijenjaju**, čak ni po redovnoj politici retencije, zbog očekivanog ili tekućeg spora. Primjer: rotacija SIEM logova nakon 90 dana se suspenduje za pogođene sisteme i korisnike; mailbox se stavlja na hold u M365.

| Pojam | Ključna riječ |
|---|---|
| Chain of custody | **Ko** je imao dokaz i kada (dokumentacija predaja) |
| Data integrity validation | **Hash** se poklapa, dokaz nije izmijenjen |
| Preservation | Dokaz sačuvan u **izvornom stanju**, volatility |
| Legal hold | **Zabrana brisanja** zbog pravnog postupka, iznad retencije |

> **Na ispitu:** „Kako dokazati da image diska nije izmijenjen?“ → **hash** (data integrity). „Dokaz je odbijen jer niko ne zna gdje je disk bio dva dana“ → prekinut **chain of custody**. „Pravni tim traži da se emailovi ne brišu uprkos 30-dnevnoj retenciji“ → **legal hold**.

## Izolacija, eskalacija i remedijacija

### Isolating affected targets

| Metoda | Kako | Napomena |
|---|---|---|
| EDR network isolation | Host komunicira samo sa EDR konzolom | Najbrže; omogućava dalje prikupljanje dokaza na daljinu |
| Karantinski VLAN / NAC | Switch port prebačen u izolovan VLAN | Radi i bez agenta |
| Firewall/SG pravila | Blok saobraćaja hosta ili cloud instance (security group bez pravila) | U cloudu: snapshot diska, izolacijska SG, ne gasi instancu |
| Onemogućavanje naloga | Disable naloga, **revoke** sesija i tokena, reset lozinke | Kompromitovani identitet je „target“ kao i host |
| Isključenje sa mreže | Izvuci kabl, isključi Wi-Fi | Ne gasi napajanje ako trebaju volatilni podaci |

### Escalation

Eskalacija znači prenos incidenta na viši nivo ili širi krug kad pređe definisane pragove. Kriterijumi se definišu **unaprijed** u IR planu:

- **funkcionalna** eskalacija: Tier 1 → Tier 2/3, forenzika, vlasnik sistema,
- **hijerarhijska** eskalacija: IR lead → CISO → uprava, pravni tim (npr. pogođeni lični podaci, ransomware, mediji),
- **eksterna**: dobavljač (MSSP, IR retainer), regulator, policija, preko pravnog tima.

Tipični okidači: kritičan asset, potvrđen pristup osjetljivim podacima, širenje na više sistema, privilegovani nalog, prekoračeno vrijeme iz SLA-a, potreba za poslovnom odlukom (gašenje servisa).

### Remediation and verification

Remedijacija uklanja uzrok i posljedice: reimage ili čišćenje, patch iskorištene ranjivosti, reset kredencijala (uključujući servisne naloge, a kod kompromitacije domene i **krbtgt** dva puta), uklanjanje persistence mehanizama, ispravka konfiguracije.

**Verifikacija** potvrđuje da je remedijacija uspjela: ponovno skeniranje, provjera da IoC-i više ne postoje, praćenje.

```
$ nmap -sV -p 8080 127.0.0.1
PORT     STATE SERVICE VERSION
8080/tcp open  http    Apache Tomcat 10.1.35
$ trivy rootfs --severity CRITICAL / 2>/dev/null | grep -c CVE-2025-24813
0
```

Nova verzija i nula nalaza za iskorištenu ranjivost su dokaz remedijacije.

### Release from isolation i restoration

Host se vraća iz izolacije tek kad su ispunjeni **kriterijumi**: eradication završen, ranjivost zakrpljena, kredencijali promijenjeni, skeniranje čisto, odobrenje IR lead-a i vlasnika sistema. Nakon puštanja slijedi **pojačan monitoring** (napadač se često pokuša vratiti).

**Performing restoration**: restore iz **poznato čistog** backupa (prije početka kompromitacije prema timeline-u), provjera integriteta backupa, redoslijed vraćanja po poslovnoj kritičnosti (prvo infrastruktura poput AD/DNS, pa ključne aplikacije), potvrda vlasnika da servis radi. Kod ransomwarea: provjeri da backup nije zaražen ili enkriptovan (immutable/offline backup).

> **Na ispitu:** „Kada vratiti host u mrežu?“ → tek **nakon verifikacije** remedijacije i odobrenja, uz pojačan monitoring. „Iz kog backupa?“ → posljednji backup **prije** prvog indikatora kompromitacije iz timeline-a, ne posljednji dostupan.

## Root cause analysis i korektivne akcije

**RCA** odgovara na pitanje **zašto** se incident desio, a ne samo šta se desilo. Simptom (malver) nije uzrok; uzrok je propust koji ga je omogućio.

Tehnika **5 Whys**:

```
Problem: Ransomware enkriptovao file server.
1. Zašto? Napadač je pokrenuo enkriptor sa admin nalogom svc_backup.
2. Zašto je imao svc_backup? Ukrao ga je sa laptopa FIN-LT-07 (kredencijali u memoriji).
3. Zašto je bio na FIN-LT-07? Korisnica je otvorila makro dokument iz emaila.
4. Zašto se makro pokrenuo? Politika blokiranja makroa iz interneta nije bila primijenjena na tu OU.
5. Zašto? GPO nije revidiran nakon reorganizacije OU strukture.
Root cause: nedostatak kontrole promjena za GPO + servisni nalog sa prevelikim privilegijama.
```

Druge tehnike: **Fishbone (Ishikawa)** dijagram po kategorijama (ljudi, proces, tehnologija, okruženje), **fault tree** analiza.

**Corrective action development**: za svaki uzrok definiši akciju sa **vlasnikom, rokom i načinom provjere**:

| Uzrok | Korektivna akcija | Vlasnik | Rok | Verifikacija |
|---|---|---|---|---|
| Makroi iz interneta nisu blokirani u OU Finansije | GPO/Intune politika na sve OU, revizija GPO-a nakon promjena | IT ops | 7 dana | Izvještaj usklađenosti 100% |
| `svc_backup` je Domain Admin | Najmanje privilegije, gMSA, zabrana interaktivne prijave | IAM tim | 30 dana | Revizija grupa |
| Nema detekcije lateralnog kretanja sa PsExec | Nova Sigma/SIEM detekcija za 7045 PSEXESVC | SOC | 14 dana | Simulacija (purple team) |

Korektivne akcije ulaze u after action report (modul 11) i prate se do zatvaranja.

> **Na ispitu:** RCA se radi u **post-incident** fazi, ali se oslanja na timeline i dokaze iz analize. Odgovor koji „samo uklanja malver“ ne rješava root cause. Dobra korektivna akcija je **mjerljiva** i ima vlasnika.

## Scenarij: kompromitovan cloud identitet

Tehnike vrijede i bez malvera. Alarm: „Impossible travel“ za `marko@firma.ba` (prijava iz Sarajeva, 20 minuta kasnije iz druge države), zatim nova inbox pravila. Redoslijed koji ispit očekuje:

| Korak | Tehnika iz 3.3 | Akcija |
|---|---|---|
| 1 | Triage | Potvrdi da korisnik ne koristi VPN iz te zemlje; provjeri MFA metodu i user agent |
| 2 | Enrichment | Reputacija IP-a (hosting/VPS?), kritičnost naloga (finansije, admin uloge) |
| 3 | Timeline | Sign-in logovi + audit log (inbox pravilo, OAuth consent, novi MFA uređaj) u UTC-u |
| 4 | Isolating | Disable naloga, **revoke sesija i refresh tokena**, ukloni napadačev MFA uređaj |
| 5 | Evidence | Eksport audit logova sa hash-om, legal hold na mailbox ako pravni tim traži |
| 6 | Escalation | Ako je slata faktura sa promijenjenim računom (BEC) → pravni tim i finansije |
| 7 | Remediation & verification | Reset lozinke, uklanjanje inbox pravila i OAuth aplikacija, provjera da nema novih prijava |
| 8 | RCA i korektivna akcija | Uzrok: SMS MFA i phishing proxy (AiTM) → phishing-resistant MFA (FIDO2), conditional access |

```
$ jq -r '.[] | [.createdDateTime, .ipAddress, .location.countryOrRegion, .status.errorCode] | @tsv' signins.json
2026-10-07T07:41:12Z  195.222.48.10   BA  0
2026-10-07T08:01:55Z  198.51.100.77   NL  0
2026-10-07T08:02:30Z  198.51.100.77   NL  0
```

Samo reset lozinke ovdje **nije dovoljan**: ukradeni token sesije i dalje važi dok se ne opozove.

## Rezime

- IR plan (ko/kada/eskalacija), communication plan (ko kome i kojim kanalom, out-of-band), playbook (koraci po tipu incidenta), runbook (tehnička procedura).
- Tabletop = diskusija, jeftino, uprava; simulation = stvarni test alata i tima.
- Log collection uz NTP, correlation više izvora, enrichment (GeoIP, TI, CMDB kritičnost), notifikacije po ozbiljnosti.
- Triage → timeline (UTC, patient zero, vektor, dwell time) → severity/impact (functional, information, recoverability, scope) → prioritet.
- Dokazi: **chain of custody** (ko i kada), **integrity** (hash, rad na kopiji, write blocker), **preservation** (order of volatility), **legal hold** (ne briši uprkos retenciji).
- Izolacija hosta i identiteta; eskalacija po unaprijed definisanim kriterijumima; remedijacija + **verifikacija**; release from isolation tek nakon kriterijuma; restore iz čistog backupa prije kompromitacije.
- RCA (5 Whys, fishbone) traži uzrok, a korektivne akcije imaju vlasnika, rok i provjeru.
