# Lab 1: Host network isolation and a runbook

When a server is compromised, shutting it down destroys the evidence in memory, while leaving it on the network gives the attacker time. The middle ground is **network isolation**: the server keeps running, but talks only to the administrative network used for the investigation. You will write an isolation script that can also be reversed, and a runbook for the most common cloud incident.

The administrative network is `10.0.5.0/24`, SSH on port 22. File names, the `--vrati` (restore) option and the runbook section headings in this lab are in Serbian and must be used exactly as given.

```bash
iptables -S
iptables-save > /tmp/prije.rules
```

<!-- setup
set -e
mkdir -p /root/ir /root/runbook
iptables -P INPUT ACCEPT; iptables -P OUTPUT ACCEPT; iptables -F
-->

## Isolation script

Write an executable `/root/ir/izoluj.sh` ("isolate"):

- `izoluj.sh` (no arguments): saves the current rules to `/root/ir/prije-izolacije.rules` (`iptables-save`), then sets:
  - a default `DROP` policy for `INPUT` and `OUTPUT`,
  - all traffic allowed on loopback (`lo`),
  - already established connections (`conntrack --ctstate ESTABLISHED,RELATED`) allowed in both directions,
  - inbound SSH (tcp 22) allowed only from `10.0.5.0/24`;
- `izoluj.sh --vrati`: restores the rules from `/root/ir/prije-izolacije.rules` (`iptables-restore`).

Test both directions, then leave the host **not isolated**.

<!-- verify
s=/root/ir/izoluj.sh
[ -x $s ] || { echo "$s does not exist or is not executable"; exit 1; }
iptables -P INPUT ACCEPT; iptables -P OUTPUT ACCEPT; iptables -F; iptables -A INPUT -s 198.51.100.7/32 -j DROP
pre=$(iptables -S | sort)
$s >/dev/null 2>&1 || { echo "izoluj.sh returns an error"; exit 1; }
r=$(iptables -S)
echo "$r" | grep -qx -- '-P INPUT DROP' && echo "$r" | grep -qx -- '-P OUTPUT DROP' || { echo "the INPUT and OUTPUT policy must be DROP"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -q -- '-A INPUT -i lo -j ACCEPT' && echo "$r" | grep -q -- '-A OUTPUT -o lo -j ACCEPT' || { echo "loopback is not allowed in both directions"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -q -- '-A INPUT .*--ctstate RELATED,ESTABLISHED -j ACCEPT' && echo "$r" | grep -q -- '-A OUTPUT .*--ctstate RELATED,ESTABLISHED -j ACCEPT' || { echo "established connections are not allowed in both directions"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -q -- '-A INPUT -s 10.0.5.0/24 -p tcp -m tcp --dport 22 -j ACCEPT' || { echo "no rule for SSH from 10.0.5.0/24"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -E -- '--dport 22 -j ACCEPT' | grep -vq -- '-s 10.0.5.0/24' && { echo "SSH is also allowed from outside 10.0.5.0/24"; $s --vrati >/dev/null 2>&1; exit 1; }
grep -q '198.51.100.7' /root/ir/prije-izolacije.rules 2>/dev/null || { echo "the previous rules were not saved to /root/ir/prije-izolacije.rules"; $s --vrati >/dev/null 2>&1; exit 1; }
$s --vrati >/dev/null 2>&1 || { echo "izoluj.sh --vrati returns an error"; exit 1; }
[ "$(iptables -S | sort)" = "$pre" ] || { echo "--vrati does not restore exactly the previous rules"; exit 1; }
iptables -F; iptables -P INPUT ACCEPT; iptables -P OUTPUT ACCEPT
-->
<!-- hint
```bash
#!/bin/bash
set -euo pipefail
S=/root/ir/prije-izolacije.rules
if [ "${1:-}" = "--vrati" ]; then iptables-restore < "$S"; exit 0; fi
iptables-save > "$S"
iptables -F
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
...
iptables -P INPUT DROP
iptables -P OUTPUT DROP
```
Set the policy to `DROP` **at the end**, after the rules that allow your SSH connection; otherwise, in the real world, you cut yourself off too. On a cloud VM, a quarantine security group has the same effect (at the network level, outside the attacker's control on the host).
-->
<!-- solution
cat > /root/ir/izoluj.sh <<'EOF'
#!/bin/bash
# Mrežna izolacija hosta: ostaje samo SSH iz administratorske mreže. --vrati poništava.
set -euo pipefail
S=/root/ir/prije-izolacije.rules
if [ "${1:-}" = "--vrati" ]; then iptables-restore < "$S"; exit 0; fi
iptables-save > "$S"
iptables -F
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -s 10.0.5.0/24 -p tcp --dport 22 -j ACCEPT
iptables -P INPUT DROP
iptables -P OUTPUT DROP
EOF
chmod +x /root/ir/izoluj.sh
-->

## Runbook: leaked AWS access key

Write `/root/runbook/procurjeli-aws-kljuc.md` ("leaked AWS key"). The runbook is for the on-call engineer at 3 a.m.: concrete steps and commands, not theory. It must have these sections (`##`), with exactly these Serbian headings, in this order:

1. `## Okidač` (Trigger: what starts the runbook, e.g. GitHub/GitLab secret scanning, AWS Health "exposed credentials", GuardDuty),
2. `## Trijaža` (Triage),
3. `## Obuzdavanje` (Containment, with the command that deactivates the key: `aws iam update-access-key … --status Inactive`),
4. `## Istraga` (Investigation: a CloudTrail query by `AccessKeyId`, checking for new IAM users, keys and policies),
5. `## Iskorjenjivanje` (Eradication),
6. `## Oporavak` (Recovery),
7. `## Komunikacija` (Communication: who is notified and when),
8. `## Nakon incidenta` (Post-incident).

Each section needs at least one list item (`-` or `1.`). The content of the sections may be in English.

<!-- verify
f=/root/runbook/procurjeli-aws-kljuc.md
[ -s $f ] || { echo "$f is missing"; exit 1; }
got=$(grep -E '^## ' $f | sed 's/^## *//; s/ *$//' | tr '\n' '|')
want='Okidač|Trijaža|Obuzdavanje|Istraga|Iskorjenjivanje|Oporavak|Komunikacija|Nakon incidenta|'
[ "$got" = "$want" ] || { echo "the sections are wrong or not in this order (found: $got)"; exit 1; }
python3 - "$f" <<'EOF' || exit 1
import re, sys
s = open(sys.argv[1]).read()
parts = re.split(r"^## .*$", s, flags=re.M)[1:]
names = re.findall(r"^## (.*)$", s, flags=re.M)
for n, body in zip(names, parts):
    if not re.search(r"^\s*(-|\d+\.)\s+\S", body, re.M):
        sys.exit(f"section '{n.strip()}' has no list items")
EOF
sed -n '/^## Obuzdavanje/,/^## /p' $f | grep -q 'update-access-key' && sed -n '/^## Obuzdavanje/,/^## /p' $f | grep -q 'Inactive' || { echo "Obuzdavanje (Containment) needs aws iam update-access-key ... --status Inactive"; exit 1; }
sed -n '/^## Istraga/,/^## /p' $f | grep -qi 'cloudtrail' && sed -n '/^## Istraga/,/^## /p' $f | grep -q 'AccessKeyId\|accessKeyId\|access-key-id' || { echo "Istraga (Investigation) needs a CloudTrail search by AccessKeyId"; exit 1; }
-->
<!-- hint
Use the runbook example from this module's lesson as a starting point and adapt it to your environment (team names, notification channels, accounts).
```bash
aws iam update-access-key --user-name <user> --access-key-id <AKIA…> --status Inactive
aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=<AKIA…>
```
-->
<!-- solution
sed 's/^@@ /## /' > /root/runbook/procurjeli-aws-kljuc.md <<'EOF'
# Runbook: procurjeli AWS pristupni ključ

@@ Okidač
- Secret scanning (GitHub/GitLab) prijavi AWS ključ u repou ili logu
- AWS Health / Trusted Advisor događaj „exposed access key“ ili GuardDuty nalaz za neobičnu upotrebu ključa

@@ Trijaža
- Utvrdi vlasnika ključa: `aws iam get-access-key-last-used --access-key-id <AKIA…>`
- Ključ je produkcijski ili ima administratorska prava: incident visokog prioriteta, obavijesti incident commandera

@@ Obuzdavanje
1. Deaktiviraj ključ: `aws iam update-access-key --user-name <korisnik> --access-key-id <AKIA…> --status Inactive`
2. Ako je ključ korišten van poznatih IP adresa: opozovi aktivne sesije role/korisnika i dodaj deny politiku

@@ Istraga
- CloudTrail: `aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=<AKIA…>`
- Provjeri nove IAM korisnike, ključeve, politike i role kreirane u periodu upotrebe ključa
- Provjeri pristup podacima (S3 data events) i nove resurse (EC2, Lambda) u svim regionima

@@ Iskorjenjivanje
- Obriši kompromitovani ključ i sve resurse/kredencijale koje je napadač napravio
- Ukloni tajnu iz koda i istorije repoa; zamijeni statični ključ OIDC federacijom gdje je moguće

@@ Oporavak
- Izdaj novi ključ (ili rolu) vlasniku i ažuriraj tajnu u secret manageru
- Prati CloudTrail i GuardDuty za taj nalog narednih 7 dana

@@ Komunikacija
- Odmah: incident commander i vlasnik servisa (kanal #incident)
- U roku od 24h: menadžment i, ako su pogođeni lični podaci, DPO (rokovi iz GDPR-a i NIS2)

@@ Nakon incidenta
- Blameless analiza u roku od 5 radnih dana: uzrok, vremenska linija, MTTD i MTTR
- Akcije: secret scanning na pre-commit, zabrana dugotrajnih ključeva, alarm na upotrebu ključa sa nepoznatih IP
EOF
-->
