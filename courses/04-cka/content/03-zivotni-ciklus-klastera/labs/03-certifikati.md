# Lab 3: Certifikati klastera

kubeadm izdaje certifikate kontrolne ravni sa rokom od godinu dana, a CA certifikate sa rokom od deset godina. U ovom labu provjeravaš rokove, obnavljaš certifikat API servera i kubeconfig administratora.

<!-- setup
set -e
cluster-up
-->

## Provjera roka važenja

1. Sačuvaj izlaz `kubeadm certs check-expiration` u `/root/certs.txt`.
2. U `/root/apiserver-issuer.txt` upiši **CN izdavaoca** (issuer) certifikata `/etc/kubernetes/pki/apiserver.crt`, samo vrijednost CN-a (npr. `kubernetes`).

```bash
kubeadm certs check-expiration
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer -subject -dates
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 "Subject Alternative Name"
```

<!-- verify
grep -q 'apiserver-kubelet-client' /root/certs.txt 2>/dev/null && grep -q 'CERTIFICATE AUTHORITY' /root/certs.txt || { echo "/root/certs.txt ne sadrži izlaz kubeadm certs check-expiration"; exit 1; }
want=$(openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer -nameopt multiline | awk -F'= ' '/commonName/ {print $2}')
[ "$(tr -d '\n' < /root/apiserver-issuer.txt 2>/dev/null | sed 's/^ *//;s/ *$//')" = "$want" ] || { echo "apiserver-issuer.txt nije ispravan"; exit 1; }
-->
<!-- solution
kubeadm certs check-expiration > /root/certs.txt 2>&1
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer -nameopt multiline | awk -F'= ' '/commonName/ {print $2}' > /root/apiserver-issuer.txt
-->

## Obnovi certifikat API servera

Obnovi **samo** certifikat `apiserver` (ne sve certifikate). Ostali certifikati, npr. `apiserver-kubelet-client`, moraju ostati isti.

```bash
kubeadm certs renew --help
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -serial -dates
```

<!-- verify
s=$(openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -startdate | cut -d= -f2)
c=$(openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -startdate | cut -d= -f2)
[ $(( $(date -d "$s" +%s) - $(date -d "$c" +%s) )) -gt 20 ] || { echo "apiserver.crt nije obnovljen"; exit 1; }
f=$(openssl x509 -in /etc/kubernetes/pki/front-proxy-client.crt -noout -startdate | cut -d= -f2)
[ $(( $(date -d "$f" +%s) - $(date -d "$c" +%s) )) -lt 20 ] || { echo "obnovljeni su i drugi certifikati, a trebalo je samo apiserver"; exit 1; }
-->
<!-- hint
`kubeadm certs renew apiserver`. Komanda `renew all` bi obnovila i ostale certifikate.
-->
<!-- solution
sleep 25
kubeadm certs renew apiserver >/dev/null
-->

## Obnovi kubeconfig administratora

Provjeri šta API server sada servira:

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -serial
echo | openssl s_client -connect controlplane:6443 2>/dev/null | openssl x509 -noout -serial
```

Serijski brojevi su isti: kube-apiserver sam ponovo učitava **serving** certifikat kad se fajl promijeni. Za kubeconfig fajlove to ne važi. Kontroler, scheduler i ti kao administrator koristite klijentske certifikate ugrađene u `*.conf` fajlove, pa poslije `renew` treba restartovati static Podove kontrolne ravni i **ponovo kopirati** `admin.conf`.

Obnovi certifikat u `/etc/kubernetes/admin.conf` i kopiraj novi fajl u `/root/.kube/config`.

```bash
kubeadm certs renew admin.conf
cp /etc/kubernetes/admin.conf /root/.kube/config
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d | openssl x509 -noout -dates
```

<!-- verify
s=$(kubectl config view --raw -o jsonpath='{.users[?(@.name=="kubernetes-admin")].user.client-certificate-data}' | base64 -d | openssl x509 -noout -startdate | cut -d= -f2)
c=$(openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -startdate | cut -d= -f2)
[ -n "$s" ] && [ $(( $(date -d "$s" +%s) - $(date -d "$c" +%s) )) -gt 20 ] || { echo "certifikat u /root/.kube/config nije obnovljen"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "kubectl ne radi sa novim kubeconfigom"; exit 1; }
-->
<!-- hint
`kubeadm certs renew admin.conf` mijenja samo `/etc/kubernetes/admin.conf`. `/root/.kube/config` je kopija napravljena pri instalaciji, pa i dalje ima stari certifikat dok je ne zamijeniš.
-->
<!-- solution
kubeadm certs renew admin.conf >/dev/null
cp /etc/kubernetes/admin.conf /root/.kube/config
-->
