# Probni ispit (16 zadataka, 120 minuta)

Simulacija praktičnog CKS ispita. Zadaci pokrivaju svih šest domena, a procenat uz zadatak je njegova težina. Sve se radi na jednom klasteru (`controlplane` + `node01`), a odgovore u obliku fajlova piši u `/opt/exam/`.

Zadaci 8 i 12 mijenjaju kube-apiserver. Prije svake izmjene napravi kopiju manifesta **van** `/etc/kubernetes/manifests/`.

<!-- timer
120
-->

<!-- setup
set -e
cluster-up
mkdir -p /opt/exam /etc/kubernetes/audit
for ns in exam-net exam-app exam-psa exam-sec exam-img exam-strict exam-run; do kubectl create ns $ns >/dev/null; done
# 1: NetworkPolicy
kubectl -n exam-net run db --image=redis:alpine -l app=db --port=6379 >/dev/null
kubectl -n exam-net expose pod db --port=6379 >/dev/null
kubectl -n exam-net run api --image=busybox:1.37 -l app=api -- sleep 36000 >/dev/null
kubectl -n exam-net run other --image=busybox:1.37 -l app=other -- sleep 36000 >/dev/null
# 3, 4: RBAC i ServiceAccount
kubectl -n exam-app create sa monitor >/dev/null
kubectl create clusterrolebinding monitor-admin --clusterrole=cluster-admin --serviceaccount=exam-app:monitor >/dev/null
kubectl -n exam-app create deploy web --image=nginx:1.28 >/dev/null
# 7: PSA
kubectl -n exam-psa create deploy legacy --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl -n exam-psa patch deploy legacy --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"privileged":true}}]' >/dev/null
# 8: Secret
kubectl -n exam-sec create secret generic vault-token --from-literal=token=hvs-EXAM-0001 >/dev/null
# 10: slike
kubectl -n exam-img run old-web --image=nginx:1.19 >/dev/null
kubectl -n exam-img run old-httpd --image=httpd:2.4.39 >/dev/null
kubectl -n exam-img run tools --image=busybox:1.37 -- sleep 36000 >/dev/null
# 12: audit politika (pripremljena)
cat > /etc/kubernetes/audit/policy.yaml <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
- level: Metadata
EOF
# 5: zaostali AppArmor profil iz ranijih labova (kernel je dijeljen)
ssh node01 'echo -n exam-deny-etc > /sys/kernel/security/apparmor/.remove' 2>/dev/null || true
# 13: Falco i kompromitovani workload
ssh node01 systemctl start falco
for a in checkout invoices; do kubectl -n exam-run create deploy $a --image=nginx:1.28 >/dev/null; done
kubectl -n exam-run patch deploy invoices -p '{"spec":{"template":{"spec":{"nodeName":"node01","containers":[{"name":"nginx","command":["sh","-c","nginx; while true; do sleep 15; cat /etc/shadow > /dev/null; done"]}]}}}}' >/dev/null
kubectl -n exam-run patch deploy checkout -p '{"spec":{"template":{"spec":{"nodeName":"node01"}}}}' >/dev/null
# 16: binarni fajlovi
d=/opt/exam/binaries; mkdir -p $d; cp /usr/bin/kubectl /usr/bin/kubelet $d/
(cd $d && sha512sum kubectl kubelet > SHA512SUMS && printf 'x' >> kubelet)
# 2: kubelet na node01 otvoren
ssh node01 'awk '"'"'/^  anonymous:/ {print; getline; print "    enabled: true"; next} {print}'"'"' /var/lib/kubelet/config.yaml > /tmp/k.yaml && cat /tmp/k.yaml > /var/lib/kubelet/config.yaml && systemctl restart kubelet'
for ns in exam-net exam-app exam-psa exam-img exam-run; do kubectl -n $ns wait --for=condition=Ready pod --all --timeout=180s >/dev/null; done
-->

## Zadatak 1 (6%): NetworkPolicy

U `exam-net` napravi NetworkPolicy `db-only-api`: Pod `app=db` prima saobraćaj **samo** od Podova `app=api` iz istog namespacea, na TCP 6379.

<!-- verify
kubectl -n exam-net get netpol db-only-api >/dev/null 2>&1 || { echo "NetworkPolicy db-only-api ne postoji"; exit 1; }
kubectl -n exam-net exec api -- nc -z -w 2 db 6379 >/dev/null 2>&1 || { echo "api ne dolazi do db"; exit 1; }
kubectl -n exam-net exec other -- nc -z -w 2 db 6379 >/dev/null 2>&1 && { echo "other dolazi do db"; exit 1; }
exit 0
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-only-api, namespace: exam-net}
spec:
  podSelector: {matchLabels: {app: db}}
  policyTypes: [Ingress]
  ingress:
  - from: [{podSelector: {matchLabels: {app: api}}}]
    ports: [{port: 6379, protocol: TCP}]
EOF
sleep 3
-->

## Zadatak 2 (6%): Kubelet

`kube-bench` na `node01` prijavljuje FAIL za **4.2.1** (anonimni pristup kubeletu). Popravi konfiguraciju kubeleta, tako da 4.2.1 bude PASS i `node01` ostane Ready.

<!-- verify
ssh node01 kube-bench run --targets node --check 4.2.1 2>/dev/null | grep -q '^\[PASS\] 4.2.1 ' || { echo "4.2.1 nije PASS na node01"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 nije Ready"; exit 1; }
-->
<!-- solution
ssh node01 "sed -i '/^  anonymous:/{n;s/enabled: true/enabled: false/}' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Zadatak 3 (5%): RBAC

ServiceAccount `monitor` u `exam-app` ima `cluster-admin`. Ukloni tu dozvolu i daj mu samo `get`, `list` i `watch` nad `pods` u namespaceu `exam-app` (Role i RoleBinding `monitor`).

<!-- verify
SA=system:serviceaccount:exam-app:monitor
[ "$(kubectl auth can-i list pods -n exam-app --as=$SA)" = "yes" ] || { echo "monitor ne može list pods"; exit 1; }
for x in "get secrets -n exam-app" "delete pods -n exam-app" "list pods -n default" "create deployments -n exam-app"; do [ "$(kubectl auth can-i $x --as=$SA)" = "no" ] || { echo "monitor i dalje može: $x"; exit 1; }; done
-->
<!-- solution
kubectl delete clusterrolebinding monitor-admin
kubectl -n exam-app create role monitor --verb=get,list,watch --resource=pods
kubectl -n exam-app create rolebinding monitor --role=monitor --serviceaccount=exam-app:monitor
-->

## Zadatak 4 (4%): ServiceAccount token

U namespaceu `exam-app` ServiceAccount `default` ne smije automatski montirati token. Deployment `web` mora poslije rollouta raditi bez tokena.

<!-- verify
[ "$(kubectl -n exam-app get sa default -o jsonpath='{.automountServiceAccountToken}')" = "false" ] || { echo "SA default i dalje montira token"; exit 1; }
p=$(kubectl -n exam-app get pod -l app=web -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n exam-app exec $p -- ls /var/run/secrets/kubernetes.io/serviceaccount/token >/dev/null 2>&1 && { echo "web Pod i dalje ima token (rollout?)"; exit 1; }
exit 0
-->
<!-- solution
kubectl -n exam-app patch sa default -p '{"automountServiceAccountToken": false}'
kubectl -n exam-app rollout restart deploy web
kubectl -n exam-app rollout status deploy/web --timeout=120s
sleep 5
-->

## Zadatak 5 (8%): AppArmor

Na `node01` učitaj (enforce) AppArmor profil `exam-deny-etc`, koji zabranjuje pisanje u `/etc/**`, a sve ostalo dozvoljava. Zatim napravi Pod `hardened` u `exam-app` (`busybox:1.37`, `sleep 36000`) na `node01`, sa tim profilom. `touch /etc/x` u Podu mora pasti, a `touch /tmp/x` raditi.

<!-- verify
kubectl -n exam-app exec hardened -- cat /proc/1/attr/current 2>/dev/null | grep -q 'exam-deny-etc (enforce)' || { echo "hardened ne radi pod profilom exam-deny-etc"; exit 1; }
kubectl -n exam-app exec hardened -- touch /etc/x 2>/dev/null && { echo "upis u /etc radi"; exit 1; }
kubectl -n exam-app exec hardened -- touch /tmp/x 2>/dev/null || { echo "upis u /tmp ne radi"; exit 1; }
-->
<!-- hint
```text
#include <tunables/global>
profile exam-deny-etc flags=(attach_disconnected) {
  #include <abstractions/base>
  file,
  deny /etc/** w,
}
```
-->
<!-- solution
ssh node01 'cat > /etc/apparmor.d/exam-deny-etc <<EOF
#include <tunables/global>
profile exam-deny-etc flags=(attach_disconnected) {
  #include <abstractions/base>
  file,
  deny /etc/** w,
}
EOF
apparmor_parser -r /etc/apparmor.d/exam-deny-etc'
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: hardened, namespace: exam-app}
spec:
  nodeSelector: {kubernetes.io/hostname: node01}
  securityContext:
    appArmorProfile: {type: Localhost, localhostProfile: exam-deny-etc}
  containers: [{name: c, image: busybox:1.37, command: ["sleep", "36000"]}]
EOF
kubectl -n exam-app wait --for=condition=Ready pod/hardened --timeout=120s
-->

## Zadatak 6 (6%): seccomp

Deployment `web` u `exam-app` mora koristiti seccomp profil **RuntimeDefault** na nivou Poda.

<!-- verify
[ "$(kubectl -n exam-app get deploy web -o jsonpath='{.spec.template.spec.securityContext.seccompProfile.type}')" = "RuntimeDefault" ] || { echo "web nema seccompProfile RuntimeDefault"; exit 1; }
kubectl -n exam-app rollout status deploy/web --timeout=5s >/dev/null 2>&1 || { echo "rollout web nije završen"; exit 1; }
-->
<!-- solution
kubectl -n exam-app patch deploy web -p '{"spec":{"template":{"spec":{"securityContext":{"seccompProfile":{"type":"RuntimeDefault"}}}}}}'
kubectl -n exam-app rollout status deploy/web --timeout=120s
-->

## Zadatak 7 (7%): Pod Security

Namespace `exam-psa` mora provoditi (`enforce`) Pod Security nivo **baseline**. Deployment `legacy` ga krši (`privileged`). Ukloni `privileged` iz njega, tako da i dalje radi, i postavi oznaku.

<!-- verify
[ "$(kubectl get ns exam-psa -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}')" = "baseline" ] || { echo "enforce nije baseline"; exit 1; }
kubectl -n exam-psa run psa-test --image=busybox:1.37 --privileged --dry-run=server -- sleep 1 >/dev/null 2>&1 && { echo "privilegovani Pod je dozvoljen"; exit 1; }
[ "$(kubectl -n exam-psa get deploy legacy -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "legacy ne radi"; exit 1; }
kubectl -n exam-psa get deploy legacy -o jsonpath='{.spec.template.spec.containers[0].securityContext.privileged}' | grep -q true && { echo "legacy je i dalje privileged"; exit 1; }
exit 0
-->
<!-- solution
kubectl -n exam-psa patch deploy legacy --type=json -p='[{"op":"remove","path":"/spec/template/spec/containers/0/securityContext"}]'
kubectl -n exam-psa rollout status deploy/legacy --timeout=120s
kubectl label ns exam-psa pod-security.kubernetes.io/enforce=baseline --overwrite
-->

## Zadatak 8 (9%): Encryption at rest

Uključi šifrovanje Secreta u etcd-u providerom `aescbc` (konfiguracija u `/etc/kubernetes/enc/enc.yaml`, uz `identity` kao drugi provider) i ponovo šifruj postojeće Secrete. Secret `vault-token` u `exam-sec` u etcd-u mora imati prefiks `k8s:enc:aescbc:v1:`.

<!-- verify
grep -q -- '--encryption-provider-config=/etc/kubernetes/enc/enc.yaml' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "nema --encryption-provider-config"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key get /registry/secrets/exam-sec/vault-token | grep -aq 'k8s:enc:aescbc:v1:' || { echo "vault-token nije šifrovan u etcd-u"; exit 1; }
-->
<!-- solution
mkdir -p /etc/kubernetes/enc
cat > /etc/kubernetes/enc/enc.yaml <<EOF
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: [secrets]
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: $(head -c 32 /dev/urandom | base64)
  - identity: {}
EOF
f=/etc/kubernetes/manifests/kube-apiserver.yaml
sed -i 's#^\(\s*\)- kube-apiserver$#\1- kube-apiserver\n\1- --encryption-provider-config=/etc/kubernetes/enc/enc.yaml#' $f
sed -i 's#^\(\s*\)volumeMounts:$#\1volumeMounts:\n\1- {name: enc, mountPath: /etc/kubernetes/enc, readOnly: true}#' $f
sed -i 's#^  volumes:$#  volumes:\n  - {name: enc, hostPath: {path: /etc/kubernetes/enc, type: DirectoryOrCreate}}#' $f
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
kubectl get secrets -A -o json | kubectl replace -f - >/dev/null
-->

## Zadatak 9 (5%): gVisor

Napravi RuntimeClass `sandboxed` (handler `runsc`) i Pod `untrusted` u `exam-app` (`busybox:1.37`, `sleep 36000`) koji radi pod njim.

<!-- verify
[ "$(kubectl get runtimeclass sandboxed -o jsonpath='{.handler}' 2>/dev/null)" = "runsc" ] || { echo "RuntimeClass sandboxed ne postoji"; exit 1; }
kubectl -n exam-app exec untrusted -- dmesg 2>/dev/null | grep -qi gvisor || { echo "untrusted ne radi u gVisoru"; exit 1; }
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata: {name: sandboxed}
handler: runsc
---
apiVersion: v1
kind: Pod
metadata: {name: untrusted, namespace: exam-app}
spec:
  runtimeClassName: sandboxed
  containers: [{name: c, image: busybox:1.37, command: ["sleep", "36000"]}]
EOF
kubectl -n exam-app wait --for=condition=Ready pod/untrusted --timeout=120s
-->

## Zadatak 10 (6%): Ranjive slike

Trivyjem skeniraj slike svih Podova u `exam-img` i obriši Podove čije slike imaju barem jednu **CRITICAL** ranjivost. Ostali Podovi ostaju.

<!-- verify
for p in $(kubectl -n exam-img get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n exam-img get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && { echo "Pod $p ($img) ima CRITICAL ranjivosti i još radi"; exit 1; }
done
kubectl -n exam-img get pod tools >/dev/null 2>&1 || { echo "tools je obrisan, a nema CRITICAL ranjivosti"; exit 1; }
-->
<!-- solution
for p in $(kubectl -n exam-img get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n exam-img get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && kubectl -n exam-img delete pod $p --now
done
true
-->

## Zadatak 11 (6%): Zabrana latest taga

Napravi ValidatingAdmissionPolicy `no-latest` i binding `no-latest` (`Deny`) koji u namespaceu `exam-strict` odbijaju Podove sa slikom bez taga ili sa tagom `latest`.

<!-- verify
d() { kubectl -n exam-strict run vap-t --image=$1 --dry-run=server -o name >/dev/null 2>&1; }
d nginx:1.28 || { echo "nginx:1.28 je odbijen"; exit 1; }
d nginx:latest && { echo "nginx:latest je dozvoljen"; exit 1; }
d nginx && { echo "nginx bez taga je dozvoljen"; exit 1; }
kubectl -n default run vap-t --image=nginx:latest --dry-run=server -o name >/dev/null 2>&1 || { echo "politika važi i van exam-strict"; exit 1; }
-->
<!-- hint
CEL: `object.spec.containers.all(c, c.image.contains(':') && !c.image.endsWith(':latest'))`. Binding ograniči sa `namespaceSelector` na `kubernetes.io/metadata.name: exam-strict`.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: no-latest}
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - {apiGroups: [""], apiVersions: ["v1"], operations: ["CREATE", "UPDATE"], resources: ["pods"]}
  validations:
  - expression: "object.spec.containers.all(c, c.image.contains(':') && !c.image.endsWith(':latest'))"
    message: "slika mora imati tag koji nije latest"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: {name: no-latest}
spec:
  policyName: no-latest
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels: {kubernetes.io/metadata.name: exam-strict}
EOF
sleep 3
-->

## Zadatak 12 (9%): Audit logovi

Politika je pripremljena u `/etc/kubernetes/audit/policy.yaml`. Uključi audit u kube-apiserveru: log u `/var/log/kubernetes/audit/audit.log`, najviše **5** starih fajlova (`maxbackup`), čuvanje **10** dana (`maxage`). Ne zaboravi volumene.

<!-- verify
m=/etc/kubernetes/manifests/kube-apiserver.yaml
for fl in audit-policy-file=/etc/kubernetes/audit/policy.yaml audit-log-path=/var/log/kubernetes/audit/audit.log audit-log-maxbackup=5 audit-log-maxage=10; do grep -q -- "--$fl" $m || { echo "nedostaje --$fl"; exit 1; }; done
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
[ -s /var/log/kubernetes/audit/audit.log ] || { echo "audit.log se ne piše"; exit 1; }
-->
<!-- solution
m=/etc/kubernetes/manifests/kube-apiserver.yaml
sed -i 's#^\(\s*\)- kube-apiserver$#\1- kube-apiserver\n\1- --audit-policy-file=/etc/kubernetes/audit/policy.yaml\n\1- --audit-log-path=/var/log/kubernetes/audit/audit.log\n\1- --audit-log-maxbackup=5\n\1- --audit-log-maxage=10#' $m
sed -i 's#^\(\s*\)volumeMounts:$#\1volumeMounts:\n\1- {name: audit-policy, mountPath: /etc/kubernetes/audit/policy.yaml, readOnly: true}\n\1- {name: audit-logs, mountPath: /var/log/kubernetes/audit/}#' $m
sed -i 's#^  volumes:$#  volumes:\n  - {name: audit-policy, hostPath: {path: /etc/kubernetes/audit/policy.yaml, type: File}}\n  - {name: audit-logs, hostPath: {path: /var/log/kubernetes/audit/, type: DirectoryOrCreate}}#' $m
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
sleep 5
-->

## Zadatak 13 (8%): Falco

Falco na `node01` javlja da neki Pod u `exam-run` čita `/etc/shadow`. Pronađi ga, upiši ime njegovog **Deploymenta** u `/opt/exam/falco.txt` i skaliraj taj Deployment na 0. Drugi Deployment u namespaceu ne diraj.

<!-- verify
[ "$(tr -d ' \n' < /opt/exam/falco.txt 2>/dev/null)" = "invoices" ] || { echo "falco.txt ne sadrži ime ispravnog Deploymenta"; exit 1; }
[ "$(kubectl -n exam-run get deploy invoices -o jsonpath='{.spec.replicas}')" = "0" ] || { echo "Deployment nije skaliran na 0"; exit 1; }
[ "$(kubectl -n exam-run get deploy checkout -o jsonpath='{.spec.replicas}')" = "1" ] || { echo "checkout je diran"; exit 1; }
-->
<!-- solution
for i in $(seq 40); do ssh node01 journalctl -u falco --no-pager | grep -q 'k8s_pod_name=invoices' && break; sleep 3; done
echo invoices > /opt/exam/falco.txt
kubectl -n exam-run scale deploy invoices --replicas=0
-->

## Zadatak 14 (6%): Immutable kontejner

Deployment `checkout` u `exam-run` mora imati `readOnlyRootFilesystem: true` i i dalje raditi (nginx treba `emptyDir` za `/var/cache/nginx`, `/var/run` i `/tmp`).

<!-- verify
kubectl -n exam-run get deploy checkout -o jsonpath='{.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem}' | grep -q true || { echo "nema readOnlyRootFilesystem: true"; exit 1; }
kubectl -n exam-run rollout status deploy/checkout --timeout=5s >/dev/null 2>&1 || { echo "rollout checkout nije završen"; exit 1; }
[ "$(kubectl -n exam-run get deploy checkout -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "checkout ne radi"; exit 1; }
-->
<!-- solution
kubectl -n exam-run patch deploy checkout --type=json -p='[
{"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"readOnlyRootFilesystem":true}},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"cache","mountPath":"/var/cache/nginx"},{"name":"run","mountPath":"/var/run"},{"name":"tmp","mountPath":"/tmp"}]},
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"cache","emptyDir":{}},{"name":"run","emptyDir":{}},{"name":"tmp","emptyDir":{}}]}]'
kubectl -n exam-run rollout status deploy/checkout --timeout=180s
-->

## Zadatak 15 (5%): Statička analiza

U `/opt/exam/pod.yaml` napravi manifest Poda `secure-pod` (namespace `exam-app`, `nginx:1.28-alpine`) za koji `kubesec scan` daje score **najmanje 5**, i primijeni ga. Pod mora raditi.

<!-- verify
s=$(kubesec scan /opt/exam/pod.yaml 2>/dev/null | jq -r '.[0].score')
[ -n "$s" ] && [ "$s" -ge 5 ] 2>/dev/null || { echo "kubesec score je ${s:-nepoznat} (treba ≥ 5)"; exit 1; }
[ "$(kubectl -n exam-app get pod secure-pod -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "secure-pod ne radi"; exit 1; }
-->
<!-- hint
Bodove donose npr. `runAsNonRoot`, `runAsUser` > 10000, `readOnlyRootFilesystem`, `capabilities.drop: [ALL]`, `resources.limits`, ServiceAccount. nginx-alpine kao non-root treba `emptyDir` za `/var/cache/nginx`, `/var/run` i `/tmp`, i port iznad 1024 nije potreban za ovaj zadatak (Pod samo treba da radi).
-->
<!-- solution
cat > /opt/exam/pod.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata: {name: secure-pod, namespace: exam-app}
spec:
  automountServiceAccountToken: false
  securityContext: {runAsNonRoot: true, runAsUser: 10101, runAsGroup: 10101}
  containers:
  - name: c
    image: nginx:1.28-alpine
    command: ["sleep", "36000"]
    securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities: {drop: ["ALL"]}
    resources:
      limits: {cpu: 100m, memory: 64Mi}
      requests: {cpu: 50m, memory: 32Mi}
EOF
kubectl apply -f /opt/exam/pod.yaml
kubectl -n exam-app wait --for=condition=Ready pod/secure-pod --timeout=120s
-->

## Zadatak 16 (4%): Binarni fajlovi

U `/opt/exam/binaries/` su `kubectl` i `kubelet` i fajl `SHA512SUMS` sa zvaničnim heševima. Obriši fajl koji ne odgovara svom hešu.

<!-- verify
[ ! -e /opt/exam/binaries/kubelet ] || { echo "izmijenjeni kubelet i dalje postoji"; exit 1; }
[ -e /opt/exam/binaries/kubectl ] || { echo "obrisan je ispravan kubectl"; exit 1; }
-->
<!-- solution
cd /opt/exam/binaries && sha512sum -c SHA512SUMS 2>/dev/null | awk -F: '/FAILED/ {print $1}' | xargs -r rm -f
-->
