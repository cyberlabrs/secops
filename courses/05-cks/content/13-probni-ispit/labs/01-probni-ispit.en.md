# Practice exam (16 tasks, 120 minutes)

A simulation of the hands-on CKS exam. The tasks cover all six domains, and the percentage next to each task is its weight. Everything is done on a single cluster (`controlplane` + `node01`); write file-based answers to `/opt/exam/`.

Tasks 8 and 12 modify the kube-apiserver. Before each change, make a copy of the manifest **outside** `/etc/kubernetes/manifests/`.

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

## Task 1 (6%): NetworkPolicy

In `exam-net`, create a NetworkPolicy `db-only-api`: the Pod `app=db` accepts traffic **only** from Pods `app=api` in the same namespace, on TCP 6379.

<!-- verify
kubectl -n exam-net get netpol db-only-api >/dev/null 2>&1 || { echo "NetworkPolicy db-only-api does not exist"; exit 1; }
kubectl -n exam-net exec api -- nc -z -w 2 db 6379 >/dev/null 2>&1 || { echo "api cannot reach db"; exit 1; }
kubectl -n exam-net exec other -- nc -z -w 2 db 6379 >/dev/null 2>&1 && { echo "other can reach db"; exit 1; }
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

## Task 2 (6%): Kubelet

`kube-bench` on `node01` reports FAIL for **4.2.1** (anonymous access to the kubelet). Fix the kubelet configuration so that 4.2.1 is PASS and `node01` stays Ready.

<!-- verify
ssh node01 kube-bench run --targets node --check 4.2.1 2>/dev/null | grep -q '^\[PASS\] 4.2.1 ' || { echo "4.2.1 is not PASS on node01"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 is not Ready"; exit 1; }
-->
<!-- solution
ssh node01 "sed -i '/^  anonymous:/{n;s/enabled: true/enabled: false/}' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Task 3 (5%): RBAC

The ServiceAccount `monitor` in `exam-app` has `cluster-admin`. Remove that permission and give it only `get`, `list` and `watch` on `pods` in the `exam-app` namespace (Role and RoleBinding `monitor`).

<!-- verify
SA=system:serviceaccount:exam-app:monitor
[ "$(kubectl auth can-i list pods -n exam-app --as=$SA)" = "yes" ] || { echo "monitor cannot list pods"; exit 1; }
for x in "get secrets -n exam-app" "delete pods -n exam-app" "list pods -n default" "create deployments -n exam-app"; do [ "$(kubectl auth can-i $x --as=$SA)" = "no" ] || { echo "monitor can still: $x"; exit 1; }; done
-->
<!-- solution
kubectl delete clusterrolebinding monitor-admin
kubectl -n exam-app create role monitor --verb=get,list,watch --resource=pods
kubectl -n exam-app create rolebinding monitor --role=monitor --serviceaccount=exam-app:monitor
-->

## Task 4 (4%): ServiceAccount token

In the `exam-app` namespace, the `default` ServiceAccount must not automatically mount a token. After a rollout, the Deployment `web` must run without a token.

<!-- verify
[ "$(kubectl -n exam-app get sa default -o jsonpath='{.automountServiceAccountToken}')" = "false" ] || { echo "SA default still mounts the token"; exit 1; }
p=$(kubectl -n exam-app get pod -l app=web -o json | jq -r '[.items[] | select(.metadata.deletionTimestamp == null)][0].metadata.name')
kubectl -n exam-app exec $p -- ls /var/run/secrets/kubernetes.io/serviceaccount/token >/dev/null 2>&1 && { echo "the web Pod still has a token (rollout?)"; exit 1; }
exit 0
-->
<!-- solution
kubectl -n exam-app patch sa default -p '{"automountServiceAccountToken": false}'
kubectl -n exam-app rollout restart deploy web
kubectl -n exam-app rollout status deploy/web --timeout=120s
sleep 5
-->

## Task 5 (8%): AppArmor

On `node01`, load (enforce) an AppArmor profile `exam-deny-etc` that denies writes to `/etc/**` and allows everything else. Then create a Pod `hardened` in `exam-app` (`busybox:1.37`, `sleep 36000`) on `node01` with that profile. `touch /etc/x` in the Pod must fail, and `touch /tmp/x` must work.

<!-- verify
kubectl -n exam-app exec hardened -- cat /proc/1/attr/current 2>/dev/null | grep -q 'exam-deny-etc (enforce)' || { echo "hardened is not running under the exam-deny-etc profile"; exit 1; }
kubectl -n exam-app exec hardened -- touch /etc/x 2>/dev/null && { echo "writing to /etc works"; exit 1; }
kubectl -n exam-app exec hardened -- touch /tmp/x 2>/dev/null || { echo "writing to /tmp does not work"; exit 1; }
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

## Task 6 (6%): seccomp

The Deployment `web` in `exam-app` must use the **RuntimeDefault** seccomp profile at the Pod level.

<!-- verify
[ "$(kubectl -n exam-app get deploy web -o jsonpath='{.spec.template.spec.securityContext.seccompProfile.type}')" = "RuntimeDefault" ] || { echo "web does not have seccompProfile RuntimeDefault"; exit 1; }
kubectl -n exam-app rollout status deploy/web --timeout=5s >/dev/null 2>&1 || { echo "the web rollout has not finished"; exit 1; }
-->
<!-- solution
kubectl -n exam-app patch deploy web -p '{"spec":{"template":{"spec":{"securityContext":{"seccompProfile":{"type":"RuntimeDefault"}}}}}}'
kubectl -n exam-app rollout status deploy/web --timeout=120s
-->

## Task 7 (7%): Pod Security

The namespace `exam-psa` must enforce (`enforce`) the Pod Security level **baseline**. The Deployment `legacy` violates it (`privileged`). Remove `privileged` from it so that it keeps running, and set the label.

<!-- verify
[ "$(kubectl get ns exam-psa -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}')" = "baseline" ] || { echo "enforce is not baseline"; exit 1; }
kubectl -n exam-psa run psa-test --image=busybox:1.37 --privileged --dry-run=server -- sleep 1 >/dev/null 2>&1 && { echo "a privileged Pod is allowed"; exit 1; }
[ "$(kubectl -n exam-psa get deploy legacy -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "legacy is not running"; exit 1; }
kubectl -n exam-psa get deploy legacy -o jsonpath='{.spec.template.spec.containers[0].securityContext.privileged}' | grep -q true && { echo "legacy is still privileged"; exit 1; }
exit 0
-->
<!-- solution
kubectl -n exam-psa patch deploy legacy --type=json -p='[{"op":"remove","path":"/spec/template/spec/containers/0/securityContext"}]'
kubectl -n exam-psa rollout status deploy/legacy --timeout=120s
kubectl label ns exam-psa pod-security.kubernetes.io/enforce=baseline --overwrite
-->

## Task 8 (9%): Encryption at rest

Enable encryption of Secrets in etcd with the `aescbc` provider (configuration in `/etc/kubernetes/enc/enc.yaml`, with `identity` as the second provider) and re-encrypt the existing Secrets. The Secret `vault-token` in `exam-sec` must have the prefix `k8s:enc:aescbc:v1:` in etcd.

<!-- verify
grep -q -- '--encryption-provider-config=/etc/kubernetes/enc/enc.yaml' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "--encryption-provider-config is missing"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key get /registry/secrets/exam-sec/vault-token | grep -aq 'k8s:enc:aescbc:v1:' || { echo "vault-token is not encrypted in etcd"; exit 1; }
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

## Task 9 (5%): gVisor

Create a RuntimeClass `sandboxed` (handler `runsc`) and a Pod `untrusted` in `exam-app` (`busybox:1.37`, `sleep 36000`) that runs under it.

<!-- verify
[ "$(kubectl get runtimeclass sandboxed -o jsonpath='{.handler}' 2>/dev/null)" = "runsc" ] || { echo "RuntimeClass sandboxed does not exist"; exit 1; }
kubectl -n exam-app exec untrusted -- dmesg 2>/dev/null | grep -qi gvisor || { echo "untrusted is not running in gVisor"; exit 1; }
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

## Task 10 (6%): Vulnerable images

Use Trivy to scan the images of all Pods in `exam-img` and delete the Pods whose images have at least one **CRITICAL** vulnerability. The other Pods stay.

<!-- verify
for p in $(kubectl -n exam-img get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n exam-img get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && { echo "Pod $p ($img) has CRITICAL vulnerabilities and is still running"; exit 1; }
done
kubectl -n exam-img get pod tools >/dev/null 2>&1 || { echo "tools was deleted, but it has no CRITICAL vulnerabilities"; exit 1; }
-->
<!-- solution
for p in $(kubectl -n exam-img get pods -o jsonpath='{.items[*].metadata.name}'); do
  img=$(kubectl -n exam-img get pod $p -o jsonpath='{.spec.containers[0].image}')
  n=$(trivy image -q --severity CRITICAL -f json $img 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]?] | length')
  [ "${n:-0}" -gt 0 ] && kubectl -n exam-img delete pod $p --now
done
true
-->

## Task 11 (6%): Forbidding the latest tag

Create a ValidatingAdmissionPolicy `no-latest` and a binding `no-latest` (`Deny`) that, in the `exam-strict` namespace, reject Pods with an image without a tag or with the `latest` tag.

<!-- verify
d() { kubectl -n exam-strict run vap-t --image=$1 --dry-run=server -o name >/dev/null 2>&1; }
d nginx:1.28 || { echo "nginx:1.28 is rejected"; exit 1; }
d nginx:latest && { echo "nginx:latest is allowed"; exit 1; }
d nginx && { echo "nginx without a tag is allowed"; exit 1; }
kubectl -n default run vap-t --image=nginx:latest --dry-run=server -o name >/dev/null 2>&1 || { echo "the policy also applies outside exam-strict"; exit 1; }
-->
<!-- hint
CEL: `object.spec.containers.all(c, c.image.contains(':') && !c.image.endsWith(':latest'))`. Restrict the binding with a `namespaceSelector` on `kubernetes.io/metadata.name: exam-strict`.
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

## Task 12 (9%): Audit logs

The policy has been prepared in `/etc/kubernetes/audit/policy.yaml`. Enable auditing in the kube-apiserver: log to `/var/log/kubernetes/audit/audit.log`, at most **5** old files (`maxbackup`), retention of **10** days (`maxage`). Don't forget the volumes.

<!-- verify
m=/etc/kubernetes/manifests/kube-apiserver.yaml
for fl in audit-policy-file=/etc/kubernetes/audit/policy.yaml audit-log-path=/var/log/kubernetes/audit/audit.log audit-log-maxbackup=5 audit-log-maxage=10; do grep -q -- "--$fl" $m || { echo "missing --$fl"; exit 1; }; done
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
[ -s /var/log/kubernetes/audit/audit.log ] || { echo "audit.log is not being written"; exit 1; }
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

## Task 13 (8%): Falco

Falco on `node01` reports that a Pod in `exam-run` is reading `/etc/shadow`. Find it, write the name of its **Deployment** to `/opt/exam/falco.txt` and scale that Deployment to 0. Do not touch the other Deployment in the namespace.

<!-- verify
[ "$(tr -d ' \n' < /opt/exam/falco.txt 2>/dev/null)" = "invoices" ] || { echo "falco.txt does not contain the name of the correct Deployment"; exit 1; }
[ "$(kubectl -n exam-run get deploy invoices -o jsonpath='{.spec.replicas}')" = "0" ] || { echo "the Deployment is not scaled to 0"; exit 1; }
[ "$(kubectl -n exam-run get deploy checkout -o jsonpath='{.spec.replicas}')" = "1" ] || { echo "checkout was modified"; exit 1; }
-->
<!-- solution
for i in $(seq 40); do ssh node01 journalctl -u falco --no-pager | grep -q 'k8s_pod_name=invoices' && break; sleep 3; done
echo invoices > /opt/exam/falco.txt
kubectl -n exam-run scale deploy invoices --replicas=0
-->

## Task 14 (6%): Immutable container

The Deployment `checkout` in `exam-run` must have `readOnlyRootFilesystem: true` and keep running (nginx needs an `emptyDir` for `/var/cache/nginx`, `/var/run` and `/tmp`).

<!-- verify
kubectl -n exam-run get deploy checkout -o jsonpath='{.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem}' | grep -q true || { echo "readOnlyRootFilesystem: true is missing"; exit 1; }
kubectl -n exam-run rollout status deploy/checkout --timeout=5s >/dev/null 2>&1 || { echo "the checkout rollout has not finished"; exit 1; }
[ "$(kubectl -n exam-run get deploy checkout -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "checkout is not running"; exit 1; }
-->
<!-- solution
kubectl -n exam-run patch deploy checkout --type=json -p='[
{"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"readOnlyRootFilesystem":true}},
{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"cache","mountPath":"/var/cache/nginx"},{"name":"run","mountPath":"/var/run"},{"name":"tmp","mountPath":"/tmp"}]},
{"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"cache","emptyDir":{}},{"name":"run","emptyDir":{}},{"name":"tmp","emptyDir":{}}]}]'
kubectl -n exam-run rollout status deploy/checkout --timeout=180s
-->

## Task 15 (5%): Static analysis

In `/opt/exam/pod.yaml`, create a manifest for a Pod `secure-pod` (namespace `exam-app`, `nginx:1.28-alpine`) for which `kubesec scan` gives a score of **at least 5**, and apply it. The Pod must be running.

<!-- verify
s=$(kubesec scan /opt/exam/pod.yaml 2>/dev/null | jq -r '.[0].score')
[ -n "$s" ] && [ "$s" -ge 5 ] 2>/dev/null || { echo "the kubesec score is ${s:-unknown} (must be ≥ 5)"; exit 1; }
[ "$(kubectl -n exam-app get pod secure-pod -o jsonpath='{.status.phase}' 2>/dev/null)" = "Running" ] || { echo "secure-pod is not running"; exit 1; }
-->
<!-- hint
Points come from, e.g., `runAsNonRoot`, `runAsUser` > 10000, `readOnlyRootFilesystem`, `capabilities.drop: [ALL]`, `resources.limits`, ServiceAccount. nginx-alpine as non-root needs an `emptyDir` for `/var/cache/nginx`, `/var/run` and `/tmp`, and a port above 1024 is not required for this task (the Pod only needs to be running).
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

## Task 16 (4%): Binaries

`/opt/exam/binaries/` contains `kubectl`, `kubelet` and a `SHA512SUMS` file with the official hashes. Delete the file that does not match its hash.

<!-- verify
[ ! -e /opt/exam/binaries/kubelet ] || { echo "the modified kubelet still exists"; exit 1; }
[ -e /opt/exam/binaries/kubectl ] || { echo "the valid kubectl was deleted"; exit 1; }
-->
<!-- solution
cd /opt/exam/binaries && sha512sum -c SHA512SUMS 2>/dev/null | awk -F: '/FAILED/ {print $1}' | xargs -r rm -f
-->
