# Lab 1: AppArmor profil za Pod

Aplikacija `uploader` sme pisati **samo** u `/data`. Ako je napadač kompromituje, ne smije moći mijenjati ništa drugo u kontejneru (npr. ubaciti skriptu u `/tmp` ili `/etc`). To ćeš osigurati AppArmor profilom.

AppArmor profil se učitava u kernel **čvora** na kome Pod radi. Zato i profil i Pod moraju biti na `node01`.

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

## Učitaj profil

Na `node01` je u `/root/k8s-uploader` pripremljen profil. Kopiraj ga u `/etc/apparmor.d/` i učitaj u **enforce** modu.

Pravila sa `deny` imaju prednost nad dozvolama, pa ovaj profil kakav jeste blokira i pisanje u `/data`. Ispravi ga prije učitavanja: umjesto `deny /** w,` neka zabrani pisanje u sve **osim** `/data` (`deny /{bin,etc,home,lib,opt,root,sbin,srv,tmp,usr,var}/** w,`).

```bash
ssh node01
vim /root/k8s-uploader
cp /root/k8s-uploader /etc/apparmor.d/k8s-uploader
apparmor_parser -r /etc/apparmor.d/k8s-uploader
aa-status | grep k8s-uploader
```

<!-- verify
ssh node01 test -s /etc/apparmor.d/k8s-uploader || { echo "profil nije u /etc/apparmor.d/k8s-uploader na node01"; exit 1; }
ssh node01 aa-status 2>/dev/null | sed -n '/profiles are in enforce mode/,/profiles are in complain mode/p' | grep -qx '   k8s-uploader' || { echo "profil k8s-uploader nije učitan u enforce modu na node01"; exit 1; }
ssh node01 "grep -q '^ *deny /\*\* w,' /etc/apparmor.d/k8s-uploader" && { echo "profil i dalje ima 'deny /** w,' koji blokira i /data"; exit 1; }
exit 0
-->
<!-- hint
`aa-status` pokazuje listu profila u enforce modu. `apparmor_parser -r` ponovo učitava (replace) već učitan profil. Za complain mod bi se koristio `-C` ili `aa-complain`.
-->
<!-- solution
ssh node01 "sed -i 's#^ *deny /\*\* w,#  deny /{bin,etc,home,lib,opt,root,sbin,srv,tmp,usr,var}/** w,#' /root/k8s-uploader && cp /root/k8s-uploader /etc/apparmor.d/k8s-uploader && apparmor_parser -r /etc/apparmor.d/k8s-uploader"
-->

## Pod sa profilom

U namespaceu `secure` napravi Pod `uploader` (`busybox:1.37`, komanda `sleep 36000`) koji:

- radi na `node01` (`nodeSelector: kubernetes.io/hostname: node01`),
- ima `emptyDir` volumen montiran na `/data`,
- koristi AppArmor profil `k8s-uploader` (`securityContext.appArmorProfile`, tip `Localhost`).

Provjeri: `touch /data/ok` radi, a `touch /tmp/x` i `touch /etc/x` ne rade.

```bash
kubectl -n secure exec uploader -- touch /data/ok
kubectl -n secure exec uploader -- touch /tmp/x
kubectl -n secure exec uploader -- cat /proc/1/attr/current
```

<!-- verify
[ "$(kubectl -n secure get pod uploader -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "Pod uploader nije Running"; exit 1; }
kubectl -n secure exec uploader -- cat /proc/1/attr/current 2>/dev/null | grep -q 'k8s-uploader (enforce)' || { echo "uploader ne radi pod profilom k8s-uploader"; exit 1; }
kubectl -n secure exec uploader -- touch /data/ok 2>/dev/null || { echo "upis u /data ne radi"; exit 1; }
kubectl -n secure exec uploader -- touch /tmp/x 2>/dev/null && { echo "upis u /tmp i dalje radi"; exit 1; }
kubectl -n secure exec uploader -- touch /etc/x 2>/dev/null && { echo "upis u /etc i dalje radi"; exit 1; }
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
Od Kubernetesa 1.30 profil se zadaje poljem `appArmorProfile`. Stara anotacija `container.apparmor.security.beta.kubernetes.io/…` je zastarjela. Ako profil nije učitan na čvoru, Pod ostaje u stanju `Blocked` / `CreateContainerError`.
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
