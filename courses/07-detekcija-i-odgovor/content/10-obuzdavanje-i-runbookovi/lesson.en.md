## What this module covers

The module covers two objectives from domain 6:

- **6.3** **Containment**, **eradication** and **recovery** for hosts, containers and cloud accounts.
- **6.4** **Runbooks** for common incidents: leaked keys and tokens, cryptominers, exposed storage; **post-incident review**.

After this module you will know:

- how to choose a containment strategy and what you give up in doing so;
- concrete steps for a Linux host, Docker/Kubernetes and an AWS/Azure account;
- what a runbook looks like that an on-call engineer can execute without improvising;
- how to run a post-incident review that produces measurable improvements.

The starting point is module 09: the incident has been declared and triaged, and volatile evidence has been collected.

## Containment strategy

NIST SP 800-61r3 defines **containment** (RS.MI-01) as preventing the incident from spreading, and **eradication** (RS.MI-02) as removing its effects: persistence, entry points, compromised accounts and exploited vulnerabilities. **Recovery** (RC.RP) returns systems to normal operation and confirms they are working correctly.

Every decision has a cost. r3 states it explicitly (RS.MA-03): rapid recovery has to be balanced against the need to observe the attacker or to conduct a thorough investigation.

| Question | Why it matters |
|---|---|
| Is the attacker still active? | If so, and the damage is growing (data exfiltration, encryption), contain immediately |
| Do we know the scope? | If you contain one host while the attacker holds three more, you have tipped them off and lost visibility |
| Has volatile evidence been collected? | Isolation and shutdown destroy memory and connections |
| What does a service outage cost? | The asset owner and management decide about critical services |
| How long does the measure last? | Emergency measure for hours, temporary for days, permanent fix |

Types of measures:

- **Short-term containment:** host isolation, key deactivation, IP blocking. Fast, blunt, reversible.
- **Long-term containment:** temporary solutions until the system is rebuilt (stricter network policies, additional monitoring, rotation of all credentials in the domain).
- **Observation** (redirecting the attacker into a sandbox and monitoring them): r3 requires discussing this with legal counsel first, because deliberately delaying containment carries risk.

Automated containment (Wazuh active response from module 04, Defender "Isolate device" in SC-200) is useful for clear, frequent cases. r3 recommends that handlers always be able to choose measures manually as well. Automation that isolates a host because of a false positive is itself an availability incident.

> **In practice:** as a rule, you contain **in a single move** for all known footholds: all compromised keys, all accounts, all hosts at the same time. If the attacker sees that one access path has been taken away, they will use the remaining ones to cover their tracks or speed up the attack. So map the scope as well as you can before the first move.

## Linux host

### Containment

First save the current firewall state, then allow only the IR workstation, and only then close everything else. The reverse order locks you out of your own session.

```bash
IR=10.10.0.5                                         # IR workstation address
iptables-save > /root/ir/iptables-before-$(date -u +%Y%m%dT%H%MZ).rules

iptables -I INPUT 1  -i lo -j ACCEPT
iptables -I OUTPUT 1 -o lo -j ACCEPT
iptables -I INPUT 2  -s $IR -j ACCEPT
iptables -I OUTPUT 2 -d $IR -j ACCEPT
iptables -P INPUT DROP; iptables -P OUTPUT DROP; iptables -P FORWARD DROP

iptables -S                                          # check: DROP policies, exceptions for lo and IR
```

iptables evaluates every packet, so this also cuts the attacker's already established connections (except to the IR address). Keep this difference in mind in the cloud, where security groups track connections (see below).

Account and processes:

```bash
U=marko
usermod -L "$U"                    # lock the password
chage -E 0 "$U"                    # account expired: even an SSH key no longer works
pkill -STOP -u "$U"                # freeze the user's processes (memory is preserved for forensics)
# after evidence has been collected:
pkill -KILL -u "$U"

kill -STOP 4242                    # suspicious process: freeze it, don't kill it right away
```

`SIGSTOP` stops a process without losing its memory and open files, so forensics can still read `/proc/4242/`. `kill -9` is final.

### Eradication

Remove everything the attacker left behind, based on the live response findings:

```bash
userdel -r sysupdate                                   # account the attacker created
crontab -r -u www-data                                 # cron job they added (saved in the evidence)
sed -i '/attacker@kali/d' /home/marko/.ssh/authorized_keys
systemctl disable --now sysupdate.service; rm /etc/systemd/system/sysupdate.service
```

But: on a compromised host you are never sure you have found everything. A rootkit, a modified binary or other persistence may remain. The rule for serious incidents is to **rebuild** from a known-good image, not to clean up. Cleanup is acceptable when the scope is fully known and small (e.g. a single cron entry without root access).

Eradication always includes the **entry point** too: patching the vulnerability, disabling SSH password authentication (`PasswordAuthentication no`), rotating credentials that were on the host (keys in `~/.aws/`, tokens in environment variables, SSH keys).

### Recovery

- A new host from an image or Terraform/Ansible code, patched.
- Data from backups whose integrity has been verified (RC.RP-03): a backup taken before the first trace of compromise, scanned before use.
- Enhanced monitoring for several weeks: lower thresholds, additional Wazuh rules for the IOCs from this incident.
- The system owner confirms operation (RC.RP-04, RC.RP-05), and the end of recovery is formally declared (RC.RP-06).

## Containers and Kubernetes

### Docker

| Action | Command | Effect |
|---|---|---|
| Freeze | `docker pause <c>` | Processes stopped (cgroup freezer), memory preserved |
| Disconnect from the network | `docker network disconnect <network> <c>` | Container without network, still running |
| Changes relative to the image | `docker diff <c>` | List of added (A), changed (C), deleted (D) files |
| Filesystem copy | `docker export <c> -o c.tar && sha256sum c.tar` | Evidence, with a hash |
| Don't | `docker rm -f <c>` | Deletes the filesystem and processes, i.e. the evidence |

### Kubernetes

The goal is to isolate the pod while the service keeps running and the pod is preserved for forensics.

```bash
NS=shop; POD=web-7d9c8b6f5-abcde

# 1) evidence (module 09): YAML, logs, node
kubectl -n $NS get pod $POD -o yaml > $POD.yaml
kubectl -n $NS logs $POD --all-containers --timestamps > $POD.log

# 2) remove the pod from the ReplicaSet and Service by changing labels; the ReplicaSet creates a new, clean pod
kubectl -n $NS label pod $POD app- quarantine=true --overwrite

# 3) network isolation of quarantined pods
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quarantine
  namespace: shop
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes: [Ingress, Egress]
EOF

# 4) the node accepts no new pods until it has been checked
kubectl cordon $(kubectl -n $NS get pod $POD -o jsonpath='{.spec.nodeName}')
```

Notes:

- The `app` label must be the one used by the Deployment's and Service's selector; check with `kubectl get rs -o wide`.
- A NetworkPolicy with no `ingress`/`egress` rules blocks all traffic of the selected pods, but only if the CNI supports NetworkPolicy. Some CNIs don't cut already established connections immediately; verify this.
- Compromised **ServiceAccount**: remove the RoleBinding/ClusterRoleBinding that grants it permissions. Bound tokens remain valid until they expire or until the object they are bound to (the pod) is deleted, so deleting the pod after collecting evidence also invalidates its token. Legacy tokens from Secret objects (type `kubernetes.io/service-account-token`) are invalidated by deleting the Secret.
- Compromised cluster user: remove the binding, rotate credentials (a kubeconfig certificate cannot be revoked individually; that is why people should access the cluster through OIDC).

Eradication for containers means: fix the **image** and its source (Dockerfile, dependencies), build a new one, deploy it by **digest**, and verify that admission controls (CKS course) prevent a recurrence (e.g. banning privileged pods, allowing only signed images). Restarting the old pod brings back the same vulnerability.

> **In practice:** a `quarantine=true` label + a NetworkPolicy deployed in advance in every namespace turns pod isolation into a single command. Prepare this **before** an incident, as part of the platform. The same goes for a runbook that knows which labels each Deployment's selector uses.

## Cloud accounts

### AWS

**IAM user with an access key:**

```bash
aws iam update-access-key --user-name ci-deploy --access-key-id AKIAEXAMPLEKEY123456 --status Inactive
aws iam list-access-keys --user-name ci-deploy                    # are there other keys?
aws iam attach-user-policy --user-name ci-deploy --policy-arn arn:aws:iam::aws:policy/AWSDenyAll
aws iam delete-login-profile --user-name ci-deploy 2>/dev/null    # console access, if any
```

Deactivation (`Inactive`) is reversible and preserves the key for the investigation; deletion comes later.

**Temporary credentials (roles, STS):** these cannot be deleted. The solution is a policy that denies all requests made with tokens issued before a certain point in time. The **Revoke active sessions** option in the IAM console for a role does exactly that: it adds the inline policy `AWSRevokeOlderSessions` with an `aws:TokenIssueTime` condition. If the attacker has keys with which they can assume the role again, contain those first.

**EC2 instance:**

| Step | Why |
|---|---|
| Enable termination protection, add a tag (e.g. `ir-case=IR-2026-031`) | So nobody deletes it; so everyone knows its status |
| EBS snapshot of all volumes | Disk evidence; the snapshot is shared with the forensics account |
| Detach it from the Auto Scaling group and load balancer | So the ASG doesn't "repair" the instance and it receives no traffic |
| Replace all security groups with an isolation group | New traffic blocked |
| NACL deny on the subnet, if needed | Security groups track connections: **existing tracked connections are not interrupted** by changing the group |
| Block DNS if egress must be prevented | Security groups and NACLs don't filter traffic to the Route 53 Resolver |

**At the organization level:** an SCP that denies all actions in the compromised account, except for the IR role, is the bluntest and strongest measure.

### Azure and Entra ID

| Situation | Measure |
|---|---|
| Compromised user | Disable the account (`az ad user update --id <upn> --account-enabled false`), revoke sessions (Microsoft Graph `revokeSignInSessions`), reset the password, review MFA methods the attacker may have added |
| Compromised service principal | Remove secrets and certificates (`az ad sp credential list/delete`), review assigned roles |
| VM | NSG that allows only IR, disk snapshots |

Defender XDR (SC-200) has "Isolate device" and "Disable user"/"Contain user" actions; Sentinel automates the same steps through playbooks.

> **In practice:** in the cloud, attackers often establish **persistence in IAM**: a new user, a new access key for an existing user, a new role with a trust policy pointing to their account, a new application in Entra ID. Deactivating the original key doesn't solve that. Eradication in the cloud therefore always includes reviewing all `Create*`, `Attach*`, `Put*Policy` and `UpdateAssumeRolePolicy` events from CloudTrail (module 02) during the incident window.

## Runbooks

A runbook is a technical procedure for a single task. A good runbook always has the same parts:

```text
Name / version / owner / date of last test
Trigger: which alert or report starts the runbook
Prerequisites: roles, access, tools (verified that the on-call engineer has them)
Steps: numbered, with commands and the expected result of each step
Decisions: where to escalate, who approves risky steps
Verification: how you know a step succeeded
Evidence: what is preserved before destructive steps
Communication: whom to notify and when
Closure: criteria for completion; what goes into the report
```

### Runbook 1: leaked AWS access key

**Trigger:** a gitleaks/push protection finding in a public repo, an AWS Health/Support notification, a GuardDuty finding for unusual key usage.

1. **Identify the key and its owner.** `aws iam list-access-keys --user-name <u>`; if you don't know the user: `aws iam get-access-key-last-used --access-key-id <AKIA…>`.
2. **Deactivate the key** (`update-access-key --status Inactive`). Revocation always comes before everything else.
3. **Investigate its usage** in CloudTrail for that `AccessKeyId`:

```bash
CT=cloudtrail.json      # CloudTrail export for the incident period
K=AKIAEXAMPLEKEY123456
jq -r --arg k "$K" '.Records[] | select(.userIdentity.accessKeyId==$k) |
   [.eventTime, .eventSource, .eventName, .sourceIPAddress, (.errorCode // "OK")] | @tsv' "$CT" | sort

# actions that create persistence or disable logging
jq -r --arg k "$K" '.Records[] | select(.userIdentity.accessKeyId==$k) |
   select(.eventName | test("^(Create|Attach|Put|Update|Delete|Stop)")) |
   [.eventTime, .eventName, (.requestParameters | tostring)[0:120]] | @tsv' "$CT"
```

4. **Remove the persistence** the attacker created (new users, keys, roles, policies), and stop the resources they launched (EC2, Lambda) only after taking a snapshot.
5. **Rotate:** issue a new credential or, better, replace the long-lived key with an OIDC role for CI. Migrate the services, then delete the old key.
6. **Clean the source:** remove the secret from the code (DevSecOps course, module 03), add pre-commit hooks and push protection.
7. **Closure:** no key activity after deactivation, all attacker resources removed, findings in the report.

**Variant for a Kubernetes or GitLab token:** the same order. Revocation (deleting the Secret or binding, revoking the PAT), investigation in the audit log (`user.username`, `verb`, `objectRef.resource` in the Kubernetes audit log), removal of persistence (new ServiceAccounts, RoleBindings, CronJobs), rotation.

### Runbook 2: cryptominer in a container

**Trigger:** a Falco alert (e.g. `Drop and execute new binary in container`, a custom rule for connections to known mining ports or `stratum+tcp` on the command line), a sudden CPU spike on a node, a GuardDuty cryptocurrency finding, the cloud bill.

1. **Confirm:** which pod, which node, which image (`container.image.repository` from the Falco alert), which process and connection.
2. **Evidence:** pod YAML, logs, `docker diff` / `crictl` on the node, `/proc/<pid>/` of the suspicious process, Falco and audit alerts for that container.
3. **Contain:** quarantine label + NetworkPolicy (egress to the pool stops), `cordon` the node if needed.
4. **Find the entry point:** a vulnerable application (RCE), an exposed dashboard or unauthenticated API, a compromised ServiceAccount token, a malicious image from a public registry? The Kubernetes audit log shows who created the pod (`create` on `pods`, `user.username`).
5. **Eradicate:** fix the image or configuration, remove everything the attacker created (Deployments, DaemonSets, CronJobs in all namespaces), rotate the tokens and secrets the pod could read.
6. **Recover:** a new pod from the fixed image by digest; verify that CPU and outbound connections look normal.
7. **Closure:** a cryptominer is financial damage, but also a sign that the attacker had code execution; assess whether they could have done something else as well (access to secrets, to the metadata service).

### Runbook 3: publicly exposed S3 bucket

**Trigger:** an AWS Config/Security Hub finding, Access Analyzer, a third-party report.

1. **Close access immediately:**

```bash
B=kurs-shop-exports
aws s3api put-public-access-block --bucket $B --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api get-bucket-policy-status --bucket $B           # IsPublic must be false
```

2. **Preserve the state before the change** (if not already done): `get-bucket-policy`, `get-bucket-acl`, the policy version from CloudTrail (`PutBucketPolicy`, `PutBucketAcl`, `DeletePublicAccessBlock`), who made the bucket public and when.
3. **Determine whether anyone accessed it:** S3 server access logs or CloudTrail **data events** (`GetObject`, `ListObjects`) for the bucket, with IP addresses outside the organization. Without data events or access logs the answer is "we don't know", and it must be reported that way.
4. **Determine what was exposed:** the content and classification of the data (e.g. Amazon Macie). Personal data means involving legal counsel and possible obligations to notify the regulator.
5. **Prevent recurrence:** account-level Block Public Access (`aws s3control put-public-access-block --account-id …`), an SCP that prevents disabling it, an IaC check in the pipeline.

> **In practice:** "we don't know whether anyone accessed it" is a common and uncomfortable answer for exposed storage, because data events and access logs are not enabled by default. That is a finding for the post-incident review: enable them in advance for buckets with sensitive data, before the next incident.

## Post-incident review

A **post-incident review** (lessons learned) is an input to **ID.IM** in CSF 2.0. The goal is improvement, not a culprit.

Rules:

- **Blameless:** you ask "what in the system made the error possible", not "who is to blame". People who fear punishment hide information.
- **Fast:** within one to two weeks, while the details are still remembered. r3 adds that lessons should be shared as soon as they are learned, even during the incident.
- **Fact-based:** the timeline from module 09, with sources.
- **With action owners:** every action has a responsible person and a due date, and is tracked as a ticket.

Report structure:

```text
IR-2026-031 Compromised SSH account on a lab host (P1)
Summary: 3-4 sentences for management
Timeline (UTC): first trace, detection, declaration, containment, eradication, end of recovery
Impact: systems, data, duration, costs
Root cause and contributing factors: password without MFA, SSH passwords allowed, alert 5763 level 10 without escalation
What went well: Wazuh 5902 caught the new account within 1 min, live response script
What didn't: alert sat in the queue for 13 min without triage, runbook required access the on-call engineer didn't have
Metrics: MTTD 2 min, time to triage 13 min, time to containment 41 min
Actions: (owner, due date, ticket)
  - PasswordAuthentication no on all hosts (platform, 2026-10-21, SEC-430)
  - 5763 + 5715 correlation -> level 12, pager (detections, 2026-10-18, SEC-431)
  - purple test T1110 + T1136 in the next cycle (detections, 2026-11-11, SEC-432)
  - IR role for on-call engineers (IAM, 2026-10-17, SEC-433)
```

Metrics tracked across incidents:

| Metric | From → to |
|---|---|
| **MTTD** (mean time to detect) | First trace of the attack → alert |
| **MTTA** (acknowledge) | Alert → analyst picks it up |
| **MTTC** (contain) | Declaration → containment |
| **MTTR** (recover) | Declaration → end of recovery |

Every detection gap found in the review becomes an item in the purple team cycle (module 08), and every runbook step that didn't work becomes a runbook change with a new test. This closes the loop: incident → lesson → detection or procedure → test.

## Summary

- Containment (RS.MI-01) stops the spread, eradication (RS.MI-02) removes persistence and the entry point, recovery (RC.RP) restores and verifies systems; every measure balances speed, evidence and observing the attacker.
- Contain in a single move for all known footholds; automation is useful, but the handler must be able to choose manually.
- Linux: iptables isolation with an exception for IR (also cuts existing connections), `usermod -L`, `chage -E 0`, `kill -STOP`; for serious incidents, rebuild instead of cleanup.
- Containers: `docker pause`, `docker diff`, `docker export`; in Kubernetes a quarantine label (removal from the ReplicaSet and Service) + a deny-all NetworkPolicy, `cordon`, removing bindings; fixing the image and deploying by digest.
- AWS: key deactivation, `AWSDenyAll`, revoking role sessions (`aws:TokenIssueTime`), EC2 snapshot and an isolation security group (tracked connections persist, hence the NACL), DNS bypasses SG/NACL. Entra: disable the account and revoke sessions.
- Runbook: trigger, prerequisites, numbered steps with verification, decisions, evidence, communication, closure; for a key, revocation first; for storage, Block Public Access first; for a cryptominer, also the entry point.
- The post-incident review is blameless, with a timeline, metrics (MTTD, MTTC, MTTR) and actions with an owner and due date; findings feed into ID.IM and the next purple team cycle.
