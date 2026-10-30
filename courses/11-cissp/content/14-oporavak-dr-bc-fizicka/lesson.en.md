## Exam objectives: 7.10 – 7.15

Domain 7 (**Security Operations**) carries 12.8% of the exam (13% in the 2024 outline). This module closes the domain with six objectives that deal with what you do when something breaks, burns down or floods, and how you protect people and facilities:

- **7.10 Implement recovery strategies**: backup storage strategies (cloud, onsite, offsite, immutable, encrypted), multiple processing sites, system resilience, high availability (HA), Quality of Service (QoS) and fault tolerance, recovery site strategies (cold, warm, hot, resource capacity agreements).
- **7.11 Implement Disaster Recovery (DR) processes**: response, personnel, communications (methods, prioritization), assessment, restoration, training and awareness, lessons learned, metrics (baseline, MTTR, MTBF).
- **7.12 Test disaster recovery plans (DRP)**: read-through/tabletop, walkthrough, simulation, parallel, full interruption, communications (internal/external).
- **7.13 Participate in Business Continuity (BC) planning exercises**.
- **7.14 Implement and manage physical security**: external and internal security controls.
- **7.15 Address personnel safety and security concerns**: travel, emergency management, security training and awareness, duress.

> In the 2024 outline, the backup examples were only "cloud storage, onsite, offsite" (immutable and encrypted are new), recovery sites were "cold vs. hot" (warm is now explicit), DR communications had no "prioritization", and the **Metrics** sub-item (baseline, MTTR, MTBF) did not exist. Objective 7.13 was called "BC planning **and** exercises", 7.14 had "**Perimeter** security controls" instead of "External", and 7.15 listed, alongside training, the examples insider threat, social media impacts and 2FA fatigue.

The **Business Impact Analysis (BIA)** and the BCP program itself are covered in module 3 (objective 1.8). Here we assume the BIA already exists and has produced the recovery target values; now we turn them into technical strategies, processes and tests.

> **On the exam:** in every DR/BC and physical security scenario, **human life and safety come first**. If one of the answers is "evacuate people", "ensure personnel safety" or "unlock doors in case of fire (fail-safe)", it almost always beats answers about data, equipment or money.

## Key recovery metrics (a reminder from the BIA)

A recovery strategy is chosen not by technology but by the numbers from the BIA.

| Metric | Full name | Question it answers | Who determines it |
|---|---|---|---|
| **MTD** / **MAD** / **MTPD** | Maximum Tolerable Downtime / Maximum Allowable Disruption / Max. Tolerable Period of Disruption | How long may a business process be unavailable before unacceptable damage occurs? | Process owner / management (BIA) |
| **RTO** | Recovery Time Objective | Within how much time must the system be available again? | BIA, must be ≤ MTD |
| **WRT** | Work Recovery Time | How long do verification and restoring data/work take after the system is technically up? | Technical and business teams |
| **RPO** | Recovery Point Objective | How much data (in time) may we lose? | BIA; dictates backup/replication frequency |
| **RCO** | Recovery Consistency Objective | How consistent must the data be after recovery? | Less common on the exam |

The basic equation:

```
RTO + WRT ≤ MTD
```

**Example:** The MTD for the billing system is 24 h. Restoring from backup and bringing up the servers takes 10 h (RTO), and verifying postings and entering paper transactions takes 6 h (WRT). 10 + 6 = 16 h ≤ 24 h, the strategy is acceptable. If the restore took 20 h, 20 + 6 = 26 h > 24 h, so a faster strategy is needed (warm site, replication).

**RPO example:** The RPO is 4 h, and a full backup is done once a day at 01:00. If a failure occurs at 23:00, 22 h of data is lost, which violates the RPO. Solution: an incremental backup or snapshot every 4 h, or asynchronous replication.

> **On the exam:** RPO is about **data** (how far back), RTO is about **time** (how long until operating again). A shorter RPO means more frequent backup/replication; a shorter RTO means a hotter site and more redundancy, and therefore a higher cost. The strategy is chosen by management based on the cost/risk ratio, not by IT.

## Backup strategies (7.10)

### Backup types

| Type | What it copies | Archive bit | Backup speed | Restore speed | Restore requires |
|---|---|---|---|---|---|
| **Full** | Everything | Clears | Slowest | Fastest | Only the last full |
| **Incremental** | Changes since the last backup of any type | Clears | Fastest | Slowest | Last full + **all** incrementals |
| **Differential** | Changes since the last full | **Does not clear** | Medium (grows through the week) | Medium | Last full + the **last** differential |
| **Synthetic full** | Merges the full and incrementals on the backup server | — | No load on production | Like a full | The synthetic full |
| **Snapshot** | Volume state at a point in time (copy-on-write) | — | Instant | Fast | The same storage (not a true backup if it is on the same system) |

**Example:** full on Sunday, failure on Thursday morning. With incrementals: full + Mon + Tue + Wed (4 sets). With differentials: full + Wed (2 sets).

### Media rotation

- **GFS (Grandfather-Father-Son)**: daily (son), weekly (father), monthly (grandfather) backups with different retention periods.
- **Tower of Hanoi**: a more complex scheme that provides a longer history with fewer media.
- **The 3-2-1 rule**: 3 copies of the data, on 2 different media, 1 offsite. The modern variant **3-2-1-1-0**: plus 1 offline/immutable copy and 0 errors in restore verification.

### Where to store backups

| Strategy | Advantage | Disadvantage | Note |
|---|---|---|---|
| **Onsite** | Fast restore | The same event (fire, ransomware) destroys both the original and the backup | Only for fast, local recoveries |
| **Offsite** | Survives the loss of the site | Slower restore, transport | Enough distance that the same disaster does not hit both sites |
| **Cloud storage** | Elasticity, geo-redundancy, no media transport | Dependence on the network and provider, egress costs, jurisdiction | Shared responsibility: configuration and keys are yours |
| **Immutable** (WORM, object lock) | Cannot be modified or deleted until retention expires, even with admin rights | Consumes space, a retention mistake is costly | Key defense against ransomware that deletes backups first |
| **Encrypted** | Confidentiality during transport and if media is lost | Lost key = lost backup | Keys are stored separately from the backup and are also backed up (escrow) |
| **Air-gapped / offline** | Physically unreachable by the attacker | Slow, manual process | Tape in a safe is still a valid strategy |

Other techniques for transferring data to a remote site:

- **Electronic vaulting**: periodic bulk transfer of backups to a remote site.
- **Remote journaling**: transferring transaction logs (journals) more often, e.g. every hour; enables restoring almost up to the last transaction.
- **Remote mirroring / replication**: **synchronous** (RPO ≈ 0, but latency limits distance) or **asynchronous** (RPO seconds–minutes, no distance limit).

> **On the exam:** a backup that has never been tested with a restore **is not a backup**. When a question asks what is MOST important for a backup strategy, look for the answer about regular restore testing and keeping a copy out of reach of the same incident (offsite/immutable), not about speed or media cost.

## Resilience, high availability and fault tolerance (7.10)

| Term | Meaning | Example |
|---|---|---|
| **System resilience** | The ability of a system to keep operating or recover quickly despite a failure or attack | Graceful degradation, automatic failover |
| **High Availability (HA)** | The system is available a high percentage of the time, with minimal interruptions | Cluster, load balancer, active/passive nodes |
| **Fault tolerance** | Uninterrupted operation even when a component fails | RAID 1, dual power supplies, redundant network cards |
| **Redundancy** | Duplicated components so there is no single point of failure | N+1 cooling, two ISPs |
| **QoS** | Priority for critical traffic under load | VoIP and control traffic ahead of backup traffic |

The difference: HA allows a short interruption (failover takes seconds), fault tolerance aims for zero interruption. Fault tolerance is more expensive.

### Availability in "nines"

| Availability | Allowed downtime per year |
|---|---|
| 99% | ~3.65 days |
| 99.9% | ~8.76 h |
| 99.99% | ~52.6 min |
| 99.999% | ~5.26 min |

Availability from reliability: `A = MTBF / (MTBF + MTTR)`. If MTBF is 9,990 h and MTTR is 10 h, A = 9,990 / 10,000 = 99.9%.

### RAID

| Level | Technique | Min. disks | Tolerance | Note |
|---|---|---|---|---|
| **RAID 0** | Striping | 2 | **None** | Performance only, not fault tolerant |
| **RAID 1** | Mirroring | 2 | 1 disk | 50% of capacity |
| **RAID 5** | Striping + distributed parity | 3 | 1 disk | Slow rebuild on large disks |
| **RAID 6** | Double parity | 4 | 2 disks | Better for large arrays |
| **RAID 10 (1+0)** | Mirror then stripe | 4 | 1 per mirror | Performance + redundancy |

RAID is not a backup: deletion, ransomware and corruption are instantly replicated to all disks.

### Other elements of resilience

- **Power**: UPS (bridges short outages and gives time for an orderly shutdown), generator (long outages, needs fuel and testing), dual power feeds. Terms: **fault** (momentary loss), **blackout** (prolonged loss), **sag/dip** (momentary low voltage), **brownout** (prolonged low voltage), **spike** (momentary high voltage), **surge** (prolonged high voltage), **inrush** (initial surge when powering on).
- **Clustering** (active/active or active/passive), **load balancing**, **geo-redundancy** across multiple regions/zones.
- **Multiple processing sites**: several sites that process the load simultaneously (active-active), so the loss of one reduces capacity but does not stop operations. In the cloud: multi-AZ and multi-region.

## Recovery site strategies (7.10)

| Site | What it has | Activation time | Cost | Testing |
|---|---|---|---|---|
| **Cold site** | Space, power, HVAC, no equipment or data | Weeks | Lowest | Hard to test realistically |
| **Warm site** | Space and some equipment, connectivity; data is not current | Hours to days | Medium | Partial |
| **Hot site** | Complete equipment, current or near-current data | Minutes to hours | High | Yes |
| **Mirrored / redundant site** | A full copy running in parallel (active-active) | Instant | Highest | Continuous |
| **Mobile site** | A truck/container with equipment | Hours–days | Medium | Yes |
| **Cloud DR (DRaaS)** | Pilot light, warm standby, multi-site in the cloud | Depends on the model | Pay per use | Easy |

Contractual models:

- **Reciprocal agreement (mutual assistance)**: two organizations agree to host each other. Cheap, but hard to enforce, with problems of capacity, confidentiality and a simultaneous disaster in the same region. ISC2 considers it the weakest option.
- **Service bureau / vendor contract**: the provider guarantees capacity on demand.
- **Resource capacity agreement**: a contract in which a provider (e.g. DR or cloud) guarantees reserved capacity (processing, storage, space) in case of a disaster; the key is to verify that the same capacity has not been promised to too many customers (oversubscription).

Cloud analogy: **backup & restore** ≈ cold, **pilot light** ≈ cold/warm (only the core, e.g. the database, runs), **warm standby** ≈ warm (a scaled-down version runs), **multi-site active-active** ≈ hot/mirrored.

> **On the exam:** always tie the choice of site to MTD/RTO. If the MTD is 2 weeks, a hot site is a **waste of money**; if the MTD is 4 h, a cold site is **unacceptable**. The most cost-effective strategy is the one that just meets the RTO, not the fastest one.

## DR processes (7.11)

The **Disaster Recovery Plan (DRP)** is the technical, IT-oriented part of the broader **Business Continuity Plan (BCP)**. The BCP keeps the business running during a disruption; the DRP restores IT systems and the site to normal operation.

| | BCP | DRP |
|---|---|---|
| Focus | Critical business processes | IT systems, data, site |
| Time frame | During and after a disruption | Immediately after a disaster |
| Driver | Strategic, owned by executive management | Tactical, technical teams |
| Includes | BIA, continuity strategies, DRP, COOP, crisis communications | Response, assessment, restoration, failback |

### DR process phases

| Phase | What is done |
|---|---|
| **Response** | Plan activation, personnel safety first, assembling the team, disaster declaration by an authorized person |
| **Assessment** | Damage assessment and scope, decision whether to move to the alternate site |
| **Restoration** | Bringing up critical systems at the alternate site in BIA priority order, then restoring the primary site |
| **Failback / reconstitution** | Returning to the primary site |
| **Lessons learned** | Post-incident review, plan update |

Important restoration principles:

- The **most critical** processes (lowest MTD) are moved to the alternate site first.
- When returning to the primary site, the **least critical** processes go back first, because they serve as a test that the primary site really works. Critical processes stay at the alternate site until the primary has proven itself.
- The disaster officially ends only when all operations have returned to the primary (or a new permanent) site.

> **On the exam:** when returning to the primary site, **the least critical functions go back first**. This is a classic trap because it is the opposite of the logic used when moving to the alternate site.

### Personnel

- Clear roles: DR coordinator, damage assessment team, recovery team, salvage team (salvaging and restoring the primary site), communications team, legal and HR representative.
- **Cross-training** and deputies: the plan must not depend on a single person.
- Caring for people: families, accommodation, transport, psychological support, payroll. Staff who are worried about their families will not do recovery work.
- A **call tree** for mobilization.

### Communications (methods and prioritization)

- **Methods**: telephone call tree, SMS and automated mass notification systems, satellite phones, radio, out-of-band channels (if e-mail is down or compromised, you do not use it), pre-prepared status web pages.
- **Prioritization**: first emergency services and personnel safety, then the DR team and management, then employees, then customers, partners, regulators, and finally the media. Only an authorized **PR/spokesperson** talks to the media, with pre-approved messages.
- Regulatory notifications have legal deadlines (e.g. GDPR 72 h for a data breach), so they are included in the plan.

### Training and awareness

Every DR team member must know their role without reading the plan for the first time during a disaster. All employees should know the basics: evacuation routes, the assembly point, whom to report to. Training is repeated when the plan, personnel or systems change.

### Metrics (baseline, MTTR, MTBF)

| Metric | Formula / meaning | Use |
|---|---|---|
| **Baseline** | The normal level of performance and availability before the incident | Reference for "recovered" and for comparison in lessons learned |
| **MTBF** (Mean Time Between Failures) | Total operating time / number of failures (repairable components) | Reliability, spare parts planning |
| **MTTF** (Mean Time To Failure) | Average lifetime of a non-repairable component | Replacement planning |
| **MTTR** (Mean Time To Repair/Resolve/Recover) | Total repair time / number of failures | Recovery efficiency, must be below the RTO |
| **Availability** | MTBF / (MTBF + MTTR) | SLA |

**Calculation example:** a storage array ran for 8,760 h (a year) and had 4 failures. The total repair time was 20 h.

- MTBF = (8,760 − 20) / 4 = 2,185 h (often approximated as 8,760 / 4 = 2,190 h)
- MTTR = 20 / 4 = 5 h
- Availability = 2,185 / (2,185 + 5) ≈ 99.77%

If the RTO for that system is 4 h, an MTTR of 5 h shows that the strategy does not meet the objective, so redundancy or a faster process is needed.

### Lessons learned

After every DR event and test: what worked, what did not, where RTO/RPO were exceeded, what changes in the plan. The result is an updated plan and an action plan with owners and deadlines, not finding someone to blame.

## Testing DR plans (7.12)

Tests are ordered from least to most disruptive:

| Test | Description | Impact on production | What it proves |
|---|---|---|---|
| **Read-through (checklist)** | Members individually read the plan and check contacts, procedures | None | The plan is current and complete |
| **Tabletop / structured walkthrough** | The team walks through a scenario together in a room, discussion | None | Understanding of roles, gaps in the plan |
| **Walkthrough** | Participants physically walk through the steps (locations, equipment) without actual activation | None | Practical feasibility of the steps |
| **Simulation** | A disaster is simulated, the team carries out the response up to a certain point, without failing over production | Minimal | Response under pressure |
| **Parallel** | Systems are brought up at the alternate site and process data in parallel; the primary runs normally | Small (load, costs) | The alternate site really works |
| **Full interruption (full-scale)** | The primary site is shut down, operations move to the alternate site | **High risk** | Complete proof; can cause an actual disaster |

A note on terminology: some sources (and older ISC2 material) use "structured walkthrough" as a synonym for tabletop. The outline lists both separately; the key is the order of increasing disruption.

**Communications during a test:**

- **Internal**: announcing the test to participants and management, status during the test, a clear "THIS IS A TEST" label in all messages to avoid causing panic.
- **External**: notifying vendors, the DR provider, the ISP, sometimes regulators or customers (especially for parallel and full interruption tests). In the 2024 outline the examples were stakeholders, test status and regulators.

> **On the exam:** a full interruption test requires **senior management approval** and is performed only after less disruptive tests have succeeded. If a question asks which test BEST confirms that the alternate site works **without impacting production**, the answer is **parallel**.

## BC exercises (7.13)

The security professional's role in the BC program is to **participate** (planning is led by the business owner and the BC coordinator, with senior management support). Exercises validate the BCP as a whole, not just IT:

- **Exercise objectives**: defined in advance (e.g. confirm that payment processing continues within 4 h using manual procedures).
- **Participants**: business units, IT, security, legal, HR, communications, key suppliers.
- **Scenario**: realistic and based on the risk assessment (pandemic, loss of a data center, ransomware, failure of a key supplier).
- **Observers** and a **facilitator** record findings.
- An **after-action report** and BCP update.
- Frequency: at least annually and upon significant change (reorganization, a new site, a new critical system).

The BCP lifecycle (NIST SP 800-34, ISO 22301): initiation and policy → BIA → preventive controls → recovery strategies → plan development → **testing, training and exercises** → plan maintenance. ISO 22301 uses the term **exercising** for exercises, and ISO 22313 provides guidance.

A **COOP (Continuity of Operations Plan)** sustains essential functions at an alternate site for up to 30 days (NIST term). The **crisis communications plan** and the **Occupant Emergency Plan (OEP)** are related plans.

> **On the exam:** the BCP must have **senior management support and approval**; the most common reason a BCP fails is a plan that is not maintained and not tested. If asked what the FIRST step in BC planning is, the answer is project initiation and management support (policy), not a technical strategy.

## Physical security (7.14)

Physical security follows a layered approach (**defense in depth**) and a sequence of functions: **deter → deny → detect → delay → determine → decide/respond**. Space design: **CPTED** (Crime Prevention Through Environmental Design) uses natural surveillance (visibility), natural access control (guiding movement) and territorial reinforcement (clearly marked private space).

### External controls (perimeter and site)

| Control | Details |
|---|---|
| **Site selection** | Risk of floods, earthquakes, crime; proximity to emergency services; an inconspicuous building |
| **Fences** | 3–4 ft (1–1.2 m) deters casual trespassers; 6–7 ft (1.8–2.1 m) is hard to climb; 8 ft (2.4 m) with barbed wire stops a determined intruder |
| **Bollards** | Prevent vehicle ramming |
| **Lighting** | NIST standard: critical areas 8 ft high and 2 foot-candles of illumination; light directed outward, toward the intruder, not into the guards' eyes |
| **CCTV** | Deters and detects; footage as evidence; PTZ, analytics |
| **Guards and dogs** | The most flexible control (assessment, decision), but expensive and susceptible to social engineering |
| **Gates and parking** | Vehicle entry control, separate visitor parking |

### Internal controls

| Control | Details |
|---|---|
| **Mantrap / access control vestibule** | Two doors, only one open at a time; prevents tailgating and piggybacking |
| **Turnstiles** | Passage of one person at a time |
| **Locks** | Mechanical (pin tumbler, combination), electronic, smart cards, biometrics |
| **Badges and visitor log** | Escorted visitors, visible badges |
| **Zoning** | Public areas, offices, data center; stricter control further inside |
| **Sensors** | Motion, vibration, door and window contacts, glass break |
| **Server room** | No windows, in the interior of the building, not in the basement (flooding) or on the top floor (roof), walls from slab to slab, access logging |
| **Environment** | Temperature 18–27 °C, humidity 40–60% (too low = static electricity, too high = corrosion/condensation), positive air pressure |

### Fail-safe vs fail-secure

| | Fail-safe (fail-open) | Fail-secure (fail-closed) |
|---|---|---|
| Behavior on power loss | Doors unlock | Doors stay locked |
| Priority | Human life | Asset protection |
| Where | Evacuation exits, main building doors | Safes, server room (with a manual exit from inside) |

### Fire protection

| Class (US) | Fuel | Extinguishing agent |
|---|---|---|
| **A** | Common combustibles (paper, wood) | Water, foam |
| **B** | Flammable liquids | CO₂, foam, dry powder |
| **C** | Electrical equipment | CO₂, clean agents (FM-200, Novec 1230), **not water** |
| **D** | Combustible metals | Dry powder |
| **K** | Cooking oils | Wet chemical |

Sprinkler systems:

| System | How it works | Use |
|---|---|---|
| **Wet pipe** | Water always in the pipes, activated by heat | Most common, cheapest; risk of leaks |
| **Dry pipe** | Pipes filled with air, water enters only on activation | Cold spaces (freezing) |
| **Pre-action** | Two-stage: a detector fills the pipes, then heat opens the head | **Recommended for data centers** (fewer false activations) |
| **Deluge** | All heads open, a huge volume of water | Industrial facilities, not for IT |

Gas systems (FM-200, Inergen, Novec) extinguish without water; **Halon** is banned because of the ozone layer. CO₂ is dangerous to people, so it is used only in unoccupied spaces or with a delay and alarm. Detectors: smoke (ionization, photoelectric), heat (fixed temperature, rate-of-rise), flame (IR/UV).

> **On the exam:** the most important goal of physical security and fire protection is **human safety**. That is why exits must be fail-safe, and a gas system must have an alarm and a delay before discharge. When choosing sprinklers for a data center, **pre-action** is the typical "BEST" answer.

## Personnel safety and security (7.15)

### Travel

- A destination risk assessment before the trip (political situation, health, laws on encryption and device inspection at the border).
- **Loaner** laptops and phones with minimal data; reimaged on return.
- VPN, full-disk encryption, avoiding public Wi-Fi, a privacy filter on the screen.
- Do not leave devices in the hotel room (risk of an "evil maid" attack), do not accept gifted USB devices.
- Tracking employees' location (with consent), an in-country evacuation plan, a 24/7 emergency contact, travel insurance.

### Emergency management

- **Occupant Emergency Plan (OEP)**: evacuation, shelter-in-place, lockdown.
- Evacuation routes, assembly points, **floor wardens** who check rooms and count people.
- Evacuation drills, staff trained in first aid.
- Cooperation with emergency services; after the event: care for the injured, families, communications.
- Scenarios: fire, earthquake, active shooter, pandemic, chemical incident.

### Security training and awareness

Training specific to personnel safety: recognizing social engineering, tailgating, reporting suspicious situations, behavior while traveling, protection against insider threats, the risk of posting location and schedule on social media, rejecting unexpected MFA requests (**MFA/2FA fatigue**, push bombing). Effectiveness is measured (phishing simulation reporting rate, number of incidents).

### Duress

A situation in which an employee is forced under threat to do something against their will (open a safe, enter a password, deactivate an alarm).

- **Duress code / password**: a special password or PIN that opens the system but silently alerts security.
- A **panic button** at the reception desk and at the cash register.
- Agreed code words in conversation ("tell Mark the coffee is cold").
- Rule: the employee **cooperates** and does not risk their life; assets can be replaced.
- The **two-person rule** reduces the value of coercing a single person.

> **On the exam:** in a duress scenario the correct answer is to **comply with the demand and discreetly activate the duress alarm**, not to resist. The organization protects people; controls such as a duress code and dual control exist so that people can cooperate without the attacker gaining full control.

## Practice scenarios

**Scenario 1.** A bank has an MTD of 8 h for core banking. The current strategy is a cold site and daily backups to tapes taken to a safe. Management asks whether this is enough. Answer: no, a cold site takes weeks to activate, and a daily backup gives an RPO of up to 24 h. A hot or warm site with replication is needed; the final decision is made by management based on cost and risk.

**Scenario 2.** After a flood, systems have been running from the alternate site for three weeks. The primary site has been repaired. What goes back first? The least critical systems (e.g. intranet, archive), to prove the primary site works, and the core systems only at the end.

**Scenario 3.** Ransomware encrypted production and deleted the backups on a NAS in the same network. Lessons learned: backups must have an immutable/offline copy and separate credentials; restores are tested regularly.

## Summary

- **RTO + WRT ≤ MTD**; the RPO determines backup/replication frequency; the numbers come from the BIA (module 3), the strategy is chosen by management.
- Backup: full/incremental/differential (archive bit), 3-2-1(-1-0), offsite + **immutable** + **encrypted** (keys stored separately), test restores. RAID and snapshots are not backups.
- Resilience: HA (short failover) vs fault tolerance (no interruption), QoS, multiple processing sites (active-active); A = MTBF / (MTBF + MTTR).
- Sites: cold (weeks) → warm (hours–days) → hot (minutes–hours) → mirrored (instant); a reciprocal agreement is the weakest; a resource capacity agreement guarantees capacity.
- DR processes: response → assessment → restoration → failback → lessons learned; to the alternate site the most critical first, back the least critical first; communications with priorities and an authorized spokesperson; metrics baseline/MTTR/MTBF.
- DR tests by increasing disruption: read-through → tabletop → walkthrough → simulation → parallel → full interruption (management approval).
- BC exercises: security participates, objectives and scenarios in advance, after-action report, at least annually.
- Physical security: deter-deny-detect-delay, CPTED, external (fences, lighting, bollards, CCTV, guards) and internal controls (mantrap, zones, locks); fail-safe for people; pre-action for the data center; class C without water.
- Personnel: travel (loaner devices), OEP and evacuation, training (insider, social media, MFA fatigue), duress (cooperate, duress code).
- Human life always comes first.
