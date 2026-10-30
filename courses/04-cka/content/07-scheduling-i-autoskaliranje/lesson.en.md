## What this module covers

This module covers two objectives from domain 2 (**Workloads & Scheduling**, 15% of the exam):

- **2.3** workload autoscaling (HPA, metrics-server, in-place resize, VPA in brief),
- **2.5** Pod admission and scheduling: requests and limits, LimitRange and ResourceQuota, nodeSelector, affinity, taints and tolerations, topology spread, priorities.

Typical tasks: "the Pod is Pending, fix it", "schedule the Pod only on a node with the label `disk=ssd`", "add a taint to `node01` and create a Pod that tolerates it", "create an HPA for the Deployment, min 2, max 6, CPU 70%", "set a ResourceQuota in the namespace". Scheduling also shows up in the Troubleshooting domain (30%), because `Pending` is one of the most common symptoms.

> **On the exam:** Always run the task's `kubectl config use-context …` first. For Pending Pods the first command is `k describe pod <name>`: the scheduler message in Events says exactly which filter rejected each node.

## How the scheduler picks a node

**kube-scheduler** watches Pods without `spec.nodeName` and picks a node for each in two steps:

1. **Filtering**: drop nodes that cannot take the Pod (not enough resources for the requests, nodeSelector/affinity does not match, a taint the Pod does not tolerate, port in use, volume in another zone, node cordoned).
2. **Scoring**: score the remaining nodes (less loaded, image already present, preferred affinity, even spreading…) and pick the best one.

Then it writes `spec.nodeName` (binding), and the kubelet on that node starts the Pod. If no node passes the filter, the Pod stays **Pending** and the scheduler attempts **preemption** (evicting lower-priority Pods).

```text
0/2 nodes are available: 1 Insufficient memory,
1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }.
preemption: 0/2 nodes are available: 1 No preemption victims found for incoming pod,
1 Preemption is not helpful for scheduling.
```

You read a message like this node by node: one node does not have enough memory, the other has a taint the Pod does not tolerate.

## Requests, limits and QoS

- **requests**: how many resources the Pod asks for; the scheduler adds up the requests of all Pods on a node and compares them with `allocatable`. Requests are not "consumed", they are reserved.
- **limits**: the upper bound at runtime. CPU above the limit is **throttled**, memory above the limit means **OOMKilled** (exit code 137).

```bash
k run web --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml   # add resources
k set resources deployment web -c nginx --requests=cpu=100m,memory=128Mi --limits=cpu=500m,memory=256Mi
k describe node node01 | grep -A8 "Allocated resources"
k top pods --sort-by=memory     # requires metrics-server
```

```yaml
    resources:
      requests:
        cpu: 100m        # 0.1 core
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 256Mi
```

If you set only `limits`, Kubernetes sets `requests` to the same value.

The **QoS class** is computed automatically and visible in `status.qosClass`. When a node runs out of memory, the kubelet evicts BestEffort first, then Burstable, and Guaranteed last.

| QoS class | Condition | Priority in node-pressure eviction |
|---|---|---|
| **Guaranteed** | Every container has CPU and memory requests = limits | Evicted last |
| **Burstable** | At least one container has some request or limit, but it is not Guaranteed | Middle |
| **BestEffort** | No container has requests or limits | Evicted first |

```bash
k get pod web -o jsonpath='{.status.qosClass}'
```

### Pod-level resources

Since v1.34 (beta, enabled by default, still beta in 1.35) `resources` can also be set at the Pod level (`spec.resources`), as a shared CPU, memory and hugepages budget for all containers. The containers in the Pod share that budget. This is useful for Pods with several sidecar containers; on the exam the classic `containers[].resources` is still the expected default answer.

```yaml
spec:
  resources:
    requests: {cpu: 500m, memory: 256Mi}
    limits:   {cpu: "1", memory: 512Mi}
  containers:
  - name: app
    image: nginx:1.27
  - name: helper
    image: busybox:1.36
    command: ["sleep", "infinity"]
```

## LimitRange and ResourceQuota (admission)

Both objects are enforced by **admission** in the API server, at the moment a Pod is created. They do not affect Pods that are already running.

A **LimitRange** sets defaults and bounds **per container (or Pod/PVC)** in a namespace:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: dev
spec:
  limits:
  - type: Container
    defaultRequest:        # injected if the container has no requests
      cpu: 100m
      memory: 128Mi
    default:               # injected if the container has no limits
      cpu: 500m
      memory: 256Mi
    min:
      cpu: 50m
    max:
      memory: 1Gi
```

A Pod with `limits.memory: 2Gi` in this namespace is rejected: `maximum memory usage per Container is 1Gi, but limit is 2Gi`.

A **ResourceQuota** limits the **total** in a namespace: overall requests/limits and the number of objects.

```bash
k create quota dev-quota -n dev --hard=requests.cpu=2,requests.memory=2Gi,limits.cpu=4,limits.memory=4Gi,pods=10
k describe quota -n dev        # Used / Hard
```

An important trap: when a quota limits `requests.cpu` or `limits.memory`, **every** new Pod in the namespace must have those values (or get them from a LimitRange). Otherwise it is rejected with a message like `failed quota: dev-quota: must specify limits.memory`. With a Deployment the Pod never shows up at all: you see the error in `k describe rs` or `k get events`, not on the Pod.

| | LimitRange | ResourceQuota |
|---|---|---|
| Scope | One container / Pod / PVC | Total for the whole namespace |
| Can inject values | Yes (`default`, `defaultRequest`) | No |
| Counts objects | No | Yes (`pods`, `services`, `secrets`, `persistentvolumeclaims`…) |

> **On the exam:** When a Deployment shows `READY 0/3` and there are no Pods, look at `k describe rs -l app=<name>`. A rejection by a ResourceQuota or LimitRange is visible only there (FailedCreate), because the Pod was never even created.

## Choosing a node: nodeName, nodeSelector, node affinity

### nodeName

`spec.nodeName: node01` **bypasses the scheduler**: the Pod goes directly to that node's kubelet. NoSchedule taints and resources are not checked by the scheduler (the kubelet may reject the Pod, e.g. `OutOfcpu`). It is rarely used, for testing or when the scheduler is down.

### nodeSelector

The simplest filter: the node must have all the listed labels.

```bash
k label node node01 disk=ssd
k get nodes -L disk
k label node node01 disk-        # remove the label
```

```yaml
spec:
  nodeSelector:
    disk: ssd
```

### Node affinity

**Node affinity** is a more expressive version: the operators `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`, and two kinds of rules:

- `requiredDuringSchedulingIgnoredDuringExecution`: mandatory (filter),
- `preferredDuringSchedulingIgnoredDuringExecution`: preferred, with a `weight` of 1–100 (scoring).

"IgnoredDuringExecution" means: if the node label changes later, a Pod that is already running stays.

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disk
            operator: In
            values: ["ssd", "nvme"]
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        preference:
          matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values: ["zone-a"]
```

Multiple `nodeSelectorTerms` are combined with **OR**; multiple `matchExpressions` within one term with **AND**.

> **On the exam:** Node affinity YAML is long and easy to get wrong in indentation. On kubernetes.io search for "Assign Pods to Nodes using Node Affinity" and copy the example. Check: `k explain pod.spec.affinity.nodeAffinity --recursive`.

## Pod affinity and anti-affinity

**Pod affinity** places a Pod near other Pods (by labels), **pod anti-affinity** keeps it away from them. "Near" is defined by the **topologyKey**: a node label that determines the domain.

| topologyKey | Domain meaning |
|---|---|
| `kubernetes.io/hostname` | Same/different node |
| `topology.kubernetes.io/zone` | Same/different zone |

Example: web application replicas never on the same node, and preferably on a node where the cache runs.

```yaml
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: web
        topologyKey: kubernetes.io/hostname
    podAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: cache
          topologyKey: kubernetes.io/hostname
```

In our lab cluster Pods run only on `node01` (controlplane has a taint), so a Deployment with 3 replicas and a required anti-affinity by hostname gives 1 Running and 2 Pending Pods. That is expected behavior, not an error.

## Taints and tolerations

A **taint** is on the node and repels Pods; a **toleration** is on the Pod and allows (but does not require) the Pod to go to that node. For "only on that node" you need a toleration + nodeSelector/affinity combination.

```bash
k taint nodes node01 gpu=true:NoSchedule
k describe node node01 | grep -i taints
k taint nodes node01 gpu=true:NoSchedule-     # removal (dash at the end)
k taint nodes node01 gpu-                     # remove all taints with key gpu
```

| Effect | New Pods without a toleration | Existing Pods without a toleration |
|---|---|---|
| **NoSchedule** | Not scheduled | Stay |
| **PreferNoSchedule** | The scheduler avoids the node if it can | Stay |
| **NoExecute** | Not scheduled | **Evicted** (immediately or after `tolerationSeconds`) |

```yaml
spec:
  tolerations:
  - key: gpu
    operator: Equal
    value: "true"
    effect: NoSchedule
  - key: node.kubernetes.io/unreachable
    operator: Exists
    effect: NoExecute
    tolerationSeconds: 60     # stay another 60s after the node becomes unreachable
```

`operator: Exists` does not take a `value`. A toleration with `operator: Exists` and no key tolerates all taints (some DaemonSets work this way).

### The control-plane taint and automatic taints

kubeadm puts the `node-role.kubernetes.io/control-plane:NoSchedule` taint on the control-plane node, which is why your Pods go to `node01`. Removal (only if the task asks for it):

```bash
k taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

The node controller adds taints on its own, such as `node.kubernetes.io/not-ready`, `node.kubernetes.io/unreachable` (NoExecute), `node.kubernetes.io/disk-pressure`, `node.kubernetes.io/memory-pressure` and `node.kubernetes.io/unschedulable` (after `kubectl cordon`). Every Pod automatically gets a toleration for not-ready and unreachable with `tolerationSeconds: 300`, which is why Pods on a failed node are evicted only after about 5 minutes.

> **On the exam:** The message `had untolerated taint {node-role.kubernetes.io/control-plane: }` on a Pending Pod means the only free node is controlplane. First check why the other node does not pass (cordon, resources, nodeSelector) instead of removing the taint right away.

## Topology spread constraints

**topologySpreadConstraints** spread replicas evenly across domains (nodes, zones), more precisely than anti-affinity.

```yaml
spec:
  topologySpreadConstraints:
  - maxSkew: 1                               # the largest allowed difference between domains
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule         # or ScheduleAnyway (scoring only)
    labelSelector:
      matchLabels:
        app: web
```

With `maxSkew: 1` and two nodes, 4 replicas go 2+2; the fifth goes anywhere (3+2), the sixth must go to the node with 2. `DoNotSchedule` is a filter (the Pod stays Pending if the skew would be exceeded), `ScheduleAnyway` only affects scoring. Additional fields: `minDomains`, `matchLabelKeys` (e.g. `pod-template-hash`, so only the current revision is counted), `nodeAffinityPolicy`, `nodeTaintsPolicy`.

## PriorityClass and preemption

A **PriorityClass** gives Pods a priority (an integer, higher is more important). When a high-priority Pod cannot fit anywhere, the scheduler picks a node and **preempts** lower-priority Pods to make room.

```bash
k create priorityclass critical-apps --value=100000 --description="kritične aplikacije"
k create priorityclass batch-low --value=100 --preemption-policy=Never
k get priorityclass     # you also see system-cluster-critical and system-node-critical
```

```yaml
spec:
  priorityClassName: critical-apps
  containers:
  - name: api
    image: nginx:1.27
```

- `preemptionPolicy: Never`: the Pod jumps ahead in the queue but evicts nobody.
- `globalDefault: true`: the class for Pods without a `priorityClassName` (only one may be the global default). Without it Pods have priority 0.
- The `system-*` classes are reserved for cluster components (CoreDNS, kube-proxy, CNI).
- Preemption respects PDBs where possible, but does not guarantee it.

## Autoscaling

| Mechanism | What it scales | Status |
|---|---|---|
| **HorizontalPodAutoscaler (HPA)** | The replica count (Deployment, StatefulSet, ReplicaSet) | Built in, `autoscaling/v2` |
| **VerticalPodAutoscaler (VPA)** | Container requests/limits | A separate project (CRD), not built in |
| **In-place Pod resize** | Resources of a running Pod, without recreating it | Built in, stable since v1.35 |
| Cluster Autoscaler / Karpenter | The number of nodes | Outside the cluster, depends on the cloud |

### metrics-server

For CPU/memory the HPA reads the Metrics API (`metrics.k8s.io`), which is provided by **metrics-server**. Without it `kubectl top` returns `error: Metrics API not available`, and the HPA shows `<unknown>/70%`.

```bash
ls /opt/kurs/manifests/                  # the metrics-server manifest in the lab
k apply -f /opt/kurs/manifests/metrics-server.yaml
k -n kube-system get deploy metrics-server
k top nodes
k top pods -A
```

In lab clusters the kubelets have self-signed certificates, so metrics-server often needs the `--kubelet-insecure-tls` argument. If the metrics-server Pod is Running but not Ready, look at its logs.

### HPA

```bash
k autoscale deployment web --min=2 --max=6 --cpu=70%
k get hpa web -w
k describe hpa web       # Conditions, Events, current metric value
```

In kubectl v1.35 the target is set with `--cpu` and `--memory` (a percentage means utilization, e.g. `--cpu=70%`; a quantity means an average value, e.g. `--memory=200Mi`). Older materials use `--cpu-percent`, which the v1.35 documentation no longer lists.

The equivalent manifest:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 6
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70      # percentage of REQUESTS, not limits
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60          # at most 1 Pod fewer per minute
```

Formula: `desiredReplicas = ceil(currentReplicas × currentMetric / targetMetric)`. Example: 3 replicas at 140% CPU with a 70% target give `ceil(3 × 2) = 6`. The controller computes every 15 seconds and does not react if the ratio is within the 10% tolerance.

Important:

- **Utilization** is computed relative to **requests**. If a container has no CPU request, the HPA cannot compute CPU utilization (`<unknown>`, `FailedGetResourceMetric`).
- Metric types in v2: `Resource` (Pod CPU/memory), `ContainerResource` (a single container, e.g. excluding a sidecar), `Pods`, `Object`, `External` (the last three require a custom/external metrics adapter).
- **behavior**: by default scale-up has no stabilization window (at most +100% or +4 Pods per 15s, whichever is larger), and scale-down has a 300s window. `selectPolicy` is `Max`, `Min` or `Disabled`. v1.35 has a beta `tolerance` field under `scaleUp`/`scaleDown` for a custom tolerance.
- When an HPA manages a Deployment, remove `spec.replicas` from the manifest in Git; otherwise every `kubectl apply` resets the replica count and the HPA and apply "fight".

> **On the exam:** If the task asks for an HPA with `behavior` or a memory metric, generate the base with `k autoscale … --dry-run=client -o yaml` and add the fields. An example of a complete `behavior` block is on the "Horizontal Pod Autoscaling" page on kubernetes.io.

### In-place Pod resize

Since v1.35, changing the CPU and memory of a running Pod without deleting it is **stable**. The change goes through the **`resize` subresource** (kubectl v1.32+):

```bash
k patch pod web --subresource resize --patch \
  '{"spec":{"containers":[{"name":"nginx","resources":{"requests":{"cpu":"300m"},"limits":{"cpu":"300m"}}}]}}'
k edit pod web --subresource resize

k get pod web -o jsonpath='{.status.containerStatuses[0].resources}'   # what is actually applied
k get pod web -o jsonpath='{.status.conditions}'                      # PodResizePending / PodResizeInProgress
```

The per-resource behavior is set by `resizePolicy` in the container:

```yaml
    resizePolicy:
    - resourceName: cpu
      restartPolicy: NotRequired        # default: no restart
    - resourceName: memory
      restartPolicy: RestartContainer   # the container restarts to apply the memory change
```

Limitations: only CPU and memory can be changed; **the QoS class must not change** (Guaranteed must keep requests = limits); requests/limits cannot be removed; it does not work for Windows Pods. If the node has no room, the Pod gets the `PodResizePending` condition with reason `Infeasible` (will never fit) or `Deferred` (maybe later). A plain `kubectl edit pod` without `--subresource resize` still rejects resource changes.

This does not apply to a Deployment automatically: changing `spec.template` creates a new rollout. In-place resize is a tool for individual Pods and for VPA.

### VPA in brief

The **VerticalPodAutoscaler** is not part of Kubernetes; it is installed from the `kubernetes/autoscaler` project (CRD + recommender, updater, admission controller). It recommends or sets requests based on usage history. Modes (`updateMode`) include `Off` (recommendation only), `Initial` (only when a Pod is created), `Recreate` (evict and recreate), and newer versions also have `InPlaceOrRecreate`. Do not combine VPA and HPA on the same CPU/memory metric.

## Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Pending, `Insufficient cpu` | The sum of requests exceeds allocatable | `k describe node node01` (Allocated resources), reduce requests |
| Pending, `didn't match Pod's node affinity/selector` | The label does not exist or is misspelled | `k get nodes --show-labels` |
| Pending, `untolerated taint` | A toleration is missing | `k describe node \| grep Taints` |
| Pending, `didn't match pod anti-affinity rules` | Not enough domains | Number of nodes vs number of replicas |
| Pending, `node(s) were unschedulable` | The node is cordoned | `k uncordon node01` |
| Deployment with 0 Pods, FailedCreate | ResourceQuota/LimitRange | `k describe rs`, `k describe quota` |
| `OOMKilled`, exit 137 | Memory limit too low | `k describe pod` (Last State) |
| HPA `<unknown>` | No metrics-server or no requests | `k top pods`, `k describe hpa` |

```bash
k get pods -A --field-selector=status.phase=Pending
k get events -A --field-selector reason=FailedScheduling
k -n kube-system logs kube-scheduler-controlplane | tail
```

> **On the exam:** If all new Pods are Pending without any `FailedScheduling` event, the scheduler may not be running. Check `k -n kube-system get pods` and the static Pod manifest `/etc/kubernetes/manifests/kube-scheduler.yaml` (more detail in the cluster troubleshooting module).

## Summary

- The scheduler filters, then scores; the Pending message in `k describe pod` says which filter rejected which node. `nodeName` bypasses the scheduler.
- Requests are for scheduling, limits for runtime (CPU throttling, memory OOMKilled); the QoS classes Guaranteed, Burstable, BestEffort determine eviction order.
- LimitRange (per container, injects defaults) and ResourceQuota (total per namespace) are enforced by admission; you see rejected Deployment Pods in `k describe rs`.
- nodeSelector and node affinity choose nodes by labels; pod (anti-)affinity and topologySpreadConstraints choose based on other Pods and the `topologyKey`.
- A taint repels, a toleration allows; NoExecute also evicts existing Pods (except within `tolerationSeconds`). The control-plane node has the `node-role.kubernetes.io/control-plane:NoSchedule` taint.
- PriorityClass and preemption let important Pods go first; `preemptionPolicy: Never` does not evict others.
- HPA `autoscaling/v2` requires metrics-server and requests; `k autoscale deployment web --min=2 --max=6 --cpu=70%`, and `behavior` controls the scaling speed.
- In-place resize is GA in v1.35 via `--subresource resize`, with `resizePolicy` and an unchangeable QoS class; VPA is a separate add-on.
