# Lab 1: Falco rules against system call captures

You write and test Falco rules without a live system: in **replay** mode Falco reads a capture of system calls (`.scap`) and applies the rules as if the events were happening live. `/opt/kurs/falco-traces/` contains the official test captures of the Falco project.

You write the rules in `/root/falco/kurs_rules.yaml`. Run them with:

```bash
falco-replay /opt/kurs/falco-traces/falco-event-generator.scap /root/falco/kurs_rules.yaml
falco-replay <capture> <rules> -o json_output=true | grep '^{' | jq -r '.rule'
```

**Only** your rules are loaded, so the built-in macros (e.g. `spawned_process`) do not exist: define your own.

The rule, macro and list names in this lab are in Serbian and must be used exactly as given, because the checks look for them: `Shell iz web servera` = shell from web server, `Proces iz baze podataka` = process from database, `Upravljanje korisnicima u kontejneru` = user management in container, `kurs_novi_proces` = new process, `kurs_web_serveri` = web servers, `kurs_shellovi` = shells, `kurs_baze` = databases.

<!-- setup
set -e
mkdir -p /root/falco
ls /opt/kurs/falco-traces/ > /dev/null
-->

## Shell from a web server

A web server that spawns a shell is a classic sign of a web shell (ATT&CK T1505.003). Write:

- a macro `kurs_novi_proces`: a new process (`evt.type in (execve, execveat) and evt.dir = <`),
- a list `kurs_web_serveri` (`httpd`, `nginx`, `apache2`) and a list `kurs_shellovi` (`sh`, `bash`, `dash`, `zsh`),
- a rule `Shell iz web servera` (priority `WARNING`, tag `T1505.003`) whose output contains the process name, the command line, the parent and `container.id`.

Against `falco-event-generator.scap` the rule must fire exactly once.

<!-- verify
f=/root/falco/kurs_rules.yaml
[ -f $f ] || { echo "$f does not exist"; exit 1; }
falco --validate $f >/tmp/fv.txt 2>&1 || { tail -5 /tmp/fv.txt; echo "the rules fail validation (falco --validate)"; exit 1; }
cnt() { falco-replay /opt/kurs/falco-traces/$1.scap $f -o json_output=true | grep '^{' | jq -r --arg r "$2" 'select(.rule == $r) | .output' | wc -l; }
[ "$(cnt falco-event-generator 'Shell iz web servera')" = "1" ] || { echo "the rule 'Shell iz web servera' does not fire exactly once against falco-event-generator.scap"; exit 1; }
o=$(falco-replay /opt/kurs/falco-traces/falco-event-generator.scap $f -o json_output=true | grep '^{' | jq -c 'select(.rule == "Shell iz web servera")')
echo "$o" | jq -e '.priority == "Warning"' >/dev/null || { echo "the priority should be WARNING"; exit 1; }
echo "$o" | jq -e '.tags | index("T1505.003")' >/dev/null || { echo "the T1505.003 tag is missing"; exit 1; }
echo "$o" | jq -e '(.output | contains("httpd")) and (.output | contains("sh -c ls")) and (.output | contains("e12f2ad24aca"))' >/dev/null || { echo "the output needs the parent, the command line and container.id"; exit 1; }
grep -q 'spawned_process' $f && ! grep -q 'macro: spawned_process' $f && { echo "spawned_process is not defined in your file"; exit 1; }
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

## Process from a database

A database should not spawn other programs. Add a list `kurs_baze` (`mysqld`, `postgres`, `mongod`) and a rule `Proces iz baze podataka` (priority `WARNING`) that fires when the parent of a new process is a database. Against `falco-event-generator.scap` it must fire exactly once, and the previous rule must still fire exactly once.

<!-- verify
f=/root/falco/kurs_rules.yaml
falco --validate $f >/dev/null 2>&1 || { echo "the rules fail validation"; exit 1; }
grep -Eq '^- list: kurs_baze' $f || { echo "the kurs_baze list is missing"; exit 1; }
out=$(falco-replay /opt/kurs/falco-traces/falco-event-generator.scap $f -o json_output=true | grep '^{')
[ "$(echo "$out" | jq -r 'select(.rule == "Proces iz baze podataka") | .rule' | wc -l)" = "1" ] || { echo "'Proces iz baze podataka' does not fire exactly once"; exit 1; }
[ "$(echo "$out" | jq -r 'select(.rule == "Shell iz web servera") | .rule' | wc -l)" = "1" ] || { echo "'Shell iz web servera' no longer fires exactly once"; exit 1; }
echo "$out" | jq -s -e 'map(select(.rule == "Proces iz baze podataka")) | .[0].output | contains("mysqld")' >/dev/null || { echo "the output needs the parent (mysqld)"; exit 1; }
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

## An exception instead of false positives

User management tools (`useradd`, `adduser`, `usermod`, `userdel`, `passwd`, `vipw`, `chpasswd`) have no business running in a container, but on hosts they are legitimately run by Ansible.

Write a rule `Upravljanje korisnicima u kontejneru` (priority `NOTICE`) that fires for these tools, with an **exception** (`exceptions`, field `container.id`, value `host`) for processes on the host. Don't put this in the `condition`: exceptions are more readable and easier to extend.

Expected: one alert on `falco-event-generator.scap` (container), none on `user-mgmt-binaries.scap` (host).

<!-- verify
f=/root/falco/kurs_rules.yaml
falco --validate $f >/dev/null 2>&1 || { echo "the rules fail validation"; exit 1; }
r='Upravljanje korisnicima u kontejneru'
yq -e ".[] | select(.rule == \"$r\") | .exceptions[] | select(.fields | contains([\"container.id\"]))" $f >/dev/null 2>&1 || { echo "the rule has no exceptions with the container.id field"; exit 1; }
yq ".[] | select(.rule == \"$r\") | .condition" $f | grep -q 'host' && { echo "don't put the host exception in condition, put it in exceptions"; exit 1; }
a=$(falco-replay /opt/kurs/falco-traces/falco-event-generator.scap $f -o json_output=true | grep '^{' | jq -r --arg r "$r" 'select(.rule == $r) | .rule' | wc -l)
b=$(falco-replay /opt/kurs/falco-traces/user-mgmt-binaries.scap $f -o json_output=true | grep '^{' | jq -r --arg r "$r" 'select(.rule == $r) | .rule' | wc -l)
[ "$a" = "1" ] || { echo "in the container (falco-event-generator.scap) 1 alert expected, got $a"; exit 1; }
[ "$b" = "0" ] || { echo "on the host (user-mgmt-binaries.scap) there must be no alerts, got $b"; exit 1; }
cp $f /tmp/bez.yaml; yq -i "(.[] | select(.rule == \"$r\")) |= del(.exceptions)" /tmp/bez.yaml
c=$(falco-replay /opt/kurs/falco-traces/user-mgmt-binaries.scap /tmp/bez.yaml -o json_output=true | grep '^{' | jq -r --arg r "$r" 'select(.rule == $r) | .rule' | wc -l)
[ "$c" -ge 1 ] || { echo "without the exception the rule does not see adduser on the host: check the list of tools"; exit 1; }
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
