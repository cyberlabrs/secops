## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 4 (**Minimize Microservice Vulnerabilities**, 20% ispita):

- **4.1 Use appropriate pod security standards**: nivoi **Pod Security Standards**, **Pod Security Admission** (oznake na namespaceu) i `securityContext` koji Pod čini usklađenim.
- **4.2 Manage Kubernetes secrets**: ko može pročitati **Secret**, kako ga čitati iz etcd-a, **EncryptionConfiguration** (enkripcija u mirovanju) i pravilno korištenje Secreta u Podu.

Tipični zadaci na ispitu:

- „Namespace `team-a` mora odbijati Podove koji ne zadovoljavaju nivo `baseline`, a upozoravati na `restricted`.“
- „Deployment `api` u namespaceu `secure` ne pravi Podove. Popravi ga tako da prođe `restricted` politiku.“
- „Pročitaj Secret `db-creds` direktno iz etcd-a i upiši lozinku u `/root/pass.txt`.“
- „Uključi enkripciju Secreta u mirovanju sa `aescbc`, ključ je dat. Svi postojeći Secreti moraju biti šifrovani.“
- „Pod koristi Secret kroz env varijable. Prebaci ga na read-only volumen.“

Iz CKA znaš RBAC i static Podove. Ovdje ih koristiš sa sigurnosnim ciljem: kontrolna ravan mora odbiti opasne Podove, a tajne ne smiju ležati u čitljivom obliku.

## Pod Security Standards: tri nivoa

**Pod Security Standards** (PSS) su tri unaprijed definisana skupa pravila. To nisu objekti u klasteru, nego dokument koji opisuje šta je dozvoljeno. Primjenjuje ih ugrađeni admission plugin **PodSecurity** (vidi dalje).

| Nivo | Namjena | Ukratko |
|---|---|---|
| **privileged** | Sistemske komponente (CNI, CSI, kube-proxy, monitoring agenti) | Bez ograničenja |
| **baseline** | Obične aplikacije, minimalna zaštita | Zabranjuje poznate eskalacije: host namespaceove, privileged, hostPath, hostPort, opasne capabilities |
| **restricted** | Osjetljive aplikacije, najbolja praksa | Sve iz baseline plus: non-root, bez eskalacije privilegija, drop ALL, obavezan seccomp, ograničeni tipovi volumena |

### Šta baseline zabranjuje

- `spec.hostNetwork`, `spec.hostPID`, `spec.hostIPC` postavljeni na `true`.
- `securityContext.privileged: true`.
- `capabilities.add` van sigurne liste (`AUDIT_WRITE`, `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `FSETID`, `KILL`, `MKNOD`, `NET_BIND_SERVICE`, `SETFCAP`, `SETGID`, `SETPCAP`, `SETUID`, `SYS_CHROOT`). Dakle `NET_ADMIN` ili `SYS_ADMIN` padaju.
- **hostPath** volumene i `hostPort` (osim 0).
- `seccompProfile.type: Unconfined` i AppArmor `Unconfined` (dozvoljeni su `RuntimeDefault` i `Localhost`, ili neodređeno).
- `procMount` različit od `Default`, nesigurne `sysctls`, prilagođene SELinux user/role vrijednosti.

### Šta restricted dodatno zahtijeva

| Kontrola | Polje | Dozvoljeno |
|---|---|---|
| Tipovi volumena | `spec.volumes[*]` | Samo `configMap`, `csi`, `downwardAPI`, `emptyDir`, `ephemeral`, `persistentVolumeClaim`, `projected`, `secret` |
| Eskalacija privilegija | `containers[*].securityContext.allowPrivilegeEscalation` | Mora biti `false` (eksplicitno) |
| Non-root | `runAsNonRoot` (Pod ili svaki kontejner) | `true` |
| Non-root UID | `runAsUser` | Neodređeno ili različito od 0 |
| Seccomp | `seccompProfile.type` | `RuntimeDefault` ili `Localhost`; **izostavljanje nije dozvoljeno** |
| Capabilities | `capabilities.drop` / `add` | `drop` mora sadržati `ALL`; `add` smije samo `NET_BIND_SERVICE` |

Bitne zamke:

- Kod restricted, `allowPrivilegeEscalation` mora biti **eksplicitno** `false`. Neodređeno ne prolazi.
- `seccompProfile` se može postaviti na nivou Poda (`spec.securityContext`) i tada važi za sve kontejnere.
- `runAsNonRoot` na nivou Poda pokriva sve kontejnere. `capabilities` i `allowPrivilegeEscalation` postoje **samo** na nivou kontejnera.
- Pravila važe i za `initContainers` i `ephemeralContainers`. Zaboravljen init kontejner je čest razlog odbijanja.

## securityContext: polja koja moraš znati napamet

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened
spec:
  securityContext:              # nivo Poda
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: nginxinc/nginx-unprivileged:1.27
    securityContext:            # nivo kontejnera
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

| Polje | Šta radi | Napomena |
|---|---|---|
| `runAsNonRoot: true` | Kubelet odbija da pokrene kontejner ako bi proces radio kao UID 0 | Ako slika ima `USER root` ili nema `USER`, a nije postavljen `runAsUser`, kontejner ne starta |
| `runAsUser` / `runAsGroup` | UID/GID procesa, nadjačava `USER` iz slike | Kontejner-nivo nadjačava Pod-nivo |
| `fsGroup` | Grupa vlasnik montiranih volumena | Samo Pod-nivo |
| `allowPrivilegeEscalation: false` | Postavlja `no_new_privs`; setuid binarni fajlovi ne mogu podići privilegije | Uvijek `true` ako je `privileged: true` ili postoji `CAP_SYS_ADMIN` |
| `privileged: true` | Kontejner dobija skoro sve što ima host (sve uređaje, sve capabilities) | Praktično root na čvoru |
| `capabilities.drop: ["ALL"]` | Uklanja sve Linux capabilities | Po potrebi vrati samo jednu (`add: ["NET_BIND_SERVICE"]`) |
| `readOnlyRootFilesystem: true` | Root FS kontejnera je read-only | Za pisanje dodaj `emptyDir` na `/tmp` ili sličnu putanju |
| `seccompProfile.type` | `RuntimeDefault`, `Localhost` (+ `localhostProfile`), `Unconfined` | Detaljno u modulu o AppArmoru i seccompu |

Kada `runAsNonRoot` blokira start, Pod ima stanje `CreateContainerConfigError`, a događaj kaže nešto poput `container has runAsNonRoot and image will run as root`. Rješenje je `runAsUser` sa ne-nula UID-om ili slika sa ne-root `USER`.

```bash
kubectl explain pod.spec.securityContext
kubectl explain pod.spec.containers.securityContext.capabilities
kubectl exec hardened -- id                      # uid=10001 gid=10001
kubectl exec hardened -- touch /test             # Read-only file system
kubectl exec hardened -- grep -E 'NoNewPrivs|CapEff' /proc/1/status
```

> **Na ispitu:** imperativno napravi kostur Poda (`kubectl run app --image=nginx --dry-run=client -o yaml > pod.yaml`), pa dodaj `securityContext`. Polja kopiraj iz stranice „Configure a Security Context for a Pod or Container“ (kubernetes.io/docs/tasks/configure-pod-container/security-context/). Pazi na nivo: `capabilities` na Pod-nivou ne postoji i `kubectl apply` će ga odbiti kao nepoznato polje.

## Pod Security Admission

**Pod Security Admission** (PSA) je ugrađeni admission kontroler `PodSecurity`, GA od v1.25 i uključen podrazumijevano. Konfiguriše se **oznakama na namespaceu**:

```text
pod-security.kubernetes.io/<MODE>: <LEVEL>
pod-security.kubernetes.io/<MODE>-version: <VERSION>
```

- `MODE`: `enforce`, `audit`, `warn`
- `LEVEL`: `privileged`, `baseline`, `restricted`
- `VERSION`: `latest` ili minor verzija Kubernetesa, npr. `v1.35` (ako je izostavljeno, važi `latest`)

| Mod | Efekat kod kršenja | Na šta se primjenjuje |
|---|---|---|
| **enforce** | Pod se **odbija** | Samo na Pod objekte |
| **audit** | Dodaje anotaciju u audit log događaj; zahtjev prolazi | Podovi i workload resursi (Deployment, Job…) |
| **warn** | Korisnik dobija upozorenje u terminalu; zahtjev prolazi | Podovi i workload resursi |

Ključna zamka: **enforce ne gleda Deployment**. Deployment sa lošim template-om biće kreiran bez greške, ali ReplicaSet neće moći napraviti Podove. Zato se `enforce` gotovo uvijek kombinuje sa `warn` na istom nivou, da odmah vidiš problem.

```bash
kubectl label ns team-a \
  pod-security.kubernetes.io/enforce=baseline \
  pod-security.kubernetes.io/enforce-version=v1.35 \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted

kubectl get ns team-a --show-labels
```

Isto deklarativno:

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

Pokušaj privilegovanog Poda u tom namespaceu:

```bash
kubectl -n team-a run bad --image=nginx --privileged
# Error from server (Forbidden): pods "bad" is forbidden:
#   violates PodSecurity "baseline:v1.35": privileged (container "bad" must not set securityContext.privileged=true)
```

Poruka tačno nabraja šta treba popraviti, pa je pročitaj pažljivo umjesto da pogađaš.

### Provjera prije uvođenja

Prije nego što postaviš `enforce` na namespace sa postojećim Podovima, pogledaj ko bi pao. Server-side dry run ne mijenja ništa, ali vraća upozorenja za postojeće Podove:

```bash
kubectl label --dry-run=server --overwrite ns team-a \
  pod-security.kubernetes.io/enforce=restricted
```

Postojeći Podovi se **ne gase** kad postaviš `enforce`. Pravilo važi za nove Podove (i za Podove koje kontroler ponovo pravi).

### Deployment koji ne pravi Podove

```bash
kubectl -n secure get deploy api            # READY 0/2
kubectl -n secure get rs                    # DESIRED 2, CURRENT 0
kubectl -n secure describe rs -l app=api | tail
# Warning  FailedCreate  ... violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false ...
kubectl -n secure get events --field-selector reason=FailedCreate
```

Popravljaš template Deploymenta (`kubectl -n secure edit deploy api`), ne ReplicaSet.

### AdmissionConfiguration: podrazumijevane vrijednosti i izuzeci

Namespace bez oznaka dobija podrazumijevanu vrijednost `privileged` za sva tri moda. To možeš promijeniti za cijeli klaster fajlom koji kube-apiserver čita preko `--admission-control-config-file`:

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

- Oznake na namespaceu imaju prednost nad `defaults`.
- **Izuzeci** (`exemptions`) potpuno preskaču provjeru: po korisničkom imenu, po imenu RuntimeClass-a i po namespaceu.
- Ne izuzimaj servisne naloge kontrolera (npr. `system:serviceaccount:kube-system:replicaset-controller`): time bi izuzeo svakoga ko smije praviti Deployment.
- Fajl se montira u static Pod kube-apiservera kao `hostPath` volumen, isto kao audit politika ili EncryptionConfiguration. Ako fajl već postoji (npr. zbog ImagePolicyWebhook), dodaješ novi plugin u istu `plugins` listu.

> **Na ispitu:** za namespace zadatke ne treba ti AdmissionConfiguration; dovoljno je `kubectl label ns`. Pazi na tačan pravopis oznake: `pod-security.kubernetes.io/enforce`, ne `podsecurity` ni `pod-security.kubernetes.io/enforced`. Pogrešna oznaka se tiho prihvati i ništa ne radi.

## Secreti: šta zaista štite

**Secret** je objekat sa poljem `data` u kojem su vrijednosti **base64** kodirane. Base64 je kodiranje, ne enkripcija:

```bash
kubectl -n app create secret generic db-creds \
  --from-literal=user=admin --from-literal=password='S3cr3t!'
kubectl -n app get secret db-creds -o jsonpath='{.data.password}' | base64 -d
# S3cr3t!
```

Zaštita Secreta zavisi od tri sloja:

1. **RBAC**: ko smije `get`/`list`/`watch` Secrete preko API-ja.
2. **Enkripcija u mirovanju**: šta piše u etcd-u.
3. **Način upotrebe u Podu**: env ili volumen, ko ima pristup čvoru.

### Ko može pročitati Secret

| Put | Primjer | Zašto je opasno |
|---|---|---|
| `get secrets` | Role sa `verbs: [get]` | Direktno čitanje |
| `list secrets` | `verbs: [list]` | `list` vraća **cijele objekte sa vrijednostima**, ne samo imena |
| `watch secrets` | `verbs: [watch]` | Isto kao list, kroz stream |
| `create pods` u namespaceu | Developer koji smije praviti Podove | Može montirati **bilo koji** Secret iz tog namespacea u svoj Pod i ispisati ga |
| `create pods/exec` | Exec u Pod koji već ima Secret | Čita montirani fajl ili env |
| Pristup čvoru (root) | SSH na `node01` | Secreti Podova na čvoru su u tmpfs pod `/var/lib/kubelet/pods/` |
| Pristup etcd-u | Certifikati iz `/etc/kubernetes/pki/etcd/` | Bez enkripcije, sve je čitljivo |

```bash
kubectl auth can-i list secrets -n app --as=system:serviceaccount:app:default
kubectl auth can-i create pods -n app --as=jane
kubectl get rolebindings,clusterrolebindings -A -o wide | grep -i secret
```

Zato pravo `create pods` u namespaceu praktično znači i čitanje svih Secreta u njemu. Osjetljive Secrete drži u namespaceu u kojem developeri ne prave Podove.

### Čitanje Secreta direktno iz etcd-a

Na `controlplane` čvoru, sa certifikatima iz kubeadm instalacije:

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/app/db-creds | hexdump -C | head -20
```

Ključ ima oblik `/registry/secrets/<namespace>/<ime>`. Bez enkripcije u izlazu vidiš `S3cr3t!` kao čist tekst (vrijednosti su u etcd-u zapisane binarno, u protobuf formatu, ne u base64). Putanje certifikata uvijek provjeri u `/etc/kubernetes/manifests/etcd.yaml` ili `kube-apiserver.yaml` (flagovi `--etcd-cafile`, `--etcd-certfile`, `--etcd-keyfile`).

> **Na ispitu:** ako zadatak traži „pročitaj Secret iz etcd-a“, dovoljno je `etcdctl get … --print-value-only` i potražiti vrijednost u izlazu. Kad Secret nije šifrovan, lozinka je vidljiva odmah. Ne zaboravi `--endpoints` ako etcd ne sluša na podrazumijevanoj adresi.

## Enkripcija u mirovanju: EncryptionConfiguration

kube-apiserver može šifrovati resurse prije upisa u etcd. Konfiguracija je fajl tipa **EncryptionConfiguration** koji se predaje flagom `--encryption-provider-config`.

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
        secret: <base64 od 32 slučajna bajta>
  - identity: {}
```

Ključ generišeš ovako:

```bash
head -c 32 /dev/urandom | base64
```

### Provideri

| Provider | Šta je | Napomena |
|---|---|---|
| `identity` | Bez enkripcije, čist tekst | Podrazumijevano ponašanje bez konfiguracije |
| `aescbc` | AES-CBC sa PKCS#7 paddingom, ključ 32 bajta | Čest na ispitu; dokumentacija ga ne preporučuje za nove sisteme zbog padding oracle napada |
| `aesgcm` | AES-GCM | Brz, ali ključ treba često rotirati |
| `secretbox` | XSalsa20 + Poly1305, ključ 32 bajta | Moderan lokalni provider |
| `kms` (`apiVersion: v2`) | Envelope enkripcija: ključ za podatke šifruje eksterni KMS | Preporučeno za produkciju; KMS v2 je GA od v1.29, KMS v1 je zastario i isključen podrazumijevano |

Kod lokalnih providera (`aescbc`, `aesgcm`, `secretbox`) ključ leži u fajlu na control plane čvoru. Ko ima root na `controlplane`, ima i ključ. KMS rješava upravo to: ključ ostaje u eksternom servisu (Vault, cloud KMS).

```yaml
providers:
- kms:
    apiVersion: v2
    name: vault-kms
    endpoint: unix:///var/run/kmsplugin/socket.sock
    timeout: 3s
- identity: {}
```

### Redoslijed providera: najvažnije pravilo

- **Prvi provider u listi koristi se za upis.** Unutar njega, prvi ključ šifruje.
- Pri čitanju se provideri (i ključevi) probaju redom dok jedan ne uspije.
- Ako je `identity: {}` **prvi**, novi Secreti se upisuju nešifrovano, iako je `aescbc` u listi.
- `identity` na kraju liste služi da API server može pročitati stare, još nešifrovane Secrete.

### Uključivanje na kubeadm klasteru, korak po korak

```bash
# 1) fajl na controlplane čvoru
mkdir -p /etc/kubernetes/enc
vim /etc/kubernetes/enc/enc.yaml        # sadržaj kao gore, ključ iz head -c 32 /dev/urandom | base64

# 2) backup manifesta pa izmjena
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

U manifestu dodaj flag, volumeMount i volumen:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --encryption-provider-config=/etc/kubernetes/enc/enc.yaml
    # ... ostali flagovi
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
# 3) sačekaj restart static Poda
watch crictl ps --name kube-apiserver
kubectl get --raw=/readyz

# 4) ponovo upiši sve postojeće Secrete (sada se šifruju)
kubectl get secrets -A -o json | kubectl replace -f -

# 5) provjeri u etcd-u
ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/app/db-creds | hexdump -C | head
# ... k8s:enc:aescbc:v1:key1: ... (dalje nečitljivi bajtovi)
```

Prefiks `k8s:enc:<provider>:v1:<ime ključa>` dokazuje da je zapis šifrovan (za aescbc: `k8s:enc:aescbc:v1:key1`). Ako i dalje vidiš lozinku kao tekst, Secret nije ponovo upisan ili je `identity` prvi u listi.

Enkripcija važi samo za **nove upise**. Zato je korak 4 obavezan: `kubectl replace` čita svaki Secret i upisuje ga nazad, pa API server koristi prvi provider. Komanda je sigurna za ponavljanje. Ako javi konflikt zbog istovremene izmjene, samo je pokreni ponovo.

### Rotacija ključa i isključivanje

1. Dodaj novi ključ kao **drugi** u `keys` i restartuj sve API servere (svi moraju umjeti dešifrovati novim ključem).
2. Pomjeri novi ključ na **prvo** mjesto i ponovo restartuj.
3. `kubectl get secrets -A -o json | kubectl replace -f -`.
4. Ukloni stari ključ.

Za isključivanje enkripcije stavi `identity: {}` na prvo mjesto (stari provider ostaje iza njega), uradi `replace` svih Secreta, pa tek onda ukloni konfiguraciju.

> **Na ispitu:** kad kube-apiserver ne starta nakon izmjene, gledaj logove kontejnera: `crictl ps -a | grep apiserver`, pa `crictl logs <id>`, ili `/var/log/pods/kube-system_kube-apiserver-*/`. Najčešće greške: putanja u flagu ne odgovara `mountPath`, ključ nije base64 dužine 32 bajta, pogrešno uvlačenje YAML-a.

## Secret u Podu: volumen ili env

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

| | Env varijable (`env.valueFrom.secretKeyRef`, `envFrom`) | Volumen (`volumes[].secret`) |
|---|---|---|
| Gdje živi vrijednost | U okruženju procesa (`/proc/<pid>/environ`) | Fajl u tmpfs-u (memorija, ne disk) |
| Curenje | Lako: logovi, crash dump, child procesi, `env` u debug sesiji, `crictl inspect` | Teže; fajl čita samo onaj ko ga otvori |
| Ažuriranje | Ne mijenja se dok se Pod ne restartuje | Kubelet osvježava sadržaj (osim kod `subPath`) |
| Dozvole | Nema | `defaultMode`, `readOnly: true` |

Volumen je bolji izbor. Alati za statičku analizu (npr. kubesec) env iz Secreta označavaju kao rizik.

Dodatne mjere:

- `immutable: true` na Secretu sprječava izmjenu (i smanjuje opterećenje API servera); za promjenu moraš obrisati i ponovo kreirati.
- `automountServiceAccountToken: false` za Podove kojima ne treba API token (detaljno u modulu o ServiceAccountima).
- Ne čuvaj tajne u ConfigMapama, anotacijama ni u slici.

### Eksterni menadžeri tajni (ukratko)

U produkciji se tajne često drže van Kubernetesa:

- **HashiCorp Vault** (Agent injector ili CSI provider),
- **Secrets Store CSI Driver** sa providerima za cloud (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager): tajna se montira kao CSI volumen,
- **External Secrets Operator**: sinhronizuje eksternu tajnu u običan Secret.

Na ispitu se ovo ne konfiguriše, ali trebaš znati da rješavaju centralnu rotaciju i reviziju pristupa, a da ključ za enkripciju ne leži na control plane čvoru.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| `Error from server (Forbidden) ... violates PodSecurity` | Pročitaj listu prekršaja u poruci; dopuni `securityContext` za **sve** kontejnere, i init |
| Deployment 0/N, nema Podova | `kubectl describe rs`, `kubectl get events`: `FailedCreate` sa PodSecurity porukom |
| `CreateContainerConfigError` | `runAsNonRoot: true`, a slika radi kao root; dodaj `runAsUser` ili koristi ne-root sliku |
| Kontejner pada sa `Read-only file system` | `readOnlyRootFilesystem: true`; dodaj `emptyDir` za `/tmp`, `/var/cache/nginx`, `/var/run` |
| Oznaka PSA „ne radi“ | Pravopis ključa i vrijednosti (`kubectl get ns X --show-labels`); izuzetak u AdmissionConfiguration |
| kube-apiserver ne starta nakon EncryptionConfiguration | `crictl logs`, mount putanja, dužina ključa, YAML |
| U etcd-u i dalje čist tekst | `identity` prvi? Nisi uradio `kubectl get secrets -A -o json \| kubectl replace -f -`? |
| Pod `ContainerCreating`, „secret not found“ | Secret u drugom namespaceu ili pogrešno ime ključa; Secreti se ne dijele između namespaceova |

> **Na ispitu:** nakon svake izmjene `kube-apiserver.yaml` čekaj da se API vrati (`kubectl get nodes` ponovo radi) prije sljedećeg zadatka. Ako se ne vrati za 2 minute, vrati backup i kreni ispočetka umjesto da gubiš vrijeme.

## Rezime

- PSS ima tri nivoa: privileged, baseline, restricted. Restricted traži `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, seccomp `RuntimeDefault`/`Localhost` i samo bezbjedne tipove volumena.
- PSA se uključuje oznakama `pod-security.kubernetes.io/<enforce|audit|warn>` (i `-version`) na namespaceu; `enforce` odbija samo Podove, ne Deploymente.
- AdmissionConfiguration sa `PodSecurityConfiguration` postavlja klasterske podrazumijevane vrijednosti i izuzetke (usernames, runtimeClasses, namespaces).
- Base64 nije enkripcija; `list`/`watch` secrets i `create pods` u namespaceu daju pristup vrijednostima Secreta.
- EncryptionConfiguration (`apiserver.config.k8s.io/v1`) + `--encryption-provider-config`: prvi provider piše, `identity` na prvom mjestu znači bez enkripcije.
- Postojeće Secrete ponovo šifruješ sa `kubectl get secrets -A -o json | kubectl replace -f -`, a provjeravaš prefiks `k8s:enc:aescbc:v1:` u `etcdctl get`.
- Secret montiraj kao read-only volumen umjesto env varijabli; za produkciju razmotri KMS v2 ili eksterni menadžer tajni.
