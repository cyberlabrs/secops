## What this module covers

This module covers three objectives from domain 2 (**Workloads & Scheduling**, 15% of the exam):

- **2.1** Deployments, rolling updates and rollbacks,
- **2.2** ConfigMaps and Secrets for application configuration,
- **2.4** primitives for robust, self-healing applications (probes, restartPolicy, init and sidecar containers, DaemonSet, StatefulSet, Job, CronJob, PodDisruptionBudget).

Typical exam tasks are short and imperative: "create a Deployment with 3 replicas and image `nginx:1.27`", "update the image and record the reason for the change", "roll the Deployment back to revision 2", "mount a ConfigMap as a file in `/etc/app`", "add a readiness probe on port 8080", "create a CronJob that runs every 5 minutes". Speed is what scores here: the more you do imperatively (`kubectl create … --dry-run=client -o yaml`), the more time is left for troubleshooting.

> **On the exam:** Every task starts with a `kubectl config use-context <name>` command. Copy it from the task text and run it before anything else. A solution in the wrong cluster scores zero.

## Deployment and ReplicaSet

A **Deployment** describes the desired state of an application: image, replica count, update strategy. A Deployment does not create Pods directly. For each version of the Pod template it creates a new **ReplicaSet**, and the ReplicaSet maintains the exact number of Pods. When you change `spec.template` (image, env, resources…), a new ReplicaSet and a new **revision** are created. Changing `spec.replicas` does not create a new revision.

```bash
k create deployment web --image=nginx:1.27 --replicas=3 --port=80
k create deployment web --image=nginx:1.27 --replicas=3 --dry-run=client -o yaml > web.yaml

k get deploy,rs,pods -l app=web
k scale deployment web --replicas=5
```

The ownership hierarchy is visible in `metadata.ownerReferences`: a Pod belongs to a ReplicaSet, a ReplicaSet belongs to a Deployment. If you delete a Pod manually, the ReplicaSet immediately creates a new one. That is the basic form of self-healing.

### Update strategies

| Strategy | Behavior | When to use it |
|---|---|---|
| **RollingUpdate** (default) | Gradually brings up new Pods and shuts down old ones | Stateless applications, no service interruption |
| **Recreate** | First shuts down all old Pods, then brings up new ones | The application must not run two versions at once (e.g. schema migration, RWO volume) |

With RollingUpdate two parameters control the pace (both `25%` by default):

- **maxSurge**: how many Pods may exist **above** `replicas` during the update (rounded up),
- **maxUnavailable**: how many Pods may be **unavailable** relative to `replicas` (rounded down).

They cannot both be 0. Example: `replicas: 4`, `maxSurge: 1`, `maxUnavailable: 0` means at most 5 Pods run at any time and never fewer than 4 are ready.

```yaml
spec:
  replicas: 4
  minReadySeconds: 5            # a Pod must be Ready for 5s to count as available
  revisionHistoryLimit: 10      # how many old ReplicaSets are kept for rollback
  progressDeadlineSeconds: 600  # after this the rollout gets the condition Progressing=False
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

For `type: Recreate` delete the `rollingUpdate` block, otherwise the API rejects the manifest.

### Rollout: updating, monitoring and rolling back

```bash
# change the image (the container name "nginx" comes from create deployment)
k set image deployment/web nginx=nginx:1.28

# the reason for the change is kept in an annotation and shown in history
k annotate deployment/web kubernetes.io/change-cause="image 1.28" --overwrite

k rollout status deployment/web          # waits until done, returns an error if the rollout gets stuck
k rollout history deployment/web
k rollout history deployment/web --revision=2   # details of one revision

k rollout undo deployment/web                    # to the previous revision
k rollout undo deployment/web --to-revision=1    # to a specific revision

k rollout pause deployment/web     # several changes without triggering a rollout
k set image deployment/web nginx=nginx:1.28
k set resources deployment/web -c nginx --requests=cpu=100m,memory=64Mi
k rollout resume deployment/web    # one rollout for all changes

k rollout restart deployment/web   # new Pods without changing the image
```

Important details:

- The **CHANGE-CAUSE** column in `rollout history` reads the `kubernetes.io/change-cause` annotation from the Deployment at the moment the revision is created. The `--record` flag is deprecated; use `kubectl annotate`.
- `rollout undo` does not rewind history: the old revision gets a **new number** (e.g. revision 1 becomes 4).
- `rollout restart` adds the `kubectl.kubernetes.io/restartedAt` annotation to the Pod template, so a new revision is created. You use it to pick up a changed ConfigMap or Secret that is injected through env.
- While a Deployment is paused, `rollout undo` does not work; `resume` first.

> **On the exam:** The container name in `kubectl set image` must be exact. If you are not sure, look it up with `k get deploy web -o jsonpath='{.spec.template.spec.containers[*].name}'`. A wrong name returns the error "unable to find container named …".

### Troubleshooting rollouts

| Symptom | What to look at |
|---|---|
| `rollout status` hangs | `k get rs` (the new RS has 0 Ready), `k describe pod` of a new Pod |
| New Pods in `ImagePullBackOff` | Wrong tag or registry; `k rollout undo` restores the working version |
| New Pods `Running` but `0/1 Ready` | The readiness probe fails; the rollout stalls because `maxUnavailable` does not allow old Pods to be shut down |
| `Progressing=False`, reason `ProgressDeadlineExceeded` | `k describe deploy web`, the Conditions section |

## ConfigMap and Secret

A **ConfigMap** stores non-sensitive configuration (key/value or whole files), a **Secret** stores sensitive data (passwords, tokens, TLS keys). Both are consumed the same way: as env variables or as files in a volume.

### Creating them

```bash
# ConfigMap
k create configmap app-config --from-literal=LOG_LEVEL=debug --from-literal=MODE=prod
k create configmap nginx-conf --from-file=nginx.conf                 # key = file name
k create configmap nginx-conf --from-file=default.conf=./site.conf   # custom key name
k create configmap app-env --from-env-file=app.env                   # every KEY=VALUE line becomes a key

# Secret
k create secret generic db-cred --from-literal=username=app --from-literal=password='S3cr3t!'
k create secret generic ssh-key --from-file=id_rsa=/root/.ssh/id_rsa
k create secret tls web-tls --cert=tls.crt --key=tls.key
k create secret docker-registry regcred --docker-server=registry.example.com \
  --docker-username=ci --docker-password='xyz'
```

The difference between `--from-file` and `--from-env-file`: the first creates **one key** whose content is the whole file, the second parses the file and creates **one key per line**.

| Secret type | Created with | Use |
|---|---|---|
| `Opaque` | `create secret generic` | Arbitrary data |
| `kubernetes.io/tls` | `create secret tls` | Keys `tls.crt` and `tls.key` (Ingress, Gateway) |
| `kubernetes.io/dockerconfigjson` | `create secret docker-registry` | `imagePullSecrets` for a private registry |

### Base64 is not encryption

Values in a Secret's `data` field are only **base64 encoded**. Anyone who can read the Secret (`get secrets`) also knows the password:

```bash
k get secret db-cred -o jsonpath='{.data.password}' | base64 -d
```

When writing YAML by hand, use `stringData` (plain text; the API server encodes it) or encode with `echo -n 'S3cr3t!' | base64` (without `-n` you also encode the newline character, a common mistake). Real protection comes from RBAC (who may `get/list` Secrets), **encryption at rest** in etcd (EncryptionConfiguration on the API server) and external secret managers. For SecOps: `list` on Secrets is the same as `get` on every Secret in the namespace.

### Using them in a Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "env; ls /etc/app; sleep 3600"]
    env:
    - name: DB_PASSWORD               # one key from a Secret
      valueFrom:
        secretKeyRef:
          name: db-cred
          key: password
    - name: LOG_LEVEL                 # one key from a ConfigMap
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: LOG_LEVEL
    envFrom:                          # all keys as env variables
    - configMapRef:
        name: app-env
    - secretRef:
        name: db-cred
      prefix: DB_
    volumeMounts:
    - name: conf
      mountPath: /etc/app             # every key becomes a file in the directory
      readOnly: true
    - name: nginx
      mountPath: /etc/nginx/conf.d/default.conf
      subPath: default.conf           # only one file, the rest of the directory stays
  volumes:
  - name: conf
    configMap:
      name: app-config
  - name: nginx
    configMap:
      name: nginx-conf
```

A Secret is mounted the same way, just with `secret.secretName` instead of `configMap.name`. By default all keys become files; with `items` (`key` + `path`) you pick only some, and with `defaultMode: 0400` you set permissions.

Faster, without editing YAML:

```bash
k set env deployment/web --from=configmap/app-config
k set env deployment/web --from=secret/db-cred --prefix=DB_
```

### Updates and immutable

| How it is consumed | Does the Pod see a ConfigMap/Secret change? |
|---|---|
| `env` / `envFrom` | **No.** Variables are read when the container starts; you need `rollout restart` |
| Volume (whole directory) | **Yes**, the kubelet refreshes the files with a delay (up to about a minute) |
| Volume with `subPath` | **No.** A subPath mount is never refreshed |

ConfigMaps and Secrets can be **immutable** (`immutable: true`). Then `data` cannot be changed (only deleted and recreated), and the kubelet does not watch them, which reduces API server load in large clusters.

If the ConfigMap or key does not exist, the Pod stays in `CreateContainerConfigError` (env) or `ContainerCreating` (volume). With `optional: true` in the reference the Pod starts without it.

> **On the exam:** When a task asks you to "mount a file into an existing directory while keeping the other files", the answer is `subPath`. Without it the mount covers the whole directory. Find a YAML example on kubernetes.io by searching "Configure a Pod to Use a ConfigMap".

## Probes and self-healing

The kubelet on every node runs **probes** and, based on them, restarts containers or removes them from traffic.

| Probe | Question it asks | Consequence of failure |
|---|---|---|
| **livenessProbe** | Is the process alive or stuck? | The kubelet **restarts** the container (according to `restartPolicy`) |
| **readinessProbe** | May it receive traffic? | The Pod becomes `NotReady` and is removed from the Service endpoints; **no restart** |
| **startupProbe** | Has a slow application finished starting? | Until it succeeds, liveness and readiness are not run; if it fails `failureThreshold` times, restart |

Check types: `httpGet` (success is HTTP code 200–399), `tcpSocket` (success if the TCP connection opens), `exec` (success if the command returns 0, e.g. `command: ["cat", "/tmp/healthy"]`) and `grpc` (the standard gRPC health checking protocol).

Defaults: `initialDelaySeconds: 0`, `periodSeconds: 10`, `timeoutSeconds: 1`, `successThreshold: 1`, `failureThreshold: 3`.

```yaml
    containers:
    - name: api
      image: registry.example.com/api:2.1
      ports:
      - containerPort: 8080
      startupProbe:
        httpGet:
          path: /healthz
          port: 8080
        failureThreshold: 30     # up to 30 x 10s = 5 minutes to start
        periodSeconds: 10
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        periodSeconds: 10
      readinessProbe:
        tcpSocket:
          port: 8080
        periodSeconds: 5
```

A common design mistake: a liveness probe that checks the database. When the database goes down, the kubelet restarts all application Pods, which fixes nothing. Liveness checks only the process itself; dependencies belong in readiness.

### restartPolicy

`spec.restartPolicy` applies to the whole Pod:

| Value | Behavior | Where |
|---|---|---|
| `Always` (default) | Always restart, even when the container exits with 0 | Deployment, StatefulSet, DaemonSet (the only allowed value) |
| `OnFailure` | Restart only if the exit code is non-zero | Job, CronJob |
| `Never` | No restart | Job, one-off Pods |

Restarts use exponential backoff (10s, 20s, 40s… up to 5 minutes); that is why you see the `CrashLoopBackOff` status. The restart count is in the `RESTARTS` column, and the reason for the previous crash is in `k describe pod` (Last State, e.g. `OOMKilled`, exit code 137) and in `k logs <pod> --previous`.

### Init and sidecar containers

**Init containers** (`spec.initContainers`) run in order, one at a time, and each must finish successfully before the main containers start. They are used for waiting on dependencies, migrations or preparing files in a shared volume.

**Sidecar containers** (stable since v1.33) are init containers with `restartPolicy: Always`. They start before the main containers (without waiting for them to finish), run for the whole lifetime of the Pod, are restarted if they crash and are shut down **after** the main containers. In a Job a sidecar does not block completion: the Job is done when the main container finishes.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-sidecar
spec:
  initContainers:
  - name: wait-db                       # classic init: must finish
    image: busybox:1.36
    command: ["sh", "-c", "until nslookup db; do sleep 2; done"]
  - name: log-shipper                   # native sidecar
    image: busybox:1.36
    restartPolicy: Always
    command: ["sh", "-c", "tail -F /var/log/app/app.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "while true; do date >> /var/log/app/app.log; sleep 5; done"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  volumes:
  - name: logs
    emptyDir: {}
```

Until an init container finishes, the Pod is in the `Init:0/2` status; if an init container keeps failing you see `Init:CrashLoopBackOff`. You read the logs with `k logs web-with-sidecar -c wait-db`. The old pattern, a sidecar as a second container in `containers`, still works but has no guaranteed start and shutdown order.

> **On the exam:** If a task says "add a sidecar that reads the log", both solutions (a second container in `containers` or an init container with `restartPolicy: Always`) usually pass the check. Read the text carefully: if it asks for a "native sidecar" or for the sidecar to start before the application, use `initContainers`.

## Other controllers

| Controller | What it guarantees | Typical use |
|---|---|---|
| **Deployment** | N identical, interchangeable Pods | Web, API |
| **StatefulSet** | Stable names, ordering, a dedicated PVC per Pod | Databases, Kafka, etcd |
| **DaemonSet** | One Pod per (selected) node | Log agents, CNI, node exporter |
| **Job** | Pods run until successful completion | Migrations, batch |
| **CronJob** | A Job on a schedule | Backups, reports |

### DaemonSet

There is no `kubectl create daemonset`. The fastest path: `k create deployment node-agent --image=busybox:1.36 --dry-run=client -o yaml > ds.yaml`, then in the file change `kind: DaemonSet` and delete `replicas`, `strategy` and `status`.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: node-agent
  template:
    metadata:
      labels:
        app: node-agent
    spec:
      tolerations:                         # so it also runs on the controlplane node
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: agent
        image: busybox:1.36
        command: ["sh", "-c", "sleep infinity"]
```

Without the toleration the DaemonSet will have a Pod only on `node01`, because `controlplane` has the `node-role.kubernetes.io/control-plane:NoSchedule` taint. A DaemonSet has the strategies `RollingUpdate` (default) and `OnDelete`.

### StatefulSet

A StatefulSet gives each Pod a **stable identity**: a name with an ordinal (`db-0`, `db-1`…), a stable DNS name via a **headless Service** (`clusterIP: None`) and its own PVC from `volumeClaimTemplates`. By default (`podManagementPolicy: OrderedReady`) Pods come up in order 0, 1, 2 and shut down in reverse order.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  clusterIP: None
  selector:
    app: db
  ports:
  - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db               # must point to the headless Service
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
      - name: postgres
        image: postgres:17
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef: {name: db-cred, key: password}
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
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

The result: Pods `db-0`, `db-1`, `db-2`; PVCs `data-db-0`, `data-db-1`, `data-db-2`; DNS `db-0.db.default.svc.cluster.local`. When Pod `db-1` is deleted, the new Pod gets the same name and the same PVC. When you scale down, the PVCs **remain** (by default; changed with the `persistentVolumeClaimRetentionPolicy` field). Updates: `RollingUpdate` (from the highest ordinal down to zero, optionally with `partition`) or `OnDelete`.

### Job and CronJob

```bash
k create job pi --image=perl:5.40 -- perl -Mbignum=bpi -wle 'print bpi(500)'
k create cronjob backup --image=busybox:1.36 --schedule="*/5 * * * *" -- sh -c 'date; echo backup'
k create job backup-manual --from=cronjob/backup     # run a CronJob manually
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-import
spec:
  completions: 6                 # 6 successful Pods in total
  parallelism: 2                 # at most 2 at a time
  backoffLimit: 4                # after 4 failed attempts the Job is Failed (default 6)
  activeDeadlineSeconds: 300     # the whole Job must not take longer than 5 minutes
  ttlSecondsAfterFinished: 600   # automatic deletion 10 min after completion
  template:
    spec:
      restartPolicy: Never       # Never or OnFailure; Always is not allowed
      containers:
      - name: worker
        image: busybox:1.36
        command: ["sh", "-c", "echo obrada; sleep 10"]
```

`activeDeadlineSeconds` takes precedence over `backoffLimit`: when it expires, the Job is terminated (reason `DeadlineExceeded`) regardless of how many attempts are left.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
spec:
  schedule: "0 2 * * *"            # every day at 02:00
  timeZone: "Europe/Belgrade"
  concurrencyPolicy: Forbid        # Allow (default) | Forbid | Replace
  successfulJobsHistoryLimit: 3    # failedJobsHistoryLimit defaults to 1
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: busybox:1.36
            command: ["sh", "-c", "echo backup"]
```

Pausing temporarily: `k patch cronjob backup -p '{"spec":{"suspend":true}}'`. The `startingDeadlineSeconds` field determines how late a missed run may still start.

> **On the exam:** With `kubectl create job` and `create cronjob` the command goes after `--`. If the task asks for `completions`, `parallelism` or `backoffLimit`, generate YAML with `--dry-run=client -o yaml`, add the fields under the Job's `spec` (not under `template.spec`) and apply. For a CronJob those fields go in `spec.jobTemplate.spec`.

## PodDisruptionBudget

A **PodDisruptionBudget (PDB)** limits how many Pods of an application may be taken down by a **voluntary disruption**: `kubectl drain`, the eviction API, node upgrades. A PDB does **not** protect against a node failure or a direct `kubectl delete pod`.

```bash
k create pdb web-pdb --selector=app=web --min-available=2
k create pdb web-pdb --selector=app=web --max-unavailable=1
k get pdb    # ALLOWED DISRUPTIONS column
```

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2          # or maxUnavailable; only one of the two
  selector:
    matchLabels:
      app: web
```

If a Deployment has 2 replicas and the PDB requires `minAvailable: 2`, `ALLOWED DISRUPTIONS` is 0 and `kubectl drain node01` will keep repeating "Cannot evict pod as it would violate the pod's disruption budget". The fix: increase replicas or temporarily adjust the PDB. The field `unhealthyPodEvictionPolicy: AlwaysAllow` allows evicting Pods that are not Ready anyway, so a broken application does not block a drain.

> **On the exam:** When `kubectl drain` hangs during an upgrade task, first check `k get pdb -A`. Do not use `--disable-eviction` unless the task explicitly allows it, because it bypasses the PDB.

## Troubleshooting

| Pod status | Most common cause | First command |
|---|---|---|
| `CreateContainerConfigError` | A ConfigMap/Secret or key referenced in `env` does not exist | `k describe pod` (Events) |
| `ContainerCreating` for a long time | A volume (ConfigMap, Secret, PVC) cannot be mounted | `k describe pod` |
| `CrashLoopBackOff` | The application crashes or the liveness probe kills the container | `k logs <pod> --previous` |
| `Running`, `0/1 READY` | The readiness probe fails (wrong port/path) | `k describe pod` (Readiness probe failed) |
| `Init:CrashLoopBackOff` | An init container does not finish successfully | `k logs <pod> -c <init>` |
| Job `Failed`, `BackoffLimitExceeded` | The container exits with a code ≠ 0 | `k logs job/<name>` |
| StatefulSet Pod `Pending` | The PVC cannot be bound | `k get pvc`, `k describe pvc data-db-0` |

```bash
k get events --sort-by=.lastTimestamp | tail -20
k explain pod.spec.containers.livenessProbe.grpc
```

> **On the exam:** `kubectl explain <resource>.<field> --recursive` is faster than searching the documentation when you forget exactly where a field goes (e.g. `k explain cronjob.spec.jobTemplate.spec`).

## Summary

- A Deployment manages ReplicaSets; every Pod template change is a new revision. `set image`, `rollout status/history/undo --to-revision`, `pause/resume`, `restart` are the core commands; the reason for a change goes into the `kubernetes.io/change-cause` annotation.
- The RollingUpdate pace is controlled by `maxSurge` and `maxUnavailable` (25% by default); Recreate shuts down all old Pods before the new ones.
- ConfigMaps and Secrets are consumed as `env`/`envFrom`/`valueFrom` or as a volume; env and `subPath` do not see changes, a whole volume does. Base64 in a Secret is not encryption.
- Liveness restarts, readiness removes from the Service, startup protects slow applications; the types are `httpGet`, `tcpSocket`, `exec`, `grpc`.
- Init containers run in order before the application; a native sidecar is an init container with `restartPolicy: Always`.
- A DaemonSet needs a toleration for the control-plane taint; a StatefulSet requires a headless Service and gives a PVC per Pod (`data-db-0`).
- Job: `completions`, `parallelism`, `backoffLimit`, `activeDeadlineSeconds`, `restartPolicy` Never/OnFailure; a CronJob adds `schedule` and `concurrencyPolicy`.
- A PDB protects against voluntary disruptions (drain, eviction); a PDB that is too strict blocks `kubectl drain`.
