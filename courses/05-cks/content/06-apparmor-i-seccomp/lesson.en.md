## What this module covers

The module covers objective **3.4 Appropriately use kernel hardening tools such as AppArmor, seccomp** from domain 3 (**System Hardening**, 10% of the exam).

Typical exam tasks:

- "On `node01` there is an AppArmor profile `/etc/apparmor.d/k8s-deny-write`. Load it in enforce mode and apply it to the container `writer` in the Pod `secure`."
- "Create a Pod that uses the seccomp profile `profiles/audit.json` from the node."
- "Enable `RuntimeDefault` seccomp for all containers of the Deployment `api`."
- "A Pod with an AppArmor profile doesn't start. Fix it."

The tasks are short but require precision: the exact profile name, the exact path, the profile loaded on the right node and the Pod on that node.

## Three layers of kernel protection

A container is an ordinary Linux process. When an attacker takes over the process, everything the process may ask of the kernel, the attacker may ask too. Three mechanisms narrow that from different angles:

| Mechanism | What it restricts | Example rule | Where it's set in the Pod |
|---|---|---|---|
| **Linux capabilities** | Privileges root normally has (e.g. `NET_ADMIN`, `SYS_ADMIN`) | `drop: [ALL]`, `add: [NET_BIND_SERVICE]` | `securityContext.capabilities` (container only) |
| **seccomp** | Which **system calls** (syscalls) the process may make | `mount`, `ptrace`, `unshare` → error | `securityContext.seccompProfile` |
| **AppArmor** | Which **resources** (files, network, capabilities) a program may access, by path | `deny /etc/** w,` | `securityContext.appArmorProfile` |

How they complement each other: capabilities say "root in the container may not change the network", seccomp says "this process may not call `mount` at all", and AppArmor says "it may write only to `/tmp`". For defense in depth you use all three.

Note: AppArmor works on Debian/Ubuntu/SUSE systems; on the RHEL family SELinux plays the same role (`securityContext.seLinuxOptions`). The lab and the exam use AppArmor.

## AppArmor

### Profiles and modes

An AppArmor **profile** is a text file (usually in `/etc/apparmor.d/`) describing what a program may do. A profile must be **loaded into the kernel** to work; the file on disk alone does nothing.

| Mode | Behavior |
|---|---|
| **enforce** | Forbidden actions are blocked and logged |
| **complain** | Nothing is blocked, violations are only logged (for profile development) |
| unconfined | The profile isn't applied |

An example profile that forbids all writing to files:

```text
#include <tunables/global>

profile k8s-deny-write flags=(attach_disconnected) {
  #include <abstractions/base>

  file,
  deny /** w,
}
```

The profile name is what comes after the word `profile` (`k8s-deny-write`), **not** the file name. The Pod refers to the profile name.

### Loading and checking on the node

The profile is loaded on the **node where the Pod runs**, not on `controlplane` if the Pod goes to `node01`.

```bash
ssh node01
cat /sys/module/apparmor/parameters/enabled          # Y = AppArmor enabled in the kernel
apparmor_parser -q /etc/apparmor.d/k8s-deny-write    # load the profile (enforce)
apparmor_parser -r /etc/apparmor.d/k8s-deny-write    # reload after a change
apparmor_parser -C /etc/apparmor.d/k8s-deny-write    # load in complain mode
aa-status | grep k8s-deny-write                      # is it loaded and in which mode
aa-status                                            # overview: enforce/complain profiles, processes
```

| Command | What it does |
|---|---|
| `apparmor_parser -q <file>` | Loads the profile, without extra output |
| `apparmor_parser -r <file>` | Replaces an already loaded profile (after editing the file) |
| `apparmor_parser -R <file>` | Removes the profile from the kernel |
| `apparmor_parser -C <file>` | Loads in complain mode |
| `aa-status` | Lists loaded profiles by mode and the processes under profiles |
| `aa-enforce` / `aa-complain <file>` | Switches the mode (apparmor-utils package) |

A loaded profile is lost after a reboot, unless the file is in `/etc/apparmor.d/` (the `apparmor` service loads it at boot).

> **On the exam:** check the profile name in the file itself: `grep -E '^\s*profile' /etc/apparmor.d/<file>`. If the file has no `profile` keyword, the name is the path written in the header (e.g. `/usr/bin/foo`). In the Pod you write exactly that name.

### Applying it in a Pod

Since version 1.30, AppArmor is configured with the **`securityContext.appArmorProfile`** field. The old annotations `container.apparmor.security.beta.kubernetes.io/<container>` are deprecated; on the exam (v1.35) use the field.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure
spec:
  nodeName: node01                  # the profile is loaded only on node01
  containers:
  - name: writer
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
    securityContext:
      appArmorProfile:
        type: Localhost
        localhostProfile: k8s-deny-write
```

| `type` | Meaning |
|---|---|
| `RuntimeDefault` | The container runtime's default profile (containerd loads it itself) |
| `Localhost` | A profile loaded on the node; the `localhostProfile` field with the profile name is required |
| `Unconfined` | No AppArmor |

`appArmorProfile` can go at the Pod level (`spec.securityContext`) and apply to all containers, or at the container level. If both are present, the container wins.

Quickly creating a Pod:

```bash
kubectl run secure --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > secure.yaml
# add nodeName/nodeSelector and securityContext.appArmorProfile
kubectl explain pod.spec.containers.securityContext.appArmorProfile
kubectl apply -f secure.yaml
```

Verifying the profile works:

```bash
kubectl exec secure -- cat /proc/1/attr/current     # k8s-deny-write (enforce)
kubectl exec secure -- touch /tmp/test              # touch: /tmp/test: Permission denied
```

### Where the Pod may run

The scheduler doesn't know which profiles are loaded on which node. You have two options:

1. Load the profile on **all** nodes the Pod can land on.
2. Label the nodes that have the profile and bind the Pod to them:

```bash
kubectl label node node01 apparmor/deny-write=loaded
```

```yaml
spec:
  nodeSelector:
    apparmor/deny-write: loaded
```

`nodeName` is the fastest way on the exam when the task says which node has the profile, but it bypasses the scheduler. For a Deployment use `nodeSelector`.

> **On the exam:** if you change a Deployment to use AppArmor, the field goes into `spec.template.spec.containers[].securityContext`, not into the Deployment's `spec`. `kubectl explain deployment.spec.template.spec.securityContext` confirms the path.

If the profile isn't loaded on the node, the container isn't created. The Pod stays in the Pending phase, and `kubectl describe pod` shows a `Failed` event with a message like `apparmor profile not found` (the exact text depends on the runtime).

## seccomp

### Profile types

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault        # or Localhost / Unconfined
```

| `type` | Meaning |
|---|---|
| `RuntimeDefault` | The container runtime's profile: blocks dangerous syscalls (e.g. `mount`, `kexec_load`, `reboot`), allows the usual ones |
| `Localhost` | Your own JSON profile from the node; `localhostProfile` is a path **relative** to `/var/lib/kubelet/seccomp/` |
| `Unconfined` | No seccomp |

Without configuration (and without `seccompDefault` in the kubelet), the container runs as **Unconfined**. A container with `privileged: true` always runs without seccomp, regardless of the profile.

Pod Security Admission (module 7): the **baseline** level forbids an explicit `Unconfined`, and **restricted** requires `RuntimeDefault` or `Localhost`.

### A Localhost profile

The file `/var/lib/kubelet/seccomp/profiles/audit.json` on `node01` is referenced like this:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: audit-pod
spec:
  nodeName: node01
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/audit.json    # NOT an absolute path
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
```

As with AppArmor, the profile must exist on the node where the Pod runs. If the file doesn't exist, the container isn't created (e.g. status `CreateContainerError`, with a seccomp profile error in the event).

### Structure of a JSON profile

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": ["read", "write", "openat", "close", "execve", "exit_group", "nanosleep", "futex"],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

- `defaultAction`: what happens to a syscall not listed in `syscalls`.
- `syscalls`: a list of groups with `names` and `action`; a rule for a specific syscall wins over `defaultAction`.

| Action | Effect |
|---|---|
| `SCMP_ACT_ALLOW` | Allow the syscall |
| `SCMP_ACT_ERRNO` | Deny; the process gets an error (e.g. `Operation not permitted`) |
| `SCMP_ACT_LOG` | Allow, but write to the kernel/audit log |
| `SCMP_ACT_KILL_PROCESS` | Kill the process |
| `SCMP_ACT_KILL` / `SCMP_ACT_KILL_THREAD` | Kill the thread that made the syscall |
| `SCMP_ACT_TRAP` | Send the SIGSYS signal |

Two patterns:

- **allowlist**: `defaultAction: SCMP_ACT_ERRNO` + a list of allowed syscalls. Most secure, but the list must be complete or the application breaks.
- **denylist**: `defaultAction: SCMP_ACT_ALLOW` + a list of forbidden ones (e.g. `mount`, `ptrace`, `unshare` with `SCMP_ACT_ERRNO`). Easier, but weaker.

The profile `{"defaultAction": "SCMP_ACT_ERRNO"}` without a list blocks everything, so the container can't even start (`CrashLoopBackOff` or a start error). The profile `{"defaultAction": "SCMP_ACT_LOG"}` blocks nothing, it only records; it is used to learn what the application calls.

> **On the exam:** before applying someone else's profile, read it: `cat /var/lib/kubelet/seccomp/profiles/x.json | jq .defaultAction`. If the task says "a profile that blocks X", check that X really is under `SCMP_ACT_ERRNO` and not `SCMP_ACT_LOG`.

### seccompDefault in the kubelet

Instead of every Pod specifying `RuntimeDefault`, the kubelet can do it itself (stable since 1.27). In `/var/lib/kubelet/config.yaml` on every node:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
seccompDefault: true
```

```bash
systemctl restart kubelet
journalctl -u kubelet --since "2 min ago" | tail     # check that the kubelet didn't crash
```

The `--seccomp-default` flag does the same. It applies only to Pods created after the change and only to containers that don't have their own `seccompProfile`. If an application breaks under `RuntimeDefault`, explicitly set a `Localhost` profile for it (or, as an exception, `Unconfined`).

### Testing seccomp

```bash
kubectl exec audit-pod -- grep Seccomp /proc/1/status
# Seccomp:        2        (0 = disabled, 2 = filter active)
```

For `RuntimeDefault`, a good test is a syscall that is blocked, e.g. `unshare`:

```bash
kubectl run sc-test --image=busybox:1.36 --overrides='{"spec":{"securityContext":{"seccompProfile":{"type":"RuntimeDefault"}}}}' -- sleep 3600
kubectl exec sc-test -- unshare -r true      # Operation not permitted
```

On the node, check what the runtime actually applies:

```bash
crictl ps --name app
crictl inspect <container-id> | grep -i -A3 seccomp
```

## Discovering the required syscalls

To write an allowlist profile, you need to know what the application calls. Three approaches:

**1. strace on the node** against the container's process:

```bash
ssh node01
crictl ps --name app                                   # container ID
crictl inspect <id> | grep -m1 '"pid"'                 # process PID on the host
strace -f -c -p <pid>                                  # Ctrl+C: table of syscalls and call counts
```

Or run the program itself under strace: `strace -f -c ls /` gives a table of the syscalls `ls` uses.

**2. `kubectl debug`** when you have no SSH or want a tool next to the container:

```bash
kubectl debug node/node01 -it --image=busybox:1.36          # a Pod on the node, host file system in /host
kubectl debug -it app-pod --image=busybox:1.36 --target=app --profile=sysadmin   # an ephemeral container in the app container's PID namespace
```

**3. A SCMP_ACT_LOG profile**: run the application with `{"defaultAction": "SCMP_ACT_LOG"}`, perform the typical actions and read the log on the node (`journalctl -k`, `/var/log/syslog` or `/var/log/audit/audit.log`, depending on the system). The records have `type=1326` and `syscall=<number>`.

For AppArmor the same job is done by `aa-genprof` and `aa-logprof` (they follow the application in complain mode and suggest rules), and you see denied actions in `dmesg` or `journalctl -k | grep apparmor` (`apparmor="DENIED"`).

> **On the exam:** you almost never write a profile from scratch on the exam. The profile is given; your job is to load it (AppArmor) or put it in the right folder (seccomp), apply it to the right container and prove it works. So practice paths and fields, not profile syntax.

## Troubleshooting

| Symptom | Cause and check |
|---|---|
| Pod Pending, event `apparmor profile not found` | The profile isn't loaded on that node (`aa-status` on the node), or the Pod has the file name instead of the profile name |
| The profile is loaded, but the Pod still doesn't start | The Pod was scheduled on another node; add `nodeSelector`/`nodeName` or load the profile everywhere |
| `localhostProfile` rejected or profile not found | An absolute path instead of one relative to `/var/lib/kubelet/seccomp/`; the file isn't on the Pod's node |
| The container crashes immediately (`CrashLoopBackOff`) after seccomp | The allowlist lacks a syscall the application needs; try `SCMP_ACT_LOG` and extend the list |
| `/proc/1/attr/current` says `unconfined` | The field is in the wrong place (e.g. in `metadata`), or the container is `privileged` |
| `Seccomp: 0` in the container | No profile: neither `seccompProfile` nor `seccompDefault` is set; or the container is `privileged` |
| A profile change has no effect | AppArmor: forgotten `apparmor_parser -r`; seccomp: the profile is read at container creation, so the Pod must be recreated |

## Summary

- Capabilities limit root privileges, seccomp limits syscalls, AppArmor limits resource access by path; use them together.
- An AppArmor profile is loaded on the node with `apparmor_parser -q` (change: `-r`) and checked with `aa-status`; enforce blocks, complain only logs.
- In the Pod: `securityContext.appArmorProfile` with `type: Localhost` and `localhostProfile: <profile name>` (or `RuntimeDefault`/`Unconfined`); the annotations are deprecated.
- The profile must be loaded on the node where the Pod runs; use `nodeSelector`/`nodeName` or load the profile on all nodes.
- seccomp: `securityContext.seccompProfile` with `RuntimeDefault` or `Localhost` and a path relative to `/var/lib/kubelet/seccomp/`.
- JSON profile: `defaultAction` + `syscalls[].names/action` (`SCMP_ACT_ALLOW`, `SCMP_ACT_ERRNO`, `SCMP_ACT_LOG`…); `seccompDefault: true` in the kubelet gives `RuntimeDefault` to everything without a profile.
- Verification: `/proc/1/attr/current` (AppArmor), `grep Seccomp /proc/1/status` (seccomp); you discover syscalls with `strace -c`, `kubectl debug` or `SCMP_ACT_LOG`.
