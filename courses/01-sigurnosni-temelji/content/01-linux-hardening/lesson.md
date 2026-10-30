## Zašto hardening

Svježe instaliran Linux je napravljen da radi za što više ljudi, a ne da bude siguran. Hardening znači **smanjiti površinu napada**: ugasiti ono što ne treba, zaključati ono što ostaje i ostaviti trag kad se nešto promijeni.

Tri pitanja vode svaki hardening:

1. **Ko može ući?** SSH, lozinke, ključevi, nalozi.
2. **Šta može uraditi kad uđe?** sudo, dozvole, SUID, servisi.
3. **Hoćemo li primijetiti?** logovi, auditd, integritet fajlova.

> Referenca industrije je **CIS Benchmark** za tvoju distribuciju (besplatan PDF uz registraciju na cisecurity.org). Ima dva nivoa: **Level 1** su razumne postavke koje rijetko lome aplikacije, **Level 2** je stroži, za okruženja sa visokim zahtjevima.

## SSH

SSH je glavna ulazna vrata servera. Konfiguracija je u `/etc/ssh/sshd_config`, a na novijim distribucijama i u `/etc/ssh/sshd_config.d/*.conf` (ti fajlovi se učitavaju **prije** ostatka glavnog fajla, a za većinu opcija **pobjeđuje prva pronađena vrijednost**).

| Opcija | Preporuka | Zašto |
|---|---|---|
| `PermitRootLogin` | `no` | Napadač mora pogoditi i korisničko ime; svaka admin akcija ide preko sudo i ostavlja trag ko je to uradio. |
| `PasswordAuthentication` | `no` | Samo ključevi. Brute-force napadi na lozinke postaju beskorisni. |
| `KbdInteractiveAuthentication` | `no` | Zatvara drugi put za lozinke (PAM challenge). |
| `PubkeyAuthentication` | `yes` | Prijava ključem. |
| `MaxAuthTries` | `3` ili `4` | Manje pokušaja po konekciji. |
| `X11Forwarding` | `no` | Serveru rijetko treba grafika; manje koda izloženo. |
| `AllowUsers` / `AllowGroups` | samo potrebni | Lista dozvoljenih je jača od liste zabranjenih. |
| `LoginGraceTime` | `60` | Kraće drži nedovršene konekcije. |
| `ClientAliveInterval` + `ClientAliveCountMax` | npr. `300` i `2` | Zatvara napuštene sesije. |

Dvije komande koje moraš znati:

```bash
sshd -t        # provjeri sintaksu prije restarta (inače se možeš zaključati vani)
sshd -T        # ispiši EFEKTIVNU konfiguraciju, nakon svih include fajlova
```

> **Zlatno pravilo:** prije restarta SSH-a na udaljenom serveru drži otvorenu jednu postojeću sesiju i testiraj novu prijavu iz drugog terminala.

## sudo i najmanje privilegije

Princip najmanjih privilegija (*least privilege*): svaki korisnik i proces dobija **samo** ono što mu treba za posao, i ništa više.

```text
# loše: deploy korisnik je praktično root
deploy ALL=(ALL) NOPASSWD: ALL

# bolje: tačno jedna komanda, sa punom putanjom
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart myapp
```

- Uređuj samo sa `visudo` ili `visudo -f /etc/sudoers.d/ime`. Sintaksna greška u sudoers fajlu može te ostaviti bez root pristupa.
- Fajlovi u `/etc/sudoers.d/` moraju imati dozvole `0440`.
- `sudo -l -U korisnik` pokazuje šta korisnik smije.
- Pazi na komande koje otvaraju shell: `vim`, `less`, `find -exec`, `tar`, `awk`… Ako ih dozvoliš kroz sudo, dao si root. Katalog takvih binarnih fajlova je **GTFOBins**, koristan i braniocu za reviziju sudoers pravila.

## Dozvole fajlova

`ls -l` prikazuje `-rwxr-x---`: vlasnik, grupa, ostali. Oktalno: r=4, w=2, x=1.

| Fajl | Tipične dozvole |
|---|---|
| `/etc/shadow` | `640` root:shadow ili `000` |
| `/etc/passwd` | `644` |
| privatni ključ, tajna konfiguracija | `600` |
| skripta koju pokreće root (cron) | `700` ili `750`, vlasnik root |
| `/etc/sudoers.d/*` | `440` |

Opasne situacije koje tražiš:

```bash
# fajlovi koje svako može mijenjati
find / -xdev -type f -perm -0002 2>/dev/null
# direktoriji koje svako može mijenjati, a nemaju sticky bit
find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null
# fajlovi bez vlasnika (ostali iza obrisanih korisnika)
find / -xdev \( -nouser -o -nogroup \) 2>/dev/null
```

Najgora kombinacija: **skripta koju pokreće root, a može je mijenjati bilo ko**. To je direktna eskalacija privilegija.

### SUID i SGID

SUID bit (`-rwsr-xr-x`) znači: program se izvršava s pravima **vlasnika fajla**, ne korisnika koji ga pokreće. `passwd` mora biti SUID root jer mijenja `/etc/shadow`. Ali SUID root na `find`, `bash` ili `python` daje root svakome.

```bash
find / -xdev -perm -4000 -type f 2>/dev/null   # SUID
find / -xdev -perm -2000 -type f 2>/dev/null   # SGID
chmod u-s /putanja/do/fajla                     # ukloni SUID
```

Napravi popis SUID fajlova na čistom sistemu i uporedi ga redovno. Novi SUID binarni fajl je jak signal kompromitacije.

### umask

`umask` određuje podrazumijevane dozvole novih fajlova. `022` daje fajlove `644`; CIS preporučuje `027` (fajlovi `640`, direktoriji `750`) tako da ostali korisnici ne čitaju tuđe fajlove.

## Servisi i portovi

Svaki servis koji sluša je potencijalna ulazna tačka.

```bash
ss -tulpn                         # ko sluša na kojem portu
systemctl list-unit-files --state=enabled
systemctl disable --now ime.service
```

Pitaj za svaki port: treba li uopšte? Treba li slušati na `0.0.0.0` ili je dovoljno `127.0.0.1`?

## Ažuriranja

Većina stvarnih kompromitacija koristi **poznate** ranjivosti za koje zakrpa već postoji. Na Ubuntuu uključi `unattended-upgrades` barem za sigurnosne zakrpe, a na flotama servera prati stanje centralno.

## auditd i logovi

`auditd` je Linux kernel audit sistem: bilježi sistemske pozive i pristup fajlovima prema pravilima.

```bash
# prati svaku promjenu na /etc/passwd i /etc/shadow, sa ključem za pretragu
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
# prati izvršavanje komandi kao root
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_cmds
```

Pravila idu u `/etc/audit/rules.d/*.rules`, učitavaju se sa `augenrules --load`, a pretražuju sa `ausearch -k identity`. U kontejnerima auditd obično ne radi jer je kernel zajednički s hostom, zato ga u labu nećemo pokretati. Na pravim serverima je obavezan dio CIS-a.

Ostali izvori: `journalctl`, `/var/log/auth.log` (prijave, sudo), a centralno slanje logova (rsyslog, Fluent Bit, agent za SIEM) da ih napadač ne može obrisati lokalno.

## Lynis

**Lynis** je besplatan alat koji skenira sistem i daje *hardening index* (0 do 100) i listu preporuka.

```bash
lynis audit system            # puni pregled
lynis show details SSH-7408   # objašnjenje konkretnog testa
```

Izvještaj se upisuje u `/var/log/lynis-report.dat`. Radni tok: skeniraj, popravi najvažnije, skeniraj ponovo i uporedi.

## Rezime

- Prvo zatvori ulaz (SSH ključevi, bez root prijave), pa ograniči ovlasti (sudo, dozvole, SUID), pa osiguraj vidljivost (auditd, logovi).
- Svaku promjenu provjeri (`sshd -t`, `visudo -c`) prije primjene.
- Automatizuj: ručni hardening se ne skalira. Ansible uloge i CIS profili su sljedeći korak.
