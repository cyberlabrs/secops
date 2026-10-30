# Lab 1: Restricting access to the API server

A cluster review revealed three problems with access to the API server:

1. The `kubernetes` service is exposed as a **NodePort**, so it is reachable on every node from outside.
2. The **NodeRestriction** admission plugin is disabled in the API server, so one node's kubelet can modify other nodes.
3. There is a ClusterRoleBinding that gives the anonymous user read access to the whole cluster.

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

## Anonymous access

Check what the anonymous user can see:

```bash
curl -sk https://controlplane:6443/api/v1/namespaces/kube-system/pods | head -20
```

Delete the ClusterRoleBinding that makes this possible. An anonymous request to `/api/v1/namespaces/kube-system/pods` must return **403**.

Note: don't change `--anonymous-auth=false` in this cluster, because kubeadm uses anonymous requests for health checks (`/livez`, `/readyz`), which are allowed through the built-in role `system:public-info-viewer`.

<!-- verify
kubectl get clusterrolebinding anon-view >/dev/null 2>&1 && { echo "anon-view still exists"; exit 1; }
code=$(curl -sk -o /dev/null -w '%{http_code}' https://controlplane:6443/api/v1/namespaces/kube-system/pods)
[ "$code" = "403" ] || { echo "the anonymous request returns $code (expected 403)"; exit 1; }
-->
<!-- hint
`kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.subjects[]?.name=="system:anonymous") | .metadata.name'`
-->
<!-- solution
kubectl delete clusterrolebinding anon-view
-->

## The kubernetes Service only inside the cluster

Change the Service `kubernetes` in the `default` namespace back to type **ClusterIP**. Port 31443 on the nodes must no longer respond.

<!-- verify
[ "$(kubectl get svc kubernetes -o jsonpath='{.spec.type}')" = "ClusterIP" ] || { echo "the kubernetes Service is not ClusterIP"; exit 1; }
for i in 1 2 3 4 5 6; do curl -sk -m 2 -o /dev/null https://node01:31443/ || exit 0; sleep 2; done
echo "port 31443 still responds"; exit 1
-->
<!-- hint
`kubectl edit svc kubernetes`: `type: ClusterIP` and remove `nodePort` from the port. Or `kubectl patch svc kubernetes --type=json -p='[{"op":"replace","path":"/spec/type","value":"ClusterIP"},{"op":"remove","path":"/spec/ports/0/nodePort"}]'`.
-->
<!-- solution
kubectl patch svc kubernetes --type=json -p='[{"op":"replace","path":"/spec/type","value":"ClusterIP"},{"op":"remove","path":"/spec/ports/0/nodePort"}]'
sleep 3
-->

## NodeRestriction

Show why NodeRestriction matters. With the **kubelet's** credentials from node01, try to set a label on the `controlplane` node:

```bash
scp node01:/etc/kubernetes/kubelet.conf /root/node01-kubelet.conf
sed -i 's#/var/lib/kubelet/pki#/root/node01-pki#' /root/node01-kubelet.conf
mkdir -p /root/node01-pki && scp node01:/var/lib/kubelet/pki/kubelet-client-current.pem /root/node01-pki/
kubectl --kubeconfig /root/node01-kubelet.conf label node controlplane hacked=true
```

Without NodeRestriction this succeeds. Re-enable the plugin in `/etc/kubernetes/manifests/kube-apiserver.yaml` (`--enable-admission-plugins=NodeRestriction`), wait for the API server to come back up, and remove the `hacked` label from `controlplane`. The same command must then be denied.

<!-- verify
grep -q -- '--enable-admission-plugins=.*NodeRestriction' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "NodeRestriction is not enabled in the manifest"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "the API server is not responding"; exit 1; }
kubectl get node controlplane -o jsonpath='{.metadata.labels.hacked}' | grep -q . && { echo "controlplane still has the hacked label"; exit 1; }
[ -s /root/node01-kubelet.conf ] || { echo "/root/node01-kubelet.conf from the first part of the step is missing"; exit 1; }
out=$(kubectl --kubeconfig /root/node01-kubelet.conf label node controlplane provjera=1 --dry-run=server 2>&1)
echo "$out" | grep -qi 'forbidden\|cannot modify' || { echo "the node01 kubelet can still modify controlplane"; exit 1; }
-->
<!-- hint
NodeRestriction limits the kubelet (`system:node:node01`) to its own `Node` object and the Pods on it. After changing the manifest, watch `watch crictl ps` until kube-apiserver is `Running`.
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
