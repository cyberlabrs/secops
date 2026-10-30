## Šta ovaj modul pokriva

Modul pokriva cilj **6.5** iz domena 6 (**Monitoring, Logging and Runtime Security**, 20% ispita): **Use Kubernetes audit logs to monitor access**.

Tipični zadaci na ispitu:

- „Uključi auditing na kube-apiserveru. Policy je u `/etc/kubernetes/audit/policy.yaml`, log ide u `/var/log/kubernetes/audit/audit.log`, čuvaj najviše 2 fajla po 10 MB, 7 dana.“
- „Dopuni audit Policy: Secrets loguj samo na nivou Metadata, izmjene Deploymenta u namespaceu `prod` na nivou RequestResponse, sve ostalo Metadata.“
- „Ne loguj `get`/`list`/`watch` zahtjeve nad `events`.“
- „U audit logu pronađi ko je obrisao Secret `db-pass` u namespaceu `prod` i upiši korisnika u `/opt/kurs/odgovor.txt`.“

Zadatak se gotovo uvijek sastoji od dva dijela: ispravan **Policy** fajl i ispravna izmjena static Pod manifesta **kube-apiservera**. Druga polovina je ona u kojoj se gubi vrijeme, jer API server ne starta.

## Šta je Kubernetes auditing

Svaki zahtjev prema API serveru (od `kubectl`, kubeleta, kontrolera, ServiceAccounta u Podu) može ostaviti zapis: ko je, kada, odakle, šta tražio i sa kojim rezultatom. To je **audit log**, osnovni izvor istine u istrazi „ko je čitao Secret“ ili „ko je napravio ovaj ClusterRoleBinding“.

Auditing radi **samo API server**. Kubelet, containerd i procesi u kontejnerima nemaju audit u ovom smislu (za to je Falco, modul 12). Zahtjev koji ne prođe kroz API server (npr. neko direktno čita etcd) se ovdje ne vidi.

Bez flaga `--audit-policy-file` ništa se ne loguje.

### Faze (stages)

Jedan zahtjev može proizvesti više događaja, po jedan u svakoj fazi:

| Stage | Kada nastaje |
|---|---|
| `RequestReceived` | Čim audit handler primi zahtjev, prije obrade |
| `ResponseStarted` | Poslata su zaglavlja odgovora, tijelo još ne; samo za dugotrajne zahtjeve (`watch`) |
| `ResponseComplete` | Odgovor je završen |
| `Panic` | Došlo je do panike u obradi |

U praksi se `RequestReceived` skoro uvijek izostavlja sa **`omitStages`**: taj događaj nema rezultat (`responseStatus`) i duplira zapis iz `ResponseComplete`.

### Nivoi (levels)

| Level | Šta se loguje | Tipična upotreba |
|---|---|---|
| `None` | Ništa | Bučni, nebitni zahtjevi (health, events, kube-proxy watch) |
| `Metadata` | Ko, kada, šta, rezultat; **bez tijela** zahtjeva i odgovora | Secrets, ConfigMaps, podrazumijevani nivo |
| `Request` | Metadata + tijelo **zahtjeva** | Izmjene gdje te zanima šta je poslato |
| `RequestResponse` | Metadata + tijelo zahtjeva **i odgovora** | Kritične izmjene (RBAC, Deploymenti u prod) |

`Request` i `RequestResponse` ne važe za non-resource zahtjeve (`/healthz`, `/version`): za njih se tijelo ne upisuje.

> **Na ispitu:** Secrets i druge osjetljive podatke loguj na `Metadata`. Na `Request` nivou `kubectl create secret` upisuje vrijednost Secreta u audit log, a na `RequestResponse` svaki `get secret` upisuje sadržaj u log. Audit log tada postaje novo mjesto curenja tajni.

## Policy fajl

**Policy** (`audit.k8s.io/v1`) je lista pravila. Svaki događaj se poredi sa pravilima **redom**, a **prvo pravilo koje se poklopi** određuje nivo. Ostala pravila se ne gledaju. Policy mora imati bar jedno pravilo.

```yaml
# /etc/kubernetes/audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages:
- RequestReceived                 # globalno, za sva pravila
rules:
# 1. bez šuma: čitanje eventsa
- level: None
  resources:
  - group: ""
    resources: ["events"]
  verbs: ["get", "list", "watch"]

# 2. Secrets: samo ko i šta, nikad sadržaj
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]

# 3. izmjene Deploymenta u prod: pun zapis
- level: RequestResponse
  namespaces: ["prod"]
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: "apps"
    resources: ["deployments"]

# 4. RBAC izmjene bilo gdje
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]

# 5. sve ostalo
- level: Metadata
```

### Polja pravila

| Polje | Značenje |
|---|---|
| `level` | Obavezno: `None`, `Metadata`, `Request`, `RequestResponse` |
| `users` | Korisnici (npr. `system:kube-proxy`); prazno = svi |
| `userGroups` | Grupe (npr. `system:nodes`, `system:serviceaccounts:prod`) |
| `verbs` | `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection` |
| `resources` | Lista `{group, resources, resourceNames}`; core grupa je `""` |
| `namespaces` | Namespaceovi; prazan string `""` znači cluster-scoped resurse |
| `nonResourceURLs` | Putanje kao `/healthz*`, `/version` |
| `omitStages` | Faze koje se izostavljaju za ovo pravilo (dodaju se na globalne) |

Unutar jednog pravila sva navedena polja moraju odgovarati (AND). Polje koje nije navedeno odgovara svemu.

### Redoslijed: najčešća zamka

```yaml
rules:
- level: Metadata             # poklapa SVE
- level: RequestResponse      # nikad se ne primijeni
  resources:
  - group: ""
    resources: ["pods"]
```

Prvo pravilo bez filtera „pojede“ sve događaje. Pravilo „catch-all“ uvijek ide **na kraj**. Isto važi za `None`: ako `None` za sve verbe nad `secrets` stoji prije pravila za `secrets/delete`, brisanja se neće logovati.

Primjer sa podresursima: `pods` ne obuhvata `pods/log` ni `pods/exec`. Za njih piši `resources: ["pods/exec"]` ili `["pods/*"]`. To je bitno za istragu, jer `kubectl exec` je zahtjev `create` nad `pods/exec`.

> **Na ispitu:** zadatak često daje polovično napisan Policy sa komentarima „dopuni“. Čitaj pravila odozgo nadolje i za svaki traženi slučaj se pitaj: koje pravilo se prvo poklapa? Primjer audit Policyja nađeš u dokumentaciji: „Auditing“ (kubernetes.io/docs/tasks/debug/debug-cluster/audit/).

## Uključivanje u kube-apiserver

Na kubeadm klasteru kube-apiserver je **static Pod** (`/etc/kubernetes/manifests/kube-apiserver.yaml`). Treba ti pet stvari:

| Flag | Značenje |
|---|---|
| `--audit-policy-file` | Putanja do Policy fajla (unutar kontejnera) |
| `--audit-log-path` | Putanja log fajla; `-` znači stdout; bez flaga nema log backenda |
| `--audit-log-maxage` | Najviše dana čuvanja starih (rotiranih) fajlova |
| `--audit-log-maxbackup` | Najviše rotiranih fajlova koji se čuvaju |
| `--audit-log-maxsize` | Veličina u **MB** nakon koje se fajl rotira |

```bash
# prije svake izmjene napravi kopiju VAN direktorija manifests
cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
mkdir -p /etc/kubernetes/audit /var/log/kubernetes/audit
vim /etc/kubernetes/manifests/kube-apiserver.yaml
```

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit/audit.log
    - --audit-log-maxage=7
    - --audit-log-maxbackup=2
    - --audit-log-maxsize=10
    # ... postojeći flagovi
    volumeMounts:
    # ... postojeći mountovi (k8s-certs, ca-certs, ...)
    - name: audit-policy
      mountPath: /etc/kubernetes/audit/policy.yaml
      readOnly: true
    - name: audit-log
      mountPath: /var/log/kubernetes/audit/
      readOnly: false
  volumes:
  # ... postojeći volumeni
  - name: audit-policy
    hostPath:
      path: /etc/kubernetes/audit/policy.yaml
      type: File
  - name: audit-log
    hostPath:
      path: /var/log/kubernetes/audit/
      type: DirectoryOrCreate
```

Kubelet primijeti izmjenu manifesta i ponovo kreira Pod. To traje 30 do 90 sekundi.

```bash
watch crictl ps                    # čekaj da se kube-apiserver pojavi kao Running
kubectl get nodes                  # API ponovo odgovara
tail -n 2 /var/log/kubernetes/audit/audit.log | jq .
```

> **Na ispitu:** Policy fajl montiraj kao `type: File` i `readOnly: true`, a log **direktorij** kao `DirectoryOrCreate` i upisiv. Ako montiraš samo log fajl kao `File`, a on ne postoji, Pod ne starta; ako je log mount `readOnly`, API server ne može da piše.

### Zašto API server ne starta: česte greške

| Greška | Simptom |
|---|---|
| Policy fajl nije montiran ili je putanja u flagu drugačija od `mountPath` | `crictl logs`: `no such file or directory` za policy |
| `type: File` za putanju koja ne postoji na hostu | Pod ne može da se kreira; kubelet javlja grešku montiranja |
| YAML greška u Policy fajlu ili pogrešan `apiVersion`/`kind` | API server izlazi sa greškom parsiranja policyja |
| Policy bez `rules` | Greška: policy mora imati bar jedno pravilo |
| Pogrešno uvlačenje u manifestu (volumen pod `containers`) | kubelet ne može da parsira manifest, Pod se ne pojavljuje |
| Duplikat imena volumena | Manifest neispravan, Pod se ne kreira |
| Kopija manifesta ostavljena u `/etc/kubernetes/manifests/` | Kubelet pokušava pokrenuti oba; konflikt |

Gdje gledati:

```bash
crictl ps -a | grep kube-apiserver               # postoji li kontejner, da li se ruši
crictl logs <container-id>                       # greška API servera
ls /var/log/pods/ | grep apiserver               # logovi i kad crictl ne vidi kontejner
tail /var/log/pods/kube-system_kube-apiserver-controlplane_*/kube-apiserver/*.log
journalctl -u kubelet --since "5 min ago" | grep -i apiserver   # greške montiranja i parsiranja manifesta
```

> **Na ispitu:** ako nakon nekoliko minuta ne možeš da nađeš grešku, vrati kopiju (`cp /root/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml`) i kreni ponovo, mijenjajući jednu stvar po jednu. Neispravan API server ruši i sve ostale zadatke na tom klasteru.

## Čitanje audit logova

Log backend piše **JSON Lines**: jedan JSON objekat (`kind: Event`) po liniji. Skraćen primjer:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "4f6c2b1e-...",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/prod/secrets/db-pass",
  "verb": "delete",
  "user": { "username": "jane", "groups": ["dev", "system:authenticated"] },
  "sourceIPs": ["192.168.10.25"],
  "userAgent": "kubectl/v1.35.0 (linux/amd64)",
  "objectRef": { "resource": "secrets", "namespace": "prod", "name": "db-pass", "apiVersion": "v1" },
  "responseStatus": { "code": 200 },
  "requestReceivedTimestamp": "2026-10-15T09:12:44.102311Z",
  "stageTimestamp": "2026-10-15T09:12:44.118902Z",
  "annotations": { "authorization.k8s.io/decision": "allow" }
}
```

| Polje | Šta ti govori |
|---|---|
| `user.username` | Ko: korisnik ili `system:serviceaccount:<ns>:<ime>` |
| `user.groups` | Grupe tog identiteta |
| `verb` | Šta: `get`, `list`, `create`, `delete` … |
| `objectRef.resource/namespace/name` | Nad čim |
| `objectRef.subresource` | Npr. `exec`, `log` kod `pods/exec` |
| `responseStatus.code` | Rezultat: 200/201 uspjeh, 403 zabranjeno, 404 ne postoji |
| `sourceIPs` | Odakle |
| `userAgent` | Kojim alatom |
| `annotations."authorization.k8s.io/decision"` | `allow` ili `forbid` |

### jq recepti

```bash
LOG=/var/log/kubernetes/audit/audit.log

# ko je obrisao Secret db-pass u prod
jq -c 'select(.verb=="delete" and .objectRef.resource=="secrets"
              and .objectRef.namespace=="prod" and .objectRef.name=="db-pass")
       | {user: .user.username, ip: .sourceIPs, code: .responseStatus.code, t: .stageTimestamp}' $LOG

# ko je čitao Secrete (get i list), sažeto po korisniku
jq -r 'select(.objectRef.resource=="secrets" and (.verb=="get" or .verb=="list"))
       | .user.username' $LOG | sort | uniq -c | sort -rn

# svi odbijeni zahtjevi (403): ko pokušava ono što ne smije
jq -c 'select(.responseStatus.code==403) | {u: .user.username, v: .verb, r: .objectRef.resource, ns: .objectRef.namespace}' $LOG

# kubectl exec u Podove
jq -c 'select(.objectRef.subresource=="exec") | {u: .user.username, pod: .objectRef.name, ns: .objectRef.namespace}' $LOG

# šta je radio određeni ServiceAccount
jq -c 'select(.user.username=="system:serviceaccount:prod:backup")
       | [.verb, .objectRef.resource, .objectRef.name, .responseStatus.code]' $LOG
```

Kada nemaš `jq`, `grep` je dovoljan za brzu potragu: `grep '"resource":"secrets"' $LOG | grep '"verb":"delete"'`. Pazi da u fajlu nema razmaka oko `:`.

> **Na ispitu:** prije pretrage provjeri da li uopšte tražiš na pravom mjestu. Ako Policy loguje Secrete na `None`, ili `delete` nije pokriven, u logu neće biti ništa. Takođe pogledaj i rotirane fajlove (`audit-2026-10-15T09-00-00.000.log`) pored `audit.log`.

## Istraga: ko je obrisao ili čitao Secret

Scenario: Secret `db-pass` u `prod` je nestao, a postoji sumnja da ga je neko prethodno pročitao.

1. Potvrdi da je auditing uključen i gdje je log: `grep audit /etc/kubernetes/manifests/kube-apiserver.yaml`.
2. Nađi brisanje (recept iznad). `responseStatus.code` 200 znači da je uspjelo.
3. Nađi čitanja istog Secreta prije brisanja: filter `verb=="get"` i `objectRef.name=="db-pass"`, pa poredi vremena.
4. Ako je `user.username` ServiceAccount, nađi koji Pod ga koristi: `kubectl -n prod get pods -o custom-columns=POD:.metadata.name,SA:.spec.serviceAccountName`.
5. Provjeri zašto je imao pravo: `kubectl auth can-i delete secrets -n prod --as=system:serviceaccount:prod:backup` i pronađi RoleBinding.
6. Ukloni višak prava (modul 03) i rotiraj kompromitovanu tajnu.

`list` nad Secretima vraća sve Secrete u namespaceu, a u audit događaju `objectRef.name` je prazan. Zato pri istrazi „ko je čitao Secret X“ uvijek uključi i `list` i `watch`.

## Webhook backend ukratko

Pored fajla, API server može slati događaje eksternom servisu (SIEM, Falco k8saudit plugin):

| Flag | Značenje |
|---|---|
| `--audit-webhook-config-file` | Kubeconfig sa adresom servisa i kredencijalima |
| `--audit-webhook-mode` | `batch` (podrazumijevano), `blocking`, `blocking-strict` |
| `--audit-webhook-initial-backoff` | Čekanje prije prvog ponovnog pokušaja |

Isti Policy važi za oba backenda. Na ispitu je fajl backend daleko češći.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| `kubectl` ne odgovara nakon izmjene | `crictl ps -a`, `crictl logs`, `/var/log/pods/kube-system_kube-apiserver-*`, `journalctl -u kubelet` |
| API server radi, log fajl ne nastaje | Postoji li `--audit-log-path`; je li direktorij montiran i upisiv; poklapa li se putanja sa `mountPath` |
| Log postoji, ali nema traženih događaja | Redoslijed pravila (raniji catch-all ili `None`); podresursi (`pods/exec`); grupa resursa (`apps` za deployments) |
| Log je ogroman | Nema `omitStages: [RequestReceived]`; nema `None` za events i health; previše `RequestResponse` |
| Vrijednosti Secreta u logu | Secrets su na `Request`/`RequestResponse`; spusti na `Metadata` i rotiraj tajne |
| Rotacija ne radi | `--audit-log-maxsize` je u MB, `maxage` u danima, `maxbackup` broj fajlova |

## Rezime

- Auditing radi API server: faze `RequestReceived`, `ResponseStarted`, `ResponseComplete`, `Panic`; nivoi `None`, `Metadata`, `Request`, `RequestResponse`.
- Policy (`audit.k8s.io/v1`) se čita odozgo: prvo pravilo koje se poklopi određuje nivo, pa catch-all ide na kraj.
- `omitStages: [RequestReceived]` smanjuje šum; events na `None`; Secrets uvijek na `Metadata`.
- Flagovi: `--audit-policy-file`, `--audit-log-path`, `--audit-log-maxage` (dani), `--audit-log-maxbackup` (broj), `--audit-log-maxsize` (MB).
- U static Pod manifestu: policy kao `File` i `readOnly`, log direktorij kao `DirectoryOrCreate` i upisiv; prije izmjene napravi kopiju van `manifests`.
- Kad API server ne starta: `crictl ps -a`, `crictl logs`, `/var/log/pods`, `journalctl -u kubelet`.
- Istraga sa `jq`: `user.username`, `verb`, `objectRef`, `responseStatus.code`, `sourceIPs`; za čitanje Secreta gledaj `get`, `list` i `watch`.
