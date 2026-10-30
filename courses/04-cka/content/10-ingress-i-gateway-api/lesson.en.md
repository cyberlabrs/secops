## What this module covers

The module covers two objectives from domain 3 (**Services & Networking**, 20% of the exam):

- **3.4** using the **Gateway API** to manage ingress traffic,
- **3.5** **Ingress** controllers and **Ingress** resources.

Typical exam tasks:

- "Create an Ingress `shop` with class `X` that sends `shop.example.com/api` to the Service `api:8080` and `/` to `web:80`."
- "Add TLS to an existing Ingress using the Secret `shop-tls`."
- "Create an HTTPRoute that attaches to the Gateway `main` in the namespace `infra` and splits traffic 80/20 between `v1` and `v2`."
- "Migrate an existing Ingress to the Gateway API (Gateway + HTTPRoute) with the same rules."
- "The HTTPRoute is not working. Fix it." (wrong `parentRefs`, `allowedRoutes`, Service port, missing ReferenceGrant)

The Ingress controller and the Gateway API CRDs are usually already installed on the exam cluster. Your job is to write the resources. That is why the focus here is on YAML and on checking status.

## Lab environment: Traefik

In the course labs the controller is **Traefik v3.7**, which supports both Ingress and the Gateway API (Standard channel, v1.6). Installation from the local chart:

```bash
kubectl apply -f /opt/kurs/manifests/gateway-api-standard.yaml      # Gateway API v1.6.1 CRDs
helm install traefik /opt/kurs/charts/traefik-*.tgz \
  -n traefik --create-namespace \
  --set service.spec.type=NodePort \
  --set providers.kubernetesGateway.enabled=true

kubectl get ingressclass                 # traefik (default)
kubectl get gatewayclass                 # traefik, ACCEPTED True
kubectl -n traefik get gateway           # traefik-gateway (the default Gateway from the chart)
kubectl -n traefik get svc traefik       # NodePort for web (80) and websecure (443)
```

The chart creates the **IngressClass** `traefik` (marked as the default), the **GatewayClass** `traefik` (`controllerName: traefik.io/gateway-controller`) and the Gateway `traefik-gateway` in the namespace `traefik`.

All examples in this module use `ingressClassName: traefik` and `gatewayClassName: traefik`. The resources themselves (Ingress, Gateway, HTTPRoute) are **the same for every controller**. On the exam you just replace the class name with the one that exists in the cluster (`kubectl get ingressclass`, `kubectl get gatewayclass`).

> **On the exam:** first check which classes exist: `kubectl get ingressclass,gatewayclass`. The class name from the task must be identical; a typo in `ingressClassName` means that no controller processes the resource, with no error at all during `apply`.

## Ingress

**Ingress** (`networking.k8s.io/v1`) is a resource that describes HTTP(S) routing: host + path → Service:port. The object by itself does nothing. You need an **Ingress controller** (Traefik, HAProxy, Contour, NGINX Inc., cloud controllers…), a Pod that watches Ingress objects and configures its proxy.

### IngressClass

**IngressClass** binds an Ingress to a controller:

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: traefik
  annotations:
    ingressclass.kubernetes.io/is-default-class: "true"
spec:
  controller: traefik.io/ingress-controller
```

- An Ingress selects its class with the `spec.ingressClassName` field. The old `kubernetes.io/ingress.class` annotation is deprecated.
- An Ingress without `ingressClassName` gets the class marked as default (the annotation above). If there is no default class, such an Ingress may not be processed by anyone.

### Basic Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: traefik
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              name: http          # or number
```

The Service must be in the **same namespace** as the Ingress. An Ingress cannot point directly to a Service in another namespace.

### Imperative: kubectl create ingress

```bash
# A path ending with * is Prefix, without * it is Exact
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.example.com/api*=api:8080" \
  --rule="shop.example.com/*=web:80"

# TLS with a Secret
kubectl -n shop create ingress shop-tls --class=traefik \
  --rule="shop.example.com/*=web:80,tls=shop-tls"

# Default backend
kubectl -n shop create ingress catchall --class=traefik --default-backend=web:80

# Generate YAML for further editing
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.example.com/*=web:80" --dry-run=client -o yaml > ing.yaml
```

> **On the exam:** `kubectl create ingress` saves you from writing long nested YAML. Watch the asterisk: `--rule="host/api=svc:80"` creates `pathType: Exact`, so `/api/users` will not match. Check the result with `kubectl get ing shop -o yaml`.

### pathType

| `pathType` | How it is compared | `/api` matches… |
|---|---|---|
| **Exact** | Exactly the same path, case-sensitive | only `/api` (not `/api/`) |
| **Prefix** | By segments separated by `/` | `/api`, `/api/`, `/api/users`, but **not** `/apiv2` |
| **ImplementationSpecific** | As the controller (IngressClass) decides | depends on the controller |

If several paths match a request, the longest one wins; for equal length, `Exact` takes precedence over `Prefix`. `pathType` is a required field in `networking.k8s.io/v1`.

### Host rules

- `host: shop.example.com` is compared with the HTTP `Host` header.
- The wildcard `*.example.com` matches exactly one DNS label (`a.example.com`, but neither `a.b.example.com` nor `example.com`).
- A rule without `host` applies to all hosts.

### defaultBackend

`spec.defaultBackend` (same structure as `backend` in a path: `service.name` and `service.port`) receives requests that do not match any rule. Imperatively: `--default-backend=web:80`.

### TLS

The certificate and key go into a Secret of type **`kubernetes.io/tls`** (keys `tls.crt` and `tls.key`) in the **same namespace** as the Ingress:

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=shop.example.com" -addext "subjectAltName=DNS:shop.example.com"
kubectl -n shop create secret tls shop-tls --cert=tls.crt --key=tls.key
```

```yaml
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - shop.example.com
    secretName: shop-tls
  rules:
  - host: shop.example.com
    # ... http.paths as in the basic example
```

The host in `tls.hosts` must match the host in the rule and the name in the certificate. The controller terminates TLS and sends plain HTTP to the Service.

### Testing an Ingress

```bash
kubectl -n shop get ingress                          # CLASS, HOSTS, ADDRESS, PORTS
kubectl -n shop describe ingress shop                # Rules and Backends with Pod IP addresses
kubectl -n traefik get svc traefik                   # e.g. 80:31080/TCP, 443:31443/TCP
curl -H "Host: shop.example.com" http://node01:31080/api
curl -k --resolve shop.example.com:31443:<IP node01> https://shop.example.com:31443/
```

`describe` shows the backends. If you see `<error: services "api" not found>`, the Service does not exist or is in another namespace.

### Status of the ingress-nginx project

The best-known controller, **ingress-nginx** (a Kubernetes community project), has been **retired**. The Kubernetes blog (November 2025) announced the end of maintenance in **March 2026**. Since then there have been no new releases, bug fixes or security patches, and the repositories are read-only. Existing installations keep working and the Helm charts and images remain available, but newly discovered vulnerabilities will no longer be fixed. SIG Network recommends migrating to the **Gateway API** or to another Ingress controller.

It is important to distinguish:

- The **Ingress API** (the `Ingress` resource) has **not** been removed. It is GA and stable, but "frozen": new features are added only to the Gateway API.
- **One controller** (ingress-nginx) has been retired. The NGINX Ingress Controller from F5/NGINX is a separate project.
- Checking whether you use it: `kubectl get pods -A -l app.kubernetes.io/name=ingress-nginx`.

For SecOps this matters: a controller without security patches at the edge of the cluster is a high risk.

## Gateway API

The **Gateway API** is a set of CRDs (group `gateway.networking.k8s.io`) that succeeds Ingress. It is not part of core Kubernetes: you install the CRDs separately (in the lab `/opt/kurs/manifests/gateway-api-standard.yaml`, version v1.6.1). Main advantages:

- **Role separation**: infrastructure provider (GatewayClass), cluster operator (Gateway), application developer (HTTPRoute).
- Features that were controller-specific annotations with Ingress (header-based routing, weighted traffic splitting, redirect, rewrite, header modification) are standard fields here.
- Routes in other namespaces, with explicit control (`allowedRoutes`, **ReferenceGrant**).
- More protocols: HTTPRoute, GRPCRoute, and in the v1.6 Standard channel also TLSRoute, TCPRoute, UDPRoute, along with ListenerSet and BackendTLSPolicy.

| | Ingress | Gateway API |
|---|---|---|
| Resources | IngressClass, Ingress | GatewayClass, Gateway, HTTPRoute (+ other routes), ReferenceGrant |
| Roles | One object for everything | Separate: infrastructure, operator, application |
| Protocols | HTTP/HTTPS | HTTP, HTTPS, gRPC, TLS, TCP, UDP |
| Header match, weights, rewrite | Controller annotations (not portable) | Standard fields (`matches`, `weight`, `filters`) |
| Service in another namespace | No | Yes, with a ReferenceGrant |
| TLS | `spec.tls` + Secret | `listeners[].tls.certificateRefs` on the Gateway |
| Status | Address only | Detailed conditions (`Accepted`, `Programmed`, `ResolvedRefs`) |
| Development | Frozen | Active |

### GatewayClass

**GatewayClass** is a cluster-scoped resource that says which controller (`spec.controllerName`) manages Gateways of that class. It is usually created by the controller installation (for Traefik `controllerName: traefik.io/gateway-controller`). `kubectl get gatewayclass` must show `ACCEPTED True`.

### Gateway

A Gateway is an instance of an entry point: which ports and protocols it listens on and which routes it may accept.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main
  namespace: infra
spec:
  gatewayClassName: traefik
  listeners:
  - name: http
    protocol: HTTP
    port: 8000                 # Traefik: port of the "web" entrypoint
    hostname: "*.example.com"  # optional
    allowedRoutes:
      namespaces:
        from: All              # Same (default) | All | Selector
  - name: https
    protocol: HTTPS
    port: 8443                 # Traefik: port of the "websecure" entrypoint
    hostname: shop.example.com
    tls:
      mode: Terminate          # default
      certificateRefs:
      - kind: Secret
        name: shop-tls         # Secret of type kubernetes.io/tls in the namespace infra
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            kubernetes.io/metadata.name: shop
```

- `listeners[].name` is a unique name within the Gateway; routes reference it through `sectionName`.
- `allowedRoutes.namespaces.from`: `Same` (only the Gateway's namespace, the default), `All`, `Selector`. The kind of route can also be restricted (`allowedRoutes.kinds`).
- `tls.mode: Terminate` means the Gateway terminates TLS; `Passthrough` forwards it encrypted (used with TLSRoute).
- With Traefik the listener port must match the port of the Traefik entrypoint (8000 for `web`, 8443 for `websecure`), and the `traefik` Service exposes them as 80/443. Other controllers often use 80/443 directly. This is an implementation detail, not part of the Gateway API.

```bash
kubectl -n infra get gateway main
# NAME   CLASS     ADDRESS   PROGRAMMED   AGE
# main   traefik   …         True         20s
kubectl -n infra describe gateway main     # conditions per listener, AttachedRoutes
```

### HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop
  namespace: shop
spec:
  parentRefs:
  - name: main
    namespace: infra           # required when the Gateway is in another namespace
    sectionName: http          # optional: attach only to the "http" listener
  hostnames:
  - shop.example.com
  rules:
  - matches:
    - path:
        type: PathPrefix       # PathPrefix | Exact | RegularExpression
        value: /api
    backendRefs:
    - name: api
      port: 8080
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: web
      port: 80
```

- `parentRefs`: which Gateway (and listener) the route attaches to. Without `namespace`, the route's namespace is assumed.
- `hostnames`: must overlap with the listener's `hostname`, otherwise the route is not accepted.
- `rules[].matches`: a list of conditions; **within a single match** all conditions (path, headers, queryParams, method) apply together (AND), **separate match** elements are OR. Without `matches`, `PathPrefix /` applies.
- `backendRefs`: a Service and a **required port** (the Service port, not the container port).

Routing by header and method:

```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /api
    headers:
    - name: x-env
      value: canary            # type: Exact is the default
    method: GET
  backendRefs:
  - name: api-canary
    port: 8080
```

### Traffic splitting (weights)

```yaml
rules:
- backendRefs:
  - name: web-v1
    port: 80
    weight: 80
  - name: web-v2
    port: 80
    weight: 20
```

Traffic is split in proportion to the weights (80/20). The default weight is 1; `weight: 0` disables a backend. This is the basis for canary and blue/green deployments without annotations.

### Filters

| Filter | Purpose | Example fields |
|---|---|---|
| **RequestRedirect** | HTTP redirect to the client | `scheme`, `hostname`, `port`, `path`, `statusCode` (default 302) |
| **URLRewrite** | Changes the path/host before sending to the backend (the client does not see it) | `hostname`, `path.type: ReplacePrefixMatch` / `ReplaceFullPath` |
| **RequestHeaderModifier** | Modifies request headers | `set`, `add`, `remove` |
| ResponseHeaderModifier | Modifies response headers | `set`, `add`, `remove` |
| RequestMirror | Copy of the request to another Service | `backendRef` |

HTTP → HTTPS redirect (a route on the HTTP listener, without `backendRefs`):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop-redirect
  namespace: shop
spec:
  parentRefs:
  - name: main
    namespace: infra
    sectionName: http
  hostnames: ["shop.example.com"]
  rules:
  - filters:
    - type: RequestRedirect
      requestRedirect:
        scheme: https
        statusCode: 301
```

Prefix rewrite and adding a header:

```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /old-api
  filters:
  - type: URLRewrite
    urlRewrite:
      path:
        type: ReplacePrefixMatch
        replacePrefixMatch: /api
  - type: RequestHeaderModifier
    requestHeaderModifier:
      set:
      - name: X-Forwarded-Team
        value: shop
      remove: ["X-Debug"]
  backendRefs:
  - name: api
    port: 8080
```

`RequestRedirect` and `URLRewrite` cannot be combined in the same rule. Path redirects and rewrites are "Extended" features: most controllers support them, but not all are guaranteed to.

> **On the exam:** gateway-api.sigs.k8s.io is allowed during the exam. The "Guides" pages (HTTP routing, HTTP redirects and rewrites, HTTP traffic splitting, TLS) have ready-made examples; copy them and adjust the names. `kubectl explain httproute.spec.rules.filters` works for CRDs as well.

### ReferenceGrant

By default the Gateway API does not allow a reference to an object in **another** namespace (a Service from an HTTPRoute, a Secret from a Gateway). The owner of the target namespace must allow it with a **ReferenceGrant** object in **their own** namespace:

```yaml
# HTTPRoute in the namespace shop sends to the Service "payments" in the namespace pay
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata:
  name: allow-shop-routes
  namespace: pay                 # namespace of the TARGET (the Service)
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: shop
  to:
  - group: ""                    # core API group (Service)
    kind: Service
```

In the HTTPRoute from `shop` the backend is then `{name: payments, namespace: pay, port: 8080}`. Without a ReferenceGrant the route has the condition `ResolvedRefs=False` with the reason `RefNotPermitted`. The same applies when a Gateway in `infra` uses a Secret from the namespace `certs`: a ReferenceGrant in `certs` with `from: kind: Gateway, namespace: infra` and `to: kind: Secret`.

The difference between `allowedRoutes` and ReferenceGrant: `allowedRoutes` on a Gateway says which routes may **attach** to it; ReferenceGrant says who may **point** to objects in a given namespace.

### TLS termination on the Gateway

Unlike Ingress, TLS is not in the route but on the Gateway listener (example above, listener `https`). By default the Secret is in the Gateway's namespace. An HTTPRoute attaches to an HTTPS listener exactly as it does to an HTTP one (`sectionName: https`). You create the Secret with the same command as for Ingress: `kubectl -n infra create secret tls shop-tls --cert=tls.crt --key=tls.key`.

## Migrating Ingress → Gateway API

Field mapping:

| Ingress | Gateway API |
|---|---|
| `ingressClassName` | `Gateway.spec.gatewayClassName` (+ `HTTPRoute.parentRefs`) |
| `spec.tls[].secretName` | `Gateway.listeners[].tls.certificateRefs` |
| `rules[].host` | `HTTPRoute.spec.hostnames` |
| `paths[].pathType: Prefix` | `matches[].path.type: PathPrefix` |
| `paths[].pathType: Exact` | `matches[].path.type: Exact` |
| `backend.service.name/port` | `backendRefs[].name/port` |
| `defaultBackend` | A rule without `matches` (defaults to `PathPrefix /`) |
| Annotations (redirect, rewrite, canary) | `filters`, `weight` |

Example: the Ingress `shop` from the beginning of the module as Gateway API (using the Gateway `main` from `infra`):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop
  namespace: shop
spec:
  parentRefs:
  - name: main
    namespace: infra
  hostnames: ["shop.example.com"]
  rules:
  - matches:
    - path: {type: PathPrefix, value: /api}
    backendRefs:
    - {name: api, port: 8080}
  - backendRefs:
    - {name: web, port: 80}
```

The **ingress2gateway** tool (kubernetes-sigs, version 1.0 released in March 2026) automatically translates Ingress resources and some ingress-nginx annotations into Gateway API YAML and warns about what it cannot translate:

```bash
ingress2gateway print --providers=ingress-nginx --namespace shop > gwapi.yaml
ingress2gateway print --providers=ingress-nginx --input-file ing.yaml > gwapi.yaml
```

The tool is not in the lab and is not needed on the exam: there you do the migration by hand using the table above. Always review the tool's output before applying it.

## Troubleshooting

```bash
kubectl get ingressclass,gatewayclass
kubectl get ingress,gateway,httproute -A
kubectl -n shop describe ingress shop
kubectl -n shop describe httproute shop          # Status → Parents → Conditions
kubectl -n shop get httproute shop -o jsonpath='{.status.parents[*].conditions}' ; echo
kubectl -n traefik logs deploy/traefik | tail -20
kubectl -n shop get endpointslices -l kubernetes.io/service-name=api
```

| Symptom | Cause |
|---|---|
| Ingress is not processed (the controller ignores it, it is not in the logs) | Wrong `ingressClassName` or no controller for that class |
| 404 from the controller | The Host header does not match `host`/`hostnames`, or `Exact` instead of `Prefix` |
| 503 / "no available server" | The Service has no endpoints or the Service port is wrong |
| GatewayClass `ACCEPTED` is not True | The controller with that `controllerName` is not running |
| Gateway `PROGRAMMED False` | Invalid listener (port, protocol), missing or invalid TLS Secret |
| HTTPRoute `Accepted=False`, `NotAllowedByListeners` | `allowedRoutes` does not allow the route's namespace (default `Same`) |
| HTTPRoute `Accepted=False`, `NoMatchingListenerHostname` | `hostnames` does not overlap with the listener's `hostname` |
| HTTPRoute `ResolvedRefs=False`, `BackendNotFound` | The Service does not exist or the name is wrong |
| HTTPRoute `ResolvedRefs=False`, `RefNotPermitted` | Cross-namespace backend without a ReferenceGrant |
| HTTPRoute has no status at all | `parentRefs` points to a nonexistent Gateway or the wrong namespace |

> **On the exam:** always check an HTTPRoute with `kubectl describe`: two conditions per parent, `Accepted` and `ResolvedRefs`, both must be `True`. The `Reason` tells you directly what to fix.

## Summary

- Ingress (`networking.k8s.io/v1`) works only with a controller; `ingressClassName` selects the controller via an IngressClass, and the class with the `is-default-class` annotation applies to an Ingress without a class.
- `pathType`: `Exact`, `Prefix` (by segments, `/api` does not match `/apiv2`), `ImplementationSpecific`; in `kubectl create ingress` an asterisk at the end of the path means Prefix.
- TLS for Ingress: a Secret of type `kubernetes.io/tls` in the same namespace (`kubectl create secret tls`), `spec.tls[].hosts` and `secretName`.
- ingress-nginx has been retired (no patches since March 2026); the Ingress API remains but is frozen, and the recommendation is the Gateway API.
- Gateway API: GatewayClass (controller) → Gateway (listeners, TLS, `allowedRoutes`) → HTTPRoute (`parentRefs`, `hostnames`, `matches`, `backendRefs` with a required port).
- `weight` splits traffic; the `RequestRedirect`, `URLRewrite` and `RequestHeaderModifier` filters replace controller annotations.
- Cross-namespace references require a ReferenceGrant in the target namespace; route status (`Accepted`, `ResolvedRefs`) and its reasons are the main troubleshooting tool.
- The lab uses Traefik (`ingressClassName: traefik`, `gatewayClassName: traefik`, listener ports 8000/8443), but the resources are the same for every controller.
