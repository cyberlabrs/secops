# Probni ispit (17 zadataka, 120 minuta)

Simulacija praktičnog CKA ispita. Zadaci pokrivaju svih pet domena, a procenat uz zadatak je njegova težina. Sve se radi na jednom klasteru (`controlplane` + `node01`). Odgovore u obliku fajlova piši u `/opt/exam/`.

Pravila kao na ispitu: radi po redu, preskoči ono što ne ide i vrati se kasnije. Provjeru pokreni tek kad misliš da je zadatak gotov. Savjeti postoje, ali probaj bez njih.

**Zadatak 1 riješi prvi:** dok `node01` ne radi, Podovi iz ostalih zadataka nemaju gdje da se rasporede.

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

## Zadatak 1 (12%): node01 je NotReady

Čvor `node01` je `NotReady`. Pronađi uzrok i popravi ga, tako da čvor bude `Ready` i da popravka preživi restart čvora.

<!-- verify
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 nije Ready"; exit 1; }
ssh node01 grep -q 'clientCAFile: /etc/kubernetes/pki/ca.crt' /var/lib/kubelet/config.yaml || { echo "konfiguracija kubeleta na node01 nije trajno ispravljena"; exit 1; }
-->
<!-- hint
`ssh node01`, `journalctl -u kubelet -n 20`: kubelet ne može otvoriti CA fajl. Ispravi `clientCAFile` u `/var/lib/kubelet/config.yaml`, pa `systemctl restart kubelet`.
-->
<!-- solution
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Zadatak 2 (8%): etcd backup

Napravi snapshot etcd baze u `/opt/exam/etcd-backup.db`.

<!-- verify
etcdutl snapshot status /opt/exam/etcd-backup.db >/dev/null 2>&1 || { echo "/opt/exam/etcd-backup.db nije ispravan snapshot"; exit 1; }
-->
<!-- hint
`etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/exam/etcd-backup.db`
-->
<!-- solution
etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/exam/etcd-backup.db >/dev/null
-->

## Zadatak 3 (5%): RBAC za CI

ServiceAccount `deploy-bot` u namespaceu `ci` treba da pravi, mijenja i čita Deploymente (`create`, `update`, `patch`, `get`, `list`), ali **samo** u namespaceu `ci`. Napravi Role `deployer` i RoleBinding `deployer`.

<!-- verify
SA=system:serviceaccount:ci:deploy-bot
for v in create update patch get list; do [ "$(kubectl auth can-i $v deployments -n ci --as=$SA)" = "yes" ] || { echo "deploy-bot ne može $v deployments u ci"; exit 1; }; done
[ "$(kubectl auth can-i delete deployments -n ci --as=$SA)" = "no" ] || { echo "deploy-bot može brisati deploymente"; exit 1; }
[ "$(kubectl auth can-i create deployments -n default --as=$SA)" = "no" ] || { echo "deploy-bot ima dozvole van ci"; exit 1; }
kubectl -n ci get role deployer >/dev/null 2>&1 && kubectl -n ci get rolebinding deployer >/dev/null 2>&1 || { echo "Role/RoleBinding deployer ne postoji"; exit 1; }
-->
<!-- solution
kubectl -n ci create role deployer --verb=create,update,patch,get,list --resource=deployments
kubectl -n ci create rolebinding deployer --role=deployer --serviceaccount=ci:deploy-bot
-->

## Zadatak 4 (5%): Deployment i NodePort

U namespaceu `exam` napravi Deployment `frontend` (`nginx:1.28`, 3 replike) i Servis `frontend` tipa NodePort na portu 80, sa `nodePort: 30900`.

<!-- verify
[ "$(kubectl -n exam get deploy frontend -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "3" ] || { echo "frontend nema 3 spremne replike"; exit 1; }
[ "$(kubectl -n exam get svc frontend -o jsonpath='{.spec.type}/{.spec.ports[0].nodePort}' 2>/dev/null)" = "NodePort/30900" ] || { echo "Servis frontend nije NodePort 30900"; exit 1; }
for i in 1 2 3 4 5; do curl -s -m 3 http://node01:30900 | grep -qi nginx && exit 0; sleep 2; done
echo "http://node01:30900 ne odgovara"; exit 1
-->
<!-- solution
kubectl -n exam create deploy frontend --image=nginx:1.28 --replicas=3
kubectl -n exam expose deploy frontend --type=NodePort --port=80 --dry-run=client -o yaml | sed 's/  - port: 80/  - port: 80\n    nodePort: 30900/' | kubectl apply -f -
kubectl -n exam rollout status deploy/frontend --timeout=120s
-->

## Zadatak 5 (7%): NetworkPolicy

U namespaceu `secure` napravi NetworkPolicy `db-access` koja Podu `app=db` dozvoljava ulazni saobraćaj **samo** od Podova `app=api` iz istog namespacea, na TCP port 6379. Sav ostali ulaz prema `db` mora biti blokiran.

<!-- verify
kubectl -n secure get netpol db-access >/dev/null 2>&1 || { echo "NetworkPolicy db-access ne postoji"; exit 1; }
kubectl -n secure exec api -- nc -z -w 2 db 6379 >/dev/null 2>&1 || { echo "api ne može do db:6379"; exit 1; }
kubectl -n secure exec other -- nc -z -w 2 db 6379 >/dev/null 2>&1 && { echo "other može do db:6379"; exit 1; }
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

## Zadatak 6 (4%): Static Pod

Na `node01` napravi static Pod `exam-static` (`httpd:alpine`). U klasteru se mora vidjeti kao `exam-static-node01` u stanju `Running`.

<!-- verify
[ "$(kubectl get pod exam-static-node01 -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "exam-static-node01 nije Running"; exit 1; }
[ "$(kubectl get pod exam-static-node01 -o jsonpath='{.metadata.ownerReferences[0].kind}')" = "Node" ] || { echo "exam-static nije static Pod"; exit 1; }
-->
<!-- solution
kubectl run exam-static --image=httpd:alpine --dry-run=client -o yaml > /root/exam-static.yaml
scp -q /root/exam-static.yaml node01:/etc/kubernetes/manifests/exam-static.yaml
for i in $(seq 60); do [ "$(kubectl get pod exam-static-node01 -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] && break; sleep 2; done
-->

## Zadatak 7 (5%): PVC

U namespaceu `exam` napravi PVC `upload-data` (StorageClass `local-path`, `500Mi`, `ReadWriteOnce`) i Pod `uploader` (`busybox:1.37`, `sleep 36000`) koji ga montira na `/data`. PVC mora biti `Bound`.

<!-- verify
[ "$(kubectl -n exam get pvc upload-data -o jsonpath='{.status.phase}/{.spec.resources.requests.storage}' 2>/dev/null)" = "Bound/500Mi" ] || { echo "PVC upload-data (500Mi) nije Bound"; exit 1; }
kubectl -n exam get pod uploader -o json 2>/dev/null | jq -e '.spec.volumes[] | select(.persistentVolumeClaim.claimName=="upload-data")' >/dev/null || { echo "uploader ne koristi PVC upload-data"; exit 1; }
kubectl -n exam exec uploader -- sh -c 'mount | grep -q " /data "' 2>/dev/null || { echo "/data nije montiran u uploader"; exit 1; }
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

## Zadatak 8 (6%): Sidecar za logove

Deployment `legacy-app` (namespace `exam`) piše log u fajl `/var/log/app/app.log`, koji se ne vidi u `kubectl logs`. Dodaj mu:

- `emptyDir` volume `logs` montiran na `/var/log/app` u kontejneru `app`,
- native sidecar `log-streamer` (`busybox:1.37`, `restartPolicy: Always` u `initContainers`) koji izvršava `tail -F /var/log/app/app.log` sa istim volumenom.

`kubectl -n exam logs <pod> -c log-streamer` mora prikazivati linije `narudzba obradjena`. Stari Pod se gasi do 30 sekundi, pa dok traje gašenje `logs deploy/legacy-app` može izabrati njega.

<!-- verify
d=$(kubectl -n exam get deploy legacy-app -o json)
echo "$d" | jq -e '.spec.template.spec.initContainers[]? | select(.name=="log-streamer" and .restartPolicy=="Always")' >/dev/null || { echo "nema native sidecara log-streamer"; exit 1; }
kubectl -n exam rollout status deploy/legacy-app --timeout=5s >/dev/null 2>&1 || { echo "rollout legacy-app nije završen"; exit 1; }
p=$(kubectl -n exam get pod -l app=legacy-app -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n exam logs "$p" -c log-streamer --tail=5 2>/dev/null | grep -q 'narudzba obradjena' || { echo "log-streamer ne prikazuje log aplikacije"; exit 1; }
-->
<!-- solution
kubectl -n exam patch deploy legacy-app --type=json -p='[
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"logs","emptyDir":{}}]},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"logs","mountPath":"/var/log/app"}]},
{"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"log-streamer","image":"busybox:1.37","restartPolicy":"Always","command":["sh","-c","tail -F /var/log/app/app.log"],"volumeMounts":[{"name":"logs","mountPath":"/var/log/app"}]}]}]'
kubectl -n exam rollout status deploy/legacy-app --timeout=120s
sleep 5
-->

## Zadatak 9 (5%): Pod na kontrolnoj ravni

U namespaceu `exam` napravi Pod `maintenance` (`busybox:1.37`, `sleep 36000`) koji mora raditi na čvoru `controlplane`. Ne koristi `nodeName`: koristi toleraciju i `nodeSelector`.

<!-- verify
[ "$(kubectl -n exam get pod maintenance -o jsonpath='{.spec.nodeName}/{.status.phase}' 2>/dev/null)" = "controlplane/Running" ] || { echo "maintenance ne radi na controlplane"; exit 1; }
kubectl -n exam get pod maintenance -o jsonpath='{.spec.nodeSelector}' | grep -q . || { echo "Pod nema nodeSelector"; exit 1; }
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

## Zadatak 10 (6%): Ingress

Napravi Ingress `frontend` u namespaceu `exam` (IngressClass `traefik`) koji host `exam.kurs.local` šalje na Servis `frontend`, port 80. Traefik je izložen na NodePortu 30080.

```bash
curl -H 'Host: exam.kurs.local' http://node01:30080/
```

<!-- verify
[ "$(kubectl -n exam get ingress frontend -o jsonpath='{.spec.ingressClassName}' 2>/dev/null)" = "traefik" ] || { echo "Ingress frontend sa klasom traefik ne postoji"; exit 1; }
curl -s -m 3 -H 'Host: exam.kurs.local' http://node01:30080/ | grep -qi nginx || { echo "exam.kurs.local ne vraća frontend"; exit 1; }
-->
<!-- solution
kubectl -n exam create ingress frontend --class=traefik --rule="exam.kurs.local/*=frontend:80"
sleep 4
-->

## Zadatak 11 (6%): Gateway API

U namespaceu `web` napravi:

- Gateway `web-gw` (`gatewayClassName: traefik`, listener `http`, HTTP, port 8000),
- HTTPRoute `api` za host `api.kurs.local`: putanja `/v1` (`PathPrefix`) ide na Servis `frontend` u namespaceu `exam`, port 80.

Ruta iz `web` prema Servisu u `exam` traži i **ReferenceGrant** u namespaceu `exam`.

```bash
curl -H 'Host: api.kurs.local' http://node01:30080/v1/
```

<!-- verify
[ "$(kubectl -n web get gateway web-gw -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}' 2>/dev/null)" = "True" ] || { echo "Gateway web-gw nije Programmed"; exit 1; }
kubectl -n exam get referencegrant -o name 2>/dev/null | grep -q . || { echo "nema ReferenceGrant u exam"; exit 1; }
curl -s -m 3 -H 'Host: api.kurs.local' http://node01:30080/v1/ | grep -qi nginx || { echo "odgovor nije od nginx frontenda"; exit 1; }
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
nginx za `/v1/` vraća 404 stranicu (nema tog fajla), ali odgovor dolazi od nginxa, i to je dovoljno.
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

## Zadatak 12 (8%): payments ne radi

Deployment `payments` u namespaceu `exam` nema nijedan spreman Pod. Popravi ga **bez mijenjanja ConfigMapa** `payments-config`. Obje replike moraju raditi i ispisivati `gateway=https://pay.example.com`.

<!-- verify
[ "$(kubectl -n exam get deploy payments -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "payments nema 2 spremne replike"; exit 1; }
[ "$(kubectl -n exam get cm payments-config -o jsonpath='{.data}')" = '{"gateway_url":"https://pay.example.com"}' ] || { echo "ConfigMap payments-config je promijenjen"; exit 1; }
kubectl -n exam logs deploy/payments 2>/dev/null | grep -q 'gateway=https://pay.example.com' || { echo "payments ne ispisuje gateway URL"; exit 1; }
-->
<!-- hint
`kubectl -n exam describe pod -l app=payments`: `CreateContainerConfigError … couldn't find key gateway-url`. Ključ u ConfigMapu je `gateway_url`.
-->
<!-- solution
kubectl -n exam patch deploy payments --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/0/env/0/valueFrom/configMapKeyRef/key","value":"gateway_url"}]'
kubectl -n exam rollout status deploy/payments --timeout=120s
-->

## Zadatak 13 (4%): Helm upgrade

Release `traefik` (namespace `traefik`) treba da radi sa 2 replike. Uradi `helm upgrade` sa istim chartom (`/opt/kurs/charts/traefik-41.7.1.tgz`), sačuvaj postojeće vrijednosti i dodaj `deployment.replicas=2`.

<!-- verify
v=$(helm get values traefik -n traefik -o json 2>/dev/null)
[ "$(echo "$v" | jq -r '.deployment.replicas')" = "2" ] || { echo "deployment.replicas nije 2"; exit 1; }
[ "$(echo "$v" | jq -r '.providers.kubernetesGateway.enabled')" = "true" ] || { echo "upgrade je izgubio postojeće vrijednosti (Gateway provider)"; exit 1; }
[ "$(kubectl -n traefik get deploy traefik -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "traefik nema 2 spremne replike"; exit 1; }
-->
<!-- hint
`helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --reuse-values --set deployment.replicas=2`
-->
<!-- solution
helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --reuse-values --set deployment.replicas=2 --wait --timeout 3m >/dev/null
-->

## Zadatak 14 (5%): HPA

U namespaceu `exam` napravi HPA `frontend` za Deployment `frontend`: 3–6 replika, cilj 60% CPU. Deploymentu `frontend` dodaj `requests.cpu: 50m`, da HPA ima osnovu za računanje.

<!-- verify
h=$(kubectl -n exam get hpa frontend -o json 2>/dev/null) || { echo "HPA frontend ne postoji"; exit 1; }
[ "$(echo "$h" | jq -r '"\(.spec.minReplicas)-\(.spec.maxReplicas)-\(.spec.metrics[0].resource.target.averageUtilization)"')" = "3-6-60" ] || { echo "HPA nije 3-6 replika sa ciljem 60%"; exit 1; }
[ "$(kubectl -n exam get deploy frontend -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')" = "50m" ] || { echo "frontend nema requests.cpu=50m"; exit 1; }
-->
<!-- solution
kubectl -n exam set resources deploy/frontend --requests=cpu=50m
kubectl -n exam autoscale deploy frontend --min=3 --max=6 --cpu=60% 2>/dev/null || kubectl -n exam autoscale deploy frontend --min=3 --max=6 --cpu-percent=60
kubectl -n exam rollout status deploy/frontend --timeout=120s
-->

## Zadatak 15 (4%): PriorityClass

Napravi PriorityClass `kriticno` sa vrijednošću `1000000` (nije podrazumijevana) i dodaj je Deploymentu `payments`.

<!-- verify
[ "$(kubectl get priorityclass kriticno -o jsonpath='{.value}' 2>/dev/null)" = "1000000" ] || { echo "PriorityClass kriticno (1000000) ne postoji"; exit 1; }
[ "$(kubectl -n exam get deploy payments -o jsonpath='{.spec.template.spec.priorityClassName}')" = "kriticno" ] || { echo "payments ne koristi kriticno"; exit 1; }
-->
<!-- solution
kubectl create priorityclass kriticno --value=1000000
kubectl -n exam patch deploy payments -p '{"spec":{"template":{"spec":{"priorityClassName":"kriticno"}}}}'
-->

## Zadatak 16 (2%): CRD-ovi

U `/opt/exam/gateway-crds.txt` upiši imena svih CRD-ova iz API grupe `gateway.networking.k8s.io`, jedno ime po redu.

<!-- verify
want=$(kubectl get crd -o name | sed 's#.*/##' | grep 'gateway.networking.k8s.io$' | sort)
got=$(sed 's#.*/##' /opt/exam/gateway-crds.txt 2>/dev/null | grep . | sort)
[ -n "$got" ] && [ "$want" = "$got" ] || { echo "gateway-crds.txt ne sadrži tačno CRD-ove grupe gateway.networking.k8s.io"; exit 1; }
-->
<!-- solution
kubectl get crd -o name | sed 's#.*/##' | grep 'gateway.networking.k8s.io$' > /opt/exam/gateway-crds.txt
-->

## Zadatak 17 (3%): Logovi

Iz Poda `auditor` (namespace `exam`) sačuvaj u `/opt/exam/denied.log` sve linije koje sadrže `DENIED`.

<!-- verify
[ "$(grep -c DENIED /opt/exam/denied.log 2>/dev/null)" -ge 2 ] || { echo "denied.log nema DENIED linije"; exit 1; }
grep -qv DENIED /opt/exam/denied.log && { echo "denied.log sadrži i druge linije"; exit 1; }
exit 0
-->
<!-- solution
kubectl -n exam logs auditor | grep DENIED > /opt/exam/denied.log
-->
