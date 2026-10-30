# Lab 2: Immutable containers and process investigation

An attacker who gets into a container usually **writes** something first: a tool, a script, a modified configuration. A container that can't modify its own filesystem (**immutable**) prevents that.

The Deployment `portal` is running in the `web` namespace. Through a vulnerability in the application, a "mining" process has already been planted in the container.

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

## Investigation from the node

Find the suspicious process **from the node** `node01`, as if you had no access to the container:

1. find the PID of the `kworkerd` process on node01,
2. from `/proc/<pid>/`, find the path of its executable (the `exe` link) as the container sees it,
3. using `crictl`, find which container and Pod it belongs to.

In `/root/istraga.txt` (on the controlplane), write three lines: the PID on node01, the file path (e.g. `/tmp/…`) and the Pod name.

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
[ "$(sed -n 1p $f 2>/dev/null | tr -d ' ')" = "$pid" ] || { echo "the first line is not the PID of the kworkerd process on node01 ($pid)"; exit 1; }
sed -n 2p $f | grep -q '/tmp/kworkerd' || { echo "the second line is not the file path"; exit 1; }
[ "$(sed -n 3p $f | tr -d ' ')" = "$pod" ] || { echo "the third line is not the Pod name"; exit 1; }
-->
<!-- hint
`readlink /proc/<pid>/exe` gives the path inside the container. Pod: `crictl ps` + `crictl inspect <id> | grep -m1 '"pid"'` for the container's main process, or simply `crictl ps --pod $(crictl pods --name portal -q)`. The container ID is visible in `/proc/<pid>/cgroup`.
-->
<!-- solution
pid=$(ssh node01 pgrep -x kworkerd | head -1)
path=$(ssh node01 readlink /proc/$pid/exe)
pod=$(kubectl -n web get pod -l app=portal -o jsonpath='{.items[0].metadata.name}')
printf '%s\n%s\n%s\n' "$pid" "$path" "$pod" > /root/istraga.txt
-->

## Immutable portal

Change the Deployment `portal` so the container can't write to its filesystem:

- `readOnlyRootFilesystem: true`,
- nginx still needs to write to `/var/cache/nginx`, `/var/run` and `/tmp`: add `emptyDir` volumes for them,
- `allowPrivilegeEscalation: false`.

The new Pod must work (nginx responds), and an attempt to write to `/usr/share/nginx/html` or `/bin` must fail. The rollout also replaces the compromised Pod.

<!-- verify
c=$(kubectl -n web get deploy portal -o jsonpath='{.spec.template.spec.containers[0].securityContext}')
echo "$c" | grep -q '"readOnlyRootFilesystem":true' || { echo "readOnlyRootFilesystem: true is missing"; exit 1; }
echo "$c" | grep -q '"allowPrivilegeEscalation":false' || { echo "allowPrivilegeEscalation: false is missing"; exit 1; }
kubectl -n web rollout status deploy/portal --timeout=5s >/dev/null 2>&1 || { echo "the rollout has not finished (nginx may not be starting: kubectl -n web logs deploy/portal)"; exit 1; }
p=$(kubectl -n web get pod -l app=portal -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n web exec $p -- sh -c 'echo x > /usr/share/nginx/html/hack.html' 2>/dev/null && { echo "writing to /usr/share/nginx/html still works"; exit 1; }
kubectl -n web exec $p -- sh -c 'cp /bin/sleep /bin/kworkerd' 2>/dev/null && { echo "writing to /bin still works"; exit 1; }
ip=$(kubectl -n web get pod $p -o jsonpath='{.status.podIP}')
curl -s -m 3 http://$ip | grep -qi nginx || { echo "nginx does not respond"; exit 1; }
ssh node01 pgrep -x kworkerd >/dev/null && { echo "the compromised process is still running"; exit 1; }
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
If nginx doesn't start, `kubectl -n web logs` tells you which directory it couldn't write to.
-->
<!-- solution
kubectl -n web patch deploy portal --type=json -p='[
{"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"readOnlyRootFilesystem":true,"allowPrivilegeEscalation":false}},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"cache","mountPath":"/var/cache/nginx"},{"name":"run","mountPath":"/var/run"},{"name":"tmp","mountPath":"/tmp"}]},
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"cache","emptyDir":{}},{"name":"run","emptyDir":{}},{"name":"tmp","emptyDir":{}}]}]'
kubectl -n web rollout status deploy/portal --timeout=180s
for i in $(seq 30); do ssh node01 pgrep -x kworkerd >/dev/null || break; sleep 2; done
-->
