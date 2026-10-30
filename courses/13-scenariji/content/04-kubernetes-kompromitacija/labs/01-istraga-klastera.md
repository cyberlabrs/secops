# Lab 1: Istraga kompromitovanog klastera

U 02:21 UTC dežurni u firmi Shop d.o.o. dobija Falco alarm **Detect crypto miners using the Stratum protocol** sa čvora `node01`. Klaster je u produkciji: javna prodavnica `storefront` u namespaceu `shop`, plaćanja u `payments`. Tvoj zadatak je da iz sačuvanih dokaza rekonstruišeš napad, pronađeš konfiguraciju koja ga je omogućila, napišeš popravke i izvještaj.

U labu nema klastera ni `kubectl`-a: radiš kao istražitelj nad izvezenim dokazima, sa `jq` i `yq`.

| Putanja | Sadržaj |
|---|---|
| `/root/falco/falco-alerts.jsonl` | Falco alarmi sa sva tri radna čvora (JSON po liniji) |
| `/root/audit/audit.log` | Kubernetes audit log 01:30–03:00 UTC (JSON po liniji, sa uobičajenim šumom kontrolera i kubeleta) |
| `/root/manifesti/` | Deployment, RBAC i Namespace manifesti iz git repoa |
| `/root/skeniranje/trivy-storefront-2.3.1.json` | Trivy izvještaj za sliku koja radi u produkciji |
| `/root/inventar/` | Snimak `kubectl get pods -A -o wide` i `kubectl get secrets -A` iz 02:40 |

Odgovore upisuj u `/root/odgovori/`, popravke u `/root/popravka/`, a izvještaj u `/root/izvjestaj/`. Svaki fajl sa odgovorom ima jednu vrijednost po redu, bez dodatnog teksta.

```bash
ls -R /root | head -30
jq -c '{time, rule, ns: .output_fields."k8s.ns.name", pod: .output_fields."k8s.pod.name"}' /root/falco/falco-alerts.jsonl | head
```

<!-- setup
set -e
cp -r /opt/scenariji/04-kubernetes-kompromitacija/. /root/
mkdir -p /root/odgovori /root/popravka /root/izvjestaj
-->
<!-- timer
60
-->

## Trijaža Falco alarma

Alarm o rudaru je kraj priče, ne početak. Pronađi pod u kome je napadač **prvi** dobio izvršavanje koda: lanac alarma (izlazna konekcija, preusmjeren stdin/stdout, shell sa terminalom, čitanje tokena) dolazi iz jednog poda. Pazi na šum: shell u `payments` u 01:55 je planirano održavanje, a `ci` i `ops` alarmi se ponavljaju svaki dan.

Upiši:

- `/root/odgovori/pod.txt`: ime tog poda (npr. `ime-poda`, bez namespacea),
- `/root/odgovori/prvi-alarm.txt`: vrijeme **prvog** Falco alarma za taj pod, onako kako stoji u polju `time` (ISO 8601, UTC),
- `/root/odgovori/ip-napadaca.txt`: javnu IP adresu napadačevog servera na koju se pod prvo povezao.

<!-- verify
o=/root/odgovori
[ "$(tr -d ' \r\n' < $o/pod.txt 2>/dev/null | sed 's#^shop/##')" = "storefront-7d9c6b5f4-x2kqp" ] || { echo "pod.txt: to nije pod u kome je počeo napad"; exit 1; }
grep -q '^2026-10-21T02:13:06' $o/prvi-alarm.txt 2>/dev/null || { echo "prvi-alarm.txt: to nije vrijeme prvog alarma za taj pod (polje time)"; exit 1; }
[ "$(tr -d ' \r\n' < $o/ip-napadaca.txt 2>/dev/null)" = "203.0.113.189" ] || { echo "ip-napadaca.txt: pogrešna adresa"; exit 1; }
-->
<!-- hint
```bash
cd /root/falco
jq -r '[.time, .priority, .rule, .output_fields."k8s.ns.name", .output_fields."k8s.pod.name"] | @tsv' falco-alerts.jsonl
jq -r 'select(.output_fields."k8s.pod.name"=="<pod>") | [.time, .rule, .output_fields."fd.name" // .output_fields."proc.cmdline"] | @tsv' falco-alerts.jsonl
```
Polje `fd.name` u alarmu za izlaznu konekciju ima oblik `izvor:port->odredište:port`. Port 1389 je čest za zlonamjerne LDAP servere u Log4Shell napadima.
-->
<!-- solution
jq -r 'select(.output_fields."k8s.ns.name"=="shop" and .rule=="Terminal shell in container") | .output_fields."k8s.pod.name"' /root/falco/falco-alerts.jsonl | head -1 > /root/odgovori/pod.txt
p=$(cat /root/odgovori/pod.txt)
jq -r --arg p "$p" 'select(.output_fields."k8s.pod.name"==$p) | .time' /root/falco/falco-alerts.jsonl | sort | head -1 > /root/odgovori/prvi-alarm.txt
jq -r --arg p "$p" 'select(.output_fields."k8s.pod.name"==$p and .rule=="Unexpected outbound connection") | .output_fields."fd.name"' /root/falco/falco-alerts.jsonl | head -1 | sed 's/.*->//; s/:.*//' > /root/odgovori/ip-napadaca.txt
-->

## Ulazna tačka: ranjiva slika

Kompromitovani pod pokreće sliku iz `manifesti/storefront-deployment.yaml`. Trivy izvještaj za nju ima više kritičnih nalaza, ali samo jedan odgovara onome što je Falco vidio: `java` proces koji se sam od sebe povezuje na LDAP port napadača.

Upiši:

- `/root/odgovori/cve.txt`: CVE ranjivosti iskorištene za ulaz (onu sa CVSS v3 ocjenom 10.0),
- `/root/odgovori/log4j-verzija.txt`: najnižu verziju `log4j-core` iz grane 2.x (ne 2.12.x ni 2.3.x) koja ispravlja **sve** `log4j-core` nalaze iz izvještaja.

Razmisli i zašto `zlib1g` CVE-2023-45853, iako je `CRITICAL` i 9.8, nije prioritet za ovu sliku.

<!-- verify
o=/root/odgovori
[ "$(tr -d ' \r\n' < $o/cve.txt 2>/dev/null | tr a-z A-Z)" = "CVE-2021-44228" ] || { echo "cve.txt: pogrešan CVE"; exit 1; }
[ "$(tr -d ' \r\n' < $o/log4j-verzija.txt 2>/dev/null)" = "2.17.1" ] || { echo "log4j-verzija.txt: pogrešna verzija (pogledaj FixedVersion svih log4j-core nalaza)"; exit 1; }
-->
<!-- hint
```bash
T=/root/skeniranje/trivy-storefront-2.3.1.json
jq -r '.Results[] | .Target as $t | .Vulnerabilities[]? | [$t, .VulnerabilityID, .PkgName, .InstalledVersion, .FixedVersion, .Severity, .CVSS.nvd.V3Score] | @tsv' $T
jq -r '.Results[].Vulnerabilities[]? | select(.PkgName | test("log4j-core")) | [.VulnerabilityID, .FixedVersion] | @tsv' $T
```
-->
<!-- solution
jq -r '.Results[].Vulnerabilities[]? | select(.CVSS.nvd.V3Score == 10) | .VulnerabilityID' /root/skeniranje/trivy-storefront-2.3.1.json > /root/odgovori/cve.txt
jq -r '.Results[].Vulnerabilities[]? | select(.PkgName | test("log4j-core")) | .FixedVersion | split(", ")[0]' /root/skeniranje/trivy-storefront-2.3.1.json | sort -V | tail -1 > /root/odgovori/log4j-verzija.txt
-->

## Audit log: šta je uradio ServiceAccount

Falco kaže da je napadač pročitao ServiceAccount token i kontaktirao API server. Audit log kaže **šta** je s tim tokenom radio. Aplikacija i sama koristi isti ServiceAccount (`system:serviceaccount:shop:storefront`): svakih 5 minuta čita svoj ConfigMap klijentom `fabric8-kubernetes-client`.

Sačuvaj u `/root/odgovori/sa-zahtjevi.tsv` sve zahtjeve tog ServiceAccounta **koji nisu od aplikacije** (userAgent ne počinje sa `fabric8`), redom kao u logu, jedan zahtjev po redu, kolone odvojene tabom (`@tsv`):

1. `requestReceivedTimestamp`
2. `verb`
3. resurs, a ako postoji subresurs onda `resurs/subresurs` (npr. `pods/exec`)
4. `objectRef.namespace` (prazno ako ga nema)
5. `objectRef.name` (prazno ako ga nema)
6. `responseStatus.code`

Pogledaj i `user.extra` u tim zapisima: iz kog poda potiče token i sa koje IP adrese su stizali zahtjevi?

<!-- verify
f=/root/odgovori/sa-zahtjevi.tsv
[ -s $f ] || { echo "nema $f"; exit 1; }
ref=$(jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and (.userAgent|startswith("fabric8")|not)) | [.requestReceivedTimestamp, .verb, (.objectRef.resource + (if .objectRef.subresource then "/" + .objectRef.subresource else "" end)), .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' /root/audit/audit.log)
got=$(tr -d '\r' < $f)
[ "$(echo "$got" | wc -l)" -eq "$(echo "$ref" | wc -l)" ] || { echo "broj redova nije tačan: imaš $(echo "$got" | wc -l), treba $(echo "$ref" | wc -l)"; exit 1; }
[ "$got" = "$ref" ] || { echo "sadržaj se razlikuje od očekivanog (redoslijed, kolone ili tabovi)"; exit 1; }
-->
<!-- hint
```bash
A=/root/audit/audit.log
jq -r '.user.username' $A | sort | uniq -c | sort -rn
SA=system:serviceaccount:shop:storefront
jq -r --arg sa $SA 'select(.user.username==$sa) | .userAgent' $A | sort | uniq -c
jq -r --arg sa $SA 'select(.user.username==$sa and (.userAgent|startswith("fabric8")|not))
  | [.requestReceivedTimestamp, .verb,
     (.objectRef.resource + (if .objectRef.subresource then "/" + .objectRef.subresource else "" end)),
     .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' $A > /root/odgovori/sa-zahtjevi.tsv
```
`@tsv` od `null` pravi prazno polje, pa ne treba `// ""`.
-->
<!-- solution
jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and (.userAgent|startswith("fabric8")|not)) | [.requestReceivedTimestamp, .verb, (.objectRef.resource + (if .objectRef.subresource then "/" + .objectRef.subresource else "" end)), .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' /root/audit/audit.log > /root/odgovori/sa-zahtjevi.tsv
-->

## Tajne i privilegovani pod

Iz istih zapisa izvuci štetu:

- `/root/odgovori/tajne.txt`: tajne koje je napadač pojedinačno pročitao (`get` na `secrets`, uspješno), u obliku `namespace/ime`, jedna po redu,
- `/root/odgovori/zlonamjerni-pod.txt`: pod koji je napadač napravio, u obliku `namespace/ime`,
- `/root/odgovori/cvor.txt`: čvor na kome je taj pod pokrenut,
- `/root/odgovori/pod-spec.json`: kompletan `requestObject` iz zahtjeva kojim je pod napravljen (validan JSON).

Pogledaj spec: šta mu daju `privileged`, `hostPID`, `hostNetwork` i `hostPath` sa putanjom `/`? Zašto zahtjev za taj pod nema par u `pods/binding` od `kube-scheduler`a? I šta je napadač dobio zahtjevom `list secrets` u `shop`, iako nijednu tajnu iz njega nije tražio po imenu?

<!-- verify
o=/root/odgovori
A=/root/audit/audit.log
want=$(printf 'payments/payments-db\nshop/postgres-credentials\nshop/stripe-api-key')
[ "$(tr -d ' \r' < $o/tajne.txt 2>/dev/null | grep -v '^$' | sort -u)" = "$want" ] || { echo "tajne.txt: spisak tajni nije tačan"; exit 1; }
[ "$(tr -d ' \r\n' < $o/zlonamjerni-pod.txt 2>/dev/null)" = "kube-system/node-debug-7f4c" ] || { echo "zlonamjerni-pod.txt: pogrešan pod (oblik namespace/ime)"; exit 1; }
[ "$(tr -d ' \r\n' < $o/cvor.txt 2>/dev/null)" = "node01" ] || { echo "cvor.txt: pogrešan čvor"; exit 1; }
jq -e . $o/pod-spec.json >/dev/null 2>&1 || { echo "pod-spec.json ne postoji ili nije validan JSON"; exit 1; }
ref=$(jq -S -c 'select(.verb=="create" and .objectRef.resource=="pods" and .requestObject != null and .objectRef.name=="node-debug-7f4c") | .requestObject' $A)
[ "$(jq -S -c . $o/pod-spec.json)" = "$ref" ] || { echo "pod-spec.json nije requestObject zahtjeva kojim je pod napravljen"; exit 1; }
-->
<!-- hint
```bash
A=/root/audit/audit.log
SA=system:serviceaccount:shop:storefront
jq -r --arg sa $SA 'select(.user.username==$sa and .objectRef.resource=="secrets" and .verb=="get" and .responseStatus.code==200)
  | "\(.objectRef.namespace)/\(.objectRef.name)"' $A
jq --arg sa $SA 'select(.user.username==$sa and .verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null)
  | .requestObject' $A
```
Polje `spec.nodeName` postavljeno direktno u manifestu zaobilazi scheduler.
-->
<!-- solution
A=/root/audit/audit.log
jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and .objectRef.resource=="secrets" and .verb=="get" and .responseStatus.code==200) | "\(.objectRef.namespace)/\(.objectRef.name)"' $A > /root/odgovori/tajne.txt
jq 'select(.user.username=="system:serviceaccount:shop:storefront" and .verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null) | .requestObject' $A > /root/odgovori/pod-spec.json
jq -r '"\(.metadata.namespace)/\(.metadata.name)"' /root/odgovori/pod-spec.json > /root/odgovori/zlonamjerni-pod.txt
jq -r '.spec.nodeName' /root/odgovori/pod-spec.json > /root/odgovori/cvor.txt
-->

## RBAC koji je omogućio napad

Anotacija `authorization.k8s.io/reason` u audit zapisima kaže koji binding je dozvolio svaki zahtjev. Nađi ga u `manifesti/rbac.yaml`.

1. Upiši u `/root/odgovori/binding.txt` vrstu i ime tog bindinga u obliku `Vrsta/ime` (npr. `RoleBinding/nesto`).
2. Napiši `/root/popravka/rbac.yaml` sa ispravkom po principu najmanjih privilegija. Aplikaciji treba samo ono što je u audit logu stvarno koristila (zahtjevi `fabric8` klijenta):
   - jedan `Role` u namespaceu `shop` koji dozvoljava samo `get` na `configmaps`, ograničeno sa `resourceNames` na ConfigMap koji aplikacija čita,
   - jedan `RoleBinding` u `shop` koji taj `Role` dodjeljuje ServiceAccountu `storefront` iz `shop`,
   - bez `ClusterRole` i `ClusterRoleBinding` dokumenata i bez `*`.

Provjeri fajl sa `yq`, npr. `yq -o=json '.' /root/popravka/rbac.yaml`.

<!-- verify
o=/root/odgovori
b=$(tr -d ' \r\n' < $o/binding.txt 2>/dev/null)
[ "$b" = "ClusterRoleBinding/storefront-ops" ] || { echo "binding.txt: očekuje se Vrsta/ime bindinga koji je dozvolio napad"; exit 1; }
f=/root/popravka/rbac.yaml
[ -s $f ] || { echo "nema $f"; exit 1; }
yq -o=json -I=0 '.' $f > /tmp/rbac.jsonl 2>/dev/null || { echo "rbac.yaml nije validan YAML"; exit 1; }
python3 - /tmp/rbac.jsonl <<'EOF' || exit 1
import json, sys
docs = [d for d in (json.loads(l) for l in open(sys.argv[1]) if l.strip()) if d]
kinds = [d.get("kind") for d in docs]
if any(k in ("ClusterRole", "ClusterRoleBinding") for k in kinds): sys.exit("rbac.yaml ne smije imati ClusterRole ni ClusterRoleBinding")
roles = [d for d in docs if d.get("kind") == "Role"]
rbs = [d for d in docs if d.get("kind") == "RoleBinding"]
if len(roles) != 1 or len(rbs) != 1: sys.exit("treba tačno jedan Role i jedan RoleBinding")
r, rb = roles[0], rbs[0]
if r.get("metadata", {}).get("namespace") != "shop" or rb.get("metadata", {}).get("namespace") != "shop": sys.exit("Role i RoleBinding moraju biti u namespaceu shop")
rules = r.get("rules") or []
if not rules: sys.exit("Role nema pravila")
for ru in rules:
    if "*" in json.dumps(ru): sys.exit("pravila ne smiju sadržati *")
    if set(ru.get("resources") or []) != {"configmaps"}: sys.exit("Role smije dozvoliti samo resurs configmaps")
    if (ru.get("apiGroups") or [None]) != [""]: sys.exit("configmaps su u core API grupi: apiGroups: [\"\"]")
    if set(ru.get("verbs") or []) != {"get"}: sys.exit("dozvoljen glagol je samo get")
    if (ru.get("resourceNames") or []) != ["storefront-config"]: sys.exit("ograniči resourceNames na ConfigMap koji aplikacija čita")
ref = rb.get("roleRef") or {}
if ref.get("kind") != "Role" or ref.get("name") != r.get("metadata", {}).get("name"): sys.exit("roleRef RoleBindinga mora pokazivati na tvoj Role")
subs = rb.get("subjects") or []
if len(subs) != 1 or subs[0].get("kind") != "ServiceAccount" or subs[0].get("name") != "storefront" or subs[0].get("namespace") != "shop": sys.exit("subjekt mora biti samo ServiceAccount storefront iz shop")
EOF
-->
<!-- hint
```bash
jq -r '.annotations."authorization.k8s.io/reason"' /root/audit/audit.log | sort | uniq -c | grep storefront
jq -r 'select(.userAgent|startswith("fabric8")) | [.verb, .objectRef.resource, .objectRef.name] | @tsv' /root/audit/audit.log | sort | uniq -c
```
Kostur:
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: storefront-config-reader
  namespace: shop
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["..."]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
...
```
-->
<!-- solution
echo "ClusterRoleBinding/storefront-ops" > /root/odgovori/binding.txt
cat > /root/popravka/rbac.yaml <<'EOF'
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: storefront-config-reader
  namespace: shop
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["storefront-config"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: storefront-config-reader
  namespace: shop
subjects:
  - kind: ServiceAccount
    name: storefront
    namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: storefront-config-reader
EOF
-->

## NetworkPolicy i hardening Deploymenta

Dva manifesta za obuzdavanje i za novu verziju:

**`/root/popravka/networkpolicy.yaml`** (sve u namespaceu `shop`; `newsletter` dobija svoju politiku od svog tima):

- `default-deny`: `podSelector: {}`, `policyTypes` `Ingress` i `Egress`, bez ijednog pravila,
- politika za `app: storefront`: ingress samo iz namespacea `ingress-nginx` (`namespaceSelector` po labeli `kubernetes.io/metadata.name`) na TCP 8080; egress samo prema podovima `app: postgres` na TCP 5432, prema `kube-dns` u `kube-system` na port 53 (UDP i TCP) i prema API serveru `10.0.10.10/32` na TCP 6443 (aplikacija i dalje čita ConfigMap; NetworkPolicy vidi adresu poslije DNAT-a servisa `10.96.0.1:443`),
- politika za `app: postgres`: ingress samo iz podova `app: storefront` na TCP 5432.

Nijedno egress pravilo ne smije biti bez `to`, niti dozvoliti `0.0.0.0/0`.

**`/root/popravka/deployment.yaml`**: kopija `manifesti/storefront-deployment.yaml` sa:

- slikom `registry.shop.local/shop/storefront:2.4.0` (sadrži `log4j-core` 2.17.1),
- `automountServiceAccountToken: false` u spec poda; token se montira eksplicitno, `projected` volumenom sa `serviceAccountToken` (`expirationSeconds` najviše 3600), `configMap` `kube-root-ca.crt` i `downwardAPI` za namespace, na `/var/run/secrets/kubernetes.io/serviceaccount` sa `readOnly: true`,
- `securityContext` poda: `runAsNonRoot: true`, `runAsUser: 10001`, `seccompProfile.type: RuntimeDefault`,
- `securityContext` kontejnera: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`,
- `emptyDir` volumenom montiranim na `/tmp` (Java i Spring pišu privremene fajlove).

<!-- verify
for f in /root/popravka/networkpolicy.yaml /root/popravka/deployment.yaml; do [ -s $f ] || { echo "nema $f"; exit 1; }; done
yq -o=json -I=0 '.' /root/popravka/networkpolicy.yaml > /tmp/np.jsonl 2>/dev/null || { echo "networkpolicy.yaml nije validan YAML"; exit 1; }
yq -o=json -I=0 '.' /root/popravka/deployment.yaml > /tmp/dep.jsonl 2>/dev/null || { echo "deployment.yaml nije validan YAML"; exit 1; }
python3 - /tmp/np.jsonl <<'EOF' || exit 1
import json, sys
docs = [d for d in (json.loads(l) for l in open(sys.argv[1]) if l.strip()) if d]
if not docs or any(d.get("kind") != "NetworkPolicy" or d.get("metadata", {}).get("namespace") != "shop" for d in docs): sys.exit("svi dokumenti moraju biti NetworkPolicy u namespaceu shop")
sel = lambda d: (d.get("spec", {}).get("podSelector") or {}).get("matchLabels") or {}
pt = lambda d: set(d.get("spec", {}).get("policyTypes") or [])
def ports(rule): return {(p.get("protocol", "TCP"), p.get("port")) for p in rule.get("ports") or []}
deny = [d for d in docs if not sel(d) and not (d["spec"].get("podSelector") or {}).get("matchExpressions")]
if not any(pt(d) == {"Ingress", "Egress"} and not d["spec"].get("ingress") and not d["spec"].get("egress") for d in deny): sys.exit("nema default-deny politike (podSelector {}, Ingress i Egress, bez pravila)")
sf = [d for d in docs if sel(d) == {"app": "storefront"}]
pg = [d for d in docs if sel(d) == {"app": "postgres"}]
if len(sf) != 1 or not {"Ingress", "Egress"} <= pt(sf[0]): sys.exit("treba jedna politika za app: storefront sa Ingress i Egress")
s = sf[0]["spec"]
ing, eg = s.get("ingress") or [], s.get("egress") or []
if not ing or any(not r.get("from") for r in ing): sys.exit("svako ingress pravilo za storefront mora imati from")
if not any(any((f.get("namespaceSelector") or {}).get("matchLabels", {}).get("kubernetes.io/metadata.name") == "ingress-nginx" for f in r["from"]) and ("TCP", 8080) in ports(r) for r in ing): sys.exit("storefront: nema ingress pravila iz ingress-nginx na TCP 8080")
if not eg or any(not r.get("to") for r in eg): sys.exit("svako egress pravilo mora imati to (inače dozvoljava sve)")
for r in eg:
    for t in r["to"]:
        c = (t.get("ipBlock") or {}).get("cidr")
        if c and not c.endswith("/32"): sys.exit("egress ipBlock mora biti tačna adresa (/32), ne " + c)
alln = [(t, ports(r)) for r in eg for t in r["to"]]
if not any((t.get("podSelector") or {}).get("matchLabels") == {"app": "postgres"} and ("TCP", 5432) in p for t, p in alln): sys.exit("storefront: nema egress pravila prema app: postgres na TCP 5432")
if not any(("UDP", 53) in p and ("TCP", 53) in p and (t.get("namespaceSelector") or {}).get("matchLabels", {}).get("kubernetes.io/metadata.name") == "kube-system" for t, p in alln): sys.exit("storefront: nema egress pravila za DNS (kube-system, UDP i TCP 53)")
if not any((t.get("ipBlock") or {}).get("cidr") == "10.0.10.10/32" and ("TCP", 6443) in p for t, p in alln): sys.exit("storefront: nema egress pravila prema API serveru 10.0.10.10/32 na TCP 6443")
if len(pg) != 1 or "Ingress" not in pt(pg[0]): sys.exit("treba politika za app: postgres sa Ingress")
pin = pg[0]["spec"].get("ingress") or []
if not pin or any(not r.get("from") for r in pin) or not any(any((f.get("podSelector") or {}).get("matchLabels") == {"app": "storefront"} for f in r["from"]) and ("TCP", 5432) in ports(r) for r in pin): sys.exit("postgres: ingress samo iz app: storefront na TCP 5432")
EOF
python3 - /tmp/dep.jsonl <<'EOF' || exit 1
import json, sys
docs = [d for d in (json.loads(l) for l in open(sys.argv[1]) if l.strip()) if d]
dep = [d for d in docs if d.get("kind") == "Deployment" and d.get("metadata", {}).get("name") == "storefront" and d["metadata"].get("namespace") == "shop"]
if len(dep) != 1: sys.exit("treba Deployment storefront u namespaceu shop")
ps = dep[0]["spec"]["template"]["spec"]
if (dep[0]["spec"]["template"].get("metadata") or {}).get("labels", {}).get("app") != "storefront" or ps.get("serviceAccountName") != "storefront": sys.exit("zadrži labelu app: storefront i serviceAccountName storefront")
cs = ps.get("containers") or []
if not cs or any(c.get("image") != "registry.shop.local/shop/storefront:2.4.0" for c in cs): sys.exit("slika treba biti registry.shop.local/shop/storefront:2.4.0")
if ps.get("automountServiceAccountToken") is not False: sys.exit("automountServiceAccountToken: false nedostaje u spec poda")
psc = ps.get("securityContext") or {}
if psc.get("runAsNonRoot") is not True and not all((c.get("securityContext") or {}).get("runAsNonRoot") is True for c in cs): sys.exit("runAsNonRoot: true nedostaje")
if (psc.get("seccompProfile") or {}).get("type") != "RuntimeDefault" and not all(((c.get("securityContext") or {}).get("seccompProfile") or {}).get("type") == "RuntimeDefault" for c in cs): sys.exit("seccompProfile RuntimeDefault nedostaje")
vols = {v.get("name"): v for v in ps.get("volumes") or []}
for c in cs:
    sc = c.get("securityContext") or {}
    if sc.get("allowPrivilegeEscalation") is not False: sys.exit("allowPrivilegeEscalation: false nedostaje")
    if sc.get("readOnlyRootFilesystem") is not True: sys.exit("readOnlyRootFilesystem: true nedostaje")
    if "ALL" not in ((sc.get("capabilities") or {}).get("drop") or []): sys.exit("capabilities.drop: [ALL] nedostaje")
    if sc.get("privileged"): sys.exit("kontejner ne smije biti privilegovan")
    mounts = {m.get("mountPath"): m for m in c.get("volumeMounts") or []}
    if "/tmp" not in mounts or "emptyDir" not in vols.get(mounts["/tmp"].get("name"), {}): sys.exit("/tmp treba biti emptyDir volumen")
    m = mounts.get("/var/run/secrets/kubernetes.io/serviceaccount")
    if not m or m.get("readOnly") is not True: sys.exit("token se montira eksplicitno na /var/run/secrets/kubernetes.io/serviceaccount sa readOnly: true")
    src = (vols.get(m.get("name"), {}).get("projected") or {}).get("sources") or []
    tok = [s["serviceAccountToken"] for s in src if "serviceAccountToken" in s]
    if not tok or not 0 < int(tok[0].get("expirationSeconds", 0)) <= 3600: sys.exit("projected volumen treba serviceAccountToken sa expirationSeconds <= 3600")
EOF
-->
<!-- hint
Default-deny i DNS dio:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: shop
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
---
# ... u egress pravilima politike za storefront:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
```
Token volumen u Deploymentu:
```yaml
      volumes:
        - name: sa-token
          projected:
            sources:
              - serviceAccountToken: { path: token, expirationSeconds: 600 }
              - configMap: { name: kube-root-ca.crt, items: [{ key: ca.crt, path: ca.crt }] }
              - downwardAPI: { items: [{ path: namespace, fieldRef: { fieldPath: metadata.namespace } }] }
```
-->
<!-- solution
cat > /root/popravka/networkpolicy.yaml <<'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: shop
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: storefront
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: storefront
  policyTypes: ["Ingress", "Egress"]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - { protocol: TCP, port: 8080 }
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - { protocol: TCP, port: 5432 }
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
    - to:
        - ipBlock:
            cidr: 10.0.10.10/32
      ports:
        - { protocol: TCP, port: 6443 }
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes: ["Ingress"]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: storefront
      ports:
        - { protocol: TCP, port: 5432 }
EOF
cat > /root/popravka/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
  namespace: shop
  labels:
    app: storefront
spec:
  replicas: 2
  selector:
    matchLabels:
      app: storefront
  template:
    metadata:
      labels:
        app: storefront
    spec:
      serviceAccountName: storefront
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: storefront
          image: registry.shop.local/shop/storefront:2.4.0
          args: ["--spring.profiles.active=prod"]
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: postgres-credentials
            - secretRef:
                name: stripe-api-key
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: sa-token
              mountPath: /var/run/secrets/kubernetes.io/serviceaccount
              readOnly: true
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              memory: 1Gi
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 256Mi
        - name: sa-token
          projected:
            sources:
              - serviceAccountToken:
                  path: token
                  expirationSeconds: 600
              - configMap:
                  name: kube-root-ca.crt
                  items:
                    - key: ca.crt
                      path: ca.crt
              - downwardAPI:
                  items:
                    - path: namespace
                      fieldRef:
                        fieldPath: metadata.namespace
EOF
-->

## Vremenska linija i izvještaj

**`/root/izvjestaj/vremenska-linija.txt`**: najmanje 8 redova, svaki počinje UTC vremenom u obliku `2026-10-21THH:MM:SS`, pa razmak i opis; redovi poređani hronološki. Obavezno uključi (sa tačnom sekundom iz dokaza): prvi Falco alarm (eksploatacija), čitanje ServiceAccount tokena, pravljenje privilegovanog poda (audit) i prvu konekciju rudara prema poolu.

**`/root/izvjestaj/izvjestaj.md`**: kratak izvještaj sa najmanje četiri `## ` sekcije (npr. sažetak, vremenska linija, uzrok, obuzdavanje, iskorjenjivanje i oporavak, preporuke). Mora pomenuti:

- kompromitovani pod, CVE i binding koji je omogućio eskalaciju (`storefront-ops`),
- napadačev pod `node-debug-7f4c` i čvor `node01`,
- IP napadača i adresu mining poola,
- spisak za **rotaciju** (`postgres-credentials`, `stripe-api-key`, `payments-db`, ostale tajne iz `shop` koje je vratio `list`, token ServiceAccounta) i šta se radi sa čvorom `node01`,
- obuzdavanje i preporuke.

<!-- verify
f=/root/izvjestaj/vremenska-linija.txt
[ -s $f ] || { echo "nema $f"; exit 1; }
n=$(grep -cE '^2026-10-21T[0-9]{2}:[0-9]{2}:[0-9]{2}' $f)
[ "$n" -ge 8 ] || { echo "vremenska linija treba bar 8 redova koji počinju vremenom 2026-10-21THH:MM:SS (ima $n)"; exit 1; }
ts=$(grep -oE '^2026-10-21T[0-9]{2}:[0-9]{2}:[0-9]{2}' $f)
[ "$ts" = "$(echo "$ts" | sort)" ] || { echo "redovi vremenske linije nisu hronološki"; exit 1; }
for s in 02:13:06 02:14:40 02:19:12 02:21:09; do echo "$ts" | grep -q "T$s" || { echo "vremenska linija nema događaj u $s (provjeri ključne događaje)"; exit 1; }; done
r=/root/izvjestaj/izvjestaj.md
[ -s $r ] || { echo "nema $r"; exit 1; }
[ "$(grep -c '^## ' $r)" -ge 4 ] || { echo "izvještaj treba bar 4 sekcije (## )"; exit 1; }
for w in storefront-7d9c6b5f4-x2kqp CVE-2021-44228 storefront-ops node-debug-7f4c node01 203.0.113.189 198.51.100.142 postgres-credentials stripe-api-key payments-db; do grep -q -- "$w" $r || { echo "izvještaj ne pominje $w"; exit 1; }; done
grep -Eqi 'obuzdav|contain' $r || { echo "izvještaj nema obuzdavanje"; exit 1; }
grep -Eqi 'rotacij|rotira|rotat' $r || { echo "izvještaj nema rotaciju tajni"; exit 1; }
grep -Eqi 'token' $r || { echo "izvještaj ne pominje ServiceAccount token"; exit 1; }
grep -Eqi 'preporu|recommend' $r || { echo "izvještaj nema preporuke"; exit 1; }
-->
<!-- hint
Vremensku liniju možeš napraviti spajanjem oba izvora:
```bash
{ jq -r 'select(.output_fields."k8s.ns.name"=="shop" or .output_fields."k8s.ns.name"=="kube-system") | "\(.time[0:19]) falco \(.hostname): \(.rule) (\(.output_fields."k8s.pod.name"))"' /root/falco/falco-alerts.jsonl
  jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and (.userAgent|startswith("fabric8")|not)) | "\(.requestReceivedTimestamp[0:19]) audit: \(.verb) \(.objectRef.resource) \(.objectRef.namespace // "")/\(.objectRef.name // "") -> \(.responseStatus.code)"' /root/audit/audit.log
} | sort
```
Zatim izbaci šum i preformuliši redove u rečenice.
-->
<!-- solution
cat > /root/izvjestaj/vremenska-linija.txt <<'EOF'
2026-10-21T02:13:06 Log4Shell (CVE-2021-44228): java u storefront-7d9c6b5f4-x2kqp se povezuje na 203.0.113.189:1389 (Falco)
2026-10-21T02:13:07 Reverzni shell iz java procesa prema 203.0.113.189:4444 (Falco)
2026-10-21T02:14:12 Interaktivni shell (bash preko python3 pty) u podu (Falco)
2026-10-21T02:14:40 Čitanje ServiceAccount tokena storefront (Falco)
2026-10-21T02:15:01 Prvi API zahtjev sa ukradenim tokenom: list pods u shop (audit)
2026-10-21T02:16:40 Preuzet i pokrenut kubectl u /tmp (Falco)
2026-10-21T02:17:10 Pročitane tajne shop/postgres-credentials, shop/stripe-api-key, payments/payments-db (audit)
2026-10-21T02:18:21 Pokušaj ClusterRoleBindinga storefront-admin, odbijeno 403 (audit)
2026-10-21T02:19:12 Napravljen privilegovani pod kube-system/node-debug-7f4c na node01, hostPath / (audit)
2026-10-21T02:19:47 kubectl exec u node-debug-7f4c (audit)
2026-10-21T02:20:31 Cron perzistencija na node01 (Falco)
2026-10-21T02:21:09 Rudar kswapd0 se povezuje na pool 198.51.100.142:3333 (Falco)
EOF
sed 's/^@@ /## /' > /root/izvjestaj/izvjestaj.md <<'EOF'
# Izvještaj: kompromitacija klastera shop-prod

@@ Sažetak
Napadač je iskoristio Log4Shell (CVE-2021-44228) u slici storefront:2.3.1 i dobio shell u podu storefront-7d9c6b5f4-x2kqp. ServiceAccount token tog poda imao je preširoka prava preko ClusterRoleBinding storefront-ops, pa je napadač pročitao tajne i napravio privilegovani pod node-debug-7f4c na čvoru node01, odakle je pokrenuo rudara.

@@ Vremenska linija
Vidi vremenska-linija.txt. Ulaz 02:13:06 sa 203.0.113.189, rudar od 02:21:09 prema 198.51.100.142:3333.

@@ Uzrok
- Ranjiva biblioteka log4j-core 2.14.1 u javno izloženoj aplikaciji, kontejner radi kao root
- ClusterRoleBinding storefront-ops: pods create, pods/exec, secrets get/list u cijelom klasteru
- Automatski montiran token, bez NetworkPolicy za izlazni saobraćaj

@@ Obuzdavanje
- Obrisan ClusterRoleBinding storefront-ops, default-deny NetworkPolicy u shop, egress blok prema 203.0.113.189 i 198.51.100.142
- Pod storefront-7d9c6b5f4-x2kqp izolovan (labela uklonjena), dokazi prikupljeni, zatim obrisan (token vezan za pod postaje nevažeći)
- node01 cordon i drain, snapshot diska, pod node-debug-7f4c obrisan

@@ Iskorjenjivanje i oporavak
- Rotacija: postgres-credentials, stripe-api-key, payments-db, ostale tajne iz shop (registry-pull, shop-tls) jer ih je vratio list, ServiceAccount token storefront
- node01 se ponovo gradi iz čiste slike (root na hostu, cron perzistencija, /etc/shadow)
- Deploy storefront:2.4.0 sa hardened securityContext i Role sa najmanjim privilegijama

@@ Preporuke
- Trivy gate u CI za CRITICAL nalaze u KEV katalogu
- Pod Security Admission restricted za aplikacijske namespaceove, i Kyverno/VAP zabrana privilegovanih podova svuda osim izuzetaka
- Alarm na audit događaje: create pods sa privileged/hostPath, get secrets iz ServiceAccounta aplikacija
EOF
-->
