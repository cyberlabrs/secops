# Lab 2: Secreti šifrovani u etcd-u

Secreti se u etcd-u podrazumijevano čuvaju **nešifrovano**: base64 je samo kodiranje. Ko dođe do etcd-a (backup, disk, etcd certifikati) dobija sve tajne klastera.

Uvjerićeš se u to direktnim čitanjem etcd-a, a zatim uključiti **encryption at rest** i ponovo šifrovati postojeće Secrete.

```bash
kubectl -n bank get secrets
```

<!-- setup
set -e
cluster-up
kubectl create ns bank >/dev/null
kubectl -n bank create secret generic db-credentials --from-literal=password=SuperTajna2026 >/dev/null
kubectl -n bank create secret generic api-key --from-literal=key=ak-live-1234 >/dev/null
cat > /root/etcdctl.sh <<'EOF'
#!/bin/bash
# etcdctl sa certifikatima kontrolne ravni
exec etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key "$@"
EOF
chmod +x /root/etcdctl.sh
-->

## Čitanje Secreta iz etcd-a

Pročitaj Secret `db-credentials` direktno iz etcd-a (ključ `/registry/secrets/bank/db-credentials`). U `/root/iz-etcd.txt` upiši lozinku koju vidiš u otvorenom tekstu.

```bash
/root/etcdctl.sh get /registry/secrets/bank/db-credentials | cat -v
```

<!-- verify
grep -qx 'SuperTajna2026' <(tr -d ' \n' < /root/iz-etcd.txt 2>/dev/null; echo) || { echo "iz-etcd.txt ne sadrži lozinku"; exit 1; }
-->
<!-- solution
/root/etcdctl.sh get /registry/secrets/bank/db-credentials | grep -a -o 'SuperTajna2026' | head -1 > /root/iz-etcd.txt
-->

## EncryptionConfiguration

Uključi šifrovanje Secreta:

1. Napravi `/etc/kubernetes/enc/enc.yaml` sa `EncryptionConfiguration` (`apiserver.config.k8s.io/v1`) za resurs `secrets`: prvi provider `aescbc` sa ključem `key1` (32 nasumična bajta u base64), drugi `identity: {}`, da se postojeći nešifrovani Secreti i dalje mogu čitati.
2. U manifest kube-apiservera dodaj `--encryption-provider-config=/etc/kubernetes/enc/enc.yaml` i hostPath volumen + volumeMount za `/etc/kubernetes/enc` (readOnly).
3. Sačekaj da API server ponovo proradi.

```bash
head -c 32 /dev/urandom | base64
```

<!-- verify
grep -q -- '--encryption-provider-config=/etc/kubernetes/enc/enc.yaml' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "flag --encryption-provider-config nije postavljen"; exit 1; }
grep -q 'aescbc' /etc/kubernetes/enc/enc.yaml 2>/dev/null || { echo "enc.yaml nema aescbc providera"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara"; exit 1; }
kubectl -n bank get secret db-credentials >/dev/null 2>&1 || { echo "postojeći Secret se ne može čitati (identity provider?)"; exit 1; }
kubectl -n bank create secret generic provjera-enc --from-literal=x=y --dry-run=client -o yaml | kubectl apply -f - >/dev/null
/root/etcdctl.sh get /registry/secrets/bank/provjera-enc | grep -aq 'k8s:enc:aescbc:v1:key1' || { echo "novi Secreti se ne šifruju (nema prefiksa k8s:enc:aescbc:v1:key1)"; exit 1; }
kubectl -n bank delete secret provjera-enc >/dev/null
-->
<!-- hint
```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: [secrets]
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64 od 32 bajta>
  - identity: {}
```
U manifestu:
```yaml
    - --encryption-provider-config=/etc/kubernetes/enc/enc.yaml
...
    volumeMounts:
    - {name: enc, mountPath: /etc/kubernetes/enc, readOnly: true}
...
  volumes:
  - {name: enc, hostPath: {path: /etc/kubernetes/enc, type: DirectoryOrCreate}}
```
Ako API server ne proradi: `crictl ps -a | grep apiserver` i `crictl logs <id>`.
-->
<!-- solution
mkdir -p /etc/kubernetes/enc
cat > /etc/kubernetes/enc/enc.yaml <<EOF
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: [secrets]
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: $(head -c 32 /dev/urandom | base64)
  - identity: {}
EOF
f=/etc/kubernetes/manifests/kube-apiserver.yaml
sed -i 's#^\(\s*\)- kube-apiserver$#\1- kube-apiserver\n\1- --encryption-provider-config=/etc/kubernetes/enc/enc.yaml#' $f
sed -i 's#^\(\s*\)volumeMounts:$#\1volumeMounts:\n\1- {name: enc, mountPath: /etc/kubernetes/enc, readOnly: true}#' $f
sed -i 's#^  volumes:$#  volumes:\n  - {name: enc, hostPath: {path: /etc/kubernetes/enc, type: DirectoryOrCreate}}#' $f
sleep 25
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s >/dev/null
-->

## Šifruj postojeće Secrete

Novi Secreti su sada šifrovani, ali `db-credentials` i `api-key` su u etcd-u i dalje u otvorenom tekstu. Prepiši **sve** Secrete u klasteru, tako da ih API server ponovo upiše šifrovane.

```bash
kubectl get secrets -A -o json | kubectl replace -f -
/root/etcdctl.sh get /registry/secrets/bank/db-credentials | head -c 120 | cat -v
```

<!-- verify
for s in db-credentials api-key; do
  /root/etcdctl.sh get /registry/secrets/bank/$s | grep -aq 'k8s:enc:aescbc:v1:' || { echo "$s u etcd-u nije šifrovan"; exit 1; }
  /root/etcdctl.sh get /registry/secrets/bank/$s | grep -aq 'SuperTajna2026\|ak-live-1234' && { echo "$s i dalje sadrži tajnu u otvorenom tekstu"; exit 1; }
done
[ "$(kubectl -n bank get secret db-credentials -o jsonpath='{.data.password}' | base64 -d)" = "SuperTajna2026" ] || { echo "Secret se više ne može pročitati kroz API"; exit 1; }
-->
<!-- solution
kubectl get secrets -A -o json | kubectl replace -f - >/dev/null
-->
