# Lab 3: Cluster certificates

kubeadm issues control plane certificates valid for one year and CA certificates valid for ten years. In this lab you check expiry dates and renew the API server certificate and the administrator kubeconfig.

<!-- setup
set -e
cluster-up
-->

## Checking validity

1. Save the output of `kubeadm certs check-expiration` to `/root/certs.txt`.
2. Write the **issuer CN** of the certificate `/etc/kubernetes/pki/apiserver.crt` to `/root/apiserver-issuer.txt`, just the CN value (e.g. `kubernetes`).

```bash
kubeadm certs check-expiration
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer -subject -dates
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 "Subject Alternative Name"
```

<!-- verify
grep -q 'apiserver-kubelet-client' /root/certs.txt 2>/dev/null && grep -q 'CERTIFICATE AUTHORITY' /root/certs.txt || { echo "/root/certs.txt does not contain the output of kubeadm certs check-expiration"; exit 1; }
want=$(openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer -nameopt multiline | awk -F'= ' '/commonName/ {print $2}')
[ "$(tr -d '\n' < /root/apiserver-issuer.txt 2>/dev/null | sed 's/^ *//;s/ *$//')" = "$want" ] || { echo "apiserver-issuer.txt is not correct"; exit 1; }
-->
<!-- solution
kubeadm certs check-expiration > /root/certs.txt 2>&1
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer -nameopt multiline | awk -F'= ' '/commonName/ {print $2}' > /root/apiserver-issuer.txt
-->

## Renew the API server certificate

Renew **only** the `apiserver` certificate (not all certificates). The other certificates, e.g. `apiserver-kubelet-client`, must stay the same.

```bash
kubeadm certs renew --help
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -serial -dates
```

<!-- verify
s=$(openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -startdate | cut -d= -f2)
c=$(openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -startdate | cut -d= -f2)
[ $(( $(date -d "$s" +%s) - $(date -d "$c" +%s) )) -gt 20 ] || { echo "apiserver.crt was not renewed"; exit 1; }
f=$(openssl x509 -in /etc/kubernetes/pki/front-proxy-client.crt -noout -startdate | cut -d= -f2)
[ $(( $(date -d "$f" +%s) - $(date -d "$c" +%s) )) -lt 20 ] || { echo "other certificates were renewed too, but only apiserver should have been"; exit 1; }
-->
<!-- hint
`kubeadm certs renew apiserver`. The `renew all` command would renew the other certificates as well.
-->
<!-- solution
sleep 25
kubeadm certs renew apiserver >/dev/null
-->

## Renew the administrator kubeconfig

Check what the API server is serving now:

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -serial
echo | openssl s_client -connect controlplane:6443 2>/dev/null | openssl x509 -noout -serial
```

The serial numbers are the same: kube-apiserver reloads its **serving** certificate by itself when the file changes. That does not apply to kubeconfig files. The controller-manager, the scheduler and you as the administrator use client certificates embedded in the `*.conf` files, so after `renew` you need to restart the control plane static Pods and **copy** `admin.conf` **again**.

Renew the certificate in `/etc/kubernetes/admin.conf` and copy the new file to `/root/.kube/config`.

```bash
kubeadm certs renew admin.conf
cp /etc/kubernetes/admin.conf /root/.kube/config
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d | openssl x509 -noout -dates
```

<!-- verify
s=$(kubectl config view --raw -o jsonpath='{.users[?(@.name=="kubernetes-admin")].user.client-certificate-data}' | base64 -d | openssl x509 -noout -startdate | cut -d= -f2)
c=$(openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -startdate | cut -d= -f2)
[ -n "$s" ] && [ $(( $(date -d "$s" +%s) - $(date -d "$c" +%s) )) -gt 20 ] || { echo "the certificate in /root/.kube/config was not renewed"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "kubectl does not work with the new kubeconfig"; exit 1; }
-->
<!-- hint
`kubeadm certs renew admin.conf` changes only `/etc/kubernetes/admin.conf`. `/root/.kube/config` is a copy made during installation, so it still has the old certificate until you replace it.
-->
<!-- solution
kubeadm certs renew admin.conf >/dev/null
cp /etc/kubernetes/admin.conf /root/.kube/config
-->
