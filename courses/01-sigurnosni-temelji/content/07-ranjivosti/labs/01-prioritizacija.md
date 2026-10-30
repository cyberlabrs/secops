# Lab 1: Od izvještaja skenera do liste za danas

Skener je vratio nalaze za flotu servera u `/root/vm/nalazi.json`, obogaćene EPSS ocjenama i KEV oznakom. Primijenićeš pravila prioritizacije iz lekcije pomoću `jq`, pa napraviti inventar paketa (mini SBOM) za ovaj server.

ID-jevi su izmišljeni (`CVE-LAB-…`) da se ne bi miješali sa stvarnim ranjivostima.

| Prioritet | Uslov |
|---|---|
| **P1** | `kev == true`, **ili** (`epss >= 0.1` **i** `internet == true`) |
| **P2** | nije P1, `cvss >= 7` **i** (`internet == true` **ili** `epss >= 0.01`) |
| **P3** | nije P1 ni P2, `cvss >= 7` |
| **P4** | sve ostalo |

<!-- setup
set -e
mkdir -p /root/vm
cat > /root/vm/nalazi.json <<'EOF'
[
 {"id":"CVE-LAB-0001","pkg":"openssl","host":"web-01","cvss":9.8,"epss":0.002,"kev":false,"internet":false},
 {"id":"CVE-LAB-0002","pkg":"vpn-firmware","host":"vpn-gw","cvss":7.5,"epss":0.94,"kev":true,"internet":true},
 {"id":"CVE-LAB-0003","pkg":"nginx","host":"web-01","cvss":6.1,"epss":0.12,"kev":false,"internet":true},
 {"id":"CVE-LAB-0004","pkg":"log-lib","host":"app-02","cvss":10.0,"epss":0.97,"kev":true,"internet":false},
 {"id":"CVE-LAB-0005","pkg":"sudo","host":"db-01","cvss":7.8,"epss":0.0004,"kev":false,"internet":false},
 {"id":"CVE-LAB-0006","pkg":"curl","host":"web-02","cvss":8.1,"epss":0.03,"kev":false,"internet":true},
 {"id":"CVE-LAB-0007","pkg":"linux-kernel","host":"db-01","cvss":7.0,"epss":0.015,"kev":false,"internet":false},
 {"id":"CVE-LAB-0008","pkg":"libxml2","host":"app-02","cvss":5.3,"epss":0.0009,"kev":false,"internet":false},
 {"id":"CVE-LAB-0009","pkg":"tomcat","host":"web-02","cvss":9.1,"epss":0.45,"kev":false,"internet":true},
 {"id":"CVE-LAB-0010","pkg":"zlib","host":"app-01","cvss":4.4,"epss":0.2,"kev":false,"internet":false},
 {"id":"CVE-LAB-0011","pkg":"openssh","host":"bastion","cvss":8.1,"epss":0.08,"kev":false,"internet":true},
 {"id":"CVE-LAB-0012","pkg":"git","host":"ci-runner","cvss":7.3,"epss":0.005,"kev":false,"internet":false}
]
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Prioritizacija ranjivosti ===
Podaci: /root/vm/nalazi.json   Alat: jq
EOF
-->

## Upoznaj podatke

```bash
cd /root/vm
jq length nalazi.json
jq -r '.[] | [.id, .host, .cvss, .epss, .kev, .internet] | @tsv' nalazi.json | column -t
```

Sortiraj po CVSS-u, pa po EPSS-u, i uporedi koji nalazi su na vrhu u svakom slučaju:

```bash
jq -r 'sort_by(-.cvss) | .[:4][] | "\(.id) cvss=\(.cvss) epss=\(.epss)"' nalazi.json
jq -r 'sort_by(-.epss) | .[:4][] | "\(.id) cvss=\(.cvss) epss=\(.epss)"' nalazi.json
```

Primijeti `CVE-LAB-0001`: CVSS 9.8, a vjerovatnoća napada vrlo niska, na internom sistemu.

## P1: krpi odmah

Napiši `jq` filter za P1 i upiši ID-jeve u `/root/vm/p1.txt`, jedan po liniji:

```bash
jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .id' nalazi.json > p1.txt
cat p1.txt
```

Pogledaj `CVE-LAB-0003`: CVSS je samo 6.1 (Medium), ali je na internetu i ima visok EPSS, pa ide u P1.

<!-- verify
want="CVE-LAB-0002 CVE-LAB-0003 CVE-LAB-0004 CVE-LAB-0009"
got=$(sort -u /root/vm/p1.txt 2>/dev/null | grep . | xargs)
[ "$got" = "$want" ] || { echo "Dobijeno: $got"; exit 1; }
-->
<!-- solution
cd /root/vm && jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .id' nalazi.json > p1.txt
-->

## P2: ovaj mjesec

P2 su nalazi koji **nisu** P1, imaju `cvss >= 7` i (`internet == true` ili `epss >= 0.01`). Upiši ID-jeve u `/root/vm/p2.txt`.

<!-- verify
want="CVE-LAB-0006 CVE-LAB-0007 CVE-LAB-0011"
got=$(sort -u /root/vm/p2.txt 2>/dev/null | grep . | xargs)
[ "$got" = "$want" ] || { echo "Dobijeno: $got"; exit 1; }
-->
<!-- hint
```bash
jq -r '.[] | select((.kev == true or (.epss >= 0.1 and .internet == true)) | not)
             | select(.cvss >= 7 and (.internet == true or .epss >= 0.01)) | .id' nalazi.json > p2.txt
```
-->
<!-- solution
cd /root/vm && jq -r '.[] | select((.kev == true or (.epss >= 0.1 and .internet == true)) | not) | select(.cvss >= 7 and (.internet == true or .epss >= 0.01)) | .id' nalazi.json > p2.txt
-->

## Izvještaj po hostu

Menadžer pita: „Koji hostovi imaju P1 nalaze?“ Napravi `/root/vm/hostovi-p1.txt` sa jedinstvenim imenima hostova, sortiranim abecedno.

```bash
jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .host' nalazi.json | sort -u > hostovi-p1.txt
```

<!-- verify
want="app-02 vpn-gw web-01 web-02"
got=$(grep . /root/vm/hostovi-p1.txt 2>/dev/null | xargs)
[ "$got" = "$want" ] || { echo "Dobijeno: $got (očekuje se sortirano i bez duplikata)"; exit 1; }
-->
<!-- solution
cd /root/vm && jq -r '.[] | select(.kev == true or (.epss >= 0.1 and .internet == true)) | .host' nalazi.json | sort -u > hostovi-p1.txt
-->

## Mini SBOM ovog servera

Pravi SBOM se pravi alatom kao Syft ili Trivy u CycloneDX ili SPDX formatu. Princip možeš vidjeti i sa paket-menadžerom: napravi `/root/vm/sbom.csv` sa svim instaliranim paketima u formatu `paket,verzija`.

```bash
dpkg-query -W -f='${Package},${Version}\n' | sort > /root/vm/sbom.csv
wc -l /root/vm/sbom.csv
grep '^openssl,' /root/vm/sbom.csv
```

Sad kad izađe CVE za `openssl`, odgovor na pitanje „imamo li ranjivu verziju?“ je jedna grep komanda. Na nivou firme to radi alat kao OWASP Dependency-Track nad SBOM-ovima svih servisa.

<!-- verify
f=/root/vm/sbom.csv
[ -s $f ] || { echo "sbom.csv ne postoji"; exit 1; }
n=$(dpkg-query -W -f='${Package}\n' | wc -l)
m=$(grep -c ',' $f)
[ "$n" -eq "$m" ] || { echo "Očekivano $n paketa, u fajlu $m"; exit 1; }
grep -q "^openssl,$(dpkg-query -W -f='${Version}' openssl)$" $f || { echo "Verzija openssl-a ne odgovara instaliranoj"; exit 1; }
-->
<!-- solution
dpkg-query -W -f='${Package},${Version}\n' | sort > /root/vm/sbom.csv
-->
