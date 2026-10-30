# Lab 1: Image scanning and SBOM

Several Pods with images of varying age are running in the `prod` namespace. The security policy says: **no image with CRITICAL vulnerabilities may run in production.**

Trivy is installed on the nodes, and the vulnerability database is local. In the lab Trivy scans the OS packages in the images and reads the images from a local mirror.

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

## Find the vulnerable images

Scan the image of every Pod in `prod` and write to `/root/kriticne.txt` the names of the **Pods** whose images have at least one vulnerability of severity **CRITICAL**, one per line.

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
[ -n "$want" ] && [ "$want" = "$got" ] || { echo "kriticne.txt is not correct (it must contain exactly the Pods whose images have CRITICAL vulnerabilities)"; exit 1; }
-->
<!-- hint
`trivy image -q --severity CRITICAL -f json <image> | jq '[.Results[]?.Vulnerabilities[]?] | length'` gives the number of findings. Watch out for images where Trivy says it doesn't recognize the OS (e.g. busybox): there are no findings for them.
-->
<!-- solution
for p in $(kubectl -n prod get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n prod get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && echo $p
done > /root/kriticne.txt
-->

## Remove them from production

Delete all Pods listed in `/root/kriticne.txt`. The other Pods must keep running.

<!-- verify
[ -s /root/kriticne.txt ] || { echo "/root/kriticne.txt does not exist"; exit 1; }
for p in $(cat /root/kriticne.txt); do kubectl -n prod get pod $p >/dev/null 2>&1 && { echo "Pod $p still exists"; exit 1; }; done
n=$(kubectl -n prod get pods --field-selector=status.phase=Running -o name | wc -l)
[ "$n" -ge 1 ] || { echo "Pods without critical vulnerabilities were deleted too"; exit 1; }
for p in tools; do kubectl -n prod get pod $p >/dev/null 2>&1 || { echo "Pod $p must not be deleted"; exit 1; }; done
-->
<!-- solution
kubectl -n prod delete pod $(cat /root/kriticne.txt) --now
-->

## SBOM

Create an **SBOM** (Software Bill of Materials) in **CycloneDX** format for the image `redis:alpine` and save it to `/root/sbom-redis.json`. An SBOM is a list of all packages in the image. Later you can use it to quickly check whether you are affected by a new vulnerability, without rescanning.

Then write the version of the `openssl` (or `libssl3`) package from that SBOM to `/root/redis-openssl.txt`.

```bash
trivy image --format cyclonedx --output /root/sbom-redis.json redis:alpine
jq -r '.components[] | select(.name|test("ssl")) | "\(.name) \(.version)"' /root/sbom-redis.json
```

<!-- verify
[ "$(jq -r '.bomFormat' /root/sbom-redis.json 2>/dev/null)" = "CycloneDX" ] || { echo "sbom-redis.json is not a CycloneDX SBOM"; exit 1; }
v=$(tr -d ' \n' < /root/redis-openssl.txt 2>/dev/null)
[ -n "$v" ] && jq -r '.components[] | select(.name|test("ssl")) | .version' /root/sbom-redis.json | grep -qx "$v" || { echo "redis-openssl.txt does not contain the ssl package version from the SBOM"; exit 1; }
-->
<!-- hint
An alternative is `syft redis:alpine -o cyclonedx-json`, but in the lab syft has no access to the mirror without extra configuration, so use Trivy. Write only the version to `redis-openssl.txt`, e.g. `3.5.1-r0`.
-->
<!-- solution
trivy image -q --format cyclonedx --output /root/sbom-redis.json redis:alpine
jq -r '[.components[] | select(.name|test("ssl"))][0].version' /root/sbom-redis.json > /root/redis-openssl.txt
-->
