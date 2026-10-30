## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 2 (**Workloads & Scheduling**, 15% ispita):

- **2.3** autoskaliranje workloada (HPA, metrics-server, in-place resize, VPA ukratko),
- **2.5** prijem i raspoređivanje Podova: requests i limits, LimitRange i ResourceQuota, nodeSelector, affinity, taints i tolerations, topology spread, prioriteti.

Tipični zadaci: „Pod je Pending, popravi ga“, „rasporedi Pod samo na čvor sa labelom `disk=ssd`“, „dodaj taint na `node01` i napravi Pod koji ga toleriše“, „napravi HPA za Deployment, min 2, max 6, CPU 70%“, „postavi ResourceQuota u namespace-u“. Raspoređivanje se pojavljuje i u domenu Troubleshooting (30%), jer je `Pending` jedan od najčešćih simptoma.

> **Na ispitu:** Uvijek prvo `kubectl config use-context …` iz zadatka. Kod Pending Podova prva komanda je `k describe pod <ime>`: poruka scheduler-a u Events kaže tačno koji filter je odbio svaki čvor.

## Kako scheduler bira čvor

**kube-scheduler** prati Podove bez `spec.nodeName` i za svaki bira čvor u dva koraka:

1. **Filtering**: izbaci čvorove koji ne mogu primiti Pod (nedovoljno resursa za requests, nodeSelector/affinity ne odgovara, taint koji Pod ne toleriše, port zauzet, volumen u drugoj zoni, čvor `cordon`-ovan).
2. **Scoring**: preostale čvorove boduj (manje opterećen, image već postoji, preferred affinity, ravnomjerno raspoređivanje…) i izaberi najbolji.

Zatim upisuje `spec.nodeName` (binding), a kubelet na tom čvoru pokreće Pod. Ako nijedan čvor ne prođe filter, Pod ostaje **Pending**, a scheduler pokušava **preemption** (izbacivanje Podova nižeg prioriteta).

```text
0/2 nodes are available: 1 Insufficient memory,
1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }.
preemption: 0/2 nodes are available: 1 No preemption victims found for incoming pod,
1 Preemption is not helpful for scheduling.
```

Ovakvu poruku čitaš čvor po čvor: jedan čvor nema dovoljno memorije, drugi ima taint koji Pod ne toleriše.

## Requests, limits i QoS

- **requests**: koliko resursa Pod traži; scheduler sabira requests svih Podova na čvoru i poredi sa `allocatable`. Requests se ne „troše“, nego rezervišu.
- **limits**: gornja granica u runtime-u. CPU iznad limita se **throttluje**, memorija iznad limita znači **OOMKilled** (exit code 137).

```bash
k run web --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml   # dopiši resources
k set resources deployment web -c nginx --requests=cpu=100m,memory=128Mi --limits=cpu=500m,memory=256Mi
k describe node node01 | grep -A8 "Allocated resources"
k top pods --sort-by=memory     # traži metrics-server
```

```yaml
    resources:
      requests:
        cpu: 100m        # 0.1 jezgra
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 256Mi
```

Ako postaviš samo `limits`, Kubernetes postavlja `requests` na istu vrijednost.

**QoS klasa** se računa automatski i vidi u `status.qosClass`. Kad čvoru ponestane memorije, kubelet prvo izbacuje BestEffort, pa Burstable, a Guaranteed zadnje.

| QoS klasa | Uslov | Prioritet kod node-pressure eviction |
|---|---|---|
| **Guaranteed** | Svaki kontejner ima CPU i memory requests = limits | Izbacuje se zadnji |
| **Burstable** | Bar jedan kontejner ima neki request ili limit, ali nije Guaranteed | Srednji |
| **BestEffort** | Nijedan kontejner nema requests ni limits | Izbacuje se prvi |

```bash
k get pod web -o jsonpath='{.status.qosClass}'
```

### Pod-level resources

Od v1.34 (beta, uključeno podrazumijevano, i u 1.35 još beta) `resources` se može postaviti i na nivou Poda (`spec.resources`), kao zajednički budžet za CPU, memoriju i hugepages svih kontejnera. Kontejneri unutar Poda dijele taj budžet. Ovo je korisno za Podove sa više sidecar kontejnera; na ispitu se klasični `containers[].resources` i dalje očekuje kao podrazumijevani odgovor.

```yaml
spec:
  resources:
    requests: {cpu: 500m, memory: 256Mi}
    limits:   {cpu: "1", memory: 512Mi}
  containers:
  - name: app
    image: nginx:1.27
  - name: helper
    image: busybox:1.36
    command: ["sleep", "infinity"]
```

## LimitRange i ResourceQuota (admission)

Oba objekta provodi **admission** u API serveru, u trenutku kreiranja Poda. Ne utiču na Podove koji već rade.

**LimitRange** postavlja podrazumijevane vrijednosti i granice **po kontejneru (ili Podu/PVC-u)** u namespace-u:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: dev
spec:
  limits:
  - type: Container
    defaultRequest:        # ubacuje se ako kontejner nema requests
      cpu: 100m
      memory: 128Mi
    default:               # ubacuje se ako kontejner nema limits
      cpu: 500m
      memory: 256Mi
    min:
      cpu: 50m
    max:
      memory: 1Gi
```

Pod sa `limits.memory: 2Gi` u ovom namespace-u se odbija: `maximum memory usage per Container is 1Gi, but limit is 2Gi`.

**ResourceQuota** ograničava **zbir** u namespace-u: ukupne requests/limits i broj objekata.

```bash
k create quota dev-quota -n dev --hard=requests.cpu=2,requests.memory=2Gi,limits.cpu=4,limits.memory=4Gi,pods=10
k describe quota -n dev        # Used / Hard
```

Važna zamka: kad quota ograničava `requests.cpu` ili `limits.memory`, **svaki** novi Pod u namespace-u mora imati te vrijednosti (ili ih dobiti od LimitRange-a). Inače se odbija sa porukom tipa `failed quota: dev-quota: must specify limits.memory`. Kod Deploymenta Pod se ne pojavi uopšte: grešku vidiš u `k describe rs` ili `k get events`, ne na Podu.

| | LimitRange | ResourceQuota |
|---|---|---|
| Opseg | Jedan kontejner / Pod / PVC | Zbir cijelog namespace-a |
| Može ubaciti vrijednosti | Da (`default`, `defaultRequest`) | Ne |
| Broji objekte | Ne | Da (`pods`, `services`, `secrets`, `persistentvolumeclaims`…) |

> **Na ispitu:** Kad Deployment ima `READY 0/3` a Podova nema, pogledaj `k describe rs -l app=<ime>`. Odbijanje od ResourceQuota ili LimitRange se vidi samo tamo (FailedCreate), jer Pod nikad nije ni nastao.

## Biranje čvora: nodeName, nodeSelector, node affinity

### nodeName

`spec.nodeName: node01` **zaobilazi scheduler**: Pod ide direktno kubeletu tog čvora. Ne provjeravaju se taints sa efektom NoSchedule ni resursi u scheduleru (kubelet može odbiti Pod, npr. `OutOfcpu`). Koristi se rijetko, za testiranje ili kad scheduler ne radi.

### nodeSelector

Najjednostavniji filter: čvor mora imati sve navedene labele.

```bash
k label node node01 disk=ssd
k get nodes -L disk
k label node node01 disk-        # uklanjanje labele
```

```yaml
spec:
  nodeSelector:
    disk: ssd
```

### Node affinity

**Node affinity** je izražajnija verzija: operatori `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`, i dvije vrste pravila:

- `requiredDuringSchedulingIgnoredDuringExecution`: obavezno (filter),
- `preferredDuringSchedulingIgnoredDuringExecution`: poželjno, sa `weight` 1–100 (scoring).

„IgnoredDuringExecution“ znači: ako se labela čvora kasnije promijeni, Pod koji već radi ostaje.

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disk
            operator: In
            values: ["ssd", "nvme"]
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        preference:
          matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values: ["zone-a"]
```

Više `nodeSelectorTerms` se kombinuje sa **ILI**; više `matchExpressions` unutar jednog terma sa **I**.

> **Na ispitu:** Node affinity YAML je dug i lako se pogriješi u uvlačenju. Na kubernetes.io potraži „Assign Pods to Nodes using Node Affinity“ i kopiraj primjer. Provjera: `k explain pod.spec.affinity.nodeAffinity --recursive`.

## Pod affinity i anti-affinity

**Pod affinity** stavlja Pod blizu drugih Podova (po labelama), **pod anti-affinity** ga drži dalje od njih. „Blizu“ definiše **topologyKey**: labela čvora koja određuje domen.

| topologyKey | Značenje domena |
|---|---|
| `kubernetes.io/hostname` | Isti/različit čvor |
| `topology.kubernetes.io/zone` | Ista/različita zona |

Primjer: replike web aplikacije nikad na istom čvoru, a po mogućnosti na čvoru gdje radi cache.

```yaml
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: web
        topologyKey: kubernetes.io/hostname
    podAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: cache
          topologyKey: kubernetes.io/hostname
```

U našem lab klasteru Podovi rade samo na `node01` (controlplane ima taint), pa Deployment sa 3 replike i obaveznim anti-affinity-jem po hostname-u daje 1 Running i 2 Pending Poda. To je očekivano ponašanje, ne greška.

## Taints i tolerations

**Taint** je na čvoru i odbija Podove; **toleration** je na Podu i dozvoljava (ali ne zahtijeva) da Pod ide na taj čvor. Za „samo na tom čvoru“ treba kombinacija toleration + nodeSelector/affinity.

```bash
k taint nodes node01 gpu=true:NoSchedule
k describe node node01 | grep -i taints
k taint nodes node01 gpu=true:NoSchedule-     # uklanjanje (crtica na kraju)
k taint nodes node01 gpu-                     # ukloni sve taints sa ključem gpu
```

| Efekat | Novi Podovi bez tolerancije | Postojeći Podovi bez tolerancije |
|---|---|---|
| **NoSchedule** | Ne raspoređuju se | Ostaju |
| **PreferNoSchedule** | Scheduler izbjegava čvor ako može | Ostaju |
| **NoExecute** | Ne raspoređuju se | **Izbacuju se** (odmah ili nakon `tolerationSeconds`) |

```yaml
spec:
  tolerations:
  - key: gpu
    operator: Equal
    value: "true"
    effect: NoSchedule
  - key: node.kubernetes.io/unreachable
    operator: Exists
    effect: NoExecute
    tolerationSeconds: 60     # ostani još 60s nakon što čvor postane nedostupan
```

`operator: Exists` ne traži `value`. Toleration sa `operator: Exists` bez ključa toleriše sve taints (tako rade neki DaemonSetovi).

### Control-plane taint i automatski taints

kubeadm stavlja na control-plane čvor taint `node-role.kubernetes.io/control-plane:NoSchedule`, zato tvoji Podovi idu na `node01`. Uklanjanje (samo ako zadatak traži):

```bash
k taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

Kontroler čvorova sam dodaje taints kao `node.kubernetes.io/not-ready`, `node.kubernetes.io/unreachable` (NoExecute), `node.kubernetes.io/disk-pressure`, `node.kubernetes.io/memory-pressure` i `node.kubernetes.io/unschedulable` (nakon `kubectl cordon`). Svaki Pod automatski dobija toleranciju za not-ready i unreachable sa `tolerationSeconds: 300`, zato se Podovi sa palog čvora izbacuju tek nakon oko 5 minuta.

> **Na ispitu:** Poruka `had untolerated taint {node-role.kubernetes.io/control-plane: }` kod Pending Poda znači da je jedini slobodan čvor controlplane. Prvo provjeri zašto drugi čvor ne prolazi (cordon, resursi, nodeSelector), umjesto da odmah skidaš taint.

## Topology spread constraints

**topologySpreadConstraints** raspoređuju replike ravnomjerno po domenima (čvorovi, zone), preciznije od anti-affinity-ja.

```yaml
spec:
  topologySpreadConstraints:
  - maxSkew: 1                               # najveća dozvoljena razlika između domena
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule         # ili ScheduleAnyway (samo scoring)
    labelSelector:
      matchLabels:
        app: web
```

Sa `maxSkew: 1` i dva čvora, 4 replike idu 2+2; peta ide bilo gdje (3+2), šesta mora na čvor sa 2. `DoNotSchedule` je filter (Pod ostaje Pending ako bi skew bio prekoračen), `ScheduleAnyway` samo utiče na bodovanje. Dodatna polja: `minDomains`, `matchLabelKeys` (npr. `pod-template-hash`, da se računa samo trenutna revizija), `nodeAffinityPolicy`, `nodeTaintsPolicy`.

## PriorityClass i preemption

**PriorityClass** daje Podovima prioritet (cijeli broj, veći je važniji). Kad Pod visokog prioriteta ne može nigdje stati, scheduler bira čvor i **izbacuje (preempt)** Podove nižeg prioriteta da napravi mjesto.

```bash
k create priorityclass critical-apps --value=100000 --description="kritične aplikacije"
k create priorityclass batch-low --value=100 --preemption-policy=Never
k get priorityclass     # vidiš i system-cluster-critical i system-node-critical
```

```yaml
spec:
  priorityClassName: critical-apps
  containers:
  - name: api
    image: nginx:1.27
```

- `preemptionPolicy: Never`: Pod ide ispred u redu čekanja, ali nikog ne izbacuje.
- `globalDefault: true`: klasa za Podove bez `priorityClassName` (samo jedna smije biti global default). Bez nje Podovi imaju prioritet 0.
- Klase `system-*` su rezervisane za komponente klastera (CoreDNS, kube-proxy, CNI).
- Preemption poštuje PDB po mogućnosti, ali ga ne garantuje.

## Autoskaliranje

| Mehanizam | Šta skalira | Status |
|---|---|---|
| **HorizontalPodAutoscaler (HPA)** | Broj replika (Deployment, StatefulSet, ReplicaSet) | Ugrađen, `autoscaling/v2` |
| **VerticalPodAutoscaler (VPA)** | requests/limits kontejnera | Zaseban projekat (CRD), nije ugrađen |
| **In-place Pod resize** | Resursi Poda koji radi, bez ponovnog kreiranja | Ugrađeno, stabilno od v1.35 |
| Cluster Autoscaler / Karpenter | Broj čvorova | Van klastera, zavisi od cloud-a |

### metrics-server

HPA za CPU/memoriju čita Metrics API (`metrics.k8s.io`), koji daje **metrics-server**. Bez njega `kubectl top` vraća `error: Metrics API not available`, a HPA prikazuje `<unknown>/70%`.

```bash
ls /opt/kurs/manifests/                  # manifest za metrics-server u labu
k apply -f /opt/kurs/manifests/metrics-server.yaml
k -n kube-system get deploy metrics-server
k top nodes
k top pods -A
```

U lab klasterima kubeleti imaju samopotpisane certifikate, pa metrics-server često treba argument `--kubelet-insecure-tls`. Ako je Pod metrics-servera Running ali nije Ready, pogledaj njegove logove.

### HPA

```bash
k autoscale deployment web --min=2 --max=6 --cpu=70%
k get hpa web -w
k describe hpa web       # Conditions, Events, trenutna vrijednost metrike
```

U kubectl v1.35 target se zadaje sa `--cpu` i `--memory` (procenat znači utilization, npr. `--cpu=70%`; kvantitet znači prosječnu vrijednost, npr. `--memory=200Mi`). Stariji materijali koriste `--cpu-percent`, koji dokumentacija za v1.35 više ne navodi.

Ekvivalentni manifest:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 6
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70      # procenat od REQUESTS, ne od limits
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60          # najviše 1 Pod manje po minuti
```

Formula: `desiredReplicas = ceil(currentReplicas × currentMetric / targetMetric)`. Primjer: 3 replike na 140% CPU sa ciljem 70% daju `ceil(3 × 2) = 6`. Kontroler računa svakih 15 sekundi i ne reaguje ako je odnos unutar tolerancije od 10%.

Bitno:

- **Utilization** se računa u odnosu na **requests**. Ako kontejner nema CPU request, HPA ne može izračunati CPU utilization (`<unknown>`, `FailedGetResourceMetric`).
- Tipovi metrika u v2: `Resource` (CPU/memorija Poda), `ContainerResource` (jedan kontejner, npr. bez sidecara), `Pods`, `Object`, `External` (zadnje tri traže custom/external metrics adapter).
- **behavior**: podrazumijevano scale-up nema stabilizacioni prozor (najviše +100% ili +4 Poda na 15s, uzima se veće), a scale-down ima prozor od 300s. `selectPolicy` je `Max`, `Min` ili `Disabled`. U v1.35 je beta polje `tolerance` pod `scaleUp`/`scaleDown` za vlastitu toleranciju.
- Kad HPA upravlja Deploymentom, izbaci `spec.replicas` iz manifesta u Gitu; inače svaki `kubectl apply` vraća broj replika i HPA i apply se „svađaju“.

> **Na ispitu:** Ako zadatak traži HPA sa `behavior` ili memory metrikom, generiši osnovu sa `k autoscale … --dry-run=client -o yaml`, pa dopiši polja. Primjer cijelog `behavior` bloka je na stranici „Horizontal Pod Autoscaling“ na kubernetes.io.

### In-place Pod resize

Od v1.35 je **stabilno** mijenjanje CPU i memorije Poda koji radi, bez brisanja Poda. Izmjena ide preko **`resize` subresource-a** (kubectl v1.32+):

```bash
k patch pod web --subresource resize --patch \
  '{"spec":{"containers":[{"name":"nginx","resources":{"requests":{"cpu":"300m"},"limits":{"cpu":"300m"}}}]}}'
k edit pod web --subresource resize

k get pod web -o jsonpath='{.status.containerStatuses[0].resources}'   # stvarno primijenjeno
k get pod web -o jsonpath='{.status.conditions}'                      # PodResizePending / PodResizeInProgress
```

Ponašanje po resursu određuje `resizePolicy` u kontejneru:

```yaml
    resizePolicy:
    - resourceName: cpu
      restartPolicy: NotRequired        # podrazumijevano: bez restarta
    - resourceName: memory
      restartPolicy: RestartContainer   # kontejner se restartuje da primijeni memoriju
```

Ograničenja: mijenjaju se samo CPU i memorija; **QoS klasa se ne smije promijeniti** (Guaranteed mora ostati requests = limits); requests/limits se ne mogu ukloniti; ne radi za Windows Podove. Ako čvor nema mjesta, Pod dobija uslov `PodResizePending` sa reason `Infeasible` (nikad neće stati) ili `Deferred` (možda kasnije). Običan `kubectl edit pod` bez `--subresource resize` i dalje odbija izmjenu resursa.

Za Deployment ovo ne važi automatski: izmjena `spec.template` pravi novi rollout. In-place resize je alat za pojedinačne Podove i za VPA.

### VPA ukratko

**VerticalPodAutoscaler** nije dio Kubernetesa; instalira se iz projekta `kubernetes/autoscaler` (CRD + recommender, updater, admission controller). Preporučuje ili postavlja requests na osnovu istorije potrošnje. Režimi (`updateMode`) su npr. `Off` (samo preporuka), `Initial` (samo pri kreiranju Poda), `Recreate` (evikcija i ponovno kreiranje), a novije verzije imaju i `InPlaceOrRecreate`. Ne kombinuj VPA i HPA na istoj CPU/memory metrici.

## Troubleshooting

| Simptom | Vjerovatni uzrok | Provjera |
|---|---|---|
| Pending, `Insufficient cpu` | Zbir requests premašuje allocatable | `k describe node node01` (Allocated resources), smanji requests |
| Pending, `didn't match Pod's node affinity/selector` | Labela ne postoji ili je pogrešno napisana | `k get nodes --show-labels` |
| Pending, `untolerated taint` | Nedostaje toleration | `k describe node \| grep Taints` |
| Pending, `didn't match pod anti-affinity rules` | Nema dovoljno domena | Broj čvorova vs broj replika |
| Pending, `node(s) were unschedulable` | Čvor je cordon-ovan | `k uncordon node01` |
| Deployment 0 Podova, FailedCreate | ResourceQuota/LimitRange | `k describe rs`, `k describe quota` |
| `OOMKilled`, exit 137 | Memory limit premali | `k describe pod` (Last State) |
| HPA `<unknown>` | Nema metrics-servera ili requests | `k top pods`, `k describe hpa` |

```bash
k get pods -A --field-selector=status.phase=Pending
k get events -A --field-selector reason=FailedScheduling
k -n kube-system logs kube-scheduler-controlplane | tail
```

> **Na ispitu:** Ako su svi novi Podovi Pending bez ikakvog događaja `FailedScheduling`, scheduler možda ne radi. Provjeri `k -n kube-system get pods` i static Pod manifest `/etc/kubernetes/manifests/kube-scheduler.yaml` (detaljnije u modulu o troubleshootingu klastera).

## Rezime

- Scheduler radi filter pa score; Pending poruka u `k describe pod` kaže koji filter je odbio koji čvor. `nodeName` zaobilazi scheduler.
- Requests služe za raspoređivanje, limits za runtime (CPU throttling, memorija OOMKilled); QoS klase Guaranteed, Burstable, BestEffort određuju redoslijed eviction-a.
- LimitRange (po kontejneru, ubacuje default vrijednosti) i ResourceQuota (zbir po namespace-u) provodi admission; odbijanje Podova Deploymenta vidiš u `k describe rs`.
- nodeSelector i node affinity biraju čvorove po labelama; pod (anti-)affinity i topologySpreadConstraints biraju po drugim Podovima i `topologyKey`.
- Taint odbija, toleration dozvoljava; NoExecute izbacuje i postojeće Podove (osim u `tolerationSeconds`). Control-plane čvor ima taint `node-role.kubernetes.io/control-plane:NoSchedule`.
- PriorityClass i preemption puštaju važne Podove ispred; `preemptionPolicy: Never` ne izbacuje druge.
- HPA `autoscaling/v2` traži metrics-server i requests; `k autoscale deployment web --min=2 --max=6 --cpu=70%`, a `behavior` kontroliše brzinu skaliranja.
- In-place resize je GA u v1.35 preko `--subresource resize`, uz `resizePolicy` i nepromjenjivu QoS klasu; VPA je zaseban dodatak.
