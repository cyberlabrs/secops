# Lab 2: Skeniranje slike i gate u pipelineu

Slika `kurs-shop:1.0` u lokalnom registriju napravljena je na staroj baznoj slici `python:3.9-slim` i radi kao root. Napravićeš novu verziju na aktuelnoj baznoj slici, uvesti **Trivy gate** u pipeline i obrazloženo prihvatiti nalaze koji trenutno nemaju rješenje u tvojim rukama.

Slike se u labu sklapaju bez Docker daemona alatom `kurs-build` (bazna slika + sloj sa kodom). U pravom pipelineu to radi BuildKit, Buildah ili Kaniko.

```bash
cd /root/kurs-shop
crane ls --insecure 127.0.0.1:5000/kurs-shop
kurs-build
trivy image --severity CRITICAL 127.0.0.1:5000/kurs-shop:1.0
```

<!-- setup
set -e
kurs-repo
cd /root/kurs-shop
kurs-build 127.0.0.1:5000/python:3.9-slim 127.0.0.1:5000/kurs-shop:1.0 /root/kurs-shop >/dev/null
-->

## Koliko je loša stara slika

Skeniraj `127.0.0.1:5000/kurs-shop:1.0` i sačuvaj JSON izvještaj u `/root/trivy-1.0.json`. U `/root/critical.txt` upiši broj nalaza ozbiljnosti CRITICAL (broj unosa u svim `Vulnerabilities` listama), a u `/root/critical-fix.txt` koliko ih ima dostupnu popravku (`FixedVersion`).

```bash
trivy image --format json -o /root/trivy-1.0.json 127.0.0.1:5000/kurs-shop:1.0
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' /root/trivy-1.0.json
```

<!-- verify
[ -s /root/trivy-1.0.json ] || { echo "/root/trivy-1.0.json ne postoji"; exit 1; }
jq -e '.ArtifactName | test("kurs-shop:1.0")' /root/trivy-1.0.json >/dev/null 2>&1 || { echo "izvještaj nije za 127.0.0.1:5000/kurs-shop:1.0"; exit 1; }
c=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' /root/trivy-1.0.json)
f=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "")] | length' /root/trivy-1.0.json)
[ "$c" -gt 0 ] || { echo "izvještaj nema CRITICAL nalaza: skeniraj sve ozbiljnosti"; exit 1; }
[ "$(tr -d ' \n' < /root/critical.txt 2>/dev/null)" = "$c" ] || { echo "critical.txt nije tačan"; exit 1; }
[ "$(tr -d ' \n' < /root/critical-fix.txt 2>/dev/null)" = "$f" ] || { echo "critical-fix.txt nije tačan"; exit 1; }
-->
<!-- hint
```bash
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "")] | length' /root/trivy-1.0.json
```
`?` iza `Vulnerabilities[]` preskače rezultate bez nalaza (npr. sken tajni).
-->
<!-- solution
trivy image -q --format json -o /root/trivy-1.0.json 127.0.0.1:5000/kurs-shop:1.0
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' /root/trivy-1.0.json > /root/critical.txt
jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "")] | length' /root/trivy-1.0.json > /root/critical-fix.txt
-->

## Nova slika i prvi gate

1. Napravi `127.0.0.1:5000/kurs-shop:1.1` na baznoj slici `127.0.0.1:5000/python:3.13-slim`, sa korisnikom `65532` (ne root).
2. Gate (samo ranjivosti; tajne skenira poseban job): `trivy image --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 <slika>` mora pasti za 1.0, a proći za 1.1.

```bash
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532
```

<!-- verify
crane digest --insecure 127.0.0.1:5000/kurs-shop:1.1 >/dev/null 2>&1 || { echo "slika kurs-shop:1.1 ne postoji u registriju"; exit 1; }
u=$(crane config --insecure 127.0.0.1:5000/kurs-shop:1.1 | jq -r '.config.User // ""')
[ -n "$u" ] && [ "$u" != "root" ] && [ "$u" != "0" ] || { echo "kurs-shop:1.1 radi kao root (User: '$u')"; exit 1; }
crane config --insecure 127.0.0.1:5000/kurs-shop:1.1 | jq -e '.config.Env | any(test("PYTHON_VERSION=3.13"))' >/dev/null || { echo "kurs-shop:1.1 nije na python:3.13-slim"; exit 1; }
trivy image -q --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 127.0.0.1:5000/kurs-shop:1.1 >/dev/null 2>&1 || { echo "gate pada i za 1.1"; exit 1; }
-->
<!-- hint
`kurs-build <bazna> <odredište> <direktorij> <korisnik>`. Provjera korisnika: `crane config --insecure 127.0.0.1:5000/kurs-shop:1.1 | jq .config.User`.
-->
<!-- solution
kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:1.1 /root/kurs-shop 65532 >/dev/null
-->

## Stroži gate i obrazložena izuzeća

Tim pooštrava gate na **HIGH i CRITICAL** sa dostupnom popravkom. Na 1.1 ostaju nalazi u Python paketima koje donosi sama bazna slika (alati oko `pip`-a), a ne aplikacija; popravka stiže sa sljedećim izdanjem bazne slike.

1. Napravi `.trivyignore.yaml` u korijenu repoa sa unosom za svaki takav nalaz: `id`, `statement` (obrazloženje) i `expired_at` najviše 30 dana od danas (RFC 3339, npr. `2026-11-10T00:00:00Z`).
2. Dodaj job `image-scan` (faza `test`) koji napravi sliku `127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA` (`kurs-build`, korisnik 65532) i skenira je: `--scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml`.
3. `gitlab-ci-local image-scan` mora proći.

```bash
trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed 127.0.0.1:5000/kurs-shop:1.1
```

<!-- verify
cd /root/kurs-shop
[ -f .trivyignore.yaml ] || { echo "nema .trivyignore.yaml"; exit 1; }
python3 - <<'EOF' || exit 1
import datetime, subprocess, sys, json
y = json.loads(subprocess.run(["yq", "-o=json", ".", ".trivyignore.yaml"], capture_output=True, text=True).stdout or "{}")
items = (y or {}).get("vulnerabilities") or []
if not items:
    sys.exit(".trivyignore.yaml nema sekciju vulnerabilities")
today = datetime.date.today()
for it in items:
    i = it.get("id", "?")
    if len(str(it.get("statement", "")).split()) < 3:
        sys.exit(f"{i}: statement mora obrazložiti izuzetak")
    e = it.get("expired_at")
    if not e:
        sys.exit(f"{i}: nema expired_at")
    d = datetime.date.fromisoformat(str(e)[:10])
    if d <= today or d > today + datetime.timedelta(days=30):
        sys.exit(f"{i}: expired_at mora biti u narednih 30 dana")
EOF
n=$(yq '.vulnerabilities | length' .trivyignore.yaml)
[ "$n" -le 8 ] || { echo "previše izuzetaka ($n): ignoriši samo nalaze koji preostaju na 1.1"; exit 1; }
s=$(yq '.["image-scan"].script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q 'kurs-build' && echo "$s" | grep -q 'CI_COMMIT_SHORT_SHA' || { echo "image-scan treba napraviti sliku kurs-shop:\$CI_COMMIT_SHORT_SHA"; exit 1; }
echo "$s" | grep -q 'HIGH,CRITICAL' && echo "$s" | grep -q -- '--scanners vuln' && echo "$s" | grep -q -- '--exit-code 1' && echo "$s" | grep -q -- '--ignorefile' || { echo "image-scan treba --severity HIGH,CRITICAL --exit-code 1 --ignorefile .trivyignore.yaml"; exit 1; }
gitlab-ci-local image-scan > /tmp/gcl.log 2>&1 || { tail -20 /tmp/gcl.log; echo "job image-scan pada"; exit 1; }
trivy image -q --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml 127.0.0.1:5000/kurs-shop:1.0 >/dev/null 2>&1 && { echo "izuzeci propuštaju i staru sliku 1.0: preširoki su"; exit 1; }
exit 0
-->
<!-- hint
```yaml
vulnerabilities:
  - id: CVE-2025-47273
    statement: setuptools iz bazne slike, ne koristi se u runtimeu; čekamo novo izdanje python:3.13-slim
    expired_at: 2026-11-10T00:00:00Z
```
```yaml
image-scan:
  stage: test
  script:
    - kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA . 65532
    - trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA
```
Bez `--scanners vuln` Trivy u slici skenira i tajne, pa bi gate pao i na tokenu u kopiranom `Dockerfile`u; tajne su posao posebnog joba. ID-jeve dobiješ sa `trivy image -f json … | jq -r '.Results[].Vulnerabilities[]?.VulnerabilityID' | sort -u`.
-->
<!-- solution
cd /root/kurs-shop
exp=$(date -u -d '+21 days' +%Y-%m-%dT00:00:00Z)
trivy image -q --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed -f json 127.0.0.1:5000/kurs-shop:1.1 \
  | jq -r --arg e "$exp" '[.Results[].Vulnerabilities[]? | .VulnerabilityID] | unique | {vulnerabilities: map({id: ., statement: "Paket iz bazne slike python:3.13-slim, ne koristi ga aplikacija; čekamo novo izdanje bazne slike", expired_at: $e})}' \
  | yq -P > .trivyignore.yaml
yq -i '.["image-scan"] = {"stage": "test", "script": ["kurs-build 127.0.0.1:5000/python:3.13-slim 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA . 65532", "trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --ignorefile .trivyignore.yaml 127.0.0.1:5000/kurs-shop:$CI_COMMIT_SHORT_SHA"]}' .gitlab-ci.yml
-->
