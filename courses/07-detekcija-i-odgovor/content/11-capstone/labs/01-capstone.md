# Capstone: detekcija za novi servis kurs-pay

Platni servis `kurs-pay` ide u produkciju za dvije sedmice, a audit traži da do tada ima detekciju zloupotrebe povrata novca (refund) i plan odgovora. Ti si inženjer za detekciju: od sirovog loga do runbooka, sve u ovom labu.

Format loga (syslog, facility `local4`, tag `kurs-pay`):

```text
… kurs-pay: event=refund user=operater1 order=A-1001 amount=120
… kurs-pay: event=refund user=operater2 order=A-1002 amount=2500
… kurs-pay: event=payout_account_changed user=operater1 account=RS35...
```

Isti događaji se šalju i kao JSON (polja `action`, `user`, `order`, `amount`) u centralni SIEM, za koji pišeš Sigma pravila.

Zadaci se provjeravaju kroz Wazuh (`wazuh-logtest`, alarmi), Zircolite i sadržaj fajlova. Vrijeme: 120 minuta.

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

## Zadatak 1: Log stiže u Wazuh

- rsyslog: `local4` poruke idu u `/var/log/kurs-pay.log` (i ne u `/var/log/syslog`).
- Wazuh čita `/var/log/kurs-pay.log` (format `syslog`).
- Dekoder `kurs-pay` (po `program_name`) i dječji dekoder sa poljima `action` (`event`), `dstuser` (`user`), `order` i `amount`.

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null; sleep 0.5
m="cap$RANDOM"; logger -p local4.info -t kurs-pay "event=provjera user=$m order=X-1 amount=1"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-pay.log 2>/dev/null && break; sleep 0.2; done
grep -q "$m" /var/log/kurs-pay.log 2>/dev/null || { echo "local4 poruke ne stižu u /var/log/kurs-pay.log"; exit 1; }
grep -q "$m" /var/log/syslog && { echo "local4 poruke završavaju i u /var/log/syslog"; exit 1; }
grep -q '<location>/var/log/kurs-pay.log</location>' /var/ossec/etc/ossec.conf || { echo "Wazuh ne čita /var/log/kurs-pay.log"; exit 1; }
grep -q "Analyzing file: '/var/log/kurs-pay.log'" /var/ossec/logs/ossec.log || { echo "logcollector ne prati /var/log/kurs-pay.log (restart?)"; exit 1; }
o=$(echo "2026-10-16T10:00:00.000000+00:00 lab kurs-pay: event=refund user=operater2 order=A-1002 amount=2500" | /var/ossec/bin/wazuh-logtest 2>&1)
for x in "name: 'kurs-pay'" "action: 'refund'" "dstuser: 'operater2'" "order: 'A-1002'" "amount: '2500'"; do
  echo "$o" | grep -q "$x" || { echo "dekodiranje nije potpuno: nedostaje $x"; exit 1; }
done
-->
<!-- hint
Labovi iz modula 1 (rsyslog) i 4 (dekoder). Nakon izmjene `ossec.conf` ili dekodera restartuj Wazuh.
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

## Zadatak 2: Pravila

| ID | Nivo | Kada | MITRE |
|---|---|---|---|
| 200100 | 0 | bilo koji `kurs-pay` događaj | |
| 200101 | 3 | `refund` | |
| 200102 | 10 | `refund` sa iznosom **1000 ili više** | T1565.001 |
| 200103 | 12 | 3 puta 200101 u 120 sekundi za istog korisnika (`dstuser`) | T1565.001 |

<!-- verify
for i in $(seq 60); do echo test | /var/ossec/bin/wazuh-logtest 2>&1 | grep -q 'Phase 1' && break; sleep 0.5; done
ev() { echo "2026-10-16T10:00:00.000000+00:00 lab kurs-pay: event=$1 user=$2 order=$3 amount=$4"; }
id_of() { /var/ossec/bin/wazuh-logtest 2>&1 | grep -oE "^\s*id: '[0-9]+'" | tail -1 | grep -oE '[0-9]+'; }
[ "$(ev refund op1 A-1 120 | id_of)" = "200101" ] || { echo "refund 120 treba pravilo 200101"; exit 1; }
[ "$(ev refund op1 A-1 999 | id_of)" = "200101" ] || { echo "refund 999 treba pravilo 200101 (ne 200102)"; exit 1; }
[ "$(ev refund op1 A-1 1000 | id_of)" = "200102" ] || { echo "refund 1000 treba pravilo 200102"; exit 1; }
[ "$(ev refund op1 A-1 25000 | id_of)" = "200102" ] || { echo "refund 25000 treba pravilo 200102"; exit 1; }
[ "$(ev payment kupac A-1 5000 | id_of)" = "200100" ] || { echo "payment ne smije okinuti pravila za refund"; exit 1; }
[ "$( { ev refund op7 A-1 10; ev refund op7 A-2 20; ev refund op7 A-3 30; } | id_of)" = "200103" ] || { echo "3 povrata istog korisnika ne okidaju 200103"; exit 1; }
[ "$( { ev refund op8 A-1 10; ev refund op9 A-2 20; ev refund op8 A-3 30; } | id_of)" = "200103" ] && { echo "200103 se okida i za različite korisnike"; exit 1; }
for r in 200102 200103; do sed -n "/id=\"$r\"/,/<\/rule>/p" /var/ossec/etc/rules/local_rules.xml | grep -q 'T1565.001' || { echo "$r nema MITRE T1565.001"; exit 1; }; done
exit 0
-->
<!-- hint
Iznos poredi regexom nad poljem: `<field name="amount">^\d\d\d\d+</field>` (četiri ili više cifara). Za istog korisnika u korelaciji: `<same_user />`.
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

## Zadatak 3: Integritet konfiguracije

Izmjena limita u `/etc/kurs-pay/` (npr. podizanje `max_refund_bez_odobrenja`) mora odmah dati FIM alarm sa razlikom.

<!-- verify
grep -Eq '<directories[^>]*realtime="yes"[^>]*>[^<]*/etc/kurs-pay' /var/ossec/etc/ossec.conf && grep -Eq '<directories[^>]*report_changes="yes"[^>]*>[^<]*/etc/kurs-pay' /var/ossec/etc/ossec.conf || { echo "syscheck za /etc/kurs-pay treba realtime i report_changes"; exit 1; }
for i in $(seq 60); do grep -q "Real-time file integrity monitoring started" /var/ossec/logs/ossec.log && break; sleep 0.5; done
sleep 2; v="izmjena_$RANDOM"; echo "# $v" >> /etc/kurs-pay/limits.conf
for i in $(seq 60); do jq -e --arg v "$v" 'select(.syscheck.path == "/etc/kurs-pay/limits.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 && break; sleep 0.5; done
jq -e --arg v "$v" 'select(.syscheck.path == "/etc/kurs-pay/limits.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 || { echo "izmjena limits.conf nije dala FIM alarm sa razlikom"; exit 1; }
-->
<!-- hint
Lab iz modula 3: `<directories realtime="yes" report_changes="yes">/etc/kurs-pay</directories>` u `<syscheck>`.
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

## Zadatak 4: Sigma pravilo za SIEM

Napiši `/root/capstone/kurs_pay_veliki_povrat.yml`: povrat (`action: refund`) sa iznosom 1000 ili više (`amount|gte: 1000`), `logsource` `product: kurs` / `service: pay`, `level: high`, tag `attack.t1565.001`. `sigma check` bez grešaka i upozorenja; nad `testovi/pozitivni.jsonl` Zircolite nalazi tačno `p1` i `p2`, nad `negativni.jsonl` ništa. Sačuvaj i Splunk upit u `/root/capstone/kurs_pay_veliki_povrat.spl`.

<!-- verify
f=/root/capstone/kurs_pay_veliki_povrat.yml
[ -f $f ] || { echo "nema $f"; exit 1; }
sigma check $f > /tmp/sc.txt 2>&1; grep -q 'Found 0 errors, 0 condition errors and 0 issues' /tmp/sc.txt || { grep -iE 'issue|error' /tmp/sc.txt | head -5; echo "sigma check javlja greške ili upozorenja"; exit 1; }
yq '.tags[]' $f | grep -qx 'attack.t1565.001' || { echo "nedostaje tag attack.t1565.001"; exit 1; }
cd /tmp
zircolite -e /root/capstone/testovi/pozitivni.jsonl -j -r $f -o /tmp/cp.json -q >/dev/null 2>&1
zircolite -e /root/capstone/testovi/negativni.jsonl -j -r $f -o /tmp/cn.json -q >/dev/null 2>&1
[ "$(jq -r '[.[].matches[]?.id] | sort | join(",")' /tmp/cp.json)" = "p1,p2" ] || { echo "nad pozitivnim primjerima pravilo ne nalazi tačno p1,p2"; exit 1; }
[ -z "$(jq -r '[.[].matches[]?.id] | join(",")' /tmp/cn.json)" ] || { echo "lažni pozitivi nad negativnim primjerima"; exit 1; }
want=$(sigma convert -t splunk --without-pipeline $f 2>/dev/null | grep -v '^Parsing' | grep .)
[ "$(grep -v '^Parsing' /root/capstone/kurs_pay_veliki_povrat.spl 2>/dev/null | grep .)" = "$want" ] || { echo "kurs_pay_veliki_povrat.spl nije Splunk upit za tvoje pravilo"; exit 1; }
-->
<!-- hint
Lab iz modula 6. Za Splunk: `sigma convert -t splunk --without-pipeline …`.
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

## Zadatak 5: Runbook

Napiši `/root/runbook/sumnjivi-povrati.md` sa sekcijama (`##`) ovim redom: `Okidač`, `Trijaža`, `Obuzdavanje`, `Istraga`, `Iskorjenjivanje`, `Oporavak`, `Komunikacija`, `Nakon incidenta`. Svaka sekcija ima barem jednu stavku liste.

- `Okidač` navodi Wazuh pravila **200102** i **200103**.
- `Istraga` sadrži Wazuh upit nad `alerts.json` (npr. `jq` filter po `rule.id`) i prikupljanje dokaza skriptom iz modula 9 (`prikupi.sh`).
- `Obuzdavanje` sadrži privremenu blokadu naloga operatera.

<!-- verify
f=/root/runbook/sumnjivi-povrati.md
[ -s $f ] || { echo "nema $f"; exit 1; }
got=$(grep -E '^## ' $f | sed 's/^## *//; s/ *$//' | tr '\n' '|')
[ "$got" = 'Okidač|Trijaža|Obuzdavanje|Istraga|Iskorjenjivanje|Oporavak|Komunikacija|Nakon incidenta|' ] || { echo "sekcije nisu tačne ili nisu ovim redom (ima: $got)"; exit 1; }
python3 - "$f" <<'EOF' || exit 1
import re, sys
s = open(sys.argv[1]).read()
names = re.findall(r"^## (.*)$", s, flags=re.M)
parts = re.split(r"^## .*$", s, flags=re.M)[1:]
for n, b in zip(names, parts):
    if not re.search(r"^\s*(-|\d+\.)\s+\S", b, re.M):
        sys.exit(f"sekcija '{n.strip()}' nema nijednu stavku liste")
EOF
sed -n '/^## Okidač/,/^## /p' $f | grep -q 200102 && sed -n '/^## Okidač/,/^## /p' $f | grep -q 200103 || { echo "Okidač treba pravila 200102 i 200103"; exit 1; }
sed -n '/^## Istraga/,/^## /p' $f | grep -q 'alerts.json' && sed -n '/^## Istraga/,/^## /p' $f | grep -q 'prikupi.sh' || { echo "Istraga treba upit nad alerts.json i prikupi.sh"; exit 1; }
sed -n '/^## Obuzdavanje/,/^## /p' $f | grep -qiE 'blok|suspend|onemog|zaklj' || { echo "Obuzdavanje treba privremenu blokadu naloga operatera"; exit 1; }
-->
<!-- hint
Struktura je ista kao u labu iz modula 10. Primjer upita:
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
