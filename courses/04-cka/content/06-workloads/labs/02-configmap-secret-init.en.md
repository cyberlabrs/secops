# Lab 2: ConfigMap, Secret and an init container

Deployment `billing` in namespace `finance` cannot start. Before the main container, an **init container** (named `provjera`, "check") verifies that the configuration and credentials exist, and those resources are missing.

```bash
kubectl -n finance get pods
kubectl -n finance describe pod -l app=billing | tail -15
kubectl -n finance logs -l app=billing -c provjera
```

<!-- setup
set -e
cluster-up
kubectl create ns finance >/dev/null
cat <<'EOF' | kubectl apply -f - >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata:
  name: billing
  namespace: finance
spec:
  replicas: 1
  selector:
    matchLabels: {app: billing}
  template:
    metadata:
      labels: {app: billing}
    spec:
      initContainers:
      - name: provjera
        image: busybox:1.37
        command: ["sh", "-c", "test -n \"$DB_PASSWORD\" && test -f /config/app.properties && echo konfiguracija OK"]
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef: {name: billing-db, key: password}
        volumeMounts:
        - {name: config, mountPath: /config}
      containers:
      - name: app
        image: busybox:1.37
        command: ["sh", "-c", "echo start; cat /config/app.properties; sleep 3600"]
        env:
        - name: DB_USER
          valueFrom:
            secretKeyRef: {name: billing-db, key: username}
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef: {name: billing-db, key: password}
        volumeMounts:
        - {name: config, mountPath: /config}
      volumes:
      - name: config
        configMap:
          name: billing-config
EOF
-->

## Diagnosis

The Pod hangs in `Init:…` or `ContainerCreating`. Write the names of the **two** missing resources to `/root/nedostaje.txt` ("missing"), each on its own line.

<!-- verify
f=/root/nedostaje.txt
grep -qx 'billing-db' $f 2>/dev/null && grep -qx 'billing-config' $f || { echo "nedostaje.txt must contain billing-db and billing-config (each on its own line)"; exit 1; }
-->
<!-- hint
`kubectl -n finance describe pod -l app=billing`: in `Events` look for `FailedMount` (`configmap "…" not found`), and for the Secret the message `secret "…" not found` (`CreateContainerConfigError`).
-->
<!-- solution
printf 'billing-db\nbilling-config\n' > /root/nedostaje.txt
-->

## Secret and ConfigMap

Create in namespace `finance`:

1. a Secret `billing-db` (type `generic`) with the keys `username=billing` and `password=S1gurn0!`,
2. a ConfigMap `billing-config` with the key `app.properties` whose content is the file `/root/app.properties`. Create the file yourself, with two lines (`valuta` = currency, `pdv` = VAT; keep the keys exactly as shown):

```text
valuta=EUR
pdv=17
```

```bash
kubectl -n finance create secret generic billing-db --from-literal=username=billing --from-literal='password=S1gurn0!'
kubectl -n finance create configmap billing-config --from-file=app.properties=/root/app.properties
kubectl -n finance get pods -w
```

<!-- verify
[ "$(kubectl -n finance get secret billing-db -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)" = 'S1gurn0!' ] || { echo "Secret billing-db does not have password=S1gurn0!"; exit 1; }
[ "$(kubectl -n finance get secret billing-db -o jsonpath='{.data.username}' | base64 -d)" = "billing" ] || { echo "Secret billing-db does not have username=billing"; exit 1; }
kubectl -n finance get cm billing-config -o jsonpath='{.data.app\.properties}' 2>/dev/null | grep -q '^pdv=17' || { echo "ConfigMap billing-config does not have the key app.properties with pdv=17"; exit 1; }
[ "$(kubectl -n finance get deploy billing -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "billing is not ready yet"; exit 1; }
-->
<!-- hint
If you created the Secret with a mistake, delete it and create it again: `kubectl -n finance delete secret billing-db`. The kubelet retries a Pod that is already in `CreateContainerConfigError` on its own. If it stays stuck for long, `kubectl -n finance rollout restart deploy billing`.
-->
<!-- solution
printf 'valuta=EUR\npdv=17\n' > /root/app.properties
kubectl -n finance create secret generic billing-db --from-literal=username=billing --from-literal='password=S1gurn0!'
kubectl -n finance create configmap billing-config --from-file=app.properties=/root/app.properties
kubectl -n finance rollout restart deploy billing
kubectl -n finance rollout status deploy billing --timeout=180s
-->

## Configuration as env and a change without a restart

The application also needs the environment variable `VALUTA` from the ConfigMap `billing-env` (key `valuta`, value `EUR`). Create the ConfigMap and add the variable to the `app` container (`configMapKeyRef`).

Then change `pdv` in `billing-config` to `20`. A file mounted from a ConfigMap is updated in the Pod without a restart (in about a minute), while environment variables require a new Pod. Wait until the Pod sees `pdv=20` in `/config/app.properties`.

<!-- verify
p=$(kubectl -n finance get pod -l app=billing --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
[ -n "$p" ] || { echo "no Running pod"; exit 1; }
kubectl -n finance exec "$p" -c app -- printenv VALUTA 2>/dev/null | grep -qx EUR || { echo "the app container does not have VALUTA=EUR"; exit 1; }
kubectl -n finance exec "$p" -c app -- cat /config/app.properties 2>/dev/null | grep -qx 'pdv=20' || { echo "the Pod does not see pdv=20 yet (updating a mounted ConfigMap takes up to ~1 min)"; exit 1; }
-->
<!-- hint
`kubectl -n finance create cm billing-env --from-literal=valuta=EUR`, then in `kubectl -n finance edit deploy billing` add to the `env` of the `app` container:
```yaml
- name: VALUTA
  valueFrom:
    configMapKeyRef: {name: billing-env, key: valuta}
``` For pdv: `kubectl -n finance edit cm billing-config`.
-->
<!-- solution
kubectl -n finance create cm billing-env --from-literal=valuta=EUR
kubectl -n finance patch deploy billing --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/env/-","value":{"name":"VALUTA","valueFrom":{"configMapKeyRef":{"name":"billing-env","key":"valuta"}}}}]'
kubectl -n finance rollout status deploy billing --timeout=180s
kubectl -n finance create cm billing-config --from-literal=app.properties="$(printf 'valuta=EUR\npdv=20')" --dry-run=client -o yaml | kubectl apply -f -
for i in $(seq 60); do p=$(kubectl -n finance get pod -l app=billing --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}'); kubectl -n finance exec "$p" -c app -- cat /config/app.properties 2>/dev/null | grep -qx 'pdv=20' && break; sleep 3; done
-->
