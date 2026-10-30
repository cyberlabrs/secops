## What this module covers

The module covers two objectives from domain 4:

- **4.2** Investigating AWS activity from **CloudTrail**: compromised credentials, persistence, defense evasion.
- **4.3** Investigating **Kubernetes audit** logs: token abuse, `exec`, privileged workloads, access to secrets.

In module 01 you saw which question each source answers. Here you use them as an investigator: you get an alert or a tip ("a key has leaked", "a pod is behaving strangely") and from the log you reconstruct who did what, in which order and with which credentials.

In practice you get CloudTrail from the trail's S3 bucket (or from CloudTrail Lake / a SIEM), and the Kubernetes audit log from a file on the control plane or from the cloud provider (EKS, AKS, GKE). The commands below use two variables that you set to point at your exports:

```bash
CT=cloudtrail.json      # CloudTrail records
AUDIT=audit.log         # Kubernetes audit, one JSON object per line
```

A CloudTrail file from S3 has the shape `{"Records":[ ... ]}`, while an export from a tool is often one event per line. The filter `.Records[]? // .` works in both cases, so we use it everywhere:

```bash
ct() { jq -c '.Records[]? // .' "$CT"; }      # each event as a single JSON line
ct | wc -l
```

## A CloudTrail record, field by field

A shortened but realistic record of a `CreateAccessKey` call:

```json
{
  "eventVersion": "1.11",
  "userIdentity": {
    "type": "IAMUser",
    "principalId": "AIDAEXAMPLE7QZ3",
    "arn": "arn:aws:iam::111122223333:user/ci-deploy",
    "accountId": "111122223333",
    "accessKeyId": "AKIAEXAMPLECIDEPLOY1",
    "userName": "ci-deploy"
  },
  "eventTime": "2026-10-14T22:41:07Z",
  "eventSource": "iam.amazonaws.com",
  "eventName": "CreateAccessKey",
  "awsRegion": "us-east-1",
  "sourceIPAddress": "198.51.100.77",
  "userAgent": "aws-cli/2.17.0 md/Botocore#1.34.0 os/linux",
  "requestParameters": { "userName": "backup-svc" },
  "responseElements": { "accessKey": { "accessKeyId": "AKIAEXAMPLENEWKEY99", "status": "Active", "userName": "backup-svc" } },
  "requestID": "6c1e…",
  "eventID": "a0f4…",
  "readOnly": false,
  "eventType": "AwsApiCall",
  "managementEvent": true,
  "recipientAccountId": "111122223333",
  "eventCategory": "Management"
}
```

| Field | What it means for an investigation |
|---|---|
| `eventTime` | Always UTC |
| `eventSource` + `eventName` | Service and API call (`iam.amazonaws.com` + `CreateAccessKey`) |
| `userIdentity` | Who called and with which credential (details below) |
| `sourceIPAddress` | Caller's IP; for calls made by an AWS service, the service name or `AWS Internal` |
| `userAgent` | Tool (CLI, SDK, console); easy to spoof, but a change is a signal |
| `errorCode`, `errorMessage` | Present only when the call failed, e.g. `AccessDenied` |
| `requestParameters` | What was requested (user name, policy, bucket) |
| `responseElements` | What was returned for modifications; `null` for read-only calls |
| `readOnly` | `true` for `Describe*`, `List*`, `Get*` |
| `eventCategory` | `Management`, `Data` or `NetworkActivity` |

IAM is a global service, so its events are recorded with `awsRegion` `us-east-1`. If you look for `CreateUser` only in `eu-central-1`, you will not find it.

### userIdentity: who really made the call

| `type` | Credential | Where the name is |
|---|---|---|
| `Root` | Root account | `userName` is the account alias, if one exists |
| `IAMUser` | Long-term key (`AKIA…`) or console password | `userName` |
| `AssumedRole` | Temporary credential from STS (`ASIA…`) | `sessionContext.sessionIssuer.userName` is the role; the session is the last part of `arn` |
| `FederatedUser` | `GetFederationToken` | `sessionContext.sessionIssuer` |
| `AWSService` | An AWS service acting on your behalf | `invokedBy` |

Two fields from `sessionContext` are especially useful:

- `attributes.mfaAuthenticated`: whether the session was created with MFA.
- `attributes.creationDate`: when the temporary credentials were issued. All calls with the same `accessKeyId` (`ASIA…`) belong to the same session.

For a role from an EC2 instance, `arn` looks like `arn:aws:sts::111122223333:assumed-role/web-role/i-0abc123def4567890`: the session name is the instance ID. If such a credential calls the API from an IP address that is not that instance's (or its NAT gateway's), the credential was probably stolen from the instance, most often via the metadata service (ATT&CK **T1552.005**, Cloud Instance Metadata API). GuardDuty reports this as `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration`.

> **In practice:** The first question in any CloudTrail investigation is "which exact credential", not "which user". The user `ci-deploy` can have two keys; if one leaked, you filter by `userIdentity.accessKeyId`, not by name, and only then do you see what the attacker did and what the legitimate pipeline did.

## Basic jq tools for investigation

```bash
# overview: time, who, what, from where, error
ct | jq -r '[.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventSource, .eventName, .sourceIPAddress, (.errorCode // "-")] | @tsv' | sort

# most frequent calls
ct | jq -r '.eventName' | sort | uniq -c | sort -rn | head -20

# which IP addresses and tools use a single key
ct | jq -r 'select(.userIdentity.accessKeyId=="AKIAEXAMPLECIDEPLOY1") | [.sourceIPAddress, .userAgent] | @tsv' | sort | uniq -c

# failed calls only
ct | jq -r 'select(.errorCode) | [.eventTime, .eventName, .errorCode, .sourceIPAddress] | @tsv'

# modifications only (no Describe/List/Get)
ct | jq -r 'select(.readOnly == false) | [.eventTime, .eventName, (.requestParameters|tostring)[0:120]] | @tsv'
```

On a real account you run the same queries via `aws cloudtrail lookup-events` (management events only, 90 days, filtering by a single attribute) or via CloudTrail Lake / Athena over the trail in S3:

```bash
aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAEXAMPLECIDEPLOY1 \
  --start-time 2026-10-14T00:00:00Z --query 'Events[].CloudTrailEvent' --output text | jq -r '.eventName'
```

## Scenario 1: compromised credentials

The typical sequence when an attacker gets hold of a key (from a git repo, a laptop, a CI log):

| Phase | Calls in CloudTrail | ATT&CK |
|---|---|---|
| Key check | `sts:GetCallerIdentity` | T1078.004 Valid Accounts: Cloud Accounts |
| Reconnaissance | `iam:ListUsers`, `iam:ListAttachedUserPolicies`, `iam:GetAccountAuthorizationDetails`, `s3:ListBuckets`, `ec2:DescribeInstances`; often many `AccessDenied` | T1087.004 Account Discovery: Cloud Account, T1580 Cloud Infrastructure Discovery |
| Data access | `s3:GetObject` (only if data events are enabled) | T1530 Data from Cloud Storage |
| Resource abuse | `ec2:RunInstances` of large instances in an unusual region | T1496 Resource Hijacking |

Signs in the log:

- A key that for months called only from a CI runner (one IP address, one `userAgent`) suddenly calls from a new IP address, with a different tool.
- `GetCallerIdentity` as the first call from a new IP address. Legitimate tools rarely call it manually.
- A burst of `AccessDenied` errors in a short time: the attacker is probing what the key is allowed to do.
- Calls in regions the organization does not use.

```bash
# first appearance of each IP address per key
ct | jq -r '[.userIdentity.accessKeyId, .sourceIPAddress, .eventTime] | @tsv' | sort -k1,1 -k3,3 | awk '!seen[$1" "$2]++'

# AccessDenied per IP address and minute
ct | jq -r 'select(.errorCode=="AccessDenied" or .errorCode=="Client.UnauthorizedOperation") | [.sourceIPAddress, .eventTime[0:16]] | @tsv' | sort | uniq -c | sort -rn | head

# regions where the key was active
ct | jq -r 'select(.userIdentity.accessKeyId=="AKIAEXAMPLECIDEPLOY1") | .awsRegion' | sort | uniq -c
```

### Console sign-ins

```json
{
  "eventSource": "signin.amazonaws.com",
  "eventName": "ConsoleLogin",
  "userIdentity": { "type": "IAMUser", "userName": "ana" },
  "sourceIPAddress": "203.0.113.50",
  "responseElements": { "ConsoleLogin": "Success" },
  "additionalEventData": { "MFAUsed": "No", "LoginTo": "https://console.aws.amazon.com/…" }
}
```

Success or failure is in `responseElements.ConsoleLogin`, and MFA in `additionalEventData.MFAUsed`. When the user name was mistyped, CloudTrail writes `HIDDEN_DUE_TO_SECURITY_REASONS` in its place, because it might contain a password.

```bash
ct | jq -r 'select(.eventName=="ConsoleLogin") | [.eventTime, .userIdentity.type, (.userIdentity.userName // "-"), .sourceIPAddress, .responseElements.ConsoleLogin, (.additionalEventData.MFAUsed // "-")] | @tsv'
```

A `Root` sign-in without MFA is an alert in itself.

## Scenario 2: persistence

The attacker knows the stolen key will be revoked, so they create new ways back in.

| Call | What it achieves | ATT&CK |
|---|---|---|
| `iam:CreateUser` | A new IAM user | T1136.003 Create Account: Cloud Account |
| `iam:CreateAccessKey` for another user | An additional key, often on a service account nobody watches | T1098.001 Additional Cloud Credentials |
| `iam:CreateLoginProfile`, `iam:UpdateLoginProfile` | A console password for an existing user | T1098.001 |
| `iam:AttachUserPolicy`, `iam:PutUserPolicy`, `iam:AddUserToGroup` | Privilege escalation (e.g. `AdministratorAccess`) | T1098.003 Additional Cloud Roles |
| `iam:UpdateAssumeRolePolicy` | The role's trust policy allows a foreign account | T1098.003 |
| `ec2:ImportKeyPair`, `ec2:CreateKeyPair` | An SSH key for new instances | T1098 |
| `lambda:CreateFunction` + trigger | Code that runs on its own | (depends on the trigger) |

The key detail: for `CreateAccessKey`, the caller is in `userIdentity` and the target in `requestParameters.userName`. When the two differ, someone is creating a key for someone else.

```bash
# IAM changes: who -> on whom
ct | jq -r 'select(.eventSource=="iam.amazonaws.com" and .readOnly==false)
  | [.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventName, (.requestParameters.userName // .requestParameters.roleName // "-"), (.requestParameters.policyArn // "-")] | @tsv'

# keys created for another user
ct | jq -r 'select(.eventName=="CreateAccessKey" and .requestParameters.userName != null and .requestParameters.userName != .userIdentity.userName)
  | [.eventTime, .userIdentity.userName, .requestParameters.userName, .responseElements.accessKey.accessKeyId] | @tsv'
```

The new `accessKeyId` from `responseElements` is the next lead: filter by it and you see what the attacker did with the new key.

> **In practice:** When revoking, it is not enough to deactivate the leaked key. Extract from CloudTrail everything that credential created (users, keys, login profiles, policies, roles, key pairs, functions) and revoke each of those artifacts. An attacker who created a second key survives the revocation of the first.

## Scenario 3: defense evasion

Before serious actions, the attacker tries to turn off whatever is watching them (ATT&CK **T1562.008** Impair Defenses: Disable or Modify Cloud Logs, and T1562.001 for security tools).

| Call | Effect |
|---|---|
| `cloudtrail:StopLogging` | The trail stops logging |
| `cloudtrail:DeleteTrail` | The trail is deleted |
| `cloudtrail:UpdateTrail` | E.g. redirected to someone else's bucket, or multi-region turned off |
| `cloudtrail:PutEventSelectors` | Management or data events turned off |
| `guardduty:DeleteDetector`, `guardduty:UpdateDetector` | GuardDuty disabled or suspended |
| `config:StopConfigurationRecorder` | AWS Config stops recording changes |
| `ec2:DeleteFlowLogs` | No more network logs |
| `s3:PutBucketLifecycleConfiguration` on the log bucket | Logs get deleted quickly |

```bash
ct | jq -r 'select(.eventName | test("^(StopLogging|DeleteTrail|UpdateTrail|PutEventSelectors|DeleteDetector|UpdateDetector|StopConfigurationRecorder|DeleteFlowLogs)$"))
  | [.eventTime, (.userIdentity.userName // .userIdentity.arn), .eventName, .sourceIPAddress, (.errorCode // "OK")] | @tsv'
```

`StopLogging` is recorded in the trail itself (the last event before the silence). If the call succeeded, you see what followed only if there is another trail, e.g. an **organization trail** from the management account that the member account cannot turn off, or if **CloudTrail Lake**/GuardDuty had its own copy.

You verify the integrity of the files themselves with digest files (if log file integrity validation is enabled):

```bash
aws cloudtrail validate-logs --trail-arn arn:aws:cloudtrail:eu-central-1:111122223333:trail/org-trail \
  --start-time 2026-10-14T00:00:00Z
```

The same detection in KQL (Sentinel table `AWSCloudTrail`) is short:

```text
AWSCloudTrail
| where EventName in ("StopLogging","DeleteTrail","UpdateTrail","PutEventSelectors")
| project TimeGenerated, UserIdentityArn, EventName, SourceIpAddress, ErrorCode
```

## A Kubernetes audit record, field by field

One line from the audit log (formatted):

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "5b3f…",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/prod/secrets/db-credentials",
  "verb": "get",
  "user": {
    "username": "system:serviceaccount:prod:web",
    "groups": ["system:serviceaccounts", "system:serviceaccounts:prod", "system:authenticated"],
    "extra": {
      "authentication.kubernetes.io/pod-name": ["web-7d9c5b-x2kqp"],
      "authentication.kubernetes.io/node-name": ["worker-2"],
      "authentication.kubernetes.io/credential-id": ["JTI=1f0c…"]
    }
  },
  "sourceIPs": ["10.244.2.17"],
  "userAgent": "curl/8.5.0",
  "objectRef": { "resource": "secrets", "namespace": "prod", "name": "db-credentials", "apiVersion": "v1" },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-10-15T08:02:11.120394Z",
  "stageTimestamp": "2026-10-15T08:02:11.124001Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": "RBAC: allowed by RoleBinding \"web-read\" of Role \"web-read\" to ServiceAccount \"web/prod\""
  }
}
```

| Field | What it means for an investigation |
|---|---|
| `user.username` | Identity: a user from a certificate/OIDC or `system:serviceaccount:<ns>:<name>` |
| `user.extra` | For a bound service account token: the pod and node the token was issued to, the token ID (`JTI`) |
| `impersonatedUser` | Present when someone used `--as` (impersonation) |
| `verb` | `get`, `list`, `watch`, `create`, `update`, `patch`, `delete` |
| `objectRef` | `resource`, `subresource` (`exec`, `log`, `token`…), `namespace`, `name` |
| `sourceIPs` | Only the last address is reliable; the client can set the others via `X-Forwarded-For` |
| `userAgent` | Client (`kubectl/v1.34…`, `curl`); not reliable, but `curl` from a pod is a signal |
| `responseStatus.code` | 200/201 success, 403 denied by RBAC, 401 failed authentication |
| `annotations` | Authorization decision and reason, admission controller decisions (e.g. Pod Security) |
| `requestObject` | Request body, only at the `Request` and `RequestResponse` levels |
| `stage` | For an investigation look at `ResponseComplete`; `RequestReceived` is a duplicate without the response |

The audit policy determines what you see at all. For this investigation, `pods` (create) need to be at least at the `Request` level so that the `securityContext` fields are visible, and `secrets` only at `Metadata`. At a higher level, secret values would end up in the log.

```bash
au() { jq -c 'select(.stage=="ResponseComplete")' "$AUDIT"; }

# overview: time, who, verb, resource, name, code
au | jq -r '[.requestReceivedTimestamp, .user.username, .verb, (.objectRef.resource // "-") + "/" + (.objectRef.subresource // ""), (.objectRef.namespace // "-"), (.objectRef.name // "-"), .responseStatus.code] | @tsv'
```

## Scenario 4: exec into a pod

`kubectl exec` is a legitimate tool, but also an attacker's tool (ATT&CK **T1609** Container Administration Command). The command is visible in `requestURI` as `command=` parameters:

```text
"requestURI": "/api/v1/namespaces/prod/pods/web-7d9c5b-x2kqp/exec?command=sh&command=-c&command=cat+%2Fvar%2Frun%2Fsecrets%2Fkubernetes.io%2Fserviceaccount%2Ftoken&container=web&stdin=true&stdout=true"
```

The verb is not always the same: older clients open exec via `create` (SPDY), while newer `kubectl` uses WebSocket, which in some versions is logged as `get`. That is why detection should look at `objectRef.subresource`, not at the verb.

```bash
au | jq -r 'select(.objectRef.subresource=="exec" or .objectRef.subresource=="attach")
  | [.requestReceivedTimestamp, .user.username, .verb, .objectRef.namespace, .objectRef.name, .sourceIPs[-1], .responseStatus.code, (.requestURI | capture("(?<c>command=[^&]*(&command=[^&]*)*)").c // "-")] | @tsv'
```

Questions to ask: who is it (a human with an OIDC identity, or a service account from another pod?), in which namespace (exec in `kube-system`, or in production outside an incident), and what was run (a shell, reading the token, `curl` to the metadata service).

## Scenario 5: service account token abuse

In a compromised pod, the attacker reads the token from `/var/run/secrets/kubernetes.io/serviceaccount/token` and calls the API (ATT&CK **T1528** Steal Application Access Token, **T1552.007** Unsecured Credentials: Container API). Traces:

- `user.username` is a service account, while `userAgent` is `curl` or `kubectl`, not the application's library.
- `sourceIPs` is not the IP of the pod from `user.extra` (`pod-name`) but some other address: the token was taken out of the cluster.
- Permission reconnaissance: `create` on `selfsubjectrulesreviews` or `selfsubjectaccessreviews` (that is `kubectl auth can-i --list`), followed by a burst of 403 responses.
- Access to resources that this service account otherwise never touches.

```bash
# what service accounts do, and with which tool
au | jq -r 'select(.user.username | startswith("system:serviceaccount:")) | [.user.username, .userAgent, .verb, .objectRef.resource] | @tsv' | sort | uniq -c | sort -rn

# 403 per user: who is probing the boundaries
au | jq -r 'select(.responseStatus.code==403) | .user.username' | sort | uniq -c | sort -rn

# permission checks
au | jq -r 'select(.objectRef.resource | test("selfsubject(rules|access)reviews")) | [.requestReceivedTimestamp, .user.username, .sourceIPs[-1]] | @tsv'

# who was issued new tokens (TokenRequest)
au | jq -r 'select(.objectRef.resource=="serviceaccounts" and .objectRef.subresource=="token") | [.requestReceivedTimestamp, .user.username, .objectRef.namespace, .objectRef.name] | @tsv'
```

`authentication.kubernetes.io/credential-id` (`JTI=…`) links all requests made with one token, and the same JTI appears in the `authentication.kubernetes.io/issued-credential-id` annotation on the request that issued the token. This lets you follow a token from issuance to abuse.

Two more identities always deserve an alert: `system:anonymous` with a 200 response (anonymous access to anything other than `/healthz` and the like) and any request with `impersonatedUser`, unless you use impersonation deliberately.

> **In practice:** Prepare a list of "normal" service account → resource pairs from a week without incidents (`sort | uniq -c` above). During an investigation, a diff against that list reveals an anomaly faster than reading thousands of lines.

## Scenario 6: privileged workloads and secrets

A pod with `privileged: true`, `hostPID`, `hostNetwork` or a `hostPath` mount of `/` is a path for escaping to the node (ATT&CK **T1611** Escape to Host; creating the container is **T1610** Deploy Container). If the pod is created outside the GitOps flow, by a user who does not normally deploy, it is an incident.

```bash
au | jq -r 'select(.objectRef.resource=="pods" and .verb=="create" and .requestObject != null)
  | select(
      ([.requestObject.spec.containers[]?.securityContext.privileged] | any)
      or .requestObject.spec.hostPID == true or .requestObject.spec.hostNetwork == true
      or ([.requestObject.spec.volumes[]?.hostPath.path] | any(. == "/")))
  | [.requestReceivedTimestamp, .user.username, .objectRef.namespace, (.requestObject.metadata.name // .objectRef.name // "-"), .responseStatus.code, (.annotations["pod-security.kubernetes.io/enforce-policy"] // "-")] | @tsv'
```

A 403 response with a Pod Security admission annotation means the control stopped the attempt; it is still a valuable lead, because it shows intent.

Access to secrets (ATT&CK **T1552.007**):

```bash
# who reads or lists secrets, and where
au | jq -r 'select(.objectRef.resource=="secrets" and (.verb=="get" or .verb=="list" or .verb=="watch"))
  | [.user.username, .verb, (.objectRef.namespace // "*"), (.objectRef.name // "*")] | @tsv' | sort | uniq -c | sort -rn
```

A `list` on secrets across all namespaces (`objectRef.namespace` empty) by a user that is not a controller is especially suspicious: a single request returns every secret in the cluster.

RBAC persistence resembles IAM persistence in AWS: a new `ClusterRoleBinding` to `cluster-admin`, a new service account with a token, a change to an existing role.

```bash
au | jq -r 'select((.objectRef.resource=="clusterrolebindings" or .objectRef.resource=="rolebindings") and (.verb=="create" or .verb=="update" or .verb=="patch"))
  | [.requestReceivedTimestamp, .user.username, .verb, .objectRef.name, (.requestObject.roleRef.name // "-")] | @tsv'
```

> **In practice:** On EKS, the Kubernetes audit log and CloudTrail are joined through identity: an IAM role mapped to a Kubernetes user (access entries or aws-auth) appears in `user.username`/`user.extra`, and the same role appears in CloudTrail. An attacker with a stolen AWS credential often ends up in the cluster, and vice versa, so keep one shared timeline.

## From findings to a timeline

An investigation ends with a timeline, not a list of queries. Merge the relevant events into one format (UTC, who, what, on what, from where, result):

```bash
{
  ct | jq -r 'select(.userIdentity.accessKeyId=="AKIAEXAMPLECIDEPLOY1" or .userIdentity.accessKeyId=="AKIAEXAMPLENEWKEY99")
    | [.eventTime, "aws", (.userIdentity.userName // .userIdentity.arn), .eventName, (.requestParameters|tostring)[0:60], .sourceIPAddress, (.errorCode // "OK")] | @tsv'
  au | jq -r 'select(.user.username=="system:serviceaccount:prod:web")
    | [.requestReceivedTimestamp[0:19] + "Z", "k8s", .user.username, .verb + " " + (.objectRef.resource // ""), (.objectRef.name // "-"), .sourceIPs[-1], (.responseStatus.code|tostring)] | @tsv'
} | sort > /root/hronologija.tsv
column -t -s $'\t' /root/hronologija.tsv | less -S
```

For each row in the timeline, also record what it means (reconnaissance, persistence, data access) and its ATT&CK ID. That table is the input to the containment phase (module 10) and to the post-incident report.

## Summary

- CloudTrail answers "who, with which credential, from where called which API"; drive the investigation by `userIdentity.accessKeyId`, not just by user name. IAM events are in `us-east-1`.
- `AKIA…` is a long-term key, `ASIA…` a temporary one (STS); `sessionContext` gives the role, MFA and the session issue time.
- A compromised credential shows up as a new IP address and tool, `GetCallerIdentity`, a burst of `AccessDenied` and unusual regions (T1078.004, T1087.004).
- Persistence: `CreateUser`, `CreateAccessKey` for someone else, `CreateLoginProfile`, `AttachUserPolicy`, `UpdateAssumeRolePolicy`; every artifact created gets revoked.
- Defense evasion: `StopLogging`, `DeleteTrail`, `PutEventSelectors`, `DeleteDetector` (T1562.008); an organization trail and digest file validation preserve the evidence.
- Kubernetes audit: look at `ResponseComplete`, `user`, `verb`, `objectRef`, `sourceIPs[-1]`, `responseStatus.code` and the authorization annotations; search for exec by `subresource`, not by verb.
- Token abuse shows up as a service account using `curl`/`kubectl`, an IP outside the pod, `selfsubjectrulesreviews` and 403s; privileged pods require the `Request` level for `pods`, while secrets must stay at `Metadata` only.
