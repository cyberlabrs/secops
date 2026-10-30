## Šta ovaj modul pokriva

Modul pokriva dva cilja iz domena 3:

- **3.2** Sigma pravila: `logsource`, `detection`, modifikatori, uslovi; konverzija u SIEM upite uz **processing pipeline**.
- **3.3** Životni ciklus detekcije: testiranje, lažni pozitivi, podešavanje, **detection as code**, piramida bola.

Wazuh pravila (modul 04) rade samo u Wazuhu. **Sigma** je otvoren, generički format pravila (YAML) koji se konvertuje u upite za Splunk, Elastic, Microsoft Sentinel / Defender (KQL) i druge. Ista detekcija, jedan izvor istine, više SIEM-ova.

Alati u labu:

| Alat | Verzija | Uloga |
|---|---|---|
| `sigma` (sigma-cli) | 3.1, na pySigma 1.5 | provjera i konverzija pravila |
| backendi | `splunk`, `lucene`, `esql` (Elastic), `kusto` | ciljni jezici upita |
| SigmaHQ pravila | `/opt/sigma-rules/rules/` | javni repozitorij hiljada pravila |
| Zircolite | 4.1 | izvršava Sigma pravila direktno nad JSON logovima (bez SIEM-a) |

Specifikacija koju koristimo je Sigma **2.1** (avgust 2025): pravila, modifikatori, korelacije i filteri.

## Anatomija Sigma pravila

```yaml
title: CloudTrail logovanje zaustavljeno ili trail obrisan
id: 6b1f0a52-3c1e-4c55-9d43-2f1f8c3a7e10
status: experimental
description: Neko je zaustavio ili obrisao CloudTrail trail, što gasi revizijski trag za nalog.
references:
    - https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html
author: Kurs SecOps
date: 2026-10-16
tags:
    - attack.defense-impairment
    - attack.t1685.002
logsource:
    product: aws
    service: cloudtrail
detection:
    selection:
        eventSource: cloudtrail.amazonaws.com
        eventName:
            - StopLogging
            - DeleteTrail
    filter_iac:
        userIdentity.arn|endswith: ':assumed-role/terraform-deploy/ci'
    condition: selection and not filter_iac
falsepositives:
    - Planirano gašenje ili zamjena traila kroz Terraform (filtrirano gore)
level: high
```

| Polje | Obavezno | Napomena |
|---|---|---|
| `title` | da | kratko, šta pravilo otkriva |
| `id` | ne (praktično da) | UUID v4; stabilan kroz izmjene, koriste ga korelacije i filteri |
| `status` | ne | `experimental`, `test`, `stable`, `deprecated`, `unsupported` |
| `logsource` | da | `category`, `product`, `service` (+ `definition`): **koji** log |
| `detection` | da | imenovani **search identifiers** + `condition` |
| `falsepositives` | ne | poznati izvori lažnih pozitiva; analitičar ih čita pri trijaži |
| `level` | ne | `informational`, `low`, `medium`, `high`, `critical` |
| `tags` | ne | `attack.*`, `cve.*`, `detection.*`, `stp.*`, `tlp.*` |
| `related` | ne | veza sa drugim pravilom (`derived`, `obsolete`, `merged`, `renamed`, `similar`) |

Konvencije iz specifikacije: YAML sa 4 razmaka, ključevi malim slovima, stringovi u jednostrukim navodnicima, ime fajla 10–70 znakova malim slovima sa `_` (npr. `aws_cloudtrail_stoplogging_kurs.yml`).

### logsource

`logsource` ne filtrira događaje sam po sebi. On kaže backendu i pipelineu **gdje** tražiti. Pipeline ga prevodi u konkretan indeks, sourcetype ili tabelu.

| logsource | Primjeri u SigmaHQ |
|---|---|
| `product: aws`, `service: cloudtrail` | `rules/cloud/aws/cloudtrail/` |
| `category: application`, `product: kubernetes`, `service: audit` | `rules/application/kubernetes/audit/` |
| `product: linux`, `service: sshd` / `auth` / `syslog` | `rules/linux/builtin/` |
| `product: linux`, `category: process_creation` | `rules/linux/process_creation/` (auditd ili Sysmon for Linux) |
| `category: webserver` | `rules/web/` |

### detection: mape, liste, wildcards

Dva osnovna pravila logike:

- **Mapa** (više polja u jednom identifikatoru) = **AND**.
- **Lista** vrijednosti jednog polja = **OR**.

```yaml
detection:
    selection:                 # eventSource = X  AND  eventName IN (A, B)
        eventSource: iam.amazonaws.com
        eventName:
            - CreateAccessKey
            - CreateLoginProfile
    condition: selection
```

Poređenje stringova je podrazumijevano **case-insensitive** i traži cijelu vrijednost. `*` i `?` su wildcards (`'*admin*'`); `\` je escape. Prazna vrijednost se piše `''`, a odsustvo vrijednosti `null`. `null` ne smije biti u listi sa drugim vrijednostima; za „polje nije null“ napravi poseban identifikator i negiraj ga.

**Keywords** su lista stringova bez imena polja (`keywords: ['Corrupted MAC on input', ...]`, `condition: keywords`): traže se u cijeloj poruci. Korisno za nestrukturirane logove (`auth.log`, SigmaHQ `rules/linux/builtin/`), ali sporo i nepouzdano kod konverzije.

### Modifikatori

Modifikatori se pišu iza imena polja sa `|` i mogu se ulančavati (`polje|mod1|mod2`).

| Modifikator | Značenje | Primjer |
|---|---|---|
| `contains` | podstring | `requestURI|contains: '/exec'` |
| `startswith` / `endswith` | početak / kraj | `userIdentity.arn|endswith: ':root'` |
| `all` | lista se veže sa AND umjesto OR | `CommandLine|contains|all: ['curl', '| sh']` |
| `re` | regex (PCRE podskup, case-sensitive) | `user.username|re: '^system:serviceaccount:'` |
| `re|i`, `re|m`, `re|s` | regex zastavice: ignore case, multiline, dotall | `message|re|i: 'invalid user \S+'` |
| `cased` | poređenje osjetljivo na velika/mala slova | `eventName|cased: 'StopLogging'` |
| `exists` | polje postoji (`true`) ili ne (`false`) | `errorCode|exists: false` |
| `cidr` | IP u opsegu (IPv4 i IPv6) | `sourceIPAddress|cidr: '10.0.0.0/8'` |
| `gt`, `gte`, `lt`, `lte` | numeričko poređenje | `responseStatus.code|gte: 400` |
| `neq` | različito od (Sigma 2.1) | `eventSource|neq: 'kms.amazonaws.com'` |
| `fieldref` | poređenje sa drugim poljem | `TargetUser|fieldref: SubjectUser` |
| `base64`, `base64offset`, `utf16le`/`wide`, `windash` | kodiranja i varijante (uglavnom Windows) | `CommandLine|base64offset|contains: 'IEX'` |
| `expand` | placeholder (`%admins%`) koji pipeline zamijeni listom | `user|expand: '%admin_users%'` |
| `minute`, `hour`, `day`, `week`, `month`, `year` | dio datuma (Sigma 2.1) | `eventTime|hour|lt: 6` |

Pazi na `re`: dozvoljeni su samo osnovni metaznakovi (`.`, `^`, `$`, `*`, `+`, `?`, `{n,m}`, klase `[]`, `|`, `()`), a regex je skup u većini SIEM-ova. Ako ide sa `contains`/`startswith`, koristi to.

### condition

| Izraz | Značenje |
|---|---|
| `selection and not filter` | osnovni oblik: šta tražiš, minus poznato dobro |
| `1 of selection_*` | bar jedan identifikator koji počinje sa `selection_` |
| `all of selection_*` | svi takvi identifikatori |
| `1 of them` / `all of them` | svi identifikatori osim onih sa `_` na početku (`all of them` se ne preporučuje) |
| `selection and (a or b)` | zagrade |

Prioritet od najslabijeg: `or`, `and`, `not`, `x of`, zagrade. Konvencija iz SigmaHQ: `selection_*` za ono što tražiš, `filter_main_*` za generičke izuzetke, `filter_optional_*` za izuzetke specifične za okruženje, pa `condition: all of selection_* and not 1 of filter_*`.

Kubernetes primjer: interaktivni exec u pod od korisnika koji nije servisni nalog CI-ja.

```yaml
title: Kubernetes exec u pod van CI naloga
id: 3c6f8d2a-1b4e-4f7a-9c2d-8e5b6a7f0c21
status: experimental
logsource:
    category: application
    product: kubernetes
    service: audit
detection:
    selection_exec:
        verb: 'create'
        objectRef.resource: 'pods'
        objectRef.subresource: 'exec'
    filter_main_failed:
        responseStatus.code|gte: 400
    filter_optional_ci:
        user.username|startswith: 'system:serviceaccount:ci:'
    condition: selection_exec and not 1 of filter_*
tags:
    - attack.execution
    - attack.t1609
falsepositives:
    - Debug od strane on-call inženjera (provjeri ticket)
level: medium
```

> **U praksi:** pravilo bez `falsepositives` i bez filtera je skoro uvijek pravilo koje niko nije pustio nad pravim podacima. Prije commita pusti ga nad sedmicom stvarnih logova i zapiši u `falsepositives` šta si vidio. Analitičar u 3 ujutro čita to polje prije nego što eskalira.

## Korelacije

Obično Sigma pravilo gleda jedan događaj. **Korelaciono pravilo** (correlation rule) povezuje rezultate jednog ili više pravila kroz vrijeme, slično Wazuh `frequency`. Tipovi:

| Tip | Šta broji | Primjer |
|---|---|---|
| `event_count` | broj događaja po grupi | 10+ neuspjelih prijava po IP-u u 10 min |
| `value_count` | broj **različitih** vrijednosti polja | 10+ različitih korisnika sa jedne IP (spraying) |
| `temporal` | da li su se sva navedena pravila desila u prozoru (bilo kojim redom) | neuspjesi i uspjeh za isti IP |
| `temporal_ordered` | isto, ali tačnim redoslijedom | prvo niz neuspjeha, pa uspjeh |
| `value_sum`, `value_avg`, `value_percentile` | metrike nad poljem (Sigma 2.1) | ukupno preuzetih bajtova |

Obavezni dijelovi: `type`, `rules` (po `id` ili `name`), `group-by`, `timespan` (`30s`, `10m`, `1h`, `1d`) i `condition` (`gt`, `gte`, `lt`, `lte`, `eq`, `neq`; za `value_count` i `field`). Više dokumenata u jednom fajlu se razdvaja sa `---`.

```yaml
title: SSH password spraying sa jedne adrese
id: 7f3e9a21-6c4b-4d2e-b8a1-5c9d0e7f2a15
status: experimental
correlation:
    type: value_count
    rules:
        - ssh_failed_password
    group-by:
        - src_ip
    timespan: 10m
    condition:
        field: user
        gte: 10
level: high
---
title: SSH neuspjela lozinka
id: 2a8c4e6f-9b1d-4c3e-8f5a-7d9b1c3e5f16
name: ssh_failed_password
status: experimental
logsource:
    product: linux
    service: sshd
detection:
    selection:
        message|startswith: 'Failed password for '
    condition: selection
level: informational
```

Konverzija u Splunk (bez pipelinea, samo da vidiš oblik):

```bash
sigma convert -t splunk --without-pipeline lnx_sshd_password_spraying.yml
```

```text
message="Failed password for *"
| bin _time span=10m
| stats dc(user) as value_count by _time src_ip
| search value_count >= 10
```

ES|QL backend daje `stats value_count=count_distinct(user) by timebucket, src_ip`. Ne podržavaju svi backendi sve tipove: u labu `kusto` backend ne konvertuje korelacije, a `splunk` ne podržava `temporal_ordered`. Greška izgleda ovako: `Correlation type 'temporal_ordered' is not supported by backend`. Zircolite izvršava sve tipove nad lokalnim logovima.

> **U praksi:** korelacija u Sigmi je prenosiva samo onoliko koliko je backend podržava. Prije nego što obećaš „imamo detekciju brute forcea u Sentinelu iz Sigme“, konvertuj pravilo za ciljni backend i pogledaj upit. Ako backend ne podržava tip, napiši korelaciju direktno u ciljnom jeziku i u repo stavi oba fajla sa istim ATT&CK tagom.

## sigma-cli: provjera i konverzija

```bash
sigma list targets            # backendi: splunk, lucene, esql, eql, kusto...
sigma list pipelines          # pipelinei: splunk_cim, ecs_kubernetes, sentinel_asim, microsoft_xdr...

# provjera sintakse, uslova i dobrih praksi (validators)
sigma check --fail-on-issues pravila/   # bez --fail-on-issues upozorenja (stil, ime fajla, duplikat id) ne ruše build
```

`sigma check` hvata greške koje bi inače otkrio tek SIEM, npr. uslov koji pominje nepostojeći identifikator:

```text
Condition error in .../aws_cloudtrail_x.yml:Detection 'selection' not defined in detections
Found 0 errors, 1 condition errors and 0 issues.
```

### Konverzija i pipeline

Backend zna **sintaksu** ciljnog jezika. **Processing pipeline** zna **tvoje okruženje**: kako se polja zovu i u kojem indeksu/tabeli su logovi. Bez pipelinea upit koristi imena polja iz pravila, a to rijetko odgovara stvarnom SIEM-u. Zato `splunk`, `lucene` i `esql` backendi traže pipeline, a za vježbu se to preskače sa `--without-pipeline`.

```bash
R=aws_cloudtrail_stoplogging_kurs.yml

sigma convert -t splunk --without-pipeline $R
# eventSource="cloudtrail.amazonaws.com" eventName IN ("StopLogging", "DeleteTrail")
#   NOT userIdentity.arn="*:assumed-role/terraform-deploy/ci"

sigma convert -t esql --without-pipeline $R
# from * metadata _id, _index, _version | where eventSource=="cloudtrail.amazonaws.com"
#   and (eventName in ("StopLogging", "DeleteTrail")) and not ends_with(userIdentity.arn, ...)

sigma convert -t kusto $R
# (eventSource =~ "cloudtrail.amazonaws.com" and (eventName in~ ("StopLogging", "DeleteTrail")))
#   and (not('userIdentity.arn' endswith ":assumed-role/terraform-deploy/ci"))
```

Vlastiti pipeline je YAML fajl. Primjer: CloudTrail je u Splunku u indeksu `aws`, a ARN je izvučen u polje `user_arn`.

```yaml
# kurs_cloudtrail_splunk.yml
name: kurs - CloudTrail u Splunku
priority: 100
transformations:
  - id: cloudtrail_index
    type: add_condition
    conditions:
      index: aws
      sourcetype: 'aws:cloudtrail'
    rule_conditions:
      - type: logsource
        product: aws
        service: cloudtrail
  - id: cloudtrail_polja
    type: field_name_mapping
    mapping:
      userIdentity.arn: user_arn
    rule_conditions:
      - type: logsource
        product: aws
        service: cloudtrail
```

```bash
sigma convert -t splunk -p kurs_cloudtrail_splunk.yml $R
# index="aws" sourcetype="aws:cloudtrail" eventSource="cloudtrail.amazonaws.com"
#   eventName IN ("StopLogging", "DeleteTrail") NOT user_arn="*:assumed-role/terraform-deploy/ci"

# izlaz direktno kao savedsearches.conf, ili jedan fajl po pravilu
sigma convert -t splunk -f savedsearches -p kurs_cloudtrail_splunk.yml -o savedsearches.conf pravila/
sigma convert -t esql --without-pipeline --output-dir prevedeno/ --output-filename-template '{stem}.esql' pravila/
```

Gotovi pipelinei pokrivaju česte slučajeve: `ecs_kubernetes` (K8s audit u Elasticu), `splunk_cim` (Splunk CIM data modeli), `sentinel_asim` i `azure_monitor` (Sentinel tabele), `microsoft_xdr` (Defender). Pipelinei se mogu slagati (`-p a -p b`), redoslijed određuje `priority`.

### Globalni izuzeci: Sigma filteri

Izuzetak specifičan za tvoje okruženje ne treba upisivati u SigmaHQ pravilo (pri sljedećem ažuriranju bi nestao). **Sigma filter** (meta filter) je poseban fajl koji se dodaje pri konverziji:

```yaml
# mf_kurs_terraform_ci.yml
title: Izuzetak za Terraform CI rolu
logsource:
    product: aws
    service: cloudtrail
filter:
    rules:
        - 4db60cc0-36fb-42b7-9b58-a5b53019fb74   # SigmaHQ: AWS CloudTrail Important Change
    selection:
        userIdentity.arn|endswith: ':assumed-role/terraform-deploy/ci'
    condition: not selection
```

```bash
sigma convert -t splunk --without-pipeline --filter mf_kurs_terraform_ci.yml \
  /opt/sigma-rules/rules/cloud/aws/cloudtrail/aws_cloudtrail_disable_logging.yml
# ... eventName IN ("StopLogging", "UpdateTrail", "DeleteTrail") NOT userIdentity.arn="*:assumed-role/terraform-deploy/ci"
```

Uslov filtera se dodaje sa AND na uslov pravila, pa izuzetak pišeš kao `not selection`.

## Testiranje sa Zircoliteom

Zircolite učitava logove u SQLite i izvršava Sigma pravila kao SQL. Nije SIEM, ali je odličan za lab, forenziku i CI.

```bash
CT=cloudtrail.json      # tvoj izvoz CloudTraila

# CloudTrail je često {"Records":[...]}; Zircoliteu treba jedan događaj po liniji
jq -c '.Records[]?' "$CT" > /root/ct.jsonl

zircolite.py -e /root/ct.jsonl -j -r aws_cloudtrail_stoplogging_kurs.yml -o /root/ct-detekcije.json
jq '.[] | {title, rule_level, count}' /root/ct-detekcije.json   # prazno = ništa nije okinulo
```

`-j` znači JSON po liniji (`--json-array-input` je za JSON niz). Ako u labu nema komande `zircolite.py`, probaj `zircolite`.

**Zamka sa ugniježđenim poljima.** Zircolite „spljošti“ JSON i podrazumijevano zadrži samo ime lista: `objectRef.resource` postaje `resource`, `userIdentity.arn` postaje `arn`. Sigma pravila iz SigmaHQ traže `objectRef.resource`, pa se ništa ne poklapa i **pravilo tiho ćuti**. Provjera:

```bash
zircolite.py -e "$AUDIT" -j -r kubernetes_exec_van_ci.yml --keepflat -q
head -c 600 flattened_events_*.json      # vidiš stvarna imena kolona
```

Rješenje je mapiranje u Zircolite konfiguraciji (kopija `config/config.yaml`, sekcija `mappings`), tako da ime ostane puno:

```yaml
mappings:
  objectRef.resource: objectRef.resource
  objectRef.subresource: objectRef.subresource
  user.username: user.username
  responseStatus.code: responseStatus.code
  userIdentity.arn: userIdentity.arn
  # ... postojeća mapiranja iz originalnog fajla ostaju
```

```bash
zircolite.py -e "$AUDIT" -j -c /root/zircolite-kurs.yaml \
  -r /opt/sigma-rules/rules/application/kubernetes/audit/ -o /root/k8s-detekcije.json
```

Isti problem postoji u svakom SIEM-u, samo se tamo rješava pipelineom. Pouka: **detekcija koja nikad ne okine nije dokaz da napada nema**. Svako pravilo treba bar jedan pozitivan test.

### Unit testovi pravila

Zircolite ima `--test-rules`: za svako pravilo navodiš događaje koji **moraju** okinuti (`true_positive`) i koji **ne smiju** (`true_negative`). Ključevi su imena kolona poslije mapiranja.

```json
[
  {
    "id": "6b1f0a52-3c1e-4c55-9d43-2f1f8c3a7e10",
    "true_positive": [
      {"eventSource": "cloudtrail.amazonaws.com", "eventName": "StopLogging",
       "userIdentity.arn": "arn:aws:iam::111122223333:user/marko"}
    ],
    "true_negative": [
      {"eventSource": "cloudtrail.amazonaws.com", "eventName": "StopLogging",
       "userIdentity.arn": "arn:aws:sts::111122223333:assumed-role/terraform-deploy/ci"},
      {"eventSource": "cloudtrail.amazonaws.com", "eventName": "StartLogging",
       "userIdentity.arn": "arn:aws:iam::111122223333:user/marko"}
    ]
  }
]
```

```bash
zircolite.py -r aws_cloudtrail_stoplogging_kurs.yml --test-rules testovi/cloudtrail.json
echo $?   # 0 = svi prošli, 1 = bar jedan pao
```

Negativni test je jednako važan kao pozitivan: on čuva filter od toga da ga neko „pojednostavi“ i vrati lažne pozitive.

## Životni ciklus detekcije

```text
ideja / praznina (ATT&CK, incident, threat intel)
  -> istraživanje: kako tehnika izgleda u NAŠIM logovima
  -> pravilo (status: experimental) + pozitivni i negativni testovi
  -> sigma check + testovi u CI-ju
  -> deploy u SIEM kao "tihi" (bez stranice/ticketa), mjerenje šuma 1-2 sedmice
  -> podešavanje (filteri, pragovi) -> status: test
  -> produkcija sa runbookom i vlasnikom -> poslije dužeg mirnog rada status: stable
  -> periodična revizija; zamjena ili deprecated (sa related)
```

### Lažni pozitivi i podešavanje

| Tehnika podešavanja | Kada | Rizik |
|---|---|---|
| `filter_optional_*` u pravilu | poznat, stabilan legitiman izvor (CI rola, skener) | preširok filter je slijepa tačka koju napadač može iskoristiti |
| Sigma meta filter | izuzetak važi samo u tvom okruženju, a pravilo je iz SigmaHQ | filter se lako zaboravi; drži ga u istom repou |
| korelacija / prag | pojedinačni događaj je normalan, ali niz nije | spori napadi ispod praga |
| spuštanje `level` | pravilo je korisno kao kontekst, ne kao alarm | niko ga ne gleda |
| `deprecated` | pravilo nema vrijednost ili ga pokriva drugo | gubitak pokrivenosti ako je odluka pogrešna |

Mjeri: broj alarma po pravilu sedmično, udio zatvorenih kao lažni pozitiv, vrijeme trijaže. Pravilo sa 95% lažnih pozitiva je gore od nepostojećeg: troši pažnju i uči analitičare da ga ignorišu.

> **U praksi:** filter piši po **stabilnom identitetu** (ARN role, servisni nalog, potpisan binarni fajl), ne po nečemu što napadač lako kontroliše (ime procesa, user agent, komentar u komandi). Filter `userAgent|contains: 'terraform'` znači da svako ko postavi taj user agent prolazi neprimijećen.

### Detection as code

**Detection as code** znači da su detekcije softver: git repo, review, testovi, CI i automatski deploy.

Tipičan repo ima direktorije `rules/` (po logsourceu), `filters/` (meta filteri), `pipelines/` (mapiranja za tvoje SIEM-ove), `tests/` (JSON testovi) i CI konfiguraciju.

```yaml
# .gitlab-ci.yml (skraćeno)
stages: [validate, test, build]

sigma-check:
  stage: validate
  script:
    - sigma check --fail-on-issues rules/ filters/

rule-tests:
  stage: test
  script:
    - zircolite.py -r rules/cloud/aws/ --test-rules tests/cloudtrail.json

build-splunk:
  stage: build
  script:
    - sigma convert -t splunk -f savedsearches -p pipelines/kurs_cloudtrail_splunk.yml
        --filter filters/mf_kurs_terraform_ci.yml -o savedsearches.conf rules/cloud/aws/
  artifacts:
    paths: [savedsearches.conf]

# deploy-splunk: samo na default grani, šalje savedsearches.conf preko Splunk REST API-ja
```

Šta dobijaš: svaka izmjena ima review i istoriju (ko je dodao filter i zašto), testovi sprečavaju regresije, a SIEM je uvijek u stanju iz repoa. Isti princip radi za Wazuh: `local_rules.xml` u repou, testovi sa `wazuh-logtest -U` u CI-ju (modul 04).

### Piramida bola

**Pyramid of Pain** (David Bianco) rangira indikatore po tome koliko „boli“ napadača kad ih detektuješ i blokiraš:

| Nivo (odozdo) | Primjer iz laba | Cijena za napadača da promijeni |
|---|---|---|
| Hash vrijednosti | SHA-256 binarnog fajla kriptominera | trivijalna (jedan bajt) |
| IP adrese | `203.0.113.50` iz brute forcea | laka (nova VPS adresa) |
| Domeni | C2 domen | mala |
| Mrežni / host artefakti | user agent, ime fajla u `/tmp`, putanja | umjerena |
| Alati | specifičan skener ili alat za eksploataciju | visoka (novi alat) |
| **TTP** (taktike, tehnike, procedure) | „gašenje CloudTraila“, „exec u pod pa čitanje tajni“ | najviša (mora promijeniti ponašanje) |

Za detection inženjera: IOC pravila (hash, IP) su korisna i jeftina, ali kratko traju. Detekcije ponašanja (`eventName: StopLogging` bez obzira na izvor, `value_count` po korisnicima) su skuplje za napisati i podesiti, ali preživljavaju promjenu infrastrukture napadača. Sigma tag `stp.*` (MITRE Summiting the Pyramid) dodatno ocjenjuje otpornost analitike.

> **U praksi:** kad dobiješ izvještaj o incidentu sa listom IOC-ova, ubaci IOC-ove u liste za blokiranje i pretragu unazad (sati posla), ali u backlog detekcija stavi **ponašanje** iz izvještaja. IP adrese napadača će se promijeniti do sljedeće sedmice; to što je prvo ugasio CloudTrail neće.

## Uporedno: SPL i KQL ručno

Sigma ne zamjenjuje poznavanje ciljnog jezika: generisane upite treba pročitati i ponekad optimizovati. Isto pravilo za gašenje CloudTraila:

```text
index=aws sourcetype="aws:cloudtrail" eventSource="cloudtrail.amazonaws.com" eventName IN ("StopLogging","DeleteTrail")
| table _time userIdentity.arn sourceIPAddress awsRegion eventName
```

```kusto
AWSCloudTrail
| where EventSource == "cloudtrail.amazonaws.com" and EventName in ("StopLogging", "DeleteTrail")
| project TimeGenerated, UserIdentityArn, SourceIpAddress, AWSRegion, EventName
```

U Sentinelu CloudTrail stiže u tabelu `AWSCloudTrail` sa drugačijim imenima kolona (`EventName`, `UserIdentityArn`), zato `sentinel_asim` / `azure_monitor` pipeline ili vlastito mapiranje.

## Rezime

- Sigma je generički YAML format detekcija: `title`, `id`, `status`, `logsource`, `detection` + `condition`, `falsepositives`, `level`, `tags`; mapa = AND, lista = OR, podrazumijevano case-insensitive.
- Modifikatori (`contains`, `startswith`, `endswith`, `all`, `re`, `cidr`, `exists`, `gte`, `neq`, `fieldref`, `expand`...) se ulančavaju sa `|`; uslovi koriste `and`/`or`/`not`, `1 of`/`all of` i zagrade.
- Korelacije (`event_count`, `value_count`, `temporal`, `temporal_ordered`, metričke u 2.1) traže `group-by`, `timespan` i `condition`; podrška zavisi od backenda.
- `sigma check` validira, `sigma convert -t <backend> -p <pipeline>` konvertuje; pipeline mapira polja i dodaje indeks/tabelu; `--filter` dodaje izuzetke bez izmjene SigmaHQ pravila.
- Zircolite izvršava pravila nad JSON logovima; pazi na spljoštena imena polja (`--keepflat`, mapiranja u configu) i piši pozitivne i negativne testove (`--test-rules`).
- Životni ciklus: experimental -> test -> stable, tiho puštanje i mjerenje šuma, podešavanje filterima po stabilnom identitetu, periodična revizija.
- Detection as code: repo, review, `sigma check` i testovi u CI-ju, automatska konverzija i deploy; piramida bola usmjerava ka detekcijama ponašanja (TTP) umjesto IOC-ova.
