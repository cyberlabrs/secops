## Ciljevi ispita: 3.1 i 3.3

Domen 3 (**Infrastructure Security**) nosi 18% bodovanog sadržaja. Ovaj modul pokriva dva od tri zadatka (compute je u posebnom modulu):

- **3.1** kontrole na rubu mreže (edge): strategija prema prijetnjama, CloudFront headeri, AWS WAF, AWS IoT politike, zaštita od OWASP Top 10, S3 CORS, Shield Advanced, pravila po geografiji, rate limiting, client fingerprinting, integracije (OCSF, third-party WAF pravila),
- **3.3** mrežne kontrole: security grupe, NACL, AWS Network Firewall, hibridna povezanost (Site-to-Site VPN, Direct Connect, MACsec), AWS Verified Access, segmentacija (north/south, east/west, izolovani subneti) i otkrivanje nepotrebnog pristupa (Network Access Analyzer, Inspector network reachability).

Ispit ovdje voli pitanja „koja kontrola na kom sloju“: L3/L4 DDoS je **Shield**, L7 napad je **WAF**, zaobilaženje CDN-a je **OAC ili prefix lista**, filtriranje izlaznog saobraćaja po domeni je **Network Firewall**, pristup bez VPN-a je **Verified Access**.

## Edge strategija prema prijetnjama (3.1.1)

| Prijetnja | Kontrola |
|---|---|
| Volumetrijski DDoS (L3/L4: SYN flood, UDP reflection) | **Shield Standard** (automatski, besplatno), CloudFront / Global Accelerator apsorbuju na edge lokacijama; **Shield Advanced** za SRT, cost protection |
| HTTP flood (L7) | **WAF rate-based rules**, Shield Advanced automatic application layer mitigation |
| SQL injection, XSS, path traversal | **WAF managed rule groups** (Core rule set, SQL database, Known bad inputs) |
| Botovi, scraping | **WAF Bot Control**, CAPTCHA/Challenge akcije, JA3/JA4 fingerprinting |
| Credential stuffing, preuzimanje naloga | **WAF Fraud Control ATP** (account takeover prevention), ACFP za lažne registracije |
| Direktan pristup originu mimo CDN-a i WAF-a | **Origin Access Control (OAC)** za S3; prefix lista + custom header (ili CloudFront VPC origins) za ALB/EC2 |
| Neovlašteno preuzimanje plaćenog sadržaja | **Signed URLs / signed cookies** |
| Zakonska ograničenja po državama | **CloudFront geo restriction** ili **WAF geo match** |
| Osjetljiva polja u formi kroz više slojeva | **Field-level encryption** |

## Amazon CloudFront kao sigurnosna kontrola (3.1.2)

### Zaštita origina

**Origin Access Control (OAC)** je preporučen način da S3 bucket bude dostupan **samo** preko CloudFronta. Zamijenio je stariji Origin Access Identity (OAI); OAC podržava SSE-KMS, sve Regione i potpisuje zahtjeve SigV4.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::static-site-bucket/*",
    "Condition": {
      "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::111122223333:distribution/E1ABCDEF2GHIJ" }
    }
  }]
}
```

Ako su objekti šifrovani **SSE-KMS** ključem, key policy mora dozvoliti `cloudfront.amazonaws.com` akciju `kms:Decrypt` uz isti `AWS:SourceArn` uslov. Block Public Access ostaje uključen.

Za **custom origin** (ALB, EC2):

- security grupa ALB-a dozvoljava inbound samo iz AWS managed prefix liste **`com.amazonaws.global.cloudfront.origin-facing`**,
- CloudFront dodaje **custom origin header** sa tajnom vrijednošću (npr. `X-Origin-Verify`), a ALB listener pravilo ili WAF na ALB-u odbija zahtjeve bez njega (tajnu rotiraj, npr. preko Secrets Managera),
- **CloudFront VPC origins** omogućavaju da ALB ili EC2 budu u **privatnom subnetu** bez javne IP adrese, dostupni samo CloudFrontu.

### Kontrole za viewere

- **Viewer protocol policy**: Redirect HTTP to HTTPS ili HTTPS only; **security policy** određuje minimalnu TLS verziju prema viewerima. **Origin protocol policy** HTTPS only za šifrovanje do origina.
- **Response headers policy**: dodaje sigurnosne headere (HSTS, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) bez izmjene aplikacije.
- **Signed URLs**: jedan fajl, ili klijent ne podržava kolačiće. **Signed cookies**: više fajlova (npr. svi segmenti HLS videa) bez mijenjanja URL-ova. Koristi **trusted key groups** (javni ključ u CloudFrontu, privatni kod tebe); stari CloudFront key pairs traže root korisnika.
- **Field-level encryption**: CloudFront na edge lokaciji šifruje navedena polja POST zahtjeva (npr. broj kartice) javnim ključem; samo servis sa privatnim ključem ih može dešifrovati, pa ih ne vide load balancer, logovi ni ostali mikroservisi.
- **Geo restriction**: allow lista ili block lista država za cijelu distribuciju (CloudFront koristi GeoIP bazu). Za izuzetke i kombinacije koristi **WAF geo match**.

> **Na ispitu:** „Users must not be able to access the S3 objects **directly**, only through CloudFront“ = **OAC + bucket policy sa `AWS:SourceArn`**. „Only the payment service may see the card number, even though the request passes through several services“ = **field-level encryption**, ne samo HTTPS (HTTPS štiti samo do terminacije TLS-a).

## AWS WAF (3.1.2, 3.1.3)

**AWS WAF** se vezuje za CloudFront (globalni web ACL, upravlja se iz us-east-1), ALB, API Gateway REST API, AppSync, Cognito user pool, App Runner i Verified Access. Web ACL (u novoj konzoli **protection pack**) sadrži pravila koja se evaluiraju po **prioritetu**; prvo pravilo sa terminirajućom akcijom (Allow/Block) završava evaluaciju, a ako nijedno ne odgovara primjenjuje se **default action**.

### Gradivni blokovi

| Element | Opis |
|---|---|
| **AWS Managed Rules** | Core rule set (OWASP rizici), Known bad inputs (npr. Log4j), SQL database, Linux/Windows/PHP, Amazon IP reputation list, Anonymous IP list |
| **Bot Control** | Common (poznati botovi, verifikovani crawleri) i Targeted (napredni botovi, browser interrogation) nivo |
| **Fraud Control: ATP / ACFP** | Zaštita login stranice od credential stuffinga (provjera ukradenih kredencijala, praćenje neuspjelih prijava) i registracije od lažnih naloga |
| **AWS Marketplace rule groups** | **Third-party** managed pravila (npr. od sigurnosnih vendora) koja se dodaju u web ACL kao i AWS pravila |
| **Rate-based rule** | Broji zahtjeve po ključu agregacije (IP, forwarded IP, header, kolačić, query, label namespace…) u vremenskom prozoru i primjenjuje akciju iznad limita |
| **Geo match** | Država (i regija) porijekla zahtjeva; dodaje labele `awswaf:clientip:geo:country:XX` |
| **IP set, regex pattern set** | Liste adresa i obrazaca |
| **Labels** | Pravilo dodaje labelu, a kasnije pravilo odlučuje na osnovu labele (npr. managed grupa u Count, custom pravilo blokira samo za `/admin`) |
| **Akcije** | Allow, Block (opcionalno custom response), Count, **CAPTCHA**, **Challenge** (nevidljiva provjera browsera) |
| **Scope-down statement** | Sužava managed ili rate-based pravilo na dio saobraćaja (npr. samo `/login`) |

Rate-based pravilo samo za login:

```json
{
  "Name": "login-rate-limit",
  "Priority": 10,
  "Action": { "Block": {} },
  "Statement": {
    "RateBasedStatement": {
      "Limit": 100,
      "EvaluationWindowSec": 300,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "FieldToMatch": { "UriPath": {} },
          "SearchString": "/login",
          "PositionalConstraint": "STARTS_WITH",
          "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }]
        }
      }
    }
  },
  "VisibilityConfig": { "SampledRequestsEnabled": true, "CloudWatchMetricsEnabled": true, "MetricName": "loginRate" }
}
```

### Client fingerprinting (JA3/JA4)

WAF računa **JA3** (32 znaka) i **JA4** (36 znakova) otisak iz TLS Client Hello poruke. To identifikuje TLS biblioteku klijenta: bot koji rotira IP adrese i User-Agent često zadrži isti otisak. Važno:

- dostupno samo za **CloudFront i ALB**,
- otisak dobiješ iz **WAF logova** (logovanje mora biti uključeno),
- koristi se u string match, regex ili size constraint pravilu, sa **fallback** ponašanjem kada se otisak ne može izračunati.

### Geografija i geolokacija

| Opcija | Kada |
|---|---|
| **CloudFront geo restriction** | Jednostavno: cijela distribucija dostupna samo iz liste država |
| **WAF geo match** | Kombinacije: npr. blokiraj sve van EU **osim** IP seta partnera; različito za različite putanje; labele za kasnija pravila |
| **Route 53 geolocation routing** | Usmjeravanje korisnika na najbliži endpoint, **nije** sigurnosna kontrola |

### Upravljanje na nivou organizacije i integracije (3.1.4)

- **AWS Firewall Manager** primjenjuje WAF politike (uključujući AWS i Marketplace pravila), Shield Advanced zaštitu, security grupe i Network Firewall politike na sve naloge i nove resurse u organizaciji.
- WAF logovi idu u CloudWatch Logs, S3 ili Firehose (ime sa prefiksom `aws-waf-logs-`) i mogu se uključiti kao izvor u **Amazon Security Lake**, koji ih normalizuje u **OCSF**. Isto važi za SIEM partnere koji čitaju OCSF.
- Third-party nalazi i logovi mogu ući u Security Lake kao **custom source** (u OCSF/Parquet formatu), a **AWS Verified Access** svoje logove pristupa piše u OCSF formatu.

> **Na ispitu:** „Protect the **login page** from credential stuffing with the LEAST effort“ = **ATP managed rule group**. „Limit requests **per IP** to one URI“ = **rate-based rule sa scope-down**. „Bots rotate IP addresses but use the same client“ = **JA3/JA4 fingerprint**. „Apply the same WAF rules to **all accounts** automatically“ = **Firewall Manager**.

## OWASP Top 10 i AWS kontrole

| OWASP Top 10 (2021) | AWS kontrola na rubu i oko njega |
|---|---|
| A01 Broken Access Control | Autorizacija u aplikaciji (Cognito, Verified Permissions); WAF ne zna poslovna pravila |
| A02 Cryptographic Failures | TLS politike CloudFront/ALB, HTTPS only, KMS |
| A03 Injection | WAF Core rule set i SQL database grupa |
| A05 Security Misconfiguration | Security Hub, Config, response headers policy |
| A06 Vulnerable and Outdated Components | Inspector; WAF Known bad inputs kao privremena zakrpa (virtual patching) |
| A07 Identification and Authentication Failures | WAF ATP, rate limiting, MFA u Cognitu |
| A10 Server-Side Request Forgery | IMDSv2, egress filtriranje (Network Firewall), WAF pravila |

## AWS Shield

| | **Shield Standard** | **Shield Advanced** |
|---|---|---|
| Cijena | Besplatno, automatski za sve | Pretplata po organizaciji + data transfer |
| Zaštita | L3/L4 napadi na AWS edge | Uz to: napredna detekcija, L7 automatska mitigacija preko WAF-a |
| Podrška | Nema | **Shield Response Team (SRT)**, proactive engagement |
| Ostalo | | Cost protection, health-based detection (Route 53 health checks), WAF bez dodatne cijene za zaštićene resurse, Firewall Manager |

## S3 CORS i AWS IoT politike (3.1.2)

**Cross-origin resource sharing (CORS)** dozvoljava JavaScriptu sa jedne domene da čita resurse sa druge. CORS provodi **browser**; to **nije** kontrola pristupa (curl je ignoriše). Konfiguracija dozvoljava samo potrebne origine i metode:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type", "Authorization"],
    "MaxAgeSeconds": 3000
  }
]
```

Nikad `"AllowedOrigins": ["*"]` za buckete sa privatnim podacima i upload. Pristup i dalje kontrolišu bucket policy, IAM i presigned URL-ovi.

**AWS IoT Core politike** se kače na X.509 certifikat uređaja (ili Cognito identitet) i određuju MQTT akcije (`iot:Connect`, `iot:Publish`, `iot:Subscribe`, `iot:Receive`). **Policy variables** daju najmanje privilegije bez posebne politike za svaki uređaj:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "iot:Connect",
      "Resource": "arn:aws:iot:eu-central-1:111122223333:client/${iot:Connection.Thing.ThingName}" },
    { "Effect": "Allow", "Action": "iot:Publish",
      "Resource": "arn:aws:iot:eu-central-1:111122223333:topic/devices/${iot:Connection.Thing.ThingName}/telemetry" }
  ]
}
```

Uređaj se može spojiti samo sa client ID-jem jednakim imenu svog thinga i objavljivati samo na svoj topic. **AWS IoT Device Defender** audit prijavljuje preširoke politike (npr. `iot:*` na `*`).

## Mrežne kontrole (3.3.1)

| | **Security group** | **Network ACL** | **AWS Network Firewall** |
|---|---|---|---|
| Nivo | ENI (instanca, endpoint, Lambda u VPC-u) | Subnet | Firewall endpoint u posebnom subnetu, saobraćaj se usmjerava rutama |
| Stanje | **Stateful** (povratni saobraćaj automatski dozvoljen) | **Stateless** (moraš dozvoliti i povratni, ephemeral portovi 1024-65535) | Stateless i stateful rule grupe |
| Pravila | Samo **allow** | Allow i **deny**, numerisana, prvo poklapanje pobjeđuje | Pass, drop, reject, alert; Suricata IPS pravila; domain liste |
| Reference | Druga security grupa kao izvor | Samo CIDR | CIDR, portovi, protokoli, domene (HTTP Host, TLS SNI), IP set reference |
| Tipično | Mikrosegmentacija između slojeva | Grubo blokiranje opsega, dodatni sloj | Centralno filtriranje north/south i east/west, IDS/IPS, egress po domeni |

Primjer: DB sloj prima samo iz app sloja, bez obzira koliko instanci app sloja postoji:

```bash
aws ec2 authorize-security-group-ingress --group-id sg-db \
  --protocol tcp --port 5432 --source-group sg-app
```

### AWS Network Firewall

- **Stateless rule grupe**: brza 5-tuple pravila po paketu; akcije pass, drop ili **forward to stateful**.
- **Stateful rule grupe**: Suricata-kompatibilna pravila, **domain list** (allowlist ili denylist za HTTP Host i TLS SNI) i standardna 5-tuple pravila. **Strict order** (pravila po prioritetu, sa default akcijama poput drop established) ili **action order** (pass, zatim drop, reject, alert).
- **TLS inspection** (dešifrovanje uz certifikat iz ACM-a), **AWS managed threat signatures**, logovi: alert, flow i TLS.
- Firewall subnet koristi samo firewall endpoint; endpoint ne filtrira saobraćaj vlastitog subneta.

```text
# Suricata: dozvoli izlazni HTTPS samo prema github.com, ostalo odbij
pass tls $HOME_NET any -> $EXTERNAL_NET 443 (tls.sni; content:"github.com"; endswith; msg:"allow github"; flow:to_server; sid:100001; rev:1;)
drop tls $HOME_NET any -> $EXTERNAL_NET any (msg:"block other TLS"; flow:to_server; sid:100002; rev:1;)
```

### Inspekcijske arhitekture

| Model | Opis |
|---|---|
| **Distribuirani** | Firewall u svakom VPC-u (između IGW-a i workload subneta). Jednostavno, ali više endpointa i politika (upravljaj preko Firewall Managera). |
| **Centralizovani** | Inspection VPC povezan na **Transit Gateway**. Spoke VPC-ovi šalju sav saobraćaj (egress, east/west, prema on-premises) kroz inspection VPC. Na TGW attachmentu inspection VPC-a uključi **appliance mode** da oba smjera toka idu kroz isti AZ endpoint (simetrično rutiranje). |
| **TGW-attached firewall** | Network Firewall se direktno veže na Transit Gateway kao **network function** attachment, bez ručnog pravljenja inspection VPC-a. |
| **Gateway Load Balancer** | Za **third-party** virtualne firewalle: GWLB endpoint u ruti, GENEVE enkapsulacija, transparentno umetanje. |

> **Na ispitu:** „Allow outbound traffic **only to approved domains** from all VPCs“ = **Network Firewall stateful domain allowlist** (centralizovano preko TGW). Security grupe i NACL ne razumiju domene. „Intermittent drops after adding centralized inspection“ = provjeri **appliance mode** i asimetrično rutiranje.

## Hibridna povezanost (3.3.2)

| Opcija | Šifrovanje | Napomena |
|---|---|---|
| **Site-to-Site VPN** | IPsec | Dva tunela po konekciji (dvije AWS lokacije), preko interneta; može i kao **private IP VPN** preko Direct Connecta |
| **Direct Connect (DX)** | **Nije šifrovan** podrazumijevano | Privatna, predvidiva veza; private VIF (VPC), transit VIF (TGW), public VIF (javni AWS endpointi) |
| **DX + MACsec** | IEEE 802.1AE, **L2**, point-to-point između tvog rutera i AWS DX uređaja | Dedicated konekcije **10, 100 i 400 Gbps** na odabranim lokacijama; ključ je CKN/CAK par; modovi `should_encrypt` i `must_encrypt` |
| **VPN preko DX** | IPsec end-to-end | Kada treba šifrovanje kroz cijeli put ili hosted konekcija bez MACseca |
| **AWS Client VPN** | TLS (OpenVPN) | Pristup pojedinačnih korisnika mreži |

MACsec štiti samo link između tvog uređaja i DX uređaja; ne daje end-to-end šifrovanje kroz više segmenata. Za end-to-end koristi TLS u aplikaciji ili IPsec.

> **Na ispitu:** „Encrypt a **100 Gbps** Direct Connect link at line rate“ = **MACsec** (IPsec VPN tunel ima ograničenu propusnost po tunelu). „Encryption **end-to-end** from on-premises to the VPC over DX, connection is **hosted**“ = **Site-to-Site VPN preko DX-a**.

## AWS Verified Access (3.3.3)

**AWS Verified Access** daje pristup internim aplikacijama **bez VPN-a**, po zero trust principu: svaki zahtjev se ocjenjuje prema identitetu i stanju uređaja.

- **Trust providers**: jedan identity provider (IAM Identity Center ili OIDC) i opcionalno više **device trust providera** (npr. Jamf, CrowdStrike, JumpCloud).
- **Politike** u jeziku **Cedar**, na nivou grupe endpointa i pojedinačnog endpointa. Bez politike, sve je odbijeno.
- **Endpoint tipovi**: load balancer, network interface, **network CIDR** (samo TCP) i **RDS**. Pristup TCP aplikacijama (SSH, RDP, baze) ide preko **Connectivity Client** aplikacije na uređaju; HTTP(S) aplikacije rade kroz browser.
- WAF se može vezati za Verified Access za HTTP aplikacije; logovi svakog pokušaja pristupa su u OCSF formatu.

```text
// "idc" i "jamf" su policy reference names identity i device trust providera
permit(principal, action, resource)
when {
  context.idc.groups has "c242c5b0-6081-1845-6fa8-6e0d9513c107" &&
  context.idc.user.email.verified == true &&
  context.jamf.risk == "LOW"
};
```

## Segmentacija (3.3.4)

- **North/south**: saobraćaj između VPC-a i interneta ili on-premises mreže. Kontrole: IGW samo u javnim subnetima, ALB/CloudFront/WAF na ulazu, NAT + Network Firewall na izlazu.
- **East/west**: saobraćaj između workloada (subneti, VPC-ovi, nalozi). Kontrole: security grupe po sloju, NACL, odvojeni VPC-ovi i nalozi, **Transit Gateway route tabele** po domenu (prod ne vidi dev; blackhole rute), Network Firewall za inspekciju.
- **Izolovani subneti**: bez rute prema IGW i NAT-u. Pristup AWS servisima samo preko **VPC endpointa**: gateway endpoint za S3 i DynamoDB, interface endpointi (PrivateLink) za ostale. Endpoint policy (npr. samo bucketi organizacije uz `aws:ResourceOrgID`) i bucket policy sa `aws:SourceVpce` zatvaraju put za eksfiltraciju.
- **PrivateLink** izlaže servis drugom VPC-u ili nalogu bez peeringa i preklapanja CIDR-a; klijent vidi samo jedan endpoint, ne cijelu mrežu.

## Otkrivanje nepotrebnog pristupa (3.3.5)

| Alat | Šta radi |
|---|---|
| **Network Access Analyzer** | Definišeš **Network Access Scope** (npr. „svi putevi od internet gatewaya do ENI-ja koji ne prolaze kroz ALB“ ili „prod VPC ne smije doći do dev VPC-a“) i dobiješ nalaze o putevima koji krše namjeru |
| **Amazon Inspector network reachability** | Dio EC2 skeniranja: nalazi o portovima instance dostupnim sa interneta ili drugih mreža kroz IGW, ELB, peering, VPN, uz kombinaciju SG, NACL i ruta |
| **Reachability Analyzer** | Point-to-point dijagnostika: da li izvor može doći do odredišta i koja komponenta blokira |
| **AWS Verified Access** | Zamjenjuje široke VPN pristupe pristupom po aplikaciji |
| **Firewall Manager / Config** | Audit security grupa (npr. 0.0.0.0/0 na port 22) u cijeloj organizaciji |

> **Na ispitu:** „**Continuously** identify which instances have ports reachable from the internet“ = **Inspector network reachability**. „Verify that **segmentation intent** holds across many VPCs (no path from dev to prod)“ = **Network Access Analyzer**. „Why can't instance A reach B?“ = **Reachability Analyzer**.

## Rezime

- Edge: OAC za S3 (bucket policy sa `AWS:SourceArn`, KMS key policy), prefix lista + custom header ili VPC origins za ALB, signed URLs/cookies, field-level encryption, response headers policy.
- WAF: managed rule groups (Core, SQL, Known bad inputs, Bot Control, ATP), rate-based sa scope-down, geo match, labele, CAPTCHA/Challenge, JA3/JA4 samo na CloudFront i ALB; Firewall Manager za organizaciju; Marketplace pravila za third-party.
- Shield Standard je automatski; Advanced daje SRT, L7 automatsku mitigaciju i cost protection.
- CORS nije kontrola pristupa; IoT politike koriste policy variables za najmanje privilegije po uređaju.
- SG stateful i samo allow, NACL stateless sa deny, Network Firewall za Suricata, domene i centralnu inspekciju (appliance mode na TGW).
- Hibrid: VPN (IPsec), DX nije šifrovan, MACsec za L2 na 10/100/400 Gbps dedicated, VPN preko DX-a za end-to-end; Verified Access umjesto VPN-a.
- Segmentacija north/south i east/west, izolovani subneti sa VPC endpointima; Network Access Analyzer i Inspector network reachability otkrivaju nepotreban pristup.
