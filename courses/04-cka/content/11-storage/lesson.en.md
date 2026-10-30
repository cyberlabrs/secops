## What this module covers

Domain 4 (**Storage**) is worth 10% of the exam. The module covers three objectives:

- **4.1** StorageClass and dynamic volume provisioning (**dynamic provisioning**),
- **4.2** volume types, **access modes** and **reclaim policy**,
- **4.3** managing **PersistentVolume** (PV) and **PersistentVolumeClaim** (PVC) objects.

Exam tasks are short but precise. Typical examples:

- "Create a 100Mi PV `pv-log`, `hostPath` `/opt/log`, access mode RWX, reclaim policy Retain. Create a PVC that binds to exactly that PV and mount it in a Pod."
- "Create a StorageClass `fast` with the provisioner `rancher.io/local-path`, `volumeBindingMode: WaitForFirstConsumer`, and mark it as the default."
- "The PVC is in the Pending state. Fix it."
- "Expand the PVC to 2Gi" or "bring a Released PV back to the Available state".

Storage is the domain where it is easiest to lose time on details: one wrong letter in `storageClassName` or a mismatched access mode and the PVC stays Pending. That is why reading `kubectl describe` pays off here more than anywhere else.

## Volumes in a Pod: the basic types

A **volume** is a directory that a Pod sees through `volumeMounts`. It is defined in `spec.volumes` and mounted in each container separately. Its lifetime depends on the type.

| Type | Where the data lives | Lives as long as | Typical use |
|---|---|---|---|
| **emptyDir** | Node disk (or RAM with `medium: Memory`) | The Pod exists on the node | Sharing files between containers, cache, scratch |
| **hostPath** | A specific path on the node | It exists on the node | Node agents (logs, `/var/run/containerd`), labs |
| **configMap** / **secret** | API object projected into files | The object | Configuration, certificates, passwords |
| **projected** | Several sources in one directory | The sources | ConfigMap + Secret + `serviceAccountToken` + `downwardAPI` together |
| **persistentVolumeClaim** | The PV behind the PVC | Independent of the Pod | Databases, persistent data |
| **csi** (inline) | CSI driver | Depends on the driver | Ephemeral volumes (e.g. Secrets Store CSI) |

Example: two containers share an `emptyDir`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared
spec:
  containers:
  - name: writer
    image: busybox:1.37
    command: ["sh", "-c", "while true; do date >> /data/out.log; sleep 5; done"]
    volumeMounts:
    - name: scratch
      mountPath: /data
  - name: reader
    image: busybox:1.37
    command: ["sh", "-c", "tail -f /data/out.log"]
    volumeMounts:
    - name: scratch
      mountPath: /data
      readOnly: true
  volumes:
  - name: scratch
    emptyDir:
      sizeLimit: 100Mi
```

### hostPath and its risks

`hostPath` mounts a path from the node into the container. It is handy for labs, but it has two problems:

1. **It is tied to the node.** If the Pod moves to another node, it sees a different (or empty) directory.
2. **Security risk.** Mounting `/`, `/etc`, `/var/lib/kubelet` or `/run/containerd/containerd.sock` effectively grants control over the node. That is why the **baseline** Pod Security Standard forbids it. You will meet this again in CKS.

The `type` field checks what exists on the node: `DirectoryOrCreate`, `Directory`, `FileOrCreate`, `File`, `Socket` and others. Empty means "no check".

```yaml
  volumes:
  - name: logs
    hostPath:
      path: /var/log/app
      type: DirectoryOrCreate
```

### configMap, secret and projected

```yaml
  volumes:
  - name: cfg
    projected:
      sources:
      - configMap:
          name: app-config
      - secret:
          name: app-tls
          items:
          - key: tls.crt
            path: certs/tls.crt
```

Files from ConfigMap/Secret volumes are updated when the object changes (with a delay), **unless** they are mounted with `subPath`. Environment variables from a ConfigMap are never updated without restarting the Pod.

> **On the exam:** Do not memorize YAML. In the documentation, search for "Configure a Pod to Use a PersistentVolume for Storage": that page has ready-made PV, PVC and Pod manifests that you only need to adapt. For StorageClass, use the "Storage Classes" page.

## PersistentVolume and PersistentVolumeClaim

The model has two sides:

- A **PersistentVolume (PV)** is a piece of storage in the cluster. It is a cluster-scoped object (it has no namespace). It is created either manually by an administrator (**static provisioning**) or automatically by a provisioner (**dynamic provisioning**).
- A **PersistentVolumeClaim (PVC)** is a user's request in a namespace: "I need 1Gi, RWO, class X". A Pod uses a PVC, never a PV directly.

The controller binds (**binding**) a PVC to a PV that satisfies all the conditions. The binding is 1:1 and exclusive: one PV belongs to exactly one PVC.

### Static provisioning: PV + PVC + Pod

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-log
  labels:
    tier: logs
spec:
  capacity:
    storage: 100Mi
  accessModes:
  - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /opt/log
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-log
  namespace: default
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 50Mi
  storageClassName: manual
---
apiVersion: v1
kind: Pod
metadata:
  name: logger
spec:
  containers:
  - name: app
    image: nginx:1.27
    volumeMounts:
    - name: log
      mountPath: /var/log/nginx
  volumes:
  - name: log
    persistentVolumeClaim:
      claimName: pvc-log
```

There is no `kubectl create pv` or `kubectl create pvc`. You write the manifest by hand or copy it from the documentation. For the Pod, you can still save time:

```bash
k run logger --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml
vim pod.yaml          # add volumes and volumeMounts
k apply -f pv.yaml -f pvc.yaml -f pod.yaml
k get pv,pvc
k explain pv.spec --recursive | less
```

### Binding rules

A PVC binds to a PV only if **all** of the following match:

| Condition | Rule |
|---|---|
| `storageClassName` | Must be the same string on the PV and the PVC (including empty) |
| Capacity | PV `capacity.storage` ≥ PVC `resources.requests.storage` |
| `accessModes` | The PV must support all modes the PVC requests |
| `volumeMode` | The same (Filesystem and Filesystem, Block and Block) |
| `selector` | If the PVC has a selector, the PV labels must match |
| `volumeName` | If set, only that PV |

An important consequence of capacity: a 50Mi PVC bound to a 100Mi PV gets **the whole 100Mi**. `k get pvc` shows the capacity of the PV, not the requested one.

### storageClassName: empty string or omitted

This is a common trap:

- `storageClassName: ""` means "I want a PV **without a class**". Dynamic provisioning is disabled for that PVC. It binds only to a PV that also has no class.
- Field **omitted**: if a **default** StorageClass exists and the `DefaultStorageClass` admission plugin is enabled (it is in a kubeadm cluster), the API server writes in the name of the default class. The PVC then looks for a PV of that class or provisions one dynamically.
- If there is no default class, a PVC without a class waits. When a default class appears later, the control plane **retroactively** writes its name into such PVCs (GA since v1.28). A PVC with `""` is not changed.

In the lab cluster, `local-path` is the default class. That is why a PVC without `storageClassName` will not take your manually created PV without a class; instead, local-path will create a new volume.

> **On the exam:** If the task says "the PVC should bind to PV `pv-x`" and the PV has no `storageClassName`, you must set `storageClassName: ""` in the PVC. Even safer: also add `volumeName: pv-x`. Without that, the default class "steals" the PVC.

### volumeName and selector

```yaml
spec:
  volumeName: pv-log          # bind to exactly this PV
  selector:
    matchLabels:
      tier: logs              # or choose among PVs by labels
```

- `volumeName` skips the selection. If that PV is already bound to another PVC, the new PVC stays Pending.
- `selector` (`matchLabels` and `matchExpressions`, conditions are combined with AND) works only for static PVs. A PVC with a non-empty selector cannot get a dynamically provisioned PV.
- A PV can be **reserved** for a specific PVC by setting `spec.claimRef` (the PVC name and namespace) on the PV.

## Access modes

| Mode | Abbreviation | Meaning |
|---|---|---|
| **ReadWriteOnce** | RWO | Read-write from **a single node**. Several Pods on the same node can use it |
| **ReadOnlyMany** | ROX | Read-only from many nodes |
| **ReadWriteMany** | RWX | Read-write from many nodes (NFS, CephFS, Azure Files, EFS) |
| **ReadWriteOncePod** | RWOP | Read-write from **a single Pod** in the entire cluster. GA since v1.29, CSI volumes only |

Traps:

- RWO is a per-**node** restriction, not per Pod. For "only one Pod", use RWOP.
- An access mode is a **statement of capabilities**, not a protection. Kubernetes does not prevent writing to a PV marked ROX if you mount it without `readOnly: true`. For a read-only mount, set `readOnly: true` in `volumeMounts` or in the `persistentVolumeClaim` source.
- Cloud block storage (EBS, Azure Disk, GCE PD) supports RWO (and RWOP), not RWX.
- `local-path` in the lab creates the volume in a directory on a single node, so RWX makes no sense. If you request RWX from local-path, the PVC stays Pending and the Events show a provisioner error (`ProvisioningFailed`).

## volumeMode: Filesystem and Block

- **Filesystem** (default): the volume is formatted and mounted as a directory (`volumeMounts.mountPath`).
- **Block**: the Pod gets a raw block device. In the container you use `volumeDevices` with `devicePath`, not `volumeMounts`.

```yaml
  containers:
  - name: db
    image: busybox:1.37
    volumeDevices:
    - name: raw
      devicePath: /dev/xvda
```

The PV and the PVC must have the same `volumeMode`, otherwise there is no binding.

## Reclaim policy and PV states

The **reclaim policy** (`spec.persistentVolumeReclaimPolicy`) says what happens to the PV when the PVC is deleted.

| Policy | What happens after the PVC is deleted | Default for |
|---|---|---|
| **Retain** | The PV moves to **Released**, the data stays, the admin cleans up manually | Manually created PVs |
| **Delete** | Both the PV object and the actual storage (cloud disk, directory) are deleted | Dynamic PVs (they inherit `reclaimPolicy` from the StorageClass, which is Delete by default) |
| **Recycle** | Basic scrub (`rm -rf`) and the PV is Available again | **Deprecated**. Works only for `nfs` and `hostPath`. Use dynamic provisioning instead |

You can change the reclaim policy of an existing PV, which is common before deleting a PVC that holds important data:

```bash
k patch pv pvc-3f1c... -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

### PV states (phase)

| Phase | Meaning |
|---|---|
| **Available** | Free, not bound |
| **Bound** | Bound to a PVC |
| **Released** | The PVC was deleted, the PV has not been reclaimed yet (Retain) |
| **Failed** | Automatic reclamation failed |

### How to reuse a Released PV

A Released PV does **not bind** automatically to a new PVC, because `spec.claimRef` still points to the old PVC (with the old `uid`). Two options:

```bash
# 1) remove claimRef: the PV becomes Available (clean up the data first if needed)
k patch pv pv-log --type=json -p '[{"op":"remove","path":"/spec/claimRef"}]'

# 2) or keep the name and namespace and remove only uid and resourceVersion,
#    so the PV binds to exactly the new PVC with the same name
k edit pv pv-log
```

Check: `k get pv pv-log` should show `Available` (option 1) or `Bound` once you create the PVC (option 2).

> **On the exam:** When deleting a PVC while protecting its data, first look at `RECLAIM POLICY` in `k get pv`. A PVC in use by a Pod is not deleted immediately: it stays in the `Terminating` state because of the `kubernetes.io/pvc-protection` finalizer until the Pod is deleted. That is not an error.

## StorageClass and dynamic provisioning

A **StorageClass** describes a "kind" of storage and who creates it. When a PVC requests a class, its **provisioner** automatically creates a PV of the matching size.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: rancher.io/local-path
parameters: {}
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: false
```

| Field | Meaning |
|---|---|
| `provisioner` | Who creates the volume: a CSI driver (`ebs.csi.aws.com`, `pd.csi.storage.gke.io`) or an external provisioner (`rancher.io/local-path`). `kubernetes.io/no-provisioner` for local static PVs |
| `parameters` | Provisioner-specific (disk type, IOPS, fsType). Kubernetes does not interpret them |
| `reclaimPolicy` | `Delete` (default) or `Retain` for PVs the class creates |
| `volumeBindingMode` | `Immediate` (default) or `WaitForFirstConsumer` |
| `allowVolumeExpansion` | Whether PVCs of this class may be expanded |
| `mountOptions` | Mount options (e.g. for NFS) |

A StorageClass is practically immutable: you cannot change `provisioner`, `parameters`, `reclaimPolicy` and `volumeBindingMode` after creation (you can change `allowVolumeExpansion` and annotations). For anything else, delete it and create it again.

### volumeBindingMode: Immediate or WaitForFirstConsumer

- **Immediate**: the PV is created and bound as soon as the PVC is created. The problem: the volume may end up in a zone (or on a node) where the Pod cannot be scheduled.
- **WaitForFirstConsumer**: the PVC stays **Pending** until some Pod requests it. The scheduler first picks a node, then the provisioner creates the volume there. Mandatory for local storage.

In the lab, `local-path` uses `WaitForFirstConsumer`. That is why this is normal:

```bash
k get pvc data
# NAME   STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   ...
# data   Pending                                      local-path
k describe pvc data | tail -3
# Normal  WaitForFirstConsumer  ...  waiting for first consumer to be created before binding
```

As soon as you create a Pod that uses the PVC, the PVC becomes Bound.

### Default StorageClass

The default class is determined by the annotation `storageclass.kubernetes.io/is-default-class: "true"`. In `k get sc`, `(default)` appears next to its name.

```bash
k get sc
# change the default: remove it from the old one, put it on the new one
k annotate sc local-path storageclass.kubernetes.io/is-default-class-
k annotate sc fast storageclass.kubernetes.io/is-default-class="true" --overwrite
# or patch
k patch sc fast -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

If several classes are marked as default, the newest one is used for new PVCs. Still, keep exactly one.

> **On the exam:** When a task asks you to "create a StorageClass and make it the default", check whether another default class already exists (`k get sc`). The task often expects you to remove the annotation from it.

### Dynamic PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  storageClassName: local-path
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

When the PVC is bound, the provisioner creates a PV named `pvc-<uid>` with a `claimRef` pointing to your PVC.

## Expanding a PVC

1. The StorageClass must have `allowVolumeExpansion: true`.
2. Increase `spec.resources.requests.storage` on the **PVC** (not on the PV):

```bash
k patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
k get pvc data -w
k describe pvc data       # Resizing / FileSystemResizePending conditions
```

Rules:

- Shrinking is not supported. The API rejects a smaller value.
- No new PV is created: the existing volume is expanded, and then the file system (ext3, ext4, xfs) is expanded too, online or on the next Pod start, depending on the driver.
- Do not change `capacity` directly on the PV: that can prevent automatic expansion.
- `local-path` does not support expansion. The lab uses that class only for dynamic provisioning.

## StatefulSet and volumeClaimTemplates

A StatefulSet creates a separate PVC for each replica from the `volumeClaimTemplates` template. The names are `<template>-<statefulset>-<ordinal>`, e.g. `data-db-0`, `data-db-1`.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db
  replicas: 2
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
      - name: db
        image: redis:alpine
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: local-path
      resources:
        requests:
          storage: 1Gi
```

When you scale down or delete a StatefulSet, the PVCs **remain** by default (the data is kept). This is controlled by `spec.persistentVolumeClaimRetentionPolicy` (`whenDeleted`, `whenScaled`: `Retain` or `Delete`).

## VolumeAttributesClass

A **VolumeAttributesClass** (`storage.k8s.io/v1`) describes mutable volume attributes, e.g. IOPS and throughput, separately from the StorageClass. A PVC selects it with the `spec.volumeAttributesClassName` field, and unlike the class, this field may be changed on an existing PVC. That way disk performance is changed without a new volume. The feature is GA (stable) and available in 1.35, but it works only with a CSI driver that supports it (`driverName` in the class). Local-path does not support it.

```yaml
apiVersion: storage.k8s.io/v1
kind: VolumeAttributesClass
metadata:
  name: gold
driverName: ebs.csi.aws.com
parameters:
  iops: "6000"
  throughput: "250"
```

## Troubleshooting

The PVC is **Pending**. First:

```bash
k describe pvc <name>      # Events at the bottom
k get pv                   # is there a free PV and what are its attributes
k get sc                   # does the class exist and which one is the default
```

| Symptom (Events / state) | Cause | Fix |
|---|---|---|
| `waiting for first consumer to be created before binding` | `WaitForFirstConsumer`, no Pod | Normal. Create a Pod |
| `no persistent volumes available for this claim and no storage class is set` | `storageClassName: ""` and no matching PV | Create a PV without a class or fix the conditions |
| `storageclass.storage.k8s.io "fsat" not found` | Typo in the class name | `storageClassName` is immutable: delete and recreate the PVC |
| PVC Pending, PV Available, and no error event | Class, access mode, capacity or volumeMode do not match | Compare `k get pv,pvc -o wide` field by field |
| PVC bound to a new `pvc-...` PV instead of yours | `storageClassName` omitted, the default class took it | Delete the PVC, set `storageClassName: ""` or the PV's class, and `volumeName` |
| PV Released, new PVC Pending | Old `claimRef` | Remove `claimRef` |
| Pod `ContainerCreating`, event `FailedMount` / `FailedAttachVolume` | Mount problem (path, NFS server, driver) | `k describe pod`, CSI driver logs |
| Pod Pending: `persistentvolumeclaim "x" not found` | The PVC does not exist or is in another namespace | The PVC must be in the same namespace as the Pod |

Most fields in a PVC's `spec` are immutable (except `resources.requests.storage` and `volumeAttributesClassName`). When you make a mistake, the fastest way is:

```bash
k get pvc data -o yaml > pvc.yaml   # or take the original file
k delete pvc data
vim pvc.yaml && k apply -f pvc.yaml
```

> **On the exam:** When a Pod with a PVC is stuck in `ContainerCreating`, the problem is in mounting, not in binding. When it is stuck in `Pending` with the message `pod has unbound immediate PersistentVolumeClaims`, the problem is in the PVC: go to `k describe pvc`.

## Summary

- A Pod uses a PVC, and a PVC binds to a PV 1:1. Binding requires the same `storageClassName`, sufficient capacity, supported access modes and the same `volumeMode`.
- `storageClassName: ""` means "no class, no dynamic provisioning"; an omitted field means "the default class". To bind to a specific PV, use `""` (or the PV's class) and `volumeName`.
- RWO is per node, RWOP per Pod (GA, CSI only), RWX requires network storage. An access mode does not protect against writes: that is what `readOnly: true` is for.
- Retain leaves the PV in the Released state; you reuse it by removing `claimRef`. Delete also deletes the storage. Recycle is deprecated.
- StorageClass: `provisioner`, `parameters`, `reclaimPolicy` (default Delete), `volumeBindingMode`, `allowVolumeExpansion`. The default class is selected with the `storageclass.kubernetes.io/is-default-class` annotation.
- `WaitForFirstConsumer` keeps the PVC Pending until a Pod appears. That is how `local-path` works in the lab.
- A PVC is expanded by changing `resources.requests.storage` on the PVC, only if the class allows it; shrinking is not possible.
- `hostPath` is tied to the node and dangerous; in production, use PVCs and CSI.
