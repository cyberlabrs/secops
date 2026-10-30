# Lab 2: ConfigMap, Secret i init container

Deployment `billing` u namespaceu `finance` ne može da se pokrene. Prije glavnog kontejnera radi **init container** koji provjerava da konfiguracija i kredencijali postoje, a ti resursi nedostaju.

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

## Dijagnoza

Pod visi u `Init:…` ili `ContainerCreating`. U `/root/nedostaje.txt` upiši imena **dva** resursa koja nedostaju, svaki u svom redu.

<!-- verify
f=/root/nedostaje.txt
grep -qx 'billing-db' $f 2>/dev/null && grep -qx 'billing-config' $f || { echo "nedostaje.txt treba sadržati billing-db i billing-config (svaki u svom redu)"; exit 1; }
-->
<!-- hint
`kubectl -n finance describe pod -l app=billing`: u `Events` traži `FailedMount` (`configmap "…" not found`), a za Secret poruku `secret "…" not found` (`CreateContainerConfigError`).
-->
<!-- solution
printf 'billing-db\nbilling-config\n' > /root/nedostaje.txt
-->

## Secret i ConfigMap

Napravi u namespaceu `finance`:

1. Secret `billing-db` (tip `generic`) sa ključevima `username=billing` i `password=S1gurn0!`,
2. ConfigMap `billing-config` sa ključem `app.properties` čiji je sadržaj fajl `/root/app.properties`. Fajl napravi sam, sa dva reda:

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
[ "$(kubectl -n finance get secret billing-db -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)" = 'S1gurn0!' ] || { echo "Secret billing-db nema password=S1gurn0!"; exit 1; }
[ "$(kubectl -n finance get secret billing-db -o jsonpath='{.data.username}' | base64 -d)" = "billing" ] || { echo "Secret billing-db nema username=billing"; exit 1; }
kubectl -n finance get cm billing-config -o jsonpath='{.data.app\.properties}' 2>/dev/null | grep -q '^pdv=17' || { echo "ConfigMap billing-config nema ključ app.properties sa pdv=17"; exit 1; }
[ "$(kubectl -n finance get deploy billing -o jsonpath='{.status.readyReplicas}')" = "1" ] || { echo "billing još nije spreman"; exit 1; }
-->
<!-- hint
Ako si Secret napravio sa greškom, obriši ga i napravi ponovo: `kubectl -n finance delete secret billing-db`. Pod koji je već u `CreateContainerConfigError` kubelet sam ponovo pokuša. Ako dugo stoji, `kubectl -n finance rollout restart deploy billing`.
-->
<!-- solution
printf 'valuta=EUR\npdv=17\n' > /root/app.properties
kubectl -n finance create secret generic billing-db --from-literal=username=billing --from-literal='password=S1gurn0!'
kubectl -n finance create configmap billing-config --from-file=app.properties=/root/app.properties
kubectl -n finance rollout restart deploy billing
kubectl -n finance rollout status deploy billing --timeout=180s
-->

## Konfiguracija kao env i promjena bez restarta

Aplikacija treba dobiti i varijablu okruženja `VALUTA` iz ConfigMapa `billing-env` (ključ `valuta`, vrijednost `EUR`). Napravi ConfigMap i dodaj varijablu u kontejner `app` (`configMapKeyRef`).

Zatim promijeni `pdv` u `billing-config` na `20`. Fajl montiran iz ConfigMapa se ažurira u Podu bez restarta (za oko minut), dok varijable okruženja zahtijevaju novi Pod. Sačekaj da Pod vidi `pdv=20` u `/config/app.properties`.

<!-- verify
p=$(kubectl -n finance get pod -l app=billing --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
[ -n "$p" ] || { echo "nema Running poda"; exit 1; }
kubectl -n finance exec "$p" -c app -- printenv VALUTA 2>/dev/null | grep -qx EUR || { echo "kontejner app nema VALUTA=EUR"; exit 1; }
kubectl -n finance exec "$p" -c app -- cat /config/app.properties 2>/dev/null | grep -qx 'pdv=20' || { echo "Pod još ne vidi pdv=20 (ažuriranje montiranog ConfigMapa traje do ~1 min)"; exit 1; }
-->
<!-- hint
`kubectl -n finance create cm billing-env --from-literal=valuta=EUR`, pa u `kubectl -n finance edit deploy billing` kontejneru `app` dodaj u `env`:
```yaml
- name: VALUTA
  valueFrom:
    configMapKeyRef: {name: billing-env, key: valuta}
``` Za pdv: `kubectl -n finance edit cm billing-config`.
-->
<!-- solution
kubectl -n finance create cm billing-env --from-literal=valuta=EUR
kubectl -n finance patch deploy billing --type=json -p='[{"op":"add","path":"/spec/template/spec/containers/0/env/-","value":{"name":"VALUTA","valueFrom":{"configMapKeyRef":{"name":"billing-env","key":"valuta"}}}}]'
kubectl -n finance rollout status deploy billing --timeout=180s
kubectl -n finance create cm billing-config --from-literal=app.properties="$(printf 'valuta=EUR\npdv=20')" --dry-run=client -o yaml | kubectl apply -f -
for i in $(seq 60); do p=$(kubectl -n finance get pod -l app=billing --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}'); kubectl -n finance exec "$p" -c app -- cat /config/app.properties 2>/dev/null | grep -qx 'pdv=20' && break; sleep 3; done
-->
