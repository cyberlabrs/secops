# Lab 1: Sandboxed containers with gVisor

Containers share the node's kernel: a kernel vulnerability or a container escape gives the attacker the node. **gVisor** (`runsc`) inserts a user-space kernel between the application and the real kernel. The application talks to gVisor, not directly to the host.

`runsc` is installed on the nodes, and containerd has a `runsc` handler. Your task is to expose it to Kubernetes through a **RuntimeClass** and run an untrusted workload in the sandbox.

```bash
ssh node01 grep -A2 runsc /etc/containerd/config.toml
ssh node01 runsc --version
```

<!-- setup
set -e
cluster-up
kubectl create ns untrusted >/dev/null
kubectl -n untrusted create deploy scraper --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl -n untrusted rollout status deploy/scraper --timeout=120s >/dev/null
-->

## RuntimeClass

Create a RuntimeClass `gvisor` with the handler `runsc`.

<!-- verify
[ "$(kubectl get runtimeclass gvisor -o jsonpath='{.handler}' 2>/dev/null)" = "runsc" ] || { echo "the RuntimeClass gvisor with handler runsc does not exist"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata: {name: gvisor}
handler: runsc
EOF
-->

## An untrusted workload in the sandbox

The Deployment `scraper` in the `untrusted` namespace processes content from the internet. Change it so it runs under the RuntimeClass `gvisor`.

Check the difference: in a gVisor container `dmesg` shows gVisor messages, and `uname -r` a different kernel version than the node.

```bash
kubectl -n untrusted exec deploy/scraper -- dmesg | head -3
kubectl -n untrusted exec deploy/scraper -- uname -r
uname -r
```

<!-- verify
[ "$(kubectl -n untrusted get deploy scraper -o jsonpath='{.spec.template.spec.runtimeClassName}')" = "gvisor" ] || { echo "scraper does not have runtimeClassName: gvisor"; exit 1; }
kubectl -n untrusted rollout status deploy/scraper --timeout=5s >/dev/null 2>&1 || { echo "the scraper rollout has not finished"; exit 1; }
p=$(kubectl -n untrusted get pod -l app=scraper -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n untrusted exec $p -- dmesg 2>/dev/null | grep -qi gvisor || { echo "the Pod is not running in gVisor"; exit 1; }
-->
<!-- solution
kubectl -n untrusted patch deploy scraper -p '{"spec":{"template":{"spec":{"runtimeClassName":"gvisor"}}}}'
kubectl -n untrusted rollout status deploy/scraper --timeout=180s
sleep 5
-->

## Sandbox only on selected nodes

In production, gVisor usually isn't installed on all nodes. A RuntimeClass can itself steer Pods to the nodes that support it (`scheduling.nodeSelector`).

1. Label `node01` with `runtime=gvisor`.
2. In the RuntimeClass `gvisor`, add `scheduling.nodeSelector: {runtime: gvisor}`.
3. Run a `rollout restart` of the deployment `scraper`. All its Pods must be on `node01`, even though the Deployment has no nodeSelector.

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.metadata.labels.runtime}')" = "gvisor" ] || { echo "node01 does not have the label runtime=gvisor"; exit 1; }
[ "$(kubectl get runtimeclass gvisor -o jsonpath='{.scheduling.nodeSelector.runtime}')" = "gvisor" ] || { echo "the RuntimeClass does not have scheduling.nodeSelector runtime=gvisor"; exit 1; }
kubectl -n untrusted get deploy scraper -o jsonpath='{.spec.template.spec.nodeSelector}' | grep -q . && { echo "the Deployment should not have its own nodeSelector"; exit 1; }
kubectl -n untrusted rollout status deploy/scraper --timeout=5s >/dev/null 2>&1 || { echo "the rollout has not finished"; exit 1; }
p=$(kubectl -n untrusted get pod -l app=scraper -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0]')
[ "$(echo "$p" | jq -r '.spec.nodeName')" = "node01" ] || { echo "scraper is not on node01"; exit 1; }
echo "$p" | jq -e '.spec.nodeSelector.runtime == "gvisor"' >/dev/null || { echo "the Pod was not created after the RuntimeClass change (run rollout restart)"; exit 1; }
-->
<!-- hint
RuntimeClass admission adds the `nodeSelector` from the RuntimeClass to the Pod at creation. Existing Pods aren't changed, which is why you need `kubectl -n untrusted rollout restart deploy scraper`.
-->
<!-- solution
kubectl label node node01 runtime=gvisor --overwrite
kubectl patch runtimeclass gvisor --type=merge -p '{"scheduling":{"nodeSelector":{"runtime":"gvisor"}}}'
kubectl -n untrusted rollout restart deploy scraper
kubectl -n untrusted rollout status deploy/scraper --timeout=180s
sleep 5
-->
