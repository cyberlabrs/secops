## What this module covers

Objective **4.1**: scanning infrastructure as code (**IaC**) with Checkov and Trivy, custom checks, and justified suppressions.

Where the control sits in the pipeline: in an early stage, in parallel with secret scanning, SAST and SCA. It works on source code (`infra/*.tf`, `k8s/*.yaml`, `Dockerfile`), takes seconds and doesn't need a cloud account.

The threat it prevents: **misconfiguration**, i.e. a wrong configuration that opens a resource to the world. A public S3 bucket, SSH open to the internet or a database reachable from the internet are not vulnerabilities in code; they are decisions written down in Terraform. If you catch them in the merge request, the fix costs one commit. If an attacker catches them, it costs an incident.

| When you catch the mistake | Who catches it | Cost |
|---|---|---|
| In the editor / pre-commit | developer | seconds |
| In the MR pipeline (this module) | IaC scanner | one commit |
| After `terraform apply` | CSPM (AWS Config, Security Hub) | the resource has already been exposed |
| After an incident | attacker | data |

**CSPM** (Cloud Security Posture Management) is still needed, because someone always clicks something in the console. But IaC scanning is cheaper and gives feedback to the author of the change, not to the security team three weeks later.

## What's wrong with `infra/main.tf`

The `/root/kurs-shop` repo has deliberately bad Terraform. These are the findings both scanners report:

| Resource | Problem | Checkov | Trivy |
|---|---|---|---|
| `aws_s3_bucket_public_access_block.uploads` | all four protections are `false` | `CKV_AWS_53` and related | several findings for S3 public access |
| `aws_security_group.web` | SSH (22) from `0.0.0.0/0` | `CKV_AWS_24` | `AWS-0107` |
| `aws_security_group.web` | HTTP (80) from `0.0.0.0/0` | `CKV_AWS_260` | `AWS-0107` |
| `aws_db_instance.shop` | `publicly_accessible = true` | `CKV_AWS_17` | `AWS-0180` |
| `aws_db_instance.shop` | `storage_encrypted = false` | `CKV_AWS_16` | `AWS-0080` |
| `aws_db_instance.shop` | `password = "Shop12345!"` in code | secret scanner | secret scanner |

Note the last row: IaC scanners look at **configuration**, and a password in code is primarily caught by secret scanners (gitleaks from module 03, the Checkov `secrets` framework, `trivy fs --scanners secret`). The fix is not "hide the password in a variable", but not keeping the password in Terraform at all:

```hcl
resource "aws_db_instance" "shop" {
  identifier                  = "kurs-shop-db"
  engine                      = "postgres"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  username                    = "shop"
  manage_master_user_password = true   # the password is generated and stored by Secrets Manager
  publicly_accessible         = false
  storage_encrypted           = true
  deletion_protection         = true
  skip_final_snapshot         = false
}
```

> **In practice:** HTTP 80 open to `0.0.0.0/0` on a web server is often intentional (there's a load balancer or a public site behind it). Justified suppressions exist precisely for such cases. SSH open to the whole internet is almost never justified: replace it with SSM Session Manager or a VPN.

## Checkov

**Checkov** is an open-source IaC scanner (Prisma Cloud / Palo Alto). It supports Terraform (and plans in JSON), CloudFormation, Kubernetes, Helm, Dockerfile, GitHub Actions and GitLab CI configurations, ARM/Bicep and more. Checks have IDs of the form `CKV_AWS_24`; IDs with `CKV2_` are **graph** checks that look at relationships between resources (e.g. "the bucket has an associated public access block").

### Running locally

```bash
cd /root/kurs-shop
checkov -d infra                          # whole directory
checkov -f infra/main.tf                  # a single file
checkov -d . --framework terraform        # only Terraform from the whole repo
checkov -d infra --check CKV_AWS_24,CKV_AWS_17   # only these checks
checkov -d infra --compact --quiet        # only failed findings, without code snippets
```

The output for one finding looks like this (abbreviated):

```text
Check: CKV_AWS_24: "Ensure no security groups allow ingress from 0.0.0.0:0 to port 22"
	FAILED for resource: aws_security_group.web
	File: /main.tf:26-45
```

The exit code is non-zero as soon as there is a single failed finding. That's enough for the job to fail.

In the lab, `checkov` is a wrapper that adds `--skip-download` and `BC_SKIP_MAPPING=TRUE`, because there's no network. A consequence worth knowing outside the lab too: **built-in checks have no severity in open-source mode** (severity comes from the platform with an API key). That's why `--hard-fail-on HIGH` or `--skip-check MEDIUM` without an API key don't work the way you'd expect. You build the gate by check IDs.

### Controlling the exit code

| Flag | Behavior |
|---|---|
| (nothing) | any failed finding → exit 1 |
| `-s`, `--soft-fail` | always exit 0 (report only) |
| `--soft-fail-on CKV_AWS_260` | exit 0 if only the listed checks fail |
| `--hard-fail-on CKV_AWS_24,CKV_AWS_17` | exit 1 only for the listed checks |
| `--skip-check CKV_AWS_18` | the check doesn't run at all and doesn't appear in the report |

The difference between `--skip-check` and `--soft-fail-on` matters: skip **hides** the finding, soft-fail **shows** it but doesn't break the build. Use soft-fail when introducing the tool; use skip only for checks that genuinely make no sense in your environment.

### Configuration file

Instead of a long command line, Checkov reads `.checkov.yaml` from the current directory (or `--config-file`). The keys are flag names:

```yaml
# /root/kurs-shop/.checkov.yaml
directory:
  - infra
  - k8s
framework:
  - terraform
  - kubernetes
compact: true
quiet: true
skip-check:
  - CKV_AWS_18     # S3 access logging: central CloudTrail data events, decision SEC-112
```

The comment next to each global skip isn't decoration: in six months nobody will know why the check was disabled.

### Output for the pipeline

```bash
checkov -d infra -o cli -o sarif --output-file-path console,checkov.sarif
checkov -d infra -o cli -o gitlab_sast --output-file-path console,gl-sast-checkov.json
```

Multiple `-o` flags produce multiple formats at once; `--output-file-path` says, in order, where each one goes (`console` means standard output). `sarif` is for GitHub code scanning, DefectDojo and other tools that understand SARIF 2.1.0; `gitlab_sast` is the format GitLab shows in the MR widget via `artifacts:reports:sast`.

### Job in `.gitlab-ci.yml`

```yaml
stages: [secrets, sast, iac, build, test]

iac-checkov:
  stage: iac
  needs: []
  script:
    - checkov -d infra -d k8s --framework terraform kubernetes
        -o cli -o gitlab_sast -o sarif
        --output-file-path console,gl-sast-checkov.json,checkov.sarif
  artifacts:
    when: always            # the report is needed even when the job fails
    paths: [checkov.sarif]
    reports:
      sast: gl-sast-checkov.json
  rules:
    - changes: [infra/**/*, k8s/**/*, .checkov.yaml]
```

Three details:

- `needs: []` starts the job immediately, without waiting for previous stages.
- `artifacts:when: always` is mandatory for security jobs; by default artifacts are kept only for a successful job, and it's exactly when it fails that you want the report.
- `rules:changes` saves time on MRs that don't touch infrastructure. On the main branch and in scheduled pipelines, let the full scan run (new checks in a new Checkov version may find something in old code).

The equivalent in GitHub Actions is a step with the `checkov` command (or the `bridgecrewio/checkov-action` action) and a SARIF upload via `github/codeql-action/upload-sarif`. GitLab also has its own IaC scanning template (`Jobs/SAST-IaC.gitlab-ci.yml`), which uses KICS internally; useful if you already use GitLab Ultimate, but less flexible than your own job.

> **In practice:** A new IaC scanner on an existing repo throws out 80 findings on day one. If it breaks the build right away, the team will have disabled it by Friday. Start with `--soft-fail` and a SARIF report for two weeks, create a baseline, then turn on the gate for **new** findings.

## Suppressions in Checkov

### Inline skip

You place the suppression **inside** the resource it applies to, with the reason after a colon:

```hcl
resource "aws_security_group" "web" {
  #checkov:skip=CKV_AWS_260:Public web behind the ALB; approved SEC-118, review 2026-12-31
  name        = "kurs-shop-web"
  description = "Kurs Shop web"
  # ...
}
```

For a Kubernetes manifest you use an annotation, because YAML comments don't survive every tool:

```yaml
metadata:
  name: node-exporter
  annotations:
    checkov.io/skip1: CKV_K8S_16=DaemonSet for node metrics; SEC-120
    checkov.io/skip2: CKV_K8S_14=Image pinned by digest in Helm values
```

An inline skip appears in the report as **SKIPPED** with your reason, so it can be audited. Checkov has no built-in expiry for inline skips; write the review date into the reason and check it via code review or a scheduled job that looks for expired dates (`grep -rn "checkov:skip" infra/`).

### Baseline

For existing technical debt you don't write 80 inline comments. You create a **baseline**: a snapshot of the existing findings, so the build fails only on new ones.

```bash
checkov -d infra --create-baseline      # writes infra/.checkov.baseline
git add infra/.checkov.baseline
checkov -d infra --baseline infra/.checkov.baseline
```

The baseline works only with `-d`. Commit it and treat it as a debt list: every sprint delete a few entries and fix the code.

### What to choose

| Mechanism | Scope | Visible in report | When |
|---|---|---|---|
| `#checkov:skip=ID:reason` | one resource | yes, as SKIPPED | a deliberate, justified decision |
| `skip-check` in `.checkov.yaml` | whole repo | no | the check makes no sense in your environment |
| `--soft-fail-on ID` | whole repo | yes, as FAILED | temporarily, until the team fixes it |
| `--baseline` | existing findings | no (unless `--output-baseline-as-skipped`) | introducing the tool into an old repo |

> **In practice:** An inline skip changes the Terraform file, so it goes through code review like any other change. That's an advantage: a CODEOWNERS rule that changes containing `checkov:skip` must be approved by someone from the security team gives you control without a separate suppression tool.

## Custom checks in Checkov

Built-in checks cover general good practices. Your company's rules (mandatory tags, allowed regions, `deletion_protection` on databases) you write yourself.

### YAML check

```yaml
# policies/checkov/rds_deletion_protection.yaml
metadata:
  id: "CKV2_KURS_1"
  name: "RDS instance must have deletion_protection"
  category: "BACKUP_AND_RECOVERY"
  severity: "HIGH"
definition:
  cond_type: "attribute"
  resource_types:
    - "aws_db_instance"
  attribute: "deletion_protection"
  operator: "equals"
  value: true
```

You combine multiple conditions with `and` / `or`:

```yaml
# policies/checkov/s3_owner_tag.yaml
metadata:
  id: "CKV2_KURS_2"
  name: "S3 bucket must have owner and data-class tags"
  category: "GENERAL_SECURITY"
definition:
  and:
    - cond_type: "attribute"
      resource_types: ["aws_s3_bucket"]
      attribute: "tags.owner"
      operator: "exists"
    - cond_type: "attribute"
      resource_types: ["aws_s3_bucket"]
      attribute: "tags.data-class"
      operator: "within"
      value: ["public", "internal", "confidential"]
```

Running:

```bash
checkov -d infra --external-checks-dir policies/checkov
checkov -d infra --external-checks-dir policies/checkov --check CKV2_KURS_1,CKV2_KURS_2
```

YAML checks are graph checks, so they can also use `cond_type: connection` (e.g. "every `aws_db_instance` must be connected to an `aws_db_subnet_group`"). The severity you write in the metadata yourself applies even without the platform.

### Python check

When the logic doesn't fit into operators (calculations, CIDR parsing, comparing two attributes), write Python:

```python
# policies/checkov/sg_no_admin_ports.py
from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

ADMIN_PORTS = {22, 3389, 5432}


class NoAdminPortsFromInternet(BaseResourceCheck):
    def __init__(self):
        super().__init__(
            name="Admin ports must not be open to 0.0.0.0/0",
            id="CKV_KURS_3",
            categories=[CheckCategories.NETWORKING],
            supported_resources=["aws_security_group"],
        )

    def scan_resource_conf(self, conf):
        for rule in conf.get("ingress", []):
            cidrs = rule.get("cidr_blocks", [[]])[0] or []
            ports = range(rule["from_port"][0], rule["to_port"][0] + 1)
            if "0.0.0.0/0" in cidrs and ADMIN_PORTS.intersection(ports):
                return CheckResult.FAILED
        return CheckResult.PASSED


check = NoAdminPortsFromInternet()
```

Values in `conf` come as lists (that's how Checkov parses HCL), hence `[0]`. The last line registers the check; without it Checkov loads the file but doesn't run the check. The same `--external-checks-dir` loads both YAML and Python checks.

> **In practice:** Keep custom checks in a separate repo (`security/iac-policies`) and bring them into the pipeline through an `include` template that clones them at a pinned version (tag or commit). That way an application team can't quietly weaken a rule in its own repo, and you can test a new version of a rule before turning it on for everyone.

## Trivy misconfig

Trivy (familiar from CKS for images) also has a configuration scanner. The checks are written in Rego and embedded in the binary (in the lab they are not downloaded from the network).

```bash
trivy config infra/                                  # Terraform, CFN, K8s, Dockerfile, Helm...
trivy config --severity HIGH,CRITICAL infra/
trivy config --severity HIGH,CRITICAL --exit-code 1 infra/
trivy config --misconfig-scanners terraform,dockerfile .
trivy fs --scanners misconfig,secret .               # configuration + secrets in one pass
```

Unlike Checkov, `trivy config` **returns exit 0 by default** even when it finds problems. You get a gate only with `--exit-code 1`, and a threshold with `--severity`. Trivy checks have a severity without any platform.

Check IDs: newer versions show the form `AWS-0107`, `DS-0002`, `KSV-0017`; the older form `AVD-AWS-0107` still works as an alias, as does the long ID (`aws-ec2-no-public-ingress-sgr`). Case doesn't matter.

### Trivy and the Terraform plan

Scanning `.tf` files doesn't know variable values from `terraform.tfvars` or from registry modules. When that matters, scan the plan:

```bash
terraform plan -out tfplan && terraform show -json tfplan > tfplan.json
trivy config tfplan.json
checkov -f tfplan.json --framework terraform_plan
```

A plan requires access to the provider, so in practice it's done in a later job with read-only credentials. The lab has neither Terraform nor AWS; we scan the source code.

### Suppressions in Trivy

An inline comment above the resource, with an optional expiry:

```hcl
#trivy:ignore:AWS-0107:exp:2026-12-31
resource "aws_security_group" "web" {
  # ...
}
```

It can also be more precise, by block attribute: `#trivy:ignore:aws-ec2-no-public-ingress-sgr[from_port=80]` ignores only the rule for port 80, while SSH remains a finding. When the `exp:` date passes, the finding comes back and the build fails again; this is the expiry mechanism that Checkov's inline skip lacks.

Inline ignore doesn't work for findings caused by the **absence** of something (e.g. no `USER` in a Dockerfile). For those, and for repo-level suppressions, use `.trivyignore.yaml`:

```yaml
# /root/kurs-shop/.trivyignore.yaml
misconfigurations:
  - id: AWS-0107
    paths: ["infra/main.tf"]
    statement: "Port 80 public behind the ALB; SEC-118"
    expired_at: 2026-12-31
```

```bash
trivy config --ignorefile .trivyignore.yaml --exit-code 1 --severity HIGH,CRITICAL infra/
```

The YAML format of the ignore file is marked experimental in Trivy and **must** be specified with `--ignorefile` (by default only the plain `.trivyignore` is read, one ID per line). More on both files in module 08.

### Custom Trivy check (Rego)

```rego
# policies/trivy/rds_deletion_protection.rego
# METADATA
# title: RDS without deletion protection
# description: Production databases must have deletion_protection.
# custom:
#   id: KURS-0001
#   severity: HIGH
#   input:
#     selector:
#     - type: cloud
package user.kurs.rds_deletion_protection

import rego.v1

deny contains res if {
	some db in input.aws.rds.instances
	not db.deletionprotection.value
	res := result.new("RDS instance has no deletion_protection", db.deletionprotection)
}
```

```bash
trivy config --config-check policies/trivy --check-namespaces user infra/
```

This logic is the same as the built-in `AWS-0177`, which has MEDIUM severity and therefore doesn't enter a `--severity HIGH,CRITICAL` gate. With a custom check the company raises its own rule to HIGH. Terraform checks in Trivy work on an internal **cloud** model (`input.aws.rds.instances`), not on raw HCL; you find the exact field names in the schema (the `trivy` documentation, "custom checks", and the source of the built-in checks). Without `--check-namespaces` Trivy runs only its built-in checks and silently ignores your package. For simple tag and attribute checks, Checkov YAML is faster to write; Rego makes sense if you already use OPA/Conftest (module 09).

## Checkov or Trivy?

| | Checkov | Trivy misconfig |
|---|---|---|
| Default exit code with findings | 1 | 0 (needs `--exit-code 1`) |
| Finding severity | only with the platform (or in custom checks) | built in |
| Severity threshold | `--hard-fail-on` (with the platform) | `--severity` |
| Inline suppression | `#checkov:skip=ID:reason` | `#trivy:ignore:ID:exp:date` |
| Suppression expiry | none (write it in the reason) | `exp:` / `expired_at` |
| Baseline | `--create-baseline` / `--baseline` | none; `.trivyignore.yaml` |
| Custom checks | YAML or Python | Rego |
| Graph checks (resource relationships) | yes (`CKV2_`) | limited, via the cloud model |
| Same tool scans images and dependencies | no (has SCA with the platform) | yes |

You don't have to pick just one. A common combination: **Checkov as the gate** for Terraform (a rich set of AWS checks, baseline, YAML rules), and **Trivy** for images and dependencies, with `trivy config` as a second opinion in reporting mode. What you should avoid is two tools breaking the build for the same finding with two different suppression mechanisms; the developer then has to write the same suppression twice.

> **In practice:** Decide which tool is the **gate** and which only reports. The gate has a clear threshold, documented suppressions and an owner. The other tool runs with `allow_failure: true` or `--exit-code 0` and feeds the report (DefectDojo, module 12), where findings are deduplicated.

## The complete IaC part of the pipeline

```yaml
iac-checkov:
  stage: iac
  needs: []
  script:
    - checkov -d infra --framework terraform
        --external-checks-dir policies/checkov
        --baseline infra/.checkov.baseline
        -o cli -o sarif --output-file-path console,checkov.sarif
  artifacts:
    when: always
    paths: [checkov.sarif]

iac-trivy:
  stage: iac
  needs: []
  allow_failure: true          # second opinion, not a gate
  script:
    - trivy config --ignorefile .trivyignore.yaml
        --severity HIGH,CRITICAL --exit-code 1
        --format sarif --output trivy-config.sarif infra/ k8s/
  artifacts:
    when: always
    paths: [trivy-config.sarif]
```

Running in the lab:

```bash
cd /root/kurs-shop
gitlab-ci-local --list
gitlab-ci-local iac-checkov
```

When `iac-checkov` fails, fix `infra/main.tf` (or add a justified suppression), then rerun just that job.

> **In practice:** A developer who sees "CKV_AWS_17 FAILED" doesn't know what to do. Keep a short table of "most common findings and how to fix them" with an example of correct Terraform in an MR comment or the pipeline README. Time to fix drops from an hour to five minutes, and the number of suppression requests drops dramatically.

## Summary

- IaC scanning catches misconfiguration (a public bucket, open SSH, a public and unencrypted database) in the MR, before the resource exists.
- Checkov: `-d`/`-f`, `--framework`, `--check`/`--skip-check`; fails on any finding, `--soft-fail` for reporting mode, `--soft-fail-on`/`--hard-fail-on` for a granular gate; severity of built-in checks requires the platform.
- Trivy: `trivy config`, exit 0 by default, gate with `--exit-code 1 --severity HIGH,CRITICAL`; IDs `AWS-0107`, alias `AVD-AWS-0107`.
- Suppressions: `#checkov:skip=ID:reason` inside the resource, a `checkov.io/skipN` annotation in K8s; `#trivy:ignore:ID:exp:date` above the resource; `.trivyignore.yaml` with `statement` and `expired_at` (with `--ignorefile`).
- You handle existing debt with a baseline (`--create-baseline`, `--baseline`), not by globally disabling checks.
- Custom rules: Checkov YAML (`cond_type`, `operator`) or Python (`BaseResourceCheck`), loaded with `--external-checks-dir`; Trivy Rego checks with `--config-check` and `--check-namespaces`.
- In the pipeline: `needs: []`, `artifacts:when: always`, a SARIF/`gitlab_sast` report; one tool is the gate, the other reports.
