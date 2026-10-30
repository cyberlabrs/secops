## Exam Objectives: 3.6 and 3.7

Cryptography is part of Domain 3 and appears on the exam in other domains as well (networks, IAM, operations). The CISSP does not require math, but **choosing the right solution for a requirement**: what provides confidentiality, what provides integrity, what provides non-repudiation, which key is used for what, and how keys are managed.

- **3.6 Select and determine cryptographic solutions**
  - cryptographic life cycle (keys, algorithm selection),
  - key management practices (rotation, access management),
  - cryptographic methods (symmetric, asymmetric, elliptic curves, post-quantum),
  - digital signatures and digital certificates (non-repudiation, integrity),
  - PKI (e.g., key distribution).
- **3.7 Understand methods of cryptanalytic attacks**
  - brute force, ciphertext only, known plaintext, chosen ciphertext, frequency analysis,
  - timing, side-channel, fault injection, implementation attacks,
  - Adversary-in-the-Middle (MITM), pass the hash, Kerberos exploitation,
  - ransomware, zero-day attacks, AI threats (adversarial AI, model poisoning, deepfake).

> In the 2024 outline, 3.6 mentioned "quantum" instead of "post-quantum" methods, key management only with the example "rotation", and PKI with the example "quantum key distribution". 3.7 said "Man-in-the-Middle", and there were no zero-day attacks or AI threats. QKD still needs to be known at the concept level (see the PKI section).

The attacks in 3.7 are described here **from the defender's perspective**: what the attack exploits and which control prevents it.

## Goals of Cryptography and Basic Concepts

| Goal | What it ensures | Mechanism |
|---|---|---|
| **Confidentiality** | only authorized parties can read | symmetric/asymmetric encryption |
| **Integrity** | modification is detected | hash, MAC/HMAC, digital signature, AEAD |
| **Authentication** | confirmation of the identity of the sender/party | MAC (shared secret), signature, certificates, challenge-response |
| **Non-repudiation** | the sender cannot deny having sent | **only a digital signature** (only one party holds the private key) |

Concepts:

- **Kerckhoffs's principle**: the system must be secure even when everything except the key is public. That is why public, analyzed algorithms are used, not "secret" ones.
- **Confusion** (the relationship between key and ciphertext is complex, substitution) and **diffusion** (changing one plaintext bit changes many ciphertext bits, permutation), Shannon.
- **Work factor**: the time and effort needed to break it; the goal is for it to exceed the value and lifetime of the data.
- **Key space**: 2^n for an n-bit key; each additional bit doubles the number of combinations.
- **IV and nonce**: a random/unique value so that the same plaintext does not produce the same ciphertext. Reusing a nonce in CTR/GCM is a catastrophic mistake.
- **Salt**: a random value added to a password before hashing; prevents rainbow tables and hides identical passwords.
- **Codes vs ciphers**: a code replaces words or phrases, a cipher operates on characters/bits. **Steganography** hides the existence of a message.
- **Stream vs block cipher**: a stream cipher encrypts bit by bit/byte by byte (ChaCha20, RC4 obsolete), a block cipher in blocks (AES 128 bits).

## Cryptographic Methods (3.6)

### Symmetric cryptography

The same key encrypts and decrypts. **Fast**, suitable for large amounts of data, but it has the problem of **key distribution** and **scalability**, and does not provide non-repudiation.

Number of keys for n users: **n(n−1)/2**. Example: 100 users need 100 × 99 / 2 = **4,950** keys; 1,000 users need 499,500.

| Algorithm | Block / key | Status |
|---|---|---|
| **AES** (Rijndael) | block 128, key 128/192/256, 10/12/14 rounds | standard (FIPS 197) |
| **DES** | block 64, key 56 (effective) | broken, do not use |
| **3DES** (TDEA) | block 64, 112/168 | withdrawn (NIST disallowed it for encryption after 2023) |
| **Blowfish / Twofish** | 64 / 128-bit block | Blowfish obsolete due to the 64-bit block; Twofish an AES finalist |
| **ChaCha20** | stream | modern, with Poly1305 as AEAD (TLS 1.3, mobile) |
| **RC4** | stream | broken |
| **IDEA, CAST, Skipjack** | | historical |

### Block cipher modes of operation

| Mode | Characteristic | Note |
|---|---|---|
| **ECB** | each block independently, with the same key | same plaintext → same ciphertext; reveals patterns (the "ECB penguin"); **do not use** |
| **CBC** | XOR with the previous ciphertext, needs an IV | sequential, vulnerable to padding oracle if poorly implemented |
| **CFB / OFB** | turn a block cipher into a stream | OFB: errors do not propagate |
| **CTR** | counter + nonce, parallel | the nonce must not repeat |
| **GCM** | CTR + authentication (AEAD) | confidentiality and integrity together; recommended |
| **XTS** | for disk encryption | BitLocker, FileVault |

### Asymmetric cryptography

A key pair: **public** (shared) and **private** (owner only). Slower than symmetric (100–1,000 times), it solves key distribution and enables digital signatures. Number of keys: **2n** (100 users = 200 keys).

| What I want | Which key I use |
|---|---|
| send a confidential message to Ana | **Ana's public** key for encryption (only Ana's private key decrypts) |
| sign a message | **my own private** key (anyone verifies with my public key) |
| verify Ana's signature | **Ana's public** key |
| read a message encrypted for me | **my own private** key |

| Algorithm | Based on | Use |
|---|---|---|
| **RSA** | factoring large numbers | encryption, signature, key exchange; recommendation ≥ 3072 bits |
| **Diffie-Hellman (DH/ECDHE)** | discrete logarithm | **key exchange (agreement) only**, no authentication by itself (vulnerable to MITM without signature/certificate) |
| **ElGamal** | discrete logarithm | encryption, signature |
| **DSA / ECDSA / EdDSA** | discrete logarithm / elliptic curves | signature only |
| **ECC** (elliptic curves) | discrete logarithm on elliptic curves | the same security level with a much shorter key: 256-bit ECC ≈ 3072-bit RSA ≈ AES-128; ideal for mobile and IoT |

**Hybrid cryptography**: a **symmetric session key** is exchanged (or encrypted) asymmetrically, and the data is encrypted symmetrically. This is how TLS, PGP and S/MIME work. **Perfect forward secrecy (PFS)**: ephemeral DH keys per session, so compromise of the long-term private key does not reveal earlier sessions.

### Symmetric vs asymmetric

| Criterion | Symmetric | Asymmetric |
|---|---|---|
| Keys | one shared | public/private pair |
| Speed | high | low |
| Number of keys for n users | n(n−1)/2 | 2n |
| Key distribution | a problem (needs a secure channel) | the public key is shared freely |
| Confidentiality | yes | yes |
| Integrity / authentication | only with MAC/AEAD | yes (signature) |
| Non-repudiation | **no** | **yes** (signature) |
| Typical use | data encryption, sessions | key exchange, signature, certificates |

### Cryptography in protocols

| Protocol | What it uses |
|---|---|
| **TLS 1.3** | ECDHE (PFS mandatory) for key agreement, certificate and signature for server authentication, AES-GCM or ChaCha20-Poly1305 for data; removed RSA key exchange, CBC, RC4, SHA-1 |
| **IPsec** | IKE for key exchange; **AH** (integrity and authentication, no confidentiality), **ESP** (confidentiality and integrity); transport vs tunnel mode |
| **SSH** | DH exchange, authentication with keys or password, symmetric session encryption |
| **S/MIME** | X.509 certificates (hierarchical PKI) for email signing and encryption |
| **PGP/GPG** | web of trust, hybrid encryption of email and files |
| **Kerberos** | symmetric keys, KDC (AS + TGS), time-limited tickets; requires synchronized time |

### Hash functions

One-way functions with fixed output length. Properties: **preimage resistance** (the input cannot be obtained from the hash), **second preimage resistance**, **collision resistance** (hard to find two inputs with the same hash).

| Algorithm | Output | Status |
|---|---|---|
| MD5 | 128 | collisions, not for security |
| SHA-1 | 160 | collisions (2017), withdrawn |
| **SHA-2** (SHA-256/384/512) | 224–512 | standard |
| **SHA-3** (Keccak) | 224–512 | different construction (sponge), alternative |
| bcrypt, scrypt, **Argon2**, PBKDF2 | | **slow** hashes for passwords (key stretching) |

**Birthday paradox**: for an n-bit hash, a collision is expected after about 2^(n/2) attempts, so SHA-256 gives 128 bits of collision resistance.

**MAC and HMAC**: a hash with a secret key provides integrity and origin authentication, but **not** non-repudiation (both parties have the same key).

### Digital signature

1. The sender computes the **hash** of the message.
2. The hash is signed (encrypted) **with the sender's private key** → signature.
3. The recipient computes the hash of the received message, verifies the signature **with the sender's public key** and compares.

A signature provides **integrity, origin authentication and non-repudiation**, but **not confidentiality**. For confidentiality, the message is additionally encrypted with the recipient's public key. Standard: FIPS 186-5 (RSA, ECDSA, EdDSA), and post-quantum ML-DSA and SLH-DSA.

> **On the exam:** If the requirement asks for **non-repudiation**, the only correct answer is a **digital signature** (asymmetric, the sender's private key). HMAC and symmetric encryption cannot provide non-repudiation because two parties share the key. If the question asks which key Bob uses to encrypt a message for Alice, the answer is **Alice's public key**; to sign, **Bob's private key**.

### Post-quantum cryptography

| Threat | Impact |
|---|---|
| **Shor's algorithm** | breaks RSA, DH, ECC (factoring and discrete logarithm) on a cryptographically relevant quantum computer |
| **Grover's algorithm** | quadratic search speedup, effectively halves the symmetric key: AES-128 → ~64 bits, AES-256 → ~128 bits (still secure) |

NIST standards (August 2024):

| Standard | Algorithm | Purpose |
|---|---|---|
| **FIPS 203** | **ML-KEM** (CRYSTALS-Kyber) | key encapsulation/exchange |
| **FIPS 204** | **ML-DSA** (CRYSTALS-Dilithium) | digital signature |
| **FIPS 205** | **SLH-DSA** (SPHINCS+) | hash-based signature (backup approach) |
| (in preparation) | FN-DSA (Falcon), HQC | signature; additional KEM |

Strategy: **cryptographic inventory** (where which algorithm is used), **crypto agility** (ability to replace an algorithm without redesign), **hybrid modes** (classical + PQC together during the transition, e.g., X25519+ML-KEM in TLS), priority for long-lived data because of **harvest now, decrypt later**.

Other advanced methods: **homomorphic encryption** (computation on ciphertext), **quantum key distribution (QKD)** (key exchange using quantum states; eavesdropping is detected because measurement changes the state; requires special infrastructure, does not replace PQC), **lightweight cryptography** (NIST Ascon for IoT).

## Cryptographic Life Cycle (3.6)

### Algorithm selection

- use **standardized, publicly analyzed** algorithms and validated implementations (FIPS 140-3 modules),
- key length according to the lifetime of the data (NIST SP 800-57, SP 800-131A for transitions and withdrawal),
- regulatory and industry requirements (PCI DSS, eIDAS),
- performance and platform constraints (IoT → ECC, lightweight),
- **never your own cryptography** ("don't roll your own crypto").

### Key phases (NIST SP 800-57)

| Phase | What happens |
|---|---|
| **Pre-operational** | generation (quality RNG), registration, distribution |
| **Operational** | use for encryption/signing during the **cryptoperiod**; storage, backup |
| **Post-operational** | the key is not used for new operations but may decrypt old data or verify old signatures; archiving |
| **Destroyed / compromised** | destruction or revocation; a compromised key is immediately withdrawn and replaced |

**Cryptoperiod**: the time during which a key is authorized for use. A shorter cryptoperiod limits the amount of data exposed by a compromise. It is determined by sensitivity, data volume, environment and algorithm strength.

Algorithms also have a life cycle: approved → **deprecated** (allowed with risk acceptance) → **disallowed**. Examples: DES, 3DES, SHA-1 for signatures, RSA-1024.

| Factor | Shorter cryptoperiod | Longer cryptoperiod acceptable |
|---|---|---|
| Data sensitivity | high | low |
| Amount of data encrypted with the key | large | small |
| Environment | exposed (internet, mobile) | protected (HSM, offline) |
| Algorithm strength and key length | weaker | stronger |
| Cost of rotation | low (automated) | high |

> **On the exam:** When a question asks for the FIRST step in a cryptography program or in preparing for the post-quantum transition, the answer is almost always an **inventory** (which algorithms, keys and certificates we have and where) and a policy, not an immediate replacement of algorithms. Without an inventory there is no crypto agility and no migration plan.

## Key Management (3.6)

Most cryptographic failures are not broken algorithms but **poor key management**.

| Practice | Description |
|---|---|
| **Generation** | cryptographically secure RNG, in an HSM or KMS where possible |
| **Distribution** | out-of-band, key exchange (DH/ECDHE), wrapping with a key-encryption key (**KEK**) |
| **Storage** | HSM, KMS, TPM, secrets manager; never in source code or together with the data |
| **Rotation** | periodic replacement per cryptoperiod and immediately after suspected compromise; automated |
| **Access management** | least privilege over keys, separating key administrators from data administrators, logging every use |
| **Split knowledge** | no single person knows the whole key |
| **Dual control / M-of-N** | M of N people required (e.g., 3 of 5 cards) for a critical operation |
| **Key escrow** | a copy of the key held by a trusted third party (e.g., for lawful access) |
| **Key recovery** | recovering a key if it is lost (e.g., BitLocker recovery key in AD/Entra) |
| **Revocation and destruction** | CRL/OCSP for certificates; secure deletion from the HSM; **crypto-shredding** |
| **Key hierarchy** | master/KEK protects DEKs (**envelope encryption**); KEK rotation without re-encrypting all data |

> **On the exam:** If data is encrypted but the key is stored on the same server or in the same repository, encryption practically does not protect it. The BEST answer is to **separate keys from data** (KMS/HSM) and restrict access to keys to another team (separation of duties). Rotation is mandatory, and **immediately** after suspected compromise.

## Digital Certificates and PKI (3.6)

A **digital certificate (X.509 v3)** binds a public key to an identity and is signed by a **CA**. Fields: version, serial number, signature algorithm, issuer, validity period, subject, public key, extensions (**SAN**, key usage, extended key usage, basic constraints), CA signature.

### PKI components

| Component | Role |
|---|---|
| **Certificate Authority (CA)** | issues and signs certificates; root CA (offline, in an HSM) → intermediate/issuing CA |
| **Registration Authority (RA)** | verifies the identity of the requester; **does not sign** certificates |
| **CSR** | certificate signing request with the public key (the private key stays with the requester) |
| **CRL** | list of revoked certificates; periodic, can be large and stale |
| **OCSP** | real-time certificate status check; with **OCSP stapling** the server attaches a signed response |
| **Certificate Policy (CP) / CPS** | issuance rules and practices |
| **Repository** | publication of certificates and CRLs |

### Chain of trust and models

- **Hierarchical model**: root → intermediate → end-entity. The client trusts the root in its trust store and verifies signatures along the chain.
- **Web of trust** (PGP): users sign each other's keys, without a central CA.
- **Cross-certification / bridge CA**: trust between two PKI hierarchies.
- Validation types: **DV** (domain control), **OV** (organization), **EV** (extended).
- **Certificate pinning**: an application accepts only a specific key/certificate; reduces the risk of a fraudulent certificate.
- **Certificate Transparency**: public logs of all issued certificates for detecting misissued ones.
- **Wildcard** (`*.example.com`) vs **SAN** certificates; shorter certificate validity periods reduce damage from compromise and push automation (ACME).

### Key distribution

| Method | When |
|---|---|
| **Out-of-band** (in person, courier) | initial keys, root keys, a small number of parties |
| **Diffie-Hellman / ECDHE** | agreeing on a session key over an insecure channel (with certificate authentication) |
| **Asymmetric wrapping** | session key encrypted with the recipient's public key |
| **KDC** (Kerberos) | a central trusted server distributes session keys |
| **ML-KEM** | post-quantum key encapsulation |
| **QKD** | physical channel with quantum states, specialized networks |

> **On the exam:** If a server's private key is compromised, the FIRST step is **revoking the certificate** (CRL/OCSP) and issuing a new one with a new key pair. Merely renewing the certificate with the same key does not solve the problem. If the **root CA** is compromised, all certificates in the hierarchy are untrustworthy: that is why the root is offline, in an HSM, under dual control.

## Methods of Cryptanalytic Attacks (3.7)

### Classic attack models

| Attack | What the attacker has | Defense |
|---|---|---|
| **Brute force** | only ciphertext and time; tries all keys | sufficient key length (AES-128+), slow hashes and salt for passwords, account lockout, rate limiting |
| **Ciphertext only** | only ciphertexts | hardest for the attacker; strong modern algorithms |
| **Known plaintext** | plaintext/ciphertext pairs | algorithms resistant to this model (all modern ones), unique IV/nonce |
| **Chosen plaintext** | can encrypt chosen text | randomized encryption (IV), algorithm resistance |
| **Chosen ciphertext** | can obtain decryption of chosen ciphertexts (oracle) | AEAD (GCM), generic error messages, uniform timing (against padding oracle) |
| **Frequency analysis** | statistics of character occurrence | classic substitution ciphers are vulnerable; modern algorithms with diffusion are not |
| **Birthday attack** | looks for hash collisions | sufficiently long hash (SHA-256+), not MD5/SHA-1 |
| **Meet-in-the-middle** | attacks multiple encryption | the reason 2DES does not provide double security |
| **Replay** | resends a recorded message | nonces, timestamps, sequence numbers |

### Implementation and hardware attacks

| Attack | Principle | Defense |
|---|---|---|
| **Implementation attacks** | code errors, weak RNG, reused nonce, poor padding or certificate validation | validated libraries, code review, testing, FIPS 140-3 |
| **Side-channel** | leakage through power consumption (SPA/DPA), electromagnetic radiation, sound, cache | constant-time implementations, masking, shielding, TEMPEST |
| **Timing** | execution time depends on the key or data | constant-time operations, blinding |
| **Fault injection** | inducing an error (voltage, clock, laser, temperature) so the device reveals a secret | tamper-responsive hardware (HSM), checking results before output, detecting power anomalies |
| **Cold boot** | reading keys from RAM after shutdown | memory encryption, TPM+PIN, shutdown instead of sleep |

### Protocol and identity attacks

| Attack | Principle | Defense |
|---|---|---|
| **Adversary-in-the-Middle (MITM/AitM)** | the attacker inserts themselves between parties, intercepts or modifies communication; AitM phishing steals session tokens | mutual authentication, certificate validation, pinning, HSTS, **phishing-resistant MFA (FIDO2)** |
| **Pass the hash** | using a stolen NTLM hash instead of the password | Credential Guard, LAPS, limiting admin rights, tiering model, disabling NTLM, PAW |
| **Kerberos exploitation** | ticket abuse: kerberoasting (offline attack on service accounts), golden ticket (compromised KRBTGT), silver ticket, pass the ticket | long random passwords or gMSA for service accounts, AES instead of RC4, double KRBTGT rotation after compromise, monitoring for ticket anomalies |

### Modern threats in the outline

| Threat | Link to cryptography | Defense |
|---|---|---|
| **Ransomware** | the attacker **uses** strong cryptography against the victim (encrypts data), often with data theft (double extortion) | **offline/immutable backups** and tested recovery, segmentation, EDR, least privilege, patching, IR plan |
| **Zero-day** | an unknown vulnerability (also in crypto libraries) with no patch | defense in depth, segmentation, EDR/behavioral detection, virtual patching, fast patch process |
| **AI threats** | **adversarial AI** (inputs that deceive the model), **model poisoning** (poisoned training data), **deepfake** (fake voice/video for fraud) | integrity and provenance of training data (signatures, provenance), robustness testing, verifying requests through another channel (callback), content credentials (C2PA signatures) |

> **On the exam:** For ransomware, the BEST recovery control is a tested **offline or immutable backup**; paying the ransom is not the recommended answer. For a deepfake call from the "CEO" requesting an urgent payment, the BEST control is a **verification process through another channel** (out-of-band callback), not deepfake detection technology.

## Calculation Examples

**Number of keys.** 50 employees need to communicate confidentially with each other.

- Symmetric: 50 × 49 / 2 = **1,225** keys.
- Asymmetric: 2 × 50 = **100** keys.

**Key space.** Adding one bit doubles the key space; AES-256 has 2^128 times more keys than AES-128.

**Grover.** Under quantum attack AES-256 retains ~128 bits of effective security, so it is considered post-quantum secure; AES-128 drops to ~64 bits.

**Birthday.** A 128-bit hash (MD5) gives about 2^64 attempts to a collision, which is feasible today; SHA-256 gives 2^128.

## Scenarios

**Scenario 1: key in a repository.** A developer accidentally published an API key and a private TLS key to a public Git repository. Deleting the commit does not help because the keys may already have been copied. Correct: treat the keys as compromised, **revoke the certificate** and rotate all secrets, investigate usage logs, introduce a secrets manager and secret scanning in the CI pipeline.

**Scenario 2: a 30-year archive.** An archive of signed contracts must be verifiable for decades. Signature algorithms will become obsolete and certificates will expire. Solution: trusted timestamping, periodic re-signing/archival signatures with a stronger algorithm, planning the PQC transition, preserving the certificate chain and revocation status from the time of signing.

**Scenario 3: departure of the key administrator.** The only administrator who knows the password for the HSM partition is leaving the company. The problem is the lack of an **M-of-N** and **key recovery** process. Control for the future: a quorum of cards distributed among several people, a documented recovery procedure, a safe with sealed parts (split knowledge).

**Scenario 4: internal services.** Microservices communicate over the internal network without encryption "because the network is trusted". Under the Zero Trust principle, **mTLS** with automatically rotated short-lived certificates (service mesh or internal PKI) is needed, because otherwise an attacker who gets into the network can see and modify the traffic.

## Quick Solution Selection

| Requirement | Solution |
|---|---|
| encrypting large amounts of data | AES-GCM (symmetric) |
| key exchange over the internet | ECDHE (with a certificate), in the future an ML-KEM hybrid |
| non-repudiation of contracts | digital signature (RSA/ECDSA/ML-DSA) with a certificate |
| integrity of a file from a trusted source | hash published over a trusted channel, or a signature |
| integrity and authentication between two services with a shared secret | HMAC |
| password storage | Argon2/bcrypt + salt |
| mobile and IoT devices | ECC, lightweight cryptography |
| CA and payment keys | HSM, M-of-N |

## Quick Glossary

| Term | One sentence |
|---|---|
| Work factor | effort needed to break it; must exceed the value and lifetime of the data |
| AEAD | encryption that provides confidentiality and integrity at the same time (GCM, ChaCha20-Poly1305) |
| PFS | ephemeral keys per session; theft of the long-term key does not reveal old sessions |
| KEK / DEK | key that encrypts keys / key that encrypts data |
| Key escrow | a copy of the key held by a trusted third party |
| OCSP stapling | the server attaches signed proof of its certificate's status |
| Crypto agility | the ability to replace an algorithm without redesigning the system |
| Oracle | a system whose response (e.g., an error) reveals information about decryption |

## Summary

- Cryptography provides confidentiality, integrity, authentication and non-repudiation; **non-repudiation only from a signature**.
- Symmetric: fast, n(n−1)/2 keys, AES-GCM; avoid ECB, DES, 3DES, RC4. Asymmetric: 2n keys, RSA, DH (exchange only), ECC (shorter keys); hybrid approach and PFS.
- Hash: SHA-2/SHA-3, slow hashes and salt for passwords; HMAC provides integrity and authentication without non-repudiation.
- Signature: hash of the message signed with the sender's private key, verified with the public key.
- PQC: Shor breaks RSA/ECC, Grover halves symmetric keys; FIPS 203/204/205 (ML-KEM, ML-DSA, SLH-DSA); inventory, crypto agility, hybrid transition.
- Key life cycle (SP 800-57): pre-operational, operational, post-operational, destroyed; cryptoperiod; algorithms become deprecated and then disallowed.
- Key management: HSM/KMS, separate from data, rotation, least privilege, split knowledge, dual control, escrow and recovery, envelope encryption.
- PKI: the CA signs, the RA verifies, CRL/OCSP for revocation, root offline; compromised key → revocation and a new pair.
- Attacks (descriptive): models by what the attacker has (ciphertext only, known/chosen plaintext/ciphertext), implementation and side-channel, MITM, pass the hash, Kerberos, ransomware (offline backups), zero-day (defense in depth), AI threats (provenance, verification through another channel).
