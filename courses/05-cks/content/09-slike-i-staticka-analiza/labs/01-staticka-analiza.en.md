# Lab 1: Static analysis of manifests and Dockerfiles

The team has prepared a manifest and a Dockerfile for a new application. Before anything goes into the cluster, you will review them with tools (**kubesec**, **kube-linter**, **trivy config**) and manually, and then fix them.

```bash
ls /root/app/
kubesec scan /root/app/deployment.yaml
kube-linter lint /root/app/deployment.yaml
trivy config /root/app/
```

<!-- setup
set -e
cluster-up
mkdir -p /root/app
cat > /root/app/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels: {app: shop}
  template:
    metadata:
      labels: {app: shop}
    spec:
      hostNetwork: true
      containers:
      - name: shop
        image: nginx:latest
        env:
        - name: DB_PASSWORD
          value: "Ljeto2026!"
        securityContext:
          privileged: true
          runAsUser: 0
EOF
cat > /root/app/Dockerfile <<'EOF'
FROM ubuntu:latest
RUN apt-get update && apt-get install -y curl wget netcat-openbsd vim gcc
ENV API_TOKEN=tok-9f8e7d6c5b4a
ADD https://example.com/app.tar.gz /opt/app/
COPY . /opt/app
RUN chmod -R 777 /opt/app
USER root
CMD ["/opt/app/start.sh"]
EOF
-->

## Findings in the manifest

Run `kubesec scan` and write the **score** that kubesec gives the original manifest (a number, possibly negative) to `/root/kubesec-score.txt`.

<!-- verify
want=$(kubesec scan /root/app/deployment.yaml.orig 2>/dev/null | jq -r '.[0].score' 2>/dev/null)
[ -z "$want" ] && want=$(cp /root/app/deployment.yaml /tmp/d.yaml; kubesec scan /tmp/d.yaml | jq -r '.[0].score')
[ "$(tr -d ' \n' < /root/kubesec-score.txt 2>/dev/null)" = "$want" ] || { echo "kubesec-score.txt is not correct (the original manifest's score is a different number)"; exit 1; }
-->
<!-- hint
`kubesec scan /root/app/deployment.yaml | jq '.[0].score'`. Also look at `.[0].scoring.critical`: why is the score so low?
-->
<!-- solution
kubesec scan /root/app/deployment.yaml | jq -r '.[0].score' > /root/kubesec-score.txt
cp /root/app/deployment.yaml /root/app/deployment.yaml.orig
-->

## Fix the manifest

Edit `/root/app/deployment.yaml` (do not create a new file) so that:

- it has neither `hostNetwork` nor `privileged`,
- it runs as non-root (`runAsNonRoot: true`, `runAsUser: 101`),
- it has `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` and `capabilities.drop: ["ALL"]`,
- the image has a specific tag (`nginx:1.28-alpine`, not `latest`),
- the password is not in the manifest: `DB_PASSWORD` is read from the Secret `shop-db` (key `password`),
- it has `resources.limits` for CPU and memory.

The kubesec score must be **at least 7**, and `kube-linter lint` must report no findings for `privileged-container`, `run-as-non-root`, `latest-tag`, `env-var-secret`, `no-read-only-root-fs` and `host-network`.

<!-- verify
f=/root/app/deployment.yaml
s=$(kubesec scan $f 2>/dev/null | jq -r '.[0].score')
[ -n "$s" ] && [ "$s" -ge 7 ] 2>/dev/null || { echo "the kubesec score is $s (must be ≥ 7)"; exit 1; }
out=$(kube-linter lint $f 2>&1)
for c in privileged-container run-as-non-root latest-tag env-var-secret no-read-only-root-fs host-network; do echo "$out" | grep -q "($c)\|check: $c" && { echo "kube-linter still reports $c"; exit 1; }; done
grep -q 'Ljeto2026' $f && { echo "the password is still in the manifest"; exit 1; }
grep -q 'secretKeyRef' $f || { echo "DB_PASSWORD does not read from a Secret"; exit 1; }
kubectl apply --dry-run=server -f $f >/dev/null 2>&1 || { echo "the manifest is not valid (kubectl apply --dry-run=server)"; exit 1; }
-->
<!-- hint
The key part:
```yaml
      securityContext: {runAsNonRoot: true, runAsUser: 101, seccompProfile: {type: RuntimeDefault}}
      containers:
      - name: shop
        image: nginx:1.28-alpine
        env:
        - name: DB_PASSWORD
          valueFrom: {secretKeyRef: {name: shop-db, key: password}}
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: {drop: ["ALL"]}
        resources:
          limits: {cpu: 200m, memory: 128Mi}
          requests: {cpu: 50m, memory: 64Mi}
```
Run `kube-linter lint` again after each change; some checks (e.g. `unset-cpu-requirements`) are not required for this step.
-->
<!-- solution
cat > /root/app/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels: {app: shop}
  template:
    metadata:
      labels: {app: shop}
    spec:
      securityContext: {runAsNonRoot: true, runAsUser: 101, seccompProfile: {type: RuntimeDefault}}
      containers:
      - name: shop
        image: nginx:1.28-alpine
        env:
        - name: DB_PASSWORD
          valueFrom: {secretKeyRef: {name: shop-db, key: password}}
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: {drop: ["ALL"]}
        resources:
          limits: {cpu: 200m, memory: 128Mi}
          requests: {cpu: 50m, memory: 64Mi}
EOF
-->

## Manual Dockerfile analysis

`/root/app/Dockerfile` has three serious problems that you should be able to recognize on the exam even without tools. Fix them in that file:

1. the base image has the `latest` tag: use `ubuntu:24.04`,
2. a secret is in `ENV`, so it stays in the image and in `docker history`: remove the line with `API_TOKEN`,
3. the container runs as `root`: add a user `app` (`useradd -r app`) and end with `USER app`.

<!-- verify
d=/root/app/Dockerfile
grep -q '^FROM ubuntu:24.04' $d || { echo "FROM is not ubuntu:24.04"; exit 1; }
grep -q 'API_TOKEN' $d && { echo "API_TOKEN is still in the Dockerfile"; exit 1; }
[ "$(grep '^USER' $d | tail -1 | awk '{print $2}')" = "app" ] || { echo "the last USER is not app"; exit 1; }
grep -q 'useradd.*app' $d || { echo "the user app is not created"; exit 1; }
-->
<!-- hint
`trivy config /root/app/` reports some of these findings (e.g. root user, `latest` tag). Secrets in an image are better found with `trivy image --scanners secret` on the built image.
-->
<!-- solution
sed -i 's/^FROM ubuntu:latest/FROM ubuntu:24.04/; /API_TOKEN/d; s/^USER root/RUN useradd -r app\nUSER app/' /root/app/Dockerfile
-->
