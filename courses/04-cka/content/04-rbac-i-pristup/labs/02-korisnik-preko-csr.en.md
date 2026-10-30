# Lab 2: A new user via a CSR

Ana, a developer, needs access to the cluster. Kubernetes has no "User" object: a user is anyone who has a certificate signed by the cluster CA, where the certificate's `CN` is the username and `O` is the group.

You will create a key and a certificate request, approve it through the **CertificateSigningRequest** API, create a context in the kubeconfig and give Ana permissions via RBAC.

<!-- setup
set -e
cluster-up
kubectl create ns dev >/dev/null
kubectl create ns prod >/dev/null
kubectl -n prod create deploy shop --image=nginx:1.28 >/dev/null
mkdir -p /root/ana
-->

## Key, CSR and approval

In `/root/ana/`:

1. create a private key `ana.key` (RSA 2048),
2. create a CSR `ana.csr` with the subject `CN=ana, O=dev-team`,
3. submit it to the cluster as a `CertificateSigningRequest` named `ana` (`signerName: kubernetes.io/kube-apiserver-client`, `usages: [client auth]`),
4. approve the request and save the signed certificate to `/root/ana/ana.crt`.

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
kubectl get csr ana -o jsonpath='{.status.conditions[*].type}' 2>/dev/null | grep -q Approved || { echo "CSR ana does not exist or is not approved"; exit 1; }
[ -s /root/ana/ana.crt ] || { echo "/root/ana/ana.crt does not exist"; exit 1; }
openssl x509 -in /root/ana/ana.crt -noout -subject 2>/dev/null | grep -q 'CN *= *ana' || { echo "ana.crt is not a certificate for CN=ana"; exit 1; }
openssl verify -CAfile /etc/kubernetes/pki/ca.crt /root/ana/ana.crt >/dev/null 2>&1 || { echo "ana.crt is not signed by the cluster CA"; exit 1; }
[ "$(openssl x509 -in /root/ana/ana.crt -noout -modulus)" = "$(openssl rsa -in /root/ana/ana.key -noout -modulus 2>/dev/null)" ] || { echo "ana.crt does not match the key ana.key"; exit 1; }
-->
<!-- hint
`kubectl certificate approve ana`, then `kubectl get csr ana -o jsonpath='{.status.certificate}' | base64 -d > /root/ana/ana.crt`. The `request` field is the base64 of the whole PEM CSR on a single line (`base64 -w0`).
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

## Context in the kubeconfig

Add to the kubeconfig (`/root/.kube/config`):

- a user `ana` with the certificate and key embedded in the file (`--embed-certs`),
- a context `ana@kubernetes` that uses the cluster `kubernetes` and the user `ana`.

Leave the current context on the admin.

```bash
kubectl config set-credentials ana --client-certificate=/root/ana/ana.crt --client-key=/root/ana/ana.key --embed-certs=true
kubectl config set-context ana@kubernetes --cluster=kubernetes --user=ana
kubectl --context ana@kubernetes auth whoami
```

<!-- verify
kubectl config get-contexts -o name | grep -qx 'ana@kubernetes' || { echo "context ana@kubernetes does not exist"; exit 1; }
kubectl config view --raw -o jsonpath='{.users[?(@.name=="ana")].user.client-certificate-data}' | grep -q . || { echo "user ana has no embedded certificate (--embed-certs)"; exit 1; }
kubectl --context ana@kubernetes auth whoami -o jsonpath='{.status.userInfo.username}' 2>/dev/null | grep -qx ana || { echo "context ana@kubernetes does not authenticate as ana"; exit 1; }
[ "$(kubectl config current-context)" = "kubernetes-admin@kubernetes" ] || { echo "the current context must stay kubernetes-admin@kubernetes"; exit 1; }
-->
<!-- solution
kubectl config set-credentials ana --client-certificate=/root/ana/ana.crt --client-key=/root/ana/ana.key --embed-certs=true
kubectl config set-context ana@kubernetes --cluster=kubernetes --user=ana
-->

## Permissions for Ana

Ana can log in, but she is not allowed to do anything yet (`Forbidden`). Give her:

1. in namespace `dev`: full management of Deployments and Pods (`get, list, watch, create, update, patch, delete`), granted through the **group** `dev-team` so the same applies to future team members. Name the Role and RoleBinding `dev-team`.
2. in namespace `prod`: read-only access, via the built-in ClusterRole `view` and a RoleBinding `ana-view` for user `ana`.

```bash
kubectl --context ana@kubernetes -n dev get pods
kubectl auth can-i --list -n dev --as=ana --as-group=dev-team
```

<!-- verify
A="--as=ana --as-group=dev-team"
for r in deployments pods; do for v in create delete list; do [ "$(kubectl auth can-i $v $r -n dev $A)" = "yes" ] || { echo "ana cannot $v $r in dev"; exit 1; }; done; done
[ "$(kubectl auth can-i create deployments -n dev --as=marko --as-group=dev-team)" = "yes" ] || { echo "the permission in dev was not granted to the dev-team group"; exit 1; }
[ "$(kubectl auth can-i list pods -n prod --as=ana)" = "yes" ] || { echo "ana cannot read Pods in prod"; exit 1; }
[ "$(kubectl auth can-i delete deployments -n prod $A)" = "no" ] || { echo "ana can delete in prod"; exit 1; }
[ "$(kubectl auth can-i get secrets -n prod $A)" = "no" ] || { echo "ana can read Secrets in prod"; exit 1; }
[ "$(kubectl auth can-i create deployments -n default $A)" = "no" ] || { echo "ana has permissions outside dev/prod too"; exit 1; }
kubectl --context ana@kubernetes -n prod get deploy shop >/dev/null 2>&1 || { echo "ana cannot see the shop deployment in prod through her context"; exit 1; }
-->
<!-- hint
`kubectl -n dev create role dev-team --verb=get,list,watch,create,update,patch,delete --resource=deployments,pods`, `kubectl -n dev create rolebinding dev-team --role=dev-team --group=dev-team` and `kubectl -n prod create rolebinding ana-view --clusterrole=view --user=ana`. A ClusterRole bound with a RoleBinding applies only in that namespace.
-->
<!-- solution
kubectl -n dev create role dev-team --verb=get,list,watch,create,update,patch,delete --resource=deployments,pods
kubectl -n dev create rolebinding dev-team --role=dev-team --group=dev-team
kubectl -n prod create rolebinding ana-view --clusterrole=view --user=ana
-->
