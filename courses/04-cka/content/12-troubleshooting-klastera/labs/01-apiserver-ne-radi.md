# Lab 1: kube-apiserver ne radi

Neko je „podesio“ API server i klaster je prestao odgovarati:

```bash
kubectl get nodes
# The connection to the server controlplane:6443 was refused
```

Kada API server ne radi, `kubectl` ne pomaže. Koristi alate na samom čvoru: `crictl`, logove u `/var/log/pods/` i `journalctl -u kubelet`.

<!-- setup
set -e
cluster-up
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/.kube-apiserver.orig
sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:2381#' /etc/kubernetes/manifests/kube-apiserver.yaml
cat > /root/pokvari-yaml.sh <<'EOF'
#!/bin/bash
# simulira grešku u kucanju u manifestu kube-apiservera
sed -i 's/^  containers:/  contianers:/' /etc/kubernetes/manifests/kube-apiserver.yaml
touch /root/.yaml-pokvaren
echo "manifest kube-apiservera je izmijenjen"
EOF
chmod +x /root/pokvari-yaml.sh
sleep 5
for i in $(seq 60); do kubectl get nodes >/dev/null 2>&1 || break; sleep 2; done
-->

## Pronađi uzrok

1. Pronađi kontejner kube-apiservera (i one koji su već pali) i pročitaj njegov log.
2. U `/root/uzrok.txt` upiši pogrešnu vrijednost flaga zbog kog API server ne može da se poveže na etcd (npr. `https://…:port`).

```bash
crictl ps -a | grep kube-apiserver
crictl logs <container-id> 2>&1 | tail -20
ls /var/log/pods/ | grep apiserver
grep etcd /etc/kubernetes/manifests/kube-apiserver.yaml
grep listen-client /etc/kubernetes/manifests/etcd.yaml
```

<!-- verify
grep -q '127.0.0.1:2381' /root/uzrok.txt 2>/dev/null || { echo "uzrok.txt ne sadrži pogrešnu adresu etcd-a"; exit 1; }
-->
<!-- hint
Log API servera ponavlja grešku tipa `dial tcp 127.0.0.1:2381: connect: connection refused`. etcd klijentski port je 2379 (vidi `--listen-client-urls` u `etcd.yaml`), a 2381 je etcd-ov metrics/health port.
-->
<!-- solution
grep -o 'etcd-servers=[^ ]*' /etc/kubernetes/manifests/kube-apiserver.yaml | cut -d= -f2 > /root/uzrok.txt
-->

## Popravi API server

Ispravi manifest `/etc/kubernetes/manifests/kube-apiserver.yaml`. Kubelet sam primjećuje izmjenu i ponovo pokreće static Pod za 20-60 sekundi.

<!-- verify
grep -q 'etcd-servers=https://127.0.0.1:2379' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "--etcd-servers još nije ispravan"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "API server još ne odgovara (sačekaj malo)"; exit 1; }
[ "$(kubectl -n kube-system get pod kube-apiserver-controlplane -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "kube-apiserver Pod nije Ready"; exit 1; }
-->
<!-- hint
Prije izmjene napravi kopiju manifesta **van** `/etc/kubernetes/manifests/`. Kubelet pokreće svaki YAML iz tog direktorija, pa kopija unutra pravi drugi API server. Prati sa `watch crictl ps`.
-->
<!-- solution
sed -i 's#--etcd-servers=https://127.0.0.1:2381#--etcd-servers=https://127.0.0.1:2379#' /etc/kubernetes/manifests/kube-apiserver.yaml
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
kubectl -n kube-system wait --for=condition=Ready pod/kube-apiserver-controlplane --timeout=120s
-->

## Druga greška: pogrešan YAML

Pokvari manifest na drugi način i posmatraj šta se dešava. Za ovaj korak to radi skripta:

```bash
/root/pokvari-yaml.sh
crictl ps | grep apiserver
journalctl -u kubelet --since "2 min ago" | grep -i apiserver | tail -5
```

Kada je YAML neispravan, **nema** novog kontejnera ni logova u `crictl`. Kubelet ne može ni pročitati manifest i to piše u **svom** logu. Pronađi grešku u `journalctl -u kubelet` i popravi manifest.

<!-- verify
[ -f /root/.yaml-pokvaren ] || { echo "prvo pokreni /root/pokvari-yaml.sh"; exit 1; }
grep -q '^  containers:' /etc/kubernetes/manifests/kube-apiserver.yaml || { echo "manifest još ima grešku"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "API server ne odgovara (sačekaj malo)"; exit 1; }
-->
<!-- hint
Kubelet loguje nešto kao `Could not process manifest file … contianers`. Ispravi pogrešno napisano polje.
-->
<!-- solution
[ -f /root/.yaml-pokvaren ] || /root/pokvari-yaml.sh
sed -i 's/^  contianers:/  containers:/' /etc/kubernetes/manifests/kube-apiserver.yaml
for i in $(seq 90); do kubectl get nodes >/dev/null 2>&1 && break; sleep 2; done
-->
