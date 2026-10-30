# Lab 1: Service inventory with nmap

Before vulnerability scanning you need to know what is actually running on the host. On this server (everything on `127.0.0.1`) the team claims that only a web application is running, on port **8080**. You'll verify that with nmap, identify the services, and bring the host into compliance with the policy.

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

## All open TCP ports

Scan **all** TCP ports (1–65535) on `127.0.0.1` and save the result in XML format to `/root/skan/svi-portovi.xml`. In `/root/skan/otvoreni.txt` write the open ports, one per line, in ascending order.

```bash
nmap -p- -oX /root/skan/svi-portovi.xml 127.0.0.1
```

<!-- verify
x=/root/skan/svi-portovi.xml
[ -s $x ] || { echo "missing $x"; exit 1; }
grep -q 'portid="65535"\|-p-\|1-65535' $x || { echo "the scan did not cover all ports (-p-)"; exit 1; }
want=$(ss -Hltn | awk '{print $4}' | grep -E '^127\.0\.0\.1:' | sed 's/.*://' | sort -n | uniq)
inxml=$(grep -o 'portid="[0-9]*"><state state="open"' $x | grep -o '[0-9]\+' | sort -n | uniq)
[ "$inxml" = "$want" ] || { echo "the XML does not contain all currently open ports (rerun the scan)"; exit 1; }
[ "$(grep -o '[0-9]\+' /root/skan/otvoreni.txt 2>/dev/null)" = "$want" ] || { echo "otvoreni.txt does not contain exactly the open ports, in ascending order"; exit 1; }
-->
<!-- hint
```bash
nmap -p- -oX /root/skan/svi-portovi.xml 127.0.0.1
grep -o 'portid="[0-9]*"><state state="open"' /root/skan/svi-portovi.xml | grep -o '[0-9]\+' | sort -n > /root/skan/otvoreni.txt
```
Without `-p-` nmap scans only the 1000 most common ports, so it misses services on unusual ports.
-->
<!-- solution
nmap -p- -oX /root/skan/svi-portovi.xml 127.0.0.1 >/dev/null
grep -o 'portid="[0-9]*"><state state="open"' /root/skan/svi-portovi.xml | grep -o '[0-9]\+' | sort -n | uniq > /root/skan/otvoreni.txt
-->

## What services are these

Run service and version detection (`-sV`) on the open ports and save the XML to `/root/skan/servisi.xml`. In `/root/skan/servisi.csv` write a line for each open port: `port,service_name,product` (the `name` and `product` fields from the XML; if `product` doesn't exist, leave it empty).

<!-- verify
x=/root/skan/servisi.xml
[ -s $x ] || { echo "missing $x"; exit 1; }
grep -q 'nmap.*-sV\|-sV' $x || { echo "servisi.xml was not created with -sV"; exit 1; }
want=$(python3 - "$x" <<'EOF'
import sys, xml.etree.ElementTree as ET
r = ET.parse(sys.argv[1]).getroot()
for p in r.iter("port"):
    if p.find("state").get("state") != "open": continue
    s = p.find("service")
    print(f"{p.get('portid')},{s.get('name','') if s is not None else ''},{s.get('product','') if s is not None else ''}")
EOF
)
[ -n "$want" ] || { echo "servisi.xml has no open ports"; exit 1; }
[ "$(sort -n /root/skan/servisi.csv 2>/dev/null | tr -d '\r')" = "$(echo "$want" | sort -n)" ] || { echo "servisi.csv does not match servisi.xml (port,name,product)"; exit 1; }
for p in $(cat /root/skan/otvoreni.txt); do grep -q "^$p," /root/skan/servisi.csv || { echo "port $p is missing from servisi.csv"; exit 1; }; done
-->
<!-- hint
```bash
nmap -sV -p "$(paste -sd, /root/skan/otvoreni.txt)" -oX /root/skan/servisi.xml 127.0.0.1
```
Parse the XML with Python (`xml.etree.ElementTree`) or `grep`/`sed`; for each `<port>` look at `<state state="open">` and `<service name=… product=…>`.
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

## Policy compliance

Policy: only the web application on **8080** may listen on the host. Shut down all other services you found, then rerun the all-ports scan into `/root/skan/poslije.xml`. In `/root/skan/izvjestaj.txt` write a line `port – service – reason` for each port you shut down.

<!-- verify
ports=$(ss -Hltn | awk '{print $4}' | sed 's/.*://' | sort -n | uniq | tr '\n' ' ')
[ "$ports" = "8080 " ] || { echo "ports still listening: $ports(only 8080 is allowed)"; exit 1; }
x=/root/skan/poslije.xml
[ -s $x ] || { echo "missing $x"; exit 1; }
[ "$(grep -o 'portid="[0-9]*"><state state="open"' $x | grep -o '[0-9]\+' | tr '\n' ' ')" = "8080 " ] || { echo "poslije.xml does not show only port 8080 (rerun the -p- scan after shutting services down)"; exit 1; }
for p in $(grep -v '^8080$' /root/skan/otvoreni.txt); do grep -q "^$p" /root/skan/izvjestaj.txt 2>/dev/null || { echo "izvjestaj.txt has no line for port $p"; exit 1; }; done
-->
<!-- hint
The process holding the port: `ss -ltnp` (the `users` column). Stop it with `kill <pid>`. In real life you stop the service and disable it in the init system (`systemctl disable --now …`), otherwise it comes back after a restart.
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
