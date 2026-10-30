# Lab 1: An AppArmor profile for a Pod

The application `uploader` may write **only** to `/data`. If an attacker compromises it, they must not be able to change anything else in the container (e.g. drop a script into `/tmp` or `/etc`). You will enforce this with an AppArmor profile.

An AppArmor profile is loaded into the kernel of the **node** where the Pod runs. That is why both the profile and the Pod must be on `node01`.

```bash
ssh node01 aa-status | head
```

<!-- setup
set -e
cluster-up
kubectl create ns secure >/dev/null
# profili ostaju u kernelu (dijeljen sa ranijim labovima): ukloni zaostali
ssh node01 'echo -n k8s-uploader > /sys/kernel/security/apparmor/.remove' 2>/dev/null || true
ssh node01 'cat > /root/k8s-uploader <<EOF
#include <tunables/global>

profile k8s-uploader flags=(attach_disconnected) {
  #include <abstractions/base>

  file,

  # dozvoljeno pisanje samo u /data
  deny /** w,
  /data/** rw,
}
EOF'
-->

## Load the profile

A profile has been prepared on `node01` in `/root/k8s-uploader`. Copy it to `/etc/apparmor.d/` and load it in **enforce** mode.

Rules with `deny` take precedence over allows, so this profile as it stands also blocks writing to `/data`. Fix it before loading: instead of `deny /** w,` make it forbid writing everywhere **except** `/data` (`deny /{bin,etc,home,lib,opt,root,sbin,srv,tmp,usr,var}/** w,`).

```bash
ssh node01
vim /root/k8s-uploader
cp /root/k8s-uploader /etc/apparmor.d/k8s-uploader
apparmor_parser -r /etc/apparmor.d/k8s-uploader
aa-status | grep k8s-uploader
```

<!-- verify
ssh node01 test -s /etc/apparmor.d/k8s-uploader || { echo "the profile is not in /etc/apparmor.d/k8s-uploader on node01"; exit 1; }
ssh node01 aa-status 2>/dev/null | sed -n '/profiles are in enforce mode/,/profiles are in complain mode/p' | grep -qx '   k8s-uploader' || { echo "the k8s-uploader profile is not loaded in enforce mode on node01"; exit 1; }
ssh node01 "grep -q '^ *deny /\*\* w,' /etc/apparmor.d/k8s-uploader" && { echo "the profile still has 'deny /** w,' which also blocks /data"; exit 1; }
exit 0
-->
<!-- hint
`aa-status` shows the list of profiles in enforce mode. `apparmor_parser -r` reloads (replaces) an already loaded profile. For complain mode you would use `-C` or `aa-complain`.
-->
<!-- solution
ssh node01 "sed -i 's#^ *deny /\*\* w,#  deny /{bin,etc,home,lib,opt,root,sbin,srv,tmp,usr,var}/** w,#' /root/k8s-uploader && cp /root/k8s-uploader /etc/apparmor.d/k8s-uploader && apparmor_parser -r /etc/apparmor.d/k8s-uploader"
-->

## A Pod with the profile

In the `secure` namespace, create a Pod `uploader` (`busybox:1.37`, command `sleep 36000`) that:

- runs on `node01` (`nodeSelector: kubernetes.io/hostname: node01`),
- has an `emptyDir` volume mounted at `/data`,
- uses the AppArmor profile `k8s-uploader` (`securityContext.appArmorProfile`, type `Localhost`).

Check: `touch /data/ok` works, while `touch /tmp/x` and `touch /etc/x` don't.

```bash
kubectl -n secure exec uploader -- touch /data/ok
kubectl -n secure exec uploader -- touch /tmp/x
kubectl -n secure exec uploader -- cat /proc/1/attr/current
```

<!-- verify
[ "$(kubectl -n secure get pod uploader -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "the uploader Pod is not Running"; exit 1; }
kubectl -n secure exec uploader -- cat /proc/1/attr/current 2>/dev/null | grep -q 'k8s-uploader (enforce)' || { echo "uploader is not running under the k8s-uploader profile"; exit 1; }
kubectl -n secure exec uploader -- touch /data/ok 2>/dev/null || { echo "writing to /data does not work"; exit 1; }
kubectl -n secure exec uploader -- touch /tmp/x 2>/dev/null && { echo "writing to /tmp still works"; exit 1; }
kubectl -n secure exec uploader -- touch /etc/x 2>/dev/null && { echo "writing to /etc still works"; exit 1; }
exit 0
-->
<!-- hint
```yaml
spec:
  nodeSelector: {kubernetes.io/hostname: node01}
  securityContext:
    appArmorProfile:
      type: Localhost
      localhostProfile: k8s-uploader
```
Since Kubernetes 1.30 the profile is set with the `appArmorProfile` field. The old annotation `container.apparmor.security.beta.kubernetes.io/…` is deprecated. If the profile isn't loaded on the node, the Pod stays in the `Blocked` / `CreateContainerError` state.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: uploader, namespace: secure}
spec:
  nodeSelector: {kubernetes.io/hostname: node01}
  securityContext:
    appArmorProfile: {type: Localhost, localhostProfile: k8s-uploader}
  containers:
  - name: c
    image: busybox:1.37
    command: ["sleep", "36000"]
    volumeMounts: [{name: data, mountPath: /data}]
  volumes:
  - name: data
    emptyDir: {}
EOF
kubectl -n secure wait --for=condition=Ready pod/uploader --timeout=120s
-->
