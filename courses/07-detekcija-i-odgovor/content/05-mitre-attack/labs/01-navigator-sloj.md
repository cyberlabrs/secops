# Lab 1: Pokrivenost detekcija kao ATT&CK Navigator sloj

Menadžment pita: „Koje tehnike napadača naše detekcije pokrivaju?“ Odgovor ćeš izvući iz samih pravila. Wazuh pravila imaju `<mitre><id>T…</id></mitre>`, pa iz njih možeš napraviti **ATT&CK Navigator sloj** (JSON) i otvoriti ga u Navigatoru (https://mitre-attack.github.io/attack-navigator/).

Pravila su u `/var/ossec/ruleset/rules/` (ugrađena) i `/var/ossec/etc/rules/` (vlastita).

```bash
grep -h -o '<id>T[0-9.]*</id>' /var/ossec/ruleset/rules/*.xml | sort | uniq -c | sort -rn | head
cat /var/ossec/etc/rules/local_rules.xml
```

<!-- setup
set -e
cat > /var/ossec/etc/rules/local_rules.xml <<'EOF'
<group name="kurs-api,">
  <rule id="100100" level="0">
    <program_name>^kurs-api$</program_name>
    <description>kurs-api: događaj</description>
  </rule>
  <rule id="100101" level="5">
    <if_sid>100100</if_sid>
    <match>event=login_failed</match>
    <description>kurs-api: neuspjela prijava</description>
    <mitre><id>T1110</id></mitre>
  </rule>
  <rule id="100103" level="12">
    <if_sid>100100</if_sid>
    <match>role=owner</match>
    <description>kurs-api: dodijeljena uloga owner</description>
    <mitre><id>T1098</id></mitre>
  </rule>
  <rule id="100104" level="10">
    <if_sid>100100</if_sid>
    <match>event=token_created scope=admin</match>
    <description>kurs-api: kreiran admin API token</description>
    <mitre><id>T1098.001</id></mitre>
  </rule>
</group>
EOF
-->

## Tehnike iz pravila

Napravi `/root/attack/tehnike.json`: objekat u kome je ključ ID tehnike (npr. `T1110.001`), a vrijednost broj pravila (ugrađenih i vlastitih) koja je navode u `<mitre>`.

```bash
mkdir -p /root/attack
```

<!-- verify
f=/root/attack/tehnike.json
[ -s $f ] || { echo "nema $f"; exit 1; }
want=$(python3 - <<'EOF'
import glob, re, json, collections
c = collections.Counter()
for p in glob.glob("/var/ossec/ruleset/rules/*.xml") + glob.glob("/var/ossec/etc/rules/*.xml"):
    s = open(p, errors="replace").read()
    for rule in re.findall(r"<rule\b.*?</rule>", s, re.S):
        for m in re.findall(r"<mitre>(.*?)</mitre>", rule, re.S):
            for t in set(re.findall(r"<id>\s*(T\d{4}(?:\.\d{3})?)\s*</id>", m)):
                c[t] += 1
print(json.dumps(dict(sorted(c.items())), sort_keys=True))
EOF
)
got=$(jq -S -c . $f 2>/dev/null) || { echo "$f nije validan JSON"; exit 1; }
want=$(echo "$want" | jq -S -c .)
[ "$got" = "$want" ] || { echo "tehnike.json se ne slaže sa pravilima (provjeri i /var/ossec/etc/rules i da li brojiš svako pravilo jednom po tehnici)"; exit 1; }
-->
<!-- hint
Python i regularni izrazi su dovoljni:
```python
import glob, re, json, collections
c = collections.Counter()
for p in glob.glob("/var/ossec/ruleset/rules/*.xml") + glob.glob("/var/ossec/etc/rules/*.xml"):
    for rule in re.findall(r"<rule\b.*?</rule>", open(p, errors="replace").read(), re.S):
        for t in set(re.findall(r"<id>\s*(T\d{4}(?:\.\d{3})?)\s*</id>", rule)):
            c[t] += 1
json.dump(c, open("/root/attack/tehnike.json", "w"), indent=2, sort_keys=True)
```
Pravilo koje istu tehniku navede dvaput broji se jednom.
-->
<!-- solution
mkdir -p /root/attack
python3 - <<'EOF'
import glob, re, json, collections
c = collections.Counter()
for p in glob.glob("/var/ossec/ruleset/rules/*.xml") + glob.glob("/var/ossec/etc/rules/*.xml"):
    s = open(p, errors="replace").read()
    for rule in re.findall(r"<rule\b.*?</rule>", s, re.S):
        for m in re.findall(r"<mitre>(.*?)</mitre>", rule, re.S):
            for t in set(re.findall(r"<id>\s*(T\d{4}(?:\.\d{3})?)\s*</id>", m)):
                c[t] += 1
json.dump(dict(sorted(c.items())), open("/root/attack/tehnike.json", "w"), indent=2)
EOF
-->

## Navigator sloj

Od `tehnike.json` napravi `/root/attack/wazuh-sloj.json` u formatu ATT&CK Navigator sloja:

- `name`: `Wazuh pokrivenost`, `domain`: `enterprise-attack`,
- `versions`: `{"layer": "4.5", "navigator": "5.1.0"}` (u `attack` upiši verziju ATT&CK-a za koju praviš sloj, npr. `"18"`),
- `techniques`: za svaku tehniku objekat `{"techniqueID": "...", "score": <broj pravila>, "comment": "<broj> pravila"}`,
- `gradient`: boje od bijele do zelene, `minValue` 0 i `maxValue` jednak najvećem broju pravila.

Sloj otvoriš u Navigatoru („Open Existing Layer“ → „Upload from local“).

<!-- verify
f=/root/attack/wazuh-sloj.json
jq -e . $f >/dev/null 2>&1 || { echo "$f ne postoji ili nije JSON"; exit 1; }
jq -e '.name == "Wazuh pokrivenost" and .domain == "enterprise-attack" and .versions.layer == "4.5"' $f >/dev/null || { echo "name, domain ili versions.layer nisu tačni"; exit 1; }
jq -e --slurpfile t /root/attack/tehnike.json '([.techniques[] | {key: .techniqueID, value: .score}] | from_entries) == $t[0]' $f >/dev/null || { echo "techniques se ne slažu sa tehnike.json (techniqueID i score)"; exit 1; }
jq -e '[.techniques[] | select((.comment // "") == "")] | length == 0' $f >/dev/null || { echo "svaka tehnika treba comment"; exit 1; }
jq -e --slurpfile t /root/attack/tehnike.json '.gradient.minValue == 0 and .gradient.maxValue == ($t[0] | [.[]] | max) and (.gradient.colors | length >= 2)' $f >/dev/null || { echo "gradient: minValue 0, maxValue = najveći broj pravila, barem dvije boje"; exit 1; }
-->
<!-- hint
```bash
jq '{name: "Wazuh pokrivenost", domain: "enterprise-attack",
     versions: {attack: "18", navigator: "5.1.0", layer: "4.5"},
     techniques: (to_entries | map({techniqueID: .key, score: .value, comment: "\(.value) pravila"})),
     gradient: {colors: ["#ffffff", "#2e7d32"], minValue: 0, maxValue: ([.[]] | max)}}' \
   /root/attack/tehnike.json > /root/attack/wazuh-sloj.json
```
-->
<!-- solution
jq '{name: "Wazuh pokrivenost", domain: "enterprise-attack", versions: {attack: "18", navigator: "5.1.0", layer: "4.5"}, techniques: (to_entries | map({techniqueID: .key, score: .value, comment: "\(.value) pravila"})), gradient: {colors: ["#ffffff", "#2e7d32"], minValue: 0, maxValue: ([.[]] | max)}}' /root/attack/tehnike.json > /root/attack/wazuh-sloj.json
-->

## Gdje smo slijepi?

Tim platforme (kontejneri i cloud) kaže da su im najveći rizici tehnike iz liste ispod. Za svaku provjeri da li je pokriva **bilo koje** pravilo (tačno ta tehnika ili neka njena podtehnika, npr. `T1098.001` pokriva i `T1098`):

```text
T1110  T1098  T1078  T1552  T1496  T1525  T1609  T1611
```

U `/root/attack/praznine.txt` upiši tehnike koje **nisu** pokrivene, jednu po redu. To je ulaz za sljedeći sprint detekcija.

<!-- verify
want=$(python3 - <<'EOF'
import json
t = json.load(open("/root/attack/tehnike.json"))
for x in "T1110 T1098 T1078 T1552 T1496 T1525 T1609 T1611".split():
    if not any(k == x or k.startswith(x + ".") for k in t):
        print(x)
EOF
)
got=$(grep -oE 'T[0-9]{4}' /root/attack/praznine.txt 2>/dev/null | sort -u)
[ "$got" = "$(echo "$want" | sort -u)" ] || { echo "praznine.txt nije tačan"; exit 1; }
-->
<!-- hint
```bash
for x in T1110 T1098 T1078 T1552 T1496 T1525 T1609 T1611; do
  jq -e --arg x "$x" 'keys | any(. == $x or startswith($x + "."))' /root/attack/tehnike.json >/dev/null || echo $x
done
```
-->
<!-- solution
for x in T1110 T1098 T1078 T1552 T1496 T1525 T1609 T1611; do
  jq -e --arg x "$x" 'keys | any(. == $x or startswith($x + "."))' /root/attack/tehnike.json >/dev/null || echo $x
done > /root/attack/praznine.txt
-->
