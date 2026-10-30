## Šta ovaj modul pokriva

Drugi dio domena **Troubleshooting** (30% ispita). Ciljevi:

- **5.3** praćenje potrošnje resursa klastera i aplikacija (**Monitor cluster and application resource usage**),
- **5.4** rad sa izlazom kontejnera (**Manage and evaluate container output streams**), tj. logovima,
- **5.5** troubleshooting servisa i mreže (**Troubleshoot services and networking**).

Tipični zadaci:

- „Pronađi Pod sa labelom `app=api` koji troši najviše CPU-a i upiši njegovo ime u `/opt/answer.txt`.“
- „Sačuvaj logove kontejnera `sidecar` iz Poda `web` u fajl“ ili „izdvoji linije sa `ERROR`“.
- „Pod je u stanju CrashLoopBackOff. Popravi ga.“
- „Servis `web` ne odgovara. Popravi ga bez mijenjanja Deployment-a.“

Ovdje se bodovi gube na nepažnji: pogrešan namespace, logovi trenutnog umjesto prethodnog kontejnera, fajl sa odgovorom na pogrešnom čvoru. Odgovore upisuj na mašini sa koje radiš zadatak (obično terminal ispita, ne `node01`), osim ako zadatak kaže drugačije.

## Potrošnja resursa: metrics-server i kubectl top

`kubectl top` čita **Metrics API** (`metrics.k8s.io`), koji obezbjeđuje **metrics-server**. On od kubeleta svakih ~15 s skuplja trenutni CPU i memoriju. Nema istorije: za to služi Prometheus.

Bez metrics-servera:

```bash
k top node
# error: Metrics API not available
```

U labu je manifest već preuzet:

```bash
k apply -f /opt/kurs/manifests/metrics-server.yaml
k -n kube-system get deploy metrics-server
k -n kube-system logs deploy/metrics-server | tail
```

U klasterima kao što je lab (kubelet ima self-signed serving certifikat), metrics-server ne može provjeriti TLS kubeleta i u logu piše `x509: cannot validate certificate ... doesn't contain any IP SANs`. Za lab je dovoljno dodati argument `--kubelet-insecure-tls`:

```bash
k -n kube-system patch deploy metrics-server --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
k get apiservice v1beta1.metrics.k8s.io     # AVAILABLE treba biti True
```

U produkciji je ispravno rješenje da kubelet ima potpisan serving certifikat (`serverTLSBootstrap`), a ne isključena provjera.

### kubectl top

```bash
k top node
k top node --sort-by=cpu
k top pod -n prod --sort-by=memory
k top pod -A --sort-by=cpu | head -5
k top pod -l app=api --sort-by=cpu --no-headers | head -1
k top pod web --containers            # potrošnja po kontejneru u Podu
```

Jedinice: CPU u milicore-ima (`250m` = četvrtina jezgra), memorija u `Mi`. `k top node` pokazuje i procenat u odnosu na **allocatable** kapacitet čvora.

Ono što `top` pokazuje je **stvarna potrošnja**. `requests` i `limits` (rezervisano) vidiš drugdje:

```bash
k describe node node01 | sed -n '/Allocated resources/,/Events/p'
k get pod web -o jsonpath='{.spec.containers[*].resources}'
```

Upis odgovora u fajl:

```bash
k top pod -n prod -l app=api --sort-by=cpu --no-headers | head -1 | awk '{print $1}' > /opt/answer.txt
cat /opt/answer.txt
```

> **Na ispitu:** `--sort-by` za `top` prima samo `cpu` ili `memory`. Ako metrics-server tek instaliraš, sačekaj minut da skupi prve podatke; `error: metrics not available yet` nije greška u instalaciji.

## Logovi kontejnera

Kontejner piše na **stdout** i **stderr**; containerd to upisuje u fajlove na čvoru (`/var/log/pods/...`), a `kubectl logs` ih čita preko kubeleta. Ako aplikacija piše samo u fajl unutar kontejnera, `kubectl logs` je prazan. Tada se koristi **sidecar** koji radi `tail -f` tog fajla na svoj stdout.

| Komanda | Šta radi |
|---|---|
| `k logs web` | Logovi Poda sa jednim kontejnerom |
| `k logs web -c sidecar` | Određeni kontejner (obavezno ako ih ima više) |
| `k logs web --all-containers` | Svi kontejneri Poda |
| `k logs web --previous` (`-p`) | Prethodni (srušeni) kontejner, ključno za CrashLoopBackOff |
| `k logs -f web` | Prati uživo |
| `k logs web --tail=50` | Posljednjih 50 linija |
| `k logs web --since=1h` / `--since-time=2026-10-15T10:00:00Z` | Vremenski filter |
| `k logs web --timestamps` | Dodaje vrijeme ispred svake linije |
| `k logs -l app=web --prefix` | Svi Podovi sa labelom, sa imenom Poda ispred linije |
| `k logs deploy/web` | Jedan Pod Deployment-a (izabere ga kubectl) |
| `k logs job/backup` | Logovi Poda Job-a |

Dva detalja:

- Sa `-l` selektorom `kubectl logs` podrazumijevano prikazuje samo **posljednjih 10 linija** po Podu i najviše 5 paralelnih tokova (`--max-log-requests`). Za sve linije dodaj `--tail=-1`.
- Ako Pod ima više kontejnera, a ne navedeš `-c`, kubectl uzme podrazumijevani kontejner (anotacija `kubectl.kubernetes.io/default-container` ili prvi) i ispiše napomenu.

```bash
k logs web -c app --since=30m | grep -i error > /opt/web-errors.log
k logs web -c app --previous --tail=20
k get pod web -o jsonpath='{.spec.containers[*].name}'     # imena kontejnera
```

Sidecar koji izvozi log fajl:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: legacy
spec:
  containers:
  - name: app
    image: busybox:1.37
    command: ["sh", "-c", "while true; do echo \"$(date) obrada\" >> /var/log/app.log; sleep 5; done"]
    volumeMounts:
    - name: logs
      mountPath: /var/log
  - name: log-shipper
    image: busybox:1.37
    command: ["sh", "-c", "tail -n+1 -F /var/log/app.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log
  volumes:
  - name: logs
    emptyDir: {}
```

```bash
k logs legacy -c log-shipper
```

Kad API server ili kubelet ne rade, logove čitaš direktno na čvoru: `crictl logs <id>` ili `/var/log/pods/<ns>_<pod>_<uid>/<kontejner>/0.log`.

> **Na ispitu:** Kad zadatak kaže „sačuvaj logove u fajl“, preusmjeri tačno ono što je traženo (kontejner, broj linija, filter) i otvori fajl da provjeriš da nije prazan. Prazan fajl često znači pogrešan kontejner ili da je trebao `--previous`.

## Stanja Podova i kako ih dijagnostikovati

Tri komande rješavaju većinu slučajeva:

```bash
k describe pod web                         # Events na dnu, State/Last State kontejnera
k events --for pod/web                     # samo eventi tog Poda
k get events -n prod --sort-by=.lastTimestamp
k get pod web -o yaml | sed -n '/status:/,$p'   # containerStatuses, reason, exitCode
```

| Stanje (STATUS) | Šta znači | Gdje gledati / tipičan uzrok |
|---|---|---|
| **Pending** | Pod nije raspoređen ili čeka | `describe`: `FailedScheduling` (nedovoljno CPU/memorije u `requests`, taint bez tolerancije, nodeSelector/affinity, PVC nije vezan). Bez eventa: scheduler |
| **ContainerCreating** | Raspoređen, kontejner se još pravi | `FailedMount` (nepostojeći ConfigMap/Secret/PVC kao volumen), CNI greška, sporo povlačenje slike |
| **ErrImagePull** / **ImagePullBackOff** | Slika se ne može povući | Pogrešno ime ili tag, privatni registry bez `imagePullSecrets`. Poruka u `describe` |
| **CreateContainerConfigError** | Konfiguracija kontejnera ne može se sastaviti | `env`/`envFrom` referencira nepostojeći ConfigMap/Secret ili ključ; `runAsNonRoot` sa slikom koja radi kao root |
| **RunContainerError** / **StartError** | Runtime nije mogao pokrenuti proces | Komanda ne postoji u slici (`executable file not found in $PATH`), pogrešan mount |
| **CrashLoopBackOff** | Kontejner se pokreće i izlazi, kubelet čeka sve duže prije restarta | `k logs --previous`, `Last State: Terminated`, `Exit Code`; liveness probe koja pada |
| **OOMKilled** (reason) | Kontejner prešao memory `limit` | `Last State: Terminated, Reason: OOMKilled, Exit Code: 137` → povećaj limit ili popravi aplikaciju |
| **Completed** | Proces završio sa kodom 0 | Normalno za Job. U Deployment-u znači da komanda nije dugotrajna (kubelet ga restartuje → CrashLoopBackOff) |
| **Error** | Proces završio sa kodom ≠ 0 | Logovi |
| **Terminating** | Brisanje u toku | Dugo traje: čvor nedostupan, finalizeri, `terminationGracePeriodSeconds`. Krajnja mjera: `k delete pod web --grace-period=0 --force` |
| **Running**, ali `READY 0/1` | Readiness probe pada | `describe`: `Readiness probe failed`; Pod nije u endpointima servisa |

### Exit kodovi

| Kod | Značenje |
|---|---|
| `0` | Uspješan završetak |
| `1` | Opšta greška aplikacije (vidi logove) |
| `126` | Komanda postoji, ali nije izvršna |
| `127` | Komanda nije nađena (shell, npr. `sh -c "ngnix"`) |
| `137` | 128 + 9 = **SIGKILL**: OOMKilled ili ubijen nakon isteka grace perioda (npr. liveness probe) |
| `143` | 128 + 15 = **SIGTERM**: uredno zaustavljen |

Kod `137` razliku daje polje `reason`: `OOMKilled` znači memorijski limit, `Error` uz liveness probe znači da ga je kubelet ubio.

```bash
k get pod web -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
# {"exitCode":137,"reason":"OOMKilled",...}
```

### Popravka

Većina polja Poda je nepromjenljiva. Za Pod koji nije u kontroleru:

```bash
k get pod web -o yaml > web.yaml
vim web.yaml                   # ispravi image, command, resources...
k replace --force -f web.yaml  # obriše i napravi ponovo
```

Za Deployment mijenjaj Deployment (`k edit deploy`, `k set image deploy/web app=nginx:1.27`, `k set resources deploy/web -c app --limits=memory=256Mi`). Promjene na Podu bi kontroler ionako pregazio.

> **Na ispitu:** Kod CrashLoopBackOff trenutni kontejner obično nema korisne logove. Prvo `k logs <pod> --previous`, pa `k describe pod` (`Last State`, `Exit Code`, `Reason`). Tek onda mijenjaj manifest.

## kubectl exec, debug i port-forward

```bash
k exec -it web -- sh                     # shell u kontejneru (ako slika ima shell)
k exec web -c app -- cat /etc/nginx/conf.d/default.conf
k exec web -- env
```

Mnoge slike (distroless) nemaju shell ni alate. Tada pomaže **ephemeral container**: privremeni kontejner koji se dodaje u postojeći Pod bez restarta.

```bash
k debug -it web --image=busybox:1.37 --target=app     # dijeli procesni namespace sa kontejnerom app
# u debug kontejneru: ps, wget, nslookup, ls /proc/1/root/...
```

Kopija Poda za eksperimente (original ostaje netaknut):

```bash
k debug web -it --copy-to=web-debug --container=app -- sh            # promijeni komandu u kopiji
k debug web --copy-to=web-debug --set-image=app=nginx:1.27           # druga slika u kopiji
```

Debug čvora bez SSH-a: Pod u host namespace-ovima, a fajl sistem čvora je montiran na `/host`.

```bash
k debug node/node01 -it --image=busybox:1.37
# chroot /host     pa npr. cat /var/lib/kubelet/config.yaml
k get pods | grep node-debugger       # obriši Pod kad završiš
```

Ephemeral kontejner se ne može ukloniti iz Poda; nestaje kad se Pod obriše.

**port-forward** tuneluje lokalni port do Poda preko API servera i kubeleta. Saobraćaj ulazi direktno u Pod, mimo kube-proxy-ja, pa je to brz način da provjeriš da li sama aplikacija odgovara. Ni `svc/web` ne ide kroz ClusterIP: kubectl samo izabere jedan Pod iza servisa.

```bash
k port-forward pod/web 8080:80 &
curl -s localhost:8080
k port-forward svc/web 8080:80        # tunel do jednog Poda iza servisa
```

## Troubleshooting servisa i mreže

Servis prosljeđuje saobraćaj Podovima čije labele odgovaraju `spec.selector`, na `targetPort`, i samo onima koji su **Ready**. Lanac koji provjeravaš, redom:

1. Podovi rade i Ready su?
2. Selector servisa odgovara labelama Podova → postoje endpointi?
3. `targetPort` odgovara portu na kojem aplikacija stvarno sluša?
4. DNS ime servisa se razrješava?
5. NetworkPolicy ne blokira?
6. kube-proxy radi na čvoru?

```bash
k get svc web -o wide                       # SELECTOR, PORT(S)
k get pods -l app=web --show-labels -o wide
k get endpointslices -l kubernetes.io/service-name=web
k describe svc web                          # Endpoints: <none> je glavni trag
```

**EndpointSlice** (`discovery.k8s.io/v1`) je zamjena za stari objekat Endpoints. Endpoints API je **deprecated od v1.33**: `k get endpoints` i dalje radi, ali ispisuje upozorenje. `k describe svc` i dalje pokazuje adrese u liniji `Endpoints:`.

### Najčešći uzroci

| Simptom | Uzrok | Popravka |
|---|---|---|
| `Endpoints: <none>`, Podovi rade | `selector` ne odgovara labelama (`app: web` vs `app: web-app`) | `k edit svc web` i ispravi selector (ili labelu Poda, ako zadatak tako traži) |
| Endpointi postoje, `connection refused` | `targetPort` pogrešan (npr. 8080 umjesto 80) | Ispravi `targetPort` ili koristi imenovani port (`targetPort: http`) |
| Endpointi prazni, Podovi `0/1 READY` | Readiness probe pada | `k describe pod`; popravi probu (port, putanja) ili aplikaciju |
| IP servisa radi, ime ne (`bad address`) | CoreDNS ne radi ili pogrešno ime/namespace | `k -n kube-system get pods -l k8s-app=kube-dns`, logovi CoreDNS-a, puno ime `web.prod.svc.cluster.local` |
| Timeout iz jednog namespace-a, iz drugog radi | NetworkPolicy | `k get netpol -A`, provjeri `podSelector` i `ingress.from` |
| Ništa ne radi ni preko ClusterIP-a, iako Pod IP radi | kube-proxy | `k -n kube-system get ds kube-proxy`, logovi |
| NodePort ne odgovara spolja | Pogrešan port (30000–32767), firewall, `externalTrafficPolicy: Local` bez Poda na tom čvoru | `k get svc`, curl na `<nodeIP>:<nodePort>` sa čvora |

Brzo poređenje selectora i labela:

```bash
k get svc web -o jsonpath='{.spec.selector}'; echo
k get pods --show-labels | grep web
k get pods -l "$(k get svc web -o jsonpath='{.spec.selector}' | tr -d '{}"' | tr ':' '=')"
```

### Provjera iz privremenog Poda

Najpouzdaniji test je iz klastera, iz Poda koji se sam obriše:

```bash
k run tmp --rm -it --restart=Never --image=busybox:1.37 -- sh
# u Podu:
nslookup web
nslookup web.prod.svc.cluster.local
wget -qO- -T 2 http://web:80
wget -qO- -T 2 http://10.244.1.5:80        # direktno na IP Poda, zaobilazi Service
cat /etc/resolv.conf
```

Ili kao jedna komanda, korisno za upis rezultata:

```bash
k run tmp --rm -i --restart=Never --image=busybox:1.37 -- wget -qO- -T 2 http://web.prod
k run tmp -n prod --rm -it --restart=Never --image=busybox:1.37 -- nslookup web
```

Tumačenje:

- Pod IP radi, ClusterIP ne → servis (selector, targetPort) ili kube-proxy.
- ClusterIP radi, ime ne → DNS.
- Ništa ne radi samo iz određenog namespace-a ili Poda sa određenom labelom → NetworkPolicy (testiraj iz Poda sa istim labelama i namespace-om kao pravi klijent: `k run tmp -n frontend --labels=app=frontend ...`).

> **Na ispitu:** Zadaci tipa „servis ne radi“ obično imaju jednu namjerno ubačenu grešku. `k describe svc` + `k get pods --show-labels` u 90% slučajeva otkriju je za 20 sekundi: prazni endpointi, pogrešan targetPort ili Podovi koji nisu Ready.

### Primjer: kompletna dijagnoza

```bash
k -n shop get svc api
# api   ClusterIP   10.96.40.12   <none>   80/TCP
k -n shop describe svc api | grep -E 'Selector|TargetPort|Endpoints'
# Selector:   app=api-server
# TargetPort: 8080/TCP
# Endpoints:  <none>
k -n shop get pods --show-labels
# api-7d9c...   1/1   Running   app=api,pod-template-hash=7d9c...
k -n shop patch svc api -p '{"spec":{"selector":{"app":"api"}}}'
k -n shop get endpointslices -l kubernetes.io/service-name=api
k -n shop run tmp --rm -it --restart=Never --image=busybox:1.37 -- wget -qO- -T 2 http://api
```

Ako i nakon toga `wget` vraća `connection refused`, provjeri port na kojem kontejner sluša (`k get pod ... -o jsonpath='{.spec.containers[0].ports}'`, ili `k exec ... -- netstat -tln` ako postoji) i uskladi `targetPort`.

## Rezime

- `kubectl top node|pod` traži metrics-server; `--sort-by=cpu|memory`, `--containers`, `-l`, `-A`. Top pokazuje potrošnju, a `requests`/`limits` vidiš u `describe node` i specifikaciji Poda.
- `kubectl logs`: `-c` za kontejner, `--previous` za srušeni kontejner, `-f`, `--tail`, `--since`, `-l` (samo 10 linija po Podu bez `--tail=-1`), `--all-containers`.
- Stanje Poda čitaš iz `describe` (Events, Last State, Exit Code, Reason), `k events --for` i `-o yaml` statusa.
- Exit 137 = SIGKILL (OOMKilled ili liveness), 1 = greška aplikacije, 127 = komanda ne postoji, 143 = SIGTERM.
- `kubectl debug` dodaje ephemeral container (`--target`), pravi kopiju Poda (`--copy-to`) ili Pod na čvoru (`node/<ime>`, fajl sistem na `/host`).
- Servis bez endpointa = selector ili readiness; endpointi postoje a veza odbijena = targetPort; ime ne radi = DNS; radi samo odnekud = NetworkPolicy.
- Testiraj iz privremenog Poda: `k run tmp --rm -it --restart=Never --image=busybox:1.37 -- sh`, pa `nslookup` i `wget`.
