# Lab 1: Istraga incidenta sa AI agentom za podršku

Agent za podršku kurs-shopa (`support-agent`) pomaže operaterima: pretražuje bazu znanja (RAG, alat `search_kb`), čita tikete (`read_ticket`), izvršava SQL (`run_sql`), šalje e-poštu (`send_email`) i otvara URL-ove (`http_get`). U utorak, 14. 10. 2026. u 11:13 e-mail gateway je odbio poruku servisnog naloga agenta ka domeni registrovanoj prije tri dana. Ti si analitičar SOC-a: utvrdi kako je agent preuzet, šta je iscurilo i kuda, obuzdaj incident, napiši politiku čuvara alata i izvještaj.

Nema pravog LLM-a: radiš nad snimljenim tragovima agenta (`traces/*.jsonl`), dokumentima baze znanja, logom e-mail gateway-a i konfiguracijom agenta.

```bash
cd /root
ls kb traces mail agent
jq -c 'select(.event=="tool_call") | [.ts, .session_id, .tool]' traces/*.jsonl | head
```

Odgovore upisuj u `/root/odgovori/`, po jedan podatak u red.

<!-- setup
set -e
cp -r /opt/scenariji/05-ai-agent-incident/. /root/
mkdir -p /root/odgovori /root/guard /root/karantin
-->
<!-- timer
55
-->

## Otrovani dokument u bazi znanja

Svaki zapis u tragu ima `session_id`, `user`, `event` (`user_prompt`, `tool_call`, `tool_result`, `assistant_response`) i vrijeme. Rezultat `search_kb` sadrži isječke (`chunks`) koje je agent dobio iz baze znanja: to je sadržaj koji je model pročitao, a korisnik ga nije vidio.

Pronađi dokument u `kb/` koji sadrži instrukcije namijenjene modelu (indirektni prompt injection). Pazi: nije svaka rečenica upućena asistentu zlonamjerna. Pogledaj i `kb/index.json`: odakle je dokument došao u bazu znanja?

- u `/root/odgovori/dokument.txt` upiši ID dokumenta (npr. `KB-0001`),
- u `/root/odgovori/tiket.txt` upiši tiket preko kojeg je dokument ušao u bazu znanja.

<!-- verify
cd /root/odgovori
[ -s dokument.txt ] || { echo "nema dokument.txt"; exit 1; }
grep -q 'KB-0142' dokument.txt || { echo "dokument.txt: pogrešan dokument"; exit 1; }
[ "$(grep -o 'KB-[0-9]*' dokument.txt | sort -u | wc -l)" = "1" ] || { echo "dokument.txt: upiši samo jedan dokument"; exit 1; }
grep -q 'TCK-4471' tiket.txt 2>/dev/null || { echo "tiket.txt: pogrešan tiket"; exit 1; }
-->
<!-- hint
```bash
grep -n -i -E 'asistent|assistant|instruc|run_sql|send_email|http_get' kb/*.md
jq -r '.[] | [.doc_id, .source, .uploaded_by, .ingested_at, (.ticket // "-")] | @tsv' kb/index.json
```
KB-0007 ima napomenu za asistenta, ali to je interna smjernica o tonu, koju je napisala podrška. Traži skriveni blok koji se ne vidi kad se markdown prikaže.
-->
<!-- solution
echo KB-0142 > /root/odgovori/dokument.txt
echo TCK-4471 > /root/odgovori/tiket.txt
-->

## Pozivi alata u pogođenim sesijama

Utvrdi u kojim sesijama je agent dobio bilo koji isječak otrovanog dokumenta, a zatim izlistaj sve pozive alata iz tih sesija.

- `/root/odgovori/sesije.txt`: ID-jevi tih sesija, jedan u redu, sortirano,
- `/root/odgovori/pozivi.tsv`: izlaz jq upita koji za svaki `tool_call` iz tih sesija ispiše `ts`, `session_id`, `call_id` i `tool` odvojene tabom (`@tsv`), redom kojim se pojavljuju u `traces/*.jsonl`.

Uporedi sesije: u kojima je agent poslije pretrage pozvao alate koje korisnik nije tražio, a u kojoj nije? Pogledaj koje isječke (`chunk_id`) je koja sesija dobila.

<!-- verify
cd /root/odgovori
want='sess-3f9b2d
sess-a41c07
sess-c8e512'
[ "$(grep -v '^\s*$' sesije.txt 2>/dev/null | sort -u)" = "$want" ] || { echo "sesije.txt nije tačan"; exit 1; }
ref=$(jq -r 'select(.event=="tool_call" and (.session_id=="sess-3f9b2d" or .session_id=="sess-a41c07" or .session_id=="sess-c8e512")) | [.ts, .session_id, .call_id, .tool] | @tsv' /opt/scenariji/05-ai-agent-incident/traces/*.jsonl)
[ "$(tr -d '\r' < pozivi.tsv 2>/dev/null)" = "$ref" ] || { echo "pozivi.tsv se ne poklapa sa referencom (kolone ts, session_id, call_id, tool; redom iz fajlova)"; exit 1; }
-->
<!-- hint
```bash
jq -r 'select(.event=="tool_result" and .tool=="search_kb")
  | select(any(.output.chunks[]; .doc_id=="KB-0142")) | .session_id' traces/*.jsonl | sort -u > odgovori/sesije.txt
S=$(jq -R . odgovori/sesije.txt | jq -sc .)
jq -r --argjson S "$S" 'select(.event=="tool_call" and (.session_id | IN($S[])))
  | [.ts, .session_id, .call_id, .tool] | @tsv' traces/*.jsonl > odgovori/pozivi.tsv
```
-->
<!-- solution
cd /root
jq -r 'select(.event=="tool_result" and .tool=="search_kb") | select(any(.output.chunks[]; .doc_id=="KB-0142")) | .session_id' traces/*.jsonl | sort -u > odgovori/sesije.txt
S=$(jq -R . odgovori/sesije.txt | jq -sc .)
jq -r --argjson S "$S" 'select(.event=="tool_call" and (.session_id | IN($S[]))) | [.ts, .session_id, .call_id, .tool] | @tsv' traces/*.jsonl > odgovori/pozivi.tsv
-->

## Šta je iscurilo i kuda

Pogledaj argumente i rezultate sumnjivih poziva (`send_email`, `http_get`, `run_sql`) i uporedi ih sa logom e-mail gateway-a `mail/gateway.jsonl`. Pokušaj nije isto što i curenje: provjeri status svakog pokušaja. Podaci u URL-u su kodirani u base64.

- `/root/odgovori/odrediste.txt`: vanjska e-mail adresa i vanjski host na koje su podaci poslani (svaki u svom redu),
- `/root/odgovori/mejl.txt`: `message_id` poruke koju je gateway **isporučio** napadaču,
- `/root/odgovori/ukupno.txt`: broj **različitih** kupaca (po `id`) čiji su podaci zaista napustili firmu, kroz sve kanale zajedno,
- `/root/odgovori/polja.txt`: nazivi kolona (iz tabele `kupci`) koje su iscurile, odvojeni zarezom.

<!-- verify
cd /root/odgovori
grep -qi 'verifikacija@kurs-shop-podrska.com' odrediste.txt 2>/dev/null || { echo "odrediste.txt: nedostaje e-mail adresa"; exit 1; }
grep -qi 'cdn-sync.kurs-shop-podrska.com' odrediste.txt || { echo "odrediste.txt: nedostaje host"; exit 1; }
grep -qF '20261014084912.7d1c@mail.kurs-shop.ba' mejl.txt 2>/dev/null || { echo "mejl.txt: pogrešan message_id"; exit 1; }
grep -q '20261014111329' mejl.txt && { echo "mejl.txt: ta poruka nije isporučena"; exit 1; }
[ "$(tr -dc '0-9' < ukupno.txt 2>/dev/null)" = "203" ] || { echo "ukupno.txt: pogrešan broj kupaca"; exit 1; }
for k in ime prezime email telefon; do grep -qiw "$k" polja.txt 2>/dev/null || { echo "polja.txt: nedostaje kolona $k"; exit 1; }; done
grep -Eqi 'iban|lozink|password|kartic' polja.txt && { echo "polja.txt: ta kolona nije iscurila"; exit 1; }
exit 0
-->
<!-- hint
```bash
jq -c 'select(.call_id=="c-0014" or .call_id=="c-0024" or .call_id=="c-0025") | {ts, event, tool, status, error, to: .args.to}' traces/*.jsonl
jq -c 'select(.to? and (.to | test("kurs-shop-podrska")))' mail/gateway.jsonl
jq -r 'select(.call_id=="c-0025" and .event=="tool_call") | .args.url | capture("d=(?<d>.*)").d | @base64d' traces/*.jsonl | head -3
jq -r 'select(.call_id=="c-0014" and .event=="tool_call") | .args.body' traces/*.jsonl | head -3
```
Sastavi ID-jeve iz isporučene poruke i iz dekodiranog URL-a, pa `sort -u | wc -l`. Druga poruka (11:13) nije isporučena, ali je agent zato pozvao `http_get`.
-->
<!-- solution
cd /root
printf 'verifikacija@kurs-shop-podrska.com\ncdn-sync.kurs-shop-podrska.com\n' > odgovori/odrediste.txt
jq -r 'select(.status=="delivered" and (.to | endswith("@kurs-shop-podrska.com"))) | .message_id' mail/gateway.jsonl > odgovori/mejl.txt
{ jq -r 'select(.call_id=="c-0014" and .event=="tool_call") | .args.body' traces/*.jsonl | tail -n +2 | cut -d, -f1
  jq -r 'select(.call_id=="c-0025" and .event=="tool_call") | .args.url | capture("d=(?<d>.*)").d | @base64d' traces/*.jsonl | cut -d, -f1
} | sort -u | wc -l | tr -d ' ' > odgovori/ukupno.txt
echo 'id,ime,prezime,email,telefon' > odgovori/polja.txt
-->

## Obuzdavanje: dokument, ingest i blokada

Prvo zaustavi izvor i kanal, pa tek onda popravljaj kontrole:

1. Premjesti otrovani dokument iz `kb/` u `/root/karantin/` i u `kb/index.json` mu postavi `"status": "quarantined"` (ostali dokumenti ostaju `active`).
2. U `agent/agent-config.yaml` (sa `yq -i`): izbaci `ticket_attachments` iz `.kb.ingest.sources` (ostaje `confluence:PODRSKA`), uključi `.kb.ingest.strip_html_comments: true` i promijeni `.tools.run_sql.db_role` na `support_agent_ro`.
3. Dodaj domenu napadača u `mail/blocklist.txt` (jedna domena u redu).

<!-- verify
cd /root
[ -f karantin/KB-0142-uputstvo-reklamacije-2026.md ] || { echo "dokument nije u /root/karantin/"; exit 1; }
ls kb/KB-0142* >/dev/null 2>&1 && { echo "dokument je još u kb/"; exit 1; }
[ "$(jq -r '.[] | select(.doc_id=="KB-0142") | .status' kb/index.json)" = "quarantined" ] || { echo "index.json: KB-0142 nema status quarantined"; exit 1; }
[ "$(jq '[.[] | select(.status=="active")] | length' kb/index.json)" = "9" ] || { echo "index.json: ostali dokumenti treba da ostanu active"; exit 1; }
[ "$(yq '.kb.ingest.sources | contains(["ticket_attachments"])' agent/agent-config.yaml)" = "false" ] || { echo "ticket_attachments je još izvor ingesta"; exit 1; }
[ "$(yq '.kb.ingest.sources | contains(["confluence:PODRSKA"])' agent/agent-config.yaml)" = "true" ] || { echo "confluence:PODRSKA treba da ostane izvor"; exit 1; }
[ "$(yq '.kb.ingest.strip_html_comments' agent/agent-config.yaml)" = "true" ] || { echo "strip_html_comments nije true"; exit 1; }
[ "$(yq '.tools.run_sql.db_role' agent/agent-config.yaml)" = "support_agent_ro" ] || { echo "db_role nije support_agent_ro"; exit 1; }
grep -qx 'kurs-shop-podrska.com' mail/blocklist.txt || { echo "domena nije u blocklist.txt"; exit 1; }
-->
<!-- hint
```bash
jq '(.[] | select(.doc_id=="KB-0142") | .status) = "quarantined"' kb/index.json > /tmp/i.json && mv /tmp/i.json kb/index.json
yq -i '.kb.ingest.sources |= map(select(. != "ticket_attachments"))' agent/agent-config.yaml
```
U stvarnom incidentu ovdje ide i reindeksiranje vektorske baze (isječci dokumenta ostaju u indeksu dok se ne obrišu), privremeno isključenje alata `send_email` i `http_get` i provjera da li je ista domena viđena u proxy i DNS logovima.
-->
<!-- solution
cd /root
mv kb/KB-0142-uputstvo-reklamacije-2026.md karantin/
jq '(.[] | select(.doc_id=="KB-0142") | .status) = "quarantined"' kb/index.json > /tmp/i.json && mv /tmp/i.json kb/index.json
yq -i '.kb.ingest.sources |= map(select(. != "ticket_attachments")) | .kb.ingest.strip_html_comments = true | .tools.run_sql.db_role = "support_agent_ro"' agent/agent-config.yaml
echo kurs-shop-podrska.com >> mail/blocklist.txt
-->

## Politika čuvara alata

Uklanjanje dokumenta ne rješava problem: sljedeći injection može doći kroz tiket, mejl ili web stranicu. Napiši politiku `/root/guard/policy.yaml` koju izvršava deterministički čuvar između modela i alata, i testiraj je alatom `tool-guard`, koji ponovo „izvrši“ sve snimljene pozive alata kroz politiku:

```bash
tool-guard --policy /root/guard/policy.yaml --summary traces/*.jsonl
```

Format politike je opisan u `tool-guard` (pokreni ga bez argumenata). Pravila:

1. Sve što nije navedeno je zabranjeno (`default: deny`).
2. `search_kb` i `read_ticket`: dozvoljeni.
3. `run_sql`: samo čitanje (`read_only`) i samo tabele `narudzbe`, `proizvodi` i `tiketi`.
4. `send_email`: samo primaoci iz domene `kurs-shop.ba`, i to uz odobrenje čovjeka (`approval`).
5. `http_get`: `status.kurs-shop.ba` dozvoljen; vanjski `api.posta.ba` uz odobrenje čovjeka; svi ostali hostovi zabranjeni.

Politika mora odbiti (`deny`) svih pet zlonamjernih poziva, a legitimne pozive dozvoliti ili poslati na odobrenje. Izlaz za `traces/*.jsonl` (bez `--summary`) sačuvaj u `/root/guard/odluke.csv`, a u `agent/agent-config.yaml` uključi čuvara: `.guard.enabled: true` i `.guard.policy: /root/guard/policy.yaml`.

<!-- verify
cd /root/guard
[ -f policy.yaml ] || { echo "nema /root/guard/policy.yaml"; exit 1; }
T=$(mktemp -d)
cat > $T/ref.yaml <<'EOF'
default: deny
tools:
  search_kb: {decision: allow}
  read_ticket: {decision: allow}
  run_sql: {decision: allow, read_only: true, tables: [narudzbe, proizvodi, tiketi]}
  send_email: {decision: approval, recipient_domains: [kurs-shop.ba]}
  http_get: {decision: allow, hosts: [status.kurs-shop.ba], approval_hosts: [api.posta.ba]}
EOF
cat > $T/extra.jsonl <<'EOF'
{"event": "tool_call", "call_id": "t-01", "session_id": "test", "tool": "delete_ticket", "args": {"ticket_id": "TCK-1"}}
{"event": "tool_call", "call_id": "t-02", "session_id": "test", "tool": "run_sql", "args": {"query": "DELETE FROM narudzbe WHERE id = 1"}}
{"event": "tool_call", "call_id": "t-03", "session_id": "test", "tool": "run_sql", "args": {"query": "SELECT iban FROM placanja"}}
{"event": "tool_call", "call_id": "t-04", "session_id": "test", "tool": "run_sql", "args": {"query": "SELECT id FROM narudzbe; DROP TABLE kupci"}}
{"event": "tool_call", "call_id": "t-05", "session_id": "test", "tool": "send_email", "args": {"to": "a@kurs-shop.ba.evil.io", "subject": "x", "body": "y"}}
{"event": "tool_call", "call_id": "t-06", "session_id": "test", "tool": "send_email", "args": {"to": ["a@kurs-shop.ba", "b@gmail.com"], "subject": "x", "body": "y"}}
{"event": "tool_call", "call_id": "t-07", "session_id": "test", "tool": "http_get", "args": {"url": "https://api.posta.ba.evil.io/x"}}
{"event": "tool_call", "call_id": "t-08", "session_id": "test", "tool": "http_get", "args": {"url": "https://status.kurs-shop.ba/api/v1/status"}}
{"event": "tool_call", "call_id": "t-09", "session_id": "test", "tool": "run_sql", "args": {"query": "SELECT naziv FROM proizvodi WHERE id = 3"}}
{"event": "tool_call", "call_id": "t-10", "session_id": "test", "tool": "send_email", "args": {"to": "it@kurs-shop.ba", "subject": "x", "body": "y"}}
EOF
D=/opt/scenariji/05-ai-agent-incident/traces
tool-guard --policy policy.yaml $D/*.jsonl $T/extra.jsonl > $T/mine.csv 2> $T/err || { echo "tool-guard javlja grešku:"; cat $T/err; exit 1; }
tool-guard --policy $T/ref.yaml $D/*.jsonl $T/extra.jsonl > $T/ref.csv
for c in c-0013 c-0014 c-0023 c-0024 c-0025; do grep -q "^$c,.*,deny," $T/mine.csv || { echo "zlonamjerni poziv $c nije odbijen"; exit 1; }; done
bad=$(diff <(cut -d, -f1,3,4 $T/ref.csv) <(cut -d, -f1,3,4 $T/mine.csv) | grep '^>' | head -5)
[ -z "$bad" ] || { echo "odluke se ne poklapaju sa pravilima (call_id,tool,odluka):"; echo "$bad"; exit 1; }
[ "$(tr -d '\r' < odluke.csv 2>/dev/null)" = "$(tool-guard --policy policy.yaml /root/traces/*.jsonl)" ] || { echo "odluke.csv nije izlaz tool-guarda za traces/*.jsonl"; exit 1; }
[ "$(yq '.guard.enabled' /root/agent/agent-config.yaml)" = "true" ] || { echo "čuvar nije uključen u agent-config.yaml"; exit 1; }
[ "$(yq '.guard.policy' /root/agent/agent-config.yaml)" = "/root/guard/policy.yaml" ] || { echo "guard.policy nije /root/guard/policy.yaml"; exit 1; }
-->
<!-- hint
```yaml
default: deny
tools:
  search_kb:
    decision: allow
  run_sql:
    decision: allow
    read_only: true
    tables: [...]
  send_email:
    decision: approval
    recipient_domains: [...]
  http_get:
    decision: allow
    hosts: [...]
    approval_hosts: [...]
```
Politika je odbrana u dubini, ne zamjena za najmanje privilegije: uloga `support_agent_ro` u bazi i dalje mora imati samo `SELECT` na te tri tabele, pa ni greška u čuvaru ne otvara tabelu `kupci`.
-->
<!-- solution
cat > /root/guard/policy.yaml <<'EOF'
default: deny
tools:
  search_kb:
    decision: allow
  read_ticket:
    decision: allow
  run_sql:
    decision: allow
    read_only: true
    tables: [narudzbe, proizvodi, tiketi]
  send_email:
    decision: approval
    recipient_domains: [kurs-shop.ba]
  http_get:
    decision: allow
    hosts: [status.kurs-shop.ba]
    approval_hosts: [api.posta.ba]
EOF
tool-guard --policy /root/guard/policy.yaml /root/traces/*.jsonl > /root/guard/odluke.csv
yq -i '.guard.enabled = true | .guard.policy = "/root/guard/policy.yaml"' /root/agent/agent-config.yaml
-->

## Vremenska linija i izvještaj

Napiši `/root/odgovori/izvjestaj.md` za CISO-a i DPO-a (kratko, u markdownu):

- **vremenska linija** sa bar pet događaja (vrijeme u UTC, `HH:MM`): od otvaranja tiketa i ingesta dokumenta do obuzdavanja,
- **uticaj**: ID otrovanog dokumenta, odredišta (domena napadača), broj kupaca i polja koja su iscurila,
- **mapiranje**: OWASP Top 10 za LLM (`LLM01`, `LLM02`, `LLM06`) i MITRE ATLAS (bar `AML.T0051` i tehnika eksfiltracije, npr. `AML.T0086`),
- **preporuke** (ili *recommendations*): šta mijenjate da se ne ponovi.

<!-- verify
f=/root/odgovori/izvjestaj.md
[ -s $f ] || { echo "nema izvjestaj.md"; exit 1; }
for k in LLM01 LLM02 LLM06 AML.T0051 KB-0142 kurs-shop-podrska.com 203; do grep -qF "$k" $f || { echo "izvještaj ne sadrži $k"; exit 1; }; done
grep -Eq 'AML\.T0086|AML\.T0025|AML\.T0057' $f || { echo "nedostaje ATLAS tehnika eksfiltracije ili curenja"; exit 1; }
[ "$(grep -Ec '\b([01][0-9]|2[0-3]):[0-5][0-9]\b' $f)" -ge 5 ] || { echo "vremenska linija treba bar 5 događaja sa vremenom HH:MM"; exit 1; }
grep -Eqi 'preporu|recommend' $f || { echo "nedostaju preporuke"; exit 1; }
-->
<!-- hint
Vremena uzmi iz `kb/index.json` (ingest), `read_ticket` (kreiran tiket), tragova i gateway loga (isporuka, odbijanje, alarm). Nemoj kopirati podatke kupaca u izvještaj: dovoljni su broj i vrste podataka.
-->
<!-- solution
cat > /root/odgovori/izvjestaj.md <<'EOF'
# Incident: preuzimanje agenta za podršku kroz otrovani dokument (KB-0142)

### Vremenska linija (UTC)
- 2026-10-13 16:42 kupac-4996 otvara tiket TCK-4471 sa prilogom uputstvo-reklamacije-2026.md
- 2026-10-13 17:00 ingest indeksira prilog kao KB-0142 (izvor ticket_attachments)
- 2026-10-14 08:47 sesija sess-3f9b2d dobija isječak KB-0142#3; 08:48 run_sql nad tabelom kupci (200 redova)
- 2026-10-14 08:49 send_email na verifikacija@kurs-shop-podrska.com, gateway isporučuje
- 2026-10-14 11:13 sesija sess-a41c07: mejl odbijen (nrd-block), agent šalje 20 redova kroz http_get na cdn-sync.kurs-shop-podrska.com
- 2026-10-14 11:13 alarm gateway-a, triaža SOC-a; 12:30 obuzdavanje (karantin KB-0142, blokada domene, čuvar alata)

### Uticaj
203 kupca: id, ime, prezime, email, telefon (bez podataka o plaćanju). Odredišta: verifikacija@kurs-shop-podrska.com i cdn-sync.kurs-shop-podrska.com.

### Mapiranje
- OWASP: LLM01 Prompt Injection (indirektni, kroz RAG), LLM06 Excessive Agency, LLM02 Sensitive Information Disclosure
- MITRE ATLAS: AML.T0051.001, AML.T0070 RAG Poisoning, AML.T0053, AML.T0086 Exfiltration via AI Agent Tool Invocation

### Preporuke
Prilozi tiketa ne idu u zajedničku bazu znanja; čuvar alata sa default deny; run_sql sa read-only ulogom; odobrenje čovjeka za send_email; obavještenje AZLP-a i kupaca.
EOF
-->
