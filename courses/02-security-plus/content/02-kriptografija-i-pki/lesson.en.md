## Exam objectives: 1.3

- **1.3** Explain the importance of using appropriate cryptographic solutions.

The exam asks you to pick the right cryptographic solution for a given situation: which algorithm, which encryption level, CRL or OCSP, wildcard or SAN, TPM or HSM, hashing or encryption. You won't be asked about the math. You'll be asked **what each thing is for**.

## Basic terms

| Term | Meaning |
|---|---|
| **Plaintext** / **ciphertext** | Readable data / encrypted data |
| **Algorithm (cipher)** | The encryption procedure, publicly known (e.g., AES) |
| **Key** | The secret value. Security depends on the key, not on keeping the algorithm secret. |
| **Key length** | Key length in bits. A longer key = a larger brute-force space. |
| **Data at rest / in transit / in use** | Data on disk / being transferred / in memory during processing |

## Symmetric encryption

**Symmetric encryption** uses the **same key** for encryption and decryption.

- Fast, suitable for large amounts of data (disks, databases, the data stream in TLS).
- The problem: how to deliver the key to the other party securely (**key distribution**). Asymmetric cryptography and key exchange solve this.
- The number of keys grows quickly: every pair of users needs its own key.

| Algorithm | Status | Note |
|---|---|---|
| **AES** (128, 192, 256 bits) | Standard | Used almost everywhere: TLS, BitLocker, LUKS, S3/EBS encryption. **GCM** mode also provides integrity (AEAD). |
| **ChaCha20-Poly1305** | Modern | Fast in software, common on mobile devices, supported in TLS 1.3. |
| **3DES** | Deprecated | Small block (64 bits), removed from modern standards. |
| **DES**, **RC4** | Insecure | Do not use. |

Symmetric algorithms are either **block** ciphers (AES encrypts 128-bit blocks) or **stream** ciphers (ChaCha20 encrypts a stream of bytes).

## Asymmetric encryption

**Asymmetric encryption** uses a key pair: a **public key** (shared freely) and a **private key** (never leaves its owner).

| What you want | Which key is used |
|---|---|
| Only the recipient can read the message (confidentiality) | You encrypt with the **recipient's public key**, they decrypt with their private key |
| Prove that you sent it (signature) | You sign with **your private key**, anyone verifies with your public key |

| Algorithm | Use |
|---|---|
| **RSA** | Encryption and signatures. Minimum key size 2048 bits, 3072+ recommended for long-term protection. |
| **ECC** (elliptic curves, e.g., P-256, Curve25519) | The same security with a much shorter key. Faster, fewer resources (mobile, IoT). |
| **Diffie-Hellman (DH, ECDH)** | Key exchange, not used for encrypting messages. |
| **DSA, ECDSA, Ed25519** | Digital signatures |

Asymmetric cryptography is slow, so in practice a **hybrid approach** is used: a symmetric **session key** is agreed on or exchanged asymmetrically, and then the data is encrypted symmetrically (AES). That's how TLS works.

### Key length

- Symmetric: **AES-128** is still secure today, **AES-256** is the choice for high requirements and long-term protection.
- Asymmetric: RSA keys must be much longer than ECC keys for similar security. A 256-bit ECC key is roughly equivalent to a 3072-bit RSA key.
- A longer key = slower operations. You choose a balance based on risk and the data's lifetime.
- **Post-quantum cryptography**: in 2024 NIST published the first standards (e.g., ML-KEM for key exchange and ML-DSA for signatures). Quantum computers would threaten RSA and ECC, while for symmetric algorithms a longer key (AES-256) is recommended.

> **On the exam:** If the question asks for strong encryption on a device with little processing power (IoT, mobile) or a shorter key with the same security, the answer is **ECC**. If it asks for fast encryption of a large amount of data, the answer is **symmetric (AES)**.

## Key exchange

**Key exchange** solves the problem of how two parties get the same secret key over an insecure network.

- **Diffie-Hellman / ECDH**: both parties compute the same secret key, and the key itself never travels over the network.
- **Ephemeral** variants (**DHE**, **ECDHE**) create a new key for every session. This provides **Perfect Forward Secrecy (PFS)**: if the server's private key leaks later, previously captured traffic still can't be decrypted.
- The old approach (RSA key transport: the client encrypts the session key with the server's public RSA key) has **no PFS** and was removed from TLS 1.3.
- **Out-of-band** exchange: the key is delivered over a different channel (e.g., in person, via a KMS).

> **On the exam:** "A compromised server private key must not allow decryption of previously captured traffic" = **Perfect Forward Secrecy** = **ECDHE/DHE**.

## Protocols and transport encryption

**Transport/communication encryption** protects data in transit.

| Protocol | Use | Note |
|---|---|---|
| **TLS 1.3 / 1.2** | HTTPS, APIs, databases, SMTP STARTTLS | SSL 2/3, TLS 1.0 and 1.1 are obsolete and should be disabled |
| **IPsec** | Site-to-site VPN (AWS Site-to-Site VPN, Azure VPN Gateway) | AH = integrity and authentication, ESP = encryption as well |
| **SSH** | Remote administration, SFTP, git | Replacement for Telnet, FTP, rlogin |
| **HTTPS, SFTP, LDAPS, SNMPv3, SRTP** | Secure versions of older protocols | Insecure: HTTP, FTP, LDAP (389 without TLS), SNMPv1/2c, Telnet |
| **S/MIME, PGP** | Email encryption and signing | |
| **WPA3** | Wireless networks | |

In Kubernetes: mTLS between services (service mesh), TLS on the Ingress, etcd encryption. In the cloud: TLS on the load balancer and end-to-end TLS to the backend for sensitive data.

## Encryption levels for data at rest

The objectives list **Level**: how "broadly" data is encrypted.

| Level | English term | What it protects | Examples |
|---|---|---|---|
| Entire disk | **Full disk** | Everything on the disk, including the OS and swap. Protects against device theft. | BitLocker, FileVault, LUKS, EBS volume / Azure managed disk encryption |
| Partition | **Partition** | One partition on the disk | An encrypted data partition, the others unencrypted |
| Volume | **Volume** | A logical volume (can span several disks or part of a disk) | BitLocker on a data volume, LVM + LUKS |
| File | **File** | Individual files or folders | EFS on Windows, a gpg/age encrypted file, SOPS for secrets in git |
| Database | **Database** | The whole database, database files, and backups | **TDE** (Transparent Data Encryption) in SQL Server and Oracle, RDS instance encryption |
| Record / column | **Record** | Individual rows or fields (e.g., a card number) | Always Encrypted, application-level encryption before writing |

Key rule: disk encryption protects you **when the system is powered off or the disk is stolen**. While the system is running and unlocked, the data is visible to anyone with access to the OS. To protect against users or admins with database access, you need **record/column-level** encryption.

> **On the exam:** "A laptop was stolen" → **full disk encryption**. "The DBA must not see card numbers, the rest of the data is fine" → **record (column) level**. "The whole database and its backups must be encrypted without changing the application" → **database (TDE)**.

## Hashing

**Hashing** is a one-way function: from input of any length it produces fixed-length output (a **digest**). The input can't be recovered from the hash. The same value always produces the same hash.

- Used for **integrity** (verifying a downloaded file, the image digest in Docker `sha256:…`) and for storing passwords.
- **Collision**: two different inputs produce the same hash. With a good algorithm this is practically impossible.

| Algorithm | Status |
|---|---|
| **MD5** | Broken (collisions). Do not use for security. |
| **SHA-1** | Deprecated (practical collisions). Removed from certificates. |
| **SHA-2** (SHA-256, SHA-384, SHA-512) | Today's standard |
| **SHA-3** | Modern alternative with a different construction |
| **HMAC** | Hash + secret key. Provides message integrity and authenticity, but not non-repudiation. |

### Password hashing and salting

A fast hash (SHA-256) is bad for passwords because an attacker can test billions of guesses per second on GPUs.

- **Salting**: a random value (**salt**) is added to each password before hashing and stored alongside the hash. Two users with the same password have different hashes. A salt defeats **rainbow table** attacks (precomputed hash → password tables).
- **Key stretching**: an intentionally slow algorithm repeated many times: **bcrypt**, **scrypt**, **PBKDF2**, **Argon2**. It slows down brute force.
- **Pepper**: an additional secret value stored separately from the database (e.g., in an HSM or KMS).

> **On the exam:** "Two users have the same hash in the database" or "the attacker uses rainbow tables" → the answer is **salting**. "Brute force against stolen hashes needs to be slowed down" → **key stretching** (bcrypt, PBKDF2, Argon2).

## Digital signatures

A **digital signature** proves the origin and integrity of data.

1. The sender computes the hash of the message.
2. They sign (encrypt) the hash with their **private key**.
3. The recipient computes the hash of the received message and verifies the signature with the **sender's public key**.
4. If it matches: the message wasn't changed (**integrity**), it was sent by the owner of the private key (**authentication**), and they can't deny it (**non-repudiation**).

A signature **does not provide confidentiality**. A message can be signed and completely readable. For confidentiality, you also encrypt it.

Examples: code signing (Windows Authenticode), container image signing (cosign), signed git commits, DKIM email signatures, signed JWT tokens (RS256/ES256).

## PKI: public key infrastructure

**Public Key Infrastructure (PKI)** is the set of roles, policies, and systems for issuing, managing, and revoking digital certificates. A certificate binds a **public key** to an identity (domain, person, device), and the **CA** confirms that binding with its signature.

### Certificate authorities and root of trust

- **Certificate authority (CA)**: issues and signs certificates.
- **Root CA**: at the top of the hierarchy, self-signed. Its private key is the most valuable, so the root CA is often kept **offline** (in an HSM), and day-to-day certificates are issued by **intermediate (subordinate) CAs**.
- **Root of trust**: the starting point that is trusted unconditionally. In a browser and OS this is the set of root certificates in the **trust store**. The **chain of trust**: server cert → intermediate CA → root CA from the trust store. In hardware, the root of trust is, for example, a TPM.
- **Registration authority (RA)**: verifies the applicant's identity before issuance.

### Self-signed vs third-party

| | **Self-signed** | **Third-party** (public CA) | Internal (private) CA |
|---|---|---|---|
| Who signs | The key owner itself | A public CA (e.g., Let's Encrypt, DigiCert) | An organizational CA (AD CS, AWS Private CA, cert-manager CA) |
| Trust | Nobody trusts it automatically | Trusted by all browsers | Trusted by devices that have the root added |
| Use | Test, lab | Public web services | Internal services, mTLS, VPN |

> **On the exam:** Users get a browser warning on an internal portal → the certificate is **self-signed** or from an internal CA that isn't in the trust store. Fix: a certificate from a **third-party CA**, or distributing the internal root certificate to devices (e.g., GPO, MDM).

### CSR and the certificate lifecycle

**Certificate signing request (CSR)** generation:

1. Generate a key pair on the server (the private key stays on the server).
2. Create the CSR: it contains the **public key** and identity details (CN, SAN, organization), signed with the private key.
3. Send the CSR to the CA.
4. The CA verifies the identity (e.g., a DNS or HTTP challenge for the domain) and signs the certificate.
5. Install the certificate on the server and monitor its expiration.

```bash
openssl req -new -newkey rsa:3072 -nodes -keyout api.key -out api.csr \
  -subj "/CN=api.example.com" -addext "subjectAltName=DNS:api.example.com"
```

The private key **never** goes to the CA. In Kubernetes, **cert-manager** (ACME) automates this, and in AWS, ACM does.

The lifetime of public TLS certificates is getting shorter (the CA/Browser Forum adopted a gradual reduction from 398 days to 47 days by 2029), so automated renewal is mandatory.

### Wildcard and SAN

- A **wildcard** certificate `*.example.com` is valid for `api.example.com` and `www.example.com`, but **not** for `example.com` or `a.b.example.com` (it covers only **one level**).
- **SAN (Subject Alternative Name)**: a list of multiple specific names in one certificate (`example.com`, `api.example.com`, `example.org`).
- Wildcard risk: if the key leaks from one server, an attacker can impersonate **all** subdomains. The same key in many places increases exposure.

### Revocation: CRL and OCSP

A certificate is **revoked** if the private key is compromised, the domain changed owners, or the certificate was issued incorrectly.

| | **CRL** (Certificate Revocation List) | **OCSP** (Online Certificate Status Protocol) |
|---|---|---|
| How it works | The CA periodically publishes a list of serial numbers of revoked certificates | The client asks an OCSP responder for the status of **one** certificate |
| Freshness | As fresh as the latest list | Status in near real time |
| Size | The list can be large | A small response: good, revoked, unknown |
| Privacy | The CA doesn't see which sites you visit | The responder sees which certificate you're checking |

- **OCSP stapling**: the server itself periodically obtains a signed OCSP response and sends it to the client during the TLS handshake. Faster and without the privacy leak.
- Trend: some large public CAs (e.g., Let's Encrypt in 2025) have stopped offering OCSP and rely on CRLs plus short certificate lifetimes. For the exam, still know the difference between CRL and OCSP.

> **On the exam:** "Real-time status check of a single certificate" → **OCSP**. "A list of all revoked certificates published by the CA" → **CRL**. "The server attaches the status to the handshake" → **OCSP stapling**.

### Key escrow

**Key escrow**: a copy of the key is kept with a trusted third party or in a secure system, so data can be recovered if the key is lost (an employee leaves, a user forgets a password). Example: BitLocker recovery keys stored in Entra ID / Active Directory. Risk: the escrow system becomes a very valuable target, so it must be strictly protected.

## Cryptographic tools

The objectives list **Tools** without details. The exam typically asks where keys are stored.

| Tool | Description | Example |
|---|---|---|
| **TPM** (Trusted Platform Module) | A chip on the motherboard of a single device. Stores keys, measures boot (measured/secure boot), binds disk encryption to the hardware. | BitLocker key in the TPM, vTPM in Azure/AWS VMs |
| **HSM** (Hardware Security Module) | A dedicated, tamper-resistant device (or network service) for generating and storing keys and performing crypto operations at scale. The key never leaves the HSM. | Root CA key, payment keys, AWS CloudHSM, Azure Dedicated/Managed HSM |
| **KMS** (Key Management System) | Central management of the key lifecycle: creation, rotation, access policies, audit. Often backed by an HSM. | AWS KMS, Azure Key Vault, Google Cloud KMS, HashiCorp Vault |
| **Secure enclave** | An isolated environment in the processor that protects code and data **in use**, even from the OS | Apple Secure Enclave, Intel SGX, AWS Nitro Enclaves, Azure confidential computing |

> **On the exam:** **TPM** = one device (laptop, server), tied to the motherboard. **HSM** = centralized, high performance, for many keys and servers (CAs, banks). **KMS** = key management (rotation, policies). **Secure enclave** = protecting data **in use**.

## Obfuscation

**Obfuscation** makes data hard to understand, but it isn't always encryption.

| Technique | English term | How it works | Example |
|---|---|---|---|
| Steganography | **Steganography** | Hides the existence of a message inside another medium (image, audio, video, network packets) | Data in the least significant bits of image pixels; malware that fetches commands hidden in an image |
| Tokenization | **Tokenization** | A sensitive value is replaced with a random token. The token → original mapping is kept in a separate **token vault**. The token has no mathematical relationship to the original. | A card number in an e-commerce system replaced with a token (reduces PCI DSS scope) |
| Data masking | **Data masking** | Part of the data is hidden or replaced (permanently or only on display) | Support sees `**** **** **** 1234`; a test database with fake names |
| Code obfuscation | Code obfuscation | Code is renamed and made convoluted to hinder reverse engineering | Minified and obfuscated JavaScript, mobile app protection |

> **On the exam:** Tokenization is **reversible only through the vault**, and the token can be used in systems that don't need the real data. Masking usually isn't reversible for the user viewing it. Steganography **hides that a message exists at all**, while encryption hides the **content**.

## How it all fits together: a TLS 1.3 connection

A single HTTPS connection uses almost everything from this module:

1. The client and server agree on a version (TLS 1.3) and a **cipher suite** (e.g., AES-256-GCM with SHA-384).
2. **Key exchange**: both sides send ephemeral ECDHE values and compute a shared secret key (**PFS**).
3. The server sends its **certificate** and the chain up to the root CA. The client verifies the CA signature, the name (CN/SAN, possibly a wildcard), the validity period, and the revocation status (**CRL/OCSP**, or stapling).
4. The server **digitally signs** the handshake with its private key (RSA or ECDSA), proving that it holds the key from the certificate.
5. From then on, data is encrypted **symmetrically** (AES-GCM or ChaCha20), with built-in integrity checking.

| Element | Role in the connection |
|---|---|
| ECDHE | Key exchange and forward secrecy |
| Certificate + CA | Server authentication |
| RSA/ECDSA signature | Proof of possession of the private key |
| AES-GCM / ChaCha20 | Data confidentiality and integrity |
| SHA-2 | Hashing within the handshake and key derivation |

**mTLS** (mutual TLS) adds a client certificate as well, so the server also verifies the client. It's used between microservices in a service mesh and for partner APIs.

## Summary

- **Symmetric** (AES, ChaCha20): one key, fast, for large data. **Asymmetric** (RSA, ECC): a key pair, slow, for key exchange and signatures. ECC = shorter key, same security.
- **Key exchange**: DH/ECDH. Ephemeral (ECDHE) provides **Perfect Forward Secrecy**.
- Transport: TLS 1.2/1.3, IPsec, SSH. Disable SSL, TLS 1.0/1.1, Telnet, FTP.
- Encryption levels: full disk (device theft), partition, volume, file, database (TDE), record (sensitive fields).
- **Hashing** (SHA-2/3) = integrity. MD5 and SHA-1 are obsolete. For passwords: **salt** + key stretching (bcrypt, Argon2, PBKDF2).
- **Digital signature**: the private key signs, the public key verifies. Provides integrity, authentication, and non-repudiation.
- PKI: CA, root of trust, CSR (contains the public key), wildcard (one level), **CRL** vs **OCSP** (+ stapling), key escrow, self-signed vs third-party.
- Tools: TPM (device), HSM (centralized, hardware), KMS (management), secure enclave (data in use). Obfuscation: steganography, tokenization, masking.
