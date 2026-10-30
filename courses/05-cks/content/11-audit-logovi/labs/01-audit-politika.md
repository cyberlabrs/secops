# Lab 1: Audit logovi API servera

Neko u klasteru čita Secrete u namespaceu `finance`, a niko ne zna ko. Audit logovi nisu uključeni. Uključićeš ih sa politikom koja bilježi ono što je bitno, a ne puni disk, i zatim istražiti događaj.

<!-- setup
set -e
cluster-up
kubectl create ns finance >/dev/null
kubectl -n finance create secret generic bank-api --from-literal=token=bk-77aa >/dev/null
kubectl -n finance create sa payroll-bot >/dev/null
kubectl -n finance create role secret-reader --verb=get,list --resource=secrets >/dev/null
kubectl -n finance create rolebinding payroll-bot --role=secret-reader --serviceaccount=finance:payroll-bot >/dev/null
mkdir -p /etc/kubernetes/audit
cat > /root/simulacija.sh <<'EOF'
#!/bin/bash
# simulira aktivnost u klasteru: aplikacija čita tajnu, admin mijenja deployment
T=$(kubectl -n finance create token payroll-bot)
kubectl --kubeconfig=/dev/null --token="$T" --server=https://controlplane:6443 --certificate-authority=/etc/kubernetes/pki/ca.crt -n finance get secret bank-api -o name
kubectl -n finance create deploy ledger --image=nginx:1.28 >/dev/null 2>&1 || true
kubectl -n finance scale deploy ledger --replicas=2
touch /root/.simulacija-pokrenuta
EOF
chmod +x /root/simulacija.sh
-->

## Audit politika

Napravi `/etc/kubernetes/audit/policy.yaml` (`audit.k8s.io/v1`, kind `Policy`) sa ovim pravilima, ovim redoslijedom:

1. ne bilježi stage `RequestReceived` (`omitStages`, na nivou cijele politike),
2. `Secrets` u **cijelom klasteru**: nivo `Metadata` (nikad `Request`/`RequestResponse`, jer bi se vrijednost tajne upisala u log),
3. `get`, `list` i `watch` nad `events` i `endpoints`: nivo `None`,
4. sve izmjene (`create`, `update`, `patch`, `delete`) nad `deployments` u namespaceu `finance`: nivo `RequestResponse`,
5. sve ostalo: nivo `Metadata`.

Redoslijed je bitan: za svaki zahtjev važi **prvo** pravilo koje se poklopi.

<!-- verify
f=/etc/kubernetes/audit/policy.yaml
[ -s $f ] || { echo "$f ne postoji"; exit 1; }
grep -q 'kind: Policy' $f && grep -q 'audit.k8s.io/v1' $f || { echo "fajl nije audit.k8s.io/v1 Policy"; exit 1; }
grep -q 'RequestReceived' $f || { echo "nema omitStages: RequestReceived"; exit 1; }
grep -q 'RequestResponse' $f || { echo "nema pravila sa nivoom RequestResponse"; exit 1; }
first_secret=$(awk '/secrets/ {print NR; exit}' $f); first_rr=$(awk '/level: RequestResponse/ {print NR; exit}' $f)
[ -n "$first_secret" ] && [ "$first_secret" -lt "$first_rr" ] || { echo "pravilo za secrets mora biti prije RequestResponse pravila"; exit 1; }
-->
<!-- hint
```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events", "endpoints"]
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  namespaces: ["finance"]
  resources:
  - group: "apps"
    resources: ["deployments"]
- level: Metadata
```
-->
<!-- solution
cat > /etc/kubernetes/audit/policy.yaml <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events", "endpoints"]
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  namespaces: ["finance"]
  resources:
  - group: "apps"
    resources: ["deployments"]
- level: Metadata
EOF
-->

## Uključi audit u kube-apiserver

U `/etc/kubernetes/manifests/kube-apiserver.yaml` dodaj:

- `--audit-policy-file=/etc/kubernetes/audit/policy.yaml`
- `--audit-log-path=/var/log/kubernetes/audit/audit.log`
- `--audit-log-maxage=7`, `--audit-log-maxbackup=2`, `--audit-log-maxsize=50`
- volumene (hostPath) i volumeMounts za politiku (`/etc/kubernetes/audit/policy.yaml`, readOnly) i direktorij logova (`/var/log/kubernetes/audit/`).

Najčešća greška: flag je dodan, a volumen nije, pa API server ne vidi fajl i ne startuje.

<!-- verify
m=/etc/kubernetes/manifests/kube-apiserver.yaml
for fl in audit-policy-file=/etc/kubernetes/audit/policy.yaml audit-log-path=/var/log/kubernetes/audit/audit.log audit-log-maxage=7 audit-log-maxbackup=2 audit-log-maxsize=50; do grep -q -- "--$fl" $m || { echo "nedostaje --$fl"; exit 1; }; done
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
[ -s /var/log/kubernetes/audit/audit.log ] || { echo "audit.log se ne piše"; exit 1; }
-->
<!-- hint
```yaml
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit/audit.log
    - --audit-log-maxage=7
    - --audit-log-maxbackup=2
    - --audit-log-maxsize=50
...
    volumeMounts:
    - {name: audit-policy, mountPath: /etc/kubernetes/audit/policy.yaml, readOnly: true}
    - {name: audit-logs, mountPath: /var/log/kubernetes/audit/}
...
  volumes:
  - {name: audit-policy, hostPath: {path: /etc/kubernetes/audit/policy.yaml, type: File}}
  - {name: audit-logs, hostPath: {path: /var/log/kubernetes/audit/, type: DirectoryOrCreate}}
```
-->
<!-- solution
m=/etc/kubernetes/manifests/kube-apiserver.yaml
sed -i 's#^\(\s*\)- kube-apiserver$#\1- kube-apiserver\n\1- --audit-policy-file=/etc/kubernetes/audit/policy.yaml\n\1- --audit-log-path=/var/log/kubernetes/audit/audit.log\n\1- --audit-log-maxage=7\n\1- --audit-log-maxbackup=2\n\1- --audit-log-maxsize=50#' $m
sed -i 's#^\(\s*\)volumeMounts:$#\1volumeMounts:\n\1- {name: audit-policy, mountPath: /etc/kubernetes/audit/policy.yaml, readOnly: true}\n\1- {name: audit-logs, mountPath: /var/log/kubernetes/audit/}#' $m
sed -i 's#^  volumes:$#  volumes:\n  - {name: audit-policy, hostPath: {path: /etc/kubernetes/audit/policy.yaml, type: File}}\n  - {name: audit-logs, hostPath: {path: /var/log/kubernetes/audit/, type: DirectoryOrCreate}}#' $m
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
sleep 5
-->

## Istraga

Pokreni simulaciju „sumnjive aktivnosti“:

```bash
/root/simulacija.sh
```

Zatim iz audit loga saznaj:

1. koji je **korisnik** (puno ime, npr. `system:serviceaccount:…`) pročitao Secret `bank-api` u `finance`, i upiši ga u `/root/ko-je-citao.txt`,
2. da li se vrijednost tajne (`bk-77aa`) igdje pojavljuje u audit logu. Ne smije, i zato pravilo za Secrete koristi `Metadata`.

```bash
jq -c 'select(.objectRef.resource=="secrets" and .objectRef.name=="bank-api") | {user: .user.username, verb, level, ts: .stageTimestamp}' /var/log/kubernetes/audit/audit.log
```

<!-- verify
[ -f /root/.simulacija-pokrenuta ] || { echo "prvo pokreni /root/simulacija.sh"; exit 1; }
grep -qx 'system:serviceaccount:finance:payroll-bot' <(tr -d ' ' < /root/ko-je-citao.txt 2>/dev/null) || { echo "ko-je-citao.txt nije tačan"; exit 1; }
grep -q 'bk-77aa\|YmstNzdhYQ' /var/log/kubernetes/audit/audit.log && { echo "vrijednost tajne je u audit logu"; exit 1; }
exit 0
-->
<!-- hint
Filter: `.objectRef.resource=="secrets"` i `.verb=="get"`. Zahtjevi samog kubectl-a kao admina imaju korisnika `kubernetes-admin`. Traži drugog korisnika.
-->
<!-- solution
[ -f /root/.simulacija-pokrenuta ] || /root/simulacija.sh >/dev/null
sleep 3
jq -r 'select(.objectRef.resource=="secrets" and .objectRef.name=="bank-api" and .verb=="get") | .user.username' /var/log/kubernetes/audit/audit.log | grep serviceaccount | sort -u | head -1 > /root/ko-je-citao.txt
-->
