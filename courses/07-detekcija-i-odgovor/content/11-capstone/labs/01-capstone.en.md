# Capstone: detection for the new kurs-pay service

The `kurs-pay` payment service goes to production in two weeks, and the audit requires that by then it has detection for refund abuse and a response plan. You are the detection engineer: from the raw log to the runbook, all in this lab.

Log format (syslog, facility `local4`, tag `kurs-pay`):

```text
… kurs-pay: event=refund user=operater1 order=A-1001 amount=120
… kurs-pay: event=refund user=operater2 order=A-1002 amount=2500
… kurs-pay: event=payout_account_changed user=operater1 account=RS35...
```

The same events are also sent as JSON (fields `action`, `user`, `order`, `amount`) to the central SIEM, for which you write Sigma rules. Some names in this lab are in Serbian and must be used exactly as given: `operater` = operator, `testovi` = tests, `pozitivni`/`negativni` = positive/negative, `veliki povrat` = large refund, `sumnjivi povrati` = suspicious refunds, `max_refund_bez_odobrenja` = max refund without approval, `odobravaoci` = approvers.

The tasks are checked through Wazuh (`wazuh-logtest`, alerts), Zircolite and file contents. Time: 120 minutes.

```bash
wazuh-start
ls /root/capstone
```

<!-- timer
120
-->

<!-- setup
set -e
mkdir -p /root/capstone/testovi /etc/kurs-pay /root/ir /root/dokazi /root/runbook
printf 'max_refund_bez_odobrenja = 1000\nodobravaoci = sef.smjene\n' > /etc/kurs-pay/limits.conf
cat > /root/capstone/testovi/pozitivni.jsonl <<'EOF'
{"ts":"2026-10-16T09:00:00Z","id":"p1","action":"refund","user":"operater2","order":"A-1002","amount":2500}
{"ts":"2026-10-16T09:10:00Z","id":"p2","action":"refund","user":"operater1","order":"A-1010","amount":1000}
EOF
cat > /root/capstone/testovi/negativni.jsonl <<'EOF'
{"ts":"2026-10-16T09:01:00Z","id":"n1","action":"refund","user":"operater1","order":"A-1001","amount":120}
{"ts":"2026-10-16T09:02:00Z","id":"n2","action":"payment","user":"kupac9","order":"A-1003","amount":4000}
{"ts":"2026-10-16T09:03:00Z","id":"n3","action":"refund","user":"operater3","order":"A-1004","amount":999}
EOF
wazuh-start >/dev/null
-->

## Task 1: The log reaches Wazuh

- rsyslog: `local4` messages go to `/var/log/kurs-pay.log` (and not to `/var/log/syslog`).
- Wazuh reads `/var/log/kurs-pay.log` (format `syslog`).
- A `kurs-pay` decoder (by `program_name`) and a child decoder with the fields `action` (`event`), `dstuser` (`user`), `order` and `amount`.

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null; sleep 0.5
m="cap$RANDOM"; logger -p local4.info -t kurs-pay "event=provjera user=$m order=X-1 amount=1"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-pay.log 2>/dev/null && break; sleep 0.2; done
grep -q "$m" /var/log/kurs-pay.log 2>/dev/null || { echo "local4 messages do not reach /var/log/kurs-pay.log"; exit 1; }
grep -q "$m" /var/log/syslog && { echo "local4 messages also end up in /var/log/syslog"; exit 1; }
grep -q '<location>/var/log/kurs-pay.log</location>' /var/ossec/etc/ossec.conf || { echo "Wazuh does not read /var/log/kurs-pay.log"; exit 1; }
grep -q "Analyzing file: '/var/log/kurs-pay.log'" /var/ossec/logs/ossec.log || { echo "logcollector is not monitoring /var/log/kurs-pay.log (restart?)"; exit 1; }
o=$(echo "2026-10-16T10:00:00.000000+00:00 lab kurs-pay: event=refund user=operater2 order=A-1002 amount=2500" | /var/ossec/bin/wazuh-logtest 2>&1)
for x in "name: 'kurs-pay'" "action: 'refund'" "dstuser: 'operater2'" "order: 'A-1002'" "amount: '2500'"; do
  echo "$o" | grep -q "$x" || { echo "decoding is incomplete: missing $x"; exit 1; }
done
-->
<!-- hint
The labs from module 1 (rsyslog) and module 4 (decoder). After changing `ossec.conf` or the decoder, restart Wazuh.
-->
<!-- solution
printf 'local4.*    /var/log/kurs-pay.log\n& stop\n' > /etc/rsyslog.d/31-kurs-pay.conf
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null; touch /var/log/kurs-pay.log
python3 - <<'EOF'
p = "/var/ossec/etc/ossec.conf"; s = open(p).read()
i = s.rindex("</ossec_config>")
s = s[:i] + "  <localfile>\n    <log_format>syslog</log_format>\n    <location>/var/log/kurs-pay.log</location>\n  </localfile>\n" + s[i:]
open(p, "w").write(s)
EOF
cat > /var/ossec/etc/decoders/local_decoder.xml <<'EOF'
<decoder name="kurs-pay">
  <program_name>^kurs-pay$</program_name>
</decoder>

<decoder name="kurs-pay-polja">
  <parent>kurs-pay</parent>
  <regex>event=(\S+) user=(\S+) order=(\S+) amount=(\d+)</regex>
  <order>action, dstuser, order, amount</order>
</decoder>
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
-->

## Task 2: Rules

| ID | Level | When | MITRE |
|---|---|---|---|
| 200100 | 0 | any `kurs-pay` event | |
| 200101 | 3 | `refund` | |
| 200102 | 10 | `refund` with an amount of **1000 or more** | T1565.001 |
| 200103 | 12 | 200101 three times within 120 seconds for the same user (`dstuser`) | T1565.001 |

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
ev() { echo "2026-10-16T10:00:00.000000+00:00 lab kurs-pay: event=$1 user=$2 order=$3 amount=$4"; }
id_of() { /var/ossec/bin/wazuh-logtest 2>&1 | grep -oE "^\s*id: '[0-9]+'" | tail -1 | grep -oE '[0-9]+'; }
[ "$(ev refund op1 A-1 120 | id_of)" = "200101" ] || { echo "refund 120 should match rule 200101"; exit 1; }
[ "$(ev refund op1 A-1 999 | id_of)" = "200101" ] || { echo "refund 999 should match rule 200101 (not 200102)"; exit 1; }
[ "$(ev refund op1 A-1 1000 | id_of)" = "200102" ] || { echo "refund 1000 should match rule 200102"; exit 1; }
[ "$(ev refund op1 A-1 25000 | id_of)" = "200102" ] || { echo "refund 25000 should match rule 200102"; exit 1; }
[ "$(ev payment kupac A-1 5000 | id_of)" = "200100" ] || { echo "payment must not trigger the refund rules"; exit 1; }
[ "$( { ev refund op7 A-1 10; ev refund op7 A-2 20; ev refund op7 A-3 30; } | id_of)" = "200103" ] || { echo "3 refunds by the same user do not trigger 200103"; exit 1; }
[ "$( { ev refund op8 A-1 10; ev refund op9 A-2 20; ev refund op8 A-3 30; } | id_of)" = "200103" ] && { echo "200103 also fires for different users"; exit 1; }
for r in 200102 200103; do sed -n "/id=\"$r\"/,/<\/rule>/p" /var/ossec/etc/rules/local_rules.xml | grep -q 'T1565.001' || { echo "$r has no MITRE T1565.001"; exit 1; }; done
exit 0
-->
<!-- hint
Compare the amount with a regex on the field: `<field name="amount">^\d\d\d\d+</field>` (four or more digits). For the same user in correlation: `<same_user />`.
-->
<!-- solution
cat > /var/ossec/etc/rules/local_rules.xml <<'EOF'
<group name="kurs-pay,">
  <rule id="200100" level="0">
    <decoded_as>kurs-pay</decoded_as>
    <description>kurs-pay: događaj</description>
  </rule>

  <rule id="200101" level="3">
    <if_sid>200100</if_sid>
    <action>refund</action>
    <description>kurs-pay: povrat $(amount) za nalog $(order) ($(dstuser))</description>
  </rule>

  <rule id="200102" level="10">
    <if_sid>200101</if_sid>
    <field name="amount">^\d\d\d\d+</field>
    <description>kurs-pay: veliki povrat $(amount) ($(dstuser))</description>
    <mitre>
      <id>T1565.001</id>
    </mitre>
  </rule>

  <rule id="200103" level="12" frequency="3" timeframe="120">
    <if_matched_sid>200101</if_matched_sid>
    <same_user />
    <description>kurs-pay: više povrata u kratkom roku ($(dstuser))</description>
    <mitre>
      <id>T1565.001</id>
    </mitre>
  </rule>
</group>
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
-->

## Task 3: Configuration integrity

A change to the limits in `/etc/kurs-pay/` (e.g., raising `max_refund_bez_odobrenja`) must immediately produce a FIM alert with the diff.

<!-- verify
grep -Eq '<directories[^>]*realtime="yes"[^>]*>[^<]*/etc/kurs-pay' /var/ossec/etc/ossec.conf && grep -Eq '<directories[^>]*report_changes="yes"[^>]*>[^<]*/etc/kurs-pay' /var/ossec/etc/ossec.conf || { echo "syscheck for /etc/kurs-pay needs realtime and report_changes"; exit 1; }
for i in $(seq 60); do grep -q "Real-time file integrity monitoring started" /var/ossec/logs/ossec.log && break; sleep 0.5; done
sleep 2; v="izmjena_$RANDOM"; echo "# $v" >> /etc/kurs-pay/limits.conf
for i in $(seq 60); do jq -e --arg v "$v" 'select(.syscheck.path == "/etc/kurs-pay/limits.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 && break; sleep 0.5; done
jq -e --arg v "$v" 'select(.syscheck.path == "/etc/kurs-pay/limits.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 || { echo "the change to limits.conf did not produce a FIM alert with a diff"; exit 1; }
-->
<!-- hint
The lab from module 3: `<directories realtime="yes" report_changes="yes">/etc/kurs-pay</directories>` in `<syscheck>`.
-->
<!-- solution
python3 - <<'EOF'
p = "/var/ossec/etc/ossec.conf"; s = open(p).read()
i = s.index("<syscheck>") + len("<syscheck>")
s = s[:i] + '\n    <directories realtime="yes" report_changes="yes">/etc/kurs-pay</directories>' + s[i:]
open(p, "w").write(s)
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
for i in $(seq 60); do grep -q "Real-time file integrity monitoring started" /var/ossec/logs/ossec.log && break; sleep 0.5; done
-->

## Task 4: Sigma rule for the SIEM

Write `/root/capstone/kurs_pay_veliki_povrat.yml`: a refund (`action: refund`) with an amount of 1000 or more (`amount|gte: 1000`), `logsource` `product: kurs` / `service: pay`, `level: high`, tag `attack.t1565.001`. `sigma check` with no errors or warnings; against `testovi/pozitivni.jsonl` Zircolite finds exactly `p1` and `p2`, against `negativni.jsonl` nothing. Also save the Splunk query to `/root/capstone/kurs_pay_veliki_povrat.spl`.

<!-- verify
f=/root/capstone/kurs_pay_veliki_povrat.yml
[ -f $f ] || { echo "$f is missing"; exit 1; }
sigma check $f > /tmp/sc.txt 2>&1; grep -q 'Found 0 errors, 0 condition errors and 0 issues' /tmp/sc.txt || { grep -iE 'issue|error' /tmp/sc.txt | head -5; echo "sigma check reports errors or warnings"; exit 1; }
yq '.tags[]' $f | grep -qx 'attack.t1565.001' || { echo "tag attack.t1565.001 is missing"; exit 1; }
cd /tmp
zircolite -e /root/capstone/testovi/pozitivni.jsonl -j -r $f -o /tmp/cp.json -q >/dev/null 2>&1
zircolite -e /root/capstone/testovi/negativni.jsonl -j -r $f -o /tmp/cn.json -q >/dev/null 2>&1
[ "$(jq -r '[.[].matches[]?.id] | sort | join(",")' /tmp/cp.json)" = "p1,p2" ] || { echo "on the positive examples the rule does not find exactly p1,p2"; exit 1; }
[ -z "$(jq -r '[.[].matches[]?.id] | join(",")' /tmp/cn.json)" ] || { echo "false positives on the negative examples"; exit 1; }
want=$(sigma convert -t splunk --without-pipeline $f 2>/dev/null | grep -v '^Parsing' | grep .)
[ "$(grep -v '^Parsing' /root/capstone/kurs_pay_veliki_povrat.spl 2>/dev/null | grep .)" = "$want" ] || { echo "kurs_pay_veliki_povrat.spl is not the Splunk query for your rule"; exit 1; }
-->
<!-- hint
The lab from module 6. For Splunk: `sigma convert -t splunk --without-pipeline …`.
-->
<!-- solution
cat > /root/capstone/kurs_pay_veliki_povrat.yml <<'EOF'
title: kurs-pay veliki povrat novca
id: 0b6a6c1e-7f2d-4c3b-9a8e-2d1f0c9b8a71
status: test
description: Povrat novca od 1000 ili više, iznad limita bez odobrenja
author: Kurs
date: 2026-10-16
tags:
  - attack.impact
  - attack.t1565.001
logsource:
  product: kurs
  service: pay
detection:
  selection:
    action: refund
    amount|gte: 1000
  condition: selection
falsepositives:
  - Odobren povrat za reklamaciju velike narudžbe
level: high
EOF
sigma convert -t splunk --without-pipeline /root/capstone/kurs_pay_veliki_povrat.yml 2>/dev/null | grep -v '^Parsing' > /root/capstone/kurs_pay_veliki_povrat.spl
-->

## Task 5: Runbook

Write `/root/runbook/sumnjivi-povrati.md` with sections (`##`) in this order, using exactly these Serbian headings because the check compares them: `Okidač` (Trigger), `Trijaža` (Triage), `Obuzdavanje` (Containment), `Istraga` (Investigation), `Iskorjenjivanje` (Eradication), `Oporavak` (Recovery), `Komunikacija` (Communication), `Nakon incidenta` (Post-incident). Every section has at least one list item. The content of the sections may be in English.

- `Okidač` lists Wazuh rules **200102** and **200103**.
- `Istraga` contains a Wazuh query over `alerts.json` (e.g., a `jq` filter on `rule.id`) and evidence collection with the script from module 9 (`prikupi.sh`).
- `Obuzdavanje` contains a temporary suspension of the operator's account (the check looks for the word *suspend*, e.g., "suspend the operator account").

<!-- verify
f=/root/runbook/sumnjivi-povrati.md
[ -s $f ] || { echo "$f is missing"; exit 1; }
got=$(grep -E '^## ' $f | sed 's/^## *//; s/ *$//' | tr '\n' '|')
[ "$got" = 'Okidač|Trijaža|Obuzdavanje|Istraga|Iskorjenjivanje|Oporavak|Komunikacija|Nakon incidenta|' ] || { echo "the sections are wrong or not in this order (found: $got)"; exit 1; }
python3 - "$f" <<'EOF' || exit 1
import re, sys
s = open(sys.argv[1]).read()
names = re.findall(r"^## (.*)$", s, flags=re.M)
parts = re.split(r"^## .*$", s, flags=re.M)[1:]
for n, b in zip(names, parts):
    if not re.search(r"^\s*(-|\d+\.)\s+\S", b, re.M):
        sys.exit(f"section '{n.strip()}' has no list items")
EOF
sed -n '/^## Okidač/,/^## /p' $f | grep -q 200102 && sed -n '/^## Okidač/,/^## /p' $f | grep -q 200103 || { echo "Okidač must list rules 200102 and 200103"; exit 1; }
sed -n '/^## Istraga/,/^## /p' $f | grep -q 'alerts.json' && sed -n '/^## Istraga/,/^## /p' $f | grep -q 'prikupi.sh' || { echo "Istraga needs a query over alerts.json and prikupi.sh"; exit 1; }
sed -n '/^## Obuzdavanje/,/^## /p' $f | grep -qiE 'blok|suspend|onemog|zaklj' || { echo "Obuzdavanje needs a temporary block of the operator account"; exit 1; }
-->
<!-- hint
The structure is the same as in the lab from module 10. Example query:
```bash
jq -c 'select(.rule.id == "200102" or .rule.id == "200103") | {t: .timestamp, u: .data.dstuser, o: .data.order, a: .data.amount}' /var/ossec/logs/alerts/alerts.json
```
-->
<!-- solution
sed 's/^@@ /## /' > /root/runbook/sumnjivi-povrati.md <<'EOF'
# Runbook: sumnjivi povrati novca (kurs-pay)

@@ Okidač
- Wazuh pravilo 200102 (povrat 1000 ili više) ili 200103 (3 povrata istog operatera u 2 minute)

@@ Trijaža
- Provjeri da li postoji odobrenje šefa smjene za povrat (ticket)
- Bez odobrenja ili više alarma istog operatera: incident visokog prioriteta

@@ Obuzdavanje
1. Privremeno blokiraj nalog operatera u kurs-pay (suspend) i opozovi njegove sesije
2. Zaustavi isplatu povrata koji još nisu procesirani kod banke

@@ Istraga
- Alarmi: `jq -c 'select(.rule.id == "200102" or .rule.id == "200103")' /var/ossec/logs/alerts/alerts.json`
- Dokazi sa servera: `/root/ir/prikupi.sh`, pa `zapakuj.sh` i zapis u lanac nadzora
- Provjeri FIM alarme za /etc/kurs-pay (izmjena limita) i prijave operatera

@@ Iskorjenjivanje
- Poništi neovlaštene povrate i vrati limite iz konfiguracije pod kontrolom verzija

@@ Oporavak
- Vrati pristup operateru tek nakon razgovora i odobrenja menadžera

@@ Komunikacija
- Odmah: šef smjene, finansije i incident commander
- Po potrebi: pravna služba i banka

@@ Nakon incidenta
- Analiza: da li je limit od 1000 dobar, treba li četiri oka za povrate iznad limita
EOF
-->
