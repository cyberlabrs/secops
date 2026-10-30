# Lab 2: Novi korisnik preko CSR-a

Programerka Ana treba pristup klasteru. Kubernetes nema objekat „User“: korisnik je onaj ko ima certifikat potpisan CA-jem klastera, a `CN` certifikata je korisničko ime, `O` grupa.

Napravićeš ključ i zahtjev za certifikat, odobriti ga kroz **CertificateSigningRequest** API, napraviti kontekst u kubeconfigu i dati Ani dozvole preko RBAC-a.

<!-- setup
set -e
cluster-up
kubectl create ns dev >/dev/null
kubectl create ns prod >/dev/null
kubectl -n prod create deploy shop --image=nginx:1.28 >/dev/null
mkdir -p /root/ana
-->

## Ključ, CSR i odobrenje

U `/root/ana/`:

1. napravi privatni ključ `ana.key` (RSA 2048),
2. napravi CSR `ana.csr` sa subjectom `CN=ana, O=dev-team`,
3. pošalji ga klasteru kao `CertificateSigningRequest` sa imenom `ana` (`signerName: kubernetes.io/kube-apiserver-client`, `usages: [client auth]`),
4. odobri zahtjev i sačuvaj potpisan certifikat u `/root/ana/ana.crt`.

```bash
cd /root/ana
openssl genrsa -out ana.key 2048
openssl req -new -key ana.key -subj "/CN=ana/O=dev-team" -out ana.csr
cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: ana
spec:
  request: $(base64 -w0 < ana.csr)
  signerName: kubernetes.io/kube-apiserver-client
  usages: ["client auth"]
EOF
kubectl get csr
```

<!-- verify
kubectl get csr ana -o jsonpath='{.status.conditions[*].type}' 2>/dev/null | grep -q Approved || { echo "CSR ana ne postoji ili nije odobren"; exit 1; }
[ -s /root/ana/ana.crt ] || { echo "/root/ana/ana.crt ne postoji"; exit 1; }
openssl x509 -in /root/ana/ana.crt -noout -subject 2>/dev/null | grep -q 'CN *= *ana' || { echo "ana.crt nije certifikat za CN=ana"; exit 1; }
openssl verify -CAfile /etc/kubernetes/pki/ca.crt /root/ana/ana.crt >/dev/null 2>&1 || { echo "ana.crt nije potpisan CA-jem klastera"; exit 1; }
[ "$(openssl x509 -in /root/ana/ana.crt -noout -modulus)" = "$(openssl rsa -in /root/ana/ana.key -noout -modulus 2>/dev/null)" ] || { echo "ana.crt ne odgovara ključu ana.key"; exit 1; }
-->
<!-- hint
`kubectl certificate approve ana`, pa `kubectl get csr ana -o jsonpath='{.status.certificate}' | base64 -d > /root/ana/ana.crt`. Polje `request` je base64 cijelog PEM CSR-a u jednom redu (`base64 -w0`).
-->
<!-- solution
cd /root/ana
openssl genrsa -out ana.key 2048 2>/dev/null
openssl req -new -key ana.key -subj "/CN=ana/O=dev-team" -out ana.csr
cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: ana
spec:
  request: $(base64 -w0 < ana.csr)
  signerName: kubernetes.io/kube-apiserver-client
  usages: ["client auth"]
EOF
kubectl certificate approve ana
for i in $(seq 30); do kubectl get csr ana -o jsonpath='{.status.certificate}' | grep -q . && break; sleep 1; done
kubectl get csr ana -o jsonpath='{.status.certificate}' | base64 -d > /root/ana/ana.crt
-->

## Kontekst u kubeconfigu

U kubeconfig (`/root/.kube/config`) dodaj:

- korisnika `ana` sa certifikatom i ključem ugrađenim u fajl (`--embed-certs`),
- kontekst `ana@kubernetes` koji koristi klaster `kubernetes` i korisnika `ana`.

Trenutni kontekst ostavi na adminu.

```bash
kubectl config set-credentials ana --client-certificate=/root/ana/ana.crt --client-key=/root/ana/ana.key --embed-certs=true
kubectl config set-context ana@kubernetes --cluster=kubernetes --user=ana
kubectl --context ana@kubernetes auth whoami
```

<!-- verify
kubectl config get-contexts -o name | grep -qx 'ana@kubernetes' || { echo "kontekst ana@kubernetes ne postoji"; exit 1; }
kubectl config view --raw -o jsonpath='{.users[?(@.name=="ana")].user.client-certificate-data}' | grep -q . || { echo "korisnik ana nema ugrađen certifikat (--embed-certs)"; exit 1; }
kubectl --context ana@kubernetes auth whoami -o jsonpath='{.status.userInfo.username}' 2>/dev/null | grep -qx ana || { echo "kontekst ana@kubernetes se ne prijavljuje kao ana"; exit 1; }
[ "$(kubectl config current-context)" = "kubernetes-admin@kubernetes" ] || { echo "trenutni kontekst treba ostati kubernetes-admin@kubernetes"; exit 1; }
-->
<!-- solution
kubectl config set-credentials ana --client-certificate=/root/ana/ana.crt --client-key=/root/ana/ana.key --embed-certs=true
kubectl config set-context ana@kubernetes --cluster=kubernetes --user=ana
-->

## Dozvole za Anu

Ana se prijavljuje, ali još ništa ne smije (`Forbidden`). Daj joj:

1. u namespaceu `dev`: puno upravljanje Deploymentima i Podovima (`get, list, watch, create, update, patch, delete`), i to preko **grupe** `dev-team`, da isto važi za buduće članove tima. Role i RoleBinding nazovi `dev-team`.
2. u namespaceu `prod`: samo čitanje, preko ugrađene ClusterRole `view` i RoleBindinga `ana-view` za korisnika `ana`.

```bash
kubectl --context ana@kubernetes -n dev get pods
kubectl auth can-i --list -n dev --as=ana --as-group=dev-team
```

<!-- verify
A="--as=ana --as-group=dev-team"
for r in deployments pods; do for v in create delete list; do [ "$(kubectl auth can-i $v $r -n dev $A)" = "yes" ] || { echo "ana ne može $v $r u dev"; exit 1; }; done; done
[ "$(kubectl auth can-i create deployments -n dev --as=marko --as-group=dev-team)" = "yes" ] || { echo "dozvola u dev nije data grupi dev-team"; exit 1; }
[ "$(kubectl auth can-i list pods -n prod --as=ana)" = "yes" ] || { echo "ana ne može čitati Podove u prod"; exit 1; }
[ "$(kubectl auth can-i delete deployments -n prod $A)" = "no" ] || { echo "ana može brisati u prod"; exit 1; }
[ "$(kubectl auth can-i get secrets -n prod $A)" = "no" ] || { echo "ana može čitati Secrete u prod"; exit 1; }
[ "$(kubectl auth can-i create deployments -n default $A)" = "no" ] || { echo "ana ima dozvole i van dev/prod"; exit 1; }
kubectl --context ana@kubernetes -n prod get deploy shop >/dev/null 2>&1 || { echo "ana kroz svoj kontekst ne vidi deployment shop u prod"; exit 1; }
-->
<!-- hint
`kubectl -n dev create role dev-team --verb=get,list,watch,create,update,patch,delete --resource=deployments,pods`, `kubectl -n dev create rolebinding dev-team --role=dev-team --group=dev-team` i `kubectl -n prod create rolebinding ana-view --clusterrole=view --user=ana`. ClusterRole vezana RoleBindingom važi samo u tom namespaceu.
-->
<!-- solution
kubectl -n dev create role dev-team --verb=get,list,watch,create,update,patch,delete --resource=deployments,pods
kubectl -n dev create rolebinding dev-team --role=dev-team --group=dev-team
kubectl -n prod create rolebinding ana-view --clusterrole=view --user=ana
-->
