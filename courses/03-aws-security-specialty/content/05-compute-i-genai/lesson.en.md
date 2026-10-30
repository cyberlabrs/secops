## What this module covers

The module covers task **3.2** of domain 3 (**Infrastructure Security**, 18% of the exam): designing, implementing, and troubleshooting security controls for compute workloads. Skills:

- **3.2.1** hardened EC2 AMIs and container images (Systems Manager, EC2 Image Builder),
- **3.2.2** instance profiles, service roles, and execution roles in the right place,
- **3.2.3** vulnerability scanning (Amazon Inspector for ECR and Lambda, GuardDuty for runtime),
- **3.2.4** automated patching and continuous validation (Patch Manager + Inspector),
- **3.2.5** secure administrative access (Session Manager, EC2 Instance Connect),
- **3.2.6** vulnerability tools in the pipeline (Amazon Q Developer, CodeGuru Security),
- **3.2.7** guardrails for generative AI (OWASP Top 10 for LLM Applications).

The exam rarely asks "what is service X" here. It typically gives a scenario: "EC2 instances are in a private subnet, the company does not want to open port 22 or maintain a bastion…" or "A Lambda function accesses a DynamoDB table with hardcoded keys…". You choose the solution with the **least operational overhead** that is still **least privilege**.

## 3.2.1 Hardened AMIs and container images

### Golden image

The idea is simple: you do not harden every instance by hand; instead you build a **golden AMI** once with built-in controls and launch everything from it. It includes:

- a minimal OS, with unnecessary packages and services removed,
- CIS or STIG hardening, a configured `sshd` (or SSH disabled entirely because you use Session Manager),
- the **SSM Agent**, the CloudWatch agent, possibly the GuardDuty security agent,
- the latest patches at build time,
- IMDSv2 as required (`HttpTokens=required`) at the AMI level (`--imds-support v2.0`).

### EC2 Image Builder

**EC2 Image Builder** is a managed service that automates building, testing, and distributing AMIs and container images.

| Term | What it is |
|---|---|
| **Image recipe** / **container recipe** | Base image + a list of components. |
| **Component** | A YAML document with steps (build/validate/test). AWS provides ready-made components, e.g., for STIG hardening and OS updates. |
| **Infrastructure configuration** | On which instance, subnet, and with which instance profile the build runs. |
| **Distribution configuration** | Which Regions and accounts the AMI is copied to, with which KMS key, launch permissions. |
| **Image pipeline** | A schedule (e.g., weekly or when a new base image is released) that runs all of it. |

Image Builder has built-in scanning with **Amazon Inspector**: after the build, the image is scanned and you see CVE findings before distribution. The pipeline can run on a schedule, so every new build automatically picks up patches.

```bash
# An AMI that requires IMDSv2 for all instances launched from it
aws ec2 register-image --name golden-al2023-2026-10 \
  --root-device-name /dev/xvda --block-device-mappings file://bdm.json \
  --imds-support v2.0
```

### Container images

The same applies to containers, but with different tools:

- a minimal base image (distroless, `-minimal` variants), without a shell where possible,
- a non-root `USER`, a read-only root filesystem in the task definition or pod spec,
- **Amazon ECR** with **tag immutability** (a tag cannot be overwritten), encryption (AES-256 or KMS), and scanning,
- image signing (AWS Signer with Notation) and signature verification before deployment.

> **On the exam:** "Standardize hardening and automatically build new AMIs when patches are released, with the least operational overhead" = an **EC2 Image Builder pipeline** with a schedule. Building AMIs manually, Packer on your own instance, or a user data script are distractors that require more maintenance.

## 3.2.2 Roles for compute: who carries the credentials

Rule number one: **never a long-lived access key on an instance, in a container, or in a Lambda environment variable.** Every compute service has its own mechanism for temporary credentials.

| Mechanism | For what | Who assumes the role (trust policy principal) |
|---|---|---|
| **Instance profile** | An EC2 instance. A container for the role; credentials via IMDS. | `ec2.amazonaws.com` |
| **Service role** | An AWS service does something on your behalf (e.g., CodeBuild, Image Builder, Backup). | That service, e.g., `codebuild.amazonaws.com` |
| **Service-linked role** | A predefined role that the service creates itself and that you cannot modify. | The service; AWS defines the permissions |
| **Lambda execution role** | What a Lambda function may do (e.g., read DynamoDB, write logs). | `lambda.amazonaws.com` |
| **ECS task execution role** | The ECS agent: pull the image from ECR, send logs, read secrets for environment variables. | `ecs-tasks.amazonaws.com` |
| **ECS task role** | What the **application in the container** may do. | `ecs-tasks.amazonaws.com` |
| **EKS IRSA** | A pod gets an IAM role through a Kubernetes service account (OIDC federation). | The cluster's OIDC provider (`AssumeRoleWithWebIdentity`) |
| **EKS Pod Identity** | The newer way: a service account → role association through the EKS API, without an OIDC provider per cluster. | `pods.eks.amazonaws.com` |

Do not confuse the **Lambda execution role** (what the function may do) with the **resource-based policy on the function** (who may invoke the function, e.g., S3 or API Gateway). Likewise, the **task execution role** lets ECS start the task, and the **task role** serves your code.

Trust policy for EKS Pod Identity:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "pods.eks.amazonaws.com" },
    "Action": ["sts:AssumeRole", "sts:TagSession"]
  }]
}
```

Trust policy for IRSA (bound to a specific namespace and service account):

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/oidc.eks.eu-central-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "oidc.eks.eu-central-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:sub": "system:serviceaccount:payments:api",
      "oidc.eks.eu-central-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:aud": "sts.amazonaws.com"
    }
  }
}
```

Without a condition on `:sub`, any pod in the cluster could assume the role. With IRSA and Pod Identity you should also block pods from accessing the node's IMDS (hop limit 1 with IMDSv2); otherwise a pod can take the **node role** credentials.

> **On the exam:** "A container cannot pull an image from a private ECR" = a problem in the **task execution role**. "The application in the container gets AccessDenied on S3" = a problem in the **task role**. "Different pods on the same EKS node need different permissions" = **IRSA or Pod Identity**, never broadening the node role.

### IMDSv2

**Instance Metadata Service v2** requires a session token (a `PUT` request) before reading metadata. This blocks the classic SSRF attack in which an application tricked into making `GET http://169.254.169.254/...` returns the role credentials.

```bash
# Existing instance: IMDSv2 required, hop limit 1 (containers on the host cannot reach IMDS)
aws ec2 modify-instance-metadata-options --instance-id i-0abc123 \
  --http-tokens required --http-put-response-hop-limit 1

# Default for all new instances in the Region
aws ec2 modify-instance-metadata-defaults --http-tokens required
```

At the organization level you enforce it with an SCP: deny `ec2:RunInstances` if `ec2:MetadataHttpTokens` is not `required`. GuardDuty has the finding `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS` when instance credentials are used outside AWS.

## 3.2.3 Vulnerability scanning and runtime monitoring

### Amazon Inspector

**Amazon Inspector** continuously and automatically scans workloads for known CVEs and unintended network exposure. It is enabled per account or centrally through a **delegated administrator** account in Organizations.

| Scan type | What it scans | Notes |
|---|---|---|
| **EC2 scanning** | OS packages and application packages, network reachability. | Agent-based (the SSM Agent must be running) or agentless (EBS snapshot) in **hybrid** mode. |
| **ECR scanning (enhanced)** | Container images in ECR, OS and language packages. | On push + continuous rescanning when a new CVE is published. ECR **basic scanning** is a simpler alternative without continuous monitoring. |
| **Lambda standard scanning** | Dependencies (packages) in the function and layers. | Functions invoked or updated in the last 90 days. |
| **Lambda code scanning** | The function's own code: injection, hardcoded secrets, weak cryptography. | Requires standard scanning to be enabled. |
| **Code Security** | Source code, dependencies, and IaC in GitHub/GitLab repositories. | A newer addition, replacing part of the CodeGuru Security functionality. |

Inspector provides an **Inspector score** (CVSS adjusted for context, e.g., no network exposure → lower risk). Findings go to **Security Hub** and **EventBridge**, so you can automatically route them to ticketing or remediation. For pipelines there is `inspector-sbomgen` and the `inspector-scan:ScanSbom` API, which scans an SBOM before the push.

Note: Inspector does not scan Lambda functions encrypted with a customer managed KMS key.

### GuardDuty Runtime Monitoring

Inspector looks for **known vulnerabilities** (static). **GuardDuty Runtime Monitoring** observes **behavior at runtime**: new binaries being executed, reverse shells, crypto mining, changes in a container, privilege escalation. It works through the **GuardDuty security agent** for:

- **Amazon EKS** (EKS add-on, which GuardDuty can manage automatically),
- **Amazon ECS** on **Fargate** (agent as a sidecar, automatic) and on EC2,
- **Amazon EC2** instances (agent via SSM).

GuardDuty **Malware Protection for EC2** scans EBS volumes (snapshot) when GuardDuty suspects malware; there is also **Malware Protection for S3** for new objects in a bucket.

> **On the exam:** "Continuously detect new CVEs in images and Lambda functions" = **Inspector**. "Detect that a process in a container opened a reverse shell or started a crypto miner" = **GuardDuty Runtime Monitoring**. "A hardcoded secret in a Lambda function's code" = **Inspector Lambda code scanning**.

## 3.2.4 Patch management

### Systems Manager Patch Manager

**Patch Manager** automates scanning for and installing patches on EC2, on-premises servers, and edge devices (managed nodes).

- **Patch baseline**: rules for which patches are considered approved. AWS has **predefined baselines** per OS; you create a **custom baseline** with rules such as "Security, Critical, auto-approve after 7 days", plus lists of explicitly approved and rejected patches.
- **Patch policy** (via **Quick Setup**): centrally, for the entire organization and multiple Regions, defines the schedule, baseline, and operation (Scan or Scan and install). The recommended modern approach.
- **Patch groups** (tag `Patch Group`): the older way of associating a baseline with a group of instances.
- **Maintenance windows**: a time window in which risky operations (installation + reboot) may run, with targets, tasks, rate controls, and an error threshold.
- The **`AWS-RunPatchBaseline`** document with the `Scan` operation (report only) or `Install`.

The result goes to **Systems Manager Compliance** (compliant / non-compliant), and from there to **AWS Config** and Security Hub. Continuous validation: after patching, **Inspector** confirms that the CVE is no longer present.

```bash
# Manually scan the patch status of a group of instances by tag
aws ssm send-command --document-name "AWS-RunPatchBaseline" \
  --targets "Key=tag:Env,Values=prod" \
  --parameters "Operation=Scan"
```

### Immutable approach

For Auto Scaling groups and containers it is often better not to patch in place but to **replace**: Image Builder builds a new AMI, the launch template gets a new version, and an **instance refresh** replaces the instances. For ECS/EKS: a new image, a new deployment.

> **On the exam:** "Install critical security patches on all Windows and Linux instances only on Sundays from 02:00 to 04:00, in all accounts of the organization, with the least effort" = **Patch Manager patch policy (Quick Setup)** + maintenance window. A Lambda function that runs `yum update` over SSH is wrong.

## 3.2.5 Secure administrative access

| Option | How it works | When to choose it |
|---|---|---|
| **Session Manager** | The SSM Agent opens an outbound connection to the SSM service; a shell in the browser or CLI. No inbound ports, no SSH keys. IAM controls who may connect, sessions are logged to S3/CloudWatch Logs and can be encrypted with KMS. | The default choice. Also works in a private subnet via VPC endpoints (`ssm`, `ssmmessages`, `ec2messages`). |
| **EC2 Instance Connect** | IAM-controlled push of a one-time public SSH key valid for 60 seconds. Every push is logged in CloudTrail. | When you specifically need SSH (e.g., a tool that works over SSH). |
| **EC2 Instance Connect Endpoint** | An endpoint in the VPC through which you connect to private instances (SSH/RDP) without a public IP and without a bastion. | Private instances, SSH/RDP needed, no bastion host. |
| **Bastion host** | A public instance with SSH as a jump box. | On the exam almost always a distractor (more maintenance, an open port). |

Session Manager requires: the SSM Agent, an instance profile with `AmazonSSMManagedInstanceCore` (or **Default Host Management Configuration**, which does this at the account level), and a network path to the SSM endpoints. Port forwarding (`AWS-StartPortForwardingSessionToRemoteHost`) enables access to, e.g., an RDS database through an instance without opening ports.

An IAM policy that restricts Session Manager to instances with a specific tag:

```json
{
  "Effect": "Allow",
  "Action": "ssm:StartSession",
  "Resource": "arn:aws:ec2:*:111122223333:instance/*",
  "Condition": { "StringEquals": { "ssm:resourceTag/Team": "${aws:PrincipalTag/Team}" } }
}
```

> **On the exam:** "Remove SSH access, close port 22, and have an audit of all commands" = **Session Manager** with logging to S3/CloudWatch. If an instance "does not appear in Fleet Manager", check three things: the agent, the instance profile, and the network path (VPC endpoints or NAT).

## 3.2.6 Security in the CI/CD pipeline

The goal is to find a vulnerability **before** deployment (shift left):

| Tool | What it does |
|---|---|
| **Amazon Q Developer** | Code review and security scanning in the IDE and in GitHub/GitLab integrations: SAST, secret detection, IaC issues, vulnerable dependencies (SCA), with suggested fixes. |
| **Amazon Inspector** | Scanning images in ECR, SBOM scanning in the pipeline (`inspector-sbomgen`, CI/CD plugins), Code Security for repositories. |
| **Amazon CodeGuru Security** | A SAST service that was intended for pipelines. **AWS ended support on November 20, 2025**; the console and historical findings are no longer available. AWS lists Amazon Q Developer and Amazon Inspector (code security) as replacements. |
| **CodeBuild + third-party tools** | E.g., Trivy, Semgrep, Checkov as build steps; the build fails on critical findings. |

The SCS-C03 exam guide still mentions CodeGuru Security as an example. If it appears in a question, recognize its role as "SAST code scanning in the pipeline", but in practice today you choose Q Developer or Inspector.

A typical pipeline: commit → CodeBuild (unit tests, SAST, IaC scanner) → image build → push to ECR → Inspector scan → **gate** (a Lambda function or a step that reads findings; a critical CVE = stop) → deploy. Pipeline roles (the CodeBuild service role) must be least privilege: the build does not need production permissions.

> **On the exam:** "Developers should get feedback on vulnerabilities in their code while writing it in the IDE" = **Amazon Q Developer**. "Block deployment of images with critical CVEs" = Inspector findings + a gate in the pipeline (EventBridge/Lambda or a step that checks findings).

## 3.2.7 Protecting generative AI applications

### OWASP Top 10 for LLM Applications 2025

| ID | Risk | AWS control (examples) |
|---|---|---|
| **LLM01** | **Prompt Injection** (direct and indirect, e.g., instructions hidden in a document) | Bedrock Guardrails **prompt attack** filter, separating system instructions from user input, input validation. |
| **LLM02** | **Sensitive Information Disclosure** | Guardrails **sensitive information filters** (PII blocking/masking, regex), Macie on source data, least privilege on the knowledge base. |
| **LLM03** | **Supply Chain** | Vetted models and libraries, Inspector on dependencies, access control to models. |
| **LLM04** | **Data and Model Poisoning** | Control who writes to the S3 source for RAG/fine-tuning, versioning, data integrity. |
| **LLM05** | **Improper Output Handling** | Treat model output as untrusted input: escaping, validation before SQL/shell/HTML. |
| **LLM06** | **Excessive Agency** | Least privilege for agents: a minimal action group, a narrow IAM role for the Lambda function, human-in-the-loop (confirmation) for risky actions. |
| **LLM07** | **System Prompt Leakage** | Do not put secrets or authorization rules in the system prompt; authorization is done outside the model. |
| **LLM08** | **Vector and Embedding Weaknesses** | Access control to the vector database, metadata filtering (tenant), encryption. |
| **LLM09** | **Misinformation** | **Contextual grounding** and **Automated Reasoning checks** in Guardrails, source citations. |
| **LLM10** | **Unbounded Consumption** | Quotas and throttling (API Gateway, WAF rate-based), token limits, budget alarms. |

### Amazon Bedrock Guardrails

**Amazon Bedrock Guardrails** evaluates both the **input** (prompt) and the **output** (model response). Policies in a single guardrail:

- **Content filters**: hate, insults, sexual, violence, misconduct, plus **prompt attack** (jailbreak, prompt injection); adjustable strength.
- **Denied topics**: topics the application must not discuss (e.g., investment advice).
- **Word filters**: banned words, profanity.
- **Sensitive information filters**: PII types and your own regex, with a **block** or **mask** (anonymization) action.
- **Contextual grounding checks**: whether the response is grounded in the source and relevant (against hallucinations in RAG).
- **Automated Reasoning checks**: formal verification of responses against defined rules.
- **Image content filters** for multimodal content.

A guardrail is used in `InvokeModel`, `Converse`, and their streaming variants, with Bedrock Agents and Knowledge Bases, and through the **`ApplyGuardrail`** API also independently of the model (e.g., for a model outside Bedrock).

Enforcing a guardrail with IAM, key **`bedrock:GuardrailIdentifier`**:

```json
{
  "Effect": "Deny",
  "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
  "Resource": "arn:aws:bedrock:eu-central-1::foundation-model/*",
  "Condition": {
    "StringNotEquals": {
      "bedrock:GuardrailIdentifier": "arn:aws:bedrock:eu-central-1:111122223333:guardrail/gr-abc123:1"
    }
  }
}
```

### Other controls for GenAI

- **Model invocation logging** (Bedrock) to CloudWatch Logs/S3: inputs and outputs for audit (keep in mind that the logs themselves contain sensitive data, so encrypt them and restrict access).
- A **VPC interface endpoint** for Bedrock (PrivateLink) so that traffic does not go over the internet.
- **Least privilege for agents**: the action group Lambda has a role only for the required APIs; an agent must not have `*`. For actions with consequences, require user confirmation.
- **Access to knowledge base data**: RAG must not bypass authorization. If a user may not see a document, they must not get it through the model either (metadata filtering, separate knowledge bases per tenant).
- Bedrock does not use your prompts and responses to train base models.

> **On the exam:** "The chatbot must not reveal customers' card numbers and email addresses in responses, with the least development" = **Bedrock Guardrails sensitive information filter** (mask/block). "Users try to make the model ignore its instructions" = **prompt attack filter**. "The agent deleted resources because it had an overly broad role" = **Excessive Agency**; the fix is least privilege + confirmation.

## Summary

- Golden AMIs and container images are built automatically (**EC2 Image Builder**, Inspector scan in the pipeline), with IMDSv2, the SSM Agent, and no SSH.
- Credentials for compute always come from a role: **instance profile**, **Lambda execution role**, **ECS task role** (application) vs **task execution role** (agent), **IRSA / Pod Identity** for pods.
- **Inspector** = known vulnerabilities (EC2, ECR, Lambda standard + code scanning, code in repositories); **GuardDuty Runtime Monitoring** = suspicious behavior at runtime (EKS, ECS, EC2).
- **Patch Manager** (baseline, patch policy, maintenance window) for patching, **Compliance** + Inspector for continuous validation; for ASGs and containers choose image replacement.
- **Session Manager** and **EC2 Instance Connect (Endpoint)** replace a bastion and an open port 22; sessions are logged and controlled with IAM.
- In the pipeline: **Amazon Q Developer** and **Inspector** (CodeGuru Security was shut down on November 20, 2025), with a gate that stops deployment.
- GenAI: know the **OWASP Top 10 for LLM 2025**; you enforce **Bedrock Guardrails** (prompt attack, PII mask, denied topics, grounding) with `bedrock:GuardrailIdentifier`; give agents least privilege.
