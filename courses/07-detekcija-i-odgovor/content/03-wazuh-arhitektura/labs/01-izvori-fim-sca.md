# Lab 1: Wazuh izvori, FIM i SCA

U labu radi **Wazuh manager** (bez indexera i dashboarda): logove koje mu zadaš analizira, a alarme upisuje u `/var/ossec/logs/alerts/alerts.json`. Podrazumijevana instalacija ne čita `/var/log/auth.log`, ne prati konfiguraciju aplikacije `kurs-api` i ti još ne znaš kakav je CIS skor ovog sistema.

```bash
wazuh-start
/var/ossec/bin/wazuh-control status
grep -A3 '<localfile>' /var/ossec/etc/ossec.conf
tail -f /var/ossec/logs/alerts/alerts.json | jq -c '{id: .rule.id, level: .rule.level, d: .rule.description}'
```

<!-- setup
set -e
mkdir -p /etc/kurs-api
printf 'listen = 0.0.0.0:8080\nlog_level = info\nadmin_ips = 10.0.5.0/24\n' > /etc/kurs-api/app.conf
wazuh-start >/dev/null
# prvi SCA sken (sažetak se šalje samo kad se rezultat promijeni)
for i in $(seq 90); do grep -q '"type":"summary"' /var/ossec/logs/alerts/alerts.json 2>/dev/null && break; sleep 1; done
-->

## Novi izvor: auth.log

Dodaj u `/var/ossec/etc/ossec.conf` blok `<localfile>` koji čita `/var/log/auth.log` (format `syslog`) i restartuj Wazuh. Provjeri u `/var/ossec/logs/ossec.log` da logcollector prati fajl.

Za test napravi jedan neuspješan `sudo` (pogrešna lozinka nekog korisnika) i potraži alarm.

```bash
/var/ossec/bin/wazuh-control restart
grep 'Analyzing file' /var/ossec/logs/ossec.log | tail
```

<!-- verify
grep -Pzo '<localfile>\s*<log_format>syslog</log_format>\s*<location>/var/log/auth.log</location>\s*</localfile>|<localfile>\s*<location>/var/log/auth.log</location>\s*<log_format>syslog</log_format>\s*</localfile>' /var/ossec/etc/ossec.conf >/dev/null || { echo "ossec.conf nema localfile za /var/log/auth.log (syslog)"; exit 1; }
/var/ossec/bin/wazuh-control status | grep -q 'wazuh-logcollector is running' || { echo "Wazuh ne radi (restartuj ga)"; exit 1; }
grep -q "Analyzing file: '/var/log/auth.log'" /var/ossec/logs/ossec.log || { echo "logcollector ne prati /var/log/auth.log (restart?)"; exit 1; }
m="kursprovjera$RANDOM"
logger -p authpriv.notice -t sshd "Invalid user $m from 192.0.2.44 port 40$RANDOM"
for i in $(seq 40); do grep -q "$m" /var/ossec/logs/alerts/alerts.json 2>/dev/null && break; sleep 0.25; done
grep "$m" /var/ossec/logs/alerts/alerts.json | jq -e 'select(.rule.id == "5710")' >/dev/null 2>&1 || { echo "zapis iz auth.log nije stigao do Wazuha (nema alarma 5710)"; exit 1; }
-->
<!-- hint
Dodaj prije zadnjeg `</ossec_config>`:
```xml
<localfile>
  <log_format>syslog</log_format>
  <location>/var/log/auth.log</location>
</localfile>
```
`wazuh-start` je pokrenuo rsyslog i sshd, pa `/var/log/auth.log` postoji.
-->
<!-- solution
python3 - <<'EOF'
p = "/var/ossec/etc/ossec.conf"; s = open(p).read()
i = s.rindex("</ossec_config>")
s = s[:i] + "  <localfile>\n    <log_format>syslog</log_format>\n    <location>/var/log/auth.log</location>\n  </localfile>\n" + s[i:]
open(p, "w").write(s)
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1; sleep 3
-->

## FIM za konfiguraciju aplikacije

Svaka izmjena `/etc/kurs-api/` mora odmah dati alarm sa razlikom (diff). U `<syscheck>` sekciji dodaj direktorij `/etc/kurs-api` sa `realtime="yes"` i `report_changes="yes"`, pa restartuj Wazuh.

Provjeri: izmijeni `app.conf` i potraži alarm 550 (izmjena integriteta).

```bash
sed -i 's/log_level = info/log_level = debug/' /etc/kurs-api/app.conf
jq -c 'select(.syscheck) | {id: .rule.id, path: .syscheck.path, diff: .syscheck.diff}' /var/ossec/logs/alerts/alerts.json | tail -3
```

<!-- verify
grep -Eq '<directories[^>]*realtime="yes"[^>]*>[^<]*/etc/kurs-api' /var/ossec/etc/ossec.conf || { echo "syscheck nema /etc/kurs-api sa realtime=\"yes\""; exit 1; }
grep -Eq '<directories[^>]*report_changes="yes"[^>]*>[^<]*/etc/kurs-api' /var/ossec/etc/ossec.conf || { echo "syscheck za /etc/kurs-api nema report_changes=\"yes\""; exit 1; }
/var/ossec/bin/wazuh-control status | grep -q 'wazuh-syscheckd is running' || { echo "wazuh-syscheckd ne radi"; exit 1; }
for i in $(seq 60); do grep -q "Real-time file integrity monitoring started" /var/ossec/logs/ossec.log && break; sleep 0.5; done
sleep 2
v="provjera_$RANDOM"
echo "# $v" >> /etc/kurs-api/app.conf
for i in $(seq 60); do jq -e --arg v "$v" 'select(.syscheck.path == "/etc/kurs-api/app.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 && break; sleep 0.5; done
jq -e --arg v "$v" 'select(.rule.id == "550" and .syscheck.path == "/etc/kurs-api/app.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 || { echo "izmjena app.conf nije dala alarm 550 sa razlikom (realtime/report_changes, restart?)"; exit 1; }
-->
<!-- hint
U postojećem `<syscheck>` bloku:
```xml
<directories realtime="yes" report_changes="yes">/etc/kurs-api</directories>
```
Nakon restarta syscheck prvo napravi osnovnu sliku (baseline); alarm stiže za izmjene **nakon** toga. U `ossec.log` traži „Real-time file integrity monitoring started“.
-->
<!-- solution
python3 - <<'EOF'
p = "/var/ossec/etc/ossec.conf"; s = open(p).read()
i = s.index("<syscheck>") + len("<syscheck>")
s = s[:i] + '\n    <directories realtime="yes" report_changes="yes">/etc/kurs-api</directories>' + s[i:]
open(p, "w").write(s)
EOF
/var/ossec/bin/wazuh-control restart >/dev/null 2>&1
for i in $(seq 60); do grep -q "Real-time file integrity monitoring started" /var/ossec/logs/ossec.log && break; sleep 0.5; done
-->

## CIS skor iz SCA

Wazuh je pri pokretanju ocijenio sistem prema CIS benchmarku za Debian 12 (modul SCA). Iz `alerts.json` pronađi sažetak skena (pravilo 19004 ili polja `data.sca`):

- u `/root/sca-skor.txt` upiši skor (broj, bez znaka %),
- u `/root/sca-pali.txt` upiši broj provjera koje nisu prošle (`failed`).

```bash
jq -c 'select(.data.sca.type == "summary") | .data.sca' /var/ossec/logs/alerts/alerts.json | tail -1
```

<!-- verify
s=$(jq -r 'select(.data.sca.type == "summary") | .data.sca.score' /var/ossec/logs/alerts/alerts.json | tail -1)
f=$(jq -r 'select(.data.sca.type == "summary") | .data.sca.failed' /var/ossec/logs/alerts/alerts.json | tail -1)
[ -n "$s" ] || { echo "u alerts.json još nema SCA sažetka (sačekaj par sekundi nakon starta Wazuha)"; exit 1; }
[ "$(tr -d ' %\n' < /root/sca-skor.txt 2>/dev/null)" = "$s" ] || { echo "sca-skor.txt nije tačan"; exit 1; }
[ "$(tr -d ' \n' < /root/sca-pali.txt 2>/dev/null)" = "$f" ] || { echo "sca-pali.txt nije tačan"; exit 1; }
-->
<!-- hint
SCA sažetak ima polja `score`, `passed`, `failed`, `invalid` i `policy`. Ako je bilo više skenova (svaki restart), uzmi zadnji.
-->
<!-- solution
for i in $(seq 60); do jq -e 'select(.data.sca.type == "summary")' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 && break; sleep 1; done
jq -r 'select(.data.sca.type == "summary") | .data.sca.score' /var/ossec/logs/alerts/alerts.json | tail -1 > /root/sca-skor.txt
jq -r 'select(.data.sca.type == "summary") | .data.sca.failed' /var/ossec/logs/alerts/alerts.json | tail -1 > /root/sca-pali.txt
-->
