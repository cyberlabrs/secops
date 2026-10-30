# Lab 1: Application log through rsyslog

The internal application `kurs-api` logs through syslog, facility `local3`. Right now its records end up mixed into `/var/log/syslog`. You will separate them into their own file, create a JSON version for the SIEM, and configure retention.

You simulate the application with the `logger` command:

```bash
logger -p local3.info -t kurs-api "event=login_ok user=ana src_ip=10.0.5.20"
tail -2 /var/log/syslog
```

<!-- setup
set -e
grep -q "$(hostname)" /etc/hosts || echo "127.0.1.1 $(hostname)" >> /etc/hosts
pgrep -x rsyslogd >/dev/null || rsyslogd
-->

## Separate log file

Create `/etc/rsyslog.d/30-kurs-api.conf` so that messages with facility `local3` are written to `/var/log/kurs-api.log` and **not** also to `/var/log/syslog`. Then reload rsyslog.

```bash
pkill -HUP rsyslogd        # or: pkill rsyslogd; rsyslogd
rsyslogd -N1               # check the configuration syntax
```

<!-- verify
[ -f /etc/rsyslog.d/30-kurs-api.conf ] || { echo "/etc/rsyslog.d/30-kurs-api.conf is missing"; exit 1; }
rsyslogd -N1 >/dev/null 2>&1 || { echo "rsyslog configuration has an error (rsyslogd -N1)"; exit 1; }
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null; sleep 0.5
m="provjera-$RANDOM-$RANDOM"
logger -p local3.info -t kurs-api "event=provjera id=$m"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-api.log 2>/dev/null && break; sleep 0.2; done
grep -q "$m" /var/log/kurs-api.log 2>/dev/null || { echo "local3 messages do not reach /var/log/kurs-api.log"; exit 1; }
grep -q "$m" /var/log/syslog && { echo "local3 messages still also end up in /var/log/syslog"; exit 1; }
exit 0
-->
<!-- hint
```text
local3.*    /var/log/kurs-api.log
& stop
```
`& stop` stops further processing of the same message, so it never reaches the `/var/log/syslog` rule in `/etc/rsyslog.conf`. Files in `/etc/rsyslog.d/` are loaded before those rules.
-->
<!-- solution
printf 'local3.*    /var/log/kurs-api.log\n& stop\n' > /etc/rsyslog.d/30-kurs-api.conf
pkill -x rsyslogd; sleep 0.5; rsyslogd 2>/dev/null
-->

## JSON for the SIEM

A SIEM processes structured records more easily. Add a second output to the same file: every `local3` message is also written to `/var/log/kurs-api.json`, as one JSON object per line with the fields:

- `@timestamp` (RFC 3339, e.g. `2026-10-16T10:00:00.123456+00:00`),
- `host.name`, `process.name` (the tag, e.g. `kurs-api`), `log.syslog.severity.name` (e.g. `info`),
- `message`.

The field names follow the Elastic Common Schema (ECS).

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
[ -n "$l" ] || { echo "the message does not reach /var/log/kurs-api.json"; exit 1; }
echo "$l" | jq -e . >/dev/null 2>&1 || { echo "the record is not valid JSON: $l"; exit 1; }
echo "$l" | jq -e --arg h "$(hostname)" '.["host.name"] == $h and .["process.name"] == "kurs-api" and .["log.syslog.severity.name"] == "warning" and (.message | contains("event=login_failed"))' >/dev/null || { echo "the fields are not correct: $l"; exit 1; }
echo "$l" | jq -r '.["@timestamp"]' | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+[+-][0-9]{2}:[0-9]{2}$' || { echo "@timestamp is not RFC 3339"; exit 1; }
grep -q "$m" /var/log/kurs-api.log || { echo "the record no longer reaches /var/log/kurs-api.log"; exit 1; }
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
`msg` often starts with a space; `property(... droplastlf="on")` and `position.from="2"` can strip it, but that is not required for the lab.
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

## Retention

Company policy: application logs are kept locally for **30 days**, rotated daily and compressed; the central copy is in the SIEM. Create `/etc/logrotate.d/kurs-api` for both files (`/var/log/kurs-api.log` and `/var/log/kurs-api.json`) with:

- `daily`, `rotate 30`, `compress` (with `delaycompress`), `missingok`, `notifempty`,
- a `postrotate` that tells rsyslog to reopen the files (`pkill -HUP rsyslogd` or `/usr/lib/rsyslog/rsyslog-rotate`).

```bash
logrotate -d /etc/logrotate.d/kurs-api
```

<!-- verify
f=/etc/logrotate.d/kurs-api
[ -f $f ] || { echo "$f is missing"; exit 1; }
for w in /var/log/kurs-api.log /var/log/kurs-api.json daily compress delaycompress missingok notifempty postrotate; do grep -q -- "$w" $f || { echo "$f is missing: $w"; exit 1; }; done
grep -Eq '^\s*rotate\s+30\b' $f || { echo "$f needs rotate 30"; exit 1; }
grep -Eq 'rsyslog|HUP' $f || { echo "postrotate must notify rsyslog (HUP)"; exit 1; }
logrotate -d $f >/tmp/lr.txt 2>&1 || { tail -5 /tmp/lr.txt; echo "logrotate reports an error"; exit 1; }
grep -qi 'error' /tmp/lr.txt && { grep -i error /tmp/lr.txt | head -3; echo "logrotate reports an error"; exit 1; }
logrotate -f $f >/dev/null 2>&1 || { echo "forced rotation fails"; exit 1; }
ls /var/log/kurs-api.log.1 >/dev/null 2>&1 || { echo "rotation did not create kurs-api.log.1"; exit 1; }
m="rot-$RANDOM"; logger -p local3.info -t kurs-api "event=poslije_rotacije id=$m"
for i in $(seq 20); do grep -q "$m" /var/log/kurs-api.log 2>/dev/null && break; sleep 0.2; done
grep -q "$m" /var/log/kurs-api.log || { echo "after rotation rsyslog does not write to the new file (postrotate?)"; exit 1; }
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
`sharedscripts` runs `postrotate` once for all the files in the block.
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
