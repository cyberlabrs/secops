# Lab 1: Helm: install, upgrade and rollback

You will install Traefik (an ingress and Gateway API controller) from a Helm chart, change its configuration with `upgrade` and return to the previous revision with `rollback`.

The lab has no internet, so the chart has already been downloaded: `/opt/kurs/charts/traefik-41.7.1.tgz`. On the exam you would instead add the repository (`helm repo add`) and install `repo/chart`. The other commands are the same.

```bash
helm show chart /opt/kurs/charts/traefik-41.7.1.tgz
helm show values /opt/kurs/charts/traefik-41.7.1.tgz | less
```

Traefik's Gateway provider requires the **Gateway API CRDs**. In this lab they are already installed from `/opt/kurs/manifests/gateway-api-standard.yaml`. Without them the installation fails with `no matches for kind "Gateway"`.

<!-- setup
set -e
cluster-up
kubectl apply -f /opt/kurs/manifests/gateway-api-standard.yaml >/dev/null
-->

## Installation

Install the chart as release `traefik` into namespace `ingress` (create it during installation), with these values:

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
helm status traefik -n ingress >/dev/null 2>&1 || { echo "release traefik does not exist in namespace ingress"; exit 1; }
[ "$(helm get values traefik -n ingress -o json | jq -r '.deployment.replicas')" = "2" ] || { echo "deployment.replicas is not 2"; exit 1; }
[ "$(kubectl -n ingress get svc traefik -o jsonpath='{.spec.type}')" = "NodePort" ] || { echo "Service traefik is not NodePort"; exit 1; }
kubectl get gatewayclass traefik >/dev/null 2>&1 || { echo "GatewayClass traefik does not exist (the Gateway provider is not enabled)"; exit 1; }
[ "$(kubectl -n ingress get deploy traefik -o jsonpath='{.status.readyReplicas}')" = "2" ] || { echo "traefik does not have 2 ready replicas"; exit 1; }
-->
<!-- hint
Multiple values: repeat `--set` or separate them with commas. The key for the service type in this chart is `service.spec.type` (see `helm show values`). If you made a mistake, use `helm upgrade` with the same flags or `helm uninstall traefik -n ingress`.
-->
<!-- solution
helm install traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress --create-namespace --set deployment.replicas=2 --set providers.kubernetesGateway.enabled=true --set service.spec.type=NodePort --wait --timeout 3m >/dev/null
-->

## Upgrade with a values file

Create `/root/traefik-values.yaml` with all the values used so far and add:

- `deployment.replicas: 3`
- `log.level: DEBUG`

Run `helm upgrade` with that file. The release must have revision 2.

```bash
helm get values traefik -n ingress -o yaml > /root/traefik-values.yaml
vim /root/traefik-values.yaml
helm upgrade traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml
helm history traefik -n ingress
```

<!-- verify
[ "$(helm history traefik -n ingress -o json | jq 'length')" -ge 2 ] || { echo "the release does not have a second revision yet"; exit 1; }
v=$(helm get values traefik -n ingress -o json)
[ "$(echo "$v" | jq -r '.deployment.replicas')" = "3" ] || { echo "deployment.replicas is not 3"; exit 1; }
[ "$(echo "$v" | jq -r '.log.level')" = "DEBUG" ] || { echo "log.level is not DEBUG"; exit 1; }
[ "$(echo "$v" | jq -r '.service.spec.type')" = "NodePort" ] || { echo "the upgrade lost service.spec.type=NodePort: the values file must contain all values"; exit 1; }
kubectl -n ingress get deploy traefik -o jsonpath='{.spec.template.spec.containers[0].args}' | grep -q 'log.level=DEBUG' || { echo "Traefik is not running with DEBUG logs"; exit 1; }
-->
<!-- hint
`helm upgrade` without `--reuse-values` starts from the chart's default values and applies only what you give it. That is why the values file must also contain the old settings (`helm get values` prints them).
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

The DEBUG logs are filling up the disk. Roll the release back to **revision 1** and check the history: a rollback creates a new revision with the configuration of revision 1.

```bash
helm rollback traefik 1 -n ingress
helm history traefik -n ingress
```

<!-- verify
h=$(helm history traefik -n ingress -o json)
[ "$(echo "$h" | jq -r '.[-1].description')" = "Rollback to 1" ] || { echo "the last revision is not 'Rollback to 1'"; exit 1; }
[ "$(helm get values traefik -n ingress -o json | jq -r '.deployment.replicas')" = "2" ] || { echo "replicas was not restored to 2"; exit 1; }
-->
<!-- solution
helm rollback traefik 1 -n ingress --wait >/dev/null
-->

## helm template

Sometimes you need to see the manifests without installing, for example for review or GitOps. Render the chart with the values from `/root/traefik-values.yaml` into the file `/root/traefik-rendered.yaml`, for release `traefik` and namespace `ingress`.

<!-- verify
[ -s /root/traefik-rendered.yaml ] || { echo "/root/traefik-rendered.yaml does not exist"; exit 1; }
grep -q '^kind: Deployment' /root/traefik-rendered.yaml || { echo "the file does not contain a Deployment"; exit 1; }
grep -q 'log.level=DEBUG' /root/traefik-rendered.yaml || { echo "the render did not use /root/traefik-values.yaml"; exit 1; }
grep -q 'namespace: ingress' /root/traefik-rendered.yaml || { echo "the render is not for namespace ingress"; exit 1; }
-->
<!-- hint
`helm template traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml > /root/traefik-rendered.yaml`
-->
<!-- solution
helm template traefik /opt/kurs/charts/traefik-41.7.1.tgz -n ingress -f /root/traefik-values.yaml > /root/traefik-rendered.yaml
-->
