# SecOps training

A self-hosted training app for the path "from DevOps to SecOps": 13 courses that follow security certifications
(Security+, AWS Security Specialty, CKA, CKS, SC-200, CySA+, CCSP, CISSP) plus hands-on tracks (DevSecOps,
detection and response, AI security, end-to-end incident scenarios).

Every course has:

- **lessons** in Markdown,
- **quizzes** with explanations, including PBQ-style ordering/matching and "find the problem" questions
  where you click the faulty lines of a log or config,
- an **exam simulation** weighted by the official exam domains,
- **hands-on labs** in a real Linux terminal in the browser (in the style of Killercoda), each running in an
  isolated Docker container (or a 2-node kubeadm cluster for CKA/CKS) with automatic checks per step,
- a **study plan** that turns your progress into concrete next steps (weak objectives, mistakes to review,
  untested material, labs to redo without hints).

All content is available in **Serbian** (original) and **English**; switch with the `SR | EN` toggle in the top right.
Everything runs locally and offline: the labs have no network access and need no cloud accounts.

## Quick start

### 1. Requirements

| | |
|---|---|
| **Node.js** | 20 or newer |
| **Docker** | Docker Desktop, [Colima](https://github.com/abiosoft/colima) or OrbStack, on macOS or Linux (amd64 or arm64) |
| **Resources** | 4 CPUs and 8–10 GB RAM for Docker (the Kubernetes labs need ~3 GB); about 40 GB of free disk for all lab images and the build cache |
| **Internet** | only while building the lab images; the app and the labs run offline |

With Colima, start the VM with enough resources:

```bash
colima start --cpu 4 --memory 10 --disk 100
```

### 2. Install and build the lab images

```bash
git clone <this repository> secops-training
cd secops-training
npm install
npm run build-labs
```

`npm run build-labs` builds one Docker image per course (`kurs-*-lab:1`). Building all of them downloads tools,
vulnerability databases, container images and sample data, so the first run takes a while (expect up to an hour
or more, depending on your connection). Images are built in folder order because some build on earlier ones
(CKS on CKA, CySA+ and AI security on DevSecOps, the scenarios on DevSecOps + detection + SC-200).

To build only what you need, pass course folders (dependencies first):

```bash
bash scripts/build-labs.sh 01-sigurnosni-temelji 02-security-plus
bash scripts/build-labs.sh 06-devsecops 07-detekcija-i-odgovor 08-sc200 13-scenariji
```

Lessons, quizzes and exam simulations work without any image; only the labs need them.

### 3. Run

```bash
npm start
```

Open **http://localhost:4000**. The server listens on `127.0.0.1` only. Use another port with `PORT=4100 npm start`.

Progress is saved per course in `data/progress-<course>.json` (git-ignored). "Reset progress for this course"
on a course's overview page clears it.

## Courses

| Folder | Course | Questions | Labs |
|---|---|---:|---:|
| `01-sigurnosni-temelji` | Security foundations: Linux hardening, networking and TLS, IAM, STRIDE, OWASP, ATT&CK, vulnerabilities, frameworks, cryptography | 104 | 14 |
| `02-security-plus` | CompTIA Security+ SY0-801 (V8): 5 domains, 27 objectives, PBQs, acronym flashcards | 198 | 8 |
| `03-aws-security-specialty` | AWS Certified Security – Specialty SCS-C03: 6 domains, 16 tasks | 225 | 6 |
| `04-cka` | Certified Kubernetes Administrator (Kubernetes v1.35), with a mock practical exam | 250 | 29 |
| `05-cks` | Certified Kubernetes Security Specialist (Kubernetes v1.35), with a mock practical exam | 225 | 19 |
| `06-devsecops` | DevSecOps pipeline capstone: secrets, Vault, SAST, SCA, IaC, containers, policy as code, SBOM/cosign/SLSA, DAST, quality gate | 223 | 17 |
| `07-detekcija-i-odgovor` | Detection lab: logs and rsyslog, Wazuh, MITRE ATT&CK, Sigma and Zircolite, Falco, incident response and runbooks | 186 | 9 |
| `08-sc200` | Microsoft SC-200: Sentinel, Defender XDR, Defender for Endpoint, Purview investigations, KQL | 208 | 6 |
| `09-cysa` | CompTIA CySA+ CS0-004 (V4): 4 domains, 15 objectives, PBQs | 234 | 4 |
| `10-ccsp` | ISC2 CCSP (outline from 1 Aug 2026): 6 domains, 38 objectives incl. AI/ML; CAT-style simulation | 322 | 2 |
| `11-cissp` | ISC2 CISSP (outline from 15 Apr 2027, with differences to 2024): 8 domains, 59 objectives; CAT-style simulation | 371 | 2 |
| `12-ai-sigurnost` | AI/ML security: OWASP Top 10 for LLM, MITRE ATLAS, agents and MCP, RAG, model supply chain, EU AI Act, NIST AI RMF, ISO 42001 | 232 | 6 |
| `13-scenariji` | Incident scenarios across courses: phishing and a compromised account, a leaked secret and AWS abuse, a Kubernetes compromise, an AI agent incident — from alert to report | 64 | 4 |

## How to use it

1. Pick a course on the home page, then work through the modules: **read the lesson → take the quiz → do the labs**.
   A module counts as complete when the lesson is read, the quiz is at 80%+ and all labs are solved.
2. In a lab, click **Start lab** to get a fresh container (or cluster), follow the steps in the left panel and press
   **Check** after each step. The ▶ button on code blocks sends the command to the terminal. **Reset** starts over.
   Closing the tab stops the container.
3. Open **Study plan** regularly. It ranks recommendations from your progress: objectives below 80% (with at least
   3 answers, weighted by the exam domain), mistakes to review, objectives you haven't been tested on, unfinished labs,
   and labs you finished with hints or many failed checks (redo them without hints).
4. **Objectives** shows your accuracy per exam objective; **Review mistakes** repeats questions you got wrong;
   **Exam simulation** runs a timed exam weighted by domain.

## Checking content

```bash
npm run check                                     # structure of all courses (questions, labs, modules)
npm run check-labs                                # run every lab in Docker: each check must fail before and pass after its solution
node scripts/check-content.js 02-security-plus --labs 08-operacije-kontrole-i-monitoring/01-firewall-nftables
node scripts/check-en.js [course] [--strict]      # English translation coverage and parity with the Serbian original
```

## Troubleshooting

- **"Docker is not running"**: start Docker Desktop / `colima start` / OrbStack. The app uses the socket of the active
  `docker context`, or `DOCKER_HOST` if set.
- **"Lab image … does not exist"**: build it, e.g. `bash scripts/build-labs.sh 04-cka`.
- **Kubernetes lab hangs or the cluster doesn't come up**: give Docker more memory (10 GB recommended). On Colima the
  default `fs.inotify.max_user_instances=128` allows only one cluster at a time; raise it with
  `colima ssh -- sudo sysctl -w fs.inotify.max_user_instances=512`.
- **Old lab containers left behind** (e.g. after a crash) are removed automatically when the server starts.

## Project structure

```text
server.js              Express + WebSocket; the API is /api/c/<course>/...
content.js             course loading (both languages), lab format and question grading
labenv.js              lab environments (a single container, or a multi-node cluster)
public/                frontend (single page)
scripts/               build-labs.sh, check-content.js, check-en.js
courses/<course>/
  content/course.json  title, exam (size, minutes, pass, scaleMin/scaleMax, domains, note), objectives,
                       lab.image, lab.caps, lab.nodes, lab.memoryMB, lab.setupTimeout; *_en fields for English
  content/NN-module/   module.json, lesson.md, quiz.json, labs/*.md (+ lesson.en.md, quiz.en.json, labs/*.en.md)
  content/acronyms.json  (optional) flashcards
  lab/Dockerfile       the lab environment for that course
```

### Adding a course

1. Create `courses/NN-name/` with `content/` and `lab/`.
2. In `course.json` set `order`, `code`, `badge`, `lab.image` and `exam`. If the exam has weighted domains, add
   `exam.domains` and `objectives`: the simulation then picks questions by weight and every question needs an `obj`.
3. `bash scripts/build-labs.sh NN-name`, then `npm run check`.

### Question format

`{ obj?, q, options, answer, explain, snippet?, lang? }`; `answer` is an index or an array of indices (multiple correct).
PBQs: `type: "order"` (answer = option indices in the correct order) or `type: "match"` (`targets`; answer[i] = target index for option i).

Any question can carry a `snippet` (a log, config or code excerpt shown with line numbers) and `lang` (`yaml`, `json`,
`log`, `kql`…). "Find the problem": `type: "spot"` with a `snippet` and no `options`; `answer` is an array of 0-based
line indices the learner must click. In the exam simulation, spot questions go first together with the PBQs.

New questions are appended to the end of a quiz: progress refers to questions by index.

### Lab format

Markdown: `# Title`, an intro, then `## Step` sections. Hidden blocks: `<!-- setup -->` (in the intro),
`<!-- timer -->` (optional, in the intro: countdown in minutes, multi-line form), `<!-- verify -->` (exit 0 = solved),
`<!-- hint -->`, `<!-- solution -->` (used only by the automated check). Scripts must not contain `-->`, and no line
inside a script may start with `## ` (it would start a new step). To look for processes in verify/solution use
`pgrep -x name`, not `pgrep -f path`, because `-f` also matches the check script itself.

### Translations

Serbian is the source. English lives in parallel files (`lesson.en.md`, `quiz.en.json`, `labs/<lab>.en.md`,
`acronyms.en.json`) and in `*_en` fields of `course.json` and `module.json`; anything untranslated falls back to Serbian.
In English labs the setup and solution blocks are byte-identical to the original, and verify blocks differ only in
their messages (`node scripts/check-en.js` enforces this), so file names and identifiers checked by the labs stay in Serbian.

## Lab environments

### AWS labs without an AWS account (course 03)

The labs work offline on realistic data: CloudTrail and VPC Flow/Resolver logs, IAM/SCP/bucket/trust policies,
Terraform and a git repo. The image includes Checkov, cfn-lint, parliament, gitleaks and `iam-eval`, a simplified IAM
policy evaluation simulator (`courses/03-aws-security-specialty/lab/iam_eval.py`).

### Kubernetes labs (CKA, course 04)

`lab.nodes: ["controlplane", "node01"]`: every lab gets a fresh two-node **kubeadm cluster**. Each node is a privileged
container with systemd, containerd and kubelet (like kind) on its own Docker bridge network. Lab setup calls
`cluster-up` (cluster in ~35 s), `cluster-up --no-join` or `cluster-up --bare` (nodes without a cluster, to practise
`kubeadm init`). `ssh node01` works from the control plane node.

The labs don't depend on the internet:

- images (`nginx`, `busybox`, `redis`, the 1.36 control plane for upgrades…) come from a local registry mirror on each
  node (`courses/04-cka/lab/images.txt`); an image missing from the mirror fails immediately with `ErrImagePull`,
- a local apt repository with kubeadm/kubelet/kubectl 1.36.5 for the upgrade labs,
- the Traefik Helm chart (Ingress and Gateway API), Gateway API CRDs, metrics-server and CNI manifests in `/opt/kurs/`.

A cluster uses about 3 GB RAM and ~90 inotify instances; the CKA image is ~2.2 GB.

### CKS labs (course 05)

`kurs-cks-lab:1` is built on top of the CKA image. Differences from the CKA cluster:

- the CNI is **Calico** (`/etc/kurs/cni`), because kindnet doesn't enforce some NetworkPolicy rules
  (e.g. `podSelector: {}` as a source, `ipBlock except` towards a node address),
- AppArmor works inside the node containers: the `kurs-securityfs` service mounts securityfs and loads the default
  container profile before containerd (with `abi <abi/3.0>`, otherwise Debian's apparmor_parser and the Ubuntu kernel block unix sockets),
- tools: kube-bench, Trivy (local DB; images from the mirror, OS packages), Falco (systemd service `falco`, modern eBPF),
  gVisor (`runsc`), kubesec, kube-linter, cosign, syft, strace,
- a second registry mirror (port 5001) with images for the exercises (old vulnerable images, Calico, distroless).

AppArmor profiles and Falco eBPF programs are loaded into the kernel of the Docker VM, shared by all containers.

### DevSecOps labs (course 06)

A single container without network (`kurs-devsecops-lab:1`, ~3.2 GB, `lab.memoryMB: 2560`). Labs work on the repo
`/root/kurs-shop` (created by `kurs-repo`, with a history containing leaked keys), and the pipeline runs locally with
**gitlab-ci-local** (`.gitlab-ci.yml` in the shell executor, `GCL_FORCE_SHELL_EXECUTOR=true`).

Everything the tools normally download is in the image:

- the Trivy vulnerability DB and built-in misconfiguration checks; osv-scanner offline DBs for PyPI, npm and Go,
- a local OCI registry at `127.0.0.1:5000` (`registry-up`) with base images; application images are built by
  `kurs-build` (crane, no Docker daemon),
- local Semgrep rules in `/opt/kurs/semgrep-rules/` (registry rules are not available),
- cosign 3.x without Sigstore services: sign with `--use-signing-config=false --tlog-upload=false`, verify with `--insecure-ignore-tlog=true`,
- Vault 2.x in dev mode and `gitlab-id-token` (simulates GitLab `id_tokens` JWTs for `auth/jwt`),
- OWASP ZAP 2.17 (`zap-auto <plan.yaml>`; proxy on 8090 because the app is on 8080).

The vulnerability databases are a snapshot from image build time; rebuilding the image refreshes them.

### Detection lab (course 07)

A single container without network (`kurs-detekcija-lab:1`, ~1.7 GB, capability `NET_ADMIN` for iptables):

- **Wazuh manager 4.14** without indexer and dashboard (`wazuh-start` starts rsyslog, sshd and Wazuh); alerts in
  `/var/ossec/logs/alerts/alerts.json`, rule testing with `wazuh-logtest` (without `-q`, which prints only when an alert fires),
- **Falco 0.45** in replay mode over the official test captures (`falco-replay <capture.scap> <rules.yaml>`),
- **Sigma**: sigma-cli 3.1 (splunk, elasticsearch, kusto), SigmaHQ rules in `/opt/sigma-rules/`, MITRE data for
  `sigma check` cached in the image; **Zircolite** 4.1 runs Sigma rules over JSON logs.

### SC-200 labs (course 08)

`kurs-sc200-lab:1` (~0.5 GB) runs KQL offline with **lokql** (Kusto-Loco, MIT, built from source for arm64/x64).
`kql query.kql` loads the tables `StormEvents` (Microsoft's KQL tutorial set), `SecurityEvent`, `DeviceProcessEvents`
and `AzureFirewall` (Microsoft samples from the Azure-Sentinel repo, MIT) and runs the query; separate multiple queries
in a file with an empty line, `.save file.csv` saves the result. Checks compare your result with a reference query
(`kql-isto`). lokql doesn't support every operator (e.g. `series_decompose_anomalies`, `top-nested`), so the labs use
the supported subset; the portals (Defender, Sentinel) are covered in the lessons.

### CySA+ labs (course 09)

`kurs-cysa-lab:1` is built on the DevSecOps image (Trivy, osv-scanner, registry) and adds `nmap`, `tcpdump`/`tshark`,
the Python `cvss` library (CVSS 3.1 and 4.0) and snapshots of the CISA KEV catalogue and FIRST EPSS scores
(`/opt/kurs/data/`). Capabilities `NET_ADMIN` and `NET_RAW` allow capturing traffic on loopback.

Courses 10 (CCSP) and 11 (CISSP) have no `lab/` folder and reuse the DevSecOps image for their two labs each.

### AI security (course 12)

`kurs-ai-lab:1` (based on the DevSecOps image, with `jsonschema`, `safetensors` and `numpy` in `/opt/ai`) uses no real
LLM: the labs work on recorded model outputs, tool-call proposals, RAG documents and small models, and they are all
defensive (output validation, an agent tool guard, RAG access control, safetensors and model signing, AI-BOM,
EU AI Act classification).

### Incident scenarios (course 13)

`kurs-scenariji-lab:1` connects material from several courses through four incidents. It is built from the detection
lab, SC-200 (lokql) and DevSecOps (gitleaks) images, so it is built last. Scenario data lives in
`courses/13-scenariji/lab/files/opt/scenariji/<module>/` and lab setup copies it to `/root`. In this image `kql` loads
every CSV in `/root/data/` as a table named after the file (`SigninLogs.csv` → `SigninLogs`); `tool-guard` replays
recorded AI agent tool calls against a policy. All IP addresses and domains in the data are from documentation ranges,
and the AWS keys in scenario 2 are fake.
