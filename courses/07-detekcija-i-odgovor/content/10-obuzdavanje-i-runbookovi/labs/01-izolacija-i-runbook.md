# Lab 1: Mrežna izolacija hosta i runbook

Kad je server kompromitovan, gašenje briše dokaze iz memorije, a ostavljanje na mreži daje napadaču vrijeme. Srednji put je **mrežna izolacija**: server radi, ali razgovara samo sa administratorskom mrežom za istragu. Napisaćeš skriptu za izolaciju koja se može i poništiti, i runbook za najčešći cloud incident.

Administratorska mreža je `10.0.5.0/24`, SSH na portu 22.

```bash
iptables -S
iptables-save > /tmp/prije.rules
```

<!-- setup
set -e
mkdir -p /root/ir /root/runbook
iptables -P INPUT ACCEPT; iptables -P OUTPUT ACCEPT; iptables -F
-->

## Skripta za izolaciju

Napiši izvršivu `/root/ir/izoluj.sh`:

- `izoluj.sh` (bez argumenata): sačuva trenutna pravila u `/root/ir/prije-izolacije.rules` (`iptables-save`), pa postavi:
  - podrazumijevanu politiku `DROP` za `INPUT` i `OUTPUT`,
  - dozvoljen sav saobraćaj na loopbacku (`lo`),
  - dozvoljene već uspostavljene veze (`conntrack --ctstate ESTABLISHED,RELATED`) u oba smjera,
  - dozvoljen dolazni SSH (tcp 22) samo iz `10.0.5.0/24`;
- `izoluj.sh --vrati`: vrati pravila iz `/root/ir/prije-izolacije.rules` (`iptables-restore`).

Provjeri oba smjera, pa ostavi host **neizolovan**.

<!-- verify
s=/root/ir/izoluj.sh
[ -x $s ] || { echo "$s ne postoji ili nije izvršiv"; exit 1; }
iptables -P INPUT ACCEPT; iptables -P OUTPUT ACCEPT; iptables -F; iptables -A INPUT -s 198.51.100.7/32 -j DROP
pre=$(iptables -S | sort)
$s >/dev/null 2>&1 || { echo "izoluj.sh vraća grešku"; exit 1; }
r=$(iptables -S)
echo "$r" | grep -qx -- '-P INPUT DROP' && echo "$r" | grep -qx -- '-P OUTPUT DROP' || { echo "politika INPUT i OUTPUT treba biti DROP"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -q -- '-A INPUT -i lo -j ACCEPT' && echo "$r" | grep -q -- '-A OUTPUT -o lo -j ACCEPT' || { echo "loopback nije dozvoljen u oba smjera"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -q -- '-A INPUT .*--ctstate RELATED,ESTABLISHED -j ACCEPT' && echo "$r" | grep -q -- '-A OUTPUT .*--ctstate RELATED,ESTABLISHED -j ACCEPT' || { echo "uspostavljene veze nisu dozvoljene u oba smjera"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -q -- '-A INPUT -s 10.0.5.0/24 -p tcp -m tcp --dport 22 -j ACCEPT' || { echo "nema pravila za SSH iz 10.0.5.0/24"; $s --vrati >/dev/null 2>&1; exit 1; }
echo "$r" | grep -E -- '--dport 22 -j ACCEPT' | grep -vq -- '-s 10.0.5.0/24' && { echo "SSH je dozvoljen i van 10.0.5.0/24"; $s --vrati >/dev/null 2>&1; exit 1; }
grep -q '198.51.100.7' /root/ir/prije-izolacije.rules 2>/dev/null || { echo "prethodna pravila nisu sačuvana u /root/ir/prije-izolacije.rules"; $s --vrati >/dev/null 2>&1; exit 1; }
$s --vrati >/dev/null 2>&1 || { echo "izoluj.sh --vrati vraća grešku"; exit 1; }
[ "$(iptables -S | sort)" = "$pre" ] || { echo "--vrati ne vraća tačno prethodna pravila"; exit 1; }
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
Politiku na `DROP` postavi **na kraju**, nakon pravila koja dozvoljavaju tvoju SSH vezu; inače u stvarnom svijetu odsiječeš i sebe. Na cloud VM-u isti efekat daje karantinska security grupa (na nivou mreže, van kontrole napadača na hostu).
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

## Runbook: procurjeli AWS pristupni ključ

Napiši `/root/runbook/procurjeli-aws-kljuc.md`. Runbook je za dežurnog u 3 ujutro: konkretni koraci i komande, ne teorija. Mora imati sekcije (`##`) ovim redom:

1. `## Okidač` (šta pokreće runbook: npr. GitHub/GitLab secret scanning, AWS Health „exposed credentials“, GuardDuty),
2. `## Trijaža`,
3. `## Obuzdavanje` (sa komandom koja deaktivira ključ: `aws iam update-access-key … --status Inactive`),
4. `## Istraga` (CloudTrail upit po `AccessKeyId`, provjera novih IAM korisnika, ključeva i politika),
5. `## Iskorjenjivanje`,
6. `## Oporavak`,
7. `## Komunikacija` (ko se obavještava i kada),
8. `## Nakon incidenta`.

Svaka sekcija treba barem jednu stavku liste (`-` ili `1.`).

<!-- verify
f=/root/runbook/procurjeli-aws-kljuc.md
[ -s $f ] || { echo "nema $f"; exit 1; }
got=$(grep -E '^## ' $f | sed 's/^## *//; s/ *$//' | tr '\n' '|')
want='Okidač|Trijaža|Obuzdavanje|Istraga|Iskorjenjivanje|Oporavak|Komunikacija|Nakon incidenta|'
[ "$got" = "$want" ] || { echo "sekcije nisu tačne ili nisu ovim redom (ima: $got)"; exit 1; }
python3 - "$f" <<'EOF' || exit 1
import re, sys
s = open(sys.argv[1]).read()
parts = re.split(r"^## .*$", s, flags=re.M)[1:]
names = re.findall(r"^## (.*)$", s, flags=re.M)
for n, body in zip(names, parts):
    if not re.search(r"^\s*(-|\d+\.)\s+\S", body, re.M):
        sys.exit(f"sekcija '{n.strip()}' nema nijednu stavku liste")
EOF
sed -n '/^## Obuzdavanje/,/^## /p' $f | grep -q 'update-access-key' && sed -n '/^## Obuzdavanje/,/^## /p' $f | grep -q 'Inactive' || { echo "Obuzdavanje treba aws iam update-access-key ... --status Inactive"; exit 1; }
sed -n '/^## Istraga/,/^## /p' $f | grep -qi 'cloudtrail' && sed -n '/^## Istraga/,/^## /p' $f | grep -q 'AccessKeyId\|accessKeyId\|access-key-id' || { echo "Istraga treba CloudTrail pretragu po AccessKeyId"; exit 1; }
-->
<!-- hint
Koristi primjer runbooka iz lekcije ovog modula kao polaznu tačku i prilagodi ga svom okruženju (imena timova, kanali za obavještavanje, nalozi).
```bash
aws iam update-access-key --user-name <korisnik> --access-key-id <AKIA…> --status Inactive
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
