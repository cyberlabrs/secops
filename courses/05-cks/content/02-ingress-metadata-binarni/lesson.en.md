## What this module covers

The module covers three objectives from domain 1 (**Cluster Setup**, 15% of the exam):

- **1.3** a properly set up Ingress with TLS,
- **1.4** protecting node metadata and endpoints (cloud metadata, the kubelet API),
- **1.5** verifying platform binaries before use.

Typical exam tasks:

- "Create the Secret `shop-tls` from the given files and secure the Ingress `shop` for host `shop.example.com`. HTTP must be redirected to HTTPS."
- "Pods in the `apps` namespace must not access the address `169.254.169.254`, while other egress must keep working."
- "The kubelet on `node01` answers anonymous requests on port 10250. Fix it."
- "`/opt/binaries` contains `kube-apiserver`, `kubelet` and `kubectl`. Compare their SHA512 sums with the official values and delete the ones that don't match."

Each of these tasks is short, but demands precision: the wrong Secret namespace, a forgotten `except` or one wrong character in a hash means zero points.

## Ingress with TLS

You know Ingress and TLS basics from the CKA. From a security standpoint the questions are: is the traffic really encrypted, does the client get the right certificate, and is there an unencrypted path to the application.

### A Secret of type kubernetes.io/tls

```bash
# if no certificate is given, create a self-signed one (lab)
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=shop.example.com" -addext "subjectAltName=DNS:shop.example.com"

# the Secret must be in the SAME namespace as the Ingress
kubectl -n shop create secret tls shop-tls --cert=tls.crt --key=tls.key

kubectl -n shop get secret shop-tls
# NAME       TYPE                DATA
# shop-tls   kubernetes.io/tls   2
```

`kubectl create secret tls` checks that the key and certificate form a pair and creates a Secret of type **`kubernetes.io/tls`** with the keys `tls.crt` and `tls.key`. If you write the YAML by hand, the values in `data` are base64.

Before use, check the certificate contents:

```bash
openssl x509 -in tls.crt -noout -subject -issuer -dates -ext subjectAltName
kubectl -n shop get secret shop-tls -o jsonpath='{.data.tls\.crt}' | base64 -d \
  | openssl x509 -noout -subject -enddate
```

### spec.tls on the Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - shop.example.com
    secretName: shop-tls
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 80
```

Imperatively, then refine:

```bash
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.example.com/*=web:80,tls=shop-tls" --dry-run=client -o yaml > shop-ing.yaml
```

Rules that get checked:

- `spec.tls[].hosts` must contain the same host as `rules[].host`, and the certificate must have that name in its SAN field.
- `secretName` is just a name; the Secret is looked up in the Ingress's namespace. There is no `namespace` field in the `tls` block.
- If the Secret doesn't exist or is invalid, the controller doesn't report an error on `apply`. Traefik then serves its default certificate ("TRAEFIK DEFAULT CERT"). The client gets a warning, and without `-k` the connection fails.
- The controller terminates TLS; plain HTTP goes to the pod. If that part must be encrypted too, that is mTLS between services (module 08).

> **On the exam:** a TLS Ingress example is at kubernetes.io/docs/concepts/services-networking/ingress/ (the TLS section). The most common mistake is a Secret in the wrong namespace. Always use `kubectl -n <ns>` in both `create secret` and `create ingress`.

### Redirecting HTTP to HTTPS

The Ingress API itself has no redirect field. The controller does it, via annotations or its own CRDs, and it differs from controller to controller:

| Controller | How redirect is enabled |
|---|---|
| Traefik (lab) | Middleware `redirectScheme` + annotation `traefik.ingress.kubernetes.io/router.middlewares`, or globally on the `web` entrypoint through Helm values |
| ingress-nginx (retired in March 2026, but still found on clusters) | `nginx.ingress.kubernetes.io/ssl-redirect: "true"` (enabled by default when the Ingress has `tls`), `force-ssl-redirect: "true"` |
| Gateway API | an `HTTPRoute` on the HTTP listener with a `RequestRedirect` filter and `scheme: https` (see CKA module 10) |

Traefik example:

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: redirect-https
  namespace: shop
spec:
  redirectScheme:
    scheme: https
    permanent: true
```

```yaml
metadata:
  name: shop
  namespace: shop
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: shop-redirect-https@kubernetescrd
```

The value format is `<namespace>-<middleware name>@kubernetescrd`. If you get the name wrong, Traefik ignores the whole route and the controller log says the middleware doesn't exist:

```bash
kubectl -n traefik logs deploy/traefik | grep -i middleware
```

> **On the exam:** the task usually says which controller is installed (`kubectl get ingressclass`, `kubectl -n <ns> get deploy`). Take the annotations from that controller's documentation and check whether that documentation is on the allowed list. If it isn't, look at existing Ingress resources in the cluster (`kubectl get ing -A -o yaml | grep -A3 annotations`); they often already contain an example.

### Verifying the certificate and redirect

```bash
kubectl -n traefik get svc traefik           # e.g. 80:31080/TCP, 443:31443/TCP
NODE_IP=$(kubectl get node node01 -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')

# redirect: you expect 301 or 308 and Location: https://...
curl -sI -H "Host: shop.example.com" http://$NODE_IP:31080/

# HTTPS with certificate verification (no -k!)
curl -v --cacert tls.crt --resolve shop.example.com:31443:$NODE_IP https://shop.example.com:31443/

# which certificate the server really sends for that SNI
openssl s_client -connect $NODE_IP:31443 -servername shop.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

If `openssl s_client` shows `subject=CN=TRAEFIK DEFAULT CERT`, the controller didn't find your Secret, or the host in `tls.hosts` doesn't match the SNI name.

| Symptom | Cause |
|---|---|
| `curl` without `-k`: "SSL certificate problem: self-signed certificate" | normal for a lab certificate; use `--cacert tls.crt` |
| "no alternative certificate subject name matches" | the certificate's SAN doesn't contain the host |
| The server returns the controller's default certificate | Secret in another namespace, wrong name, or `tls.hosts` doesn't match |
| HTTP returns 200 instead of a redirect | the middleware isn't attached or the annotation name is wrong |

## The cloud metadata service

### Why 169.254.169.254 is dangerous

Every major cloud (AWS, GCP, Azure, OpenStack) offers an **Instance Metadata Service (IMDS)** at the link-local address **`169.254.169.254`**. A VM gets data about itself there and, more importantly, the **temporary credentials** of the IAM role assigned to the node:

```bash
# AWS, IMDSv1 (no token) - from a compromised pod
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>
# returns AccessKeyId, SecretAccessKey, Token
```

A pod on the node shares the node's network path to this address. If an attacker gets code execution in a pod (or just **SSRF**, i.e. makes the application send an HTTP request to an address the attacker chooses), they can:

- steal the node's credentials and use them to access the cloud API (S3, ECR, EC2, sometimes the whole account),
- read user-data scripts, which sometimes contain bootstrap tokens and passwords,
- on some managed clusters, get the kubelet's credentials and impersonate the node.

The defense has several layers: NetworkPolicy in the cluster, IMDSv2 at the cloud level, minimal IAM permissions for the node, and per-pod workload identity (IRSA, EKS Pod Identity, GKE Workload Identity) instead of node credentials.

### Blocking the metadata address with NetworkPolicy

Task: pods in the `apps` namespace must not reach the metadata service, while everything else stays allowed.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata
  namespace: apps
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32
```

The policy isolates egress for all pods and allows traffic to every address except one. DNS keeps working because CoreDNS is covered by `0.0.0.0/0`.

If only certain pods (e.g. an agent that legitimately reads metadata) may have access, add a second policy just for them:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-metadata-agent
  namespace: apps
spec:
  podSelector:
    matchLabels:
      role: metadata-reader
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 169.254.169.254/32
    ports:
    - protocol: TCP
      port: 80
```

Traps:

- **Policies are a union.** If the namespace also has a policy with `egress: [{}]` or `ipBlock: 0.0.0.0/0` without `except` that selects the same pods, the metadata address is reachable again. Always look at all policies: `kubectl -n apps get netpol -o yaml`.
- `except` must be inside the `cidr` range and is written with a mask (`/32`).
- NetworkPolicy is namespaced. For the whole cluster you need a policy in every namespace (or CNI-specific global policies, e.g. Calico `GlobalNetworkPolicy`, Cilium `CiliumClusterwideNetworkPolicy`).
- Pods with `hostNetwork: true` bypass NetworkPolicy and see the metadata service as the node itself.

```bash
kubectl -n apps run t --image=busybox:1.36 --rm -it --restart=Never -- \
  wget -qO- -T 3 http://169.254.169.254/latest/meta-data/
# wget: download timed out   -> blocked
```

> **On the exam:** read whether the task asks to block only the metadata address (the example above) or a default deny with allows. In the second case the metadata address is blocked automatically, but you must allow DNS and whatever the task lists.

### IMDSv2 in brief

AWS **IMDSv2** requires a token obtained with a PUT request, which is then sent in a header:

```bash
TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/
```

Why it helps:

- a simple SSRF (a GET to a URL the attacker chooses) cannot send a PUT with a special header,
- the **hop limit** of the PUT response can be set to 1. The packet with the token then doesn't survive the extra network hop to a container that isn't on the node network, so pods cannot get a token.

On nodes, IMDSv2 is set as required (`HttpTokens=required`) with a small hop limit. GCP and Azure have similar protection through mandatory headers (`Metadata-Flavor: Google`, `Metadata: true`), but that only protects against the simplest SSRF, not against code running in a pod.

## Protecting node endpoints: the kubelet API

The kubelet on each node listens on these ports:

| Port | Purpose | Risk |
|---|---|---|
| **10250** | main kubelet API (HTTPS): `/pods`, `/exec`, `/run`, `/logs`, `/stats` | without authentication: command execution in all containers on the node |
| **10255** | read-only HTTP API (deprecated) | reveals pods, env variables and configuration with no authentication at all |
| 10248 | `healthz` on localhost | low |

Correct configuration in `/var/lib/kubelet/config.yaml`:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  anonymous:
    enabled: false              # anonymous requests get 401
  webhook:
    enabled: true               # bearer tokens are checked via TokenReview
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook                 # every request is checked via SubjectAccessReview
readOnlyPort: 0                 # disables port 10255
```

| Setting | Flag | Bad value | Good value |
|---|---|---|---|
| `authentication.anonymous.enabled` | `--anonymous-auth` | `true` | `false` |
| `authorization.mode` | `--authorization-mode` | `AlwaysAllow` (default for a kubelet without configuration) | `Webhook` |
| `authentication.webhook.enabled` | `--authentication-token-webhook` | `false` | `true` |
| `readOnlyPort` | `--read-only-port` | `10255` | `0` |

With `authorization.mode: Webhook`, the kubelet asks the API server whether the user may e.g. `get` the `nodes` resource with the `proxy`, `stats`, `log` or `metrics` subresource. That is why an RBAC permission on **`nodes/proxy`** in practice means command execution on the node (module 03).

Checking from outside, from the controlplane node:

```bash
curl -sk https://node01:10250/pods | head -c 200
```

| Response | Meaning |
|---|---|
| JSON with a list of pods | anonymous access enabled and `AlwaysAllow` authorization: critical |
| `Forbidden (user=system:anonymous, verb=get, resource=nodes, subresource=proxy)` | anonymous access enabled, but Webhook authorization denies it |
| `Unauthorized` | anonymous access disabled: correct |

```bash
curl -s http://node01:10255/pods | head -c 200   # must be "connection refused"
```

Fix and restart:

```bash
ssh node01
cp /var/lib/kubelet/config.yaml /root/kubelet-config.yaml.bak
vim /var/lib/kubelet/config.yaml
systemctl restart kubelet
journalctl -u kubelet -n 20 --no-pager
exit
kubectl get node node01
```

> **On the exam:** after changing the kubelet, check that `kubectl logs` and `kubectl exec` still work for a pod on that node. If they don't, the API server lacks permission on the kubelet or you broke `clientCAFile`. On a kubeadm cluster the API server authenticates to the kubelet with the `apiserver-kubelet-client.crt` certificate, which is in a group with the required permissions.

Other node endpoints: etcd (2379) must not be reachable by anyone except the API server, and the scheduler (10259) and controller-manager (10257) should listen only on `127.0.0.1` (`--bind-address=127.0.0.1`, the kubeadm default). Check:

```bash
ss -tlnp | grep -E '2379|10250|10255|10257|10259'
```

## Verifying platform binaries

An attacker who plants a modified `kubelet` or `kubectl` has persistent access that no Kubernetes tool can see. That is why binaries are verified before installation and after a suspected compromise.

### Checking the version

First find out what is actually installed and what is running:

```bash
kubectl version                       # client and server
kubeadm version -o short
kubelet --version
kubectl get nodes -o wide             # VERSION column = kubelet version on the node
which kubelet; systemctl cat kubelet | grep ExecStart
crictl images | grep kube-apiserver   # the control plane is images, not binaries on disk
```

A hash is always compared for the **same version and architecture** (e.g. `v1.35.0`, `linux/amd64`).

### sha512sum against the official values

Official binaries are at `https://dl.k8s.io/release/<version>/bin/linux/<arch>/<name>`. A hash file (`.sha256` and `.sha512`) is published next to each one. For the server tarball (`kubernetes-server-linux-amd64.tar.gz`) the SHA512 values are also in the version's CHANGELOG on GitHub.

```bash
V=v1.35.0
curl -LO https://dl.k8s.io/release/$V/bin/linux/amd64/kubelet
curl -LO https://dl.k8s.io/release/$V/bin/linux/amd64/kubelet.sha512

# the hash file contains only the hash; add the file name and TWO spaces
echo "$(cat kubelet.sha512)  kubelet" | sha512sum --check
# kubelet: OK
```

The lab and exam clusters usually have no internet. Then you get the hash in the task or in a file, and you do the comparison yourself:

```bash
cd /opt/binaries
sha512sum kube-apiserver kubelet kubectl

# compare with the given value (the whole string, not the first few characters)
sha512sum kubelet | awk '{print $1}' > /tmp/actual
diff /tmp/actual /opt/binaries/kubelet.sha512 && echo OK || echo MISMATCH

# check the installed binary that the kubelet service actually uses
sha512sum /usr/bin/kubelet
```

If you get an extracted server tarball, the binaries are in `kubernetes/server/bin/`:

```bash
tar xzf kubernetes-server-linux-amd64.tar.gz
sha512sum kubernetes/server/bin/{kube-apiserver,kube-controller-manager,kube-scheduler,kubelet,kubectl}
```

> **On the exam:** hashes are long (128 hex characters for SHA512). Don't compare them by eye. Use `sha512sum -c`, `diff` or `grep` with the whole hash: `sha512sum kubelet | grep -q <hash> && echo OK`. If the task says to delete the invalid files, delete only those.

### Signatures: cosign in brief

A hash proves the file matches the published value. A **signature** also proves who published it. Kubernetes signs binaries and images with **cosign** (the Sigstore project), keylessly: the signature is bound to the identity of the release account through a short-lived certificate.

```bash
V=v1.35.0
URL=https://dl.k8s.io/release/$V/bin/linux/amd64
curl -sSfLO $URL/kubectl
curl -sSfLO $URL/kubectl.sig
curl -sSfLO $URL/kubectl.cert

cosign verify-blob kubectl \
  --signature kubectl.sig \
  --certificate kubectl.cert \
  --certificate-identity krel-staging@k8s-releng-prod.iam.gserviceaccount.com \
  --certificate-oidc-issuer https://accounts.google.com
# Verified OK
```

Control plane images from `registry.k8s.io` are verified with `cosign verify` and the identity `krel-trust@k8s-releng-prod.iam.gserviceaccount.com`. cosign 2.x requires `--certificate-identity` and `--certificate-oidc-issuer`. More on image signatures and the supply chain is in module 10. The procedure with exact commands is at kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/.

| Method | What it proves | Requires |
|---|---|---|
| `sha512sum` | the file is identical to the published one | a trusted source for the hash |
| `cosign verify-blob` | the file was signed by the Kubernetes release process | `.sig`, `.cert`, network access to Rekor (transparency log) |
| `kubelet --version` | only what the binary claims about itself | nothing; easy to fake |

## Troubleshooting

| Symptom | What to check |
|---|---|
| The Ingress returns the controller's default certificate on HTTPS | Secret in the same namespace, the name in `secretName`, `tls.hosts` = `rules.host` |
| `kubectl create secret tls` reports a key error | the key and certificate aren't a pair: compare `openssl x509 -noout -modulus` and `openssl rsa -noout -modulus` |
| The pod still reaches 169.254.169.254 | another policy with broader egress (union), a pod with `hostNetwork`, a policy in the wrong namespace |
| After a kubelet change `kubectl logs` returns Forbidden or Unauthorized | the `clientCAFile` path, `authorization.mode`, the API server's permissions on the kubelet |
| `curl https://node01:10250/pods` still returns pods | the kubelet wasn't restarted or a `--anonymous-auth=true` flag overrides the config |
| `sha512sum -c` reports "improperly formatted" | the line is missing the file name, or there aren't two spaces between hash and name |

## Summary

- TLS Ingress: a Secret of type `kubernetes.io/tls` in the same namespace, `spec.tls[].hosts` equal to the rule's host, a certificate with that name in its SAN.
- The HTTP to HTTPS redirect is done by the controller: in Traefik a `redirectScheme` Middleware and the `router.middlewares` annotation, in Gateway API the `RequestRedirect` filter.
- Verification: `curl --cacert ... --resolve ...` without `-k` and `openssl s_client -servername ...`.
- `169.254.169.254` hands out node credentials. Blocking: egress `ipBlock 0.0.0.0/0` with `except: [169.254.169.254/32]`, while watching out for other policies (union) and `hostNetwork` pods.
- IMDSv2 with a required token and hop limit 1 prevents SSRF and access from containers.
- Kubelet: `anonymous.enabled: false`, `webhook.enabled: true`, `authorization.mode: Webhook`, `readOnlyPort: 0`; verify with `curl -sk https://node01:10250/pods` (you expect Unauthorized).
- Binaries: same version and architecture, `sha512sum` against the official `.sha512`, compare the whole hash; cosign `verify-blob` also confirms the publisher.
