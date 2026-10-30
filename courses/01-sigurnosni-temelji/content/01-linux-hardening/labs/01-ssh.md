# Lab 1: Ojačaj SSH server

Dobio si server sa podrazumijevanom SSH konfiguracijom, a neko je usput dodao i jedan cloud-init fajl. Tvoj zadatak je da ga dovedeš na nivo CIS preporuka i da provjeriš **efektivnu** konfiguraciju, a ne samo ono što piše u glavnom fajlu.

Za uređivanje fajlova koristi `nano` (Ctrl+O snima, Ctrl+X izlazi) ili `vim`.

<!-- setup
set -e
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
grep -q '^PermitRootLogin' /etc/ssh/sshd_config || echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 6/' /etc/ssh/sshd_config
sed -i 's/^#\?X11Forwarding.*/X11Forwarding yes/' /etc/ssh/sshd_config
mkdir -p /etc/ssh/sshd_config.d /run/sshd
cat > /etc/ssh/sshd_config.d/50-cloud-init.conf <<'EOF'
# dodao cloud-init pri kreiranju instance
PasswordAuthentication yes
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Ojačaj SSH server ===
Konfiguracija: /etc/ssh/sshd_config i /etc/ssh/sshd_config.d/
Efektivne vrijednosti: sshd -T
EOF
-->

## Pogledaj trenutno stanje

Ispiši efektivne vrijednosti četiri ključne opcije:

```bash
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|x11forwarding|maxauthtries) '
```

Zatim pogledaj odakle dolaze:

```bash
grep -nE '^(Include|PermitRootLogin|PasswordAuthentication|X11Forwarding|MaxAuthTries)' /etc/ssh/sshd_config
ls -l /etc/ssh/sshd_config.d/
```

Primijeti da `Include` stoji na **vrhu** glavnog fajla. To će biti važno u trećem koraku.

## Zabrani root prijavu

U `/etc/ssh/sshd_config` postavi `PermitRootLogin no`.

```bash
nano /etc/ssh/sshd_config
```

Zatim provjeri efektivnu vrijednost sa `sshd -T | grep permitrootlogin`.

<!-- verify
sshd -T 2>&1 | grep -qx 'permitrootlogin no' || { echo "Efektivno: $(sshd -T 2>&1 | grep -i permitrootlogin)"; exit 1; }
-->
<!-- hint
Linija `PermitRootLogin yes` već postoji u glavnom fajlu. Promijeni `yes` u `no`, ne dodaj drugu liniju na kraj, jer za SSH opcije pobjeđuje **prva** pronađena vrijednost.
-->
<!-- solution
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
-->

## Isključi prijavu lozinkom

Postavi `PasswordAuthentication no` tako da **efektivna** vrijednost bude `no`. Pažljivo: nije dovoljno promijeniti samo glavni fajl.

<!-- verify
v=$(sshd -T 2>&1 | grep -i '^passwordauthentication')
[ "$v" = "passwordauthentication no" ] || { echo "Efektivno: $v"; echo "Pogledaj fajlove u /etc/ssh/sshd_config.d/"; exit 1; }
-->
<!-- hint
`/etc/ssh/sshd_config.d/50-cloud-init.conf` se učitava prije ostatka glavnog fajla i postavlja `PasswordAuthentication yes`. Prva vrijednost pobjeđuje. Promijeni je u tom fajlu na `no` (ili obriši fajl). Ovo je čest stvarni problem na cloud instancama.
-->
<!-- solution
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf
-->

## Ostale CIS postavke

Postavi:

- `MaxAuthTries 3`
- `X11Forwarding no`
- `KbdInteractiveAuthentication no`

Na kraju provjeri sintaksu. Ako `sshd -t` ništa ne ispiše, konfiguracija je ispravna.

```bash
sshd -t && echo "Sintaksa OK"
```

<!-- verify
sshd -t || exit 1
cfg=$(sshd -T 2>&1)
ok=1
echo "$cfg" | grep -qx 'maxauthtries 3' || { echo "maxauthtries: $(echo "$cfg" | grep ^maxauthtries)"; ok=0; }
echo "$cfg" | grep -qx 'x11forwarding no' || { echo "x11forwarding: $(echo "$cfg" | grep ^x11forwarding)"; ok=0; }
echo "$cfg" | grep -qx 'kbdinteractiveauthentication no' || { echo "kbdinteractiveauthentication: $(echo "$cfg" | grep ^kbdinteractiveauthentication)"; ok=0; }
[ $ok = 1 ]
-->
<!-- hint
`KbdInteractiveAuthentication` već postoji u glavnom fajlu, a `MaxAuthTries` i `X11Forwarding` su postavljeni na početku laba. Mijenjaj postojeće linije umjesto da dodaješ nove.
-->
<!-- solution
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/; s/^#\?X11Forwarding.*/X11Forwarding no/; s/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
-->

## Pokreni server i potvrdi da sluša

Pokreni SSH server sa novom konfiguracijom i provjeri da sluša na portu 22:

```bash
/usr/sbin/sshd
ss -tlnp | grep ':22 '
```

U stvarnom sistemu bi koristio `systemctl reload ssh`, uz otvorenu postojeću sesiju kao rezervu.

<!-- verify
ss -tln | grep -q ':22 ' || { echo "Ništa ne sluša na portu 22"; exit 1; }
-->
<!-- solution
/usr/sbin/sshd
-->
