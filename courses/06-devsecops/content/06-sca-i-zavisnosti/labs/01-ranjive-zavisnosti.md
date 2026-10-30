# Lab 1: Ranjive zavisnosti i prihvatanje rizika

Kurs-shop koristi stare verzije Python paketa (`requirements.txt`) i frontend biblioteka (`frontend/package-lock.json`). **osv-scanner** ih poredi sa bazom OSV (lokalna kopija u labu, `--offline`).

Python zavisnosti ćeš nadograditi. Frontend tim traži dvije sedmice za migraciju na novu verziju axiosa, pa za njegove nalaze evidentiraš **privremeno prihvatanje rizika** sa razlogom i rokom.

```bash
cd /root/kurs-shop
osv-scanner scan source --offline -r .
```

<!-- setup
set -e
kurs-repo
-->

## Izvještaj

Skeniraj cijeli repo i sačuvaj rezultat u JSON formatu u `/root/osv.json`. Zatim u `/root/najgori.txt` upiši ime paketa (malim slovima) sa najviše poznatih ranjivosti.

```bash
osv-scanner scan source --offline -r . --format json --output /root/osv.json
jq -r '.results[].packages[] | "\(.vulnerabilities | length)\t\(.package.name) \(.package.version)"' /root/osv.json | sort -rn
```

<!-- verify
[ -s /root/osv.json ] || { echo "/root/osv.json ne postoji"; exit 1; }
jq -e '[.results[].source.path] | any(endswith("requirements.txt")) and any(endswith("package-lock.json"))' /root/osv.json >/dev/null 2>&1 || { echo "osv.json treba rezultate za requirements.txt i frontend/package-lock.json (skeniraj rekurzivno)"; exit 1; }
want=$(jq -r '[.results[].packages[] | {n: (.package.name | ascii_downcase), c: (.vulnerabilities | length)}] | max_by(.c) | .n' /root/osv.json)
[ "$(tr -d ' \n' < /root/najgori.txt 2>/dev/null | tr A-Z a-z)" = "$want" ] || { echo "najgori.txt ne sadrži paket sa najviše ranjivosti"; exit 1; }
-->
<!-- hint
`-r .` (`--recursive`) pronalazi lockfajlove u poddirektorijima. U JSON izlazu svaki element `.results[]` je jedan lockfajl (`.source.path`), a `.packages[]` paketi sa nalazima.
-->
<!-- solution
cd /root/kurs-shop
osv-scanner scan source --offline -r . --format json --output /root/osv.json >/dev/null 2>&1 || true
jq -r '[.results[].packages[] | {n: (.package.name | ascii_downcase), c: (.vulnerabilities | length)}] | max_by(.c) | .n' /root/osv.json > /root/najgori.txt
-->

## Nadogradi Python zavisnosti

Nadogradi sve pakete u `requirements.txt` na verzije bez poznatih ranjivosti. Zadrži isti spisak paketa i tačno pinovane verzije (`==`), kako bi build bio ponovljiv.

```bash
osv-scanner scan source --offline -L requirements.txt
```

Kolona **Fixed Version** pokazuje najmanju verziju koja rješava pojedinačni nalaz; nova verzija ponekad ima svoje nalaze, pa ponovi sken dok ne bude čist.

<!-- verify
cd /root/kurs-shop
for p in flask werkzeug jinja2 requests pyyaml gunicorn; do
  grep -iEq "^$p==[0-9]" requirements.txt || { echo "$p nije pinovan sa == u requirements.txt"; exit 1; }
done
[ "$(grep -cvE '^\s*(#|$)' requirements.txt)" = "6" ] || { echo "requirements.txt treba imati tačno 6 paketa"; exit 1; }
osv-scanner scan source --offline -L requirements.txt >/tmp/osv.txt 2>&1 || { grep PyPI /tmp/osv.txt | awk -F'|' '{print $5,$6,"→",$7}' | sort -u | head; echo "requirements.txt i dalje ima ranjive verzije"; exit 1; }
-->
<!-- hint
Kreni od kolone Fixed Version, npr. `PyYAML==6.0.3`, `jinja2==3.1.6`, `gunicorn==23.0.0`. Za `flask`, `werkzeug` i `requests` uzmi najnoviju verziju iz kolone pa ponovo skeniraj.

U pravom projektu ovo radi Renovate ili Dependabot: otvaraju MR sa nadogradnjom, a testovi u pipelineu provjere da aplikacija i dalje radi.
-->
<!-- solution
cd /root/kurs-shop
printf 'flask==3.1.3\nwerkzeug==3.1.9\njinja2==3.1.6\nrequests==2.33.0\nPyYAML==6.0.3\ngunicorn==23.0.0\n' > requirements.txt
-->

## Prihvatanje rizika sa rokom

Za frontend nalaze napravi `osv-scanner.toml` u korijenu repoa sa po jednim `[[IgnoredVulns]]` unosom za **svaki** trenutni nalaz u `frontend/package-lock.json`:

- `id` nalaza (prvi ID iz grupe, onaj koji osv-scanner prikazuje),
- `reason` koji objašnjava odluku (barem nekoliko riječi, npr. ko je odobrio i do kada je migracija),
- `ignoreUntil` najviše **30 dana** od danas (format `2026-11-10T00:00:00Z`).

Nalazi u Python paketima ne smiju biti ignorisani. Na kraju dodaj job `sca` (faza `test`): `osv-scanner scan source --offline -r . --config osv-scanner.toml`. Pipeline mora proći.

```bash
osv-scanner scan source --offline -L frontend/package-lock.json --format json \
  | jq -r '.results[].packages[].groups[].ids[0]'
```

<!-- verify
cd /root/kurs-shop
[ -f osv-scanner.toml ] || { echo "nema osv-scanner.toml u korijenu repoa"; exit 1; }
osv-scanner scan source --offline -L frontend/package-lock.json --config osv-scanner.toml >/tmp/o.txt 2>&1 || { echo "frontend nalazi nisu svi pokriveni u osv-scanner.toml"; exit 1; }
python3 - <<'EOF' || exit 1
import tomllib, datetime, json, subprocess, sys
cfg = tomllib.load(open("osv-scanner.toml", "rb"))
items = cfg.get("IgnoredVulns", [])
now = datetime.datetime.now(datetime.timezone.utc)
for it in items:
    i = it.get("id", "?")
    if len(str(it.get("reason", "")).split()) < 3:
        sys.exit(f"{i}: reason mora objasniti odluku (barem tri riječi)")
    u = it.get("ignoreUntil")
    if u is None:
        sys.exit(f"{i}: nema ignoreUntil (izuzetak bez roka je trajno isključena kontrola)")
    if isinstance(u, datetime.date) and not isinstance(u, datetime.datetime):
        u = datetime.datetime.combine(u, datetime.time(), datetime.timezone.utc)
    if u.tzinfo is None:
        u = u.replace(tzinfo=datetime.timezone.utc)
    if u <= now or u > now + datetime.timedelta(days=30, hours=12):
        sys.exit(f"{i}: ignoreUntil mora biti u narednih 30 dana")
py = json.loads(subprocess.run(["osv-scanner", "scan", "source", "--offline", "-L", "/opt/kurs/kurs-shop/requirements.txt", "--format", "json"], capture_output=True, text=True).stdout or "{}")
pyids = {x for r in py.get("results", []) for p in r["packages"] for g in p["groups"] for x in g["ids"]}
bad = pyids & {it.get("id") for it in items}
if bad:
    sys.exit("ignorisani su i nalazi Python paketa: " + ", ".join(sorted(bad)))
EOF
yq '.sca.script | join(" ")' .gitlab-ci.yml | grep -q 'osv-scanner' || { echo "nema joba sca sa osv-scannerom"; exit 1; }
[ "$(yq '.sca.allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "sca ne smije imati allow_failure"; exit 1; }
gitlab-ci-local sca > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job sca pada"; exit 1; }
-->
<!-- hint
```bash
until=$(date -u -d '+14 days' +%Y-%m-%dT00:00:00Z)
osv-scanner scan source --offline -L frontend/package-lock.json --format json \
  | jq -r --arg u "$until" '.results[].packages[].groups[].ids[0] |
      "[[IgnoredVulns]]\nid = \"\(.)\"\nignoreUntil = \(\$u)\nreason = \"Frontend migracija na axios 1.x do sprinta 42, odobrio AppSec\"\n"' > osv-scanner.toml
```
`ignoreUntil` je TOML datum, bez navodnika. Po isteku roka nalaz se ponovo pojavljuje i pipeline pada, što je i cilj.
-->
<!-- solution
cd /root/kurs-shop
until=$(date -u -d '+14 days' +%Y-%m-%dT00:00:00Z)
osv-scanner scan source --offline -L frontend/package-lock.json --format json 2>/dev/null \
  | jq -r --arg u "$until" '.results[].packages[].groups[].ids[0] | "[[IgnoredVulns]]\nid = \"\(.)\"\nignoreUntil = \($u)\nreason = \"Frontend migracija na axios 1.x do sprinta 42, odobrio AppSec\"\n"' > osv-scanner.toml
yq -i '.sca = {"stage": "test", "script": ["osv-scanner scan source --offline -r . --config osv-scanner.toml"]}' .gitlab-ci.yml
-->
