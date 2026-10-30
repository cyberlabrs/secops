# Lab 1: Falco: detection and investigation

**Falco** is installed on `node01` as the systemd service `falco`. It uses modern eBPF and sees all system calls on the node. Several applications are running in the `apps` namespace, and one of them is compromised.

```bash
ssh node01 systemctl status falco
ssh node01 journalctl -u falco -f
```

<!-- setup
set -e
cluster-up
ssh node01 systemctl start falco
kubectl create ns apps >/dev/null
for a in frontend backend reports; do kubectl -n apps create deploy $a --image=nginx:1.28 >/dev/null; done
kubectl -n apps patch deploy frontend -p '{"spec":{"template":{"spec":{"nodeName":"node01"}}}}' >/dev/null
kubectl -n apps patch deploy backend -p '{"spec":{"template":{"spec":{"nodeName":"node01"}}}}' >/dev/null
kubectl -n apps patch deploy reports -p '{"spec":{"template":{"spec":{"nodeName":"node01","containers":[{"name":"nginx","command":["sh","-c","nginx; while true; do sleep 20; cat /etc/shadow > /dev/null; done"]}]}}}}' >/dev/null
for a in frontend backend reports; do kubectl -n apps rollout status deploy/$a --timeout=120s >/dev/null; done
for i in $(seq 60); do ssh node01 journalctl -u falco --no-pager | grep -q 'Sensitive file opened' && break; sleep 3; done
-->

## Find the compromised Pod

Falco is already reporting suspicious activity. From the Falco logs, find out which **Pod** is reading `/etc/shadow` and write its name (the full Pod name) to `/root/napadnut-pod.txt`.

```bash
ssh node01 journalctl -u falco --no-pager | grep -i shadow | tail -3
```

<!-- verify
want=$(kubectl -n apps get pod -l app=reports -o jsonpath='{.items[0].metadata.name}')
[ "$(tr -d ' \n' < /root/napadnut-pod.txt 2>/dev/null)" = "$want" ] || { echo "napadnut-pod.txt does not contain the name of the compromised Pod"; exit 1; }
-->
<!-- hint
The Falco output has a `k8s_pod_name=…` field. If it's missing, take the `container_id` and find the Pod with `ssh node01 crictl inspect <id> | grep io.kubernetes.pod.name`.
-->
<!-- solution
ssh node01 journalctl -u falco --no-pager | grep 'Sensitive file opened' | tail -1 | grep -o 'k8s_pod_name=[^ ]*' | cut -d= -f2 > /root/napadnut-pod.txt
-->

## Isolate and remove

Before deletion, the attacked Pod is isolated so the attacker loses the network while forensics can continue:

1. create a NetworkPolicy `quarantine` in `apps` that blocks all ingress and egress for Pods labeled `quarantine=true`,
2. add that label to the attacked Pod,
3. scale the Deployment `reports` to 0.

<!-- verify
p=$(kubectl -n apps get netpol quarantine -o json 2>/dev/null) || { echo "the NetworkPolicy quarantine does not exist"; exit 1; }
[ "$(echo "$p" | jq -r '.spec.podSelector.matchLabels.quarantine')" = "true" ] || { echo "quarantine does not select quarantine=true"; exit 1; }
[ "$(echo "$p" | jq -r '.spec.policyTypes | sort | join(",")')" = "Egress,Ingress" ] || { echo "quarantine must block Ingress and Egress"; exit 1; }
[ "$(kubectl -n apps get deploy reports -o jsonpath='{.spec.replicas}')" = "0" ] || { echo "reports is not scaled to 0"; exit 1; }
-->
<!-- hint
On the exam the order doesn't matter, but in practice isolate first and only then shut down: that way you cut off the attacker first, and the evidence remains until you've preserved it.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: quarantine, namespace: apps}
spec:
  podSelector: {matchLabels: {quarantine: "true"}}
  policyTypes: [Ingress, Egress]
EOF
kubectl -n apps label pod $(cat /root/napadnut-pod.txt) quarantine=true --overwrite
kubectl -n apps scale deploy reports --replicas=0
-->

## Your own Falco rule

The team wants an alert whenever someone opens a **shell** (`sh`, `bash`) in any container in the `apps` namespace.

In `/etc/falco/falco_rules.local.yaml` on `node01`, add the rule `Shell u apps namespaceu`:

- `condition`: `spawned_process and container and proc.name in (sh, bash) and k8s.ns.name = "apps"` (`spawned_process` and `container` are macros from the default rules)
- `output`: must contain the text `SHELL-APPS` and the fields `k8s.pod.name` and `proc.cmdline`, e.g. `SHELL-APPS pod=%k8s.pod.name cmd=%proc.cmdline`
- `priority: WARNING`

Restart Falco, open a shell in the `frontend` Pod and check that the alert appeared.

```bash
kubectl -n apps exec deploy/frontend -- sh -c 'echo test'
ssh node01 journalctl -u falco --no-pager | grep SHELL-APPS | tail -2
```

<!-- verify
ssh node01 grep -q 'SHELL-APPS' /etc/falco/falco_rules.local.yaml || { echo "the rule is not in falco_rules.local.yaml on node01"; exit 1; }
ssh node01 systemctl is-active falco | grep -qx active || { echo "Falco is not running (error in the rule?): ssh node01 journalctl -u falco -n 20"; exit 1; }
kubectl -n apps exec deploy/frontend -- sh -c 'echo provjera-pravila' >/dev/null 2>&1; sleep 4
ssh node01 journalctl -u falco --since "-2min" --no-pager | grep 'SHELL-APPS' | grep -q 'frontend' || { echo "the SHELL-APPS alert for frontend does not appear"; exit 1; }
-->
<!-- hint
```yaml
- rule: Shell u apps namespaceu
  desc: Shell started in a container in the apps namespace
  condition: spawned_process and container and proc.name in (sh, bash) and k8s.ns.name = "apps"
  output: "SHELL-APPS pod=%k8s.pod.name cmd=%proc.cmdline user=%user.name"
  priority: WARNING
```
After the change: `systemctl restart falco` and `journalctl -u falco -n 20`. If the rule is invalid, Falco doesn't come up and the log says why.
-->
<!-- solution
ssh node01 'cat >> /etc/falco/falco_rules.local.yaml <<EOF

- rule: Shell u apps namespaceu
  desc: Shell pokrenut u kontejneru u namespaceu apps
  condition: spawned_process and container and proc.name in (sh, bash) and k8s.ns.name = "apps"
  output: "SHELL-APPS pod=%k8s.pod.name cmd=%proc.cmdline user=%user.name"
  priority: WARNING
EOF
systemctl restart falco'
sleep 15
-->
