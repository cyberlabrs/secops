# Lab 1: Sigma pravilo od ideje do upita

Kurs-api od nedavno šalje događaje kao JSON (polja `ts`, `action`, `user`, `src_ip`, `target`, `role`). Sigurnosni tim želi detekciju: **korisniku je dodijeljena uloga `owner`**. Izuzetak je servisni nalog `ci-bot`, koji to radi kroz odobren proces.

Napisaćeš Sigma pravilo, testirati ga nad primjerima (pozitivnim i negativnim), konvertovati za Splunk i Sentinel i napraviti pipeline za Elastic (ECS).

```bash
cd /root/sigma
head -3 testovi/pozitivni.jsonl testovi/negativni.jsonl
sigma list targets
```

<!-- setup
set -e
mkdir -p /root/sigma/testovi
cat > /root/sigma/testovi/pozitivni.jsonl <<'EOF'
{"ts":"2026-10-16T09:00:00Z","id":"p1","action":"role_changed","user":"marko","src_ip":"10.0.5.20","target":"ana","role":"owner"}
{"ts":"2026-10-16T09:05:00Z","id":"p2","action":"role_changed","user":"jelena","src_ip":"10.0.5.31","target":"ivan","role":"owner"}
EOF
cat > /root/sigma/testovi/negativni.jsonl <<'EOF'
{"ts":"2026-10-16T09:01:00Z","id":"n1","action":"role_changed","user":"ci-bot","src_ip":"10.0.9.5","target":"svc-shop","role":"owner"}
{"ts":"2026-10-16T09:02:00Z","id":"n2","action":"role_changed","user":"marko","src_ip":"10.0.5.20","target":"ana","role":"viewer"}
{"ts":"2026-10-16T09:03:00Z","id":"n3","action":"login_ok","user":"ana","src_ip":"10.0.5.20"}
{"ts":"2026-10-16T09:04:00Z","id":"n4","action":"role_requested","user":"ivan","src_ip":"10.0.5.31","target":"ivan","role":"owner"}
{"ts":"2026-10-16T09:06:00Z","id":"n5","action":"role_changed","user":"marko","src_ip":"10.0.5.20","target":"ana","role":"owners-readonly"}
EOF
-->

## Pravilo i testovi

Napiši `/root/sigma/kurs_api_owner.yml`:

- `title`, `id` (UUID), `status: test`, `description`, `author`, `date`, `level: high`,
- `logsource`: `product: kurs`, `service: api`,
- `tags`: `attack.persistence` i `attack.t1098`,
- `detection`: `action` je `role_changed` i `role` je tačno `owner`, osim kad je `user` `ci-bot`,
- `falsepositives` sa barem jednim primjerom.

`sigma check` mora proći bez grešaka i upozorenja, a Zircolite nad primjerima mora naći tačno `p1` i `p2`:

```bash
sigma check kurs_api_owner.yml
zircolite -e testovi/pozitivni.jsonl -j -r kurs_api_owner.yml -o /tmp/poz.json -q
zircolite -e testovi/negativni.jsonl -j -r kurs_api_owner.yml -o /tmp/neg.json -q
jq '[.[].matches[].id]' /tmp/poz.json /tmp/neg.json
```

<!-- verify
f=/root/sigma/kurs_api_owner.yml
[ -f $f ] || { echo "nema $f"; exit 1; }
sigma check $f > /tmp/sc.txt 2>&1 || { tail -8 /tmp/sc.txt; echo "sigma check javlja grešku"; exit 1; }
grep -q 'Found 0 errors, 0 condition errors and 0 issues' /tmp/sc.txt || { grep -iE 'issue|error' /tmp/sc.txt | head -5; echo "sigma check javlja greške ili upozorenja"; exit 1; }
[ "$(yq '.logsource.product' $f)" = "kurs" ] && [ "$(yq '.logsource.service' $f)" = "api" ] || { echo "logsource treba product: kurs, service: api"; exit 1; }
[ "$(yq '.level' $f)" = "high" ] || { echo "level treba high"; exit 1; }
yq '.tags[]' $f | grep -qx 'attack.t1098' && yq '.tags[]' $f | grep -qx 'attack.persistence' || { echo "tags treba attack.persistence i attack.t1098"; exit 1; }
[ "$(yq '.falsepositives | length' $f)" -ge 1 ] || { echo "nedostaje falsepositives"; exit 1; }
cd /tmp
zircolite -e /root/sigma/testovi/pozitivni.jsonl -j -r $f -o /tmp/vp.json -q >/dev/null 2>&1
zircolite -e /root/sigma/testovi/negativni.jsonl -j -r $f -o /tmp/vn.json -q >/dev/null 2>&1
p=$(jq -r '[.[].matches[]?.id] | sort | join(",")' /tmp/vp.json 2>/dev/null)
n=$(jq -r '[.[].matches[]?.id] | sort | join(",")' /tmp/vn.json 2>/dev/null)
[ "$p" = "p1,p2" ] || { echo "nad pozitivnim primjerima pravilo nalazi: '$p' (očekivano p1,p2)"; exit 1; }
[ -z "$n" ] || { echo "lažni pozitivi nad negativnim primjerima: $n"; exit 1; }
-->
<!-- hint
```yaml
title: kurs-api dodijeljena uloga owner
id: 6f0c2b9e-3a51-4d7e-9a0c-1d2e3f4a5b6c
status: test
description: Korisniku je dodijeljena uloga owner van odobrenog procesa automatizacije
author: <ime>
date: 2026-10-16
tags:
  - attack.persistence
  - attack.t1098
logsource:
  product: kurs
  service: api
detection:
  selection:
    action: role_changed
    role: owner
  filter_ci:
    user: ci-bot
  condition: selection and not filter_ci
falsepositives:
  - Planirana promjena vlasnika uz odobren zahtjev
level: high
```
Sigma poredi vrijednosti tačno (bez razlike u velikim slovima), pa `owners-readonly` ne odgovara `owner`. Novi UUID: `python3 -c 'import uuid; print(uuid.uuid4())'`.
-->
<!-- solution
cat > /root/sigma/kurs_api_owner.yml <<'EOF'
title: kurs-api dodijeljena uloga owner
id: 6f0c2b9e-3a51-4d7e-9a0c-1d2e3f4a5b6c
status: test
description: Korisniku je dodijeljena uloga owner van odobrenog procesa automatizacije
author: Kurs
date: 2026-10-16
tags:
  - attack.persistence
  - attack.t1098
logsource:
  product: kurs
  service: api
detection:
  selection:
    action: role_changed
    role: owner
  filter_ci:
    user: ci-bot
  condition: selection and not filter_ci
falsepositives:
  - Planirana promjena vlasnika uz odobren zahtjev
level: high
EOF
-->

## Upiti za Splunk i Sentinel

Konvertuj pravilo i sačuvaj upite:

- `/root/sigma/kurs_api_owner.spl` (backend `splunk`),
- `/root/sigma/kurs_api_owner.kql` (backend `kusto`).

Pravilo ima vlastiti `logsource`, pa ugrađeni pipelinei za njega ne postoje; backend koji traži pipeline pokreni sa `--without-pipeline`.

```bash
sigma convert -t splunk --without-pipeline kurs_api_owner.yml
```

<!-- verify
cd /root/sigma
for t in splunk:spl kusto:kql; do
  b=${t%%:*}; e=${t##*:}
  [ -s kurs_api_owner.$e ] || { echo "nema kurs_api_owner.$e"; exit 1; }
  want=$(sigma convert -t $b --without-pipeline kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' | grep . | tr -d '\r')
  got=$(grep -v '^Parsing' kurs_api_owner.$e | grep . | tr -d '\r')
  [ "$got" = "$want" ] || { echo "kurs_api_owner.$e nije izlaz backenda $b za tvoje pravilo"; exit 1; }
done
grep -q 'ci-bot' kurs_api_owner.spl && grep -q 'owner' kurs_api_owner.kql || { echo "upiti ne sadrže uslove pravila"; exit 1; }
-->
<!-- hint
```bash
sigma convert -t splunk --without-pipeline kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' > kurs_api_owner.spl
sigma convert -t kusto --without-pipeline kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' > kurs_api_owner.kql
```
U pravom Sentinelu upit bi još trebao ime tabele (npr. iz pipelinea ili ručno: `KursApi_CL | where …`).
-->
<!-- solution
cd /root/sigma
sigma convert -t splunk --without-pipeline kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' > kurs_api_owner.spl
sigma convert -t kusto --without-pipeline kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' > kurs_api_owner.kql
-->

## Pipeline za Elastic (ECS)

U Elasticu se ista polja zovu po Elastic Common Schema: `action` → `event.action`, `user` → `user.name`, `src_ip` → `source.ip`, `target` → `user.target.name`. Napiši pipeline `/root/sigma/kurs-ecs.yml` (transformacija `field_name_mapping`) i njime konvertuj pravilo za backend `lucene` u `/root/sigma/kurs_api_owner.lucene`.

```bash
sigma convert -t lucene -p kurs-ecs.yml kurs_api_owner.yml
```

<!-- verify
cd /root/sigma
[ -f kurs-ecs.yml ] || { echo "nema kurs-ecs.yml"; exit 1; }
out=$(sigma convert -t lucene -p kurs-ecs.yml kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' | grep .)
echo "$out" | grep -q 'event.action:role_changed' || { echo "pipeline ne mapira action u event.action"; exit 1; }
echo "$out" | grep -q 'user.name:ci\\-bot' || { echo "pipeline ne mapira user u user.name"; exit 1; }
echo "$out" | grep -qE '(^|[^.])\baction:' && { echo "u upitu je ostalo nemapirano polje action"; exit 1; }
t=$(mktemp -d); printf 'title: t\nlogsource: {product: kurs, service: api}\ndetection:\n  s: {src_ip: 10.0.0.1, target: ana}\n  condition: s\n' > $t/t.yml
o2=$(sigma convert -t lucene -p kurs-ecs.yml $t/t.yml 2>/dev/null | grep -v '^Parsing'); rm -rf $t
echo "$o2" | grep -q 'source.ip' && echo "$o2" | grep -q 'user.target.name' || { echo "pipeline ne mapira src_ip i target"; exit 1; }
[ "$(grep -v '^Parsing' kurs_api_owner.lucene 2>/dev/null | grep .)" = "$out" ] || { echo "kurs_api_owner.lucene nije izlaz konverzije sa pipelineom"; exit 1; }
-->
<!-- hint
```yaml
name: kurs-ecs
priority: 30
transformations:
  - id: kurs_ecs_polja
    type: field_name_mapping
    mapping:
      action: event.action
      user: user.name
      src_ip: source.ip
      target: user.target.name
```
-->
<!-- solution
cd /root/sigma
cat > kurs-ecs.yml <<'EOF'
name: kurs-ecs
priority: 30
transformations:
  - id: kurs_ecs_polja
    type: field_name_mapping
    mapping:
      action: event.action
      user: user.name
      src_ip: source.ip
      target: user.target.name
EOF
sigma convert -t lucene -p kurs-ecs.yml kurs_api_owner.yml 2>/dev/null | grep -v '^Parsing' > kurs_api_owner.lucene
-->
