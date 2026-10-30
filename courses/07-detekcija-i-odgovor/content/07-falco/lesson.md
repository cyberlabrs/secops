## Šta ovaj modul pokriva

Modul pokriva cilj **4.1** iz domena 4: runtime detekcija sa **Falcom**. Poslije modula znaš da:

- pročitaš i napišeš Falco pravilo: `rule`, `condition`, `output`, `priority`, `tags`, uz **makroe** (`macro`) i **liste** (`list`);
- pravila podešavaš bez diranja zvaničnog fajla: **`override`** (`append`/`replace`), **izuzeci** (`exceptions`) i `user_known_*` makroi;
- pravilo testiraš nad snimljenim događajima (**replay**) i validiraš sintaksu prije produkcije;
- biraš **izlaze** (stdout, fajl, JSON, HTTP, program) i šalješ alarme u SIEM (Wazuh);
- mapiraš Falco pravila na MITRE ATT&CK preko `tags`.

U CKS kursu Falco je radio uživo kao servis na čvoru. Ovdje ga gledamo kao **detection engineer**: pravilo je kod, ima test, ima izuzetke sa razlogom i završava u SIEM-u, isto kao Sigma i Wazuh pravila iz prethodnih modula.

## Gdje je Falco u slici

Wazuh čita **logove** koje je neko već napisao (auth.log, journald). Sigma opisuje detekcije nad logovima. Falco gleda nešto drugo: **sistemske pozive** (syscalls) koje proces upućuje kernelu, uživo. Proces koji ne piše ništa u log i dalje mora da pozove `execve`, `openat` ili `connect`.

| | Wazuh (logovi) | Sigma | Falco |
|---|---|---|---|
| Izvor | Linijski logovi, JSON, FIM, SCA | Bilo koji log (apstraktno) | Syscalli; plugin izvori (k8saudit, CloudTrail…) |
| Kada vidi događaj | Kad ga aplikacija zapiše | Zavisi od SIEM-a | U trenutku syscalla |
| Kontekst kontejnera | Ograničen | Zavisi od loga | `container.*` i `k8s.*` polja |
| Jezik | XML pravila, regex | YAML, konvertuje se | YAML, filter izrazi |
| Blokira? | Active response (opciono) | Ne | Ne, samo detektuje |

Falco ima tri dijela:

- **driver** koji hvata syscalle: `modern_ebpf` (podrazumijevan) ili `kmod`. Stari eBPF probe i gVisor engine uklonjeni su u 0.44;
- **libs** koje obogaćuju događaj stanjem (stablo procesa, otvoreni deskriptori, korisnici, kontejneri preko **container plugina**);
- **rules engine** koji svaki događaj poredi sa pravilima i šalje alarm na izlaze.

### Replay mod u labu

Lab je kontejner bez privilegija za eBPF, pa Falco ne može gledati živi kernel. Umjesto toga koristimo **replay**: Falco čita `.scap` fajl, snimak syscalla napravljen ranije (npr. `sysdig -w` ili Falco capture). Pravila i izlazi rade potpuno isto kao uživo; razlika je samo izvor događaja.

```bash
ls /opt/kurs/falco-traces/
# run-shell-untrusted.scap  read-sensitive-file-untrusted.scap  write-etc.scap
# user-mgmt-binaries.scap   container-privileged.scap          falco-event-generator.scap ...

falco --version
ls /etc/falco/            # falco.yaml, falco_rules.yaml, ...

T=/opt/kurs/falco-traces
falco -o engine.kind=replay \
      -o engine.replay.capture_file=$T/read-sensitive-file-untrusted.scap \
      -r /etc/falco/falco_rules.yaml
```

Flag `-o` mijenja bilo koji ključ iz `falco.yaml` (tačkasta notacija), a `-r` zadaje fajl pravila i zamjenjuje `rules_files` iz konfiguracije. Može se ponoviti: `-r a.yaml -r b.yaml`. Redoslijed je bitan, kasniji fajl može mijenjati pravila iz ranijeg.

Startne poruke Falco piše na stderr, a alarme na stdout. Zato je za obradu zgodno:

```bash
falco -o engine.kind=replay -o engine.replay.capture_file=$T/run-shell-untrusted.scap \
      -o json_output=true -r /etc/falco/falco_rules.yaml 2>/dev/null | grep '^{' > /root/alarmi.json
jq -r '[.time, .priority, .rule] | @tsv' /root/alarmi.json
```

> **U praksi:** replay je najbolji način da testiraš pravilo. Snimak napada (ili legitimnog posla koji pravi lažne pozitive) čuvaš uz pravilo u repou, a CI pokreće Falco nad snimcima i provjerava da se pravilo okida tamo gdje treba i šuti tamo gdje ne treba. To je „detection as code“ iz modula 06, samo za runtime.

## Anatomija fajla pravila

Fajl pravila je YAML lista elemenata. Svaki element je jedno od: `rule`, `macro`, `list`, ili verzijski zahtjev (`required_engine_version`, `required_plugin_versions`).

```yaml
- required_engine_version: 0.50.0

- list: kurs_web_binaries
  items: [nginx, httpd, apache2, php-fpm, node, gunicorn]

- macro: kurs_web_parent
  condition: (proc.pname in (kurs_web_binaries))

- rule: Shell pokrenut iz web servera
  desc: >
    Web server ili aplikacioni proces pokrenuo je shell. Tipičan trag
    RCE ranjivosti ili web shella (T1505.003, T1059.004).
  condition: >
    spawned_process
    and shell_procs
    and kurs_web_parent
  output: >
    Shell iz web procesa | user=%user.name parent=%proc.pname
    cmd=%proc.cmdline exe=%proc.exepath container=%container.id
    image=%container.image.repository
  priority: WARNING
  tags: [kurs, host, container, process, mitre_execution, T1059.004, mitre_persistence, T1505.003]
```

Ključevi pravila:

| Ključ | Obavezan | Značenje |
|---|---|---|
| `rule` | da | Jedinstveno ime; po njemu se pravilo mijenja i gasi |
| `desc` | da | Šta pravilo hvata i zašto; pišeš za analitičara u 3 ujutro |
| `condition` | da | Filter izraz nad poljima događaja |
| `output` | da | Poruka alarma sa `%polje` zamjenama |
| `priority` | da | `EMERGENCY`, `ALERT`, `CRITICAL`, `ERROR`, `WARNING`, `NOTICE`, `INFORMATIONAL`, `DEBUG` |
| `tags` | ne | Slobodne oznake; zvanična pravila nose zrelost (`maturity_stable`), tip i MITRE |
| `exceptions` | ne | Strukturisani izuzeci (vidi niže) |
| `enabled` | ne | `false` znači da se pravilo ne učitava |
| `source` | ne | Izvor događaja; podrazumijevano `syscall`, za plugin npr. `k8s_audit` |

**Makro** je imenovan dio uslova, koji se koristi u više pravila (`spawned_process`, `open_read`, `container`). **Lista** je imenovan niz vrijednosti, koji se koristi uz `in`. Zvanični `falco_rules.yaml` definiše ih desetine:

```yaml
# iz /etc/falco/falco_rules.yaml (skraćeno)
- macro: spawned_process
  condition: (evt.type in (execve, execveat))

- list: shell_binaries
  items: [ash, bash, csh, ksh, sh, tcsh, zsh, dash]

- macro: shell_procs
  condition: (proc.name in (shell_binaries))

- macro: container
  condition: (container.id != host)
```

Makro i lista moraju biti definisani **prije** pravila koje ih koristi (u istom ili ranije učitanom fajlu). Tvoja pravila zato idu u fajl koji se učitava poslije `falco_rules.yaml`.

### Polja i operatori

Polja koja ćeš najčešće koristiti:

| Klasa | Polja | Primjer |
|---|---|---|
| `evt.*` | `evt.type`, `evt.time`, `evt.res`, `evt.is_open_write` | `evt.type in (openat, openat2)` |
| `proc.*` | `proc.name`, `proc.exepath`, `proc.cmdline`, `proc.args`, `proc.pname`, `proc.aname[2]`, `proc.tty`, `proc.pid` | `proc.pname = nginx` |
| `user.*` | `user.name`, `user.uid`, `user.loginuid` | `user.uid = 0` |
| `fd.*` | `fd.name`, `fd.directory`, `fd.filename`, `fd.typechar`, `fd.sip`, `fd.sport` | `fd.directory = /etc/sudoers.d` |
| `container.*` | `container.id`, `container.name`, `container.image.repository`, `container.privileged` | `container.privileged = true` |
| `k8s.*` | `k8s.ns.name`, `k8s.pod.name` | `k8s.ns.name = kube-system` |

`proc.aname[N]` je predak N nivoa iznad (`[1]` je roditelj), što je korisno za lanac `nginx → sh → curl`. `user.loginuid` ostaje isti i poslije `sudo`, pa pokazuje ko se prvobitno prijavio.

Operatori: `=`, `!=`, `<`, `>`, `in`, `contains`, `icontains`, `startswith`, `endswith`, `glob`, `pmatch` (prefiks putanje iz liste), `exists`, `intersects`, uz `and`, `or`, `not` i zagrade.

```bash
falco --list=syscall | grep -E '^proc\.(aname|exepath|vpgid)'   # opis polja
falco -L | head -40                                            # imena i opisi učitanih pravila
falco -l "Read sensitive file untrusted"                       # jedno pravilo
```

> **U praksi:** u uslovu prvo stavi `evt.type` (ili makro koji ga sadrži, npr. `spawned_process`, `open_read`). Falco po tipu događaja odlučuje koja pravila uopšte treba provjeriti. Pravilo bez `evt.type` provjerava se za svaki syscall i usporava cijeli engine; Falco na to upozorava pri učitavanju (`warn_evttypes`).

## Pisanje i testiranje vlastitog pravila

Primjer: želimo alarm kad bilo ko, osim alata za upravljanje korisnicima, **piše** u `/etc/passwd`, `/etc/shadow` ili `/etc/sudoers.d/`. To je trag perzistencije (T1136.001 lokalni nalog, T1548.003 sudo).

```bash
mkdir -p /root/falco
cat > /root/falco/kurs_rules.yaml <<'EOF'
- list: kurs_identity_files
  items: [/etc/passwd, /etc/shadow, /etc/group, /etc/gshadow]

- list: kurs_identity_writers
  items: [useradd, usermod, userdel, groupadd, chpasswd, passwd, vipw, chage]

- macro: kurs_identity_target
  condition: (fd.name in (kurs_identity_files) or fd.directory = /etc/sudoers.d)

- rule: Upis u fajlove identiteta
  desc: >
    Proces koji nije standardni alat za korisnike upisuje u passwd/shadow/group
    ili sudoers.d. Moguće dodavanje naloga ili sudo prava mimo procedure.
  condition: >
    open_write
    and kurs_identity_target
    and proc_name_exists
    and not proc.name in (kurs_identity_writers)
    and not proc.name in (package_mgmt_binaries)
  output: >
    Upis u fajl identiteta | file=%fd.name proc=%proc.name exe=%proc.exepath
    parent=%proc.pname gparent=%proc.aname[2] cmd=%proc.cmdline
    user=%user.name loginuid=%user.loginuid container=%container.id
  priority: ERROR
  tags: [kurs, host, container, filesystem, mitre_persistence, T1136.001, mitre_privilege_escalation, T1548.003]
EOF
```

Prije pokretanja validiraj sintaksu. `-V` učitava fajlove onim redom kojim ih zadaš i prijavljuje nepoznate makroe, polja i ključeve:

```bash
falco -V /etc/falco/falco_rules.yaml -V /root/falco/kurs_rules.yaml
# za svaki fajl: "<fajl>: Ok", ili greška sa opisom i lokacijom u YAML-u
```

Tipične greške pri validaciji:

| Greška | Uzrok |
|---|---|
| Nedefinisan makro ili lista (`open_write`) | Učitao si samo svoj fajl, bez `falco_rules.yaml` prije njega |
| Nepoznato polje (`proc.parent`) | Pogrešno ime polja (treba `proc.pname`); provjeri sa `falco --list` |
| Nepoznat ključ (`priorty`) | Tipfeler u ključu; od 0.44 Falco validira i nepoznate ključeve |
| Nedostaje obavezan ključ | Pravilu fali `output`, `desc` ili `priority` |
| YAML greška | Dvotačka ili `%` na početku neobuhvaćenog stringa; koristi `>` blok ili navodnike |

Onda pokreni nad snimcima. Pozitivan snimak mora dati alarm, negativan ne smije:

```bash
for t in write-etc user-mgmt-binaries run-shell-untrusted; do
  echo "== $t"
  falco -o engine.kind=replay -o engine.replay.capture_file=$T/$t.scap \
        -o json_output=true \
        -r /etc/falco/falco_rules.yaml -r /root/falco/kurs_rules.yaml 2>/dev/null \
    | grep '^{' | jq -r '[.priority, .rule, .output_fields["proc.name"], .output_fields["fd.name"]] | @tsv'
done
```

Ako alarma nema tamo gdje ga očekuješ, suzi problem pravilom koje hvata sve relevantne događaje i pogledaj šta snimak zaista sadrži:

```bash
cat > /tmp/debug.yaml <<'EOF'
- rule: debug sve otvoreno za pisanje
  desc: privremeno, samo za istragu snimka
  condition: evt.type in (open, openat, openat2) and evt.is_open_write=true
  output: "%proc.name %proc.pname %fd.name %user.name"
  priority: DEBUG
EOF
falco -o engine.kind=replay -o engine.replay.capture_file=$T/write-etc.scap \
      -o priority=debug -r /tmp/debug.yaml 2>/dev/null | head -30
```

Česti razlozi: pravilo filtrira proces koji je zapravo u snimku (`not proc.name in (...)`), putanja u snimku nije ono što misliš (`/etc/passwd+` privremeni fajl, pa `rename`), ili je `priority` u `falco.yaml` viši od prioriteta pravila. Podrazumijevani `priority: debug` u `falco.yaml` propušta sve, ali produkcijske instalacije ga često dižu.

> **U praksi:** alati poput `useradd` ne pišu direktno u `/etc/passwd`, nego u privremeni fajl koji onda preimenuju. Pravilo koje gleda samo `open_write` na `/etc/passwd` propušta i legitimne i zlonamjerne izmjene napravljene na taj način. Zato provjeri pravilo nad snimkom stvarne aktivnosti, ne samo nad teorijom; po potrebi dodaj `evt.type in (rename, renameat, renameat2)` sa `fd.name` ili argumentima događaja.

## Podešavanje: override, izuzeci, user_known makroi

Zvanični `falco_rules.yaml` se mijenja sa svakim izdanjem pravila. Ako ga uređuješ direktno, sljedeći update briše tvoje izmjene. Pravilo je: **nikad ne mijenjaj** `falco_rules.yaml`. Izmjene idu u `falco_rules.local.yaml` ili `rules.d/`, koji se učitavaju poslije.

### override

Blok `override` kaže šta radiš sa ključem pravila, makroa ili liste: `append` (dodaj na kraj) ili `replace` (zamijeni).

```yaml
# /etc/falco/rules.d/50-kurs-tuning.yaml

# 1) dodaj binarne fajlove u listu
- list: user_known_shell_spawn_binaries
  items: [kurs-healthcheck]
  override:
    items: append

# 2) pojačaj prioritet i proširi output postojećeg pravila
- rule: Run shell untrusted
  priority: CRITICAL
  output: Shell ispod ne-shell procesa (kurs) | cmd=%proc.cmdline parent=%proc.pname exe=%proc.exepath image=%container.image.repository
  override:
    priority: replace
    output: replace

# 3) ugasi pravilo koje u ovom okruženju nema smisla
- rule: Contact K8S API Server From Container
  enabled: false
  override:
    enabled: replace
```

Šta se smije:

| Element | `append` | `replace` |
|---|---|---|
| `list` | `items` | `items` |
| `macro` | `condition` | `condition` |
| `rule` | `condition`, `output`, `desc`, `tags`, `exceptions` | uz to i `priority`, `enabled`, `warn_evttypes`, `skip-if-unknown-filter` |

Isti ključ ne može istovremeno biti `append` i `replace`. Stari ključ `append: true` je zastario i biće uklonjen u Falco 1.0. Gašenje pravila sa samim `enabled: false` (bez `override`) daje upozorenje.

Pravila se mogu gasiti i u `falco.yaml`, po imenu ili tagu, bez diranja fajlova pravila:

```yaml
rules:
  - disable:
      tag: maturity_incubating
  - enable:
      rule: Upis u fajlove identiteta
```

### exceptions

**Izuzeci** su strukturisan način da kažeš „ovaj proces na ovoj putanji je u redu“. Falco od njih napravi `and not (...)` dodatak uslovu. Prednost nad ručnim `and not ...` je čitljivost i to što se vrijednosti mogu dodavati kasnije, bez prepisivanja uslova.

```yaml
- rule: Upis u fajlove identiteta
  desc: ...
  condition: open_write and kurs_identity_target and proc_name_exists
  output: ...
  priority: ERROR
  exceptions:
    - name: alat_i_fajl
      fields: [proc.name, fd.name]
      comps: [=, =]
      values:
        - [useradd, /etc/passwd]
        - [chpasswd, /etc/shadow]
    - name: config_mgmt
      fields: [proc.exepath, fd.directory]
      comps: [startswith, =]
      values:
        - [/opt/puppetlabs/, /etc/sudoers.d]
```

Pravila za izuzetke:

- `fields` su polja, `comps` operatori (po jedan za svako polje, ako se izostave, podrazumijeva se `=`), a `values` su torke u istom redoslijedu.
- Svaka torka postaje `(polje1 op vrijednost1 and polje2 op vrijednost2)`, a sve torke se spajaju sa `or` unutar jednog `not (...)`.
- Izuzetak može biti definisan bez `values`; vrijednosti dodaješ kasnije u lokalnom fajlu.

Dodavanje vrijednosti postojećem izuzetku, iz drugog fajla:

```yaml
- rule: Upis u fajlove identiteta
  exceptions:
    - name: alat_i_fajl
      values:
        - [kurs-ldap-sync, /etc/group]
  override:
    exceptions: append
```

### user_known makroi

Starija, ali i dalje raširena tehnika: zvanična pravila sadrže prazne „kuke“ poput `user_known_read_sensitive_files_activities`, koje su po defaultu `(never_true)`. Ti ih prepišeš svojim uslovom:

```yaml
- macro: user_known_read_sensitive_files_activities
  condition: (proc.name = kurs-backup and proc.pname = cron)
  override:
    condition: replace
```

| Tehnika | Kada |
|---|---|
| `exceptions` + `override: exceptions: append` | Tvoja pravila i zvanična pravila koja već imaju izuzetke; najčitljivije |
| `user_known_*` makro (`replace`) | Zvanična pravila koja nude takvu kuku |
| `override: condition: append` sa `and not ...` | Kad ništa od navedenog ne postoji |
| Kopija pravila pod istim imenom | Izbjegavaj: odvaja te od budućih ispravki pravila |

> **U praksi:** svaki izuzetak je rupa koju napadač može iskoristiti. Izuzetak po `proc.name` je slab jer napadač može nazvati svoj binarni fajl `kurs-backup`. Kombinuj više polja (`proc.exepath` umjesto `proc.name`, roditelj, slika kontejnera, namespace) i uz svaki izuzetak u komentaru napiši tiket, datum i ko ga je odobrio, isto kao `.gitleaksignore` u DevSecOps kursu.

## Izlazi (outputs)

`output` pravila određuje tekst, a `falco.yaml` određuje **kuda** alarm ide i u kom formatu. Više izlaza može biti uključeno istovremeno.

| Ključ u `falco.yaml` | Šta radi |
|---|---|
| `json_output: true` | Alarm kao JSON objekat umjesto teksta |
| `json_include_tags_property` | Dodaje `tags` u JSON (podrazumijevano `true`) |
| `stdout_output.enabled` | Standardni izlaz (journald kad je servis) |
| `syslog_output.enabled` | Lokalni syslog |
| `file_output` (`enabled`, `filename`, `keep_alive`) | Fajl; `keep_alive: true` drži fajl otvorenim |
| `http_output` (`enabled`, `url`) | POST na webhook; tipično **Falcosidekick** |
| `program_output` (`enabled`, `program`) | Prosljeđuje alarm na stdin programa |
| `priority` | Minimalni prioritet koji se uopšte šalje |
| `rule_matching` | `first` (podrazumijevano, prvo poklopljeno pravilo) ili `all` |
| `append_output` | Dodaje tekst ili polja na output svih (ili odabranih) pravila |

JSON alarm izgleda ovako (skraćeno, formatirano):

```json
{
  "hostname": "lab",
  "priority": "Warning",
  "rule": "Read sensitive file untrusted",
  "source": "syscall",
  "time": "2026-10-14T08:21:17.402113560Z",
  "output": "08:21:17.402113560: Warning Sensitive file opened for reading by non-trusted program | file=/etc/shadow ...",
  "output_fields": {
    "fd.name": "/etc/shadow",
    "proc.name": "cat",
    "proc.pname": "bash",
    "user.name": "root",
    "user.loginuid": 1000
  },
  "tags": ["T1555", "container", "filesystem", "host", "maturity_stable", "mitre_credential_access"]
}
```

`time` je vrijeme događaja iz snimka, ne vrijeme replaya. To je bitno za istragu: replay starog snimka daje tačnu vremensku liniju.

Za trajno čuvanje u labu:

```bash
falco -o engine.kind=replay -o engine.replay.capture_file=$T/falco-event-generator.scap \
      -o json_output=true -o stdout_output.enabled=false \
      -o file_output.enabled=true -o file_output.filename=/var/log/falco-events.json \
      -r /etc/falco/falco_rules.yaml -r /root/falco/kurs_rules.yaml 2>/dev/null

# pregled po pravilu i prioritetu
jq -r '[.priority, .rule] | @tsv' /var/log/falco-events.json | sort | uniq -c | sort -rn
# samo ATT&CK tehnike iz tagova
jq -r '.tags[]? | select(test("^T[0-9]{4}"))' /var/log/falco-events.json | sort | uniq -c
```

### Falco alarmi u Wazuhu

Wazuh manager može čitati JSON fajl koji Falco piše. Dodaj `localfile` u `/var/ossec/etc/ossec.conf`:

```xml
<localfile>
  <log_format>json</log_format>
  <location>/var/log/falco-events.json</location>
</localfile>
```

Wazuh JSON dekoder sam raspakuje polja, pa vlastito pravilo u `local_rules.xml` može filtrirati po njima:

```xml
<group name="falco,">
  <rule id="100200" level="5">
    <decoded_as>json</decoded_as>
    <field name="source">^syscall$</field>
    <field name="rule">\.+</field>
    <description>Falco: $(rule)</description>
  </rule>

  <rule id="100201" level="12">
    <if_sid>100200</if_sid>
    <field name="priority">^Critical$|^Error$</field>
    <description>Falco visok prioritet: $(rule)</description>
    <mitre>
      <id>T1059</id>
    </mitre>
  </rule>
</group>
```

Testiraj sa `/var/ossec/bin/wazuh-logtest`, nalijepi jednu JSON liniju iz `falco-events.json` i provjeri koje se pravilo okida. Poslije izmjene restartuj manager (`/var/ossec/bin/wazuh-control restart`).

U produkciji je češći put **Falcosidekick**: Falco šalje `http_output` na Sidekick, a on prosljeđuje u Slack, Elasticsearch, Loki, Splunk, SQS ili Kafka. U Microsoft svijetu (SC-200) ekvivalent su Defender for Containers alarmi, koji završavaju u Sentinelu kao `SecurityAlert` zapisi.

> **U praksi:** ne šalji sve na pager. `NOTICE` i niže idu u SIEM za korelaciju i istragu, `WARNING` u red za trijažu, a `ERROR` i više na dežurnog. Kad pravilo pređe neki prag lažnih pozitiva, ne spuštaj ga samo na niži prioritet: podesi izuzetke, inače će ga tim naučiti da ignoriše.

## Plugin izvori i ATT&CK

Falco nije ograničen na syscalle. **Pluginovi** dodaju izvore događaja sa svojim poljima:

| Plugin | `source` | Primjer polja |
|---|---|---|
| `k8saudit` | `k8s_audit` | `ka.verb`, `ka.user.name`, `ka.target.resource` |
| `cloudtrail` | `aws_cloudtrail` | `ct.name`, `ct.user`, `ct.srcip` |
| `container` | (obogaćuje syscall) | `container.*`, `k8s.pod.name` |

Pravilo za plugin izvor mora imati `source:` i koristi samo polja tog izvora. Za CloudTrail i Kubernetes audit u ovom kursu koristimo Sigma pravila i jq (moduli 02 i 06); Falco pluginovi su alternativa kad Falco već radi u klasteru.

Zvanična pravila nose ATT&CK u `tags`: taktiku (`mitre_execution`, `mitre_credential_access`) i tehniku (`T1059`, `T1555`). Tvoja pravila neka prate isti obrazac, jer onda:

- ATT&CK Navigator sloj (modul 05) možeš generisati iz tagova svih pravila (`falco -L` uz `json_output=true` ispisuje pravila u JSON-u);
- u SIEM-u filtriraš po tehnici bez obzira na to da li je alarm došao iz Falca, Wazuha ili Sigme.

Primjeri mapiranja zvaničnih pravila:

| Pravilo | Tehnika | Šta je trag |
|---|---|---|
| `Run shell untrusted` | T1059.004 | `execve` shella čiji roditelj nije shell (web server, baza) |
| `Terminal shell in container` | T1059 | Shell sa TTY-jem u kontejneru (`kubectl exec -it`) |
| `Read sensitive file untrusted` | T1555 | `openat` za čitanje `/etc/shadow`, `/etc/sudoers` |
| `Find AWS Credentials` | T1552 | `grep`/`find` nad `.aws/credentials` |
| `Clear Log Activities` | T1070 | Skraćivanje fajlova u `/var/log` |
| `Drop and execute new binary in container` | TA0003 (taktika) | Izvršen binarni fajl koji nije iz slike (upper layer) |
| `Execution from /dev/shm` | T1059.004 | `execve` iz memorijskog fajl sistema |

## Troubleshooting

| Simptom | Provjera |
|---|---|
| Replay ne daje nijedan alarm | Je li fajl pravila zaista učitan (`-r`)? `priority` u konfiguraciji? Pokreni debug pravilo nad snimkom |
| `Undefined macro` | Fajl sa makroom nije učitan prije tvog; redoslijed `-r` ili `rules_files` |
| Pravilo se okida previše | `falco ... | jq -r '.output_fields["proc.name"]' | sort | uniq -c` pokaže ko pravi šum; izuzetak sa više polja |
| `container.id` je `host` | Događaj je na hostu, ne u kontejneru; ili container plugin nije učitan |
| Polje prikazano kao `<NA>` | Informacija nedostaje u snimku ili događaju (npr. ime procesa kod izgubljenih događaja) |
| Upozorenje o `evt.type` | Uslov ne ograničava tip događaja; dodaj `spawned_process`, `open_read` ili `evt.type in (...)` |

## Rezime

- Falco gleda **syscalle** (i plugin izvore) i šalje alarme; ne blokira. U labu radi u **replay** modu: `-o engine.kind=replay -o engine.replay.capture_file=<fajl>`.
- Fajl pravila čine `list`, `macro` i `rule`; pravilo ima obavezne `rule`, `desc`, `condition`, `output`, `priority`. Uslov počni sa `evt.type` ili makroom koji ga sadrži.
- Validiraj sa `falco -V`, testiraj nad pozitivnim i negativnim snimcima i čuvaj snimke uz pravilo (detection as code).
- Zvanični `falco_rules.yaml` se ne mijenja; izmjene idu u lokalne fajlove kroz `override` (`append`/`replace`), `exceptions` ili `user_known_*` makroe. `append: true` je zastario.
- Izuzetke gradi na više polja (`proc.exepath`, roditelj, slika), ne samo na `proc.name`, i dokumentuj razlog.
- Izlazi: `json_output`, `file_output`, `http_output` (Falcosidekick), `program_output`; minimalni nivo određuje `priority`. JSON alarm ima `rule`, `priority`, `time`, `output_fields`, `tags`.
- ATT&CK mapiranje stavi u `tags` (`mitre_<taktika>`, `T<ID>`) da bi pokrivenost i SIEM filtriranje radili isto kao za Wazuh i Sigma pravila.
