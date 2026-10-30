## Šta ovaj scenario pokriva

Scenario pokriva sva četiri cilja domene 2:

- **2.1** Pronalazak izvora curenja: git istorija, gitleaks, CI logovi.
- **2.2** Istraga CloudTraila: enumeracija, eskalacija privilegija, perzistencija.
- **2.3** Procjena štete: pristup S3 podacima, obim i uticaj.
- **2.4** Obuzdavanje i iskorjenjivanje u AWS-u i Sigma detekcija za ubuduće.

Ovo je najčešći cloud incident u praksi: statični access ključ završi tamo gdje ga može vidjeti bilo ko, i napadač ga nađe prije tima. Alati su poznati iz drugih kurseva (gitleaks iz DevSecOps-a, CloudTrail iz AWS Security Specialty i detection laba, Sigma i Zircolite iz kursa 07). Novo je to što ih ovdje koristiš redom, pod pritiskom, sa jednim pitanjem u glavi: **šta je napadač mogao, šta je uradio i kako ga izbaciti bez da srušiš produkciju**.

## Priča

**Kvadrat d.o.o.** je firma za logistiku i online prodaju sa jednim produkcijskim AWS nalogom (`111122223333`) u organizaciji sa SCP-ovima. Ljudi u priči:

| Osoba / nalog | Uloga |
|---|---|
| Marko Petrović | developer servisa `izvjestaji-servis` |
| Jelena Ilić | developer, kolega u timu |
| Ana Kovač | SOC analitičarka, dežurna u ponedjeljak ujutro |
| `svc-izvjestaji` | IAM korisnik sa statičnim ključem; noćni servis čita izvoz kupaca i piše izvještaje |
| `jenkins-legacy` | stari IAM korisnik za Jenkins build, ima svoj ključ |
| `kupci-api-ecs-task` | IAM rola aplikacije; čita profile kupaca preko VPC endpointa |

Politika `izvjestaji-s3-export` zakačena za `svc-izvjestaji` dozvoljava čitanje `kvadrat-kupci-prod/exports/*` i pisanje u `kvadrat-izvjestaji`. Neko je ranije dodao i `iam:Get*`, `iam:List*` i `iam:CreatePolicyVersion` nad tom politikom, „da servis može sam da ažurira svoja prava“. To je rupa kroz koju je napadač prošao.

### Vremenska linija

| Vrijeme (UTC) | Događaj |
|---|---|
| 12. 10. 11:58 | Marko commituje `config/settings.py` sa `AWS_ACCESS_KEY_ID` i `AWS_SECRET_ACCESS_KEY` („Brzi fix: export radi i sa laptopa“) |
| 12. 10. 12:21 | CI job 4812 izvršava `env \| sort` za debug; CI varijable nisu maskirane i ključ završava u logu. Projekat je greškom `public` |
| 13. 10. 07:12 | Marko uklanja ključ iz koda („Očisti konfiguraciju“). Ključ **nije rotiran**: commit ostaje u istoriji, a log joba 4812 i dalje je javan |
| 19. 10. 02:14 | Prvi poziv sa `203.0.113.45` (AWS CLI na Kali Linuxu): `GetCallerIdentity`, pa enumeracija IAM-a i S3 |
| 19. 10. 02:16–02:17 | `AccessDenied` na bazi kupaca i EC2: ključ nema ta prava |
| 19. 10. 02:19 | `CreatePolicyVersion` sa `setAsDefault: true`: nova verzija `v3` politike daje `"Action": "*"` |
| 19. 10. 02:20–02:21 | `CreateUser aws-support-sync`, `AttachUserPolicy AdministratorAccess`, `CreateAccessKey`, `CreateLoginProfile`, pa `CreateAccessKey` i za postojećeg `jenkins-legacy` |
| 19. 10. 02:41–02:44 | Sa druge adrese (`198.51.100.23`, VPS) novim ključem: preuzimanje baze kupaca, tokena kartica, ugovora i finansijskih izvještaja |
| 19. 10. 02:47–02:48 | `StopLogging`, `DeleteTrail` i `DeleteDetector`: sve odbija SCP |
| 19. 10. 08:10 | Ana vidi GuardDuty nalaz `PenTest:IAMUser/KaliLinux` niske važnosti |

Primijeti razmak od sedam dana između curenja i napada, i šest sati između napada i reakcije. Brisanje ključa iz koda 13. 10. nije ništa riješilo: jedina ispravna reakcija na procurjeli ključ je **rotacija** (deaktivacija i novi ključ), odmah.

## Lanac napada i MITRE ATT&CK

| Faza | Šta je napadač uradio | Dokaz | ATT&CK |
|---|---|---|---|
| Pronalazak tajne | ključ u javnom repou i CI logu | git istorija, CI log | T1593.003 Search Open Websites/Domains: Code Repositories, T1552.001 Credentials In Files |
| Inicijalni pristup | poziv sa tuđe adrese važećim ključem | CloudTrail `GetCallerIdentity` | T1078.004 Valid Accounts: Cloud Accounts |
| Izviđanje | `ListUsers`, `GetAccountAuthorizationDetails`, `ListBuckets`, `ListObjects` | CloudTrail | T1087.004 Account Discovery: Cloud Account, T1580, T1619 Cloud Storage Object Discovery |
| Eskalacija | nova podrazumijevana verzija vlastite politike | `CreatePolicyVersion` | T1098.003 Additional Cloud Roles |
| Perzistencija | novi korisnik, admin politika, ključ i lozinka; drugi ključ za `jenkins-legacy` | `CreateUser`, `AttachUserPolicy`, `CreateAccessKey`, `CreateLoginProfile` | T1136.003 Create Account: Cloud Account, T1098.001 Additional Cloud Credentials |
| Prikupljanje | `GetObject` nad bazom, ugovorima, finansijama | S3 data events | T1530 Data from Cloud Storage |
| Slabljenje odbrane | `StopLogging`, `DeleteTrail`, `DeleteDetector` (odbijeno) | CloudTrail `errorCode` | T1685.002 Disable or Modify Cloud Log (ranije T1562.008), T1685 (ranije T1562.001) |

Novije verzije ATT&CK-a podijelile su taktiku Defense Evasion na **Stealth** i **Defense Impairment**, pa su tehnike gašenja logova dobile nove ID-jeve. SigmaHQ pravila već koriste `attack.defense-impairment` i `attack.t1685.002`; stari ID ćeš još sretati u alatima i izvještajima.

## Faza 1: odakle je ključ procurio (2.1)

Prvo pitanje nije „ko je napadač“ nego „koliko dugo i gdje je ključ bio izložen“. Od toga zavisi period koji pretražuješ u CloudTrailu i lista mjesta koja treba očistiti.

### Git istorija

`grep` nad trenutnom verzijom koda ne nalazi ništa, jer je ključ uklonjen. Git čuva svaki commit, pa ključ ostaje u istoriji, u svakom kloniranom repou i u svakom forku:

```bash
cd izvjestaji-servis
gitleaks git -v .                              # skenira sve commitove
gitleaks git --report-format json --report-path leaks.json .
jq -r '.[] | [.Commit[0:8], .File, .StartLine, .RuleID, .Date] | @tsv' leaks.json
git log --reverse -S 'AKIA4NQXR7ZK2LWB5HTM' --format='%h %ad %an %s' --date=iso
git show bcf32b3 -- config/settings.py
```

`git log -S` (pickaxe) prikazuje commitove u kojima se broj pojavljivanja niza promijenio: onaj koji ga je dodao i onaj koji ga je uklonio. Za vremensku liniju treba prvi. Gitleaks namjerno ignoriše `AKIAIOSFODNN7EXAMPLE` iz AWS dokumentacije (pravilo ima allowlist za ključeve koji se završavaju na `EXAMPLE`), pa test fixture nije lažni pozitiv.

> **U praksi:** Prepisivanje istorije (`git filter-repo`, BFG) je kozmetika poslije rotacije, ne zamjena za nju. Kopije su već u klonovima, forkovima, CI kešu i arhivama na koje nemaš uticaj. Prvo rotiraj, pa čisti.

### CI logovi

Drugi izvor je log joba. Debug korak `env | sort` ispisao je sve varijable okruženja, a CI varijable sa ključem nisu bile označene kao **masked**:

```bash
gitleaks dir -v ci/
grep -n 'AWS_' ci/*.log
```

CI logovi su često vidljivi šire od koda (javni projekti, gosti, artefakti koji se čuvaju mjesecima). Pri procjeni izloženosti zato gledaš i vidljivost projekta, ko je mogao vidjeti log i koliko se logovi čuvaju. Ključ je ovdje bio javan od 12. 10. 12:21, pa CloudTrail pretražuješ bar od tog trenutka.

## Faza 2: istraga CloudTraila (2.2)

Izvoz je jedan događaj po liniji. Ako imaš fajlove iz S3 (`{"Records":[...]}`), `jq -c '.Records[]'` ih pretvori u isti oblik.

### Ko koristi ključ

```bash
K=AKIA4NQXR7ZK2LWB5HTM
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k) | [.sourceIPAddress, .userAgent[0:50]] | @tsv' events.jsonl | sort | uniq -c
```

Legitimni servis zove sa `192.0.2.50` kroz Boto3, svaku noć u 01:00, uvijek iste pozive. Napadač zove sa nove adrese, AWS CLI-jem, sa `md/distrib#kali` u User-Agentu (zato GuardDuty prijavljuje `PenTest:IAMUser/KaliLinux`). Nova IP adresa + novi alat + `GetCallerIdentity` kao prvi poziv je klasičan potpis ukradenog ključa.

### Enumeracija i greške

```bash
jq -r --arg k $K 'select(.userIdentity.accessKeyId==$k and .sourceIPAddress!="192.0.2.50")
  | [.eventTime, .eventName, (.errorCode // "OK")] | @tsv' events.jsonl
```

`GetAccountAuthorizationDetails` u jednom pozivu vraća sve korisnike, role, grupe i politike sa dokumentima. Napadaču je to mapa naloga, a tebi znak da napadač zna sve što i ti. Niz `AccessDenied` grešaka pokazuje kako je isprobavao granice ključa.

### Eskalacija kroz CreatePolicyVersion

```bash
jq 'select(.eventName=="CreatePolicyVersion") | {eventTime, policy: .requestParameters.policyArn,
    default: .requestParameters.setAsDefault, doc: (.requestParameters.policyDocument | fromjson),
    version: .responseElements.policyVersion.versionId}' events.jsonl
```

Upravljana politika može imati do pet verzija, a jedna je podrazumijevana. Ko ima `iam:CreatePolicyVersion` nad politikom koja je zakačena za njega samog, može napisati verziju sa `"Action": "*"` i postaviti je kao podrazumijevanu. Za to ne treba `iam:SetDefaultPolicyVersion`: dovoljan je parametar `setAsDefault`. To je jedan od poznatih puteva eskalacije u IAM-u, uz `AttachUserPolicy`, `PutUserPolicy`, `PassRole` + `RunInstances` i `UpdateAssumeRolePolicy`. Isti obrazac traži alat kao PMapper ili IAM Access Analyzer.

### Perzistencija i pivot na nove ključeve

```bash
jq -r 'select(.eventSource=="iam.amazonaws.com" and .readOnly==false)
  | [.eventTime, .eventName, (.requestParameters.userName // "-"),
     (.requestParameters.policyArn // "-"), (.responseElements.accessKey.accessKeyId // "-")] | @tsv' events.jsonl
```

Dvije stvari se lako previde:

- `CreateAccessKey` za **postojećeg** korisnika `jenkins-legacy`. Novi korisnik upada u oči, a drugi ključ starog servisnog naloga ne. U `requestParameters.userName` je cilj, a u `userIdentity` pozivalac; kad se razlikuju, neko pravi ključ drugome.
- `CreateLoginProfile` daje novom korisniku i lozinku za konzolu. Deaktiviran ključ ne zatvara taj put.

Svaki `accessKeyId` iz `responseElements` je novi trag. Tek filtriranjem po njima vidiš drugu adresu napadača:

```bash
for k in AKIA4NQXR7ZKWJ3D6PQA AKIA4NQXR7ZKM5T2YVCE; do
  jq -r --arg k $k 'select(.userIdentity.accessKeyId==$k) | [.eventTime, .sourceIPAddress, .eventName, (.errorCode // "OK")] | @tsv' events.jsonl
done
```

## Faza 3: procjena štete (2.3)

Uprava i pravna služba pitaju samo jedno: **koji podaci su izašli**. Odgovor zavisi od toga da li su za bucket uključeni **S3 data events**. Bez njih CloudTrail bilježi samo management pozive (`ListBuckets`, `GetBucketAcl`), pa ne možeš dokazati ni da podaci jesu ni da nisu pročitani. Pravna služba tada mora pretpostaviti najgore.

```bash
S='select(.eventName=="GetObject" and (.errorCode|not) and (.sourceIPAddress=="203.0.113.45" or .sourceIPAddress=="198.51.100.23"))'
jq -r "$S | [.eventTime, .userIdentity.userName, .requestParameters.bucketName + \"/\" + .requestParameters.key, .additionalEventData.bytesTransferredOut] | @tsv" events.jsonl
jq -s "[.[] | $S | .additionalEventData.bytesTransferredOut] | add" events.jsonl
```

Zamke kod brojanja:

| Zamka | Kako je izbjeći |
|---|---|
| Isti bucket legitimno čitaju aplikacija (`10.20.3.14`) i server izvještaja | filtriraj po identitetu **i** adresi napadača, ne po bucketu |
| Odbijeni `GetObject` (`AccessDenied`) | nije curenje, ali pokazuje namjeru; navedi ga odvojeno |
| Napadač mijenja ključ i adresu | uključi sve kredencijale iz faze perzistencije |
| Isti objekat pročitan dva puta | za listu objekata `sort -u`, za količinu podataka saberi sve |
| `ListObjects` | otkriva imena objekata (i u njima lične podatke), čak i bez `GetObject` |

U ovom scenariju napadač je pročitao 11 objekata (oko 122 MB preuzetog saobraćaja, jer je punu bazu preuzeo dvaput): punu bazu kupaca, adrese isporuke, tokene kartica, pet ugovora, jedan dnevni izvoz i dva finansijska izvještaja. To su lični podaci kupaca, pa nastaje obaveza prijave nadležnom organu za zaštitu podataka (prema GDPR-u u roku od 72 sata od saznanja) i, zavisno od procjene rizika, obavještavanja kupaca. Tokeni kartica uključuju i procesora plaćanja (PCI DSS). Procjenu obima zato pišeš činjenično: šta je sigurno pročitano, šta je pokušano, a šta se ne može utvrditi.

## Tačke odluke

**Odmah ugasiti ili prvo posmatrati?** Napadač ima admin prava i aktivan je u nalogu, pa posmatranje nosi preveliki rizik. Posmatranje ima smisla kad je pristup ograničen i kad treba otkriti dodatnu infrastrukturu napadača. Ovdje prvo obuzdavaš.

**Šta prvo?** Ono što zatvara najviše puteva najbrže i što se može vratiti:

1. Inline `Deny *` politika na `svc-izvjestaji` i `aws-support-sync`. Djeluje odmah na sve njihove ključeve, i na one koje možda još nisi pronašao, a ne briše dokaze.
2. Deaktivacija (`Inactive`) sva tri ključa: procurjelog i dva koja je napravio napadač. Brisanje tek poslije istrage.
3. Brisanje login profila `aws-support-sync` i vraćanje politike `izvjestaji-s3-export` na `v2` (pa brisanje `v3`).
4. Pretraga ostalih tragova po cijelom nalogu i svim regijama: role sa novim trust politikama, Lambda funkcije, EC2 key pairovi, novi IAM Identity Center korisnici.

**Šta ne raditi:** `Deny *` na `jenkins-legacy` srušio bi build i deploy. Dovoljno je ugasiti samo ključ koji je napravio napadač (`AKIA4NQXR7ZKM5T2YVCE`), a legitimni ključ ostaviti dok se Jenkins ne prebaci na rolu. Ne briši ni napadačevog korisnika prije nego što sačuvaš njegove politike i ključeve kao dokaz.

**Role i sesije:** statični ključ IAM korisnika se gasi deaktivacijom. Privremene kredencijale role (STS) ne možeš obrisati, pa se koristi Deny sa uslovom `aws:TokenIssueTime` (opcija Revoke active sessions u konzoli). U ovom scenariju napadač nije preuzimao role, što si provjerio pretragom `AssumeRole` događaja.

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Sid": "IRDenyAll", "Effect": "Deny", "Action": "*", "Resource": "*" }]
}
```

## Obuzdavanje, iskorjenjivanje i oporavak (2.4)

```bash
POL=arn:aws:iam::111122223333:policy/izvjestaji-s3-export
aws iam put-user-policy --user-name svc-izvjestaji --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam put-user-policy --user-name aws-support-sync --policy-name ir-deny-all --policy-document file://deny-all.json
aws iam update-access-key --user-name svc-izvjestaji --access-key-id AKIA4NQXR7ZK2LWB5HTM --status Inactive
aws iam update-access-key --user-name aws-support-sync --access-key-id AKIA4NQXR7ZKWJ3D6PQA --status Inactive
aws iam update-access-key --user-name jenkins-legacy --access-key-id AKIA4NQXR7ZKM5T2YVCE --status Inactive
aws iam delete-login-profile --user-name aws-support-sync
aws iam set-default-policy-version --policy-arn $POL --version-id v2
aws iam delete-policy-version --policy-arn $POL --version-id v3
```

Poslije obuzdavanja slijedi provjera da li nešto i dalje radi: novi pozivi sa adresa napadača, `AccessDenied` sa ugašenih ključeva (znak da ih napadač još pokušava koristiti) i ključevi i korisnici koje nisi pronašao.

Iskorjenjivanje i oporavak:

- servis izvještaja prebaciti sa statičnog ključa na IAM rolu (na EC2 ili ECS) i obrisati `svc-izvjestaji` kad više ne treba,
- iz politike servisa izbaciti `iam:*`; servisima ne trebaju IAM prava, a za ljude koji ih imaju postaviti **permission boundary**,
- CI: maskirane i zaštićene varijable, OIDC umjesto ključeva (GitLab `id_tokens` → `AssumeRoleWithWebIdentity`), projekat `private`, obrisati log joba 4812,
- pregledati `jenkins-legacy` i ostale stare ključeve (`iam generate-credential-report`), ugasiti nekorištene,
- tek na kraju obrisati `aws-support-sync` i napadačeve ključeve, uz snimljene dokaze (izvoz CloudTraila, `get-account-authorization-details` prije i poslije).

Napad je zaustavio **SCP** koji zabranjuje `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail` i `guardduty:DeleteDetector` svima osim break-glass role. Ni `AdministratorAccess` ne može zaobići SCP, pa su logovi ostali sačuvani. Bez njega istraga bi bila nagađanje.

## Šta bi ga ranije otkrilo

| Kontrola | Gdje bi prekinula lanac |
|---|---|
| gitleaks u pre-commit hooku i CI-ju, secret push protection | commit 12. 10. ne bi prošao |
| maskirane CI varijable, bez `env` u logu | job 4812 ne bi ispisao ključ |
| bez statičnih ključeva (role, OIDC) | ne bi bilo šta da procuri |
| alarm na prvu upotrebu ključa sa nove ASN/IP adrese ili novim User-Agentom | 19. 10. u 02:14, a ne u 08:10 |
| GuardDuty nalazi preko EventBridgea u SOC, i oni niske važnosti za IAM korisnike | `PenTest:IAMUser/KaliLinux` u 02:14 |
| detekcija `CreatePolicyVersion` sa `setAsDefault`, `CreateUser`, `CreateAccessKey` za drugog korisnika | 02:19–02:21 |
| detekcija `StopLogging`/`DeleteTrail` (i odbijenih) | 02:47 |

Sigma pravilo za gašenje CloudTraila (iz laba):

```yaml
title: AWS CloudTrail zaustavljen ili obrisan
logsource: { product: aws, service: cloudtrail }
detection:
  selection:
    eventSource: cloudtrail.amazonaws.com
    eventName: [StopLogging, DeleteTrail]
  condition: selection
tags: [attack.defense-impairment, attack.t1685.002]
level: high
```

Pravilo namjerno hvata i odbijene pokušaje: `AccessDenied` na `StopLogging` znači da neko sa ozbiljnim namjerama već ima kredencijale u nalogu. Isti upit u Sentinelu, nad tabelom `AWSCloudTrail`:

```kql
AWSCloudTrail
| where EventSource == "cloudtrail.amazonaws.com" and EventName in ("StopLogging", "DeleteTrail")
| project TimeGenerated, UserIdentityArn, UserIdentityAccessKeyId, SourceIpAddress, ErrorCode
```

Pravilo za eskalaciju u Sigmi:

```yaml
detection:
  selection:
    eventSource: iam.amazonaws.com
    eventName: CreatePolicyVersion
    requestParameters.setAsDefault: true
  condition: selection
```

## Rezime

- Brisanje ključa iz koda ne rješava ništa. Procurjeli ključ se **rotira odmah**, a istorija se čisti poslije.
- Izvor curenja određuje period istrage: od prvog izlaganja (commit, CI log) do opoziva.
- U CloudTrailu prvo razdvoji legitimnu i napadačevu upotrebu istog ključa (IP, User-Agent, obrazac poziva), pa pivotiraj na svaki novi kredencijal iz `responseElements`.
- `CreatePolicyVersion` sa `setAsDefault` nad vlastitom politikom je eskalacija bez ijednog `Attach*` poziva.
- Bez S3 data events ne možeš dokazati šta nije pročitano.
- Obuzdavanje: `Deny *` na kompromitovane korisnike, deaktivacija svih napadačevih ključeva, login profil, vraćanje verzije politike. Legitimne servise ne ruši.
- SCP koji štiti CloudTrail i GuardDuty je razlog zašto ovaj incident ima dokaze.

## Veze sa drugim kursevima

- [DevSecOps: Tajne u kodu](#/06-devsecops/m/03-tajne-u-kodu): gitleaks, pre-commit, istorija i rotacija
- [DevSecOps: Sigurnost CI/CD platforme](#/06-devsecops/m/02-sigurnost-ci-cd-platforme): maskirane varijable, OIDC umjesto ključeva
- [DevSecOps: Vault](#/06-devsecops/m/04-vault): dinamički AWS kredencijali umjesto statičnih
- [AWS Security Specialty: Logovanje i analiza](#/03-aws-security-specialty/m/02-logovanje-i-analiza): CloudTrail, data events, Athena
- [AWS Security Specialty: Odgovor na incidente](#/03-aws-security-specialty/m/03-odgovor-na-incidente): kompromitovani ključ, opoziv sesija
- [AWS Security Specialty: IAM autorizacija](#/03-aws-security-specialty/m/07-iam-autorizacija): verzije politika, permission boundary
- [AWS Security Specialty: Multi-account governance](#/03-aws-security-specialty/m/10-multi-account-governance): SCP koji štiti CloudTrail
- [Detekcija i odgovor: Cloud i Kubernetes logovi](#/07-detekcija-i-odgovor/m/02-cloud-i-kubernetes-logovi): jq upiti nad CloudTrailom
- [Detekcija i odgovor: MITRE ATT&CK](#/07-detekcija-i-odgovor/m/05-mitre-attack): T1685 i novi ID-jevi
- [Detekcija i odgovor: Sigma](#/07-detekcija-i-odgovor/m/06-sigma): pisanje i testiranje pravila sa Zircoliteom
- [Detekcija i odgovor: Obuzdavanje i runbookovi](#/07-detekcija-i-odgovor/m/10-obuzdavanje-i-runbookovi): redoslijed obuzdavanja
- [SC-200: Unos podataka](#/08-sc200/m/04-unos-podataka): AWS konektor i tabela `AWSCloudTrail`
- [CySA+: IR tehnike](#/09-cysa/m/10-ir-tehnike): procjena obima i vremenska linija
- [CISSP: Pravo, istrage i politike](#/11-cissp/m/02-pravo-istrage-politike): obaveza prijave curenja podataka
