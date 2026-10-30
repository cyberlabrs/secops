# Lab 1: Siguran Dockerfile

`Dockerfile` kurs-shopa ima skoro sve klasične greške: `FROM python:latest`, `ADD` cijelog repoa (uključujući `.git`), root korisnik, token u `ENV`, `apt-get` bez čišćenja i shell oblik `CMD`. Prepravićeš ga tako da prođe **hadolint** i **Trivy** provjere konfiguracije, pa dodati job koji to provodi.

```bash
cd /root/kurs-shop
cat Dockerfile
hadolint Dockerfile
trivy config Dockerfile
```

<!-- setup
set -e
kurs-repo
-->

## Prepiši Dockerfile

Novi `Dockerfile` mora:

1. biti **multi-stage**: prvi stage (`AS build`) instalira zavisnosti (`pip install --no-cache-dir --prefix=/install -r requirements.txt`), a završni stage kopira samo rezultat i kod,
2. koristiti fiksnu verziju bazne slike u svim `FROM` linijama (npr. `python:3.13-slim`, nikad `latest` niti bez taga),
3. koristiti `COPY`, ne `ADD`, i ne kopirati cijeli repo (`.git`, `infra/`, `tests/` ne idu u sliku): kopiraj samo `app.py` i `config/`,
4. ne sadržati tajne (`ENV`/`ARG` sa tokenom),
5. u završnom stageu raditi kao **non-root** korisnik (`USER 65532` ili imenovani korisnik koji nije root),
6. koristiti exec oblik: `CMD ["python", "app.py"]` (ili `ENTRYPOINT`).

`ping` iz `/ping` endpointa možeš izostaviti (aplikacija nije dužna da ga ima) ili instalirati u završnom stageu uz pravila hadolinta.

<!-- verify
cd /root/kurs-shop
f=Dockerfile
[ "$(grep -ciE '^FROM ' $f)" -ge 2 ] || { echo "Dockerfile nije multi-stage (treba barem dva FROM)"; exit 1; }
grep -iE '^FROM ' $f | grep -viE '^FROM +[^ ]+:[^ ]+|@sha256:' | grep -q . && { echo "svaki FROM treba fiksnu verziju (tag ili digest)"; exit 1; }
grep -iE '^FROM ' $f | grep -qiE ':latest' && { echo "FROM koristi :latest"; exit 1; }
grep -qiE '^ADD ' $f && { echo "Dockerfile i dalje koristi ADD"; exit 1; }
grep -qiE '^COPY +\. ' $f && { echo "ne kopiraj cijeli repo (COPY . …): samo app.py i config/"; exit 1; }
grep -qE 'glpat-|API_TOKEN' $f && { echo "token je i dalje u Dockerfileu"; exit 1; }
u=$(awk 'toupper($1)=="FROM"{u=""} toupper($1)=="USER"{u=$2} END{print u}' $f)
[ -n "$u" ] && [ "$u" != "root" ] && [ "${u%%:*}" != "0" ] || { echo "završni stage mora imati USER koji nije root"; exit 1; }
grep -qE '^(CMD|ENTRYPOINT) +\[' $f || { echo "koristi exec oblik CMD [\"python\", \"app.py\"]"; exit 1; }
grep -qE 'pip install' $f && ! grep -qE 'pip install[^&]*--no-cache-dir' $f && { echo "pip install treba --no-cache-dir"; exit 1; }
hadolint --failure-threshold warning $f >/tmp/hl.txt 2>&1 || { cat /tmp/hl.txt; echo "hadolint i dalje javlja upozorenja ili greške"; exit 1; }
trivy config -q --severity HIGH,CRITICAL --exit-code 1 $f >/tmp/tc.txt 2>&1 || { grep -E 'DS-?0' /tmp/tc.txt | head; echo "Trivy nalazi HIGH/CRITICAL problem u Dockerfileu"; exit 1; }
-->
<!-- hint
```dockerfile
FROM python:3.13-slim AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app.py ./
COPY config/ ./config/
USER 65532:65532
EXPOSE 8080
CMD ["python", "app.py"]
```
Ako ipak instaliraš paket preko `apt-get`, hadolint traži pinovanu verziju (DL3008); svjesno odstupanje označi komentarom `# hadolint ignore=DL3008` iznad `RUN` linije.
-->
<!-- solution
cd /root/kurs-shop
cat > Dockerfile <<'EOF'
FROM python:3.13-slim AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app.py ./
COPY config/ ./config/
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"]
CMD ["python", "app.py"]
EOF
-->

## .dockerignore i job

1. Napravi `.dockerignore` koji iz build konteksta isključuje barem `.git`, `infra/`, `tests/` i `.gitlab-ci.yml`. Kontekst šalje sve fajlove builderu i kad ih `COPY` ne koristi, pa tajne u `.git` istoriji ne smiju biti dostupne buildu.
2. Dodaj job `dockerfile-lint` (faza `test`) koji pokreće `hadolint --failure-threshold warning Dockerfile` i `trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile`. `gitlab-ci-local dockerfile-lint` mora proći.

<!-- verify
cd /root/kurs-shop
[ -f .dockerignore ] || { echo "nema .dockerignore"; exit 1; }
for p in .git infra tests .gitlab-ci.yml; do grep -Eq "^/?${p//./\\.}/?(\*\*)?$" .dockerignore || { echo ".dockerignore ne isključuje $p"; exit 1; }; done
s=$(yq '.["dockerfile-lint"].script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q 'hadolint' && echo "$s" | grep -q 'trivy config' || { echo "dockerfile-lint treba hadolint i trivy config"; exit 1; }
gitlab-ci-local dockerfile-lint > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "job dockerfile-lint pada"; exit 1; }
cp Dockerfile /tmp/Dockerfile.bak && git show HEAD:Dockerfile > Dockerfile
gitlab-ci-local dockerfile-lint > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/Dockerfile.bak Dockerfile
[ $rc -ne 0 ] || { echo "job ne pada na starom Dockerfileu"; exit 1; }
-->
<!-- hint
```text
.git
infra/
tests/
.gitlab-ci.yml
```
```yaml
dockerfile-lint:
  stage: test
  script:
    - hadolint --failure-threshold warning Dockerfile
    - trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile
```
-->
<!-- solution
cd /root/kurs-shop
printf '.git\ninfra/\ntests/\n.gitlab-ci.yml\n.gitlab-ci-local/\n' > .dockerignore
yq -i '.["dockerfile-lint"] = {"stage": "test", "script": ["hadolint --failure-threshold warning Dockerfile", "trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile"]}' .gitlab-ci.yml
-->
