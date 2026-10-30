# Lab 1: Ingress with paths and TLS

Traefik runs in the cluster as the Ingress controller (IngressClass `traefik`), exposed on the nodes via NodePort: HTTP `30080`, HTTPS `30443`. Two applications run in the namespace `shop`: `web` (nginx) and `api` (httpd).

You will create an Ingress that publishes them under a single host name, and then add HTTPS to it.

```bash
kubectl get ingressclass
kubectl -n shop get deploy,svc
curl -s http://node01:30080/
```

<!-- setup
set -e
cluster-up
helm install traefik /opt/kurs/charts/traefik-41.7.1.tgz -n traefik --create-namespace \
  --set service.spec.type=NodePort --set ports.web.nodePort=30080 --set ports.websecure.nodePort=30443 \
  --set ingressClass.isDefaultClass=false --wait --timeout 4m >/dev/null
kubectl create ns shop >/dev/null
kubectl -n shop create deploy web --image=nginx:1.28 >/dev/null
kubectl -n shop expose deploy web --port=80 >/dev/null
kubectl -n shop create deploy api --image=httpd:alpine >/dev/null
kubectl -n shop expose deploy api --port=8080 --target-port=80 >/dev/null
kubectl -n shop rollout status deploy/web --timeout=120s >/dev/null
kubectl -n shop rollout status deploy/api --timeout=120s >/dev/null
-->

## Ingress with two paths

In the namespace `shop`, create an Ingress `shop` with `ingressClassName: traefik` for the host `shop.kurs.local`:

- the path `/` (`Prefix`) goes to the Service `web`, port 80,
- the path `/api` (`Prefix`) goes to the Service `api`, port **8080**.

```bash
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.kurs.local/*=web:80" --rule="shop.kurs.local/api*=api:8080"
curl -s -H 'Host: shop.kurs.local' http://node01:30080/
curl -s -H 'Host: shop.kurs.local' http://node01:30080/api
```

<!-- verify
i=$(kubectl -n shop get ingress shop -o json 2>/dev/null) || { echo "Ingress shop does not exist"; exit 1; }
[ "$(echo "$i" | jq -r '.spec.ingressClassName')" = "traefik" ] || { echo "ingressClassName is not traefik"; exit 1; }
curl -s -m 3 -H 'Host: shop.kurs.local' http://node01:30080/ | grep -qi nginx || { echo "/ does not lead to web (nginx)"; exit 1; }
curl -s -m 3 -I -H 'Host: shop.kurs.local' http://node01:30080/api | grep -qi '^server: apache' || { echo "/api does not lead to api (httpd)"; exit 1; }
[ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' -H 'Host: drugi.local' http://node01:30080/)" = "404" ] || { echo "another host must not get the application"; exit 1; }
-->
The response for `/api` is `404 Not Found`, but it is returned by **httpd** (`curl -I` shows `Server: Apache`). Ingress does not strip the path prefix, so the application receives `/api` and has no such page. Prefix stripping is a controller feature (in Traefik the `stripPrefix` middleware), and in the Gateway API the `URLRewrite` filter.

<!-- hint
In `kubectl create ingress` an asterisk at the end of the path (`/api*`) means `pathType: Prefix`, and without it `Exact`. The port of the Service `api` is 8080 (targetPort 80). An Ingress points to the **Service port**, not the container port.
-->
<!-- solution
kubectl -n shop create ingress shop --class=traefik --rule="shop.kurs.local/*=web:80" --rule="shop.kurs.local/api*=api:8080"
sleep 4
-->

## TLS

Create a self-signed certificate for `shop.kurs.local`, store it in a TLS Secret `shop-tls` (namespace `shop`) and add it to the Ingress (`spec.tls`). HTTPS on port 30443 must return the application with that certificate.

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout shop.key -out shop.crt -subj "/CN=shop.kurs.local" -addext "subjectAltName=DNS:shop.kurs.local"
kubectl -n shop create secret tls shop-tls --cert=shop.crt --key=shop.key
kubectl -n shop edit ingress shop
curl -sk --resolve shop.kurs.local:30443:$(getent hosts node01 | awk '{print $1}') https://shop.kurs.local:30443/ -v 2>&1 | grep subject
```

<!-- verify
[ "$(kubectl -n shop get secret shop-tls -o jsonpath='{.type}' 2>/dev/null)" = "kubernetes.io/tls" ] || { echo "Secret shop-tls of type kubernetes.io/tls does not exist"; exit 1; }
[ "$(kubectl -n shop get ingress shop -o jsonpath='{.spec.tls[0].secretName}')" = "shop-tls" ] || { echo "Ingress has no tls with secretName shop-tls"; exit 1; }
kubectl -n shop get ingress shop -o jsonpath='{.spec.tls[0].hosts}' | grep -q shop.kurs.local || { echo "tls.hosts does not contain shop.kurs.local"; exit 1; }
ip=$(getent hosts node01 | awk '{print $1}')
sub=$(echo | timeout 5 openssl s_client -connect $ip:30443 -servername shop.kurs.local 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)
echo "$sub" | grep -q 'shop.kurs.local' || { echo "HTTPS does not serve a certificate for shop.kurs.local (got: ${sub:-nothing})"; exit 1; }
curl -sk -m 3 --resolve shop.kurs.local:30443:$ip https://shop.kurs.local:30443/ | grep -qi nginx || { echo "HTTPS does not return the application"; exit 1; }
-->
<!-- hint
```yaml
spec:
  tls:
  - hosts: [shop.kurs.local]
    secretName: shop-tls
```
-->
<!-- solution
cd /root
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout shop.key -out shop.crt -subj "/CN=shop.kurs.local" -addext "subjectAltName=DNS:shop.kurs.local" 2>/dev/null
kubectl -n shop create secret tls shop-tls --cert=shop.crt --key=shop.key
kubectl -n shop patch ingress shop --type=merge -p '{"spec":{"tls":[{"hosts":["shop.kurs.local"],"secretName":"shop-tls"}]}}'
sleep 5
-->
