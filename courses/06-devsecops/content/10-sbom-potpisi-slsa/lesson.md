## Šta ovaj modul pokriva

Domen 5, integritet lanca snabdijevanja:

- **5.1** SBOM: CycloneDX i SPDX, generisanje Syftom i Trivyjem, skeniranje SBOM-a, regulatorni razlozi (EU CRA, US EO 14028).
- **5.2** Potpisivanje artefakata cosignom: par ključeva, keyless (Fulcio, Rekor), provjera.
- **5.3** Provenance i atestacije: in-toto, SLSA nivoi i build track.
- **5.4** Provođenje integriteta pri deployu: provjera potpisa i atestacija prije deploya, admission politike.

Do sada su sve kontrole gledale **izvorni kod** (tajne, SAST, SCA, IaC). Ovaj modul gleda **artefakt** koji izlazi iz builda: sliku `kurs-shop`. Mjesto u pipelineu:

```text
build ──► sbom ──► image-scan ──► sign + attest ──► verify ──► deploy
           │                          │                │
     spisak sastojaka          „ovo je prošlo      „ne vjeruj tagu,
                                naš pipeline“       provjeri potpis“
```

Prijetnje koje ove kontrole sprječavaju:

| Prijetnja | Primjer | Kontrola |
|---|---|---|
| Ne znaš šta je u slici kad izađe novi CVE | Log4Shell 2021: timovi danima traže gdje je `log4j` | **SBOM** uz svaki build |
| Podmetnuta slika pod istim tagom | Napadač sa pristupom registriju gurne `kurs-shop:1.4` | Potpis vezan za **digest** |
| Slika napravljena van pipelinea | Developer gurne sliku sa laptopa | Provjera **identiteta** potpisnika |
| Kompromitovan build | SolarWinds: ispravno potpisan, ali zatrovan build | **Provenance**, ojačan builder (SLSA L3) |
| Deploy zaobiđe sve provjere | `kubectl apply` sa nepotpisanom slikom | **Admission** politika (Kyverno) |

CKS kurs je pokazao ove alate na nivou klastera. Ovdje ih ugrađujemo u pipeline: koji job pravi šta, šta se čuva kao artefakt i kada build pada.

## SBOM: spisak sastojaka

**SBOM** (Software Bill of Materials) je mašinski čitljiv spisak komponenti artefakta: imena, verzije, identifikatori (**purl**, CPE), hash vrijednosti, licence i veze između komponenti. SBOM sam po sebi ne kaže ništa o ranjivostima. Vrijednost dobija kad ga uporediš sa bazom ranjivosti, danas i ponovo za šest mjeseci, bez ponovnog raspakivanja slike.

### CycloneDX i SPDX

| | **CycloneDX** | **SPDX** |
|---|---|---|
| Održava | OWASP, standardizovan kao **ECMA-424** | Linux Foundation; SPDX 2.2.1 je **ISO/IEC 5962:2021** |
| Aktuelne verzije | 1.6 i 1.7 (oktobar 2025) | 2.3 (široko podržana) i 3.0 |
| Porijeklo | Sigurnost i analiza rizika | Licence i usklađenost |
| Formati | JSON, XML, protobuf | JSON, tag-value, YAML, RDF; 3.0 je JSON-LD |
| Posebno | VEX, servisi (SaaSBOM), hardver, kriptografija (CBOM), ML modeli | Detaljne licence; 3.0 uvodi profile (Security, Build, AI, Dataset…) |
| Syft `-o` | `cyclonedx-json`, `cyclonedx-xml` | `spdx-json`, `spdx-tag-value` |
| Trivy `--format` | `cyclonedx` | `spdx-json`, `spdx` |

Za pipeline je izbor manje bitan od doslijednosti: izaberi jedan format za cijelu organizaciju, da alati nizvodno (DefectDojo, Dependency-Track, GitLab) ne moraju znati oba. U praksi je **CycloneDX JSON** češći u sigurnosnim alatima, a SPDX kad pravni tim traži licence.

> **U praksi:** kada alat podržava više verzija specifikacije, provjeri šta čita alat koji SBOM konzumira. Novija verzija formata nije korisna ako je tvoj Dependency-Track ili skener ne razumije. Syft dozvoljava izbor verzije, npr. `-o cyclonedx-json@1.6`.

### Šta SBOM mora sadržati

NTIA (SAD, 2021) je definisala **minimalne elemente** koje i danas svi citiraju:

- ime dobavljača (supplier), ime komponente, verzija,
- drugi jedinstveni identifikatori (purl, CPE),
- odnos zavisnosti (ko koga uključuje),
- autor SBOM podataka i vremenska oznaka.

Uz to: SBOM se pravi automatski (ne ručno) i ponovo uz svaki build. CISA je 2025. objavila nacrt proširenih minimalnih elemenata (npr. hash komponente, licenca, ime alata koji je napravio SBOM). Syft i Trivy ova polja popunjavaju sami.

### Generisanje SBOM-a: Syft

Syft pravi SBOM iz direktorija, slike u registriju ili arhive. Komanda je `syft scan <izvor>`:

```bash
cd /root/kurs-shop

# izvorni kod: Python i npm zavisnosti iz requirements.txt i package-lock.json
syft scan dir:. -o cyclonedx-json=sbom-src.cdx.json

# slika iz lokalnog registrija (HTTP, bez TLS-a)
export SYFT_REGISTRY_INSECURE_USE_HTTP=true
syft scan registry:127.0.0.1:5000/kurs-shop:1.0 \
  -o cyclonedx-json=sbom.cdx.json \
  -o spdx-json=sbom.spdx.json

# brz pregled u terminalu
syft scan registry:127.0.0.1:5000/kurs-shop:1.0 -o table
```

Više `-o` opcija u jednom pokretanju daje više formata iz jedne analize. Prefiks izvora (`dir:`, `registry:`, `oci-dir:`, `docker-archive:`) govori Syftu odakle čita, pa ne mora pogađati i ne treba Docker daemon.

Razlika SBOM-a izvora i SBOM-a slike je bitna:

| | SBOM izvornog koda | SBOM slike |
|---|---|---|
| Sadrži | Ono što lock fajlovi deklarišu | Ono što je zaista instalirano: OS paketi (dpkg/apk), Python paketi, binarni fajlovi |
| Propušta | OS pakete, zavisnosti instalirane u Dockerfileu | Dev zavisnosti koje nisu u slici |
| Kada | Rano, na MR-u | Poslije builda, za release |

Za release i regulativu važi SBOM **onoga što isporučuješ**, dakle slike.

### Generisanje SBOM-a: Trivy

Trivy pravi SBOM istim komandama kojima skenira, samo sa drugim formatom:

```bash
trivy image --format cyclonedx --output sbom.cdx.json 127.0.0.1:5000/kurs-shop:1.0
trivy fs --format spdx-json --output sbom-src.spdx.json /root/kurs-shop
```

Ako već koristiš Trivy za skeniranje slike (modul 08), ne moraš uvoditi Syft. Syft ima prednost kad ti treba više formata ili precizniji katalog binarnih fajlova; Trivy kad želiš jedan alat.

### Skeniranje SBOM-a

SBOM napravljen jednom može se skenirati koliko god puta, bez slike:

```bash
trivy sbom --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 sbom.cdx.json
```

Ovo je osnova **kontinuiranog praćenja**: svake noći job uzme SBOM-ove svih slika koje su trenutno u produkciji i skenira ih novom bazom. Ako se sutra objavi CVE u `werkzeug 2.2.2`, saznaćeš to bez novog builda.

```yaml
sbom-rescan:
  stage: verify
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - for f in sboms/*.cdx.json; do
        trivy sbom --severity CRITICAL --exit-code 1 "$f" || FAILED=1;
      done
    - exit ${FAILED:-0}
```

### SBOM u pipelineu

```yaml
sbom:
  stage: build
  needs: [build]
  variables:
    SYFT_REGISTRY_INSECURE_USE_HTTP: "true"   # samo za lokalni lab registry
  script:
    - IMAGE="$(cat image.txt)"                 # npr. 127.0.0.1:5000/kurs-shop@sha256:...
    - syft scan "registry:$IMAGE" -o cyclonedx-json=sbom.cdx.json
    - jq -e '.bomFormat == "CycloneDX" and (.components | length > 0)' sbom.cdx.json
  artifacts:
    paths: [sbom.cdx.json]
    reports:
      cyclonedx: sbom.cdx.json     # GitLab Ultimate: lista zavisnosti u projektu
    expire_in: 1 year
```

Tri detalja:

1. SBOM se pravi za **digest**, ne za tag. Tag se može pomjeriti, pa SBOM za `:latest` ne znači ništa za sedmicu dana.
2. `jq -e` provjera hvata najčešću tihu grešku: alat je napravio validan, ali prazan SBOM (pogrešan izvor, nema lock fajla).
3. SBOM kao artefakt joba ističe (`expire_in`). Za dugoročno čuvanje ga **prikači uz sliku kao atestaciju** (dalje u modulu) ili pošalji u Dependency-Track ili DefectDojo.

> **U praksi:** SBOM koji niko ne čita je samo papir za reviziju. Prvi koristan korak je noćni `trivy sbom` nad onim što je u produkciji; drugi je slanje SBOM-ova u alat koji odgovara na pitanje „u kojim servisima je `PyYAML 5.3.1`?“ za sekundu.

### Regulatorni razlozi

| Propis | Šta traži | Status (oktobar 2026) |
|---|---|---|
| **US EO 14028** (maj 2021) | Federalne agencije traže od dobavljača softvera siguran razvoj (NIST SSDF) i SBOM | Pokrenuo je cijelu industriju SBOM-a; NTIA minimalni elementi su nastali iz njega |
| **EU Cyber Resilience Act** (Uredba (EU) 2024/2847) | Proizvođači proizvoda sa digitalnim elementima: upravljanje ranjivostima, SBOM (bar zavisnosti najvišeg nivoa) u tehničkoj dokumentaciji, prijava aktivno iskorištenih ranjivosti | Na snazi od decembra 2024; **obaveze prijave od 11. 9. 2026**; puna primjena **11. 12. 2027** |

Kod CRA treba znati:

- SBOM nije obavezno javan; mora postojati u tehničkoj dokumentaciji i dati se nadzornom organu na zahtjev.
- Od 11. 9. 2026 proizvođač mora prijaviti **aktivno iskorištenu ranjivost** i ozbiljan incident preko ENISA platforme za prijavu: rano upozorenje u roku od 24 sata. Bez SBOM-a ne možeš brzo reći da li je tvoj proizvod pogođen.
- Kazne idu do 15 miliona eura ili 2,5% godišnjeg prometa.

> **U praksi:** ne gradi „SBOM za regulatora“ kao poseban proces. Ako svaki release ima SBOM vezan za digest i atestovan uz sliku, dokumentacija za CRA je nusproizvod pipelinea.

## Potpisivanje: cosign

Potpis odgovara na pitanje **ko** je objavio artefakt i da li je mijenjan. **cosign** (projekat **Sigstore**) potpisuje OCI slike i proizvoljne fajlove (blobove), a potpis čuva u istom registriju kao i sliku.

Potpisuje se uvijek **digest**, ne tag:

```bash
crane digest 127.0.0.1:5000/kurs-shop:1.0
# sha256:3f1c...
IMAGE=127.0.0.1:5000/kurs-shop@$(crane digest 127.0.0.1:5000/kurs-shop:1.0)
```

cosign odbija ili upozorava kad mu daš tag, jer bi potpis tada vrijedio za sliku koju je tag pokazivao u tom trenutku, a ti nisi siguran koja je to.

### Potpis sa parom ključeva

```bash
# lozinka za privatni ključ iz varijable, bez interaktivnog pitanja
export COSIGN_PASSWORD='lab-lozinka'
cosign generate-key-pair            # pravi cosign.key (šifrovan) i cosign.pub

cosign sign --key cosign.key "$IMAGE"
cosign verify --key cosign.pub "$IMAGE"
```

Ključ može biti i u KMS-u ili Vaultu, tako da privatni ključ nikad ne stigne na runner: `--key awskms://...`, `--key hashivault://kurs-shop`, `--key gitlab://shop/kurs-shop` (cosign može sam generisati par i upisati ga u GitLab CI/CD varijable projekta).

### Šta se promijenilo u cosign v3

Lab koristi cosign 3.1. U odnosu na v2:

| | cosign v2 | cosign v3 |
|---|---|---|
| Format potpisa | Poseban OCI objekat sa tagom `sha256-<digest>.sig` | **Sigstore bundle** (protobuf/JSON) kao podrazumijevani format |
| Gdje u registriju | Tag šema `.sig` / `.att` | **OCI 1.1 referrer** slike (na registriju bez Referrers API-ja koristi se fallback tag) |
| Adrese servisa | Flagovi `--rekor-url`, `--fulcio-url` | **Signing config** i **trusted root** iz Sigstore TUF repozitorija; vlastiti preko `--signing-config` i `--trusted-root` |
| Isključenje Rekora | `--tlog-upload=false` | Signing config bez transparency loga; stari flag je zastario i radi samo uz `--use-signing-config=false` |
| `sign-blob` | `--output-signature`, `--output-certificate` | Jedan fajl `--bundle artifact.sigstore.json`; stari `--output-*` flagovi su zastarjeli |

Pregled onoga što je prikačeno uz sliku: `cosign tree "$IMAGE"`.

Posljedica za pipeline: **verifikator mora razumjeti novi format**. Ako potpisuješ cosignom v3, provjeri da admission kontroler (Kyverno, Sigstore policy-controller) i stari skriptovi sa cosign v2 znaju čitati bundle iz referrera. Nadogradnju radi prvo na strani provjere, pa tek onda na strani potpisa.

### Lab bez mreže

Lab nema pristup javnom Rekoru ni TUF repozitoriju, pa potpisuješ ključem bez upisa u transparency log:

```bash
cosign sign --key cosign.key --use-signing-config=false --tlog-upload=false "$IMAGE"
cosign verify --key cosign.pub --insecure-ignore-tlog=true "$IMAGE"
```

Oba flaga pri potpisu su u v3 označena kao zastarjela (cosign ispiše upozorenje), ali rade. Čistiji v3 način je vlastiti signing config bez Rekor servisa, napravljen sa `cosign signing-config create`. U produkciji sa javnim Sigstoreom ništa od ovoga ne trebaš.

### Keyless potpis: Fulcio i Rekor

**Keyless** ne znači „bez ključa“, nego „bez ključa kojim ti upravljaš“:

1. cosign napravi privremeni (efemerni) par ključeva u memoriji.
2. Job pokaže **OIDC token** svog identiteta (GitLab `id_tokens`, GitHub Actions OIDC).
3. **Fulcio** (Sigstore CA) izda kratkotrajni certifikat (oko 10 minuta) koji veže javni ključ za taj identitet.
4. cosign potpiše digest i upiše potpis i certifikat u **Rekor**, javni **transparency log** koji se može samo dopunjavati.
5. Privatni ključ se baci. Kasnija provjera ne pita „ko ima ključ“, nego „da li je potpis nastao dok je certifikat važio i ko je u certifikatu“.

GitLab job (gitlab.com):

```yaml
sign:
  stage: sign
  needs: [build, image-scan]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: sigstore
  script:
    - cosign sign --yes "$(cat image.txt)"
```

cosign sam pronađe `SIGSTORE_ID_TOKEN`. Provjera mora navesti **ko** smije potpisivati:

```bash
cosign verify "$IMAGE" \
  --certificate-oidc-issuer "https://gitlab.com" \
  --certificate-identity "https://gitlab.com/shop/kurs-shop//.gitlab-ci.yml@refs/heads/main"
```

Identitet GitLab joba je `<instanca>/<putanja projekta>//<putanja CI fajla>@<ref>`. Dvostruka kosa crta nije greška u kucanju: bez nje provjera pada sa „none of the expected identities matched“. Za GitHub Actions issuer je `https://token.actions.githubusercontent.com`, a identitet putanja workflow fajla sa refom.

Za više grana ili repoa postoje `--certificate-identity-regexp` i `--certificate-oidc-issuer-regexp`. Regex piši usko i sa sidrima (`^…$`): `.*kurs-shop.*` prihvata i `evil/kurs-shop-fork`.

> **U praksi:** javni Fulcio prihvata tokene samo od poznatih issuera (gitlab.com, GitHub i drugi). Self-managed GitLab kao `gitlab.kurs-shop.ba` za keyless treba **privatni Sigstore** (vlastiti Fulcio i Rekor) ili ostaje na ključu u KMS-u/Vaultu. Takođe: potpis i identitet idu u javni Rekor, pa ime privatnog repoa postaje javno.

### Ključ ili keyless

| | Par ključeva (KMS/Vault) | Keyless (Fulcio + Rekor) |
|---|---|---|
| Upravljanje tajnom | Rotacija, zaštita, opoziv ključa su tvoj posao | Nema dugotrajnog ključa |
| Šta provjera dokazuje | „Neko ko ima ključ“ | „Ovaj job, ovaj repo, ova grana“ |
| Krađa | Ukraden ključ potpisuje bilo šta dok ga ne opozoveš | Napadač treba OIDC token zaštićenog joba |
| Transparentnost | Opcionalno (Rekor) | Obavezno, javni log |
| Offline / air-gapped | Radi | Treba privatni Sigstore |
| Provjera u politici | Javni ključ | Issuer + identitet (subject) |

### Potpis u pipelineu: pravila

- Potpisuje samo job na **zaštićenoj grani** ili tagu (`rules`), nikad MR iz forka.
- Potpis dolazi **poslije** skeniranja i testova (`needs: [image-scan, dast]`). Tada potpis znači „prošlo je naš pipeline“, ne samo „mi smo ovo napravili“.
- Ključ ili `id_tokens` postoje samo u jobu za potpis; build job ih ne vidi.
- Za ključ u CI/CD varijabli: **protected** i **masked**, tip *File* (`--key "$COSIGN_KEY"` dobija putanju), lozinka u posebnoj varijabli `COSIGN_PASSWORD`.

> **U praksi:** najčešći propust nije slab ključ nego slaba provjera. `cosign verify` bez `--certificate-identity` (ili sa regexom `.*`) prihvata potpis **bilo koga** ko ima GitHub ili GitLab nalog. Potpis bez provjere identiteta je samo checksum.

## Provenance i atestacije

Potpis kaže ko. **Provenance** kaže **kako**: koji builder, iz kog commita, sa kojim parametrima i ulazima je artefakt nastao. **Atestacija** (attestation) je potpisana izjava o artefaktu; provenance je jedna vrsta atestacije, SBOM prikačen uz sliku je druga, rezultat skeniranja treća.

### in-toto Statement

Zajednički format za sve atestacije je **in-toto Statement**. Uvijek ima tri dijela:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    { "name": "127.0.0.1:5000/kurs-shop",
      "digest": { "sha256": "3f1c..." } }
  ],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": { "...": "sadržaj zavisi od predicateType" }
}
```

- `subject`: na koji artefakt se izjava odnosi (po digestu).
- `predicateType`: o kakvoj izjavi se radi (SLSA provenance, CycloneDX, SPDX, OpenVEX, rezultat testova…).
- `predicate`: sam sadržaj.

Statement se potpisuje i pakuje u **DSSE** omotač (Dead Simple Signing Envelope), pa potpis pokriva i tip sadržaja. cosign to radi sam.

Originalni **in-toto** okvir ide i dalje: **layout** opisuje sve korake lanca (ko smije izvršiti koji korak, šta je ulaz i izlaz), a **link** fajlovi su dokazi da je korak izvršen. U većini pipelinea danas se koristi samo format atestacija (Statement), ne puni layout.

### SLSA provenance

Predikat `https://slsa.dev/provenance/v1` ima dva dijela:

```json
{
  "buildDefinition": {
    "buildType": "https://gitlab.com/...",
    "externalParameters": { "source": "git+https://gitlab.kurs-shop.ba/shop/kurs-shop@refs/heads/main" },
    "internalParameters": { "CI_PIPELINE_ID": "4711" },
    "resolvedDependencies": [
      { "uri": "git+https://gitlab.kurs-shop.ba/shop/kurs-shop", "digest": { "gitCommit": "a1b2c3..." } }
    ]
  },
  "runDetails": {
    "builder": { "id": "https://gitlab.kurs-shop.ba/runners/shared" },
    "metadata": { "invocationId": "...", "startedOn": "2026-10-16T09:00:00Z" }
  }
}
```

Pri provjeri gledaš najviše `builder.id` (je li gradio naš pouzdani builder) i `externalParameters`/`resolvedDependencies` (je li gradio iz našeg repoa i zaštićene grane).

### SLSA nivoi

**SLSA** (Supply-chain Levels for Software Artifacts) verzija 1.x organizuje zahtjeve u **trackove**. Aktuelna specifikacija je v1.2, koja uz **Build track** donosi i **Source track**.

Build track:

| Nivo | Naziv | Šta traži |
|---|---|---|
| L0 | Bez garancija | Ništa (lokalni build, testovi) |
| L1 | Provenance postoji | Dosljedan build proces; platforma automatski pravi provenance (builder, proces, ulazi) i on se isporučuje; smije biti nepotpisan |
| L2 | Hostovana build platforma | Build na hostovanoj platformi koja **sama potpisuje** provenance; potrošač provjerava autentičnost |
| L3 | Ojačani buildovi | Buildovi su **izolovani** jedan od drugog (i unutar istog projekta), a **tajne za potpis provenancea nedostupne** korisničkim koracima builda |

Source track (v1.2): L1 verzionisanje u VCS-u, L2 sačuvana istorija i provenance revizija, L3 tehničke kontrole na imenovanim granama/tagovima, L4 obavezan pregled dvije pouzdane osobe.

Ključna razlika L2 i L3: na L2 provenance potpisuje platforma, ali korisnički `script:` korak bi mogao doći do ključa za potpis i falsifikovati provenance. Na L3 to nije moguće: potpis radi komponenta van korisničkog koda.

> **U praksi:** provenance koji tvoj vlastiti `script:` napravi `jq`-om i potpiše ključem iz CI varijable je koristan zapis, ali nije L2/L3, jer isti script može upisati bilo šta. Za više nivoe treba da provenance pravi i potpisuje platforma (runner, GitHub attestations), ne tvoj job.

### Provenance na GitLabu i GitHubu

**GitLab** runner pravi provenance za **artefakte joba** kad postaviš varijablu:

```yaml
build-wheel:
  variables:
    RUNNER_GENERATE_ARTIFACTS_METADATA: "true"
  script:
    - python -m build
  artifacts:
    name: kurs-shop-wheel
    paths: [dist/]
```

Uz artefakt nastaje `kurs-shop-wheel-metadata.json` (ili `artifacts-metadata.json` bez imena): in-toto Statement sa SLSA v1 provenance predikatom. Ovo pokriva artefakte joba, ne sliku u registriju; za sliku provenance praviš sam i prikačiš ga cosignom.

**GitHub** ima **artifact attestations**: akcija `actions/attest-build-provenance` pravi i potpisuje SLSA provenance kroz Sigstore, a `gh attestation verify oci://<slika> --owner <org>` ga provjerava. GitHub ovo predstavlja kao Build L2, a uz reusable workflow kao izolovan build kao Build L3.

### Atestacije cosignom

cosign prikači bilo koji predikat uz sliku kao potpisanu atestaciju:

```bash
# SBOM kao atestacija
cosign attest --key cosign.key --type cyclonedx --predicate sbom.cdx.json "$IMAGE"

# provenance (predikat napravljen u jobu)
cosign attest --key cosign.key --type slsaprovenance1 --predicate provenance.json "$IMAGE"

# provjera: potpis atestacije + tip predikata
cosign verify-attestation --key cosign.pub --type slsaprovenance1 "$IMAGE" \
  | jq -r '.payload' | base64 -d | jq '.predicate.runDetails.builder.id'
```

`--type` prima skraćenice (`slsaprovenance1`, `cyclonedx`, `spdxjson`, `openvex`, `vuln`, `custom`) ili puni URI predikata. U offline labu dodaj iste flagove kao kod `sign`/`verify` (bez Rekora).

`verify-attestation` može odmah provjeriti i sadržaj politikom: `--policy policy.rego` (ili CUE). Tako „provenance postoji“ postaje „provenance kaže da je gradio naš runner iz `main` grane“.

> **U praksi:** SBOM priložen uz sliku kao atestacija je bolji od SBOM-a u artefaktu joba: putuje sa slikom kroz registrije, ne ističe nakon `expire_in` i potpisan je, pa znaš da ga niko nije zamijenio.

## Provođenje pri deployu

Potpis koji niko ne provjerava ne štiti ništa. Provjera ide na dva mjesta:

1. **U pipelineu**, u deploy jobu, prije `kubectl apply`: brza povratna informacija.
2. **U klasteru**, kao admission politika: jedina provjera koju ne možeš zaobići ručnim `kubectl`-om ili drugim pipelineom.

### Deploy job

```yaml
deploy:
  stage: deploy
  needs: [sign]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - IMAGE="$(cat image.txt)"
    - cosign verify --key "$COSIGN_PUB" "$IMAGE"
    - cosign verify-attestation --key "$COSIGN_PUB" --type slsaprovenance1 "$IMAGE" > /dev/null
    - yq -i ".spec.template.spec.containers[0].image = \"$IMAGE\"" k8s/deployment.yaml
    - kubectl apply -f k8s/deployment.yaml
```

Deploy u manifest upisuje **digest** koji je provjeren. Da upiše tag, klaster bi mogao povući drugu sliku od one čiji potpis je job upravo provjerio.

### Kyverno: ImageValidatingPolicy

Kyverno 1.19 označava stare `ClusterPolicy`/`Policy` (`kyverno.io/v1`) kao zastarjele, sa uklanjanjem planiranim za 1.20. Za provjeru slika novi tip je **`ImageValidatingPolicy`** (`policies.kyverno.io/v1`, stabilan od 1.17/1.18), sa CEL izrazima:

```yaml
apiVersion: policies.kyverno.io/v1
kind: ImageValidatingPolicy
metadata:
  name: kurs-shop-potpisan
spec:
  validationActions: [Deny]
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: [v1]
        operations: [CREATE, UPDATE]
        resources: [pods]
  matchImageReferences:
    - glob: "registry.kurs-shop.ba/kurs-shop*"
  attestors:
    - name: shopKey
      cosign:
        key:
          data: |
            -----BEGIN PUBLIC KEY-----
            MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
            -----END PUBLIC KEY-----
  attestations:
    - name: provenance
      intoto:
        type: https://slsa.dev/provenance/v1
  validationConfigurations:
    mutateDigest: true      # tag u Podu zamijeni digestom
    verifyDigest: true      # slika mora biti referencirana digestom
    required: true          # slika koja odgovara mora proći provjeru
  validations:
    - expression: >-
        images.containers.map(image,
          verifyImageSignatures(image, [attestors.shopKey])).all(e, e > 0)
      message: "kurs-shop slika nije potpisana ključem pipelinea"
    - expression: >-
        images.containers.map(image,
          verifyAttestationSignatures(image, attestations.provenance, [attestors.shopKey])).all(e, e > 0)
      message: "kurs-shop slika nema potpisan SLSA provenance"
```

Za keyless se umjesto `key` navodi `keyless.identities` sa `issuer` i `subject` (ili `subjectRegExp`), isto kao `--certificate-oidc-issuer` i `--certificate-identity` kod cosigna. Sadržaj atestacije se čita sa `extractPayload(image, attestations.provenance)` i provjerava CEL-om (npr. da `builder.id` odgovara vašem runneru).

Stari oblik, `ClusterPolicy` sa `verifyImages` (`imageReferences`, `attestors`, `mutateDigest`), i dalje radi u 1.19 uz upozorenje. Ako ga nađeš u postojećem klasteru, planiraj migraciju prije nadogradnje na 1.20.

### Politika u pipelineu: Kyverno CLI

Istu politiku testiraš prije nego stigne u klaster:

```bash
kyverno apply policies/kurs-shop-potpisan.yaml --resource k8s/deployment.yaml
kyverno test policies/      # traži kyverno-test.yaml sa očekivanim rezultatima
```

Za provjeru potpisa CLI mora dohvatiti potpise iz registrija, pa resurs u testu treba referencirati sliku iz registrija do kojeg job dolazi (u labu `127.0.0.1:5000`).

> **U praksi:** uvodi admission provjeru u dva koraka. Prvo `validationActions: [Audit]` sedmicu-dvije: vidiš koje slike u klasteru nisu potpisane (sidecari, operatori, slike trećih strana). Tek kad su izuzeci popisani (posebna politika ili `PolicyException` za vendorske slike), prebaci na `Deny`. Politika koja prvog dana blokira `kube-system` završi isključena.

### Šta provjeravaš u kom trenutku

| Provjera | Pipeline (deploy job) | Admission (Kyverno) |
|---|---|---|
| Može se zaobići | Da (ručni deploy, drugi pipeline) | Ne, ako je politika `Deny` za sve namespacee |
| Povratna informacija | Odmah, u logu joba | Pri kreiranju Poda, poruka u `kubectl`/Argo CD |
| Šta provjerava | Potpis, atestacije, politika nad sadržajem | Potpis, atestacije, CEL nad sadržajem |
| Uloga | Brz neuspjeh | Konačna kapija |

## Rezime

- SBOM (CycloneDX ili SPDX) pravi se za **digest** slike uz svaki build (Syft ili Trivy), provjerava da nije prazan i ponovo skenira (`trivy sbom`) kad izađu novi CVE-ovi.
- EU CRA: prijava aktivno iskorištenih ranjivosti od 11. 9. 2026, puna primjena 11. 12. 2027; SBOM ide u tehničku dokumentaciju. US EO 14028 je pokrenuo SBOM zahtjeve 2021.
- cosign potpisuje digest; v3 podrazumijeva Sigstore bundle kao OCI 1.1 referrer i signing config/trusted root iz TUF-a, pa i verifikator mora biti spreman na novi format.
- Keyless veže potpis za OIDC identitet joba (Fulcio certifikat, Rekor log); provjera bez `--certificate-identity` i `--certificate-oidc-issuer` nema vrijednost.
- Atestacija = potpisan in-toto Statement (`subject`, `predicateType`, `predicate`); SLSA provenance v1 opisuje builder i ulaze.
- SLSA Build L1 provenance postoji, L2 potpisuje ga hostovana platforma, L3 izolovani buildovi i ključ nedostupan korisničkim koracima.
- Deploy job provjerava potpis i atestacije i deployuje **digest**; Kyverno `ImageValidatingPolicy` je konačna kapija u klasteru, uvedena prvo kao Audit pa kao Deny.
