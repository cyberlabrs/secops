# Lab 2: Logs and resource usage

Typical "short" CKA tasks: find the Pod that uses the most resources, extract specific lines from logs and write the result to a file. The result is graded from the file, so the format matters.

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

## Pod with the highest CPU usage

In namespace `analytics`, find the Pod with label `app=analytics` that uses the **most CPU** and write **only its name** to `/root/max-cpu.txt`.

Metrics arrive about a minute after metrics-server starts.

```bash
kubectl top pods -n analytics -l app=analytics --sort-by=cpu
```

<!-- verify
want=$(kubectl top pods -n analytics -l app=analytics --sort-by=cpu --no-headers 2>/dev/null | head -1 | awk '{print $1}')
[ -n "$want" ] || { echo "metrics are not available yet"; exit 1; }
[ "$(tr -d ' \n' < /root/max-cpu.txt 2>/dev/null)" = "$want" ] || { echo "max-cpu.txt does not contain the name of the Pod with the highest CPU usage"; exit 1; }
-->
<!-- solution
for i in $(seq 60); do kubectl top pods -n analytics -l app=analytics --no-headers >/dev/null 2>&1 && break; sleep 3; done
kubectl top pods -n analytics -l app=analytics --sort-by=cpu --no-headers | head -1 | awk '{print $1}' > /root/max-cpu.txt
-->

## Errors from the logs of a single container

Pod `gateway` has two containers: `proxy` and `auth`. From container `proxy`, extract all lines containing `ERROR` and save them to `/root/greske.log` (`greske` = errors). The file must have at least 3 lines and must not contain lines without `ERROR`.

```bash
kubectl -n analytics logs gateway
kubectl -n analytics logs gateway -c proxy | grep ERROR > /root/greske.log
```

<!-- verify
[ "$(grep -c ERROR /root/greske.log 2>/dev/null)" -ge 3 ] || { echo "greske.log does not have at least 3 ERROR lines"; exit 1; }
grep -qv ERROR /root/greske.log && { echo "greske.log also contains lines without ERROR"; exit 1; }
grep -q 'upstream timeout' /root/greske.log || { echo "the lines are not from container proxy"; exit 1; }
exit 0
-->
<!-- hint
Without `-c`, kubectl does not know which container to read from and reports an error. List of containers: `kubectl -n analytics get pod gateway -o jsonpath='{.spec.containers[*].name}'`.
-->
<!-- solution
sleep 12
kubectl -n analytics logs gateway -c proxy | grep ERROR > /root/greske.log
-->

## Node with the most memory

Write to `/root/cvor-memorija.txt` (`cvor-memorija` = node-memory) the name of the node with the **highest memory usage** (absolute, in bytes), and on the second line its memory utilization percentage as shown by `kubectl top nodes` (e.g. `12%`).

<!-- verify
l=$(kubectl top nodes --no-headers --sort-by=memory 2>/dev/null | head -1)
n=$(echo "$l" | awk '{print $1}')
[ "$(sed -n 1p /root/cvor-memorija.txt 2>/dev/null | tr -d ' ')" = "$n" ] || { echo "the first line is not the name of the node with the highest memory usage ($n)"; exit 1; }
sed -n 2p /root/cvor-memorija.txt | grep -Eq '^ *[0-9]+% *$' || { echo "the second line is not a percentage (e.g. 12%)"; exit 1; }
-->
<!-- hint
`kubectl top nodes --sort-by=memory`. The `MEMORY(%)` column changes slightly from second to second, so the check does not require an exact match on the number.
-->
<!-- solution
kubectl top nodes --no-headers --sort-by=memory | head -1 | awk '{print $1; print $5}' > /root/cvor-memorija.txt
-->
