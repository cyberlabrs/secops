## Šta ovaj modul pokriva

Domen 5 (**Troubleshooting**) je najveći na ispitu: **30%**. Ovaj modul pokriva dva cilja:

- **5.1** troubleshooting klastera i čvorova (**Troubleshoot clusters and nodes**),
- **5.2** troubleshooting komponenti klastera (**Troubleshoot cluster components**).

Tipični zadaci:

- „Čvor `node01` je `NotReady`. Popravi ga tako da ostane ispravan i nakon restarta.“
- „`kubectl` ne radi: The connection to the server controlplane:6443 was refused. Popravi kontrolnu ravan.“
- „Novi Podovi ostaju u stanju Pending“ ili „Deployment ne pravi Podove“. Uzrok je u scheduleru ili controller-manageru.
- „Zapiši u fajl `/opt/answer.txt` ime komponente koja ne radi“.

Ovo su zadaci sa najviše bodova i najviše stresa. Pomaže samo sistematičan pristup: **od čvora prema kontrolnoj ravni, od statusa prema logu.** Na kraju svakog zadatka provjeri da je stanje stvarno ispravljeno.

## Mapa: gdje šta živi u kubeadm klasteru

| Komponenta | Kako radi | Konfiguracija | Logovi |
|---|---|---|---|
| **kubelet** | systemd servis na svakom čvoru | `/var/lib/kubelet/config.yaml`, `/etc/kubernetes/kubelet.conf`, drop-in `10-kubeadm.conf`, `/var/lib/kubelet/kubeadm-flags.env` | `journalctl -u kubelet` |
| **containerd** | systemd servis na svakom čvoru | `/etc/containerd/config.toml` | `journalctl -u containerd` |
| **kube-apiserver** | **static Pod** na controlplane | `/etc/kubernetes/manifests/kube-apiserver.yaml` | `crictl logs`, `/var/log/pods/` |
| **etcd** | static Pod | `/etc/kubernetes/manifests/etcd.yaml` | isto |
| **kube-scheduler** | static Pod | `/etc/kubernetes/manifests/kube-scheduler.yaml`, `/etc/kubernetes/scheduler.conf` | isto |
| **kube-controller-manager** | static Pod | `/etc/kubernetes/manifests/kube-controller-manager.yaml`, `/etc/kubernetes/controller-manager.conf` | isto |
| **kube-proxy** | DaemonSet | ConfigMap `kube-proxy` u `kube-system` | `k logs -n kube-system ds/kube-proxy` |
| **CoreDNS** | Deployment | ConfigMap `coredns` | `k logs -n kube-system deploy/coredns` |

Certifikati kontrolne ravni su u `/etc/kubernetes/pki/` (etcd u `/etc/kubernetes/pki/etcd/`). Klijentski certifikat kubeleta je `/var/lib/kubelet/pki/kubelet-client-current.pem`.

Portovi koje vrijedi znati: API server `6443`, etcd `2379` (klijenti) i `2380` (peer), kubelet `10250`, kube-scheduler `10259`, kube-controller-manager `10257`, kubelet healthz `10248` na localhostu.

## Prvi pregled klastera

```bash
k config use-context <kontekst-iz-zadatka>
k get nodes -o wide
k get pods -n kube-system -o wide
k get --raw='/readyz?verbose'          # stanje API servera i njegovih provjera
k get --raw='/livez?verbose'
k cluster-info
k events -A --types=Warning            # svježi Warning eventi u cijelom klasteru
k get events -A --sort-by=.metadata.creationTimestamp | tail -20
```

`/readyz?verbose` ispisuje listu provjera (`[+]etcd ok`, `[+]poststarthook/...`). Ako neka pada, piše `[-]` i razlog. `k get componentstatuses` je **deprecated** i ne treba mu vjerovati.

`k cluster-info dump` ispiše ogromnu količinu stanja (čvorovi, Podovi, eventi, logovi iz `kube-system`). Koristan je za pretragu:

```bash
k cluster-info dump | grep -i error | head
k cluster-info dump --output-directory=/tmp/dump   # po namespace-ovima u fajlove
```

> **Na ispitu:** Svaki zadatak počinje komandom `kubectl config use-context ...` koju zadatak daje. Kopiraj je. Ako popravljaš čvor, `ssh` na pravi čvor (`ssh node01`), i ne zaboravi `exit` prije sljedećeg zadatka. Mnogo kandidata izgubi bodove radeći sljedeći zadatak na pogrešnoj mašini.

## Čvor NotReady

### Šta pokazuje kubectl

```bash
k get nodes
# NAME           STATUS     ROLES           AGE   VERSION
# controlplane   Ready      control-plane   2d    v1.35.0
# node01         NotReady   <none>          2d    v1.35.0
k describe node node01 | sed -n '/Conditions/,/Addresses/p'
```

| Uslov (Conditions) | Šta znači |
|---|---|
| `Ready=Unknown`, „Kubelet stopped posting node status“ | Kubelet ne javlja status: ne radi, ne može do API servera ili ima pogrešne kredencijale |
| `Ready=False`, „container runtime network not ready… cni plugin not initialized“ | CNI nije instaliran ili ne radi |
| `Ready=False`, „container runtime is down“ | containerd ne radi |
| `MemoryPressure=True` | Malo memorije; kubelet izbacuje (evict) Podove |
| `DiskPressure=True` | Malo diska (nodefs/imagefs); taint `node.kubernetes.io/disk-pressure` |
| `PIDPressure=True` | Previše procesa |

Kad je čvor nedostupan, kontroler dodaje taint `node.kubernetes.io/unreachable` (ili `not-ready`) sa efektom `NoExecute`. Podovi bez odgovarajuće tolerancije bivaju izbačeni nakon 300 sekundi (podrazumijevana tolerancija koju dodaje admission plugin).

### Postupak na čvoru

```bash
ssh node01
systemctl status kubelet          # active (running)? ili activated/failed?
systemctl status containerd
journalctl -u kubelet --no-pager | tail -30
journalctl -u kubelet -f          # prati uživo dok restartuješ
```

Najčešći scenariji i rješenja:

| Simptom u `systemctl` / `journalctl` | Uzrok | Rješenje |
|---|---|---|
| `inactive (dead)` | Kubelet zaustavljen | `systemctl enable --now kubelet` |
| `disabled` u liniji Loaded | Neće se pokrenuti nakon restarta | `systemctl enable kubelet` |
| `status=203/EXEC` | Pogrešna putanja binarnog fajla u unit/drop-in fajlu | `systemctl cat kubelet`, ispravi `ExecStart`, `systemctl daemon-reload` |
| `failed to load kubelet config file ... /var/lib/kubelet/config.yaml` | Fajl ne postoji, pogrešna putanja u `--config`, YAML greška | Ispravi fajl ili putanju |
| `unknown flag: --xyz` | Nepostojeći flag u `kubeadm-flags.env` ili drop-in | Ukloni flag |
| `validate service connection` … `containerd.sock` … `no such file or directory` ili `connection refused` | containerd ne radi ili pogrešan `containerRuntimeEndpoint` | `systemctl start containerd`, ispravi endpoint |
| `dial tcp ...:6443: connect: connection refused` / `no such host` | Pogrešan `server:` u `/etc/kubernetes/kubelet.conf` ili API server ne radi | Ispravi adresu (`https://controlplane:6443`) |
| `x509: certificate signed by unknown authority` / `certificate has expired` | Pogrešan CA u `config.yaml` (`authentication.x509.clientCAFile`) ili istekao certifikat | Ispravi putanju na `/etc/kubernetes/pki/ca.crt`; obnovi certifikat |

Nakon svake izmjene:

```bash
systemctl daemon-reload           # samo ako si mijenjao unit ili drop-in fajl
systemctl restart kubelet
systemctl status kubelet
exit
k get nodes -w                    # sa controlplane: čekaj Ready
```

`systemctl cat kubelet` pokazuje unit i sve drop-in fajlove, sa tačnim putanjama. Tu vidiš koji `--config` i `--kubeconfig` kubelet koristi i odakle čita `kubeadm-flags.env`.

Ključni dijelovi `/var/lib/kubelet/config.yaml`:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
authentication:
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
cgroupDriver: systemd
clusterDNS:
- 10.96.0.10
clusterDomain: cluster.local
staticPodPath: /etc/kubernetes/manifests
containerRuntimeEndpoint: unix:///run/containerd/containerd.sock
```

> **Na ispitu:** Zadatak često kaže „popravi tako da preživi restart“. Zato uvijek provjeri da je servis `enabled` (`systemctl is-enabled kubelet`), ne samo `active`. Promjene napravljene ručno u procesu bez izmjene fajla ne preživljavaju restart.

### Disk i memorija

```bash
df -h /var/lib/kubelet /var/lib/containerd
free -m
crictl images                 # zauzeće slika
crictl rmi --prune            # ukloni nekorišćene slike
journalctl -u kubelet | grep -i evict
```

Kubelet sam pokušava osloboditi prostor (garbage collection slika, izbacivanje Podova) prema pragovima `evictionHard` u `config.yaml`. Kad se pritisak smanji, uslov se vraća na `False` i taint nestaje.

## crictl: kad API server ne radi

Kad `kubectl` ne odgovara, kubectl ti ne može reći ništa o static Podovima. Tada direktno pitaš container runtime preko **crictl** (endpoint je u `/etc/crictl.yaml`).

```bash
crictl ps                         # kontejneri koji rade
crictl ps -a | grep kube-apiserver   # i oni koji su pali (Exited)
crictl pods                       # sandboxovi Podova
crictl logs <container-id>        # logovi kontejnera
crictl logs --tail=30 <container-id>
crictl inspect <container-id> | less
crictl images
```

Ako kontejner stalno pada, broj u koloni `ATTEMPT` raste, a stari kontejneri ostaju `Exited`. Logovi posljednjeg pokušaja obično sadrže tačnu poruku greške.

Logovi postoje i kao fajlovi na disku čvora:

- `/var/log/pods/<namespace>_<pod>_<uid>/<kontejner>/0.log` (stvarni fajlovi),
- `/var/log/containers/<pod>_<namespace>_<kontejner>-<id>.log` (symlinkovi na prethodne).

```bash
ls /var/log/pods/ | grep apiserver
tail -20 /var/log/pods/kube-system_kube-apiserver-controlplane_*/kube-apiserver/*.log
```

## Static Pod manifesti kontrolne ravni

Kubelet na controlplane čita direktorijum `staticPodPath` (`/etc/kubernetes/manifests`) i sam pokreće sve Podove iz njega. API server samo prikazuje njihove **mirror Podove** (ime ima sufiks `-controlplane`). Zato:

- izmjenu radiš u fajlu, a ne preko `kubectl edit` (izmjena mirror Poda se ne primjenjuje);
- kubelet primijeti promjenu fajla i ponovo napravi Pod. Ovo traje i do minute;
- `kubectl delete pod kube-apiserver-controlplane` ne briše komponentu, kubelet je odmah vrati.

Uvijek napravi kopiju **van** manifest direktorijuma prije izmjene:

```bash
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
vim /etc/kubernetes/manifests/kube-apiserver.yaml
watch crictl ps -a          # čekaj da se kontejner ponovo pojavi i ostane Running
```

Kopija u istom direktorijumu (`kube-apiserver.yaml.bak`) je loša ideja: kubelet može pokušati da je učita kao manifest.

> **Na ispitu:** Kad mijenjaš manifest API servera, `kubectl` neće raditi 30–90 sekundi. Ne paniči i ne mijenjaj fajl ponovo dok čekaš. Prati `crictl ps -a | grep apiserver` i, ako se ne podiže, `journalctl -u kubelet | grep -i apiserver` i log kontejnera.

### Tipične greške u manifestima

| Greška | Gdje se vidi | Primjer |
|---|---|---|
| YAML sintaksa (uvlačenje, tab, nezatvoren navodnik) | Kubelet ne može učitati fajl: Pod se uopšte ne pravi, nema kontejnera u `crictl ps -a`. Poruka je u `journalctl -u kubelet` | `could not process manifest file` |
| Nepostojeći ili pogrešno napisan flag | Kontejner starta i odmah izlazi; `crictl logs` | `Error: unknown flag: --etcd-server` |
| Pogrešna putanja certifikata | `crictl logs` | `open /etc/kubernetes/pki/apiserver.crtt: no such file or directory` |
| Pogrešan port ili adresa etcd-a | API server se pokrene pa padne; `crictl logs` | `dial tcp 127.0.0.1:2380: connect: connection refused` (2380 je peer port; klijentski je 2379) |
| Pogrešan `hostPath` volumen | Pod se ne može napraviti ili fajlovi ne postoje u kontejneru | Putanja u `volumes` ne odgovara `volumeMounts` ili disku |
| Pogrešna slika (tag) | `ErrImagePull` u `crictl pods`/journal | `registry.k8s.io/kube-apiserver:v1.35.9` ne postoji |
| Pogrešan `--kubeconfig` scheduler/controller-manager | Komponenta radi, ali ne može do API servera | `stat /etc/kubernetes/scheduler.config: no such file` |
| Liveness probe na pogrešnom portu | Kubelet stalno restartuje komponentu | `Liveness probe failed` u journal-u |

Isječak ispravnog manifesta API servera (samo bitne linije):

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --advertise-address=172.18.0.2
    - --client-ca-file=/etc/kubernetes/pki/ca.crt
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
    - --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
    - --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key
    - --etcd-servers=https://127.0.0.1:2379
    - --secure-port=6443
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
    - --tls-private-key-file=/etc/kubernetes/pki/apiserver.key
    image: registry.k8s.io/kube-apiserver:v1.35.0
```

Brzo poređenje sa onim što postoji na disku:

```bash
grep -E 'crt|key|etcd-servers' /etc/kubernetes/manifests/kube-apiserver.yaml
ls /etc/kubernetes/pki/ /etc/kubernetes/pki/etcd/
```

Za tačne nazive flagova koristi dokumentaciju: „kube-apiserver“ reference stranica (Reference → Command line tools reference).

## Simptomi po komponenti

Kad nešto ne radi, simptom ti često kaže koja komponenta je kriva.

| Komponenta ne radi | Simptom |
|---|---|
| **kube-apiserver** | `kubectl`: `The connection to the server controlplane:6443 was refused` ili timeout. Ništa ne radi kroz API, ali postojeći Podovi nastavljaju da rade |
| **etcd** | API server se ruši ili ne postaje ready; u njegovom logu greške prema `127.0.0.1:2379`. `kubectl` vraća timeout ili `etcdserver: request timed out` |
| **kube-scheduler** | Novi Podovi ostaju **Pending** i **nemaju nijedan event** (ni `Scheduled` ni `FailedScheduling`). Polje `nodeName` je prazno. Podovi kojima je `nodeName` zadan ručno ipak se pokreću |
| **kube-controller-manager** | `k create deploy` prođe, ali nema ReplicaSet-a ni Podova. Skaliranje ne radi, Job ne pravi Podove, obrisani Podovi ReplicaSet-a se ne zamjenjuju, PVC-ovi se ne vezuju, NotReady čvorovi ne dobijaju taint |
| **kubelet na čvoru** | Čvor `NotReady`; Podovi na njemu nakon 5 minuta prelaze u `Terminating`/`Unknown` |
| **kube-proxy** | Servisi (ClusterIP) ne prosljeđuju saobraćaj, iako Podovi rade i endpointi postoje |
| **CoreDNS** | Imena servisa se ne razrješavaju; IP adrese rade |
| **CNI** | Čvorovi `NotReady` sa „cni plugin not initialized“; Podovi u `ContainerCreating` |

Primjer dijagnoze scheduler-a:

```bash
k run test --image=nginx:1.27
k get pod test                       # Pending
k describe pod test | tail -5        # Events: <none>
k get pods -n kube-system | grep scheduler
# kube-scheduler-controlplane   0/1   CrashLoopBackOff
k logs -n kube-system kube-scheduler-controlplane
# ili, ako mirror Pod ne postoji:
crictl ps -a | grep scheduler
```

Logove static Podova možeš čitati i preko `k logs -n kube-system <pod>` dok API server radi. Kad API server ne radi, ostaje samo `crictl logs` ili `/var/log/pods/`.

> **Na ispitu:** Pending bez ijednog eventa = scheduler. Pending sa eventom `FailedScheduling` = scheduler radi, ali ne nalazi čvor (resursi, taint, affinity, PVC). To su dva potpuno različita zadatka.

## etcd ukratko

etcd je static Pod sa podacima u `/var/lib/etcd` (hostPath). Provjera zdravlja sa controlplane čvora:

```bash
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health
```

Tipične greške u `etcd.yaml`: pogrešan `--data-dir` ili `hostPath` za `/var/lib/etcd` (etcd krene „prazan“ i klaster izgleda kao da je izgubio sve objekte), pogrešne putanje certifikata (`--cert-file`, `--key-file`, `--trusted-ca-file`). Backup i restore su u modulu o životnom ciklusu klastera.

## Certifikati

```bash
kubeadm certs check-expiration
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -enddate -ext subjectAltName
kubeadm certs renew all              # pa restartuj static Podove (premjesti manifeste van i vrati) i kubelet
```

Istekli ili pogrešni certifikati se vide kao `x509:` poruke u logovima API servera, kubeleta ili u odgovoru `kubectl`-a. Kubelet sam rotira svoj klijentski certifikat (`rotateCertificates: true` u kubeadm podešavanju).

## Troubleshooting: redoslijed

1. `k get nodes` i `k get pods -n kube-system`: šta nije Ready ili Running?
2. Ako `kubectl` ne radi: `ssh controlplane`, `crictl ps -a | grep kube-`, logovi API servera i etcd-a, `journalctl -u kubelet`.
3. Ako je čvor NotReady: `ssh` na čvor, `systemctl status kubelet containerd`, `journalctl -u kubelet`.
4. Ako komponenta kontrolne ravni pada: uporedi manifest sa dokumentacijom i diskom (putanje, portovi, flagovi), log kontejnera.
5. Ako Podovi ne prelaze u Running: eventi i `describe` (modul o troubleshootingu aplikacija).
6. Na kraju: `k get nodes`, `k get pods -n kube-system`, test Pod koji se zaista rasporedi.

> **Na ispitu:** Prije izmjene bilo kog fajla sistema (`config.yaml`, manifest, drop-in) napravi kopiju u `/root/`. Ako izmjena pogorša stanje, vratiš original za par sekundi umjesto da gubiš minute na rekonstrukciju.

## Rezime

- Kubelet i containerd su systemd servisi: `systemctl status/enable/restart`, `journalctl -u kubelet`. Konfiguracija je u `/var/lib/kubelet/config.yaml`, `/etc/kubernetes/kubelet.conf` i drop-in fajlu (`systemctl cat kubelet`).
- Čvor NotReady: provjeri kubelet, containerd, CNI, certifikate i pritisak resursa (`k describe node`, Conditions).
- Kontrolna ravan su static Podovi u `/etc/kubernetes/manifests`. Mijenjaj fajl, ne mirror Pod; kopiju drži van tog direktorijuma.
- Kad API server ne radi: `crictl ps -a`, `crictl logs`, `/var/log/pods/`, `journalctl -u kubelet` (za YAML greške u manifestu).
- Scheduler ne radi → Pending bez eventa. Controller-manager ne radi → nema ReplicaSet-a i Podova.
- `k get --raw='/readyz?verbose'`, `k events -A --types=Warning` i `k cluster-info dump` daju brzu sliku zdravlja klastera.
- Nakon popravke provjeri trajnost (enabled servis, ispravan fajl) i stvarni rezultat (čvor Ready, test Pod Running).
