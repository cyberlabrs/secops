# Lab 1: Investigating a compromised cluster

At 02:21 UTC the on-call engineer at Shop d.o.o. receives a Falco alert **Detect crypto miners using the Stratum protocol** from node `node01`. The cluster is in production: the public web shop `storefront` in namespace `shop`, payments in `payments`. Your task is to reconstruct the attack from the preserved evidence, find the configuration that made it possible, write the fixes and the report.

There is no cluster and no `kubectl` in this lab: you work as an investigator over exported evidence, with `jq` and `yq`.

| Path | Contents |
|---|---|
| `/root/falco/falco-alerts.jsonl` | Falco alerts from all three worker nodes (JSON per line) |
| `/root/audit/audit.log` | Kubernetes audit log 01:30–03:00 UTC (JSON per line, with the usual noise from controllers and kubelets) |
| `/root/manifesti/` | Deployment, RBAC and Namespace manifests from the git repo |
| `/root/skeniranje/trivy-storefront-2.3.1.json` | Trivy report for the image running in production |
| `/root/inventar/` | Snapshot of `kubectl get pods -A -o wide` and `kubectl get secrets -A` taken at 02:40 |

Write answers to `/root/odgovori/` (answers), fixes to `/root/popravka/` (fixes) and the report to `/root/izvjestaj/` (report). Every answer file holds one value per line, with no extra text.

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

## Falco alert triage

The miner alert is the end of the story, not the beginning. Find the Pod in which the attacker **first** got code execution: the chain of alerts (outbound connection, redirected stdin/stdout, shell with a terminal, token read) comes from a single Pod. Watch out for noise: the shell in `payments` at 01:55 is planned maintenance, and the `ci` and `ops` alerts repeat every day.

Write:

- `/root/odgovori/pod.txt`: the name of that Pod (e.g. `pod-name`, without the namespace),
- `/root/odgovori/prvi-alarm.txt`: the time of the **first** Falco alert for that Pod, exactly as in the `time` field (ISO 8601, UTC),
- `/root/odgovori/ip-napadaca.txt`: the public IP address of the attacker's server that the Pod connected to first.

<!-- verify
o=/root/odgovori
[ "$(tr -d ' \r\n' < $o/pod.txt 2>/dev/null | sed 's#^shop/##')" = "storefront-7d9c6b5f4-x2kqp" ] || { echo "pod.txt: that is not the Pod where the attack started"; exit 1; }
grep -q '^2026-10-21T02:13:06' $o/prvi-alarm.txt 2>/dev/null || { echo "prvi-alarm.txt: that is not the time of the first alert for that Pod (time field)"; exit 1; }
[ "$(tr -d ' \r\n' < $o/ip-napadaca.txt 2>/dev/null)" = "203.0.113.189" ] || { echo "ip-napadaca.txt: wrong address"; exit 1; }
-->
<!-- hint
```bash
cd /root/falco
jq -r '[.time, .priority, .rule, .output_fields."k8s.ns.name", .output_fields."k8s.pod.name"] | @tsv' falco-alerts.jsonl
jq -r 'select(.output_fields."k8s.pod.name"=="<pod>") | [.time, .rule, .output_fields."fd.name" // .output_fields."proc.cmdline"] | @tsv' falco-alerts.jsonl
```
The `fd.name` field in an outbound connection alert has the form `source:port->destination:port`. Port 1389 is common for malicious LDAP servers in Log4Shell attacks.
-->
<!-- solution
jq -r 'select(.output_fields."k8s.ns.name"=="shop" and .rule=="Terminal shell in container") | .output_fields."k8s.pod.name"' /root/falco/falco-alerts.jsonl | head -1 > /root/odgovori/pod.txt
p=$(cat /root/odgovori/pod.txt)
jq -r --arg p "$p" 'select(.output_fields."k8s.pod.name"==$p) | .time' /root/falco/falco-alerts.jsonl | sort | head -1 > /root/odgovori/prvi-alarm.txt
jq -r --arg p "$p" 'select(.output_fields."k8s.pod.name"==$p and .rule=="Unexpected outbound connection") | .output_fields."fd.name"' /root/falco/falco-alerts.jsonl | head -1 | sed 's/.*->//; s/:.*//' > /root/odgovori/ip-napadaca.txt
-->

## Entry point: the vulnerable image

The compromised Pod runs the image from `manifesti/storefront-deployment.yaml`. Its Trivy report has several critical findings, but only one matches what Falco saw: a `java` process connecting on its own to the attacker's LDAP port.

Write:

- `/root/odgovori/cve.txt`: the CVE of the vulnerability exploited for entry (the one with CVSS v3 score 10.0),
- `/root/odgovori/log4j-verzija.txt`: the lowest `log4j-core` version in the 2.x line (not 2.12.x or 2.3.x) that fixes **all** `log4j-core` findings in the report.

Also think about why `zlib1g` CVE-2023-45853, although `CRITICAL` and 9.8, is not the priority for this image.

<!-- verify
o=/root/odgovori
[ "$(tr -d ' \r\n' < $o/cve.txt 2>/dev/null | tr a-z A-Z)" = "CVE-2021-44228" ] || { echo "cve.txt: wrong CVE"; exit 1; }
[ "$(tr -d ' \r\n' < $o/log4j-verzija.txt 2>/dev/null)" = "2.17.1" ] || { echo "log4j-verzija.txt: wrong version (look at FixedVersion of all log4j-core findings)"; exit 1; }
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

## Audit log: what the ServiceAccount did

Falco says the attacker read the ServiceAccount token and contacted the API server. The audit log says **what** they did with that token. The application itself uses the same ServiceAccount (`system:serviceaccount:shop:storefront`): every 5 minutes it reads its ConfigMap with the `fabric8-kubernetes-client` client.

Save to `/root/odgovori/sa-zahtjevi.tsv` all requests of that ServiceAccount **that did not come from the application** (userAgent does not start with `fabric8`), in log order, one request per line, columns separated by tabs (`@tsv`):

1. `requestReceivedTimestamp`
2. `verb`
3. the resource, or `resource/subresource` when there is a subresource (e.g. `pods/exec`)
4. `objectRef.namespace` (empty if missing)
5. `objectRef.name` (empty if missing)
6. `responseStatus.code`

Also look at `user.extra` in those records: which Pod does the token come from, and from which IP address did the requests arrive?

<!-- verify
f=/root/odgovori/sa-zahtjevi.tsv
[ -s $f ] || { echo "missing $f"; exit 1; }
ref=$(jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and (.userAgent|startswith("fabric8")|not)) | [.requestReceivedTimestamp, .verb, (.objectRef.resource + (if .objectRef.subresource then "/" + .objectRef.subresource else "" end)), .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' /root/audit/audit.log)
got=$(tr -d '\r' < $f)
[ "$(echo "$got" | wc -l)" -eq "$(echo "$ref" | wc -l)" ] || { echo "wrong number of lines: you have $(echo "$got" | wc -l), expected $(echo "$ref" | wc -l)"; exit 1; }
[ "$got" = "$ref" ] || { echo "content differs from the expected output (order, columns or tabs)"; exit 1; }
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
`@tsv` turns `null` into an empty field, so `// ""` is not needed.
-->
<!-- solution
jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and (.userAgent|startswith("fabric8")|not)) | [.requestReceivedTimestamp, .verb, (.objectRef.resource + (if .objectRef.subresource then "/" + .objectRef.subresource else "" end)), .objectRef.namespace, .objectRef.name, .responseStatus.code] | @tsv' /root/audit/audit.log > /root/odgovori/sa-zahtjevi.tsv
-->

## Secrets and the privileged Pod

From the same records, extract the damage:

- `/root/odgovori/tajne.txt`: the Secrets the attacker read individually (`get` on `secrets`, successful), as `namespace/name`, one per line,
- `/root/odgovori/zlonamjerni-pod.txt`: the Pod the attacker created, as `namespace/name`,
- `/root/odgovori/cvor.txt`: the node that Pod runs on,
- `/root/odgovori/pod-spec.json`: the complete `requestObject` of the request that created the Pod (valid JSON).

Look at the spec: what do `privileged`, `hostPID`, `hostNetwork` and a `hostPath` with path `/` give it? Why does the request for that Pod have no matching `pods/binding` from `kube-scheduler`? And what did the attacker get with the `list secrets` request in `shop`, even though they did not ask for any Secret there by name?

<!-- verify
o=/root/odgovori
A=/root/audit/audit.log
want=$(printf 'payments/payments-db\nshop/postgres-credentials\nshop/stripe-api-key')
[ "$(tr -d ' \r' < $o/tajne.txt 2>/dev/null | grep -v '^$' | sort -u)" = "$want" ] || { echo "tajne.txt: the list of Secrets is not correct"; exit 1; }
[ "$(tr -d ' \r\n' < $o/zlonamjerni-pod.txt 2>/dev/null)" = "kube-system/node-debug-7f4c" ] || { echo "zlonamjerni-pod.txt: wrong Pod (format namespace/name)"; exit 1; }
[ "$(tr -d ' \r\n' < $o/cvor.txt 2>/dev/null)" = "node01" ] || { echo "cvor.txt: wrong node"; exit 1; }
jq -e . $o/pod-spec.json >/dev/null 2>&1 || { echo "pod-spec.json is missing or not valid JSON"; exit 1; }
ref=$(jq -S -c 'select(.verb=="create" and .objectRef.resource=="pods" and .requestObject != null and .objectRef.name=="node-debug-7f4c") | .requestObject' $A)
[ "$(jq -S -c . $o/pod-spec.json)" = "$ref" ] || { echo "pod-spec.json is not the requestObject of the request that created the Pod"; exit 1; }
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
A `spec.nodeName` set directly in the manifest bypasses the scheduler.
-->
<!-- solution
A=/root/audit/audit.log
jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and .objectRef.resource=="secrets" and .verb=="get" and .responseStatus.code==200) | "\(.objectRef.namespace)/\(.objectRef.name)"' $A > /root/odgovori/tajne.txt
jq 'select(.user.username=="system:serviceaccount:shop:storefront" and .verb=="create" and .objectRef.resource=="pods" and .objectRef.subresource==null) | .requestObject' $A > /root/odgovori/pod-spec.json
jq -r '"\(.metadata.namespace)/\(.metadata.name)"' /root/odgovori/pod-spec.json > /root/odgovori/zlonamjerni-pod.txt
jq -r '.spec.nodeName' /root/odgovori/pod-spec.json > /root/odgovori/cvor.txt
-->

## The RBAC that made the attack possible

The `authorization.k8s.io/reason` annotation in audit records says which binding allowed each request. Find it in `manifesti/rbac.yaml`.

1. Write the kind and name of that binding to `/root/odgovori/binding.txt` as `Kind/name` (e.g. `RoleBinding/something`).
2. Write `/root/popravka/rbac.yaml` with a least-privilege fix. The application needs only what it actually used in the audit log (requests from the `fabric8` client):
   - one `Role` in namespace `shop` that allows only `get` on `configmaps`, restricted with `resourceNames` to the ConfigMap the application reads,
   - one `RoleBinding` in `shop` that grants that `Role` to the ServiceAccount `storefront` from `shop`,
   - no `ClusterRole` or `ClusterRoleBinding` documents and no `*`.

Check the file with `yq`, e.g. `yq -o=json '.' /root/popravka/rbac.yaml`.

<!-- verify
o=/root/odgovori
b=$(tr -d ' \r\n' < $o/binding.txt 2>/dev/null)
[ "$b" = "ClusterRoleBinding/storefront-ops" ] || { echo "binding.txt: expected Kind/name of the binding that allowed the attack"; exit 1; }
f=/root/popravka/rbac.yaml
[ -s $f ] || { echo "missing $f"; exit 1; }
yq -o=json -I=0 '.' $f > /tmp/rbac.jsonl 2>/dev/null || { echo "rbac.yaml is not valid YAML"; exit 1; }
python3 - /tmp/rbac.jsonl <<'EOF' || exit 1
import json, sys
docs = [d for d in (json.loads(l) for l in open(sys.argv[1]) if l.strip()) if d]
kinds = [d.get("kind") for d in docs]
if any(k in ("ClusterRole", "ClusterRoleBinding") for k in kinds): sys.exit("rbac.yaml must not contain a ClusterRole or ClusterRoleBinding")
roles = [d for d in docs if d.get("kind") == "Role"]
rbs = [d for d in docs if d.get("kind") == "RoleBinding"]
if len(roles) != 1 or len(rbs) != 1: sys.exit("exactly one Role and one RoleBinding are needed")
r, rb = roles[0], rbs[0]
if r.get("metadata", {}).get("namespace") != "shop" or rb.get("metadata", {}).get("namespace") != "shop": sys.exit("Role and RoleBinding must be in namespace shop")
rules = r.get("rules") or []
if not rules: sys.exit("the Role has no rules")
for ru in rules:
    if "*" in json.dumps(ru): sys.exit("rules must not contain *")
    if set(ru.get("resources") or []) != {"configmaps"}: sys.exit("the Role may allow only the configmaps resource")
    if (ru.get("apiGroups") or [None]) != [""]: sys.exit("configmaps are in the core API group: apiGroups: [\"\"]")
    if set(ru.get("verbs") or []) != {"get"}: sys.exit("the only allowed verb is get")
    if (ru.get("resourceNames") or []) != ["storefront-config"]: sys.exit("restrict resourceNames to the ConfigMap the application reads")
ref = rb.get("roleRef") or {}
if ref.get("kind") != "Role" or ref.get("name") != r.get("metadata", {}).get("name"): sys.exit("the RoleBinding roleRef must point to your Role")
subs = rb.get("subjects") or []
if len(subs) != 1 or subs[0].get("kind") != "ServiceAccount" or subs[0].get("name") != "storefront" or subs[0].get("namespace") != "shop": sys.exit("the only subject must be ServiceAccount storefront from shop")
EOF
-->
<!-- hint
```bash
jq -r '.annotations."authorization.k8s.io/reason"' /root/audit/audit.log | sort | uniq -c | grep storefront
jq -r 'select(.userAgent|startswith("fabric8")) | [.verb, .objectRef.resource, .objectRef.name] | @tsv' /root/audit/audit.log | sort | uniq -c
```
Skeleton:
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

## NetworkPolicy and Deployment hardening

Two manifests, one for containment and one for the new version:

**`/root/popravka/networkpolicy.yaml`** (everything in namespace `shop`; `newsletter` gets its own policy from its team):

- `default-deny`: `podSelector: {}`, `policyTypes` `Ingress` and `Egress`, with no rules at all,
- a policy for `app: storefront`: ingress only from namespace `ingress-nginx` (`namespaceSelector` on the `kubernetes.io/metadata.name` label) on TCP 8080; egress only to `app: postgres` Pods on TCP 5432, to `kube-dns` in `kube-system` on port 53 (UDP and TCP) and to the API server `10.0.10.10/32` on TCP 6443 (the application still reads its ConfigMap; NetworkPolicy sees the address after the DNAT of the `10.96.0.1:443` Service),
- a policy for `app: postgres`: ingress only from `app: storefront` Pods on TCP 5432.

No egress rule may lack `to`, or allow `0.0.0.0/0`.

**`/root/popravka/deployment.yaml`**: a copy of `manifesti/storefront-deployment.yaml` with:

- the image `registry.shop.local/shop/storefront:2.4.0` (contains `log4j-core` 2.17.1),
- `automountServiceAccountToken: false` in the Pod spec; the token is mounted explicitly with a `projected` volume containing `serviceAccountToken` (`expirationSeconds` at most 3600), `configMap` `kube-root-ca.crt` and `downwardAPI` for the namespace, at `/var/run/secrets/kubernetes.io/serviceaccount` with `readOnly: true`,
- Pod `securityContext`: `runAsNonRoot: true`, `runAsUser: 10001`, `seccompProfile.type: RuntimeDefault`,
- container `securityContext`: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`,
- an `emptyDir` volume mounted at `/tmp` (Java and Spring write temporary files).

<!-- verify
for f in /root/popravka/networkpolicy.yaml /root/popravka/deployment.yaml; do [ -s $f ] || { echo "missing $f"; exit 1; }; done
yq -o=json -I=0 '.' /root/popravka/networkpolicy.yaml > /tmp/np.jsonl 2>/dev/null || { echo "networkpolicy.yaml is not valid YAML"; exit 1; }
yq -o=json -I=0 '.' /root/popravka/deployment.yaml > /tmp/dep.jsonl 2>/dev/null || { echo "deployment.yaml is not valid YAML"; exit 1; }
python3 - /tmp/np.jsonl <<'EOF' || exit 1
import json, sys
docs = [d for d in (json.loads(l) for l in open(sys.argv[1]) if l.strip()) if d]
if not docs or any(d.get("kind") != "NetworkPolicy" or d.get("metadata", {}).get("namespace") != "shop" for d in docs): sys.exit("all documents must be NetworkPolicies in namespace shop")
sel = lambda d: (d.get("spec", {}).get("podSelector") or {}).get("matchLabels") or {}
pt = lambda d: set(d.get("spec", {}).get("policyTypes") or [])
def ports(rule): return {(p.get("protocol", "TCP"), p.get("port")) for p in rule.get("ports") or []}
deny = [d for d in docs if not sel(d) and not (d["spec"].get("podSelector") or {}).get("matchExpressions")]
if not any(pt(d) == {"Ingress", "Egress"} and not d["spec"].get("ingress") and not d["spec"].get("egress") for d in deny): sys.exit("no default-deny policy (podSelector {}, Ingress and Egress, no rules)")
sf = [d for d in docs if sel(d) == {"app": "storefront"}]
pg = [d for d in docs if sel(d) == {"app": "postgres"}]
if len(sf) != 1 or not {"Ingress", "Egress"} <= pt(sf[0]): sys.exit("one policy for app: storefront with Ingress and Egress is needed")
s = sf[0]["spec"]
ing, eg = s.get("ingress") or [], s.get("egress") or []
if not ing or any(not r.get("from") for r in ing): sys.exit("every storefront ingress rule must have from")
if not any(any((f.get("namespaceSelector") or {}).get("matchLabels", {}).get("kubernetes.io/metadata.name") == "ingress-nginx" for f in r["from"]) and ("TCP", 8080) in ports(r) for r in ing): sys.exit("storefront: no ingress rule from ingress-nginx on TCP 8080")
if not eg or any(not r.get("to") for r in eg): sys.exit("every egress rule must have to (otherwise it allows everything)")
for r in eg:
    for t in r["to"]:
        c = (t.get("ipBlock") or {}).get("cidr")
        if c and not c.endswith("/32"): sys.exit("egress ipBlock must be an exact address (/32), not " + c)
alln = [(t, ports(r)) for r in eg for t in r["to"]]
if not any((t.get("podSelector") or {}).get("matchLabels") == {"app": "postgres"} and ("TCP", 5432) in p for t, p in alln): sys.exit("storefront: no egress rule to app: postgres on TCP 5432")
if not any(("UDP", 53) in p and ("TCP", 53) in p and (t.get("namespaceSelector") or {}).get("matchLabels", {}).get("kubernetes.io/metadata.name") == "kube-system" for t, p in alln): sys.exit("storefront: no egress rule for DNS (kube-system, UDP and TCP 53)")
if not any((t.get("ipBlock") or {}).get("cidr") == "10.0.10.10/32" and ("TCP", 6443) in p for t, p in alln): sys.exit("storefront: no egress rule to the API server 10.0.10.10/32 on TCP 6443")
if len(pg) != 1 or "Ingress" not in pt(pg[0]): sys.exit("a policy for app: postgres with Ingress is needed")
pin = pg[0]["spec"].get("ingress") or []
if not pin or any(not r.get("from") for r in pin) or not any(any((f.get("podSelector") or {}).get("matchLabels") == {"app": "storefront"} for f in r["from"]) and ("TCP", 5432) in ports(r) for r in pin): sys.exit("postgres: ingress only from app: storefront on TCP 5432")
EOF
python3 - /tmp/dep.jsonl <<'EOF' || exit 1
import json, sys
docs = [d for d in (json.loads(l) for l in open(sys.argv[1]) if l.strip()) if d]
dep = [d for d in docs if d.get("kind") == "Deployment" and d.get("metadata", {}).get("name") == "storefront" and d["metadata"].get("namespace") == "shop"]
if len(dep) != 1: sys.exit("Deployment storefront in namespace shop is needed")
ps = dep[0]["spec"]["template"]["spec"]
if (dep[0]["spec"]["template"].get("metadata") or {}).get("labels", {}).get("app") != "storefront" or ps.get("serviceAccountName") != "storefront": sys.exit("keep the label app: storefront and serviceAccountName storefront")
cs = ps.get("containers") or []
if not cs or any(c.get("image") != "registry.shop.local/shop/storefront:2.4.0" for c in cs): sys.exit("the image must be registry.shop.local/shop/storefront:2.4.0")
if ps.get("automountServiceAccountToken") is not False: sys.exit("automountServiceAccountToken: false is missing in the Pod spec")
psc = ps.get("securityContext") or {}
if psc.get("runAsNonRoot") is not True and not all((c.get("securityContext") or {}).get("runAsNonRoot") is True for c in cs): sys.exit("runAsNonRoot: true is missing")
if (psc.get("seccompProfile") or {}).get("type") != "RuntimeDefault" and not all(((c.get("securityContext") or {}).get("seccompProfile") or {}).get("type") == "RuntimeDefault" for c in cs): sys.exit("seccompProfile RuntimeDefault is missing")
vols = {v.get("name"): v for v in ps.get("volumes") or []}
for c in cs:
    sc = c.get("securityContext") or {}
    if sc.get("allowPrivilegeEscalation") is not False: sys.exit("allowPrivilegeEscalation: false is missing")
    if sc.get("readOnlyRootFilesystem") is not True: sys.exit("readOnlyRootFilesystem: true is missing")
    if "ALL" not in ((sc.get("capabilities") or {}).get("drop") or []): sys.exit("capabilities.drop: [ALL] is missing")
    if sc.get("privileged"): sys.exit("the container must not be privileged")
    mounts = {m.get("mountPath"): m for m in c.get("volumeMounts") or []}
    if "/tmp" not in mounts or "emptyDir" not in vols.get(mounts["/tmp"].get("name"), {}): sys.exit("/tmp must be an emptyDir volume")
    m = mounts.get("/var/run/secrets/kubernetes.io/serviceaccount")
    if not m or m.get("readOnly") is not True: sys.exit("mount the token explicitly at /var/run/secrets/kubernetes.io/serviceaccount with readOnly: true")
    src = (vols.get(m.get("name"), {}).get("projected") or {}).get("sources") or []
    tok = [s["serviceAccountToken"] for s in src if "serviceAccountToken" in s]
    if not tok or not 0 < int(tok[0].get("expirationSeconds", 0)) <= 3600: sys.exit("the projected volume needs serviceAccountToken with expirationSeconds <= 3600")
EOF
-->
<!-- hint
Default-deny and the DNS part:
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
# ... in the egress rules of the storefront policy:
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
The token volume in the Deployment:
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

## Timeline and report

**`/root/izvjestaj/vremenska-linija.txt`** (timeline): at least 8 lines, each starting with a UTC time in the form `2026-10-21THH:MM:SS`, then a space and a description; lines in chronological order. You must include (with the exact second from the evidence): the first Falco alert (exploitation), the ServiceAccount token read, the creation of the privileged Pod (audit) and the miner's first connection to the pool.

**`/root/izvjestaj/izvjestaj.md`** (report): a short report with at least four `## ` sections (e.g. summary, timeline, root cause, containment, eradication and recovery, recommendations). It must mention:

- the compromised Pod, the CVE and the binding that enabled the escalation (`storefront-ops`),
- the attacker's Pod `node-debug-7f4c` and node `node01`,
- the attacker's IP and the mining pool address,
- a **rotation** list (`postgres-credentials`, `stripe-api-key`, `payments-db`, the other Secrets in `shop` returned by `list`, the ServiceAccount token) and what happens to node `node01`,
- containment and recommendations.

<!-- verify
f=/root/izvjestaj/vremenska-linija.txt
[ -s $f ] || { echo "missing $f"; exit 1; }
n=$(grep -cE '^2026-10-21T[0-9]{2}:[0-9]{2}:[0-9]{2}' $f)
[ "$n" -ge 8 ] || { echo "the timeline needs at least 8 lines starting with a 2026-10-21THH:MM:SS time (has $n)"; exit 1; }
ts=$(grep -oE '^2026-10-21T[0-9]{2}:[0-9]{2}:[0-9]{2}' $f)
[ "$ts" = "$(echo "$ts" | sort)" ] || { echo "timeline lines are not in chronological order"; exit 1; }
for s in 02:13:06 02:14:40 02:19:12 02:21:09; do echo "$ts" | grep -q "T$s" || { echo "the timeline has no event at $s (check the key events)"; exit 1; }; done
r=/root/izvjestaj/izvjestaj.md
[ -s $r ] || { echo "missing $r"; exit 1; }
[ "$(grep -c '^## ' $r)" -ge 4 ] || { echo "the report needs at least 4 sections (## )"; exit 1; }
for w in storefront-7d9c6b5f4-x2kqp CVE-2021-44228 storefront-ops node-debug-7f4c node01 203.0.113.189 198.51.100.142 postgres-credentials stripe-api-key payments-db; do grep -q -- "$w" $r || { echo "the report does not mention $w"; exit 1; }; done
grep -Eqi 'obuzdav|contain' $r || { echo "the report has no containment"; exit 1; }
grep -Eqi 'rotacij|rotira|rotat' $r || { echo "the report has no secret rotation"; exit 1; }
grep -Eqi 'token' $r || { echo "the report does not mention the ServiceAccount token"; exit 1; }
grep -Eqi 'preporu|recommend' $r || { echo "the report has no recommendations"; exit 1; }
-->
<!-- hint
You can build the timeline by merging both sources:
```bash
{ jq -r 'select(.output_fields."k8s.ns.name"=="shop" or .output_fields."k8s.ns.name"=="kube-system") | "\(.time[0:19]) falco \(.hostname): \(.rule) (\(.output_fields."k8s.pod.name"))"' /root/falco/falco-alerts.jsonl
  jq -r 'select(.user.username=="system:serviceaccount:shop:storefront" and (.userAgent|startswith("fabric8")|not)) | "\(.requestReceivedTimestamp[0:19]) audit: \(.verb) \(.objectRef.resource) \(.objectRef.namespace // "")/\(.objectRef.name // "") -> \(.responseStatus.code)"' /root/audit/audit.log
} | sort
```
Then drop the noise and rewrite the lines as sentences.
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
