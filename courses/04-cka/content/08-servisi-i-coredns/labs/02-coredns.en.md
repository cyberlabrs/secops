# Lab 2: CoreDNS is not working

After a "small change" to the CoreDNS configuration, applications cannot find Services by name. Fix DNS, then add an internal name for a legacy system outside the cluster.

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

## Diagnosis

From Pod `dnstest`, try to resolve `web.default.svc.cluster.local`. The query fails even though the CoreDNS Pods are running.

1. Check which DNS server the Pod sends queries to (`/etc/resolv.conf`) and that the `kube-dns` Service has endpoints.
2. Find the error in the `Corefile`.

Write the wrong cluster domain name that was put into the Corefile to `/root/dns-greska.txt` ("DNS error").

```bash
kubectl exec dnstest -- cat /etc/resolv.conf
kubectl exec dnstest -- nslookup web.default.svc.cluster.local
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
```

<!-- verify
grep -qx 'cluster.lokal' <(tr -d ' ' < /root/dns-greska.txt 2>/dev/null) || { echo "dns-greska.txt does not contain the wrong domain"; exit 1; }
-->
<!-- solution
echo cluster.lokal > /root/dns-greska.txt
-->

## Fix CoreDNS

Fix the Corefile so that the `kubernetes` plugin serves the `cluster.local` zone again. The name must match `clusterDomain` in the kubelet configuration. CoreDNS has the `reload` plugin, so it picks up the ConfigMap change by itself in about 30 seconds; if you are in a hurry, do a `rollout restart`.

<!-- verify
kubectl -n kube-system get cm coredns -o jsonpath='{.data.Corefile}' | grep -q 'kubernetes cluster.local in-addr.arpa' || { echo "the Corefile does not have 'kubernetes cluster.local' yet"; exit 1; }
kubectl exec dnstest -- nslookup -timeout=2 web.default.svc.cluster.local >/dev/null 2>&1 || { echo "dnstest still cannot resolve web.default.svc.cluster.local"; exit 1; }
-->
<!-- hint
`kubectl -n kube-system edit cm coredns`, change `cluster.lokal` to `cluster.local`. Checking the domain: `grep clusterDomain /var/lib/kubelet/config.yaml`.
-->
<!-- solution
kubectl -n kube-system get cm coredns -o yaml | sed 's/cluster.lokal/cluster.local/' | kubectl apply -f -
kubectl -n kube-system rollout restart deploy coredns
kubectl -n kube-system rollout status deploy coredns --timeout=120s
for i in $(seq 30); do kubectl exec dnstest -- nslookup -timeout=2 web.default.svc.cluster.local >/dev/null 2>&1 && break; sleep 2; done
-->

## A static name in CoreDNS

A legacy ERP system outside the cluster has the address `10.50.0.10`. Applications should call it by the name `erp.firma.interno`.

Add the `hosts` plugin to the Corefile (inside the `.:53` block, before `forward`), with the entry `10.50.0.10 erp.firma.interno` and the `fallthrough` option, so that other names are passed on.

<!-- verify
kubectl exec dnstest -- nslookup -timeout=2 erp.firma.interno 2>/dev/null | grep -q '10.50.0.10' || { echo "erp.firma.interno does not resolve to 10.50.0.10"; exit 1; }
kubectl exec dnstest -- nslookup -timeout=2 web.default.svc.cluster.local >/dev/null 2>&1 || { echo "Service names no longer work (fallthrough?)"; exit 1; }
-->
<!-- hint
```text
    hosts {
       10.50.0.10 erp.firma.interno
       fallthrough
    }
```
Insert the block above the line `forward . /etc/resolv.conf`. If the CoreDNS Pods crash (`CrashLoopBackOff`), the logs (`kubectl -n kube-system logs -l k8s-app=kube-dns`) show the exact error in the Corefile.
-->
<!-- solution
kubectl -n kube-system get cm coredns -o yaml | sed 's#^\(\s*\)forward \. /etc/resolv.conf#\1hosts {\n\1   10.50.0.10 erp.firma.interno\n\1   fallthrough\n\1}\n\1forward . /etc/resolv.conf#' | kubectl apply -f -
kubectl -n kube-system rollout restart deploy coredns
kubectl -n kube-system rollout status deploy coredns --timeout=120s
for i in $(seq 30); do kubectl exec dnstest -- nslookup -timeout=2 erp.firma.interno 2>/dev/null | grep -q 10.50.0.10 && break; sleep 2; done
-->
