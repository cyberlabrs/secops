# Lab 2: Password policy, account lockout, and account audit

An audit showed that the Linux servers accept weak passwords, don't lock accounts after guessing attempts, and that there's an account with no password. You'll enforce a **technical policy** (objective 4.5) using the PAM modules `pam_pwquality`, `pam_pwhistory`, and `pam_faillock`, and then perform an **account audit**.

The exam mentions password length, complexity, reuse, expiration, and age. Also keep in mind NIST's current position: **length matters more than complexity**, and periodic changes without a reason are no longer recommended. This lab covers both views.

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

## What passwords does the system accept right now?

`pwscore` scores a password against the current `pam_pwquality` configuration (0–100; an error means the password is rejected):

```bash
echo 'Ljeto2026' | pwscore
echo 'Sarajevo1!' | pwscore
echo 'ovo-je-duga-fraza-za-lozinku-2026' | pwscore
grep -v '^#' /etc/security/pwquality.conf | grep .
grep pwquality /etc/pam.d/common-password
```

Short passwords pass, because the default minimum length is only 8 characters.

## Length and quality

In `/etc/security/pwquality.conf`, set:

```text
minlen = 14
minclass = 3
dictcheck = 1
usercheck = 1
enforce_for_root
```

- `minlen = 14`: the most important setting.
- `minclass = 3`: at least three of the four classes (lowercase, uppercase, digits, symbols). This is the **complexity** from the exam objectives.
- `dictcheck` and `usercheck`: reject dictionary words and passwords that contain the username.
- `enforce_for_root`: the rules apply even when root sets the password.

```bash
nano /etc/security/pwquality.conf
echo 'Ljeto2026' | pwscore
echo 'Ovo-Je-Duga-Fraza-2026' | pwscore
```

<!-- verify
f=/etc/security/pwquality.conf
for k in "minlen *= *14" "minclass *= *3" "dictcheck *= *1" "usercheck *= *1" "enforce_for_root"; do
  grep -Eq "^[[:space:]]*$k" $f || { echo "Missing in $f: $k"; exit 1; }
done
echo 'Ljeto2026' | pwscore >/dev/null 2>&1 && { echo "A short password still passes"; exit 1; }
echo 'Ovo-Je-Duga-Fraza-2026' | pwscore >/dev/null 2>&1 || { echo "A long password with 3 classes does not pass: check the rules"; exit 1; }
exit 0
-->
<!-- solution
printf 'minlen = 14\nminclass = 3\ndictcheck = 1\nusercheck = 1\nenforce_for_root\n' >> /etc/security/pwquality.conf
-->

## Password reuse and age

**Reuse**: forbid the last 12 passwords with the `pam_pwhistory` module. Add this line to `/etc/pam.d/common-password`, **directly above** the line with `pam_unix.so`:

```text
password	required	pam_pwhistory.so remember=12 use_authtok enforce_for_root
```

**Age and expiration**: for the user `marko`, set:

- a minimum age of 1 day (`-m 1`), so the user can't change the password 12 times in a minute and get the old one back,
- a maximum age of 365 days (`-M 365`),
- a warning 14 days before expiration (`-W 14`).

```bash
nano /etc/pam.d/common-password
chage -m 1 -M 365 -W 14 marko
chage -l marko
```

<!-- verify
f=/etc/pam.d/common-password
grep -Eq '^password[[:space:]]+required[[:space:]]+pam_pwhistory\.so.*remember=12' $f || { echo "No valid pam_pwhistory line with remember=12"; exit 1; }
h=$(grep -n 'pam_pwhistory' $f | head -1 | cut -d: -f1); u=$(grep -n 'pam_unix.so' $f | head -1 | cut -d: -f1)
[ "$h" -lt "$u" ] || { echo "pam_pwhistory must be above pam_unix.so"; exit 1; }
l=$(chage -l marko)
echo "$l" | grep -q 'Minimum number of days between password change[[:space:]]*: 1$' || { echo "The minimum age for marko is not 1"; exit 1; }
echo "$l" | grep -q 'Maximum number of days between password change[[:space:]]*: 365$' || { echo "The maximum age for marko is not 365"; exit 1; }
echo "$l" | grep -q 'Number of days of warning before password expires[[:space:]]*: 14$' || { echo "The warning for marko is not 14 days"; exit 1; }
-->
<!-- hint
In `nano`, find the line that starts with `password	[success=1 default=ignore]	pam_unix.so` and insert the new line above it. Order matters in PAM: the history check must happen before `pam_unix` saves the new password.
-->
<!-- solution
sed -i '/^password.*pam_unix.so/i password\trequired\tpam_pwhistory.so remember=12 use_authtok enforce_for_root' /etc/pam.d/common-password
chage -m 1 -M 365 -W 14 marko
-->

## Account lockout

In `/etc/security/faillock.conf`, set: the account locks after **5** failed attempts (`deny = 5`) within **15 minutes** (`fail_interval = 900`) and unlocks on its own after **15 minutes** (`unlock_time = 900`). Also enable logging to the audit log (`audit`).

```bash
nano /etc/security/faillock.conf
grep -v '^#' /etc/security/faillock.conf | grep .
```

For the rules to actually work, `pam_faillock` must be enabled in `/etc/pam.d/common-auth` (`preauth` before and `authfail` after `pam_unix`). On Ubuntu this is done carefully or through a `pam-auth-update` profile, because a mistake in `common-auth` can lock out **everyone**, including the admin. That's why it's a change that goes through **change management**, with an open root session as the backout. Lockout status is shown with `faillock --user name`.

> Lockout protects against brute force attacks, but not against **password spraying** (one attempt per account). Against spraying, MFA, checking for leaked passwords, and detection in the SIEM help.

<!-- verify
f=/etc/security/faillock.conf
grep -Eq '^[[:space:]]*deny[[:space:]]*=[[:space:]]*5' $f || { echo "deny is not 5"; exit 1; }
grep -Eq '^[[:space:]]*fail_interval[[:space:]]*=[[:space:]]*900' $f || { echo "fail_interval is not 900"; exit 1; }
grep -Eq '^[[:space:]]*unlock_time[[:space:]]*=[[:space:]]*900' $f || { echo "unlock_time is not 900"; exit 1; }
grep -Eq '^[[:space:]]*audit[[:space:]]*$' $f || { echo "audit is not enabled"; exit 1; }
-->
<!-- solution
printf 'audit\ndeny = 5\nfail_interval = 900\nunlock_time = 900\n' >> /etc/security/faillock.conf
-->

## Account audit

A regular account audit catches what policy can't prevent. Find:

```bash
# accounts without a password (empty second field in /etc/shadow)
awk -F: '$2 == "" {print $1}' /etc/shadow
# accounts with UID 0 other than root
awk -F: '$3 == 0 && $1 != "root" {print $1}' /etc/passwd
# interactive user accounts and the date of the last password change
for u in $(awk -F: '$3 >= 1000 && $7 !~ /nologin|false/ {print $1}' /etc/passwd); do echo "$u: $(chage -l $u | grep 'Last password change')"; done
```

An account without a password is a critical finding: lock it (`usermod -L`) and set its shell to `/usr/sbin/nologin` until the owner confirms it's needed. Write its name into `/root/audit.txt`.

<!-- verify
grep -qx 'test' /root/audit.txt 2>/dev/null || { echo "/root/audit.txt does not contain the correct account"; exit 1; }
[ -z "$(awk -F: '$2 == ""' /etc/shadow)" ] || { echo "An account with an empty password still exists"; exit 1; }
passwd -S test | awk '{print $2}' | grep -qx L || { echo "The test account is not locked"; exit 1; }
[ "$(getent passwd test | cut -d: -f7)" = /usr/sbin/nologin ] || { echo "The shell of the test account is not nologin"; exit 1; }
-->
<!-- solution
echo test > /root/audit.txt && usermod -L -s /usr/sbin/nologin test
-->
