## Exam objectives: 2.2 and 2.3

- **2.2** Given a scenario, analyze output from vulnerability assessment tools: recognize a tool by its output and know what each tool does (network mapping, multipurpose, web, vulnerability, cloud, BAS).
- **2.3** Given a scenario, analyze data to prioritize and mitigate vulnerabilities: criteria (exploitability, active exploitation, asset value, impact, patch availability, true/false positive/negative), **CVSS** and **EPSS**, context (internal, external, isolated), mitigation strategies, and validation.

This is the most hands-on part of domain 2. The exam includes PBQs in which you get a table of findings (CVE, CVSS, EPSS, whether it's in KEV, where the host is) and have to order them or choose what gets fixed first. Beyond what CompTIA explicitly lists, we also cover **CISA KEV** and **SSVC** here, because those are sources that real teams (and CompTIA scenarios via "active exploitation/threat intelligence") use.

## Vulnerability assessment tools (2.2)

CompTIA wants you to recognize a tool and interpret its output. We look at the offensive capabilities of these tools here only as a source of findings and as a way to test defenses.

| Category | Tool | What it does | Typical output |
|---|---|---|---|
| **Network scanning and mapping** | **Angry IP Scanner** | Fast GUI scanner of IP ranges (ping, ports, hostname), export to CSV | List of live IPs with open ports |
| | **Masscan** | Asynchronous port scanner for huge ranges (the entire internet) | `Discovered open port 443/tcp on 10.0.5.12` |
| **Multipurpose** | **Nmap** | Discovery, ports, versions, OS, NSE scripts | PORT/STATE/SERVICE/VERSION table |
| | **Metasploit Framework (MSF)** | Framework for verifying exploitability of vulnerabilities (modules, payloads); for defense: confirming a finding is real, with written approval | Session or module status |
| | **Maltego** | OSINT and visual link analysis (entity graph: domains, emails, IPs, people) | Transform graph |
| | **Recon-ng** | Modular OSINT framework with workspaces and a database (CLI, similar to MSF) | Tables of hosts, contacts, domains |
| **Web application scanners** | **Burp Suite** | Intercepting proxy, manual and automated web application testing | Issues list with severity and confidence |
| | **ZAP** (Zed Attack Proxy) | Open-source DAST, proxy, spider, active and baseline scan (DevSecOps course, DAST module) | Alerts: risk + confidence + CWE |
| | **Nikto** | Web server scanner: dangerous files, outdated versions, headers | Lines with a `+` prefix |
| **Vulnerability scanners** | **Nessus** | Commercial scanner (Tenable), plugins, credentialed and compliance scans | Plugin ID, risk, CVE, solution |
| | **Nuclei** | Fast scanner based on YAML templates | `[template-id] [protocol] [severity] URL` |
| | **OpenVAS** (Greenbone) | Open-source scanner with an NVT feed | Results with QoD (Quality of Detection) |
| **Cloud infrastructure assessment** | **ScoutSuite** | Multi-cloud configuration audit (AWS, Azure, GCP) via API | HTML report per service |
| | **Prowler** | Security checks for AWS/Azure/GCP/K8s, CIS and other frameworks | PASS/FAIL per check |
| | **Trivy** | Vulnerabilities in images, file systems, IaC, secrets, Kubernetes | Table or JSON with CVE and Fixed Version |
| | **Checkov** | Static analysis of IaC (Terraform, CloudFormation, K8s, Dockerfile) | `Check: CKV_AWS_20 ... FAILED` |
| **Breach attack simulation (BAS)** | **Atomic Red Team** | Library of small tests mapped to MITRE ATT&CK techniques | Test per technique (e.g., T1059.001) and whether it was detected |
| | **Caldera** | MITRE platform for automated adversary emulation with agents | Operation with steps and outcomes |

> **On the exam:** recognizing by output: `Discovered open port` is **Masscan**; `[critical]` in square brackets with a template name is **Nuclei**; lines with `+ ` and web server headers are **Nikto**; `CKV_` is **Checkov**; Plugin ID is **Nessus**; QoD is **OpenVAS**. BAS tools (**Atomic Red Team**, **Caldera**) don't look for vulnerabilities; they verify whether detection and controls work.

### Output examples

Nikto against your own service in the lab:

```
$ nikto -h http://127.0.0.1:8080
- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          127.0.0.1
+ Target Hostname:    127.0.0.1
+ Target Port:        8080
---------------------------------------------------------------------------
+ Server: SimpleHTTP/0.6 Python/3.11.2
+ /: The anti-clickjacking X-Frame-Options header is not present.
+ /: The X-Content-Type-Options header is not set.
+ /.git/config: Git config file found. Infos about repo details may be present.
```

The last line is the most serious: an exposed `.git` directory can reveal source code and secrets. Missing headers are low-risk findings.

Nuclei:

```
[git-config] [http] [medium] http://127.0.0.1:8080/.git/config
[http-missing-security-headers:x-frame-options] [http] [info] http://127.0.0.1:8080
```

Nessus (CSV export, abridged):

| Plugin ID | Risk | Host | Port | Name |
|---|---|---|---|---|
| 104743 | Medium | 10.0.2.15 | 443 | TLS Version 1.0 Protocol Detection |
| 42873 | Medium | 10.0.2.15 | 443 | SSL Medium Strength Cipher Suites Supported (SWEET32) |
| 57582 | Medium | 10.0.2.20 | 8443 | SSL Self-Signed Certificate |
| 51192 | Medium | 10.0.2.20 | 8443 | SSL Certificate Cannot Be Trusted |

Checkov on Terraform (DevSecOps course, IaC scanning):

```
Check: CKV_AWS_20: "S3 Bucket has an ACL defined which allows public READ access."
	FAILED for resource: aws_s3_bucket.reports
	File: /main.tf:12-18
```

Prowler:

```
FAIL  iam_root_mfa_enabled            us-east-1  MFA is not enabled for root account.
PASS  cloudtrail_multi_region_enabled us-east-1  Trail main is multiregion.
```

## Validating findings: true/false positive/negative

| | Vulnerability **exists** | Vulnerability **does not exist** |
|---|---|---|
| Scanner **reports** it | **True positive**: fix it | **False positive**: document and suppress after verification |
| Scanner **does not report** it | **False negative**: the most dangerous, you don't know you're exposed | **True negative**: all good |

Typical causes:

- **False positive**: a banner without backport information, a version in a file name, a vulnerable function that isn't used, a finding on a host that's already decommissioned.
- **False negative**: a firewall blocks the scanner, expired credentials, an outdated plugin feed, a service on a non-standard port, a vulnerability in a dependency that isn't in the lockfile.

Before you mark a finding as a false positive: check the actual version (`dpkg -l`, `rpm -q`, registry), read the distribution's advisory, and run a credentialed scan if needed. Document the suppression with a reason and date, otherwise the next analyst can't verify it.

> **On the exam:** a false negative is more dangerous than a false positive. If a scenario asks how to **reduce false negatives**, the answers are a credentialed scan, an up-to-date feed, correct scanner placement, and a complete inventory. To reduce **false positives**, a credentialed scan helps as well, plus manual validation.

## Prioritization criteria

| Criterion | Question | Data source |
|---|---|---|
| **Exploitability** | How easy is it to exploit? Is there a public exploit? | CVSS AV/AC/PR/UI, Exploit Maturity, EPSS |
| **Active exploitation / threat intelligence** | Is it already being used in attacks? Ransomware? | **CISA KEV**, vendor advisory, threat intel feeds (module 4) |
| **Asset value** | How important is the system and what data does it hold? | Inventory, BIA, data classification |
| **Impact** | What does the attacker gain: reading data, full control, service disruption? | CVSS C/I/A (VC/VI/VA), technical impact |
| **Patch/remediation availability** | Is there a patch or only a workaround? | Vendor, `Fixed Version` in Trivy |
| **True/false positives and negatives** | Is the finding real? | Validation |

CVSS scores **severity**, not **risk**. Risk emerges only when you add the likelihood of attack (EPSS, KEV) and asset context.

## CVSS v3.1

**CVSS** (Common Vulnerability Scoring System) is maintained by **FIRST**. The score is 0.0–10.0, and the vector is a text representation of the metrics.

### Base metrics

| Metric | Values | Meaning |
|---|---|---|
| **AV** Attack Vector | N (Network), A (Adjacent), L (Local), P (Physical) | Where the attacker must be |
| **AC** Attack Complexity | L, H | Conditions beyond the attacker's control (e.g., race, MITM) |
| **PR** Privileges Required | N, L, H | Privileges needed before the attack |
| **UI** User Interaction | N, R (Required) | Must the victim do something |
| **S** Scope | U (Unchanged), C (Changed) | Whether the impact crosses into another security authority (e.g., VM escape, XSS into the browser) |
| **C / I / A** | H, L, N | Impact on confidentiality, integrity, availability |

Ratings: **None** 0.0, **Low** 0.1–3.9, **Medium** 4.0–6.9, **High** 7.0–8.9, **Critical** 9.0–10.0.

Examples (calculated with the `cvss` library in the lab, `/opt/tools/bin/python`):

| Vector | Score | Interpretation |
|---|---|---|
| `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | 9.8 Critical | Network, no privileges, no user, full impact (typical RCE) |
| `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` | 10.0 Critical | Same, but crosses the boundary (Log4Shell, CVE-2021-44228) |
| `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H` | 7.8 High | Local privilege escalation |
| `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` | 6.1 Medium | Typical reflected XSS |
| `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` | 5.9 Medium | Data leakage under difficult conditions |

### Temporal and environmental (3.1)

- **Temporal**: **E** Exploit Code Maturity (X, H, F, P, U), **RL** Remediation Level (X, U, W, T, O), **RC** Report Confidence (X, C, R, U). They can only lower the score.
- **Environmental**: **CR/IR/AR** Security Requirements (X, H, M, L) and modified base metrics (MAV, MAC, …). This is where the organization enters its own context.

```
$ /opt/tools/bin/python -c "
from cvss import CVSS3
v='CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'
print(CVSS3(v+'/E:U/RL:O/RC:C').scores())
print(CVSS3(v+'/CR:L/IR:L/AR:L/MAV:L').scores())"
(9.8, 8.5, 8.5)
(9.8, 9.8, 6.6)
```

The result is a triple (base, temporal, environmental). First line: there is no known exploit and an official fix exists, so temporal drops to 8.5. Second line: the system is reachable only locally and has low requirements, so environmental drops to 6.6 (Medium).

> **On the exam:** decode the vector letter by letter. `AV:N` + `PR:N` + `UI:N` = an attack from the network without an account and without a victim, the most dangerous combination. `S:C` means the impact extends beyond the vulnerable component. If a question says the server is reachable only from the internal network, that is expressed through **environmental** metrics (MAV), not by changing the base score.

## CVSS v4.0

CVSS 4.0 (FIRST, November 2023) changes the structure. Groups: **Base**, **Threat**, **Environmental**, **Supplemental**.

| Change | v3.1 | v4.0 |
|---|---|---|
| New attack condition | Part of AC | Separate **AT** Attack Requirements (N, P): conditions in the vulnerable system (e.g., specific configuration, race) |
| User interaction | UI: N, R | UI: **N, P (Passive), A (Active)** |
| Scope | S: U/C | Removed; replaced by impact on the **Vulnerable System** (VC, VI, VA) and the **Subsequent System** (SC, SI, SA) |
| Temporal | E, RL, RC | Becomes **Threat**, only **E** Exploit Maturity remains: A (Attacked), P (POC), U (Unreported), X |
| Environmental | CR/IR/AR + modified | Same, plus MSI/MSA can be **S (Safety)** |
| Supplemental | Doesn't exist | **S** Safety, **AU** Automatable, **R** Recovery, **V** Value Density, **RE** Response Effort, **U** Provider Urgency (Clear/Green/Amber/Red); they don't change the score |
| Calculation | Formula | MacroVector table (expert ranking) |

The nomenclature states what went into the score: **CVSS-B** (base only), **CVSS-BT** (base + threat), **CVSS-BE**, **CVSS-BTE**. When NVD or a vendor publishes only the base score, that's CVSS-B and not the whole story. The order in the vector is mandatory: Base (AV, AC, AT, PR, UI, VC, VI, VA, SC, SI, SA), then E, then environmental, then supplemental.

```
$ /opt/tools/bin/python -c "
from cvss import CVSS4
b='CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'
for s in ['', '/E:A', '/E:P', '/E:U', '/E:A/CR:L/IR:L/AR:L']:
    c=CVSS4(b+s); print(f'{s or \"(base)\":22} {c.base_score} {c.severity}')"
(base)                 9.3 Critical
/E:A                   9.3 Critical
/E:P                   8.9 High
/E:U                   8.1 High
/E:A/CR:L/IR:L/AR:L    8.9 High
```

Note: an undefined E (X) is calculated as **Attacked**, the worst case, so base and `E:A` are the same 9.3. Only when you know the exploit is unreported (`E:U`) does the score drop. With `SC:H/SI:H/SA:H` (impact also on the system behind the vulnerable one), the same vector gives 10.0.

> **On the exam:** the most frequently asked differences between 3.1 and 4.0: v4 **has no Scope** (replaced by VC/VI/VA and SC/SI/SA), has a new **AT** metric, **UI** has Passive/Active, **Temporal became Threat** with only Exploit Maturity, and **Supplemental** metrics (e.g., Automatable, Safety) provide context without changing the score.

## EPSS

CompTIA writes it in the objectives as "First Exploitability Prediction Scoring System"; the official name is **Exploit Prediction Scoring System** and it's maintained by **FIRST**. EPSS estimates the **probability (0–1) that a CVE will be exploited in the wild in the next 30 days**. The score is published daily for every published CVE, together with a **percentile** (what share of all CVEs has an equal or lower score).

| | CVSS | EPSS | CISA KEV |
|---|---|---|---|
| Question | How severe is it if exploited? | How likely is it to be exploited soon? | Has it already been exploited? |
| Value | 0.0–10.0 | 0–1 and percentile | Yes/no (list) |
| Changes | Rarely | Daily | When entries are added |
| Maintained by | FIRST (score given by vendor/NVD) | FIRST | CISA |

File format in the lab:

```
$ head -3 /opt/kurs/data/epss.csv
#model_version:v2026.06.15,score_date:2026-10-16T12:02:51Z
cve,epss,percentile
CVE-1999-0001,0.04753,0.91763
$ grep -E '^CVE-(2021-44228|2024-3094),' /opt/kurs/data/epss.csv
CVE-2021-44228,0.99999,1.0
CVE-2024-3094,0.909,0.99807
$ awk -F, 'NR>2 && $2>=0.1{n++} END{print n}' /opt/kurs/data/epss.csv
17317
```

(The numbers depend on the day the image was built.) In this snapshot fewer than 5% of roughly 390,000 CVEs have an EPSS ≥ 0.1. That's why EPSS dramatically shrinks the pile: out of thousands of "High" findings, only a small share has a realistic likelihood of attack.

Reading it: an EPSS of 0.02 with a percentile of 0.85 means "a 2% chance in 30 days, but that's still more than 85% of all CVEs". The percentile shows relative position, and the probability an absolute estimate.

> **On the exam:** EPSS doesn't measure impact, and CVSS doesn't measure likelihood. When you get two findings with similar CVSS, the higher EPSS goes first. If the CVE is already in KEV, EPSS is secondary: exploitation isn't likely, it's confirmed.

## CISA KEV

CISA has published the **Known Exploited Vulnerabilities (KEV)** catalog since November 2021. Criteria for inclusion: (1) a CVE ID exists, (2) there is reliable evidence of **active exploitation** (a public PoC or scanning is not enough), (3) there is a clear remediation action (patch or mitigation). For US federal civilian agencies the catalog is binding: BOD 22-01 (2021) was replaced in June 2026 by directive **BOD 26-04** "Prioritizing Security Updates Based on Risk", which sets deadlines from a combination of four factors: public exposure of the asset, KEV status, the possibility of automated exploitation, and technical impact (partial or total control). When all four are met, the deadline is **3 days** with forensic triage; lower-category risk gets longer deadlines, up to deferral to the next upgrade. For all other organizations KEV is a recommendation and the best single source of "patch now" signals.

```
$ jq '.count' /opt/kurs/data/kev.json
1748
$ jq '.vulnerabilities[] | select(.cveID=="CVE-2023-4966")
      | {cveID, product, dateAdded, dueDate, knownRansomwareCampaignUse}' /opt/kurs/data/kev.json
{
  "cveID": "CVE-2023-4966",
  "product": "NetScaler ADC and NetScaler Gateway",
  "dateAdded": "2023-10-18",
  "dueDate": "2023-11-08",
  "knownRansomwareCampaignUse": "Known"
}
```

Important fields: `requiredAction` (what to do; for Citrix Bleed also "kill all active and persistent sessions", because stolen sessions survive the patch), `dueDate`, `knownRansomwareCampaignUse` (Known/Unknown), `cwes`, and since BOD 26-04 also `forensicTriage` (Yes/No): whether you need to check, before or alongside patching, if the system has already been compromised.

Joining scanner findings with KEV and EPSS (a typical lab task):

```
$ trivy image -q -f json -o r.json app:1
$ jq -r '.Results[].Vulnerabilities[]?.VulnerabilityID' r.json | sort -u > cves.txt
$ jq -r '.vulnerabilities[].cveID' /opt/kurs/data/kev.json | grep -Fxf cves.txt
CVE-2021-44228
$ awk -F, 'NR==FNR{c[$1];next} ($1 in c)' cves.txt /opt/kurs/data/epss.csv | sort -t, -k2 -gr | head -3
CVE-2021-44228,0.99999,1.0
CVE-2022-42889,0.99931,0.9997
CVE-2020-14343,0.05984,0.93217
```

> **On the exam:** KEV is the answer to the **active exploitation** criterion. A CVSS 7.5 finding that is in KEV, on an internet-facing system, goes ahead of a CVSS 9.8 finding with no known exploitation on an isolated system.

## SSVC

**SSVC** (Stakeholder-Specific Vulnerability Categorization), developed at Carnegie Mellon SEI and adapted by CISA, doesn't produce a number but a **decision** through a decision tree.

| Decision point (CISA tree) | Values |
|---|---|
| **Exploitation** | None, Public PoC, Active |
| **Automatable** | No, Yes (can steps 1–4 of the kill chain be automated) |
| **Technical Impact** | Partial, Total (full control over the system) |
| **Mission Prevalence** | Minimal, Support, Essential |
| **Public Well-being Impact** | Minimal, Material, Irreversible |

| Decision | Meaning |
|---|---|
| **Track** | No action now; monitor and fix within the standard cycle |
| **Track\*** | Same, but it has characteristics that warrant closer monitoring |
| **Attend** | Attention from supervisors; fix faster than the standard deadline, possible notification |
| **Act** | Attention from supervisors and leadership; fix as soon as possible |

Example: Exploitation = Active, Automatable = Yes, Technical Impact = Total, Mission Prevalence = Essential → **Act**. The same CVE with Exploitation = None on a system with Minimal prevalence → **Track**. The four factors of BOD 26-04 are clearly derived from the same ideas.

## Context awareness

| Context | Meaning | Effect on priority |
|---|---|---|
| **External** | Reachable from the internet (web, VPN, mail gateway) | Highest: anyone can try, mass scanning |
| **Internal** | Reachable only from the internal network | Medium: the attacker must get in first (phishing, VPN), but lateral movement is realistic |
| **Isolated** | Air-gapped or strictly segmented system with no path to it | Lower: exploitation requires physical access or compromising an intermediary |

The same CVE has a different priority depending on context. In CVSS this is expressed with environmental metrics (MAV:N/A/L), in SSVC through exposure (part of CISA's application of the tree) and Mission Prevalence.

Prioritization example (PBQ style):

| # | CVE | CVSS | EPSS | KEV | Host | Context | Priority |
|---|---|---|---|---|---|---|---|
| A | VPN gateway RCE | 9.8 | 0.94 | Yes | vpn01 | External | **1** |
| B | Web app deserialization | 8.1 | 0.42 | No | shop01 (PCI) | External | **2** |
| C | Windows LPE | 7.8 | 0.15 | Yes | ws-fin-* | Internal | **3** |
| D | Log4j on a build server | 10.0 | 0.99 | Yes | build-old | Isolated, no network | **4** |
| E | Self-signed cert | 5.3 | 0.00 | No | intranet | Internal | **5** |

D has the highest CVSS and EPSS, but it's isolated, so the attacker has no path to it. That doesn't mean "ignore it": it gets fixed per plan, but not ahead of exposed systems.

## Mitigation strategies

| Strategy | What it means | Example |
|---|---|---|
| **Attack surface management** | Continuous discovery and reduction of the exposed surface (EASM) | Shutting down unused services, closing ports, removing forgotten subdomains and cloud resources |
| **Secure coding best practices** | Fixing the root cause in code, not the symptoms | Parameterized queries, input validation, output encoding, no secrets in code (SAST in CI) |
| **Patching and configuration management** | Patches through a controlled process and maintaining a baseline configuration | Test → pilot group → production, rollback plan; IaC and drift detection |
| **Exceptions** | Formal risk acceptance when it can't be fixed | Risk owner's signature, justification, expiration date, compensating control, periodic review |
| **Compensating controls** | Another control reduces the same risk | WAF rule (virtual patch), segmentation, IPS signature, disabling the vulnerable feature, enhanced monitoring |

Inhibitors to remediation that CompTIA likes in scenarios: **legacy systems** with no patch, **proprietary** systems where the vendor must approve a change, **MOU/SLA** agreements that limit downtime, **degrading** functionality, **organizational governance** (who approves). The answer then is an exception + a compensating control, never "leave it as is without documentation".

> **On the exam:** a patch doesn't exist or must not be applied (medical device, certified OT) → **compensating control** (segmentation, ACL, WAF) and a documented **exception** with a deadline. If a patch exists and the system is exposed → patch, and a WAF is only a temporary measure until the patch is applied.

## Validation of remediation

A ticket isn't closed when the admin says "patched", but when it has been verified:

1. **Rescan** with the same (preferably credentialed) scan: the finding no longer exists.
2. **Version check** on the host (`dpkg -l openssl`, `trivy image` on the new image).
3. For a compensating control: proof that it works (the WAF blocks a test request, the firewall rule rejects a connection from an unauthorized segment).
4. For KEV findings with active exploitation: checking that the system isn't already compromised (IOCs, logs, unknown accounts, web shells). A patch doesn't remove an attacker who is already inside.
5. Updating metrics: time to remediate, SLA compliance (module 11).

```
$ trivy image -q --severity CRITICAL app:2
app:2 (debian 12.7)
Total: 0 (CRITICAL: 0)
```

## Summary

- 2.2: recognize a tool by its output: **Angry IP Scanner** and **Masscan** (mapping), **Nmap**, **MSF**, **Maltego**, **Recon-ng** (multipurpose), **Burp**, **ZAP**, **Nikto** (web), **Nessus**, **Nuclei**, **OpenVAS** (vulnerability), **ScoutSuite**, **Prowler**, **Trivy**, **Checkov** (cloud/IaC), **Atomic Red Team** and **Caldera** (BAS, detection verification).
- A false negative is more dangerous than a false positive; a credentialed scan and an up-to-date feed reduce both.
- **CVSS** measures severity; 3.1 has Base/Temporal/Environmental and Scope, 4.0 has Base/Threat/Environmental/Supplemental, the AT metric, VC/VI/VA + SC/SI/SA, and UI Passive/Active.
- **EPSS** (FIRST) is the probability of exploitation in the next 30 days, updated daily, with a percentile.
- **CISA KEV** confirms active exploitation; BOD 26-04 ties federal agency deadlines to exposure, KEV, automatability, and technical impact.
- **SSVC** produces a Track / Track\* / Attend / Act decision from Exploitation, Automatable, Technical Impact, and mission.
- Context (**external, internal, isolated**) and asset value change the priority of the same CVE.
- Mitigation: attack surface management, secure coding, patching and configuration management, exceptions, and compensating controls; **validate** every fix with a rescan.
