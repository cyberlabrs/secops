# Lab 1: RBAC for a CronJob and a ServiceAccount

In namespace `ops`, the CronJob `cleaner` deletes Pods labeled `stale=true` every minute. It runs under the ServiceAccount `cleaner`, but the Jobs fail with a `forbidden` error.

Your task is to give it the **minimum** permissions it needs (least privilege), and then give the monitoring ServiceAccount permission to read nodes across the whole cluster.

```bash
kubectl -n ops get cronjob,job,pods,sa
kubectl -n ops logs job/<job-name>
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

## Why the Job fails

Look at the log of the Job `cleaner-pokusaj` and check what the ServiceAccount `cleaner` is allowed to do:

```bash
kubectl -n ops logs job/cleaner-pokusaj
kubectl auth can-i delete pods -n ops --as=system:serviceaccount:ops:cleaner
kubectl auth can-i --list -n ops --as=system:serviceaccount:ops:cleaner
```

Create in namespace `ops`:

- a **Role** `pod-cleaner` with the verbs `list` and `delete` on `pods` (`kubectl delete -l` first lists the Pods, then deletes them),
- a **RoleBinding** `pod-cleaner` that binds that Role to the ServiceAccount `cleaner`.

<!-- verify
SA=system:serviceaccount:ops:cleaner
for v in list delete; do [ "$(kubectl auth can-i $v pods -n ops --as=$SA)" = "yes" ] || { echo "cleaner cannot $v pods in ops"; exit 1; }; done
[ "$(kubectl auth can-i create pods -n ops --as=$SA)" = "no" ] || { echo "cleaner can create Pods: too many permissions"; exit 1; }
[ "$(kubectl auth can-i delete pods -n default --as=$SA)" = "no" ] || { echo "cleaner can delete Pods outside ops too: use a Role, not a ClusterRole"; exit 1; }
[ "$(kubectl auth can-i get secrets -n ops --as=$SA)" = "no" ] || { echo "cleaner can read Secrets: too many permissions"; exit 1; }
kubectl -n ops get role pod-cleaner >/dev/null 2>&1 && kubectl -n ops get rolebinding pod-cleaner >/dev/null 2>&1 || { echo "Role or RoleBinding pod-cleaner does not exist"; exit 1; }
-->
<!-- hint
`kubectl -n ops create role pod-cleaner --verb=list,delete --resource=pods` and `kubectl -n ops create rolebinding pod-cleaner --role=pod-cleaner --serviceaccount=ops:cleaner`. The ServiceAccount format is `namespace:name`.
-->
<!-- solution
kubectl -n ops create role pod-cleaner --verb=list,delete --resource=pods
kubectl -n ops create rolebinding pod-cleaner --role=pod-cleaner --serviceaccount=ops:cleaner
-->

## Run the cleanup

Run the CronJob manually: create a Job `cleaner-rucno` from the CronJob `cleaner`. When the Job succeeds, the Pods `stari-1..3` must be gone and the Pod `aktivni` must remain.

```bash
kubectl -n ops create job cleaner-rucno --from=cronjob/cleaner
kubectl -n ops get jobs -w
```

<!-- verify
[ "$(kubectl -n ops get job cleaner-rucno -o jsonpath='{.status.succeeded}' 2>/dev/null)" = "1" ] || { echo "Job cleaner-rucno did not complete successfully"; exit 1; }
[ -z "$(kubectl -n ops get pods -l stale=true -o name)" ] || { echo "Pods with stale=true still exist"; exit 1; }
kubectl -n ops get pod aktivni >/dev/null 2>&1 || { echo "Pod aktivni was deleted, but it should not have been"; exit 1; }
-->
<!-- solution
kubectl -n ops create job cleaner-rucno --from=cronjob/cleaner
kubectl -n ops wait --for=condition=Complete job/cleaner-rucno --timeout=120s
kubectl -n ops wait --for=delete pod -l stale=true --timeout=120s
-->

## Reading nodes for monitoring

The ServiceAccount `node-exporter` in namespace `monitoring` needs to read nodes (`get`, `list`, `watch`). Nodes have no namespace, so you need:

- a **ClusterRole** `node-reader`,
- a **ClusterRoleBinding** `node-reader`.

It must not be able to modify nodes.

<!-- verify
SA=system:serviceaccount:monitoring:node-exporter
for v in get list watch; do [ "$(kubectl auth can-i $v nodes --as=$SA)" = "yes" ] || { echo "node-exporter cannot $v nodes"; exit 1; }; done
for v in delete patch update; do [ "$(kubectl auth can-i $v nodes --as=$SA)" = "no" ] || { echo "node-exporter can $v nodes"; exit 1; }; done
kubectl get clusterrole node-reader >/dev/null 2>&1 && kubectl get clusterrolebinding node-reader >/dev/null 2>&1 || { echo "ClusterRole or ClusterRoleBinding node-reader does not exist"; exit 1; }
-->
<!-- hint
`kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes` and `kubectl create clusterrolebinding node-reader --clusterrole=node-reader --serviceaccount=monitoring:node-exporter`.
-->
<!-- solution
kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding node-reader --clusterrole=node-reader --serviceaccount=monitoring:node-exporter
-->
