# Lab 1: Wazuh sources, FIM and SCA

The lab runs a **Wazuh manager** (without the indexer and dashboard): it analyzes the logs you point it at and writes alerts to `/var/ossec/logs/alerts/alerts.json`. The default installation does not read `/var/log/auth.log`, does not monitor the configuration of the `kurs-api` application, and you don't yet know this system's CIS score.

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

## New source: auth.log

Add a `<localfile>` block to `/var/ossec/etc/ossec.conf` that reads `/var/log/auth.log` (format `syslog`) and restart Wazuh. Check in `/var/ossec/logs/ossec.log` that logcollector is monitoring the file.

To test, perform one failed `sudo` (a wrong password for some user) and look for the alert.

```bash
/var/ossec/bin/wazuh-control restart
grep 'Analyzing file' /var/ossec/logs/ossec.log | tail
```

<!-- verify
grep -Pzo '<localfile>\s*<log_format>syslog</log_format>\s*<location>/var/log/auth.log</location>\s*</localfile>|<localfile>\s*<location>/var/log/auth.log</location>\s*<log_format>syslog</log_format>\s*</localfile>' /var/ossec/etc/ossec.conf >/dev/null || { echo "ossec.conf has no localfile for /var/log/auth.log (syslog)"; exit 1; }
/var/ossec/bin/wazuh-control status | grep -q 'wazuh-logcollector is running' || { echo "Wazuh is not running (restart it)"; exit 1; }
grep -q "Analyzing file: '/var/log/auth.log'" /var/ossec/logs/ossec.log || { echo "logcollector is not monitoring /var/log/auth.log (restart?)"; exit 1; }
m="kursprovjera$RANDOM"
logger -p authpriv.notice -t sshd "Invalid user $m from 192.0.2.44 port 40$RANDOM"
for i in $(seq 40); do grep -q "$m" /var/ossec/logs/alerts/alerts.json 2>/dev/null && break; sleep 0.25; done
grep "$m" /var/ossec/logs/alerts/alerts.json | jq -e 'select(.rule.id == "5710")' >/dev/null 2>&1 || { echo "the auth.log record did not reach Wazuh (no alert 5710)"; exit 1; }
-->
<!-- hint
Add before the last `</ossec_config>`:
```xml
<localfile>
  <log_format>syslog</log_format>
  <location>/var/log/auth.log</location>
</localfile>
```
`wazuh-start` started rsyslog and sshd, so `/var/log/auth.log` exists.
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

## FIM for the application configuration

Every change to `/etc/kurs-api/` must immediately produce an alert with the difference (diff). In the `<syscheck>` section add the directory `/etc/kurs-api` with `realtime="yes"` and `report_changes="yes"`, then restart Wazuh.

Check: modify `app.conf` and look for alert 550 (integrity change).

```bash
sed -i 's/log_level = info/log_level = debug/' /etc/kurs-api/app.conf
jq -c 'select(.syscheck) | {id: .rule.id, path: .syscheck.path, diff: .syscheck.diff}' /var/ossec/logs/alerts/alerts.json | tail -3
```

<!-- verify
grep -Eq '<directories[^>]*realtime="yes"[^>]*>[^<]*/etc/kurs-api' /var/ossec/etc/ossec.conf || { echo "syscheck has no /etc/kurs-api with realtime=\"yes\""; exit 1; }
grep -Eq '<directories[^>]*report_changes="yes"[^>]*>[^<]*/etc/kurs-api' /var/ossec/etc/ossec.conf || { echo "syscheck for /etc/kurs-api has no report_changes=\"yes\""; exit 1; }
/var/ossec/bin/wazuh-control status | grep -q 'wazuh-syscheckd is running' || { echo "wazuh-syscheckd is not running"; exit 1; }
for i in $(seq 60); do grep -q "Real-time file integrity monitoring started" /var/ossec/logs/ossec.log && break; sleep 0.5; done
sleep 2
v="provjera_$RANDOM"
echo "# $v" >> /etc/kurs-api/app.conf
for i in $(seq 60); do jq -e --arg v "$v" 'select(.syscheck.path == "/etc/kurs-api/app.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 && break; sleep 0.5; done
jq -e --arg v "$v" 'select(.rule.id == "550" and .syscheck.path == "/etc/kurs-api/app.conf" and (.syscheck.diff // "" | contains($v)))' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 || { echo "the change to app.conf did not produce alert 550 with a diff (realtime/report_changes, restart?)"; exit 1; }
-->
<!-- hint
In the existing `<syscheck>` block:
```xml
<directories realtime="yes" report_changes="yes">/etc/kurs-api</directories>
```
After a restart, syscheck first builds a baseline; alerts arrive for changes made **after** that. In `ossec.log` look for "Real-time file integrity monitoring started".
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

## CIS score from SCA

At startup, Wazuh assessed the system against the CIS Benchmark for Debian 12 (the SCA module). In `alerts.json`, find the scan summary (rule 19004 or the `data.sca` fields):

- write the score to `/root/sca-skor.txt` (a number, without the % sign),
- write the number of checks that did not pass (`failed`) to `/root/sca-pali.txt`.

```bash
jq -c 'select(.data.sca.type == "summary") | .data.sca' /var/ossec/logs/alerts/alerts.json | tail -1
```

<!-- verify
s=$(jq -r 'select(.data.sca.type == "summary") | .data.sca.score' /var/ossec/logs/alerts/alerts.json | tail -1)
f=$(jq -r 'select(.data.sca.type == "summary") | .data.sca.failed' /var/ossec/logs/alerts/alerts.json | tail -1)
[ -n "$s" ] || { echo "alerts.json has no SCA summary yet (wait a few seconds after Wazuh starts)"; exit 1; }
[ "$(tr -d ' %\n' < /root/sca-skor.txt 2>/dev/null)" = "$s" ] || { echo "sca-skor.txt is not correct"; exit 1; }
[ "$(tr -d ' \n' < /root/sca-pali.txt 2>/dev/null)" = "$f" ] || { echo "sca-pali.txt is not correct"; exit 1; }
-->
<!-- hint
The SCA summary has the fields `score`, `passed`, `failed`, `invalid` and `policy`. If there were several scans (every restart), take the last one.
-->
<!-- solution
for i in $(seq 60); do jq -e 'select(.data.sca.type == "summary")' /var/ossec/logs/alerts/alerts.json >/dev/null 2>&1 && break; sleep 1; done
jq -r 'select(.data.sca.type == "summary") | .data.sca.score' /var/ossec/logs/alerts/alerts.json | tail -1 > /root/sca-skor.txt
jq -r 'select(.data.sca.type == "summary") | .data.sca.failed' /var/ossec/logs/alerts/alerts.json | tail -1 > /root/sca-pali.txt
-->
