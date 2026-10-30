## Šta ovaj modul pokriva

Modul pokriva zadatak **3.2** iz domena 3 (**Infrastructure Security**, 18% ispita): dizajn, implementacija i troubleshooting sigurnosnih kontrola za compute workloade. Vještine:

- **3.2.1** hardened EC2 AMI i container image (Systems Manager, EC2 Image Builder),
- **3.2.2** instance profile, service role i execution role na pravom mjestu,
- **3.2.3** skeniranje ranjivosti (Amazon Inspector za ECR i Lambda, GuardDuty za runtime),
- **3.2.4** automatsko patchovanje i kontinuirana validacija (Patch Manager + Inspector),
- **3.2.5** siguran administrativni pristup (Session Manager, EC2 Instance Connect),
- **3.2.6** alati za ranjivosti u pipeline-u (Amazon Q Developer, CodeGuru Security),
- **3.2.7** guardrails za generativni AI (OWASP Top 10 for LLM Applications).

Ispit ovdje rijetko pita „šta je servis X“. Tipično daje scenarij: „EC2 instance su u privatnom subnetu, kompanija ne želi otvarati port 22 ni održavati bastion…“ ili „Lambda funkcija pristupa DynamoDB tabeli sa hardkodovanim ključevima…“. Ti biraš rješenje sa **najmanje operativnog napora** koje je i dalje **least privilege**.

## 3.2.1 Hardened AMI i container image

### Zlatni image (golden image)

Ideja je jednostavna: ne hardenuješ svaku instancu ručno, nego jednom napraviš **golden AMI** sa ugrađenim kontrolama i iz njega pokrećeš sve. Ugrađuje se:

- minimalan OS, uklonjeni nepotrebni paketi i servisi,
- CIS ili STIG hardening, podešen `sshd` (ili SSH potpuno isključen jer koristiš Session Manager),
- **SSM Agent**, CloudWatch agent, eventualno GuardDuty security agent,
- najnovije zakrpe u trenutku builda,
- IMDSv2 kao obavezan (`HttpTokens=required`) na nivou AMI-ja (`--imds-support v2.0`).

### EC2 Image Builder

**EC2 Image Builder** je managed servis koji automatizuje build, test i distribuciju AMI-ja i container imagea.

| Pojam | Šta je |
|---|---|
| **Image recipe** / **container recipe** | Bazni image + lista komponenti. |
| **Component** | YAML dokument sa koracima (build/validate/test). AWS nudi gotove komponente, npr. za STIG hardening i update OS-a. |
| **Infrastructure configuration** | Na kojoj instanci, subnetu i sa kojim instance profileom se build radi. |
| **Distribution configuration** | U koje regione i naloge se AMI kopira, sa kojim KMS ključem, launch permissions. |
| **Image pipeline** | Raspored (npr. sedmično ili kad izađe novi bazni image) koji sve to pokreće. |

Image Builder ima ugrađeno skeniranje sa **Amazon Inspector**: nakon builda image se skenira i vidiš CVE nalaze prije distribucije. Pipeline se može pokretati na raspored, pa svaki novi build automatski uzima zakrpe.

```bash
# AMI koji zahtijeva IMDSv2 za sve instance pokrenute iz njega
aws ec2 register-image --name golden-al2023-2026-10 \
  --root-device-name /dev/xvda --block-device-mappings file://bdm.json \
  --imds-support v2.0
```

### Container image

Za kontejnere važi isto, ali sa drugim alatima:

- minimalan bazni image (distroless, `-minimal` varijante), bez shella gdje je moguće,
- `USER` koji nije root, read-only root filesystem u task definiciji ili pod specifikaciji,
- **Amazon ECR** sa **tag immutability** (tag se ne može prepisati), enkripcijom (AES-256 ili KMS) i skeniranjem,
- potpisivanje imagea (AWS Signer sa Notation) i provjera potpisa prije deploya.

> **Na ispitu:** „Standardizovati hardening i automatski praviti nove AMI-je kad izađu zakrpe, uz najmanje operativnog napora“ = **EC2 Image Builder pipeline** sa rasporedom. Ručno pravljenje AMI-ja, Packer na vlastitoj instanci ili skripta u user data su distraktori koji traže više održavanja.

## 3.2.2 Uloge za compute: ko nosi kredencijale

Pravilo broj jedan: **nikad dugotrajni access key na instanci, u kontejneru ili u Lambda env varijabli.** Svaki compute servis ima svoj mehanizam za privremene kredencijale.

| Mehanizam | Za šta | Ko pretpostavlja ulogu (trust policy principal) |
|---|---|---|
| **Instance profile** | EC2 instanca. Kontejner za rolu, kredencijali preko IMDS-a. | `ec2.amazonaws.com` |
| **Service role** | AWS servis radi nešto u tvoje ime (npr. CodeBuild, Image Builder, Backup). | Taj servis, npr. `codebuild.amazonaws.com` |
| **Service-linked role** | Unaprijed definisana uloga koju servis sam kreira i koju ne možeš mijenjati. | Servis; dozvole definiše AWS |
| **Lambda execution role** | Šta Lambda funkcija smije raditi (npr. čitati DynamoDB, pisati logove). | `lambda.amazonaws.com` |
| **ECS task execution role** | ECS agent: povući image iz ECR-a, poslati logove, pročitati tajne za env varijable. | `ecs-tasks.amazonaws.com` |
| **ECS task role** | Šta **aplikacija u kontejneru** smije raditi. | `ecs-tasks.amazonaws.com` |
| **EKS IRSA** | Pod preko Kubernetes service accounta dobija IAM ulogu (OIDC federacija). | OIDC provider klastera (`AssumeRoleWithWebIdentity`) |
| **EKS Pod Identity** | Noviji način: asocijacija service account → uloga preko EKS API-ja, bez OIDC providera po klasteru. | `pods.eks.amazonaws.com` |

Ne miješaj **Lambda execution role** (šta funkcija smije) i **resource-based policy na funkciji** (ko smije pozvati funkciju, npr. S3 ili API Gateway). Isto tako, **task execution role** služi ECS-u da pokrene task, a **task role** služi tvom kodu.

Trust policy za EKS Pod Identity:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "pods.eks.amazonaws.com" },
    "Action": ["sts:AssumeRole", "sts:TagSession"]
  }]
}
```

Trust policy za IRSA (vezano za tačan namespace i service account):

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/oidc.eks.eu-central-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "oidc.eks.eu-central-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:sub": "system:serviceaccount:payments:api",
      "oidc.eks.eu-central-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:aud": "sts.amazonaws.com"
    }
  }
}
```

Bez uslova na `:sub` svaki pod u klasteru bi mogao preuzeti ulogu. Kod IRSA i Pod Identity treba i blokirati podovima pristup IMDS-u čvora (hop limit 1 uz IMDSv2), inače pod može uzeti kredencijale **node role**.

> **Na ispitu:** „Kontejner ne može povući image iz privatnog ECR-a“ = problem u **task execution role**. „Aplikacija u kontejneru dobija AccessDenied na S3“ = problem u **task role**. „Različiti podovi na istom EKS čvoru trebaju različite dozvole“ = **IRSA ili Pod Identity**, nikako proširivanje node role.

### IMDSv2

**Instance Metadata Service v2** traži session token (`PUT` zahtjev) prije čitanja metapodataka. To blokira klasični SSRF napad gdje aplikacija natjerana da napravi `GET http://169.254.169.254/...` vrati kredencijale role.

```bash
# Postojeća instanca: obavezan IMDSv2, hop limit 1 (kontejneri na hostu ne dosežu IMDS)
aws ec2 modify-instance-metadata-options --instance-id i-0abc123 \
  --http-tokens required --http-put-response-hop-limit 1

# Podrazumijevano za sve nove instance u regionu
aws ec2 modify-instance-metadata-defaults --http-tokens required
```

Na nivou organizacije forsiraš ga SCP-om: zabrani `ec2:RunInstances` ako `ec2:MetadataHttpTokens` nije `required`. GuardDuty ima nalaz `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS` kad se kredencijali instance koriste van AWS-a.

## 3.2.3 Skeniranje ranjivosti i runtime monitoring

### Amazon Inspector

**Amazon Inspector** kontinuirano i automatski skenira workload-e za poznate CVE i neželjenu mrežnu izloženost. Aktivira se po nalogu ili centralno preko **delegated administrator** naloga u Organizations.

| Tip skeniranja | Šta skenira | Napomene |
|---|---|---|
| **EC2 scanning** | OS paketi i aplikacioni paketi, mrežna dostupnost. | Agent-based (SSM Agent mora raditi) ili agentless (EBS snapshot) u **hybrid** modu. |
| **ECR scanning (enhanced)** | Container image u ECR-u, OS i jezički paketi. | On push + kontinuirano ponovno skeniranje kad izađe novi CVE. ECR **basic scanning** je jednostavnija alternativa bez kontinuiranog praćenja. |
| **Lambda standard scanning** | Zavisnosti (paketi) u funkciji i layerima. | Funkcija pozvana ili mijenjana u zadnjih 90 dana. |
| **Lambda code scanning** | Vlastiti kod funkcije: injection, hardkodovane tajne, slaba kriptografija. | Zahtijeva da je standard scanning uključen. |
| **Code Security** | Izvorni kod, zavisnosti i IaC u GitHub/GitLab repozitorijima. | Noviji dodatak, zamjena za dio CodeGuru Security funkcija. |

Inspector daje **Inspector score** (CVSS prilagođen kontekstu, npr. nema mrežne izloženosti → niži rizik). Nalazi idu u **Security Hub** i **EventBridge**, pa ih možeš automatski usmjeriti u ticketing ili remedijaciju. Za pipeline postoji `inspector-sbomgen` i API `inspector-scan:ScanSbom` koji skenira SBOM prije push-a.

Napomena: Inspector ne skenira Lambda funkcije enkriptovane customer managed KMS ključem.

### GuardDuty Runtime Monitoring

Inspector traži **poznate ranjivosti** (statično). **GuardDuty Runtime Monitoring** posmatra **ponašanje u toku rada**: pokretanje novih binarija, reverse shell, crypto mining, izmjene u kontejneru, eskalaciju privilegija. Radi preko **GuardDuty security agenta** za:

- **Amazon EKS** (EKS add-on, može ga GuardDuty automatski upravljati),
- **Amazon ECS** na **Fargate** (agent kao sidecar, automatski) i na EC2,
- **Amazon EC2** instance (agent preko SSM-a).

GuardDuty **Malware Protection for EC2** skenira EBS volumene (snapshot) kad GuardDuty posumnja na malver; postoji i **Malware Protection for S3** za nove objekte u bucketu.

> **Na ispitu:** „Kontinuirano otkrivati nove CVE u imageima i Lambda funkcijama“ = **Inspector**. „Otkriti da je proces u kontejneru otvorio reverse shell ili pokrenuo crypto miner“ = **GuardDuty Runtime Monitoring**. „Hardkodovana tajna u kodu Lambda funkcije“ = **Inspector Lambda code scanning**.

## 3.2.4 Patch management

### Systems Manager Patch Manager

**Patch Manager** automatizuje skeniranje i instalaciju zakrpa na EC2, on-prem serverima i edge uređajima (managed nodes).

- **Patch baseline**: pravila koja zakrpa se smatra odobrenom. AWS ima **predefined baselines** po OS-u; ti praviš **custom baseline** sa pravilima npr. „Security, Critical, auto-approve nakon 7 dana“, listom eksplicitno odobrenih i odbijenih zakrpa.
- **Patch policy** (preko **Quick Setup**): centralno, za cijelu organizaciju i više regiona, definiše raspored, baseline i operaciju (Scan ili Scan and install). Preporučeni moderan način.
- **Patch groups** (tag `Patch Group`): stariji način vezivanja baseline-a za grupu instanci.
- **Maintenance windows**: vremenski prozor u kom se smiju raditi rizične operacije (instalacija + reboot), sa targetima, taskovima, rate kontrolama i error threshold-om.
- Dokument **`AWS-RunPatchBaseline`** sa operacijom `Scan` (samo izvještaj) ili `Install`.

Rezultat ide u **Systems Manager Compliance** (compliant / non-compliant), a odatle u **AWS Config** i Security Hub. Kontinuirana validacija: **Inspector** nakon patchovanja potvrđuje da CVE više nije prisutan.

```bash
# Ručno skeniranje patch statusa grupe instanci po tagu
aws ssm send-command --document-name "AWS-RunPatchBaseline" \
  --targets "Key=tag:Env,Values=prod" \
  --parameters "Operation=Scan"
```

### Immutable pristup

Za Auto Scaling grupe i kontejnere često je bolje ne patchovati u mjestu nego **zamijeniti**: Image Builder napravi novi AMI, launch template dobije novu verziju, **instance refresh** zamijeni instance. Za ECS/EKS: novi image, novi deploy.

> **Na ispitu:** „Instalirati kritične sigurnosne zakrpe na sve Windows i Linux instance samo nedjeljom od 02:00 do 04:00, u svim nalozima organizacije, uz najmanje napora“ = **Patch Manager patch policy (Quick Setup)** + maintenance window. Lambda koja radi `yum update` preko SSH je pogrešna.

## 3.2.5 Siguran administrativni pristup

| Opcija | Kako radi | Kad je izabrati |
|---|---|---|
| **Session Manager** | SSM Agent otvara izlaznu vezu ka SSM servisu; shell u browseru ili CLI. Nema ulaznih portova, nema SSH ključeva. IAM kontroliše ko smije, sesije se loguju u S3/CloudWatch Logs, mogu se šifrovati KMS-om. | Podrazumijevani izbor. Radi i u privatnom subnetu preko VPC endpointa (`ssm`, `ssmmessages`, `ec2messages`). |
| **EC2 Instance Connect** | IAM-kontrolisano slanje jednokratnog javnog SSH ključa koji važi 60 sekundi. Svaki push se loguje u CloudTrail. | Kad treba baš SSH (npr. alat koji radi preko SSH-a). |
| **EC2 Instance Connect Endpoint** | Endpoint u VPC-u kroz koji se spajaš na privatne instance (SSH/RDP) bez javne IP i bez bastiona. | Privatne instance, SSH/RDP potreban, bez bastion hosta. |
| **Bastion host** | Javna instanca sa SSH-om kao skakaonica. | Na ispitu skoro uvijek distraktor (više održavanja, otvoren port). |

Session Manager zahtijeva: SSM Agent, instance profile sa `AmazonSSMManagedInstanceCore` (ili **Default Host Management Configuration** koja to radi na nivou naloga) i mrežni put do SSM endpointa. Port forwarding (`AWS-StartPortForwardingSessionToRemoteHost`) omogućava pristup npr. RDS bazi kroz instancu bez otvaranja portova.

IAM politika koja ograničava Session Manager na instance sa određenim tagom:

```json
{
  "Effect": "Allow",
  "Action": "ssm:StartSession",
  "Resource": "arn:aws:ec2:*:111122223333:instance/*",
  "Condition": { "StringEquals": { "ssm:resourceTag/Team": "${aws:PrincipalTag/Team}" } }
}
```

> **Na ispitu:** „Ukloniti SSH pristup, zatvoriti port 22 i imati audit svih komandi“ = **Session Manager** sa logovanjem u S3/CloudWatch. Ako instanca „ne pojavljuje se u Fleet Manageru“, provjeri tri stvari: agent, instance profile, mrežni put (VPC endpointi ili NAT).

## 3.2.6 Sigurnost u CI/CD pipeline-u

Cilj je naći ranjivost **prije** deploya (shift left):

| Alat | Šta radi |
|---|---|
| **Amazon Q Developer** | Code review i security scanning u IDE-u i u GitHub/GitLab integracijama: SAST, detekcija tajni, IaC problemi, ranjive zavisnosti (SCA), uz predloge ispravke. |
| **Amazon Inspector** | Skeniranje imagea u ECR-u, SBOM skeniranje u pipeline-u (`inspector-sbomgen`, CI/CD plugini), Code Security za repozitorije. |
| **Amazon CodeGuru Security** | SAST servis koji je bio namijenjen pipeline-u. **AWS je ukinuo podršku 20. novembra 2025.**; konzola i historijski nalazi više nisu dostupni. AWS kao zamjenu navodi Amazon Q Developer i Amazon Inspector (code security). |
| **CodeBuild + alati trećih strana** | Npr. Trivy, Semgrep, Checkov kao koraci builda; build pada na kritičnim nalazima. |

Exam guide za SCS-C03 i dalje pominje CodeGuru Security kao primjer. Ako se pojavi u pitanju, ulogu mu prepoznaj kao „SAST skeniranje koda u pipeline-u“, ali u praksi danas biraš Q Developer ili Inspector.

Tipičan pipeline: commit → CodeBuild (unit testovi, SAST, IaC skener) → build imagea → push u ECR → Inspector scan → **gate** (Lambda ili korak koji čita nalaze; kritični CVE = stop) → deploy. Pipeline uloge (CodeBuild service role) moraju biti least privilege: build ne treba prava za produkciju.

> **Na ispitu:** „Developeri trebaju dobiti povratnu informaciju o ranjivostima u kodu dok pišu kod u IDE-u“ = **Amazon Q Developer**. „Blokirati deploy imagea sa kritičnim CVE“ = Inspector nalazi + gate u pipeline-u (EventBridge/Lambda ili korak koji provjerava nalaze).

## 3.2.7 Zaštita generativnih AI aplikacija

### OWASP Top 10 for LLM Applications 2025

| ID | Rizik | AWS kontrola (primjeri) |
|---|---|---|
| **LLM01** | **Prompt Injection** (direktan i indirektan, npr. instrukcije skrivene u dokumentu) | Bedrock Guardrails **prompt attack** filter, odvajanje sistemskih instrukcija od korisničkog unosa, validacija ulaza. |
| **LLM02** | **Sensitive Information Disclosure** | Guardrails **sensitive information filters** (PII blokiranje/maskiranje, regex), Macie na izvornim podacima, least privilege na knowledge base. |
| **LLM03** | **Supply Chain** | Provjereni modeli i biblioteke, Inspector na zavisnostima, kontrola pristupa modelima. |
| **LLM04** | **Data and Model Poisoning** | Kontrola ko piše u S3 izvor za RAG/fine-tuning, versioning, integritet podataka. |
| **LLM05** | **Improper Output Handling** | Tretiraj izlaz modela kao nepouzdan unos: escaping, validacija prije SQL/shell/HTML. |
| **LLM06** | **Excessive Agency** | Least privilege za agente: minimalan action group, uska IAM uloga Lambda funkcije, human-in-the-loop (potvrda) za rizične akcije. |
| **LLM07** | **System Prompt Leakage** | U sistemski prompt ne stavljaj tajne ni pravila autorizacije; autorizacija se radi van modela. |
| **LLM08** | **Vector and Embedding Weaknesses** | Kontrola pristupa vektorskoj bazi, filtriranje po metapodacima (tenant), enkripcija. |
| **LLM09** | **Misinformation** | **Contextual grounding** i **Automated Reasoning checks** u Guardrails, citati izvora. |
| **LLM10** | **Unbounded Consumption** | Kvote i throttling (API Gateway, WAF rate-based), limit tokena, budžet alarmi. |

### Amazon Bedrock Guardrails

**Amazon Bedrock Guardrails** procjenjuje i **ulaz** (prompt) i **izlaz** (odgovor modela). Politike u jednom guardrailu:

- **Content filters**: hate, insults, sexual, violence, misconduct, plus **prompt attack** (jailbreak, prompt injection); podesiva jačina.
- **Denied topics**: teme o kojima aplikacija ne smije pričati (npr. investicioni savjeti).
- **Word filters**: zabranjene riječi, profanity.
- **Sensitive information filters**: PII tipovi i vlastiti regex, akcija **block** ili **mask** (anonimizacija).
- **Contextual grounding checks**: da li je odgovor utemeljen u izvoru i relevantan (protiv halucinacija u RAG-u).
- **Automated Reasoning checks**: formalna provjera odgovora prema definisanim pravilima.
- **Image content filters** za multimodalni sadržaj.

Guardrail se koristi u `InvokeModel`, `Converse` i njihovim streaming varijantama, sa Bedrock Agents i Knowledge Bases, a preko **`ApplyGuardrail`** API-ja i nezavisno od modela (npr. za model van Bedrocka).

Forsiranje guardraila IAM-om, ključ **`bedrock:GuardrailIdentifier`**:

```json
{
  "Effect": "Deny",
  "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
  "Resource": "arn:aws:bedrock:eu-central-1::foundation-model/*",
  "Condition": {
    "StringNotEquals": {
      "bedrock:GuardrailIdentifier": "arn:aws:bedrock:eu-central-1:111122223333:guardrail/gr-abc123:1"
    }
  }
}
```

### Ostale kontrole za GenAI

- **Model invocation logging** (Bedrock) u CloudWatch Logs/S3: ulazi i izlazi za audit (paziti da logovi i sami sadrže osjetljive podatke, pa ih šifruj i ograniči pristup).
- **VPC interface endpoint** za Bedrock (PrivateLink) da saobraćaj ne ide preko interneta.
- **Least privilege za agente**: action group Lambda ima ulogu samo za potrebne API-je; agent ne smije imati `*`. Za akcije sa posljedicama traži potvrdu korisnika.
- **Pristup knowledge base podacima**: RAG ne smije zaobići autorizaciju. Ako korisnik ne smije vidjeti dokument, ne smije ga dobiti ni kroz model (filtriranje po metapodacima, odvojene knowledge base po tenantu).
- Bedrock ne koristi tvoje promptove i odgovore za treniranje baznih modela.

> **Na ispitu:** „Chatbot ne smije otkriti brojeve kartica i email adrese kupaca u odgovorima, uz najmanje razvoja“ = **Bedrock Guardrails sensitive information filter** (mask/block). „Korisnici pokušavaju natjerati model da ignoriše instrukcije“ = **prompt attack filter**. „Agent je obrisao resurse jer je imao preširoku ulogu“ = **Excessive Agency**, rješenje je least privilege + potvrda.

## Rezime

- Golden AMI i container image se prave automatski (**EC2 Image Builder**, Inspector scan u pipeline-u), sa IMDSv2, SSM Agentom i bez SSH-a.
- Kredencijali za compute uvijek dolaze iz uloge: **instance profile**, **Lambda execution role**, **ECS task role** (aplikacija) vs **task execution role** (agent), **IRSA / Pod Identity** za podove.
- **Inspector** = poznate ranjivosti (EC2, ECR, Lambda standard + code scanning, kod u repozitorijima); **GuardDuty Runtime Monitoring** = sumnjivo ponašanje u toku rada (EKS, ECS, EC2).
- **Patch Manager** (baseline, patch policy, maintenance window) za patchovanje, **Compliance** + Inspector za kontinuiranu validaciju; za ASG i kontejnere biraj zamjenu imagea.
- **Session Manager** i **EC2 Instance Connect (Endpoint)** zamjenjuju bastion i otvoren port 22; sesije se loguju i kontrolišu IAM-om.
- U pipeline-u: **Amazon Q Developer** i **Inspector** (CodeGuru Security je ugašen 20.11.2025.), uz gate koji zaustavlja deploy.
- GenAI: znaj **OWASP Top 10 for LLM 2025**; **Bedrock Guardrails** (prompt attack, PII mask, denied topics, grounding) forsiraš preko `bedrock:GuardrailIdentifier`; agentima daj least privilege.
