## Kako izgleda CKA ispit

CKA je **praktičan** ispit. Nema pitanja sa ponuđenim odgovorima: dobiješ udaljeni Linux desktop sa terminalom i browserom, i rješavaš zadatke na pravim klasterima.

| | |
|---|---|
| Trajanje | 2 sata |
| Broj zadataka | obično 15–20, sa različitim težinama (procenat uz zadatak) |
| Prolaz | 66% |
| Verzija | Kubernetes v1.35 (oktobar 2026) |
| Okruženje | PSI udaljeni desktop: terminal, Firefox, jednostavan editor |
| Dokumentacija | dozvoljeni su kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs i gateway-api.sigs.k8s.io; drugi sajtovi nisu |
| Ponovni pokušaj | jedan besplatan retake |
| Simulator | uz kupljen ispit dobijaš dvije sesije na killer.sh; one su namjerno teže od ispita |

Pravila i tehnički detalji se mijenjaju. Prije zakazivanja pročitaj aktuelni „Candidate Handbook“ i „Important Instructions: CKA“ na stranici Linux Foundationa.

## Prije svakog zadatka

Svaki zadatak počinje uputom gdje se radi: **kontekst** (`kubectl config use-context …`) ili **host** (`ssh …`). Na ispitu je više klastera, a zadatak riješen na pogrešnom klasteru donosi nula bodova.

> **Na ispitu:** prvo kopiraj i izvrši komandu za kontekst ili host iz zadatka, tek onda čitaj ostatak. Postane refleks već poslije tri zadatka.

Pažljivo pročitaj **imena**: namespace, ime resursa, putanju fajla za odgovor, port. Ocjenjivanje je automatsko: `web-app` nije isto što i `webapp`.

## Podešavanje terminala

Na ispitu su `kubectl`, alias `k` i dovršavanje komandi obično već podešeni. Ako nisu, ovo traje 30 sekundi:

```bash
alias k=kubectl
source <(kubectl completion bash)
complete -o default -F __start_kubectl k
export do="--dry-run=client -o yaml"
export now="--force --grace-period 0"
```

`k run web --image=nginx $do > web.yaml` pravi YAML za izmjenu, a `k delete pod web $now` briše Pod odmah.

Za vim (`~/.vimrc`):

```text
set tabstop=2 shiftwidth=2 expandtab
```

> **Na ispitu:** kopiranje u PSI okruženju radi sa `Ctrl+Shift+C` / `Ctrl+Shift+V` u terminalu. Kad YAML zalijepiš u vim, uvlake se mogu pokvariti; `:set paste` prije lijepljenja to sprečava.

## Upravljanje vremenom

Dva sata za 15–20 zadataka je 6–8 minuta po zadatku. Zadaci nisu jednako teški ni jednako vrijedni.

1. **Prvi prolaz:** riješi sve što znaš odmah. Zadatak koji traje duže od ~8 minuta označi (flag) i idi dalje.
2. **Drugi prolaz:** vrati se na označene, prvo na one sa većim procentom.
3. **Zadnjih 10 minuta:** provjeri da su fajlovi sa odgovorima na pravom mjestu i da Podovi zaista rade (`k get pods`, ne samo `k apply`).

> **Na ispitu:** djelimično riješen zadatak često nosi djelimične bodove. Etcd backup bez restore-a i dalje vrijedi nešto, a prazan zadatak ne vrijedi ništa.

## Imperativno prije deklarativnog

Što god može biti jedna `kubectl` komanda, uradi tako. YAML piši tek za ono što komanda ne zna (probe, affinity, volumeni, NetworkPolicy).

```bash
k create deploy web --image=nginx:1.28 --replicas=3
k expose deploy web --port=80 --type=NodePort
k create role pod-reader --verb=get,list --resource=pods -n dev
k create rolebinding rb --role=pod-reader --serviceaccount=dev:app -n dev
k create cronjob c --image=busybox:1.37 --schedule="*/5 * * * *" -- date
k create ingress web --class=traefik --rule="web.local/*=web:80"
k set image deploy/web nginx=nginx:1.29
k scale deploy web --replicas=5
k label node node01 disk=ssd
k taint node node01 key=val:NoSchedule
```

Za ostalo: `k … $do > fajl.yaml`, izmijeni, `k apply -f fajl.yaml`. Za polja koja ne pamtiš koristi `kubectl explain`, jer je brže od dokumentacije:

```bash
k explain pod.spec.affinity.nodeAffinity --recursive | less
```

## Česte zamke

| Zamka | Kako je izbjeći |
|---|---|
| Pogrešan kontekst ili host | izvrši `use-context`/`ssh` iz zadatka prije svega ostalog |
| Resurs u pogrešnom namespaceu | `-n` u svakoj komandi; provjeri sa `k get … -n …` |
| Static Pod manifest kopiran unutar `/etc/kubernetes/manifests/` | backup čuvaj van tog direktorija |
| etcd backup bez certifikata | putanje pročitaj iz `/etc/kubernetes/manifests/etcd.yaml` |
| Izmjena na čvoru, a ne restartovan kubelet | `systemctl daemon-reload && systemctl restart kubelet` |
| `systemctl start` umjesto `enable --now` | zadatak često traži da popravka preživi restart |
| NetworkPolicy sa crticom viška (OR umjesto AND) | `namespaceSelector` i `podSelector` u istom elementu |
| Upgrade preskače minor verziju | uvijek jedna minor verzija po koraku |
| Odgovor u pogrešnom fajlu ili formatu | `cat` fajla na kraju, uporedi sa zadatkom |

## Probni ispit u ovom kursu

Lab „Probni ispit“ ima 17 zadataka iz svih domena i odbrojavanje od 120 minuta. Pravi ispit ima više zadataka i više klastera; ovdje je sve na jednom klasteru (`controlplane` + `node01`). Procenat uz zadatak je njegova težina.

- Provjeru pokreni tek kad misliš da je zadatak gotov, kao da ga ocjenjuje ispit.
- Ako zapneš, preskoči zadatak. Savjet je tu, ali na ispitu ga nećeš imati.
- Lab možeš pokrenuti ponovo, ali okruženje se tada pravi iznova.

Kad probni ispit prolaziš za manje od 60 minuta bez savjeta, spreman si za killer.sh. Kad killer.sh rješavaš preko 70%, spreman si za ispit.

## Rezime

- CKA je praktičan: 2 sata, 15–20 zadataka, prolaz 66%, dozvoljena zvanična dokumentacija.
- Prvo kontekst ili host iz zadatka, pa tek onda rješavanje.
- Imperativne komande i `$do` štede najviše vremena.
- Teške zadatke preskoči i vrati im se; djelimično rješenje nosi bodove.
- Na kraju provjeri rezultat (`get`, `describe`, `cat`), ne samo da je komanda prošla.
- Tipične zamke: namespace, static Pod backup u manifests direktoriju, kubelet bez `enable`, NetworkPolicy AND/OR.
