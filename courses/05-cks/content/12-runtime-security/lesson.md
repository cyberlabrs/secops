## Šta ovaj modul pokriva

Modul pokriva četiri cilja iz domena 6 (**Monitoring, Logging and Runtime Security**, 20% ispita):

- **6.1** Perform behavioral analytics to detect malicious activities: **Falco** pravila koja prepoznaju sumnjivo ponašanje.
- **6.2** Detect threats within physical infrastructure, apps, networks, data, users and workloads: tipične detekcije (shell, osjetljivi fajlovi, mreža).
- **6.3** Investigate and identify phases of attack and bad actors: od Falco alarma do Poda, procesa i izolacije.
- **6.4** Ensure immutability of containers at runtime: `readOnlyRootFilesystem`, bez shella, immutable ConfigMap/Secret.

Tipični zadaci na ispitu:

- „Falco javlja da je u nekom kontejneru pokrenut shell. Pronađi Pod, upiši `namespace/ime` u `/opt/kurs/pod.txt` i skaliraj njegov Deployment na 0.“
- „Izmijeni Falco pravilo tako da output sadrži vrijeme, korisnika, ime kontejnera i sliku. Alarmi idu u `/var/log/falco/alerts.log`.“
- „Napiši pravilo koje detektuje čitanje `/etc/shadow` u kontejnerima.“
- „Učini Deployment `web` nepromjenljivim: root fajl sistem samo za čitanje, `/tmp` upisiv.“
- „Pronađi Podove koji nisu nepromjenljivi (privileged, upisiv root FS) i obriši ih.“

## Falco: arhitektura

**Falco** (CNCF projekat) posmatra **sistemske pozive** (syscalls) na čvoru i poredi ih sa pravilima. Kad se pravilo poklopi, šalje alarm. Ne blokira ništa: Falco je alat za **detekciju**, ne prevenciju.

```text
 proces u kontejneru ── syscall ──► kernel
                                      │  driver (modern eBPF ili kmod) hvata događaje
                                      ▼
                                 libscap / libsinsp  ── obogaćivanje: container.*, k8s.* (container runtime socket)
                                      ▼
                                 rules engine (falco_rules.yaml + falco_rules.local.yaml + rules.d/)
                                      ▼
                                 outputs: stdout (journald), fajl, syslog, http, program
```

| Driver (`engine.kind`) | Opis |
|---|---|
| `modern_ebpf` | Podrazumijevan; eBPF program ugrađen u Falco (CO-RE), ne treba kompajlirati za kernel. U labu. |
| `kmod` | Kernel modul; za starije kernele bez potrebne eBPF podrške |
| `nodriver`, `replay` | Bez syscall izvora (samo plugini) ili reprodukcija snimljenog fajla |

U labu Falco radi kao systemd servis `falco` na oba čvora. Falco vidi samo procese na **svom** čvoru, pa alarm za Pod na `node01` tražiš na `node01`.

```bash
systemctl status falco
journalctl -u falco -f                         # alarmi uživo (stdout ide u journald)
journalctl -u falco --since "10 min ago" | grep -i shell
ls /etc/falco/                                 # falco.yaml, falco_rules.yaml, falco_rules.local.yaml, rules.d/
```

### Konfiguracija: /etc/falco/falco.yaml

Najvažniji ključevi:

```yaml
rules_files:                     # redoslijed učitavanja je bitan
  - /etc/falco/falco_rules.yaml
  - /etc/falco/falco_rules.local.yaml
  - /etc/falco/rules.d
engine:
  kind: modern_ebpf
watch_config_files: true         # izmjena pravila/konfiguracije -> automatski reload
json_output: false               # true = svi izlazi u JSON-u
priority: debug                  # minimalni prioritet pravila koja se učitavaju
stdout_output:
  enabled: true
syslog_output:
  enabled: true
file_output:
  enabled: false
  keep_alive: false
  filename: ./events.txt
```

Zadatak „alarmi u fajl u JSON formatu“:

```yaml
json_output: true
file_output:
  enabled: true
  keep_alive: false
  filename: /var/log/falco/alerts.log
```

```bash
mkdir -p /var/log/falco
systemctl restart falco          # sigurniji od oslanjanja na automatski reload
journalctl -u falco -n 20        # provjeri da nema grešaka u učitavanju
```

> **Na ispitu:** **ne mijenjaj** `/etc/falco/falco_rules.yaml`. Izmjene idu u `/etc/falco/falco_rules.local.yaml`, koji se učitava poslije i može da preklopi pravila. Nakon svake izmjene pogledaj `journalctl -u falco -n 30`: greška u YAML-u ili nepoznato polje ostavlja Falco bez pravila ili ga gasi.

## Falco pravila

Fajl pravila je YAML lista sa tri vrste elemenata: **rule**, **macro** i **list**.

```yaml
- list: my_shells
  items: [bash, sh, zsh, dash, ash, ksh]

- macro: in_container                 # isto što i podrazumijevani macro "container"
  condition: (container.id != host)

- rule: Shell in container
  desc: Detektuje interaktivni shell pokrenut u kontejneru
  condition: >
    evt.type in (execve, execveat) and in_container
    and proc.name in (my_shells) and proc.tty != 0
  output: >
    Shell u kontejneru (user=%user.name container=%container.name id=%container.id
    image=%container.image.repository ns=%k8s.ns.name pod=%k8s.pod.name cmd=%proc.cmdline)
  priority: WARNING
  tags: [container, shell, mitre_execution]
```

| Ključ | Obavezan | Značenje |
|---|---|---|
| `rule` | da | Jedinstveno ime pravila |
| `desc` | da | Opis |
| `condition` | da | Filter izraz nad događajem |
| `output` | da | Poruka; `%polje` se zamjenjuje vrijednošću |
| `priority` | da | `EMERGENCY`, `ALERT`, `CRITICAL`, `ERROR`, `WARNING`, `NOTICE`, `INFORMATIONAL`, `DEBUG` |
| `tags` | ne | Oznake (npr. MITRE tehnike) |
| `enabled` | ne | `false` isključuje pravilo |
| `exceptions` | ne | Strukturisani izuzeci |
| `source` | ne | Izvor događaja; podrazumijevano `syscall` |

**Macro** je imenovani dio uslova koji se ponovo koristi; **list** je imenovana lista vrijednosti. Podrazumijevana pravila već definišu korisne macroe: `spawned_process` (uspješan `execve`), `container`, `open_read`, `open_write`, `shell_procs`. U svojim pravilima ih slobodno koristi.

Sa podrazumijevanim macroima isti uslov se piše kraće: `spawned_process and container and shell_procs and proc.tty != 0` (`spawned_process` usput osigurava da je `execve` uspio).

### Polja koja moraš znati

| Polje | Primjer vrijednosti |
|---|---|
| `evt.type` | `execve`, `openat`, `connect` |
| `proc.name` | `bash` (ime procesa, najviše 16 znakova) |
| `proc.cmdline` | `bash -c cat /etc/shadow` |
| `proc.pname` | Ime roditeljskog procesa, npr. `runc` ili `nginx` |
| `user.name` | `root` |
| `container.id` | Prvih 12 znakova ID-a kontejnera; `host` za procese na hostu |
| `container.name` | Ime kontejnera |
| `container.image.repository` | `docker.io/library/nginx` |
| `container.image.tag` | `1.27` |
| `k8s.ns.name` | `prod` |
| `k8s.pod.name` | `web-7d9c5-abcde` |
| `fd.name` | Putanja fajla (`/etc/shadow`) ili konekcija (`10.0.0.5:4444->1.2.3.4:443`) |
| `fd.sip`, `fd.sport` | IP i port servera kod mrežnih konekcija |

Spisak polja na mašini: `falco --list`. Operatori: `=`, `!=`, `in`, `startswith`, `endswith`, `contains`, `pmatch`, `and`, `or`, `not`.

### Mijenjanje postojećih pravila: override

Pravila iz `falco_rules.yaml` mijenjaš u `falco_rules.local.yaml` blokom **`override`** (stari ključ `append: true` je zastario):

| Element | `append` dozvoljen za | `replace` dozvoljen za |
|---|---|---|
| list | `items` | `items` |
| macro | `condition` | `condition` |
| rule | `condition`, `output`, `desc`, `tags`, `exceptions` | `condition`, `output`, `desc`, `priority`, `tags`, `exceptions`, `enabled` … |

```yaml
# /etc/falco/falco_rules.local.yaml

# dodaj program u postojeću listu
- list: shell_binaries
  items: [busybox]
  override:
    items: append

# promijeni output i prioritet postojećeg pravila
- rule: Terminal shell in container
  output: >
    %evt.time,%user.name,%container.name,%container.image.repository,%k8s.ns.name,%k8s.pod.name
  priority: CRITICAL
  override:
    output: replace
    priority: replace

# suzi uslov: ne javljaj za namespace dev
- rule: Terminal shell in container
  condition: and not k8s.ns.name = dev
  override:
    condition: append

# isključi pravilo
- rule: Read sensitive file untrusted
  enabled: false
  override:
    enabled: replace
```

Kod `condition: append` tekst se lijepi na kraj postojećeg uslova, zato počinje sa `and` ili `or`. Ako originalni uslov ima `or` bez zagrada, dodatak se veže drugačije nego što očekuješ.

Drugi način: kopiraj cijelo pravilo u `falco_rules.local.yaml` pod **istim imenom** i izmijeni ga. Pravilo učitano kasnije zamjenjuje ranije. Na ispitu je to često najbrže i najmanje sklono greškama.

> **Na ispitu:** zadatak tipa „output mora biti u formatu `vrijeme,korisnik,kontejner`“ znači tačno to: `%evt.time,%user.name,%container.name`, bez dodatnog teksta. Pravilo nađi sa `grep -n "rule: Terminal shell" /etc/falco/falco_rules.yaml`, kopiraj ga u local fajl i promijeni samo `output`.

## Tipične detekcije

```yaml
# /etc/falco/falco_rules.local.yaml

- rule: Read shadow in container
  desc: Čitanje /etc/shadow unutar kontejnera
  condition: open_read and container and fd.name = /etc/shadow
  output: "shadow pročitan (user=%user.name cmd=%proc.cmdline pod=%k8s.pod.name ns=%k8s.ns.name image=%container.image.repository)"
  priority: CRITICAL
  tags: [credential_access]

- rule: Write below etc in container
  desc: Upis u /etc unutar kontejnera
  condition: open_write and container and fd.name startswith /etc/
  output: "Upis u /etc (file=%fd.name cmd=%proc.cmdline pod=%k8s.pod.name ns=%k8s.ns.name)"
  priority: ERROR
  tags: [persistence]

- list: pkg_mgmt_bins
  items: [apt, apt-get, dpkg, yum, dnf, rpm, apk, pip, pip3, npm]

- rule: Package manager in container
  desc: Pokretanje package managera u kontejneru (kontejner se mijenja u radu)
  condition: spawned_process and container and proc.name in (pkg_mgmt_bins)
  output: "Package manager (cmd=%proc.cmdline container=%container.name pod=%k8s.pod.name)"
  priority: ERROR
  tags: [execution, immutability]

- rule: Outbound connection to unusual port
  desc: Kontejner otvara konekciju ka portu koji nije 80/443/53
  condition: >
    evt.type = connect and container
    and fd.typechar = 4 and not fd.sport in (80, 443, 53)
  output: "Outbound konekcija (conn=%fd.name cmd=%proc.cmdline pod=%k8s.pod.name)"
  priority: NOTICE
  tags: [command_and_control]
```

Testiranje pravila:

```bash
kubectl -n prod exec -it web-7d9c5-abcde -- sh -c 'cat /etc/shadow'
ssh node01 journalctl -u falco -n 5            # Pod je na node01, pa i alarm
```

| Šta napadač radi | Falco signal | Faza |
|---|---|---|
| `kubectl exec ... -- bash` | shell sa TTY u kontejneru | Execution |
| `cat /etc/shadow`, čitanje SA tokena | `open_read` osjetljivog fajla | Credential Access |
| `apt-get install nmap` | package manager | Execution / Discovery |
| Upis u `/etc/cron.d`, `/etc/passwd` | `open_write` ispod `/etc` | Persistence |
| `curl` ka nepoznatoj IP adresi | `connect` na neuobičajen port | Command and Control |
| `mount`, `nsenter` u privileged kontejneru | proces + syscall | Privilege Escalation |

## Istraga napada

### Faze: MITRE ATT&CK for Containers

**MITRE ATT&CK** matrica za kontejnere grupiše tehnike po taktikama (cilj napadača u toj fazi): **Initial Access** (ranjiva aplikacija, ukradeni kredencijali), **Execution** (`exec` u kontejner, novi Pod), **Persistence** (izmijenjena slika, CronJob), **Privilege Escalation** (privileged kontejner, hostPath, bijeg na čvor), **Defense Evasion** (brisanje logova, maskiranje imena procesa), **Credential Access** (ServiceAccount token, Secreti), **Discovery** (pretraga API-ja i mreže), **Lateral Movement**, **Impact** (kripto rudar, uništavanje podataka).

Falco `tags` u podrazumijevanim pravilima često nose MITRE oznake (npr. `mitre_execution`, `T1059`), pa iz alarma odmah vidiš o kojoj fazi se radi. Audit log (modul 11) dopunjava sliku sa strane API-ja.

### Od alarma do Poda

Alarm u journalu:

```text
09:41:03.512: Warning Shell u kontejneru (user=root container=web id=4f1a2b3c4d5e
image=docker.io/library/nginx ns=prod pod=web-7d9c5-abcde cmd=bash)
```

Ako `k8s.pod.name` nije u outputu, imaš bar `container.id`. Mapiranje na Pod radiš sa **crictl** na tom čvoru:

```bash
crictl ps --id 4f1a2b3c4d5e                     # kontejner, ime, POD ID
crictl inspect 4f1a2b3c4d5e | grep -E 'io.kubernetes.pod.(name|namespace)'
crictl inspect -o go-template --template '{{.info.pid}}' 4f1a2b3c4d5e   # PID na hostu
crictl pods --id <pod-id>                       # ime Poda i namespace
```

### Proces na čvoru

Procesi iz kontejnera su obični procesi na hostu, samo u drugim namespaceovima.

```bash
PID=$(crictl inspect -o go-template --template '{{.info.pid}}' 4f1a2b3c4d5e)
ls -l /proc/$PID/exe                # koji binarni fajl se izvršava
cat /proc/$PID/cmdline | tr '\0' ' '
ls -l /proc/$PID/fd                 # otvoreni fajlovi i socketi
cat /proc/$PID/environ | tr '\0' '\n'   # environment (tajne?)
ls /proc/$PID/root/tmp              # fajl sistem kontejnera viđen sa hosta

ps -ef --forest | grep -A3 $PID     # stablo procesa
ss -tnp | grep "pid=$PID"           # mrežne konekcije procesa
lsof -p $PID
strace -f -p $PID -e trace=network,file    # šta proces radi uživo (Ctrl+C za kraj)
```

Primjer zadatka: „Proces sluša na portu 6666. Pronađi Pod.“

```bash
ss -tlnp | grep 6666                # users:(("nc",pid=48213,fd=3))
cat /proc/48213/cgroup              # sadrži ID kontejnera
crictl ps | grep <prvih-12-znakova>
```

### Zadržavanje: izoluj, pa ukloni

| Korak | Komanda | Zašto |
|---|---|---|
| Izoluj mrežu | NetworkPolicy bez pravila za Pod sa oznakom `quarantine=true` | Prekida C2 i lateral movement, Pod ostaje za forenziku |
| Izvuci Pod iz Servicea i kontrolera | `kubectl label pod X app-` | Servis ga više ne bira, ReplicaSet pravi zamjenu |
| Sačuvaj dokaze | `kubectl logs`, `crictl inspect`, kopija iz `/proc/$PID/root` | Prije brisanja |
| Ukloni | `kubectl delete pod X` ili `kubectl scale deploy Y --replicas=0` | Zaustavi napad |
| Popravi uzrok | Slika, RBAC, securityContext | Inače se vraća |

```bash
kubectl -n prod label pod web-7d9c5-abcde quarantine=true
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quarantine
  namespace: prod
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes: [Ingress, Egress]     # bez ingress/egress pravila = deny all
```

> **Na ispitu:** zadatak često kaže „obriši Pod“ ili „skaliraj Deployment koji ga je napravio na 0“. Vlasnika nađeš sa `kubectl -n prod get pod X -o jsonpath='{.metadata.ownerReferences[0].name}'` (to je ReplicaSet; njegov vlasnik je Deployment). Ne briši druge resurse bez potrebe; ocjenjivač provjerava tačno traženo stanje.

## Nepromjenljivost kontejnera (immutability)

**Immutable** kontejner se ne mijenja u radu: nema instalacije paketa, nema izmjene binarnih fajlova i konfiguracije. Ako treba promjena, gradi se nova slika i radi novi deploy. Napadač koji uđe ne može lako da ostavi alat ili backdoor.

### readOnlyRootFilesystem + emptyDir

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: registry.internal:5000/nginx:1.27
        securityContext:
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          privileged: false
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache/nginx
        - name: run
          mountPath: /var/run
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
      - name: run
        emptyDir: {}
```

Provjera:

```bash
kubectl -n prod exec deploy/web -- touch /etc/test     # touch: /etc/test: Read-only file system
kubectl -n prod exec deploy/web -- touch /tmp/test     # radi
```

Ako Pod pada nakon uključivanja `readOnlyRootFilesystem`, pogledaj `kubectl logs`: aplikacija javlja koju putanju ne može da upiše (kod nginxa `/var/cache/nginx` i `/var/run`). Za svaku dodaj `emptyDir`.

> **Na ispitu:** `readOnlyRootFilesystem` je polje **kontejnera** (`spec.containers[].securityContext`), ne Poda. `kubectl explain pod.spec.containers.securityContext.readOnlyRootFilesystem` potvrđuje putanju. Ako ga staviš u `spec.securityContext`, `kubectl apply` javlja grešku (`unknown field`), a sa `--validate=false` polje bude tiho ignorisano.

### Šta još narušava nepromjenljivost

| Postavka | Zašto je problem |
|---|---|
| `privileged: true` | Pristup uređajima i kernelu hosta; kontejner može mijenjati host |
| `readOnlyRootFilesystem` nije `true` | Napadač upisuje alate i mijenja konfiguraciju |
| `hostPath` montiran za upis | Izmjene na čvoru preživljavaju Pod |
| `runAsUser: 0` uz upisiv FS | Root može mijenjati bilo šta u kontejneru |
| Shell i package manager u slici | Napadač ima alate odmah (`sh`, `apt`) |

Zadatak „pronađi Podove koji nisu immutable“:

```bash
kubectl -n prod get pods -o custom-columns='POD:.metadata.name,PRIV:.spec.containers[*].securityContext.privileged,RO:.spec.containers[*].securityContext.readOnlyRootFilesystem'
```

### Slike bez shella i package managera

**Distroless** slike (npr. `gcr.io/distroless/static`, `gcr.io/distroless/base`) sadrže samo aplikaciju i runtime zavisnosti, bez `sh`, `apt`, `curl`. `kubectl exec ... -- sh` tada ne radi, pa za debug koristiš **ephemeral container**: `kubectl debug -it pod/web --image=busybox:1.36 --target=web`.

Kada slika ima shell, a ne možeš promijeniti sliku, postoji trik sa **startupProbe**: probe pri startu obriše shell iz kontejnera.

```yaml
containers:
- name: app
  image: registry.internal:5000/app:1.0
  startupProbe:
    exec:
      command: ["rm", "-f", "/bin/sh", "/bin/bash"]
    initialDelaySeconds: 1
    periodSeconds: 5
```

Ovo radi samo dok root FS nije read-only i kontejner ima prava da briše te fajlove. To je zaobilazno rješenje; pravo je slika bez shella.

### Immutable ConfigMap i Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: prod
data:
  LOG_LEVEL: info
immutable: true
```

- Nakon `immutable: true` polja `data` i `binaryData` se ne mogu mijenjati, a ni `immutable` se ne može vratiti na `false`. Izmjena znači: obriši i napravi ponovo (i restartuj Podove).
- Kubelet ne mora da prati izmjene takvih objekata, što smanjuje opterećenje API servera.
- Napadač sa pravom `update` na ConfigMap ne može tiho promijeniti konfiguraciju koju aplikacija čita.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| Falco servis pada nakon izmjene pravila | `journalctl -u falco -n 50`: YAML greška, nepoznat macro ili polje, `append` na nepostojeće pravilo |
| Pravilo se ne okida | Je li Pod na čvoru čiji journal gledaš; `priority` ispod praga u `falco.yaml`; uslov preuzak (`proc.tty != 0` ne hvata `exec` bez `-t`) |
| Output nema ime Poda | Dodaj `%k8s.pod.name` i `%k8s.ns.name` u `output` |
| Nema alarma u fajlu | `file_output.enabled: true`, direktorij postoji, restart servisa |
| Pod pada sa `Read-only file system` | Dodaj `emptyDir` za putanju koju aplikacija piše |
| Ne nalaziš Pod za `container.id` | `crictl ps --id` na pravom čvoru; ID u alarmu je skraćen na 12 znakova |

## Rezime

- Falco hvata syscalle (driver `modern_ebpf` ili `kmod`), poredi ih sa pravilima i šalje alarme; detektuje, ne blokira.
- Pravilo ima `rule`, `desc`, `condition`, `output`, `priority` (+ `tags`); macroi i liste se ponovo koriste; polja `proc.*`, `user.name`, `container.*`, `k8s.*`, `fd.name`, `evt.type`.
- Lokalne izmjene idu u `/etc/falco/falco_rules.local.yaml`: `override` sa `append`/`replace` ili kopija pravila pod istim imenom; provjera sa `journalctl -u falco`.
- Izlaz: stdout (journald), `file_output`, `json_output: true`; alarm tražiš na čvoru gdje je Pod.
- Istraga: alarm → `container.id` → `crictl ps/inspect` → Pod i PID → `/proc/<pid>`, `ss`, `strace`; MITRE taktike opisuju fazu napada.
- Zadržavanje: karantin NetworkPolicy, uklanjanje oznake, dokazi, pa brisanje ili skaliranje na 0.
- Nepromjenljivost: `readOnlyRootFilesystem: true` + `emptyDir` za upisive putanje, bez `privileged`, distroless slike, immutable ConfigMap/Secret.
