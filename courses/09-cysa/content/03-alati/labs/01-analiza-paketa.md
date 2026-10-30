# Lab 1: Analiza mrežnog snimka sa tsharkom

Interni web server (`127.0.0.1:8081`) javlja neuobičajeno mnogo grešaka 404. Tim je snimio saobraćaj u `/root/pcap/promet.pcap`. Utvrdićeš ko šta traži i napraviti filter za dalju analizu.

`tshark` je Wireshark u komandnoj liniji: `-r` čita snimak, `-Y` je display filter, `-T fields -e <polje>` ispisuje polja.

```bash
cd /root/pcap
tshark -r promet.pcap | head
tshark -r promet.pcap -Y http.request -T fields -e ip.src -e http.request.method -e http.request.uri -e http.user_agent | head
```

<!-- setup
set -e
mkdir -p /root/pcap /tmp/www/static
printf '<html><body>kurs</body></html>' > /tmp/www/index.html
printf 'body{}' > /tmp/www/static/app.css
printf 'ok' > /tmp/www/health
cd /tmp/www && nohup python3 -m http.server 8081 --bind 127.0.0.1 >/dev/null 2>&1 &
sleep 1
tcpdump -i lo -U -w /root/pcap/promet.pcap 'tcp port 8081' >/dev/null 2>&1 &
TP=$!; sleep 1
B='Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0'
for i in 1 2 3; do curl -s -A "$B" http://127.0.0.1:8081/ >/dev/null; curl -s -A "$B" http://127.0.0.1:8081/static/app.css >/dev/null; done
for i in $(seq 6); do curl -s -A 'kube-probe/1.33' http://127.0.0.1:8081/health >/dev/null; done
for p in admin backup .git/config .env wp-login.php phpmyadmin server-status config.php old db.sql api/v1 test; do curl -s -A 'Mozilla/5.0 (compatible; kurs-skener/2.1)' "http://127.0.0.1:8081/$p" >/dev/null; done
curl -s -A "$B" http://127.0.0.1:8081/favicon.ico >/dev/null
sleep 1; kill $TP; sleep 0.5
-->

## Zahtjevi po klijentu

Iz snimka izdvoji broj HTTP zahtjeva po `User-Agent`u i upiši u `/root/pcap/ua.csv` sa zaglavljem `user_agent,zahtjeva`, sortirano opadajuće po broju.

<!-- verify
f=/root/pcap/ua.csv
[ -s $f ] || { echo "nema $f"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "user_agent,zahtjeva" ] || { echo "zaglavlje treba user_agent,zahtjeva"; exit 1; }
python3 - <<'EOF' || exit 1
import csv, subprocess, collections, sys
out = subprocess.run(["tshark", "-r", "/root/pcap/promet.pcap", "-Y", "http.request", "-T", "fields", "-e", "http.user_agent"], capture_output=True, text=True).stdout
want = collections.Counter(l for l in out.splitlines() if l)
got = {r["user_agent"]: int(r["zahtjeva"]) for r in csv.DictReader(open("/root/pcap/ua.csv"))}
if got != dict(want): sys.exit("brojevi po User-Agentu nisu tačni")
vals = [int(r["zahtjeva"]) for r in csv.DictReader(open("/root/pcap/ua.csv"))]
if vals != sorted(vals, reverse=True): sys.exit("nije sortirano opadajuće")
EOF
-->
<!-- hint
```bash
tshark -r promet.pcap -Y http.request -T fields -e http.user_agent | sort | uniq -c | sort -rn
```
Ako User-Agent sadrži zarez, CSV red se lomi; u stvarnosti koristi Python `csv` modul ili navodnike.
-->
<!-- solution
cd /root/pcap
{ echo "user_agent,zahtjeva"; tshark -r promet.pcap -Y http.request -T fields -e http.user_agent | sort | uniq -c | sort -rn | sed -E 's/^ *([0-9]+) (.*)$/\2,\1/'; } > ua.csv
-->

## Ko izaziva greške 404

Odgovor nema User-Agent: poveži odgovor sa zahtjevom (isti TCP tok, `tcp.stream`). Utvrdi koji User-Agent ima najviše odgovora 404 i upiši u `/root/pcap/sumnjivi.txt` dva reda: User-Agent i broj njegovih odgovora 404. U `/root/pcap/putanje.txt` upiši putanje (URI) koje je tražio, a server ih nije imao (404), jednu po redu, sortirano.

<!-- verify
python3 - <<'EOF' || exit 1
import subprocess, collections, sys
rows = subprocess.run(["tshark", "-r", "/root/pcap/promet.pcap", "-Y", "http", "-T", "fields", "-e", "tcp.stream", "-e", "http.user_agent", "-e", "http.request.uri", "-e", "http.response.code"], capture_output=True, text=True).stdout.splitlines()
ua, uri, code = {}, {}, {}
for r in rows:
    s, u, p, c = (r.split("\t") + ["", "", "", ""])[:4]
    if u: ua[s] = u; uri[s] = p
    if c: code[s] = c
cnt = collections.Counter(ua[s] for s in code if code[s] == "404" and s in ua)
top, n = cnt.most_common(1)[0]
paths = sorted({uri[s] for s in code if code[s] == "404" and ua.get(s) == top})
got = [l.strip() for l in open("/root/pcap/sumnjivi.txt") if l.strip()]
if len(got) < 2 or got[0] != top or got[1] != str(n): sys.exit("sumnjivi.txt nije tačan (red 1: User-Agent, red 2: broj 404)")
gp = [l.strip() for l in open("/root/pcap/putanje.txt") if l.strip()]
if gp != paths: sys.exit("putanje.txt nije tačan (URI sa 404 za taj User-Agent, sortirano)")
EOF
-->
<!-- hint
```bash
tshark -r promet.pcap -Y http -T fields -e tcp.stream -e http.user_agent -e http.request.uri -e http.response.code
```
U istom toku prvo ide zahtjev (User-Agent, URI), pa odgovor (kod). Spoji ih po broju toka (npr. `awk` sa nizovima ili Python).
-->
<!-- solution
cd /root/pcap
tshark -r promet.pcap -Y http -T fields -e tcp.stream -e http.user_agent -e http.request.uri -e http.response.code | python3 -c '
import sys, collections
ua, uri, code = {}, {}, {}
for r in sys.stdin:
    s, u, p, c = (r.rstrip("\n").split("\t") + ["", "", "", ""])[:4]
    if u: ua[s] = u; uri[s] = p
    if c: code[s] = c
cnt = collections.Counter(ua[s] for s in code if code[s] == "404" and s in ua)
top, n = cnt.most_common(1)[0]
open("sumnjivi.txt", "w").write(f"{top}\n{n}\n")
open("putanje.txt", "w").write("\n".join(sorted({uri[s] for s in code if code[s] == "404" and ua.get(s) == top})) + "\n")
'
-->

## Display filter za dalju analizu

Napiši Wireshark display filter koji prikazuje samo **odgovore 404** na zahtjeve tog User-Agenta. Pošto odgovor nema User-Agent, filtriraj po onome što odgovor ima: kod 404 i adresu/port klijenta nije dovoljno (svi su sa 127.0.0.1), pa koristi **broj toka**. Upiši filter (jedan red) u `/root/pcap/filter.txt`.

Pazi: i običan browser je dobio jedan 404 (`/favicon.ico`), pa samo `http.response.code == 404` nije dovoljno precizan.

<!-- verify
f=/root/pcap/filter.txt
[ -s $f ] || { echo "nema $f"; exit 1; }
flt=$(head -1 $f)
n=$(tshark -r /root/pcap/promet.pcap -Y "$flt" 2>/dev/null | wc -l)
[ "$?" = 0 ] || { echo "filter nije ispravan"; exit 1; }
tshark -r /root/pcap/promet.pcap -Y "$flt" -T fields -e http.response.code 2>/dev/null | grep -v '^404$' | grep -q . && { echo "filter propušta i pakete koji nisu odgovori 404"; exit 1; }
[ "$n" = "$(sed -n 2p /root/pcap/sumnjivi.txt)" ] || { echo "filter daje $n paketa, a očekivano je onoliko koliko ima 404 odgovora tom klijentu"; exit 1; }
-->
<!-- hint
`http.response.code == 404 && tcp.stream in {9,10,11}` (brojeve tokova tog klijenta dobiješ iz prethodnog zadatka). Filter testiraj: `tshark -r promet.pcap -Y '<filter>'`.
-->
<!-- solution
cd /root/pcap
ua=$(head -1 sumnjivi.txt)
st=$(tshark -r promet.pcap -Y http.request -T fields -e tcp.stream -e http.user_agent | awk -F'\t' -v u="$ua" '$2 == u {print $1}' | paste -sd,)
echo "http.response.code == 404 && tcp.stream in {$st}" > filter.txt
-->
