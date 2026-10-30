# Lab 1: Prvi sigurnosni job u pipelineu

Repo `kurs-shop` ima pipeline sa dvije faze (`build`, `test`) i nijednom sigurnosnom kontrolom. Pipeline ćeš pokretati lokalno alatom **gitlab-ci-local**, koji izvršava `.gitlab-ci.yml` kao GitLab runner sa shell executorom.

U ovom labu dodaješ prvu kontrolu (SAST sa Semgrepom), uvodiš je prvo kao upozorenje, pa kao pravi **quality gate**.

```bash
cd /root/kurs-shop
cat .gitlab-ci.yml
gitlab-ci-local --list
gitlab-ci-local
```

<!-- setup
set -e
kurs-repo
-->

## Pokreni postojeći pipeline

Pokreni cijeli pipeline sa `gitlab-ci-local` i uvjeri se da oba joba prolaze. Zatim u `/root/jobovi.txt` upiši imena jobova iz pipelinea, svako u svom redu (ispis `gitlab-ci-local --list`).

<!-- verify
cd /root/kurs-shop
[ -s /root/jobovi.txt ] || { echo "/root/jobovi.txt ne postoji ili je prazan"; exit 1; }
for j in build unit-test; do grep -qw "$j" /root/jobovi.txt || { echo "u jobovi.txt nema joba $j"; exit 1; }; done
[ -d .gitlab-ci-local ] || { echo "pipeline još nije pokrenut (nema direktorija .gitlab-ci-local)"; exit 1; }
-->
<!-- hint
`gitlab-ci-local --list` ispisuje tabelu jobova; prva kolona je ime. Možeš i `yq 'keys' .gitlab-ci.yml`, ali tu su i `stages`.
-->
<!-- solution
cd /root/kurs-shop && gitlab-ci-local >/dev/null 2>&1
printf 'build\nunit-test\n' > /root/jobovi.txt
-->

## Dodaj SAST job kao upozorenje

Dodaj fazu `security` (poslije `test`) i job `sast` u njoj:

- komanda: `semgrep scan --config /opt/kurs/semgrep-rules --error --json --output semgrep.json .`
- `allow_failure: true` (za sada samo upozorava, ne blokira)
- izvještaj `semgrep.json` sačuvaj kao artefakt i kad job padne (`artifacts: when: always`)

Pokreni pipeline: job `sast` treba da padne (aplikacija ima ranjivosti), ali pipeline u cjelini da prođe.

```bash
gitlab-ci-local sast
jq '.results[] | {rule: .check_id, line: .start.line}' semgrep.json
```

<!-- verify
cd /root/kurs-shop
[ "$(yq '.stages | contains(["security"])' .gitlab-ci.yml)" = "true" ] || { echo "nema faze security u stages"; exit 1; }
[ "$(yq '.sast.stage' .gitlab-ci.yml)" = "security" ] || { echo "job sast nije u fazi security"; exit 1; }
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q 'semgrep' || { echo "job sast ne pokreće semgrep"; exit 1; }
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q -- '--error' || { echo "semgrep treba --error (izlazni kod 1 kad ima nalaza)"; exit 1; }
[ "$(yq '.sast.allow_failure' .gitlab-ci.yml)" = "true" ] || { echo "sast treba allow_failure: true"; exit 1; }
[ "$(yq '.sast.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "artefakti sast joba se ne čuvaju kad job padne (artifacts: when: always)"; exit 1; }
yq '.sast.artifacts.paths[]' .gitlab-ci.yml | grep -qx 'semgrep.json' || { echo "semgrep.json nije u artifacts.paths"; exit 1; }
rm -f semgrep.json
gitlab-ci-local > /tmp/gcl.log 2>&1 || { tail -20 /tmp/gcl.log; echo "pipeline pada; sast treba samo upozoriti"; exit 1; }
[ -s semgrep.json ] || { echo "pipeline nije napravio semgrep.json"; exit 1; }
[ "$(jq '.results | length' semgrep.json)" -gt 0 ] || { echo "semgrep.json nema nalaza: da li je aplikacija već popravljena?"; exit 1; }
-->
<!-- hint
```yaml
stages: [build, test, security]

sast:
  stage: security
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --error --json --output semgrep.json .
  allow_failure: true
  artifacts:
    when: always
    paths: [semgrep.json]
```
U ispisu `gitlab-ci-local` job sa dozvoljenim padom je označen kao upozorenje, a pipeline završava uspješno.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.stages += ["security"]' .gitlab-ci.yml
yq -i '.sast = {"stage": "security", "script": ["semgrep scan --config /opt/kurs/semgrep-rules --error --json --output semgrep.json ."], "allow_failure": true, "artifacts": {"when": "always", "paths": ["semgrep.json"]}}' .gitlab-ci.yml
gitlab-ci-local >/dev/null 2>&1
-->

## Pretvori upozorenje u gate

Tim je dogovorio: nalazi ozbiljnosti **ERROR** (injection, nesigurna deserializacija) blokiraju pipeline, a **WARNING** samo upozoravaju.

1. Job `sast` neka skenira samo ERROR nalaze (`--severity ERROR`) i više nema `allow_failure`.
2. Dodaj job `sast-upozorenja` u istoj fazi koji skenira samo WARNING (`--severity WARNING --error`) i ima `allow_failure: true`.
3. Pokreni pipeline: sada mora pasti na jobu `sast`. Rezultat (izlazni kod) upiši u `/root/gate-rc.txt`.

```bash
gitlab-ci-local; echo $? > /root/gate-rc.txt
```

<!-- verify
cd /root/kurs-shop
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q -- '--severity[ =]ERROR' || { echo "sast treba --severity ERROR"; exit 1; }
[ "$(yq '.sast.allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "sast i dalje ima allow_failure"; exit 1; }
yq '.["sast-upozorenja"].script | join(" ")' .gitlab-ci.yml | grep -q -- '--severity[ =]WARNING' || { echo "sast-upozorenja treba --severity WARNING"; exit 1; }
[ "$(yq '.["sast-upozorenja"].allow_failure' .gitlab-ci.yml)" = "true" ] || { echo "sast-upozorenja treba allow_failure: true"; exit 1; }
[ "$(yq '.["sast-upozorenja"].stage' .gitlab-ci.yml)" = "security" ] || { echo "sast-upozorenja nije u fazi security"; exit 1; }
gitlab-ci-local > /tmp/gcl.log 2>&1 && { echo "pipeline prolazi, a aplikacija ima ERROR nalaze: gate ne radi"; exit 1; }
grep -q 'sast-upozorenja' /tmp/gcl.log || { echo "job sast-upozorenja se nije pokrenuo"; exit 1; }
[ "$(tr -d ' \n' < /root/gate-rc.txt 2>/dev/null)" != "0" ] && [ -n "$(tr -d ' \n' < /root/gate-rc.txt 2>/dev/null)" ] || { echo "/root/gate-rc.txt treba izlazni kod pipelinea (različit od 0)"; exit 1; }
-->
<!-- hint
```yaml
sast:
  stage: security
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --json --output semgrep.json .
  artifacts:
    when: always
    paths: [semgrep.json]

sast-upozorenja:
  stage: security
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --severity WARNING --error .
  allow_failure: true
```
`yq -i 'del(.sast.allow_failure)' .gitlab-ci.yml` briše polje.
-->
<!-- solution
cd /root/kurs-shop
yq -i 'del(.sast.allow_failure) | .sast.script = ["semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --json --output semgrep.json ."]' .gitlab-ci.yml
yq -i '.["sast-upozorenja"] = {"stage": "security", "script": ["semgrep scan --config /opt/kurs/semgrep-rules --severity WARNING --error ."], "allow_failure": true}' .gitlab-ci.yml
gitlab-ci-local >/dev/null 2>&1; echo $? > /root/gate-rc.txt
-->
