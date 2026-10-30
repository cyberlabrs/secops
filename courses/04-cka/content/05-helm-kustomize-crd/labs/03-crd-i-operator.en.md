# Lab 3: A CRD and an operator that creates namespaces

The platform team wants teams to request a namespace through a custom resource `NamespaceRequest`, and an **operator** to create the namespace. An operator is a controller that watches custom resources and reconciles the cluster state with them.

The operator `ns-operator` is already running in namespace `platform`. You also have:

- `/root/namespacerequest-crd.yaml` with the resource definition, which contains an error,
- the ServiceAccount `ns-operator` with the ClusterRole `ns-operator`, which does not have enough permissions.

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

## Install the CRD

Apply `/root/namespacerequest-crd.yaml`. The API server will reject it: read the message and fix the error in the file. The CRD must be `Established`.

```bash
kubectl apply -f /root/namespacerequest-crd.yaml
kubectl get crd | grep kurs
kubectl explain namespacerequest.spec
```

<!-- verify
kubectl get crd namespacerequests.platform.kurs.io >/dev/null 2>&1 || { echo "CRD namespacerequests.platform.kurs.io does not exist"; exit 1; }
[ "$(kubectl get crd namespacerequests.platform.kurs.io -o jsonpath='{.status.conditions[?(@.type=="Established")].status}')" = "True" ] || { echo "the CRD is not Established"; exit 1; }
-->
<!-- hint
The CRD name must be exactly `<plural>.<group>`. Here `metadata.name` uses the singular instead of the plural.
-->
<!-- solution
sed -i 's/name: namespacerequest.platform.kurs.io/name: namespacerequests.platform.kurs.io/' /root/namespacerequest-crd.yaml
kubectl apply -f /root/namespacerequest-crd.yaml
kubectl wait --for=condition=Established crd/namespacerequests.platform.kurs.io --timeout=60s
-->

## The first NamespaceRequest

Create a `NamespaceRequest` named `tim-alfa` with `spec.team: alfa`. Then try to create a resource `bez-tima` ("without a team") without the `team` field: the API server must reject it because of the schema (`required`).

```bash
kubectl get nsr
kubectl -n platform logs deploy/ns-operator --tail=5
```

<!-- verify
[ "$(kubectl get namespacerequest tim-alfa -o jsonpath='{.spec.team}' 2>/dev/null)" = "alfa" ] || { echo "NamespaceRequest tim-alfa with spec.team=alfa does not exist"; exit 1; }
kubectl get namespacerequest bez-tima >/dev/null 2>&1 && { echo "bez-tima should not exist: the schema requires team"; exit 1; }
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

## Fix the operator's RBAC

The operator sees the CRD, but namespace `tim-alfa` does not exist yet. Look at the operator logs: the `forbidden` messages say exactly which verb on which resource is missing.

Extend the ClusterRole `ns-operator` with the minimum required permissions:

- reading (`get`, `list`, `watch`) the `namespacerequests` resource in the `platform.kurs.io` group,
- creating and labeling namespaces (`create`, `patch`).

Once the operator works, it will create namespace `tim-alfa` with the label `team=alfa`.

<!-- verify
SA=system:serviceaccount:platform:ns-operator
[ "$(kubectl auth can-i list namespacerequests.platform.kurs.io --as=$SA)" = "yes" ] || { echo "the operator cannot list namespacerequests"; exit 1; }
[ "$(kubectl auth can-i create namespaces --as=$SA)" = "yes" ] || { echo "the operator cannot create namespaces"; exit 1; }
[ "$(kubectl auth can-i delete namespaces --as=$SA)" = "no" ] || { echo "the operator can delete namespaces: too many permissions"; exit 1; }
[ "$(kubectl auth can-i '*' '*' --as=$SA)" = "no" ] || { echo "the operator has all permissions"; exit 1; }
[ "$(kubectl get ns tim-alfa -o jsonpath='{.metadata.labels.team}' 2>/dev/null)" = "alfa" ] || { echo "namespace tim-alfa with label team=alfa does not exist yet (the operator runs every 5 s)"; exit 1; }
-->
<!-- hint
`kubectl edit clusterrole ns-operator` and add a rule with `apiGroups: ["platform.kurs.io"]`, `resources: ["namespacerequests"]`; for namespaces add `create` and `patch` (`kubectl label` uses patch). Check: `kubectl auth can-i create namespaces --as=system:serviceaccount:platform:ns-operator`.
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
