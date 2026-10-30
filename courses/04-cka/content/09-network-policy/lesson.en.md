## What this module covers

This module covers objective **3.2** of domain 3 (**Services & Networking**, 20% of the exam): defining and enforcing **NetworkPolicy** rules.

Typical exam tasks:

- "Create a NetworkPolicy `allow-frontend` in namespace `backend` that allows ingress on port 8080 only from Pods labeled `app=frontend` in namespace `frontend`."
- "Introduce default deny for ingress and egress traffic in namespace `secure`, but keep DNS."
- "Of the three given policies, apply the one that meets the requirements with the fewest permissions."
- "Pod `api` cannot reach the database. Find the policy that blocks it and fix it."

A NetworkPolicy cannot be written imperatively (`kubectl create` has no subcommand for it), so you have to write YAML quickly and accurately. For the CKS this is one of the most important topics, so it is worth learning it thoroughly.

## What NetworkPolicy is and what it is not

A **NetworkPolicy** (`networking.k8s.io/v1`) is a namespaced resource that describes which L3/L4 traffic (IP address, protocol, port) may enter and leave a Pod. The Kubernetes API only stores the object. The rules in the kernel are enforced by the **CNI plugin**.

- CNIs that support policies: Calico, Cilium, kindnet (in this course's labs), Antrea and others.
- CNIs that do **not** support them (e.g. Flannel on its own): `kubectl apply` succeeds without an error, the object exists, but **nothing is blocked**.

> **On the exam:** if a policy "does not work" while the YAML is correct, check which CNI the cluster uses: `kubectl -n kube-system get pods` and `ls /etc/cni/net.d/`. On exam clusters the CNI supports policies, so the error is almost always in the selectors or labels.

## Semantics: four rules you must know

1. **Without a policy everything is allowed.** A Pod that no policy selects is "non-isolated": it receives and sends everything.
2. **Isolation starts when a policy selects the Pod.** As soon as at least one policy with `policyTypes: [Ingress]` selects a Pod (via `spec.podSelector`), the Pod becomes isolated for ingress and receives **only** what some policy explicitly allows. The same applies to `Egress` separately.
3. **Policies are additive.** There are no "deny" rules. If several policies select the same Pod, everything allowed by **any** of them is allowed (union). There is no order.
4. **A connection needs permission at both ends.** Traffic from A to B passes only if A's egress side allows leaving toward B **and** B's ingress side allows entry from A (if either side is isolated). Replies to an allowed connection pass automatically (policies are stateful).

### policyTypes

| `policyTypes` | Effect on the selected Pods |
|---|---|
| `[Ingress]` | Isolates ingress; allows only the `ingress` rules |
| `[Egress]` | Isolates egress; allows only the `egress` rules |
| `[Ingress, Egress]` | Isolates both directions |
| omitted | Always `Ingress`; `Egress` is added only if the policy has an `egress` section |

That is why a policy that has only `egress` rules and no `policyTypes` does not isolate ingress. The safest approach is to always write `policyTypes` explicitly.

## Policy structure

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
  namespace: backend            # the policy applies only to Pods in this namespace
spec:
  podSelector:                  # WHICH Pods this policy protects
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  ingress:
  - from:                       # WHERE traffic may come from
    - podSelector:
        matchLabels:
          app: frontend
    ports:                      # TO WHICH ports of the selected Pods
    - protocol: TCP
      port: 8080
```

- `spec.podSelector: {}` selects **all** Pods in the policy's namespace.
- `ingress[].from` and `egress[].to` are lists of **peers**. A peer is a `podSelector`, a `namespaceSelector`, a combination of the two, or an `ipBlock`.
- `ports` in a rule restricts the ports on the **destination** Pod (for ingress) or the destination (for egress).
- Within one rule, `from` and `ports` are combined with **AND**: the source must match **and** the port must match.
- Multiple rules (items in the `ingress` list) are combined with **OR**.

### Peer selectors

| Peer | What it selects |
|---|---|
| `podSelector` alone | Pods with those labels in the **policy's namespace** |
| `namespaceSelector` alone | **All** Pods in namespaces with those labels |
| `namespaceSelector` + `podSelector` in the **same** item | Pods with those labels, but only in namespaces with those labels |
| `ipBlock` | An IP range (CIDR), with an optional `except`; intended for addresses outside the cluster |

A `podSelector` alone never leaves the policy's namespace. For Pods in another namespace you must add a `namespaceSelector`.

## AND vs OR: the most common trap

The difference is a single dash (`-`). Compare:

```yaml
# VARIANT A: one item, two selectors → AND
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: frontend
    podSelector:
      matchLabels:
        app: web
```

```yaml
# VARIANT B: two items → OR
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: frontend
  - podSelector:
      matchLabels:
        app: web
```

| | Who may enter |
|---|---|
| A | Only `app=web` Pods **that are in** namespace `frontend` |
| B | **All** Pods from namespace `frontend` **or** `app=web` Pods from the policy's namespace |

Variant B is much broader. On the exam read the task text ("`app=web` Pods from namespace `frontend`" means A) and watch the indentation carefully: in variant A the `podSelector` is aligned with `namespaceSelector`, without a dash.

> **On the exam:** after `kubectl apply` run `kubectl describe networkpolicy <name> -n <ns>`. The description spells the rules out in words ("NamespaceSelector: … PodSelector: …" in the same block for AND, separately for OR), so you immediately see whether you created AND or OR.

## The kubernetes.io/metadata.name label

Every namespace automatically has the label **`kubernetes.io/metadata.name`** whose value is the namespace name. The API server sets it and it cannot be changed permanently. So you do not need to add your own labels to a namespace to select it:

```bash
kubectl get ns frontend --show-labels
# NAME       STATUS   AGE   LABELS
# frontend   Active   5m    kubernetes.io/metadata.name=frontend
```

```yaml
namespaceSelector:
  matchLabels:
    kubernetes.io/metadata.name: frontend
```

If the task says "the namespace with the label `team=blue`", use that label. If it says "namespace `frontend`", use `kubernetes.io/metadata.name`. `namespaceSelector: {}` selects all namespaces.

## Default deny policies

Default deny ingress for the whole namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: secure
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

Default deny egress:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: secure
spec:
  podSelector: {}
  policyTypes:
  - Egress
```

Both directions in one policy: `policyTypes: [Ingress, Egress]` without any rules.

The opposite, "allow all" for ingress (an empty rule selects all sources):

```yaml
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - {}
```

Compare: `ingress: []` or no `ingress` key means "nothing", while `ingress: [{}]` means "everything".

### Allowing DNS after default deny egress

As soon as you introduce default deny egress, Pods can no longer resolve any name, because UDP/TCP 53 to CoreDNS is egress traffic. Symptom: `wget web` says "bad address", while `wget <IP>` (if allowed) works.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: secure
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

Notes:

- List **both UDP and TCP** 53. Larger responses and some clients use TCP.
- The policy looks at the IP address of the CoreDNS **Pod** (after kube-proxy translates the ClusterIP of the `kube-dns` Service), which is why the selector picks Pods, not the Service. The port is the CoreDNS container port (53).
- If you do not know the labels of the CoreDNS Pods, a `namespaceSelector` for `kube-system` alone is enough (a bit broader, but it works).

## Ports and endPort

```yaml
ports:
- protocol: TCP
  port: 8080            # a single port
- protocol: TCP
  port: 32000
  endPort: 32768        # range 32000–32768
- protocol: TCP
  port: http            # a named port from the Pod's containerPort definition
```

- `protocol` defaults to `TCP`. `TCP`, `UDP` and `SCTP` are supported.
- `endPort` requires a numeric `port` and must be ≥ `port`; it does not work with a named port.
- An omitted `ports` means all ports.

## ipBlock

```yaml
egress:
- to:
  - ipBlock:
      cidr: 10.0.0.0/16
      except:
      - 10.0.5.0/24
  ports:
  - protocol: TCP
    port: 5432
```

`ipBlock` is intended for traffic to addresses outside the cluster. For Pods use selectors: Pod IP addresses change, and with some CNIs and NAT the source address may not be the one you expect. Egress to the internet excluding internal networks:

```yaml
egress:
- to:
  - ipBlock:
      cidr: 0.0.0.0/0
      except: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
```

## A complete example: a three-tier application

Task: in namespace `app` the database (`tier=db`) accepts only from the API (`tier=api`) on 5432; the API accepts only from the ingress controller in namespace `traefik` on 8080; everything else is forbidden, DNS is allowed.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-from-api
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: db
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: api
    ports:
    - port: 5432
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-from-traefik
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes: [Ingress]
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: traefik
    ports:
    - port: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-egress-db
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes: [Egress]
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: db
    ports:
    - port: 5432
```

Add to that `default-deny-ingress`, `default-deny-egress` and `allow-dns` from the previous sections. Note: the API → DB connection needs **egress** permission on the API side **and** **ingress** permission on the DB side, because both sides are isolated.

> **On the exam:** the "Network Policies" page in the documentation (kubernetes.io/docs/concepts/services-networking/network-policies/) has a complete example with `ipBlock`, `namespaceSelector`, `podSelector` and default deny policies. Copy it into a file and modify it instead of writing from scratch.

## Testing policies

A temporary Pod with the right labels in the right namespace:

```bash
# Target Service and Pod
kubectl -n app get pods -o wide --show-labels
kubectl -n app get svc

# Test with a label that should be allowed
kubectl -n app run t --rm -it --restart=Never --image=busybox:1.36 \
  --labels=tier=api -- wget -qO- -T 2 http://db:5432 ; echo "exit $?"

# Test without a label (should fail with a timeout)
kubectl -n app run t2 --rm -it --restart=Never --image=busybox:1.36 \
  -- nc -zv -w 2 db 5432

# From another namespace
kubectl -n frontend run t3 --rm -it --restart=Never --image=busybox:1.36 \
  -- wget -qO- -T 2 http://api.app:8080
```

How to read the result:

| Result | Meaning |
|---|---|
| A response or `open` | The traffic passes |
| `download timed out` / `timed out` | The packet is dropped: a policy (or the network) blocks it |
| `Connection refused` | The packet reached the Pod, but nobody listens on that port: the policy is **not** the problem |
| `bad address` | DNS does not work: check egress to port 53 |

Always use a timeout (`-T 2` for wget, `-w 2` for nc), otherwise you wait up to two minutes per attempt.

> **On the exam:** create the test Pod with the `--labels` the task specifies. A common mistake is testing from a Pod without a label and concluding that the policy does not work, or the other way around.

## Troubleshooting

```bash
kubectl get netpol -A
kubectl -n app describe netpol
kubectl -n app get pods --show-labels
kubectl get ns --show-labels
```

| Symptom | Cause |
|---|---|
| The policy exists, nothing is blocked | `podSelector` does not select the target Pod (wrong label), the policy is in the wrong namespace, or the CNI does not support policies |
| More is blocked than expected | Egress permission on the source or DNS egress is missing |
| More is allowed than expected | OR instead of AND in `from`; another policy allows it (additivity); `namespaceSelector: {}` |
| A source from another namespace is blocked | A `podSelector` without a `namespaceSelector` looks only at the policy's namespace |
| `endPort` rejected on apply | `port` is named or `endPort` < `port` |

Because policies are additive, the fix for "too much allowed" is always: find **all** policies that select that Pod and check each one. Changing one policy does not cancel another.

## AdminNetworkPolicy and ClusterNetworkPolicy (outside the exam)

NetworkPolicy is namespaced and has no "deny", so a cluster administrator cannot impose rules that teams cannot bypass. For that, SIG Network is developing the **Network Policy API** project (CRDs, not part of core Kubernetes). The earlier alpha resources **AdminNetworkPolicy** and **BaselineAdminNetworkPolicy** were replaced in version v1alpha2 (2026) by a single **ClusterNetworkPolicy** with a `tier` field (Admin or Baseline) and actions such as Accept, Deny and Pass. The API is still alpha and only some CNIs support it. **It is not part of the CKA exam**; it is enough to know it exists.

## Summary

- A NetworkPolicy is a per-Pod L3/L4 firewall; it is enforced by the CNI, and a CNI without support (e.g. Flannel) silently ignores policies.
- A Pod is isolated only once a policy selects it for a given `policyType`; then only what some policy allows gets through. Policies are additive, there are no deny rules and no order.
- A connection needs egress permission at the source and ingress permission at the destination (if they are isolated); replies pass automatically.
- In `from`/`to`: `namespaceSelector` and `podSelector` in the **same** item = AND; in **separate** items (each with a dash) = OR.
- `podSelector: {}` selects all Pods in the namespace; `policyTypes` without rules = default deny; `ingress: [{}]` = allow all.
- After default deny egress, allow DNS: UDP and TCP 53 to `kube-system` (`kubernetes.io/metadata.name: kube-system`, `k8s-app: kube-dns`).
- `endPort` gives a port range with a numeric `port`; `ipBlock` is for addresses outside the cluster.
- Test with a temporary Pod with the exact labels and a timeout (`wget -T 2`, `nc -w 2`); a timeout means blocked, "connection refused" means the network let it through.
