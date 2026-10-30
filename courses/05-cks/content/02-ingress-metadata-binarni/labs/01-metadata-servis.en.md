# Lab 1: Protecting the metadata service

In the cloud, every VM has a **metadata service** at `169.254.169.254`. Among other things, it hands out temporary credentials for the node's IAM role. A Pod that can reach that address can steal the credentials and take over the node's permissions. It is the classic attack from a container into the cloud account.

The lab simulates a metadata service on both nodes (address `169.254.169.254`, port 80). The Pod `webapp` in the `shop` namespace is vulnerable to SSRF.

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

## Proof of the attack

From the Pod `webapp`, read the credentials from the metadata service and write the `AccessKeyId` to `/root/ukradeni-kljuc.txt`. You do this to show the team that the problem is real.

<!-- verify
grep -qx 'ASIAKURSLAB0EXAMPLE' <(tr -d ' \n' < /root/ukradeni-kljuc.txt 2>/dev/null; echo) || { echo "ukradeni-kljuc.txt does not contain the AccessKeyId"; exit 1; }
-->
<!-- solution
kubectl -n shop exec webapp -- wget -qO- http://169.254.169.254/latest/meta-data/iam/security-credentials/node-role | sed 's/.*"AccessKeyId":"\([^"]*\)".*/\1/' > /root/ukradeni-kljuc.txt
-->

## Block the metadata address

In the `shop` namespace, create a NetworkPolicy `deny-metadata` that allows all Pods egress **everywhere except** `169.254.169.254/32` (`ipBlock` with `except`).

After that, `webapp` must still reach the Service `api` and DNS, but not the metadata service.

<!-- verify
kubectl -n shop get netpol deny-metadata >/dev/null 2>&1 || { echo "NetworkPolicy deny-metadata does not exist"; exit 1; }
kubectl -n shop exec webapp -- wget -qO- -T2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1 && { echo "webapp still reaches the metadata service"; exit 1; }
kubectl -n shop exec webapp -- wget -qO- -T2 http://api >/dev/null 2>&1 || { echo "webapp no longer reaches api (DNS or Service)"; exit 1; }
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
The policy allows everything else, so DNS and Services keep working.
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

## An exception for the agent

The monitoring agent `metadata-agent` (label `role=metadata-agent`) legitimately reads the metadata service. Create it in `shop` (`busybox:1.37`, `sleep 36000`) and create a NetworkPolicy `allow-metadata-agent` that allows egress to `169.254.169.254/32`, port 80, **for it only**. `webapp` must still be denied.

<!-- verify
kubectl -n shop wait --for=condition=Ready pod -l role=metadata-agent --timeout=5s >/dev/null 2>&1 || { echo "the Pod with role=metadata-agent is not running"; exit 1; }
p=$(kubectl -n shop get pod -l role=metadata-agent -o jsonpath='{.items[0].metadata.name}')
kubectl -n shop exec $p -- wget -qO- -T2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1 || { echo "metadata-agent cannot reach the metadata service"; exit 1; }
kubectl -n shop exec webapp -- wget -qO- -T2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1 && { echo "webapp reaches the metadata service again"; exit 1; }
exit 0
-->
<!-- hint
NetworkPolicies are additive: an allow from the new policy applies on top of the existing ones. In `allow-metadata-agent` use `podSelector: {matchLabels: {role: metadata-agent}}` and egress `ipBlock: {cidr: 169.254.169.254/32}` with port 80.
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
