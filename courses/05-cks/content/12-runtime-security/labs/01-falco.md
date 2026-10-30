# Lab 1: Falco: detekcija i istraga

Na `node01` je instaliran **Falco** kao systemd servis `falco`. Koristi modern eBPF i vidi sve sistemske pozive na čvoru. U namespaceu `apps` radi nekoliko aplikacija, a jedna od njih je kompromitovana.

```bash
ssh node01 systemctl status falco
ssh node01 journalctl -u falco -f
```

<!-- setup
set -e
cluster-up
ssh node01 systemctl start falco
kubectl create ns apps >/dev/null
for a in frontend backend reports; do kubectl -n apps create deploy $a --image=nginx:1.28 >/dev/null; done
kubectl -n apps patch deploy frontend -p '{"spec":{"template":{"spec":{"nodeName":"node01"}}}}' >/dev/null
kubectl -n apps patch deploy backend -p '{"spec":{"template":{"spec":{"nodeName":"node01"}}}}' >/dev/null
kubectl -n apps patch deploy reports -p '{"spec":{"template":{"spec":{"nodeName":"node01","containers":[{"name":"nginx","command":["sh","-c","nginx; while true; do sleep 20; cat /etc/shadow > /dev/null; done"]}]}}}}' >/dev/null
for a in frontend backend reports; do kubectl -n apps rollout status deploy/$a --timeout=120s >/dev/null; done
for i in $(seq 60); do ssh node01 journalctl -u falco --no-pager | grep -q 'Sensitive file opened' && break; sleep 3; done
-->

## Pronađi kompromitovani Pod

Falco već javlja sumnjivu aktivnost. Iz logova Falca saznaj koji **Pod** čita `/etc/shadow` i upiši njegovo ime (puno ime Poda) u `/root/napadnut-pod.txt`.

```bash
ssh node01 journalctl -u falco --no-pager | grep -i shadow | tail -3
```

<!-- verify
want=$(kubectl -n apps get pod -l app=reports -o jsonpath='{.items[0].metadata.name}')
[ "$(tr -d ' \n' < /root/napadnut-pod.txt 2>/dev/null)" = "$want" ] || { echo "napadnut-pod.txt ne sadrži ime kompromitovanog Poda"; exit 1; }
-->
<!-- hint
U izlazu Falca je polje `k8s_pod_name=…`. Ako ga nema, uzmi `container_id` i pronađi Pod sa `ssh node01 crictl inspect <id> | grep io.kubernetes.pod.name`.
-->
<!-- solution
ssh node01 journalctl -u falco --no-pager | grep 'Sensitive file opened' | tail -1 | grep -o 'k8s_pod_name=[^ ]*' | cut -d= -f2 > /root/napadnut-pod.txt
-->

## Izoluj i ukloni

Prije brisanja napadnuti Pod se izoluje, da napadač izgubi mrežu, a forenzika može nastaviti:

1. napravi NetworkPolicy `quarantine` u `apps` koja Podovima sa oznakom `quarantine=true` blokira sav ulaz i izlaz,
2. dodaj tu oznaku napadnutom Podu,
3. skaliraj Deployment `reports` na 0.

<!-- verify
p=$(kubectl -n apps get netpol quarantine -o json 2>/dev/null) || { echo "NetworkPolicy quarantine ne postoji"; exit 1; }
[ "$(echo "$p" | jq -r '.spec.podSelector.matchLabels.quarantine')" = "true" ] || { echo "quarantine ne bira quarantine=true"; exit 1; }
[ "$(echo "$p" | jq -r '.spec.policyTypes | sort | join(",")')" = "Egress,Ingress" ] || { echo "quarantine mora blokirati Ingress i Egress"; exit 1; }
[ "$(kubectl -n apps get deploy reports -o jsonpath='{.spec.replicas}')" = "0" ] || { echo "reports nije skaliran na 0"; exit 1; }
-->
<!-- hint
Redoslijed na ispitu nije važan, ali u praksi prvo izoluj, pa tek onda gasi: tako prvo prekidaš napadača, a dokazi ostaju dok ih ne sačuvaš.
-->
<!-- solution
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: quarantine, namespace: apps}
spec:
  podSelector: {matchLabels: {quarantine: "true"}}
  policyTypes: [Ingress, Egress]
EOF
kubectl -n apps label pod $(cat /root/napadnut-pod.txt) quarantine=true --overwrite
kubectl -n apps scale deploy reports --replicas=0
-->

## Vlastito Falco pravilo

Tim želi alarm kad god neko otvori **shell** (`sh`, `bash`) u bilo kom kontejneru u namespaceu `apps`.

U `/etc/falco/falco_rules.local.yaml` na `node01` dodaj pravilo `Shell u apps namespaceu`:

- `condition`: `spawned_process and container and proc.name in (sh, bash) and k8s.ns.name = "apps"` (`spawned_process` i `container` su makroi iz podrazumijevanih pravila)
- `output`: mora sadržati tekst `SHELL-APPS` i polja `k8s.pod.name` i `proc.cmdline`, npr. `SHELL-APPS pod=%k8s.pod.name cmd=%proc.cmdline`
- `priority: WARNING`

Restartuj Falco, otvori shell u Podu `frontend` i provjeri da se alarm pojavio.

```bash
kubectl -n apps exec deploy/frontend -- sh -c 'echo test'
ssh node01 journalctl -u falco --no-pager | grep SHELL-APPS | tail -2
```

<!-- verify
ssh node01 grep -q 'SHELL-APPS' /etc/falco/falco_rules.local.yaml || { echo "pravilo nije u falco_rules.local.yaml na node01"; exit 1; }
ssh node01 systemctl is-active falco | grep -qx active || { echo "Falco ne radi (greška u pravilu?): ssh node01 journalctl -u falco -n 20"; exit 1; }
kubectl -n apps exec deploy/frontend -- sh -c 'echo provjera-pravila' >/dev/null 2>&1; sleep 4
ssh node01 journalctl -u falco --since "-2min" --no-pager | grep 'SHELL-APPS' | grep -q 'frontend' || { echo "alarm SHELL-APPS za frontend se ne pojavljuje"; exit 1; }
-->
<!-- hint
```yaml
- rule: Shell u apps namespaceu
  desc: Shell pokrenut u kontejneru u namespaceu apps
  condition: spawned_process and container and proc.name in (sh, bash) and k8s.ns.name = "apps"
  output: "SHELL-APPS pod=%k8s.pod.name cmd=%proc.cmdline user=%user.name"
  priority: WARNING
```
Poslije izmjene: `systemctl restart falco` i `journalctl -u falco -n 20`. Ako je pravilo neispravno, Falco se ne podigne i u logu piše zašto.
-->
<!-- solution
ssh node01 'cat >> /etc/falco/falco_rules.local.yaml <<EOF

- rule: Shell u apps namespaceu
  desc: Shell pokrenut u kontejneru u namespaceu apps
  condition: spawned_process and container and proc.name in (sh, bash) and k8s.ns.name = "apps"
  output: "SHELL-APPS pod=%k8s.pod.name cmd=%proc.cmdline user=%user.name"
  priority: WARNING
EOF
systemctl restart falco'
sleep 15
-->
