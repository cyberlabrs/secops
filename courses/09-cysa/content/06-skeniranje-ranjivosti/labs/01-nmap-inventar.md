# Lab 1: Inventar servisa sa nmapom

Prije skeniranja ranjivosti moraš znati šta uopšte radi na hostu. Na ovom serveru (sve na `127.0.0.1`) tim tvrdi da radi samo web aplikacija na portu **8080**. Provjerićeš to nmapom, identifikovati servise i uskladiti host sa politikom.

```bash
nmap --version | head -1
mkdir -p /root/skan && cd /root/skan
```

<!-- setup
set -e
mkdir -p /root/skan
registry-up >/dev/null
cd /tmp && nohup python3 -m http.server 8080 --bind 127.0.0.1 >/dev/null 2>&1 &
nohup vault server -dev -dev-root-token-id=root -dev-listen-address=127.0.0.1:8200 >/dev/null 2>&1 &
for i in $(seq 40); do (echo > /dev/tcp/127.0.0.1/8200) 2>/dev/null && break; sleep 0.25; done
-->

## Svi otvoreni TCP portovi

Skeniraj **sve** TCP portove (1–65535) na `127.0.0.1` i sačuvaj rezultat u XML formatu u `/root/skan/svi-portovi.xml`. U `/root/skan/otvoreni.txt` upiši otvorene portove, jedan po redu, rastuće.

```bash
nmap -p- -oX /root/skan/svi-portovi.xml 127.0.0.1
```

<!-- verify
x=/root/skan/svi-portovi.xml
[ -s $x ] || { echo "nema $x"; exit 1; }
grep -q 'portid="65535"\|-p-\|1-65535' $x || { echo "sken nije pokrio sve portove (-p-)"; exit 1; }
want=$(ss -Hltn | awk '{print $4}' | grep -E '^127\.0\.0\.1:' | sed 's/.*://' | sort -n | uniq)
inxml=$(grep -o 'portid="[0-9]*"><state state="open"' $x | grep -o '[0-9]\+' | sort -n | uniq)
[ "$inxml" = "$want" ] || { echo "XML ne sadrži sve trenutno otvorene portove (ponovi sken)"; exit 1; }
[ "$(grep -o '[0-9]\+' /root/skan/otvoreni.txt 2>/dev/null)" = "$want" ] || { echo "otvoreni.txt ne sadrži tačno otvorene portove, rastuće"; exit 1; }
-->
<!-- hint
```bash
nmap -p- -oX /root/skan/svi-portovi.xml 127.0.0.1
grep -o 'portid="[0-9]*"><state state="open"' /root/skan/svi-portovi.xml | grep -o '[0-9]\+' | sort -n > /root/skan/otvoreni.txt
```
Bez `-p-` nmap skenira samo 1000 najčešćih portova, pa propušta servise na neobičnim portovima.
-->
<!-- solution
nmap -p- -oX /root/skan/svi-portovi.xml 127.0.0.1 >/dev/null
grep -o 'portid="[0-9]*"><state state="open"' /root/skan/svi-portovi.xml | grep -o '[0-9]\+' | sort -n | uniq > /root/skan/otvoreni.txt
-->

## Koji su to servisi

Na otvorenim portovima pokreni detekciju servisa i verzija (`-sV`) i sačuvaj XML u `/root/skan/servisi.xml`. U `/root/skan/servisi.csv` upiši red za svaki otvoren port: `port,ime_servisa,proizvod` (polja `name` i `product` iz XML-a; ako `product` ne postoji, ostavi prazno).

<!-- verify
x=/root/skan/servisi.xml
[ -s $x ] || { echo "nema $x"; exit 1; }
grep -q 'nmap.*-sV\|-sV' $x || { echo "servisi.xml nije napravljen sa -sV"; exit 1; }
want=$(python3 - "$x" <<'EOF'
import sys, xml.etree.ElementTree as ET
r = ET.parse(sys.argv[1]).getroot()
for p in r.iter("port"):
    if p.find("state").get("state") != "open": continue
    s = p.find("service")
    print(f"{p.get('portid')},{s.get('name','') if s is not None else ''},{s.get('product','') if s is not None else ''}")
EOF
)
[ -n "$want" ] || { echo "servisi.xml nema otvorenih portova"; exit 1; }
[ "$(sort -n /root/skan/servisi.csv 2>/dev/null | tr -d '\r')" = "$(echo "$want" | sort -n)" ] || { echo "servisi.csv se ne slaže sa servisi.xml (port,name,product)"; exit 1; }
for p in $(cat /root/skan/otvoreni.txt); do grep -q "^$p," /root/skan/servisi.csv || { echo "port $p nedostaje u servisi.csv"; exit 1; }; done
-->
<!-- hint
```bash
nmap -sV -p "$(paste -sd, /root/skan/otvoreni.txt)" -oX /root/skan/servisi.xml 127.0.0.1
```
XML parsiraj Pythonom (`xml.etree.ElementTree`) ili `grep`/`sed`; za svaki `<port>` gledaš `<state state="open">` i `<service name=… product=…>`.
-->
<!-- solution
nmap -sV -p "$(paste -sd, /root/skan/otvoreni.txt)" -oX /root/skan/servisi.xml 127.0.0.1 >/dev/null
python3 - <<'EOF' > /root/skan/servisi.csv
import xml.etree.ElementTree as ET
r = ET.parse("/root/skan/servisi.xml").getroot()
for p in r.iter("port"):
    if p.find("state").get("state") != "open": continue
    s = p.find("service")
    print(f"{p.get('portid')},{s.get('name','') if s is not None else ''},{s.get('product','') if s is not None else ''}")
EOF
-->

## Usklađivanje sa politikom

Politika: na hostu sme slušati samo web aplikacija na **8080**. Ugasi sve ostale servise koje si pronašao, pa ponovi sken svih portova u `/root/skan/poslije.xml`. U `/root/skan/izvjestaj.txt` za svaki ugašeni port napiši red `port – servis – razlog`.

<!-- verify
ports=$(ss -Hltn | awk '{print $4}' | sed 's/.*://' | sort -n | uniq | tr '\n' ' ')
[ "$ports" = "8080 " ] || { echo "i dalje slušaju portovi: $ports(dozvoljen je samo 8080)"; exit 1; }
x=/root/skan/poslije.xml
[ -s $x ] || { echo "nema $x"; exit 1; }
[ "$(grep -o 'portid="[0-9]*"><state state="open"' $x | grep -o '[0-9]\+' | tr '\n' ' ')" = "8080 " ] || { echo "poslije.xml ne pokazuje samo port 8080 (ponovi sken -p- nakon gašenja)"; exit 1; }
for p in $(grep -v '^8080$' /root/skan/otvoreni.txt); do grep -q "^$p" /root/skan/izvjestaj.txt 2>/dev/null || { echo "izvjestaj.txt nema red za port $p"; exit 1; }; done
-->
<!-- hint
Proces koji drži port: `ss -ltnp` (kolona `users`). Ugasi ga sa `kill <pid>`. U stvarnosti servis ugasiš i isključiš u init sistemu (`systemctl disable --now …`), inače se vrati nakon restarta.
-->
<!-- solution
for p in $(grep -v '^8080$' /root/skan/otvoreni.txt); do
  pid=$(ss -Hltnp "sport = :$p" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  n=$(grep "^$p," /root/skan/servisi.csv | cut -d, -f2)
  [ -n "$pid" ] && kill $pid
  echo "$p – $n – nije dozvoljen politikom (samo 8080)" >> /root/skan/izvjestaj.txt
done
sleep 1
nmap -p- -oX /root/skan/poslije.xml 127.0.0.1 >/dev/null
-->
