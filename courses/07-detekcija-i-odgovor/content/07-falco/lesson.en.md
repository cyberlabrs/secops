## What this module covers

This module covers objective **4.1** from domain 4: runtime detection with **Falco**. After this module you should be able to:

- read and write a Falco rule: `rule`, `condition`, `output`, `priority`, `tags`, together with **macros** (`macro`) and **lists** (`list`);
- tune rules without touching the official file: **`override`** (`append`/`replace`), **exceptions** (`exceptions`) and `user_known_*` macros;
- test a rule against recorded events (**replay**) and validate the syntax before production;
- choose **outputs** (stdout, file, JSON, HTTP, program) and send alerts to a SIEM (Wazuh);
- map Falco rules to MITRE ATT&CK via `tags`.

In the CKS course Falco ran live as a service on a node. Here we look at it as a **detection engineer**: a rule is code, it has a test, it has exceptions with a justification and it ends up in the SIEM, just like the Sigma and Wazuh rules from the previous modules.

## Where Falco fits in the picture

Wazuh reads **logs** that someone has already written (auth.log, journald). Sigma describes detections over logs. Falco looks at something else: the **system calls** (syscalls) a process makes to the kernel, live. A process that writes nothing to a log still has to call `execve`, `openat` or `connect`.

| | Wazuh (logs) | Sigma | Falco |
|---|---|---|---|
| Source | Line-based logs, JSON, FIM, SCA | Any log (abstract) | Syscalls; plugin sources (k8saudit, CloudTrail…) |
| When it sees the event | When the application writes it | Depends on the SIEM | At the moment of the syscall |
| Container context | Limited | Depends on the log | `container.*` and `k8s.*` fields |
| Language | XML rules, regex | YAML, gets converted | YAML, filter expressions |
| Blocks? | Active response (optional) | No | No, detection only |

Falco has three parts:

- the **driver** that captures syscalls: `modern_ebpf` (the default) or `kmod`. The legacy eBPF probe and the gVisor engine were removed in 0.44;
- the **libs** that enrich the event with state (process tree, open descriptors, users, containers via the **container plugin**);
- the **rules engine** that matches every event against the rules and sends alerts to the outputs.

### Replay mode in the lab

The lab is a container without eBPF privileges, so Falco cannot watch the live kernel. Instead we use **replay**: Falco reads a `.scap` file, a syscall capture recorded earlier (e.g. with `sysdig -w` or a Falco capture). Rules and outputs work exactly as they do live; the only difference is the event source.

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

The `-o` flag overrides any key from `falco.yaml` (dot notation), and `-r` specifies a rules file and replaces `rules_files` from the configuration. It can be repeated: `-r a.yaml -r b.yaml`. Order matters: a later file can modify rules from an earlier one.

Falco writes its startup messages to stderr and alerts to stdout. That makes processing convenient:

```bash
falco -o engine.kind=replay -o engine.replay.capture_file=$T/run-shell-untrusted.scap \
      -o json_output=true -r /etc/falco/falco_rules.yaml 2>/dev/null | grep '^{' > /root/alarmi.json
jq -r '[.time, .priority, .rule] | @tsv' /root/alarmi.json
```

> **In practice:** replay is the best way to test a rule. You keep a capture of the attack (or of legitimate work that produces false positives) next to the rule in the repo, and CI runs Falco against the captures and checks that the rule fires where it should and stays silent where it shouldn't. This is the "detection as code" from module 06, just for runtime.

## Anatomy of a rules file

A rules file is a YAML list of elements. Each element is one of: `rule`, `macro`, `list`, or a version requirement (`required_engine_version`, `required_plugin_versions`).

```yaml
- required_engine_version: 0.50.0

- list: kurs_web_binaries
  items: [nginx, httpd, apache2, php-fpm, node, gunicorn]

- macro: kurs_web_parent
  condition: (proc.pname in (kurs_web_binaries))

- rule: Shell spawned by web server
  desc: >
    A web server or application process spawned a shell. A typical trace
    of an RCE vulnerability or a web shell (T1505.003, T1059.004).
  condition: >
    spawned_process
    and shell_procs
    and kurs_web_parent
  output: >
    Shell from web process | user=%user.name parent=%proc.pname
    cmd=%proc.cmdline exe=%proc.exepath container=%container.id
    image=%container.image.repository
  priority: WARNING
  tags: [kurs, host, container, process, mitre_execution, T1059.004, mitre_persistence, T1505.003]
```

Rule keys:

| Key | Required | Meaning |
|---|---|---|
| `rule` | yes | Unique name; it is used to modify and disable the rule |
| `desc` | yes | What the rule catches and why; you write it for the analyst at 3 a.m. |
| `condition` | yes | Filter expression over event fields |
| `output` | yes | Alert message with `%field` substitutions |
| `priority` | yes | `EMERGENCY`, `ALERT`, `CRITICAL`, `ERROR`, `WARNING`, `NOTICE`, `INFORMATIONAL`, `DEBUG` |
| `tags` | no | Free-form labels; official rules carry maturity (`maturity_stable`), type and MITRE |
| `exceptions` | no | Structured exceptions (see below) |
| `enabled` | no | `false` means the rule is not loaded |
| `source` | no | Event source; `syscall` by default, for a plugin e.g. `k8s_audit` |

A **macro** is a named piece of a condition that is reused across multiple rules (`spawned_process`, `open_read`, `container`). A **list** is a named array of values used with `in`. The official `falco_rules.yaml` defines dozens of them:

```yaml
# from /etc/falco/falco_rules.yaml (abridged)
- macro: spawned_process
  condition: (evt.type in (execve, execveat))

- list: shell_binaries
  items: [ash, bash, csh, ksh, sh, tcsh, zsh, dash]

- macro: shell_procs
  condition: (proc.name in (shell_binaries))

- macro: container
  condition: (container.id != host)
```

Macros and lists must be defined **before** the rule that uses them (in the same file or in a file loaded earlier). That is why your rules go into a file that is loaded after `falco_rules.yaml`.

### Fields and operators

The fields you will use most often:

| Class | Fields | Example |
|---|---|---|
| `evt.*` | `evt.type`, `evt.time`, `evt.res`, `evt.is_open_write` | `evt.type in (openat, openat2)` |
| `proc.*` | `proc.name`, `proc.exepath`, `proc.cmdline`, `proc.args`, `proc.pname`, `proc.aname[2]`, `proc.tty`, `proc.pid` | `proc.pname = nginx` |
| `user.*` | `user.name`, `user.uid`, `user.loginuid` | `user.uid = 0` |
| `fd.*` | `fd.name`, `fd.directory`, `fd.filename`, `fd.typechar`, `fd.sip`, `fd.sport` | `fd.directory = /etc/sudoers.d` |
| `container.*` | `container.id`, `container.name`, `container.image.repository`, `container.privileged` | `container.privileged = true` |
| `k8s.*` | `k8s.ns.name`, `k8s.pod.name` | `k8s.ns.name = kube-system` |

`proc.aname[N]` is the ancestor N levels up (`[1]` is the parent), which is useful for a chain like `nginx → sh → curl`. `user.loginuid` stays the same even after `sudo`, so it shows who originally logged in.

Operators: `=`, `!=`, `<`, `>`, `in`, `contains`, `icontains`, `startswith`, `endswith`, `glob`, `pmatch` (path prefix from a list), `exists`, `intersects`, together with `and`, `or`, `not` and parentheses.

```bash
falco --list=syscall | grep -E '^proc\.(aname|exepath|vpgid)'   # field descriptions
falco -L | head -40                                            # names and descriptions of loaded rules
falco -l "Read sensitive file untrusted"                       # a single rule
```

> **In practice:** put `evt.type` first in the condition (or a macro that contains it, e.g. `spawned_process`, `open_read`). Falco uses the event type to decide which rules need to be evaluated at all. A rule without `evt.type` is evaluated for every syscall and slows down the whole engine; Falco warns about this at load time (`warn_evttypes`).

## Writing and testing your own rule

Example: we want an alert when anyone other than the user management tools **writes** to `/etc/passwd`, `/etc/shadow` or `/etc/sudoers.d/`. That is a persistence trace (T1136.001 local account, T1548.003 sudo).

```bash
mkdir -p /root/falco
cat > /root/falco/kurs_rules.yaml <<'EOF'
- list: kurs_identity_files
  items: [/etc/passwd, /etc/shadow, /etc/group, /etc/gshadow]

- list: kurs_identity_writers
  items: [useradd, usermod, userdel, groupadd, chpasswd, passwd, vipw, chage]

- macro: kurs_identity_target
  condition: (fd.name in (kurs_identity_files) or fd.directory = /etc/sudoers.d)

- rule: Write to identity files
  desc: >
    A process that is not a standard user management tool writes to passwd/shadow/group
    or sudoers.d. Possible addition of an account or sudo rights outside of procedure.
  condition: >
    open_write
    and kurs_identity_target
    and proc_name_exists
    and not proc.name in (kurs_identity_writers)
    and not proc.name in (package_mgmt_binaries)
  output: >
    Write to identity file | file=%fd.name proc=%proc.name exe=%proc.exepath
    parent=%proc.pname gparent=%proc.aname[2] cmd=%proc.cmdline
    user=%user.name loginuid=%user.loginuid container=%container.id
  priority: ERROR
  tags: [kurs, host, container, filesystem, mitre_persistence, T1136.001, mitre_privilege_escalation, T1548.003]
EOF
```

Validate the syntax before running it. `-V` loads the files in the order you give them and reports unknown macros, fields and keys:

```bash
falco -V /etc/falco/falco_rules.yaml -V /root/falco/kurs_rules.yaml
# for each file: "<file>: Ok", or an error with a description and the location in the YAML
```

Typical validation errors:

| Error | Cause |
|---|---|
| Undefined macro or list (`open_write`) | You loaded only your own file, without `falco_rules.yaml` before it |
| Unknown field (`proc.parent`) | Wrong field name (should be `proc.pname`); check with `falco --list` |
| Unknown key (`priorty`) | Typo in a key; since 0.44 Falco also validates unknown keys |
| Missing required key | The rule lacks `output`, `desc` or `priority` |
| YAML error | A colon or `%` at the start of an unquoted string; use a `>` block or quotes |

Then run it against the captures. A positive capture must produce an alert, a negative one must not:

```bash
for t in write-etc user-mgmt-binaries run-shell-untrusted; do
  echo "== $t"
  falco -o engine.kind=replay -o engine.replay.capture_file=$T/$t.scap \
        -o json_output=true \
        -r /etc/falco/falco_rules.yaml -r /root/falco/kurs_rules.yaml 2>/dev/null \
    | grep '^{' | jq -r '[.priority, .rule, .output_fields["proc.name"], .output_fields["fd.name"]] | @tsv'
done
```

If there is no alert where you expect one, narrow the problem down with a rule that catches all relevant events and look at what the capture actually contains:

```bash
cat > /tmp/debug.yaml <<'EOF'
- rule: debug everything opened for writing
  desc: temporary, only for investigating the capture
  condition: evt.type in (open, openat, openat2) and evt.is_open_write=true
  output: "%proc.name %proc.pname %fd.name %user.name"
  priority: DEBUG
EOF
falco -o engine.kind=replay -o engine.replay.capture_file=$T/write-etc.scap \
      -o priority=debug -r /tmp/debug.yaml 2>/dev/null | head -30
```

Common reasons: the rule filters out the process that is actually in the capture (`not proc.name in (...)`), the path in the capture is not what you think (a temporary `/etc/passwd+` file followed by a `rename`), or the `priority` in `falco.yaml` is higher than the rule's priority. The default `priority: debug` in `falco.yaml` lets everything through, but production installations often raise it.

> **In practice:** tools like `useradd` do not write directly to `/etc/passwd`, but to a temporary file which they then rename. A rule that only looks at `open_write` on `/etc/passwd` misses both legitimate and malicious changes made that way. So check the rule against a capture of real activity, not just against theory; if needed, add `evt.type in (rename, renameat, renameat2)` with `fd.name` or the event arguments.

## Tuning: override, exceptions, user_known macros

The official `falco_rules.yaml` changes with every rules release. If you edit it directly, the next update wipes out your changes. The rule is: **never modify** `falco_rules.yaml`. Changes go into `falco_rules.local.yaml` or `rules.d/`, which are loaded afterwards.

### override

The `override` block says what you are doing with a key of a rule, macro or list: `append` (add to the end) or `replace`.

```yaml
# /etc/falco/rules.d/50-kurs-tuning.yaml

# 1) add binaries to a list
- list: user_known_shell_spawn_binaries
  items: [kurs-healthcheck]
  override:
    items: append

# 2) raise the priority and extend the output of an existing rule
- rule: Run shell untrusted
  priority: CRITICAL
  output: Shell under a non-shell process (kurs) | cmd=%proc.cmdline parent=%proc.pname exe=%proc.exepath image=%container.image.repository
  override:
    priority: replace
    output: replace

# 3) disable a rule that makes no sense in this environment
- rule: Contact K8S API Server From Container
  enabled: false
  override:
    enabled: replace
```

What is allowed:

| Element | `append` | `replace` |
|---|---|---|
| `list` | `items` | `items` |
| `macro` | `condition` | `condition` |
| `rule` | `condition`, `output`, `desc`, `tags`, `exceptions` | additionally `priority`, `enabled`, `warn_evttypes`, `skip-if-unknown-filter` |

The same key cannot be both `append` and `replace` at the same time. The old `append: true` key is deprecated and will be removed in Falco 1.0. Disabling a rule with just `enabled: false` (without `override`) produces a warning.

Rules can also be disabled in `falco.yaml`, by name or tag, without touching the rules files:

```yaml
rules:
  - disable:
      tag: maturity_incubating
  - enable:
      rule: Write to identity files
```

### exceptions

**Exceptions** are a structured way to say "this process on this path is fine". Falco turns them into an `and not (...)` addition to the condition. The advantage over a hand-written `and not ...` is readability and the fact that values can be added later without rewriting the condition.

```yaml
- rule: Write to identity files
  desc: ...
  condition: open_write and kurs_identity_target and proc_name_exists
  output: ...
  priority: ERROR
  exceptions:
    - name: tool_and_file
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

Rules for exceptions:

- `fields` are the fields, `comps` the operators (one per field; if omitted, `=` is assumed), and `values` are tuples in the same order.
- Each tuple becomes `(field1 op value1 and field2 op value2)`, and all tuples are joined with `or` inside a single `not (...)`.
- An exception can be defined without `values`; you add the values later in a local file.

Adding values to an existing exception, from another file:

```yaml
- rule: Write to identity files
  exceptions:
    - name: tool_and_file
      values:
        - [kurs-ldap-sync, /etc/group]
  override:
    exceptions: append
```

### user_known macros

An older but still widespread technique: the official rules contain empty "hooks" such as `user_known_read_sensitive_files_activities`, which are `(never_true)` by default. You overwrite them with your own condition:

```yaml
- macro: user_known_read_sensitive_files_activities
  condition: (proc.name = kurs-backup and proc.pname = cron)
  override:
    condition: replace
```

| Technique | When |
|---|---|
| `exceptions` + `override: exceptions: append` | Your own rules and official rules that already have exceptions; the most readable |
| `user_known_*` macro (`replace`) | Official rules that offer such a hook |
| `override: condition: append` with `and not ...` | When none of the above exists |
| A copy of the rule under the same name | Avoid: it cuts you off from future fixes to the rule |

> **In practice:** every exception is a hole an attacker can exploit. An exception on `proc.name` is weak because an attacker can name their binary `kurs-backup`. Combine several fields (`proc.exepath` instead of `proc.name`, the parent, the container image, the namespace) and with every exception write a comment with the ticket, the date and who approved it, just like `.gitleaksignore` in the DevSecOps course.

## Outputs

A rule's `output` determines the text, and `falco.yaml` determines **where** the alert goes and in what format. Several outputs can be enabled at the same time.

| Key in `falco.yaml` | What it does |
|---|---|
| `json_output: true` | Alert as a JSON object instead of text |
| `json_include_tags_property` | Adds `tags` to the JSON (`true` by default) |
| `stdout_output.enabled` | Standard output (journald when running as a service) |
| `syslog_output.enabled` | Local syslog |
| `file_output` (`enabled`, `filename`, `keep_alive`) | File; `keep_alive: true` keeps the file open |
| `http_output` (`enabled`, `url`) | POST to a webhook; typically **Falcosidekick** |
| `program_output` (`enabled`, `program`) | Pipes the alert to a program's stdin |
| `priority` | Minimum priority that gets sent at all |
| `rule_matching` | `first` (default, the first matching rule) or `all` |
| `append_output` | Appends text or fields to the output of all (or selected) rules |

A JSON alert looks like this (abridged, formatted):

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

`time` is the time of the event from the capture, not the time of the replay. This matters for an investigation: replaying an old capture gives an accurate timeline.

For persistent storage in the lab:

```bash
falco -o engine.kind=replay -o engine.replay.capture_file=$T/falco-event-generator.scap \
      -o json_output=true -o stdout_output.enabled=false \
      -o file_output.enabled=true -o file_output.filename=/var/log/falco-events.json \
      -r /etc/falco/falco_rules.yaml -r /root/falco/kurs_rules.yaml 2>/dev/null

# overview by rule and priority
jq -r '[.priority, .rule] | @tsv' /var/log/falco-events.json | sort | uniq -c | sort -rn
# only ATT&CK techniques from the tags
jq -r '.tags[]? | select(test("^T[0-9]{4}"))' /var/log/falco-events.json | sort | uniq -c
```

### Falco alerts in Wazuh

The Wazuh manager can read the JSON file that Falco writes. Add a `localfile` to `/var/ossec/etc/ossec.conf`:

```xml
<localfile>
  <log_format>json</log_format>
  <location>/var/log/falco-events.json</location>
</localfile>
```

The Wazuh JSON decoder unpacks the fields by itself, so a custom rule in `local_rules.xml` can filter on them:

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
    <description>Falco high priority: $(rule)</description>
    <mitre>
      <id>T1059</id>
    </mitre>
  </rule>
</group>
```

Test with `/var/ossec/bin/wazuh-logtest`: paste one JSON line from `falco-events.json` and check which rule fires. After a change, restart the manager (`/var/ossec/bin/wazuh-control restart`).

In production the more common path is **Falcosidekick**: Falco sends `http_output` to Sidekick, which forwards to Slack, Elasticsearch, Loki, Splunk, SQS or Kafka. In the Microsoft world (SC-200) the equivalent is Defender for Containers alerts, which end up in Sentinel as `SecurityAlert` records.

> **In practice:** don't send everything to the pager. `NOTICE` and below go to the SIEM for correlation and investigation, `WARNING` to the triage queue, and `ERROR` and above to the on-call engineer. When a rule crosses some false-positive threshold, don't just lower its priority: tune the exceptions, otherwise the team will learn to ignore it.

## Plugin sources and ATT&CK

Falco is not limited to syscalls. **Plugins** add event sources with their own fields:

| Plugin | `source` | Example fields |
|---|---|---|
| `k8saudit` | `k8s_audit` | `ka.verb`, `ka.user.name`, `ka.target.resource` |
| `cloudtrail` | `aws_cloudtrail` | `ct.name`, `ct.user`, `ct.srcip` |
| `container` | (enriches syscalls) | `container.*`, `k8s.pod.name` |

A rule for a plugin source must have `source:` and may use only that source's fields. For CloudTrail and Kubernetes audit, this course uses Sigma rules and jq (modules 02 and 06); Falco plugins are an alternative when Falco is already running in the cluster.

Official rules carry ATT&CK in `tags`: the tactic (`mitre_execution`, `mitre_credential_access`) and the technique (`T1059`, `T1555`). Have your rules follow the same pattern, because then:

- you can generate an ATT&CK Navigator layer (module 05) from the tags of all rules (`falco -L` with `json_output=true` prints the rules as JSON);
- in the SIEM you filter by technique regardless of whether the alert came from Falco, Wazuh or Sigma.

Examples of mapping official rules:

| Rule | Technique | What the trace is |
|---|---|---|
| `Run shell untrusted` | T1059.004 | `execve` of a shell whose parent is not a shell (web server, database) |
| `Terminal shell in container` | T1059 | Shell with a TTY in a container (`kubectl exec -it`) |
| `Read sensitive file untrusted` | T1555 | `openat` for reading `/etc/shadow`, `/etc/sudoers` |
| `Find AWS Credentials` | T1552 | `grep`/`find` over `.aws/credentials` |
| `Clear Log Activities` | T1070 | Truncating files in `/var/log` |
| `Drop and execute new binary in container` | TA0003 (tactic) | Executed binary that is not from the image (upper layer) |
| `Execution from /dev/shm` | T1059.004 | `execve` from an in-memory file system |

## Troubleshooting

| Symptom | Check |
|---|---|
| Replay produces no alerts | Is the rules file actually loaded (`-r`)? The `priority` in the configuration? Run a debug rule against the capture |
| `Undefined macro` | The file with the macro was not loaded before yours; order of `-r` or `rules_files` |
| The rule fires too often | `falco ... | jq -r '.output_fields["proc.name"]' | sort | uniq -c` shows who is making the noise; an exception on several fields |
| `container.id` is `host` | The event is on the host, not in a container; or the container plugin is not loaded |
| A field is shown as `<NA>` | The information is missing from the capture or the event (e.g. the process name for dropped events) |
| Warning about `evt.type` | The condition does not restrict the event type; add `spawned_process`, `open_read` or `evt.type in (...)` |

## Summary

- Falco watches **syscalls** (and plugin sources) and sends alerts; it does not block. In the lab it runs in **replay** mode: `-o engine.kind=replay -o engine.replay.capture_file=<file>`.
- A rules file consists of `list`, `macro` and `rule`; a rule has the required `rule`, `desc`, `condition`, `output`, `priority`. Start the condition with `evt.type` or a macro that contains it.
- Validate with `falco -V`, test against positive and negative captures and keep the captures next to the rule (detection as code).
- The official `falco_rules.yaml` is never modified; changes go into local files via `override` (`append`/`replace`), `exceptions` or `user_known_*` macros. `append: true` is deprecated.
- Build exceptions on several fields (`proc.exepath`, the parent, the image), not just on `proc.name`, and document the reason.
- Outputs: `json_output`, `file_output`, `http_output` (Falcosidekick), `program_output`; the minimum level is set by `priority`. A JSON alert has `rule`, `priority`, `time`, `output_fields`, `tags`.
- Put the ATT&CK mapping in `tags` (`mitre_<tactic>`, `T<ID>`) so that coverage and SIEM filtering work the same way as for Wazuh and Sigma rules.
