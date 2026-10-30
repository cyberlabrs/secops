# Lab 2: seccomp profiles

**seccomp** filters the system calls (syscalls) a process may make to the kernel. Kubernetes offers `RuntimeDefault` (the container runtime's default profile) and `Localhost` (your own profile from `/var/lib/kubelet/seccomp/` on the node).

In the `secure` namespace, the Pod `legacy` runs without a seccomp profile (`Unconfined`).

```bash
kubectl -n secure get pod legacy -o jsonpath='{.spec.securityContext}'
kubectl -n secure exec legacy -- grep Seccomp /proc/1/status
```

`Seccomp: 0` means no filter, and `2` means the filter is active.

<!-- setup
set -e
cluster-up
kubectl create ns secure >/dev/null
kubectl -n secure run legacy --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl -n secure wait --for=condition=Ready pod/legacy --timeout=120s >/dev/null
-->

## RuntimeDefault

Create a Pod `app-default` in `secure` (`busybox:1.37`, `sleep 36000`) with the **RuntimeDefault** seccomp profile at the Pod level. In the container, `Seccomp` in `/proc/1/status` must be `2`.

<!-- verify
[ "$(kubectl -n secure get pod app-default -o jsonpath='{.spec.securityContext.seccompProfile.type}' 2>/dev/null)" = "RuntimeDefault" ] || { echo "app-default does not have seccompProfile RuntimeDefault at the Pod level"; exit 1; }
kubectl -n secure exec app-default -- grep -q '^Seccomp:.*2' /proc/1/status 2>/dev/null || { echo "the seccomp filter is not active in app-default"; exit 1; }
-->
<!-- hint
```yaml
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: app-default, namespace: secure}
spec:
  securityContext:
    seccompProfile: {type: RuntimeDefault}
  containers:
  - {name: c, image: busybox:1.37, command: ["sleep", "36000"]}
EOF
kubectl -n secure wait --for=condition=Ready pod/app-default --timeout=120s
-->

## A custom profile that blocks chmod

On **both nodes**, create the profile `/var/lib/kubelet/seccomp/profiles/no-chmod.json`:

- `defaultAction: SCMP_ACT_ALLOW`,
- the syscalls `chmod`, `fchmod` and `fchmodat` have the action `SCMP_ACT_ERRNO`.

Then create a Pod `app-nochmod` in `secure` (`busybox:1.37`, `sleep 36000`) with a profile of type `Localhost` and `localhostProfile: profiles/no-chmod.json`. In the Pod, `chmod 777 /tmp` must fail with `Operation not permitted`.

```bash
kubectl -n secure exec app-nochmod -- sh -c 'touch /tmp/f; chmod 777 /tmp/f'
```

<!-- verify
for n in controlplane node01; do ssh $n test -s /var/lib/kubelet/seccomp/profiles/no-chmod.json || { echo "the profile does not exist on $n"; exit 1; }; done
[ "$(kubectl -n secure get pod app-nochmod -o jsonpath='{.spec.securityContext.seccompProfile.localhostProfile}{.spec.containers[0].securityContext.seccompProfile.localhostProfile}' 2>/dev/null)" = "profiles/no-chmod.json" ] || { echo "app-nochmod does not use profiles/no-chmod.json"; exit 1; }
[ "$(kubectl -n secure get pod app-nochmod -o jsonpath='{.status.phase}')" = "Running" ] || { echo "app-nochmod is not Running"; exit 1; }
out=$(kubectl -n secure exec app-nochmod -- sh -c 'touch /tmp/f; chmod 777 /tmp/f' 2>&1)
echo "$out" | grep -qi 'not permitted' || { echo "chmod is not blocked (output: $out)"; exit 1; }
kubectl -n secure exec app-nochmod -- sh -c 'echo ok > /tmp/g' >/dev/null 2>&1 || { echo "the profile also blocks ordinary operations"; exit 1; }
-->
<!-- hint
```json
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [
    {"names": ["chmod", "fchmod", "fchmodat"], "action": "SCMP_ACT_ERRNO"}
  ]
}
```
The path in `localhostProfile` is relative to `/var/lib/kubelet/seccomp/`. The profile must exist on the node where the Pod starts, otherwise the Pod gets `CreateContainerError`.
-->
<!-- solution
cat > /root/no-chmod.json <<'EOF'
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [
    {"names": ["chmod", "fchmod", "fchmodat"], "action": "SCMP_ACT_ERRNO"}
  ]
}
EOF
for n in controlplane node01; do ssh $n mkdir -p /var/lib/kubelet/seccomp/profiles; scp -q /root/no-chmod.json $n:/var/lib/kubelet/seccomp/profiles/no-chmod.json; done
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: app-nochmod, namespace: secure}
spec:
  securityContext:
    seccompProfile: {type: Localhost, localhostProfile: profiles/no-chmod.json}
  containers:
  - {name: c, image: busybox:1.37, command: ["sleep", "36000"]}
EOF
kubectl -n secure wait --for=condition=Ready pod/app-nochmod --timeout=120s
-->
