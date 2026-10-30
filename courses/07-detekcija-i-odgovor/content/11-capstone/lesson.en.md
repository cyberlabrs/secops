## Capstone goal

Phase 4 has no exam: the proof of your knowledge is the detections and the response plan you can show and explain. In the capstone lab the new `kurs-pay` service gets a complete "detection package", the way it would at a company before going to production:

1. **Telemetry**: the log arrives at the right place (rsyslog) and the SIEM understands it (Wazuh decoder).
2. **Detections**: rules with a clear level, correlation and an ATT&CK tag.
3. **Integrity**: the configuration that determines risk (limits) is under FIM.
4. **Portability**: the same logic as a Sigma rule, tested against positive and negative examples, converted for the SIEM used by the central team.
5. **Response**: a runbook the on-call engineer can execute without you.

The lab has a 120-minute countdown.

## What a good "detection package" looks like

| Part | Question it answers | Where it lives |
|---|---|---|
| Threat description | What exactly do we want to catch, and why is it a risk? | README next to the rule |
| Data source | Which log, which fields, how much delay? | source documentation, decoder |
| Logic | Condition, threshold, correlation window | Wazuh/Sigma rule |
| Tests | Positive and negative examples, including edge cases | `tests/` next to the rule, CI |
| False positives | Who legitimately does the same thing? How do we exclude them? | `falsepositives`, exceptions |
| Severity and ATT&CK | How urgent, which technique | `level`, `tags` / `<mitre>` |
| Response | What the on-call engineer does when it fires | runbook |

> **In practice:** edge cases (`999` and `1000`, "same user" and "different users") catch the most bugs in rules. Write them first, and only then the rule.

## Wazuh and Sigma together

A Wazuh rule runs on the host and in the Wazuh manager, immediately, and can trigger active response. A Sigma rule is a tool-independent format: the same file becomes a Splunk, Elastic or KQL query when the central SOC uses a different SIEM. In practice the team keeps Sigma rules in a git repo (detection as code), and CI checks them (`sigma check`), tests them (Zircolite or the SIEM against test data) and converts them.

```text
rule.yml ──► sigma check ──► tests (positive/negative) ──► sigma convert ──► SIEM
    ▲                                                                         │
    └──────────────── tuning (false positives, new sources) ◄──────── alerts ─┘
```

## The runbook as a product

A runbook is read by someone who did not write the rule, often at night. Therefore:

- every step is an action ("block the operator's account in kurs-pay"), not advice ("consider blocking"),
- commands are complete and can be copied directly,
- it is clear **who decides** (incident commander, service owner) and **who gets notified**,
- after every incident the runbook is updated (the "Post-incident" section).

> **In practice:** test the runbook in an exercise (tabletop) before the first real incident. The most common finding is that the on-call engineer lacks the permissions to execute a containment step.

## What to show in your portfolio

- A repo with Wazuh rules and decoders, Sigma rules and test examples, plus CI that checks them.
- An ATT&CK Navigator coverage layer and a list of gaps with a plan.
- Two or three runbooks and a short exercise report.

The next step in the plan is **SC-200**: the same principles in Microsoft Sentinel and Defender XDR, with KQL instead of Wazuh rules.

## Summary

- A detection is a package: source, logic, tests, false positives, severity, ATT&CK and runbook.
- Edge-case tests are written before the rule.
- A Wazuh rule reacts locally and quickly; a Sigma rule carries the same logic to any SIEM.
- Configuration that determines risk goes under FIM.
- A runbook consists of concrete actions and decisions, tested in an exercise.
