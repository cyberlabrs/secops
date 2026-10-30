# Lab 1: The first security job in the pipeline

The `kurs-shop` repo has a pipeline with two stages (`build`, `test`) and no security controls at all. You will run the pipeline locally with **gitlab-ci-local**, which executes `.gitlab-ci.yml` like a GitLab runner with a shell executor.

In this lab you add the first control (SAST with Semgrep), introducing it first as a warning and then as a real **quality gate**.

```bash
cd /root/kurs-shop
cat .gitlab-ci.yml
gitlab-ci-local --list
gitlab-ci-local
```

<!-- setup
set -e
kurs-repo
-->

## Run the existing pipeline

Run the whole pipeline with `gitlab-ci-local` and make sure both jobs pass. Then write the names of the pipeline's jobs to `/root/jobovi.txt` (`jobovi` = jobs), one per line (the output of `gitlab-ci-local --list`).

<!-- verify
cd /root/kurs-shop
[ -s /root/jobovi.txt ] || { echo "/root/jobovi.txt does not exist or is empty"; exit 1; }
for j in build unit-test; do grep -qw "$j" /root/jobovi.txt || { echo "job $j is missing from jobovi.txt"; exit 1; }; done
[ -d .gitlab-ci-local ] || { echo "the pipeline has not been run yet (no .gitlab-ci-local directory)"; exit 1; }
-->
<!-- hint
`gitlab-ci-local --list` prints a table of jobs; the first column is the name. You can also use `yq 'keys' .gitlab-ci.yml`, but that includes `stages` too.
-->
<!-- solution
cd /root/kurs-shop && gitlab-ci-local >/dev/null 2>&1
printf 'build\nunit-test\n' > /root/jobovi.txt
-->

## Add a SAST job as a warning

Add a `security` stage (after `test`) and a `sast` job in it:

- command: `semgrep scan --config /opt/kurs/semgrep-rules --error --json --output semgrep.json .`
- `allow_failure: true` (for now it only warns, it does not block)
- save the `semgrep.json` report as an artifact even when the job fails (`artifacts: when: always`)

Run the pipeline: the `sast` job should fail (the application has vulnerabilities), but the pipeline as a whole should pass.

```bash
gitlab-ci-local sast
jq '.results[] | {rule: .check_id, line: .start.line}' semgrep.json
```

<!-- verify
cd /root/kurs-shop
[ "$(yq '.stages | contains(["security"])' .gitlab-ci.yml)" = "true" ] || { echo "there is no security stage in stages"; exit 1; }
[ "$(yq '.sast.stage' .gitlab-ci.yml)" = "security" ] || { echo "the sast job is not in the security stage"; exit 1; }
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q 'semgrep' || { echo "the sast job does not run semgrep"; exit 1; }
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q -- '--error' || { echo "semgrep needs --error (exit code 1 when there are findings)"; exit 1; }
[ "$(yq '.sast.allow_failure' .gitlab-ci.yml)" = "true" ] || { echo "sast needs allow_failure: true"; exit 1; }
[ "$(yq '.sast.artifacts.when' .gitlab-ci.yml)" = "always" ] || { echo "the sast job's artifacts are not kept when the job fails (artifacts: when: always)"; exit 1; }
yq '.sast.artifacts.paths[]' .gitlab-ci.yml | grep -qx 'semgrep.json' || { echo "semgrep.json is not in artifacts.paths"; exit 1; }
rm -f semgrep.json
gitlab-ci-local > /tmp/gcl.log 2>&1 || { tail -20 /tmp/gcl.log; echo "the pipeline fails; sast should only warn"; exit 1; }
[ -s semgrep.json ] || { echo "the pipeline did not produce semgrep.json"; exit 1; }
[ "$(jq '.results | length' semgrep.json)" -gt 0 ] || { echo "semgrep.json has no findings: has the application already been fixed?"; exit 1; }
-->
<!-- hint
```yaml
stages: [build, test, security]

sast:
  stage: security
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --error --json --output semgrep.json .
  allow_failure: true
  artifacts:
    when: always
    paths: [semgrep.json]
```
In the `gitlab-ci-local` output, a job that is allowed to fail is marked as a warning, and the pipeline finishes successfully.
-->
<!-- solution
cd /root/kurs-shop
yq -i '.stages += ["security"]' .gitlab-ci.yml
yq -i '.sast = {"stage": "security", "script": ["semgrep scan --config /opt/kurs/semgrep-rules --error --json --output semgrep.json ."], "allow_failure": true, "artifacts": {"when": "always", "paths": ["semgrep.json"]}}' .gitlab-ci.yml
gitlab-ci-local >/dev/null 2>&1
-->

## Turn the warning into a gate

The team agreed: findings with **ERROR** severity (injection, insecure deserialization) block the pipeline, while **WARNING** findings only warn.

1. Make the `sast` job scan only ERROR findings (`--severity ERROR`) and remove its `allow_failure`.
2. Add a `sast-upozorenja` job (`upozorenja` = warnings) in the same stage that scans only WARNING (`--severity WARNING --error`) and has `allow_failure: true`.
3. Run the pipeline: it must now fail on the `sast` job. Write the result (exit code) to `/root/gate-rc.txt`.

```bash
gitlab-ci-local; echo $? > /root/gate-rc.txt
```

<!-- verify
cd /root/kurs-shop
yq '.sast.script | join(" ")' .gitlab-ci.yml | grep -q -- '--severity[ =]ERROR' || { echo "sast needs --severity ERROR"; exit 1; }
[ "$(yq '.sast.allow_failure // false' .gitlab-ci.yml)" = "false" ] || { echo "sast still has allow_failure"; exit 1; }
yq '.["sast-upozorenja"].script | join(" ")' .gitlab-ci.yml | grep -q -- '--severity[ =]WARNING' || { echo "sast-upozorenja needs --severity WARNING"; exit 1; }
[ "$(yq '.["sast-upozorenja"].allow_failure' .gitlab-ci.yml)" = "true" ] || { echo "sast-upozorenja needs allow_failure: true"; exit 1; }
[ "$(yq '.["sast-upozorenja"].stage' .gitlab-ci.yml)" = "security" ] || { echo "sast-upozorenja is not in the security stage"; exit 1; }
gitlab-ci-local > /tmp/gcl.log 2>&1 && { echo "the pipeline passes although the application has ERROR findings: the gate does not work"; exit 1; }
grep -q 'sast-upozorenja' /tmp/gcl.log || { echo "the sast-upozorenja job did not run"; exit 1; }
[ "$(tr -d ' \n' < /root/gate-rc.txt 2>/dev/null)" != "0" ] && [ -n "$(tr -d ' \n' < /root/gate-rc.txt 2>/dev/null)" ] || { echo "/root/gate-rc.txt must contain the pipeline's exit code (non-zero)"; exit 1; }
-->
<!-- hint
```yaml
sast:
  stage: security
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --json --output semgrep.json .
  artifacts:
    when: always
    paths: [semgrep.json]

sast-upozorenja:
  stage: security
  script:
    - semgrep scan --config /opt/kurs/semgrep-rules --severity WARNING --error .
  allow_failure: true
```
`yq -i 'del(.sast.allow_failure)' .gitlab-ci.yml` deletes the field.
-->
<!-- solution
cd /root/kurs-shop
yq -i 'del(.sast.allow_failure) | .sast.script = ["semgrep scan --config /opt/kurs/semgrep-rules --severity ERROR --error --json --output semgrep.json ."]' .gitlab-ci.yml
yq -i '.["sast-upozorenja"] = {"stage": "security", "script": ["semgrep scan --config /opt/kurs/semgrep-rules --severity WARNING --error ."], "allow_failure": true}' .gitlab-ci.yml
gitlab-ci-local >/dev/null 2>&1; echo $? > /root/gate-rc.txt
-->
