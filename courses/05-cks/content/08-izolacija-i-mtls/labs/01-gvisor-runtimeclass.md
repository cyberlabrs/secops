# Lab 1: Sandbox kontejneri sa gVisorom

Kontejneri dijele kernel čvora: ranjivost u kernelu ili bijeg iz kontejnera daje napadaču čvor. **gVisor** (`runsc`) ubacuje korisnički kernel između aplikacije i pravog kernela. Aplikacija priča sa gVisorom, a ne direktno sa hostom.

Na čvorovima je instaliran `runsc`, a containerd ima handler `runsc`. Tvoj zadatak je da ga izložiš Kubernetesu kroz **RuntimeClass** i pokreneš nepouzdan workload u sandboxu.

```bash
ssh node01 grep -A2 runsc /etc/containerd/config.toml
ssh node01 runsc --version
```

<!-- setup
set -e
cluster-up
kubectl create ns untrusted >/dev/null
kubectl -n untrusted create deploy scraper --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl -n untrusted rollout status deploy/scraper --timeout=120s >/dev/null
-->

## RuntimeClass

Napravi RuntimeClass `gvisor` sa handlerom `runsc`.

<!-- verify
[ "$(kubectl get runtimeclass gvisor -o jsonpath='{.handler}' 2>/dev/null)" = "runsc" ] || { echo "RuntimeClass gvisor sa handlerom runsc ne postoji"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata: {name: gvisor}
handler: runsc
EOF
-->

## Nepouzdan workload u sandboxu

Deployment `scraper` u namespaceu `untrusted` obrađuje sadržaj sa interneta. Izmijeni ga tako da radi pod RuntimeClass `gvisor`.

Provjeri razliku: u gVisor kontejneru `dmesg` prikazuje poruke gVisora, a `uname -r` drugačiju verziju kernela od čvora.

```bash
kubectl -n untrusted exec deploy/scraper -- dmesg | head -3
kubectl -n untrusted exec deploy/scraper -- uname -r
uname -r
```

<!-- verify
[ "$(kubectl -n untrusted get deploy scraper -o jsonpath='{.spec.template.spec.runtimeClassName}')" = "gvisor" ] || { echo "scraper nema runtimeClassName: gvisor"; exit 1; }
kubectl -n untrusted rollout status deploy/scraper --timeout=5s >/dev/null 2>&1 || { echo "rollout scraper nije završen"; exit 1; }
p=$(kubectl -n untrusted get pod -l app=scraper -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n untrusted exec $p -- dmesg 2>/dev/null | grep -qi gvisor || { echo "Pod ne radi u gVisoru"; exit 1; }
-->
<!-- solution
kubectl -n untrusted patch deploy scraper -p '{"spec":{"template":{"spec":{"runtimeClassName":"gvisor"}}}}'
kubectl -n untrusted rollout status deploy/scraper --timeout=180s
sleep 5
-->

## Sandbox samo na odabranim čvorovima

U produkciji gVisor obično nije instaliran na svim čvorovima. RuntimeClass može sam usmjeriti Podove na čvorove koji ga podržavaju (`scheduling.nodeSelector`).

1. Označi `node01` sa `runtime=gvisor`.
2. U RuntimeClass `gvisor` dodaj `scheduling.nodeSelector: {runtime: gvisor}`.
3. Uradi `rollout restart` deploymenta `scraper`. Svi njegovi Podovi moraju biti na `node01`, iako Deployment nema nodeSelector.

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.metadata.labels.runtime}')" = "gvisor" ] || { echo "node01 nema oznaku runtime=gvisor"; exit 1; }
[ "$(kubectl get runtimeclass gvisor -o jsonpath='{.scheduling.nodeSelector.runtime}')" = "gvisor" ] || { echo "RuntimeClass nema scheduling.nodeSelector runtime=gvisor"; exit 1; }
kubectl -n untrusted get deploy scraper -o jsonpath='{.spec.template.spec.nodeSelector}' | grep -q . && { echo "Deployment ne treba vlastiti nodeSelector"; exit 1; }
kubectl -n untrusted rollout status deploy/scraper --timeout=5s >/dev/null 2>&1 || { echo "rollout nije završen"; exit 1; }
p=$(kubectl -n untrusted get pod -l app=scraper -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0]')
[ "$(echo "$p" | jq -r '.spec.nodeName')" = "node01" ] || { echo "scraper nije na node01"; exit 1; }
echo "$p" | jq -e '.spec.nodeSelector.runtime == "gvisor"' >/dev/null || { echo "Pod nije napravljen poslije izmjene RuntimeClassa (uradi rollout restart)"; exit 1; }
-->
<!-- hint
RuntimeClass admission dodaje `nodeSelector` iz RuntimeClassa u Pod pri kreiranju. Postojeći Podovi se ne mijenjaju, zato treba `kubectl -n untrusted rollout restart deploy scraper`.
-->
<!-- solution
kubectl label node node01 runtime=gvisor --overwrite
kubectl patch runtimeclass gvisor --type=merge -p '{"scheduling":{"nodeSelector":{"runtime":"gvisor"}}}'
kubectl -n untrusted rollout restart deploy scraper
kubectl -n untrusted rollout status deploy/scraper --timeout=180s
sleep 5
-->
