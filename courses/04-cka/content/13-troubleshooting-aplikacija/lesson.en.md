## What this module covers

The second part of the **Troubleshooting** domain (30% of the exam). Objectives:

- **5.3** monitoring cluster and application resource usage (**Monitor cluster and application resource usage**),
- **5.4** working with container output (**Manage and evaluate container output streams**), i.e. logs,
- **5.5** troubleshooting Services and networking (**Troubleshoot services and networking**).

Typical tasks:

- "Find the Pod with label `app=api` that uses the most CPU and write its name to `/opt/answer.txt`."
- "Save the logs of container `sidecar` from Pod `web` to a file" or "extract the lines containing `ERROR`".
- "The Pod is in CrashLoopBackOff. Fix it."
- "Service `web` does not respond. Fix it without changing the Deployment."

This is where points are lost to carelessness: the wrong namespace, logs of the current container instead of the previous one, the answer file on the wrong node. Write answers on the machine you are working the task from (usually the exam terminal, not `node01`), unless the task says otherwise.

## Resource usage: metrics-server and kubectl top

`kubectl top` reads the **Metrics API** (`metrics.k8s.io`), which is provided by **metrics-server**. It collects current CPU and memory from the kubelets every ~15 s. There is no history: that is what Prometheus is for.

Without metrics-server:

```bash
k top node
# error: Metrics API not available
```

In the lab, the manifest has already been downloaded:

```bash
k apply -f /opt/kurs/manifests/metrics-server.yaml
k -n kube-system get deploy metrics-server
k -n kube-system logs deploy/metrics-server | tail
```

In clusters like the lab (the kubelet has a self-signed serving certificate), metrics-server cannot verify the kubelet's TLS and the log says `x509: cannot validate certificate ... doesn't contain any IP SANs`. For the lab, it is enough to add the `--kubelet-insecure-tls` argument:

```bash
k -n kube-system patch deploy metrics-server --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
k get apiservice v1beta1.metrics.k8s.io     # AVAILABLE should be True
```

In production, the correct solution is for the kubelet to have a signed serving certificate (`serverTLSBootstrap`), not to disable verification.

### kubectl top

```bash
k top node
k top node --sort-by=cpu
k top pod -n prod --sort-by=memory
k top pod -A --sort-by=cpu | head -5
k top pod -l app=api --sort-by=cpu --no-headers | head -1
k top pod web --containers            # usage per container in the Pod
```

Units: CPU in millicores (`250m` = a quarter of a core), memory in `Mi`. `k top node` also shows the percentage relative to the node's **allocatable** capacity.

What `top` shows is **actual usage**. `requests` and `limits` (what is reserved) are seen elsewhere:

```bash
k describe node node01 | sed -n '/Allocated resources/,/Events/p'
k get pod web -o jsonpath='{.spec.containers[*].resources}'
```

Writing the answer to a file:

```bash
k top pod -n prod -l app=api --sort-by=cpu --no-headers | head -1 | awk '{print $1}' > /opt/answer.txt
cat /opt/answer.txt
```

> **On the exam:** `--sort-by` for `top` accepts only `cpu` or `memory`. If you have just installed metrics-server, wait a minute for it to collect the first data; `error: metrics not available yet` is not an installation error.

## Container logs

A container writes to **stdout** and **stderr**; containerd writes this to files on the node (`/var/log/pods/...`), and `kubectl logs` reads them through the kubelet. If the application writes only to a file inside the container, `kubectl logs` is empty. In that case you use a **sidecar** that runs `tail -f` on that file to its own stdout.

| Command | What it does |
|---|---|
| `k logs web` | Logs of a single-container Pod |
| `k logs web -c sidecar` | A specific container (required if there are several) |
| `k logs web --all-containers` | All containers of the Pod |
| `k logs web --previous` (`-p`) | The previous (crashed) container, key for CrashLoopBackOff |
| `k logs -f web` | Follow live |
| `k logs web --tail=50` | Last 50 lines |
| `k logs web --since=1h` / `--since-time=2026-10-15T10:00:00Z` | Time filter |
| `k logs web --timestamps` | Prefixes each line with a timestamp |
| `k logs -l app=web --prefix` | All Pods with the label, with the Pod name in front of each line |
| `k logs deploy/web` | One Pod of the Deployment (kubectl picks it) |
| `k logs job/backup` | Logs of the Job's Pod |

Two details:

- With a `-l` selector, `kubectl logs` by default shows only the **last 10 lines** per Pod and at most 5 concurrent streams (`--max-log-requests`). For all lines, add `--tail=-1`.
- If the Pod has several containers and you do not specify `-c`, kubectl takes the default container (the `kubectl.kubernetes.io/default-container` annotation or the first one) and prints a notice.

```bash
k logs web -c app --since=30m | grep -i error > /opt/web-errors.log
k logs web -c app --previous --tail=20
k get pod web -o jsonpath='{.spec.containers[*].name}'     # container names
```

A sidecar that exports a log file:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: legacy
spec:
  containers:
  - name: app
    image: busybox:1.37
    command: ["sh", "-c", "while true; do echo \"$(date) processing\" >> /var/log/app.log; sleep 5; done"]
    volumeMounts:
    - name: logs
      mountPath: /var/log
  - name: log-shipper
    image: busybox:1.37
    command: ["sh", "-c", "tail -n+1 -F /var/log/app.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log
  volumes:
  - name: logs
    emptyDir: {}
```

```bash
k logs legacy -c log-shipper
```

When the API server or kubelet is not working, you read logs directly on the node: `crictl logs <id>` or `/var/log/pods/<ns>_<pod>_<uid>/<container>/0.log`.

> **On the exam:** When the task says "save the logs to a file", redirect exactly what was asked for (container, number of lines, filter) and open the file to check that it is not empty. An empty file often means the wrong container or that `--previous` was needed.

## Pod states and how to diagnose them

Three commands solve most cases:

```bash
k describe pod web                         # Events at the bottom, container State/Last State
k events --for pod/web                     # only the events of that Pod
k get events -n prod --sort-by=.lastTimestamp
k get pod web -o yaml | sed -n '/status:/,$p'   # containerStatuses, reason, exitCode
```

| State (STATUS) | What it means | Where to look / typical cause |
|---|---|---|
| **Pending** | The Pod is not scheduled or is waiting | `describe`: `FailedScheduling` (insufficient CPU/memory for `requests`, a taint without a toleration, nodeSelector/affinity, PVC not bound). No event: the scheduler |
| **ContainerCreating** | Scheduled, the container is still being created | `FailedMount` (non-existent ConfigMap/Secret/PVC as a volume), CNI error, slow image pull |
| **ErrImagePull** / **ImagePullBackOff** | The image cannot be pulled | Wrong name or tag, private registry without `imagePullSecrets`. The message is in `describe` |
| **CreateContainerConfigError** | The container configuration cannot be assembled | `env`/`envFrom` references a non-existent ConfigMap/Secret or key; `runAsNonRoot` with an image that runs as root |
| **RunContainerError** / **StartError** | The runtime could not start the process | The command does not exist in the image (`executable file not found in $PATH`), bad mount |
| **CrashLoopBackOff** | The container starts and exits, the kubelet waits longer and longer before restarting it | `k logs --previous`, `Last State: Terminated`, `Exit Code`; a failing liveness probe |
| **OOMKilled** (reason) | The container exceeded its memory `limit` | `Last State: Terminated, Reason: OOMKilled, Exit Code: 137` → raise the limit or fix the application |
| **Completed** | The process finished with code 0 | Normal for a Job. In a Deployment it means the command is not long-running (the kubelet restarts it → CrashLoopBackOff) |
| **Error** | The process finished with a code ≠ 0 | Logs |
| **Terminating** | Deletion in progress | Takes long: node unreachable, finalizers, `terminationGracePeriodSeconds`. Last resort: `k delete pod web --grace-period=0 --force` |
| **Running**, but `READY 0/1` | The readiness probe is failing | `describe`: `Readiness probe failed`; the Pod is not in the Service's endpoints |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Successful completion |
| `1` | General application error (see the logs) |
| `126` | The command exists but is not executable |
| `127` | Command not found (shell, e.g. `sh -c "ngnix"`) |
| `137` | 128 + 9 = **SIGKILL**: OOMKilled or killed after the grace period expired (e.g. liveness probe) |
| `143` | 128 + 15 = **SIGTERM**: stopped gracefully |

For code `137`, the `reason` field makes the difference: `OOMKilled` means the memory limit, while `Error` together with a liveness probe means the kubelet killed it.

```bash
k get pod web -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
# {"exitCode":137,"reason":"OOMKilled",...}
```

### Fixing

Most Pod fields are immutable. For a Pod that is not managed by a controller:

```bash
k get pod web -o yaml > web.yaml
vim web.yaml                   # fix image, command, resources...
k replace --force -f web.yaml  # deletes and recreates it
```

For a Deployment, change the Deployment (`k edit deploy`, `k set image deploy/web app=nginx:1.27`, `k set resources deploy/web -c app --limits=memory=256Mi`). The controller would overwrite changes made to the Pod anyway.

> **On the exam:** With CrashLoopBackOff, the current container usually has no useful logs. First `k logs <pod> --previous`, then `k describe pod` (`Last State`, `Exit Code`, `Reason`). Only then change the manifest.

## kubectl exec, debug and port-forward

```bash
k exec -it web -- sh                     # shell in the container (if the image has a shell)
k exec web -c app -- cat /etc/nginx/conf.d/default.conf
k exec web -- env
```

Many images (distroless) have neither a shell nor tools. This is where an **ephemeral container** helps: a temporary container added to an existing Pod without a restart.

```bash
k debug -it web --image=busybox:1.37 --target=app     # shares the process namespace with container app
# in the debug container: ps, wget, nslookup, ls /proc/1/root/...
```

A copy of the Pod for experiments (the original stays untouched):

```bash
k debug web -it --copy-to=web-debug --container=app -- sh            # change the command in the copy
k debug web --copy-to=web-debug --set-image=app=nginx:1.27           # a different image in the copy
```

Debugging a node without SSH: a Pod in the host namespaces, with the node's file system mounted at `/host`.

```bash
k debug node/node01 -it --image=busybox:1.37
# chroot /host     then e.g. cat /var/lib/kubelet/config.yaml
k get pods | grep node-debugger       # delete the Pod when you are done
```

An ephemeral container cannot be removed from a Pod; it disappears when the Pod is deleted.

**port-forward** tunnels a local port to a Pod through the API server and the kubelet. Traffic goes directly into the Pod, bypassing kube-proxy, so it is a quick way to check whether the application itself responds. Even `svc/web` does not go through the ClusterIP: kubectl just picks one Pod behind the Service.

```bash
k port-forward pod/web 8080:80 &
curl -s localhost:8080
k port-forward svc/web 8080:80        # tunnel to one Pod behind the Service
```

## Troubleshooting Services and networking

A Service forwards traffic to the Pods whose labels match `spec.selector`, on `targetPort`, and only to those that are **Ready**. The chain to check, in order:

1. Are the Pods running and Ready?
2. Does the Service selector match the Pod labels → do endpoints exist?
3. Does `targetPort` match the port the application actually listens on?
4. Does the Service DNS name resolve?
5. Is a NetworkPolicy not blocking traffic?
6. Is kube-proxy running on the node?

```bash
k get svc web -o wide                       # SELECTOR, PORT(S)
k get pods -l app=web --show-labels -o wide
k get endpointslices -l kubernetes.io/service-name=web
k describe svc web                          # Endpoints: <none> is the main clue
```

**EndpointSlice** (`discovery.k8s.io/v1`) is the replacement for the old Endpoints object. The Endpoints API is **deprecated since v1.33**: `k get endpoints` still works, but prints a warning. `k describe svc` still shows the addresses in the `Endpoints:` line.

### Most common causes

| Symptom | Cause | Fix |
|---|---|---|
| `Endpoints: <none>`, Pods are running | `selector` does not match the labels (`app: web` vs `app: web-app`) | `k edit svc web` and fix the selector (or the Pod label, if the task asks for that) |
| Endpoints exist, `connection refused` | Wrong `targetPort` (e.g. 8080 instead of 80) | Fix `targetPort` or use a named port (`targetPort: http`) |
| Endpoints empty, Pods `0/1 READY` | The readiness probe is failing | `k describe pod`; fix the probe (port, path) or the application |
| The Service IP works, the name does not (`bad address`) | CoreDNS is not working, or wrong name/namespace | `k -n kube-system get pods -l k8s-app=kube-dns`, CoreDNS logs, the full name `web.prod.svc.cluster.local` |
| Timeout from one namespace, works from another | NetworkPolicy | `k get netpol -A`, check `podSelector` and `ingress.from` |
| Nothing works even via the ClusterIP, although the Pod IP works | kube-proxy | `k -n kube-system get ds kube-proxy`, logs |
| NodePort does not respond from outside | Wrong port (30000–32767), firewall, `externalTrafficPolicy: Local` with no Pod on that node | `k get svc`, curl to `<nodeIP>:<nodePort>` from a node |

Quick comparison of selector and labels:

```bash
k get svc web -o jsonpath='{.spec.selector}'; echo
k get pods --show-labels | grep web
k get pods -l "$(k get svc web -o jsonpath='{.spec.selector}' | tr -d '{}"' | tr ':' '=')"
```

### Testing from a temporary Pod

The most reliable test is from inside the cluster, from a Pod that deletes itself:

```bash
k run tmp --rm -it --restart=Never --image=busybox:1.37 -- sh
# in the Pod:
nslookup web
nslookup web.prod.svc.cluster.local
wget -qO- -T 2 http://web:80
wget -qO- -T 2 http://10.244.1.5:80        # directly to the Pod IP, bypasses the Service
cat /etc/resolv.conf
```

Or as a single command, useful for writing out the result:

```bash
k run tmp --rm -i --restart=Never --image=busybox:1.37 -- wget -qO- -T 2 http://web.prod
k run tmp -n prod --rm -it --restart=Never --image=busybox:1.37 -- nslookup web
```

Interpretation:

- Pod IP works, ClusterIP does not → the Service (selector, targetPort) or kube-proxy.
- ClusterIP works, the name does not → DNS.
- Nothing works only from a particular namespace or from Pods with a particular label → NetworkPolicy (test from a Pod with the same labels and namespace as the real client: `k run tmp -n frontend --labels=app=frontend ...`).

> **On the exam:** "Service does not work" tasks usually have one deliberately injected fault. `k describe svc` + `k get pods --show-labels` reveal it in 20 seconds in 90% of cases: empty endpoints, a wrong targetPort, or Pods that are not Ready.

### Example: a complete diagnosis

```bash
k -n shop get svc api
# api   ClusterIP   10.96.40.12   <none>   80/TCP
k -n shop describe svc api | grep -E 'Selector|TargetPort|Endpoints'
# Selector:   app=api-server
# TargetPort: 8080/TCP
# Endpoints:  <none>
k -n shop get pods --show-labels
# api-7d9c...   1/1   Running   app=api,pod-template-hash=7d9c...
k -n shop patch svc api -p '{"spec":{"selector":{"app":"api"}}}'
k -n shop get endpointslices -l kubernetes.io/service-name=api
k -n shop run tmp --rm -it --restart=Never --image=busybox:1.37 -- wget -qO- -T 2 http://api
```

If `wget` still returns `connection refused` after that, check the port the container listens on (`k get pod ... -o jsonpath='{.spec.containers[0].ports}'`, or `k exec ... -- netstat -tln` if available) and align `targetPort` with it.

## Summary

- `kubectl top node|pod` requires metrics-server; `--sort-by=cpu|memory`, `--containers`, `-l`, `-A`. Top shows usage, while `requests`/`limits` are seen in `describe node` and in the Pod spec.
- `kubectl logs`: `-c` for the container, `--previous` for the crashed container, `-f`, `--tail`, `--since`, `-l` (only 10 lines per Pod without `--tail=-1`), `--all-containers`.
- You read the Pod state from `describe` (Events, Last State, Exit Code, Reason), `k events --for` and the status in `-o yaml`.
- Exit 137 = SIGKILL (OOMKilled or liveness), 1 = application error, 127 = command does not exist, 143 = SIGTERM.
- `kubectl debug` adds an ephemeral container (`--target`), creates a copy of the Pod (`--copy-to`), or a Pod on a node (`node/<name>`, file system at `/host`).
- Service without endpoints = selector or readiness; endpoints exist but the connection is refused = targetPort; the name does not work = DNS; works only from some places = NetworkPolicy.
- Test from a temporary Pod: `k run tmp --rm -it --restart=Never --image=busybox:1.37 -- sh`, then `nslookup` and `wget`.
