## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 6:

- **6.3** **Obuzdavanje** (containment), **iskorjenjivanje** (eradication) i **oporavak** (recovery) za hostove, kontejnere i cloud naloge.
- **6.4** **Runbookovi** za česte incidente: procurjeli ključevi i tokeni, kriptomineri, izložen storage; **analiza nakon incidenta** (post-incident review).

Poslije modula znaš:

- kako izabrati strategiju obuzdavanja i šta pri tome gubiš;
- konkretne korake za Linux host, Docker/Kubernetes i AWS/Azure nalog;
- kako izgleda runbook koji dežurni može izvesti bez improvizacije;
- kako voditi analizu nakon incidenta koja daje mjerljiva poboljšanja.

Polazna tačka je modul 09: incident je proglašen, trijažiran, a volatilni dokazi su prikupljeni.

## Strategija obuzdavanja

NIST SP 800-61r3 definiše **obuzdavanje** (RS.MI-01) kao sprječavanje širenja incidenta, a **iskorjenjivanje** (RS.MI-02) kao uklanjanje efekata: perzistencije, ulaznih tačaka, kompromitovanih naloga i iskorištenih ranjivosti. **Oporavak** (RC.RP) vraća sisteme u normalan rad i potvrđuje da su ispravni.

Svaka odluka ima cijenu. r3 to izričito kaže (RS.MA-03): treba izbalansirati brz oporavak sa potrebom da se napadač posmatra ili da se istraga uradi temeljno.

| Pitanje | Zašto je bitno |
|---|---|
| Je li napadač i dalje aktivan? | Ako jeste i šteta raste (izvlačenje podataka, šifrovanje), obuzdaj odmah |
| Znamo li obim? | Ako obuzdaš jedan host, a napadač ima još tri, upozorio si ga i ostao bez uvida |
| Jesu li volatilni dokazi prikupljeni? | Izolacija i gašenje uništavaju memoriju i konekcije |
| Koliko košta prekid servisa? | Vlasnik imovine i rukovodstvo odlučuju o kritičnim servisima |
| Koliko dugo mjera traje? | Hitna mjera za sate, privremena za dane, trajna ispravka |

Vrste mjera:

- **Kratkoročno obuzdavanje:** izolacija hosta, deaktivacija ključa, blokada IP adrese. Brzo, grubo, reverzibilno.
- **Dugoročno obuzdavanje:** privremena rješenja dok se sistem ne izgradi ponovo (strožije mrežne politike, dodatni monitoring, rotacija svih kredencijala u domenu).
- **Posmatranje** (napadača preusmjeriti u sandbox i pratiti): r3 traži da se o tome prvo razgovara sa pravnom službom, jer namjerno odlaganje obuzdavanja nosi rizik.

Automatsko obuzdavanje (Wazuh active response iz modula 04, Defender „Isolate device“ u SC-200) je korisno za jasne, česte slučajeve. r3 preporučuje da handleri uvijek mogu i ručno birati mjere. Automatika koja izoluje host zbog lažnog pozitiva je sama po sebi incident dostupnosti.

> **U praksi:** obuzdavanje po pravilu radiš **u jednom potezu** za sve poznate tačke: svi kompromitovani ključevi, svi nalozi, svi hostovi u isto vrijeme. Ako napadač vidi da mu je jedan pristup oduzet, iskoristiće preostale za brisanje tragova ili ubrzan napad. Zato prije prvog poteza mapiraj obim koliko možeš.

## Linux host

### Obuzdavanje

Prvo sačuvaj trenutno stanje firewalla, zatim dozvoli samo IR stanicu, pa tek onda zatvori sve ostalo. Obrnut redoslijed te izbacuje iz vlastite sesije.

```bash
IR=10.10.0.5                                         # adresa IR stanice
iptables-save > /root/ir/iptables-before-$(date -u +%Y%m%dT%H%MZ).rules

iptables -I INPUT 1  -i lo -j ACCEPT
iptables -I OUTPUT 1 -o lo -j ACCEPT
iptables -I INPUT 2  -s $IR -j ACCEPT
iptables -I OUTPUT 2 -d $IR -j ACCEPT
iptables -P INPUT DROP; iptables -P OUTPUT DROP; iptables -P FORWARD DROP

iptables -S                                          # provjera: politike DROP, izuzeci za lo i IR
```

iptables provjerava svaki paket, pa ovo prekida i već uspostavljene konekcije napadača (osim prema IR adresi). Pazi na tu razliku u cloudu, gdje security grupe prate konekcije (vidi niže).

Nalog i procesi:

```bash
U=marko
usermod -L "$U"                    # zaključaj lozinku
chage -E 0 "$U"                    # nalog istekao: ni SSH ključ više ne prolazi
pkill -STOP -u "$U"                # zamrzni procese korisnika (memorija ostaje za forenziku)
# nakon što su dokazi prikupljeni:
pkill -KILL -u "$U"

kill -STOP 4242                    # sumnjiv proces: zamrzni, ne ubijaj odmah
```

`SIGSTOP` zaustavlja proces bez gubitka memorije i otvorenih fajlova, pa forenzika i dalje može čitati `/proc/4242/`. `kill -9` je konačan.

### Iskorjenjivanje

Ukloni sve što je napadač ostavio, na osnovu nalaza iz live responsea:

```bash
userdel -r sysupdate                                   # nalog koji je napadač kreirao
crontab -r -u www-data                                 # cron koji je dodao (sačuvan u dokazima)
sed -i '/attacker@kali/d' /home/marko/.ssh/authorized_keys
systemctl disable --now sysupdate.service; rm /etc/systemd/system/sysupdate.service
```

Ali: na kompromitovanom hostu nikad nisi siguran da si našao sve. Rootkit, izmijenjen binarni fajl ili druga perzistencija mogu ostati. Pravilo za ozbiljne incidente je **ponovna izgradnja** (rebuild) iz poznato dobre slike, a ne čišćenje. Čišćenje je prihvatljivo kad je obim potpuno poznat i mali (npr. jedan cron unos bez root pristupa).

Iskorjenjivanje uvijek uključuje i **ulaznu tačku**: zakrpu ranjivosti, ukidanje lozinke za SSH (`PasswordAuthentication no`), rotaciju kredencijala koji su bili na hostu (ključevi u `~/.aws/`, tokeni u env varijablama, SSH ključevi).

### Oporavak

- Novi host iz slike ili Terraform/Ansible koda, zakrpljen.
- Podaci iz bekapa čiji integritet je provjeren (RC.RP-03): bekap napravljen prije prvog traga kompromitacije, skeniran prije upotrebe.
- Pojačan monitoring nekoliko sedmica: niži pragovi, dodatna Wazuh pravila za IOC-ove iz ovog incidenta.
- Vlasnik sistema potvrđuje rad (RC.RP-04, RC.RP-05), a kraj oporavka se formalno proglašava (RC.RP-06).

## Kontejneri i Kubernetes

### Docker

| Akcija | Komanda | Efekat |
|---|---|---|
| Zamrzni | `docker pause <c>` | Procesi zaustavljeni (cgroup freezer), memorija sačuvana |
| Odvoji od mreže | `docker network disconnect <mreža> <c>` | Kontejner bez mreže, i dalje radi |
| Izmjene u odnosu na sliku | `docker diff <c>` | Lista dodanih (A), izmijenjenih (C), obrisanih (D) fajlova |
| Kopija fajl sistema | `docker export <c> -o c.tar && sha256sum c.tar` | Dokaz, sa hashom |
| Ne radi | `docker rm -f <c>` | Briše fajl sistem i procese, tj. dokaze |

### Kubernetes

Cilj je izolovati pod, a da servis i dalje radi i da pod ostane za forenziku.

```bash
NS=shop; POD=web-7d9c8b6f5-abcde

# 1) dokazi (modul 09): YAML, logovi, čvor
kubectl -n $NS get pod $POD -o yaml > $POD.yaml
kubectl -n $NS logs $POD --all-containers --timestamps > $POD.log

# 2) izbaci pod iz ReplicaSeta i Servicea promjenom labela; ReplicaSet pravi novi, čist pod
kubectl -n $NS label pod $POD app- quarantine=true --overwrite

# 3) mrežna izolacija karantinskih podova
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quarantine
  namespace: shop
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes: [Ingress, Egress]
EOF

# 4) čvor ne prima nove podove dok se ne provjeri
kubectl cordon $(kubectl -n $NS get pod $POD -o jsonpath='{.spec.nodeName}')
```

Napomene:

- Labela `app` mora biti ona koju koristi selector Deploymenta i Servicea; provjeri sa `kubectl get rs -o wide`.
- NetworkPolicy bez `ingress`/`egress` pravila blokira sav saobraćaj odabranih podova, ali samo ako CNI podržava NetworkPolicy. Već uspostavljene konekcije neki CNI-jevi ne prekidaju odmah; provjeri.
- Kompromitovan **ServiceAccount**: ukloni RoleBinding/ClusterRoleBinding koji mu daje prava. Vezani (bound) tokeni važe dok ne isteknu ili dok se ne obriše objekat za koji su vezani (pod), pa brisanje poda nakon prikupljanja dokaza poništava i njegov token. Stari tokeni iz Secret objekata (tip `kubernetes.io/service-account-token`) se poništavaju brisanjem Secreta.
- Kompromitovan korisnik klastera: ukloni binding, rotiraj kredencijale (kubeconfig sertifikat se ne može opozvati pojedinačno; zato ljudi treba da pristupaju kroz OIDC).

Iskorjenjivanje za kontejnere znači: ispravi **sliku** i njen izvor (Dockerfile, zavisnosti), izgradi novu, deployaj po **digestu**, i provjeri da admission kontrole (CKS kurs) sprječavaju ponavljanje (npr. zabrana privilegovanih podova, samo potpisane slike). Restart starog poda vraća istu ranjivost.

> **U praksi:** labela `quarantine=true` + unaprijed deployana NetworkPolicy u svakom namespaceu pretvara izolaciju poda u jednu komandu. Pripremi to **prije** incidenta, kao dio platforme. Isto važi za runbook koji zna koje labele koristi selector svakog Deploymenta.

## Cloud nalozi

### AWS

**IAM korisnik sa access keyem:**

```bash
aws iam update-access-key --user-name ci-deploy --access-key-id AKIAEXAMPLEKEY123456 --status Inactive
aws iam list-access-keys --user-name ci-deploy                    # ima li drugih ključeva?
aws iam attach-user-policy --user-name ci-deploy --policy-arn arn:aws:iam::aws:policy/AWSDenyAll
aws iam delete-login-profile --user-name ci-deploy 2>/dev/null    # konzolni pristup, ako postoji
```

Deaktivacija (`Inactive`) je reverzibilna i čuva ključ za istragu; brisanje dolazi kasnije.

**Privremeni kredencijali (role, STS):** ne mogu se obrisati. Rješenje je politika koja odbija sve zahtjeve sa tokenima izdatim prije određenog trenutka. To radi opcija **Revoke active sessions** u IAM konzoli za rolu: dodaje inline politiku `AWSRevokeOlderSessions` sa uslovom `aws:TokenIssueTime`. Ako napadač ima ključeve kojima može ponovo preuzeti rolu, prvo obuzdaj njih.

**EC2 instanca:**

| Korak | Zašto |
|---|---|
| Uključi termination protection, dodaj tag (npr. `ir-case=IR-2026-031`) | Da je niko ne obriše; da svi znaju status |
| EBS snapshot svih volumena | Dokaz diska; snapshot se dijeli sa forenzičkim nalogom |
| Izvadi iz Auto Scaling grupe i load balancera | Da ASG ne „popravi“ instancu i da ne prima saobraćaj |
| Zamijeni sve security grupe izolacionom grupom | Novi saobraćaj blokiran |
| NACL deny na subnetu, po potrebi | Security grupe prate konekcije: **postojeće praćene konekcije se ne prekidaju** promjenom grupe |
| Blokiraj DNS ako treba spriječiti izlaz | Security grupe i NACL ne filtriraju saobraćaj prema Route 53 Resolveru |

**Na nivou organizacije:** SCP koji odbija sve akcije u kompromitovanom nalogu, osim IR role, je najgrublja i najjača mjera.

### Azure i Entra ID

| Situacija | Mjera |
|---|---|
| Kompromitovan korisnik | Onemogući nalog (`az ad user update --id <upn> --account-enabled false`), opozovi sesije (Microsoft Graph `revokeSignInSessions`), resetuj lozinku, provjeri MFA metode koje je napadač mogao dodati |
| Kompromitovan service principal | Ukloni tajne i sertifikate (`az ad sp credential list/delete`), pregledaj dodijeljene role |
| VM | NSG koji dozvoljava samo IR, snapshot diskova |

U Defender XDR (SC-200) postoje akcije „Isolate device“ i „Disable user“/„Contain user“; Sentinel automatizuje iste korake kroz playbookove.

> **U praksi:** u cloudu napadač često pravi **perzistenciju u IAM-u**: novi korisnik, novi access key za postojećeg korisnika, nova rola sa trust politikom prema njegovom nalogu, nova aplikacija u Entra ID. Deaktivacija prvobitnog ključa to ne rješava. Iskorjenjivanje u cloudu zato uvijek uključuje pregled svih `Create*`, `Attach*`, `Put*Policy` i `UpdateAssumeRolePolicy` događaja iz CloudTraila (modul 02) za vrijeme incidenta.

## Runbookovi

Runbook je tehnički postupak za jedan zadatak. Dobar runbook ima uvijek iste dijelove:

```text
Naziv / verzija / vlasnik / datum zadnjeg testa
Okidač: koji alarm ili prijava pokreće runbook
Preduslovi: role, pristup, alati (provjereno da ih dežurni ima)
Koraci: numerisani, sa komandama i očekivanim rezultatom svakog koraka
Odluke: gdje se eskalira, ko odobrava rizične korake
Provjera: kako znaš da je korak uspio
Dokazi: šta se sačuva prije destruktivnih koraka
Komunikacija: koga obavijestiti i kada
Zatvaranje: kriterijumi za kraj; šta ide u izvještaj
```

### Runbook 1: procurjeli AWS access key

**Okidač:** gitleaks/push protection nalaz u javnom repou, AWS Health/Support obavještenje, GuardDuty nalaz za neuobičajenu upotrebu ključa.

1. **Identifikuj ključ i vlasnika.** `aws iam list-access-keys --user-name <u>`; ako ne znaš korisnika: `aws iam get-access-key-last-used --access-key-id <AKIA…>`.
2. **Deaktiviraj ključ** (`update-access-key --status Inactive`). Opoziv uvijek ide prije svega ostalog.
3. **Istraži upotrebu** u CloudTrailu za taj `AccessKeyId`:

```bash
CT=cloudtrail.json      # izvoz CloudTraila za period incidenta
K=AKIAEXAMPLEKEY123456
jq -r --arg k "$K" '.Records[] | select(.userIdentity.accessKeyId==$k) |
   [.eventTime, .eventSource, .eventName, .sourceIPAddress, (.errorCode // "OK")] | @tsv' "$CT" | sort

# akcije koje prave perzistenciju ili gase logove
jq -r --arg k "$K" '.Records[] | select(.userIdentity.accessKeyId==$k) |
   select(.eventName | test("^(Create|Attach|Put|Update|Delete|Stop)")) |
   [.eventTime, .eventName, (.requestParameters | tostring)[0:120]] | @tsv' "$CT"
```

4. **Ukloni perzistenciju** koju je napadač napravio (novi korisnici, ključevi, role, politike), a resurse koje je pokrenuo (EC2, Lambda) zaustavi tek nakon snapshota.
5. **Rotiraj:** izdaj novi kredencijal ili, bolje, zamijeni dugotrajni ključ OIDC rolom za CI. Prebaci servise, pa obriši stari ključ.
6. **Očisti izvor:** ukloni tajnu iz koda (DevSecOps kurs, modul 03), dodaj pre-commit i push protection.
7. **Zatvaranje:** nema aktivnosti ključa poslije deaktivacije, svi resursi napadača uklonjeni, nalog u izvještaju.

**Varijanta za Kubernetes ili GitLab token:** isti redoslijed. Opoziv (brisanje Secreta ili bindinga, revoke PAT-a), istraga u audit logu (`user.username`, `verb`, `objectRef.resource` u Kubernetes auditu), uklanjanje perzistencije (novi ServiceAccounti, RoleBindingi, CronJobovi), rotacija.

### Runbook 2: kriptominer u kontejneru

**Okidač:** Falco alarm (npr. `Drop and execute new binary in container`, vlastito pravilo za konekcije prema poznatim mining portovima ili `stratum+tcp` u komandnoj liniji), nagli rast CPU-a na čvoru, GuardDuty nalaz za kriptovalute, račun za cloud.

1. **Potvrdi:** koji pod, koji čvor, koja slika (`container.image.repository` iz Falco alarma), koji proces i konekcija.
2. **Dokazi:** pod YAML, logovi, `docker diff` / `crictl` na čvoru, `/proc/<pid>/` sumnjivog procesa, Falco i audit alarmi za taj kontejner.
3. **Obuzdaj:** karantin labela + NetworkPolicy (izlaz prema poolu prestaje), po potrebi `cordon` čvora.
4. **Pronađi ulaz:** ranjiva aplikacija (RCE), izložen dashboard ili API bez autentikacije, kompromitovan ServiceAccount token, zlonamjerna slika iz javnog registra? Kubernetes audit log pokazuje ko je kreirao pod (`create` na `pods`, `user.username`).
5. **Iskorijeni:** ispravi sliku ili konfiguraciju, ukloni sve što je napadač kreirao (Deploymente, DaemonSete, CronJobove u svim namespaceovima), rotiraj tokene i tajne koje je pod mogao pročitati.
6. **Oporavi:** novi pod iz ispravljene slike po digestu; provjeri da CPU i izlazne konekcije izgledaju normalno.
7. **Zatvaranje:** kriptominer je finansijska šteta, ali i znak da je napadač imao izvršavanje koda; procijeni da li je mogao uraditi i nešto drugo (pristup tajnama, metadata servisu).

### Runbook 3: javno izložen S3 bucket

**Okidač:** AWS Config/Security Hub nalaz, Access Analyzer, prijava treće strane.

1. **Zatvori pristup odmah:**

```bash
B=kurs-shop-exports
aws s3api put-public-access-block --bucket $B --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api get-bucket-policy-status --bucket $B           # IsPublic mora biti false
```

2. **Sačuvaj stanje prije izmjene** (ako već nije): `get-bucket-policy`, `get-bucket-acl`, verzija politike iz CloudTraila (`PutBucketPolicy`, `PutBucketAcl`, `DeletePublicAccessBlock`), ko je i kada napravio bucket javnim.
3. **Utvrdi da li je neko pristupio:** S3 server access logovi ili CloudTrail **data events** (`GetObject`, `ListObjects`) za bucket, sa IP adresama van organizacije. Bez data eventa ili access logova odgovor je „ne znamo“, i tako se mora prijaviti.
4. **Utvrdi šta je bilo izloženo:** sadržaj i klasifikacija podataka (npr. Amazon Macie). Lični podaci znače uključivanje pravne službe i moguće obaveze obavještavanja regulatora.
5. **Spriječi ponavljanje:** Block Public Access na nivou naloga (`aws s3control put-public-access-block --account-id …`), SCP koji zabranjuje njegovo gašenje, IaC provjera u pipelineu.

> **U praksi:** „ne znamo da li je neko pristupio“ je čest i neugodan odgovor kod izloženog storagea, jer data eventi i access logovi po defaultu nisu uključeni. To je nalaz za analizu nakon incidenta: uključi ih unaprijed za buckete sa osjetljivim podacima, prije sljedećeg incidenta.

## Analiza nakon incidenta

**Post-incident review** (lessons learned) je ulaz u **ID.IM** iz CSF 2.0. Cilj je poboljšanje, ne krivac.

Pravila:

- **Bez okrivljavanja** (blameless): pitaš „šta je u sistemu omogućilo grešku“, ne „ko je kriv“. Ljudi koji se boje kazne kriju informacije.
- **Brzo:** u roku od jedne do dvije sedmice, dok se detalji pamte. r3 dodaje da se lekcije dijele čim se nauče, i tokom incidenta.
- **Sa činjenicama:** vremenska linija iz modula 09, sa izvorima.
- **Sa vlasnicima akcija:** svaka akcija ima odgovornu osobu i rok, i prati se kao tiket.

Struktura izvještaja:

```text
IR-2026-031 Kompromitovan SSH nalog na lab hostu (P1)
Sažetak: 3-4 rečenice za rukovodstvo
Vremenska linija (UTC): prvi trag, detekcija, proglašenje, obuzdavanje, iskorjenjivanje, kraj oporavka
Uticaj: sistemi, podaci, trajanje, troškovi
Uzrok i doprinoseći faktori: lozinka bez MFA, SSH lozinke dozvoljene, alarm 5763 nivo 10 bez eskalacije
Šta je radilo dobro: Wazuh 5902 uhvatio novi nalog za 1 min, live response skripta
Šta nije: alarm u redu 13 min bez trijaže, runbook tražio pristup koji dežurni nije imao
Metrike: MTTD 2 min, vrijeme do trijaže 13 min, vrijeme do obuzdavanja 41 min
Akcije: (vlasnik, rok, tiket)
  - PasswordAuthentication no na svim hostovima (platforma, 2026-10-21, SEC-430)
  - 5763 + 5715 korelacija -> nivo 12, pager (detekcije, 2026-10-18, SEC-431)
  - purple test T1110 + T1136 u sljedećem ciklusu (detekcije, 2026-11-11, SEC-432)
  - IR rola za dežurne (IAM, 2026-10-17, SEC-433)
```

Metrike koje se prate kroz incidente:

| Metrika | Od → do |
|---|---|
| **MTTD** (mean time to detect) | Prvi trag napada → alarm |
| **MTTA** (acknowledge) | Alarm → analitičar ga preuzeo |
| **MTTC** (contain) | Proglašenje → obuzdavanje |
| **MTTR** (recover) | Proglašenje → kraj oporavka |

Svaka praznina u detekciji iz analize postaje stavka u purple team ciklusu (modul 08), a svaki korak runbooka koji nije radio postaje izmjena runbooka uz novi test. Tako se zatvara krug: incident → lekcija → detekcija ili procedura → test.

## Rezime

- Obuzdavanje (RS.MI-01) zaustavlja širenje, iskorjenjivanje (RS.MI-02) uklanja perzistenciju i ulaz, oporavak (RC.RP) vraća i provjerava sisteme; svaka mjera balansira brzinu, dokaze i posmatranje napadača.
- Obuzdavaj u jednom potezu za sve poznate tačke; automatika je korisna, ali handler mora moći birati ručno.
- Linux: iptables izolacija uz izuzetak za IR (prekida i postojeće konekcije), `usermod -L`, `chage -E 0`, `kill -STOP`; za ozbiljne incidente rebuild umjesto čišćenja.
- Kontejneri: `docker pause`, `docker diff`, `docker export`; u Kubernetesu karantin labela (izlazak iz ReplicaSeta i Servicea) + deny-all NetworkPolicy, `cordon`, uklanjanje bindinga; ispravka slike i deploy po digestu.
- AWS: deaktivacija ključa, `AWSDenyAll`, opoziv sesija role (`aws:TokenIssueTime`), EC2 snapshot i izolaciona security grupa (praćene konekcije ostaju, pa NACL), DNS ide mimo SG/NACL. Entra: onemogući nalog i opozovi sesije.
- Runbook: okidač, preduslovi, numerisani koraci sa provjerom, odluke, dokazi, komunikacija, zatvaranje; za ključ prvo opoziv, za storage prvo Block Public Access, za kriptominer i ulaznu tačku.
- Analiza nakon incidenta je bez okrivljavanja, sa vremenskom linijom, metrikama (MTTD, MTTC, MTTR) i akcijama sa vlasnikom i rokom; nalazi idu u ID.IM i u sljedeći purple team ciklus.
