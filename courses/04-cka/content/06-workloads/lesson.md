## Šta ovaj modul pokriva

Modul pokriva tri cilja iz domena 2 (**Workloads & Scheduling**, 15% ispita):

- **2.1** Deploymenti, rolling update i rollback,
- **2.2** ConfigMap i Secret za konfiguraciju aplikacija,
- **2.4** primitivi za otporne i samoizlječive aplikacije (probe, restartPolicy, init i sidecar kontejneri, DaemonSet, StatefulSet, Job, CronJob, PodDisruptionBudget).

Tipični zadaci na ispitu su kratki i imperativni: „napravi Deployment sa 3 replike i image `nginx:1.27`“, „ažuriraj image i zabilježi razlog promjene“, „vrati Deployment na reviziju 2“, „montiraj ConfigMap kao fajl u `/etc/app`“, „dodaj readiness probe na port 8080“, „napravi CronJob koji se pokreće svakih 5 minuta“. Ovdje se boduje brzina: što više radiš imperativno (`kubectl create … --dry-run=client -o yaml`), to više vremena ostaje za troubleshooting.

> **Na ispitu:** Svaki zadatak počinje komandom `kubectl config use-context <ime>`. Kopiraj je iz teksta zadatka i pokreni prije bilo čega drugog. Rješenje u pogrešnom klasteru donosi nula bodova.

## Deployment i ReplicaSet

**Deployment** opisuje željeno stanje aplikacije: image, broj replika, strategiju ažuriranja. Deployment ne pravi Podove direktno. Za svaku verziju Pod template-a pravi novi **ReplicaSet**, a ReplicaSet održava tačan broj Podova. Kad promijeniš `spec.template` (image, env, resurse…), nastaje novi ReplicaSet i nova **revizija**. Promjena `spec.replicas` ne pravi novu reviziju.

```bash
k create deployment web --image=nginx:1.27 --replicas=3 --port=80
k create deployment web --image=nginx:1.27 --replicas=3 --dry-run=client -o yaml > web.yaml

k get deploy,rs,pods -l app=web
k scale deployment web --replicas=5
```

Hijerarhija vlasništva se vidi u `metadata.ownerReferences`: Pod pripada ReplicaSetu, ReplicaSet pripada Deploymentu. Ako ručno obrišeš Pod, ReplicaSet odmah pravi novi. To je osnovni oblik samoizlječenja.

### Strategije ažuriranja

| Strategija | Ponašanje | Kad je koristiti |
|---|---|---|
| **RollingUpdate** (podrazumijevana) | Postepeno diže nove i gasi stare Podove | Stateless aplikacije, bez prekida servisa |
| **Recreate** | Prvo ugasi sve stare, zatim diže nove | Aplikacija ne smije imati dvije verzije istovremeno (npr. migracija šeme, RWO volumen) |

Kod RollingUpdate dva parametra kontrolišu tempo (podrazumijevano oba `25%`):

- **maxSurge**: koliko Podova smije postojati **iznad** `replicas` tokom ažuriranja (zaokružuje se naviše),
- **maxUnavailable**: koliko Podova smije biti **nedostupno** u odnosu na `replicas` (zaokružuje se naniže).

Ne smiju oba biti 0. Primjer: `replicas: 4`, `maxSurge: 1`, `maxUnavailable: 0` znači da se u svakom trenutku vrti najviše 5 Podova i nikad manje od 4 spremna.

```yaml
spec:
  replicas: 4
  minReadySeconds: 5            # Pod mora biti Ready 5s da bi se računao kao dostupan
  revisionHistoryLimit: 10      # koliko starih ReplicaSetova se čuva za rollback
  progressDeadlineSeconds: 600  # nakon toga rollout dobija uslov Progressing=False
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

Za `type: Recreate` obriši blok `rollingUpdate`, inače API odbija manifest.

### Rollout: ažuriranje, praćenje i rollback

```bash
# promjena image-a (ime kontejnera "nginx" dolazi iz create deployment)
k set image deployment/web nginx=nginx:1.28

# razlog promjene se čuva u anotaciji i vidi u history
k annotate deployment/web kubernetes.io/change-cause="image 1.28" --overwrite

k rollout status deployment/web          # čeka kraj, vraća grešku ako rollout zapne
k rollout history deployment/web
k rollout history deployment/web --revision=2   # detalji jedne revizije

k rollout undo deployment/web                    # na prethodnu reviziju
k rollout undo deployment/web --to-revision=1    # na konkretnu reviziju

k rollout pause deployment/web     # više izmjena bez pokretanja rollouta
k set image deployment/web nginx=nginx:1.28
k set resources deployment/web -c nginx --requests=cpu=100m,memory=64Mi
k rollout resume deployment/web    # jedan rollout za sve izmjene

k rollout restart deployment/web   # novi Podovi bez promjene image-a
```

Bitni detalji:

- **CHANGE-CAUSE** kolona u `rollout history` čita anotaciju `kubernetes.io/change-cause` sa Deploymenta u trenutku kreiranja revizije. Flag `--record` je zastario; koristi `kubectl annotate`.
- `rollout undo` ne vraća „unazad“ istoriju: stara revizija dobija **novi broj** (npr. revizija 1 postaje 4).
- `rollout restart` dodaje anotaciju `kubectl.kubernetes.io/restartedAt` u Pod template, pa nastaje nova revizija. Koristi se kad treba pokupiti izmijenjen ConfigMap ili Secret koji je ubačen kroz env.
- Dok je Deployment pauziran, `rollout undo` ne radi; prvo `resume`.

> **Na ispitu:** Ime kontejnera u `kubectl set image` mora biti tačno. Ako nisi siguran, pogledaj ga sa `k get deploy web -o jsonpath='{.spec.template.spec.containers[*].name}'`. Pogrešno ime vraća grešku „unable to find container named …“.

### Troubleshooting rollouta

| Simptom | Šta pogledati |
|---|---|
| `rollout status` visi | `k get rs` (novi RS ima 0 Ready), `k describe pod` novog Poda |
| Novi Podovi u `ImagePullBackOff` | Pogrešan tag ili registry; `k rollout undo` vraća radnu verziju |
| Novi Podovi `Running` ali `0/1 Ready` | Readiness probe pada; rollout stoji jer `maxUnavailable` ne dozvoljava gašenje starih |
| `Progressing=False`, reason `ProgressDeadlineExceeded` | `k describe deploy web`, sekcija Conditions |

## ConfigMap i Secret

**ConfigMap** čuva neosjetljivu konfiguraciju (ključ/vrijednost ili cijele fajlove), **Secret** osjetljivu (lozinke, tokeni, TLS ključevi). Oba se troše na isti način: kao env varijable ili kao fajlovi u volumenu.

### Kreiranje

```bash
# ConfigMap
k create configmap app-config --from-literal=LOG_LEVEL=debug --from-literal=MODE=prod
k create configmap nginx-conf --from-file=nginx.conf                 # ključ = ime fajla
k create configmap nginx-conf --from-file=default.conf=./site.conf   # vlastito ime ključa
k create configmap app-env --from-env-file=app.env                   # svaka linija KEY=VALUE je ključ

# Secret
k create secret generic db-cred --from-literal=username=app --from-literal=password='S3cr3t!'
k create secret generic ssh-key --from-file=id_rsa=/root/.ssh/id_rsa
k create secret tls web-tls --cert=tls.crt --key=tls.key
k create secret docker-registry regcred --docker-server=registry.example.com \
  --docker-username=ci --docker-password='xyz'
```

Razlika između `--from-file` i `--from-env-file`: prvi pravi **jedan ključ** čiji je sadržaj cijeli fajl, drugi parsira fajl i pravi **po ključ za svaku liniju**.

| Tip Secreta | Pravi se sa | Upotreba |
|---|---|---|
| `Opaque` | `create secret generic` | Proizvoljni podaci |
| `kubernetes.io/tls` | `create secret tls` | Ključevi `tls.crt` i `tls.key` (Ingress, Gateway) |
| `kubernetes.io/dockerconfigjson` | `create secret docker-registry` | `imagePullSecrets` za privatni registry |

### Base64 nije enkripcija

Vrijednosti u `data` polju Secreta su samo **base64 kodirane**. Svako ko može pročitati Secret (`get secrets`) zna i lozinku:

```bash
k get secret db-cred -o jsonpath='{.data.password}' | base64 -d
```

Kad pišeš YAML ručno, koristi `stringData` (čist tekst; API server ga kodira) ili kodiraj sa `echo -n 'S3cr3t!' | base64` (bez `-n` kodiraš i znak novog reda, česta greška). Prava zaštita su RBAC (ko smije `get/list` Secrete), **encryption at rest** u etcd-u (EncryptionConfiguration na API serveru) i eksterni menadžeri tajni. Za SecOps: `list` na Secretima je isto što i `get` svih Secreta u namespace-u.

### Upotreba u Podu

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
    - name: DB_PASSWORD               # jedan ključ iz Secreta
      valueFrom:
        secretKeyRef:
          name: db-cred
          key: password
    - name: LOG_LEVEL                 # jedan ključ iz ConfigMap-e
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: LOG_LEVEL
    envFrom:                          # svi ključevi kao env varijable
    - configMapRef:
        name: app-env
    - secretRef:
        name: db-cred
      prefix: DB_
    volumeMounts:
    - name: conf
      mountPath: /etc/app             # svaki ključ postaje fajl u direktorijumu
      readOnly: true
    - name: nginx
      mountPath: /etc/nginx/conf.d/default.conf
      subPath: default.conf           # samo jedan fajl, ostatak direktorijuma ostaje
  volumes:
  - name: conf
    configMap:
      name: app-config
  - name: nginx
    configMap:
      name: nginx-conf
```

Secret se montira isto, samo sa `secret.secretName` umjesto `configMap.name`. Podrazumijevano svi ključevi postaju fajlovi; sa `items` (`key` + `path`) biraš samo neke, a sa `defaultMode: 0400` postavljaš dozvole.

Brže, bez editovanja YAML-a:

```bash
k set env deployment/web --from=configmap/app-config
k set env deployment/web --from=secret/db-cred --prefix=DB_
```

### Ažuriranje i immutable

| Način upotrebe | Vidi li Pod promjenu ConfigMap/Secreta? |
|---|---|
| `env` / `envFrom` | **Ne.** Varijable se čitaju pri startu kontejnera; treba `rollout restart` |
| Volumen (cijeli direktorijum) | **Da**, kubelet osvježava fajlove sa zakašnjenjem (do oko minut) |
| Volumen sa `subPath` | **Ne.** subPath montaža se nikad ne osvježava |

ConfigMap i Secret mogu biti **immutable** (`immutable: true`). Tada se `data` ne može mijenjati (samo brisanje i ponovno kreiranje), a kubelet ih ne prati, što smanjuje opterećenje API servera u velikim klasterima.

Ako ConfigMap ili ključ ne postoji, Pod ostaje u `CreateContainerConfigError` (env) ili `ContainerCreating` (volumen). Sa `optional: true` u referenci Pod se pokreće i bez njega.

> **Na ispitu:** Kad zadatak traži „montiraj fajl u postojeći direktorijum, a da ostali fajlovi ostanu“, rješenje je `subPath`. Bez njega montaža prekrije cijeli direktorijum. Primjer YAML-a nađi na kubernetes.io pretragom „Configure a Pod to Use a ConfigMap“.

## Probe i samoizlječenje

Kubelet na svakom čvoru izvršava **probe** i na osnovu njih restartuje kontejnere ili ih izbacuje iz saobraćaja.

| Probe | Pitanje koje postavlja | Posljedica neuspjeha |
|---|---|---|
| **livenessProbe** | Da li je proces živ ili zaglavljen? | Kubelet **restartuje** kontejner (po `restartPolicy`) |
| **readinessProbe** | Da li smije primati saobraćaj? | Pod postaje `NotReady` i uklanja se iz endpointa Servisa; **nema restarta** |
| **startupProbe** | Da li je spora aplikacija završila start? | Dok ne uspije, liveness i readiness se ne izvršavaju; ako padne `failureThreshold` puta, restart |

Tipovi provjera: `httpGet` (uspjeh je HTTP kod 200–399), `tcpSocket` (uspjeh ako se TCP konekcija otvori), `exec` (uspjeh ako komanda vrati 0, npr. `command: ["cat", "/tmp/healthy"]`) i `grpc` (standardni gRPC health checking protokol).

Podrazumijevane vrijednosti: `initialDelaySeconds: 0`, `periodSeconds: 10`, `timeoutSeconds: 1`, `successThreshold: 1`, `failureThreshold: 3`.

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
        failureThreshold: 30     # do 30 x 10s = 5 minuta za start
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

Česta greška u dizajnu: liveness probe koja provjerava bazu. Kad baza padne, kubelet restartuje sve aplikacione Podove, što ništa ne popravlja. Liveness provjerava samo sam proces; zavisnosti idu u readiness.

### restartPolicy

`spec.restartPolicy` važi za cijeli Pod:

| Vrijednost | Ponašanje | Gdje |
|---|---|---|
| `Always` (podrazumijevano) | Restart uvijek, i kad kontejner završi sa 0 | Deployment, StatefulSet, DaemonSet (jedina dozvoljena vrijednost) |
| `OnFailure` | Restart samo ako je izlazni kod različit od 0 | Job, CronJob |
| `Never` | Bez restarta | Job, jednokratni Podovi |

Restarti idu sa eksponencijalnim čekanjem (10s, 20s, 40s… do 5 minuta); zato vidiš status `CrashLoopBackOff`. Broj restarta je u koloni `RESTARTS`, a razlog prethodnog pada u `k describe pod` (Last State, npr. `OOMKilled`, exit code 137) i u `k logs <pod> --previous`.

### Init i sidecar kontejneri

**Init containers** (`spec.initContainers`) se izvršavaju redom, jedan po jedan, i svaki mora završiti uspješno prije nego što krenu glavni kontejneri. Koriste se za čekanje zavisnosti, migracije ili pripremu fajlova u zajedničkom volumenu.

**Sidecar containers** (stabilno od v1.33) su init kontejneri sa `restartPolicy: Always`. Startuju prije glavnih kontejnera (ne čekaju da završe), rade cijelo vrijeme života Poda, restartuju se ako padnu i gase se **nakon** glavnih kontejnera. Kod Joba sidecar ne blokira završetak: Job je gotov kad glavni kontejner završi.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-sidecar
spec:
  initContainers:
  - name: wait-db                       # klasični init: mora završiti
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

Dok init kontejner ne završi, Pod je u statusu `Init:0/2`; ako init pada, vidiš `Init:CrashLoopBackOff`. Logove čitaš sa `k logs web-with-sidecar -c wait-db`. Stari obrazac, sidecar kao drugi kontejner u `containers`, i dalje radi, ali nema garantovan redoslijed starta i gašenja.

> **Na ispitu:** Ako zadatak kaže „dodaj sidecar koji čita log“, oba rješenja (drugi kontejner u `containers` ili init kontejner sa `restartPolicy: Always`) obično prolaze provjeru. Pročitaj tekst pažljivo: ako traži „native sidecar“ ili da sidecar starta prije aplikacije, koristi `initContainers`.

## Drugi kontroleri

| Kontroler | Šta garantuje | Tipična upotreba |
|---|---|---|
| **Deployment** | N identičnih, zamjenjivih Podova | Web, API |
| **StatefulSet** | Stabilna imena, redoslijed, vlastiti PVC po Podu | Baze, Kafka, etcd |
| **DaemonSet** | Jedan Pod po (odabranom) čvoru | Log agenti, CNI, node exporter |
| **Job** | Podovi se izvršavaju do uspješnog završetka | Migracije, batch |
| **CronJob** | Job po rasporedu | Backup, izvještaji |

### DaemonSet

Ne postoji `kubectl create daemonset`. Najbrži put: `k create deployment node-agent --image=busybox:1.36 --dry-run=client -o yaml > ds.yaml`, pa u fajlu promijeni `kind: DaemonSet` i obriši `replicas`, `strategy` i `status`.

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
      tolerations:                         # da radi i na controlplane čvoru
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: agent
        image: busybox:1.36
        command: ["sh", "-c", "sleep infinity"]
```

Bez tolerancije DaemonSet će imati Pod samo na `node01`, jer `controlplane` ima taint `node-role.kubernetes.io/control-plane:NoSchedule`. DaemonSet ima strategije `RollingUpdate` (podrazumijevano) i `OnDelete`.

### StatefulSet

StatefulSet daje svakom Podu **stabilan identitet**: ime sa rednim brojem (`db-0`, `db-1`…), stabilno DNS ime preko **headless Service-a** (`clusterIP: None`) i vlastiti PVC iz `volumeClaimTemplates`. Podrazumijevano (`podManagementPolicy: OrderedReady`) Podovi se dižu redom 0, 1, 2 i gase obrnutim redom.

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
  serviceName: db               # mora pokazivati na headless Service
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

Rezultat: Podovi `db-0`, `db-1`, `db-2`; PVC-ovi `data-db-0`, `data-db-1`, `data-db-2`; DNS `db-0.db.default.svc.cluster.local`. Kad se Pod `db-1` obriše, novi Pod dobija isto ime i isti PVC. Kad smanjiš replike, PVC-ovi **ostaju** (podrazumijevano; mijenja se poljem `persistentVolumeClaimRetentionPolicy`). Ažuriranje: `RollingUpdate` (od najvećeg rednog broja ka nuli, opciono sa `partition`) ili `OnDelete`.

### Job i CronJob

```bash
k create job pi --image=perl:5.40 -- perl -Mbignum=bpi -wle 'print bpi(500)'
k create cronjob backup --image=busybox:1.36 --schedule="*/5 * * * *" -- sh -c 'date; echo backup'
k create job backup-manual --from=cronjob/backup     # ručno pokretanje CronJob-a
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-import
spec:
  completions: 6                 # ukupno 6 uspješnih Podova
  parallelism: 2                 # najviše 2 istovremeno
  backoffLimit: 4                # nakon 4 neuspješna pokušaja Job je Failed (podrazumijevano 6)
  activeDeadlineSeconds: 300     # Job ukupno ne smije trajati duže od 5 minuta
  ttlSecondsAfterFinished: 600   # automatsko brisanje 10 min nakon završetka
  template:
    spec:
      restartPolicy: Never       # Never ili OnFailure; Always nije dozvoljen
      containers:
      - name: worker
        image: busybox:1.36
        command: ["sh", "-c", "echo obrada; sleep 10"]
```

`activeDeadlineSeconds` ima prednost nad `backoffLimit`: kad istekne, Job se prekida (reason `DeadlineExceeded`) bez obzira na broj preostalih pokušaja.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
spec:
  schedule: "0 2 * * *"            # svaki dan u 02:00
  timeZone: "Europe/Belgrade"
  concurrencyPolicy: Forbid        # Allow (podrazumijevano) | Forbid | Replace
  successfulJobsHistoryLimit: 3    # failedJobsHistoryLimit je podrazumijevano 1
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

Privremeno zaustavljanje: `k patch cronjob backup -p '{"spec":{"suspend":true}}'`. Polje `startingDeadlineSeconds` određuje koliko kasno smije krenuti propušteno pokretanje.

> **Na ispitu:** Kod `kubectl create job` i `create cronjob` komanda ide iza `--`. Ako zadatak traži `completions`, `parallelism` ili `backoffLimit`, generiši YAML sa `--dry-run=client -o yaml`, dopiši polja pod `spec` Joba (ne pod `template.spec`) i primijeni. Za CronJob ta polja idu u `spec.jobTemplate.spec`.

## PodDisruptionBudget

**PodDisruptionBudget (PDB)** ograničava koliko Podova aplikacije smije biti srušeno **dobrovoljnim prekidom** (voluntary disruption): `kubectl drain`, eviction API, nadogradnja čvorova. PDB **ne štiti** od pada čvora niti od direktnog `kubectl delete pod`.

```bash
k create pdb web-pdb --selector=app=web --min-available=2
k create pdb web-pdb --selector=app=web --max-unavailable=1
k get pdb    # kolona ALLOWED DISRUPTIONS
```

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2          # ili maxUnavailable; samo jedno od dva
  selector:
    matchLabels:
      app: web
```

Ako Deployment ima 2 replike, a PDB traži `minAvailable: 2`, `ALLOWED DISRUPTIONS` je 0 i `kubectl drain node01` će stalno ponavljati „Cannot evict pod as it would violate the pod's disruption budget“. Rješenje: povećaj replike ili privremeno prilagodi PDB. Polje `unhealthyPodEvictionPolicy: AlwaysAllow` dozvoljava evikciju Podova koji ionako nisu Ready, pa pokvarena aplikacija ne blokira drain.

> **Na ispitu:** Kad `kubectl drain` visi tokom zadatka nadogradnje, prvo provjeri `k get pdb -A`. Ne koristi `--disable-eviction` osim ako zadatak to izričito dozvoljava, jer zaobilazi PDB.

## Troubleshooting

| Status Poda | Najčešći uzrok | Prva komanda |
|---|---|---|
| `CreateContainerConfigError` | Ne postoji ConfigMap/Secret ili ključ iz `env` | `k describe pod` (Events) |
| `ContainerCreating` dugo | Volumen (ConfigMap, Secret, PVC) ne može da se montira | `k describe pod` |
| `CrashLoopBackOff` | Aplikacija pada ili liveness probe ubija kontejner | `k logs <pod> --previous` |
| `Running`, `0/1 READY` | Readiness probe pada (pogrešan port/path) | `k describe pod` (Readiness probe failed) |
| `Init:CrashLoopBackOff` | Init kontejner ne završava uspješno | `k logs <pod> -c <init>` |
| Job `Failed`, `BackoffLimitExceeded` | Kontejner izlazi sa kodom ≠ 0 | `k logs job/<ime>` |
| StatefulSet Pod `Pending` | PVC ne može biti vezan | `k get pvc`, `k describe pvc data-db-0` |

```bash
k get events --sort-by=.lastTimestamp | tail -20
k explain pod.spec.containers.livenessProbe.grpc
```

> **Na ispitu:** `kubectl explain <resurs>.<polje> --recursive` je brži od pretrage dokumentacije kad zaboraviš gdje tačno ide polje (npr. `k explain cronjob.spec.jobTemplate.spec`).

## Rezime

- Deployment upravlja ReplicaSetovima; svaka promjena Pod template-a je nova revizija. `set image`, `rollout status/history/undo --to-revision`, `pause/resume`, `restart` su osnovne komande; razlog promjene ide u anotaciju `kubernetes.io/change-cause`.
- RollingUpdate tempo kontrolišu `maxSurge` i `maxUnavailable` (podrazumijevano 25%); Recreate gasi sve stare Podove prije novih.
- ConfigMap i Secret se troše kao `env`/`envFrom`/`valueFrom` ili kao volumen; env i `subPath` ne vide izmjene, cijeli volumen vidi. Base64 u Secretu nije enkripcija.
- Liveness restartuje, readiness izbacuje iz Servisa, startup štiti spore aplikacije; tipovi su `httpGet`, `tcpSocket`, `exec`, `grpc`.
- Init kontejneri rade redom prije aplikacije; native sidecar je init kontejner sa `restartPolicy: Always`.
- DaemonSet treba toleranciju za control-plane taint; StatefulSet traži headless Service i daje PVC po Podu (`data-db-0`).
- Job: `completions`, `parallelism`, `backoffLimit`, `activeDeadlineSeconds`, `restartPolicy` Never/OnFailure; CronJob dodaje `schedule` i `concurrencyPolicy`.
- PDB štiti od dobrovoljnih prekida (drain, eviction); prestrog PDB blokira `kubectl drain`.
