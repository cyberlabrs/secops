# Lab 2: Kustomize: a base and a production overlay

`/root/app/base/` contains the base version of an application: a Deployment, a Service and a ConfigMap. You will create a production **overlay** that changes the namespace, names, replica count, image and configuration, without touching the base files.

```bash
tree /root/app
kubectl kustomize /root/app/base
```

<!-- setup
set -e
cluster-up
mkdir -p /root/app/base
cd /root/app/base
cat > deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.27
        ports:
        - containerPort: 80
        envFrom:
        - configMapRef:
            name: web-config
EOF
cat > service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
EOF
cat > kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
configMapGenerator:
- name: web-config
  literals:
  - OKRUZENJE=dev
EOF
-->

## The prod overlay

Create `/root/app/overlays/prod/kustomization.yaml` that uses `../../base` and:

- puts everything into namespace `prod`,
- adds the name prefix `prod-`,
- adds the label `env: prod` to all resources,
- changes the `nginx` image to tag `1.28` (the `images` field),
- sets 3 replicas for Deployment `web` (the `replicas` field or a patch),
- sets `OKRUZENJE=prod` in the ConfigMap `web-config` (`configMapGenerator` with `behavior: merge`; `OKRUZENJE` means "environment" and the key must stay exactly as is).

Check the result without applying:

```bash
mkdir -p /root/app/overlays/prod
vim /root/app/overlays/prod/kustomization.yaml
kubectl kustomize /root/app/overlays/prod
```

<!-- verify
out=$(kubectl kustomize /root/app/overlays/prod 2>&1) || { echo "kubectl kustomize reports an error: $out" | head -3; exit 1; }
d=$(echo "$out" | awk '/^kind: Deployment/,/^---/')
echo "$d" | grep -q 'name: prod-web' || { echo "the Deployment is not named prod-web"; exit 1; }
echo "$d" | grep -q 'namespace: prod' || { echo "the Deployment is not in namespace prod"; exit 1; }
echo "$d" | grep -q 'replicas: 3' || { echo "the Deployment does not have 3 replicas"; exit 1; }
echo "$d" | grep -q 'image: nginx:1.28' || { echo "the image is not nginx:1.28"; exit 1; }
echo "$out" | grep -q 'env: prod' || { echo "the env: prod label is missing"; exit 1; }
echo "$out" | grep -q 'OKRUZENJE: prod' || { echo "the ConfigMap does not have OKRUZENJE=prod"; exit 1; }
grep -q 'nginx:1.27' /root/app/base/deployment.yaml || { echo "the base files must not be changed"; exit 1; }
-->
<!-- hint
```yaml
resources:
- ../../base
namespace: prod
namePrefix: prod-
labels:
- pairs:
    env: prod
images:
- name: nginx
  newTag: "1.28"
replicas:
- name: web
  count: 3
configMapGenerator:
- name: web-config
  behavior: merge
  literals:
  - OKRUZENJE=prod
```
`labels` with `includeSelectors: false` (the default) does not change selectors, which is safer than the deprecated `commonLabels`.
-->
<!-- solution
mkdir -p /root/app/overlays/prod
cat > /root/app/overlays/prod/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
namespace: prod
namePrefix: prod-
labels:
- pairs:
    env: prod
images:
- name: nginx
  newTag: "1.28"
replicas:
- name: web
  count: 3
configMapGenerator:
- name: web-config
  behavior: merge
  literals:
  - OKRUZENJE=prod
EOF
-->

## Applying

Create namespace `prod` and apply the overlay with `kubectl apply -k`. All 3 replicas must be running, and the container must see `OKRUZENJE=prod`.

```bash
kubectl create ns prod
kubectl apply -k /root/app/overlays/prod
kubectl -n prod get all,cm
```

Look at the ConfigMap name: the generator adds a hash suffix (e.g. `prod-web-config-7g2…`). When the content changes, the name changes too, so the Deployment rolls out automatically.

<!-- verify
[ "$(kubectl -n prod get deploy prod-web -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "3" ] || { echo "prod-web does not have 3 ready replicas"; exit 1; }
p=$(kubectl -n prod get pod -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl -n prod exec "$p" -- printenv OKRUZENJE 2>/dev/null | grep -qx prod || { echo "the container does not have OKRUZENJE=prod"; exit 1; }
kubectl -n prod get svc prod-web >/dev/null 2>&1 || { echo "Service prod-web does not exist"; exit 1; }
-->
<!-- solution
kubectl create ns prod
kubectl apply -k /root/app/overlays/prod
kubectl -n prod rollout status deploy/prod-web --timeout=120s
-->
