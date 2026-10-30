# Lab 3: CRD i operator koji pravi namespaceove

Platformski tim želi da timovi traže namespace preko vlastitog resursa `NamespaceRequest`, a da namespace napravi **operator**. Operator je kontroler koji prati custom resurse i usklađuje stanje klastera sa njima.

U namespaceu `platform` već radi operator `ns-operator`. Uz to imaš:

- `/root/namespacerequest-crd.yaml` sa definicijom resursa, koja ima grešku,
- ServiceAccount `ns-operator` sa ClusterRole `ns-operator`, koja nema dovoljno dozvola.

```bash
kubectl -n platform get deploy,pods
kubectl -n platform logs deploy/ns-operator --tail=5
cat /root/namespacerequest-crd.yaml
```

<!-- setup
set -e
cluster-up
kubectl create ns platform >/dev/null
kubectl -n platform create sa ns-operator >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ns-operator
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ns-operator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ns-operator
subjects:
- kind: ServiceAccount
  name: ns-operator
  namespace: platform
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ns-operator
  namespace: platform
spec:
  replicas: 1
  selector:
    matchLabels: {app: ns-operator}
  template:
    metadata:
      labels: {app: ns-operator}
    spec:
      serviceAccountName: ns-operator
      volumes:
      - name: kubectl
        hostPath: {path: /usr/bin/kubectl, type: File}
      containers:
      - name: operator
        image: busybox:1.37
        volumeMounts:
        - {name: kubectl, mountPath: /usr/local/bin/kubectl, readOnly: true}
        command:
        - /bin/sh
        - -c
        - |
          # pojednostavljena petlja usklađivanja (reconcile loop)
          while true; do
            for r in $(kubectl get namespacerequests.platform.kurs.io -o jsonpath='{range .items[*]}{.metadata.name}={.spec.team}{" "}{end}'); do
              ns=${r%%=*}; team=${r#*=}
              if ! kubectl get ns "$ns" >/dev/null 2>&1; then
                kubectl create ns "$ns" && kubectl label ns "$ns" team="$team" managed-by=ns-operator && echo "napravljen namespace $ns za tim $team"
              fi
            done
            sleep 5
          done
EOF
cat > /root/namespacerequest-crd.yaml <<'EOF'
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: namespacerequest.platform.kurs.io
spec:
  group: platform.kurs.io
  scope: Cluster
  names:
    plural: namespacerequests
    singular: namespacerequest
    kind: NamespaceRequest
    shortNames: ["nsr"]
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["team"]
            properties:
              team:
                type: string
              quotaCPU:
                type: string
EOF
-->

## Instaliraj CRD

Primijeni `/root/namespacerequest-crd.yaml`. API server će ga odbiti: pročitaj poruku i ispravi grešku u fajlu. CRD mora biti `Established`.

```bash
kubectl apply -f /root/namespacerequest-crd.yaml
kubectl get crd | grep kurs
kubectl explain namespacerequest.spec
```

<!-- verify
kubectl get crd namespacerequests.platform.kurs.io >/dev/null 2>&1 || { echo "CRD namespacerequests.platform.kurs.io ne postoji"; exit 1; }
[ "$(kubectl get crd namespacerequests.platform.kurs.io -o jsonpath='{.status.conditions[?(@.type=="Established")].status}')" = "True" ] || { echo "CRD nije Established"; exit 1; }
-->
<!-- hint
Ime CRD-a mora biti tačno `<plural>.<group>`. Ovdje je u `metadata.name` jednina umjesto množine.
-->
<!-- solution
sed -i 's/name: namespacerequest.platform.kurs.io/name: namespacerequests.platform.kurs.io/' /root/namespacerequest-crd.yaml
kubectl apply -f /root/namespacerequest-crd.yaml
kubectl wait --for=condition=Established crd/namespacerequests.platform.kurs.io --timeout=60s
-->

## Prvi NamespaceRequest

Napravi `NamespaceRequest` sa imenom `tim-alfa` i `spec.team: alfa`. Zatim pokušaj napraviti i resurs `bez-tima` bez polja `team`: API server mora da ga odbije zbog šeme (`required`).

```bash
kubectl get nsr
kubectl -n platform logs deploy/ns-operator --tail=5
```

<!-- verify
[ "$(kubectl get namespacerequest tim-alfa -o jsonpath='{.spec.team}' 2>/dev/null)" = "alfa" ] || { echo "NamespaceRequest tim-alfa sa spec.team=alfa ne postoji"; exit 1; }
kubectl get namespacerequest bez-tima >/dev/null 2>&1 && { echo "bez-tima ne bi smio postojati: šema traži team"; exit 1; }
exit 0
-->
<!-- hint
```yaml
apiVersion: platform.kurs.io/v1
kind: NamespaceRequest
metadata:
  name: tim-alfa
spec:
  team: alfa
```
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: platform.kurs.io/v1
kind: NamespaceRequest
metadata:
  name: tim-alfa
spec:
  team: alfa
EOF
-->

## Popravi RBAC operatora

Operator vidi CRD, ali namespace `tim-alfa` još ne postoji. Pogledaj logove operatora: poruke `forbidden` tačno kažu koji glagol nad kojim resursom nedostaje.

Dopuni ClusterRole `ns-operator` sa najmanje potrebnih dozvola:

- čitanje (`get`, `list`, `watch`) resursa `namespacerequests` u grupi `platform.kurs.io`,
- pravljenje i označavanje namespaceova (`create`, `patch`).

Kad operator proradi, napraviće namespace `tim-alfa` sa oznakom `team=alfa`.

<!-- verify
SA=system:serviceaccount:platform:ns-operator
[ "$(kubectl auth can-i list namespacerequests.platform.kurs.io --as=$SA)" = "yes" ] || { echo "operator ne može list namespacerequests"; exit 1; }
[ "$(kubectl auth can-i create namespaces --as=$SA)" = "yes" ] || { echo "operator ne može create namespaces"; exit 1; }
[ "$(kubectl auth can-i delete namespaces --as=$SA)" = "no" ] || { echo "operator može brisati namespaceove: previše dozvola"; exit 1; }
[ "$(kubectl auth can-i '*' '*' --as=$SA)" = "no" ] || { echo "operator ima sve dozvole"; exit 1; }
[ "$(kubectl get ns tim-alfa -o jsonpath='{.metadata.labels.team}' 2>/dev/null)" = "alfa" ] || { echo "namespace tim-alfa sa oznakom team=alfa još ne postoji (operator radi svakih 5 s)"; exit 1; }
-->
<!-- hint
`kubectl edit clusterrole ns-operator` i dodaj pravilo sa `apiGroups: ["platform.kurs.io"]`, `resources: ["namespacerequests"]`; za namespaceove dodaj `create` i `patch` (`kubectl label` koristi patch). Provjera: `kubectl auth can-i create namespaces --as=system:serviceaccount:platform:ns-operator`.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ns-operator
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list", "create", "patch"]
- apiGroups: ["platform.kurs.io"]
  resources: ["namespacerequests"]
  verbs: ["get", "list", "watch"]
EOF
for i in $(seq 40); do [ "$(kubectl get ns tim-alfa -o jsonpath='{.metadata.labels.team}' 2>/dev/null)" = "alfa" ] && break; sleep 2; done
-->
