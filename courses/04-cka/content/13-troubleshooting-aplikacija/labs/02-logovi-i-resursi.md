# Lab 2: Logovi i potrošnja resursa

Tipični „kratki“ CKA zadaci: pronađi Pod koji troši najviše resursa, izvuci određene linije iz logova i upiši rezultat u fajl. Rezultat se ocjenjuje iz fajla, pa je format bitan.

<!-- setup
set -e
cluster-up
kubectl apply -f /opt/kurs/manifests/metrics-server.yaml >/dev/null
kubectl -n kube-system patch deploy metrics-server --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' >/dev/null
kubectl create ns analytics >/dev/null
for n in mirni zauzet srednji; do
  case $n in mirni) cmd='sleep 36000';; zauzet) cmd='while true; do :; done';; srednji) cmd='while true; do i=0; while [ $i -lt 2000 ]; do i=$((i+1)); done; sleep 0.2; done';; esac
  kubectl -n analytics run $n --image=busybox:1.37 -l app=analytics -- sh -c "$cmd" >/dev/null
done
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: v1
kind: Pod
metadata: {name: gateway, namespace: analytics}
spec:
  containers:
  - name: proxy
    image: busybox:1.37
    command: ["sh", "-c", "i=0; while true; do i=$((i+1)); if [ $((i % 7)) -eq 0 ]; then echo \"$(date -Iseconds) ERROR upstream timeout id=$i\"; else echo \"$(date -Iseconds) INFO request ok id=$i\"; fi; sleep 0.5; done"]
  - name: auth
    image: busybox:1.37
    command: ["sh", "-c", "while true; do echo \"$(date -Iseconds) INFO token validated\"; sleep 2; done"]
EOF
kubectl -n kube-system rollout status deploy/metrics-server --timeout=180s >/dev/null
kubectl -n analytics wait --for=condition=Ready pod --all --timeout=120s >/dev/null
-->

## Pod sa najvećom potrošnjom CPU-a

U namespaceu `analytics` pronađi Pod sa oznakom `app=analytics` koji troši **najviše CPU-a** i upiši **samo njegovo ime** u `/root/max-cpu.txt`.

Metrike stižu oko minut poslije pokretanja metrics-servera.

```bash
kubectl top pods -n analytics -l app=analytics --sort-by=cpu
```

<!-- verify
want=$(kubectl top pods -n analytics -l app=analytics --sort-by=cpu --no-headers 2>/dev/null | head -1 | awk '{print $1}')
[ -n "$want" ] || { echo "metrike još nisu dostupne"; exit 1; }
[ "$(tr -d ' \n' < /root/max-cpu.txt 2>/dev/null)" = "$want" ] || { echo "max-cpu.txt ne sadrži ime Poda sa najvećom potrošnjom CPU-a"; exit 1; }
-->
<!-- solution
for i in $(seq 60); do kubectl top pods -n analytics -l app=analytics --no-headers >/dev/null 2>&1 && break; sleep 3; done
kubectl top pods -n analytics -l app=analytics --sort-by=cpu --no-headers | head -1 | awk '{print $1}' > /root/max-cpu.txt
-->

## Greške iz logova jednog kontejnera

Pod `gateway` ima dva kontejnera: `proxy` i `auth`. Iz kontejnera `proxy` izvuci sve linije koje sadrže `ERROR` i sačuvaj ih u `/root/greske.log`. Fajl mora imati barem 3 linije i ne smije sadržati linije bez `ERROR`.

```bash
kubectl -n analytics logs gateway
kubectl -n analytics logs gateway -c proxy | grep ERROR > /root/greske.log
```

<!-- verify
[ "$(grep -c ERROR /root/greske.log 2>/dev/null)" -ge 3 ] || { echo "greske.log nema barem 3 ERROR linije"; exit 1; }
grep -qv ERROR /root/greske.log && { echo "greske.log sadrži i linije bez ERROR"; exit 1; }
grep -q 'upstream timeout' /root/greske.log || { echo "linije nisu iz kontejnera proxy"; exit 1; }
exit 0
-->
<!-- hint
Bez `-c` kubectl ne zna iz kog kontejnera da čita i javi grešku. Spisak kontejnera: `kubectl -n analytics get pod gateway -o jsonpath='{.spec.containers[*].name}'`.
-->
<!-- solution
sleep 12
kubectl -n analytics logs gateway -c proxy | grep ERROR > /root/greske.log
-->

## Čvor sa najviše memorije

U `/root/cvor-memorija.txt` upiši ime čvora sa **najvećom potrošnjom memorije** (apsolutno, u bajtovima), a u drugi red njegov procenat iskorištenosti memorije kako ga prikazuje `kubectl top nodes` (npr. `12%`).

<!-- verify
l=$(kubectl top nodes --no-headers --sort-by=memory 2>/dev/null | head -1)
n=$(echo "$l" | awk '{print $1}')
[ "$(sed -n 1p /root/cvor-memorija.txt 2>/dev/null | tr -d ' ')" = "$n" ] || { echo "prvi red nije ime čvora sa najvećom potrošnjom memorije ($n)"; exit 1; }
sed -n 2p /root/cvor-memorija.txt | grep -Eq '^ *[0-9]+% *$' || { echo "drugi red nije procenat (npr. 12%)"; exit 1; }
-->
<!-- hint
`kubectl top nodes --sort-by=memory`. Kolona `MEMORY(%)` se malo mijenja iz sekunde u sekundu, pa je provjera tolerantna na tačan broj.
-->
<!-- solution
kubectl top nodes --no-headers --sort-by=memory | head -1 | awk '{print $1; print $5}' > /root/cvor-memorija.txt
-->
