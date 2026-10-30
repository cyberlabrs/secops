# Lab 3: Scheduler i controller-manager

API server radi i `kubectl` odgovara, ali klaster se ponaša čudno:

- novi Podovi ostaju `Pending`, bez ikakvog eventa,
- novi Deployment uopšte ne pravi Podove.

Svaki simptom odgovara jednoj komponenti kontrolne ravni. Pronađi koja je pokvarena i popravi je.

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

## Podovi ostaju Pending

Pod `test` (napravi ga ako nisi) visi u `Pending` i u `describe` nema eventa `FailedScheduling`. Niko ga nije ni pokušao rasporediti.

Popravi komponentu koja raspoređuje Podove. Pod `test` mora dobiti čvor i preći u `Running`.

<!-- verify
kubectl get pod test >/dev/null 2>&1 || { echo "napravi Pod test: kubectl run test --image=nginx:1.28"; exit 1; }
[ "$(kubectl -n kube-system get pod kube-scheduler-controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ] || { echo "kube-scheduler nije Ready"; exit 1; }
[ "$(kubectl get pod test -o jsonpath='{.status.phase}')" = "Running" ] || { echo "Pod test nije Running"; exit 1; }
-->
<!-- hint
`kubectl -n kube-system logs kube-scheduler-controlplane` ili `crictl logs` kaže da ne može učitati kubeconfig. Uporedi putanju u `/etc/kubernetes/manifests/kube-scheduler.yaml` sa `ls /etc/kubernetes/*.conf`. Putanja se pojavljuje i u `--authentication-kubeconfig` i u `volumes`, pa provjeri sva mjesta.
-->
<!-- solution
kubectl get pod test >/dev/null 2>&1 || kubectl run test --image=nginx:1.28
sed -i 's#scheduller.conf#scheduler.conf#g' /etc/kubernetes/manifests/kube-scheduler.yaml
for i in $(seq 60); do [ "$(kubectl get pod test -o jsonpath='{.status.phase}')" = "Running" ] && break; sleep 3; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-scheduler-controlplane --timeout=120s
-->

## Deployment ne pravi Podove

Napravi Deployment `app` (`nginx:1.28`, 2 replike). `kubectl get deploy app` pokazuje `0/2`, a `kubectl get rs` ne pokazuje nijedan ReplicaSet.

Popravi komponentu zaduženu za kontrolere (Deployment → ReplicaSet → Pod). Deployment `app` mora imati 2 spremne replike.

<!-- verify
kubectl get deploy app >/dev/null 2>&1 || { echo "napravi Deployment app"; exit 1; }
[ "$(kubectl -n kube-system get pod kube-controller-manager-controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ] || { echo "kube-controller-manager nije Ready"; exit 1; }
[ "$(kubectl get deploy app -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "app nema 2 spremne replike"; exit 1; }
-->
<!-- hint
`kubectl -n kube-system get pods` pokazuje `kube-controller-manager-controlplane` u `CrashLoopBackOff` ili `RunContainerError`. `kubectl -n kube-system describe pod kube-controller-manager-controlplane` ili `crictl ps -a` + `crictl inspect` pokazuju da binarni fajl ne postoji. Pogledaj prvi element `command` u manifestu.
-->
<!-- solution
kubectl get deploy app >/dev/null 2>&1 || kubectl create deploy app --image=nginx:1.28 --replicas=2
sed -i 's#- kube-controller-manegar$#- kube-controller-manager#' /etc/kubernetes/manifests/kube-controller-manager.yaml
for i in $(seq 60); do [ "$(kubectl get deploy app -o jsonpath='{.status.readyReplicas}')" = "2" ] && break; sleep 3; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-controller-manager-controlplane --timeout=120s
-->
