# Lab 2: CoreDNS ne radi

Poslije „sitne izmjene“ CoreDNS konfiguracije aplikacije ne mogu pronaći Servise po imenu. Popravi DNS, a zatim dodaj interno ime za stari sistem van klastera.

```bash
kubectl run dns -it --rm --restart=Never --image=busybox:1.37 -- nslookup kubernetes.default
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system get cm coredns -o yaml
```

<!-- setup
set -e
cluster-up
kubectl create deploy web --image=nginx:1.28 >/dev/null
kubectl expose deploy web --port=80 >/dev/null
kubectl -n kube-system get cm coredns -o yaml | sed 's/kubernetes cluster.local in-addr.arpa ip6.arpa/kubernetes cluster.lokal in-addr.arpa ip6.arpa/' | kubectl apply -f - >/dev/null
kubectl -n kube-system rollout restart deploy coredns >/dev/null
kubectl -n kube-system rollout status deploy coredns --timeout=120s >/dev/null
kubectl run dnstest --image=busybox:1.37 -- sleep 36000 >/dev/null
kubectl wait --for=condition=Ready pod/dnstest --timeout=120s >/dev/null
-->

## Dijagnoza

Iz Poda `dnstest` pokušaj razriješiti `web.default.svc.cluster.local`. Upit ne uspijeva, iako CoreDNS Podovi rade.

1. Provjeri kojim DNS serverom Pod šalje upite (`/etc/resolv.conf`) i da Servis `kube-dns` ima endpointe.
2. Pronađi grešku u `Corefile`-u.

U `/root/dns-greska.txt` upiši pogrešno ime domena klastera koje je upisano u Corefile.

```bash
kubectl exec dnstest -- cat /etc/resolv.conf
kubectl exec dnstest -- nslookup web.default.svc.cluster.local
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
```

<!-- verify
grep -qx 'cluster.lokal' <(tr -d ' ' < /root/dns-greska.txt 2>/dev/null) || { echo "dns-greska.txt ne sadrži pogrešan domen"; exit 1; }
-->
<!-- solution
echo cluster.lokal > /root/dns-greska.txt
-->

## Popravi CoreDNS

Ispravi Corefile tako da plugin `kubernetes` opet služi zonu `cluster.local`. Ime mora odgovarati `clusterDomain` u konfiguraciji kubeleta. CoreDNS ima plugin `reload`, pa promjenu ConfigMapa učita sam za oko 30 sekundi; ako žuriš, uradi `rollout restart`.

<!-- verify
kubectl -n kube-system get cm coredns -o jsonpath='{.data.Corefile}' | grep -q 'kubernetes cluster.local in-addr.arpa' || { echo "Corefile još nema 'kubernetes cluster.local'"; exit 1; }
kubectl exec dnstest -- nslookup -timeout=2 web.default.svc.cluster.local >/dev/null 2>&1 || { echo "dnstest još ne može razriješiti web.default.svc.cluster.local"; exit 1; }
-->
<!-- hint
`kubectl -n kube-system edit cm coredns`, promijeni `cluster.lokal` u `cluster.local`. Provjera domena: `grep clusterDomain /var/lib/kubelet/config.yaml`.
-->
<!-- solution
kubectl -n kube-system get cm coredns -o yaml | sed 's/cluster.lokal/cluster.local/' | kubectl apply -f -
kubectl -n kube-system rollout restart deploy coredns
kubectl -n kube-system rollout status deploy coredns --timeout=120s
for i in $(seq 30); do kubectl exec dnstest -- nslookup -timeout=2 web.default.svc.cluster.local >/dev/null 2>&1 && break; sleep 2; done
-->

## Statičko ime u CoreDNS-u

Stari ERP sistem van klastera ima adresu `10.50.0.10`. Aplikacije treba da ga zovu po imenu `erp.firma.interno`.

Dodaj u Corefile plugin `hosts` (unutar bloka `.:53`, prije `forward`), sa zapisom `10.50.0.10 erp.firma.interno` i opcijom `fallthrough`, tako da ostala imena idu dalje.

<!-- verify
kubectl exec dnstest -- nslookup -timeout=2 erp.firma.interno 2>/dev/null | grep -q '10.50.0.10' || { echo "erp.firma.interno se ne razrješava u 10.50.0.10"; exit 1; }
kubectl exec dnstest -- nslookup -timeout=2 web.default.svc.cluster.local >/dev/null 2>&1 || { echo "imena servisa više ne rade (fallthrough?)"; exit 1; }
-->
<!-- hint
```text
    hosts {
       10.50.0.10 erp.firma.interno
       fallthrough
    }
```
Ubaci blok iznad linije `forward . /etc/resolv.conf`. Ako CoreDNS Podovi padnu (`CrashLoopBackOff`), u logovima (`kubectl -n kube-system logs -l k8s-app=kube-dns`) piše tačna greška u Corefileu.
-->
<!-- solution
kubectl -n kube-system get cm coredns -o yaml | sed 's#^\(\s*\)forward \. /etc/resolv.conf#\1hosts {\n\1   10.50.0.10 erp.firma.interno\n\1   fallthrough\n\1}\n\1forward . /etc/resolv.conf#' | kubectl apply -f -
kubectl -n kube-system rollout restart deploy coredns
kubectl -n kube-system rollout status deploy coredns --timeout=120s
for i in $(seq 30); do kubectl exec dnstest -- nslookup -timeout=2 erp.firma.interno 2>/dev/null | grep -q 10.50.0.10 && break; sleep 2; done
-->
