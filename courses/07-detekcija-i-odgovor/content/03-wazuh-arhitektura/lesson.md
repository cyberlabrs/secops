## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 2:

- **2.1** Arhitektura **Wazuha**: agent, manager, indexer, dashboard; **ruleset**, nivoi alarma, `alerts.json`.
- **2.3** Praćenje integriteta fajlova (**FIM**), procjena konfiguracije (**SCA**), otkrivanje ranjivosti.

Pisanje vlastitih dekodera i pravila (2.2) i active response (2.4) su u modulu 04. Ovdje učiš kako Wazuh radi iznutra, gdje šta stoji i kako da pročitaš alarm.

**Wazuh** je otvoreni XDR/SIEM nastao iz OSSEC HIDS-a. Zato mnoge putanje i dalje nose ime `ossec` (`/var/ossec/`, `ossec.conf`). U labu radi **Wazuh manager 4.14** bez indexera i dashboarda: sve vidiš kroz fajlove i komandnu liniju, što je i najbolji način da razumiješ šta dashboard samo prikazuje.

```bash
wazuh-start                                   # lab skripta: rsyslog, sshd i Wazuh manager
/var/ossec/bin/wazuh-control info             # verzija
/var/ossec/bin/wazuh-control status           # koji daemoni rade
```

## Komponente

| Komponenta | Uloga | Port |
|---|---|---|
| **Wazuh agent** | Na endpointu: čita logove, FIM, SCA, inventar (syscollector), izvršava active response | šalje na 1514/TCP |
| **Wazuh server** (manager) | Prima događaje, dekodira, primjenjuje pravila, pravi alarme, upravlja agentima | 1514 agenti, 1515 upis agenata, 55000 REST API, 1516 klaster |
| **Wazuh indexer** | Pretraživo skladište alarma i stanja (fork OpenSearcha) | 9200 API, 9300–9400 klaster |
| **Wazuh dashboard** | Web interfejs (fork OpenSearch Dashboardsa) | 443 |

Tok događaja:

```text
[agent: logcollector, syscheckd, SCA, syscollector]
        │  1514/TCP, šifrovano
        ▼
[manager: wazuh-remoted → wazuh-analysisd (dekoderi → pravila)]
        │  alerts.json / alerts.log  (+ archives.json ako je logall_json)
        ▼
[Filebeat] ──► [indexer :9200] ──► [dashboard :443]
```

Manager ima i svoje lokalne module: on je za sebe „agent 000“. Zato u labu, bez ijednog agenta, manager i dalje čita `/var/log/auth.log`, radi FIM nad svojim fajlovima i SCA nad svojom konfiguracijom.

> **U praksi:** Kad alarm „ne stiže“ na dashboard, idi redom kroz tok: da li agent šalje (`/var/ossec/logs/ossec.log` na agentu), da li manager prima, da li je alarm u `alerts.json` na manageru, da li ga Filebeat šalje u indexer. Ako je u `alerts.json`, problem nije u pravilima.

### Daemoni managera

| Daemon | Šta radi |
|---|---|
| `wazuh-remoted` | Komunikacija sa agentima (1514), prima i syslog ako je `<remote>` za syslog uključen |
| `wazuh-authd` | Upis (enrollment) novih agenata na 1515 |
| `wazuh-analysisd` | Srce: dekodiranje i pravila, piše alarme |
| `wazuh-logcollector` | Čita lokalne logove iz `<localfile>` |
| `wazuh-syscheckd` | FIM |
| `wazuh-modulesd` | Moduli: SCA, syscollector, vulnerability detection, cloud integracije |
| `wazuh-db` | Interna baza (stanje agenata, FIM, SCA, inventar) |
| `wazuh-execd` | Izvršava active response skripte |
| `wazuh-monitord` | Rotacija i kompresija logova, praćenje agenata |
| `wazuh-apid` | REST API na 55000 |

```bash
/var/ossec/bin/wazuh-control status
ps -eo pid,user,cmd | grep -E 'wazuh-(analysisd|remoted|syscheckd|modulesd|logcollector)' | grep -v grep
tail -n 50 /var/ossec/logs/ossec.log          # dnevnik samog Wazuha: greške u konfiguraciji su ovdje
```

### Agenti (van laba)

Agent se upisuje na manager preko `wazuh-authd` i dobija ID i ključ. Najčešće se manager zadaje pri instalaciji:

```bash
# na endpointu (Debian/Ubuntu), primjer
WAZUH_MANAGER="10.0.0.10" WAZUH_AGENT_GROUP="linux-web" apt-get install wazuh-agent
systemctl enable --now wazuh-agent

# na manageru: spisak agenata i stanje
/var/ossec/bin/agent_control -l
```

Konfiguracija za grupu agenata se drži centralno na manageru u `/var/ossec/etc/shared/<grupa>/agent.conf` i automatski se distribuira. Tako FIM i SCA podešavaš jednom za sve web servere.

## Konfiguracija i ruleset

| Putanja | Sadržaj |
|---|---|
| `/var/ossec/etc/ossec.conf` | Glavna konfiguracija (XML, više `<ossec_config>` blokova je dozvoljeno) |
| `/var/ossec/ruleset/decoders/` | Ugrađeni dekoderi; **ne mijenjaj**, nadogradnja ih prepisuje |
| `/var/ossec/ruleset/rules/` | Ugrađena pravila (npr. `0095-sshd_rules.xml`, `0015-ossec_rules.xml`) |
| `/var/ossec/etc/decoders/local_decoder.xml` | Tvoji dekoderi |
| `/var/ossec/etc/rules/local_rules.xml` | Tvoja pravila (ID-jevi od 100000 naviše) |
| `/var/ossec/etc/lists/` | CDB liste (IP adrese, korisnici, hashevi) |
| `/var/ossec/ruleset/sca/` | SCA politike (YAML) |
| `/var/ossec/logs/alerts/alerts.json` | Alarmi, JSON po liniji |
| `/var/ossec/logs/alerts/alerts.log` | Isti alarmi, tekstualno |
| `/var/ossec/logs/archives/archives.json` | Svi događaji, samo ako je `<logall_json>yes</logall_json>` |
| `/var/ossec/logs/ossec.log` | Dnevnik Wazuha |

Ključni dijelovi `ossec.conf` za ovaj modul:

```xml
<ossec_config>
  <global>
    <jsonout_output>yes</jsonout_output>   <!-- piše alerts.json -->
    <alerts_log>yes</alerts_log>           <!-- piše alerts.log -->
    <logall_json>no</logall_json>          <!-- archives.json: sve, ne samo alarmi -->
  </global>

  <alerts>
    <log_alert_level>3</log_alert_level>   <!-- prag za upis alarma -->
    <email_alert_level>12</email_alert_level>
  </alerts>

  <ruleset>
    <decoder_dir>ruleset/decoders</decoder_dir>
    <rule_dir>ruleset/rules</rule_dir>
    <decoder_dir>etc/decoders</decoder_dir>
    <rule_dir>etc/rules</rule_dir>
  </ruleset>
</ossec_config>
```

Svaka izmjena traži restart, a prije restarta provjeru:

```bash
/var/ossec/bin/wazuh-analysisd -t && /var/ossec/bin/wazuh-control restart
```

### Kako analysisd obrađuje događaj

1. **Pre-decoding**: izvlači standardno zaglavlje (vrijeme, host, `program_name`) iz syslog linije.
2. **Decoding**: dekoder izabran po `program_name` ili obrascu izvlači polja (`srcip`, `srcuser`, `dstuser`…).
3. **Rule matching**: pravila se provjeravaju kao stablo. Pravilo bez roditelja (npr. 5700 za sve sshd poruke) grana se u djecu preko `if_sid`. Pobjeđuje najdublje pravilo koje odgovara, a alarm nastaje ako je njegov nivo iznad `log_alert_level`.

Sve tri faze vidiš u `wazuh-logtest`:

```bash
/var/ossec/bin/wazuh-logtest
```

```text
Oct 16 09:14:02 lab sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2

**Phase 1: Completed pre-decoding.
        full event: 'Oct 16 09:14:02 lab sshd[418]: Failed password for root from 10.0.5.23 port 51540 ssh2'
        timestamp: 'Oct 16 09:14:02'
        hostname: 'lab'
        program_name: 'sshd'

**Phase 2: Completed decoding.
        name: 'sshd'
        parent: 'sshd'
        srcip: '10.0.5.23'
        srcport: '51540'
        dstuser: 'root'

**Phase 3: Completed filtering (rules).
        id: '5760'
        level: '5'
        description: 'sshd: authentication failed.'
        groups: '['syslog', 'sshd', 'authentication_failed']'
        mitre.id: '['T1110.001', 'T1021.004']'
        ...
**Alert to be generated.
```

Tačan ispis zavisi od verzije; bitan je redoslijed faza i koje pravilo je pobijedilo.

### Ugrađena sshd pravila koja ćeš sretati

| ID | Nivo | Opis | Napomena |
|---|---|---|---|
| 5710 | 5 | Attempt to login using a non-existent user | `Invalid user …` |
| 5712 | 10 | Brute force, non existent user | 8 puta 5710 u 120 s |
| 5715 | 3 | Authentication success | `Accepted …` |
| 5760 | 5 | Authentication failed | `Failed password` |
| 5763 | 10 | Brute force, authentication failed | 8 puta 5760 sa iste IP adrese u 120 s |

```bash
grep -n 'id="5763"' -A8 /var/ossec/ruleset/rules/0095-sshd_rules.xml
```

Pravilo 5763 koristi `frequency="8" timeframe="120"`, `if_matched_sid` 5760 i `same_source_ip`. To je **korelacija**, koju detaljno radiš u modulu 04.

## Nivoi alarma

Nivo je od 0 do 15. Nivo 0 znači „ignoriši“ i koristi se za utišavanje lažnih pozitiva.

| Nivo | Značenje (po Wazuh klasifikaciji) | Primjer |
|---|---|---|
| 0 | Ignorisano | Utišavanje poznatog šuma |
| 2 | Sistemska obavijest niskog prioriteta | |
| 3 | Uspješan ili dozvoljen događaj | 5715 uspješna SSH prijava |
| 5 | Greška koju je izazvao korisnik | 5760 pogrešna lozinka |
| 7 | „Bad word“ podudaranje | 550 promjena checksuma (FIM) |
| 8 | Prvi put viđeno | Prva prijava korisnika |
| 10 | Više grešaka korisnika | 5763 brute force |
| 12 | Događaj visoke važnosti | |
| 13–15 | Neuobičajena greška, napad visoke važnosti, ozbiljan napad | Korelisani napadi, gotovo bez lažnih pozitiva |

Podrazumijevani prag upisa je 3, a email ide od 12. Praktična podjela za SOC trijažu: 0–6 kontekst, 7–11 pregled u toku smjene, 12+ odmah.

> **U praksi:** Ne podiži nivo ugrađenog pravila samo zato što ti se alarm „ne vidi“. Napiši dijete pravilo u `local_rules.xml` sa uslovom koji ga čini ozbiljnim (npr. 5715 za korisnika `root` sa IP adrese van VPN-a) i tom djetetu daj viši nivo. Tako ne pokvariš ugrađenu logiku koju nadogradnja vraća.

## alerts.json: anatomija alarma

Jedan red iz `alerts.json` (formatirano, skraćeno):

```json
{
  "timestamp": "2026-10-16T09:14:31.512+0000",
  "rule": {
    "level": 10,
    "description": "sshd: brute force trying to get access to the system. Authentication failed.",
    "id": "5763",
    "frequency": 8,
    "firedtimes": 1,
    "mail": false,
    "groups": ["syslog", "sshd", "authentication_failures"],
    "mitre": { "id": ["T1110"], "tactic": ["Credential Access"], "technique": ["Brute Force"] },
    "pci_dss": ["11.4", "10.2.4", "10.2.5"]
  },
  "agent": { "id": "000", "name": "lab" },
  "manager": { "name": "lab" },
  "id": "1792142071.48213",
  "previous_output": "Oct 16 09:14:29 lab sshd[452]: Failed password for root from 10.0.5.23 …",
  "full_log": "Oct 16 09:14:31 lab sshd[455]: Failed password for root from 10.0.5.23 port 51700 ssh2",
  "predecoder": { "program_name": "sshd", "timestamp": "Oct 16 09:14:31", "hostname": "lab" },
  "decoder": { "parent": "sshd", "name": "sshd" },
  "data": { "srcip": "10.0.5.23", "srcport": "51700", "dstuser": "root" },
  "location": "/var/log/auth.log"
}
```

| Polje | Značenje |
|---|---|
| `rule.id`, `rule.level`, `rule.description` | Koje pravilo i koliko je ozbiljno |
| `rule.groups` | Kategorije (`authentication_failed`, `syscheck`, `sca`…); dobre za filtere |
| `rule.mitre` | ATT&CK mapiranje iz pravila |
| `rule.firedtimes` | Koliko je puta pravilo okinulo od pokretanja analysisd |
| `agent.id` | `000` je sam manager |
| `full_log` | Originalni zapis (normalizacija nikad ne briše original) |
| `data.*` | Polja koja je dekoder izvukao |
| `location` | Fajl ili izvor iz kojeg je događaj stigao |
| `syscheck.*`, `data.sca.*` | Dodatna polja za FIM i SCA alarme |

Rad sa alarmima bez dashboarda:

```bash
A=/var/ossec/logs/alerts/alerts.json

# uživo, sažeto
tail -f $A | jq -r '[.timestamp, .rule.id, .rule.level, .rule.description, (.data.srcip // "-")] | @tsv'

# najčešća pravila
jq -r '.rule.id + " " + .rule.description' $A | sort | uniq -c | sort -rn | head

# samo nivo 10 i više
jq -c 'select(.rule.level >= 10)' $A

# po ATT&CK tehnici
jq -r 'select(.rule.mitre) | .rule.mitre.id[]' $A | sort | uniq -c
```

Stari alarmi se rotiraju dnevno u `/var/ossec/logs/alerts/<godina>/<mjesec>/` kao komprimovani fajlovi sa checksum fajlom pored. Za pretragu kroz više dana koristi `zcat … | jq`.

> **U praksi:** `alerts.json` je ugovor između Wazuha i svega iza njega (indexer, SOAR, skripte). Kad budeš pisao integracije ili Sigma pravila nad Wazuh podacima (modul 06), polja kao `rule.groups`, `data.srcip` i `agent.name` su ono po čemu filtriraš.

## FIM: praćenje integriteta fajlova

**FIM** (u konfiguraciji `syscheck`) pamti stanje fajlova (hash, vlasnik, dozvole, veličina, inode, vrijeme izmjene) i prijavi kad se nešto doda, promijeni ili obriše. Pokriva tehnike kao što su izmjena `authorized_keys` (T1098.004), dodavanje korisnika u `/etc/passwd` (T1136.001), izmjena binarnih fajlova ili cron zadataka (T1053.003).

Podrazumijevana konfiguracija managera već prati `/etc`, `/usr/bin`, `/usr/sbin`, `/bin`, `/sbin` i `/boot` svakih 12 sati. Za praktičan rad dodaješ osjetljive putanje u realnom vremenu:

```xml
<syscheck>
  <disabled>no</disabled>
  <frequency>43200</frequency>                   <!-- puni sken svakih 12 h -->
  <scan_on_start>yes</scan_on_start>
  <alert_new_files>yes</alert_new_files>

  <directories>/etc,/usr/bin,/usr/sbin</directories>
  <directories>/bin,/sbin,/boot</directories>

  <!-- osjetljivo: realno vrijeme, sa sadržajem izmjene -->
  <directories realtime="yes" report_changes="yes">/etc/ssh</directories>
  <directories realtime="yes" report_changes="yes">/etc/sudoers.d</directories>
  <directories realtime="yes" report_changes="yes">/root/.ssh</directories>
  <directories realtime="yes">/etc/cron.d,/var/spool/cron</directories>

  <ignore>/etc/mtab</ignore>
  <ignore type="sregex">.log$|.swp$</ignore>
  <nodiff>/etc/ssl/private</nodiff>              <!-- javi izmjenu, ali ne šalji sadržaj -->
</syscheck>
```

| Opcija | Značenje |
|---|---|
| `frequency` | Interval punog skena u sekundama (podrazumijevano 43200) |
| `realtime="yes"` | Promjene odmah, preko inotify; samo za direktorije |
| `whodata="yes"` | Uz promjenu i ko ju je napravio (korisnik, proces); na Linuxu preko auditd-a ili eBPF-a |
| `report_changes="yes"` | Diff sadržaja tekstualnih fajlova; čuva kopije, troši prostor |
| `check_all` | Sve provjere atributa (podrazumijevano uključeno) |
| `ignore` | Isključi putanju (ili regex sa `type="sregex"`) |
| `nodiff` | Javi izmjenu, ali ne prikazuj sadržaj (tajne!) |

### FIM alarmi

| Pravilo | Nivo | Događaj |
|---|---|---|
| 554 | 5 | Fajl dodat (`syscheck.event: added`) |
| 550 | 7 | Promijenjen checksum ili atributi (`modified`) |
| 553 | 7 | Fajl obrisan (`deleted`) |

```json
{
  "rule": { "id": "550", "level": 7, "description": "Integrity checksum changed.", "groups": ["ossec", "syscheck", "syscheck_entry_modified", "syscheck_file"] },
  "syscheck": {
    "path": "/etc/ssh/sshd_config",
    "mode": "realtime",
    "event": "modified",
    "changed_attributes": ["size", "mtime", "md5", "sha1", "sha256"],
    "sha256_before": "4c1e…", "sha256_after": "9a77…",
    "uname_after": "root", "perm_after": "rw-r--r--",
    "diff": "< PermitRootLogin no\n---\n> PermitRootLogin yes\n"
  }
}
```

Isprobaj u labu:

```bash
# nakon izmjene ossec.conf i restarta
echo "# test FIM $(date)" >> /etc/ssh/sshd_config
sleep 5
jq -c 'select(.rule.groups | index("syscheck")) | {id: .rule.id, path: .syscheck.path, event: .syscheck.event, diff: .syscheck.diff}' \
  /var/ossec/logs/alerts/alerts.json | tail -3
```

Ako alarm ne stigne odmah, provjeri `ossec.log`: realtime traži da direktorij postoji pri pokretanju, a promjene van realtime direktorija čekaju sljedeći zakazani sken.

> **U praksi:** FIM nad `/etc` na serverima kojima upravlja Ansible ili Puppet proizvodi alarm pri svakom deployu. Ne gasi FIM; dodaj pravilo nivoa 0 za poznate putanje u prozoru održavanja ili koreliraj sa deploy događajem. Izmjena `sshd_config` ili `authorized_keys` van deploya je upravo ono što želiš vidjeti.

## SCA: procjena sigurnosne konfiguracije

**SCA** (Security Configuration Assessment) provjerava konfiguraciju po politikama u YAML-u, najčešće po **CIS Benchmarku**. Radi ga `wazuh-modulesd`, a politike za tvoj OS su u `/var/ossec/ruleset/sca/` (za Debian 12 `cis_debian12.yml`).

```xml
<sca>
  <enabled>yes</enabled>
  <scan_on_start>yes</scan_on_start>
  <interval>12h</interval>
  <skip_nfs>yes</skip_nfs>
  <!-- opcionalno: vlastite politike ili isključenje ugrađene -->
  <policies>
    <policy>etc/shared/kurs_ssh.yml</policy>
  </policies>
</sca>
```

Struktura politike (skraćen primjer u stilu ugrađenih):

```yaml
policy:
  id: "kurs_ssh"
  file: "kurs_ssh.yml"
  name: "Kurs: osnovna SSH pravila"
  description: "Provjere sshd konfiguracije za lab"

requirements:
  title: "Debian sa OpenSSH serverom"
  description: "Politika važi samo ako postoji sshd_config"
  condition: all
  rules:
    - "f:/etc/ssh/sshd_config"

checks:
  - id: 100001
    title: "Root prijava preko SSH-a je isključena"
    rationale: "Prijava pojedinačnim nalogom pa sudo ostavlja jasan trag ko je šta radio."
    remediation: "U /etc/ssh/sshd_config postavi PermitRootLogin no i restartuj sshd."
    compliance:
      - cis: ["5.1.20"]
    condition: all
    rules:
      - 'c:sshd -T -> r:^permitrootlogin\s+no'
```

| Element pravila | Značenje |
|---|---|
| `f:putanja` | Fajl postoji |
| `f:putanja -> r:regex` | Fajl sadrži liniju koja odgovara regexu |
| `c:komanda -> r:regex` | Izlaz komande sadrži liniju koja odgovara |
| `d:direktorij` | Direktorij postoji |
| `p:proces` | Proces radi |
| `not` ispred pravila | Negacija |
| `condition: all / any / none` | Sva, bar jedno ili nijedno pravilo mora biti tačno |

`sshd -T` ispisuje efektivnu konfiguraciju malim slovima, zato regex gleda `permitrootlogin`. Ugrađena CIS politika koristi isti pristup.

Rezultat svake provjere je `passed`, `failed` ili `not applicable`. Alarmi dolaze iz pravila u `0570-sca_rules.xml`:

| Pravilo | Nivo | Kada |
|---|---|---|
| 19001–19005 | 3–9 | Sažetak skena; nivo raste kako rezultat (score) pada |
| 19007 | 7 | Provjera pala |
| 19008 | 3 | Provjera prošla |
| 19011 | 9 | Status promijenjen iz passed u failed |

Pravilo 19011 je najkorisnije za detekciju: neko je oslabio konfiguraciju koja je bila ispravna.

```bash
jq -r 'select(.rule.groups | index("sca")) | [.rule.id, .rule.level, (.data.sca.check.result // .data.sca.score // "-"), .rule.description] | @tsv' \
  /var/ossec/logs/alerts/alerts.json | tail -20
```

SCA i FIM se dopunjuju: FIM kaže „`sshd_config` je promijenjen“, SCA kaže „i sada root prijava više nije zabranjena“.

## Otkrivanje ranjivosti

Od verzije 4.8 **vulnerability detection** radi na manageru: agenti preko **syscollectora** šalju inventar paketa, a manager ga upoređuje sa Wazuh CTI feedom ranjivosti (CVE). Rezultati se čuvaju kao stanje u indexeru, a promjene (nova ranjivost, riješena ranjivost) daju i alarme.

```xml
<vulnerability-detection>
  <enabled>yes</enabled>
  <index-status>yes</index-status>
  <feed-update-interval>60m</feed-update-interval>
</vulnerability-detection>
```

U labu ovo ne radi: nema indexera ni interneta za feed. To je dobra lekcija o zavisnostima: FIM i SCA rade lokalno na agentu i daju alarme u `alerts.json`, dok otkrivanje ranjivosti traži feed i indexer. U produkciji bez interneta Wazuh podržava offline ažuriranje feeda.

| Modul | Gdje radi | Šta treba | Odgovara na |
|---|---|---|---|
| FIM | Agent (`wazuh-syscheckd`) | Ništa dodatno | Šta se promijenilo na disku i (sa whodata) ko je to uradio |
| SCA | Agent (`wazuh-modulesd`) | YAML politika | Da li je konfiguracija u skladu sa standardom |
| Vulnerability detection | Manager | Syscollector inventar, CTI feed, indexer | Koji instalirani paketi imaju poznate CVE |

> **U praksi:** Vulnerability detection na velikom parku servera daje hiljade nalaza. Prioritet postavljaš kombinacijom: CVSS i postojanje exploita (npr. CISA KEV), izloženost hosta internetu i SCA rezultat istog hosta. Ranjiv paket na serveru koji nije izložen i ima čvrstu konfiguraciju čeka; isti paket na javnom web serveru ne čeka.

## Rezime

- Wazuh čine agent, manager (server), indexer i dashboard; agenti šalju na 1514/TCP, upisuju se na 1515, API je na 55000, indexer na 9200.
- `wazuh-analysisd` radi pre-decoding, decoding i rule matching; sve tri faze vidiš u `wazuh-logtest`.
- Ugrađeni ruleset je u `/var/ossec/ruleset/`, tvoja pravila i dekoderi u `/var/ossec/etc/`; prije restarta `wazuh-analysisd -t`.
- Nivoi su 0–15; prag upisa je 3, nivo 0 utišava; ugrađena pravila ne mijenjaj nego ih proširi djecom u `local_rules.xml`.
- `alerts.json` je JSON po liniji sa `rule`, `agent`, `data`, `full_log`, `location`; `agent.id` 000 je manager.
- FIM: pravila 554 (dodat), 550 (izmijenjen), 553 (obrisan); `realtime`, `whodata`, `report_changes`, `nodiff` za tajne.
- SCA provjerava konfiguraciju po YAML politikama (CIS); 19011 javlja pad iz passed u failed. Vulnerability detection treba syscollector, CTI feed i indexer.
