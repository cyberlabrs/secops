# Lab 1: Skeniranje slika i SBOM

U namespaceu `prod` radi nekoliko Podova sa slikama različite starosti. Sigurnosna politika kaže: **u produkciji ne smije raditi nijedna slika sa CRITICAL ranjivostima.**

Trivy je instaliran na čvorovima, a baza ranjivosti je lokalna. U labu Trivy skenira OS pakete u slikama, a slike čita iz lokalnog mirrora.

```bash
kubectl -n prod get pods -o custom-columns=POD:.metadata.name,IMAGE:.spec.containers[*].image
trivy image --severity CRITICAL nginx:1.19
```

<!-- setup
set -e
cluster-up
kubectl create ns prod >/dev/null
kubectl -n prod run web-old --image=nginx:1.19 >/dev/null
kubectl -n prod run legacy-api --image=httpd:2.4.39 >/dev/null
kubectl -n prod run tools --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl -n prod run cache --image=redis:alpine >/dev/null
kubectl -n prod wait --for=condition=Ready pod --all --timeout=180s >/dev/null
trivy image --download-db-only >/dev/null 2>&1 || true
-->

## Pronađi ranjive slike

Skeniraj sliku svakog Poda u `prod` i u `/root/kriticne.txt` upiši imena **Podova** čije slike imaju barem jednu ranjivost nivoa **CRITICAL**, svako u svom redu.

```bash
for img in $(kubectl -n prod get pods -o jsonpath='{.items[*].spec.containers[*].image}'); do
  echo "== $img"; trivy image -q --severity CRITICAL $img | grep Total
done
```

<!-- verify
want=$(for p in $(kubectl -n prod get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n prod get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && echo $p
done | sort)
got=$(grep . /root/kriticne.txt 2>/dev/null | tr -d ' ' | sort)
[ -n "$want" ] && [ "$want" = "$got" ] || { echo "kriticne.txt nije tačan (treba tačno Podovi čije slike imaju CRITICAL ranjivosti)"; exit 1; }
-->
<!-- hint
`trivy image -q --severity CRITICAL -f json <slika> | jq '[.Results[]?.Vulnerabilities[]?] | length'` daje broj nalaza. Pazi na slike za koje Trivy kaže da ne prepoznaje OS (npr. busybox): za njih nema nalaza.
-->
<!-- solution
for p in $(kubectl -n prod get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n prod get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && echo $p
done > /root/kriticne.txt
-->

## Ukloni ih iz produkcije

Obriši sve Podove iz `/root/kriticne.txt`. Ostali Podovi moraju nastaviti da rade.

<!-- verify
[ -s /root/kriticne.txt ] || { echo "nema /root/kriticne.txt"; exit 1; }
for p in $(cat /root/kriticne.txt); do kubectl -n prod get pod $p >/dev/null 2>&1 && { echo "Pod $p i dalje postoji"; exit 1; }; done
n=$(kubectl -n prod get pods --field-selector=status.phase=Running -o name | wc -l)
[ "$n" -ge 1 ] || { echo "obrisani su i Podovi bez kritičnih ranjivosti"; exit 1; }
for p in tools; do kubectl -n prod get pod $p >/dev/null 2>&1 || { echo "Pod $p ne smije biti obrisan"; exit 1; }; done
-->
<!-- solution
kubectl -n prod delete pod $(cat /root/kriticne.txt) --now
-->

## SBOM

Napravi **SBOM** (Software Bill of Materials) u formatu **CycloneDX** za sliku `redis:alpine` i sačuvaj ga u `/root/sbom-redis.json`. SBOM je spisak svih paketa u slici. Iz njega kasnije možeš brzo provjeriti da li si pogođen novom ranjivošću, bez ponovnog skeniranja.

Zatim u `/root/redis-openssl.txt` upiši verziju paketa `openssl` (ili `libssl3`) iz tog SBOM-a.

```bash
trivy image --format cyclonedx --output /root/sbom-redis.json redis:alpine
jq -r '.components[] | select(.name|test("ssl")) | "\(.name) \(.version)"' /root/sbom-redis.json
```

<!-- verify
[ "$(jq -r '.bomFormat' /root/sbom-redis.json 2>/dev/null)" = "CycloneDX" ] || { echo "sbom-redis.json nije CycloneDX SBOM"; exit 1; }
v=$(tr -d ' \n' < /root/redis-openssl.txt 2>/dev/null)
[ -n "$v" ] && jq -r '.components[] | select(.name|test("ssl")) | .version' /root/sbom-redis.json | grep -qx "$v" || { echo "redis-openssl.txt ne sadrži verziju ssl paketa iz SBOM-a"; exit 1; }
-->
<!-- hint
Alternativa je `syft redis:alpine -o cyclonedx-json`, ali syft u labu nema pristup mirroru bez dodatnih podešavanja, pa koristi Trivy. U `redis-openssl.txt` upiši samo verziju, npr. `3.5.1-r0`.
-->
<!-- solution
trivy image -q --format cyclonedx --output /root/sbom-redis.json redis:alpine
jq -r '[.components[] | select(.name|test("ssl"))][0].version' /root/sbom-redis.json > /root/redis-openssl.txt
-->
