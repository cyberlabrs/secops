## Zašto scenariji

U prethodnim kursevima svaki alat je učen posebno: KQL u SC-200, CloudTrail u AWS Security Specialty, audit logovi i Falco u CKS-u, Wazuh i Sigma u detection labu, gitleaks u DevSecOps-u, prompt injection u AI sigurnosti. Pravi incident ne poštuje te granice. Phishing počinje u mailu, nastavlja se u Entra ID-u, prelazi preko VPN-a na Linux server i završava izvlačenjem baze. Procurjeli AWS ključ počinje u git istoriji, a šteta se mjeri u CloudTrailu i S3.

Ovaj kurs ima četiri scenarija. U svakom dobijaš alarm ili prijavu, skup dokaza i zadatak: utvrdi šta se desilo, obuzdaj napadača, napravi vremensku liniju i napiši izvještaj. Ova lekcija daje postupak koji važi za sva četiri.

## Faze odgovora po NIST SP 800-61r3

**NIST SP 800-61 Rev. 3** (april 2025) organizuje odgovor na incident po funkcijama **CSF 2.0**. U praksi timovi i dalje rade u fazama; preslikavanje je jednostavno:

| Faza u radu | Funkcije CSF 2.0 | Šta radiš u scenariju |
|---|---|---|
| Priprema | Govern, Identify, Protect | logovi postoje, vrijeme je sinhronizovano, znaš ko odlučuje (u scenarijima je ovo već urađeno ili nedostaje, i to je nalaz) |
| Detekcija i analiza | Detect (DE.AE), Respond (RS.AN) | trijaža alarma, istraga po izvorima, obim, vremenska linija |
| Obuzdavanje | Respond (RS.MI-01) | zatvoriti pristup koji napadač sada ima, bez uništavanja dokaza |
| Iskorjenjivanje | Respond (RS.MI-02) | ukloniti perzistenciju i propust koji je omogućio napad |
| Oporavak | Recover (RC.RP) | vratiti sisteme i naloge u poznato dobro stanje, pojačan nadzor |
| Poslije incidenta | Identify (ID.IM) | lekcije naučene, nove detekcije i kontrole |

Faze nisu strogo uzastopne. Obuzdavanje često počinje usred analize (čim vidiš aktivnu sesiju napadača), a analiza se nastavlja i poslije obuzdavanja (šta je još dotaknuto). NIST r3 naglašava da se lekcije bilježe odmah, ne tek na kraju.

## Trijaža: prvih 15 minuta

Prije nego što otvoriš prvi log, odgovori na pitanja trijaže. Zapiši odgovore: oni su prvi red izvještaja.

1. **Šta je okidač?** Alarm (koje pravilo, koji nivo), prijava korisnika, poruka spolja (partner, CERT, istraživač). Kada je stigao, u kojoj vremenskoj zoni?
2. **Da li je stvarno?** Može li biti lažno pozitivan? Šta bi ga objasnilo kao legitimnu aktivnost (službeni put, planiran posao, test)?
3. **Šta je pogođeno?** Koji nalog, host, servis, podaci. Koliko je kritično (krunski dragulj ili testni server)?
4. **Da li napadač još ima pristup?** Aktivna sesija, VPN veza, proces, ključ. Ovo određuje koliko brzo moraš obuzdavati.
5. **Koji su IOC-ovi?** IP adrese, domeni, hashovi, korisnička imena, ključevi pristupa. Sa njima tražiš dalje.
6. **Ko treba da zna?** Vlasnik sistema, rukovodilac, pravna služba (lični podaci, rokovi za obavještavanje), komunikacije.

Iz odgovora slijedi **prioritet** (npr. P1 kad napadač ima aktivan pristup produkciji ili podacima, P3 kad je pokušaj odbijen) i odluka „incident ili ne“ (CSF `DE.AE-08`).

## Vremenska linija u UTC-u

Vremenska linija je kičma istrage i izvještaja. Pravila:

- **Sve u UTC.** Tiket je u lokalnom vremenu, zaglavlje `Date` maila ima `+0200`, `auth.log` nema ni godinu ni zonu, CloudTrail je u UTC sa `Z`, Wazuh ima `+0000`. Pretvori sve u jedan oblik: ISO 8601 sa `Z`, npr. `2026-10-13T08:12:05Z`.
- **Jedan događaj, jedan red**, sa izvorom: `vrijeme, izvor, događaj`. Izvor omogućava da svaku tvrdnju provjeriš.
- **Provjeri sat izvora.** Ako host nema NTP, njegovi logovi kasne ili žure; to zapiši kao nalaz.
- **Razlikuj činjenicu i zaključak.** „08:24:02 Accepted password za jkovac sa 10.8.0.23“ je činjenica; „napadač ulazi na jump01“ je zaključak koji slijedi iz nekoliko činjenica.

```bash
date -u -d '2026-10-13 11:38 +0200' +%Y-%m-%dT%H:%M:%SZ       # 2026-10-13T09:38:00Z
date -u -d @1791877327 +%Y-%m-%dT%H:%M:%SZ                     # Unix epoch (DKIM t=) u UTC
jq -r '.eventTime' cloudtrail.json                             # CloudTrail je već u UTC-u
```

Za CSV vremenske linije dovoljno je `sort` jer ISO 8601 u UTC-u ima isti leksički i hronološki redoslijed.

## Pivotiranje između izvora

Nijedan izvor ne priča cijelu priču. Pivot je prelazak iz jednog izvora u drugi preko podatka koji oba sadrže:

| Polje | Primjer pivota |
|---|---|
| **IP adresa** | `SigninLogs.IPAddress` → VPN log (javna → interna adresa) → `auth.log` (`from 10.8.0.23`) |
| **Korisničko ime** | Entra UPN `jelena.kovac@...` → Linux `jkovac` (SSSD) → `sudo` zapisi |
| **Ključ pristupa** | gitleaks nalaz `AKIA...` → CloudTrail `userIdentity.accessKeyId` → novi IAM korisnik |
| **Token ili sesija** | `SessionId` u prijavama; ServiceAccount token u Kubernetes audit logu (`user.username`) |
| **Hash** | prilog iz maila → `EmailAttachmentInfo` → `DeviceFileEvents` |
| **Vrijeme** | kad nema zajedničkog polja: događaji u istom prozoru od nekoliko sekundi na povezanim sistemima |
| **Kontejner / pod** | Falco `k8s.pod.name` → audit log `objectRef.name` → slika i ranjivost u Trivy izvještaju |

Svaki pivot zapiši u radne bilješke (RS.AN-06: bilježenje akcija istrage): koji upit, nad kojim izvorom, šta je vratio. Tako drugi analitičar može da ponovi tvoj put.

Upiti iz scenarija:

```kql
SigninLogs
| where IPAddress == "203.0.113.77"
| summarize count() by ResultType, AppDisplayName
```

```bash
jq -r 'select(.userIdentity.accessKeyId == "AKIA...") | [.eventTime, .eventName, .sourceIPAddress] | @tsv' cloudtrail.json
jq -r 'select(.user.username | startswith("system:serviceaccount:")) | [.requestReceivedTimestamp, .verb, .objectRef.resource] | @tsv' audit.log
grep -E 'Accepted|sudo:|crontab\[' auth.log
```

## Rukovanje dokazima

Dokaz koji ne možeš braniti ne vrijedi. Osnovna pravila (detaljno u kursu 07, modul Odgovor na incidente):

- **Red volatilnosti** (RFC 3227): prvo memorija, procesi i mrežne veze, pa fajlovi, pa logovi na udaljenim sistemima i arhive. Gašenje hosta briše najvolatilnije dokaze.
- **Radi nad kopijom.** Original (log, snimak diska, export iz SIEM-a) sačuvaš netaknut; analiziraš kopiju.
- **Hash odmah.** `sha256sum` svakog fajla u trenutku prikupljanja; hash ide u lanac nadzora.
- **Lanac nadzora** (chain of custody): ko, kada, šta, sa kojim hashom, kome predato. Svaki prenos je novi red.
- **Prikupi prije čišćenja.** `authorized_keys`, crontab, zlonamjerni pod ili IAM politiku prvo sačuvaš (fajl, `kubectl get -o yaml`, `get-policy-version`), pa tek onda brišeš.
- **Ne upozoravaj napadača bez potrebe.** Akcije koje napadač vidi (gašenje naloga, brisanje fajla) radiš kad si spreman da zatvoriš sva vrata odjednom.

## Obuzdavanje: šta prvo

Redoslijed je skoro uvijek isti, od najšireg pristupa ka najužem:

1. **Identitet i pristup**: opoziv sesija i tokena, deaktivacija ključeva, reset lozinki, uklanjanje napadačevih MFA metoda, korisnika i ključeva.
2. **Mreža**: blokada napadačevih adresa, izolacija hosta ili poda (NetworkPolicy, security group, mrežni segment).
3. **Dokazi** sa pogođenih sistema.
4. **Perzistencija**: ključevi, cron, novi IAM korisnici i politike, privilegovani podovi, otrovani dokumenti.
5. **Uzrok**: ranjivost, preširoka dozvola, procurjela tajna.

Svaka akcija ide u vremensku liniju sa vremenom i izvršiocem: i obuzdavanje je dio istorije incidenta.

## Izvještaj

Izvještaj čitaju i rukovodstvo i tehnički tim, pa ima dva nivoa:

| Odjeljak | Sadržaj |
|---|---|
| **Sažetak** | 3–5 rečenica: šta se desilo, kada, šta je pogođeno, da li je obuzdano. Bez žargona. |
| **Vremenska linija** | ključni događaji u UTC-u sa izvorom |
| **Uzrok** (root cause) | tehnički uzrok (ranjivost, procurjeli ključ) i organizacioni (nema DMARC `p=reject`, nema code review za tajne) |
| **Obim i uticaj** | nalozi, hostovi, podaci (koliko zapisa, koje kategorije), poslovni uticaj, obaveze obavještavanja |
| **Preduzete mjere** | obuzdavanje, iskorjenjivanje, oporavak, sa vremenima |
| **Preporuke** | konkretne, sa vlasnikom i rokom; nove detekcije (Sigma, KQL, Wazuh pravilo) |
| **Dodaci** | IOC lista, upiti, hashovi dokaza, mapiranje na MITRE ATT&CK ili ATLAS |

Dobra preporuka kaže **šta**, **ko** i **do kada**: „DMARC za drinalog.example na `p=reject` do 1. 12. (vlasnik: tim za mail)“, a ne „poboljšati email sigurnost“.

## Četiri scenarija

| Scenarij | Priča | Izvori dokaza i alati | Kursevi na koje se oslanja |
|---|---|---|---|
| **1. Phishing i kompromitovan nalog** | lažna stranica za prijavu, MFA umor, VPN, SSH na jump host, `authorized_keys` i cron, izvlačenje baze | `.eml` zaglavlja, KQL nad `SigninLogs` i `AuditLogs`, VPN log, `auth.log`, Wazuh alarmi | 01, 02, 07, 08, 09 |
| **2. Procurjela tajna i AWS** | AWS ključ u git istoriji i CI logu, enumeracija, eskalacija privilegija, S3 podaci | gitleaks, git, CloudTrail sa `jq`, IAM politike, Sigma i Zircolite | 03, 06, 07 |
| **3. Kubernetes klaster** | ranjiva aplikacija, shell u podu, ServiceAccount token, tajne, privilegovani pod | Falco alarmi, Trivy izvještaj, Kubernetes audit log, RBAC manifesti, NetworkPolicy | 04, 05, 07 |
| **4. AI agent** | indirektni prompt injection u dokumentu baze znanja, agent izvlači podatke kroz alate | tragovi poziva alata agenta, log e-mail gateway-a, politika čuvara alata, OWASP LLM Top 10, MITRE ATLAS | 12, 07, 01 |

Svaki scenarij ima lekciju sa pričom, lancem napada, dokazima po izvorima, tačkama odluke i detekcijama, kviz sa isječcima logova i lab od 45–60 minuta u kojem istragu radiš sam: odgovori se upisuju u fajlove i automatski provjeravaju.

Savjet za labove: prije prvog koraka pročitaj sve dokaze površno (`ls -R`, `head`, `wc -l`, `getschema`) i napiši okvirnu vremensku liniju. Tek onda kreni na detalje.

## Veze sa drugim kursevima

- [Detekcija i odgovor: Odgovor na incidente](#/07-detekcija-i-odgovor/m/09-odgovor-na-incidente): NIST SP 800-61r3, CSF 2.0, uloge, red volatilnosti, lanac nadzora.
- [Detekcija i odgovor: Obuzdavanje i runbookovi](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): runbookovi za tipične incidente.
- [Detekcija i odgovor: MITRE ATT&CK](#/07-detekcija-i-odgovor/m/05-mitre-attack): mapiranje tehnika i detekcija.
- [CySA+: Okviri i IR proces](#/09-cysa/m/09-okviri-i-ir-proces) i [CySA+: IR tehnike](#/09-cysa/m/10-ir-tehnike): faze odgovora i tehnike istrage.
- [CySA+: Izvještavanje](#/09-cysa/m/11-izvjestavanje): izvještaji o incidentu i metrike.
- [SC-200: Defender XDR incidenti](#/08-sc200/m/08-defender-xdr-incidenti): trijaža i istraga incidenata u portalu.
- [AWS Security Specialty: Odgovor na incidente](#/03-aws-security-specialty/m/03-odgovor-na-incidente): IR u AWS-u.
- [CKS: Audit logovi](#/05-cks/m/11-audit-logovi) i [CKS: Runtime sigurnost](#/05-cks/m/12-runtime-security): dokazi u Kubernetesu.
- [AI sigurnost: Testiranje i monitoring](#/12-ai-sigurnost/m/10-testiranje-i-monitoring): logovanje i nadzor AI sistema.
- Scenariji: [1. Phishing i nalog](#/13-scenariji/m/02-phishing-i-nalog), [2. Procurjela tajna i AWS](#/13-scenariji/m/03-procurjela-tajna-aws), [3. Kubernetes](#/13-scenariji/m/04-kubernetes-kompromitacija), [4. AI agent](#/13-scenariji/m/05-ai-agent-incident).
