# Lab 1: Too many permissions for a ServiceAccount

The application `reporter` runs in the `apps` namespace. It only reads ConfigMaps in its own namespace, but someone gave its ServiceAccount `cluster-admin` "to make it work". If an attacker compromises the Pod, the token from the Pod gives them control over the whole cluster.

Find the problem, reduce the permissions to the minimum, and remove the token from Pods that don't need it.

```bash
kubectl -n apps get pods,sa
kubectl get clusterrolebindings -o wide | grep -v system:
kubectl auth can-i --list -n apps --as=system:serviceaccount:apps:reporter
```

<!-- setup
set -e
cluster-up
kubectl create ns apps >/dev/null
kubectl -n apps create sa reporter >/dev/null
kubectl -n apps create configmap report-config --from-literal=format=pdf >/dev/null
kubectl -n apps create secret generic db-pass --from-literal=password=Tajna123 >/dev/null
kubectl create clusterrolebinding reporter-admin --clusterrole=cluster-admin --serviceaccount=apps:reporter >/dev/null
kubectl -n apps create deploy reporter --image=curlimages/curl:8.11.1 -- sleep 36000 >/dev/null
kubectl -n apps set serviceaccount deploy reporter reporter >/dev/null
kubectl -n apps create deploy static-site --image=nginx:1.28 >/dev/null
kubectl -n apps rollout status deploy/reporter --timeout=120s >/dev/null
kubectl -n apps rollout status deploy/static-site --timeout=120s >/dev/null
-->

## What the attacker gets

Get into the Pod `reporter` and show that the token from the Pod can read Secrets across the whole cluster. The token is in `/var/run/secrets/kubernetes.io/serviceaccount/token`. From the Pod, read the Secret `db-pass` through the API and write the password value to `/root/ukradena-lozinka.txt`.

```bash
P=$(kubectl -n apps get pod -l app=reporter -o name)
kubectl -n apps exec $P -- sh -c 'curl -sk -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default/api/v1/namespaces/apps/secrets/db-pass'
```

<!-- verify
grep -qx 'Tajna123' <(tr -d ' \n' < /root/ukradena-lozinka.txt 2>/dev/null; echo) || { echo "ukradena-lozinka.txt does not contain the password from the db-pass Secret"; exit 1; }
-->
<!-- hint
The response is JSON; the value is in `.data.password` as base64. `… | grep '"password"'`, then `echo <base64> | base64 -d`.
-->
<!-- solution
P=$(kubectl -n apps get pod -l app=reporter -o name)
kubectl -n apps exec $P -- sh -c 'curl -sk -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default/api/v1/namespaces/apps/secrets/db-pass' | sed -n 's/.*"password": *"\([^"]*\)".*/\1/p' | base64 -d > /root/ukradena-lozinka.txt
-->

## Least privilege for reporter

1. Delete the ClusterRoleBinding `reporter-admin`.
2. Create a Role `config-reader` in `apps` (`get`, `list`, `watch` on `configmaps`) and a RoleBinding `reporter-config-reader` for the ServiceAccount `reporter`.

<!-- verify
SA=system:serviceaccount:apps:reporter
kubectl get clusterrolebinding reporter-admin >/dev/null 2>&1 && { echo "reporter-admin still exists"; exit 1; }
[ "$(kubectl auth can-i list configmaps -n apps --as=$SA)" = "yes" ] || { echo "reporter cannot read ConfigMaps"; exit 1; }
for x in "get secrets -n apps" "list pods -n apps" "list configmaps -n default" "create deployments -n apps"; do
  [ "$(kubectl auth can-i $x --as=$SA)" = "no" ] || { echo "reporter can still: $x"; exit 1; }
done
-->
<!-- solution
kubectl delete clusterrolebinding reporter-admin
kubectl -n apps create role config-reader --verb=get,list,watch --resource=configmaps
kubectl -n apps create rolebinding reporter-config-reader --role=config-reader --serviceaccount=apps:reporter
-->

## No token where it isn't needed

`static-site` (nginx) doesn't talk to the Kubernetes API at all, but it uses the ServiceAccount `default` with an automatically mounted token.

1. On the ServiceAccount `default` in the `apps` namespace, disable automatic token mounting.
2. Roll out `static-site` so the new Pods have no token.

`reporter` must keep its token, because it reads ConfigMaps.

<!-- verify
[ "$(kubectl -n apps get sa default -o jsonpath='{.automountServiceAccountToken}')" = "false" ] || { echo "the default SA in apps still automatically mounts a token"; exit 1; }
kubectl -n apps rollout status deploy/static-site --timeout=5s >/dev/null 2>&1 || { echo "the static-site rollout has not finished"; exit 1; }
p=$(kubectl -n apps get pod -l app=static-site -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n apps exec $p -- ls /var/run/secrets/kubernetes.io/serviceaccount/token >/dev/null 2>&1 && { echo "the static-site Pod still has a token"; exit 1; }
r=$(kubectl -n apps get pod -l app=reporter -o jsonpath='{.items[0].metadata.name}')
kubectl -n apps exec $r -- ls /var/run/secrets/kubernetes.io/serviceaccount/token >/dev/null 2>&1 || { echo "reporter lost its token"; exit 1; }
-->
<!-- hint
`kubectl -n apps patch sa default -p '{"automountServiceAccountToken": false}'` and `kubectl -n apps rollout restart deploy static-site`. The setting on the Pod (`spec.automountServiceAccountToken`) takes precedence over the ServiceAccount.
-->
<!-- solution
kubectl -n apps patch sa default -p '{"automountServiceAccountToken": false}'
kubectl -n apps rollout restart deploy static-site
kubectl -n apps rollout status deploy/static-site --timeout=120s
sleep 5
-->
