# Lab 1: Analyzing a network capture with tshark

An internal web server (`127.0.0.1:8081`) is reporting an unusually high number of 404 errors. The team captured the traffic in `/root/pcap/promet.pcap`. You will determine who is requesting what and build a filter for further analysis.

`tshark` is Wireshark on the command line: `-r` reads a capture, `-Y` is a display filter, `-T fields -e <field>` prints fields.

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

## Requests per client

From the capture, extract the number of HTTP requests per `User-Agent` and write it to `/root/pcap/ua.csv` with the header `user_agent,zahtjeva` (the column names are fixed and checked as-is; `zahtjeva` = requests), sorted in descending order by count.

<!-- verify
f=/root/pcap/ua.csv
[ -s $f ] || { echo "$f is missing"; exit 1; }
[ "$(head -1 $f | tr -d '\r')" = "user_agent,zahtjeva" ] || { echo "the header must be user_agent,zahtjeva"; exit 1; }
python3 - <<'EOF' || exit 1
import csv, subprocess, collections, sys
out = subprocess.run(["tshark", "-r", "/root/pcap/promet.pcap", "-Y", "http.request", "-T", "fields", "-e", "http.user_agent"], capture_output=True, text=True).stdout
want = collections.Counter(l for l in out.splitlines() if l)
got = {r["user_agent"]: int(r["zahtjeva"]) for r in csv.DictReader(open("/root/pcap/ua.csv"))}
if got != dict(want): sys.exit("the counts per User-Agent are not correct")
vals = [int(r["zahtjeva"]) for r in csv.DictReader(open("/root/pcap/ua.csv"))]
if vals != sorted(vals, reverse=True): sys.exit("not sorted in descending order")
EOF
-->
<!-- hint
```bash
tshark -r promet.pcap -Y http.request -T fields -e http.user_agent | sort | uniq -c | sort -rn
```
If a User-Agent contains a comma, the CSV row breaks; in practice use the Python `csv` module or quoting.
-->
<!-- solution
cd /root/pcap
{ echo "user_agent,zahtjeva"; tshark -r promet.pcap -Y http.request -T fields -e http.user_agent | sort | uniq -c | sort -rn | sed -E 's/^ *([0-9]+) (.*)$/\2,\1/'; } > ua.csv
-->

## Who is causing the 404 errors

A response has no User-Agent: link the response to the request (same TCP stream, `tcp.stream`). Determine which User-Agent has the most 404 responses and write two lines to `/root/pcap/sumnjivi.txt`: the User-Agent and the number of its 404 responses. In `/root/pcap/putanje.txt` write the paths (URIs) it requested that the server did not have (404), one per line, sorted.

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
if len(got) < 2 or got[0] != top or got[1] != str(n): sys.exit("sumnjivi.txt is not correct (line 1: User-Agent, line 2: number of 404s)")
gp = [l.strip() for l in open("/root/pcap/putanje.txt") if l.strip()]
if gp != paths: sys.exit("putanje.txt is not correct (URIs with 404 for that User-Agent, sorted)")
EOF
-->
<!-- hint
```bash
tshark -r promet.pcap -Y http -T fields -e tcp.stream -e http.user_agent -e http.request.uri -e http.response.code
```
Within the same stream the request comes first (User-Agent, URI), then the response (code). Join them by stream number (e.g., `awk` with arrays or Python).
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

## Display filter for further analysis

Write a Wireshark display filter that shows only the **404 responses** to that User-Agent's requests. Since a response has no User-Agent, filter on what the response does have: the 404 code plus the client address/port is not enough (they all come from 127.0.0.1), so use the **stream number**. Write the filter (one line) to `/root/pcap/filter.txt`.

Careful: the ordinary browser also received one 404 (`/favicon.ico`), so `http.response.code == 404` alone is not precise enough.

<!-- verify
f=/root/pcap/filter.txt
[ -s $f ] || { echo "$f is missing"; exit 1; }
flt=$(head -1 $f)
n=$(tshark -r /root/pcap/promet.pcap -Y "$flt" 2>/dev/null | wc -l)
[ "$?" = 0 ] || { echo "the filter is not valid"; exit 1; }
tshark -r /root/pcap/promet.pcap -Y "$flt" -T fields -e http.response.code 2>/dev/null | grep -v '^404$' | grep -q . && { echo "the filter also lets through packets that are not 404 responses"; exit 1; }
[ "$n" = "$(sed -n 2p /root/pcap/sumnjivi.txt)" ] || { echo "the filter returns $n packets, but expected as many as there are 404 responses to that client"; exit 1; }
-->
<!-- hint
`http.response.code == 404 && tcp.stream in {9,10,11}` (you get that client's stream numbers from the previous task). Test the filter: `tshark -r promet.pcap -Y '<filter>'`.
-->
<!-- solution
cd /root/pcap
ua=$(head -1 sumnjivi.txt)
st=$(tshark -r promet.pcap -Y http.request -T fields -e tcp.stream -e http.user_agent | awk -F'\t' -v u="$ua" '$2 == u {print $1}' | paste -sd,)
echo "http.response.code == 404 && tcp.stream in {$st}" > filter.txt
-->
