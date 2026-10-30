# Lab 3: Probes, a sidecar and a DaemonSet

Three real-world tasks:

- a Service sends traffic to Pods that are not ready yet,
- logs need to be read from a sidecar container,
- an agent must run on every node.

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

## Readiness and liveness probes

Add to the `nginx` container in Deployment `frontend`:

- **readinessProbe**: `httpGet` on path `/` and port 80, `periodSeconds: 5`,
- **livenessProbe**: `tcpSocket` on port 80, `initialDelaySeconds: 10`, `periodSeconds: 10`.

```bash
kubectl -n web edit deploy frontend
kubectl explain pod.spec.containers.readinessProbe
```

<!-- verify
c='{.spec.template.spec.containers[0]'
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.readinessProbe.httpGet.path}")" = "/" ] || { echo "readinessProbe httpGet path / is not configured"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.readinessProbe.httpGet.port}")" = "80" ] || { echo "readinessProbe port is not 80"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.livenessProbe.tcpSocket.port}")" = "80" ] || { echo "livenessProbe tcpSocket 80 is not configured"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath="$c.livenessProbe.initialDelaySeconds}")" = "10" ] || { echo "livenessProbe initialDelaySeconds is not 10"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "frontend does not have 2 ready replicas"; exit 1; }
-->
<!-- solution
kubectl -n web patch deploy frontend --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/readinessProbe","value":{"httpGet":{"path":"/","port":80},"periodSeconds":5}},{"op":"add","path":"/spec/template/spec/containers/0/livenessProbe","value":{"tcpSocket":{"port":80},"initialDelaySeconds":10,"periodSeconds":10}}]'
kubectl -n web rollout status deploy frontend --timeout=180s
-->

## A native sidecar for logs

In this configuration nginx writes its access log to a file. Add to Deployment `frontend`:

1. a volume `logs` of type `emptyDir`, mounted in `nginx` at `/var/log/nginx`,
2. a **native sidecar** `log-tail` (`busybox:1.37`) in `initContainers` with `restartPolicy: Always`, which mounts the same volume and runs `tail -F /var/log/nginx/access.log`.

The sidecar starts before the main container and runs the whole time. After that, `kubectl -n web logs <pod> -c log-tail` shows the requests.

<!-- verify
s=$(kubectl -n web get deploy frontend -o json)
echo "$s" | jq -e '.spec.template.spec.initContainers[]? | select(.name=="log-tail" and .restartPolicy=="Always")' >/dev/null || { echo "no initContainer log-tail with restartPolicy: Always"; exit 1; }
echo "$s" | jq -e '.spec.template.spec.volumes[]? | select(.name=="logs" and .emptyDir!=null)' >/dev/null || { echo "no emptyDir volume logs"; exit 1; }
echo "$s" | jq -e '.spec.template.spec.containers[0].volumeMounts[]? | select(.name=="logs" and .mountPath=="/var/log/nginx")' >/dev/null || { echo "nginx does not mount logs at /var/log/nginx"; exit 1; }
[ "$(kubectl -n web get deploy frontend -o jsonpath='{.status.readyReplicas}/{.status.updatedReplicas}')" = "2/2" ] || { echo "the rollout has not finished"; exit 1; }
p=$(kubectl -n web get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}')
ip=$(kubectl -n web get pod $p -o jsonpath='{.status.podIP}')
curl -s -o /dev/null "http://$ip/provjera-sidecara"; sleep 2
kubectl -n web logs $p -c log-tail 2>/dev/null | grep -q provjera-sidecara || { echo "log-tail does not show the requests from access.log"; exit 1; }
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
In the official nginx image `access.log` is a link to stdout. When you mount an empty `emptyDir` over `/var/log/nginx`, nginx starts writing to a real file.
-->
<!-- solution
kubectl -n web patch deploy frontend --type=json -p='[
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"logs","emptyDir":{}}]},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"logs","mountPath":"/var/log/nginx"}]},
{"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"log-tail","image":"busybox:1.37","restartPolicy":"Always","command":["sh","-c","tail -F /var/log/nginx/access.log"],"volumeMounts":[{"name":"logs","mountPath":"/var/log/nginx"}]}]}]'
kubectl -n web rollout status deploy frontend --timeout=180s
-->

## A DaemonSet on all nodes

Create a DaemonSet `node-agent` in namespace `kube-system` (`busybox:1.37`, command `sleep infinity`, label `app=node-agent`). It must run on **both** nodes, including `controlplane`, which has the `node-role.kubernetes.io/control-plane:NoSchedule` taint.

<!-- verify
d=$(kubectl -n kube-system get ds node-agent -o jsonpath='{.status.desiredNumberScheduled}/{.status.numberReady}' 2>/dev/null)
[ "$d" = "2/2" ] || { echo "DaemonSet node-agent: desired/ready is ${d:-missing}, it should be 2/2"; exit 1; }
kubectl -n kube-system get pods -l app=node-agent -o jsonpath='{.items[*].spec.nodeName}' | grep -q controlplane || { echo "node-agent is not running on controlplane"; exit 1; }
-->
<!-- hint
`kubectl create deploy node-agent --image=busybox:1.37 -n kube-system --dry-run=client -o yaml -- sleep infinity > ds.yaml`, change `kind` to `DaemonSet`, remove `replicas` and `strategy`, then add the toleration:
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
