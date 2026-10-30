## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 5 (**Supply Chain Security**, 20% ispita):

- **5.1 Minimize base image footprint**: izbor bazne slike, multi-stage build, non-root korisnik, pinovanje verzija i uklanjanje svega što napadaču koristi.
- **5.4 Perform static analysis of user workloads and container images (e.g. Kubesec, KubeLinter)**: alati koji čitaju manifest ili Dockerfile i prijavljuju opasne postavke prije nego što išta pokreneš.

Tipični zadaci na ispitu:

- „Dat je Dockerfile u `/opt/app/Dockerfile`. Popravi dvije sigurnosne greške (npr. `USER root`, `latest` tag) bez mijenjanja funkcionalnosti.“
- „Skeniraj manifeste u `/opt/manifests/` sa `kubesec` i upiši ime onog sa najlošijim skorom u `/root/worst.txt`.“
- „Pokreni `kube-linter` nad Deploymentom i popravi sve nalaze iz kategorije `privileged-container` i `run-as-non-root`.“
- „Od tri Deploymenta obriši one koji krše pravila: privileged, hostPath ka `/`, ili Secret u env varijabli.“

Na ispitu obično nema Dockera, pa slike ne buildaš: čitaš i popravljaš Dockerfile i YAML. Važno je brzo prepoznati problem.

## Zašto je mala slika sigurnija

Svaki paket u slici je potencijalna ranjivost (CVE) i potencijalni alat za napadača. Ako napadač dobije izvršavanje koda u kontejneru, a u slici postoje `bash`, `curl`, `wget`, `apt` i `nc`, lako preuzima dodatne alate i kreće se dalje. U slici bez shella i menadžera paketa taj korak je mnogo teži.

| Bazna slika | Veličina (red veličine) | Shell / paket menadžer | Kada |
|---|---|---|---|
| `ubuntu`, `debian` | desetine MB | da / apt | Razvoj, kad treba mnogo alata |
| `alpine` | nekoliko MB | `sh` (busybox) / apk | Mala slika sa osnovnim alatima; musl libc umjesto glibc |
| **distroless** (`gcr.io/distroless/...`) | MB do desetine MB | **ne** / ne | Produkcija: samo runtime (glibc, CA certifikati, tzdata), bez shella |
| **scratch** | 0 | ne / ne | Statički linkovani binarni fajlovi (Go sa `CGO_ENABLED=0`) |
| Chainguard (`cgr.dev/chainguard/...`) | mala | većinom ne | Minimalne slike sa čestim zakrpama, mali broj CVE-ova |

Distroless slike imaju varijante:

- `gcr.io/distroless/static-debian12` za statičke binarne fajlove, `base-debian12` kad treba glibc, plus slike za jezike (npr. `java`, `python3`, `nodejs`).
- Tag `:nonroot` pokreće proces kao korisnik `nonroot` (UID 65532).
- Tag `:debug` dodaje busybox shell. Koristi ga samo za otklanjanje grešaka, nikad u produkciji.

> **Na ispitu:** ako zadatak traži „smanji površinu napada slike“, najčešće se očekuje zamjena bazne slike manjom (`alpine` ili distroless) sa **konkretnim tagom**, ne `latest`. Ne mijenjaj ono što aplikacija treba za rad (npr. jezik runtimea).

## Multi-stage build

Build alati (kompajler, `git`, `make`, dev zavisnosti) ne trebaju u slici koja se izvršava. Multi-stage build ih ostavlja u prvoj fazi, a u finalnu sliku kopira samo rezultat.

```dockerfile
# faza 1: build
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/app

# faza 2: runtime
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app"]
```

- Finalna slika nema Go toolchain, izvorni kod ni shell.
- `COPY --from=build` kopira samo binarni fajl.
- Za Go je moguće i `FROM scratch`, ali tada sam moraš dodati CA certifikate i `/etc/passwd` ako ih aplikacija treba.

## Non-root korisnik

Kontejner koji radi kao root (UID 0) u slučaju bijega ili pogrešne konfiguracije (hostPath, privileged) postaje root na čvoru. Podrazumijevano, ako Dockerfile nema `USER`, proces radi kao root.

```dockerfile
FROM alpine:3.22
RUN addgroup -S app && adduser -S -G app -u 10001 app
COPY --chown=app:app app /usr/local/bin/app
USER 10001
ENTRYPOINT ["/usr/local/bin/app"]
```

- Koristi **numerički** UID u `USER`. Kubelet sa `runAsNonRoot: true` može provjeriti samo numerički UID; ime korisnika (`USER app`) ne može pouzdano provjeriti pa odbija start.
- `USER` mora biti **posljednji** relevantan red: `USER root` iza `USER app` vraća root.
- Isto osiguravaš i u Kubernetesu (`runAsNonRoot`, `runAsUser`), što je tema prethodnog modula.

## Pinovanje verzija i digesta

| Zapis | Problem / prednost |
|---|---|
| `FROM nginx` ili `FROM nginx:latest` | Svaki build može dobiti drugu sliku; ne znaš šta radi u produkciji |
| `FROM nginx:1.27` | Bolje, ali tag se može pomjeriti (nova zakrpa iste verzije ili zlonamjerna izmjena) |
| `FROM nginx:1.27.5@sha256:<digest>` | Nepromjenljivo: digest je hash sadržaja, isti digest = ista slika |

Digest slike saznaš ovako:

```bash
crictl images --digests | grep nginx
crictl inspecti docker.io/library/nginx:1.27 | grep -A2 repoDigests
kubectl get pod web -o jsonpath='{.status.containerStatuses[0].imageID}{"\n"}'
```

U Kubernetes manifestu takođe možeš koristiti `image: nginx@sha256:...`. Isto važi za pakete u slici: `apk add --no-cache curl=8.14.1-r1` umjesto samo `curl` (konkretna verzija je primjer).

## Dockerfile: dobre prakse

| Praksa | Loše | Dobro |
|---|---|---|
| Kopiranje fajlova | `ADD app.tar.gz /app` ili `ADD https://...` | `COPY app /app`; `ADD` automatski raspakuje arhive i preuzima URL-ove, što je neočekivano |
| Tajne | `ENV DB_PASSWORD=...`, `ARG TOKEN` pa `RUN` sa njim, `COPY id_rsa` | BuildKit `RUN --mount=type=secret,id=...`; tajna ne ostaje u sloju |
| Brisanje u kasnijem sloju | `COPY key.pem .` pa `RUN rm key.pem` | Fajl ostaje u ranijem sloju i čita se sa `docker history`/raspakivanjem slike |
| Kontekst builda | Bez `.dockerignore` | `.dockerignore` sa `.git`, `.env`, `*.pem`, `node_modules` |
| Keš paketa | `RUN apt-get install -y curl` | `RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*` |
| Alati | `RUN apk add bash curl vim netcat-openbsd` | Samo ono što aplikacija treba u runtimeu |
| Pokretanje | `CMD python app.py` (shell forma) | `ENTRYPOINT ["python", "app.py"]` (exec forma, proces dobija signale) |
| Zdravlje | Bez provjere | `HEALTHCHECK CMD ["/app", "health"]` za Docker; u Kubernetesu se koriste probe, `HEALTHCHECK` kubelet ignoriše |

Primjer tajne pri buildu bez curenja u sloj:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --omit=dev
COPY . .
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t app:1.0 .
```

### Uklanjanje shella i alata

Kad baza nije distroless, alate možeš ukloniti na kraju builda:

```dockerfile
FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
 && rm -f /bin/sh /bin/ash /usr/bin/wget /usr/bin/nc
```

Pazi: `rm` u istom `RUN` redu kao zadnji korak, i tek kad aplikaciji shell više ne treba (exec forma `ENTRYPOINT`). Kombinacija sa `readOnlyRootFilesystem: true` u Podu sprječava i da napadač doda alate tokom rada.

> **Na ispitu:** kod zadataka „popravi Dockerfile“ obično treba promijeniti tačno ono što je traženo, npr. `USER root` u `USER nobody` ili `USER 65535`, `ubuntu:latest` u `ubuntu:22.04`. Ne preuređuj cijeli fajl; provjerivač često gleda konkretne redove.

## Statička analiza manifesta

Statička analiza čita YAML (ili Helm template) i ocjenjuje sigurnosne postavke bez pokretanja. Ide u CI prije `kubectl apply`, ali je korisna i ručno na ispitu.

### kubesec

**kubesec** ocjenjuje Pod, Deployment, StatefulSet i DaemonSet bodovima. Pozitivni bodovi za dobre prakse, negativni za opasne.

```bash
kubesec scan pod.yaml
kubesec scan deploy.yaml --format table
kubectl get deploy web -o yaml | kubesec scan -
helm template ./chart | kubesec scan /dev/stdin
kubesec print-rules --format table          # sva pravila sa bodovima
```

Izlaz (JSON, skraćeno):

```json
[
  {
    "object": "Pod/web.default",
    "valid": true,
    "message": "Failed with a score of -30 points",
    "score": -30,
    "scoring": {
      "critical": [
        {
          "selector": "containers[] .securityContext .privileged == true",
          "reason": "Privileged containers can allow almost completely unrestricted host access",
          "points": -30
        }
      ],
      "advise": [
        {
          "selector": "containers[] .securityContext .runAsNonRoot == true",
          "reason": "Force the running image to run as a non-root user to ensure least privilege",
          "points": 1
        }
      ]
    }
  }
]
```

- `scoring.critical`: pogođena pravila sa negativnim bodovima (opasne postavke).
- `scoring.passed`: pogođena pravila sa pozitivnim bodovima (dobre postavke koje već imaš).
- `scoring.advise`: šta možeš dodati da povećaš skor (u JSON-u ključ se piše `advise`).
- `score`: zbir bodova svih pogođenih pravila; veći je bolji. Ako je skor manji od 0, `message` kaže `Failed with a score of ...`, inače `Passed with a score of ...`.

Neka pravila i bodovi (iz `kubesec print-rules`):

| Pravilo | Uslov | Bodovi |
|---|---|---|
| Privileged | `securityContext.privileged == true` | −30 |
| CapSysAdmin | `capabilities.add == SYS_ADMIN` | −30 |
| HostNetwork / HostPID / HostIPC | `.spec.hostNetwork == true` itd. | −9 |
| DockerSock | hostPath `/var/run/docker.sock` | −9 |
| AllowPrivilegeEscalation | `allowPrivilegeEscalation == true` | −7 |
| SecretsAsEnvironmentVariables | `env.valueFrom.secretKeyRef` / `envFrom.secretRef` | −5 |
| ReadOnlyRootFilesystem, RunAsNonRoot, CapDropAll | postavljeni | +1 |
| RunAsUser | `runAsUser > 10000` | +1 |
| ServiceAccountName | postavljen | +3 |
| ApparmorAny | `appArmorProfile.type` postavljen | +3 |

Brzo poređenje više fajlova:

```bash
for f in /opt/manifests/*.yaml; do echo "$f $(kubesec scan $f | jq '.[0].score')"; done | sort -k2 -n
```

> **Na ispitu:** kubesec izlaz je JSON, pa `jq '.[0].score'` i `jq '.[0].scoring.critical'` štede vrijeme. Nemoj slati manifeste na javni `v2.kubesec.io` servis u stvarnom radu: lokalni binarni fajl ili Docker slika (`kubesec/kubesec:v2`) rade isto.

### kube-linter

**kube-linter** (StackRox) provjerava manifeste i Helm chartove po listi provjera (checks). Kad nađe problem, vraća ne-nula exit code, pa je pogodan za CI.

```bash
kube-linter lint deploy.yaml
kube-linter lint /opt/manifests/
kube-linter lint ./chart                         # Helm chart direktno
kube-linter checks list                          # sve provjere i da li su podrazumijevane
kube-linter lint --include privileged-container,run-as-non-root deploy.yaml
kube-linter lint --exclude unset-cpu-requirements,unset-memory-requirements deploy.yaml
kube-linter lint --format json deploy.yaml
```

Primjer izlaza:

```text
deploy.yaml: (object: default/web apps/v1, Kind=Deployment) container "web" does not have a read-only root file system (check: no-read-only-root-fs, remediation: Set readOnlyRootFilesystem to true in the container securityContext.)

deploy.yaml: (object: default/web apps/v1, Kind=Deployment) container "web" is not set to runAsNonRoot (check: run-as-non-root, remediation: ...)

Error: found 2 lint errors
```

Sigurnosno važne podrazumijevane provjere:

| Check | Šta traži |
|---|---|
| `privileged-container` | `privileged: true` |
| `privilege-escalation-container` | `allowPrivilegeEscalation` nije `false` |
| `run-as-non-root` | Nedostaje `runAsNonRoot: true` / ne-root UID |
| `no-read-only-root-fs` | Nedostaje `readOnlyRootFilesystem: true` |
| `host-network`, `host-pid`, `host-ipc` | Dijeljenje host namespaceova |
| `sensitive-host-mounts` | hostPath na osjetljive putanje (`/etc`, `/proc`, `/var/run/docker.sock`…) |
| `docker-sock` | Montiran Docker socket |
| `latest-tag` | Slika bez taga ili sa `:latest` |
| `env-var-secret` | Tajna vrijednost direktno u env |
| `drop-net-raw-capability` | Nije odbačen `NET_RAW` |
| `unsafe-sysctls` | Nesigurne sysctl vrijednosti |

Konfiguracija u `.kube-linter.yaml` (traži se u trenutnom direktorijumu) ili preko `--config`:

```yaml
checks:
  doNotAutoAddDefaults: true
  include:
  - privileged-container
  - run-as-non-root
  - latest-tag
```

Izuzetak za jedan objekat ide anotacijom sa obrazloženjem:

```yaml
metadata:
  annotations:
    ignore-check.kube-linter.io/privileged-container: "CNI agent treba pristup kernelu"
```

### Trivy config

**Trivy** osim ranjivosti u slikama skenira i pogrešne konfiguracije (misconfigurations) u Kubernetes manifestima, Dockerfileovima, Helm chartovima i Terraformu. Za to služi podkomanda `config`:

```bash
trivy config /opt/manifests/
trivy config --severity HIGH,CRITICAL /opt/app/
trivy config --exit-code 1 --severity CRITICAL deploy.yaml
trivy fs --scanners misconfig /opt/app/          # isto kroz fs skener
```

Izlaz grupiše nalaze po fajlu (tip fajla u zagradi, npr. `(kubernetes)`, `(dockerfile)`) i daje ID provjere, ozbiljnost i opis, npr. `KSV012` (kontejner treba `runAsNonRoot`), `KSV023` (hostPath volumen) ili `DS002` (Dockerfile radi kao root). Lab okruženje ima Trivy 0.74; skeniranje slika je tema modula o lancu snabdijevanja.

### hadolint (ukratko)

**hadolint** je linter za Dockerfile. Koristan je za CI, a pravila imaju oznake `DL...`:

```bash
hadolint Dockerfile
```

| Pravilo | Značenje |
|---|---|
| DL3006 | Uvijek navedi tag bazne slike |
| DL3007 | Ne koristi `latest` |
| DL3002 | Posljednji `USER` ne smije biti root |
| DL3020 | Koristi `COPY` umjesto `ADD` za fajlove i direktorijume |
| DL3008 | Pinuj verzije apt paketa |

## Ručna analiza na ispitu

Alati nisu uvijek instalirani ili zadatak glasi „pregledaj i popravi“. Imaj spisak šta tražiš.

### U Kubernetes manifestu

| Šta tražiš | Zašto je opasno |
|---|---|
| `privileged: true` | Praktično root na čvoru |
| `hostPath` (posebno `/`, `/etc`, `/var/run/docker.sock`, `/var/lib/kubelet`) | Čitanje i izmjena fajlova čvora |
| `hostNetwork`, `hostPID`, `hostIPC: true` | Vidi mrežu i procese čvora |
| `runAsUser: 0`, nema `runAsNonRoot` | Proces je root |
| `allowPrivilegeEscalation: true` ili nedostaje | setuid eskalacija |
| `capabilities.add: [SYS_ADMIN, NET_ADMIN, ...]` | Opasne capabilities |
| `image: ...:latest` ili bez taga | Nepredvidiva slika |
| `env` sa `value:` koji izgleda kao lozinka/token, `secretKeyRef` u env | Tajna u env varijabli |
| `automountServiceAccountToken` nije `false` kad Pod ne treba API | Token dostupan napadaču |
| Nema `readOnlyRootFilesystem` | Napadač može mijenjati fajlove u kontejneru |

Brza pretraga kroz fajlove:

```bash
grep -nE 'privileged: true|hostPath|hostNetwork|hostPID|hostIPC|runAsUser: 0|:latest|SYS_ADMIN|allowPrivilegeEscalation: true' /opt/manifests/*.yaml
kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[].securityContext.privileged==true) | .metadata.namespace+"/"+.metadata.name'
```

### U Dockerfileu

| Šta tražiš | Popravka |
|---|---|
| `FROM image:latest` ili bez taga | Konkretan tag, idealno digest |
| Nema `USER` ili `USER root` na kraju | `USER` sa ne-root numeričkim UID-om |
| `ENV PASSWORD=...`, `ARG TOKEN`, `COPY .ssh` | Tajnu ukloniti, koristiti build secret ili Kubernetes Secret u runtimeu |
| `ADD` sa URL-om ili arhivom | `COPY` (ili eksplicitan download sa provjerom hasha) |
| `apt-get install` alata za debug (curl, vim, netcat) | Ukloniti; koristiti multi-stage |
| `chmod 777`, `sudo` u slici | Ukloniti |
| Velika bazna slika za statički binarni fajl | distroless ili scratch |

Primjer zadatka. Dat je Dockerfile:

```dockerfile
FROM ubuntu:latest
ENV API_TOKEN=abc123
RUN apt-get update && apt-get install -y curl python3
COPY app.py /app.py
USER root
CMD python3 /app.py
```

Popravljena verzija:

```dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*
COPY app.py /app.py
USER 65535
CMD ["python3", "/app.py"]
```

Token ide u Kubernetes Secret montiran kao volumen, a `curl` ne treba aplikaciji u radu.

> **Na ispitu:** kad zadatak kaže „pronađi Pod koji krši X i obriši ga“, prvo listaj (`kubectl get pod -n X -o yaml | grep -n ...`) i zapiši imena, pa tek onda briši. Brisanje pogrešnog Poda u zadatku sa provjerivačem znači nula bodova za taj zadatak.

## Troubleshooting

| Simptom | Šta provjeriti |
|---|---|
| Pod sa `runAsNonRoot: true` u `CreateContainerConfigError` | Slika nema `USER` ili ima ime umjesto numeričkog UID-a; dodaj `runAsUser` ili popravi Dockerfile |
| Distroless kontejner: `kubectl exec ... -- sh` vraća `executable file not found` | Očekivano, nema shella; koristi `kubectl debug` sa ephemeral kontejnerom |
| Aplikacija pada nakon prelaska na distroless | Nedostaje biblioteka (static vs base varijanta) ili CA certifikati |
| `kube-linter` ne prijavljuje očekivan check | Check nije podrazumijevan ili je isključen u `.kube-linter.yaml`; `kube-linter checks list` |
| kubesec vraća `valid: false` ili poruku `This resource kind is not supported by kubesec` | Manifest ne prolazi validaciju šeme, odnosno tip objekta (npr. Service) kubesec ne ocjenjuje |
| `trivy config` ne nalazi ništa u fajlu | Fajl nije prepoznat kao Kubernetes manifest (nedostaje `apiVersion`/`kind`) |

## Rezime

- Manja slika = manje CVE-ova i manje alata za napadača; distroless i scratch nemaju shell ni paket menadžer.
- Multi-stage build drži kompajlere i izvorni kod van finalne slike (`COPY --from=build`).
- `USER` sa ne-root numeričkim UID-om kao posljednji `USER` red; isto potvrdi u Podu sa `runAsNonRoot`.
- Pinuj tag, a za nepromjenljivost i digest (`image@sha256:...`); `latest` je zabranjen u ozbiljnim okruženjima.
- Nikad tajne u `ENV`, `ARG` ili slojevima; koristi `COPY` umjesto `ADD` i `.dockerignore`.
- kubesec daje skor (`critical` negativni, `advise` pozitivni), kube-linter listu nalaza sa imenom checka i exit code, `trivy config` misconfiguration nalaze za YAML i Dockerfile.
- Na ispitu ručno traži: privileged, hostPath, host namespaceove, root, `latest`, tajne u env, opasne capabilities.
