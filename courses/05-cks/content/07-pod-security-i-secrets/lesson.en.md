## What this module covers

The module covers two objectives from domain 4 (**Minimize Microservice Vulnerabilities**, 20% of the exam):

- **4.1 Use appropriate pod security standards**: the **Pod Security Standards** levels, **Pod Security Admission** (labels on the namespace) and a `securityContext` that makes a Pod compliant.
- **4.2 Manage Kubernetes secrets**: who can read a **Secret**, how to read it from etcd, **EncryptionConfiguration** (encryption at rest) and using Secrets properly in a Pod.

Typical exam tasks:

- "The namespace `team-a` must reject Pods that don't meet the `baseline` level, and warn about `restricted`."
- "The Deployment `api` in the `secure` namespace doesn't create Pods. Fix it so it passes the `restricted` policy."
- "Read the Secret `db-creds` directly from etcd and write the password to `/root/pass.txt`."
- "Enable encryption at rest for Secrets with `aescbc`; the key is given. All existing Secrets must be encrypted."
- "A Pod uses a Secret through env variables. Move it to a read-only volume."

You know RBAC and static Pods from the CKA. Here you use them with a security goal: the control plane must reject dangerous Pods, and secrets must not sit around in readable form.

## Pod Security Standards: three levels

The **Pod Security Standards** (PSS) are three predefined sets of rules. They aren't objects in the cluster, but a document describing what is allowed. They are enforced by the built-in **PodSecurity** admission plugin (see below).

| Level | Purpose | In short |
|---|---|---|
| **privileged** | System components (CNI, CSI, kube-proxy, monitoring agents) | No restrictions |
| **baseline** | Ordinary applications, minimal protection | Forbids known escalations: host namespaces, privileged, hostPath, hostPort, dangerous capabilities |
| **restricted** | Sensitive applications, best practice | Everything from baseline plus: non-root, no privilege escalation, drop ALL, mandatory seccomp, limited volume types |

### What baseline forbids

- `spec.hostNetwork`, `spec.hostPID`, `spec.hostIPC` set to `true`.
- `securityContext.privileged: true`.
- `capabilities.add` outside the safe list (`AUDIT_WRITE`, `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `FSETID`, `KILL`, `MKNOD`, `NET_BIND_SERVICE`, `SETFCAP`, `SETGID`, `SETPCAP`, `SETUID`, `SYS_CHROOT`). So `NET_ADMIN` or `SYS_ADMIN` fail.
- **hostPath** volumes and `hostPort` (other than 0).
- `seccompProfile.type: Unconfined` and AppArmor `Unconfined` (`RuntimeDefault` and `Localhost` are allowed, or unset).
- `procMount` other than `Default`, unsafe `sysctls`, custom SELinux user/role values.

### What restricted additionally requires

| Control | Field | Allowed |
|---|---|---|
| Volume types | `spec.volumes[*]` | Only `configMap`, `csi`, `downwardAPI`, `emptyDir`, `ephemeral`, `persistentVolumeClaim`, `projected`, `secret` |
| Privilege escalation | `containers[*].securityContext.allowPrivilegeEscalation` | Must be `false` (explicitly) |
| Non-root | `runAsNonRoot` (Pod or each container) | `true` |
| Non-root UID | `runAsUser` | Unset or other than 0 |
| Seccomp | `seccompProfile.type` | `RuntimeDefault` or `Localhost`; **omitting it is not allowed** |
| Capabilities | `capabilities.drop` / `add` | `drop` must contain `ALL`; `add` may only be `NET_BIND_SERVICE` |

Important traps:

- With restricted, `allowPrivilegeEscalation` must be **explicitly** `false`. Unset doesn't pass.
- `seccompProfile` can be set at the Pod level (`spec.securityContext`) and then applies to all containers.
- `runAsNonRoot` at the Pod level covers all containers. `capabilities` and `allowPrivilegeEscalation` exist **only** at the container level.
- The rules also apply to `initContainers` and `ephemeralContainers`. A forgotten init container is a common reason for rejection.

## securityContext: fields you must know by heart

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened
spec:
  securityContext:              # Pod level
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: nginxinc/nginx-unprivileged:1.27
    securityContext:            # container level
      allowPrivilegeEscalation: false
      privileged: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
```

| Field | What it does | Note |
|---|---|---|
| `runAsNonRoot: true` | The kubelet refuses to start the container if the process would run as UID 0 | If the image has `USER root` or no `USER`, and `runAsUser` isn't set, the container doesn't start |
| `runAsUser` / `runAsGroup` | UID/GID of the process, overrides `USER` from the image | The container level overrides the Pod level |
| `fsGroup` | Owning group of mounted volumes | Pod level only |
| `allowPrivilegeEscalation: false` | Sets `no_new_privs`; setuid binaries can't raise privileges | Always `true` if `privileged: true` or `CAP_SYS_ADMIN` is present |
| `privileged: true` | The container gets almost everything the host has (all devices, all capabilities) | Practically root on the node |
| `capabilities.drop: ["ALL"]` | Removes all Linux capabilities | If needed, add back just one (`add: ["NET_BIND_SERVICE"]`) |
| `readOnlyRootFilesystem: true` | The container's root FS is read-only | For writes, add an `emptyDir` at `/tmp` or a similar path |
| `seccompProfile.type` | `RuntimeDefault`, `Localhost` (+ `localhostProfile`), `Unconfined` | Details in the AppArmor and seccomp module |

When `runAsNonRoot` blocks the start, the Pod has the state `CreateContainerConfigError`, and the event says something like `container has runAsNonRoot and image will run as root`. The fix is `runAsUser` with a non-zero UID or an image with a non-root `USER`.

```bash
kubectl explain pod.spec.securityContext
kubectl explain pod.spec.containers.securityContext.capabilities
kubectl exec hardened -- id                      # uid=10001 gid=10001
kubectl exec hardened -- touch /test             # Read-only file system
kubectl exec hardened -- grep -E 'NoNewPrivs|CapEff' /proc/1/status
```

> **On the exam:** create a Pod skeleton imperatively (`kubectl run app --image=nginx --dry-run=client -o yaml > pod.yaml`), then add the `securityContext`. Copy the fields from the page "Configure a Security Context for a Pod or Container" (kubernetes.io/docs/tasks/configure-pod-container/security-context/). Watch the level: `capabilities` doesn't exist at the Pod level and `kubectl apply` will reject it as an unknown field.

## Pod Security Admission

**Pod Security Admission** (PSA) is the built-in `PodSecurity` admission controller, GA since v1.25 and enabled by default. It is configured with **labels on the namespace**:

```text
pod-security.kubernetes.io/<MODE>: <LEVEL>
pod-security.kubernetes.io/<MODE>-version: <VERSION>
```

- `MODE`: `enforce`, `audit`, `warn`
- `LEVEL`: `privileged`, `baseline`, `restricted`
- `VERSION`: `latest` or a Kubernetes minor version, e.g. `v1.35` (if omitted, `latest` applies)

| Mode | Effect on violation | What it applies to |
|---|---|---|
| **enforce** | The Pod is **rejected** | Only Pod objects |
| **audit** | Adds an annotation to the audit log event; the request goes through | Pods and workload resources (Deployment, Job…) |
| **warn** | The user gets a warning in the terminal; the request goes through | Pods and workload resources |

The key trap: **enforce doesn't look at Deployments**. A Deployment with a bad template will be created without error, but the ReplicaSet won't be able to create Pods. That is why `enforce` is almost always combined with `warn` at the same level, so you see the problem immediately.

```bash
kubectl label ns team-a \
  pod-security.kubernetes.io/enforce=baseline \
  pod-security.kubernetes.io/enforce-version=v1.35 \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted

kubectl get ns team-a --show-labels
```

The same declaratively:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/enforce-version: v1.35
    pod-security.kubernetes.io/warn: restricted
```

Attempting a privileged Pod in that namespace:

```bash
kubectl -n team-a run bad --image=nginx --privileged
# Error from server (Forbidden): pods "bad" is forbidden:
#   violates PodSecurity "baseline:v1.35": privileged (container "bad" must not set securityContext.privileged=true)
```

The message lists exactly what needs fixing, so read it carefully instead of guessing.

### Checking before rollout

Before you set `enforce` on a namespace with existing Pods, see who would fail. A server-side dry run changes nothing, but returns warnings for existing Pods:

```bash
kubectl label --dry-run=server --overwrite ns team-a \
  pod-security.kubernetes.io/enforce=restricted
```

Existing Pods are **not shut down** when you set `enforce`. The rule applies to new Pods (and to Pods a controller recreates).

### A Deployment that doesn't create Pods

```bash
kubectl -n secure get deploy api            # READY 0/2
kubectl -n secure get rs                    # DESIRED 2, CURRENT 0
kubectl -n secure describe rs -l app=api | tail
# Warning  FailedCreate  ... violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false ...
kubectl -n secure get events --field-selector reason=FailedCreate
```

You fix the Deployment's template (`kubectl -n secure edit deploy api`), not the ReplicaSet.

### AdmissionConfiguration: defaults and exemptions

A namespace without labels gets the default value `privileged` for all three modes. You can change that for the whole cluster with a file kube-apiserver reads via `--admission-control-config-file`:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
- name: PodSecurity
  configuration:
    apiVersion: pod-security.admission.config.k8s.io/v1
    kind: PodSecurityConfiguration
    defaults:
      enforce: "baseline"
      enforce-version: "latest"
      audit: "restricted"
      audit-version: "latest"
      warn: "restricted"
      warn-version: "latest"
    exemptions:
      usernames: []
      runtimeClasses: []
      namespaces: ["kube-system"]
```

- Labels on the namespace take precedence over `defaults`.
- **Exemptions** skip the check completely: by user name, by RuntimeClass name and by namespace.
- Don't exempt controller service accounts (e.g. `system:serviceaccount:kube-system:replicaset-controller`): that would exempt anyone allowed to create a Deployment.
- The file is mounted into the kube-apiserver static Pod as a `hostPath` volume, the same as the audit policy or EncryptionConfiguration. If the file already exists (e.g. because of ImagePolicyWebhook), you add the new plugin to the same `plugins` list.

> **On the exam:** for namespace tasks you don't need an AdmissionConfiguration; `kubectl label ns` is enough. Watch the exact spelling of the label: `pod-security.kubernetes.io/enforce`, not `podsecurity` or `pod-security.kubernetes.io/enforced`. A wrong label is silently accepted and does nothing.

## Secrets: what they really protect

A **Secret** is an object with a `data` field in which the values are **base64** encoded. Base64 is encoding, not encryption:

```bash
kubectl -n app create secret generic db-creds \
  --from-literal=user=admin --from-literal=password='S3cr3t!'
kubectl -n app get secret db-creds -o jsonpath='{.data.password}' | base64 -d
# S3cr3t!
```

Protecting Secrets depends on three layers:

1. **RBAC**: who may `get`/`list`/`watch` Secrets through the API.
2. **Encryption at rest**: what is written in etcd.
3. **How the Pod uses it**: env or volume, who has access to the node.

### Who can read a Secret

| Path | Example | Why it is dangerous |
|---|---|---|
| `get secrets` | A Role with `verbs: [get]` | Direct reading |
| `list secrets` | `verbs: [list]` | `list` returns **whole objects with values**, not just names |
| `watch secrets` | `verbs: [watch]` | Same as list, through a stream |
| `create pods` in the namespace | A developer allowed to create Pods | Can mount **any** Secret from that namespace into their Pod and print it |
| `create pods/exec` | Exec into a Pod that already has the Secret | Reads the mounted file or env |
| Node access (root) | SSH to `node01` | Secrets of the node's Pods are in tmpfs under `/var/lib/kubelet/pods/` |
| etcd access | Certificates from `/etc/kubernetes/pki/etcd/` | Without encryption, everything is readable |

```bash
kubectl auth can-i list secrets -n app --as=system:serviceaccount:app:default
kubectl auth can-i create pods -n app --as=jane
kubectl get rolebindings,clusterrolebindings -A -o wide | grep -i secret
```

That is why the right to `create pods` in a namespace practically also means reading all Secrets in it. Keep sensitive Secrets in a namespace where developers don't create Pods.

### Reading a Secret directly from etcd

On the `controlplane` node, with the certificates from the kubeadm installation:

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/app/db-creds | hexdump -C | head -20
```

The key has the form `/registry/secrets/<namespace>/<name>`. Without encryption you see `S3cr3t!` as plain text in the output (values are stored in etcd in binary protobuf format, not base64). Always check the certificate paths in `/etc/kubernetes/manifests/etcd.yaml` or `kube-apiserver.yaml` (the flags `--etcd-cafile`, `--etcd-certfile`, `--etcd-keyfile`).

> **On the exam:** if the task asks you to "read the Secret from etcd", `etcdctl get … --print-value-only` and looking for the value in the output is enough. When the Secret isn't encrypted, the password is visible right away. Don't forget `--endpoints` if etcd doesn't listen on the default address.

## Encryption at rest: EncryptionConfiguration

kube-apiserver can encrypt resources before writing them to etcd. The configuration is a file of type **EncryptionConfiguration** passed with the `--encryption-provider-config` flag.

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64 of 32 random bytes>
  - identity: {}
```

You generate the key like this:

```bash
head -c 32 /dev/urandom | base64
```

### Providers

| Provider | What it is | Note |
|---|---|---|
| `identity` | No encryption, plain text | The default behavior without configuration |
| `aescbc` | AES-CBC with PKCS#7 padding, 32-byte key | Common on the exam; the documentation doesn't recommend it for new systems because of padding oracle attacks |
| `aesgcm` | AES-GCM | Fast, but the key must be rotated often |
| `secretbox` | XSalsa20 + Poly1305, 32-byte key | A modern local provider |
| `kms` (`apiVersion: v2`) | Envelope encryption: the data key is encrypted by an external KMS | Recommended for production; KMS v2 is GA since v1.29, KMS v1 is deprecated and disabled by default |

With local providers (`aescbc`, `aesgcm`, `secretbox`) the key sits in a file on the control plane node. Whoever has root on `controlplane` has the key too. KMS solves exactly that: the key stays in an external service (Vault, cloud KMS).

```yaml
providers:
- kms:
    apiVersion: v2
    name: vault-kms
    endpoint: unix:///var/run/kmsplugin/socket.sock
    timeout: 3s
- identity: {}
```

### Provider order: the most important rule

- **The first provider in the list is used for writing.** Within it, the first key encrypts.
- When reading, providers (and keys) are tried in order until one succeeds.
- If `identity: {}` is **first**, new Secrets are written unencrypted, even though `aescbc` is in the list.
- `identity` at the end of the list lets the API server read old, still unencrypted Secrets.

### Enabling it on a kubeadm cluster, step by step

```bash
# 1) the file on the controlplane node
mkdir -p /etc/kubernetes/enc
vim /etc/kubernetes/enc/enc.yaml        # content as above, key from head -c 32 /dev/urandom | base64

# 2) back up the manifest, then edit
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

In the manifest, add the flag, a volumeMount and a volume:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --encryption-provider-config=/etc/kubernetes/enc/enc.yaml
    # ... other flags
    volumeMounts:
    - name: enc
      mountPath: /etc/kubernetes/enc
      readOnly: true
  volumes:
  - name: enc
    hostPath:
      path: /etc/kubernetes/enc
      type: DirectoryOrCreate
```

```bash
# 3) wait for the static Pod to restart
watch crictl ps --name kube-apiserver
kubectl get --raw=/readyz

# 4) rewrite all existing Secrets (now they get encrypted)
kubectl get secrets -A -o json | kubectl replace -f -

# 5) verify in etcd
ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/app/db-creds | hexdump -C | head
# ... k8s:enc:aescbc:v1:key1: ... (followed by unreadable bytes)
```

The prefix `k8s:enc:<provider>:v1:<key name>` proves the record is encrypted (for aescbc: `k8s:enc:aescbc:v1:key1`). If you still see the password as text, the Secret wasn't rewritten or `identity` is first in the list.

Encryption applies only to **new writes**. That is why step 4 is mandatory: `kubectl replace` reads every Secret and writes it back, so the API server uses the first provider. The command is safe to repeat. If it reports a conflict due to a concurrent change, just run it again.

### Key rotation and disabling

1. Add the new key as the **second** in `keys` and restart all API servers (all must be able to decrypt with the new key).
2. Move the new key to the **first** position and restart again.
3. `kubectl get secrets -A -o json | kubectl replace -f -`.
4. Remove the old key.

To disable encryption, put `identity: {}` in first position (the old provider stays behind it), `replace` all Secrets, and only then remove the configuration.

> **On the exam:** when kube-apiserver doesn't start after the change, look at the container logs: `crictl ps -a | grep apiserver`, then `crictl logs <id>`, or `/var/log/pods/kube-system_kube-apiserver-*/`. The most common errors: the path in the flag doesn't match `mountPath`, the key isn't base64 of 32 bytes, wrong YAML indentation.

## A Secret in a Pod: volume or env

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
  namespace: app
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sleep", "3600"]
    volumeMounts:
    - name: creds
      mountPath: /etc/creds
      readOnly: true
  volumes:
  - name: creds
    secret:
      secretName: db-creds
      defaultMode: 0400
```

| | Env variables (`env.valueFrom.secretKeyRef`, `envFrom`) | Volume (`volumes[].secret`) |
|---|---|---|
| Where the value lives | In the process environment (`/proc/<pid>/environ`) | A file in tmpfs (memory, not disk) |
| Leakage | Easy: logs, crash dumps, child processes, `env` in a debug session, `crictl inspect` | Harder; the file is read only by whoever opens it |
| Updates | Doesn't change until the Pod restarts | The kubelet refreshes the contents (except with `subPath`) |
| Permissions | None | `defaultMode`, `readOnly: true` |

A volume is the better choice. Static analysis tools (e.g. kubesec) flag env from Secrets as a risk.

Additional measures:

- `immutable: true` on a Secret prevents changes (and reduces API server load); to change it you must delete and recreate it.
- `automountServiceAccountToken: false` for Pods that don't need an API token (details in the ServiceAccount module).
- Don't keep secrets in ConfigMaps, annotations or the image.

### External secret managers (in brief)

In production, secrets are often kept outside Kubernetes:

- **HashiCorp Vault** (Agent injector or CSI provider),
- **Secrets Store CSI Driver** with cloud providers (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager): the secret is mounted as a CSI volume,
- **External Secrets Operator**: syncs an external secret into an ordinary Secret.

You don't configure these on the exam, but you should know they provide central rotation and access auditing, and that the encryption key doesn't sit on the control plane node.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `Error from server (Forbidden) ... violates PodSecurity` | Read the list of violations in the message; complete the `securityContext` for **all** containers, including init |
| Deployment 0/N, no Pods | `kubectl describe rs`, `kubectl get events`: `FailedCreate` with a PodSecurity message |
| `CreateContainerConfigError` | `runAsNonRoot: true`, but the image runs as root; add `runAsUser` or use a non-root image |
| The container crashes with `Read-only file system` | `readOnlyRootFilesystem: true`; add an `emptyDir` for `/tmp`, `/var/cache/nginx`, `/var/run` |
| A PSA label "doesn't work" | Spelling of the key and value (`kubectl get ns X --show-labels`); an exemption in AdmissionConfiguration |
| kube-apiserver doesn't start after EncryptionConfiguration | `crictl logs`, the mount path, key length, YAML |
| Still plain text in etcd | Is `identity` first? Did you skip `kubectl get secrets -A -o json \| kubectl replace -f -`? |
| Pod `ContainerCreating`, "secret not found" | The Secret is in another namespace or the key name is wrong; Secrets aren't shared between namespaces |

> **On the exam:** after every change to `kube-apiserver.yaml`, wait for the API to come back (`kubectl get nodes` works again) before the next task. If it doesn't come back within 2 minutes, restore the backup and start over instead of wasting time.

## Summary

- PSS has three levels: privileged, baseline, restricted. Restricted requires `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, seccomp `RuntimeDefault`/`Localhost` and only safe volume types.
- PSA is enabled with the `pod-security.kubernetes.io/<enforce|audit|warn>` labels (and `-version`) on the namespace; `enforce` rejects only Pods, not Deployments.
- An AdmissionConfiguration with `PodSecurityConfiguration` sets cluster-wide defaults and exemptions (usernames, runtimeClasses, namespaces).
- Base64 is not encryption; `list`/`watch` on secrets and `create pods` in a namespace give access to Secret values.
- EncryptionConfiguration (`apiserver.config.k8s.io/v1`) + `--encryption-provider-config`: the first provider writes, `identity` in first position means no encryption.
- You re-encrypt existing Secrets with `kubectl get secrets -A -o json | kubectl replace -f -`, and verify the `k8s:enc:aescbc:v1:` prefix in `etcdctl get`.
- Mount a Secret as a read-only volume instead of env variables; for production consider KMS v2 or an external secret manager.
