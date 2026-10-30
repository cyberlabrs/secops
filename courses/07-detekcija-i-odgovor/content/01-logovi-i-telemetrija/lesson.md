## Šta ovaj modul pokriva

Modul pokriva tri cilja iz domena 1:

- **1.1** Linux logovi: syslog i `auth.log`, **journald**, **auditd**; formati, vremenske zone, integritet logova.
- **1.2** Cloud i Kubernetes logovi: **CloudTrail**, Azure Activity i **Entra sign-in**, **Kubernetes audit** (pregled izvora; istraga je u modulu 02).
- **1.3** Prikupljanje i normalizacija: agenti, **syslog forwarding**, šeme (**ECS**, **OCSF**), retencija.

Zašto je ovo prvi modul: svaka detekcija je upit nad logom. Ako log ne postoji, ako mu je vrijeme pogrešno ili ako polje `user` u jednom izvoru znači nešto drugo nego u drugom, ni najbolje Sigma pravilo neće pomoći. Detection engineering počinje pitanjem „imam li telemetriju za ovo?“, a ne pisanjem pravila.

U labu (Debian 12 kontejner bez mreže) imaš rsyslog i sshd koji pišu u `/var/log/auth.log`, a Wazuh manager taj fajl čita. Lab nema systemd, pa journald i auditd ovdje opisujemo kroz primjere zapisa i komande koje ćeš koristiti na pravim serverima.

## Tri sloja Linux logova

| Izvor | Šta bilježi | Gdje živi | Format |
|---|---|---|---|
| **syslog** (rsyslog) | Poruke servisa i kernela po facility/severity | `/var/log/syslog`, `/var/log/auth.log` | Tekst, jedna linija po događaju |
| **journald** | Sve što systemd servisi pišu na stdout/stderr, plus kernel i syslog API | `/run/log/journal` (privremeno) ili `/var/log/journal` (trajno) | Binarni, strukturirana polja |
| **auditd** | Sistemski pozivi i pristup fajlovima po pravilima koja ti zadaš | `/var/log/audit/audit.log` | Tekst `ključ=vrijednost`, više zapisa po događaju |

Ovo nisu konkurenti nego slojevi. sshd prijavi neuspjelu prijavu preko syslog API-ja; journald je primi, a rsyslog je upiše u `auth.log`. auditd vidi nešto drugo: koji je proces otvorio `/etc/shadow` ili pokrenuo `execve`, bez obzira na to da li aplikacija išta loguje.

### syslog: facility i severity

Svaka syslog poruka ima **facility** (ko šalje) i **severity** (koliko je važno). Iz njih rsyslog odlučuje u koji fajl piše.

| Facility | Primjer pošiljaoca | Severity (0 najteže) |
|---|---|---|
| `auth`, `authpriv` | sshd, sudo, su, PAM | 0 emerg, 1 alert, 2 crit |
| `cron` | cron | 3 err, 4 warning |
| `daemon` | servisi bez svoje facility | 5 notice, 6 info |
| `kern` | kernel | 7 debug |
| `local0`–`local7` | tvoje aplikacije | |

Na Debianu je pravilo u `/etc/rsyslog.conf`:

```text
auth,authpriv.*                 /var/log/auth.log
*.*;auth,authpriv.none          -/var/log/syslog
```

Zato sigurnosno bitni događaji završe u `auth.log`, a ne u `syslog`.

### Kako izgleda auth.log

Od Debiana 12 rsyslog podrazumijevano piše **high precision timestamp** po RFC 3339 (sa mikrosekundama i zonom). Stariji sistemi i mnoge distribucije i dalje imaju tradicionalni format `Oct 16 09:14:02` bez godine i zone. Isti događaj u oba formata:

```text
2026-10-16T09:14:02.481233+00:00 lab sshd[412]: Failed password for invalid user admin from 10.0.5.23 port 51522 ssh2
Oct 16 09:14:02 lab sshd[412]: Failed password for invalid user admin from 10.0.5.23 port 51522 ssh2
```

Tipični zapisi koje ćeš tražiti:

```text
sshd[412]: Invalid user admin from 10.0.5.23 port 51522
sshd[412]: Failed password for invalid user admin from 10.0.5.23 port 51522 ssh2
sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2
sshd[430]: Accepted password for deploy from 10.0.5.23 port 51602 ssh2
sshd[430]: pam_unix(sshd:session): session opened for user deploy(uid=1001) by (uid=0)
sudo:   deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/cat /etc/shadow
useradd[455]: new user: name=backup2, UID=1002, GID=1002, home=/home/backup2, shell=/bin/bash
```

Brzo prebrojavanje u labu:

```bash
# neuspjele prijave po izvornoj IP adresi
grep -E 'Failed password|Invalid user' /var/log/auth.log \
  | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn

# uspješne prijave: ko, odakle, kako
grep -oE 'Accepted \w+ for \S+ from [0-9.]+' /var/log/auth.log

# sve sudo komande
grep 'sudo:' /var/log/auth.log | grep 'COMMAND='
```

Obrazac „mnogo `Failed password` pa jedan `Accepted` sa iste IP adrese“ je klasičan trag **brute force** napada (ATT&CK T1110) koji je uspio. Wazuh ima ugrađena pravila baš za to, što vidiš u modulu 03.

> **U praksi:** Prije nego napišeš ijedno pravilo, pogledaj sirovi log sa `tail -f` i proizvedi događaj sam (pogrešna lozinka preko `ssh deploy@localhost`). Pola grešaka u detekcijama dolazi od pretpostavke kako log izgleda, a ne od pogrešne logike.

### journald

**journald** čuva strukturirane zapise sa poljima koja počinju donjom crtom (`_PID`, `_UID`, `_SYSTEMD_UNIT`, `_COMM`) i koja proces ne može krivotvoriti, jer ih dodaje sam journald. To je prednost u odnosu na tekstualni syslog gdje je ime programa samo dio stringa.

```bash
# sshd na Debianu radi kao ssh.service
journalctl -u ssh --since "2026-10-16 09:00" --until "2026-10-16 10:00"

# samo greške i teže, od posljednjeg boota
journalctl -p err -b

# JSON, jedan zapis po liniji, za jq ili SIEM
journalctl -u ssh -o json --since today | jq -r '[.__REALTIME_TIMESTAMP, ._PID, .MESSAGE] | @tsv'

# filter po polju
journalctl _COMM=sudo _UID=1001
```

Dio JSON zapisa:

```json
{
  "__REALTIME_TIMESTAMP": "1792142042481233",
  "_HOSTNAME": "web01",
  "_SYSTEMD_UNIT": "ssh.service",
  "_COMM": "sshd",
  "_PID": "412",
  "SYSLOG_FACILITY": "10",
  "PRIORITY": "6",
  "MESSAGE": "Failed password for root from 10.0.5.23 port 51540 ssh2"
}
```

`__REALTIME_TIMESTAMP` je u mikrosekundama od epohe, uvijek UTC. Prikaz u `journalctl` je u lokalnoj zoni, osim ako dodaš `--utc`.

Bitne postavke u `/etc/systemd/journald.conf`:

| Opcija | Značenje |
|---|---|
| `Storage=persistent` | Čuvaj u `/var/log/journal` (inače se gube pri restartu ako direktorij ne postoji) |
| `SystemMaxUse=` | Gornja granica zauzeća diska; stari zapisi se brišu |
| `ForwardToSyslog=` | Prosljeđivanje rsyslogu (ako je instaliran) |
| `Seal=yes` | **Forward Secure Sealing**, kriptografsko pečaćenje (vidi integritet ispod) |

Na Debianu 12 rsyslog više nije podrazumijevano instaliran, pa na čistoj instalaciji `/var/log/auth.log` možda ne postoji. Agent onda mora čitati journald direktno. Wazuh agent (novije verzije 4.x) to radi preko `<localfile>` u kojem su i `<location>` i `<log_format>` postavljeni na `journald`.

### auditd

**auditd** je korisnički dio Linux Audit podsistema u kernelu. Ne zavisi od toga šta aplikacija odluči da loguje: kernel prijavi sistemski poziv koji odgovara pravilu. Pravila stoje u `/etc/audit/rules.d/*.rules`, a učitava ih `augenrules --load`.

```text
# /etc/audit/rules.d/50-kurs.rules
# pristup osjetljivim fajlovima (w = write, a = attribute change, r = read)
-w /etc/shadow -p rwa -k shadow_access
-w /etc/passwd -p wa -k identity
-w /etc/sudoers -p wa -k priv_esc
-w /etc/sudoers.d/ -p wa -k priv_esc

# svako pokretanje programa (64-bitni pozivi), samo za prave korisnike
-a always,exit -F arch=b64 -S execve -F auid>=1000 -F auid!=unset -k exec
```

Jedan događaj se sastoji od više zapisa sa istim serijskim brojem u `msg=audit(epoha:serija)`:

```text
type=SYSCALL msg=audit(1792142102.311:2045): arch=c000003e syscall=257 success=yes exit=3 ppid=430 pid=470 auid=1001 uid=0 gid=0 euid=0 comm="cat" exe="/usr/bin/cat" key="shadow_access"
type=CWD msg=audit(1792142102.311:2045): cwd="/home/deploy"
type=PATH msg=audit(1792142102.311:2045): item=0 name="/etc/shadow" inode=1311 nametype=NORMAL
```

Najvažnije polje za istragu je **auid** (audit user ID, „loginuid“): korisnik koji se prvobitno prijavio. Kad `deploy` uradi `sudo cat /etc/shadow`, `uid` je 0 (root), ali `auid` ostaje 1001. Tako znaš ko je stvarno iza root akcije.

```bash
ausearch -k shadow_access --start today -i     # -i prevodi UID-ove i syscall u imena
ausearch -ua 1001 -ts 09:00 -te 10:00          # po auid
aureport --auth --summary                      # sažetak autentifikacija
aureport -x --summary                          # najčešće pokretani programi
```

> **U praksi:** Pravilo `-S execve` za sve korisnike na zauzetom serveru proizvodi ogromnu količinu zapisa. Počni sa `-w` pravilima nad malim brojem osjetljivih fajlova i `execve` samo za interaktivne korisnike (`auid>=1000`), pa proširuj kad vidiš volumen.

## Vrijeme i vremenske zone

Istraga je rekonstrukcija hronologije iz više izvora. Ako izvori ne dijele isti sat i istu zonu, hronologija laže.

| Izvor | Vrijeme u zapisu |
|---|---|
| auth.log (tradicionalni format) | Lokalno vrijeme hosta, **bez godine i zone** |
| auth.log (Debian 12, RFC 3339) | Lokalno vrijeme sa pomakom, npr. `+02:00` |
| journald | Mikrosekunde od epohe (UTC), prikaz lokalno |
| auditd | Sekunde od epohe (UTC) u `msg=audit(...)` |
| CloudTrail `eventTime` | UTC, ISO 8601 sa `Z` |
| Kubernetes audit | UTC, `requestReceivedTimestamp` i `stageTimestamp` |
| Wazuh `alerts.json` | `timestamp` sa pomakom zone managera |

Pravila koja štede sate:

- Svi serveri u **UTC** i sinhronizovani preko NTP-a (`chronyc tracking`, `timedatectl`).
- Gdje možeš, loguj sa zonom (RFC 3339). Tradicionalni format nema godinu, pa se zapisi oko Nove godine lako pogrešno sortiraju.
- Epohu pretvaraš sa `date -u -d @1792142102`.
- U izvještaju o incidentu svako vrijeme piši u UTC i to jednom naglasi.

> **U praksi:** Kad spajaš auth.log sa servera u Frankfurtu i CloudTrail, prvo zapiši pomak svakog izvora. Klasična greška je zaključak „napadač je ušao u AWS sat vremena prije SSH prijave“ kad je razlika samo CET naspram UTC.

## Integritet logova

Napadač sa root pristupom može obrisati ili izmijeniti lokalne logove (ATT&CK **T1070.002**, Clear Linux or Mac System Logs). Odbrana je slojevita:

| Mjera | Šta postiže |
|---|---|
| Slanje logova odmah sa hosta (agent, syslog forwarding) | Kopija je van domašaja napadača prije nego dobije root |
| Append-only atribut (`chattr +a /var/log/auth.log`) | Fajl se ne može prepisati, samo dopuniti (root ga može skinuti, ali to je dodatni trag) |
| journald **Forward Secure Sealing** | `journalctl --setup-keys` pa `Seal=yes`; `journalctl --verify` otkriva naknadne izmjene |
| auditd pravilo nad samim logovima | `-w /var/log/ -p wa -k log_tamper` |
| CloudTrail **log file integrity validation** | Digest fajlovi sa hashom i potpisom; `aws cloudtrail validate-logs` |
| Nepromjenljiv storage (S3 Object Lock) | Ni administrator ne može obrisati prije isteka retencije |

Tragovi brisanja koje treba tražiti: rupa u vremenu (nema zapisa 40 minuta na zauzetom serveru), fajl kraći nego juče, `wtmp`/`btmp` prazni, ili događaj `auditd` tipa `CONFIG_CHANGE` i `DAEMON_END`.

```bash
# provjera FSS pečata (na hostu sa systemd)
journalctl --verify

# da li neko dira logove: veličina i mtime
stat -c '%n %s %y' /var/log/auth.log*
```

## Cloud i Kubernetes izvori (pregled)

Detaljna istraga je u modulu 02. Ovdje je bitno znati koji izvor odgovara na koje pitanje.

| Izvor | Odgovara na pitanje | Ključna polja |
|---|---|---|
| **AWS CloudTrail** | Ko je pozvao koji AWS API, odakle, sa kojim kredencijalima | `eventTime`, `eventSource`, `eventName`, `userIdentity`, `sourceIPAddress`, `errorCode` |
| **Azure Activity log** | Promjene nad Azure resursima (control plane) | `OperationNameValue`, `Caller`, `ActivityStatusValue`, `ResourceId` |
| **Entra ID sign-in logs** | Prijave korisnika i servisnih principala | `UserPrincipalName`, `IPAddress`, `ResultType`, `AppDisplayName`, `ConditionalAccessStatus` |
| **Kubernetes audit** | Ko je šta tražio od API servera | `user.username`, `verb`, `objectRef`, `sourceIPs`, `responseStatus.code` |

Bitne razlike:

- CloudTrail podrazumijevano bilježi **management events** (control plane, npr. `CreateUser`, `RunInstances`). **Data events** (npr. S3 `GetObject`) moraš eksplicitno uključiti i plaćaju se posebno. Event history u konzoli čuva 90 dana management događaja; za duže čuvanje i za SIEM treba **trail** u S3.
- Entra sign-in logovi imaju `ResultType` 0 za uspjeh, a kod greške broj, npr. `50126` za pogrešno korisničko ime ili lozinku. U Sentinelu su to tabele `SigninLogs` i `AzureActivity`.
- Kubernetes audit **nije uključen podrazumijevano** na kubeadm klasteru: treba `--audit-policy-file` i `--audit-log-path` na kube-apiserveru (radio si to u CKS kursu). Managed klasteri (EKS, AKS, GKE) ga šalju u svoj logging servis, često tek kad ga uključiš.

Isti događaj „neuspjela prijava“ u tri izvora:

```text
auth.log:   sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2
CloudTrail: "eventName": "ConsoleLogin", "responseElements": {"ConsoleLogin": "Failure"}
Entra:      ResultType = 50126, UserPrincipalName = "ana@firma.onmicrosoft.com"
```

Tri formata, tri imena za korisnika i IP adresu. Zato postoji normalizacija.

## Prikupljanje: agent ili syslog forwarding

| Način | Kako radi | Prednosti | Mane |
|---|---|---|---|
| **Agent** (Wazuh agent, Elastic Agent, Splunk UF) | Proces na hostu čita fajlove i journald, šalje šifrovano | Bufferovanje kad je mreža dolje, FIM, inventar, odgovor | Softver na svakom hostu, održavanje |
| **Syslog forwarding** (rsyslog/syslog-ng) | Host šalje syslog poruke centralnom kolektoru | Ugrađeno, radi i na mrežnoj opremi | Samo ono što ide kroz syslog; UDP gubi poruke |
| **API pull** | Kolektor povlači iz cloud API-ja ili S3 | Jedini način za SaaS i cloud | Kašnjenje, kvote, kredencijali kolektora |
| **Push u stream** | Servis šalje u Kinesis, Event Hub, Pub/Sub | Skalira | Zavisi od dobavljača |

### rsyslog forwarding

Prosljeđivanje na kolektor preko TCP-a sa redom na disku, da se poruke ne izgube kad je kolektor nedostupan:

```text
# /etc/rsyslog.d/90-siem.conf
auth,authpriv.*  action(type="omfwd"
                        target="siem.interno" port="514" protocol="tcp"
                        queue.type="LinkedList" queue.filename="siem_fwd"
                        queue.saveOnShutdown="on" action.resumeRetryCount="-1")
```

Kratka stara sintaksa: `*.* @host:514` je UDP, `*.* @@host:514` je TCP. UDP syslog nema potvrdu prijema, šalje se u čistom tekstu i lako ga je lažirati. Za produkciju koristi TCP sa TLS-om (rsyslog `gtls` driver) ili agenta.

Prijem na Wazuh manageru ide kroz `<remote>` blok u `ossec.conf` (port 514, podrazumijevano isključen), sa listom dozvoljenih izvora:

```xml
<remote>
  <connection>syslog</connection>
  <port>514</port>
  <protocol>tcp</protocol>
  <allowed-ips>10.0.0.0/16</allowed-ips>
</remote>
```

### Lokalni fajl u labu

U labu nema agenta: manager sam čita `auth.log` preko `<localfile>`:

```xml
<localfile>
  <log_format>syslog</log_format>
  <location>/var/log/auth.log</location>
</localfile>
```

`log_format` govori Wazuhu kako da razdvoji zapise. Vrijednosti koje ćeš sretati: `syslog` (jedna linija po događaju, i za većinu tekstualnih logova), `json`, `journald`, `audit` (za `audit.log`), `multi-line`.

```bash
grep -A3 '<localfile>' /var/ossec/etc/ossec.conf
tail -f /var/ossec/logs/ossec.log | grep -i logcollector   # potvrda da je fajl otvoren
```

> **U praksi:** Prije uvođenja novog izvora u SIEM izračunaj volumen (`du -sh`, broj linija dnevno). Licence komercijalnih SIEM-ova se obično plaćaju po GB dnevno, a i besplatni Wazuh indexer ima svoju cijenu u disku. Filtriraj šum na izvoru, ne u SIEM-u.

## Normalizacija: ECS i OCSF

**Normalizacija** prevodi polja iz različitih izvora u zajedničku šemu, tako da jedno pravilo („ista IP adresa ima 20 neuspjelih prijava“) radi nad SSH-om, VPN-om i cloud prijavama.

| Šema | Ko je koristi | Stil |
|---|---|---|
| **ECS** (Elastic Common Schema) | Elastic, OpenTelemetry semantičke konvencije su nastale spajanjem sa ECS-om | Imenovana polja sa tačkama: `source.ip`, `user.name`, `event.outcome` |
| **OCSF** (Open Cybersecurity Schema Framework) | AWS Security Lake, mnogi dobavljači | Klase događaja sa numeričkim ID-jevima: `class_uid`, `activity_id`, `status_id` |
| Wazuh polja | Wazuh dekoderi | `data.srcip`, `data.srcuser`, `data.dstuser` |
| Sentinel ASIM | Microsoft Sentinel | Parseri po šemi (Authentication, NetworkSession…) |

Ista neuspjela SSH prijava u ECS-u:

```json
{
  "@timestamp": "2026-10-16T09:14:02.481Z",
  "event": { "category": ["authentication"], "type": ["start"], "outcome": "failure" },
  "source": { "ip": "10.0.5.23", "port": 51540 },
  "user": { "name": "root" },
  "host": { "name": "lab" },
  "process": { "name": "sshd", "pid": 418 }
}
```

I u OCSF-u (klasa **Authentication**, `class_uid` 3002, kategorija Identity & Access Management):

```json
{
  "time": 1792142042481,
  "class_uid": 3002,
  "category_uid": 3,
  "activity_id": 1,
  "status_id": 2,
  "status": "Failure",
  "user": { "name": "root" },
  "src_endpoint": { "ip": "10.0.5.23", "port": 51540 },
  "metadata": { "product": { "name": "sshd" }, "version": "1.x" }
}
```

`activity_id` 1 je Logon, `status_id` 2 je Failure. CloudTrail pozivi API-ja u OCSF-u idu u klasu **API Activity** (`class_uid` 6003), a AWS Security Lake ih tako i čuva.

Normalizacija ima cijenu: originalna poruka se mora sačuvati (`event.original` u ECS-u, `raw_data` u OCSF-u, `full_log` u Wazuhu), jer parser može pogriješiti, a forenzičaru treba sirovi zapis.

## Retencija

Koliko dugo čuvati logove zavisi od tri stvari: propisa, prosječnog vremena otkrivanja (napadi se često otkriju tek nakon više sedmica) i cijene.

| Sloj | Tipično trajanje | Gdje |
|---|---|---|
| Vruće (pretraživo u SIEM-u) | 30–90 dana | Indexer, SIEM |
| Toplo/hladno (sporije, jeftinije) | 1 godina | Object storage, arhivski indeksi |
| Arhiva (regulativa) | Prema propisu (npr. PCI DSS traži godinu dana, od toga 3 mjeseca odmah dostupno) | S3 sa Object Lock, Glacier |

Lokalna rotacija je druga stvar: `logrotate` na hostu briše stare fajlove (`/etc/logrotate.d/rsyslog`, obično 4 sedmice). Zato host nije mjesto za retenciju; centralni sistem jeste.

> **U praksi:** Pri svakoj retenciji zapitaj se „mogu li odgovoriti šta je ovaj ključ radio prije 120 dana?“. Ako je CloudTrail samo u Event history (90 dana) i nema traila u S3, odgovor je ne.

## Kratko: SIEM upiti nad istim podacima

Isto pitanje („IP adrese sa više od 10 neuspjelih SSH prijava“) u tri jezika, da vidiš da je logika ista, a sintaksa različita:

```text
# Splunk SPL
index=linux sourcetype=linux_secure "Failed password"
| rex "from (?<src_ip>\d+\.\d+\.\d+\.\d+)" | stats count by src_ip | where count > 10

# Microsoft Sentinel KQL (Syslog tabela)
Syslog | where ProcessName == "sshd" and SyslogMessage has "Failed password"
| extend src_ip = extract(@"from (\d+\.\d+\.\d+\.\d+)", 1, SyslogMessage)
| summarize count() by src_ip | where count_ > 10

# Lab: shell nad sirovim fajlom
grep 'Failed password' /var/log/auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | awk '$1>10'
```

## Rezime

- Linux ima tri sloja logova: syslog (tekst, facility/severity), journald (strukturirana polja, `_` polja dodaje journald) i auditd (sistemski pozivi po pravilima, `auid` čuva stvarnog korisnika).
- Debian 12 rsyslog piše RFC 3339 vrijeme sa zonom; tradicionalni format nema godinu ni zonu. Servere drži u UTC sa NTP-om.
- Integritet: šalji logove sa hosta odmah, koristi FSS, append-only i nepromjenljiv storage; traži rupe u vremenu kao trag brisanja (T1070.002).
- CloudTrail, Azure Activity, Entra sign-in i Kubernetes audit odgovaraju na pitanje „ko je pozvao koji API“; data events u CloudTrailu i Kubernetes audit treba eksplicitno uključiti.
- Agent daje bufferovanje, šifrovanje i dodatne funkcije; syslog forwarding preko UDP-a gubi poruke i lako se lažira, pa koristi TCP sa TLS-om.
- ECS (imenovana polja) i OCSF (klase sa ID-jevima, npr. Authentication 3002, API Activity 6003) omogućavaju da jedno pravilo radi nad više izvora; originalni zapis uvijek čuvaj.
- Retencija se planira po propisu i vremenu otkrivanja; host sa logrotate nije arhiva.
