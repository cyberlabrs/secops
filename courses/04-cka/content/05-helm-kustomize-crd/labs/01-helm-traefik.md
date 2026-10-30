# Lab 1: Helm: instalacija, upgrade i rollback

Instaliraćeš Traefik (ingress i Gateway API kontroler) iz Helm charta, promijeniti mu konfiguraciju kroz `upgrade` i vratiti prethodnu reviziju sa `rollback`.

Lab nema internet, pa je chart već preuzet: `/opt/kurs/charts/traefik-41.7.1.tgz`. Na ispitu bi umjesto toga dodao repozitorij (`helm repo add`) i instalirao `repo/chart`. Ostale komande su iste.

```bash
helm show chart /opt/kurs/charts/traefik-41.7.1.tgz
helm show values /opt/kurs/charts/traefik-41.7.1.tgz | less
```

Gateway provider Traefika traži **Gateway API CRD-ove**. U ovom labu su već instalirani iz `/opt/kurs/manifests/gateway-api-standard.yaml`. Bez njih instalacija pada sa `no matches for kind "Gateway"`.

<!-- setup
set -e
cluster-up
kubectl apply -f /opt/kurs/manifests/gateway-api-standard.yaml >/dev/null
-->

## Instalacija

Instaliraj chart kao release `traefik` u namespace `ingress` (napravi ga pri instalaciji), sa ovim vrijednostima:

- `deployment.replicas=2`
- `providers.kubernetesGateway.enabled=true`
- `service.spec.type=NodePort`

```bash
helm install traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress --create-namespace \
  --set deployment.replicas=2 ...
helm list -n ingress
kubectl -n ingress get deploy,svc
```

<!-- verify
helm status traefik -n ingress >/dev/null 2>&1 || { echo "release traefik u namespaceu ingress ne postoji"; exit 1; }
[ "$(helm get values traefik -n ingress -o json | jq -r '.deployment.replicas')" = "2" ] || { echo "deployment.replicas nije 2"; exit 1; }
[ "$(kubectl -n ingress get svc traefik -o jsonpath='{.spec.type}')" = "NodePort" ] || { echo "Service traefik nije NodePort"; exit 1; }
kubectl get gatewayclass traefik >/dev/null 2>&1 || { echo "GatewayClass traefik ne postoji (Gateway provider nije uključen)"; exit 1; }
[ "$(kubectl -n ingress get deploy traefik -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "traefik nema 2 spremne replike"; exit 1; }
-->
<!-- hint
Više vrijednosti: ponovi `--set` ili ih razdvoji zarezom. Ključ za tip servisa u ovom chartu je `service.spec.type` (vidi `helm show values`). Ako si pogriješio, `helm upgrade` sa istim flagovima ili `helm uninstall traefik -n ingress`.
-->
<!-- solution
helm install traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress --create-namespace --set deployment.replicas=2 --set providers.kubernetesGateway.enabled=true --set service.spec.type=NodePort --wait --timeout 3m >/dev/null
-->

## Upgrade sa values fajlom

Napravi `/root/traefik-values.yaml` sa svim dosadašnjim vrijednostima i dodaj:

- `deployment.replicas: 3`
- `log.level: DEBUG`

Uradi `helm upgrade` sa tim fajlom. Release mora imati reviziju 2.

```bash
helm get values traefik -n ingress -o yaml > /root/traefik-values.yaml
vim /root/traefik-values.yaml
helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml
helm history traefik -n ingress
```

<!-- verify
[ "$(helm history traefik -n ingress -o json | jq 'length')" -ge 2 ] || { echo "release još nema drugu reviziju"; exit 1; }
v=$(helm get values traefik -n ingress -o json)
[ "$(echo "$v" | jq -r '.deployment.replicas')" = "3" ] || { echo "deployment.replicas nije 3"; exit 1; }
[ "$(echo "$v" | jq -r '.log.level')" = "DEBUG" ] || { echo "log.level nije DEBUG"; exit 1; }
[ "$(echo "$v" | jq -r '.service.spec.type')" = "NodePort" ] || { echo "upgrade je izgubio service.spec.type=NodePort: values fajl mora sadržati sve vrijednosti"; exit 1; }
kubectl -n ingress get deploy traefik -o jsonpath='{.spec.template.spec.containers[0].args}' | grep -q 'log.level=DEBUG' || { echo "Traefik ne radi sa DEBUG logovima"; exit 1; }
-->
<!-- hint
`helm upgrade` bez `--reuse-values` počinje od podrazumijevanih vrijednosti charta i primjenjuje samo ono što mu daš. Zato values fajl mora sadržati i stare postavke (`helm get values` ih ispisuje).
-->
<!-- solution
cat > /root/traefik-values.yaml <<'EOF'
deployment:
  replicas: 3
providers:
  kubernetesGateway:
    enabled: true
service:
  spec:
    type: NodePort
log:
  level: DEBUG
EOF
helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml --wait --timeout 3m >/dev/null
-->

## Rollback

DEBUG logovi pune disk. Vrati release na **reviziju 1** i provjeri istoriju: rollback pravi novu reviziju sa konfiguracijom revizije 1.

```bash
helm rollback traefik 1 -n ingress
helm history traefik -n ingress
```

<!-- verify
h=$(helm history traefik -n ingress -o json)
[ "$(echo "$h" | jq -r '.[-1].description')" = "Rollback to 1" ] || { echo "posljednja revizija nije 'Rollback to 1'"; exit 1; }
[ "$(helm get values traefik -n ingress -o json | jq -r '.deployment.replicas')" = "2" ] || { echo "replicas nije vraćen na 2"; exit 1; }
-->
<!-- solution
helm rollback traefik 1 -n ingress --wait >/dev/null
-->

## helm template

Ponekad treba vidjeti manifeste bez instalacije, na primjer za pregled ili GitOps. Renderuj chart sa vrijednostima iz `/root/traefik-values.yaml` u fajl `/root/traefik-rendered.yaml`, za release `traefik` i namespace `ingress`.

<!-- verify
[ -s /root/traefik-rendered.yaml ] || { echo "/root/traefik-rendered.yaml ne postoji"; exit 1; }
grep -q '^kind: Deployment' /root/traefik-rendered.yaml || { echo "fajl ne sadrži Deployment"; exit 1; }
grep -q 'log.level=DEBUG' /root/traefik-rendered.yaml || { echo "render nije koristio /root/traefik-values.yaml"; exit 1; }
grep -q 'namespace: ingress' /root/traefik-rendered.yaml || { echo "render nije za namespace ingress"; exit 1; }
-->
<!-- hint
`helm template traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml > /root/traefik-rendered.yaml`
-->
<!-- solution
helm template traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml > /root/traefik-rendered.yaml
-->
