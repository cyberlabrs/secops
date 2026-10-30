## Šta ovaj modul pokriva

Modul pokriva cilj **1.4** iz domena 1 (**Cluster Architecture, Installation & Configuration**, 25% ispita): upravljanje životnim ciklusom klastera. To su tri teme koje se na ispitu pojavljuju gotovo uvijek:

- **nadogradnja** kubeadm klastera na sljedeću minor verziju (control plane, pa workeri),
- **backup i restore etcd-a** (`etcdctl snapshot save`, `etcdutl snapshot restore`),
- **certifikati** kontrolne ravni (provjera isteka, obnova) i održavanje čvorova (`drain`, `cordon`, `uncordon`).

Ovi zadaci nose dosta bodova i imaju jasan postupak. Ako ga uvježbaš napamet, rješavaš ih za 5–8 minuta. Tipični zadaci:

- „Nadogradi controlplane i node01 sa v1.35.0 na v1.36.5. Ne nadograđuj druge pakete.“
- „Napravi snapshot etcd-a u `/opt/etcd-backup.db`.“
- „Vrati etcd iz `/opt/etcd-backup.db` u direktorij `/var/lib/etcd-restore`.“
- „Zapiši datum isteka certifikata API servera u `/opt/cert-expiry.txt`.“
- „Pripremi node01 za održavanje tako da na njemu ne radi nijedan aplikacijski Pod.“

## Održavanje čvorova: cordon, drain, uncordon

| Komanda | Šta radi | Postojeći Podovi |
|---|---|---|
| `kubectl cordon node01` | Označi čvor kao unschedulable (`spec.unschedulable: true`) | Ostaju |
| `kubectl drain node01 ...` | `cordon` + **eviction** svih Podova | Premještaju se (ako ih kontroler ponovo kreira) |
| `kubectl uncordon node01` | Vrati čvor u raspoređivanje | Ne vraćaju se automatski |

```bash
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data
kubectl get nodes          # node01   Ready,SchedulingDisabled
# ... održavanje ...
kubectl uncordon node01
```

Zašto drain staje i koji flag to rješava:

| Poruka / situacija | Flag | Posljedica |
|---|---|---|
| `cannot delete DaemonSet-managed Pods` | `--ignore-daemonsets` | DaemonSet Podovi ostaju (ionako bi ih DaemonSet vratio) |
| `cannot delete Pods with local storage` (emptyDir) | `--delete-emptydir-data` | Podaci u emptyDir se gube |
| `cannot delete Pods that declare no controller` (goli Pod) | `--force` | Pod se briše i **ne vraća se** nigdje |
| `Cannot evict pod as it would violate the pod's disruption budget` | nema flaga; drain ponavlja pokušaj | Čekaš, povećaš replike ili privremeno izmijeniš PDB |
| Pod predugo završava | `--timeout=120s`, `--grace-period=30` | — |

Drain koristi **Eviction API**, zato poštuje **PodDisruptionBudget**. Static Pods (mirror Podovi) drain preskače.

> **Na ispitu:** Ako zadatak kaže „ne smije se izgubiti nijedan Pod“, a na čvoru je goli Pod bez kontrolera, `--force` nije rješenje. Prvo napravi kopiju (`kubectl get pod x -o yaml > x.yaml`) ili pročitaj zadatak ponovo. Kod uobičajenih zadataka dovoljni su `--ignore-daemonsets --delete-emptydir-data`.

## Nadogradnja kubeadm klastera

### Pravila verzija (version skew policy)

- Nadograđuje se **jedna minor verzija odjednom**: 1.35 → 1.36 → 1.37. Preskakanje minor verzije nije podržano.
- Patch verzije unutar iste minor verzije (1.36.1 → 1.36.5) mogu se preskakati.
- Redoslijed: **prvo kontrolna ravan, pa workeri**. kube-apiserver mora biti najnoviji u klasteru.

| Komponenta | Dozvoljeno odstupanje u odnosu na kube-apiserver |
|---|---|
| kube-apiserver (HA) | Instance međusobno najviše 1 minor razlike |
| kube-controller-manager, kube-scheduler | Ne novije; najviše 1 minor starije |
| **kubelet** | Ne noviji; do **3 minor** starije |
| kube-proxy | Ne noviji; do 3 minor starije (i do 3 od kubeleta na istom čvoru) |
| **kubectl** | ±1 minor |

Primjer: sa API serverom 1.36 kubelet može biti 1.36, 1.35, 1.34 ili 1.33. Kubelet 1.37 nije podržan.

### Paketi i repozitorij

Paketi se instaliraju sa **pkgs.k8s.io**, gdje svaka minor verzija ima zaseban repozitorij. Za prelazak na novu minor verziju prvo mijenjaš verziju u URL-u:

```bash
cat /etc/apt/sources.list.d/kubernetes.list
# deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.35/deb/ /
sed -i 's#/v1.35/#/v1.36/#' /etc/apt/sources.list.d/kubernetes.list
apt-get update
apt-cache madison kubeadm          # dostupne verzije, npr. 1.36.5-1.1
```

U lab okruženju `/etc/apt/sources.list.d/kubernetes.list` već pokazuje na lokalni repozitorij sa verzijom **1.36.5**, pa je dovoljno `apt-get update`. Paketi su zaključani sa `apt-mark hold` da ih `apt upgrade` ne bi slučajno nadogradio; zato svaki korak ide kao `unhold` → `install` → `hold`.

### Korak 1: prvi control plane čvor

```bash
ssh controlplane      # ili si već na njemu
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm='1.36.5-1.1'
apt-mark hold kubeadm
kubeadm version -o short          # v1.36.5

kubeadm upgrade plan              # provjere i spisak verzija na koje možeš preći
kubeadm upgrade apply v1.36.5     # nadogradi static Pods, CoreDNS, kube-proxy, kubeadm-config
```

`kubeadm upgrade apply`:

- provjeri da je klaster zdrav i da je skok verzije dozvoljen,
- povuče image-e, napravi kopiju starih manifesta u `/etc/kubernetes/tmp/` i upiše nove u `/etc/kubernetes/manifests/`,
- po potrebi nadogradi etcd,
- **automatski obnovi certifikate** koje kubeadm upravlja (isključuje se sa `--certificate-renewal=false`),
- nadogradi addone CoreDNS i kube-proxy.

Uspjeh se vidi po poruci `[upgrade/successful] SUCCESS! Your cluster was upgraded to "v1.36.5"`. CNI se ne nadograđuje: to radiš po uputstvu CNI projekta, ako treba.

Zatim kubelet i kubectl na istom čvoru:

```bash
kubectl drain controlplane --ignore-daemonsets
apt-mark unhold kubelet kubectl
apt-get install -y kubelet='1.36.5-1.1' kubectl='1.36.5-1.1'
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon controlplane
kubectl get nodes                  # controlplane   Ready   v1.36.5
```

### Korak 2: ostali control plane čvorovi (HA)

Isto kao prvi, ali umjesto `kubeadm upgrade apply` ide:

```bash
kubeadm upgrade node
```

`upgrade plan` ovdje nije potreban. Control plane čvorovi se nadograđuju jedan po jedan.

### Korak 3: worker čvorovi

```bash
ssh node01
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm='1.36.5-1.1'
apt-mark hold kubeadm
kubeadm upgrade node               # na workeru nadogradi lokalnu kubelet konfiguraciju
exit

kubectl drain node01 --ignore-daemonsets --delete-emptydir-data   # sa controlplane

ssh node01
apt-mark unhold kubelet kubectl
apt-get install -y kubelet='1.36.5-1.1' kubectl='1.36.5-1.1'
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
exit

kubectl uncordon node01
kubectl get nodes
```

Važno: `kubectl drain` i `uncordon` pokrećeš tamo gdje imaš kubeconfig (controlplane), a `apt` i `systemctl` na samom čvoru.

> **Na ispitu:** Nakon `apt-get install kubelet` čvor u `kubectl get nodes` i dalje pokazuje staru verziju dok ne uradiš `systemctl restart kubelet`. Ako zaboraviš restart, zadatak se boduje kao neurađen. Na kraju uvijek provjeri `kubectl get nodes` i da nijedan čvor nije `SchedulingDisabled`.

Ako zadatak kaže „nadogradi samo kontrolnu ravan“ ili „samo kubelet na node01“, uradi tačno to. Postupak je u dokumentaciji pod „Upgrading kubeadm clusters“ (kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/), sa svim komandama za kopiranje.

## etcd backup

etcd u kubeadm klasteru radi kao static Pod `etcd-controlplane` i sluša na `https://127.0.0.1:2379`. Za pristup treba klijentski certifikat. Putanje pročitaš iz manifesta:

```bash
grep -E 'listen-client-urls|cert-file|key-file|trusted-ca-file|data-dir' /etc/kubernetes/manifests/etcd.yaml
#   - --cert-file=/etc/kubernetes/pki/etcd/server.crt
#   - --data-dir=/var/lib/etcd
#   - --key-file=/etc/kubernetes/pki/etcd/server.key
#   - --listen-client-urls=https://127.0.0.1:2379,https://172.18.0.2:2379
#   - --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
```

Snapshot (etcdctl 3.6; `ETCDCTL_API=3` više nije potreban jer je v3 podrazumijevan):

```bash
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /opt/etcd-backup.db

etcdutl --write-out=table snapshot status /opt/etcd-backup.db
```

| Flag etcdctl | Odgovara flagu etcd-a u manifestu |
|---|---|
| `--cacert` | `--trusted-ca-file` |
| `--cert` | `--cert-file` |
| `--key` | `--key-file` |
| `--endpoints` | `--listen-client-urls` / `--advertise-client-urls` |

Umjesto `server.crt` možeš koristiti i `/etc/kubernetes/pki/etcd/healthcheck-client.crt` ili `/etc/kubernetes/pki/apiserver-etcd-client.crt` sa pripadajućim ključem; svi su potpisani etcd CA-om.

Druge korisne komande:

```bash
E="etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key"
$E endpoint health
$E member list -w table
$E get /registry/namespaces --prefix --keys-only | head
```

Snapshot sadrži sve Secrete klastera. Čuvaj ga zaštićeno (`chmod 600`, šifrovano van čvora).

> **Na ispitu:** Ako `snapshot save` visi ili javlja `context deadline exceeded`, gotovo uvijek fale ili su pogrešni cert flagovi, ili koristiš `http://` umjesto `https://`. Cert putanje kopiraj iz `etcd.yaml`, ne kucaj ih napamet.

## etcd restore

Od etcd 3.6 **`etcdctl snapshot restore` i `etcdctl snapshot status` su uklonjeni**. Restore radi **`etcdutl`**, koji radi direktno nad fajlovima (bez mreže i bez certifikata).

```bash
etcdutl --data-dir /var/lib/etcd-restore snapshot restore /opt/etcd-backup.db
ls /var/lib/etcd-restore     # member/
```

Ciljni direktorij **ne smije postojati** (ili mora biti prazan): `etcdutl` ga kreira. Restore u postojeći `/var/lib/etcd` dok etcd radi ne smiješ raditi.

Zatim etcd static Pod usmjeriš na novi direktorij. U `/etc/kubernetes/manifests/etcd.yaml` mijenjaš **`hostPath.path`** volumena `etcd-data`:

```yaml
  volumes:
  - hostPath:
      path: /etc/kubernetes/pki/etcd
      type: DirectoryOrCreate
    name: etcd-certs
  - hostPath:
      path: /var/lib/etcd-restore      # bilo /var/lib/etcd
      type: DirectoryOrCreate
    name: etcd-data
```

Unutar kontejnera putanja ostaje `/var/lib/etcd` (`mountPath` i `--data-dir` se ne mijenjaju), samo sada pokazuje na novi direktorij na hostu. Ako promijeniš i `--data-dir`, moraš uskladiti i `volumeMounts.mountPath`, inače etcd piše u prazan direktorij unutar kontejnera.

Kompletan postupak za single control plane:

```bash
# 1. zaustavi API server (dokumentacija: ne vraćaj etcd dok API serveri rade)
mv /etc/kubernetes/manifests/kube-apiserver.yaml /root/
# 2. restore u novi direktorij
etcdutl --data-dir /var/lib/etcd-restore snapshot restore /opt/etcd-backup.db
# 3. etcd.yaml: hostPath etcd-data -> /var/lib/etcd-restore
vim /etc/kubernetes/manifests/etcd.yaml
# 4. vrati API server i sačekaj
mv /root/kube-apiserver.yaml /etc/kubernetes/manifests/
watch crictl ps            # etcd i kube-apiserver Running
kubectl get pods -A        # stanje iz trenutka backupa
```

Kubelet sam primijeti izmjenu manifesta i ponovo kreira etcd Pod. Ako to potraje, `systemctl restart kubelet`. Preporuka je restartovati i kube-scheduler, kube-controller-manager i kubelet, da ne rade sa keširanim stanjem novijim od backupa.

Kod etcd klastera sa više članova restore se radi na svakom članu sa `--name`, `--initial-cluster` i `--initial-advertise-peer-urls` iz istog snapshota. Za ispit je dovoljan jedan član.

> **Na ispitu:** Nakon izmjene `etcd.yaml` `kubectl` može 1–2 minute javljati greške. Ne mijenjaj ništa dalje u panici; prati `crictl ps -a | grep -E 'etcd|apiserver'` i `crictl logs` etcd kontejnera. Najčešća greška je pogrešna putanja u hostPath-u ili restore u direktorij koji već postoji.

## Certifikati

kubeadm pravi PKI u `/etc/kubernetes/pki/`:

| Fajl | Namjena |
|---|---|
| `ca.crt`, `ca.key` | CA klastera (10 godina) |
| `apiserver.crt/.key` | Serving certifikat API servera (SAN: imena, IP-ovi, `controlPlaneEndpoint`) |
| `apiserver-kubelet-client.crt/.key` | API server → kubelet |
| `apiserver-etcd-client.crt/.key` | API server → etcd |
| `front-proxy-ca.*`, `front-proxy-client.*` | Aggregation layer (npr. metrics-server) |
| `sa.key`, `sa.pub` | Potpis ServiceAccount tokena (par ključeva, nije certifikat) |
| `etcd/ca.*`, `etcd/server.*`, `etcd/peer.*`, `etcd/healthcheck-client.*` | etcd PKI |

Klijentski certifikati za `admin.conf`, `super-admin.conf`, `controller-manager.conf` i `scheduler.conf` su ugrađeni u te kubeconfig fajlove. Kubelet ima svoj certifikat u `/var/lib/kubelet/pki/` i **sam ga rotira** (zato `kubelet.conf` nije u izvještaju kubeadm-a).

Ne-CA certifikati traju **1 godinu**, CA **10 godina**. U v1beta4 to se mijenja poljima `certificateValidityPeriod` i `caCertificateValidityPeriod` u ClusterConfiguration.

### Provjera isteka

```bash
kubeadm certs check-expiration
# CERTIFICATE        EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED
# admin.conf         Oct 14, 2027 09:12 UTC   363d            ca                      no
# apiserver          Oct 14, 2027 09:12 UTC   363d            ca                      no
# ...

openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
# notAfter=Oct 14 09:12:31 2027 GMT
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 'Subject Alternative Name'
```

### Obnova

```bash
kubeadm certs renew all                 # ili pojedinačno: kubeadm certs renew apiserver
kubeadm certs check-expiration          # novi datumi
```

Obnovljeni certifikati se ne učitavaju sami. Static Pods kontrolne ravni treba restartovati, a `kubectl delete pod` to ne radi (mirror Pod). Postupak iz dokumentacije: izmjesti manifest, sačekaj da kubelet ugasi Pod (~20 s), vrati ga.

```bash
cd /etc/kubernetes/manifests
for f in kube-apiserver kube-controller-manager kube-scheduler etcd; do
  mv $f.yaml /tmp/ ; sleep 20 ; mv /tmp/$f.yaml . ; done
cp /etc/kubernetes/admin.conf ~/.kube/config     # admin.conf je takođe obnovljen
```

Na HA klasteru `kubeadm certs renew all` pokrećeš na svakom control plane čvoru. Redovna godišnja nadogradnja automatski obnavlja certifikate, pa klasteri koji se redovno nadograđuju rijetko imaju ovaj problem.

> **Na ispitu:** Kad pitaju „do kada važi certifikat X“, `kubeadm certs check-expiration` je najbrži, ali za tačan format datuma u odgovoru koristi `openssl x509 -noout -enddate`. Upiši tačno ono što zadatak traži (npr. samo datum).

## Troubleshooting

| Simptom | Vjerovatan uzrok | Šta raditi |
|---|---|---|
| `kubeadm upgrade apply` odbija verziju | Pokušaj preskakanja minor verzije ili kubeadm nije nadograđen | `kubeadm version`, pa `upgrade plan` |
| `apt-get install kubeadm=...` javlja `Held packages were changed` | Nije urađen `apt-mark unhold` | `apt-mark unhold kubeadm` |
| `E: Version '1.36.5-1.1' for 'kubeadm' was not found` | Repozitorij još pokazuje na staru minor verziju | Promijeni URL u `kubernetes.list`, `apt-get update`, `apt-cache madison kubeadm` |
| Čvor i dalje pokazuje staru verziju | Kubelet nije restartovan | `systemctl daemon-reload && systemctl restart kubelet` |
| Čvor ostaje `SchedulingDisabled` | Zaboravljen `uncordon` | `kubectl uncordon <čvor>` |
| `kubectl` javlja `x509: certificate has expired` | Istekli certifikati kontrolne ravni ili stari `~/.kube/config` | `kubeadm certs renew all`, restart static Podova, kopiraj `admin.conf` |
| Nakon restore-a etcd pada | Ciljni direktorij je postojao, pogrešan hostPath | `crictl logs`, provjeri `etcd.yaml`, ponovi restore u novi direktorij |
| Nakon restore-a vidiš „stare“ objekte | To je očekivano: klaster je vraćen na trenutak backupa | — |

## Rezime

- Održavanje: `kubectl drain <čvor> --ignore-daemonsets --delete-emptydir-data`, posao na čvoru, `kubectl uncordon <čvor>`; drain poštuje PodDisruptionBudget.
- Nadogradnja ide jednu minor verziju odjednom, prvo kontrolna ravan pa workeri; kubelet nikad nije noviji od API servera (smije biti do 3 minor starije), kubectl ±1.
- Prvi control plane: `unhold` → kubeadm → `hold`, `kubeadm upgrade plan`, `kubeadm upgrade apply v1.36.5`, drain, kubelet i kubectl, `daemon-reload`, `restart kubelet`, uncordon.
- Ostali control plane čvorovi i workeri: `kubeadm upgrade node` umjesto `apply`.
- Backup: `etcdctl snapshot save` sa `--endpoints`, `--cacert`, `--cert`, `--key` iz `etcd.yaml`; provjera sa `etcdutl snapshot status`.
- Restore: `etcdutl --data-dir <novi-dir> snapshot restore <fajl>` (etcdctl restore ne postoji u 3.6), pa izmjena `hostPath` volumena `etcd-data` u `etcd.yaml`.
- Certifikati: `/etc/kubernetes/pki/`, `kubeadm certs check-expiration`, `kubeadm certs renew all` + restart static Podova; `kubeadm upgrade` ih obnavlja automatski.
