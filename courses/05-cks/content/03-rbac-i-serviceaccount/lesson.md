## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 2 (**Cluster Hardening**, 15% ispita):

- **2.1** RBAC za minimalnu izloženost,
- **2.2** oprez sa ServiceAccountima.

Tipični zadaci na ispitu:

- „ServiceAccount `reporter` u namespaceu `finance` ima previše dozvola. Ostavi mu samo `get` i `list` na `pods`.“
- „Pronađi sve ClusterRoleBindinge koji daju `cluster-admin` nekom ServiceAccountu i ukloni onaj koji nije potreban.“
- „Napravi novi ServiceAccount `backend-sa` bez automatskog montiranja tokena i podesi Deployment `backend` da ga koristi.“
- „Pod `web` ne treba pristup API-ju. Spriječi da se token montira, bez izmjene ServiceAccounta.“
- „Uradi da `default` ServiceAccount u namespaceu `prod` ne montira token.“

Mehaniku RBAC-a (Role, ClusterRole, binding, `kubectl create role`) znaš iz CKA. Ovdje je fokus na tome koje dozvole su opasne, kako ih pronaći i kako ServiceAccount token pretvoriti iz trajnog ključa u kratkotrajan, uzak kredencijal.

## RBAC iz ugla napadača

Napadač koji preuzme pod obično prvo pročita token ServiceAccounta i pita API server šta smije:

```bash
# iz kompromitovanog poda
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -sk -H "Authorization: Bearer $TOKEN" https://kubernetes.default.svc/api/v1/namespaces/finance/secrets
# ili, ako je kubectl dostupan
kubectl auth can-i --list
```

Svaka dozvola više od potrebne je odskočna daska. Princip **least privilege** u praksi:

- `Role` + `RoleBinding` umjesto `ClusterRole` + `ClusterRoleBinding` kad god je dovoljan jedan namespace,
- tačno navedeni `resources` i `verbs`, bez `*`,
- `resourceNames` kad aplikacija treba samo jedan objekat (npr. jedan ConfigMap),
- poseban ServiceAccount po aplikaciji,
- bez dozvola za `default` ServiceAccount.

### Opasni glagoli i resursi

Neke dozvole izgledaju bezazleno, a u stvari vode do pune kontrole nad namespaceom ili klasterom:

| Dozvola | Zašto je opasna |
|---|---|
| `*` na `resources` ili `verbs` | uključuje i resurse koji će biti dodati u budućnosti (CRD-ovi), sve podresurse i sve glagole |
| `get`, `list`, `watch` na `secrets` | `list` i `watch` vraćaju **sadržaj** svih Secreta, ne samo imena; `kubectl get secrets -o yaml` je dovoljan |
| `create` na `pods` (ili Deployment, Job, DaemonSet, CronJob…) | pod može koristiti bilo koji ServiceAccount u namespaceu, montirati bilo koji Secret i ConfigMap; uz privilegovan pod i `hostPath` napadač izlazi na čvor |
| `create` na `pods/exec` (i `pods/attach`) | shell u tuđem kontejneru, sa njegovim tokenom i podacima |
| `get`/`create` na `nodes/proxy` | pristup kubelet API-ju svih podova na čvoru, uključujući exec; zaobilazi admission i audit API servera. `get` nije „samo čitanje“ |
| `escalate` na `roles`/`clusterroles` | dozvoljava pravljenje i izmjenu uloga sa dozvolama koje korisnik sam nema |
| `bind` na `roles`/`clusterroles` | dozvoljava vezivanje uloge koju korisnik nema (npr. `cluster-admin`) za sebe |
| `impersonate` na `users`, `groups`, `serviceaccounts` | `kubectl --as=...` u ime drugog, npr. `--as-group=system:masters` |
| `create` na `serviceaccounts/token` | izdavanje tokena za bilo koji ServiceAccount u namespaceu |
| `create` na CSR + `update` na `certificatesigningrequests/approval` | izdavanje klijentskog certifikata sa proizvoljnim imenom i grupom |
| izmjena `validatingwebhookconfigurations`/`mutatingwebhookconfigurations` | webhook vidi (i mijenja) svaki objekat koji prolazi kroz API |
| `patch` na `namespaces` | promjena oznaka koje koriste Pod Security Admission i NetworkPolicy |
| `create` na `persistentvolumes` | `hostPath` PV daje pristup fajl sistemu čvora |

Zaštita protiv eskalacije je ugrađena: RBAC ne dozvoljava da napraviš ulogu ili binding sa dozvolama koje sam nemaš, **osim** ako imaš `escalate` ili `bind`. Zato su ta dva glagola jednaka vlasništvu nad klasterom.

> **Na ispitu:** zadatak često glasi „ukloni nepotrebne dozvole“. Pročitaj šta aplikacija stvarno treba (često piše u zadatku ili u ConfigMapu), i ostavi tačno to. Brisanje cijelog bindinga je pogrešno ako aplikacija mora i dalje da radi.

### Specijalni subjekti

| Subjekt | Napomena |
|---|---|
| grupa `system:masters` | zaobilazi RBAC potpuno; ne može se ograničiti brisanjem bindinga. Certifikat sa `O=system:masters` treba čuvati kao root lozinku |
| `system:anonymous`, grupa `system:unauthenticated` | binding za njih znači da svako bez kredencijala ima te dozvole |
| grupa `system:authenticated` | svaki korisnik i svaki ServiceAccount u klasteru |
| grupa `system:serviceaccounts` / `system:serviceaccounts:<ns>` | svi ServiceAccounti u klasteru / u namespaceu |
| ServiceAccount `default` | koristi ga svaki pod bez `serviceAccountName`; binding za njega daje dozvole svim takvim podovima |

## Pregled: ko šta smije

### kubectl auth can-i

```bash
# da li konkretan ServiceAccount smije nešto
kubectl auth can-i list secrets -n finance --as=system:serviceaccount:finance:reporter
kubectl auth can-i create pods/exec -n finance --as=system:serviceaccount:finance:reporter
kubectl auth can-i '*' '*' --as=system:serviceaccount:finance:reporter      # cluster-admin?

# sve dozvole subjekta u namespaceu
kubectl auth can-i --list -n finance --as=system:serviceaccount:finance:reporter

# korisnik i grupa
kubectl auth can-i get nodes --as=jane --as-group=dev-team
kubectl auth whoami                  # ko sam ja (korisnik, grupe)
```

Format za ServiceAccount u `--as` je uvijek `system:serviceaccount:<namespace>:<ime>`. Za `--as` treba imati `impersonate`, što admin na ispitu ima.

### Pregled bindinga

```bash
kubectl get rolebindings,clusterrolebindings -A -o wide
# NAMESPACE  NAME              ROLE                        AGE  USERS  GROUPS  SERVICEACCOUNTS
# finance    reporter-binding  ClusterRole/cluster-admin   3d                  finance/reporter
```

Kolone `USERS`, `GROUPS` i `SERVICEACCOUNTS` odmah pokazuju kome je dodijeljeno. Traženje opasnih dodjela:

```bash
# ko ima cluster-admin
kubectl get clusterrolebindings -o wide | grep -w cluster-admin
kubectl get rolebindings -A -o wide | grep -w cluster-admin

# svi bindingi za jedan ServiceAccount
kubectl get rolebindings,clusterrolebindings -A -o wide | grep 'finance/reporter'

# uloge sa wildcard dozvolama ili opasnim glagolima
kubectl get clusterroles -o yaml | grep -n -B8 -E "'\*'|escalate|bind|impersonate"
kubectl -n finance describe role reporter
```

`describe role` prikazuje tabelu `Resources | Non-Resource URLs | Resource Names | Verbs`, što se brže čita od YAML-a.

> **Na ispitu:** `kubectl get rolebindings,clusterrolebindings -A -o wide | grep <sa>` je najbrži način da nađeš sve odakle ServiceAccount dobija dozvole. Ne zaboravi ClusterRoleBinding: on daje dozvole u **svim** namespaceovima.

### RoleBinding na ClusterRole

| Kombinacija | Domet dozvola |
|---|---|
| Role + RoleBinding | jedan namespace |
| ClusterRole + RoleBinding | dozvole iz ClusterRole, ali samo u namespaceu RoleBindinga |
| ClusterRole + ClusterRoleBinding | cijeli klaster, uključujući cluster-scoped resurse (nodes, PV, namespaces) |
| Role + ClusterRoleBinding | nije moguće |

RoleBinding na ClusterRole je dobar obrazac: ugrađene uloge `view` i `edit` se koriste po namespaceu bez kopiranja. Ali RoleBinding na `cluster-admin` daje potpunu kontrolu nad namespaceom, uključujući Secrete i RBAC unutar njega.

## Smanjivanje dozvola

Primjer: ServiceAccount `reporter` u `finance` ima `edit` u cijelom klasteru, a treba samo da čita podove i jedan ConfigMap.

```bash
# 1. trenutno stanje
kubectl get clusterrolebindings -o wide | grep finance/reporter
kubectl auth can-i --list -n finance --as=system:serviceaccount:finance:reporter

# 2. nova, uska uloga
kubectl -n finance create role reporter-read \
  --verb=get,list --resource=pods \
  --dry-run=client -o yaml > role.yaml
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: reporter-read
  namespace: finance
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["report-config"]
  verbs: ["get"]
```

```bash
kubectl apply -f role.yaml
kubectl -n finance create rolebinding reporter-read \
  --role=reporter-read --serviceaccount=finance:reporter

# 3. ukloni stari, preširok binding
kubectl delete clusterrolebinding reporter-edit

# 4. provjera
kubectl auth can-i list pods -n finance --as=system:serviceaccount:finance:reporter      # yes
kubectl auth can-i list secrets -n finance --as=system:serviceaccount:finance:reporter   # no
kubectl auth can-i list pods -n default --as=system:serviceaccount:finance:reporter      # no
```

`resourceNames` ne može ograničiti `create` ni `deletecollection` (ime objekta nije poznato u zahtjevu), a `list` i `watch` samo kad klijent traži jedan objekat field selectorom `metadata.name`. Zato ga koristi uz `get`, `update`, `patch`, `delete`.

Ako zadatak kaže da izmijeniš postojeću ulogu umjesto pravljenja nove, `kubectl edit role` ili `kubectl edit clusterrole`. Pazi: izmjena ClusterRole utiče na **sve** bindinge koji je koriste.

> **Na ispitu:** prije brisanja ClusterRole provjeri ko je još koristi: `kubectl get rolebindings,clusterrolebindings -A -o wide | grep <ime-uloge>`. Ugrađene uloge (`system:*`, `cluster-admin`, `admin`, `edit`, `view`) nikad ne mijenjaj; mijenjaj bindinge.

## ServiceAccount

**ServiceAccount** je identitet procesa u podu. Pod se API serveru predstavlja tokenom tog ServiceAccounta. Ime subjekta u RBAC-u je `system:serviceaccount:<ns>:<ime>`.

### default ServiceAccount

Svaki namespace automatski dobija ServiceAccount `default`. Pod bez `spec.serviceAccountName` ga koristi. Sam po sebi `default` nema dozvole osim API discoveryja, ali:

- kad neko „na brzinu“ veže ulogu za `default`, dobijaju je **svi** podovi u namespaceu,
- token se ipak montira u svaki pod, pa napadač ima validan kredencijal za dalje istraživanje.

Preporuka: `default` ne dobija nijednu dozvolu i ne montira token, a svaka aplikacija koja treba API dobija svoj ServiceAccount.

```bash
kubectl -n prod patch serviceaccount default -p '{"automountServiceAccountToken": false}'
```

### automountServiceAccountToken

Polje postoji na dva mjesta:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend-sa
  namespace: prod
automountServiceAccountToken: false     # podrazumijevano za sve podove ovog SA
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: prod
spec:
  serviceAccountName: backend-sa
  automountServiceAccountToken: false   # na nivou poda
  containers:
  - name: web
    image: nginx:1.27
```

| ServiceAccount | Pod | Token se montira? |
|---|---|---|
| nije postavljeno | nije postavljeno | da |
| `false` | nije postavljeno | ne |
| `false` | `true` | **da** (pod ima prednost) |
| nije postavljeno ili `true` | `false` | ne |

Vrijednost na Podu uvijek pobjeđuje. Zato za pod koji ne treba API postavi `false` direktno na pod (ili u `spec.template.spec` Deploymenta), da ga ne otvori kasnija izmjena ServiceAccounta.

Provjera:

```bash
kubectl -n prod get pod web -o jsonpath='{.spec.volumes[*].name}'; echo
# bez "kube-api-access-xxxxx" = token nije montiran
kubectl -n prod exec web -- ls /var/run/secrets/kubernetes.io/serviceaccount
# ls: cannot access ...: No such file or directory
```

> **Na ispitu:** `serviceAccountName` i `automountServiceAccountToken` postojećeg poda se ne mogu mijenjati. Za samostalni pod: `kubectl get pod web -o yaml > web.yaml`, izmjena, `kubectl replace --force -f web.yaml`. Za Deployment: `kubectl set serviceaccount deploy/backend backend-sa` ili `kubectl edit deploy` (pravi nove podove).

### Bound i projected tokeni

Od v1.24 Kubernetes više ne pravi automatski Secret sa trajnim tokenom za ServiceAccount. Pod dobija **bound token** kroz **projected** volumen koji kubelet održava:

```bash
kubectl -n prod get pod api -o yaml | grep -A12 'kube-api-access'
```

```yaml
  - name: kube-api-access-7x2kq
    projected:
      sources:
      - serviceAccountToken:
          expirationSeconds: 3607
          path: token
      - configMap:
          name: kube-root-ca.crt
          items:
          - key: ca.crt
            path: ca.crt
      - downwardAPI:
          items:
          - fieldRef:
              fieldPath: metadata.namespace
            path: namespace
```

Osobine bound tokena:

- **vremenski ograničen**: kubelet ga obnavlja prije isteka, a aplikacija treba ponovo čitati fajl,
- **vezan za pod**: kad se pod obriše, API server odbija token iako vrijeme nije isteklo,
- **ima audience**: token je namijenjen određenom primaocu (podrazumijevano API serveru).

Token je JWT. Payload se može pročitati (nije šifrovan, samo potpisan):

```bash
kubectl -n prod exec api -- cat /var/run/secrets/kubernetes.io/serviceaccount/token \
  | cut -d. -f2 | base64 -d 2>/dev/null; echo
# {"aud":[...],"exp":...,"kubernetes.io":{"namespace":"prod","pod":{"name":"api",...},
#  "serviceaccount":{"name":"api-sa",...}},"sub":"system:serviceaccount:prod:api-sa"}
```

Kad aplikacija treba token za drugog primaoca (npr. Vault), dodaj vlastiti projected volumen sa kratkim rokom i posebnim audience-om, umjesto da dijeli API token:

```yaml
spec:
  serviceAccountName: api-sa
  automountServiceAccountToken: false
  containers:
  - name: api
    image: myapp:1.0
    volumeMounts:
    - name: vault-token
      mountPath: /var/run/secrets/vault
      readOnly: true
  volumes:
  - name: vault-token
    projected:
      sources:
      - serviceAccountToken:
          path: token
          audience: vault
          expirationSeconds: 600      # minimum je 600 sekundi
```

Za ručno testiranje i za alate van klastera koristi kratkotrajan token:

```bash
kubectl -n prod create token api-sa --duration=10m
kubectl -n prod create token api-sa --audience=vault --bound-object-kind=Pod --bound-object-name=api
```

### Dugotrajni Secret tokeni

Stari način još postoji: Secret tipa `kubernetes.io/service-account-token` sa anotacijom koja imenuje ServiceAccount. Kontrolna ravan upisuje token koji **ne ističe**.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-sa-token
  namespace: prod
  annotations:
    kubernetes.io/service-account.name: api-sa
type: kubernetes.io/service-account-token
```

Zašto ih izbjegavati:

- token važi dok postoji Secret i ServiceAccount; procurio token je trajan pristup,
- nije vezan za pod ni za audience,
- svako ko smije `get`/`list` na Secrete u namespaceu ga može pročitati.

Pronalaženje i čišćenje:

```bash
kubectl get secrets -A --field-selector type=kubernetes.io/service-account-token
kubectl -n prod delete secret api-sa-token     # token odmah prestaje da važi
```

Kontroler `LegacyServiceAccountTokenCleanUp` u kube-controller-manageru označava i kasnije briše automatski generisane stare tokene koji se dugo ne koriste. Ručno napravljene treba ukloniti sam.

### Odvojen ServiceAccount po aplikaciji

```bash
kubectl -n prod create serviceaccount backend-sa
kubectl -n prod create role backend-cm --verb=get --resource=configmaps --resource-name=backend-config
kubectl -n prod create rolebinding backend-cm --role=backend-cm --serviceaccount=prod:backend-sa
kubectl -n prod set serviceaccount deploy/backend backend-sa
```

Svaka aplikacija sa svojim SA ima svoje dozvole. Kompromitacija jedne ne daje dozvole druge, a audit log jasno pokazuje ko je šta uradio.

| Praksa | Loše | Dobro |
|---|---|---|
| identitet | svi podovi koriste `default` | SA po aplikaciji |
| token | montiran svuda | `automountServiceAccountToken: false` gdje API nije potreban |
| vrsta tokena | Secret tipa `service-account-token` | bound projected token, `kubectl create token` |
| dozvole | ClusterRoleBinding na `edit`/`cluster-admin` | Role sa tačnim resursima, glagolima i `resourceNames` |

> **Na ispitu:** kad zadatak kaže „napravi SA i koristi ga u Deploymentu“, provjeri rezultat: `kubectl -n prod get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.serviceAccountName}{"\n"}{end}'`. Stari podovi zadržavaju stari SA dok ih Deployment ne zamijeni.

## Troubleshooting

| Simptom | Uzrok | Šta provjeriti |
|---|---|---|
| Aplikacija: `forbidden: User "system:serviceaccount:prod:api-sa" cannot list resource "pods"` | nedostaje dozvola ili je binding u drugom namespaceu | `kubectl auth can-i list pods -n prod --as=...`, `kubectl get rolebindings -n prod -o wide` |
| Aplikacija ne nalazi `/var/run/secrets/kubernetes.io/serviceaccount/token` | `automountServiceAccountToken: false` na SA ili podu | `kubectl get sa api-sa -o yaml`, `kubectl get pod -o yaml` |
| Pod se ne kreira: `serviceaccount "backend-sa" not found` | SA ne postoji u namespaceu Deploymenta | `kubectl -n prod get sa`; greška je u `kubectl describe rs` |
| Nakon smanjenja dozvola `can-i` i dalje vraća yes | postoji još jedan binding (često ClusterRoleBinding ili binding za grupu) | `kubectl get rolebindings,clusterrolebindings -A -o wide | grep` |
| Token iz Secreta i dalje radi nakon izmjene uloge | token je ispravan, dozvole se računaju po SA | ukloni binding ili obriši Secret |
| `kubectl create rolebinding` uspije, ali `can-i` kaže no | pogrešan format `--serviceaccount` (mora biti `ns:ime`) | `kubectl describe rolebinding` |

## Rezime

- Least privilege: Role umjesto ClusterRole, tačni resursi i glagoli, `resourceNames` gdje može, bez `*`.
- Opasne dozvole: `escalate`, `bind`, `impersonate`, `nodes/proxy`, `list`/`watch` na `secrets`, `create` na podove i workloade, `pods/exec`, `serviceaccounts/token`, CSR approval.
- Pregled: `kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa> -n <ns>` i `kubectl get rolebindings,clusterrolebindings -A -o wide`.
- Za smanjenje dozvola: napravi usku ulogu, veži je, ukloni preširok binding, provjeri sa `can-i` (yes za potrebno, no za ostalo).
- `default` SA ne dobija dozvole i ne montira token. Svaka aplikacija ima svoj SA.
- `automountServiceAccountToken: false` na SA ili podu; vrijednost na podu ima prednost.
- Bound projected tokeni su kratkotrajni i vezani za pod; dugotrajne Secret tokene (`kubernetes.io/service-account-token`) pronađi i obriši.
