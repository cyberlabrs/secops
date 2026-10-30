# Lab 1: CIS benchmark with kube-bench

An audit requires the cluster to pass the key checks of the **CIS Kubernetes Benchmark**. You will use `kube-bench`, which checks the configuration of the components on a node and provides a fix (remediation) for each finding.

```bash
kube-bench run --targets master | less
kube-bench run --targets master --check 1.2.15
ssh node01 kube-bench run --targets node
```

The output has `[PASS]`, `[FAIL]` and `[WARN]` sections, and at the end `== Remediations ==` with exact instructions for each finding.

<!-- setup
set -e
cluster-up
# "privremena" konfiguracija kubeleta na node01, ostala od debugiranja
ssh node01 'awk '"'"'
/^  anonymous:/ {print; getline; print "    enabled: true"; next}
/^  mode: Webhook/ {print "  mode: AlwaysAllow"; next}
{print}'"'"' /var/lib/kubelet/config.yaml > /tmp/k.yaml && cat /tmp/k.yaml > /var/lib/kubelet/config.yaml && systemctl restart kubelet'
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Profiling in the control plane

kube-bench reports `FAIL` for **1.2.15**, **1.3.2** and **1.4.1**: kube-apiserver, kube-controller-manager and kube-scheduler have profiling enabled (`/debug/pprof`). Profiling reveals details about how a component works and increases the attack surface.

Fix all three components so that those three checks are `PASS`. You'll find the manifests in `/etc/kubernetes/manifests/`.

<!-- verify
out=$(kube-bench run --targets master --check 1.2.15,1.3.2,1.4.1 2>/dev/null)
for c in 1.2.15 1.3.2 1.4.1; do echo "$out" | grep -q "^\[PASS\] $c " || { echo "kube-bench $c is not PASS yet"; exit 1; }; done
kubectl get nodes >/dev/null 2>&1 || { echo "the API server is not responding (wait for the components to restart)"; exit 1; }
-->
<!-- hint
Add `- --profiling=false` to the `command` list of each of the three manifests. The kubelet restarts a static Pod when its manifest changes; watch `watch crictl ps`.
-->
<!-- solution
for f in kube-apiserver kube-controller-manager kube-scheduler; do
  grep -q -- '--profiling=false' /etc/kubernetes/manifests/$f.yaml || sed -i "s#^\(\s*\)- $f\$#\1- $f\n\1- --profiling=false#" /etc/kubernetes/manifests/$f.yaml
done
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
for f in kube-apiserver kube-controller-manager kube-scheduler; do kubectl -n kube-system wait --for=condition=Ready pod/$f-controlplane --timeout=120s >/dev/null; done
-->

## Ownership of the etcd directory

Check **1.1.12** requires the etcd data directory to belong to the `etcd` user. No such user exists on the node.

Create a system user `etcd` (without a login shell) and set the ownership of the data directory to `etcd:etcd`. Find the directory in the etcd manifest (`--data-dir`).

<!-- verify
kube-bench run --targets master --check 1.1.12 2>/dev/null | grep -q '^\[PASS\] 1.1.12 ' || { echo "kube-bench 1.1.12 is not PASS yet"; exit 1; }
getent passwd etcd | grep -q nologin || { echo "the etcd user does not have a nologin shell"; exit 1; }
-->
<!-- hint
`useradd -r -s /usr/sbin/nologin etcd` and `chown -R etcd:etcd /var/lib/etcd`. The etcd container runs as root, so the ownership change doesn't affect how it works.
-->
<!-- solution
id etcd >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin etcd
chown -R etcd:etcd /var/lib/etcd
-->

## Kubelet on node01

Run the node check on `node01`. Someone left the kubelet open:

- anonymous requests are allowed (**4.2.1**),
- authorization is `AlwaysAllow` (**4.2.2**), so anyone who reaches port 10250 can execute commands in containers on that node.

Fix the kubelet configuration on `node01` (`/var/lib/kubelet/config.yaml`) so that 4.2.1 and 4.2.2 are `PASS`, and restart the kubelet.

```bash
ssh node01 kube-bench run --targets node --check 4.2.1,4.2.2
ssh node01 grep -A8 '^authentication' /var/lib/kubelet/config.yaml
curl -sk https://node01:10250/pods | head -c 200
```

<!-- verify
out=$(ssh node01 kube-bench run --targets node --check 4.2.1,4.2.2 2>/dev/null)
for c in 4.2.1 4.2.2; do echo "$out" | grep -q "^\[PASS\] $c " || { echo "kube-bench $c is not PASS yet on node01"; exit 1; }; done
code=$(curl -sk -o /dev/null -w '%{http_code}' https://node01:10250/pods)
[ "$code" = "401" ] || { echo "an anonymous request to the kubelet API returns $code (expected 401)"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 is not Ready"; exit 1; }
-->
<!-- hint
In `config.yaml`: `authentication.anonymous.enabled: false` and `authorization.mode: Webhook`. Then `systemctl restart kubelet` on node01.
-->
<!-- solution
ssh node01 "sed -i '/^  anonymous:/{n;s/enabled: true/enabled: false/}; s/^  mode: AlwaysAllow/  mode: Webhook/' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
sleep 3
-->
