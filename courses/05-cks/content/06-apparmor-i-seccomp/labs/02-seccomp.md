# Lab 2: seccomp profili

**seccomp** filtrira sistemske pozive (syscalls) koje proces smije napraviti prema kernelu. Kubernetes nudi `RuntimeDefault` (podrazumijevani profil container runtimea) i `Localhost` (tvoj profil iz `/var/lib/kubelet/seccomp/` na čvoru).

U namespaceu `secure` radi Pod `legacy` bez seccomp profila (`Unconfined`).

```bash
kubectl -n secure get pod legacy -o jsonpath='{.spec.securityContext}'
kubectl -n secure exec legacy -- grep Seccomp /proc/1/status
```

`Seccomp: 0` znači bez filtera, a `2` znači da je filter aktivan.

<!-- setup
set -e
cluster-up
kubectl create ns secure >/dev/null
kubectl -n secure run legacy --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl -n secure wait --for=condition=Ready pod/legacy --timeout=120s >/dev/null
-->

## RuntimeDefault

Napravi Pod `app-default` u `secure` (`busybox:1.37`, `sleep 36000`) sa seccomp profilom **RuntimeDefault** na nivou Poda. U kontejneru `Seccomp` u `/proc/1/status` mora biti `2`.

<!-- verify
[ "$(kubectl -n secure get pod app-default -o jsonpath='{.spec.securityContext.seccompProfile.type}' 2>/dev/null)" = "RuntimeDefault" ] || { echo "app-default nema seccompProfile RuntimeDefault na nivou Poda"; exit 1; }
kubectl -n secure exec app-default -- grep -q '^Seccomp:.*2' /proc/1/status 2>/dev/null || { echo "seccomp filter nije aktivan u app-default"; exit 1; }
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

## Vlastiti profil koji blokira chmod

Na **oba čvora** napravi profil `/var/lib/kubelet/seccomp/profiles/no-chmod.json`:

- `defaultAction: SCMP_ACT_ALLOW`,
- syscalls `chmod`, `fchmod` i `fchmodat` imaju akciju `SCMP_ACT_ERRNO`.

Zatim napravi Pod `app-nochmod` u `secure` (`busybox:1.37`, `sleep 36000`) sa profilom tipa `Localhost` i `localhostProfile: profiles/no-chmod.json`. U Podu `chmod 777 /tmp` mora pasti sa `Operation not permitted`.

```bash
kubectl -n secure exec app-nochmod -- sh -c 'touch /tmp/f; chmod 777 /tmp/f'
```

<!-- verify
for n in controlplane node01; do ssh $n test -s /var/lib/kubelet/seccomp/profiles/no-chmod.json || { echo "profil ne postoji na $n"; exit 1; }; done
[ "$(kubectl -n secure get pod app-nochmod -o jsonpath='{.spec.securityContext.seccompProfile.localhostProfile}{.spec.containers[0].securityContext.seccompProfile.localhostProfile}' 2>/dev/null)" = "profiles/no-chmod.json" ] || { echo "app-nochmod ne koristi profiles/no-chmod.json"; exit 1; }
[ "$(kubectl -n secure get pod app-nochmod -o jsonpath='{.status.phase}')" = "Running" ] || { echo "app-nochmod nije Running"; exit 1; }
out=$(kubectl -n secure exec app-nochmod -- sh -c 'touch /tmp/f; chmod 777 /tmp/f' 2>&1)
echo "$out" | grep -qi 'not permitted' || { echo "chmod nije blokiran (izlaz: $out)"; exit 1; }
kubectl -n secure exec app-nochmod -- sh -c 'echo ok > /tmp/g' >/dev/null 2>&1 || { echo "profil blokira i obične operacije"; exit 1; }
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
Putanja u `localhostProfile` je relativna u odnosu na `/var/lib/kubelet/seccomp/`. Profil mora postojati na čvoru na kome se Pod pokreće, inače Pod dobije `CreateContainerError`.
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
