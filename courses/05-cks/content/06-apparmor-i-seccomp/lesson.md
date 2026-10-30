## Šta ovaj modul pokriva

Modul pokriva cilj **3.4 Appropriately use kernel hardening tools such as AppArmor, seccomp** iz domena 3 (**System Hardening**, 10% ispita).

Tipični zadaci na ispitu:

- „Na `node01` se nalazi AppArmor profil `/etc/apparmor.d/k8s-deny-write`. Učitaj ga u enforce modu i primijeni ga na kontejner `writer` u Podu `secure`.“
- „Napravi Pod koji koristi seccomp profil `profiles/audit.json` sa čvora.“
- „Uključi `RuntimeDefault` seccomp za sve kontejnere Deploymenta `api`.“
- „Pod sa AppArmor profilom ne startuje. Popravi ga.“

Zadaci su kratki, ali traže precizno: tačno ime profila, tačna putanja, profil učitan na pravom čvoru i Pod na tom čvoru.

## Tri sloja zaštite kernela

Kontejner je običan Linux proces. Kad napadač preuzme proces, sve što proces smije da traži od kernela, smije i napadač. Tri mehanizma sužavaju to iz različitih uglova:

| Mehanizam | Šta ograničava | Primjer pravila | Gdje se podešava u Podu |
|---|---|---|---|
| **Linux capabilities** | Privilegije koje root inače ima (npr. `NET_ADMIN`, `SYS_ADMIN`) | `drop: [ALL]`, `add: [NET_BIND_SERVICE]` | `securityContext.capabilities` (samo kontejner) |
| **seccomp** | Koje **sistemske pozive** (syscall) proces smije pozvati | `mount`, `ptrace`, `unshare` → greška | `securityContext.seccompProfile` |
| **AppArmor** | Kojim **resursima** (fajlovi, mreža, capabilities) program smije pristupiti, po putanjama | `deny /etc/** w,` | `securityContext.appArmorProfile` |

Kako se dopunjuju: capabilities kažu „root u kontejneru ne smije mijenjati mrežu“, seccomp kaže „ovaj proces uopšte ne smije pozvati `mount`“, a AppArmor kaže „smije pisati samo u `/tmp`“. Za odbranu u dubinu koristiš sva tri.

Napomena: AppArmor radi na Debian/Ubuntu/SUSE sistemima; na RHEL porodici istu ulogu ima SELinux (`securityContext.seLinuxOptions`). Lab i ispit koriste AppArmor.

## AppArmor

### Profili i modovi

AppArmor **profil** je tekstualni fajl (obično u `/etc/apparmor.d/`) koji opisuje šta program smije. Profil se mora **učitati u kernel** da bi radio; sam fajl na disku ne radi ništa.

| Mod | Ponašanje |
|---|---|
| **enforce** | Zabranjene akcije se blokiraju i loguju |
| **complain** | Ništa se ne blokira, kršenja se samo loguju (za razvoj profila) |
| unconfined | Profil se ne primjenjuje |

Primjer profila koji zabranjuje svako pisanje u fajlove:

```text
#include <tunables/global>

profile k8s-deny-write flags=(attach_disconnected) {
  #include <abstractions/base>

  file,
  deny /** w,
}
```

Ime profila je ono poslije riječi `profile` (`k8s-deny-write`), **ne** ime fajla. Pod se poziva na ime profila.

### Učitavanje i provjera na čvoru

Profil se učitava na **čvoru na kome Pod radi**, ne na `controlplane` ako Pod ide na `node01`.

```bash
ssh node01
cat /sys/module/apparmor/parameters/enabled          # Y = AppArmor uključen u kernelu
apparmor_parser -q /etc/apparmor.d/k8s-deny-write    # učitaj profil (enforce)
apparmor_parser -r /etc/apparmor.d/k8s-deny-write    # ponovo učitaj poslije izmjene
apparmor_parser -C /etc/apparmor.d/k8s-deny-write    # učitaj u complain modu
aa-status | grep k8s-deny-write                      # da li je učitan i u kom modu
aa-status                                            # pregled: enforce/complain profili, procesi
```

| Komanda | Šta radi |
|---|---|
| `apparmor_parser -q <fajl>` | Učitava profil, bez suvišnog ispisa |
| `apparmor_parser -r <fajl>` | Zamjenjuje već učitan profil (poslije izmjene fajla) |
| `apparmor_parser -R <fajl>` | Uklanja profil iz kernela |
| `apparmor_parser -C <fajl>` | Učitava u complain modu |
| `aa-status` | Lista učitanih profila po modu i procesa pod profilima |
| `aa-enforce` / `aa-complain <fajl>` | Prebacuje mod (paket apparmor-utils) |

Učitan profil se gubi poslije reboota, osim ako je fajl u `/etc/apparmor.d/` (servis `apparmor` ga učita pri bootu).

> **Na ispitu:** ime profila provjeri u samom fajlu: `grep -E '^\s*profile' /etc/apparmor.d/<fajl>`. Ako fajl nema riječ `profile`, ime je putanja napisana u zaglavlju (npr. `/usr/bin/foo`). U Pod upisuješ tačno to ime.

### Primjena u Podu

Od verzije 1.30 AppArmor se podešava poljem **`securityContext.appArmorProfile`**. Stare anotacije `container.apparmor.security.beta.kubernetes.io/<kontejner>` su zastarjele; na ispitu (v1.35) koristi polje.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure
spec:
  nodeName: node01                  # profil je učitan samo na node01
  containers:
  - name: writer
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
    securityContext:
      appArmorProfile:
        type: Localhost
        localhostProfile: k8s-deny-write
```

| `type` | Značenje |
|---|---|
| `RuntimeDefault` | Podrazumijevani profil container runtimea (containerd ga učitava sam) |
| `Localhost` | Profil učitan na čvoru; obavezno polje `localhostProfile` sa imenom profila |
| `Unconfined` | Bez AppArmora |

`appArmorProfile` može ići na nivo Poda (`spec.securityContext`) i važi za sve kontejnere, ili na nivo kontejnera. Ako postoje oba, pobjeđuje kontejner.

Brzo pravljenje Poda:

```bash
kubectl run secure --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > secure.yaml
# dodaj nodeName/nodeSelector i securityContext.appArmorProfile
kubectl explain pod.spec.containers.securityContext.appArmorProfile
kubectl apply -f secure.yaml
```

Provjera da profil radi:

```bash
kubectl exec secure -- cat /proc/1/attr/current     # k8s-deny-write (enforce)
kubectl exec secure -- touch /tmp/test              # touch: /tmp/test: Permission denied
```

### Gdje Pod smije da radi

Scheduler ne zna koji profili su učitani na kom čvoru. Imaš dvije opcije:

1. Učitaj profil na **sve** čvorove na koje Pod može doći.
2. Označi čvorove koji imaju profil i veži Pod za njih:

```bash
kubectl label node node01 apparmor/deny-write=loaded
```

```yaml
spec:
  nodeSelector:
    apparmor/deny-write: loaded
```

`nodeName` je najbrži način na ispitu kad zadatak kaže na kom čvoru je profil, ali zaobilazi scheduler. Za Deployment koristi `nodeSelector`.

> **Na ispitu:** ako Deployment mijenjaš da koristi AppArmor, polje ide u `spec.template.spec.containers[].securityContext`, ne u `spec` Deploymenta. `kubectl explain deployment.spec.template.spec.securityContext` ti potvrđuje putanju.

Ako profil nije učitan na čvoru, kontejner se ne kreira. Pod ostaje u fazi Pending, a `kubectl describe pod` pokazuje event `Failed` sa porukom poput `apparmor profile not found` (tačan tekst zavisi od runtimea).

## seccomp

### Tipovi profila

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault        # ili Localhost / Unconfined
```

| `type` | Značenje |
|---|---|
| `RuntimeDefault` | Profil container runtimea: blokira opasne syscall-ove (npr. `mount`, `kexec_load`, `reboot`), dozvoljava uobičajene |
| `Localhost` | Sopstveni JSON profil sa čvora; `localhostProfile` je putanja **relativna** u odnosu na `/var/lib/kubelet/seccomp/` |
| `Unconfined` | Bez seccompa |

Bez podešavanja (i bez `seccompDefault` u kubeletu) kontejner radi kao **Unconfined**. Kontejner sa `privileged: true` uvijek radi bez seccompa, bez obzira na profil.

Pod Security Admission (modul 7): nivo **baseline** zabranjuje eksplicitni `Unconfined`, a **restricted** zahtijeva `RuntimeDefault` ili `Localhost`.

### Localhost profil

Fajl `/var/lib/kubelet/seccomp/profiles/audit.json` na `node01` referencira se ovako:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: audit-pod
spec:
  nodeName: node01
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/audit.json    # NE apsolutna putanja
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
```

Kao i kod AppArmora, profil mora postojati na čvoru na kome Pod radi. Ako fajl ne postoji, kontejner se ne kreira (npr. status `CreateContainerError`, a u eventu greška o seccomp profilu).

### Struktura JSON profila

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": ["read", "write", "openat", "close", "execve", "exit_group", "nanosleep", "futex"],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

- `defaultAction`: šta se dešava sa syscall-om koji nije naveden u `syscalls`.
- `syscalls`: lista grupa sa `names` i `action`; pravilo za konkretan syscall pobjeđuje `defaultAction`.

| Akcija | Efekat |
|---|---|
| `SCMP_ACT_ALLOW` | Dozvoli syscall |
| `SCMP_ACT_ERRNO` | Odbij; proces dobija grešku (npr. `Operation not permitted`) |
| `SCMP_ACT_LOG` | Dozvoli, ali zapiši u kernel/audit log |
| `SCMP_ACT_KILL_PROCESS` | Ubij proces |
| `SCMP_ACT_KILL` / `SCMP_ACT_KILL_THREAD` | Ubij nit koja je pozvala syscall |
| `SCMP_ACT_TRAP` | Pošalji signal SIGSYS |

Dva obrasca:

- **allowlist**: `defaultAction: SCMP_ACT_ERRNO` + lista dozvoljenih. Najsigurnije, ali lista mora biti potpuna ili aplikacija puca.
- **denylist**: `defaultAction: SCMP_ACT_ALLOW` + lista zabranjenih (npr. `mount`, `ptrace`, `unshare` sa `SCMP_ACT_ERRNO`). Lakše, ali slabije.

Profil `{"defaultAction": "SCMP_ACT_ERRNO"}` bez liste blokira sve, pa kontejner ne može ni da se pokrene (`CrashLoopBackOff` ili greška pri startu). Profil `{"defaultAction": "SCMP_ACT_LOG"}` ništa ne blokira, samo bilježi; koristi se za učenje šta aplikacija poziva.

> **Na ispitu:** prije nego što primijeniš tuđi profil, pročitaj ga: `cat /var/lib/kubelet/seccomp/profiles/x.json | jq .defaultAction`. Ako zadatak kaže „profil koji blokira X“, provjeri da je X stvarno pod `SCMP_ACT_ERRNO`, a ne `SCMP_ACT_LOG`.

### seccompDefault u kubeletu

Umjesto da svaki Pod navodi `RuntimeDefault`, kubelet može to raditi sam (stable od 1.27). U `/var/lib/kubelet/config.yaml` na svakom čvoru:

```yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
seccompDefault: true
```

```bash
systemctl restart kubelet
journalctl -u kubelet --since "2 min ago" | tail     # provjera da kubelet nije pao
```

Isto radi flag `--seccomp-default`. Važi samo za Podove kreirane poslije promjene i samo za kontejnere koji nemaju sopstveni `seccompProfile`. Ako neka aplikacija pukne pod `RuntimeDefault`, za nju eksplicitno postavi `Localhost` profil (ili, kao izuzetak, `Unconfined`).

### Testiranje seccompa

```bash
kubectl exec audit-pod -- grep Seccomp /proc/1/status
# Seccomp:        2        (0 = isključen, 2 = filter aktivan)
```

Za `RuntimeDefault` dobar test je syscall koji je blokiran, npr. `unshare`:

```bash
kubectl run sc-test --image=busybox:1.36 --overrides='{"spec":{"securityContext":{"seccompProfile":{"type":"RuntimeDefault"}}}}' -- sleep 3600
kubectl exec sc-test -- unshare -r true      # Operation not permitted
```

Na čvoru provjeri šta runtime stvarno primjenjuje:

```bash
crictl ps --name app
crictl inspect <container-id> | grep -i -A3 seccomp
```

## Otkrivanje potrebnih syscall-ova

Da bi napisao allowlist profil, moraš znati šta aplikacija poziva. Tri pristupa:

**1. strace na čvoru** nad procesom kontejnera:

```bash
ssh node01
crictl ps --name app                                   # ID kontejnera
crictl inspect <id> | grep -m1 '"pid"'                 # PID procesa na hostu
strace -f -c -p <pid>                                  # Ctrl+C: tabela syscall-ova i broj poziva
```

Ili pokreni sam program pod strace-om: `strace -f -c ls /` daje tabelu syscall-ova koje `ls` koristi.

**2. `kubectl debug`** kad nemaš SSH ili hoćeš alat pored kontejnera:

```bash
kubectl debug node/node01 -it --image=busybox:1.36          # Pod na čvoru, host fajl sistem u /host
kubectl debug -it app-pod --image=busybox:1.36 --target=app --profile=sysadmin   # ephemeral kontejner u PID namespaceu kontejnera app
```

**3. SCMP_ACT_LOG profil**: pokreni aplikaciju sa `{"defaultAction": "SCMP_ACT_LOG"}`, odradi tipične akcije i pročitaj log na čvoru (`journalctl -k`, `/var/log/syslog` ili `/var/log/audit/audit.log`, zavisno od sistema). Zapisi imaju `type=1326` i `syscall=<broj>`.

Za AppArmor isti posao rade `aa-genprof` i `aa-logprof` (prate aplikaciju u complain modu i predlažu pravila), a odbijene akcije vidiš u `dmesg` ili `journalctl -k | grep apparmor` (`apparmor="DENIED"`).

> **Na ispitu:** na ispitu skoro nikad ne pišeš profil od nule. Profil je dat; tvoj posao je da ga učitaš (AppArmor) ili postaviš u pravi folder (seccomp), primijeniš na pravi kontejner i dokažeš da radi. Zato vježbaj putanje i polja, ne sintaksu profila.

## Troubleshooting

| Simptom | Uzrok i provjera |
|---|---|
| Pod Pending, event `apparmor profile not found` | Profil nije učitan na tom čvoru (`aa-status` na čvoru), ili je u Podu ime fajla umjesto imena profila |
| Profil je učitan, a Pod i dalje ne startuje | Pod je zakazan na drugi čvor; dodaj `nodeSelector`/`nodeName` ili učitaj profil svuda |
| `localhostProfile` odbijen ili profil nije nađen | Apsolutna putanja umjesto relativne u odnosu na `/var/lib/kubelet/seccomp/`; fajl nije na čvoru Poda |
| Kontejner odmah pada (`CrashLoopBackOff`) poslije seccompa | Allowlist ne sadrži syscall koji aplikacija treba; probaj sa `SCMP_ACT_LOG` i dopuni listu |
| `/proc/1/attr/current` kaže `unconfined` | Polje je na pogrešnom mjestu (npr. u `metadata`), ili je kontejner `privileged` |
| `Seccomp: 0` u kontejneru | Nema profila: nije postavljen ni `seccompProfile` ni `seccompDefault`; ili je kontejner `privileged` |
| Izmjena profila ne djeluje | AppArmor: zaboravljen `apparmor_parser -r`; seccomp: profil se čita pri kreiranju kontejnera, pa Pod treba ponovo kreirati |

## Rezime

- Capabilities ograničavaju root privilegije, seccomp ograničava syscall-ove, AppArmor ograničava pristup resursima po putanjama; koristi ih zajedno.
- AppArmor profil se učitava na čvoru sa `apparmor_parser -q` (izmjena: `-r`), provjerava sa `aa-status`; enforce blokira, complain samo loguje.
- U Podu: `securityContext.appArmorProfile` sa `type: Localhost` i `localhostProfile: <ime profila>` (ili `RuntimeDefault`/`Unconfined`); anotacije su zastarjele.
- Profil mora biti učitan na čvoru gdje Pod radi; koristi `nodeSelector`/`nodeName` ili učitaj profil na sve čvorove.
- seccomp: `securityContext.seccompProfile` sa `RuntimeDefault` ili `Localhost` i putanjom relativnom u odnosu na `/var/lib/kubelet/seccomp/`.
- JSON profil: `defaultAction` + `syscalls[].names/action` (`SCMP_ACT_ALLOW`, `SCMP_ACT_ERRNO`, `SCMP_ACT_LOG`…); `seccompDefault: true` u kubeletu daje `RuntimeDefault` svima bez profila.
- Provjera: `/proc/1/attr/current` (AppArmor), `grep Seccomp /proc/1/status` (seccomp); syscall-ove otkrivaš sa `strace -c`, `kubectl debug` ili `SCMP_ACT_LOG`.
