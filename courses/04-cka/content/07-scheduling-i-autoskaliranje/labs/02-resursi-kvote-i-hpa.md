# Lab 2: Resursi, kvote i HPA

Namespace `team-a` dijeli klaster sa drugim timovima. Postavićeš podrazumijevane resurse i kvotu, a zatim autoskaliranje aplikacije prema opterećenju CPU-a.

<!-- setup
set -e
cluster-up
kubectl create ns team-a >/dev/null
-->

## LimitRange i ResourceQuota

U namespaceu `team-a` napravi:

1. **LimitRange** `default-resources` za kontejnere: podrazumijevani request `cpu: 100m, memory: 64Mi`, podrazumijevani limit `cpu: 200m, memory: 128Mi`,
2. **ResourceQuota** `team-a-quota`: ukupno najviše `requests.cpu: "1"`, `limits.memory: 1Gi`, `pods: "6"`.

Zatim pokreni Pod `probni` (`nginx:1.28`) **bez** resursa u manifestu i provjeri koje je vrijednosti dobio.

```bash
kubectl -n team-a get pod probni -o jsonpath='{.spec.containers[0].resources}'
kubectl -n team-a describe quota
```

<!-- verify
kubectl -n team-a get limitrange default-resources >/dev/null 2>&1 || { echo "LimitRange default-resources ne postoji"; exit 1; }
q=$(kubectl -n team-a get resourcequota team-a-quota -o json 2>/dev/null) || { echo "ResourceQuota team-a-quota ne postoji"; exit 1; }
[ "$(echo "$q" | jq -r '.spec.hard."requests.cpu"')" = "1" ] && [ "$(echo "$q" | jq -r '.spec.hard."limits.memory"')" = "1Gi" ] && [ "$(echo "$q" | jq -r '.spec.hard.pods')" = "6" ] || { echo "kvota nema requests.cpu=1, limits.memory=1Gi, pods=6"; exit 1; }
r=$(kubectl -n team-a get pod probni -o jsonpath='{.spec.containers[0].resources.requests.cpu}/{.spec.containers[0].resources.limits.memory}' 2>/dev/null)
[ "$r" = "100m/128Mi" ] || { echo "Pod probni nema podrazumijevane resurse iz LimitRange (dobijeno: ${r:-nema poda})"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: v1
kind: LimitRange
metadata: {name: default-resources, namespace: team-a}
spec:
  limits:
  - type: Container
    defaultRequest: {cpu: 100m, memory: 64Mi}
    default: {cpu: 200m, memory: 128Mi}
```
Kvota: `kubectl -n team-a create quota team-a-quota --hard=requests.cpu=1,limits.memory=1Gi,pods=6`. LimitRange djeluje samo na Podove napravljene **poslije** njega.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: LimitRange
metadata: {name: default-resources, namespace: team-a}
spec:
  limits:
  - type: Container
    defaultRequest: {cpu: 100m, memory: 64Mi}
    default: {cpu: 200m, memory: 128Mi}
EOF
kubectl -n team-a create quota team-a-quota --hard=requests.cpu=1,limits.memory=1Gi,pods=6
kubectl -n team-a run probni --image=nginx:1.28
-->

## Kvota u akciji

Napravi Deployment `veliki` (`nginx:1.28`, 3 replike) u kom svaki kontejner ima `requests.cpu: 400m` i `limits.cpu: 400m` (bez limita bi podrazumijevani limit od 200m iz LimitRange bio manji od requesta, pa bi Pod bio odbijen iz drugog razloga). Zbroj prelazi kvotu (`probni` već troši 100m), pa će ReplicaSet napraviti samo dio Podova.

U `/root/kvota.txt` upiši koliko replika deploymenta `veliki` stvarno radi i objasni u jednom redu zašto (npr. `2 - exceeded quota requests.cpu`). Razlog piše u eventima ReplicaSeta.

<!-- verify
[ "$(kubectl -n team-a get deploy veliki -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' 2>/dev/null)" = "400m" ] || { echo "Deployment veliki sa requests.cpu=400m ne postoji"; exit 1; }
n=$(kubectl -n team-a get deploy veliki -o jsonpath='{.status.readyReplicas}')
head -c1 /root/kvota.txt 2>/dev/null | grep -qx "${n:-x}" || { echo "kvota.txt ne počinje stvarnim brojem replika ($n)"; exit 1; }
grep -qi 'quota' /root/kvota.txt || { echo "kvota.txt ne pominje quota"; exit 1; }
-->
<!-- hint
`kubectl -n team-a create deploy veliki --image=nginx:1.28 --replicas=3`, pa `kubectl -n team-a set resources deploy veliki --requests=cpu=400m --limits=cpu=400m`. Razlog: `kubectl -n team-a describe rs -l app=veliki | grep -i quota`.
-->
<!-- solution
kubectl -n team-a create deploy veliki --image=nginx:1.28 --replicas=3 --dry-run=client -o yaml | sed 's/resources: {}/resources: {requests: {cpu: 400m}, limits: {cpu: 400m}}/' | kubectl apply -f -
sleep 15
n=$(kubectl -n team-a get deploy veliki -o jsonpath='{.status.readyReplicas}')
echo "$n - exceeded quota requests.cpu" > /root/kvota.txt
-->

## HPA

Obriši deployment `veliki`. Zatim:

1. instaliraj **metrics-server** iz `/opt/kurs/manifests/metrics-server.yaml`. U ovom labu kubeleti imaju self-signed certifikate, pa metrics-serveru dodaj argument `--kubelet-insecure-tls`.
2. Napravi Deployment `php` (`nginx:1.28`, `requests.cpu: 100m`) i **HPA** `php` za njega: min 1, max 4 replike, ciljna iskorištenost CPU-a 50%.

```bash
kubectl apply -f /opt/kurs/manifests/metrics-server.yaml
kubectl -n kube-system edit deploy metrics-server
kubectl top nodes
kubectl -n team-a autoscale deploy php --min=1 --max=4 --cpu=50%
kubectl -n team-a get hpa
```

<!-- verify
kubectl -n team-a get deploy veliki >/dev/null 2>&1 && { echo "deployment veliki još postoji"; exit 1; }
kubectl top nodes >/dev/null 2>&1 || { echo "kubectl top nodes ne radi (metrics-server?)"; exit 1; }
h=$(kubectl -n team-a get hpa php -o json 2>/dev/null) || { echo "HPA php ne postoji"; exit 1; }
[ "$(echo "$h" | jq -r '.spec.minReplicas,.spec.maxReplicas' | tr '\n' ' ')" = "1 4 " ] || { echo "HPA nema min 1 / max 4"; exit 1; }
[ "$(echo "$h" | jq -r '.spec.metrics[0].resource.target.averageUtilization')" = "50" ] || { echo "HPA cilj nije 50% CPU"; exit 1; }
echo "$h" | jq -e '.status.currentMetrics[0].resource.current.averageUtilization != null' >/dev/null || { echo "HPA još ne vidi metriku (sačekaj ~1 min; TARGETS ne smije biti <unknown>)"; exit 1; }
-->
<!-- hint
U metrics-server Deploymentu dodaj u `args` liniju `- --kubelet-insecure-tls`. HPA treba `requests.cpu` na kontejneru: bez njega iskorištenost u procentima nema osnovu i `TARGETS` ostaje `<unknown>`. Napomena: od kubectl v1.35 flag za CPU cilj je `--cpu=50%` (ranije `--cpu-percent`).
-->
<!-- solution
kubectl -n team-a delete deploy veliki
kubectl apply -f /opt/kurs/manifests/metrics-server.yaml >/dev/null
kubectl -n kube-system patch deploy metrics-server --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl -n kube-system rollout status deploy/metrics-server --timeout=180s
kubectl -n team-a create deploy php --image=nginx:1.28 --dry-run=client -o yaml | sed 's/resources: {}/resources: {requests: {cpu: 100m}}/' | kubectl apply -f -
kubectl -n team-a rollout status deploy/php --timeout=120s
kubectl -n team-a autoscale deploy php --min=1 --max=4 --cpu=50% 2>/dev/null || kubectl -n team-a autoscale deploy php --min=1 --max=4 --cpu-percent=50
for i in $(seq 60); do kubectl -n team-a get hpa php -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' | grep -q . && break; sleep 3; done
-->
