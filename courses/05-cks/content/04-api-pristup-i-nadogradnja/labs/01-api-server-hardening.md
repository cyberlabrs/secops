# Lab 1: Ograničavanje pristupa API serveru

Pregled klastera je pokazao tri problema sa pristupom API serveru:

1. Servis `kubernetes` je izložen kao **NodePort**, dakle dostupan na svakom čvoru spolja.
2. U API serveru je isključen admission plugin **NodeRestriction**, pa kubelet jednog čvora može mijenjati druge čvorove.
3. Postoji ClusterRoleBinding koji anonimnom korisniku daje čitanje cijelog klastera.

```bash
kubectl get svc kubernetes
grep -E 'admission-plugins|anonymous' /etc/kubernetes/manifests/kube-apiserver.yaml
kubectl get clusterrolebindings -o wide | grep -i anonymous
```

<!-- setup
set -e
cluster-up
kubectl patch svc kubernetes -p '{"spec":{"type":"NodePort","ports":[{"name":"https","port":443,"targetPort":6443,"nodePort":31443,"protocol":"TCP"}]}}' >/dev/null
kubectl create clusterrolebinding anon-view --clusterrole=view --user=system:anonymous >/dev/null
sed -i 's#--enable-admission-plugins=NodeRestriction#--enable-admission-plugins=NamespaceLifecycle#' /etc/kubernetes/manifests/kube-apiserver.yaml
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
-->

## Anonimni pristup

Provjeri šta anonimni korisnik vidi:

```bash
curl -sk https://controlplane:6443/api/v1/namespaces/kube-system/pods | head -20
```

Obriši ClusterRoleBinding koji to omogućava. Anonimni zahtjev na `/api/v1/namespaces/kube-system/pods` mora vratiti **403**.

Napomena: `--anonymous-auth=false` u ovom klasteru ne mijenjaj, jer kubeadm koristi anonimne zahtjeve za health provjere (`/livez`, `/readyz`), koje su dozvoljene kroz ugrađenu ulogu `system:public-info-viewer`.

<!-- verify
kubectl get clusterrolebinding anon-view >/dev/null 2>&1 && { echo "anon-view još postoji"; exit 1; }
code=$(curl -sk -o /dev/null -w '%{http_code}' https://controlplane:6443/api/v1/namespaces/kube-system/pods)
[ "$code" = "403" ] || { echo "anonimni zahtjev vraća $code (očekivano 403)"; exit 1; }
-->
<!-- hint
`kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.subjects[]?.name=="system:anonymous") | .metadata.name'`
-->
<!-- solution
kubectl delete clusterrolebinding anon-view
-->

## kubernetes Servis samo unutar klastera

Vrati Servis `kubernetes` u namespaceu `default` na tip **ClusterIP**. Port 31443 na čvorovima više ne smije odgovarati.

<!-- verify
[ "$(kubectl get svc kubernetes -o jsonpath='{.spec.type}')" = "ClusterIP" ] || { echo "Servis kubernetes nije ClusterIP"; exit 1; }
for i in 1 2 3 4 5 6; do curl -sk -m 2 -o /dev/null https://node01:31443/ || exit 0; sleep 2; done
echo "port 31443 i dalje odgovara"; exit 1
-->
<!-- hint
`kubectl edit svc kubernetes`: `type: ClusterIP` i ukloni `nodePort` iz porta. Ili `kubectl patch svc kubernetes --type=json -p='[{"op":"replace","path":"/spec/type","value":"ClusterIP"},{"op":"remove","path":"/spec/ports/0/nodePort"}]'`.
-->
<!-- solution
kubectl patch svc kubernetes --type=json -p='[{"op":"replace","path":"/spec/type","value":"ClusterIP"},{"op":"remove","path":"/spec/ports/0/nodePort"}]'
sleep 3
-->

## NodeRestriction

Pokaži zašto je NodeRestriction bitan. Sa **kubeletovim** kredencijalima sa node01 pokušaj postaviti oznaku na čvoru `controlplane`:

```bash
scp node01:/etc/kubernetes/kubelet.conf /root/node01-kubelet.conf
sed -i 's#/var/lib/kubelet/pki#/root/node01-pki#' /root/node01-kubelet.conf
mkdir -p /root/node01-pki && scp node01:/var/lib/kubelet/pki/kubelet-client-current.pem /root/node01-pki/
kubectl --kubeconfig /root/node01-kubelet.conf label node controlplane hacked=true
```

Bez NodeRestriction to uspijeva. Uključi plugin ponovo u `/etc/kubernetes/manifests/kube-apiserver.yaml` (`--enable-admission-plugins=NodeRestriction`), sačekaj da API server ponovo proradi i ukloni oznaku `hacked` sa `controlplane`. Ista komanda mora tada biti odbijena.

<!-- verify
grep -q -- '--enable-admission-plugins=.*NodeRestriction' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "NodeRestriction nije uključen u manifestu"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
kubectl get node controlplane -o jsonpath='{.metadata.labels.hacked}' | grep -q . && { echo "controlplane još ima oznaku hacked"; exit 1; }
[ -s /root/node01-kubelet.conf ] || { echo "nema /root/node01-kubelet.conf iz prvog dijela koraka"; exit 1; }
out=$(kubectl --kubeconfig /root/node01-kubelet.conf label node controlplane provjera=1 --dry-run=server 2>&1)
echo "$out" | grep -qi 'forbidden\|cannot modify' || { echo "kubelet node01 i dalje može mijenjati controlplane"; exit 1; }
-->
<!-- hint
NodeRestriction ograničava kubelet (`system:node:node01`) na njegov `Node` objekat i Podove na njemu. Poslije izmjene manifesta prati `watch crictl ps` dok kube-apiserver ne postane `Running`.
-->
<!-- solution
scp -q node01:/etc/kubernetes/kubelet.conf /root/node01-kubelet.conf
sed -i 's#/var/lib/kubelet/pki#/root/node01-pki#' /root/node01-kubelet.conf
mkdir -p /root/node01-pki && scp -q node01:/var/lib/kubelet/pki/kubelet-client-current.pem /root/node01-pki/
kubectl --kubeconfig /root/node01-kubelet.conf label node controlplane hacked=true --overwrite >/dev/null 2>&1 || true
sed -i 's#--enable-admission-plugins=NamespaceLifecycle#--enable-admission-plugins=NodeRestriction#' /etc/kubernetes/manifests/kube-apiserver.yaml
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
kubectl label node controlplane hacked- >/dev/null 2>&1 || true
-->
