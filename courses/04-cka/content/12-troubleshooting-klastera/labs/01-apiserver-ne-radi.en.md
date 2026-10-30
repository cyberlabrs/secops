# Lab 1: kube-apiserver is down

Someone "tuned" the API server and the cluster stopped responding:

```bash
kubectl get nodes
# The connection to the server controlplane:6443 was refused
```

When the API server is down, `kubectl` does not help. Use the tools on the node itself: `crictl`, the logs in `/var/log/pods/` and `journalctl -u kubelet`.

<!-- setup
set -e
cluster-up
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/.kube-apiserver.orig
sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:2381#' /etc/kubernetes/manifests/kube-apiserver.yaml
cat > /root/pokvari-yaml.sh <<'EOF'
#!/bin/bash
# simulira grešku u kucanju u manifestu kube-apiservera
sed -i 's/^  containers:/  contianers:/' /etc/kubernetes/manifests/kube-apiserver.yaml
touch /root/.yaml-pokvaren
echo "manifest kube-apiservera je izmijenjen"
EOF
chmod +x /root/pokvari-yaml.sh
sleep 5
for i in $(seq 60); do kubectl get nodes >/dev/null 2>&1 || break; sleep 2; done
-->

## Find the cause

1. Find the kube-apiserver container (including the ones that have already crashed) and read its log.
2. Write to `/root/uzrok.txt` the wrong value of the flag that prevents the API server from connecting to etcd (e.g. `https://…:port`).

```bash
crictl ps -a | grep kube-apiserver
crictl logs <container-id> 2>&1 | tail -20
ls /var/log/pods/ | grep apiserver
grep etcd /etc/kubernetes/manifests/kube-apiserver.yaml
grep listen-client /etc/kubernetes/manifests/etcd.yaml
```

<!-- verify
grep -q '127.0.0.1:2381' /root/uzrok.txt 2>/dev/null || { echo "uzrok.txt does not contain the wrong etcd address"; exit 1; }
-->
<!-- hint
The API server log repeats an error like `dial tcp 127.0.0.1:2381: connect: connection refused`. The etcd client port is 2379 (see `--listen-client-urls` in `etcd.yaml`), and 2381 is the etcd metrics/health port.
-->
<!-- solution
grep -o 'etcd-servers=[^ ]*' /etc/kubernetes/manifests/kube-apiserver.yaml | cut -d= -f2 > /root/uzrok.txt
-->

## Fix the API server

Fix the manifest `/etc/kubernetes/manifests/kube-apiserver.yaml`. The kubelet notices the change on its own and restarts the static Pod within 20-60 seconds.

<!-- verify
grep -q 'etcd-servers=https://127.0.0.1:2379' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "--etcd-servers is not correct yet"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "the API server is not responding yet (wait a bit)"; exit 1; }
[ "$(kubectl -n kube-system get pod kube-apiserver-controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "the kube-apiserver Pod is not Ready"; exit 1; }
-->
<!-- hint
Before editing, make a copy of the manifest **outside** `/etc/kubernetes/manifests/`. The kubelet runs every YAML file in that directory, so a copy inside it creates a second API server. Watch with `watch crictl ps`.
-->
<!-- solution
sed -i 's#--etcd-servers=https://127.0.0.1:2381#--etcd-servers=https://127.0.0.1:2379#' /etc/kubernetes/manifests/kube-apiserver.yaml
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s
-->

## Second failure: invalid YAML

Break the manifest in a different way and observe what happens. For this step, a script does it for you:

```bash
/root/pokvari-yaml.sh
crictl ps | grep apiserver
journalctl -u kubelet --since "2 min ago" | grep -i apiserver | tail -5
```

When the YAML is invalid, there is **no** new container and no logs in `crictl`. The kubelet cannot even read the manifest, and it says so in **its own** log. Find the error in `journalctl -u kubelet` and fix the manifest.

<!-- verify
[ -f /root/.yaml-pokvaren ] || { echo "run /root/pokvari-yaml.sh first"; exit 1; }
grep -q '^  containers:' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "the manifest still has an error"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "the API server is not responding (wait a bit)"; exit 1; }
-->
<!-- hint
The kubelet logs something like `Could not process manifest file … contianers`. Fix the misspelled field.
-->
<!-- solution
[ -f /root/.yaml-pokvaren ] || /root/pokvari-yaml.sh
sed -i 's/^  contianers:/  containers:/' /etc/kubernetes/manifests/kube-apiserver.yaml
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
-->
