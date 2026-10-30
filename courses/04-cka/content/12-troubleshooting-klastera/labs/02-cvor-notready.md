# Lab 2: Čvor NotReady

Monitoring javlja da je `node01` `NotReady` i da se novi Podovi ne raspoređuju. U klasteru su **dva** kvara, jedan za drugim. Popravi oba, tako da `node01` bude `Ready` i da radi Deployment `web` (2 replike).

```bash
kubectl get nodes
kubectl describe node node01 | grep -A8 Conditions
ssh node01
systemctl status kubelet
journalctl -u kubelet -n 30 --no-pager
```

<!-- setup
set -e
cluster-up
kubectl create deploy web --image=nginx:1.28 --replicas=2 >/dev/null
kubectl rollout status deploy/web --timeout=120s >/dev/null
cat > /root/kolega.sh <<'EOF'
#!/bin/bash
# simulira "optimizaciju" konfiguracije kubeleta na node01
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca-cert.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
touch /root/.kolega
echo "kolega je izmijenio konfiguraciju kubeleta na node01"
EOF
chmod +x /root/kolega.sh
ssh node01 'systemctl stop kubelet && systemctl disable kubelet' >/dev/null 2>&1
for i in $(seq 90); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" != "True" ] && break; sleep 2; done
-->

## Kvar 1: kubelet

Pronađi zašto `node01` ne javlja status i popravi to. Popravka mora preživjeti restart čvora.

<!-- verify
ssh node01 systemctl is-enabled kubelet 2>/dev/null | grep -qx enabled || { echo "kubelet na node01 nije enabled (ne bi se pokrenuo poslije restarta)"; exit 1; }
ssh node01 systemctl is-active kubelet 2>/dev/null | grep -qx active || { echo "kubelet na node01 ne radi"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 još nije Ready"; exit 1; }
-->
<!-- hint
`ssh node01 systemctl status kubelet` pokazuje `inactive (dead)` i `disabled`. Rješenje: `systemctl enable --now kubelet`.
-->
<!-- solution
ssh node01 systemctl enable --now kubelet >/dev/null 2>&1
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && break; sleep 2; done
-->

## Kvar 2: pogrešna konfiguracija kubeleta

Kolega je u međuvremenu „optimizovao“ konfiguraciju kubeleta na node01. Pokreni skriptu koja simulira njegovu izmjenu:

```bash
/root/kolega.sh
```

Kubelet na node01 sada stalno pada i restartuje se. Pronađi grešku u logu i popravi konfiguraciju.

<!-- verify
[ -f /root/.kolega ] || { echo "prvo pokreni /root/kolega.sh"; exit 1; }
ssh node01 systemctl is-active kubelet 2>/dev/null | grep -qx active || { echo "kubelet na node01 ne radi"; exit 1; }
[ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || { echo "node01 nije Ready"; exit 1; }
kubectl rollout status deploy/web --timeout=5s >/dev/null 2>&1 || { echo "deployment web nije spreman"; exit 1; }
-->
<!-- hint
`ssh node01 journalctl -u kubelet -n 20 --no-pager` pokazuje grešku pri čitanju CA fajla (`clientCAFile`). Konfiguracija je u `/var/lib/kubelet/config.yaml` na node01. Ispravna putanja je `/etc/kubernetes/pki/ca.crt`. Poslije izmjene: `systemctl restart kubelet`.
-->
<!-- solution
[ -f /root/.kolega ] || /root/kolega.sh
ssh node01 "sed -i 's#clientCAFile: .*#clientCAFile: /etc/kubernetes/pki/ca.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"
for i in $(seq 60); do [ "$(kubectl get node node01 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] && ssh node01 systemctl is-active kubelet | grep -qx active && break; sleep 2; done
kubectl rollout status deploy/web --timeout=120s
-->
