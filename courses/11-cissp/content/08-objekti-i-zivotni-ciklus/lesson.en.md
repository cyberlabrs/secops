## Exam Objectives: 3.8, 3.9 and 3.10

This module completes Domain 3: physical security of sites and facilities and management of the information system life cycle. Physical security appears again in Domain 7 (7.14, 7.15), but there from an operations perspective; here the focus is on **design**.

- **3.8 Apply security principles to site and facility design.**
- **3.9 Design site and facility security controls**
  - wiring closets / intermediate distribution frame (IDF),
  - server rooms / data centers,
  - media storage facilities, evidence storage,
  - restricted and work area security,
  - utilities and HVAC,
  - environmental issues (natural disasters, human factors),
  - fire prevention, detection, and suppression,
  - power (redundant, backup).
- **3.10 Manage the information system lifecycle**
  - stakeholder needs and requirements, requirements analysis,
  - secure architectural design, development/implementation, integration,
  - verification and validation, transition/deployment,
  - operations and maintenance/sustainment, retirement/secure disposal,
  - continuous security review.

> In the 2024 outline, 3.9 referred to "intermediate distribution **facilities**" instead of "frame", and 3.10 had "Architectural design" and "Retirement/disposal" without the word "secure" and did not have "Continuous security review". In terms of content, the new outline emphasizes that security is reviewed continuously throughout the entire life cycle.

Key mindset: **human life and safety always come first**. No physical control may jeopardize evacuation, and the fire suppression system is chosen so that it does not endanger people.

## Site and Facility Design Principles (3.8)

### Layered strategy

Physical security follows defense in depth from the outer boundary toward the center: **site perimeter → building → floor/zone → room → rack → device**. Controls have functions that build on each other:

| Function | Goal | Examples |
|---|---|---|
| **Deter** | make the attacker give up | fences, lighting, signs, visible cameras, guards |
| **Deny** | make entry impossible | locks, walls, bollards, mantrap |
| **Detect** | notice the attempt | motion sensors, door alarms, CCTV with analytics |
| **Delay** | buy time to respond | reinforced doors, multiple barriers, safes |
| **Respond** | stop the attack | guards, police, procedure |
| **Recover** | return to normal | DR site, insurance |

The design must ensure that the delay time is greater than the time needed for detection and response.

### CPTED

**Crime Prevention Through Environmental Design (CPTED)** uses the environment itself to reduce crime:

| Principle | Meaning | Example |
|---|---|---|
| **Natural surveillance** | maximum visibility, people see what is happening | windows facing the parking lot, low hedges, good lighting |
| **Natural access control** | guiding movement through design | one clear entrance, pathways, planters instead of fences |
| **Territorial reinforcement** | a clear boundary of private space, a sense of ownership | different paving, signs, fences, well-kept grounds |
| **Maintenance** | a well-maintained space deters (broken windows theory) | repaired lighting, graffiti removal |

### Site selection

- **Environmental risks**: flood zones, seismic zones, hurricanes, wildfires, proximity to airports, chemical plants, highways carrying hazardous cargo.
- **Visibility**: a data center should be **inconspicuous** (no signs revealing its purpose).
- **Accessibility** for emergency services, proximity to fire and police stations.
- **Infrastructure**: multiple independent power sources (different substations), multiple telecom providers with different routes, water for cooling.
- **Neighbors and shared space**: a shared building means shared ventilation, access and risks.
- **Distance from the primary site** for a DR site (so the same disaster does not hit both).

### Building design

- Critical rooms in the **center of the building**, not on exterior walls, not in the basement (flooding) and not on the top floor (roof, leaks).
- **No windows** in server rooms; walls from the floor to the **structural slab** (true floor to true ceiling), not just to the drop ceiling, because otherwise entry is possible over the ceiling.
- One controlled entrance, with emergency exits that open only from the inside (alarmed).
- Walls and doors with the prescribed **fire rating** (e.g., 1 hour).
- Separation of zones by sensitivity: public zone (reception), employee zone, restricted zones.

> **On the exam:** When choosing a location for a server room in an existing building, the BEST choice is a **central location on a middle floor**, without windows or exterior walls, away from plumbing. The basement (flooding) and the top floor (roof) are poor choices.

## Physical Controls by Type of Space (3.9)

### Wiring closets and IDF

The **MDF (main distribution frame)** is the central point of the building's telecommunications equipment (connection to the provider), and **IDFs (intermediate distribution frames)** are the distribution closets on each floor.

- locked, with access records (badge, logs), not shared with the janitor's storage,
- locked racks, cameras at the entrance,
- power and cooling appropriate for the equipment (small UPS),
- protection against cable access: cables in conduits, protected patch panels, unused ports disabled (port security, NAC),
- protection against eavesdropping: fiber where sensitive, control of physical access to cable routes,
- the space must not be beneath water pipes or next to restrooms.

### Server rooms and data centers

| Control | Detail |
|---|---|
| Access | multifactor (badge + PIN or biometrics), **mantrap/airlock** to prevent tailgating, visitor log with escort |
| Zones within the DC | cages per customer, locked racks |
| Layout | **hot aisle / cold aisle** rack layout, containment |
| Floors | raised floor for cables and cooling, with water detection underneath |
| Monitoring | CCTV, temperature, humidity and water sensors, smoke detection (VESDA) |
| Power | dual sources (A/B feed), UPS, generator, PDU with monitoring |
| Tier classification (Uptime Institute) | Tier I (basic, 99.671%), Tier II (redundant components, 99.741%), Tier III (concurrently maintainable, 99.982%), Tier IV (fault tolerant, 99.995%) |

### Media storage facilities

- controlled access and records of media issuance (check-in/check-out),
- **climate conditions** per the manufacturer (tapes are sensitive to temperature, humidity and magnetic fields),
- fireproof safes (media-rated: paper withstands higher temperatures than magnetic media),
- off-site storage at a sufficient distance, trusted transport with chain of custody,
- media encryption, inventory and periodic readability checks,
- protection against data remanence: media awaiting destruction are stored separately until sanitization.

### Evidence storage

The evidence storage space must preserve **integrity and chain of custody**:

- a separate, locked room or safe with **strictly limited access** (only the authorized evidence custodian),
- **a record of every entry and every retrieval** (who, when, why), signatures,
- CCTV and alarms, dual locks,
- sealed and labeled bags and packaging, tamper-evident seals,
- environmental conditions that do not damage evidence (antistatic packaging for electronics, Faraday bags for mobile devices),
- separation from other storage to avoid contamination or substitution.

### Restricted and work area security

| Control | Note |
|---|---|
| **Badges and cards** (proximity, smart card) | rule that badges are worn visibly; prompt revocation upon departure |
| **Mantrap / access control vestibule** | two doors, one opens only when the other is closed; prevents **piggybacking/tailgating** |
| **Turnstiles** | one person per passage |
| **Locks** | mechanical (warded, tumbler, combination), electronic, biometric; every lock is a **delay**, not complete protection |
| **Guards** | the only control that **assesses and decides**; expensive, human error |
| **Dogs** | deterrence and detection; liability risk |
| **Clean desk, screen locking** | protection of information in the work area |
| **Privacy screens, sound insulation** | shoulder surfing, eavesdropping |
| **Visitors** | registration, escort, temporary badges in a different color |
| **SCIF** | a space for working with classified information (protection against emanations and eavesdropping) |

### Perimeter

| Control | Details |
|---|---|
| **Fences** | 1 m (3–4 ft) deters casual trespassers; 2 m (6–7 ft) is hard to climb; 2.4 m (8 ft) with barbed wire deters determined intruders; **PIDAS** fences with sensors |
| **Bollards** | prevent vehicles from reaching the building |
| **Lighting** | even, without dark zones; for critical zones the standard is about 2 fc (foot-candles) at a height of 8 ft; lighting directed outward, not into the guards' eyes |
| **CCTV** | deterrence, detection, evidence; time-stamped recordings; analytics |
| **Sensors (IDS)** | infrared (PIR), microwave, ultrasonic, glass-break sensors, magnetic door contacts, vibration |

### Types of locks

| Lock | Characteristic |
|---|---|
| **Warded / tumbler** (mechanical) | cheap, keys can be copied, vulnerable to manipulation; delay only |
| **Combination / cipher lock** | the code gets shared and leaks; must be changed regularly |
| **Electronic (card, PIN)** | entry records, fast revocation of rights, fail-safe/fail-secure setting |
| **Biometric** | ties access to a person; FAR/FRR and CER as accuracy measures |

### Utilities and HVAC

| Parameter | Recommendation | Problem |
|---|---|---|
| **Temperature** | ASHRAE recommended range **18–27 °C** for inlet air | too high: overheating and failures |
| **Humidity** | about **40–60%** relative humidity (ASHRAE today also uses dew point) | low: **static electricity**; high: **condensation and corrosion** |
| **Pressure** | **positive pressure** in the server room | air (smoke, dust) flows out, not in |
| **HVAC system protection** | separate HVAC for the DC, controlled access to controls, shutting down ventilation in a fire | an attacker using HVAC controls (BMS on the network) can cause overheating |
| **Water and gas** | known location of main valves, leak detection | flooding from pipes or sprinklers |

The BMS (building management system) and the building's ICS components are part of the attack surface and should be **segmented** from the corporate network.

### Environmental and human impacts (environmental issues)

| Category | Examples | Controls |
|---|---|---|
| **Natural disasters** | earthquake, flood, storm, wildfire, pandemic | site selection, seismic bracing of racks, raised equipment, DR site |
| **Man-made, intentional** | sabotage, terrorism, theft, vandalism, civil unrest | perimeter, access control, guards, CCTV |
| **Man-made, unintentional** | fire caused by a malfunction, water leak, cable cut by an excavator, operator error | redundancy, procedures, training, insurance |
| **Utility failures** | loss of power, water, telecom | redundant sources, generators, multiple providers |

## Fire: Prevention, Detection and Suppression (3.9)

### Fire triangle and tetrahedron

A fire needs **fuel, oxygen and heat**, plus a **chemical chain reaction** (tetrahedron). Every suppression agent removes at least one element: water cools (heat), CO₂ and inert gases reduce oxygen, foam isolates the fuel, FM-200 and halon interrupt the chemical reaction.

### Fire classes

| Class (US) | Fuel | Agent | Note (EU classes) |
|---|---|---|---|
| **A** | common combustibles (paper, wood, fabric) | water, foam | EU A |
| **B** | flammable liquids and gases | CO₂, foam, dry chemical | EU B (liquids) and C (gases) |
| **C** | energized **electrical equipment** | CO₂, gases, **not water** | the EU has no separate class; treated as a hazard |
| **D** | combustible metals (magnesium, sodium) | special-purpose dry powder | EU D |
| **K** | cooking oils and fats in kitchens | wet chemical | EU F |

### Prevention

Employee training, regulations on flammable materials, tidy cabling, fire walls and fire doors, no smoking, regular inspections, fire-resistant materials, clear evacuation routes and evacuation drills.

### Detection

| Detector | How it works | Advantage / disadvantage |
|---|---|---|
| **Fixed-temperature** (heat) | triggers at a set temperature | few false alarms, but reacts late |
| **Rate-of-rise** (heat) | rapid temperature increase | faster than fixed, more false alarms |
| **Ionization** (smoke) | smoke interrupts the ionized current | fast for flaming fires |
| **Photoelectric/optical** (smoke) | smoke scatters or blocks light | fast for smoldering fires |
| **Aspirating (VESDA)** | draws in air samples and analyzes particles | earliest detection; for data centers |
| **Flame** (IR/UV) | detects flame radiation | fast, expensive, for specific spaces |

### Water suppression (sprinklers)

| System | How it works | When |
|---|---|---|
| **Wet pipe** | pipes are always full of water, each head opens with heat | cheapest, reliable; risk of leaks and freezing |
| **Dry pipe** | pipes are full of compressed air; water enters when a head bursts | cold spaces (freezing), delayed water release |
| **Pre-action** | dual trigger: a detector opens the valve and fills the pipes, water is released only when a head bursts | **recommended for data centers** using water: reduces the risk of accidental leaks, gives time to extinguish with a handheld extinguisher |
| **Deluge** | open heads, a large amount of water at once | storage of flammable materials, not for IT equipment |

### Gas suppression

| Agent | Principle | Note |
|---|---|---|
| **Halon 1301** | interrupts the chemical reaction | **banned for new production** (Montreal Protocol, ozone layer); existing systems are being replaced |
| **FM-200 (HFC-227ea)**, **Novec 1230 (FK-5-1-12)** | cooling and interrupting the reaction | **safe for people** at designed concentrations, no residue; for server rooms |
| **Inergen, Argonite** (inert gases) | reduce oxygen to a level that extinguishes fire, but people can breathe for a short time | safe for occupants at designed concentrations |
| **CO₂** | displaces oxygen | **lethal to people**; only in unoccupied spaces or with a delay and evacuation alarm |

Handheld extinguishers are placed no more than about 15 m (50 ft) from the equipment. The suppression system should have a **delay and alarm** for evacuation and a manual **abort** button, and upon activation it automatically shuts down HVAC and, if needed, equipment power (EPO, emergency power off).

> **On the exam:** If you are choosing a suppression system for a data center where people work, CO₂ is the wrong answer because it endangers life. The best choices are **clean agents (FM-200, Novec 1230, inert gases)** or **pre-action** sprinklers. Halon is banned for new installations. Water on energized equipment is dangerous (class C).

## Power (3.9)

### Power problems

| Term | Meaning |
|---|---|
| **Fault** | momentary complete loss |
| **Blackout** | prolonged complete loss |
| **Sag (dip)** | momentary low voltage |
| **Brownout** | prolonged low voltage |
| **Spike** | momentary high voltage |
| **Surge** | prolonged high voltage |
| **Inrush** | the initial current surge when equipment is switched on |
| **Noise (EMI/RFI)** | interference; **EMI** from motors, cables; **RFI** from radio devices, fluorescent lights |
| **Transient** | a short-lived disturbance on the line |
| **Ground** | grounding; poor grounding causes interference and hazards |

Mnemonic: the "short" terms are momentary (fault, sag, spike), and the "long" ones are prolonged (blackout, brownout, surge).

### Controls

| Control | Protects against |
|---|---|
| **Surge protector** | spike and surge |
| **Power conditioner / line conditioner** | noise, sag, spike (cleans the signal) |
| **UPS** (online/double-conversion, line-interactive, standby/offline) | short outages and disturbances; gives time for an orderly shutdown or generator start. An **online UPS** continuously powers equipment from the battery and provides the cleanest power |
| **Generator** (diesel, gas) | prolonged outages; requires fuel for a defined period, a fuel delivery contract, regular testing under load |
| **Redundant sources (A/B feed)** | failure of one source or substation; dual power supplies in servers |
| **PDU with monitoring** | overload, consumption tracking |
| **EPO** | emergency shutdown to protect people (covered to prevent accidental pressing) |
| Shielded cables, separating power and data cables | EMI |

> **On the exam:** A UPS is not a substitute for a generator: a UPS bridges **minutes** (until the generator starts or an orderly shutdown), a generator covers **hours and days**. A question about "clean power" without interference is asking for a **power conditioner** or an **online UPS**.

## Managing the Information System Life Cycle (3.10)

### Framework

Objective 3.10 follows **ISO/IEC/IEEE 15288** and **NIST SP 800-160 Vol. 1** (Systems Security Engineering): security is built into the **technical processes** of systems engineering, from idea to disposal. The SDLC (software development) is part of the bigger picture and is covered in detail in Domain 8; the **system life cycle (SLC)** also covers operations and retirement.

| Phase / process | Security activities | Key output |
|---|---|---|
| **Stakeholder needs and requirements** | identifying all stakeholders (owner, users, regulator, operations, security, privacy), protection needs, legal requirements, acceptable risk | protection needs, CONOPS |
| **Requirements analysis** | translating needs into measurable security requirements (functional and assurance), categorization (FIPS 199), threat modeling, traceability | security requirements specification |
| **Secure architectural design** | secure design principles (3.1), security architecture, control selection, trust boundaries, repeated threat modeling, design review | security architecture, draft SSP |
| **Development / implementation** | secure coding, hardened components, SAST/SCA, secure configuration, SBOM | implemented system elements |
| **Integration** | secure joining of components, interfaces and APIs, interoperability and interface security testing | integrated system |
| **Verification and validation** | V: whether the system is **built according to the requirements**; V: whether it **meets user needs** in the real environment; DAST, pentest, control assessment | evidence for authorization |
| **Transition / deployment** | secure introduction into production, data migration, training, **authorization (ATO)**, rollback plan, removing test accounts and data | system in production |
| **Operations and maintenance / sustainment** | patch and change management, configuration baseline, monitoring, vulnerability management, periodic assessments, IR | secure operation throughout its life |
| **Retirement / secure disposal** | retirement plan, archiving per retention requirements, media sanitization (NIST SP 800-88), revoking access and integrations, updating the inventory | documented, secure retirement |
| **Continuous security review** | across **all** phases: continuous monitoring (ISCM, NIST SP 800-137), risk reassessment upon changes, audits, metrics | updated risk profile |

### Verification vs validation

| | Verification | Validation |
|---|---|---|
| Question | "Are we building the system **right**?" (building the system right) | "Are we building the **right** system?" (building the right system) |
| Compares against | the specification and requirements | real user and mission needs |
| Methods | inspection, review, testing against the specification, analysis | user acceptance testing (UAT), operational testing, pilot |

> **On the exam:** Security requirements are defined **at the beginning** (stakeholder needs and requirements analysis), not after implementation. If the question asks when it is CHEAPEST and MOST EFFECTIVE to include security, the answer is the earliest phase. If it asks who should be involved from the start, the answer is the security professional together with the system owner and other stakeholders.

### Traceability and configuration management

- A **requirements traceability matrix (RTM)** links each security requirement to design, implementation and test. It makes it possible to prove that every requirement is met and that there is no functionality without a requirement.
- **Configuration management** in all phases: baseline, version control, change control (CCB/CAB), configuration audit.
- **Change management** in operations: every change goes through a security impact analysis, and significant changes may require reauthorization.

### Development models and the life cycle

| Model | Characteristic | Security note |
|---|---|---|
| **Waterfall** | sequential phases | security is easy to plan, but late discoveries are expensive |
| **V-model** | each development phase has a corresponding verification/validation phase | clear requirement–test link |
| **Spiral** | iterative with risk analysis in each cycle | risk at the center |
| **Agile / DevOps / DevSecOps** | short iterations, automation | security as part of the pipeline ("shift left"), continuous checking |

### Transition and sustainment

- **Before going live**: removing development accounts, debug code, test data (especially real personal data in test), maintenance hooks.
- **Parallel run** of the old and new systems, pilot, phased rollout or big-bang: the choice depends on risk; for critical systems a parallel run reduces risk.
- **Sustainment**: vendors and support (EOS dates, 2.5), spare parts, up-to-date documentation, training for new operators.

### Retirement / secure disposal

1. A retirement plan as part of the life cycle (not improvisation).
2. Identifying data to archive and retention periods (retention, legal hold).
3. Migration to the replacement system and verification of the integrity of migrated data.
4. Revoking accounts, keys, certificates, integrations, DNS records and firewall rules.
5. Media sanitization (clear/purge/destroy according to classification) and a certificate of destruction.
6. Updating the inventory, CMDB and authorization documentation.

## Scenarios

**Scenario 1: fire in a server room with operators.** A new data center plans a CO₂ system because it is cheap. Correct recommendation: a clean agent (FM-200/Novec/inert gas) or pre-action sprinklers, with a delay, alarm and abort button; CO₂ only for spaces where people are not present.

**Scenario 2: tailgating.** Employees hold the door for visitors out of courtesy. Technical control: mantrap or turnstile; administrative: training and policy; detective: CCTV and access log analysis.

**Scenario 3: humidity.** After a new HVAC is installed, humidity drops to 20% and equipment occasionally resets. The cause is **static electricity**; the solution is humidification to the recommended range and antistatic measures.

**Scenario 4: a system without requirements.** The project has reached testing, and only then does the security team receive the documentation. A pentest reveals architectural flaws that are expensive to fix. Lesson: security from the needs and requirements phase, threat modeling in design, continuous security review.

## Quick Glossary

| Term | One sentence |
|---|---|
| CPTED | crime prevention through the design of space (visibility, guidance, territory, maintenance) |
| IDF / MDF | distribution closet per floor / the building's main telecom point |
| Mantrap | two doors that cannot be opened at the same time; against tailgating |
| PIDAS | a fence with sensors for intrusion detection |
| Pre-action | a sprinkler with a dual trigger; the standard for data centers using water |
| VESDA | aspirating smoke detector for the earliest detection |
| EPO | emergency power-off button to protect people |
| Brownout / sag | prolonged / momentary low voltage |
| Surge / spike | prolonged / momentary high voltage |
| Online UPS | continuous power through the battery, the cleanest output |
| RTM | a matrix linking a requirement to design, code and test |
| ISCM | information security continuous monitoring (NIST SP 800-137) |
| Verification / validation | against the specification / against real needs |

> **On the exam:** Physical security questions often offer expensive technologies (biometrics, video analytics) alongside simple measures (lighting, fences, procedures). If the question asks for the MOST COST-EFFECTIVE or FIRST deterrent measure, it is often **lighting** or clear access control; if it asks for the only control that can **assess a situation and make a decision**, the answer is a **guard**.

## Summary

- Site design: layers (deter, deny, detect, delay, respond), CPTED (natural surveillance, natural access control, territorial reinforcement, maintenance), an inconspicuous location, critical rooms in the center of the building, walls up to the structural slab.
- Spaces: IDF/MDF locked and monitored; data center with a mantrap, hot/cold aisle, A/B power, Tier levels; media storage with climate conditions and records; evidence storage with strict chain of custody.
- HVAC: 18–27 °C, humidity about 40–60% (low → static, high → corrosion), positive pressure; segment the BMS.
- Fire: tetrahedron, classes A/B/C/D/K, detectors (heat, smoke, VESDA), sprinklers (wet, dry, **pre-action for DCs**, deluge), clean agents safe for people, **CO₂ endangers life**, halon banned.
- Power: fault/blackout, sag/brownout, spike/surge, noise; surge protector, conditioner, UPS (minutes), generator (hours), dual sources.
- System life cycle (ISO 15288, NIST SP 800-160): needs, requirements, secure design, implementation, integration, verification and validation, transition, operations, secure disposal, with **continuous security review** across all phases. Verification = against the specification; validation = against real needs.
