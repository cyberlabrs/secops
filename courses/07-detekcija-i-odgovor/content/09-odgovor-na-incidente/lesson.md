## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 6:

- **6.1** Okviri za odgovor na incidente: **NIST SP 800-61r3** i **CSF 2.0**, uloge, **playbook** i **runbook**.
- **6.2** Trijaža i prikupljanje dokaza: **redoslijed volatilnosti**, **lanac nadzora** (chain of custody), **Linux live response**.

Poslije modula znaš:

- šta je novo u NIST SP 800-61r3 i kako se stari životni ciklus preslikava na funkcije CSF 2.0;
- ko učestvuje u odgovoru na incident i ko donosi koju odluku;
- kako trijažirati alarm do odluke „incident ili ne“ i odrediti prioritet;
- kojim redom i kojim alatima prikupljaš dokaze sa živog Linux sistema, i kako dokazuješ da ih nisi mijenjao.

Obuzdavanje, iskorjenjivanje, oporavak i runbookovi za konkretne incidente su u modulu 10.

## Događaj, štetan događaj, incident

NIST SP 800-61r3 razlikuje:

| Pojam | Značenje | Primjer |
|---|---|---|
| **Event** (događaj) | Bilo koja uočljiva pojava na sistemima, mrežama, servisima, cloudu | Prijava korisnika, instalacija updatea |
| **Adverse event** (štetan događaj) | Događaj sa negativnom posljedicom, bez obzira na uzrok | Neuspjele prijave sa nepoznate IP adrese, pad servisa |
| **Cybersecurity incident** | Pojava koja stvarno ili neposredno ugrožava povjerljivost, integritet ili dostupnost bez zakonskog ovlašćenja, ili krši zakon ili sigurnosne politike | Uspješna prijava napadača, izvlačenje podataka, ransomware |

Alarm u SIEM-u je štetan događaj dok analiza ne pokaže suprotno. Odluka da je nešto incident je formalan korak (CSF `DE.AE-08`: incidenti se proglašavaju kad štetni događaji ispune definisane kriterijume). Od tog trenutka važe plan za incidente, uloge i rokovi za obavještavanje.

## NIST SP 800-61r3 i CSF 2.0

**NIST SP 800-61 Rev. 3** (*Incident Response Recommendations and Considerations for Cybersecurity Risk Management*) objavljen je u aprilu 2025. i zamjenjuje Rev. 2 iz 2012. Nije više samostalan priručnik sa četiri faze, nego **CSF 2.0 Community Profile**: preporuke su organizovane po funkcijama, kategorijama i podkategorijama **NIST Cybersecurity Framework 2.0**.

Razlog: 2012. incidenti su bili rjeđi, uži i završeni za dan-dva, pa je kružni ciklus sa posebnim timom imao smisla. Danas su incidenti česti, oporavak traje sedmicama, a odgovor je dio upravljanja rizikom cijele organizacije. Lekcije treba dijeliti čim se nauče, ne tek na kraju.

### Šest funkcija CSF 2.0

| Funkcija | Oznaka | Uloga u odgovoru na incident |
|---|---|---|
| **Govern** | GV | Strategija, politike, uloge, odgovornosti; priprema |
| **Identify** | ID | Inventar, procjena rizika; kategorija **Improvement (ID.IM)** nosi lekcije naučene |
| **Protect** | PR | Zaštitne kontrole, obuka, bekapi; priprema |
| **Detect** | DE | Pronalaženje i analiza mogućih napada |
| **Respond** | RS | Akcije nad otkrivenim incidentom |
| **Recover** | RC | Vraćanje imovine i operacija |

Model u r3 ima tri nivoa: Govern, Identify i Protect su **priprema** (šire upravljanje rizikom, ne sam odgovor); Detect, Respond i Recover su **odgovor na incident**; a **ID.IM** (Improvement) je stalno poboljšanje u koje se slivaju lekcije iz svih funkcija.

### Preslikavanje starog ciklusa

| Faza iz SP 800-61r2 | Funkcije CSF 2.0 u r3 |
|---|---|
| Preparation | Govern, Identify (sve kategorije), Protect |
| Detection & Analysis | Detect, Identify (Improvement) |
| Containment, Eradication & Recovery | Respond, Recover, Identify (Improvement) |
| Post-Incident Activity | Identify (Improvement) |

Mnogi timovi i dalje govore o fazama iz r2 (priprema, detekcija i analiza, obuzdavanje–iskorjenjivanje–oporavak, aktivnosti nakon incidenta). To je u redu. NIST izričito kaže da organizacija koristi model koji joj odgovara; r3 samo daje zajednički jezik sa CSF-om.

### Kategorije koje SOC koristi svaki dan

| Kategorija | Šta pokriva | Primjeri podkategorija |
|---|---|---|
| **DE.CM** Continuous Monitoring | Praćenje imovine radi otkrivanja anomalija | DE.CM-01 mreža, DE.CM-03 aktivnost osoblja, DE.CM-09 hardver i softver |
| **DE.AE** Adverse Event Analysis | Analiza anomalija i indikatora | DE.AE-02 analiza događaja, DE.AE-03 korelacija iz više izvora, DE.AE-04 procjena uticaja i obima, DE.AE-08 proglašenje incidenta |
| **RS.MA** Incident Management | Upravljanje odgovorom | RS.MA-01 izvršenje plana, RS.MA-02 trijaža i validacija, RS.MA-03 kategorizacija i prioritet, RS.MA-04 eskalacija, RS.MA-05 kriterijumi za početak oporavka |
| **RS.AN** Incident Analysis | Istraga | RS.AN-03 šta se desilo i uzrok, RS.AN-06 bilježenje akcija istrage, RS.AN-07 prikupljanje podataka uz očuvanje integriteta i porijekla, RS.AN-08 procjena veličine incidenta |
| **RS.CO** Reporting and Communication | Komunikacija | RS.CO-02 obavještavanje zainteresovanih strana, RS.CO-03 dijeljenje informacija |
| **RS.MI** Incident Mitigation | Sprječavanje širenja | RS.MI-01 obuzdavanje, RS.MI-02 iskorjenjivanje |
| **RC.RP** Recovery Plan Execution | Oporavak | RC.RP-03 provjera integriteta bekapa, RC.RP-05 provjera vraćenih sistema, RC.RP-06 proglašenje kraja oporavka |
| **RC.CO** Recovery Communication | Komunikacija o oporavku | RC.CO-03 napredak oporavka, RC.CO-04 javna obavještenja |

> **U praksi:** oznake kategorija su korisne u izvještajima i tiketima. „Nemamo RS.AN-07“ je jasnija poruka menadžmentu nego „nemamo forenzičku proceduru“: odmah se vidi gdje u okviru je praznina i koja preporuka iz r3 je relevantna.

## Uloge

r3 naglašava da odgovor više nije posao samo tima za incidente. Tipične uloge:

| Uloga | Odgovornost |
|---|---|
| **Rukovodstvo** | Nadzor, budžet, odluke visokog uticaja (gašenje ili ponovna izgradnja kritičnog servisa) |
| **Incident handleri** | Potvrđuju incident, prikupljaju i analiziraju dokaze, određuju prioritete, ograničavaju štetu; interni, ugovorni (MSSP, SOC) ili po potrebi |
| **Vođa incidenta** (incident lead / commander) | Jedna osoba koja koordinira jedan incident; r3 preporučuje da se odredi za svaki incident |
| **Tehnički timovi** | Sistemski, mrežni, cloud, razvoj: izvode izmjene, poznaju sisteme |
| **Pravna služba** | Zakonske obaveze, privatnost, ugovori sa dobavljačima, kontakt sa policijom |
| **Odnosi sa javnošću** | Komunikacija sa medijima i javnošću |
| **Ljudski resursi** | Kad je u incident uključen zaposleni |
| **Fizička sigurnost** | Pristup prostorijama i opremi |
| **Vlasnici imovine** | Prioriteti oporavka za svoje sisteme i podatke |
| **Treće strane** | Cloud provajder, ISP, MSSP: **model dijeljene odgovornosti**, ugovorom definisano ko smije šta |

Uz to, za svaki incident treba **zapisničar** (scribe), koji vodi vremensku liniju i bilježi odluke. Za cloud vrijedi i to da provajder (AWS, Azure) ima svoj dio odgovornosti i svoje procedure za prijavu incidenta. Pravni i ugovorni kontakti treba da budu poznati **prije** incidenta.

## Politika, plan, playbook, runbook

| Dokument | Odgovara na | Primjer |
|---|---|---|
| **Politika** | Ko ima ovlašćenja, šta je incident, kako se određuje prioritet | „SOC lead smije izolovati bilo koji host bez odobrenja vlasnika“ |
| **Plan** (IR plan) | Kako organizacija vodi incidente uopšte | Uloge, kanali komunikacije, eskalacija, obavještavanje regulatora |
| **Playbook** | Šta radimo za **vrstu** incidenta: odluke, uloge, komunikacija, redoslijed faza | „Kompromitovan cloud nalog“, „Ransomware“ |
| **Runbook** | **Kako** se izvodi konkretan tehnički zadatak, korak po korak, sa komandama | „Deaktiviraj IAM access key i provjeri CloudTrail“ |

Playbook upućuje na runbookove. Playbook kaže „obuzdaj kompromitovan ključ“; runbook kaže tačno koje komande, ko ih izvodi i kako se provjerava rezultat. r3 preporučuje dokumentovane procedure za najčešće incidente i playbook format radi upotrebljivosti, uz primjere u CISA *Incident & Vulnerability Response Playbooks*.

U SOAR alatima (Sentinel playbookovi na Logic Apps, Splunk SOAR) „playbook“ često znači automatizovani tok. Pojam je isti: niz koraka za tip incidenta, samo što dio koraka izvodi mašina.

> **U praksi:** runbook mora biti izvodljiv u 3 ujutro od strane dežurnog koji ga ranije nije čitao. Ako korak zahtijeva pristup koji dežurni nema (rola, VPN, break-glass nalog), runbook je neispravan. Runbookove testiraj na vježbama (tabletop) i u labu, isto kao detekcije.

## Trijaža

Trijaža (RS.MA-02) odgovara na četiri pitanja, brzo:

1. **Je li stvarno?** Lažni pozitiv, test (purple team, modul 08) ili stvarna aktivnost?
2. **Šta je pogođeno?** Koji host, nalog, podaci, servis; koliko je kritično?
3. **Je li u toku?** Je li napadač i dalje aktivan, i koliko brzo se širi?
4. **Koliki je prioritet?** Na osnovu uticaja i hitnosti.

r3 kao faktore za procjenu rizika navodi: kritičnost imovine, funkcionalni uticaj, uticaj na podatke, fazu uočene aktivnosti, karakterizaciju napadača i mogućnost oporavka. Incidenti se **ne** obrađuju po redoslijedu dolaska.

Primjer matrice prioriteta:

| Prioritet | Kriterijumi (bilo koji) | Reakcija |
|---|---|---|
| **P1 kritičan** | Potvrđen pristup napadača produkciji ili privilegovanom nalogu; izvlačenje podataka; ransomware | Odmah, 24/7, vođa incidenta, rukovodstvo obaviješteno |
| **P2 visok** | Kompromitovan pojedinačan host ili korisnički nalog bez dokaza o širenju; procurjela tajna sa pristupom produkciji | Unutar 1 h |
| **P3 srednji** | Sumnjiva aktivnost bez potvrde; malver blokiran, ali pokrenut | Isti radni dan |
| **P4 nizak** | Skeniranje, neuspješni pokušaji, kršenje politike bez štete | Redovni red |

### Primjer: trijaža SSH alarma iz Wazuha

U `alerts.json` vidiš niz neuspjelih prijava pa uspješnu prijavu za istog korisnika:

```bash
A=/var/ossec/logs/alerts/alerts.json
jq -r 'select(.rule.groups | index("sshd")) |
       [.timestamp, .rule.id, .rule.level, .rule.description, (.data.srcip // "-"), (.data.dstuser // "-")] | @tsv' $A | tail -20
```

Pitanja za trijažu i komande koje daju odgovor:

```bash
# je li srcip ikad ranije uspješno ulazio? (iz auth.log, ne samo iz alarma)
grep 'Accepted' /var/log/auth.log | awk '{print $1,$2,$3,$9,$11}' | sort | uniq -c

# šta je korisnik radio poslije prijave (sudo, novi nalozi)?
grep -E 'sudo|useradd|usermod' /var/log/auth.log | tail -20

# da li je sesija još aktivna?
who; ss -tnp state established '( sport = :22 )'
```

Ako je prijava uspjela poslije niza pogrešnih lozinki, sa IP adrese koja nikad ranije nije korištena, a korisnik je odmah pokrenuo `sudo`, to je incident (P1 ili P2 prema kritičnosti hosta). Proglasi ga, otvori tiket, odredi vođu i počni vremensku liniju.

### Vremenska linija

Od prvog minuta vodi vremensku liniju u **UTC**, sa izvorom za svaki zapis:

```text
2026-10-14T09:02:11Z  auth.log  10 neuspjelih prijava za marko sa 203.0.113.50 (Wazuh 5763)
2026-10-14T09:02:40Z  auth.log  Accepted password for marko from 203.0.113.50 (Wazuh 5715)
2026-10-14T09:03:05Z  auth.log  marko: sudo /bin/bash (Wazuh 5402)
2026-10-14T09:04:12Z  auth.log  useradd: new user name=sysupdate (Wazuh 5902)
2026-10-14T09:15:00Z  SOC       alarm trijažiran, incident IR-2026-031 proglašen, P1   [akcija: ana]
```

Razlikuj **opažanja** (šta piše u logu) od **akcija** (šta je tim uradio). RS.AN-06 traži da se akcije istrage bilježe i da im se sačuvaju integritet i porijeklo.

## Prikupljanje dokaza

### Redoslijed volatilnosti

**RFC 3227** (*Guidelines for Evidence Collection and Archiving*) kaže: prikupljaj od najnestalnijeg ka najstalnijem, jer nestalni podaci nestaju sami ili zbog tvojih akcija.

| Red | RFC 3227 | Na Linuxu | Alat u labu |
|---|---|---|---|
| 1 | Registri, keš | Praktično nedostupno bez specijalnih alata | — |
| 2 | Tabela rutiranja, ARP keš, tabela procesa, statistika kernela, memorija | `ip route`, `ip neigh`, procesi, `/proc`, mrežne konekcije, RAM | `ps`, `ss`, `lsof`, `/proc/<pid>/` |
| 3 | Privremeni fajl sistemi | `/tmp`, `/dev/shm`, `/run`, `/var/tmp` | `find`, `sha256sum` |
| 4 | Disk | Fajl sistem, konfiguracija, logovi na disku | `find`, `crontab`, kopije fajlova |
| 5 | Udaljeni logovi i monitoring | SIEM, CloudTrail, centralni syslog | `jq` nad `alerts.json` |
| 6 | Fizička konfiguracija, topologija mreže | Dijagrami, inventar | — |
| 7 | Arhivski mediji | Bekapi | — |

Memorija (RAM) je na drugom mjestu i često je najvrjedniji dokaz (ključevi, procesi bez fajla, konekcije). Za njeno prikupljanje postoje alati poput AVML ili LiME, koji nisu dio ovog laba; bitno je znati da se gubi gašenjem mašine.

RFC 3227 navodi i šta **ne** raditi:

- ne gasi sistem dok dokazi nisu prikupljeni;
- ne vjeruj programima na kompromitovanom sistemu (koristi pouzdane, statički linkovane alate sa svog medija);
- ne pokreći programe koji mijenjaju vrijeme pristupa svim fajlovima (npr. `tar` ili rekurzivno kopiranje preko cijelog diska);
- pazi sa isključivanjem sa mreže: napadač može imati „dead man switch“ koji briše tragove kad izgubi vezu.

### Lanac nadzora

**Chain of custody** je zapis koji dokazuje da dokaz nije mijenjan od prikupljanja do upotrebe. Po RFC 3227 bilježiš:

- gdje, kada i ko je dokaz otkrio i prikupio;
- gdje, kada i ko je s njim rukovao ili ga ispitivao;
- ko ga je čuvao, u kom periodu i kako;
- kada je i kako promijenio vlasnika (primopredaja).

Uz to, za digitalni dokaz **hash** (SHA-256) u trenutku prikupljanja. Svaka kasnija provjera hasha dokazuje integritet.

```text
Dokaz: IR-2026-031-E03  ir-lab-20261014T0920Z.tar.gz
SHA-256: 6f1c…e9a2
Prikupio: ana.k (SOC), 2026-10-14T09:31Z, host lab, metoda: live response skripta v1.2
Čuvanje: evidence bucket, object lock (WORM), pristup samo IR rola
Primopredaja: 2026-10-14T11:00Z ana.k -> marko.p (forenzika), hash provjeren, odgovara
```

Čak i kada ne planiraš sudski postupak, vodi lanac nadzora. Ne znaš unaprijed hoće li incident završiti kod pravne službe, osiguranja ili regulatora.

> **U praksi:** u cloudu je lanac nadzora lakši nego na fizičkom disku: EBS snapshot, kopija logova u bucket sa **Object Lockom** i CloudTrail zapisi o tome ko je pristupao imaju vremenske oznake i identitet ugrađene. Iskoristi to: dokaze drži u posebnom nalogu za forenziku, kojem produkcijski nalozi mogu samo pisati.

## Linux live response

**Live response** je prikupljanje volatilnih podataka sa sistema koji radi, prije obuzdavanja koje bi ih uništilo. Pravila:

- **Izlaz ne piši na kompromitovan disk**, ako možeš. Koristi mrežni dijeljeni direktorij, priključen medij ili pipe preko SSH-a. U labu, zbog jednostavnosti, koristimo `/root/ir/`.
- **Bilježi sve što radiš**: komandu, vrijeme, ko. Najjednostavnije: `script` sesija ili skripta koja loguje svaki korak.
- **Hashiraj** izlaze odmah.
- **Minimalno mijenjaj**: ne instaliraj pakete, ne pokreći skenere koji čitaju cijeli disk.

### Postavka

```bash
CASE=IR-2026-031
OUT=/root/ir/$CASE/$(hostname)-$(date -u +%Y%m%dT%H%MZ)
mkdir -p "$OUT" && cd "$OUT"
script -q -a "$OUT/session.log"          # od sada se bilježi cijela sesija (exit na kraju)
date -u > 00-date-utc.txt; uptime >> 00-date-utc.txt; uname -a >> 00-date-utc.txt
```

### 1. Mreža i procesi (najvolatilnije)

```bash
ss -tanup                      > 10-ss-tcp-udp.txt        # sve TCP/UDP konekcije sa procesom
ss -lntup                      > 11-ss-listen.txt         # portovi na kojima se sluša
ip addr; ip route; ip neigh    > 12-ip.txt 2>&1
iptables -S                    > 13-iptables.txt 2>&1

ps -eo pid,ppid,user,lstart,etimes,cmd --forest > 20-ps-forest.txt
ls -l /proc/[0-9]*/exe 2>/dev/null              > 21-proc-exe.txt
grep -F '(deleted)' 21-proc-exe.txt             > 22-deleted-exe.txt    # proces čiji fajl je obrisan
lsof -nP                                        > 23-lsof.txt 2>/dev/null
lsof -nP -i                                     > 24-lsof-net.txt 2>/dev/null
who -a > 25-who.txt; w >> 25-who.txt; last -Faiw > 26-last.txt 2>&1
```

Za sumnjiv proces (npr. PID 4242) sačuvaj sve iz `/proc` prije nego što ga zaustaviš:

```bash
P=4242; mkdir -p proc-$P
tr '\0' ' ' < /proc/$P/cmdline > proc-$P/cmdline.txt
tr '\0' '\n' < /proc/$P/environ > proc-$P/environ.txt 2>/dev/null
ls -l /proc/$P/cwd /proc/$P/exe   > proc-$P/links.txt
ls -l /proc/$P/fd                 > proc-$P/fd.txt
cat /proc/$P/maps                 > proc-$P/maps.txt
cp /proc/$P/exe proc-$P/exe.bin   # radi i kad je binarni fajl obrisan sa diska
sha256sum proc-$P/exe.bin
```

Ključna stvar: binarni fajl koji je napadač obrisao sa diska i dalje postoji dok proces radi, a `/proc/<pid>/exe` je jedini put do njega. Ako prvo ubiješ proces, taj dokaz je izgubljen.

### 2. Privremeni fajl sistemi

```bash
find /tmp /var/tmp /dev/shm /run -xdev -type f -printf '%T+ %u %m %s %p\n' 2>/dev/null | sort > 30-tmp-files.txt
find /tmp /var/tmp /dev/shm -xdev -type f -perm -u+x -printf '%p\n' 2>/dev/null \
  | xargs -r sha256sum > 31-tmp-exec-sha256.txt
```

### 3. Perzistencija i disk

```bash
for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null | sed "s/^/$u: /"; done > 40-crontabs.txt
ls -la /etc/cron.* /etc/crontab /var/spool/cron 2>/dev/null > 41-cron-files.txt
systemctl list-timers --all > 42-timers.txt 2>&1
systemctl list-unit-files --state=enabled > 43-enabled-units.txt 2>&1
find / -xdev -name authorized_keys -printf '%T+ %u %p\n' 2>/dev/null > 44-authorized-keys.txt
awk -F: '$3==0 || $3>=1000 {print}' /etc/passwd > 45-users.txt
find /etc /usr/local/bin /usr/bin -xdev -newermt '2026-10-14 09:00' -type f -printf '%T+ %p\n' 2>/dev/null | sort > 46-changed-since.txt
```

`-newermt` traži fajlove izmijenjene poslije početka incidenta po vremenskoj liniji. Vremena izmjene napadač može lažirati (`touch`), pa ih uzimaj kao trag, ne kao dokaz.

### 4. Logovi

```bash
cp -p /var/log/auth.log* .                                   # -p čuva vremena
cp -p /var/ossec/logs/alerts/alerts.json wazuh-alerts.json
journalctl --since '2026-10-14 08:00' -o short-iso-precise > 50-journal.txt 2>/dev/null
```

### Pakovanje i hash

```bash
exit                                         # kraj script sesije
cd "$(dirname "$OUT")"
sha256sum "$(basename "$OUT")"/* > "$(basename "$OUT")"/SHA256SUMS 2>/dev/null
tar czf "$(basename "$OUT")".tar.gz "$(basename "$OUT")"
sha256sum "$(basename "$OUT")".tar.gz | tee "$(basename "$OUT")".tar.gz.sha256
```

Hash arhive upisuješ u zapis o lancu nadzora. Kopiju arhive odmah premještaš na mjesto za dokaze; na kompromitovanom hostu ne ostaje ništa na šta se oslanjaš.

> **U praksi:** napravi skriptu za live response unaprijed, testiraj je u labu i drži je verzionisanu. Pod stresom se zaboravi `ss` prije `kill`, ili se izlaz piše u `/tmp` kompromitovanog hosta. Skripta sa fiksnim redoslijedom (mreža → procesi → `/proc` → tmp → perzistencija → logovi) i automatskim hashiranjem uklanja te greške. U Microsoft Defender for Endpoint isti posao radi „Collect investigation package“ i live response sesija (SC-200).

### Kontejneri i Kubernetes

Kontejneri su prolazni: kad orchestrator ubije pod, njegov fajl sistem i procesi nestaju. Zato je redoslijed isti, ali sa dodatnim koracima:

| Šta | Kako |
|---|---|
| Metapodaci poda | `kubectl get pod <p> -n <ns> -o yaml`, `kubectl describe pod` (slika, digest, čvor, ServiceAccount) |
| Logovi | `kubectl logs <p> -n <ns> --all-containers --timestamps` (i `--previous` za restartovan kontejner) |
| Izmjene fajl sistema | Na čvoru: `docker diff`, `crictl inspect` za PID i putanje; izmjene u upper sloju |
| Procesi | Na čvoru preko PID-a kontejnera, isto kao `/proc` iznad |
| Audit | Kubernetes audit log (`exec`, `secrets` get) i Falco alarmi za taj `container.id` |

Ne briši pod dok ne prikupiš dokaze. U modulu 10 vidiš kako ga izolovati i ostaviti živ za forenziku.

## Rezime

- NIST SP 800-61r3 (april 2025) zamjenjuje r2 i organizuje odgovor kao **CSF 2.0 Community Profile**: Govern, Identify i Protect su priprema, Detect, Respond i Recover su odgovor, a **ID.IM** je stalno poboljšanje.
- Ključne kategorije: DE.AE (analiza i proglašenje incidenta), RS.MA (trijaža, prioritet, eskalacija), RS.AN (istraga, integritet dokaza), RS.CO (komunikacija), RS.MI (obuzdavanje, iskorjenjivanje), RC.RP i RC.CO (oporavak).
- Odgovor je timski: rukovodstvo, handleri, vođa incidenta, tehnički timovi, pravna služba, PR, HR, vlasnici imovine i treće strane po modelu dijeljene odgovornosti.
- Playbook opisuje šta se radi za vrstu incidenta (odluke, uloge, komunikacija); runbook opisuje kako se izvodi tehnički korak.
- Trijaža: stvarno ili ne, šta je pogođeno, je li u toku, prioritet po riziku; vremenska linija u UTC sa izvorom svakog zapisa.
- **RFC 3227**: od najnestalnijeg (procesi, mreža, memorija) do najstalnijeg (disk, udaljeni logovi, arhive); ne gasi sistem prerano i ne vjeruj alatima na kompromitovanom hostu.
- Lanac nadzora: ko, kada, gdje, kako je dokaz prikupljen, čuvan i predat, uz SHA-256 hash.
- Linux live response: `ss`, `ps`, `/proc/<pid>/` (uključujući `exe` obrisanog binarnog fajla), `lsof`, tmp direktoriji, cron, systemd, `authorized_keys`, logovi; izlaz van hosta, sve hashirano.
