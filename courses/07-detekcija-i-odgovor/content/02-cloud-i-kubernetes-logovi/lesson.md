## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 4:

- **4.2** Istraga AWS aktivnosti iz **CloudTraila**: kompromitovani kredencijali, perzistencija, izbjegavanje odbrane.
- **4.3** Istraga **Kubernetes audit** logova: zloupotreba tokena, `exec`, privilegovana opterećenja, pristup tajnama.

U modulu 01 si vidio koje pitanje svaki izvor pokriva. Ovdje ih koristiš kao istražitelj: dobiješ alarm ili dojavu („ključ je procurio“, „pod se čudno ponaša“) i iz loga rekonstruišeš ko je šta uradio, kojim redom i sa kojim kredencijalima.

U praksi CloudTrail dobijaš iz S3 bucketa traila (ili iz CloudTrail Lake / SIEM-a), a Kubernetes audit iz fajla na kontrolnoj ravni ili od cloud provajdera (EKS, AKS, GKE). Komande ispod koriste dvije promjenljive koje postaviš na svoje izvoze:

```bash
CT=cloudtrail.json      # CloudTrail zapisi
AUDIT=audit.log         # Kubernetes audit, JSON po liniji
```

CloudTrail fajl iz S3 ima oblik `{"Records":[ ... ]}`, a izvoz iz alata često je jedan događaj po liniji. Filter `.Records[]? // .` radi u oba slučaja, pa ga koristimo svuda:

```bash
ct() { jq -c '.Records[]? // .' "$CT"; }      # svaki događaj kao jedna JSON linija
ct | wc -l
```

## CloudTrail zapis, polje po polje

Skraćen, ali realan zapis poziva `CreateAccessKey`:

```json
{
  "eventVersion": "1.11",
  "userIdentity": {
    "type": "IAMUser",
    "principalId": "AIDAEXAMPLE7QZ3",
    "arn": "arn:aws:iam::111122223333:user/ci-deploy",
    "accountId": "111122223333",
    "accessKeyId": "AKIAEXAMPLECIDEPLOY1",
    "userName": "ci-deploy"
  },
  "eventTime": "2026-10-14T22:41:07Z",
  "eventSource": "iam.amazonaws.com",
  "eventName": "CreateAccessKey",
  "awsRegion": "us-east-1",
  "sourceIPAddress": "198.51.100.77",
  "userAgent": "aws-cli/2.17.0 md/Botocore#1.34.0 os/linux",
  "requestParameters": { "userName": "backup-svc" },
  "responseElements": { "accessKey": { "accessKeyId": "AKIAEXAMPLENEWKEY99", "status": "Active", "userName": "backup-svc" } },
  "requestID": "6c1e…",
  "eventID": "a0f4…",
  "readOnly": false,
  "eventType": "AwsApiCall",
  "managementEvent": true,
  "recipientAccountId": "111122223333",
  "eventCategory": "Management"
}
```

| Polje | Za istragu znači |
|---|---|
| `eventTime` | Uvijek UTC |
| `eventSource` + `eventName` | Servis i API poziv (`iam.amazonaws.com` + `CreateAccessKey`) |
| `userIdentity` | Ko je zvao i kojim kredencijalom (detaljno ispod) |
| `sourceIPAddress` | IP pozivaoca; za pozive koje radi AWS servis stoji ime servisa ili `AWS Internal` |
| `userAgent` | Alat (CLI, SDK, konzola); lako se lažira, ali promjena je signal |
| `errorCode`, `errorMessage` | Postoje samo kad poziv nije uspio, npr. `AccessDenied` |
| `requestParameters` | Šta je traženo (ime korisnika, politika, bucket) |
| `responseElements` | Šta je vraćeno za izmjene; `null` za read-only pozive |
| `readOnly` | `true` za `Describe*`, `List*`, `Get*` |
| `eventCategory` | `Management`, `Data` ili `NetworkActivity` |

IAM je globalni servis, pa se njegovi događaji bilježe sa `awsRegion` `us-east-1`. Ako tražiš `CreateUser` samo u `eu-central-1`, nećeš ga naći.

### userIdentity: ko je stvarno zvao

| `type` | Kredencijal | Gdje je ime |
|---|---|---|
| `Root` | Root nalog | `userName` je alias naloga, ako postoji |
| `IAMUser` | Dugotrajni ključ (`AKIA…`) ili lozinka u konzoli | `userName` |
| `AssumedRole` | Privremeni kredencijal iz STS (`ASIA…`) | `sessionContext.sessionIssuer.userName` je rola; sesija je zadnji dio `arn` |
| `FederatedUser` | `GetFederationToken` | `sessionContext.sessionIssuer` |
| `AWSService` | AWS servis u tvoje ime | `invokedBy` |

Dva polja iz `sessionContext` su posebno korisna:

- `attributes.mfaAuthenticated`: da li je sesija nastala uz MFA.
- `attributes.creationDate`: kada su privremeni kredencijali izdati. Svi pozivi sa istim `accessKeyId` (`ASIA…`) pripadaju istoj sesiji.

Za rolu sa EC2 instance `arn` izgleda kao `arn:aws:sts::111122223333:assumed-role/web-role/i-0abc123def4567890`: ime sesije je ID instance. Ako takav kredencijal zove API sa IP adrese koja nije te instance (ni NAT gatewaya), kredencijal je vjerovatno ukraden sa instance, najčešće preko metadata servisa (ATT&CK **T1552.005**, Cloud Instance Metadata API). GuardDuty to prijavljuje kao `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration`.

> **U praksi:** Prvo pitanje svake CloudTrail istrage je „koji tačno kredencijal“, ne „koji korisnik“. Korisnik `ci-deploy` može imati dva ključa; ako je procurio jedan, filtriraš po `userIdentity.accessKeyId`, a ne po imenu, i tek tada vidiš šta je napadač radio, a šta legitimni pipeline.

## Osnovni jq alati za istragu

```bash
# pregled: vrijeme, ko, šta, odakle, greška
ct | jq -r '[.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventSource, .eventName, .sourceIPAddress, (.errorCode // "-")] | @tsv' | sort

# najčešći pozivi
ct | jq -r '.eventName' | sort | uniq -c | sort -rn | head -20

# koje IP adrese i alati koriste jedan ključ
ct | jq -r 'select(.userIdentity.accessKeyId=="AKIAEXAMPLECIDEPLOY1") | [.sourceIPAddress, .userAgent] | @tsv' | sort | uniq -c

# samo neuspjeli pozivi
ct | jq -r 'select(.errorCode) | [.eventTime, .eventName, .errorCode, .sourceIPAddress] | @tsv'

# samo izmjene (bez Describe/List/Get)
ct | jq -r 'select(.readOnly == false) | [.eventTime, .eventName, (.requestParameters|tostring)[0:120]] | @tsv'
```

Na pravom nalogu iste upite radiš preko `aws cloudtrail lookup-events` (samo management events, 90 dana, filtriranje po jednom atributu) ili preko CloudTrail Lake / Athene nad trailom u S3:

```bash
aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAEXAMPLECIDEPLOY1 \
  --start-time 2026-10-14T00:00:00Z --query 'Events[].CloudTrailEvent' --output text | jq -r '.eventName'
```

## Scenario 1: kompromitovani kredencijali

Tipičan redoslijed kad napadač dobije ključ (iz git repoa, sa laptopa, iz CI loga):

| Faza | Pozivi u CloudTrailu | ATT&CK |
|---|---|---|
| Provjera ključa | `sts:GetCallerIdentity` | T1078.004 Valid Accounts: Cloud Accounts |
| Izviđanje | `iam:ListUsers`, `iam:ListAttachedUserPolicies`, `iam:GetAccountAuthorizationDetails`, `s3:ListBuckets`, `ec2:DescribeInstances`; često mnogo `AccessDenied` | T1087.004 Account Discovery: Cloud Account, T1580 Cloud Infrastructure Discovery |
| Pristup podacima | `s3:GetObject` (samo ako su data events uključeni) | T1530 Data from Cloud Storage |
| Zloupotreba resursa | `ec2:RunInstances` velikih instanci u neobičnoj regiji | T1496 Resource Hijacking |

Znakovi u logu:

- Ključ koji je mjesecima zvao samo iz CI runnera (jedna IP adresa, jedan `userAgent`) odjednom zove sa nove IP adrese, drugim alatom.
- `GetCallerIdentity` kao prvi poziv sa nove IP adrese. Legitimni alati ga rijetko zovu ručno.
- Nalet `AccessDenied` grešaka u kratkom vremenu: napadač isprobava šta ključ smije.
- Pozivi u regijama koje organizacija ne koristi.

```bash
# prva pojava svake IP adrese po ključu
ct | jq -r '[.userIdentity.accessKeyId, .sourceIPAddress, .eventTime] | @tsv' | sort -k1,1 -k3,3 | awk '!seen[$1" "$2]++'

# AccessDenied po IP adresi i minuti
ct | jq -r 'select(.errorCode=="AccessDenied" or .errorCode=="Client.UnauthorizedOperation") | [.sourceIPAddress, .eventTime[0:16]] | @tsv' | sort | uniq -c | sort -rn | head

# regije u kojima je ključ bio aktivan
ct | jq -r 'select(.userIdentity.accessKeyId=="AKIAEXAMPLECIDEPLOY1") | .awsRegion' | sort | uniq -c
```

### Prijave u konzolu

```json
{
  "eventSource": "signin.amazonaws.com",
  "eventName": "ConsoleLogin",
  "userIdentity": { "type": "IAMUser", "userName": "ana" },
  "sourceIPAddress": "203.0.113.50",
  "responseElements": { "ConsoleLogin": "Success" },
  "additionalEventData": { "MFAUsed": "No", "LoginTo": "https://console.aws.amazon.com/…" }
}
```

Uspjeh ili neuspjeh je u `responseElements.ConsoleLogin`, a MFA u `additionalEventData.MFAUsed`. Kad je korisničko ime pogrešno ukucano, CloudTrail upisuje `HIDDEN_DUE_TO_SECURITY_REASONS` umjesto njega, jer bi tu mogla biti lozinka.

```bash
ct | jq -r 'select(.eventName=="ConsoleLogin") | [.eventTime, .userIdentity.type, (.userIdentity.userName // "-"), .sourceIPAddress, .responseElements.ConsoleLogin, (.additionalEventData.MFAUsed // "-")] | @tsv'
```

Prijava `Root` bez MFA je alarm sama po sebi.

## Scenario 2: perzistencija

Napadač zna da će ukradeni ključ biti opozvan, pa pravi sebi nove puteve nazad.

| Poziv | Šta postiže | ATT&CK |
|---|---|---|
| `iam:CreateUser` | Novi IAM korisnik | T1136.003 Create Account: Cloud Account |
| `iam:CreateAccessKey` za drugog korisnika | Dodatni ključ, često na servisnom nalogu koji niko ne gleda | T1098.001 Additional Cloud Credentials |
| `iam:CreateLoginProfile`, `iam:UpdateLoginProfile` | Lozinka za konzolu postojećem korisniku | T1098.001 |
| `iam:AttachUserPolicy`, `iam:PutUserPolicy`, `iam:AddUserToGroup` | Podizanje privilegija (npr. `AdministratorAccess`) | T1098.003 Additional Cloud Roles |
| `iam:UpdateAssumeRolePolicy` | Trust policy role dozvoli tuđi nalog | T1098.003 |
| `ec2:ImportKeyPair`, `ec2:CreateKeyPair` | SSH ključ za nove instance | T1098 |
| `lambda:CreateFunction` + okidač | Kod koji se sam pokreće | (zavisi od okidača) |

Ključni detalj: kod `CreateAccessKey` pozivalac je u `userIdentity`, a cilj u `requestParameters.userName`. Kada se ta dva razlikuju, neko pravi ključ drugome.

```bash
# IAM izmjene: ko -> nad kim
ct | jq -r 'select(.eventSource=="iam.amazonaws.com" and .readOnly==false)
  | [.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventName, (.requestParameters.userName // .requestParameters.roleName // "-"), (.requestParameters.policyArn // "-")] | @tsv'

# ključevi napravljeni za drugog korisnika
ct | jq -r 'select(.eventName=="CreateAccessKey" and .requestParameters.userName != null and .requestParameters.userName != .userIdentity.userName)
  | [.eventTime, .userIdentity.userName, .requestParameters.userName, .responseElements.accessKey.accessKeyId] | @tsv'
```

Novi `accessKeyId` iz `responseElements` je sljedeći trag: filtriraj po njemu i vidiš šta je napadač radio novim ključem.

> **U praksi:** Kod opoziva nije dovoljno deaktivirati ključ koji je procurio. Iz CloudTraila izvuci sve što je taj kredencijal napravio (korisnike, ključeve, login profile, politike, role, key pairove, funkcije) i opozovi svaki od tih artefakata. Napadač koji je napravio drugi ključ preživljava opoziv prvog.

## Scenario 3: izbjegavanje odbrane

Prije ozbiljnih akcija napadač pokuša ugasiti ono što ga gleda (ATT&CK **T1562.008** Impair Defenses: Disable or Modify Cloud Logs, i T1562.001 za sigurnosne alate).

| Poziv | Efekat |
|---|---|
| `cloudtrail:StopLogging` | Trail prestaje bilježiti |
| `cloudtrail:DeleteTrail` | Trail obrisan |
| `cloudtrail:UpdateTrail` | Npr. preusmjeren u tuđi bucket ili isključen multi-region |
| `cloudtrail:PutEventSelectors` | Isključeni management ili data events |
| `guardduty:DeleteDetector`, `guardduty:UpdateDetector` | GuardDuty ugašen ili pauziran |
| `config:StopConfigurationRecorder` | AWS Config prestaje bilježiti promjene |
| `ec2:DeleteFlowLogs` | Nema više mrežnih logova |
| `s3:PutBucketLifecycleConfiguration` na bucketu sa logovima | Logovi se brišu brzo |

```bash
ct | jq -r 'select(.eventName | test("^(StopLogging|DeleteTrail|UpdateTrail|PutEventSelectors|DeleteDetector|UpdateDetector|StopConfigurationRecorder|DeleteFlowLogs)$"))
  | [.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventName, .sourceIPAddress, (.errorCode // "OK")] | @tsv'
```

`StopLogging` se bilježi u samom trailu (posljednji događaj prije tišine). Ako je poziv uspio, ono što je slijedilo vidiš samo ako postoji drugi trail, npr. **organization trail** iz management naloga koji članski nalog ne može ugasiti, ili ako je **CloudTrail Lake**/GuardDuty imao svoju kopiju.

Integritet samih fajlova provjeravaš digest fajlovima (ako je uključen log file integrity validation):

```bash
aws cloudtrail validate-logs --trail-arn arn:aws:cloudtrail:eu-central-1:111122223333:trail/org-trail \
  --start-time 2026-10-14T00:00:00Z
```

Ista detekcija u KQL-u (Sentinel tabela `AWSCloudTrail`) je kratka:

```text
AWSCloudTrail
| where EventName in ("StopLogging","DeleteTrail","UpdateTrail","PutEventSelectors")
| project TimeGenerated, UserIdentityArn, EventName, SourceIpAddress, ErrorCode
```

## Kubernetes audit zapis, polje po polje

Jedna linija iz audit loga (formatirano):

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "5b3f…",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/prod/secrets/db-credentials",
  "verb": "get",
  "user": {
    "username": "system:serviceaccount:prod:web",
    "groups": ["system:serviceaccounts", "system:serviceaccounts:prod", "system:authenticated"],
    "extra": {
      "authentication.kubernetes.io/pod-name": ["web-7d9c5b-x2kqp"],
      "authentication.kubernetes.io/node-name": ["worker-2"],
      "authentication.kubernetes.io/credential-id": ["JTI=1f0c…"]
    }
  },
  "sourceIPs": ["10.244.2.17"],
  "userAgent": "curl/8.5.0",
  "objectRef": { "resource": "secrets", "namespace": "prod", "name": "db-credentials", "apiVersion": "v1" },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-10-15T08:02:11.120394Z",
  "stageTimestamp": "2026-10-15T08:02:11.124001Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": "RBAC: allowed by RoleBinding \"web-read\" of Role \"web-read\" to ServiceAccount \"web/prod\""
  }
}
```

| Polje | Za istragu znači |
|---|---|
| `user.username` | Identitet: korisnik iz sertifikata/OIDC-a ili `system:serviceaccount:<ns>:<ime>` |
| `user.extra` | Za bound token servisnog naloga: pod i node kojima je token izdat, ID tokena (`JTI`) |
| `impersonatedUser` | Postoji kad je neko koristio `--as` (impersonation) |
| `verb` | `get`, `list`, `watch`, `create`, `update`, `patch`, `delete` |
| `objectRef` | `resource`, `subresource` (`exec`, `log`, `token`…), `namespace`, `name` |
| `sourceIPs` | Pouzdana je samo posljednja adresa; ostale klijent može postaviti preko `X-Forwarded-For` |
| `userAgent` | Klijent (`kubectl/v1.34…`, `curl`); nije pouzdan, ali `curl` iz poda je signal |
| `responseStatus.code` | 200/201 uspjeh, 403 odbijeno od RBAC-a, 401 neuspjela autentifikacija |
| `annotations` | Odluka i razlog autorizacije, odluke admission kontrolera (npr. Pod Security) |
| `requestObject` | Tijelo zahtjeva, samo na nivou `Request` i `RequestResponse` |
| `stage` | Za istragu gledaj `ResponseComplete`; `RequestReceived` je duplikat bez odgovora |

Audit policy određuje šta uopšte vidiš. Za ovu istragu treba da `pods` (create) budu bar na nivou `Request`, da bi se vidjela `securityContext` polja, a `secrets` samo na `Metadata`. Na višem nivou bi vrijednosti tajni završile u logu.

```bash
au() { jq -c 'select(.stage=="ResponseComplete")' "$AUDIT"; }

# pregled: vrijeme, ko, glagol, resurs, ime, kod
au | jq -r '[.requestReceivedTimestamp, .user.username, .verb, (.objectRef.resource // "-") + "/" + (.objectRef.subresource // ""), (.objectRef.namespace // "-"), (.objectRef.name // "-"), .responseStatus.code] | @tsv'
```

## Scenario 4: exec u pod

`kubectl exec` je legitiman alat, ali i napadački (ATT&CK **T1609** Container Administration Command). Komanda se vidi u `requestURI` kao parametri `command=`:

```text
"requestURI": "/api/v1/namespaces/prod/pods/web-7d9c5b-x2kqp/exec?command=sh&command=-c&command=cat+%2Fvar%2Frun%2Fsecrets%2Fkubernetes.io%2Fserviceaccount%2Ftoken&container=web&stdin=true&stdout=true"
```

Glagol nije uvijek isti: stariji klijenti otvaraju exec preko `create` (SPDY), a noviji `kubectl` preko WebSocketa, što se u nekim verzijama bilježi kao `get`. Zato detekcija treba da gleda `objectRef.subresource`, a ne glagol.

```bash
au | jq -r 'select(.objectRef.subresource=="exec" or .objectRef.subresource=="attach")
  | [.requestReceivedTimestamp, .user.username, .verb, .objectRef.namespace, .objectRef.name, .sourceIPs[-1], .responseStatus.code, (.requestURI | capture("(?<c>command=[^&]*(&command=[^&]*)*)").c // "-")] | @tsv'
```

Pitanja koja postaviš: ko je to (čovjek sa OIDC identitetom ili servisni nalog iz drugog poda?), u kom namespaceu (exec u `kube-system` ili u produkciji van incidenta), i šta je pokrenuto (shell, čitanje tokena, `curl` ka metadata servisu).

## Scenario 5: zloupotreba tokena servisnog naloga

Napadač u kompromitovanom podu čita token iz `/var/run/secrets/kubernetes.io/serviceaccount/token` i zove API (ATT&CK **T1528** Steal Application Access Token, **T1552.007** Unsecured Credentials: Container API). Tragovi:

- `user.username` je servisni nalog, a `userAgent` je `curl` ili `kubectl`, a ne biblioteka aplikacije.
- `sourceIPs` nije IP poda iz `user.extra` (`pod-name`), nego neka druga adresa: token je iznesen iz klastera.
- Izviđanje dozvola: `create` nad `selfsubjectrulesreviews` ili `selfsubjectaccessreviews` (to je `kubectl auth can-i --list`), pa nalet odgovora 403.
- Pristup resursima koje taj servisni nalog inače nikad ne dira.

```bash
# šta servisni nalozi rade, sa kojim alatom
au | jq -r 'select(.user.username | startswith("system:serviceaccount:")) | [.user.username, .userAgent, .verb, .objectRef.resource] | @tsv' | sort | uniq -c | sort -rn

# 403 po korisniku: ko isprobava granice
au | jq -r 'select(.responseStatus.code==403) | .user.username' | sort | uniq -c | sort -rn

# provjera dozvola
au | jq -r 'select(.objectRef.resource | test("selfsubject(rules|access)reviews")) | [.requestReceivedTimestamp, .user.username, .sourceIPs[-1]] | @tsv'

# kome su izdavani novi tokeni (TokenRequest)
au | jq -r 'select(.objectRef.resource=="serviceaccounts" and .objectRef.subresource=="token") | [.requestReceivedTimestamp, .user.username, .objectRef.namespace, .objectRef.name] | @tsv'
```

`authentication.kubernetes.io/credential-id` (`JTI=…`) povezuje sve zahtjeve jednog tokena, a isti JTI se vidi u anotaciji `authentication.kubernetes.io/issued-credential-id` na zahtjevu koji je token izdao. Tako pratiš token od izdavanja do zloupotrebe.

Još dva identiteta zaslužuju alarm uvijek: `system:anonymous` sa odgovorom 200 (anonimni pristup nečemu osim `/healthz` i sličnog) i bilo koji zahtjev sa `impersonatedUser`, ako impersonation ne koristite svjesno.

> **U praksi:** Pripremi listu „normalnih“ parova servisni nalog → resurs iz sedmice bez incidenta (`sort | uniq -c` iznad). Tokom istrage diff sa tom listom brže pokaže anomaliju nego čitanje hiljada linija.

## Scenario 6: privilegovana opterećenja i tajne

Pod sa `privileged: true`, `hostPID`, `hostNetwork` ili `hostPath` montiranjem `/` je put za bijeg na node (ATT&CK **T1611** Escape to Host; pravljenje kontejnera je **T1610** Deploy Container). Ako pod nastaje van GitOps toka, od korisnika koji inače ne deployuje, to je incident.

```bash
au | jq -r 'select(.objectRef.resource=="pods" and .verb=="create" and .requestObject != null)
  | select(
      ([.requestObject.spec.containers[]?.securityContext.privileged] | any)
      or .requestObject.spec.hostPID == true or .requestObject.spec.hostNetwork == true
      or ([.requestObject.spec.volumes[]?.hostPath.path] | any(. == "/")))
  | [.requestReceivedTimestamp, .user.username, .objectRef.namespace, (.requestObject.metadata.name // .objectRef.name // "-"), .responseStatus.code, (.annotations["pod-security.kubernetes.io/enforce-policy"] // "-")] | @tsv'
```

Odgovor 403 uz anotaciju Pod Security admissiona znači da je kontrola zaustavila pokušaj; to je i dalje vrijedan trag, jer pokazuje namjeru.

Pristup tajnama (ATT&CK **T1552.007**):

```bash
# ko čita ili lista tajne, gdje
au | jq -r 'select(.objectRef.resource=="secrets" and (.verb=="get" or .verb=="list" or .verb=="watch"))
  | [.user.username, .verb, (.objectRef.namespace // "*"), (.objectRef.name // "*")] | @tsv' | sort | uniq -c | sort -rn
```

`list` nad tajnama u svim namespaceovima (`objectRef.namespace` prazan) od korisnika koji nije kontroler je posebno sumnjiv: jedan zahtjev vraća sve tajne klastera.

RBAC perzistencija liči na IAM perzistenciju u AWS-u: novi `ClusterRoleBinding` ka `cluster-admin`, novi servisni nalog sa tokenom, izmjena postojeće role.

```bash
au | jq -r 'select((.objectRef.resource=="clusterrolebindings" or .objectRef.resource=="rolebindings") and (.verb=="create" or .verb=="update" or .verb=="patch"))
  | [.requestReceivedTimestamp, .user.username, .verb, .objectRef.name, (.requestObject.roleRef.name // "-")] | @tsv'
```

> **U praksi:** Kubernetes audit i CloudTrail se na EKS-u spajaju preko identiteta: IAM rola mapirana u Kubernetes korisnika (access entries ili aws-auth) pojavljuje se u `user.username`/`user.extra`, a ista rola u CloudTrailu. Napadač sa ukradenim AWS kredencijalom često završi u klasteru, i obrnuto, pa vodi jednu zajedničku hronologiju.

## Od nalaza do hronologije

Istraga se završava hronologijom, ne listom upita. Spoji relevantne događaje u jedan format (UTC, ko, šta, nad čim, odakle, rezultat):

```bash
{
  ct | jq -r 'select(.userIdentity.accessKeyId=="AKIAEXAMPLECIDEPLOY1" or .userIdentity.accessKeyId=="AKIAEXAMPLENEWKEY99")
    | [.eventTime, "aws", (.userIdentity.userName // .userIdentity.arn), .eventName, (.requestParameters|tostring)[0:60], .sourceIPAddress, (.errorCode // "OK")] | @tsv'
  au | jq -r 'select(.user.username=="system:serviceaccount:prod:web")
    | [.requestReceivedTimestamp[0:19] + "Z", "k8s", .user.username, .verb + " " + (.objectRef.resource // ""), (.objectRef.name // "-"), .sourceIPs[-1], (.responseStatus.code|tostring)] | @tsv'
} | sort > /root/hronologija.tsv
column -t -s $'\t' /root/hronologija.tsv | less -S
```

Za svaki red u hronologiji zapiši i šta znači (izviđanje, perzistencija, pristup podacima) i koji je ATT&CK ID. Ta tabela je ulaz u fazu obuzdavanja (modul 10) i u izvještaj nakon incidenta.

## Rezime

- CloudTrail odgovara na „ko je, kojim kredencijalom, odakle zvao koji API“; istragu vodi po `userIdentity.accessKeyId`, a ne samo po imenu korisnika. IAM događaji su u `us-east-1`.
- `AKIA…` je dugotrajni ključ, `ASIA…` privremeni (STS); `sessionContext` daje rolu, MFA i vrijeme izdavanja sesije.
- Kompromitovani kredencijal se vidi kao nova IP adresa i alat, `GetCallerIdentity`, nalet `AccessDenied` i neobične regije (T1078.004, T1087.004).
- Perzistencija: `CreateUser`, `CreateAccessKey` za drugog, `CreateLoginProfile`, `AttachUserPolicy`, `UpdateAssumeRolePolicy`; svaki napravljeni artefakt se opoziva.
- Izbjegavanje odbrane: `StopLogging`, `DeleteTrail`, `PutEventSelectors`, `DeleteDetector` (T1562.008); organization trail i validacija digest fajlova čuvaju dokaze.
- Kubernetes audit: gledaj `ResponseComplete`, `user`, `verb`, `objectRef`, `sourceIPs[-1]`, `responseStatus.code` i anotacije autorizacije; exec traži po `subresource`, ne po glagolu.
- Zloupotreba tokena se vidi kao servisni nalog sa `curl`/`kubectl`, IP van poda, `selfsubjectrulesreviews` i 403; privilegovani podovi traže `Request` nivo za `pods`, a tajne smiju biti samo na `Metadata`.
