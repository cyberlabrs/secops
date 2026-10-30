# Lab 3: Probe, sidecar i DaemonSet

Tri zadatka iz prakse:

- Service šalje saobraćaj Podovima koji još nisu spremni,
- logove treba čitati iz sidecar kontejnera,
- na svakom čvoru mora raditi agent.

<!-- setup
set -e
cluster-up
kubectl create ns web >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: web
spec:
  replicas: 2
  selector:
    matchLabels: {app: frontend}
  template:
    metadata:
      labels: {app: frontend}
    spec:
      containers:
      - name: nginx
        image: nginx:1.28
        ports:
        - containerPort: 80
EOF
-->

## Readiness i liveness probe

Dodaj kontejneru `nginx` u Deploymentu `frontend`:

- **readinessProbe**: `httpGet` na putanju `/` i port 80, `periodSeconds: 5`,
- **livenessProbe**: `tcpSocket` na port 80, `initialDelaySeconds: 10`, `periodSeconds: 10`.

```bash
kubectl -n web edit deploy frontend
kubectl explain pod.spec.containers.readinessProbe
```

<!-- verify
c='{.spec.template.spec.containers[0]'
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.readinessProbe.httpGet.path}")" = "/" ] || { echo "readinessProbe httpGet path / nije podešen"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.readinessProbe.httpGet.port}")" = "80" ] || { echo "readinessProbe port nije 80"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.livenessProbe.tcpSocket.port}")" = "80" ] || { echo "livenessProbe tcpSocket 80 nije podešen"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.livenessProbe.initialDelaySeconds}")" = "10" ] || { echo "livenessProbe initialDelaySeconds nije 10"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "frontend nema 2 spremne replike"; exit 1; }
-->
<!-- solution
kubectl -n web patch deploy frontend --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/readinessProbe","value":{"httpGet":{"path":"/","port":80},"periodSeconds":5}},{"op":"add","path":"/spec/template/spec/containers/0/livenessProbe","value":{"tcpSocket":{"port":80},"initialDelaySeconds":10,"periodSeconds":10}}]'
kubectl -n web rollout status deploy frontend --timeout=180s
-->

## Native sidecar za logove

nginx u ovoj konfiguraciji piše access log u fajl. Dodaj Deploymentu `frontend`:

1. volume `logs` tipa `emptyDir`, montiran u `nginx` na `/var/log/nginx`,
2. **native sidecar** `log-tail` (`busybox:1.37`) u `initContainers` sa `restartPolicy: Always`, koji montira isti volume i izvršava `tail -F /var/log/nginx/access.log`.

Sidecar se pokreće prije glavnog kontejnera i radi cijelo vrijeme. Poslije toga `kubectl -n web logs <pod> -c log-tail` prikazuje zahtjeve.

<!-- verify
s=$(kubectl -n web get deploy frontend -o json)
echo "$s" | jq -e '.spec.template.spec.initContainers[]? | select(.name=="log-tail" and .restartPolicy=="Always")' >/dev/null || { echo "nema initContainera log-tail sa restartPolicy: Always"; exit 1; }
echo "$s" | jq -e '.spec.template.spec.volumes[]? | select(.name=="logs" and .emptyDir!=null)' >/dev/null || { echo "nema emptyDir volumena logs"; exit 1; }
echo "$s" | jq -e '.spec.template.spec.containers[0].volumeMounts[]? | select(.name=="logs" and .mountPath=="/var/log/nginx")' >/dev/null || { echo "nginx ne montira logs na /var/log/nginx"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath='{.status.readyReplicas}/{.status.updatedReplicas}')" = "2/2" ] || { echo "rollout nije završen"; exit 1; }
p=$(kubectl -n web get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}')
ip=$(kubectl -n web get pod $p -o jsonpath='{.status.podIP}')
curl -s -o /dev/null "http://$ip/provjera-sidecara"; sleep 2
kubectl -n web logs $p -c log-tail 2>/dev/null | grep -q provjera-sidecara || { echo "log-tail ne prikazuje zahtjeve iz access.log"; exit 1; }
-->
<!-- hint
```yaml
      initContainers:
      - name: log-tail
        image: busybox:1.37
        restartPolicy: Always
        command: ["sh", "-c", "tail -F /var/log/nginx/access.log"]
        volumeMounts:
        - {name: logs, mountPath: /var/log/nginx}
      volumes:
      - name: logs
        emptyDir: {}
```
U zvaničnoj nginx slici `access.log` je link na stdout. Kad montiraš praznu `emptyDir` preko `/var/log/nginx`, nginx počinje pisati u pravi fajl.
-->
<!-- solution
kubectl -n web patch deploy frontend --type=json -p='[
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"logs","emptyDir":{}}]},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"logs","mountPath":"/var/log/nginx"}]},
{"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"log-tail","image":"busybox:1.37","restartPolicy":"Always","command":["sh","-c","tail -F /var/log/nginx/access.log"],"volumeMounts":[{"name":"logs","mountPath":"/var/log/nginx"}]}]}]'
kubectl -n web rollout status deploy frontend --timeout=180s
-->

## DaemonSet na svim čvorovima

Napravi DaemonSet `node-agent` u namespaceu `kube-system` (`busybox:1.37`, komanda `sleep infinity`, oznaka `app=node-agent`). Mora raditi na **oba** čvora, uključujući `controlplane`, koji ima taint `node-role.kubernetes.io/control-plane:NoSchedule`.

<!-- verify
d=$(kubectl -n kube-system get ds node-agent -o jsonpath='{.status.desiredNumberScheduled}/{.status.numberReady}' 2>/dev/null)
[ "$d" = "2/2" ] || { echo "DaemonSet node-agent: desired/ready je ${d:-ne postoji}, treba 2/2"; exit 1; }
kubectl -n kube-system get pods -l app=node-agent -o jsonpath='{.items[*].spec.nodeName}' | grep -q controlplane || { echo "node-agent ne radi na controlplane"; exit 1; }
-->
<!-- hint
`kubectl create deploy node-agent --image=busybox:1.37 -n kube-system --dry-run=client -o yaml -- sleep infinity > ds.yaml`, promijeni `kind` u `DaemonSet`, ukloni `replicas` i `strategy`, pa dodaj toleraciju:
```yaml
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
  namespace: kube-system
spec:
  selector:
    matchLabels: {app: node-agent}
  template:
    metadata:
      labels: {app: node-agent}
    spec:
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: agent
        image: busybox:1.37
        command: ["sleep", "infinity"]
EOF
kubectl -n kube-system rollout status ds/node-agent --timeout=120s
-->
