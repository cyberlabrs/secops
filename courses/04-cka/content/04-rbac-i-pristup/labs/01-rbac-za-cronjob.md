# Lab 1: RBAC za CronJob i ServiceAccount

U namespaceu `ops` CronJob `cleaner` svakog minuta briše Podove sa oznakom `stale=true`. Radi pod ServiceAccountom `cleaner`, ali Jobovi padaju sa greškom `forbidden`.

Tvoj zadatak je da mu daš **najmanje** dozvola koje mu trebaju (least privilege), a zatim da monitoring ServiceAccountu daš pravo čitanja čvorova u cijelom klasteru.

```bash
kubectl -n ops get cronjob,job,pods,sa
kubectl -n ops logs job/<ime-joba>
```

<!-- setup
set -e
cluster-up
kubectl create ns ops >/dev/null
kubectl create ns monitoring >/dev/null
kubectl -n ops create sa cleaner >/dev/null
kubectl -n monitoring create sa node-exporter >/dev/null
for i in 1 2 3; do kubectl -n ops run stari-$i --image=busybox:1.37 -l stale=true -- sleep 3600 >/dev/null; done
kubectl -n ops run aktivni --image=busybox:1.37 -l stale=false -- sleep 3600 >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleaner
  namespace: ops
spec:
  schedule: "*/30 * * * *"
  jobTemplate:
    spec:
      backoffLimit: 0
      template:
        spec:
          serviceAccountName: cleaner
          restartPolicy: Never
          containers:
          - name: kubectl
            image: registry.k8s.io/kubectl:v1.35.0
            command: ["kubectl", "-n", "ops", "delete", "pods", "-l", "stale=true"]
EOF
kubectl -n ops create job --from=cronjob/cleaner cleaner-pokusaj >/dev/null
-->

## Zašto Job pada

Pogledaj log Joba `cleaner-pokusaj` i provjeri šta ServiceAccount `cleaner` smije:

```bash
kubectl -n ops logs job/cleaner-pokusaj
kubectl auth can-i delete pods -n ops --as=system:serviceaccount:ops:cleaner
kubectl auth can-i --list -n ops --as=system:serviceaccount:ops:cleaner
```

Napravi u namespaceu `ops`:

- **Role** `pod-cleaner` sa glagolima `list` i `delete` nad `pods` (`kubectl delete -l` prvo izlistava Podove, pa ih briše),
- **RoleBinding** `pod-cleaner` koji tu Role veže za ServiceAccount `cleaner`.

<!-- verify
SA=system:serviceaccount:ops:cleaner
for v in list delete; do [ "$(kubectl auth can-i $v pods -n ops --as=$SA)" = "yes" ] || { echo "cleaner ne može $v pods u ops"; exit 1; }; done
[ "$(kubectl auth can-i create pods -n ops --as=$SA)" = "no" ] || { echo "cleaner može kreirati Podove: previše dozvola"; exit 1; }
[ "$(kubectl auth can-i delete pods -n default --as=$SA)" = "no" ] || { echo "cleaner može brisati Podove i van ops: koristi Role, ne ClusterRole"; exit 1; }
[ "$(kubectl auth can-i get secrets -n ops --as=$SA)" = "no" ] || { echo "cleaner može čitati Secrete: previše dozvola"; exit 1; }
kubectl -n ops get role pod-cleaner >/dev/null 2>&1 && kubectl -n ops get rolebinding pod-cleaner >/dev/null 2>&1 || { echo "Role ili RoleBinding pod-cleaner ne postoji"; exit 1; }
-->
<!-- hint
`kubectl -n ops create role pod-cleaner --verb=list,delete --resource=pods` i `kubectl -n ops create rolebinding pod-cleaner --role=pod-cleaner --serviceaccount=ops:cleaner`. Format za ServiceAccount je `namespace:ime`.
-->
<!-- solution
kubectl -n ops create role pod-cleaner --verb=list,delete --resource=pods
kubectl -n ops create rolebinding pod-cleaner --role=pod-cleaner --serviceaccount=ops:cleaner
-->

## Pokreni čišćenje

Pokreni CronJob ručno: napravi Job `cleaner-rucno` iz CronJoba `cleaner`. Kad Job uspije, Podovi `stari-1..3` moraju nestati, a Pod `aktivni` ostati.

```bash
kubectl -n ops create job cleaner-rucno --from=cronjob/cleaner
kubectl -n ops get jobs -w
```

<!-- verify
[ "$(kubectl -n ops get job cleaner-rucno -o jsonpath='{.status.succeeded}' 2>/dev/null)" = "1" ] || { echo "Job cleaner-rucno nije uspješno završen"; exit 1; }
[ -z "$(kubectl -n ops get pods -l stale=true -o name)" ] || { echo "Podovi sa stale=true još postoje"; exit 1; }
kubectl -n ops get pod aktivni >/dev/null 2>&1 || { echo "Pod aktivni je obrisan, a nije trebao"; exit 1; }
-->
<!-- solution
kubectl -n ops create job cleaner-rucno --from=cronjob/cleaner
kubectl -n ops wait --for=condition=Complete job/cleaner-rucno --timeout=120s
kubectl -n ops wait --for=delete pod -l stale=true --timeout=120s
-->

## Čitanje čvorova za monitoring

ServiceAccount `node-exporter` u namespaceu `monitoring` treba da čita čvorove (`get`, `list`, `watch`). Čvorovi nemaju namespace, pa ti trebaju:

- **ClusterRole** `node-reader`,
- **ClusterRoleBinding** `node-reader`.

Ne smije moći mijenjati čvorove.

<!-- verify
SA=system:serviceaccount:monitoring:node-exporter
for v in get list watch; do [ "$(kubectl auth can-i $v nodes --as=$SA)" = "yes" ] || { echo "node-exporter ne može $v nodes"; exit 1; }; done
for v in delete patch update; do [ "$(kubectl auth can-i $v nodes --as=$SA)" = "no" ] || { echo "node-exporter može $v nodes"; exit 1; }; done
kubectl get clusterrole node-reader >/dev/null 2>&1 && kubectl get clusterrolebinding node-reader >/dev/null 2>&1 || { echo "ClusterRole ili ClusterRoleBinding node-reader ne postoji"; exit 1; }
-->
<!-- hint
`kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes` i `kubectl create clusterrolebinding node-reader --clusterrole=node-reader --serviceaccount=monitoring:node-exporter`.
-->
<!-- solution
kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding node-reader --clusterrole=node-reader --serviceaccount=monitoring:node-exporter
-->
