# Lab 2: Nepromjenljivi kontejneri i istraga procesa

Napadač koji dođe u kontejner obično prvo nešto **upiše**: alat, skriptu, izmijenjenu konfiguraciju. Kontejner koji ne može mijenjati vlastiti fajl sistem (**immutable**) mu to onemogućava.

U namespaceu `web` radi Deployment `portal`. Kroz ranjivost u aplikaciji je u kontejner već ubačen proces koji „rudari“.

```bash
kubectl -n web get pods -o wide
kubectl -n web exec deploy/portal -- ps aux
```

<!-- setup
set -e
cluster-up
kubectl create ns web >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata: {name: portal, namespace: web}
spec:
  replicas: 1
  selector: {matchLabels: {app: portal}}
  template:
    metadata: {labels: {app: portal}}
    spec:
      nodeName: node01
      containers:
      - name: portal
        image: nginx:1.28
EOF
kubectl -n web rollout status deploy/portal --timeout=120s >/dev/null
P=$(kubectl -n web get pod -l app=portal -o jsonpath='{.items[0].metadata.name}')
kubectl -n web exec $P -- sh -c 'cp /bin/sleep /tmp/kworkerd && (nohup /tmp/kworkerd 86400 >/dev/null 2>&1 &)'
-->

## Istraga sa čvora

Pronađi sumnjivi proces **sa čvora** `node01`, kao da nemaš pristup kontejneru:

1. pronađi PID procesa `kworkerd` na node01,
2. iz `/proc/<pid>/` saznaj putanju njegovog izvršnog fajla (link `exe`), onako kako je vidi kontejner,
3. preko `crictl` pronađi kom kontejneru i Podu pripada.

U `/root/istraga.txt` (na controlplane) upiši tri reda: PID na node01, putanju fajla (npr. `/tmp/…`) i ime Poda.

```bash
ssh node01
ps -ef | grep kworkerd
ls -l /proc/<pid>/exe
cat /proc/<pid>/cgroup
crictl ps
```

<!-- verify
pid=$(ssh node01 pgrep -x kworkerd | head -1)
pod=$(kubectl -n web get pod -l app=portal -o jsonpath='{.items[0].metadata.name}')
f=/root/istraga.txt
[ "$(sed -n 1p $f 2>/dev/null | tr -d ' ')" = "$pid" ] || { echo "prvi red nije PID procesa kworkerd na node01 ($pid)"; exit 1; }
sed -n 2p $f | grep -q '/tmp/kworkerd' || { echo "drugi red nije putanja fajla"; exit 1; }
[ "$(sed -n 3p $f | tr -d ' ')" = "$pod" ] || { echo "treći red nije ime Poda"; exit 1; }
-->
<!-- hint
`readlink /proc/<pid>/exe` daje putanju unutar kontejnera. Pod: `crictl ps` + `crictl inspect <id> | grep -m1 '"pid"'` za glavni proces kontejnera, ili jednostavno `crictl ps --pod $(crictl pods --name portal -q)`. U `/proc/<pid>/cgroup` se vidi ID kontejnera.
-->
<!-- solution
pid=$(ssh node01 pgrep -x kworkerd | head -1)
path=$(ssh node01 readlink /proc/$pid/exe)
pod=$(kubectl -n web get pod -l app=portal -o jsonpath='{.items[0].metadata.name}')
printf '%s\n%s\n%s\n' "$pid" "$path" "$pod" > /root/istraga.txt
-->

## Immutable portal

Izmijeni Deployment `portal` tako da kontejner ne može pisati po svom fajl sistemu:

- `readOnlyRootFilesystem: true`,
- nginx-u ipak treba pisanje u `/var/cache/nginx`, `/var/run` i `/tmp`: za njih dodaj `emptyDir` volumene,
- `allowPrivilegeEscalation: false`.

Novi Pod mora raditi (nginx odgovara), a pokušaj upisa u `/usr/share/nginx/html` ili `/bin` mora pasti. Rollout zamjenjuje i kompromitovani Pod.

<!-- verify
c=$(kubectl -n web get deploy portal -o jsonpath='{.spec.template.spec.containers[0].securityContext}')
echo "$c" | grep -q '"readOnlyRootFilesystem":true' || { echo "nema readOnlyRootFilesystem: true"; exit 1; }
echo "$c" | grep -q '"allowPrivilegeEscalation":false' || { echo "nema allowPrivilegeEscalation: false"; exit 1; }
kubectl -n web rollout status deploy/portal --timeout=5s >/dev/null 2>&1 || { echo "rollout nije završen (nginx se možda ne podiže: kubectl -n web logs deploy/portal)"; exit 1; }
p=$(kubectl -n web get pod -l app=portal -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n web exec $p -- sh -c 'echo x > /usr/share/nginx/html/hack.html' 2>/dev/null && { echo "upis u /usr/share/nginx/html i dalje radi"; exit 1; }
kubectl -n web exec $p -- sh -c 'cp /bin/sleep /bin/kworkerd' 2>/dev/null && { echo "upis u /bin i dalje radi"; exit 1; }
ip=$(kubectl -n web get pod $p -o jsonpath='{.status.podIP}')
curl -s -m 3 http://$ip | grep -qi nginx || { echo "nginx ne odgovara"; exit 1; }
ssh node01 pgrep -x kworkerd >/dev/null && { echo "kompromitovani proces i dalje radi"; exit 1; }
exit 0
-->
<!-- hint
```yaml
      containers:
      - name: portal
        image: nginx:1.28
        securityContext:
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
        volumeMounts:
        - {name: cache, mountPath: /var/cache/nginx}
        - {name: run, mountPath: /var/run}
        - {name: tmp, mountPath: /tmp}
      volumes:
      - {name: cache, emptyDir: {}}
      - {name: run, emptyDir: {}}
      - {name: tmp, emptyDir: {}}
```
Ako nginx ne krene, `kubectl -n web logs` kaže u koji direktorij nije mogao pisati.
-->
<!-- solution
kubectl -n web patch deploy portal --type=json -p='[
{"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"readOnlyRootFilesystem":true,"allowPrivilegeEscalation":false}},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"cache","mountPath":"/var/cache/nginx"},{"name":"run","mountPath":"/var/run"},{"name":"tmp","mountPath":"/tmp"}]},
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"cache","emptyDir":{}},{"name":"run","emptyDir":{}},{"name":"tmp","emptyDir":{}}]}]'
kubectl -n web rollout status deploy/portal --timeout=180s
for i in $(seq 30); do ssh node01 pgrep -x kworkerd >/dev/null || break; sleep 2; done
-->
