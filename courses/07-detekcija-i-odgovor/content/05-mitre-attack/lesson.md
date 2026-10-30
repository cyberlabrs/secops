## Šta ovaj modul pokriva

Modul pokriva cilj **3.1** iz domena 3: MITRE ATT&CK u detekciji, odnosno mapiranje detekcija na tehnike, mjerenje pokrivenosti i ATT&CK Navigator slojeve.

Poslije modula znaš:

- kako je ATT&CK organizovan (taktike, tehnike, podtehnike, procedure, grupe, detection strategies) i šta se promijenilo u verzijama 18–20;
- kako svakoj detekciji dodijeliti ispravan ATT&CK ID u Wazuhu i Sigmi;
- kako iz postojećih pravila izvući listu tehnika i napraviti **Navigator layer** (JSON);
- kako čitati pokrivenost bez samozavaravanja i kako odabrati sljedeću detekciju.

Fokus je odbrambeni: tehniku opisujemo onoliko koliko treba da se zna šta tražiti u logu.

## Šta je ATT&CK

**MITRE ATT&CK** je javna baza znanja o ponašanju napadača, izgrađena iz stvarnih incidenata. Ne govori „kako napasti“, nego „šta su napadači radili i kako to izgleda“. Za detekciju je važan jer daje zajednički jezik: „imamo detekciju za T1110.001 na Linuxu“ znači isto u svakom timu i svakom alatu.

Postoje tri domena (matrice): **Enterprise** (Windows, Linux, macOS, cloud, kontejneri, identitet, mrežni uređaji), **Mobile** i **ICS**. Mi radimo sa Enterprise.

| Objekat | ID primjer | Šta je |
|---|---|---|
| **Taktika** (tactic) | `TA0006` Credential Access | cilj napadača: „zašto“ |
| **Tehnika** (technique) | `T1110` Brute Force | način postizanja cilja: „kako“ |
| **Podtehnika** (sub-technique) | `T1110.001` Password Guessing | konkretnija varijanta tehnike |
| **Procedura** | opis upotrebe u stvarnom incidentu | konkretna implementacija (alat, komanda) |
| **Grupa** (group) | `G0139` TeamTNT | praćeni akter i tehnike koje koristi |
| **Softver** | `S…` | alat ili malver |
| **Kampanja** | `C…` | skup aktivnosti u određenom periodu |
| **Mitigacija** | `M…` | preventivna mjera |
| **Detection strategy** | `DET0551` | pristup detekciji tehnike (od v18) |
| **Analytic** | `AN1522` | logika detekcije za jednu platformu, vezana za log izvore |
| **Data component** | `DC0002` User Account Authentication | vrsta telemetrije koja je potrebna |

Jedna tehnika može pripadati više taktika. `T1078` Valid Accounts je istovremeno Initial Access, Persistence, Privilege Escalation i Stealth: isti ukradeni nalog služi za ulaz, ostanak i skrivanje.

## Verzije: v18, v19 i v20

ATT&CK izlazi dva puta godišnje (april i oktobar). Za detekciju su važne tri zadnje promjene:

| Verzija | Datum | Šta je bitno za detection inženjera |
|---|---|---|
| v18 | oktobar 2025 | stari „Detection“ tekst i **Data Sources** zamijenjeni su objektima **Detection Strategies** i **Analytics**; data components su prerađeni |
| v19 | april 2026 | taktika **Defense Evasion je podijeljena** na **Stealth** (`TA0005`, zadržava stari ID) i **Defense Impairment** (`TA0112`); dio tehnika je opozvan (revoked) i dobio nove ID-jeve |
| v20 | oktobar 2026 | nove tehnike (između ostalog vezane za AI), nove detection strategies; Enterprise ima 15 taktika |

Posljedica v19 za tebe: tehnike koje „gase odbranu“ imaju nove ID-jeve. Stari ID je **revoked** i upućuje na novi:

| Stari ID (do v18) | Novi ID (v19+) | Taktika |
|---|---|---|
| `T1562` Impair Defenses / `T1562.001` Disable or Modify Tools | `T1685` Disable or Modify Tools | Defense Impairment |
| `T1562.008` Disable or Modify Cloud Logs | `T1685.002` Disable or Modify Cloud Log | Defense Impairment |
| `T1562.012` Disable or Modify Linux Audit System | `T1685.004` Disable or Modify Linux Audit System Log | Defense Impairment |
| `T1070.002` Clear Linux or Mac System Logs | `T1685.006` Clear Linux or Mac System Logs | Defense Impairment |
| `T1562.004` Disable or Modify System Firewall | `T1686` Disable or Modify System Firewall | Defense Impairment |
| `T1562.003` Impair Command History Logging | `T1690` Prevent Command History Logging | Defense Impairment |

Neke srodne tehnike nisu pomjerene: `T1070.003` Clear Command History i `T1027` Obfuscated Files or Information su u taktici Stealth.

> **U praksi:** alati kasne za ATT&CK-om različitom brzinom. SigmaHQ pravila već koriste `attack.stealth`, `attack.defense-impairment` i `attack.t1685.002`, dok ugrađeni Wazuh ruleset i Wazuhova interna ATT&CK baza mogu i dalje koristiti stare ID-jeve (`T1562.x`). Kad spajaš pokrivenost iz više izvora, prvo normalizuj ID-jeve preko tabele revoked → novi; inače ista detekcija izgleda kao dvije različite, a nove tehnike izgledaju nepokriveno.

### Detection strategies i analytics

Od v18 svaka tehnika ima jednu ili više **detection strategies**, a svaka strategija ima **analytics** po platformi. Analytic navodi koje log izvore i data components treba gledati. Primjer za `T1110.001` Password Guessing (strategija `DET0551`):

| Analytic | Platforma | Data component | Log izvor (kako ga ATT&CK imenuje) |
|---|---|---|---|
| `AN1521` | Windows | `DC0002` User Account Authentication | `WinEventLog:Security`, EventCode 4625 |
| `AN1522` | Linux | `DC0002` User Account Authentication | `linux:syslog`, `sshd[pid]: Failed password` |
| `AN1523` | macOS | `DC0002` User Account Authentication | `macos:unifiedlog` |

To je direktno upotrebljivo: Linux analytic opisuje upravo linije koje Wazuh pravila 5760/5763 hvataju u `/var/log/auth.log`. Za `T1685.002` (gašenje cloud logova) analytic za IaaS pominje CloudTrail događaj zaustavljanja logovanja, što je `StopLogging` u CloudTrailu.

## Mapiranje detekcija

Mapiranje je odgovor na pitanje: „ako ovo pravilo okine, koje ponašanje napadača smo vidjeli?“ Pravila:

1. **Mapiraj ponašanje koje pravilo stvarno vidi**, ne cilj koji pretpostavljaš. Pravilo „kubectl exec u pod“ vidi `T1609` Container Administration Command. Možda je napadač iza toga radio Discovery, ali pravilo to ne vidi.
2. **Najprecizniji nivo**: podtehnika kad je znaš (`T1110.001`, ne samo `T1110`). Roditeljsku tehniku koristi kad pravilo pokriva više podtehnika (brute force bez razlikovanja guessing/spraying).
3. **Taktika slijedi iz konteksta**. `T1053.003` Cron je Execution, Persistence i Privilege Escalation. Novi crontab za korisnika `www-data` je najčešće Persistence.
4. **Ne mapiraj na silu.** Pravilo „neuspio health-check“ nema ATT&CK tehniku i to je u redu.

Primjeri iz našeg okruženja:

| Detekcija | Log izvor u labu | Tehnika | Taktika |
|---|---|---|---|
| Mnogo `Failed password` sa iste IP (Wazuh 5763) | `/var/log/auth.log` | `T1110.001` / `T1110` | Credential Access |
| Isti IP, mnogo različitih korisnika | `auth.log` | `T1110.003` Password Spraying | Credential Access |
| Uspješna prijava nakon niza neuspjeha | `auth.log` | `T1078` + `T1110` | Initial Access / Credential Access |
| Izmjena `~/.ssh/authorized_keys` (FIM) | Wazuh syscheck | `T1098.004` SSH Authorized Keys | Persistence |
| Novi lokalni korisnik (`useradd`) | `auth.log` | `T1136.001` Local Account | Persistence |
| `sudo` od korisnika koji ga nikad nije koristio | `auth.log` | `T1548.003` Sudo and Sudo Caching | Privilege Escalation |
| CloudTrail `StopLogging` / `DeleteTrail` | CloudTrail JSON | `T1685.002` | Defense Impairment |
| CloudTrail `CreateAccessKey` za drugog korisnika | CloudTrail JSON | `T1098.001` Additional Cloud Credentials | Persistence |
| K8s audit: `create` na `pods/exec` | K8s audit log | `T1609` | Execution |
| K8s audit: pod sa `privileged: true` ili hostPath | K8s audit log | `T1611` Escape to Host (priprema) | Privilege Escalation |
| K8s audit: `list` na `secrets` od servisnog naloga | K8s audit log | `T1552.007` Container API | Credential Access |
| Proces kriptominera (Falco, modul 07) | Falco | `T1496.001` Compute Hijacking | Impact |

### U Wazuh pravilu

```xml
<rule id="100130" level="12">
  <if_sid>100129</if_sid>
  <description>CloudTrail: logovanje zaustavljeno ($(data.eventName))</description>
  <mitre>
    <id>T1685.002</id>
  </mitre>
  <group>cloudtrail,defense_impairment,</group>
</rule>
```

U alarmu se pojavljuje blok `rule.mitre` sa `id`, a Wazuh iz svoje interne baze dodaje `tactic` i `technique` (imena). Ako je ID noviji od Wazuhove baze, imena mogu izostati. Detekcija i dalje radi; samo obogaćivanje fali. Zato je korisno u `<group>` dodati i ime taktike.

```bash
# koje tehnike su se stvarno pojavile u alarmima i koliko puta
jq -r '.rule.mitre.id[]?' /var/ossec/logs/alerts/alerts.json | sort | uniq -c | sort -rn

# alarmi sa tehnikom, ali bez imena (ID nepoznat Wazuhovoj bazi)
jq -c 'select(.rule.mitre.id and ((.rule.mitre.technique // []) | length) == 0)
       | {id:.rule.id, mitre:.rule.mitre.id}' /var/ossec/logs/alerts/alerts.json | sort -u
```

### U Sigma pravilu

```yaml
tags:
    - attack.defense-impairment
    - attack.t1685.002
```

Tagovi su mala slova, tačka razdvaja namespace. Taktike se pišu imenom (`attack.credential-access`, `attack.stealth`), tehnike ID-jem (`attack.t1110.001`), grupe sa `attack.g0139`. Detalji u modulu 06.

> **U praksi:** mapiranje radi i drugi posao: čini alarme pretraživim po ponašanju. Kad dođe threat intel izvještaj „akter X koristi T1098.004“, jedan upit nad alarmima kaže da li si to ikad vidio, a jedan grep nad pravilima kaže da li to uopšte možeš vidjeti.

## Pokrivenost

**Pokrivenost** (coverage) je odgovor na „koje tehnike možemo detektovati“. Postoji nekoliko nivoa iskrenosti:

| Nivo | Pitanje | Kako se mjeri |
|---|---|---|
| 0. Telemetrija | Imamo li uopšte log koji bi pokazao tehniku? | data components iz analytics vs. log izvori koje skupljamo |
| 1. Pravilo postoji | Postoji li pravilo sa tim ATT&CK tagom? | grep tagova u pravilima |
| 2. Pravilo je testirano | Da li okine na simulaciji tehnike? | Atomic Red Team / replay logova (modul 08) |
| 3. Pravilo je u produkciji i održivo | Ima li prihvatljiv broj lažnih pozitiva i vlasnika? | metrika alarma, runbook |

Mapa pravila (nivo 1) skoro uvijek izgleda bolje od stvarnosti. Jedno pravilo za `T1059.004` Unix Shell koje hvata `bash -i >& /dev/tcp` ne pokriva sve načine izvršavanja shella; pokriva jednu proceduru.

### Izvlačenje tehnika iz pravila

```bash
# Wazuh: tehnike u ugrađenim i lokalnim pravilima
grep -rhoE '<id>T[0-9]{4}(\.[0-9]{3})?</id>' /var/ossec/ruleset/rules /var/ossec/etc/rules \
  | sed -E 's#</?id>##g' | sort | uniq -c | sort -rn | head -20

# Sigma: tehnike u Linux i cloud pravilima SigmaHQ repozitorija
grep -rhoE 'attack\.t[0-9]{4}(\.[0-9]{3})?' /opt/sigma-rules/rules/linux /opt/sigma-rules/rules/cloud \
  | sed 's/attack\.//' | tr a-z A-Z | sort | uniq -c | sort -rn | head -20
```

### Navigator layer

**ATT&CK Navigator** je web aplikacija za prikaz matrice i bojenje tehnika. Radi i offline (statički build), a podatke mu daješ kao **layer**: JSON fajl. Aktuelna specifikacija formata je **layer 4.5** (Navigator 5.x).

Minimalan layer:

```json
{
  "name": "Detection lab - Wazuh i Sigma pokrivenost",
  "versions": { "attack": "20", "navigator": "5.3.2", "layer": "4.5" },
  "domain": "enterprise-attack",
  "description": "Tehnike za koje postoji bar jedno testirano pravilo",
  "filters": { "platforms": ["Linux", "IaaS", "Containers"] },
  "gradient": { "colors": ["#ffffff", "#66b1ff"], "minValue": 0, "maxValue": 3 },
  "techniques": [
    { "techniqueID": "T1110.001", "tactic": "credential-access", "score": 3,
      "comment": "Wazuh 5760/5763; testirano 2026-10-14" },
    { "techniqueID": "T1685.002", "tactic": "defense-impairment", "score": 2,
      "comment": "Sigma: CloudTrail StopLogging/DeleteTrail" },
    { "techniqueID": "T1609", "tactic": "execution", "score": 1,
      "comment": "K8s audit pods/exec; netestirano" }
  ],
  "legendItems": [
    { "label": "1 = pravilo postoji", "color": "#d6eaff" },
    { "label": "3 = testirano i u produkciji", "color": "#66b1ff" }
  ]
}
```

Polja koja ćeš najčešće koristiti:

| Polje | Napomena |
|---|---|
| `versions.layer` | obavezno, mora biti `"4.5"` za aktuelni format |
| `domain` | `enterprise-attack`, `mobile-attack` ili `ics-attack` |
| `techniques[].techniqueID` | `T####` ili `T####.###` |
| `techniques[].tactic` | kratko ime taktike (`credential-access`, `stealth`, `defense-impairment`); bez njega se oznaka primijeni pod svim taktikama tehnike |
| `score` | broj; boja se računa iz `gradient` |
| `color` | eksplicitna boja, ima prednost nad score |
| `comment`, `metadata`, `links` | zašto je tehnika obojena, ID pravila, link na runbook |
| `enabled: false` | tehnika se prikazuje sivo (npr. „nije relevantno za nas“) |

### Layer iz Sigma pravila: sigma analyze attack

`sigma-cli` pravi layer direktno iz pravila:

```bash
# score = broj pravila po tehnici
sigma analyze attack count /root/sigma-linux-cloud.json \
  /opt/sigma-rules/rules/linux /opt/sigma-rules/rules/cloud/aws

# samo pravila nivoa high+ i statusa test+
sigma analyze attack count -L high -T test /root/sigma-high.json /opt/sigma-rules/rules/cloud/aws
```

Funkcije bodovanja su `count` (broj pravila), `max` (najviši nivo) i `level` (zbir nivoa). Izlaz je layer koji Navigator otvara (sigma-cli 3.1 piše format layer `4.4`, što Navigator i dalje učitava).

### Layer iz Wazuh pravila: mala skripta

```bash
cat > /root/wazuh_layer.py <<'EOF'
import json, re, glob, collections
score = collections.Counter()
rules = collections.defaultdict(list)
for f in glob.glob("/var/ossec/ruleset/rules/*.xml") + glob.glob("/var/ossec/etc/rules/*.xml"):
    text = open(f, errors="ignore").read()
    for m in re.finditer(r'<rule id="(\d+)"(.*?)</rule>', text, re.S):
        rid, body = m.group(1), m.group(2)
        for t in re.findall(r"<id>(T\d{4}(?:\.\d{3})?)</id>", body):
            score[t] += 1
            rules[t].append(rid)
layer = {
    "name": "Wazuh ruleset - tehnike",
    "versions": {"layer": "4.5", "navigator": "5.3.2"},
    "domain": "enterprise-attack",
    "techniques": [
        {"techniqueID": t, "score": n, "comment": "pravila: " + ", ".join(rules[t][:10])}
        for t, n in sorted(score.items())
    ],
    "gradient": {"colors": ["#ffffff", "#ff6666"], "minValue": 0, "maxValue": max(score.values())},
}
json.dump(layer, open("/root/wazuh-layer.json", "w"), indent=2)
print(len(score), "tehnika")
EOF
python3 /root/wazuh_layer.py
jq '.techniques | length' /root/wazuh-layer.json
```

Ovdje nema `tactic`, pa Navigator boji tehniku pod svim njenim taktikama. Skripta broji i stare (revoked) ID-jeve; Navigator ih za v20 ne prikazuje, pa ih prije toga mapiraj na nove.

### Poređenje slojeva

Navigator ima „create layer from other layers“: izraz nad slojevima, npr. `b - a` gdje je `a` tvoja pokrivenost, a `b` sloj tehnika koje koristi akter relevantan za tebe (iz Navigatora: odabir grupe, npr. TeamTNT `G0139` za napade na Linux i kontejnere). Rezultat su tehnike koje akter koristi, a ti ih ne vidiš. To je lista kandidata za sljedeće detekcije.

Isto u par linija bez Navigatora:

```bash
jq -r '.techniques[].techniqueID' /root/akter.json | sort -u > /tmp/akter.txt
jq -r '.techniques[].techniqueID' /root/wazuh-layer.json /root/sigma-linux-cloud.json | sort -u > /tmp/imamo.txt
comm -23 /tmp/akter.txt /tmp/imamo.txt     # koristi akter, nemamo pravilo
```

> **U praksi:** ne prikazuj menadžmentu postotak „pokrili smo 63% ATT&CK-a“. Matrica ima stotine tehnika, mnoge nisu relevantne za tvoje platforme, a jedno pravilo po tehnici ne znači detekciju. Pokaži 10–20 tehnika važnih za tvoje okruženje (cloud nalozi, kontejneri, SSH, CI/CD), za svaku nivo 0–3 iz tabele iznad i plan za sljedeći kvartal.

## Prioritizacija: koju detekciju pisati sljedeću

Dobar redoslijed:

1. **Relevantnost**: tehnike za tvoje platforme (`Linux`, `IaaS`, `Containers`, `Identity Provider`) i aktere koji ciljaju tvoju industriju.
2. **Telemetrija postoji**: nema smisla pisati pravilo za izvor koji ne skupljaš; tada je prvi zadatak logovanje (modul 01).
3. **Uticaj**: tehnike blizu kraja lanca (gašenje logova, novi ključevi, exec u produkcijski pod) daju alarm visoke vrijednosti.
4. **Cijena lažnih pozitiva**: `T1059.004` Unix Shell je svuda; `T1685.002` StopLogging je rijedak i skoro uvijek zanimljiv.

| Tehnika | Relevantno | Telemetrija | Šum | Prioritet |
|---|---|---|---|---|
| `T1685.002` gašenje CloudTraila | da | CloudTrail | nizak | visok |
| `T1098.001` dodatni cloud ključevi | da | CloudTrail | srednji (rotacije) | visok |
| `T1609` exec u pod | da | K8s audit | srednji (debug) | srednji |
| `T1059.004` Unix shell | da | Falco / auditd | visok | nizak kao samostalno pravilo |
| `T1003.001` LSASS Memory | ne (nema Windowsa) | – | – | van opsega |

## Ograničenja ATT&CK-a

- ATT&CK je katalog **poznatog** ponašanja. Novi trikovi stižu u bazu sa zakašnjenjem.
- Tehnike nisu jednake veličine: `T1078` Valid Accounts obuhvata ogroman prostor, `T1611` Escape to Host je uzak.
- ATT&CK ne govori ništa o kvalitetu detekcije. Za otpornost detekcije na izmjene napadača postoji MITRE projekat **Summiting the Pyramid** (u Sigmi namespace `stp`), a za vrijednost indikatora piramida bola (modul 06).
- Mapiranje je subjektivno: dva analitičara ponekad mapiraju isto pravilo različito. Zapiši obrazloženje u `comment` ili opis pravila.

> **U praksi:** kad pišeš izvještaj o incidentu (modul 09), mapiraj i ono što je napadač radio i šta si od toga detektovao. Tehnike koje su se desile a nisu okinule alarm su najvrjedniji ulaz u backlog detekcija, vrjedniji od bilo kojeg teorijskog layera.

## Uporedno: Sentinel i Splunk

U Microsoft Sentinelu analytics rule ima polja **Tactics** i **Techniques**, a stranica MITRE ATT&CK prikazuje pokrivenost aktivnih i dostupnih pravila nad matricom. U KQL-u se incidenti mogu brojati po tehnici:

```kusto
SecurityAlert
| where TimeGenerated > ago(30d)
| mv-expand Technique = parse_json(Techniques)
| summarize Alerts = count() by tostring(Technique)
| order by Alerts desc
```

U Splunk Enterprise Security korelacione pretrage imaju **annotations** sa ATT&CK ID-jevima, a Splunk Security Content repozitorij mapira svaku detekciju na tehniku. Princip je isti kao kod Wazuha i Sigme: ID u metapodacima pravila, a pokrivenost se računa iz metapodataka.

## Rezime

- ATT&CK: taktike (zašto), tehnike i podtehnike (kako), procedure, grupe; od v18 detection strategies i analytics sa data components i log izvorima umjesto starih Data Sources.
- v19 je podijelio Defense Evasion na **Stealth** (`TA0005`) i **Defense Impairment** (`TA0112`); `T1562.x` i `T1070.002` su revoked i zamijenjeni sa `T1685.x`, `T1686`, `T1690`. Aktuelna verzija je v20 (15 Enterprise taktika).
- Mapiraj ponašanje koje pravilo stvarno vidi, na najprecizniji nivo; ne mapiraj na silu.
- Wazuh: `<mitre><id>` u pravilu, `rule.mitre.*` u alarmu; Sigma: `tags` sa `attack.<taktika>` i `attack.t####.###`. Normalizuj revoked ID-jeve prije spajanja pokrivenosti.
- Navigator layer je JSON (format `4.5`): `techniqueID`, `tactic`, `score`, `comment`, `gradient`; `sigma analyze attack` pravi layer iz Sigma pravila.
- Pokrivenost ima nivoe: telemetrija, pravilo, testirano, održivo. Mapa pravila precjenjuje stvarnost.
- Prioritizuj po relevantnosti, dostupnoj telemetriji, uticaju i cijeni lažnih pozitiva; razlika između sloja aktera i tvog sloja je backlog.
