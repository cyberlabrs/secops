## Kako izgleda CKS ispit

CKS je, kao i CKA, **praktičan** ispit: udaljeni Linux desktop, terminal, browser sa dozvoljenom dokumentacijom i više klastera. Uslov za izlazak je položen CKA.

| | |
|---|---|
| Trajanje | 2 sata |
| Broj zadataka | obično 15–20, različitih težina |
| Prolaz | 67% |
| Verzija | Kubernetes v1.35 (oktobar 2026) |
| Dokumentacija | kubernetes.io i dokumentacija alata iz kurikuluma (npr. Falco, Trivy, AppArmor, etcd); tačnu listu provjeri u „Important Instructions: CKS“ |
| Ponovni pokušaj | jedan besplatan retake |
| Simulator | dvije sesije na killer.sh uz kupljen ispit |

Sve što važi za CKA važi i ovdje: prvo kontekst ili `ssh` iz zadatka, imperativne komande, preskakanje teških zadataka i provjera rezultata na kraju (vidi lekciju „Probni ispit“ u CKA kursu).

## Šta je drugačije u odnosu na CKA

CKS zadaci češće traže **izmjene na čvorovima i u kontrolnoj ravni**, gdje greška može srušiti API server:

- izmjene manifesta kube-apiservera (audit, encryption, admission pluginovi, ImagePolicyWebhook),
- konfiguraciju kubeleta (`/var/lib/kubelet/config.yaml`),
- AppArmor profile, seccomp profile i Falco pravila na konkretnom čvoru.

> **Na ispitu:** prije izmjene `kube-apiserver.yaml` napravi kopiju **van** `/etc/kubernetes/manifests/` (npr. `cp … /root/kube-apiserver.yaml.bak`). Ako API server ne proradi za 1–2 minute, prvo pogledaj `crictl ps -a | grep apiserver` i `crictl logs <id>`, a ne `kubectl`, jer on tada ne radi.

## Brza provjera API servera poslije izmjene

```bash
watch crictl ps                      # kube-apiserver mora preći u Running
crictl logs $(crictl ps -a --name kube-apiserver -q | head -1) 2>&1 | tail -20
journalctl -u kubelet --since "5 min ago" | grep -i apiserver
kubectl get --raw='/readyz?verbose' | tail -5
```

Tipične greške: flag bez volumena (fajl ne postoji u kontejneru), pogrešan `hostPath.type`, YAML uvlaka, pogrešan `apiVersion` u config fajlu (audit, encryption, admission).

## Alati koje moraš znati bez razmišljanja

| Alat | Najčešća komanda |
|---|---|
| kube-bench | `kube-bench run --targets master --check 1.2.15` |
| Trivy | `trivy image --severity HIGH,CRITICAL <slika>` |
| AppArmor | `apparmor_parser -q /etc/apparmor.d/<profil>`, `aa-status` |
| seccomp | profil u `/var/lib/kubelet/seccomp/…`, `seccompProfile.type: Localhost` |
| Falco | `journalctl -u falco`, `/etc/falco/falco_rules.local.yaml`, `systemctl restart falco` |
| etcd | `etcdctl get /registry/secrets/<ns>/<ime>` sa certifikatima |
| audit | `jq 'select(.objectRef.resource=="secrets")' audit.log` |
| crictl | `crictl ps`, `crictl inspect <id>`, `crictl logs <id>` |

## Probni ispit u ovom kursu

Lab „Probni ispit“ ima 16 zadataka iz svih šest domena i odbrojavanje od 120 minuta. Sve je na jednom klasteru (`controlplane` + `node01`); procenat uz zadatak je njegova težina. Dva zadatka mijenjaju kube-apiserver: uradi ih pažljivo, jer pokvaren API server blokira sve ostale zadatke.

## Rezime

- CKS: 2 sata, 15–20 praktičnih zadataka, prolaz 67%, uslov CKA.
- Više zadataka mijenja čvorove i kontrolnu ravan; uvijek napravi backup manifesta van `manifests/` direktorija.
- Kad API server ne radi, dijagnostika ide preko `crictl` i `journalctl`, ne `kubectl`.
- AppArmor i seccomp profili i Falco pravila važe samo na čvoru na kome su podešeni.
- Na kraju provjeri efekat (Pod zaista odbijen, port zaista zatvoren, alarm zaista u logu), ne samo da je komanda prošla.
