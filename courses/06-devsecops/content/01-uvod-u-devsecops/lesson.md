## Šta ovaj modul pokriva

Ovo je uvodni modul kursa. Pokriva dva cilja iz domena 1:

- **1.1** Principi DevSecOps-a: **shift-left**, siguran SDLC po **NIST SSDF** okviru, modeli zrelosti **OWASP DSOMM** i **OWASP SAMM**.
- **1.2** Modelovanje prijetnji za aplikaciju i pipeline i izbor kontrola po fazama pipelinea.

Gdje je ovo u pipelineu: svuda i nigdje. Ovaj modul ne dodaje jedan job, nego daje mapu: koje kontrole postoje, u kojoj fazi ih stavljamo, šta svaka sprječava i kojim redom ih uvodimo. Ostatak kursa popunjava tu mapu, kontrolu po kontrolu, nad repoom `/root/kurs-shop`.

Prijetnja koju sprječavamo: sigurnosni problem koji se otkrije tek u produkciji (ili ga otkrije napadač). Tada je popravka najskuplja, a izloženost najduža.

Na kraju modula pokrećeš postojeći pipeline lokalno i praviš plan: koje kontrole mu fale i kojim redom ih dodaješ.

## Od DevOps-a do DevSecOps-a

DevOps je skratio put od commita do produkcije sa sedmica na minute. Klasična sigurnost (pentest jednom godišnje, ručni pregled prije releasea) ne može pratiti taj ritam: ili postaje usko grlo, ili se zaobilazi.

**DevSecOps** znači da sigurnost postaje dio istog toka rada:

- kontrole su **automatizovane** i rade u pipelineu, ne u tabeli koju neko popunjava;
- nalazi dolaze **developeru**, u merge requestu, dok je kod još svjež;
- odgovornost je **zajednička**: security tim pravi pravila i alate (često kao „platformu“), timovi ih koriste;
- pravila su **kod** (policy-as-code, konfiguracije skenera u repou) i prolaze isti review kao aplikacija.

### Shift-left, ali i shift-right

**Shift-left** znači pomjeriti provjeru što ranije u životnom ciklusu: u IDE, u pre-commit hook, u merge request. Razlog je ekonomski i praktičan: tajna uhvaćena u pre-commit hooku nikad ne ulazi u git istoriju; ista tajna nađena u produkciji traži opoziv, rotaciju, istragu i prepisivanje istorije (modul 03).

Ali ne može se sve pomjeriti lijevo:

- **DAST** (modul 11) treba aplikaciju koja radi.
- Nove ranjivosti (CVE) izlaze za kod koji je već u produkciji. Slika koja je juče bila čista danas može imati CRITICAL nalaz.
- Runtime detekcija (Falco, CloudTrail, WAF) hvata ono što je prošlo sve kontrole.

Zato se uz shift-left govori i o **shift-right**: nadzor i ponovno skeniranje onoga što je već isporučeno. Zreo program ima oba.

> **U praksi:** „shift-left“ ne znači „prebaci posao na developere“. Ako developeru u MR-u stigne 400 nalaza bez prioriteta, on će naučiti da ih ignoriše. Shift-left uspijeva samo kad je signal čist: malo lažnih pozitiva, jasna poruka šta popraviti i kako.

## Siguran SDLC: NIST SSDF

**NIST SP 800-218**, **Secure Software Development Framework (SSDF)**, je okvir praksi za siguran razvoj softvera. Važeća konačna verzija je **1.1** (februar 2022). NIST je u decembru 2025. objavio nacrt **SP 800-218 Rev. 1 (SSDF 1.2)**; dok nacrt ne postane konačan, referiši na 1.1 i prati izmjene. Postoji i profil **SP 800-218A** za generativnu AI.

SSDF ne propisuje alate. Opisuje **šta** organizacija treba da radi, grupisano u četiri grupe praksi:

| Grupa | Naziv | Šta znači u pipelineu (primjeri) |
|---|---|---|
| **PO** | Prepare the Organization | Definisani sigurnosni zahtjevi, uloge, kriteriji za sigurnosne provjere (npr. „CRITICAL ranjivost blokira release“), sigurno build okruženje i alati |
| **PS** | Protect the Software | Zaštita koda od neovlaštenih izmjena (protected branches, review), mehanizam za provjeru integriteta releasea (potpisi), arhiviranje releasea sa podacima o porijeklu (SBOM, provenance) |
| **PW** | Produce Well-Secured Software | Modelovanje prijetnji u dizajnu, pregled i analiza koda (SAST, code review), testiranje izvršnog koda (DAST), provjera komponenti trećih strana (SCA), sigurne podrazumijevane postavke |
| **RV** | Respond to Vulnerabilities | Stalno otkrivanje ranjivosti, procjena i prioritizacija, ispravka, analiza uzroka da se klasa greške ne ponovi |

Svaka praksa ima oznaku (npr. **PW.7** pregled ljudski čitljivog koda, **PW.8** testiranje izvršnog koda, **PS.2** provjera integriteta releasea) i zadatke (npr. PW.7.2). Te oznake su korisne kad praviš izvještaj za reviziju: svaki job u pipelineu možeš mapirati na praksu.

```yaml
# Primjer: komentar u .gitlab-ci.yml koji veže job za SSDF praksu
secret-scan:        # SSDF PS.1 (zaštita koda), PW.7 (analiza koda)
  stage: test
  script:
    - gitleaks git --redact --report-format sarif --report-path gitleaks.sarif
```

SSDF je u SAD postao osnova za samoatestaciju dobavljača softvera prema vladi (CISA Secure Software Development Attestation Form, posljedica **EO 14028**). U EU sličnu ulogu za proizvode sa digitalnim elementima ima **Cyber Resilience Act** (detalji u modulu 10).

> **U praksi:** kad menadžment pita „jesmo li usklađeni sa SSDF-om“, ne odgovaraj spiskom alata. Napravi tabelu: praksa → kontrola → dokaz (job, artefakt, politika). Pipeline koji proizvodi SARIF izvještaje, SBOM i potpise automatski daje većinu dokaza.

## Modeli zrelosti: DSOMM i SAMM

SSDF kaže šta treba raditi. Modeli zrelosti pomažu da odgovoriš na pitanje: **gdje smo sada i šta je sljedeći korak**.

### OWASP DSOMM

**OWASP DevSecOps Maturity Model (DSOMM)** je napravljen baš za pipeline. Aktivnosti su grupisane u **dimenzije** i poddimenzije, a svaka aktivnost ima nivo zrelosti (niži nivo = osnovna, lako uvodiva praksa; viši = napredna, skuplja). Dimenzije su:

- **Build and Deployment** (npr. definisan build proces, potpisivanje artefakata, upravljanje tajnama u pipelineu)
- **Culture and Organization** (edukacija, security champions, procesi)
- **Implementation** (ojačavanje aplikacije i infrastrukture, npr. minimalne slike, sigurni headeri)
- **Information Gathering** (logovanje, monitoring, metrike nalaza)
- **Test and Verification** (SAST, SCA, DAST, testovi infrastrukture, upravljanje nalazima)

DSOMM ima i alat (web aplikaciju) u kojem označavaš koje su aktivnosti implementirane, pa dobiješ toplotnu mapu po dimenzijama. Dobar je za razgovor sa timom: „na Test and Verification smo dobri, Build and Deployment nam zaostaje“.

### OWASP SAMM v2

**OWASP SAMM (Software Assurance Maturity Model) v2** je širi, organizacioni model. Ima **5 poslovnih funkcija**, svaka sa **3 sigurnosne prakse** (ukupno 15), a svaka praksa ima dva toka (stream A i B) i **3 nivoa zrelosti**:

| Poslovna funkcija | Prakse |
|---|---|
| Governance | Strategy & Metrics, Policy & Compliance, Education & Guidance |
| Design | Threat Assessment, Security Requirements, Security Architecture |
| Implementation | Secure Build, Secure Deployment, Defect Management |
| Verification | Architecture Assessment, Requirements-driven Testing, Security Testing |
| Operations | Incident Management, Environment Management, Operational Management |

SAMM procjena se radi upitnikom (postoji zvanični toolbox), a rezultat je ocjena po praksi i ciljni profil.

### Kada koji

| | **NIST SSDF** | **OWASP SAMM v2** | **OWASP DSOMM** |
|---|---|---|---|
| Vrsta | Okvir praksi (šta raditi) | Model zrelosti organizacije | Model zrelosti DevSecOps aktivnosti |
| Fokus | Ceo SDLC, usklađenost, dobavljači | Ceo program sigurnosti softvera, uključujući governance | Pipeline, automatizacija, tehničke aktivnosti |
| Granularnost | Prakse i zadaci (PO/PS/PW/RV) | 15 praksi × 3 nivoa | Mnogo konkretnih aktivnosti po nivoima |
| Za koga | Revizija, uprava, kupci | CISO, AppSec program | DevOps/platform i AppSec timovi |
| Tipična upotreba | „Dokaži da radiš siguran razvoj“ | Godišnja procjena i roadmap | Sprint-nivo plan: šta uvesti sljedeće |

Ovi okviri se ne isključuju. Česta kombinacija: SSDF kao obaveza prema kupcima i regulativi, SAMM za godišnju procjenu programa, DSOMM za konkretan plan pipeline tima.

> **U praksi:** ne pokušavaj odmah doći na najviši nivo u svim dimenzijama. Izaberi dvije–tri aktivnosti nižeg nivoa koje daju najviše (otkrivanje tajni, SCA nad lock fajlovima, protected branches), uvedi ih u sve repoe, pa tek onda idi dublje. Deset repoa sa osnovnim kontrolama vrijedi više od jednog „savršenog“.

## Modelovanje prijetnji

**Threat modeling** je strukturisano razmišljanje o tome šta može poći naopako. Najjednostavniji okvir su četiri pitanja (Adam Shostack, Threat Modeling Manifesto):

1. Na čemu radimo? (dijagram: komponente, tokovi podataka, **granice povjerenja**)
2. Šta može poći naopako? (prijetnje)
3. Šta ćemo uraditi povodom toga? (kontrole, prihvatanje rizika)
4. Jesmo li dobro uradili? (provjera, ponavljanje)

### STRIDE

Za pitanje 2 najčešće se koristi **STRIDE**, po kategorijama prijetnji:

| Slovo | Prijetnja | Narušeno svojstvo | Primjer u kurs-shop | Primjer u pipelineu |
|---|---|---|---|---|
| **S** | Spoofing | Autentičnost | Ukraden `SECRET_KEY` omogućava falsifikovane sesije | Neko se predstavlja kao CI job prema AWS-u ukradenim statičkim ključem |
| **T** | Tampering | Integritet | SQL injection mijenja podatke u bazi | Izmijenjen `.gitlab-ci.yml` ili zavisnost sa zlonamjernim kodom |
| **R** | Repudiation | Neporecivost | Nema audit loga za izmjenu narudžbe | Force push na `main` bez traga ko je to uradio |
| **I** | Information disclosure | Povjerljivost | `debug=True` otkriva stack trace i konfiguraciju | Tajna ispisana u job logu ili ostavljena u artefaktu |
| **D** | Denial of service | Dostupnost | Skupi upiti bez ograničenja | Kripto-rudar na shared runneru |
| **E** | Elevation of privilege | Autorizacija | `subprocess` sa `shell=True` daje izvršavanje komandi | Job na runneru sa privileged Dockerom preuzima host |

Alternative i dopune: **LINDDUN** (privatnost), **PASTA** (risk-centric, sa poslovnim kontekstom), stabla napada. Za dijagrame se koristi **OWASP Threat Dragon** ili threat model kao kod (npr. `pytm`), koji može živjeti u repou i mijenjati se kroz MR.

### Pipeline je takođe sistem koji modeluješ

Većina timova modeluje aplikaciju, a zaboravi pipeline. A pipeline ima pristup izvornom kodu, tajnama za produkciju, registryju i cloud nalogu. Granice povjerenja u tipičnom GitLab toku:

```text
 developer laptop ──push──▶ GitLab (repo, MR, varijable)
                                │ pokreće
                                ▼
                         runner (izvršava skripte iz repoa!)
                     ┌──────────┼──────────────┬──────────────┐
                     ▼          ▼              ▼              ▼
              paketni registri  OCI registry   Vault / AWS    Kubernetes
              (PyPI, npm)       (slike)        (tajne, IAM)   (deploy)
```

Ključno zapažanje: **sve što je u repou, pipeline izvršava**. Ko može promijeniti `.gitlab-ci.yml`, `Makefile`, `requirements.txt` ili test skriptu, može izvršiti kod na runneru sa tajnama tog joba. To je osnova napada **Poisoned Pipeline Execution** (modul 02).

### Kratka vježba nad kurs-shop

Uzmi `/root/kurs-shop` i prođi kroz komponente:

```bash
cd /root/kurs-shop
git log --oneline | head
ls -R | head -40
cat .gitlab-ci.yml
```

Primjer rezultata (skraćeno):

| Komponenta | Prijetnja (STRIDE) | Kontrola | Faza | Modul |
|---|---|---|---|---|
| `config/settings.py` u istoriji | I: procurjeli AWS ključ i Slack webhook | gitleaks nad cijelom istorijom, pre-commit hook, rotacija | pre-commit, MR | 03 |
| `app.py` | T/E: SQL injection, command injection, `yaml.load` | Semgrep SAST sa `--error` za HIGH pravila | MR | 05 |
| `requirements.txt`, `package-lock.json` | T: poznate ranjivosti u zavisnostima | osv-scanner / Trivy SCA | MR | 06 |
| `infra/main.tf` | I/E: javni S3, SG 22 otvoren svijetu, javni RDS | Checkov / Trivy config | MR | 07 |
| `Dockerfile` | E: root, `latest`, token u `ENV` | hadolint, Trivy image | build | 08 |
| `k8s/deployment.yaml` | E: privileged, hostPath `/` | Conftest / Kyverno | MR i admission | 09 |
| izgrađena slika | T: podmetnuta slika | SBOM, cosign potpis, provenance | release | 10 |
| pokrenuta aplikacija | I: nedostaju sigurnosni headeri | ZAP baseline | staging | 11 |
| `.gitlab-ci.yml` | T/E: izmjena pipelinea, krađa tajni | protected branches, CODEOWNERS, `id_tokens` | platforma | 02 |

> **U praksi:** threat model ne mora biti dokument od 40 strana. Sat vremena sa timom, tabla, dijagram toka i STRIDE po granici povjerenja daju 80% vrijednosti. Ponovi ga kad se arhitektura bitno promijeni (nova integracija, novi tip tajne, novi deploy cilj), a ne po kalendaru.

## Kontrole po fazama pipelinea

Kad znaš prijetnje, biraš kontrole. Svaka kontrola ima svoje prirodno mjesto: što ranije, ali tek kad ima šta da provjeri.

| Faza | Kontrola | Alat u kursu | Šta hvata | Brzina |
|---|---|---|---|---|
| IDE / pre-commit | Otkrivanje tajni, lint | gitleaks, pre-commit | Tajne prije nego uđu u istoriju | sekunde |
| Push (server) | Push protection | GitLab secret push protection, GitHub push protection | Tajne koje su zaobišle lokalni hook | sekunde |
| MR / commit | **SAST** | Semgrep | Ranjivi obrasci u kodu | sekunde–minute |
| MR / commit | **SCA** | osv-scanner, Trivy fs | Poznati CVE u zavisnostima, licence | sekunde |
| MR / commit | IaC skeniranje | Checkov, Trivy config | Pogrešne konfiguracije Terraforma, K8s, Dockerfilea | sekunde |
| MR / commit | Policy-as-code | Conftest/OPA, Kyverno CLI | Kršenje internih pravila (npr. bez privileged) | sekunde |
| Build | Skeniranje slike, lint Dockerfilea | Trivy image, hadolint | OS paketi, root korisnik, tajne u slojevima | minute |
| Release | SBOM, potpis, provenance | Syft, cosign, SLSA | Podmetanje artefakta, nepoznat sadržaj | sekunde |
| Staging | **DAST** | OWASP ZAP | Ranjivosti vidljive tek u radu (headeri, injekcije) | minute–sati |
| Deploy | Admission kontrola | Kyverno (verifyImages) | Nepotpisane slike, zabranjene postavke | trenutno |
| Produkcija | Stalno skeniranje, monitoring | Trivy nad registryjem, runtime alati | Novi CVE nad starim artefaktima | stalno |

### SAST, SCA, DAST, IAST

| | **SAST** | **SCA** | **DAST** | **IAST** |
|---|---|---|---|---|
| Šta analizira | Izvorni kod (bez pokretanja) | Zavisnosti i njihove verzije | Pokrenutu aplikaciju spolja (HTTP) | Aplikaciju iznutra, agent u runtimeu tokom testova |
| Kada u pipelineu | MR, rano | MR, rano; i stalno nad produkcijom | Nakon deploya na test okruženje | Tokom integracionih testova |
| Jaka strana | Tačna linija koda, brzo | Brzo, jasna popravka (upgrade) | Nalazi koji su stvarno iskoristivi | Malo lažnih pozitiva, kontekst |
| Slabost | Lažni pozitivi, ne vidi konfiguraciju runtimea | Ne zna koristi li se ranjiva funkcija | Sporo, ne zna gdje je greška u kodu | Agent po jeziku, treba dobra pokrivenost testovima |
| U kursu | Semgrep (modul 05) | osv-scanner, Trivy (modul 06) | ZAP (modul 11) | samo teorijski |

### Gate: kada pipeline smije pasti

**Quality gate** (ili **security gate**) je pravilo koje odlučuje da li build prolazi. Tri stanja su korisna:

- **informativno**: alat radi, rezultati idu u izvještaj, build nikad ne pada (`allow_failure: true` ili `--exit-code 0`);
- **upozorenje**: job je žut (`allow_failure: true` uz izlazni kod različit od 0), ali pipeline nastavlja;
- **blokirajuće**: job pada i deploy ne ide dalje.

Tipičan put za novi alat: informativno (2–4 sedmice, mjeriš lažne pozitive) → blokirajuće samo za nove nalaze visoke ozbiljnosti → postepeno strože. Detalji o pragovima i izuzecima su u modulu 12.

```yaml
# Novi alat, prve dvije sedmice: radi, ali ne blokira
sast:
  stage: test
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off --sarif --output semgrep.sarif .
  artifacts:
    when: always
    paths: [semgrep.sarif]
  allow_failure: true
```

GitLab dozvoljava i finiju kontrolu: `allow_failure: exit_codes: [2]` znači da je samo izlazni kod 2 „dozvoljen“ (npr. upozorenje), a svaki drugi neuspjeh blokira.

```yaml
iac-scan:
  script:
    - ./scripts/iac-gate.sh     # izlaz 0 = čisto, 2 = samo MEDIUM nalazi, 1 = HIGH/CRITICAL
  allow_failure:
    exit_codes: [2]
```

> **U praksi:** blokirajući gate bez procesa za izuzetke je recept za `allow_failure: true` svuda za mjesec dana. Prije nego što uključiš blokiranje, dogovori: ko odobrava izuzetak, gdje se zapisuje (npr. `.trivyignore.yaml` sa rokom, kroz MR), i koliko dugo važi.

## Prvi pipeline: šta imamo

Repo ima samo build i test. Pogledaj ga i pokreni lokalno sa **gitlab-ci-local** (izvršava pravu GitLab CI sintaksu u shellu kontejnera):

```bash
cd /root/kurs-shop
cat .gitlab-ci.yml
gitlab-ci-local --list          # spisak jobova, stage i when
gitlab-ci-local                 # pokreni cijeli pipeline
gitlab-ci-local test            # pokreni samo job "test"
```

Varijable koje bi u GitLabu bile u Settings → CI/CD → Variables ovdje stavljaš u `.gitlab-ci-local-variables.yml` (taj fajl ne commituješ, dodaj ga u `.gitignore`):

```yaml
# .gitlab-ci-local-variables.yml
REGISTRY: 127.0.0.1:5000
```

### Kostur DevSecOps pipelinea

Cilj kursa je pipeline otprilike ovakvog oblika. Ovdje je samo kostur; svaki job popunjavamo u svom modulu.

```yaml
stages: [secrets, test, build, scan-image, release, dast]

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG

secret-detection:       # modul 03
  stage: secrets
  script: [ "gitleaks git --redact --report-format sarif --report-path gitleaks.sarif" ]

sast:                   # modul 05
  stage: test
  needs: []
  script: [ "semgrep scan --config /opt/kurs/semgrep-rules/ --metrics=off --error ." ]

sca:                    # modul 06
  stage: test
  needs: []
  script: [ "osv-scanner scan source --offline-vulnerabilities -r ." ]

iac:                    # modul 07
  stage: test
  needs: []
  script: [ "checkov -d infra --framework terraform" ]

build:
  stage: build
  script: [ "echo 'build slike (u labu crane, u praksi BuildKit/Kaniko/Buildah)'" ]

image-scan:             # modul 08
  stage: scan-image
  script: [ "trivy image --severity HIGH,CRITICAL --exit-code 1 $REGISTRY/kurs-shop:$CI_COMMIT_SHORT_SHA" ]
```

Primijeti `needs: []` na brzim skenerima: ne čekaju prethodni stage, pa developer dobija rezultat SAST-a, SCA-a i IaC skena paralelno, za nekoliko sekundi. `workflow:rules` sprječava duple pipeline (branch + MR) za isti commit.

> **U praksi:** redoslijed uvođenja koji najmanje boli: (1) otkrivanje tajni, jer je jeftino i šteta je najveća; (2) SCA, jer je popravka obično samo upgrade; (3) IaC skeniranje; (4) SAST sa malim skupom pravila visokog povjerenja; (5) skeniranje slika; (6) potpisi i admission; (7) DAST. Svaki korak prvo informativno, pa blokirajuće.

### Metrike

Da bi znao napreduje li program, mjeri:

- **MTTR** za nalaze po ozbiljnosti (koliko dana od otkrivanja do ispravke);
- broj otvorenih CRITICAL/HIGH nalaza po servisu kroz vrijeme;
- udio lažnih pozitiva po alatu (ako je visok, developeri prestaju čitati nalaze);
- pokrivenost: koji procenat repoa ima svaku kontrolu;
- broj izuzetaka i koliko ih je isteklo bez revizije.

## Srodni sertifikati

Za ovu fazu nema jednog obaveznog ispita. Ako želiš potvrdu znanja: **Practical DevSecOps CDP** (praktičan ispit nad pipelineom), **HashiCorp Vault Associate (003)** za tajne, GitLab Certified Security Specialist i GitHub Advanced Security za platformske funkcije.

## Rezime

- DevSecOps = automatizovane sigurnosne kontrole u istom toku kao build i deploy, sa nalazima koji stižu developeru u MR.
- **Shift-left** smanjuje cijenu popravke, ali **shift-right** (stalno skeniranje, DAST, monitoring) je i dalje potreban.
- **NIST SSDF** (SP 800-218, važeća 1.1; nacrt 1.2 iz decembra 2025) grupiše prakse u **PO, PS, PW, RV**; svaki job možeš mapirati na praksu kao dokaz.
- **OWASP SAMM v2**: 5 poslovnih funkcija × 3 prakse × 3 nivoa, za organizacioni program. **OWASP DSOMM**: dimenzije i aktivnosti po nivoima, za plan pipeline tima.
- Threat modeling: četiri pitanja i **STRIDE**; modeluj i **pipeline**, jer izvršava sve iz repoa i ima tajne.
- Kontrolu stavi u najraniju fazu u kojoj ima šta da provjeri: tajne u pre-commit, SAST/SCA/IaC u MR, slike na buildu, DAST na stagingu, admission na deployu.
- Svaki novi gate kreće kao informativan, pa postaje blokirajući za nove ozbiljne nalaze, uz dogovoren proces izuzetaka.
