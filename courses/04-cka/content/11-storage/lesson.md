## Šta ovaj modul pokriva

Domen 4 (**Storage**) nosi 10% ispita. Modul pokriva tri cilja:

- **4.1** StorageClass i dinamičko obezbjeđivanje volumena (**dynamic provisioning**),
- **4.2** tipovi volumena, **access modes** i **reclaim policy**,
- **4.3** upravljanje objektima **PersistentVolume** (PV) i **PersistentVolumeClaim** (PVC).

Zadaci na ispitu su kratki, ali precizni. Tipični primjeri:

- „Napravi PV `pv-log` od 100Mi, `hostPath` `/opt/log`, access mode RWX, reclaim policy Retain. Napravi PVC koji se veže baš za njega i montiraj ga u Pod.“
- „Napravi StorageClass `fast` sa provisionerom `rancher.io/local-path`, `volumeBindingMode: WaitForFirstConsumer`, i označi je kao podrazumijevanu.“
- „PVC je u stanju Pending. Popravi ga.“
- „Proširi PVC na 2Gi“ ili „vrati Released PV u stanje Available“.

Storage je domen u kojem se najlakše izgubi vrijeme na sitnicama: jedno slovo u `storageClassName` ili neusklađen access mode i PVC ostaje Pending. Zato ovdje više nego drugdje vrijedi čitati `kubectl describe`.

## Volumeni u Podu: osnovni tipovi

**Volume** je direktorijum koji Pod vidi kroz `volumeMounts`. Definiše se u `spec.volumes`, a montira u svakom kontejneru posebno. Životni vijek zavisi od tipa.

| Tip | Gdje su podaci | Živi koliko | Tipična upotreba |
|---|---|---|---|
| **emptyDir** | Disk čvora (ili RAM sa `medium: Memory`) | Dok Pod postoji na čvoru | Dijeljenje fajlova između kontejnera, cache, scratch |
| **hostPath** | Konkretna putanja na čvoru | Dok postoji na čvoru | Agenti čvora (logovi, `/var/run/containerd`), labovi |
| **configMap** / **secret** | API objekat projektovan u fajlove | Kao objekat | Konfiguracija, certifikati, lozinke |
| **projected** | Više izvora u jedan direktorijum | Kao izvori | ConfigMap + Secret + `serviceAccountToken` + `downwardAPI` zajedno |
| **persistentVolumeClaim** | PV iza PVC-a | Nezavisno od Poda | Baze, trajni podaci |
| **csi** (inline) | CSI drajver | Zavisi od drajvera | Ephemeral volumeni (npr. Secrets Store CSI) |

Primjer: dva kontejnera dijele `emptyDir`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared
spec:
  containers:
  - name: writer
    image: busybox:1.37
    command: ["sh", "-c", "while true; do date >> /data/out.log; sleep 5; done"]
    volumeMounts:
    - name: scratch
      mountPath: /data
  - name: reader
    image: busybox:1.37
    command: ["sh", "-c", "tail -f /data/out.log"]
    volumeMounts:
    - name: scratch
      mountPath: /data
      readOnly: true
  volumes:
  - name: scratch
    emptyDir:
      sizeLimit: 100Mi
```

### hostPath i rizici

`hostPath` montira putanju sa čvora u kontejner. Za labove je zgodan, ali ima dva problema:

1. **Vezan je za čvor.** Ako se Pod preseli na drugi čvor, vidi drugi (ili prazan) direktorijum.
2. **Sigurnosni rizik.** Montiranje `/`, `/etc`, `/var/lib/kubelet` ili `/run/containerd/containerd.sock` praktično daje kontrolu nad čvorom. Zato ga Pod Security Standard **baseline** zabranjuje. To ćeš opet sresti na CKS-u.

Polje `type` provjerava šta postoji na čvoru: `DirectoryOrCreate`, `Directory`, `FileOrCreate`, `File`, `Socket` i drugi. Prazno znači „bez provjere“.

```yaml
  volumes:
  - name: logs
    hostPath:
      path: /var/log/app
      type: DirectoryOrCreate
```

### configMap, secret i projected

```yaml
  volumes:
  - name: cfg
    projected:
      sources:
      - configMap:
          name: app-config
      - secret:
          name: app-tls
          items:
          - key: tls.crt
            path: certs/tls.crt
```

Fajlovi iz ConfigMap/Secret volumena se ažuriraju kad se objekat promijeni (uz kašnjenje), **osim** ako je montiran sa `subPath`. Varijable okruženja iz ConfigMap-a se nikad ne ažuriraju bez restarta Poda.

> **Na ispitu:** Ne pamti YAML napamet. U dokumentaciji pretraži „Configure a Pod to Use a PersistentVolume for Storage“: na toj stranici su gotovi PV, PVC i Pod manifesti koje samo prilagodiš. Za StorageClass koristi stranicu „Storage Classes“.

## PersistentVolume i PersistentVolumeClaim

Model ima dvije strane:

- **PersistentVolume (PV)** je komad storage-a u klasteru. Cluster-scoped objekat (nema namespace). Pravi ga administrator ručno (**static provisioning**) ili provisioner automatski (**dynamic provisioning**).
- **PersistentVolumeClaim (PVC)** je zahtjev korisnika u namespace-u: „treba mi 1Gi, RWO, klasa X“. Pod koristi PVC, nikad PV direktno.

Kontroler vezuje (**binding**) PVC za PV koji zadovoljava sve uslove. Veza je 1:1 i ekskluzivna: jedan PV pripada tačno jednom PVC-u.

### Static provisioning: PV + PVC + Pod

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-log
  labels:
    tier: logs
spec:
  capacity:
    storage: 100Mi
  accessModes:
  - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /opt/log
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-log
  namespace: default
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 50Mi
  storageClassName: manual
---
apiVersion: v1
kind: Pod
metadata:
  name: logger
spec:
  containers:
  - name: app
    image: nginx:1.27
    volumeMounts:
    - name: log
      mountPath: /var/log/nginx
  volumes:
  - name: log
    persistentVolumeClaim:
      claimName: pvc-log
```

Ne postoji `kubectl create pv` ni `kubectl create pvc`. Manifest pišeš ručno ili kopiraš iz dokumentacije. Za Pod ipak uštedi vrijeme:

```bash
k run logger --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml
vim pod.yaml          # dodaj volumes i volumeMounts
k apply -f pv.yaml -f pvc.yaml -f pod.yaml
k get pv,pvc
k explain pv.spec --recursive | less
```

### Pravila vezivanja

PVC se veže za PV samo ako se slaže **sve** od navedenog:

| Uslov | Pravilo |
|---|---|
| `storageClassName` | Mora biti isti string na PV i PVC (uključujući prazan) |
| Kapacitet | PV `capacity.storage` ≥ PVC `resources.requests.storage` |
| `accessModes` | PV mora podržavati sve modove koje PVC traži |
| `volumeMode` | Isti (Filesystem i Filesystem, Block i Block) |
| `selector` | Ako PVC ima selector, labele PV-a moraju odgovarati |
| `volumeName` | Ako je postavljen, samo taj PV |

Bitna posljedica kapaciteta: PVC od 50Mi vezan za PV od 100Mi dobija **cijelih 100Mi**. `k get pvc` pokazuje kapacitet PV-a, ne traženi.

### storageClassName: prazan string ili izostavljen

Ovo je česta zamka:

- `storageClassName: ""` znači „hoću PV **bez klase**“. Dinamički provisioning je isključen za taj PVC. Veže se samo za PV koji takođe nema klasu.
- Polje **izostavljeno**: ako postoji podrazumijevana (**default**) StorageClass i admission plugin `DefaultStorageClass` je uključen (u kubeadm klasteru jeste), API server upiše ime default klase. Tada PVC traži PV te klase ili ga dinamički pravi.
- Ako default klasa ne postoji, PVC bez klase čeka. Kad se default klasa kasnije pojavi, kontrolna ravan **naknadno** upiše njeno ime u takve PVC-ove (GA od v1.28). PVC sa `""` se ne mijenja.

U lab klasteru `local-path` je default klasa. Zato PVC bez `storageClassName` neće uzeti tvoj ručno napravljeni PV bez klase, nego će local-path napraviti novi volumen.

> **Na ispitu:** Ako zadatak kaže „PVC treba da se veže za PV `pv-x`“, a PV nema `storageClassName`, u PVC obavezno upiši `storageClassName: ""`. Još sigurnije: dodaj i `volumeName: pv-x`. Bez toga default klasa „ukrade“ PVC.

### volumeName i selector

```yaml
spec:
  volumeName: pv-log          # veži baš za ovaj PV
  selector:
    matchLabels:
      tier: logs              # ili biraj među PV-ovima po labelama
```

- `volumeName` preskače izbor. Ako je taj PV već vezan za drugi PVC, novi PVC ostaje Pending.
- `selector` (`matchLabels` i `matchExpressions`, uslovi se kombinuju sa AND) radi samo za statičke PV-ove. PVC sa nepraznim selectorom ne može dobiti dinamički PV.
- PV se može **rezervisati** za određeni PVC postavljanjem `spec.claimRef` (ime i namespace PVC-a) na PV-u.

## Access modes

| Mode | Skraćenica | Značenje |
|---|---|---|
| **ReadWriteOnce** | RWO | Čitanje i pisanje sa **jednog čvora**. Više Podova na istom čvoru može ga koristiti |
| **ReadOnlyMany** | ROX | Samo čitanje sa više čvorova |
| **ReadWriteMany** | RWX | Čitanje i pisanje sa više čvorova (NFS, CephFS, Azure Files, EFS) |
| **ReadWriteOncePod** | RWOP | Čitanje i pisanje iz **jednog Poda** u cijelom klasteru. GA od v1.29, samo za CSI volumene |

Zamke:

- RWO je ograničenje po **čvoru**, ne po Podu. Za „samo jedan Pod“ koristi RWOP.
- Access mode je **obećanje o mogućnostima**, ne zaštita. Kubernetes ne sprečava pisanje u PV označen ROX ako ga montiraš bez `readOnly: true`. Za read-only montiranje postavi `readOnly: true` u `volumeMounts` ili u `persistentVolumeClaim` izvoru.
- Block storage u oblaku (EBS, Azure Disk, GCE PD) podržava RWO (i RWOP), ne RWX.
- `local-path` u labu pravi volumen u direktorijumu jednog čvora, pa RWX nema smisla. Tražiš li RWX od local-path, PVC ostaje Pending, a u Events stoji greška provisionera (`ProvisioningFailed`).

## volumeMode: Filesystem i Block

- **Filesystem** (default): volumen se formatira i montira kao direktorijum (`volumeMounts.mountPath`).
- **Block**: Pod dobija sirovi blok uređaj. U kontejneru se koristi `volumeDevices` sa `devicePath`, ne `volumeMounts`.

```yaml
  containers:
  - name: db
    image: busybox:1.37
    volumeDevices:
    - name: raw
      devicePath: /dev/xvda
```

PV i PVC moraju imati isti `volumeMode`, inače nema vezivanja.

## Reclaim policy i stanja PV-a

**Reclaim policy** (`spec.persistentVolumeReclaimPolicy`) kaže šta se dešava sa PV-om kad se obriše PVC.

| Policy | Šta se dešava nakon brisanja PVC-a | Default za |
|---|---|---|
| **Retain** | PV prelazi u **Released**, podaci ostaju, admin čisti ručno | Ručno napravljene PV-ove |
| **Delete** | Briše se PV objekat i stvarni storage (disk u oblaku, direktorijum) | Dinamičke PV-ove (nasljeđuju `reclaimPolicy` iz StorageClass, a ona je podrazumijevano Delete) |
| **Recycle** | Osnovno brisanje (`rm -rf`) i PV ponovo Available | **Deprecated**. Radi samo za `nfs` i `hostPath`. Koristi dinamički provisioning |

Reclaim policy postojećeg PV-a možeš promijeniti, što je uobičajeno prije brisanja PVC-a sa važnim podacima:

```bash
k patch pv pvc-3f1c... -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

### Stanja (phase) PV-a

| Phase | Značenje |
|---|---|
| **Available** | Slobodan, nije vezan |
| **Bound** | Vezan za PVC |
| **Released** | PVC je obrisan, PV još nije oslobođen (Retain) |
| **Failed** | Automatsko oslobađanje nije uspjelo |

### Kako ponovo iskoristiti Released PV

Released PV se **ne veže** automatski za novi PVC, jer u `spec.claimRef` još stoji stari PVC (sa starim `uid`). Dvije opcije:

```bash
# 1) ukloni claimRef: PV postaje Available (podatke prije toga očisti ako treba)
k patch pv pv-log --type=json -p '[{"op":"remove","path":"/spec/claimRef"}]'

# 2) ili ostavi ime i namespace, a ukloni samo uid i resourceVersion,
#    pa će se PV vezati baš za novi PVC istog imena
k edit pv pv-log
```

Provjera: `k get pv pv-log` treba da pokaže `Available` (opcija 1) ili `Bound` kad napraviš PVC (opcija 2).

> **Na ispitu:** Kad brišeš PVC sa zaštitom podataka, prvo pogledaj `RECLAIM POLICY` u `k get pv`. PVC koji koristi Pod se ne briše odmah: ostaje u stanju `Terminating` zbog finalizera `kubernetes.io/pvc-protection` dok se Pod ne obriše. To nije greška.

## StorageClass i dinamički provisioning

**StorageClass** opisuje „vrstu“ storage-a i ko ga pravi. Kad PVC traži klasu, njen **provisioner** automatski napravi PV odgovarajuće veličine.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: rancher.io/local-path
parameters: {}
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: false
```

| Polje | Značenje |
|---|---|
| `provisioner` | Ko pravi volumen: CSI drajver (`ebs.csi.aws.com`, `pd.csi.storage.gke.io`) ili eksterni provisioner (`rancher.io/local-path`). `kubernetes.io/no-provisioner` za lokalne statičke PV-ove |
| `parameters` | Specifično za provisioner (tip diska, IOPS, fsType). Kubernetes ih ne tumači |
| `reclaimPolicy` | `Delete` (default) ili `Retain` za PV-ove koje klasa napravi |
| `volumeBindingMode` | `Immediate` (default) ili `WaitForFirstConsumer` |
| `allowVolumeExpansion` | Da li se PVC te klase smije proširiti |
| `mountOptions` | Opcije montiranja (npr. za NFS) |

StorageClass je praktično nepromjenljiva: `provisioner`, `parameters`, `reclaimPolicy` i `volumeBindingMode` ne možeš mijenjati nakon kreiranja (`allowVolumeExpansion` i anotacije možeš). Za ostalo briši i pravi ponovo.

### volumeBindingMode: Immediate ili WaitForFirstConsumer

- **Immediate**: PV se pravi i vezuje čim se napravi PVC. Problem: volumen može nastati u zoni (ili na čvoru) gdje Pod ne može biti raspoređen.
- **WaitForFirstConsumer**: PVC ostaje **Pending** dok ga neki Pod ne zatraži. Scheduler prvo izabere čvor, pa provisioner pravi volumen tamo. Obavezno za lokalni storage.

U labu je `local-path` sa `WaitForFirstConsumer`. Zato je ovo normalno:

```bash
k get pvc data
# NAME   STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   ...
# data   Pending                                      local-path
k describe pvc data | tail -3
# Normal  WaitForFirstConsumer  ...  waiting for first consumer to be created before binding
```

Čim napraviš Pod koji koristi PVC, PVC postaje Bound.

### Default StorageClass

Default klasu određuje anotacija `storageclass.kubernetes.io/is-default-class: "true"`. U `k get sc` pored imena piše `(default)`.

```bash
k get sc
# promijeni default: skini sa stare, stavi na novu
k annotate sc local-path storageclass.kubernetes.io/is-default-class-
k annotate sc fast storageclass.kubernetes.io/is-default-class="true" --overwrite
# ili patch
k patch sc fast -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

Ako je više klasa označeno kao default, za nove PVC-ove se koristi najnovija. Ipak, drži tačno jednu.

> **Na ispitu:** Kad zadatak traži „napravi StorageClass i učini je default“, provjeri da li već postoji druga default klasa (`k get sc`). Zadatak često očekuje da sa nje skineš anotaciju.

### Dinamički PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  storageClassName: local-path
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

Kad se PVC veže, provisioner napravi PV sa imenom oblika `pvc-<uid>` i `claimRef` na tvoj PVC.

## Proširenje PVC-a

1. StorageClass mora imati `allowVolumeExpansion: true`.
2. Povećaj `spec.resources.requests.storage` na **PVC-u** (ne na PV-u):

```bash
k patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
k get pvc data -w
k describe pvc data       # uslovi Resizing / FileSystemResizePending
```

Pravila:

- Smanjivanje nije podržano. API odbija manju vrijednost.
- Novi PV se ne pravi: postojeći volumen se proširuje, pa se proširi i fajl sistem (ext3, ext4, xfs), online ili pri sljedećem pokretanju Poda, zavisno od drajvera.
- Ne mijenjaj `capacity` direktno na PV-u: to može spriječiti automatsko proširenje.
- `local-path` ne podržava proširenje. Lab koristi tu klasu samo za dinamički provisioning.

## StatefulSet i volumeClaimTemplates

StatefulSet za svaku repliku pravi poseban PVC iz šablona `volumeClaimTemplates`. Imena su `<template>-<statefulset>-<ordinal>`, npr. `data-db-0`, `data-db-1`.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db
  replicas: 2
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
      - name: db
        image: redis:alpine
        volumeMounts:
        - name: data
          mountPath: /data
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

Kad smanjiš broj replika ili obrišeš StatefulSet, PVC-ovi podrazumijevano **ostaju** (podaci se čuvaju). To kontroliše `spec.persistentVolumeClaimRetentionPolicy` (`whenDeleted`, `whenScaled`: `Retain` ili `Delete`).

## VolumeAttributesClass

**VolumeAttributesClass** (`storage.k8s.io/v1`) opisuje promjenljive osobine volumena, npr. IOPS i throughput, odvojeno od StorageClass. PVC je bira poljem `spec.volumeAttributesClassName`, a za razliku od klase, ovo polje se smije mijenjati na postojećem PVC-u. Tako se performanse diska mijenjaju bez novog volumena. Funkcija je GA (stabilna) i dostupna u 1.35, ali radi samo sa CSI drajverom koji je podržava (`driverName` u klasi). Local-path je ne podržava.

```yaml
apiVersion: storage.k8s.io/v1
kind: VolumeAttributesClass
metadata:
  name: gold
driverName: ebs.csi.aws.com
parameters:
  iops: "6000"
  throughput: "250"
```

## Troubleshooting

PVC je **Pending**. Prvo:

```bash
k describe pvc <ime>       # Events na dnu
k get pv                   # postoji li slobodan PV i kakvi su mu atributi
k get sc                   # postoji li klasa i koja je default
```

| Simptom (Events / stanje) | Uzrok | Rješenje |
|---|---|---|
| `waiting for first consumer to be created before binding` | `WaitForFirstConsumer`, nema Poda | Normalno. Napravi Pod |
| `no persistent volumes available for this claim and no storage class is set` | `storageClassName: ""` i nema odgovarajućeg PV-a | Napravi PV bez klase ili ispravi uslove |
| `storageclass.storage.k8s.io "fsat" not found` | Greška u imenu klase | `storageClassName` je nepromjenljiv: obriši i napravi PVC ponovo |
| PVC Pending, PV Available, a nema eventa o grešci | Ne slažu se klasa, access mode, kapacitet ili volumeMode | Uporedi `k get pv,pvc -o wide` polje po polje |
| PVC vezan za novi `pvc-...` PV umjesto tvog | Izostavljen `storageClassName`, default klasa ga uzela | Obriši PVC, postavi `storageClassName: ""` ili klasu PV-a i `volumeName` |
| PV Released, novi PVC Pending | Stari `claimRef` | Ukloni `claimRef` |
| Pod `ContainerCreating`, event `FailedMount` / `FailedAttachVolume` | Problem sa montiranjem (putanja, NFS server, drajver) | `k describe pod`, logovi CSI drajvera |
| Pod Pending: `persistentvolumeclaim "x" not found` | PVC ne postoji ili je u drugom namespace-u | PVC mora biti u istom namespace-u kao Pod |

Većina polja u `spec` PVC-a je nepromjenljiva (osim `resources.requests.storage` i `volumeAttributesClassName`). Kad pogriješiš, najbrže je:

```bash
k get pvc data -o yaml > pvc.yaml   # ili uzmi originalni fajl
k delete pvc data
vim pvc.yaml && k apply -f pvc.yaml
```

> **Na ispitu:** Kad Pod sa PVC-om stoji u `ContainerCreating`, problem je u montiranju, ne u vezivanju. Kad stoji u `Pending` sa porukom `pod has unbound immediate PersistentVolumeClaims`, problem je u PVC-u: idi na `k describe pvc`.

## Rezime

- Pod koristi PVC, PVC se veže za PV 1:1. Vezivanje traži isti `storageClassName`, dovoljan kapacitet, podržane access modes i isti `volumeMode`.
- `storageClassName: ""` znači „bez klase, bez dinamičkog provisioninga“; izostavljeno polje znači „default klasa“. Za vezivanje za konkretan PV koristi `""` (ili klasu PV-a) i `volumeName`.
- RWO je po čvoru, RWOP po Podu (GA, samo CSI), RWX traži mrežni storage. Access mode ne štiti od pisanja: za to je `readOnly: true`.
- Retain ostavlja PV u stanju Released; ponovo ga koristiš uklanjanjem `claimRef`. Delete briše i storage. Recycle je deprecated.
- StorageClass: `provisioner`, `parameters`, `reclaimPolicy` (default Delete), `volumeBindingMode`, `allowVolumeExpansion`. Default klasa se bira anotacijom `storageclass.kubernetes.io/is-default-class`.
- `WaitForFirstConsumer` drži PVC u Pending dok se ne pojavi Pod. U labu tako radi `local-path`.
- PVC se proširuje izmjenom `resources.requests.storage` na PVC-u, samo ako klasa dozvoljava; smanjivanje nije moguće.
- `hostPath` je vezan za čvor i opasan; u produkciji koristi PVC i CSI.
