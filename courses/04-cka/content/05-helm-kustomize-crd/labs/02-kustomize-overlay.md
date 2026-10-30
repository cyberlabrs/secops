# Lab 2: Kustomize: base i overlay za produkciju

U `/root/app/base/` je osnovna verzija aplikacije: Deployment, Service i ConfigMap. Napravićeš **overlay** za produkciju koji mijenja namespace, imena, broj replika, image i konfiguraciju, bez diranja base fajlova.

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

## Overlay prod

Napravi `/root/app/overlays/prod/kustomization.yaml` koji koristi `../../base` i:

- stavlja sve u namespace `prod`,
- dodaje prefiks imena `prod-`,
- dodaje oznaku `env: prod` na sve resurse,
- mijenja image `nginx` u tag `1.28` (polje `images`),
- postavlja 3 replike Deploymenta `web` (polje `replicas` ili patch),
- u ConfigMapu `web-config` postavlja `OKRUZENJE=prod` (`configMapGenerator` sa `behavior: merge`).

Provjeri rezultat bez primjene:

```bash
mkdir -p /root/app/overlays/prod
vim /root/app/overlays/prod/kustomization.yaml
kubectl kustomize /root/app/overlays/prod
```

<!-- verify
out=$(kubectl kustomize /root/app/overlays/prod 2>&1) || { echo "kubectl kustomize javlja grešku: $out" | head -3; exit 1; }
d=$(echo "$out" | awk '/^kind: Deployment/,/^---/')
echo "$d" | grep -q 'name: prod-web' || { echo "Deployment nema ime prod-web"; exit 1; }
echo "$d" | grep -q 'namespace: prod' || { echo "Deployment nije u namespaceu prod"; exit 1; }
echo "$d" | grep -q 'replicas: 3' || { echo "Deployment nema 3 replike"; exit 1; }
echo "$d" | grep -q 'image: nginx:1.28' || { echo "image nije nginx:1.28"; exit 1; }
echo "$out" | grep -q 'env: prod' || { echo "nema oznake env: prod"; exit 1; }
echo "$out" | grep -q 'OKRUZENJE: prod' || { echo "ConfigMap nema OKRUZENJE=prod"; exit 1; }
grep -q 'nginx:1.27' /root/app/base/deployment.yaml || { echo "base fajlovi ne smiju biti mijenjani"; exit 1; }
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
`labels` sa `includeSelectors: false` (podrazumijevano) ne mijenja selektore, što je sigurnije od zastarjelog `commonLabels`.
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

## Primjena

Napravi namespace `prod` i primijeni overlay sa `kubectl apply -k`. Sve 3 replike moraju raditi, a kontejner mora vidjeti `OKRUZENJE=prod`.

```bash
kubectl create ns prod
kubectl apply -k /root/app/overlays/prod
kubectl -n prod get all,cm
```

Pogledaj ime ConfigMapa: generator dodaje hash sufiks (npr. `prod-web-config-7g2…`). Kad se sadržaj promijeni, mijenja se i ime, pa Deployment automatski radi rollout.

<!-- verify
[ "$(kubectl -n prod get deploy prod-web -o jsonpath='{.status.readyReplicas}' 2>/dev/null)" = "3" ] || { echo "prod-web nema 3 spremne replike"; exit 1; }
p=$(kubectl -n prod get pod -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl -n prod exec "$p" -- printenv OKRUZENJE 2>/dev/null | grep -qx prod || { echo "kontejner nema OKRUZENJE=prod"; exit 1; }
kubectl -n prod get svc prod-web >/dev/null 2>&1 || { echo "Service prod-web ne postoji"; exit 1; }
-->
<!-- solution
kubectl create ns prod
kubectl apply -k /root/app/overlays/prod
kubectl -n prod rollout status deploy/prod-web --timeout=120s
-->
