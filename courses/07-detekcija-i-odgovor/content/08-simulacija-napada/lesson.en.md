## What this module covers

The module covers two objectives from domain 5:

- **5.1** Adversary emulation: **Atomic Red Team**, **Stratus Red Team**, **MITRE Caldera**; **purple teaming**.
- **5.2** Validating detections and **gap analysis**.

After this module you will know:

- what emulation frameworks are for and how they differ;
- what a safe, agreed purple team test looks like and who does what in it;
- how a detection is validated at three levels: a unit test against a log sample, an in-environment test, and regression in CI;
- how results are turned into a coverage matrix, a list of gaps and a work plan.

The angle is **defensive**. We don't learn how to carry out a technique; we learn how to prove that our detection sees it. Concrete tests are run only in an isolated lab or with written approval from the system owner.

## Why emulation

A detection that has never seen the event it is supposed to catch is an **assumption**, not a control. Rules break silently:

- the agent stops sending logs or the format changes (a new sshd version, a different `log_format`);
- someone adds an overly broad exception;
- a ruleset update changes a rule's ID or level;
- the SIEM rule works, but the alert never reaches the triage queue.

None of these failures produces an error. You see them only when an attack goes unnoticed, or when you trigger it yourself under controlled conditions.

Terms to keep apart:

| Term | Goal | Who knows about the test |
|---|---|---|
| **Penetration test** | Find vulnerabilities and prove they are exploitable | Usually the SOC knows |
| **Red team** | Achieve an objective (e.g. data access) like a real attacker, testing both people and processes | Few people (the so-called white cell) |
| **Adversary emulation** | Replay the TTPs of a known group or scenario, mapped to ATT&CK | Depends on the agreement |
| **Adversary simulation / BAS** | Run individual techniques in an automated, repeatable way (Breach and Attack Simulation) | Mostly everyone |
| **Purple team** | Red and blue work together, technique by technique, to improve detection | Everyone, openly |

Purple team is not a separate team but a **way of working**: the offensive side executes a technique, the defense immediately looks at what it saw, and both sides fix the gaps together. The result is not a "win" but better rules and telemetry.

> **In practice:** for a small team, the most value comes from small, frequent and repeatable tests of individual techniques (the atomic approach), not from a big annual red team. A red team shows whether the organization as a whole responds; atomic tests show whether rule X still works after last week's update.

## Emulation frameworks

### Atomic Red Team

**Atomic Red Team** (Red Canary) is a library of small tests organized by ATT&CK technique. Each technique has a YAML file `atomics/T<ID>/T<ID>.yaml` with one or more tests. A test has:

| Key | Meaning for the defense |
|---|---|
| `attack_technique`, `display_name` | Which technique is being tested |
| `name`, `auto_generated_guid` | The test's name and stable GUID; you record the GUID in the report so the alert can be linked to the test |
| `supported_platforms` | `linux`, `macos`, `windows`, cloud platforms |
| `input_arguments` | Parameters with default values (e.g. an account name) |
| `dependencies` | Prerequisites and how they are checked |
| `executor.name` | `sh`, `bash`, `powershell`, `command_prompt` or `manual` |
| `executor.elevation_required` | Whether root/admin is needed |
| `executor.cleanup_command` | How the state is restored after the test |

Tests are run by the PowerShell module **Invoke-AtomicRedTeam** (it also works on Linux with PowerShell), or by Caldera through the atomic plugin, or you read them and reproduce them by hand. The tests are intentionally simple: the goal is to produce the expected telemetry, not to evade defenses.

The YAML files in `atomics/` are useful even without running them: they are a **catalog of expected telemetry** per technique. Run tests only in an isolated test environment, with approval and agreed rules (see "Rules of engagement" below); this course's lab does not include them.

For the defense, you extract three things from a test: **which technique**, **on which platform**, and **what trace it leaves** (which process, which file, which log line). For example, the T1136.001 test on Linux creates a local account with `useradd`, so the expected telemetry looks like this:

```text
Oct 14 09:12:44 lab useradd[2214]: new user: name=purple_t1136, UID=999, GID=65534, home=/home/purple_t1136, shell=/bin/bash, from=/dev/pts/0
```

And the expected detection in Wazuh: rule **5902** (`New user added to the system`, level 8, MITRE T1136).

### Stratus Red Team

**Stratus Red Team** (Datadog) is "Atomic Red Team for the cloud". A single Go binary, with techniques for AWS, Azure, GCP, Microsoft Entra ID, Kubernetes and EKS. Technique IDs follow the pattern `platform.tactic.name`, e.g. `aws.defense-evasion.cloudtrail-stop` or `aws.exfiltration.ec2-share-ebs-snapshot`.

Every technique has a **lifecycle**:

| State | What happens |
|---|---|
| **warmup** | Terraform creates the prerequisites (e.g. a trail, bucket, snapshot) |
| **detonate** | The technique itself is executed |
| **revert** | The effects of the detonation are undone, if the technique supports it |
| **cleanup** | The prerequisites are deleted; nothing remains in the account |

What matters for the defense:

- Tests are run in a **separate, isolated cloud account** (sandbox), never in production.
- Stratus provides a **correlation ID** that can be written into resource tags, so you can link a SIEM alert to the test.
- The trace is examined in CloudTrail: `eventName` (`StopLogging`, `ModifySnapshotAttribute`…), the test role's `userIdentity.arn` and `sourceIPAddress`. These are the same queries as in modules 02 and 06.

### MITRE Caldera

**Caldera** is an automated adversary emulation platform. The server controls **agents** on target machines and runs whole scenarios, not just individual techniques.

| Term | Meaning |
|---|---|
| **Agent** | A program on the target that periodically beacons to the server for instructions (e.g. Sandcat, Manx, Ragdoll); identified by its `paw` |
| **Ability** | An implementation of one ATT&CK technique: commands, platforms, output parser |
| **Adversary** | A profile: a set of abilities representing the TTPs of some group |
| **Operation** | Running an adversary profile against a group of agents |
| **Fact** | A piece of data learned during an operation (user, host) that later abilities use |
| **Planner** | The logic that decides the order of abilities |
| **Plugin** | An extension (e.g. importing Atomic tests, reports, emulation plans) |

Caldera is useful when you want to test a **chain** (execution → discovery → persistence), because some detections look at correlation rather than a single event. The cost is complexity: a server, agents that are themselves a C2 channel, and the need to remove the agent after the test.

### Comparison

| | Atomic Red Team | Stratus Red Team | Caldera |
|---|---|---|---|
| Focus | Endpoint (Windows, Linux, macOS), some cloud | Cloud and Kubernetes | Endpoint, scenarios |
| Unit | One test per technique | One technique with a lifecycle | Operation (chain of abilities) |
| Execution | Invoke-AtomicRedTeam, manually, Caldera | `stratus` CLI | Web UI / API, agents |
| Cleanup | `cleanup_command` | `revert`, `cleanup` | Depends on the ability; the agent is removed |
| Best for | Regression of individual rules | Validating CloudTrail and K8s detections | Purple team exercises with an attack chain |

There are other sources too: Falco's **event-generator** produces events for Falco rules, and the MITRE Center for Threat-Informed Defense publishes the **Adversary Emulation Library** with plans for specific groups. In the Microsoft world (SC-200), Defender XDR and Sentinel provide a coverage view against ATT&CK, but you still have to run the test yourself.

> **In practice:** before you run any tool, read the test it will execute. Some tests modify the system (delete logs, change the firewall, stop services), some download additional files from the internet. In an environment you share with others, that can cause a real incident or a service outage.

## Rules of engagement

Every test, even the smallest, needs **rules of engagement**. At a minimum:

| Item | Example |
|---|---|
| Approval | Written, from the system owner; name and date |
| Scope | Hosts, accounts, namespaces; what is explicitly out of scope |
| Timing | Execution window; who is on call |
| Notification | Whether the SOC knows (open test) or not (blind test, with a white cell that can stop it) |
| Abort | Who stops the test and how; contact phone number |
| Data | No real personal data or secrets; fake accounts and keys |
| Test log | For each step: time (UTC), host, user, technique, test GUID |
| Cleanup | Who verifies the state has been restored; how this is confirmed |

The test log is crucial. Without it, an analyst cannot tell whether the 09:12 alert was the test or a real attack that happened to coincide. Good practice is for test accounts and resources to have a recognizable prefix (`purple_`), for the test to carry a marker in a tag or comment, and for the test log to be kept with the report.

## The purple team process

One cycle looks like this:

1. **Technique selection.** Start from the threats relevant to you (threat intel, previous incidents, ATT&CK groups that target your sector), not from the alphabetical order of the ATT&CK matrix.
2. **Hypothesis.** For each technique, write down what you **expect**: which log source, which field, which rule (Wazuh ID, Sigma ID, Falco name), which level and which ATT&CK tag.
3. **Execution.** The red side runs the test and records the exact time and parameters.
4. **Observation.** The blue side checks in order: whether the event was **recorded**, whether it reached the SIEM, whether an **alert** was raised, whether the level is correct, and whether the alert has enough context for triage.
5. **Analysis.** Where did the chain break?
6. **Fix.** New telemetry, a new rule, a corrected exception, better output.
7. **Retest.** Same test, same parameters. Only when it passes is the gap closed.

Classify the result for each technique on a scale. An example scale we use in this course:

| Score | Meaning |
|---|---|
| 0 No telemetry | The event was not recorded anywhere |
| 1 Telemetry | The log exists (in the SIEM or on the host), but there is no alert |
| 2 Alert | The rule fired, but the level, mapping or context is insufficient |
| 3 Detection | An alert of the correct level, with an ATT&CK tag and context for triage |
| 4 Response | The alert was triaged per the runbook within the agreed time |

Scores 0 and 1 call for different fixes. With 0 the problem is **visibility** (no agent, auditd rule, CloudTrail data event, Kubernetes audit level). With 1 the problem is **logic** (no rule, too narrow a condition, too broad an exception).

> **In practice:** the most common result of a first purple team day is not "we have no rule", but "the rule exists, but the log never arrives". That's why your hypothesis should always include the expected log source, and you should check it first. Only once the telemetry is there does it make sense to discuss the rule.

## Validating detections

Validation has three layers. Each catches different failures.

| Layer | What it tests | Tool in the lab | When |
|---|---|---|---|
| Unit test | The rule's logic against a known sample | `wazuh-logtest`, Zircolite, Falco replay | On every rule change (CI) |
| In-environment test | The whole chain: sensor → collection → SIEM → alert | Emulating the technique in the lab | Periodically and after major changes |
| Detection health | Whether sources and rules work at all | Heartbeat, event count per source, "silent" rules | Continuously (dashboard, alert) |

### Unit test: a log sample

The cheapest test doesn't change the system: you feed the rule a log sample that represents the technique. For Wazuh:

```bash
echo 'Oct 14 09:12:44 lab useradd[2214]: new user: name=purple_t1136, UID=999, GID=65534, home=/home/purple_t1136, shell=/bin/bash, from=/dev/pts/0' \
  | /var/ossec/bin/wazuh-logtest 2>&1 | grep -E "id:|level:|description:|mitre"
# expected: id: '5902', level: '8', description: 'New user added to the system.'
```

For a Sigma rule: a sample in JSON form and Zircolite (module 06). For Falco: replaying a `.scap` capture (module 07). Samples are kept next to the rule in the repo: `tests/positive/` (must fire) and `tests/negative/` (legitimate activity, must not fire).

Limitation: a unit test proves that the **rule** works against that sample. It doesn't prove that such a log will appear in production, or that the format isn't different.

### In-environment test

Here you actually execute the technique (in the lab, under the rules of engagement) and check whether the alert arrives where it should. For the T1136.001 lab example, the check looks like this:

```bash
# 1) telemetry on the host
grep 'new user: name=purple_' /var/log/auth.log

# 2) alert in Wazuh, within the test time window
jq -c 'select(.rule.id=="5902") | {t:.timestamp, lvl:.rule.level, mitre:.rule.mitre.id, log:.full_log}' \
   /var/ossec/logs/alerts/alerts.json | tail -3

# 3) cleanup and cleanup verification
getent passwd | grep '^purple_' || echo "no test accounts"
```

A synthetic log (e.g. `logger -p auth.info -t useradd ...`) is a middle ground: it checks collection and the SIEM, but not the sensor. When you use it, state in the report that the test was synthetic.

### Regression and health

- **Regression in CI:** every merge into the detections repo runs all unit tests. A rule that no longer catches its positive sample breaks the build.
- **Silent rules:** a rule that hasn't fired in months isn't necessarily good. Maybe the source stopped sending logs. A periodic atomic test for critical rules reveals this.
- **Source health:** an alert when the event count from a source drops to zero (Wazuh agent disconnected, CloudTrail `StopLogging`, an empty Kubernetes audit log).

```bash
# how many alerts per rule in the latest file, and which expected rules are missing
jq -r '.rule.id' /var/ossec/logs/alerts/alerts.json | sort | uniq -c | sort -rn | head
for id in 5902 5715 5402 100200; do
  n=$(jq -r --arg id $id 'select(.rule.id==$id) | .rule.id' /var/ossec/logs/alerts/alerts.json | wc -l)
  echo "$id $n"
done
```

## Gap analysis

Gap analysis answers the question: **for the techniques that matter to us, what do we see, what do we detect, and what have we verified?**

Procedure:

1. **List of priority techniques.** From the threat profile: e.g. for a cloud-native company T1078.004 (cloud accounts), T1552 (credentials in files), T1610 (deploy container), T1496 (resource hijacking, cryptominers), T1562.008 (disabling cloud logs), T1136 (create account).
2. **Detection inventory.** For each technique: which rules exist (Wazuh, Sigma, Falco) and from which source.
3. **Telemetry inventory.** Which sources actually reach the SIEM and from which systems. Since v18, ATT&CK describes detections through **Detection Strategies** and **Analytics** linked to **Data Components**, so for each technique you can see which data components are required.
4. **Test results.** The 0–4 score from the purple team test, with a date.
5. **Gap prioritization.** Technique relevance × difficulty of the fix × impact if we miss it.

Example matrix:

| Technique | Source | Rule | Last test | Score | Gap |
|---|---|---|---|---|---|
| T1136.001 local account | auth.log | Wazuh 5902 | 2026-10-14 | 3 | — |
| T1059.004 shell from a web server | syscalls (Falco) | `Shell spawned by web server` | 2026-10-14 | 2 | Output lacks the container image |
| T1562.008 disabling CloudTrail | CloudTrail | Sigma `StopLogging` | 2026-10-10 | 3 | — |
| T1552.001 credentials in files | auditd | none | 2026-10-14 | 1 | No rule; auditd watch exists |
| T1496 cryptominer in a pod | syscalls, metrics | none | not tested | 0 | No telemetry for network connections from the pod |

The result is drawn as an **ATT&CK Navigator** layer (module 05): the `score` per technique is the test score, the color shows coverage, and the `comment` carries the test date and the rule name. Two layers (before and after the purple team cycle) give measurable progress.

Metrics worth tracking:

- percentage of priority techniques with a score ≥ 3;
- age of the last validation per rule (a rule untested for more than 90 days is a candidate for testing);
- time from test execution to the alert in the triage queue;
- number of gaps opened and closed per cycle.

> **In practice:** don't paint the whole ATT&CK matrix green. A rule that "covers" a technique with one narrow indicator (a tool name) is not the same as covering the technique. In the Navigator comment, write **what** the rule actually catches (which procedure), so the next analyst doesn't assume the technique is solved.

## Common mistakes

| Mistake | Consequence | How to avoid it |
|---|---|---|
| Test without a hypothesis | You don't know whether the result is good or bad | Before the test, write down the source, rule, level, ATT&CK tag |
| Test without a time log | The alert can't be linked to the test | UTC time, host, user, GUID for every step |
| Rule "tuned" to catch exactly the test tool's name | The detection passes the test but doesn't catch the real technique | Build the rule on behavior (process, path, syscall), not on the test's name |
| Test accounts and resources left behind | A real attacker can abuse them; noise in future investigations | Cleanup verification as a separate, signed-off step |
| Only one procedure per technique | A false sense of coverage | For important techniques, test several variants (another tool, another path) |
| Results stay in a slide deck | Gaps don't get closed | Every gap is a ticket with an owner and a deadline |
| Test in production without approval | Service outage, a real incident | Rules of engagement, a window, an abort contact |

Pay particular attention to the third mistake. If an Atomic test creates an account with a default name, a rule that looks for exactly that name passes every test and catches nothing else. Change the `input_arguments` (another name, another path) between cycles, precisely to verify that the rule catches the technique, not the test.

## Test report

Every cycle ends with a short report that goes into the detections repo:

```text
Purple team cycle 2026-10-14, lab-det-01
Scope: Linux host lab, Wazuh 4.14, Falco 0.45 (replay); no production
Approval: platform owner, ticket SEC-412

T1136.001  test GUID 40d8eabd-...  09:12:44Z  telemetry: yes  alert: 5902 (lvl 8)  score 3
T1059.004  falco replay run-shell-untrusted  alert: Run shell untrusted  score 2  -> SEC-415 (output)
T1552.001  synthetic log  alert: none  score 1  -> SEC-416 (new Sigma rule over auditd)

Cleanup: test accounts removed (getent without purple_), verified by: blue
Next test: 2026-11-11 (regression of all scores >= 3)
```

## Summary

- Emulation proves that a detection works; an untested rule is an assumption. Purple team is red and blue collaborating technique by technique.
- **Atomic Red Team**: small tests per technique (`atomics/T<ID>/T<ID>.yaml`, GUID, platforms, `cleanup_command`). **Stratus Red Team**: cloud and Kubernetes techniques with a warmup → detonate → revert → cleanup lifecycle. **Caldera**: agents, abilities, adversary profiles and operations for attack chains.
- Every test has rules of engagement: approval, scope, timing, abort, fake data, a test log and cleanup verification.
- Process: technique selection from the threat profile → hypothesis (source, rule, level) → execution → observation → fix → retest.
- Validation has three layers: a unit test against a sample (`wazuh-logtest`, Zircolite, Falco replay), an in-environment test, and continuous monitoring of source and rule health.
- Gap analysis combines priority techniques, telemetry, rules and test scores into a matrix and a Navigator layer; distinguish a visibility gap from a logic gap.
- Measure the percentage of validated priority techniques and the age of the last validation, not the number of rules.
