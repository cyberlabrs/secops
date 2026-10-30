# Lab 2: Politika lozinki, zaključavanje i revizija naloga

Revizija je pokazala da Linux serveri prihvataju slabe lozinke, ne zaključavaju naloge nakon pogađanja i da postoji nalog bez lozinke. Sprovešćeš **tehničku politiku** (cilj 4.5) pomoću PAM modula `pam_pwquality`, `pam_pwhistory` i `pam_faillock`, a zatim uraditi **account audit**.

Ispit pominje dužinu, složenost, ponovnu upotrebu, istek i starost lozinke (*length, complexity, reuse, expiration, age*). Imaj u vidu i današnji stav NIST-a: **dužina je važnija od složenosti**, a periodična promjena bez razloga se više ne preporučuje. Ovaj lab pokriva oba pogleda.

<!-- setup
set -e
useradd -m -s /bin/bash ana
useradd -m -s /bin/bash test
passwd -d test >/dev/null
useradd -m -s /bin/bash marko
echo 'marko:Marko-pocetna-lozinka-2026' | chpasswd
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Politika lozinki ===
Kvalitet: /etc/security/pwquality.conf   Zaključavanje: /etc/security/faillock.conf
Test lozinke: echo 'lozinka' | pwscore
EOF
-->

## Kakve lozinke sistem sada prihvata?

`pwscore` ocjenjuje lozinku prema trenutnoj konfiguraciji `pam_pwquality` (0–100, a greška znači da je lozinka odbijena):

```bash
echo 'Ljeto2026' | pwscore
echo 'Sarajevo1!' | pwscore
echo 'ovo-je-duga-fraza-za-lozinku-2026' | pwscore
grep -v '^#' /etc/security/pwquality.conf | grep .
grep pwquality /etc/pam.d/common-password
```

Kratke lozinke prolaze, jer je podrazumijevana minimalna dužina samo 8 znakova.

## Dužina i kvalitet

U `/etc/security/pwquality.conf` postavi:

```text
minlen = 14
minclass = 3
dictcheck = 1
usercheck = 1
enforce_for_root
```

- `minlen = 14`: najvažnija postavka.
- `minclass = 3`: barem tri od četiri klase (mala slova, velika slova, cifre, simboli). Ovo je **complexity** iz ciljeva ispita.
- `dictcheck` i `usercheck`: odbij riječi iz rječnika i lozinke koje sadrže korisničko ime.
- `enforce_for_root`: pravila važe i kad root postavlja lozinku.

```bash
nano /etc/security/pwquality.conf
echo 'Ljeto2026' | pwscore
echo 'Ovo-Je-Duga-Fraza-2026' | pwscore
```

<!-- verify
f=/etc/security/pwquality.conf
for k in "minlen *= *14" "minclass *= *3" "dictcheck *= *1" "usercheck *= *1" "enforce_for_root"; do
  grep -Eq "^[[:space:]]*$k" $f || { echo "U $f nedostaje: $k"; exit 1; }
done
echo 'Ljeto2026' | pwscore >/dev/null 2>&1 && { echo "Kratka lozinka i dalje prolazi"; exit 1; }
echo 'Ovo-Je-Duga-Fraza-2026' | pwscore >/dev/null 2>&1 || { echo "Duga lozinka sa 3 klase ne prolazi: provjeri pravila"; exit 1; }
exit 0
-->
<!-- solution
printf 'minlen = 14\nminclass = 3\ndictcheck = 1\nusercheck = 1\nenforce_for_root\n' >> /etc/security/pwquality.conf
-->

## Ponovna upotreba i starost lozinke

**Reuse**: zabrani posljednjih 12 lozinki modulom `pam_pwhistory`. Dodaj ovu liniju u `/etc/pam.d/common-password`, **odmah iznad** linije sa `pam_unix.so`:

```text
password	required	pam_pwhistory.so remember=12 use_authtok enforce_for_root
```

**Age i expiration**: za korisnika `marko` postavi:

- minimalnu starost 1 dan (`-m 1`), da korisnik ne bi 12 puta promijenio lozinku za minut i vratio staru,
- maksimalnu starost 365 dana (`-M 365`),
- upozorenje 14 dana prije isteka (`-W 14`).

```bash
nano /etc/pam.d/common-password
chage -m 1 -M 365 -W 14 marko
chage -l marko
```

<!-- verify
f=/etc/pam.d/common-password
grep -Eq '^password[[:space:]]+required[[:space:]]+pam_pwhistory\.so.*remember=12' $f || { echo "Nema ispravne pam_pwhistory linije sa remember=12"; exit 1; }
h=$(grep -n 'pam_pwhistory' $f | head -1 | cut -d: -f1); u=$(grep -n 'pam_unix.so' $f | head -1 | cut -d: -f1)
[ "$h" -lt "$u" ] || { echo "pam_pwhistory mora biti iznad pam_unix.so"; exit 1; }
l=$(chage -l marko)
echo "$l" | grep -q 'Minimum number of days between password change[[:space:]]*: 1$' || { echo "Minimalna starost za marka nije 1"; exit 1; }
echo "$l" | grep -q 'Maximum number of days between password change[[:space:]]*: 365$' || { echo "Maksimalna starost za marka nije 365"; exit 1; }
echo "$l" | grep -q 'Number of days of warning before password expires[[:space:]]*: 14$' || { echo "Upozorenje za marka nije 14 dana"; exit 1; }
-->
<!-- hint
U `nano` pronađi liniju koja počinje sa `password	[success=1 default=ignore]	pam_unix.so` i iznad nje ubaci novu liniju. Redoslijed u PAM-u je bitan: provjera istorije mora se desiti prije nego što `pam_unix` sačuva novu lozinku.
-->
<!-- solution
sed -i '/^password.*pam_unix.so/i password\trequired\tpam_pwhistory.so remember=12 use_authtok enforce_for_root' /etc/pam.d/common-password
chage -m 1 -M 365 -W 14 marko
-->

## Zaključavanje naloga (account lockout)

U `/etc/security/faillock.conf` postavi: nalog se zaključava nakon **5** neuspjelih pokušaja (`deny = 5`) u roku od **15 minuta** (`fail_interval = 900`) i otključava sam nakon **15 minuta** (`unlock_time = 900`). Uključi i bilježenje u audit log (`audit`).

```bash
nano /etc/security/faillock.conf
grep -v '^#' /etc/security/faillock.conf | grep .
```

Da bi pravila stvarno radila, `pam_faillock` mora biti uključen u `/etc/pam.d/common-auth` (`preauth` prije i `authfail` poslije `pam_unix`). Na Ubuntuu se to radi pažljivo ili preko `pam-auth-update` profila, jer greška u `common-auth` može zaključati **sve**, uključujući admina. Zato je to promjena koja ide kroz **change management**, uz otvorenu root sesiju kao backout. Status zaključavanja se vidi sa `faillock --user ime`.

> Zaključavanje štiti od brute force napada, ali ne i od **password sprayinga** (jedan pokušaj po nalogu). Protiv sprayinga pomažu MFA, provjera procurjelih lozinki i detekcija u SIEM-u.

<!-- verify
f=/etc/security/faillock.conf
grep -Eq '^[[:space:]]*deny[[:space:]]*=[[:space:]]*5' $f || { echo "deny nije 5"; exit 1; }
grep -Eq '^[[:space:]]*fail_interval[[:space:]]*=[[:space:]]*900' $f || { echo "fail_interval nije 900"; exit 1; }
grep -Eq '^[[:space:]]*unlock_time[[:space:]]*=[[:space:]]*900' $f || { echo "unlock_time nije 900"; exit 1; }
grep -Eq '^[[:space:]]*audit[[:space:]]*$' $f || { echo "audit nije uključen"; exit 1; }
-->
<!-- solution
printf 'audit\ndeny = 5\nfail_interval = 900\nunlock_time = 900\n' >> /etc/security/faillock.conf
-->

## Account audit

Redovna revizija naloga hvata ono što politika ne može spriječiti. Pronađi:

```bash
# nalozi bez lozinke (prazno drugo polje u /etc/shadow)
awk -F: '$2 == "" {print $1}' /etc/shadow
# nalozi sa UID 0 osim root
awk -F: '$3 == 0 && $1 != "root" {print $1}' /etc/passwd
# interaktivni korisnički nalozi i datum zadnje promjene lozinke
for u in $(awk -F: '$3 >= 1000 && $7 !~ /nologin|false/ {print $1}' /etc/passwd); do echo "$u: $(chage -l $u | grep 'Last password change')"; done
```

Nalog bez lozinke je kritičan nalaz: zaključaj ga (`usermod -L`) i postavi shell na `/usr/sbin/nologin` dok vlasnik ne potvrdi da je potreban. Upiši njegovo ime u `/root/audit.txt`.

<!-- verify
grep -qx 'test' /root/audit.txt 2>/dev/null || { echo "U /root/audit.txt nije tačan nalog"; exit 1; }
[ -z "$(awk -F: '$2 == ""' /etc/shadow)" ] || { echo "I dalje postoji nalog sa praznom lozinkom"; exit 1; }
passwd -S test | awk '{print $2}' | grep -qx L || { echo "Nalog test nije zaključan"; exit 1; }
[ "$(getent passwd test | cut -d: -f7)" = /usr/sbin/nologin ] || { echo "Shell naloga test nije nologin"; exit 1; }
-->
<!-- solution
echo test > /root/audit.txt && usermod -L -s /usr/sbin/nologin test
-->
