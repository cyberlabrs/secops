## What this module covers

The module covers two objectives from domain 2:

- **2.2** Wazuh decoders and rules: custom decoders, correlation (`frequency`, `if_matched_sid`), testing with `wazuh-logtest`.
- **2.4** Active response: automated containment and its risks.

The architecture (manager, analysisd, `alerts.json`, levels) is covered in module 03. Here we write our own logic: how Wazuh gets from a raw log line to an alert, how to extend that for an application the built-in ruleset does not know, how to tie several events together into one more serious alert, and how to respond automatically (carefully).

In the lab you work on a Wazuh 4.14 manager without the indexer and dashboard:

| Path | What it is |
|---|---|
| `/var/ossec/etc/decoders/local_decoder.xml` | your decoders |
| `/var/ossec/etc/rules/local_rules.xml` | your rules |
| `/var/ossec/ruleset/` | built-in decoders and rules (do not modify, an upgrade overwrites them) |
| `/var/ossec/etc/ossec.conf` | configuration, including active response |
| `/var/ossec/logs/alerts/alerts.json` | alerts, one JSON object per line |
| `/var/ossec/logs/active-responses.log` | what active response did |
| `/var/ossec/bin/wazuh-logtest` | testing decoders and rules |

## The path of one event through analysisd

Every log line goes through three phases. You see the same phases in the `wazuh-logtest` output, so they are worth knowing by heart:

1. **Pre-decoding.** For the syslog format, Wazuh extracts the header: `timestamp`, `hostname`, `program_name`. The rest of the line is the message.
2. **Decoding.** Wazuh looks for a matching **decoder** (by `program_name` or `prematch`), and its `regex` extracts the fields: `srcip`, `srcuser`, `dstuser` and custom fields.
3. **Filtering (rules).** Rules are evaluated as a tree. A rule without a parent (e.g. one with `<decoded_as>`) is a root; children are evaluated only if the parent matched (`<if_sid>`, `<if_group>`). The deepest matching rule wins. If its level is above the threshold (3 by default), an alert is generated.

An example line from `/var/log/auth.log` in the lab:

```text
Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2
```

Pre-decoding yields `program_name: sshd`. The `sshd` decoder from `0310-ssh_decoders.xml` is the parent, and a child extracts `srcuser: deploy` and `srcip: 203.0.113.50`. Rule 5700 (`<decoded_as>sshd</decoded_as>`, level 0) is the root of all sshd rules, and its child 5710 (`invalid user`, level 5) is the result.

> **In practice:** before writing your own rule, always run the line through `wazuh-logtest` and see what the built-in ruleset already does. Often there is a level 0 rule that just needs to be "raised", or a child that needs to be added, rather than a new decoder from scratch.

## wazuh-logtest

`wazuh-logtest` is a sandbox inside `wazuh-analysisd`: it sends the line to the currently loaded rules and writes nothing to `alerts.json`. That is why the manager must be running, and changes to `local_rules.xml` and `local_decoder.xml` become visible only after you restart the manager.

```bash
# interactive: paste a line, Enter, read the three phases; Ctrl+D to exit
/var/ossec/bin/wazuh-logtest

# a single line from a script
echo 'Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2' \
  | /var/ossec/bin/wazuh-logtest -q

# -v: also show rules that were tried but did not match (most useful for "why doesn't it work")
/var/ossec/bin/wazuh-logtest -v
```

Abridged output for the line above:

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

(The exact fields depend on the ruleset version; the `groups` lists and compliance fields are abridged here.)

### Testing in a script: the -U option

The `-U rule:level:decoder` option returns exit code 0 only if the result matches. This is the foundation for detection regression tests in CI:

```bash
L='Oct 16 09:14:02 lab sshd[1412]: Failed password for invalid user deploy from 203.0.113.50 port 51122 ssh2'
echo "$L" | /var/ossec/bin/wazuh-logtest -q -U '5710:5:sshd' && echo OK || echo FAIL
```

What each outcome means:

| Phase 2 | Phase 3 | Diagnosis |
|---|---|---|
| no `name` | – | no decoder recognizes the line: check `program_name` / `prematch` |
| `name` present, no fields | – | the decoder fires, but the `regex` does not capture: check the regex and `offset` |
| fields present | level 0 or wrong ID | the rule does not match or another rule "swallows" it; run `-v` |
| fields present | expected ID, but nothing in `alerts.json` | the manager was not restarted or the level is below `log_alert_level` |

### Correlation and logtest

`wazuh-logtest` keeps state per session (you see the session token at the start). If you paste the same line several times in the same interactive session, `firedtimes` increases and you will see when a rule with `frequency` fires. A new session means clean state.

## A custom decoder

The built-in ruleset knows sshd, sudo, PAM, web servers and hundreds of other sources. Your internal application is not among them. Suppose the internal service `kurs-api` logs over syslog like this:

```text
Oct 16 10:02:11 lab kurs-api[812]: login failed user=ana src=198.51.100.23 reason=bad_password
Oct 16 10:02:40 lab kurs-api[812]: login ok user=ana src=198.51.100.23 mfa=totp
Oct 16 10:05:03 lab kurs-api[812]: admin action=export_users user=ana src=198.51.100.23 rows=5120
```

Decoders are written in pairs: the parent recognizes the source, and the children extract fields from individual message types.

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

Key elements:

| Element | Role |
|---|---|
| `<program_name>` | matches the program name from the syslog header (`osmatch` by default, supports `^` and `$`) |
| `<parent>` | the child is tried only if the parent matched; a child cannot be a parent |
| `<prematch>` | a fast filter before the regex; for syslog it looks at the text after the header |
| `<regex>` + `<order>` | parenthesized groups become fields, in the order given in `<order>` |
| `offset` | `after_parent`, `after_prematch` or `after_regex`: where the regex starts |
| `type="pcre2"` | on `<regex>`, `<prematch>` and `<program_name>` for PCRE2 instead of OS_Regex |

Fields in `<order>` come in two kinds. **Static** fields have a fixed meaning and dedicated tags in rules: `srcip`, `dstip`, `srcport`, `dstport`, `srcuser`, `dstuser` (`user` is an alias for `dstuser`), `protocol`, `action`, `id`, `url`, `data`, `extra_data`, `status`, `system_name`. Everything else (`result`, `rows`) is a **dynamic** field and is checked in a rule with `<field name="...">`. In `alerts.json` they all end up under `data.*`.

A note on regex: the default **OS_Regex** is limited (`\w`, `\d`, `\s`, `\S`, `\p`, `.`; no `{n,m}` and no `[a-z]` classes). For anything more complex use `type="pcre2"`:

```xml
<regex type="pcre2" offset="after_prematch">^(\w+) user=([a-z0-9._-]+) src=([0-9.]+)</regex>
```

For JSON logs, do not write a regex: there is `<plugin_decoder>JSON_Decoder</plugin_decoder>`, and the built-in `json` decoder already catches lines that start with `{`. Keys become dynamic fields (`data.objectRef.resource` and the like).

Checking the decoder:

```bash
systemctl restart wazuh-manager || /var/ossec/bin/wazuh-control restart
echo 'Oct 16 10:02:11 lab kurs-api[812]: login failed user=ana src=198.51.100.23 reason=bad_password' \
  | /var/ossec/bin/wazuh-logtest -q
```

In phase 2 you expect `name: 'kurs-api'`, `result: 'failed'`, `srcuser: 'ana'`, `srcip: '198.51.100.23'`. The decoder name remains the parent's name; if you want the child's name to show, add `<use_own_name>true</use_own_name>` to the child.

> **In practice:** the best decoder is the one you do not have to write. If you control the application, make it log JSON with stable field names (ideally following ECS or OCSF). Regex decoders break at the first change to the message format, and that is usually discovered only after the detection has been silent for months.

## Custom rules

Rules go into `/var/ossec/etc/rules/local_rules.xml` (or a new file in the same directory), with IDs in the **100000–120000** range to avoid collisions with built-in rules.

```xml
<!-- /var/ossec/etc/rules/local_rules.xml -->
<group name="local,kurs_api,">

  <!-- root: everything decoded by kurs-api, no alert -->
  <rule id="100100" level="0">
    <decoded_as>kurs-api</decoded_as>
    <description>kurs-api: grouped messages</description>
  </rule>

  <rule id="100101" level="5">
    <if_sid>100100</if_sid>
    <field name="result">^failed$</field>
    <description>kurs-api: failed login for $(srcuser) from $(srcip)</description>
    <mitre>
      <id>T1110.001</id>
    </mitre>
    <group>authentication_failed,</group>
  </rule>

  <rule id="100102" level="3">
    <if_sid>100100</if_sid>
    <field name="result">^ok$</field>
    <description>kurs-api: successful login for $(srcuser)</description>
    <group>authentication_success,</group>
  </rule>

  <rule id="100103" level="8">
    <if_sid>100100</if_sid>
    <field name="action">^export_users$</field>
    <description>kurs-api: user export ($(rows) rows) by $(srcuser)</description>
    <mitre>
      <id>T1530</id>
    </mitre>
  </rule>

</group>
```

The most important tags and attributes:

| Tag / attribute | Meaning |
|---|---|
| `level` | 0–16; 0 means "do not generate an alert" (used for grouping and suppression) |
| `<if_sid>` | parent rule (one or more IDs) |
| `<if_group>` | the parent is any rule from the group |
| `<decoded_as>` | decoder name |
| `<match>` | searches for text in the message; `osmatch` by default, alternation with `|` |
| `<regex>` | the same, but OS_Regex (or `type="pcre2"`) |
| `<field name="x">` | checks a dynamic field; multiple `<field>` tags are combined with AND |
| `<srcip>`, `<user>`, `<program_name>`… | check static fields; `<srcip>` also accepts CIDR |
| `negate="yes"` | negation on most matching tags |
| `<list>` | lookup in a CDB list (e.g. a list of known IP addresses) |
| `<mitre><id>` | ATT&CK technique; appears in the alert as `rule.mitre.*` |
| `<group>` | additional groups, with a trailing comma |
| `<options>no_full_log</options>` | do not write `full_log` to the alert (e.g. when the message carries sensitive data) |

The description can use `$(field)` so the analyst immediately sees who and from where.

### Changing a built-in rule: overwrite

Do not modify the built-in files. Copy the rule into `local_rules.xml` and add `overwrite="yes"`:

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

With overwrite, `if_sid`, `if_group`, `if_level`, `if_matched_sid` and `if_matched_group` cannot be changed (they are ignored), so the rule's position in the tree stays the same. Copy the whole rule, including the groups, because you are replacing the rule, not "patching" it.

### Suppressing false positives

Instead of touching the parent, add a narrower level 0 child:

```xml
<!-- the internal vulnerability scanner tries non-existent users every night -->
<rule id="100110" level="0">
  <if_sid>5710</if_sid>
  <srcip>10.20.0.15</srcip>
  <description>sshd: invalid user from internal scanner (suppressed, TICKET-412)</description>
</rule>
```

For a list of addresses, use a **CDB list** instead of dozens of rules:

```bash
cat > /var/ossec/etc/lists/skeneri <<'EOF'
10.20.0.15:
10.20.0.16:
EOF
chown wazuh:wazuh /var/ossec/etc/lists/skeneri
```

```xml
<!-- ossec.conf, inside <ruleset> -->
<list>etc/lists/skeneri</list>

<!-- local_rules.xml -->
<rule id="100111" level="0">
  <if_sid>5710</if_sid>
  <list field="srcip" lookup="address_match_key">etc/lists/skeneri</list>
  <description>sshd: invalid user from a known scanner (list)</description>
</rule>
```

> **In practice:** every suppression must have a reason and an owner (a ticket in the description, a comment in the XML) and a review date. A level 0 rule is invisible: if an attacker takes over the internal scanner, this exception gives them free passage. Suppress as narrowly as possible (a specific IP and a specific rule, not the whole `sshd` group).

## Correlation

A single failed login is noise. Twenty per minute from the same address is brute force, and a success after that is an incident. Wazuh expresses this with the `frequency` and `timeframe` attributes and the `if_matched_*` and `same_*` tags.

### frequency + if_matched_sid

```xml
<rule id="100120" level="10" frequency="6" timeframe="120" ignore="60">
  <if_matched_sid>100101</if_matched_sid>
  <same_srcip />
  <description>kurs-api: brute force, multiple failed logins from $(srcip)</description>
  <mitre>
    <id>T1110</id>
  </mitre>
  <group>authentication_failures,</group>
</rule>
```

Read it like this: "fire when rule 100101 matches `frequency` times within `timeframe` seconds, from the same source address". `ignore="60"` means the same rule will not fire again for the next 60 seconds, which prevents an alert flood during an attack. Built-in rules work the same way: 5763 (`if_matched_sid` 5760, `frequency="8"`, `timeframe="120"`) and 5712 (`if_matched_sid` 5710).

Rules being counted (`if_matched_sid`) must have a level of at least 1: level 0 alerts are discarded immediately and cannot be counted. If you do not want the base rule to be visible, use `<options>no_log</options>`, not level 0.

Variants:

| Tag | Condition |
|---|---|
| `<same_srcip />` | same source IP (the built-in ruleset uses the older name `<same_source_ip />`) |
| `<same_user />`, `<same_srcuser />` | same user |
| `<different_srcip />` | different addresses (e.g. the same user from many addresses: password spraying in reverse) |
| `<same_field>name</same_field>` | same dynamic field |
| `<if_matched_group>` | counts alerts from a whole group, not a single rule |
| `<global_frequency />` | counts events from all agents, not just one |

### A sequence: failures, then success

The most valuable alert is "a successful login from an address that was just guessing passwords". Built-in rule 40112 does exactly that for all sources, through groups. For `kurs-api`:

```xml
<rule id="100121" level="12" timeframe="300">
  <if_sid>100102</if_sid>
  <if_matched_sid>100120</if_matched_sid>
  <same_srcip />
  <description>kurs-api: successful login by $(srcuser) from $(srcip) after brute force</description>
  <mitre>
    <id>T1110</id>
    <id>T1078</id>
  </mitre>
  <group>authentication_success,brute_force_success,</group>
</rule>
```

The rule is evaluated when a successful login arrives (child 100102), and it fires only if 100120 occurred from the same address within the last 300 seconds.

Since 100120 carries the `authentication_failures` group and 100102 the `authentication_success` group, the built-in 40112 may also fire on the same event. Use `wazuh-logtest -v` to check which rule wins. A custom rule makes sense when you want a different window, level or an application-specific description.

`logger -p auth.info` matters: in the lab, Wazuh reads only `/var/log/auth.log`, and rsyslog writes only the `auth`/`authpriv` facility there.

Test in a single `wazuh-logtest` session: paste the failed line six times (watch `firedtimes` increase and when phase 3 shows 100120), then the successful one. The same through the real pipeline:

```bash
for i in $(seq 1 8); do
  logger -p auth.info -t 'kurs-api[812]' "login failed user=ana src=198.51.100.23 reason=bad_password"
done
logger -p auth.info -t 'kurs-api[812]' "login ok user=ana src=198.51.100.23 mfa=none"

jq -c 'select(.rule.id|test("^1001")) | {t:.timestamp, id:.rule.id, lvl:.rule.level, d:.rule.description}' \
  /var/ossec/logs/alerts/alerts.json | tail
```

> **In practice:** the numbers in `frequency`/`timeframe` are a decision, not a constant. Set them from data: how many failed logins per IP per minute does a normal day have (`jq` over `alerts.json` or `awk` over `auth.log`)? A threshold just above normal produces noise; a threshold ten times higher misses slow attacks. Slow attacks (one attempt per minute) are better caught with longer windows in a SIEM query than with correlation in Wazuh anyway.

### Side by side: the same in Sentinel and Splunk

The same brute force in KQL (Sentinel, `Syslog` table), briefly:

```kusto
Syslog
| where ProcessName == "sshd" and SyslogMessage has "Failed password"
| extend SrcIp = extract(@"from (\d+\.\d+\.\d+\.\d+)", 1, SyslogMessage)
| summarize Fails = count() by SrcIp, bin(TimeGenerated, 2m)
| where Fails >= 8
```

And in SPL: `index=linux sourcetype=linux_secure "Failed password" | bin _time span=2m | stats count by _time src | where count>=8`. The difference: Wazuh correlates in the stream (stateful, immediately), while SIEM queries run over stored data at scheduled intervals.

## Active response

**Active response** (AR) is the execution of a script when a rule fires: blocking an IP, disabling an account, sending a message. It consists of two blocks in the manager's `ossec.conf`.

`<command>` defines the script (built-in ones already exist in the default configuration):

```xml
<command>
  <name>firewall-drop</name>
  <executable>firewall-drop</executable>
  <timeout_allowed>yes</timeout_allowed>
</command>
```

`<active-response>` says when and where:

```xml
<active-response>
  <disabled>no</disabled>
  <command>firewall-drop</command>
  <location>local</location>
  <rules_id>100120,5763</rules_id>
  <timeout>600</timeout>
</active-response>
```

| Option | Meaning |
|---|---|
| `location` | `local` (the agent that generated the event), `server` (the manager), `defined-agent` + `agent_id`, `all` (all agents; careful) |
| `rules_id` | a list of rule IDs |
| `rules_group` | groups, separated by `|`, with a trailing comma (`sshd,`) to avoid partial matches |
| `level` | minimum rule level |
| `timeout` | seconds after which the action is reverted (`delete`); requires `timeout_allowed` |
| `repeated_offenders` | on the agent: increasing timeouts in minutes for repeat offenders, e.g. `1,5,10` |

`level`, `rules_id` and `rules_group` are cumulative: any of them triggers the response. So `<level>7</level>` in a block with `firewall-drop` means "block the IP for every alert of level 7+", which is almost always a mistake.

Built-in Linux scripts in `/var/ossec/active-response/bin/`: `firewall-drop` (iptables), `firewalld-drop`, `host-deny` (`/etc/hosts.deny`), `route-null`, `disable-account`, `restart-wazuh`, `wazuh-slack`, `ip-customblock`.

In the lab, the manager is also the host that reads `auth.log`, so `local` means "on the lab host" (the container has `NET_ADMIN`, so iptables works):

```bash
systemctl restart wazuh-manager || /var/ossec/bin/wazuh-control restart
# trigger 5763 from a documentation address (8+ "Failed password" from the same IP)
for i in $(seq 1 10); do
  logger -p auth.info -t 'sshd[2001]' "Failed password for root from 203.0.113.77 port 4$i ssh2"
done
sleep 5
tail -n 5 /var/ossec/logs/active-responses.log
iptables -S INPUT | grep 203.0.113.77
```

### How the script receives data

The script receives one JSON object on stdin: `command` is `add` or `delete` (revert after the `timeout` expires), and `parameters.alert` is the whole alert, so the script reads e.g. `parameters.alert.data.srcip`.

```json
{"version":1,"origin":{"name":"lab","module":"wazuh-execd"},"command":"add",
 "parameters":{"extra_args":[],"alert":{"rule":{"id":"5763","level":10},"data":{"srcip":"203.0.113.77"}},
 "program":"/var/ossec/active-response/bin/firewall-drop"}}
```

**Stateful** scripts (those with a `timeout`) send a `check_keys` message with a key (e.g. the IP address) to stdout before acting, and wait for a `continue` or `abort` response (if the same action is already active). Every message must end with a newline, otherwise the script and execd wait for each other. Custom scripts go into the same directory with `root:wazuh` ownership and `750` permissions.

### Risks of automated containment

| Risk | Example | Mitigation |
|---|---|---|
| Self-blocking | brute force from the office NAT address or from the bastion blocks all admins | `<white_list>` in `<global>` (127.0.0.1 is already there in the default config), a CDB exception list |
| Source spoofing | an attacker injects a line into the log (e.g. via the username) with the IP of the DNS server | AR only on rules that trust the field (`srcip` from the sshd decoder), never on user-supplied text |
| DoS by design | `disable-account` on brute force: the attacker locks out all accounts | AR only on high-confidence rules; for accounts, prefer an alert and a manual decision |
| No cleanup | a block without a `timeout` stays forever and nobody remembers why | always a `timeout`, `repeated_offenders` for repeat offenders |
| False sense of security | the IP is blocked, but the attacker is already in | AR is containment, not investigation: the alert still goes to an analyst |
| Correctness | `location` `all` blocks the address on all servers, including those that legitimately need it | start with `local`, test in the lab |

```xml
<global>
  <white_list>127.0.0.1</white_list>
  <white_list>10.20.0.0/24</white_list>  <!-- bastion and internal scanners -->
</global>
```

> **In practice:** roll out AR in three steps. First the rule without AR for two weeks, measuring false positives. Then AR that only notifies (`wazuh-slack` or a custom script that logs "I would have blocked X"). Only then real blocking, with a `timeout` and a whitelist. Blocking IP addresses is a weak control against modern attacks (botnets, cloud addresses), but a good one against noisy scanners.

## Common mistakes

| Symptom | Cause |
|---|---|
| the manager does not start after a change | XML error (unclosed tag, `&` instead of `&amp;`); check `/var/ossec/logs/ossec.log` |
| logtest shows old behavior | the manager was not restarted |
| a child rule never fires | `if_sid` points to a rule that "loses" to another child of the same parent; run `-v` |
| a `frequency` rule does not work | the base rule is level 0, or `same_srcip` is used but the decoder does not extract `srcip` |
| duplicate ID | ID outside 100000–120000 or the same ID in two files |
| `rule.mitre.technique` is empty in the alert | the ID is not in Wazuh's ATT&CK database (e.g. a new ID from ATT&CK v19+); see module 05 |

## Summary

- An event goes through pre-decoding, decoding (parent decoder + children, `regex` + `order`) and filtering (the rule tree via `if_sid`/`if_group`; the deepest match wins).
- Custom decoders go in `local_decoder.xml`, rules in `local_rules.xml` with IDs 100000–120000; static fields have their own tags, dynamic ones are checked with `<field>`.
- Change built-in rules with a copy using `overwrite="yes"`; suppress false positives with a narrow level 0 child or a CDB list, with a reason and an owner.
- Correlation: `frequency` + `timeframe` + `if_matched_sid`/`if_matched_group` + `same_*`; the base rule must be level ≥ 1; `ignore` reduces alert floods.
- `wazuh-logtest` tests the currently loaded rules without writing alerts; `-v` explains why something does not match, `-U id:level:decoder` provides an exit code for CI.
- Active response: `<command>` + `<active-response>` (`location`, `rules_id`/`rules_group`/`level`, `timeout`); scripts receive the alert as JSON on stdin, stateful scripts use `check_keys`.
- Automated containment is risky: whitelist, `timeout`, high-confidence rules only, gradual rollout, and the alert always goes to a human as well.
