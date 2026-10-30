## Exam objectives: 2.1, 2.2, and 2.3

- **2.1** Explain characteristics of threats and vulnerabilities: threat feeds and intelligence sources, likelihood and impact, the life cycle, CVE, CVSS, and prioritization.
- **2.2** Describe common threat actors and motivations: who attacks, why, and with what resources.
- **2.3** Describe threat vectors and sources: the path an attack takes into the organization.

The exam gives you a description of an attacker or an attack and asks you to classify it: which actor, which motivation, which vector.

## Threats and vulnerabilities: basic terms

| Term | Meaning | Example |
|---|---|---|
| **Threat** | Anything that can exploit a weakness and cause harm | A ransomware group, a flood, a disgruntled employee |
| **Vulnerability** | A weakness in a system, process, or people | An unpatched Jenkins, a public S3 bucket |
| **Threat vector** | The path an attack takes to reach the target | A phishing email, exposed RDP, an infected USB drive |
| **Attack surface** | The total set of points where an attacker can try | All public endpoints, accounts, employees, vendors |
| **Likelihood** | How likely it is that the threat materializes | A vulnerability with a public exploit and active attacks = high |
| **Impact** | How much damage results if it does | A leak of all customers' data = high |

Risk is roughly estimated as **likelihood × impact**. The same vulnerability carries a different risk on a public production server than on an isolated test VM.

## Threat intelligence

### Intelligence sources

**Intelligence sources** are where threat information comes from.

| Source | Description | Examples |
|---|---|---|
| **OSINT** (open-source intelligence) | Publicly available data | Researcher blogs, CISA advisories, social media, Shodan, public GitHub |
| **Proprietary / commercial** | Paid vendor services | Feeds from large security companies, threat intel platforms |
| **ISAC** (Information Sharing and Analysis Center) | Sharing among organizations in the same industry | FS-ISAC (finance), H-ISAC (healthcare) |
| **Government** | Government agencies and CERTs | CISA, national CERTs, the CISA **KEV** catalog (Known Exploited Vulnerabilities) |
| **Dark web** | Forums and marketplaces where data and tools are sold | Monitoring whether your company's credentials are for sale |
| **Internal** | Your own logs, incidents, honeypots | SIEM data, results of previous incidents |

### Threat feeds

A **threat feed** is an automated, continuous stream of indicators (IP addresses, domains, hashes, URLs) and campaign information.

- Standard formats: **STIX** (structure for threat data) and **TAXII** (protocol for exchanging STIX data). This lets a SIEM, firewall, or EDR import indicators automatically.
- Platforms: **MISP** (open-source indicator sharing).
- Feed quality: **timeliness**, accuracy, relevance to your industry, and **confidence level**. A bad feed generates false alarms.
- MITRE **ATT&CK** isn't a feed but a knowledge base of attacker tactics and techniques. It's useful for mapping what an attacker does.

### Life cycle

The objectives list **Life cycle**. For threat intelligence, the typical cycle is:

1. **Requirements / direction**: what we need to know (e.g., "which groups are attacking fintech in the region?").
2. **Collection**: gathering from sources and feeds.
3. **Processing**: normalization, deduplication, format conversion.
4. **Analysis**: interpretation, correlation, assessing relevance.
5. **Dissemination**: delivery to those who need it (SOC, management, DevOps).
6. **Feedback**: was it useful, what should change.

"Life cycle" can also refer to the life cycle of the threat or vulnerability itself: discovery, disclosure, exploit availability, active exploitation, patch, remediation. The longer a vulnerability stays open after disclosure, the higher the likelihood of an attack.

> **On the exam:** "Banks share information about threats targeting their sector specifically" → **ISAC**. "Automated exchange of indicators between systems" → **STIX/TAXII** threat feed. "Public sources" → **OSINT**.

## CVE, CVSS, and prioritization

### CVE

**Common Vulnerabilities and Exposures (CVE)** is a public catalog of unique identifiers for known vulnerabilities, e.g., `CVE-2021-44228` (Log4Shell).

- A CVE provides a **name and short description**, not a severity score.
- MITRE runs the program, and IDs are assigned by **CNA** organizations (vendors, research groups).
- The **NVD** (National Vulnerability Database) adds CVSS scores, CPE (which products are affected), and references.
- Scanners (Trivy, Grype, Amazon Inspector, Defender for Cloud) report findings as CVE IDs.

### CVSS

The **Common Vulnerability Scoring System (CVSS)** gives a severity score from 0.0 to 10.0.

| Score | Severity |
|---|---|
| 0.0 | None |
| 0.1 – 3.9 | Low |
| 4.0 – 6.9 | Medium |
| 7.0 – 8.9 | High |
| 9.0 – 10.0 | Critical |

- **Base** metrics: properties of the vulnerability itself (attack vector: network/adjacent/local/physical, attack complexity, privileges required, user interaction, impact on C/I/A).
- **Temporal** (v3.1) / **Threat** (v4.0) metrics: whether an exploit exists, exploit maturity.
- **Environmental** metrics: adjusting to your environment (how important the affected system is).
- The current version is **CVSS v4.0** (2023), but v3.1 is still widely used.

### Prioritization

**Prioritization**: CVSS alone isn't enough. The right order takes into account:

- **Exploitability**: is there a public exploit, is it on the CISA KEV list, what is the EPSS probability of exploitation.
- **Exposure**: is the system reachable from the internet.
- **Asset criticality**: production with personal data vs. a test environment.
- **Compensating controls**: a WAF rule, segmentation.

**Vulnerability types**: vulnerabilities are grouped by kind (application, OS, configuration, cryptographic, hardware, zero-day…). The details are in the next module (objective 2.4).

> **On the exam:** When a question offers "the highest CVSS" and "an actively exploited vulnerability on a public system," the correct answer is usually the latter. Prioritization = severity + likelihood + exposure + asset value.

## Threat actors

### Actor types

| Actor | English term | Typical motivation | Resources / sophistication |
|---|---|---|---|
| State-sponsored | **State-sponsored** (nation-state) | Espionage, political and military advantage, infrastructure sabotage | Very high. Zero-day exploits, long-running campaigns (APT). |
| Organized crime | **Crime syndicate / organized crime** | Financial gain, extortion (ransomware) | High. Professionally organized, ransomware-as-a-service. |
| Hacktivist | **Hacktivist** | Ideological, political, social message | Low to medium. DDoS, defacement, data leaks. |
| Terrorist | **Terrorist** | Fear and chaos, ideology | Variable. Targets: critical infrastructure, propaganda. |
| Insider | **Insider** | Revenge, money, espionage for a competitor | Has legitimate access and knowledge of the systems |
| Unintentional | **Accidental / unintentional** | No malicious intent | A mistake: a misconfiguration, a file sent to the wrong person |
| Competitor | **Competitor** | Intellectual property, market advantage, sabotage | Medium to high, sometimes via an insider |
| Inexperienced attacker | **Unskilled attacker** (formerly "script kiddie") | Curiosity, fame, fun | Low. Uses ready-made tools and scripts without understanding them. |

### Motivations

| Motivation | English term | Example |
|---|---|---|
| Financial | **Financial** | Card theft, ransomware, crypto mining |
| Influence | **Influence** | Disinformation campaigns, election interference |
| Intellectual property | **Intellectual property** | Theft of source code, designs, formulas |
| Fame | **Notoriety** | Bragging on forums, defacing a well-known site |
| Espionage | **Espionage** | Long-term, quiet data collection |
| Fear/chaos | **Fear / chaos** | An attack on hospitals or the water supply |
| Extortion | **Extortion** | "Pay or we publish the data" (double extortion) |
| Curiosity | **General curiosity** | "What's behind this port?" |
| Revenge | **Revenge** | A fired admin deletes resources |
| Ideological | **Ideological** | An attack in the name of a belief or movement |
| Political | **Political** | Targeting a government or a party |
| Ethical | **Ethical** | A penetration tester, a bug bounty researcher, responsible vulnerability disclosure |

> **On the exam:** The key is motivation: **hacktivist** = ideological/political message, **organized crime** = money, **nation-state** = espionage and long-term quiet access, **competitor** = IP. "Uses ready-made tools from the internet without deeper knowledge" = **unskilled attacker**.

### Actor attributes

- **Internal / external**: an insider has access and knowledge, so perimeter controls don't stop them. Controls: least privilege, separation of duties, activity monitoring, offboarding.
- **Resources / funding**: nation-states and organized crime have money for zero-day exploits, infrastructure, and teams. Hacktivists and unskilled attackers don't.
- **Level of sophistication / capability**: from running ready-made scripts to developing custom malware and firmware implants.

### APT

An **Advanced Persistent Threat (APT)** is an attacker (most often state-sponsored, sometimes a very capable criminal group) that is:

- **Advanced**: uses sophisticated techniques, custom malware, sometimes zero-days.
- **Persistent**: stays in the network for months or years, unnoticed.
- **Threat**: has a clear goal (espionage, preparing sabotage).

APTs often use **living-off-the-land** techniques and legitimate accounts to evade detection.

## Threat vectors

### Message-based

| Vector | Note |
|---|---|
| **Email** | Phishing, malicious links and attachments, BEC (business email compromise). Protection: SPF, DKIM, DMARC, filtering, training. |
| **SMS** | Smishing: fake package delivery, fake bank, OTP codes |
| **RCS** (Rich Communication Services) | The successor of SMS with images and buttons. Same scams, richer content, messages look more convincing. |
| **Instant messaging** | WhatsApp, Telegram, Signal: impersonation, links, attachments |
| **Collaboration tools** | Teams, Slack: an attacker from an external tenant poses as the IT helpdesk; shared malicious files; users trust internal channels more than email |

### Image-based

- **QR codes**: the QR code leads to a fake login page. It bypasses email filters that only check text links, and the user opens the link on a phone outside corporate protection (**quishing**).
- **Embedded content**: malicious content in images (e.g., SVG files containing JavaScript, images hiding a payload via steganography, tracking pixels).
- **CAPTCHA**: fake CAPTCHA pages that ask the user to "prove they're human" by copying and running a command in the Run dialog or a terminal (a technique known as "ClickFix"). Attackers also use real CAPTCHAs to hide a phishing page from automated scanners.

### Attachment-based

- **Embedded macros**: VBA macros in Office documents. Microsoft blocks macros by default in files from the internet (Mark of the Web), so attackers are moving to other formats.
- **RTF documents**: RTF can contain embedded objects (OLE) and exploit vulnerabilities in the parser.
- **PDFs**: links to phishing pages, embedded JavaScript, QR codes inside the PDF.

### Browser-based

| Vector | Risk |
|---|---|
| **Extensions** | An extension with broad permissions reads every page. A legitimate extension can be sold or compromised and then receive a malicious update. |
| **JavaScript** | Malicious scripts on compromised sites: card skimming (Magecart), XSS, drive-by downloads |
| **Password managers** | Autofill on a fake page, a compromised vault, or a fake password manager extension |
| **Cookies** | Stolen by infostealer malware or XSS, enabling session hijacking |
| **Session tokens** | A stolen token = a logged-in user **without a password and without MFA**. That's why infostealers are a big problem today. |

### Network-based

- **Infrastructure devices**: routers, firewalls, VPN concentrators, and load balancers at the network edge are favorite targets (they often have no EDR, and vulnerabilities get exploited quickly).
- **Virtualized devices**: virtual firewalls, hypervisors, virtual switches. A hypervisor compromise (e.g., ESXi) affects every VM.
- **Session keys**: if an attacker obtains session keys (weak cryptography, server memory, no PFS), they can decrypt or hijack traffic.

### Remote access

- **Remote desktop (RDP)**: RDP exposed to the internet is one of the most common entry points for ransomware. Brute force, stolen credentials, vulnerabilities.
- **VNC**: often poorly protected, sometimes without a password or encryption.
- **VPN**: vulnerabilities in VPN appliances and credentials without MFA.

Protection: don't expose RDP/VNC directly to the internet; use a VPN or ZTNA with MFA, a bastion host, or AWS Systems Manager Session Manager / Azure Bastion.

### Endpoint-based

- **Mobile devices**, **tablets**: malicious apps, sideloading, lost devices, BYOD without MDM.
- **Workstations**, **servers**: classic targets for malware and lateral movement.
- **Trusted devices**: a device the system trusts (remembered for MFA, registered in Intune/Entra) becomes a valuable target: if it's compromised, the attacker inherits that trust.
- **Built-in tools** and **living-off-the-land tools (LOTL)**: the attacker uses tools already on the system (PowerShell, WMI, `certutil`, `bitsadmin`, `rundll32`, `ssh`, `curl`, cloud CLIs) instead of bringing their own malware. It's harder to detect because the tools are legitimate and signed.

> **On the exam:** "The attacker uses PowerShell and WMI that are already installed, with no new files on disk" → **living-off-the-land**. Defense: logging (PowerShell script block logging), EDR with behavioral analysis, restricting tools (application control).

### Supply chain-based

An attack through someone you already trust:

| Source | Example risk |
|---|---|
| **Third-party providers** | A compromised library (npm, PyPI), a malicious software update from a vendor |
| **Managed service providers (MSP)** | An MSP has admin access to many clients. Compromising the MSP or its RMM tool = access to all of them. |
| **Logistic providers** | Hardware intercepted and modified during shipping, counterfeit components |
| **SaaS providers** | A data breach at a SaaS vendor, compromised OAuth integrations with access to your data |

DevOps controls: SBOM, signed artifacts, pinning versions and hashes, a private registry, vendor assessment, least privilege for integrations.

### External media-based

- **Malicious USB**: a USB drive left in the parking lot (baiting), a USB device that poses as a keyboard and types commands (HID attack), a USB device that physically damages the machine. Protection: blocking USB storage via policy, disabled autorun, training.

### Human-based

- **Impersonation**: the attacker poses as IT support, an executive, a vendor.
- **Contractor**: an external collaborator with temporary access, often with more permissions than needed and with poor offboarding.
- **Visitor**: an unescorted visitor in the building can plug in a device or photograph screens.
- **Biometric**: spoofing biometrics (a printed fingerprint, a photo of a face, a voice deepfake) or stealing biometric data that can't be changed like a password.
- **Watering hole**: the attacker compromises a site the target visits often (an industry forum, a local restaurant, a vendor's site) and waits for victims to come.

### IoT-based

- **Cameras**, **sensors**, **printers**: often have default passwords, rare updates, and sit on the same network as workstations. The Mirai botnet infected hundreds of thousands of cameras and routers via default credentials. Printers store copies of documents and can be an entry point into the network.

### OT-based

**Operational technology (OT)**: industrial systems (ICS, SCADA, PLC) in factories, energy, and water utilities. Long equipment lifetimes, protocols without authentication, and patching is hard because it requires stopping production. The consequence of an attack is physical (human safety, supply disruption).

### Physical-based

- **Lock and key**: lock picking, key duplication, unlocked doors.
- **Access vestibule** (formerly "mantrap"): a space with two doors where one opens only after the other closes. A control against tailgating, and a weakness if poorly configured.
- **Access passes**: cloning RFID cards, borrowed or stolen cards, fake badges.

### Signal-based

- **Bluetooth**: bluejacking (sending unsolicited messages), bluesnarfing (stealing data), vulnerabilities in the Bluetooth stack.
- **RF** (radio frequency): jamming, intercepting wireless traffic, replaying remote controls and car key fobs.
- **NFC**: interception or relay attacks on contactless payments and access cards at very short range.

> **On the exam:** A **watering hole** differs from phishing in that the attacker **doesn't send** anything to the victim, but waits on a site the victim visits on their own. **Supply chain** differs in that the attack comes through a **trusted vendor or software**.

## Summary

- Risk = **likelihood × impact**. Intelligence sources: OSINT, commercial, ISAC, government (CISA KEV), dark web, internal.
- **Threat feeds** deliver indicators automatically, typically via **STIX/TAXII**. Threat intel has a life cycle from requirements to feedback.
- **CVE** = vulnerability ID. **CVSS** = severity score 0–10. Prioritize by severity, exploitability (KEV, EPSS), exposure, and system importance.
- Actors: nation-state (espionage, APT), organized crime (money), hacktivist (ideology), insider (access), competitor (IP), unskilled attacker (ready-made tools), accidental (mistake), terrorist (fear/chaos).
- Attributes: internal/external, resources, sophistication.
- Vectors: messages (email, SMS, RCS, IM, Teams/Slack), images (QR, CAPTCHA), attachments (macros, RTF, PDF), browser (extensions, tokens), network, remote access (RDP, VNC, VPN), endpoint (LOTL), supply chain (MSP, SaaS), USB, people (watering hole), IoT, OT, physical, and signals (Bluetooth, RF, NFC).
- **Living-off-the-land** = abuse of legitimate tools already on the system.
