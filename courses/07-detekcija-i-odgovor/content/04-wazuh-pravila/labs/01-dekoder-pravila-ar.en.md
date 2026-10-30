# Lab 1: Decoder, rules and active response for kurs-api

The `kurs-api` application logs login and role change events over syslog to `/var/log/kurs-api.log`, and Wazuh already reads that file. The built-in ruleset does not understand its format, so you will write a decoder, rules with correlation and automatic IP address blocking.

Record format:

```text
2026-10-16T10:00:00.123456+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.50
2026-10-16T10:00:05.000000+00:00 lab kurs-api: event=login_ok user=ana src_ip=10.0.5.20
2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=owner
```

Events are generated with `logger -p local3.info -t kurs-api "<message>"`, and you test rules with `/var/ossec/bin/wazuh-logtest`.

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

## Decoder

In `/var/ossec/etc/decoders/local_decoder.xml`, write:

1. a parent decoder `kurs-api` that recognizes the `program_name` `kurs-api`,
2. a child decoder (parent `kurs-api`) that extracts the fields `action` (the value of `event`), `dstuser` (`user`) and `srcip` (`src_ip`) from the message,
3. a second child decoder that, for `role_changed`, additionally extracts `target` and `role` (custom field names).

Restart Wazuh and use `wazuh-logtest` to check that phase 2 shows the fields.

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
L1="2026-10-16T10:00:00.000000+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.50"
L2="2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=owner"
o=$(echo "$L1" | /var/ossec/bin/wazuh-logtest 2>&1)
echo "$o" | grep -q "name: 'kurs-api'" || { echo "the kurs-api decoder does not recognize the record (restart Wazuh after the change)"; exit 1; }
echo "$o" | grep -q "action: 'login_failed'" || { echo "the action field was not extracted"; exit 1; }
echo "$o" | grep -q "dstuser: 'ana'" || { echo "the dstuser field was not extracted"; exit 1; }
echo "$o" | grep -q "srcip: '192.0.2.50'" || { echo "the srcip field was not extracted"; exit 1; }
o=$(echo "$L2" | /var/ossec/bin/wazuh-logtest 2>&1)
echo "$o" | grep -q "target: 'ana'" && echo "$o" | grep -q "role: 'owner'" || { echo "the target and role fields were not extracted for role_changed"; exit 1; }
echo "$o" | grep -q "srcip: '10.0.5.20'" || { echo "srcip was not extracted for role_changed"; exit 1; }
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
Put the more specific child decoder before the more general one and give it a `<prematch>`: without it, Wazuh takes the first child and stops there, so the more general decoder never gets its turn. Wazuh regex (OS_Regex) has a limited set of expressions: `\S+`, `\d+`, `\w+`.
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

## Rules and correlation

In `/var/ossec/etc/rules/local_rules.xml` (group `kurs-api,`), write:

| ID | Level | When | MITRE |
|---|---|---|---|
| 100100 | 0 | any record decoded as `kurs-api` | |
| 100101 | 5 | `action` is `login_failed` | T1110 |
| 100102 | 10 | 100101 five times within 60 seconds from the same `srcip` | T1110 |
| 100103 | 12 | `role_changed` to the `owner` role | T1098 |

Restart Wazuh and check the rules in `wazuh-logtest` (enter the same `login_failed` line five times in the same session).

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
F="2026-10-16T10:00:00.000000+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.50"
OK="2026-10-16T10:00:05.000000+00:00 lab kurs-api: event=login_ok user=ana src_ip=10.0.5.20"
R="2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=owner"
R2="2026-10-16T10:01:00.000000+00:00 lab kurs-api: event=role_changed user=marko src_ip=10.0.5.20 target=ana role=viewer"
lt() { /var/ossec/bin/wazuh-logtest 2>&1; }
id_of() { grep -oE "^\s*id: '[0-9]+'" | tail -1 | grep -oE '[0-9]+'; }
[ "$(echo "$F" | lt | id_of)" = "100101" ] || { echo "login_failed does not trigger rule 100101"; exit 1; }
[ "$(echo "$OK" | lt | id_of)" = "100100" ] || { echo "login_ok should end up on rule 100100 (level 0)"; exit 1; }
[ "$(echo "$R" | lt | id_of)" = "100103" ] || { echo "role_changed to owner does not trigger 100103"; exit 1; }
[ "$(echo "$R2" | lt | id_of)" = "100100" ] || { echo "role_changed to another role must not trigger 100103"; exit 1; }
[ "$(printf '%s\n' "$F" "$F" "$F" "$F" "$F" | lt | id_of)" = "100102" ] || { echo "five login_failed from the same IP do not trigger 100102"; exit 1; }
F2="2026-10-16T10:00:00.000000+00:00 lab kurs-api: event=login_failed user=ana src_ip=192.0.2.5"
[ "$(printf '%s\n' "$F2" "$F" "$F2" "$F" "$F2" | lt | id_of)" = "100102" ] && { echo "100102 also fires when the failures come from different IPs (same_srcip?)"; exit 1; }
x=$(sed -n '/id="100101"/,/<\/rule>/p' /var/ossec/etc/rules/local_rules.xml)
echo "$x" | grep -q 'T1110' || { echo "100101 is missing MITRE T1110"; exit 1; }
sed -n '/id="100103"/,/<\/rule>/p' /var/ossec/etc/rules/local_rules.xml | grep -q 'T1098' || { echo "100103 is missing MITRE T1098"; exit 1; }
sed -n '/id="100102"/,/<\/rule>/p' /var/ossec/etc/rules/local_rules.xml | grep -q 'level="10"' || { echo "100102 needs level 10"; exit 1; }
-->
<!-- hint
```xml
<group name="kurs-api,">
  <rule id="100100" level="0">
    <decoded_as>kurs-api</decoded_as>
    <description>kurs-api: event</description>
  </rule>

  <rule id="100101" level="5">
    <if_sid>100100</if_sid>
    <action>login_failed</action>
    <description>kurs-api: failed login for $(dstuser) from $(srcip)</description>
    <mitre><id>T1110</id></mitre>
  </rule>

  <rule id="100102" level="10" frequency="5" timeframe="60">
    <if_matched_sid>100101</if_matched_sid>
    <same_srcip />
    <description>kurs-api: multiple failed logins from $(srcip)</description>
    <mitre><id>T1110</id></mitre>
  </rule>
</group>
```
For `role` (a custom field), use `<field name="role">^owner$</field>`.
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

## Automatic blocking (active response)

When 100102 fires, Wazuh should block the source IP address with the `firewall-drop` script (iptables) for **10 minutes**. Add an `<active-response>` block to `ossec.conf`:

- `command`: `firewall-drop` (the command is already defined in `ossec.conf`),
- `location`: `local`,
- `rules_id`: `100102`,
- `timeout`: `600`.

Restart Wazuh and test it by sending six `login_failed` events from the address `192.0.2.50`:

```bash
for i in 1 2 3 4 5 6; do logger -p local3.info -t kurs-api "event=login_failed user=ana src_ip=192.0.2.50"; done
sleep 3; iptables -S | grep 192.0.2.50
tail /var/ossec/logs/active-responses.log
```

> Active response on the wrong rule can lock out legitimate users, or you. So always use a `timeout`, a narrow set of rules and a list of addresses that are never blocked (`<white_list>` in `<global>`).

<!-- verify
python3 - > /tmp/ar.txt <<'EOF'
import re
s = open("/var/ossec/etc/ossec.conf").read()
for b in re.findall(r"<active-response>.*?</active-response>", s, re.S):
    if "<command>firewall-drop</command>" in b and "<rules_id>100102</rules_id>" in b:
        print(b)
EOF
grep -q '<rules_id>100102</rules_id>' /tmp/ar.txt || { echo "no active-response block for firewall-drop with rules_id 100102"; exit 1; }
grep -q '<location>local</location>' /tmp/ar.txt || { echo "active-response needs location local"; exit 1; }
grep -q '<timeout>600</timeout>' /tmp/ar.txt || { echo "active-response needs timeout 600"; exit 1; }
ip=192.0.2.$((100 + RANDOM % 100))
for i in 1 2 3 4 5 6; do logger -p local3.info -t kurs-api "event=login_failed user=provjera src_ip=$ip"; done
for i in $(seq 40); do iptables -S 2>/dev/null | grep -q -- "-s $ip/32 -j DROP" && break; sleep 0.25; done
iptables -S | grep -q -- "-s $ip/32 -j DROP" || { echo "IP $ip was not blocked after 6 failed logins (Wazuh restart, rule 100102?)"; exit 1; }
iptables -D INPUT -s $ip/32 -j DROP 2>/dev/null; iptables -D FORWARD -s $ip/32 -j DROP 2>/dev/null
for i in 1 2; do logger -p local3.info -t kurs-api "event=login_failed user=provjera src_ip=192.0.2.9"; done
sleep 2; iptables -S | grep -q -- '-s 192.0.2.9/32' && { echo "blocking also happens after only 2 failures"; exit 1; }
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
If there is no block, check `/var/ossec/logs/active-responses.log` and `/var/ossec/logs/ossec.log`.
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
