## What this module covers

This module covers three objectives from domain 3 (**Services & Networking**, 20% of the exam):

- **3.1** connectivity between Pods (the Kubernetes network model, CNI),
- **3.3** the **ClusterIP**, **NodePort** and **LoadBalancer** Service types and endpoints,
- **3.6** understanding and using **CoreDNS**.

Typical exam tasks:

- "Expose Deployment `web` as a NodePort Service on port 30080."
- "Service `api` does not respond. Fix it." (wrong selector, wrong `targetPort`, Pod not Ready)
- "From a Pod in namespace `dev`, resolve the name of Service `db` in namespace `prod` and write the IP to a file."
- "CoreDNS is not working / Pods cannot resolve names." (Corefile, `coredns` Pods, the `kube-dns` Service)

These are short tasks that score points quickly, but only if you know the imperative commands by heart.

## The Kubernetes network model

Kubernetes does not implement networking itself. It defines **rules** that the network plugin must satisfy:

1. Every **Pod** gets its own IP address (all containers in the Pod share that address and `localhost`).
2. Every Pod can communicate with every other Pod, on any node, **without NAT**. The IP a Pod sees as its own is the same IP others see.
3. Agents on a node (kubelet, system processes) can communicate with all Pods on that node.

Who makes this happen? The **CNI** (**Container Network Interface**) plugin. When the kubelet creates a Pod through containerd, the runtime calls the CNI plugin, which:

- creates a network namespace and a `veth` pair (one end in the Pod, the other on the node),
- assigns an IP from a range (IPAM),
- sets up routes so a packet reaches Pods on other nodes (direct routes, VXLAN overlay, BGP… depending on the plugin).

The CNI configuration and binaries are on the node:

```bash
ls /etc/cni/net.d/        # configuration (e.g. 10-kindnet.conflist)
ls /opt/cni/bin/          # plugin binaries (bridge, host-local, loopback, ptp…)
kubectl -n kube-system get pods -o wide | grep -i kindnet
```

In this course's labs the CNI is **kindnet** (a DaemonSet in `kube-system`). Examples of other CNIs: Calico, Cilium, Flannel. Flannel does not implement NetworkPolicy, Calico and Cilium do (see module 09).

### Pod CIDR per node

In a kubeadm cluster the Pod range is set at installation (`--pod-network-cidr` or `networking.podSubnet` in the configuration). **kube-controller-manager** (with `--allocate-node-cidrs=true`) assigns each node a subrange, e.g. `/24`:

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,PODCIDR:.spec.podCIDR
# NAME           PODCIDR
# controlplane   10.244.0.0/24
# node01         10.244.1.0/24

kubectl get pods -o wide            # IP and NODE columns
kubectl -n kube-system get cm kubeadm-config -o yaml | grep -E 'podSubnet|serviceSubnet'
```

Three ranges must not overlap: the node network, the **Pod CIDR** and the **Service CIDR** (kubeadm default `10.96.0.0/12`).

### A quick connectivity check

```bash
kubectl run a --image=busybox:1.36 -- sleep 3600
kubectl run b --image=nginx --port=80
kubectl get pod b -o wide                        # e.g. 10.244.1.7 on node01
kubectl exec a -- wget -qO- -T 2 10.244.1.7      # Pod -> Pod directly, no Service
```

> **On the exam:** every task starts with a `kubectl config use-context <name>` command given in the task. Copy it and run it before anything else. A solution in the wrong cluster scores zero.

## Service: a stable address for changing Pods

Pods die and get new IP addresses. A **Service** provides a stable virtual IP (**ClusterIP**) and DNS name, and distributes traffic across the Pods selected by `spec.selector`.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: web            # must match the labels of the PODS, not the Deployment
  ports:
  - name: http
    port: 80            # port on the Service ClusterIP
    targetPort: 8080    # port in the container (a number or a port name from containerPort)
    protocol: TCP
```

| Field | Meaning |
|---|---|
| `port` | The port the client sends the request to (ClusterIP:port) |
| `targetPort` | The container port the traffic goes to. If omitted, it equals `port` |
| `nodePort` | The port on **every** node (NodePort/LoadBalancer only), range 30000–32767 |
| `name` | Required when the Service has several ports |

`targetPort` can be a port name (`targetPort: http`) if the container has `ports: - name: http, containerPort: 8080`. That way you can change the port number in the Pod without changing the Service.

### Service types

| Type | What you get | Who can reach it | Note |
|---|---|---|---|
| **ClusterIP** (default) | A virtual IP from the Service CIDR | Only from inside the cluster | The basis for all other types |
| **NodePort** | ClusterIP + a port 30000–32767 on every node | From outside via `<node IP>:<nodePort>` | The port opens on all nodes, including those without a Pod |
| **LoadBalancer** | NodePort + an external load balancer | From outside via `EXTERNAL-IP` | Requires a cloud controller or e.g. MetalLB; otherwise `EXTERNAL-IP` stays `<pending>` |
| **ExternalName** | A DNS CNAME to an external name | From inside the cluster | No selector, no ClusterIP, no proxy |
| **Headless** (`clusterIP: None`) | No virtual IP; DNS returns the Pod IP addresses | From inside the cluster | For StatefulSets and clients that pick a Pod themselves |

```yaml
apiVersion: v1
kind: Service
metadata:
  name: legacy-db
spec:
  type: ExternalName
  externalName: db.example.com      # a DNS query for legacy-db returns CNAME db.example.com
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None
  selector:
    app: web
  ports:
  - port: 80
```

### Imperatively: kubectl expose and kubectl create service

```bash
# ClusterIP for a Deployment (the selector is copied from the Deployment)
kubectl expose deployment web --port=80 --target-port=8080 --name=web

# NodePort; the API server assigns the nodePort randomly from the range
kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort --name=web-np

# Expose a single Pod (selector = the Pod's labels)
kubectl expose pod b --port=80 --name=b-svc

# Fixed nodePort: kubectl create service has --node-port,
# but it sets the selector to app=<service name>!
kubectl create service nodeport web --tcp=80:8080 --node-port=30080 \
  --dry-run=client -o yaml > svc.yaml
```

`kubectl expose` has no flag for a specific `nodePort`. The fastest way to a fixed port: generate YAML with `--dry-run=client -o yaml`, add `nodePort: 30080` and apply it.

```bash
kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort \
  --name=web-np --dry-run=client -o yaml > web-np.yaml
vim web-np.yaml        # under ports: add nodePort: 30080
kubectl apply -f web-np.yaml
```

Or modify an existing Service:

```bash
kubectl patch svc web-np --type=json \
  -p='[{"op":"replace","path":"/spec/ports/0/nodePort","value":30080}]'
```

> **On the exam:** `kubectl create service nodeport web …` sets `selector: app: web`. If the Pods have the label `app: frontend`, the Service will have no endpoints. `kubectl expose deployment` is safer because it copies the selector from the Deployment.

## Endpoints and EndpointSlice

When a Service has a `selector`, the **EndpointSlice controller** in kube-controller-manager continuously watches Pods with those labels and writes their IP addresses and ports into **EndpointSlice** objects (`discovery.k8s.io/v1`). All matching Pods go into the slice, but only **Ready** Pods get `ready: true` and receive traffic.

```bash
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl describe svc web | grep -i endpoints
kubectl get endpointslice web-abc12 -o yaml
```

The older **Endpoints** API (`v1`) still exists, but has been deprecated since 1.33 and `kubectl get endpoints` prints a warning. For the exam both views give the same answer: "does the Service have backend Pods?".

The chain that must be correct:

```text
Service.spec.selector  ──selects──►  Pod.metadata.labels
                                   │ (Pod Running and Ready)
EndpointSlice ◄───────────writes──┘
kube-proxy  ──reads EndpointSlice──► rules on the node (ClusterIP:port → podIP:targetPort)
```

### A Service without a selector

A Service without a `selector` field gets no automatic endpoints. It is used when the backend is not a Pod (a database outside the cluster, a service in another cluster). You then create the EndpointSlice yourself and tie it with the `kubernetes.io/service-name` label:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ext-db
spec:
  ports:
  - name: pg
    port: 5432
    targetPort: 5432
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ext-db-1
  labels:
    kubernetes.io/service-name: ext-db
    endpointslice.kubernetes.io/managed-by: admin.cyberlab
addressType: IPv4
ports:
- name: pg             # the name must match the port name in the Service
  port: 5432
  protocol: TCP
endpoints:
- addresses: ["192.168.10.50"]
```

## kube-proxy

**kube-proxy** is a DaemonSet on every node. It watches Service and EndpointSlice objects and programs the kernel so a packet sent to `ClusterIP:port` (or `NodeIP:nodePort`) is redirected (DNAT) to the IP of one backend Pod. kube-proxy does not forward packets through itself; it only writes rules.

| Mode | How it works | Status in 1.35 |
|---|---|---|
| `iptables` | iptables chains `KUBE-SERVICES`, `KUBE-SVC-…`, `KUBE-SEP-…`, random backend selection | The **default** mode on Linux |
| `ipvs` | IPVS virtual servers in the kernel, several balancing algorithms | **Deprecated since 1.35** (planned to be disabled and later removed) |
| `nftables` | nftables tables, scales better than iptables | **Stable (GA) since 1.33**, requires kernel 5.13+; announced to become the default in a future version |

With kubeadm the configuration is in the `kube-proxy` ConfigMap:

```bash
kubectl -n kube-system get cm kube-proxy -o yaml | grep -E 'mode:|clusterCIDR'
# mode: ""   → empty means iptables on Linux
kubectl -n kube-system logs ds/kube-proxy | grep -i proxier
```

Changing the mode: edit `mode:` in the ConfigMap, then restart the DaemonSet:

```bash
kubectl -n kube-system edit cm kube-proxy                 # mode: "nftables"
kubectl -n kube-system rollout restart ds kube-proxy
```

Rules on the node:

```bash
ssh node01
iptables-save | grep web                       # iptables mode
nft list table ip kube-proxy | head            # nftables mode
```

> **On the exam:** if the ClusterIP does not respond while the EndpointSlice has the correct IP addresses, look at the kube-proxy Pods: `kubectl -n kube-system get pods -l k8s-app=kube-proxy` and their logs. A ClusterIP is virtual and **does not respond to ping**; test with `wget`/`curl`/`nc` on the port.

### externalTrafficPolicy and internalTrafficPolicy

For NodePort and LoadBalancer Services:

| `externalTrafficPolicy` | Behavior |
|---|---|
| `Cluster` (default) | The node that receives the packet may forward it to a Pod on **another** node. The client source IP is lost (SNAT). Even, but an extra hop |
| `Local` | Traffic goes only to Ready Pods **on that node**. The client source IP is preserved. If the node has no local Pod, traffic on that node is dropped |

`internalTrafficPolicy: Local` does the same for traffic from inside the cluster to the ClusterIP.

```bash
kubectl patch svc web-np -p '{"spec":{"externalTrafficPolicy":"Local"}}'
```

A typical trap: you set `Local`, the Pod runs only on `node01`, and you curl `controlplane:30080` → no response. That is not a bug but expected behavior.

### sessionAffinity

By default every new connection may go to a different Pod. `sessionAffinity: ClientIP` sends the same client (by source IP) to the same Pod, by default for up to 10800 seconds (3 hours):

```yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 600
```

## CoreDNS

**CoreDNS** is the cluster DNS server. With kubeadm it runs as the Deployment `coredns` (2 replicas) in `kube-system`, and it is exposed by a Service that for historical reasons is called **`kube-dns`** (ClusterIP usually `10.96.0.10`).

```bash
kubectl -n kube-system get deploy coredns
kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
```

### Corefile

The configuration is in the **`coredns`** ConfigMap, key `Corefile`. In short, kubeadm sets roughly this:

```text
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

| Plugin | Role |
|---|---|
| `kubernetes cluster.local …` | Answers Service and Pod names from the API; `cluster.local` is the cluster domain |
| `pods insecure` | Enables A records for Pod names of the form `10-244-1-7.ns.pod.cluster.local` |
| `forward . /etc/resolv.conf` | Sends everything outside the cluster domain to the node's upstream resolvers |
| `cache 30` | Caches answers for 30 s |
| `loop` | Detects a loop (e.g. upstream pointing back to CoreDNS) and stops CoreDNS |
| `reload` | Automatically reloads a changed Corefile (takes up to ~2 min) |
| `health`, `ready` | Endpoints for the liveness (`:8080/health`) and readiness (`:8181/ready`) probes |

Example: forwarding the company's internal domain to an internal DNS server. You add a new server block:

```bash
kubectl -n kube-system edit cm coredns
```

```text
corp.local:53 {
    errors
    cache 30
    forward . 10.0.0.53
}
```

If you do not want to wait for `reload`: `kubectl -n kube-system rollout restart deploy coredns`.

> **On the exam:** before editing a system ConfigMap, save a copy: `kubectl -n kube-system get cm coredns -o yaml > /root/coredns-backup.yaml`. If you get the syntax wrong, the CoreDNS Pods go into `CrashLoopBackOff` and the whole cluster loses DNS.

### DNS names

| What | Name |
|---|---|
| Service | `<service>.<namespace>.svc.cluster.local` → ClusterIP |
| Headless Service | the same name → A records of all Ready Pods |
| Pod behind a headless Service (StatefulSet) | `<pod>.<service>.<namespace>.svc.cluster.local`, e.g. `web-0.nginx.default.svc.cluster.local` |
| Pod with `hostname` and `subdomain` | `<hostname>.<subdomain>.<namespace>.svc.cluster.local` (requires a headless Service named after `subdomain`) |
| Pod by IP | `10-244-1-7.<namespace>.pod.cluster.local` |
| Named port | SRV record `_http._tcp.<service>.<namespace>.svc.cluster.local` |
| ExternalName | CNAME to `spec.externalName` |

### /etc/resolv.conf in a Pod and ndots

The kubelet writes `/etc/resolv.conf` for every Pod (it takes the DNS server address from `clusterDNS` in the kubelet configuration `/var/lib/kubelet/config.yaml`):

```bash
kubectl exec a -- cat /etc/resolv.conf
# search default.svc.cluster.local svc.cluster.local cluster.local
# nameserver 10.96.0.10
# options ndots:5
```

- The `search` list enables short names: from namespace `default` the name `web` is tried as `web.default.svc.cluster.local`.
- From another namespace `web.default` is enough (it is completed with `svc.cluster.local`).
- `ndots:5`: if a name has **fewer than 5 dots**, the resolver first tries all search domains and only then the name as is. That is why `api.github.com` from a Pod first produces several failed queries inside `cluster.local`. A name with a trailing dot (`api.github.com.`) skips the search list.

### dnsPolicy and dnsConfig

| `dnsPolicy` | Behavior |
|---|---|
| `ClusterFirst` (default) | Uses CoreDNS; unknown domains go upstream |
| `Default` | The Pod inherits the **node's** resolv.conf (the name is confusing: it is not the default value) |
| `ClusterFirstWithHostNet` | For Pods with `hostNetwork: true` that still need cluster DNS |
| `None` | Ignores everything; you specify everything in `dnsConfig` |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers: ["10.96.0.10"]
    searches: ["prod.svc.cluster.local", "svc.cluster.local"]
    options:
    - name: ndots
      value: "2"
  containers:
  - name: c
    image: busybox:1.36
    command: ["sleep", "3600"]
```

A Pod with `hostNetwork: true` and the default `ClusterFirst` effectively uses the node's DNS; if it needs cluster DNS, set `ClusterFirstWithHostNet`.

> **On the exam:** for DNS tests use `busybox:1.36` or `registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3` (the example from the "Debugging DNS Resolution" page in the documentation). A one-off Pod: `kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- nslookup web.default`.

## Troubleshooting

### The Service does not respond

Go step by step, from the Service to the Pod:

```bash
kubectl get svc web -o wide                     # SELECTOR column
kubectl get pods -l app=web -o wide             # does the selector find any Pods at all?
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl describe svc web                        # Endpoints, TargetPort
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].ports}'
kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- -T 2 web:80
```

| Symptom | Likely cause | Fix |
|---|---|---|
| EndpointSlice empty, Pods running | The selector does not match the Pod labels (typo, wrong label) | `kubectl edit svc` or `kubectl label pod` |
| EndpointSlice has addresses with `ready: false` | The readiness probe fails | Fix the probe or the application |
| Endpoints exist, `connection refused` | `targetPort` does not match the port the application listens on | Fix `targetPort` |
| NodePort works on only one node | `externalTrafficPolicy: Local` | Expected, or switch back to `Cluster` |
| `EXTERNAL-IP <pending>` | No cloud controller / load balancer implementation | Use NodePort or install an LB implementation |
| Pod-to-Pod traffic does not pass between nodes | The CNI Pod is not running on a node, or a NetworkPolicy | `kubectl -n kube-system get pods -o wide`, `kubectl get netpol -A` |

### DNS does not work

```bash
kubectl run t --image=busybox:1.36 --rm -it --restart=Never -- nslookup kubernetes.default
# If it does not work:
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system logs -l k8s-app=kube-dns
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
kubectl -n kube-system get cm coredns -o yaml
kubectl exec <pod> -- cat /etc/resolv.conf
grep -A2 clusterDNS /var/lib/kubelet/config.yaml
```

Common causes:

- CoreDNS Pods in `CrashLoopBackOff`: a syntax error in the Corefile, or the `loop` plugin detected a loop (the logs say "Loop … detected").
- The `kube-dns` Service has a wrong selector, so it has no endpoints.
- `clusterDNS` in the kubelet configuration does not match the ClusterIP of the `kube-dns` Service (after the change: `systemctl restart kubelet` and recreate the Pod).
- Queries for external names fail while cluster names work: the problem is in `forward` (the node's upstream resolver).
- A NetworkPolicy blocks egress to `kube-system` on port 53 (module 09).

> **On the exam:** `nslookup` from busybox sometimes prints an error for AAAA or a search domain and still returns the correct A address. Look for an `Address:` line with the Service IP in the output, not just for the word "error".

## Summary

- Network model: every Pod has its own IP, Pods communicate without NAT; the CNI plugin (kindnet in the lab) creates interfaces, assigns IPs from the node's Pod CIDR (`.spec.podCIDR`) and sets up routes.
- A Service provides a stable ClusterIP and DNS name; `selector` selects **Pods**, `port` is the Service port, `targetPort` the container port, `nodePort` (30000–32767) the port on every node.
- ClusterIP ⊂ NodePort ⊂ LoadBalancer; ExternalName is a CNAME without a proxy; headless (`clusterIP: None`) returns the Pod IP addresses.
- The EndpointSlice controller writes Ready Pods; a Service without a selector needs a manual EndpointSlice with the `kubernetes.io/service-name` label.
- kube-proxy programs the node: `iptables` is the default, `nftables` GA since 1.33, `ipvs` deprecated since 1.35; the mode is in the `kube-proxy` ConfigMap.
- `externalTrafficPolicy: Local` preserves the client IP but sends only to local Pods; `sessionAffinity: ClientIP` pins a client to a Pod.
- CoreDNS: Deployment `coredns`, Service `kube-dns`, ConfigMap `coredns` (Corefile); names `svc.ns.svc.cluster.local`, `ndots:5`, `dnsPolicy` `ClusterFirst`/`Default`/`ClusterFirstWithHostNet`/`None`.
- Troubleshooting follows the chain selector → EndpointSlice → targetPort → kube-proxy, and for DNS: `nslookup` from a busybox Pod → CoreDNS Pods and logs → the `kube-dns` Service → Corefile → resolv.conf.
