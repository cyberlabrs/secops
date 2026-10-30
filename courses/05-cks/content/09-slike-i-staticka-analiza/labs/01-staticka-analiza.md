# Lab 1: Statička analiza manifesta i Dockerfilea

Tim je pripremio manifest i Dockerfile za novu aplikaciju. Prije nego što išta ode u klaster, pregledaćeš ih alatima (**kubesec**, **kube-linter**, **trivy config**) i ručno, pa ih popraviti.

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

## Nalazi u manifestu

Pokreni `kubesec scan` i u `/root/kubesec-score.txt` upiši **score** koji kubesec daje originalnom manifestu (broj, može biti negativan).

<!-- verify
want=$(kubesec scan /root/app/deployment.yaml.orig 2>/dev/null | jq -r '.[0].score' 2>/dev/null)
[ -z "$want" ] && want=$(cp /root/app/deployment.yaml /tmp/d.yaml; kubesec scan /tmp/d.yaml | jq -r '.[0].score')
[ "$(tr -d ' \n' < /root/kubesec-score.txt 2>/dev/null)" = "$want" ] || { echo "kubesec-score.txt nije ispravan (score originalnog manifesta je drugi broj)"; exit 1; }
-->
<!-- hint
`kubesec scan /root/app/deployment.yaml | jq '.[0].score'`. Pogledaj i `.[0].scoring.critical`: zašto je score tako nizak?
-->
<!-- solution
kubesec scan /root/app/deployment.yaml | jq -r '.[0].score' > /root/kubesec-score.txt
cp /root/app/deployment.yaml /root/app/deployment.yaml.orig
-->

## Popravi manifest

Izmijeni `/root/app/deployment.yaml` (ne pravi novi fajl) tako da:

- nema `hostNetwork` ni `privileged`,
- radi kao non-root (`runAsNonRoot: true`, `runAsUser: 101`),
- ima `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` i `capabilities.drop: ["ALL"]`,
- image ima konkretan tag (`nginx:1.28-alpine`, ne `latest`),
- lozinka ne stoji u manifestu: `DB_PASSWORD` čita iz Secreta `shop-db` (ključ `password`),
- ima `resources.limits` za CPU i memoriju.

kubesec score mora biti **najmanje 7**, a `kube-linter lint` bez nalaza za `privileged-container`, `run-as-non-root`, `latest-tag`, `env-var-secret`, `no-read-only-root-fs` i `host-network`.

<!-- verify
f=/root/app/deployment.yaml
s=$(kubesec scan $f 2>/dev/null | jq -r '.[0].score')
[ -n "$s" ] && [ "$s" -ge 7 ] 2>/dev/null || { echo "kubesec score je $s (treba ≥ 7)"; exit 1; }
out=$(kube-linter lint $f 2>&1)
for c in privileged-container run-as-non-root latest-tag env-var-secret no-read-only-root-fs host-network; do echo "$out" | grep -q "($c)\|check: $c" && { echo "kube-linter i dalje prijavljuje $c"; exit 1; }; done
grep -q 'Ljeto2026' $f && { echo "lozinka je i dalje u manifestu"; exit 1; }
grep -q 'secretKeyRef' $f || { echo "DB_PASSWORD ne čita Secret"; exit 1; }
kubectl apply --dry-run=server -f $f >/dev/null 2>&1 || { echo "manifest nije validan (kubectl apply --dry-run=server)"; exit 1; }
-->
<!-- hint
Ključni dio:
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
Pokreni `kube-linter lint` ponovo poslije svake izmjene; neke provjere (npr. `unset-cpu-requirements`) nisu obavezne za ovaj korak.
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

## Ručna analiza Dockerfilea

U `/root/app/Dockerfile` su tri ozbiljna problema koje na ispitu treba prepoznati i bez alata. Popravi ih u tom fajlu:

1. bazna slika ima tag `latest`: koristi `ubuntu:24.04`,
2. tajna je u `ENV`, pa ostaje u slici i u `docker history`: ukloni red sa `API_TOKEN`,
3. kontejner radi kao `root`: dodaj korisnika `app` (`useradd -r app`) i završi sa `USER app`.

<!-- verify
d=/root/app/Dockerfile
grep -q '^FROM ubuntu:24.04' $d || { echo "FROM nije ubuntu:24.04"; exit 1; }
grep -q 'API_TOKEN' $d && { echo "API_TOKEN je i dalje u Dockerfileu"; exit 1; }
[ "$(grep '^USER' $d | tail -1 | awk '{print $2}')" = "app" ] || { echo "posljednji USER nije app"; exit 1; }
grep -q 'useradd.*app' $d || { echo "korisnik app se ne pravi"; exit 1; }
-->
<!-- hint
`trivy config /root/app/` prijavljuje dio ovih nalaza (npr. root korisnik, `latest` tag). Tajne u slici bolje traži sa `trivy image --scanners secret` nad gotovom slikom.
-->
<!-- solution
sed -i 's/^FROM ubuntu:latest/FROM ubuntu:24.04/; /API_TOKEN/d; s/^USER root/RUN useradd -r app\nUSER app/' /root/app/Dockerfile
-->
