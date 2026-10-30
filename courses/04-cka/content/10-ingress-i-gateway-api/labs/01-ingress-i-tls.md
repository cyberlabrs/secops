# Lab 1: Ingress sa putanjama i TLS-om

U klasteru radi Traefik kao Ingress kontroler (IngressClass `traefik`), izložen na čvorovima preko NodePorta: HTTP `30080`, HTTPS `30443`. U namespaceu `shop` rade dvije aplikacije: `web` (nginx) i `api` (httpd).

Napravićeš Ingress koji ih objavljuje pod jednim imenom hosta, a zatim mu dodati HTTPS.

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

## Ingress sa dvije putanje

U namespaceu `shop` napravi Ingress `shop` sa `ingressClassName: traefik`, za host `shop.kurs.local`:

- putanja `/` (`Prefix`) ide na Servis `web`, port 80,
- putanja `/api` (`Prefix`) ide na Servis `api`, port **8080**.

```bash
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.kurs.local/*=web:80" --rule="shop.kurs.local/api*=api:8080"
curl -s -H 'Host: shop.kurs.local' http://node01:30080/
curl -s -H 'Host: shop.kurs.local' http://node01:30080/api
```

<!-- verify
i=$(kubectl -n shop get ingress shop -o json 2>/dev/null) || { echo "Ingress shop ne postoji"; exit 1; }
[ "$(echo "$i" | jq -r '.spec.ingressClassName')" = "traefik" ] || { echo "ingressClassName nije traefik"; exit 1; }
curl -s -m 3 -H 'Host: shop.kurs.local' http://node01:30080/ | grep -qi nginx || { echo "/ ne vodi na web (nginx)"; exit 1; }
curl -s -m 3 -I -H 'Host: shop.kurs.local' http://node01:30080/api | grep -qi '^server: apache' || { echo "/api ne vodi na api (httpd)"; exit 1; }
[ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' -H 'Host: drugi.local' http://node01:30080/)" = "404" ] || { echo "drugi host ne smije dobiti aplikaciju"; exit 1; }
-->
Odgovor za `/api` je `404 Not Found`, ali ga vraća **httpd** (`curl -I` pokazuje `Server: Apache`). Ingress ne skida prefiks putanje, pa aplikacija dobija `/api` i nema tu stranicu. Skidanje prefiksa je funkcija kontrolera (u Traefiku middleware `stripPrefix`), a u Gateway API-ju filter `URLRewrite`.

<!-- hint
U `kubectl create ingress` zvjezdica na kraju putanje (`/api*`) znači `pathType: Prefix`, a bez nje `Exact`. Port Servisa `api` je 8080 (targetPort 80). Ingress pokazuje na **port Servisa**, ne kontejnera.
-->
<!-- solution
kubectl -n shop create ingress shop --class=traefik --rule="shop.kurs.local/*=web:80" --rule="shop.kurs.local/api*=api:8080"
sleep 4
-->

## TLS

Napravi samopotpisani certifikat za `shop.kurs.local`, spremi ga u Secret tipa TLS `shop-tls` (namespace `shop`) i dodaj ga Ingressu (`spec.tls`). HTTPS na portu 30443 mora vraćati aplikaciju sa tim certifikatom.

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout shop.key -out shop.crt -subj "/CN=shop.kurs.local" -addext "subjectAltName=DNS:shop.kurs.local"
kubectl -n shop create secret tls shop-tls --cert=shop.crt --key=shop.key
kubectl -n shop edit ingress shop
curl -sk --resolve shop.kurs.local:30443:$(getent hosts node01 | awk '{print $1}') https://shop.kurs.local:30443/ -v 2>&1 | grep subject
```

<!-- verify
[ "$(kubectl -n shop get secret shop-tls -o jsonpath='{.type}' 2>/dev/null)" = "kubernetes.io/tls" ] || { echo "Secret shop-tls tipa kubernetes.io/tls ne postoji"; exit 1; }
[ "$(kubectl -n shop get ingress shop -o jsonpath='{.spec.tls[0].secretName}')" = "shop-tls" ] || { echo "Ingress nema tls sa secretName shop-tls"; exit 1; }
kubectl -n shop get ingress shop -o jsonpath='{.spec.tls[0].hosts}' | grep -q shop.kurs.local || { echo "tls.hosts ne sadrži shop.kurs.local"; exit 1; }
ip=$(getent hosts node01 | awk '{print $1}')
sub=$(echo | timeout 5 openssl s_client -connect $ip:30443 -servername shop.kurs.local 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)
echo "$sub" | grep -q 'shop.kurs.local' || { echo "HTTPS ne servira certifikat za shop.kurs.local (dobijeno: ${sub:-ništa})"; exit 1; }
curl -sk -m 3 --resolve shop.kurs.local:30443:$ip https://shop.kurs.local:30443/ | grep -qi nginx || { echo "HTTPS ne vraća aplikaciju"; exit 1; }
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
