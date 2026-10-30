# Lab 1: Zaštita metadata servisa

U cloudu svaka VM ima **metadata servis** na `169.254.169.254`. Između ostalog, on izdaje privremene kredencijale IAM role čvora. Pod koji može doći do te adrese može ukrasti kredencijale i preuzeti dozvole čvora. To je klasičan napad iz kontejnera u cloud nalog.

Lab simulira metadata servis na oba čvora (adresa `169.254.169.254`, port 80). Pod `webapp` u namespaceu `shop` je ranjiv na SSRF.

```bash
kubectl -n shop exec webapp -- wget -qO- http://169.254.169.254/latest/meta-data/iam/security-credentials/node-role
```

<!-- setup
set -e
cluster-up
cat > /root/.imds-handler <<'EOF'
#!/bin/bash
# lažni cloud metadata servis (samo za lab)
read -r m p v
p=${p%%\?*}
f=/opt/imds$p; [ -d "$f" ] && f=$f/index.html
if [ -f "$f" ]; then printf 'HTTP/1.0 200 OK\r\nContent-Type: text/plain\r\n\r\n'; cat "$f"; else printf 'HTTP/1.0 404 Not Found\r\n\r\n'; fi
EOF
for n in controlplane node01; do
  scp -q /root/.imds-handler $n:/usr/local/sbin/imds-handler
  ssh $n 'chmod +x /usr/local/sbin/imds-handler; ip addr add 169.254.169.254/32 dev lo 2>/dev/null; d=/opt/imds/latest/meta-data/iam/security-credentials; mkdir -p $d
    printf "{\"AccessKeyId\":\"ASIAKURSLAB0EXAMPLE\",\"SecretAccessKey\":\"lab/K7MDENG/bPxRfiCYEXAMPLEKEY\",\"Token\":\"IQoJb3JpZ2luX2VjEXAMPLE\"}\n" > $d/node-role
    echo node-role > $d/index.html; printf "ami-id\niam/\ninstance-id\n" > /opt/imds/latest/meta-data/index.html
    systemd-run --unit=fake-imds --quiet socat TCP-LISTEN:80,bind=169.254.169.254,fork,reuseaddr EXEC:/usr/local/sbin/imds-handler'
done
rm -f /root/.imds-handler
kubectl create ns shop >/dev/null
kubectl -n shop run webapp --image=busybox:1.37 -l app=webapp -- sleep 36000 >/dev/null
kubectl -n shop run api --image=nginx:1.28 -l app=api --port=80 >/dev/null
kubectl -n shop expose pod api --port=80 >/dev/null
kubectl -n shop wait --for=condition=Ready pod --all --timeout=120s >/dev/null
-->

## Dokaz napada

Iz Poda `webapp` pročitaj kredencijale sa metadata servisa i upiši `AccessKeyId` u `/root/ukradeni-kljuc.txt`. Ovo radiš da bi pokazao timu da je problem stvaran.

<!-- verify
grep -qx 'ASIAKURSLAB0EXAMPLE' <(tr -d ' \n' < /root/ukradeni-kljuc.txt 2>/dev/null; echo) || { echo "ukradeni-kljuc.txt ne sadrži AccessKeyId"; exit 1; }
-->
<!-- solution
kubectl -n shop exec webapp -- wget -qO- http://169.254.169.254/latest/meta-data/iam/security-credentials/node-role | sed 's/.*"AccessKeyId":"\([^"]*\)".*/\1/' > /root/ukradeni-kljuc.txt
-->

## Blokiraj metadata adresu

U namespaceu `shop` napravi NetworkPolicy `deny-metadata` koja svim Podovima dozvoljava izlaz **svuda osim** na `169.254.169.254/32` (`ipBlock` sa `except`).

Poslije toga `webapp` i dalje mora doći do Servisa `api` i do DNS-a, ali ne i do metadata servisa.

<!-- verify
kubectl -n shop get netpol deny-metadata >/dev/null 2>&1 || { echo "NetworkPolicy deny-metadata ne postoji"; exit 1; }
kubectl -n shop exec webapp -- wget -qO- -T2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1 && { echo "webapp i dalje dolazi do metadata servisa"; exit 1; }
kubectl -n shop exec webapp -- wget -qO- -T2 http://api >/dev/null 2>&1 || { echo "webapp više ne dolazi do api (DNS ili Servis)"; exit 1; }
exit 0
-->
<!-- hint
```yaml
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except: [169.254.169.254/32]
```
Politika dozvoljava sve ostalo, pa DNS i Servisi rade dalje.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: deny-metadata, namespace: shop}
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except: [169.254.169.254/32]
EOF
sleep 3
-->

## Izuzetak za agent

Monitoring agent `metadata-agent` (oznaka `role=metadata-agent`) legitimno čita metadata servis. Napravi ga u `shop` (`busybox:1.37`, `sleep 36000`) i napravi NetworkPolicy `allow-metadata-agent` koja **samo njemu** dozvoljava izlaz na `169.254.169.254/32`, port 80. `webapp` i dalje ne smije.

<!-- verify
kubectl -n shop wait --for=condition=Ready pod -l role=metadata-agent --timeout=5s >/dev/null 2>&1 || { echo "Pod sa role=metadata-agent ne radi"; exit 1; }
p=$(kubectl -n shop get pod -l role=metadata-agent -o jsonpath='{.items[0].metadata.name}')
kubectl -n shop exec $p -- wget -qO- -T2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1 || { echo "metadata-agent ne dolazi do metadata servisa"; exit 1; }
kubectl -n shop exec webapp -- wget -qO- -T2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1 && { echo "webapp opet dolazi do metadata servisa"; exit 1; }
exit 0
-->
<!-- hint
NetworkPolicy su aditivne: dozvola iz nove politike važi uz postojeće. U `allow-metadata-agent` stavi `podSelector: {matchLabels: {role: metadata-agent}}` i egress `ipBlock: {cidr: 169.254.169.254/32}` sa portom 80.
-->
<!-- solution
kubectl -n shop run metadata-agent --image=busybox:1.37 -l role=metadata-agent -- sleep 36000
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-metadata-agent, namespace: shop}
spec:
  podSelector: {matchLabels: {role: metadata-agent}}
  policyTypes: [Egress]
  egress:
  - to:
    - ipBlock: {cidr: 169.254.169.254/32}
    ports: [{port: 80, protocol: TCP}]
EOF
kubectl -n shop wait --for=condition=Ready pod/metadata-agent --timeout=120s
sleep 3
-->
