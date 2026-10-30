# Lab 3: Scheduler and controller-manager

The API server is running and `kubectl` responds, but the cluster behaves strangely:

- new Pods stay `Pending`, without any event,
- a new Deployment does not create any Pods at all.

Each symptom corresponds to one control plane component. Find which one is broken and fix it.

```bash
kubectl -n kube-system get pods
kubectl run test --image=nginx:1.28
kubectl get pods
kubectl describe pod test | tail -5
```

<!-- setup
set -e
cluster-up
sed -i 's#--kubeconfig=/etc/kubernetes/scheduler.conf#--kubeconfig=/etc/kubernetes/scheduller.conf#' /etc/kubernetes/manifests/kube-scheduler.yaml
sed -i 's#^\(\s*\)- kube-controller-manager$#\1- kube-controller-manegar#' /etc/kubernetes/manifests/kube-controller-manager.yaml
sleep 30
-->

## Pods stay Pending

Pod `test` (create it if you have not) is stuck in `Pending`, and `describe` shows no `FailedScheduling` event. Nobody has even tried to schedule it.

Fix the component that schedules Pods. Pod `test` must get a node and move to `Running`.

<!-- verify
kubectl get pod test >/dev/null 2>&1 || { echo "create Pod test: kubectl run test --image=nginx:1.28"; exit 1; }
[ "$(kubectl -n kube-system get pod kube-scheduler-controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ] || { echo "kube-scheduler is not Ready"; exit 1; }
[ "$(kubectl get pod test -o jsonpath='{.status.phase}')" = "Running" ] || { echo "Pod test is not Running"; exit 1; }
-->
<!-- hint
`kubectl -n kube-system logs kube-scheduler-controlplane` or `crictl logs` says it cannot load the kubeconfig. Compare the path in `/etc/kubernetes/manifests/kube-scheduler.yaml` with `ls /etc/kubernetes/*.conf`. The path also appears in `--authentication-kubeconfig` and in `volumes`, so check every occurrence.
-->
<!-- solution
kubectl get pod test >/dev/null 2>&1 || kubectl run test --image=nginx:1.28
sed -i 's#scheduller.conf#scheduler.conf#g' /etc/kubernetes/manifests/kube-scheduler.yaml
for i in $(seq 60); do [ "$(kubectl get pod test -o jsonpath='{.status.phase}')" = "Running" ] && break; sleep 3; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-scheduler-controlplane --timeout=120s
-->

## The Deployment does not create Pods

Create Deployment `app` (`nginx:1.28`, 2 replicas). `kubectl get deploy app` shows `0/2`, and `kubectl get rs` shows no ReplicaSet.

Fix the component responsible for the controllers (Deployment → ReplicaSet → Pod). Deployment `app` must have 2 ready replicas.

<!-- verify
kubectl get deploy app >/dev/null 2>&1 || { echo "create Deployment app"; exit 1; }
[ "$(kubectl -n kube-system get pod kube-controller-manager-controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ] || { echo "kube-controller-manager is not Ready"; exit 1; }
[ "$(kubectl get deploy app -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "app does not have 2 ready replicas"; exit 1; }
-->
<!-- hint
`kubectl -n kube-system get pods` shows `kube-controller-manager-controlplane` in `CrashLoopBackOff` or `RunContainerError`. `kubectl -n kube-system describe pod kube-controller-manager-controlplane` or `crictl ps -a` + `crictl inspect` show that the binary does not exist. Look at the first element of `command` in the manifest.
-->
<!-- solution
kubectl get deploy app >/dev/null 2>&1 || kubectl create deploy app --image=nginx:1.28 --replicas=2
sed -i 's#- kube-controller-manegar$#- kube-controller-manager#' /etc/kubernetes/manifests/kube-controller-manager.yaml
for i in $(seq 60); do [ "$(kubectl get deploy app -o jsonpath='{.status.readyReplicas}')" = "2" ] && break; sleep 3; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-controller-manager-controlplane --timeout=120s
-->
