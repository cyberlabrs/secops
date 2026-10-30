# Lab 1: Falco pravila nad snimcima sistemskih poziva

Falco pravila pišeš i testiraš bez živog sistema: Falco u **replay** modu čita snimak sistemskih poziva (`.scap`) i primjenjuje pravila kao da se događaji dešavaju uživo. U `/opt/kurs/falco-traces/` su zvanični testni snimci Falco projekta.

Pravila pišeš u `/root/falco/kurs_rules.yaml`. Pokreće ih:

```bash
falco-replay /opt/kurs/falco-traces/falco-event-generator.scap /root/falco/kurs_rules.yaml
falco-replay <snimak> <pravila> -o json_output=true | grep '^{' | jq -r '.rule'
```

Učitavaju se **samo** tvoja pravila, pa ugrađeni makroi (npr. `spawned_process`) ne postoje: definiši vlastite.

<!-- setup
set -e
mkdir -p /root/falco
ls /opt/kurs/falco-traces/ > /dev/null
-->

## Shell iz web servera

Web server koji pokreće shell klasičan je znak web shella (ATT&CK T1505.003). Napiši:

- makro `kurs_novi_proces`: novi proces (`evt.type in (execve, execveat) and evt.dir = <`),
- listu `kurs_web_serveri` (`httpd`, `nginx`, `apache2`) i listu `kurs_shellovi` (`sh`, `bash`, `dash`, `zsh`),
- pravilo `Shell iz web servera` (prioritet `WARNING`, tag `T1505.003`) čiji output sadrži ime procesa, komandnu liniju, roditelja i `container.id`.

Nad `falco-event-generator.scap` pravilo se mora okinuti tačno jednom.

<!-- verify
f=/root/falco/kurs_rules.yaml
[ -f $f ] || { echo "nema $f"; exit 1; }
falco --validate $f >/tmp/fv.txt 2>&1 || { tail -5 /tmp/fv.txt; echo "pravila ne prolaze validaciju (falco --validate)"; exit 1; }
cnt() { falco-replay /opt/kurs/falco-traces/$1.scap $f -o json_output=true | grep '^{' | jq -r --arg r "$2" 'select(.rule == $r) | .output' | wc -l; }
[ "$(cnt falco-event-generator 'Shell iz web servera')" = "1" ] || { echo "pravilo 'Shell iz web servera' se nad falco-event-generator.scap ne okida tačno jednom"; exit 1; }
o=$(falco-replay /opt/kurs/falco-traces/falco-event-generator.scap $f -o json_output=true | grep '^{' | jq -c 'select(.rule == "Shell iz web servera")')
echo "$o" | jq -e '.priority == "Warning"' >/dev/null || { echo "prioritet treba WARNING"; exit 1; }
echo "$o" | jq -e '.tags | index("T1505.003")' >/dev/null || { echo "nedostaje tag T1505.003"; exit 1; }
echo "$o" | jq -e '(.output | contains("httpd")) and (.output | contains("sh -c ls")) and (.output | contains("e12f2ad24aca"))' >/dev/null || { echo "output treba roditelja, komandnu liniju i container.id"; exit 1; }
grep -q 'spawned_process' $f && ! grep -q 'macro: spawned_process' $f && { echo "spawned_process nije definisan u tvom fajlu"; exit 1; }
exit 0
-->
<!-- hint
```yaml
- macro: kurs_novi_proces
  condition: evt.type in (execve, execveat) and evt.dir = <

- list: kurs_web_serveri
  items: [httpd, nginx, apache2]

- list: kurs_shellovi
  items: [sh, bash, dash, zsh]

- rule: Shell iz web servera
  desc: Web server je pokrenuo shell (moguć web shell)
  condition: kurs_novi_proces and proc.name in (kurs_shellovi) and proc.pname in (kurs_web_serveri)
  output: "Shell iz web servera (proc=%proc.name cmd=%proc.cmdline roditelj=%proc.pname kontejner=%container.id)"
  priority: WARNING
  tags: [T1505.003]
```
-->
<!-- solution
cat > /root/falco/kurs_rules.yaml <<'EOF'
- macro: kurs_novi_proces
  condition: evt.type in (execve, execveat) and evt.dir = <

- list: kurs_web_serveri
  items: [httpd, nginx, apache2]

- list: kurs_shellovi
  items: [sh, bash, dash, zsh]

- rule: Shell iz web servera
  desc: Web server je pokrenuo shell (moguć web shell)
  condition: kurs_novi_proces and proc.name in (kurs_shellovi) and proc.pname in (kurs_web_serveri)
  output: "Shell iz web servera (proc=%proc.name cmd=%proc.cmdline roditelj=%proc.pname kontejner=%container.id)"
  priority: WARNING
  tags: [T1505.003]
EOF
-->

## Proces iz baze podataka

Baza podataka ne bi trebala pokretati druge programe. Dodaj listu `kurs_baze` (`mysqld`, `postgres`, `mongod`) i pravilo `Proces iz baze podataka` (prioritet `WARNING`) koje se okida kad je roditelj novog procesa baza. Nad `falco-event-generator.scap` mora se okinuti tačno jednom, a prethodno pravilo i dalje tačno jednom.

<!-- verify
f=/root/falco/kurs_rules.yaml
falco --validate $f >/dev/null 2>&1 || { echo "pravila ne prolaze validaciju"; exit 1; }
grep -Eq '^- list: kurs_baze' $f || { echo "nema liste kurs_baze"; exit 1; }
out=$(falco-replay /opt/kurs/falco-traces/falco-event-generator.scap $f -o json_output=true | grep '^{')
[ "$(echo "$out" | jq -r 'select(.rule == "Proces iz baze podataka") | .rule' | wc -l)" = "1" ] || { echo "'Proces iz baze podataka' se ne okida tačno jednom"; exit 1; }
[ "$(echo "$out" | jq -r 'select(.rule == "Shell iz web servera") | .rule' | wc -l)" = "1" ] || { echo "'Shell iz web servera' se više ne okida tačno jednom"; exit 1; }
echo "$out" | jq -s -e 'map(select(.rule == "Proces iz baze podataka")) | .[0].output | contains("mysqld")' >/dev/null || { echo "output treba roditelja (mysqld)"; exit 1; }
-->
<!-- hint
```yaml
- list: kurs_baze
  items: [mysqld, postgres, mongod]

- rule: Proces iz baze podataka
  desc: Baza podataka je pokrenula novi proces
  condition: kurs_novi_proces and proc.pname in (kurs_baze)
  output: "Baza pokrenula proces (proc=%proc.name cmd=%proc.cmdline roditelj=%proc.pname kontejner=%container.id)"
  priority: WARNING
```
-->
<!-- solution
cat >> /root/falco/kurs_rules.yaml <<'EOF'

- list: kurs_baze
  items: [mysqld, postgres, mongod]

- rule: Proces iz baze podataka
  desc: Baza podataka je pokrenula novi proces
  condition: kurs_novi_proces and proc.pname in (kurs_baze)
  output: "Baza pokrenula proces (proc=%proc.name cmd=%proc.cmdline roditelj=%proc.pname kontejner=%container.id)"
  priority: WARNING
EOF
-->

## Izuzetak umjesto lažnih pozitiva

Alati za upravljanje korisnicima (`useradd`, `adduser`, `usermod`, `userdel`, `passwd`, `vipw`, `chpasswd`) u kontejneru nemaju šta da traže, ali na hostovima ih legitimno pokreće Ansible.

Napiši pravilo `Upravljanje korisnicima u kontejneru` (prioritet `NOTICE`) koje se okida za te alate, sa **izuzetkom** (`exceptions`, polje `container.id`, vrijednost `host`) za procese na hostu. Ne stavljaj to u `condition`: izuzeci su čitljiviji i lakše se dopunjuju.

Očekivano: na `falco-event-generator.scap` (kontejner) jedan alarm, na `user-mgmt-binaries.scap` (host) nijedan.

<!-- verify
f=/root/falco/kurs_rules.yaml
falco --validate $f >/dev/null 2>&1 || { echo "pravila ne prolaze validaciju"; exit 1; }
r='Upravljanje korisnicima u kontejneru'
yq -e ".[] | select(.rule == \"$r\") | .exceptions[] | select(.fields | contains([\"container.id\"]))" $f >/dev/null 2>&1 || { echo "pravilo nema exceptions sa poljem container.id"; exit 1; }
yq ".[] | select(.rule == \"$r\") | .condition" $f | grep -q 'host' && { echo "host izuzetak ne stavljaj u condition, nego u exceptions"; exit 1; }
a=$(falco-replay /opt/kurs/falco-traces/falco-event-generator.scap $f -o json_output=true | grep '^{' | jq -r --arg r "$r" 'select(.rule == $r) | .rule' | wc -l)
b=$(falco-replay /opt/kurs/falco-traces/user-mgmt-binaries.scap $f -o json_output=true | grep '^{' | jq -r --arg r "$r" 'select(.rule == $r) | .rule' | wc -l)
[ "$a" = "1" ] || { echo "u kontejneru (falco-event-generator.scap) očekivan 1 alarm, ima $a"; exit 1; }
[ "$b" = "0" ] || { echo "na hostu (user-mgmt-binaries.scap) ne smije biti alarma, ima $b"; exit 1; }
cp $f /tmp/bez.yaml; yq -i "(.[] | select(.rule == \"$r\")) |= del(.exceptions)" /tmp/bez.yaml
c=$(falco-replay /opt/kurs/falco-traces/user-mgmt-binaries.scap /tmp/bez.yaml -o json_output=true | grep '^{' | jq -r --arg r "$r" 'select(.rule == $r) | .rule' | wc -l)
[ "$c" -ge 1 ] || { echo "bez izuzetka pravilo ne vidi adduser na hostu: provjeri listu alata"; exit 1; }
-->
<!-- hint
```yaml
- list: kurs_upravljanje_korisnicima
  items: [useradd, adduser, usermod, userdel, passwd, vipw, chpasswd]

- rule: Upravljanje korisnicima u kontejneru
  desc: Alat za upravljanje korisnicima pokrenut u kontejneru
  condition: kurs_novi_proces and proc.name in (kurs_upravljanje_korisnicima)
  exceptions:
    - name: hostovi_ansible
      fields: [container.id]
      values:
        - [host]
  output: "Upravljanje korisnicima (proc=%proc.name cmd=%proc.cmdline kontejner=%container.id)"
  priority: NOTICE
```
-->
<!-- solution
cat >> /root/falco/kurs_rules.yaml <<'EOF'

- list: kurs_upravljanje_korisnicima
  items: [useradd, adduser, usermod, userdel, passwd, vipw, chpasswd]

- rule: Upravljanje korisnicima u kontejneru
  desc: Alat za upravljanje korisnicima pokrenut u kontejneru
  condition: kurs_novi_proces and proc.name in (kurs_upravljanje_korisnicima)
  exceptions:
    - name: hostovi_ansible
      fields: [container.id]
      values:
        - [host]
  output: "Upravljanje korisnicima (proc=%proc.name cmd=%proc.cmdline kontejner=%container.id)"
  priority: NOTICE
EOF
-->
