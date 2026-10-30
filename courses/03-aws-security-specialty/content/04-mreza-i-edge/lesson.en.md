## Exam objectives: 3.1 and 3.3

Domain 3 (**Infrastructure Security**) carries 18% of the scored content. This module covers two of its three tasks (compute is in a separate module):

- **3.1** network edge controls: threat-based strategy, CloudFront headers, AWS WAF, AWS IoT policies, protection against the OWASP Top 10, S3 CORS, Shield Advanced, geography-based rules, rate limiting, client fingerprinting, integrations (OCSF, third-party WAF rules),
- **3.3** network controls: security groups, NACLs, AWS Network Firewall, hybrid connectivity (Site-to-Site VPN, Direct Connect, MACsec), AWS Verified Access, segmentation (north/south, east/west, isolated subnets), and finding unintended access (Network Access Analyzer, Inspector network reachability).

Here the exam likes "which control at which layer" questions: L3/L4 DDoS is **Shield**, an L7 attack is **WAF**, bypassing the CDN is **OAC or a prefix list**, filtering outbound traffic by domain is **Network Firewall**, access without a VPN is **Verified Access**.

## Threat-based edge strategy (3.1.1)

| Threat | Control |
|---|---|
| Volumetric DDoS (L3/L4: SYN flood, UDP reflection) | **Shield Standard** (automatic, free), CloudFront / Global Accelerator absorb it at edge locations; **Shield Advanced** for the SRT, cost protection |
| HTTP flood (L7) | **WAF rate-based rules**, Shield Advanced automatic application layer mitigation |
| SQL injection, XSS, path traversal | **WAF managed rule groups** (Core rule set, SQL database, Known bad inputs) |
| Bots, scraping | **WAF Bot Control**, CAPTCHA/Challenge actions, JA3/JA4 fingerprinting |
| Credential stuffing, account takeover | **WAF Fraud Control ATP** (account takeover prevention), ACFP for fake registrations |
| Direct access to the origin bypassing the CDN and WAF | **Origin Access Control (OAC)** for S3; prefix list + custom header (or CloudFront VPC origins) for ALB/EC2 |
| Unauthorized download of paid content | **Signed URLs / signed cookies** |
| Legal restrictions by country | **CloudFront geo restriction** or **WAF geo match** |
| Sensitive form fields passing through multiple layers | **Field-level encryption** |

## Amazon CloudFront as a security control (3.1.2)

### Origin protection

**Origin Access Control (OAC)** is the recommended way to make an S3 bucket accessible **only** through CloudFront. It replaced the older Origin Access Identity (OAI); OAC supports SSE-KMS and all Regions, and signs requests with SigV4.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::static-site-bucket/*",
    "Condition": {
      "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::111122223333:distribution/E1ABCDEF2GHIJ" }
    }
  }]
}
```

If the objects are encrypted with an **SSE-KMS** key, the key policy must allow `cloudfront.amazonaws.com` the `kms:Decrypt` action with the same `AWS:SourceArn` condition. Block Public Access stays enabled.

For a **custom origin** (ALB, EC2):

- the ALB security group allows inbound only from the AWS managed prefix list **`com.amazonaws.global.cloudfront.origin-facing`**,
- CloudFront adds a **custom origin header** with a secret value (e.g., `X-Origin-Verify`), and an ALB listener rule or WAF on the ALB rejects requests without it (rotate the secret, e.g., via Secrets Manager),
- **CloudFront VPC origins** let an ALB or EC2 sit in a **private subnet** without a public IP address, reachable only by CloudFront.

### Viewer controls

- **Viewer protocol policy**: Redirect HTTP to HTTPS or HTTPS only; the **security policy** determines the minimum TLS version toward viewers. **Origin protocol policy** HTTPS only for encryption to the origin.
- **Response headers policy**: adds security headers (HSTS, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) without changing the application.
- **Signed URLs**: a single file, or the client does not support cookies. **Signed cookies**: multiple files (e.g., all segments of an HLS video) without changing URLs. Use **trusted key groups** (public key in CloudFront, private key with you); the old CloudFront key pairs require the root user.
- **Field-level encryption**: CloudFront at the edge location encrypts the specified fields of a POST request (e.g., the card number) with a public key; only the service with the private key can decrypt them, so the load balancer, logs, and other microservices cannot see them.
- **Geo restriction**: an allow list or block list of countries for the entire distribution (CloudFront uses a GeoIP database). For exceptions and combinations use **WAF geo match**.

> **On the exam:** "Users must not be able to access the S3 objects **directly**, only through CloudFront" = **OAC + bucket policy with `AWS:SourceArn`**. "Only the payment service may see the card number, even though the request passes through several services" = **field-level encryption**, not just HTTPS (HTTPS protects only up to TLS termination).

## AWS WAF (3.1.2, 3.1.3)

**AWS WAF** attaches to CloudFront (a global web ACL, managed from us-east-1), ALB, API Gateway REST API, AppSync, Cognito user pool, App Runner, and Verified Access. A web ACL (a **protection pack** in the new console) contains rules that are evaluated by **priority**; the first rule with a terminating action (Allow/Block) ends evaluation, and if no rule matches, the **default action** applies.

### Building blocks

| Element | Description |
|---|---|
| **AWS Managed Rules** | Core rule set (OWASP risks), Known bad inputs (e.g., Log4j), SQL database, Linux/Windows/PHP, Amazon IP reputation list, Anonymous IP list |
| **Bot Control** | Common (known bots, verified crawlers) and Targeted (advanced bots, browser interrogation) levels |
| **Fraud Control: ATP / ACFP** | Protects the login page from credential stuffing (checking stolen credentials, tracking failed logins) and registration from fake accounts |
| **AWS Marketplace rule groups** | **Third-party** managed rules (e.g., from security vendors) that are added to a web ACL just like AWS rules |
| **Rate-based rule** | Counts requests per aggregation key (IP, forwarded IP, header, cookie, query, label namespace…) in a time window and applies an action above the limit |
| **Geo match** | Country (and region) of origin of the request; adds labels `awswaf:clientip:geo:country:XX` |
| **IP set, regex pattern set** | Lists of addresses and patterns |
| **Labels** | A rule adds a label, and a later rule decides based on the label (e.g., a managed group in Count, a custom rule blocks only for `/admin`) |
| **Actions** | Allow, Block (optionally a custom response), Count, **CAPTCHA**, **Challenge** (an invisible browser check) |
| **Scope-down statement** | Narrows a managed or rate-based rule to part of the traffic (e.g., only `/login`) |

A rate-based rule for login only:

```json
{
  "Name": "login-rate-limit",
  "Priority": 10,
  "Action": { "Block": {} },
  "Statement": {
    "RateBasedStatement": {
      "Limit": 100,
      "EvaluationWindowSec": 300,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "FieldToMatch": { "UriPath": {} },
          "SearchString": "/login",
          "PositionalConstraint": "STARTS_WITH",
          "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }]
        }
      }
    }
  },
  "VisibilityConfig": { "SampledRequestsEnabled": true, "CloudWatchMetricsEnabled": true, "MetricName": "loginRate" }
}
```

### Client fingerprinting (JA3/JA4)

WAF computes a **JA3** (32 characters) and **JA4** (36 characters) fingerprint from the TLS Client Hello message. It identifies the client's TLS library: a bot that rotates IP addresses and User-Agent often keeps the same fingerprint. Important:

- available only for **CloudFront and ALB**,
- you get the fingerprint from **WAF logs** (logging must be enabled),
- used in a string match, regex, or size constraint rule, with **fallback** behavior when the fingerprint cannot be computed.

### Geography and geolocation

| Option | When |
|---|---|
| **CloudFront geo restriction** | Simple: the entire distribution is available only from a list of countries |
| **WAF geo match** | Combinations: e.g., block everything outside the EU **except** a partner IP set; different for different paths; labels for later rules |
| **Route 53 geolocation routing** | Routing users to the nearest endpoint; **not** a security control |

### Organization-level management and integrations (3.1.4)

- **AWS Firewall Manager** applies WAF policies (including AWS and Marketplace rules), Shield Advanced protection, security groups, and Network Firewall policies to all accounts and new resources in the organization.
- WAF logs go to CloudWatch Logs, S3, or Firehose (name with the prefix `aws-waf-logs-`) and can be enabled as a source in **Amazon Security Lake**, which normalizes them into **OCSF**. The same applies to SIEM partners that read OCSF.
- Third-party findings and logs can enter Security Lake as a **custom source** (in OCSF/Parquet format), and **AWS Verified Access** writes its access logs in OCSF format.

> **On the exam:** "Protect the **login page** from credential stuffing with the LEAST effort" = **ATP managed rule group**. "Limit requests **per IP** to one URI" = **rate-based rule with scope-down**. "Bots rotate IP addresses but use the same client" = **JA3/JA4 fingerprint**. "Apply the same WAF rules to **all accounts** automatically" = **Firewall Manager**.

## OWASP Top 10 and AWS controls

| OWASP Top 10 (2021) | AWS control at and around the edge |
|---|---|
| A01 Broken Access Control | Authorization in the application (Cognito, Verified Permissions); WAF does not know business rules |
| A02 Cryptographic Failures | CloudFront/ALB TLS policies, HTTPS only, KMS |
| A03 Injection | WAF Core rule set and SQL database group |
| A05 Security Misconfiguration | Security Hub, Config, response headers policy |
| A06 Vulnerable and Outdated Components | Inspector; WAF Known bad inputs as a temporary fix (virtual patching) |
| A07 Identification and Authentication Failures | WAF ATP, rate limiting, MFA in Cognito |
| A10 Server-Side Request Forgery | IMDSv2, egress filtering (Network Firewall), WAF rules |

## AWS Shield

| | **Shield Standard** | **Shield Advanced** |
|---|---|---|
| Price | Free, automatic for everyone | Subscription per organization + data transfer |
| Protection | L3/L4 attacks at the AWS edge | Plus: advanced detection, L7 automatic mitigation via WAF |
| Support | None | **Shield Response Team (SRT)**, proactive engagement |
| Other | | Cost protection, health-based detection (Route 53 health checks), WAF at no additional cost for protected resources, Firewall Manager |

## S3 CORS and AWS IoT policies (3.1.2)

**Cross-origin resource sharing (CORS)** allows JavaScript from one domain to read resources from another. CORS is enforced by the **browser**; it is **not** access control (curl ignores it). The configuration allows only the required origins and methods:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type", "Authorization"],
    "MaxAgeSeconds": 3000
  }
]
```

Never use `"AllowedOrigins": ["*"]` for buckets with private data and uploads. Access is still controlled by the bucket policy, IAM, and presigned URLs.

**AWS IoT Core policies** are attached to a device's X.509 certificate (or a Cognito identity) and determine MQTT actions (`iot:Connect`, `iot:Publish`, `iot:Subscribe`, `iot:Receive`). **Policy variables** provide least privilege without a separate policy for each device:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "iot:Connect",
      "Resource": "arn:aws:iot:eu-central-1:111122223333:client/${iot:Connection.Thing.ThingName}" },
    { "Effect": "Allow", "Action": "iot:Publish",
      "Resource": "arn:aws:iot:eu-central-1:111122223333:topic/devices/${iot:Connection.Thing.ThingName}/telemetry" }
  ]
}
```

A device can connect only with a client ID equal to its thing name and publish only to its own topic. **AWS IoT Device Defender** audit reports overly broad policies (e.g., `iot:*` on `*`).

## Network controls (3.3.1)

| | **Security group** | **Network ACL** | **AWS Network Firewall** |
|---|---|---|---|
| Level | ENI (instance, endpoint, Lambda in a VPC) | Subnet | Firewall endpoint in a dedicated subnet; traffic is steered with routes |
| State | **Stateful** (return traffic automatically allowed) | **Stateless** (you must also allow return traffic, ephemeral ports 1024-65535) | Stateless and stateful rule groups |
| Rules | **Allow** only | Allow and **deny**, numbered, first match wins | Pass, drop, reject, alert; Suricata IPS rules; domain lists |
| References | Another security group as the source | CIDR only | CIDR, ports, protocols, domains (HTTP Host, TLS SNI), IP set references |
| Typical | Micro-segmentation between tiers | Coarse blocking of ranges, an additional layer | Central north/south and east/west filtering, IDS/IPS, egress by domain |

Example: the DB tier accepts traffic only from the app tier, regardless of how many app tier instances exist:

```bash
aws ec2 authorize-security-group-ingress --group-id sg-db \
  --protocol tcp --port 5432 --source-group sg-app
```

### AWS Network Firewall

- **Stateless rule groups**: fast per-packet 5-tuple rules; actions pass, drop, or **forward to stateful**.
- **Stateful rule groups**: Suricata-compatible rules, a **domain list** (allowlist or denylist for HTTP Host and TLS SNI), and standard 5-tuple rules. **Strict order** (rules by priority, with default actions such as drop established) or **action order** (pass, then drop, reject, alert).
- **TLS inspection** (decryption with a certificate from ACM), **AWS managed threat signatures**, logs: alert, flow, and TLS.
- The firewall subnet is used only by the firewall endpoint; the endpoint does not filter traffic of its own subnet.

```text
# Suricata: allow outbound HTTPS only to github.com, deny everything else
pass tls $HOME_NET any -> $EXTERNAL_NET 443 (tls.sni; content:"github.com"; endswith; msg:"allow github"; flow:to_server; sid:100001; rev:1;)
drop tls $HOME_NET any -> $EXTERNAL_NET any (msg:"block other TLS"; flow:to_server; sid:100002; rev:1;)
```

### Inspection architectures

| Model | Description |
|---|---|
| **Distributed** | A firewall in every VPC (between the IGW and the workload subnets). Simple, but more endpoints and policies (manage through Firewall Manager). |
| **Centralized** | An inspection VPC attached to a **Transit Gateway**. Spoke VPCs send all traffic (egress, east/west, to on-premises) through the inspection VPC. On the inspection VPC's TGW attachment, enable **appliance mode** so that both directions of a flow go through the same AZ endpoint (symmetric routing). |
| **TGW-attached firewall** | Network Firewall attaches directly to the Transit Gateway as a **network function** attachment, without manually building an inspection VPC. |
| **Gateway Load Balancer** | For **third-party** virtual firewalls: a GWLB endpoint in the route, GENEVE encapsulation, transparent insertion. |

> **On the exam:** "Allow outbound traffic **only to approved domains** from all VPCs" = **Network Firewall stateful domain allowlist** (centralized through TGW). Security groups and NACLs do not understand domains. "Intermittent drops after adding centralized inspection" = check **appliance mode** and asymmetric routing.

## Hybrid connectivity (3.3.2)

| Option | Encryption | Note |
|---|---|---|
| **Site-to-Site VPN** | IPsec | Two tunnels per connection (two AWS locations), over the internet; also available as a **private IP VPN** over Direct Connect |
| **Direct Connect (DX)** | **Not encrypted** by default | A private, predictable link; private VIF (VPC), transit VIF (TGW), public VIF (public AWS endpoints) |
| **DX + MACsec** | IEEE 802.1AE, **L2**, point-to-point between your router and the AWS DX device | Dedicated connections of **10, 100, and 400 Gbps** at selected locations; the key is a CKN/CAK pair; `should_encrypt` and `must_encrypt` modes |
| **VPN over DX** | IPsec end-to-end | When you need encryption along the entire path, or a hosted connection without MACsec |
| **AWS Client VPN** | TLS (OpenVPN) | Network access for individual users |

MACsec protects only the link between your device and the DX device; it does not provide end-to-end encryption across multiple segments. For end-to-end, use TLS in the application or IPsec.

> **On the exam:** "Encrypt a **100 Gbps** Direct Connect link at line rate" = **MACsec** (an IPsec VPN tunnel has limited throughput per tunnel). "Encryption **end-to-end** from on-premises to the VPC over DX, connection is **hosted**" = **Site-to-Site VPN over DX**.

## AWS Verified Access (3.3.3)

**AWS Verified Access** provides access to internal applications **without a VPN**, following the zero trust principle: every request is evaluated based on identity and device posture.

- **Trust providers**: one identity provider (IAM Identity Center or OIDC) and optionally multiple **device trust providers** (e.g., Jamf, CrowdStrike, JumpCloud).
- **Policies** in the **Cedar** language, at the endpoint group level and the individual endpoint level. Without a policy, everything is denied.
- **Endpoint types**: load balancer, network interface, **network CIDR** (TCP only), and **RDS**. Access to TCP applications (SSH, RDP, databases) goes through the **Connectivity Client** application on the device; HTTP(S) applications work through the browser.
- WAF can be attached to Verified Access for HTTP applications; logs of every access attempt are in OCSF format.

```text
// "idc" and "jamf" are the policy reference names of the identity and device trust providers
permit(principal, action, resource)
when {
  context.idc.groups has "c242c5b0-6081-1845-6fa8-6e0d9513c107" &&
  context.idc.user.email.verified == true &&
  context.jamf.risk == "LOW"
};
```

## Segmentation (3.3.4)

- **North/south**: traffic between a VPC and the internet or the on-premises network. Controls: IGW only in public subnets, ALB/CloudFront/WAF at ingress, NAT + Network Firewall at egress.
- **East/west**: traffic between workloads (subnets, VPCs, accounts). Controls: security groups per tier, NACLs, separate VPCs and accounts, **Transit Gateway route tables** per domain (prod cannot see dev; blackhole routes), Network Firewall for inspection.
- **Isolated subnets**: no route to an IGW or NAT. Access to AWS services only through **VPC endpoints**: a gateway endpoint for S3 and DynamoDB, interface endpoints (PrivateLink) for the rest. An endpoint policy (e.g., only the organization's buckets with `aws:ResourceOrgID`) and a bucket policy with `aws:SourceVpce` close the exfiltration path.
- **PrivateLink** exposes a service to another VPC or account without peering and without CIDR overlap concerns; the client sees only a single endpoint, not the whole network.

## Finding unintended access (3.3.5)

| Tool | What it does |
|---|---|
| **Network Access Analyzer** | You define a **Network Access Scope** (e.g., "all paths from the internet gateway to ENIs that do not go through the ALB" or "the prod VPC must not reach the dev VPC") and get findings about paths that violate the intent |
| **Amazon Inspector network reachability** | Part of EC2 scanning: findings about instance ports reachable from the internet or other networks through IGW, ELB, peering, VPN, taking into account the combination of SGs, NACLs, and routes |
| **Reachability Analyzer** | Point-to-point diagnostics: whether a source can reach a destination and which component blocks it |
| **AWS Verified Access** | Replaces broad VPN access with per-application access |
| **Firewall Manager / Config** | Audit of security groups (e.g., 0.0.0.0/0 on port 22) across the organization |

> **On the exam:** "**Continuously** identify which instances have ports reachable from the internet" = **Inspector network reachability**. "Verify that **segmentation intent** holds across many VPCs (no path from dev to prod)" = **Network Access Analyzer**. "Why can't instance A reach B?" = **Reachability Analyzer**.

## Summary

- Edge: OAC for S3 (bucket policy with `AWS:SourceArn`, KMS key policy), prefix list + custom header or VPC origins for ALB, signed URLs/cookies, field-level encryption, response headers policy.
- WAF: managed rule groups (Core, SQL, Known bad inputs, Bot Control, ATP), rate-based with scope-down, geo match, labels, CAPTCHA/Challenge, JA3/JA4 only on CloudFront and ALB; Firewall Manager for the organization; Marketplace rules for third-party.
- Shield Standard is automatic; Advanced provides the SRT, L7 automatic mitigation, and cost protection.
- CORS is not access control; IoT policies use policy variables for per-device least privilege.
- SGs are stateful and allow-only, NACLs are stateless with deny, Network Firewall for Suricata, domains, and central inspection (appliance mode on TGW).
- Hybrid: VPN (IPsec), DX is not encrypted, MACsec for L2 on 10/100/400 Gbps dedicated connections, VPN over DX for end-to-end; Verified Access instead of a VPN.
- North/south and east/west segmentation, isolated subnets with VPC endpoints; Network Access Analyzer and Inspector network reachability uncover unintended access.
