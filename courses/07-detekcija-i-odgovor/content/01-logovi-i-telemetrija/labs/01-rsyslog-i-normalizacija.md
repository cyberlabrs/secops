# Lab 1: Log aplikacije kroz rsyslog

Interna aplikacija `kurs-api` loguje preko sysloga, facility `local3`. Trenutno njeni zapisi završavaju pomiješani u `/var/log/syslog`. Odvojićeš ih u poseban fajl, napraviti i JSON verziju za SIEM i podesiti retenciju.

Aplikaciju simuliraš komandom `logger`:

```bash
logger -p local3.info -t kurs-api "event=login_ok user=ana src_ip=10.0.5.20"
tail -2 /var/log/syslog
```

<!-- setup
set -e
grep -q "$(hostname)" /etc/hosts || echo "127.0.1.1 $(hostname)" >> /etc/hosts
pgrep -x rsyslogd >/dev/null || rsyslogd
-->

## Poseban log fajl

Napravi `/etc/rsyslog.d/30-kurs-api.conf` tako da se poruke facility-ja `local3` upisuju u `/var/log/kurs-api.log`, a **ne** i u `/var/log/syslog`. Zatim ponovo učitaj rsyslog.

```bash
pkill -HUP rsyslogd        # ili: pkill rsyslogd; rsyslogd
rsyslogd -N1               # provjera sintakse konfiguracije
```

<!-- verify
[ -f /etc/rsyslog.d/30-kurs-api.conf ] || { echo "nema /etc/rsyslog.d/30-kurs-api.conf"; exit 1; }
rsyslogd -N1 >/dev/null 2>&1 || { echo "rsyslog konfiguracija ima grešku (rsyslogd -N1)"; exit 1; }
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null; sleep 0.5
m="provjera-$RANDOM-$RANDOM"
logger -p local3.info -t kurs-api "event=provjera id=$m"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-api.log 2>/dev/null && break; sleep 0.2; done
grep -q "$m" /var/log/kurs-api.log 2>/dev/null || { echo "local3 poruke ne stižu u /var/log/kurs-api.log"; exit 1; }
grep -q "$m" /var/log/syslog && { echo "local3 poruke i dalje završavaju i u /var/log/syslog"; exit 1; }
exit 0
-->
<!-- hint
```text
local3.*    /var/log/kurs-api.log
& stop
```
`& stop` zaustavlja dalju obradu iste poruke, pa ona ne stiže do pravila za `/var/log/syslog` u `/etc/rsyslog.conf`. Fajlovi u `/etc/rsyslog.d/` učitavaju se prije tih pravila.
-->
<!-- solution
printf 'local3.*    /var/log/kurs-api.log\n& stop\n' > /etc/rsyslog.d/30-kurs-api.conf
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null
-->

## JSON za SIEM

SIEM lakše obrađuje strukturisane zapise. Dodaj u isti fajl i drugi izlaz: svaka `local3` poruka upisuje se i u `/var/log/kurs-api.json`, kao jedan JSON objekat po liniji sa poljima:

- `@timestamp` (RFC 3339, npr. `2026-10-16T10:00:00.123456+00:00`),
- `host.name`, `process.name` (tag, npr. `kurs-api`), `log.syslog.severity.name` (npr. `info`),
- `message`.

Imena polja prate Elastic Common Schema (ECS).

```bash
logger -p local3.warning -t kurs-api "event=login_failed user=ana src_ip=10.0.5.20"
tail -1 /var/log/kurs-api.json | jq .
```

<!-- verify
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null; sleep 0.5
m="json-$RANDOM-$RANDOM"
logger -p local3.warning -t kurs-api "event=login_failed user=ana id=$m"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-api.json 2>/dev/null && break; sleep 0.2; done
l=$(grep "$m" /var/log/kurs-api.json 2>/dev/null | tail -1)
[ -n "$l" ] || { echo "poruka ne stiže u /var/log/kurs-api.json"; exit 1; }
echo "$l" | jq -e . >/dev/null 2>&1 || { echo "zapis nije validan JSON: $l"; exit 1; }
echo "$l" | jq -e --arg h "$(hostname)" '.["host.name"] == $h and .["process.name"] == "kurs-api" and .["log.syslog.severity.name"] == "warning" and (.message | contains("event=login_failed"))' >/dev/null || { echo "polja nisu tačna: $l"; exit 1; }
echo "$l" | jq -r '.["@timestamp"]' | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+[+-][0-9]{2}:[0-9]{2}$' || { echo "@timestamp nije RFC 3339"; exit 1; }
grep -q "$m" /var/log/kurs-api.log || { echo "zapis više ne stiže u /var/log/kurs-api.log"; exit 1; }
-->
<!-- hint
```text
template(name="kursJson" type="list" option.jsonf="on") {
  property(outname="@timestamp" name="timereported" dateFormat="rfc3339" format="jsonf")
  property(outname="host.name" name="hostname" format="jsonf")
  property(outname="process.name" name="programname" format="jsonf")
  property(outname="log.syslog.severity.name" name="syslogseverity-text" format="jsonf")
  property(outname="message" name="msg" format="jsonf")
}
local3.*    /var/log/kurs-api.log
local3.*    action(type="omfile" file="/var/log/kurs-api.json" template="kursJson")
& stop
```
`msg` često počinje razmakom; `property(... droplastlf="on")` i `position.from="2"` ga mogu skinuti, ali za lab nije obavezno.
-->
<!-- solution
cat > /etc/rsyslog.d/30-kurs-api.conf <<'EOF'
template(name="kursJson" type="list" option.jsonf="on") {
  property(outname="@timestamp" name="timereported" dateFormat="rfc3339" format="jsonf")
  property(outname="host.name" name="hostname" format="jsonf")
  property(outname="process.name" name="programname" format="jsonf")
  property(outname="log.syslog.severity.name" name="syslogseverity-text" format="jsonf")
  property(outname="message" name="msg" format="jsonf")
}
local3.*    /var/log/kurs-api.log
local3.*    action(type="omfile" file="/var/log/kurs-api.json" template="kursJson")
& stop
EOF
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null
-->

## Retencija

Politika firme: logovi aplikacije čuvaju se lokalno **30 dana**, rotiraju se dnevno i kompresuju; centralna kopija je u SIEM-u. Napravi `/etc/logrotate.d/kurs-api` za oba fajla (`/var/log/kurs-api.log` i `/var/log/kurs-api.json`) sa:

- `daily`, `rotate 30`, `compress` (sa `delaycompress`), `missingok`, `notifempty`,
- `postrotate` koji javlja rsyslogu da ponovo otvori fajlove (`pkill -HUP rsyslogd` ili `/usr/lib/rsyslog/rsyslog-rotate`).

```bash
logrotate -d /etc/logrotate.d/kurs-api
```

<!-- verify
f=/etc/logrotate.d/kurs-api
[ -f $f ] || { echo "nema $f"; exit 1; }
for w in /var/log/kurs-api.log /var/log/kurs-api.json daily compress delaycompress missingok notifempty postrotate; do grep -q -- "$w" $f || { echo "$f nema: $w"; exit 1; }; done
grep -Eq '^\s*rotate\s+30\b' $f || { echo "$f treba rotate 30"; exit 1; }
grep -Eq 'rsyslog|HUP' $f || { echo "postrotate treba da javi rsyslogu (HUP)"; exit 1; }
logrotate -d $f >/tmp/lr.txt 2>&1 || { tail -5 /tmp/lr.txt; echo "logrotate javlja grešku"; exit 1; }
grep -qi 'error' /tmp/lr.txt && { grep -i error /tmp/lr.txt | head -3; echo "logrotate javlja grešku"; exit 1; }
logrotate -f $f >/dev/null 2>&1 || { echo "prisilna rotacija ne uspijeva"; exit 1; }
ls /var/log/kurs-api.log.1 >/dev/null 2>&1 || { echo "rotacija nije napravila kurs-api.log.1"; exit 1; }
m="rot-$RANDOM"; logger -p local3.info -t kurs-api "event=poslije_rotacije id=$m"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-api.log 2>/dev/null && break; sleep 0.2; done
grep -q "$m" /var/log/kurs-api.log || { echo "nakon rotacije rsyslog ne piše u novi fajl (postrotate?)"; exit 1; }
-->
<!-- hint
```text
/var/log/kurs-api.log /var/log/kurs-api.json {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        pkill -HUP rsyslogd || true
    endscript
}
```
`sharedscripts` pokreće `postrotate` jednom za sve fajlove u bloku.
-->
<!-- solution
cat > /etc/logrotate.d/kurs-api <<'EOF'
/var/log/kurs-api.log /var/log/kurs-api.json {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        pkill -HUP rsyslogd || true
    endscript
}
EOF
-->
