# Mock exam (17 tasks, 120 minutes)

A simulation of the hands-on CKA exam. The tasks cover all five domains, and the percentage next to a task is its weight. Everything is done on a single cluster (`controlplane` + `node01`). Write file-based answers to `/opt/exam/`.

Same rules as on the exam: work in order, skip what is not working and come back later. Run the check only when you think the task is done. Hints are available, but try without them.

**Solve task 1 first:** until `node01` is working, Pods from the other tasks have nowhere to be scheduled.

<!-- timer
120
-->

<!-- setup
set -e
cluster-up
mkdir -p /opt/exam
kubectl apply -f /opt/kurs/manifests/gateway-api-standard.yaml >/dev/null
helm install traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --create-namespace \
  --set providers.kubernetesGateway.enabled=true --set gateway.enabled=false \
  --set service.spec.type=NodePort --set ports.web.nodePort=30080 --set ports.websecure.nodePort=30443 \
  --wait --timeout 4m >/dev/null
kubectl apply -f /opt/kurs/manifests/metrics-server.yaml >/dev/null
kubectl -n kube-system patch deploy metrics-server --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' >/dev/null
for ns in exam ci secure web; do kubectl create ns $ns >/dev/null; done
kubectl -n ci create sa deploy-bot >/dev/null
kubectl -n secure run db --image=redis:alpine -l app=db --port=6379 >/dev/null
kubectl -n secure expose pod db --port=6379 >/dev/null
kubectl -n secure run api --image=busybox:1.37 -l app=api -- sleep 36000 >/dev/null
kubectl -n secure run other --image=busybox:1.37 -l app=other -- sleep 36000 >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata: {name: legacy-app, namespace: exam}
spec:
  replicas: 1
  selector: {matchLabels: {app: legacy-app}}
  template:
    metadata: {labels: {app: legacy-app}}
    spec:
      containers:
      - name: app
        image: busybox:1.37
        command: ["sh", "-c", "mkdir -p /var/log/app; while true; do echo \"$(date -Iseconds) narudzba obradjena\" >> /var/log/app/app.log; sleep 2; done"]
---
apiVersion: v1
kind: ConfigMap
metadata: {name: payments-config, namespace: exam}
data:
  gateway_url: https://pay.example.com
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: payments, namespace: exam}
spec:
  replicas: 2
  selector: {matchLabels: {app: payments}}
  template:
    metadata: {labels: {app: payments}}
    spec:
      containers:
      - name: app
        image: busybox:1.37
        command: ["sh", "-c", "echo gateway=$GATEWAY_URL; sleep 36000"]
        env:
        - name: GATEWAY_URL
          valueFrom:
            configMapKeyRef: {name: payments-config, key: gateway-url}
---
apiVersion: v1
kind: Pod
metadata: {name: auditor, namespace: exam}
spec:
  containers:
  - name: audit
    image: busybox:1.37
    command: ["sh", "-c", "i=0; while true; do i=$((i+1)); if [ $((i % 5)) -eq 0 ]; then echo \"AUDIT DENIED user=u$i\"; else echo \"AUDIT ALLOWED user=u$i\"; fi; sleep 1; done"]
EOF
kubectl -n secure wait --for=condition=Ready pod --all --timeout=120s >/dev/null
kubectl -n exam wait --for=condition=Ready pod/auditor --timeout=120s >/dev/null
kubectl -n kube-system rollout status deploy/metrics-server --timeout=180s >/dev/null
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca.pem#' /var/lib/kubelet/config.yaml && systemctl restart kubelet" >/dev/null 2>&1 || true
for i in $(seq 90); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" != "True" ] && break; sleep 2; done
-->

## Task 1 (12%): node01 is NotReady

Node `node01` is `NotReady`. Find the cause and fix it so that the node is `Ready` and the fix survives a node reboot.

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 is not Ready"; exit 1; }
ssh node01 grep -q 'clientCAFile: /etc/kubernetes/pki/ca.crt' /var/lib/kubelet/config.yaml || { echo "the kubelet configuration on node01 has not been fixed persistently"; exit 1; }
-->
<!-- hint
`ssh node01`, `journalctl -u kubelet -n 20`: the kubelet cannot open the CA file. Fix `clientCAFile` in `/var/lib/kubelet/config.yaml`, then `systemctl restart kubelet`.
-->
<!-- solution
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Task 2 (8%): etcd backup

Take a snapshot of the etcd database to `/opt/exam/etcd-backup.db`.

<!-- verify
etcdutl snapshot status /opt/exam/etcd-backup.db >/dev/null 2>&1 || { echo "/opt/exam/etcd-backup.db is not a valid snapshot"; exit 1; }
-->
<!-- hint
`etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/exam/etcd-backup.db`
-->
<!-- solution
etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/exam/etcd-backup.db >/dev/null
-->

## Task 3 (5%): RBAC for CI

ServiceAccount `deploy-bot` in namespace `ci` needs to create, modify and read Deployments (`create`, `update`, `patch`, `get`, `list`), but **only** in namespace `ci`. Create a Role `deployer` and a RoleBinding `deployer`.

<!-- verify
SA=system:serviceaccount:ci:deploy-bot
for v in create update patch get list; do [ "$(kubectl auth can-i $v deployments -n ci --as=$SA)" = "yes" ] || { echo "deploy-bot cannot $v deployments in ci"; exit 1; }; done
[ "$(kubectl auth can-i delete deployments -n ci --as=$SA)" = "no" ] || { echo "deploy-bot can delete deployments"; exit 1; }
[ "$(kubectl auth can-i create deployments -n default --as=$SA)" = "no" ] || { echo "deploy-bot has permissions outside ci"; exit 1; }
kubectl -n ci get role deployer >/dev/null 2>&1 && kubectl -n ci get rolebinding deployer >/dev/null 2>&1 || { echo "Role/RoleBinding deployer does not exist"; exit 1; }
-->
<!-- solution
kubectl -n ci create role deployer --verb=create,update,patch,get,list --resource=deployments
kubectl -n ci create rolebinding deployer --role=deployer --serviceaccount=ci:deploy-bot
-->

## Task 4 (5%): Deployment and NodePort

In namespace `exam`, create a Deployment `frontend` (`nginx:1.28`, 3 replicas) and a Service `frontend` of type NodePort on port 80, with `nodePort: 30900`.

<!-- verify
[ "$(kubectl -n exam get deploy frontend -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "3" ] || { echo "frontend does not have 3 ready replicas"; exit 1; }
[ "$(kubectl -n exam get svc frontend -o jsonpath='{.spec.type}/{.spec.ports[0].nodePort}' 2>/dev/null)" = "NodePort/30900" ] || { echo "Service frontend is not NodePort 30900"; exit 1; }
for i in 1 2 3 4 5; do curl -s -m 3 http://node01:30900 | grep -qi nginx && exit 0; sleep 2; done
echo "http://node01:30900 is not responding"; exit 1
-->
<!-- solution
kubectl -n exam create deploy frontend --image=nginx:1.28 --replicas=3
kubectl -n exam expose deploy frontend --type=NodePort --port=80 --dry-run=client -o yaml | sed 's/  - port: 80/  - port: 80\n    nodePort: 30900/' | kubectl apply -f -
kubectl -n exam rollout status deploy/frontend --timeout=120s
-->

## Task 5 (7%): NetworkPolicy

In namespace `secure`, create a NetworkPolicy `db-access` that allows ingress traffic to the `app=db` Pod **only** from `app=api` Pods in the same namespace, on TCP port 6379. All other ingress to `db` must be blocked.

<!-- verify
kubectl -n secure get netpol db-access >/dev/null 2>&1 || { echo "NetworkPolicy db-access does not exist"; exit 1; }
kubectl -n secure exec api -- nc -z -w 2 db 6379 >/dev/null 2>&1 || { echo "api cannot reach db:6379"; exit 1; }
kubectl -n secure exec other -- nc -z -w 2 db 6379 >/dev/null 2>&1 && { echo "other can reach db:6379"; exit 1; }
exit 0
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-access, namespace: secure}
spec:
  podSelector: {matchLabels: {app: db}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector: {matchLabels: {app: api}}
    ports: [{port: 6379, protocol: TCP}]
EOF
sleep 3
-->

## Task 6 (4%): Static Pod

On `node01`, create a static Pod `exam-static` (`httpd:alpine`). It must be visible in the cluster as `exam-static-node01` in the `Running` state.

<!-- verify
[ "$(kubectl get pod exam-static-node01 -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "exam-static-node01 is not Running"; exit 1; }
[ "$(kubectl get pod exam-static-node01 -o jsonpath='{.metadata.ownerReferences[0].kind}')" = "Node" ] || { echo "exam-static is not a static Pod"; exit 1; }
-->
<!-- solution
kubectl run exam-static --image=httpd:alpine --dry-run=client -o yaml > /root/exam-static.yaml
scp -q /root/exam-static.yaml node01:/etc/kubernetes/manifests/exam-static.yaml
for i in $(seq 60); do [ "$(kubectl get pod exam-static-node01 -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] && break; sleep 2; done
-->

## Task 7 (5%): PVC

In namespace `exam`, create a PVC `upload-data` (StorageClass `local-path`, `500Mi`, `ReadWriteOnce`) and a Pod `uploader` (`busybox:1.37`, `sleep 36000`) that mounts it at `/data`. The PVC must be `Bound`.

<!-- verify
[ "$(kubectl -n exam get pvc upload-data -o jsonpath='{.status.phase}/{.spec.resources.requests.storage}' 2>/dev/null)" = "Bound/500Mi" ] || { echo "PVC upload-data (500Mi) is not Bound"; exit 1; }
kubectl -n exam get pod uploader -o json 2>/dev/null | jq -e '.spec.volumes[] | select(.persistentVolumeClaim.claimName=="upload-data")' >/dev/null || { echo "uploader does not use PVC upload-data"; exit 1; }
kubectl -n exam exec uploader -- sh -c 'mount | grep -q " /data "' 2>/dev/null || { echo "/data is not mounted in uploader"; exit 1; }
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: upload-data, namespace: exam}
spec:
  storageClassName: local-path
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 500Mi}}
---
apiVersion: v1
kind: Pod
metadata: {name: uploader, namespace: exam}
spec:
  containers:
  - name: c
    image: busybox:1.37
    command: ["sleep", "36000"]
    volumeMounts: [{name: d, mountPath: /data}]
  volumes:
  - name: d
    persistentVolumeClaim: {claimName: upload-data}
EOF
kubectl -n exam wait --for=condition=Ready pod/uploader --timeout=120s
-->

## Task 8 (6%): Logging sidecar

Deployment `legacy-app` (namespace `exam`) writes its log to the file `/var/log/app/app.log`, which does not show up in `kubectl logs`. Add to it:

- an `emptyDir` volume `logs` mounted at `/var/log/app` in container `app`,
- a native sidecar `log-streamer` (`busybox:1.37`, `restartPolicy: Always` in `initContainers`) that runs `tail -F /var/log/app/app.log` with the same volume.

`kubectl -n exam logs <pod> -c log-streamer` must show the `narudzba obradjena` ("order processed") lines. The old Pod takes up to 30 seconds to terminate, so while it is shutting down, `logs deploy/legacy-app` may pick that one.

<!-- verify
d=$(kubectl -n exam get deploy legacy-app -o json)
echo "$d" | jq -e '.spec.template.spec.initContainers[]? | select(.name=="log-streamer" and .restartPolicy=="Always")' >/dev/null || { echo "native sidecar log-streamer is missing"; exit 1; }
kubectl -n exam rollout status deploy/legacy-app --timeout=5s >/dev/null 2>&1 || { echo "the legacy-app rollout has not finished"; exit 1; }
p=$(kubectl -n exam get pod -l app=legacy-app -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n exam logs "$p" -c log-streamer --tail=5 2>/dev/null | grep -q 'narudzba obradjena' || { echo "log-streamer does not show the application log"; exit 1; }
-->
<!-- solution
kubectl -n exam patch deploy legacy-app --type=json -p='[
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"logs","emptyDir":{}}]},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"logs","mountPath":"/var/log/app"}]},
{"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"log-streamer","image":"busybox:1.37","restartPolicy":"Always","command":["sh","-c","tail -F /var/log/app/app.log"],"volumeMounts":[{"name":"logs","mountPath":"/var/log/app"}]}]}]'
kubectl -n exam rollout status deploy/legacy-app --timeout=120s
sleep 5
-->

## Task 9 (5%): Pod on the control plane

In namespace `exam`, create a Pod `maintenance` (`busybox:1.37`, `sleep 36000`) that must run on node `controlplane`. Do not use `nodeName`: use a toleration and a `nodeSelector`.

<!-- verify
[ "$(kubectl -n exam get pod maintenance -o jsonpath='{.spec.nodeName}/{.status.phase}' 2>/dev/null)" = "controlplane/Running" ] || { echo "maintenance is not running on controlplane"; exit 1; }
kubectl -n exam get pod maintenance -o jsonpath='{.spec.nodeSelector}' | grep -q . || { echo "the Pod has no nodeSelector"; exit 1; }
-->
<!-- hint
```yaml
  nodeSelector: {kubernetes.io/hostname: controlplane}
  tolerations:
  - {key: node-role.kubernetes.io/control-plane, operator: Exists, effect: NoSchedule}
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: maintenance, namespace: exam}
spec:
  nodeSelector: {kubernetes.io/hostname: controlplane}
  tolerations:
  - {key: node-role.kubernetes.io/control-plane, operator: Exists, effect: NoSchedule}
  containers:
  - {name: c, image: busybox:1.37, command: ["sleep", "36000"]}
EOF
kubectl -n exam wait --for=condition=Ready pod/maintenance --timeout=120s
-->

## Task 10 (6%): Ingress

Create an Ingress `frontend` in namespace `exam` (IngressClass `traefik`) that routes host `exam.kurs.local` to Service `frontend`, port 80. Traefik is exposed on NodePort 30080.

```bash
curl -H 'Host: exam.kurs.local' http://node01:30080/
```

<!-- verify
[ "$(kubectl -n exam get ingress frontend -o jsonpath='{.spec.ingressClassName}' 2>/dev/null)" = "traefik" ] || { echo "Ingress frontend with class traefik does not exist"; exit 1; }
curl -s -m 3 -H 'Host: exam.kurs.local' http://node01:30080/ | grep -qi nginx || { echo "exam.kurs.local does not return frontend"; exit 1; }
-->
<!-- solution
kubectl -n exam create ingress frontend --class=traefik --rule="exam.kurs.local/*=frontend:80"
sleep 4
-->

## Task 11 (6%): Gateway API

In namespace `web`, create:

- a Gateway `web-gw` (`gatewayClassName: traefik`, listener `http`, HTTP, port 8000),
- an HTTPRoute `api` for host `api.kurs.local`: path `/v1` (`PathPrefix`) goes to Service `frontend` in namespace `exam`, port 80.

A route from `web` to a Service in `exam` also requires a **ReferenceGrant** in namespace `exam`.

```bash
curl -H 'Host: api.kurs.local' http://node01:30080/v1/
```

<!-- verify
[ "$(kubectl -n web get gateway web-gw -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}' 2>/dev/null)" = "True" ] || { echo "Gateway web-gw is not Programmed"; exit 1; }
kubectl -n exam get referencegrant -o name 2>/dev/null | grep -q . || { echo "no ReferenceGrant in exam"; exit 1; }
curl -s -m 3 -H 'Host: api.kurs.local' http://node01:30080/v1/ | grep -qi nginx || { echo "the response is not from the nginx frontend"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata: {name: from-web, namespace: exam}
spec:
  from: [{group: gateway.networking.k8s.io, kind: HTTPRoute, namespace: web}]
  to: [{group: "", kind: Service}]
```
For `/v1/`, nginx returns a 404 page (that file does not exist), but the response comes from nginx, and that is enough.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: web-gw, namespace: web}
spec:
  gatewayClassName: traefik
  listeners: [{name: http, protocol: HTTP, port: 8000}]
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: api, namespace: web}
spec:
  parentRefs: [{name: web-gw}]
  hostnames: [api.kurs.local]
  rules:
  - matches: [{path: {type: PathPrefix, value: /v1}}]
    backendRefs: [{name: frontend, namespace: exam, port: 80}]
---
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata: {name: from-web, namespace: exam}
spec:
  from: [{group: gateway.networking.k8s.io, kind: HTTPRoute, namespace: web}]
  to: [{group: "", kind: Service}]
EOF
kubectl -n web wait --for=condition=Programmed gateway/web-gw --timeout=60s
sleep 4
-->

## Task 12 (8%): payments is not working

Deployment `payments` in namespace `exam` has no ready Pods. Fix it **without changing the ConfigMap** `payments-config`. Both replicas must be running and print `gateway=https://pay.example.com`.

<!-- verify
[ "$(kubectl -n exam get deploy payments -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "payments does not have 2 ready replicas"; exit 1; }
[ "$(kubectl -n exam get cm payments-config -o jsonpath='{.data}')" = '{"gateway_url":"https://pay.example.com"}' ] || { echo "ConfigMap payments-config has been changed"; exit 1; }
kubectl -n exam logs deploy/payments 2>/dev/null | grep -q 'gateway=https://pay.example.com' || { echo "payments does not print the gateway URL"; exit 1; }
-->
<!-- hint
`kubectl -n exam describe pod -l app=payments`: `CreateContainerConfigError … couldn't find key gateway-url`. The key in the ConfigMap is `gateway_url`.
-->
<!-- solution
kubectl -n exam patch deploy payments --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/0/env/0/valueFrom/configMapKeyRef/key","value":"gateway_url"}]'
kubectl -n exam rollout status deploy/payments --timeout=120s
-->

## Task 13 (4%): Helm upgrade

Release `traefik` (namespace `traefik`) needs to run with 2 replicas. Run `helm upgrade` with the same chart (`/opt/kurs/charts/traefik-41.7.1.tgz`), keep the existing values and add `deployment.replicas=2`.

<!-- verify
v=$(helm get values traefik -n traefik -o json 2>/dev/null)
[ "$(echo "$v" | jq -r '.deployment.replicas')" = "2" ] || { echo "deployment.replicas is not 2"; exit 1; }
[ "$(echo "$v" | jq -r '.providers.kubernetesGateway.enabled')" = "true" ] || { echo "the upgrade lost the existing values (Gateway provider)"; exit 1; }
[ "$(kubectl -n traefik get deploy traefik -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "traefik does not have 2 ready replicas"; exit 1; }
-->
<!-- hint
`helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --reuse-values --set deployment.replicas=2`
-->
<!-- solution
helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --reuse-values --set deployment.replicas=2 --wait --timeout 3m >/dev/null
-->

## Task 14 (5%): HPA

In namespace `exam`, create an HPA `frontend` for Deployment `frontend`: 3–6 replicas, target 60% CPU. Add `requests.cpu: 50m` to Deployment `frontend` so the HPA has a baseline for its calculation.

<!-- verify
h=$(kubectl -n exam get hpa frontend -o json 2>/dev/null) || { echo "HPA frontend does not exist"; exit 1; }
[ "$(echo "$h" | jq -r '"\(.spec.minReplicas)-\(.spec.maxReplicas)-\(.spec.metrics[0].resource.target.averageUtilization)"')" = "3-6-60" ] || { echo "HPA is not 3-6 replicas with a 60% target"; exit 1; }
[ "$(kubectl -n exam get deploy frontend -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')" = "50m" ] || { echo "frontend does not have requests.cpu=50m"; exit 1; }
-->
<!-- solution
kubectl -n exam set resources deploy/frontend --requests=cpu=50m
kubectl -n exam autoscale deploy frontend --min=3 --max=6 --cpu=60% 2>/dev/null || kubectl -n exam autoscale deploy frontend --min=3 --max=6 --cpu-percent=60
kubectl -n exam rollout status deploy/frontend --timeout=120s
-->

## Task 15 (4%): PriorityClass

Create a PriorityClass `kriticno` with the value `1000000` (not the global default) and add it to Deployment `payments`.

<!-- verify
[ "$(kubectl get priorityclass kriticno -o jsonpath='{.value}' 2>/dev/null)" = "1000000" ] || { echo "PriorityClass kriticno (1000000) does not exist"; exit 1; }
[ "$(kubectl -n exam get deploy payments -o jsonpath='{.spec.template.spec.priorityClassName}')" = "kriticno" ] || { echo "payments does not use kriticno"; exit 1; }
-->
<!-- solution
kubectl create priorityclass kriticno --value=1000000
kubectl -n exam patch deploy payments -p '{"spec":{"template":{"spec":{"priorityClassName":"kriticno"}}}}'
-->

## Task 16 (2%): CRDs

Write the names of all CRDs in the `gateway.networking.k8s.io` API group to `/opt/exam/gateway-crds.txt`, one name per line.

<!-- verify
want=$(kubectl get crd -o name | sed 's#.*/##' | grep 'gateway.networking.k8s.io$' | sort)
got=$(sed 's#.*/##' /opt/exam/gateway-crds.txt 2>/dev/null | grep . | sort)
[ -n "$got" ] && [ "$want" = "$got" ] || { echo "gateway-crds.txt does not contain exactly the CRDs of group gateway.networking.k8s.io"; exit 1; }
-->
<!-- solution
kubectl get crd -o name | sed 's#.*/##' | grep 'gateway.networking.k8s.io$' > /opt/exam/gateway-crds.txt
-->

## Task 17 (3%): Logs

From Pod `auditor` (namespace `exam`), save all lines containing `DENIED` to `/opt/exam/denied.log`.

<!-- verify
[ "$(grep -c DENIED /opt/exam/denied.log 2>/dev/null)" -ge 2 ] || { echo "denied.log has no DENIED lines"; exit 1; }
grep -qv DENIED /opt/exam/denied.log && { echo "denied.log also contains other lines"; exit 1; }
exit 0
-->
<!-- solution
kubectl -n exam logs auditor | grep DENIED > /opt/exam/denied.log
-->
