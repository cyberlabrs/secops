# Lab 2: Node NotReady

Monitoring reports that `node01` is `NotReady` and that new Pods are not being scheduled. There are **two** failures in the cluster, one after the other. Fix both, so that `node01` is `Ready` and the Deployment `web` (2 replicas) is running.

```bash
kubectl get nodes
kubectl describe node node01 | grep -A8 Conditions
ssh node01
systemctl status kubelet
journalctl -u kubelet -n 30 --no-pager
```

<!-- setup
set -e
cluster-up
kubectl create deploy web --image=nginx:1.28 --replicas=2 >/dev/null
kubectl rollout status deploy/web --timeout=120s >/dev/null
cat > /root/kolega.sh <<'EOF'
#!/bin/bash
# simulira "optimizaciju" konfiguracije kubeleta na node01
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca-cert.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
touch /root/.kolega
echo "kolega je izmijenio konfiguraciju kubeleta na node01"
EOF
chmod +x /root/kolega.sh
ssh node01 'systemctl stop kubelet && systemctl disable kubelet' >/dev/null 2>&1
for i in $(seq 90); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" != "True" ] && break; sleep 2; done
-->

## Failure 1: kubelet

Find out why `node01` is not reporting its status and fix it. The fix must survive a node reboot.

<!-- verify
ssh node01 systemctl is-enabled kubelet 2>/dev/null | grep -qx enabled || { echo "kubelet on node01 is not enabled (it would not start after a reboot)"; exit 1; }
ssh node01 systemctl is-active kubelet 2>/dev/null | grep -qx active || { echo "kubelet on node01 is not running"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 is not Ready yet"; exit 1; }
-->
<!-- hint
`ssh node01 systemctl status kubelet` shows `inactive (dead)` and `disabled`. Fix: `systemctl enable --now kubelet`.
-->
<!-- solution
ssh node01 systemctl enable --now kubelet >/dev/null 2>&1
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Failure 2: wrong kubelet configuration

Meanwhile, a colleague has "optimized" the kubelet configuration on node01. Run the script that simulates their change:

```bash
/root/kolega.sh
```

The kubelet on node01 now keeps crashing and restarting. Find the error in the log and fix the configuration.

<!-- verify
[ -f /root/.kolega ] || { echo "run /root/kolega.sh first"; exit 1; }
ssh node01 systemctl is-active kubelet 2>/dev/null | grep -qx active || { echo "kubelet on node01 is not running"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 is not Ready"; exit 1; }
kubectl rollout status deploy/web --timeout=5s >/dev/null 2>&1 || { echo "deployment web is not ready"; exit 1; }
-->
<!-- hint
`ssh node01 journalctl -u kubelet -n 20 --no-pager` shows an error while reading the CA file (`clientCAFile`). The configuration is in `/var/lib/kubelet/config.yaml` on node01. The correct path is `/etc/kubernetes/pki/ca.crt`. After the change: `systemctl restart kubelet`.
-->
<!-- solution
[ -f /root/.kolega ] || /root/kolega.sh
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && ssh node01 systemctl is-active kubelet | grep -qx active && break; sleep 2; done
kubectl rollout status deploy/web --timeout=120s
-->
