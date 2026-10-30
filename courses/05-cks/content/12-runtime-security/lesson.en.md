## What this module covers

The module covers four objectives from domain 6 (**Monitoring, Logging and Runtime Security**, 20% of the exam):

- **6.1** Perform behavioral analytics to detect malicious activities: **Falco** rules that recognize suspicious behavior.
- **6.2** Detect threats within physical infrastructure, apps, networks, data, users and workloads: typical detections (shell, sensitive files, network).
- **6.3** Investigate and identify phases of attack and bad actors: from a Falco alert to the Pod, the process and isolation.
- **6.4** Ensure immutability of containers at runtime: `readOnlyRootFilesystem`, no shell, immutable ConfigMap/Secret.

Typical exam tasks:

- "Falco reports that a shell was started in some container. Find the Pod, write `namespace/name` to `/opt/kurs/pod.txt` and scale its Deployment to 0."
- "Change a Falco rule so the output contains the time, user, container name and image. Alerts go to `/var/log/falco/alerts.log`."
- "Write a rule that detects reading `/etc/shadow` in containers."
- "Make the Deployment `web` immutable: read-only root filesystem, `/tmp` writable."
- "Find the Pods that aren't immutable (privileged, writable root FS) and delete them."

## Falco: architecture

**Falco** (a CNCF project) watches **system calls** (syscalls) on the node and compares them against rules. When a rule matches, it sends an alert. It doesn't block anything: Falco is a **detection** tool, not a prevention tool.

```text
 process in container ── syscall ──► kernel
                                      │  driver (modern eBPF or kmod) captures events
                                      ▼
                                 libscap / libsinsp  ── enrichment: container.*, k8s.* (container runtime socket)
                                      ▼
                                 rules engine (falco_rules.yaml + falco_rules.local.yaml + rules.d/)
                                      ▼
                                 outputs: stdout (journald), file, syslog, http, program
```

| Driver (`engine.kind`) | Description |
|---|---|
| `modern_ebpf` | Default; an eBPF program built into Falco (CO-RE), no need to compile it for the kernel. Used in the lab. |
| `kmod` | Kernel module; for older kernels without the required eBPF support |
| `nodriver`, `replay` | No syscall source (plugins only) or replay of a captured file |

In the lab, Falco runs as the systemd service `falco` on both nodes. Falco sees only the processes on **its own** node, so you look for an alert about a Pod on `node01` on `node01`.

```bash
systemctl status falco
journalctl -u falco -f                         # live alerts (stdout goes to journald)
journalctl -u falco --since "10 min ago" | grep -i shell
ls /etc/falco/                                 # falco.yaml, falco_rules.yaml, falco_rules.local.yaml, rules.d/
```

### Configuration: /etc/falco/falco.yaml

The most important keys:

```yaml
rules_files:                     # load order matters
  - /etc/falco/falco_rules.yaml
  - /etc/falco/falco_rules.local.yaml
  - /etc/falco/rules.d
engine:
  kind: modern_ebpf
watch_config_files: true         # rule/config change -> automatic reload
json_output: false               # true = all outputs in JSON
priority: debug                  # minimum priority of rules that get loaded
stdout_output:
  enabled: true
syslog_output:
  enabled: true
file_output:
  enabled: false
  keep_alive: false
  filename: ./events.txt
```

The task "alerts to a file in JSON format":

```yaml
json_output: true
file_output:
  enabled: true
  keep_alive: false
  filename: /var/log/falco/alerts.log
```

```bash
mkdir -p /var/log/falco
systemctl restart falco          # safer than relying on the automatic reload
journalctl -u falco -n 20        # check there are no loading errors
```

> **On the exam:** **don't change** `/etc/falco/falco_rules.yaml`. Changes go into `/etc/falco/falco_rules.local.yaml`, which is loaded afterwards and can override rules. After every change, look at `journalctl -u falco -n 30`: a YAML error or an unknown field leaves Falco without rules or stops it.

## Falco rules

A rules file is a YAML list with three kinds of elements: **rule**, **macro** and **list**.

```yaml
- list: my_shells
  items: [bash, sh, zsh, dash, ash, ksh]

- macro: in_container                 # same as the default macro "container"
  condition: (container.id != host)

- rule: Shell in container
  desc: Detects an interactive shell started in a container
  condition: >
    evt.type in (execve, execveat) and in_container
    and proc.name in (my_shells) and proc.tty != 0
  output: >
    Shell in container (user=%user.name container=%container.name id=%container.id
    image=%container.image.repository ns=%k8s.ns.name pod=%k8s.pod.name cmd=%proc.cmdline)
  priority: WARNING
  tags: [container, shell, mitre_execution]
```

| Key | Required | Meaning |
|---|---|---|
| `rule` | yes | Unique rule name |
| `desc` | yes | Description |
| `condition` | yes | Filter expression over the event |
| `output` | yes | Message; `%field` is replaced with the value |
| `priority` | yes | `EMERGENCY`, `ALERT`, `CRITICAL`, `ERROR`, `WARNING`, `NOTICE`, `INFORMATIONAL`, `DEBUG` |
| `tags` | no | Tags (e.g. MITRE techniques) |
| `enabled` | no | `false` disables the rule |
| `exceptions` | no | Structured exceptions |
| `source` | no | Event source; `syscall` by default |

A **macro** is a named, reusable part of a condition; a **list** is a named list of values. The default rules already define useful macros: `spawned_process` (a successful `execve`), `container`, `open_read`, `open_write`, `shell_procs`. Feel free to use them in your own rules.

With the default macros the same condition is shorter: `spawned_process and container and shell_procs and proc.tty != 0` (`spawned_process` also ensures that the `execve` succeeded).

### Fields you need to know

| Field | Example value |
|---|---|
| `evt.type` | `execve`, `openat`, `connect` |
| `proc.name` | `bash` (process name, at most 16 characters) |
| `proc.cmdline` | `bash -c cat /etc/shadow` |
| `proc.pname` | Parent process name, e.g. `runc` or `nginx` |
| `user.name` | `root` |
| `container.id` | First 12 characters of the container ID; `host` for processes on the host |
| `container.name` | Container name |
| `container.image.repository` | `docker.io/library/nginx` |
| `container.image.tag` | `1.27` |
| `k8s.ns.name` | `prod` |
| `k8s.pod.name` | `web-7d9c5-abcde` |
| `fd.name` | File path (`/etc/shadow`) or connection (`10.0.0.5:4444->1.2.3.4:443`) |
| `fd.sip`, `fd.sport` | Server IP and port for network connections |

List of fields on the machine: `falco --list`. Operators: `=`, `!=`, `in`, `startswith`, `endswith`, `contains`, `pmatch`, `and`, `or`, `not`.

### Changing existing rules: override

You change rules from `falco_rules.yaml` in `falco_rules.local.yaml` with an **`override`** block (the old key `append: true` is deprecated):

| Element | `append` allowed for | `replace` allowed for |
|---|---|---|
| list | `items` | `items` |
| macro | `condition` | `condition` |
| rule | `condition`, `output`, `desc`, `tags`, `exceptions` | `condition`, `output`, `desc`, `priority`, `tags`, `exceptions`, `enabled` … |

```yaml
# /etc/falco/falco_rules.local.yaml

# add a program to an existing list
- list: shell_binaries
  items: [busybox]
  override:
    items: append

# change the output and priority of an existing rule
- rule: Terminal shell in container
  output: >
    %evt.time,%user.name,%container.name,%container.image.repository,%k8s.ns.name,%k8s.pod.name
  priority: CRITICAL
  override:
    output: replace
    priority: replace

# narrow the condition: don't alert for the dev namespace
- rule: Terminal shell in container
  condition: and not k8s.ns.name = dev
  override:
    condition: append

# disable the rule
- rule: Read sensitive file untrusted
  enabled: false
  override:
    enabled: replace
```

With `condition: append` the text is appended to the end of the existing condition, which is why it starts with `and` or `or`. If the original condition has an `or` without parentheses, the addition binds differently than you expect.

Another way: copy the whole rule into `falco_rules.local.yaml` under the **same name** and change it. A rule loaded later replaces the earlier one. On the exam this is often the fastest and least error-prone approach.

> **On the exam:** a task like "the output must be in the format `time,user,container`" means exactly that: `%evt.time,%user.name,%container.name`, with no extra text. Find the rule with `grep -n "rule: Terminal shell" /etc/falco/falco_rules.yaml`, copy it into the local file and change only `output`.

## Typical detections

```yaml
# /etc/falco/falco_rules.local.yaml

- rule: Read shadow in container
  desc: Reading /etc/shadow inside a container
  condition: open_read and container and fd.name = /etc/shadow
  output: "shadow read (user=%user.name cmd=%proc.cmdline pod=%k8s.pod.name ns=%k8s.ns.name image=%container.image.repository)"
  priority: CRITICAL
  tags: [credential_access]

- rule: Write below etc in container
  desc: Write to /etc inside a container
  condition: open_write and container and fd.name startswith /etc/
  output: "Write to /etc (file=%fd.name cmd=%proc.cmdline pod=%k8s.pod.name ns=%k8s.ns.name)"
  priority: ERROR
  tags: [persistence]

- list: pkg_mgmt_bins
  items: [apt, apt-get, dpkg, yum, dnf, rpm, apk, pip, pip3, npm]

- rule: Package manager in container
  desc: Running a package manager in a container (the container changes at runtime)
  condition: spawned_process and container and proc.name in (pkg_mgmt_bins)
  output: "Package manager (cmd=%proc.cmdline container=%container.name pod=%k8s.pod.name)"
  priority: ERROR
  tags: [execution, immutability]

- rule: Outbound connection to unusual port
  desc: A container opens a connection to a port other than 80/443/53
  condition: >
    evt.type = connect and container
    and fd.typechar = 4 and not fd.sport in (80, 443, 53)
  output: "Outbound connection (conn=%fd.name cmd=%proc.cmdline pod=%k8s.pod.name)"
  priority: NOTICE
  tags: [command_and_control]
```

Testing the rules:

```bash
kubectl -n prod exec -it web-7d9c5-abcde -- sh -c 'cat /etc/shadow'
ssh node01 journalctl -u falco -n 5            # the Pod is on node01, so is the alert
```

| What the attacker does | Falco signal | Phase |
|---|---|---|
| `kubectl exec ... -- bash` | shell with a TTY in a container | Execution |
| `cat /etc/shadow`, reading the SA token | `open_read` of a sensitive file | Credential Access |
| `apt-get install nmap` | package manager | Execution / Discovery |
| Writing to `/etc/cron.d`, `/etc/passwd` | `open_write` below `/etc` | Persistence |
| `curl` to an unknown IP address | `connect` to an unusual port | Command and Control |
| `mount`, `nsenter` in a privileged container | process + syscall | Privilege Escalation |

## Investigating an attack

### Phases: MITRE ATT&CK for Containers

The **MITRE ATT&CK** matrix for containers groups techniques by tactic (the attacker's goal in that phase): **Initial Access** (a vulnerable application, stolen credentials), **Execution** (`exec` into a container, a new Pod), **Persistence** (a modified image, a CronJob), **Privilege Escalation** (a privileged container, hostPath, escape to the node), **Defense Evasion** (deleting logs, masquerading process names), **Credential Access** (ServiceAccount token, Secrets), **Discovery** (probing the API and the network), **Lateral Movement**, **Impact** (crypto miner, data destruction).

Falco `tags` in the default rules often carry MITRE labels (e.g. `mitre_execution`, `T1059`), so you can see from the alert right away which phase it is. The audit log (module 11) completes the picture from the API side.

### From alert to Pod

An alert in the journal:

```text
09:41:03.512: Warning Shell in container (user=root container=web id=4f1a2b3c4d5e
image=docker.io/library/nginx ns=prod pod=web-7d9c5-abcde cmd=bash)
```

If `k8s.pod.name` isn't in the output, you at least have `container.id`. You map it to a Pod with **crictl** on that node:

```bash
crictl ps --id 4f1a2b3c4d5e                     # container, name, POD ID
crictl inspect 4f1a2b3c4d5e | grep -E 'io.kubernetes.pod.(name|namespace)'
crictl inspect -o go-template --template '{{.info.pid}}' 4f1a2b3c4d5e   # PID on the host
crictl pods --id <pod-id>                       # Pod name and namespace
```

### The process on the node

Container processes are ordinary processes on the host, just in other namespaces.

```bash
PID=$(crictl inspect -o go-template --template '{{.info.pid}}' 4f1a2b3c4d5e)
ls -l /proc/$PID/exe                # which binary is running
cat /proc/$PID/cmdline | tr '\0' ' '
ls -l /proc/$PID/fd                 # open files and sockets
cat /proc/$PID/environ | tr '\0' '\n'   # environment (secrets?)
ls /proc/$PID/root/tmp              # the container filesystem as seen from the host

ps -ef --forest | grep -A3 $PID     # process tree
ss -tnp | grep "pid=$PID"           # the process's network connections
lsof -p $PID
strace -f -p $PID -e trace=network,file    # what the process is doing live (Ctrl+C to stop)
```

Example task: "A process is listening on port 6666. Find the Pod."

```bash
ss -tlnp | grep 6666                # users:(("nc",pid=48213,fd=3))
cat /proc/48213/cgroup              # contains the container ID
crictl ps | grep <first-12-characters>
```

### Containment: isolate, then remove

| Step | Command | Why |
|---|---|---|
| Isolate the network | A NetworkPolicy with no rules for a Pod labeled `quarantine=true` | Cuts off C2 and lateral movement, the Pod stays for forensics |
| Take the Pod out of the Service and the controller | `kubectl label pod X app-` | The Service no longer selects it, the ReplicaSet creates a replacement |
| Preserve evidence | `kubectl logs`, `crictl inspect`, a copy from `/proc/$PID/root` | Before deleting |
| Remove | `kubectl delete pod X` or `kubectl scale deploy Y --replicas=0` | Stop the attack |
| Fix the root cause | Image, RBAC, securityContext | Otherwise it comes back |

```bash
kubectl -n prod label pod web-7d9c5-abcde quarantine=true
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quarantine
  namespace: prod
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes: [Ingress, Egress]     # no ingress/egress rules = deny all
```

> **On the exam:** the task often says "delete the Pod" or "scale the Deployment that created it to 0". You find the owner with `kubectl -n prod get pod X -o jsonpath='{.metadata.ownerReferences[0].name}'` (that's the ReplicaSet; its owner is the Deployment). Don't delete other resources unnecessarily; the grader checks exactly the requested state.

## Container immutability

An **immutable** container doesn't change at runtime: no package installation, no changes to binaries or configuration. If a change is needed, a new image is built and a new deploy is done. An attacker who gets in can't easily leave behind a tool or a backdoor.

### readOnlyRootFilesystem + emptyDir

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: registry.internal:5000/nginx:1.27
        securityContext:
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          privileged: false
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache/nginx
        - name: run
          mountPath: /var/run
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
      - name: run
        emptyDir: {}
```

Verification:

```bash
kubectl -n prod exec deploy/web -- touch /etc/test     # touch: /etc/test: Read-only file system
kubectl -n prod exec deploy/web -- touch /tmp/test     # works
```

If the Pod crashes after enabling `readOnlyRootFilesystem`, look at `kubectl logs`: the application reports which path it can't write to (for nginx, `/var/cache/nginx` and `/var/run`). Add an `emptyDir` for each.

> **On the exam:** `readOnlyRootFilesystem` is a **container** field (`spec.containers[].securityContext`), not a Pod field. `kubectl explain pod.spec.containers.securityContext.readOnlyRootFilesystem` confirms the path. If you put it in `spec.securityContext`, `kubectl apply` reports an error (`unknown field`), and with `--validate=false` the field is silently ignored.

### What else breaks immutability

| Setting | Why it's a problem |
|---|---|
| `privileged: true` | Access to the host's devices and kernel; the container can modify the host |
| `readOnlyRootFilesystem` isn't `true` | The attacker writes tools and changes configuration |
| `hostPath` mounted writable | Changes on the node outlive the Pod |
| `runAsUser: 0` with a writable FS | Root can change anything in the container |
| Shell and package manager in the image | The attacker has tools right away (`sh`, `apt`) |

The task "find the Pods that aren't immutable":

```bash
kubectl -n prod get pods -o custom-columns='POD:.metadata.name,PRIV:.spec.containers[*].securityContext.privileged,RO:.spec.containers[*].securityContext.readOnlyRootFilesystem'
```

### Images without a shell and package manager

**Distroless** images (e.g. `gcr.io/distroless/static`, `gcr.io/distroless/base`) contain only the application and its runtime dependencies, without `sh`, `apt`, `curl`. `kubectl exec ... -- sh` then doesn't work, so for debugging you use an **ephemeral container**: `kubectl debug -it pod/web --image=busybox:1.36 --target=web`.

When the image has a shell and you can't change the image, there's a trick with a **startupProbe**: the probe deletes the shell from the container at startup.

```yaml
containers:
- name: app
  image: registry.internal:5000/app:1.0
  startupProbe:
    exec:
      command: ["rm", "-f", "/bin/sh", "/bin/bash"]
    initialDelaySeconds: 1
    periodSeconds: 5
```

This only works while the root FS isn't read-only and the container has permission to delete those files. It's a workaround; the real solution is an image without a shell.

### Immutable ConfigMap and Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: prod
data:
  LOG_LEVEL: info
immutable: true
```

- After `immutable: true`, the `data` and `binaryData` fields can't be changed, and `immutable` can't be set back to `false` either. A change means: delete and recreate (and restart the Pods).
- The kubelet doesn't have to watch such objects for changes, which reduces the load on the API server.
- An attacker with the `update` permission on a ConfigMap can't silently change the configuration the application reads.

## Troubleshooting

| Symptom | What to check |
|---|---|
| The Falco service crashes after a rule change | `journalctl -u falco -n 50`: YAML error, unknown macro or field, `append` to a nonexistent rule |
| The rule doesn't fire | Is the Pod on the node whose journal you're looking at; `priority` below the threshold in `falco.yaml`; condition too narrow (`proc.tty != 0` doesn't catch `exec` without `-t`) |
| The output doesn't have the Pod name | Add `%k8s.pod.name` and `%k8s.ns.name` to `output` |
| No alerts in the file | `file_output.enabled: true`, the directory exists, service restarted |
| The Pod crashes with `Read-only file system` | Add an `emptyDir` for the path the application writes to |
| You can't find the Pod for a `container.id` | `crictl ps --id` on the right node; the ID in the alert is truncated to 12 characters |

## Summary

- Falco captures syscalls (driver `modern_ebpf` or `kmod`), compares them against rules and sends alerts; it detects, it doesn't block.
- A rule has `rule`, `desc`, `condition`, `output`, `priority` (+ `tags`); macros and lists are reusable; fields `proc.*`, `user.name`, `container.*`, `k8s.*`, `fd.name`, `evt.type`.
- Local changes go into `/etc/falco/falco_rules.local.yaml`: `override` with `append`/`replace` or a copy of the rule under the same name; check with `journalctl -u falco`.
- Output: stdout (journald), `file_output`, `json_output: true`; you look for the alert on the node where the Pod is.
- Investigation: alert → `container.id` → `crictl ps/inspect` → Pod and PID → `/proc/<pid>`, `ss`, `strace`; MITRE tactics describe the attack phase.
- Containment: quarantine NetworkPolicy, removing the label, evidence, then deletion or scaling to 0.
- Immutability: `readOnlyRootFilesystem: true` + `emptyDir` for writable paths, no `privileged`, distroless images, immutable ConfigMap/Secret.
