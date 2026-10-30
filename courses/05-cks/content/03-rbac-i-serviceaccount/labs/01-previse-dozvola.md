# Lab 1: Previše dozvola za ServiceAccount

U namespaceu `apps` radi aplikacija `reporter`. Ona samo čita ConfigMapove u svom namespaceu, ali je neko „da proradi“ njenom ServiceAccountu dao `cluster-admin`. Ako napadač kompromituje Pod, token iz Poda mu daje kontrolu nad cijelim klasterom.

Pronađi problem, smanji dozvole na minimum i ukloni token iz Podova koji ga ne trebaju.

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

## Šta napadač dobija

Uđi u Pod `reporter` i pokaži da token iz Poda može čitati Secrete u cijelom klasteru. Token je u `/var/run/secrets/kubernetes.io/serviceaccount/token`. Iz Poda pročitaj Secret `db-pass` preko API-ja i upiši vrijednost lozinke u `/root/ukradena-lozinka.txt`.

```bash
P=$(kubectl -n apps get pod -l app=reporter -o name)
kubectl -n apps exec $P -- sh -c 'curl -sk -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default/api/v1/namespaces/apps/secrets/db-pass'
```

<!-- verify
grep -qx 'Tajna123' <(tr -d ' \n' < /root/ukradena-lozinka.txt 2>/dev/null; echo) || { echo "ukradena-lozinka.txt ne sadrži lozinku iz Secreta db-pass"; exit 1; }
-->
<!-- hint
Odgovor je JSON; vrijednost je u `.data.password` kao base64. `… | grep '"password"'`, pa `echo <base64> | base64 -d`.
-->
<!-- solution
P=$(kubectl -n apps get pod -l app=reporter -o name)
kubectl -n apps exec $P -- sh -c 'curl -sk -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default/api/v1/namespaces/apps/secrets/db-pass' | sed -n 's/.*"password": *"\([^"]*\)".*/\1/p' | base64 -d > /root/ukradena-lozinka.txt
-->

## Least privilege za reporter

1. Obriši ClusterRoleBinding `reporter-admin`.
2. Napravi Role `config-reader` u `apps` (`get`, `list`, `watch` nad `configmaps`) i RoleBinding `reporter-config-reader` za ServiceAccount `reporter`.

<!-- verify
SA=system:serviceaccount:apps:reporter
kubectl get clusterrolebinding reporter-admin >/dev/null 2>&1 && { echo "reporter-admin još postoji"; exit 1; }
[ "$(kubectl auth can-i list configmaps -n apps --as=$SA)" = "yes" ] || { echo "reporter ne može čitati ConfigMapove"; exit 1; }
for x in "get secrets -n apps" "list pods -n apps" "list configmaps -n default" "create deployments -n apps"; do
  [ "$(kubectl auth can-i $x --as=$SA)" = "no" ] || { echo "reporter i dalje može: $x"; exit 1; }
done
-->
<!-- solution
kubectl delete clusterrolebinding reporter-admin
kubectl -n apps create role config-reader --verb=get,list,watch --resource=configmaps
kubectl -n apps create rolebinding reporter-config-reader --role=config-reader --serviceaccount=apps:reporter
-->

## Bez tokena tamo gdje ne treba

`static-site` (nginx) uopšte ne razgovara sa Kubernetes API-jem, ali koristi ServiceAccount `default` sa automatski montiranim tokenom.

1. Na ServiceAccountu `default` u namespaceu `apps` isključi automatsko montiranje tokena.
2. Uradi rollout `static-site`, tako da novi Podovi nemaju token.

`reporter` mora i dalje imati svoj token, jer on čita ConfigMapove.

<!-- verify
[ "$(kubectl -n apps get sa default -o jsonpath='{.automountServiceAccountToken}')" = "false" ] || { echo "SA default u apps i dalje automatski montira token"; exit 1; }
kubectl -n apps rollout status deploy/static-site --timeout=5s >/dev/null 2>&1 || { echo "rollout static-site nije završen"; exit 1; }
p=$(kubectl -n apps get pod -l app=static-site -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n apps exec $p -- ls /var/run/secrets/kubernetes.io/serviceaccount/token >/dev/null 2>&1 && { echo "static-site Pod i dalje ima token"; exit 1; }
r=$(kubectl -n apps get pod -l app=reporter -o jsonpath='{.items[0].metadata.name}')
kubectl -n apps exec $r -- ls /var/run/secrets/kubernetes.io/serviceaccount/token >/dev/null 2>&1 || { echo "reporter je izgubio token"; exit 1; }
-->
<!-- hint
`kubectl -n apps patch sa default -p '{"automountServiceAccountToken": false}'` i `kubectl -n apps rollout restart deploy static-site`. Podešavanje na Podu (`spec.automountServiceAccountToken`) ima prednost nad ServiceAccountom.
-->
<!-- solution
kubectl -n apps patch sa default -p '{"automountServiceAccountToken": false}'
kubectl -n apps rollout restart deploy static-site
kubectl -n apps rollout status deploy/static-site --timeout=120s
sleep 5
-->
