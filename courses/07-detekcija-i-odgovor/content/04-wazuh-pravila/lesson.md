## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 2:

- **2.2** Wazuh dekoderi i pravila: vlastiti dekoderi, korelacija (`frequency`, `if_matched_sid`), testiranje sa `wazuh-logtest`.
- **2.4** Active response: automatsko obuzdavanje i njegovi rizici.

Arhitektura (manager, analysisd, `alerts.json`, nivoi) je u modulu 03. Ovdje pišemo vlastitu logiku: kako Wazuh od sirove linije loga dođe do alarma, kako to proširiti za aplikaciju koju ugrađeni ruleset ne poznaje, kako povezati više događaja u jedan ozbiljniji alarm i kako (oprezno) automatski reagovati.

U labu radiš na Wazuh manageru 4.14 bez indexera i dashboarda:

| Putanja | Šta je |
|---|---|
| `/var/ossec/etc/decoders/local_decoder.xml` | tvoji dekoderi |
| `/var/ossec/etc/rules/local_rules.xml` | tvoja pravila |
| `/var/ossec/ruleset/` | ugrađeni dekoderi i pravila (ne mijenjaj, upgrade ih pregazi) |
| `/var/ossec/etc/ossec.conf` | konfiguracija, uključujući active response |
| `/var/ossec/logs/alerts/alerts.json` | alarmi, jedan JSON po liniji |
| `/var/ossec/logs/active-responses.log` | šta je active response uradio |
| `/var/ossec/bin/wazuh-logtest` | testiranje dekodera i pravila |

## Put jednog događaja kroz analysisd

Svaka linija loga prolazi kroz tri faze. Iste faze vidiš u izlazu `wazuh-logtest`, pa ih vrijedi znati napamet:

1. **Pre-decoding.** Za syslog format Wazuh izvlači zaglavlje: `timestamp`, `hostname`, `program_name`. Ostatak linije je poruka.
2. **Decoding.** Traži se **dekoder** (decoder) koji odgovara (po `program_name` ili `prematch`), pa njegov `regex` izvlači polja: `srcip`, `srcuser`, `dstuser` i vlastita polja.
3. **Filtering (rules).** Pravila se provjeravaju kao stablo. Pravilo bez roditelja (npr. ono sa `<decoded_as>`) je korijen; djeca se provjeravaju samo ako se roditelj poklopio (`<if_sid>`, `<if_group>`). Pobjeđuje najdublje pravilo koje se poklopi. Ako je njegov nivo veći od praga (podrazumijevano 3), nastaje alarm.

Primjer linije iz `/var/log/auth.log` u labu:

```text
Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2
```

Pre-decoding daje `program_name: sshd`. Dekoder `sshd` iz `0310-ssh_decoders.xml` je roditelj, a dijete izvlači `srcuser: deploy` i `srcip: 203.0.113.50`. Pravilo 5700 (`<decoded_as>sshd</decoded_as>`, nivo 0) je korijen svih sshd pravila, a dijete 5710 (`invalid user`, nivo 5) je rezultat.

> **U praksi:** prije pisanja vlastitog pravila uvijek pusti liniju kroz `wazuh-logtest` i pogledaj šta ugrađeni ruleset već radi. Često postoji pravilo nivoa 0 koje samo treba „podići“ ili dijete koje treba dopisati, a ne novi dekoder od nule.

## wazuh-logtest

`wazuh-logtest` je sandbox unutar `wazuh-analysisd`: šalje liniju pravilima koja su trenutno učitana i ništa ne upisuje u `alerts.json`. Zato manager mora raditi, a izmjene u `local_rules.xml` i `local_decoder.xml` postaju vidljive tek kad restartuješ manager.

```bash
# interaktivno: lijepi liniju, Enter, čitaj tri faze; Ctrl+D za izlaz
/var/ossec/bin/wazuh-logtest

# jedna linija iz skripte
echo 'Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2' \
  | /var/ossec/bin/wazuh-logtest -q

# -v: prikaži i pravila koja su probana a nisu se poklopila (najkorisnije kod "zašto ne radi")
/var/ossec/bin/wazuh-logtest -v
```

Skraćen izlaz za liniju iznad:

```text
**Phase 1: Completed pre-decoding.
	full event: 'Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2'
	timestamp: 'Oct 16 09:14:02'
	hostname: 'lab'
	program_name: 'sshd'

**Phase 2: Completed decoding.
	name: 'sshd'
	parent: 'sshd'
	srcip: '203.0.113.50'
	srcuser: 'deploy'

**Phase 3: Completed filtering (rules).
	id: '5710'
	level: '5'
	description: 'sshd: Attempt to login using a non-existent user'
	groups: '["syslog","sshd","authentication_failed","invalid_login"]'
	firedtimes: '1'
	mitre.id: '["T1110.001","T1021.004"]'
**Alert to be generated.
```

(Tačna polja zavise od verzije rulesetа; liste `groups` i compliance polja su ovdje skraćene.)

### Testiranje u skripti: opcija -U

Opcija `-U pravilo:nivo:dekoder` vraća izlazni kod 0 samo ako rezultat odgovara. To je osnova za regresione testove detekcija u CI-ju:

```bash
L='Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2'
echo "$L" | /var/ossec/bin/wazuh-logtest -q -U '5710:5:sshd' && echo OK || echo FAIL
```

Šta znači svaki ishod:

| Phase 2 | Phase 3 | Dijagnoza |
|---|---|---|
| nema `name` | – | nijedan dekoder ne prepoznaje liniju: provjeri `program_name` / `prematch` |
| `name` ima, polja nema | – | dekoder se aktivira, ali `regex` ne hvata: provjeri regex i `offset` |
| polja ima | nivo 0 ili pogrešan ID | pravilo se ne poklapa ili ga „pojede“ drugo pravilo; pokreni `-v` |
| polja ima | očekivani ID, a u `alerts.json` ništa | manager nije restartovan ili je nivo ispod `log_alert_level` |

### Korelacija i logtest

`wazuh-logtest` drži stanje po sesiji (token sesije vidiš na početku). Ako u istoj interaktivnoj sesiji zalijepiš istu liniju više puta, `firedtimes` raste i vidjećeš kad se aktivira pravilo sa `frequency`. Nova sesija znači čisto stanje.

## Vlastiti dekoder

Ugrađeni ruleset zna sshd, sudo, PAM, web servere i stotine drugih izvora. Tvoja interna aplikacija nije među njima. Neka interni servis `kurs-api` loguje preko sysloga ovako:

```text
Oct 16 10:02:11 lab kurs-api[812]: login failed user=ana src=198.51.100.23 reason=bad_password
Oct 16 10:02:40 lab kurs-api[812]: login ok user=ana src=198.51.100.23 mfa=totp
Oct 16 10:05:03 lab kurs-api[812]: admin action=export_users user=ana src=198.51.100.23 rows=5120
```

Dekoderi se pišu kao par: roditelj prepoznaje izvor, djeca izvlače polja iz pojedinih vrsta poruka.

```xml
<!-- /var/ossec/etc/decoders/local_decoder.xml -->
<decoder name="kurs-api">
  <program_name>^kurs-api$</program_name>
</decoder>

<decoder name="kurs-api-login">
  <parent>kurs-api</parent>
  <prematch>^login </prematch>
  <regex offset="after_prematch">^(\w+) user=(\S+) src=(\S+)</regex>
  <order>result, srcuser, srcip</order>
</decoder>

<decoder name="kurs-api-admin">
  <parent>kurs-api</parent>
  <prematch>^admin </prematch>
  <regex offset="after_prematch">^action=(\S+) user=(\S+) src=(\S+) rows=(\d+)</regex>
  <order>action, srcuser, srcip, rows</order>
</decoder>
```

Ključni elementi:

| Element | Uloga |
|---|---|
| `<program_name>` | poklapa ime programa iz syslog zaglavlja (podrazumijevano `osmatch`, podržava `^` i `$`) |
| `<parent>` | dijete se probava samo ako se roditelj poklopio; dijete ne može biti roditelj |
| `<prematch>` | brzi filter prije regexa; za syslog gleda tekst poslije zaglavlja |
| `<regex>` + `<order>` | grupe u zagradama postaju polja, redom iz `<order>` |
| `offset` | `after_parent`, `after_prematch` ili `after_regex`: odakle regex počinje |
| `type="pcre2"` | na `<regex>`, `<prematch>` i `<program_name>` za PCRE2 umjesto OS_Regex |

Polja u `<order>` su dvije vrste. **Statička** imaju fiksno značenje i posebne tagove u pravilima: `srcip`, `dstip`, `srcport`, `dstport`, `srcuser`, `dstuser` (`user` je alias za `dstuser`), `protocol`, `action`, `id`, `url`, `data`, `extra_data`, `status`, `system_name`. Sve ostalo (`result`, `rows`) je **dinamičko** polje i u pravilu se provjerava sa `<field name="...">`. U `alerts.json` sva završe pod `data.*`.

Napomena o regexu: podrazumijevani **OS_Regex** je ograničen (`\w`, `\d`, `\s`, `\S`, `\p`, `.`; nema `{n,m}` ni klasa `[a-z]`). Za bilo šta složenije koristi `type="pcre2"`:

```xml
<regex type="pcre2" offset="after_prematch">^(\w+) user=([a-z0-9._-]+) src=([0-9.]+)</regex>
```

Za JSON logove ne piši regex: postoji `<plugin_decoder>JSON_Decoder</plugin_decoder>`, a ugrađeni `json` dekoder ionako hvata linije koje počinju sa `{`. Ključevi postaju dinamička polja (`data.objectRef.resource` i slično).

Provjera dekodera:

```bash
systemctl restart wazuh-manager || /var/ossec/bin/wazuh-control restart
echo 'Oct 16 10:02:11 lab kurs-api[812]: login failed user=ana src=198.51.100.23 reason=bad_password' \
  | /var/ossec/bin/wazuh-logtest -q
```

Očekuješ u fazi 2 `name: 'kurs-api'`, `result: 'failed'`, `srcuser: 'ana'`, `srcip: '198.51.100.23'`. Ime dekodera ostaje ime roditelja; ako želiš da se vidi ime djeteta, dodaj `<use_own_name>true</use_own_name>` u dijete.

> **U praksi:** najbolji dekoder je onaj koji ne moraš pisati. Ako kontrolišeš aplikaciju, natjeraj je da loguje JSON sa stabilnim imenima polja (idealno po ECS-u ili OCSF-u). Regex dekoderi pucaju na prvu izmjenu formata poruke, a to se obično otkrije tek kad detekcija mjesecima šuti.

## Vlastita pravila

Pravila idu u `/var/ossec/etc/rules/local_rules.xml` (ili novi fajl u istom direktoriju), sa ID-jevima **100000–120000** da ne bi bilo sudara sa ugrađenim pravilima.

```xml
<!-- /var/ossec/etc/rules/local_rules.xml -->
<group name="local,kurs_api,">

  <!-- korijen: sve što je dekodirao kurs-api, bez alarma -->
  <rule id="100100" level="0">
    <decoded_as>kurs-api</decoded_as>
    <description>kurs-api: grupisane poruke</description>
  </rule>

  <rule id="100101" level="5">
    <if_sid>100100</if_sid>
    <field name="result">^failed$</field>
    <description>kurs-api: neuspjela prijava za $(srcuser) sa $(srcip)</description>
    <mitre>
      <id>T1110.001</id>
    </mitre>
    <group>authentication_failed,</group>
  </rule>

  <rule id="100102" level="3">
    <if_sid>100100</if_sid>
    <field name="result">^ok$</field>
    <description>kurs-api: uspješna prijava za $(srcuser)</description>
    <group>authentication_success,</group>
  </rule>

  <rule id="100103" level="8">
    <if_sid>100100</if_sid>
    <field name="action">^export_users$</field>
    <description>kurs-api: izvoz korisnika ($(rows) redova) od $(srcuser)</description>
    <mitre>
      <id>T1530</id>
    </mitre>
  </rule>

</group>
```

Najvažniji tagovi i atributi:

| Tag / atribut | Značenje |
|---|---|
| `level` | 0–16; 0 znači „ne pravi alarm“ (koristi se za grupisanje i utišavanje) |
| `<if_sid>` | roditeljsko pravilo (jedan ili više ID-jeva) |
| `<if_group>` | roditelj je bilo koje pravilo iz grupe |
| `<decoded_as>` | ime dekodera |
| `<match>` | traži tekst u poruci; podrazumijevano `osmatch`, alternacija sa `|` |
| `<regex>` | isto, ali OS_Regex (ili `type="pcre2"`) |
| `<field name="x">` | provjera dinamičkog polja; više `<field>` tagova se veže sa AND |
| `<srcip>`, `<user>`, `<program_name>`… | provjera statičkih polja; `<srcip>` prima i CIDR |
| `negate="yes"` | negacija na većini tagova za poklapanje |
| `<list>` | lookup u CDB listi (npr. lista poznatih IP adresa) |
| `<mitre><id>` | ATT&CK tehnika; u alarmu se pojavljuje kao `rule.mitre.*` |
| `<group>` | dodatne grupe, sa zarezom na kraju |
| `<options>no_full_log</options>` | ne upisuj `full_log` u alarm (npr. kad poruka nosi osjetljive podatke) |

Opis može koristiti `$(polje)` pa analitičar odmah vidi ko i odakle.

### Mijenjanje ugrađenog pravila: overwrite

Ugrađene fajlove ne mijenjaj. Kopiraj pravilo u `local_rules.xml` i dodaj `overwrite="yes"`:

```xml
<group name="syslog,sshd,">
  <rule id="5710" level="7" overwrite="yes">
    <if_sid>5700</if_sid>
    <match>illegal user|invalid user</match>
    <description>sshd: Attempt to login using a non-existent user</description>
    <mitre>
      <id>T1110.001</id>
      <id>T1021.004</id>
    </mitre>
    <group>authentication_failed,invalid_login,</group>
  </rule>
</group>
```

Kod overwrite-a se `if_sid`, `if_group`, `if_level`, `if_matched_sid` i `if_matched_group` ne mogu mijenjati (ignorišu se), pa pozicija pravila u stablu ostaje ista. Kopiraj cijelo pravilo, uključujući grupe, jer pravilo zamjenjuješ, a ne „krpiš“.

### Utišavanje lažnih pozitiva

Umjesto da diraš roditelja, dodaj dijete nivoa 0 koje je uže:

```xml
<!-- interni skener ranjivosti svake noći proba nepostojeće korisnike -->
<rule id="100110" level="0">
  <if_sid>5710</if_sid>
  <srcip>10.20.0.15</srcip>
  <description>sshd: invalid user sa internog skenera (utišano, TICKET-412)</description>
</rule>
```

Za listu adresa koristi **CDB listu** umjesto desetina pravila:

```bash
cat > /var/ossec/etc/lists/skeneri <<'EOF'
10.20.0.15:
10.20.0.16:
EOF
chown wazuh:wazuh /var/ossec/etc/lists/skeneri
```

```xml
<!-- ossec.conf, unutar <ruleset> -->
<list>etc/lists/skeneri</list>

<!-- local_rules.xml -->
<rule id="100111" level="0">
  <if_sid>5710</if_sid>
  <list field="srcip" lookup="address_match_key">etc/lists/skeneri</list>
  <description>sshd: invalid user sa poznatog skenera (lista)</description>
</rule>
```

> **U praksi:** svako utišavanje mora imati razlog i vlasnika (ticket u opisu, komentar u XML-u) i datum revizije. Pravilo nivoa 0 je nevidljivo: ako napadač preuzme interni skener, ova izuzetka mu daje slobodan prolaz. Utišaj što uže (konkretan IP i konkretno pravilo, ne cijelu grupu `sshd`).

## Korelacija

Pojedinačni neuspjeli login je šum. Dvadeset u minuti sa iste adrese je brute force, a uspjeh poslije toga je incident. Wazuh to izražava atributima `frequency` i `timeframe` i tagovima `if_matched_*` i `same_*`.

### frequency + if_matched_sid

```xml
<rule id="100120" level="10" frequency="6" timeframe="120" ignore="60">
  <if_matched_sid>100101</if_matched_sid>
  <same_srcip />
  <description>kurs-api: brute force, više neuspjelih prijava sa $(srcip)</description>
  <mitre>
    <id>T1110</id>
  </mitre>
  <group>authentication_failures,</group>
</rule>
```

Čitaj ovako: „aktiviraj se kad se pravilo 100101 poklopi `frequency` puta u `timeframe` sekundi, sa iste izvorne adrese“. `ignore="60"` znači da se isto pravilo ne aktivira ponovo narednih 60 sekundi, što sprečava poplavu alarma tokom napada. Ugrađena pravila rade isto: 5763 (`if_matched_sid` 5760, `frequency="8"`, `timeframe="120"`) i 5712 (`if_matched_sid` 5710).

Pravila kojima se broji (`if_matched_sid`) moraju imati nivo bar 1: alarmi nivoa 0 se odbacuju odmah i ne mogu se brojati. Ako ne želiš da se bazno pravilo vidi, koristi `<options>no_log</options>`, a ne nivo 0.

Varijante:

| Tag | Uslov |
|---|---|
| `<same_srcip />` | isti izvorni IP (ugrađeni ruleset koristi stariji naziv `<same_source_ip />`) |
| `<same_user />`, `<same_srcuser />` | isti korisnik |
| `<different_srcip />` | različite adrese (npr. isti korisnik sa mnogo adresa: password spraying obrnuto) |
| `<same_field>ime</same_field>` | isto dinamičko polje |
| `<if_matched_group>` | broji alarme iz cijele grupe, ne jednog pravila |
| `<global_frequency />` | broji događaje sa svih agenata, ne samo jednog |

### Sekvenca: neuspjesi pa uspjeh

Najvrjedniji alarm je „uspješna prijava sa adrese koja je maloprije pogađala lozinke“. Ugrađeno pravilo 40112 radi tačno to za sve izvore, preko grupa. Za `kurs-api`:

```xml
<rule id="100121" level="12" timeframe="300">
  <if_sid>100102</if_sid>
  <if_matched_sid>100120</if_matched_sid>
  <same_srcip />
  <description>kurs-api: uspješna prijava $(srcuser) sa $(srcip) nakon brute forcea</description>
  <mitre>
    <id>T1110</id>
    <id>T1078</id>
  </mitre>
  <group>authentication_success,brute_force_success,</group>
</rule>
```

Pravilo se provjerava kad stigne uspješan login (dijete 100102), a aktivira se samo ako je u zadnjih 300 sekundi bilo 100120 sa iste adrese.

Pošto 100120 nosi grupu `authentication_failures`, a 100102 grupu `authentication_success`, i ugrađeno 40112 može da se aktivira nad istim događajem. Sa `wazuh-logtest -v` provjeri koje pravilo pobjeđuje. Vlastito pravilo ima smisla kad želiš drugi prozor, nivo ili opis specifičan za aplikaciju.

`logger -p auth.info` je bitan: u labu Wazuh čita samo `/var/log/auth.log`, a rsyslog tamo upisuje samo facility `auth`/`authpriv`.

Test u jednoj `wazuh-logtest` sesiji: zalijepi neuspjelu liniju šest puta (gledaj kako `firedtimes` raste i kad faza 3 pokaže 100120), pa uspješnu. Isto preko pravog toka:

```bash
for i in $(seq 1 8); do
  logger -p auth.info -t 'kurs-api[812]' "login failed user=ana src=198.51.100.23 reason=bad_password"
done
logger -p auth.info -t 'kurs-api[812]' "login ok user=ana src=198.51.100.23 mfa=none"

jq -c 'select(.rule.id|test("^1001")) | {t:.timestamp, id:.rule.id, lvl:.rule.level, d:.rule.description}' \
  /var/ossec/logs/alerts/alerts.json | tail
```

> **U praksi:** brojevi u `frequency`/`timeframe` su odluka, ne konstanta. Postavi ih iz podataka: koliko neuspjelih prijava po IP-u po minuti ima normalan dan (`jq` nad `alerts.json` ili `awk` nad `auth.log`)? Prag tik iznad normalnog daje šum, prag deset puta veći propušta spore napade. Spori napadi (jedan pokušaj u minuti) se ionako bolje hvataju dužim prozorima u SIEM upitu nego korelacijom u Wazuhu.

### Uporedno: isto u Sentinelu i Splunku

Isti brute force u KQL-u (Sentinel, tabela `Syslog`), kratko:

```kusto
Syslog
| where ProcessName == "sshd" and SyslogMessage has "Failed password"
| extend SrcIp = extract(@"from (\d+\.\d+\.\d+\.\d+)", 1, SyslogMessage)
| summarize Fails = count() by SrcIp, bin(TimeGenerated, 2m)
| where Fails >= 8
```

I u SPL-u: `index=linux sourcetype=linux_secure "Failed password" | bin _time span=2m | stats count by _time src | where count>=8`. Razlika: Wazuh korelira u toku (stateful, odmah), SIEM upiti rade nad pohranjenim podacima u zakazanim intervalima.

## Active response

**Active response** (AR) je izvršavanje skripte kad se aktivira pravilo: blokiranje IP-a, onemogućavanje naloga, slanje poruke. Sastoji se od dva bloka u `ossec.conf` managera.

`<command>` definiše skriptu (ugrađeni već postoje u podrazumijevanoj konfiguraciji):

```xml
<command>
  <name>firewall-drop</name>
  <executable>firewall-drop</executable>
  <timeout_allowed>yes</timeout_allowed>
</command>
```

`<active-response>` kaže kada i gdje:

```xml
<active-response>
  <disabled>no</disabled>
  <command>firewall-drop</command>
  <location>local</location>
  <rules_id>100120,5763</rules_id>
  <timeout>600</timeout>
</active-response>
```

| Opcija | Značenje |
|---|---|
| `location` | `local` (agent koji je generisao događaj), `server` (manager), `defined-agent` + `agent_id`, `all` (svi agenti; oprezno) |
| `rules_id` | lista ID-jeva pravila |
| `rules_group` | grupe, odvojene sa `|`, sa zarezom na kraju (`sshd,`) da ne bi bilo djelimičnog poklapanja |
| `level` | minimalni nivo pravila |
| `timeout` | sekunde poslije kojih se akcija poništava (`delete`); traži `timeout_allowed` |
| `repeated_offenders` | na agentu: rastući timeouti u minutama za ponovne prekršioce, npr. `1,5,10` |

`level`, `rules_id` i `rules_group` su kumulativni: bilo koji od njih aktivira odgovor. Zato `<level>7</level>` u bloku sa `firewall-drop` znači „blokiraj IP za svaki alarm nivoa 7+“, što je gotovo uvijek greška.

Ugrađene Linux skripte u `/var/ossec/active-response/bin/`: `firewall-drop` (iptables), `firewalld-drop`, `host-deny` (`/etc/hosts.deny`), `route-null`, `disable-account`, `restart-wazuh`, `wazuh-slack`, `ip-customblock`.

U labu je manager ujedno i host koji čita `auth.log`, pa `local` znači „na labu“ (kontejner ima `NET_ADMIN`, pa iptables radi):

```bash
systemctl restart wazuh-manager || /var/ossec/bin/wazuh-control restart
# izazovi 5763 sa dokumentacione adrese (8+ "Failed password" sa iste IP)
for i in $(seq 1 10); do
  logger -p auth.info -t 'sshd[2001]' "Failed password for root from 203.0.113.77 port 4$i ssh2"
done
sleep 5
tail -n 5 /var/ossec/logs/active-responses.log
iptables -S INPUT | grep 203.0.113.77
```

### Kako skripta dobija podatke

Skripta dobija jedan JSON na stdin: `command` je `add` ili `delete` (poništavanje po isteku `timeout`), a `parameters.alert` je cijeli alarm, pa skripta čita npr. `parameters.alert.data.srcip`.

```json
{"version":1,"origin":{"name":"lab","module":"wazuh-execd"},"command":"add",
 "parameters":{"extra_args":[],"alert":{"rule":{"id":"5763","level":10},"data":{"srcip":"203.0.113.77"}},
 "program":"/var/ossec/active-response/bin/firewall-drop"}}
```

**Stateful** skripte (one sa `timeout`) prije akcije šalju na stdout poruku `check_keys` sa ključem (npr. IP adresom) i čekaju odgovor `continue` ili `abort` (ako je ista akcija već aktivna). Svaka poruka mora završiti novim redom, inače skripta i execd čekaju jedno drugo. Vlastite skripte idu u isti direktorij sa vlasništvom `root:wazuh` i pravima `750`.

### Rizici automatskog obuzdavanja

| Rizik | Primjer | Ublažavanje |
|---|---|---|
| Samoblokiranje | brute force sa NAT adrese kancelarije ili sa bastiona blokira sve admine | `<white_list>` u `<global>` (u podrazumijevanom configu je već 127.0.0.1), CDB lista izuzetaka |
| Lažiranje izvora | napadač ubaci liniju u log (npr. preko korisničkog imena) sa IP-om DNS servera | AR samo na pravila koja vjeruju polju (`srcip` iz sshd dekodera), nikad na korisnički tekst |
| DoS po dizajnu | `disable-account` na brute force: napadač zaključa sve naloge | AR samo na visoko pouzdana pravila; za naloge radije alarm i ručna odluka |
| Neporavnanje | blok bez `timeout` ostaje zauvijek i niko se ne sjeća zašto | uvijek `timeout`, `repeated_offenders` za ponavljače |
| Lažni osjećaj sigurnosti | blokiran IP, ali napadač je već ušao | AR je obuzdavanje, ne istraga: alarm i dalje ide analitičaru |
| Ispravnost | `location` `all` blokira adresu na svim serverima, uključujući one koji je legitimno trebaju | počni sa `local`, testiraj u labu |

```xml
<global>
  <white_list>127.0.0.1</white_list>
  <white_list>10.20.0.0/24</white_list>  <!-- bastion i interni skeneri -->
</global>
```

> **U praksi:** uvedi AR u tri koraka. Prvo pravilo bez AR-a dvije sedmice i mjeri lažne pozitive. Zatim AR koji samo obavještava (`wazuh-slack` ili vlastita skripta koja loguje „blokirao bih X“). Tek onda pravo blokiranje, sa `timeout` i whitelistom. Blokiranje IP adresa je slaba kontrola protiv modernih napada (botnetovi, cloud adrese), ali dobra protiv bučnih skenera.

## Tipične greške

| Simptom | Uzrok |
|---|---|
| manager se ne pokreće poslije izmjene | XML greška (nezatvoren tag, `&` umjesto `&amp;`); pogledaj `/var/ossec/logs/ossec.log` |
| logtest pokazuje staro ponašanje | manager nije restartovan |
| dijete pravilo se nikad ne aktivira | `if_sid` pokazuje na pravilo koje „gubi“ od drugog djeteta istog roditelja; pokreni `-v` |
| `frequency` pravilo ne radi | bazno pravilo je nivo 0 ili `same_srcip` a dekoder ne izvlači `srcip` |
| duplikat ID-a | ID van 100000–120000 ili isti ID u dva fajla |
| `rule.mitre.technique` je prazan u alarmu | ID nije u Wazuhovoj ATT&CK bazi (npr. novi ID iz ATT&CK v19+); vidi modul 05 |

## Rezime

- Događaj prolazi pre-decoding, decoding (dekoder roditelj + djeca, `regex` + `order`) i filtering (stablo pravila preko `if_sid`/`if_group`; pobjeđuje najdublje poklapanje).
- Vlastiti dekoderi u `local_decoder.xml`, pravila u `local_rules.xml` sa ID-jevima 100000–120000; statička polja imaju vlastite tagove, dinamička se provjeravaju sa `<field>`.
- Ugrađena pravila mijenjaj kopijom sa `overwrite="yes"`; lažne pozitive utišavaj uskim djetetom nivoa 0 ili CDB listom, uz razlog i vlasnika.
- Korelacija: `frequency` + `timeframe` + `if_matched_sid`/`if_matched_group` + `same_*`; bazno pravilo mora biti nivo ≥ 1; `ignore` smanjuje poplavu alarma.
- `wazuh-logtest` testira trenutno učitana pravila bez pisanja alarma; `-v` objašnjava zašto se nešto ne poklapa, `-U id:nivo:dekoder` daje izlazni kod za CI.
- Active response: `<command>` + `<active-response>` (`location`, `rules_id`/`rules_group`/`level`, `timeout`); skripte dobijaju alarm kao JSON na stdin, stateful skripte koriste `check_keys`.
- Automatsko obuzdavanje je rizično: whitelist, `timeout`, samo visoko pouzdana pravila, postepeno uvođenje, i alarm uvijek ide i čovjeku.
