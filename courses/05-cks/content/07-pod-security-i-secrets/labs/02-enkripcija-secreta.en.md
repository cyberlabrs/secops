# Lab 2: Secrets encrypted in etcd

By default, Secrets are stored in etcd **unencrypted**: base64 is just encoding. Whoever gets to etcd (a backup, the disk, the etcd certificates) gets all the cluster's secrets.

You will see this for yourself by reading etcd directly, then enable **encryption at rest** and re-encrypt the existing Secrets.

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

## Reading a Secret from etcd

Read the Secret `db-credentials` directly from etcd (key `/registry/secrets/bank/db-credentials`). Write the password you see in plain text to `/root/iz-etcd.txt`.

```bash
/root/etcdctl.sh get /registry/secrets/bank/db-credentials | cat -v
```

<!-- verify
grep -qx 'SuperTajna2026' <(tr -d ' \n' < /root/iz-etcd.txt 2>/dev/null; echo) || { echo "iz-etcd.txt does not contain the password"; exit 1; }
-->
<!-- solution
/root/etcdctl.sh get /registry/secrets/bank/db-credentials | grep -a -o 'SuperTajna2026' | head -1 > /root/iz-etcd.txt
-->

## EncryptionConfiguration

Enable encryption of Secrets:

1. Create `/etc/kubernetes/enc/enc.yaml` with an `EncryptionConfiguration` (`apiserver.config.k8s.io/v1`) for the `secrets` resource: the first provider `aescbc` with the key `key1` (32 random bytes in base64), the second `identity: {}`, so existing unencrypted Secrets can still be read.
2. In the kube-apiserver manifest, add `--encryption-provider-config=/etc/kubernetes/enc/enc.yaml` and a hostPath volume + volumeMount for `/etc/kubernetes/enc` (readOnly).
3. Wait for the API server to come back up.

```bash
head -c 32 /dev/urandom | base64
```

<!-- verify
grep -q -- '--encryption-provider-config=/etc/kubernetes/enc/enc.yaml' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "the --encryption-provider-config flag is not set"; exit 1; }
grep -q 'aescbc' /etc/kubernetes/enc/enc.yaml 2>/dev/null || { echo "enc.yaml has no aescbc provider"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "the API server is not responding"; exit 1; }
kubectl -n bank get secret db-credentials >/dev/null 2>&1 || { echo "the existing Secret cannot be read (identity provider?)"; exit 1; }
kubectl -n bank create secret generic provjera-enc --from-literal=x=y --dry-run=client -o yaml | kubectl apply -f - >/dev/null
/root/etcdctl.sh get /registry/secrets/bank/provjera-enc | grep -aq 'k8s:enc:aescbc:v1:key1' || { echo "new Secrets are not encrypted (no k8s:enc:aescbc:v1:key1 prefix)"; exit 1; }
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
        secret: <base64 of 32 bytes>
  - identity: {}
```
In the manifest:
```yaml
    - --encryption-provider-config=/etc/kubernetes/enc/enc.yaml
...
    volumeMounts:
    - {name: enc, mountPath: /etc/kubernetes/enc, readOnly: true}
...
  volumes:
  - {name: enc, hostPath: {path: /etc/kubernetes/enc, type: DirectoryOrCreate}}
```
If the API server doesn't come up: `crictl ps -a | grep apiserver` and `crictl logs <id>`.
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

## Encrypt the existing Secrets

New Secrets are now encrypted, but `db-credentials` and `api-key` are still in plain text in etcd. Rewrite **all** Secrets in the cluster so the API server writes them back encrypted.

```bash
kubectl get secrets -A -o json | kubectl replace -f -
/root/etcdctl.sh get /registry/secrets/bank/db-credentials | head -c 120 | cat -v
```

<!-- verify
for s in db-credentials api-key; do
  /root/etcdctl.sh get /registry/secrets/bank/$s | grep -aq 'k8s:enc:aescbc:v1:' || { echo "$s is not encrypted in etcd"; exit 1; }
  /root/etcdctl.sh get /registry/secrets/bank/$s | grep -aq 'SuperTajna2026\|ak-live-1234' && { echo "$s still contains the secret in plain text"; exit 1; }
done
[ "$(kubectl -n bank get secret db-credentials -o jsonpath='{.data.password}' | base64 -d)" = "SuperTajna2026" ] || { echo "the Secret can no longer be read through the API"; exit 1; }
-->
<!-- solution
kubectl get secrets -A -o json | kubectl replace -f - >/dev/null
-->
