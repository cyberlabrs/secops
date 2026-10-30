# Lab 1: Dekoder, pravila i active response za kurs-api

Aplikacija `kurs-api` loguje događaje prijave i promjene uloga preko sysloga u `/var/log/kurs-api.log`, a Wazuh taj fajl već čita. Ugrađeni ruleset ne razumije njen format, pa ćeš napisati dekoder, pravila sa korelacijom i automatsku blokadu IP adrese.

Format zapisa:

```text
2026-10-16T10:00:00.123456+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.50
2026-10-16T10:00:05.000000+00:00 lab kurs-api: event=login_ok user=ana src_ip=10.0.5.20
2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=owner
```

Događaje pravi `logger -p local3.info -t kurs-api "<poruka>"`, a pravila testiraš sa `/var/ossec/bin/wazuh-logtest`.

<!-- setup
set -e
printf 'local3.*    /var/log/kurs-api.log\n& stop\n' > /etc/rsyslog.d/30-kurs-api.conf
python3 - <<'EOF'
p = "/var/ossec/etc/ossec.conf"; s = open(p).read()
if "/var/log/kurs-api.log" not in s:
    i = s.rindex("</ossec_config>")
    s = s[:i] + "  <localfile>\n    <log_format>syslog</log_format>\n    <location>/var/log/kurs-api.log</location>\n  </localfile>\n" + s[i:]
    open(p, "w").write(s)
EOF
touch /var/log/kurs-api.log
wazuh-start >/dev/null
-->

## Dekoder

U `/var/ossec/etc/decoders/local_decoder.xml` napiši:

1. roditeljski dekoder `kurs-api` koji prepoznaje `program_name` `kurs-api`,
2. dječji dekoder (roditelj `kurs-api`) koji iz poruke izvlači polja `action` (vrijednost `event`), `dstuser` (`user`) i `srcip` (`src_ip`),
3. drugi dječji dekoder koji za `role_changed` dodatno izvlači `target` i `role` (vlastita imena polja).

Restartuj Wazuh i provjeri `wazuh-logtest`om da faza 2 prikazuje polja.

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
L1="2026-10-16T10:00:00.000000+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.50"
L2="2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=owner"
o=$(echo "$L1" | /var/ossec/bin/wazuh-logtest 2>&1)
echo "$o" | grep -q "name: 'kurs-api'" || { echo "dekoder kurs-api ne prepoznaje zapis (restartuj Wazuh nakon izmjene)"; exit 1; }
echo "$o" | grep -q "action: 'login_failed'" || { echo "polje action nije izvučeno"; exit 1; }
echo "$o" | grep -q "dstuser: 'ana'" || { echo "polje dstuser nije izvučeno"; exit 1; }
echo "$o" | grep -q "srcip: '192.0.2.50'" || { echo "polje srcip nije izvučeno"; exit 1; }
o=$(echo "$L2" | /var/ossec/bin/wazuh-logtest 2>&1)
echo "$o" | grep -q "target: 'ana'" && echo "$o" | grep -q "role: 'owner'" || { echo "za role_changed nisu izvučena polja target i role"; exit 1; }
echo "$o" | grep -q "srcip: '10.0.5.20'" || { echo "za role_changed nije izvučen srcip"; exit 1; }
-->
<!-- hint
```xml
<decoder name="kurs-api">
  <program_name>^kurs-api$</program_name>
</decoder>

<decoder name="kurs-api-uloga">
  <parent>kurs-api</parent>
  <prematch>event=role_changed </prematch>
  <regex>event=(role_changed) user=(\S+) src_ip=(\S+) target=(\S+) role=(\S+)</regex>
  <order>action, dstuser, srcip, target, role</order>
</decoder>

<decoder name="kurs-api-polja">
  <parent>kurs-api</parent>
  <regex>event=(\S+) user=(\S+) src_ip=(\S+)</regex>
  <order>action, dstuser, srcip</order>
</decoder>
```
Specifičniji dječji dekoder stavi prije opštijeg i daj mu `<prematch>`: bez njega Wazuh uzme prvo dijete i na njemu stane, pa opštiji dekoder nikad ne dođe na red. Wazuh regex (OS_Regex) ima ograničen skup izraza: `\S+`, `\d+`, `\w+`.
-->
<!-- solution
cat > /var/ossec/etc/decoders/local_decoder.xml <<'EOF'
<decoder name="kurs-api">
  <program_name>^kurs-api$</program_name>
</decoder>

<decoder name="kurs-api-uloga">
  <parent>kurs-api</parent>
  <prematch>event=role_changed </prematch>
  <regex>event=(role_changed) user=(\S+) src_ip=(\S+) target=(\S+) role=(\S+)</regex>
  <order>action, dstuser, srcip, target, role</order>
</decoder>

<decoder name="kurs-api-polja">
  <parent>kurs-api</parent>
  <regex>event=(\S+) user=(\S+) src_ip=(\S+)</regex>
  <order>action, dstuser, srcip</order>
</decoder>
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
-->

## Pravila i korelacija

U `/var/ossec/etc/rules/local_rules.xml` (grupa `kurs-api,`) napiši:

| ID | Nivo | Kada | MITRE |
|---|---|---|---|
| 100100 | 0 | bilo koji zapis dekodiran kao `kurs-api` | |
| 100101 | 5 | `action` je `login_failed` | T1110 |
| 100102 | 10 | 5 puta 100101 u 60 sekundi sa iste `srcip` | T1110 |
| 100103 | 12 | `role_changed` na ulogu `owner` | T1098 |

Restartuj Wazuh i provjeri pravila u `wazuh-logtest` (unesi isti `login_failed` red pet puta u istoj sesiji).

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
F="2026-10-16T10:00:00.000000+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.50"
OK="2026-10-16T10:00:05.000000+00:00 lab kurs-api: event=login_ok user=ana src_ip=10.0.5.20"
R="2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=owner"
R2="2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=viewer"
lt() { /var/ossec/bin/wazuh-logtest 2>&1; }
id_of() { grep -oE "^\s*id: '[0-9]+'" | tail -1 | grep -oE '[0-9]+'; }
[ "$(echo "$F" | lt | id_of)" = "100101" ] || { echo "login_failed ne okida pravilo 100101"; exit 1; }
[ "$(echo "$OK" | lt | id_of)" = "100100" ] || { echo "login_ok treba da završi na pravilu 100100 (nivo 0)"; exit 1; }
[ "$(echo "$R" | lt | id_of)" = "100103" ] || { echo "role_changed na owner ne okida 100103"; exit 1; }
[ "$(echo "$R2" | lt | id_of)" = "100100" ] || { echo "role_changed na drugu ulogu ne smije okinuti 100103"; exit 1; }
[ "$(printf '%s\n' "$F" "$F" "$F" "$F" "$F" | lt | id_of)" = "100102" ] || { echo "pet login_failed sa iste IP ne okida 100102"; exit 1; }
F2="2026-10-16T10:00:00.000000+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.5"
[ "$(printf '%s\n' "$F2" "$F" "$F2" "$F" "$F2" | lt | id_of)" = "100102" ] && { echo "100102 se okida i kad neuspjesi dolaze sa različitih IP (same_srcip?)"; exit 1; }
x=$(sed -n '/id="100101"/,/<\/rule>/p' /var/ossec/etc/rules/local_rules.xml)
echo "$x" | grep -q 'T1110' || { echo "100101 nema MITRE T1110"; exit 1; }
sed -n '/id="100103"/,/<\/rule>/p' /var/ossec/etc/rules/local_rules.xml | grep -q 'T1098' || { echo "100103 nema MITRE T1098"; exit 1; }
sed -n '/id="100102"/,/<\/rule>/p' /var/ossec/etc/rules/local_rules.xml | grep -q 'level="10"' || { echo "100102 treba level 10"; exit 1; }
-->
<!-- hint
```xml
<group name="kurs-api,">
  <rule id="100100" level="0">
    <decoded_as>kurs-api</decoded_as>
    <description>kurs-api: događaj</description>
  </rule>

  <rule id="100101" level="5">
    <if_sid>100100</if_sid>
    <action>login_failed</action>
    <description>kurs-api: neuspjela prijava za $(dstuser) sa $(srcip)</description>
    <mitre><id>T1110</id></mitre>
  </rule>

  <rule id="100102" level="10" frequency="5" timeframe="60">
    <if_matched_sid>100101</if_matched_sid>
    <same_srcip />
    <description>kurs-api: više neuspjelih prijava sa $(srcip)</description>
    <mitre><id>T1110</id></mitre>
  </rule>
</group>
```
Za `role` (vlastito polje) koristi `<field name="role">^owner$</field>`.
-->
<!-- solution
cat > /var/ossec/etc/rules/local_rules.xml <<'EOF'
<group name="kurs-api,">
  <rule id="100100" level="0">
    <decoded_as>kurs-api</decoded_as>
    <description>kurs-api: događaj</description>
  </rule>

  <rule id="100101" level="5">
    <if_sid>100100</if_sid>
    <action>login_failed</action>
    <description>kurs-api: neuspjela prijava za $(dstuser) sa $(srcip)</description>
    <mitre>
      <id>T1110</id>
    </mitre>
  </rule>

  <rule id="100102" level="10" frequency="5" timeframe="60">
    <if_matched_sid>100101</if_matched_sid>
    <same_srcip />
    <description>kurs-api: više neuspjelih prijava sa $(srcip)</description>
    <mitre>
      <id>T1110</id>
    </mitre>
  </rule>

  <rule id="100103" level="12">
    <if_sid>100100</if_sid>
    <action>role_changed</action>
    <field name="role">^owner$</field>
    <description>kurs-api: $(dstuser) dodijelio ulogu owner korisniku $(target)</description>
    <mitre>
      <id>T1098</id>
    </mitre>
  </rule>
</group>
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
-->

## Automatska blokada (active response)

Kad se okine 100102, Wazuh treba da blokira izvornu IP adresu skriptom `firewall-drop` (iptables) na **10 minuta**. U `ossec.conf` dodaj `<active-response>` blok:

- `command`: `firewall-drop` (komanda je već definisana u `ossec.conf`),
- `location`: `local`,
- `rules_id`: `100102`,
- `timeout`: `600`.

Restartuj Wazuh i provjeri slanjem šest `login_failed` događaja sa adrese `192.0.2.50`:

```bash
for i in 1 2 3 4 5 6; do logger -p local3.info -t kurs-api "event=login_failed user=ana src_ip=192.0.2.50"; done
sleep 3; iptables -S | grep 192.0.2.50
tail /var/ossec/logs/active-responses.log
```

> Active response na pogrešnom pravilu može zaključati legitimne korisnike ili tebe. Zato uvijek `timeout`, uzak skup pravila i lista adresa koje se nikad ne blokiraju (`<white_list>` u `<global>`).

<!-- verify
python3 - > /tmp/ar.txt <<'EOF'
import re
s = open("/var/ossec/etc/ossec.conf").read()
for b in re.findall(r"<active-response>.*?</active-response>", s, re.S):
    if "<command>firewall-drop</command>" in b and "<rules_id>100102</rules_id>" in b:
        print(b)
EOF
grep -q '<rules_id>100102</rules_id>' /tmp/ar.txt || { echo "nema active-response bloka za firewall-drop sa rules_id 100102"; exit 1; }
grep -q '<location>local</location>' /tmp/ar.txt || { echo "active-response treba location local"; exit 1; }
grep -q '<timeout>600</timeout>' /tmp/ar.txt || { echo "active-response treba timeout 600"; exit 1; }
ip=192.0.2.$((100 + RANDOM % 100))
for i in 1 2 3 4 5 6; do logger -p local3.info -t kurs-api "event=login_failed user=provjera src_ip=$ip"; done
for i in $(seq 40); do iptables -S 2>/dev/null | grep -q -- "-s $ip/32 -j DROP" && break; sleep 0.25; done
iptables -S | grep -q -- "-s $ip/32 -j DROP" || { echo "IP $ip nije blokirana nakon 6 neuspjelih prijava (restart Wazuha, pravilo 100102?)"; exit 1; }
iptables -D INPUT -s $ip/32 -j DROP 2>/dev/null; iptables -D FORWARD -s $ip/32 -j DROP 2>/dev/null
for i in 1 2; do logger -p local3.info -t kurs-api "event=login_failed user=provjera src_ip=192.0.2.9"; done
sleep 2; iptables -S | grep -q -- '-s 192.0.2.9/32' && { echo "blokada se dešava i nakon samo 2 neuspjeha"; exit 1; }
exit 0
-->
<!-- hint
```xml
<active-response>
  <command>firewall-drop</command>
  <location>local</location>
  <rules_id>100102</rules_id>
  <timeout>600</timeout>
</active-response>
```
Ako blokade nema, pogledaj `/var/ossec/logs/active-responses.log` i `/var/ossec/logs/ossec.log`.
-->
<!-- solution
python3 - <<'EOF'
p = "/var/ossec/etc/ossec.conf"; s = open(p).read()
i = s.rindex("</ossec_config>")
s = s[:i] + "  <active-response>\n    <command>firewall-drop</command>\n    <location>local</location>\n    <rules_id>100102</rules_id>\n    <timeout>600</timeout>\n  </active-response>\n" + s[i:]
open(p, "w").write(s)
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
-->
