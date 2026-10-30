## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 3 (**Services & Networking**, 20% ispita):

- **3.4** upotreba **Gateway API**-ja za upravljanje ulaznim saobraćajem,
- **3.5** **Ingress** kontroleri i **Ingress** resursi.

Tipični zadaci na ispitu:

- „Napravi Ingress `shop` sa klasom `X` koji `shop.example.com/api` šalje na servis `api:8080`, a `/` na `web:80`.“
- „Dodaj TLS na postojeći Ingress koristeći Secret `shop-tls`.“
- „Napravi HTTPRoute koji se kači na Gateway `main` u namespaceu `infra` i dijeli saobraćaj 80/20 između `v1` i `v2`.“
- „Migriraj postojeći Ingress na Gateway API (Gateway + HTTPRoute) sa istim pravilima.“
- „HTTPRoute ne radi. Popravi ga.“ (pogrešan `parentRefs`, `allowedRoutes`, port servisa, nedostaje ReferenceGrant)

Ingress kontroler i Gateway API CRD-ovi su na ispitnom klasteru obično već instalirani. Tvoj posao je da napišeš resurse. Zato ovdje fokus ide na YAML i provjeru statusa.

## Lab okruženje: Traefik

U labovima kursa kontroler je **Traefik v3.7**, koji podržava i Ingress i Gateway API (Standard kanal, v1.6). Instalacija iz lokalnog charta:

```bash
kubectl apply -f /opt/kurs/manifests/gateway-api-standard.yaml      # Gateway API v1.6.1 CRD-ovi
helm install traefik /opt/kurs/charts/traefik-*.tgz \
  -n traefik --create-namespace \
  --set service.spec.type=NodePort \
  --set providers.kubernetesGateway.enabled=true

kubectl get ingressclass                 # traefik (default)
kubectl get gatewayclass                 # traefik, ACCEPTED True
kubectl -n traefik get gateway           # traefik-gateway (podrazumijevani Gateway iz charta)
kubectl -n traefik get svc traefik       # NodePort za web (80) i websecure (443)
```

Chart pravi **IngressClass** `traefik` (označen kao podrazumijevani), **GatewayClass** `traefik` (`controllerName: traefik.io/gateway-controller`) i Gateway `traefik-gateway` u namespaceu `traefik`.

Svi primjeri u modulu koriste `ingressClassName: traefik` i `gatewayClassName: traefik`. Sami resursi (Ingress, Gateway, HTTPRoute) su **isti za svaki kontroler**. Na ispitu samo zamijeniš ime klase onim koje postoji u klasteru (`kubectl get ingressclass`, `kubectl get gatewayclass`).

> **Na ispitu:** prvo pogledaj koje klase postoje: `kubectl get ingressclass,gatewayclass`. Ime klase iz zadatka mora biti identično; tipfeler u `ingressClassName` znači da nijedan kontroler ne obrađuje resurs, bez ikakve greške pri `apply`.

## Ingress

**Ingress** (`networking.k8s.io/v1`) je resurs koji opisuje HTTP(S) rutiranje: host + putanja → Service:port. Sam objekat ne radi ništa. Treba **Ingress controller** (Traefik, HAProxy, Contour, NGINX Inc., cloud kontroleri…), pod koji prati Ingress objekte i konfiguriše svoj proxy.

### IngressClass

**IngressClass** povezuje Ingress sa kontrolerom:

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

- Ingress bira klasu poljem `spec.ingressClassName`. Stara anotacija `kubernetes.io/ingress.class` je zastarjela.
- Ingress bez `ingressClassName` dobija klasu označenu kao default (anotacija iznad). Ako nema default klase, takav Ingress možda niko neće obraditi.

### Osnovni Ingress

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
              name: http          # ili number
```

Servis mora biti u **istom namespaceu** kao Ingress. Ingress ne može direktno pokazati na servis u drugom namespaceu.

### Imperativno: kubectl create ingress

```bash
# Putanja koja završava sa * je Prefix, bez * je Exact
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.example.com/api*=api:8080" \
  --rule="shop.example.com/*=web:80"

# TLS sa Secretom
kubectl -n shop create ingress shop-tls --class=traefik \
  --rule="shop.example.com/*=web:80,tls=shop-tls"

# Default backend
kubectl -n shop create ingress catchall --class=traefik --default-backend=web:80

# Generiši YAML za doradu
kubectl -n shop create ingress shop --class=traefik \
  --rule="shop.example.com/*=web:80" --dry-run=client -o yaml > ing.yaml
```

> **Na ispitu:** `kubectl create ingress` uštedi pisanje dugog ugniježđenog YAML-a. Pazi na zvjezdicu: `--rule="host/api=svc:80"` pravi `pathType: Exact`, pa `/api/users` neće odgovarati. Provjeri rezultat sa `kubectl get ing shop -o yaml`.

### pathType

| `pathType` | Kako se poredi | `/api` odgovara… |
|---|---|---|
| **Exact** | Tačno ista putanja, osjetljivo na velika/mala slova | samo `/api` (ne `/api/`) |
| **Prefix** | Po segmentima razdvojenim sa `/` | `/api`, `/api/`, `/api/users`, ali **ne** `/apiv2` |
| **ImplementationSpecific** | Kako odluči kontroler (IngressClass) | zavisi od kontrolera |

Ako više putanja odgovara zahtjevu, pobjeđuje najduža; kod iste dužine `Exact` ima prednost nad `Prefix`. `pathType` je obavezno polje u `networking.k8s.io/v1`.

### Host pravila

- `host: shop.example.com` poredi se sa HTTP `Host` zaglavljem.
- Wildcard `*.example.com` odgovara tačno jednom DNS labelu (`a.example.com`, ali ne `a.b.example.com` ni `example.com`).
- Pravilo bez `host` važi za sve hostove.

### defaultBackend

`spec.defaultBackend` (struktura kao `backend` u putanji: `service.name` i `service.port`) prima zahtjeve koji ne odgovaraju nijednom pravilu. Imperativno: `--default-backend=web:80`.

### TLS

Certifikat i ključ idu u Secret tipa **`kubernetes.io/tls`** (ključevi `tls.crt` i `tls.key`) u **istom namespaceu** kao Ingress:

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
    # ... http.paths kao u osnovnom primjeru
```

Host u `tls.hosts` mora odgovarati hostu u pravilu i imenu u certifikatu. Kontroler terminira TLS i prema servisu šalje običan HTTP.

### Testiranje Ingressa

```bash
kubectl -n shop get ingress                          # CLASS, HOSTS, ADDRESS, PORTS
kubectl -n shop describe ingress shop                # Rules i Backends sa IP adresama podova
kubectl -n traefik get svc traefik                   # npr. 80:31080/TCP, 443:31443/TCP
curl -H "Host: shop.example.com" http://node01:31080/api
curl -k --resolve shop.example.com:31443:<IP node01> https://shop.example.com:31443/
```

`describe` prikazuje backende. Ako vidiš `<error: services "api" not found>`, servis ne postoji ili je u drugom namespaceu.

### Status projekta ingress-nginx

Najpoznatiji kontroler, **ingress-nginx** (projekat Kubernetes zajednice), je **povučen**. Kubernetes blog (novembar 2025) je najavio kraj održavanja u **martu 2026**. Od tada nema novih verzija, ispravki grešaka ni sigurnosnih zakrpa, a repozitoriji su samo za čitanje. Postojeće instalacije nastavljaju raditi i Helm chartovi i slike ostaju dostupni, ali ranjivosti koje se otkriju više se neće popravljati. Preporuka SIG Networka je migracija na **Gateway API** ili na drugi Ingress kontroler.

Važno razlikovati:

- **Ingress API** (resurs `Ingress`) **nije** uklonjen. GA je i stabilan, ali „zamrznut“: nove mogućnosti se dodaju samo u Gateway API.
- Povučen je **jedan kontroler** (ingress-nginx). NGINX Ingress Controller kompanije F5/NGINX je poseban projekat.
- Provjera da li ga koristiš: `kubectl get pods -A -l app.kubernetes.io/name=ingress-nginx`.

Za SecOps ovo je bitno: kontroler bez sigurnosnih zakrpa na ivici klastera je visok rizik.

## Gateway API

**Gateway API** je skup CRD-ova (grupa `gateway.networking.k8s.io`) koji nasljeđuje Ingress. Nije dio jezgra Kubernetesa: CRD-ove instaliraš posebno (u labu `/opt/kurs/manifests/gateway-api-standard.yaml`, verzija v1.6.1). Glavne prednosti:

- **Podjela uloga**: provajder infrastrukture (GatewayClass), operater klastera (Gateway), developer aplikacije (HTTPRoute).
- Mogućnosti koje su kod Ingressa bile anotacije specifične za kontroler (rutiranje po zaglavljima, podjela saobraćaja po težinama, redirect, rewrite, izmjena zaglavlja) ovdje su standardna polja.
- Rute u drugim namespaceima, uz eksplicitnu kontrolu (`allowedRoutes`, **ReferenceGrant**).
- Više protokola: HTTPRoute, GRPCRoute, a u v1.6 Standard kanalu i TLSRoute, TCPRoute, UDPRoute, uz ListenerSet i BackendTLSPolicy.

| | Ingress | Gateway API |
|---|---|---|
| Resursi | IngressClass, Ingress | GatewayClass, Gateway, HTTPRoute (+ druge rute), ReferenceGrant |
| Uloge | Jedan objekat za sve | Odvojeno: infrastruktura, operater, aplikacija |
| Protokoli | HTTP/HTTPS | HTTP, HTTPS, gRPC, TLS, TCP, UDP |
| Header match, težine, rewrite | Anotacije kontrolera (neprenosivo) | Standardna polja (`matches`, `weight`, `filters`) |
| Servis u drugom namespaceu | Ne | Da, uz ReferenceGrant |
| TLS | `spec.tls` + Secret | `listeners[].tls.certificateRefs` na Gatewayu |
| Status | Samo adresa | Detaljni uslovi (`Accepted`, `Programmed`, `ResolvedRefs`) |
| Razvoj | Zamrznut | Aktivan |

### GatewayClass

**GatewayClass** je cluster-scoped resurs koji kaže koji kontroler (`spec.controllerName`) upravlja Gatewayima te klase. Obično ga pravi instalacija kontrolera (kod Traefika `controllerName: traefik.io/gateway-controller`). `kubectl get gatewayclass` mora pokazati `ACCEPTED True`.

### Gateway

Gateway je instanca ulazne tačke: na kojim portovima i protokolima sluša i koje rute smije prihvatiti.

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
    port: 8000                 # Traefik: port entrypointa "web"
    hostname: "*.example.com"  # opciono
    allowedRoutes:
      namespaces:
        from: All              # Same (podrazumijevano) | All | Selector
  - name: https
    protocol: HTTPS
    port: 8443                 # Traefik: port entrypointa "websecure"
    hostname: shop.example.com
    tls:
      mode: Terminate          # podrazumijevano
      certificateRefs:
      - kind: Secret
        name: shop-tls         # Secret tipa kubernetes.io/tls u namespaceu infra
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            kubernetes.io/metadata.name: shop
```

- `listeners[].name` je jedinstveno ime unutar Gatewaya; rute ga referenciraju kroz `sectionName`.
- `allowedRoutes.namespaces.from`: `Same` (samo namespace Gatewaya, podrazumijevano), `All`, `Selector`. Može se ograničiti i vrsta rute (`allowedRoutes.kinds`).
- `tls.mode: Terminate` znači da Gateway skida TLS; `Passthrough` prosljeđuje šifrovano (koristi se sa TLSRoute).
- Kod Traefika port listenera mora odgovarati portu Traefik entrypointa (8000 za `web`, 8443 za `websecure`), a Service `traefik` ih izlaže kao 80/443. Drugi kontroleri često direktno koriste 80/443. To je detalj implementacije, ne Gateway API-ja.

```bash
kubectl -n infra get gateway main
# NAME   CLASS     ADDRESS   PROGRAMMED   AGE
# main   traefik   …         True         20s
kubectl -n infra describe gateway main     # uslovi po listeneru, AttachedRoutes
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
    namespace: infra           # obavezno kad je Gateway u drugom namespaceu
    sectionName: http          # opciono: kači se samo na listener "http"
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

- `parentRefs`: na koji Gateway (i listener) se ruta kači. Bez `namespace` se podrazumijeva namespace rute.
- `hostnames`: moraju se preklapati sa `hostname` listenera, inače ruta nije prihvaćena.
- `rules[].matches`: lista uslova; **unutar jednog match** svi uslovi (path, headers, queryParams, method) važe zajedno (AND), **različiti match** elementi su OR. Bez `matches` važi `PathPrefix /`.
- `backendRefs`: Service i **obavezan port** (port servisa, ne kontejnera).

Rutiranje po zaglavlju i metodi:

```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /api
    headers:
    - name: x-env
      value: canary            # type: Exact je podrazumijevano
    method: GET
  backendRefs:
  - name: api-canary
    port: 8080
```

### Traffic splitting (težine)

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

Saobraćaj se dijeli proporcionalno težinama (80/20). Podrazumijevana težina je 1; `weight: 0` isključuje backend. To je osnova za canary i blue/green bez anotacija.

### Filteri

| Filter | Namjena | Primjer polja |
|---|---|---|
| **RequestRedirect** | HTTP redirect klijentu | `scheme`, `hostname`, `port`, `path`, `statusCode` (podrazumijevano 302) |
| **URLRewrite** | Izmjena putanje/hosta prije slanja backendu (klijent ne vidi) | `hostname`, `path.type: ReplacePrefixMatch` / `ReplaceFullPath` |
| **RequestHeaderModifier** | Izmjena zaglavlja zahtjeva | `set`, `add`, `remove` |
| ResponseHeaderModifier | Izmjena zaglavlja odgovora | `set`, `add`, `remove` |
| RequestMirror | Kopija zahtjeva na drugi servis | `backendRef` |

HTTP → HTTPS redirect (ruta na HTTP listeneru, bez `backendRefs`):

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

Rewrite prefiksa i dodavanje zaglavlja:

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

`RequestRedirect` i `URLRewrite` se ne mogu kombinovati u istom pravilu. Redirect putanje i rewrite su „Extended“ mogućnosti: većina kontrolera ih podržava, ali ne garantovano svi.

> **Na ispitu:** gateway-api.sigs.k8s.io je dozvoljen tokom ispita. Stranice „Guides“ (HTTP routing, HTTP redirects and rewrites, HTTP traffic splitting, TLS) imaju gotove primjere; kopiraj i prilagodi imena. `kubectl explain httproute.spec.rules.filters` radi i za CRD-ove.

### ReferenceGrant

Gateway API po defaultu ne dozvoljava referencu na objekat u **drugom** namespaceu (Service iz HTTPRoute, Secret iz Gatewaya). Vlasnik ciljnog namespacea to mora dozvoliti objektom **ReferenceGrant** u **svom** namespaceu:

```yaml
# HTTPRoute u namespaceu shop šalje na Service "payments" u namespaceu pay
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata:
  name: allow-shop-routes
  namespace: pay                 # namespace CILJA (servisa)
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: shop
  to:
  - group: ""                    # core API grupa (Service)
    kind: Service
```

U HTTPRoute iz `shop` backend je tada `{name: payments, namespace: pay, port: 8080}`. Bez ReferenceGrant-a ruta ima uslov `ResolvedRefs=False` sa razlogom `RefNotPermitted`. Isto važi kad Gateway u `infra` koristi Secret iz namespacea `certs`: ReferenceGrant u `certs` sa `from: kind: Gateway, namespace: infra` i `to: kind: Secret`.

Razlika `allowedRoutes` i ReferenceGrant: `allowedRoutes` na Gatewayu kaže koje rute smiju da se **zakače** na njega; ReferenceGrant kaže ko smije **pokazivati** na objekte u nekom namespaceu.

### TLS terminacija na Gatewayu

Za razliku od Ingressa, TLS nije u ruti nego na listeneru Gatewaya (primjer gore, listener `https`). Secret je podrazumijevano u namespaceu Gatewaya. HTTPRoute se kači na HTTPS listener potpuno isto kao na HTTP (`sectionName: https`). Secret praviš istom komandom kao za Ingress: `kubectl -n infra create secret tls shop-tls --cert=tls.crt --key=tls.key`.

## Migracija Ingress → Gateway API

Preslikavanje polja:

| Ingress | Gateway API |
|---|---|
| `ingressClassName` | `Gateway.spec.gatewayClassName` (+ `HTTPRoute.parentRefs`) |
| `spec.tls[].secretName` | `Gateway.listeners[].tls.certificateRefs` |
| `rules[].host` | `HTTPRoute.spec.hostnames` |
| `paths[].pathType: Prefix` | `matches[].path.type: PathPrefix` |
| `paths[].pathType: Exact` | `matches[].path.type: Exact` |
| `backend.service.name/port` | `backendRefs[].name/port` |
| `defaultBackend` | Pravilo bez `matches` (podrazumijevano `PathPrefix /`) |
| Anotacije (redirect, rewrite, canary) | `filters`, `weight` |

Primjer: Ingress `shop` sa početka modula kao Gateway API (koristi Gateway `main` iz `infra`):

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

Alat **ingress2gateway** (kubernetes-sigs, verzija 1.0 objavljena u martu 2026) automatski prevodi Ingress resurse i dio ingress-nginx anotacija u Gateway API YAML i upozorava na ono što ne može prevesti:

```bash
ingress2gateway print --providers=ingress-nginx --namespace shop > gwapi.yaml
ingress2gateway print --providers=ingress-nginx --input-file ing.yaml > gwapi.yaml
```

Alat nije u labu i nije potreban na ispitu: tamo migraciju radiš ručno po tabeli iznad. Rezultat alata uvijek pregledaj prije primjene.

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

| Simptom | Uzrok |
|---|---|
| Ingress se ne obrađuje (kontroler ga ignoriše, nema ga u logovima) | Pogrešan `ingressClassName` ili nema kontrolera za tu klasu |
| 404 od kontrolera | Host zaglavlje ne odgovara `host`/`hostnames`, ili `Exact` umjesto `Prefix` |
| 503 / „no available server“ | Servis nema endpointe ili je pogrešan port servisa |
| GatewayClass `ACCEPTED` nije True | Kontroler sa tim `controllerName` ne radi |
| Gateway `PROGRAMMED False` | Neispravan listener (port, protokol), nedostaje ili je neispravan TLS Secret |
| HTTPRoute `Accepted=False`, `NotAllowedByListeners` | `allowedRoutes` ne dozvoljava namespace rute (podrazumijevano `Same`) |
| HTTPRoute `Accepted=False`, `NoMatchingListenerHostname` | `hostnames` se ne preklapa sa `hostname` listenera |
| HTTPRoute `ResolvedRefs=False`, `BackendNotFound` | Servis ne postoji ili je pogrešno ime |
| HTTPRoute `ResolvedRefs=False`, `RefNotPermitted` | Cross-namespace backend bez ReferenceGrant-a |
| HTTPRoute nema status uopšte | `parentRefs` pokazuje na nepostojeći Gateway ili pogrešan namespace |

> **Na ispitu:** HTTPRoute uvijek provjeri sa `kubectl describe`: dva uslova po roditelju, `Accepted` i `ResolvedRefs`, oba moraju biti `True`. Razlog (`Reason`) ti direktno kaže šta popraviti.

## Rezime

- Ingress (`networking.k8s.io/v1`) radi samo uz kontroler; `ingressClassName` bira kontroler preko IngressClass, a klasa sa anotacijom `is-default-class` važi za Ingress bez klase.
- `pathType`: `Exact`, `Prefix` (po segmentima, `/api` ne odgovara `/apiv2`), `ImplementationSpecific`; u `kubectl create ingress` zvjezdica na kraju putanje znači Prefix.
- TLS kod Ingressa: Secret tipa `kubernetes.io/tls` u istom namespaceu (`kubectl create secret tls`), `spec.tls[].hosts` i `secretName`.
- ingress-nginx je povučen (bez zakrpa od marta 2026); Ingress API ostaje, ali je zamrznut, a preporuka je Gateway API.
- Gateway API: GatewayClass (kontroler) → Gateway (listeneri, TLS, `allowedRoutes`) → HTTPRoute (`parentRefs`, `hostnames`, `matches`, `backendRefs` sa obaveznim portom).
- `weight` dijeli saobraćaj; filteri `RequestRedirect`, `URLRewrite`, `RequestHeaderModifier` zamjenjuju anotacije kontrolera.
- Cross-namespace reference traže ReferenceGrant u namespaceu cilja; status ruta (`Accepted`, `ResolvedRefs`) i njihovi razlozi su glavni alat za troubleshooting.
- U labu je Traefik (`ingressClassName: traefik`, `gatewayClassName: traefik`, listener portovi 8000/8443), ali resursi su isti za svaki kontroler.
