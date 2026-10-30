## Šta ovaj modul pokriva

Modul pokriva cilj **1.1** iz domena 1 (**Cluster Architecture, Installation & Configuration**, 25% ispita): **Manage role based access control (RBAC)**.

Tipični zadaci na ispitu:

- „Napravi ServiceAccount `deployer` u namespaceu `ci` i daj mu pravo da kreira i ažurira Deploymente samo u tom namespaceu.“
- „Korisnik `jana` treba da čita logove Podova u namespaceu `dev`, ali ne smije raditi `exec`.“
- „Napravi korisnika preko CertificateSigningRequest API-ja, odobri CSR i dodaj ga u kubeconfig.“
- „Provjeri da li ServiceAccount `monitor` smije da lista Nodeove. Ako ne smije, popravi.“

Zadaci su kratki (3–6 bodova), ali traže preciznost: pogrešan namespace ili pogrešno ime subjekta znači nula bodova. Uvijek završi provjerom sa `kubectl auth can-i`.

## Autentifikacija vs autorizacija

Svaki zahtjev ka **kube-apiserver**-u prolazi tri faze:

1. **Authentication** (ko si?): klijentski X.509 sertifikat, bearer token (ServiceAccount token), OIDC token i slično. Kubernetes **nema objekat User**: korisnik postoji samo kao ime (`CN`) u sertifikatu ili claim u tokenu.
2. **Authorization** (smiješ li?): na kubeadm klasteru `--authorization-mode=Node,RBAC`. **Node** autorizator obrađuje kubelete, **RBAC** sve ostalo.
3. **Admission control** (da li zahtjev treba izmijeniti ili odbiti?): mutating pa validating admission kontroleri.

| Faza | Pitanje | Greška |
|---|---|---|
| Authentication | Ko šalje zahtjev? | `401 Unauthorized` (`You must be logged in to the server`) |
| Authorization | Smije li to da radi? | `403 Forbidden` (`User "jana" cannot list resource "pods"...`) |
| Admission | Da li je zahtjev dozvoljen po politikama? | Poruka konkretnog kontrolera (npr. `exceeded quota`) |

Provjera identiteta trenutnog konteksta:

```bash
kubectl auth whoami
kubectl config current-context
```

> **Na ispitu:** svaki zadatak počinje komandom `kubectl config use-context <ime>`. Kopiraj je iz teksta zadatka i pokreni prije svega ostalog. RBAC rješenje u pogrešnom klasteru donosi nula bodova.

## RBAC objekti

RBAC ima četiri objekta u API grupi `rbac.authorization.k8s.io/v1`:

| Objekat | Scope | Šta sadrži |
|---|---|---|
| **Role** | namespace | Pravila (`rules`) za resurse u jednom namespaceu |
| **ClusterRole** | cijeli klaster | Pravila za cluster-scoped resurse (Node, PersistentVolume, Namespace), non-resource URL-ove (`/healthz`) ili namespaced resurse u svim namespaceovima |
| **RoleBinding** | namespace | Veže Role **ili ClusterRole** za subjekte, važi samo u svom namespaceu |
| **ClusterRoleBinding** | cijeli klaster | Veže ClusterRole za subjekte u cijelom klasteru |

RBAC je **samo additive**: nema `deny` pravila. Ako nijedno pravilo ne dozvoljava akciju, akcija je odbijena.

### Kombinacije role i bindinga

| Rola | Binding | Efekat |
|---|---|---|
| Role | RoleBinding | Prava u namespaceu bindinga (rola mora biti u istom namespaceu) |
| ClusterRole | RoleBinding | Prava iz ClusterRole, ali **samo u namespaceu bindinga** |
| ClusterRole | ClusterRoleBinding | Prava u svim namespaceovima i nad cluster-scoped resursima |
| Role | ClusterRoleBinding | **Nije moguće** (`roleRef` ClusterRoleBindinga mora biti ClusterRole) |

Kombinacija **ClusterRole + RoleBinding** je česta: jednom definišeš rolu (npr. ugrađene `view`, `edit`, `admin`) i koristiš je u više namespaceova.

### Role

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
- apiGroups: [""]            # "" = core grupa (pods, services, configmaps, secrets)
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

Isto imperativno (brže na ispitu):

```bash
kubectl create role pod-reader -n dev \
  --verb=get,list,watch --resource=pods,pods/log
kubectl create role pod-reader -n dev \
  --verb=get,list,watch --resource=pods --dry-run=client -o yaml > role.yaml
```

Za resurse van core grupe navodi se `resurs.grupa`, npr. `--resource=deployments.apps`. Kad koristiš samo `--resource=deployments`, kubectl sam pronađe grupu preko discovery-ja.

### RoleBinding i ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jana-pod-reader
  namespace: dev
subjects:
- kind: User
  name: jana
  apiGroup: rbac.authorization.k8s.io
- kind: ServiceAccount
  name: monitor
  namespace: observability     # SA može biti iz drugog namespacea
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# Role + RoleBinding
kubectl create rolebinding jana-pod-reader -n dev --role=pod-reader --user=jana
# ClusterRole + RoleBinding (prava samo u namespaceu dev)
kubectl create rolebinding ci-edit -n dev --clusterrole=edit --serviceaccount=ci:deployer
# ClusterRoleBinding za grupu
kubectl create clusterrolebinding ops-view --clusterrole=view --group=ops
```

Flag `--serviceaccount` traži format **`namespace:ime`**. Česta greška je samo `--serviceaccount=deployer`, što kubectl odbija.

**`roleRef` je immutable.** Ako treba promijeniti rolu na koju binding pokazuje, obriši binding i napravi novi. Subjekte možeš mijenjati (`kubectl edit`, `kubectl set subject`).

> **Na ispitu:** ne piši RBAC YAML ručno. `kubectl create role/clusterrole/rolebinding/clusterrolebinding` sa `-h` daje primjere za sve flagove. Ako zadatak traži fajl, dodaj `--dry-run=client -o yaml > fajl.yaml`.

## Verbs, resursi i subresursi

| Verb | HTTP | Primjer komande |
|---|---|---|
| `get` | GET jedan objekat | `kubectl get pod web` |
| `list` | GET kolekcija | `kubectl get pods` |
| `watch` | GET `?watch=true` | `kubectl get pods -w` |
| `create` | POST | `kubectl create`, `kubectl apply` (novi objekat) |
| `update` | PUT | `kubectl replace`, `kubectl edit` |
| `patch` | PATCH | `kubectl apply` (postojeći), `kubectl scale`, `kubectl label` |
| `delete` | DELETE jedan | `kubectl delete pod web` |
| `deletecollection` | DELETE kolekcija | API klijenti i kontroleri (npr. čišćenje namespacea) |

Posebni verbovi: `impersonate` (za `--as`), `bind` i `escalate` (na `roles`/`clusterroles`), `approve` (na `signers` za CSR). Džoker `*` znači sve verbove ili sve resurse; izbjegavaj ga osim kad zadatak to traži.

**Subresursi** se pišu kao `resurs/subresurs`:

| Subresurs | Komanda koja ga koristi | Potreban verb |
|---|---|---|
| `pods/log` | `kubectl logs` | `get` |
| `pods/exec` | `kubectl exec` | `create` (i `get` na `pods`) |
| `pods/portforward` | `kubectl port-forward` | `create` |
| `deployments/scale` | `kubectl scale deploy` | `patch`/`update` |
| `pods/status`, `nodes/status` | kontroleri, kubelet | `update`/`patch` |

Pravo na `pods` **ne daje** automatski pravo na `pods/log` ni `pods/exec`. Obrnuto, ako neko ima `create` na `pods/exec`, praktično može izvršiti bilo šta u kontejneru, pa ovo tretiraj kao privilegovano pravo.

### resourceNames

`resourceNames` sužava pravilo na konkretne objekte:

```yaml
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config"]
  verbs: ["get", "update", "patch"]
```

```bash
kubectl create role app-config-editor -n dev --verb=get,update,patch \
  --resource=configmaps --resource-name=app-config
```

Ograničenja:

- `create` na top-level resursu ne može se suziti imenom (ime novog objekta nije poznato u trenutku autorizacije). Na subresursima može (npr. `pods/exec` za određeni Pod).
- `deletecollection` se ne može suziti imenom.
- `list`/`watch` sa `resourceNames` rade samo ako klijent šalje field selector `metadata.name=...`, pa obični `kubectl get configmaps` vraća 403.

## Ugrađene i agregirane ClusterRole

Ugrađene user-facing ClusterRole:

| ClusterRole | Prava |
|---|---|
| `cluster-admin` | Sve. Podrazumijevano vezana za grupu `system:masters` |
| `admin` | Gotovo sve u namespaceu, uključujući Role i RoleBinding (preko RoleBindinga) |
| `edit` | Čitanje i pisanje većine objekata, bez Role/RoleBinding |
| `view` | Samo čitanje, bez Secreta i RBAC objekata |

`admin`, `edit` i `view` su **agregirane** ClusterRole. ClusterRole sa poljem `aggregationRule` nema ručno pisana pravila: kontroler u control planeu skuplja `rules` iz svih ClusterRole koje imaju odgovarajuću labelu.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.kurs.local/aggregate-to-monitoring: "true"
rules: []   # control plane popunjava i prepisuje
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-endpoints
  labels:
    rbac.kurs.local/aggregate-to-monitoring: "true"
rules:
- apiGroups: ["discovery.k8s.io"]
  resources: ["endpointslices"]
  verbs: ["get", "list", "watch"]
```

```bash
kubectl create clusterrole monitoring \
  --aggregation-rule="rbac.kurs.local/aggregate-to-monitoring=true"
```

Proširenje ugrađene `view` role za CRD (npr. da `view` vidi i `backups.kurs.local`): napravi ClusterRole sa labelom `rbac.authorization.k8s.io/aggregate-to-view: "true"`. Ručne izmjene `rules` u agregiranoj roli kontroler odmah prepiše.

> **Na ispitu:** ako zadatak kaže „dodaj pravo u postojeću agregiranu rolu“, ne mijenjaj nju direktno. Napravi novu ClusterRole sa labelom iz `aggregationRule` (vidi je sa `kubectl get clusterrole <ime> -o yaml`).

## ServiceAccount

**ServiceAccount** je identitet za procese u Podovima. Ime subjekta u RBAC-u je `system:serviceaccount:<namespace>:<ime>`, a svi SA iz namespacea su u grupi `system:serviceaccounts:<namespace>`. Svaki namespace ima SA `default`; Pod bez `spec.serviceAccountName` koristi njega.

```bash
kubectl create serviceaccount deployer -n ci
kubectl create rolebinding deployer-edit -n ci --clusterrole=edit --serviceaccount=ci:deployer
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ci-runner
  namespace: ci
spec:
  serviceAccountName: deployer
  containers:
  - name: runner
    image: busybox:1.37
    command: ["sleep", "3600"]
```

Na postojećem Deploymentu: `kubectl set serviceaccount deploy/web deployer -n ci`. `serviceAccountName` na postojećem Podu se ne može mijenjati; Pod se mora ponovo kreirati.

### Tokeni

Od v1.24 Kubernetes **ne pravi automatski Secret sa tokenom** za ServiceAccount. Umjesto toga:

- **kubelet** traži kratkotrajni token preko **TokenRequest API**-ja i montira ga kao **projected** volume u `/var/run/secrets/kubernetes.io/serviceaccount/` (`token`, `ca.crt`, `namespace`). Token je vezan za Pod (prestaje važiti kad se Pod obriše) i kubelet ga rotira.
- Ručno: `kubectl create token`.

```bash
kubectl create token deployer -n ci                    # podrazumijevano kratko trajanje (server odlučuje, tipično 1h)
kubectl create token deployer -n ci --duration=2h
kubectl create token deployer -n ci --audience=vault
kubectl create token deployer -n ci --bound-object-kind=Pod --bound-object-name=ci-runner
```

Token koristiš kao bearer token:

```bash
TOKEN=$(kubectl create token deployer -n ci)
kubectl --token="$TOKEN" --server=https://controlplane:6443 \
  --certificate-authority=/etc/kubernetes/pki/ca.crt get deploy -n ci
```

Dugotrajni token (samo kad nema drugog izbora, npr. stari CI sistem): Secret tipa `kubernetes.io/service-account-token` sa anotacijom, a control plane popuni `data.token`.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: deployer-token
  namespace: ci
  annotations:
    kubernetes.io/service-account.name: deployer
type: kubernetes.io/service-account-token
```

Vlastiti projected token sa drugom publikom i trajanjem:

```yaml
spec:
  serviceAccountName: deployer
  containers:
  - name: app
    image: nginx:1.28
    volumeMounts:
    - name: vault-token
      mountPath: /var/run/secrets/tokens
  volumes:
  - name: vault-token
    projected:
      sources:
      - serviceAccountToken:
          path: vault-token
          audience: vault
          expirationSeconds: 7200
```

### automountServiceAccountToken

Većini aplikacija ne treba pristup API-ju. Isključi automatsko montiranje tokena:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web
  namespace: dev
automountServiceAccountToken: false
```

Isto polje postoji u `Pod.spec`. Ako su postavljena oba, **Pod spec ima prednost**.

> **Na ispitu:** kad je subjekt ServiceAccount, testiraj sa `kubectl auth can-i ... --as=system:serviceaccount:<ns>:<ime>`. Zaboravljen prefiks `system:serviceaccount:` daje `no`, jer RBAC tada provjerava korisnika sa tim imenom.

## Korisnici preko X.509 sertifikata

Korisnik je autentifikovan ako ima klijentski sertifikat koji je potpisao CA klastera (`/etc/kubernetes/pki/ca.crt`). Iz sertifikata se čita:

- **CN** (Common Name) → korisničko ime,
- **O** (Organization) → grupe (može ih biti više).

Nikad ne stavljaj `O=system:masters` običnom korisniku: ta grupa zaobilazi RBAC (vezana je za `cluster-admin`) i ne može se oduzeti brisanjem bindinga.

### Postupak preko CertificateSigningRequest API-ja

```bash
# 1. Ključ i CSR (CN = korisnik, O = grupa)
openssl genrsa -out jana.key 3072
openssl req -new -key jana.key -out jana.csr -subj "/CN=jana/O=developers"

# 2. CSR objekat u klasteru
cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jana
spec:
  request: $(base64 < jana.csr | tr -d '\n')
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400
  usages:
  - client auth
EOF

# 3. Odobravanje
kubectl get csr                       # CONDITION: Pending
kubectl certificate approve jana      # CONDITION: Approved,Issued

# 4. Preuzimanje sertifikata (status.certificate je base64)
kubectl get csr jana -o jsonpath='{.status.certificate}' | base64 -d > jana.crt
openssl x509 -in jana.crt -noout -subject -enddate
```

Pravila za `spec`:

- `signerName: kubernetes.io/kube-apiserver-client` za korisničke sertifikate (obavezno polje u `certificates.k8s.io/v1`).
- `usages` mora sadržati `client auth`.
- `expirationSeconds` je opcion; minimum je 600 (10 minuta), a stvarno trajanje je manje od traženog i `--cluster-signing-duration` (podrazumijevano godinu dana).
- `request` je base64 kodiran PEM CSR, **u jednom redu**.

Odbijanje: `kubectl certificate deny jana`. Odobreni i odbijeni CSR objekti se automatski brišu nakon sat vremena, pa sertifikat preuzmi odmah.

### Kubeconfig

```bash
kubectl config set-credentials jana --client-key=jana.key \
  --client-certificate=jana.crt --embed-certs=true
kubectl config set-context jana@kubernetes --cluster=kubernetes --user=jana --namespace=dev
kubectl config get-contexts
kubectl --context=jana@kubernetes auth whoami
kubectl config use-context jana@kubernetes
```

`--embed-certs=true` kopira sadržaj fajlova u kubeconfig (`client-certificate-data`), pa kubeconfig radi i kad se fajlovi pomjere. Ime klastera (`--cluster=kubernetes`) provjeri sa `kubectl config get-clusters`.

Struktura kubeconfiga: `clusters` (server + CA), `users` (kredencijali), `contexts` (klaster + korisnik + namespace) i `current-context`. Fajl je `~/.kube/config`, ili putanja iz `KUBECONFIG`, ili `--kubeconfig`. Admin kubeconfig na kubeadm klasteru je `/etc/kubernetes/admin.conf`.

> **Na ispitu:** nakon `set-context` vrati se na admin kontekst prije sljedećeg zadatka. Ako ostaneš na kontekstu korisnika `jana`, sljedeće komande padaju sa `Forbidden`. Sigurnije je testirati sa `--context=` ili `--as=` nego sa `use-context`.

## kubectl auth can-i

`kubectl auth can-i` pita API server (SelfSubjectAccessReview) da li je akcija dozvoljena. Vraća `yes`/`no` i exit kod 0/1.

```bash
kubectl auth can-i create deployments -n ci
kubectl auth can-i get pods --subresource=log -n dev --as=jana
kubectl auth can-i create pods/exec -n dev --as=jana
kubectl auth can-i list nodes --as=system:serviceaccount:observability:monitor
kubectl auth can-i list pods -n dev --as=jana --as-group=developers
kubectl auth can-i --list -n dev --as=jana          # sva prava u namespaceu
kubectl auth can-i '*' '*' --all-namespaces         # da li sam cluster-admin
```

`--as` koristi **impersonation**: tvoj trenutni korisnik mora imati verb `impersonate` (admin ga ima). Odgovor zavisi od tačnog imena subjekta: RBAC ne provjerava da li korisnik `jana` uopšte postoji.

Koji binding daje pravo? Pretraga:

```bash
kubectl get rolebindings,clusterrolebindings -A -o wide | grep jana
kubectl describe rolebinding jana-pod-reader -n dev
kubectl describe role pod-reader -n dev
```

## Admission kontroleri ukratko

Nakon autorizacije zahtjev prolazi **admission** lanac: prvo **mutating** kontroleri (mogu izmijeniti objekat, npr. `ServiceAccount` dodaje token volume, `DefaultStorageClass` upisuje StorageClass), zatim **validating** (mogu samo odbiti, npr. `ResourceQuota`, `PodSecurity`). Ako ijedan odbije, zahtjev pada.

Uključivanje se radi flagom kube-apiservera u static Pod manifestu `/etc/kubernetes/manifests/kube-apiserver.yaml`:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --authorization-mode=Node,RBAC
    - --enable-admission-plugins=NodeRestriction
```

- `--enable-admission-plugins` dodaje pluginove na **podrazumijevanu** listu (ne zamjenjuje je). `--disable-admission-plugins` isključuje i podrazumijevane.
- kubeadm postavlja `--enable-admission-plugins=NodeRestriction`.
- **NodeRestriction** ograničava kubelet (`system:node:<ime>` u grupi `system:nodes`) da mijenja samo svoj Node objekat i Podove na svom čvoru, i ne dozvoljava mu postavljanje labela sa prefiksom `node-restriction.kubernetes.io/` i `node-role.kubernetes.io/`. Bez njega kompromitovan kubelet može mijenjati druge čvorove.

Nakon izmjene manifesta kubelet sam restartuje kube-apiserver. Prati:

```bash
watch crictl ps --name kube-apiserver
crictl logs $(crictl ps -a --name kube-apiserver -q | head -1)
```

> **Na ispitu:** prije izmjene `kube-apiserver.yaml` napravi kopiju van foldera `manifests` (`cp ... /root/kube-apiserver.yaml.bak`). Kopija u istom folderu bi bila tretirana kao još jedan static Pod. Ako apiserver ne ustane za minut, pogledaj logove kontejnera preko `crictl` i grešku u imenu plugina ili flaga.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| `error: You must be logged in to the server (Unauthorized)` | Autentifikacija: istekao/pogrešan sertifikat ili token, pogrešan CA u kubeconfigu, CSR nije potpisan istim CA |
| `... is forbidden: User "jana" cannot list resource "pods" in API group "" in the namespace "dev"` | Autorizacija: nema bindinga u tom namespaceu, pogrešan verb ili `apiGroups` |
| SA dobija `forbidden` iako binding postoji | `subjects[].namespace` u bindingu ne odgovara namespaceu SA, ili Pod koristi drugi SA (`kubectl get pod -o jsonpath='{.spec.serviceAccountName}'`) |
| `kubectl logs` vraća forbidden, `get pods` radi | Nedostaje `pods/log` |
| `kubectl exec` vraća forbidden | Nedostaje `create` na `pods/exec` |
| `list` sa `resourceNames` pada | List bez field selectora se ne može suziti imenom |
| CSR stoji u `Pending` | Nije odobren: `kubectl certificate approve` |
| CSR `Approved` ali nema sertifikata | Pogrešan `signerName` ili nedozvoljeni `usages` (provjeri `kubectl describe csr`) |
| Ne možeš izmijeniti `roleRef` | Immutable polje: obriši i ponovo napravi binding |

Poruka `forbidden` uvijek tačno kaže **ko** (User/ServiceAccount), **verb**, **resurs**, **API grupu** i **namespace**. To je spisak onoga što pravilo mora da sadrži.

## Rezime

- Kubernetes nema User objekat: korisnik je CN iz sertifikata (grupe iz O) ili identitet iz tokena; 401 je autentifikacija, 403 autorizacija.
- Role/RoleBinding su namespaced, ClusterRole/ClusterRoleBinding cluster-wide; ClusterRole vezana RoleBindingom daje prava samo u tom namespaceu.
- RBAC je samo additive; `roleRef` je immutable; subresursi (`pods/log`, `pods/exec`) traže posebna pravila.
- `resourceNames` ne radi za top-level `create`, `deletecollection` ni običan `list`.
- Agregirane ClusterRole (`aggregationRule`) proširuješ novom ClusterRole sa odgovarajućom labelom.
- ServiceAccount tokeni su kratkotrajni (TokenRequest, projected volume, `kubectl create token`); Secret sa tokenom se ne pravi automatski. `automountServiceAccountToken: false` na Podu ima prednost nad SA.
- Korisnik preko CSR API-ja: `openssl genrsa` + `openssl req -subj "/CN=.../O=..."`, CSR sa `signerName: kubernetes.io/kube-apiserver-client` i `usages: [client auth]`, `kubectl certificate approve`, `kubectl config set-credentials/set-context`.
- Svaki RBAC zadatak završi sa `kubectl auth can-i ... --as=...` (za SA `system:serviceaccount:ns:ime`).
