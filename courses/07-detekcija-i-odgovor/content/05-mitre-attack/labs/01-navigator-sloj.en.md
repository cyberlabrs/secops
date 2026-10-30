# Lab 1: Detection coverage as an ATT&CK Navigator layer

Management asks: "Which attacker techniques do our detections cover?" You will extract the answer from the rules themselves. Wazuh rules contain `<mitre><id>T…</id></mitre>`, so you can build an **ATT&CK Navigator layer** (JSON) from them and open it in Navigator (https://mitre-attack.github.io/attack-navigator/).

The rules are in `/var/ossec/ruleset/rules/` (built-in) and `/var/ossec/etc/rules/` (custom).

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

## Techniques from rules

Create `/root/attack/tehnike.json`: an object whose key is the technique ID (e.g. `T1110.001`) and whose value is the number of rules (built-in and custom) that list it in `<mitre>`.

```bash
mkdir -p /root/attack
```

<!-- verify
f=/root/attack/tehnike.json
[ -s $f ] || { echo "$f is missing"; exit 1; }
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
got=$(jq -S -c . $f 2>/dev/null) || { echo "$f is not valid JSON"; exit 1; }
want=$(echo "$want" | jq -S -c .)
[ "$got" = "$want" ] || { echo "tehnike.json does not match the rules (check /var/ossec/etc/rules too, and that you count each rule once per technique)"; exit 1; }
-->
<!-- hint
Python and regular expressions are enough:
```python
import glob, re, json, collections
c = collections.Counter()
for p in glob.glob("/var/ossec/ruleset/rules/*.xml") + glob.glob("/var/ossec/etc/rules/*.xml"):
    for rule in re.findall(r"<rule\b.*?</rule>", open(p, errors="replace").read(), re.S):
        for t in set(re.findall(r"<id>\s*(T\d{4}(?:\.\d{3})?)\s*</id>", rule)):
            c[t] += 1
json.dump(c, open("/root/attack/tehnike.json", "w"), indent=2, sort_keys=True)
```
A rule that lists the same technique twice is counted once.
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

## Navigator layer

From `tehnike.json`, create `/root/attack/wazuh-sloj.json` in ATT&CK Navigator layer format:

- `name`: `Wazuh pokrivenost`, `domain`: `enterprise-attack`,
- `versions`: `{"layer": "4.5", "navigator": "5.1.0"}` (in `attack`, put the ATT&CK version you are building the layer for, e.g. `"18"`),
- `techniques`: for each technique an object `{"techniqueID": "...", "score": <number of rules>, "comment": "<number> pravila"}`,
- `gradient`: colors from white to green, `minValue` 0 and `maxValue` equal to the highest number of rules.

Open the layer in Navigator ("Open Existing Layer" → "Upload from local").

<!-- verify
f=/root/attack/wazuh-sloj.json
jq -e . $f >/dev/null 2>&1 || { echo "$f does not exist or is not JSON"; exit 1; }
jq -e '.name == "Wazuh pokrivenost" and .domain == "enterprise-attack" and .versions.layer == "4.5"' $f >/dev/null || { echo "name, domain or versions.layer is incorrect"; exit 1; }
jq -e --slurpfile t /root/attack/tehnike.json '([.techniques[] | {key: .techniqueID, value: .score}] | from_entries) == $t[0]' $f >/dev/null || { echo "techniques do not match tehnike.json (techniqueID and score)"; exit 1; }
jq -e '[.techniques[] | select((.comment // "") == "")] | length == 0' $f >/dev/null || { echo "every technique needs a comment"; exit 1; }
jq -e --slurpfile t /root/attack/tehnike.json '.gradient.minValue == 0 and .gradient.maxValue == ($t[0] | [.[]] | max) and (.gradient.colors | length >= 2)' $f >/dev/null || { echo "gradient: minValue 0, maxValue = highest number of rules, at least two colors"; exit 1; }
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

## Where are we blind?

The platform team (containers and cloud) says their biggest risks are the techniques in the list below. For each one, check whether **any** rule covers it (exactly that technique or one of its sub-techniques, e.g. `T1098.001` also covers `T1098`):

```text
T1110  T1098  T1078  T1552  T1496  T1525  T1609  T1611
```

Write the techniques that are **not** covered to `/root/attack/praznine.txt`, one per line. That is the input for the next detection sprint.

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
[ "$got" = "$(echo "$want" | sort -u)" ] || { echo "praznine.txt is incorrect"; exit 1; }
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
